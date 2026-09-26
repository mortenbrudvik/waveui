import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'react-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Menu } from '../Menu';
import type { MenuProps } from '../Menu';
import { MenuButton } from '../../button/MenuButton';
import { Tooltip } from '../../overlays/Tooltip';
import { expectNoA11yViolations, mockRect } from '../../../test-utils';

let user: UserEvent;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  try {
    // Every test that expects a warning asserts and clears it.
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

/** Advances the fake clock inside act() (the hover timers set state). */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const item = (name: string) => screen.getByRole('menuitem', { name });
const menu = (name: string) => screen.getByRole('menu', { name });
const queryMenu = (name: string) => screen.queryByRole('menu', { name });
const button = (name: string) => screen.getByRole('button', { name });

interface FileMenuProps {
  root?: Partial<MenuProps>;
  recent?: Partial<MenuProps>;
  share?: Partial<MenuProps>;
  onItem?: (name: string) => void;
}

/** A click-opened File menu with two submenus ("Open recent", "Share") in its list. */
function FileMenu({ root, recent, share, onItem }: FileMenuProps) {
  const leaf = (name: string) => (
    <Menu.Item key={name} onClick={() => onItem?.(name)}>
      {name}
    </Menu.Item>
  );
  return (
    <>
      <Menu {...root}>
        <Menu.Trigger>
          <button type="button">File</button>
        </Menu.Trigger>
        <Menu.Popover>
          {leaf('New')}
          <Menu {...recent}>
            <Menu.Trigger>
              <Menu.Item>Open recent</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              {leaf('report.docx')}
              {leaf('notes.txt')}
            </Menu.Popover>
          </Menu>
          <Menu {...share}>
            <Menu.Trigger>
              <Menu.Item>Share</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>{leaf('Email')}</Menu.Popover>
          </Menu>
          {leaf('Exit')}
        </Menu.Popover>
      </Menu>
      <button type="button">Elsewhere</button>
    </>
  );
}

/** A root popup menu that opens on hover. */
function HoverMenu(props: Partial<MenuProps>) {
  return (
    <>
      <Menu openOnHover {...props}>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item>Copy</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
      <button type="button">Elsewhere</button>
    </>
  );
}

describe('hover opening of submenus', () => {
  it('opens openDelay after its item is hovered, without taking focus, and closes closeDelay after the pointer leaves both', async () => {
    const onOpenChange = vi.fn();
    render(<FileMenu recent={{ onOpenChange }} />);
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    // Focus follows the mouse inside the menu, but not into the submenu.
    expect(item('Open recent')).toHaveFocus();
    advance(150);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    advance(200);
    expect(menu('Open recent')).toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
    expect(item('Open recent')).toHaveAttribute('aria-expanded', 'true');

    await user.unhover(item('Open recent'));
    advance(150);
    expect(menu('Open recent')).toBeInTheDocument();
    advance(200);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('a diagonal path across a sibling trigger keeps the submenu open, opens nothing else and moves no focus', async () => {
    render(<FileMenu />);
    await user.click(button('File'));
    // Root items: "Open recent" at y 30–60 and "Share" at y 60–90 (x 0–200); the submenu opens at
    // x 200–400, y 30–200.
    mockRect(item('Open recent'), { x: 0, y: 30, width: 200, height: 30 });
    mockRect(item('Share'), { x: 0, y: 60, width: 200, height: 30 });
    await user.pointer({ target: item('Open recent'), coords: { clientX: 190, clientY: 45 } });
    advance(300);
    mockRect(menu('Open recent'), { x: 200, y: 30, width: 200, height: 170 });
    expect(item('Open recent')).toHaveFocus();

    // Out through "Share", then down and to the right inside the triangle.
    await user.pointer({ target: item('Share'), coords: { clientX: 190, clientY: 62 } });
    for (const [x, y] of [
      [192, 70],
      [194, 80],
      [195, 85],
    ]) {
      advance(100);
      await user.pointer({ target: item('Share'), coords: { clientX: x, clientY: y } });
    }
    expect(item('Open recent')).toHaveFocus();
    expect(menu('Open recent')).toBeInTheDocument();
    expect(queryMenu('Share')).not.toBeInTheDocument();

    // Into the submenu: its item takes focus (focus is inside the menu tree).
    advance(100);
    await user.pointer({ target: item('report.docx'), coords: { clientX: 210, clientY: 95 } });
    expect(item('report.docx')).toHaveFocus();
    advance(1000);
    expect(menu('Open recent')).toBeInTheDocument();
    expect(queryMenu('Share')).not.toBeInTheDocument();
  });

  it('openOnHover={false} on a submenu keeps it closed on hover', async () => {
    render(<FileMenu recent={{ openOnHover: false }} />);
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(1000);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    // Its other openings still work.
    await user.keyboard('{ArrowRight}');
    expect(item('report.docx')).toHaveFocus();
  });

  it('a disabled trigger item does not open its submenu on hover', async () => {
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">File</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>New</Menu.Item>
          <Menu>
            <Menu.Trigger>
              <Menu.Item disabled>Share</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Email</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(button('File'));
    await user.hover(item('Share'));
    advance(1000);
    expect(queryMenu('Share')).not.toBeInTheDocument();
  });

  it.each(['touch', 'pen'] as const)('%s pointers open nothing and move no focus', async (type) => {
    render(<FileMenu />);
    await user.click(button('File'));
    const recent = item('Open recent');
    act(() => {
      recent.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: type }));
      recent.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: type }));
    });
    advance(1000);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('New')).toHaveFocus();
  });

  it('resting on a sibling trigger item outside the safe zone opens its submenu and closes the open one, each reporting once', async () => {
    const onRecentOpenChange = vi.fn();
    const onShareOpenChange = vi.fn();
    render(
      <FileMenu
        recent={{ onOpenChange: onRecentOpenChange }}
        share={{ onOpenChange: onShareOpenChange }}
      />,
    );
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(300);
    expect(menu('Open recent')).toBeInTheDocument();
    // No safe zone (the submenu has no size in jsdom): the pointer rests on "Share".
    await user.hover(item('Share'));
    advance(300);
    expect(menu('Share')).toBeInTheDocument();
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(onRecentOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(onShareOpenChange.mock.calls).toEqual([[true]]);
  });

  it('a submenu inherits its parent’s delays', async () => {
    render(<FileMenu root={{ openDelay: 400, closeDelay: 100 }} />);
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(300);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    advance(200);
    expect(menu('Open recent')).toBeInTheDocument();
    await user.unhover(item('Open recent'));
    advance(250);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
  });

  it('a static menu’s delays reach its hover submenu', async () => {
    render(
      <Menu aria-label="Edit" closeDelay={500}>
        <Menu.Item>Cut</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Paste special</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Text only</Menu.Item>
          </Menu.Popover>
        </Menu>
      </Menu>,
    );
    await user.hover(item('Paste special'));
    advance(300);
    expect(menu('Paste special')).toBeInTheDocument();
    await user.unhover(item('Paste special'));
    advance(400);
    expect(menu('Paste special')).toBeInTheDocument();
    advance(200);
    expect(queryMenu('Paste special')).not.toBeInTheDocument();
  });

  it('StrictMode: a hover opening and closing each report once', async () => {
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <FileMenu recent={{ onOpenChange }} />
      </React.StrictMode>,
    );
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(300);
    await user.unhover(item('Open recent'));
    advance(300);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('has no axe violations with a hover-opened submenu', async () => {
    render(<FileMenu />);
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(300);
    expect(menu('Open recent')).toBeInTheDocument();
    await expectNoA11yViolations();
  });
});

describe('focus follows the mouse inside a focused menu tree', () => {
  it('with focus in the root list, hovering a submenu item focuses it and Enter activates it', async () => {
    const onItem = vi.fn();
    render(<FileMenu onItem={onItem} />);
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(300);
    await user.hover(item('notes.txt'));
    expect(item('notes.txt')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onItem.mock.calls).toEqual([['notes.txt']]);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('File')).toHaveFocus();
  });

  it('hovering a sibling item outside the safe zone focuses it; the submenu closes after closeDelay, and hovering it again keeps it', async () => {
    render(<FileMenu />);
    await user.click(button('File'));
    await user.click(item('Open recent'));
    expect(item('report.docx')).toHaveFocus();

    await user.hover(item('Exit'));
    expect(item('Exit')).toHaveFocus();
    await act(async () => {});
    // Not at once: it has become a hover-opened submenu.
    expect(menu('Open recent')).toBeInTheDocument();
    advance(150);
    // Back into it before closeDelay: it stays.
    await user.hover(item('notes.txt'));
    advance(1000);
    expect(menu('Open recent')).toBeInTheDocument();
    expect(item('notes.txt')).toHaveFocus();

    await user.hover(item('Exit'));
    await act(async () => {});
    advance(150);
    expect(menu('Open recent')).toBeInTheDocument();
    advance(200);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('Exit')).toHaveFocus();
  });

  it('a click-opened submenu with openOnHover={false} closes at once when the pointer focuses a sibling item', async () => {
    const onOpenChange = vi.fn();
    render(<FileMenu recent={{ openOnHover: false, onOpenChange }} />);
    await user.click(button('File'));
    await user.click(item('Open recent'));
    expect(item('report.docx')).toHaveFocus();

    await user.hover(item('Exit'));
    expect(item('Exit')).toHaveFocus();
    await act(async () => {});
    // It has no hover close to hand over to: it closes as a keyboard focus move closes it.
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('Open recent')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Exit')).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('Escape on the trigger item of a hover-opened submenu closes only the submenu; focus stays', async () => {
    render(<FileMenu />);
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(300);
    expect(menu('Open recent')).toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(menu('File')).toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
    // Dismissed stays dismissed while the pointer rests on the item.
    advance(1000);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
  });

  it('ArrowDown to a sibling item closes a hover-opened submenu at once', async () => {
    render(<FileMenu />);
    await user.click(button('File'));
    await user.hover(item('Open recent'));
    advance(300);
    expect(menu('Open recent')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(item('Share')).toHaveFocus();
    await act(async () => {});
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
  });

  it('a static menu the user is not in takes no focus from hover; once in it, the hovered item does', async () => {
    render(
      <>
        <button type="button">Before</button>
        <Menu aria-label="Edit">
          <Menu.Item>Cut</Menu.Item>
          <Menu.Item>Copy</Menu.Item>
        </Menu>
      </>,
    );
    act(() => button('Before').focus());
    await user.hover(item('Copy'));
    expect(button('Before')).toHaveFocus();
    act(() => item('Cut').focus());
    await user.unhover(item('Copy'));
    await user.hover(item('Copy'));
    expect(item('Copy')).toHaveFocus();
  });
});

describe('a root menu with openOnHover', () => {
  it('opens on hover without taking focus; hovering its items moves no focus; it closes after the pointer leaves', async () => {
    const onOpenChange = vi.fn();
    render(<HoverMenu onOpenChange={onOpenChange} />);
    await user.hover(button('Actions'));
    advance(300);
    expect(menu('Actions')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.hover(item('Copy'));
    expect(document.body).toHaveFocus();
    await user.hover(button('Elsewhere'));
    advance(300);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('a click on its trigger pins it and focuses its first item', async () => {
    render(<HoverMenu />);
    await user.hover(button('Actions'));
    advance(300);
    await user.click(button('Actions'));
    expect(menu('Actions')).toBeInTheDocument();
    expect(item('Edit')).toHaveFocus();
    await user.hover(button('Elsewhere'));
    advance(1000);
    expect(menu('Actions')).toBeInTheDocument();
  });

  it.each([
    ['Enter', '{Enter}', 'Edit'],
    ['ArrowDown', '{ArrowDown}', 'Edit'],
    ['ArrowUp', '{ArrowUp}', 'Delete'],
  ])('%s on its trigger pins it and focuses an item', async (_n, key, focused) => {
    render(<HoverMenu />);
    act(() => button('Actions').focus());
    await user.hover(button('Actions'));
    advance(300);
    expect(button('Actions')).toHaveFocus();
    await user.keyboard(key);
    expect(item(focused)).toHaveFocus();
    await user.hover(button('Elsewhere'));
    advance(1000);
    expect(menu('Actions')).toBeInTheDocument();
  });

  it('focus inside keeps it open after the pointer leaves', async () => {
    render(<HoverMenu />);
    await user.hover(button('Actions'));
    advance(300);
    act(() => item('Copy').focus());
    await user.hover(button('Elsewhere'));
    advance(1000);
    expect(menu('Actions')).toBeInTheDocument();
  });

  it('focus on its trigger does not keep it open: click, Escape, then hover and leave', async () => {
    render(<HoverMenu />);
    await user.click(button('Actions'));
    await user.keyboard('{Escape}');
    expect(button('Actions')).toHaveFocus();
    await user.hover(button('Elsewhere'));
    await user.hover(button('Actions'));
    advance(300);
    expect(menu('Actions')).toBeInTheDocument();
    await user.hover(button('Elsewhere'));
    advance(300);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
  });

  it('after Escape it does not reopen until the pointer has left the trigger', async () => {
    render(<HoverMenu />);
    mockRect(button('Actions'), { x: 0, y: 0, width: 100, height: 30 });
    await user.pointer({ target: button('Actions'), coords: { clientX: 10, clientY: 10 } });
    advance(300);
    expect(menu('Actions')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    await user.pointer({ target: button('Actions'), coords: { clientX: 30, clientY: 12 } });
    advance(400);
    await user.pointer({ target: button('Actions'), coords: { clientX: 50, clientY: 14 } });
    advance(400);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    await user.hover(button('Elsewhere'));
    await user.hover(button('Actions'));
    advance(300);
    expect(menu('Actions')).toBeInTheDocument();
  });

  it('openDelay and closeDelay set its timing', async () => {
    render(<HoverMenu openDelay={400} closeDelay={700} />);
    await user.hover(button('Actions'));
    advance(300);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    advance(200);
    expect(menu('Actions')).toBeInTheDocument();
    await user.hover(button('Elsewhere'));
    advance(550);
    expect(menu('Actions')).toBeInTheDocument();
    advance(250);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
  });

  it.each(['touch', 'pen'] as const)('%s pointers on its trigger open nothing', async (type) => {
    const onOpenChange = vi.fn();
    render(<HoverMenu onOpenChange={onOpenChange} />);
    const trigger = button('Actions');
    act(() => {
      trigger.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: type }));
      trigger.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: type }));
    });
    advance(1000);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('a hover opening that a controlled menu ignores leaves no trace: the app’s own opening focuses the first item and pins it', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<HoverMenu open={false} onOpenChange={onOpenChange} />);
    await user.hover(button('Actions'));
    advance(300);
    // The hover asked to open; the app kept the menu closed.
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    await user.hover(button('Elsewhere'));
    act(() => button('Elsewhere').focus());

    // Later the app opens it itself: an opening like any other, not a hover opening.
    rerender(<HoverMenu open onOpenChange={onOpenChange} />);
    expect(menu('Actions')).toBeInTheDocument();
    expect(item('Edit')).toHaveFocus();
    await user.hover(button('Actions'));
    await user.hover(button('Elsewhere'));
    advance(1000);
    expect(onOpenChange.mock.calls).toEqual([[true]]);
  });

  it('a hover opening that a controlled menu applies in a transition stays a hover opening: no focus move, and it closes after the pointer leaves', async () => {
    const onOpenChange = vi.fn();
    function TransitionMenu() {
      const [open, setOpen] = React.useState(false);
      return (
        <HoverMenu
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            React.startTransition(() => setOpen(next));
          }}
        />
      );
    }
    render(<TransitionMenu />);
    await user.hover(button('Actions'));
    advance(300);
    await act(async () => {});
    expect(menu('Actions')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.hover(button('Elsewhere'));
    advance(300);
    await act(async () => {});
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('a disabledFocusable MenuButton trigger does not open on hover', async () => {
    render(
      <Menu openOnHover>
        <Menu.Trigger>
          <MenuButton disabledFocusable>Actions</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.hover(button('Actions'));
    advance(1000);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
  });

  it('is ignored with openOnContext (development warning)', async () => {
    render(
      <Menu openOnHover openOnContext>
        <Menu.Trigger>
          <div data-testid="region">Files</div>
        </Menu.Trigger>
        <Menu.Popover aria-label="File actions">
          <Menu.Item>Open</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.hover(screen.getByTestId('region'));
    advance(1000);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Menu: openOnHover is ignored with openOnContext: a context menu opens only from a context gesture (a right click, Shift+F10 or the ContextMenu key).',
      ],
    ]);
    warn.mockClear();
  });

  it('a hover close moves no focus: <body> keeps it, and a Tooltip on the trigger stays hidden', async () => {
    render(
      <Menu openOnHover>
        <Menu.Trigger>
          <Tooltip content="More file actions" openDelay={0}>
            <button type="button">File</button>
          </Tooltip>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>New</Menu.Item>
          <Menu.Item>Open</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.hover(button('File'));
    advance(300);
    expect(menu('File')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.unhover(button('File'));
    advance(400);
    expect(queryMenu('File')).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
    // Focus on the trigger would have opened its Tooltip.
    advance(1000);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('a hover close takes a hover-opened submenu along without moving focus', async () => {
    const onRecentOpenChange = vi.fn();
    render(<FileMenu root={{ openOnHover: true }} recent={{ onOpenChange: onRecentOpenChange }} />);
    await user.hover(button('File'));
    advance(300);
    await user.hover(item('Open recent'));
    advance(400);
    expect(menu('Open recent')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.hover(button('Elsewhere'));
    advance(600);
    await act(async () => {});
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
    expect(onRecentOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('a submenu closed by hover while its hover-opened menu stays open moves no focus', async () => {
    render(<FileMenu root={{ openOnHover: true }} />);
    await user.hover(button('File'));
    advance(300);
    await user.hover(item('Open recent'));
    advance(400);
    expect(menu('Open recent')).toBeInTheDocument();
    // No safe zone (the submenu has no size in jsdom): the pointer rests on "New".
    await user.hover(item('New'));
    advance(400);
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(menu('File')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('a static menu’s submenu closed by hover moves no focus', async () => {
    render(
      <Menu aria-label="Edit">
        <Menu.Item>Cut</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Paste special</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Text only</Menu.Item>
          </Menu.Popover>
        </Menu>
      </Menu>,
    );
    await user.hover(item('Paste special'));
    advance(300);
    expect(menu('Paste special')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.unhover(item('Paste special'));
    advance(400);
    expect(queryMenu('Paste special')).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('only the hover close leaves focus alone: Escape on a hover-opened menu returns focus to the trigger', async () => {
    render(<HoverMenu />);
    await user.hover(button('Actions'));
    advance(300);
    expect(menu('Actions')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
  });

  it('a hover close the controlled parent refused does not linger: a later Escape returns focus to the trigger', async () => {
    let refuse = true;
    function RefusingMenu() {
      const [open, setOpen] = React.useState(false);
      return (
        <HoverMenu
          open={open}
          onOpenChange={(next) => {
            // The first close (the hover close) is refused.
            if (!next && refuse) {
              refuse = false;
              return;
            }
            setOpen(next);
          }}
        />
      );
    }
    render(<RefusingMenu />);
    await user.hover(button('Actions'));
    advance(300);
    await user.hover(button('Elsewhere'));
    advance(400);
    expect(refuse).toBe(false);
    expect(menu('Actions')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
  });

  it('a hover close that a controlled parent applies synchronously (flushSync) moves no focus', async () => {
    function SyncMenu() {
      const [open, setOpen] = React.useState(false);
      return (
        <HoverMenu
          open={open}
          onOpenChange={(next) => {
            flushSync(() => setOpen(next));
          }}
        />
      );
    }
    render(<SyncMenu />);
    await user.hover(button('Actions'));
    advance(300);
    expect(menu('Actions')).toBeInTheDocument();
    await user.hover(button('Elsewhere'));
    advance(400);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('after a hover close, an opening and a closing by the app alone return focus from <body> to the trigger', async () => {
    function ControlledMenu({ open }: { open?: boolean }) {
      const [state, setState] = React.useState(false);
      return <HoverMenu open={open ?? state} onOpenChange={setState} />;
    }
    const { rerender } = render(<ControlledMenu />);
    await user.hover(button('Actions'));
    advance(300);
    await user.hover(button('Elsewhere'));
    advance(400);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
    // The app opens the menu (focus moves to its first item), focus falls to <body>, and the app
    // closes it: no hover close is in flight any more.
    rerender(<ControlledMenu open />);
    expect(item('Edit')).toHaveFocus();
    act(() => item('Edit').blur());
    expect(document.body).toHaveFocus();
    rerender(<ControlledMenu open={false} />);
    expect(queryMenu('Actions')).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
  });

  it('a static menu ignores openOnHover and openOnContext (one warning) and accepts the delays', () => {
    render(
      <Menu aria-label="Edit" openOnHover openOnContext openDelay={100} closeDelay={100}>
        <Menu.Item>Cut</Menu.Item>
      </Menu>,
    );
    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Menu: `openOnHover` and `openOnContext` are ignored on a static menu: they apply to a popup menu (Menu.Trigger + Menu.Popover). A static menu passes openDelay and closeDelay on to its submenus.',
      ],
    ]);
    warn.mockClear();
  });
});
