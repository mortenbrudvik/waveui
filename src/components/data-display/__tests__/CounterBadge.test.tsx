import type * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CounterBadge } from '../CounterBadge';
import type { CounterBadgeProps } from '../CounterBadge';
import { testSystemProps } from '../../../test-utils';

describe('CounterBadge', () => {
  testSystemProps(CounterBadge, {
    expectedTag: 'span',
    displayName: 'CounterBadge',
    defaultProps: { count: 5 },
    a11yVariants: [{ name: 'outline', props: { appearance: 'outline' } }],
  });

  it('renders the count', () => {
    render(<CounterBadge count={7} />);
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
    render(<CounterBadge count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('respects custom overflowCount', () => {
    render(<CounterBadge count={15} overflowCount={10} />);
    expect(screen.getByText('10+')).toBeInTheDocument();
  });

  it('shows exact count when equal to overflowCount', () => {
    render(<CounterBadge count={99} />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  // data-display#16 + input-basic#8
  it.each([
    ['filled', ['bg-primary', 'text-primary-foreground']],
    ['outline', ['bg-transparent', 'border', 'border-primary', 'text-primary']],
  ] as const)('%s appearance uses %j', (appearance, classes) => {
    render(<CounterBadge count={5} appearance={appearance} data-testid="cb" />);
    const badge = screen.getByTestId('cb');
    expect(badge).toHaveClass(...classes);
    expect(badge.className).not.toMatch(/#|\bwhite\b/);
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in CounterBadgeProps (C-REF)', () => {
    expectTypeOf<CounterBadgeProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
  });
});
