import type { ArgTypes, Meta, StoryObj } from '@storybook/react';
import { Checkbox, Field, Input, Select, Slider, Switch, Textarea } from '../src';
import type { ValidationState } from '../src';
import { orientationArgType } from './_helpers';

const validationStates = [
  'none',
  'error',
  'warning',
  'success',
] as const satisfies readonly ValidationState[];

/** Field `validationState` (`ValidationState`). */
const validationStateArgType = {
  validationState: { control: 'inline-radio', options: validationStates },
} satisfies ArgTypes;

const meta = {
  title: 'Components/Input/Field',
  component: Field,
  argTypes: {
    ...validationStateArgType,
    ...orientationArgType,
  },
  args: {
    label: 'Name',
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <Input placeholder="Enter your name" />
    </Field>
  ),
};

export const WithHint: Story = {
  args: {
    label: 'Email',
    hint: "We'll never share your email.",
  },
  render: (args) => (
    <Field {...args}>
      <Input type="email" placeholder="you@example.com" />
    </Field>
  ),
};

export const WithError: Story = {
  args: {
    label: 'Password',
    error: 'Password must be at least 8 characters.',
  },
  render: (args) => (
    <Field {...args}>
      <Input type="password" />
    </Field>
  ),
};

export const Required: Story = {
  args: {
    label: 'Username',
    required: true,
  },
  render: (args) => (
    <Field {...args}>
      <Input placeholder="Required field" />
    </Field>
  ),
};

export const WithSelect: Story = {
  args: {
    label: 'Country',
    hint: 'Where you live today.',
    required: true,
  },
  render: (args) => (
    <Field {...args}>
      <Select defaultValue="">
        <option value="" disabled>
          Choose a country
        </option>
        <option value="no">Norway</option>
        <option value="se">Sweden</option>
        <option value="dk">Denmark</option>
      </Select>
    </Field>
  ),
};

export const WithTextarea: Story = {
  args: {
    label: 'Description',
    error: 'Description is required.',
  },
  render: (args) => (
    <Field {...args}>
      <Textarea placeholder="Describe the issue" />
    </Field>
  ),
};

export const WithSlider: Story = {
  args: {
    label: 'Volume',
    hint: 'Applies to every output device.',
  },
  render: (args) => (
    <Field {...args}>
      <Slider min={0} max={100} defaultValue={40} />
    </Field>
  ),
};

/**
 * `validationMessage` in each `validationState`: `error` marks the control invalid and is
 * announced, `warning` is announced without marking it invalid, `success` and `none` are shown
 * only. Each state has its own icon and color (`none` has no icon).
 */
export const ValidationStates: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field
        {...args}
        label="Username"
        validationState="error"
        validationMessage="This username is taken."
      >
        <Input defaultValue="wave" />
      </Field>
      <Field
        {...args}
        label="Password"
        validationState="warning"
        validationMessage="This password is used often."
      >
        <Input type="password" defaultValue="password1" />
      </Field>
      <Field
        {...args}
        label="Display name"
        validationState="success"
        validationMessage="This name is available."
      >
        <Input defaultValue="Wave Rider" />
      </Field>
      <Field
        {...args}
        label="Nickname"
        validationState="none"
        validationMessage="Shown next to your comments."
      >
        <Input />
      </Field>
    </div>
  ),
};

/**
 * The hint stays visible below a validation message, so the rule the message refers to is still
 * on screen. Both describe the control, the message first.
 */
export const HintWithMessage: Story = {
  args: {
    label: 'Password',
    hint: 'At least 12 characters, with a number and a symbol.',
    error: 'The password is too short.',
  },
  render: (args) => (
    <Field {...args}>
      <Input type="password" defaultValue="short" />
    </Field>
  ),
};

/**
 * `orientation="horizontal"` puts each label in a start column beside its control: a compact
 * settings form. Messages and hints stay below the control.
 */
export const Horizontal: Story = {
  args: {
    orientation: 'horizontal',
  },
  render: (args) => (
    <form className="flex max-w-xl flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <Field {...args} label="Display name" hint="Shown to other people.">
        <Input defaultValue="Wave Rider" />
      </Field>
      <Field
        {...args}
        label="Email"
        validationState="warning"
        validationMessage="Not verified yet."
      >
        <Input type="email" defaultValue="wave@example.com" />
      </Field>
      <Field {...args} label="Notifications">
        <Switch label="Email me about replies" defaultChecked />
      </Field>
      <Field {...args} label="Newsletter">
        <Checkbox label="Send me the monthly newsletter" />
      </Field>
    </form>
  ),
};

/**
 * `validationMessageIcon` replaces the state icon (decorative); `null` shows no icon.
 */
export const CustomMessageIcon: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field
        {...args}
        label="Workspace"
        validationState="success"
        validationMessage="Saved to the cloud."
        validationMessageIcon={
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
            <path d="M3 9h6a2 2 0 0 0 0-4 3 3 0 0 0-6 1 1.5 1.5 0 0 0 0 3Z" />
          </svg>
        }
      >
        <Input defaultValue="Design team" />
      </Field>
      <Field
        {...args}
        label="Project"
        validationMessage="A project name is required."
        validationMessageIcon={null}
      >
        <Input />
      </Field>
    </div>
  ),
};
