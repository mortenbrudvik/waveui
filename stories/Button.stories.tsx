import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button } from '../src';
import type { Size } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

/** Decorative inline icon (the Button hides its icon slot from assistive technology). */
const PaperclipIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path
      d="M10.5 4.5 5.8 9.2a1.5 1.5 0 0 0 2.1 2.1l4.7-4.7a3 3 0 0 0-4.2-4.2L3.7 7.1a4.5 4.5 0 0 0 6.4 6.4l3.4-3.4"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const meta = {
  title: 'Components/Button/Button',
  component: Button,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
  args: {
    onClick: fn(),
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
    children: 'Attach file',
    icon: <PaperclipIcon />,
  },
};

/** An icon-only button has no visible label, so it needs an `aria-label`. */
export const IconOnly: Story = {
  args: {
    icon: <PaperclipIcon />,
    'aria-label': 'Attach file',
  },
};

const sizes: Size[] = ['extra-small', 'small', 'medium', 'large', 'extra-large'];

/** Every size side by side (the size control is off here: each button sets its own size). */
export const Sizes: Story = {
  argTypes: {
    size: { control: false },
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      {sizes.map((size) => (
        <Button key={size} {...args} size={size}>
          {size}
        </Button>
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};

/** `as="a"` renders a link styled as a button; the props are typed for the anchor. */
export const AsLink: Story = {
  args: {
    as: 'a',
    href: '#button-docs',
    children: 'Read the docs',
  },
};

/** A disabled link drops its `href` and gets `aria-disabled` and `tabIndex={-1}`. */
export const DisabledLink: Story = {
  args: {
    as: 'a',
    href: '#button-docs',
    children: 'Read the docs',
    disabled: true,
  },
};
