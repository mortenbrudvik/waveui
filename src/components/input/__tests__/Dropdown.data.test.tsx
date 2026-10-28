import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown, type DropdownProps } from '../Dropdown';
import { Option, type ListboxOptionRenderState } from '../Option';
import { expectNoA11yViolations } from '../../../test-utils';
import { __getAnnouncerText, __resetAnnouncer } from '../../../hooks/useAnnounce';
import { collectOptionLabels, type ListboxItem } from '../../../hooks/useListbox';

// Pass-through spy: data mode reads no labels from children.
vi.mock('../../../hooks/useListbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useListbox')>();
  return { ...actual, collectOptionLabels: vi.fn(actual.collectOptionLabels) };
});

/** Item 0 … Item 499, values `item-0` … `item-499`. */
const ITEMS: readonly ListboxItem[] = Array.from({ length: 500 }, (_, i) => ({
  value: `item-${i}`,
  label: `Item ${i}`,
}));

const BOTH_SOURCES =
  '[WaveUI] Dropdown: `items` and option children were both passed. The options render from ' +
  '`items` and the children are ignored: pass one of them.';

function combobox() {
  return screen.getByRole('combobox', { name: 'Item' });
}

function options() {
  return screen.queryAllByRole('option');
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function renderData(props: Partial<DropdownProps> = {}) {
  return render(<Dropdown aria-label="Item" items={ITEMS} {...props} />);
}

afterEach(() => {
  __resetAnnouncer();
});

describe('Dropdown data mode (items)', () => {
  it('renders an option per item, with its position from the data', async () => {
    const user = userEvent.setup();
    renderData();
    await user.click(combobox());
    const shown = options();
    expect(shown).toHaveLength(500);
    shown.forEach((option, index) => {
      expect(option).toHaveAttribute('aria-posinset', String(index + 1));
      expect(option).toHaveAttribute('aria-setsize', '500');
    });
    expect(shown[137]).toHaveAccessibleName('Item 137');
  });

  it('renders no option while closed, and shows the selected label from items', () => {
    renderData({ defaultValue: 'item-250' });
    expect(combobox()).toHaveTextContent('Item 250');
    expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);
  });

  it('selects by click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.click(combobox());
    await user.click(screen.getByRole('option', { name: 'Item 321' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-321');
    expect(combobox()).toHaveTextContent('Item 321');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects by keyboard: End, PageUp, Home and the arrows go by the data', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    combobox().focus();
    await user.keyboard('{End}');
    expect(activeOption()).toHaveTextContent('Item 499');
    expect(activeOption()).toHaveAttribute('aria-posinset', '500');
    await user.keyboard('{PageUp}');
    expect(activeOption()).toHaveTextContent('Item 489');
    await user.keyboard('{Home}{PageDown}{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 11');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-11');
    expect(combobox()).toHaveTextContent('Item 11');
    // Reopening starts on the selected item.
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 11');
  });

  it('selects by typeahead over the labels of items', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    combobox().focus();
    await user.keyboard('Item 42');
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    expect(activeOption()).toHaveTextContent('Item 42');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-42');
  });

  it('keeps option ids per value across reopening', async () => {
    const user = userEvent.setup();
    renderData();
    await user.click(combobox());
    const id = screen.getByRole('option', { name: 'Item 77' }).id;
    expect(id).not.toBe('');
    await user.keyboard('{Escape}');
    expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);
    await user.click(combobox());
    expect(screen.getByRole('option', { name: 'Item 77' }).id).toBe(id);
  });

  it('renders a disabled item as a disabled option that the keys skip', async () => {
    const user = userEvent.setup();
    const items = ITEMS.slice(0, 3).map((item) =>
      item.value === 'item-1' ? { ...item, disabled: true } : item,
    );
    render(<Dropdown aria-label="Item" items={items} />);
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 2');
    expect(screen.getByRole('option', { name: 'Item 1' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('passes each item and its state to renderOption', async () => {
    const user = userEvent.setup();
    const renderOption = vi.fn((item: ListboxItem, state: ListboxOptionRenderState) => (
      <Option value={item.value} label={item.label}>
        {item.label}
        {state.selected && ' (selected)'}
        {state.active && ' (active)'}
      </Option>
    ));
    renderData({ defaultValue: 'item-5', renderOption });
    expect(renderOption).not.toHaveBeenCalled();
    await user.click(combobox());
    expect(renderOption).toHaveBeenCalledTimes(500);
    expect(renderOption).toHaveBeenCalledWith(ITEMS[5], { selected: true, active: true, index: 5 });
    expect(renderOption).toHaveBeenCalledWith(ITEMS[0], {
      selected: false,
      active: false,
      index: 0,
    });
    expect(activeOption()).toHaveTextContent('Item 5 (selected) (active)');
    renderOption.mockClear();
    await user.keyboard('{ArrowDown}');
    // Only the options whose state changed render again.
    expect(renderOption.mock.calls).toEqual([
      [ITEMS[5], { selected: true, active: false, index: 5 }],
      [ITEMS[6], { selected: false, active: true, index: 6 }],
    ]);
  });

  it('warns once when both items and option children are passed, and items wins', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Dropdown aria-label="Item" items={ITEMS.slice(0, 2)}>
        <Option value="x">Extra</Option>
      </Dropdown>,
    );
    await user.click(combobox());
    expect(options().map((option) => option.textContent)).toEqual(['Item 0', 'Item 1']);
    view.rerender(
      <Dropdown aria-label="Item" items={ITEMS.slice(0, 2)}>
        <Option value="y">Other</Option>
      </Dropdown>,
    );
    expect(warn.mock.calls).toEqual([[BOTH_SOURCES]]);
    warn.mockRestore();
  });

  it('reads no labels from children in data mode', async () => {
    const user = userEvent.setup();
    const collect = vi.mocked(collectOptionLabels);
    collect.mockClear();
    const view = renderData({ defaultValue: 'item-7' });
    await user.click(combobox());
    await user.click(screen.getByRole('option', { name: 'Item 8' }));
    expect(combobox()).toHaveTextContent('Item 8');
    expect(collect).not.toHaveBeenCalled();
    view.unmount();
    render(
      <Dropdown aria-label="Item">
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    expect(collect).toHaveBeenCalled();
  });

  describe('multiselect', () => {
    it('shows the selected labels from items and keeps values that are not items', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Dropdown
          aria-label="Item"
          multiselect
          items={ITEMS}
          defaultValue={['item-3', 'gone', 'item-1']}
          onValueChange={onValueChange}
        />,
      );
      expect(combobox()).toHaveTextContent('Item 3, Item 1');
      expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Item 400' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['item-3', 'gone', 'item-1', 'item-400']);
      await waitFor(() => expect(__getAnnouncerText()).toBe('Item 400 added, 4 selected'));
      await user.click(screen.getByRole('option', { name: 'Item 3' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['gone', 'item-1', 'item-400']);
      expect(combobox()).toHaveTextContent('Item 1, Item 400');
    });
  });

  it('fires the value callback once per selection in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Dropdown aria-label="Item" items={ITEMS} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(combobox());
    await user.click(screen.getByRole('option', { name: 'Item 42' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-42');
  });

  // axe over 500 open options takes about 3 s in jsdom alone, more under a loaded runner, hence
  // the 20 s timeout.
  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    renderData({ defaultValue: 'item-3' });
    await user.click(combobox());
    await expectNoA11yViolations();
  }, 20_000);

  it('types items and renderOption', () => {
    expectTypeOf<DropdownProps['items']>().toEqualTypeOf<readonly ListboxItem[] | undefined>();
    expectTypeOf<DropdownProps['renderOption']>().toEqualTypeOf<
      ((item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode) | undefined
    >();
  });
});
