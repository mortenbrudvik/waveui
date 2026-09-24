import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import type { SkeletonGroupProps, SkeletonProps } from '../Skeleton';
import type { Shape } from '../../../lib/types';
import { testCompoundExposure, testSystemProps } from '../../../test-utils';

describe('Skeleton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(Skeleton, {
    expectedTag: 'div',
    displayName: 'Skeleton',
    defaultProps: { width: 120, height: 12 },
    conflictingClass: { className: 'rounded-full', overrides: 'rounded' },
  });

  testCompoundExposure(Skeleton, ['Group']);

  it('renders with aria-hidden="true"', () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId('skel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lets a consumer override aria-hidden (feedback-navigation#6)', () => {
    render(<Skeleton aria-hidden={false} role="img" aria-label="Loading profile photo" />);
    const el = screen.getByRole('img', { name: 'Loading profile photo' });
    expect(el).toHaveAttribute('aria-hidden', 'false');
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

  it('uses the skeleton token, the pulse animation and no animation for reduced motion', () => {
    render(<Skeleton data-testid="skel" />);
    const el = screen.getByTestId('skel');
    expect(el).toHaveClass('bg-skeleton', 'animate-wave-pulse', 'motion-reduce:animate-none');
    expect(el.className).not.toMatch(/\[#|animate-\[/);
  });

  describe('shape (layout#16)', () => {
    it('defaults to the rounded shape (exact token, feedback-navigation#21)', () => {
      render(<Skeleton data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('rounded');
      expect(el).not.toHaveClass('rounded-full');
      expect(el).not.toHaveClass('rounded-none');
    });

    it('applies the circular shape', () => {
      render(<Skeleton shape="circular" data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('rounded-full');
      expect(el).not.toHaveClass('rounded');
    });

    it('applies the square shape', () => {
      render(<Skeleton shape="square" data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('rounded-none');
      expect(el).not.toHaveClass('rounded');
    });
  });

  describe('deprecated `variant` alias (layout#16)', () => {
    it('applies circular variant class and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Skeleton variant="circular" data-testid="skel" />
          <Skeleton variant="circular" />
        </>,
      );
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('rounded-full');
      expect(el).not.toHaveClass('rounded');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] Skeleton: `variant` is deprecated and will be removed in 1.0. Use `shape` instead.',
      );
    });

    it('applies text variant class (the 0.4 look: rounded)', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Skeleton variant="text" data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('rounded');
      expect(el).not.toHaveClass('rounded-full');
    });

    it('applies rectangular variant class (the 0.4 look: rounded)', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Skeleton variant="rectangular" data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('rounded');
      expect(el).not.toHaveClass('rounded-full');
    });

    it('lets shape win when both are given', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Skeleton shape="square" variant="circular" data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('rounded-none');
      expect(el).not.toHaveClass('rounded-full');
    });

    it('does not warn for shape alone', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Skeleton shape="circular" />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('types', () => {
    it('SkeletonProps carries ref (C-REF) and the shared Shape type', () => {
      expectTypeOf<SkeletonProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<SkeletonProps['shape']>().toEqualTypeOf<Shape | undefined>();
      expectTypeOf<SkeletonGroupProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLDivElement> | undefined
      >();
    });
  });
});

describe('Skeleton.Group (feedback-navigation#6)', () => {
  testSystemProps(Skeleton.Group, {
    expectedTag: 'div',
    displayName: 'SkeletonGroup',
    defaultProps: {
      children: (
        <>
          <Skeleton shape="circular" width={32} height={32} />
          <Skeleton width={160} height={12} />
        </>
      ),
    },
    a11yVariants: [{ name: 'custom label', props: { label: 'Loading profile' } }],
  });

  it('is exported flat as SkeletonGroup (repo-level#2)', () => {
    expect(SkeletonGroup).toBe(Skeleton.Group);
  });

  it('marks the region busy with a visually hidden "Loading" label and decorative items', () => {
    render(
      <Skeleton.Group data-testid="group">
        <Skeleton data-testid="item" width={100} height={12} />
      </Skeleton.Group>,
    );
    const group = screen.getByTestId('group');
    expect(group).toHaveAttribute('aria-busy', 'true');
    expect(group).not.toHaveAttribute('role');
    const label = screen.getByText('Loading');
    expect(label).toHaveClass('sr-only');
    expect(group).toContainElement(label);
    expect(screen.getByTestId('item')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a custom label', () => {
    render(
      <Skeleton.Group label="Loading comments">
        <Skeleton />
      </Skeleton.Group>,
    );
    expect(screen.getByText('Loading comments')).toHaveClass('sr-only');
    expect(screen.queryByText('Loading')).toBeNull();
  });

  describe('busy state', () => {
    it.each([
      ['boolean', false],
      ['string', 'false'],
    ] as const)(
      'drops the hidden label once aria-busy is false (%s), so no stale "Loading" is read',
      (_, busy) => {
        render(
          <Skeleton.Group aria-busy={busy} data-testid="group">
            <p>Loaded content</p>
          </Skeleton.Group>,
        );
        const group = screen.getByTestId('group');
        expect(group).toHaveAttribute('aria-busy', 'false');
        expect(group.textContent).toBe('Loaded content');
        expect(screen.queryByText('Loading')).toBeNull();
      },
    );

    it('removes the label when a mounted group stops being busy', () => {
      const { rerender } = render(
        <Skeleton.Group label="Loading comments" data-testid="group">
          <Skeleton />
        </Skeleton.Group>,
      );
      expect(screen.getByText('Loading comments')).toHaveClass('sr-only');
      rerender(
        <Skeleton.Group label="Loading comments" aria-busy={false} data-testid="group">
          <p>Two comments</p>
        </Skeleton.Group>,
      );
      expect(screen.queryByText('Loading comments')).toBeNull();
      expect(screen.getByTestId('group').textContent).toBe('Two comments');
    });

    it('stays busy with its label when a wrapper forwards aria-busy as undefined', () => {
      const Wrapper = (props: SkeletonGroupProps) => (
        <Skeleton.Group aria-busy={props['aria-busy']} data-testid="group">
          <Skeleton />
        </Skeleton.Group>
      );
      render(<Wrapper />);
      const group = screen.getByTestId('group');
      expect(group).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Loading')).toHaveClass('sr-only');
    });

    it('keeps the label for an explicit aria-busy={true}', () => {
      render(<Skeleton.Group aria-busy data-testid="group" />);
      expect(screen.getByTestId('group')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Loading')).toHaveClass('sr-only');
    });
  });
});
