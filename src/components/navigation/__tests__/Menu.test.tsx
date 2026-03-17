import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from '../Menu';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Menu', () => {
  testForwardRef(Menu, 'div', { children: <Menu.Item>Item</Menu.Item> });
  testRestSpread(Menu, { children: <Menu.Item>Item</Menu.Item> });
  testClassName(Menu, { children: <Menu.Item>Item</Menu.Item> });

  it('renders with role="menu"', () => {
    render(
      <Menu data-testid="menu">
        <Menu.Item>Item 1</Menu.Item>
      </Menu>,
    );
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

  it('navigates items with ArrowDown', async () => {
    const user = userEvent.setup();
    render(
      <Menu data-testid="menu">
        <Menu.Item>Item 1</Menu.Item>
        <Menu.Item>Item 2</Menu.Item>
        <Menu.Item>Item 3</Menu.Item>
      </Menu>,
    );
    const menu = screen.getByTestId('menu');
    menu.focus();
    await user.keyboard('{ArrowDown}');
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
  });

  it('navigates items with ArrowUp', async () => {
    const user = userEvent.setup();
    render(
      <Menu data-testid="menu">
        <Menu.Item>Item 1</Menu.Item>
        <Menu.Item>Item 2</Menu.Item>
      </Menu>,
    );
    const menu = screen.getByTestId('menu');
    menu.focus();
    // ArrowUp from no selection wraps to last
    await user.keyboard('{ArrowUp}');
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[1]);
  });

  it('wraps ArrowDown from last item to first', async () => {
    const user = userEvent.setup();
    render(
      <Menu data-testid="menu">
        <Menu.Item>Item 1</Menu.Item>
        <Menu.Item>Item 2</Menu.Item>
      </Menu>,
    );
    const items = screen.getAllByRole('menuitem');
    items[1].focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[0]);
  });

  it('skips disabled items in keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <Menu data-testid="menu">
        <Menu.Item>Item 1</Menu.Item>
        <Menu.Item disabled>Item 2</Menu.Item>
        <Menu.Item>Item 3</Menu.Item>
      </Menu>,
    );
    const menu = screen.getByTestId('menu');
    menu.focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByText('Item 1').closest('[role="menuitem"]'));
    await user.keyboard('{ArrowDown}');
    // Should skip disabled item 2 and go to item 3
    expect(document.activeElement).toBe(screen.getByText('Item 3').closest('[role="menuitem"]'));
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

  it('renders icon slot in MenuItem', () => {
    render(
      <Menu>
        <Menu.Item icon={{ children: 'icon-text' }}>Item</Menu.Item>
      </Menu>,
    );
    expect(screen.getByText('icon-text')).toBeInTheDocument();
  });

  it('renders shortcut text', () => {
    render(
      <Menu>
        <Menu.Item shortcut="Ctrl+S">Save</Menu.Item>
      </Menu>,
    );
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
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
  });
});
