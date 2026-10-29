import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  dataGridBodyClassNames,
  dataGridCellClassNames,
  dataGridClassNames,
  dataGridHeaderCellClassNames,
  dataGridHeaderClassNames,
  dataGridRowClassNames,
  tableBodyClassNames,
  tableCellClassNames,
  tableClassNames,
  tableHeaderCellClassNames,
  tableHeaderClassNames,
  tableResizeHandleClassNames,
  tableRowClassNames,
} from '../../../lib/classNames';
import { DataGrid } from '../DataGrid';
import { Table, TableHead, TableHeadCell } from '../Table';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): table folder', () => {
  it('Table: root on the table element, the container outside it, and every part', () => {
    render(
      <Table>
        <caption>Orders</caption>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Item</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Tea</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const table = screen.getByRole('table', { name: 'Orders' });
    expect(table).toHaveClass(tableClassNames.root);
    expect(table.parentElement).toHaveClass(tableClassNames.container);
    expect(table.querySelector('thead')).toHaveClass(tableHeaderClassNames.root);
    expect(screen.getByRole('columnheader', { name: 'Item' })).toHaveClass(
      tableHeaderCellClassNames.root,
    );
    expect(table.querySelector('tbody')).toHaveClass(tableBodyClassNames.root);
    for (const row of screen.getAllByRole('row')) expect(row).toHaveClass(tableRowClassNames.root);
    expect(screen.getByRole('cell', { name: 'Tea' })).toHaveClass(tableCellClassNames.root);
  });

  it('Table.ResizeHandle: root, in a header cell and in the server HTML', () => {
    render(
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell aside={<Table.ResizeHandle width={200} onResize={() => {}} />}>
              Item
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
      </Table>,
    );
    const handle = within(screen.getByRole('columnheader', { name: /^Item/ })).getByRole(
      'separator',
      { name: 'Resize column' },
    );
    expect(handle).toHaveClass(tableResizeHandleClassNames.root);
    const host = parseServerHtml(
      renderToString(<Table.ResizeHandle width={200} onResize={() => {}} />),
    );
    expect(host.querySelector('[role="separator"]')).toHaveClass(tableResizeHandleClassNames.root);
  });

  it('the deprecated Table.Head and Table.HeadCell carry the classes of their replacements', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Table>
        <TableHead>
          <Table.Row>
            <TableHeadCell>Item</TableHeadCell>
          </Table.Row>
        </TableHead>
      </Table>,
    );
    const header = screen.getByRole('columnheader', { name: 'Item' });
    expect(header).toHaveClass(tableHeaderCellClassNames.root);
    expect(header.closest('thead')).toHaveClass(tableHeaderClassNames.root);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Table: `Table.Head` is deprecated and will be removed in 1.0. Use `Table.Header` instead.',
      ],
      [
        '[WaveUI] Table: `Table.HeadCell` is deprecated and will be removed in 1.0. Use `Table.HeaderCell` instead.',
      ],
    ]);
  });

  it('DataGrid: root, container, header with its selection cells, sortable header cell, body, row and cell', () => {
    render(
      <DataGrid
        aria-label="Files"
        selectionMode="multiple"
        defaultSort={{ columnId: 'name', direction: 'ascending' }}
      >
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Document</DataGrid.HeaderCell>
          </tr>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="report">
            <DataGrid.Cell>Report</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const grid = screen.getByRole('grid', { name: 'Files' });
    expect(grid).toHaveClass(dataGridClassNames.root);
    expect(grid.parentElement).toHaveClass(dataGridClassNames.container);

    const thead = grid.querySelector('thead') as HTMLTableSectionElement;
    expect(thead).toHaveClass(dataGridHeaderClassNames.root);
    // The first header row's select-all cell and a later row's empty cell (judgement 15).
    expect(thead.rows[0].cells[0]).toHaveClass(dataGridHeaderClassNames.selectionCell);
    expect(thead.rows[1].cells[0]).toHaveClass(dataGridHeaderClassNames.selectionCell);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveClass(
      dataGridHeaderClassNames.selectAllCheckbox,
    );

    const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
    expect(nameHeader).toHaveClass(dataGridHeaderCellClassNames.root);
    const sortButton = within(nameHeader).getByRole('button', { name: 'Name' });
    expect(sortButton).toHaveClass(dataGridHeaderCellClassNames.button);
    expect(sortButton.querySelector('svg')).toHaveClass(dataGridHeaderCellClassNames.sortIcon);

    expect(grid.querySelector('tbody')).toHaveClass(dataGridBodyClassNames.root);
    const cell = screen.getByText('Report');
    expect(cell).toHaveClass(dataGridCellClassNames.root);
    const row = cell.closest('tr') as HTMLTableRowElement;
    expect(row).toHaveClass(dataGridRowClassNames.root);
    const control = within(row).getByRole('checkbox');
    expect(control).toHaveClass(dataGridRowClassNames.selectionControl);
    expect(control.closest('td')).toHaveClass(dataGridRowClassNames.selectionCell);
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(
        <Table>
          <caption>Orders</caption>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Tea</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      ),
    );
    expect(host.querySelector('table')).toHaveClass(tableClassNames.root);
    expect(host.querySelector('td')).toHaveClass(tableCellClassNames.root);
  });
});
