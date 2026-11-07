import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from '../Menu';
import type { MenuOpenChangeDetails, MenuProps } from '../Menu';
import { useMenuContext } from '../Menu.hooks';
import { expectNoA11yViolations, mockRect } from '../../../test-utils';
import { WaveProvider } from '../../provider/WaveProvider';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const trigger = () => screen.getByRole('button', { name: 'Actions' });
const queryMenu = () => screen.queryByRole('menu');

function PopupMenu(props: Partial<MenuProps>) {
  return (
    <Menu {...props}>
      <Menu.Trigger>
        <button type="button">Actions</button>
      </Menu.Trigger>
      <Menu.Popover aria-label="Actions menu">
        <Menu.Item>Edit</Menu.Item>
        <Menu.Item>Copy</Menu.Item>
      </Menu.Popover>
    </Menu>
  );
}

/** The `[open, reason, event type]` of every call. */
function summarise(onOpenChange: { mock: { calls: unknown[][] } }) {
  return onOpenChange.mock.calls.map(([open, details]) => {
    const { reason, event } = details as MenuOpenChangeDetails;
    return [open, reason, event.type];
  });
}

describe('Menu onOpenChange details (menu-5)', () => {
  it('passes the reason and the click for a trigger click, open and close', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<PopupMenu onOpenChange={onOpenChange} />);
    await user.click(trigger());
    await user.click(trigger());
    expect(summarise(onOpenChange)).toEqual([
      [true, 'trigger-click', 'click'],
      [false, 'trigger-click', 'click'],
    ]);
    const [, details] = onOpenChange.mock.calls[0] as [boolean, MenuOpenChangeDetails];
    expect(details.event).toBeInstanceOf(Event);
  });

  it('reports the key behind an opening and a toggle through Enter', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<PopupMenu onOpenChange={onOpenChange} />);
    trigger().focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(summarise(onOpenChange)).toEqual([
      [true, 'trigger-key', 'keydown'],
      [false, 'escape', 'keydown'],
      [true, 'trigger-key', 'keydown'],
      // Enter on the trigger opened the menu and moved focus to its first item: Enter activates it.
      [false, 'item-click', 'click'],
    ]);
  });

  it('reports an item activation as item-click with its click, Tab as tab, an outside press as outside-press', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <>
        <PopupMenu onOpenChange={onOpenChange} />
        <div data-testid="outside">Elsewhere</div>
      </>,
    );
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(trigger());
    await user.keyboard('{Tab}');
    await user.click(trigger());
    await user.click(screen.getByTestId('outside'));
    expect(summarise(onOpenChange)).toEqual([
      [true, 'trigger-click', 'click'],
      [false, 'item-click', 'click'],
      [true, 'trigger-click', 'click'],
      [false, 'tab', 'keydown'],
      [true, 'trigger-click', 'click'],
      [false, 'outside-press', 'click'],
    ]);
  });

  it('reports Enter on an item as an item-click whose event is the click it caused', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<PopupMenu onOpenChange={onOpenChange} />);
    await user.click(trigger());
    await user.keyboard('{Enter}');
    expect(summarise(onOpenChange)).toEqual([
      [true, 'trigger-click', 'click'],
      [false, 'item-click', 'click'],
    ]);
  });

  it('close() of useMenuContext reports item-click with an event, also as a click handler', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Own() {
      const { close } = useMenuContext();
      return (
        <div role="menuitem" tabIndex={-1} onClick={close}>
          Own
        </div>
      );
    }
    render(
      <Menu onOpenChange={onOpenChange}>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover aria-label="Actions menu">
          <Own />
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Own' }));
    const [, details] = onOpenChange.mock.calls[1] as [boolean, MenuOpenChangeDetails];
    expect(details.reason).toBe('item-click');
    expect(details.event.type).toBe('click');
  });

  it('reports a submenu closed with ArrowLeft as arrow-key, and the chain closing as one reason', async () => {
    const user = userEvent.setup();
    const onRoot = vi.fn();
    const onSub = vi.fn();
    render(
      <Menu onOpenChange={onRoot}>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover aria-label="Actions menu">
          <Menu onOpenChange={onSub}>
            <Menu.Trigger>
              <Menu.Item>More</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover aria-label="More menu">
              <Menu.Item>Deep</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Escape}');
    // Escape closes the layer on top: the submenu; the next one closes the root.
    await user.keyboard('{Escape}');
    expect(summarise(onSub)).toEqual([
      [true, 'trigger-key', 'keydown'],
      [false, 'arrow-key', 'keydown'],
      [true, 'trigger-key', 'keydown'],
      [false, 'escape', 'keydown'],
    ]);
    expect(summarise(onRoot)).toEqual([
      [true, 'trigger-click', 'click'],
      [false, 'escape', 'keydown'],
    ]);
  });

  it('gives a closing parent’s reason to the submenus that close with it', async () => {
    const user = userEvent.setup();
    const onRoot = vi.fn();
    const onSub = vi.fn();
    render(
      <Menu onOpenChange={onRoot}>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover aria-label="Actions menu">
          <Menu onOpenChange={onSub}>
            <Menu.Trigger>
              <Menu.Item>More</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover aria-label="More menu">
              <Menu.Item>Deep</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByRole('menuitem', { name: 'Deep' }));
    expect(summarise(onSub)).toEqual([
      [true, 'trigger-key', 'keydown'],
      [false, 'item-click', 'click'],
    ]);
    expect(summarise(onRoot)).toEqual([
      [true, 'trigger-click', 'click'],
      [false, 'item-click', 'click'],
    ]);
  });

  it('reports parent for an uncontrolled submenu that closes because its parent was closed from outside', async () => {
    const user = userEvent.setup();
    const onSub = vi.fn();
    function Harness({ open }: { open: boolean }) {
      return (
        <Menu open={open}>
          <Menu.Trigger>
            <button type="button">Actions</button>
          </Menu.Trigger>
          <Menu.Popover aria-label="Actions menu">
            <Menu onOpenChange={onSub}>
              <Menu.Trigger>
                <Menu.Item>More</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover aria-label="More menu">
                <Menu.Item>Deep</Menu.Item>
              </Menu.Popover>
            </Menu>
          </Menu.Popover>
        </Menu>
      );
    }
    const { rerender } = render(<Harness open />);
    await act(async () => {});
    screen.getByRole('menuitem', { name: 'More' }).focus();
    await user.keyboard('{ArrowRight}');
    rerender(<Harness open={false} />);
    await act(async () => {});
    expect(summarise(onSub)).toEqual([
      [true, 'trigger-key', 'keydown'],
      [false, 'parent', 'parent-close'],
    ]);
  });

  it('reports hover openings and closings with the pointer event', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenChange = vi.fn();
    render(
      <>
        <PopupMenu openOnHover onOpenChange={onOpenChange} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.hover(trigger());
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await user.hover(screen.getByRole('button', { name: 'Elsewhere' }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const calls = onOpenChange.mock.calls as Array<[boolean, MenuOpenChangeDetails]>;
    expect(calls.map(([open, { reason }]) => [open, reason])).toEqual([
      [true, 'hover'],
      [false, 'hover'],
    ]);
    expect(calls[0][1].event.type).toMatch(/^pointer/);
  });

  it('reports a context gesture as context-menu, and a scroll that moves the anchor as scroll', async () => {
    const onOpenChange = vi.fn();
    render(
      <Menu openOnContext onOpenChange={onOpenChange}>
        <Menu.Trigger>
          <div data-testid="region">Files</div>
        </Menu.Trigger>
        <Menu.Popover aria-label="File actions">
          <Menu.Item>Open</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    const region = screen.getByTestId('region');
    mockRect(region, { top: 10, left: 10, width: 100, height: 100 });
    fireEvent.contextMenu(region, { button: 2, clientX: 20, clientY: 20 });
    await act(async () => {});
    mockRect(region, { top: 80, left: 10, width: 100, height: 100 });
    fireEvent.scroll(document.body);
    await act(async () => {});
    expect(summarise(onOpenChange)).toEqual([
      [true, 'context-menu', 'contextmenu'],
      [false, 'scroll', 'scroll'],
    ]);
  });

  it('calls onOpenChange once per change in StrictMode', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <PopupMenu onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(summarise(onOpenChange)).toEqual([
      [true, 'trigger-click', 'click'],
      [false, 'escape', 'keydown'],
    ]);
  });

  it('keeps a callback written for one argument working', async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    render(<PopupMenu onOpenChange={(open) => seen.push(open)} />);
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(seen).toEqual([true, false]);
  });
});

describe('Menu closeOnScroll (menu-5)', () => {
  it('closes the menu when the page or an unrelated element scrolls, with reason scroll', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <>
        <div data-testid="panel" />
        <PopupMenu closeOnScroll onOpenChange={onOpenChange} />
      </>,
    );
    await user.click(trigger());
    fireEvent.scroll(screen.getByTestId('panel'));
    await act(async () => {});
    expect(queryMenu()).not.toBeInTheDocument();
    expect(summarise(onOpenChange)).toEqual([
      [true, 'trigger-click', 'click'],
      [false, 'scroll', 'scroll'],
    ]);
  });

  it('ignores a scroll inside the menu and of the trigger’s own element', async () => {
    const user = userEvent.setup();
    render(<PopupMenu closeOnScroll />);
    await user.click(trigger());
    fireEvent.scroll(screen.getByRole('menu'));
    fireEvent.scroll(trigger());
    await act(async () => {});
    expect(queryMenu()).toBeInTheDocument();
  });

  it('does nothing without the prop', async () => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    await user.click(trigger());
    fireEvent.scroll(document.body);
    await act(async () => {});
    expect(queryMenu()).toBeInTheDocument();
  });

  it('closes the whole chain, submenus included', async () => {
    const user = userEvent.setup();
    const onSub = vi.fn();
    render(
      <Menu closeOnScroll>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover aria-label="Actions menu">
          <Menu onOpenChange={onSub}>
            <Menu.Trigger>
              <Menu.Item>More</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover aria-label="More menu">
              <Menu.Item>Deep</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    await user.keyboard('{ArrowRight}');
    fireEvent.scroll(document.body);
    await act(async () => {});
    expect(queryMenu()).not.toBeInTheDocument();
    expect(summarise(onSub)).toEqual([
      [true, 'trigger-key', 'keydown'],
      [false, 'scroll', 'scroll'],
    ]);
  });
});

describe('Menu inline and mountNode (menu-4)', () => {
  it('renders the popover where the menu is rendered, positioned absolutely, with no portal', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div data-testid="host">
        <PopupMenu inline />
      </div>,
    );
    await user.click(trigger());
    const menu = screen.getByRole('menu');
    expect(container.contains(menu)).toBe(true);
    expect(menu.closest('[data-wave-portal]')).toBeNull();
    expect(menu.style.position).toBe('absolute');
    expect(menu.style.zIndex).toContain('--wave-z-overlay');
    expect(trigger()).toHaveAttribute('aria-controls', menu.id);
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('keeps the default, portaled and fixed, without inline', async () => {
    const user = userEvent.setup();
    const { container } = render(<PopupMenu />);
    await user.click(trigger());
    const menu = screen.getByRole('menu');
    expect(container.contains(menu)).toBe(false);
    expect(menu.closest('[data-wave-portal]')).not.toBeNull();
    expect(menu.style.position).toBe('fixed');
  });

  it('opens a submenu of an inline menu inline too, and activation closes the chain', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(
      <Menu inline>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover aria-label="Actions menu">
          <Menu>
            <Menu.Trigger>
              <Menu.Item>More</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover aria-label="More menu">
              <Menu.Item onClick={onSelect}>Deep</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    await user.keyboard('{ArrowRight}');
    const sub = screen.getByRole('menu', { name: 'More menu' });
    expect(container.contains(sub)).toBe(true);
    expect(sub.closest('[data-wave-portal]')).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Deep' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('portals into mountNode, with the theme wrapper, and a submenu inherits it', async () => {
    const user = userEvent.setup();
    const mount = document.createElement('div');
    mount.setAttribute('data-testid', 'mount');
    document.body.appendChild(mount);
    try {
      render(
        <Menu mountNode={mount}>
          <Menu.Trigger>
            <button type="button">Actions</button>
          </Menu.Trigger>
          <Menu.Popover aria-label="Actions menu">
            <Menu>
              <Menu.Trigger>
                <Menu.Item>More</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover aria-label="More menu">
                <Menu.Item>Deep</Menu.Item>
              </Menu.Popover>
            </Menu>
          </Menu.Popover>
        </Menu>,
      );
      await user.click(trigger());
      expect(mount.contains(screen.getByRole('menu', { name: 'Actions menu' }))).toBe(true);
      await user.keyboard('{ArrowRight}');
      expect(mount.contains(screen.getByRole('menu', { name: 'More menu' }))).toBe(true);
      await user.keyboard('{Escape}{Escape}');
    } finally {
      mount.remove();
    }
  });

  it('prefers mountNode over WaveProvider’s portalContainer, and a null one falls back', async () => {
    const user = userEvent.setup();
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      render(
        <WaveProvider portalContainer={container}>
          <PopupMenu mountNode={null} />
        </WaveProvider>,
      );
      await user.click(trigger());
      expect(container.contains(screen.getByRole('menu'))).toBe(true);
    } finally {
      await user.keyboard('{Escape}');
      container.remove();
    }
  });

  it('has no axe violations while open inline', async () => {
    const user = userEvent.setup();
    render(<PopupMenu inline />);
    await user.click(trigger());
    await expectNoA11yViolations(document.body);
  });
});

describe('Menu.Popover id (follow-up: aria-controls for a target toggle)', () => {
  it('renders the id you give it, and the trigger points aria-controls at it', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover id="my-menu" aria-label="Actions menu">
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    expect(screen.getByRole('menu')).toHaveAttribute('id', 'my-menu');
    expect(trigger()).toHaveAttribute('aria-controls', 'my-menu');
  });

  it('lets a toggle button that is the target of a controlled menu point at it', async () => {
    function Controlled() {
      const [open, setOpen] = React.useState(false);
      const [button, setButton] = React.useState<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            type="button"
            ref={setButton}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? 'toggle-menu' : undefined}
            onClick={() => setOpen((value) => !value)}
          >
            Actions
          </button>
          <Menu open={open} onOpenChange={setOpen}>
            <Menu.Popover id="toggle-menu" target={button} aria-label="Actions menu">
              <Menu.Item>Edit</Menu.Item>
            </Menu.Popover>
          </Menu>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-controls', screen.getByRole('menu').id);
    expect(screen.getByRole('menu')).toHaveAttribute('id', 'toggle-menu');
    await expectNoA11yViolations(document.body);
  });

  it('falls back to the generated id when the consumer drops its id', async () => {
    const user = userEvent.setup();
    function Switching({ id }: { id: string | undefined }) {
      return (
        <Menu>
          <Menu.Trigger>
            <button type="button">Actions</button>
          </Menu.Trigger>
          <Menu.Popover id={id} aria-label="Actions menu">
            <Menu.Item>Edit</Menu.Item>
          </Menu.Popover>
        </Menu>
      );
    }
    const { rerender } = render(<Switching id="mine" />);
    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-controls', 'mine');
    rerender(<Switching id={undefined} />);
    const menu = screen.getByRole('menu');
    expect(menu.id).not.toBe('mine');
    expect(trigger()).toHaveAttribute('aria-controls', menu.id);
  });
});
