import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../Spinner';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Spinner', () => {
  testForwardRef(Spinner, 'span');
  testRestSpread(Spinner);
  testClassName(Spinner);

  it('renders with role="status"', () => {
    render(<Spinner data-testid="sp" />);
    expect(screen.getByTestId('sp')).toHaveAttribute('role', 'status');
  });

  it('renders label as sr-only by default', () => {
    render(<Spinner label="Loading" />);
    const srOnly = screen.getByText('Loading');
    expect(srOnly.className).toContain('sr-only');
  });

  it('renders label visibly when labelVisible is true', () => {
    render(<Spinner label="Loading" labelVisible />);
    const label = screen.getByText('Loading');
    expect(label.className).not.toContain('sr-only');
  });

  it('does not render label text when label is not provided', () => {
    render(<Spinner data-testid="sp" />);
    const el = screen.getByTestId('sp');
    // Only the spinner circle should be present, no text nodes besides it
    expect(el.querySelectorAll('span').length).toBe(1); // just the circle
  });

  it('applies size classes', () => {
    render(<Spinner size="large" data-testid="sp" />);
    const circle = screen.getByTestId('sp').querySelector('span')!;
    expect(circle.className).toContain('w-9');
    expect(circle.className).toContain('h-9');
  });

  it('defaults to medium size', () => {
    render(<Spinner data-testid="sp" />);
    const circle = screen.getByTestId('sp').querySelector('span')!;
    expect(circle.className).toContain('w-6');
    expect(circle.className).toContain('h-6');
  });
});
