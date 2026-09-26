import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Menu } from '../Menu';
import type { MenuProps } from '../Menu';
import { useMenuContext } from '../Menu.context';
import { Dialog } from '../../overlays/Dialog';
import { getOpenLayers } from '../../../lib/layers';
import type { CheckedValuesChangeHandler } from '../../../lib/types';
import { expectNoA11yViolations, mockRect, renderWithProviders } from '../../../test-utils';

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  try {
    // Every test that expects a warning asserts and clears it.
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

const item = (name: string) => screen.getByRole('menuitem', { name });
const menu = (name: string) => screen.getByRole('menu', { name });
const queryMenu = (name: string) => screen.queryByRole('menu', { name });
const fileButton = () => screen.getByRole('button', { name: 'File' });

interface FileMenuProps {
  root?: Partial<MenuProps>;
  recent?: Partial<MenuProps>;
  older?: Partial<MenuProps>;
  share?: Partial<MenuProps>;
  onArchive?: () => void;
  children?: React.ReactNode;
}

/**
 * A File menu with two submenus in its list ("Open recent", "Share"); "Open recent" holds a third
 * level ("Older").
 */
function FileMenu({ root, recent, older, share, onArchive, children }: FileMenuProps) {
  return (
    <Menu {...root}>
      <Menu.Trigger>
        <button type="button">File</button>
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item>New</Menu.Item>
        <Menu {...recent}>
          <Menu.Trigger>
            <Menu.Item>Open recent</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>report.docx</Menu.Item>
            <Menu {...older}>
              <Menu.Trigger>
                <Menu.Item>Older</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.Item onClick={onArchive}>archive.zip</Menu.Item>
                <Menu.Item>notes.txt</Menu.Item>
              </Menu.Popover>
            </Menu>
          </Menu.Popover>
        </Menu>
        <Menu {...share}>
          <Menu.Trigger>
            <Menu.Item>Share</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Email</Menu.Item>
          </Menu.Popover>
        </Menu>
        {children}
        <Menu.Item>Exit</Menu.Item>
      </Menu.Popover>
    </Menu>
  );
}

/** Opens the File menu with the keyboard and moves to "Open recent". */
async function openFileAtRecent(user: UserEvent) {
  act(() => fileButton().focus());
  await user.keyboard('{Enter}{ArrowDown}');
  expect(item('Open recent')).toHaveFocus();
}

describe('Menu submenus', () => {
  it('a submenu trigger item has menu-button semantics, which follow the open state', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await user.click(fileButton());
    const recent = item('Open recent');
    expect(recent).toHaveAttribute('aria-haspopup', 'menu');
    expect(recent).toHaveAttribute('aria-expanded', 'false');
    expect(recent).not.toHaveAttribute('aria-controls');
    expect(recent).toHaveAttribute('data-has-submenu', '');

    await user.click(recent);
    const submenu = menu('Open recent');
    expect(recent).toHaveAttribute('aria-expanded', 'true');
    expect(recent).toHaveAttribute('aria-controls', submenu.id);
    // Labelled by its trigger item; opens at the end side (right in LTR), aligned to its start.
    expect(submenu).toHaveAttribute('aria-labelledby', recent.id);
    expect(submenu).toHaveAttribute('data-side', 'right');
    expect(submenu).toHaveAttribute('data-align', 'start');
    expect(item('report.docx')).toHaveFocus();
  });

  it('ArrowRight on a trigger item opens its submenu and focuses the first item', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    expect(menu('Open recent')).toBeInTheDocument();
    expect(item('report.docx')).toHaveFocus();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s on a trigger item opens its submenu and focuses the first item', async (_n, key) => {
    const user = userEvent.setup();
    const onRootOpenChange = vi.fn();
    render(<FileMenu root={{ onOpenChange: onRootOpenChange }} />);
    await openFileAtRecent(user);
    await user.keyboard(key);
    expect(item('report.docx')).toHaveFocus();
    // The trigger item never closes the menu it is in.
    expect(menu('File')).toBeInTheDocument();
    expect(onRootOpenChange.mock.calls).toEqual([[true]]);
  });

  it('a click on the trigger item of an open submenu keeps it open and focuses its first item', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<FileMenu recent={{ onOpenChange }} />);
    await user.click(fileButton());
    await user.click(item('Open recent'));
    await user.keyboard('{ArrowDown}');
    expect(item('Older')).toHaveFocus();
    await user.click(item('Open recent'));
    expect(menu('Open recent')).toBeInTheDocument();
    expect(item('report.docx')).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true]]);
  });

  it('ArrowLeft closes only the submenu and returns focus to its trigger item', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(menu('File')).toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
    expect(item('Open recent')).toHaveAttribute('aria-expanded', 'false');
    // In the root list ArrowLeft does nothing.
    await user.keyboard('{ArrowLeft}');
    expect(menu('File')).toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
  });

  it('Escape closes only the submenu and returns focus to its trigger item', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}{Escape}');
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(menu('File')).toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
  });

  it('ArrowDown and ArrowUp on a trigger item move in the parent list and open nothing', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowDown}');
    expect(item('Share')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(item('New')).toHaveFocus();
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(queryMenu('Share')).not.toBeInTheDocument();
  });

  it('three levels: open, navigate and close level by level', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(item('Older')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(menu('Older')).toBeInTheDocument();
    expect(item('archive.zip')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('notes.txt')).toHaveFocus();
    // Escape inside the second-level submenu closes only it.
    await user.keyboard('{Escape}');
    expect(queryMenu('Older')).not.toBeInTheDocument();
    expect(menu('Open recent')).toBeInTheDocument();
    expect(item('Older')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(queryMenu('File')).not.toBeInTheDocument();
    expect(fileButton()).toHaveFocus();
  });

  it('item activation in the third level closes every menu and leaves focus on the root trigger', async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    const onRootOpenChange = vi.fn();
    render(<FileMenu onArchive={onArchive} root={{ onOpenChange: onRootOpenChange }} />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowRight}');
    expect(item('archive.zip')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(fileButton()).toHaveFocus();
    expect(fileButton()).toHaveAttribute('aria-expanded', 'false');
    expect(onRootOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('Tab in a submenu closes every menu, focuses the root trigger and lets the Tab move on', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    expect(fireEvent.keyDown(item('report.docx'), { key: 'Tab' })).toBe(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(fileButton()).toHaveFocus();
  });

  it('an outside press closes the chain; a press in the parent closes only the submenu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FileMenu />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(fileButton());
    await user.click(item('Open recent'));
    // A press in the submenu is inside the root menu too.
    await user.click(menu('Open recent'));
    expect(menu('File')).toBeInTheDocument();
    expect(menu('Open recent')).toBeInTheDocument();
    // A press in the parent (not on an item) closes only the submenu.
    await user.click(menu('File'));
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(menu('File')).toBeInTheDocument();

    await user.click(item('Open recent'));
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  it('one submenu per list is open: opening another closes it', async () => {
    const user = userEvent.setup();
    const onRecentOpenChange = vi.fn();
    render(<FileMenu recent={{ onOpenChange: onRecentOpenChange }} />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    expect(menu('Open recent')).toBeInTheDocument();
    await user.click(item('Share'));
    expect(menu('Share')).toBeInTheDocument();
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('Email')).toHaveFocus();
    expect(onRecentOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('focus moving to another item of the parent list closes the submenu', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    await act(async () => {
      item('Exit').focus();
    });
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(menu('File')).toBeInTheDocument();
    expect(item('Exit')).toHaveFocus();
  });

  it('a disabled trigger item opens its submenu neither by click nor by keys', async () => {
    const user = userEvent.setup();
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
    await user.click(fileButton());
    await user.click(item('Share'));
    expect(queryMenu('Share')).not.toBeInTheDocument();
    expect(item('Share')).toHaveAttribute('aria-disabled', 'true');
    expect(item('Share')).toHaveAttribute('aria-expanded', 'false');
    for (const key of ['ArrowRight', 'Enter', ' ']) {
      fireEvent.keyDown(item('Share'), { key });
      expect(queryMenu('Share')).not.toBeInTheDocument();
    }
    expect(menu('File')).toBeInTheDocument();
  });

  it('a submenu stacks one portal level above its parent', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowRight}');
    const wrapperOf = (name: string) =>
      menu(name).closest<HTMLElement>('[data-wave-portal]')!.style.zIndex;
    expect(wrapperOf('File')).toBe('calc(var(--wave-z-overlay, 1000) + 0)');
    expect(wrapperOf('Open recent')).toBe('calc(var(--wave-z-overlay, 1000) + 1)');
    expect(wrapperOf('Older')).toBe('calc(var(--wave-z-overlay, 1000) + 2)');
  });

  it('RTL: ArrowLeft opens a submenu and ArrowRight closes it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FileMenu />, { dir: 'rtl' });
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(item('report.docx')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('Open recent')).toHaveFocus();
  });

  it('has no axe violations with every level open', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowRight}');
    expect(menu('Older')).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('StrictMode: a submenu reports each open change once', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <FileMenu recent={{ onOpenChange }} />
      </React.StrictMode>,
    );
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});

describe('submenu placement', () => {
  const html = document.documentElement;
  beforeEach(() => {
    // A 1024×768 viewport (jsdom has no layout).
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
  });
  afterEach(() => {
    Reflect.deleteProperty(html, 'clientWidth');
    Reflect.deleteProperty(html, 'clientHeight');
  });

  /** The surface's `translate(x, y)` position (floating-ui's transform styles). */
  function translateOf(el: HTMLElement): { x: number; y: number } {
    const match = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
  }

  it.each([
    ['ltr', 'right', 1024 - 8 - 180],
    ['rtl', 'left', 8],
  ] as const)(
    '%s: a submenu with room on neither side of its trigger item overlaps its parent inside the viewport',
    async (dir, side, x) => {
      const user = userEvent.setup();
      renderWithProviders(<FileMenu />, { dir });
      await user.click(fileButton());
      // A full-width menu: its item spans x 16–1008, so 180px fit on neither side.
      mockRect(item('Open recent'), { x: 16, y: 40, width: 992, height: 30 });
      await user.click(item('Open recent'));
      const submenu = menu('Open recent');
      mockRect(submenu, { width: 180, height: 100 });
      // A layout change measures the surface again.
      fireEvent(window, new Event('resize'));
      await waitFor(() => expect(translateOf(submenu)).toEqual({ x, y: 40 }));
      expect(submenu).toHaveAttribute('data-side', side);
      expect(submenu.style.getPropertyValue('--wave-popup-available-width')).toBe('1008px');
    },
  );
});

describe('closing a chain of controlled submenus', () => {
  /** A controlled root and a controlled "Open recent" submenu that log their open changes. */
  function Controlled({ log }: { log: string[] }) {
    const [rootOpen, setRootOpen] = React.useState(false);
    const [recentOpen, setRecentOpen] = React.useState(false);
    return (
      <>
        <FileMenu
          root={{
            open: rootOpen,
            onOpenChange: (open) => {
              log.push(`root:${open}`);
              setRootOpen(open);
            },
          }}
          recent={{
            open: recentOpen,
            onOpenChange: (open) => {
              log.push(`recent:${open}`);
              setRecentOpen(open);
            },
          }}
        />
        <button type="button">Elsewhere</button>
      </>
    );
  }

  async function openBoth(user: UserEvent) {
    await openFileAtRecent(user);
    await user.keyboard('{ArrowRight}');
    expect(item('report.docx')).toHaveFocus();
  }

  async function expectReopensClosed(user: UserEvent) {
    await user.click(fileButton());
    expect(menu('File')).toBeInTheDocument();
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('Open recent')).toHaveAttribute('aria-expanded', 'false');
  }

  it('item activation closes the submenu first, then the root, each once', async () => {
    const user = userEvent.setup();
    const log: string[] = [];
    render(<Controlled log={log} />);
    await openBoth(user);
    log.length = 0;
    await user.keyboard('{Enter}');
    expect(log).toEqual(['recent:false', 'root:false']);
    expect(fileButton()).toHaveFocus();
    await expectReopensClosed(user);
  });

  it('Tab closes the submenu first, then the root, each once', async () => {
    const user = userEvent.setup();
    const log: string[] = [];
    render(<Controlled log={log} />);
    await openBoth(user);
    log.length = 0;
    fireEvent.keyDown(item('report.docx'), { key: 'Tab' });
    await act(async () => {});
    expect(log).toEqual(['recent:false', 'root:false']);
    await expectReopensClosed(user);
  });

  it('an outside press closes the submenu first, then the root, each once', async () => {
    const user = userEvent.setup();
    const log: string[] = [];
    render(<Controlled log={log} />);
    await openBoth(user);
    log.length = 0;
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(log).toEqual(['recent:false', 'root:false']);
    await expectReopensClosed(user);
  });

  it('Escape closes the submenu; a second Escape closes the root without closing the submenu again', async () => {
    const user = userEvent.setup();
    const log: string[] = [];
    render(<Controlled log={log} />);
    await openBoth(user);
    log.length = 0;
    await user.keyboard('{Escape}');
    expect(log).toEqual(['recent:false']);
    await user.keyboard('{Escape}');
    expect(log).toEqual(['recent:false', 'root:false']);
    expect(fileButton()).toHaveFocus();
    await expectReopensClosed(user);
  });

  it('a root closed by its own prop takes the submenu surface and layer away in the same commit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FileMenu root={{ open: true, onOpenChange: () => {} }} />);
    await user.click(item('Open recent'));
    expect(menu('Open recent')).toBeInTheDocument();
    expect(getOpenLayers()).toHaveLength(2);
    rerender(<FileMenu root={{ open: false, onOpenChange: () => {} }} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(getOpenLayers()).toHaveLength(0);
    expect(fileButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('an uncontrolled submenu is closed when its root, closed by its own prop, opens again', async () => {
    const user = userEvent.setup();
    const onRecentOpenChange = vi.fn();
    const { rerender } = render(
      <FileMenu
        root={{ open: true, onOpenChange: () => {} }}
        recent={{ onOpenChange: onRecentOpenChange }}
      />,
    );
    await user.click(item('Open recent'));
    expect(menu('Open recent')).toBeInTheDocument();
    rerender(
      <FileMenu
        root={{ open: false, onOpenChange: () => {} }}
        recent={{ onOpenChange: onRecentOpenChange }}
      />,
    );
    expect(onRecentOpenChange.mock.calls).toEqual([[true], [false]]);
    rerender(
      <FileMenu
        root={{ open: true, onOpenChange: () => {} }}
        recent={{ onOpenChange: onRecentOpenChange }}
      />,
    );
    expect(menu('File')).toBeInTheDocument();
    expect(queryMenu('Open recent')).not.toBeInTheDocument();
    expect(item('New')).toHaveFocus();
    expect(onRecentOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});

/** Reads the context of the menu it is rendered in (internal). */
function ContextProbe({ id }: { id: string }) {
  const { persistOnItemClick, openDelay, closeDelay, isSubmenu } = useMenuContext('Test');
  return (
    <div
      data-testid={id}
      data-persist={String(persistOnItemClick)}
      data-open-delay={openDelay}
      data-close-delay={closeDelay}
      data-submenu={String(isSubmenu)}
    />
  );
}

/** A test-local checkable item bound to the checked values of the menu it is rendered in. */
function CheckedProbe({ name, value }: { name: string; value: string }) {
  const { checked } = useMenuContext('Test');
  return (
    <div
      role="menuitemcheckbox"
      aria-checked={checked.isChecked(name, value)}
      tabIndex={-1}
      onClick={(event) => checked.toggle(name, value, event.nativeEvent)}
    >
      {value}
    </div>
  );
}

describe('what a submenu inherits', () => {
  function Nested({ root, sub }: { root?: Partial<MenuProps>; sub?: Partial<MenuProps> }) {
    return (
      <Menu {...root}>
        <Menu.Trigger>
          <button type="button">View</button>
        </Menu.Trigger>
        <Menu.Popover>
          <ContextProbe id="root" />
          <Menu {...sub}>
            <Menu.Trigger>
              <Menu.Item>Sort</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <ContextProbe id="sub" />
              <Menu.Item>Name</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>
    );
  }

  async function openSub(user: UserEvent) {
    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(item('Sort'));
    return screen.getByTestId('sub');
  }

  it('uses the parent’s persistOnItemClick and delays unless it sets its own', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Nested root={{ persistOnItemClick: true, openDelay: 400, closeDelay: 600 }} />,
    );
    let sub = await openSub(user);
    expect(screen.getByTestId('root')).toHaveAttribute('data-submenu', 'false');
    expect(sub).toHaveAttribute('data-submenu', 'true');
    expect(sub).toHaveAttribute('data-persist', 'true');
    expect(sub).toHaveAttribute('data-open-delay', '400');
    expect(sub).toHaveAttribute('data-close-delay', '600');
    unmount();

    render(
      <Nested
        root={{ persistOnItemClick: true, openDelay: 400, closeDelay: 600 }}
        sub={{ persistOnItemClick: false, openDelay: 100, closeDelay: 50 }}
      />,
    );
    sub = await openSub(user);
    expect(sub).toHaveAttribute('data-persist', 'false');
    expect(sub).toHaveAttribute('data-open-delay', '100');
    expect(sub).toHaveAttribute('data-close-delay', '50');
  });

  it('defaults to 250 ms delays and no persistence', async () => {
    const user = userEvent.setup();
    render(<Nested />);
    const sub = await openSub(user);
    expect(sub).toHaveAttribute('data-persist', 'false');
    expect(sub).toHaveAttribute('data-open-delay', '250');
    expect(sub).toHaveAttribute('data-close-delay', '250');
  });

  it('inherits from a static root too', async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="View" persistOnItemClick openDelay={400} closeDelay={500}>
        <Menu.Item>Zoom</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Sort</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <ContextProbe id="sub" />
            <Menu.Item>Name</Menu.Item>
          </Menu.Popover>
        </Menu>
      </Menu>,
    );
    await user.click(item('Sort'));
    const sub = screen.getByTestId('sub');
    expect(sub).toHaveAttribute('data-submenu', 'true');
    expect(sub).toHaveAttribute('data-persist', 'true');
    expect(sub).toHaveAttribute('data-open-delay', '400');
    expect(sub).toHaveAttribute('data-close-delay', '500');
  });

  describe('checked values', () => {
    function CheckedTree({ root, sub }: { root?: Partial<MenuProps>; sub?: Partial<MenuProps> }) {
      return (
        <Menu {...root}>
          <Menu.Trigger>
            <button type="button">View</button>
          </Menu.Trigger>
          <Menu.Popover>
            <CheckedProbe name="panels" value="status" />
            <Menu {...sub}>
              <Menu.Trigger>
                <Menu.Item>Show</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover>
                <CheckedProbe name="panels" value="ruler" />
              </Menu.Popover>
            </Menu>
          </Menu.Popover>
        </Menu>
      );
    }

    const box = (name: string) => screen.getByRole('menuitemcheckbox', { name });

    async function openShow(user: UserEvent) {
      await user.click(screen.getByRole('button', { name: 'View' }));
      await user.click(item('Show'));
    }

    it('a submenu shares its parent’s state', async () => {
      const user = userEvent.setup();
      const onRoot = vi.fn<CheckedValuesChangeHandler>();
      render(
        <CheckedTree
          root={{ defaultCheckedValues: { panels: ['status'] }, onCheckedValuesChange: onRoot }}
        />,
      );
      await openShow(user);
      await user.click(box('ruler'));
      expect(box('ruler')).toHaveAttribute('aria-checked', 'true');
      expect(box('status')).toHaveAttribute('aria-checked', 'true');
      expect(onRoot).toHaveBeenCalledWith(
        { panels: ['status', 'ruler'] },
        { name: 'panels', checkedItems: ['status', 'ruler'], event: expect.any(Event) },
      );
    });

    it('defaultCheckedValues gives a submenu its own state', async () => {
      const user = userEvent.setup();
      const onRoot = vi.fn<CheckedValuesChangeHandler>();
      render(
        <CheckedTree
          root={{ defaultCheckedValues: { panels: ['status'] }, onCheckedValuesChange: onRoot }}
          sub={{ defaultCheckedValues: { panels: [] } }}
        />,
      );
      await openShow(user);
      await user.click(box('ruler'));
      expect(box('ruler')).toHaveAttribute('aria-checked', 'true');
      expect(onRoot).not.toHaveBeenCalled();
      await user.click(box('status'));
      expect(box('status')).toHaveAttribute('aria-checked', 'false');
      expect(onRoot).toHaveBeenCalledWith(
        { panels: [] },
        { name: 'panels', checkedItems: [], event: expect.any(Event) },
      );
    });

    it('onCheckedValuesChange alone keeps sharing and is called after the parent’s, with the same arguments', async () => {
      const user = userEvent.setup();
      const calls: string[] = [];
      const onRoot = vi.fn<CheckedValuesChangeHandler>(() => calls.push('root'));
      const onSub = vi.fn<CheckedValuesChangeHandler>(() => calls.push('sub'));
      render(
        <CheckedTree
          root={{ defaultCheckedValues: { panels: ['status'] }, onCheckedValuesChange: onRoot }}
          sub={{ onCheckedValuesChange: onSub }}
        />,
      );
      await openShow(user);
      await user.click(box('ruler'));
      expect(calls).toEqual(['root', 'sub']);
      expect(onSub.mock.calls[0]).toEqual(onRoot.mock.calls[0]);
      expect(onSub.mock.calls[0][0]).toBe(onRoot.mock.calls[0][0]);
      // A change the root's own items make is not the submenu's to hear.
      await user.click(box('status'));
      expect(onRoot).toHaveBeenCalledTimes(2);
      expect(onSub).toHaveBeenCalledTimes(1);
    });
  });
});

describe('a submenu in a static menu', () => {
  function StaticEdit({ onText }: { onText?: () => void }) {
    return (
      <Menu aria-label="Edit">
        <Menu.Item>Cut</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Paste special</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item onClick={onText}>Text only</Menu.Item>
            <Menu.Item>Formatting</Menu.Item>
          </Menu.Popover>
        </Menu>
        <Menu.Item>Select all</Menu.Item>
      </Menu>
    );
  }

  it('opens from its trigger item; activation inside closes it and focuses the trigger item', async () => {
    const user = userEvent.setup();
    const onText = vi.fn();
    render(<StaticEdit onText={onText} />);
    act(() => item('Cut').focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Paste special')).toHaveAttribute('aria-haspopup', 'menu');
    await user.keyboard('{ArrowRight}');
    expect(item('Text only')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onText).toHaveBeenCalledTimes(1);
    expect(queryMenu('Paste special')).not.toBeInTheDocument();
    expect(menu('Edit')).toBeInTheDocument();
    expect(item('Paste special')).toHaveFocus();
  });

  it('ArrowLeft and Escape close it and focus the trigger item', async () => {
    const user = userEvent.setup();
    render(<StaticEdit />);
    await user.click(item('Paste special'));
    expect(item('Text only')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(queryMenu('Paste special')).not.toBeInTheDocument();
    expect(item('Paste special')).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    expect(queryMenu('Paste special')).not.toBeInTheDocument();
    expect(item('Paste special')).toHaveFocus();
  });

  it('renders the trigger item closed on the server and hydrates without warnings', async () => {
    const html = renderToString(<StaticEdit />);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Text only');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <StaticEdit />);
      });
      expect(item('Paste special')).toHaveAttribute('aria-expanded', 'false');
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe('a Menu in a Dialog opened from an item stays a root menu', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function OuterWithDialog({ inside }: { inside: boolean }) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const dialog = (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content title="Sort settings">
          <Menu>
            <Menu.Trigger>
              <button type="button">Sort by</button>
            </Menu.Trigger>
            <Menu.Popover>
              <CheckedProbe name="view" value="grid" />
              <Menu.Item>Name</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Dialog.Content>
      </Dialog>
    );
    return (
      <Menu defaultCheckedValues={{ view: ['grid'] }}>
        <Menu.Trigger>
          <button type="button">View</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item persistOnClick onClick={() => setDialogOpen(true)}>
            Settings…
            {inside ? dialog : null}
          </Menu.Item>
          {inside ? null : dialog}
        </Menu.Popover>
      </Menu>
    );
  }

  it.each([
    ['next to the items', false],
    ['inside the item', true],
  ])('rendered %s', async (_where, inside) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<OuterWithDialog inside={inside} />);
    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(item('Settings…'));
    const sortBy = screen.getByRole('button', { name: 'Sort by' });
    expect(sortBy).not.toHaveAttribute('data-has-submenu');

    // No hover opening, as for any root menu.
    await user.hover(sortBy);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(queryMenu('Sort by')).not.toBeInTheDocument();

    await user.click(sortBy);
    const inner = menu('Sort by');
    expect(inner).toHaveAttribute('data-side', 'bottom');
    // Its own checked values, not the outer menu's.
    expect(screen.getByRole('menuitemcheckbox', { name: 'grid' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await user.click(item('Name'));
    expect(queryMenu('Sort by')).not.toBeInTheDocument();
    expect(sortBy).toHaveFocus();
    // The outer menu (behind the modal) is still open.
    expect(screen.getByRole('button', { name: 'View', hidden: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('development diagnostics', () => {
  it('warns once when a submenu’s Menu.Trigger does not wrap a Menu.Item', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">File</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>New</Menu.Item>
          <Menu>
            <Menu.Trigger>
              <button type="button">More</button>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Print</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(fileButton());
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Menu.Trigger: a submenu\'s Menu.Trigger must wrap a Menu.Item: its element has no role="menuitem", so the menu does not treat it as one of its items. Put a Menu.Item inside it (and leave asChild at its default).',
      ],
    ]);
    warn.mockClear();
  });
});
