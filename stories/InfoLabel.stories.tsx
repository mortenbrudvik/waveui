import type { Meta, StoryObj } from '@storybook/react';
import { Field, InfoLabel, Input, Link } from '../src';

const meta = {
  title: 'Components/Data Display/InfoLabel',
  component: InfoLabel,
  args: {
    children: 'Username',
    info: 'Your unique identifier for this account.',
  },
} satisfies Meta<typeof InfoLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hover the info button, tab to it or click it to show the information; Escape closes it. */
export const Default: Story = {};

export const WithInfo: Story = {
  args: {
    children: 'Password strength',
    info: 'Use at least 8 characters with a mix of letters, numbers, and symbols.',
  },
};

/** `infoButtonLabel` localises the accessible name of the info button. */
export const LocalizedButtonLabel: Story = {
  args: {
    children: 'Benutzername',
    info: 'Ihre eindeutige Kennung für dieses Konto.',
    infoButtonLabel: 'Weitere Informationen',
  },
};

/** `info` can hold rich content: a link that stays reachable by Tab once the note is open. */
export const RichInfo: Story = {
  args: {
    children: 'Password',
    info: (
      <>
        Use at least 12 characters. <Link href="#password-rules">Learn more</Link>
      </>
    ),
  },
};

/** `openOnHover={false}`: hover and keyboard focus do nothing; only a click toggles the note. */
export const ClickOnly: Story = {
  args: {
    children: 'API key',
    info: 'Regenerating the key invalidates the previous one immediately.',
    openOnHover: false,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <InfoLabel {...args} size="small">
        Small
      </InfoLabel>
      <InfoLabel {...args} size="medium">
        Medium
      </InfoLabel>
      <InfoLabel {...args} size="large">
        Large
      </InfoLabel>
    </div>
  ),
};

export const Required: Story = {
  args: {
    children: 'Email address',
    required: true,
  },
};

/** As a Field's `label` element, in the vertical and horizontal layouts. */
export const InField: Story = {
  args: {
    children: 'Password',
    info: 'Use at least 12 characters.',
  },
  render: (args) => (
    <div className="flex flex-col gap-6">
      <Field label={<InfoLabel {...args} />} required>
        <Input type="password" placeholder="Enter a password" />
      </Field>
      <Field label={<InfoLabel {...args} />} orientation="horizontal" required>
        <Input type="password" placeholder="Enter a password" />
      </Field>
    </div>
  ),
};
