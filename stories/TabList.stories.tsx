import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { TabList } from '../src';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Layout/TabList',
  component: TabList,
  argTypes: {
    ...orientationArgType,
  },
  args: {
    'aria-label': 'Sections',
    orientation: 'horizontal',
    onValueChange: fn(),
  },
} satisfies Meta<typeof TabList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Uncontrolled: without `defaultValue` the first enabled tab is selected. */
export const Default: Story = {
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

/** `orientation="vertical"`: Up/Down move between tabs. */
export const Vertical: Story = {
  args: {
    'aria-label': 'Account',
    defaultValue: 'tab1',
    orientation: 'vertical',
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

/** Controlled: `value` + `onValueChange`. */
export const Controlled: Story = {
  render: function ControlledTabList(args) {
    const [value, setValue] = React.useState('tab1');
    return (
      <TabList
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
      >
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

/** Disabled tabs are skipped by the arrow keys and cannot be selected. */
export const WithDisabledTab: Story = {
  args: {
    defaultValue: 'tab1',
  },
  render: (args) => (
    <TabList {...args}>
      <TabList.Tab value="tab1">Inbox</TabList.Tab>
      <TabList.Tab value="tab2" disabled>
        Archive
      </TabList.Tab>
      <TabList.Tab value="tab3">Sent</TabList.Tab>
      <TabList.Panel value="tab1">Inbox messages.</TabList.Panel>
      <TabList.Panel value="tab2">Archived messages.</TabList.Panel>
      <TabList.Panel value="tab3">Sent messages.</TabList.Panel>
    </TabList>
  ),
};

/** `TabList.Panels` groups the panels after the tablist (use it when panels are wrapped). */
export const WithPanelsContainer: Story = {
  args: {
    defaultValue: 'tab2',
  },
  render: (args) => (
    <TabList {...args}>
      <TabList.Tab value="tab1">Summary</TabList.Tab>
      <TabList.Tab value="tab2">Activity</TabList.Tab>
      <TabList.Panels className="bg-card">
        <TabList.Panel value="tab1">Summary content.</TabList.Panel>
        <TabList.Panel value="tab2">Activity content.</TabList.Panel>
      </TabList.Panels>
    </TabList>
  ),
};
