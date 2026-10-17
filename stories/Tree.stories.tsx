import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Badge, Button, Tree } from '../src';

const meta = {
  title: 'Components/Layout/Tree',
  component: Tree,
  args: {
    'aria-label': 'File explorer',
    style: { width: 280 },
    onItemSelect: fn(),
    onExpandedItemsChange: fn(),
    onCheckedItemsChange: fn(),
  },
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

const files = (
  <>
    <Tree.Item value="docs">
      Documents
      <Tree.Item value="work">
        Work
        <Tree.Item value="report">Annual Report.docx</Tree.Item>
        <Tree.Item value="slides">Presentation.pptx</Tree.Item>
      </Tree.Item>
      <Tree.Item value="personal">
        Personal
        <Tree.Item value="resume">Resume.pdf</Tree.Item>
      </Tree.Item>
    </Tree.Item>
    <Tree.Item value="images">
      Images
      <Tree.Item value="photo1">vacation.jpg</Tree.Item>
      <Tree.Item value="photo2">profile.png</Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme">README.md</Tree.Item>
  </>
);

/**
 * Keyboard: Up/Down, Home/End, Right/Left (expand, collapse, child, parent), Enter, `*`,
 * typeahead.
 */
export const Default: Story = {
  render: (args) => <Tree {...args}>{files}</Tree>,
};

/** `defaultExpandedItems` expands items on load (uncontrolled). */
export const DefaultExpanded: Story = {
  args: {
    'aria-label': 'Source files',
    defaultExpandedItems: ['src'],
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="src">
        src
        <Tree.Item value="components">
          components
          <Tree.Item value="button">Button.tsx</Tree.Item>
          <Tree.Item value="input">Input.tsx</Tree.Item>
        </Tree.Item>
        <Tree.Item value="index">index.ts</Tree.Item>
      </Tree.Item>
      <Tree.Item value="package">package.json</Tree.Item>
    </Tree>
  ),
};

/** The `icon` slot is decorative (`aria-hidden`); the label names the item. */
export const WithIcons: Story = {
  args: {
    'aria-label': 'Files with icons',
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="folder" icon={{ children: '📁', style: { fontSize: 14 } }}>
        Folder
        <Tree.Item value="file1" icon={{ children: '📄', style: { fontSize: 14 } }}>
          Document.txt
        </Tree.Item>
        <Tree.Item value="file2" icon={{ children: '📄', style: { fontSize: 14 } }}>
          Notes.md
        </Tree.Item>
      </Tree.Item>
    </Tree>
  ),
};

/**
 * Controlled expansion and selection: `expandedItems`, `selected` and `onItemSelect`. The selected
 * item is visible on load, and Tab enters the tree there.
 */
export const ControlledSelection: Story = {
  render: function ControlledTree(args) {
    const [expanded, setExpanded] = React.useState<readonly string[]>(['docs', 'work']);
    const [selected, setSelected] = React.useState<string | null>('report');
    return (
      <Tree
        {...args}
        expandedItems={expanded}
        onExpandedItemsChange={(next) => {
          setExpanded(next);
          args.onExpandedItemsChange?.(next);
        }}
        selected={selected}
        current={selected}
        onItemSelect={(value) => {
          setSelected(value);
          args.onItemSelect?.(value);
        }}
      >
        {files}
      </Tree>
    );
  },
};

/**
 * `selectionMode="multiple"`: a checkbox on every item. Checking a folder checks everything in it,
 * and a folder shows mixed while only some of its items are checked. Space toggles the focused
 * item, a click on the checkbox toggles it, and a click elsewhere on the row still activates the
 * item.
 */
export const MultiSelect: Story = {
  args: {
    'aria-label': 'Files to back up',
    selectionMode: 'multiple',
    defaultExpandedItems: ['docs', 'work'],
    defaultCheckedItems: ['report'],
  },
  render: (args) => <Tree {...args}>{files}</Tree>,
};

/**
 * Controlled checks: `checkedItems` and `onCheckedItemsChange`, which receives every checked item
 * in tree order (a fully checked folder included) and `details` (`value`, `checked`, `event`).
 */
export const ControlledChecks: Story = {
  args: {
    'aria-label': 'Files to share',
    selectionMode: 'multiple',
    defaultExpandedItems: ['docs'],
  },
  render: function ControlledChecksTree(args) {
    const [checked, setChecked] = React.useState<string[]>(['personal']);
    return (
      <div>
        <Tree
          {...args}
          checkedItems={checked}
          onCheckedItemsChange={(next, details) => {
            setChecked(next);
            args.onCheckedItemsChange?.(next, details);
          }}
        >
          {files}
        </Tree>
        <p className="mt-2 text-caption-1 text-muted-foreground">
          Checked: {checked.length > 0 ? checked.join(', ') : 'none'}
        </p>
      </div>
    );
  },
};

/** `selectionMode="single"`: a radio on every item for `selected`, updated from `onItemSelect`. */
export const SingleSelect: Story = {
  args: {
    'aria-label': 'Save to folder',
    selectionMode: 'single',
    defaultExpandedItems: ['docs'],
  },
  render: function SingleSelectTree(args) {
    const [selected, setSelected] = React.useState<string | null>('work');
    return (
      <Tree
        {...args}
        selected={selected}
        onItemSelect={(value) => {
          setSelected(value);
          args.onItemSelect?.(value);
        }}
      >
        {files}
      </Tree>
    );
  },
};

/**
 * A checked folder whose items load when it opens: they arrive checked, because their folder is
 * listed. The placeholder's value is dropped from the checked list when the real items replace
 * it, so it does not linger as a value no item has.
 */
export const LazyChildren: Story = {
  args: {
    'aria-label': 'Remote files',
    selectionMode: 'multiple',
  },
  render: function LazyChildrenTree(args) {
    const [checked, setChecked] = React.useState<string[]>(['remote']);
    const [expanded, setExpanded] = React.useState<string[]>([]);
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      if (loaded || !expanded.includes('remote')) return undefined;
      const timer = window.setTimeout(() => {
        setLoaded(true);
        setChecked((current) => current.filter((value) => value !== 'remote-loading'));
      }, 800);
      return () => window.clearTimeout(timer);
    }, [expanded, loaded]);
    return (
      <Tree
        {...args}
        expandedItems={expanded}
        onExpandedItemsChange={(next) => {
          setExpanded(next);
          args.onExpandedItemsChange?.(next);
        }}
        checkedItems={checked}
        onCheckedItemsChange={(next, details) => {
          setChecked(next);
          args.onCheckedItemsChange?.(next, details);
        }}
      >
        <Tree.Item value="remote">
          Remote drive
          {loaded ? (
            <>
              <Tree.Item value="budget">Budget.xlsx</Tree.Item>
              <Tree.Item value="minutes">Minutes.docx</Tree.Item>
            </>
          ) : (
            <Tree.Item value="remote-loading">Loading…</Tree.Item>
          )}
        </Tree.Item>
        <Tree.Item value="local">Local notes.md</Tree.Item>
      </Tree>
    );
  },
};

/** Two text buttons for a row's actions. */
function RowButtons() {
  return (
    <>
      <Button size="small" appearance="subtle">
        Rename
      </Button>
      <Button size="small" appearance="subtle">
        Delete
      </Button>
    </>
  );
}

/** Folders and files whose rows have actions. */
const filesWithActions = (
  <>
    <Tree.Item value="docs" actions={<RowButtons />}>
      Documents
      <Tree.Item value="report" actions={<RowButtons />}>
        Annual Report.docx
      </Tree.Item>
      <Tree.Item value="slides" actions={<RowButtons />}>
        Presentation.pptx
      </Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme" actions={<RowButtons />}>
      README.md
    </Tree.Item>
  </>
);

/**
 * `actions`: buttons at the end of the row, in a toolbar named by the item. They show while the
 * row is hovered or the item has focus, and always on touch screens and in forced colors. Tab from
 * the focused item enters them; keys and clicks on them never activate the item.
 */
export const RowActions: Story = {
  args: {
    'aria-label': 'Files with actions',
    defaultExpandedItems: ['docs'],
  },
  render: (args) => <Tree {...args}>{filesWithActions}</Tree>,
};

/**
 * `navigationMode="treegrid"`: Right (Left in right-to-left layouts) moves from an item into its
 * actions and Left returns; the actions take no Tab stop, and Down on an open folder reaches its
 * first item. The roles stay `tree` and `treeitem`.
 */
export const TreegridNavigation: Story = {
  args: {
    'aria-label': 'Files, grid navigation',
    navigationMode: 'treegrid',
    defaultExpandedItems: ['docs'],
  },
  render: (args) => <Tree {...args}>{filesWithActions}</Tree>,
};

/**
 * `aside`: a count or a badge at the end of the row that describes the item. It gives way to the
 * actions on hover and focus, and sits beside them where they always show.
 */
export const AsideContent: Story = {
  args: {
    'aria-label': 'Mail folders',
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="inbox" aside="12 unread">
        Inbox
      </Tree.Item>
      <Tree.Item value="drafts" aside={<Badge appearance="tint">New</Badge>}>
        Drafts
      </Tree.Item>
      <Tree.Item
        value="junk"
        aside="40"
        actions={
          <Button size="small" appearance="subtle">
            Empty
          </Button>
        }
      >
        Junk
      </Tree.Item>
    </Tree>
  ),
};

/** `expandIcon` replaces the chevron (decorative, not rotated); `false` hides it. */
export const CustomExpandIcon: Story = {
  args: {
    'aria-label': 'Projects',
    defaultExpandedItems: ['web'],
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="web" expandIcon={{ children: '📂', style: { fontSize: 12 } }}>
        Website
        <Tree.Item value="home">Home page</Tree.Item>
      </Tree.Item>
      <Tree.Item value="app" expandIcon={false}>
        App
        <Tree.Item value="login">Login screen</Tree.Item>
      </Tree.Item>
    </Tree>
  ),
};

const team = [
  { id: 'kat', name: 'Kat Sharp', role: 'Product designer' },
  { id: 'luca', name: 'Luca Mora', role: 'Researcher' },
  { id: 'mia', name: 'Mia Lopez', role: 'Content designer' },
];

/**
 * `Tree.ItemPersonaLayout` lays out an item's label as a person: the item is named by the name and
 * described by the description, and typing a name moves to it.
 */
export const PersonaRows: Story = {
  args: {
    'aria-label': 'Team',
    defaultExpandedItems: ['design'],
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="design">
        Design
        {team.map((person) => (
          <Tree.Item key={person.id} value={person.id}>
            <Tree.ItemPersonaLayout
              media={<Avatar decorative name={person.name} size="small" />}
              description={person.role}
            >
              {person.name}
            </Tree.ItemPersonaLayout>
          </Tree.Item>
        ))}
      </Tree.Item>
    </Tree>
  ),
};
