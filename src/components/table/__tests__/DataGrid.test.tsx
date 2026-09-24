import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
} from '../DataGrid';
import type {
  DataGridCellProps,
  DataGridColumn,
  DataGridProps,
  DataGridRowProps,
  DataGridSort,
  SortDirection,
} from '../DataGrid';
import { getTabbableElements } from '../../../lib/focus';
import { useRovingTabIndex } from '../../../hooks/useRovingTabIndex';
import {
  renderWithProviders,
  testCompoundExposure,
  testComposedHandler,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

interface Person {
  id: string;
  name: string;
  role: string;
}

const PEOPLE: Person[] = [
  { id: '1', name: 'Alice', role: 'Engineer' },
  { id: '2', name: 'Bob', role: 'Designer' },
  { id: '3', name: 'Carol', role: 'Manager' },
];

/** Header with two sortable columns and one plain column, plus one row per person. */
function gridContent(people: Person[] = PEOPLE) {
  return [
    <DataGrid.Header key="header">
      <tr>
        <DataGrid.HeaderCell columnId="name" sortable>
          Name
        </DataGrid.HeaderCell>
        <DataGrid.HeaderCell columnId="role" sortable>
          Role
        </DataGrid.HeaderCell>
        <DataGrid.HeaderCell columnId="notes">Notes</DataGrid.HeaderCell>
      </tr>
    </DataGrid.Header>,
    <DataGrid.Body key="body">
      {people.map((person) => (
        <DataGrid.Row key={person.id} rowId={person.id}>
          <DataGrid.Cell>{person.name}</DataGrid.Cell>
          <DataGrid.Cell>{person.role}</DataGrid.Cell>
          <DataGrid.Cell>-</DataGrid.Cell>
        </DataGrid.Row>
      ))}
    </DataGrid.Body>,
  ];
}

type GridTestProps = Omit<Record<string, unknown>, 'children'> & { children?: React.ReactNode };

function renderGrid(props: GridTestProps = {}, people: Person[] = PEOPLE) {
  return render(
    <DataGrid aria-label="People" {...props}>
      {props.children ?? gridContent(people)}
    </DataGrid>,
  );
}

function bodyRows(): HTMLElement[] {
  return screen
    .getAllByRole('row')
    .filter((row) => row.parentElement?.tagName.toLowerCase() === 'tbody');
}

function sortButton(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

function header(name: string): HTMLElement {
  return screen.getByRole('columnheader', { name });
}

/**
 * The data cell showing `text` (a selection cell is named after its row, so query the text);
 * `index` picks one of several cells with the same text, in document order.
 */
function cell(text: string, index?: number): HTMLElement {
  const el = index === undefined ? screen.getByText(text) : screen.getAllByText(text)[index];
  expect(el).toHaveAttribute('role', 'gridcell');
  return el;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataGrid', () => {
  testSystemProps(DataGrid, {
    expectedTag: 'table',
    displayName: 'DataGrid',
    defaultProps: { 'aria-label': 'People', children: gridContent() },
    conflictingClass: { className: 'border-collapse', overrides: 'border-separate' },
    a11yVariants: [
      {
        name: 'multiple selection',
        props: { selectionMode: 'multiple', defaultSelectedItems: ['1'] },
      },
      { name: 'single selection', props: { selectionMode: 'single', defaultSelectedItems: ['2'] } },
      { name: 'sorted', props: { defaultSort: { columnId: 'name', direction: 'descending' } } },
    ],
  });

  testCompoundExposure(DataGrid, ['Header', 'HeaderCell', 'Body', 'Row', 'Cell']);

  testNoImplicitSubmit(DataGrid, {
    defaultProps: { 'aria-label': 'People', children: gridContent() },
  });

  it('exports every sub-component under a flat name bound to the dotted member', () => {
    expect(DataGridHeader).toBe(DataGrid.Header);
    expect(DataGridHeaderCell).toBe(DataGrid.HeaderCell);
    expect(DataGridBody).toBe(DataGrid.Body);
    expect(DataGridRow).toBe(DataGrid.Row);
    expect(DataGridCell).toBe(DataGrid.Cell);
  });

  it('renders a table with role="grid"', () => {
    renderGrid({ 'data-testid': 'grid' });
    const table = screen.getByTestId('grid');
    expect(table.tagName.toLowerCase()).toBe('table');
    expect(table).toHaveAttribute('role', 'grid');
  });

  it('renders header cells and body cells', () => {
    renderGrid();
    expect(header('Name').tagName.toLowerCase()).toBe('th');
    expect(screen.getByText('Alice').tagName.toLowerCase()).toBe('td');
  });

  it('merges custom className', () => {
    renderGrid({ className: 'my-custom' });
    expect(screen.getByRole('grid')).toHaveClass('my-custom', 'w-full');
  });

  describe('aria-multiselectable', () => {
    it('is true in multiple selection mode', () => {
      renderGrid({ selectionMode: 'multiple' });
      expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
    });

    it.each(['single', 'none'])('is absent in %s selection mode', (selectionMode) => {
      renderGrid({ selectionMode });
      expect(screen.getByRole('grid')).not.toHaveAttribute('aria-multiselectable');
    });
  });

  describe('scroll container', () => {
    it('wraps the grid in a horizontally scrollable container that is not a tab stop', () => {
      renderGrid();
      const wrapper = screen.getByRole('grid').parentElement!;
      expect(wrapper).toHaveClass('overflow-x-auto', 'rounded-md', 'border', 'border-border');
      expect(wrapper).not.toHaveClass('overflow-hidden', 'rounded-lg');
      expect(wrapper).not.toHaveAttribute('tabindex');
      expect(wrapper).not.toHaveAttribute('role');
    });

    it('forwards containerProps (className, style, ref) to the wrapper', () => {
      const ref = React.createRef<HTMLDivElement>();
      renderGrid({
        containerProps: {
          className: 'max-w-md rounded-none',
          style: { maxHeight: 200 },
          'data-testid': 'wrapper',
          ref,
        },
      });
      const wrapper = screen.getByTestId('wrapper');
      expect(wrapper).toBe(screen.getByRole('grid').parentElement);
      expect(ref.current).toBe(wrapper);
      expect(wrapper).toHaveClass('max-w-md', 'rounded-none', 'overflow-x-auto');
      expect(wrapper).not.toHaveClass('rounded-md');
      expect(wrapper).toHaveStyle({ maxHeight: '200px' });
    });

    it('keeps a containerProps aria-label or aria-labelledby that comes with a role', () => {
      const { rerender } = renderGrid({
        containerProps: { role: 'region', 'aria-label': 'People, scrollable' },
      });
      const wrapper = screen.getByRole('grid').parentElement!;
      expect(screen.getByRole('region', { name: 'People, scrollable' })).toBe(wrapper);

      rerender(
        <>
          <h2 id="people-heading">Team</h2>
          <DataGrid
            aria-label="People"
            containerProps={{ role: 'group', 'aria-labelledby': 'people-heading' }}
          >
            {gridContent()}
          </DataGrid>
        </>,
      );
      expect(screen.getByRole('group', { name: 'Team' })).toBe(
        screen.getByRole('grid').parentElement,
      );
    });

    it('drops a containerProps aria-label without a role (the wrapper has none) and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderGrid({ containerProps: { 'aria-label': 'People wrapper', 'data-testid': 'wrapper' } });
      const wrapper = screen.getByTestId('wrapper');
      expect(wrapper).not.toHaveAttribute('aria-label');
      expect(wrapper).not.toHaveAttribute('role');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[WaveUI] DataGrid'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('role'));
    });
  });

  describe('context', () => {
    it.each([
      ['DataGrid.Row', <DataGrid.Row key="r">{null}</DataGrid.Row>],
      ['DataGrid.Header', <DataGrid.Header key="h">{null}</DataGrid.Header>],
      ['DataGrid.HeaderCell', <DataGrid.HeaderCell key="hc">Name</DataGrid.HeaderCell>],
    ])('%s used outside a DataGrid throws in development', (name, element) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        render(
          <table>
            <tbody>
              <tr>{element}</tr>
            </tbody>
          </table>,
        ),
      ).toThrow(`[WaveUI] ${name} must be used within DataGrid`);
    });
  });
});

describe('DataGrid sorting', () => {
  it('renders a sortable header as a button inside the columnheader', () => {
    renderGrid();
    const th = header('Name');
    const button = within(th).getByRole('button', { name: 'Name' });
    expect(button).toHaveAttribute('type', 'button');
    expect(th).toHaveAttribute('aria-sort', 'none');
    expect(th).not.toHaveAttribute('tabindex');
    expect(button).not.toHaveAttribute('aria-sort');
  });

  it('renders a non-sortable header without a button or aria-sort', () => {
    renderGrid();
    const th = header('Notes');
    expect(within(th).queryByRole('button')).toBeNull();
    expect(th).not.toHaveAttribute('aria-sort');
  });

  it('treats `sortable` without `columnId` as not sortable and warns', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSortChange = vi.fn();
    render(
      <DataGrid aria-label="People" onSortChange={onSortChange}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell sortable>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row>
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const th = header('Name');
    expect(within(th).queryByRole('button')).toBeNull();
    expect(th).not.toHaveAttribute('aria-sort');
    await user.click(th);
    expect(onSortChange).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[WaveUI] DataGrid.HeaderCell'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('columnId'));
  });

  it('applies aria-sort from defaultSort', () => {
    renderGrid({ defaultSort: { columnId: 'name', direction: 'descending' } });
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    expect(header('Role')).toHaveAttribute('aria-sort', 'none');
  });

  it('applies aria-sort from the deprecated defaultSortColumn/defaultSortDirection and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ defaultSortColumn: 'name', defaultSortDirection: 'ascending' });
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('`defaultSortColumn` is deprecated and will be removed in 1.0'),
    );
  });

  it('calls onSortChange with the 0.4 arguments (columnId, direction) without sort/defaultSort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ onSortChange });
    await user.click(sortButton('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'ascending');
  });

  it('calls onSortChange with a DataGridSort object when sort or defaultSort is given', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ defaultSort: null, onSortChange });
    await user.click(sortButton('Name'));
    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith({ columnId: 'name', direction: 'ascending' });
  });

  it('toggles the direction on repeated clicks and updates aria-sort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ onSortChange });

    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(onSortChange.mock.calls).toEqual([
      ['name', 'ascending'],
      ['name', 'descending'],
      ['name', 'ascending'],
    ]);
  });

  it('resets to ascending when switching to another column', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ defaultSort: { columnId: 'name', direction: 'ascending' }, onSortChange });

    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    await user.click(sortButton('Role'));
    expect(header('Role')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'role', direction: 'ascending' });
  });

  it('sorts with Enter and Space on the sort button', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ onSortChange });

    sortButton('Name').focus();
    await user.keyboard('{Enter}');
    expect(onSortChange).toHaveBeenLastCalledWith('name', 'ascending');
    await user.keyboard(' ');
    expect(onSortChange).toHaveBeenLastCalledWith('name', 'descending');
    expect(onSortChange).toHaveBeenCalledTimes(2);
  });

  it('follows a controlled sort and reports every click when the parent ignores it', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const { rerender } = renderGrid({
      sort: { columnId: 'name', direction: 'ascending' },
      onSortChange,
    });
    await user.click(sortButton('Name'));
    await user.click(sortButton('Name'));
    // The parent did not accept the change: the rendered sort stays, every click reports.
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(onSortChange.mock.calls).toEqual([
      [{ columnId: 'name', direction: 'descending' }],
      [{ columnId: 'name', direction: 'descending' }],
    ]);

    rerender(
      <DataGrid
        aria-label="People"
        sort={{ columnId: 'role', direction: 'descending' }}
        onSortChange={onSortChange}
      >
        {gridContent()}
      </DataGrid>,
    );
    expect(header('Role')).toHaveAttribute('aria-sort', 'descending');
    expect(header('Name')).toHaveAttribute('aria-sort', 'none');
  });

  it('round-trips a controlled sort owned by the parent', async () => {
    const user = userEvent.setup();
    function Parent() {
      const [sort, setSort] = React.useState<DataGridSort | null>(null);
      return (
        <DataGrid aria-label="People" sort={sort} onSortChange={setSort}>
          {gridContent()}
        </DataGrid>
      );
    }
    render(<Parent />);
    await user.click(sortButton('Role'));
    expect(header('Role')).toHaveAttribute('aria-sort', 'ascending');
    await user.click(sortButton('Role'));
    expect(header('Role')).toHaveAttribute('aria-sort', 'descending');
  });

  it('clears a controlled sort that becomes undefined (deprecated sortColumn alias)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = renderGrid({ sortColumn: 'name', sortDirection: 'descending' });
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    rerender(
      <DataGrid aria-label="People" sortColumn={undefined} sortDirection={undefined}>
        {gridContent()}
      </DataGrid>,
    );
    expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('changing from controlled to uncontrolled'),
    );
  });

  it('honours a controlled sort that arrives after mount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = renderGrid({ sort: undefined });
    expect(header('Role')).toHaveAttribute('aria-sort', 'none');
    expect(warn).not.toHaveBeenCalled();
    rerender(
      <DataGrid aria-label="People" sort={{ columnId: 'role', direction: 'ascending' }}>
        {gridContent()}
      </DataGrid>,
    );
    expect(header('Role')).toHaveAttribute('aria-sort', 'ascending');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('changing from uncontrolled to controlled'),
    );
  });

  it('warns when the sort API and the deprecated sortColumn/sortDirection are mixed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ sort: { columnId: 'name', direction: 'ascending' }, sortColumn: 'role' });
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mix'));
  });

  it('calls onSortChange once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <React.StrictMode>
        <DataGrid aria-label="People" defaultSort={null} onSortChange={onSortChange}>
          {gridContent()}
        </DataGrid>
      </React.StrictMode>,
    );
    await user.click(sortButton('Name'));
    expect(onSortChange).toHaveBeenCalledTimes(1);
  });

  it('does not re-render the rows when the sort changes', async () => {
    const user = userEvent.setup();
    const commits: string[] = [];
    const onRender: React.ProfilerOnRenderCallback = (id, phase) => {
      if (phase !== 'mount') commits.push(id);
    };
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          {PEOPLE.map((person) => (
            <React.Profiler key={person.id} id={`row-${person.id}`} onRender={onRender}>
              <DataGrid.Row rowId={person.id}>
                <DataGrid.Cell>{person.name}</DataGrid.Cell>
              </DataGrid.Row>
            </React.Profiler>
          ))}
        </DataGrid.Body>
      </DataGrid>,
    );
    commits.length = 0;
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(commits).toEqual([]);
  });
});

describe('DataGrid header from columns', () => {
  const columns: DataGridColumn[] = [
    { id: 'name', label: 'Name', sortable: true },
    { id: 'role', label: 'Role' },
  ];

  function rows() {
    return (
      <DataGrid.Body>
        {PEOPLE.map((person) => (
          <DataGrid.Row key={person.id} rowId={person.id}>
            <DataGrid.Cell>{person.name}</DataGrid.Cell>
            <DataGrid.Cell>{person.role}</DataGrid.Cell>
          </DataGrid.Row>
        ))}
      </DataGrid.Body>
    );
  }

  it('renders the header from `columns` when no DataGrid.Header child is given', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataGrid aria-label="People" columns={columns} onSortChange={onSortChange}>
        {rows()}
      </DataGrid>,
    );
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Role',
    ]);
    expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    expect(within(header('Role')).queryByRole('button')).toBeNull();
    await user.click(sortButton('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'ascending');
  });

  it('includes the selection header cell', () => {
    render(
      <DataGrid aria-label="People" columns={columns} selectionMode="multiple">
        {rows()}
      </DataGrid>,
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    expect(within(headers[0]).getByRole('checkbox', { name: 'Select all rows' })).toBeVisible();
    expect(within(bodyRows()[0]).getAllByRole('gridcell')).toHaveLength(3);
  });

  it('prefers a DataGrid.Header child over `columns`', () => {
    render(
      <DataGrid aria-label="People" columns={columns}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Custom</DataGrid.HeaderCell>
            <DataGrid.HeaderCell>Header</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        {rows()}
      </DataGrid>,
    );
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Custom',
      'Header',
    ]);
  });
});

describe('DataGrid selection', () => {
  it.each([
    ['none', 3],
    ['single', 4],
    ['multiple', 4],
  ])('has as many columnheaders as row cells in %s mode', (selectionMode, count) => {
    renderGrid({ selectionMode });
    expect(screen.getAllByRole('columnheader')).toHaveLength(count);
    for (const row of bodyRows()) {
      expect(within(row).getAllByRole('gridcell')).toHaveLength(count);
    }
  });

  it('adds the selection header cell to a header row built from DataGrid.Row', () => {
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <DataGrid.Row>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </DataGrid.Row>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
    expect(headers[1]).toHaveTextContent('Name');
    expect(screen.getAllByRole('row')[0]).not.toHaveAttribute('aria-selected');
  });

  it('adds the selection header cell to a header row inside a Fragment', () => {
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <>
            <tr>
              <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
            </tr>
          </>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(within(bodyRows()[0]).getAllByRole('gridcell')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeVisible();
  });

  it('warns when a selectable header row has no selection header cell (a custom row component)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function HeaderRow() {
      return (
        <tr>
          <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
        </tr>
      );
    }
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <HeaderRow />
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[WaveUI] DataGrid.Header'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DataGrid.Row'));
  });

  it('does not warn about the selection header cell for the supported header rows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ selectionMode: 'single' });
    render(
      <DataGrid aria-label="Built from rows" selectionMode="multiple">
        <DataGrid.Header>
          <DataGrid.Row>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </DataGrid.Row>
        </DataGrid.Header>
      </DataGrid>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  describe('changing selectionMode', () => {
    function ModeGrid({ selectionMode }: { selectionMode: 'none' | 'single' | 'multiple' }) {
      return (
        <DataGrid aria-label="People" selectionMode={selectionMode}>
          <DataGrid.Header>
            <tr>
              <DataGrid.HeaderCell columnId="name" sortable>
                Name
              </DataGrid.HeaderCell>
              <DataGrid.HeaderCell>Note</DataGrid.HeaderCell>
            </tr>
          </DataGrid.Header>
          <DataGrid.Body>
            <DataGrid.Row rowId="1">
              <DataGrid.Cell>Alice</DataGrid.Cell>
              <DataGrid.Cell>
                <input aria-label="Note" />
              </DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>
      );
    }

    it.each([
      ['none', 'multiple'],
      ['multiple', 'none'],
      ['none', 'single'],
      ['single', 'multiple'],
    ] as const)('keeps body cells mounted (node, value, focus) from %s to %s', async (from, to) => {
      const user = userEvent.setup();
      const { rerender } = render(<ModeGrid selectionMode={from} />);
      const input = screen.getByRole('textbox', { name: 'Note' });
      await user.click(input);
      await user.keyboard('typed');
      rerender(<ModeGrid selectionMode={to} />);
      const after = screen.getByRole('textbox', { name: 'Note' });
      expect(after).toBe(input);
      expect(after).toHaveValue('typed');
      expect(after).toHaveFocus();
    });

    it.each([
      ['none', 'multiple'],
      ['multiple', 'none'],
    ] as const)('keeps header cells mounted from %s to %s', (from, to) => {
      const { rerender } = render(<ModeGrid selectionMode={from} />);
      const button = sortButton('Name');
      act(() => button.focus());
      rerender(<ModeGrid selectionMode={to} />);
      expect(sortButton('Name')).toBe(button);
      expect(button).toHaveFocus();
    });
  });

  it('renders a "Select all rows" checkbox in the multiple-mode header', () => {
    renderGrid({ selectionMode: 'multiple' });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll.closest('th')).toBe(screen.getAllByRole('columnheader')[0]);
    expect(selectAll).not.toBeChecked();
  });

  it('renders a visually hidden "Selection" header in single mode', () => {
    renderGrid({ selectionMode: 'single' });
    const th = screen.getAllByRole('columnheader')[0];
    expect(th).toHaveTextContent('Selection');
    expect(within(th).getByText('Selection')).toHaveClass('sr-only');
  });

  it('names each row checkbox after the row’s first cell', () => {
    renderGrid({ selectionMode: 'multiple' });
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Bob' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /Select row/ })).toBeNull();
  });

  it('uses selectionLabel as the control name', () => {
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Body>
          <DataGrid.Row rowId="1" selectionLabel="Select Alice Johnson">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(screen.getByRole('checkbox', { name: 'Select Alice Johnson' })).toBeInTheDocument();
  });

  it('keeps a first cell’s own id as the label reference', () => {
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell id="alice-name">Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toHaveAttribute(
      'aria-labelledby',
      'alice-name',
    );
  });

  it('groups single-mode radios under one shared name', () => {
    renderGrid({ selectionMode: 'single' });
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    const name = radios[0].getAttribute('name');
    expect(name).toBeTruthy();
    for (const radio of radios) expect(radio).toHaveAttribute('name', name!);
  });

  it('gives two grids different radio group names', () => {
    render(
      <>
        <DataGrid aria-label="First" selectionMode="single">
          {gridContent()}
        </DataGrid>
        <DataGrid aria-label="Second" selectionMode="single">
          {gridContent()}
        </DataGrid>
      </>,
    );
    const [first, second] = screen.getAllByRole('grid');
    expect(within(first).getAllByRole('radio')[0].getAttribute('name')).not.toBe(
      within(second).getAllByRole('radio')[0].getAttribute('name'),
    );
  });

  it('renders no selection control for a row without rowId, keeps the column, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Body>
          <DataGrid.Row>
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const row = bodyRows()[0];
    expect(within(row).queryByRole('checkbox', { name: /Alice|undefined/ })).toBeNull();
    expect(within(row).getAllByRole('gridcell')).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rowId'));
  });

  it('uses the theme accent color for the native controls', () => {
    renderGrid({ selectionMode: 'multiple' });
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toHaveClass('accent-primary');
    }
  });

  it('calls onSelectedItemsChange with an array when a row checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1']);
    await user.click(screen.getByRole('checkbox', { name: 'Carol' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '3']);
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'true');
    expect(bodyRows()[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('still calls the deprecated onSelectionChange with a Set, and warns', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSelectionChange = vi.fn();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectionChange, onSelectedItemsChange });
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['2']);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(['2']));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`onSelectionChange` is deprecated'));
  });

  it.each([
    ['a Set', new Set(['1'])],
    ['an array', ['1']],
  ])('accepts the deprecated selectedKeys as %s', (_label, selectedKeys) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ selectionMode: 'multiple', selectedKeys });
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'true');
    expect(bodyRows()[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('accepts the deprecated defaultSelectedKeys and warns about the deprecated names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ selectionMode: 'multiple', defaultSelectedKeys: new Set(['3']) });
    expect(bodyRows()[2]).toHaveAttribute('aria-selected', 'true');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'DataGrid: `defaultSelectedKeys` is deprecated and will be removed in 1.0. Use `defaultSelectedItems` instead.',
      ),
    );
  });

  it('marks the selected row with data-selected and the selected token', () => {
    renderGrid({ selectionMode: 'multiple', defaultSelectedItems: ['2'] });
    const row = bodyRows()[1];
    expect(row).toHaveAttribute('data-selected');
    expect(row).toHaveClass('data-[selected]:bg-selected');
    expect(bodyRows()[0]).not.toHaveAttribute('data-selected');
  });

  it('replaces the selection in single mode', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'single', onSelectedItemsChange });
    await user.click(screen.getByRole('radio', { name: 'Alice' }));
    await user.click(screen.getByRole('radio', { name: 'Bob' }));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['1']], [['2']]]);
    expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Alice' })).not.toBeChecked();
  });

  it('select-all selects every row, then clears', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });

    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3']);
    expect(selectAll).toBeChecked();
    expect(bodyRows().every((row) => row.getAttribute('aria-selected') === 'true')).toBe(true);

    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([]);
    expect(selectAll).not.toBeChecked();
  });

  it('shows a partial selection as indeterminate and selects all from it', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', defaultSelectedItems: ['2'], onSelectedItemsChange });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll).toBePartiallyChecked();
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3']);
    expect(selectAll).not.toBePartiallyChecked();
    expect(selectAll).toBeChecked();
  });

  it('toggles the row with Space on a focused cell', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    const bob = cell('Bob');
    act(() => bob.focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2']);
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([]);
  });

  it('toggles once with Space on the row checkbox', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    act(() => screen.getByRole('checkbox', { name: 'Alice' }).focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1']);
  });

  it('deselects the selected row with Space in single mode', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'single', defaultSelectedItems: ['1'], onSelectedItemsChange });
    act(() => cell('Alice').focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenCalledWith([]);
  });

  describe('nested controls', () => {
    function renderWithWidgets(onSelectedItemsChange: (items: string[]) => void) {
      const onAction = vi.fn();
      render(
        <DataGrid
          aria-label="People"
          selectionMode="multiple"
          onSelectedItemsChange={onSelectedItemsChange}
        >
          <DataGrid.Body>
            <DataGrid.Row rowId="1">
              <DataGrid.Cell>Alice</DataGrid.Cell>
              <DataGrid.Cell>
                <button type="button" onClick={onAction}>
                  Edit
                </button>
              </DataGrid.Cell>
              <DataGrid.Cell>
                <input aria-label="Note" defaultValue="" />
              </DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      return onAction;
    }

    it.each(['Enter', ' '])(
      '%j on a nested button activates it without toggling or preventDefault',
      (key) => {
        const onSelectedItemsChange = vi.fn();
        renderWithWidgets(onSelectedItemsChange);
        const button = screen.getByRole('button', { name: 'Edit' });
        act(() => button.focus());
        expect(fireEvent.keyDown(button, { key })).toBe(true);
        expect(onSelectedItemsChange).not.toHaveBeenCalled();
        expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'false');
      },
    );

    it('Space and Enter typed in a nested input are not swallowed and do not toggle', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      renderWithWidgets(onSelectedItemsChange);
      const input = screen.getByRole('textbox', { name: 'Note' });
      await user.click(input);
      expect(fireEvent.keyDown(input, { key: ' ' })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
      await user.keyboard('a b');
      expect(input).toHaveValue('a b');
      expect(onSelectedItemsChange).not.toHaveBeenCalled();
    });

    it('a nested button keeps working with the keyboard', async () => {
      const user = userEvent.setup();
      const onAction = renderWithWidgets(vi.fn());
      act(() => screen.getByRole('button', { name: 'Edit' }).focus());
      await user.keyboard('{Enter}');
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  it('round-trips a controlled selection and reports every click when the parent ignores it', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const { rerender } = renderGrid({
      selectionMode: 'multiple',
      selectedItems: [],
      onSelectedItemsChange,
    });
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['1']], [['1']]]);
    expect(screen.getByRole('checkbox', { name: 'Alice' })).not.toBeChecked();

    rerender(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        selectedItems={['3']}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        {gridContent()}
      </DataGrid>,
    );
    expect(screen.getByRole('checkbox', { name: 'Carol' })).toBeChecked();
    expect(bodyRows()[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('clears a controlled selection that becomes undefined', () => {
    const { rerender } = renderGrid({ selectionMode: 'multiple', selectedItems: ['1', '2'] });
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeChecked();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rerender(
      <DataGrid aria-label="People" selectionMode="multiple" selectedItems={undefined}>
        {gridContent()}
      </DataGrid>,
    );
    expect(screen.getByRole('checkbox', { name: 'Alice' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).not.toBeChecked();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('changing from controlled to uncontrolled'),
    );
  });

  it('honours a controlled selection that arrives after mount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = renderGrid({ selectionMode: 'multiple', selectedItems: undefined });
    rerender(
      <DataGrid aria-label="People" selectionMode="multiple" selectedItems={['2']}>
        {gridContent()}
      </DataGrid>,
    );
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('changing from uncontrolled to controlled'),
    );
  });

  it('calls onSelectedItemsChange once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <DataGrid
          aria-label="People"
          selectionMode="multiple"
          onSelectedItemsChange={onSelectedItemsChange}
        >
          {gridContent()}
        </DataGrid>
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
  });

  it('drops removed rows from the selection (select-all state and the next change)', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const { rerender } = renderGrid({
      selectionMode: 'multiple',
      defaultSelectedItems: ['1', '2'],
      onSelectedItemsChange,
    });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll).toBePartiallyChecked();

    // Carol is removed: Alice and Bob — every remaining row — are selected.
    const remaining = PEOPLE.slice(0, 2);
    rerender(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        defaultSelectedItems={['1', '2']}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        {gridContent(remaining)}
      </DataGrid>,
    );
    expect(selectAll).toBeChecked();

    // Bob is removed while selected: the next change no longer reports him.
    rerender(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        defaultSelectedItems={['1', '2']}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        {gridContent(PEOPLE.filter((person) => person.id !== '2'))}
      </DataGrid>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Carol' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '3']);
  });

  it('shows a removed row selected again when it is re-added before the next change (uncontrolled)', () => {
    const { rerender } = renderGrid({ selectionMode: 'multiple', defaultSelectedItems: ['2'] });
    const withoutBob = PEOPLE.filter((person) => person.id !== '2');
    rerender(
      <DataGrid aria-label="People" selectionMode="multiple" defaultSelectedItems={['2']}>
        {gridContent(withoutBob)}
      </DataGrid>,
    );
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).not.toBePartiallyChecked();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).not.toBeChecked();
    rerender(
      <DataGrid aria-label="People" selectionMode="multiple" defaultSelectedItems={['2']}>
        {gridContent()}
      </DataGrid>,
    );
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
  });

  it('re-renders only the toggled row', async () => {
    const user = userEvent.setup();
    const commits: string[] = [];
    const onRender: React.ProfilerOnRenderCallback = (id, phase) => {
      if (phase !== 'mount') commits.push(id);
    };
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Body>
          {PEOPLE.map((person) => (
            <React.Profiler key={person.id} id={`row-${person.id}`} onRender={onRender}>
              <DataGrid.Row rowId={person.id}>
                <DataGrid.Cell>{person.name}</DataGrid.Cell>
              </DataGrid.Row>
            </React.Profiler>
          ))}
        </DataGrid.Body>
      </DataGrid>,
    );
    commits.length = 0;
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    expect(new Set(commits)).toEqual(new Set(['row-2']));
  });
});

describe('DataGrid context stability', () => {
  it('keeps memoized rows untouched when the parent re-renders with new inline callbacks', async () => {
    const user = userEvent.setup();
    const commits: string[] = [];
    const onRender: React.ProfilerOnRenderCallback = (id, phase) => {
      if (phase !== 'mount') commits.push(id);
    };
    const MemoRows = React.memo(function MemoRows() {
      return PEOPLE.map((person) => (
        <React.Profiler key={person.id} id={`row-${person.id}`} onRender={onRender}>
          <DataGrid.Row rowId={person.id}>
            <DataGrid.Cell>{person.name}</DataGrid.Cell>
          </DataGrid.Row>
        </React.Profiler>
      ));
    });
    function Parent() {
      const [count, setCount] = React.useState(0);
      return (
        <>
          <button type="button" onClick={() => setCount(count + 1)}>
            Re-render {count}
          </button>
          <DataGrid
            aria-label="People"
            selectionMode="multiple"
            defaultSort={null}
            onSortChange={(sort) => void [sort, count]}
            onSelectedItemsChange={(items) => void [items, count]}
          >
            <DataGrid.Body>
              <MemoRows />
            </DataGrid.Body>
          </DataGrid>
        </>
      );
    }
    render(<Parent />);
    commits.length = 0;
    await user.click(screen.getByRole('button', { name: /Re-render/ }));
    await user.click(screen.getByRole('button', { name: /Re-render/ }));
    expect(screen.getByRole('button', { name: 'Re-render 2' })).toBeInTheDocument();
    expect(commits).toEqual([]);
  });
});

describe('DataGrid grid keyboard model', () => {
  it('rows are not tab stops and the grid has a single tab stop', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <DataGrid aria-label="People" selectionMode="multiple">
          {gridContent()}
        </DataGrid>
        <button type="button">After</button>
      </>,
    );
    for (const row of screen.getAllByRole('row')) expect(row).not.toHaveAttribute('tabindex');
    const grid = screen.getByRole('grid');
    expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    act(() => screen.getByRole('button', { name: 'Before' }).focus());
    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('moves between header and body cells with the arrow keys', async () => {
    const user = userEvent.setup();
    renderGrid();
    act(() => sortButton('Name').focus());
    await user.keyboard('{ArrowDown}');
    expect(cell('Alice')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(cell('Engineer')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(sortButton('Role')).toHaveFocus();
    // The tab stop follows focus.
    expect(sortButton('Role')).toHaveAttribute('tabindex', '0');
    expect(sortButton('Name')).toHaveAttribute('tabindex', '-1');
  });

  it('mirrors ArrowLeft/ArrowRight in RTL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DataGrid aria-label="People">{gridContent()}</DataGrid>, { dir: 'rtl' });
    act(() => cell('Engineer').focus());
    await user.keyboard('{ArrowLeft}');
    expect(cell('-', 0)).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(cell('Alice')).toHaveFocus();
  });

  it('focuses the selection checkbox cell target and leaves Space to the checkbox', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    act(() => cell('Alice').focus());
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1']);
  });

  describe('single selection radios', () => {
    function renderSingle(onSelectedItemsChange = vi.fn()) {
      render(
        <>
          <DataGrid
            aria-label="People"
            selectionMode="single"
            defaultSelectedItems={['1']}
            onSelectedItemsChange={onSelectedItemsChange}
          >
            {gridContent()}
          </DataGrid>
          <button type="button">After</button>
        </>,
      );
      return onSelectedItemsChange;
    }

    const selectionCell = (name: string) => screen.getByRole('radio', { name }).closest('td')!;

    it('keeps one tabbable element after focus leaves an unchecked radio’s cell', async () => {
      const user = userEvent.setup();
      renderSingle();
      act(() => cell('Bob').focus());
      await user.keyboard('{ArrowLeft}');
      // Alice's radio is checked: Bob's unchecked radio is not a sequential stop, so the cell is.
      expect(selectionCell('Bob')).toHaveFocus();
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveAttribute('tabindex', '-1');

      act(() => screen.getByRole('button', { name: 'After' }).focus());
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([selectionCell('Bob')]);
    });

    it('selects the row with Space on that cell, then targets the checked radio', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = renderSingle();
      act(() => cell('Bob').focus());
      await user.keyboard('{ArrowLeft} ');
      await act(async () => {});
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2']);
      expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();
      // jsdom never blurs an element that loses its tabindex, so the grid keys below would still
      // reach the cell even if it had lost it: check that it is still focusable first.
      expect(selectionCell('Bob')).toHaveFocus();
      expect(selectionCell('Bob')).toHaveAttribute('tabindex', '0');

      await user.keyboard('{ArrowRight}{ArrowLeft}');
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveFocus();
      act(() => screen.getByRole('button', { name: 'After' }).focus());
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([
        screen.getByRole('radio', { name: 'Bob' }),
      ]);
    });

    it('keeps the focused cell focusable when Space on it checks its radio', async () => {
      const user = userEvent.setup();
      renderSingle();
      act(() => cell('Bob').focus());
      await user.keyboard('{ArrowLeft}');
      expect(selectionCell('Bob')).toHaveFocus();
      expect(selectionCell('Bob')).toHaveAttribute('tabindex', '0');

      await user.keyboard(' ');
      await act(async () => {});
      expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();
      // Checked, the radio is the cell's target now. Browsers blur a focused element whose tabindex
      // is removed (focus goes to the body), so the focused cell stays focusable until focus leaves
      // it. Asserted before any further key press: jsdom never blurs it.
      expect(selectionCell('Bob')).toHaveFocus();
      expect(selectionCell('Bob')).toHaveAttribute('tabindex', '0');
      // The focused cell keeps the grid's only Tab stop; its radio is not a further one.
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveAttribute('tabindex', '-1');
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([selectionCell('Bob')]);

      // Once focus leaves the cell, the cell is not focusable any more.
      await user.keyboard('{ArrowRight}');
      expect(cell('Bob')).toHaveFocus();
      expect(selectionCell('Bob')).not.toHaveAttribute('tabindex');
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveFocus();
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveAttribute('tabindex', '0');
    });

    it('drops the kept tabindex when focus leaves the grid from that cell', async () => {
      const user = userEvent.setup();
      renderSingle();
      act(() => cell('Bob').focus());
      await user.keyboard('{ArrowLeft} ');
      await act(async () => {});
      expect(selectionCell('Bob')).toHaveFocus();
      expect(selectionCell('Bob')).toHaveAttribute('tabindex', '0');

      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(selectionCell('Bob')).not.toHaveAttribute('tabindex');
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([
        screen.getByRole('radio', { name: 'Bob' }),
      ]);
      await user.tab({ shift: true });
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveFocus();
    });

    it('moves the tab stop off an unchecked radio when the selection changes elsewhere', async () => {
      const user = userEvent.setup();
      function Controlled({ selected }: { selected: string[] }) {
        return (
          <>
            <DataGrid aria-label="People" selectionMode="single" selectedItems={selected}>
              {gridContent()}
            </DataGrid>
            <button type="button">After</button>
          </>
        );
      }
      const { rerender } = render(<Controlled selected={[]} />);
      act(() => cell('Bob').focus());
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveFocus();
      act(() => screen.getByRole('button', { name: 'After' }).focus());

      rerender(<Controlled selected={['3']} />);
      await act(async () => {});
      expect(getTabbableElements(screen.getByRole('grid'))).toEqual([selectionCell('Bob')]);
    });

    it('keeps navigating from a focused radio after another radio gets checked', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      function Controlled({ selected }: { selected: string[] }) {
        return (
          <DataGrid
            aria-label="People"
            selectionMode="single"
            selectedItems={selected}
            onSelectedItemsChange={onSelectedItemsChange}
          >
            {gridContent()}
          </DataGrid>
        );
      }
      const { rerender } = render(<Controlled selected={[]} />);
      act(() => cell('Bob').focus());
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveFocus();

      rerender(<Controlled selected={['3']} />);
      await act(async () => {});
      // The grid moves between cells; the radio group's own arrow keys never change the selection.
      await user.keyboard('{ArrowUp}');
      expect(selectionCell('Alice')).toHaveFocus();
      expect(onSelectedItemsChange).not.toHaveBeenCalled();
      expect(screen.getByRole('radio', { name: 'Carol' })).toBeChecked();
    });

    it('targets an unchecked radio while no radio of the group is checked', async () => {
      const user = userEvent.setup();
      render(
        <DataGrid aria-label="People" selectionMode="single">
          {gridContent()}
        </DataGrid>,
      );
      act(() => cell('Bob').focus());
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('radio', { name: 'Bob' })).toHaveFocus();
    });
  });

  it('leaves a nested roving composite’s tab indexes alone (stand-in with manageTabIndex)', async () => {
    const user = userEvent.setup();
    const original = Element.prototype.setAttribute;
    let writes = 0;
    vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
      this: Element,
      name: string,
      value: string,
    ) {
      if (name === 'tabindex' && ++writes > 500) return;
      original.call(this, name, value);
    });
    function RowActions() {
      const { containerProps } = useRovingTabIndex({
        itemSelector: 'button, [href], input, select, textarea, [role="button"], [tabindex]',
        manageTabIndex: true,
        tabStop: 'last-focused',
      });
      return (
        <div role="toolbar" aria-label="Row actions" {...containerProps}>
          <button type="button">Edit</button>
          <button type="button">Delete</button>
        </div>
      );
    }
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
            <DataGrid.Cell>
              <RowActions />
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    for (let index = 0; index < 10; index += 1) await act(async () => {});
    expect(writes).toBeLessThan(50);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    act(() => cell('Alice').focus());
    await user.keyboard('{ArrowRight}{Enter}');
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(toolbar.parentElement).toHaveFocus();
    for (let index = 0; index < 10; index += 1) await act(async () => {});
    expect(writes).toBeLessThan(80);
    expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });
});

describe('DataGrid handler composition', () => {
  testComposedHandler(DataGrid, {
    handler: 'onKeyDown',
    defaultProps: { 'aria-label': 'People', children: gridContent() },
    act: async ({ user }) => {
      act(() => cell('Alice').focus());
      await user.keyboard('{ArrowDown}');
    },
    assertInternal: () => {
      expect(cell('Bob')).toHaveFocus();
    },
    assertInternalSuppressed: () => {
      expect(cell('Alice')).toHaveFocus();
    },
  });

  const onRowSelection = vi.fn();
  function SelectableRow(props: Omit<DataGridRowProps, 'children'>) {
    return (
      <DataGrid aria-label="People" selectionMode="multiple" onSelectedItemsChange={onRowSelection}>
        <DataGrid.Body>
          <DataGrid.Row rowId="1" {...props}>
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>
    );
  }
  SelectableRow.displayName = 'SelectableRow';

  testComposedHandler(SelectableRow, {
    handler: 'onKeyDown',
    act: async ({ user }) => {
      onRowSelection.mockClear();
      act(() => cell('Alice').focus());
      await user.keyboard(' ');
    },
    assertInternal: () => {
      expect(onRowSelection).toHaveBeenCalledWith(['1']);
    },
    assertInternalSuppressed: () => {
      expect(onRowSelection).not.toHaveBeenCalled();
    },
  });

  function SingleCell(props: Omit<DataGridCellProps, 'children'>) {
    return (
      <DataGrid aria-label="People">
        <DataGrid.Body>
          <DataGrid.Row>
            <DataGrid.Cell {...props}>Alice</DataGrid.Cell>
            <DataGrid.Cell>Bob</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>
    );
  }

  it('calls a consumer onKeyDown and onFocus on a cell next to grid navigation', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onFocus = vi.fn();
    render(<SingleCell onKeyDown={onKeyDown} onFocus={onFocus} />);
    act(() => cell('Alice').focus());
    await user.keyboard('{ArrowRight}');
    expect(onFocus).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
    expect(cell('Bob')).toHaveFocus();
  });

  it('calls a consumer onClick on a sortable header next to sorting', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onSortChange = vi.fn();
    render(
      <DataGrid aria-label="People" onSortChange={onSortChange}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable onClick={onClick}>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
      </DataGrid>,
    );
    await user.click(sortButton('Name'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith('name', 'ascending');
  });
});

describe('DataGrid sub-component refs', () => {
  it('forwards ref to the table element', () => {
    const ref = React.createRef<HTMLTableElement>();
    render(
      <DataGrid ref={ref} data-testid="grid" aria-label="People">
        <DataGrid.Body>
          <DataGrid.Row>
            <DataGrid.Cell>C</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(ref.current).toBe(screen.getByTestId('grid'));
    expect(ref.current!.tagName.toLowerCase()).toBe('table');
  });

  it('DataGrid.Header forwards ref', () => {
    const ref = React.createRef<HTMLTableSectionElement>();
    render(
      <DataGrid aria-label="People">
        <DataGrid.Header ref={ref} data-testid="hdr">
          <tr>
            <DataGrid.HeaderCell>H</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
      </DataGrid>,
    );
    expect(ref.current).toBe(screen.getByTestId('hdr'));
    expect(ref.current!.tagName.toLowerCase()).toBe('thead');
  });

  it('DataGrid.HeaderCell forwards ref', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    render(
      <DataGrid aria-label="People">
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell ref={ref} data-testid="hc">
              H
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
      </DataGrid>,
    );
    expect(ref.current).toBe(screen.getByTestId('hc'));
    expect(ref.current!.tagName.toLowerCase()).toBe('th');
  });

  it('DataGrid.Body forwards ref', () => {
    const ref = React.createRef<HTMLTableSectionElement>();
    render(
      <DataGrid aria-label="People">
        <DataGrid.Body ref={ref} data-testid="body">
          <DataGrid.Row>
            <DataGrid.Cell>C</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(ref.current).toBe(screen.getByTestId('body'));
    expect(ref.current!.tagName.toLowerCase()).toBe('tbody');
  });

  it('DataGrid.Row forwards ref', () => {
    const ref = React.createRef<HTMLTableRowElement>();
    render(
      <DataGrid aria-label="People">
        <DataGrid.Body>
          <DataGrid.Row ref={ref} data-testid="row">
            <DataGrid.Cell>C</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(ref.current).toBe(screen.getByTestId('row'));
    expect(ref.current!.tagName.toLowerCase()).toBe('tr');
  });

  it('DataGrid.Cell forwards ref', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    render(
      <DataGrid aria-label="People">
        <DataGrid.Body>
          <DataGrid.Row>
            <DataGrid.Cell ref={ref} data-testid="cell">
              C
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(ref.current).toBe(screen.getByTestId('cell'));
    expect(ref.current!.tagName.toLowerCase()).toBe('td');
  });
});

describe('DataGrid types', () => {
  it('discriminates the sort API from the deprecated sort props', () => {
    const setSort = (sort: DataGridSort | null) => void sort;
    const setColumn = (column: string) => void column;
    const elements = [
      <DataGrid
        key="new"
        sort={null}
        onSortChange={(sort) => {
          expectTypeOf(sort).toEqualTypeOf<DataGridSort>();
          setSort(sort);
        }}
      >
        {null}
      </DataGrid>,
      <DataGrid key="setter" defaultSort={null} onSortChange={setSort}>
        {null}
      </DataGrid>,
      <DataGrid
        key="legacy"
        onSortChange={(columnId, direction) => {
          expectTypeOf(columnId).toEqualTypeOf<string>();
          expectTypeOf(direction).toEqualTypeOf<SortDirection>();
          setColumn(columnId);
        }}
      >
        {null}
      </DataGrid>,
      <DataGrid key="legacy-one-arg" onSortChange={(columnId) => setColumn(columnId)}>
        {null}
      </DataGrid>,
      // @ts-expect-error — the sort API and the deprecated sortColumn cannot be mixed.
      <DataGrid key="mixed" sort={null} sortColumn="name">
        {null}
      </DataGrid>,
      // @ts-expect-error — the DataGridSort callback needs `sort` or `defaultSort`.
      <DataGrid key="object-without-sort" onSortChange={(sort: DataGridSort) => setSort(sort)}>
        {null}
      </DataGrid>,
    ];
    expect(elements).toHaveLength(6);
    expectTypeOf<DataGridProps['selectedItems']>().toEqualTypeOf<string[] | undefined>();
  });
});
