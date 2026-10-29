import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlatTree, FlatTreeItem } from '../FlatTree';
import type { FlatTreeItemProps, FlatTreeProps } from '../FlatTree';
import { useFlatTree, type FlatTreeModel, type UseFlatTreeOptions } from '../useFlatTree';
import type { FlatTreeItemData } from '../../../lib/flatTree';
import type { CheckState } from '../../../lib/treeCascade';
import { flatTreeClassNames, flatTreeItemClassNames } from '../../../lib/classNames';
import * as Wave from '../../../index';
import { expectNoA11yViolations, expectThrows, renderWithProviders } from '../../../test-utils';

/**
 * docs        Documents
 *   work      Work
 *     report  Annual Report.docx
 *     slides  Presentation.pptx
 *   personal  Personal
 * images      Images
 *   photo     vacation.jpg
 * readme      README.md
 */
const FILES: FlatTreeItemData[] = [
  { value: 'docs', label: 'Documents' },
  { value: 'work', parentValue: 'docs', label: 'Work' },
  { value: 'report', parentValue: 'work', label: 'Annual Report.docx' },
  { value: 'slides', parentValue: 'work', label: 'Presentation.pptx' },
  { value: 'personal', parentValue: 'docs', label: 'Personal' },
  { value: 'images', label: 'Images' },
  { value: 'photo', parentValue: 'images', label: 'vacation.jpg' },
  { value: 'readme', label: 'README.md' },
];

/** {@link FILES} without Images and its photo. */
const WITHOUT_IMAGES = FILES.filter(
  (entry) => entry.value !== 'images' && entry.parentValue !== 'images',
);

type FilesProps = Omit<FlatTreeProps, 'model'> & {
  items?: readonly FlatTreeItemData[];
  options?: UseFlatTreeOptions;
};

/** A FlatTree named "Files" over `items`, with the model's props spread on it. */
function Files({ items = FILES, options, ...props }: FilesProps) {
  const model = useFlatTree(items, options);
  return <FlatTree aria-label="Files" model={model} {...model.getTreeProps()} {...props} />;
}

const tree = () => screen.getByRole('tree');
const treeitems = () => screen.getAllByRole('treeitem');
const item = (name: string) => screen.getByRole('treeitem', { name });
/** The label text of every rendered treeitem, in DOM order. */
const labels = () =>
  treeitems().map((el) => el.querySelector(`.${flatTreeItemClassNames.label}`)?.textContent);
const attr = (name: string) => treeitems().map((el) => el.getAttribute(name));
const tabStops = () => treeitems().filter((el) => el.tabIndex === 0);

async function focus(el: HTMLElement): Promise<void> {
  act(() => el.focus());
  await act(async () => {});
}

describe('FlatTree', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('markup and positions', () => {
    it('renders the visible items as flat treeitem siblings with their level, set size and position', () => {
      render(<Files options={{ defaultExpandedItems: ['docs', 'work'] }} />);
      const root = screen.getByRole('tree', { name: 'Files' });
      expect(root).toHaveClass(flatTreeClassNames.root);
      expect(root).toHaveAttribute('data-selection-mode', 'none');
      expect(root).not.toHaveAttribute('aria-multiselectable');
      expect(screen.queryByRole('group')).toBeNull();
      for (const el of treeitems()) {
        expect(el.parentElement).toBe(root);
        expect(el).toHaveClass(flatTreeItemClassNames.root);
      }
      expect(labels()).toEqual([
        'Documents',
        'Work',
        'Annual Report.docx',
        'Presentation.pptx',
        'Personal',
        'Images',
        'README.md',
      ]);
      expect(attr('aria-level')).toEqual(['1', '2', '3', '3', '2', '1', '1']);
      expect(attr('aria-setsize')).toEqual(['3', '2', '2', '2', '2', '3', '3']);
      expect(attr('aria-posinset')).toEqual(['1', '1', '1', '2', '2', '2', '3']);
      expect(attr('aria-expanded')).toEqual(['true', 'true', null, null, null, 'false', null]);
      expect(attr('data-index')).toEqual(['0', '1', '2', '3', '4', '5', '6']);
      expect(attr('aria-selected')).toEqual([null, null, null, null, null, null, null]);
      expect(attr('aria-checked')).toEqual([null, null, null, null, null, null, null]);
    });

    it('names each item by its label, which is the default content, else its value', () => {
      render(<Files items={[{ value: 'docs', label: 'Documents' }, { value: 'untitled' }]} />);
      expect(item('Documents')).toBeInTheDocument();
      expect(item('untitled')).toBeInTheDocument();
    });

    it('renders the content renderItem returns for each visible row', () => {
      const renderItem = vi.fn((row: FlatTreeModel['visibleItems'][number]) => (
        <strong>{row.item.label?.toUpperCase()}</strong>
      ));
      render(<Files renderItem={renderItem} />);
      expect(item('DOCUMENTS')).toBeInTheDocument();
      expect(within(item('README.MD')).getByText('README.MD').localName).toBe('strong');
      expect(renderItem).toHaveBeenCalledWith(
        expect.objectContaining({ item: FILES[0], level: 1, position: 1, setSize: 3, index: 0 }),
      );
    });

    it('a childless item typed "branch" can expand; a leaf has no aria-expanded and no chevron', async () => {
      const user = userEvent.setup();
      render(
        <Files
          items={[
            { value: 'lazy', label: 'Lazy', itemType: 'branch' },
            { value: 'leaf', label: 'Leaf' },
          ]}
        />,
      );
      expect(item('Lazy')).toHaveAttribute('aria-expanded', 'false');
      expect(item('Lazy').querySelector(`.${flatTreeItemClassNames.expandIcon}`)).not.toBeNull();
      expect(item('Leaf')).not.toHaveAttribute('aria-expanded');
      expect(item('Leaf').querySelector(`.${flatTreeItemClassNames.expandIcon}`)).toBeNull();
      await user.click(item('Lazy'));
      expect(item('Lazy')).toHaveAttribute('aria-expanded', 'true');
    });

    it('indents each level with logical padding and mirrors the collapsed chevron in right to left', () => {
      renderWithProviders(<Files options={{ defaultExpandedItems: ['docs', 'work'] }} />, {
        dir: 'rtl',
      });
      expect(item('Documents').style.paddingInlineStart).toBe('');
      expect(item('Work').style.paddingInlineStart).toBe('1rem');
      expect(item('Annual Report.docx').style.paddingInlineStart).toBe('2rem');
      const collapsed = item('Images').querySelector(`.${flatTreeItemClassNames.expandIcon}`);
      const expanded = item('Documents').querySelector(`.${flatTreeItemClassNames.expandIcon}`);
      expect(collapsed).toHaveClass('wave-rtl:-scale-x-100');
      expect(collapsed?.getAttribute('class')).not.toMatch(/(^|\s)rtl:/);
      expect(expanded).toHaveClass('rotate-90');
      expect(expanded).not.toHaveClass('wave-rtl:-scale-x-100');
    });

    it('puts ref, className and rest props on the role="tree" element', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Files ref={ref} className="custom-tree" data-testid="files" />);
      expect(ref.current).toBe(tree());
      expect(tree()).toHaveClass(flatTreeClassNames.root, 'custom-tree');
      expect(tree().getAttribute('class')?.split(' ')[0]).toBe(flatTreeClassNames.root);
      expect(tree()).toHaveAttribute('data-testid', 'files');
    });

    it('is a compound with the flat name FlatTreeItem, exported from the entry (C-COMPOUND)', () => {
      expect(FlatTreeItem).toBe(FlatTree.Item);
      expect(Wave.FlatTree).toBe(FlatTree);
      expect(Wave.FlatTreeItem).toBe(FlatTreeItem);
      expect(FlatTree.displayName).toBe('FlatTree');
      expect(FlatTree.Item.displayName).toBe('FlatTreeItem');
    });

    it('throws when FlatTree.Item is rendered outside a FlatTree (C-CONTEXT)', () => {
      const row = {
        item: FILES[7],
        level: 1,
        position: 3,
        setSize: 3,
        parentValue: undefined,
        hasChildren: false,
        isBranch: false,
        expanded: false,
        index: 2,
      };
      expectThrows(
        <FlatTree.Item item={row}>README.md</FlatTree.Item>,
        '[WaveUI] FlatTree.Item must be used within <FlatTree>',
      );
    });

    it('types: ref on the props, the model and the row of renderItem (C-REF)', () => {
      expectTypeOf<FlatTreeProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<FlatTreeItemProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLDivElement> | undefined
      >();
      expectTypeOf<FlatTreeProps['model']>().toEqualTypeOf<FlatTreeModel>();
      expectTypeOf<Parameters<NonNullable<FlatTreeProps['renderItem']>>[0]>().toEqualTypeOf<
        FlatTreeModel['visibleItems'][number]
      >();
      expectTypeOf<
        Parameters<NonNullable<FlatTreeProps['renderItem']>>[0]['checked']
      >().toEqualTypeOf<CheckState | undefined>();
    });
  });

  describe('selection', () => {
    it('single mode: aria-selected and a radio on every item, and a click calls onItemSelect', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      render(
        <Files
          options={{ selectionMode: 'single' }}
          selected="images"
          onItemSelect={onItemSelect}
        />,
      );
      expect(tree()).toHaveAttribute('data-selection-mode', 'single');
      expect(tree()).not.toHaveAttribute('aria-multiselectable');
      expect(attr('aria-selected')).toEqual(['false', 'true', 'false']);
      expect(attr('data-selected')).toEqual([null, '', null]);
      for (const el of treeitems()) {
        const radio = el.querySelector(`.${flatTreeItemClassNames.indicator}`);
        expect(radio).toHaveAttribute('aria-hidden', 'true');
      }
      await user.click(item('README.md'));
      expect(onItemSelect).toHaveBeenCalledTimes(1);
      expect(onItemSelect).toHaveBeenCalledWith('readme');
      // `selected` is the consumer's: it changes only through the prop.
      expect(item('Images')).toHaveAttribute('aria-selected', 'true');
    });

    it('selected without a selection mode puts aria-selected on every item and draws no indicator', () => {
      render(<Files selected="readme" />);
      expect(attr('aria-selected')).toEqual(['false', 'false', 'true']);
      expect(tree().querySelector(`.${flatTreeItemClassNames.indicator}`)).toBeNull();
    });

    it('current puts aria-current and data-current on its item', () => {
      render(<Files current="images" />);
      expect(item('Images')).toHaveAttribute('aria-current', 'true');
      expect(item('Images')).toHaveAttribute('data-current', '');
      expect(item('Documents')).not.toHaveAttribute('aria-current');
    });

    it('multiple mode: aria-checked from the cascade, a checkbox per item, and a click on it toggles the check', async () => {
      const user = userEvent.setup();
      const onCheckedItemsChange = vi.fn();
      const onItemSelect = vi.fn();
      render(
        <Files
          options={{
            selectionMode: 'multiple',
            defaultExpandedItems: ['docs'],
            defaultCheckedItems: ['work'],
            onCheckedItemsChange,
          }}
          onItemSelect={onItemSelect}
        />,
      );
      expect(tree()).toHaveAttribute('aria-multiselectable', 'true');
      expect(tree()).toHaveAttribute('data-selection-mode', 'multiple');
      expect(labels()).toEqual(['Documents', 'Work', 'Personal', 'Images', 'README.md']);
      expect(attr('aria-checked')).toEqual(['mixed', 'true', 'false', 'false', 'false']);
      expect(attr('data-checked')).toEqual([null, '', null, null, null]);
      expect(attr('data-mixed')).toEqual(['', null, null, null, null]);
      expect(attr('aria-selected')).toEqual([null, null, null, null, null]);

      const checkbox = within(item('Personal')).getByRole('checkbox', { name: 'Personal' });
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(checkbox).toHaveAttribute('tabindex', '-1');
      expect(checkbox).toHaveClass(flatTreeItemClassNames.indicator);
      await user.click(checkbox);
      expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
      expect(onCheckedItemsChange).toHaveBeenCalledWith(
        ['docs', 'work', 'report', 'slides', 'personal'],
        { value: 'personal', checked: true, event: expect.any(MouseEvent) },
      );
      expect(attr('aria-checked')).toEqual(['true', 'true', 'true', 'false', 'false']);
      // The checkbox gives its press to the item: focus is on the treeitem, nothing is activated.
      expect(item('Personal')).toHaveFocus();
      expect(onItemSelect).not.toHaveBeenCalled();
    });

    it('multiple mode: Space toggles the focused item’s check, Enter activates it', async () => {
      const user = userEvent.setup();
      const onCheckedItemsChange = vi.fn();
      const onItemSelect = vi.fn();
      render(
        <Files
          options={{ selectionMode: 'multiple', onCheckedItemsChange }}
          onItemSelect={onItemSelect}
        />,
      );
      await user.tab();
      await user.keyboard(' ');
      expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
      expect(onCheckedItemsChange).toHaveBeenCalledWith(
        ['docs', 'work', 'report', 'slides', 'personal'],
        { value: 'docs', checked: true, event: expect.any(KeyboardEvent) },
      );
      expect(onItemSelect).not.toHaveBeenCalled();
      await user.keyboard('{Enter}');
      expect(onItemSelect).toHaveBeenCalledWith('docs');
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
      expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyboard', () => {
    it('ArrowDown and ArrowUp move through the visible items, Home and End to the first and last', async () => {
      const user = userEvent.setup();
      render(<Files options={{ defaultExpandedItems: ['docs'] }} />);
      await user.tab();
      expect(item('Documents')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(item('Documents')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('Work')).toHaveFocus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(item('Images')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(item('Personal')).toHaveFocus();
      await user.keyboard('{End}');
      expect(item('README.md')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('README.md')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(item('Documents')).toHaveFocus();
    });

    it('ArrowRight expands a collapsed branch and keeps focus, then moves to its first child; on a leaf it does nothing', async () => {
      const user = userEvent.setup();
      const onExpandedItemsChange = vi.fn();
      render(<Files options={{ defaultExpandedItems: ['docs'], onExpandedItemsChange }} />);
      await focus(item('Work'));
      await user.keyboard('{ArrowRight}');
      expect(item('Work')).toHaveAttribute('aria-expanded', 'true');
      expect(item('Work')).toHaveFocus();
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      expect(onExpandedItemsChange).toHaveBeenCalledWith(['docs', 'work']);
      await user.keyboard('{ArrowRight}');
      expect(item('Annual Report.docx')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(item('Annual Report.docx')).toHaveFocus();
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
    });

    it('ArrowLeft collapses an expanded branch, else moves to the parent', async () => {
      const user = userEvent.setup();
      render(<Files options={{ defaultExpandedItems: ['docs', 'work'] }} />);
      await focus(item('Annual Report.docx'));
      await user.keyboard('{ArrowLeft}');
      expect(item('Work')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(item('Work')).toHaveAttribute('aria-expanded', 'false');
      expect(item('Work')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(item('Documents')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
      await user.keyboard('{ArrowLeft}');
      expect(item('Documents')).toHaveFocus();
      expect(labels()).toEqual(['Documents', 'Images', 'README.md']);
    });

    it('right to left: ArrowLeft expands and moves into a branch, ArrowRight collapses and moves to the parent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Files options={{ defaultExpandedItems: ['docs'] }} />, { dir: 'rtl' });
      await focus(item('Work'));
      await user.keyboard('{ArrowLeft}');
      expect(item('Work')).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{ArrowLeft}');
      expect(item('Annual Report.docx')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(item('Work')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(item('Work')).toHaveAttribute('aria-expanded', 'false');
    });

    it('* expands every collapsed sibling branch in one change', async () => {
      const user = userEvent.setup();
      const onExpandedItemsChange = vi.fn();
      render(<Files options={{ onExpandedItemsChange }} />);
      await user.tab();
      await user.keyboard('*');
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      expect(onExpandedItemsChange).toHaveBeenCalledWith(['docs', 'images']);
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
      expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
      expect(item('Documents')).toHaveFocus();
    });

    it('Enter and Space activate: a branch toggles, and onItemSelect is called every time', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      render(<Files onItemSelect={onItemSelect} />);
      await focus(item('Images'));
      await user.keyboard('{Enter}');
      expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard(' ');
      expect(item('Images')).toHaveAttribute('aria-expanded', 'false');
      await user.keyboard('{End}{Enter}{Enter}');
      expect(onItemSelect.mock.calls).toEqual([['images'], ['images'], ['readme'], ['readme']]);
    });

    it('typeahead moves to the next visible item whose label starts with the typed text', async () => {
      const user = userEvent.setup();
      render(<Files options={{ defaultExpandedItems: ['docs'] }} />);
      await user.tab();
      await user.keyboard('p');
      expect(item('Personal')).toHaveFocus();
    });

    it('typeahead skips items under a collapsed branch', async () => {
      const user = userEvent.setup();
      render(<Files />);
      await user.tab();
      // "vacation.jpg" is under the collapsed Images: no visible item starts with "v".
      await user.keyboard('v');
      expect(item('Documents')).toHaveFocus();
    });

    it('a consumer onKeyDown that calls preventDefault() skips the built-in key', async () => {
      const user = userEvent.setup();
      render(
        <Files
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') event.preventDefault();
          }}
        />,
      );
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(item('Documents')).toHaveFocus();
    });
  });

  describe('the tab stop', () => {
    it('is the first visible item, and only one item is a tab stop', () => {
      render(<Files />);
      expect(tabStops()).toEqual([item('Documents')]);
    });

    it('is the selected item while it is visible', () => {
      render(<Files options={{ selectionMode: 'single' }} selected="images" />);
      expect(tabStops()).toEqual([item('Images')]);
    });

    it('falls back to the first visible item when the selected item is under a collapsed branch', () => {
      render(<Files options={{ selectionMode: 'single' }} selected="photo" />);
      expect(screen.queryByRole('treeitem', { name: 'vacation.jpg' })).toBeNull();
      expect(tabStops()).toEqual([item('Documents')]);
    });

    it('follows focus while focus is inside, and returns to the selected item once focus leaves; Tab leaves the tree', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Files options={{ selectionMode: 'single' }} selected="readme" />
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      expect(item('README.md')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(tabStops()).toEqual([item('Documents')]);
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(tabStops()).toEqual([item('README.md')]);
      await user.tab({ shift: true });
      expect(item('README.md')).toHaveFocus();
    });

    it('moves focus to the collapsed branch when a branch collapses around the focused item', async () => {
      function Controlled() {
        const [expandedItems, setExpandedItems] = React.useState<readonly string[]>([
          'docs',
          'work',
        ]);
        return (
          <>
            <Files options={{ expandedItems, onExpandedItemsChange: setExpandedItems }} />
            <button type="button" onClick={() => setExpandedItems(['work'])}>
              Collapse
            </button>
          </>
        );
      }
      render(<Controlled />);
      await focus(item('Presentation.pptx'));
      // Collapsed from code while the item has focus (a click would move focus to the button).
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
      });
      await act(async () => {});
      expect(labels()).toEqual(['Documents', 'Images', 'README.md']);
      expect(item('Documents')).toHaveFocus();
      expect(tabStops()).toEqual([item('Documents')]);
    });

    it('moves focus to the item now at the focused place when new items leave the focused one out', async () => {
      const { rerender } = render(<Files />);
      await focus(item('Images'));
      rerender(<Files items={WITHOUT_IMAGES} />);
      await act(async () => {});
      expect(labels()).toEqual(['Documents', 'README.md']);
      expect(item('README.md')).toHaveFocus();
      expect(tabStops()).toEqual([item('README.md')]);
    });

    it('does not take focus back when the focused item goes while focus is elsewhere', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <>
          <Files />
          <button type="button">After</button>
        </>,
      );
      await focus(item('Images'));
      await user.click(screen.getByRole('button', { name: 'After' }));
      rerender(
        <>
          <Files items={WITHOUT_IMAGES} />
          <button type="button">After</button>
        </>,
      );
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(tabStops()).toEqual([item('Documents')]);
    });
  });

  describe('disabled items', () => {
    const ITEMS: FlatTreeItemData[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', disabled: true },
      { value: 'c', label: 'Gamma' },
      { value: 'd', label: 'Delta', itemType: 'branch', disabled: true },
    ];

    it('carry aria-disabled and data-disabled and are skipped by the arrow keys, Home, End and typeahead', async () => {
      const user = userEvent.setup();
      render(<Files items={ITEMS} />);
      expect(item('Beta')).toHaveAttribute('aria-disabled', 'true');
      expect(item('Beta')).toHaveAttribute('data-disabled', '');
      expect(item('Alpha')).not.toHaveAttribute('aria-disabled');
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(item('Gamma')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('Gamma')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(item('Alpha')).toHaveFocus();
      await user.keyboard('{End}');
      expect(item('Gamma')).toHaveFocus();
      await user.keyboard('{Home}b');
      expect(item('Alpha')).toHaveFocus();
    });

    it('are not activated, expanded or checked by a click', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      const onCheckedItemsChange = vi.fn();
      render(
        <Files
          items={ITEMS}
          options={{ selectionMode: 'multiple', onCheckedItemsChange }}
          onItemSelect={onItemSelect}
        />,
      );
      await user.click(item('Delta'));
      expect(item('Delta')).toHaveAttribute('aria-expanded', 'false');
      await user.click(within(item('Beta')).getByRole('checkbox'));
      expect(within(item('Beta')).getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
      expect(item('Beta')).toHaveAttribute('aria-checked', 'false');
      expect(onItemSelect).not.toHaveBeenCalled();
      expect(onCheckedItemsChange).not.toHaveBeenCalled();
    });

    it('are never the tab stop: the first enabled visible item is', () => {
      render(
        <Files
          items={[{ value: 'b', label: 'Beta', disabled: true }, ...ITEMS.slice(0, 1)]}
          options={{ selectionMode: 'single' }}
          selected="b"
        />,
      );
      expect(tabStops()).toEqual([item('Alpha')]);
    });
  });

  describe('callbacks', () => {
    it('StrictMode: onItemSelect, onExpandedItemsChange and onCheckedItemsChange fire once per change', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      const onExpandedItemsChange = vi.fn();
      const onCheckedItemsChange = vi.fn();
      render(
        <React.StrictMode>
          <Files
            options={{ selectionMode: 'multiple', onExpandedItemsChange, onCheckedItemsChange }}
            onItemSelect={onItemSelect}
          />
        </React.StrictMode>,
      );
      await user.click(item('README.md'));
      expect(onItemSelect).toHaveBeenCalledTimes(1);
      await user.keyboard('{Home}{ArrowRight}');
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      await user.click(within(item('Images')).getByRole('checkbox'));
      expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('development warnings', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('warns once when the tree has no accessible name', () => {
      function Unnamed() {
        const model = useFlatTree(FILES);
        return <FlatTree model={model} />;
      }
      const { rerender } = render(<Unnamed />);
      rerender(<Unnamed />);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] FlatTree: a tree needs an accessible name. Pass `aria-label` or `aria-labelledby`.',
        ],
      ]);
    });

    it('does not warn for a named tree', () => {
      render(
        <>
          <span id="files-label">Files</span>
          <Files aria-label={undefined} aria-labelledby="files-label" />
        </>,
      );
      expect(screen.getByRole('tree', { name: 'Files' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns once when selectionMode="multiple" is given with a model that has no check states', () => {
      function Mismatch() {
        const model = useFlatTree(FILES);
        return <FlatTree aria-label="Files" model={model} selectionMode="multiple" />;
      }
      render(<Mismatch />);
      expect(attr('aria-checked')).toEqual(['false', 'false', 'false']);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] FlatTree: selectionMode="multiple" needs a model that holds the check states: pass `selectionMode: \'multiple\'` to `useFlatTree` as well; until then every item shows unchecked.',
        ],
      ]);
    });

    it('warns as the nested Tree does about selected with multiple and single without selected', () => {
      const { unmount } = render(<Files options={{ selectionMode: 'multiple' }} selected="docs" />);
      expect(attr('aria-selected')).toEqual([null, null, null]);
      unmount();
      render(<Files options={{ selectionMode: 'single' }} />);
      expect(attr('aria-selected')).toEqual(['false', 'false', 'false']);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] FlatTree: `selected` has no effect with selectionMode="multiple"; use the model\'s `checkedItems`, and `current` for the item the user is on.',
        ],
        [
          '[WaveUI] FlatTree: selectionMode="single" draws a radio on every item for `selected`; pass `selected` (null while nothing is selected) and update it from `onItemSelect`.',
        ],
      ]);
    });
  });

  it('passes axe in every selection mode', async () => {
    const { unmount } = render(
      <Files options={{ defaultExpandedItems: ['docs'] }} current="work" />,
    );
    await expectNoA11yViolations();
    unmount();
    const second = render(<Files options={{ selectionMode: 'single' }} selected="images" />);
    await expectNoA11yViolations();
    second.unmount();
    render(
      <Files
        options={{
          selectionMode: 'multiple',
          defaultExpandedItems: ['docs'],
          defaultCheckedItems: ['work'],
        }}
      />,
    );
    await expectNoA11yViolations();
  });
});
