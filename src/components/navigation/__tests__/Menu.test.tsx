import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, MenuDivider, MenuItem, MenuPopover, MenuTrigger } from '../Menu';
import type { MenuItemProps, MenuProps, MenuTriggerProps } from '../Menu';
import {
  createOverlayTestWrapper,
  expectNoA11yViolations,
  renderWithProviders,
  testCompoundExposure,
  testComposedHandler,
  testSystemProps,
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

    it('a consumer onKeyDown on Menu.Item that prevents default suppresses activation', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      renderStaticMenu(
        {},
        <Menu.Item onKeyDown={(e) => e.preventDefault()} onClick={onClick}>
          Save
        </Menu.Item>,
      );
      await user.tab();
      await user.keyboard('{Enter}');
      expect(onClick).not.toHaveBeenCalled();
    });
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
    expect(wrapper).toHaveAttribute('aria-haspopup', 'menu');
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
    expect(wrapper).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(wrapper);
    expect(screen.getByRole('menu')).toBeInTheDocument();
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
      const messages = warn.mock.calls.map(([message]) => String(message));
      const ignored = messages.filter((message) => message.includes('popup menu'));
      expect(ignored).toHaveLength(1);
      expect(ignored[0]).toContain('[WaveUI] Menu:');
      for (const name of ['className', 'aria-label', 'data-testid', 'ref']) {
        expect(ignored[0]).toContain(`\`${name}\``);
      }
      expect(ignored[0]).toContain('Menu.Popover');
      expect(screen.queryByTestId('root')).not.toBeInTheDocument();
      expect(ref.current).toBeNull();
    });

    it('does not warn for a popup menu without root DOM props (undefined values included)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      const messages = warn.mock.calls.map(([message]) => String(message));
      const fallback = messages.filter((message) => message.includes('static menu'));
      expect(fallback).toHaveLength(1);
      expect(fallback[0]).toContain('[WaveUI] Menu.Trigger:');
      for (const name of ['open', 'defaultOpen', 'onOpenChange']) {
        expect(fallback[0]).toContain(`\`${name}\``);
      }
    });

    it('wrapped Trigger/Popover work as a popup menu when popup mode is forced (defaultOpen)', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
  });
});

describe('Menu context (C-CONTEXT)', () => {
  it('Menu.Trigger outside a Menu throws in development', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Menu.Trigger>
          <button type="button">Orphan</button>
        </Menu.Trigger>,
      ),
    ).toThrow('[WaveUI] Menu.Trigger must be used within Menu');
  });

  it('Menu.Popover outside a Menu throws in development', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Menu.Popover>
          <Menu.Item>Orphan</Menu.Item>
        </Menu.Popover>,
      ),
    ).toThrow('[WaveUI] Menu.Popover must be used within Menu');
  });
});
