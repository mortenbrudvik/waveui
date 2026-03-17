import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataGrid } from '../DataGrid';

function renderGrid(props: Record<string, unknown> = {}) {
  return render(
    <DataGrid {...props}>
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell columnId="name" sortable>
            Name
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="role">Role</DataGrid.HeaderCell>
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>
        <DataGrid.Row rowId="1">
          <DataGrid.Cell>Alice</DataGrid.Cell>
          <DataGrid.Cell>Engineer</DataGrid.Cell>
        </DataGrid.Row>
        <DataGrid.Row rowId="2">
          <DataGrid.Cell>Bob</DataGrid.Cell>
          <DataGrid.Cell>Designer</DataGrid.Cell>
        </DataGrid.Row>
      </DataGrid.Body>
    </DataGrid>,
  );
}

describe('DataGrid', () => {
  it('renders a table with role="grid"', () => {
    renderGrid({ 'data-testid': 'grid' });
    const table = screen.getByTestId('grid');
    expect(table.tagName.toLowerCase()).toBe('table');
    expect(table).toHaveAttribute('role', 'grid');
  });

  it('forwards ref to the table element', () => {
    const ref = React.createRef<HTMLTableElement>();
    render(
      <DataGrid ref={ref} data-testid="grid">
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

  it('renders header cells and body cells', () => {
    renderGrid();
    expect(screen.getByText('Name').closest('th')).toBeInTheDocument();
    expect(screen.getByText('Alice').tagName.toLowerCase()).toBe('td');
  });

  it('merges custom className', () => {
    renderGrid({ className: 'my-custom' });
    expect(screen.getByRole('grid').className).toContain('my-custom');
  });
});

describe('DataGrid sorting', () => {
  it('applies aria-sort when a column is sorted', () => {
    renderGrid({ defaultSortColumn: 'name', defaultSortDirection: 'ascending' });
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  it('calls onSortChange when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ onSortChange });

    await user.click(screen.getByText('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'ascending');
  });

  it('toggles sort direction on repeated clicks', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ onSortChange });

    await user.click(screen.getByText('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'ascending');

    await user.click(screen.getByText('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'descending');
  });

  it('supports keyboard sorting with Enter', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGrid({ onSortChange });

    const nameHeader = screen.getByText('Name').closest('th')!;
    nameHeader.focus();
    await user.keyboard('{Enter}');
    expect(onSortChange).toHaveBeenCalledWith('name', 'ascending');
  });
});

describe('DataGrid selection', () => {
  it('renders checkboxes in multiple selection mode', () => {
    renderGrid({ selectionMode: 'multiple' });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('renders radio buttons in single selection mode', () => {
    renderGrid({ selectionMode: 'single' });
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(2);
  });

  it('calls onSelectionChange when a row checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderGrid({ selectionMode: 'multiple', onSelectionChange });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalled();
    const selectedKeys = onSelectionChange.mock.calls[0][0];
    expect(selectedKeys.has('1')).toBe(true);
  });

  it('applies aria-selected to selected rows', () => {
    renderGrid({
      selectionMode: 'multiple',
      selectedKeys: new Set(['1']),
    });
    const rows = screen.getAllByRole('row');
    const bodyRows = rows.filter((r) => r.parentElement?.tagName.toLowerCase() === 'tbody');
    expect(bodyRows[0]).toHaveAttribute('aria-selected', 'true');
    expect(bodyRows[1]).toHaveAttribute('aria-selected', 'false');
  });
});

describe('DataGrid sub-component refs', () => {
  it('DataGrid.Header forwards ref', () => {
    const ref = React.createRef<HTMLTableSectionElement>();
    render(
      <table>
        <DataGrid.Header ref={ref} data-testid="hdr">
          <tr>
            <th>H</th>
          </tr>
        </DataGrid.Header>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('hdr'));
    expect(ref.current!.tagName.toLowerCase()).toBe('thead');
  });

  it('DataGrid.HeaderCell forwards ref', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    render(
      <table>
        <thead>
          <tr>
            <DataGrid.HeaderCell ref={ref} data-testid="hc">
              H
            </DataGrid.HeaderCell>
          </tr>
        </thead>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('hc'));
    expect(ref.current!.tagName.toLowerCase()).toBe('th');
  });

  it('DataGrid.Body forwards ref', () => {
    const ref = React.createRef<HTMLTableSectionElement>();
    render(
      <table>
        <DataGrid.Body ref={ref} data-testid="body">
          <tr>
            <td>C</td>
          </tr>
        </DataGrid.Body>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('body'));
    expect(ref.current!.tagName.toLowerCase()).toBe('tbody');
  });

  it('DataGrid.Row forwards ref', () => {
    const ref = React.createRef<HTMLTableRowElement>();
    render(
      <DataGrid>
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
      <table>
        <tbody>
          <tr>
            <DataGrid.Cell ref={ref} data-testid="cell">
              C
            </DataGrid.Cell>
          </tr>
        </tbody>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('cell'));
    expect(ref.current!.tagName.toLowerCase()).toBe('td');
  });
});
