import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Menu } from '../Menu';
import type { MenuPopoverProps, MenuProps } from '../Menu';
import { Dialog } from '../../overlays/Dialog';
import { Tooltip } from '../../overlays/Tooltip';
import type { PopupRect, VirtualElement } from '../../../lib/types';
import { expectNoA11yViolations, mockAnimations, mockRect } from '../../../test-utils';

const html = document.documentElement;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
  // A 1024×768 viewport (jsdom has no layout), so a menu fits where it is placed.
  Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
  Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
});
afterEach(() => {
  Reflect.deleteProperty(html, 'clientWidth');
  Reflect.deleteProperty(html, 'clientHeight');
  try {
    // Every test that expects a warning asserts and clears it.
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

const ROWS = ['report.docx', 'notes.txt', 'budget.xlsx', 'photo.png', 'draft.md', 'todo.txt'];
const row = (name: string) => screen.getByRole('button', { name });
const item = (name: string) => screen.getByRole('menuitem', { name });
const region = () => screen.getByTestId('region');
const fileMenu = () => screen.getByRole('menu', { name: 'File actions' });
const queryFileMenu = () => screen.queryByRole('menu', { name: 'File actions' });

/** The surface's `translate(x, y)` position (floating-ui's transform styles). */
function translateOf(el: HTMLElement): { x: number; y: number } {
  const match = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
}

function rect(x: number, y: number, width = 0, height = 0): PopupRect {
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}

/**
 * Makes `focus()` on an element inside `inert` do nothing, as browsers do (jsdom focuses it). The
 * closing surface is inert from the closing commit on, so after that commit React cannot put
 * focus back on the item that had it: wherever the menu moved focus as it closed is where it stays.
 * Restored by `vi.restoreAllMocks()`.
 */
function focusSkipsInert() {
  const focus = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    if (this.closest('[inert]')) return;
    focus.call(this, options);
  });
}

interface FileListProps {
  menu?: Partial<MenuProps>;
  popover?: Partial<MenuPopoverProps>;
  onOpenFile?: () => void;
  withInput?: boolean;
  children?: React.ReactNode;
}

/** A file list whose region opens a context menu of file actions. */
function FileList({ menu, popover, onOpenFile, withInput = false, children }: FileListProps) {
  return (
    <div data-testid="page">
      <button type="button">Before</button>
      <Menu openOnContext {...menu}>
        <Menu.Trigger>
          <div data-testid="region" aria-keyshortcuts="Shift+F10">
            {ROWS.map((name) => (
              <button key={name} type="button">
                {name}
              </button>
            ))}
            {withInput && <input aria-label="Filter" />}
          </div>
        </Menu.Trigger>
        <Menu.Popover aria-label="File actions" {...popover}>
          <Menu.Item onClick={onOpenFile}>Open</Menu.Item>
          <Menu.Item>Rename</Menu.Item>
          {children}
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
      <button type="button">Elsewhere</button>
    </div>
  );
}

describe('Menu openOnContext', () => {
  it('a right click opens the menu at the pointer, focuses its first item and keeps the browser menu away', async () => {
    const onOpenChange = vi.fn();
    render(<FileList menu={{ onOpenChange }} />);
    expect(fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 })).toBe(
      false,
    );
    expect(fileMenu()).toBeInTheDocument();
    expect(item('Open')).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 100, y: 204 }));
    expect(fileMenu()).toHaveAttribute('data-side', 'bottom');
  });

  it('a macOS Ctrl+click is a pointer gesture too', async () => {
    render(<FileList />);
    expect(
      fireEvent.contextMenu(row('notes.txt'), {
        button: 0,
        ctrlKey: true,
        clientX: 120,
        clientY: 90,
      }),
    ).toBe(false);
    await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 120, y: 94 }));
  });

  it('a second right click moves the open menu to the new point', async () => {
    render(<FileList />);
    fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
    await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 100, y: 204 }));
    const surface = fileMenu();
    fireEvent.contextMenu(row('draft.md'), { button: 2, clientX: 150, clientY: 300 });
    expect(fileMenu()).toBe(surface);
    await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 150, y: 304 }));
  });

  it.each([
    ['a right-button press', { button: 2 }],
    ['a macOS Ctrl+press', { button: 0, ctrlKey: true }],
  ] as const)(
    'a second gesture that focuses its row on %s moves the open menu without closing it',
    async (_name, press) => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<FileList menu={{ onOpenChange }} />);
      fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 100, y: 204 }));
      const surface = fileMenu();
      // Chromium and Firefox focus the row under the pointer at the press, before the contextmenu
      // event (which Windows fires at the release): the menu stays open meanwhile.
      const point = { ...press, clientX: 150, clientY: 300 };
      fireEvent.pointerDown(row('draft.md'), point);
      fireEvent.mouseDown(row('draft.md'), point);
      act(() => row('draft.md').focus());
      await act(async () => {});
      expect(fileMenu()).toBe(surface);
      expect(onOpenChange.mock.calls).toEqual([[true]]);

      fireEvent.contextMenu(row('draft.md'), point);
      expect(fileMenu()).toBe(surface);
      expect(item('Open')).toHaveFocus();
      await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 150, y: 304 }));
      expect(onOpenChange.mock.calls).toEqual([[true]]);
      // Focus returns to the row of the second gesture.
      await user.keyboard('{Escape}');
      expect(queryFileMenu()).not.toBeInTheDocument();
      expect(row('draft.md')).toHaveFocus();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    },
  );

  it.each([
    ['Shift+F10', '{Shift>}{F10}{/Shift}'],
    ['the ContextMenu key', '{ContextMenu}'],
  ])('%s on a focused row opens the menu against that row', async (_name, keys) => {
    const user = userEvent.setup();
    render(<FileList />);
    mockRect(row('draft.md'), { x: 20, y: 300, width: 200, height: 30 });
    act(() => row('draft.md').focus());
    await user.keyboard(keys);
    expect(item('Open')).toHaveFocus();
    await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 20, y: 334 }));
    // The contextmenu event the browser dispatches for the key press keeps it there.
    expect(fireEvent.contextMenu(row('draft.md'), { button: 0 })).toBe(false);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(translateOf(fileMenu())).toEqual({ x: 20, y: 334 });
  });

  it('renders the region without menu-button state on the server, and nothing open', () => {
    const html = renderToString(<FileList />);
    expect(html).toContain('aria-keyshortcuts="Shift+F10"');
    expect(html).not.toContain('aria-haspopup');
    expect(html).not.toContain('aria-expanded');
    expect(html).not.toContain('role="menu"');
  });

  it('a click does not open it', async () => {
    const user = userEvent.setup();
    render(<FileList />);
    await user.click(row('notes.txt'));
    await user.keyboard('{Enter}{ArrowDown}');
    expect(queryFileMenu()).not.toBeInTheDocument();
  });

  it('a text field in the region keeps the browser’s context menu and opens nothing', () => {
    render(<FileList withInput />);
    const input = screen.getByRole('textbox', { name: 'Filter' });
    expect(fireEvent.contextMenu(input, { button: 2, clientX: 10, clientY: 10 })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'F10', shiftKey: true })).toBe(true);
    expect(queryFileMenu()).not.toBeInTheDocument();
  });

  it('the context menu prevents the browser’s menu inside it', () => {
    render(<FileList />);
    fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
    expect(fireEvent.contextMenu(item('Rename'), { button: 2 })).toBe(false);
    expect(fileMenu()).toBeInTheDocument();
  });

  it('is named by its aria-label, not by the region', () => {
    render(<FileList />);
    fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
    expect(fileMenu()).not.toHaveAttribute('aria-labelledby');
  });

  it('has no axe violations while open', async () => {
    render(<FileList />);
    fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
    await expectNoA11yViolations();
  });

  describe('the region carries no menu-button state', () => {
    it('a cloned child: no aria-haspopup, aria-expanded or aria-controls, open or closed', () => {
      render(<FileList />);
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(region()).not.toHaveAttribute(name);
      }
      fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(region()).not.toHaveAttribute(name);
      }
      expect(region()).toHaveAttribute('id');
    });

    it('a wrapper span: neither the span nor the first control inside gets them', () => {
      render(
        <Menu openOnContext>
          <Menu.Trigger asChild={false} data-testid="region">
            <button type="button">report.docx</button>
          </Menu.Trigger>
          <Menu.Popover aria-label="File actions">
            <Menu.Item>Open</Menu.Item>
          </Menu.Popover>
        </Menu>,
      );
      fireEvent.contextMenu(row('report.docx'), { button: 2, clientX: 10, clientY: 10 });
      expect(fileMenu()).toBeInTheDocument();
      for (const el of [region(), row('report.docx')]) {
        for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
          expect(el).not.toHaveAttribute(name);
        }
      }
    });

    it('a render-prop <div> that spreads every member has the state ARIA removed (warning); axe is clean', async () => {
      render(
        <Menu openOnContext>
          <Menu.Trigger>
            {(props) => (
              <div {...props} data-testid="region">
                <button type="button">report.docx</button>
              </div>
            )}
          </Menu.Trigger>
          <Menu.Popover aria-label="File actions">
            <Menu.Item>Open</Menu.Item>
          </Menu.Popover>
        </Menu>,
      );
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(region()).not.toHaveAttribute(name);
      }
      // Its click does nothing; the context gesture opens the menu.
      fireEvent.click(region());
      expect(queryFileMenu()).not.toBeInTheDocument();
      fireEvent.contextMenu(row('report.docx'), { button: 2, clientX: 10, clientY: 10 });
      expect(fileMenu()).toBeInTheDocument();
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(region()).not.toHaveAttribute(name);
      }
      await expectNoA11yViolations();
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Menu.Trigger: the trigger element is a context-menu region (openOnContext), which is not a menu button: do not spread aria-haspopup, aria-expanded and aria-controls onto it.',
        ],
      ]);
      warn.mockClear();
    });

    it('a Tooltip around the trigger still describes the region', () => {
      render(
        <Menu openOnContext>
          <Tooltip content="Right-click a file for its actions">
            <Menu.Trigger>
              <div data-testid="region" tabIndex={0}>
                <button type="button">report.docx</button>
              </div>
            </Menu.Trigger>
          </Tooltip>
          <Menu.Popover aria-label="File actions">
            <Menu.Item>Open</Menu.Item>
          </Menu.Popover>
        </Menu>,
      );
      expect(region()).toHaveAccessibleDescription('Right-click a file for its actions');
      fireEvent.contextMenu(row('report.docx'), { button: 2, clientX: 10, clientY: 10 });
      expect(fileMenu()).toBeInTheDocument();
    });
  });

  describe('closing', () => {
    it('a primary press on another row closes it', async () => {
      const user = userEvent.setup();
      render(<FileList />);
      fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      await user.click(row('photo.png'));
      expect(queryFileMenu()).not.toBeInTheDocument();
      expect(row('photo.png')).toHaveFocus();
    });

    it('a right click outside closes it without preventing the browser’s menu', () => {
      render(<FileList />);
      fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      expect(
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Elsewhere' }), { button: 2 }),
      ).toBe(true);
      expect(queryFileMenu()).not.toBeInTheDocument();
    });

    it('a scroll outside that moves the region and the row of the gesture closes it; one that does not, and one inside, do not', () => {
      render(<FileList />);
      mockRect(region(), { x: 0, y: 100, width: 300, height: 200 });
      mockRect(row('notes.txt'), { x: 0, y: 130, width: 300, height: 30 });
      fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      // A scroll that moved nothing (inertial scrolling at the right click).
      fireEvent.scroll(screen.getByTestId('page'));
      expect(fileMenu()).toBeInTheDocument();
      // A scroll inside the menu (a long menu), even with the page moved.
      mockRect(region(), { x: 0, y: 40, width: 300, height: 200 });
      mockRect(row('notes.txt'), { x: 0, y: 70, width: 300, height: 30 });
      fireEvent.scroll(fileMenu());
      expect(fileMenu()).toBeInTheDocument();
      fireEvent.scroll(screen.getByTestId('page'));
      expect(queryFileMenu()).not.toBeInTheDocument();
    });

    it('an exiting surface keeps its position at the point', async () => {
      const motion = mockAnimations();
      const user = userEvent.setup();
      render(<FileList popover={{ 'data-test-motion': '' } as Partial<MenuPopoverProps>} />);
      fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      await waitFor(() => expect(translateOf(fileMenu())).toEqual({ x: 100, y: 204 }));
      const surface = fileMenu();
      await act(async () => {
        await motion.finishAll();
      });
      await user.keyboard('{Escape}');
      expect(surface).toHaveAttribute('data-presence', 'exiting');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(translateOf(surface)).toEqual({ x: 100, y: 204 });
      await act(async () => {
        await motion.finishAll();
      });
      expect(surface).not.toBeInTheDocument();
    });
  });

  describe('focus returns to the row the gesture came from', () => {
    async function openFromRow5(keyboard: boolean) {
      const user = userEvent.setup();
      act(() => row('draft.md').focus());
      if (keyboard) await user.keyboard('{Shift>}{F10}{/Shift}');
      else fireEvent.contextMenu(row('draft.md'), { button: 2, clientX: 40, clientY: 310 });
      expect(item('Open')).toHaveFocus();
      return user;
    }

    it.each([
      ['a keyboard gesture', true],
      ['a pointer gesture', false],
    ])('Escape, after %s', async (_n, keyboard) => {
      render(<FileList />);
      const user = await openFromRow5(keyboard);
      await user.keyboard('{Escape}');
      expect(queryFileMenu()).not.toBeInTheDocument();
      expect(row('draft.md')).toHaveFocus();
    });

    it('Tab', async () => {
      render(<FileList />);
      await openFromRow5(true);
      expect(fireEvent.keyDown(item('Open'), { key: 'Tab' })).toBe(true);
      expect(queryFileMenu()).not.toBeInTheDocument();
      expect(row('draft.md')).toHaveFocus();
    });

    it('item activation', async () => {
      const onOpenFile = vi.fn();
      render(<FileList onOpenFile={onOpenFile} />);
      const user = await openFromRow5(false);
      await user.keyboard('{Enter}');
      expect(onOpenFile).toHaveBeenCalledTimes(1);
      expect(queryFileMenu()).not.toBeInTheDocument();
      expect(row('draft.md')).toHaveFocus();
    });

    it('a Dialog opened from an item returns focus to the row when it closes', async () => {
      function WithDialog() {
        const [deleting, setDeleting] = React.useState(false);
        return (
          <>
            <FileList>
              <Menu.Item onClick={() => setDeleting(true)}>Delete permanently…</Menu.Item>
            </FileList>
            <Dialog open={deleting} onOpenChange={setDeleting}>
              <Dialog.Content title="Delete draft.md?">
                <Dialog.Close>
                  <button type="button">Cancel</button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog>
          </>
        );
      }
      render(<WithDialog />);
      const user = await openFromRow5(true);
      await user.click(item('Delete permanently…'));
      expect(screen.getByRole('dialog', { name: 'Delete draft.md?' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(row('draft.md')).toHaveFocus();
    });

    it('without a focused row, focus goes to the region’s first tabbable element', async () => {
      const user = userEvent.setup();
      render(<FileList />);
      fireEvent.contextMenu(row('budget.xlsx'), { button: 2, clientX: 40, clientY: 150 });
      expect(item('Open')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(row('report.docx')).toHaveFocus();
    });
  });

  describe('naming', () => {
    it('warns once when a context menu has no aria-label or aria-labelledby', () => {
      render(<FileList popover={{ 'aria-label': undefined }} />);
      fireEvent.contextMenu(row('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      expect(screen.getByRole('menu')).not.toHaveAttribute('aria-labelledby');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Menu.Popover: this menu has no trigger to name it (a context menu, or a menu placed at a `target` without Menu.Trigger): give Menu.Popover an aria-label or aria-labelledby.',
        ],
      ]);
      warn.mockClear();
    });
  });

  describe('submenus', () => {
    it('a submenu ignores openOnContext; one inside a context menu works and Escape closes only it', async () => {
      const user = userEvent.setup();
      render(
        <FileList>
          <Menu openOnContext>
            <Menu.Trigger>
              <Menu.Item>Share</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Email</Menu.Item>
            </Menu.Popover>
          </Menu>
        </FileList>,
      );
      act(() => row('draft.md').focus());
      await user.keyboard('{Shift>}{F10}{/Shift}');
      expect(item('Share')).toHaveAttribute('aria-haspopup', 'menu');
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
      expect(item('Email')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu', { name: 'Share' })).not.toBeInTheDocument();
      expect(fileMenu()).toBeInTheDocument();
      expect(item('Share')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(queryFileMenu()).not.toBeInTheDocument();
      expect(row('draft.md')).toHaveFocus();
    });
  });
});

describe('Menu.Popover target', () => {
  it('a controlled menu without a trigger opens next to an element target; a press on the target does not close it', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Anchored() {
      const [open, setOpen] = React.useState(false);
      const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
      return (
        <Menu
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <button
            type="button"
            ref={setTarget}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Options
          </button>
          <Menu.Popover target={target} aria-label="Options menu">
            <Menu.Item>Settings</Menu.Item>
          </Menu.Popover>
        </Menu>
      );
    }
    render(<Anchored />);
    mockRect(screen.getByRole('button', { name: 'Options' }), {
      x: 300,
      y: 100,
      width: 80,
      height: 30,
    });
    await user.click(screen.getByRole('button', { name: 'Options' }));
    const menu = screen.getByRole('menu', { name: 'Options menu' });
    expect(item('Settings')).toHaveFocus();
    await waitFor(() => expect(translateOf(menu)).toEqual({ x: 300, y: 134 }));

    // The toggle closes it; the press on it is inside the menu's layer, so the menu does not close
    // and reopen.
    await user.click(screen.getByRole('button', { name: 'Options' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('Escape returns focus to the element focused before it opened', async () => {
    const user = userEvent.setup();
    function Anchored() {
      const [open, setOpen] = React.useState(false);
      const [target, setTarget] = React.useState<HTMLElement | null>(null);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Show menu
          </button>
          <div ref={setTarget}>Anchor</div>
          <Menu open={open} onOpenChange={setOpen}>
            <Menu.Popover target={target} aria-label="Options menu">
              <Menu.Item>Settings</Menu.Item>
            </Menu.Popover>
          </Menu>
        </>
      );
    }
    render(<Anchored />);
    await user.click(screen.getByRole('button', { name: 'Show menu' }));
    expect(item('Settings')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show menu' })).toHaveFocus();
  });

  it.each([
    ['Escape', 'Settings'],
    ['an item that closes the menu through the app’s state', 'Close'],
  ])(
    'with a focusable target that is not the opener, %s returns focus to the element focused before it opened',
    async (_case, name) => {
      focusSkipsInert();
      const user = userEvent.setup();
      function Anchored() {
        const [open, setOpen] = React.useState(false);
        const [target, setTarget] = React.useState<HTMLElement | null>(null);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Show menu
            </button>
            <input ref={setTarget} aria-label="Search" />
            <Menu open={open} onOpenChange={setOpen}>
              <Menu.Popover target={target} aria-label="Options menu">
                <Menu.Item>Settings</Menu.Item>
                {/* persistOnClick: the item does not move focus itself; the app closes the menu. */}
                <Menu.Item persistOnClick onClick={() => setOpen(false)}>
                  Close
                </Menu.Item>
              </Menu.Popover>
            </Menu>
          </>
        );
      }
      render(<Anchored />);
      await user.click(screen.getByRole('button', { name: 'Show menu' }));
      expect(item('Settings')).toHaveFocus();
      if (name === 'Settings') await user.keyboard('{Escape}');
      else await user.click(item(name));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show menu' })).toHaveFocus();
    },
  );

  it('takes an inline VirtualElement in a component that re-renders, with a bounded number of renders', async () => {
    const renders = vi.fn();
    function Probe() {
      renders();
      return null;
    }
    function AtPoint({ x, y }: { x: number; y: number }) {
      const target: VirtualElement = { getBoundingClientRect: () => rect(x, y) };
      return (
        <Menu open onOpenChange={() => {}}>
          <Menu.Popover target={target} aria-label="At point">
            <Probe />
            <Menu.Item>Paste</Menu.Item>
          </Menu.Popover>
        </Menu>
      );
    }
    const { rerender } = render(<AtPoint x={100} y={200} />);
    const menu = screen.getByRole('menu', { name: 'At point' });
    await waitFor(() => expect(translateOf(menu)).toEqual({ x: 100, y: 204 }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const settled = renders.mock.calls.length;
    expect(settled).toBeLessThan(10);
    rerender(<AtPoint x={160} y={260} />);
    await waitFor(() => expect(translateOf(menu)).toEqual({ x: 160, y: 264 }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(renders.mock.calls.length - settled).toBeLessThan(10);
  });

  it('switching the target repositions the menu', async () => {
    function Switching({ which }: { which: 'a' | 'b' }) {
      const [a, setA] = React.useState<HTMLElement | null>(null);
      const [b, setB] = React.useState<HTMLElement | null>(null);
      return (
        <>
          <div ref={setA} data-testid="a" />
          <div ref={setB} data-testid="b" />
          <Menu open onOpenChange={() => {}}>
            <Menu.Popover target={which === 'a' ? a : b} aria-label="Anchored">
              <Menu.Item>Paste</Menu.Item>
            </Menu.Popover>
          </Menu>
        </>
      );
    }
    const { rerender } = render(<Switching which="a" />);
    mockRect(screen.getByTestId('a'), { x: 10, y: 20, width: 50, height: 10 });
    mockRect(screen.getByTestId('b'), { x: 400, y: 300, width: 50, height: 10 });
    rerender(<Switching which="a" />);
    const menu = screen.getByRole('menu', { name: 'Anchored' });
    await waitFor(() => expect(translateOf(menu)).toEqual({ x: 10, y: 34 }));
    rerender(<Switching which="b" />);
    await waitFor(() => expect(translateOf(menu)).toEqual({ x: 400, y: 314 }));
  });

  it('warns once when a menu at a target without a trigger has no name', () => {
    function Unnamed() {
      const [target, setTarget] = React.useState<HTMLElement | null>(null);
      return (
        <>
          <div ref={setTarget}>Anchor</div>
          <Menu open onOpenChange={() => {}}>
            <Menu.Popover target={target}>
              <Menu.Item>Paste</Menu.Item>
            </Menu.Popover>
          </Menu>
        </>
      );
    }
    render(<Unnamed />);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Menu.Popover: this menu has no trigger to name it (a context menu, or a menu placed at a `target` without Menu.Trigger): give Menu.Popover an aria-label or aria-labelledby.',
      ],
    ]);
    warn.mockClear();
  });
});
