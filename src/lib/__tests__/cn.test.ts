import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { extendTailwindMerge, type ExperimentalParsedClassName } from 'tailwind-merge';
import { cn, createWcn, twMerge, UTILITY_PREFIX, wcn } from '../cn';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

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
    const base = ['px-3', ['text-wave-body-1', 'text-wave-foreground']] as const;
    const extra: readonly string[] = ['px-2'];
    expect(cn(base, extra)).toBe('text-wave-body-1 text-wave-foreground px-2');
  });
});

describe('cn — Wave type ramp, namespaced (table-core#1; 1.0)', () => {
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

  it.each(ramp)('keeps text-wave-%s when a text colour follows', (step) => {
    expect(cn(`text-wave-${step}`, 'text-wave-foreground')).toBe(
      `text-wave-${step} text-wave-foreground`,
    );
    expect(cn(`text-wave-${step}`, 'text-wave-muted-foreground')).toBe(
      `text-wave-${step} text-wave-muted-foreground`,
    );
  });

  it('keeps the typography token when the colour comes first', () => {
    expect(cn('text-wave-primary', 'text-wave-title-2')).toBe(
      'text-wave-primary text-wave-title-2',
    );
  });

  it('last font size wins between the Wave ramp and Tailwind sizes', () => {
    expect(cn('text-wave-body-1', 'text-sm')).toBe('text-sm');
    expect(cn('text-sm', 'text-wave-body-1')).toBe('text-wave-body-1');
    expect(cn('text-wave-caption-1', 'text-wave-title-1')).toBe('text-wave-title-1');
  });

  it('keeps line-height utilities next to a ramp step', () => {
    expect(cn('text-wave-body-1', 'leading-6')).toBe('text-wave-body-1 leading-6');
  });

  it('no longer knows the unnamespaced names of 0.x (spec §6, Task 1, item 4)', () => {
    // An unknown text or shadow value is a colour for tailwind-merge: a colour after it wins.
    expect(cn('text-body-1', 'text-foreground')).toBe('text-foreground');
    expect(cn('text-body-1', 'text-sm')).toBe('text-body-1 text-sm');
    expect(cn('shadow-4', 'shadow-primary')).toBe('shadow-primary');
    expect(cn('shadow-4', 'shadow-lg')).toBe('shadow-4 shadow-lg');
  });
});

describe('cn — Wave shadow scale, namespaced (table-core#1; 1.0)', () => {
  it('last shadow wins inside the Wave scale', () => {
    expect(cn('shadow-wave-4', 'shadow-wave-8')).toBe('shadow-wave-8');
    expect(cn('shadow-wave-2', 'shadow-wave-64')).toBe('shadow-wave-64');
  });

  it('a Tailwind shadow replaces a Wave shadow and vice versa', () => {
    expect(cn('shadow-wave-4', 'shadow-lg')).toBe('shadow-lg');
    expect(cn('shadow-lg', 'shadow-wave-16')).toBe('shadow-wave-16');
    expect(cn('shadow-wave-28', 'shadow-none')).toBe('shadow-none');
  });

  it('keeps a shadow colour next to a Wave shadow size', () => {
    expect(cn('shadow-wave-4', 'shadow-wave-primary')).toBe('shadow-wave-4 shadow-wave-primary');
  });
});

describe('cn — Wave font family and animations', () => {
  it('font-wave is a font family (conflicts with font-sans, not with font-semibold)', () => {
    expect(cn('font-wave', 'font-sans')).toBe('font-sans');
    expect(cn('font-wave', 'font-semibold')).toBe('font-wave font-semibold');
  });

  it('font-wave-mono and font-wave-numeric share the font family group of font-wave', () => {
    expect(cn('font-wave', 'font-wave-mono')).toBe('font-wave-mono');
    expect(cn('font-wave-numeric', 'font-wave')).toBe('font-wave');
    expect(cn('font-wave-mono', 'font-wave-numeric')).toBe('font-wave-numeric');
    expect(cn('font-wave-mono', 'font-sans')).toBe('font-sans');
  });

  it('font-wave-mono and font-wave-numeric are not weights or sizes', () => {
    expect(cn('font-wave-mono', 'font-medium')).toBe('font-wave-mono font-medium');
    expect(cn('font-wave-mono', 'font-bold')).toBe('font-wave-mono font-bold');
    expect(cn('font-wave-numeric', 'font-semibold')).toBe('font-wave-numeric font-semibold');
    expect(cn('font-medium', 'font-wave-mono')).toBe('font-medium font-wave-mono');
    expect(cn('font-wave-mono', 'text-wave-body-1')).toBe('font-wave-mono text-wave-body-1');
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
    expect(cn('text-wave-body-1 text-wave-foreground px-3', 'text-wave-error px-2')).toBe(
      'text-wave-body-1 text-wave-error px-2',
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

describe('cn — axis shorthands and logical sides (C-LOGICAL)', () => {
  it('a later axis shorthand replaces the logical sides it covers', () => {
    expect(cn('ps-3 pe-2', 'px-4')).toBe('px-4');
    // Dialog.Title's end padding gives way to a consumer's horizontal padding.
    expect(cn('pe-8 text-subtitle-1', 'px-6')).toBe('text-subtitle-1 px-6');
    expect(cn('ms-2 me-1', 'mx-auto')).toBe('mx-auto');
    expect(cn('start-0 end-0', 'inset-x-0')).toBe('inset-x-0');
    expect(cn('border-s border-e-2', 'border-x-0')).toBe('border-x-0');
  });

  it('a later logical side stays next to an earlier axis shorthand', () => {
    expect(cn('px-4', 'ps-3')).toBe('px-4 ps-3');
    expect(cn('mx-2', 'me-auto')).toBe('mx-2 me-auto');
    expect(cn('inset-x-0', 'end-2')).toBe('inset-x-0 end-2');
  });

  it('keeps the logical sides next to the other axis and another variant', () => {
    expect(cn('ps-3 pe-2', 'py-1')).toBe('ps-3 pe-2 py-1');
    expect(cn('hover:pe-2', 'px-4')).toBe('hover:pe-2 px-4');
  });
});

describe('twMerge', () => {
  it('is the configured merger (knows the namespaced Wave scales)', () => {
    expect(twMerge('text-wave-body-1 text-wave-foreground')).toBe(
      'text-wave-body-1 text-wave-foreground',
    );
    expect(twMerge('shadow-wave-4 shadow-lg')).toBe('shadow-lg');
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

// ---------------------------------------------------------------------------------------------
// 1.0 (Phase 14, spec R6): the namespaced theme keys, the module-only `wcn` and its prefix mode
// ---------------------------------------------------------------------------------------------

const RAMP = [
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
const SHADOWS = ['2', '4', '8', '16', '28', '64'];

describe('cn — the namespaced theme keys (1.0)', () => {
  it.each(RAMP)('text-wave-%s is a font size: a text colour next to it is kept', (step) => {
    expect(cn(`text-wave-${step}`, 'text-wave-foreground')).toBe(
      `text-wave-${step} text-wave-foreground`,
    );
    expect(cn(`text-wave-${step} text-foreground`)).toBe(`text-wave-${step} text-foreground`);
  });

  it('a later size replaces an earlier one, namespaced or Tailwind', () => {
    expect(cn('text-wave-body-1', 'text-wave-caption-1')).toBe('text-wave-caption-1');
    expect(cn('text-sm', 'text-wave-body-2')).toBe('text-wave-body-2');
    expect(cn('text-wave-title-1', 'text-sm')).toBe('text-sm');
  });

  it.each(SHADOWS)('shadow-wave-%s is a shadow size, never a shadow colour', (level) => {
    expect(cn(`shadow-wave-${level}`, 'shadow-wave-primary')).toBe(
      `shadow-wave-${level} shadow-wave-primary`,
    );
    expect(cn('shadow-lg', `shadow-wave-${level}`)).toBe(`shadow-wave-${level}`);
  });

  it('a later shadow replaces an earlier one, namespaced or Tailwind', () => {
    expect(cn('shadow-wave-4', 'shadow-wave-8')).toBe('shadow-wave-8');
    expect(cn('shadow-md', 'shadow-wave-16')).toBe('shadow-wave-16');
    expect(cn('shadow-wave-16', 'shadow-none')).toBe('shadow-none');
  });

  it('the namespaced colours merge as colours', () => {
    expect(cn('bg-wave-primary', 'bg-wave-error')).toBe('bg-wave-error');
    expect(cn('bg-primary', 'bg-wave-error')).toBe('bg-wave-error');
    expect(cn('border-2 border-wave-border', 'border-wave-stroke-accessible')).toBe(
      'border-2 border-wave-stroke-accessible',
    );
  });

  it('font-wave, animate-wave-*, duration-wave-* and ease-wave-* keep their groups', () => {
    expect(cn('font-wave font-semibold', 'font-wave-mono')).toBe('font-semibold font-wave-mono');
    expect(cn('animate-wave-spin', 'animate-wave-pulse')).toBe('animate-wave-pulse');
    expect(cn('duration-wave-gentle ease-wave-easy-ease', 'duration-wave-fast')).toBe(
      'ease-wave-easy-ease duration-wave-fast',
    );
    expect(cn('ease-wave-linear', 'ease-wave-decelerate-mid')).toBe('ease-wave-decelerate-mid');
  });
});

/** Inputs of the components' merge: Wave's classes prefixed, a consumer's `className` not. */
const PREFIXED_CASES: Array<Parameters<typeof cn>> = [
  ['wave:px-4', 'px-2'],
  ['wave:text-body-1 wave:text-foreground wave:px-3', 'text-wave-error px-2'],
  ['wave:text-body-1', 'text-sm'],
  ['wave:shadow-4', 'wave:shadow-8'],
  ['wave:shadow-4', 'shadow-wave-primary'],
  ['wave:font-wave wave:font-semibold', 'font-wave-mono'],
  ['wave:animate-wave-spin', 'wave:motion-reduce:animate-wave-spin-slow'],
  ['wave:duration-wave-fast', 'duration-200'],
  ['wave:not-disabled:not-aria-disabled:hover:bg-primary-hover', 'hover:bg-error'],
  ['wave:data-[selected]:bg-selected', 'data-[selected]:bg-error'],
  ['wave:ps-3 wave:pe-2', 'px-4'],
  ['wave-button wave:inline-flex', 'my-button'],
  [['a', { b: true, c: false }], 'd', null, false, undefined],
];

/** Inputs of the unprefixed merge and its result: the merge of 0.x, which knew both scales. */
const UNPREFIXED_CASES: Array<[Parameters<typeof cn>, string]> = [
  [['px-4', 'px-2'], 'px-2'],
  [
    ['text-body-1 text-foreground px-3', 'text-destructive px-2'],
    'text-body-1 text-destructive px-2',
  ],
  [['text-body-1', 'text-sm'], 'text-sm'],
  [['shadow-4', 'shadow-8'], 'shadow-8'],
  [['shadow-4', 'shadow-primary'], 'shadow-4 shadow-primary'],
  [['font-wave', 'font-semibold'], 'font-wave font-semibold'],
  [['font-wave', 'font-wave-mono'], 'font-wave-mono'],
  [['duration-wave-fast', 'duration-200'], 'duration-200'],
  [['ease-wave-linear', 'ease-in'], 'ease-in'],
  [
    ['not-disabled:not-aria-disabled:hover:bg-primary-hover', 'hover:bg-error'],
    'not-disabled:not-aria-disabled:hover:bg-primary-hover hover:bg-error',
  ],
  [['ps-3 pe-2', 'px-4'], 'px-4'],
  [['text-body-1', 'text-wave-body-2'], 'text-wave-body-2'],
  [['shadow-wave-4', 'shadow-wave-8'], 'shadow-wave-8'],
];

describe('wcn — the module-only merge of the components, with the prefix on', () => {
  it('carries the prefix of the flip (Phase 14 spec R6)', () => {
    expect(UTILITY_PREFIX).toBe('wave');
  });

  it('is the merge createWcn builds for UTILITY_PREFIX', () => {
    const built = createWcn(UTILITY_PREFIX);
    for (const inputs of PREFIXED_CASES) expect(built(...inputs)).toBe(wcn(...inputs));
  });

  it("lets a consumer's unprefixed class replace a conflicting prefixed one", () => {
    expect(wcn('wave:px-4', 'px-2')).toBe('px-2');
    expect(wcn('wave:text-body-1 wave:text-foreground wave:px-3', 'text-wave-error px-2')).toBe(
      'wave:text-body-1 text-wave-error px-2',
    );
    expect(wcn('wave:ps-3 wave:pe-2', 'px-4')).toBe('px-4');
    expect(wcn('wave-button wave:inline-flex', 'my-button')).toBe(
      'wave-button wave:inline-flex my-button',
    );
  });

  it('keeps the gate pitfall: a gated hover and a bare hover are different variants', () => {
    const gatedHover = 'wave:not-disabled:not-aria-disabled:hover:bg-primary-hover';
    expect(wcn(`wave:bg-primary ${gatedHover}`, 'hover:bg-error')).toBe(
      `wave:bg-primary ${gatedHover} hover:bg-error`,
    );
    expect(wcn(gatedHover, 'not-disabled:not-aria-disabled:hover:bg-error')).toBe(
      'not-disabled:not-aria-disabled:hover:bg-error',
    );
  });

  it('knows both the internal and the namespaced scales', () => {
    expect(wcn('wave:text-body-1 wave:text-foreground', 'text-wave-body-2')).toBe(
      'wave:text-foreground text-wave-body-2',
    );
    expect(wcn('wave:shadow-4', 'shadow-wave-16')).toBe('shadow-wave-16');
  });

  it.each(UNPREFIXED_CASES)(
    'without a prefix, createWcn merges %j as the 0.x merge did (both scales)',
    (inputs, expected) => {
      expect(createWcn('')(...inputs)).toBe(expected);
    },
  );
});

describe("createWcn('wave'): the prefixed merge (spec R6)", () => {
  const prefixed = createWcn('wave');

  it("a consumer's unprefixed class replaces a prefixed Wave class of the same group", () => {
    expect(prefixed('wave:p-4', 'p-2')).toBe('p-2');
    expect(prefixed('wave:p-4', 'wave:p-2')).toBe('wave:p-2');
    expect(prefixed('wave:px-3 wave:py-1', 'p-2')).toBe('p-2');
    expect(prefixed('wave:bg-primary', 'bg-wave-error')).toBe('bg-wave-error');
    expect(prefixed('wave:rounded-md', 'rounded-none')).toBe('rounded-none');
    // A Wave class after the consumer's (never the components' order) wins, as in 0.18.
    expect(prefixed('p-2', 'wave:p-4')).toBe('wave:p-4');
  });

  it('the type ramp: a size and a colour are two groups, internal and namespaced sizes one', () => {
    expect(prefixed('wave:text-body-1 wave:text-foreground')).toBe(
      'wave:text-body-1 wave:text-foreground',
    );
    expect(prefixed('wave:text-body-1 wave:text-foreground', 'text-wave-body-2')).toBe(
      'wave:text-foreground text-wave-body-2',
    );
    expect(prefixed('wave:text-body-1 wave:text-foreground', 'text-wave-error')).toBe(
      'wave:text-body-1 text-wave-error',
    );
    expect(prefixed('wave:text-body-1', 'wave:text-caption-1')).toBe('wave:text-caption-1');
    expect(prefixed('wave:text-body-1', 'text-sm')).toBe('text-sm');
  });

  it('shadows, font families, animations and the motion tokens', () => {
    expect(prefixed('wave:shadow-4', 'wave:shadow-8')).toBe('wave:shadow-8');
    expect(prefixed('wave:shadow-4', 'shadow-wave-16')).toBe('shadow-wave-16');
    expect(prefixed('wave:shadow-4', 'shadow-wave-primary')).toBe(
      'wave:shadow-4 shadow-wave-primary',
    );
    expect(prefixed('wave:font-wave wave:font-semibold', 'font-wave-mono')).toBe(
      'wave:font-semibold font-wave-mono',
    );
    expect(prefixed('wave:animate-wave-spin', 'animate-wave-pulse')).toBe('animate-wave-pulse');
    expect(
      prefixed('wave:duration-wave-gentle wave:ease-wave-easy-ease', 'duration-wave-fast ease-in'),
    ).toBe('duration-wave-fast ease-in');
  });

  it('keeps the gate pitfall: the gated hover stays next to a bare hover', () => {
    const gated = 'wave:not-disabled:not-aria-disabled:hover:bg-primary-hover';
    expect(prefixed(`wave:bg-primary ${gated}`, 'hover:bg-error')).toBe(
      `wave:bg-primary ${gated} hover:bg-error`,
    );
    expect(prefixed(gated, 'not-disabled:not-aria-disabled:hover:bg-error')).toBe(
      'not-disabled:not-aria-disabled:hover:bg-error',
    );
  });

  it('arbitrary values and variables', () => {
    expect(prefixed('wave:p-[3px]', 'p-[5px]')).toBe('p-[5px]');
    expect(prefixed('wave:bg-(--option-bg)', 'bg-wave-error')).toBe('bg-wave-error');
    expect(prefixed('wave:w-[calc(100%-2px)]', 'w-full')).toBe('w-full');
    expect(prefixed('wave:[mask-type:luminance]', '[mask-type:alpha]')).toBe('[mask-type:alpha]');
  });

  it('the important modifier is a group of its own, in either position', () => {
    expect(prefixed('wave:p-4', 'p-2!')).toBe('wave:p-4 p-2!');
    expect(prefixed('wave:p-4!', 'p-2!')).toBe('p-2!');
    expect(prefixed('wave:p-4!', '!p-2')).toBe('!p-2');
    expect(prefixed('wave:hover:bg-primary', 'hover:bg-error!')).toBe(
      'wave:hover:bg-primary hover:bg-error!',
    );
  });

  it('negative values', () => {
    expect(prefixed('wave:-mt-1', 'mt-2')).toBe('mt-2');
    expect(prefixed('wave:mt-2', '-mt-1')).toBe('-mt-1');
    expect(prefixed('wave:wave-rtl:-scale-x-100', 'wave-rtl:scale-x-100')).toBe(
      'wave-rtl:scale-x-100',
    );
  });

  it('named groups: a variant with a name, and the marker itself', () => {
    expect(prefixed('wave:group-hover/row:opacity-100', 'group-hover/row:opacity-0')).toBe(
      'group-hover/row:opacity-0',
    );
    expect(prefixed('wave:group-hover/row:opacity-100', 'group-hover:opacity-0')).toBe(
      'wave:group-hover/row:opacity-100 group-hover:opacity-0',
    );
    expect(prefixed('wave:group/row wave:flex', 'group')).toBe('wave:group/row wave:flex group');
  });

  it('data variants (the presence phases, the selected state)', () => {
    expect(
      prefixed('wave:data-[presence=exiting]:opacity-0', 'data-[presence=exiting]:opacity-50'),
    ).toBe('data-[presence=exiting]:opacity-50');
    expect(prefixed('wave:data-[presence=entered]:contents', 'hidden')).toBe(
      'wave:data-[presence=entered]:contents hidden',
    );
    expect(prefixed('wave:data-[selected]:bg-selected', 'data-[selected]:bg-error')).toBe(
      'data-[selected]:bg-error',
    );
  });

  it('keeps every class that is no utility: stable classes, app classes', () => {
    expect(prefixed('wave-button wave:inline-flex', 'my-button')).toBe(
      'wave-button wave:inline-flex my-button',
    );
  });

  it("keeps a prefix(tw) app's class next to Wave's (the merge reads tw as a variant)", () => {
    expect(prefixed('wave:p-4', 'tw:p-2')).toBe('wave:p-4 tw:p-2');
  });
});

describe('tailwind-merge: the parse the prefix mode relies on is pinned', () => {
  it('parses a class with and without the prefix as the prefixed merge expects', () => {
    const seen: Array<ExperimentalParsedClassName & { className: string }> = [];
    const probe = extendTailwindMerge({
      prefix: 'wave',
      experimentalParseClassName: ({ className, parseClassName }) => {
        const parsed = parseClassName(
          className.startsWith('wave:') ? className : `wave:${className}`,
        );
        seen.push({ className, ...parsed });
        return parsed;
      },
    });
    probe('wave:not-disabled:hover:bg-primary!', 'p-2/50', 'group-hover/row:-mt-1', 'tw:p-2');
    // tailwind-merge walks the list from its end.
    expect(
      seen.map(({ className, modifiers, hasImportantModifier, baseClassName, isExternal }) => ({
        className,
        modifiers,
        hasImportantModifier,
        baseClassName,
        isExternal,
      })),
    ).toEqual([
      {
        className: 'tw:p-2',
        modifiers: ['tw'],
        hasImportantModifier: false,
        baseClassName: 'p-2',
        isExternal: undefined,
      },
      {
        className: 'group-hover/row:-mt-1',
        modifiers: ['group-hover/row'],
        hasImportantModifier: false,
        baseClassName: '-mt-1',
        isExternal: undefined,
      },
      {
        className: 'p-2/50',
        modifiers: [],
        hasImportantModifier: false,
        baseClassName: 'p-2/50',
        isExternal: undefined,
      },
      {
        className: 'wave:not-disabled:hover:bg-primary!',
        modifiers: ['not-disabled', 'hover'],
        hasImportantModifier: true,
        baseClassName: 'bg-primary',
        isExternal: undefined,
      },
    ]);
  });

  it('passes an unprefixed class through untouched unless the parse adds the prefix', () => {
    const prefixOnly = extendTailwindMerge({ prefix: 'wave' });
    expect(prefixOnly('wave:p-4', 'p-2')).toBe('wave:p-4 p-2');
    expect(prefixOnly('wave:p-4', 'wave:p-2')).toBe('wave:p-2');
  });

  it('is pinned to the exact installed version in package.json and the lockfile', () => {
    interface Manifest {
      version?: string;
      dependencies?: Record<string, string>;
      packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
    }
    const read = (path: string): Manifest =>
      JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')) as Manifest;
    const installed = read('node_modules/tailwind-merge/package.json').version;
    const lock = read('package-lock.json');
    expect(installed).toMatch(/^\d+\.\d+\.\d+$/);
    expect(read('package.json').dependencies?.['tailwind-merge']).toBe(installed);
    expect(lock.packages?.['']?.dependencies?.['tailwind-merge']).toBe(installed);
    expect(lock.packages?.['node_modules/tailwind-merge']?.version).toBe(installed);
  });
});

describe('cn.ts: both merge configurations are pure (tree-shaking)', () => {
  it('marks the module-level construction of each merge /* @__PURE__ */', () => {
    const source = readFileSync(join(REPO_ROOT, 'src/lib/cn.ts'), 'utf8');
    expect(source).toMatch(/export const twMerge = \/\* @__PURE__ \*\/ extendTailwindMerge\(/);
    expect(source).toMatch(/export const wcn = \/\* @__PURE__ \*\/ createWcn\(UTILITY_PREFIX\);/);
  });
});
