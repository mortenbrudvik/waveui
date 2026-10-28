import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import * as stories from '../../../../stories/DataGrid.stories';
import {
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  DataGridSelectionCell,
  createSelectionStore,
} from '../DataGrid';
import type {
  DataGridBaseProps,
  DataGridBodyProps,
  DataGridCellProps,
  DataGridColumn,
  DataGridHeaderCellProps,
  DataGridLabels,
  DataGridProps,
  DataGridRowProps,
  DataGridRowSelectionCellProps,
  DataGridSelectedItemsChangeDetails,
  DataGridSelectionAppearance,
  DataGridSelectionCellProps,
  DataGridSort,
  DataGridSortChangeDetails,
  SortDirection,
} from '../DataGrid';
import {
  dataGridBodyClassNames,
  dataGridCellClassNames,
  dataGridHeaderCellClassNames,
  dataGridHeaderClassNames,
  dataGridRowClassNames,
  dataGridSelectionCellClassNames,
} from '../../../lib/classNames';
import { getTabbableElements } from '../../../lib/focus';
import type { Slot } from '../../../lib/slot';
import { createTableColumn } from '../../../lib/table';
import { useRovingTabIndex } from '../../../hooks/useRovingTabIndex';
import { Button } from '../../button/Button';
import { MenuButton } from '../../button/MenuButton';
import { Toolbar } from '../../button/Toolbar';
import { RadioGroup } from '../../input/RadioGroup';
import { Tree } from '../../layout/Tree';
import { Menu } from '../../navigation/Menu';
import { countTabIndexWrites, flushObservers } from './tabIndexWrites';
import {
  asClientReference,
  expectNoA11yViolations,
  renderWithProviders,
  testCompoundExposure,
  testComposedHandler,
  testNoImplicitSubmit,
  testSystemProps,
  expectThrows,
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

/** A two-row header (a group row above the column row) plus the body rows. */
function groupedGridContent() {
  const [, body] = gridContent();
  return [
    <DataGrid.Header key="header">
      <tr>
        <DataGrid.HeaderCell colSpan={2}>Person</DataGrid.HeaderCell>
        <DataGrid.HeaderCell>Other</DataGrid.HeaderCell>
      </tr>
      <tr>
        <DataGrid.HeaderCell columnId="name" sortable>
          Name
        </DataGrid.HeaderCell>
        <DataGrid.HeaderCell>Role</DataGrid.HeaderCell>
        <DataGrid.HeaderCell>Notes</DataGrid.HeaderCell>
      </tr>
    </DataGrid.Header>,
    body,
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

/** DataGrid's deprecation warning for the prop `name`, replaced by `replacement`. */
const deprecated = (name: string, replacement: string) =>
  `[WaveUI] DataGrid: \`${name}\` is deprecated and will be removed in 1.0. Use \`${replacement}\` instead.`;

const DEPRECATED_COLUMN_ID = deprecated('columns[].id', 'columns[].columnId');

const COLUMN_WITHOUT_ID =
  '[WaveUI] DataGrid: a column in `columns` has no `columnId` (nor the deprecated `id`), so its header cannot sort. Give every column a unique `columnId`.';

const BODY_WITHOUT_ITEMS =
  "[WaveUI] DataGrid.Body: a render function child renders one row per item of the DataGrid's `items`, which is not set, so the body has no rows.";

const MIXED_SORT_COLUMN =
  '[WaveUI] DataGrid: `sortColumn` is controlled but `sortDirection` is not (mixed control). The direction is kept internally and toggles on repeated clicks, as in 0.4. Pass `sort` (`{ columnId, direction }`) to control both.';

const MIXED_SORT_DIRECTION =
  '[WaveUI] DataGrid: `sortDirection` is controlled but `sortColumn` is not (mixed control). The column is kept internally and follows the clicked header, as in 0.4. Pass `sort` (`{ columnId, direction }`) to control both.';

/** The `details` argument of `onSortChange` (object form) and `onSelectedItemsChange`. */
const DETAILS = { event: expect.any(Event) };

/** useControllable's warning when a value switches between controlled and uncontrolled. */
const switchWarning = (from: string, to: string) =>
  `[WaveUI] A component is changing from ${from} to ${to}. Components should not switch between controlled and uncontrolled: pass \`undefined\` only when the component is uncontrolled, and the empty value (for example \`[]\`, \`null\` or \`""\`) to clear a controlled value.`;

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
      {
        name: 'grouped header, multiple selection',
        props: { selectionMode: 'multiple', children: groupedGridContent() },
      },
      {
        name: 'grouped header, single selection',
        props: { selectionMode: 'single', children: groupedGridContent() },
      },
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
      expect(wrapper).not.toHaveClass('overflow-hidden');
      expect(wrapper).not.toHaveClass('rounded-lg');
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
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] DataGrid: `containerProps["aria-label"]`/`["aria-labelledby"]` is ignored because the wrapper has no role. Name the grid itself (`aria-label` on DataGrid), or pass a `role` (e.g. "region") in `containerProps` too.',
        ],
      ]);
    });
  });

  describe('context', () => {
    it.each([
      ['DataGrid.Row', <DataGrid.Row key="r">{null}</DataGrid.Row>],
      ['DataGrid.Header', <DataGrid.Header key="h">{null}</DataGrid.Header>],
      ['DataGrid.HeaderCell', <DataGrid.HeaderCell key="hc">Name</DataGrid.HeaderCell>],
    ])('%s used outside a DataGrid throws in development', (name, element) => {
      expectThrows(
        <table>
          <tbody>
            <tr>{element}</tr>
          </tbody>
        </table>,
        `[WaveUI] ${name} must be used within DataGrid`,
      );
    });

    describe('in production', () => {
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('logs a part used outside a DataGrid once and renders it inert', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const misplaced = () => (
          <table>
            <tbody>
              <DataGrid.Row rowId="1">
                <DataGrid.Cell>Alice</DataGrid.Cell>
              </DataGrid.Row>
            </tbody>
          </table>
        );
        render(misplaced());
        render(misplaced());
        expect(screen.getAllByRole('row')).toHaveLength(2);
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(error.mock.calls).toEqual([['[WaveUI] DataGrid.Row must be used within DataGrid']]);
      });
    });
  });
});

describe('DataGrid parts written in a Server Component (lazy element types)', () => {
  /** The parts as a Server Component delivers them to the client (pre-resolved lazy types). */
  const LAZY = {
    Header: asClientReference(DataGrid.Header),
    HeaderCell: asClientReference(DataGrid.HeaderCell),
    Body: asClientReference(DataGrid.Body),
    Row: asClientReference(DataGrid.Row),
    Cell: asClientReference(DataGrid.Cell),
  };
  const PLAIN: typeof LAZY = {
    Header: DataGrid.Header,
    HeaderCell: DataGrid.HeaderCell,
    Body: DataGrid.Body,
    Row: DataGrid.Row,
    Cell: DataGrid.Cell,
  };

  function body(parts: typeof LAZY) {
    const { Body, Row, Cell } = parts;
    return (
      <Body key="body">
        {PEOPLE.map((person) => (
          <Row key={person.id} rowId={person.id}>
            <Cell>{person.name}</Cell>
            <Cell>{person.role}</Cell>
          </Row>
        ))}
      </Body>
    );
  }

  function grid(parts: typeof LAZY, props: Partial<DataGridBaseProps> = {}) {
    const { Header, HeaderCell } = parts;
    return (
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        defaultSelectedItems={['2']}
        columns={[{ id: 'generated', label: 'Generated' }]}
        {...props}
      >
        <Header>
          <tr>
            <HeaderCell columnId="name" sortable>
              Name
            </HeaderCell>
            <HeaderCell>Role</HeaderCell>
          </tr>
        </Header>
        {body(parts)}
      </DataGrid>
    );
  }

  it('renders the same server HTML as the plain parts', () => {
    const plain = renderToString(grid(PLAIN));
    expect(plain).toContain('Select all rows');
    expect(plain).not.toContain('Generated');
    expect(renderToString(grid(LAZY))).toBe(plain);
  });

  it('finds the lazy header (no header from `columns`) and names each row control after its lazy first cell', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    const onSelectedItemsChange = vi.fn();
    render(grid(LAZY, { onSelectedItemsChange }));
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      '',
      'Name',
      'Role',
    ]);
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2', '1'], DETAILS);
    expect(warn).not.toHaveBeenCalled();
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
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.HeaderCell: `sortable` needs a `columnId`; the header is rendered as not sortable.',
      ],
    ]);
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
    expect(warn.mock.calls).toEqual([
      [deprecated('defaultSortColumn', 'defaultSort')],
      [deprecated('defaultSortDirection', 'defaultSort')],
    ]);
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
    expect(onSortChange).toHaveBeenCalledWith(
      { columnId: 'name', direction: 'ascending' },
      DETAILS,
    );
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
    expect(onSortChange).toHaveBeenLastCalledWith(
      { columnId: 'role', direction: 'ascending' },
      DETAILS,
    );
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
      [{ columnId: 'name', direction: 'descending' }, DETAILS],
      [{ columnId: 'name', direction: 'descending' }, DETAILS],
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
    expect(warn.mock.calls).toEqual([
      [deprecated('sortColumn', 'sort')],
      [deprecated('sortDirection', 'sort')],
      [switchWarning('controlled', 'uncontrolled')],
    ]);
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
    expect(warn.mock.calls).toEqual([[switchWarning('uncontrolled', 'controlled')]]);
  });

  describe('deprecated sortColumn/sortDirection controlled one at a time (0.4 mixed control)', () => {
    it('keeps the direction internal when only sortColumn is controlled, and warns', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const calls: [string, SortDirection][] = [];
      function Parent() {
        const [column, setColumn] = React.useState('name');
        return (
          <DataGrid
            aria-label="People"
            sortColumn={column}
            onSortChange={(columnId, direction) => {
              calls.push([columnId, direction]);
              setColumn(columnId);
            }}
          >
            {gridContent()}
          </DataGrid>
        );
      }
      render(<Parent />);
      expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');

      await user.click(sortButton('Name'));
      expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
      await user.click(sortButton('Name'));
      expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
      await user.click(sortButton('Name'));
      expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
      await user.click(sortButton('Role'));
      expect(header('Role')).toHaveAttribute('aria-sort', 'ascending');
      expect(header('Name')).toHaveAttribute('aria-sort', 'none');

      // Every reported sort is the one aria-sort shows.
      expect(calls).toEqual([
        ['name', 'descending'],
        ['name', 'ascending'],
        ['name', 'descending'],
        ['role', 'ascending'],
      ]);
      expect(warn.mock.calls).toEqual([[deprecated('sortColumn', 'sort')], [MIXED_SORT_COLUMN]]);
    });

    it('keeps the column internal when only sortDirection is controlled, and warns', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const calls: [string, SortDirection][] = [];
      function Parent() {
        const [direction, setDirection] = React.useState<SortDirection>('ascending');
        return (
          <DataGrid
            aria-label="People"
            sortDirection={direction}
            onSortChange={(columnId, next) => {
              calls.push([columnId, next]);
              setDirection(next);
            }}
          >
            {gridContent()}
          </DataGrid>
        );
      }
      render(<Parent />);
      expect(header('Name')).toHaveAttribute('aria-sort', 'none');

      await user.click(sortButton('Name'));
      expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
      await user.click(sortButton('Name'));
      expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
      await user.click(sortButton('Role'));
      expect(header('Role')).toHaveAttribute('aria-sort', 'ascending');
      expect(header('Name')).toHaveAttribute('aria-sort', 'none');

      expect(calls).toEqual([
        ['name', 'ascending'],
        ['name', 'descending'],
        ['role', 'ascending'],
      ]);
      expect(warn.mock.calls).toEqual([
        [deprecated('sortDirection', 'sort')],
        [MIXED_SORT_DIRECTION],
      ]);
    });

    it('starts the internal column from defaultSortColumn and follows a direction the parent keeps', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onSortChange = vi.fn();
      renderGrid({ sortDirection: 'descending', defaultSortColumn: 'role', onSortChange });
      expect(warn.mock.calls).toEqual([
        [deprecated('sortDirection', 'sort')],
        [deprecated('defaultSortColumn', 'defaultSort')],
        [MIXED_SORT_DIRECTION],
      ]);
      expect(header('Role')).toHaveAttribute('aria-sort', 'descending');
      // The parent does not accept the new direction: the controlled half stays.
      await user.click(sortButton('Role'));
      expect(onSortChange).toHaveBeenLastCalledWith('role', 'ascending');
      expect(header('Role')).toHaveAttribute('aria-sort', 'descending');
      // The internal half (the column) follows the click.
      await user.click(sortButton('Name'));
      expect(onSortChange).toHaveBeenLastCalledWith('name', 'ascending');
      expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
      expect(header('Role')).toHaveAttribute('aria-sort', 'none');
    });

    it('calls onSortChange once per click in StrictMode', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onSortChange = vi.fn();
      render(
        <React.StrictMode>
          <DataGrid aria-label="People" sortColumn="name" onSortChange={onSortChange}>
            {gridContent()}
          </DataGrid>
        </React.StrictMode>,
      );
      await user.click(sortButton('Name'));
      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(onSortChange).toHaveBeenCalledWith('name', 'descending');
      expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
      expect(warn.mock.calls).toEqual([[deprecated('sortColumn', 'sort')], [MIXED_SORT_COLUMN]]);
    });

    it('does not warn about mixed control when both or neither are controlled', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderGrid({ sortColumn: 'name', sortDirection: 'descending' });
      renderGrid({ defaultSortColumn: 'name' });
      // Only the deprecations: no mixed-control warning.
      expect(warn.mock.calls).toEqual([
        [deprecated('sortColumn', 'sort')],
        [deprecated('sortDirection', 'sort')],
        [deprecated('defaultSortColumn', 'defaultSort')],
      ]);
    });
  });

  it('warns when the sort API and the deprecated sortColumn/sortDirection are mixed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ sort: { columnId: 'name', direction: 'ascending' }, sortColumn: 'role' });
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(warn.mock.calls).toEqual([
      [deprecated('sortColumn', 'sort')],
      [
        '[WaveUI] DataGrid: do not mix `sort`/`defaultSort` with the deprecated `sortColumn`/`sortDirection`/`defaultSortColumn`/`defaultSortDirection`. `sort`/`defaultSort` win.',
      ],
    ]);
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
    { columnId: 'name', label: 'Name', sortable: true },
    { columnId: 'role', label: 'Role' },
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

  it('keeps a caption first, also one inside a Fragment, and finds a header inside a Fragment', () => {
    const { rerender } = render(
      <DataGrid aria-label="People" columns={columns}>
        <>
          <caption>Team</caption>
          {rows()}
        </>
      </DataGrid>,
    );
    const grid = screen.getByRole('grid');
    expect(Array.from(grid.children).map((child) => child.localName)).toEqual([
      'caption',
      'thead',
      'tbody',
    ]);
    rerender(
      <DataGrid aria-label="People" columns={columns}>
        <>
          <DataGrid.Header>
            <tr>
              <DataGrid.HeaderCell>Custom</DataGrid.HeaderCell>
            </tr>
          </DataGrid.Header>
        </>
        {rows()}
      </DataGrid>,
    );
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Custom']);
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

  describe('the deprecated column `id` (0.13 columns)', () => {
    it('names the column as `columnId` does, and warns once', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onSortChange = vi.fn();
      const legacy: DataGridColumn[] = [
        { id: 'name', label: 'Name', sortable: true },
        { id: 'role', label: 'Role' },
      ];
      render(
        <DataGrid aria-label="People" columns={legacy} onSortChange={onSortChange}>
          {rows()}
        </DataGrid>,
      );
      expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
        'Name',
        'Role',
      ]);
      await user.click(sortButton('Name'));
      await user.click(sortButton('Name'));
      expect(onSortChange.mock.calls).toEqual([
        ['name', 'ascending'],
        ['name', 'descending'],
      ]);
      expect(warn.mock.calls).toEqual([[DEPRECATED_COLUMN_ID]]);
    });

    it('loses to `columnId` when a column has both, and still warns', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onSortChange = vi.fn();
      render(
        <DataGrid
          aria-label="People"
          columns={[{ columnId: 'fullName', id: 'name', label: 'Name', sortable: true }]}
          defaultSort={null}
          onSortChange={onSortChange}
        >
          {rows()}
        </DataGrid>,
      );
      await user.click(sortButton('Name'));
      expect(onSortChange).toHaveBeenCalledWith(
        { columnId: 'fullName', direction: 'ascending' },
        DETAILS,
      );
      expect(warn.mock.calls).toEqual([[DEPRECATED_COLUMN_ID]]);
    });
  });

  it('warns once for a column with neither `columnId` nor `id`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A column without an id compiles (both names are optional while `id` is deprecated).
    const { rerender } = render(
      <DataGrid aria-label="People" columns={[{ label: 'Name', sortable: true }]}>
        {rows()}
      </DataGrid>,
    );
    rerender(
      <DataGrid aria-label="People" columns={[{ label: 'Name', sortable: true }]}>
        {rows()}
      </DataGrid>,
    );
    expect(header('Name')).not.toHaveAttribute('aria-sort');
    // The header cell's effect runs before the grid's.
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.HeaderCell: `sortable` needs a `columnId`; the header is rendered as not sortable.',
      ],
      [COLUMN_WITHOUT_ID],
    ]);
  });
});

describe('DataGrid items and typed columns', () => {
  const NAME: DataGridColumn<Person> = {
    columnId: 'name',
    label: 'Name',
    renderCell: (person) => person.name,
  };
  const ROLE: DataGridColumn<Person> = {
    columnId: 'role',
    label: <em>Role</em>,
    renderCell: (person) => <strong>{person.role}</strong>,
  };
  const NOTES: DataGridColumn<Person> = { columnId: 'notes', label: 'Notes' };
  const COLUMNS: readonly DataGridColumn<Person>[] = [NAME, ROLE, NOTES];

  function cellTexts(): string[][] {
    return bodyRows().map((row) =>
      within(row)
        .getAllByRole('gridcell')
        .map((td) => td.textContent ?? ''),
    );
  }

  /** A body row of the render-function tests: the name, then the index it was rendered with. */
  function renderPerson(person: Person, index: number) {
    return (
      <DataGrid.Row>
        <DataGrid.Cell>{person.name}</DataGrid.Cell>
        <DataGrid.Cell>{`#${index}`}</DataGrid.Cell>
      </DataGrid.Row>
    );
  }

  const twoColumnHeader = (
    <DataGrid.Header>
      <tr>
        <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
        <DataGrid.HeaderCell>Index</DataGrid.HeaderCell>
      </tr>
    </DataGrid.Header>
  );

  it('renders the header, the rows and the cells from `items` and `columns`', () => {
    render(<DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS} />);
    const grid = screen.getByRole('grid');
    expect(Array.from(grid.children).map((child) => child.localName)).toEqual(['thead', 'tbody']);
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Role',
      'Notes',
    ]);
    // A ReactNode label.
    expect(within(header('Role')).getByText('Role').localName).toBe('em');
    // `renderCell` fills each cell; a column without it leaves its cells empty.
    expect(cellTexts()).toEqual([
      ['Alice', 'Engineer', ''],
      ['Bob', 'Designer', ''],
      ['Carol', 'Manager', ''],
    ]);
    expect(screen.getByText('Designer').localName).toBe('strong');
    expect(cell('Alice')).toHaveClass(dataGridCellClassNames.root);
    expect(bodyRows()[0]).toHaveClass(dataGridRowClassNames.root);
    expect(grid.querySelector('tbody')).toHaveClass(dataGridBodyClassNames.root);
  });

  it('renders `renderHeaderCell` in place of the label', () => {
    render(
      <DataGrid
        aria-label="People"
        items={PEOPLE}
        columns={[
          { ...NAME, renderHeaderCell: () => <span>Full name</span> },
          createTableColumn<Person>({
            columnId: 'role',
            renderHeaderCell: () => 'Job',
            renderCell: (person) => person.role,
          }),
        ]}
      />,
    );
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Full name',
      'Job',
    ]);
    expect(cellTexts()[0]).toEqual(['Alice', 'Engineer']);
  });

  it('makes a column with `compare` sortable unless `sortable` is false', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataGrid
        aria-label="People"
        items={PEOPLE}
        defaultSort={null}
        onSortChange={onSortChange}
        columns={[
          { ...NAME, compare: (a, b) => a.name.localeCompare(b.name) },
          { ...ROLE, compare: (a, b) => a.role.localeCompare(b.role), sortable: false },
          { ...NOTES, sortable: true },
        ]}
      />,
    );
    expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    expect(within(header('Role')).queryByRole('button')).toBeNull();
    expect(header('Role')).not.toHaveAttribute('aria-sort');
    expect(header('Notes')).toHaveAttribute('aria-sort', 'none');
    await user.click(sortButton('Name'));
    expect(onSortChange).toHaveBeenCalledWith(
      { columnId: 'name', direction: 'ascending' },
      DETAILS,
    );
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
  });

  describe('row ids', () => {
    it('are the item indexes by default', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      render(
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          columns={COLUMNS}
          selectionMode="multiple"
          defaultSelectedItems={['2']}
          onSelectedItemsChange={onSelectedItemsChange}
        />,
      );
      // Each row control is named after the row's first cell.
      expect(screen.getByRole('checkbox', { name: 'Carol' })).toBeChecked();
      await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2', '0'], DETAILS);
      await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['0', '1', '2'], DETAILS);
    });

    it('come from `getRowId`', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      render(
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          columns={COLUMNS}
          getRowId={(person) => `person-${person.id}`}
          selectionMode="single"
          onSelectedItemsChange={onSelectedItemsChange}
        />,
      );
      await user.click(screen.getByRole('radio', { name: 'Bob' }));
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['person-2'], DETAILS);
      expect(bodyRows()[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('lose to a row’s own `rowId`', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      render(
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          getRowId={(person) => person.id}
          selectionMode="multiple"
          onSelectedItemsChange={onSelectedItemsChange}
        >
          <DataGrid.Body>
            {(person: Person) => (
              <DataGrid.Row rowId={person.name.toLowerCase()}>
                <DataGrid.Cell>{person.name}</DataGrid.Cell>
              </DataGrid.Row>
            )}
          </DataGrid.Body>
        </DataGrid>,
      );
      await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['bob'], DETAILS);
    });

    it('that repeat warn once, as rows with the same `rowId` do, and every row renders', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error');
      render(
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          columns={COLUMNS}
          getRowId={() => 'same'}
          selectionMode="multiple"
        />,
      );
      // The first cell of each row is the selection cell.
      expect(cellTexts().map(([, name]) => name)).toEqual(['Alice', 'Bob', 'Carol']);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] DataGrid: several rows share the rowId "same". Row ids must be unique within a DataGrid; rows with the same rowId are selected and deselected together.',
        ],
      ]);
      // No duplicate React keys.
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe('DataGrid.Body render function', () => {
    it('renders one row per item, with the item and its index in `items`', async () => {
      const user = userEvent.setup();
      const renderRow = vi.fn(renderPerson);
      const onSelectedItemsChange = vi.fn();
      render(
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          getRowId={(person) => person.id}
          selectionMode="multiple"
          defaultSelectedItems={['3']}
          onSelectedItemsChange={onSelectedItemsChange}
        >
          {twoColumnHeader}
          <DataGrid.Body>{renderRow}</DataGrid.Body>
        </DataGrid>,
      );
      expect(renderRow.mock.calls).toEqual([
        [PEOPLE[0], 0],
        [PEOPLE[1], 1],
        [PEOPLE[2], 2],
      ]);
      expect(cellTexts()).toEqual([
        ['', 'Alice', '#0'],
        ['', 'Bob', '#1'],
        ['', 'Carol', '#2'],
      ]);
      // The row id from `getRowId` reaches each DataGrid.Row.
      expect(screen.getByRole('checkbox', { name: 'Carol' })).toBeChecked();
      await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['3', '1'], DETAILS);
    });

    it('renders no rows and warns once without `items`', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const renderRow = vi.fn(renderPerson);
      const { rerender } = render(
        <DataGrid aria-label="People">
          {twoColumnHeader}
          <DataGrid.Body>{renderRow}</DataGrid.Body>
        </DataGrid>,
      );
      rerender(
        <DataGrid aria-label="People">
          {twoColumnHeader}
          <DataGrid.Body>{renderRow}</DataGrid.Body>
        </DataGrid>,
      );
      expect(bodyRows()).toEqual([]);
      expect(renderRow).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[BODY_WITHOUT_ITEMS]]);
    });

    it('renders an empty body for empty `items`', () => {
      render(
        <DataGrid aria-label="People" items={[] as Person[]}>
          {twoColumnHeader}
          <DataGrid.Body>{renderPerson}</DataGrid.Body>
        </DataGrid>,
      );
      expect(bodyRows()).toEqual([]);
      expect(screen.getByRole('grid').querySelectorAll('tbody')).toHaveLength(1);
    });
  });

  describe('DataGrid.Body children', () => {
    it('without children renders the rows from `items` and `columns`', () => {
      const ref = React.createRef<HTMLTableSectionElement>();
      render(
        <DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS}>
          <DataGrid.Body ref={ref} className="my-body" />
        </DataGrid>,
      );
      expect(ref.current).toHaveClass('my-body', dataGridBodyClassNames.root);
      expect(screen.getByRole('grid').querySelectorAll('tbody')).toHaveLength(1);
      expect(cellTexts()).toEqual([
        ['Alice', 'Engineer', ''],
        ['Bob', 'Designer', ''],
        ['Carol', 'Manager', ''],
      ]);
    });

    it('as JSX keep their rows: the grid adds none from `items`', () => {
      const { rerender } = render(
        <DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS}>
          <DataGrid.Body>
            <DataGrid.Row rowId="custom">
              <DataGrid.Cell>Custom</DataGrid.Cell>
              <DataGrid.Cell>Row</DataGrid.Cell>
              <DataGrid.Cell>-</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      expect(cellTexts()).toEqual([['Custom', 'Row', '-']]);
      // Empty JSX children are rows too: none.
      rerender(
        <DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS}>
          <DataGrid.Body>{[]}</DataGrid.Body>
        </DataGrid>,
      );
      expect(bodyRows()).toEqual([]);
      expect(screen.getByRole('grid').querySelectorAll('tbody')).toHaveLength(1);
    });

    it('finds a DataGrid.Body written in a Server Component and adds no second body', () => {
      const LazyBody = asClientReference(DataGrid.Body);
      render(
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          columns={[{ columnId: 'name', label: 'Name' }]}
        >
          <LazyBody>
            <DataGrid.Row rowId="server">
              <DataGrid.Cell>Server row</DataGrid.Cell>
            </DataGrid.Row>
          </LazyBody>
        </DataGrid>,
      );
      expect(screen.getByRole('grid').querySelectorAll('tbody')).toHaveLength(1);
      expect(cellTexts()).toEqual([['Server row']]);
    });
  });

  it('places the generated body after a caption and the header, before a footer', () => {
    render(
      <DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS}>
        <caption>Team</caption>
        <tfoot>
          <tr>
            <td colSpan={3}>3 people</td>
          </tr>
        </tfoot>
      </DataGrid>,
    );
    expect(Array.from(screen.getByRole('grid').children).map((child) => child.localName)).toEqual([
      'caption',
      'thead',
      'tbody',
      'tfoot',
    ]);
  });

  it('includes the selection column in the generated header and rows', async () => {
    render(
      <DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS} selectionMode="multiple" />,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    for (const row of bodyRows()) expect(within(row).getAllByRole('gridcell')).toHaveLength(4);
    await expectNoA11yViolations();
  });

  it('calls onSelectedItemsChange once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          columns={COLUMNS}
          selectionMode="multiple"
          onSelectedItemsChange={onSelectedItemsChange}
        />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['1'], DETAILS]]);
  });

  describe('rows memoised by id', () => {
    const commits: string[] = [];
    const onRender: React.ProfilerOnRenderCallback = (id, phase) => {
      if (phase !== 'mount') commits.push(id);
    };
    afterEach(() => {
      commits.length = 0;
    });

    const PROFILED_COLUMNS: readonly DataGridColumn<Person>[] = [
      {
        columnId: 'name',
        label: 'Name',
        sortable: true,
        renderCell: (person) => (
          <React.Profiler id={`cell-${person.id}`} onRender={onRender}>
            {person.name}
          </React.Profiler>
        ),
      },
    ];

    function Parent({ children }: { children?: React.ReactNode }) {
      const [count, setCount] = React.useState(0);
      return (
        <>
          <button type="button" onClick={() => setCount(count + 1)}>
            Re-render {count}
          </button>
          <DataGrid
            aria-label="People"
            items={PEOPLE}
            // A new `getRowId` on every render: the row ids are recomputed, the rows stay.
            getRowId={(person) => person.id}
            columns={PROFILED_COLUMNS}
            selectionMode="multiple"
          >
            {children}
          </DataGrid>
        </>
      );
    }

    function renderProfiledRow(person: Person) {
      return (
        <React.Profiler id={`row-${person.id}`} onRender={onRender}>
          <DataGrid.Row>
            <DataGrid.Cell>{person.name}</DataGrid.Cell>
          </DataGrid.Row>
        </React.Profiler>
      );
    }

    it('does not re-render the rows from `columns` on a sort or a parent re-render', async () => {
      const user = userEvent.setup();
      render(<Parent />);
      commits.length = 0;
      await user.click(sortButton('Name'));
      expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
      await user.click(screen.getByRole('button', { name: /Re-render/ }));
      await user.click(screen.getByRole('button', { name: /Re-render/ }));
      expect(screen.getByRole('button', { name: 'Re-render 2' })).toBeInTheDocument();
      expect(commits).toEqual([]);
    });

    it('does not re-render the rows of a render function on a sort or a parent re-render', async () => {
      const user = userEvent.setup();
      render(
        <Parent>
          <DataGrid.Body>{renderProfiledRow}</DataGrid.Body>
        </Parent>,
      );
      commits.length = 0;
      await user.click(sortButton('Name'));
      await user.click(screen.getByRole('button', { name: /Re-render/ }));
      expect(screen.getByRole('button', { name: 'Re-render 1' })).toBeInTheDocument();
      expect(commits).toEqual([]);
      // Selecting re-renders only the toggled row.
      await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
      expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
      expect(new Set(commits)).toEqual(new Set(['row-2']));
    });
  });

  it('gives no row id to the rows of a grid nested in a body row', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <DataGrid aria-label="People" items={PEOPLE.slice(0, 1)}>
        <DataGrid.Body>
          {() => (
            <DataGrid.Row>
              <DataGrid.Cell>
                <DataGrid aria-label="Nested" selectionMode="multiple">
                  <DataGrid.Body>
                    <DataGrid.Row>
                      <DataGrid.Cell>Nested row</DataGrid.Cell>
                    </DataGrid.Row>
                  </DataGrid.Body>
                </DataGrid>
              </DataGrid.Cell>
            </DataGrid.Row>
          )}
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.Row: a selectable grid needs a `rowId` on every row; this row has no selection control.',
      ],
    ]);
  });
});

describe('DataGrid built-in sorting (items and compare)', () => {
  interface Member {
    id: string;
    name: string;
    team: string;
  }

  // Two members per team, so equal sort keys show their order in both directions.
  const MEMBERS: readonly Member[] = Object.freeze([
    { id: 'a', name: 'Alice', team: 'Engineering' },
    { id: 'b', name: 'Bob', team: 'Design' },
    { id: 'c', name: 'Carol', team: 'Engineering' },
    { id: 'd', name: 'Dan', team: 'Design' },
  ]);

  const NAME_COLUMN: DataGridColumn<Member> = {
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name),
    renderCell: (member) => member.name,
  };
  const TEAM_COLUMN: DataGridColumn<Member> = {
    columnId: 'team',
    label: 'Team',
    compare: (a, b) => a.team.localeCompare(b.team),
    renderCell: (member) => member.team,
  };
  const COLUMNS: readonly DataGridColumn<Member>[] = [NAME_COLUMN, TEAM_COLUMN];
  const getMemberId = (member: Member) => member.id;

  /** The first data cell of each body row (the selection cell skipped), in display order. */
  function names(root: ParentNode = document): string[] {
    return Array.from(root.querySelectorAll('tbody > tr')).map(
      (row) => row.querySelector('td:not([data-selection-cell])')?.textContent ?? '',
    );
  }

  it('sorts the rows by the column’s compare, descending by negating it (equal keys keep their order)', async () => {
    const user = userEvent.setup();
    render(
      <DataGrid aria-label="Members" items={MEMBERS} columns={COLUMNS} getRowId={getMemberId} />,
    );
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);

    await user.click(sortButton('Team'));
    expect(header('Team')).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Bob', 'Dan', 'Alice', 'Carol']);

    await user.click(sortButton('Team'));
    expect(header('Team')).toHaveAttribute('aria-sort', 'descending');
    // A reversed ascending list would read Carol, Alice, Dan, Bob.
    expect(names()).toEqual(['Alice', 'Carol', 'Bob', 'Dan']);

    await user.click(sortButton('Name'));
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    await user.click(sortButton('Name'));
    expect(names()).toEqual(['Dan', 'Carol', 'Bob', 'Alice']);

    // The grid sorts a copy: the frozen `items` would throw if it were sorted in place.
    expect(MEMBERS.map((member) => member.name)).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
  });

  it('sorts from `defaultSort`, in the server HTML too', () => {
    const grid = (
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={COLUMNS}
        defaultSort={{ columnId: 'team', direction: 'descending' }}
      />
    );
    const host = document.createElement('div');
    host.innerHTML = renderToString(grid);
    expect(names(host)).toEqual(['Alice', 'Carol', 'Bob', 'Dan']);

    render(grid);
    expect(names()).toEqual(['Alice', 'Carol', 'Bob', 'Dan']);
    expect(header('Team')).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts while `sort` is controlled, and follows the parent’s sort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const grid = (sort: DataGridSort | null) => (
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={COLUMNS}
        sort={sort}
        onSortChange={onSortChange}
      />
    );
    const { rerender } = render(grid({ columnId: 'team', direction: 'ascending' }));
    expect(names()).toEqual(['Bob', 'Dan', 'Alice', 'Carol']);

    // The parent ignores the change: the rows keep the controlled sort.
    await user.click(sortButton('Team'));
    expect(onSortChange.mock.calls).toEqual([
      [{ columnId: 'team', direction: 'descending' }, DETAILS],
    ]);
    expect(names()).toEqual(['Bob', 'Dan', 'Alice', 'Carol']);

    rerender(grid({ columnId: 'team', direction: 'descending' }));
    expect(names()).toEqual(['Alice', 'Carol', 'Bob', 'Dan']);
    rerender(grid(null));
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    expect(header('Team')).toHaveAttribute('aria-sort', 'none');
  });

  it('never sorts by a column without `compare`: the consumer’s order stands', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const columns: readonly DataGridColumn<Member>[] = [
      { columnId: 'name', label: 'Name', sortable: true, renderCell: (member) => member.name },
      TEAM_COLUMN,
    ];
    const grid = (sort?: DataGridSort | null) => (
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={columns}
        sort={sort}
        onSortChange={onSortChange}
      />
    );
    const { rerender } = render(grid());
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    expect(onSortChange.mock.calls).toEqual([
      [{ columnId: 'name', direction: 'ascending' }, DETAILS],
      [{ columnId: 'name', direction: 'descending' }, DETAILS],
    ]);

    // A controlled sort of that column (a server-sorted grid) leaves the order alone too.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rerender(grid({ columnId: 'name', direction: 'descending' }));
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    expect(warn.mock.calls).toEqual([[switchWarning('uncontrolled', 'controlled')]]);
  });

  it('never sorts the rows of a header written as JSX (no column has `compare`)', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataGrid aria-label="Members" items={MEMBERS} onSortChange={onSortChange}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          {(member: Member) => (
            <DataGrid.Row>
              <DataGrid.Cell>{member.name}</DataGrid.Cell>
            </DataGrid.Row>
          )}
        </DataGrid.Body>
      </DataGrid>,
    );
    await user.click(sortButton('Name'));
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
  });

  it('sorts by a column whose header is not sortable (`sortable: false`) when the sort names it', () => {
    render(
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={[{ ...NAME_COLUMN, sortable: false }, TEAM_COLUMN]}
        defaultSort={{ columnId: 'name', direction: 'descending' }}
      />,
    );
    expect(within(header('Name')).queryByRole('button')).toBeNull();
    expect(names()).toEqual(['Dan', 'Carol', 'Bob', 'Alice']);
  });

  it('keeps every row in its order when `compare` finds them all equal, in both directions', async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={[
          { ...NAME_COLUMN, compare: () => 0 },
          // Not a number: read as equal by the sort.
          { ...TEAM_COLUMN, compare: () => Number.NaN },
        ]}
      />,
    );
    for (const column of ['Name', 'Name', 'Team', 'Team']) {
      await user.click(sortButton(column));
      expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    }
  });

  it('survives a `compare` that is not a total order: every row once, the order kept between renders', async () => {
    const user = userEvent.setup();
    // Claims `a` comes first whatever the pair, so it contradicts itself.
    const columns: readonly DataGridColumn<Member>[] = [{ ...NAME_COLUMN, compare: () => -1 }];
    const grid = (
      <DataGrid aria-label="Members" items={MEMBERS} columns={columns} getRowId={getMemberId} />
    );
    const { rerender } = render(grid);
    await user.click(sortButton('Name'));
    const ascending = names();
    expect([...ascending].sort()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    rerender(grid);
    expect(names()).toEqual(ascending);
    await user.click(sortButton('Name'));
    expect([...names()].sort()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
  });

  it('keeps the sorted order and the selection when `items` is replaced', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const grid = (items: readonly Member[]) => (
      <DataGrid
        aria-label="Members"
        items={items}
        columns={COLUMNS}
        getRowId={getMemberId}
        selectionMode="multiple"
        defaultSort={{ columnId: 'name', direction: 'descending' }}
        onSelectedItemsChange={onSelectedItemsChange}
      />
    );
    const { rerender } = render(grid(MEMBERS));
    expect(names()).toEqual(['Dan', 'Carol', 'Bob', 'Alice']);
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['b'], DETAILS]]);

    // Alice leaves, Eve joins, Bob is a new object with the same id.
    rerender(
      grid([{ id: 'e', name: 'Eve', team: 'Design' }, { ...MEMBERS[1] }, MEMBERS[2], MEMBERS[3]]),
    );
    expect(names()).toEqual(['Eve', 'Dan', 'Carol', 'Bob']);
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Eve' })).not.toBeChecked();
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
  });

  it('renders no rows for empty `items`, sorted or not', async () => {
    const user = userEvent.setup();
    render(
      <DataGrid
        aria-label="Members"
        items={[] as Member[]}
        columns={COLUMNS}
        defaultSort={{ columnId: 'name', direction: 'ascending' }}
      />,
    );
    expect(bodyRows()).toEqual([]);
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    expect(bodyRows()).toEqual([]);
  });

  it('passes each item’s index in `items` to the body render function, whatever the order', () => {
    const renderRow = vi.fn((member: Member, index: number) => (
      <DataGrid.Row>
        <DataGrid.Cell>{member.name}</DataGrid.Cell>
        <DataGrid.Cell>{`#${index}`}</DataGrid.Cell>
      </DataGrid.Row>
    ));
    render(
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={COLUMNS}
        defaultSort={{ columnId: 'name', direction: 'descending' }}
      >
        <DataGrid.Body>{renderRow}</DataGrid.Body>
      </DataGrid>,
    );
    expect(renderRow.mock.calls).toEqual([
      [MEMBERS[3], 3],
      [MEMBERS[2], 2],
      [MEMBERS[1], 1],
      [MEMBERS[0], 0],
    ]);
    expect(names()).toEqual(['Dan', 'Carol', 'Bob', 'Alice']);
  });

  it('reorders the rows without rendering them again', async () => {
    const user = userEvent.setup();
    const commits: string[] = [];
    const onRender: React.ProfilerOnRenderCallback = (id, phase) => {
      if (phase !== 'mount') commits.push(id);
    };
    const columns: readonly DataGridColumn<Member>[] = [
      {
        ...NAME_COLUMN,
        renderCell: (member) => (
          <React.Profiler id={`cell-${member.id}`} onRender={onRender}>
            {member.name}
          </React.Profiler>
        ),
      },
    ];
    render(
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={columns}
        getRowId={getMemberId}
        selectionMode="multiple"
      />,
    );
    await user.click(sortButton('Name'));
    await user.click(sortButton('Name'));
    expect(names()).toEqual(['Dan', 'Carol', 'Bob', 'Alice']);
    expect(commits).toEqual([]);
  });

  it('calls onSortChange with a DataGridSort and details with `items`, without sort or defaultSort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={COLUMNS}
        onSortChange={onSortChange}
      />,
    );
    await user.click(sortButton('Team'));
    await user.click(sortButton('Team'));
    expect(onSortChange.mock.calls).toEqual([
      [{ columnId: 'team', direction: 'ascending' }, DETAILS],
      [{ columnId: 'team', direction: 'descending' }, DETAILS],
    ]);
  });

  it('keeps the DataGridSort callback when `items` becomes undefined, and the 0.4 one without it', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={COLUMNS}
        onSortChange={onSortChange}
      />,
    );
    // The callback form never changes under the consumer (a list that reloads).
    rerender(<DataGrid aria-label="Members" columns={COLUMNS} onSortChange={onSortChange} />);
    await user.click(sortButton('Name'));
    expect(onSortChange.mock.calls).toEqual([
      [{ columnId: 'name', direction: 'ascending' }, DETAILS],
    ]);
  });

  it('ignores the deprecated sort props with `items`, and warns', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSortChange = vi.fn();
    // Rejected by the types; a JavaScript caller can still pass them.
    const legacy = { sortColumn: 'team', defaultSortDirection: 'descending' } as object;
    render(
      <DataGrid
        aria-label="Members"
        items={MEMBERS}
        columns={COLUMNS}
        onSortChange={onSortChange}
        {...legacy}
      />,
    );
    expect(header('Team')).toHaveAttribute('aria-sort', 'none');
    expect(names()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    await user.click(sortButton('Team'));
    expect(names()).toEqual(['Bob', 'Dan', 'Alice', 'Carol']);
    expect(onSortChange.mock.calls).toEqual([
      [{ columnId: 'team', direction: 'ascending' }, DETAILS],
    ]);
    expect(warn.mock.calls).toEqual([
      [deprecated('sortColumn', 'sort')],
      [deprecated('defaultSortDirection', 'defaultSort')],
      [
        '[WaveUI] DataGrid: the deprecated `sortColumn`/`sortDirection`/`defaultSortColumn`/`defaultSortDirection` do not apply to a grid with `items` and are ignored. Pass `sort` or `defaultSort`.',
      ],
    ]);
  });
});

describe('DataGrid.HeaderCell sortIcon', () => {
  const SORTED: DataGridSort = { columnId: 'name', direction: 'ascending' };

  function renderSortIconGrid(sortIcon?: Slot<'span'>, defaultSort: DataGridSort | null = SORTED) {
    return render(
      <DataGrid aria-label="People" defaultSort={defaultSort}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable sortIcon={sortIcon}>
              Name
            </DataGrid.HeaderCell>
            <DataGrid.HeaderCell columnId="role" sortable>
              Role
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
            <DataGrid.Cell>Engineer</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
  }

  /** The sort glyph of the Name header's button, by its stable class. */
  function glyph(): Element | null {
    return sortButton('Name').querySelector(`.${dataGridHeaderCellClassNames.sortIcon}`);
  }

  it('shows an arrow up while ascending and down while descending, and nothing while unsorted', async () => {
    const user = userEvent.setup();
    renderSortIconGrid();
    expect(glyph()).toHaveAttribute('data-wave-icon', 'sort-arrow-up');
    expect(glyph()).toHaveAttribute('data-direction', 'ascending');
    expect(glyph()).toHaveAttribute('aria-hidden', 'true');
    expect(sortButton('Name')).toHaveAccessibleName('Name');
    // The unsorted header shows no glyph.
    expect(sortButton('Role').querySelector('svg')).toBeNull();

    await user.click(sortButton('Name'));
    expect(glyph()).toHaveAttribute('data-wave-icon', 'sort-arrow-down');
    expect(glyph()).toHaveAttribute('data-direction', 'descending');

    await user.click(sortButton('Role'));
    expect(glyph()).toBeNull();
    expect(
      sortButton('Role').querySelector(`.${dataGridHeaderCellClassNames.sortIcon}`),
    ).toHaveAttribute('data-wave-icon', 'sort-arrow-up');
  });

  it('renders custom content in a decorative span that carries the direction, only while sorted', async () => {
    const user = userEvent.setup();
    renderSortIconGrid(<svg data-testid="custom" />, null);
    expect(screen.queryByTestId('custom')).toBeNull();

    await user.click(sortButton('Name'));
    const span = screen.getByTestId('custom').parentElement!;
    expect(span.localName).toBe('span');
    expect(span).toHaveClass(dataGridHeaderCellClassNames.sortIcon);
    expect(span).toHaveAttribute('aria-hidden', 'true');
    expect(span).toHaveAttribute('data-direction', 'ascending');
    expect(sortButton('Name').querySelector('[data-wave-icon]')).toBeNull();
    expect(sortButton('Name')).toHaveAccessibleName('Name');

    await user.click(sortButton('Name'));
    expect(screen.getByTestId('custom').parentElement).toHaveAttribute(
      'data-direction',
      'descending',
    );
    await expectNoA11yViolations();
  });

  it('takes a slot object, its className merged after the stable class', () => {
    renderSortIconGrid({ className: 'my-glyph', children: '▲', title: 'Up' });
    expect(glyph()).toHaveClass(dataGridHeaderCellClassNames.sortIcon, 'my-glyph');
    expect(glyph()).toHaveTextContent('▲');
    expect(glyph()).toHaveAttribute('title', 'Up');
    expect(glyph()).toHaveAttribute('data-direction', 'ascending');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('keeps the default arrow for %s', (_, sortIcon) => {
    renderSortIconGrid(sortIcon);
    expect(glyph()).toHaveAttribute('data-wave-icon', 'sort-arrow-up');
  });

  it.each([
    ['false', false],
    ['an empty string', ''],
    ['an empty Fragment', <></>],
    ['an empty array', []],
  ])('shows no glyph for %s', (_, sortIcon) => {
    renderSortIconGrid(sortIcon);
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(sortButton('Name').children).toHaveLength(0);
    expect(sortButton('Name')).toHaveTextContent(/^Name$/);
  });

  it('unwraps a button passed as the glyph, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = renderSortIconGrid(
      <button type="button" className="dropped">
        ▲
      </button>,
    );
    expect(within(header('Name')).getAllByRole('button')).toHaveLength(1);
    expect(glyph()).toHaveTextContent('▲');
    expect(glyph()).not.toHaveClass('dropped');
    rerender(
      <DataGrid aria-label="People" defaultSort={SORTED}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable sortIcon={<Button />}>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
      </DataGrid>,
    );
    // An unwrapped button with no content of its own keeps the default arrow.
    expect(glyph()).toHaveAttribute('data-wave-icon', 'sort-arrow-up');
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.HeaderCell: `sortIcon` received a button element; its children render as the sort glyph and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `sortIcon={<MyIcon />}`.',
      ],
    ]);
  });

  it('is ignored on a header that is not sortable', () => {
    render(
      <DataGrid aria-label="People" defaultSort={SORTED}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortIcon={<svg data-testid="custom" />}>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
      </DataGrid>,
    );
    expect(screen.queryByTestId('custom')).toBeNull();
    expect(header('Name')).not.toHaveAttribute('sorticon');
  });
});

describe('DataGrid callback details', () => {
  it('passes the click to onSortChange, also for Enter on the sort button', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn<(sort: DataGridSort, details?: DataGridSortChangeDetails) => void>();
    renderGrid({ defaultSort: null, onSortChange });
    await user.click(sortButton('Name'));
    const [, clickDetails] = onSortChange.mock.calls[0];
    expect(clickDetails?.event).toBeInstanceOf(MouseEvent);
    expect(clickDetails?.event.type).toBe('click');
    expect(clickDetails?.event.target).toBe(sortButton('Name'));

    sortButton('Role').focus();
    await user.keyboard('{Enter}');
    const [sort, keyDetails] = onSortChange.mock.calls[1];
    expect(sort).toEqual({ columnId: 'role', direction: 'ascending' });
    expect(keyDetails?.event.type).toBe('click');
    expect(keyDetails?.event.target).toBe(sortButton('Role'));
  });

  it('passes the event to onSelectedItemsChange: a control’s click, Space on a row, select-all', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange =
      vi.fn<(items: string[], details?: DataGridSelectedItemsChangeDetails) => void>();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });

    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    act(() => cell('Bob').focus());
    await user.keyboard(' ');
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));

    const [[first, toggle], [second, space], [third, selectAll]] = onSelectedItemsChange.mock.calls;
    expect(first).toEqual(['1']);
    expect(toggle?.event.type).toBe('click');
    expect(toggle?.event.target).toBe(screen.getByRole('checkbox', { name: 'Alice' }));
    expect(second).toEqual(['1', '2']);
    expect(space?.event).toBeInstanceOf(KeyboardEvent);
    expect((space?.event as KeyboardEvent).key).toBe(' ');
    expect(third).toEqual(['1', '2', '3']);
    expect(selectAll?.event.target).toBe(screen.getByRole('checkbox', { name: 'Select all rows' }));
  });

  it('calls each callback once per change in StrictMode, with details', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const onSelectedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <DataGrid
          aria-label="People"
          items={PEOPLE}
          getRowId={(person) => person.id}
          columns={[
            {
              columnId: 'name',
              label: 'Name',
              compare: (a, b) => a.name.localeCompare(b.name),
              renderCell: (person) => person.name,
            },
          ]}
          selectionMode="multiple"
          onSortChange={onSortChange}
          onSelectedItemsChange={onSelectedItemsChange}
        />
      </React.StrictMode>,
    );
    await user.click(sortButton('Name'));
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }));
    expect(onSortChange.mock.calls).toEqual([
      [{ columnId: 'name', direction: 'ascending' }, DETAILS],
    ]);
    expect(onSelectedItemsChange.mock.calls).toEqual([[['2'], DETAILS]]);
  });

  it('keeps the 0.4 callbacks’ arguments: (columnId, direction) and a Set', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSortChange = vi.fn();
    const onSelectionChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSortChange, onSelectionChange });
    await user.click(sortButton('Name'));
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    expect(onSortChange.mock.calls).toEqual([['name', 'ascending']]);
    expect(onSelectionChange.mock.calls).toEqual([[new Set(['1'])]]);
    expect(warn.mock.calls).toEqual([[deprecated('onSelectionChange', 'onSelectedItemsChange')]]);
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

  describe('built-in text', () => {
    const labels: DataGridLabels = { selectAll: 'Velg alle rader', selectionHeader: 'Utvalg' };

    it('labels names the select-all checkbox (multiple mode)', () => {
      renderGrid({ selectionMode: 'multiple', labels });
      expect(screen.getByRole('checkbox', { name: 'Velg alle rader' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Select all rows' })).toBeNull();
    });

    it('labels names the selection column header (single mode)', () => {
      renderGrid({ selectionMode: 'single', labels });
      const [selectionHeader] = screen.getAllByRole('columnheader');
      expect(selectionHeader).toHaveAccessibleName('Utvalg');
      expect(within(selectionHeader).getByText('Utvalg')).toHaveClass('sr-only');
    });

    it('keeps the English text for the members labels leaves out', () => {
      const { rerender } = render(
        <DataGrid
          aria-label="People"
          selectionMode="multiple"
          labels={{ selectionHeader: 'Utvalg' }}
        >
          {gridContent()}
        </DataGrid>,
      );
      expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
      rerender(
        <DataGrid aria-label="People" selectionMode="single" labels={{ selectAll: 'Alle' }}>
          {gridContent()}
        </DataGrid>,
      );
      expect(screen.getAllByRole('columnheader')[0]).toHaveAccessibleName('Selection');
    });
  });

  describe('duplicate row ids', () => {
    const duplicateMessage = (rowId: string) =>
      `[WaveUI] DataGrid: several rows share the rowId "${rowId}". Row ids must be unique within a DataGrid; rows with the same rowId are selected and deselected together.`;

    function Rows({ ids }: { ids: readonly string[] }) {
      return (
        <DataGrid aria-label="People" selectionMode="multiple">
          <DataGrid.Body>
            {ids.map((id, index) => (
              <DataGrid.Row key={index} rowId={id}>
                <DataGrid.Cell>{`Row ${index + 1}`}</DataGrid.Cell>
              </DataGrid.Row>
            ))}
          </DataGrid.Body>
        </DataGrid>
      );
    }

    it('warns once per duplicated rowId', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(<Rows ids={['a', 'a', 'b', 'a', 'b', 'c']} />);
      rerender(<Rows ids={['a', 'a', 'b', 'a', 'b', 'c']} />);
      expect(warn.mock.calls).toEqual([[duplicateMessage('a')], [duplicateMessage('b')]]);
    });

    it('does not warn when rows swap their ids or a new row takes the id of a removed one', () => {
      const warn = vi.spyOn(console, 'warn');
      const { rerender } = render(<Rows ids={['a', 'b', 'c']} />);
      rerender(<Rows ids={['b', 'a', 'c']} />);
      rerender(<Rows ids={['b', 'c']} />);
      rerender(<Rows ids={['b', 'c', 'a']} />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('several header rows (grouped header)', () => {
    function body() {
      return (
        <DataGrid.Body>
          {PEOPLE.map((person) => (
            <DataGrid.Row key={person.id} rowId={person.id}>
              <DataGrid.Cell>{person.name}</DataGrid.Cell>
              <DataGrid.Cell>{person.role}</DataGrid.Cell>
              <DataGrid.Cell>-</DataGrid.Cell>
            </DataGrid.Row>
          ))}
        </DataGrid.Body>
      );
    }

    function groupRow() {
      return (
        <>
          <DataGrid.HeaderCell colSpan={2}>Person</DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Other</DataGrid.HeaderCell>
        </>
      );
    }

    function columnRow() {
      return (
        <>
          <DataGrid.HeaderCell columnId="name" sortable>
            Name
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Role</DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Notes</DataGrid.HeaderCell>
        </>
      );
    }

    function GroupedGrid({
      selectionMode = 'multiple',
      withGroupRow = true,
    }: {
      selectionMode?: 'single' | 'multiple';
      withGroupRow?: boolean;
    }) {
      return (
        <DataGrid aria-label="People" selectionMode={selectionMode}>
          <DataGrid.Header>
            {withGroupRow && <tr>{groupRow()}</tr>}
            <tr>{columnRow()}</tr>
          </DataGrid.Header>
          {body()}
        </DataGrid>
      );
    }

    function headerRows(): HTMLTableRowElement[] {
      return Array.from(screen.getByRole('grid').querySelectorAll('thead > tr'));
    }

    it('renders one "Select all rows" control, in the first header row', () => {
      const warn = vi.spyOn(console, 'warn');
      render(<GroupedGrid />);
      const selectAll = screen.getAllByRole('checkbox', { name: 'Select all rows' });
      expect(selectAll).toHaveLength(1);
      const [first, second] = headerRows();
      expect(selectAll[0].closest('tr')).toBe(first);
      // The later row keeps the selection column with an empty cell (no second control).
      expect(second.cells[0]).toHaveAttribute('data-selection-cell');
      expect(second.cells[0].tagName.toLowerCase()).toBe('td');
      expect(second.cells[0]).toBeEmptyDOMElement();
      expect(within(second).getAllByRole('columnheader')).toHaveLength(3);
      expect(warn).not.toHaveBeenCalled();
    });

    it('renders the single-mode "Selection" header once', () => {
      render(<GroupedGrid selectionMode="single" />);
      expect(screen.getAllByText('Selection')).toHaveLength(1);
      expect(screen.getByText('Selection').closest('tr')).toBe(headerRows()[0]);
    });

    it('keeps a single tab stop and moves between the header rows with the arrow keys', async () => {
      const user = userEvent.setup();
      render(<GroupedGrid />);
      const grid = screen.getByRole('grid');
      expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      act(() => selectAll.focus());
      await user.keyboard('{ArrowDown}');
      expect(headerRows()[1].cells[0]).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(sortButton('Name')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(cell('Alice')).toHaveFocus();
    });

    it.each(['single', 'multiple'] as const)(
      'keeps the visual column with Up/Down/PageUp/PageDown across the spanning group cell (%s selection)',
      async (selectionMode) => {
        const user = userEvent.setup();
        render(<GroupedGrid selectionMode={selectionMode} />);
        // Row 1: selection, Person (2 columns), Other. Row 2: selection, Name, Role, Notes.
        act(() => header('Role').focus());
        await user.keyboard('{ArrowUp}');
        expect(header('Person')).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(sortButton('Name')).toHaveFocus();

        act(() => header('Notes').focus());
        await user.keyboard('{ArrowUp}');
        expect(header('Other')).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(header('Notes')).toHaveFocus();

        act(() => header('Other').focus());
        await user.keyboard('{PageDown}');
        expect(cell('-', 2)).toHaveFocus();
        await user.keyboard('{PageUp}');
        expect(header('Other')).toHaveFocus();
      },
    );

    it('keeps the visual column without a selection column too', async () => {
      const user = userEvent.setup();
      renderGrid({ children: groupedGridContent() });
      act(() => header('Other').focus());
      await user.keyboard('{ArrowDown}');
      expect(header('Notes')).toHaveFocus();
      act(() => header('Role').focus());
      await user.keyboard('{ArrowUp}');
      expect(header('Person')).toHaveFocus();
    });

    it('treats a header cell spanning both header rows as the cell above and below them', async () => {
      const user = userEvent.setup();
      render(
        <DataGrid aria-label="People" selectionMode="multiple">
          <DataGrid.Header>
            <tr>
              <DataGrid.HeaderCell rowSpan={2} columnId="name" sortable>
                Name
              </DataGrid.HeaderCell>
              <DataGrid.HeaderCell colSpan={2}>Details</DataGrid.HeaderCell>
            </tr>
            <tr>
              <DataGrid.HeaderCell>Role</DataGrid.HeaderCell>
              <DataGrid.HeaderCell>Notes</DataGrid.HeaderCell>
            </tr>
          </DataGrid.Header>
          {body()}
        </DataGrid>,
      );
      act(() => cell('Alice').focus());
      await user.keyboard('{ArrowUp}');
      expect(sortButton('Name')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(cell('Alice')).toHaveFocus();

      act(() => cell('Engineer').focus());
      await user.keyboard('{ArrowUp}');
      expect(header('Role')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(header('Details')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(header('Role')).toHaveFocus();
      await expectNoA11yViolations(document.body);
    });

    it('selects every row from the one control', async () => {
      const user = userEvent.setup();
      render(<GroupedGrid />);
      await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
      expect(bodyRows().every((row) => row.getAttribute('aria-selected') === 'true')).toBe(true);
    });

    it('moves the control to a header row added above the others', () => {
      const { rerender } = render(<GroupedGrid withGroupRow={false} />);
      expect(screen.getAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(1);
      rerender(<GroupedGrid withGroupRow />);
      const selectAll = screen.getAllByRole('checkbox', { name: 'Select all rows' });
      expect(selectAll).toHaveLength(1);
      expect(selectAll[0].closest('tr')).toBe(headerRows()[0]);
      expect(headerRows()[1].cells[0]).toBeEmptyDOMElement();
      rerender(<GroupedGrid withGroupRow={false} />);
      expect(screen.getAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(1);
      expect(headerRows()).toHaveLength(1);
    });

    it('renders one control for header rows that other components render as DataGrid.Row', () => {
      const warn = vi.spyOn(console, 'warn');
      function GroupHeaderRow() {
        return <DataGrid.Row>{groupRow()}</DataGrid.Row>;
      }
      function ColumnHeaderRow() {
        return <DataGrid.Row>{columnRow()}</DataGrid.Row>;
      }
      render(
        <DataGrid aria-label="People" selectionMode="multiple">
          <DataGrid.Header>
            <GroupHeaderRow />
            <ColumnHeaderRow />
          </DataGrid.Header>
          {body()}
        </DataGrid>,
      );
      const selectAll = screen.getAllByRole('checkbox', { name: 'Select all rows' });
      expect(selectAll).toHaveLength(1);
      expect(selectAll[0].closest('tr')).toBe(headerRows()[0]);
      expect(headerRows()[1].cells[0]).toHaveAttribute('data-selection-cell');
      expect(headerRows()[1].cells[0]).toBeEmptyDOMElement();
      expect(warn).not.toHaveBeenCalled();
    });

    it('renders one control on the server too', () => {
      const html = renderToString(
        <DataGrid aria-label="People" selectionMode="multiple">
          <DataGrid.Header>
            <tr>{groupRow()}</tr>
            <DataGrid.Row>{columnRow()}</DataGrid.Row>
          </DataGrid.Header>
          {body()}
        </DataGrid>,
      );
      expect(html.match(/Select all rows/g)).toHaveLength(1);
    });
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
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.Header: a header row has no selection column header cell, so the header has one column fewer than the selectable rows. Render header rows as `<tr>` children of DataGrid.Header (a Fragment is fine), or use `DataGrid.Row` for a header row that another component renders.',
      ],
    ]);
  });

  it('does not warn about the selection header cell for the supported header rows', () => {
    const warn = vi.spyOn(console, 'warn');
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

  describe('selection control name without selectionLabel', () => {
    function NameCell({ name }: { name: string }) {
      return <DataGrid.Cell>{name}</DataGrid.Cell>;
    }

    function renderRow(children: React.ReactNode) {
      return render(
        <DataGrid aria-label="People" selectionMode="multiple">
          <DataGrid.Body>
            <DataGrid.Row rowId="1">{children}</DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
    }

    it('is "Select row", with a warning, when no child is a DataGrid.Cell, <td> or <th>', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderRow(<NameCell name="Alice" />);
      const checkbox = screen.getByRole('checkbox', { name: 'Select row' });
      expect(checkbox).not.toHaveAttribute('aria-labelledby');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] DataGrid.Row: no child is a `DataGrid.Cell`, `<td>` or `<th>` element, so the row selection control is named "Select row". Pass `selectionLabel` (a cell rendered by another component is not seen).',
        ],
      ]);
      warn.mockRestore();
      await expectNoA11yViolations(document.body);
    });

    it('comes from the first DataGrid.Cell child: a cell another component renders is not seen', () => {
      const warn = vi.spyOn(console, 'warn');
      renderRow([
        <NameCell key="name" name="Alice" />,
        <DataGrid.Cell key="email">alice@example.com</DataGrid.Cell>,
      ]);
      expect(screen.getByRole('checkbox', { name: 'alice@example.com' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it('comes from the first cell inside a Fragment, and the cells stay mounted across modes', () => {
      const warn = vi.spyOn(console, 'warn');
      const grid = (selectionMode: 'none' | 'multiple') => (
        <DataGrid aria-label="People" selectionMode={selectionMode}>
          <DataGrid.Body>
            <DataGrid.Row rowId="1">
              <>
                <DataGrid.Cell>Alice</DataGrid.Cell>
                <DataGrid.Cell>
                  <input aria-label="Note" />
                </DataGrid.Cell>
              </>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>
      );
      const { rerender } = render(grid('multiple'));
      expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeInTheDocument();
      const input = screen.getByRole('textbox', { name: 'Note' });
      rerender(grid('none'));
      rerender(grid('multiple'));
      expect(screen.getByRole('textbox', { name: 'Note' })).toBe(input);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['<td>', <td key="td">Alice</td>],
      ['<th>', <th key="th">Alice</th>],
    ])('comes from a raw %s first child', (_label, first) => {
      const warn = vi.spyOn(console, 'warn');
      renderRow([first, <DataGrid.Cell key="role">Engineer</DataGrid.Cell>]);
      expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });
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

  it('keeps the single-mode radios out of an enclosing form (no extra form field)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Edit people" data-testid="form">
        <input name="real" defaultValue="1" />
        <DataGrid aria-label="People" selectionMode="single">
          {gridContent()}
        </DataGrid>
      </form>,
    );
    await user.click(screen.getByRole('radio', { name: 'Bob' }));
    expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();

    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(Array.from(new FormData(form).entries())).toEqual([['real', '1']]);
    for (const radio of screen.getAllByRole<HTMLInputElement>('radio')) {
      // Not associated with the form, but still one named group.
      expect(radio.form).toBeNull();
      expect(radio.name).toBe(screen.getAllByRole<HTMLInputElement>('radio')[0].name);
    }
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
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.Row: a selectable grid needs a `rowId` on every row; this row has no selection control.',
      ],
    ]);
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
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1'], DETAILS);
    await user.click(screen.getByRole('checkbox', { name: 'Carol' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '3'], DETAILS);
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
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['2'], DETAILS);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(['2']));
    expect(warn.mock.calls).toEqual([[deprecated('onSelectionChange', 'onSelectedItemsChange')]]);
  });

  it.each([
    ['a Set', new Set(['1'])],
    ['an array', ['1']],
  ])('accepts the deprecated selectedKeys as %s', (_label, selectedKeys) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ selectionMode: 'multiple', selectedKeys });
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'true');
    expect(bodyRows()[1]).toHaveAttribute('aria-selected', 'false');
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid: `selectedKeys` is deprecated and will be removed in 1.0. Use `selectedItems` instead.',
      ],
    ]);
  });

  it('accepts the deprecated defaultSelectedKeys and warns about the deprecated names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderGrid({ selectionMode: 'multiple', defaultSelectedKeys: new Set(['3']) });
    expect(bodyRows()[2]).toHaveAttribute('aria-selected', 'true');
    expect(warn.mock.calls).toEqual([[deprecated('defaultSelectedKeys', 'defaultSelectedItems')]]);
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
    expect(onSelectedItemsChange.mock.calls).toEqual([
      [['1'], DETAILS],
      [['2'], DETAILS],
    ]);
    expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Alice' })).not.toBeChecked();
  });

  it('select-all selects every row, then clears', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });

    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3'], DETAILS);
    expect(selectAll).toBeChecked();
    expect(bodyRows().every((row) => row.getAttribute('aria-selected') === 'true')).toBe(true);

    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], DETAILS);
    expect(selectAll).not.toBeChecked();
  });

  it('shows a partial selection as indeterminate and selects all from it', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', defaultSelectedItems: ['2'], onSelectedItemsChange });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll).toBePartiallyChecked();
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3'], DETAILS);
    expect(selectAll).not.toBePartiallyChecked();
    expect(selectAll).toBeChecked();
  });

  it('stays mixed after a click when a controlled parent keeps the selection partial', async () => {
    const user = userEvent.setup();
    function Filtering() {
      const [selected, setSelected] = React.useState<string[]>(['1']);
      return (
        <DataGrid
          aria-label="People"
          selectionMode="multiple"
          selectedItems={selected}
          // Carol's row cannot be selected (a locked row, a selection limit).
          onSelectedItemsChange={(items) => setSelected(items.filter((id) => id !== '3'))}
        >
          {gridContent()}
        </DataGrid>
      );
    }
    render(<Filtering />);
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll).toBePartiallyChecked();
    await user.click(selectAll);
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Carol' })).not.toBeChecked();
    expect(selectAll).toBePartiallyChecked();
    expect(selectAll).not.toBeChecked();
  });

  it('stays mixed after clicks that a controlled parent ignores', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', selectedItems: ['1'], onSelectedItemsChange });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3'], DETAILS);
    expect(selectAll).toBePartiallyChecked();
    expect(selectAll).not.toBeChecked();
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
    expect(selectAll).toBePartiallyChecked();
  });

  it('toggles the row with Space on a focused cell', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    const bob = cell('Bob');
    act(() => bob.focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2'], DETAILS);
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], DETAILS);
  });

  it('toggles once with Space on the row checkbox', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    act(() => screen.getByRole('checkbox', { name: 'Alice' }).focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1'], DETAILS);
  });

  describe('single mode with several selected ids', () => {
    const SEVERAL_SELECTED =
      '[WaveUI] DataGrid: a single-selection grid (selectionMode "single") has';

    /** Per body row: `aria-selected` and whether its radio is checked. */
    function rowStates(): Array<[string | null, boolean]> {
      return bodyRows().map((row) => [
        row.getAttribute('aria-selected'),
        within(row).getByRole<HTMLInputElement>('radio').checked,
      ]);
    }

    it('selects only the first selected row after switching from multiple, and warns', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onSelectedItemsChange = vi.fn();
      const grid = (selectionMode: 'single' | 'multiple') => (
        <DataGrid
          aria-label="People"
          selectionMode={selectionMode}
          defaultSelectedItems={['1', '2']}
          onSelectedItemsChange={onSelectedItemsChange}
        >
          {gridContent()}
        </DataGrid>
      );
      const { rerender } = render(grid('multiple'));
      expect(warn).not.toHaveBeenCalled();
      rerender(grid('single'));
      expect(rowStates()).toEqual([
        ['true', true],
        ['false', false],
        ['false', false],
      ]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(SEVERAL_SELECTED));

      await user.click(screen.getByRole('radio', { name: 'Bob' }));
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
      expect(onSelectedItemsChange).toHaveBeenCalledWith(['2'], DETAILS);
      expect(rowStates()).toEqual([
        ['false', false],
        ['true', true],
        ['false', false],
      ]);
    });

    it('selects only the first rendered id of a controlled selection, and warns once', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onSelectedItemsChange = vi.fn();
      // '9' is not rendered: Bob is the first selected row that is.
      renderGrid({
        selectionMode: 'single',
        selectedItems: ['9', '2', '1'],
        onSelectedItemsChange,
      });
      expect(rowStates()).toEqual([
        ['false', false],
        ['true', true],
        ['false', false],
      ]);
      await user.click(screen.getByRole('radio', { name: 'Alice' }));
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1'], DETAILS);
      act(() => cell('Bob').focus());
      await user.keyboard(' ');
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], DETAILS);
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        `${SEVERAL_SELECTED} 3 selected row ids; only the first one that is rendered is selected. Pass at most one id in \`selectedItems\`/\`defaultSelectedItems\`, or use selectionMode="multiple".`,
      );
    });

    it('does not warn for one selected id', () => {
      const warn = vi.spyOn(console, 'warn');
      renderGrid({ selectionMode: 'single', defaultSelectedItems: ['2'] });
      renderGrid({ selectionMode: 'multiple', defaultSelectedItems: ['1', '2'] });
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('deselects the selected row with Space in single mode', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'single', defaultSelectedItems: ['1'], onSelectedItemsChange });
    act(() => cell('Alice').focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenCalledWith([], DETAILS);
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

    it('ignores Space typed in a portal opened from a row (React bubbling)', async () => {
      const user = userEvent.setup();
      const onSelectedItemsChange = vi.fn();
      function PortalNote() {
        return createPortal(<input aria-label="Portal note" />, document.body);
      }
      render(
        <DataGrid
          aria-label="People"
          selectionMode="multiple"
          onSelectedItemsChange={onSelectedItemsChange}
        >
          <DataGrid.Body>
            <DataGrid.Row rowId="1">
              <DataGrid.Cell>
                Alice
                <PortalNote />
              </DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>,
      );
      const note = screen.getByRole('textbox', { name: 'Portal note' });
      await user.click(note);
      await user.keyboard(' a');
      expect(note).toHaveValue(' a');
      expect(onSelectedItemsChange).not.toHaveBeenCalled();
      expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'false');
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
    expect(onSelectedItemsChange.mock.calls).toEqual([
      [['1'], DETAILS],
      [['1'], DETAILS],
    ]);
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
    expect(warn.mock.calls).toEqual([[switchWarning('controlled', 'uncontrolled')]]);
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
    expect(warn.mock.calls).toEqual([[switchWarning('uncontrolled', 'controlled')]]);
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
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '3'], DETAILS);
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

describe('DataGrid selection store', () => {
  it('notifies the rows only when the selection changes, never when rows register', () => {
    const store = createSelectionStore(['1']);
    const rowListener = vi.fn();
    const selectAllListener = vi.fn();
    store.subscribe(rowListener);
    store.subscribeSelectAll(selectAllListener);

    const unregister = Array.from({ length: 1000 }, (_, index) => store.register(String(index)));
    expect(store.getSelectAllState()).toBe('some');
    // Filtering 1000 rows down to '0' and '1' notifies no row.
    for (const done of unregister.slice(2)) done();
    expect(rowListener).not.toHaveBeenCalled();
    expect(store.getSelectAllState()).toBe('some');
    unregister[0]();
    expect(store.getSelectAllState()).toBe('all');
    // The select-all subscribers hear only the state changes: none -> some -> all.
    expect(selectAllListener).toHaveBeenCalledTimes(2);

    store.setSelected([]);
    expect(rowListener).toHaveBeenCalledTimes(1);
    expect(store.getSelectAllState()).toBe('none');
    expect(selectAllListener).toHaveBeenCalledTimes(3);
    store.setSelected([]);
    expect(rowListener).toHaveBeenCalledTimes(1);
  });

  it('keeps the select-all state in step with registrations and the selection', () => {
    const store = createSelectionStore([]);
    expect(store.getSelectAllState()).toBe('none');
    const a1 = store.register('a');
    const a2 = store.register('a');
    const b = store.register('b');
    expect(store.getRegistered()).toEqual(['a', 'b']);

    store.setSelected(['a', 'x']);
    expect(store.isSelected('a')).toBe(true);
    expect(store.getSelectAllState()).toBe('some');
    expect(store.prune(['x', 'a'])).toEqual(['a']);
    // 'a' is registered twice: it stays registered until both registrations are gone.
    a1();
    expect(store.getSelectAllState()).toBe('some');
    b();
    expect(store.getSelectAllState()).toBe('all');
    a2();
    expect(store.getRegistered()).toEqual([]);
    expect(store.getSelectAllState()).toBe('none');
    // A selected id registered later counts at once.
    store.register('x');
    expect(store.getSelectAllState()).toBe('all');
    store.register('y');
    expect(store.getSelectAllState()).toBe('some');
    store.setSelected(['x', 'y']);
    expect(store.getSelectAllState()).toBe('all');
  });

  it('selects one row in single mode: the first selected id whose row is registered', () => {
    const store = createSelectionStore(['9', 'b', 'a'], true);
    const rowListener = vi.fn();
    store.subscribe(rowListener);
    // No row registered yet (the server render): the first selected id.
    expect(store.isSelected('9', true)).toBe(true);
    const a = store.register('a');
    expect(store.isSelected('a', true)).toBe(true);
    expect(store.isSelected('9', true)).toBe(false);
    expect(rowListener).toHaveBeenCalledTimes(1);
    const b = store.register('b');
    expect(store.isSelected('b', true)).toBe(true);
    expect(store.isSelected('a', true)).toBe(false);
    // Without `single`, every selected id is selected.
    expect(store.isSelected('a')).toBe(true);
    expect(rowListener).toHaveBeenCalledTimes(2);
    // Rows that do not move the selected row notify no row.
    store.register('c');
    a();
    expect(rowListener).toHaveBeenCalledTimes(2);
    b();
    expect(store.isSelected('9', true)).toBe(true);
    expect(rowListener).toHaveBeenCalledTimes(3);

    // In multiple mode, rows registering notify no row.
    store.setSingleMode(false);
    store.register('b');
    expect(rowListener).toHaveBeenCalledTimes(3);
    expect(store.isSelected('b', true)).toBe(true);
  });
});

describe('DataGrid selection store with a universe (a grid with `items`)', () => {
  const THOUSAND = Array.from({ length: 1000 }, (_, index) => String(index));

  it('takes select-all from the universe, never from registrations, and rows registering notify nothing', () => {
    // '0' is disabled by the data (`isSelectionDisabled`).
    const store = createSelectionStore(['1'], false, { ids: THOUSAND, disabled: new Set(['0']) });
    const rowListener = vi.fn();
    const selectAllListener = vi.fn();
    store.subscribe(rowListener);
    store.subscribeSelectAll(selectAllListener);
    // Known from the start, before any row registered (the server render).
    expect(store.getSelectAllState()).toBe('some');
    expect(store.getSelectableIds()).toEqual(THOUSAND.slice(1));

    // A window of 30 rows mounting and unmounting changes nothing.
    const unregister = THOUSAND.slice(0, 30).map((rowId) => store.register(rowId));
    for (const done of unregister) done();
    expect(store.getSelectAllState()).toBe('some');
    expect(rowListener).not.toHaveBeenCalled();
    expect(selectAllListener).not.toHaveBeenCalled();

    // Every selectable id: all, the disabled '0' and an id outside the universe aside.
    store.setSelected([...THOUSAND.slice(1), 'x']);
    expect(store.getSelectAllState()).toBe('all');
    expect(rowListener).toHaveBeenCalledTimes(1);
    expect(selectAllListener).toHaveBeenCalledTimes(1);

    // A rendered row that disables its selection leaves select-all too, until it stops.
    store.setSelected(THOUSAND.slice(2));
    expect(store.getSelectAllState()).toBe('some');
    const enable = store.disable('1');
    expect(store.getSelectAllState()).toBe('all');
    expect(store.getSelectableIds()).toEqual(THOUSAND.slice(2));
    enable();
    expect(store.getSelectAllState()).toBe('some');

    // A selected disabled id and ids outside the universe count toward nothing.
    store.setSelected(['0', 'x']);
    expect(store.getSelectAllState()).toBe('none');
    expect(rowListener).toHaveBeenCalledTimes(3);
  });

  it('notifies no row when the universe changes, and returns to registrations without one', () => {
    const store = createSelectionStore(['a'], false, { ids: ['a', 'b'], disabled: new Set() });
    const rowListener = vi.fn();
    store.subscribe(rowListener);
    const unregisterB = store.register('b');
    expect(store.getSelectAllState()).toBe('some');
    // The items are filtered down to 'a'.
    store.setUniverse({ ids: ['a'], disabled: new Set() });
    expect(store.getSelectAllState()).toBe('all');
    expect(store.getUniverseIds()).toEqual(['a']);
    // 'a' disabled by the data: nothing select-all can change is selected.
    store.setUniverse({ ids: ['a'], disabled: new Set(['a']) });
    expect(store.getSelectAllState()).toBe('none');
    expect(store.getSelectableIds()).toEqual([]);
    // Without a universe (no `items`), the registered rows count again: 'b' only.
    store.setUniverse(null);
    expect(store.getSelectAllState()).toBe('none');
    expect(store.getSelectableIds()).toEqual(['b']);
    unregisterB();
    expect(rowListener).not.toHaveBeenCalled();
  });

  it('selects the first selected id in single mode, whether its row is registered or not', () => {
    const store = createSelectionStore(['9', 'b'], true, { ids: ['a', 'b'], disabled: new Set() });
    const rowListener = vi.fn();
    store.subscribe(rowListener);
    store.register('a');
    store.register('b');
    expect(store.isSelected('9', true)).toBe(true);
    expect(store.isSelected('b', true)).toBe(false);
    expect(rowListener).not.toHaveBeenCalled();
  });
});

describe('DataGrid selection that follows the data (`items`)', () => {
  interface Entry {
    id: string;
    name: string;
  }

  /** 100 items, ids '0' to '99'. */
  const ENTRIES: readonly Entry[] = Array.from({ length: 100 }, (_, index) => ({
    id: String(index),
    name: `Entry ${index}`,
  }));
  const idsOf = (entries: readonly Entry[]) => entries.map((entry) => entry.id);
  const ALL_IDS = idsOf(ENTRIES);
  /** Ten items, every one rendered: '7', '17', … '97'. */
  const SEVENS = ENTRIES.filter((entry) => entry.id.endsWith('7'));
  const SEVEN_IDS = idsOf(SEVENS);
  const entryId = (entry: Entry) => entry.id;
  /** The rows that mount: the first ten items stand for the rows of a window. */
  const MOUNTED = 10;

  function renderEntry(entry: Entry, index: number) {
    return index < MOUNTED ? (
      <DataGrid.Row>
        <DataGrid.Cell>{entry.name}</DataGrid.Cell>
      </DataGrid.Row>
    ) : null;
  }

  type EntryGridProps = Omit<Partial<DataGridBaseProps<Entry>>, 'children'> & {
    items?: readonly Entry[];
  };

  /** A multiple-selection grid of `items` that renders only the first ten rows. */
  function EntryGrid({ items = ENTRIES, ...props }: EntryGridProps) {
    return (
      <DataGrid
        aria-label="Entries"
        items={items}
        getRowId={entryId}
        selectionMode="multiple"
        {...props}
      >
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>{renderEntry}</DataGrid.Body>
      </DataGrid>
    );
  }

  const selectAll = () => screen.getByRole('checkbox', { name: 'Select all rows' });

  const SINGLE_SEVERAL_SELECTED =
    '[WaveUI] DataGrid: a single-selection grid (selectionMode "single") has 2 selected row ids; only the first one is selected. Pass at most one id in `selectedItems`/`defaultSelectedItems`, or use selectionMode="multiple".';

  const selectionDisabledMismatch = (rowId: string, cell: string, data: string) =>
    `[WaveUI] DataGrid: the selection cell of row "${rowId}" is ${cell} (\`DataGrid.SelectionCell disabled\` or \`selectionCellProps.disabled\`), but \`isSelectionDisabled\` says its item is ${data}. Select-all skips a row that either one disables, and the row's control follows its cell: make them agree, or leave the cell's \`disabled\` unset to take it from \`isSelectionDisabled\`.`;

  it('select-all selects every item of `items`, rendered or not, and its next toggle clears them', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(<EntryGrid onSelectedItemsChange={onSelectedItemsChange} />);
    expect(bodyRows()).toHaveLength(MOUNTED);

    await user.click(screen.getByRole('checkbox', { name: 'Entry 3' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['3'], DETAILS);
    expect(selectAll()).toBePartiallyChecked();

    await user.click(selectAll());
    // The 100 ids of `items`, in their order, not the ten rendered rows.
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(ALL_IDS, DETAILS);
    expect(selectAll()).toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();

    await user.click(selectAll());
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], DETAILS);
    expect(selectAll()).not.toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(3);
  });

  it('draws the select-all state from the data: the rendered rows alone are not all', () => {
    const { rerender } = render(<EntryGrid selectedItems={ALL_IDS.slice(0, MOUNTED)} />);
    // Every rendered row is selected, 90 items are not.
    expect(selectAll()).toBePartiallyChecked();
    // Only an item whose row is not rendered.
    rerender(<EntryGrid selectedItems={['50']} />);
    expect(selectAll()).toBePartiallyChecked();
    rerender(<EntryGrid selectedItems={ALL_IDS} />);
    expect(selectAll()).toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();
    // An id that is not in `items` counts toward nothing.
    rerender(<EntryGrid selectedItems={['x']} />);
    expect(selectAll()).not.toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();
  });

  it('renders the select-all state from the data on the server', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<EntryGrid defaultSelectedItems={ALL_IDS} />);
    const control = container.querySelector('input[aria-label="Select all rows"]');
    expect(control).toHaveAttribute('checked');
  });

  it('keeps the ids of rows that are not rendered or not in `items` through a row click, Space and the control', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const grid = (items: readonly Entry[]) => (
      <EntryGrid
        items={items}
        selectOnRowClick
        defaultSelectedItems={['50', '99']}
        onSelectedItemsChange={onSelectedItemsChange}
      />
    );
    const { rerender } = render(grid(ENTRIES));
    await user.click(screen.getByText('Entry 3'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['50', '99', '3'], DETAILS);

    // Filtered: '50', '99' and '3' are no longer in `items`.
    rerender(grid(SEVENS));
    expect(selectAll()).not.toBePartiallyChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Entry 7' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['50', '99', '3', '7'], DETAILS);
    act(() => cell('Entry 17').focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['50', '99', '3', '7', '17'], DETAILS);
    await user.click(screen.getByText('Entry 7'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['50', '99', '3', '17'], DETAILS);
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(4);

    // Back to every item: the ids kept all along are selected.
    rerender(grid(ENTRIES));
    expect(screen.getByRole('checkbox', { name: 'Entry 3' })).toBeChecked();
  });

  it('select-all over filtered items adds their ids and keeps the others; its next toggle removes only theirs', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(
      <EntryGrid
        items={SEVENS}
        defaultSelectedItems={['3', '17']}
        onSelectedItemsChange={onSelectedItemsChange}
      />,
    );
    expect(selectAll()).toBePartiallyChecked();
    await user.click(selectAll());
    // The id outside `items` first, then every id of `items` in their order.
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['3', ...SEVEN_IDS], DETAILS);
    expect(selectAll()).toBeChecked();
    await user.click(selectAll());
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['3'], DETAILS);
    expect(selectAll()).not.toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();
  });

  it('deselect-all after filtering removes only the ids of the filtered items', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const grid = (items: readonly Entry[]) => (
      <EntryGrid
        items={items}
        defaultSelectedItems={ALL_IDS}
        onSelectedItemsChange={onSelectedItemsChange}
      />
    );
    const { rerender } = render(grid(ENTRIES));
    expect(selectAll()).toBeChecked();
    rerender(grid(SEVENS));
    expect(selectAll()).toBeChecked();
    await user.click(selectAll());
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(
      ALL_IDS.filter((id) => !SEVEN_IDS.includes(id)),
      DETAILS,
    );
    expect(selectAll()).not.toBeChecked();
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the ids outside `items` through a sort and a replacement of `items`', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const columns: readonly DataGridColumn<Entry>[] = [
      createTableColumn<Entry>({
        columnId: 'name',
        label: 'Name',
        compare: (a, b) => a.name.localeCompare(b.name),
        renderCell: (entry) => entry.name,
      }),
    ];
    const grid = (items: readonly Entry[]) => (
      <DataGrid
        aria-label="Entries"
        items={items}
        columns={columns}
        getRowId={entryId}
        selectionMode="multiple"
        defaultSort={{ columnId: 'name', direction: 'ascending' }}
        defaultSelectedItems={['3']}
        onSelectedItemsChange={onSelectedItemsChange}
      />
    );
    const { rerender } = render(grid(SEVENS));
    await user.click(sortButton('Name'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    await user.click(selectAll());
    // The order of `items`, not the sorted order.
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['3', ...SEVEN_IDS], DETAILS);

    // New objects with the same ids, and one more item.
    rerender(grid([...SEVENS.map((entry) => ({ ...entry })), ENTRIES[8]]));
    expect(selectAll()).toBePartiallyChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Entry 97' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(
      ['3', ...SEVEN_IDS.filter((id) => id !== '97')],
      DETAILS,
    );
  });

  it('leaves the items that `isSelectionDisabled` disables out of select-all and its state, keeping their selection', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    const onSelectedItemsChange = vi.fn();
    // Every tenth item: '0', '10', … '90'.
    const isSelectionDisabled = vi.fn((_entry: Entry, index: number) => index % 10 === 0);
    render(
      <EntryGrid
        isSelectionDisabled={isSelectionDisabled}
        selectOnRowClick
        defaultSelectedItems={['0']}
        onSelectedItemsChange={onSelectedItemsChange}
      />,
    );
    expect(isSelectionDisabled).toHaveBeenCalledWith(ENTRIES[55], 55);
    // The rendered row of a disabled item: its control is disabled, a click and Space keep it.
    const first = screen.getByRole('checkbox', { name: 'Entry 0' });
    expect(first).toBeDisabled();
    expect(first).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Entry 1' })).toBeEnabled();
    await user.click(screen.getByText('Entry 0'));
    act(() => cell('Entry 0').focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    // No item that select-all can change is selected.
    expect(selectAll()).not.toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();

    await user.click(selectAll());
    // Every selectable item, and '0', kept; '10' … '90' stay unselected.
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(
      ALL_IDS.filter((_, index) => index === 0 || index % 10 !== 0),
      DETAILS,
    );
    expect(selectAll()).toBeChecked();
    await user.click(selectAll());
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['0'], DETAILS);
    expect(first).toBeChecked();
    expect(selectAll()).not.toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once when a rendered row’s selection cell disagrees with `isSelectionDisabled`; either one keeps the row out of select-all', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSelectedItemsChange = vi.fn();
    // '0' disables what the data allows, '1' allows what the data disables; '2' and '3' leave it
    // to the data.
    const cellDisabled: Record<string, boolean | undefined> = { '0': true, '1': false };
    render(
      <DataGrid
        aria-label="Entries"
        items={ENTRIES.slice(0, 4)}
        getRowId={entryId}
        selectionMode="multiple"
        isSelectionDisabled={(entry) => entry.id === '1' || entry.id === '3'}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
            <DataGrid.SelectionCell />
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          {(entry: Entry) => (
            <DataGrid.Row>
              <DataGrid.Cell>{entry.name}</DataGrid.Cell>
              <DataGrid.SelectionCell disabled={cellDisabled[entry.id]} />
            </DataGrid.Row>
          )}
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(warn.mock.calls).toEqual([[selectionDisabledMismatch('0', 'disabled', 'enabled')]]);
    // The control follows the row's cell.
    expect(screen.getByRole('checkbox', { name: 'Entry 0' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Entry 1' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Entry 2' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Entry 3' })).toBeDisabled();
    await user.click(selectAll());
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2'], DETAILS);
    expect(selectAll()).toBeChecked();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn when the rows’ selection cells agree with `isSelectionDisabled`, or without it', () => {
    const warn = vi.spyOn(console, 'warn');
    const row = (entry: Entry, disabled: boolean) => (
      <DataGrid.Row selectionCellProps={{ disabled }}>
        <DataGrid.Cell>{entry.name}</DataGrid.Cell>
      </DataGrid.Row>
    );
    render(
      <>
        <DataGrid
          aria-label="Agreeing"
          items={ENTRIES.slice(0, 3)}
          getRowId={entryId}
          selectionMode="multiple"
          isSelectionDisabled={(entry) => entry.id === '1'}
        >
          <DataGrid.Body>{(entry: Entry) => row(entry, entry.id === '1')}</DataGrid.Body>
        </DataGrid>
        <DataGrid
          aria-label="Without"
          items={ENTRIES.slice(0, 3)}
          getRowId={entryId}
          selectionMode="multiple"
        >
          <DataGrid.Body>{(entry: Entry) => row(entry, entry.id === '2')}</DataGrid.Body>
        </DataGrid>
      </>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the one selected id of single mode when `items` changes, and replaces it on a click', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const grid = (items: readonly Entry[]) => (
      <EntryGrid
        items={items}
        selectionMode="single"
        selectOnRowClick
        defaultSelectedItems={['50']}
        onSelectedItemsChange={onSelectedItemsChange}
      />
    );
    const { rerender } = render(grid(ENTRIES));
    // '50' is not rendered.
    expect(bodyRows().map((row) => row.getAttribute('aria-selected'))).not.toContain('true');
    rerender(grid(SEVENS));
    // Rendered again (the ten items from '45').
    rerender(grid(ENTRIES.slice(45, 55)));
    expect(screen.getByRole('radio', { name: 'Entry 50' })).toBeChecked();
    expect(onSelectedItemsChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: 'Entry 47' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['47'], DETAILS);
    expect(screen.getByRole('radio', { name: 'Entry 50' })).not.toBeChecked();
    // A click on the selected row clears it, as without `items`.
    await user.click(screen.getByText('Entry 47'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], DETAILS);
  });

  it('selects only the first id in single mode, rendered or not, and warns once', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSelectedItemsChange = vi.fn();
    render(
      <EntryGrid
        selectionMode="single"
        selectedItems={['50', '3']}
        onSelectedItemsChange={onSelectedItemsChange}
      />,
    );
    // '50' is the selected id; its row is not rendered, and row 3 is not selected.
    expect(bodyRows().map((row) => row.getAttribute('aria-selected'))).not.toContain('true');
    expect(screen.getByRole('radio', { name: 'Entry 3' })).not.toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Entry 3' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['3'], DETAILS);
    expect(warn.mock.calls).toEqual([[SINGLE_SEVERAL_SELECTED]]);
  });

  it('types `isSelectionDisabled` by the items', () => {
    expectTypeOf<DataGridProps<Entry>['isSelectionDisabled']>().toEqualTypeOf<
      ((item: Entry, index: number) => boolean) | undefined
    >();
    const element = (
      <DataGrid
        aria-label="Entries"
        items={ENTRIES}
        isSelectionDisabled={(entry, index) => {
          expectTypeOf(entry).toEqualTypeOf<Entry>();
          expectTypeOf(index).toEqualTypeOf<number>();
          return entry.id === '0';
        }}
      />
    );
    expect(element.props.items).toBe(ENTRIES);
  });
});

describe('DataGrid stories', () => {
  const { Paging } = composeStories(stories);

  it('Paging keeps the selection of one page on the others; select-all covers the page shown', async () => {
    const user = userEvent.setup();
    render(<Paging />);
    const status = screen.getByRole('status');
    const selectAll = () => screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(status).toHaveTextContent('0 selected');
    await user.click(screen.getByRole('checkbox', { name: 'Member 3' }));
    expect(status).toHaveTextContent('1 selected');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('checkbox', { name: 'Member 21' })).not.toBeChecked();
    expect(selectAll()).not.toBePartiallyChecked();
    await user.click(selectAll());
    expect(status).toHaveTextContent('21 selected');
    expect(selectAll()).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByRole('checkbox', { name: 'Member 3' })).toBeChecked();
    expect(selectAll()).toBePartiallyChecked();
    await user.click(selectAll());
    expect(status).toHaveTextContent('40 selected');
    await user.click(selectAll());
    // Only the page's members are cleared: page 2 stays selected.
    expect(status).toHaveTextContent('20 selected');
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
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
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1'], DETAILS);
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
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2'], DETAILS);
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
    const writes = countTabIndexWrites();
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
    await flushObservers();
    expect(writes.count()).toBeLessThan(50);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    act(() => cell('Alice').focus());
    await user.keyboard('{ArrowRight}{Enter}');
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(toolbar.parentElement).toHaveFocus();
    await flushObservers();
    expect(writes.count()).toBeLessThan(80);
    expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });
});

describe('DataGrid with the library’s composite widgets in its cells', () => {
  const TASKS = ['Write', 'Review'];

  /** The `[tabindex="0"]` elements of the grid outside its composites (the grid's own tab stop). */
  function gridStops(): Element[] {
    return Array.from(screen.getByRole('grid').querySelectorAll('[tabindex="0"]')).filter(
      (el) => !el.closest('[role="toolbar"], [role="radiogroup"]'),
    );
  }

  it('treats a Toolbar and a RadioGroup as one widget each: Enter enters, Escape returns', async () => {
    const user = userEvent.setup();
    const writes = countTabIndexWrites();
    const onSelectedItemsChange = vi.fn();
    render(
      <DataGrid
        aria-label="Tasks"
        selectionMode="multiple"
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <DataGrid.Body>
          {TASKS.map((task) => (
            <DataGrid.Row key={task} rowId={task}>
              <DataGrid.Cell>{task}</DataGrid.Cell>
              <DataGrid.Cell>
                <RadioGroup
                  aria-label={`${task} priority`}
                  orientation="horizontal"
                  defaultValue="low"
                >
                  <RadioGroup.Item value="low" label="Low" />
                  <RadioGroup.Item value="high" label="High" />
                </RadioGroup>
              </DataGrid.Cell>
              <DataGrid.Cell>
                <Toolbar aria-label={`${task} actions`}>
                  <Button>Edit</Button>
                  <Button>Delete</Button>
                </Toolbar>
              </DataGrid.Cell>
            </DataGrid.Row>
          ))}
        </DataGrid.Body>
      </DataGrid>,
    );
    await flushObservers();
    // No write loop between the grid and the composites' own roving tab indexes.
    expect(writes.count()).toBeLessThan(60);
    for (const composite of [
      ...screen.getAllByRole('toolbar'),
      ...screen.getAllByRole('radiogroup'),
    ]) {
      expect(composite.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    }
    expect(gridStops()).toHaveLength(1);

    const [writeRow] = bodyRows();
    const priority = screen.getByRole('radiogroup', { name: 'Write priority' });
    const actions = screen.getByRole('toolbar', { name: 'Write actions' });
    act(() => cell('Write').focus());
    await user.keyboard('{ArrowRight}');
    expect(priority.parentElement).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(within(priority).getByRole('radio', { name: 'Low' })).toHaveFocus();
    // Inside, the arrow keys are the radio group's.
    await user.keyboard('{ArrowRight}');
    expect(within(priority).getByRole('radio', { name: 'High' })).toHaveFocus();
    expect(within(priority).getByRole('radio', { name: 'High' })).toBeChecked();
    await user.keyboard('{Escape}');
    expect(priority.parentElement).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(actions.parentElement).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(within(actions).getByRole('button', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(within(actions).getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(actions.parentElement).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('toolbar', { name: 'Review actions' }).parentElement).toHaveFocus();

    await flushObservers();
    expect(writes.count()).toBeLessThan(120);
    for (const toolbar of screen.getAllByRole('toolbar')) {
      expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    }
    expect(gridStops()).toHaveLength(1);
    expect(writeRow).toHaveAttribute('aria-selected', 'false');
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
  });

  it('leaves a Menu opened from a cell to the menu (portal events never reach the grid or the row)', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const onEdit = vi.fn();
    render(
      <DataGrid
        aria-label="Tasks"
        selectionMode="multiple"
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <DataGrid.Body>
          {TASKS.map((task) => (
            <DataGrid.Row key={task} rowId={task}>
              <DataGrid.Cell>{task}</DataGrid.Cell>
              <DataGrid.Cell>
                <Menu>
                  <Menu.Trigger>
                    <MenuButton>{`${task} actions`}</MenuButton>
                  </Menu.Trigger>
                  <Menu.Popover>
                    <Menu.Item onClick={onEdit}>Edit</Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.Popover>
                </Menu>
              </DataGrid.Cell>
            </DataGrid.Row>
          ))}
        </DataGrid.Body>
      </DataGrid>,
    );
    const trigger = screen.getByRole('button', { name: 'Write actions' });
    act(() => cell('Write').focus());
    await user.keyboard('{ArrowRight}');
    expect(trigger).toHaveFocus();

    // Enter opens the menu; its arrow keys, Escape and Space stay the menu's.
    await user.keyboard('{Enter}');
    const menu = screen.getByRole('menu', { name: 'Write actions' });
    expect(screen.getByRole('grid').contains(menu)).toBe(false);
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();

    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'false');
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    const stops = screen.getByRole('grid').querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(trigger);
    // The grid keys work again from the trigger.
    await user.keyboard('{ArrowLeft}');
    expect(cell('Write')).toHaveFocus();
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

  it('runs the grid focus handling next to a consumer onFocus/onBlur, even when they preventDefault()', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn((event: React.FocusEvent<HTMLTableElement>) => event.preventDefault());
    const onBlur = vi.fn((event: React.FocusEvent<HTMLTableElement>) => event.preventDefault());
    render(
      <>
        <DataGrid aria-label="People" onFocus={onFocus} onBlur={onBlur}>
          <DataGrid.Body>
            <DataGrid.Row rowId="1">
              <DataGrid.Cell>Alice</DataGrid.Cell>
              <DataGrid.Cell>
                <input aria-label="Note" />
              </DataGrid.Cell>
            </DataGrid.Row>
            <DataGrid.Row rowId="2">
              <DataGrid.Cell>Bob</DataGrid.Cell>
              <DataGrid.Cell>Designer</DataGrid.Cell>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>
        <button type="button">After</button>
      </>,
    );
    // A click on a cell moves the tab stop to it (the grid's onFocus).
    await user.click(cell('Bob'));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(cell('Bob')).toHaveAttribute('tabindex', '0');
    expect(cell('Alice')).toHaveAttribute('tabindex', '-1');

    // Leaving the grid from an edited text field ends interaction mode (the grid's onBlur).
    const note = screen.getByRole('textbox', { name: 'Note' });
    const noteCell = note.closest('td')!;
    act(() => noteCell.focus());
    await user.keyboard('{Enter}');
    expect(note).toHaveFocus();
    expect(note).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(onBlur).toHaveBeenCalled();
    expect(note).toHaveAttribute('tabindex', '-1');
    expect(noteCell).toHaveAttribute('tabindex', '0');
    await user.tab({ shift: true });
    expect(noteCell).toHaveFocus();
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
      expect(onRowSelection).toHaveBeenCalledWith(['1'], DETAILS);
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

  const onHeaderSort = vi.fn();
  function SortableHeader(props: Omit<DataGridHeaderCellProps, 'children'>) {
    return (
      <DataGrid aria-label="People" onSortChange={onHeaderSort}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable {...props}>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
      </DataGrid>
    );
  }
  SortableHeader.displayName = 'SortableHeader';

  describe('sortable header onClick', () => {
    testComposedHandler(SortableHeader, {
      handler: 'onClick',
      act: async ({ user }) => {
        onHeaderSort.mockClear();
        await user.click(sortButton('Name'));
      },
      assertInternal: () => {
        expect(onHeaderSort).toHaveBeenCalledTimes(1);
        expect(onHeaderSort).toHaveBeenCalledWith('name', 'ascending');
        expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
      },
      assertInternalSuppressed: () => {
        expect(onHeaderSort).not.toHaveBeenCalled();
        expect(header('Name')).toHaveAttribute('aria-sort', 'none');
      },
    });

    it('runs the consumer onClick before sorting, also for Enter on the sort button', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      onHeaderSort.mockReset();
      onHeaderSort.mockImplementation(() => order.push('sort'));
      render(
        <SortableHeader
          onClick={(event) => {
            order.push('consumer');
            expect(event.currentTarget.tagName.toLowerCase()).toBe('th');
          }}
        />,
      );
      await user.click(sortButton('Name'));
      expect(order).toEqual(['consumer', 'sort']);

      order.length = 0;
      act(() => sortButton('Name').focus());
      await user.keyboard('{Enter}');
      expect(order).toEqual(['consumer', 'sort']);
    });

    it('a consumer preventDefault() vetoes a keyboard sort too', async () => {
      const user = userEvent.setup();
      onHeaderSort.mockReset();
      render(<SortableHeader onClick={(event) => event.preventDefault()} />);
      act(() => sortButton('Name').focus());
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onHeaderSort).not.toHaveBeenCalled();
      expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    });

    it('does not sort for a click on the header cell outside the sort button', () => {
      const onClick = vi.fn();
      onHeaderSort.mockReset();
      render(<SortableHeader onClick={onClick} />);
      fireEvent.click(header('Name'));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onHeaderSort).not.toHaveBeenCalled();
    });
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

// ---------------------------------------------------------------------------
// Row-click selection, selection appearance, selectionCellProps and DataGrid.SelectionCell
// ---------------------------------------------------------------------------

/** `details` of `onSelectedItemsChange` after a row click. */
const CLICK_DETAILS = { event: expect.any(MouseEvent) };

/** The grid's header plus one body row per person, each row with the props of its id. */
function contentWithRowProps(rowProps: Record<string, Partial<DataGridRowProps>>) {
  const [headerContent] = gridContent();
  return [
    headerContent,
    <DataGrid.Body key="body">
      {PEOPLE.map((person) => (
        <DataGrid.Row key={person.id} rowId={person.id} {...rowProps[person.id]}>
          <DataGrid.Cell>{person.name}</DataGrid.Cell>
          <DataGrid.Cell>{person.role}</DataGrid.Cell>
          <DataGrid.Cell>-</DataGrid.Cell>
        </DataGrid.Row>
      ))}
    </DataGrid.Body>,
  ];
}

/** The selection cell (`<td>`/`<th>`) around `control`. */
function cellOf(control: HTMLElement): HTMLElement {
  return control.closest('td, th') as HTMLElement;
}

describe('DataGrid selectOnRowClick', () => {
  afterEach(() => {
    document.getSelection()?.removeAllRanges();
  });

  function renderClickable(props: GridTestProps = {}) {
    const onSelectedItemsChange = vi.fn();
    renderGrid({
      selectionMode: 'multiple',
      selectOnRowClick: true,
      onSelectedItemsChange,
      ...props,
    });
    return onSelectedItemsChange;
  }

  it('leaves the selection to the controls without it (0.13)', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectedItemsChange });
    await user.click(cell('Alice'));
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('toggles the row on a click in one of its cells, with the click in details', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = renderClickable();
    await user.click(cell('Alice'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1'], CLICK_DETAILS);
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeChecked();
    await user.click(cell('Designer'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2'], CLICK_DETAILS);
    await user.click(cell('Alice'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2'], CLICK_DETAILS);
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('selects the clicked row alone in single mode, and clears it on a second click', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = renderClickable({ selectionMode: 'single' });
    await user.click(cell('Alice'));
    await user.click(cell('Bob'));
    expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Alice' })).not.toBeChecked();
    await user.click(cell('Bob'));
    expect(onSelectedItemsChange.mock.calls).toEqual([
      [['1'], CLICK_DETAILS],
      [['2'], CLICK_DETAILS],
      [[], CLICK_DETAILS],
    ]);
  });

  it('toggles once on a click on the row’s checkbox, and on a click on the cell around it', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = renderClickable();
    const checkbox = screen.getByRole('checkbox', { name: 'Alice' });
    await user.click(checkbox);
    expect(onSelectedItemsChange.mock.calls).toEqual([[['1'], DETAILS]]);
    await user.click(cellOf(checkbox));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], CLICK_DETAILS);
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
    expect(checkbox).not.toBeChecked();
  });

  it('never toggles on a click on a button, a link, an input or a scripted widget; each still works', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const onEdit = vi.fn();
    const onCustom = vi.fn();
    render(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        selectOnRowClick
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
            <DataGrid.Cell>
              <button type="button" onClick={onEdit}>
                <span>Edit</span>
              </button>
            </DataGrid.Cell>
            <DataGrid.Cell>
              <a href="#alice">Profile</a>
            </DataGrid.Cell>
            <DataGrid.Cell>
              <input aria-label="Note" />
            </DataGrid.Cell>
            <DataGrid.Cell>
              <span role="button" tabIndex={-1} onClick={onCustom}>
                Custom
              </span>
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    await user.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('link', { name: 'Profile' }));
    const note = screen.getByRole('textbox', { name: 'Note' });
    await user.click(note);
    await user.keyboard('a b');
    expect(note).toHaveValue('a b');
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    expect(onCustom).toHaveBeenCalledTimes(1);
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'false');

    await user.click(cell('Alice'));
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1'], CLICK_DETAILS);
  });

  it('never toggles on a click in a popup portaled from the row (a Menu, a plain portal)', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const onRename = vi.fn();
    function PortalNote() {
      return createPortal(<p>Portal note</p>, document.body);
    }
    render(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        selectOnRowClick
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>
              Alice
              <PortalNote />
            </DataGrid.Cell>
            <DataGrid.Cell>
              <Menu>
                <Menu.Trigger>
                  <MenuButton>Alice actions</MenuButton>
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item onClick={onRename}>Rename</Menu.Item>
                </Menu.Popover>
              </Menu>
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    await user.click(screen.getByText('Portal note'));
    await user.click(screen.getByRole('button', { name: 'Alice actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('never toggles on a click on a header row written as `<tr>`', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = renderClickable();
    await user.click(header('Notes'));
    await user.click(cellOf(screen.getByRole('checkbox', { name: 'Select all rows' })));
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).not.toBeChecked();
  });

  it('never toggles on a click on a header row built from DataGrid.Row', async () => {
    const user = userEvent.setup();
    const onRowHeaderChange = vi.fn();
    render(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        selectOnRowClick
        onSelectedItemsChange={onRowHeaderChange}
      >
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
    await user.click(header('Name'));
    expect(onRowHeaderChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).not.toBeChecked();
  });

  it('never toggles on a click that ends a text selection in the row', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = renderClickable();
    const alice = cell('Alice');
    const selection = document.getSelection()!;
    // A drag across "Alice" selects it; the click that ends the drag selects text only.
    selection.selectAllChildren(alice);
    fireEvent.click(alice, { detail: 1 });
    // A drag from one cell of the row to another.
    selection.setBaseAndExtent(alice.firstChild!, 2, cell('Engineer').firstChild!, 3);
    fireEvent.click(bodyRows()[0], { detail: 1 });
    expect(onSelectedItemsChange).not.toHaveBeenCalled();

    // A selection in another row does not hold a click on this one back.
    selection.selectAllChildren(cell('Bob'));
    fireEvent.click(alice, { detail: 1 });
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1'], CLICK_DETAILS);
    // A plain click collapses the selection where the pointer goes down.
    await user.click(cell('Bob'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2'], CLICK_DETAILS);
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);

    // The pointer presses in "Carol", drags across three characters and releases: a click on
    // the cell that selects "Car".
    const carol = cell('Carol');
    await user.pointer([
      { keys: '[MouseLeft>]', target: carol, offset: 0 },
      { target: carol, offset: 3 },
      { keys: '[/MouseLeft]', target: carol },
    ]);
    expect(selection.toString()).toBe('Car');
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
  });

  it('runs the row’s onClick first; its preventDefault() keeps the selection', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    let cancel = false;
    const onRowClick = vi.fn((event: React.MouseEvent<HTMLTableRowElement>) => {
      calls.push('row onClick');
      if (cancel) event.preventDefault();
    });
    const onSelectedItemsChange = vi.fn(() => calls.push('selection'));
    renderGrid({
      selectionMode: 'multiple',
      selectOnRowClick: true,
      onSelectedItemsChange,
      children: contentWithRowProps({ '1': { onClick: onRowClick } }),
    });
    await user.click(cell('Alice'));
    expect(calls).toEqual(['row onClick', 'selection']);
    cancel = true;
    await user.click(cell('Alice'));
    expect(calls).toEqual(['row onClick', 'selection', 'row onClick']);
    expect(bodyRows()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps Space on a cell toggling the row, and the row click working next to it', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = renderClickable();
    act(() => cell('Bob').focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2'], DETAILS);
    expect(onSelectedItemsChange.mock.lastCall?.[1].event).toBeInstanceOf(KeyboardEvent);
    await user.click(cell('Carol'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2', '3'], CLICK_DETAILS);
  });

  it('calls onSelectedItemsChange once per row click in StrictMode', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <DataGrid
          aria-label="People"
          selectionMode="multiple"
          selectOnRowClick
          onSelectedItemsChange={onSelectedItemsChange}
        >
          {gridContent()}
        </DataGrid>
      </React.StrictMode>,
    );
    await user.click(cell('Alice'));
    await user.click(cell('Bob'));
    expect(onSelectedItemsChange.mock.calls).toEqual([
      [['1'], CLICK_DETAILS],
      [['1', '2'], CLICK_DETAILS],
    ]);
  });

  it('does nothing in a grid without selection', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({ selectOnRowClick: true, onSelectedItemsChange });
    await user.click(cell('Alice'));
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    expect(bodyRows()[0]).not.toHaveAttribute('aria-selected');
  });
});

describe('DataGrid selectionAppearance', () => {
  it('is brand by default: data-selection-appearance="brand" and the selected token (0.13)', () => {
    renderGrid({ selectionMode: 'multiple', defaultSelectedItems: ['2'] });
    expect(screen.getByRole('grid')).toHaveAttribute('data-selection-appearance', 'brand');
    const row = bodyRows()[1];
    expect(row).toHaveClass('data-[selected]:bg-selected', 'hover:bg-subtle-hover');
    expect(row).not.toHaveClass('data-[selected]:bg-subtle-selected');
  });

  it('renders the attribute in every selection mode, none included', () => {
    renderGrid({ selectionAppearance: 'neutral' });
    expect(screen.getByRole('grid')).toHaveAttribute('data-selection-appearance', 'neutral');
  });

  it('fills a selected row with the subtle selected token for neutral', () => {
    renderGrid({
      selectionMode: 'multiple',
      defaultSelectedItems: ['2'],
      selectionAppearance: 'neutral',
    });
    expect(screen.getByRole('grid')).toHaveAttribute('data-selection-appearance', 'neutral');
    const row = bodyRows()[1];
    expect(row).toHaveAttribute('data-selected');
    expect(row).toHaveClass('data-[selected]:bg-subtle-selected', 'hover:bg-subtle-hover');
    expect(row).not.toHaveClass('data-[selected]:bg-selected');
  });

  it('gives a selected row no fill for none; aria-selected, the control and the forced-colors outline stay', () => {
    renderGrid({
      selectionMode: 'multiple',
      defaultSelectedItems: ['2'],
      selectionAppearance: 'none',
    });
    expect(screen.getByRole('grid')).toHaveAttribute('data-selection-appearance', 'none');
    const row = bodyRows()[1];
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(row).toHaveAttribute('data-selected');
    expect(row).not.toHaveClass('data-[selected]:bg-selected');
    expect(row).not.toHaveClass('data-[selected]:bg-subtle-selected');
    expect(row.className).not.toMatch(/(^|\s)data-\[selected\]:bg-/);
    expect(row).toHaveClass('forced-colors:outline-[Highlight]', 'hover:bg-subtle-hover');
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
  });

  it.each<DataGridSelectionAppearance>(['brand', 'neutral', 'none'])(
    'has no accessibility violations (%s, a row selected)',
    async (selectionAppearance) => {
      renderGrid({ selectionMode: 'multiple', defaultSelectedItems: ['2'], selectionAppearance });
      await expectNoA11yViolations();
    },
  );
});

describe('DataGrid subtleSelection', () => {
  const SUBTLE_ROW = [
    'opacity-0',
    'group-hover/table-row:opacity-100',
    'group-focus-within/table-row:opacity-100',
    'forced-colors:opacity-100',
    'pointer-coarse:opacity-100',
    'transition-opacity',
    'motion-reduce:transition-none',
  ];
  const SUBTLE_GRID = [
    'opacity-0',
    'group-hover/grid:opacity-100',
    'group-focus-within/grid:opacity-100',
    'forced-colors:opacity-100',
    'pointer-coarse:opacity-100',
    'transition-opacity',
    'motion-reduce:transition-none',
  ];

  it('names every row’s group table-row, never row (a Tree’s rows use that name)', () => {
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
    for (const row of screen.getAllByRole('row')) {
      expect(row).toHaveClass('group/table-row');
      expect(row).not.toHaveClass('group/row');
    }
  });

  it('leaves a Tree in a cell to its own rows: the grid row does not reveal its actions', () => {
    render(
      <DataGrid aria-label="Folders" selectionMode="multiple" subtleSelection>
        <DataGrid.Body>
          <DataGrid.Row rowId="1" selectionLabel="Projects">
            <DataGrid.Cell>
              <Tree aria-label="Files">
                <Tree.Item
                  value="docs"
                  aside="3 files"
                  actions={<button type="button">Rename Documents</button>}
                >
                  Documents
                </Tree.Item>
              </Tree>
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const actions = screen.getByRole('toolbar', { name: 'Documents', hidden: true });
    // The Tree's own classes, keyed on its rows' group.
    expect(actions).toHaveClass('invisible', 'group-hover/row:visible');
    // The only element of that group around the actions is the Tree's own row.
    const groups = [];
    for (let el = actions.parentElement; el; el = el.parentElement) {
      if (el.classList.contains('group/row')) groups.push(el);
    }
    expect(groups).toHaveLength(1);
    expect(screen.getByRole('tree')).toContainElement(groups[0]);
    expect(bodyRows()[0]).toHaveClass('group/table-row');
  });

  it('is off by default: no data-subtle-selection and every control drawn (0.13)', () => {
    renderGrid({ selectionMode: 'multiple' });
    expect(screen.getByRole('grid')).not.toHaveAttribute('data-subtle-selection');
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).not.toHaveClass('opacity-0');
    }
  });

  it('hides an unchecked row control until its row is hovered or holds focus; forced colors and a coarse pointer always draw it', () => {
    renderGrid({ selectionMode: 'multiple', subtleSelection: true, defaultSelectedItems: ['2'] });
    expect(screen.getByRole('grid')).toHaveAttribute('data-subtle-selection', '');
    expect(bodyRows()[0]).toHaveClass('group/table-row');
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toHaveClass(...SUBTLE_ROW);
    // A checked control is always drawn.
    const bob = screen.getByRole('checkbox', { name: 'Bob' });
    expect(bob).toBeChecked();
    expect(bob).not.toHaveClass('opacity-0');
  });

  it('hides the select-all checkbox while nothing is selected, until the grid is hovered or holds focus', async () => {
    const user = userEvent.setup();
    renderGrid({ selectionMode: 'multiple', subtleSelection: true });
    const grid = screen.getByRole('grid');
    expect(grid).toHaveClass('group/grid');
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll).toHaveClass(...SUBTLE_GRID);
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }));
    expect(selectAll).toBePartiallyChecked();
    expect(selectAll).not.toHaveClass('opacity-0');
    await user.click(selectAll);
    expect(selectAll).toBeChecked();
    expect(selectAll).not.toHaveClass('opacity-0');
  });

  it('draws a subtle control while it has keyboard focus', () => {
    renderGrid({ selectionMode: 'multiple', subtleSelection: true });
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toHaveClass(
      'opacity-0',
      'focus-visible:opacity-100',
    );
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveClass(
      'opacity-0',
      'focus-visible:opacity-100',
    );
  });

  it('applies to the radios of single mode', () => {
    renderGrid({ selectionMode: 'single', subtleSelection: true, defaultSelectedItems: ['1'] });
    expect(screen.getByRole('radio', { name: 'Bob' })).toHaveClass(...SUBTLE_ROW);
    expect(screen.getByRole('radio', { name: 'Alice' })).not.toHaveClass('opacity-0');
  });

  it('keeps a transparent control named and focusable: the grid focuses it', async () => {
    const user = userEvent.setup();
    renderGrid({ selectionMode: 'multiple', subtleSelection: true });
    const alice = screen.getByRole('checkbox', { name: 'Alice' });
    expect(alice).not.toHaveAttribute('aria-hidden');
    expect(alice).toBeEnabled();
    act(() => cell('Alice').focus());
    await user.keyboard('{ArrowLeft}');
    expect(alice).toHaveFocus();
  });

  it('shows a row control once a row click selects it (selectOnRowClick)', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({
      selectionMode: 'multiple',
      subtleSelection: true,
      selectOnRowClick: true,
      onSelectedItemsChange,
    });
    const alice = screen.getByRole('checkbox', { name: 'Alice' });
    await user.click(cell('Alice'));
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1'], CLICK_DETAILS);
    expect(alice).toBeChecked();
    expect(alice).not.toHaveClass('opacity-0');
    await user.click(cell('Alice'));
    expect(alice).not.toBeChecked();
    expect(alice).toHaveClass(...SUBTLE_ROW);
  });

  it('has no accessibility violations', async () => {
    renderGrid({ selectionMode: 'multiple', subtleSelection: true, defaultSelectedItems: ['2'] });
    await expectNoA11yViolations();
  });
});

describe('DataGrid.Row selectionCellProps', () => {
  it('disables the row’s control natively: neither a row click nor Space toggles the row', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({
      selectionMode: 'multiple',
      selectOnRowClick: true,
      onSelectedItemsChange,
      children: contentWithRowProps({ '2': { selectionCellProps: { disabled: true } } }),
    });
    const bob = screen.getByRole('checkbox', { name: 'Bob' });
    expect(bob).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeEnabled();
    await user.click(cell('Bob'));
    act(() => cell('Designer').focus());
    await user.keyboard(' ');
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    expect(bodyRows()[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('makes the cell, not the disabled control, the grid’s focus target', async () => {
    const user = userEvent.setup();
    renderGrid({
      selectionMode: 'multiple',
      children: contentWithRowProps({ '2': { selectionCellProps: { disabled: true } } }),
    });
    act(() => cell('Bob').focus());
    await user.keyboard('{ArrowLeft}');
    const bob = screen.getByRole('checkbox', { name: 'Bob' });
    expect(cellOf(bob)).toHaveFocus();
    expect(bob).not.toHaveAttribute('tabindex', '0');
  });

  it('keeps a disabled row out of select-all: it selects and clears the other rows', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({
      selectionMode: 'multiple',
      onSelectedItemsChange,
      children: contentWithRowProps({ '2': { selectionCellProps: { disabled: true } } }),
    });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '3'], DETAILS);
    expect(selectAll).toBeChecked();
    expect(selectAll).not.toBePartiallyChecked();
    expect(screen.getByRole('checkbox', { name: 'Bob' })).not.toBeChecked();
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], DETAILS);
    expect(selectAll).not.toBeChecked();
  });

  it('keeps a selected disabled row selected through select-all, and out of its state', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({
      selectionMode: 'multiple',
      defaultSelectedItems: ['2'],
      onSelectedItemsChange,
      children: contentWithRowProps({ '2': { selectionCellProps: { disabled: true } } }),
    });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    // No row that select-all can change is selected.
    expect(selectAll).not.toBeChecked();
    expect(selectAll).not.toBePartiallyChecked();
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3'], DETAILS);
    expect(selectAll).toBeChecked();
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2'], DETAILS);
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
    expect(selectAll).not.toBeChecked();
  });

  it('updates select-all when a row’s selection becomes disabled or enabled', () => {
    const { rerender } = render(
      <DataGrid aria-label="People" selectionMode="multiple" defaultSelectedItems={['1', '3']}>
        {contentWithRowProps({})}
      </DataGrid>,
    );
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll).toBePartiallyChecked();
    rerender(
      <DataGrid aria-label="People" selectionMode="multiple" defaultSelectedItems={['1', '3']}>
        {contentWithRowProps({ '2': { selectionCellProps: { disabled: true } } })}
      </DataGrid>,
    );
    expect(selectAll).toBeChecked();
    expect(selectAll).not.toBePartiallyChecked();
    rerender(
      <DataGrid aria-label="People" selectionMode="multiple" defaultSelectedItems={['1', '3']}>
        {contentWithRowProps({})}
      </DataGrid>,
    );
    expect(selectAll).toBePartiallyChecked();
  });

  it('hides the control with invisible, while a row click still selects the row', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    renderGrid({
      selectionMode: 'multiple',
      selectOnRowClick: true,
      onSelectedItemsChange,
      children: contentWithRowProps({ '1': { selectionCellProps: { invisible: true } } }),
    });
    const control = within(bodyRows()[0]).getByRole('checkbox', { hidden: true });
    expect(control).toHaveClass('invisible');
    expect(screen.getByRole('checkbox', { name: 'Bob' })).not.toHaveClass('invisible');
    await user.click(cell('Alice'));
    expect(onSelectedItemsChange).toHaveBeenCalledWith(['1'], CLICK_DETAILS);
  });

  it('puts className on the cell and aria-label on the control (over selectionLabel)', () => {
    renderGrid({
      selectionMode: 'multiple',
      children: contentWithRowProps({
        '1': { selectionCellProps: { className: 'bg-muted', 'aria-label': 'Choose Alice' } },
        '2': { selectionLabel: 'Bob row', selectionCellProps: { 'aria-label': 'Choose Bob' } },
      }),
    });
    const alice = screen.getByRole('checkbox', { name: 'Choose Alice' });
    expect(alice).not.toHaveAttribute('aria-labelledby');
    expect(cellOf(alice)).toHaveClass('bg-muted', dataGridRowClassNames.selectionCell, 'w-10');
    expect(alice).not.toHaveClass('bg-muted');
    expect(screen.getByRole('checkbox', { name: 'Choose Bob' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Bob row' })).toBeNull();
  });

  it('applies to the select-all cell of a header row built from DataGrid.Row', () => {
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <DataGrid.Row
            selectionCellProps={{ className: 'bg-muted', 'aria-label': 'Choose every person' }}
          >
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
    const selectAll = screen.getByRole('checkbox', { name: 'Choose every person' });
    expect(cellOf(selectAll)).toHaveClass('bg-muted', dataGridHeaderClassNames.selectionCell);
  });

  it('has no accessibility violations with a disabled and an invisible control', async () => {
    renderGrid({
      selectionMode: 'multiple',
      children: contentWithRowProps({
        '1': { selectionCellProps: { invisible: true } },
        '2': { selectionCellProps: { disabled: true } },
      }),
    });
    await expectNoA11yViolations();
  });
});

describe('DataGrid.SelectionCell', () => {
  /** A selectable grid whose one body row holds the cell under test before its first cell. */
  function SelectionCellRow({ children }: { children: React.ReactNode }) {
    return (
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            {children}
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>
    );
  }

  testSystemProps(DataGridSelectionCell, {
    expectedTag: 'td',
    displayName: 'DataGridSelectionCell',
    control: { role: 'checkbox' },
    conflictingClass: { className: 'w-12', overrides: 'w-10' },
    wrapper: SelectionCellRow,
  });

  testCompoundExposure(DataGrid, ['SelectionCell']);

  it('exports DataGridSelectionCell bound to DataGrid.SelectionCell', () => {
    expect(DataGridSelectionCell).toBe(DataGrid.SelectionCell);
  });

  /** A grid whose header and body rows hold a DataGrid.SelectionCell as their last cell. */
  function TrailingCells(
    props: Partial<DataGridBaseProps> & { cellProps?: DataGridSelectionCellProps },
  ) {
    const { cellProps, ...gridProps } = props;
    return (
      <DataGrid aria-label="People" selectionMode="multiple" {...gridProps}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
            <DataGrid.SelectionCell />
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          {PEOPLE.map((person) => (
            <DataGrid.Row key={person.id} rowId={person.id}>
              <DataGrid.Cell>{person.name}</DataGrid.Cell>
              <DataGrid.SelectionCell {...cellProps} />
            </DataGrid.Row>
          ))}
        </DataGrid.Body>
      </DataGrid>
    );
  }

  it('is the select-all checkbox in a header row and the row toggle in a body row, in place of the automatic cells', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    const onSelectedItemsChange = vi.fn();
    render(<TrailingCells onSelectedItemsChange={onSelectedItemsChange} />);
    const [headerRow, ...rows] = screen.getAllByRole('row') as HTMLTableRowElement[];
    expect(headerRow.cells).toHaveLength(2);
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(headerRow.cells[1]).toContainElement(selectAll);
    expect(headerRow.cells[1]).toHaveClass(
      dataGridSelectionCellClassNames.root,
      dataGridHeaderClassNames.selectionCell,
    );
    expect(selectAll).toHaveClass(dataGridHeaderClassNames.selectAllCheckbox);
    expect(screen.getAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(1);

    for (const row of rows) expect(row.cells).toHaveLength(2);
    const alice = screen.getByRole('checkbox', { name: 'Alice' });
    expect(rows[0].cells[1]).toContainElement(alice);
    expect(rows[0].cells[1]).toHaveClass(
      dataGridSelectionCellClassNames.root,
      dataGridRowClassNames.selectionCell,
    );
    expect(rows[0].cells[1]).toHaveAttribute('role', 'gridcell');
    expect(alice).toHaveClass(dataGridRowClassNames.selectionControl);

    await user.click(alice);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1'], DETAILS);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    await user.click(selectAll);
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3'], DETAILS);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is reached with the arrow keys like any cell, and works with selectOnRowClick and subtleSelection', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(
      <TrailingCells
        selectOnRowClick
        subtleSelection
        onSelectedItemsChange={onSelectedItemsChange}
      />,
    );
    act(() => cell('Bob').focus());
    await user.keyboard('{ArrowRight}');
    const bob = screen.getByRole('checkbox', { name: 'Bob' });
    expect(bob).toHaveFocus();
    expect(bob).toHaveClass('opacity-0', 'group-focus-within/table-row:opacity-100');
    await user.click(cell('Carol'));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['3'], CLICK_DETAILS);
    expect(screen.getByRole('checkbox', { name: 'Carol' })).not.toHaveClass('opacity-0');
  });

  it('is the hidden "Selection" header text in a single-mode header row, and a radio in a body row', () => {
    render(<TrailingCells selectionMode="single" defaultSelectedItems={['2']} />);
    const [headerRow] = screen.getAllByRole('row') as HTMLTableRowElement[];
    expect(headerRow.cells).toHaveLength(2);
    expect(within(headerRow.cells[1]).getByText('Selection')).toHaveClass('sr-only');
    expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();
  });

  it('takes disabled, invisible and aria-label like selectionCellProps, its own props winning', async () => {
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <DataGrid.Header>
          <DataGrid.Row>
            <DataGrid.SelectionCell aria-label="Choose all" />
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </DataGrid.Row>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1" selectionCellProps={{ disabled: true, className: 'from-row' }}>
            <DataGrid.SelectionCell disabled={false} className="own" aria-label="Choose Alice" />
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
          <DataGrid.Row rowId="2">
            <DataGrid.SelectionCell disabled />
            <DataGrid.Cell>Bob</DataGrid.Cell>
          </DataGrid.Row>
          <DataGrid.Row rowId="3">
            <DataGrid.SelectionCell invisible />
            <DataGrid.Cell>Carol</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const alice = screen.getByRole('checkbox', { name: 'Choose Alice' });
    expect(alice).toBeEnabled();
    expect(cellOf(alice)).toHaveClass('from-row', 'own');
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeDisabled();
    expect(within(bodyRows()[2]).getByRole('checkbox', { hidden: true })).toHaveClass('invisible');
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '3'], DETAILS);
  });

  it('routes aria-labelledby and aria-describedby to the control; id, data-* and ref stay on the cell', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    const controlRef = React.createRef<HTMLInputElement>();
    render(
      <>
        <span id="alice-name">Alice Smith</span>
        <span id="alice-hint">Selects the person</span>
        <SelectionCellRow>
          <DataGrid.SelectionCell
            id="alice-select"
            data-testid="selection-cell"
            aria-labelledby="alice-name"
            aria-describedby="alice-hint"
            ref={ref}
            controlRef={controlRef}
          />
        </SelectionCellRow>
      </>,
    );
    const control = screen.getByRole('checkbox', { name: 'Alice Smith' });
    expect(control).toHaveAccessibleDescription('Selects the person');
    expect(controlRef.current).toBe(control);
    const selectionCell = screen.getByTestId('selection-cell');
    expect(ref.current).toBe(selectionCell);
    expect(selectionCell).toHaveAttribute('id', 'alice-select');
    expect(selectionCell).not.toHaveAttribute('aria-labelledby');
    expect(selectionCell).not.toHaveAttribute('aria-describedby');
  });

  it('is recognised inside a Fragment and as a lazy element type (a Server Component)', () => {
    const LazySelectionCell = asClientReference(DataGrid.SelectionCell);
    function grid(SelectionCell: typeof DataGrid.SelectionCell) {
      return (
        <DataGrid aria-label="People" selectionMode="multiple">
          <DataGrid.Header>
            <tr>
              <>
                <SelectionCell />
                <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
              </>
            </tr>
          </DataGrid.Header>
          <DataGrid.Body>
            <DataGrid.Row rowId="1">
              <>
                <DataGrid.Cell>Alice</DataGrid.Cell>
                <SelectionCell />
              </>
            </DataGrid.Row>
          </DataGrid.Body>
        </DataGrid>
      );
    }
    const plain = renderToString(grid(DataGrid.SelectionCell));
    expect(renderToString(grid(LazySelectionCell))).toBe(plain);
    render(grid(LazySelectionCell));
    for (const row of screen.getAllByRole('row') as HTMLTableRowElement[]) {
      expect(row.cells).toHaveLength(2);
    }
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeInTheDocument();
  });

  it('gets the select-all control only in the first header row of a grouped header', () => {
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <tr>
            <DataGrid.SelectionCell />
            <DataGrid.HeaderCell>Person</DataGrid.HeaderCell>
          </tr>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const thead = screen.getByRole('grid').querySelector('thead') as HTMLTableSectionElement;
    expect(thead.rows[0].cells).toHaveLength(2);
    expect(thead.rows[0].cells[0]).toContainElement(
      screen.getByRole('checkbox', { name: 'Select all rows' }),
    );
    // The second row gets the automatic empty cell.
    expect(thead.rows[1].cells).toHaveLength(2);
    expect(thead.rows[1].cells[0]).toHaveAttribute('data-selection-cell');
    expect(thead.rows[1].cells[0]).toBeEmptyDOMElement();
    expect(screen.getAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(1);
  });

  it('renders nothing in a grid without selection, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<TrailingCells selectionMode="none" />);
    for (const row of screen.getAllByRole('row') as HTMLTableRowElement[]) {
      expect(row.cells).toHaveLength(1);
    }
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.SelectionCell: the grid has no row selection (`selectionMode` is "none"), so the cell renders nothing. Set `selectionMode` on the DataGrid, or remove the cell.',
      ],
    ]);
  });

  it('throws in development outside a DataGrid and in a body row that is not a DataGrid.Row', () => {
    expectThrows(
      <table>
        <tbody>
          <tr>
            <DataGrid.SelectionCell />
          </tr>
        </tbody>
      </table>,
      '[WaveUI] DataGrid.SelectionCell must be used within DataGrid',
    );
    expectThrows(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Body>
          <tr>
            <DataGrid.SelectionCell />
          </tr>
        </DataGrid.Body>
      </DataGrid>,
      '[WaveUI] DataGrid.SelectionCell must be used within DataGrid.Row',
    );
  });

  it('warns when a component renders it, so its row cannot see it and adds its own cell', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function MySelectionCell() {
      return <DataGrid.SelectionCell />;
    }
    render(
      <SelectionCellRow>
        <MySelectionCell />
      </SelectionCellRow>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.SelectionCell: rendered by another component, so its DataGrid.Row did not see it and added its own selection cell. Render DataGrid.SelectionCell as a child of DataGrid.Row (a Fragment is fine).',
      ],
    ]);
  });

  it('warns when a header row gets a second selection cell from a component that renders one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function MySelectionCell() {
      return <DataGrid.SelectionCell />;
    }
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <tr>
            <MySelectionCell />
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    // The automatic cell comes first, so it holds the one select-all control.
    expect(screen.getAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(1);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid.Header: a header row has more than one selection cell. A DataGrid.SelectionCell rendered by another component is not seen, so the row also gets the automatic cell: render DataGrid.SelectionCell as a child of the row (a Fragment is fine).',
      ],
    ]);
  });

  it('puts ref, className and data-* on the header cell, and controlRef on select-all', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    const controlRef = React.createRef<HTMLInputElement>();
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
            <DataGrid.SelectionCell
              ref={ref}
              controlRef={controlRef}
              className="w-12"
              data-testid="select-all-cell"
            />
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
            <DataGrid.SelectionCell />
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const headerCell = screen.getByTestId('select-all-cell');
    expect(headerCell.tagName.toLowerCase()).toBe('th');
    expect(ref.current).toBe(headerCell);
    expect(headerCell).toHaveClass('w-12', dataGridSelectionCellClassNames.root);
    expect(headerCell).not.toHaveClass('w-10');
    expect(controlRef.current).toBe(screen.getByRole('checkbox', { name: 'Select all rows' }));
  });

  it('has no accessibility violations in a header and in body rows, in both modes', async () => {
    const { unmount } = render(<TrailingCells defaultSelectedItems={['2']} />);
    await expectNoA11yViolations();
    unmount();
    render(<TrailingCells selectionMode="single" defaultSelectedItems={['2']} />);
    await expectNoA11yViolations();
  });
});

describe('DataGrid selection types (P9-04)', () => {
  it('types the selection props', () => {
    expectTypeOf<DataGridBaseProps['selectionAppearance']>().toEqualTypeOf<
      DataGridSelectionAppearance | undefined
    >();
    expectTypeOf<DataGridSelectionAppearance>().toEqualTypeOf<'brand' | 'neutral' | 'none'>();
    expectTypeOf<DataGridBaseProps['selectOnRowClick']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DataGridBaseProps['subtleSelection']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DataGridRowProps['selectionCellProps']>().toEqualTypeOf<
      DataGridRowSelectionCellProps | undefined
    >();
    expectTypeOf<DataGridRowSelectionCellProps>().toEqualTypeOf<{
      disabled?: boolean;
      invisible?: boolean;
      className?: string;
      'aria-label'?: string;
    }>();
    expectTypeOf<DataGridSelectionCellProps['controlRef']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    // @ts-expect-error — a selection cell has no content of its own.
    const withChildren = <DataGrid.SelectionCell>Select</DataGrid.SelectionCell>;
    // @ts-expect-error — not an appearance.
    const wrongAppearance = <DataGrid selectionAppearance="subtle">{null}</DataGrid>;
    expect([withChildren, wrongAppearance]).toHaveLength(2);
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
  });

  it('gives a grid with `items` the DataGridSort callback with details, never the 0.4 sort props', () => {
    const setSort = (sort: DataGridSort | null) => void sort;
    const positional = (columnId: string, direction: SortDirection) => void [columnId, direction];
    const loadingSort = undefined as DataGridSort | null | undefined;
    const elements = [
      <DataGrid
        key="items"
        aria-label="People"
        items={PEOPLE}
        onSortChange={(sort, details) => {
          expectTypeOf(sort).toEqualTypeOf<DataGridSort>();
          expectTypeOf(details).toEqualTypeOf<DataGridSortChangeDetails | undefined>();
          expectTypeOf<NonNullable<typeof details>['event']>().toEqualTypeOf<Event>();
          setSort(sort);
        }}
        onSelectedItemsChange={(items, details) => {
          expectTypeOf(items).toEqualTypeOf<string[]>();
          expectTypeOf(details).toEqualTypeOf<DataGridSelectedItemsChangeDetails | undefined>();
          expectTypeOf<NonNullable<typeof details>['event']>().toEqualTypeOf<Event>();
        }}
      />,
      <DataGrid key="items-setter" aria-label="People" items={PEOPLE} onSortChange={setSort} />,
      // A sort that is still `undefined` while it loads is fine next to `items`.
      <DataGrid
        key="items-loading-sort"
        aria-label="People"
        items={PEOPLE}
        sort={loadingSort}
        onSortChange={setSort}
      />,
      <DataGrid
        key="sort-details"
        aria-label="People"
        defaultSort={null}
        onSortChange={(sort, details) => {
          expectTypeOf(details).toEqualTypeOf<DataGridSortChangeDetails | undefined>();
          setSort(sort);
        }}
      >
        {null}
      </DataGrid>,
      // The 0.4 positional callback keeps its two arguments without `items`.
      <DataGrid key="legacy" aria-label="People" onSortChange={positional}>
        {null}
      </DataGrid>,
      // @ts-expect-error — the 0.4 positional callback does not apply to a grid with `items`.
      <DataGrid key="items-positional" items={PEOPLE} onSortChange={positional} />,
      // @ts-expect-error — nor does the deprecated sortColumn.
      <DataGrid key="items-sortColumn" items={PEOPLE} sortColumn="name" />,
      // @ts-expect-error — nor does the deprecated defaultSortDirection.
      <DataGrid key="items-defaultSortDirection" items={PEOPLE} defaultSortDirection="ascending" />,
      // @ts-expect-error — nor with `sort` next to `items`.
      <DataGrid key="sort-dir" items={PEOPLE} sort={null} sortDirection="ascending" />,
    ];
    expect(elements).toHaveLength(9);
    expectTypeOf<DataGridSortChangeDetails>().toEqualTypeOf<{ event: Event }>();
    expectTypeOf<DataGridSelectedItemsChangeDetails>().toEqualTypeOf<{ event: Event }>();
  });

  it('types the HeaderCell `sortIcon` as a span slot', () => {
    expectTypeOf<DataGridHeaderCellProps['sortIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
  });

  it('lets a generic wrapper pass its `DataGridProps<T>` on: spread, with a prop of its own, destructured', async () => {
    const user = userEvent.setup();
    function Spread<T>(props: DataGridProps<T>) {
      return <DataGrid {...props} />;
    }
    function SpreadWithClass<T>(props: DataGridProps<T>) {
      return <DataGrid {...props} className="app-grid" />;
    }
    const Destructured = <T,>({ className, ...props }: DataGridProps<T>) => (
      <DataGrid className={className} {...props} />
    );
    const setSort = (sort: DataGridSort | null) => void sort;
    const elements = [
      <Spread key="spread" aria-label="People" items={PEOPLE} getRowId={(person) => person.id} />,
      <SpreadWithClass
        key="legacy"
        aria-label="People"
        onSortChange={(columnId, direction) => {
          expectTypeOf(columnId).toEqualTypeOf<string>();
          expectTypeOf(direction).toEqualTypeOf<SortDirection>();
        }}
      >
        {null}
      </SpreadWithClass>,
      <Destructured
        key="destructured"
        aria-label="People"
        items={PEOPLE}
        defaultSort={null}
        onSortChange={(sort) => setSort(sort)}
      />,
    ];
    expect(elements).toHaveLength(3);

    const onSortChange = vi.fn();
    render(
      <Destructured
        aria-label="People"
        className="app-grid"
        items={PEOPLE}
        columns={[
          {
            columnId: 'name',
            label: 'Name',
            compare: (a, b) => a.name.localeCompare(b.name),
            renderCell: (person) => person.name,
          },
        ]}
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getByRole('grid')).toHaveClass('app-grid');
    await user.click(sortButton('Name'));
    await user.click(sortButton('Name'));
    expect(bodyRows().map((row) => row.textContent)).toEqual(['Carol', 'Bob', 'Alice']);
    expect(onSortChange).toHaveBeenLastCalledWith(
      { columnId: 'name', direction: 'descending' },
      DETAILS,
    );
  });

  it('accepts readonly arrays (`as const`) for columns and the selection, and emits a mutable array', () => {
    const COLUMNS = [
      { id: 'name', label: 'Name', sortable: true },
      { id: 'role', label: 'Role' },
    ] as const;
    const IDS = ['1', '2'] as const;
    const element = (
      <DataGrid
        aria-label="People"
        columns={COLUMNS}
        selectionMode="multiple"
        selectedItems={IDS}
        defaultSelectedItems={IDS}
        onSelectedItemsChange={(items) => {
          expectTypeOf(items).toEqualTypeOf<string[]>();
        }}
      >
        {null}
      </DataGrid>
    );
    expect(element.props.selectedItems).toBe(IDS);
    expectTypeOf<DataGridProps['selectedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<DataGridProps['defaultSelectedItems']>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<DataGridProps['columns']>().toEqualTypeOf<readonly DataGridColumn[] | undefined>();
  });

  it('types the columns, the items, the row ids and the body render function by the item', () => {
    expectTypeOf<DataGridColumn<Person>['columnId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DataGridColumn<Person>['label']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<DataGridColumn<Person>['compare']>().toEqualTypeOf<
      ((a: Person, b: Person) => number) | undefined
    >();
    expectTypeOf<DataGridColumn<Person>['renderCell']>().toEqualTypeOf<
      ((item: Person) => React.ReactNode) | undefined
    >();
    expectTypeOf<DataGridColumn<Person>['renderHeaderCell']>().toEqualTypeOf<
      (() => React.ReactNode) | undefined
    >();
    expectTypeOf<DataGridColumn<Person>['sortable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DataGridProps<Person>['items']>().toEqualTypeOf<readonly Person[] | undefined>();
    expectTypeOf<DataGridProps<Person>['getRowId']>().toEqualTypeOf<
      ((item: Person) => string) | undefined
    >();
    expectTypeOf<DataGridProps<Person>['columns']>().toEqualTypeOf<
      readonly DataGridColumn<Person>[] | undefined
    >();
    expectTypeOf<DataGridBodyProps<Person>['children']>().toEqualTypeOf<
      React.ReactNode | ((item: Person, index: number) => React.ReactNode)
    >();
    const NUMBER_COLUMNS: DataGridColumn<number>[] = [
      { columnId: 'n', label: 'N', renderCell: (n) => n },
    ];
    // The item type is inferred from `items`.
    const elements = [
      <DataGrid
        key="inferred"
        aria-label="People"
        items={PEOPLE}
        getRowId={(person) => {
          expectTypeOf(person).toEqualTypeOf<Person>();
          return person.id;
        }}
        columns={[
          {
            columnId: 'name',
            label: 'Name',
            compare: (a, b) => {
              expectTypeOf(a).toEqualTypeOf<Person>();
              return a.name.localeCompare(b.name);
            },
            renderCell: (person) => {
              expectTypeOf(person).toEqualTypeOf<Person>();
              return person.name;
            },
          },
        ]}
      >
        <DataGrid.Body>
          {(person: Person, index) => {
            expectTypeOf(index).toEqualTypeOf<number>();
            return person.name;
          }}
        </DataGrid.Body>
      </DataGrid>,
      // @ts-expect-error — columns of another item type.
      <DataGrid key="other-item" items={PEOPLE} columns={NUMBER_COLUMNS} />,
      // @ts-expect-error — row ids are strings.
      <DataGrid key="numeric-id" items={PEOPLE} getRowId={(person) => Number(person.id)} />,
    ];
    expect(elements).toHaveLength(3);
  });

  it('keeps 0.13 columns compiling: an untyped `DataGridColumn[]` with `id`, also extended', () => {
    expectTypeOf<DataGridColumn>().toEqualTypeOf<DataGridColumn<unknown>>();
    const columns: DataGridColumn[] = [
      { id: 'name', label: 'Name', sortable: true },
      { id: 'role', label: 'Role' },
    ];
    interface WidthColumn extends DataGridColumn {
      width: number;
    }
    const sized: WidthColumn[] = [{ id: 'name', label: 'Name', width: 120 }];
    const elements = [
      <DataGrid key="untyped" aria-label="People" columns={columns}>
        {null}
      </DataGrid>,
      // Untyped columns next to typed items.
      <DataGrid key="items" aria-label="People" columns={sized} items={PEOPLE} />,
    ];
    expect(elements).toHaveLength(2);
  });
});
