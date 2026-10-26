import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  Table,
  TableBody,
  TableCell,
  TableCellActions,
  TableCellLayout,
  TableHead,
  TableHeadCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableSelectionCell,
} from '../Table';
import type {
  TableCellActionsProps,
  TableCellLayoutProps,
  TableProps,
  TableSelectionCellCheckedChangeDetails,
  TableSelectionCellProps,
} from '../Table';
import { DataGrid } from '../DataGrid';
import { Avatar } from '../../data-display/Avatar';
import {
  asClientReference,
  expectNoA11yViolations,
  installResizeObserverMock,
  renderWithProviders,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
import {
  avatarClassNames,
  tableCellActionsClassNames,
  tableCellLayoutClassNames,
  tableHeaderCellClassNames,
  tableSelectionCellClassNames,
} from '../../../lib/classNames';

function tableContent() {
  return [
    <Table.Header key="header">
      <tr>
        <Table.HeaderCell>Name</Table.HeaderCell>
        <Table.HeaderCell>Value</Table.HeaderCell>
      </tr>
    </Table.Header>,
    <Table.Body key="body">
      <Table.Row>
        <Table.Cell>Alpha</Table.Cell>
        <Table.Cell>1</Table.Cell>
      </Table.Row>
      <Table.Row>
        <Table.Cell>Beta</Table.Cell>
        <Table.Cell>2</Table.Cell>
      </Table.Row>
    </Table.Body>,
  ];
}

const renderFullTable = (props: Partial<TableProps> & Record<`data-${string}`, string> = {}) =>
  render(<Table {...props}>{props.children ?? tableContent()}</Table>);

function bodyRows(): HTMLElement[] {
  return screen
    .getAllByRole('row')
    .filter((row) => row.parentElement?.tagName.toLowerCase() === 'tbody');
}

/** Makes the wrapper report a content width larger than its own (a horizontally scrolling table). */
function makeScrollable(wrapper: HTMLElement, scrollable = true) {
  Object.defineProperty(wrapper, 'scrollWidth', {
    configurable: true,
    value: scrollable ? 900 : 300,
  });
  Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: 300 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Table', () => {
  testSystemProps(Table, {
    expectedTag: 'table',
    displayName: 'Table',
    defaultProps: { children: tableContent() },
    conflictingClass: { className: 'border-collapse', overrides: 'border-separate' },
    a11yVariants: [{ name: 'striped', props: { striped: true } }],
  });

  testCompoundExposure(Table, ['Header', 'HeaderCell', 'Head', 'HeadCell', 'Body', 'Row', 'Cell']);

  it('exports every sub-component under a flat name bound to the dotted member', () => {
    expect(TableHeader).toBe(Table.Header);
    expect(TableHeaderCell).toBe(Table.HeaderCell);
    expect(TableHead).toBe(Table.Head);
    expect(TableHeadCell).toBe(Table.HeadCell);
    expect(TableBody).toBe(Table.Body);
    expect(TableRow).toBe(Table.Row);
    expect(TableCell).toBe(Table.Cell);
  });

  it('renders a table element', () => {
    renderFullTable({ 'data-testid': 'tbl' });
    expect(screen.getByTestId('tbl').tagName.toLowerCase()).toBe('table');
  });

  it('renders header cells as column headers with scope="col"', () => {
    renderFullTable();
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((th) => th.textContent)).toEqual(['Name', 'Value']);
    for (const th of headers) {
      expect(th.tagName.toLowerCase()).toBe('th');
      expect(th).toHaveAttribute('scope', 'col');
      expect(th).toHaveClass('text-start');
      expect(th).not.toHaveClass('text-left');
    }
    expect(headers[0].closest('thead')).toHaveClass('bg-card');
  });

  it('renders body cells', () => {
    renderFullTable();
    expect(screen.getByRole('cell', { name: 'Alpha' }).tagName.toLowerCase()).toBe('td');
    expect(screen.getByRole('cell', { name: 'Alpha' })).toHaveClass('border-border');
  });

  it('highlights rows on hover with the theme token and no motion under reduced motion', () => {
    renderFullTable();
    expect(bodyRows()[0]).toHaveClass(
      'hover:bg-subtle-hover',
      'transition-colors',
      'motion-reduce:transition-none',
    );
  });

  describe('deprecated Head / HeadCell', () => {
    it('render the same header and warn once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Table>
          <Table.Head data-testid="thead">
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
          </Table.Body>
        </Table>,
      );
      expect(screen.getByTestId('thead').tagName.toLowerCase()).toBe('thead');
      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
      expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('scope', 'col');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Table: `Table.Head` is deprecated and will be removed in 1.0. Use `Table.Header` instead.',
        ],
        [
          '[WaveUI] Table: `Table.HeadCell` is deprecated and will be removed in 1.0. Use `Table.HeaderCell` instead.',
        ],
      ]);
    });

    it('Table.Header does not warn', () => {
      const warn = vi.spyOn(console, 'warn');
      renderFullTable();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('striped', () => {
    it('stripes odd body rows with a zero-specificity CSS selector on the table', () => {
      renderFullTable({ striped: true, 'data-testid': 'tbl' });
      const table = screen.getByTestId('tbl');
      expect(table).toHaveAttribute('data-striped');
      // `:where()` keeps the stripe at specificity 0, so any row class (a consumer
      // `bg-selected`, the row's own hover class) wins over it (C-CLASS).
      expect(table).toHaveClass('[:where(&>tbody>tr:nth-child(odd))]:bg-card');
      expect(table.className).not.toContain('[&>tbody');
      // Rows need no context: the stripe comes from the table.
      expect(bodyRows()[0].className).not.toMatch(/odd:|bg-card/);
    });

    it('leaves a row’s own background class as the only row background on a striped table', () => {
      render(
        <Table striped data-testid="tbl">
          <Table.Body>
            <Table.Row className="bg-selected" data-testid="row">
              <Table.Cell>Alpha</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      );
      // jsdom does not evaluate cascade precedence, so this guards the structure that makes the
      // row's class win in a browser: the stripe is only the table's zero-specificity `:where()`
      // rule, and no stripe class (an `odd:` variant outranks a plain class) lands on the row.
      const table = screen.getByTestId('tbl');
      const stripeClasses = table.className.split(/\s+/).filter((c) => c.includes('nth-child'));
      expect(stripeClasses).toEqual(['[:where(&>tbody>tr:nth-child(odd))]:bg-card']);
      // Every non-hover background class of the row: only the consumer's, not dropped by cn.
      const rowBackgrounds = screen
        .getByTestId('row')
        .className.split(/\s+/)
        .filter((c) => /(^|:)bg-/.test(c) && !c.startsWith('hover:'));
      expect(rowBackgrounds).toEqual(['bg-selected']);
    });

    it('is off by default', () => {
      renderFullTable({ 'data-testid': 'tbl' });
      const table = screen.getByTestId('tbl');
      expect(table).not.toHaveAttribute('data-striped');
      expect(table.className).not.toContain('nth-child');
    });

    it('rows render without a Table ancestor', () => {
      render(
        <table>
          <tbody>
            <Table.Row data-testid="row">
              <Table.Cell>Alpha</Table.Cell>
            </Table.Row>
          </tbody>
        </table>,
      );
      expect(screen.getByTestId('row')).toHaveTextContent('Alpha');
    });
  });

  describe('scroll container', () => {
    it('wraps the table in a horizontally scrollable container', () => {
      renderFullTable();
      const wrapper = screen.getByRole('table').parentElement!;
      expect(wrapper).toHaveClass('overflow-x-auto', 'rounded-md', 'border', 'border-border');
      expect(wrapper).not.toHaveClass('overflow-hidden');
      expect(wrapper).not.toHaveClass('rounded-lg');
      expect(wrapper).not.toHaveAttribute('tabindex');
      expect(wrapper).not.toHaveAttribute('role');
    });

    it('forwards containerProps (className, style, ref) to the wrapper', () => {
      const ref = React.createRef<HTMLDivElement>();
      renderFullTable({
        containerProps: {
          className: 'max-w-md rounded-none',
          style: { maxHeight: 120 },
          ref,
        },
      });
      const wrapper = screen.getByRole('table').parentElement!;
      expect(ref.current).toBe(wrapper);
      expect(wrapper).toHaveClass('max-w-md', 'rounded-none', 'overflow-x-auto');
      expect(wrapper).not.toHaveClass('rounded-md');
      expect(wrapper).toHaveStyle({ maxHeight: '120px' });
    });

    it('becomes a focusable region named by the caption when it scrolls', async () => {
      const resize = installResizeObserverMock();
      try {
        const user = userEvent.setup();
        render(
          <Table>
            <caption>Quarterly figures</caption>
            {tableContent()}
          </Table>,
        );
        const wrapper = screen.getByRole('table').parentElement!;
        expect(wrapper).not.toHaveAttribute('tabindex');

        makeScrollable(wrapper);
        resize.trigger(wrapper);

        const region = screen.getByRole('region', { name: 'Quarterly figures' });
        expect(region).toBe(wrapper);
        expect(region).toHaveAttribute('tabindex', '0');
        await user.tab();
        expect(region).toHaveFocus();

        makeScrollable(wrapper, false);
        resize.trigger(wrapper);
        expect(wrapper).not.toHaveAttribute('tabindex');
        expect(screen.queryByRole('region')).toBeNull();
      } finally {
        resize.restore();
      }
    });

    it('is named by a caption inside a Fragment too', () => {
      const resize = installResizeObserverMock();
      try {
        render(
          <Table>
            <>
              <caption>Quarterly figures</caption>
              {tableContent()}
            </>
          </Table>,
        );
        const wrapper = screen.getByRole('table').parentElement!;
        makeScrollable(wrapper);
        resize.trigger(wrapper);
        expect(screen.getByRole('region', { name: 'Quarterly figures' })).toBe(wrapper);
      } finally {
        resize.restore();
      }
    });

    it('keeps a caption’s own id and names the region with containerProps aria-label', () => {
      const resize = installResizeObserverMock();
      try {
        const { rerender } = render(
          <Table>
            <caption id="figures">Quarterly figures</caption>
            {tableContent()}
          </Table>,
        );
        const wrapper = screen.getByRole('table').parentElement!;
        makeScrollable(wrapper);
        resize.trigger(wrapper);
        expect(wrapper).toHaveAttribute('aria-labelledby', 'figures');

        rerender(
          <Table containerProps={{ 'aria-label': 'Figures, scrollable' }}>
            <caption id="figures">Quarterly figures</caption>
            {tableContent()}
          </Table>,
        );
        expect(screen.getByRole('region', { name: 'Figures, scrollable' })).toBe(wrapper);
      } finally {
        resize.restore();
      }
    });

    it('keeps a containerProps aria-label that comes with a role while the table does not scroll', () => {
      render(
        <Table containerProps={{ 'aria-label': 'Figures', role: 'region' }}>
          {tableContent()}
        </Table>,
      );
      const wrapper = screen.getByRole('table').parentElement!;
      expect(screen.getByRole('region', { name: 'Figures' })).toBe(wrapper);
      expect(wrapper).not.toHaveAttribute('tabindex');
    });

    it('keeps a containerProps aria-labelledby that comes with a role', () => {
      render(
        <>
          <h2 id="figures-heading">Figures</h2>
          <Table containerProps={{ 'aria-labelledby': 'figures-heading', role: 'group' }}>
            {tableContent()}
          </Table>
        </>,
      );
      expect(screen.getByRole('group', { name: 'Figures' })).toBe(
        screen.getByRole('table').parentElement,
      );
    });

    it('does not put a containerProps aria-label on a role-less wrapper that does not scroll', () => {
      render(<Table containerProps={{ 'aria-label': 'Figures' }}>{tableContent()}</Table>);
      const wrapper = screen.getByRole('table').parentElement!;
      expect(wrapper).not.toHaveAttribute('aria-label');
      expect(wrapper).not.toHaveAttribute('role');
    });

    it('stays keyboard-scrollable without a name and warns', () => {
      const resize = installResizeObserverMock();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        renderFullTable();
        const wrapper = screen.getByRole('table').parentElement!;
        makeScrollable(wrapper);
        resize.trigger(wrapper);
        expect(wrapper).toHaveAttribute('tabindex', '0');
        expect(wrapper).not.toHaveAttribute('role');
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Table: the table scrolls horizontally but its scroll region has no name. Add a <caption> or containerProps["aria-label"].',
          ],
        ]);
      } finally {
        resize.restore();
      }
    });
  });
});

describe('Table sub-component refs', () => {
  it('Table.Header forwards ref to thead', () => {
    const ref = React.createRef<HTMLTableSectionElement>();
    render(
      <table>
        <Table.Header ref={ref} data-testid="thead">
          <tr>
            <th>H</th>
          </tr>
        </Table.Header>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('thead'));
    expect(ref.current!.tagName.toLowerCase()).toBe('thead');
  });

  it('Table.Head (deprecated) forwards ref to thead', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Table: `Table.Head` is deprecated and will be removed in 1.0. Use `Table.Header` instead.',
      ],
    ]);
  });

  it('Table.HeaderCell forwards ref to th', () => {
    const ref = React.createRef<HTMLTableCellElement>();
    render(
      <table>
        <thead>
          <tr>
            <Table.HeaderCell ref={ref} data-testid="th">
              H
            </Table.HeaderCell>
          </tr>
        </thead>
      </table>,
    );
    expect(ref.current).toBe(screen.getByTestId('th'));
    expect(ref.current!.tagName.toLowerCase()).toBe('th');
  });

  it('Table.HeadCell (deprecated) forwards ref to th', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Table: `Table.HeadCell` is deprecated and will be removed in 1.0. Use `Table.HeaderCell` instead.',
      ],
    ]);
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

describe('Table.HeaderCell sortable', () => {
  const renderSortable = (
    cell: React.ReactNode,
    options?: Parameters<typeof renderWithProviders>[1],
  ) =>
    renderWithProviders(
      <Table>
        <Table.Header>
          <tr>{cell}</tr>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Alpha</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
      options,
    );
  const header = () => screen.getByRole('columnheader');
  const sortButton = () => screen.getByRole('button', { name: 'Name' });
  const glyph = () => sortButton().querySelector(`.${tableHeaderCellClassNames.sortIcon}`);

  it('renders a button inside the th, with aria-sort none while no direction is set', () => {
    renderSortable(<Table.HeaderCell sortable>Name</Table.HeaderCell>);
    expect(header()).toHaveAttribute('aria-sort', 'none');
    expect(header()).toHaveAttribute('scope', 'col');
    expect(sortButton().closest('th')).toBe(header());
    expect(sortButton()).toHaveAttribute('type', 'button');
    expect(sortButton()).toHaveClass(tableHeaderCellClassNames.button);
    expect(header()).not.toHaveAttribute('tabindex');
    expect(glyph()).toBeNull();
  });

  it.each(['ascending', 'descending'] as const)(
    'sets aria-sort %s and shows a decorative glyph with data-direction',
    (sortDirection) => {
      renderSortable(
        <Table.HeaderCell sortable sortDirection={sortDirection}>
          Name
        </Table.HeaderCell>,
      );
      expect(header()).toHaveAttribute('aria-sort', sortDirection);
      expect(glyph()).toHaveAttribute('data-direction', sortDirection);
      expect(glyph()).toHaveAttribute('aria-hidden', 'true');
      expect(glyph()).toHaveAttribute(
        'data-wave-icon',
        sortDirection === 'ascending' ? 'sort-arrow-up' : 'sort-arrow-down',
      );
      expect(sortButton()).toHaveAccessibleName('Name');
    },
  );

  it('renders no sort semantics without sortable, whatever the direction', () => {
    renderSortable(<Table.HeaderCell sortDirection="ascending">Name</Table.HeaderCell>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(header()).not.toHaveAttribute('aria-sort');
  });

  it('keeps a plain header exactly as before', () => {
    renderSortable(<Table.HeaderCell>Name</Table.HeaderCell>);
    expect(header().innerHTML).toBe('Name');
    expect(header()).not.toHaveAttribute('aria-sort');
  });

  it('calls onSortClick with the click event, and the th onClick through bubbling', async () => {
    const user = userEvent.setup();
    const clicked: unknown[] = [];
    const onSortClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      clicked.push(event.currentTarget);
    });
    const onClick = vi.fn();
    renderSortable(
      <Table.HeaderCell sortable onSortClick={onSortClick} onClick={onClick}>
        Name
      </Table.HeaderCell>,
    );
    await user.click(sortButton());
    expect(onSortClick).toHaveBeenCalledTimes(1);
    expect(onSortClick.mock.calls[0][0].type).toBe('click');
    expect(clicked).toEqual([sortButton()]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates onSortClick with Enter and Space', async () => {
    const user = userEvent.setup();
    const onSortClick = vi.fn();
    renderSortable(
      <Table.HeaderCell sortable onSortClick={onSortClick}>
        Name
      </Table.HeaderCell>,
    );
    await user.tab();
    expect(sortButton()).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onSortClick).toHaveBeenCalledTimes(2);
  });

  it('does not change the sort by itself (the direction is controlled)', async () => {
    const user = userEvent.setup();
    renderSortable(
      <Table.HeaderCell sortable sortDirection="ascending">
        Name
      </Table.HeaderCell>,
    );
    await user.click(sortButton());
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
  });

  describe('sortIcon', () => {
    it('renders custom content in a decorative span with the direction, only while sorted', () => {
      const { rerender } = renderSortable(
        <Table.HeaderCell sortable sortIcon={<svg data-testid="custom" />}>
          Name
        </Table.HeaderCell>,
      );
      expect(screen.queryByTestId('custom')).toBeNull();
      rerender(
        <Table>
          <Table.Header>
            <tr>
              <Table.HeaderCell
                sortable
                sortDirection="descending"
                sortIcon={<svg data-testid="custom" />}
              >
                Name
              </Table.HeaderCell>
            </tr>
          </Table.Header>
        </Table>,
      );
      const span = screen.getByTestId('custom').parentElement!;
      expect(span.localName).toBe('span');
      expect(span).toHaveClass(tableHeaderCellClassNames.sortIcon);
      expect(span).toHaveAttribute('aria-hidden', 'true');
      expect(span).toHaveAttribute('data-direction', 'descending');
      expect(sortButton()).toHaveAccessibleName('Name');
    });

    it('takes a slot object, its className merged after the stable class', () => {
      renderSortable(
        <Table.HeaderCell
          sortable
          sortDirection="ascending"
          sortIcon={{ className: 'my-glyph', children: '▲' }}
        >
          Name
        </Table.HeaderCell>,
      );
      expect(glyph()).toHaveClass(tableHeaderCellClassNames.sortIcon, 'my-glyph');
      expect(glyph()).toHaveTextContent('▲');
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('keeps the default arrow for %s', (_, sortIcon) => {
      renderSortable(
        <Table.HeaderCell sortable sortDirection="ascending" sortIcon={sortIcon}>
          Name
        </Table.HeaderCell>,
      );
      expect(glyph()).toHaveAttribute('data-wave-icon', 'sort-arrow-up');
    });

    it.each([
      ['false', false],
      ['an empty string', ''],
      ['an empty Fragment', <></>],
    ])('shows no glyph for %s', (_, sortIcon) => {
      renderSortable(
        <Table.HeaderCell sortable sortDirection="ascending" sortIcon={sortIcon}>
          Name
        </Table.HeaderCell>,
      );
      expect(header()).toHaveAttribute('aria-sort', 'ascending');
      expect(sortButton().children).toHaveLength(0);
    });

    it('unwraps a button passed as sortIcon and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderSortable(
        <Table.HeaderCell
          sortable
          sortDirection="ascending"
          sortIcon={<button type="button">^</button>}
        >
          Name
        </Table.HeaderCell>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(glyph()).toHaveTextContent('^');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('Table.HeaderCell');
      expect(warn.mock.calls[0][0]).toContain('sortIcon');
    });
  });

  describe('aside', () => {
    it('renders outside the button, after it, in the th', () => {
      renderSortable(
        <Table.HeaderCell sortable aside={<span data-testid="aside">Filter</span>}>
          Name
        </Table.HeaderCell>,
      );
      const aside = screen.getByTestId('aside');
      expect(header()).toContainElement(aside);
      expect(sortButton()).not.toContainElement(aside);
      expect(sortButton()).toHaveAccessibleName('Name');
      expect(aside.closest(`.${tableHeaderCellClassNames.aside}`)).not.toBeNull();
      expect(
        sortButton().compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('takes a slot object, its className merged after the stable class', () => {
      renderSortable(
        <Table.HeaderCell sortable aside={{ className: 'my-aside', children: 'x' }}>
          Name
        </Table.HeaderCell>,
      );
      const aside = header().querySelector(`.${tableHeaderCellClassNames.aside}`);
      expect(aside).toHaveClass('my-aside');
      expect(aside).toHaveTextContent('x');
    });

    it('renders on a plain header too, beside the content', () => {
      renderSortable(
        <Table.HeaderCell aside={<span data-testid="aside">Filter</span>}>Name</Table.HeaderCell>,
      );
      expect(header()).toContainElement(screen.getByTestId('aside'));
      expect(screen.queryByRole('button')).toBeNull();
    });

    it.each([
      ['null', null],
      ['false', false],
      ['an empty Fragment', <></>],
    ])('renders nothing for %s', (_, aside) => {
      renderSortable(
        <Table.HeaderCell sortable aside={aside}>
          Name
        </Table.HeaderCell>,
      );
      expect(header().querySelector(`.${tableHeaderCellClassNames.aside}`)).toBeNull();
    });
  });

  it('passes axe, plain, sorted and with an aside', async () => {
    renderSortable(
      <>
        <Table.HeaderCell sortable>A</Table.HeaderCell>
        <Table.HeaderCell sortable sortDirection="descending" aside={<span>i</span>}>
          B
        </Table.HeaderCell>
        <Table.HeaderCell>C</Table.HeaderCell>
      </>,
    );
    await expectNoA11yViolations();
  });

  it('mirrors in RTL: the text starts at the inline start and the glyph follows the label', () => {
    renderSortable(
      <Table.HeaderCell sortable sortDirection="ascending" aside={<span>i</span>}>
        Name
      </Table.HeaderCell>,
      { dir: 'rtl' },
    );
    expect(sortButton()).toHaveClass('text-start');
    expect(sortButton()).toHaveAccessibleName('Name');
    expect(sortButton().lastElementChild).toBe(glyph());
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
  });
});

// ---------------------------------------------------------------------------
// Table.SelectionCell, Table.CellLayout and Table.CellActions (P9-05)
// ---------------------------------------------------------------------------

/** A body row around the cells under test. */
function CellRow({ children }: { children: React.ReactNode }) {
  return (
    <table>
      <tbody>
        <Table.Row data-testid="row">{children}</Table.Row>
      </tbody>
    </table>
  );
}

/** A body cell around the content under test. */
function InCell({ children }: { children: React.ReactNode }) {
  return (
    <table>
      <tbody>
        <Table.Row data-testid="row">
          <Table.Cell data-testid="cell">{children}</Table.Cell>
        </Table.Row>
      </tbody>
    </table>
  );
}

/** The classes that keep a part transparent until its table row is hovered or holds focus. */
const ROW_REVEAL = [
  'opacity-0',
  'group-hover/table-row:opacity-100',
  'group-focus-within/table-row:opacity-100',
  'forced-colors:opacity-100',
  'pointer-coarse:opacity-100',
];

const NAME_WARNING =
  '[WaveUI] Table.SelectionCell: the selection control has no accessible name. Pass ' +
  '`aria-label` (e.g. "Select Alpha") or `aria-labelledby` (e.g. the id of the row’s first cell).';

describe('Table.SelectionCell', () => {
  testSystemProps(TableSelectionCell, {
    expectedTag: 'td',
    displayName: 'TableSelectionCell',
    defaultProps: { 'aria-label': 'Select Alpha' },
    control: { role: 'checkbox' },
    conflictingClass: { className: 'w-12', overrides: 'w-10' },
    a11yVariants: [
      { name: 'checked', props: { defaultChecked: true } },
      { name: 'mixed', props: { checked: 'mixed' } },
      { name: 'radio', props: { type: 'radio' } },
      { name: 'subtle', props: { subtle: true } },
    ],
    wrapper: CellRow,
  });

  testCompoundExposure(Table, ['SelectionCell', 'CellLayout', 'CellActions']);

  it('exports the new parts under flat names bound to the dotted members', () => {
    expect(TableSelectionCell).toBe(Table.SelectionCell);
    expect(TableCellLayout).toBe(Table.CellLayout);
    expect(TableCellActions).toBe(Table.CellActions);
  });

  const checkbox = (name = 'Select Alpha') => screen.getByRole('checkbox', { name });

  it('renders a cell holding a native checkbox, with its stable classes and data-type', () => {
    render(
      <CellRow>
        <Table.SelectionCell aria-label="Select Alpha" data-testid="cell" />
      </CellRow>,
    );
    const cell = screen.getByTestId('cell');
    expect(cell.localName).toBe('td');
    expect(cell).toHaveClass(tableSelectionCellClassNames.root, 'w-10', 'border-b');
    expect(cell).toHaveAttribute('data-type', 'checkbox');
    expect(checkbox().localName).toBe('input');
    expect(checkbox()).toHaveAttribute('type', 'checkbox');
    expect(checkbox()).toHaveClass(tableSelectionCellClassNames.control, 'accent-primary');
    expect(checkbox().parentElement).toBe(cell);
    expect(checkbox()).not.toBeChecked();
  });

  it('renders a native radio for type="radio"', () => {
    render(
      <CellRow>
        <Table.SelectionCell type="radio" aria-label="Pick Alpha" data-testid="cell" />
      </CellRow>,
    );
    const radio = screen.getByRole('radio', { name: 'Pick Alpha' });
    expect(radio).toHaveAttribute('type', 'radio');
    expect(radio).toHaveClass(tableSelectionCellClassNames.control);
    expect(screen.getByTestId('cell')).toHaveAttribute('data-type', 'radio');
  });

  it.each([
    ['true', true, { checked: true, indeterminate: false }],
    ['false', false, { checked: false, indeterminate: false }],
    ['mixed', 'mixed', { checked: false, indeterminate: true }],
  ] as const)('draws checked=%s', (_, checked, expected) => {
    render(
      <CellRow>
        <Table.SelectionCell checked={checked} aria-label="Select all" />
      </CellRow>,
    );
    const input = checkbox('Select all') as HTMLInputElement;
    expect(input.checked).toBe(expected.checked);
    expect(input.indeterminate).toBe(expected.indeterminate);
    if (checked === 'mixed') expect(input).toBePartiallyChecked();
  });

  describe('state', () => {
    it('toggles uncontrolled from defaultChecked and reports each change with its event', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn(
        (_checked: boolean, details?: TableSelectionCellCheckedChangeDetails) => {
          expect(details?.event).toBeInstanceOf(Event);
        },
      );
      render(
        <CellRow>
          <Table.SelectionCell aria-label="Select Alpha" onCheckedChange={onCheckedChange} />
        </CellRow>,
      );
      await user.click(checkbox());
      expect(checkbox()).toBeChecked();
      await user.click(checkbox());
      expect(checkbox()).not.toBeChecked();
      expect(onCheckedChange.mock.calls.map(([value]) => value)).toEqual([true, false]);
      expect(onCheckedChange.mock.calls[0][1]?.event.type).toBe('click');
    });

    it('starts checked or mixed from defaultChecked; a click on a mixed one checks it', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      render(
        <CellRow>
          <Table.SelectionCell defaultChecked aria-label="Select Alpha" />
          <Table.SelectionCell
            defaultChecked="mixed"
            aria-label="Select all"
            onCheckedChange={onCheckedChange}
          />
        </CellRow>,
      );
      expect(checkbox()).toBeChecked();
      expect(checkbox('Select all')).toBePartiallyChecked();
      await user.click(checkbox('Select all'));
      expect(checkbox('Select all')).toBeChecked();
      expect((checkbox('Select all') as HTMLInputElement).indeterminate).toBe(false);
      expect(onCheckedChange.mock.calls.map(([value]) => value)).toEqual([true]);
    });

    it('reports the change of a controlled cell and draws only the value it is given', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      render(
        <CellRow>
          <Table.SelectionCell
            checked={false}
            aria-label="Select Alpha"
            onCheckedChange={onCheckedChange}
          />
          <Table.SelectionCell checked="mixed" aria-label="Select all" />
        </CellRow>,
      );
      await user.click(checkbox());
      expect(onCheckedChange.mock.calls.map(([value]) => value)).toEqual([true]);
      expect(checkbox()).not.toBeChecked();
      // A parent that keeps the state mixed keeps the dash.
      await user.click(checkbox('Select all'));
      expect(checkbox('Select all')).toBePartiallyChecked();
    });

    it('follows a controlled parent that takes the change', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [checked, setChecked] = React.useState<boolean | 'mixed'>('mixed');
        return (
          <CellRow>
            <Table.SelectionCell checked={checked} onCheckedChange={setChecked} aria-label="All" />
          </CellRow>
        );
      }
      render(<Controlled />);
      expect(checkbox('All')).toBePartiallyChecked();
      await user.click(checkbox('All'));
      expect(checkbox('All')).toBeChecked();
      await user.click(checkbox('All'));
      expect(checkbox('All')).not.toBeChecked();
      expect((checkbox('All') as HTMLInputElement).indeterminate).toBe(false);
    });

    it('calls onCheckedChange once per click in StrictMode', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      render(
        <React.StrictMode>
          <CellRow>
            <Table.SelectionCell aria-label="Select Alpha" onCheckedChange={onCheckedChange} />
          </CellRow>
        </React.StrictMode>,
      );
      await user.click(checkbox());
      expect(onCheckedChange).toHaveBeenCalledTimes(1);
      expect(onCheckedChange.mock.calls[0][0]).toBe(true);
    });

    it('composes a consumer onChange first; preventDefault() keeps the state', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      const onCheckedChange = vi.fn(() => order.push('checked'));
      const { rerender } = render(
        <CellRow>
          <Table.SelectionCell
            subtle
            aria-label="Select Alpha"
            onChange={() => order.push('change')}
            onCheckedChange={onCheckedChange}
          />
        </CellRow>,
      );
      await user.click(checkbox());
      expect(order).toEqual(['change', 'checked']);
      expect(checkbox()).toBeChecked();
      rerender(
        <CellRow>
          <Table.SelectionCell
            subtle
            aria-label="Select Alpha"
            onChange={(event) => event.preventDefault()}
            onCheckedChange={onCheckedChange}
          />
        </CellRow>,
      );
      await user.click(checkbox());
      expect(onCheckedChange).toHaveBeenCalledTimes(1);
      // The state stays checked: a subtle control draws its hidden classes only while unchecked.
      // (A browser restores the old checkedness of a cancelled click; jsdom toggles it back, after
      // React restored it, so the input's own checkedness is not asserted here.)
      expect(checkbox()).not.toHaveClass('opacity-0');
    });

    it('keeps uncontrolled radios that share a name one group', async () => {
      const user = userEvent.setup();
      const onAlpha = vi.fn();
      const onBeta = vi.fn();
      render(
        <table>
          <tbody>
            <Table.Row>
              <Table.SelectionCell
                type="radio"
                name="pick"
                value="alpha"
                defaultChecked
                aria-label="Pick Alpha"
                onCheckedChange={onAlpha}
              />
            </Table.Row>
            <Table.Row>
              <Table.SelectionCell
                type="radio"
                name="pick"
                value="beta"
                subtle
                aria-label="Pick Beta"
                onCheckedChange={onBeta}
              />
            </Table.Row>
          </tbody>
        </table>,
      );
      const alpha = screen.getByRole('radio', { name: 'Pick Alpha' });
      const beta = screen.getByRole('radio', { name: 'Pick Beta' });
      expect(alpha).toBeChecked();
      expect(beta).toHaveClass('opacity-0');
      await user.click(beta);
      expect(beta).toBeChecked();
      expect(alpha).not.toBeChecked();
      expect(beta).not.toHaveClass('opacity-0');
      expect(onBeta.mock.calls.map(([value]) => value)).toEqual([true]);
      expect(onAlpha.mock.calls.map(([value]) => value)).toEqual([false]);
      await user.click(alpha);
      expect(alpha).toBeChecked();
      expect(beta).not.toBeChecked();
      expect(beta).toHaveClass('opacity-0');
      expect(onBeta.mock.calls.map(([value]) => value)).toEqual([true, false]);
      expect(onAlpha.mock.calls.map(([value]) => value)).toEqual([false, true]);
    });

    it('leaves radios without a shared name independent', async () => {
      const user = userEvent.setup();
      render(
        <CellRow>
          <Table.SelectionCell type="radio" defaultChecked aria-label="Pick Alpha" />
          <Table.SelectionCell type="radio" aria-label="Pick Beta" />
        </CellRow>,
      );
      await user.click(screen.getByRole('radio', { name: 'Pick Beta' }));
      expect(screen.getByRole('radio', { name: 'Pick Alpha' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Pick Beta' })).toBeChecked();
    });
  });

  describe('control props (C-ROUTING)', () => {
    it('sends the naming, ARIA, focus, key and input props to the input; the rest to the cell', async () => {
      const user = userEvent.setup();
      const cellRef = React.createRef<HTMLTableCellElement>();
      const controlRef = React.createRef<HTMLInputElement>();
      const handlers = {
        onFocus: vi.fn(),
        onBlur: vi.fn(),
        onKeyDown: vi.fn(),
        onKeyUp: vi.fn(),
        onClick: vi.fn(),
      };
      render(
        <>
          <span id="alpha-name">Alpha</span>
          <span id="alpha-hint">First row</span>
          <CellRow>
            <Table.SelectionCell
              ref={cellRef}
              controlRef={controlRef}
              id="alpha-select"
              aria-labelledby="alpha-name"
              aria-describedby="alpha-hint"
              aria-invalid
              aria-required
              aria-errormessage="alpha-hint"
              aria-details="alpha-hint"
              tabIndex={0}
              name="rows"
              value="alpha"
              form="orders"
              className="my-cell"
              style={{ width: 48 }}
              title="Selection"
              data-testid="cell"
              {...handlers}
            />
          </CellRow>
          <button type="button">After</button>
        </>,
      );
      const cell = screen.getByTestId('cell');
      const input = checkbox('Alpha');
      expect(cellRef.current).toBe(cell);
      expect(controlRef.current).toBe(input);
      expect(input).toHaveAttribute('id', 'alpha-select');
      expect(input).toHaveAccessibleDescription('First row');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-errormessage', 'alpha-hint');
      expect(input).toHaveAttribute('aria-details', 'alpha-hint');
      expect(input).toHaveAttribute('tabindex', '0');
      expect(input).toHaveAttribute('name', 'rows');
      expect(input).toHaveAttribute('value', 'alpha');
      expect(input).toHaveAttribute('form', 'orders');
      for (const attribute of [
        'id',
        'aria-labelledby',
        'aria-describedby',
        'aria-invalid',
        'aria-required',
        'aria-errormessage',
        'aria-details',
        'tabindex',
        'name',
        'value',
        'form',
      ]) {
        expect(cell, attribute).not.toHaveAttribute(attribute);
      }
      expect(cell).toHaveClass('my-cell', tableSelectionCellClassNames.root);
      expect(cell).toHaveStyle({ width: '48px' });
      expect(cell).toHaveAttribute('title', 'Selection');

      await user.click(input);
      expect(handlers.onFocus).toHaveBeenCalledTimes(1);
      expect(handlers.onFocus.mock.calls[0][0].target).toBe(input);
      expect(handlers.onClick).toHaveBeenCalledTimes(1);
      await user.keyboard('a');
      expect(handlers.onKeyDown).toHaveBeenCalledTimes(1);
      expect(handlers.onKeyUp).toHaveBeenCalledTimes(1);
      await user.tab();
      expect(handlers.onBlur).toHaveBeenCalledTimes(1);
    });

    it('focuses the input with autoFocus', () => {
      render(
        <CellRow>
          <Table.SelectionCell autoFocus aria-label="Select Alpha" />
        </CellRow>,
      );
      expect(checkbox()).toHaveFocus();
    });

    it('disables and requires the native input', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      render(
        <CellRow>
          <Table.SelectionCell
            disabled
            required
            aria-label="Select Alpha"
            onCheckedChange={onCheckedChange}
          />
        </CellRow>,
      );
      expect(checkbox()).toBeDisabled();
      expect(checkbox()).toBeRequired();
      expect(checkbox()).toHaveClass('disabled:cursor-not-allowed');
      await user.click(checkbox());
      expect(checkbox()).not.toBeChecked();
      expect(onCheckedChange).not.toHaveBeenCalled();
    });

    it('submits name=value while checked, and nothing without a name', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Orders">
          <CellRow>
            <Table.SelectionCell name="rows" value="alpha" aria-label="Select Alpha" />
            <Table.SelectionCell defaultChecked aria-label="Select Beta" />
          </CellRow>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Orders' }) as HTMLFormElement;
      expect([...new FormData(form).entries()]).toEqual([]);
      await user.click(checkbox());
      expect([...new FormData(form).entries()]).toEqual([['rows', 'alpha']]);
    });

    it('restores defaultChecked when its form resets', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      render(
        <form aria-label="Orders">
          <CellRow>
            <Table.SelectionCell aria-label="Select Alpha" onCheckedChange={onCheckedChange} />
          </CellRow>
        </form>,
      );
      await user.click(checkbox());
      expect(checkbox()).toBeChecked();
      act(() => (screen.getByRole('form', { name: 'Orders' }) as HTMLFormElement).reset());
      expect(checkbox()).not.toBeChecked();
      expect(onCheckedChange.mock.calls.map(([value]) => value)).toEqual([true, false]);
    });
  });

  describe('subtle and invisible', () => {
    it('keeps an unchecked subtle control transparent until its row is hovered or focused', () => {
      render(
        <CellRow>
          <Table.SelectionCell subtle aria-label="Select Alpha" />
          <Table.SelectionCell subtle defaultChecked aria-label="Select Beta" />
        </CellRow>,
      );
      expect(screen.getByTestId('row')).toHaveClass('group/table-row');
      expect(checkbox()).toHaveClass(...ROW_REVEAL, 'motion-reduce:transition-none');
      expect(checkbox('Select Beta')).not.toHaveClass('opacity-0');
      expect(checkbox()).not.toHaveAttribute('tabindex', '-1');
    });

    it('draws no subtle classes by default', () => {
      render(
        <CellRow>
          <Table.SelectionCell aria-label="Select Alpha" />
        </CellRow>,
      );
      expect(checkbox()).not.toHaveClass('opacity-0');
    });

    it('hides an invisible control while its cell keeps its box', () => {
      render(
        <CellRow>
          <Table.SelectionCell invisible aria-label="Select Alpha" data-testid="cell" />
        </CellRow>,
      );
      expect(screen.getByTestId('cell')).toHaveClass('w-10');
      expect(screen.getByRole('checkbox', { hidden: true })).toHaveClass('invisible');
    });
  });

  describe('name warning', () => {
    it('warns once when the control has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <CellRow>
          <Table.SelectionCell />
          <Table.SelectionCell />
        </CellRow>,
      );
      expect(warn.mock.calls).toEqual([[NAME_WARNING]]);
    });

    it('does not warn for aria-label, aria-labelledby or a label element', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <>
          <label htmlFor="gamma-select">Gamma</label>
          <span id="beta-name">Beta</span>
          <CellRow>
            <Table.SelectionCell aria-label="Select Alpha" />
            <Table.SelectionCell aria-labelledby="beta-name" />
            <Table.SelectionCell id="gamma-select" />
          </CellRow>
        </>,
      );
      expect(checkbox('Gamma')).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('types its props', () => {
    expectTypeOf<TableSelectionCellProps['type']>().toEqualTypeOf<
      'checkbox' | 'radio' | undefined
    >();
    expectTypeOf<TableSelectionCellProps['checked']>().toEqualTypeOf<
      boolean | 'mixed' | undefined
    >();
    expectTypeOf<TableSelectionCellProps['defaultChecked']>().toEqualTypeOf<
      boolean | 'mixed' | undefined
    >();
    expectTypeOf<NonNullable<TableSelectionCellProps['onCheckedChange']>>().toEqualTypeOf<
      (checked: boolean, details?: TableSelectionCellCheckedChangeDetails) => void
    >();
    expectTypeOf<TableSelectionCellCheckedChangeDetails['event']>().toEqualTypeOf<Event>();
    expectTypeOf<TableSelectionCellProps['controlRef']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<TableCellLayoutProps['appearance']>().toEqualTypeOf<'primary' | undefined>();
    expectTypeOf<TableCellActionsProps['visible']>().toEqualTypeOf<boolean | undefined>();
    const typeOnly = () => (
      <>
        {/* @ts-expect-error -- the cell renders its own control, no children */}
        <Table.SelectionCell aria-label="Select">x</Table.SelectionCell>
        {/* @ts-expect-error -- `primary` is the only appearance */}
        <Table.CellLayout appearance="secondary">Alpha</Table.CellLayout>
      </>
    );
    expect(typeOnly).toBeTypeOf('function');
  });
});

describe('Table.CellLayout', () => {
  testSystemProps(TableCellLayout, {
    expectedTag: 'div',
    displayName: 'TableCellLayout',
    defaultProps: { children: 'Alpha' },
    conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
    a11yVariants: [
      {
        name: 'media and description',
        props: {
          media: <Avatar name="Ann Lee" />,
          description: 'Designer',
          appearance: 'primary',
          truncate: true,
        },
      },
    ],
    wrapper: InCell,
  });

  const layout = () => screen.getByTestId('layout');
  const part = (key: keyof typeof tableCellLayoutClassNames) =>
    layout().querySelector<HTMLElement>(`.${tableCellLayoutClassNames[key]}`);

  it('renders the main text in a column beside the media, with a part class each', () => {
    render(
      <InCell>
        <Table.CellLayout
          data-testid="layout"
          media={<svg data-testid="icon" />}
          description="Designer"
        >
          Ann Lee
        </Table.CellLayout>
      </InCell>,
    );
    expect(layout().localName).toBe('div');
    expect(layout()).toHaveClass(tableCellLayoutClassNames.root, 'flex', 'items-center', 'gap-2');
    expect(part('media')).toContainElement(screen.getByTestId('icon'));
    expect(part('media')!.localName).toBe('span');
    expect(part('media')).not.toHaveAttribute('aria-hidden');
    expect(part('content')).toHaveClass('flex', 'flex-col');
    expect(part('main')).toHaveTextContent('Ann Lee');
    expect(part('main')!.parentElement).toBe(part('content'));
    expect(part('description')).toHaveTextContent('Designer');
    expect(part('description')).toHaveClass('text-caption-1', 'text-muted-foreground');
    expect(part('description')!.parentElement).toBe(part('content'));
    expect(part('media')!.nextElementSibling).toBe(part('content'));
    expect(layout()).not.toHaveAttribute('data-appearance');
    expect(layout()).not.toHaveAttribute('data-truncate');
  });

  it('renders only the main text without media or description', () => {
    render(
      <InCell>
        <Table.CellLayout data-testid="layout">Alpha</Table.CellLayout>
      </InCell>,
    );
    expect(part('media')).toBeNull();
    expect(part('description')).toBeNull();
    expect(part('main')).toHaveTextContent('Alpha');
  });

  it.each([
    ['null', null],
    ['false', false],
    ['an empty string', ''],
    ['an empty Fragment', <></>],
  ])('renders no media or description for %s', (_, empty) => {
    render(
      <InCell>
        <Table.CellLayout data-testid="layout" media={empty} description={empty}>
          Alpha
        </Table.CellLayout>
      </InCell>,
    );
    expect(part('media')).toBeNull();
    expect(part('description')).toBeNull();
  });

  it('takes slot objects for media and description, their classes after the part classes', () => {
    render(
      <InCell>
        <Table.CellLayout
          data-testid="layout"
          media={{ className: 'my-media', children: 'M' }}
          description={{ className: 'my-description', children: 'Designer' }}
        >
          Alpha
        </Table.CellLayout>
      </InCell>,
    );
    expect(part('media')).toHaveClass('my-media');
    expect(part('media')).toHaveTextContent('M');
    expect(part('description')).toHaveClass('my-description');
  });

  it('gives an Avatar in media the fixed 32px box; an Avatar of its own size keeps it', () => {
    render(
      <InCell>
        <Table.CellLayout media={<Avatar name="Ann Lee" />}>Ann</Table.CellLayout>
        <Table.CellLayout media={<Avatar name="Bo Ek" size={48} />}>Bo</Table.CellLayout>
        <Avatar name="Cy Ng" />
      </InCell>,
    );
    const avatarRoot = (name: string) =>
      screen.getByRole('img', { name }).closest(`.${avatarClassNames.root}`);
    expect(avatarRoot('Ann Lee')).toHaveAttribute('data-size', '32');
    expect(avatarRoot('Bo Ek')).toHaveAttribute('data-size', '48');
    expect(avatarRoot('Cy Ng')).toHaveAttribute('data-size', 'medium');
  });

  it('truncates the main text and the description with truncate', () => {
    render(
      <InCell>
        <Table.CellLayout data-testid="layout" truncate description="Designer">
          A long name
        </Table.CellLayout>
      </InCell>,
    );
    expect(layout()).toHaveAttribute('data-truncate', '');
    expect(layout()).toHaveClass('overflow-x-hidden');
    expect(part('content')).toHaveClass('min-w-0', 'overflow-x-hidden');
    expect(part('main')).toHaveClass('truncate');
    expect(part('description')).toHaveClass('truncate');
  });

  it('wraps text by default', () => {
    render(
      <InCell>
        <Table.CellLayout data-testid="layout" description="Designer">
          A long name
        </Table.CellLayout>
      </InCell>,
    );
    expect(layout()).not.toHaveClass('overflow-x-hidden');
    expect(part('main')).not.toHaveClass('truncate');
    expect(part('description')).not.toHaveClass('truncate');
  });

  it('draws the primary appearance: a semibold main text and a larger media icon', () => {
    render(
      <InCell>
        <Table.CellLayout data-testid="layout" appearance="primary" media={<svg />}>
          Alpha
        </Table.CellLayout>
      </InCell>,
    );
    expect(layout()).toHaveAttribute('data-appearance', 'primary');
    expect(part('main')).toHaveClass('font-semibold');
    expect(part('media')).toHaveClass('[&>svg]:size-6');
    expect(part('media')).not.toHaveClass('[&>svg]:size-5');
  });

  it('sizes a media icon at 20px by default', () => {
    render(
      <InCell>
        <Table.CellLayout data-testid="layout" media={<svg />}>
          Alpha
        </Table.CellLayout>
      </InCell>,
    );
    expect(part('media')).toHaveClass('flex', 'shrink-0', 'items-center', '[&>svg]:size-5');
    expect(part('main')).not.toHaveClass('font-semibold');
  });
});

describe('Table.CellActions', () => {
  testSystemProps(TableCellActions, {
    expectedTag: 'div',
    displayName: 'TableCellActions',
    defaultProps: { children: <button type="button">Edit</button> },
    conflictingClass: { className: 'bg-card', overrides: 'bg-background' },
    a11yVariants: [{ name: 'visible', props: { visible: true } }],
    wrapper: InCell,
  });

  const renderActions = (
    props: Partial<TableCellActionsProps> = {},
    options?: Parameters<typeof renderWithProviders>[1],
  ) =>
    renderWithProviders(
      <Table data-testid="table" striped>
        <Table.Body>
          <Table.Row data-testid="row">
            <Table.Cell data-testid="cell">
              Alpha
              <Table.CellActions data-testid="actions" {...props}>
                <button type="button">Edit</button>
              </Table.CellActions>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
      options,
    );
  const actions = () => screen.getByTestId('actions');

  it('sits over the logical end of its cell, its buttons centred; the cell is its positioning box', () => {
    renderActions();
    expect(actions()).toHaveClass(
      tableCellActionsClassNames.root,
      'absolute',
      'end-0',
      'inset-y-0',
      'flex',
      'items-center',
    );
    expect(screen.getByTestId('cell')).toHaveClass('relative');
    expect(screen.getByTestId('row')).toHaveClass('group/table-row');
    expect(screen.getByTestId('row')).not.toHaveClass('group/row');
  });

  it('covers the full height of its cell, not a centred band, so taller content never shows', () => {
    renderActions();
    const classes = actions().className.split(/\s+/);
    // Both vertical insets: the opaque background spans the cell from its top edge to its bottom
    // edge, also over wrapped text or a layout with a description.
    expect(classes).toContain('inset-y-0');
    expect(classes.filter((cls) => /^-?(top|bottom)-/.test(cls))).toEqual([]);
    // No centring by translation: the flex column centres the buttons instead.
    expect(classes.filter((cls) => /translate-y/.test(cls))).toEqual([]);
    expect(actions()).toHaveClass('items-center');
  });

  it('places itself at the inline end in RTL with logical classes only', () => {
    renderActions({}, { dir: 'rtl' });
    expect(actions().closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(actions()).toHaveClass('end-0');
    const physical = actions()
      .className.split(/\s+/)
      .filter((cls) => /(^|:)-?(left|right|ml|mr|pl|pr)-/.test(cls));
    expect(physical).toEqual([]);
  });

  it('stays transparent until its row is hovered, holds focus, or forced colors or touch draw it', () => {
    renderActions();
    expect(actions()).toHaveClass(
      ...ROW_REVEAL,
      'focus-within:opacity-100',
      'motion-reduce:transition-none',
    );
    expect(actions()).not.toHaveAttribute('data-visible');
    // Still reachable: Tab reaches its buttons, which reveals them.
    expect(screen.getByRole('button', { name: 'Edit' })).not.toHaveAttribute('tabindex');
  });

  it('stays shown with visible', () => {
    renderActions({ visible: true });
    expect(actions()).toHaveAttribute('data-visible', '');
    expect(actions()).not.toHaveClass('opacity-0');
    expect(actions()).not.toHaveClass('group-hover/table-row:opacity-100');
  });

  it('draws an opaque background that follows the row: hover, the stripe and grid selection', () => {
    renderActions();
    expect(actions()).toHaveClass(
      'bg-background',
      'group-hover/table-row:bg-subtle-hover',
      '[:where([data-striped]>tbody>tr:nth-child(odd)>*)>&]:bg-card',
      '[[data-selection-appearance=brand]>tbody>[data-selected]>*>&]:bg-selected',
      '[[data-selection-appearance=neutral]>tbody>[data-selected]>*>&]:bg-subtle-selected',
    );
  });

  it('keeps the striped table rule: one zero-specificity stripe on the table, no row class', () => {
    renderActions();
    const stripe = screen
      .getByTestId('table')
      .className.split(/\s+/)
      .filter((cls) => cls.includes('nth-child'));
    expect(stripe).toEqual(['[:where(&>tbody>tr:nth-child(odd))]:bg-card']);
    expect(screen.getByTestId('row').className).not.toMatch(/odd:|bg-card/);
  });

  it('works in a DataGrid cell: the row is the table row group and the cell its box', () => {
    render(
      <DataGrid aria-label="People">
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="1" data-testid="row">
            <DataGrid.Cell data-testid="cell">
              Alice
              <Table.CellActions data-testid="actions">
                <button type="button">Edit</button>
              </Table.CellActions>
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(screen.getByTestId('row')).toHaveClass('group/table-row');
    expect(screen.getByTestId('cell')).toHaveClass('relative');
    expect(actions()).toHaveClass(...ROW_REVEAL);
  });

  it('passes axe with hidden actions in a striped table', async () => {
    renderActions();
    await expectNoA11yViolations();
  });
});

describe('Table cells (P9-05)', () => {
  it('positions every data cell, so actions can sit in it', () => {
    renderFullTable();
    for (const cell of screen.getAllByRole('cell')) expect(cell).toHaveClass('relative');
  });

  it('makes every Table.Row the table row group, never Tree’s row group', () => {
    renderFullTable();
    for (const row of bodyRows()) {
      expect(row).toHaveClass('group/table-row');
      expect(row).not.toHaveClass('group/row');
    }
  });

  it('renders the same server HTML with client references of the new parts', () => {
    type Parts = Pick<typeof Table, 'SelectionCell' | 'CellLayout' | 'CellActions'>;
    const tree = (parts: Parts) => (
      <Table>
        <Table.Body>
          <Table.Row>
            <parts.SelectionCell aria-label="Select Alpha" defaultChecked subtle />
            <Table.Cell>
              <parts.CellLayout media={<Avatar name="Ann Lee" />} description="Designer" truncate>
                Ann Lee
              </parts.CellLayout>
              <parts.CellActions>
                <button type="button">Edit</button>
              </parts.CellActions>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
    const plain = renderToString(tree(Table));
    const lazy = renderToString(
      tree({
        SelectionCell: asClientReference(Table.SelectionCell),
        CellLayout: asClientReference(Table.CellLayout),
        CellActions: asClientReference(Table.CellActions),
      }),
    );
    expect(lazy).toBe(plain);
    expect(plain).toContain(tableSelectionCellClassNames.control);
    expect(plain).toContain(tableCellLayoutClassNames.description);
    expect(plain).toContain(tableCellActionsClassNames.root);
  });

  it('passes axe with every new part in one table', async () => {
    render(
      <Table>
        <caption>People</caption>
        <Table.Header>
          <tr>
            <Table.SelectionCell checked="mixed" aria-label="Select all rows" />
            <Table.HeaderCell>Name</Table.HeaderCell>
          </tr>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.SelectionCell subtle aria-labelledby="ann-name" />
            <Table.Cell>
              <Table.CellLayout media={<Avatar name="Ann Lee" />} description="Designer">
                <span id="ann-name">Ann Lee</span>
              </Table.CellLayout>
              <Table.CellActions>
                <button type="button">Edit</button>
              </Table.CellActions>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    await expectNoA11yViolations();
  });
});
