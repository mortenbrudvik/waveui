import type { Meta, StoryObj } from '@storybook/react';
import { Menu } from '../src';

const meta = {
  title: 'Components/Navigation/Menu',
  component: Menu,
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Menu>
      <Menu.Item>New File</Menu.Item>
      <Menu.Item>Open File</Menu.Item>
      <Menu.Item>Save</Menu.Item>
    </Menu>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <Menu>
      <Menu.Item icon={{ children: '\u2702\uFE0F' }}>Cut</Menu.Item>
      <Menu.Item icon={{ children: '\uD83D\uDCCB' }}>Copy</Menu.Item>
      <Menu.Item icon={{ children: '\uD83D\uDCCC' }}>Paste</Menu.Item>
    </Menu>
  ),
};

export const WithDisabled: Story = {
  render: () => (
    <Menu>
      <Menu.Item>Undo</Menu.Item>
      <Menu.Item>Redo</Menu.Item>
      <Menu.Item disabled>Paste (empty clipboard)</Menu.Item>
    </Menu>
  ),
};

export const WithDivider: Story = {
  render: () => (
    <Menu>
      <Menu.Item>New File</Menu.Item>
      <Menu.Item>Open File</Menu.Item>
      <Menu.Divider />
      <Menu.Item>Save</Menu.Item>
      <Menu.Item>Save As</Menu.Item>
      <Menu.Divider />
      <Menu.Item>Exit</Menu.Item>
    </Menu>
  ),
};

export const WithShortcuts: Story = {
  render: () => (
    <Menu>
      <Menu.Item shortcut="Ctrl+N">New File</Menu.Item>
      <Menu.Item shortcut="Ctrl+O">Open File</Menu.Item>
      <Menu.Divider />
      <Menu.Item shortcut="Ctrl+S">Save</Menu.Item>
      <Menu.Item shortcut="Ctrl+Shift+S">Save As</Menu.Item>
    </Menu>
  ),
};
