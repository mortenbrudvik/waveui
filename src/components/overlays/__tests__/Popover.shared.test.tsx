import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Portal } from '../../portal/Portal';
import { getTabbableAfter, getTabbableThrough, PopoverBeak } from '../Popover.shared';

describe('PopoverBeak (overlays-anchored-docs-4)', () => {
  it.each([
    ['top', ['border-b', 'border-r']],
    ['bottom', ['border-t', 'border-l']],
    ['left', ['border-t', 'border-r']],
    ['right', ['border-b', 'border-l']],
  ] as const)('draws the borders that face the anchor for side="%s"', (side, borders) => {
    render(<PopoverBeak side={side} data-testid="beak" style={{ top: 4 }} />);
    const beak = screen.getByTestId('beak');
    expect(beak).toHaveAttribute('aria-hidden', 'true');
    // It inherits the surface's colors, so a className override on the surface reaches it.
    expect(beak).toHaveClass('size-2', 'rotate-45', 'border-inherit', 'bg-inherit', ...borders);
    expect(beak).toHaveStyle({ top: '4px' });
  });

  it('has a display name', () => {
    expect(PopoverBeak.displayName).toBe('PopoverBeak');
  });
});

describe('tab stops around an anchor', () => {
  function Page() {
    return (
      <>
        <button type="button">Before</button>
        <div data-testid="anchor">
          <button type="button">Inside A</button>
          <button type="button">Inside B</button>
        </div>
        <button type="button" disabled>
          Disabled
        </button>
        <button type="button">After</button>
        <div data-testid="surface">
          <button type="button">In surface</button>
        </div>
        <Portal>
          <button type="button">In another portal</button>
        </Portal>
      </>
    );
  }

  it('getTabbableAfter: the first tab stop after the anchor, not inside it or the surface', () => {
    render(<Page />);
    expect(getTabbableAfter(screen.getByTestId('anchor'), screen.getByTestId('surface'))).toBe(
      screen.getByRole('button', { name: 'After' }),
    );
  });

  it('getTabbableThrough: the last tab stop inside or before the anchor', () => {
    render(<Page />);
    const surface = screen.getByTestId('surface');
    expect(getTabbableThrough(screen.getByTestId('anchor'), surface)).toBe(
      screen.getByRole('button', { name: 'Inside B' }),
    );
    // A tabbable anchor is its own stop.
    const before = screen.getByRole('button', { name: 'Before' });
    expect(getTabbableThrough(before, surface)).toBe(before);
  });

  it('stays in the anchor’s own portal (or, like the anchor, in the page)', () => {
    render(<Page />);
    const surface = screen.getByTestId('surface');
    const last = screen.getByRole('button', { name: 'In surface' });
    // Nothing tabbable follows the surface's button in the page: the portal does not count.
    expect(getTabbableAfter(last, surface)).toBeNull();
    const portaled = screen.getByRole('button', { name: 'In another portal' });
    expect(getTabbableThrough(portaled, surface)).toBe(portaled);
    expect(getTabbableAfter(portaled, surface)).toBeNull();
  });
});
