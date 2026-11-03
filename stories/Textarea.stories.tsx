import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Textarea } from '../src';
import { coreSizeArgType, inputAppearanceArgType } from './_helpers';
import { SizeAppearanceGrid } from './_grids';

const meta = {
  title: 'Components/Input/Textarea',
  component: Textarea,
  argTypes: {
    ...coreSizeArgType,
    ...inputAppearanceArgType,
  },
  args: {
    'aria-label': 'Message',
    placeholder: 'Enter your message...',
    onChange: fn(),
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A string `error` renders the message after the textarea and links it to the textarea. */
export const Error: Story = {
  args: {
    'aria-label': 'Description',
    placeholder: 'Description',
    error: 'Description is required',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    disabled: true,
  },
};

export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Textarea
          {...args}
          rows={2}
          size={size}
          appearance={appearance}
          aria-label={`${size} ${appearance}`}
        />
      )}
    />
  ),
};

/** `resize` picks the directions the corner handle drags in: `vertical` (the default), `none`, `horizontal` or `both`. */
export const Resize: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(['none', 'vertical', 'horizontal', 'both'] as const).map((resize) => (
        <Textarea {...args} key={resize} rows={2} resize={resize} aria-label={`resize ${resize}`} />
      ))}
    </div>
  ),
};

/** `onValueChange` hands over the string, so a controlled textarea needs no event handler. */
export const Controlled: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('');
    return (
      <div className="flex flex-col gap-2">
        <Textarea {...args} value={value} onValueChange={setValue} />
        <span className="text-wave-caption-1 text-wave-muted-foreground">
          {value.length} characters
        </span>
      </div>
    );
  },
};
