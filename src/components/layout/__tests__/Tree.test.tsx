import * as React from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, TreeItem, type TreeProps, type TreeItemProps } from '../Tree';
import type { Slot } from '../../../lib/types';
import {
  asClientReference,
  expectNoA11yViolations,
  renderWithProviders,
  testSystemProps,
  testCompoundExposure,
  testComposedHandler,
  testDisplayName,
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

/** The `[WaveUI]` warnings logged so far (R14: asserted, never silenced). */
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

  testCompoundExposure(Tree, ['Item']);
  testDisplayName(Tree.Item, 'TreeItem');

  it('exports Tree.Item under its flat name (C-COMPOUND)', () => {
    expect(TreeItem).toBe(Tree.Item);
  });

  it('renders with role=tree and tree items', () => {
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    const tree = screen.getByRole('tree', { name: 'Files' });
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(3);
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Tree.Item value="a">Orphan</Tree.Item>)).toThrow(
      '[WaveUI] Tree.Item must be used within <Tree>',
    );
  });

  it('in production, a Tree.Item outside a Tree logs once and renders inertly (C-CONTEXT, R3)', () => {
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

  it('accepts readonly expanded lists and emits a mutable one (R6)', async () => {
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

  it('Tree.Item written in a Server Component (a lazy type) renders the same server HTML and behaves the same (R1)', async () => {
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

  it('warns once per value shared by several items (R12)', () => {
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
    expect(warnings(warn)).toEqual([
      expect.stringMatching(/^\[WaveUI\] Tree: several items share the value "a"\. /),
      expect.stringMatching(/^\[WaveUI\] Tree: several items share the value "b"\. /),
    ]);
  });

  it('does not warn about values in StrictMode, when keyed items are reordered or when an item is replaced (R12)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    expect(group.parentElement).toBe(parent);
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

  describe('consumer onKeyDown (layout-b-tests-1)', () => {
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

describe('Tree.Item - nested items rendered by a component (layout-b-code-1)', () => {
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
      expect.stringMatching(
        /^\[WaveUI\] Tree\.Item was rendered inside the label of another Tree\.Item.*render function/,
      ),
    ]);
  });

  it('a separate Tree portaled out of an item label (a popup) does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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

  // Expected to fail until useRovingTabIndex lets a character typed with AltGr (Ctrl+Alt on
  // Windows) reach its typeahead: Tree's typeahead is the roving hook's, and the hook's modifier
  // guard returns first (the Tree.Item keydown handler neither prevents nor stops the key). Change
  // `it.fails` to `it` together with that hook fix.
  it.fails('typeahead accepts a letter typed with AltGr (Ctrl+Alt on Windows)', () => {
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

describe('Tree - composed root handlers (layout-b-tests-2)', () => {
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

  it('inside a left-to-right subtree of a right-to-left page: LTR keys, and the chevron flips only through wave-rtl: (R4)', async () => {
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
