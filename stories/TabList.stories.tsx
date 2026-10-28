import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { TabList } from '../src';
import { orientationArgType } from './_helpers';
import { motionCases } from './_motion';

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

/**
 * Manual activation (`selectTabOnFocus={false}`): the arrow keys, Home and End only move focus;
 * Enter, Space or a click selects the focused tab and shows its panel. Use it for panels that are
 * slow to show. The selected tab stays the tab stop, so Tab away and back returns to it.
 */
export const ManualActivation: Story = {
  args: {
    'aria-label': 'Reports',
    defaultValue: 'tab1',
    selectTabOnFocus: false,
  },
  render: (args) => (
    <TabList {...args}>
      <TabList.Tab value="tab1">Daily</TabList.Tab>
      <TabList.Tab value="tab2">Weekly</TabList.Tab>
      <TabList.Tab value="tab3">Monthly</TabList.Tab>
      <TabList.Panel value="tab1">Daily report.</TabList.Panel>
      <TabList.Panel value="tab2">Weekly report.</TabList.Panel>
      <TabList.Panel value="tab3">Monthly report.</TabList.Panel>
    </TabList>
  ),
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

/**
 * `TabList.Panels` groups the panels after the tablist: use it to style the panel area, and for
 * panels that components render themselves (the TabList cannot see those in its children).
 */
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

const TabGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a4 4 0 100 8 4 4 0 000-8zM4 18a6 6 0 0112 0H4z" />
  </svg>
);

/** Four looks: `transparent` (default), `subtle`, `subtle-circular` and `filled-circular`. */
export const Appearances: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(['transparent', 'subtle', 'subtle-circular', 'filled-circular'] as const).map(
        (appearance) => (
          <TabList key={appearance} {...args} appearance={appearance} aria-label={appearance}>
            <TabList.Tab value="one">One</TabList.Tab>
            <TabList.Tab value="two">Two</TabList.Tab>
            <TabList.Tab value="three">Three</TabList.Tab>
          </TabList>
        ),
      )}
    </div>
  ),
};

/** `size` small, medium and large. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(['small', 'medium', 'large'] as const).map((size) => (
        <TabList key={size} {...args} size={size} aria-label={size}>
          <TabList.Tab value="one">One</TabList.Tab>
          <TabList.Tab value="two">Two</TabList.Tab>
        </TabList>
      ))}
    </div>
  ),
};

/** A tab with an icon and no text needs its own name (`aria-label`). */
export const IconOnly: Story = {
  render: (args) => (
    <TabList {...args} aria-label="Views">
      <TabList.Tab value="people" icon={<TabGlyph />} aria-label="People" />
      <TabList.Tab value="teams" icon={<TabGlyph />} aria-label="Teams" />
      <TabList.Tab value="all" icon={<TabGlyph />}>
        All
      </TabList.Tab>
    </TabList>
  ),
};

/** The Motion story's line: it glides over 500ms with the max easy-ease curve. */
const slowSlide =
  'after:transition-[translate,scale] after:duration-wave-ultra-slow after:ease-wave-easy-ease-max motion-reduce:after:transition-none';

/**
 * `motion` of the selection line (the `transparent` appearance). By default, when the selection
 * moves, the line slides and stretches from the tab selected before to the new one over 300ms,
 * also in a vertical list (pick `orientation` in the controls) and right to left. `null` moves it
 * at once; a class string replaces its timing, written for the line, the tab's `::after` (here a
 * slower glide). Under reduced motion the line moves at once.
 */
export const Motion: Story = {
  render: ({ 'aria-label': _label, ...args }) => (
    <div className="flex flex-col gap-6">
      {motionCases(slowSlide).map(({ label, motion }) => (
        // The story renders one tab list per case; every other arg is forwarded.
        <TabList key={label} {...args} aria-label={label} motion={motion}>
          <TabList.Tab value="overview">Overview</TabList.Tab>
          <TabList.Tab value="activity">Recent activity</TabList.Tab>
          <TabList.Tab value="settings">Settings</TabList.Tab>
        </TabList>
      ))}
    </div>
  ),
};
