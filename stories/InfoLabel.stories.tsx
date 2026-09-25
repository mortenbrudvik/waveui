import type { Meta, StoryObj } from '@storybook/react';
import { InfoLabel } from '../src';

const meta = {
  title: 'Components/Data Display/InfoLabel',
  component: InfoLabel,
  args: {
    label: 'Username',
    info: 'Your unique identifier for this account.',
  },
} satisfies Meta<typeof InfoLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hover the info button, tab to it or click it to show the information; Escape closes it. */
export const Default: Story = {};

export const WithInfo: Story = {
  args: {
    label: 'Password strength',
    info: 'Use at least 8 characters with a mix of letters, numbers, and symbols.',
  },
};

/** `infoButtonLabel` localises the accessible name of the info button. */
export const LocalizedButtonLabel: Story = {
  args: {
    label: 'Benutzername',
    info: 'Ihre eindeutige Kennung für dieses Konto.',
    infoButtonLabel: 'Weitere Informationen',
  },
};
