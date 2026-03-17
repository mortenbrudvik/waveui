import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { RadioGroup, RadioItem } from '../src';

const meta = {
  title: 'Components/Input/RadioGroup',
  component: RadioGroup,
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'aria-label': 'Favorite fruit',
    defaultValue: 'apple',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioItem value="apple" label="Apple" />
      <RadioItem value="banana" label="Banana" />
      <RadioItem value="cherry" label="Cherry" />
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup aria-label="Size" orientation="horizontal" defaultValue="medium">
      <RadioItem value="small" label="Small" />
      <RadioItem value="medium" label="Medium" />
      <RadioItem value="large" label="Large" />
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup aria-label="Disabled group" defaultValue="a">
      <RadioItem value="a" label="Option A" disabled />
      <RadioItem value="b" label="Option B" disabled />
    </RadioGroup>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState('red');
    return (
      <div>
        <RadioGroup aria-label="Color" value={value} onChange={setValue}>
          <RadioItem value="red" label="Red" />
          <RadioItem value="green" label="Green" />
          <RadioItem value="blue" label="Blue" />
        </RadioGroup>
        <p style={{ marginTop: 8 }}>Selected: {value}</p>
      </div>
    );
  },
};
