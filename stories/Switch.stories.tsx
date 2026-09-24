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
