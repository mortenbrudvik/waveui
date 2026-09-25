import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Menu, MenuDivider, MenuItem, MenuPopover, MenuTrigger } from '../Menu';
import type { MenuItemProps, MenuProps, MenuTriggerProps } from '../Menu';
import { INERT_MENU_CONTEXT, MenuContext } from '../Menu.context';
import type { MenuContextValue, MenuSurfaceApi } from '../Menu.context';
import type { Slot } from '../../../lib/types';
import { useModalLayer } from '../../../hooks/useModalLayer';
import { Portal } from '../../portal/Portal';
import {
  asClientReference,
  createOverlayTestWrapper,
  expectNoA11yViolations,
  findDanglingIdRefs,
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testCompoundExposure,
  testComposedHandler,
  testSystemProps,
  expectThrows,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const StaticMenuWrapper = createOverlayTestWrapper(Menu, { 'aria-label': 'Edit' });

function renderStaticMenu(props: Partial<MenuProps> = {}, items?: React.ReactNode) {
  return render(
    <Menu aria-label="Edit" data-testid="menu" {...props}>
      {items ?? (
        <>
          <Menu.Item>Item 1</Menu.Item>
          <Menu.Item>Item 2</Menu.Item>
          <Menu.Item>Item 3</Menu.Item>
        </>
      )}
    </Menu>,
  );
}

const item = (name: string) => screen.getByRole('menuitem', { name });

/**
 * Icons that render nothing: `icon={name && <Icon />}` with `name` '' or a count of 0, and a list
 * mapped to nothing (F2 `slotRendersContent`). A factory each, since a generator is one-shot.
 */
const EMPTY_ICONS = [
  ["''", () => ''],
  ['0', () => 0],
  ['an empty array', () => []],
  ['an array of empty items', () => [null, false, '', [undefined]]],
  [
    'a generator of empty items',
    function* emptyItems() {
      yield null;
      yield '';
    },
  ],
] as Array<[string, () => Slot<'span'>]>;

describe('Menu', () => {
  testSystemProps(Menu, {
    expectedTag: 'div',
    displayName: 'Menu',
    defaultProps: {
      'aria-label': 'File',
      children: [
        <Menu.Item key="new">New</Menu.Item>,
        <Menu.Divider key="divider" />,
        <Menu.Item key="open" icon={{ children: 'O' }} shortcut="Ctrl+O">
          Open
        </Menu.Item>,
        <Menu.Item key="exit" disabled>
          Exit
        </Menu.Item>,
      ],
    },
    conflictingClass: { className: 'rounded-none', overrides: 'rounded-md' },
  });

  testCompoundExposure(Menu, ['Item', 'Divider', 'Trigger', 'Popover']);

  it('exports every sub-component under its flat name (C-COMPOUND)', () => {
    expect(MenuItem).toBe(Menu.Item);
    expect(MenuDivider).toBe(Menu.Divider);
    expect(MenuTrigger).toBe(Menu.Trigger);
    expect(MenuPopover).toBe(Menu.Popover);
  });

  it('renders with role="menu"', () => {
    renderStaticMenu();
    expect(screen.getByTestId('menu')).toHaveAttribute('role', 'menu');
  });

  it('renders MenuItems with role="menuitem"', () => {
    render(
      <Menu>
        <Menu.Item>Item 1</Menu.Item>
        <Menu.Item>Item 2</Menu.Item>
      </Menu>,
    );
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('uses the default radius name rounded-md (C-RADIUS)', () => {
    renderStaticMenu();
    const menu = screen.getByTestId('menu');
    expect(menu).toHaveClass('rounded-md');
    expect(menu).not.toHaveClass('rounded-lg');
  });

  it('the static menu element is the group/menu its items align their columns to', () => {
    renderStaticMenu({ className: 'consumer-class' });
    expect(screen.getByTestId('menu')).toHaveClass('group/menu', 'consumer-class');
  });

  describe('roving focus (static menu)', () => {
    it('the container is not a tab stop; the first enabled item holds the tab stop', async () => {
      const user = userEvent.setup();
      renderStaticMenu(
        {},
        <>
          <Menu.Item disabled>Item 1</Menu.Item>
          <Menu.Item>Item 2</Menu.Item>
          <Menu.Item>Item 3</Menu.Item>
        </>,
      );
      expect(screen.getByTestId('menu')).not.toHaveAttribute('tabindex');
      expect(item('Item 2')).toHaveAttribute('tabindex', '0');
      expect(item('Item 3')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(item('Item 2')).toHaveFocus();
      await user.tab({ shift: true });
      expect(document.body).toHaveFocus();
    });

    it('navigates items with ArrowDown', async () => {
      const user = userEvent.setup();
      renderStaticMenu();
      await user.tab();
      expect(item('Item 1')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('Item 2')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('Item 3')).toHaveFocus();
    });

    it('navigates items with ArrowUp from the second item', async () => {
      const user = userEvent.setup();
      renderStaticMenu();
      act(() => item('Item 2').focus());
      await user.keyboard('{ArrowUp}');
      expect(item('Item 1')).toHaveFocus();
    });

    it('wraps ArrowUp from the first item to the last', async () => {
      const user = userEvent.setup();
      renderStaticMenu();
      await user.tab();
      expect(item('Item 1')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(item('Item 3')).toHaveFocus();
    });

    it('wraps ArrowDown from the last item to the first', async () => {
      const user = userEvent.setup();
      renderStaticMenu();
      act(() => item('Item 3').focus());
      await user.keyboard('{ArrowDown}');
      expect(item('Item 1')).toHaveFocus();
    });

    it('skips disabled items in keyboard navigation', async () => {
      const user = userEvent.setup();
      renderStaticMenu(
        {},
        <>
          <Menu.Item>Item 1</Menu.Item>
          <Menu.Item disabled>Item 2</Menu.Item>
          <Menu.Item>Item 3</Menu.Item>
        </>,
      );
      await user.tab();
      expect(item('Item 1')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('Item 3')).toHaveFocus();
    });

    it('Home and End skip a disabled first or last item', async () => {
      const user = userEvent.setup();
      renderStaticMenu(
        {},
        <>
          <Menu.Item disabled>First</Menu.Item>
          <Menu.Item>Second</Menu.Item>
          <Menu.Item>Third</Menu.Item>
          <Menu.Item>Fourth</Menu.Item>
          <Menu.Item disabled>Last</Menu.Item>
        </>,
      );
      act(() => item('Third').focus());
      await user.keyboard('{End}');
      expect(item('Fourth')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(item('Second')).toHaveFocus();
    });

    const typeaheadItems = (
      <>
        <Menu.Item>Copy</Menu.Item>
        <Menu.Item disabled>Cut</Menu.Item>
        <Menu.Item>Paste</Menu.Item>
        <Menu.Item>Clear</Menu.Item>
      </>
    );

    it('typeahead moves to the next item starting with the typed character', async () => {
      const user = userEvent.setup();
      renderStaticMenu({}, typeaheadItems);
      await user.tab();
      await user.keyboard('p');
      expect(item('Paste')).toHaveFocus();
    });

    it('typeahead skips disabled items', async () => {
      const user = userEvent.setup();
      renderStaticMenu({}, typeaheadItems);
      await user.tab();
      expect(item('Copy')).toHaveFocus();
      await user.keyboard('c');
      expect(item('Clear')).toHaveFocus();
    });

    // An element label (an i18n component) is matched by its own text, not by
    // the item's whole text, which starts with the icon's text (an icon-font ligature, an emoji).
    it('typeahead matches an element label, not the text of the icon before it', async () => {
      const user = userEvent.setup();
      const Label = ({ text }: { text: string }) => <>{text}</>;
      renderStaticMenu(
        {},
        <>
          <Menu.Item icon={{ children: 'content_cut' }}>
            <Label text="Cut" />
          </Menu.Item>
          <Menu.Item icon={{ children: 'content_copy' }} shortcut="Ctrl+C">
            <Label text="Copy" />
          </Menu.Item>
          <Menu.Item icon={{ children: 'content_paste' }}>
            <Label text="Paste" />
          </Menu.Item>
        </>,
      );
      await user.tab();
      expect(item('Cut')).toHaveFocus();
      await user.keyboard('p');
      expect(item('Paste')).toHaveFocus();
    });

    it('typeahead uses a label given as a string, as before', () => {
      render(
        <Menu aria-label="Edit">
          <Menu.Item icon={{ children: 'content_cut' }}>Cut</Menu.Item>
        </Menu>,
      );
      expect(item('Cut')).toHaveAttribute('data-roving-text', 'Cut');
    });

    it('does not activate the focused item when Space continues a search that matches nothing', async () => {
      const user = userEvent.setup();
      const onCopy = vi.fn();
      renderStaticMenu(
        {},
        <>
          <Menu.Item>Clear</Menu.Item>
          <Menu.Item onClick={onCopy}>Copy</Menu.Item>
        </>,
      );
      await user.tab();
      await user.keyboard('c');
      expect(item('Copy')).toHaveFocus();
      await user.keyboard(' ');
      expect(onCopy).not.toHaveBeenCalled();
      expect(item('Copy')).toHaveFocus();
    });

    it('keeps the last focused item as the tab stop (tabStop "last-focused")', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Menu aria-label="Edit">
            <Menu.Item>Item 1</Menu.Item>
            <Menu.Item>Item 2</Menu.Item>
          </Menu>
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(item('Item 2')).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(item('Item 2')).toHaveFocus();
    });

    describe('every item disabled', () => {
      function AllDisabledMenu({ cutDisabled = true }: { cutDisabled?: boolean }) {
        return (
          <>
            <button type="button">Before</button>
            <Menu aria-label="Edit" data-testid="menu">
              <Menu.Item disabled={cutDisabled}>Cut</Menu.Item>
              <Menu.Item disabled>Copy</Menu.Item>
            </Menu>
            <button type="button">After</button>
          </>
        );
      }

      it('the menu itself holds the tab stop, so Tab still reaches it', async () => {
        const user = userEvent.setup();
        render(<AllDisabledMenu />);
        const menu = screen.getByTestId('menu');
        expect(menu).toHaveAttribute('tabindex', '0');
        expect(item('Cut')).toHaveAttribute('tabindex', '-1');
        expect(item('Copy')).toHaveAttribute('tabindex', '-1');

        await user.tab();
        await user.tab();
        expect(menu).toHaveFocus();
        // Nothing to move to: the keys leave focus on the menu.
        await user.keyboard('{ArrowDown}{End}');
        expect(menu).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
        await user.tab({ shift: true });
        expect(menu).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
      });

      it('shows the focus ring on the menu while it holds focus (C-FOCUS)', () => {
        render(<AllDisabledMenu />);
        expect(screen.getByTestId('menu')).toHaveClass('focus-visible:outline-2');
      });

      it('gives the tab stop back to the items once one is enabled, moving focus there', async () => {
        const { rerender } = render(<AllDisabledMenu />);
        const menu = screen.getByTestId('menu');
        act(() => menu.focus());
        rerender(<AllDisabledMenu cutDisabled={false} />);
        // The roving hook's MutationObserver reports the enabled item in a microtask.
        await act(async () => {});
        expect(menu).not.toHaveAttribute('tabindex');
        expect(item('Cut')).toHaveAttribute('tabindex', '0');
        expect(item('Cut')).toHaveFocus();
      });

      it('takes the tab stop when the last enabled item disables itself', async () => {
        const user = userEvent.setup();
        function DisablesItself() {
          const [disabled, setDisabled] = React.useState(false);
          return (
            <Menu.Item disabled={disabled} onClick={() => setDisabled(true)}>
              Once
            </Menu.Item>
          );
        }
        render(
          <Menu aria-label="Edit" data-testid="menu">
            <DisablesItself />
            <Menu.Item disabled>Never</Menu.Item>
          </Menu>,
        );
        const menu = screen.getByTestId('menu');
        expect(menu).not.toHaveAttribute('tabindex');
        await user.click(item('Once'));
        await act(async () => {});
        expect(item('Once')).toHaveAttribute('tabindex', '-1');
        expect(menu).toHaveAttribute('tabindex', '0');
      });

      it("keeps the consumer's own tabIndex on the menu", () => {
        render(
          <Menu aria-label="Edit" data-testid="menu" tabIndex={-1}>
            <Menu.Item disabled>Cut</Menu.Item>
          </Menu>,
        );
        expect(screen.getByTestId('menu')).toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('item activation', () => {
    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('%s activates the focused item', async (_name, key) => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      renderStaticMenu(
        {},
        <>
          <Menu.Item onClick={onClick}>Save</Menu.Item>
          <Menu.Item>Close</Menu.Item>
        </>,
      );
      await user.tab();
      await user.keyboard(key);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['Enter', 'Enter'],
      ['Space', ' '],
    ])('%s does nothing on a disabled item', (_name, key) => {
      const onClick = vi.fn();
      renderStaticMenu(
        {},
        <Menu.Item disabled onClick={onClick}>
          Disabled
        </Menu.Item>,
      );
      const disabled = item('Disabled');
      const notPrevented = fireEvent.keyDown(disabled, { key });
      expect(onClick).not.toHaveBeenCalled();
      // The key is consumed (no page scroll) even though nothing is activated.
      expect(notPrevented).toBe(false);
    });

    it('a consumer aria-disabled without disabled only changes the look: Enter and Space still activate', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      renderStaticMenu(
        {},
        <>
          <Menu.Item aria-disabled="true" onClick={onClick}>
            Save
          </Menu.Item>
          <Menu.Item>Close</Menu.Item>
        </>,
      );
      act(() => item('Save').focus());
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('renders disabled items with aria-disabled', () => {
      render(
        <Menu>
          <Menu.Item disabled>Disabled</Menu.Item>
        </Menu>,
      );
      expect(screen.getByRole('menuitem')).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not call onClick on disabled items', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Menu>
          <Menu.Item disabled onClick={onClick}>
            Disabled
          </Menu.Item>
        </Menu>,
      );
      await user.click(screen.getByRole('menuitem'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('composition (C-COMPOSE)', () => {
    testComposedHandler(Menu, {
      handler: 'onKeyDown',
      defaultProps: {
        'aria-label': 'Edit',
        children: [<Menu.Item key="a">Alpha</Menu.Item>, <Menu.Item key="b">Beta</Menu.Item>],
      },
      act: async ({ user }) => {
        act(() => item('Alpha').focus());
        await user.keyboard('{ArrowDown}');
      },
      assertInternal: () => {
        expect(item('Beta')).toHaveFocus();
      },
      assertInternalSuppressed: () => {
        expect(item('Alpha')).toHaveFocus();
      },
    });

    it('a consumer onKeyDown on Menu.Item composes with Enter activation', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      const onClick = vi.fn();
      renderStaticMenu(
        {},
        <Menu.Item onKeyDown={onKeyDown} onClick={onClick}>
          Save
        </Menu.Item>,
      );
      await user.tab();
      await user.keyboard('{Enter}');
      expect(onKeyDown).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('a consumer onKeyDown on Menu.Item that stops propagation keeps Space activation', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      renderStaticMenu(
        {},
        <Menu.Item onKeyDown={(e) => e.stopPropagation()} onClick={onClick}>
          Save
        </Menu.Item>,
      );
      await user.tab();
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])(
      'a consumer onKeyDown on Menu.Item that prevents default suppresses %s activation',
      async (_name, key) => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        renderStaticMenu(
          {},
          <Menu.Item onKeyDown={(e) => e.preventDefault()} onClick={onClick}>
            Save
          </Menu.Item>,
        );
        await user.tab();
        await user.keyboard(key);
        expect(onClick).not.toHaveBeenCalled();
      },
    );
  });

  describe('Menu.Item', () => {
    testSystemProps(Menu.Item, {
      expectedTag: 'div',
      displayName: 'MenuItem',
      wrapper: StaticMenuWrapper,
      defaultProps: { children: 'Save', shortcut: 'Ctrl+S' },
      a11yVariants: [{ name: 'disabled', props: { disabled: true } }],
      conflictingClass: { className: 'px-6', overrides: 'px-3' },
    });

    it('renders the icon slot aria-hidden, so icon text is not part of the name', () => {
      render(
        <Menu>
          <Menu.Item icon={{ children: 'icon-text' }}>Item</Menu.Item>
        </Menu>,
      );
      expect(screen.getByText('icon-text')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('menuitem')).toHaveAccessibleName('Item');
    });

    it('lets a slot object override the icon aria-hidden default', () => {
      render(
        <Menu>
          <Menu.Item icon={{ children: 'icon-text', 'aria-hidden': false }}>Item</Menu.Item>
        </Menu>,
      );
      expect(screen.getByText('icon-text')).toHaveAttribute('aria-hidden', 'false');
    });

    // An icon that renders nothing is no icon, as in Nav, Tree and Avatar: no empty 20px
    // aria-hidden box before the label. The item keeps only the hidden column placeholders, which
    // show when another item of the menu has an icon (or a check).
    it.each(EMPTY_ICONS)('renders no icon box for an icon set to %s', (_kind, makeIcon) => {
      render(
        <Menu>
          <Menu.Item icon={makeIcon()}>Item</Menu.Item>
        </Menu>,
      );
      const menuItem = screen.getByRole('menuitem');
      expect(menuItem.querySelector('[data-menu-icon]')).toBeNull();
      expect(
        Array.from(menuItem.querySelectorAll('[aria-hidden="true"]'), (hidden) =>
          hidden.getAttribute('data-menu-column-space'),
        ),
      ).toEqual(['checkmark', 'icon']);
      expect(menuItem.textContent).toBe('Item');
    });

    it('renders the items of a generator icon that has content (the check does not consume it)', () => {
      function* glyphs() {
        yield null;
        yield <svg key="glyph" data-testid="glyph" />;
      }
      render(
        <Menu>
          <Menu.Item icon={glyphs()}>Item</Menu.Item>
        </Menu>,
      );
      expect(screen.getByTestId('glyph').parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders shortcut text after the label with a logical margin (C-LOGICAL)', () => {
      render(
        <Menu>
          <Menu.Item shortcut="Ctrl+S">Save</Menu.Item>
        </Menu>,
      );
      const shortcut = screen.getByText('Ctrl+S');
      expect(shortcut).toHaveClass('ms-4');
      expect(shortcut).not.toHaveClass('ml-4');
    });

    it('keeps the logical shortcut margin in RTL', () => {
      renderWithProviders(
        <Menu>
          <Menu.Item shortcut="Ctrl+S">Save</Menu.Item>
        </Menu>,
        { dir: 'rtl' },
      );
      expect(screen.getByRole('menuitem').closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(screen.getByText('Ctrl+S')).toHaveClass('ms-4');
    });

    it('has the shared focus ring and a focus background that matches hover (C-FOCUS)', () => {
      render(
        <Menu>
          <Menu.Item>Save</Menu.Item>
        </Menu>,
      );
      expect(screen.getByRole('menuitem')).toHaveClass(
        'focus-visible:outline-2',
        'focus-visible:outline-ring',
        'not-disabled:not-aria-disabled:focus:bg-subtle-hover',
        'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
      );
    });

    it('gates the focus background like hover, so a clicked disabled item shows no highlight', async () => {
      const user = userEvent.setup();
      render(
        <Menu>
          <Menu.Item>Save</Menu.Item>
          <Menu.Item disabled>Paste</Menu.Item>
        </Menu>,
      );
      const paste = item('Paste');
      await user.click(paste);
      // Mouse focus reaches the disabled item (roving tabindex -1), so the background is gated.
      expect(paste).toHaveFocus();
      expect(paste).toHaveAttribute('aria-disabled', 'true');
      expect(paste).not.toHaveClass('focus:bg-subtle-hover');
      expect(paste).toHaveClass('not-disabled:not-aria-disabled:focus:bg-subtle-hover');
    });

    it('uses theme tokens only (no raw hover color)', () => {
      render(
        <Menu>
          <Menu.Item>Save</Menu.Item>
        </Menu>,
      );
      expect(screen.getByRole('menuitem').className).not.toMatch(/#[0-9a-f]{3,6}/i);
    });

    it('does not carry its own tabIndex (the menu manages the tab stop)', () => {
      render(
        <Menu>
          <Menu.Item>Only</Menu.Item>
        </Menu>,
      );
      expect(screen.getByRole('menuitem')).toHaveAttribute('tabindex', '0');
    });
  });

  describe('Menu.Divider', () => {
    testSystemProps(Menu.Divider, {
      expectedTag: 'div',
      displayName: 'MenuDivider',
      wrapper: StaticMenuWrapper,
      a11y: false,
    });

    it('renders MenuDivider with role="separator"', () => {
      render(
        <Menu>
          <Menu.Item>Item 1</Menu.Item>
          <Menu.Divider />
          <Menu.Item>Item 2</Menu.Item>
        </Menu>,
      );
      expect(screen.getByRole('separator')).toBeInTheDocument();
      expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    });

    it('is skipped by arrow navigation', async () => {
      const user = userEvent.setup();
      render(
        <Menu>
          <Menu.Item>Item 1</Menu.Item>
          <Menu.Divider />
          <Menu.Item>Item 2</Menu.Item>
        </Menu>,
      );
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(item('Item 2')).toHaveFocus();
    });
  });
});

// ---------------------------------------------------------------------------
// Popup menu: Menu.Trigger + Menu.Popover (feedback-navigation#51)
// ---------------------------------------------------------------------------

interface PopupMenuProps extends Partial<Omit<MenuProps, 'children'>> {
  onEdit?: () => void;
  onDelete?: () => void;
  persistDelete?: boolean;
  trigger?: React.ReactNode;
  itemProps?: Partial<MenuItemProps>;
  popoverClassName?: string;
}

function PopupMenu({
  onEdit,
  onDelete,
  persistDelete,
  trigger,
  itemProps,
  popoverClassName,
  ...menuProps
}: PopupMenuProps) {
  return (
    <Menu {...menuProps}>
      <Menu.Trigger>{trigger ?? <button type="button">Actions</button>}</Menu.Trigger>
      <Menu.Popover className={popoverClassName}>
        <Menu.Item onClick={onEdit} {...itemProps}>
          Edit
        </Menu.Item>
        <Menu.Item disabled>Copy</Menu.Item>
        <Menu.Item onClick={onDelete} persistOnClick={persistDelete}>
          Delete
        </Menu.Item>
        <Menu.Item disabled>Archive</Menu.Item>
      </Menu.Popover>
    </Menu>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Actions' });
const queryMenu = () => screen.queryByRole('menu');

describe('Menu popup (Menu.Trigger + Menu.Popover)', () => {
  it('renders only the trigger while closed, with menu-button semantics', () => {
    render(<PopupMenu />);
    const button = trigger();
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('opens on click: aria-expanded, aria-controls, labelled portaled menu, first item focused', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { container } = render(<PopupMenu onOpenChange={onOpenChange} />);
    await user.click(trigger());
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', menu.id);
    expect(container.contains(menu)).toBe(false); // portaled
    expect(item('Edit')).toHaveFocus();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
    ['ArrowDown', '{ArrowDown}'],
  ])('%s on the trigger opens the menu and focuses the first enabled item', async (_n, key) => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    act(() => trigger().focus());
    await user.keyboard(key);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(item('Edit')).toHaveFocus();
  });

  it('ArrowUp on the trigger opens the menu and focuses the last enabled item', async () => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    act(() => trigger().focus());
    await user.keyboard('{ArrowUp}');
    expect(item('Delete')).toHaveFocus();
  });

  it('roves inside the popover with arrows (disabled items skipped) and typeahead', async () => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    await user.click(trigger());
    await user.keyboard('{ArrowDown}');
    expect(item('Delete')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Edit')).toHaveFocus();
    await user.keyboard('d');
    expect(item('Delete')).toHaveFocus();
  });

  it('selecting an item calls onClick, closes the menu and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onOpenChange = vi.fn();
    render(<PopupMenu onEdit={onEdit} onOpenChange={onOpenChange} />);
    await user.click(trigger());
    await user.click(item('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Enter on an item selects it, closes and restores focus', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PopupMenu onEdit={onEdit} />);
    act(() => trigger().focus());
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('Space on an item selects it once, closes and restores focus', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <PopupMenu onEdit={onEdit} onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    act(() => trigger().focus());
    await user.keyboard('{Enter}');
    expect(item('Edit')).toHaveFocus();
    await user.keyboard(' ');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('a Space that continues a typeahead search does not activate the focused item', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<PopupMenu onDelete={onDelete} />);
    await user.click(trigger());
    await user.keyboard('d');
    expect(item('Delete')).toHaveFocus();
    await user.keyboard(' ');
    expect(onDelete).not.toHaveBeenCalled();
    expect(item('Delete')).toHaveFocus();
  });

  it.each([
    ['Ctrl+Alt', { ctrlKey: true, altKey: true }],
    ['Ctrl', { ctrlKey: true }],
    ['Alt', { altKey: true }],
    ['Meta', { metaKey: true }],
  ])(
    'leaves %s with Space or Enter to the page, also during a typeahead search: no item activates',
    async (_label, modifiers) => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      render(<PopupMenu onEdit={onEdit} onDelete={onDelete} />);
      await user.click(trigger());
      for (const key of [' ', 'Enter']) {
        expect(fireEvent.keyDown(item('Edit'), { key, ...modifiers })).toBe(true);
      }
      // Also during a search: the chord is no typed character (AltGr types no space).
      await user.keyboard('d');
      expect(item('Delete')).toHaveFocus();
      for (const key of [' ', 'Enter']) {
        expect(fireEvent.keyDown(item('Delete'), { key, ...modifiers })).toBe(true);
      }
      expect(onEdit).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
      expect(item('Delete')).toHaveFocus();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    },
  );

  it('persistOnClick keeps the menu open after selection', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<PopupMenu onDelete={onDelete} persistDelete />);
    await user.click(trigger());
    await user.click(item('Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('a consumer onClick that prevents default keeps the menu open', async () => {
    const user = userEvent.setup();
    render(<PopupMenu onEdit={undefined} itemProps={{ onClick: (e) => e.preventDefault() }} />);
    await user.click(trigger());
    await user.click(item('Edit'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking a disabled item neither selects nor closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<PopupMenu onOpenChange={onOpenChange} />);
    await user.click(trigger());
    await user.click(item('Copy'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('Escape closes the menu and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<PopupMenu onOpenChange={onOpenChange} />);
    await user.click(trigger());
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(trigger()).toHaveFocus();
  });

  it('Tab closes the menu, moves focus to the trigger and lets the browser continue tabbing', async () => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    await user.click(trigger());
    const notPrevented = fireEvent.keyDown(item('Edit'), { key: 'Tab' });
    expect(notPrevented).toBe(true);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('Shift+Tab also closes without preventing the default', async () => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    await user.click(trigger());
    const notPrevented = fireEvent.keyDown(item('Edit'), { key: 'Tab', shiftKey: true });
    expect(notPrevented).toBe(true);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('an outside press closes the menu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PopupMenu />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(queryMenu()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  describe('an item that opens a modal (a "Delete…" confirmation)', () => {
    /**
     * A stand-in Dialog on F4's useModalLayer + Portal (§5.9: the composition with the real
     * Dialog is INTEGRATION's). Like Dialog, it records its opener when it opens, traps focus,
     * makes the page inert and restores focus to the opener when it closes.
     */
    function StandInModal({
      open,
      onOpenChange,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const surfaceRef = React.useRef<HTMLDivElement | null>(null);
      const attachSurface = React.useCallback((node: HTMLDivElement | null) => {
        surfaceRef.current = node;
        setSurface(node);
      }, []);
      const layer = useModalLayer({
        open,
        onDismiss: () => onOpenChange(false),
        refs: [surfaceRef],
        container: surface,
      });
      if (!open) return null;
      return (
        <Portal layerId={layer.layerId}>
          <div ref={attachSurface} role="dialog" aria-label="Delete file?" tabIndex={-1}>
            <button type="button">Confirm</button>
          </div>
        </Portal>
      );
    }

    function MenuWithConfirm() {
      const [confirmOpen, setConfirmOpen] = React.useState(false);
      return (
        <>
          <Menu>
            <Menu.Trigger>
              <button type="button">Actions</button>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item onClick={() => setConfirmOpen(true)}>Delete…</Menu.Item>
            </Menu.Popover>
          </Menu>
          <StandInModal open={confirmOpen} onOpenChange={setConfirmOpen} />
        </>
      );
    }

    it('keyboard: focus moves into the modal, and back to the trigger when it closes', async () => {
      const user = userEvent.setup();
      render(<MenuWithConfirm />);
      act(() => trigger().focus());
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      const dialog = screen.getByRole('dialog', { name: 'Delete file?' });
      expect(queryMenu()).not.toBeInTheDocument();
      expect(dialog.contains(document.activeElement)).toBe(true);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });

    it('mouse: focus returns to the trigger when the modal closes', async () => {
      const user = userEvent.setup();
      render(<MenuWithConfirm />);
      await user.click(trigger());
      await user.click(item('Delete…'));
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

      await user.keyboard('{Escape}');
      expect(trigger()).toHaveFocus();
    });

    it('an item onClick that moves focus elsewhere keeps it there', async () => {
      const user = userEvent.setup();
      render(
        <>
          <PopupMenu
            itemProps={{ onClick: () => screen.getByRole('textbox', { name: 'Name' }).focus() }}
          />
          <input aria-label="Name" />
        </>,
      );
      await user.click(trigger());
      await user.click(item('Edit'));
      expect(queryMenu()).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });
  });

  it('clicking the trigger again closes the menu', async () => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    await user.click(trigger());
    await user.click(trigger());
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('defaultOpen renders the menu open', () => {
    render(<PopupMenu defaultOpen />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(item('Edit')).toHaveFocus();
  });

  it.each([
    ['a defaultOpen', { defaultOpen: true }],
    ['an open', { open: true }],
  ])('renders %s menu closed on the server, so every referenced id exists', (_label, props) => {
    const serverHtml = renderToString(<PopupMenu {...props} />);
    expect(findDanglingIdRefsInHtml(serverHtml)).toEqual([]);
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = serverHtml;
    const button = parsed.querySelector('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
  });

  it.each([
    ['defaultOpen', { defaultOpen: true }],
    ['open', { open: true }],
  ])('opens once hydrated (%s), without a mismatch or an onOpenChange call', async (_l, props) => {
    const onOpenChange = vi.fn();
    const element = <PopupMenu {...props} onOpenChange={onOpenChange} />;
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element);
      });
      expect(error).not.toHaveBeenCalled();
      const menu = screen.getByRole('menu', { name: 'Actions' });
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      expect(trigger()).toHaveAttribute('aria-controls', menu.id);
      expect(item('Edit')).toHaveFocus();
      expect(onOpenChange).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it('controlled: follows `open` and reports onOpenChange without changing itself', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<PopupMenu open={false} onOpenChange={onOpenChange} />);
    await user.click(trigger());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(queryMenu()).not.toBeInTheDocument();
    rerender(<PopupMenu open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('StrictMode: onOpenChange fires exactly once per interaction', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <PopupMenu onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.click(trigger());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(item('Edit')).toHaveFocus();
    await user.click(item('Edit'));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(trigger()).toHaveFocus();
  });

  it('composes the trigger child onClick (consumer first) with opening', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PopupMenu
        trigger={
          <button type="button" onClick={onClick} className="consumer-class">
            Actions
          </button>
        }
      />,
    );
    await user.click(trigger());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger()).toHaveClass('consumer-class');
  });

  it('a trigger child onClick that prevents default suppresses opening', async () => {
    const user = userEvent.setup();
    render(
      <PopupMenu
        trigger={
          <button type="button" onClick={(e) => e.preventDefault()}>
            Actions
          </button>
        }
      />,
    );
    await user.click(trigger());
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it("keeps the trigger child's own id and labels the menu with it", async () => {
    const user = userEvent.setup();
    render(
      <PopupMenu
        trigger={
          <button type="button" id="my-trigger">
            Actions
          </button>
        }
      />,
    );
    expect(trigger()).toHaveAttribute('id', 'my-trigger');
    await user.click(trigger());
    expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', 'my-trigger');
  });

  it('the trigger ARIA state wins over the child’s static attributes', () => {
    render(
      <PopupMenu
        trigger={
          <button type="button" aria-expanded="true" aria-haspopup="dialog">
            Actions
          </button>
        }
      />,
    );
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
  });

  // §5.3: a Tooltip clones `aria-describedby` onto Menu.Trigger, which must reach the child.
  it('forwards unknown props, className, ref and handlers of Menu.Trigger to its child', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = React.createRef<HTMLElement>();
    render(
      <>
        <span id="own-hint">Own hint.</span>
        <span id="tooltip-hint">Opens the file actions.</span>
        <Menu>
          <Menu.Trigger
            ref={ref}
            id="from-trigger"
            aria-describedby="tooltip-hint"
            aria-expanded="true"
            className="trigger-class"
            data-testid="menu-trigger"
            title="File actions"
            onClick={onClick}
          >
            <button type="button" aria-describedby="own-hint" className="child-class">
              Actions
            </button>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Edit</Menu.Item>
          </Menu.Popover>
        </Menu>
      </>,
    );
    const button = trigger();
    expect(screen.getByTestId('menu-trigger')).toBe(button);
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute('id', 'from-trigger');
    expect(button).toHaveAttribute('title', 'File actions');
    expect(button).toHaveClass('trigger-class', 'child-class');
    expect(button.getAttribute('aria-describedby')?.split(' ').sort()).toEqual([
      'own-hint',
      'tooltip-hint',
    ]);
    expect(button).toHaveAccessibleDescription(/Opens the file actions\./);
    // Live state ARIA still wins over a static value passed to Menu.Trigger.
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', 'from-trigger');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(item('Edit')).toHaveFocus();
  });

  it('a Menu.Trigger onClick or onKeyDown that prevents default suppresses opening', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger onClick={(e) => e.preventDefault()} onKeyDown={(e) => e.preventDefault()}>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    expect(queryMenu()).not.toBeInTheDocument();
    act(() => trigger().focus());
    await user.keyboard('{ArrowDown}');
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('passes forwarded props to a render-prop child and to the asChild={false} wrapper', () => {
    render(
      <>
        <Menu>
          <Menu.Trigger aria-describedby="hint-a">
            {(props: MenuTriggerProps) => (
              <button type="button" {...props}>
                Actions
              </button>
            )}
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Edit</Menu.Item>
          </Menu.Popover>
        </Menu>
        <Menu>
          <Menu.Trigger asChild={false} aria-describedby="hint-b" data-testid="wrapper">
            Open menu
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Edit</Menu.Item>
          </Menu.Popover>
        </Menu>
      </>,
    );
    expect(trigger()).toHaveAttribute('aria-describedby', 'hint-a');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    const wrapper = screen.getByTestId('wrapper');
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).toHaveAttribute('aria-describedby', 'hint-b');
    // A generic span cannot carry the state ARIA (axe aria-allowed-attr), and text has no
    // element to move it to.
    expect(wrapper).not.toHaveAttribute('aria-haspopup');
    expect(wrapper).not.toHaveAttribute('aria-expanded');
  });

  it('accepts a render-prop child that receives the trigger props', async () => {
    const user = userEvent.setup();
    const seen: MenuTriggerProps[] = [];
    render(
      <Menu>
        <Menu.Trigger>
          {(props: MenuTriggerProps) => {
            seen.push(props);
            return (
              <button type="button" {...props}>
                Actions
              </button>
            );
          }}
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    expect(seen[seen.length - 1]).toMatchObject({
      'aria-haspopup': 'menu',
      'aria-expanded': false,
    });
    await user.click(trigger());
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(seen[seen.length - 1]['aria-controls']).toBe(screen.getByRole('menu').id);
  });

  it('asChild={false} renders the wrapper span around the children', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger asChild={false}>Open menu</Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    const wrapper = screen.getByText('Open menu');
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).not.toHaveAttribute('aria-haspopup');
    await user.click(wrapper);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(wrapper).not.toHaveAttribute('aria-expanded');
    expect(wrapper).not.toHaveAttribute('aria-controls');
  });

  it('Menu.Popover is the group/menu its items align their columns to', async () => {
    const user = userEvent.setup();
    render(<PopupMenu popoverClassName="popover-class" />);
    await user.click(trigger());
    expect(screen.getByRole('menu', { name: 'Actions' })).toHaveClass(
      'group/menu',
      'popover-class',
    );
  });

  it('forwards className, ref and rest props of Menu.Popover to the menu surface', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover ref={ref} className="popover-class" data-testid="surface">
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    const surface = screen.getByTestId('surface');
    expect(ref.current).toBe(surface);
    expect(surface).toHaveAttribute('role', 'menu');
    expect(surface).toHaveClass('popover-class', 'rounded-md');
    expect(surface).toHaveAttribute('data-state', 'open');
  });

  it('a consumer onKeyDown on Menu.Popover composes with roving', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover onKeyDown={onKeyDown}>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    await user.keyboard('{ArrowDown}');
    expect(onKeyDown).toHaveBeenCalled();
    expect(item('Delete')).toHaveFocus();
  });

  // C-COMPOSE: preventDefault() in the consumer's handler skips ours.
  it('a Menu.Popover onKeyDown that prevents default skips roving and the Tab close', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover onKeyDown={(e) => e.preventDefault()}>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    await user.keyboard('{ArrowDown}');
    expect(item('Edit')).toHaveFocus();
    fireEvent.keyDown(item('Edit'), { key: 'Tab' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(item('Edit')).toHaveFocus();
  });

  // The already-open branch of the trigger keys (the registered surface).
  it('ArrowUp/ArrowDown on the trigger of an open menu focus its last/first enabled item', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<PopupMenu defaultOpen onOpenChange={onOpenChange} />);
    expect(item('Edit')).toHaveFocus();
    // Programmatic focus (or a screen reader) on the trigger keeps the menu open.
    act(() => trigger().focus());
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(item('Delete')).toHaveFocus();
    act(() => trigger().focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Edit')).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // `aria-label` replaces the default name from the trigger.
  it('Menu.Popover aria-label names the menu instead of the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover aria-label="File actions">
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    const menu = screen.getByRole('menu', { name: 'File actions' });
    expect(menu).not.toHaveAttribute('aria-labelledby');
    await expectNoA11yViolations();
  });

  it('a popup menu without Menu.Trigger does not point aria-labelledby at a missing id', () => {
    render(
      <Menu defaultOpen>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    expect(screen.getByRole('menu')).not.toHaveAttribute('aria-labelledby');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  // The label's current text, read when the key is pressed.
  it('typeahead in the popover matches an element label by its current text', async () => {
    const user = userEvent.setup();
    let label = 'Paste';
    const listeners = new Set<() => void>();
    const store = {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      get: () => label,
    };
    // A label that re-renders on its own (a translation that arrives later), not with the item.
    const LiveLabel = () => <>{React.useSyncExternalStore(store.subscribe, store.get)}</>;
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item icon={{ children: 'content_cut' }}>Cut</Menu.Item>
          <Menu.Item icon={{ children: 'content_paste' }}>
            <LiveLabel />
          </Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    act(() => {
      label = 'Insert';
      listeners.forEach((listener) => listener());
    });
    await user.keyboard('i');
    expect(item('Insert')).toHaveFocus();
  });

  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    render(<PopupMenu />);
    await user.click(trigger());
    await expectNoA11yViolations();
  });

  it('has no axe violations while closed', async () => {
    render(<PopupMenu />);
    await expectNoA11yViolations();
  });

  it('Menu.Popover inherits the provider direction', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PopupMenu />, { dir: 'rtl' });
    await user.click(trigger());
    expect(screen.getByRole('menu').closest('[data-wave-portal]')).toHaveAttribute('dir', 'rtl');
  });

  it('a Menu without Trigger/Popover still renders the static role="menu" element', () => {
    render(
      <Menu aria-label="Static" data-testid="static">
        <Menu.Item>One</Menu.Item>
      </Menu>,
    );
    const menu = screen.getByTestId('static');
    expect(menu).toHaveAttribute('role', 'menu');
    expect(within(menu).getByRole('menuitem', { name: 'One' })).toBeInTheDocument();
  });

  describe('development diagnostics', () => {
    it('warns once that a popup menu ignores the DOM props and ref passed to the root', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ref = React.createRef<HTMLDivElement>();
      const { rerender } = render(
        <PopupMenu className="root-class" aria-label="Actions menu" data-testid="root" ref={ref} />,
      );
      rerender(
        <PopupMenu className="root-class" aria-label="Actions menu" data-testid="root" ref={ref} />,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Menu: a popup menu (Menu.Trigger + Menu.Popover) renders no element of its ' +
            'own, so `className`, `aria-label`, `data-testid`, `ref` on Menu are ignored. Pass ' +
            "them to Menu.Popover (the menu surface) or to the trigger's child instead.",
        ],
      ]);
      expect(screen.queryByTestId('root')).not.toBeInTheDocument();
      expect(ref.current).toBeNull();
    });

    it('does not warn for a popup menu without root DOM props (undefined values included)', () => {
      const warn = vi.spyOn(console, 'warn');
      render(<PopupMenu aria-label={undefined} onOpenChange={() => {}} />);
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns when Menu.Trigger/Menu.Popover are wrapped, so Menu falls back to the static menu', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Menu>
          <div>
            <Menu.Trigger>
              <button type="button">Actions</button>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Edit</Menu.Item>
            </Menu.Popover>
          </div>
        </Menu>,
      );
      // One warning for both parts (the first to mount names itself).
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Menu.Trigger: rendered inside a static menu. Menu switches to a popup menu ' +
            'only when Menu.Trigger or Menu.Popover is a direct child (Fragments included); ' +
            'wrapped in another element or component, they are rendered inside the static ' +
            '`role="menu"` element. Make them direct children of Menu, or pass `open`, ' +
            '`defaultOpen` or `onOpenChange` to Menu to force popup mode.',
        ],
      ]);
    });

    it('wrapped Trigger/Popover work as a popup menu when popup mode is forced (defaultOpen)', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      render(
        <Menu defaultOpen={false}>
          <div>
            <Menu.Trigger>
              <button type="button">Actions</button>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Edit</Menu.Item>
            </Menu.Popover>
          </div>
        </Menu>,
      );
      expect(queryMenu()).not.toBeInTheDocument();
      await user.click(trigger());
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(item('Edit')).toHaveFocus();
      expect(warn).not.toHaveBeenCalled();
    });

    // `open` is not ignored by a menu of items; it makes Menu a popup menu.
    it('warns once when open state turns a menu of items into a popup menu without Menu.Popover', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const items = (
        <>
          <Menu.Item>Cut</Menu.Item>
          <Menu.Item>Copy</Menu.Item>
        </>
      );
      const { rerender } = render(<Menu open={false}>{items}</Menu>);
      rerender(<Menu open={false}>{items}</Menu>);
      expect(queryMenu()).not.toBeInTheDocument();
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Menu.Item: rendered in a popup menu outside Menu.Popover, so it has no `role="menu"` parent. A Menu with `open`, `defaultOpen` or `onOpenChange` is a popup menu that renders no element of its own: put the items in Menu.Popover, or leave these props out for a static menu.',
        ],
      ]);
    });

    it('does not warn for the items of Menu.Popover or of a static menu', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      render(
        <>
          <PopupMenu defaultOpen={false} />
          <Menu aria-label="Edit">
            <Menu.Item>Cut</Menu.Item>
          </Menu>
        </>,
      );
      await user.click(trigger());
      expect(item('Edit')).toHaveFocus();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Long menus: the surface fits the viewport and scrolls
// ---------------------------------------------------------------------------

describe('Menu.Popover taller than the viewport', () => {
  const LONG_MENU_ITEMS = Array.from({ length: 40 }, (_, index) => `Command ${index + 1}`);
  /** The size limits, from the available space floating-ui writes as CSS variables. */
  const SIZE_LIMIT_HEIGHT = 'max-h-(--wave-popup-available-height)';
  const SIZE_LIMIT_WIDTH = 'max-w-(--wave-popup-available-width)';

  function LongMenu() {
    return (
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          {LONG_MENU_ITEMS.map((label) => (
            <Menu.Item key={label}>{label}</Menu.Item>
          ))}
        </Menu.Popover>
      </Menu>
    );
  }

  it('limits the open surface to the available height and scrolls inside it', async () => {
    const user = userEvent.setup();
    render(<LongMenu />);
    await user.click(trigger());
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(menu).toHaveClass(
      'overflow-y-auto',
      'overscroll-contain',
      SIZE_LIMIT_HEIGHT,
      SIZE_LIMIT_WIDTH,
    );
    // Classes, not inline styles: a consumer class can replace them (C-COMPOSE).
    expect(menu.style.maxHeight).toBe('');
    expect(menu.style.maxWidth).toBe('');
  });

  it('lets a consumer max-h-* or max-w-* class replace the size limit', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover className="max-h-64 max-w-xs">
          {LONG_MENU_ITEMS.map((label) => (
            <Menu.Item key={label}>{label}</Menu.Item>
          ))}
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(menu).toHaveClass('max-h-64', 'max-w-xs', 'overflow-y-auto');
    expect(menu).not.toHaveClass(SIZE_LIMIT_HEIGHT);
    expect(menu).not.toHaveClass(SIZE_LIMIT_WIDTH);
    expect(menu.style.maxHeight).toBe('');
    expect(menu.style.maxWidth).toBe('');
  });

  it('keeps a consumer style next to the size limit, and a consumer max-height style wins', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover style={{ minWidth: 240, maxHeight: 200 }}>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    const menu = screen.getByRole('menu');
    expect(menu.style.minWidth).toBe('240px');
    expect(menu).toHaveClass(SIZE_LIMIT_HEIGHT, SIZE_LIMIT_WIDTH);
    // An inline style beats the class.
    expect(menu.style.maxHeight).toBe('200px');
  });

  // The first focus lands before floating-ui has limited the surface's height (it measures after
  // mount), so that focus scrolls nothing: the item is scrolled into view once positioned.
  it('scrolls the item focused on opening into view once the surface is positioned', async () => {
    const user = userEvent.setup();
    const scrolled = vi.mocked(Element.prototype.scrollIntoView);
    render(<LongMenu />);
    act(() => trigger().focus());
    await user.keyboard('{ArrowUp}');
    expect(item('Command 40')).toHaveFocus();
    await waitFor(() => expect(scrolled.mock.contexts).toContain(item('Command 40')));
    const call = scrolled.mock.contexts.indexOf(item('Command 40'));
    expect(scrolled.mock.calls[call]).toEqual([{ block: 'nearest' }]);

    // Reopening scrolls again: the positioned state is reset while the menu is closed.
    await user.keyboard('{Escape}');
    expect(trigger()).toHaveFocus();
    scrolled.mockClear();
    await user.keyboard('{ArrowUp}');
    expect(item('Command 40')).toHaveFocus();
    await waitFor(() => expect(scrolled.mock.contexts).toContain(item('Command 40')));
  });

  it('ArrowUp on the trigger focuses the last of 40 items; End and Home move to the ends', async () => {
    const user = userEvent.setup();
    render(<LongMenu />);
    act(() => trigger().focus());
    await user.keyboard('{ArrowUp}');
    expect(item('Command 40')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(item('Command 1')).toHaveFocus();
    await user.keyboard('{End}');
    expect(item('Command 40')).toHaveFocus();
  });

  it('has no axe violations with 40 items open', async () => {
    const user = userEvent.setup();
    render(<LongMenu />);
    await user.click(trigger());
    expect(screen.getAllByRole('menuitem')).toHaveLength(40);
    await expectNoA11yViolations();
  });
});

// ---------------------------------------------------------------------------
// Triggers with aria-disabled="true" (a focusable disabled MenuButton or SplitButton half)
// ---------------------------------------------------------------------------

describe('Menu.Trigger around an aria-disabled element', () => {
  /** What a focusable disabled button renders: `aria-disabled`, still focusable. */
  function AriaDisabledTriggerMenu({
    asChild,
    ariaDisabled = 'true',
    onOpenChange,
  }: {
    asChild: boolean;
    ariaDisabled?: 'true' | 'false';
    onOpenChange?: (open: boolean) => void;
  }) {
    return (
      <Menu onOpenChange={onOpenChange}>
        <Menu.Trigger asChild={asChild}>
          <button type="button" aria-disabled={ariaDisabled}>
            Actions
          </button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  const TRIGGER_FORMS = [
    ['as the child', true],
    ['inside the asChild={false} wrapper span', false],
  ] as const;

  /** The keys that open an enabled trigger: `KeyboardEvent.key`, then the user-event notation. */
  const OPENING_KEYS = [
    ['Enter', '{Enter}'],
    [' ', ' '],
    ['ArrowDown', '{ArrowDown}'],
    ['ArrowUp', '{ArrowUp}'],
  ] as const;

  it.each(TRIGGER_FORMS)('%s: a click does not open the menu', async (_form, asChild) => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<AriaDisabledTriggerMenu asChild={asChild} onOpenChange={onOpenChange} />);
    await user.click(trigger());
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each(TRIGGER_FORMS)(
    '%s: Enter, Space, ArrowDown and ArrowUp do not open the menu and focus stays on the trigger',
    async (_form, asChild) => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<AriaDisabledTriggerMenu asChild={asChild} onOpenChange={onOpenChange} />);
      act(() => trigger().focus());
      for (const [, key] of OPENING_KEYS) {
        await user.keyboard(key);
        expect(queryMenu()).not.toBeInTheDocument();
        expect(trigger()).toHaveFocus();
      }
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(onOpenChange).not.toHaveBeenCalled();
    },
  );

  it.each(TRIGGER_FORMS)(
    '%s: the ignored keys and click keep their default (nothing is prevented)',
    (_form, asChild) => {
      render(<AriaDisabledTriggerMenu asChild={asChild} />);
      for (const [key] of OPENING_KEYS) {
        expect(fireEvent.keyDown(trigger(), { key })).toBe(true);
      }
      expect(fireEvent.click(trigger())).toBe(true);
      expect(queryMenu()).not.toBeInTheDocument();
    },
  );

  it.each(TRIGGER_FORMS)(
    '%s: aria-disabled="false" opens the menu as before',
    async (_form, asChild) => {
      const user = userEvent.setup();
      render(<AriaDisabledTriggerMenu asChild={asChild} ariaDisabled="false" />);
      await user.click(trigger());
      expect(item('Edit')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(queryMenu()).not.toBeInTheDocument();
      await user.keyboard('{ArrowUp}');
      expect(item('Delete')).toHaveFocus();
    },
  );

  it('an aria-disabled ancestor outside the trigger does not block it', async () => {
    const user = userEvent.setup();
    render(
      <div aria-disabled="true">
        <PopupMenu />
      </div>,
    );
    await user.click(trigger());
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(item('Edit')).toHaveFocus();
  });

  it('a trigger that becomes aria-disabled stops opening; enabled again, it opens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AriaDisabledTriggerMenu asChild ariaDisabled="false" />);
    rerender(<AriaDisabledTriggerMenu asChild ariaDisabled="true" />);
    await user.click(trigger());
    expect(queryMenu()).not.toBeInTheDocument();
    rerender(<AriaDisabledTriggerMenu asChild ariaDisabled="false" />);
    await user.click(trigger());
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  // As in Fluent, the trigger ignores every click while aria-disabled, the closing one included;
  // the other ways of closing still work.
  it('a trigger that becomes aria-disabled while its menu is open ignores a click; Escape closes the menu', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <AriaDisabledTriggerMenu asChild ariaDisabled="false" onOpenChange={onOpenChange} />,
    );
    await user.click(trigger());
    expect(screen.getByRole('menu')).toBeInTheDocument();
    rerender(<AriaDisabledTriggerMenu asChild ariaDisabled="true" onOpenChange={onOpenChange} />);
    await user.click(trigger());
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});

// React bubbles the events of a portal (a Popover or Dialog opened from an item) through the item
// and the menu surface, although their target lives elsewhere in the document. They reach the
// consumer's handlers, but never activate the item, close the menu or move focus.
describe('Menu events from a portal opened inside an item', () => {
  function MenuWithNestedPortal({
    persistOnClick = true,
    disabled = false,
    onRenameClick,
    onRenameKeyDown,
  }: {
    persistOnClick?: boolean;
    disabled?: boolean;
    onRenameClick?: React.MouseEventHandler<HTMLDivElement>;
    onRenameKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  }) {
    return (
      <Menu defaultOpen>
        <Menu.Trigger>
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item
            persistOnClick={persistOnClick}
            disabled={disabled}
            onClick={onRenameClick}
            onKeyDown={onRenameKeyDown}
          >
            Rename…
            <Portal>
              <div role="dialog" aria-label="Rename">
                <input aria-label="New name" />
                <button type="button">Save</button>
              </div>
            </Portal>
          </Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  const input = () => screen.getByRole('textbox', { name: 'New name' });

  it('Space types into a field of the portal: the item is not activated', async () => {
    const user = userEvent.setup();
    const onRenameClick = vi.fn();
    const onRenameKeyDown = vi.fn();
    render(
      <MenuWithNestedPortal onRenameClick={onRenameClick} onRenameKeyDown={onRenameKeyDown} />,
    );
    await user.click(input());
    onRenameClick.mockClear();
    await user.keyboard('a b{Enter}');
    expect(input()).toHaveValue('a b');
    expect(input()).toHaveFocus();
    expect(onRenameClick).not.toHaveBeenCalled();
    // The consumer's handler still receives the bubbled keys (React semantics).
    expect(onRenameKeyDown.mock.calls.map(([event]) => event.key)).toEqual([
      'a',
      ' ',
      'b',
      'Enter',
    ]);
    expect(queryMenu()).toBeInTheDocument();
  });

  it('Tab moves on inside the portal: the menu stays open and focus stays out of the trigger', async () => {
    const user = userEvent.setup();
    render(<MenuWithNestedPortal />);
    await user.click(input());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    expect(queryMenu()).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('a click inside the portal neither closes the menu nor activates the item', async () => {
    const user = userEvent.setup();
    const onRenameClick = vi.fn();
    render(<MenuWithNestedPortal persistOnClick={false} onRenameClick={onRenameClick} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(queryMenu()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    // The consumer's onClick receives the bubbled click (React semantics); its target is the
    // portal's button, not the item.
    expect(onRenameClick).toHaveBeenCalledTimes(1);
    expect(onRenameClick.mock.calls[0]![0].target).toBe(
      screen.getByRole('button', { name: 'Save' }),
    );

    // The item's own click still activates it and closes the menu.
    await user.click(item('Rename…'));
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('a disabled item never calls onClick, not even for a click inside its portal, which it leaves alone', async () => {
    const user = userEvent.setup();
    const onRenameClick = vi.fn();
    render(<MenuWithNestedPortal disabled persistOnClick={false} onRenameClick={onRenameClick} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(fireEvent.click(save)).toBe(true);
    await user.click(save);
    expect(onRenameClick).not.toHaveBeenCalled();
    expect(queryMenu()).toBeInTheDocument();

    // A click on the disabled item itself is prevented and runs nothing.
    expect(fireEvent.click(item('Rename…'))).toBe(false);
    expect(onRenameClick).not.toHaveBeenCalled();
    expect(queryMenu()).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Wrapper-span triggers: asChild={false} and the automatic fallback
// ---------------------------------------------------------------------------

/** A trigger child that neither forwards `ref` nor spreads its props (the automatic fallback). */
function NoRefButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function WrapperTriggerMenu({ automatic }: { automatic: boolean }) {
  return (
    <>
      <Menu>
        {automatic ? (
          <Menu.Trigger>
            <NoRefButton>Actions</NoRefButton>
          </Menu.Trigger>
        ) : (
          <Menu.Trigger asChild={false}>
            <button type="button">Actions</button>
          </Menu.Trigger>
        )}
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
      <button type="button">Next</button>
    </>
  );
}

const WRAPPER_TRIGGERS = [
  ['asChild={false}', false],
  ['the automatic fallback', true],
] as const;

/** The one warning of the automatic fallback (asserted exactly). */
const TRIGGER_REF_FALLBACK_WARNING =
  '[WaveUI] Menu.Trigger: its child did not attach the trigger ref (a component that neither ' +
  'forwards `ref` nor spreads its props). It is rendered inside a <span> wrapper instead; ' +
  'forward `ref` and spread props onto the element, or pass asChild={false}.';

describe('Menu.Trigger rendered as a wrapper span', () => {
  /** Renders the menu; only the automatic fallback warns (once). */
  function renderWrapperMenu(automatic: boolean) {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<WrapperTriggerMenu automatic={automatic} />);
    return () =>
      expect(warn.mock.calls.map(([message]) => String(message))).toEqual(
        automatic ? [TRIGGER_REF_FALLBACK_WARNING] : [],
      );
  }

  it.each(WRAPPER_TRIGGERS)(
    '%s: Escape returns focus to the button inside the wrapper',
    async (_name, automatic) => {
      const user = userEvent.setup();
      const expectWarnings = renderWrapperMenu(automatic);
      await user.click(trigger());
      expect(item('Edit')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(queryMenu()).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
      expectWarnings();
    },
  );

  it.each(WRAPPER_TRIGGERS)(
    '%s: activating an item returns focus to the button inside the wrapper',
    async (_name, automatic) => {
      const user = userEvent.setup();
      const expectWarnings = renderWrapperMenu(automatic);
      await user.click(trigger());
      await user.click(item('Edit'));
      expect(queryMenu()).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
      expectWarnings();
    },
  );

  it.each(WRAPPER_TRIGGERS)(
    '%s: Tab closes the menu and puts focus on the button inside the wrapper',
    async (_name, automatic) => {
      const user = userEvent.setup();
      const expectWarnings = renderWrapperMenu(automatic);
      await user.click(trigger());
      const notPrevented = fireEvent.keyDown(item('Edit'), { key: 'Tab' });
      expect(notPrevented).toBe(true);
      expect(queryMenu()).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
      expectWarnings();
    },
  );

  it('asChild={false} with tabIndex={-1} on the wrapper: focus returns to the element that carries the state ARIA', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger asChild={false} tabIndex={-1} data-testid="wrap">
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    // A wrapper out of the tab order is not the trigger: the button inside is (state ARIA).
    expect(screen.getByTestId('wrap')).not.toHaveAttribute('aria-expanded');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger());
    await user.click(item('Edit'));
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    await user.click(trigger());
    fireEvent.keyDown(item('Edit'), { key: 'Tab' });
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('asChild={false} with tabIndex={-1} on the wrapper: Escape and an outside press return focus to the button inside, not the span', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger asChild={false} tabIndex={-1} data-testid="wrap">
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    await user.click(trigger());
    expect(item('Edit')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    // A press on the span itself focuses it (tabIndex -1; Safari does this for a click on the
    // button too): focus still returns to the button, the element that carries the state ARIA.
    await user.click(screen.getByTestId('wrap'));
    expect(item('Edit')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    // An outside press that leaves focus on the page returns it to the button as well.
    await user.click(trigger());
    await user.click(document.body);
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('asChild={false} with role="button" and tabIndex={0}: the span stays the trigger and takes focus back', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger asChild={false} role="button" tabIndex={0}>
          Actions
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    const span = trigger();
    expect(span.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('aria-expanded', 'false');
    await user.click(span);
    expect(item('Edit')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(span).toHaveFocus();

    await user.click(span);
    await user.click(item('Edit'));
    expect(queryMenu()).not.toBeInTheDocument();
    expect(span).toHaveFocus();
  });

  it('asChild={false} with only tabIndex={0} around text: the generic span carries no state ARIA (axe) and takes focus back', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <Menu.Trigger asChild={false} tabIndex={0} data-testid="wrap">
          Actions
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    const span = screen.getByTestId('wrap');
    const expectNoStateAria = () => {
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(span).not.toHaveAttribute(name);
      }
    };
    expectNoStateAria();
    await expectNoA11yViolations();
    await user.click(span);
    expect(item('Edit')).toHaveFocus();
    expectNoStateAria();
    await expectNoA11yViolations();
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(span).toHaveFocus();
  });

  it.each(WRAPPER_TRIGGERS)(
    '%s: the button inside the wrapper carries the state ARIA, the span none (axe)',
    async (_name, automatic) => {
      const user = userEvent.setup();
      const expectWarnings = renderWrapperMenu(automatic);
      const button = trigger();
      const wrapper = button.parentElement as HTMLElement;
      const expectBareWrapper = () => {
        expect(wrapper.tagName).toBe('SPAN');
        for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
          expect(wrapper).not.toHaveAttribute(name);
        }
      };
      expectBareWrapper();
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      await expectNoA11yViolations();

      await user.click(button);
      const menu = screen.getByRole('menu', { name: 'Actions' });
      expectBareWrapper();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', menu.id);
      await expectNoA11yViolations();

      await user.keyboard('{Escape}');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      expectWarnings();
    },
  );

  // useTriggerElement moves the state ARIA off both spans (explicit and automatic) with one rule:
  // the first element in the tab order by markup, hidden inputs and tabIndex -1 skipped.
  it.each(WRAPPER_TRIGGERS)(
    '%s: the state ARIA skips hidden inputs and elements out of the tab order',
    async (_name, automatic) => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      /** Neither forwards `ref` nor spreads props: the automatic fallback wraps it too. */
      function Content() {
        return (
          <>
            <input type="hidden" name="scope" value="all" data-testid="hidden" />
            <span tabIndex={-1} data-testid="skipped">
              Busy
            </span>
            <button type="button" aria-haspopup="true">
              Actions
            </button>
          </>
        );
      }
      render(
        <Menu>
          <Menu.Trigger asChild={automatic}>
            <Content />
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Edit</Menu.Item>
          </Menu.Popover>
        </Menu>,
      );
      for (const testId of ['hidden', 'skipped']) {
        expect(screen.getByTestId(testId)).not.toHaveAttribute('aria-haspopup');
        expect(screen.getByTestId(testId)).not.toHaveAttribute('aria-expanded');
      }
      expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      await user.click(trigger());
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('skipped')).not.toHaveAttribute('aria-expanded');
      expect(warn.mock.calls.map(([message]) => String(message))).toEqual(
        automatic ? [TRIGGER_REF_FALLBACK_WARNING] : [],
      );
    },
  );

  it('asChild={false}: state ARIA passed to Menu.Trigger stays off the span', () => {
    render(
      <Menu>
        <Menu.Trigger asChild={false} aria-expanded="true" aria-haspopup="true" data-testid="wrap">
          <button type="button">Actions</button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popover>
      </Menu>,
    );
    const wrapper = screen.getByTestId('wrap');
    expect(wrapper).not.toHaveAttribute('aria-expanded');
    expect(wrapper).not.toHaveAttribute('aria-haspopup');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
  });
});

// ---------------------------------------------------------------------------
// Parts written in a React Server Component: lazy element types (C-COMPOUND)
// ---------------------------------------------------------------------------

describe('Menu.Popover surface registration', () => {
  /**
   * A Menu context whose open state the test sets, with a `registerSurface` that logs, and a probe
   * that logs each commit of a new open state (its layout effect runs after Menu.Popover's).
   */
  function RegistrationHarness({ open, log }: { open: boolean; log: string[] }) {
    // Stable, as the Menu root's is.
    const registerSurface = React.useCallback(
      (api: MenuSurfaceApi | null) => {
        log.push(api ? 'register' : 'unregister');
      },
      [log],
    );
    const value = React.useMemo<MenuContextValue>(
      () => ({ ...INERT_MENU_CONTEXT, popup: true, open, registerSurface }),
      [open, registerSurface],
    );
    return (
      <MenuContext.Provider value={value}>
        <MenuPopover aria-label="Actions">
          <MenuItem>Edit</MenuItem>
        </MenuPopover>
        <CommitProbe open={open} log={log} />
      </MenuContext.Provider>
    );
  }

  function CommitProbe({ open, log }: { open: boolean; log: string[] }) {
    React.useLayoutEffect(() => {
      log.push(`commit open=${open}`);
    }, [open, log]);
    return null;
  }

  it('registers the open surface and unregisters it in the commit that closes the menu', () => {
    const log: string[] = [];
    const { rerender } = render(<RegistrationHarness open log={log} />);
    expect(log.filter((entry) => entry !== 'commit open=true')).toEqual(['register']);
    log.length = 0;
    rerender(<RegistrationHarness open={false} log={log} />);
    // No closed surface stays registered, not even until the surface element is gone: from 0.7 a
    // surface can stay mounted while it exits, and a registered one would take the next opening.
    expect(log).toEqual(['unregister', 'commit open=false']);
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('registers no closed surface', () => {
    const log: string[] = [];
    render(<RegistrationHarness open={false} log={log} />);
    expect(log).toEqual(['commit open=false']);
  });
});

describe('Menu parts as client references (lazy element types)', () => {
  it('a popup menu of lazy parts renders the same server HTML and works the same', async () => {
    const user = userEvent.setup();
    const LazyTrigger = asClientReference(MenuTrigger);
    const LazyPopover = asClientReference(MenuPopover);
    const LazyItem = asClientReference(MenuItem);
    const plain = renderToString(
      <Menu>
        <MenuTrigger>
          <button type="button">Actions</button>
        </MenuTrigger>
        <>
          <MenuPopover>
            <MenuItem>Edit</MenuItem>
          </MenuPopover>
        </>
      </Menu>,
    );
    expect(plain).toContain('aria-haspopup="menu"');
    expect(plain).not.toContain('role="menu"');
    const lazy = (
      <Menu>
        <LazyTrigger>
          <button type="button">Actions</button>
        </LazyTrigger>
        <>
          <LazyPopover>
            <LazyItem>Edit</LazyItem>
          </LazyPopover>
        </>
      </Menu>
    );
    expect(renderToString(lazy)).toBe(plain);

    render(lazy);
    expect(queryMenu()).not.toBeInTheDocument();
    await user.click(trigger());
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(item('Edit')).toHaveFocus();
    await user.click(item('Edit'));
    expect(queryMenu()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });
});

describe('Menu context (C-CONTEXT)', () => {
  it('Menu.Trigger outside a Menu throws in development', () => {
    expectThrows(
      <Menu.Trigger>
        <button type="button">Orphan</button>
      </Menu.Trigger>,
      '[WaveUI] Menu.Trigger must be used within Menu',
    );
  });

  it('Menu.Popover outside a Menu throws in development', () => {
    expectThrows(
      <Menu.Popover>
        <Menu.Item>Orphan</Menu.Item>
      </Menu.Popover>,
      '[WaveUI] Menu.Popover must be used within Menu',
    );
  });

  it('logs each misplaced part once in production and renders it inert', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const orphans = (count: number) =>
        Array.from({ length: count }, (_, index) => (
          <React.Fragment key={index}>
            <Menu.Trigger>
              <button type="button">Orphan</button>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Edit</Menu.Item>
            </Menu.Popover>
          </React.Fragment>
        ));
      const { rerender } = render(<>{orphans(1)}</>);
      rerender(<>{orphans(2)}</>);
      expect(screen.getAllByRole('button', { name: 'Orphan' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Orphan' })[0]).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(queryMenu()).not.toBeInTheDocument();
      expect(error.mock.calls).toEqual([
        ['[WaveUI] Menu.Trigger must be used within Menu'],
        ['[WaveUI] Menu.Popover must be used within Menu'],
      ]);
    } finally {
      error.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
