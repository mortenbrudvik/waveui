import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, type DialogProps } from '../Dialog';
import { Drawer } from '../Drawer';
import { Popover } from '../Popover';
import { Combobox } from '../../input/Combobox';
import { dialogContentClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import {
  expectNoA11yViolations,
  installResizeObserverMock,
  mockAnimations,
  mockRect,
} from '../../../test-utils';

/*
 * P6-07 D102–D104, D106, D109 (Dialog): the root's `unmountOnClose={false}` keeps `Dialog.Content`
 * mounted while closed, `hidden` and `inert` on every top-level element of its portal (the backdrop
 * and the positioner; the surface renders `data-presence`), so a form and the components inside
 * keep their state; everything modal keys on `open`; the portal moves to the top of the stack when
 * it opens; a popup left open inside it warns. D103: every Dialog surface mounts through the
 * presence core (`data-presence`), also by default.
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

const surface = () => document.querySelector<HTMLElement>('.' + dialogContentClassNames.root);
const backdrop = () => document.querySelector<HTMLElement>('.' + dialogContentClassNames.backdrop);
const positioner = () =>
  document.querySelector<HTMLElement>('.' + dialogContentClassNames.positioner);
const titleActions = () =>
  document.querySelector<HTMLElement>('.' + dialogContentClassNames.titleActions);
const nameField = () => screen.getByRole('textbox', { name: 'Name' });
const wrapperOf = (element: Element | null) => element?.closest('[data-wave-portal]') ?? null;

const OPEN_INSIDE_WARNING =
  '[WaveUI] Dialog closed while a popup opened inside it is still open. With `unmountOnClose={false}` the popup stays open over the page: close it first, or keep the default `unmountOnClose`.';

/** An uncontrolled Dialog with a trigger, a form, a freeform Combobox and a Dialog.Close; kept mounted. */
function FormDialog(props: Partial<DialogProps>) {
  return (
    <>
      <button type="button">Page button</button>
      <Dialog unmountOnClose={false} {...props}>
        <Dialog.Trigger>
          <button type="button">Edit profile</button>
        </Dialog.Trigger>
        <Dialog.Content title="Profile">
          <input aria-label="Name" />
          <Combobox aria-label="City" freeform>
            <Combobox.Option value="Oslo">Oslo</Combobox.Option>
            <Combobox.Option value="Bergen">Bergen</Combobox.Option>
          </Combobox>
          <Dialog.Footer>
            <Dialog.Close>
              <button type="button">Done</button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}

describe('Dialog unmountOnClose', () => {
  it('types unmountOnClose as an optional boolean on the root', () => {
    expectTypeOf<DialogProps['unmountOnClose']>().toEqualTypeOf<boolean | undefined>();
  });

  it('by default renders nothing while closed (the 0.10 behaviour)', () => {
    render(<FormDialog unmountOnClose={undefined} />);
    expect(surface()).toBeNull();
    expect(backdrop()).toBeNull();
    expect(positioner()).toBeNull();
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  });

  it('keeps a never-opened surface mounted: the backdrop and the positioner hidden and inert, no layer, isolation or scroll lock', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<FormDialog onOpenChange={onOpenChange} />);
    // Mounted with the Dialog, closed: every top-level element of the portal is hidden and inert.
    for (const element of [backdrop(), positioner()]) {
      expect(element).not.toBeNull();
      expect(element?.parentElement).toHaveAttribute('data-wave-portal');
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
      expect(element).toHaveAttribute('data-presence', 'exited');
    }
    expect(backdrop()?.nextElementSibling).toBe(positioner());
    // The surface (the element that receives className) renders the phase as well.
    expect(surface()).toHaveAttribute('data-presence', 'exited');
    expect(surface()?.parentElement).toBe(positioner());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { hidden: true })).toBe(surface());
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    // Nothing modal while closed.
    expect(getTopmostLayer()).toBeNull();
    expect(button('Page button').closest('[inert]')).toBeNull();
    expect(button('Edit profile').closest('[inert]')).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    button('Page button').focus();
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Page button')).toHaveFocus();
  });

  it('renders data-presence="entered" on the backdrop, the positioner and the surface while open', async () => {
    const user = userEvent.setup();
    render(<FormDialog />);
    await user.click(button('Edit profile'));
    const dialog = screen.getByRole('dialog', { name: 'Profile' });
    expect(dialog).toBe(surface());
    for (const element of [backdrop(), positioner(), dialog]) {
      expect(element).toHaveAttribute('data-presence', 'entered');
      expect(element).not.toHaveAttribute('hidden');
      expect(element).not.toHaveAttribute('inert');
    }
  });

  it.each([
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    [
      'the Close button',
      async (user: ReturnType<typeof userEvent.setup>) => user.click(button('Close')),
    ],
    ['the backdrop', async (user: ReturnType<typeof userEvent.setup>) => user.click(backdrop()!)],
    [
      'Dialog.Close',
      async (user: ReturnType<typeof userEvent.setup>) => user.click(button('Done')),
    ],
  ] as const)('keeps what was typed when closed with %s and opened again', async (_, close) => {
    const user = userEvent.setup();
    render(<FormDialog />);
    await user.click(button('Edit profile'));
    await user.type(nameField(), 'Ada');
    await close(user);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(positioner()).toHaveAttribute('hidden');
    await user.click(button('Edit profile'));
    expect(nameField()).toHaveValue('Ada');
  });

  it('keeps the state of a component inside: a freeform Combobox’s typed text', async () => {
    const user = userEvent.setup();
    render(<FormDialog />);
    await user.click(button('Edit profile'));
    const city = screen.getByRole('combobox', { name: 'City' });
    await user.type(city, 'Bergen');
    await user.click(button('Done'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(button('Edit profile'));
    expect(screen.getByRole('combobox', { name: 'City' })).toBe(city);
    expect(city).toHaveValue('Bergen');
  });

  it('starts over with the default unmountOnClose', async () => {
    const user = userEvent.setup();
    render(<FormDialog unmountOnClose />);
    await user.click(button('Edit profile'));
    await user.type(nameField(), 'Ada');
    await user.click(button('Done'));
    expect(surface()).toBeNull();
    await user.click(button('Edit profile'));
    expect(nameField()).toHaveValue('');
  });

  it('moves focus to the first focusable element on every open (no autoFocus inside), traps it, isolates the page, then restores it', async () => {
    const user = userEvent.setup();
    render(<FormDialog />);
    for (let round = 0; round < 2; round++) {
      await user.click(button('Edit profile'));
      // The trap's initial focus: the first focusable element, the built-in Close button.
      expect(button('Close')).toHaveFocus();
      expect(button('Page button').closest('[inert]')).not.toBeNull();
      expect(document.documentElement.style.overflow).toBe('hidden');
      await user.tab({ shift: true });
      expect(button('Done')).toHaveFocus();
      await user.tab();
      expect(button('Close')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(button('Edit profile')).toHaveFocus();
      expect(button('Page button').closest('[inert]')).toBeNull();
      expect(document.documentElement.style.overflow).toBe('');
    }
  });

  it('gives the trigger aria-expanded="false" and no aria-controls while kept closed', async () => {
    const user = userEvent.setup();
    render(<FormDialog />);
    const trigger = button('Edit profile');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', surface()!.id);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
  });

  it('measures the title-actions area only while open', async () => {
    const resizeObserver = installResizeObserverMock();
    try {
      const user = userEvent.setup();
      render(<FormDialog />);
      const area = titleActions()!;
      mockRect(area, { width: 40, height: 32 });
      const padding = () => surface()!.style.getPropertyValue('--wave-dialog-title-end-padding');
      resizeObserver.trigger(area);
      expect(padding()).toBe('');
      await user.click(button('Edit profile'));
      resizeObserver.trigger(area);
      expect(padding()).toBe('48px');
      await user.keyboard('{Escape}');
      expect(padding()).toBe('');
      resizeObserver.trigger(area);
      expect(padding()).toBe('');
    } finally {
      resizeObserver.restore();
    }
  });

  it('has no axe violations while kept closed and while open', async () => {
    const user = userEvent.setup();
    render(<FormDialog />);
    await expectNoA11yViolations(document.body);
    await user.click(button('Edit profile'));
    await expectNoA11yViolations(document.body);
  });

  it('calls onOpenChange once per change under StrictMode and renders one portal wrapper', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <FormDialog onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    expect(document.querySelectorAll('[data-wave-portal]')).toHaveLength(1);
    await user.click(button('Edit profile'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ reason: 'trigger' }),
    );
    expect(button('Close')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'escape' }),
    );
    expect(document.querySelectorAll('[data-wave-portal]')).toHaveLength(1);
    expect(button('Edit profile')).toHaveFocus();
  });

  describe('server rendering', () => {
    it('renders only the trigger on the server, then the hidden surface in <body> after hydration', async () => {
      const onOpenChange = vi.fn();
      const element = <FormDialog onOpenChange={onOpenChange} />;
      const html = renderToString(element);
      expect(html).toContain('Edit profile');
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
        const hiddenSurface = surface();
        expect(hiddenSurface).not.toBeNull();
        expect(container).not.toContainElement(hiddenSurface);
        expect(positioner()).toHaveAttribute('hidden');
        expect(hiddenSurface).toHaveAttribute('data-presence', 'exited');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });
  });

  describe('presence (D103)', () => {
    it('keeps an exiting surface mounted and inert while its motion runs, the layer already released, then hides it', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      const onDrawerOpenChange = vi.fn();
      render(
        <Drawer open onOpenChange={onDrawerOpenChange} title="Rows">
          <Dialog unmountOnClose={false}>
            <Dialog.Trigger>
              <button type="button">Delete row</button>
            </Dialog.Trigger>
            <Dialog.Content title="Confirm" data-test-motion="">
              <button type="button">Delete</button>
            </Dialog.Content>
          </Dialog>
        </Drawer>,
      );
      await user.click(button('Delete row'));
      // The surface's own motion decides; the backdrop and the positioner show its phase.
      for (const element of [backdrop(), positioner(), surface()]) {
        expect(element).toHaveAttribute('data-presence', 'entering');
      }
      await act(async () => {
        await motion.finishAll();
      });
      expect(surface()).toHaveAttribute('data-presence', 'entered');

      await user.keyboard('{Escape}');
      // Exiting: mounted and inert; the focus restore and the layer did not wait for the motion.
      const exiting = surface();
      for (const element of [backdrop(), positioner()]) {
        expect(element).toHaveAttribute('data-presence', 'exiting');
        expect(element).toHaveAttribute('inert');
        expect(element).not.toHaveAttribute('hidden');
      }
      expect(exiting).toHaveAttribute('data-presence', 'exiting');
      expect(button('Delete row')).toHaveFocus();
      expect(getTopmostLayer()?.kind).toBe('modal');
      expect(getTopmostLayer()?.getElements()).toContain(
        screen.getByRole('dialog', { name: 'Rows' }),
      );
      // Escape reaches the layer below.
      await user.keyboard('{Escape}');
      expect(onDrawerOpenChange).toHaveBeenCalledTimes(1);
      expect(onDrawerOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'escape' }),
      );

      await act(async () => {
        await motion.finishAll();
      });
      expect(surface()).toBe(exiting);
      expect(exiting).toHaveAttribute('data-presence', 'exited');
      for (const element of [backdrop(), positioner()]) {
        expect(element).toHaveAttribute('data-presence', 'exited');
        expect(element).toHaveAttribute('hidden');
        expect(element).toHaveAttribute('inert');
      }
    });

    it('unmounts an exiting surface once its motion ends with the default unmountOnClose', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      render(
        <Dialog>
          <Dialog.Trigger>
            <button type="button">Open</button>
          </Dialog.Trigger>
          <Dialog.Content title="Order" data-test-motion="">
            Body
          </Dialog.Content>
        </Dialog>,
      );
      await user.click(button('Open'));
      await act(async () => {
        await motion.finishAll();
      });
      await user.keyboard('{Escape}');
      expect(surface()).toHaveAttribute('data-presence', 'exiting');
      expect(positioner()).toHaveAttribute('inert');
      expect(button('Open')).toHaveFocus();
      expect(getTopmostLayer()).toBeNull();
      await act(async () => {
        await motion.finishAll();
      });
      expect(surface()).toBeNull();
      expect(document.querySelector('[data-wave-portal]')).toBeNull();
    });

    it('unmounts a surface without motion in the same act() as the close', async () => {
      const user = userEvent.setup();
      render(<FormDialog unmountOnClose />);
      await user.click(button('Edit profile'));
      expect(surface()).toHaveAttribute('data-presence', 'entered');
      await user.keyboard('{Escape}');
      expect(surface()).toBeNull();
    });
  });

  describe('stacking (D104)', () => {
    /** A Dialog rendered beside an open Drawer and opened from inside it (a confirm for a row). */
    function DialogBesideDrawer({ unmountOnClose }: { unmountOnClose: boolean }) {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <Dialog open={open} onOpenChange={setOpen} unmountOnClose={unmountOnClose}>
            <Dialog.Content title="Delete row?">
              <Dialog.Close>
                <button type="button">Cancel</button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
          <Drawer defaultOpen title="Rows">
            <button type="button" onClick={() => setOpen(true)}>
              Delete row
            </button>
          </Drawer>
        </>
      );
    }

    it('moves its portal to the end of <body> when it opens, above the Drawer it was mounted before', async () => {
      const user = userEvent.setup();
      render(<DialogBesideDrawer unmountOnClose={false} />);
      const dialogWrapper = wrapperOf(surface());
      const drawerWrapper = wrapperOf(screen.getByRole('dialog', { name: 'Rows' }));
      expect(dialogWrapper).not.toBeNull();
      expect(document.body.lastElementChild).toBe(drawerWrapper);
      const append = vi.spyOn(document.body, 'appendChild');
      try {
        await user.click(button('Delete row'));
        expect(append).toHaveBeenCalledTimes(1);
        expect(append).toHaveBeenCalledWith(dialogWrapper);
      } finally {
        append.mockRestore();
      }
      expect(document.body.lastElementChild).toBe(dialogWrapper);
      const dialog = screen.getByRole('dialog', { name: 'Delete row?' });
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
      // The Drawer behind it is inert; the Dialog is not.
      expect(drawerWrapper).toHaveAttribute('inert');
      expect(dialog.closest('[inert]')).toBeNull();
      // Escape closes the dialog first, then the drawer.
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Delete row?' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Rows' })).toBeInTheDocument();
      expect(button('Delete row')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Rows' })).not.toBeInTheDocument();
    });

    it('does not move an unmounting dialog, which React appends when it opens', async () => {
      const user = userEvent.setup();
      render(<DialogBesideDrawer unmountOnClose />);
      const append = vi.spyOn(document.body, 'appendChild');
      try {
        await user.click(button('Delete row'));
        const dialogWrapper = wrapperOf(screen.getByRole('dialog', { name: 'Delete row?' }));
        expect(append.mock.calls.filter(([node]) => node === dialogWrapper)).toHaveLength(1);
        expect(document.body.lastElementChild).toBe(dialogWrapper);
      } finally {
        append.mockRestore();
      }
    });
  });

  describe('a popup left open inside (D106)', () => {
    function DialogWithPopover({
      open,
      unmountOnClose = false,
    }: {
      open: boolean;
      unmountOnClose?: boolean;
    }) {
      return (
        <Dialog open={open} onOpenChange={() => {}} unmountOnClose={unmountOnClose}>
          <Dialog.Content title="Profile">
            <Popover>
              <Popover.Trigger>
                <button type="button">Help</button>
              </Popover.Trigger>
              <Popover.Content>Help text</Popover.Content>
            </Popover>
          </Dialog.Content>
        </Dialog>
      );
    }

    it('warns once when a controlled kept-mounted dialog closes while a popover inside is open', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { rerender } = render(<DialogWithPopover open />);
        await user.click(button('Help'));
        expect(screen.getByText('Help text')).toBeInTheDocument();
        rerender(<DialogWithPopover open={false} />);
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

    it('does not warn with the default unmountOnClose: the popover unmounts with the content', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const warn = vi.spyOn(console, 'warn');
      try {
        const { rerender } = render(<DialogWithPopover open unmountOnClose />);
        await user.click(button('Help'));
        rerender(<DialogWithPopover open={false} unmountOnClose />);
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

    it('does not warn when nothing inside is open', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const warn = vi.spyOn(console, 'warn');
      try {
        const { rerender } = render(<DialogWithPopover open />);
        rerender(<DialogWithPopover open={false} />);
        act(() => {
          vi.advanceTimersByTime(10);
        });
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });
  });
});
