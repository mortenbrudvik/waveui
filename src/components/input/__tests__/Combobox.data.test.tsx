import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, Option, type ComboboxProps } from '../Combobox';
import type { ListboxOptionRenderState } from '../Option';
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
  '[WaveUI] Combobox: `items` and option children were both passed. The options render from ' +
  '`items` and the children are ignored: pass one of them.';

function combobox() {
  return screen.getByRole<HTMLInputElement>('combobox', { name: 'Item' });
}

function options() {
  return screen.queryAllByRole('option');
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function renderData(props: Partial<ComboboxProps> = {}) {
  return render(<Combobox aria-label="Item" items={ITEMS} {...props} />);
}

afterEach(() => {
  __resetAnnouncer();
});

describe('Combobox data mode (items)', () => {
  it('renders an option per item, with its position from the data', async () => {
    const user = userEvent.setup();
    renderData();
    await user.click(combobox());
    const shown = options();
    expect(shown).toHaveLength(500);
    expect(shown[0]).toHaveAccessibleName('Item 0');
    expect(shown[499]).toHaveAccessibleName('Item 499');
    shown.forEach((option, index) => {
      expect(option).toHaveAttribute('aria-posinset', String(index + 1));
      expect(option).toHaveAttribute('aria-setsize', '500');
    });
  });

  it('renders no option while closed, and shows the selected label from items', () => {
    renderData({ defaultValue: 'item-250' });
    expect(combobox()).toHaveValue('Item 250');
    expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);
    // aria-controls still names the (empty, hidden) listbox element.
    const listboxId = combobox().getAttribute('aria-controls');
    expect(listboxId && document.getElementById(listboxId)).toBeInstanceOf(HTMLUListElement);
  });

  it('follows a controlled value to a label from items while closed', () => {
    const { rerender } = render(<Combobox aria-label="Item" items={ITEMS} value="item-3" />);
    expect(combobox()).toHaveValue('Item 3');
    rerender(<Combobox aria-label="Item" items={ITEMS} value="item-498" />);
    expect(combobox()).toHaveValue('Item 498');
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
    expect(combobox()).toHaveValue('Item 321');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects by keyboard', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 0');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 2');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-2');
    expect(combobox()).toHaveValue('Item 2');
    // Reopening starts on the selected item.
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toHaveTextContent('Item 2');
  });

  it('opens on the last item with ArrowUp when nothing is selected', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    combobox().focus();
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toHaveTextContent('Item 499');
    expect(activeOption()).toHaveAttribute('aria-posinset', '500');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-499');
  });

  it('typing filters the items; the first match is active, mounted and selected by Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.type(combobox(), 'Item 49');
    const shown = options();
    expect(shown.map((option) => option.textContent)).toEqual([
      'Item 49',
      ...Array.from({ length: 10 }, (_, i) => `Item ${490 + i}`),
    ]);
    shown.forEach((option, index) => {
      expect(option).toHaveAttribute('aria-posinset', String(index + 1));
      expect(option).toHaveAttribute('aria-setsize', '11');
    });
    const active = activeOption();
    expect(active).not.toBeNull();
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: 'Item 49' })).toBe(
      active,
    );
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 490');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-490');
    expect(combobox()).toHaveValue('Item 490');
  });

  it('matches the filter on textValue and through a custom filter', async () => {
    const user = userEvent.setup();
    const items: ListboxItem[] = [
      { value: 'nb', label: 'Norwegian', textValue: 'Norsk' },
      { value: 'sv', label: 'Swedish', textValue: 'Svenska' },
    ];
    const { unmount } = render(<Combobox aria-label="Item" items={items} />);
    await user.type(combobox(), 'sven');
    expect(options().map((option) => option.textContent)).toEqual(['Swedish']);
    unmount();
    render(
      <Combobox
        aria-label="Item"
        items={ITEMS}
        filter={(item, query) => item.value === `item-${query}`}
      />,
    );
    await user.type(combobox(), '7');
    expect(options().map((option) => option.textContent)).toEqual(['Item 7']);
  });

  it('keeps option ids per value across filtering and reopening', async () => {
    const user = userEvent.setup();
    renderData();
    await user.click(combobox());
    const id = screen.getByRole('option', { name: 'Item 495' }).id;
    expect(id).not.toBe('');
    await user.type(combobox(), 'Item 495');
    expect(screen.getByRole('option', { name: 'Item 495' }).id).toBe(id);
    await user.keyboard('{Escape}{Escape}');
    await user.click(combobox());
    expect(screen.getByRole('option', { name: 'Item 495' }).id).toBe(id);
  });

  it('renders a disabled item as a disabled option that the keys skip', async () => {
    const user = userEvent.setup();
    const items = ITEMS.slice(0, 3).map((item) =>
      item.value === 'item-1' ? { ...item, disabled: true } : item,
    );
    const onValueChange = vi.fn();
    render(<Combobox aria-label="Item" items={items} onValueChange={onValueChange} />);
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Item 2');
    const disabled = screen.getByRole('option', { name: 'Item 1' });
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await user.click(disabled);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('leaves hidden items out of the list but keeps their label', async () => {
    const user = userEvent.setup();
    const items: ListboxItem[] = [
      { value: 'a', label: 'Apple' },
      { value: 'p', label: 'Pick a fruit', hidden: true },
      { value: 'b', label: 'Banana' },
    ];
    render(<Combobox aria-label="Item" items={items} defaultValue="p" />);
    expect(combobox()).toHaveValue('Pick a fruit');
    await user.click(combobox());
    expect(options().map((option) => option.textContent)).toEqual(['Apple', 'Banana']);
    expect(options()[1]).toHaveAttribute('aria-setsize', '2');
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
    renderData({ defaultValue: 'item-2', renderOption });
    expect(renderOption).not.toHaveBeenCalled();
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(renderOption).toHaveBeenCalledWith(ITEMS[2], {
      selected: true,
      active: true,
      index: 2,
    });
    expect(renderOption).toHaveBeenCalledWith(ITEMS[3], {
      selected: false,
      active: false,
      index: 3,
    });
    expect(activeOption()).toHaveTextContent('Item 2 (selected) (active)');
    await user.keyboard('{ArrowDown}');
    expect(renderOption).toHaveBeenLastCalledWith(ITEMS[3], {
      selected: false,
      active: true,
      index: 3,
    });
    expect(screen.getByRole('option', { name: 'Item 2 (selected)' })).toHaveAttribute(
      'aria-posinset',
      '3',
    );
    // The index counts the shown options: 'Item 49' filters to Item 49 and Item 490 … 499.
    await user.clear(combobox());
    await user.type(combobox(), 'Item 49');
    expect(renderOption).toHaveBeenCalledWith(ITEMS[490], {
      selected: false,
      active: false,
      index: 1,
    });
  });

  it('gives a custom option component its position', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        aria-label="Item"
        items={ITEMS.slice(0, 3)}
        renderOption={(item) => (
          <Option value={item.value} label={item.label} className="font-semibold">
            <span>{item.label}</span>
          </Option>
        )}
      />,
    );
    await user.click(combobox());
    expect(screen.getByRole('option', { name: 'Item 1' })).toHaveAttribute('aria-posinset', '2');
    expect(screen.getByRole('option', { name: 'Item 1' })).toHaveAttribute('aria-setsize', '3');
  });

  it('warns once when both items and option children are passed, and items wins', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Combobox aria-label="Item" items={ITEMS.slice(0, 2)}>
        <Option value="x">Extra</Option>
      </Combobox>,
    );
    await user.click(combobox());
    expect(options().map((option) => option.textContent)).toEqual(['Item 0', 'Item 1']);
    view.rerender(
      <Combobox aria-label="Item" items={ITEMS.slice(0, 2)}>
        <Option value="y">Other</Option>
      </Combobox>,
    );
    expect(warn.mock.calls).toEqual([[BOTH_SOURCES]]);
    warn.mockRestore();
  });

  it('does not warn for children that render nothing', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <Combobox aria-label="Item" items={ITEMS.slice(0, 2)}>
        {false}
        {null}
      </Combobox>,
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reads no labels from children in data mode', async () => {
    const user = userEvent.setup();
    const collect = vi.mocked(collectOptionLabels);
    collect.mockClear();
    const view = renderData({ defaultValue: 'item-7' });
    await user.click(combobox());
    await user.click(screen.getByRole('option', { name: 'Item 8' }));
    await user.type(combobox(), 'Item 1');
    expect(collect).not.toHaveBeenCalled();
    view.unmount();
    // The children form still reads them (the spy is live).
    render(
      <Combobox aria-label="Item">
        <Option value="a">Apple</Option>
      </Combobox>,
    );
    expect(collect).toHaveBeenCalled();
  });

  it('renders no position on the options of the children form', async () => {
    const user = userEvent.setup();
    render(
      <Combobox aria-label="Item">
        <Option value="a">Apple</Option>
        <Option value="b">Banana</Option>
      </Combobox>,
    );
    await user.click(combobox());
    expect(screen.getByRole('option', { name: 'Apple' })).not.toHaveAttribute('aria-posinset');
    expect(screen.getByRole('option', { name: 'Apple' })).not.toHaveAttribute('aria-setsize');
  });

  describe('multiselect', () => {
    it('shows the selected labels from items and keeps values that are not items', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Combobox
          aria-label="Item"
          multiselect
          items={ITEMS}
          defaultValue={['gone', 'item-1']}
          onValueChange={onValueChange}
        />,
      );
      expect(combobox()).toHaveValue('Item 1');
      expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Item 400' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['gone', 'item-1', 'item-400']);
      await waitFor(() => expect(__getAnnouncerText()).toBe('Item 400 added, 3 selected'));
      await user.click(screen.getByRole('option', { name: 'Item 1' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['gone', 'item-400']);
      expect(screen.getByRole('option', { name: 'Item 400' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('submits every value, those without an item included', () => {
      render(
        <form aria-label="Order">
          <Combobox
            aria-label="Item"
            multiselect
            name="items"
            items={ITEMS}
            defaultValue={['gone', 'item-1']}
          />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(new FormData(form).getAll('items')).toEqual(['gone', 'item-1']);
    });
  });

  it('fires the value callback once per selection in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Combobox aria-label="Item" items={ITEMS} onValueChange={onValueChange} />
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
    await user.keyboard('{ArrowDown}');
    await expectNoA11yViolations();
  }, 20_000);

  it('types items and renderOption', () => {
    expectTypeOf<ComboboxProps['items']>().toEqualTypeOf<readonly ListboxItem[] | undefined>();
    expectTypeOf<ComboboxProps<true>['renderOption']>().toEqualTypeOf<
      ((item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode) | undefined
    >();
  });
});
