import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isTextEntryElement, returnFocusToGridCell, useGridNavigation } from '../useGridNavigation';
import type {
  GridNavigationModel,
  UseGridNavigationOptions,
  UseGridNavigationResult,
} from '../../../index';
import { useRovingTabIndex } from '../../../hooks/useRovingTabIndex';
import { getTabbableElements } from '../../../lib/focus';
import { renderWithProviders } from '../../../test-utils';
import { countTabIndexWrites, flushObservers } from './tabIndexWrites';

const COLUMNS = ['A', 'B', 'C'];

interface HarnessProps {
  rows?: number;
  onEdit?: () => void;
  extraRow?: boolean;
  onGridKeyDown?: React.KeyboardEventHandler<HTMLTableElement>;
  /** `onKeyDown` of the r2c2 text input. */
  onNoteKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** The body row rendered `hidden`. */
  hiddenRow?: number;
}

/**
 * A raw grid: a header row (A, B, C) and `rows` body rows of text cells `r<row>c<column>`, except:
 * r1c2 holds one button, r2c2 one text input, r3c2 two buttons.
 */
function Harness({
  rows = 5,
  onEdit,
  extraRow = false,
  onGridKeyDown,
  onNoteKeyDown,
  hiddenRow,
}: HarnessProps) {
  const { gridRef, gridProps } = useGridNavigation({ pageSize: 2 });
  const renderCell = (row: number, column: number) => {
    if (row === 1 && column === 2) {
      return (
        <button type="button" onClick={onEdit}>
          Edit 1
        </button>
      );
    }
    if (row === 2 && column === 2) {
      return <input aria-label="Note 2" defaultValue="hello" onKeyDown={onNoteKeyDown} />;
    }
    if (row === 3 && column === 2) {
      return (
        <>
          <button type="button">One</button>
          <button type="button">Two</button>
        </>
      );
    }
    return `r${row}c${column}`;
  };
  return (
    <table
      role="grid"
      aria-label="Harness"
      ref={gridRef}
      {...gridProps}
      onKeyDown={(event) => {
        onGridKeyDown?.(event);
        gridProps.onKeyDown(event);
      }}
    >
      <thead>
        <tr>
          {COLUMNS.map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, index) => index + 1).map((row) => (
          <tr key={row} hidden={row === hiddenRow}>
            {[1, 2, 3].map((column) => (
              <td key={column} data-testid={`r${row}c${column}`}>
                {renderCell(row, column)}
              </td>
            ))}
          </tr>
        ))}
        {extraRow && (
          <tr>
            <td data-testid="extra">
              <button type="button">Added</button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Toolbar's item selector (P01): the stand-in below uses the same roving options as Toolbar. */
const TOOLBAR_ITEM_SELECTOR =
  'button, [href], input, select, textarea, [role="button"], [tabindex]';

/**
 * Stand-in for Toolbar (another package): the F3 roving hook with Toolbar's options. It manages its
 * items' tabindex itself through a MutationObserver (`manageTabIndex`).
 */
function RovingToolbar({ children }: { children: React.ReactNode }) {
  const { containerProps } = useRovingTabIndex({
    itemSelector: TOOLBAR_ITEM_SELECTOR,
    manageTabIndex: true,
    tabStop: 'last-focused',
  });
  return (
    <div role="toolbar" aria-label="Row actions" {...containerProps}>
      {children}
    </div>
  );
}

/** Two rows: a name cell and an actions cell holding a roving toolbar. */
function CompositeHarness() {
  const { gridRef, gridProps } = useGridNavigation();
  return (
    <table role="grid" aria-label="Composite" ref={gridRef} {...gridProps}>
      <tbody>
        {['Alice', 'Bob'].map((name) => (
          <tr key={name}>
            <td data-testid={`${name}-name`}>{name}</td>
            <td data-testid={`${name}-actions`}>
              <RovingToolbar>
                <button type="button">Edit {name}</button>
                <button type="button">Delete {name}</button>
              </RovingToolbar>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** `rows` rows of a text cell, a checkbox cell and a button cell. */
function LargeHarness({ rows }: { rows: number }) {
  const { gridRef, gridProps } = useGridNavigation();
  return (
    <table role="grid" aria-label="Large" ref={gridRef} {...gridProps}>
      <tbody>
        {Array.from({ length: rows }, (_, index) => (
          <tr key={index}>
            <td data-testid={`large-${index}`}>Row {index}</td>
            <td>
              <input type="checkbox" aria-label={`Select ${index}`} />
            </td>
            <td>
              <button type="button">Open {index}</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface AuxiliaryHarnessProps {
  onSort?: () => void;
  /** `onKeyDown` of both separators. */
  onSeparatorKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}

/**
 * A header row with auxiliary widgets (`data-grid-auxiliary`), as a resizable DataGrid renders it:
 * Name holds a sort button and a separator, Size its text and a separator, Kind only text; one body
 * row below; and a button after the grid.
 */
function AuxiliaryHarness({ onSort, onSeparatorKeyDown }: AuxiliaryHarnessProps) {
  const { gridRef, gridProps } = useGridNavigation();
  const separator = (name: string) => (
    <div
      role="separator"
      aria-label={`Resize ${name}`}
      aria-orientation="vertical"
      aria-valuenow={150}
      tabIndex={0}
      data-grid-auxiliary=""
      onKeyDown={onSeparatorKeyDown}
    />
  );
  return (
    <>
      <table role="grid" aria-label="Files" ref={gridRef} {...gridProps}>
        <thead>
          <tr>
            <th scope="col" data-testid="name-header">
              <button type="button" onClick={onSort}>
                Name
              </button>
              {separator('Name')}
            </th>
            <th scope="col" data-testid="size-header">
              Size
              {separator('Size')}
            </th>
            <th scope="col">Kind</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid="alpha-name">Alpha</td>
            <td data-testid="alpha-size">12</td>
            <td>File</td>
          </tr>
        </tbody>
      </table>
      <button type="button">After</button>
    </>
  );
}

/** What a test does to a {@link WindowedHarness}'s window. */
interface WindowedHandle {
  /** Moves the window to start at row `start`, as the user's scrolling does. */
  scrollTo: (start: number) => void;
  /** Applies the last `scrollToRow` request (with `deferScroll`). */
  applyScroll: () => void;
}

interface WindowedHarnessProps {
  /** `model.rowCount`. @default 1000 */
  rowCount?: number;
  /** A header row above the data rows (`model.headerRowCount` 1, else 0). @default true */
  header?: boolean;
  /**
   * The rows kept mounted outside the window, as DataGrid keeps them (R12): `'both'` the hook's
   * active and pending rows, `'active'` only the active one, `'none'` neither.
   * @default 'both'
   */
  keep?: 'both' | 'active' | 'none';
  /** `scrollToRow` only records the request; `handle.applyScroll()` moves the window. */
  deferScroll?: boolean;
  onScrollToRow?: (index: number) => void;
  handle?: React.Ref<WindowedHandle>;
}

/** Rows the window shows (from its start). */
const WINDOW_SIZE = 20;

/** The window start that shows row `index` with the least movement (as `align: 'auto'` does). */
function startShowing(start: number, index: number, rowCount: number): number {
  let next = start;
  if (index < start) next = index;
  else if (index >= start + WINDOW_SIZE) next = index - WINDOW_SIZE + 1;
  return Math.max(0, Math.min(next, rowCount - WINDOW_SIZE));
}

/**
 * A windowed grid as DataGrid renders one: a header row (Name, Size, Open) and, of `rowCount` data
 * rows, the rows `start..start + 19` and the kept rows outside them, each with `data-row-index`
 * (text cells `r<index>c1` and `r<index>c2`, and `r<index>c3` holding the button "Open <index>"),
 * with an `aria-hidden` spacer row in each gap. Its `scrollToRow` moves the window to show the row
 * (a re-render). The table shows the hook's `activeRowIndex` and `pendingRowIndex` as
 * `data-active-row` and `data-pending-row` (`none` for `null`); a button follows the grid.
 */
function WindowedHarness({
  rowCount = 1000,
  header = true,
  keep = 'both',
  deferScroll = false,
  onScrollToRow,
  handle,
}: WindowedHarnessProps) {
  const [start, setStart] = React.useState(0);
  const [requested, setRequested] = React.useState<number | null>(null);
  const { gridRef, gridProps, activeRowIndex, pendingRowIndex } = useGridNavigation({
    pageSize: 10,
    model: {
      rowCount,
      headerRowCount: header ? 1 : 0,
      scrollToRow: (index) => {
        onScrollToRow?.(index);
        if (deferScroll) setRequested(index);
        else setStart((current) => startShowing(current, index, rowCount));
      },
    },
  });
  React.useImperativeHandle(
    handle,
    () => ({
      scrollTo: setStart,
      applyScroll: () => {
        if (requested !== null) setStart((current) => startShowing(current, requested, rowCount));
      },
    }),
    [requested, rowCount],
  );

  const first = Math.max(0, Math.min(start, rowCount - WINDOW_SIZE));
  const indexes = new Set<number>();
  for (let index = first; index < Math.min(first + WINDOW_SIZE, rowCount); index += 1) {
    indexes.add(index);
  }
  const kept =
    keep === 'both' ? [activeRowIndex, pendingRowIndex] : keep === 'active' ? [activeRowIndex] : [];
  for (const index of kept) if (index !== null && index < rowCount) indexes.add(index);

  const body: React.ReactNode[] = [];
  let next = 0;
  for (const index of [...indexes].sort((a, b) => a - b)) {
    if (index > next) {
      body.push(
        <tr key={`gap-${next}`} aria-hidden="true">
          <td colSpan={3} />
        </tr>,
      );
    }
    body.push(
      <tr key={index} data-row-index={index}>
        <td data-testid={`r${index}c1`}>Name {index}</td>
        <td data-testid={`r${index}c2`}>Size {index}</td>
        <td data-testid={`r${index}c3`}>
          <button type="button">Open {index}</button>
        </td>
      </tr>,
    );
    next = index + 1;
  }
  if (next < rowCount) {
    body.push(
      <tr key={`gap-${next}`} aria-hidden="true">
        <td colSpan={3} />
      </tr>,
    );
  }

  return (
    <>
      <table
        role="grid"
        aria-label="Windowed"
        ref={gridRef}
        {...gridProps}
        data-active-row={activeRowIndex ?? 'none'}
        data-pending-row={pendingRowIndex ?? 'none'}
      >
        {header && (
          <thead>
            <tr>
              {['Name', 'Size', 'Open'].map((name) => (
                <th key={name} scope="col">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{body}</tbody>
      </table>
      <button type="button">After</button>
    </>
  );
}

/** The `data-row-index` of the row that holds the focused element. */
const focusedRowIndex = () =>
  document.activeElement?.closest('tr')?.getAttribute('data-row-index') ?? null;

const cell = (id: string) => screen.getByTestId(id);
const headerCell = (name: string) => screen.getByRole('columnheader', { name });
const sortButton = () => screen.getByRole('button', { name: 'Name' });
const separatorOf = (name: string) => screen.getByRole('separator', { name: `Resize ${name}` });

function focus(el: HTMLElement) {
  act(() => el.focus());
}

describe('useGridNavigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tab stop', () => {
    it('keeps exactly one tab stop, on the first cell initially', () => {
      render(<Harness />);
      const grid = screen.getByRole('grid');
      const stops = grid.querySelectorAll('[tabindex="0"]');
      expect(stops).toHaveLength(1);
      expect(stops[0]).toBe(headerCell('A'));
      expect(cell('r1c1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('button', { name: 'Edit 1' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('textbox', { name: 'Note 2' })).toHaveAttribute('tabindex', '-1');
      for (const row of screen.getAllByRole('row')) expect(row).not.toHaveAttribute('tabindex');
    });

    it('is a single stop in the Tab sequence', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Harness />
          <button type="button">After</button>
        </>,
      );
      focus(screen.getByRole('button', { name: 'Before' }));
      await user.tab();
      expect(headerCell('A')).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(headerCell('A')).toHaveFocus();
    });

    it('moves the tab stop with focus', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r1c1'));
      await user.keyboard('{ArrowDown}');
      expect(cell('r2c1')).toHaveFocus();
      expect(cell('r2c1')).toHaveAttribute('tabindex', '0');
      expect(cell('r1c1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('grid').querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });

    it('uses a cell’s only non-text widget as its focus target', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r1c1'));
      await user.keyboard('{ArrowRight}');
      const edit = screen.getByRole('button', { name: 'Edit 1' });
      expect(edit).toHaveFocus();
      expect(edit).toHaveAttribute('tabindex', '0');
      expect(cell('r1c2')).not.toHaveAttribute('tabindex');
    });

    it('covers rows added later and falls back to the first cell when the active cell goes away', async () => {
      const { rerender } = render(<Harness rows={3} />);
      focus(cell('r3c3'));
      rerender(<Harness rows={3} extraRow />);
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Added' })).toHaveAttribute('tabindex', '-1');

      rerender(<Harness rows={2} />);
      await act(async () => {});
      expect(headerCell('A')).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('grid').querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });
  });

  describe('navigation keys', () => {
    it.each([
      ['{ArrowRight}', 'r2c1', 'r2c2'],
      ['{ArrowLeft}', 'r2c3', 'r2c2'],
      ['{ArrowDown}', 'r1c1', 'r2c1'],
      ['{ArrowUp}', 'r3c1', 'r2c1'],
      ['{Home}', 'r4c3', 'r4c1'],
      ['{End}', 'r4c1', 'r4c3'],
      ['{Control>}{End}{/Control}', 'r1c1', 'r5c3'],
      ['{PageDown}', 'r1c3', 'r3c3'],
      ['{PageUp}', 'r5c3', 'r3c3'],
      ['{PageDown}', 'r4c1', 'r5c1'],
    ])('%s moves from %s to %s', async (keys, from, to) => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell(from));
      await user.keyboard(keys);
      expect(cell(to)).toHaveFocus();
    });

    it('Ctrl+Home moves to the first cell of the grid', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r4c3'));
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(headerCell('A')).toHaveFocus();
    });

    it('ArrowUp from the first body row reaches the header row', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r1c3'));
      await user.keyboard('{ArrowUp}');
      expect(headerCell('C')).toHaveFocus();
    });

    it('stops at the edges and still prevents the default (no page scroll)', () => {
      render(<Harness />);
      focus(cell('r5c3'));
      expect(fireEvent.keyDown(cell('r5c3'), { key: 'ArrowRight' })).toBe(false);
      expect(fireEvent.keyDown(cell('r5c3'), { key: 'ArrowDown' })).toBe(false);
      expect(cell('r5c3')).toHaveFocus();
      focus(headerCell('A'));
      expect(fireEvent.keyDown(headerCell('A'), { key: 'ArrowLeft' })).toBe(false);
      expect(fireEvent.keyDown(headerCell('A'), { key: 'ArrowUp' })).toBe(false);
      expect(headerCell('A')).toHaveFocus();
    });

    it('keeps the visual column over cells that span rows or columns (the table model)', async () => {
      const user = userEvent.setup();
      function Spanned() {
        const { gridRef, gridProps } = useGridNavigation({ pageSize: 2 });
        return (
          <table role="grid" aria-label="Teams" ref={gridRef} {...gridProps}>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="colgroup" colSpan={2}>
                  Member
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowSpan={2} data-testid="team-a">
                  Team A
                </td>
                <td data-testid="alice">Alice</td>
                <td data-testid="alice-role">Engineer</td>
              </tr>
              <tr>
                <td data-testid="bob">Bob</td>
                <td data-testid="bob-role">Designer</td>
              </tr>
              <tr>
                <td data-testid="team-b">Team B</td>
                <td data-testid="carol">Carol</td>
                <td data-testid="carol-role">Manager</td>
              </tr>
            </tbody>
          </table>
        );
      }
      render(<Spanned />);
      // A cell spanning rows is the cell above and below each row it covers.
      focus(cell('team-b'));
      await user.keyboard('{ArrowUp}');
      expect(cell('team-a')).toHaveFocus();
      // Down from it leaves the rows it covers.
      await user.keyboard('{ArrowDown}');
      expect(cell('team-b')).toHaveFocus();
      // Cells after a row-spanning cell keep their visual column.
      focus(cell('carol'));
      await user.keyboard('{ArrowUp}');
      expect(cell('bob')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(cell('alice')).toHaveFocus();
      focus(cell('bob-role'));
      await user.keyboard('{ArrowDown}');
      expect(cell('carol-role')).toHaveFocus();
      // A cell spanning columns is entered at any column it covers and left from its first one.
      await user.keyboard('{PageUp}');
      expect(cell('alice-role')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(headerCell('Member')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(cell('alice')).toHaveFocus();
    });

    it('mirrors ArrowLeft/ArrowRight in RTL', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Harness />, { dir: 'rtl' });
      focus(cell('r4c2'));
      await user.keyboard('{ArrowLeft}');
      expect(cell('r4c3')).toHaveFocus();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(cell('r4c1')).toHaveFocus();
    });

    it('ignores keys with Alt or Meta held, other keys, and keys a handler already handled', () => {
      render(<Harness onGridKeyDown={(event) => event.key === 'End' && event.preventDefault()} />);
      focus(cell('r1c1'));
      expect(fireEvent.keyDown(cell('r1c1'), { key: 'ArrowDown', altKey: true })).toBe(true);
      expect(fireEvent.keyDown(cell('r1c1'), { key: 'ArrowDown', metaKey: true })).toBe(true);
      expect(fireEvent.keyDown(cell('r1c1'), { key: 'ArrowDown', ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(cell('r1c1'), { key: 'a' })).toBe(true);
      fireEvent.keyDown(cell('r1c1'), { key: 'End' });
      expect(cell('r1c1')).toHaveFocus();
    });
  });

  describe('widgets', () => {
    it('leaves Enter and Space on a target widget to the widget', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      render(<Harness onEdit={onEdit} />);
      const edit = screen.getByRole('button', { name: 'Edit 1' });
      focus(edit);
      expect(fireEvent.keyDown(edit, { key: 'Enter' })).toBe(true);
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onEdit).toHaveBeenCalledTimes(2);
      await user.keyboard('{ArrowDown}');
      expect(cell('r2c2')).toHaveFocus();
    });

    it('never targets a text input: the cell takes focus, Enter enters, Escape returns', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r2c1'));
      await user.keyboard('{ArrowRight}');
      const note = screen.getByRole('textbox', { name: 'Note 2' });
      expect(cell('r2c2')).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(note).toHaveFocus();
      expect(note).toHaveAttribute('tabindex', '0');

      await user.keyboard('{Escape}');
      expect(cell('r2c2')).toHaveFocus();
      expect(cell('r2c2')).toHaveAttribute('tabindex', '0');
      expect(note).toHaveAttribute('tabindex', '-1');
    });

    it('leaves an Escape the widget handled (preventDefault) to the widget: focus stays in it', async () => {
      const user = userEvent.setup();
      // Like a combobox that closes its open list on the first Escape (C-POPUPS).
      let listOpen = true;
      render(
        <Harness
          onNoteKeyDown={(event) => {
            if (event.key !== 'Escape' || !listOpen) return;
            listOpen = false;
            event.preventDefault();
          }}
        />,
      );
      focus(cell('r2c2'));
      await user.keyboard('{Enter}');
      const note = screen.getByRole('textbox', { name: 'Note 2' });
      expect(note).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(note).toHaveFocus();
      expect(note).toHaveAttribute('tabindex', '0');
      expect(cell('r2c2')).toHaveAttribute('tabindex', '-1');
      // The next Escape is not handled by the widget: back to the cell.
      await user.keyboard('{Escape}');
      expect(cell('r2c2')).toHaveFocus();
      expect(note).toHaveAttribute('tabindex', '-1');
    });

    it('F2 enters the cell’s widget too', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r2c2'));
      await user.keyboard('{F2}');
      expect(screen.getByRole('textbox', { name: 'Note 2' })).toHaveFocus();
    });

    it('Left/Right inside an edited input move the caret, not the cell', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r2c2'));
      await user.keyboard('{Enter}');
      const note = screen.getByRole<HTMLInputElement>('textbox', { name: 'Note 2' });
      note.setSelectionRange(5, 5);
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(note).toHaveFocus();
      expect(note.selectionStart).toBe(3);
      await user.keyboard('{ArrowRight}');
      expect(note).toHaveFocus();
      expect(note.selectionStart).toBe(4);
      await user.keyboard('{ArrowDown}{Home}');
      expect(note).toHaveFocus();
    });

    it('clicking into a text input enters interaction mode', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const note = screen.getByRole<HTMLInputElement>('textbox', { name: 'Note 2' });
      await user.click(note);
      note.setSelectionRange(2, 2);
      await user.keyboard('{ArrowRight}');
      expect(note).toHaveFocus();
      expect(note.selectionStart).toBe(3);
      expect(fireEvent.keyDown(note, { key: 'ArrowUp' })).toBe(true);
    });

    it('a cell with several widgets takes focus itself; Tab moves between its widgets while inside', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      focus(cell('r3c1'));
      await user.keyboard('{ArrowRight}');
      expect(cell('r3c2')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: 'One' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(cell('r3c2')).toHaveFocus();
      expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('tabindex', '-1');
    });

    it('leaving the grid ends interaction mode', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Harness />
          <button type="button">After</button>
        </>,
      );
      focus(cell('r2c2'));
      await user.keyboard('{Enter}');
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(cell('r2c2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('textbox', { name: 'Note 2' })).toHaveAttribute('tabindex', '-1');
    });

    it('Enter on a cell without widgets does nothing', () => {
      render(<Harness />);
      focus(cell('r1c1'));
      expect(fireEvent.keyDown(cell('r1c1'), { key: 'Enter' })).toBe(true);
      expect(cell('r1c1')).toHaveFocus();
    });
  });

  describe('widgets that cannot take focus', () => {
    it('skips a disabled widget and an author tabindex="-1" (opt-out): their cells are the targets', async () => {
      const user = userEvent.setup();
      function Unfocusable() {
        const { gridRef, gridProps } = useGridNavigation();
        return (
          <table role="grid" aria-label="Actions" ref={gridRef} {...gridProps}>
            <tbody>
              <tr>
                <td data-testid="name">Alice</td>
                <td data-testid="delete">
                  <button type="button" disabled>
                    Delete
                  </button>
                </td>
                <td data-testid="profile">
                  <a href="#profile" tabIndex={-1}>
                    Profile
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        );
      }
      render(<Unfocusable />);
      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      const profile = screen.getByRole('link', { name: 'Profile' });
      // Not widgets: the grid gives their cells a tab index and leaves them alone.
      expect(cell('delete')).toHaveAttribute('tabindex', '-1');
      expect(deleteButton).not.toHaveAttribute('tabindex');
      expect(cell('profile')).toHaveAttribute('tabindex', '-1');

      focus(cell('name'));
      await user.keyboard('{ArrowRight}');
      expect(cell('delete')).toHaveFocus();
      expect(cell('delete')).toHaveAttribute('tabindex', '0');
      expect(deleteButton).not.toHaveAttribute('tabindex');
      await user.keyboard('{ArrowRight}');
      expect(cell('profile')).toHaveFocus();
      expect(profile).toHaveAttribute('tabindex', '-1');
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([cell('profile')]);
      // An opted-out element is not a widget of its cell: Enter has nothing to enter.
      expect(fireEvent.keyDown(cell('profile'), { key: 'Enter' })).toBe(true);
      expect(cell('profile')).toHaveFocus();
    });

    it('moves the tab stop to the cell while its lone widget is disabled, and back once enabled', async () => {
      const user = userEvent.setup();
      function Saving({ disabled }: { disabled: boolean }) {
        const { gridRef, gridProps } = useGridNavigation();
        return (
          <>
            <table role="grid" aria-label="Saving" ref={gridRef} {...gridProps}>
              <tbody>
                <tr>
                  <td data-testid="name">Alice</td>
                  <td data-testid="save">
                    <button type="button" disabled={disabled}>
                      Save
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="button">After</button>
          </>
        );
      }
      const { rerender } = render(<Saving disabled={false} />);
      const grid = screen.getByRole('grid');
      const save = screen.getByRole('button', { name: 'Save' });
      focus(cell('name'));
      await user.keyboard('{ArrowRight}');
      expect(save).toHaveFocus();
      focus(screen.getByRole('button', { name: 'After' }));

      rerender(<Saving disabled />);
      await flushObservers();
      // The grid's only Tab stop is never a control that cannot take focus.
      expect(getTabbableElements(grid)).toEqual([cell('save')]);

      rerender(<Saving disabled={false} />);
      await flushObservers();
      expect(getTabbableElements(grid)).toEqual([save]);
      expect(cell('save')).not.toHaveAttribute('tabindex');
      await user.tab({ shift: true });
      expect(save).toHaveFocus();

      // A cell that does not hold the tab stop is re-synced too: while its button is disabled, the
      // cell takes its place (focusable, e.g. by a click), and gives it back once enabled.
      focus(cell('name'));
      rerender(<Saving disabled />);
      await flushObservers();
      expect(cell('save')).toHaveAttribute('tabindex', '-1');
      rerender(<Saving disabled={false} />);
      await flushObservers();
      expect(cell('save')).not.toHaveAttribute('tabindex');
      expect(save).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('hidden rows', () => {
    it('skips a hidden row', async () => {
      const user = userEvent.setup();
      render(<Harness hiddenRow={3} />);
      expect(cell('r3c1')).not.toHaveAttribute('tabindex');
      focus(cell('r2c1'));
      await user.keyboard('{ArrowDown}');
      expect(cell('r4c1')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(cell('r2c1')).toHaveFocus();
    });

    it('moves the tab stop to the first cell when the active cell’s row is hidden', async () => {
      const { rerender } = render(<Harness />);
      focus(cell('r3c1'));
      expect(cell('r3c1')).toHaveAttribute('tabindex', '0');
      rerender(<Harness hiddenRow={3} />);
      await flushObservers();
      const stops = screen.getByRole('grid').querySelectorAll('[tabindex="0"]');
      expect(stops).toHaveLength(1);
      expect(stops[0]).toBe(headerCell('A'));
    });
  });

  describe('nested composites', () => {
    it('never writes tabindex inside a roving composite that manages its own (no write loop)', async () => {
      const writes = countTabIndexWrites();
      render(<CompositeHarness />);
      await flushObservers();
      expect(writes.count()).toBeLessThan(50);
      for (const toolbar of screen.getAllByRole('toolbar')) {
        expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      }
    });

    it('treats the composite as one widget: arrows reach its cell, Enter enters it, Escape returns', async () => {
      const user = userEvent.setup();
      const writes = countTabIndexWrites();
      render(<CompositeHarness />);
      await flushObservers();
      focus(cell('Alice-name'));
      await user.keyboard('{ArrowRight}');
      expect(cell('Alice-actions')).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: 'Edit Alice' })).toHaveFocus();
      // Interaction mode: the composite keeps its arrow keys.
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: 'Delete Alice' })).toHaveFocus();
      await flushObservers();
      const toolbar = screen.getAllByRole('toolbar')[0];
      expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Delete Alice' })).toHaveAttribute('tabindex', '0');

      await user.keyboard('{Escape}');
      expect(cell('Alice-actions')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(cell('Bob-actions')).toHaveFocus();
      await flushObservers();
      expect(writes.count()).toBeLessThan(80);
      for (const each of screen.getAllByRole('toolbar')) {
        expect(each.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      }
    });
  });

  describe('auxiliary widgets (data-grid-auxiliary)', () => {
    it('leaves them out of a cell’s target and at tabindex="-1" in navigation mode', () => {
      render(<AuxiliaryHarness />);
      const grid = screen.getByRole('grid');
      // The sort button stays the target of its cell: the separator beside it does not count.
      expect(sortButton()).toHaveAttribute('tabindex', '0');
      expect(cell('name-header')).not.toHaveAttribute('tabindex');
      // A cell whose only widget is auxiliary is its own target.
      expect(cell('size-header')).toHaveAttribute('tabindex', '-1');
      // The separators render tabIndex 0, and the grid still has one Tab stop.
      expect(separatorOf('Name')).toHaveAttribute('tabindex', '-1');
      expect(separatorOf('Size')).toHaveAttribute('tabindex', '-1');
      expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      expect(getTabbableElements(grid)).toEqual([sortButton()]);
    });

    it('reaches the target widget with the arrow keys; Enter on it reaches the widget', async () => {
      const user = userEvent.setup();
      const onSort = vi.fn();
      render(<AuxiliaryHarness onSort={onSort} />);
      focus(cell('alpha-name'));
      await user.keyboard('{ArrowUp}');
      expect(sortButton()).toHaveFocus();
      expect(fireEvent.keyDown(sortButton(), { key: 'Enter' })).toBe(true);
      await user.keyboard('{Enter}');
      expect(onSort).toHaveBeenCalledTimes(1);
      expect(sortButton()).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(cell('size-header')).toHaveFocus();
    });

    it('F2 on the target widget enters the auxiliary widget, where the grid keys are off; Escape returns', async () => {
      const user = userEvent.setup();
      render(<AuxiliaryHarness />);
      const grid = screen.getByRole('grid');
      focus(cell('alpha-name'));
      await user.keyboard('{ArrowUp}');
      expect(fireEvent.keyDown(sortButton(), { key: 'F2' })).toBe(false);
      expect(separatorOf('Name')).toHaveFocus();
      expect(separatorOf('Name')).toHaveAttribute('tabindex', '0');

      // Interaction mode: the keys are left to the separator.
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'Home', 'End', 'F2']) {
        expect(fireEvent.keyDown(separatorOf('Name'), { key })).toBe(true);
      }
      await user.keyboard('{ArrowRight}{ArrowDown}');
      expect(separatorOf('Name')).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(sortButton()).toHaveFocus();
      expect(separatorOf('Name')).toHaveAttribute('tabindex', '-1');
      expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      // Navigation mode again.
      await user.keyboard('{ArrowDown}');
      expect(cell('alpha-name')).toHaveFocus();
    });

    it('a cell whose only widget is auxiliary: Enter and F2 both enter it, Escape returns to the cell', async () => {
      const user = userEvent.setup();
      render(<AuxiliaryHarness />);
      focus(cell('alpha-size'));
      await user.keyboard('{ArrowUp}');
      expect(cell('size-header')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(separatorOf('Size')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(cell('size-header')).toHaveFocus();
      await user.keyboard('{F2}');
      expect(separatorOf('Size')).toHaveFocus();
      expect(cell('size-header')).toHaveAttribute('tabindex', '-1');
      await user.keyboard('{Escape}');
      expect(cell('size-header')).toHaveFocus();
      expect(cell('size-header')).toHaveAttribute('tabindex', '0');
      expect(separatorOf('Size')).toHaveAttribute('tabindex', '-1');
    });

    it('Tab in interaction mode moves between the cell’s widgets, its target included', async () => {
      const user = userEvent.setup();
      render(<AuxiliaryHarness />);
      focus(cell('alpha-name'));
      await user.keyboard('{ArrowUp}{F2}');
      expect(separatorOf('Name')).toHaveFocus();

      await user.tab({ shift: true });
      expect(sortButton()).toHaveFocus();
      // Still interaction mode: the grid keys stay off and the separator stays reachable.
      expect(separatorOf('Name')).toHaveAttribute('tabindex', '0');
      expect(fireEvent.keyDown(sortButton(), { key: 'ArrowRight' })).toBe(true);
      expect(sortButton()).toHaveFocus();
      await user.tab();
      expect(separatorOf('Name')).toHaveFocus();
      await user.tab({ shift: true });
      // Escape on the target widget ends interaction mode, focus staying there.
      await user.keyboard('{Escape}');
      expect(sortButton()).toHaveFocus();
      expect(separatorOf('Name')).toHaveAttribute('tabindex', '-1');
      await user.keyboard('{ArrowRight}');
      expect(cell('size-header')).toHaveFocus();

      // Tab past the cell’s last widget leaves the grid and ends interaction mode.
      await user.keyboard('{ArrowLeft}{F2}');
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(separatorOf('Name')).toHaveAttribute('tabindex', '-1');
      expect(sortButton()).toHaveAttribute('tabindex', '0');
    });

    it('returnFocusToGridCell returns from a widget that handles Escape and Enter itself', async () => {
      const user = userEvent.setup();
      // Like Table.ResizeHandle with `onLeave`: the keys never reach the grid.
      const onSeparatorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        returnFocusToGridCell(event.currentTarget);
      };
      render(<AuxiliaryHarness onSeparatorKeyDown={onSeparatorKeyDown} />);
      const grid = screen.getByRole('grid');
      focus(cell('alpha-name'));
      await user.keyboard('{ArrowUp}{F2}');
      expect(separatorOf('Name')).toHaveFocus();
      await user.keyboard('{Enter}');
      // To the cell's target widget, in navigation mode.
      expect(sortButton()).toHaveFocus();
      expect(separatorOf('Name')).toHaveAttribute('tabindex', '-1');
      expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

      await user.keyboard('{ArrowRight}{Enter}');
      expect(separatorOf('Size')).toHaveFocus();
      await user.keyboard('{Escape}');
      // To the cell, which is its own target.
      expect(cell('size-header')).toHaveFocus();
      expect(cell('size-header')).toHaveAttribute('tabindex', '0');
      await user.keyboard('{ArrowDown}');
      expect(cell('alpha-size')).toHaveFocus();
    });

    it('returnFocusToGridCell does nothing for an element in no grid of the hook', () => {
      render(<AuxiliaryHarness />);
      const after = screen.getByRole('button', { name: 'After' });
      focus(after);
      expect(returnFocusToGridCell(after)).toBe(false);
      expect(after).toHaveFocus();
      expect(returnFocusToGridCell(separatorOf('Size'))).toBe(true);
      expect(cell('size-header')).toHaveFocus();
    });

    it('leaves F2 on a target widget alone in a cell without auxiliary widgets (0.15)', () => {
      render(<Harness />);
      const edit = screen.getByRole('button', { name: 'Edit 1' });
      focus(edit);
      expect(fireEvent.keyDown(edit, { key: 'F2' })).toBe(true);
      expect(edit).toHaveFocus();
    });
  });

  describe('performance', () => {
    // It counts style reads and tab-index writes, not time; rendering the 200-row grid takes more
    // than Vitest's 5 s default under a loaded CI runner, hence the 20 s timeout.
    it('re-syncs only the cells focus moves between, not the whole grid', async () => {
      const user = userEvent.setup();
      render(<LargeHarness rows={200} />);
      const checkbox = screen.getByRole('checkbox', { name: 'Select 1' });
      focus(cell('large-0'));
      await flushObservers();
      const styleReads = vi.spyOn(window, 'getComputedStyle');
      const writes = countTabIndexWrites();
      await user.keyboard('{ArrowDown}{ArrowRight}');
      await flushObservers();
      // Counted before any role query (which reads styles itself).
      const reads = styleReads.mock.calls.length;
      expect(checkbox).toHaveFocus();
      // Two key presses over a 200-row grid (400 widgets): a full re-sync would read styles
      // thousands of times; re-syncing the cells involved reads them a few dozen times.
      expect(reads).toBeLessThan(100);
      expect(writes.count()).toBeLessThan(10);
    }, 20_000);

    it('still covers widgets added to a cell later', async () => {
      function Growing({ extra }: { extra: boolean }) {
        const { gridRef, gridProps } = useGridNavigation();
        return (
          <table role="grid" aria-label="Growing" ref={gridRef} {...gridProps}>
            <tbody>
              <tr>
                <td data-testid="first">First</td>
                <td data-testid="second">{extra && <button type="button">Late</button>}</td>
              </tr>
            </tbody>
          </table>
        );
      }
      const { rerender } = render(<Growing extra={false} />);
      rerender(<Growing extra />);
      await flushObservers();
      expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('tabindex', '-1');
      expect(cell('second')).not.toHaveAttribute('tabindex');
    });

    it('keeps a focused cell focusable when a widget becomes its target, until focus leaves it', async () => {
      const user = userEvent.setup();
      function Growing({ extra }: { extra: boolean }) {
        const { gridRef, gridProps } = useGridNavigation();
        return (
          <>
            <button type="button">Before</button>
            <table role="grid" aria-label="Growing" ref={gridRef} {...gridProps}>
              <tbody>
                <tr>
                  <td data-testid="first">First</td>
                  <td data-testid="second">{extra && <button type="button">Late</button>}</td>
                </tr>
              </tbody>
            </table>
            <button type="button">After</button>
          </>
        );
      }
      const { rerender } = render(<Growing extra={false} />);
      focus(cell('second'));
      expect(cell('second')).toHaveAttribute('tabindex', '0');

      rerender(<Growing extra />);
      await flushObservers();
      const late = screen.getByRole('button', { name: 'Late' });
      // Removing the focused cell's tabindex would blur it in a browser (focus goes to the body).
      expect(cell('second')).toHaveFocus();
      // The focused cell keeps the grid's only Tab stop (even if focus were lost without a
      // focusout), so Tab leaves the grid: its new target is not a further stop inside.
      expect(cell('second')).toHaveAttribute('tabindex', '0');
      expect(late).toHaveAttribute('tabindex', '-1');
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([cell('second')]);

      // The grid keys still work from the cell; leaving it drops its tabindex.
      await user.keyboard('{ArrowLeft}');
      expect(cell('first')).toHaveFocus();
      expect(cell('second')).not.toHaveAttribute('tabindex');
      expect(late).toHaveAttribute('tabindex', '-1');

      // Leaving the grid from such a cell drops it too.
      await user.keyboard('{ArrowRight}');
      expect(late).toHaveFocus();
      rerender(<Growing extra={false} />);
      await flushObservers();
      focus(cell('second'));
      rerender(<Growing extra />);
      await flushObservers();
      expect(cell('second')).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('grid').querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(cell('second')).not.toHaveAttribute('tabindex');
      expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('tabindex', '0');

      // Shift+Tab from such a cell leaves the grid backwards (nothing before it inside is a stop).
      rerender(<Growing extra={false} />);
      await flushObservers();
      focus(cell('second'));
      rerender(<Growing extra />);
      await flushObservers();
      expect(cell('second')).toHaveFocus();
      expect(cell('second')).toHaveAttribute('tabindex', '0');
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
      expect(cell('second')).not.toHaveAttribute('tabindex');
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([
        screen.getByRole('button', { name: 'Late' }),
      ]);
    });
  });

  describe('model (rows by their data index)', () => {
    const grid = () => screen.getByRole('grid');
    const handleRef = () => React.createRef<WindowedHandle>();
    /** Every element of the grid that is in the Tab order. */
    const tabStops = () => grid().querySelectorAll('[tabindex="0"]');

    it('Ctrl+End asks the model once for the last row, then focuses its last cell in the commit that mounts it', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      render(<WindowedHarness onScrollToRow={onScrollToRow} />);
      focus(cell('r5c1'));
      await user.keyboard('{Control>}{End}{/Control}');
      expect(onScrollToRow).toHaveBeenCalledTimes(1);
      expect(onScrollToRow).toHaveBeenCalledWith(999);
      expect(focusedRowIndex()).toBe('999');
      expect(screen.getByRole('button', { name: 'Open 999' })).toHaveFocus();
      expect(tabStops()).toHaveLength(1);
      expect(grid()).toHaveAttribute('data-active-row', '999');
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
    });

    it('calls scrollToRow once per request in StrictMode', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      render(
        <React.StrictMode>
          <WindowedHarness onScrollToRow={onScrollToRow} />
        </React.StrictMode>,
      );
      focus(cell('r5c1'));
      await user.keyboard('{Control>}{End}{/Control}');
      expect(onScrollToRow.mock.calls).toEqual([[999]]);
      expect(screen.getByRole('button', { name: 'Open 999' })).toHaveFocus();
    });

    it('PageDown and PageUp move pageSize rows of the data, scrolling only to a row that is not mounted', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      render(<WindowedHarness onScrollToRow={onScrollToRow} />);
      focus(cell('r10c1'));
      await user.keyboard('{PageDown}');
      expect(onScrollToRow.mock.calls).toEqual([[20]]);
      expect(cell('r20c1')).toHaveFocus();
      // Row 10 is still mounted (the window shows rows 1 to 20): no scroll.
      await user.keyboard('{PageUp}');
      expect(onScrollToRow).toHaveBeenCalledTimes(1);
      expect(cell('r10c1')).toHaveFocus();
      // Above the first data row is the header row, as without a model.
      focus(cell('r5c2'));
      await user.keyboard('{PageUp}');
      expect(headerCell('Size')).toHaveFocus();
      expect(onScrollToRow).toHaveBeenCalledTimes(1);
    });

    it('PageDown near the end stops at the last row', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      render(<WindowedHarness onScrollToRow={onScrollToRow} handle={handle} />);
      act(() => handle.current!.scrollTo(980));
      // The observer stamps the cells of the rows the scroll mounted.
      await flushObservers();
      focus(cell('r995c2'));
      await user.keyboard('{PageDown}');
      expect(cell('r999c2')).toHaveFocus();
      expect(onScrollToRow).not.toHaveBeenCalled();
    });

    it('ArrowDown at the last mounted row targets the next index and focuses it after the scroll', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      render(<WindowedHarness onScrollToRow={onScrollToRow} />);
      focus(cell('r19c2'));
      await user.keyboard('{ArrowDown}');
      expect(onScrollToRow.mock.calls).toEqual([[20]]);
      expect(cell('r20c2')).toHaveFocus();
      // The same column, also when its cell's target is a widget.
      await user.keyboard('{ArrowRight}{ArrowDown}');
      expect(screen.getByRole('button', { name: 'Open 21' })).toHaveFocus();
      expect(onScrollToRow.mock.calls).toEqual([[20], [21]]);
    });

    it('Ctrl+Home from the middle focuses the first cell of the grid and returns the window to the first row', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      render(<WindowedHarness onScrollToRow={onScrollToRow} handle={handle} />);
      act(() => handle.current!.scrollTo(490));
      await flushObservers();
      focus(cell('r500c2'));
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(headerCell('Name')).toHaveFocus();
      expect(onScrollToRow.mock.calls).toEqual([[0]]);
      expect(cell('r0c1')).toBeInTheDocument();
      expect(grid()).toHaveAttribute('data-active-row', 'none');
    });

    it('Ctrl+Home without a header row focuses the first cell of data row 0 after the scroll', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      render(<WindowedHarness header={false} onScrollToRow={onScrollToRow} handle={handle} />);
      act(() => handle.current!.scrollTo(490));
      await flushObservers();
      focus(cell('r500c2'));
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(onScrollToRow.mock.calls).toEqual([[0]]);
      expect(cell('r0c1')).toHaveFocus();
    });

    it('ArrowUp from data row 0 reaches the header, and ArrowDown from the header reaches data row 0 wherever the window is', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      render(<WindowedHarness onScrollToRow={onScrollToRow} handle={handle} />);
      focus(cell('r0c2'));
      await user.keyboard('{ArrowUp}');
      expect(headerCell('Size')).toHaveFocus();
      expect(grid()).toHaveAttribute('data-active-row', 'none');
      act(() => handle.current!.scrollTo(500));
      await flushObservers();
      expect(screen.queryByTestId('r0c2')).not.toBeInTheDocument();

      await user.keyboard('{ArrowDown}');
      expect(onScrollToRow.mock.calls).toEqual([[0]]);
      expect(cell('r0c2')).toHaveFocus();
    });

    it('ArrowDown at the last row and ArrowUp at row 0 without a header do nothing (and still prevent the default)', async () => {
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      const { unmount } = render(<WindowedHarness onScrollToRow={onScrollToRow} handle={handle} />);
      act(() => handle.current!.scrollTo(980));
      await flushObservers();
      focus(cell('r999c1'));
      expect(fireEvent.keyDown(cell('r999c1'), { key: 'ArrowDown' })).toBe(false);
      expect(fireEvent.keyDown(cell('r999c1'), { key: 'PageDown' })).toBe(false);
      expect(cell('r999c1')).toHaveFocus();
      unmount();

      render(<WindowedHarness header={false} onScrollToRow={onScrollToRow} />);
      focus(cell('r0c1'));
      expect(fireEvent.keyDown(cell('r0c1'), { key: 'ArrowUp' })).toBe(false);
      expect(fireEvent.keyDown(cell('r0c1'), { key: 'PageUp' })).toBe(false);
      expect(cell('r0c1')).toHaveFocus();
      expect(onScrollToRow).not.toHaveBeenCalled();
    });

    it('moves within the row with ArrowLeft/ArrowRight and Home/End as without a model', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      render(<WindowedHarness onScrollToRow={onScrollToRow} />);
      focus(cell('r7c1'));
      await user.keyboard('{End}');
      expect(screen.getByRole('button', { name: 'Open 7' })).toHaveFocus();
      await user.keyboard('{Home}');
      expect(cell('r7c1')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(cell('r7c2')).toHaveFocus();
      expect(onScrollToRow).not.toHaveBeenCalled();
    });

    it('leaves the spacer rows out: their cells get no tabindex', async () => {
      const handle = handleRef();
      render(<WindowedHarness handle={handle} />);
      const spacerCells = () => grid().querySelectorAll('tr[aria-hidden="true"] td');
      expect(spacerCells()).toHaveLength(1);
      act(() => handle.current!.scrollTo(500));
      await flushObservers();
      expect(spacerCells()).toHaveLength(2);
      for (const spacer of Array.from(spacerCells()))
        expect(spacer).not.toHaveAttribute('tabindex');
      expect(tabStops()).toHaveLength(1);
      expect(tabStops()[0]).toBe(headerCell('Name'));
    });

    it('activeRowIndex follows focus: the data row index, null on a header row', async () => {
      const user = userEvent.setup();
      render(<WindowedHarness />);
      expect(grid()).toHaveAttribute('data-active-row', 'none');
      focus(cell('r3c1'));
      expect(grid()).toHaveAttribute('data-active-row', '3');
      await user.keyboard('{ArrowRight}{ArrowDown}');
      expect(cell('r4c2')).toHaveFocus();
      expect(grid()).toHaveAttribute('data-active-row', '4');
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(grid()).toHaveAttribute('data-active-row', 'none');
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
    });

    it('pendingRowIndex holds the target until its row mounts; the focused row stays active meanwhile', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      render(
        <WindowedHarness keep="active" deferScroll onScrollToRow={onScrollToRow} handle={handle} />,
      );
      focus(cell('r4c1'));
      await user.keyboard('{Control>}{End}{/Control}');
      expect(onScrollToRow.mock.calls).toEqual([[999]]);
      expect(grid()).toHaveAttribute('data-pending-row', '999');
      expect(grid()).toHaveAttribute('data-active-row', '4');
      expect(cell('r4c1')).toHaveFocus();
      expect(Array.from(tabStops())).toEqual([cell('r4c1')]);

      act(() => handle.current!.applyScroll());
      expect(screen.getByRole('button', { name: 'Open 999' })).toHaveFocus();
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
      expect(grid()).toHaveAttribute('data-active-row', '999');
      expect(onScrollToRow).toHaveBeenCalledTimes(1);
    });

    it('two PageDown presses before the window moves go on from the first target: one scrollToRow per distinct target, the later one focused', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      render(
        <WindowedHarness keep="active" deferScroll onScrollToRow={onScrollToRow} handle={handle} />,
      );
      focus(cell('r10c1'));
      await user.keyboard('{PageDown}{PageDown}');
      expect(onScrollToRow.mock.calls).toEqual([[20], [30]]);
      expect(grid()).toHaveAttribute('data-pending-row', '30');

      act(() => handle.current!.applyScroll());
      expect(cell('r30c1')).toHaveFocus();
      expect(cell('r20c1')).toBeInTheDocument();
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
    });

    it('the same target requested twice calls scrollToRow once', async () => {
      const user = userEvent.setup();
      const onScrollToRow = vi.fn();
      const handle = handleRef();
      render(
        <WindowedHarness keep="active" deferScroll onScrollToRow={onScrollToRow} handle={handle} />,
      );
      focus(cell('r10c2'));
      await user.keyboard('{Control>}{End}{End}{/Control}');
      expect(onScrollToRow.mock.calls).toEqual([[999]]);
      act(() => handle.current!.applyScroll());
      expect(screen.getByRole('button', { name: 'Open 999' })).toHaveFocus();
    });

    it('a horizontal key while a row is pending moves in the focused row and drops the request', async () => {
      const user = userEvent.setup();
      const handle = handleRef();
      render(<WindowedHarness keep="active" deferScroll handle={handle} />);
      focus(cell('r10c1'));
      await user.keyboard('{PageDown}');
      expect(grid()).toHaveAttribute('data-pending-row', '20');
      await user.keyboard('{ArrowRight}');
      expect(cell('r10c2')).toHaveFocus();
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
      act(() => handle.current!.applyScroll());
      await flushObservers();
      expect(cell('r10c2')).toHaveFocus();
    });

    it('drops a pending row when the row count falls to it or below', async () => {
      const user = userEvent.setup();
      const handle = handleRef();
      const props = { keep: 'active', deferScroll: true, handle } as const;
      const { rerender } = render(<WindowedHarness {...props} />);
      focus(cell('r5c1'));
      await user.keyboard('{Control>}{End}{/Control}');
      expect(grid()).toHaveAttribute('data-pending-row', '999');
      rerender(<WindowedHarness {...props} rowCount={500} />);
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
      act(() => handle.current!.applyScroll());
      await flushObservers();
      expect(cell('r5c1')).toHaveFocus();
    });

    it('does not take focus back when it left the grid before the row mounted', async () => {
      const user = userEvent.setup();
      const handle = handleRef();
      render(<WindowedHarness keep="active" deferScroll handle={handle} />);
      focus(cell('r5c1'));
      await user.keyboard('{Control>}{End}{/Control}');
      const after = screen.getByRole('button', { name: 'After' });
      focus(after);
      act(() => handle.current!.applyScroll());
      await flushObservers();
      expect(after).toHaveFocus();
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
      // The tab stop stays where focus last was in the grid.
      expect(Array.from(tabStops())).toEqual([cell('r5c1')]);
    });

    it('keeps the focused row mounted through activeRowIndex while the window scrolls away and back', async () => {
      const handle = handleRef();
      render(<WindowedHarness handle={handle} />);
      focus(cell('r5c2'));
      act(() => handle.current!.scrollTo(500));
      await flushObservers();
      expect(cell('r5c2')).toHaveFocus();
      expect(cell('r500c2')).toBeInTheDocument();
      expect(Array.from(tabStops())).toEqual([cell('r5c2')]);
      act(() => handle.current!.scrollTo(0));
      await flushObservers();
      expect(cell('r5c2')).toHaveFocus();
      expect(Array.from(tabStops())).toEqual([cell('r5c2')]);
    });

    it('keeps exactly one tab stop while the active row is not mounted, in the nearest mounted row, and gives it back when the row mounts', async () => {
      const handle = handleRef();
      render(<WindowedHarness keep="none" handle={handle} />);
      focus(cell('r5c2'));
      act(() => handle.current!.scrollTo(500));
      await flushObservers();
      expect(screen.queryByTestId('r5c2')).not.toBeInTheDocument();
      // Not the first row of the grid: the active row's index is still in the data.
      expect(Array.from(tabStops())).toEqual([cell('r500c2')]);
      expect(grid()).toHaveAttribute('data-active-row', '5');

      act(() => handle.current!.scrollTo(0));
      await flushObservers();
      expect(Array.from(tabStops())).toEqual([cell('r5c2')]);
      expect(grid()).toHaveAttribute('data-active-row', '5');
    });

    it('follows the active row’s element when its index changes while it stays mounted', async () => {
      /**
       * Ten items keyed by id, shown at data rows `base..base + 9` under a spacer for the rows
       * above: items inserted above with the scroll anchored, as a window keyed by id renders it.
       */
      function Anchored({ base }: { base: number }) {
        const { gridRef, gridProps, activeRowIndex } = useGridNavigation({
          model: { rowCount: base + 10, headerRowCount: 0, scrollToRow: () => {} },
        });
        return (
          <table
            role="grid"
            aria-label="Anchored"
            ref={gridRef}
            {...gridProps}
            data-active-row={activeRowIndex ?? 'none'}
          >
            <tbody>
              <tr key="gap" aria-hidden="true">
                <td />
              </tr>
              {Array.from({ length: 10 }, (_, id) => (
                <tr key={id} data-row-index={base + id}>
                  <td data-testid={`item-${id}`}>Item {id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      const { rerender } = render(<Anchored base={10} />);
      focus(cell('item-5'));
      expect(grid()).toHaveAttribute('data-active-row', '15');
      rerender(<Anchored base={11} />);
      await flushObservers();
      expect(grid()).toHaveAttribute('data-active-row', '16');
      expect(cell('item-5')).toHaveFocus();
      expect(Array.from(tabStops())).toEqual([cell('item-5')]);
    });

    it('falls back to the first cell of the grid when the active row leaves the data', async () => {
      const handle = handleRef();
      const { rerender } = render(<WindowedHarness keep="none" handle={handle} />);
      act(() => handle.current!.scrollTo(980));
      await flushObservers();
      focus(cell('r990c1'));
      expect(grid()).toHaveAttribute('data-active-row', '990');
      rerender(<WindowedHarness keep="none" handle={handle} rowCount={100} />);
      await flushObservers();
      expect(Array.from(tabStops())).toEqual([headerCell('Name')]);
      expect(grid()).toHaveAttribute('data-active-row', 'none');
    });

    it('reports no row indexes without a model', async () => {
      const user = userEvent.setup();
      function Unmodelled() {
        const { gridRef, gridProps, activeRowIndex, pendingRowIndex } = useGridNavigation();
        return (
          <table
            role="grid"
            aria-label="Unmodelled"
            ref={gridRef}
            {...gridProps}
            data-active-row={activeRowIndex ?? 'none'}
            data-pending-row={pendingRowIndex ?? 'none'}
          >
            <tbody>
              {[0, 1].map((index) => (
                <tr key={index} data-row-index={index}>
                  <td data-testid={`plain-${index}`}>Row {index}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      render(<Unmodelled />);
      focus(cell('plain-0'));
      await user.keyboard('{ArrowDown}');
      expect(cell('plain-1')).toHaveFocus();
      expect(grid()).toHaveAttribute('data-active-row', 'none');
      expect(grid()).toHaveAttribute('data-pending-row', 'none');
    });

    it('types: the model option and the row indexes of the result, from the package entry', () => {
      expectTypeOf<UseGridNavigationOptions['model']>().toEqualTypeOf<
        GridNavigationModel | undefined
      >();
      expectTypeOf<GridNavigationModel['rowCount']>().toEqualTypeOf<number>();
      expectTypeOf<GridNavigationModel['headerRowCount']>().toEqualTypeOf<number>();
      expectTypeOf<GridNavigationModel['scrollToRow']>().parameters.toEqualTypeOf<[number]>();
      expectTypeOf<GridNavigationModel['scrollToRow']>().returns.toEqualTypeOf<void>();
      expectTypeOf<UseGridNavigationResult['activeRowIndex']>().toEqualTypeOf<number | null>();
      expectTypeOf<UseGridNavigationResult['pendingRowIndex']>().toEqualTypeOf<number | null>();
      // @ts-expect-error a model needs its row count
      const partial: GridNavigationModel = { headerRowCount: 1, scrollToRow: () => {} };
      expect(partial.headerRowCount).toBe(1);
    });
  });

  describe('isTextEntryElement', () => {
    it.each([
      ['<input>', true],
      ['<input type="search">', true],
      ['<input type="number">', true],
      ['<input type="email">', true],
      ['<textarea></textarea>', true],
      ['<select></select>', true],
      ['<div contenteditable="true"></div>', true],
      ['<div role="combobox"></div>', true],
      ['<input type="checkbox">', false],
      ['<input type="radio">', false],
      ['<button type="button"></button>', false],
      ['<a href="#x">x</a>', false],
      ['<div contenteditable="false"></div>', false],
    ])('%s → %s', (html, expected) => {
      const host = document.createElement('div');
      host.innerHTML = html;
      expect(isTextEntryElement(host.firstElementChild!)).toBe(expected);
    });
  });
});
