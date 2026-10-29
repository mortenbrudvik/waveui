import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  FlatTree,
  useFlatTree,
  useVirtualWindow,
  type FlatTreeItemData,
  type FlatTreeModel,
  type FlatTreeProps,
  type UseFlatTreeOptions,
} from '../src';

/** The args of the stories: the FlatTree's props, and the items and options of its model. */
type FlatTreeStoryArgs = Omit<FlatTreeProps, 'model' | 'virtualWindow'> &
  Omit<UseFlatTreeOptions, 'selectionMode'> & {
    /** The items of `useFlatTree(items, options)`: flat, each placed by its `parentValue`. */
    items: readonly FlatTreeItemData[];
  };

/** Builds the model from the story's args and returns it with the FlatTree's own args. */
function useStoryModel({
  items,
  expandedItems,
  defaultExpandedItems,
  onExpandedItemsChange,
  checkedItems,
  defaultCheckedItems,
  onCheckedItemsChange,
  selectionMode,
  ...args
}: FlatTreeStoryArgs): [FlatTreeModel, Omit<FlatTreeProps, 'model'>] {
  const model = useFlatTree(items, {
    expandedItems,
    defaultExpandedItems,
    onExpandedItemsChange,
    checkedItems,
    defaultCheckedItems,
    onCheckedItemsChange,
    selectionMode,
  });
  return [model, args];
}

/** A FlatTree over the items of the args, with the model's props spread on it. */
function FlatTreeStory(storyArgs: FlatTreeStoryArgs) {
  const [model, args] = useStoryModel(storyArgs);
  return <FlatTree {...args} model={model} {...model.getTreeProps()} />;
}

const FILES: FlatTreeItemData[] = [
  { value: 'docs', label: 'Documents' },
  { value: 'work', parentValue: 'docs', label: 'Work' },
  { value: 'report', parentValue: 'work', label: 'Annual Report.docx' },
  { value: 'slides', parentValue: 'work', label: 'Presentation.pptx' },
  { value: 'personal', parentValue: 'docs', label: 'Personal' },
  { value: 'resume', parentValue: 'personal', label: 'Resume.pdf' },
  { value: 'images', label: 'Images' },
  { value: 'photo1', parentValue: 'images', label: 'vacation.jpg' },
  { value: 'photo2', parentValue: 'images', label: 'profile.png' },
  { value: 'readme', label: 'README.md' },
];

/**
 * `FlatTree` typed with the story args. The runtime component is the same (Storybook reads its
 * docs from it); the stories build its `model` from `items` and the model's options.
 */
const FlatTreeWithStoryArgs = FlatTree as unknown as React.ComponentType<FlatTreeStoryArgs>;

const meta = {
  title: 'Components/Layout/FlatTree',
  component: FlatTreeWithStoryArgs,
  args: {
    'aria-label': 'File explorer',
    items: FILES,
    style: { width: 280 },
    onItemSelect: fn(),
    onExpandedItemsChange: fn(),
    onCheckedItemsChange: fn(),
  },
  argTypes: {
    items: { control: false },
    renderItem: { control: false },
    expandedItems: { control: false },
    checkedItems: { control: false },
  },
  render: (args) => <FlatTreeStory {...args} />,
} satisfies Meta<FlatTreeStoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Items listed flat, each with the `value` of its parent, become a tree: Up/Down, Home/End,
 * Right/Left (expand, collapse, child, parent), Enter, `*` and typeahead.
 */
export const Default: Story = {
  args: {
    defaultExpandedItems: ['docs'],
  },
};

/** `selectionMode="multiple"`: a checkbox on every item; checks cascade through the branches. */
export const Checkable: Story = {
  args: {
    'aria-label': 'Files to back up',
    selectionMode: 'multiple',
    defaultExpandedItems: ['docs', 'work'],
    defaultCheckedItems: ['work'],
  },
};

const ENTRIES = 4000;
const FOLDERS = 333;

/** 5,000 items: an archive of 4,000 entries, then 333 folders of two files each. */
const FIVE_THOUSAND: FlatTreeItemData[] = [
  { value: 'archive', label: 'Archive' },
  ...Array.from({ length: ENTRIES }, (_, i) => ({
    value: `entry-${i}`,
    parentValue: 'archive',
    label: `Entry ${i + 1}`,
  })),
  ...Array.from({ length: FOLDERS }, (_, i) => [
    { value: `folder-${i}`, label: `Folder ${i + 1}` },
    { value: `folder-${i}-a`, parentValue: `folder-${i}`, label: `Notes ${i + 1}.txt` },
    { value: `folder-${i}-b`, parentValue: `folder-${i}`, label: `Photo ${i + 1}.jpg` },
  ]).flat(),
];

/** Counts the items the tree in `tree` has rendered, followed with a MutationObserver. */
function MountedItems({ tree, visible }: { tree: HTMLElement | null; visible: number }) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!tree) return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(tree, { childList: true });
      return () => observer.disconnect();
    },
    [tree],
  );
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => tree?.querySelectorAll(':scope > [role="treeitem"]').length ?? 0,
    () => 0,
  );
  const total = FIVE_THOUSAND.length.toLocaleString('en');
  return (
    <p className="text-body-1 text-foreground">
      {`Mounted items: ${mounted} of ${visible.toLocaleString('en')} visible (${total} in the tree)`}
    </p>
  );
}

/** The windowed tree of 5,000 items, in a scroller 400 pixels tall with items 28 pixels tall. */
function FiveThousandTree(storyArgs: FlatTreeStoryArgs) {
  const [model, args] = useStoryModel(storyArgs);
  const virtualWindow = useVirtualWindow({ itemSize: 28 });
  const [tree, setTree] = React.useState<HTMLDivElement | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <FlatTree
        {...args}
        ref={setTree}
        model={model}
        {...model.getTreeProps()}
        virtualWindow={virtualWindow}
      />
      <MountedItems tree={tree} visible={model.visibleItems.length} />
    </div>
  );
}

/**
 * 5,000 items with `virtualWindow`, the archive of 4,000 expanded: only the items in view (and a
 * few beyond) are rendered, as the line below the tree counts. The keys and typeahead reach any
 * visible item, and the focused item stays rendered while it is scrolled away.
 */
export const FiveThousandNodes: Story = {
  args: {
    'aria-label': 'Archive',
    items: FIVE_THOUSAND,
    defaultExpandedItems: ['archive'],
    className: 'h-100',
  },
  render: (args) => <FiveThousandTree {...args} />,
};
