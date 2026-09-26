import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Menu } from '../Menu';
import type { MenuItemProps } from '../Menu';
import { MenuSplitGroup } from '../Menu.splitGroup';
import type { MenuSplitGroupProps } from '../Menu.splitGroup';
import {
  createOverlayTestWrapper,
  expectNoA11yViolations,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';

const item = (name: string) => screen.getByRole('menuitem', { name });
const queryMenu = (name: string) => screen.queryByRole('menu', { name });
const fileButton = () => screen.getByRole('button', { name: 'File' });
const HALF = 'More save options';

interface SaveMenuProps {
  onSave?: () => void;
  onSaveAs?: () => void;
  isStatic?: boolean;
}

/** A File menu whose "Save" row is a split group with a "More save options" submenu half. */
function SaveMenu({ onSave, onSaveAs, isStatic = false }: SaveMenuProps) {
  const content = (
    <>
      <Menu.Item>New</Menu.Item>
      <MenuSplitGroup data-testid="split">
        <Menu.Item onClick={onSave}>Save</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item aria-label={HALF} />
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item onClick={onSaveAs}>Save as…</Menu.Item>
            <Menu.Item>Save a copy</Menu.Item>
          </Menu.Popover>
        </Menu>
      </MenuSplitGroup>
      <Menu.Item>Close</Menu.Item>
    </>
  );
  if (isStatic) return <Menu aria-label="File">{content}</Menu>;
  return (
    <Menu>
      <Menu.Trigger>
        <button type="button">File</button>
      </Menu.Trigger>
      <Menu.Popover>{content}</Menu.Popover>
    </Menu>
  );
}

/** Opens the popup File menu with the keyboard and moves to "Save". */
async function openAtSave(user: UserEvent) {
  act(() => fileButton().focus());
  await user.keyboard('{Enter}{ArrowDown}');
  expect(item('Save')).toHaveFocus();
}

describe('Menu.SplitGroup', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    try {
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  testSystemProps(MenuSplitGroup, {
    expectedTag: 'div',
    displayName: 'MenuSplitGroup',
    defaultProps: {
      children: [
        <Menu.Item key="save">Save</Menu.Item>,
        <Menu key="more">
          <Menu.Trigger>
            <Menu.Item aria-label={HALF} />
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Save as…</Menu.Item>
          </Menu.Popover>
        </Menu>,
      ],
    },
    conflictingClass: { className: 'items-center', overrides: 'items-stretch' },
    wrapper: createOverlayTestWrapper(Menu, { 'aria-label': 'File' }),
  });

  it('is a group row of two menu items: the action and the submenu half', async () => {
    const user = userEvent.setup();
    render(<SaveMenu />);
    await user.click(fileButton());
    const group = screen.getByRole('group');
    expect(group).toBe(screen.getByTestId('split'));
    expect(group).toHaveAttribute('data-menu-split-group', '');
    expect(
      within(group)
        .getAllByRole('menuitem')
        .map((el) => el.getAttribute('aria-label') ?? el.textContent),
    ).toEqual(['Save', HALF]);
    expect(item(HALF)).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('the half shows only the submenu chevron: no column placeholders', async () => {
    const user = userEvent.setup();
    render(<SaveMenu />);
    await user.click(fileButton());
    const half = item(HALF);
    expect(half.querySelector('[data-menu-column-space]')).toBeNull();
    expect(half.querySelectorAll('svg')).toHaveLength(1);
    expect(half.textContent).toBe('');
    // The action keeps its placeholders, so its label lines up with the other items.
    expect(item('Save').querySelectorAll('[data-menu-column-space]')).toHaveLength(2);
  });

  it('types a Menu.Item without children (the half)', () => {
    expectTypeOf<MenuItemProps['children']>().toEqualTypeOf<React.ReactNode | undefined>();
    expectTypeOf<MenuSplitGroupProps['children']>().toEqualTypeOf<React.ReactNode>();
  });

  it('ArrowDown and ArrowUp visit both halves in DOM order', async () => {
    const user = userEvent.setup();
    render(<SaveMenu />);
    await openAtSave(user);
    await user.keyboard('{ArrowDown}');
    expect(item(HALF)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Close')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(item('Save')).toHaveFocus();
  });

  it('ArrowRight moves from the action to the half without opening; on the half it opens', async () => {
    const user = userEvent.setup();
    render(<SaveMenu />);
    await openAtSave(user);
    await user.keyboard('{ArrowRight}');
    expect(item(HALF)).toHaveFocus();
    expect(queryMenu(HALF)).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', { name: HALF })).toBeInTheDocument();
    expect(item('Save as…')).toHaveFocus();
    // ArrowLeft in the submenu closes it and returns to the half; again, back to the action.
    await user.keyboard('{ArrowLeft}');
    expect(queryMenu(HALF)).not.toBeInTheDocument();
    expect(item(HALF)).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Save')).toHaveFocus();
    expect(screen.getByRole('menu', { name: 'File' })).toBeInTheDocument();
  });

  it('RTL: ArrowLeft moves to the half and opens it; ArrowRight moves back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaveMenu />, { dir: 'rtl' });
    await openAtSave(user);
    await user.keyboard('{ArrowLeft}');
    expect(item(HALF)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('Save')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(item('Save as…')).toHaveFocus();
  });

  it('activating the action closes the chain and focuses the trigger', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SaveMenu onSave={onSave} />);
    await openAtSave(user);
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(fileButton()).toHaveFocus();
  });

  it('activating an item of its submenu closes the chain', async () => {
    const user = userEvent.setup();
    const onSaveAs = vi.fn();
    render(<SaveMenu onSaveAs={onSaveAs} />);
    await user.click(fileButton());
    await user.click(item(HALF));
    await user.click(item('Save as…'));
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(fileButton()).toHaveFocus();
  });

  it('has no axe violations with the submenu open', async () => {
    const user = userEvent.setup();
    render(<SaveMenu />);
    await user.click(fileButton());
    await user.click(item(HALF));
    expect(screen.getByRole('menu', { name: HALF })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  describe('in a static menu', () => {
    it('both halves are in the roving order and "next" on the half opens the submenu', async () => {
      const user = userEvent.setup();
      render(<SaveMenu isStatic />);
      await user.tab();
      expect(item('New')).toHaveFocus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(item(HALF)).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(item('Save as…')).toHaveFocus();
    });

    it('activating the action closes nothing; activation in the submenu closes it and focuses the half', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onSaveAs = vi.fn();
      render(<SaveMenu isStatic onSave={onSave} onSaveAs={onSaveAs} />);
      await user.click(item('Save'));
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('menu', { name: 'File' })).toBeInTheDocument();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(item('Save as…')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onSaveAs).toHaveBeenCalledTimes(1);
      expect(queryMenu(HALF)).not.toBeInTheDocument();
      expect(item(HALF)).toHaveFocus();
    });
  });

  it('warns once when its children are not a Menu.Item followed by a Menu', () => {
    render(
      <Menu aria-label="File">
        <MenuSplitGroup>
          <Menu.Item>Save</Menu.Item>
          <Menu.Item>Save as…</Menu.Item>
        </MenuSplitGroup>
        <MenuSplitGroup>
          <Menu.Item>Print</Menu.Item>
        </MenuSplitGroup>
      </Menu>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Menu.SplitGroup: expected a Menu.Item (the action) followed by a submenu <Menu> whose Menu.Trigger wraps a Menu.Item with an aria-label (its direct children, Fragments included).',
      ],
    ]);
    warn.mockClear();
  });
});
