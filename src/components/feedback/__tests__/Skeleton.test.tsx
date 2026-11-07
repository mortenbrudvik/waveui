import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import type {
  SkeletonAnimation,
  SkeletonAppearance,
  SkeletonGroupProps,
  SkeletonProps,
  SkeletonSize,
} from '../Skeleton';
import type { Shape } from '../../../lib/types';
import { expectNoA11yViolations, testCompoundExposure, testSystemProps } from '../../../test-utils';

describe('Skeleton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(Skeleton, {
    expectedTag: 'div',
    displayName: 'Skeleton',
    defaultProps: { width: 120, height: 12 },
    conflictingClass: { className: 'rounded-full', overrides: 'wave:rounded' },
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
    expect(el).toHaveClass(
      'wave:bg-skeleton',
      'wave:animate-wave-pulse',
      'wave:motion-reduce:animate-none',
    );
    expect(el.className).not.toMatch(/\[#|animate-\[/);
  });

  it('stays visible in forced colors with a GrayText fill', () => {
    render(<Skeleton data-testid="skel" />);
    // Forced colors replace the author fill with Canvas, which would make the placeholder vanish.
    expect(screen.getByTestId('skel')).toHaveClass(
      'wave:forced-colors:bg-[GrayText]',
      'wave:forced-colors:forced-color-adjust-none',
    );
  });

  describe('shape (layout#16)', () => {
    it('defaults to the rounded shape (exact token, feedback-navigation#21)', () => {
      render(<Skeleton data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('wave:rounded');
      expect(el).not.toHaveClass('wave:rounded-full');
      expect(el).not.toHaveClass('wave:rounded-none');
    });

    it('applies the circular shape', () => {
      render(<Skeleton shape="circular" data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('wave:rounded-full');
      expect(el).not.toHaveClass('wave:rounded');
    });

    it('applies the square shape', () => {
      render(<Skeleton shape="square" data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('wave:rounded-none');
      expect(el).not.toHaveClass('wave:rounded');
    });
  });

  describe('the 0.4 `variant` is removed in 1.0 (layout#16)', () => {
    // Untyped code that still passes it: an unknown attribute of the placeholder element, which
    // React renders as it is, and the placeholder keeps the default rounded shape.
    it('has no variant alias of shape: variant="circular" stays rounded', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <Skeleton
          // @ts-expect-error -- `variant` is removed in 1.0: use `shape`
          variant="circular"
          data-testid="skel"
        />,
      );
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('wave:rounded');
      expect(el).not.toHaveClass('wave:rounded-full');
      expect(el).toHaveAttribute('variant', 'circular');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('does not warn for shape', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Skeleton shape="circular" />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('types', () => {
    it('SkeletonProps carries ref (C-REF) and the shared Shape type', () => {
      expectTypeOf<SkeletonProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<SkeletonProps['shape']>().toEqualTypeOf<Shape | undefined>();
      expectTypeOf<SkeletonProps>().not.toHaveProperty('variant');
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
    expect(label).toHaveClass('wave:sr-only');
    expect(group).toContainElement(label);
    expect(screen.getByTestId('item')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a custom label', () => {
    render(
      <Skeleton.Group label="Loading comments">
        <Skeleton />
      </Skeleton.Group>,
    );
    expect(screen.getByText('Loading comments')).toHaveClass('wave:sr-only');
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
      expect(screen.getByText('Loading comments')).toHaveClass('wave:sr-only');
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
      expect(screen.getByText('Loading')).toHaveClass('wave:sr-only');
    });

    it('keeps the label for an explicit aria-busy={true}', () => {
      render(<Skeleton.Group aria-busy data-testid="group" />);
      expect(screen.getByTestId('group')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Loading')).toHaveClass('wave:sr-only');
    });
  });
});

describe('Skeleton — size presets, animation, appearance and group defaults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('size and the default height', () => {
    it('is 16px tall without a height, where 0.x drew none, and sets no data-size', () => {
      render(<Skeleton data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveClass('wave:h-4');
      expect(el).not.toHaveAttribute('data-size');
      expect(el.style.height).toBe('');
    });

    it('keeps a height of yours: the inline height wins and a width-only line is still 16px tall', () => {
      render(
        <>
          <Skeleton data-testid="own" width={100} height={40} />
          <Skeleton data-testid="line" width={100} />
        </>,
      );
      expect(screen.getByTestId('own').style.height).toBe('40px');
      expect(screen.getByTestId('own')).not.toHaveClass('wave:h-4');
      expect(screen.getByTestId('line')).toHaveClass('wave:h-4');
    });

    it('gives a circular or square placeholder with neither dimension a 16px box', () => {
      render(
        <>
          <Skeleton data-testid="circle" shape="circular" />
          <Skeleton data-testid="square" shape="square" />
          <Skeleton data-testid="sized" shape="circular" width={32} height={32} />
        </>,
      );
      expect(screen.getByTestId('circle')).toHaveClass('wave:size-4');
      expect(screen.getByTestId('square')).toHaveClass('wave:size-4');
      expect(screen.getByTestId('sized')).not.toHaveClass('wave:size-4');
    });

    it.each([
      [8, 'wave:h-2', 'wave:size-2'],
      [12, 'wave:h-3', 'wave:size-3'],
      [16, 'wave:h-4', 'wave:size-4'],
      [20, 'wave:h-5', 'wave:size-5'],
      [24, 'wave:h-6', 'wave:size-6'],
      [28, 'wave:h-7', 'wave:size-7'],
      [32, 'wave:h-8', 'wave:size-8'],
      [36, 'wave:h-9', 'wave:size-9'],
      [40, 'wave:h-10', 'wave:size-10'],
      [48, 'wave:h-12', 'wave:size-12'],
      [56, 'wave:h-14', 'wave:size-14'],
      [64, 'wave:h-16', 'wave:size-16'],
      [72, 'wave:h-18', 'wave:size-18'],
      [96, 'wave:h-24', 'wave:size-24'],
      [120, 'wave:h-30', 'wave:size-30'],
      [128, 'wave:h-32', 'wave:size-32'],
    ] as const)(
      'size %i is the height of a line (%s) and the box of the other shapes (%s)',
      (size, line, box) => {
        render(
          <>
            <Skeleton data-testid="line" size={size} />
            <Skeleton data-testid="circle" size={size} shape="circular" />
            <Skeleton data-testid="square" size={size} shape="square" />
          </>,
        );
        expect(screen.getByTestId('line')).toHaveClass(line);
        expect(screen.getByTestId('line')).toHaveAttribute('data-size', String(size));
        expect(screen.getByTestId('circle')).toHaveClass(box);
        expect(screen.getByTestId('square')).toHaveClass(box);
      },
    );

    it('lets a height of yours and a className replace the preset', () => {
      render(<Skeleton data-testid="skel" size={32} height={10} className="h-1" />);
      const el = screen.getByTestId('skel');
      expect(el.style.height).toBe('10px');
      expect(el).toHaveClass('h-1');
      expect(el).not.toHaveClass('wave:h-8');
    });

    it('reads a size outside the presets (untyped code) as no size', () => {
      render(<Skeleton data-testid="skel" size={17 as 16} />);
      const el = screen.getByTestId('skel');
      expect(el).not.toHaveAttribute('data-size');
      expect(el).toHaveClass('wave:h-4');
    });
  });

  describe('animation', () => {
    it('defaults to the pulse and renders data-animation', () => {
      render(<Skeleton data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveAttribute('data-animation', 'pulse');
      expect(el).toHaveClass('wave:animate-wave-pulse', 'wave:motion-reduce:animate-none');
    });

    it('draws a shimmer with the wave: a pseudo-element moved by the indeterminate keyframes, mirrored, off for reduced motion and forced colors', () => {
      render(<Skeleton data-testid="skel" animation="wave" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveAttribute('data-animation', 'wave');
      expect(el).not.toHaveClass('wave:animate-wave-pulse');
      expect(el).toHaveClass(
        'wave:relative',
        'wave:overflow-hidden',
        'wave:after:animate-wave-indeterminate',
        'wave:wave-rtl:after:animate-wave-indeterminate-rtl',
        'wave:motion-reduce:after:animate-none',
        'wave:motion-reduce:after:hidden',
        'wave:forced-colors:after:hidden',
      );
      expect(el.className).not.toMatch(/(^|\s)wave:rtl:/);
    });

    it('reads an unknown animation (untyped code) as the pulse', () => {
      render(<Skeleton data-testid="skel" animation={'blink' as 'pulse'} />);
      expect(screen.getByTestId('skel')).toHaveAttribute('data-animation', 'pulse');
    });
  });

  describe('appearance', () => {
    it('defaults to the opaque skeleton color', () => {
      render(<Skeleton data-testid="skel" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveAttribute('data-appearance', 'opaque');
      expect(el).toHaveClass('wave:bg-skeleton');
    });

    it('fills a translucent placeholder with the page color at 60%', () => {
      render(<Skeleton data-testid="skel" appearance="translucent" />);
      const el = screen.getByTestId('skel');
      expect(el).toHaveAttribute('data-appearance', 'translucent');
      expect(el).toHaveClass('wave:bg-background/60');
      expect(el).not.toHaveClass('wave:bg-skeleton');
      // Forced colors still paint it.
      expect(el).toHaveClass('wave:forced-colors:bg-[GrayText]');
    });
  });

  it('renders data-shape with the resolved shape', () => {
    render(
      <>
        <Skeleton data-testid="a" />
        <Skeleton data-testid="b" shape="circular" />
      </>,
    );
    expect(screen.getByTestId('a')).toHaveAttribute('data-shape', 'rounded');
    expect(screen.getByTestId('b')).toHaveAttribute('data-shape', 'circular');
  });

  describe('Skeleton.Group defaults', () => {
    it('gives the placeholders inside it a size, shape, animation and appearance', () => {
      render(
        <Skeleton.Group size={32} shape="circular" animation="wave" appearance="translucent">
          <Skeleton data-testid="a" />
          <Skeleton data-testid="b" />
        </Skeleton.Group>,
      );
      for (const id of ['a', 'b']) {
        const el = screen.getByTestId(id);
        expect(el).toHaveAttribute('data-size', '32');
        expect(el).toHaveAttribute('data-shape', 'circular');
        expect(el).toHaveAttribute('data-animation', 'wave');
        expect(el).toHaveAttribute('data-appearance', 'translucent');
        expect(el).toHaveClass('wave:size-8', 'wave:rounded-full', 'wave:bg-background/60');
      }
    });

    it("lets a placeholder's own props win, each independently", () => {
      render(
        <Skeleton.Group size={32} shape="circular" animation="wave">
          <Skeleton data-testid="own" size={12} shape="square" animation="pulse" />
          <Skeleton data-testid="shapeOnly" shape="rounded" />
        </Skeleton.Group>,
      );
      const own = screen.getByTestId('own');
      expect(own).toHaveAttribute('data-size', '12');
      expect(own).toHaveAttribute('data-shape', 'square');
      expect(own).toHaveAttribute('data-animation', 'pulse');
      // The rounded shape of its own, the group's size and animation.
      const shapeOnly = screen.getByTestId('shapeOnly');
      expect(shapeOnly).toHaveAttribute('data-shape', 'rounded');
      expect(shapeOnly).toHaveClass('wave:h-8');
      expect(shapeOnly).toHaveAttribute('data-animation', 'wave');
    });

    it('changes nothing without group defaults, and does not leak them to the group element', () => {
      render(
        <Skeleton.Group data-testid="group">
          <Skeleton data-testid="a" />
        </Skeleton.Group>,
      );
      const group = screen.getByTestId('group');
      for (const attr of ['size', 'shape', 'animation', 'appearance']) {
        expect(group).not.toHaveAttribute(attr);
      }
      expect(screen.getByTestId('a')).toHaveAttribute('data-shape', 'rounded');
      expect(screen.getByTestId('a')).toHaveAttribute('data-animation', 'pulse');
    });

    it('has no accessibility violations with a wave group', async () => {
      render(
        <Skeleton.Group animation="wave" size={24} label="Loading profile">
          <Skeleton shape="circular" />
          <Skeleton width={160} />
        </Skeleton.Group>,
      );
      await expectNoA11yViolations();
    });
  });

  it('types the new props', () => {
    expectTypeOf<SkeletonProps['size']>().toEqualTypeOf<SkeletonSize | undefined>();
    expectTypeOf<SkeletonProps['animation']>().toEqualTypeOf<SkeletonAnimation | undefined>();
    expectTypeOf<SkeletonProps['appearance']>().toEqualTypeOf<SkeletonAppearance | undefined>();
    expectTypeOf<SkeletonAnimation>().toEqualTypeOf<'pulse' | 'wave'>();
    expectTypeOf<SkeletonAppearance>().toEqualTypeOf<'opaque' | 'translucent'>();
    expectTypeOf<SkeletonGroupProps['size']>().toEqualTypeOf<SkeletonSize | undefined>();
    expectTypeOf<SkeletonGroupProps['shape']>().toEqualTypeOf<Shape | undefined>();
    // @ts-expect-error -- 18 is not one of Fluent's sizes
    const invalid: SkeletonSize = 18;
    expect(invalid).toBe(18);
  });
});
