import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  Button,
  RadioGroup,
  RadioItem,
  cn,
  focusRing,
  useId,
  useRadioGroupContext,
  useRadioGroupItem,
} from '../src';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Input/RadioGroup',
  component: RadioGroup,
  argTypes: {
    ...orientationArgType,
  },
  args: {
    'aria-label': 'Favorite fruit',
    onValueChange: fn(),
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 'apple',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioItem value="apple" label="Apple" />
      <RadioItem value="banana" label="Banana" />
      <RadioItem value="cherry" label="Cherry" />
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  args: {
    'aria-label': 'Size',
    orientation: 'horizontal',
    defaultValue: 'medium',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioItem value="small" label="Small" />
      <RadioItem value="medium" label="Medium" />
      <RadioItem value="large" label="Large" />
    </RadioGroup>
  ),
};

/** `RadioGroup.Item` is the dotted form of `RadioItem` (use the flat names from Server Components). */
export const DottedItems: Story = {
  args: {
    'aria-label': 'Delivery',
    defaultValue: 'standard',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioGroup.Item value="standard" label="Standard" />
      <RadioGroup.Item value="express" label="Express" />
    </RadioGroup>
  ),
};

/** The group-level `disabled` prop disables every item. */
export const Disabled: Story = {
  args: {
    'aria-label': 'Disabled group',
    defaultValue: 'a',
    disabled: true,
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioItem value="a" label="Option A" />
      <RadioItem value="b" label="Option B" />
    </RadioGroup>
  ),
};

/** A disabled item is skipped by the arrow keys and never holds the tab stop. */
export const DisabledItem: Story = {
  args: {
    'aria-label': 'Plan',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioItem value="free" label="Free" disabled />
      <RadioItem value="pro" label="Pro" />
      <RadioItem value="team" label="Team" />
    </RadioGroup>
  ),
};

export const Controlled: Story = {
  args: {
    'aria-label': 'Color',
  },
  render: function ControlledRadioGroup(args) {
    const [value, setValue] = useState('red');
    return (
      <div className="flex flex-col gap-2">
        <RadioGroup
          {...args}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            args.onValueChange?.(next);
          }}
        >
          <RadioItem value="red" label="Red" />
          <RadioItem value="green" label="Green" />
          <RadioItem value="blue" label="Blue" />
        </RadioGroup>
        <p className="text-body-1 text-foreground">Selected: {value}</p>
      </div>
    );
  },
};

/** With `name` and `required`, the selected value is submitted and validated like native radios. */
export const InForm: Story = {
  args: {
    'aria-label': 'Shipping speed',
    name: 'shipping',
    required: true,
  },
  render: (args) => (
    <form className="flex flex-col items-start gap-3" onSubmit={(e) => e.preventDefault()}>
      <RadioGroup {...args}>
        <RadioItem value="standard" label="Standard" />
        <RadioItem value="express" label="Express" />
      </RadioGroup>
      <Button type="submit" appearance="primary">
        Continue
      </Button>
    </form>
  ),
};

/**
 * `label` takes rich content: here a second line of subtext. The whole text names each radio, and
 * the radio lines up with the first line.
 */
export const LabelWithSubtext: Story = {
  args: {
    'aria-label': 'Delivery speed',
    defaultValue: 'standard',
  },
  render: (args) => {
    const option = (title: string, detail: string) => (
      <span className="flex flex-col">
        <span>{title}</span> <span className="text-caption-1 text-muted-foreground">{detail}</span>
      </span>
    );
    return (
      <RadioGroup {...args}>
        <RadioItem
          value="standard"
          label={option('Standard', 'Arrives in 3 to 5 business days.')}
        />
        <RadioItem
          value="express"
          label={option('Express', 'Arrives tomorrow when ordered before 14:00.')}
        />
      </RadioGroup>
    );
  },
};

interface PlanCardProps {
  value: string;
  title: string;
  description: string;
  disabled?: boolean;
}

/** A radio card of your own: `useRadioGroupItem` gives the props that make it a radio of the group. */
function PlanCard({ value, title, description, disabled: disabledProp }: PlanCardProps) {
  const id = useId('plan');
  const { props, checked, disabled } = useRadioGroupItem(value, { disabled: disabledProp });
  return (
    <div
      {...props}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className={cn(
        'flex w-72 items-start gap-3 rounded-md border-2 bg-background p-3',
        focusRing,
        checked ? 'border-primary' : 'border-stroke-accessible',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-primary' : 'border-stroke-accessible',
        )}
      >
        {checked && (
          <span className="size-2 rounded-full bg-primary forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none" />
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span id={`${id}-title`} className="text-body-1 font-semibold text-foreground">
          {title}
        </span>
        <span id={`${id}-description`} className="text-caption-1 text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  );
}

/** Reads the group's choice with `useRadioGroupContext`. */
function PlanSummary() {
  const { value } = useRadioGroupContext();
  return (
    <div className="text-body-1 text-foreground">
      {value === undefined ? 'No plan chosen' : `Chosen plan: ${value}`}
    </div>
  );
}

/**
 * Cards of your own as the radios of a group, built on `useRadioGroupItem`: each card spreads the
 * returned props and is named by its title and described by its text. The arrow keys move between
 * the cards and select (the disabled Team card is skipped), Space selects, and Tab leaves the
 * group. The line below the cards reads the choice with `useRadioGroupContext`.
 */
export const CustomRadioCard: Story = {
  args: {
    'aria-label': 'Plan',
    defaultValue: 'pro',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <PlanCard value="free" title="Free" description="One project and community support." />
      <PlanCard value="pro" title="Pro" description="Unlimited projects and email support." />
      <PlanCard
        value="team"
        title="Team"
        description="Shared workspaces. Ask your administrator to enable it."
        disabled
      />
      <PlanSummary />
    </RadioGroup>
  ),
};
