import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SpinButton } from '../src';

const meta = {
  title: 'Components/Input/SpinButton',
  component: SpinButton,
} satisfies Meta<typeof SpinButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 0,
  },
};

export const MinMax: Story = {
  args: {
    defaultValue: 5,
    min: 0,
    max: 10,
  },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState(42);
    return (
      <div>
        <SpinButton value={value} onChange={setValue} min={0} max={100} step={5} />
        <p style={{ marginTop: 8 }}>Value: {value}</p>
      </div>
    );
  },
};
