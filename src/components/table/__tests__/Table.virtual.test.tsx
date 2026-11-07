import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Table } from '../Table';
import type { TableBodyProps, TableProps } from '../Table';
import { tableClassNames } from '../../../lib/classNames';
import { useVirtualWindow, type VirtualWindow } from '../../../hooks/useVirtualWindow';
import { expectNoA11yViolations } from '../../../test-utils';

const ITEM = 40;
const HEADER = 40;
const VIEWPORT = 400;
const COUNT = 1_000;

/** The `clientHeight` and `scrollHeight` the scroller reports (jsdom has no layout). */
let viewportHeight = VIEWPORT;
let contentHeight = HEADER + COUNT * ITEM;

const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
function runFrames(): void {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

const isScroller = (el: Element) => el.classList.contains(tableClassNames.container);

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

interface GridProps extends Partial<Omit<TableProps, 'virtualWindow' | 'children'>> {
  count?: number;
  /** Passes the window to the table. @default true */
  windowed?: boolean;
  /** The children after the body (a `<tfoot>`). */
  footer?: React.ReactNode;
  /** Renders the row of an index. */
  row?: (index: number) => React.ReactNode;
  captionless?: boolean;
  onWindow?: (virtualWindow: VirtualWindow) => void;
}

const defaultRow = (index: number) => (
  <Table.Row key={`item-${index}`}>
    <Table.Cell>{`Item ${index}`}</Table.Cell>
    <Table.Cell>
      <button type="button">{`Open ${index}`}</button>
    </Table.Cell>
  </Table.Row>
);

function VirtualTable({
  count = COUNT,
  windowed = true,
  footer,
  row = defaultRow,
  captionless = false,
  onWindow,
  ...props
}: GridProps) {
  const virtualWindow = useVirtualWindow({ itemSize: ITEM, scrollPaddingStart: HEADER });
  onWindow?.(virtualWindow);
  return (
    <Table virtualWindow={windowed ? virtualWindow : undefined} {...props}>
      {captionless ? null : <caption>Items</caption>}
      <Table.Header>
        <tr>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell>Action</Table.HeaderCell>
        </tr>
      </Table.Header>
      <Table.Body count={count}>{row}</Table.Body>
      {footer}
    </Table>
  );
}

const table = () => screen.getByRole('table', { name: 'Items' });
const scroller = () => table().parentElement as HTMLElement;
const bodyRows = () =>
  Array.from(table().querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr[data-row-index]'));
const spacers = () =>
  Array.from(
    table().querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr[data-virtual-spacer]'),
  );
const mounted = () => bodyRows().map((row) => Number(row.getAttribute('data-row-index')));
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
const order = () =>
  Array.from(table().querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr'), (row) =>
    row.hasAttribute('data-virtual-spacer') ? 'spacer' : Number(row.getAttribute('data-row-index')),
  );

function scrollTo(top: number): void {
  act(() => {
    scroller().scrollTop = top;
    fireEvent.scroll(scroller());
  });
  runFrames();
}

describe('Table virtualWindow', () => {
  describe('rendering and ARIA', () => {
    it('renders the rows in view, the overscan and one spacer for the rest', () => {
      render(<VirtualTable />);
      // 400 / 40: 10 rows in view, 6 below.
      expect(mounted()).toEqual(range(0, 16));
      const [spacer] = spacers();
      expect(spacers()).toHaveLength(1);
      expect(spacer).toHaveAttribute('aria-hidden', 'true');
      expect(spacer).toHaveClass(tableClassNames.spacer);
      expect(spacer.style.height).toBe(`${(COUNT - 16) * ITEM}px`);
      // The spacer's one cell adds no box to the columns.
      expect(spacer.cells).toHaveLength(1);
      expect(spacer.cells[0]).not.toHaveAttribute('colspan');
      // Out of the accessibility tree: the header row and the mounted rows remain.
      expect(screen.getAllByRole('row')).toHaveLength(1 + 16);
    });

    it('counts every row in aria-rowcount and numbers the rows', () => {
      render(<VirtualTable />);
      expect(table()).toHaveAttribute('aria-rowcount', String(1 + COUNT));
      expect(screen.getByRole('row', { name: 'Name Action' })).toHaveAttribute(
        'aria-rowindex',
        '1',
      );
      const row = bodyRows()[3];
      expect(row).toHaveAttribute('data-row-index', '3');
      expect(row).toHaveAttribute('aria-rowindex', '5');
      expect(row.style.height).toBe(`${ITEM}px`);
    });

    it('numbers several header rows, in a Fragment too', () => {
      function Grouped() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        return (
          <Table virtualWindow={virtualWindow}>
            <caption>Items</caption>
            <Table.Header>
              <>
                <tr>
                  <Table.HeaderCell colSpan={2}>Group</Table.HeaderCell>
                </tr>
                <Table.Row>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Action</Table.HeaderCell>
                </Table.Row>
              </>
            </Table.Header>
            <Table.Body count={50}>{defaultRow}</Table.Body>
          </Table>
        );
      }
      render(<Grouped />);
      expect(table()).toHaveAttribute('aria-rowcount', '52');
      expect(screen.getByRole('row', { name: 'Group' })).toHaveAttribute('aria-rowindex', '1');
      expect(screen.getByRole('row', { name: 'Name Action' })).toHaveAttribute(
        'aria-rowindex',
        '2',
      );
      expect(bodyRows()[0]).toHaveAttribute('aria-rowindex', '3');
    });

    it('makes the wrapper the window’s named, focusable scroller with the window’s settings', () => {
      render(<VirtualTable />);
      expect(scroller()).toHaveAttribute('role', 'region');
      expect(scroller()).toHaveAccessibleName('Items');
      expect(scroller()).toHaveAttribute('tabindex', '0');
      expect(scroller()).toHaveClass('wave:[overflow-anchor:none]');
      expect(table()).toHaveClass('wave:table-fixed');
    });

    it('keeps the header at the top of the scroller', () => {
      render(<VirtualTable />);
      const header = (table() as HTMLTableElement).tHead as HTMLElement;
      expect(header).toHaveClass('wave:sticky', 'wave:top-0', 'wave:z-1');
    });

    it('gives a body row the window’s height and its cells no vertical padding, one line of text', () => {
      render(<VirtualTable />);
      const cell = screen.getByRole('cell', { name: 'Item 2' });
      expect(cell).toHaveClass(
        'wave:py-0',
        'wave:align-middle',
        'wave:overflow-hidden',
        'wave:text-ellipsis',
        'wave:whitespace-nowrap',
      );
      expect(cell).not.toHaveClass('wave:py-3');
    });

    it('leaves a table without a window with none of it', () => {
      render(<VirtualTable windowed={false} count={5} />);
      expect(table()).not.toHaveAttribute('aria-rowcount');
      expect(table()).not.toHaveClass('wave:table-fixed');
      expect((table() as HTMLTableElement).tHead).not.toHaveClass('wave:sticky');
      expect(bodyRows()).toHaveLength(0);
      expect(screen.getByRole('cell', { name: 'Item 2' })).toHaveClass('wave:py-3');
      expect(screen.getByRole('cell', { name: 'Item 2' }).parentElement).not.toHaveAttribute(
        'aria-rowindex',
      );
    });

    it('renders on the server, the first window included', () => {
      const html = renderToString(<VirtualTable />);
      expect(html).toContain('aria-rowcount="1001"');
      expect(html).toContain('data-virtual-spacer');
      expect(html).toContain('Item 0');
      expect(html).not.toContain('Item 40<');
    });

    it('has no axe violations', async () => {
      const { container } = render(<VirtualTable />);
      await expectNoA11yViolations(container);
    });
  });

  describe('scrolling', () => {
    it('moves the window with the scroll position, between two spacers', () => {
      render(<VirtualTable />);
      scrollTo(200 * ITEM);
      // The first row in view is 200 minus the header: the rows around it are mounted.
      const indexes = mounted();
      expect(indexes.length).toBeLessThanOrEqual(30);
      expect(indexes).toContain(200);
      expect(indexes).not.toContain(0);
      expect(order()[0]).toBe('spacer');
      expect(order()[order().length - 1]).toBe('spacer');
      expect(spacers()).toHaveLength(2);
      // The sizes add up to every row.
      const total = [...bodyRows(), ...spacers()].reduce(
        (sum, row) => sum + parseFloat(row.style.height),
        0,
      );
      expect(total).toBe(COUNT * ITEM);
    });

    it('keeps the order and the aria-rowindex of the mounted rows', () => {
      render(<VirtualTable />);
      scrollTo(500 * ITEM);
      for (const row of bodyRows()) {
        expect(row.getAttribute('aria-rowindex')).toBe(
          String(Number(row.getAttribute('data-row-index')) + 2),
        );
      }
      expect(mounted()).toEqual([...mounted()].sort((a, b) => a - b));
    });

    it('calls the row function for the mounted rows only', () => {
      const row = vi.fn(defaultRow);
      render(<VirtualTable row={row} />);
      // The body renders again as the window measures; never for a row that is not mounted.
      const called = new Set(row.mock.calls.map((call) => call[0]));
      expect(called.size).toBeLessThanOrEqual(30);
      expect([...called].sort((a, b) => a - b)).toEqual(range(0, called.size));
    });
  });

  describe('focus', () => {
    it('keeps a row that holds focus rendered when it is scrolled away, and drops it on blur', () => {
      render(<VirtualTable />);
      const button = screen.getByRole('button', { name: 'Open 3' });
      act(() => button.focus());
      scrollTo(500 * ITEM);
      expect(mounted()).toContain(3);
      expect(screen.getByRole('button', { name: 'Open 3' })).toBe(button);
      expect(document.activeElement).toBe(button);
      // Focus leaves the table: the row goes with the window.
      act(() => button.blur());
      scrollTo(500 * ITEM + 1);
      expect(mounted()).not.toContain(3);
    });

    it('keeps the row while focus moves inside the body', () => {
      render(<VirtualTable />);
      act(() => screen.getByRole('button', { name: 'Open 3' }).focus());
      act(() => screen.getByRole('button', { name: 'Open 4' }).focus());
      scrollTo(500 * ITEM);
      expect(mounted()).toContain(4);
      expect(mounted()).not.toContain(3);
    });
  });

  describe('striped', () => {
    it('draws the stripe from the index of the row, not its place among the mounted rows', () => {
      render(<VirtualTable striped />);
      const stripe = 'wave:[:where(&)]:bg-card';
      const striped = () => bodyRows().map((row) => row.classList.contains(stripe));
      // Rows 0, 2, 4, … (the odd rows of the table: 1, 3, 5, …).
      expect(striped().slice(0, 4)).toEqual([true, false, true, false]);
      scrollTo(201 * ITEM);
      for (const row of bodyRows()) {
        const index = Number(row.getAttribute('data-row-index'));
        expect(row.classList.contains(stripe)).toBe(index % 2 === 0);
      }
      // The table's own stripe, which counts the spacer rows, is not drawn.
      expect(table().className).not.toContain('nth-child(odd)');
      expect(table()).toHaveAttribute('data-striped');
    });

    it('keeps the table’s own stripe without a window', () => {
      render(<VirtualTable striped windowed={false} count={4} />);
      expect(table().className).toContain('wave:[:where(&>tbody>tr:nth-child(odd))]:bg-card');
    });
  });

  describe('footer', () => {
    it('numbers the rows of a <tfoot> after the body and counts them', () => {
      render(
        <VirtualTable
          footer={
            <tfoot>
              <tr>
                <td>Total</td>
                <td>Sum</td>
              </tr>
            </tfoot>
          }
        />,
      );
      expect(table()).toHaveAttribute('aria-rowcount', String(1 + COUNT + 1));
      expect(screen.getByRole('cell', { name: 'Total' }).parentElement).toHaveAttribute(
        'aria-rowindex',
        String(1 + COUNT + 1),
      );
    });
  });

  describe('a function child without a window', () => {
    it('renders every row of count, keyed by the row’s own key', () => {
      render(<VirtualTable windowed={false} count={3} />);
      expect(screen.getAllByRole('row')).toHaveLength(4);
      expect(screen.getByRole('cell', { name: 'Item 2' })).toBeInTheDocument();
    });

    it('keeps a row’s identity by its key when the rows reorder', () => {
      const keyed = (order: readonly string[]) => (index: number) => (
        <Table.Row key={order[index]}>
          <Table.Cell>{order[index]}</Table.Cell>
        </Table.Row>
      );
      const view = (order: readonly string[]) => (
        <Table aria-label="Items">
          <Table.Body count={order.length}>{keyed(order)}</Table.Body>
        </Table>
      );
      const { rerender } = render(view(['a', 'b', 'c']));
      const cellB = screen.getByRole('cell', { name: 'b' });
      rerender(view(['c', 'b', 'a']));
      expect(screen.getByRole('cell', { name: 'b' })).toBe(cellB);
    });

    it('treats a count that is not a whole number of at least 0 as 0 or its floor', () => {
      render(<VirtualTable windowed={false} count={2.9} />);
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });

    it('renders no rows for a count below 0 or not finite', () => {
      const { unmount } = render(<VirtualTable windowed={false} count={-4} />);
      expect(screen.getAllByRole('row')).toHaveLength(1);
      unmount();
      render(<VirtualTable windowed={false} count={Number.NaN} />);
      expect(screen.getAllByRole('row')).toHaveLength(1);
    });
  });

  describe('a table nested in a row', () => {
    it('does not take the outer row’s place', () => {
      render(
        <VirtualTable
          row={(index) => (
            <Table.Row key={index}>
              <Table.Cell>
                {index === 0 ? (
                  <Table aria-label="Inner">
                    <Table.Body>
                      <Table.Row>
                        <Table.Cell>Nested</Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table>
                ) : (
                  `Item ${index}`
                )}
              </Table.Cell>
            </Table.Row>
          )}
        />,
      );
      const nested = screen.getByRole('cell', { name: 'Nested' });
      expect(nested.parentElement).not.toHaveAttribute('aria-rowindex');
      expect(nested.parentElement).not.toHaveAttribute('data-row-index');
      expect(nested).toHaveClass('wave:py-3');
    });
  });

  describe('development warnings', () => {
    const messages = (warn: { mock: { calls: unknown[][] } }) =>
      warn.mock.calls.map((call) => call[0]);

    it('ignores a window without a body that has count and a function child', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function NoCount() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        return (
          <Table aria-label="Items" virtualWindow={virtualWindow}>
            <Table.Body>
              <Table.Row>
                <Table.Cell>Alpha</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        );
      }
      render(<NoCount />);
      expect(messages(warn)).toEqual([
        '[WaveUI] Table: `virtualWindow` needs a `Table.Body` with `count` and a function child that returns the row at an index; it is ignored, and every row is rendered.',
      ]);
      expect(table()).not.toHaveAttribute('aria-rowcount');
      expect(screen.getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    });

    it('warns once when a function child has no count', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Table aria-label="Items">
          <Table.Body>{defaultRow}</Table.Body>
        </Table>,
      );
      expect(messages(warn)).toEqual([
        '[WaveUI] Table.Body: a function child renders one row per index below `count`, which is not set, so the body has no rows.',
      ]);
      expect(screen.queryAllByRole('row')).toHaveLength(0);
    });

    it('warns once when count is given without a function child', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Table aria-label="Items">
          <Table.Body count={3}>
            <Table.Row>
              <Table.Cell>Alpha</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      );
      expect(messages(warn)).toEqual([
        '[WaveUI] Table.Body: `count` is ignored unless the child is a function that returns the row at an index.',
      ]);
    });

    it('warns once about a scroll region without a name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<VirtualTable captionless aria-label="Items" />);
      expect(messages(warn)).toEqual([
        '[WaveUI] Table: a table with a `virtualWindow` scrolls vertically but its scroll region has no name. Add a <caption> or containerProps["aria-label"].',
      ]);
    });

    it('does not warn when containerProps names the region', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <VirtualTable
          captionless
          aria-label="Items"
          containerProps={{ 'aria-label': 'Items scroller' }}
        />,
      );
      expect(warn).not.toHaveBeenCalled();
      expect(screen.getByRole('region', { name: 'Items scroller' })).toBeInTheDocument();
    });

    it('warns once when the scroller is as tall as its rows (no bounded height)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      viewportHeight = HEADER + 100 * ITEM;
      contentHeight = viewportHeight;
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.localName === 'table' ? viewportHeight : 0;
      });
      render(<VirtualTable count={100} />);
      expect(messages(warn)).toEqual([
        '[WaveUI] Table: the scroll wrapper of a table with `virtualWindow` has no bounded height (it is as tall as its rows), so the window renders every row. Give it a height or a maximum height in `containerProps` (a class or a style).',
      ]);
    });

    it('does not warn about a bounded scroller', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<VirtualTable />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('StrictMode', () => {
    it('renders the same window and focus handling twice over', () => {
      render(
        <React.StrictMode>
          <VirtualTable />
        </React.StrictMode>,
      );
      expect(mounted()).toEqual(range(0, 16));
      act(() => screen.getByRole('button', { name: 'Open 3' }).focus());
      scrollTo(500 * ITEM);
      expect(mounted()).toContain(3);
    });
  });

  it('types the windowed body', () => {
    expectTypeOf<TableProps['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
    expectTypeOf<TableBodyProps['count']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<TableBodyProps['children']>().toEqualTypeOf<
      React.ReactNode | ((index: number) => React.ReactNode)
    >();
  });
});
