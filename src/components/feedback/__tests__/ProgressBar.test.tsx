import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('ProgressBar', () => {
  testForwardRef(ProgressBar, 'div');
  testRestSpread(ProgressBar);
  testClassName(ProgressBar);

  it('renders with role="progressbar"', () => {
    render(<ProgressBar data-testid="pb" />);
    expect(screen.getByTestId('pb')).toHaveAttribute('role', 'progressbar');
  });

  it('sets aria-valuenow and aria-valuemax for determinate bar', () => {
    render(<ProgressBar value={50} max={200} data-testid="pb" />);
    const el = screen.getByTestId('pb');
    expect(el).toHaveAttribute('aria-valuenow', '50');
    expect(el).toHaveAttribute('aria-valuemax', '200');
    expect(el).toHaveAttribute('aria-valuemin', '0');
  });

  it('defaults max to 100', () => {
    render(<ProgressBar value={30} data-testid="pb" />);
    expect(screen.getByTestId('pb')).toHaveAttribute('aria-valuemax', '100');
  });

  it('does not set aria-valuenow when indeterminate', () => {
    render(<ProgressBar data-testid="pb" />);
    expect(screen.getByTestId('pb')).not.toHaveAttribute('aria-valuenow');
  });

  it('sets aria-label from label prop', () => {
    render(<ProgressBar label="Loading" data-testid="pb" />);
    expect(screen.getByTestId('pb')).toHaveAttribute('aria-label', 'Loading');
  });

  it('calculates width percentage correctly', () => {
    render(<ProgressBar value={75} max={100} data-testid="pb" />);
    const inner = screen.getByTestId('pb').firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('75%');
  });

  it('clamps percentage to 100', () => {
    render(<ProgressBar value={150} max={100} data-testid="pb" />);
    const inner = screen.getByTestId('pb').firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('100%');
  });
});
