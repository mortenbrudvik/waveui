import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '../Skeleton';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Skeleton', () => {
  testForwardRef(Skeleton, 'div');
  testRestSpread(Skeleton);
  testClassName(Skeleton);

  it('renders with aria-hidden="true"', () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId('skel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies width and height as inline styles', () => {
    render(<Skeleton width={200} height={40} data-testid="skel" />);
    const el = screen.getByTestId('skel');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
  });

  it('accepts string width/height', () => {
    render(<Skeleton width="100%" height="2rem" data-testid="skel" />);
    const el = screen.getByTestId('skel');
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('2rem');
  });

  it('applies circular variant class', () => {
    render(<Skeleton variant="circular" data-testid="skel" />);
    expect(screen.getByTestId('skel').className).toContain('rounded-full');
  });

  it('applies text variant class by default', () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId('skel').className).toContain('rounded');
  });

  it('applies rectangular variant class', () => {
    render(<Skeleton variant="rectangular" data-testid="skel" />);
    expect(screen.getByTestId('skel').className).toContain('rounded');
  });
});
