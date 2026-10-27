import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawerPanel, useDrawerOpen, type DrawerPanelProps } from '../Drawer.panel';
import {
  inertModalTrigger,
  useModalOpenState,
  useModalTrigger,
  useModalTriggerSession,
  type ModalOpenChangeDetails,
  type ModalRequestOpen,
} from '../Dialog.shared';
import { Popover } from '../Popover';
import { Toaster } from '../../feedback/Toaster';
import { cn } from '../../../lib/cn';
import { drawerClassNames, navDrawerClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';

/*
 * The drawer panel shell (P6-07 D108, contract §4.2): the panel element of an overlay (in a portal,
 * with its backdrop and the modal or non-modal machinery) or of an inline drawer (in place, with
 * the inline focus restore), on the presence core, rendering its children raw. Rendered here the
 * way NavDrawer renders it: the caller holds the open state (`useModalOpenState`, `useDrawerOpen`),
 * renders its own trigger, and calls `useModalTriggerSession` after the shell.
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  expect(document.documentElement.style.overflow).toBe('');
});

function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

const PANEL_ID = 'test-panel';
const panelElement = () => document.getElementById(PANEL_ID);
const wrapperOf = (element: Element | null) => element?.closest('[data-wave-portal]') ?? null;

/** The shell's props a test may set; the rest have the defaults of {@link Shell}. */
type ShellPanelProps = Partial<Omit<DrawerPanelProps, 'open' | 'requestOpen' | 'trigger'>>;

interface ShellProps extends ShellPanelProps {
  /** Controlled open state (else uncontrolled from `defaultOpen`). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details?: ModalOpenChangeDetails) => void;
  /** Replaces the root's request function (the shell then cannot change the open state). */
  requestOpenOverride?: ModalRequestOpen;
  /** `'trigger'`: a toggle button on the root's triggers; `'inert'`: `inertModalTrigger`, no button. */
  triggerKind?: 'trigger' | 'inert';
}

/**
 * A root around the shell, built as the contract asks: `useModalOpenState`, `useDrawerOpen`, a
 * trigger it renders itself before the shell, and `useModalTriggerSession` after the shell.
 */
function Shell({
  open: openProp,
  defaultOpen,
  onOpenChange,
  requestOpenOverride,
  triggerKind = 'trigger',
  type = 'overlay',
  children,
  ...panelProps
}: ShellProps) {
  const [openState, requestOpen] = useModalOpenState(openProp, defaultOpen, onOpenChange);
  const open = useDrawerOpen(type, openState);
  const modalTrigger = useModalTrigger();
  const trigger = triggerKind === 'inert' ? inertModalTrigger : modalTrigger;
  const attachTrigger = React.useCallback(
    (node: HTMLButtonElement | null) => trigger.attach(node),
    [trigger],
  );
  const panel = (
    <DrawerPanel
      componentName="Test"
      type={type}
      open={open}
      requestOpen={requestOpenOverride ?? requestOpen}
      position="end"
      size="small"
      separator={false}
      modalType="modal"
      unmountOnClose
      inlineAs="aside"
      trigger={trigger}
      rootClassName={drawerClassNames.root}
      backdropClassName={drawerClassNames.backdrop}
      id={PANEL_ID}
      aria-label="Test panel"
      {...panelProps}
    >
      {children ?? (
        <>
          <button type="button">First</button>
          <button type="button">Last</button>
        </>
      )}
    </DrawerPanel>
  );
  useModalTriggerSession(trigger, open);
  return (
    <>
      {triggerKind === 'trigger' && (
        <button
          type="button"
          ref={attachTrigger}
          aria-expanded={open}
          aria-controls={open ? PANEL_ID : undefined}
          onClick={(event) => {
            if (!open) trigger.activate(event.currentTarget);
            requestOpen(!open, { reason: 'trigger', event: event.nativeEvent });
          }}
        >
          Toggle
        </button>
      )}
      {panel}
    </>
  );
}

/** A page around the shell: a button before and after it. */
function Page(props: ShellProps) {
  return (
    <>
      <button type="button">Before</button>
      <Shell {...props} />
      <button type="button">After</button>
    </>
  );
}

describe('DrawerPanel (the drawer panel shell)', () => {
  it('has the frozen signature of the contract', () => {
    expectTypeOf(useDrawerOpen).toEqualTypeOf<
      (type: 'overlay' | 'inline', openState: boolean) => boolean
    >();
    expectTypeOf(DrawerPanel).parameters.toEqualTypeOf<[props: DrawerPanelProps]>();
    expectTypeOf(DrawerPanel).returns.toEqualTypeOf<React.ReactNode>();
    expectTypeOf<DrawerPanelProps['inlineAs']>().toEqualTypeOf<'aside' | 'div'>();
    expectTypeOf<DrawerPanelProps['ref']>().toEqualTypeOf<React.Ref<HTMLElement> | undefined>();
    expect(DrawerPanel.displayName).toBe('DrawerPanel');
  });

  describe('overlay (1)', () => {
    it('renders a portaled role="dialog" div with its id, tabIndex, data attributes and root class first', () => {
      const { container } = render(<Shell defaultOpen className="w-96" />);
      const panel = screen.getByRole('dialog', { name: 'Test panel' });
      expect(panel.localName).toBe('div');
      expect(container).not.toContainElement(panel);
      expect(wrapperOf(panel)).not.toBeNull();
      expect(panel).toHaveAttribute('id', PANEL_ID);
      expect(panel).toHaveAttribute('tabindex', '-1');
      expect(panel).toHaveAttribute('data-type', 'overlay');
      expect(panel).toHaveAttribute('data-position', 'end');
      expect(panel).toHaveAttribute('data-size', 'small');
      expect(panel).toHaveAttribute('data-modal-type', 'modal');
      expect(panel).toHaveAttribute('data-presence', 'entered');
      expect(panel).not.toHaveAttribute('data-separator');
      expect(panel.classList[0]).toBe(drawerClassNames.root);
      expect(panel).toHaveClass('fixed', 'flex', 'flex-col', 'shadow-64', 'end-0', 'border-s');
      // The consumer's className comes last and replaces the size's width.
      expect(panel).toHaveClass('w-96');
      expect(panel).not.toHaveClass('w-80');
    });

    it('renders the backdrop before the panel with backdropClassName first', () => {
      render(<Shell defaultOpen />);
      const panel = screen.getByRole('dialog', { name: 'Test panel' });
      const backdrop = panel.previousElementSibling as HTMLElement;
      expect(backdrop).not.toBeNull();
      expect(backdrop.classList[0]).toBe(drawerClassNames.backdrop);
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      expect(backdrop).toHaveAttribute('data-appearance', 'dimmed');
      expect(backdrop).toHaveAttribute('data-presence', 'entered');
      expect(wrapperOf(backdrop)).toBe(wrapperOf(panel));
    });

    it('renders its children raw: no header, Close button, title or padded body', () => {
      render(<Shell defaultOpen />);
      const panel = screen.getByRole('dialog', { name: 'Test panel' });
      expect(Array.from(panel.children).map((child) => child.textContent)).toEqual([
        'First',
        'Last',
      ]);
      expect(within(panel).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(within(panel).queryByRole('heading')).not.toBeInTheDocument();
      expect(panel.querySelector('.' + drawerClassNames.header)).toBeNull();
      expect(panel.querySelector('.' + drawerClassNames.body)).toBeNull();
      expect(panel).not.toHaveClass('p-4');
      // No aria-labelledby of its own: the caller names the panel.
      expect(panel).not.toHaveAttribute('aria-labelledby');
    });

    it('renders role="alertdialog" and data-modal-type="alert" for an alert', () => {
      render(<Shell defaultOpen modalType="alert" />);
      const panel = screen.getByRole('alertdialog', { name: 'Test panel' });
      expect(panel).toHaveAttribute('data-modal-type', 'alert');
      expect(panel).toHaveAttribute('tabindex', '-1');
    });

    it('lets a consumer role win: it goes before the rest', () => {
      render(<Shell defaultOpen role="region" />);
      expect(panelElement()).toHaveAttribute('role', 'region');
    });

    it('renders a non-modal overlay without a backdrop', () => {
      render(<Shell defaultOpen modalType="non-modal" />);
      const panel = screen.getByRole('dialog', { name: 'Test panel' });
      expect(panel).toHaveAttribute('data-modal-type', 'non-modal');
      expect(panel.previousElementSibling).toBeNull();
      expect(document.querySelector('.' + drawerClassNames.backdrop)).toBeNull();
    });

    it('renders no backdrop for backdrop={null}', () => {
      render(<Shell defaultOpen backdrop={null} />);
      expect(screen.getByRole('dialog', { name: 'Test panel' })).toBeInTheDocument();
      expect(document.querySelector('.' + drawerClassNames.backdrop)).toBeNull();
    });

    it('always renders data-size, the given size included, with the size class of the axis', () => {
      const { unmount } = render(<Shell defaultOpen size="medium" />);
      expect(panelElement()).toHaveAttribute('data-size', 'medium');
      expect(panelElement()).toHaveClass('w-148');
      unmount();
      render(<Shell defaultOpen size="large" position="bottom" />);
      expect(panelElement()).toHaveAttribute('data-size', 'large');
      expect(panelElement()).toHaveAttribute('data-position', 'bottom');
      expect(panelElement()).toHaveClass('h-235', 'bottom-0', 'inset-x-0', 'border-t');
    });

    it('renders nothing while closed, and nothing on the first render before hydration', () => {
      const { container } = render(<Shell />);
      expect(panelElement()).toBeNull();
      expect(document.querySelector('[data-wave-portal]')).toBeNull();
      expect(container.querySelectorAll('*')).toHaveLength(1);
    });

    it('merges the ref with its own and the presence ref', () => {
      const ref = React.createRef<HTMLElement>();
      render(<Shell defaultOpen ref={ref} />);
      expect(ref.current).toBe(panelElement());
    });
  });

  describe('inline (2)', () => {
    it('renders a div in place with inlineAs="div": no role, tabIndex or portal; data-separator', () => {
      const { container } = render(
        <Shell type="inline" inlineAs="div" defaultOpen separator position="start" />,
      );
      const panel = panelElement()!;
      expect(panel.localName).toBe('div');
      expect(container).toContainElement(panel);
      expect(document.querySelector('[data-wave-portal]')).toBeNull();
      expect(panel).not.toHaveAttribute('role');
      expect(panel).not.toHaveAttribute('tabindex');
      expect(panel).not.toHaveAttribute('aria-modal');
      expect(panel).not.toHaveAttribute('data-modal-type');
      expect(panel).toHaveAttribute('data-type', 'inline');
      expect(panel).toHaveAttribute('data-position', 'start');
      expect(panel).toHaveAttribute('data-size', 'small');
      expect(panel).toHaveAttribute('data-separator', '');
      expect(panel).toHaveAttribute('data-presence', 'entered');
      expect(panel.classList[0]).toBe(drawerClassNames.root);
      expect(panel).toHaveClass(
        'relative',
        'shrink-0',
        'border-transparent',
        'data-[separator]:border-border',
        'forced-colors:border-[CanvasText]',
        'border-e',
        'w-80',
      );
      expect(panel).not.toHaveClass('fixed', 'shadow-64');
      expect(document.querySelector('.' + drawerClassNames.backdrop)).toBeNull();
      // The trigger renders before the panel.
      expect(button('Toggle').compareDocumentPosition(panel)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(Array.from(panel.children).map((child) => child.textContent)).toEqual([
        'First',
        'Last',
      ]);
    });

    it('renders an <aside> with inlineAs="aside", without data-separator by default', () => {
      render(<Shell type="inline" defaultOpen />);
      const panel = screen.getByRole('complementary', { name: 'Test panel' });
      expect(panel).toBe(panelElement());
      expect(panel.localName).toBe('aside');
      expect(panel).not.toHaveAttribute('data-separator');
      expect(panel).toHaveClass('border-s');
    });

    it('ignores separator on an overlay', () => {
      render(<Shell defaultOpen separator />);
      expect(panelElement()).not.toHaveAttribute('data-separator');
    });
  });

  describe('the layer (3)', () => {
    it('registers a modal layer for modal and alert, and a dialog layer for non-modal', () => {
      const { unmount } = render(<Shell defaultOpen />);
      expect(getTopmostLayer()?.kind).toBe('modal');
      unmount();
      const alert = render(<Shell defaultOpen modalType="alert" />);
      expect(getTopmostLayer()?.kind).toBe('modal');
      alert.unmount();
      render(<Shell defaultOpen modalType="non-modal" />);
      expect(getTopmostLayer()?.kind).toBe('dialog');
    });

    it('registers no layer inline', () => {
      render(<Shell type="inline" defaultOpen />);
      expect(panelElement()).not.toBeNull();
      expect(getTopmostLayer()).toBeNull();
    });

    it.each([['modal'], ['non-modal']] as const)(
      'is the layer a Toaster beside it measures (%s)',
      (modalType) => {
        const stub = (element: HTMLElement | null) => {
          if (!element) return;
          element.getBoundingClientRect = () =>
            ({
              left: 704,
              right: 1024,
              top: 0,
              bottom: 768,
              width: 320,
              height: 768,
              x: 704,
              y: 0,
              toJSON: () => ({}),
            }) as DOMRect;
        };
        render(
          <Toaster>
            <Shell defaultOpen modalType={modalType} ref={stub} />
          </Toaster>,
        );
        const region = screen.getByRole('region', { name: 'Notifications' });
        expect(region.style.getPropertyValue('--wave-toaster-offset')).toBe('320px');
      },
    );
  });

  describe('dismissal (4)', () => {
    it('asks through requestOpen on Escape and on a backdrop press', async () => {
      const user = userEvent.setup();
      const requestOpen = vi.fn<ModalRequestOpen>();
      render(<Shell defaultOpen requestOpenOverride={requestOpen} />);
      expect(button('First')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(requestOpen).toHaveBeenCalledTimes(1);
      expect(requestOpen).toHaveBeenLastCalledWith(false, {
        reason: 'escape',
        event: expect.any(KeyboardEvent),
      });
      const backdrop = document.querySelector<HTMLElement>('.' + drawerClassNames.backdrop)!;
      await user.click(backdrop);
      expect(requestOpen).toHaveBeenCalledTimes(2);
      expect(requestOpen).toHaveBeenLastCalledWith(false, {
        reason: 'outside-press',
        event: expect.any(Event),
      });
      // The request function decides: the panel is still open.
      expect(screen.getByRole('dialog', { name: 'Test panel' })).toBeInTheDocument();
    });

    it('closes through the root’s state: Escape closes it and focus returns to the trigger', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page onOpenChange={onOpenChange} />);
      await user.click(button('Toggle'));
      expect(button('First')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(panelElement()).toBeNull();
      expect(onOpenChange.mock.calls).toEqual([
        [true, { reason: 'trigger', event: expect.any(MouseEvent) }],
        [false, { reason: 'escape', event: expect.any(KeyboardEvent) }],
      ]);
      expect(button('Toggle')).toHaveFocus();
    });

    it('asks nothing on a backdrop press of an alert; Escape still asks', async () => {
      const user = userEvent.setup();
      const requestOpen = vi.fn<ModalRequestOpen>();
      render(<Shell defaultOpen modalType="alert" requestOpenOverride={requestOpen} />);
      await user.click(document.querySelector<HTMLElement>('.' + drawerClassNames.backdrop)!);
      expect(requestOpen).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(requestOpen).toHaveBeenCalledTimes(1);
      expect(requestOpen).toHaveBeenLastCalledWith(false, {
        reason: 'escape',
        event: expect.any(KeyboardEvent),
      });
    });

    it('asks nothing inline: Escape in the panel and on the page, and a press outside', async () => {
      const user = userEvent.setup();
      const requestOpen = vi.fn<ModalRequestOpen>();
      render(<Page type="inline" defaultOpen requestOpenOverride={requestOpen} />);
      act(() => button('First').focus());
      await user.keyboard('{Escape}');
      act(() => button('After').focus());
      await user.keyboard('{Escape}');
      await user.click(button('Before'));
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body);
      expect(requestOpen).not.toHaveBeenCalled();
      expect(panelElement()).not.toBeNull();
    });
  });

  describe('focus (5)', () => {
    it('inline: opening moves no focus; a close returns focus only when focus is inside', () => {
      const { rerender } = render(<Page type="inline" open={false} />);
      act(() => button('Toggle').focus());
      rerender(<Page type="inline" open />);
      expect(panelElement()).not.toBeNull();
      expect(button('Toggle')).toHaveFocus();

      // Focus on the page stays there.
      act(() => button('After').focus());
      rerender(<Page type="inline" open={false} />);
      expect(panelElement()).toBeNull();
      expect(button('After')).toHaveFocus();

      // Focus on <body> stays there.
      act(() => button('Toggle').focus());
      rerender(<Page type="inline" open />);
      act(() => (document.activeElement as HTMLElement).blur());
      rerender(<Page type="inline" open={false} />);
      expect(document.body).toHaveFocus();

      // Focus inside returns to the trigger.
      act(() => button('Toggle').focus());
      rerender(<Page type="inline" open />);
      act(() => button('Last').focus());
      rerender(<Page type="inline" open={false} />);
      expect(panelElement()).toBeNull();
      expect(button('Toggle')).toHaveFocus();
    });

    it('inline: finalFocusRef wins when focus is inside', async () => {
      const user = userEvent.setup();
      function WithFinalFocus({ open }: { open: boolean }) {
        const ref = React.useRef<HTMLInputElement>(null);
        return (
          <>
            <input aria-label="Notes" ref={ref} />
            <Page type="inline" open={open} finalFocusRef={ref} />
          </>
        );
      }
      const { rerender } = render(<WithFinalFocus open={false} />);
      await user.click(button('Toggle'));
      rerender(<WithFinalFocus open />);
      await user.click(button('Last'));
      rerender(<WithFinalFocus open={false} />);
      expect(panelElement()).toBeNull();
      expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveFocus();
    });

    it('non-modal overlay: Tab and Shift+Tab leave it in the page’s order right after the opener', async () => {
      const user = userEvent.setup();
      render(<Page modalType="non-modal" />);
      await user.click(button('Toggle'));
      expect(button('First')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Toggle')).toHaveFocus();
      await user.tab();
      expect(button('First')).toHaveFocus();
      await user.tab();
      expect(button('Last')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Last')).toHaveFocus();
    });

    it('non-modal overlay: the consumer’s onKeyDown runs first; preventDefault() skips the Tab order', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn((event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Tab') event.preventDefault();
      });
      render(<Page modalType="non-modal" onKeyDown={onKeyDown} />);
      await user.click(button('Toggle'));
      act(() => button('Last').focus());
      await user.tab();
      expect(onKeyDown).toHaveBeenCalled();
      expect(button('Last')).toHaveFocus();
    });

    it('modal overlay: traps focus and isolates the page, then returns focus to the trigger', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.click(button('Toggle'));
      expect(button('First')).toHaveFocus();
      expect(
        screen.getByRole('button', { name: 'Before', hidden: true }).closest('[inert]'),
      ).not.toBeNull();
      expect(document.documentElement.style.overflow).toBe('hidden');
      await user.tab();
      await user.tab();
      expect(button('First')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(button('Toggle')).toHaveFocus();
    });

    describe('kept mounted (unmountOnClose: false)', () => {
      it.each([['overlay'], ['inline']] as const)(
        'keeps a closed %s panel hidden and inert on every top-level element, with no layer',
        (type) => {
          render(<Shell type={type} unmountOnClose={false} />);
          const panel = panelElement()!;
          expect(panel).not.toBeNull();
          // The top-level elements: the backdrop and the panel of an overlay, the inline panel.
          const backdrop = document.querySelector('.' + drawerClassNames.backdrop);
          if (type === 'overlay') expect(panel.previousElementSibling).toBe(backdrop);
          else expect(backdrop).toBeNull();
          for (const element of type === 'overlay' ? [backdrop!, panel] : [panel]) {
            expect(element).toHaveAttribute('hidden');
            expect(element).toHaveAttribute('inert');
            expect(element).toHaveAttribute('data-presence', 'exited');
          }
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
          expect(getTopmostLayer()).toBeNull();
          expect(document.documentElement.style.overflow).toBe('');
        },
      );

      it('moves its portal to the end of its container when it opens (D104)', async () => {
        const user = userEvent.setup();
        render(<Page unmountOnClose={false} />);
        const wrapper = wrapperOf(panelElement());
        expect(wrapper).not.toBeNull();
        const later = document.createElement('div');
        document.body.appendChild(later);
        try {
          expect(document.body.lastElementChild).toBe(later);
          await user.click(button('Toggle'));
          expect(document.body.lastElementChild).toBe(wrapper);
          expect(panelElement()).not.toHaveAttribute('hidden');
          expect(button('First')).toHaveFocus();
          await user.keyboard('{Escape}');
          expect(panelElement()).toHaveAttribute('hidden');
          expect(button('Toggle')).toHaveFocus();
        } finally {
          later.remove();
        }
      });

      it('keeps what was typed across closing and opening again', async () => {
        const user = userEvent.setup();
        render(
          <Page unmountOnClose={false}>
            <input aria-label="Name" />
          </Page>,
        );
        await user.click(button('Toggle'));
        await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
        await user.click(button('Toggle'));
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
        await user.keyboard('{Escape}');
      });
    });
  });

  describe('trigger: inertModalTrigger (6)', () => {
    /** A root without trigger parts, opened from a page button of its own. */
    function OpenedFromPage({ type }: { type: 'overlay' | 'inline' }) {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Shell
            type={type}
            open={open}
            onOpenChange={setOpen}
            triggerKind="inert"
            requestOpenOverride={(next) => setOpen(next)}
          >
            <button type="button" onClick={() => setOpen(false)}>
              Done
            </button>
          </Shell>
        </>
      );
    }

    it('overlay: focus returns to the opener the layer captured', async () => {
      const user = userEvent.setup();
      render(<OpenedFromPage type="overlay" />);
      await user.click(button('Open'));
      expect(button('Done')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(panelElement()).toBeNull();
      expect(button('Open')).toHaveFocus();
    });

    it('inline: focus inside returns to the opener the restore captured', async () => {
      const user = userEvent.setup();
      render(<OpenedFromPage type="inline" />);
      await user.click(button('Open'));
      expect(button('Open')).toHaveFocus();
      await user.click(button('Done'));
      expect(panelElement()).toBeNull();
      expect(button('Open')).toHaveFocus();
    });
  });

  describe('rootClassName and backdropClassName (7)', () => {
    it('puts the variant’s roots first, in order, on two shells', () => {
      render(
        <>
          <Shell defaultOpen id="plain" aria-label="Plain" />
          <Shell
            type="inline"
            defaultOpen
            id="variant"
            aria-label="Variant"
            rootClassName={cn(drawerClassNames.root, navDrawerClassNames.root)}
          />
        </>,
      );
      const plain = document.getElementById('plain')!;
      const variant = document.getElementById('variant')!;
      expect(Array.from(plain.classList).slice(0, 2)).not.toContain(navDrawerClassNames.root);
      expect(plain.classList[0]).toBe(drawerClassNames.root);
      expect(Array.from(variant.classList).slice(0, 2)).toEqual([
        drawerClassNames.root,
        navDrawerClassNames.root,
      ]);
    });

    it('puts the variant’s backdrop classes first, in order', () => {
      render(
        <Shell
          defaultOpen
          backdropClassName={cn(drawerClassNames.backdrop, navDrawerClassNames.backdrop)}
        />,
      );
      const backdrop = document.querySelector('.' + drawerClassNames.backdrop)!;
      expect(Array.from(backdrop.classList).slice(0, 2)).toEqual([
        drawerClassNames.backdrop,
        navDrawerClassNames.backdrop,
      ]);
    });
  });

  describe('development warnings (8)', () => {
    const NON_MODAL_FULL_WARNING =
      '[WaveUI] Test: `size="full"` with `modalType="non-modal"` covers the whole page while leaving it usable, so Tab reaches controls hidden behind the drawer. Use `modalType="modal"`, `type="inline"`, or a smaller size with its room reserved in the page layout.';
    const BACKDROP_IGNORED_WARNING =
      '[WaveUI] Test: `backdrop` and `backdropMotion` are ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.';

    it('warns <componentName>:non-modal-full once for an open full non-modal overlay', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <React.StrictMode>
            <Shell defaultOpen size="full" modalType="non-modal" />
          </React.StrictMode>,
        );
        expect(warn.mock.calls).toEqual([[NON_MODAL_FULL_WARNING]]);
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      ['an inline full panel', { type: 'inline', size: 'full', modalType: 'non-modal' }],
      ['a modal full overlay', { size: 'full', modalType: 'modal' }],
      ['a closed full non-modal overlay', { size: 'full', modalType: 'non-modal', open: false }],
    ] as const)('does not warn for %s', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<Shell defaultOpen {...props} />);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      ['a non-modal overlay', { modalType: 'non-modal' }],
      ['an inline panel', { type: 'inline' }],
    ] as const)('warns <componentName>:backdrop-ignored for a backdrop slot on %s', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<Shell defaultOpen backdrop={{ className: 'opacity-50' }} {...props} />);
        expect(warn.mock.calls).toEqual([[BACKDROP_IGNORED_WARNING]]);
        expect(document.querySelector('.' + drawerClassNames.backdrop)).toBeNull();
      } finally {
        warn.mockRestore();
      }
    });

    it('warns <componentName>:open-inside when a kept-mounted panel closes with a popup inside open', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      /** A kept-mounted inline panel with a Popover inside; the parent decides `open`. */
      function Inside({ open }: { open: boolean }) {
        return (
          <Shell type="inline" open={open} unmountOnClose={false}>
            <Popover>
              <Popover.Trigger>
                <button type="button">Help</button>
              </Popover.Trigger>
              <Popover.Content>Help text</Popover.Content>
            </Popover>
          </Shell>
        );
      }
      try {
        const { rerender } = render(<Inside open />);
        fireEvent.click(button('Help'));
        expect(screen.getByText('Help text')).toBeInTheDocument();
        rerender(<Inside open={false} />);
        expect(warn).not.toHaveBeenCalled();
        act(() => {
          vi.advanceTimersByTime(0);
        });
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Test closed while a popup opened inside it is still open. With `unmountOnClose={false}` the popup stays open over the page: close it first, or keep the default `unmountOnClose`.',
          ],
        ]);
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });
  });
});
