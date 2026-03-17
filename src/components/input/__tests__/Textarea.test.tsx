import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../Textarea';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Textarea', () => {
  testForwardRef(Textarea, 'textarea');
  testRestSpread(Textarea);
  testClassName(Textarea);

  it('renders without crashing', () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('sets aria-invalid when error is provided', () => {
    render(<Textarea error="Required" data-testid="ta" />);
    expect(screen.getByTestId('ta')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta')).not.toHaveAttribute('aria-invalid');
  });

  it('applies error border styling', () => {
    render(<Textarea error="Required" data-testid="ta" />);
    expect(screen.getByTestId('ta').className).toContain('border-destructive');
  });

  it('handles user typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea data-testid="ta" onChange={onChange} />);
    await user.type(screen.getByTestId('ta'), 'hi');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('applies disabled state', () => {
    render(<Textarea disabled data-testid="ta" />);
    expect(screen.getByTestId('ta')).toBeDisabled();
  });
});
