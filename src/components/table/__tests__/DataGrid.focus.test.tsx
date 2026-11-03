import * as React from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataGrid } from '../DataGrid';
import type {
  DataGridBaseProps,
  DataGridCellFocusMode,
  DataGridCellProps,
  DataGridFocusMode,
  DataGridHeaderCellProps,
} from '../DataGrid';
import { useGridNavigation } from '../useGridNavigation';
import type { GridNavigationFocusMode, UseGridNavigationOptions } from '../useGridNavigation';
import { useVirtualWindow } from '../../../hooks/useVirtualWindow';
import { expectNoA11yViolations } from '../../../test-utils';

const PEOPLE = ['Ann', 'Bo', 'Cy', 'Di', 'Ed'] as const;

interface GridProps extends Partial<DataGridBaseProps> {
  /** The focus mode of the Role cell of the row of Bo. */
  roleCellMode?: DataGridCellFocusMode;
  /** The focus mode of the Name cell of Cy. */
  nameCellMode?: DataGridCellFocusMode;
}

/** A grid of PEOPLE: a Name cell, and a Role cell with a button, per row. */
function Grid({ roleCellMode, nameCellMode, ...props }: GridProps) {
  return (
    <DataGrid aria-label="People" {...props}>
      <DataGrid.Header>
        <DataGrid.Row>
          <DataGrid.HeaderCell columnId="name" sortable>
            Name
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Role</DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Notes</DataGrid.HeaderCell>
        </DataGrid.Row>
      </DataGrid.Header>
      <DataGrid.Body>
        {PEOPLE.map((name) => (
          <DataGrid.Row key={name} rowId={name}>
            <DataGrid.Cell focusMode={name === 'Cy' ? nameCellMode : undefined}>
              {name}
            </DataGrid.Cell>
            <DataGrid.Cell focusMode={name === 'Bo' ? roleCellMode : undefined}>
              <button type="button">Edit {name}</button>
            </DataGrid.Cell>
            <DataGrid.Cell>Note {name}</DataGrid.Cell>
          </DataGrid.Row>
        ))}
      </DataGrid.Body>
    </DataGrid>
  );
}

const grid = () => screen.getByRole('grid', { name: 'People' });
const row = (name: string) => screen.getByRole('row', { name: new RegExp(`^${name}`) });
const cell = (text: string) => screen.getByRole('gridcell', { name: text });
const edit = (name: string) => screen.getByRole('button', { name: `Edit ${name}` });
const stamped = () => Array.from(grid().querySelectorAll('[tabindex]'));
const tabIndexOf = (el: Element) => el.getAttribute('tabindex');
const focus = (el: HTMLElement) => act(() => el.focus());
const press = (el: Element, key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(el, { key, ...init });

describe('DataGrid focusMode', () => {
  describe('cell (the default)', () => {
    it('renders data-focus-mode="cell" and keeps one tab stop on the first cell', () => {
      render(<Grid />);
      expect(grid()).toHaveAttribute('data-focus-mode', 'cell');
      expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      expect(tabIndexOf(screen.getByRole('columnheader', { name: 'Name' }))).toBe(null);
      // The sort button is the target of the first header cell, so it holds the tab stop.
      expect(tabIndexOf(screen.getByRole('button', { name: 'Name' }))).toBe('0');
    });

    it('moves between cells with the arrow keys', () => {
      render(<Grid />);
      focus(cell('Ann'));
      press(cell('Ann'), 'ArrowRight');
      expect(document.activeElement).toBe(edit('Ann'));
      press(edit('Ann'), 'ArrowDown');
      expect(document.activeElement).toBe(edit('Bo'));
    });
  });

  describe('none', () => {
    it('renders data-focus-mode="none" and writes no tabindex', () => {
      render(<Grid focusMode="none" />);
      expect(grid()).toHaveAttribute('data-focus-mode', 'none');
      expect(stamped()).toHaveLength(0);
    });

    it('handles no keys: the arrow keys are left to the page and the widgets', () => {
      render(<Grid focusMode="none" />);
      focus(edit('Ann'));
      // fireEvent returns false when the handler called preventDefault().
      expect(press(edit('Ann'), 'ArrowDown')).toBe(true);
      expect(press(edit('Ann'), 'ArrowRight')).toBe(true);
      expect(press(edit('Ann'), 'Home', { ctrlKey: true })).toBe(true);
      expect(document.activeElement).toBe(edit('Ann'));
      expect(stamped()).toHaveLength(0);
    });

    it('leaves every widget in the Tab order', async () => {
      const user = userEvent.setup();
      render(<Grid focusMode="none" />);
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Name' }));
      for (const name of PEOPLE) {
        await user.tab();
        expect(document.activeElement).toBe(edit(name));
      }
    });

    it('gives back the tab indexes of the cell mode, and takes them again', () => {
      const { rerender } = render(<Grid />);
      expect(stamped().length).toBeGreaterThan(0);
      rerender(<Grid focusMode="none" />);
      expect(stamped()).toHaveLength(0);
      rerender(<Grid focusMode="cell" />);
      expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      expect(tabIndexOf(edit('Bo'))).toBe('-1');
    });

    it('has no axe violations', async () => {
      const { container } = render(<Grid focusMode="none" />);
      await expectNoA11yViolations(container);
    });
  });

  describe('row', () => {
    it('renders data-focus-mode="row" and gives the first body row the only tab stop', () => {
      render(<Grid focusMode="row" />);
      expect(grid()).toHaveAttribute('data-focus-mode', 'row');
      expect(tabIndexOf(row('Ann'))).toBe('0');
      for (const name of PEOPLE.slice(1)) expect(tabIndexOf(row(name))).toBe('-1');
      // The header row and its sort button stay as they are.
      expect(tabIndexOf(screen.getByRole('row', { name: /^Name/ }))).toBe(null);
      expect(tabIndexOf(screen.getByRole('button', { name: 'Name' }))).toBe(null);
      // Cells are no focus target.
      for (const gridcell of screen.getAllByRole('gridcell')) {
        expect(gridcell).not.toHaveAttribute('tabindex');
      }
    });

    it('takes the widgets of the other rows out of the Tab order', () => {
      render(<Grid focusMode="row" />);
      expect(edit('Ann')).not.toHaveAttribute('tabindex');
      for (const name of PEOPLE.slice(1)) expect(tabIndexOf(edit(name))).toBe('-1');
    });

    it('moves between rows with ArrowDown and ArrowUp, stopping at the edges', () => {
      render(<Grid focusMode="row" />);
      focus(row('Ann'));
      expect(press(row('Ann'), 'ArrowDown')).toBe(false);
      expect(document.activeElement).toBe(row('Bo'));
      // The row that holds focus holds the tab stop, and its widgets join the Tab order.
      expect(tabIndexOf(row('Bo'))).toBe('0');
      expect(tabIndexOf(row('Ann'))).toBe('-1');
      expect(edit('Bo')).not.toHaveAttribute('tabindex');
      expect(tabIndexOf(edit('Ann'))).toBe('-1');
      press(row('Bo'), 'ArrowUp');
      expect(document.activeElement).toBe(row('Ann'));
      // A handled key never scrolls the page, even at the edge.
      expect(press(row('Ann'), 'ArrowUp')).toBe(false);
      expect(document.activeElement).toBe(row('Ann'));
    });

    it('moves by Home, End, PageDown and PageUp', () => {
      render(<Grid focusMode="row" />);
      focus(row('Cy'));
      press(row('Cy'), 'End');
      expect(document.activeElement).toBe(row('Ed'));
      press(row('Ed'), 'Home');
      expect(document.activeElement).toBe(row('Ann'));
      press(row('Ann'), 'PageDown');
      expect(document.activeElement).toBe(row('Ed'));
      press(row('Ed'), 'PageUp');
      expect(document.activeElement).toBe(row('Ann'));
    });

    it('leaves a key on a widget in the row to the widget', () => {
      render(<Grid focusMode="row" />);
      focus(edit('Ann'));
      expect(press(edit('Ann'), 'ArrowDown')).toBe(true);
      expect(document.activeElement).toBe(edit('Ann'));
    });

    it('ignores the keys with Alt or Meta held, and the horizontal arrows', () => {
      render(<Grid focusMode="row" />);
      focus(row('Ann'));
      expect(press(row('Ann'), 'ArrowDown', { altKey: true })).toBe(true);
      expect(press(row('Ann'), 'ArrowDown', { metaKey: true })).toBe(true);
      expect(press(row('Ann'), 'ArrowRight')).toBe(true);
      expect(document.activeElement).toBe(row('Ann'));
    });

    it('makes the row that a widget focus the active one, and reaches the widget with Tab', async () => {
      const user = userEvent.setup();
      render(<Grid focusMode="row" />);
      focus(row('Ann'));
      await user.tab();
      expect(document.activeElement).toBe(edit('Ann'));
      // Focus on a widget of another row (a click) moves the tab stop to that row.
      focus(edit('Di'));
      expect(tabIndexOf(row('Di'))).toBe('0');
      expect(tabIndexOf(row('Ann'))).toBe('-1');
      expect(edit('Di')).not.toHaveAttribute('tabindex');
      expect(tabIndexOf(edit('Ann'))).toBe('-1');
    });

    it('keeps exactly one row tab stop through every step', () => {
      render(<Grid focusMode="row" />);
      focus(row('Ann'));
      for (const key of ['ArrowDown', 'ArrowDown', 'End', 'ArrowUp', 'Home']) {
        press(document.activeElement as Element, key);
        expect(grid().querySelectorAll('tr[tabindex="0"]')).toHaveLength(1);
      }
    });

    it('follows rows that come and go', () => {
      const { rerender } = render(<Grid focusMode="row" />);
      focus(row('Ann'));
      press(row('Ann'), 'ArrowDown');
      expect(tabIndexOf(row('Bo'))).toBe('0');
      // The rows are keyed: removing the active row hands the tab stop to the first one.
      rerender(
        <DataGrid aria-label="People" focusMode="row">
          <DataGrid.Body>
            <DataGrid.Row rowId="ann">
              <DataGrid.Cell>Ann</DataGrid.Cell>
            </DataGrid.Row>
            <DataGrid.Row rowId="cy">
              <DataGrid.Cell>Cy</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      expect(grid().querySelectorAll('tr[tabindex="0"]')).toHaveLength(1);
    });

    it('toggles the selection of the row with Space, and outlines a focused row', () => {
      const onSelectedItemsChange = vi.fn();
      render(
        <Grid
          focusMode="row"
          selectionMode="multiple"
          onSelectedItemsChange={onSelectedItemsChange}
        />,
      );
      focus(row('Bo'));
      press(row('Bo'), ' ');
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
      expect(onSelectedItemsChange).toHaveBeenCalledWith(['Bo'], { event: expect.any(Event) });
      expect(row('Bo').className).toContain('wave:focus-visible:outline');
      // The header row and rows of the other modes draw no ring.
      expect(screen.getByRole('row', { name: /^Select all/ }).className).not.toContain(
        'wave:focus-visible:outline',
      );
    });

    it('draws no ring on rows in the cell mode', () => {
      render(<Grid selectionMode="multiple" />);
      expect(row('Bo').className).not.toContain('wave:focus-visible:outline');
    });

    it('does not remount or re-stamp the rows when the mode does not change', () => {
      const { rerender } = render(<Grid focusMode="row" />);
      const before = row('Ann');
      rerender(<Grid focusMode="row" />);
      expect(row('Ann')).toBe(before);
      expect(tabIndexOf(row('Ann'))).toBe('0');
    });

    it('gives back the row tab stops when the mode changes', () => {
      const { rerender } = render(<Grid focusMode="row" />);
      rerender(<Grid focusMode="none" />);
      expect(stamped()).toHaveLength(0);
      rerender(<Grid focusMode="row" />);
      expect(tabIndexOf(row('Ann'))).toBe('0');
      rerender(<Grid />);
      expect(grid().querySelectorAll('tr[tabindex]')).toHaveLength(0);
      expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });

    it('has no axe violations', async () => {
      const { container } = render(<Grid focusMode="row" selectionMode="multiple" />);
      await expectNoA11yViolations(container);
    });
  });

  describe('row with a virtualWindow', () => {
    it('navigates by cell and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const items = PEOPLE.map((name) => ({ name }));
      function Windowed() {
        const virtualWindow = useVirtualWindow({ itemSize: 44 });
        return (
          <DataGrid
            aria-label="People"
            focusMode="row"
            items={items}
            columns={[
              {
                columnId: 'name',
                label: 'Name',
                renderCell: (item: { name: string }) => item.name,
              },
            ]}
            virtualWindow={virtualWindow}
          />
        );
      }
      render(<Windowed />);
      expect(warn.mock.calls.map((call) => call[0])).toEqual([
        '[WaveUI] DataGrid: `focusMode="row"` is ignored in a grid with a `virtualWindow`, which navigates by cell. Use `focusMode="cell"` or remove the `virtualWindow`.',
      ]);
      expect(grid().querySelectorAll('tr[tabindex]')).toHaveLength(0);
      expect(grid().querySelectorAll('td[tabindex="0"], th[tabindex="0"]')).toHaveLength(1);
      warn.mockRestore();
    });
  });

  describe('StrictMode', () => {
    const strict = (mode: DataGridFocusMode) => (
      <React.StrictMode>
        <Grid focusMode={mode} />
      </React.StrictMode>
    );

    it('keeps one tab stop in the cell mode', () => {
      render(strict('cell'));
      expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      focus(cell('Ann'));
      press(cell('Ann'), 'ArrowRight');
      expect(document.activeElement).toBe(edit('Ann'));
    });

    it('keeps one row tab stop in the row mode, and moves by row', () => {
      render(strict('row'));
      expect(grid().querySelectorAll('tr[tabindex="0"]')).toHaveLength(1);
      focus(row('Ann'));
      press(row('Ann'), 'ArrowDown');
      expect(document.activeElement).toBe(row('Bo'));
      expect(grid().querySelectorAll('tr[tabindex="0"]')).toHaveLength(1);
    });

    it('writes nothing in the none mode', () => {
      render(strict('none'));
      expect(stamped()).toHaveLength(0);
    });
  });

  it('types the modes', () => {
    expectTypeOf<DataGridFocusMode>().toEqualTypeOf<'cell' | 'row' | 'none'>();
    expectTypeOf<GridNavigationFocusMode>().toEqualTypeOf<DataGridFocusMode>();
    expectTypeOf<DataGridBaseProps['focusMode']>().toEqualTypeOf<DataGridFocusMode | undefined>();
    expectTypeOf<UseGridNavigationOptions['focusMode']>().toEqualTypeOf<
      GridNavigationFocusMode | undefined
    >();
    // @ts-expect-error -- Fluent's `composite` has no counterpart.
    const composite: DataGridBaseProps = { focusMode: 'composite' };
    void composite;
  });
});

describe('useGridNavigation focusMode', () => {
  function Hook({ focusMode }: { focusMode?: GridNavigationFocusMode }) {
    const { gridRef, gridProps } = useGridNavigation({ focusMode });
    return (
      <table ref={gridRef} role="grid" aria-label="Plain" {...gridProps}>
        <tbody>
          <tr>
            <td>
              <button type="button">One</button>
            </td>
          </tr>
          <tr>
            <td>
              <button type="button">Two</button>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  it('is the cell mode by default', () => {
    render(<Hook />);
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('tabindex', '-1');
  });

  it('writes nothing in the none mode', () => {
    render(<Hook focusMode="none" />);
    expect(document.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('moves between body rows in the row mode', () => {
    render(<Hook focusMode="row" />);
    const rows = screen.getAllByRole('row');
    expect(rows.map(tabIndexOf)).toEqual(['0', '-1']);
    focus(rows[0]);
    press(rows[0], 'ArrowDown');
    expect(document.activeElement).toBe(rows[1]);
  });
});

describe('DataGrid cell focusMode', () => {
  describe('none', () => {
    it('renders data-focus-mode and leaves the cell and its widgets out of the grid', () => {
      render(<Grid roleCellMode="none" />);
      const role = cell('Edit Bo');
      expect(role).toHaveAttribute('data-focus-mode', 'none');
      expect(role).not.toHaveAttribute('tabindex');
      // The widget keeps its own place in the Tab order.
      expect(edit('Bo')).not.toHaveAttribute('tabindex');
      // Other cells and widgets are unchanged.
      expect(tabIndexOf(edit('Ann'))).toBe('-1');
    });

    it('is skipped by ArrowRight and ArrowLeft', () => {
      render(<Grid roleCellMode="none" />);
      focus(cell('Bo'));
      press(cell('Bo'), 'ArrowRight');
      expect(document.activeElement).toBe(cell('Note Bo'));
      press(cell('Note Bo'), 'ArrowLeft');
      expect(document.activeElement).toBe(cell('Bo'));
    });

    it('is skipped by Home and End of a row whose end cells opt out', () => {
      render(
        <DataGrid aria-label="People">
          <DataGrid.Body>
            <DataGrid.Row rowId="a">
              <DataGrid.Cell focusMode="none">First</DataGrid.Cell>
              <DataGrid.Cell>Middle</DataGrid.Cell>
              <DataGrid.Cell focusMode="none">Last</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      // The first cell that is navigated holds the tab stop.
      expect(tabIndexOf(cell('Middle'))).toBe('0');
      focus(cell('Middle'));
      press(cell('Middle'), 'Home');
      expect(document.activeElement).toBe(cell('Middle'));
      press(cell('Middle'), 'End');
      expect(document.activeElement).toBe(cell('Middle'));
      press(cell('Middle'), 'ArrowLeft');
      expect(document.activeElement).toBe(cell('Middle'));
    });

    it('is passed over by ArrowDown and ArrowUp, which land on the nearest cell', () => {
      render(<Grid nameCellMode="none" />);
      focus(cell('Bo'));
      press(cell('Bo'), 'ArrowDown');
      // Cy's Name cell opts out: the move lands on the nearest cell of the row that does not.
      expect(document.activeElement).not.toBe(cell('Cy'));
      expect(document.activeElement?.closest('tr')).toBe(row('Cy'));
    });

    it('lets a click on a widget in the cell focus it without taking the grid’s tab stop', () => {
      render(<Grid roleCellMode="none" />);
      focus(edit('Ann'));
      const stop = grid().querySelector('[tabindex="0"]');
      focus(edit('Bo'));
      expect(grid().querySelector('[tabindex="0"]')).toBe(stop);
      expect(press(edit('Bo'), 'ArrowDown')).toBe(true);
      expect(document.activeElement).toBe(edit('Bo'));
    });

    it('hands the tab stop to another cell when the cell that holds it opts out', () => {
      const { rerender } = render(<Grid />);
      focus(cell('Ann'));
      expect(tabIndexOf(cell('Ann'))).toBe('0');
      rerender(
        <DataGrid aria-label="People">
          <DataGrid.Body>
            <DataGrid.Row rowId="a">
              <DataGrid.Cell focusMode="none">Ann</DataGrid.Cell>
              <DataGrid.Cell>Next</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      expect(grid().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      expect(tabIndexOf(cell('Next'))).toBe('0');
    });

    it('gives back the tab indexes it wrote when a cell starts to opt out, and takes them again', async () => {
      const { rerender } = render(<Grid />);
      expect(tabIndexOf(edit('Bo'))).toBe('-1');
      // The grid reads attribute changes through a MutationObserver, after the commit.
      rerender(<Grid roleCellMode="none" />);
      await act(async () => {});
      expect(edit('Bo')).not.toHaveAttribute('tabindex');
      rerender(<Grid />);
      await act(async () => {});
      expect(tabIndexOf(edit('Bo'))).toBe('-1');
    });

    it('ignores the keys pressed on a widget of an opted-out cell', () => {
      render(<Grid roleCellMode="none" />);
      focus(edit('Bo'));
      expect(press(edit('Bo'), 'ArrowRight')).toBe(true);
      expect(press(edit('Bo'), 'Escape')).toBe(true);
    });
  });

  describe('group', () => {
    it('makes the cell its own focus target even with a single widget', () => {
      render(<Grid roleCellMode="group" />);
      const role = cell('Edit Bo');
      expect(role).toHaveAttribute('data-focus-mode', 'group');
      // A cell with one widget is otherwise the widget's: here the widget is entered with Enter.
      expect(tabIndexOf(edit('Bo'))).toBe('-1');
      focus(cell('Ann'));
      press(cell('Ann'), 'ArrowDown');
      press(document.activeElement as Element, 'ArrowRight');
      expect(document.activeElement).toBe(role);
      expect(tabIndexOf(role)).toBe('0');
      press(role, 'Enter');
      expect(document.activeElement).toBe(edit('Bo'));
      press(edit('Bo'), 'Escape');
      expect(document.activeElement).toBe(role);
    });
  });

  describe('cell (the default)', () => {
    it('renders no data-focus-mode', () => {
      render(<Grid roleCellMode="cell" />);
      expect(cell('Edit Bo')).not.toHaveAttribute('data-focus-mode');
      expect(cell('Edit Ann')).not.toHaveAttribute('data-focus-mode');
      // A lone widget is the cell's target, as before.
      expect(tabIndexOf(edit('Bo'))).toBe('-1');
      expect(cell('Edit Bo')).not.toHaveAttribute('tabindex');
    });
  });

  describe('header cells', () => {
    it('opt out like body cells', () => {
      render(
        <DataGrid aria-label="People">
          <DataGrid.Header>
            <DataGrid.Row>
              <DataGrid.HeaderCell focusMode="none">Skipped</DataGrid.HeaderCell>
              <DataGrid.HeaderCell>Kept</DataGrid.HeaderCell>
            </DataGrid.Row>
          </DataGrid.Header>
          <DataGrid.Body>
            <DataGrid.Row rowId="a">
              <DataGrid.Cell>One</DataGrid.Cell>
              <DataGrid.Cell>Two</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      expect(screen.getByRole('columnheader', { name: 'Skipped' })).toHaveAttribute(
        'data-focus-mode',
        'none',
      );
      expect(tabIndexOf(screen.getByRole('columnheader', { name: 'Kept' }))).toBe('0');
      focus(cell('One'));
      press(cell('One'), 'ArrowUp');
      expect(document.activeElement).toBe(screen.getByRole('columnheader', { name: 'Kept' }));
    });
  });

  it('types the cell modes', () => {
    expectTypeOf<DataGridCellFocusMode>().toEqualTypeOf<'cell' | 'group' | 'none'>();
    expectTypeOf<DataGridCellProps['focusMode']>().toEqualTypeOf<
      DataGridCellFocusMode | undefined
    >();
    expectTypeOf<DataGridHeaderCellProps['focusMode']>().toEqualTypeOf<
      DataGridCellFocusMode | undefined
    >();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Grid roleCellMode="none" nameCellMode="group" />);
    await expectNoA11yViolations(container);
  });
});
