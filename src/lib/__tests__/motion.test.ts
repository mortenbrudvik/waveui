// @vitest-environment node
/**
 * `src/lib/motion.ts` (spec §2.2, §2.9): the resolver's branches, and mechanical checks over
 * every export of the module. Each check is a pure helper with a failing fixture of its own, then
 * applied to {@link recipeEntries} (every recipe the module exports), so a check cannot pass
 * because it never looks:
 *
 * 1. every class word compiles with Tailwind and Wave's tokens and variants, as
 *    `scripts/build-css.mjs` builds (a typo such as a misspelt duration would ship nothing);
 * 2. a value with a transition has a Wave duration and a Wave curve (variants stripped); a recipe
 *    on {@link COMPOSED_DURATIONS} is checked once per duration it is composed with;
 * 3. a transition has a reduced-motion `transition-none`, an animation a reduced-motion
 *    animation;
 * 4. every class with the `starting` variant is gated on the entering phase;
 * 7. every export is a string, a record of strings or a function (the precondition of the dist
 *    probe of `scripts/verify-dist.mjs`, which reads the strings one level into records).
 *
 * The file runs in the node environment: the compile check loads `@tailwindcss/node`.
 */
import { join } from 'node:path';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { beforeAll, describe, expect, it } from 'vitest';
import * as motion from '../motion';
import { resolveMotion, usesLegacyMotion } from '../motion';

const LEGACY = 'p-4 data-[presence=exiting]:opacity-0';

describe('resolveMotion', () => {
  it('null is no motion', () => {
    expect(resolveMotion(null, 'r', 'default')).toBe('');
  });

  it('a string replaces the recipe, also under the provider "none"', () => {
    expect(resolveMotion('a b', 'r', 'none')).toBe('a b');
    expect(resolveMotion('a b', 'r', 'default')).toBe('a b');
  });

  it('the object form replaces the recipe', () => {
    expect(resolveMotion({ className: 'a' }, 'r', 'default')).toBe('a');
    expect(resolveMotion({ className: 'a' }, 'r', 'none')).toBe('a');
  });

  it('an empty string is an explicit empty replacement: no motion', () => {
    expect(resolveMotion('', 'r', 'default')).toBe('');
    expect(resolveMotion({ className: '' }, 'r', 'default')).toBe('');
  });

  it('undefined is no motion under the provider "none"', () => {
    expect(resolveMotion(undefined, 'r', 'none')).toBe('');
  });

  it('undefined keeps the recipe by default', () => {
    expect(resolveMotion(undefined, 'r', 'default')).toBe('r');
    expect(resolveMotion(undefined, 'r', 'default', 'p-4')).toBe('r');
  });

  it('a legacy className with a presence variant turns the default off', () => {
    expect(resolveMotion(undefined, 'r', 'default', LEGACY)).toBe('');
  });

  it('a value wins over a legacy className', () => {
    expect(resolveMotion('x', 'r', 'default', 'data-[presence=exiting]:opacity-0')).toBe('x');
  });
});

describe('usesLegacyMotion', () => {
  it('is true only without a slot and with a presence variant in the className', () => {
    expect(usesLegacyMotion(undefined, LEGACY)).toBe(true);
    expect(usesLegacyMotion(undefined, 'p-4')).toBe(false);
    expect(usesLegacyMotion(undefined)).toBe(false);
    expect(usesLegacyMotion(null, LEGACY)).toBe(false);
    expect(usesLegacyMotion('x', LEGACY)).toBe(false);
    expect(usesLegacyMotion({ className: 'x' }, LEGACY)).toBe(false);
    expect(usesLegacyMotion('', LEGACY)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The recipe checks (spec §2.9)
// ---------------------------------------------------------------------------

/** A recipe export: one class string, or a record of them (per edge, per size, …). */
type RecipeExport = string | Readonly<Record<string, string>>;

type DesignSystem = Awaited<ReturnType<typeof __unstable__loadDesignSystem>>;

/**
 * Recipe name → the name of the record its durations come from: a recipe that carries no duration
 * of its own is composed at run time with the duration of the part's size, and check 2 runs on
 * each composition (`value + ' ' + durations[size]`).
 */
const COMPOSED_DURATIONS: Record<string, string> = {};

/** The stylesheet the compile check builds against: the precompiled CSS's sources (build-css). */
const COMPILE_CSS =
  "@import 'tailwindcss/theme.css' theme(inline); @import './src/styles/tokens.css'; @import './src/styles/variants.css'; @import 'tailwindcss/utilities.css';";
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

/** A plain object whose values are all strings (a recipe per edge, per size, …). */
function isRecordOfStrings(value: unknown): value is Readonly<Record<string, string>> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}

/** Check 7: the names of the exports that are not a string, a record of strings or a function. */
function nonRecipeExports(mod: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(mod)
    .filter(
      ([, value]) =>
        typeof value !== 'string' && typeof value !== 'function' && !isRecordOfStrings(value),
    )
    .map(([name]) => name);
}

/**
 * Every recipe export of `mod` (default: `lib/motion`) as `[name, value]`: each string and each
 * record of strings. Functions are skipped; any other kind is check 7's.
 */
function recipeEntries(mod: Readonly<Record<string, unknown>> = motion): [string, RecipeExport][] {
  return Object.entries(mod).flatMap(([name, value]): [string, RecipeExport][] =>
    typeof value === 'string' || isRecordOfStrings(value) ? [[name, value]] : [],
  );
}

/** The class strings of `entries`: one per string export, one per key of a record export. */
function recipeStrings(
  entries: readonly [string, RecipeExport][],
): { name: string; label: string; value: string }[] {
  return entries.flatMap(([name, value]) =>
    typeof value === 'string'
      ? [{ name, label: name, value }]
      : Object.entries(value).map(([key, text]) => ({
          name,
          label: `${name}.${key}`,
          value: text,
        })),
  );
}

/** The words of a class string. */
function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/** A class word split at its top-level colons: the variants, then the utility. */
function parseWord(word: string): { variants: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of word) {
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ':' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  return { variants: parts, utility: current.replace(/^!/, '').replace(/!$/, '') };
}

/** A transition utility that moves something (`transition-none` moves nothing). */
const isTransition = (utility: string) =>
  /^transition(?:$|-)/.test(utility) && utility !== 'transition-none';
/** An animation utility that moves something (`animate-none` moves nothing). */
const isAnimation = (utility: string) =>
  utility.startsWith('animate-') && utility !== 'animate-none';
const isReduced = (variants: readonly string[]) => variants.includes('motion-reduce');

/** Check 1: the words of `value` that yield no CSS rule. */
function uncompiledWords(value: string, designSystem: DesignSystem): string[] {
  const list = words(value);
  const css = designSystem.candidatesToCss(list);
  return list.filter((_, index) => !css[index]);
}

/** Check 2: the Wave timing utilities a value with a transition lacks (variants stripped). */
function missingTimingTokens(value: string): string[] {
  const parsed = words(value).map(parseWord);
  const moves = parsed.some(
    ({ variants, utility }) => !isReduced(variants) && isTransition(utility),
  );
  if (!moves) return [];
  return ['duration-wave-', 'ease-wave-']
    .filter((prefix) => !parsed.some(({ utility }) => utility.startsWith(prefix)))
    .map((prefix) => `${prefix}*`);
}

/**
 * The values check 2 runs on: each recipe string of `mod`, or for a recipe on `composed`, the
 * string composed with each duration of its record (labelled `label + size`).
 */
function timingCases(
  mod: Readonly<Record<string, unknown>>,
  composed: Readonly<Record<string, string>>,
): { label: string; value: string }[] {
  return recipeStrings(recipeEntries(mod)).flatMap(({ name, label, value }) => {
    const durations = Object.hasOwn(composed, name) ? mod[composed[name]] : undefined;
    if (!isRecordOfStrings(durations)) return [{ label, value }];
    return Object.entries(durations).map(([size, duration]) => ({
      label: `${label} + ${size}`,
      value: `${value} ${duration}`,
    }));
  });
}

/** Check 3: the motion kinds of `value` without a reduced-motion counterpart of the same kind. */
function missingReductions(value: string): string[] {
  const parsed = words(value).map(parseWord);
  const scoped = (variants: readonly string[]) =>
    isReduced(variants) || variants.includes('motion-safe');
  const missing: string[] = [];
  const transitions = parsed.some(
    ({ variants, utility }) => !scoped(variants) && isTransition(utility),
  );
  const reducedTransitions = parsed.some(
    ({ variants, utility }) => isReduced(variants) && utility === 'transition-none',
  );
  if (transitions && !reducedTransitions) missing.push('transition');
  const animations = parsed.some(
    ({ variants, utility }) => !scoped(variants) && isAnimation(utility),
  );
  const reducedAnimations = parsed.some(
    ({ variants, utility }) => isReduced(variants) && utility.startsWith('animate-'),
  );
  if (animations && !reducedAnimations) missing.push('animate');
  return missing;
}

/** Check 4: the words with the `starting` variant that are not gated on the entering phase. */
function ungatedStarts(value: string): string[] {
  return words(value).filter((word) => {
    const { variants } = parseWord(word);
    return variants.includes('starting') && !variants.includes('data-[presence=entering]');
  });
}

/** `check` over every recipe string of `lib/motion`, as `label: finding` lines. */
function findings(check: (value: string) => string[]): string[] {
  return recipeStrings(recipeEntries()).flatMap(({ label, value }) =>
    check(value).map((finding) => `${label}: ${finding}`),
  );
}

describe('lib/motion recipe checks (spec §2.9)', () => {
  let designSystem: DesignSystem;
  beforeAll(async () => {
    designSystem = await __unstable__loadDesignSystem(COMPILE_CSS, { base: REPO_ROOT });
  });

  describe('7. every export is a string, a record of strings or a function', () => {
    it('reports any other kind of export', () => {
      const fixture = {
        recipe: 'transition-opacity',
        byEdge: { start: 'transition-opacity', end: 'transition-opacity' },
        resolve: () => '',
        count: 3,
        list: ['transition-opacity'],
        nested: { start: { small: 'duration-wave-fast' } },
        nothing: null,
      };
      expect(nonRecipeExports(fixture)).toEqual(['count', 'list', 'nested', 'nothing']);
    });

    it('recipeEntries lists the strings and records of strings, and skips functions', () => {
      const fixture = { a: 'x', b: { c: 'y' }, f: () => '', n: 3 };
      expect(recipeEntries(fixture)).toEqual([
        ['a', 'x'],
        ['b', { c: 'y' }],
      ]);
      expect(recipeStrings(recipeEntries(fixture))).toEqual([
        { name: 'a', label: 'a', value: 'x' },
        { name: 'b', label: 'b.c', value: 'y' },
      ]);
    });

    it('holds for lib/motion, whose functions are not recipes', () => {
      expect(nonRecipeExports(motion)).toEqual([]);
      const names = recipeEntries().map(([name]) => name);
      expect(names).not.toContain('resolveMotion');
      expect(names).not.toContain('usesLegacyMotion');
    });
  });

  describe('1. every word compiles', () => {
    it('reports a word that yields no rule', () => {
      expect(
        uncompiledWords(
          'transition-opacity duration-wave-gentel data-[presence=entering]:starting:opacity-0',
          designSystem,
        ),
      ).toEqual(['duration-wave-gentel']);
    });

    it("compiles Wave's tokens and variants", () => {
      expect(
        uncompiledWords(
          'duration-wave-gentle ease-wave-easy-ease motion-reduce:transition-none wave-rtl:-translate-x-2 data-[presence=entered]:contents data-[side=left]:data-[presence=entering]:starting:-translate-x-2',
          designSystem,
        ),
      ).toEqual([]);
    });

    it('holds for every recipe', () => {
      expect(findings((value) => uncompiledWords(value, designSystem))).toEqual([]);
    });
  });

  describe('2. a transition has a Wave duration and a Wave curve', () => {
    it('reports a transition without them', () => {
      expect(missingTimingTokens('transition-opacity motion-reduce:transition-none')).toEqual([
        'duration-wave-*',
        'ease-wave-*',
      ]);
      expect(
        missingTimingTokens('transition-opacity data-[presence=exiting]:duration-wave-fast'),
      ).toEqual(['ease-wave-*']);
    });

    it('accepts them with variants, and needs none without a transition', () => {
      expect(
        missingTimingTokens(
          'transition-opacity data-[presence=exiting]:duration-wave-fast ease-wave-easy-ease motion-reduce:transition-none',
        ),
      ).toEqual([]);
      expect(missingTimingTokens('animate-wave-indeterminate motion-reduce:animate-none')).toEqual(
        [],
      );
      expect(missingTimingTokens('motion-reduce:transition-none duration-wave-fast')).toEqual([]);
    });

    it('checks a composed recipe once per duration of its record', () => {
      const fixture = {
        slide: {
          start: 'transition-[translate] ease-wave-easy-ease motion-reduce:transition-none',
        },
        durations: { small: 'duration-wave-gentle', large: 'duration-wave-slow' },
      };
      const composed = timingCases(fixture, { slide: 'durations' });
      expect(composed).toEqual([
        {
          label: 'slide.start + small',
          value:
            'transition-[translate] ease-wave-easy-ease motion-reduce:transition-none duration-wave-gentle',
        },
        {
          label: 'slide.start + large',
          value:
            'transition-[translate] ease-wave-easy-ease motion-reduce:transition-none duration-wave-slow',
        },
        { label: 'durations.small', value: 'duration-wave-gentle' },
        { label: 'durations.large', value: 'duration-wave-slow' },
      ]);
      expect(composed.flatMap(({ value }) => missingTimingTokens(value))).toEqual([]);
      expect(
        timingCases(fixture, {}).flatMap(({ label, value }) =>
          missingTimingTokens(value).map((missing) => `${label}: ${missing}`),
        ),
      ).toEqual(['slide.start: duration-wave-*']);
    });

    it('COMPOSED_DURATIONS names recipe exports and records of durations', () => {
      const exports: Readonly<Record<string, unknown>> = motion;
      for (const [recipe, durations] of Object.entries(COMPOSED_DURATIONS)) {
        expect(
          recipeEntries().map(([name]) => name),
          recipe,
        ).toContain(recipe);
        expect(isRecordOfStrings(exports[durations]), durations).toBe(true);
      }
    });

    it('holds for every recipe, a composed one with each of its durations', () => {
      expect(
        timingCases(motion, COMPOSED_DURATIONS).flatMap(({ label, value }) =>
          missingTimingTokens(value).map((missing) => `${label}: ${missing}`),
        ),
      ).toEqual([]);
    });
  });

  describe('3. a transition or an animation has a reduced-motion counterpart', () => {
    it('reports a motion without a same-kind reduction', () => {
      expect(
        missingReductions('transition-opacity duration-wave-fast ease-wave-easy-ease'),
      ).toEqual(['transition']);
      expect(missingReductions('animate-wave-pulse motion-reduce:transition-none')).toEqual([
        'animate',
      ]);
      expect(missingReductions('transition-opacity motion-reduce:duration-0')).toEqual([
        'transition',
      ]);
    });

    it('accepts the same-kind reduction, whatever the variants of the motion', () => {
      expect(
        missingReductions(
          'data-[presence=exiting]:transition-opacity motion-reduce:transition-none',
        ),
      ).toEqual([]);
      expect(missingReductions('animate-wave-indeterminate motion-reduce:animate-none')).toEqual(
        [],
      );
      expect(missingReductions('duration-wave-gentle')).toEqual([]);
    });

    it('holds for every recipe', () => {
      expect(findings(missingReductions)).toEqual([]);
    });
  });

  describe('4. every start is gated on the entering phase', () => {
    it('reports an ungated start', () => {
      expect(
        ungatedStarts(
          'starting:opacity-0 data-[presence=exiting]:starting:scale-95 data-[presence=entering]:starting:translate-y-1',
        ),
      ).toEqual(['starting:opacity-0', 'data-[presence=exiting]:starting:scale-95']);
    });

    it('accepts a gated start with other variants', () => {
      expect(
        ungatedStarts('data-[side=top]:data-[presence=entering]:starting:translate-y-1'),
      ).toEqual([]);
    });

    it('holds for every recipe', () => {
      expect(findings(ungatedStarts)).toEqual([]);
    });
  });
});
