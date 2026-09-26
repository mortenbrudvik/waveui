import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { List, ListItem } from '../List';
import type { ListProps, ListSelectionMode } from '../List';
import { ListRegistrySnapshot } from '../List.registry';
import { Button } from '../../button/Button';
import { Toolbar } from '../../button/Toolbar';
import { Menu } from '../../navigation/Menu';
import { Popover } from '../../overlays/Popover';
import {
  asClientReference,
  renderWithProviders,
  testComposedHandler,
  testCompoundExposure,
  testSystemProps,
  expectThrows,
} from '../../../test-utils';

const fruits = [
  <List.Item key="apple" value="apple">
    Apple
  </List.Item>,
  <List.Item key="banana" value="banana">
    Banana
  </List.Item>,
  <List.Item key="cherry" value="cherry">
    Cherry
  </List.Item>,
];

function option(name: string): HTMLElement {
  return screen.getByRole('option', { name });
}

function row(name: RegExp | string): HTMLElement {
  return screen.getByRole('row', { name });
}

/**
 * The roving tab index hook re-reads the items from a MutationObserver (a microtask) after items
 * were added, removed or moved; flush it inside act() so its update is not reported as unwrapped.
 */
async function flushItemObserver(): Promise<void> {
  await act(async () => {});
}

/** A selectable document list whose rows carry a Delete action (grid mode). */
function DocumentList(
  props: {
    onDelete?: (name: string) => void;
    onSelectionChange?: (selected: string[]) => void;
  } & Partial<ListProps>,
) {
  const { onDelete, onSelectionChange, ...rest } = props;
  return (
    <List
      selectable
      selectionMode="multiple"
      aria-label="Documents"
      onSelectionChange={onSelectionChange}
      {...rest}
    >
      {['Alpha', 'Beta', 'Gamma'].map((name) => (
        <List.Item
          key={name}
          value={name.toLowerCase()}
          action={
            <button type="button" onClick={() => onDelete?.(name)}>
              Delete {name}
            </button>
          }
        >
          {name}
        </List.Item>
      ))}
    </List>
  );
}

describe('List', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  testSystemProps(List, {
    expectedTag: 'ul',
    displayName: 'List',
    defaultProps: { children: fruits },
    a11yVariants: [
      {
        name: 'selectable single',
        props: { selectable: true, 'aria-label': 'Fruits', defaultSelectedItems: ['banana'] },
      },
      {
        name: 'selectable multiple',
        props: {
          selectable: true,
          selectionMode: 'multiple',
          'aria-label': 'Fruits',
          defaultSelectedItems: ['apple', 'cherry'],
        },
      },
      {
        name: 'with actions',
        props: {
          children: <List.Item action={<button type="button">Delete</button>}>Document</List.Item>,
        },
      },
      {
        name: 'selectable with actions (grid)',
        props: {
          selectable: true,
          'aria-label': 'Documents',
          children: [
            <List.Item key="a" value="a" action={<button type="button">Delete A</button>}>
              Document A
            </List.Item>,
            <List.Item
              key="b"
              value="b"
              action={<input aria-label="Rename B" defaultValue="Document B" />}
            >
              Document B
            </List.Item>,
          ],
        },
      },
    ],
  });

  testCompoundExposure(List, ['Item']);

  describe('ListItem', () => {
    testSystemProps(ListItem, {
      expectedTag: 'li',
      displayName: 'ListItem',
      defaultProps: { children: 'Apple' },
      wrapper: ({ children }) => <List>{children}</List>,
    });

    it('is exported under the flat name ListItem (repo-level#2)', () => {
      expect(ListItem).toBe(List.Item);
    });

    it('throws outside a List in development (C-CONTEXT)', () => {
      expectThrows(<ListItem>Orphan</ListItem>, '[WaveUI] ListItem must be used within a List');
    });

    it('in production, an item outside a List logs once and renders a plain list item (C-CONTEXT)', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { rerender } = render(<ListItem value="a">Orphan</ListItem>);
      rerender(<ListItem value="a">Orphan</ListItem>);
      const item = screen.getByRole('listitem');
      expect(item).toHaveTextContent('Orphan');
      expect(item).not.toHaveAttribute('aria-selected');
      expect(error.mock.calls).toEqual([['[WaveUI] ListItem must be used within a List']]);
    });

    it('items written in a Server Component (lazy types) render the same server HTML and behave the same (C-COMPOUND)', async () => {
      const user = userEvent.setup();
      const LazyItem = asClientReference(ListItem);
      const docs = (Item: typeof ListItem) => (
        <List selectable aria-label="Documents">
          <Item value="a">Document A</Item>
          <>
            <Item value="b" action={<button type="button">Delete B</button>}>
              Document B
            </Item>
          </>
        </List>
      );
      const plain = renderToString(docs(ListItem));
      expect(plain).toContain('role="grid"');
      expect(renderToString(docs(LazyItem))).toBe(plain);

      render(docs(LazyItem));
      expect(screen.getByRole('grid', { name: 'Documents' })).toBeInTheDocument();
      act(() => row(/Document B/).focus());
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: 'Delete B' })).toHaveFocus();
      await user.keyboard('{ArrowLeft} ');
      expect(row(/Document B/)).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('renders list items', () => {
    render(<List>{fruits}</List>);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Apple',
      'Banana',
      'Cherry',
    ]);
  });

  it('has list role by default', () => {
    render(<List data-testid="list" />);
    expect(screen.getByTestId('list')).toHaveAttribute('role', 'list');
  });

  it('has listbox role when selectable', () => {
    render(<List selectable data-testid="list" />);
    expect(screen.getByTestId('list')).toHaveAttribute('role', 'listbox');
  });

  it('renders the action of a non-selectable item in the normal tab order', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <List>
        <List.Item
          action={
            <button type="button" onClick={onDelete}>
              Delete
            </button>
          }
        >
          Item
        </List.Item>
      </List>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  describe('selection', () => {
    it('selects item on click (single select)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable onSelectionChange={onChange}>
          <List.Item value="a">Item A</List.Item>
          <List.Item value="b">Item B</List.Item>
        </List>,
      );
      await user.click(screen.getByText('Item A'));
      expect(onChange).toHaveBeenCalledWith(['a']);
    });

    it('deselects on second click (single select)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable onSelectionChange={onChange}>
          <List.Item value="a">Item A</List.Item>
        </List>,
      );
      await user.click(screen.getByText('Item A'));
      await user.click(screen.getByText('Item A'));
      expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('replaces the selected item in single mode', async () => {
      const user = userEvent.setup();
      render(
        <List selectable aria-label="Fruits">
          {fruits}
        </List>,
      );
      await user.click(option('Apple'));
      await user.click(option('Banana'));
      expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
      expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
    });

    it('multi-select: allows multiple selected items', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable selectionMode="multiple" onSelectionChange={onChange}>
          <List.Item value="a">Item A</List.Item>
          <List.Item value="b">Item B</List.Item>
        </List>,
      );
      await user.click(screen.getByText('Item A'));
      await user.click(screen.getByText('Item B'));
      expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    });

    it('multi-select: a click on a selected item deselects only that item (data-display#24)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List
          selectable
          selectionMode="multiple"
          defaultSelectedItems={['apple', 'banana']}
          onSelectionChange={onChange}
          aria-label="Fruits"
        >
          {fruits}
        </List>,
      );
      await user.click(option('Apple'));
      expect(onChange).toHaveBeenCalledWith(['banana']);
      expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
      expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
    });

    it('sets aria-selected on selected items and marks them with data-selected', async () => {
      const user = userEvent.setup();
      render(
        <List selectable>
          <List.Item value="a">Item A</List.Item>
        </List>,
      );
      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('aria-selected', 'false');
      await user.click(item);
      expect(item).toHaveAttribute('aria-selected', 'true');
      expect(item).toHaveAttribute('data-selected');
      expect(item).toHaveClass('bg-subtle-selected');
    });

    it('sets aria-multiselectable for multi-select mode', () => {
      render(
        <List selectable selectionMode="multiple" data-testid="list">
          <List.Item value="a">A</List.Item>
        </List>,
      );
      expect(screen.getByTestId('list')).toHaveAttribute('aria-multiselectable', 'true');
    });

    it('pre-selects defaultSelectedItems (data-display#24)', () => {
      render(
        <List selectable defaultSelectedItems={['banana']} aria-label="Fruits">
          {fruits}
        </List>,
      );
      expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
      expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
    });

    it('controlled: respects selectedItems prop', () => {
      render(
        <List selectable selectedItems={['b']}>
          <List.Item value="a">Item A</List.Item>
          <List.Item value="b">Item B</List.Item>
        </List>,
      );
      const items = screen.getAllByRole('option');
      expect(items[0]).toHaveAttribute('aria-selected', 'false');
      expect(items[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('controlled: a click waits for the parent and reports the next selection (data-display#24)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(
        <List selectable selectedItems={[]} onSelectionChange={onChange} aria-label="Fruits">
          {fruits}
        </List>,
      );
      await user.click(option('Apple'));
      expect(onChange).toHaveBeenCalledWith(['apple']);
      expect(option('Apple')).toHaveAttribute('aria-selected', 'false');
      rerender(
        <List selectable selectedItems={['apple']} onSelectionChange={onChange} aria-label="Fruits">
          {fruits}
        </List>,
      );
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
    });

    it('a value-less item is not selectable, but its onClick still runs (data-display#24)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onClick = vi.fn();
      render(
        <List selectable onSelectionChange={onChange} aria-label="Items">
          <List.Item onClick={onClick}>No value</List.Item>
          <List.Item value="a">With value</List.Item>
        </List>,
      );
      await user.click(option('No value'));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
      expect(option('No value')).toHaveAttribute('aria-selected', 'false');
    });

    it('chains two toggles in one batch (data-display#23)', () => {
      const onChange = vi.fn();
      render(
        <List selectable selectionMode="multiple" onSelectionChange={onChange} aria-label="Fruits">
          {fruits}
        </List>,
      );
      act(() => {
        option('Apple').click();
        option('Banana').click();
      });
      expect(onChange).toHaveBeenLastCalledWith(['apple', 'banana']);
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onSelectionChange exactly once per click in StrictMode (table-core#3)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <React.StrictMode>
          <List
            selectable
            selectionMode="multiple"
            onSelectionChange={onChange}
            aria-label="Fruits"
          >
            {fruits}
          </List>
        </React.StrictMode>,
      );
      await user.click(option('Apple'));
      expect(onChange).toHaveBeenCalledTimes(1);
      await user.click(option('Cherry'));
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(['apple', 'cherry']);
    });

    it('clears when a controlled value becomes undefined and adopts a late value (table-core#4)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(
        <List selectable selectedItems={['banana']} aria-label="Fruits">
          {fruits}
        </List>,
      );
      expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
      rerender(
        <List selectable selectedItems={undefined} aria-label="Fruits">
          {fruits}
        </List>,
      );
      for (const item of screen.getAllByRole('option')) {
        expect(item).toHaveAttribute('aria-selected', 'false');
      }

      const late = render(
        <List selectable selectedItems={undefined} aria-label="Late">
          {fruits}
        </List>,
      );
      late.rerender(
        <List selectable selectedItems={['cherry']} aria-label="Late">
          {fruits}
        </List>,
      );
      const lateList = screen.getByRole('listbox', { name: 'Late' });
      const cherry = Array.from(lateList.querySelectorAll('[role="option"]')).find(
        (el) => el.textContent === 'Cherry',
      );
      expect(cherry).toHaveAttribute('aria-selected', 'true');
      // useControllable reports each mode switch once.
      expect(warn.mock.calls).toEqual([
        [
          expect.stringContaining(
            '[WaveUI] A component is changing from controlled to uncontrolled.',
          ),
        ],
        [
          expect.stringContaining(
            '[WaveUI] A component is changing from uncontrolled to controlled.',
          ),
        ],
      ]);
    });
  });

  it('renders the selection and grid semantics on the server', () => {
    const html = renderToString(
      <List selectable defaultSelectedItems={['banana']} aria-label="Fruits">
        {fruits}
      </List>,
    );
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    expect(parsed.querySelector('[role="listbox"]')).not.toBeNull();
    const selected = Array.from(parsed.querySelectorAll('[role="option"][aria-selected="true"]'));
    expect(selected.map((el) => el.textContent)).toEqual(['Banana']);

    const gridHtml = renderToString(
      <List selectable aria-label="Documents">
        <List.Item value="a" action={<button type="button">Delete</button>}>
          Document A
        </List.Item>
      </List>,
    );
    expect(gridHtml).toContain('role="grid"');
    expect(gridHtml).toContain('role="row"');
  });

  describe('effective selection (table-core#22)', () => {
    it('drops a removed item from the next selection change', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const items = (names: string[]) =>
        names.map((name) => (
          <List.Item key={name} value={name}>
            {name}
          </List.Item>
        ));
      const { rerender } = render(
        <List selectable selectionMode="multiple" onSelectionChange={onChange} aria-label="Rows">
          {items(['a', 'b', 'c'])}
        </List>,
      );
      await user.click(option('a'));
      await user.click(option('b'));
      expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);

      rerender(
        <List selectable selectionMode="multiple" onSelectionChange={onChange} aria-label="Rows">
          {items(['a', 'c'])}
        </List>,
      );
      await flushItemObserver();
      await user.click(option('c'));
      expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);

      rerender(
        <List selectable selectionMode="multiple" onSelectionChange={onChange} aria-label="Rows">
          {items(['a', 'b', 'c'])}
        </List>,
      );
      await flushItemObserver();
      expect(option('b')).toHaveAttribute('aria-selected', 'false');
    });

    describe('the Tab stop is the first selected item in DOM order', () => {
      const plain = (names: string[]) =>
        names.map((name) => (
          <List.Item key={name} value={name}>
            {name}
          </List.Item>
        ));

      it('when actions appear and disappear on selected rows', async () => {
        const user = userEvent.setup();
        function Rows() {
          const [selected, setSelected] = React.useState<string[]>([]);
          return (
            <List
              selectable
              selectionMode="multiple"
              aria-label="Rows"
              selectedItems={selected}
              onSelectionChange={setSelected}
            >
              {['a', 'b', 'c'].map((value) => (
                <List.Item
                  key={value}
                  value={value}
                  action={
                    value === 'b' || selected.includes(value) ? (
                      <button type="button">Edit {value}</button>
                    ) : undefined
                  }
                >
                  Row {value}
                </List.Item>
              ))}
            </List>
          );
        }
        render(<Rows />);
        await user.click(screen.getByText('Row c'));
        await user.click(screen.getByText('Row a'));
        expect(row(/Row a/)).toHaveAttribute('tabindex', '0');
        expect(row(/Row b/)).toHaveAttribute('tabindex', '-1');
        expect(row(/Row c/)).toHaveAttribute('tabindex', '-1');
      });

      it('when an item is inserted before the selected ones', async () => {
        const user = userEvent.setup();
        const list = (names: string[]) => (
          <List selectable selectionMode="multiple" aria-label="Rows">
            {plain(names)}
          </List>
        );
        const { rerender } = render(list(['b', 'c']));
        await user.click(option('c'));
        rerender(list(['a', 'b', 'c']));
        await flushItemObserver();
        await user.click(option('a'));
        expect(option('a')).toHaveAttribute('tabindex', '0');
        expect(option('c')).toHaveAttribute('tabindex', '-1');
      });

      it('when keyed items are reordered', async () => {
        const list = (names: string[]) => (
          <List
            selectable
            selectionMode="multiple"
            defaultSelectedItems={['a', 'c']}
            aria-label="Rows"
          >
            {plain(names)}
          </List>
        );
        const { rerender } = render(list(['a', 'b', 'c']));
        expect(option('a')).toHaveAttribute('tabindex', '0');
        rerender(list(['c', 'b', 'a']));
        await flushItemObserver();
        expect(option('c')).toHaveAttribute('tabindex', '0');
        expect(option('a')).toHaveAttribute('tabindex', '-1');
      });
    });

    it('ignores controlled values that match no item', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List
          selectable
          selectionMode="multiple"
          selectedItems={['ghost']}
          onSelectionChange={onChange}
          aria-label="Fruits"
        >
          {fruits}
        </List>,
      );
      await user.click(option('Apple'));
      expect(onChange).toHaveBeenCalledWith(['apple']);
    });
  });

  describe('single-selection props (layout#19)', () => {
    it('supports a controlled selectedItem with onSelectedItemChange', async () => {
      const user = userEvent.setup();
      const onSelectedItemChange = vi.fn();
      const onSelectionChange = vi.fn();
      render(
        <List
          selectable
          selectedItem="apple"
          onSelectedItemChange={onSelectedItemChange}
          onSelectionChange={onSelectionChange}
          aria-label="Fruits"
        >
          {fruits}
        </List>,
      );
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      await user.click(option('Banana'));
      expect(onSelectedItemChange).toHaveBeenCalledWith('banana');
      expect(onSelectionChange).toHaveBeenCalledWith(['banana']);
      expect(option('Apple')).toHaveAttribute('aria-selected', 'true');
      await user.click(option('Apple'));
      expect(onSelectedItemChange).toHaveBeenLastCalledWith(null);
    });

    it('supports defaultSelectedItem and selectedItem={null}', () => {
      // The rerender turns the uncontrolled list into a controlled one on purpose.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(
        <List selectable defaultSelectedItem="cherry" aria-label="Fruits">
          {fruits}
        </List>,
      );
      expect(option('Cherry')).toHaveAttribute('aria-selected', 'true');
      rerender(
        <List selectable selectedItem={null} aria-label="Nothing">
          {fruits}
        </List>,
      );
      expect(
        screen.getAllByRole('option').filter((el) => el.getAttribute('aria-selected') === 'true'),
      ).toHaveLength(0);
      expect(warn.mock.calls).toEqual([
        [
          expect.stringContaining(
            '[WaveUI] A component is changing from uncontrolled to controlled.',
          ),
        ],
      ]);
    });

    it('warns when a single-selection list receives several selected items', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <List selectable selectedItems={['apple', 'banana']} aria-label="Fruits">
          {fruits}
        </List>,
      );
      expect(warn.mock.calls).toEqual([
        [
          expect.stringContaining(
            '[WaveUI] List: a single-selection list (selectionMode "single") received 2 selected items.',
          ),
        ],
      ]);
    });

    it('type-checks the single-only props against selectionMode', () => {
      const elements = [
        <List key="1" selectable selectedItem="a" onSelectedItemChange={(item) => item} />,
        <List key="2" selectable selectionMode="single" selectedItems={['a']} />,
        <List key="3" selectable selectionMode="multiple" selectedItems={['a', 'b']} />,
        // @ts-expect-error selectedItem is a single-selection prop
        <List key="4" selectable selectionMode="multiple" selectedItem="a" />,
        // @ts-expect-error onSelectedItemChange is a single-selection prop
        <List key="5" selectable selectionMode="multiple" onSelectedItemChange={() => {}} />,
      ];
      expect(elements).toHaveLength(5);
      expectTypeOf<ListSelectionMode>().toEqualTypeOf<'single' | 'multiple' | 'multi'>();
      interface DocumentListProps extends ListProps {
        documents: string[];
      }
      expectTypeOf<DocumentListProps>().toHaveProperty('selectedItems');
      expectTypeOf<NonNullable<ListProps['onSelectedItemChange']>>().toEqualTypeOf<
        (item: string | null) => void
      >();
    });

    it('accepts readonly selection arrays and reports mutable ones (C-NAMING)', () => {
      const selected = ['apple'] as const;
      const elements = [
        <List key="1" selectable selectedItems={selected} />,
        <List key="2" selectable selectionMode="multiple" defaultSelectedItems={selected} />,
      ];
      expect(elements).toHaveLength(2);
      expectTypeOf<ListProps['selectedItems']>().toEqualTypeOf<readonly string[] | undefined>();
      expectTypeOf<ListProps['defaultSelectedItems']>().toEqualTypeOf<
        readonly string[] | undefined
      >();
      expectTypeOf<NonNullable<ListProps['onSelectionChange']>>().toEqualTypeOf<
        (selected: string[]) => void
      >();
    });
  });

  describe('duplicate item values', () => {
    const duplicateWarning = (value: string) =>
      `[WaveUI] List: several items share the value "${value}". Item values must be unique ` +
      'within a List; items with the same value are selected (and tab stops) together.';
    const items = (values: string[]) =>
      values.map((value, index) => (
        <List.Item key={index} value={value}>
          {`${value} ${index}`}
        </List.Item>
      ));

    it('warns once per duplicated value in a selectable list', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error');
      const { rerender } = render(
        <List selectable aria-label="Fruits">
          {items(['a', 'b', 'a', 'c', 'b', 'a'])}
        </List>,
      );
      rerender(
        <List selectable aria-label="Fruits">
          {items(['a', 'b', 'a', 'c', 'b', 'a', 'c'])}
        </List>,
      );
      await flushItemObserver();
      expect(warn.mock.calls).toEqual([
        [duplicateWarning('a')],
        [duplicateWarning('b')],
        [duplicateWarning('c')],
      ]);
      expect(error).not.toHaveBeenCalled();
    });

    it('does not warn for unique values or for items without a value', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <List selectable aria-label="Fruits">
          {fruits}
          <List.Item>Not selectable</List.Item>
          <List.Item>Not selectable either</List.Item>
        </List>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn in a plain list, where values select nothing', () => {
      const warn = vi.spyOn(console, 'warn');
      render(<List>{items(['a', 'a'])}</List>);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("selectionMode 'multiple' (data-display#30)", () => {
    it("accepts the deprecated 'multi' alias with a warning", async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable selectionMode="multi" onSelectionChange={onChange} aria-label="Fruits">
          {fruits}
        </List>,
      );
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
      await user.click(option('Apple'));
      await user.click(option('Banana'));
      expect(onChange).toHaveBeenLastCalledWith(['apple', 'banana']);
      expect(warn.mock.calls).toEqual([
        [
          expect.stringContaining(
            '[WaveUI] List: `selectionMode="multi"` is deprecated and will be removed in 1.0. Use `selectionMode="multiple"` instead.',
          ),
        ],
      ]);
    });
  });

  describe('keyboard (data-display#7, #8, feedback-navigation#47)', () => {
    function renderFruits(props: Partial<ListProps> = {}) {
      return render(
        <>
          <button type="button">Before</button>
          <List selectable aria-label="Fruits" {...props}>
            {fruits}
          </List>
          <button type="button">After</button>
        </>,
      );
    }

    it('has a single Tab stop on the first option', async () => {
      const user = userEvent.setup();
      renderFruits();
      await user.tab();
      await user.tab();
      expect(option('Apple')).toHaveFocus();
      expect(option('Banana')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(option('Apple')).toHaveFocus();
    });

    it('puts the Tab stop on the selected option', async () => {
      const user = userEvent.setup();
      renderFruits({ defaultSelectedItems: ['cherry'] });
      await user.tab();
      await user.tab();
      expect(option('Cherry')).toHaveFocus();
    });

    it('moves focus with ArrowDown/ArrowUp and wraps', async () => {
      const user = userEvent.setup();
      renderFruits();
      act(() => option('Apple').focus());
      await user.keyboard('{ArrowDown}');
      expect(option('Banana')).toHaveFocus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(option('Apple')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(option('Cherry')).toHaveFocus();
    });

    it('moves focus to the first and last option with Home/End', async () => {
      const user = userEvent.setup();
      renderFruits();
      act(() => option('Banana').focus());
      await user.keyboard('{End}');
      expect(option('Cherry')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(option('Apple')).toHaveFocus();
    });

    it('toggles selection with Space and prevents page scrolling', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderFruits({ onSelectionChange: onChange });
      act(() => option('Banana').focus());
      await user.keyboard(' ');
      expect(onChange).toHaveBeenCalledWith(['banana']);
      expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
      expect(fireEvent.keyDown(option('Banana'), { key: ' ' })).toBe(false);
    });

    it('selects item on Enter', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable onSelectionChange={onChange}>
          <List.Item value="a">Item A</List.Item>
        </List>,
      );
      act(() => screen.getByRole('option').focus());
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith(['a']);
    });

    it('jumps by typeahead when the list has more than 7 options', async () => {
      const user = userEvent.setup();
      const names = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew'];
      render(
        <List selectable aria-label="Fruits">
          {names.map((name) => (
            <List.Item key={name} value={name}>
              {name}
            </List.Item>
          ))}
        </List>,
      );
      act(() => option('Apple').focus());
      await user.keyboard('g');
      expect(option('Grape')).toHaveFocus();
    });

    it('has no typeahead for 7 options or fewer', async () => {
      const user = userEvent.setup();
      renderFruits();
      act(() => option('Apple').focus());
      await user.keyboard('c');
      expect(option('Apple')).toHaveFocus();
    });

    it('a Space inside a typeahead search does not toggle selection', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const cities = [
        'Amsterdam',
        'Berlin',
        'Dublin',
        'Lima',
        'New Delhi',
        'New York',
        'Oslo',
        'Paris',
      ];
      render(
        <List selectable aria-label="Cities" onSelectionChange={onChange}>
          {cities.map((city) => (
            <List.Item key={city} value={city}>
              {city}
            </List.Item>
          ))}
        </List>,
      );
      act(() => option('Amsterdam').focus());
      await user.keyboard('new y');
      expect(option('New York')).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      ['Ctrl+Alt', { ctrlKey: true, altKey: true }],
      ['Ctrl', { ctrlKey: true }],
      ['Alt', { altKey: true }],
      ['Meta', { metaKey: true }],
    ])(
      'leaves %s with Space or Enter to the page, also during a typeahead search: nothing toggles',
      async (_label, modifiers) => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const names = [
          'Apple',
          'Banana',
          'Cherry',
          'Date',
          'Elderberry',
          'Fig',
          'Grape',
          'Honeydew',
        ];
        render(
          <List selectable aria-label="Fruits" onSelectionChange={onChange}>
            {names.map((name) => (
              <List.Item key={name} value={name}>
                {name}
              </List.Item>
            ))}
          </List>,
        );
        act(() => option('Apple').focus());
        for (const key of [' ', 'Enter']) {
          expect(fireEvent.keyDown(option('Apple'), { key, ...modifiers })).toBe(true);
        }
        // Also during a search: the chord is no typed character (AltGr types no space).
        await user.keyboard('g');
        expect(option('Grape')).toHaveFocus();
        for (const key of [' ', 'Enter']) {
          expect(fireEvent.keyDown(option('Grape'), { key, ...modifiers })).toBe(true);
        }
        expect(onChange).not.toHaveBeenCalled();
        expect(option('Grape')).toHaveAttribute('aria-selected', 'false');
      },
    );

    it('Enter and Space toggle selection without calling the item onClick (pointer clicks only)', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onChange = vi.fn();
      render(
        <List selectable selectionMode="multiple" aria-label="Fruits" onSelectionChange={onChange}>
          <List.Item value="apple" onClick={onClick}>
            Apple
          </List.Item>
          <List.Item value="pear">Pear</List.Item>
        </List>,
      );
      act(() => option('Apple').focus());
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onChange.mock.calls).toEqual([[['apple']], [[]]]);
      expect(onClick).not.toHaveBeenCalled();
      await user.click(option('Apple'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('an item onKeyDown that stops propagation keeps Enter and Space working', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable selectionMode="multiple" aria-label="Fruits" onSelectionChange={onChange}>
          <List.Item value="apple" onKeyDown={(event) => event.stopPropagation()}>
            Apple
          </List.Item>
          <List.Item value="pear">Pear</List.Item>
        </List>,
      );
      act(() => option('Apple').focus());
      await user.keyboard(' ');
      await user.keyboard('{Enter}');
      expect(onChange.mock.calls).toEqual([[['apple']], [[]]]);
    });
  });

  describe('interactive content inside an item never toggles it', () => {
    it('listbox: clicks and keys on a checkbox, a label, a link or a role="button" element', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable aria-label="Documents" onSelectionChange={onChange}>
          <List.Item value="a">
            <input id="pin-a" type="checkbox" />
            <label htmlFor="pin-a">Pin</label>
            <a href="#doc-a">Open</a>
            <span role="button" tabIndex={0}>
              Share
            </span>
            <span>Doc A</span>
          </List.Item>
        </List>,
      );
      const item = screen.getByRole('option');
      const checkbox = screen.getByRole('checkbox', { name: 'Pin' });

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
      await user.click(screen.getByText('Pin'));
      expect(checkbox).not.toBeChecked();
      await user.click(screen.getByRole('link', { name: 'Open' }));
      await user.click(screen.getByRole('button', { name: 'Share' }));
      act(() => checkbox.focus());
      await user.keyboard(' ');
      expect(checkbox).toBeChecked();
      await user.keyboard('{Enter}');
      expect(onChange).not.toHaveBeenCalled();
      expect(item).toHaveAttribute('aria-selected', 'false');

      await user.click(screen.getByText('Doc A'));
      expect(onChange).toHaveBeenCalledWith(['a']);
      expect(item).toHaveAttribute('aria-selected', 'true');
    });

    it('grid: Enter or a click on a link in the content cell does not toggle the row', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable aria-label="Documents" onSelectionChange={onChange}>
          <List.Item value="a" action={<button type="button">Delete</button>}>
            <a href="#doc-a">Open Document A</a>
          </List.Item>
        </List>,
      );
      const link = screen.getByRole('link', { name: 'Open Document A' });
      act(() => link.focus());
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.click(link);
      expect(onChange).not.toHaveBeenCalled();
      expect(row(/Document A/)).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('actions in selectable lists (data-display#2)', () => {
    it('renders a grid with rows and gridcells', () => {
      render(<DocumentList />);
      const grid = screen.getByRole('grid', { name: 'Documents' });
      expect(grid).toHaveAttribute('aria-multiselectable', 'true');
      const alpha = row(/Alpha/);
      expect(alpha).toHaveAttribute('aria-selected', 'false');
      expect(alpha.querySelectorAll('[role="gridcell"]')).toHaveLength(2);
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('clicking an action runs it without toggling selection', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const onChange = vi.fn();
      render(<DocumentList onDelete={onDelete} onSelectionChange={onChange} />);
      await user.click(screen.getByRole('button', { name: 'Delete Beta' }));
      expect(onDelete).toHaveBeenCalledWith('Beta');
      expect(onChange).not.toHaveBeenCalled();
      expect(row(/Beta/)).toHaveAttribute('aria-selected', 'false');
    });

    it('Enter and Space on an action run it without toggling selection', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const onChange = vi.fn();
      render(<DocumentList onDelete={onDelete} onSelectionChange={onChange} />);
      act(() => screen.getByRole('button', { name: 'Delete Alpha' }).focus());
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onDelete).toHaveBeenCalledTimes(2);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('a letter typed on an action is not typeahead, so a Space right after still runs it', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      // More than 7 rows: the list has typeahead.
      const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota'];
      render(
        <List selectable aria-label="Documents">
          {names.map((name) => (
            <List.Item
              key={name}
              value={name}
              action={
                <button type="button" onClick={() => onDelete(name)}>
                  Delete {name}
                </button>
              }
            >
              {name}
            </List.Item>
          ))}
        </List>,
      );
      act(() => screen.getByRole('button', { name: 'Delete Alpha' }).focus());
      await user.keyboard('b');
      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toHaveFocus();
      await user.keyboard(' ');
      expect(onDelete).toHaveBeenCalledWith('Alpha');
    });

    it('clicking the row content toggles selection', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DocumentList onSelectionChange={onChange} />);
      await user.click(screen.getByText('Gamma'));
      expect(onChange).toHaveBeenCalledWith(['gamma']);
      expect(row(/Gamma/)).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps one Tab stop: actions are reached with the arrow keys', async () => {
      const user = userEvent.setup();
      render(
        <>
          <DocumentList />
          <button type="button">After</button>
        </>,
      );
      for (const button of screen.getAllByRole('button', { name: /Delete/ })) {
        expect(button).toHaveAttribute('tabindex', '-1');
      }
      await user.tab();
      expect(row(/Alpha/)).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('moves between rows with Up/Down and into actions with Right/Left', async () => {
      const user = userEvent.setup();
      render(<DocumentList />);
      act(() => row(/Alpha/).focus());
      await user.keyboard('{ArrowDown}');
      expect(row(/Beta/)).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: 'Delete Beta' })).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(row(/Beta/)).toHaveFocus();
      await user.keyboard('{ArrowRight}{ArrowDown}');
      expect(row(/Gamma/)).toHaveFocus();
    });

    it('mirrors Left/Right in RTL (feedback-navigation#34)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DocumentList />, { dir: 'rtl' });
      act(() => row(/Alpha/).focus());
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(row(/Alpha/)).toHaveFocus();
      const actionCell = row(/Alpha/).querySelector('[data-list-action]');
      expect(actionCell).toHaveClass('ms-2');
    });

    describe('several arrow stops in one action', () => {
      function TwoActionList() {
        return (
          <List selectable aria-label="Documents">
            <List.Item
              value="a"
              action={
                <>
                  <button type="button">Rename</button>
                  <button type="button">Delete</button>
                </>
              }
            >
              Document A
            </List.Item>
          </List>
        );
      }

      it('moves between the stops with Right/Left and back to the row', async () => {
        const user = userEvent.setup();
        render(<TwoActionList />);
        const docRow = row(/Document A/);
        const rename = screen.getByRole('button', { name: 'Rename' });
        const remove = screen.getByRole('button', { name: 'Delete' });
        act(() => docRow.focus());
        await user.keyboard('{ArrowRight}');
        expect(rename).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(remove).toHaveFocus();
        // The last stop keeps focus.
        await user.keyboard('{ArrowRight}');
        expect(remove).toHaveFocus();
        await user.keyboard('{ArrowLeft}');
        expect(rename).toHaveFocus();
        await user.keyboard('{ArrowLeft}');
        expect(docRow).toHaveFocus();
        expect(docRow).toHaveAttribute('aria-selected', 'false');
      });

      it('mirrors Right/Left between the stops in RTL', async () => {
        const user = userEvent.setup();
        renderWithProviders(<TwoActionList />, { dir: 'rtl' });
        const docRow = row(/Document A/);
        const rename = screen.getByRole('button', { name: 'Rename' });
        const remove = screen.getByRole('button', { name: 'Delete' });
        act(() => docRow.focus());
        await user.keyboard('{ArrowLeft}');
        expect(rename).toHaveFocus();
        await user.keyboard('{ArrowLeft}');
        expect(remove).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(rename).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(docRow).toHaveFocus();
      });
    });

    it('toggles a focused row with Enter as well as Space', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DocumentList onSelectionChange={onChange} />);
      act(() => row(/Beta/).focus());
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenLastCalledWith(['beta']);
      expect(row(/Beta/)).toHaveAttribute('aria-selected', 'true');
      await user.keyboard(' ');
      expect(onChange).toHaveBeenLastCalledWith([]);
      expect(row(/Beta/)).toHaveAttribute('aria-selected', 'false');
    });

    it('leaves Enter and Space with Ctrl, Alt or Meta on a focused row to the page', () => {
      const onChange = vi.fn();
      render(<DocumentList onSelectionChange={onChange} />);
      act(() => row(/Beta/).focus());
      for (const modifiers of [
        { ctrlKey: true, altKey: true },
        { ctrlKey: true },
        { altKey: true },
        { metaKey: true },
      ]) {
        for (const key of [' ', 'Enter']) {
          expect(fireEvent.keyDown(row(/Beta/), { key, ...modifiers })).toBe(true);
        }
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(row(/Beta/)).toHaveAttribute('aria-selected', 'false');
    });

    it('ArrowLeft on a focused text-entry cell returns to the row', async () => {
      const user = userEvent.setup();
      render(
        <List selectable aria-label="Documents">
          <List.Item value="a" action={<input aria-label="Rename A" defaultValue="Draft" />}>
            Document A
          </List.Item>
        </List>,
      );
      const docRow = row(/Document A/);
      const cell = screen
        .getByRole('textbox', { name: 'Rename A' })
        .closest('[role="gridcell"]') as HTMLElement;
      act(() => docRow.focus());
      await user.keyboard('{ArrowRight}');
      expect(cell).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(docRow).toHaveFocus();
    });

    it('a text-entry cell takes focus on the cell; Enter/F2 enter it, Escape returns', async () => {
      const user = userEvent.setup();
      render(
        <List selectable aria-label="Documents">
          <List.Item value="a" action={<input aria-label="Rename A" defaultValue="Draft" />}>
            Document A
          </List.Item>
        </List>,
      );
      const docRow = row(/Document A/);
      const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Rename A' });
      const cell = input.closest('[role="gridcell"]') as HTMLElement;
      expect(input).toHaveAttribute('tabindex', '-1');

      act(() => docRow.focus());
      await user.keyboard('{ArrowRight}');
      expect(cell).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(input).toHaveFocus();

      input.setSelectionRange(5, 5);
      await user.keyboard('{ArrowLeft}');
      expect(input).toHaveFocus();
      expect(input).toHaveProperty('selectionStart', 4);
      await user.keyboard('{ArrowRight}');
      expect(input).toHaveProperty('selectionStart', 5);

      await user.keyboard('{Escape}');
      expect(cell).toHaveFocus();
      await user.keyboard('{F2}');
      expect(input).toHaveFocus();
      expect(docRow).toHaveAttribute('aria-selected', 'false');
    });

    it('keeps action content added later out of the Tab order', async () => {
      const user = userEvent.setup();
      /** Replaces its Delete button with Confirm/Cancel from its own state (same `action`). */
      function ConfirmDelete() {
        const [confirming, setConfirming] = React.useState(false);
        const [armed, setArmed] = React.useState(false);
        if (!confirming) {
          return (
            <button type="button" onClick={() => setConfirming(true)}>
              Delete
            </button>
          );
        }
        return (
          <>
            <button type="button" tabIndex={armed ? 0 : undefined} onClick={() => setArmed(true)}>
              Confirm
            </button>
            <button type="button">Cancel</button>
          </>
        );
      }
      render(
        <List selectable aria-label="Documents">
          <List.Item value="a" action={<ConfirmDelete />}>
            Document A
          </List.Item>
        </List>,
      );
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await flushItemObserver();
      const confirm = screen.getByRole('button', { name: 'Confirm' });
      expect(confirm).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('tabindex', '-1');

      // The action sets tabIndex={0} itself: the row stays the only Tab stop.
      await user.click(confirm);
      await flushItemObserver();
      expect(confirm).toHaveAttribute('tabindex', '-1');
      expect(row(/Document A/)).toHaveAttribute('aria-selected', 'false');
    });

    it('does not rescan the actions on every render of a controlled list with inline actions', () => {
      function Controlled() {
        const [selected, setSelected] = React.useState<string[]>([]);
        return (
          <DocumentList selectedItems={selected} onSelectionChange={(next) => setSelected(next)} />
        );
      }
      render(<Controlled />);
      const alpha = row(/Alpha/);
      const querySelectorAll = vi.spyOn(Element.prototype, 'querySelectorAll');
      const getComputedStyle = vi.spyOn(window, 'getComputedStyle');
      fireEvent.click(alpha);
      const actionScans = querySelectorAll.mock.contexts.filter(
        (el) => el instanceof Element && el.hasAttribute('data-list-action'),
      ).length;
      const styleReads = getComputedStyle.mock.calls.length;
      querySelectorAll.mockRestore();
      getComputedStyle.mockRestore();
      expect(alpha).toHaveAttribute('aria-selected', 'true');
      expect(actionScans).toBe(0);
      expect(styleReads).toBe(0);
      for (const button of screen.getAllByRole('button', { name: /Delete/ })) {
        expect(button).toHaveAttribute('tabindex', '-1');
      }
    });

    describe('with a Toolbar action in every row and typeahead (more than 7 rows)', () => {
      const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota'];
      const renderToolbarRows = (onEdit: (name: string) => void = () => {}) =>
        render(
          <List selectable aria-label="Documents">
            {names.map((name) => (
              <List.Item
                key={name}
                value={name}
                action={
                  <Toolbar aria-label={`${name} tools`}>
                    <button type="button" onClick={() => onEdit(name)}>
                      Edit {name}
                    </button>
                  </Toolbar>
                }
              >
                {name}
              </List.Item>
            ))}
          </List>,
        );

      it('ArrowDown and typeahead move between rows, never into a row action', async () => {
        const user = userEvent.setup();
        renderToolbarRows();
        await flushItemObserver();
        act(() => row(/^Alpha/).focus());
        await user.keyboard('{ArrowDown}');
        expect(row(/^Beta/)).toHaveFocus();
        // "Edit Beta" starts with "e" too; typeahead matches rows only.
        await user.keyboard('e');
        expect(row(/^Epsilon/)).toHaveFocus();
      });

      it('a letter typed on an action is not typeahead, and a Space right after runs it', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn();
        renderToolbarRows(onEdit);
        await flushItemObserver();
        act(() => screen.getByRole('button', { name: 'Edit Alpha' }).focus());
        await user.keyboard('g');
        expect(screen.getByRole('button', { name: 'Edit Alpha' })).toHaveFocus();
        await user.keyboard(' ');
        expect(onEdit).toHaveBeenCalledWith('Alpha');
      });

      it('a Space in an action right after typeahead to its row runs the action', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn();
        renderToolbarRows(onEdit);
        await flushItemObserver();
        act(() => row(/^Alpha/).focus());
        await user.keyboard('b');
        expect(row(/^Beta/)).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('button', { name: 'Edit Beta' })).toHaveFocus();
        await user.keyboard(' ');
        expect(onEdit).toHaveBeenCalledWith('Beta');
      });
    });

    it('leaves a nested composite in an action to manage its own Tab stop', async () => {
      render(
        <List selectable aria-label="Documents">
          <List.Item
            value="a"
            action={
              <Toolbar aria-label="Row tools">
                <button type="button">Edit</button>
                <button type="button">Share</button>
              </Toolbar>
            }
          >
            Document A
          </List.Item>
          <List.Item value="b" action={<button type="button">Delete</button>}>
            Document B
          </List.Item>
          <List.Item
            value="c"
            action={
              <div role="radiogroup" aria-label="Priority">
                <input type="radio" name="priority" aria-label="High" />
              </div>
            }
          >
            Document C
          </List.Item>
        </List>,
      );
      await flushItemObserver();
      expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('button', { name: 'Share' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('tabindex', '-1');
      // The list never writes tabindex inside a composite, whoever manages it.
      expect(screen.getByRole('radio', { name: 'High' })).not.toHaveAttribute('tabindex');
    });

    it('leaves an element alone when a script keeps re-applying its tabindex', async () => {
      let reapplied = 0;
      /**
       * Keeps its button at tabindex 0 with its own observer (no composite role). It gives up after
       * 50 rounds, so a regression fails the assertion below instead of looping forever.
       */
      function Pinned() {
        const ref = React.useRef<HTMLButtonElement>(null);
        React.useLayoutEffect(() => {
          const button = ref.current;
          if (!button) return;
          const observer = new MutationObserver(() => {
            if (button.getAttribute('tabindex') === '0' || reapplied >= 50) return;
            reapplied += 1;
            button.setAttribute('tabindex', '0');
          });
          observer.observe(button, { attributes: true, attributeFilter: ['tabindex'] });
          return () => observer.disconnect();
        }, []);
        return (
          <button ref={ref} type="button" tabIndex={0}>
            Pinned
          </button>
        );
      }
      render(
        <List selectable aria-label="Documents">
          <List.Item value="a" action={<Pinned />}>
            Document A
          </List.Item>
        </List>,
      );
      await flushItemObserver();
      expect(screen.getByRole('button', { name: 'Pinned' })).toHaveAttribute('tabindex', '0');
      expect(reapplied).toBe(1);
    });

    it('ignores clicks inside a popup portaled from an action (React portal bubbling)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable aria-label="Documents" onSelectionChange={onChange}>
          <List.Item
            value="a"
            action={
              <Popover>
                <Popover.Trigger>
                  <Button>Info</Button>
                </Popover.Trigger>
                <Popover.Content title="Details">
                  <p>Some details</p>
                </Popover.Content>
              </Popover>
            }
          >
            Alpha
          </List.Item>
          <List.Item
            value="b"
            action={
              <Menu>
                <Menu.Trigger>
                  <Button>More</Button>
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item>Delete</Menu.Item>
                </Menu.Popover>
              </Menu>
            }
          >
            Beta
          </List.Item>
        </List>,
      );

      await user.click(screen.getByRole('button', { name: 'Info' }));
      const details = screen.getByText('Some details');
      expect(row(/Alpha/).contains(details)).toBe(false);
      await user.click(details);
      await user.click(screen.getByRole('dialog', { name: 'Details' }));
      expect(onChange).not.toHaveBeenCalled();
      expect(row(/Alpha/)).toHaveAttribute('aria-selected', 'false');
      await user.keyboard('{Escape}');

      await user.click(screen.getByRole('button', { name: 'More' }));
      await user.click(screen.getByRole('separator'));
      expect(onChange).not.toHaveBeenCalled();
      expect(row(/Beta/)).toHaveAttribute('aria-selected', 'false');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      // The row itself still toggles.
      await user.click(screen.getByText('Beta'));
      expect(onChange).toHaveBeenCalledWith(['b']);
    });

    it.each([
      ['an empty array', []],
      ['an array of empty values', [null, false, '']],
      ['an empty string', ''],
    ])('an action that renders nothing (%s) is no action (C-SLOTS)', (_, action) => {
      const docs = (
        <List selectable aria-label="Documents">
          <List.Item value="a" action={action}>
            Document A
          </List.Item>
        </List>
      );
      expect(renderToString(docs)).toContain('role="listbox"');
      render(docs);
      expect(screen.getByRole('listbox', { name: 'Documents' })).toBeInTheDocument();
      expect(option('Document A').querySelector('[data-list-action]')).toBeNull();
    });

    it('an action of 0 renders (0 is content, C-SLOTS)', () => {
      render(
        <List selectable aria-label="Documents">
          <List.Item value="a" action={0}>
            Document A
          </List.Item>
        </List>,
      );
      expect(screen.getByRole('grid', { name: 'Documents' })).toBeInTheDocument();
      expect(document.querySelector('[data-list-action]')).toHaveTextContent('0');
    });

    // A generator is read once to decide whether it renders anything; its items are what renders.
    it.each([
      ['a selectable list (grid)', true],
      ['a plain list', false],
    ])('renders an action given as a generator in %s', (_, selectable) => {
      const error = vi.spyOn(console, 'error');
      function* actions(): Generator<React.ReactNode> {
        yield (
          <button key="delete" type="button">
            Delete A
          </button>
        );
      }
      render(
        <List selectable={selectable} aria-label="Documents">
          <List.Item value="a" action={actions()}>
            Document A
          </List.Item>
        </List>,
      );
      expect(screen.getByRole(selectable ? 'grid' : 'list', { name: 'Documents' })).toBeVisible();
      const cell = document.querySelector('[data-list-action]');
      expect(cell).toContainElement(screen.getByRole('button', { name: 'Delete A' }));
      expect(error).not.toHaveBeenCalled();
    });

    it('keeps a non-selectable list with actions a plain list', () => {
      render(
        <List>
          <List.Item action={<button type="button">Delete</button>}>Document</List.Item>
        </List>,
      );
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('switching between listbox and grid keeps focus (data-display#2)', () => {
    /** Only selected documents show a Delete action, so selecting switches the list to a grid. */
    function SelectionActions() {
      const [selected, setSelected] = React.useState<string[]>([]);
      return (
        <List
          selectable
          selectionMode="multiple"
          aria-label="Docs"
          selectedItems={selected}
          onSelectionChange={setSelected}
        >
          {['a', 'b'].map((value) => (
            <List.Item
              key={value}
              value={value}
              action={
                selected.includes(value) ? <button type="button">Delete {value}</button> : undefined
              }
            >
              Doc {value}
            </List.Item>
          ))}
        </List>
      );
    }

    it('keeps focus on the item when an action appears (listbox -> grid)', async () => {
      const user = userEvent.setup();
      render(<SelectionActions />);
      const before = option('Doc a');
      act(() => before.focus());
      await user.keyboard(' ');
      expect(screen.getByRole('grid', { name: 'Docs' })).toBeInTheDocument();
      expect(before).not.toBeInTheDocument();
      expect(row(/Doc a/)).toHaveFocus();
      expect(row(/Doc a/)).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps focus across both switches in StrictMode', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <SelectionActions />
        </React.StrictMode>,
      );
      act(() => option('Doc a').focus());
      await user.keyboard(' ');
      expect(row(/Doc a/)).toHaveFocus();
      await user.keyboard(' ');
      expect(option('Doc a')).toHaveFocus();
    });

    it('keeps focus on the item when the last action disappears (grid -> listbox)', async () => {
      const user = userEvent.setup();
      render(<SelectionActions />);
      act(() => option('Doc b').focus());
      await user.keyboard(' ');
      expect(row(/Doc b/)).toHaveFocus();
      await user.keyboard(' ');
      expect(screen.getByRole('listbox', { name: 'Docs' })).toBeInTheDocument();
      expect(option('Doc b')).toHaveFocus();
      expect(option('Doc b')).toHaveAttribute('aria-selected', 'false');
    });

    it('moves focus to the next item when the last row with an action is deleted', async () => {
      const user = userEvent.setup();
      function Deletable() {
        const [items, setItems] = React.useState(['a', 'b', 'c']);
        return (
          <List selectable aria-label="Docs">
            {items.map((value) => (
              <List.Item
                key={value}
                value={value}
                action={
                  value === 'b' ? (
                    <button
                      type="button"
                      onClick={() => setItems((all) => all.filter((item) => item !== value))}
                    >
                      Delete {value}
                    </button>
                  ) : undefined
                }
              >
                Doc {value}
              </List.Item>
            ))}
          </List>
        );
      }
      render(<Deletable />);
      act(() => row(/Doc b/).focus());
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: 'Delete b' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('listbox', { name: 'Docs' })).toBeInTheDocument();
      expect(option('Doc c')).toHaveFocus();
    });

    /** Row a has an inline rename input that commits on Enter and removes itself. */
    function RenameList({ otherAction = false }: { otherAction?: boolean }) {
      const [editing, setEditing] = React.useState(true);
      return (
        <List selectable aria-label="Docs">
          <List.Item
            value="a"
            action={
              editing ? (
                <input
                  aria-label="Rename a"
                  defaultValue="Draft"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setEditing(false);
                  }}
                />
              ) : undefined
            }
          >
            Doc a
          </List.Item>
          <List.Item
            value="b"
            action={otherAction ? <button type="button">Delete b</button> : undefined}
          >
            Doc b
          </List.Item>
        </List>
      );
    }

    it('keeps focus when the focused widget inside the last action removes it (grid -> listbox)', async () => {
      const user = userEvent.setup();
      render(<RenameList />);
      act(() => row(/Doc a/).focus());
      await user.keyboard('{ArrowRight}{Enter}');
      expect(screen.getByRole('textbox', { name: 'Rename a' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('listbox', { name: 'Docs' })).toBeInTheDocument();
      expect(option('Doc a')).toHaveFocus();
    });

    it('keeps focus when the last action removes itself in StrictMode', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <RenameList />
        </React.StrictMode>,
      );
      act(() => row(/Doc a/).focus());
      await user.keyboard('{ArrowRight}{Enter}{Enter}');
      expect(option('Doc a')).toHaveFocus();
    });

    it('does not move focus later when an action that held it is removed without a switch', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<RenameList otherAction />);
      act(() => row(/Doc a/).focus());
      await user.keyboard('{ArrowRight}{Enter}{Enter}');
      // Row b keeps its action, so the list stays a grid: the consumer removed the focused element.
      expect(screen.getByRole('grid', { name: 'Docs' })).toBeInTheDocument();
      expect(document.body).toHaveFocus();
      await act(async () => {});
      rerender(<RenameList />);
      expect(screen.getByRole('listbox', { name: 'Docs' })).toBeInTheDocument();
      expect(document.body).toHaveFocus();
    });

    it('keeps focus on a value-less item across a mode switch caused by a rerender', () => {
      const docs = (actionOn: string | null) => (
        <List selectable aria-label="Docs">
          <List.Item>Intro</List.Item>
          {['a', 'b'].map((value) => (
            <List.Item
              key={value}
              value={value}
              action={
                actionOn === value ? <button type="button">Delete {value}</button> : undefined
              }
            >
              Doc {value}
            </List.Item>
          ))}
        </List>
      );
      const { rerender } = render(docs(null));
      act(() => option('Intro').focus());
      rerender(docs('b'));
      expect(row('Intro')).toHaveFocus();
      rerender(docs(null));
      expect(option('Intro')).toHaveFocus();
    });

    it('does not take focus when the list did not hold it', () => {
      const docs = (actionOn: string | null) => (
        <>
          <button type="button">Outside</button>
          <List selectable aria-label="Docs">
            {['a', 'b'].map((value) => (
              <List.Item
                key={value}
                value={value}
                action={
                  actionOn === value ? <button type="button">Delete {value}</button> : undefined
                }
              >
                Doc {value}
              </List.Item>
            ))}
          </List>
        </>
      );
      const { rerender } = render(docs(null));
      rerender(docs('a'));
      expect(document.body).toHaveFocus();

      const outside = screen.getByRole('button', { name: 'Outside' });
      act(() => outside.focus());
      rerender(docs(null));
      expect(outside).toHaveFocus();
    });
  });

  describe('registry cost (table-core#22)', () => {
    it('does not re-render a non-selectable list for item registration', () => {
      let commits = 0;
      const onRender = () => {
        commits += 1;
      };
      const items = (count: number) =>
        Array.from({ length: count }, (_, index) => (
          <List.Item key={index} value={`item-${index}`}>
            Item {index}
          </List.Item>
        ));
      const { rerender } = render(
        <React.Profiler id="list" onRender={onRender}>
          <List>{items(3)}</List>
        </React.Profiler>,
      );
      expect(commits).toBe(1);
      rerender(
        <React.Profiler id="list" onRender={onRender}>
          <List>{items(4)}</List>
        </React.Profiler>,
      );
      expect(commits).toBe(2);
      rerender(
        <React.Profiler id="list" onRender={onRender}>
          <List>{items(1)}</List>
        </React.Profiler>,
      );
      expect(commits).toBe(3);
    });

    it('builds the registry data once per commit however many items mount or unmount', () => {
      const build = vi.spyOn(ListRegistrySnapshot.prototype, 'build');
      let commits = 0;
      const onRender = () => {
        commits += 1;
      };
      const list = (count: number) => (
        <React.Profiler id="list" onRender={onRender}>
          <List selectable selectionMode="multiple" aria-label="Many">
            {Array.from({ length: count }, (_, index) => (
              <List.Item key={index} value={`item-${index}`}>
                Item {index}
              </List.Item>
            ))}
          </List>
        </React.Profiler>
      );
      const expectOneBuild = () => {
        // One commit for the change and one for the registry update; one O(n) build, not one per item.
        expect(build).toHaveBeenCalledTimes(1);
        expect(commits).toBe(2);
        build.mockClear();
        commits = 0;
      };

      const { container, rerender } = render(list(300));
      const options = () => container.querySelectorAll('[role="option"]');
      expectOneBuild();
      rerender(list(120));
      expect(options()).toHaveLength(120);
      expectOneBuild();
      rerender(list(300));
      expect(options()).toHaveLength(300);
      expectOneBuild();
    });

    it('never walks the items through a children collection (O(n²) in jsdom before 30.1)', () => {
      // jsdom before 30.1 does not cache indexed HTMLCollection access, so `root.children[i]`
      // loops and `Array.from(root.children)` made each commit of a 3000-item list cost about a
      // second there. Consumers' test suites may still run those versions.
      const docs = (actionOn: string | null) => (
        <List selectable selectionMode="multiple" aria-label="Docs">
          <List.Item>Intro</List.Item>
          {['a', 'b', 'c'].map((value) => (
            <List.Item
              key={value}
              value={value}
              action={
                actionOn === value ? <button type="button">Delete {value}</button> : undefined
              }
            >
              Doc {value}
            </List.Item>
          ))}
        </List>
      );
      const children = vi.spyOn(Element.prototype, 'children', 'get');
      const { rerender } = render(docs(null));
      const intro = screen.getAllByRole('option')[0];
      const docB = screen.getAllByRole('option')[2];
      children.mockClear();
      // Mount, a selection commit (order sync), and a focused switch to a grid and back (the item
      // index of the focus loss and the focus restore target).
      fireEvent.click(docB);
      act(() => intro.focus());
      rerender(docs('b'));
      rerender(docs(null));
      const reads = children.mock.calls.length;
      children.mockRestore();
      expect(reads).toBe(0);
      expect(option('Intro')).toHaveFocus();
      expect(option('Doc b')).toHaveAttribute('aria-selected', 'true');
    });

    it('still prunes the selection after many items are removed at once', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const items = (count: number) =>
        Array.from({ length: count }, (_, index) => (
          <List.Item key={index} value={`item-${index}`}>
            Item {index}
          </List.Item>
        ));
      const { rerender } = render(
        <List
          selectable
          selectionMode="multiple"
          defaultSelectedItems={['item-0', 'item-150']}
          onSelectionChange={onChange}
          aria-label="Many"
        >
          {items(200)}
        </List>,
      );
      rerender(
        <List
          selectable
          selectionMode="multiple"
          defaultSelectedItems={['item-0', 'item-150']}
          onSelectionChange={onChange}
          aria-label="Many"
        >
          {items(10)}
        </List>,
      );
      expect(screen.getAllByRole('option')).toHaveLength(10);
      await user.click(option('Item 1'));
      expect(onChange).toHaveBeenLastCalledWith(['item-0', 'item-1']);
    });
  });

  describe('composed handlers (layout#10)', () => {
    testComposedHandler(List, {
      handler: 'onKeyDown',
      defaultProps: { selectable: true, 'aria-label': 'Fruits', children: fruits },
      act: async ({ user }) => {
        act(() => option('Apple').focus());
        await user.keyboard('{ArrowDown}');
      },
      assertInternal: () => {
        expect(option('Banana')).toHaveFocus();
      },
      assertInternalSuppressed: () => {
        expect(option('Apple')).toHaveFocus();
      },
    });

    it('composes a consumer onFocus on a selectable list; its preventDefault() blocks nothing', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn((event: React.FocusEvent) => event.preventDefault());
      render(
        <>
          <button type="button">Before</button>
          <List selectable aria-label="Fruits" onFocus={onFocus}>
            {fruits}
          </List>
        </>,
      );
      await user.tab();
      await user.tab();
      expect(option('Apple')).toHaveFocus();
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onFocus.mock.calls[0][0].target).toBe(option('Apple'));
      await user.keyboard('{ArrowDown}');
      expect(option('Banana')).toHaveFocus();
      expect(onFocus).toHaveBeenCalledTimes(2);
      expect(option('Apple')).toHaveAttribute('tabindex', '0');
    });

    it('composes a consumer onKeyDownCapture with the typeahead Space of a selectable list', async () => {
      const user = userEvent.setup();
      const onKeyDownCapture = vi.fn();
      const onChange = vi.fn();
      const cities = [
        'Amsterdam',
        'Berlin',
        'Dublin',
        'Lima',
        'New Delhi',
        'New York',
        'Oslo',
        'Paris',
      ];
      render(
        <List
          selectable
          aria-label="Cities"
          onKeyDownCapture={onKeyDownCapture}
          onSelectionChange={onChange}
        >
          {cities.map((city) => (
            <List.Item key={city} value={city}>
              {city}
            </List.Item>
          ))}
        </List>,
      );
      act(() => option('Amsterdam').focus());
      await user.keyboard('new y');
      expect(onKeyDownCapture).toHaveBeenCalledTimes(5);
      // The list's own capture handler still runs: the Space continues the search.
      expect(option('New York')).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('a consumer onKeyDownCapture that calls preventDefault() suppresses the list keys', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List
          selectable
          aria-label="Fruits"
          onSelectionChange={onChange}
          onKeyDownCapture={(event) => event.preventDefault()}
        >
          {fruits}
        </List>,
      );
      act(() => option('Apple').focus());
      await user.keyboard('{ArrowDown} ');
      expect(option('Apple')).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('composes a ListItem onClick with selection (preventDefault suppresses it)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <List selectable selectionMode="multiple" onSelectionChange={onChange} aria-label="Fruits">
          <List.Item value="a" onClick={() => {}}>
            Plain
          </List.Item>
          <List.Item value="b" onClick={(event) => event.preventDefault()}>
            Prevented
          </List.Item>
        </List>,
      );
      await user.click(option('Plain'));
      expect(onChange).toHaveBeenCalledWith(['a']);
      await user.click(option('Prevented'));
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('composes a ListItem onKeyDown with selection', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      const onChange = vi.fn();
      render(
        <List selectable onSelectionChange={onChange} aria-label="Fruits">
          <List.Item value="a" onKeyDown={onKeyDown}>
            A
          </List.Item>
        </List>,
      );
      act(() => option('A').focus());
      await user.keyboard('{Enter}');
      expect(onKeyDown).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(['a']);
    });
  });
});
