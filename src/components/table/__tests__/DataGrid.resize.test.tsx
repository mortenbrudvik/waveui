import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/DataGrid.stories';
import { createTableColumn } from '../../../lib/table';
import { dataGridHeaderCellClassNames, tableResizeHandleClassNames } from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  mockRect,
  openingTags,
  renderWithProviders,
} from '../../../test-utils';
import { DataGrid } from '../DataGrid';
import type {
  DataGridBaseProps,
  DataGridColumn,
  DataGridHeaderCellProps,
  DataGridItemsSortProps,
  DataGridLabels,
} from '../DataGrid';
import type { TableColumnWidthsChangeDetails } from '../useTableColumnSizing';

interface Part {
  id: string;
  item: string;
  owner: string;
  size: number;
}

const PARTS: readonly Part[] = [
  { id: 'p1', item: 'Bolt', owner: 'Ada', size: 3 },
  { id: 'p2', item: 'Anchor', owner: 'Ben', size: 9 },
  { id: 'p3', item: 'Clamp', owner: 'Cy', size: 5 },
];

const COLUMNS: readonly DataGridColumn<Part>[] = [
  createTableColumn<Part>({
    columnId: 'item',
    label: 'Item',
    compare: (a, b) => a.item.localeCompare(b.item),
    renderCell: (part) => part.item,
  }),
  createTableColumn<Part>({ columnId: 'owner', label: 'Owner', renderCell: (part) => part.owner }),
  createTableColumn<Part>({
    columnId: 'size',
    label: 'Size',
    renderCell: (part) => String(part.size),
  }),
];

const partId = (part: Part) => part.id;

type GridProps = Partial<DataGridBaseProps<Part>> &
  Pick<DataGridItemsSortProps<Part>, 'defaultSort' | 'onSortChange'>;

/** A grid of `PARTS` rendered from `COLUMNS`. */
function Grid(props: GridProps) {
  return (
    <DataGrid aria-label="Parts" items={PARTS} columns={COLUMNS} getRowId={partId} {...props} />
  );
}

const REQUIRE_COLUMNS_WARNING =
  '[WaveUI] DataGrid: `resizableColumns`, `columnSizingOptions`, `columnWidths` and ' +
  '`defaultColumnWidths` need the `columns` prop together with `items`, and are ignored without ' +
  'them. Render the grid from `items` and `columns`.';

const grid = () => screen.getByRole('grid', { name: 'Parts' });
const header = (name: string) => screen.getByRole('columnheader', { name });
const handleOf = (name: string) => within(header(name)).getByRole('separator');
const selectAllHeader = () =>
  screen.getByRole('checkbox', { name: 'Select all rows' }).closest('th') as HTMLElement;
/** The inline widths of the grid's `<col>` elements, in order. */
const colWidths = () =>
  Array.from(grid().querySelectorAll('colgroup > col'), (col) => (col as HTMLElement).style.width);

const CAPTURE_METHODS = [
  'setPointerCapture',
  'releasePointerCapture',
  'hasPointerCapture',
] as const;
let savedCapture: Array<[string, PropertyDescriptor | undefined]> = [];
let frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

/** Runs the animation frames that are waiting, as the browser does before a paint. */
function flushFrames() {
  act(() => {
    const waiting = [...frames.values()];
    frames = new Map();
    for (const callback of waiting) callback(0);
  });
}

const POINTER = { pointerId: 1, pointerType: 'mouse', isPrimary: true } as const;
const down = (el: Element, clientX = 100) =>
  fireEvent.pointerDown(el, { ...POINTER, button: 0, clientX });
const move = (el: Element, clientX: number) => fireEvent.pointerMove(el, { ...POINTER, clientX });
const up = (el: Element) => fireEvent.pointerUp(el, POINTER);

beforeEach(() => {
  // jsdom has no pointer capture: a stand-in that remembers the captured pointer ids.
  const captured = new WeakMap<Element, Set<number>>();
  savedCapture = CAPTURE_METHODS.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(Element.prototype, name),
  ]);
  Object.defineProperties(Element.prototype, {
    setPointerCapture: {
      configurable: true,
      writable: true,
      value(this: Element, pointerId: number) {
        const ids = captured.get(this) ?? new Set<number>();
        ids.add(pointerId);
        captured.set(this, ids);
      },
    },
    releasePointerCapture: {
      configurable: true,
      writable: true,
      value(this: Element, pointerId: number) {
        captured.get(this)?.delete(pointerId);
      },
    },
    hasPointerCapture: {
      configurable: true,
      writable: true,
      value(this: Element, pointerId: number) {
        return captured.get(this)?.has(pointerId) ?? false;
      },
    },
  });
  // The frames of a drag wait until the test runs them.
  frames = new Map();
  nextFrameId = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [name, descriptor] of savedCapture) {
    if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
    else Reflect.deleteProperty(Element.prototype, name);
  }
});

describe('DataGrid column sizing', () => {
  describe('types', () => {
    it('reports the widths and the details of a change, and takes localizable labels', () => {
      // `details` is optional through 0.x (C-NAMING); the grid always passes it.
      expectTypeOf<DataGridBaseProps['onColumnWidthsChange']>().toEqualTypeOf<
        | ((widths: Record<string, number>, details?: TableColumnWidthsChangeDetails) => void)
        | undefined
      >();
      expectTypeOf<DataGridLabels['resizeColumn']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<DataGridLabels['columnWidth']>().toEqualTypeOf<
        ((width: number) => string) | undefined
      >();
      expectTypeOf<DataGridBaseProps['resizableColumns']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('layout', () => {
    it('leaves a grid without sizing props as before: no colgroup, style or handle', () => {
      render(<Grid />);
      expect(grid().querySelector('colgroup')).toBeNull();
      expect(grid()).not.toHaveAttribute('style');
      expect(screen.queryByRole('separator')).toBeNull();
      expect(screen.getByRole('gridcell', { name: 'Bolt' })).not.toHaveClass('whitespace-nowrap');
    });

    it('renders a col per column at its initial width from columnSizingOptions', () => {
      render(
        <Grid
          resizableColumns
          columnSizingOptions={{ item: { defaultWidth: 220 }, owner: { idealWidth: 120 } }}
        />,
      );
      expect(colWidths()).toEqual(['220px', '120px', '150px']);
    });

    it('lays an unresized grid out fixed, 100% wide and at least as wide as its columns', () => {
      render(<Grid resizableColumns columnSizingOptions={{ item: { defaultWidth: 220 } }} />);
      expect(grid().style.tableLayout).toBe('fixed');
      expect(grid().style.width).toBe('100%');
      expect(grid().style.minWidth).toBe('520px');
    });

    it('lays a grid with defaultColumnWidths out exactly as wide as its columns', () => {
      render(<Grid resizableColumns defaultColumnWidths={{ owner: 200 }} />);
      expect(colWidths()).toEqual(['150px', '200px', '150px']);
      expect(grid().style.tableLayout).toBe('fixed');
      expect(grid().style.width).toBe('500px');
      expect(grid().style.minWidth).toBe('');
    });

    it('takes controlled columnWidths, clamped to the minimum', () => {
      render(<Grid resizableColumns columnWidths={{ size: 90, owner: 20 }} />);
      expect(colWidths()).toEqual(['150px', '80px', '90px']);
      expect(grid().style.width).toBe('320px');
    });

    it('sizes the columns without handles when resizableColumns is not set', () => {
      render(<Grid columnWidths={{ owner: 90 }} />);
      expect(colWidths()).toEqual(['150px', '90px', '150px']);
      expect(grid().style.width).toBe('390px');
      expect(screen.queryByRole('separator')).toBeNull();
    });

    it('starts with the selection column at 40 pixels, which gets no handle', () => {
      render(<Grid resizableColumns selectionMode="multiple" />);
      expect(colWidths()).toEqual(['40px', '150px', '150px', '150px']);
      expect(grid().style.minWidth).toBe('490px');
      expect(within(selectAllHeader()).queryByRole('separator')).toBeNull();
      expect(screen.getAllByRole('separator', { name: 'Resize column' })).toHaveLength(3);
    });

    it('gives every column a handle, the last one included', () => {
      render(<Grid resizableColumns />);
      for (const name of ['Item', 'Owner', 'Size']) {
        expect(handleOf(name)).toHaveClass(
          tableResizeHandleClassNames.root,
          dataGridHeaderCellClassNames.resizeHandle,
        );
      }
    });

    it('positions a header cell that holds a handle and puts the handle directly in it', () => {
      render(<Grid resizableColumns />);
      for (const name of ['Item', 'Owner']) {
        expect(header(name)).toHaveClass('relative');
        expect(handleOf(name).parentElement).toBe(header(name));
      }
    });

    it('truncates the body cells of a grid with column sizing', () => {
      render(<Grid resizableColumns />);
      expect(screen.getByRole('gridcell', { name: 'Bolt' })).toHaveClass(
        'overflow-hidden',
        'text-ellipsis',
        'whitespace-nowrap',
      );
    });

    it('lets a cell class win over the truncation', () => {
      render(
        <Grid resizableColumns>
          <DataGrid.Body>
            {(part: Part) => (
              <DataGrid.Row>
                <DataGrid.Cell className="whitespace-normal">{part.item}</DataGrid.Cell>
                <DataGrid.Cell>{part.owner}</DataGrid.Cell>
                <DataGrid.Cell>{String(part.size)}</DataGrid.Cell>
              </DataGrid.Row>
            )}
          </DataGrid.Body>
        </Grid>,
      );
      const cell = screen.getByRole('gridcell', { name: 'Bolt' });
      expect(cell).toHaveClass('whitespace-normal');
      expect(cell).not.toHaveClass('whitespace-nowrap');
      expect(screen.getByRole('gridcell', { name: 'Ada' })).toHaveClass('whitespace-nowrap');
    });
  });

  describe('names', () => {
    it('keeps the name of a resizable column header, sortable or not', () => {
      render(<Grid resizableColumns />);
      expect(header('Item')).toHaveAttribute('aria-sort', 'none');
      expect(header('Item')).toBe(screen.getByRole('button', { name: 'Item' }).closest('th'));
      expect(header('Owner')).not.toHaveAttribute('aria-sort');
      expect(within(header('Item')).getByRole('separator', { name: 'Resize column' })).toBe(
        handleOf('Item'),
      );
      expect(within(header('Owner')).getByRole('separator', { name: 'Resize column' })).toBe(
        handleOf('Owner'),
      );
    });

    it('names the handles and their value text from labels', () => {
      const labels: DataGridLabels = {
        resizeColumn: 'Resize the column',
        columnWidth: (width) => `${width} px`,
      };
      render(<Grid resizableColumns labels={labels} />);
      const handles = screen.getAllByRole('separator', { name: labels.resizeColumn });
      expect(handles).toHaveLength(3);
      expect(handles[0]).toHaveAttribute('aria-valuetext', '150 px');
      expect(header('Item')).toContainElement(handles[0]);
    });

    it('keeps a header cell name of its own, and handles in a header written by hand', () => {
      render(
        <Grid resizableColumns>
          <DataGrid.Header>
            <tr>
              <DataGrid.HeaderCell columnId="item" aria-label="Part name">
                Item
              </DataGrid.HeaderCell>
              <DataGrid.HeaderCell columnId="owner">Owner</DataGrid.HeaderCell>
              <DataGrid.HeaderCell columnId="size">Size</DataGrid.HeaderCell>
            </tr>
          </DataGrid.Header>
        </Grid>,
      );
      expect(handleOf('Part name')).toHaveAttribute('aria-valuenow', '150');
      expect(handleOf('Owner')).toHaveAttribute('aria-valuenow', '150');
    });

    it('keeps the name of a header cell whose wrapper forwards aria-labelledby={undefined}', () => {
      render(
        <Grid resizableColumns>
          <DataGrid.Header>
            <tr>
              <DataGrid.HeaderCell columnId="item" sortable aria-labelledby={undefined}>
                Item
              </DataGrid.HeaderCell>
              <DataGrid.HeaderCell columnId="owner" aria-labelledby={undefined}>
                Owner
              </DataGrid.HeaderCell>
              <DataGrid.HeaderCell columnId="size" aria-label={undefined}>
                Size
              </DataGrid.HeaderCell>
            </tr>
          </DataGrid.Header>
        </Grid>,
      );
      for (const name of ['Item', 'Owner', 'Size']) {
        const th = screen.getByText(name).closest('th') as HTMLElement;
        expect(th).toHaveAccessibleName(name);
        expect(within(th).getByRole('separator', { name: 'Resize column' })).toHaveAttribute(
          'aria-valuenow',
          '150',
        );
      }
    });

    it('passes axe with handles, the selection column and a sorted column', async () => {
      render(
        <Grid
          resizableColumns
          selectionMode="multiple"
          defaultSort={{ columnId: 'item', direction: 'ascending' }}
        />,
      );
      await expectNoA11yViolations();
    });
  });

  describe('pointer', () => {
    it('fires onColumnWidthsChange once per frame with every width and the details', () => {
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          defaultColumnWidths={{ item: 200 }}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      const handle = handleOf('Item');
      down(handle);
      move(handle, 110);
      move(handle, 140);
      expect(onColumnWidthsChange).not.toHaveBeenCalled();
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 240, owner: 150, size: 150 },
        { columnId: 'item', width: 240, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['240px', '150px', '150px']);
      expect(grid().style.width).toBe('540px');
      expect(handleOf('Item')).toHaveAttribute('aria-valuenow', '240');

      move(handle, 150);
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(2);
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { item: 250, owner: 150, size: 150 },
        { columnId: 'item', width: 250, event: expect.any(Event) },
      );
      up(handle);
    });

    it('leaves the col as it is when a controlled parent ignores the change', () => {
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          columnWidths={{ item: 200 }}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      const handle = handleOf('Item');
      down(handle);
      move(handle, 140);
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 240, owner: 150, size: 150 },
        { columnId: 'item', width: 240, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['200px', '150px', '150px']);
      expect(handle).toHaveAttribute('aria-valuenow', '200');
      expect(grid().style.width).toBe('500px');
      up(handle);
    });

    it('holds the column at its minimum width', () => {
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          columnSizingOptions={{ item: { minWidth: 100 } }}
          defaultColumnWidths={{ item: 200 }}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      const handle = handleOf('Item');
      expect(handle).toHaveAttribute('aria-valuemin', '100');
      expect(handleOf('Owner')).toHaveAttribute('aria-valuemin', '80');
      down(handle);
      move(handle, -400);
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { item: 100, owner: 150, size: 150 },
        { columnId: 'item', width: 100, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['100px', '150px', '150px']);
      up(handle);
    });

    it('mirrors a drag in RTL: moving toward the end narrows the column', () => {
      const onColumnWidthsChange = vi.fn();
      renderWithProviders(
        <Grid
          resizableColumns
          defaultColumnWidths={{ item: 200 }}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
        { dir: 'rtl' },
      );
      const handle = handleOf('Item');
      down(handle);
      move(handle, 140);
      flushFrames();
      expect(colWidths()).toEqual(['160px', '150px', '150px']);
      move(handle, 60);
      flushFrames();
      expect(colWidths()).toEqual(['240px', '150px', '150px']);
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { item: 240, owner: 150, size: 150 },
        { columnId: 'item', width: 240, event: expect.any(Event) },
      );
      up(handle);
    });

    it('marks the grid with data-resizing only while a handle drags', () => {
      render(<Grid resizableColumns defaultColumnWidths={{}} />);
      const handle = handleOf('Owner');
      expect(grid()).not.toHaveAttribute('data-resizing');
      down(handle);
      expect(grid()).toHaveAttribute('data-resizing', '');
      expect(handle).toHaveAttribute('data-dragging');
      up(handle);
      expect(grid()).not.toHaveAttribute('data-resizing');

      down(handle);
      fireEvent.pointerCancel(handle, POINTER);
      expect(grid()).not.toHaveAttribute('data-resizing');

      down(handle);
      fireEvent.lostPointerCapture(handle, { pointerId: 1 });
      expect(grid()).not.toHaveAttribute('data-resizing');
    });

    it('lets the header ignore the pointer while the grid resizes, but not the dragged handle', () => {
      render(<Grid resizableColumns />);
      const [head] = screen.getAllByRole('rowgroup');
      expect(head).toContainElement(header('Item'));
      expect(head).toHaveClass('in-data-[resizing]:pointer-events-none');
      expect(handleOf('Item')).toHaveClass('data-[dragging]:pointer-events-auto');
    });

    it('also marks an unresized grid while its handle drags', () => {
      render(<Grid resizableColumns />);
      const handle = handleOf('Size');
      down(handle);
      expect(grid()).toHaveAttribute('data-resizing', '');
      up(handle);
      expect(grid()).not.toHaveAttribute('data-resizing');
    });

    it('ends data-resizing when the dragged column goes away', () => {
      const { rerender } = render(<Grid resizableColumns />);
      down(handleOf('Size'));
      expect(grid()).toHaveAttribute('data-resizing', '');
      rerender(<Grid resizableColumns columns={COLUMNS.slice(0, 2)} />);
      expect(grid()).not.toHaveAttribute('data-resizing');
    });

    it('ignores a second primary pointer while a drag is under way', () => {
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          defaultColumnWidths={{}}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      const handle = handleOf('Owner');
      const PEN = { pointerId: 2, pointerType: 'pen', isPrimary: true } as const;
      down(handle);
      fireEvent.pointerDown(handle, { ...PEN, button: 0, clientX: 300 });
      expect(grid()).toHaveAttribute('data-resizing', '');
      move(handle, 120);
      flushFrames();
      // The mouse drag goes on from where it started.
      expect(colWidths()).toEqual(['150px', '170px', '150px']);
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);

      up(handle);
      expect(grid()).not.toHaveAttribute('data-resizing');
      expect(handle).not.toHaveAttribute('data-dragging');
      fireEvent.pointerUp(handle, PEN);
      expect(grid()).not.toHaveAttribute('data-resizing');
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
    });

    it('ignores a press that is not the primary button', () => {
      render(<Grid resizableColumns />);
      fireEvent.pointerDown(handleOf('Item'), { ...POINTER, button: 2, clientX: 100 });
      expect(grid()).not.toHaveAttribute('data-resizing');
    });
  });

  describe('the first resize of an unresized grid', () => {
    it('adopts the measured widths, so the dragged edge does not jump', () => {
      const onColumnWidthsChange = vi.fn();
      render(<Grid resizableColumns onColumnWidthsChange={onColumnWidthsChange} />);
      mockRect(header('Item'), { width: 300 });
      mockRect(header('Owner'), { width: 280 });
      mockRect(header('Size'), { width: 260 });
      const handle = handleOf('Item');
      expect(handle).toHaveAttribute('aria-valuenow', '150');

      down(handle);
      // Measured when the drag starts: the width the column is drawn at.
      expect(handle).toHaveAttribute('aria-valuenow', '300');
      expect(onColumnWidthsChange).not.toHaveBeenCalled();
      move(handle, 140);
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 340, owner: 280, size: 260 },
        { columnId: 'item', width: 340, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['340px', '280px', '260px']);
      expect(grid().style.width).toBe('880px');
      expect(grid().style.minWidth).toBe('');

      move(handle, 150);
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { item: 350, owner: 280, size: 260 },
        { columnId: 'item', width: 350, event: expect.any(Event) },
      );
      up(handle);
    });

    it('keeps the selection column at the width it was drawn at, edges rounded once', () => {
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          selectionMode="multiple"
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      // A wide container spreads every column, the selection column too.
      mockRect(selectAllHeader(), { width: 81.6 });
      mockRect(header('Item'), { width: 306.1 });
      mockRect(header('Owner'), { width: 306.1 });
      mockRect(header('Size'), { width: 306.2 });
      expect(colWidths()).toEqual(['40px', '150px', '150px', '150px']);

      const handle = handleOf('Size');
      down(handle);
      expect(handle).toHaveAttribute('aria-valuenow', '306');
      move(handle, 110);
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 306, owner: 306, size: 316 },
        { columnId: 'size', width: 316, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['82px', '306px', '306px', '316px']);
      expect(grid().style.width).toBe('1010px');
      up(handle);
    });

    it('keeps the initial width of a column whose header cell measures nothing', () => {
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          selectionMode="multiple"
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      const handle = handleOf('Item');
      down(handle);
      move(handle, 140);
      flushFrames();
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 190, owner: 150, size: 150 },
        { columnId: 'item', width: 190, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['40px', '190px', '150px', '150px']);
      expect(grid().style.width).toBe('530px');
      up(handle);
    });

    it('starts a key press from the measured width of a focused handle', async () => {
      const user = userEvent.setup();
      const onColumnWidthsChange = vi.fn();
      render(<Grid resizableColumns onColumnWidthsChange={onColumnWidthsChange} />);
      mockRect(header('Item'), { width: 300 });
      mockRect(header('Owner'), { width: 280 });
      mockRect(header('Size'), { width: 260 });
      const handle = handleOf('Owner');
      act(() => handle.focus());
      expect(handle).toHaveAttribute('aria-valuenow', '280');
      await user.keyboard('{ArrowRight}');
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 300, owner: 300, size: 260 },
        { columnId: 'owner', width: 300, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['300px', '300px', '260px']);
    });

    it('measures the column again at a key press, after the container resized under a focused handle', async () => {
      const user = userEvent.setup();
      const onColumnWidthsChange = vi.fn();
      render(<Grid resizableColumns onColumnWidthsChange={onColumnWidthsChange} />);
      mockRect(header('Item'), { width: 300 });
      mockRect(header('Owner'), { width: 280 });
      mockRect(header('Size'), { width: 260 });
      const handle = handleOf('Owner');
      act(() => handle.focus());
      expect(handle).toHaveAttribute('aria-valuenow', '280');
      // The container grows while the handle keeps focus: the columns are drawn wider.
      mockRect(header('Item'), { width: 330 });
      mockRect(header('Owner'), { width: 310 });
      mockRect(header('Size'), { width: 290 });
      await user.keyboard('{ArrowRight}');
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 330, owner: 330, size: 290 },
        { columnId: 'owner', width: 330, event: expect.any(Event) },
      );
      expect(handle).toHaveAttribute('aria-valuenow', '330');
    });

    it('calls onColumnWidthsChange once in StrictMode', async () => {
      const user = userEvent.setup();
      const onColumnWidthsChange = vi.fn();
      render(
        <React.StrictMode>
          <Grid resizableColumns onColumnWidthsChange={onColumnWidthsChange} />
        </React.StrictMode>,
      );
      act(() => handleOf('Size').focus());
      await user.keyboard('{ArrowLeft}');
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { item: 150, owner: 150, size: 130 },
        { columnId: 'size', width: 130, event: expect.any(Event) },
      );
    });
  });

  describe('keyboard', () => {
    it('grows the column by 20 with ArrowRight, narrows it with ArrowLeft, 5 with Shift', async () => {
      const user = userEvent.setup();
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          defaultColumnWidths={{ item: 200 }}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      act(() => handleOf('Item').focus());
      await user.keyboard('{ArrowRight}');
      expect(colWidths()).toEqual(['220px', '150px', '150px']);
      await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
      expect(colWidths()).toEqual(['215px', '150px', '150px']);
      await user.keyboard('{Home}');
      expect(colWidths()).toEqual(['80px', '150px', '150px']);
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(3);
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { item: 80, owner: 150, size: 150 },
        { columnId: 'item', width: 80, event: expect.any(Event) },
      );
    });

    it('mirrors the arrow keys in RTL: ArrowLeft grows the column', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Grid resizableColumns defaultColumnWidths={{ item: 200 }} />, {
        dir: 'rtl',
      });
      act(() => handleOf('Item').focus());
      await user.keyboard('{ArrowLeft}');
      expect(colWidths()).toEqual(['220px', '150px', '150px']);
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(colWidths()).toEqual(['180px', '150px', '150px']);
    });
  });

  describe('the grid navigation (F2)', () => {
    const sortButton = () => screen.getByRole('button', { name: 'Item' });
    const tabStops = () => grid().querySelectorAll('[tabindex="0"]');

    it('keeps one Tab stop: the handles are at tabindex="-1" in navigation mode', async () => {
      const user = userEvent.setup();
      render(<Grid resizableColumns selectionMode="multiple" />);
      expect(tabStops()).toHaveLength(1);
      expect(tabStops()[0]).toBe(screen.getByRole('checkbox', { name: 'Select all rows' }));
      for (const handle of screen.getAllByRole('separator')) {
        expect(handle).toHaveAttribute('tabindex', '-1');
      }
      act(() => header('Owner').focus());
      await user.keyboard('{ArrowRight}');
      expect(header('Size')).toHaveFocus();
      expect(tabStops()).toHaveLength(1);
      await user.keyboard('{F2}');
      expect(handleOf('Size')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(header('Size')).toHaveFocus();
      expect(tabStops()).toHaveLength(1);
      expect(handleOf('Size')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the sort button the target of a sortable header: the arrows reach it and Enter sorts', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<Grid resizableColumns onSortChange={onSortChange} />);
      expect(sortButton()).toHaveAttribute('tabindex', '0');
      act(() => header('Owner').focus());
      await user.keyboard('{ArrowLeft}');
      expect(sortButton()).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(header('Item')).toHaveAttribute('aria-sort', 'ascending');
      expect(sortButton()).toHaveFocus();
    });

    it('F2 on the sort button moves to the handle, whose arrows resize; Enter returns to the button', async () => {
      const user = userEvent.setup();
      const onColumnWidthsChange = vi.fn();
      const onSortChange = vi.fn();
      render(
        <Grid
          resizableColumns
          defaultColumnWidths={{ item: 200 }}
          onColumnWidthsChange={onColumnWidthsChange}
          onSortChange={onSortChange}
        />,
      );
      act(() => header('Owner').focus());
      await user.keyboard('{ArrowLeft}{F2}');
      expect(handleOf('Item')).toHaveFocus();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(colWidths()).toEqual(['240px', '150px', '150px']);
      await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
      expect(colWidths()).toEqual(['235px', '150px', '150px']);
      expect(handleOf('Item')).toHaveAttribute('aria-valuenow', '235');
      // The grid's own keys are off: focus stays on the handle.
      await user.keyboard('{ArrowDown}{ArrowUp}');
      expect(handleOf('Item')).toHaveFocus();
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(3);
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { item: 235, owner: 150, size: 150 },
        { columnId: 'item', width: 235, event: expect.any(Event) },
      );

      await user.keyboard('{Enter}');
      expect(sortButton()).toHaveFocus();
      expect(onSortChange).not.toHaveBeenCalled();
      expect(handleOf('Item')).toHaveAttribute('tabindex', '-1');
      expect(tabStops()).toHaveLength(1);
      // Navigation mode again.
      await user.keyboard('{ArrowRight}');
      expect(header('Owner')).toHaveFocus();
    });

    it.each(['{Enter>3/}', '[Space>3/]'])(
      'a held key on the handle (%s, its keydown repeated) returns to the sort button on release and does not sort',
      async (keys) => {
        const user = userEvent.setup();
        const onSortChange = vi.fn();
        render(<Grid resizableColumns onSortChange={onSortChange} />);
        act(() => header('Owner').focus());
        await user.keyboard('{ArrowLeft}{F2}');
        expect(handleOf('Item')).toHaveFocus();
        await user.keyboard(keys);
        expect(sortButton()).toHaveFocus();
        expect(onSortChange).not.toHaveBeenCalled();
        expect(header('Item')).toHaveAttribute('aria-sort', 'none');
        // The button sorts with the next press.
        await user.keyboard('{Enter}');
        expect(onSortChange).toHaveBeenCalledTimes(1);
      },
    );

    it('mirrors the arrow keys of the handle in RTL', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Grid resizableColumns defaultColumnWidths={{ item: 200 }} />, {
        dir: 'rtl',
      });
      act(() => header('Owner').focus());
      // ArrowRight moves toward the start of an RTL row: to the sort button of Item.
      await user.keyboard('{ArrowRight}');
      expect(sortButton()).toHaveFocus();
      await user.keyboard('{F2}{ArrowLeft}{ArrowLeft}');
      expect(colWidths()).toEqual(['240px', '150px', '150px']);
      await user.keyboard('{ArrowRight}');
      expect(colWidths()).toEqual(['220px', '150px', '150px']);
      await user.keyboard('{Enter}');
      expect(sortButton()).toHaveFocus();
    });

    it('enters the handle of a header without a sort button with Enter and F2, and leaves it with Escape and Space', async () => {
      const user = userEvent.setup();
      render(<Grid resizableColumns defaultColumnWidths={{}} />);
      act(() => header('Owner').focus());
      await user.keyboard('{Enter}');
      expect(handleOf('Owner')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(colWidths()).toEqual(['150px', '170px', '150px']);
      await user.keyboard('{Escape}');
      expect(header('Owner')).toHaveFocus();
      expect(header('Owner')).toHaveAttribute('tabindex', '0');

      await user.keyboard('{F2}');
      expect(handleOf('Owner')).toHaveFocus();
      await user.keyboard(' ');
      expect(header('Owner')).toHaveFocus();
      expect(handleOf('Owner')).toHaveAttribute('tabindex', '-1');
      await user.keyboard('{ArrowRight}');
      expect(header('Size')).toHaveFocus();
    });

    it('moves between the sort button and the handle with Tab in interaction mode', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Grid resizableColumns />
          <button type="button">After</button>
        </>,
      );
      act(() => header('Owner').focus());
      await user.keyboard('{ArrowLeft}{F2}');
      expect(handleOf('Item')).toHaveFocus();
      await user.tab({ shift: true });
      expect(sortButton()).toHaveFocus();
      await user.tab();
      expect(handleOf('Item')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(sortButton()).toHaveFocus();
      expect(tabStops()).toHaveLength(1);
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });
  });

  describe('double click', () => {
    it('changes nothing in an unresized grid, and resets a column once the grid is sized', async () => {
      const user = userEvent.setup();
      const onColumnWidthsChange = vi.fn();
      render(
        <Grid
          resizableColumns
          columnSizingOptions={{ item: { defaultWidth: 220 } }}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      fireEvent.doubleClick(handleOf('Item'));
      expect(onColumnWidthsChange).not.toHaveBeenCalled();
      expect(grid().style.width).toBe('100%');

      act(() => handleOf('Item').focus());
      await user.keyboard('{ArrowRight}');
      expect(colWidths()).toEqual(['240px', '150px', '150px']);
      fireEvent.doubleClick(handleOf('Item'));
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(2);
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { item: 220, owner: 150, size: 150 },
        { columnId: 'item', width: 220, event: expect.any(Event) },
      );
      expect(colWidths()).toEqual(['220px', '150px', '150px']);
    });
  });

  describe('sorting', () => {
    it('sorts with the sort button of a resizable header; the handle is no sort target', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<Grid resizableColumns onSortChange={onSortChange} />);
      await user.click(screen.getByRole('button', { name: 'Item' }));
      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(header('Item')).toHaveAttribute('aria-sort', 'ascending');
      expect(screen.getAllByRole('row')[1]).toHaveTextContent('Anchor');

      await user.click(handleOf('Item'));
      fireEvent.click(handleOf('Item'));
      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(header('Item')).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  describe('without columns and items', () => {
    it('ignores the sizing props of a grid without columns and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ui = (
        <DataGrid aria-label="Parts" resizableColumns columnWidths={{ item: 120 }}>
          <DataGrid.Header>
            <tr>
              <DataGrid.HeaderCell columnId="item">Item</DataGrid.HeaderCell>
            </tr>
          </DataGrid.Header>
          <DataGrid.Body>
            <DataGrid.Row rowId="p1">
              <DataGrid.Cell>Bolt</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>
      );
      const { rerender } = render(ui);
      rerender(ui);
      expect(grid().querySelector('colgroup')).toBeNull();
      expect(grid()).not.toHaveAttribute('style');
      expect(screen.queryByRole('separator')).toBeNull();
      expect(screen.getByRole('gridcell', { name: 'Bolt' })).not.toHaveClass('whitespace-nowrap');
      expect(warn.mock.calls).toEqual([[REQUIRE_COLUMNS_WARNING]]);
    });

    it('ignores them with columns but without items, and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <DataGrid aria-label="Parts" columns={COLUMNS} resizableColumns>
          <DataGrid.Body>
            <DataGrid.Row rowId="p1">
              <DataGrid.Cell>Bolt</DataGrid.Cell>
              <DataGrid.Cell>Ada</DataGrid.Cell>
              <DataGrid.Cell>3</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      expect(grid().querySelector('colgroup')).toBeNull();
      expect(screen.queryByRole('separator')).toBeNull();
      expect(warn.mock.calls).toEqual([[REQUIRE_COLUMNS_WARNING]]);
    });
  });

  describe('stories', () => {
    const { Resizable, ResizableControlled } = composeStories(stories);

    it('Resizable gives every column a handle and passes axe', async () => {
      render(<Resizable />);
      expect(screen.getAllByRole('separator', { name: 'Resize column' })).toHaveLength(4);
      await expectNoA11yViolations();
    });

    it('ResizableControlled keeps the widths in state and shows them', async () => {
      const user = userEvent.setup();
      render(<ResizableControlled />);
      expect(
        screen.getByText('Widths: name 220, role 160, location 160, status 140'),
      ).toBeVisible();
      act(() =>
        within(screen.getByRole('columnheader', { name: 'Role' }))
          .getByRole('separator')
          .focus(),
      );
      await user.keyboard('{ArrowRight}');
      expect(
        screen.getByText('Widths: name 220, role 180, location 160, status 140'),
      ).toBeVisible();
      await expectNoA11yViolations();
    });
  });
});

describe('DataGrid.HeaderCell — slotProps.resizeHandle', () => {
  type HandlePart = NonNullable<DataGridHeaderCellProps['slotProps']>['resizeHandle'];
  const handles = (root: ParentNode = document) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${dataGridHeaderCellClassNames.resizeHandle}`));

  /** A grid of `PARTS` from `COLUMNS` with resizable columns, its header cells written out. */
  function Sized({ handle, ...props }: GridProps & { handle?: HandlePart }) {
    return (
      <DataGrid
        aria-label="Parts"
        items={PARTS}
        columns={COLUMNS}
        getRowId={partId}
        resizableColumns
        {...props}
      >
        <DataGrid.Header>
          <tr>
            {COLUMNS.map((column) => (
              <DataGrid.HeaderCell
                key={column.columnId}
                columnId={column.columnId}
                sortable={column.compare !== undefined}
                slotProps={{ resizeHandle: handle }}
              >
                {column.label}
              </DataGrid.HeaderCell>
            ))}
          </tr>
        </DataGrid.Header>
      </DataGrid>
    );
  }

  // Captured from 6f6b500's dist: the server markup, and the client one after the grid's
  // navigation wrote its tab stops (the same in both directions).
  const HANDLE = `wave-table-resize-handle absolute inset-y-0 end-0 z-1 w-2 cursor-col-resize touch-none select-none border-e-2 border-transparent hover:border-stroke-accessible focus-visible:border-primary data-[dragging]:border-primary forced-colors:forced-color-adjust-none forced-colors:hover:border-[ButtonText] forced-colors:focus-visible:border-[Highlight] forced-colors:data-[dragging]:border-[Highlight] wave-data-grid-header-cell__resize-handle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[dragging]:pointer-events-auto`;
  const pins = (tabIndex: string) =>
    Array(3)
      .fill(
        `<div aria-label="Resize column" aria-orientation="vertical" aria-valuemin="80" aria-valuenow="150" aria-valuetext="150 pixels" class="${HANDLE}" data-grid-auxiliary="" role="separator" tabindex="${tabIndex}">`,
      )
      .join('\n');
  const SERVER_PINS = pins('0');
  const CLIENT_PINS = pins('-1');

  it('renders the handles of 6f6b500 (attributes sorted), on the client and the server', () => {
    for (const handle of [undefined, {}]) {
      const view = render(<Sized handle={handle} />);
      expect(openingTags(...handles())).toBe(CLIENT_PINS);
      view.unmount();
      const rtl = renderWithProviders(<Sized handle={handle} />, { dir: 'rtl' });
      expect(openingTags(...handles())).toBe(CLIENT_PINS);
      rtl.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Sized handle={handle} />);
      expect(openingTags(...handles(template.content))).toBe(SERVER_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with the part empty', () => {
    type CellParts = NonNullable<DataGridHeaderCellProps['slotProps']>;
    expectInertSlotProps(
      (slotProps: CellParts | undefined) => <Sized handle={slotProps?.resizeHandle} />,
      { resizeHandle: {} },
    );
    expectInertSlotProps(
      (slotProps: CellParts | undefined) => (
        <Sized
          handle={slotProps?.resizeHandle}
          selectionMode="multiple"
          defaultColumnWidths={{ owner: 200 }}
          labels={{ resizeColumn: 'Width', columnWidth: (width) => `${width} px` }}
        />
      ),
      { resizeHandle: {} },
    );
  });

  it('puts your className, style, data-* and ref on each handle', () => {
    const refs: Element[] = [];
    render(
      <Sized
        handle={{
          className: 'my-handle w-4',
          style: { opacity: 0.5 },
          'data-part': 'handle',
          ref: (node) => void (node && refs.push(node)),
        }}
      />,
    );
    const elements = handles();
    expect(elements).toHaveLength(3);
    for (const handle of elements) {
      expect(handle.classList[0]).toBe(tableResizeHandleClassNames.root);
      expect(handle).toHaveClass(dataGridHeaderCellClassNames.resizeHandle, 'my-handle', 'w-4');
      // Your class replaces a conflicting one of the part.
      expect(handle).not.toHaveClass('w-2');
      expect(handle).toHaveAttribute('data-part', 'handle');
      expect(handle).toHaveStyle({ opacity: '0.5' });
    }
    expect(refs).toEqual(elements);
    expect(header('Item')).not.toHaveAttribute('data-part');
  });

  it('locks the handle’s attributes and the markers the grid reads, and F2 still reaches it', async () => {
    const user = userEvent.setup();
    const attempt = {
      role: 'button',
      'aria-orientation': 'horizontal',
      'aria-valuenow': 1,
      'aria-valuemin': 2,
      'aria-valuemax': 3,
      'aria-valuetext': 'Mine',
      'aria-label': 'Mine',
      // An author's tabindex="-1" opts a widget out of the grid: F2 would not reach it.
      tabIndex: -1,
      'data-dragging': '',
      'data-grid-auxiliary': 'mine',
      'data-roving-container': '',
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as HandlePart;
    const template = document.createElement('template');
    template.innerHTML = renderToString(<Sized handle={attempt} />);
    expect(openingTags(...handles(template.content))).toBe(SERVER_PINS);
    render(<Sized handle={attempt} />);
    expect(openingTags(...handles())).toBe(CLIENT_PINS);
    expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    act(() => header('Owner').focus());
    await user.keyboard('{F2}');
    expect(handleOf('Owner')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(header('Owner')).toHaveFocus();
  });

  it('adds your ids to the handle’s aria-labelledby and aria-describedby', () => {
    render(
      <>
        <span id="hint">Drag to resize</span>
        <Sized handle={{ 'aria-describedby': 'hint' }} />
      </>,
    );
    for (const handle of handles()) {
      expect(handle).toHaveAttribute('aria-describedby', 'hint');
      expect(handle).toHaveAccessibleName('Resize column');
    }
  });

  it('runs your pointer, key and double-click handlers first: preventDefault() skips the drag, the move, the key and the reset', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onColumnWidthsChange = vi.fn(() => void order.push('resize'));
    const prevent = (name: string) => (event: { preventDefault: () => void }) => {
      order.push(name);
      event.preventDefault();
    };
    const { rerender } = render(
      <Sized
        defaultColumnWidths={{ item: 200 }}
        onColumnWidthsChange={onColumnWidthsChange}
        handle={{ onPointerDown: prevent('down') }}
      />,
    );
    down(handleOf('Item'));
    expect(grid()).not.toHaveAttribute('data-resizing');
    expect(handleOf('Item')).not.toHaveAttribute('data-dragging');
    move(handleOf('Item'), 140);
    flushFrames();
    up(handleOf('Item'));
    expect(order).toEqual(['down']);

    rerender(
      <Sized
        defaultColumnWidths={{ item: 200 }}
        onColumnWidthsChange={onColumnWidthsChange}
        handle={{ onPointerMove: prevent('move') }}
      />,
    );
    down(handleOf('Item'));
    expect(grid()).toHaveAttribute('data-resizing', '');
    move(handleOf('Item'), 140);
    flushFrames();
    up(handleOf('Item'));
    expect(order).toEqual(['down', 'move']);

    for (const name of ['onKeyDown', 'onKeyDownCapture'] as const) {
      rerender(
        <Sized
          defaultColumnWidths={{ item: 200 }}
          onColumnWidthsChange={onColumnWidthsChange}
          handle={{ [name]: prevent(name) } as unknown as HandlePart}
        />,
      );
      act(() => handleOf('Item').focus());
      await user.keyboard('{ArrowRight}');
      expect(handleOf('Item')).toHaveFocus();
    }
    expect(order).toEqual(['down', 'move', 'onKeyDown', 'onKeyDownCapture']);
    expect(colWidths()).toEqual(['200px', '150px', '150px']);

    rerender(
      <Sized
        defaultColumnWidths={{ item: 200 }}
        onColumnWidthsChange={onColumnWidthsChange}
        handle={{ onKeyDown: () => void order.push('key') }}
      />,
    );
    await user.keyboard('{ArrowRight}');
    expect(order.slice(-2)).toEqual(['key', 'resize']);
    expect(colWidths()).toEqual(['220px', '150px', '150px']);

    rerender(
      <Sized
        defaultColumnWidths={{ item: 200 }}
        onColumnWidthsChange={onColumnWidthsChange}
        handle={{ onDoubleClick: prevent('double') }}
      />,
    );
    fireEvent.doubleClick(handleOf('Item'));
    expect(order.at(-1)).toBe('double');
    expect(colWidths()).toEqual(['220px', '150px', '150px']);
  });

  it.each([
    ['onPointerUp', (el: Element) => up(el)],
    ['onPointerCancel', (el: Element) => fireEvent.pointerCancel(el, POINTER)],
    ['onLostPointerCapture', (el: Element) => fireEvent.lostPointerCapture(el, { pointerId: 1 })],
  ] as const)('ends the drag after your %s whatever it does', (name, end) => {
    const onColumnWidthsChange = vi.fn();
    const handler = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <Sized
        defaultColumnWidths={{ item: 200 }}
        onColumnWidthsChange={onColumnWidthsChange}
        handle={{ [name]: handler } as unknown as HandlePart}
      />,
    );
    const handle = handleOf('Item');
    down(handle);
    move(handle, 140);
    expect(grid()).toHaveAttribute('data-resizing', '');
    expect(handle).toHaveAttribute('data-dragging', '');
    end(handle);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(grid()).not.toHaveAttribute('data-resizing');
    expect(handle).not.toHaveAttribute('data-dragging');
    // A further move drags nothing.
    move(handle, 300);
    flushFrames();
    expect(onColumnWidthsChange.mock.calls.every(([widths]) => widths.item !== 400)).toBe(true);
  });

  it('measures the column on focus and forgets a pressed key after your handlers whatever they do', async () => {
    const user = userEvent.setup();
    let preventKeyUp = true;
    const prevent = (event: { preventDefault: () => void }) => event.preventDefault();
    render(
      <>
        <Sized
          handle={{
            onFocus: prevent,
            onKeyUp: (event) => void (preventKeyUp && event.preventDefault()),
            onBlur: prevent,
          }}
        />
        <button type="button">After</button>
      </>,
    );
    mockRect(header('Item'), { width: 300 });
    mockRect(header('Owner'), { width: 280 });
    mockRect(header('Size'), { width: 260 });
    const handle = handleOf('Owner');
    act(() => header('Owner').focus());
    await user.keyboard('{F2}');
    expect(handle).toHaveFocus();
    expect(handle).toHaveAttribute('aria-valuenow', '280');
    // Your prevented release keeps focus on the handle, and the pressed key is forgotten: a
    // release with no press of its own leaves nothing.
    await user.keyboard('{Enter}');
    expect(handle).toHaveFocus();
    preventKeyUp = false;
    fireEvent.keyUp(handle, { key: 'Enter' });
    expect(handle).toHaveFocus();
    // A key pressed before focus left is forgotten with the blur, whatever your onBlur does.
    await user.keyboard('{Enter>}');
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    act(() => handle.focus());
    fireEvent.keyUp(handle, { key: 'Enter' });
    expect(handle).toHaveFocus();
    // A key pressed and released on the handle still leaves it.
    fireEvent.keyDown(handle, { key: 'Enter' });
    fireEvent.keyUp(handle, { key: 'Enter' });
    expect(header('Owner')).toHaveFocus();
  });

  it('keeps the handle’s own ref while a new inline part ref arrives on every render', async () => {
    const user = userEvent.setup();
    const seen: Element[] = [];
    const ui = () => <Sized handle={{ ref: (node) => void (node && seen.push(node)) }} />;
    const { rerender } = render(ui());
    rerender(ui());
    mockRect(header('Size'), { width: 260 });
    expect(new Set(seen)).toEqual(new Set(handles()));
    // The handle finds its cell through its own ref: the measure, and Escape back to the cell.
    act(() => header('Size').focus());
    await user.keyboard('{F2}');
    expect(handleOf('Size')).toHaveAttribute('aria-valuenow', '260');
    await user.keyboard('{Escape}');
    expect(header('Size')).toHaveFocus();
  });

  it('mirrors a drag in RTL with a part', () => {
    const onPointerDown = vi.fn();
    renderWithProviders(<Sized defaultColumnWidths={{ item: 200 }} handle={{ onPointerDown }} />, {
      dir: 'rtl',
    });
    const handle = handleOf('Item');
    down(handle);
    move(handle, 140);
    flushFrames();
    expect(colWidths()).toEqual(['160px', '150px', '150px']);
    up(handle);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('calls your handlers once per event in StrictMode', () => {
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();
    render(
      <React.StrictMode>
        <Sized handle={{ onPointerDown, onPointerUp }} />
      </React.StrictMode>,
    );
    down(handleOf('Owner'));
    up(handleOf('Owner'));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
  });

  it('ignores the part of a header cell without a handle', () => {
    const error = vi.spyOn(console, 'error');
    render(
      <DataGrid aria-label="Parts" items={PARTS} columns={COLUMNS} getRowId={partId}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell
              columnId="item"
              slotProps={{ resizeHandle: { className: 'my-handle' } }}
            >
              Item
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
      </DataGrid>,
    );
    expect(screen.queryByRole('separator')).toBeNull();
    expect(document.querySelector('.my-handle')).toBeNull();
    expect(header('Item')).not.toHaveAttribute('slotprops');
    expect(error).not.toHaveBeenCalled();
  });

  it('has no accessibility violations with a customised handle', async () => {
    render(
      <>
        <span id="hint">Drag to resize</span>
        <Sized handle={{ className: 'my-handle', 'aria-describedby': 'hint' }} />
      </>,
    );
    await expectNoA11yViolations();
  });
});
