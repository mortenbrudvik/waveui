import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer, type DrawerProps } from '../Drawer';
import { Dialog } from '../Dialog';
import { Popover } from '../Popover';
import { Toaster } from '../../feedback/Toaster';
import { SpinButton } from '../../input/SpinButton';
import { drawerClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { expectNoA11yViolations, mockAnimations } from '../../../test-utils';

/*
 * P6-07 D102–D104, D106, D109 (overlay drawers): `unmountOnClose={false}` keeps the panel mounted
 * while closed, `hidden` and `inert` on every top-level element of the portal (the backdrop and
 * the panel), so its form and component state survive; everything modal keys on `open`; the
 * portal moves to the top of the stack when it opens; a popup left open inside it warns. D103:
 * every Drawer surface mounts through the presence core (`data-presence`), also by default.
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

const panel = () => document.querySelector<HTMLElement>('.' + drawerClassNames.root);
const backdrop = () => document.querySelector<HTMLElement>('.' + drawerClassNames.backdrop);
const nameField = () => screen.getByRole('textbox', { name: 'Name' });

const NESTED_TRIGGER_WARNING =
  '[WaveUI] Drawer.Trigger must be a direct child of Drawer (a Fragment is fine). Inside another element or a component it is rendered as panel content, which is not rendered (or, with `unmountOnClose={false}`, is hidden) while the drawer is closed, so it cannot open the drawer. Make it a direct child, put wrappers such as a Tooltip inside the trigger, or control the Drawer with `open`/`onOpenChange` and open it from your own button.';

const OPEN_INSIDE_WARNING =
  '[WaveUI] Drawer closed while a popup opened inside it is still open. With `unmountOnClose={false}` the popup stays open over the page: close it first, or keep the default `unmountOnClose`.';

/** An uncontrolled Drawer with a trigger, a form and a footer Drawer.Close; kept mounted. */
function FormDrawer(props: Partial<DrawerProps>) {
  return (
    <>
      <button type="button">Page button</button>
      <Drawer title="Filters" unmountOnClose={false} {...props}>
        <Drawer.Trigger>
          <button type="button">Open filters</button>
        </Drawer.Trigger>
        <input aria-label="Name" />
        <SpinButton aria-label="Rows" defaultValue={10} />
        <Drawer.Footer>
          <Drawer.Close>
            <button type="button">Done</button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer>
    </>
  );
}

describe('Drawer unmountOnClose', () => {
  it('types unmountOnClose as an optional boolean', () => {
    expectTypeOf<DrawerProps['unmountOnClose']>().toEqualTypeOf<boolean | undefined>();
  });

  it('by default renders nothing while closed (the 0.10 behaviour)', () => {
    render(<FormDrawer unmountOnClose={undefined} />);
    expect(panel()).toBeNull();
    expect(backdrop()).toBeNull();
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  });

  it('keeps a never-opened panel mounted, hidden and inert, with no layer, isolation or scroll lock', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<FormDrawer onOpenChange={onOpenChange} />);
    // Mounted with the Drawer, closed: every top-level element of the portal is hidden and inert.
    for (const element of [backdrop(), panel()]) {
      expect(element).not.toBeNull();
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
      expect(element).toHaveAttribute('data-presence', 'exited');
    }
    expect(panel()?.parentElement).toBe(backdrop()?.parentElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { hidden: true })).toBe(panel());
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    // Nothing modal while closed.
    expect(getTopmostLayer()).toBeNull();
    expect(button('Page button').closest('[inert]')).toBeNull();
    expect(button('Open filters').closest('[inert]')).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    button('Page button').focus();
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Page button')).toHaveFocus();
  });

  it('renders data-presence="entered" on the backdrop and the panel while open', async () => {
    const user = userEvent.setup();
    render(<FormDrawer />);
    await user.click(button('Open filters'));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toBe(panel());
    for (const element of [backdrop(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'entered');
      expect(element).not.toHaveAttribute('hidden');
      expect(element).not.toHaveAttribute('inert');
    }
  });

  it('keeps a non-modal panel (no backdrop) mounted, hidden and inert, and its state', async () => {
    const user = userEvent.setup();
    render(<FormDrawer modalType="non-modal" />);
    expect(backdrop()).toBeNull();
    expect(panel()?.parentElement).toHaveAttribute('data-wave-portal');
    expect(panel()).toHaveAttribute('hidden');
    expect(panel()).toHaveAttribute('inert');
    expect(panel()).toHaveAttribute('data-presence', 'exited');
    expect(getTopmostLayer()).toBeNull();
    await user.click(button('Open filters'));
    expect(panel()).toHaveAttribute('data-presence', 'entered');
    expect(getTopmostLayer()?.kind).toBe('dialog');
    expect(button('Close')).toHaveFocus();
    await user.type(nameField(), 'Ada');
    await user.click(button('Done'));
    expect(panel()).toHaveAttribute('hidden');
    expect(getTopmostLayer()).toBeNull();
    expect(button('Open filters')).toHaveFocus();
    await user.click(button('Open filters'));
    expect(nameField()).toHaveValue('Ada');
  });

  it.each([
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    [
      'the Close button',
      async (user: ReturnType<typeof userEvent.setup>) => user.click(button('Close')),
    ],
    ['the backdrop', async (user: ReturnType<typeof userEvent.setup>) => user.click(backdrop()!)],
    [
      'Drawer.Close',
      async (user: ReturnType<typeof userEvent.setup>) => user.click(button('Done')),
    ],
  ] as const)('keeps what was typed when closed with %s and opened again', async (_, close) => {
    const user = userEvent.setup();
    render(<FormDrawer />);
    await user.click(button('Open filters'));
    await user.type(nameField(), 'Ada');
    await close(user);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(panel()).toHaveAttribute('hidden');
    await user.click(button('Open filters'));
    expect(nameField()).toHaveValue('Ada');
  });

  it('keeps the state of a component inside: a SpinButton’s typed value', async () => {
    const user = userEvent.setup();
    render(<FormDrawer />);
    await user.click(button('Open filters'));
    const rows = screen.getByRole('spinbutton', { name: 'Rows' });
    await user.clear(rows);
    await user.type(rows, '42');
    await user.click(button('Done'));
    await user.click(button('Open filters'));
    expect(screen.getByRole('spinbutton', { name: 'Rows' })).toBe(rows);
    expect(rows).toHaveValue('42');
    expect(rows).toHaveAttribute('aria-valuenow', '42');
  });

  it('starts over with the default unmountOnClose', async () => {
    const user = userEvent.setup();
    render(<FormDrawer unmountOnClose />);
    await user.click(button('Open filters'));
    await user.type(nameField(), 'Ada');
    await user.click(button('Done'));
    expect(panel()).toBeNull();
    await user.click(button('Open filters'));
    expect(nameField()).toHaveValue('');
  });

  it('moves focus in again on every open, traps it and isolates the page, then restores it', async () => {
    const user = userEvent.setup();
    render(<FormDrawer />);
    for (let round = 0; round < 2; round++) {
      await user.click(button('Open filters'));
      // The trap's initial focus: the first focusable element, the built-in Close button.
      expect(button('Close')).toHaveFocus();
      expect(button('Page button').closest('[inert]')).not.toBeNull();
      expect(document.documentElement.style.overflow).toBe('hidden');
      await user.tab({ shift: true });
      expect(button('Done')).toHaveFocus();
      await user.tab();
      expect(button('Close')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(button('Open filters')).toHaveFocus();
      expect(button('Page button').closest('[inert]')).toBeNull();
      expect(document.documentElement.style.overflow).toBe('');
    }
  });

  it('gives the trigger aria-expanded="false" and no aria-controls while kept closed', async () => {
    const user = userEvent.setup();
    render(<FormDrawer />);
    const trigger = button('Open filters');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', panel()!.id);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
  });

  it('has no axe violations while kept closed and while open', async () => {
    const user = userEvent.setup();
    render(<FormDrawer />);
    await expectNoA11yViolations(document.body);
    await user.click(button('Open filters'));
    await expectNoA11yViolations(document.body);
  });

  it('calls onOpenChange once per change under StrictMode and renders one portal wrapper', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <FormDrawer onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    expect(document.querySelectorAll('[data-wave-portal]')).toHaveLength(1);
    await user.click(button('Open filters'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ reason: 'trigger' }),
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'escape' }),
    );
    expect(document.querySelectorAll('[data-wave-portal]')).toHaveLength(1);
    expect(button('Open filters')).toHaveFocus();
  });

  describe('server rendering', () => {
    it('renders only the trigger on the server, then the hidden panel in <body> after hydration', async () => {
      const onOpenChange = vi.fn();
      const element = <FormDrawer onOpenChange={onOpenChange} />;
      const html = renderToString(element);
      expect(html).toContain('Open filters');
      expect(html).not.toContain('role="dialog"');
      expect(html).not.toContain('data-presence');
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      const onRecoverableError = vi.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element, { onRecoverableError });
        });
        expect(error).not.toHaveBeenCalled();
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
        const hiddenPanel = panel();
        expect(hiddenPanel).not.toBeNull();
        expect(container).not.toContainElement(hiddenPanel);
        expect(hiddenPanel).toHaveAttribute('hidden');
        expect(hiddenPanel).toHaveAttribute('data-presence', 'exited');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });
  });

  describe('presence (D103)', () => {
    it('keeps an exiting panel mounted and inert while its motion runs, the layer already released, then hides it', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      const onDialogOpenChange = vi.fn();
      render(
        <Dialog open onOpenChange={onDialogOpenChange}>
          <Dialog.Content title="Order">
            <Drawer title="Filters" unmountOnClose={false} data-test-motion="">
              <Drawer.Trigger>
                <button type="button">Open filters</button>
              </Drawer.Trigger>
              <button type="button">Apply</button>
            </Drawer>
          </Dialog.Content>
        </Dialog>,
      );
      await user.click(button('Open filters'));
      expect(panel()).toHaveAttribute('data-presence', 'entering');
      await act(async () => {
        await motion.finishAll();
      });
      expect(panel()).toHaveAttribute('data-presence', 'entered');

      await user.keyboard('{Escape}');
      // Exiting: mounted and inert; the focus restore and the layer did not wait for the motion.
      const exiting = panel();
      expect(exiting).toHaveAttribute('data-presence', 'exiting');
      expect(exiting).toHaveAttribute('inert');
      expect(exiting).not.toHaveAttribute('hidden');
      expect(backdrop()).toHaveAttribute('data-presence', 'exiting');
      expect(backdrop()).toHaveAttribute('inert');
      expect(button('Open filters')).toHaveFocus();
      expect(getTopmostLayer()?.kind).toBe('modal');
      expect(getTopmostLayer()?.getElements()).toContain(
        screen.getByRole('dialog', { name: 'Order' }),
      );
      // Escape reaches the layer below.
      await user.keyboard('{Escape}');
      expect(onDialogOpenChange).toHaveBeenCalledTimes(1);
      expect(onDialogOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'escape' }),
      );

      await act(async () => {
        await motion.finishAll();
      });
      expect(panel()).toBe(exiting);
      expect(exiting).toHaveAttribute('data-presence', 'exited');
      expect(exiting).toHaveAttribute('hidden');
      expect(exiting).toHaveAttribute('inert');
    });

    it('unmounts an exiting panel once its motion ends with the default unmountOnClose', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      render(
        <Drawer title="Filters" data-test-motion="">
          <Drawer.Trigger>
            <button type="button">Open filters</button>
          </Drawer.Trigger>
          <button type="button">Apply</button>
        </Drawer>,
      );
      await user.click(button('Open filters'));
      await act(async () => {
        await motion.finishAll();
      });
      await user.keyboard('{Escape}');
      expect(panel()).toHaveAttribute('data-presence', 'exiting');
      expect(panel()).toHaveAttribute('inert');
      expect(button('Open filters')).toHaveFocus();
      expect(getTopmostLayer()).toBeNull();
      await act(async () => {
        await motion.finishAll();
      });
      expect(panel()).toBeNull();
      expect(document.querySelector('[data-wave-portal]')).toBeNull();
    });

    it('unmounts a panel without motion in the same act() as the close', async () => {
      const user = userEvent.setup();
      render(<FormDrawer unmountOnClose />);
      await user.click(button('Open filters'));
      expect(panel()).toHaveAttribute('data-presence', 'entered');
      await user.keyboard('{Escape}');
      expect(panel()).toBeNull();
    });
  });

  describe('stacking (D104)', () => {
    /** A kept-mounted Drawer rendered beside a modal Dialog and opened from inside it. */
    function DrawerBesideDialog({ unmountOnClose }: { unmountOnClose: boolean }) {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <Drawer
            open={open}
            onOpenChange={setOpen}
            unmountOnClose={unmountOnClose}
            title="Details"
          >
            <button type="button">Edit details</button>
          </Drawer>
          <Dialog defaultOpen>
            <Dialog.Content title="Order">
              <button type="button" onClick={() => setOpen(true)}>
                Show details
              </button>
            </Dialog.Content>
          </Dialog>
        </>
      );
    }

    const wrapperOf = (element: Element | null) => element?.closest('[data-wave-portal]') ?? null;

    it('moves its portal to the end of <body> when it opens, above the Dialog it was mounted before', async () => {
      const user = userEvent.setup();
      render(<DrawerBesideDialog unmountOnClose={false} />);
      const drawerWrapper = wrapperOf(panel());
      const dialogWrapper = wrapperOf(screen.getByRole('dialog', { name: 'Order' }));
      expect(drawerWrapper).not.toBeNull();
      expect(document.body.lastElementChild).toBe(dialogWrapper);
      const append = vi.spyOn(document.body, 'appendChild');
      try {
        await user.click(button('Show details'));
        expect(append).toHaveBeenCalledTimes(1);
        expect(append).toHaveBeenCalledWith(drawerWrapper);
      } finally {
        append.mockRestore();
      }
      expect(document.body.lastElementChild).toBe(drawerWrapper);
      const drawer = screen.getByRole('dialog', { name: 'Details' });
      expect(within(drawer).getByRole('button', { name: 'Close' })).toHaveFocus();
      // The Dialog behind it is inert; the Drawer is not.
      expect(dialogWrapper).toHaveAttribute('inert');
      expect(drawer.closest('[inert]')).toBeNull();
      // Escape closes the drawer first, then the dialog.
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Details' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Order' })).toBeInTheDocument();
      expect(button('Show details')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Order' })).not.toBeInTheDocument();
    });

    it('does not move an unmounting drawer, which React appends when it opens', async () => {
      const user = userEvent.setup();
      render(<DrawerBesideDialog unmountOnClose />);
      const append = vi.spyOn(document.body, 'appendChild');
      try {
        await user.click(button('Show details'));
        const drawerWrapper = wrapperOf(screen.getByRole('dialog', { name: 'Details' }));
        expect(append.mock.calls.filter(([node]) => node === drawerWrapper)).toHaveLength(1);
        expect(document.body.lastElementChild).toBe(drawerWrapper);
      } finally {
        append.mockRestore();
      }
    });
  });

  describe('Toaster', () => {
    it('moves no toast for a kept-mounted closed drawer at the toasts’ side', async () => {
      const user = userEvent.setup();
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
          <FormDrawer ref={stub} />
        </Toaster>,
      );
      const viewport = screen.getByRole('region', { name: 'Notifications' });
      const offset = () => viewport.style.getPropertyValue('--wave-toaster-offset');
      expect(panel()).toHaveAttribute('hidden');
      expect(offset()).toBe('');
      await user.click(button('Open filters'));
      expect(offset()).toBe('320px');
      await user.keyboard('{Escape}');
      expect(offset()).toBe('');
    });
  });

  describe('a popup left open inside (D106)', () => {
    function DrawerWithPopover({
      open,
      unmountOnClose = false,
    }: {
      open: boolean;
      unmountOnClose?: boolean;
    }) {
      return (
        <>
          <button type="button">Page button</button>
          <Drawer
            open={open}
            onOpenChange={() => {}}
            unmountOnClose={unmountOnClose}
            title="Filters"
          >
            <Popover>
              <Popover.Trigger>
                <button type="button">Help</button>
              </Popover.Trigger>
              <Popover.Content>Help text</Popover.Content>
            </Popover>
          </Drawer>
        </>
      );
    }

    it('warns once when a controlled kept-mounted drawer closes while a popover inside is open', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { rerender } = render(<DrawerWithPopover open />);
        await user.click(button('Help'));
        expect(screen.getByText('Help text')).toBeInTheDocument();
        rerender(<DrawerWithPopover open={false} />);
        expect(warn).not.toHaveBeenCalled();
        act(() => {
          vi.advanceTimersByTime(0);
        });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(OPEN_INSIDE_WARNING);
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });

    it('does not warn when the closing press dismisses the popover (a trigger click)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const warn = vi.spyOn(console, 'warn');
      try {
        render(
          <Drawer title="Filters" modalType="non-modal" unmountOnClose={false}>
            <Drawer.Trigger>
              <button type="button">Open filters</button>
            </Drawer.Trigger>
            <Popover>
              <Popover.Trigger>
                <button type="button">Help</button>
              </Popover.Trigger>
              <Popover.Content>Help text</Popover.Content>
            </Popover>
          </Drawer>,
        );
        await user.click(button('Open filters'));
        await user.click(button('Help'));
        expect(screen.getByText('Help text')).toBeInTheDocument();
        await user.click(button('Open filters'));
        expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument();
        act(() => {
          vi.advanceTimersByTime(10);
        });
        expect(screen.queryByText('Help text')).not.toBeInTheDocument();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });

    it('does not warn with the default unmountOnClose: the popover unmounts with the content', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const warn = vi.spyOn(console, 'warn');
      try {
        const { rerender } = render(<DrawerWithPopover open unmountOnClose />);
        await user.click(button('Help'));
        rerender(<DrawerWithPopover open={false} unmountOnClose />);
        act(() => {
          vi.advanceTimersByTime(10);
        });
        expect(screen.queryByText('Help text')).not.toBeInTheDocument();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });
  });

  describe('development warnings name the kept-mounted state', () => {
    it('Drawer.Trigger:nested', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <Drawer title="Nested">
            <span>
              <Drawer.Trigger>
                <button type="button">Open</button>
              </Drawer.Trigger>
            </span>
          </Drawer>,
        );
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(NESTED_TRIGGER_WARNING);
      } finally {
        warn.mockRestore();
      }
    });

    it('Drawer:unreachable', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function FilterTrigger() {
        return (
          <Drawer.Trigger>
            <button type="button">Filters</button>
          </Drawer.Trigger>
        );
      }
      try {
        render(
          <Drawer title="Filters" unmountOnClose={false}>
            <FilterTrigger />
          </Drawer>,
        );
        // The trigger is hidden panel content, and warns as such at once; a second later the
        // drawer still has no way to open.
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenLastCalledWith(NESTED_TRIGGER_WARNING);
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(warn).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenLastCalledWith(
          '[WaveUI] Drawer has no way to open: a second after mounting it is still uncontrolled (no `open` prop), closed, and has no Drawer.Trigger as a direct child (or in a Fragment there). A Drawer.Trigger rendered by a component or nested in an element is panel content, which is not rendered or is hidden while the drawer is closed. Make the trigger a direct child of Drawer, or control the Drawer with `open`/`onOpenChange`.',
        );
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });
  });
});
