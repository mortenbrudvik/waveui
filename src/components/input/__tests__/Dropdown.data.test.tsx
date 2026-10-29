import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown, type DropdownProps } from '../Dropdown';
import { Option, OptionGroup, type ListboxOptionRenderState } from '../Option';
import { dropdownClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';
import { __getAnnouncerText, __resetAnnouncer } from '../../../hooks/useAnnounce';
import { collectOptionLabels, type ListboxItem } from '../../../hooks/useListbox';
import type { VirtualWindow } from '../../../hooks/useVirtualWindow';
import {
  centerOffset,
  COUNT,
  installWindowStubs,
  ITEM_SIZE,
  MANY_ITEMS,
  order,
  range,
  scrollList,
  spacers,
  useTestWindow,
  VIEWPORT,
  type TestWindowOptions,
} from './windowHarness';

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

  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    renderData({ items: ITEMS.slice(0, 20), defaultValue: 'item-3' });
    await user.click(combobox());
    await expectNoA11yViolations();
  });

  it('types items and renderOption', () => {
    expectTypeOf<DropdownProps['items']>().toEqualTypeOf<readonly ListboxItem[] | undefined>();
    expectTypeOf<DropdownProps['renderOption']>().toEqualTypeOf<
      ((item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode) | undefined
    >();
  });

  it('warns once that renderOption is ignored without items', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Dropdown aria-label="Item" renderOption={() => null}>
        <Option value="a">Apple</Option>
      </Dropdown>,
    );
    view.rerender(
      <Dropdown aria-label="Item" renderOption={() => null}>
        <Option value="b">Banana</Option>
      </Dropdown>,
    );
    expect(warn.mock.calls).toEqual([[RENDER_OPTION_WITHOUT_ITEMS]]);
    warn.mockRestore();
  });
});

const RENDER_OPTION_WITHOUT_ITEMS =
  '[WaveUI] Dropdown: `renderOption` is ignored without `items`: it draws the options of data ' +
  'mode only. Pass the options as `items`, or leave `renderOption` out.';

const WINDOW_WITHOUT_ITEMS =
  '[WaveUI] Dropdown: `virtualWindow` is ignored without `items`: only the options of data mode ' +
  'are windowed, so every option child is rendered. Pass the options as `items`.';

const WINDOW_GROUPS =
  '[WaveUI] Dropdown: option groups cannot be windowed: `virtualWindow` renders the flat list of ' +
  '`items` only, and `OptionGroup` children are not windowed. Pass the options as `items`, ' +
  'without groups.';

describe('Dropdown windowed options (virtualWindow)', () => {
  beforeEach(() => {
    installWindowStubs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  type WindowedProps = Partial<DropdownProps> & { windowOptions?: TestWindowOptions };

  /** A Dropdown over the 10,000 items, windowed by a 32-pixel window. */
  function WindowedDropdown({ windowOptions, ...props }: WindowedProps) {
    const virtualWindow = useTestWindow(windowOptions);
    return (
      <Dropdown aria-label="Item" items={MANY_ITEMS} {...props} virtualWindow={virtualWindow} />
    );
  }

  const list = () => screen.getByRole('listbox');

  it('mounts at most 30 of 10,000 options and keeps the active one rendered when scrolled away', async () => {
    const user = userEvent.setup();
    render(<WindowedDropdown />);
    await user.click(combobox());
    expect(activeOption()).toHaveAccessibleName('Item 0');
    expect(order(list())).toEqual([...range(1, 15), 'spacer']);
    const [end] = spacers(list());
    expect(end.tagName).toBe('LI');
    expect(end).toHaveAttribute('aria-hidden', 'true');
    expect(end).toHaveAttribute('role', 'presentation');
    expect(end).toHaveClass(dropdownClassNames.spacer);
    for (const option of options()) {
      expect(option).toHaveAttribute('aria-setsize', '10000');
      expect(option).toHaveStyle({ height: '32px' });
    }
    scrollList(list(), 5000 * ITEM_SIZE);
    expect(order(list())).toEqual([1, 'spacer', ...range(4995, 5015), 'spacer']);
    expect(options().length).toBeLessThanOrEqual(30);
    expect(activeOption()).toBe(within(list()).getByRole('option', { name: 'Item 0' }));
  });

  it('End and Home go to the last and the first item, rendered in the commit that activates them', async () => {
    const user = userEvent.setup();
    const onScrollToIndex = vi.fn();
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<WindowedDropdown windowOptions={{ onScrollToIndex }} />);
    combobox().focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{End}');
    const last = activeOption();
    expect(last).toHaveAccessibleName('Item 9999');
    expect(last).toHaveAttribute('aria-posinset', '10000');
    expect(within(list()).getByRole('option', { name: 'Item 9999' })).toBe(last);
    expect(order(list())).toEqual([...range(1, 15), 'spacer', 10000]);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(last);
    // The browser scrolled it into view: the window follows.
    scrollList(list(), COUNT * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(9987, 10001)]);
    await user.keyboard('{Home}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '1');
    expect(order(list())).toEqual([1, 'spacer', ...range(9987, 10001)]);
    // Only the opening asked the window to scroll (to the first item, at the top).
    expect(onScrollToIndex.mock.calls).toEqual([[0, { align: 'center' }]]);
  });

  it('opens centered on the selected option deep in the list, which is rendered and scrolled into view first', async () => {
    const user = userEvent.setup();
    const onScrollToIndex = vi.fn();
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<WindowedDropdown defaultValue="item-5000" windowOptions={{ onScrollToIndex }} />);
    await user.click(combobox());
    const selected = activeOption();
    expect(selected).toHaveAccessibleName('Item 5000');
    // The kept option, scrolled into view in the commit that opened the list (before the window
    // had the list), then the window's center scroll.
    expect(scrollIntoView.mock.contexts).toHaveLength(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(selected);
    expect(onScrollToIndex.mock.calls).toEqual([[5000, { align: 'center' }]]);
    expect(list().scrollTop).toBe(centerOffset(5000));
    expect(order(list())).toEqual(['spacer', ...range(4991, 5011), 'spacer']);
    expect(within(list()).getByRole('option', { name: 'Item 5000' })).toBe(selected);
  });

  it('PageDown and PageUp move ten options over the data', async () => {
    const user = userEvent.setup();
    render(<WindowedDropdown defaultValue="item-5000" />);
    combobox().focus();
    await user.keyboard('{Enter}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '5001');
    await user.keyboard('{PageDown}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '5011');
    expect(within(list()).getByRole('option', { name: 'Item 5010' })).toBe(activeOption());
    await user.keyboard('{PageUp}{PageUp}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '4991');
  });

  it('End reaches the last shown item: the window counts the items that are not hidden', async () => {
    const user = userEvent.setup();
    const items = MANY_ITEMS.map((item, i) => (i >= 5000 ? { ...item, hidden: true } : item));
    render(<WindowedDropdown items={items} />);
    combobox().focus();
    await user.keyboard('{End}');
    const last = activeOption();
    expect(last).toHaveAccessibleName('Item 4999');
    expect(last).toHaveAttribute('aria-posinset', '5000');
    expect(last).toHaveAttribute('aria-setsize', '5000');
    expect(list().scrollTop).toBe(5000 * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(4987, 5001)]);
  });

  it('typeahead finds an item anywhere in the data', async () => {
    const user = userEvent.setup();
    render(<WindowedDropdown />);
    combobox().focus();
    await user.keyboard('Item 7777');
    const active = activeOption();
    expect(active).toHaveAccessibleName('Item 7777');
    expect(within(list()).getByRole('option', { name: 'Item 7777' })).toBe(active);
  });

  it('selects once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <WindowedDropdown defaultValue="item-5000" onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(combobox());
    expect(list().scrollTop).toBe(centerOffset(5000));
    await user.click(within(list()).getByRole('option', { name: 'Item 4998' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-4998');
  });

  it('warns once that virtualWindow is ignored without items, and renders every option child', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <WindowedDropdown items={undefined}>
        <Option value="a">Apple</Option>
        <Option value="b">Banana</Option>
      </WindowedDropdown>,
    );
    await user.click(combobox());
    expect(options().map((option) => option.textContent)).toEqual(['Apple', 'Banana']);
    expect(spacers(list())).toEqual([]);
    expect(warn.mock.calls).toEqual([[WINDOW_WITHOUT_ITEMS]]);
  });

  it('warns once that option groups cannot be windowed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <WindowedDropdown items={undefined}>
        <OptionGroup label="Pets">
          <Option value="cat">Cat</Option>
        </OptionGroup>
      </WindowedDropdown>,
    );
    expect(warn.mock.calls).toEqual([[WINDOW_GROUPS]]);
  });

  it('has no axe violations while open between two spacers', async () => {
    const user = userEvent.setup();
    render(<WindowedDropdown defaultValue="item-5000" />);
    await user.click(combobox());
    expect(spacers(list())).toHaveLength(2);
    await expectNoA11yViolations();
  });

  it('types virtualWindow', () => {
    expectTypeOf<DropdownProps['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
  });
});
