import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table } from '../Table';
import { testForwardRef } from '../../../test-utils';

const renderFullTable = (props: Record<string, unknown> = {}) =>
  render(
    <Table {...props}>
      <Table.Head>
        <tr>
          <Table.HeadCell>Name</Table.HeadCell>
          <Table.HeadCell>Value</Table.HeadCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Alpha</Table.Cell>
          <Table.Cell>1</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Beta</Table.Cell>
          <Table.Cell>2</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>,
  );

describe('Table', () => {
  testForwardRef(Table, 'table', {
    children: (
      <Table.Body>
        <Table.Row>
          <Table.Cell>Cell</Table.Cell>
        </Table.Row>
      </Table.Body>
    ),
  });

  it('renders a table element', () => {
    renderFullTable({ 'data-testid': 'tbl' });
    expect(screen.getByTestId('tbl').tagName.toLowerCase()).toBe('table');
  });

  it('renders head cells', () => {
    renderFullTable();
    expect(screen.getByText('Name').tagName.toLowerCase()).toBe('th');
    expect(screen.getByText('Value').tagName.toLowerCase()).toBe('th');
  });

  it('renders body cells', () => {
    renderFullTable();
    expect(screen.getByText('Alpha').tagName.toLowerCase()).toBe('td');
  });

  it('applies striped class to rows', () => {
    renderFullTable({ striped: true });
    const rows = screen.getAllByRole('row');
    // tbody rows should have the striped class
    const bodyRows = rows.filter((r) => r.parentElement?.tagName.toLowerCase() === 'tbody');
    expect(bodyRows[0].className).toContain('odd:bg-[#fafafa]');
  });

  it('does not apply striped class by default', () => {
    renderFullTable();
    const rows = screen.getAllByRole('row');
    const bodyRows = rows.filter((r) => r.parentElement?.tagName.toLowerCase() === 'tbody');
    expect(bodyRows[0].className).not.toContain('odd:bg-[#fafafa]');
  });

  it('head cells have scope="col"', () => {
    renderFullTable();
    const ths = screen.getAllByRole('columnheader');
    ths.forEach((th) => expect(th).toHaveAttribute('scope', 'col'));
  });
});

describe('Table sub-component refs', () => {
  it('Table.Head forwards ref to thead', () => {
    const ref = React.createRef<HTMLTableSectionElement>();
    render(
      <table>
        <Table.Head ref={ref} data-testid="thead">
          <tr>
            <th>H</th>
          </tr>
        </Table.Head>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('thead'));
    expect(ref.current!.tagName.toLowerCase()).toBe('thead');
  });

  it('Table.HeadCell forwards ref to th', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    render(
      <table>
        <thead>
          <tr>
            <Table.HeadCell ref={ref} data-testid="th">
              H
            </Table.HeadCell>
          </tr>
        </thead>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('th'));
    expect(ref.current!.tagName.toLowerCase()).toBe('th');
  });

  it('Table.Body forwards ref to tbody', () => {
    const ref = React.createRef<HTMLTableSectionElement>();
    render(
      <table>
        <Table.Body ref={ref} data-testid="tbody">
          <tr>
            <td>C</td>
          </tr>
        </Table.Body>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('tbody'));
    expect(ref.current!.tagName.toLowerCase()).toBe('tbody');
  });

  it('Table.Row forwards ref to tr', () => {
    const ref = React.createRef<HTMLTableRowElement>();
    render(
      <table>
        <tbody>
          <Table.Row ref={ref} data-testid="tr">
            <td>C</td>
          </Table.Row>
        </tbody>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('tr'));
    expect(ref.current!.tagName.toLowerCase()).toBe('tr');
  });

  it('Table.Cell forwards ref to td', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    render(
      <table>
        <tbody>
          <tr>
            <Table.Cell ref={ref} data-testid="td">
              C
            </Table.Cell>
          </tr>
        </tbody>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('td'));
    expect(ref.current!.tagName.toLowerCase()).toBe('td');
  });
});
