import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stepper } from '../src';

const meta = {
  title: 'Components/Navigation/Stepper',
  component: Stepper,
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Stepper defaultActiveStep={1}>
      <Stepper.Step label="Account" description="Create your account" />
      <Stepper.Step label="Profile" description="Set up your profile" />
      <Stepper.Step label="Review" description="Review and submit" />
    </Stepper>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Stepper orientation="vertical" defaultActiveStep={1}>
      <Stepper.Step label="Select plan" description="Choose a subscription plan" />
      <Stepper.Step label="Payment" description="Enter payment details" />
      <Stepper.Step label="Confirmation" description="Review your order" />
      <Stepper.Step label="Complete" description="Order placed" />
    </Stepper>
  ),
};

export const WithError: Story = {
  render: () => (
    <Stepper defaultActiveStep={1}>
      <Stepper.Step label="Details" />
      <Stepper.Step label="Verification" error />
      <Stepper.Step label="Complete" />
    </Stepper>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <Stepper defaultActiveStep={1}>
      <Stepper.Step
        label="Cart"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" />
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

export const Linear: Story = {
  render: () => {
    const [step, setStep] = React.useState(0);
    return (
      <div className="flex flex-col gap-6">
        <Stepper activeStep={step} onStepChange={setStep} linear>
          <Stepper.Step label="Personal Info" />
          <Stepper.Step label="Address" />
          <Stepper.Step label="Payment" />
          <Stepper.Step label="Confirm" />
        </Stepper>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 border border-border rounded text-body-1"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white rounded text-body-1"
            disabled={step === 3}
            onClick={() => setStep(step + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  },
};
