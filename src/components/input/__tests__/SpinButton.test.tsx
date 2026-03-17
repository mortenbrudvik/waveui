import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpinButton } from '../SpinButton';
import { testSystemProps, testFocusEvents } from '../../../test-utils';

describe('SpinButton', () => {
  testSystemProps(SpinButton, {
    expectedTag: 'div',
    displayName: 'SpinButton',
    defaultProps: { 'aria-label': 'Quantity' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  testFocusEvents(SpinButton, { 'aria-label': 'Quantity' }, 'input');

  it('renders without crashing', () => {
    render(<SpinButton />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('renders increment and decrement buttons', () => {
    render(<SpinButton />);
    expect(screen.getByLabelText('Increment')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrement')).toBeInTheDocument();
  });

  it('shows default value of 0', () => {
    render(<SpinButton />);
    expect(screen.getByRole('spinbutton')).toHaveValue('0');
  });

  it('shows custom defaultValue', () => {
    render(<SpinButton defaultValue={10} />);
    expect(screen.getByRole('spinbutton')).toHaveValue('10');
  });

  it('increments value on increment button click', async () => {
    const user = userEvent.setup();
    render(<SpinButton defaultValue={5} />);
    await user.click(screen.getByLabelText('Increment'));
    expect(screen.getByRole('spinbutton')).toHaveValue('6');
  });

  it('decrements value on decrement button click', async () => {
    const user = userEvent.setup();
    render(<SpinButton defaultValue={5} />);
    await user.click(screen.getByLabelText('Decrement'));
    expect(screen.getByRole('spinbutton')).toHaveValue('4');
  });

  it('respects step prop', async () => {
    const user = userEvent.setup();
    render(<SpinButton defaultValue={0} step={5} />);
    await user.click(screen.getByLabelText('Increment'));
    expect(screen.getByRole('spinbutton')).toHaveValue('5');
  });

  it('clamps to max', async () => {
    const user = userEvent.setup();
    render(<SpinButton defaultValue={9} max={10} />);
    await user.click(screen.getByLabelText('Increment'));
    expect(screen.getByRole('spinbutton')).toHaveValue('10');
    await user.click(screen.getByLabelText('Increment'));
    expect(screen.getByRole('spinbutton')).toHaveValue('10');
  });

  it('clamps to min', async () => {
    const user = userEvent.setup();
    render(<SpinButton defaultValue={1} min={0} />);
    await user.click(screen.getByLabelText('Decrement'));
    expect(screen.getByRole('spinbutton')).toHaveValue('0');
    await user.click(screen.getByLabelText('Decrement'));
    expect(screen.getByRole('spinbutton')).toHaveValue('0');
  });

  it('disables increment at max', () => {
    render(<SpinButton defaultValue={10} max={10} />);
    expect(screen.getByLabelText('Increment')).toBeDisabled();
  });

  it('disables decrement at min', () => {
    render(<SpinButton defaultValue={0} min={0} />);
    expect(screen.getByLabelText('Decrement')).toBeDisabled();
  });

  it('calls onChange in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SpinButton defaultValue={0} onChange={onChange} />);
    await user.click(screen.getByLabelText('Increment'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('respects controlled value prop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SpinButton value={5} onChange={onChange} />);
    expect(screen.getByRole('spinbutton')).toHaveValue('5');
    await user.click(screen.getByLabelText('Increment'));
    // Controlled: value stays as 5
    expect(screen.getByRole('spinbutton')).toHaveValue('5');
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('sets aria-valuenow, aria-valuemin, aria-valuemax', () => {
    render(<SpinButton defaultValue={5} min={0} max={10} />);
    const sb = screen.getByRole('spinbutton');
    expect(sb).toHaveAttribute('aria-valuenow', '5');
    expect(sb).toHaveAttribute('aria-valuemin', '0');
    expect(sb).toHaveAttribute('aria-valuemax', '10');
  });

  it('disables all controls when disabled', () => {
    render(<SpinButton disabled />);
    expect(screen.getByLabelText('Increment')).toBeDisabled();
    expect(screen.getByLabelText('Decrement')).toBeDisabled();
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });
});
