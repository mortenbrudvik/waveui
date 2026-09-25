import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import {
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  createSelectionStore,
} from '../DataGrid';
import type {
  DataGridBaseProps,
  DataGridCellProps,
  DataGridColumn,
  DataGridHeaderCellProps,
  DataGridLabels,
  DataGridProps,
  DataGridRowProps,
  DataGridSort,
  SortDirection,
} from '../DataGrid';
import { getTabbableElements } from '../../../lib/focus';
import { useRovingTabIndex } from '../../../hooks/useRovingTabIndex';
import { Button } from '../../button/Button';
import { MenuButton } from '../../button/MenuButton';
import { Toolbar } from '../../button/Toolbar';
import { RadioGroup } from '../../input/RadioGroup';
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

const MIXED_SORT_COLUMN =
  '[WaveUI] DataGrid: `sortColumn` is controlled but `sortDirection` is not (mixed control). The direction is kept internally and toggles on repeated clicks, as in 0.4. Pass `sort` (`{ columnId, direction }`) to control both.';

const MIXED_SORT_DIRECTION =
  '[WaveUI] DataGrid: `sortDirection` is controlled but `sortColumn` is not (mixed control). The column is kept internally and follows the clicked header, as in 0.4. Pass `sort` (`{ columnId, direction }`) to control both.';

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
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['2', '1']);
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
    expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1', '2', '3']);
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
      expect(onSelectedItemsChange).toHaveBeenCalledWith(['2']);
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
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['1']);
      act(() => cell('Bob').focus());
      await user.keyboard(' ');
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith([]);
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
});
