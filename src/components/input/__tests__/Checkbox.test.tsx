import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../Checkbox';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Checkbox', () => {
  testForwardRef(Checkbox, 'label');
  testRestSpread(Checkbox);
  testClassName(Checkbox);

  it('renders without crashing', () => {
    render(<Checkbox label="Accept" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders label text', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByText('Accept terms')).toBeInTheDocument();
  });

  it('does not render label span when label is not provided', () => {
    render(<Checkbox data-testid="cb" />);
    const label = screen.getByTestId('cb');
    expect(label.querySelector('span.text-sm')).toBeNull();
  });

  it('starts unchecked by default', () => {
    render(<Checkbox />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('starts checked when defaultChecked is true', () => {
    render(<Checkbox defaultChecked />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Check" />);
    const cb = screen.getByRole('checkbox');
    expect(cb).toHaveAttribute('aria-checked', 'false');
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'true');
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('respects controlled checked prop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} />);
    const cb = screen.getByRole('checkbox');
    expect(cb).toHaveAttribute('aria-checked', 'false');
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders indeterminate state', () => {
    render(<Checkbox indeterminate />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('applies disabled state', () => {
    render(<Checkbox disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
