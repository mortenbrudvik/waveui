import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { DataGrid } from '../DataGrid';
import type { DataGridBaseProps, DataGridItemsSortProps } from '../DataGrid';
import { dataGridClassNames } from '../../../lib/classNames';
import { createTableColumn } from '../../../lib/table';
import { useVirtualWindow, type UseVirtualWindowOptions } from '../../../hooks/useVirtualWindow';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/** The row height of every window here, in pixels. */
const ITEM = 44;
/** The height of the sticky header the windows are told about (`scrollPaddingStart`). */
const HEADER = 44;
/** The `clientHeight` of the grid's scroller (jsdom has no layout). */
const VIEWPORT = 480;
const COUNT = 10_000;

interface Item {
  id: string;
  name: string;
  size: number;
}

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `id-${index}`,
    name: `Item ${String(index).padStart(5, '0')}`,
    size: (index * 7919) % 1000,
  }));

const ITEMS = makeItems(COUNT);
const getId = (item: Item) => item.id;
const byName = (a: Item, b: Item) => {
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
};

const COLUMNS = [
  createTableColumn<Item>({
    columnId: 'name',
    label: 'Name',
    compare: byName,
    renderCell: (item) => item.name,
  }),
  createTableColumn<Item>({
    columnId: 'size',
    label: 'Size',
    renderCell: (item) => `Size ${item.size}`,
  }),
];

/** The `clientHeight` the scroller reports. */
let viewportHeight = VIEWPORT;
/** The `scrollHeight` the scroller reports. */
let contentHeight = HEADER + COUNT * ITEM;

/** Frames requested through the `requestAnimationFrame` stub, run by {@link runFrames}. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

/** Runs the frames requested so far (the window reads a scroll in a frame), inside `act`. */
function runFrames(): void {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

const isScroller = (el: Element) => el.classList.contains(dataGridClassNames.container);

beforeEach(() => {
  viewportHeight = VIEWPORT;
  contentHeight = HEADER + COUNT * ITEM;
  frames.clear();
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return isScroller(this) ? viewportHeight : 0;
  });
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    return isScroller(this) ? contentHeight : 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

type GridProps = Omit<DataGridBaseProps<Item>, 'virtualWindow'> &
  Partial<Omit<DataGridItemsSortProps<Item>, 'items'>> & {
    items?: readonly Item[];
    /** Options of the grid's `useVirtualWindow` (`itemSize` 44, `scrollPaddingStart` 44). */
    windowOptions?: Partial<UseVirtualWindowOptions>;
    /** Passes the window to the grid. @default true */
    windowed?: boolean;
  };

/** A DataGrid of `items` (10,000 by default) with the Name and Size columns and a window. */
function Grid({ items = ITEMS, windowOptions, windowed = true, ...props }: GridProps) {
  const virtualWindow = useVirtualWindow({
    itemSize: ITEM,
    scrollPaddingStart: HEADER,
    ...windowOptions,
  });
  return (
    <DataGrid
      aria-label="Items"
      columns={COLUMNS}
      getRowId={getId}
      {...props}
      items={items}
      virtualWindow={windowed ? virtualWindow : undefined}
    />
  );
}

const grid = () => screen.getByRole('grid', { name: 'Items' });
const scroller = () => grid().parentElement as HTMLElement;
/** The mounted body rows (spacers left out), in DOM order. */
const bodyRows = () =>
  Array.from(grid().querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr[data-row-index]'));
const spacerRows = () =>
  Array.from(
    grid().querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr[data-virtual-spacer]'),
  );
const mountedIndexes = () => bodyRows().map((row) => Number(row.getAttribute('data-row-index')));
const rowOfIndex = (index: number) => {
  const row = grid().querySelector<HTMLTableRowElement>(`tr[data-row-index="${index}"]`);
  if (!row) throw new Error(`row ${index} is not mounted`);
  return row;
};
const cellOf = (index: number, column: number) =>
  within(rowOfIndex(index)).getAllByRole('gridcell')[column];
const focusedRow = () => document.activeElement?.closest('tr') ?? null;
/** Body row kinds in DOM order: a row's index, or `'spacer'`. */
const bodyOrder = () =>
  Array.from(grid().querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr'), (row) =>
    row.hasAttribute('data-virtual-spacer') ? 'spacer' : Number(row.getAttribute('data-row-index')),
  );
/** The heights of the mounted rows and the spacers, added up. */
const totalHeight = () =>
  [...bodyRows(), ...spacerRows()].reduce((sum, row) => sum + parseFloat(row.style.height), 0);
/** `[from, to)`. */
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
const tabStops = () => Array.from(grid().querySelectorAll('[tabindex="0"]'));

/** Sets the scroller's `scrollTop`, fires `scroll` and runs the window's frame. */
function scrollTo(top: number): void {
  act(() => {
    scroller().scrollTop = top;
    fireEvent.scroll(scroller());
  });
  runFrames();
}

function focus(el: HTMLElement): void {
  act(() => el.focus());
}

/** The bare `[WaveUI]` messages `warn` was called with. */
const messages = (warn: { mock: { calls: unknown[][] } }) => warn.mock.calls.map((call) => call[0]);

describe('DataGrid virtualWindow', () => {
  describe('rendering and ARIA', () => {
    it('renders the first window within the budget: the rows in view, the overscan and one spacer', () => {
      render(<Grid />);
      // 480 / 44: 11 rows in view, 6 below; none above the first row.
      expect(mountedIndexes()).toEqual(range(0, 17));
      expect(bodyRows().length).toBeLessThanOrEqual(30);
      const spacers = spacerRows();
      expect(spacers).toHaveLength(1);
      expect(spacers[0]).toHaveAttribute('aria-hidden', 'true');
      expect(spacers[0]).toHaveClass(dataGridClassNames.spacer);
      expect(spacers[0].style.height).toBe(`${(COUNT - 17) * ITEM}px`);
      expect(spacers[0].cells).toHaveLength(1);
      expect(spacers[0].cells[0].colSpan).toBe(2);
      // The spacers are out of the accessibility tree: the header row and the mounted rows remain.
      expect(screen.getAllByRole('row')).toHaveLength(18);
    });

    it('sets aria-rowcount on the grid and aria-rowindex on every row, the header first', () => {
      render(<Grid />);
      expect(grid()).toHaveAttribute('aria-rowcount', '10001');
      const [header, first, ...rest] = screen.getAllByRole('row');
      expect(header).toHaveAttribute('aria-rowindex', '1');
      expect(first).toHaveAttribute('aria-rowindex', '2');
      expect(first).toHaveAttribute('data-row-index', '0');
      expect(rest.map((row) => row.getAttribute('aria-rowindex'))).toEqual(
        range(3, 19).map(String),
      );
    });

    it('gives every row the window’s height and keeps the header in view (sticky)', () => {
      render(<Grid />);
      for (const row of bodyRows()) expect(row.style.height).toBe(`${ITEM}px`);
      expect(grid().querySelector('thead')).toHaveClass('sticky', 'top-0');
    });

    it('lays the columns out from widths (fixed layout), so the window never resizes a column', () => {
      render(<Grid />);
      expect(grid().querySelectorAll(':scope > colgroup > col')).toHaveLength(2);
      expect(grid().style.tableLayout).toBe('fixed');
    });

    it('a scroll to the middle mounts the rows there, within the budget, and keeps the sum of heights', () => {
      render(<Grid />);
      scrollTo(5000 * ITEM);
      expect(mountedIndexes()).toEqual(range(4994, 5017));
      expect(bodyRows().length).toBeLessThanOrEqual(30);
      expect(spacerRows()).toHaveLength(2);
      expect(bodyOrder()[0]).toBe('spacer');
      expect(bodyOrder().at(-1)).toBe('spacer');
      expect(totalHeight()).toBe(COUNT * ITEM);
      expect(rowOfIndex(4994)).toHaveAttribute('aria-rowindex', '4996');
      expect(within(rowOfIndex(5000)).getByText('Item 05000')).toBeInTheDocument();
    });

    it('renders valid rows when the items shrink under a scrolled window', () => {
      const { rerender } = render(<Grid />);
      scrollTo(5000 * ITEM);
      contentHeight = HEADER + 20 * ITEM;
      rerender(<Grid items={ITEMS.slice(0, 20)} />);
      const indexes = mountedIndexes();
      expect(new Set(indexes).size).toBe(indexes.length);
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      expect(indexes.at(-1)).toBe(19);
      expect(indexes.every((index) => index >= 0 && index < 20)).toBe(true);
      expect(totalHeight()).toBe(20 * ITEM);
      expect(grid()).toHaveAttribute('aria-rowcount', '21');
    });

    it('renders the first window on the server and no row past it', () => {
      const html = renderToString(<Grid />);
      const container = document.createElement('div');
      container.innerHTML = html;
      expect(container.querySelectorAll('tbody tr[data-row-index]')).toHaveLength(17);
      expect(container.querySelector('tr[data-row-index="17"]')).toBeNull();
      expect(container.querySelector('table')).toHaveAttribute('aria-rowcount', '10001');
      const spacers = container.querySelectorAll<HTMLTableRowElement>('tr[data-virtual-spacer]');
      expect(spacers).toHaveLength(1);
      expect(spacers[0].style.height).toBe(`${(COUNT - 17) * ITEM}px`);
    });

    it('hydrates the server window without a mismatch', async () => {
      const error = vi.spyOn(console, 'error');
      const container = document.createElement('div');
      container.innerHTML = renderToString(<Grid selectionMode="multiple" />);
      document.body.appendChild(container);
      let root: Root | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, <Grid selectionMode="multiple" />);
        });
        expect(error).not.toHaveBeenCalled();
        expect(mountedIndexes()).toEqual(range(0, 17));
        expect(grid()).toHaveAttribute('aria-rowcount', '10001');
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('windows the rows of a DataGrid.Body render function, rendering only the mounted ones', () => {
      const renderRow = vi.fn((item: Item) => (
        <DataGrid.Row>
          <DataGrid.Cell>{item.name}</DataGrid.Cell>
          <DataGrid.Cell>{`Size ${item.size}`}</DataGrid.Cell>
        </DataGrid.Row>
      ));
      function RenderFunctionGrid() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        return (
          <DataGrid
            aria-label="Items"
            items={ITEMS}
            columns={COLUMNS}
            getRowId={getId}
            virtualWindow={virtualWindow}
          >
            <DataGrid.Body>{renderRow}</DataGrid.Body>
          </DataGrid>
        );
      }
      render(<RenderFunctionGrid />);
      expect(mountedIndexes()).toEqual(range(0, 17));
      expect(renderRow).toHaveBeenCalledTimes(17);
      expect(rowOfIndex(3)).toHaveAttribute('aria-rowindex', '5');
      expect(grid()).toHaveAttribute('aria-rowcount', '10001');
    });

    it('counts the rows of a DataGrid.Header child in aria-rowcount and aria-rowindex', async () => {
      const user = userEvent.setup();
      function GroupedHeaderGrid() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        return (
          <DataGrid
            aria-label="Items"
            items={ITEMS}
            columns={COLUMNS}
            getRowId={getId}
            virtualWindow={virtualWindow}
          >
            <DataGrid.Header>
              <tr>
                <DataGrid.HeaderCell colSpan={2}>Item</DataGrid.HeaderCell>
              </tr>
              <tr>
                <DataGrid.HeaderCell columnId="name">Name</DataGrid.HeaderCell>
                <DataGrid.HeaderCell columnId="size">Size</DataGrid.HeaderCell>
              </tr>
            </DataGrid.Header>
          </DataGrid>
        );
      }
      render(<GroupedHeaderGrid />);
      expect(grid()).toHaveAttribute('aria-rowcount', '10002');
      const [group, columns, first] = screen.getAllByRole('row');
      expect(group).toHaveAttribute('aria-rowindex', '1');
      expect(columns).toHaveAttribute('aria-rowindex', '2');
      expect(first).toHaveAttribute('aria-rowindex', '3');
      focus(cellOf(4, 0));
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(document.activeElement).toBe(screen.getByRole('columnheader', { name: 'Item' }));
    });

    it('renders every row and no window attributes without a virtualWindow', () => {
      render(<Grid windowed={false} items={ITEMS.slice(0, 50)} />);
      expect(grid()).not.toHaveAttribute('aria-rowcount');
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(51);
      for (const row of rows) {
        expect(row).not.toHaveAttribute('aria-rowindex');
        expect(row).not.toHaveAttribute('data-row-index');
      }
      expect(grid().querySelector('[data-virtual-spacer]')).toBeNull();
      expect(grid().querySelector('thead')).not.toHaveClass('sticky');
      expect(grid().querySelector('colgroup')).toBeNull();
    });

    it('has no axe violations with spacers before and after the window and a kept row', async () => {
      render(<Grid selectionMode="multiple" />);
      focus(cellOf(3, 1));
      scrollTo(5000 * ITEM);
      await expectNoA11yViolations();
    });
  });

  describe('sorting and selection over every item', () => {
    it('shows the sorted head in the first window and keeps aria-rowindex in the sorted order', async () => {
      const user = userEvent.setup();
      render(<Grid defaultSort={{ columnId: 'name', direction: 'descending' }} />);
      expect(within(rowOfIndex(0)).getByText('Item 09999')).toBeInTheDocument();
      bodyRows().forEach((row, position) => {
        expect(row).toHaveAttribute('data-row-index', String(position));
        expect(row).toHaveAttribute('aria-rowindex', String(position + 2));
      });
      await user.click(screen.getByRole('button', { name: 'Name' }));
      expect(within(rowOfIndex(0)).getByText('Item 00000')).toBeInTheDocument();
      expect(rowOfIndex(0)).toHaveAttribute('aria-rowindex', '2');
      scrollTo(5000 * ITEM);
      expect(within(rowOfIndex(5000)).getByText('Item 05000')).toBeInTheDocument();
      expect(rowOfIndex(5000)).toHaveAttribute('aria-rowindex', '5002');
    });

    it('select-all selects every item, rendered or not; deselecting one row leaves the header mixed', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      render(<Grid selectionMode="multiple" onSelectedItemsChange={onSelectedItemsChange} />);
      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      await user.click(selectAll);
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
      const [selected] = onSelectedItemsChange.mock.calls[0] as [string[]];
      expect(selected).toHaveLength(COUNT);
      expect(selected).toEqual(ITEMS.map(getId));
      expect(selectAll).toBeChecked();
      await user.click(screen.getByRole('checkbox', { name: 'Item 00003' }));
      const [afterOne] = onSelectedItemsChange.mock.calls[1] as [string[]];
      expect(afterOne).toHaveLength(COUNT - 1);
      expect(afterOne).not.toContain('id-3');
      expect(selectAll).toBePartiallyChecked();
      scrollTo(5000 * ITEM);
      expect(within(rowOfIndex(5000)).getByRole('checkbox')).toBeChecked();
    });

    it('does not call isSelectionDisabled in a grid without selection', () => {
      const isSelectionDisabled = vi.fn(() => false);
      const { rerender } = render(<Grid isSelectionDisabled={isSelectionDisabled} />);
      expect(isSelectionDisabled).not.toHaveBeenCalled();
      rerender(<Grid isSelectionDisabled={isSelectionDisabled} selectionMode="multiple" />);
      expect(isSelectionDisabled).toHaveBeenCalledTimes(COUNT);
    });

    it('lays a resizable grid out from its colgroup, with the spacer cells spanning every column', () => {
      render(<Grid selectionMode="multiple" resizableColumns />);
      scrollTo(5000 * ITEM);
      expect(grid().querySelectorAll(':scope > colgroup > col')).toHaveLength(3);
      expect(spacerRows()).toHaveLength(2);
      for (const spacer of spacerRows()) expect(spacer.cells[0].colSpan).toBe(3);
      expect(screen.getAllByRole('separator', { name: 'Resize column' })).toHaveLength(2);
      expect(grid().style.tableLayout).toBe('fixed');
    });
  });

  describe('keyboard by the data', () => {
    it('Ctrl+End focuses the last row, scrolled into view, and Ctrl+Home returns to the header', async () => {
      const user = userEvent.setup();
      render(<Grid />);
      focus(cellOf(0, 0));
      await user.keyboard('{Control>}{End}{/Control}');
      expect(focusedRow()).toHaveAttribute('aria-rowindex', '10001');
      expect(document.activeElement).toBe(cellOf(9999, 1));
      expect(scroller().scrollTop).toBe(COUNT * ITEM - (VIEWPORT - HEADER));
      expect(bodyRows().length).toBeLessThanOrEqual(30);
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Name' }));
      expect(scroller().scrollTop).toBe(0);
      expect(mountedIndexes().slice(0, 17)).toEqual(range(0, 17));
    });

    it('PageDown and PageUp move ten rows, scrolling a row that is not mounted into the window first', async () => {
      const user = userEvent.setup();
      render(<Grid />);
      focus(cellOf(0, 0));
      await user.keyboard('{PageDown}');
      expect(focusedRow()).toHaveAttribute('aria-rowindex', '12');
      // Row 10 was mounted: it is scrolled to the bottom of the area below the header.
      expect(scroller().scrollTop).toBe(11 * ITEM - (VIEWPORT - HEADER));
      await user.keyboard('{PageDown}');
      expect(focusedRow()).toHaveAttribute('aria-rowindex', '22');
      expect(scroller().scrollTop).toBe(21 * ITEM - (VIEWPORT - HEADER));
      await user.keyboard('{PageUp}');
      expect(focusedRow()).toHaveAttribute('aria-rowindex', '12');
      expect(scroller().scrollTop).toBe(10 * ITEM);
    });

    it('ArrowDown past the window scrolls the next row in and focuses it', async () => {
      const user = userEvent.setup();
      render(<Grid />);
      scrollTo(5000 * ITEM);
      // The cells of rows a scroll mounts get their tabindex from the grid's observer.
      await act(async () => {});
      focus(cellOf(5016, 0));
      expect(scroller().scrollTop).toBe(5017 * ITEM - (VIEWPORT - HEADER));
      await user.keyboard('{ArrowDown}');
      expect(focusedRow()).toHaveAttribute('data-row-index', '5017');
      expect(document.activeElement).toBe(cellOf(5017, 0));
    });

    it('scrolls a focused row that the sticky header covers into the area below it', () => {
      render(<Grid />);
      scrollTo(10 * ITEM + 20);
      focus(cellOf(10, 0));
      expect(scroller().scrollTop).toBe(10 * ITEM);
    });

    it('does not scroll for the focus a pointer press gives, and scrolls the next focus without one', () => {
      render(<Grid />);
      scrollTo(10 * ITEM + 20);
      // A browser focuses the pressed cell on mousedown: moving it would move the click off it.
      fireEvent.pointerDown(cellOf(10, 0));
      focus(cellOf(10, 0));
      expect(scroller().scrollTop).toBe(10 * ITEM + 20);
      focus(cellOf(10, 1));
      expect(scroller().scrollTop).toBe(10 * ITEM);
    });

    it('scrolls a keyboard focus after a pointer press that gave no focus', () => {
      render(<Grid />);
      scrollTo(10 * ITEM + 20);
      fireEvent.pointerDown(spacerRows()[0].cells[0]);
      fireEvent.keyDown(document.body, { key: 'Tab' });
      focus(cellOf(10, 0));
      expect(scroller().scrollTop).toBe(10 * ITEM);
    });

    it('keeps a focused row mounted while it is scrolled away, and focus on it when it scrolls back', () => {
      render(<Grid />);
      const cell = cellOf(3, 1);
      focus(cell);
      scrollTo(5000 * ITEM);
      expect(document.activeElement).toBe(cell);
      expect(mountedIndexes()).toEqual([3, ...range(4994, 5017)]);
      // The kept row sits between spacers of its own.
      expect(bodyOrder().slice(0, 4)).toEqual(['spacer', 3, 'spacer', 4994]);
      expect(totalHeight()).toBe(COUNT * ITEM);
      expect(tabStops()).toEqual([cell]);
      scrollTo(0);
      expect(document.activeElement).toBe(cell);
      expect(mountedIndexes()).toEqual(range(0, 17));
      expect(tabStops()).toEqual([cell]);
    });

    it('mirrors the horizontal arrow keys in a right-to-left grid and moves by the data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Grid />, { dir: 'rtl' });
      focus(cellOf(0, 0));
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(cellOf(0, 1));
      await user.keyboard('{Control>}{End}{/Control}');
      expect(focusedRow()).toHaveAttribute('aria-rowindex', '10001');
    });

    it('in StrictMode renders the same window and reports each change once', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      render(
        <React.StrictMode>
          <Grid selectionMode="multiple" onSelectedItemsChange={onSelectedItemsChange} />
        </React.StrictMode>,
      );
      expect(mountedIndexes()).toEqual(range(0, 17));
      scrollTo(5000 * ITEM);
      expect(mountedIndexes()).toEqual(range(4994, 5017));
      await user.click(screen.getByRole('checkbox', { name: 'Item 05000' }));
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
      expect(onSelectedItemsChange).toHaveBeenCalledWith(['id-5000'], {
        event: expect.any(Event),
      });
      await user.keyboard('{Control>}{End}{/Control}');
      expect(focusedRow()).toHaveAttribute('aria-rowindex', '10001');
    });
  });

  describe('focus across data changes', () => {
    /** The first 100 items with `id-5` moved to position 7. */
    const moved = () => {
      const items = ITEMS.slice(0, 100);
      const [five] = items.splice(5, 1);
      items.splice(7, 0, five);
      return items;
    };

    it('gives focus back to the same row and column when the browser blurs the row a data change moved', async () => {
      contentHeight = HEADER + 100 * ITEM;
      const { rerender } = render(<Grid items={ITEMS.slice(0, 100)} />);
      const cell = cellOf(5, 1);
      focus(cell);
      rerender(<Grid items={moved()} />);
      expect(rowOfIndex(7)).toContainElement(cell);
      // A browser blurs an element that React moves; jsdom does not.
      act(() => (document.activeElement as HTMLElement).blur());
      await act(async () => {});
      expect(document.activeElement).toBe(cellOf(7, 1));
      expect(focusedRow()).toHaveAttribute('aria-rowindex', '9');
      expect(tabStops()).toEqual([cellOf(7, 1)]);
    });

    it('moves focus to the nearest row when a data change takes the focused row out of the window', async () => {
      const { rerender } = render(<Grid />);
      focus(cellOf(5, 1));
      const reversed = ITEMS.slice().reverse();
      rerender(<Grid items={reversed} />);
      await act(async () => {});
      // `id-5` is now row 9994, not in the window; row 5 (another item) holds focus.
      expect(grid().querySelector('[data-row-index="9994"]')).toBeNull();
      expect(focusedRow()).toHaveAttribute('data-row-index', '5');
      expect(document.activeElement).toBe(cellOf(5, 1));
      expect(within(rowOfIndex(5)).getByText(reversed[5].name)).toBeInTheDocument();
      expect(tabStops()).toHaveLength(1);
    });

    it('does not take focus back after it left the grid', async () => {
      contentHeight = HEADER + 100 * ITEM;
      const { rerender } = render(
        <>
          <Grid items={ITEMS.slice(0, 100)} />
          <button type="button">Outside</button>
        </>,
      );
      focus(cellOf(5, 1));
      act(() => (document.activeElement as HTMLElement).blur());
      await act(async () => {});
      rerender(
        <>
          <Grid items={moved()} />
          <button type="button">Outside</button>
        </>,
      );
      await act(async () => {});
      expect(document.activeElement).toBe(document.body);
      const outside = screen.getByRole('button', { name: 'Outside' });
      focus(cellOf(3, 1));
      focus(outside);
      rerender(
        <>
          <Grid items={ITEMS.slice(0, 100)} />
          <button type="button">Outside</button>
        </>,
      );
      await act(async () => {});
      expect(document.activeElement).toBe(outside);
    });
  });

  describe('development warnings', () => {
    it('ignores a virtualWindow without columns, with one warning, and renders every row', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function NoColumnsGrid() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        return (
          <DataGrid
            aria-label="Items"
            items={ITEMS.slice(0, 30)}
            getRowId={getId}
            virtualWindow={virtualWindow}
          >
            <DataGrid.Header>
              <tr>
                <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
              </tr>
            </DataGrid.Header>
            <DataGrid.Body>
              {(item: Item) => (
                <DataGrid.Row>
                  <DataGrid.Cell>{item.name}</DataGrid.Cell>
                </DataGrid.Row>
              )}
            </DataGrid.Body>
          </DataGrid>
        );
      }
      render(<NoColumnsGrid />);
      expect(messages(warn)).toEqual([
        '[WaveUI] DataGrid: `virtualWindow` needs `items` and `columns`, with the body rows rendered from them (no `DataGrid.Body` child, or one whose child is a render function); it is ignored, and every row is rendered.',
      ]);
      expect(grid()).not.toHaveAttribute('aria-rowcount');
      expect(screen.getAllByRole('row')).toHaveLength(31);
    });

    /** The table's `offsetHeight`: its rows and spacers and the header. */
    const stubTableHeight = (height: number) =>
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.getAttribute('role') === 'grid' ? height : 0;
      });

    it('warns once when the scroller is as tall as its rows (no bounded height)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      viewportHeight = HEADER + 100 * ITEM;
      contentHeight = viewportHeight;
      stubTableHeight(viewportHeight);
      render(<Grid items={ITEMS.slice(0, 100)} />);
      expect(messages(warn)).toEqual([
        '[WaveUI] DataGrid: the scroll wrapper of a grid with `virtualWindow` has no bounded height (it is as tall as its rows), so the window renders every row. Give it a height or a maximum height in `containerProps` (a class or a style).',
      ]);
    });

    it('does not warn about a bounded scroller taller than all its rows', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      viewportHeight = 2000;
      contentHeight = viewportHeight;
      stubTableHeight(HEADER + 30 * ITEM);
      render(<Grid items={ITEMS.slice(0, 30)} />);
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn about the height of a bounded scroller', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Grid />);
      scrollTo(5000 * ITEM);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
