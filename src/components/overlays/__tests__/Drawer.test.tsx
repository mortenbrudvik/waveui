import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Drawer,
  DrawerClose,
  DrawerTitle,
  DrawerTrigger,
  type DrawerCloseProps,
  type DrawerProps,
  type DrawerTitleProps,
  type DrawerTriggerProps,
} from '../Drawer';
import { useDismiss } from '../../../hooks/useDismiss';
import { Portal } from '../../portal/Portal';
import { getTopmostLayer } from '../../../lib/layers';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testCompoundExposure,
  testDisplayName,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

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

function backdrop() {
  const panel = screen.getByRole('dialog');
  const parent = panel.parentElement;
  if (!parent) throw new Error('the drawer panel has no parent');
  return parent;
}

/** An uncontrolled Drawer with a trigger and a Drawer.Close footer button. */
function WithTrigger(props: Partial<DrawerProps>) {
  return (
    <Drawer title="Filters" {...props}>
      <Drawer.Trigger>
        <button type="button">Open filters</button>
      </Drawer.Trigger>
      {props.children ?? <p>Body</p>}
      <Drawer.Close>
        <button type="button">Apply</button>
      </Drawer.Close>
    </Drawer>
  );
}

function ChildLayer() {
  const [open, setOpen] = React.useState(true);
  const ref = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({ open, onDismiss: () => setOpen(false), refs: [ref] });
  if (!open) return null;
  return (
    <Portal layerId={layerId}>
      <div ref={ref} data-testid="child-layer">
        <button type="button">Child option</button>
      </div>
    </Portal>
  );
}

describe('Drawer', () => {
  testDisplayName(Drawer, 'Drawer');

  testCompoundExposure(Drawer, ['Trigger', 'Close', 'Title']);

  it('exports every sub-component under its flat name (C-COMPOUND)', () => {
    expect(DrawerTrigger).toBe(Drawer.Trigger);
    expect(DrawerClose).toBe(Drawer.Close);
    expect(DrawerTitle).toBe(Drawer.Title);
  });

  it('declares ref in every props interface (C-REF)', () => {
    expectTypeOf<DrawerProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<DrawerTriggerProps['ref']>().toEqualTypeOf<React.Ref<HTMLElement> | undefined>();
    expectTypeOf<DrawerCloseProps['ref']>().toEqualTypeOf<React.Ref<HTMLElement> | undefined>();
    expectTypeOf<DrawerTitleProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLHeadingElement> | undefined
    >();
  });

  describe('system props', () => {
    testSystemProps(Drawer, {
      expectedTag: 'div',
      displayName: 'Drawer',
      defaultProps: { defaultOpen: true, title: 'Settings', children: <p>Content</p> },
      conflictingClass: { className: 'w-96', overrides: 'w-80' },
      a11yVariants: [
        { name: 'start position', props: { position: 'start' } },
        { name: 'named by aria-label', props: { title: undefined, 'aria-label': 'Settings' } },
      ],
    });
  });

  // button-provider#1 (C-BUTTON-TYPE)
  testNoImplicitSubmit(Drawer, {
    defaultProps: { open: true, title: 'Settings', children: 'Body' },
  });

  describe('basic behaviour', () => {
    it('does not render when closed', () => {
      // A trigger keeps this uncontrolled drawer openable (without one it warns, overlays#33).
      render(<WithTrigger>Content</WithTrigger>);
      expect(button('Open filters')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders only the trigger on the server, also when open by default', () => {
      const html = renderToString(<WithTrigger defaultOpen />);
      expect(html).toContain('Open filters');
      expect(html).not.toContain('role="dialog"');
    });

    it('renders when defaultOpen is true', () => {
      render(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
      );
      expect(screen.getByRole('dialog', { name: 'Drawer' })).toHaveTextContent('Content');
    });

    it('is controlled via the open prop', () => {
      const { rerender } = render(
        <Drawer open={false} title="Drawer">
          Content
        </Drawer>,
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      rerender(
        <Drawer open title="Drawer">
          Content
        </Drawer>,
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('names the panel with its title through aria-labelledby', () => {
      render(
        <Drawer defaultOpen title="My Drawer">
          Content
        </Drawer>,
      );
      const dialog = screen.getByRole('dialog', { name: 'My Drawer' });
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(document.getElementById(titleId ?? '')).toHaveTextContent('My Drawer');
    });

    it('isolates the page with inert instead of aria-modal while open (§5.8)', () => {
      const { container } = render(
        <>
          <button type="button">Background</button>
          <Drawer defaultOpen title="Drawer">
            Content
          </Drawer>
        </>,
      );
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-modal');
      expect(container).toHaveAttribute('inert');
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
      );
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on a backdrop click', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
      );
      await user.click(backdrop());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes when the Close button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
      );
      await user.click(button('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('portals the panel into a themed portal wrapper outside the render container', () => {
      const { container } = render(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
      );
      const dialog = screen.getByRole('dialog');
      expect(container.contains(dialog)).toBe(false);
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
    });

    it('calls onOpenChange when closed', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Drawer defaultOpen onOpenChange={onOpenChange} title="Drawer">
          Content
        </Drawer>,
      );
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('renders the shared decorative dismiss icon in the Close button (input-datetime#22)', () => {
      render(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
      );
      const icon = button('Close').querySelector('svg');
      expect(icon).toHaveAttribute('data-wave-icon', 'dismiss');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('positions (overlays#40)', () => {
    it.each([
      [undefined, 'end-0'],
      ['end', 'end-0'],
      ['start', 'start-0'],
      ['left', 'left-0'],
      ['right', 'right-0'],
    ] as const)('position %s places the panel with %s', (position, expected) => {
      render(
        <Drawer defaultOpen position={position} title="Drawer">
          Content
        </Drawer>,
      );
      expect(screen.getByRole('dialog')).toHaveClass(expected);
    });

    it('places a start drawer with logical utilities under rtl', () => {
      renderWithProviders(
        <Drawer defaultOpen position="start" title="Drawer">
          Content
        </Drawer>,
        { dir: 'rtl' },
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog.closest('[data-wave-portal]')).toHaveAttribute('dir', 'rtl');
      expect(dialog).toHaveClass('start-0');
      expect(dialog).not.toHaveClass('left-0', 'right-0');
      expect(button('Close')).toHaveClass('ms-auto');
      expect(button('Close')).not.toHaveClass('ml-auto');
    });
  });

  describe('theme and tokens', () => {
    it('inherits the provider theme through the portal (button-provider#2)', () => {
      renderWithProviders(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
        { theme: 'dark' },
      );
      expect(screen.getByRole('dialog').closest('.wave-dark')).not.toBeNull();
    });

    it('uses token backdrop, surface and shadow classes (button-provider#3)', () => {
      render(
        <Drawer defaultOpen title="Drawer">
          Content
        </Drawer>,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('bg-background', 'text-foreground', 'shadow-64');
      expect(backdrop()).toHaveClass('bg-backdrop');
      expect(dialog.className).not.toMatch(/#|rgba|black|white/);
      expect(backdrop().className).not.toMatch(/#|rgba|black|white/);
    });

    it('keeps a scrolling body (popups inside are portaled, overlays#36)', () => {
      render(
        <Drawer defaultOpen title="Drawer">
          <p>Content</p>
        </Drawer>,
      );
      expect(screen.getByText('Content').parentElement).toHaveClass('overflow-y-auto');
    });
  });

  describe('Drawer.Trigger and Drawer.Close (overlays#33)', () => {
    it('opens, closes and reopens an uncontrolled drawer', async () => {
      const user = userEvent.setup();
      const { container } = render(<WithTrigger />);
      const trigger = button('Open filters');
      expect(container).toContainElement(trigger);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(trigger);
      expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveTextContent('Body');
      await user.click(button('Apply'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      await user.click(trigger);
      expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    });

    it('reopens a drawer that started open', async () => {
      const user = userEvent.setup();
      render(<WithTrigger defaultOpen />);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(button('Open filters'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('puts the trigger state on the child button', async () => {
      const user = userEvent.setup();
      render(<WithTrigger />);
      const trigger = button('Open filters');
      expect(trigger.parentElement?.tagName).not.toBe('SPAN');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', screen.getByRole('dialog').id);
    });

    it('renders the wrapper span with asChild={false}', async () => {
      const user = userEvent.setup();
      render(
        <Drawer title="Wrapped">
          <Drawer.Trigger asChild={false}>
            <button type="button">Open</button>
          </Drawer.Trigger>
          Body
        </Drawer>,
      );
      expect(button('Open').parentElement?.tagName).toBe('SPAN');
      await user.click(button('Open'));
      expect(screen.getByRole('dialog', { name: 'Wrapped' })).toBeInTheDocument();
    });

    it('still opens from a custom child that does not forward its ref (wrapper fallback + warning)', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function Fancy() {
        return <button type="button">Fancy</button>;
      }
      render(
        <Drawer title="Fallback">
          <Drawer.Trigger>
            <Fancy />
          </Drawer.Trigger>
          Body
        </Drawer>,
      );
      await user.click(button('Fancy'));
      expect(screen.getByRole('dialog', { name: 'Fallback' })).toBeInTheDocument();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Drawer.Trigger'));
      warn.mockRestore();
    });

    it('returns focus to the button inside an asChild={false} wrapper span (overlays#9)', async () => {
      const user = userEvent.setup();
      render(
        <Drawer title="Wrapped">
          <Drawer.Trigger asChild={false}>
            <button type="button">Open</button>
          </Drawer.Trigger>
          Body
        </Drawer>,
      );
      await user.click(button('Open'));
      expect(screen.getByRole('dialog', { name: 'Wrapped' })).toBeInTheDocument();
      await user.click(button('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(button('Open')).toHaveFocus();
    });

    it('returns focus to the button of a custom child that does not forward its ref (overlays#9)', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function Fancy() {
        return <button type="button">Fancy</button>;
      }
      render(
        <Drawer title="Fallback">
          <Drawer.Trigger>
            <Fancy />
          </Drawer.Trigger>
          Body
        </Drawer>,
      );
      await user.click(button('Fancy'));
      expect(screen.getByRole('dialog', { name: 'Fallback' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(button('Fancy')).toHaveFocus();
      warn.mockRestore();
    });

    it('returns focus into a wrapper span also when the click did not focus the button (Safari, overlays#9)', async () => {
      const user = userEvent.setup();
      render(
        <Drawer title="Wrapped">
          <Drawer.Trigger asChild={false}>
            <button type="button">Open</button>
          </Drawer.Trigger>
          Body
        </Drawer>,
      );
      fireEvent.click(button('Open'));
      expect(screen.getByRole('dialog', { name: 'Wrapped' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(button('Open')).toHaveFocus();
    });

    describe('several triggers (overlays#9)', () => {
      function TwoTriggers({ showSecond = true }: { showSecond?: boolean }) {
        return (
          <Drawer title="Two triggers">
            <Drawer.Trigger>
              <button type="button">First</button>
            </Drawer.Trigger>
            {showSecond && (
              <Drawer.Trigger>
                <button type="button">Second</button>
              </Drawer.Trigger>
            )}
            Body
          </Drawer>
        );
      }

      it('returns focus to the trigger that opened the drawer, not the last one mounted', async () => {
        const user = userEvent.setup();
        render(<TwoTriggers />);
        await user.click(button('First'));
        expect(screen.getByRole('dialog', { name: 'Two triggers' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('First')).toHaveFocus();

        await user.click(button('Second'));
        await user.click(button('Close'));
        expect(button('Second')).toHaveFocus();
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
      function TriggersAndExternal() {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              External
            </button>
            <Drawer title="Scoped" open={open} onOpenChange={setOpen}>
              <Drawer.Trigger>
                <button type="button">First</button>
              </Drawer.Trigger>
              <Drawer.Trigger>
                <button type="button">Second</button>
              </Drawer.Trigger>
              Body
            </Drawer>
          </>
        );
      }

      it('forgets the trigger that opened the drawer once it closes: a later outside open returns to its opener', async () => {
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

      it('returns focus to a render-prop trigger that calls onClick without the event (also when the click did not focus it)', async () => {
        const user = userEvent.setup();
        render(
          <Drawer title="Render prop">
            <Drawer.Trigger>
              <button type="button">First</button>
            </Drawer.Trigger>
            <Drawer.Trigger>
              {({ onClick, ...props }) => (
                <button type="button" {...props} onClick={() => (onClick as () => void)()}>
                  Second
                </button>
              )}
            </Drawer.Trigger>
            Body
          </Drawer>,
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
      });
    });

    describe('triggers inside Fragments', () => {
      function ConditionalTrigger({ showTrigger = true }: { showTrigger?: boolean }) {
        return (
          <Drawer title="Fragment">
            {showTrigger && (
              <>
                <Drawer.Trigger>
                  <button type="button">Open</button>
                </Drawer.Trigger>
                <p>Fragment body</p>
              </>
            )}
            <p>Direct body</p>
          </Drawer>
        );
      }

      it('renders a Drawer.Trigger inside a (conditional) Fragment in place, and the rest of the Fragment in the panel', async () => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rerender } = render(<ConditionalTrigger />);
        // Closed: the trigger is on the page, the Fragment's other children are panel content.
        expect(button('Open')).toBeInTheDocument();
        expect(screen.queryByText('Fragment body')).not.toBeInTheDocument();
        expect(screen.queryByText('Direct body')).not.toBeInTheDocument();

        await user.click(button('Open'));
        const panel = screen.getByRole('dialog', { name: 'Fragment' });
        expect(panel).toContainElement(screen.getByText('Fragment body'));
        expect(panel).toContainElement(screen.getByText('Direct body'));
        expect(panel).not.toContainElement(button('Open'));
        expect(button('Open')).toHaveAttribute('aria-expanded', 'true');

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('Open')).toHaveFocus();
        expect(warn).not.toHaveBeenCalled();

        rerender(<ConditionalTrigger showTrigger={false} />);
        expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
        warn.mockRestore();
      });

      it('finds a trigger in nested and keyed Fragments', async () => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(
          <Drawer title="Nested fragments">
            <React.Fragment key="outer">
              <>
                <Drawer.Trigger>
                  <button type="button">Open</button>
                </Drawer.Trigger>
              </>
              Body
            </React.Fragment>
          </Drawer>,
        );
        await user.click(button('Open'));
        expect(screen.getByRole('dialog', { name: 'Nested fragments' })).toHaveTextContent('Body');
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });

      it('gives flattened Fragment children unique keys and keeps panel state when a sibling Fragment toggles', async () => {
        const user = userEvent.setup();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        function Toggling({ extra }: { extra: boolean }) {
          return (
            <Drawer title="Keys" defaultOpen>
              <>
                <Drawer.Trigger>
                  <button type="button">Open</button>
                </Drawer.Trigger>
                <p>One</p>
              </>
              {extra && (
                <>
                  <p>Extra</p>
                </>
              )}
              <>
                <p>Two</p>
                <input aria-label="Kept" />
              </>
            </Drawer>
          );
        }
        const { rerender } = render(<Toggling extra={false} />);
        await user.type(screen.getByRole('textbox', { name: 'Kept' }), 'typed');
        const input = screen.getByRole('textbox', { name: 'Kept' });

        rerender(<Toggling extra />);
        expect(screen.getByText('Extra')).toBeInTheDocument();
        // Same element, same uncontrolled value: the flattened keys did not shift.
        expect(screen.getByRole('textbox', { name: 'Kept' })).toBe(input);
        expect(input).toHaveValue('typed');
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
      });
    });

    it.each([
      [
        'a wrapper element',
        <span key="wrapper">
          <Drawer.Trigger>
            <button type="button">Open</button>
          </Drawer.Trigger>
        </span>,
      ],
      [
        'a Fragment inside a wrapper element',
        <div key="wrapper">
          <>
            <Drawer.Trigger>
              <button type="button">Open</button>
            </Drawer.Trigger>
          </>
        </div>,
      ],
    ])('warns in development when Drawer.Trigger is nested in %s (never rendered)', (_, nested) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Drawer title="Nested">{nested}</Drawer>);
      // The nested trigger is panel content: it is not rendered while the drawer is closed.
      expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[WaveUI] Drawer.Trigger must be a direct child of Drawer'),
      );
      warn.mockRestore();
    });

    it('warns in development when a Drawer.Trigger renders inside the open panel', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // A component that renders the trigger itself is invisible to the children walk.
      function OwnTrigger() {
        return (
          <Drawer.Trigger>
            <button type="button">Open again</button>
          </Drawer.Trigger>
        );
      }
      render(
        <Drawer defaultOpen title="In panel">
          <OwnTrigger />
        </Drawer>,
      );
      expect(screen.getByRole('dialog')).toContainElement(button('Open again'));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[WaveUI] Drawer.Trigger must be a direct child of Drawer'),
      );
      warn.mockRestore();
    });

    it('does not warn for a direct Drawer.Trigger or for the trigger of a Drawer nested in the panel', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Drawer defaultOpen title="Outer">
          <Drawer.Trigger>
            <button type="button">Open outer</button>
          </Drawer.Trigger>
          <div>
            <Drawer title="Inner">
              <Drawer.Trigger>
                <button type="button">Open inner</button>
              </Drawer.Trigger>
              Inner body
            </Drawer>
          </div>
        </Drawer>,
      );
      expect(screen.getByRole('dialog', { name: 'Outer' })).toContainElement(button('Open inner'));
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does not warn for the trigger of a wrapper component that renders its own Drawer', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function SubDrawer({ children }: { children: React.ReactNode }) {
        return <Drawer title="Sub">{children}</Drawer>;
      }
      render(
        <Drawer defaultOpen title="Outer">
          <Drawer.Trigger>
            <button type="button">Open outer</button>
          </Drawer.Trigger>
          <SubDrawer>
            <Drawer.Trigger>
              <button type="button">Open sub</button>
            </Drawer.Trigger>
            Sub body
          </SubDrawer>
        </Drawer>,
      );
      expect(warn).not.toHaveBeenCalled();
      // The trigger is a direct child of its own Drawer and opens it.
      await user.click(button('Open sub'));
      expect(screen.getByRole('dialog', { name: 'Sub' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('warns in development when an uncontrolled closed drawer has no direct Drawer.Trigger', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // A component that renders the trigger makes it panel content: it can never open the drawer.
      function FilterTrigger() {
        return (
          <Drawer.Trigger>
            <button type="button">Filters</button>
          </Drawer.Trigger>
        );
      }
      render(
        <Drawer title="Filters">
          <FilterTrigger />
        </Drawer>,
      );
      expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[WaveUI] Drawer can never open'));
      warn.mockRestore();
    });

    it.each([
      ['it is controlled', { open: false, onOpenChange: () => {} }, null],
      ['it is open by default', { defaultOpen: true }, null],
      [
        'it has a direct Drawer.Trigger',
        {},
        <Drawer.Trigger key="trigger">
          <button type="button">Open</button>
        </Drawer.Trigger>,
      ],
      [
        'its Drawer.Trigger is in a Fragment',
        {},
        <React.Fragment key="fragment">
          <Drawer.Trigger>
            <button type="button">Open</button>
          </Drawer.Trigger>
        </React.Fragment>,
      ],
    ] as const)('does not warn that the drawer can never open when %s', (_, props, trigger) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <React.StrictMode>
          <Drawer title="Reachable" {...props}>
            {trigger}
            Body
          </Drawer>
        </React.StrictMode>,
      );
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('stops walking the children for nested triggers once it has warned', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let reads = 0;
      const watched = new Proxy([<p key="watched">Watched</p>], {
        get(target, key, receiver) {
          reads += 1;
          return Reflect.get(target, key, receiver) as unknown;
        },
      });
      const watchedElement = <div>{watched}</div>;
      const nested = (
        <span>
          <Drawer.Trigger>
            <button type="button">Open</button>
          </Drawer.Trigger>
        </span>
      );
      function Walked({ tick }: { tick: number }) {
        return (
          <Drawer open={false} onOpenChange={() => {}} title="Walked">
            {watchedElement}
            {nested}
            {`Render ${tick}`}
          </Drawer>
        );
      }
      const { rerender } = render(<Walked tick={0} />);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[WaveUI] Drawer.Trigger must be a direct child of Drawer'),
      );
      reads = 0;
      rerender(<Walked tick={1} />);
      rerender(<Walked tick={2} />);
      expect(reads).toBe(0);
      warn.mockRestore();
    });

    it('Drawer.Close composes the child’s onClick and respects preventDefault', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(
        <Drawer defaultOpen title="Drawer">
          <Drawer.Close>
            <button type="button" onClick={(event) => event.preventDefault()}>
              Stay
            </button>
          </Drawer.Close>
          <Drawer.Close>
            <button type="button" onClick={onApply}>
              Apply
            </button>
          </Drawer.Close>
        </Drawer>,
      );
      await user.click(button('Stay'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(button('Apply'));
      expect(onApply).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessible name (overlays#8)', () => {
    it('accepts a ReactNode title', () => {
      render(
        <Drawer
          defaultOpen
          title={
            <>
              Rich <em>title</em>
            </>
          }
        >
          Content
        </Drawer>,
      );
      expect(screen.getByRole('dialog', { name: 'Rich title' })).toBeInTheDocument();
    });

    it('names the panel with Drawer.Title', () => {
      render(
        <Drawer defaultOpen>
          <Drawer.Title>Notifications</Drawer.Title>
          <p>Content</p>
        </Drawer>,
      );
      expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    });

    it('warns in development when the drawer has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Drawer defaultOpen>Unnamed</Drawer>);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[WaveUI] Drawer has no accessible name'),
      );
      warn.mockRestore();
    });

    it.each([
      ['title', { title: 'Named' }],
      ['aria-label', { 'aria-label': 'Named' }],
    ] as const)('does not warn when named by %s', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Drawer defaultOpen {...props}>
          Content
        </Drawer>,
      );
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Named');
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('misplaced sub-components (overlays#34)', () => {
    it.each([
      [
        'Drawer.Trigger',
        <Drawer.Trigger key="t">
          <button type="button">Open</button>
        </Drawer.Trigger>,
      ],
      [
        'Drawer.Close',
        <Drawer.Close key="c">
          <button type="button">Close</button>
        </Drawer.Close>,
      ],
      ['Drawer.Title', <Drawer.Title key="title">Orphan</Drawer.Title>],
    ])('%s outside Drawer throws in development', (name, element) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(element)).toThrow(`[WaveUI] ${name} must be used within Drawer`);
      error.mockRestore();
    });
  });

  describe('keyboard and focus (overlays#3, overlays#31)', () => {
    it('moves focus into the panel when it opens', async () => {
      const user = userEvent.setup();
      render(<WithTrigger />);
      await user.click(button('Open filters'));
      expect(button('Close')).toHaveFocus();
    });

    it('wraps Tab past a disabled last button', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Drawer">
          <input aria-label="Name" />
          <button type="button" disabled>
            Disabled
          </button>
        </Drawer>,
      );
      act(() => screen.getByRole('textbox', { name: 'Name' }).focus());
      await user.tab();
      expect(button('Close')).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });

    it('Shift+Tab from the panel container moves to its last tabbable element', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Drawer">
          <input aria-label="Name" />
        </Drawer>,
      );
      act(() => screen.getByRole('dialog').focus());
      await user.tab({ shift: true });
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });

    it.each(['Escape', 'Close', 'backdrop'] as const)(
      'returns focus to the trigger after closing with %s',
      async (path) => {
        const user = userEvent.setup();
        render(<WithTrigger />);
        await user.click(button('Open filters'));
        if (path === 'Escape') await user.keyboard('{Escape}');
        if (path === 'Close') await user.click(button('Close'));
        if (path === 'backdrop') await user.click(backdrop());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('Open filters')).toHaveFocus();
      },
    );

    it('restores focus to the opener when an open drawer is unmounted', async () => {
      const user = userEvent.setup();
      function Conditional() {
        const [show, setShow] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setShow(true)}>
              Show
            </button>
            {show && (
              <Drawer open title="Conditional">
                <button type="button" onClick={() => setShow(false)}>
                  Remove
                </button>
              </Drawer>
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

    it('focuses finalFocusRef on close (overlays#10)', async () => {
      const user = userEvent.setup();
      function WithFinalFocus() {
        const ref = React.useRef<HTMLButtonElement>(null);
        return (
          <>
            <button type="button" ref={ref}>
              Return here
            </button>
            <WithTrigger finalFocusRef={ref} />
          </>
        );
      }
      render(<WithFinalFocus />);
      await user.click(button('Open filters'));
      await user.click(button('Apply'));
      expect(button('Return here')).toHaveFocus();
    });
  });

  describe('layers (overlays#1, overlays#2)', () => {
    it('Escape closes a child layer opened inside the drawer first, then the drawer', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Drawer">
          <ChildLayer />
        </Drawer>,
      );
      await user.click(button('Child option'));
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('child-layer')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not close after a drag from the panel to the backdrop', () => {
      render(
        <Drawer defaultOpen title="Drawer">
          <p>Content</p>
        </Drawer>,
      );
      fireEvent.pointerDown(screen.getByText('Content'));
      fireEvent.click(backdrop());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not close on a click inside a nested portaled layer', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Drawer">
          <ChildLayer />
        </Drawer>,
      );
      await user.click(button('Child option'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
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
          <Drawer defaultOpen title="Drawer">
            <button type="button">Inside</button>
          </Drawer>
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
    it('asks to close on Escape, backdrop, Close and Drawer.Close while the parent keeps it open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Drawer open onOpenChange={onOpenChange} title="Controlled">
          <Drawer.Close>
            <button type="button">Apply</button>
          </Drawer.Close>
        </Drawer>,
      );
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      await user.click(backdrop());
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      await user.click(button('Close'));
      expect(onOpenChange).toHaveBeenCalledTimes(3);
      await user.click(button('Apply'));
      expect(onOpenChange.mock.calls).toEqual([[false], [false], [false], [false]]);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('calls onOpenChange exactly once per interaction under StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <WithTrigger onOpenChange={onOpenChange} />
        </React.StrictMode>,
      );
      await user.click(button('Open filters'));
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(true);
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe('scroll lock (overlays#11)', () => {
    it('locks page scrolling while open and restores it on close and unmount', async () => {
      const user = userEvent.setup();
      const { unmount } = render(<WithTrigger />);
      await user.click(button('Open filters'));
      expect(document.documentElement.style.overflow).toBe('hidden');
      await user.keyboard('{Escape}');
      expect(document.documentElement.style.overflow).toBe('');
      await user.click(button('Open filters'));
      unmount();
      expect(document.documentElement.style.overflow).toBe('');
    });
  });

  describe('refs and listeners (overlays#35, table-core#23)', () => {
    it('attaches a stable ref to the panel once across re-renders', () => {
      const ref = vi.fn();
      function Parent({ tick }: { tick: number }) {
        return (
          <Drawer open onOpenChange={() => {}} title={`Render ${tick}`} ref={ref}>
            Content
          </Drawer>
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
          <Drawer open onOpenChange={() => {}} title={`Render ${tick}`}>
            Content
          </Drawer>
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
    it('has no violations when open, trigger included', async () => {
      const user = userEvent.setup();
      render(<WithTrigger />);
      await user.click(button('Open filters'));
      await expectNoA11yViolations();
    });
  });
});
