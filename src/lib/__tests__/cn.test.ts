import { describe, it, expect } from 'vitest';
import { cn, twMerge } from '../cn';

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('dedupes Tailwind conflicts', () => {
    const result = cn('px-4', 'px-2');
    expect(result).toBe('px-2');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('accepts arrays and objects (clsx inputs)', () => {
    expect(cn(['a', { b: true, c: false }], 'd')).toBe('a b d');
  });

  it('accepts readonly arrays at any depth (C-NAMING)', () => {
    const base = ['px-3', ['text-body-1', 'text-foreground']] as const;
    const extra: readonly string[] = ['px-2'];
    expect(cn(base, extra)).toBe('text-body-1 text-foreground px-2');
  });
});

describe('cn — Wave type ramp (table-core#1)', () => {
  const ramp = [
    'caption-2',
    'caption-1',
    'body-1',
    'body-2',
    'subtitle-2',
    'subtitle-1',
    'title-3',
    'title-2',
    'title-1',
    'large-title',
    'display',
  ];

  it.each(ramp)('keeps text-%s when a text colour follows', (step) => {
    expect(cn(`text-${step}`, 'text-foreground')).toBe(`text-${step} text-foreground`);
    expect(cn(`text-${step}`, 'text-muted-foreground')).toBe(`text-${step} text-muted-foreground`);
  });

  it('keeps the typography token when the colour comes first', () => {
    expect(cn('text-primary', 'text-title-2')).toBe('text-primary text-title-2');
  });

  it('last font size wins between the Wave ramp and Tailwind sizes', () => {
    expect(cn('text-body-1', 'text-sm')).toBe('text-sm');
    expect(cn('text-sm', 'text-body-1')).toBe('text-body-1');
    expect(cn('text-caption-1', 'text-title-1')).toBe('text-title-1');
  });

  it('keeps line-height utilities next to a ramp step', () => {
    expect(cn('text-body-1', 'leading-6')).toBe('text-body-1 leading-6');
  });
});

describe('cn — Wave shadow scale (table-core#1)', () => {
  it('last shadow wins inside the Wave scale', () => {
    expect(cn('shadow-4', 'shadow-8')).toBe('shadow-8');
    expect(cn('shadow-2', 'shadow-64')).toBe('shadow-64');
  });

  it('a Tailwind shadow replaces a Wave shadow and vice versa', () => {
    expect(cn('shadow-4', 'shadow-lg')).toBe('shadow-lg');
    expect(cn('shadow-lg', 'shadow-16')).toBe('shadow-16');
    expect(cn('shadow-28', 'shadow-none')).toBe('shadow-none');
  });

  it('keeps a shadow colour next to a Wave shadow size', () => {
    expect(cn('shadow-4', 'shadow-primary')).toBe('shadow-4 shadow-primary');
  });
});

describe('cn — Wave font family and animations', () => {
  it('font-wave is a font family (conflicts with font-sans, not with font-semibold)', () => {
    expect(cn('font-wave', 'font-sans')).toBe('font-sans');
    expect(cn('font-wave', 'font-semibold')).toBe('font-wave font-semibold');
  });

  it('wave animations merge with each other and with animate-none', () => {
    expect(cn('animate-wave-spin', 'animate-wave-pulse')).toBe('animate-wave-pulse');
    expect(cn('animate-wave-indeterminate', 'animate-none')).toBe('animate-none');
    expect(cn('animate-wave-spin', 'motion-reduce:animate-wave-spin-slow')).toBe(
      'animate-wave-spin motion-reduce:animate-wave-spin-slow',
    );
    expect(cn('animate-wave-indeterminate', 'animate-wave-indeterminate-rtl')).toBe(
      'animate-wave-indeterminate-rtl',
    );
  });
});

describe('cn — token colours merge as colours', () => {
  it('bg-* tokens', () => {
    expect(cn('bg-primary', 'bg-subtle-hover')).toBe('bg-subtle-hover');
    expect(cn('hover:bg-subtle-hover', 'hover:bg-subtle-pressed')).toBe('hover:bg-subtle-pressed');
  });

  it('border-* tokens replace colours but not widths', () => {
    expect(cn('border-border', 'border-stroke-accessible')).toBe('border-stroke-accessible');
    expect(cn('border-2', 'border-stroke-accessible')).toBe('border-2 border-stroke-accessible');
  });

  it('a later user class replaces a conflicting class of the same variant', () => {
    expect(cn('text-body-1 text-foreground px-3', 'text-destructive px-2')).toBe(
      'text-body-1 text-destructive px-2',
    );
    expect(cn('hover:bg-subtle-hover', 'hover:bg-error')).toBe('hover:bg-error');
  });

  it('keeps gated hover and state classes next to a bare user class (C-CLASS)', () => {
    // Both stay; the gated (0,4,0) and data/aria (0,2,0)+ selectors win by specificity in the CSS.
    const gatedHover = 'not-disabled:not-aria-disabled:hover:bg-primary-hover';
    expect(cn(gatedHover, 'hover:bg-error')).toBe(`${gatedHover} hover:bg-error`);
    expect(cn('data-[selected]:bg-selected', 'bg-error')).toBe(
      'data-[selected]:bg-selected bg-error',
    );
    expect(cn('aria-invalid:border-error', 'border-primary')).toBe(
      'aria-invalid:border-error border-primary',
    );
    // The same prefix (or the important modifier in the CSS) is what replaces them.
    expect(cn(gatedHover, 'not-disabled:not-aria-disabled:hover:bg-error')).toBe(
      'not-disabled:not-aria-disabled:hover:bg-error',
    );
    expect(cn('data-[selected]:bg-selected', 'data-[selected]:bg-error')).toBe(
      'data-[selected]:bg-error',
    );
  });
});

describe('twMerge', () => {
  it('is the configured merger (knows the Wave scales)', () => {
    expect(twMerge('text-body-1 text-foreground')).toBe('text-body-1 text-foreground');
    expect(twMerge('shadow-4 shadow-lg')).toBe('shadow-lg');
  });
});

describe('cn — Wave motion tokens', () => {
  it('duration-wave-* are transition durations (a later Tailwind duration replaces them)', () => {
    expect(cn('duration-wave-fast', 'duration-200')).toBe('duration-200');
    expect(cn('duration-200', 'duration-wave-ultra-slow')).toBe('duration-wave-ultra-slow');
    expect(cn('duration-wave-fast', 'duration-wave-normal')).toBe('duration-wave-normal');
  });

  it('ease-wave-* are timing functions (a later Tailwind ease replaces them)', () => {
    expect(cn('ease-wave-linear', 'ease-in')).toBe('ease-in');
    expect(cn('ease-in-out', 'ease-wave-decelerate-mid')).toBe('ease-wave-decelerate-mid');
    expect(cn('ease-wave-accelerate-max', 'ease-wave-easy-ease')).toBe('ease-wave-easy-ease');
  });

  it('keeps a duration and a curve together, and variant-scoped ones apart', () => {
    expect(cn('duration-wave-fast', 'ease-wave-linear')).toBe(
      'duration-wave-fast ease-wave-linear',
    );
    expect(
      cn(
        'duration-wave-normal',
        'data-[presence=exiting]:duration-wave-fast',
        'motion-reduce:duration-0',
      ),
    ).toBe(
      'duration-wave-normal data-[presence=exiting]:duration-wave-fast motion-reduce:duration-0',
    );
  });
});
