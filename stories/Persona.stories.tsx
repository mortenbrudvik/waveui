import type { Meta, StoryObj } from '@storybook/react';
import { Persona } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Data Display/Persona',
  component: Persona,
  argTypes: {
    ...sizeArgType,
    status: {
      control: 'select',
      options: ['available', 'busy', 'away', 'offline', 'do-not-disturb', 'out-of-office'],
    },
  },
  args: {
    name: 'Jane Doe',
    size: 'medium',
  },
} satisfies Meta<typeof Persona>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBadge: Story = {
  args: {
    status: 'available',
  },
};

export const WithSecondaryText: Story = {
  args: {
    secondaryText: 'Software Engineer',
    status: 'busy',
  },
};

export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/150?u=persona-story',
    secondaryText: 'Product Designer',
    status: 'away',
  },
};

/** Text can sit after, before or below the avatar. */
export const TextPositions: Story = {
  args: { secondaryText: 'Software engineer' },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-8">
      <Persona {...args} textPosition="after" />
      <Persona {...args} textPosition="before" />
      <Persona {...args} textPosition="below" />
    </div>
  ),
};

/** Up to four lines; the sizes scale the text, and `huge` is a 72 px avatar. */
export const FourLinesAndHuge: Story = {
  args: {
    size: 'huge',
    secondaryText: 'Software engineer',
    tertiaryText: 'Contoso, Oslo',
    quaternaryText: 'Available for review',
    status: 'available',
  },
};

/** `presenceOnly` shows the presence badge instead of the avatar. */
export const PresenceOnly: Story = {
  args: { presenceOnly: true, status: 'do-not-disturb', secondaryText: 'Do not disturb' },
};
