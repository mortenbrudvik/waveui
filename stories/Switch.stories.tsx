import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Switch } from '../src';

const meta = {
  title: 'Components/Input/Switch',
  component: Switch,
  args: {
    label: 'Enable notifications',
    onCheckedChange: fn(),
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Dark mode',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled switch',
    disabled: true,
  },
};

/** No visible label: the switch is named with `aria-label`, which is routed to the switch control. */
export const WithoutVisibleLabel: Story = {
  args: {
    label: undefined,
    'aria-label': 'Airplane mode',
  },
};

/** With `name`, the switch submits `name=value` while on, like a native checkbox. */
export const InForm: Story = {
  args: {
    name: 'notifications',
    value: 'on',
  },
  render: (args) => (
    <form className="flex flex-col items-start gap-3" onSubmit={(e) => e.preventDefault()}>
      <Switch {...args} />
      <Button type="submit" appearance="primary">
        Save
      </Button>
    </form>
  ),
};

/**
 * `labelPosition` puts the label after the switch (default), before it or above it. A settings
 * list puts the labels before the switches and spreads each row across the width.
 */
export const LabelPositions: Story = {
  render: (args) => (
    <div className="flex w-80 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Switch {...args} label="Wi-Fi" labelPosition="before" className="flex justify-between" />
        <Switch
          {...args}
          label="Bluetooth"
          labelPosition="before"
          className="flex justify-between"
          defaultChecked
        />
        <Switch
          {...args}
          label="Airplane mode"
          labelPosition="before"
          className="flex justify-between"
        />
      </div>
      <Switch {...args} label="Label above" labelPosition="above" />
      <Switch {...args} label="Label after (default)" />
    </div>
  ),
};

/**
 * `disabledFocusable` keeps the switch in the tab order while it cannot be toggled, so keyboard
 * and screen-reader users reach it and hear why (here through `aria-describedby`). It is not
 * submitted with its form.
 */
export const DisabledFocusable: Story = {
  args: {
    label: 'Automatic updates',
    disabledFocusable: true,
    defaultChecked: true,
    'aria-describedby': 'updates-reason',
  },
  render: (args) => (
    <div className="flex flex-col items-start gap-1">
      <Switch {...args} />
      <p id="updates-reason" className="text-caption-1 text-muted-foreground">
        Managed by your organization.
      </p>
    </div>
  ),
};
