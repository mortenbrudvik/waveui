import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, TreeItem, type TreeProps, type TreeItemProps } from '../Tree';
import {
  renderWithProviders,
  testSystemProps,
  testCompoundExposure,
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

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('types ref on the Props interfaces (C-REF)', () => {
    expectTypeOf<TreeProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<TreeItemProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
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

  it('typeahead from a nested item searches onward from that item, not from its parent', async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandedItems: ['docs', 'images'] });
    act(() => item('Personal.txt').focus());
    await user.keyboard('p');
    expect(item('Photo.jpg')).toHaveFocus();
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
    expect(collapsedChevron).toHaveClass('rtl:-scale-x-100');
    expect(expandedChevron).toHaveClass('rotate-90');
    expect(expandedChevron).not.toHaveClass('rtl:-scale-x-100');
  });
});
