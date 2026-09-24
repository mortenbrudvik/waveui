import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Stepper } from '../src';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Navigation/Stepper',
  component: Stepper,
  args: {
    defaultActiveStep: 1,
    orientation: 'horizontal',
    linear: false,
    onStepChange: fn(),
  },
  argTypes: {
    ...orientationArgType,
  },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Stepper {...args}>
      <Stepper.Step label="Account" description="Create your account" />
      <Stepper.Step label="Profile" description="Set up your profile" />
      <Stepper.Step label="Review" description="Review and submit" />
    </Stepper>
  ),
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
  render: (args) => (
    <Stepper {...args}>
      <Stepper.Step label="Select plan" description="Choose a subscription plan" />
      <Stepper.Step label="Payment" description="Enter payment details" />
      <Stepper.Step label="Confirmation" description="Review your order" />
      <Stepper.Step label="Complete" description="Order placed" />
    </Stepper>
  ),
};

/** An error step announces "Error:" before its number; a disabled step cannot be activated. */
export const WithErrorAndDisabled: Story = {
  render: (args) => (
    <Stepper {...args}>
      <Stepper.Step label="Details" />
      <Stepper.Step label="Verification" error />
      <Stepper.Step label="Extras" disabled />
      <Stepper.Step label="Complete" />
    </Stepper>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <Stepper {...args}>
      <Stepper.Step
        label="Cart"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" />
            <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" />
          </svg>
        }
      />
      <Stepper.Step
        label="Shipping"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="2" />
            <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
            <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        }
      />
      <Stepper.Step
        label="Payment"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M1 10h22" stroke="currentColor" strokeWidth="2" />
          </svg>
        }
      />
    </Stepper>
  ),
};

/** Controlled and linear: only the step after the active one can be reached. */
export const Linear: Story = {
  args: {
    linear: true,
  },
  render: ({ onStepChange, ...args }) => {
    const [step, setStep] = React.useState(0);
    const changeStep = (next: number) => {
      setStep(next);
      onStepChange?.(next);
    };
    const buttonClass =
      'rounded px-4 py-2 text-body-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';
    return (
      <div className="flex flex-col gap-6">
        <Stepper activeStep={step} onStepChange={changeStep} {...args}>
          <Stepper.Step label="Personal Info" />
          <Stepper.Step label="Address" />
          <Stepper.Step label="Payment" />
          <Stepper.Step label="Confirm" />
        </Stepper>
        <div className="flex gap-2">
          <button
            type="button"
            className={`${buttonClass} border border-border bg-background text-foreground`}
            disabled={step === 0}
            onClick={() => changeStep(step - 1)}
          >
            Back
          </button>
          <button
            type="button"
            className={`${buttonClass} border border-primary bg-primary text-primary-foreground`}
            disabled={step === 3}
            onClick={() => changeStep(step + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  },
};
