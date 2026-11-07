import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DataGrid } from '../DataGrid';
import type { GridNavigationModel } from '../useGridNavigation';
import { dataGridClassNames } from '../../../lib/classNames';
import { createTableColumn } from '../../../lib/table';
import { useVirtualWindow } from '../../../hooks/useVirtualWindow';
import { expectNoA11yViolations } from '../../../test-utils';

const ITEM = 44;
const HEADER = 44;
const VIEWPORT = 480;
const COUNT = 1_000;

interface Item {
  id: string;
  name: string;
}

const ITEMS: Item[] = Array.from({ length: COUNT }, (_, index) => ({
  id: `id-${index}`,
  name: `Item ${String(index).padStart(4, '0')}`,
}));
const getId = (item: Item) => item.id;
const COLUMNS = [
  createTableColumn<Item>({ columnId: 'name', label: 'Name', renderCell: (item) => item.name }),
  createTableColumn<Item>({ columnId: 'size', label: 'Size', renderCell: () => 'Size' }),
];

/** Frames requested through the `requestAnimationFrame` stub, run by {@link runFrames}. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
function runFrames(): void {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

const isScroller = (el: Element) => el.classList.contains(dataGridClassNames.container);

beforeEach(() => {
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
    return isScroller(this) ? VIEWPORT : 0;
  });
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    return isScroller(this) ? HEADER + COUNT * ITEM : 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Grid({
  footer,
  windowed = true,
  items = ITEMS,
}: {
  footer?: React.ReactNode;
  windowed?: boolean;
  items?: readonly Item[];
}) {
  const virtualWindow = useVirtualWindow({ itemSize: ITEM, scrollPaddingStart: HEADER });
  return (
    <DataGrid
      aria-label="Items"
      columns={COLUMNS}
      getRowId={getId}
      items={items}
      virtualWindow={windowed ? virtualWindow : undefined}
    >
      {footer}
    </DataGrid>
  );
}

const FOOTER = (
  <tfoot>
    <tr>
      <td>Total</td>
      <td>1,000 rows</td>
    </tr>
    <tr>
      <td>Average</td>
      <td>500</td>
    </tr>
  </tfoot>
);

const grid = () => screen.getByRole('grid', { name: 'Items' });
const scroller = () => grid().parentElement as HTMLElement;
const cell = (name: string) => screen.getByText(name, { selector: 'td' });
const rowIndexOf = (name: string) => cell(name).parentElement?.getAttribute('aria-rowindex');
const press = (el: Element, key: string, init: KeyboardEventInit = {}) => {
  fireEvent.keyDown(el, { key, ...init });
  runFrames();
};
const focus = (el: HTMLElement) => act(() => el.focus());
const rowOfFocus = () => document.activeElement?.closest('tr') ?? null;

describe('DataGrid tfoot rows in a windowed grid', () => {
  it('counts the footer rows in aria-rowcount and numbers them after the data rows', () => {
    render(<Grid footer={FOOTER} />);
    // The header row, 1,000 data rows and two footer rows.
    expect(grid()).toHaveAttribute('aria-rowcount', String(1 + COUNT + 2));
    expect(rowIndexOf('Total')).toBe(String(1 + COUNT + 1));
    expect(rowIndexOf('Average')).toBe(String(1 + COUNT + 2));
  });

  it('numbers the rows of a footer in a Fragment, and leaves a row of another table alone', () => {
    render(
      <Grid
        footer={
          <tfoot>
            <>
              <tr>
                <td>Total</td>
              </tr>
              <tr>
                <td>Average</td>
              </tr>
            </>
          </tfoot>
        }
      />,
    );
    expect(grid()).toHaveAttribute('aria-rowcount', String(1 + COUNT + 2));
    expect(rowIndexOf('Average')).toBe(String(1 + COUNT + 2));
  });

  it('numbers a DataGrid.Row of the footer through its place', () => {
    render(
      <Grid
        footer={
          <tfoot>
            <DataGrid.Row>
              <DataGrid.Cell>Total</DataGrid.Cell>
            </DataGrid.Row>
          </tfoot>
        }
      />,
    );
    expect(rowIndexOf('Total')).toBe(String(1 + COUNT + 1));
    expect(cell('Total').parentElement).not.toHaveAttribute('data-row-index');
  });

  it('keeps the footer after the last spacer, in the document order of a table', () => {
    render(<Grid footer={FOOTER} />);
    const sections = Array.from(grid().children, (child) => child.localName);
    expect(sections.indexOf('tfoot')).toBe(sections.length - 1);
    expect(sections.indexOf('tbody')).toBeLessThan(sections.indexOf('tfoot'));
  });

  it('has no footer numbers in a grid without a window, or without a footer', () => {
    const { unmount } = render(<Grid footer={FOOTER} windowed={false} items={ITEMS.slice(0, 5)} />);
    expect(grid()).not.toHaveAttribute('aria-rowcount');
    expect(cell('Total').parentElement).not.toHaveAttribute('aria-rowindex');
    unmount();
    render(<Grid />);
    expect(grid()).toHaveAttribute('aria-rowcount', String(1 + COUNT));
  });

  it('goes to the last footer row with Ctrl+End, and back to the header with Ctrl+Home', () => {
    render(<Grid footer={FOOTER} />);
    focus(cell('Item 0000'));
    press(cell('Item 0000'), 'End', { ctrlKey: true });
    expect(document.activeElement).toBe(cell('500'));
    press(cell('500'), 'Home', { ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByRole('columnheader', { name: 'Name' }));
  });

  it('moves between the last data row and the footer rows with ArrowUp and ArrowDown', () => {
    render(<Grid footer={FOOTER} />);
    focus(cell('Item 0000'));
    press(cell('Item 0000'), 'End', { ctrlKey: true });
    expect(document.activeElement).toBe(cell('500'));
    press(cell('500'), 'ArrowUp');
    expect(document.activeElement).toBe(cell('1,000 rows'));
    // ArrowUp from the first footer row asks for the last data row, which the window mounts.
    press(cell('1,000 rows'), 'ArrowUp');
    expect(rowOfFocus()?.getAttribute('data-row-index')).toBe(String(COUNT - 1));
    expect(rowOfFocus()?.getAttribute('aria-rowindex')).toBe(String(1 + COUNT));
    press(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(cell('1,000 rows'));
    press(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(cell('500'));
    // The edge: nothing below the last footer row.
    press(cell('500'), 'ArrowDown');
    expect(document.activeElement).toBe(cell('500'));
  });

  it('clamps PageDown to the last footer row', () => {
    render(<Grid footer={FOOTER} />);
    focus(cell('Item 0000'));
    press(cell('Item 0000'), 'End', { ctrlKey: true });
    press(cell('500'), 'PageUp');
    // Ten rows up from the last footer row is a data row that is not mounted: the window moves.
    expect(rowOfFocus()?.getAttribute('data-row-index')).toBe(String(COUNT + 2 - 1 - 10));
    press(document.activeElement as Element, 'PageDown');
    expect(document.activeElement).toBe(cell('500'));
  });

  it('keeps the tab stop through the footer row it sits in while the window moves', () => {
    render(<Grid footer={FOOTER} />);
    focus(cell('Item 0000'));
    press(cell('Item 0000'), 'End', { ctrlKey: true });
    act(() => {
      scroller().scrollTop = 0;
      fireEvent.scroll(scroller());
    });
    runFrames();
    expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(cell('500')).toHaveAttribute('tabindex', '0');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Grid footer={FOOTER} />);
    await expectNoA11yViolations(container);
  });

  it('types the model’s footer count as optional', () => {
    expectTypeOf<GridNavigationModel['footerRowCount']>().toEqualTypeOf<number | undefined>();
  });
});
