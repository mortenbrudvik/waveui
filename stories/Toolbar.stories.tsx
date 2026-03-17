import type { Meta, StoryObj } from '@storybook/react';
import { Toolbar, Button } from '../src';

const meta = {
  title: 'Components/Button/Toolbar',
  component: Toolbar,
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'aria-label': 'Default toolbar',
    children: 'Toolbar content',
  },
};

export const WithButtons: Story = {
  render: () => (
    <Toolbar aria-label="Formatting options">
      <Button appearance="subtle" size="small">Bold</Button>
      <Button appearance="subtle" size="small">Italic</Button>
      <Button appearance="subtle" size="small">Underline</Button>
    </Toolbar>
  ),
};
