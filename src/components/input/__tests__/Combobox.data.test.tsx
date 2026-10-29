import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, Option, OptionGroup, type ComboboxProps } from '../Combobox';
import type { ListboxOptionRenderState } from '../Option';
import { comboboxClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations, installResizeObserverMock } from '../../../test-utils';
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
  positions,
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

  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    renderData({ items: ITEMS.slice(0, 20), defaultValue: 'item-3' });
    await user.click(combobox());
    await user.keyboard('{ArrowDown}');
    await expectNoA11yViolations();
  });

  it('types items and renderOption', () => {
    expectTypeOf<ComboboxProps['items']>().toEqualTypeOf<readonly ListboxItem[] | undefined>();
    expectTypeOf<ComboboxProps<true>['renderOption']>().toEqualTypeOf<
      ((item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode) | undefined
    >();
  });

  it('warns once that renderOption is ignored without items', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Combobox aria-label="Item" renderOption={() => null}>
        <Option value="a">Apple</Option>
      </Combobox>,
    );
    view.rerender(
      <Combobox aria-label="Item" renderOption={() => null}>
        <Option value="b">Banana</Option>
      </Combobox>,
    );
    expect(warn.mock.calls).toEqual([[RENDER_OPTION_WITHOUT_ITEMS]]);
    warn.mockRestore();
  });
});

const RENDER_OPTION_WITHOUT_ITEMS =
  '[WaveUI] Combobox: `renderOption` is ignored without `items`: it draws the options of data ' +
  'mode only. Pass the options as `items`, or leave `renderOption` out.';

const WINDOW_WITHOUT_ITEMS =
  '[WaveUI] Combobox: `virtualWindow` is ignored without `items`: only the options of data mode ' +
  'are windowed, so every option child is rendered. Pass the options as `items`.';

const WINDOW_GROUPS =
  '[WaveUI] Combobox: option groups cannot be windowed: `virtualWindow` renders the flat list of ' +
  '`items` only, and `OptionGroup` children are not windowed. Pass the options as `items`, ' +
  'without groups.';

describe('Combobox windowed options (virtualWindow)', () => {
  beforeEach(() => {
    installWindowStubs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  type WindowedProps = Partial<ComboboxProps> & { windowOptions?: TestWindowOptions };

  /** A Combobox over the 10,000 items, windowed by a 32-pixel window. */
  function WindowedCombobox({ windowOptions, ...props }: WindowedProps) {
    const virtualWindow = useTestWindow(windowOptions);
    return (
      <Combobox aria-label="Item" items={MANY_ITEMS} {...props} virtualWindow={virtualWindow} />
    );
  }

  const list = () => screen.getByRole('listbox');

  it('mounts at most 30 of 10,000 options, each 32 pixels tall, with spacers for the others', async () => {
    const user = userEvent.setup();
    render(<WindowedCombobox />);
    await user.click(combobox());
    // 250 pixels show 8 options; 8 more (the default overscan of 240 pixels) are rendered below.
    expect(order(list())).toEqual([...range(1, 17), 'spacer']);
    const [end] = spacers(list());
    expect(end.tagName).toBe('LI');
    expect(end).toHaveAttribute('aria-hidden', 'true');
    expect(end).toHaveAttribute('role', 'presentation');
    expect(end).toHaveClass(comboboxClassNames.spacer);
    expect(end).toHaveStyle({ height: `${(COUNT - 16) * ITEM_SIZE}px` });
    for (const option of options()) {
      expect(option).toHaveAttribute('aria-setsize', '10000');
      expect(option).toHaveStyle({ height: '32px', boxSizing: 'border-box', flexShrink: '0' });
    }
    scrollList(list(), 5000 * ITEM_SIZE);
    // Options 5000 … 5007 in view, 8 more on each side.
    expect(order(list())).toEqual(['spacer', ...range(4993, 5017), 'spacer']);
    expect(options().length).toBeLessThanOrEqual(30);
    expect(spacers(list()).map((spacer) => spacer.style.height)).toEqual([
      `${4992 * ITEM_SIZE}px`,
      `${(COUNT - 5016) * ITEM_SIZE}px`,
    ]);
  });

  it('turns the browser’s scroll anchoring off on the shown list only while windowed', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WindowedCombobox />);
    await user.click(combobox());
    expect(list()).toHaveClass('[overflow-anchor:none]');
    unmount();
    render(<Combobox aria-label="Item" items={MANY_ITEMS.slice(0, 20)} />);
    await user.click(combobox());
    expect(list()).not.toHaveClass('[overflow-anchor:none]');
  });

  it('moves the window to the option an arrow key reaches in the same update, and scrolls it into view', async () => {
    const user = userEvent.setup();
    const onScrollToIndex = vi.fn();
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<WindowedCombobox windowOptions={{ onScrollToIndex }} />);
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveAccessibleName('Item 0');
    await user.keyboard('{ArrowDown}'.repeat(20));
    const active = activeOption();
    expect(active).toHaveAccessibleName('Item 20');
    expect(within(list()).getByRole('option', { name: 'Item 20' })).toBe(active);
    // No scroll event: the keys moved the list (Item 20 at its bottom edge, 422 pixels) and the
    // window with it.
    expect(list().scrollTop).toBe(21 * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(6, 30), 'spacer']);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(active);
    // The opening asked for the first option and then centered it; each key asked for its option.
    expect(onScrollToIndex.mock.calls).toEqual([
      [0, { align: 'auto' }],
      [0, { align: 'center' }],
      ...range(1, 21).map((index) => [index, { align: 'auto' }]),
    ]);
  });

  it('moves the window to the first match in the same update when typing while scrolled deep', async () => {
    const user = userEvent.setup();
    render(<WindowedCombobox />);
    await user.click(combobox());
    scrollList(list(), 5000 * ITEM_SIZE);
    expect(order(list())).toEqual(['spacer', ...range(4993, 5017), 'spacer']);
    await user.type(combobox(), 'Item 5');
    // Item 5, 50 … 59, 500 … 599 and 5000 … 5999: the first match is active, at the top.
    expect(activeOption()).toHaveAccessibleName('Item 5');
    expect(list().scrollTop).toBe(0);
    expect(order(list())).toEqual([...range(1, 17), 'spacer']);
    for (const option of options()) expect(option).toHaveAttribute('aria-setsize', '1111');
  });

  it('scrolls an active option that the window does not render through scrollToIndex', async () => {
    const user = userEvent.setup();
    const onScrollToIndex = vi.fn();
    // An adapter that renders the viewport only (it keeps nothing).
    render(<WindowedCombobox windowOptions={{ onScrollToIndex, keep: false }} />);
    combobox().focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}'.repeat(14));
    expect(onScrollToIndex.mock.calls).toEqual([
      [0, { align: 'auto' }],
      [0, { align: 'center' }],
      ...range(1, 15).map((index) => [index, { align: 'auto' }]),
    ]);
    expect(list().scrollTop).toBe(15 * ITEM_SIZE - VIEWPORT);
    const active = activeOption();
    expect(active).toHaveAccessibleName('Item 14');
    expect(within(list()).getByRole('option', { name: 'Item 14' })).toBe(active);
    expect(positions(list())).toEqual(range(1, 24));
  });

  it('opens on the last item with ArrowUp: aria-posinset 10000, centered as far as the list scrolls', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<WindowedCombobox onValueChange={onValueChange} />);
    combobox().focus();
    await user.keyboard('{ArrowUp}');
    const active = activeOption();
    expect(active).toHaveAccessibleName('Item 9999');
    expect(active).toHaveAttribute('aria-posinset', '10000');
    expect(list().scrollTop).toBe(COUNT * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(9985, 10001)]);
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-9999');
  });

  it('lays out the filtered options: typing while scrolled deep narrows aria-setsize and gives a valid window', async () => {
    const user = userEvent.setup();
    render(<WindowedCombobox />);
    await user.click(combobox());
    scrollList(list(), 5000 * ITEM_SIZE);
    await user.type(combobox(), 'Item 999');
    // Item 999 and Item 9990 … 9999: 11 shown, all rendered (the window is clamped to them).
    expect(options().map((option) => option.textContent)).toEqual([
      'Item 999',
      ...range(9990, 10000).map((i) => `Item ${i}`),
    ]);
    expect(order(list())).toEqual(range(1, 12));
    for (const option of options()) expect(option).toHaveAttribute('aria-setsize', '11');
    expect(activeOption()).toBe(options()[0]);
    // The browser clamps the scroll position to the shorter content.
    scrollList(list(), 11 * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(range(1, 12));
    // Erasing the text brings the 10,000 back under the clamped position.
    await user.clear(combobox());
    expect(order(list())).toEqual([...range(1, 20), 'spacer']);
    for (const option of options()) expect(option).toHaveAttribute('aria-setsize', '10000');
  });

  it('opens with the selected option deep in the list centered in view', async () => {
    const user = userEvent.setup();
    const onScrollToIndex = vi.fn();
    render(<WindowedCombobox defaultValue="item-5000" windowOptions={{ onScrollToIndex }} />);
    await user.click(combobox());
    expect(onScrollToIndex.mock.calls).toEqual([[5000, { align: 'center' }]]);
    expect(list().scrollTop).toBe(centerOffset(5000));
    // Options 4996 … 5003 in view (the selected one among them), 8 more on each side.
    expect(order(list())).toEqual(['spacer', ...range(4989, 5013), 'spacer']);
    const selected = within(list()).getByRole('option', { name: 'Item 5000' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('aria-posinset', '5001');
  });

  it('centers the selected option again when positioning shrinks the list after it opened (fitViewport)', async () => {
    const ro = installResizeObserverMock();
    try {
      let height = VIEWPORT;
      vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (
        this: Element,
      ) {
        return this.getAttribute('role') === 'listbox' ? height : 0;
      });
      const user = userEvent.setup();
      render(<WindowedCombobox defaultValue="item-5000" />);
      await user.click(combobox());
      expect(list().scrollTop).toBe(centerOffset(5000));
      // The surface is fitted to a short viewport after the list mounted: 100 pixels of it show.
      height = 100;
      ro.trigger(list());
      expect(list().scrollTop).toBe(5000 * ITEM_SIZE + ITEM_SIZE / 2 - height / 2);
      // The selected option is rendered, whole inside the 100 pixels (34 pixels from their top).
      const selected = within(list()).getByRole('option', { name: 'Item 5000' });
      expect(selected).toHaveAttribute('aria-selected', 'true');
      expect(5000 * ITEM_SIZE - list().scrollTop).toBe((height - ITEM_SIZE) / 2);
    } finally {
      ro.restore();
    }
  });

  it('asks for the scroll before the window has the popup list, which applies it on attach', async () => {
    const user = userEvent.setup();
    const scrollTops: number[] = [];
    const onScrollToIndex = vi.fn(() => {
      scrollTops.push(screen.getByRole('listbox').scrollTop);
    });
    render(<WindowedCombobox defaultValue="item-5000" windowOptions={{ onScrollToIndex }} />);
    expect(screen.queryAllByRole('option', { hidden: true })).toEqual([]);
    expect(onScrollToIndex).not.toHaveBeenCalled();
    await user.click(combobox());
    // Asked in the commit that mounted the list: the window had no scroller yet, so the list had
    // not moved; it moved when the window attached the list.
    expect(scrollTops).toEqual([0]);
    expect(list().scrollTop).toBe(centerOffset(5000));
  });

  it('lays out a reopened list from its own scroll position and centers the selected option again', async () => {
    const user = userEvent.setup();
    render(<WindowedCombobox />);
    await user.click(combobox());
    scrollList(list(), COUNT * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(9985, 10001)]);
    await user.keyboard('{Escape}');
    expect(screen.queryAllByRole('option', { hidden: true })).toEqual([]);
    await user.click(combobox());
    // A new list at the top: nothing of the window it was closed with.
    expect(list().scrollTop).toBe(0);
    expect(order(list())).toEqual([...range(1, 17), 'spacer']);
    await user.type(combobox(), 'Item 5000{Enter}');
    expect(combobox()).toHaveValue('Item 5000');
    await user.click(combobox());
    expect(list().scrollTop).toBe(centerOffset(5000));
    expect(order(list())).toEqual(['spacer', ...range(4989, 5013), 'spacer']);
  });

  it('keeps a valid window when the items shrink under a deep window and the active item leaves them', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WindowedCombobox />);
    combobox().focus();
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '10000');
    rerender(<WindowedCombobox items={MANY_ITEMS.slice(0, 100)} />);
    // The last options of the 100, as the clamped scroll position shows them; Item 9999 is gone,
    // and with it the highlight.
    expect(order(list())).toEqual(['spacer', ...range(85, 101)]);
    expect(activeOption()).toBeNull();
    scrollList(list(), 100 * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(85, 101)]);
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '100');
  });

  it('centers once and selects once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onScrollToIndex = vi.fn();
    render(
      <React.StrictMode>
        <WindowedCombobox
          defaultValue="item-5000"
          onValueChange={onValueChange}
          windowOptions={{ onScrollToIndex }}
        />
      </React.StrictMode>,
    );
    await user.click(combobox());
    expect(onScrollToIndex.mock.calls).toEqual([[5000, { align: 'center' }]]);
    expect(list().scrollTop).toBe(centerOffset(5000));
    await user.click(within(list()).getByRole('option', { name: 'Item 5002' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-5002');
  });

  it('keeps every value of a multiselect whose selected option left the window, and submits each', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function WindowedMultiselect() {
      const virtualWindow = useTestWindow();
      return (
        <Combobox
          aria-label="Item"
          multiselect
          name="items"
          items={MANY_ITEMS}
          onValueChange={onValueChange}
          virtualWindow={virtualWindow}
        />
      );
    }
    render(
      <form aria-label="Order">
        <WindowedMultiselect />
      </form>,
    );
    await user.click(combobox());
    await user.click(within(list()).getByRole('option', { name: 'Item 2' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['item-2']);
    scrollList(list(), 5000 * ITEM_SIZE);
    await user.click(within(list()).getByRole('option', { name: 'Item 5001' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['item-2', 'item-5001']);
    // Item 2 is no longer rendered, and still selected.
    expect(within(list()).queryByRole('option', { name: 'Item 2' })).toBeNull();
    expect(within(list()).getByRole('option', { name: 'Item 5001' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    expect(new FormData(form).getAll('items')).toEqual(['item-2', 'item-5001']);
    scrollList(list(), 0);
    expect(within(list()).getByRole('option', { name: 'Item 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("sets the window's height on the option renderOption returns, after the option's own style", async () => {
    const user = userEvent.setup();
    render(
      <WindowedCombobox
        renderOption={(item) => (
          <Option value={item.value} label={item.label} style={{ opacity: 0.5, height: 50 }}>
            {item.label}
          </Option>
        )}
      />,
    );
    await user.click(combobox());
    expect(options()[0]).toHaveStyle({ opacity: '0.5', height: '32px' });
  });

  it('renders no spacer and no option height without a window', async () => {
    const user = userEvent.setup();
    renderData({ items: ITEMS.slice(0, 20) });
    await user.click(combobox());
    expect(spacers(screen.getByRole('listbox'))).toEqual([]);
    expect(options()[0].style.height).toBe('');
  });

  it('warns once that virtualWindow is ignored without items, and renders every option child', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <WindowedCombobox items={undefined}>
        <Option value="a">Apple</Option>
        <Option value="b">Banana</Option>
      </WindowedCombobox>,
    );
    await user.click(combobox());
    expect(options().map((option) => option.textContent)).toEqual(['Apple', 'Banana']);
    expect(spacers(list())).toEqual([]);
    expect(warn.mock.calls).toEqual([[WINDOW_WITHOUT_ITEMS]]);
  });

  it('warns once that option groups cannot be windowed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <WindowedCombobox items={undefined}>
        <OptionGroup label="Fruit">
          <Option value="a">Apple</Option>
        </OptionGroup>
      </WindowedCombobox>,
    );
    expect(warn.mock.calls).toEqual([[WINDOW_GROUPS]]);
  });

  it('has no axe violations while open between two spacers', async () => {
    const user = userEvent.setup();
    render(<WindowedCombobox defaultValue="item-5000" />);
    await user.click(combobox());
    expect(spacers(list())).toHaveLength(2);
    await expectNoA11yViolations();
  });

  it('types virtualWindow', () => {
    expectTypeOf<ComboboxProps['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
    expectTypeOf<ComboboxProps<true>['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
  });
});
