import { afterEach, beforeEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  type DialogContentProps,
  type DialogProps,
  type DialogSize,
  type DialogTitleProps,
} from '../Dialog';
import { Drawer } from '../Drawer';
import { Button } from '../../button/Button';
import { DatePicker } from '../../input/DatePicker';
import {
  buttonClassNames,
  dialogContentClassNames,
  dialogTitleClassNames,
  drawerClassNames,
} from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import type { Slot } from '../../../lib/slot';
import type { SurfaceSize } from '../../../lib/types';
import {
  expectNoA11yViolations,
  installResizeObserverMock,
  mockRect,
  renderWithProviders,
  testNoImplicitSubmit,
} from '../../../test-utils';

/*
 * P6-06 D93–D97: the backdrop slot (the surface's sibling, `null`, `appearance`), dim once for a
 * modal over another, the `closeButton` slot with the dismiss rules, and the title-actions area
 * (`titleAction`, `Dialog.Title action`, the measured title padding).
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  expect(document.documentElement.style.overflow).toBe('');
});

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

/** The backdrop of every open Dialog, in DOM (opening) order. */
const dialogBackdrops = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.' + dialogContentClassNames.backdrop));
const drawerBackdrop = () => document.querySelector<HTMLElement>('.' + drawerClassNames.backdrop);
const titleActions = () => {
  const area = document.querySelector<HTMLElement>('.' + dialogContentClassNames.titleActions);
  if (!area) throw new Error('no title-actions area');
  return area;
};

/** The exact warning of a button merged into `closeButton`. */
const MERGED_BUTTON_WARNING =
  '[WaveUI] Dialog.Content: `closeButton` received a button element; its props were merged into the built-in Close button (buttons cannot be nested). Pass icon content instead, e.g. `closeButton={<CloseIcon />}`.';

/** A Dialog open by default around `contentProps`, with a body button. */
function Open({
  dialogProps,
  contentProps,
  children = <button type="button">Body action</button>,
}: {
  dialogProps?: Partial<DialogProps>;
  contentProps?: Partial<DialogContentProps>;
  children?: React.ReactNode;
}) {
  return (
    <Dialog defaultOpen {...dialogProps}>
      <Dialog.Content title="Edit report" {...contentProps}>
        {children}
      </Dialog.Content>
    </Dialog>
  );
}

/** A stand-in for the toast region: an allow-listed portal that a modal never makes inert. */
function ToastRegion() {
  return createPortal(
    <div data-wave-focus-trap-allow="">
      <button type="button">Dismiss toast</button>
    </div>,
    document.body,
  );
}

describe('Dialog.Content backdrop (P6-06 D93)', () => {
  it('renders an aria-hidden, dimmed backdrop as the previous sibling of the positioner', () => {
    render(<Open />);
    const surface = screen.getByRole('dialog', { name: 'Edit report' });
    const positioner = surface.parentElement;
    expect(positioner).toHaveClass(
      dialogContentClassNames.positioner,
      'pointer-events-none',
      'fixed',
      'inset-0',
      'flex',
      'items-center',
      'justify-center',
    );
    const backdrop = positioner?.previousElementSibling;
    expect(backdrop).toHaveClass(
      dialogContentClassNames.backdrop,
      'fixed',
      'inset-0',
      'bg-backdrop',
    );
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveAttribute('data-appearance', 'dimmed');
    expect(backdrop?.childElementCount).toBe(0);
    // The surface takes presses again inside the positioner, which lets them through.
    expect(surface).toHaveClass('pointer-events-auto');
  });

  it('gives a slot object’s class (merged last), style, data attribute and ref to the backdrop', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Open
        contentProps={{
          backdrop: {
            className: 'bg-transparent',
            style: { opacity: 0.5 },
            'data-testid': 'backdrop',
            ref,
          },
        }}
      />,
    );
    const backdrop = screen.getByTestId('backdrop');
    expect(dialogBackdrops()).toEqual([backdrop]);
    expect(backdrop).toHaveClass(dialogContentClassNames.backdrop, 'bg-transparent');
    expect(backdrop).not.toHaveClass('bg-backdrop');
    expect(backdrop).toHaveStyle({ opacity: '0.5' });
    expect(ref.current).toBe(backdrop);
    // The class changes the look only: the attribute keeps the resolved appearance.
    expect(backdrop).toHaveAttribute('data-appearance', 'dimmed');
  });

  it('runs a slot object’s onMouseDown before its own press handling', () => {
    const seen: boolean[] = [];
    render(
      <Open
        dialogProps={{ modalType: 'alert' }}
        contentProps={{ backdrop: { onMouseDown: (event) => seen.push(event.defaultPrevented) } }}
      />,
    );
    const [backdrop] = dialogBackdrops();
    // The alert backdrop prevents the press after the consumer's handler saw it unprevented.
    expect(fireEvent.mouseDown(backdrop)).toBe(false);
    expect(seen).toEqual([false]);
  });

  it('keeps aria-hidden="true" over a slot object’s own aria-hidden', () => {
    render(<Open contentProps={{ backdrop: { 'aria-hidden': false } }} />);
    expect(dialogBackdrops()[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('{ appearance: "transparent" } renders a transparent backdrop', () => {
    render(<Open contentProps={{ backdrop: { appearance: 'transparent' } }} />);
    const [backdrop] = dialogBackdrops();
    expect(backdrop).toHaveAttribute('data-appearance', 'transparent');
    expect(backdrop).toHaveClass('bg-transparent');
    expect(backdrop).not.toHaveClass('bg-backdrop');
    expect(backdrop).not.toHaveAttribute('appearance');
  });

  it.each([
    ['false', false],
    ['true', true],
    ['undefined', undefined],
  ] as const)('renders the default backdrop for %s (a boolean is no slot)', (_, value) => {
    render(<Open contentProps={{ backdrop: value }} />);
    const backdrops = dialogBackdrops();
    expect(backdrops).toHaveLength(1);
    expect(backdrops[0]).toHaveAttribute('data-appearance', 'dimmed');
    expect(backdrops[0]).toHaveClass('bg-backdrop');
  });

  it('renders shorthand content inside the backdrop, and a press on it closes a modal dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Open
        dialogProps={{ onOpenChange }}
        contentProps={{ backdrop: <span data-testid="backdrop-art">Pattern</span> }}
      />,
    );
    const art = screen.getByTestId('backdrop-art');
    expect(art.parentElement).toBe(dialogBackdrops()[0]);
    await user.click(art);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'outside-press' }),
    );
  });

  it('a refused press on the backdrop content gives the focused field its focus back', async () => {
    const user = userEvent.setup();
    function Refuses() {
      const [open, setOpen] = React.useState(true);
      return (
        <Dialog
          open={open}
          onOpenChange={(next, details) => {
            if (details?.reason !== 'outside-press') setOpen(next);
          }}
        >
          <Dialog.Content title="Rename" backdrop={<span data-testid="backdrop-art">Pattern</span>}>
            <input aria-label="Name" />
          </Dialog.Content>
        </Dialog>
      );
    }
    render(<Refuses />);
    const name = screen.getByRole('textbox', { name: 'Name' });
    act(() => name.focus());
    await user.click(screen.getByTestId('backdrop-art'));
    await flushMicrotasks();
    expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
    expect(name).toHaveFocus();
  });

  describe('backdrop={null}', () => {
    it('renders no backdrop; the page stays inert and Escape closes it', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Page button</button>
          <Open contentProps={{ backdrop: null }} />
        </>,
      );
      expect(dialogBackdrops()).toEqual([]);
      expect(document.querySelector('.' + dialogContentClassNames.positioner)).not.toBeNull();
      expect(
        screen.getByRole('button', { name: 'Page button', hidden: true }).closest('[inert]'),
      ).not.toBeNull();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('a press outside the surface still closes a modal dialog (outside-press)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Open dialogProps={{ onOpenChange }} contentProps={{ backdrop: null }} />);
      await user.click(document.body);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'outside-press' }),
      );
    });

    it('a press outside the surface never closes an alert dialog', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Open
          dialogProps={{ onOpenChange, modalType: 'alert' }}
          contentProps={{ backdrop: null }}
        />,
      );
      await user.click(document.body);
      expect(screen.getByRole('alertdialog', { name: 'Edit report' })).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});

describe('dim once (P6-06 D94)', () => {
  /** A Drawer with a row whose Delete opens a confirm Dialog inside the drawer's content. */
  function NestedConfirm({ dialogBackdrop }: { dialogBackdrop?: DialogContentProps['backdrop'] }) {
    return (
      <>
        <ToastRegion />
        <button type="button">Page button</button>
        <Drawer defaultOpen title="Orders">
          <Dialog>
            <Dialog.Trigger>
              <button type="button">Delete row</button>
            </Dialog.Trigger>
            <Dialog.Content title="Delete the row?" backdrop={dialogBackdrop}>
              <Dialog.Close>
                <button type="button">Cancel</button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </Drawer>
      </>
    );
  }

  /** The same confirm Dialog rendered beside the Drawer; the dialog can close the drawer. */
  function BesideConfirm() {
    const [drawerOpen, setDrawerOpen] = React.useState(true);
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    return (
      <>
        <ToastRegion />
        <button type="button">Page button</button>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Orders">
          <button type="button" onClick={() => setConfirmOpen(true)}>
            Delete row
          </button>
        </Drawer>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Dialog.Content title="Delete the row?">
            <button type="button" onClick={() => setDrawerOpen(false)}>
              Close the orders
            </button>
            <Dialog.Close>
              <button type="button">Cancel</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </>
    );
  }

  it.each([
    ['opened from the drawer’s content', NestedConfirm],
    ['rendered beside the drawer', BesideConfirm],
  ] as const)(
    'a confirm Dialog over a Drawer dims the page once and keeps both isolations (%s)',
    async (_, Layout) => {
      const user = userEvent.setup();
      render(<Layout />);
      expect(drawerBackdrop()).toHaveAttribute('data-appearance', 'dimmed');
      await user.click(button('Delete row'));
      const [dialogBackdrop] = dialogBackdrops();
      expect(dialogBackdrop).toHaveAttribute('data-appearance', 'transparent');
      expect(dialogBackdrop).toHaveClass('bg-transparent');
      expect(drawerBackdrop()).toHaveAttribute('data-appearance', 'dimmed');
      expect(drawerBackdrop()).toHaveClass('bg-backdrop');
      // The page outside both is inert, the drawer is inert behind the dialog, toasts are not.
      expect(
        screen.getByRole('button', { name: 'Page button', hidden: true }).closest('[inert]'),
      ).not.toBeNull();
      expect(
        screen.getByRole('dialog', { name: 'Orders', hidden: true }).closest('[inert]'),
      ).not.toBeNull();
      expect(button('Dismiss toast').closest('[inert]')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Delete the row?' }).closest('[inert]')).toBeNull();
      await user.click(button('Cancel'));
      expect(screen.queryByRole('dialog', { name: 'Delete the row?' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Orders' }).closest('[inert]')).toBeNull();
      expect(drawerBackdrop()).toHaveAttribute('data-appearance', 'dimmed');
    },
  );

  it('dims the upper dialog once the lower drawer closes (beside layout)', async () => {
    const user = userEvent.setup();
    render(<BesideConfirm />);
    await user.click(button('Delete row'));
    expect(dialogBackdrops()[0]).toHaveAttribute('data-appearance', 'transparent');
    await user.click(button('Close the orders'));
    expect(screen.queryByRole('dialog', { name: 'Orders', hidden: true })).not.toBeInTheDocument();
    expect(dialogBackdrops()[0]).toHaveAttribute('data-appearance', 'dimmed');
    expect(dialogBackdrops()[0]).toHaveClass('bg-backdrop');
  });

  it('backdrop={{ appearance: "dimmed" }} wins over the automatic transparent backdrop', async () => {
    const user = userEvent.setup();
    render(<NestedConfirm dialogBackdrop={{ appearance: 'dimmed' }} />);
    await user.click(button('Delete row'));
    expect(dialogBackdrops()[0]).toHaveAttribute('data-appearance', 'dimmed');
    expect(dialogBackdrops()[0]).toHaveClass('bg-backdrop');
  });

  it('a Dialog over another Dialog: the upper is transparent, the lower dimmed', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Settings">
          <Dialog>
            <Dialog.Trigger>
              <button type="button">Reset</button>
            </Dialog.Trigger>
            <Dialog.Content title="Reset every setting?">Sure?</Dialog.Content>
          </Dialog>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('Reset'));
    const [lower, upper] = dialogBackdrops();
    expect(lower).toHaveAttribute('data-appearance', 'dimmed');
    expect(upper).toHaveAttribute('data-appearance', 'transparent');
  });

  it('an open DatePicker calendar below (a modal layer without isolation) does not make a Dialog transparent', async () => {
    const user = userEvent.setup();
    function CalendarThenDialog() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <DatePicker aria-label="Due date" locale="en-US" />
          <button type="button" onClick={() => setOpen(true)}>
            Hidden opener
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <Dialog.Content title="Due dates">Body</Dialog.Content>
          </Dialog>
        </>
      );
    }
    render(<CalendarThenDialog />);
    await user.click(button('Open calendar'));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    // Opened from code while the calendar is open: the calendar's layer is below the dialog's.
    act(() => button('Hidden opener').click());
    expect(screen.getByRole('dialog', { name: 'Due dates' })).toBeInTheDocument();
    // The calendar is still open below the dialog, and it does not count.
    expect(screen.getByRole('grid', { hidden: true })).toBeInTheDocument();
    expect(dialogBackdrops()[0]).toHaveAttribute('data-appearance', 'dimmed');
  });
});

describe('Dialog.Content closeButton (P6-06 D95)', () => {
  it('null hides it: Escape still closes, and initial focus goes to the first body control', async () => {
    const user = userEvent.setup();
    render(<Open contentProps={{ closeButton: null }} />);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(button('Body action')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders content inside the Button, decorative, so the button keeps closeLabel', () => {
    render(
      <Open
        contentProps={{
          closeLabel: 'Close report',
          closeButton: <svg data-testid="close-glyph" />,
        }}
      />,
    );
    const close = button('Close report');
    expect(close).toHaveClass(buttonClassNames.root, dialogContentClassNames.closeButton);
    const glyph = within(close).getByTestId('close-glyph');
    expect(glyph.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(close).toHaveAttribute('aria-label', 'Close report');
  });

  it.each([
    ['an empty string', ''],
    ['an empty array', []],
    ['false', false],
  ] as const)('keeps the default glyph for content that renders nothing (%s)', (_, value) => {
    const { unmount } = render(<Open />);
    const defaultMarkup = button('Close').innerHTML;
    unmount();
    render(<Open contentProps={{ closeButton: value as Slot<'span'> }} />);
    expect(button('Close').innerHTML).toBe(defaultMarkup);
    expect(button('Close').querySelector('svg')).not.toBeNull();
  });

  it('a slot object styles the default glyph when it has no content of its own', () => {
    render(
      <Open contentProps={{ closeButton: { className: 'text-error', 'data-testid': 'g' } }} />,
    );
    const content = screen.getByTestId('g');
    expect(content).toHaveClass('text-error');
    expect(content.querySelector('svg')).not.toBeNull();
    expect(button('Close')).toContainElement(content);
  });

  it('a slot object’s aria-label names the button', () => {
    render(
      <Open
        contentProps={{
          closeButton: { 'aria-label': 'Dismiss the report', children: <svg data-testid="g" /> },
        }}
      />,
    );
    const close = button('Dismiss the report');
    expect(close).toContainElement(screen.getByTestId('g'));
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('a slot object’s onClick runs first; preventDefault() keeps the dialog open', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Open
        dialogProps={{ onOpenChange }}
        contentProps={{ closeButton: { onClick: (event) => event.preventDefault() } }}
      />,
    );
    await user.click(button('Close'));
    expect(screen.getByRole('dialog', { name: 'Edit report' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes with reason close-button after a slot object’s onClick', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onClick = vi.fn();
    render(<Open dialogProps={{ onOpenChange }} contentProps={{ closeButton: { onClick } }} />);
    await user.click(button('Close'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'close-button' }),
    );
  });

  describe('a merged button', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warn.mockRestore();
    });

    it('a <button> with a text label names the Close button, drops closeLabel and warns once', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <React.StrictMode>
          <Open
            contentProps={{
              closeButton: (
                <button type="button" onClick={onClick}>
                  Done
                </button>
              ),
            }}
          />
        </React.StrictMode>,
      );
      const done = button('Done');
      expect(done).toHaveClass(buttonClassNames.root, dialogContentClassNames.closeButton);
      expect(done).not.toHaveAttribute('aria-label');
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      // One button: never a button inside a button.
      expect(done.querySelector('button')).toBeNull();
      expect(warn.mock.calls).toEqual([[MERGED_BUTTON_WARNING]]);
      await user.click(done);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('takes the label a translation component renders after mount', async () => {
      function Translated({ text }: { text: string }) {
        return <>{text}</>;
      }
      render(
        <Open
          contentProps={{
            closeButton: (
              <button type="button">
                <Translated text="Done" />
              </button>
            ),
          }}
        />,
      );
      await flushMicrotasks();
      expect(button('Done')).not.toHaveAttribute('aria-label');
      expect(warn.mock.calls).toEqual([[MERGED_BUTTON_WARNING]]);
    });

    it('a slot object that renders a button is merged too, with its own warning text', () => {
      render(<Open contentProps={{ closeButton: { as: 'button', children: 'Done' } }} />);
      expect(button('Done')).toHaveClass(dialogContentClassNames.closeButton);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Dialog.Content: `closeButton` received a slot object that renders a button; its props were merged into the built-in Close button (buttons cannot be nested). Pass icon content instead, e.g. `closeButton={<CloseIcon />}`.',
        ],
      ]);
    });

    it('a Wave Button’s icon and disabledFocusable apply, its appearance does not', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Open
          dialogProps={{ onOpenChange }}
          contentProps={{
            closeButton: (
              <Button
                appearance="primary"
                size="large"
                icon={<svg data-testid="merged-icon" />}
                disabledFocusable
              />
            ),
          }}
        />,
      );
      const close = button('Close');
      expect(within(close).getByTestId('merged-icon')).toBeInTheDocument();
      expect(close).toHaveAttribute('aria-disabled', 'true');
      expect(close).toHaveAttribute('data-disabled-focusable');
      expect(close).not.toHaveClass('bg-primary');
      expect(close).not.toHaveClass('h-10');
      expect(close).toHaveClass('h-6', 'bg-transparent');
      // Focusable but unavailable: a click does not close the dialog.
      act(() => close.focus());
      expect(close).toHaveFocus();
      await user.click(close);
      expect(screen.getByRole('dialog', { name: 'Edit report' })).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[MERGED_BUTTON_WARNING]]);
    });

    it('an explicit type of the merged button wins (MessageBar parity)', () => {
      render(
        <Open
          contentProps={{
            closeButton: (
              <button type="submit" form="report">
                Done
              </button>
            ),
          }}
        />,
      );
      expect(button('Done')).toHaveAttribute('type', 'submit');
      expect(button('Done')).toHaveAttribute('form', 'report');
      expect(warn.mock.calls).toEqual([[MERGED_BUTTON_WARNING]]);
    });

    it('a naming attribute of the merged button wins over its text', () => {
      render(
        <Open
          contentProps={{
            closeButton: (
              <button type="button" aria-label="Close the report">
                Done
              </button>
            ),
          }}
        />,
      );
      expect(button('Close the report')).toHaveTextContent('Done');
      expect(warn.mock.calls).toEqual([[MERGED_BUTTON_WARNING]]);
    });
  });

  describe('keeps the default type="button" with slot content', () => {
    testNoImplicitSubmit(Dialog, {
      defaultProps: {
        open: true,
        children: (
          <Dialog.Content title="Edit" closeButton={<svg />}>
            Body
          </Dialog.Content>
        ),
      },
    });
  });
});

describe('Dialog title actions (P6-06 D97)', () => {
  let resizeObserver: ReturnType<typeof installResizeObserverMock> | undefined;
  afterEach(() => {
    resizeObserver?.restore();
    resizeObserver = undefined;
  });

  const expandAction = (
    <button type="button" aria-label="Expand">
      +
    </button>
  );

  it.each(['ltr', 'rtl'] as const)(
    'places titleAction before the Close button in DOM and Tab order (%s)',
    async (dir) => {
      const user = userEvent.setup();
      renderWithProviders(<Open contentProps={{ titleAction: expandAction }} />, { dir });
      const expand = button('Expand');
      const close = button('Close');
      const area = titleActions();
      expect(area).toHaveClass('absolute', 'end-4', 'top-4', 'flex', 'items-start', 'gap-1');
      expect(expand.parentElement).toHaveClass(
        dialogContentClassNames.titleAction,
        'inline-flex',
        'items-center',
        'gap-1',
      );
      expect(expand.parentElement?.parentElement).toBe(area);
      expect(close.parentElement).toBe(area);
      expect(expand.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Initial focus is the first focusable element: the title action.
      expect(expand).toHaveFocus();
      await user.tab();
      expect(close).toHaveFocus();
      await user.tab();
      expect(button('Body action')).toHaveFocus();
    },
  );

  it('renders a Dialog.Title action in the area, after titleAction and before Close, outside the heading', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content titleAction={expandAction}>
          <Dialog.Title
            action={
              <button type="button" aria-label="More">
                …
              </button>
            }
          >
            Report
          </Dialog.Title>
          <p>Body</p>
        </Dialog.Content>
      </Dialog>,
    );
    // The dialog's name is the heading text only.
    const dialog = screen.getByRole('dialog', { name: 'Report' });
    const heading = within(dialog).getByRole('heading', { name: 'Report' });
    const more = button('More');
    expect(heading).not.toContainElement(more);
    const actionElement = more.parentElement;
    expect(actionElement).toHaveClass(
      dialogTitleClassNames.action,
      'inline-flex',
      'items-center',
      'gap-1',
    );
    expect(actionElement?.parentElement).toHaveClass('contents');
    expect(actionElement?.parentElement?.parentElement).toBe(titleActions());
    const expand = button('Expand');
    const close = button('Close');
    expect(expand.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(more.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('moves initial focus to a Dialog.Title action (it is in the DOM before the trap starts)', () => {
    render(
      <React.StrictMode>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title
              action={
                <button type="button" aria-label="More">
                  …
                </button>
              }
            >
              Report
            </Dialog.Title>
            <button type="button">Body action</button>
          </Dialog.Content>
        </Dialog>
      </React.StrictMode>,
    );
    expect(screen.getAllByRole('button', { name: 'More' })).toHaveLength(1);
    expect(button('More')).toHaveFocus();
  });

  it('keeps the mount order of two Dialog.Titles’ actions', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title
            action={
              <button type="button" aria-label="First action">
                1
              </button>
            }
          >
            Report
          </Dialog.Title>
          <Dialog.Title
            action={
              <button type="button" aria-label="Second action">
                2
              </button>
            }
          >
            Section
          </Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const first = button('First action');
    const second = button('Second action');
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      second.compareDocumentPosition(button('Close')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders a Dialog.Title action right after its heading in a Drawer', () => {
    render(
      <Drawer defaultOpen>
        <Dialog.Title
          action={
            <button type="button" aria-label="Pin">
              P
            </button>
          }
        >
          Notes
        </Dialog.Title>
      </Drawer>,
    );
    const heading = screen.getByRole('heading', { name: 'Notes' });
    expect(heading.nextElementSibling).toHaveClass(dialogTitleClassNames.action);
    expect(heading.nextElementSibling).toContainElement(button('Pin'));
    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeInTheDocument();
  });

  it('renders nothing for actions that render nothing', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content titleAction={[]}>
          <Dialog.Title action="">Report</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    expect(document.querySelector('.' + dialogContentClassNames.titleAction)).toBeNull();
    expect(document.querySelector('.' + dialogTitleClassNames.action)).toBeNull();
    // The area is always rendered, with the Close button.
    expect(button('Close').parentElement).toBe(titleActions());
  });

  it('gives both title forms the measured end padding class', () => {
    const { unmount } = render(<Open />);
    expect(screen.getByRole('heading', { name: 'Edit report' })).toHaveClass(
      'pe-[var(--wave-dialog-title-end-padding,2rem)]',
    );
    unmount();
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Report</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('heading', { name: 'Report' })).toHaveClass(
      'pe-[var(--wave-dialog-title-end-padding,2rem)]',
    );
  });

  it('sets --wave-dialog-title-end-padding from the area’s measured width, merged with the consumer’s style', () => {
    resizeObserver = installResizeObserverMock();
    render(<Open contentProps={{ titleAction: expandAction, style: { minHeight: '10rem' } }} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit report' });
    const area = titleActions();
    mockRect(area, { width: 64 });
    resizeObserver.trigger(area);
    expect(dialog.style.getPropertyValue('--wave-dialog-title-end-padding')).toBe('72px');
    expect(dialog.style.minHeight).toBe('10rem');
    mockRect(area, { width: 100 });
    resizeObserver.trigger(area);
    expect(dialog.style.getPropertyValue('--wave-dialog-title-end-padding')).toBe('108px');
  });

  it('sets the padding to 0px while the area is empty (closeButton={null}, no actions)', () => {
    resizeObserver = installResizeObserverMock();
    render(<Open contentProps={{ closeButton: null }} />);
    const area = titleActions();
    expect(area.childElementCount).toBe(1); // only the empty outlet
    resizeObserver.trigger(area);
    expect(
      screen.getByRole('dialog').style.getPropertyValue('--wave-dialog-title-end-padding'),
    ).toBe('0px');
  });

  it('leaves the variable unset without ResizeObserver (the 2rem fallback applies)', () => {
    expect(typeof ResizeObserver).toBe('undefined');
    render(<Open contentProps={{ titleAction: expandAction }} />);
    expect(
      screen.getByRole('dialog').style.getPropertyValue('--wave-dialog-title-end-padding'),
    ).toBe('');
  });

  it('has no accessibility violations with title actions', async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content titleAction={expandAction}>
          <Dialog.Title
            action={
              <button type="button" aria-label="More">
                …
              </button>
            }
          >
            Report
          </Dialog.Title>
          <p>Body</p>
        </Dialog.Content>
      </Dialog>,
    );
    await expectNoA11yViolations(document.body);
  });
});

describe('Dialog slot types (P6-06)', () => {
  it('types modalType, size, closeButton, titleAction, action and backdrop', () => {
    expectTypeOf<'non-modal'>().toExtend<NonNullable<DialogProps['modalType']>>();
    expectTypeOf<DialogSize>().toEqualTypeOf<SurfaceSize>();
    expectTypeOf<DialogContentProps['size']>().toEqualTypeOf<DialogSize | undefined>();
    expectTypeOf<DialogContentProps['closeButton']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<DialogContentProps['titleAction']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<DialogTitleProps['action']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf({ appearance: 'transparent', className: 'x' } as const).toExtend<
      NonNullable<DialogContentProps['backdrop']>
    >();
    // @ts-expect-error not a dialog size
    const huge: DialogContentProps['size'] = 'huge';
    expect(huge).toBe('huge');
    // @ts-expect-error not a modal type
    const none: DialogProps['modalType'] = 'none';
    expect(none).toBe('none');
    // @ts-expect-error not a backdrop appearance
    const blurred: DialogContentProps['backdrop'] = { appearance: 'blurred' };
    expect(blurred).toEqual({ appearance: 'blurred' });
  });
});
