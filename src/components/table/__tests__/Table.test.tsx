import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '../Table';
import type { TableProps } from '../Table';
import {
  expectNoA11yViolations,
  installResizeObserverMock,
  renderWithProviders,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
import { tableHeaderCellClassNames } from '../../../lib/classNames';

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
