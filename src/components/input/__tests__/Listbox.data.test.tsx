import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Listbox, type ListboxProps } from '../Listbox';
import { Option, OptionGroup, type ListboxOptionRenderState } from '../Option';
import { listboxClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations, findDanglingIdRefsInHtml } from '../../../test-utils';
import { __getAnnouncerText, __resetAnnouncer } from '../../../hooks/useAnnounce';
import { collectOptionLabels, type ListboxItem } from '../../../hooks/useListbox';
import type { VirtualWindow } from '../../../hooks/useVirtualWindow';
import {
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
  '[WaveUI] Listbox: `items` and option children were both passed. The options render from ' +
  '`items` and the children are ignored: pass one of them.';

const list = () => screen.getByRole('listbox', { name: 'Items' });

/** The option the list's `aria-activedescendant` points at. */
function activeOption(): HTMLElement | null {
  const id = list().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function renderData(props: Partial<ListboxProps> = {}) {
  return render(<Listbox aria-label="Items" items={ITEMS} {...props} />);
}

afterEach(() => {
  __resetAnnouncer();
});

describe('Listbox data mode (items)', () => {
  it('renders an option per item, with its position from the data', () => {
    renderData();
    const shown = screen.getAllByRole('option');
    expect(shown).toHaveLength(500);
    shown.forEach((option, index) => {
      expect(option).toHaveAttribute('aria-posinset', String(index + 1));
      expect(option).toHaveAttribute('aria-setsize', '500');
    });
    expect(shown[499]).toHaveAccessibleName('Item 499');
  });

  it('selects by click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.click(screen.getByRole('option', { name: 'Item 321' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-321');
    expect(list()).toHaveFocus();
    expect(activeOption()).toHaveTextContent('Item 321');
    expect(screen.getByRole('option', { name: 'Item 321' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('selects by keyboard: End, PageUp, Home and the arrows go by the data', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.tab();
    expect(list()).toHaveFocus();
    expect(activeOption()).toHaveTextContent('Item 0');
    await user.keyboard('{End}');
    expect(activeOption()).toHaveTextContent('Item 499');
    expect(activeOption()).toHaveAttribute('aria-posinset', '500');
    await user.keyboard('{PageUp}{ArrowUp}');
    expect(activeOption()).toHaveTextContent('Item 488');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-488');
    await user.keyboard('{Home}{ArrowDown} ');
    expect(onValueChange).toHaveBeenLastCalledWith('item-1');
  });

  it('selects by typeahead over the labels of items', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderData({ onValueChange });
    await user.tab();
    await user.keyboard('Item 42');
    expect(activeOption()).toHaveTextContent('Item 42');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('item-42');
  });

  it('starts on a selected item deep in the data, which is mounted', async () => {
    const user = userEvent.setup();
    renderData({ defaultValue: 'item-450' });
    await user.tab();
    const active = activeOption();
    expect(active).toHaveTextContent('Item 450');
    expect(list()).toContainElement(active);
    expect(active).toHaveAttribute('aria-selected', 'true');
  });

  it('renders a disabled item as a disabled option that the keys skip', async () => {
    const user = userEvent.setup();
    const items = ITEMS.slice(0, 3).map((item) =>
      item.value === 'item-1' ? { ...item, disabled: true } : item,
    );
    render(<Listbox aria-label="Items" items={items} />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
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
    expect(renderOption).toHaveBeenCalledTimes(500);
    expect(renderOption).toHaveBeenCalledWith(ITEMS[5], {
      selected: true,
      active: false,
      index: 5,
    });
    renderOption.mockClear();
    await user.tab();
    expect(renderOption.mock.calls).toEqual([
      [ITEMS[5], { selected: true, active: true, index: 5 }],
    ]);
    expect(activeOption()).toHaveTextContent('Item 5 (selected) (active)');
  });

  it('warns once when both items and option children are passed, and items wins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Listbox aria-label="Items" items={ITEMS.slice(0, 2)}>
        <Option value="x">Extra</Option>
      </Listbox>,
    );
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Item 0',
      'Item 1',
    ]);
    view.rerender(
      <Listbox aria-label="Items" items={ITEMS.slice(0, 2)}>
        <Option value="y">Other</Option>
      </Listbox>,
    );
    expect(warn.mock.calls).toEqual([[BOTH_SOURCES]]);
    warn.mockRestore();
  });

  it('reads no labels from children in data mode', async () => {
    const user = userEvent.setup();
    const collect = vi.mocked(collectOptionLabels);
    collect.mockClear();
    renderData();
    await user.click(screen.getByRole('option', { name: 'Item 8' }));
    expect(collect).not.toHaveBeenCalled();
  });

  it('renders the positions in the server HTML, with no dangling id', () => {
    const html = renderToString(
      <Listbox aria-label="Items" items={ITEMS.slice(0, 3)} defaultValue="item-1" />,
    );
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = html;
    const shown = parsed.querySelectorAll('[role="option"]');
    expect(Array.from(shown, (option) => option.getAttribute('aria-posinset'))).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(shown[1]).toHaveAttribute('aria-setsize', '3');
    expect(shown[1]).toHaveAttribute('aria-selected', 'true');
  });

  describe('multiselect', () => {
    it('keeps values that are not items and announces the label from items', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Listbox
          aria-label="Items"
          multiselect
          items={ITEMS}
          defaultValue={['gone', 'item-1']}
          onValueChange={onValueChange}
        />,
      );
      await user.click(screen.getByRole('option', { name: 'Item 400' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['gone', 'item-1', 'item-400']);
      await waitFor(() => expect(__getAnnouncerText()).toBe('Item 400 added, 3 selected'));
      await user.click(screen.getByRole('option', { name: 'Item 1' }));
      expect(onValueChange).toHaveBeenLastCalledWith(['gone', 'item-400']);
    });
  });

  it('fires the value callback once per selection in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Listbox aria-label="Items" items={ITEMS} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('option', { name: 'Item 42' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-42');
  });

  it('follows new items', async () => {
    const { rerender } = renderData();
    act(() => rerender(<Listbox aria-label="Items" items={ITEMS.slice(10, 12)} />));
    const shown = screen.getAllByRole('option');
    expect(shown.map((option) => option.textContent)).toEqual(['Item 10', 'Item 11']);
    expect(shown[1]).toHaveAttribute('aria-setsize', '2');
    expect(shown[1]).toHaveAttribute('aria-posinset', '2');
  });

  it('has no axe violations with the list focused', async () => {
    const user = userEvent.setup();
    renderData({ items: ITEMS.slice(0, 20), defaultValue: 'item-3' });
    await user.tab();
    await expectNoA11yViolations();
  });

  it('types items and renderOption', () => {
    expectTypeOf<ListboxProps['items']>().toEqualTypeOf<readonly ListboxItem[] | undefined>();
    expectTypeOf<ListboxProps<true>['renderOption']>().toEqualTypeOf<
      ((item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode) | undefined
    >();
  });

  it('warns once that renderOption is ignored without items', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Listbox aria-label="Items" renderOption={() => null}>
        <Option value="a">Apple</Option>
      </Listbox>,
    );
    view.rerender(
      <Listbox aria-label="Items" renderOption={() => null}>
        <Option value="b">Banana</Option>
      </Listbox>,
    );
    expect(warn.mock.calls).toEqual([[RENDER_OPTION_WITHOUT_ITEMS]]);
    warn.mockRestore();
  });
});

const RENDER_OPTION_WITHOUT_ITEMS =
  '[WaveUI] Listbox: `renderOption` is ignored without `items`: it draws the options of data ' +
  'mode only. Pass the options as `items`, or leave `renderOption` out.';

const WINDOW_WITHOUT_ITEMS =
  '[WaveUI] Listbox: `virtualWindow` is ignored without `items`: only the options of data mode ' +
  'are windowed, so every option child is rendered. Pass the options as `items`.';

const WINDOW_GROUPS =
  '[WaveUI] Listbox: option groups cannot be windowed: `virtualWindow` renders the flat list of ' +
  '`items` only, and `OptionGroup` children are not windowed. Pass the options as `items`, ' +
  'without groups.';

describe('Listbox windowed options (virtualWindow)', () => {
  beforeEach(() => {
    installWindowStubs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  type WindowedProps = Partial<ListboxProps> & { windowOptions?: TestWindowOptions };

  /** A Listbox over the 10,000 items, windowed by a 32-pixel window. */
  function WindowedListbox({ windowOptions, ...props }: WindowedProps) {
    const virtualWindow = useTestWindow(windowOptions);
    return (
      <Listbox aria-label="Items" items={MANY_ITEMS} {...props} virtualWindow={virtualWindow} />
    );
  }

  it('mounts at most 30 of 10,000 options in the list, which is the scroller', () => {
    render(<WindowedListbox />);
    expect(order(list())).toEqual([...range(1, 15), 'spacer']);
    const [end] = spacers(list());
    expect(end.tagName).toBe('LI');
    expect(end).toHaveAttribute('aria-hidden', 'true');
    expect(end).toHaveAttribute('role', 'presentation');
    expect(end).toHaveClass(listboxClassNames.spacer);
    // The list is a flex column: neither the spacers nor the options shrink.
    expect(end).toHaveStyle({ height: `${(COUNT - 14) * ITEM_SIZE}px`, flexShrink: '0' });
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-setsize', '10000');
      expect(option).toHaveStyle({ height: '32px', boxSizing: 'border-box', flexShrink: '0' });
    }
    // Without its block padding, so the options start at the top of the scroller.
    expect(list()).toHaveClass('py-0');
    scrollList(list(), 5000 * ITEM_SIZE);
    expect(order(list())).toEqual(['spacer', ...range(4995, 5015), 'spacer']);
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(30);
  });

  it('renders the first window on the server, with no dangling id', () => {
    const html = renderToString(<WindowedListbox defaultValue="item-3" />);
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = html;
    const listElement = parsed.querySelector('[role="listbox"]');
    expect(listElement).not.toBeNull();
    // 480 pixels assumed before the first measure: 15 options and 6 more.
    expect(positions(listElement as Element)).toEqual(range(1, 22));
    expect(spacers(listElement as HTMLElement)).toHaveLength(1);
  });

  it('hydrates the first window without a mismatch, then lays out the measured list', async () => {
    const error = vi.spyOn(console, 'error');
    const ui = <WindowedListbox defaultValue="item-3" />;
    const container = document.createElement('div');
    container.innerHTML = renderToString(ui);
    document.body.appendChild(container);
    let root: Root | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, ui);
      });
      await act(async () => {});
      expect(order(list())).toEqual([...range(1, 15), 'spacer']);
      expect(screen.getByRole('option', { name: 'Item 3' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(error).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it('moves the window to the selected option deep in the list on focus, and keeps it rendered when scrolled away', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<WindowedListbox defaultValue="item-5000" />);
    await user.tab();
    const active = activeOption();
    expect(active).toHaveAccessibleName('Item 5000');
    // No scroll event: Item 5000 at the bottom edge of the list, the window around it.
    expect(list().scrollTop).toBe(5001 * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(4988, 5008), 'spacer']);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(active);
    // Scrolled away (the wheel): it stays rendered, between spacers.
    scrollList(list(), 9000 * ITEM_SIZE);
    expect(order(list())).toEqual(['spacer', 5001, 'spacer', ...range(8995, 9015), 'spacer']);
    expect(activeOption()).toBe(active);
  });

  it('End, Home, PageDown and typeahead move over the data, and the window with them', async () => {
    const user = userEvent.setup();
    render(<WindowedListbox />);
    await user.tab();
    await user.keyboard('{End}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '10000');
    expect(within(list()).getByRole('option', { name: 'Item 9999' })).toBe(activeOption());
    // No scroll event: the last 8 options in view, 6 more above them.
    expect(list().scrollTop).toBe(COUNT * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(9987, 10001)]);
    await user.keyboard('{Home}{PageDown}{PageDown}');
    expect(activeOption()).toHaveAttribute('aria-posinset', '21');
    await user.keyboard('Item 4321');
    expect(activeOption()).toHaveAccessibleName('Item 4321');
    expect(list()).toContainElement(activeOption());
    expect(list().scrollTop).toBe(4322 * ITEM_SIZE - VIEWPORT);
    expect(order(list())).toEqual(['spacer', ...range(4309, 4329), 'spacer']);
  });

  it('makes no window request for a pointer press, also on a disabled option that leaves the selected one active', () => {
    const onScrollToIndex = vi.fn();
    const items = MANY_ITEMS.map((item, i) => (i === 3 ? { ...item, disabled: true } : item));
    render(
      <WindowedListbox
        items={items}
        defaultValue="item-5000"
        windowOptions={{ onScrollToIndex }}
      />,
    );
    // The disabled Item 3 cannot be active: the press focuses the list on its fallback, the
    // selected Item 5000, without scrolling to it (the list stays under the pointer).
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Item 3' }), { button: 0 });
    expect(list()).toHaveFocus();
    expect(activeOption()).toHaveAccessibleName('Item 5000');
    expect(list().scrollTop).toBe(0);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Item 5' }), { button: 0 });
    expect(activeOption()).toHaveAccessibleName('Item 5');
    expect(list().scrollTop).toBe(0);
    expect(onScrollToIndex).not.toHaveBeenCalled();
  });

  it('scrolls an active option that the window does not render through scrollToIndex', async () => {
    const user = userEvent.setup();
    const onScrollToIndex = vi.fn();
    // An adapter that renders the viewport only (it keeps nothing).
    render(<WindowedListbox windowOptions={{ onScrollToIndex, keep: false }} />);
    await user.tab();
    await user.keyboard('{ArrowDown}'.repeat(14));
    // Focus made Item 0 active, then each key asked for its option.
    expect(onScrollToIndex.mock.calls).toEqual(range(0, 15).map((i) => [i, { align: 'auto' }]));
    expect(list().scrollTop).toBe(15 * ITEM_SIZE - VIEWPORT);
    expect(activeOption()).toHaveAccessibleName('Item 14');
    expect(list()).toContainElement(activeOption());
  });

  it('keeps a valid window when the items shrink under a deep window with the active option past the new count', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WindowedListbox />);
    await user.tab();
    scrollList(list(), 9000 * ITEM_SIZE);
    await user.keyboard('{End}');
    expect(order(list())).toEqual(['spacer', ...range(9987, 10001)]);
    rerender(<WindowedListbox items={MANY_ITEMS.slice(0, 100)} />);
    // Item 9999 left the items, so the first one is active: the render lays out the 100 under the
    // window clamped to their end (with Item 0 kept), then the window moves to Item 0.
    expect(list().scrollTop).toBe(0);
    expect(order(list())).toEqual([...range(1, 15), 'spacer']);
    expect(activeOption()).toHaveAccessibleName('Item 0');
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-setsize', '100');
    }
  });

  it('selects once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <WindowedListbox onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('option', { name: 'Item 12' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('item-12');
  });

  it('warns once that virtualWindow is ignored without items, and renders every option child', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <WindowedListbox items={undefined}>
        <Option value="a">Apple</Option>
        <Option value="b">Banana</Option>
      </WindowedListbox>,
    );
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Apple',
      'Banana',
    ]);
    expect(spacers(list())).toEqual([]);
    expect(list()).not.toHaveClass('py-0');
    expect(warn.mock.calls).toEqual([[WINDOW_WITHOUT_ITEMS]]);
  });

  it('warns once that option groups cannot be windowed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <WindowedListbox items={undefined}>
        <OptionGroup label="Fruit">
          <Option value="a">Apple</Option>
        </OptionGroup>
      </WindowedListbox>,
    );
    expect(warn.mock.calls).toEqual([[WINDOW_GROUPS]]);
  });

  it('has no axe violations focused between two spacers', async () => {
    const user = userEvent.setup();
    render(<WindowedListbox defaultValue="item-5000" />);
    await user.tab();
    expect(spacers(list())).toHaveLength(2);
    await expectNoA11yViolations();
  });

  it('types virtualWindow', () => {
    expectTypeOf<ListboxProps['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
  });
});
