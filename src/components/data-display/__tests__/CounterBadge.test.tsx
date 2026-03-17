import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CounterBadge } from '../CounterBadge';
import { testSystemProps } from '../../../test-utils';

describe('CounterBadge', () => {
  testSystemProps(CounterBadge, {
    expectedTag: 'span',
    displayName: 'CounterBadge',
    defaultProps: { count: 5 },
  });

  it('renders the count', () => {
    render(<CounterBadge count={7} data-testid="cb" />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('returns null when count is 0', () => {
    const { container } = render(<CounterBadge count={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when count is negative', () => {
    const { container } = render(<CounterBadge count={-3} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows overflow count with default overflowCount of 99', () => {
    render(<CounterBadge count={150} data-testid="cb" />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('respects custom overflowCount', () => {
    render(<CounterBadge count={15} overflowCount={10} data-testid="cb" />);
    expect(screen.getByText('10+')).toBeInTheDocument();
  });

  it('shows exact count when equal to overflowCount', () => {
    render(<CounterBadge count={99} data-testid="cb" />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('renders outline appearance', () => {
    render(<CounterBadge count={5} appearance="outline" data-testid="cb" />);
    expect(screen.getByTestId('cb')).toBeInTheDocument();
  });
});
