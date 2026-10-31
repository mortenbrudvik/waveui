import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Menu,
  useMenuContext,
  useMenuListContext,
  type MenuContextValue,
  type MenuListContextValue,
  type MenuProps,
} from '../Menu';
import * as HooksModule from '../Menu.hooks';
import { MenuListContext } from '../Menu.context';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefsInHtml,
  honourInert,
  mockAnimations,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const CONTEXT_ERROR = '[WaveUI] useMenuContext must be used within Menu';
const LIST_ERROR = '[WaveUI] useMenuListContext must be used within Menu.Popover or a static Menu';

interface TemplateItemProps {
  title: string;
  description: string;
  onSelect?: () => void;
}

/**
 * A menu item of your own: an element with `role="menuitem"`, named by its title and described by
 * its text, that closes its menu through `useMenuContext` and reserves the check and icon columns
 * of the list through `useMenuListContext` (its placeholders carry `data-column` for the tests).
 */
function TemplateItem({ title, description, onSelect }: TemplateItemProps) {
  const { close } = useMenuContext();
  const { hasIcons, hasCheckmarks } = useMenuListContext();
  const id = React.useId();
  return (
    <div
      role="menuitem"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        onSelect?.();
        close();
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.currentTarget.click();
      }}
    >
      {hasCheckmarks && <span aria-hidden="true" data-column="checkmark" />}
      {hasIcons && <span aria-hidden="true" data-column="icon" />}
      <span id={`${id}-title`}>{title}</span>
      <span id={`${id}-description`}>{description}</span>
    </div>
  );
}
TemplateItem.displayName = 'TemplateItem';

/** Records what `useMenuContext` returns where it renders. */
function MenuProbe({
  id,
  record,
}: {
  id: string;
  record: (id: string, value: MenuContextValue) => void;
}) {
  record(id, useMenuContext());
  return null;
}

/** Records what `useMenuListContext` returns where it renders. */
function ListProbe({
  id,
  record,
}: {
  id: string;
  record: (id: string, value: MenuListContextValue) => void;
}) {
  record(id, useMenuListContext());
  return null;
}

/** The last value each probe recorded, by probe id. */
function recorder<T>() {
  const seen = new Map<string, T[]>();
  return {
    record: (id: string, value: T) => {
      const list = seen.get(id) ?? [];
      list.push(value);
      seen.set(id, list);
    },
    last: (id: string): T | undefined => seen.get(id)?.at(-1),
  };
}

interface NewMenuProps {
  menu?: Partial<MenuProps>;
  popover?: { 'data-test-motion'?: string };
  onBlank?: () => void;
  onNotes?: () => void;
  onOpenItem?: () => void;
  children?: React.ReactNode;
  Item?: React.ComponentType<TemplateItemProps>;
}

/** A "New" popup menu: two items of your own, a divider, an icon item and a checkbox item. */
function NewMenu({
  menu,
  popover,
  onBlank,
  onNotes,
  onOpenItem,
  children,
  Item = TemplateItem,
}: NewMenuProps) {
  return (
    <Menu {...menu}>
      <Menu.Trigger>
        <button type="button">New</button>
      </Menu.Trigger>
      <Menu.Popover {...popover}>
        <Item title="Blank document" description="Start from an empty page" onSelect={onBlank} />
        <Item
          title="Meeting notes"
          description="Agenda, decisions and actions"
          onSelect={onNotes}
        />
        <Menu.Divider />
        <Menu.Item icon={{ children: 'O' }} onClick={onOpenItem}>
          Open
        </Menu.Item>
        <Menu.ItemCheckbox name="view" value="ruler">
          Show ruler
        </Menu.ItemCheckbox>
        {children}
      </Menu.Popover>
    </Menu>
  );
}

const newButton = () => screen.getByRole('button', { name: 'New' });
const item = (name: string) => screen.getByRole('menuitem', { name });
const queryMenu = (name = 'New') => screen.queryByRole('menu', { name });

/** Opens the New menu with the keyboard: focus moves to its first item. */
async function openNewMenu(user: ReturnType<typeof userEvent.setup>) {
  act(() => newButton().focus());
  await user.keyboard('{Enter}');
  expect(item('Blank document')).toHaveFocus();
}

// ---------------------------------------------------------------------------
// useMenuContext
// ---------------------------------------------------------------------------

describe('useMenuContext (P13-02, R14)', () => {
  it('returns exactly open, close and isSubmenu inside a menu, nothing else', async () => {
    const user = userEvent.setup();
    const probes = recorder<MenuContextValue>();
    render(
      <NewMenu>
        <MenuProbe id="item" record={probes.record} />
      </NewMenu>,
    );
    await user.click(newButton());
    const value = probes.last('item');
    expect(value).toStrictEqual({ open: true, close: expect.any(Function), isSubmenu: false });
    // No other member is frozen into the public contract (R11).
    expect(Object.keys(value!).sort()).toEqual(['close', 'isSubmenu', 'open']);
  });

  it("open is the popup menu's open state: false while its surface exits, false in a static menu", async () => {
    const motion = mockAnimations();
    const user = userEvent.setup();
    const probes = recorder<MenuContextValue>();
    render(
      <>
        <NewMenu popover={{ 'data-test-motion': '' }}>
          <MenuProbe id="inside" record={probes.record} />
        </NewMenu>
        <Menu aria-label="Edit">
          <Menu.Item>Cut</Menu.Item>
          <MenuProbe id="static" record={probes.record} />
        </Menu>
      </>,
    );
    expect(probes.last('static')?.open).toBe(false);
    await user.click(newButton());
    await act(async () => {
      await motion.finishAll();
    });
    expect(probes.last('inside')?.open).toBe(true);

    await user.keyboard('{Escape}');
    // The surface is still mounted while it exits, and the probe inside it reads the menu's state.
    const surface = screen.getByRole('menu', { name: 'New', hidden: true });
    expect(surface.closest('[inert]')).toBe(surface);
    expect(probes.last('inside')?.open).toBe(false);
    await act(async () => {
      await motion.finishAll();
    });
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('a probe in a popup Menu outside Menu.Popover reads the open state too', async () => {
    const user = userEvent.setup();
    const probes = recorder<MenuContextValue>();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">New</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Blank document</Menu.Item>
        </Menu.Popover>
        <MenuProbe id="root" record={probes.record} />
      </Menu>,
    );
    expect(probes.last('root')?.open).toBe(false);
    await user.click(newButton());
    expect(probes.last('root')?.open).toBe(true);
    await user.keyboard('{Escape}');
    expect(probes.last('root')?.open).toBe(false);
  });

  it('isSubmenu is true in a submenu, its trigger item included, and false in the root menu', async () => {
    const user = userEvent.setup();
    const probes = recorder<MenuContextValue>();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">File</button>
        </Menu.Trigger>
        <Menu.Popover>
          <MenuProbe id="root" record={probes.record} />
          <Menu>
            <Menu.Trigger>
              <Menu.Item>Open recent</Menu.Item>
            </Menu.Trigger>
            <MenuProbe id="submenu-root" record={probes.record} />
            <Menu.Popover>
              <Menu.Item>report.docx</Menu.Item>
              <MenuProbe id="submenu" record={probes.record} />
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(probes.last('root')).toMatchObject({ open: true, isSubmenu: false });
    expect(probes.last('submenu-root')).toMatchObject({ open: false, isSubmenu: true });
    await user.click(item('Open recent'));
    expect(probes.last('submenu')).toMatchObject({ open: true, isSubmenu: true });
    expect(probes.last('submenu-root')).toMatchObject({ open: true, isSubmenu: true });
  });

  it('close() is one function for the life of the menu, and the object changes only with its values', async () => {
    const user = userEvent.setup();
    const probes = recorder<MenuContextValue>();
    function Parent({ tick }: { tick: number }) {
      return (
        <Menu data-tick={tick} onOpenChange={() => {}}>
          <Menu.Trigger>
            <button type="button">New</button>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Blank document</Menu.Item>
          </Menu.Popover>
          <MenuProbe id="root" record={probes.record} />
        </Menu>
      );
    }
    // A popup Menu ignores DOM props (development warning): the tick only re-renders it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<Parent tick={0} />);
    const first = probes.last('root')!;
    rerender(<Parent tick={1} />);
    expect(probes.last('root')).toBe(first);
    await user.click(newButton());
    const opened = probes.last('root')!;
    expect(opened).not.toBe(first);
    expect(opened.close).toBe(first.close);
    await user.keyboard('{Escape}');
    expect(probes.last('root')!.close).toBe(first.close);
    expect(warn.mock.calls).toEqual([
      [
        "[WaveUI] Menu: a popup menu (Menu.Trigger + Menu.Popover) renders no element of its own, so `data-tick` on Menu is ignored. Pass it to Menu.Popover (the menu surface) or to the trigger's child instead.",
      ],
    ]);
  });

  it('close() closes the menu and returns focus to the trigger, as activating a built-in item does', async () => {
    honourInert();
    const motion = mockAnimations();
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onNotes = vi.fn();
    render(
      <NewMenu menu={{ onOpenChange }} popover={{ 'data-test-motion': '' }} onNotes={onNotes} />,
    );
    await openNewMenu(user);
    await act(async () => {
      await motion.finishAll();
    });
    await user.keyboard('{ArrowDown}');
    expect(item('Meeting notes')).toHaveFocus();
    await user.keyboard('{Enter}');
    await act(async () => {});
    expect(onNotes).toHaveBeenCalledTimes(1);
    // Focus left the exiting surface in the commit that closed it (it is inert from then on).
    expect(newButton()).toHaveFocus();
    expect(newButton()).toHaveAttribute('aria-expanded', 'false');
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    const surface = screen.getByRole('menu', { name: 'New', hidden: true });
    expect(surface.closest('[inert]')).toBe(surface);
    await act(async () => {
      await motion.finishAll();
    });
    expect(queryMenu()).not.toBeInTheDocument();
    expect(newButton()).toHaveFocus();
  });

  it('close() is the very function an item activation calls in its list (static and popover)', async () => {
    const user = userEvent.setup();
    const pairs: Array<[string, unknown, unknown]> = [];
    function SameClose({ id }: { id: string }) {
      const { close } = useMenuContext();
      const list = React.useContext(MenuListContext);
      pairs.push([id, close, list?.closeFromItem]);
      return null;
    }
    render(
      <>
        <NewMenu>
          <SameClose id="popover" />
        </NewMenu>
        <Menu aria-label="Edit">
          <Menu.Item>Cut</Menu.Item>
          <SameClose id="static" />
        </Menu>
      </>,
    );
    await user.click(newButton());
    const seen = new Set(pairs.map(([id]) => id));
    expect(seen).toEqual(new Set(['static', 'popover']));
    for (const [, close, closeFromItem] of pairs) {
      expect(close).toBeTypeOf('function');
      expect(close).toBe(closeFromItem);
    }
  });

  it('close() leaves the same trail as a built-in item: open state, focus and the layer', async () => {
    const user = userEvent.setup();
    async function trail(activate: () => Promise<void>) {
      const onOpenChange = vi.fn();
      const onOpenItem = vi.fn();
      const view = render(<NewMenu menu={{ onOpenChange }} onOpenItem={onOpenItem} />);
      await openNewMenu(user);
      await activate();
      await act(async () => {});
      const result = {
        calls: onOpenChange.mock.calls,
        focused: document.activeElement === newButton(),
        menu: queryMenu() !== null,
      };
      view.unmount();
      return result;
    }
    const builtIn = await trail(async () => {
      await user.keyboard('{End}{ArrowUp}');
      expect(item('Open')).toHaveFocus();
      await user.keyboard('{Enter}');
    });
    const own = await trail(async () => {
      await user.keyboard('{Enter}');
    });
    expect(own).toEqual(builtIn);
    expect(own).toEqual({ calls: [[true], [false]], focused: true, menu: false });
  });

  it('close() from a submenu closes every menu, innermost first, each onOpenChange(false) once', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const onOpenChange = (level: string) => (open: boolean) => calls.push(`${level}:${open}`);
    const onArchive = vi.fn();
    render(
      <React.StrictMode>
        <Menu onOpenChange={onOpenChange('root')}>
          <Menu.Trigger>
            <button type="button">File</button>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>New</Menu.Item>
            <Menu onOpenChange={onOpenChange('recent')}>
              <Menu.Trigger>
                <Menu.Item>Open recent</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.Item>report.docx</Menu.Item>
                <Menu onOpenChange={onOpenChange('older')}>
                  <Menu.Trigger>
                    <Menu.Item>Older</Menu.Item>
                  </Menu.Trigger>
                  <Menu.Popover>
                    <TemplateItem title="Archive" description="Older files" onSelect={onArchive} />
                  </Menu.Popover>
                </Menu>
              </Menu.Popover>
            </Menu>
          </Menu.Popover>
        </Menu>
      </React.StrictMode>,
    );
    const file = screen.getByRole('button', { name: 'File' });
    act(() => file.focus());
    await user.keyboard('{Enter}{ArrowDown}{ArrowRight}{ArrowDown}{ArrowRight}');
    expect(item('Archive')).toHaveFocus();
    expect(calls).toEqual(['root:true', 'recent:true', 'older:true']);
    calls.length = 0;
    await user.keyboard('{Enter}');
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['older:false', 'recent:false', 'root:false']);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(file).toHaveFocus();
  });

  it('close() in a static menu closes nothing, as its items do; in its submenu it closes that submenu', async () => {
    const user = userEvent.setup();
    const onSubmenuOpenChange = vi.fn();
    const onCopy = vi.fn();
    render(
      <Menu aria-label="Edit">
        <TemplateItem title="Copy" description="To the clipboard" onSelect={onCopy} />
        <Menu onOpenChange={onSubmenuOpenChange}>
          <Menu.Trigger>
            <Menu.Item>Paste special</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <TemplateItem title="Text only" description="Without formatting" />
          </Menu.Popover>
        </Menu>
      </Menu>,
    );
    await user.click(item('Copy'));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument();
    expect(item('Copy')).toHaveFocus();

    await user.click(item('Paste special'));
    expect(item('Text only')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSubmenuOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(queryMenu('Paste special')).not.toBeInTheDocument();
    expect(item('Paste special')).toHaveFocus();
  });

  it("close() is the close an item calls where it renders: in a static Menu inside a popup menu's list, none", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onBold = vi.fn();
    render(
      <Menu onOpenChange={onOpenChange}>
        <Menu.Trigger>
          <button type="button">Format</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Clear</Menu.Item>
          <Menu aria-label="Style">
            <Menu.Item>Italic</Menu.Item>
            <TemplateItem title="Bold" description="Heavier text" onSelect={onBold} />
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'Format' }));
    // The items of the static Menu close nothing: neither the built-in one nor yours.
    await user.click(item('Italic'));
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await user.click(item('Bold'));
    expect(onBold).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    expect(screen.getByRole('menu', { name: 'Format' })).toBeInTheDocument();
  });

  it('throws outside a Menu in development (C-CONTEXT)', () => {
    expectThrows(<MenuProbe id="orphan" record={() => {}} />, CONTEXT_ERROR);
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a Menu and returns the inert value', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const probes = recorder<MenuContextValue>();
        const { rerender } = render(<MenuProbe id="orphan" record={probes.record} />);
        rerender(<MenuProbe id="orphan" record={probes.record} />);
        expect(error.mock.calls).toEqual([[CONTEXT_ERROR]]);
        expect(probes.last('orphan')).toStrictEqual({
          open: false,
          close: expect.any(Function),
          isSubmenu: false,
        });
        expect(() => probes.last('orphan')?.close()).not.toThrow();
      } finally {
        error.mockRestore();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// useMenuListContext
// ---------------------------------------------------------------------------

describe('useMenuListContext (P13-02, R14)', () => {
  it('returns exactly hasIcons and hasCheckmarks inside a menu list, nothing else', async () => {
    const user = userEvent.setup();
    const probes = recorder<MenuListContextValue>();
    render(
      <NewMenu>
        <ListProbe id="list" record={probes.record} />
      </NewMenu>,
    );
    await user.click(newButton());
    // The New menu holds an icon item and a checkbox item: both columns show.
    const value = probes.last('list');
    expect(value).toStrictEqual({ hasIcons: true, hasCheckmarks: true });
    expect(Object.keys(value!).sort()).toEqual(['hasCheckmarks', 'hasIcons']);
  });

  it("hasIcons follows the list's icon column: true while an item of the list shows an icon", async () => {
    const probes = recorder<MenuListContextValue>();
    function Edit({ icon }: { icon?: string }) {
      return (
        <Menu aria-label="Edit">
          <Menu.Item icon={icon ? { children: icon } : undefined}>Cut</Menu.Item>
          <Menu.Item>Copy</Menu.Item>
          <ListProbe id="list" record={probes.record} />
        </Menu>
      );
    }
    const { rerender } = render(<Edit />);
    expect(probes.last('list')).toStrictEqual({ hasIcons: false, hasCheckmarks: false });
    rerender(<Edit icon="C" />);
    await act(async () => {});
    expect(probes.last('list')).toStrictEqual({ hasIcons: true, hasCheckmarks: false });
    rerender(<Edit />);
    await act(async () => {});
    expect(probes.last('list')).toStrictEqual({ hasIcons: false, hasCheckmarks: false });
  });

  it('hasCheckmarks is true while the list holds a checkbox or radio item (its check column), not for a switch', async () => {
    const probes = recorder<MenuListContextValue>();
    function View({ kind }: { kind: 'none' | 'checkbox' | 'radio' | 'switch' }) {
      return (
        <Menu aria-label="View" defaultCheckedValues={{ panel: ['ruler'] }}>
          <Menu.Item>Zoom</Menu.Item>
          {kind === 'checkbox' && (
            <Menu.ItemCheckbox name="panel" value="ruler">
              Ruler
            </Menu.ItemCheckbox>
          )}
          {kind === 'radio' && (
            <Menu.ItemRadio name="size" value="small">
              Small
            </Menu.ItemRadio>
          )}
          {kind === 'switch' && (
            <Menu.ItemSwitch name="panel" value="grid">
              Grid
            </Menu.ItemSwitch>
          )}
          <ListProbe id="list" record={probes.record} />
        </Menu>
      );
    }
    const { rerender } = render(<View kind="none" />);
    expect(probes.last('list')?.hasCheckmarks).toBe(false);
    for (const [kind, expected] of [
      ['checkbox', true],
      ['switch', false],
      ['radio', true],
      ['none', false],
    ] as const) {
      rerender(<View kind={kind} />);
      await act(async () => {});
      expect(probes.last('list')?.hasCheckmarks).toBe(expected);
    }
  });

  it('notices an item added by a component that does not re-render the probe', async () => {
    const probes = recorder<MenuListContextValue>();
    type ShowIcon = (show: boolean) => void;
    function LateIcon({ ref }: { ref: React.Ref<ShowIcon> }) {
      const [show, setShow] = React.useState(false);
      React.useImperativeHandle(ref, () => setShow, []);
      return show ? <Menu.Item icon={{ children: 'P' }}>Paste</Menu.Item> : null;
    }
    // The probe is memoised, so only the observed list tells it about the new icon.
    const Probe = React.memo(ListProbe);
    const showIcon = React.createRef<ShowIcon>();
    render(
      <Menu aria-label="Edit">
        <Menu.Item>Cut</Menu.Item>
        <LateIcon ref={showIcon} />
        <Probe id="list" record={probes.record} />
      </Menu>,
    );
    expect(probes.last('list')?.hasIcons).toBe(false);
    act(() => showIcon.current?.(true));
    await act(async () => {});
    expect(probes.last('list')?.hasIcons).toBe(true);
    act(() => showIcon.current?.(false));
    await act(async () => {});
    expect(probes.last('list')?.hasIcons).toBe(false);
  });

  it('is right in the commit that opens a popup menu, and each list has its own columns', async () => {
    const user = userEvent.setup();
    const probes = recorder<MenuListContextValue>();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">File</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item icon={{ children: 'N' }}>New</Menu.Item>
          <ListProbe id="root" record={probes.record} />
          <Menu>
            <Menu.Trigger>
              <Menu.Item>Open recent</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>report.docx</Menu.Item>
              <ListProbe id="submenu" record={probes.record} />
            </Menu.Popover>
          </Menu>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(probes.last('root')).toStrictEqual({ hasIcons: true, hasCheckmarks: false });
    await user.click(item('Open recent'));
    expect(probes.last('submenu')).toStrictEqual({ hasIcons: false, hasCheckmarks: false });
  });

  it('keeps the same object while the columns stay the same', () => {
    const probes = recorder<MenuListContextValue>();
    function Edit({ tick }: { tick: number }) {
      return (
        <Menu aria-label="Edit" data-tick={tick}>
          <Menu.Item icon={{ children: 'C' }}>Cut</Menu.Item>
          <ListProbe id="list" record={probes.record} />
        </Menu>
      );
    }
    const { rerender } = render(<Edit tick={0} />);
    const first = probes.last('list');
    rerender(<Edit tick={1} />);
    expect(probes.last('list')).toBe(first);
  });

  it('throws outside a menu list in development (C-CONTEXT): outside any Menu, and in a popup Menu outside Menu.Popover', () => {
    expectThrows(<ListProbe id="orphan" record={() => {}} />, LIST_ERROR);
    expectThrows(
      <Menu open={false} onOpenChange={() => {}}>
        <ListProbe id="outside" record={() => {}} />
      </Menu>,
      LIST_ERROR,
    );
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a menu list and returns the inert value', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const probes = recorder<MenuListContextValue>();
        const { rerender } = render(<ListProbe id="orphan" record={probes.record} />);
        rerender(<ListProbe id="orphan" record={probes.record} />);
        expect(error.mock.calls).toEqual([[LIST_ERROR]]);
        expect(probes.last('orphan')).toStrictEqual({ hasIcons: false, hasCheckmarks: false });
      } finally {
        error.mockRestore();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// A menu item of your own
// ---------------------------------------------------------------------------

describe('a menu item of your own (useMenuContext, useMenuListContext)', () => {
  it('is a named, described menu item, with no axe violation', async () => {
    const user = userEvent.setup();
    render(<NewMenu />);
    await user.click(newButton());
    const blank = item('Blank document');
    expect(blank).toHaveAccessibleDescription('Start from an empty page');
    await expectNoA11yViolations(document.body);
  });

  it('arrow keys and typeahead reach it; Enter activates it, closes the menu and returns focus', async () => {
    const user = userEvent.setup();
    const onBlank = vi.fn();
    const onNotes = vi.fn();
    const onOpenChange = vi.fn();
    render(<NewMenu menu={{ onOpenChange }} onBlank={onBlank} onNotes={onNotes} />);
    await openNewMenu(user);
    // The roving tab index of the menu manages it as one of its items.
    expect(item('Blank document')).toHaveAttribute('tabindex', '0');
    await user.keyboard('{ArrowDown}');
    expect(item('Meeting notes')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Open')).toHaveFocus();
    await user.keyboard('{End}{Home}');
    expect(item('Blank document')).toHaveFocus();
    // Typeahead matches its text, which starts with its title.
    await user.keyboard('m');
    expect(item('Meeting notes')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('Blank document')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onBlank).toHaveBeenCalledTimes(1);
    expect(onNotes).not.toHaveBeenCalled();
    expect(queryMenu()).not.toBeInTheDocument();
    expect(newButton()).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('a click activates it and closes the menu; the pointer focuses it while focus is in the menu', async () => {
    const user = userEvent.setup();
    const onNotes = vi.fn();
    render(<NewMenu onNotes={onNotes} />);
    await openNewMenu(user);
    await user.hover(item('Meeting notes'));
    expect(item('Meeting notes')).toHaveFocus();
    await user.click(item('Meeting notes'));
    expect(onNotes).toHaveBeenCalledTimes(1);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(newButton()).toHaveFocus();
  });

  it('reserves the check and icon columns of its list, as the built-in items do', async () => {
    const user = userEvent.setup();
    render(<NewMenu />);
    await user.click(newButton());
    const blank = item('Blank document');
    const columns = Array.from(blank.querySelectorAll('[data-column]'), (el) =>
      el.getAttribute('data-column'),
    );
    expect(columns).toEqual(['checkmark', 'icon']);
  });

  it('calls onSelect and onOpenChange once per activation in StrictMode', async () => {
    const user = userEvent.setup();
    const onBlank = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <NewMenu menu={{ onOpenChange }} onBlank={onBlank} />
      </React.StrictMode>,
    );
    await openNewMenu(user);
    await user.keyboard('{Enter}');
    expect(onBlank).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    await user.click(newButton());
    await user.click(item('Blank document'));
    expect(onBlank).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });

  describe('server rendering', () => {
    function EditMenu({ Item = TemplateItem }: { Item?: React.ComponentType<TemplateItemProps> }) {
      return (
        <Menu aria-label="Edit">
          <Menu.Item icon={{ children: 'C' }}>Cut</Menu.Item>
          <Item title="Paste as text" description="Without formatting" />
        </Menu>
      );
    }

    it('renders on the server without the columns, then hydrates without an error and shows them', async () => {
      const html = renderToString(<EditMenu />);
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
      expect(html).not.toContain('data-column');
      const container = document.createElement('div');
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        container.innerHTML = html;
        document.body.appendChild(container);
        const own = item('Paste as text');
        await act(async () => {
          root = hydrateRoot(container, <EditMenu />);
        });
        expect(error).not.toHaveBeenCalled();
        expect(item('Paste as text')).toBe(own);
        expect(own.querySelector('[data-column="icon"]')).not.toBeNull();
        expect(own.querySelector('[data-column="checkmark"]')).toBeNull();
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });

    it('an item imported by a Server Component (a client reference) renders the same and works the same', async () => {
      const ReferenceItem = asClientReference(TemplateItem);
      // React.useId differs between the two trees (the lazy wrapper adds a level), nothing else.
      const withoutIds = (markup: string) => markup.replace(/(id|aria-\w+by)="[^"]*"/g, '$1=""');
      expect(withoutIds(renderToString(<EditMenu Item={ReferenceItem} />))).toBe(
        withoutIds(renderToString(<EditMenu />)),
      );

      const user = userEvent.setup();
      const onBlank = vi.fn();
      render(<NewMenu Item={ReferenceItem} onBlank={onBlank} />);
      await openNewMenu(user);
      expect(item('Blank document').querySelector('[data-column="icon"]')).not.toBeNull();
      await user.keyboard('{Enter}');
      expect(onBlank).toHaveBeenCalledTimes(1);
      expect(queryMenu()).not.toBeInTheDocument();
      expect(newButton()).toHaveFocus();
    });
  });
});

// ---------------------------------------------------------------------------
// Exports and types
// ---------------------------------------------------------------------------

describe('Menu hooks — exports and types', () => {
  it('Menu re-exports the hooks of their own module (flat names)', () => {
    expect(useMenuContext).toBe(HooksModule.useMenuContext);
    expect(useMenuListContext).toBe(HooksModule.useMenuListContext);
  });

  it('useMenuContext returns the narrow value', () => {
    expectTypeOf(useMenuContext).toEqualTypeOf<() => MenuContextValue>();
    expectTypeOf<MenuContextValue>().toEqualTypeOf<{
      open: boolean;
      close: () => void;
      isSubmenu: boolean;
    }>();
  });

  it('useMenuListContext returns the narrow value', () => {
    expectTypeOf(useMenuListContext).toEqualTypeOf<() => MenuListContextValue>();
    expectTypeOf<MenuListContextValue>().toEqualTypeOf<{
      hasIcons: boolean;
      hasCheckmarks: boolean;
    }>();
  });
});
