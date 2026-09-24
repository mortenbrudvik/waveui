import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Tree } from '../src';

const meta = {
  title: 'Components/Layout/Tree',
  component: Tree,
  args: {
    'aria-label': 'File explorer',
    style: { width: 280 },
    onItemSelect: fn(),
    onExpandedItemsChange: fn(),
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

/** Controlled expansion and selection: `expandedItems`, `selected` and `onItemSelect`. */
export const ControlledSelection: Story = {
  render: function ControlledTree(args) {
    const [expanded, setExpanded] = React.useState<string[]>(['docs']);
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
