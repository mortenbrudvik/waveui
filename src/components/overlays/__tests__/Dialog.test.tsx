import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  type DialogCloseProps,
  type DialogContentProps,
  type DialogFooterProps,
  type DialogTitleProps,
  type DialogTriggerProps,
} from '../Dialog';
import { Drawer } from '../Drawer';
import { useDismiss } from '../../../hooks/useDismiss';
import { Portal } from '../../portal/Portal';
import { getTopmostLayer } from '../../../lib/layers';
import {
  createOverlayTestWrapper,
  expectNoA11yViolations,
  renderWithProviders,
  testCompoundExposure,
  testComposedHandler,
  testDisplayName,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

afterEach(() => {
  cleanup();
  // Nothing leaks from an open dialog: no layer, no inert page, no scroll lock.
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

/** The backdrop: the element around the dialog surface (outside the surface itself). */
function backdrop() {
  const surface = screen.getByRole('dialog');
  const parent = surface.parentElement;
  if (!parent) throw new Error('the dialog surface has no parent');
  return parent;
}

function Basic({
  dialogProps,
  contentProps,
  children = <p>Body</p>,
}: {
  dialogProps?: Partial<React.ComponentProps<typeof Dialog>>;
  contentProps?: Partial<DialogContentProps>;
  children?: React.ReactNode;
}) {
  return (
    <Dialog {...dialogProps}>
      <Dialog.Trigger>
        <button type="button">Open</button>
      </Dialog.Trigger>
      <Dialog.Content title="Test Dialog" {...contentProps}>
        {children}
      </Dialog.Content>
    </Dialog>
  );
}

/** A raw F4 child layer (stand-in for a Dropdown/Popover opened inside the dialog, §5.9). */
function ChildLayer({ label = 'Child option' }: { label?: string }) {
  const [open, setOpen] = React.useState(true);
  const ref = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({ open, onDismiss: () => setOpen(false), refs: [ref] });
  if (!open) return null;
  return (
    <Portal layerId={layerId}>
      <div ref={ref} data-testid="child-layer">
        <button type="button">{label}</button>
      </div>
    </Portal>
  );
}

/** A raw F4 popover-like layer anchored at a button inside the dialog. */
function PopoverStandIn() {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({
    open,
    onDismiss: () => setOpen(false),
    refs: [surfaceRef, anchorRef],
    anchorRef,
  });
  return (
    <>
      <button type="button" ref={anchorRef} onClick={() => setOpen(true)}>
        Anchor
      </button>
      {open && (
        <Portal layerId={layerId}>
          <div ref={surfaceRef}>
            <a href="#one">Link one</a>
            <a href="#two">Link two</a>
          </div>
        </Portal>
      )}
    </>
  );
}

describe('Dialog', () => {
  testDisplayName(Dialog, 'Dialog');

  testCompoundExposure(Dialog, ['Trigger', 'Content', 'Footer', 'Title', 'Close']);

  it('exports every sub-component under its flat name (C-COMPOUND)', () => {
    expect(DialogTrigger).toBe(Dialog.Trigger);
    expect(DialogContent).toBe(Dialog.Content);
    expect(DialogFooter).toBe(Dialog.Footer);
    expect(DialogTitle).toBe(Dialog.Title);
    expect(DialogClose).toBe(Dialog.Close);
  });

  it('declares ref in every props interface (C-REF)', () => {
    expectTypeOf<DialogContentProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<DialogFooterProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<DialogTitleProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLHeadingElement> | undefined
    >();
    expectTypeOf<DialogTriggerProps['ref']>().toEqualTypeOf<React.Ref<HTMLElement> | undefined>();
    expectTypeOf<DialogCloseProps['ref']>().toEqualTypeOf<React.Ref<HTMLElement> | undefined>();
  });

  describe('Dialog.Content system props', () => {
    testSystemProps(Dialog.Content, {
      expectedTag: 'div',
      displayName: 'DialogContent',
      wrapper: createOverlayTestWrapper(Dialog, { defaultOpen: true }),
      defaultProps: { title: 'Edit profile', children: <p>Body</p> },
      conflictingClass: { className: 'max-w-[800px]', overrides: 'max-w-[600px]' },
      a11yVariants: [
        {
          name: 'named by aria-label, no title',
          props: { title: undefined, 'aria-label': 'Edit' },
        },
        { name: 'small', props: { size: 'small' } },
      ],
    });
  });

  // button-provider#1 (C-BUTTON-TYPE): the portaled close button never submits a form.
  testNoImplicitSubmit(Dialog, {
    defaultProps: {
      open: true,
      children: <Dialog.Content title="Edit">Body</Dialog.Content>,
    },
  });

  describe('basic behaviour', () => {
    it('renders the trigger and no dialog by default', () => {
      render(<Basic />);
      expect(button('Open')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens when the trigger is clicked', async () => {
      const user = userEvent.setup();
      render(<Basic />);
      await user.click(button('Open'));
      expect(screen.getByRole('dialog', { name: 'Test Dialog' })).toBeInTheDocument();
      expect(screen.getByText('Body')).toBeInTheDocument();
    });

    it('renders only the trigger on the server, also when open by default', () => {
      const html = renderToString(<Basic dialogProps={{ defaultOpen: true }} />);
      expect(html).toContain('Open');
      expect(html).not.toContain('role="dialog"');
    });

    it('renders with defaultOpen', () => {
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      expect(screen.getByRole('dialog', { name: 'Test Dialog' })).toBeInTheDocument();
    });

    it('is controlled via the open prop', () => {
      const onOpenChange = vi.fn();
      const { rerender } = render(<Basic dialogProps={{ open: false, onOpenChange }} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      rerender(<Basic dialogProps={{ open: true, onOpenChange }} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on a backdrop click', async () => {
      const user = userEvent.setup();
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      await user.click(backdrop());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes when the Close button is clicked', async () => {
      const user = userEvent.setup();
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      await user.click(button('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('names the dialog with its title through aria-labelledby', () => {
      render(<Basic dialogProps={{ defaultOpen: true }} contentProps={{ title: 'My Title' }} />);
      const dialog = screen.getByRole('dialog', { name: 'My Title' });
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(titleId).toBeTruthy();
      expect(document.getElementById(titleId ?? '')).toHaveTextContent('My Title');
    });

    it('isolates the page with inert instead of aria-modal while open (§5.8)', async () => {
      const user = userEvent.setup();
      const { container } = render(<Basic />);
      await user.click(button('Open'));
      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-modal');
      expect(container).toHaveAttribute('inert');
      expect(dialog.closest('[inert]')).toBeNull();
      await user.keyboard('{Escape}');
      expect(container).not.toHaveAttribute('inert');
    });

    it('portals the dialog into a themed portal wrapper outside the render container', () => {
      const { container } = render(<Basic dialogProps={{ defaultOpen: true }} />);
      const dialog = screen.getByRole('dialog');
      expect(container.contains(dialog)).toBe(false);
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
    });

    it('renders Dialog.Footer inside the content', () => {
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          Body
          <Dialog.Footer data-testid="footer">
            <button type="button">OK</button>
          </Dialog.Footer>
        </Basic>,
      );
      expect(screen.getByRole('dialog')).toContainElement(screen.getByTestId('footer'));
      expect(screen.getByTestId('footer')).toContainElement(button('OK'));
    });

    it('calls onOpenChange when opened and closed', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Basic dialogProps={{ onOpenChange }} />);
      await user.click(button('Open'));
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      expect(onOpenChange).toHaveBeenCalledTimes(2);
    });

    it('renders the shared decorative dismiss icon in the Close button (input-datetime#22)', () => {
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      const icon = button('Close').querySelector('svg');
      expect(icon).toHaveAttribute('data-wave-icon', 'dismiss');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('names the Close button with closeLabel (overlays-modal-code-2)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Basic
          dialogProps={{ defaultOpen: true, onOpenChange }}
          contentProps={{ title: 'Slett fil?', closeLabel: 'Lukk' }}
        />,
      );
      const dialog = screen.getByRole('dialog', { name: 'Slett fil?' });
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(dialog).not.toHaveAttribute('closeLabel');
      expect(dialog).not.toHaveAttribute('closelabel');
      await user.click(button('Lukk'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('theme and tokens', () => {
    it('inherits the provider theme through the portal (button-provider#2)', () => {
      renderWithProviders(<Basic dialogProps={{ defaultOpen: true }} />, { theme: 'dark' });
      expect(screen.getByRole('dialog').closest('.wave-dark')).not.toBeNull();
    });

    it('uses token backdrop, surface, radius and shadow classes (button-provider#3, repo-level#7)', () => {
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('bg-background', 'text-foreground', 'rounded-lg', 'shadow-64');
      expect(dialog).not.toHaveClass('rounded-xl');
      expect(backdrop()).toHaveClass('bg-backdrop');
      expect(dialog.className).not.toMatch(/#|rgba|black|white/);
      expect(backdrop().className).not.toMatch(/#|rgba|black|white/);
    });

    it('draws its edge with the border token, visible in high contrast and forced colors (overlays-modal-code-1)', () => {
      // The page, the backdrop and the surface are all black in high contrast and the shadow is
      // black too (forced colors drop it): only a border marks the surface, as on the other overlays.
      renderWithProviders(<Basic dialogProps={{ defaultOpen: true }} />, {
        theme: 'high-contrast',
      });
      const dialog = screen.getByRole('dialog');
      expect(dialog.closest('.wave-high-contrast')).not.toBeNull();
      expect(dialog).toHaveClass('border', 'border-border');
    });
  });

  describe('responsive sizing (overlays#7)', () => {
    it('is full width up to 600px, bounded by the viewport height, with a scrolling body', () => {
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('w-full', 'max-w-[600px]', 'max-h-[calc(100dvh-2rem)]');
      expect(dialog).not.toHaveClass('w-[600px]');
      expect(backdrop()).toHaveClass('p-4');
      expect(screen.getByText('Body').parentElement).toHaveClass('overflow-y-auto');
    });

    it('caps the small size at 400px', () => {
      render(<Basic dialogProps={{ defaultOpen: true }} contentProps={{ size: 'small' }} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('w-full', 'max-w-[400px]');
      expect(dialog).not.toHaveClass('w-[400px]');
    });
  });

  describe('accessible name (overlays#8)', () => {
    it('accepts a ReactNode title', () => {
      render(
        <Basic
          dialogProps={{ defaultOpen: true }}
          contentProps={{
            title: (
              <>
                Rich <em>title</em>
              </>
            ),
          }}
        />,
      );
      expect(screen.getByRole('dialog', { name: 'Rich title' })).toBeInTheDocument();
    });

    it.each([
      ['an empty array', []],
      ['true', true],
      ['an array of empty values', [null, false, '']],
    ] as const)(
      'renders no heading for a title that renders nothing (%s) and keeps the other name',
      (_, title) => {
        render(
          <Dialog defaultOpen>
            <Dialog.Content title={title} aria-label="Quick settings">
              Body
            </Dialog.Content>
          </Dialog>,
        );
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Quick settings' })).not.toHaveAttribute(
          'aria-labelledby',
        );
      },
    );

    it('names the dialog with Dialog.Title', () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Delete file</Dialog.Title>
            <p>This cannot be undone.</p>
          </Dialog.Content>
        </Dialog>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Delete file' });
      expect(screen.getByRole('heading', { name: 'Delete file' }).id).toBe(
        dialog.getAttribute('aria-labelledby'),
      );
    });

    it('keeps Dialog.Title clear of the Close button, and the consumer’s padding wins', () => {
      const { rerender } = render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>A long title that fills the first line</Dialog.Title>
          </Dialog.Content>
        </Dialog>,
      );
      // Same end padding as the `title` prop heading: the Close button sits at end-4 top-4.
      expect(screen.getByRole('heading')).toHaveClass('pe-8');
      rerender(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title className="pe-12">A long title that fills the first line</Dialog.Title>
          </Dialog.Content>
        </Dialog>,
      );
      expect(screen.getByRole('heading')).toHaveClass('pe-12');
      expect(screen.getByRole('heading')).not.toHaveClass('pe-8');
    });

    it('warns in development when the dialog has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Dialog defaultOpen>
          <Dialog.Content>Unnamed</Dialog.Content>
        </Dialog>,
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[WaveUI] Dialog.Content has no accessible name'),
      );
      warn.mockRestore();
    });

    it.each([
      ['title', { title: 'Named' }],
      ['aria-label', { 'aria-label': 'Named' }],
      ['aria-labelledby', { 'aria-labelledby': 'external-title' }],
    ] as const)('does not warn when named by %s', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <h2 id="external-title">External</h2>
          <Dialog defaultOpen>
            <Dialog.Content {...props}>Body</Dialog.Content>
          </Dialog>
        </>,
      );
      expect(screen.getByRole('dialog')).toHaveAccessibleName();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('names the dialog with Dialog.Title under StrictMode (ref callbacks run twice)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <React.StrictMode>
          <Dialog defaultOpen>
            <Dialog.Content>
              <Dialog.Title>Strict title</Dialog.Title>
            </Dialog.Content>
          </Dialog>
        </React.StrictMode>,
      );
      expect(screen.getByRole('dialog', { name: 'Strict title' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    describe('titles that change while open (overlays-modal-tests-3)', () => {
      /** The surface is named by an element in the document with that name. */
      function expectNamedBy(name: string) {
        const dialog = screen.getByRole('dialog', { name });
        const labelledBy = dialog.getAttribute('aria-labelledby') ?? '';
        expect(document.getElementById(labelledBy)).toHaveTextContent(name);
      }

      it('follows a Dialog.Title that replaces another', () => {
        function Steps({ step }: { step: 'loading' | 'edit' }) {
          return (
            <Dialog defaultOpen>
              <Dialog.Content>
                {step === 'loading' ? (
                  <Dialog.Title key="loading">Loading</Dialog.Title>
                ) : (
                  <Dialog.Title key="edit">Edit user</Dialog.Title>
                )}
              </Dialog.Content>
            </Dialog>
          );
        }
        const { rerender } = render(<Steps step="loading" />);
        expectNamedBy('Loading');
        rerender(<Steps step="edit" />);
        expectNamedBy('Edit user');
        rerender(<Steps step="loading" />);
        expectNamedBy('Loading');
      });

      it('falls back to the remaining title when the first of two is removed', () => {
        function Titles({ showFirst }: { showFirst: boolean }) {
          return (
            <Dialog defaultOpen>
              <Dialog.Content>
                {showFirst && <Dialog.Title>Loading</Dialog.Title>}
                <Dialog.Title>Edit user</Dialog.Title>
              </Dialog.Content>
            </Dialog>
          );
        }
        const { rerender } = render(<Titles showFirst />);
        expectNamedBy('Loading');
        rerender(<Titles showFirst={false} />);
        expectNamedBy('Edit user');
      });

      it('follows a Dialog.Title whose id changes', () => {
        function Titled({ id }: { id: string }) {
          return (
            <Dialog defaultOpen>
              <Dialog.Content>
                <Dialog.Title id={id}>Edit user</Dialog.Title>
              </Dialog.Content>
            </Dialog>
          );
        }
        const { rerender } = render(<Titled id="first-title" />);
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'first-title');
        rerender(<Titled id="second-title" />);
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'second-title');
        expectNamedBy('Edit user');
      });
    });

    it('does not warn when named by Dialog.Title', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Named</Dialog.Title>
          </Dialog.Content>
        </Dialog>,
      );
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('Dialog.Trigger (overlays#5, layout#10)', () => {
    it('puts the trigger state on the child button, without a wrapper span', async () => {
      const user = userEvent.setup();
      const { container } = render(<Basic />);
      const trigger = button('Open');
      expect(container.querySelector('span')).toBeNull();
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', screen.getByRole('dialog').id);
    });

    it('keeps the child’s own aria-describedby and merges the Trigger’s props onto it', () => {
      const onClick = vi.fn();
      render(
        <Dialog>
          <Dialog.Trigger aria-describedby="hint" className="extra" onClick={onClick}>
            <button type="button" className="own">
              Open
            </button>
          </Dialog.Trigger>
          <span id="hint">Opens the settings</span>
          <Dialog.Content title="Settings">Body</Dialog.Content>
        </Dialog>,
      );
      const trigger = button('Open');
      expect(trigger).toHaveAccessibleDescription('Opens the settings');
      expect(trigger).toHaveClass('own', 'extra');
      fireEvent.click(trigger);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('accepts a render-prop child', async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <Dialog.Trigger>
            {(props) => (
              <button type="button" {...props}>
                Open
              </button>
            )}
          </Dialog.Trigger>
          <Dialog.Content title="Render prop">Body</Dialog.Content>
        </Dialog>,
      );
      expect(button('Open')).toHaveAttribute('aria-haspopup', 'dialog');
      await user.click(button('Open'));
      expect(screen.getByRole('dialog', { name: 'Render prop' })).toBeInTheDocument();
    });

    it('renders the 0.4 wrapper span with asChild={false}; the button inside carries the state ARIA', async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <Dialog.Trigger asChild={false}>
            <button type="button">Open</button>
          </Dialog.Trigger>
          <Dialog.Content title="Wrapped">Body</Dialog.Content>
        </Dialog>,
      );
      const trigger = button('Open');
      const wrapper = trigger.parentElement;
      const stateAria = ['aria-haspopup', 'aria-expanded', 'aria-controls'];
      expect(wrapper?.tagName).toBe('SPAN');
      for (const attr of stateAria) expect(wrapper).not.toHaveAttribute(attr);
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      await expectNoA11yViolations();

      await user.click(trigger);
      const dialog = screen.getByRole('dialog', { name: 'Wrapped' });
      for (const attr of stateAria) expect(wrapper).not.toHaveAttribute(attr);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', dialog.id);
      await expectNoA11yViolations();

      await user.keyboard('{Escape}');
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('still opens from a custom child that does not forward its ref (wrapper fallback + warning)', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function Fancy() {
        return <button type="button">Fancy</button>;
      }
      render(
        <Dialog>
          <Dialog.Trigger>
            <Fancy />
          </Dialog.Trigger>
          <Dialog.Content title="Fallback">Body</Dialog.Content>
        </Dialog>,
      );
      await user.click(button('Fancy'));
      expect(screen.getByRole('dialog', { name: 'Fallback' })).toBeInTheDocument();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Dialog.Trigger'));
      warn.mockRestore();
    });

    it('opens from a plain click without focusing the trigger, and restores focus to it (Safari, overlays#9)', async () => {
      const user = userEvent.setup();
      render(<Basic />);
      fireEvent.click(button('Open'));
      expect(document.activeElement).not.toBe(button('Open'));
      await user.keyboard('{Escape}');
      expect(button('Open')).toHaveFocus();
    });

    function TriggerHarness({ onClick }: { onClick?: React.MouseEventHandler<HTMLButtonElement> }) {
      return (
        <Dialog>
          <Dialog.Trigger>
            <button type="button" onClick={onClick}>
              Open
            </button>
          </Dialog.Trigger>
          <Dialog.Content title="Composed">Body</Dialog.Content>
        </Dialog>
      );
    }
    TriggerHarness.displayName = 'TriggerHarness';

    testComposedHandler(TriggerHarness, {
      handler: 'onClick',
      act: async ({ user }) => {
        await user.click(screen.getByRole('button', { name: 'Open' }));
      },
      assertInternal: () => {
        expect(screen.getByRole('dialog', { name: 'Composed' })).toBeInTheDocument();
      },
      assertInternalSuppressed: () => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
    });

    it.each([
      ['', React.Fragment],
      [' under StrictMode (ref callbacks run twice)', React.StrictMode],
    ])('follows a Dialog.Content id that changes while open in aria-controls%s', (_, Wrapper) => {
      function Ids({ id }: { id: string }) {
        return (
          <Wrapper>
            <Dialog defaultOpen>
              <Dialog.Trigger>
                <button type="button">Open</button>
              </Dialog.Trigger>
              <Dialog.Content title="Ids" id={id}>
                Body
              </Dialog.Content>
            </Dialog>
          </Wrapper>
        );
      }
      const { rerender } = render(<Ids id="first-id" />);
      // The page behind the open dialog is inert, so the trigger is queried with hidden: true.
      const trigger = screen.getByRole('button', { name: 'Open', hidden: true });
      expect(trigger).toHaveAttribute('aria-controls', 'first-id');
      rerender(<Ids id="second-id" />);
      expect(screen.getByRole('dialog')).toHaveAttribute('id', 'second-id');
      expect(trigger).toHaveAttribute('aria-controls', 'second-id');
    });

    it('a controlled-closed trigger asks to open without opening (overlays#32)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Basic dialogProps={{ open: false, onOpenChange }} />);
      await user.click(button('Open'));
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Dialog.Close (repo-level#30)', () => {
    it('closes the dialog from a footer button and keeps the button’s own onClick', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <p>Discard changes?</p>
          <Dialog.Footer>
            <Dialog.Close>
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            </Dialog.Close>
          </Dialog.Footer>
        </Basic>,
      );
      await user.click(button('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(button('Open')).toBeInTheDocument();
    });

    it('does not close when the child’s onClick prevents default', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <Dialog.Close>
            <button type="button" onClick={(event) => event.preventDefault()}>
              Stay
            </button>
          </Dialog.Close>
        </Basic>,
      );
      await user.click(button('Stay'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders a wrapper span with asChild={false}', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <Dialog.Close asChild={false}>
            <button type="button">Done</button>
          </Dialog.Close>
        </Basic>,
      );
      expect(button('Done').parentElement?.tagName).toBe('SPAN');
      await user.click(button('Done'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Dialog.Footer outside Dialog.Content (repo-level#16)', () => {
    it('warns in development', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Dialog>
          <Dialog.Content title="Guide example">Body</Dialog.Content>
          <Dialog.Footer>
            <button type="button">OK</button>
          </Dialog.Footer>
        </Dialog>,
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[WaveUI] Dialog.Footer must be rendered inside Dialog.Content'),
      );
      warn.mockRestore();
    });

    it('does not warn inside Dialog.Content', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <Dialog.Footer>
            <button type="button">OK</button>
          </Dialog.Footer>
        </Basic>,
      );
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('misplaced sub-components (overlays#34)', () => {
    it.each([
      [
        'Dialog.Trigger',
        'Dialog',
        <Dialog.Trigger key="t">
          <button type="button">Open</button>
        </Dialog.Trigger>,
      ],
      [
        'Dialog.Content',
        'Dialog',
        <Dialog.Content key="c" title="Orphan">
          Body
        </Dialog.Content>,
      ],
      [
        'Dialog.Close',
        'Dialog',
        <Dialog.Close key="x">
          <button type="button">Close</button>
        </Dialog.Close>,
      ],
      [
        'Dialog.Title',
        'Dialog.Content',
        <Dialog defaultOpen key="title">
          <Dialog.Title>Orphan</Dialog.Title>
        </Dialog>,
      ],
    ])('%s outside %s throws in development', (name, parent, element) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(element)).toThrow(`[WaveUI] ${name} must be used within ${parent}`);
      error.mockRestore();
    });

    describe('in production (x-errors-components-4)', () => {
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('logs each misplaced part once, not on every render, and renders it inert', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        function Misplaced({ tick }: { tick: number }) {
          return (
            <>
              <Dialog.Trigger>
                <button type="button">Open {tick}</button>
              </Dialog.Trigger>
              <Dialog defaultOpen>
                <Dialog.Title>Orphan title</Dialog.Title>
              </Dialog>
            </>
          );
        }
        const { rerender } = render(<Misplaced tick={0} />);
        rerender(<Misplaced tick={1} />);
        rerender(<Misplaced tick={2} />);
        expect(error.mock.calls).toEqual([
          ['[WaveUI] Dialog.Trigger must be used within Dialog'],
          ['[WaveUI] Dialog.Title must be used within Dialog.Content'],
        ]);
        // Inert: the trigger renders but opens nothing.
        fireEvent.click(button('Open 2'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Orphan title' })).toBeInTheDocument();
        error.mockRestore();
      });
    });
  });

  describe('keyboard and focus (overlays#3, overlays#31)', () => {
    it('moves focus into the dialog when it opens', async () => {
      const user = userEvent.setup();
      render(<Basic />);
      await user.click(button('Open'));
      expect(button('Close')).toHaveFocus();
    });

    it('wraps Tab past a disabled last button and Shift+Tab back', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <input aria-label="Name" />
          <button type="button" disabled>
            Disabled
          </button>
        </Basic>,
      );
      const name = screen.getByRole('textbox', { name: 'Name' });
      act(() => name.focus());
      await user.tab();
      expect(button('Close')).toHaveFocus();
      await user.tab({ shift: true });
      expect(name).toHaveFocus();
    });

    it('wraps Tab past a tabindex=-1 last button', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <input aria-label="Name" />
          <button type="button" tabIndex={-1}>
            Skipped
          </button>
        </Basic>,
      );
      act(() => screen.getByRole('textbox', { name: 'Name' }).focus());
      await user.tab();
      expect(button('Close')).toHaveFocus();
    });

    it('Shift+Tab from the dialog container moves to its last tabbable element', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <input aria-label="Name" />
        </Basic>,
      );
      act(() => screen.getByRole('dialog').focus());
      await user.tab({ shift: true });
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });

    it('tabs through a popover layer anchored inside the dialog, then continues after its anchor', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <PopoverStandIn />
          <button type="button">After anchor</button>
        </Basic>,
      );
      await user.click(button('Anchor'));
      const linkOne = screen.getByRole('link', { name: 'Link one' });
      act(() => linkOne.focus());
      await user.tab();
      expect(screen.getByRole('link', { name: 'Link two' })).toHaveFocus();
      await user.tab();
      expect(button('After anchor')).toHaveFocus();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it.each(['Escape', 'Close', 'backdrop'] as const)(
      'returns focus to the trigger after closing with %s',
      async (path) => {
        const user = userEvent.setup();
        render(<Basic />);
        await user.click(button('Open'));
        if (path === 'Escape') await user.keyboard('{Escape}');
        if (path === 'Close') await user.click(button('Close'));
        if (path === 'backdrop') await user.click(backdrop());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('Open')).toHaveFocus();
      },
    );
  });

  describe('focus restore (overlays#9, overlays#10)', () => {
    it('restores focus to the opener when an open dialog is unmounted', async () => {
      const user = userEvent.setup();
      function Conditional() {
        const [show, setShow] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setShow(true)}>
              Show
            </button>
            {show && (
              <Dialog open onOpenChange={() => {}}>
                <Dialog.Content title="Conditional">
                  <button type="button" onClick={() => setShow(false)}>
                    Remove
                  </button>
                </Dialog.Content>
              </Dialog>
            )}
          </>
        );
      }
      render(<Conditional />);
      await user.click(button('Show'));
      await user.click(button('Remove'));
      await flushMicrotasks();
      expect(button('Show')).toHaveFocus();
    });

    it('restores focus to the real opener of a controlled dialog whose content auto-focuses', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open form
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
              <Dialog.Content title="Form">
                <input aria-label="Name" autoFocus />
              </Dialog.Content>
            </Dialog>
          </>
        );
      }
      render(<Controlled />);
      await user.click(button('Open form'));
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(button('Open form')).toHaveFocus();
    });

    it('keeps focus inside when opened under StrictMode', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <Basic />
        </React.StrictMode>,
      );
      await user.click(button('Open'));
      await flushMicrotasks();
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    });

    it('focuses finalFocusRef instead of the trigger that opened the dialog (overlays-modal-tests-1)', async () => {
      const user = userEvent.setup();
      function WithFinalFocus() {
        const ref = React.useRef<HTMLButtonElement>(null);
        return (
          <>
            <button type="button" ref={ref}>
              Elsewhere
            </button>
            <Basic dialogProps={{ finalFocusRef: ref }} />
          </>
        );
      }
      render(<WithFinalFocus />);
      await user.click(button('Open'));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // The trigger is still there and could take focus: only finalFocusRef sends it elsewhere.
      expect(button('Elsewhere')).toHaveFocus();
    });

    it('focuses finalFocusRef, not the neighbour of the removed opener', async () => {
      const user = userEvent.setup();
      function RemovableOpener() {
        const [open, setOpen] = React.useState(false);
        const [showOpener, setShowOpener] = React.useState(true);
        const summaryRef = React.useRef<HTMLButtonElement>(null);
        return (
          <>
            <button type="button" ref={summaryRef}>
              Summary
            </button>
            {showOpener && (
              <button type="button" onClick={() => setOpen(true)}>
                Delete row
              </button>
            )}
            <button type="button">Next row</button>
            <Dialog open={open} onOpenChange={setOpen} finalFocusRef={summaryRef}>
              <Dialog.Content title="Confirm delete">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpener(false);
                    setOpen(false);
                  }}
                >
                  Confirm
                </button>
              </Dialog.Content>
            </Dialog>
          </>
        );
      }
      render(<RemovableOpener />);
      await user.click(button('Delete row'));
      await user.click(button('Confirm'));
      expect(screen.queryByRole('button', { name: 'Delete row' })).not.toBeInTheDocument();
      // Without finalFocusRef, the fallback would pick 'Next row' (the element after the opener).
      expect(button('Summary')).toHaveFocus();
    });

    it('returns focus to the button inside an asChild={false} wrapper span', async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <Dialog.Trigger asChild={false}>
            <button type="button">Open</button>
          </Dialog.Trigger>
          <Dialog.Content title="Wrapped">Body</Dialog.Content>
        </Dialog>,
      );
      await user.tab();
      expect(button('Open')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog', { name: 'Wrapped' })).toContainElement(
        document.activeElement as HTMLElement,
      );
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(button('Open')).toHaveFocus();
    });

    it('returns focus to the button of a custom child that does not forward its ref', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function Fancy() {
        return <button type="button">Fancy</button>;
      }
      render(
        <Dialog>
          <Dialog.Trigger>
            <Fancy />
          </Dialog.Trigger>
          <Dialog.Content title="Fallback">Body</Dialog.Content>
        </Dialog>,
      );
      await user.click(button('Fancy'));
      expect(screen.getByRole('dialog', { name: 'Fallback' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(button('Fancy')).toHaveFocus();
      warn.mockRestore();
    });

    it('returns focus into a wrapper span also when the click did not focus the button (Safari)', async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <Dialog.Trigger asChild={false}>
            <button type="button">Open</button>
          </Dialog.Trigger>
          <Dialog.Content title="Wrapped">Body</Dialog.Content>
        </Dialog>,
      );
      fireEvent.click(button('Open'));
      expect(screen.getByRole('dialog', { name: 'Wrapped' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(button('Open')).toHaveFocus();
    });

    it('returns focus to a trigger that was disabled when it mounted (Safari)', async () => {
      const user = userEvent.setup();
      function LateEnabled({ disabled }: { disabled: boolean }) {
        return (
          <Dialog>
            <Dialog.Trigger>
              <button type="button" disabled={disabled}>
                Open
              </button>
            </Dialog.Trigger>
            <Dialog.Content title="Late">Body</Dialog.Content>
          </Dialog>
        );
      }
      const { rerender } = render(<LateEnabled disabled />);
      rerender(<LateEnabled disabled={false} />);
      fireEvent.click(button('Open'));
      expect(document.activeElement).not.toBe(button('Open'));
      await user.keyboard('{Escape}');
      expect(button('Open')).toHaveFocus();
    });

    describe('several triggers', () => {
      function TwoTriggers({ open, showSecond = true }: { open?: boolean; showSecond?: boolean }) {
        return (
          <Dialog open={open} onOpenChange={open === undefined ? undefined : () => {}}>
            <Dialog.Trigger>
              <button type="button">First</button>
            </Dialog.Trigger>
            {showSecond && (
              <Dialog.Trigger>
                <button type="button">Second</button>
              </Dialog.Trigger>
            )}
            <Dialog.Content title="Two triggers">Body</Dialog.Content>
          </Dialog>
        );
      }

      it('returns focus to the trigger that opened the dialog, not the last one mounted', async () => {
        const user = userEvent.setup();
        render(<TwoTriggers />);
        await user.click(button('First'));
        expect(screen.getByRole('dialog', { name: 'Two triggers' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('First')).toHaveFocus();

        await user.click(button('Second'));
        await user.keyboard('{Escape}');
        expect(button('Second')).toHaveFocus();
      });

      it('returns focus to the clicked trigger when the click did not focus it (Safari)', async () => {
        const user = userEvent.setup();
        render(<TwoTriggers />);
        fireEvent.click(button('First'));
        expect(screen.getByRole('dialog', { name: 'Two triggers' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(button('First')).toHaveFocus();
      });

      it('keeps the remaining trigger as the restore target when another trigger unmounts', () => {
        const { rerender } = render(<TwoTriggers open={false} />);
        rerender(<TwoTriggers open={false} showSecond={false} />);
        // Opened by the parent, not by a trigger click, while nothing has focus.
        expect(document.activeElement).toBe(document.body);
        rerender(<TwoTriggers open showSecond={false} />);
        expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
        rerender(<TwoTriggers open={false} showSecond={false} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('First')).toHaveFocus();
      });

      it('returns focus to the remaining trigger clicked without focus after another unmounted (Safari)', async () => {
        const user = userEvent.setup();
        const { rerender } = render(<TwoTriggers />);
        rerender(<TwoTriggers showSecond={false} />);
        fireEvent.click(button('First'));
        expect(screen.getByRole('dialog', { name: 'Two triggers' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(button('First')).toHaveFocus();
      });

      /** Controlled, with two triggers and an outside button that opens it too. */
      function TriggersAndExternal({ acceptTriggers = true }: { acceptTriggers?: boolean }) {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              External
            </button>
            <Dialog
              open={open}
              onOpenChange={(next) => {
                if (acceptTriggers || !next) setOpen(next);
              }}
            >
              <Dialog.Trigger>
                <button type="button">First</button>
              </Dialog.Trigger>
              <Dialog.Trigger>
                <button type="button">Second</button>
              </Dialog.Trigger>
              <Dialog.Content title="Scoped">Body</Dialog.Content>
            </Dialog>
          </>
        );
      }

      it('forgets the trigger that opened the dialog once it closes: a later outside open returns to its opener', async () => {
        const user = userEvent.setup();
        render(<TriggersAndExternal />);
        await user.click(button('Second'));
        await user.keyboard('{Escape}');
        expect(button('Second')).toHaveFocus();

        await user.click(button('External'));
        expect(screen.getByRole('dialog', { name: 'Scoped' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('External')).toHaveFocus();
      });

      it('falls back to the first mounted trigger, not the previous session’s, after an outside open while nothing had focus', async () => {
        const user = userEvent.setup();
        render(<TriggersAndExternal />);
        await user.click(button('Second'));
        await user.keyboard('{Escape}');
        expect(button('Second')).toHaveFocus();

        act(() => button('Second').blur());
        expect(document.activeElement).toBe(document.body);
        fireEvent.click(button('External'));
        expect(screen.getByRole('dialog', { name: 'Scoped' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(button('First')).toHaveFocus();
      });

      it('ignores a trigger click the parent rejected when it later opens the dialog from outside', async () => {
        const user = userEvent.setup();
        render(<TriggersAndExternal acceptTriggers={false} />);
        await user.click(button('Second'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(button('External'));
        expect(screen.getByRole('dialog', { name: 'Scoped' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(button('External')).toHaveFocus();
      });

      it('forgets a trigger click the parent rejected also when nothing has focus (Safari, overlays-modal-tests-2)', async () => {
        const user = userEvent.setup();
        render(<TriggersAndExternal acceptTriggers={false} />);
        // Plain clicks: focus stays on <body>, so the restore cannot capture the opener.
        fireEvent.click(button('Second'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // A later click is a later task.
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

        expect(document.activeElement).toBe(document.body);
        fireEvent.click(button('External'));
        expect(screen.getByRole('dialog', { name: 'Scoped' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        // No trigger opened this session: the documented fallback is the first mounted trigger.
        expect(button('First')).toHaveFocus();
      });

      it('returns focus to a trigger clicked without focus whose click the parent accepted (Safari)', async () => {
        const user = userEvent.setup();
        render(<TriggersAndExternal />);
        fireEvent.click(button('Second'));
        expect(screen.getByRole('dialog', { name: 'Scoped' })).toBeInTheDocument();
        // The session keeps the activated trigger past the end of the opening task.
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        await user.keyboard('{Escape}');
        expect(button('Second')).toHaveFocus();
      });

      it.each([
        ['without the event', (onClick: (value?: unknown) => void) => onClick()],
        ['with a value that is not an event', (onClick: (value?: unknown) => void) => onClick('x')],
      ])(
        'returns focus to a render-prop trigger that calls onClick %s (also when the click did not focus it)',
        async (_, call) => {
          const user = userEvent.setup();
          render(
            <Dialog>
              <Dialog.Trigger>
                <button type="button">First</button>
              </Dialog.Trigger>
              <Dialog.Trigger>
                {({ onClick, ...props }) => (
                  <button
                    type="button"
                    {...props}
                    onClick={() => call(onClick as (value?: unknown) => void)}
                  >
                    Second
                  </button>
                )}
              </Dialog.Trigger>
              <Dialog.Content title="Render prop">Body</Dialog.Content>
            </Dialog>,
          );
          await user.click(button('Second'));
          expect(screen.getByRole('dialog', { name: 'Render prop' })).toBeInTheDocument();
          await user.keyboard('{Escape}');
          expect(button('Second')).toHaveFocus();

          act(() => button('Second').blur());
          fireEvent.click(button('Second'));
          expect(screen.getByRole('dialog', { name: 'Render prop' })).toBeInTheDocument();
          await user.keyboard('{Escape}');
          expect(button('Second')).toHaveFocus();
        },
      );
    });
  });

  describe('layers (overlays#1, overlays#2, overlays#41)', () => {
    it('Escape closes a child layer opened inside the dialog first, then the dialog', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <ChildLayer />
        </Basic>,
      );
      await user.click(button('Child option'));
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('child-layer')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not close after a drag from the content to the backdrop', () => {
      render(<Basic dialogProps={{ defaultOpen: true }} />);
      fireEvent.pointerDown(screen.getByText('Body'));
      fireEvent.click(backdrop());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not close on a click inside a nested portaled layer', async () => {
      const user = userEvent.setup();
      render(
        <Basic dialogProps={{ defaultOpen: true }}>
          <ChildLayer />
        </Basic>,
      );
      await user.click(button('Child option'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('child-layer')).toBeInTheDocument();
    });

    it('is a child layer of an enclosing layer: using it never closes the parent', async () => {
      const user = userEvent.setup();
      function ParentLayer({ children }: { children: React.ReactNode }) {
        const [open, setOpen] = React.useState(true);
        const ref = React.useRef<HTMLDivElement>(null);
        const { layerId } = useDismiss({ open, onDismiss: () => setOpen(false), refs: [ref] });
        if (!open) return null;
        return (
          <Portal layerId={layerId}>
            <div ref={ref} data-testid="parent-layer">
              {children}
            </div>
          </Portal>
        );
      }
      render(
        <ParentLayer>
          <Basic />
        </ParentLayer>,
      );
      await user.click(button('Open'));
      await user.click(screen.getByText('Body'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('parent-layer')).toBeInTheDocument();
      await user.click(button('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('parent-layer')).toBeInTheDocument();
    });

    it('keeps an allow-listed region (toasts) reachable, not inert and clickable (feedback-navigation#50)', async () => {
      const user = userEvent.setup();
      const onToast = vi.fn();
      function ToastRegion() {
        return createPortal(
          <div data-wave-focus-trap-allow="">
            <button type="button" onClick={onToast}>
              Dismiss toast
            </button>
          </div>,
          document.body,
        );
      }
      render(
        <>
          <ToastRegion />
          <Basic dialogProps={{ defaultOpen: true }}>
            <button type="button">Inside</button>
          </Basic>
        </>,
      );
      const toastButton = button('Dismiss toast');
      expect(toastButton.closest('[inert]')).toBeNull();
      act(() => button('Inside').focus());
      await user.tab();
      expect(toastButton).toHaveFocus();
      await user.click(toastButton);
      expect(onToast).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('controlled contract (overlays#32, table-core#3)', () => {
    it('asks to close on Escape, backdrop, Close and Dialog.Close while the parent keeps it open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content title="Controlled">
            <p>Body</p>
            <Dialog.Close>
              <button type="button">Cancel</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog>,
      );
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      await user.click(backdrop());
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      await user.click(button('Close'));
      expect(onOpenChange).toHaveBeenCalledTimes(3);
      await user.click(button('Cancel'));
      expect(onOpenChange.mock.calls).toEqual([[false], [false], [false], [false]]);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('calls onOpenChange exactly once per interaction under StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <Basic dialogProps={{ onOpenChange }} />
        </React.StrictMode>,
      );
      await user.click(button('Open'));
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe('scroll lock (overlays#11)', () => {
    it('locks page scrolling while open and restores it on close', async () => {
      const user = userEvent.setup();
      render(<Basic />);
      await user.click(button('Open'));
      expect(document.documentElement.style.overflow).toBe('hidden');
      await user.keyboard('{Escape}');
      expect(document.documentElement.style.overflow).toBe('');
    });

    it('keeps the page locked until the last of two stacked modals closes, in any order', () => {
      function Stack({ dialog, drawer }: { dialog: boolean; drawer: boolean }) {
        return (
          <>
            <Dialog open={dialog}>
              <Dialog.Content title="Dialog">Dialog body</Dialog.Content>
            </Dialog>
            <Drawer open={drawer} title="Drawer">
              Drawer body
            </Drawer>
          </>
        );
      }
      const { rerender, unmount } = render(<Stack dialog drawer={false} />);
      rerender(<Stack dialog drawer />);
      expect(document.documentElement.style.overflow).toBe('hidden');
      rerender(<Stack dialog={false} drawer />);
      expect(document.documentElement.style.overflow).toBe('hidden');
      rerender(<Stack dialog={false} drawer={false} />);
      expect(document.documentElement.style.overflow).toBe('');
      rerender(<Stack dialog drawer />);
      unmount();
      expect(document.documentElement.style.overflow).toBe('');
    });
  });

  describe('refs and listeners (overlays#35, table-core#23)', () => {
    it('attaches a stable ref to the surface once across re-renders', () => {
      const ref = vi.fn();
      function Parent({ tick }: { tick: number }) {
        return (
          <Dialog open onOpenChange={() => {}}>
            <Dialog.Content title={`Render ${tick}`} ref={ref}>
              Body
            </Dialog.Content>
          </Dialog>
        );
      }
      const { rerender } = render(<Parent tick={0} />);
      rerender(<Parent tick={1} />);
      rerender(<Parent tick={2} />);
      expect(ref).toHaveBeenCalledTimes(1);
      expect(ref).toHaveBeenCalledWith(screen.getByRole('dialog'));
    });

    it('does not re-register document listeners when the parent re-renders', () => {
      function Parent({ tick }: { tick: number }) {
        return (
          <Dialog open onOpenChange={() => {}}>
            <Dialog.Content title={`Render ${tick}`}>Body</Dialog.Content>
          </Dialog>
        );
      }
      const { rerender } = render(<Parent tick={0} />);
      const add = vi.spyOn(document, 'addEventListener');
      const remove = vi.spyOn(document, 'removeEventListener');
      rerender(<Parent tick={1} />);
      rerender(<Parent tick={2} />);
      expect(add).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      add.mockRestore();
      remove.mockRestore();
    });
  });

  describe('accessibility (table-core#20, overlays#31)', () => {
    it('has no violations when open with a title, trigger included', async () => {
      const user = userEvent.setup();
      render(
        <Basic>
          <p>Body</p>
          <Dialog.Footer>
            <Dialog.Close>
              <button type="button">Cancel</button>
            </Dialog.Close>
          </Dialog.Footer>
        </Basic>,
      );
      await user.click(button('Open'));
      await expectNoA11yViolations();
    });

    it('has no violations when open and named by aria-label', async () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content aria-label="Quick settings">Body</Dialog.Content>
        </Dialog>,
      );
      await expectNoA11yViolations();
    });
  });
});
