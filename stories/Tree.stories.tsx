import type { Meta, StoryObj } from '@storybook/react';
import { Tree } from '../src';

const meta = {
  title: 'Layout/Tree',
  component: Tree,
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tree aria-label="File explorer" style={{ width: 280 }}>
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
    </Tree>
  ),
};

export const DefaultExpanded: Story = {
  render: () => (
    <Tree aria-label="Source files" defaultExpandedItems={['src']} style={{ width: 280 }}>
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

export const WithIcons: Story = {
  render: () => (
    <Tree aria-label="Files with icons" style={{ width: 280 }}>
      <Tree.Item
        value="folder"
        icon={<span style={{ fontSize: 14 }}>&#128193;</span>}
      >
        Folder
        <Tree.Item
          value="file1"
          icon={<span style={{ fontSize: 14 }}>&#128196;</span>}
        >
          Document.txt
        </Tree.Item>
        <Tree.Item
          value="file2"
          icon={<span style={{ fontSize: 14 }}>&#128196;</span>}
        >
          Notes.md
        </Tree.Item>
      </Tree.Item>
    </Tree>
  ),
};
