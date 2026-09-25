import type { ArgTypes, Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { CompoundButton } from '../src';
import type { CompoundButtonProps, IconPosition, Size } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

/** Decorative calendar glyph; the CompoundButton sizes its icon box and the SVG fills it. */
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <rect x="3.5" y="5" width="17" height="15" rx="2" strokeWidth="1.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** `iconPosition` (`IconPosition`): before or after the text. */
const iconPositionArgType = {
  iconPosition: {
    control: 'inline-radio',
    options: ['before', 'after'] as const satisfies readonly IconPosition[],
  },
} satisfies ArgTypes;

const meta = {
  title: 'Components/Button/CompoundButton',
  component: CompoundButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
    ...iconPositionArgType,
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

/** The icon sits beside both lines of text in a 40px box (decorative, `aria-hidden`). */
export const WithIcon: Story = {
  args: {
    children: 'Schedule meeting',
    secondaryText: 'Next Monday at 9:00',
    icon: <CalendarIcon />,
  },
};

/** `iconPosition="after"` puts the icon at the inline end of the text (it mirrors in RTL). */
export const IconAfter: Story = {
  args: {
    children: 'Schedule meeting',
    secondaryText: 'Next Monday at 9:00',
    icon: <CalendarIcon />,
    iconPosition: 'after',
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
