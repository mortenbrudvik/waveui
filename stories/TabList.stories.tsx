import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TabList } from '../src';

const meta = {
  title: 'Layout/TabList',
  component: TabList,
} satisfies Meta<typeof TabList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultSelectedValue: 'tab1',
  },
  render: (args) => (
    <TabList {...args}>
      <TabList.Tab value="tab1">Tab 1</TabList.Tab>
      <TabList.Tab value="tab2">Tab 2</TabList.Tab>
      <TabList.Tab value="tab3">Tab 3</TabList.Tab>
      <TabList.Panel value="tab1">Content for Tab 1</TabList.Panel>
      <TabList.Panel value="tab2">Content for Tab 2</TabList.Panel>
      <TabList.Panel value="tab3">Content for Tab 3</TabList.Panel>
    </TabList>
  ),
};

export const Vertical: Story = {
  args: {
    defaultSelectedValue: 'tab1',
    vertical: true,
  },
  render: (args) => (
    <TabList {...args}>
      <TabList.Tab value="tab1">Profile</TabList.Tab>
      <TabList.Tab value="tab2">Settings</TabList.Tab>
      <TabList.Tab value="tab3">Notifications</TabList.Tab>
      <TabList.Panel value="tab1">Profile content goes here.</TabList.Panel>
      <TabList.Panel value="tab2">Settings content goes here.</TabList.Panel>
      <TabList.Panel value="tab3">Notification preferences.</TabList.Panel>
    </TabList>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [selected, setSelected] = React.useState('tab1');
    return (
      <TabList selectedValue={selected} onTabSelect={setSelected}>
        <TabList.Tab value="tab1">Overview</TabList.Tab>
        <TabList.Tab value="tab2">Details</TabList.Tab>
        <TabList.Tab value="tab3">History</TabList.Tab>
        <TabList.Panel value="tab1">Overview content.</TabList.Panel>
        <TabList.Panel value="tab2">Details content.</TabList.Panel>
        <TabList.Panel value="tab3">History content.</TabList.Panel>
      </TabList>
    );
  },
};
