import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlatTree } from '../FlatTree';
import type { FlatTreeProps } from '../FlatTree';
import { useFlatTree, type UseFlatTreeOptions } from '../useFlatTree';
import type { FlatTreeItemData } from '../../../lib/flatTree';
import { flatTreeItemClassNames } from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  renderWithProviders,
} from '../../../test-utils';

/**
 * docs     Documents
 *   work   Work
 *   notes  Notes.txt
 * readme   README.md
 */
const FILES: FlatTreeItemData[] = [
  { value: 'docs', label: 'Documents' },
  { value: 'work', parentValue: 'docs', label: 'Work' },
  { value: 'notes', parentValue: 'docs', label: 'Notes.txt' },
  { value: 'readme', label: 'README.md' },
];

type GridProps = Omit<FlatTreeProps, 'model'> & {
  items?: readonly FlatTreeItemData[];
  options?: UseFlatTreeOptions;
};

/** The sizes the cells show, by value. */
const SIZES: Record<string, string> = { docs: '--', work: '--', notes: '2 KB', readme: '1 KB' };

/** A treegrid "Files" with a size and an actions cell on every row. */
function Grid({ items = FILES, options, onOpen, ...props }: GridProps & { onOpen?: () => void }) {
  const model = useFlatTree(items, options);
  return (
    <FlatTree
      aria-label="Files"
      model={model}
      {...model.getTreeProps()}
      navigationMode="treegrid"
      renderCells={(row) => [
        SIZES[row.item.value],
        <button key="open" type="button" aria-label={`Open ${row.item.label}`} onClick={onOpen}>
          Open
        </button>,
      ]}
      {...props}
    />
  );
}

const treegrid = () => screen.getByRole('treegrid');
const rows = () => screen.getAllByRole('row');
const row = (name: string) => screen.getByRole('row', { name });
/** The `gridcell`s of a row, in order. */
const cells = (name: string) => within(row(name)).getAllByRole('gridcell');
const tabStops = () =>
  Array.from(treegrid().querySelectorAll<HTMLElement>('[tabindex="0"]')).map(
    (el) => el.getAttribute('data-index') ?? el.getAttribute('data-flat-tree-cell'),
  );

async function focus(el: HTMLElement): Promise<void> {
  act(() => el.focus());
  await act(async () => {});
}

describe('FlatTree navigationMode="treegrid"', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('roles and attributes', () => {
    it('renders role="treegrid" with rows and gridcells, and no tree roles', () => {
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      expect(treegrid()).toHaveAttribute('aria-rowcount', '4');
      expect(screen.queryByRole('tree')).toBeNull();
      expect(screen.queryByRole('treeitem')).toBeNull();
      expect(rows().map((el) => el.getAttribute('aria-rowindex'))).toEqual(['1', '2', '3', '4']);
      // The first cell is the item's content, then one per node of renderCells.
      expect(cells('Documents')).toHaveLength(3);
      expect(cells('Documents')[0]).toHaveClass(flatTreeItemClassNames.row);
      expect(cells('Documents')[1]).toHaveClass(flatTreeItemClassNames.cell);
      expect(cells('Notes.txt').map((el) => el.textContent)).toEqual(['Notes.txt', '2 KB', 'Open']);
    });

    it('gives each row its level, position, set size and expanded state', () => {
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      expect(row('Documents')).toHaveAttribute('aria-level', '1');
      expect(row('Documents')).toHaveAttribute('aria-posinset', '1');
      expect(row('Documents')).toHaveAttribute('aria-setsize', '2');
      expect(row('Documents')).toHaveAttribute('aria-expanded', 'true');
      expect(row('Work')).toHaveAttribute('aria-level', '2');
      expect(row('Work')).toHaveAttribute('aria-setsize', '2');
      expect(row('Work')).not.toHaveAttribute('aria-expanded');
      expect(row('README.md')).toHaveAttribute('aria-posinset', '2');
    });

    it('has one tab stop, the first row', () => {
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      expect(tabStops()).toEqual(['0']);
      expect(row('Documents')).toHaveAttribute('tabindex', '0');
    });

    it('takes the controls inside cells out of the Tab order, also those that render later', async () => {
      function Late() {
        const [on, setOn] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOn(true)}>
              More
            </button>
            <Grid
              renderCells={() => [
                <span key="late">
                  <a href="#now">Now</a>
                  {on ? <button type="button">Late</button> : null}
                </span>,
              ]}
            />
          </>
        );
      }
      const user = userEvent.setup();
      render(<Late />);
      expect(screen.getAllByRole('link', { name: 'Now' })[0]).toHaveAttribute('tabindex', '-1');
      await user.click(screen.getByRole('button', { name: 'More' }));
      for (const late of await screen.findAllByRole('button', { name: 'Late' })) {
        await vi.waitFor(() => expect(late).toHaveAttribute('tabindex', '-1'));
      }
    });

    it('a checkbox tree has no aria-checked on its rows: the checkbox in the first cell has it', () => {
      render(
        <Grid
          options={{
            defaultExpandedItems: ['docs'],
            selectionMode: 'multiple',
            defaultCheckedItems: ['notes'],
          }}
        />,
      );
      expect(treegrid()).toHaveAttribute('aria-multiselectable', 'true');
      expect(row('Notes.txt')).not.toHaveAttribute('aria-checked');
      expect(within(row('Notes.txt')).getByRole('checkbox')).toBeChecked();
      expect(within(row('Work')).getByRole('checkbox')).not.toBeChecked();
    });

    it('renders on the server', () => {
      const html = renderToString(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      expect(html).toContain('role="treegrid"');
      expect(html).toContain('role="row"');
      expect(html).toContain('role="gridcell"');
      expect(html).toContain('aria-rowcount="4"');
    });

    it('has no accessibility violations', async () => {
      render(
        <Grid
          options={{
            defaultExpandedItems: ['docs'],
            selectionMode: 'multiple',
            defaultCheckedItems: ['notes'],
          }}
        />,
      );
      await expectNoA11yViolations();
    });

    it('has no accessibility violations with a single selection', async () => {
      render(
        <Grid
          options={{ defaultExpandedItems: ['docs'], selectionMode: 'single' }}
          selected="work"
        />,
      );
      expect(row('Work')).toHaveAttribute('aria-selected', 'true');
      await expectNoA11yViolations();
    });

    it('without navigationMode the tree is unchanged: roles of a tree, no cells', () => {
      function Plain() {
        const model = useFlatTree(FILES, { defaultExpandedItems: ['docs'] });
        return <FlatTree aria-label="Files" model={model} />;
      }
      render(<Plain />);
      expect(screen.getByRole('tree')).not.toHaveAttribute('aria-rowcount');
      expect(screen.getAllByRole('treeitem')).toHaveLength(4);
      expect(screen.queryByRole('gridcell')).toBeNull();
      expect(screen.getByRole('treeitem', { name: 'Documents' })).not.toHaveAttribute(
        'aria-rowindex',
      );
    });
  });

  describe('keyboard: rows', () => {
    it('Down, Up, Home and End (also with Ctrl) move between the rows', async () => {
      const user = userEvent.setup();
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      await user.tab();
      expect(row('Documents')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(row('Work')).toHaveFocus();
      expect(tabStops()).toEqual(['1']);
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(row('Documents')).toHaveFocus();
      await user.keyboard('{End}');
      expect(row('README.md')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(row('Documents')).toHaveFocus();
      await user.keyboard('{Control>}{End}{/Control}');
      expect(row('README.md')).toHaveFocus();
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(row('Documents')).toHaveFocus();
    });

    it('Right expands a collapsed branch, then moves into the first cell, not the first child', async () => {
      const user = userEvent.setup();
      const onExpandedItemsChange = vi.fn();
      render(<Grid options={{ onExpandedItemsChange }} />);
      await focus(row('Documents'));
      await user.keyboard('{ArrowRight}');
      expect(row('Documents')).toHaveAttribute('aria-expanded', 'true');
      expect(row('Documents')).toHaveFocus();
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      await user.keyboard('{ArrowRight}');
      expect(cells('Documents')[0]).toHaveFocus();
      expect(tabStops()).toEqual(['0']);
      expect(cells('Documents')[0]).toHaveAttribute('tabindex', '0');
      expect(row('Documents')).toHaveAttribute('tabindex', '-1');
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
    });

    it('Right on a leaf moves into its first cell', async () => {
      const user = userEvent.setup();
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      await focus(row('README.md'));
      await user.keyboard('{ArrowRight}');
      expect(cells('README.md')[0]).toHaveFocus();
    });

    it('Left collapses an expanded branch; on a collapsed row or a leaf the focus stays (APG)', async () => {
      const user = userEvent.setup();
      const onExpandedItemsChange = vi.fn();
      render(<Grid options={{ defaultExpandedItems: ['docs'], onExpandedItemsChange }} />);
      await focus(row('Work'));
      await user.keyboard('{ArrowLeft}');
      expect(row('Work')).toHaveFocus();
      expect(onExpandedItemsChange).not.toHaveBeenCalled();
      await focus(row('Documents'));
      await user.keyboard('{ArrowLeft}');
      expect(row('Documents')).toHaveAttribute('aria-expanded', 'false');
      expect(row('Documents')).toHaveFocus();
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      await user.keyboard('{ArrowLeft}');
      expect(row('Documents')).toHaveFocus();
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
    });

    it('Enter activates the row and toggles a branch, as in a tree', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      render(<Grid onItemSelect={onItemSelect} />);
      await focus(row('Documents'));
      await user.keyboard('{Enter}');
      expect(onItemSelect).toHaveBeenCalledWith('docs');
      expect(row('Documents')).toHaveAttribute('aria-expanded', 'true');
    });

    it('typeahead moves to the next row that starts with the text', async () => {
      const user = userEvent.setup({ delay: null });
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      await focus(row('Documents'));
      await user.keyboard('read');
      expect(row('README.md')).toHaveFocus();
    });
  });

  describe('keyboard: cells', () => {
    it('Right and Left move between the cells of a row; Left on the first returns to the row; the last stays', async () => {
      const user = userEvent.setup();
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      await focus(row('Notes.txt'));
      await user.keyboard('{ArrowRight}');
      expect(cells('Notes.txt')[0]).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(cells('Notes.txt')[1]).toHaveFocus();
      expect(tabStops()).toEqual(['1']);
      await user.keyboard('{ArrowRight}');
      expect(cells('Notes.txt')[2]).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(cells('Notes.txt')[2]).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(cells('Notes.txt')[0]).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(row('Notes.txt')).toHaveFocus();
      expect(tabStops()).toEqual(['2']);
    });

    it('Down and Up keep the column; Home and End go to the first and last cell of the row; Ctrl+Home and Ctrl+End to the same column of the first and last row', async () => {
      const user = userEvent.setup();
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      await focus(row('Work'));
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(cells('Work')[1]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(cells('Notes.txt')[1]).toHaveFocus();
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(cells('Documents')[1]).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(cells('Documents')[1]).toHaveFocus();
      await user.keyboard('{End}');
      expect(cells('Documents')[2]).toHaveFocus();
      await user.keyboard('{Home}');
      expect(cells('Documents')[0]).toHaveFocus();
      await user.keyboard('{ArrowRight}{Control>}{End}{/Control}');
      expect(cells('README.md')[1]).toHaveFocus();
      await user.keyboard('{Control>}{Home}{/Control}');
      expect(cells('Documents')[1]).toHaveFocus();
    });

    it('Space and Enter in a cell without a control do nothing to the row', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      render(<Grid onItemSelect={onItemSelect} />);
      await focus(row('README.md'));
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(cells('README.md')[1]).toHaveFocus();
      await user.keyboard(' {Enter}*');
      expect(onItemSelect).not.toHaveBeenCalled();
      expect(cells('README.md')[1]).toHaveFocus();
    });

    it('Enter or F2 moves focus to the first control of a cell, and Escape returns to the cell', async () => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      render(<Grid onOpen={onOpen} />);
      await focus(row('README.md'));
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
      expect(cells('README.md')[2]).toHaveFocus();
      await user.keyboard('{Enter}');
      const open = screen.getByRole('button', { name: 'Open README.md' });
      expect(open).toHaveFocus();
      // Its own keys apply: no cell navigation, the Enter reaches the button.
      await user.keyboard('{ArrowLeft}');
      expect(open).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onOpen).toHaveBeenCalledTimes(1);
      await user.keyboard('{Escape}');
      expect(cells('README.md')[2]).toHaveFocus();
      expect(tabStops()).toEqual(['2']);
      await user.keyboard('{F2}');
      expect(open).toHaveFocus();
    });

    it('focus in a control of a cell makes that cell the tab stop; Tab from the control leaves the grid', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Grid />
          <button type="button">After</button>
        </>,
      );
      await focus(screen.getByRole('button', { name: 'Open README.md' }));
      expect(tabStops()).toEqual(['2']);
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('a click on a further cell, or a control in it, never activates the row', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      render(<Grid onItemSelect={onItemSelect} />);
      await user.click(screen.getByRole('button', { name: 'Open Documents' }));
      await user.click(cells('Documents')[1]);
      expect(onItemSelect).not.toHaveBeenCalled();
      expect(row('Documents')).toHaveAttribute('aria-expanded', 'false');
      await user.click(cells('Documents')[0]);
      expect(onItemSelect).toHaveBeenCalledTimes(1);
      expect(row('Documents')).toHaveAttribute('aria-expanded', 'true');
    });

    it('a row with fewer cells keeps the last column', async () => {
      const user = userEvent.setup();
      render(
        <Grid
          options={{ defaultExpandedItems: ['docs'] }}
          renderCells={(r) => (r.item.value === 'work' ? ['--'] : ['a', 'b'])}
        />,
      );
      await focus(row('Documents'));
      await user.keyboard('{ArrowRight}{End}');
      expect(cells('Documents')[2]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(cells('Work')[1]).toHaveFocus();
      expect(tabStops()).toEqual(['1']);
    });

    it('skips disabled rows when moving between rows from a cell', async () => {
      const user = userEvent.setup();
      render(
        <Grid
          items={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta', disabled: true },
            { value: 'c', label: 'Gamma' },
          ]}
        />,
      );
      await focus(row('Alpha'));
      await user.keyboard('{ArrowRight}{ArrowDown}');
      expect(cells('Gamma')[0]).toHaveFocus();
    });

    it('keeps exactly one tab stop through a walk over rows and cells', async () => {
      const user = userEvent.setup();
      render(<Grid options={{ defaultExpandedItems: ['docs'] }} />);
      await user.tab();
      for (const key of [
        '{ArrowRight}',
        '{ArrowRight}',
        '{ArrowDown}',
        '{ArrowLeft}',
        '{ArrowLeft}',
        '{ArrowDown}',
        '{End}',
        '{Home}',
      ]) {
        await user.keyboard(key);
        expect(tabStops()).toHaveLength(1);
      }
    });

    it('a collapse of the branch around the focused cell moves focus to the branch', async () => {
      function Controlled() {
        const [expanded, setExpanded] = React.useState<readonly string[]>(['docs']);
        return (
          <>
            <button type="button" onClick={() => setExpanded([])}>
              Collapse
            </button>
            <Grid options={{ expandedItems: expanded as string[] }} />
          </>
        );
      }
      const user = userEvent.setup();
      render(<Controlled />);
      await focus(row('Work'));
      await user.keyboard('{ArrowRight}');
      expect(cells('Work')[0]).toHaveFocus();
      await act(async () => {
        screen.getByRole('button', { name: 'Collapse' }).click();
      });
      expect(row('Documents')).toHaveFocus();
    });
  });

  describe('right-to-left', () => {
    it('mirrors Right and Left: the "next" arrow is Left', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Grid options={{ defaultExpandedItems: ['docs'] }} />, { dir: 'rtl' });
      await focus(row('README.md'));
      await user.keyboard('{ArrowRight}');
      expect(row('README.md')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(cells('README.md')[0]).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(cells('README.md')[1]).toHaveFocus();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(row('README.md')).toHaveFocus();
      await focus(row('Documents'));
      await user.keyboard('{ArrowRight}');
      expect(row('Documents')).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('callbacks', () => {
    it('StrictMode: onExpandedItemsChange and onItemSelect fire once per change', async () => {
      const user = userEvent.setup();
      const onExpandedItemsChange = vi.fn();
      const onItemSelect = vi.fn();
      render(
        <React.StrictMode>
          <Grid options={{ onExpandedItemsChange }} onItemSelect={onItemSelect} />
        </React.StrictMode>,
      );
      await focus(row('Documents'));
      await user.keyboard('{ArrowRight}');
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      await user.keyboard('{ArrowRight}{ArrowLeft}');
      expect(row('Documents')).toHaveFocus();
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      await user.keyboard('{ArrowLeft}');
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(2);
      await user.click(row('README.md'));
      expect(onItemSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('development warnings', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('warns once that renderCells draws nothing without a treegrid', () => {
      function Plain() {
        const model = useFlatTree(FILES);
        return <FlatTree aria-label="Files" model={model} renderCells={() => ['x']} />;
      }
      const { rerender } = render(<Plain />);
      rerender(<Plain />);
      expect(screen.queryByRole('gridcell')).toBeNull();
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] FlatTree: `renderCells` draws cells in a treegrid only; pass navigationMode="treegrid" (until then no cell is drawn).',
        ],
      ]);
    });

    it('does not warn for a treegrid', () => {
      render(<Grid />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('slotProps.cell', () => {
    it('merges into every further cell and keeps the locked attributes', () => {
      const attempt = {
        className: 'mine',
        style: { width: 120 },
        'data-x': 'y',
        role: 'button',
        tabIndex: 3,
        'data-flat-tree-cell': '9',
        hidden: true,
        inert: true,
        'aria-hidden': true,
      } as const;
      render(<Grid slotProps={{ cell: attempt }} />);
      for (const cell of document.querySelectorAll(`.${flatTreeItemClassNames.cell}`)) {
        expect(cell).toHaveClass(flatTreeItemClassNames.cell, 'mine');
        expect((cell as HTMLElement).style.width).toBe('120px');
        expect(cell).toHaveAttribute('data-x', 'y');
        expect(cell).toHaveAttribute('role', 'gridcell');
        expect(cell).not.toHaveAttribute('hidden');
        expect(cell).not.toHaveAttribute('inert');
        expect(cell).not.toHaveAttribute('aria-hidden');
      }
      const first = cells('Documents')[1];
      expect(first).toHaveAttribute('data-flat-tree-cell', '1');
      expect(first).toHaveAttribute('tabindex', '-1');
    });

    it('a part on the row part cannot take over the cell markers', () => {
      render(
        <Grid
          slotProps={{
            row: { role: 'button', tabIndex: 5, 'data-flat-tree-cell': '4' } as never,
            label: { 'data-flat-tree-cell': '4' } as never,
          }}
        />,
      );
      expect(cells('Documents')[0]).toHaveAttribute('role', 'gridcell');
      expect(cells('Documents')[0]).toHaveAttribute('data-flat-tree-cell', '0');
      expect(cells('Documents')[0]).toHaveAttribute('tabindex', '-1');
      expect(document.querySelectorAll('[data-flat-tree-cell="4"]')).toHaveLength(0);
    });

    it('the part ref reaches the cells and its click is not called while the item is disabled', async () => {
      const user = userEvent.setup();
      const ref = vi.fn();
      const onClick = vi.fn();
      render(
        <Grid
          items={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta', disabled: true },
          ]}
          slotProps={{ cell: { ref, onClick } }}
        />,
      );
      expect(ref).toHaveBeenCalledTimes(4);
      await user.click(cells('Alpha')[1]);
      expect(onClick).toHaveBeenCalledTimes(1);
      fireEvent.click(cells('Beta')[1]);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('changes nothing while the parts are empty: undefined, {} and every part {}', () => {
      expectInertSlotProps(
        (slotProps) => (
          <Grid
            options={{ defaultExpandedItems: ['docs'], selectionMode: 'multiple' }}
            slotProps={slotProps}
          />
        ),
        { row: {}, expandIcon: {}, indicator: {}, label: {}, cell: {} },
      );
    });

    it('takes no children', () => {
      // @ts-expect-error a part takes no `children`: the item draws the content
      render(<Grid slotProps={{ cell: { children: 'x' } }} />);
      expect(cells('Documents')[1]).not.toHaveTextContent('x');
    });

    it('is absent without slotProps and without cells', () => {
      render(<Grid renderCells={() => []} />);
      expect(document.querySelector(`.${flatTreeItemClassNames.cell}`)).toBeNull();
      expect(cells('Documents')).toHaveLength(1);
    });
  });

  it('types: navigationMode and renderCells', () => {
    expectTypeOf<FlatTreeProps['navigationMode']>().toEqualTypeOf<
      'tree' | 'treegrid' | undefined
    >();
    expectTypeOf<NonNullable<FlatTreeProps['renderCells']>>().returns.toEqualTypeOf<
      readonly React.ReactNode[]
    >();
    expectTypeOf<NonNullable<NonNullable<FlatTreeProps['slotProps']>['cell']>>().not.toBeAny();
  });
});
