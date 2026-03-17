import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeachingPopover } from '../TeachingPopover';
import { testDisplayName } from '../../../test-utils';

const steps = [
  { title: 'Welcome', body: 'This is step one.' },
  { title: 'Features', body: 'Here are the features.' },
  { title: 'Done', body: 'You are all set!' },
];

describe('TeachingPopover', () => {
  testDisplayName(TeachingPopover, 'TeachingPopover');

  it('renders without crashing', () => {
    render(<TeachingPopover steps={steps} data-testid="tp" />);
    expect(screen.getByTestId('tp')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<TeachingPopover ref={ref} steps={steps} data-testid="tp" />);
    expect(ref.current).toBe(screen.getByTestId('tp'));
  });

  it('merges custom className', () => {
    render(<TeachingPopover steps={steps} data-testid="tp" className="custom" />);
    expect(screen.getByTestId('tp').className).toContain('custom');
  });

  it('renders nothing when open is false', () => {
    render(<TeachingPopover steps={steps} open={false} data-testid="tp" />);
    expect(screen.queryByTestId('tp')).not.toBeInTheDocument();
  });

  it('renders nothing when steps is empty', () => {
    render(<TeachingPopover steps={[]} data-testid="tp" />);
    expect(screen.queryByTestId('tp')).not.toBeInTheDocument();
  });

  it('displays the first step by default', () => {
    render(<TeachingPopover steps={steps} />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('This is step one.')).toBeInTheDocument();
  });

  it('displays the correct step when currentStep is set', () => {
    render(<TeachingPopover steps={steps} currentStep={1} />);
    expect(screen.getByText('Features')).toBeInTheDocument();
  });

  it('navigates to next step when Next is clicked', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(<TeachingPopover steps={steps} onStepChange={onStepChange} />);

    await user.click(screen.getByText('Next'));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('navigates back when Back is clicked', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(<TeachingPopover steps={steps} defaultCurrentStep={1} onStepChange={onStepChange} />);

    await user.click(screen.getByText('Back'));
    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it('does not show Back button on first step', () => {
    render(<TeachingPopover steps={steps} />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('shows Done button on last step', () => {
    render(<TeachingPopover steps={steps} currentStep={2} />);
    const buttons = screen.getAllByRole('button');
    const doneButton = buttons.find((b) => b.textContent === 'Done');
    expect(doneButton).toBeInTheDocument();
  });

  it('calls onDismiss when Done is clicked on last step', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<TeachingPopover steps={steps} currentStep={2} onDismiss={onDismiss} />);

    const buttons = screen.getAllByRole('button');
    const doneButton = buttons.find((b) => b.textContent === 'Done')!;
    await user.click(doneButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<TeachingPopover steps={steps} onDismiss={onDismiss} />);

    await user.click(screen.getByLabelText('Close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders step indicator dots', () => {
    render(<TeachingPopover steps={steps} />);
    const group = screen.getByRole('group', { name: 'Steps' });
    const dots = group.querySelectorAll('span[aria-hidden="true"]');
    expect(dots).toHaveLength(3);
  });

  it('highlights current step dot', () => {
    render(<TeachingPopover steps={steps} currentStep={1} />);
    const group = screen.getByRole('group', { name: 'Steps' });
    const dots = group.querySelectorAll('span[aria-hidden="true"]');
    expect(dots[1]).toHaveClass('bg-[#0f6cbd]');
    expect(dots[0]).toHaveClass('bg-[#d1d1d1]');
  });

  it('has role="dialog"', () => {
    render(<TeachingPopover steps={steps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onDismiss on Escape key', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<TeachingPopover steps={steps} onDismiss={onDismiss} />);

    const dialog = screen.getByRole('dialog');
    dialog.focus();
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
