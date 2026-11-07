import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from '../Menu';
import {
  menuItemCheckboxClassNames,
  menuItemClassNames,
  menuItemLinkClassNames,
  menuItemRadioClassNames,
  menuItemSwitchClassNames,
} from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';
import { renderInMenuList } from './menuHarness';

describe('Menu.Item subText (menu-7)', () => {
  it('renders a second line under the label, part of the item name', () => {
    renderInMenuList(<Menu.Item subText="Saves to the cloud">Save</Menu.Item>);
    const item = screen.getByRole('menuitem', { name: 'Save Saves to the cloud' });
    const subText = screen.getByText('Saves to the cloud');
    expect(subText).toHaveClass(menuItemClassNames.subText);
    // The label stays the typeahead text and the content element.
    expect(screen.getByText('Save')).toHaveClass(menuItemClassNames.content);
    expect(item).toHaveAttribute('data-roving-text', 'Save');
  });

  it('renders no line or wrapper while subText renders nothing', () => {
    renderInMenuList(
      <>
        <Menu.Item subText={null}>A</Menu.Item>
        <Menu.Item subText="">B</Menu.Item>
        <Menu.Item subText={[]}>C</Menu.Item>
      </>,
    );
    for (const name of ['A', 'B', 'C']) {
      const item = screen.getByRole('menuitem', { name });
      expect(item.querySelector(`.${menuItemClassNames.subText}`)).toBeNull();
    }
  });

  it('is a slotProps part with its locks', () => {
    const onClick = vi.fn();
    renderInMenuList(
      <Menu.Item
        subText="Hint"
        slotProps={{
          subText: {
            className: 'mine',
            role: 'button',
            tabIndex: 0,
            'data-extra': 'x',
            onClick,
          },
        }}
      >
        Item
      </Menu.Item>,
    );
    const subText = screen.getByText('Hint');
    expect(subText).toHaveClass(menuItemClassNames.subText, 'mine');
    expect(subText).toHaveAttribute('data-extra', 'x');
    expect(subText).not.toHaveAttribute('role');
    expect(subText).not.toHaveAttribute('tabindex');
  });

  it('carries the item kind classes on every kind and calls no part click while disabled', async () => {
    const onClick = vi.fn();
    renderInMenuList(
      <>
        <Menu.ItemCheckbox name="a" value="1" subText="cb">
          Cb
        </Menu.ItemCheckbox>
        <Menu.ItemRadio name="b" value="1" subText="rd">
          Rd
        </Menu.ItemRadio>
        <Menu.ItemSwitch name="c" value="1" subText="sw">
          Sw
        </Menu.ItemSwitch>
        <Menu.ItemLink href="#x" subText="lk">
          Lk
        </Menu.ItemLink>
        <Menu.Item disabled subText="off" slotProps={{ subText: { onClick } }}>
          Off
        </Menu.Item>
      </>,
    );
    expect(screen.getByText('cb')).toHaveClass(menuItemCheckboxClassNames.subText);
    expect(screen.getByText('rd')).toHaveClass(menuItemRadioClassNames.subText);
    expect(screen.getByText('sw')).toHaveClass(menuItemSwitchClassNames.subText);
    expect(screen.getByText('lk')).toHaveClass(menuItemLinkClassNames.subText);
    for (const text of ['cb', 'rd', 'sw', 'lk']) {
      expect(screen.getByText(text)).toHaveClass(menuItemClassNames.subText);
    }
    await userEvent.click(screen.getByText('off'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    renderInMenuList(<Menu.Item subText="Hint">Item</Menu.Item>);
    await expectNoA11yViolations(document.body);
  });
});

describe('Menu.Item secondaryContent (menu-8)', () => {
  it('renders content in the shortcut element', () => {
    renderInMenuList(
      <Menu.Item secondaryContent={<kbd data-testid="k">Ctrl+S</kbd>}>Save</Menu.Item>,
    );
    const kbd = screen.getByTestId('k');
    expect(kbd.parentElement).toHaveClass(menuItemClassNames.shortcut);
    expect(kbd.parentElement).toHaveAttribute('dir', 'auto');
  });

  it('wins over shortcut while it renders content, and gives way when it renders nothing', () => {
    renderInMenuList(
      <>
        <Menu.Item shortcut="Ctrl+A" secondaryContent="12">
          One
        </Menu.Item>
        <Menu.Item shortcut="Ctrl+B" secondaryContent={null}>
          Two
        </Menu.Item>
        <Menu.Item secondaryContent={0}>Three</Menu.Item>
      </>,
    );
    expect(screen.queryByText('Ctrl+A')).toBeNull();
    expect(screen.getByText('12')).toHaveClass(menuItemClassNames.shortcut);
    expect(screen.getByText('Ctrl+B')).toHaveClass(menuItemClassNames.shortcut);
    expect(screen.getByText('0')).toHaveClass(menuItemClassNames.shortcut);
  });

  it('merges slotProps.shortcut onto the secondary content element', () => {
    renderInMenuList(
      <Menu.Item secondaryContent="12" slotProps={{ shortcut: { className: 'mine', dir: 'ltr' } }}>
        One
      </Menu.Item>,
    );
    const element = screen.getByText('12');
    expect(element).toHaveClass(menuItemClassNames.shortcut, 'mine');
    expect(element).toHaveAttribute('dir', 'auto');
  });
});

describe('disabledFocusable menu items (menu-9)', () => {
  const renderMenu = (onClick: () => void) =>
    render(
      <Menu aria-label="Actions">
        <Menu.Item>First</Menu.Item>
        <Menu.Item disabled>Skipped</Menu.Item>
        <Menu.Item disabledFocusable onClick={onClick}>
          Reachable
        </Menu.Item>
        <Menu.ItemCheckbox name="a" value="1" disabledFocusable onClick={onClick}>
          Check
        </Menu.ItemCheckbox>
        <Menu.ItemLink href="#x" disabledFocusable onClick={onClick}>
          Link
        </Menu.ItemLink>
        <Menu.Item>Last</Menu.Item>
      </Menu>,
    );

  it('renders the disabled attributes and data-disabled-focusable', () => {
    renderMenu(vi.fn());
    const reachable = screen.getByRole('menuitem', { name: 'Reachable' });
    expect(reachable).toHaveAttribute('aria-disabled', 'true');
    expect(reachable).toHaveAttribute('data-disabled', '');
    expect(reachable).toHaveAttribute('data-disabled-focusable', '');
    const plain = screen.getByRole('menuitem', { name: 'Skipped' });
    expect(plain).toHaveAttribute('aria-disabled', 'true');
    expect(plain).not.toHaveAttribute('data-disabled-focusable');
    expect(screen.getByRole('menuitem', { name: 'First' })).not.toHaveAttribute('aria-disabled');
  });

  it('keeps the item in the arrow-key order while a plain disabled item is skipped', async () => {
    const user = userEvent.setup();
    renderMenu(vi.fn());
    screen.getByRole('menuitem', { name: 'First' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Reachable' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Check' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Link' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus();
  });

  it('never activates: no click handler, no check, no navigation', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderMenu(onClick);
    const check = screen.getByRole('menuitemcheckbox', { name: 'Check' });
    await user.click(check);
    check.focus();
    await user.keyboard('{Enter} ');
    await user.click(screen.getByRole('menuitem', { name: 'Reachable' }));
    await user.click(screen.getByRole('menuitem', { name: 'Link' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(check).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitem', { name: 'Link' })).not.toHaveAttribute('href');
  });

  it('wins over disabled being unset and over a consumer aria-disabled', () => {
    renderInMenuList(
      <Menu.Item disabledFocusable aria-disabled={false}>
        Item
      </Menu.Item>,
    );
    expect(screen.getByRole('menuitem', { name: 'Item' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('lets the arrow keys of a split group reach a disabledFocusable half', async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Actions">
        <Menu.SplitGroup>
          <Menu.Item>Save</Menu.Item>
          <Menu>
            <Menu.Trigger>
              <Menu.Item aria-label="More" disabledFocusable />
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Save as</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.SplitGroup>
      </Menu>,
    );
    screen.getByRole('menuitem', { name: 'Save' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'More' })).toHaveFocus();
    // The unavailable half never opens its submenu.
    await user.keyboard('{ArrowRight}');
    expect(screen.queryByRole('menuitem', { name: 'Save as' })).toBeNull();
  });
});
