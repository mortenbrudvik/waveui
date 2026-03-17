import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stepper } from '../Stepper';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

const defaultChildren = (
  <>
    <Stepper.Step label="Step 1" />
    <Stepper.Step label="Step 2" />
    <Stepper.Step label="Step 3" />
  </>
);

describe('Stepper', () => {
  testForwardRef(Stepper, 'div', { children: defaultChildren });
  testRestSpread(Stepper, { children: defaultChildren });
  testClassName(Stepper, { children: defaultChildren });

  it('renders with role="group" and aria-label', () => {
    render(
      <Stepper data-testid="stepper">
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" />
      </Stepper>,
    );
    const el = screen.getByTestId('stepper');
    expect(el).toHaveAttribute('role', 'group');
    expect(el).toHaveAttribute('aria-label', 'Progress');
  });

  it('renders all step labels', () => {
    render(
      <Stepper>
        <Stepper.Step label="Account" />
        <Stepper.Step label="Profile" />
        <Stepper.Step label="Review" />
      </Stepper>,
    );
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <Stepper>
        <Stepper.Step label="Account" description="Create your account" />
        <Stepper.Step label="Profile" />
      </Stepper>,
    );
    expect(screen.getByText('Create your account')).toBeInTheDocument();
  });

  it('shows active step with primary styling', () => {
    render(
      <Stepper defaultActiveStep={1}>
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" />
        <Stepper.Step label="Step 3" />
      </Stepper>,
    );
    // Active step label should have primary color
    const activeLabel = screen.getByText('Step 2');
    expect(activeLabel.className).toContain('text-primary');
  });

  it('shows completed checkmark for steps before active', () => {
    render(
      <Stepper defaultActiveStep={2}>
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" />
        <Stepper.Step label="Step 3" />
      </Stepper>,
    );
    // Completed steps should have checkmark SVGs
    const svgs = document.querySelectorAll('svg[aria-hidden="true"]');
    // At least one checkmark (for step 1 and step 2 which are completed)
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('handles step changes', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(
      <Stepper defaultActiveStep={0} onStepChange={onStepChange}>
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" />
        <Stepper.Step label="Step 3" />
      </Stepper>,
    );

    // Click on step 2 (index 1)
    await user.click(screen.getByText('Step 2'));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('renders in vertical orientation', () => {
    render(
      <Stepper orientation="vertical" data-testid="stepper">
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" />
      </Stepper>,
    );
    const stepper = screen.getByTestId('stepper');
    expect(stepper.className).toContain('flex-col');
  });

  it('restricts clicking in linear mode', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(
      <Stepper defaultActiveStep={0} linear onStepChange={onStepChange}>
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" />
        <Stepper.Step label="Step 3" />
      </Stepper>,
    );

    // Step 3 (index 2) should not be clickable when at step 0
    await user.click(screen.getByText('Step 3'));
    expect(onStepChange).not.toHaveBeenCalledWith(2);

    // Step 2 (index 1) should be clickable (activeStep + 1)
    await user.click(screen.getByText('Step 2'));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('shows error state', () => {
    render(
      <Stepper defaultActiveStep={1}>
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" error />
        <Stepper.Step label="Step 3" />
      </Stepper>,
    );
    const errorLabel = screen.getByText('Step 2');
    expect(errorLabel.className).toContain('text-error');
  });

  it('disables a step', () => {
    render(
      <Stepper>
        <Stepper.Step label="Step 1" />
        <Stepper.Step label="Step 2" disabled />
      </Stepper>,
    );
    // Disabled step should have aria-disabled
    const stepButton = screen.getByText('Step 2').closest('[role="button"]');
    expect(stepButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders custom icon', () => {
    render(
      <Stepper>
        <Stepper.Step label="Step 1" icon={<span data-testid="custom-icon">*</span>} />
      </Stepper>,
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
