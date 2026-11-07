import * as React from 'react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Table } from '../Table';
import type { TableProps, TableRowAppearance, TableRowProps, TableSize } from '../Table';
import { DataGrid } from '../DataGrid';
import type { DataGridBaseProps } from '../DataGrid';
import { Avatar } from '../../data-display/Avatar';
import { avatarClassNames, tableCellLayoutClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';

function SizedTable(props: Partial<TableProps>) {
  return (
    <Table aria-label="People" {...props}>
      <Table.Header>
        <tr>
          <Table.SelectionCell aria-label="Select all" />
          <Table.HeaderCell sortable sortDirection="ascending">
            Name
          </Table.HeaderCell>
          <Table.HeaderCell>Role</Table.HeaderCell>
        </tr>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.SelectionCell aria-label="Select Ann" />
          <Table.Cell>
            <Table.CellLayout media={<Avatar name="Ann Lee" />}>Ann</Table.CellLayout>
          </Table.Cell>
          <Table.Cell>Designer</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

const table = () => screen.getByRole('table', { name: 'People' });
const dataCell = () => screen.getByRole('cell', { name: 'Designer' });
const headerCell = () => screen.getByRole('columnheader', { name: 'Role' });
const sortButton = () => screen.getByRole('button', { name: 'Name' });
const selectionCell = () => screen.getByRole('checkbox', { name: 'Select Ann' }).closest('td');
const avatarRoot = () =>
  screen.getByRole('img', { name: 'Ann Lee' }).closest(`.${avatarClassNames.root}`);
const mediaBox = () => document.querySelector(`.${tableCellLayoutClassNames.media}`);

describe('Table size', () => {
  it('is medium by default and renders data-size', () => {
    render(<SizedTable />);
    expect(table()).toHaveAttribute('data-size', 'medium');
  });

  it.each<TableSize>(['medium', 'small', 'extra-small'])('renders data-size="%s"', (size) => {
    render(<SizedTable size={size} />);
    expect(table()).toHaveAttribute('data-size', size);
  });

  it('keeps the medium classes of every part: nothing is added or replaced', () => {
    render(<SizedTable size="medium" />);
    expect(dataCell()).toHaveClass('wave:px-4', 'wave:py-3', 'wave:text-body-1');
    expect(headerCell()).toHaveClass('wave:px-4', 'wave:py-3');
    expect(sortButton()).toHaveClass('wave:px-4', 'wave:py-3');
    expect(selectionCell()).toHaveClass('wave:w-10', 'wave:px-3', 'wave:py-3');
  });

  it('draws a small table with tighter padding', () => {
    render(<SizedTable size="small" />);
    expect(dataCell()).toHaveClass('wave:px-3', 'wave:py-1.75', 'wave:text-body-1');
    expect(dataCell()).not.toHaveClass('wave:px-4');
    expect(dataCell()).not.toHaveClass('wave:py-3');
    expect(headerCell()).toHaveClass('wave:px-3', 'wave:py-2');
    expect(headerCell()).not.toHaveClass('wave:py-3');
    expect(sortButton()).toHaveClass('wave:px-3', 'wave:py-2');
    expect(sortButton()).not.toHaveClass('wave:py-3');
    expect(selectionCell()).toHaveClass('wave:py-2');
    expect(selectionCell()).not.toHaveClass('wave:py-3');
  });

  it('draws an extra-small table with the caption type size in its cells', () => {
    render(<SizedTable size="extra-small" />);
    expect(dataCell()).toHaveClass('wave:px-2', 'wave:py-1', 'wave:text-caption-1');
    expect(dataCell()).not.toHaveClass('wave:text-body-1');
    expect(headerCell()).toHaveClass('wave:px-2', 'wave:py-1');
    expect(sortButton()).toHaveClass('wave:px-2', 'wave:py-1');
    expect(selectionCell()).toHaveClass('wave:px-2', 'wave:py-1');
  });

  it('sizes the media of a cell layout: the Avatar box and the icon box', () => {
    const sizes: Array<[TableSize, string, string]> = [
      ['medium', '32', 'wave:[&>svg]:size-5'],
      ['small', '24', 'wave:[&>svg]:size-5'],
      ['extra-small', '20', 'wave:[&>svg]:size-4'],
    ];
    for (const [size, box, icon] of sizes) {
      const { unmount } = render(<SizedTable size={size} />);
      expect(avatarRoot()).toHaveAttribute('data-size', box);
      expect(mediaBox()).toHaveClass(icon);
      unmount();
    }
  });

  it('lets a class of your own on a part win over the size', () => {
    render(
      <Table aria-label="People" size="small">
        <Table.Body>
          <Table.Row>
            <Table.Cell className="p-8">Designer</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    expect(dataCell()).toHaveClass('p-8');
    expect(dataCell()).not.toHaveClass('wave:px-3');
    expect(dataCell()).not.toHaveClass('wave:py-1.75');
  });

  it('draws a cell on its own as medium', () => {
    render(
      <table>
        <tbody>
          <tr>
            <Table.Cell>Alone</Table.Cell>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole('cell')).toHaveClass('wave:px-4', 'wave:py-3');
  });

  it('is not shared with a table nested in a cell', () => {
    render(
      <Table aria-label="Outer" size="extra-small">
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Table aria-label="Inner">
                <Table.Body>
                  <Table.Row>
                    <Table.Cell>Nested</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    expect(screen.getByRole('table', { name: 'Inner' })).toHaveAttribute('data-size', 'medium');
    expect(screen.getByRole('cell', { name: 'Nested' })).toHaveClass('wave:py-3');
  });

  it('renders the same on the server', () => {
    const html = renderToString(<SizedTable size="small" />);
    expect(html).toContain('data-size="small"');
    expect(html).toContain('wave:py-1.75');
  });

  it.each<TableSize>(['medium', 'small', 'extra-small'])(
    'has no axe violations (%s)',
    async (size) => {
      const { container } = render(<SizedTable size={size} />);
      await expectNoA11yViolations(container);
    },
  );

  it('types the sizes', () => {
    expectTypeOf<TableSize>().toEqualTypeOf<'medium' | 'small' | 'extra-small'>();
    expectTypeOf<TableProps['size']>().toEqualTypeOf<TableSize | undefined>();
    expectTypeOf<DataGridBaseProps['size']>().toEqualTypeOf<TableSize | undefined>();
    // @ts-expect-error -- `large` is not a table density.
    const invalid: TableProps = { size: 'large', children: null };
    void invalid;
  });
});

describe('DataGrid size', () => {
  function SizedGrid(props: Partial<DataGridBaseProps>) {
    return (
      <DataGrid aria-label="People" selectionMode="multiple" {...props}>
        <DataGrid.Header>
          <DataGrid.Row>
            <DataGrid.HeaderCell columnId="name" sortable>
              Name
            </DataGrid.HeaderCell>
            <DataGrid.HeaderCell>Role</DataGrid.HeaderCell>
          </DataGrid.Row>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="ann">
            <DataGrid.Cell>
              <Table.CellLayout media={<Avatar name="Ann Lee" />}>Ann</Table.CellLayout>
            </DataGrid.Cell>
            <DataGrid.Cell>Designer</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>
    );
  }
  const grid = () => screen.getByRole('grid', { name: 'People' });
  const cell = () => screen.getByRole('gridcell', { name: 'Designer' });

  it('is medium by default and renders data-size', () => {
    render(<SizedGrid />);
    expect(grid()).toHaveAttribute('data-size', 'medium');
    expect(cell()).toHaveClass('wave:px-4', 'wave:py-3', 'wave:text-body-1');
  });

  it('draws a small grid: cells, header cells, sort buttons, selection cells and media', () => {
    render(<SizedGrid size="small" />);
    expect(grid()).toHaveAttribute('data-size', 'small');
    expect(cell()).toHaveClass('wave:px-3', 'wave:py-1.75');
    expect(cell()).not.toHaveClass('wave:py-3');
    expect(screen.getByRole('columnheader', { name: 'Role' })).toHaveClass(
      'wave:px-3',
      'wave:py-2',
    );
    expect(screen.getByRole('button', { name: 'Name' })).toHaveClass('wave:px-3', 'wave:py-2');
    expect(screen.getByRole('checkbox', { name: 'Select all rows' }).closest('th')).toHaveClass(
      'wave:py-2',
    );
    expect(screen.getByRole('checkbox', { name: /Select/ }).closest('td, th')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Ann Lee' }).closest(`.${avatarClassNames.root}`),
    ).toHaveAttribute('data-size', '24');
  });

  it('draws an extra-small grid with the caption type size in its cells', () => {
    render(<SizedGrid size="extra-small" />);
    expect(cell()).toHaveClass('wave:px-2', 'wave:py-1', 'wave:text-caption-1');
  });

  it('has no axe violations', async () => {
    const { container } = render(<SizedGrid size="extra-small" />);
    await expectNoA11yViolations(container);
  });
});

describe('Table.Row appearance', () => {
  function Rows({
    appearance,
    className,
  }: {
    appearance?: TableRowAppearance;
    className?: string;
  }) {
    return (
      <Table aria-label="People">
        <Table.Body>
          <Table.Row appearance={appearance} className={className}>
            <Table.Cell>
              Ann
              <Table.CellActions>
                <button type="button">Edit</button>
              </Table.CellActions>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
  }
  const row = () => screen.getAllByRole('row')[0];

  it('is none by default and draws no fill of its own', () => {
    render(<Rows />);
    expect(row()).toHaveAttribute('data-appearance', 'none');
    expect(row()).toHaveClass('wave:hover:bg-subtle-hover');
    expect(row().className).not.toMatch(/wave:bg-selected|wave:bg-subtle-selected/);
  });

  it('fills a brand row with the selected token and keeps the fill while hovered', () => {
    render(<Rows appearance="brand" />);
    expect(row()).toHaveAttribute('data-appearance', 'brand');
    expect(row()).toHaveClass('wave:bg-selected', 'wave:hover:bg-selected');
    // The row's own hover word is replaced, not kept beside the fill's.
    expect(row()).not.toHaveClass('wave:hover:bg-subtle-hover');
    // Forced colors outline the row where they drop the fill.
    expect(row().className).toContain('wave:forced-colors:outline-[Highlight]');
  });

  it('fills a neutral row with the subtle selected token', () => {
    render(<Rows appearance="neutral" />);
    expect(row()).toHaveAttribute('data-appearance', 'neutral');
    expect(row()).toHaveClass('wave:bg-subtle-selected', 'wave:hover:bg-subtle-selected');
    expect(row()).not.toHaveClass('wave:hover:bg-subtle-hover');
  });

  it('lets a background class of your own win over the fill', () => {
    render(<Rows appearance="brand" className="bg-wave-error" />);
    expect(row()).toHaveClass('bg-wave-error');
    expect(row()).not.toHaveClass('wave:bg-selected');
  });

  it('makes the cell actions follow the fill of the row', () => {
    render(<Rows appearance="brand" />);
    const actions = screen.getByRole('button', { name: 'Edit' }).parentElement as HTMLElement;
    expect(actions.className).toContain('wave:[tr[data-appearance=brand]>*>&]:bg-selected');
    expect(actions.className).toContain(
      'wave:[tr[data-appearance=neutral]>*>&]:bg-subtle-selected',
    );
  });

  it('types the appearances', () => {
    expectTypeOf<TableRowAppearance>().toEqualTypeOf<'none' | 'brand' | 'neutral'>();
    expectTypeOf<TableRowProps['appearance']>().toEqualTypeOf<TableRowAppearance | undefined>();
  });

  it.each<TableRowAppearance>(['none', 'brand', 'neutral'])(
    'has no axe violations (%s)',
    async (appearance) => {
      const { container } = render(<Rows appearance={appearance} />);
      await expectNoA11yViolations(container);
    },
  );
});
