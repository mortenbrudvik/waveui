import * as React from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, TreeItem, type TreeProps, type TreeItemProps } from '../Tree';
import { treeItemClassNames } from '../../../lib/classNames';
import type { Slot } from '../../../lib/types';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testSystemProps,
  testCompoundExposure,
  testComposedHandler,
  testDisplayName,
  expectThrows,
} from '../../../test-utils';

/**
 * docs
 *   work
 *     report (leaf)
 *   personal (leaf)
 * images
 *   photo (leaf)
 * readme (leaf)
 */
const fileTree = (
  <>
    <Tree.Item value="docs">
      Documents
      <Tree.Item value="work">
        Work
        <Tree.Item value="report">Report.docx</Tree.Item>
      </Tree.Item>
      <Tree.Item value="personal">Personal.txt</Tree.Item>
    </Tree.Item>
    <Tree.Item value="images">
      Images
      <Tree.Item value="photo">Photo.jpg</Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme">Readme.md</Tree.Item>
  </>
);

/** A treeitem by its exact accessible name (its own label, without its icon or nested items). */
const item = (name: string) => screen.getByRole('treeitem', { name });

/**
 * Icons that render nothing: `icon={name && <Icon />}` with `name` '' or a count of 0, and a list
 * mapped to nothing (F2 `slotRendersContent`). A factory each, since a generator is one-shot.
 */
const EMPTY_ICONS = [
  ["''", () => ''],
  ['0', () => 0],
  ['an empty array', () => []],
  ['an array of empty items', () => [null, false, '', [undefined]]],
  [
    'a generator of empty items',
    function* emptyItems() {
      yield null;
      yield '';
    },
  ],
] as Array<[string, () => Slot<'span'>]>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** The `[WaveUI]` warnings logged so far (asserted, never silenced). */
const warnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.map(([message]) => String(message));

describe('Tree', () => {
  testSystemProps(Tree, {
    expectedTag: 'div',
    displayName: 'Tree',
    defaultProps: { 'aria-label': 'Files', children: fileTree },
    a11yVariants: [
      { name: 'expanded tree', props: { defaultExpandedItems: ['docs', 'work', 'images'] } },
      {
        name: 'selected and current items',
        props: { defaultExpandedItems: ['docs'], selected: 'personal', current: 'personal' },
      },
    ],
  });

  testCompoundExposure(Tree, ['Item', 'ItemPersonaLayout']);
  testDisplayName(Tree.Item, 'TreeItem');

  it('exports Tree.Item under its flat name (C-COMPOUND)', () => {
    expect(TreeItem).toBe(Tree.Item);
  });

  it('renders with role=tree and tree items', () => {
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    const tree = screen.getByRole('tree', { name: 'Files' });
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(3);
  });

  it('renders data-selection-mode="none" by default, and no aria-multiselectable (C-CLASS)', () => {
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    const tree = screen.getByRole('tree', { name: 'Files' });
    expect(tree).toHaveAttribute('data-selection-mode', 'none');
    expect(tree).not.toHaveAttribute('aria-multiselectable');
  });

  it('expands nested items on click', async () => {
    const user = userEvent.setup();
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    expect(screen.queryByText('Work')).toBeNull();
    await user.click(screen.getByText('Documents'));
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses nested items on second click', async () => {
    const user = userEvent.setup();
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    await user.click(screen.getByText('Documents'));
    expect(screen.getByText('Work')).toBeInTheDocument();
    await user.click(screen.getByText('Documents'));
    expect(screen.queryByText('Work')).toBeNull();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports defaultExpandedItems', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        {fileTree}
      </Tree>,
    );
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('sets aria-expanded only on expandable items', () => {
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Readme.md')).not.toHaveAttribute('aria-expanded');
  });

  it('leaf prevents an item from being expandable', () => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="a" leaf>
          Leaf
          <Tree.Item value="b">Hidden child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(item('Leaf')).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByText('Hidden child')).toBeNull();
  });

  it('merges custom className and spreads rest props on the root', () => {
    render(
      <Tree className="my-class" data-testid="tree" aria-label="file tree">
        <Tree.Item value="a">Item</Tree.Item>
      </Tree>,
    );
    const tree = screen.getByTestId('tree');
    expect(tree).toHaveClass('my-class', 'text-body-1');
    expect(tree).toHaveAttribute('aria-label', 'file tree');
  });

  it('throws when Tree.Item is used outside a Tree (C-CONTEXT)', () => {
    expectThrows(
      <Tree.Item value="a">Orphan</Tree.Item>,
      '[WaveUI] Tree.Item must be used within <Tree>',
    );
  });

  it('in production, a Tree.Item outside a Tree logs once and renders inertly (C-CONTEXT)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<Tree.Item value="a">Orphan</Tree.Item>);
    rerender(
      <>
        <Tree.Item value="a">Orphan</Tree.Item>
        <Tree.Item value="b">Second orphan</Tree.Item>
      </>,
    );
    expect(screen.getByText('Second orphan')).toBeInTheDocument();
    expect(error.mock.calls).toEqual([['[WaveUI] Tree.Item must be used within <Tree>']]);
  });

  it('types ref on the Props interfaces (C-REF)', () => {
    expectTypeOf<TreeProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<TreeItemProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });

  it('accepts readonly expanded lists and emits a mutable one (C-NAMING)', async () => {
    expectTypeOf<TreeProps['expandedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TreeProps['defaultExpandedItems']>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<NonNullable<TreeProps['onExpandedItemsChange']>>()
      .parameter(0)
      .toEqualTypeOf<string[]>();
    const user = userEvent.setup();
    const expanded = ['docs'] as const;
    const onExpandedItemsChange = vi.fn();
    const { unmount } = render(
      <Tree
        aria-label="Files"
        expandedItems={expanded}
        onExpandedItemsChange={onExpandedItemsChange}
      >
        {fileTree}
      </Tree>,
    );
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('Images'));
    expect(onExpandedItemsChange).toHaveBeenCalledWith(['docs', 'images']);
    expect(Object.isFrozen(onExpandedItemsChange.mock.calls[0][0])).toBe(false);
    unmount();
    render(
      <Tree aria-label="Files" defaultExpandedItems={['images'] as const}>
        {fileTree}
      </Tree>,
    );
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
  });

  it('Tree.Item written in a Server Component (a lazy type) renders the same server HTML and behaves the same (C-COMPOUND)', async () => {
    const user = userEvent.setup();
    const LazyItem = asClientReference(Tree.Item);
    const files = (Item: typeof Tree.Item) => (
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Item value="docs">
          Documents
          <>
            <Item value="work">Work</Item>
          </>
        </Item>
        <Item value="readme">Readme.md</Item>
      </Tree>
    );
    const plain = renderToString(files(Tree.Item));
    expect(plain).toMatch(/role="group"/);
    expect(renderToString(files(LazyItem))).toBe(plain);

    render(files(LazyItem));
    const docs = item('Documents');
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    expect(within(within(docs).getByRole('group')).getByRole('treeitem')).toBe(item('Work'));
    act(() => docs.focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Work')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(docs).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(docs).toHaveAttribute('aria-expanded', 'false');
  });

  it('a nested Tree written in a Server Component (a lazy type) forms the child group of its item', async () => {
    const LazyTree = asClientReference(Tree);
    const files = (NestedTree: typeof Tree) => (
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Tree.Item value="docs">
          Documents
          <NestedTree aria-label="Documents">
            <Tree.Item value="work">Work</Tree.Item>
          </NestedTree>
        </Tree.Item>
        <Tree.Item value="readme">Readme.md</Tree.Item>
      </Tree>
    );
    const plain = renderToString(files(Tree));
    expect(plain).toMatch(/role="group"/);
    expect(renderToString(files(LazyTree))).toBe(plain);

    render(files(LazyTree));
    // The roving stores observe the mounted items (a MutationObserver): let them settle.
    await act(async () => {});
    // The nested Tree is the item's child group, not part of its label (its name stays
    // "Documents").
    const docs = item('Documents');
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    const group = within(docs).getByRole('group');
    expect(within(group).getByRole('tree', { name: 'Documents' })).toContainElement(item('Work'));
  });

  it('warns once per value shared by several items (C-DEV)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const duplicated = (
      <Tree aria-label="Files">
        <Tree.Item value="a">First</Tree.Item>
        <Tree.Item value="a">Copy</Tree.Item>
        <Tree.Item value="b">Second</Tree.Item>
        <Tree.Item value="b">Second copy</Tree.Item>
      </Tree>
    );
    const { rerender } = render(duplicated);
    rerender(duplicated);
    const duplicate = (value: string) =>
      `[WaveUI] Tree: several items share the value "${value}". Item values must be unique ` +
      'within a Tree; items with the same value share their expanded, selected and focus state.';
    expect(warnings(warn)).toEqual([duplicate('a'), duplicate('b')]);
  });

  it('does not warn about values in StrictMode, when keyed items are reordered or when an item is replaced (C-DEV)', async () => {
    const warn = vi.spyOn(console, 'warn');
    const renderItems = (values: string[]) => (
      <React.StrictMode>
        <Tree aria-label="Files">
          {values.map((value) => (
            <Tree.Item key={value} value={value.replace('-new', '')}>
              {value}
            </Tree.Item>
          ))}
        </Tree>
      </React.StrictMode>
    );
    const { rerender } = render(renderItems(['a', 'b', 'c']));
    // Async act: the roving store sees the moved items through a MutationObserver (a microtask).
    await act(async () => rerender(renderItems(['c', 'a', 'b'])));
    // A new element (another key) takes over the value of the one it replaces.
    await act(async () => rerender(renderItems(['c', 'a-new', 'b'])));
    expect(screen.getAllByRole('treeitem')).toHaveLength(3);
    expect(warn).not.toHaveBeenCalled();
  });

  it('re-rendering the Tree with unchanged state and inline callbacks does not re-render memoized items (table-core#25)', () => {
    const onRender = vi.fn();
    const Items = React.memo(function Items() {
      return (
        <React.Profiler id="items" onRender={onRender}>
          <Tree.Item value="docs">
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
          <Tree.Item value="readme">README.md</Tree.Item>
        </React.Profiler>
      );
    });
    function Host({ tick }: { tick: number }) {
      return (
        <Tree
          aria-label="Files"
          data-tick={tick}
          defaultExpandedItems={['docs']}
          selected="readme"
          current="readme"
          onItemSelect={() => {}}
          onExpandedItemsChange={() => {}}
        >
          <Items />
        </Tree>
      );
    }
    const { rerender } = render(<Host tick={0} />);
    expect(screen.getByRole('treeitem', { name: 'Work' })).toBeInTheDocument();
    const initial = onRender.mock.calls.length;
    rerender(<Host tick={1} />);
    rerender(<Host tick={2} />);
    expect(screen.getByRole('tree')).toHaveAttribute('data-tick', '2');
    expect(onRender.mock.calls.length).toBe(initial);
  });
});

describe('Tree.Item - treeitem element (layout#30)', () => {
  it('puts ref, className and rest props on the role="treeitem" element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Tree aria-label="Files">
        <Tree.Item
          ref={ref}
          value="a"
          className="custom-item"
          data-testid="item-a"
          aria-describedby="hint"
        >
          Item A
        </Tree.Item>
        <span id="hint">Hint</span>
      </Tree>,
    );
    const treeitem = item('Item A');
    expect(ref.current).toBe(treeitem);
    expect(treeitem.tagName).toBe('DIV');
    expect(treeitem).toHaveAttribute('data-testid', 'item-a');
    expect(treeitem).toHaveClass('custom-item');
    expect(treeitem).toHaveAccessibleDescription('Hint');
  });

  it('nests the child group inside its treeitem', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        {fileTree}
      </Tree>,
    );
    const parent = item('Documents');
    const group = within(parent).getByRole('group');
    // The group sits in its collapse element (0.15), a child of the treeitem.
    expect(group.parentElement).toHaveClass(treeItemClassNames.collapse);
    expect(group.parentElement?.parentElement).toBe(parent);
    expect(within(group).getByRole('treeitem', { name: 'Work' })).toBeInTheDocument();
  });

  it('names an expanded parent by its own label, not by its nested items or icon', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs', 'work']}>
        <Tree.Item value="docs" icon="📁">
          <span>Documents</span>
          <Tree.Item value="work">
            Work
            <Tree.Item value="report">Report.docx</Tree.Item>
          </Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    const docs = screen.getByRole('treeitem', { expanded: true, name: 'Documents' });
    expect(docs).toHaveAccessibleName('Documents');
    expect(within(docs).getByRole('treeitem', { expanded: true })).toHaveAccessibleName('Work');
    expect(screen.getByRole('treeitem', { name: 'Report.docx' })).toBeInTheDocument();
  });

  it('a consumer aria-label or aria-labelledby names the treeitem', () => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="a" aria-label="Custom name">
          Visible label
        </Tree.Item>
        <Tree.Item value="b" aria-labelledby="external">
          Other label
        </Tree.Item>
        <span id="external">External name</span>
      </Tree>,
    );
    expect(screen.getByRole('treeitem', { name: 'Custom name' })).not.toHaveAttribute(
      'aria-labelledby',
    );
    expect(screen.getByRole('treeitem', { name: 'External name' })).toHaveAttribute(
      'aria-labelledby',
      'external',
    );
  });

  it('an aria-labelledby forwarded as undefined keeps the label name', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['parent']}>
        <Tree.Item value="parent" aria-labelledby={undefined}>
          Parent
          <Tree.Item value="child">Child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('treeitem', { expanded: true })).toHaveAccessibleName('Parent');
  });

  it("a parent's onClick and onKeyDown do not receive events of its child items", async () => {
    const user = userEvent.setup();
    const onParentClick = vi.fn();
    const onParentKeyDown = vi.fn();
    const onChildClick = vi.fn();
    render(
      <Tree aria-label="Files" defaultExpandedItems={['parent']}>
        <Tree.Item value="parent" onClick={onParentClick} onKeyDown={onParentKeyDown}>
          Parent
          <Tree.Item value="child" onClick={onChildClick}>
            Child
          </Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(screen.getByText('Child'));
    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
    act(() => item('Child').focus());
    await user.keyboard('{Enter}');
    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(item('Parent')).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('Parent'));
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  describe('consumer onKeyDown', () => {
    it('receives the keys pressed on its item, and the built-in behaviour still runs', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      const onItemSelect = vi.fn();
      render(
        <Tree aria-label="Files" onItemSelect={onItemSelect}>
          <Tree.Item value="docs" onKeyDown={onKeyDown}>
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
        </Tree>,
      );
      act(() => item('Documents').focus());
      await user.keyboard('{Enter}');
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onKeyDown.mock.calls[0][0]).toMatchObject({ key: 'Enter' });
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
      expect(onItemSelect.mock.calls).toEqual([['docs']]);
    });

    it('calling preventDefault() skips the built-in behaviour for that key only (rename on Enter)', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      const startRename = vi.fn();
      render(
        <Tree aria-label="Files" onItemSelect={onItemSelect}>
          <Tree.Item
            value="docs"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              startRename();
            }}
          >
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
        </Tree>,
      );
      act(() => item('Documents').focus());
      await user.keyboard('{Enter}');
      expect(startRename).toHaveBeenCalledTimes(1);
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
      expect(onItemSelect).not.toHaveBeenCalled();
      await user.keyboard('{ArrowRight}');
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    });

    it.each<[string, { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }]>([
      ['Ctrl+Enter', { key: 'Enter', ctrlKey: true }],
      ['Alt+Enter', { key: 'Enter', altKey: true }],
      ['Meta+Space', { key: ' ', metaKey: true }],
      ['Alt+ArrowRight', { key: 'ArrowRight', altKey: true }],
      ['Alt+ArrowLeft (the browser Back shortcut)', { key: 'ArrowLeft', altKey: true }],
      ['Ctrl+*', { key: '*', ctrlKey: true }],
      ['Ctrl+Alt+Space (AltGr)', { key: ' ', ctrlKey: true, altKey: true }],
      ['Ctrl+Alt+* (AltGr)', { key: '*', ctrlKey: true, altKey: true }],
    ])('%s is left to the browser: no activation, expansion, collapse or move', (_name, init) => {
      const onItemSelect = vi.fn();
      const onKeyDown = vi.fn();
      render(
        <Tree aria-label="Files" defaultExpandedItems={['docs']} onItemSelect={onItemSelect}>
          <Tree.Item value="docs" onKeyDown={onKeyDown}>
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
          <Tree.Item value="images">
            Images
            <Tree.Item value="photo">Photo.jpg</Tree.Item>
          </Tree.Item>
        </Tree>,
      );
      act(() => item('Documents').focus());
      expect(fireEvent.keyDown(item('Documents'), init)).toBe(true);
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onItemSelect).not.toHaveBeenCalled();
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
      expect(item('Images')).toHaveAttribute('aria-expanded', 'false');
      expect(item('Documents')).toHaveFocus();
    });
  });

  it("a click in an expanded parent's child group (the indentation gutter) does not activate the parent", async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    const onDocsClick = vi.fn();
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']} onItemSelect={onItemSelect}>
        <Tree.Item value="docs" onClick={onDocsClick}>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
          <Tree.Item value="personal">Personal.txt</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(screen.getByRole('group'));
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(onDocsClick).not.toHaveBeenCalled();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    // A click on the treeitem element itself (not on its child group) still activates it.
    await user.click(item('Documents'));
    expect(onDocsClick).toHaveBeenCalledTimes(1);
    expect(onItemSelect.mock.calls).toEqual([['docs']]);
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
  });

  it('a consumer onClick that calls preventDefault keeps the item as it is', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files">
        <Tree.Item value="parent" onClick={(event) => event.preventDefault()}>
          Parent
          <Tree.Item value="child">Child</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(screen.getByText('Parent'));
    expect(item('Parent')).toHaveAttribute('aria-expanded', 'false');
  });

  it('onItemSelect fires on every activation (click, Enter, Space), for leaf and parent items', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    render(
      <Tree aria-label="Files" onItemSelect={onItemSelect}>
        {fileTree}
      </Tree>,
    );
    await user.click(screen.getByText('Readme.md'));
    await user.click(screen.getByText('Readme.md'));
    expect(onItemSelect.mock.calls).toEqual([['readme'], ['readme']]);
    act(() => item('Documents').focus());
    await user.keyboard('{Enter}');
    expect(onItemSelect).toHaveBeenLastCalledWith('docs');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(onItemSelect).toHaveBeenCalledTimes(4);
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
  });

  it('selected and current put aria-selected and aria-current on the treeitems', () => {
    render(
      <Tree aria-label="Files" selected="readme" current="images">
        {fileTree}
      </Tree>,
    );
    expect(item('Readme.md')).toHaveAttribute('aria-selected', 'true');
    expect(item('Documents')).toHaveAttribute('aria-selected', 'false');
    expect(item('Images')).toHaveAttribute('aria-current', 'true');
    expect(item('Readme.md')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('treeitem', { selected: true })).toBe(item('Readme.md'));
  });

  it('without selected, no aria-selected is rendered', () => {
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    expect(item('Readme.md')).not.toHaveAttribute('aria-selected');
  });

  it('selected={null} (a controlled tree with nothing selected yet) puts aria-selected="false" on every item', () => {
    render(
      <Tree aria-label="Files" selected={null} defaultExpandedItems={['docs']}>
        {fileTree}
      </Tree>,
    );
    const items = screen.getAllByRole('treeitem');
    expect(items).toHaveLength(5);
    for (const treeitem of items) {
      expect(treeitem).toHaveAttribute('aria-selected', 'false');
      expect(treeitem).not.toHaveAttribute('data-selected');
    }
    // Nothing is selected, so keyboard focus enters at the first item.
    expect(items.filter((el) => el.tabIndex === 0)).toEqual([item('Documents')]);
  });

  it('renders the icon slot hidden from assistive technology (data-display#31)', () => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="a" icon={<span data-testid="icon">IC</span>}>
          Item
        </Tree.Item>
        <Tree.Item value="b" icon={{ className: 'custom-icon', children: 'OB' }}>
          Object slot
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    const objectIcon = screen.getByText('OB');
    expect(objectIcon).toHaveClass('custom-icon', 'shrink-0');
    expect(objectIcon).toHaveAttribute('aria-hidden', 'true');
    expect(item('Item')).toHaveAccessibleName('Item');
    expect(item('Object slot')).toHaveAccessibleName('Object slot');
  });

  // An icon that renders nothing is no icon, as in 0.4 (`{icon && …}`) and as in Avatar: no empty
  // span, so the row has no extra gap.
  it.each(EMPTY_ICONS)('renders no icon span for an icon set to %s', (_kind, makeIcon) => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="plain">Plain</Tree.Item>
        <Tree.Item value="empty" icon={makeIcon()}>
          Empty
        </Tree.Item>
      </Tree>,
    );
    const row = (name: string) => item(name).querySelector('[data-tree-label]')!.parentElement!;
    expect(row('Empty').children).toHaveLength(row('Plain').children.length);
    expect(row('Empty').textContent).toBe('Empty');
  });

  it('renders the items of a generator icon that has content (the check does not consume it)', () => {
    function* glyphs() {
      yield null;
      yield <svg key="glyph" data-testid="glyph" />;
    }
    render(
      <Tree aria-label="Files">
        <Tree.Item value="a" icon={glyphs()}>
          Item
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByTestId('glyph').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Tree.Item - nested items rendered by a component', () => {
  interface FileNode {
    id: string;
    name: string;
    children?: FileNode[];
  }
  const data: FileNode[] = [
    { id: 'docs', name: 'Documents', children: [{ id: 'work', name: 'Work' }] },
    { id: 'readme', name: 'Readme.md' },
  ];

  it('warns once in development when a Tree.Item ends up inside the label of another item', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A recursive component: the parent cannot see the Tree.Item that NodeView renders, so the
    // nested item lands in the parent's label instead of its child group.
    function NodeView({ node }: { node: FileNode }) {
      return (
        <Tree.Item value={node.id}>
          {node.name}
          {node.children?.map((child) => (
            <NodeView key={child.id} node={child} />
          ))}
        </Tree.Item>
      );
    }
    const files = (
      <Tree aria-label="Files">
        {data.map((node) => (
          <NodeView key={node.id} node={node} />
        ))}
      </Tree>
    );
    const { rerender } = render(files);
    rerender(files);
    expect(warnings(warn)).toEqual([
      '[WaveUI] Tree.Item was rendered inside the label of another Tree.Item, so it is not part ' +
        "of that item's child group: the parent cannot expand, its name includes the nested " +
        'text, and a treeitem sits inside a label (axe aria-required-parent). A Tree.Item finds ' +
        'its nested items among its own children (written directly, in Fragments, or returned ' +
        'by a render function such as `children.map(renderNode)`), but not inside a component ' +
        'that renders Tree.Item itself. Build a data-driven tree with a render function instead ' +
        'of a recursive component.',
    ]);
  });

  it('a separate Tree portaled out of an item label (a popup) does not warn', () => {
    const warn = vi.spyOn(console, 'warn');
    function Preview() {
      return createPortal(
        <Tree aria-label="Preview">
          <Tree.Item value="p">Preview item</Tree.Item>
        </Tree>,
        document.body,
      );
    }
    render(
      <Tree aria-label="Files">
        <Tree.Item value="docs">
          Documents
          <Preview />
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('treeitem', { name: 'Preview item' })).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });

  it('items returned by a render function (children.map(renderNode)) form the child group, without a warning', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    const renderNode = (node: FileNode): React.ReactNode => (
      <Tree.Item key={node.id} value={node.id}>
        {node.name}
        {node.children?.map(renderNode)}
      </Tree.Item>
    );
    render(<Tree aria-label="Files">{data.map(renderNode)}</Tree>);
    await user.click(screen.getByText('Documents'));
    const docs = item('Documents');
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    expect(within(within(docs).getByRole('group')).getByRole('treeitem')).toBe(item('Work'));
    expect(warn).not.toHaveBeenCalled();
    await expectNoA11yViolations();
  });
});

describe('Tree - expanded state (overlays#25)', () => {
  it('controlled expandedItems: onExpandedItemsChange reports the next list', async () => {
    const user = userEvent.setup();
    const onExpandedItemsChange = vi.fn();
    render(
      <Tree
        aria-label="Files"
        expandedItems={['docs']}
        onExpandedItemsChange={onExpandedItemsChange}
      >
        {fileTree}
      </Tree>,
    );
    expect(screen.getByText('Work')).toBeInTheDocument();
    await user.click(screen.getByText('Images'));
    expect(onExpandedItemsChange).toHaveBeenCalledWith(['docs', 'images']);
    // The parent did not accept the change.
    expect(item('Images')).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByText('Documents'));
    expect(onExpandedItemsChange).toHaveBeenLastCalledWith([]);
  });

  it('controlled expandedItems follow the parent state', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [expanded, setExpanded] = React.useState<string[]>([]);
      return (
        <Tree aria-label="Files" expandedItems={expanded} onExpandedItemsChange={setExpanded}>
          {fileTree}
        </Tree>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByText('Images'));
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Photo.jpg')).toBeInTheDocument();
  });

  it('uncontrolled: onExpandedItemsChange is still called', async () => {
    const user = userEvent.setup();
    const onExpandedItemsChange = vi.fn();
    render(
      <Tree aria-label="Files" onExpandedItemsChange={onExpandedItemsChange}>
        {fileTree}
      </Tree>,
    );
    await user.click(screen.getByText('Images'));
    expect(onExpandedItemsChange).toHaveBeenCalledWith(['images']);
    expect(screen.getByText('Photo.jpg')).toBeInTheDocument();
  });

  it('StrictMode: onExpandedItemsChange fires exactly once per click', async () => {
    const user = userEvent.setup();
    const onExpandedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <Tree aria-label="Files" onExpandedItemsChange={onExpandedItemsChange}>
          {fileTree}
        </Tree>
      </React.StrictMode>,
    );
    await user.click(screen.getByText('Documents'));
    expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
  });
});

describe('Tree - keyboard (layout#31, feedback-navigation#47)', () => {
  const renderTree = (props: Partial<TreeProps> = {}) =>
    render(
      <Tree aria-label="Files" {...props}>
        {fileTree}
      </Tree>,
    );

  it('has a single tab stop: the first item, or the selected item', async () => {
    const user = userEvent.setup();
    const { unmount } = renderTree();
    const stops = screen.getAllByRole('treeitem').filter((el) => el.tabIndex === 0);
    expect(stops).toEqual([item('Documents')]);
    await user.tab();
    expect(item('Documents')).toHaveFocus();
    unmount();

    renderTree({ selected: 'readme' });
    expect(screen.getAllByRole('treeitem').filter((el) => el.tabIndex === 0)).toEqual([
      item('Readme.md'),
    ]);
  });

  it('ArrowDown/ArrowUp move through the visible items, including leaf rows', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['docs'] });
    await user.tab();
    expect(item('Documents')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Personal.txt')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Images')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Readme.md')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Readme.md')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(item('Personal.txt')).toHaveFocus();
  });

  it('the tab stop follows focus while focus is inside the tree', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Tree aria-label="Files">{fileTree}</Tree>
        <button type="button">After</button>
      </>,
    );
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(item('Readme.md')).toHaveFocus();
    expect(item('Readme.md')).toHaveAttribute('tabindex', '0');
    expect(item('Documents')).toHaveAttribute('tabindex', '-1');
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    // Focus left the tree: the next entry follows the APG rule again (selected, else first).
    expect(item('Documents')).toHaveAttribute('tabindex', '0');
  });

  it('Home and End move to the first and last visible items', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['images'] });
    act(() => item('Documents').focus());
    await user.keyboard('{End}');
    expect(item('Readme.md')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(item('Documents')).toHaveFocus();
  });

  it('ArrowRight expands a closed parent, then moves to its first child', async () => {
    const user = userEvent.setup();
    renderTree();
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('Work')).toHaveFocus();
  });

  it('ArrowRight on a leaf does nothing', async () => {
    const user = userEvent.setup();
    renderTree();
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Readme.md')).toHaveFocus();
  });

  it('ArrowLeft collapses an open parent, and moves from a child to its parent', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['docs', 'work'] });
    act(() => item('Report.docx').focus());
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
  });

  it('Enter and Space toggle a parent', async () => {
    const user = userEvent.setup();
    renderTree();
    act(() => item('Images').focus());
    await user.keyboard('{Enter}');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'false');
  });

  it('* expands every sibling of the focused item', async () => {
    const user = userEvent.setup();
    renderTree();
    act(() => item('Documents').focus());
    await user.keyboard('*');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Work')).toHaveAttribute('aria-expanded', 'false');
  });

  it('typeahead moves focus to the next visible item starting with the typed text', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['docs'] });
    act(() => item('Documents').focus());
    await user.keyboard('r');
    expect(item('Readme.md')).toHaveFocus();
  });

  describe('typeahead text is the label (not the icon or nested items)', () => {
    const renderLabels = () =>
      render(
        <Tree aria-label="Files" defaultExpandedItems={['alpha']}>
          <Tree.Item value="alpha" icon="X">
            <span>Alpha</span>
            <Tree.Item value="child">Zulu child</Tree.Item>
          </Tree.Item>
          <Tree.Item value="beta" icon="X">
            <strong>Beta</strong> item
          </Tree.Item>
          <Tree.Item value="xray">
            <span>Xray</span>
          </Tree.Item>
          <Tree.Item value="custom" data-roving-text="Omega">
            <span>Shown</span>
          </Tree.Item>
        </Tree>,
      );

    it('matches a label made of elements', async () => {
      const user = userEvent.setup();
      renderLabels();
      act(() => item('Alpha').focus());
      await user.keyboard('b');
      expect(item('Beta item')).toHaveFocus();
    });

    it('ignores icon text: "x" from Xray does not match the items with an "X" icon', async () => {
      const user = userEvent.setup();
      renderLabels();
      act(() => item('Xray').focus());
      await user.keyboard('x');
      expect(item('Xray')).toHaveFocus();
    });

    it('a consumer data-roving-text still decides the typeahead text', async () => {
      const user = userEvent.setup();
      renderLabels();
      act(() => item('Alpha').focus());
      await user.keyboard('o');
      expect(item('Shown')).toHaveFocus();
    });
  });

  it('typeahead reaches visible nested items by their own label', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['docs'] });
    act(() => item('Documents').focus());
    await user.keyboard('pe');
    expect(item('Personal.txt')).toHaveFocus();
  });

  it('arrow keys start from the focused nested item, not from its ancestors', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['docs', 'work'] });
    act(() => item('Report.docx').focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Personal.txt')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(item('Work')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('Documents')).toHaveFocus();
  });

  it('a Space inside a typeahead search does not activate the item', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    render(
      <Tree aria-label="States" onItemSelect={onItemSelect}>
        <Tree.Item value="al">Alabama</Tree.Item>
        <Tree.Item value="nj">New Jersey</Tree.Item>
        <Tree.Item value="ny">New York</Tree.Item>
      </Tree>,
    );
    act(() => item('Alabama').focus());
    await user.keyboard('new y');
    expect(item('New York')).toHaveFocus();
    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('typeahead from a nested item searches onward from that item, not from its parent', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['docs', 'images'] });
    act(() => item('Personal.txt').focus());
    await user.keyboard('p');
    expect(item('Photo.jpg')).toHaveFocus();
  });

  // Tree's typeahead is the roving hook's: the Tree.Item keydown handler leaves Ctrl+Alt keys
  // alone (neither prevents nor stops them), and the hook takes a character typed with AltGr.
  it('typeahead accepts a letter typed with AltGr (Ctrl+Alt on Windows)', () => {
    render(
      <Tree aria-label="Cities">
        <Tree.Item value="krakow">Kraków</Tree.Item>
        <Tree.Item value="lodz">Łódź</Tree.Item>
      </Tree>,
    );
    act(() => item('Kraków').focus());
    // Polish (programmer) layout: AltGr+L types "ł".
    expect(fireEvent.keyDown(item('Kraków'), { key: 'ł', ctrlKey: true, altKey: true })).toBe(
      false,
    );
    expect(item('Łódź')).toHaveFocus();
  });
});

describe('Tree - composed root handlers', () => {
  testComposedHandler(Tree, {
    handler: 'onKeyDown',
    defaultProps: { 'aria-label': 'Files', children: fileTree },
    act: async ({ user }) => {
      act(() => item('Documents').focus());
      await user.keyboard('{ArrowDown}');
    },
    assertInternal: () => {
      expect(item('Images')).toHaveFocus();
    },
    assertInternalSuppressed: () => {
      expect(item('Documents')).toHaveFocus();
    },
  });

  const states = (
    <>
      <Tree.Item value="al">Alabama</Tree.Item>
      <Tree.Item value="nj">New Jersey</Tree.Item>
      <Tree.Item value="ny">New York</Tree.Item>
    </>
  );

  // The capture handler takes a Space that continues a search before the item activates on it.
  testComposedHandler(Tree, {
    handler: 'onKeyDownCapture',
    defaultProps: { 'aria-label': 'States', children: states },
    act: async ({ user }) => {
      act(() => item('Alabama').focus());
      await user.keyboard('new y');
    },
    assertInternal: () => {
      expect(item('New York')).toHaveFocus();
    },
    assertInternalSuppressed: () => {
      expect(item('Alabama')).toHaveFocus();
    },
  });

  it('onFocus and onBlur of the Tree and onFocus of an item run, also when they call preventDefault(), and the tab stop still follows focus', async () => {
    const user = userEvent.setup();
    const prevent = (event: React.SyntheticEvent) => event.preventDefault();
    const onFocus = vi.fn(prevent);
    const onBlur = vi.fn(prevent);
    const onReadmeFocus = vi.fn(prevent);
    render(
      <>
        <button type="button">Before</button>
        <Tree aria-label="Files" onFocus={onFocus} onBlur={onBlur}>
          <Tree.Item value="docs">Documents</Tree.Item>
          <Tree.Item value="images">Images</Tree.Item>
          <Tree.Item value="readme" onFocus={onReadmeFocus}>
            Readme.md
          </Tree.Item>
        </Tree>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(item('Documents')).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(item('Readme.md')).toHaveFocus();
    expect(onReadmeFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(3);
    expect(onBlur).toHaveBeenCalledTimes(2);
    expect(item('Readme.md')).toHaveAttribute('tabindex', '0');
    expect(item('Documents')).toHaveAttribute('tabindex', '-1');

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    expect(onBlur).toHaveBeenCalledTimes(3);
    // Focus left the tree: the tab stop is back on the first item.
    expect(item('Documents')).toHaveAttribute('tabindex', '0');
    expect(item('Readme.md')).toHaveAttribute('tabindex', '-1');
  });
});

describe('Tree - RTL (layout#32)', () => {
  it('swaps ArrowRight and ArrowLeft in right-to-left', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Tree aria-label="Files">{fileTree}</Tree>, { dir: 'rtl' });
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowLeft}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(item('Work')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
  });

  it('indents with logical padding and mirrors the collapsed chevron', () => {
    renderWithProviders(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        {fileTree}
      </Tree>,
      { dir: 'rtl' },
    );
    const group = within(item('Documents')).getAllByRole('group')[0];
    expect(group).toHaveClass('ps-4');
    expect(group.className).not.toMatch(/\bpl-/);
    const collapsedChevron = item('Images').querySelector('svg');
    const expandedChevron = item('Documents').querySelector('svg');
    expect(collapsedChevron).toHaveClass('wave-rtl:-scale-x-100');
    expect(expandedChevron).toHaveClass('rotate-90');
    expect(expandedChevron).not.toHaveClass('wave-rtl:-scale-x-100');
  });

  it('inside a left-to-right subtree of a right-to-left page: LTR keys, and the chevron flips only through wave-rtl: (C-LOGICAL)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <div dir="ltr">
        <Tree aria-label="Files">{fileTree}</Tree>
      </div>,
      { dir: 'rtl' },
    );
    // Tailwind's rtl: variant also matches `[dir=rtl] *`, so it would mirror this chevron; the
    // wave-rtl: variant follows the element's own direction.
    const chevron = item('Images').querySelector('svg')!;
    expect(chevron).toHaveClass('wave-rtl:-scale-x-100');
    expect(chevron.getAttribute('class')).not.toMatch(/(^|\s)rtl:/);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');
    expect(item('Work')).toHaveFocus();
  });
});

describe('Tree.Item — slotProps', () => {
  type ItemSlotProps = NonNullable<TreeItemProps['slotProps']>;
  const EVERY_PART: ItemSlotProps = {
    row: {},
    indicator: {},
    label: {},
    aside: {},
    actions: {},
    group: {},
  };
  const NAMES = ['row', 'indicator', 'label', 'aside', 'actions', 'group'] as const;
  const STABLE = NAMES.map((name) => treeItemClassNames[name]);

  /** The item's own row, never a nested item's. */
  const rowOf = (el: Element) =>
    el.querySelector<HTMLElement>(`:scope > .${treeItemClassNames.row}`) as HTMLElement;
  const inRow = (el: Element, className: string) =>
    rowOf(el).querySelector<HTMLElement>(`.${className}`) as HTMLElement;
  const indicator = (el: Element) => inRow(el, treeItemClassNames.indicator);
  const label = (el: Element) => inRow(el, treeItemClassNames.label);
  const aside = (el: Element) => inRow(el, treeItemClassNames.aside);
  const actions = (el: Element) => inRow(el, treeItemClassNames.actions);
  /** The item's own group (inside its collapse element), never a nested item's. */
  const groupOf = (el: Element) =>
    el.querySelector<HTMLElement>(`:scope > * > .${treeItemClassNames.group}`) as HTMLElement;
  /** Every part of an item, in the order of {@link NAMES}. */
  const partsOf = (el: Element) => [
    rowOf(el),
    indicator(el),
    label(el),
    aside(el),
    actions(el),
    groupOf(el),
  ];

  // Captured from ce1620c's dist (client and server agree).
  const BASE_PINS = [
    '<div class="wave-tree-item__row flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-subtle-hover group/row" data-tree-row="">',
    '<span aria-checked="true" aria-labelledby="tree-item-label-_id0_" class="wave-tree-item__indicator relative inline-flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors motion-reduce:transition-none before:absolute before:-inset-1 border-primary bg-primary text-primary-foreground forced-colors:border-[Highlight] forced-colors:bg-[Highlight]" data-tree-checkbox="" role="checkbox" tabindex="-1">',
    '<span class="wave-tree-item__label truncate min-w-0" data-tree-label="" id="tree-item-label-_id0_">',
    '<span class="wave-tree-item__aside inline-flex items-center text-caption-1 text-muted-foreground not-forced-colors:group-hover/row:invisible [@media(hover:hover)]:not-forced-colors:group-focus-within/end:invisible [@media(hover:hover)]:not-forced-colors:group-has-[[aria-expanded=true]]/end:invisible [@media(hover:hover)]:not-forced-colors:group-has-[[data-focus-in-popup]]/end:invisible" data-tree-aside="" id="tree-item-aside-_id1_">',
    '<span aria-labelledby="tree-item-label-_id0_" aria-orientation="horizontal" class="wave-tree-item__actions inline-flex items-center gap-1 invisible group-hover/row:visible focus-within:visible forced-colors:visible [@media(hover:none)]:visible has-[[aria-expanded=true]]:visible data-[focus-in-popup]:visible" data-roving-container="" data-tree-actions="" role="toolbar">',
    '<div class="wave-tree-item__group ps-4" role="group">',
  ].join('\n');
  const RADIO_PIN =
    '<span aria-hidden="true" class="wave-tree-item__indicator inline-flex size-4 shrink-0 items-center justify-center rounded-full transition-colors motion-reduce:transition-none border-2 border-primary forced-colors:border-[Highlight]">';

  /** Documents (expanded, with an aside and an action) › Report; checkboxes or radios. */
  function Pinned({
    mode = 'multiple',
    slotProps,
    ...props
  }: Partial<TreeProps> & { mode?: 'multiple' | 'single'; slotProps?: ItemSlotProps }) {
    return (
      <Tree
        aria-label="Files"
        selectionMode={mode}
        defaultExpandedItems={['docs']}
        {...(mode === 'multiple' ? { defaultCheckedItems: ['report'] } : { selected: 'docs' })}
        {...props}
      >
        <Tree.Item
          value="docs"
          aside="2"
          actions={<button type="button">Rename</button>}
          slotProps={slotProps}
        >
          Documents
          <Tree.Item value="report">Report</Tree.Item>
        </Tree.Item>
      </Tree>
    );
  }

  /** Documents › Work, and Readme, every row with two actions. */
  function Rows({ slotProps, ...props }: Partial<TreeProps> & { slotProps?: ItemSlotProps }) {
    return (
      <>
        <Tree aria-label="Files" defaultExpandedItems={['docs']} {...props}>
          <Tree.Item
            value="docs"
            slotProps={slotProps}
            actions={
              <>
                <button type="button">Rename Documents</button>
                <button type="button">Delete Documents</button>
              </>
            }
          >
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
          <Tree.Item value="readme">Readme</Tree.Item>
        </Tree>
        <button type="button">After</button>
      </>
    );
  }

  it('renders the parts of ce1620c (attributes sorted), on the client and the server', () => {
    const { unmount } = render(<Pinned />);
    expect(openingTags(...partsOf(item('Documents')))).toBe(BASE_PINS);
    unmount();
    render(<Pinned mode="single" />);
    expect(openingTags(indicator(item('Documents')))).toBe(RADIO_PIN);
    for (const [mode, pins] of [
      ['multiple', BASE_PINS],
      ['single', RADIO_PIN],
    ] as const) {
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Pinned mode={mode} slotProps={EVERY_PART} />);
      const docs = template.content.querySelector('[role="treeitem"]') as Element;
      expect(openingTags(...(mode === 'single' ? [indicator(docs)] : partsOf(docs)))).toBe(pins);
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: Partial<TreeProps>[] = [
      { selectionMode: 'multiple', defaultCheckedItems: ['report'] },
      { selectionMode: 'single', selected: 'docs' },
      { selected: 'report', current: 'docs', navigationMode: 'treegrid' },
      { defaultExpandedItems: [] },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => (
          <Tree aria-label="Files" defaultExpandedItems={['docs']} {...props}>
            <Tree.Item
              value="docs"
              aside="2"
              actions={<button type="button">Rename</button>}
              data-roving-text="Docs"
              slotProps={slotProps}
            >
              Documents
              <Tree.Item value="report" slotProps={slotProps}>
                Report
              </Tree.Item>
            </Tree.Item>
            <Tree.Item value="readme" slotProps={slotProps}>
              Readme
            </Tree.Item>
          </Tree>
        ),
        EVERY_PART,
      );
    }
  });

  it('puts your className, style and data-* on each part, after its own classes', () => {
    const mine = (name: string) => ({
      className: `my-${name}`,
      style: { opacity: 0.5 },
      'data-part': name,
    });
    const slotProps = Object.fromEntries(NAMES.map((name) => [name, mine(name)])) as ItemSlotProps;
    for (const mode of ['multiple', 'single'] as const) {
      const { unmount } = render(<Pinned mode={mode} slotProps={slotProps} />);
      partsOf(item('Documents')).forEach((element, i) => {
        expect(element.classList[0]).toBe(STABLE[i]);
        expect(element.classList[element.classList.length - 1]).toBe(`my-${NAMES[i]}`);
        expect(element).toHaveAttribute('data-part', NAMES[i]);
        expect(element).toHaveStyle({ opacity: '0.5' });
      });
      unmount();
    }
  });

  it('lets your class replace a conflicting class of a part', () => {
    render(
      <Pinned
        slotProps={{
          row: { className: 'px-4' },
          indicator: { className: 'size-5' },
          label: { className: 'min-w-8' },
          aside: { className: 'text-body-1' },
          actions: { className: 'gap-2' },
          group: { className: 'ps-8' },
        }}
      />,
    );
    const [row, box, text, end, toolbar, group] = partsOf(item('Documents'));
    expect(row).toHaveClass('px-4');
    expect(row).not.toHaveClass('px-2');
    expect(box).toHaveClass('size-5');
    expect(box).not.toHaveClass('size-4');
    expect(text).toHaveClass('min-w-8');
    expect(text).not.toHaveClass('min-w-0');
    expect(end).toHaveClass('text-body-1');
    expect(end).not.toHaveClass('text-caption-1');
    expect(toolbar).toHaveClass('gap-2');
    expect(toolbar).not.toHaveClass('gap-1');
    expect(group).toHaveClass('ps-8');
    expect(group).not.toHaveClass('ps-4');
  });

  it('attaches your refs to the parts', () => {
    const refs = NAMES.map(() => React.createRef<HTMLElement>());
    const slotProps = Object.fromEntries(
      NAMES.map((name, i) => [name, { ref: refs[i] }]),
    ) as ItemSlotProps;
    render(<Pinned slotProps={slotProps} />);
    partsOf(item('Documents')).forEach((element, i) => expect(refs[i].current).toBe(element));
  });

  it('keeps the actions’ tab stops through renders with a new inline ref (the roving container stays attached)', async () => {
    const user = userEvent.setup();
    const seen: Element[] = [];
    function Inline({ tick }: { tick: number }) {
      return (
        <Rows
          data-tick={tick}
          slotProps={{
            actions: { ref: (el: HTMLSpanElement | null) => void (el && seen.push(el)) },
          }}
        />
      );
    }
    const { rerender } = render(<Inline tick={0} />);
    await user.tab();
    expect(item('Documents')).toHaveFocus();
    const rename = screen.getByRole('button', { name: 'Rename Documents' });
    expect(rename).toHaveAttribute('tabindex', '0');
    const mutations: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) mutations.push(String(record.attributeName));
    });
    observer.observe(actions(item('Documents')), { attributes: true, subtree: true });
    rerender(<Inline tick={1} />);
    rerender(<Inline tick={2} />);
    await act(async () => {});
    observer.disconnect();
    // A detached container hands its stamps back and stamps again: the buttons would change.
    expect(mutations).toEqual([]);
    expect(rename).toHaveAttribute('tabindex', '0');
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seen)).toEqual(new Set([actions(item('Documents'))]));
    await user.tab();
    expect(rename).toHaveFocus();
  });

  it('keeps moving focus out of a collapsing group with a new inline group ref on every render', async () => {
    function Controlled({ expanded }: { expanded: string[] }) {
      return (
        <Tree aria-label="Files" expandedItems={expanded} motion={null}>
          <Tree.Item value="docs" slotProps={{ group: { ref: () => {} } }}>
            Documents
            <Tree.Item value="report">Report</Tree.Item>
          </Tree.Item>
        </Tree>
      );
    }
    const { rerender } = render(<Controlled expanded={['docs']} />);
    act(() => item('Report').focus());
    expect(item('Report')).toHaveFocus();
    rerender(<Controlled expanded={[]} />);
    await act(async () => {});
    expect(item('Documents')).toHaveFocus();
  });

  it('locks each part’s role, ids, names, tab index, markers and hidden state', () => {
    const attempt = (id: string) => ({
      id,
      role: 'treeitem',
      tabIndex: 0,
      hidden: true,
      inert: true,
      'aria-hidden': true,
      'aria-label': 'Mine',
      'aria-checked': false,
      'aria-orientation': 'vertical',
      'data-tree-row': 'x',
      'data-tree-label': 'x',
      'data-tree-checkbox': 'x',
      'data-tree-aside': 'x',
      'data-tree-actions': 'x',
      'data-tree-persona-name': 'x',
      'data-roving-container': 'x',
      'data-roving-text': 'Mine',
      'data-focus-in-popup': '',
    });
    const slotProps = Object.fromEntries(
      NAMES.map((name) => [name, attempt(`my-${name}`)]),
    ) as ItemSlotProps;
    // The names of the checkbox and the toolbar are id lists: yours are joined after the item's.
    Object.assign(slotProps.indicator!, { 'aria-labelledby': 'extra' });
    Object.assign(slotProps.actions!, { 'aria-labelledby': 'extra' });
    render(
      <>
        <span id="extra">Extra</span>
        <Pinned slotProps={slotProps} />
      </>,
    );
    const docs = item('Documents');
    const [row, box, text, end, toolbar, group] = partsOf(docs);
    const labelId = text.id;
    expect(labelId).toMatch(/^tree-item-label-/);
    expect(end.id).toMatch(/^tree-item-aside-/);
    const MARKERS = [
      'data-tree-row',
      'data-tree-label',
      'data-tree-checkbox',
      'data-tree-aside',
      'data-tree-actions',
      'data-tree-persona-name',
      'data-roving-container',
    ];
    const own: Record<string, string> = {
      'data-tree-row': '',
      'data-tree-label': '',
      'data-tree-checkbox': '',
      'data-tree-aside': '',
      'data-tree-actions': '',
      'data-roving-container': '',
    };
    const ownMarkers = [
      ['data-tree-row'],
      ['data-tree-checkbox'],
      ['data-tree-label'],
      ['data-tree-aside'],
      ['data-tree-actions', 'data-roving-container'],
      [],
    ];
    [row, box, text, end, toolbar, group].forEach((element, i) => {
      for (const marker of MARKERS) {
        if (ownMarkers[i].includes(marker)) expect(element).toHaveAttribute(marker, own[marker]);
        else expect(element).not.toHaveAttribute(marker);
      }
      for (const hiding of ['hidden', 'inert', 'aria-hidden']) {
        expect(element).not.toHaveAttribute(hiding);
      }
    });
    // Row and group: no role of their own but the group's, no tab index.
    expect(row).not.toHaveAttribute('role');
    expect(row).not.toHaveAttribute('tabindex');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).not.toHaveAttribute('tabindex');
    // The checkbox: its role, state, name (yours joined after it), tab index and marker.
    expect(box).toHaveAttribute('role', 'checkbox');
    expect(box).toHaveAttribute('aria-checked', 'true');
    expect(box).toHaveAttribute('aria-labelledby', `${labelId} extra`);
    expect(box).toHaveAttribute('tabindex', '-1');
    // The label and the aside: their ids, no name of their own, no typeahead text but the item's.
    for (const element of [text, end]) {
      expect(element).not.toHaveAttribute('role');
      expect(element).not.toHaveAttribute('tabindex');
      expect(element).not.toHaveAttribute('aria-label');
    }
    expect(text).not.toHaveAttribute('data-roving-text');
    // The actions: the toolbar's role, name (yours joined), orientation, no tab index, and no
    // popup hold while focus is not in a popup.
    expect(toolbar).toHaveAttribute('role', 'toolbar');
    expect(toolbar).toHaveAttribute('aria-labelledby', `${labelId} extra`);
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(toolbar).not.toHaveAttribute('tabindex');
    expect(toolbar).not.toHaveAttribute('data-focus-in-popup');
    // The tree is unchanged: two items, named by their labels and described by the aside.
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);
    expect(docs).toHaveAccessibleName('Documents');
    expect(docs).toHaveAccessibleDescription('2');
    expect(docs).toHaveAttribute('aria-labelledby', labelId);
  });

  it('locks the radio: hidden from assistive technology, with no role or tab index', () => {
    render(
      <Pinned
        mode="single"
        slotProps={{
          indicator: { 'aria-hidden': false, role: 'radio', tabIndex: 0, 'data-tree-checkbox': '' },
        }}
      />,
    );
    const radio = indicator(item('Documents'));
    expect(radio).toHaveAttribute('aria-hidden', 'true');
    expect(radio).not.toHaveAttribute('role');
    expect(radio).not.toHaveAttribute('tabindex');
    expect(radio).not.toHaveAttribute('data-tree-checkbox');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('keeps the item’s own typeahead text on the label, and none that a part gives', () => {
    const { rerender } = render(
      <Tree aria-label="Files">
        <Tree.Item value="a" slotProps={{ label: { 'data-roving-text': 'Mine' } }}>
          Alpha
        </Tree.Item>
      </Tree>,
    );
    expect(label(item('Alpha'))).not.toHaveAttribute('data-roving-text');
    rerender(
      <Tree aria-label="Files">
        <Tree.Item
          value="a"
          data-roving-text="Own"
          slotProps={{ label: { 'data-roving-text': 'Mine' } }}
        >
          Alpha
        </Tree.Item>
      </Tree>,
    );
    expect(label(item('Alpha'))).toHaveAttribute('data-roving-text', 'Own');
  });

  it('keeps typeahead on the label: a part gives the item no other text', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files">
        <Tree.Item value="mango">Mango</Tree.Item>
        {/* Typeahead searches from the focused item on: with the part's text, "z" would stop
            here, before Zulu. */}
        <Tree.Item value="cherry" slotProps={{ label: { 'data-roving-text': 'Zebra' } }}>
          Cherry
        </Tree.Item>
        <Tree.Item value="zulu">Zulu</Tree.Item>
      </Tree>,
    );
    await user.tab();
    expect(item('Mango')).toHaveFocus();
    await user.keyboard('z');
    expect(item('Zulu')).toHaveFocus();
  });

  it('keeps the tree’s items and arrow order: a part takes no item role and no roving container', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Tree.Item
          value="docs"
          slotProps={{
            label: { role: 'treeitem' },
            row: { role: 'tree' },
            group: { role: 'tree', 'data-roving-container': '' },
          }}
        >
          Documents
          <Tree.Item value="report">Report</Tree.Item>
        </Tree.Item>
        <Tree.Item value="readme">Readme</Tree.Item>
      </Tree>,
    );
    expect(screen.getAllByRole('treeitem')).toHaveLength(3);
    expect(screen.getAllByRole('tree')).toHaveLength(1);
    await user.tab();
    expect(item('Documents')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Report')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Readme')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(item('Documents')).toHaveFocus();
  });

  it('keeps the item’s own clicks: a part cannot pass for the checkbox, the actions or another row', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    const markers = {
      'data-tree-checkbox': '',
      'data-tree-actions': '',
      'data-tree-row': '',
    };
    render(
      <Tree aria-label="Files" onItemSelect={onItemSelect}>
        <Tree.Item value="docs" aside="2" slotProps={{ label: markers, aside: markers }}>
          Documents
          <Tree.Item value="report">Report</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(label(item('Documents')));
    expect(onItemSelect).toHaveBeenLastCalledWith('docs');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    await user.click(aside(item('Documents')));
    expect(onItemSelect).toHaveBeenCalledTimes(2);
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the tree’s one tab stop: no part takes a tab index', async () => {
    const user = userEvent.setup();
    const stop = { tabIndex: 0 };
    render(
      <Rows
        selectionMode="single"
        selected="docs"
        slotProps={{ row: stop, indicator: stop, label: stop, actions: stop, group: stop }}
      />,
    );
    await user.tab();
    expect(item('Documents')).toHaveFocus();
    // Tab enters the item's actions (one stop), then leaves the tree.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Rename Documents' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('runs a part’s click first: a prevented click on the row, label, aside or radio calls onClick but does not activate', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onItemSelect = vi.fn();
    const onClick = vi.fn(() => void order.push('item'));
    const prevent = (name: string) => ({
      onClick: (event: React.MouseEvent) => {
        order.push(name);
        event.preventDefault();
      },
    });
    const { rerender } = render(
      <Tree aria-label="Files" selectionMode="single" selected={null} onItemSelect={onItemSelect}>
        <Tree.Item
          value="docs"
          aside="2"
          onClick={onClick}
          slotProps={{
            row: prevent('row'),
            indicator: prevent('indicator'),
            label: prevent('label'),
            aside: prevent('aside'),
          }}
        >
          Documents
          <Tree.Item value="report">Report</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    const docs = item('Documents');
    for (const element of [rowOf(docs), indicator(docs), label(docs), aside(docs)]) {
      await user.click(element);
    }
    // Each click reaches the row's part after the inner part's, then the item.
    expect(order).toEqual([
      'row',
      'item',
      'indicator',
      'row',
      'item',
      'label',
      'row',
      'item',
      'aside',
      'row',
      'item',
    ]);
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(docs).toHaveAttribute('aria-expanded', 'false');
    // Without preventDefault the click activates and expands the item as before.
    rerender(
      <Tree aria-label="Files" onItemSelect={onItemSelect}>
        <Tree.Item value="docs" slotProps={{ label: { onClick: () => void order.push('mine') } }}>
          Documents
          <Tree.Item value="report">Report</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await user.click(label(item('Documents')));
    expect(onItemSelect).toHaveBeenCalledWith('docs');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('runs the checkbox’s handlers after yours: preventDefault() skips the toggle and the focus move', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onBox = vi.fn();
    function Checks({ prevent }: { prevent: boolean }) {
      const handle = (event: React.MouseEvent) => {
        onBox(event.type);
        if (prevent) event.preventDefault();
      };
      return (
        <Tree
          aria-label="Files"
          selectionMode="multiple"
          onCheckedItemsChange={onCheckedItemsChange}
        >
          <Tree.Item value="a" slotProps={{ indicator: { onClick: handle, onMouseDown: handle } }}>
            Alpha
          </Tree.Item>
          <Tree.Item value="b">Beta</Tree.Item>
        </Tree>
      );
    }
    const { rerender } = render(<Checks prevent />);
    await user.click(indicator(item('Alpha')));
    expect(onBox.mock.calls).toEqual([['mousedown'], ['click']]);
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
    expect(item('Alpha')).not.toHaveFocus();
    expect(item('Alpha')).toHaveAttribute('aria-checked', 'false');
    rerender(<Checks prevent={false} />);
    await user.click(indicator(item('Alpha')));
    expect(onCheckedItemsChange).toHaveBeenCalledWith(
      ['a'],
      expect.objectContaining({ value: 'a', checked: true }),
    );
    expect(item('Alpha')).toHaveFocus();
    expect(item('Alpha')).toHaveAttribute('aria-checked', 'true');
  });

  it('runs the actions’ keys after yours: preventDefault() skips them', async () => {
    const user = userEvent.setup();
    function Keys({ prevent }: { prevent: boolean }) {
      return (
        <Rows
          slotProps={{
            actions: {
              onKeyDown: (event: React.KeyboardEvent) => {
                if (prevent) event.preventDefault();
              },
            },
          }}
        />
      );
    }
    const { rerender } = render(<Keys prevent />);
    const rename = screen.getByRole('button', { name: 'Rename Documents' });
    act(() => rename.focus());
    await user.keyboard('{ArrowRight}');
    expect(rename).toHaveFocus();
    rerender(<Keys prevent={false} />);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Delete Documents' })).toHaveFocus();
  });

  it('always runs the actions’ focus bookkeeping after yours, even when you prevent it', async () => {
    const order: string[] = [];
    const prevent = (name: string) => (event: React.FocusEvent) => {
      order.push(name);
      event.preventDefault();
    };
    function PortalAction() {
      return (
        <>
          <button type="button">Open</button>
          {createPortal(<button type="button">In popup</button>, document.body)}
        </>
      );
    }
    render(
      <>
        <Tree aria-label="Files">
          <Tree.Item
            value="docs"
            actions={
              <>
                <button type="button">Rename</button>
                <PortalAction />
              </>
            }
            slotProps={{ actions: { onFocus: prevent('focus'), onBlur: prevent('blur') } }}
          >
            Documents
          </Tree.Item>
        </Tree>
        <button type="button">Elsewhere</button>
      </>,
    );
    const toolbar = actions(item('Documents'));
    const button = (name: string) => screen.getByRole('button', { name });
    // The tab stop follows the focused action.
    act(() => button('Open').focus());
    expect(button('Open')).toHaveAttribute('tabindex', '0');
    expect(button('Rename')).toHaveAttribute('tabindex', '-1');
    // Focus in a surface an action opened holds the actions shown, and leaving it releases them.
    act(() => button('In popup').focus());
    expect(toolbar).toHaveAttribute('data-focus-in-popup', '');
    act(() => button('Elsewhere').focus());
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(toolbar).not.toHaveAttribute('data-focus-in-popup');
    expect(order).toEqual(['focus', 'blur', 'focus', 'blur']);
  });

  it('runs the actions’ focus bookkeeping when an untyped part gives no function as its handlers', () => {
    // From JavaScript: a value that is no handler is skipped, as the merge skips it.
    const untyped = { onFocus: 'not a handler', onBlur: 'not a handler' };
    render(
      <Tree aria-label="Files">
        <Tree.Item
          value="docs"
          actions={
            <>
              <button type="button">Rename</button>
              <button type="button">Open</button>
            </>
          }
          slotProps={{
            actions: untyped as unknown as ItemSlotProps['actions'],
          }}
        >
          Documents
        </Tree.Item>
      </Tree>,
    );
    const button = (name: string) => screen.getByRole('button', { name });
    act(() => button('Open').focus());
    expect(button('Open')).toHaveAttribute('tabindex', '0');
    expect(button('Rename')).toHaveAttribute('tabindex', '-1');
    act(() => button('Rename').focus());
    expect(button('Rename')).toHaveAttribute('tabindex', '0');
  });

  it('runs a group part’s keys after the nested item’s and before the tree’s: preventDefault() skips the tree’s', async () => {
    const user = userEvent.setup();
    function Keys({ prevent }: { prevent: boolean }) {
      return (
        <Tree aria-label="Files" defaultExpandedItems={['docs']}>
          <Tree.Item
            value="docs"
            slotProps={{
              group: {
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (prevent && event.key === 'ArrowDown') event.preventDefault();
                },
              },
            }}
          >
            Documents
            <Tree.Item value="report">Report</Tree.Item>
          </Tree.Item>
          <Tree.Item value="readme">Readme</Tree.Item>
        </Tree>
      );
    }
    const { rerender } = render(<Keys prevent />);
    act(() => item('Report').focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Report')).toHaveFocus();
    rerender(<Keys prevent={false} />);
    await user.keyboard('{ArrowDown}');
    expect(item('Readme')).toHaveFocus();
  });

  it('calls your part handlers once per event in StrictMode', async () => {
    const user = userEvent.setup();
    const handlers = { row: vi.fn(), indicator: vi.fn(), label: vi.fn(), aside: vi.fn() };
    render(
      <React.StrictMode>
        <Pinned
          slotProps={{
            row: { onClick: handlers.row },
            indicator: { onClick: handlers.indicator },
            label: { onClick: handlers.label },
            aside: { onClick: handlers.aside },
          }}
        />
      </React.StrictMode>,
    );
    const docs = item('Documents');
    await user.click(indicator(docs));
    await user.click(label(docs));
    await user.click(aside(docs));
    expect(handlers.indicator).toHaveBeenCalledTimes(1);
    expect(handlers.label).toHaveBeenCalledTimes(1);
    expect(handlers.aside).toHaveBeenCalledTimes(1);
    expect(handlers.row).toHaveBeenCalledTimes(3);
  });

  it('ignores the parts an item does not draw, and never reaches a nested item’s parts', () => {
    const mine = Object.fromEntries(
      NAMES.map((name) => [name, { className: `my-${name}` }]),
    ) as ItemSlotProps;
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Tree.Item value="docs" slotProps={mine}>
          Documents
          <Tree.Item value="report" aside="1" actions={<button type="button">Open</button>}>
            Report
          </Tree.Item>
        </Tree.Item>
        <Tree.Item value="leafy" leaf slotProps={mine}>
          Leafy
          <Tree.Item value="hidden">Hidden</Tree.Item>
        </Tree.Item>
        <Tree.Item value="closed" slotProps={mine}>
          Closed
          <Tree.Item value="inside">Inside</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    // No indicator (selectionMode="none"), no aside, no actions on Documents; no group on a leaf
    // or a collapsed item; the nested Report's parts carry none of Documents' classes.
    for (const name of ['indicator', 'aside', 'actions'] as const) {
      expect(document.querySelector(`.my-${name}`)).toBeNull();
    }
    expect(document.querySelectorAll('.my-group')).toHaveLength(1);
    expect(groupOf(item('Documents'))).toHaveClass('my-group');
    expect(document.querySelectorAll('.my-row')).toHaveLength(3);
    expect(document.querySelectorAll('.my-label')).toHaveLength(3);
    const report = item('Report');
    for (const element of [rowOf(report), label(report), aside(report), actions(report)]) {
      expect(element.className).not.toMatch(/\bmy-/);
    }
  });

  it('keeps the treeitem element its own: slotProps never reaches it', () => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="a" slotProps={{ root: { className: 'my-root' } } as never}>
          Alpha
        </Tree.Item>
      </Tree>,
    );
    expect(item('Alpha')).not.toHaveAttribute('slotprops');
    expect(document.querySelector('.my-root')).toBeNull();
  });

  it('RTL: the treegrid arrows still enter and leave the actions with parts customised', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Rows
        navigationMode="treegrid"
        slotProps={{ row: { className: 'my-row' }, actions: { className: 'my-actions' } }}
      />,
      { dir: 'rtl' },
    );
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Rename Documents' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveFocus();
    expect(rowOf(item('Documents'))).toHaveClass('my-row');
    expect(actions(item('Documents'))).toHaveClass('my-actions');
  });

  it('has no accessibility violations with every part customised', async () => {
    const custom = (name: string) => ({ className: `my-${name}`, title: name });
    render(
      <Pinned
        slotProps={{
          row: custom('row'),
          indicator: custom('indicator'),
          label: custom('label'),
          aside: custom('aside'),
          actions: custom('actions'),
          group: { ...custom('group'), 'aria-label': 'Documents contents' },
        }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof ItemSlotProps>().toEqualTypeOf<
      'row' | 'indicator' | 'label' | 'aside' | 'actions' | 'group'
    >();
    expectTypeOf<NonNullable<ItemSlotProps['row']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['indicator']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['aside']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['actions']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['group']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    void (
      (
        // @ts-expect-error -- a part takes no children: the item draws them
        <Tree.Item value="a" slotProps={{ label: { children: 'Label' } }}>
          Alpha
        </Tree.Item>
      )
    );
    // @ts-expect-error -- the treeitem element takes the item's own props, never a part's
    void (<Tree.Item value="a" slotProps={{ root: {} }} />);
  });
});
