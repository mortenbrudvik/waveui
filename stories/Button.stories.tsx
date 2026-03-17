import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Button/Button',
  component: Button,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Primary: Story = {
  args: {
    appearance: 'primary',
    children: 'Primary',
  },
};

export const Outline: Story = {
  args: {
    appearance: 'outline',
    children: 'Outline',
  },
};

export const Subtle: Story = {
  args: {
    appearance: 'subtle',
    children: 'Subtle',
  },
};

export const Transparent: Story = {
  args: {
    appearance: 'transparent',
    children: 'Transparent',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'With Icon',
    icon: { children: '📎' },
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Button size="extra-small">Extra Small</Button>
      <Button size="small">Small</Button>
      <Button size="medium">Medium</Button>
      <Button size="large">Large</Button>
      <Button size="extra-large">Extra Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};
