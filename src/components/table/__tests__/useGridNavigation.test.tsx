import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isTextEntryElement, useGridNavigation } from '../useGridNavigation';
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

const cell = (id: string) => screen.getByTestId(id);
const headerCell = (name: string) => screen.getByRole('columnheader', { name });

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
