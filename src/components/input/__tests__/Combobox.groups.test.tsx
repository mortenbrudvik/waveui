import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, type ComboboxProps } from '../Combobox';
import { Dropdown, type DropdownProps } from '../Dropdown';
import type { ListboxGroupRenderState } from '../Option';
import { optionGroupClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';
import { __resetAnnouncer } from '../../../hooks/useAnnounce';
import { ITEM_SIZE, scrollList, useTestWindow } from './windowHarness';
import {
  activeOptionOf,
  GROUPED_ITEMS,
  groupNames,
  headerTexts,
  installGroupStubs,
  PER_GROUP,
  SMALL_ITEMS,
} from './groupsHarness';

afterEach(() => {
  __resetAnnouncer();
});

describe('Combobox option groups (items with a group)', () => {
  const combobox = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Item' });
  const active = () => activeOptionOf(combobox());

  it('draws the groups of the shown items, and drops a group the filter empties', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Combobox aria-label="Item" items={SMALL_ITEMS} />);
    await user.click(combobox());
    const list = screen.getByRole('listbox');
    expect(groupNames(list)).toEqual(['Fruit', 'Vegetables']);
    expect(headerTexts(list)).toEqual(['Fruit', 'Vegetables']);
    await user.type(combobox(), 'e');
    // Apple, Cherry, Leek, Water and Carrot match; Banana does not.
    expect(screen.getByRole('group', { name: 'Fruit' })).toBeInTheDocument();
    await user.clear(combobox());
    await user.type(combobox(), 'lee');
    expect(groupNames(list)).toEqual(['Vegetables']);
    expect(headerTexts(list)).toEqual(['Vegetables']);
    const leek = screen.getByRole('option', { name: 'Leek' });
    expect(leek).toHaveAttribute('aria-posinset', '1');
    expect(leek).toHaveAttribute('aria-setsize', '1');
    expect(active()).toBe(leek);
  });

  it('walks the arrow keys across a boundary and selects with Enter', async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<Combobox aria-label="Item" items={SMALL_ITEMS} onValueChange={onValueChange} />);
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    // Apple, then Cherry (Banana is disabled), then Water.
    expect(active()).toHaveAccessibleName('Water');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe('carrot');
    expect(combobox()).toHaveValue('Carrot');
  });

  it('has no axe violations while open on a group', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Combobox aria-label="Item" items={SMALL_ITEMS} />);
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    await expectNoA11yViolations();
  });

  it('passes the name and state to renderGroup', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Combobox
        aria-label="Item"
        items={SMALL_ITEMS}
        renderGroup={(name, state) => `${name}: ${state.size}`}
      />,
    );
    await user.click(combobox());
    expect(headerTexts(screen.getByRole('listbox'))).toEqual(['Fruit: 3', 'Vegetables: 2']);
  });

  it('types renderGroup', () => {
    expectTypeOf<ComboboxProps['renderGroup']>().toEqualTypeOf<
      ((group: string, state: ListboxGroupRenderState) => React.ReactNode) | undefined
    >();
  });
});

describe('Combobox windowed option groups (virtualWindow)', () => {
  beforeEach(() => {
    installGroupStubs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function WindowedCombobox(props: Partial<ComboboxProps>) {
    const virtualWindow = useTestWindow();
    return (
      <Combobox aria-label="Item" items={GROUPED_ITEMS} {...props} virtualWindow={virtualWindow} />
    );
  }
  const combobox = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Item' });
  const active = () => activeOptionOf(combobox());
  const list = () => screen.getByRole('listbox');
  const rowCount = () => list().querySelectorAll('[role="option"], [data-group-header]').length;

  it('mounts at most 30 rows of 5,100 and renders the first group under its header', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedCombobox />);
    await user.click(combobox());
    expect(rowCount()).toBeLessThanOrEqual(30);
    expect(headerTexts(list())).toEqual(['Group 0']);
    expect(groupNames(list())).toEqual(['Group 0']);
    expect(list().querySelector('[data-group-header]')).toHaveClass(optionGroupClassNames.label);
    expect(list().querySelector('[data-virtual-spacer]')).not.toBeNull();
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-setsize', String(PER_GROUP));
    }
  });

  it('keys across group boundaries and keeps the window valid', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedCombobox />);
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveAccessibleName('Item 0');
    await user.keyboard('{ArrowDown}'.repeat(PER_GROUP));
    expect(active()).toHaveAccessibleName('Item 50');
    expect(active()).toHaveAttribute('aria-posinset', '1');
    expect(list()).toContainElement(active());
    expect(headerTexts(list())).toContain('Group 1');
    await user.keyboard('{ArrowUp}');
    expect(active()).toHaveAccessibleName('Item 49');
    expect(active()).toHaveAttribute('aria-posinset', String(PER_GROUP));
    expect(rowCount()).toBeLessThanOrEqual(31);
  });

  it('opens on the selected option deep in the list, centered, in its group', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedCombobox defaultValue="g60-10" />);
    await user.click(combobox());
    const selected = screen.getByRole('option', { name: 'Item 3010' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected.closest('[role="group"]')).toHaveAccessibleName('Group 60');
    // Row of Item 3010: 60 headers before it plus the 3010 options before it, plus its own header.
    const row = 3010 + 61;
    expect(list().scrollTop).toBeGreaterThan((row - 8) * ITEM_SIZE - 250);
    expect(rowCount()).toBeLessThanOrEqual(30);
  });

  it('filters a windowed list by group: the groups left follow the matches', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedCombobox />);
    await user.click(combobox());
    scrollList(list(), 2000 * ITEM_SIZE);
    await user.type(combobox(), 'Item 7');
    // Item 7, 70 … 79, 700 … 799 and 7000 …: the matches sit in groups 0, 1, 14 …; the first is
    // active, and its group holds that one match only.
    expect(active()).toHaveAccessibleName('Item 7');
    expect(list().scrollTop).toBe(0);
    expect(headerTexts(list()).slice(0, 3)).toEqual(['Group 0', 'Group 1', 'Group 14']);
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-setsize', '1');
    expect(screen.getByRole('option', { name: 'Item 70' })).toHaveAttribute('aria-setsize', '10');
    expect(rowCount()).toBeLessThanOrEqual(30);
  });

  it('has no axe violations in the middle of a windowed list', async () => {
    const user = userEvent.setup({ delay: null });
    render(<WindowedCombobox defaultValue="g60-10" />);
    await user.click(combobox());
    scrollList(list(), 100 * ITEM_SIZE);
    await expectNoA11yViolations();
  });

  it('mirrors in right-to-left layouts', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<WindowedCombobox />, { dir: 'rtl' });
    combobox().focus();
    await user.keyboard('{ArrowDown}'.repeat(PER_GROUP + 1));
    expect(active()).toHaveAccessibleName('Item 50');
    expect(within(list()).getAllByRole('group').length).toBeGreaterThan(0);
  });
});

describe('Dropdown option groups', () => {
  const dropdown = () => screen.getByRole('combobox', { name: 'Item' });
  const active = () => activeOptionOf(dropdown());

  it('draws the groups and keys over the options', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Dropdown aria-label="Item" items={SMALL_ITEMS} />);
    await user.click(dropdown());
    const list = screen.getByRole('listbox');
    expect(groupNames(list)).toEqual(['Fruit', 'Vegetables']);
    expect(active()).toHaveAccessibleName('Apple');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(active()).toHaveAccessibleName('Carrot');
    await user.keyboard('{Enter}');
    expect(dropdown()).toHaveTextContent('Carrot');
  });

  it('types renderGroup', () => {
    expectTypeOf<DropdownProps['renderGroup']>().toEqualTypeOf<
      ((group: string, state: ListboxGroupRenderState) => React.ReactNode) | undefined
    >();
  });

  describe('windowed', () => {
    beforeEach(() => {
      installGroupStubs();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function WindowedDropdown(props: Partial<DropdownProps>) {
      const virtualWindow = useTestWindow();
      return (
        <Dropdown
          aria-label="Item"
          items={GROUPED_ITEMS}
          {...props}
          virtualWindow={virtualWindow}
        />
      );
    }

    it('mounts at most 30 rows, keys across the boundaries, and types ahead over the options', async () => {
      const user = userEvent.setup({ delay: null });
      render(<WindowedDropdown />);
      await user.click(dropdown());
      const list = screen.getByRole('listbox');
      expect(
        list.querySelectorAll('[role="option"], [data-group-header]').length,
      ).toBeLessThanOrEqual(30);
      expect(headerTexts(list)).toEqual(['Group 0']);
      await user.keyboard('{ArrowDown}'.repeat(PER_GROUP));
      expect(active()).toHaveAccessibleName('Item 50');
      expect(headerTexts(list)).toContain('Group 1');
      await user.keyboard('Item 2222');
      expect(active()).toHaveAccessibleName('Item 2222');
      expect(list).toContainElement(active());
      await user.keyboard('{Enter}');
      expect(dropdown()).toHaveTextContent('Item 2222');
    });

    it('has no axe violations while open on a windowed group', async () => {
      const user = userEvent.setup({ delay: null });
      render(<WindowedDropdown defaultValue="g60-10" />);
      await user.click(dropdown());
      await expectNoA11yViolations();
    });
  });
});
