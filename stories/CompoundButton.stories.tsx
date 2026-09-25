import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { CompoundButton } from '../src';
import type { CompoundButtonProps, Size } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Button/CompoundButton',
  component: CompoundButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
  args: {
    children: 'Send mail',
    secondaryText: 'Opens your email client',
    onClick: fn(),
  },
} satisfies Meta<typeof CompoundButton>;

export default meta;
type Story = StoryObj<typeof meta>;
/** A story that renders the button as an anchor takes the anchor's props. */
type AnchorStory = StoryObj<CompoundButtonProps<'a'>>;

export const Default: Story = {};

export const WithoutSecondaryText: Story = {
  args: {
    children: 'Compound button',
    secondaryText: undefined,
  },
};

export const Primary: Story = {
  args: {
    appearance: 'primary',
    children: 'Create account',
    secondaryText: 'Free for 30 days',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

/** `as="a"` renders a link styled as a compound button. */
export const AsLink: AnchorStory = {
  args: {
    as: 'a',
    href: '#compound-button-docs',
    children: 'Read the guide',
    secondaryText: 'Five-minute introduction',
  },
};

const sizes: Size[] = ['small', 'medium', 'large'];

/** Several sizes side by side (the size control is off here: each button sets its own size). */
export const Sizes: Story = {
  argTypes: {
    size: { control: false },
  },
  render: (args) => (
    <div className="flex items-start gap-2">
      {sizes.map((size) => (
        <CompoundButton key={size} {...args} size={size} secondaryText={`${size} size`}>
          {size}
        </CompoundButton>
      ))}
    </div>
  ),
};
