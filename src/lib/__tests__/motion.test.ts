// @vitest-environment node
/**
 * `src/lib/motion.ts` (spec §2.2, §2.9): the resolver's branches, and mechanical checks over
 * every export of the module. Each check is a pure helper with a failing fixture of its own, then
 * applied to {@link recipeEntries} (every recipe the module exports), so a check cannot pass
 * because it never looks:
 *
 * 1. every class word compiles with Tailwind and Wave's tokens and variants, as
 *    `scripts/build-css.mjs` builds (a typo such as a misspelt duration would ship nothing);
 * 2. a value with a transition has a Wave duration and a Wave curve that apply to its enter (not
 *    only under the reduced-motion or the exiting variant); a recipe on
 *    {@link COMPOSED_DURATIONS} is checked once per duration it is composed with;
 * 3. a transition has a reduced-motion `transition-none`, an animation a reduced-motion
 *    animation;
 * 4. every class with the `starting` variant is gated on the entering phase;
 * 5. a recipe of a positioned surface ({@link POSITIONED_RECIPES}) never transitions `transform`
 *    (floating-ui positions the surface with it); one that slides
 *    ({@link SLIDING_POSITIONED_RECIPES}) lists `translate` in the transition of its enter, and one
 *    that only fades ({@link FADING_POSITIONED_RECIPES}) transitions `opacity` alone;
 * 6. a backdrop exits with its surface's exit duration (D16: the core waits only for the surface,
 *    so a longer backdrop would be cut off), per pair of {@link BACKDROP_PAIRS}; a backdrop per
 *    size ({@link SIZED_BACKDROP_PAIRS}) takes its size's duration both ways and exits with its
 *    surface composed with that duration, at every edge;
 * 7. every export is a string, a record of strings or a function (the precondition of the dist
 *    probe of `scripts/verify-dist.mjs`, which reads the strings one level into records).
 *
 * And two checks of a single recipe, the structure of an inline drawer (D13), at every edge: it
 * lifts its panel's size cap on the panel's axis while the element is not entered, and it lays
 * its track on the side where it aligns the panel. The second also holds for the collapse
 * structure of the disclosures (D12), which aligns its part to the start of the track rather than
 * stretching it (a stretched part is squeezed to the track, shorter than the element shows). A
 * structure that is a grid in every phase (a toast's container, D14) has a zero-minimum track on
 * both axes, so its content keeps the container's width and its row track can close.
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
const COMPOSED_DURATIONS: Record<string, string> = {
  drawerMotion: 'drawerDurations',
  inlineDrawerMotion: 'drawerDurations',
};

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
/** The exiting phase's variant: a class under it times only the exit. */
const EXITING = 'data-[presence=exiting]';

/** Check 1: the words of `value` that yield no CSS rule. */
function uncompiledWords(value: string, designSystem: DesignSystem): string[] {
  const list = words(value);
  const css = designSystem.candidatesToCss(list);
  return list.filter((_, index) => !css[index]);
}

/**
 * Check 2: the Wave timing utilities a value with a transition lacks. A timing utility counts
 * under any variant except the reduced-motion one (it times nothing while motion is allowed) and
 * the exiting one (it leaves the enter on Tailwind's default timing).
 */
function missingTimingTokens(value: string): string[] {
  const parsed = words(value).map(parseWord);
  const moves = parsed.some(
    ({ variants, utility }) => !isReduced(variants) && isTransition(utility),
  );
  if (!moves) return [];
  const times = (variants: readonly string[]) =>
    !isReduced(variants) && !variants.includes(EXITING);
  return ['duration-wave-', 'ease-wave-']
    .filter(
      (prefix) =>
        !parsed.some(({ variants, utility }) => times(variants) && utility.startsWith(prefix)),
    )
    .map((prefix) => `${prefix}*`);
}

/**
 * Backdrop recipe → the recipe of its surface (check 6, D16): the presence core waits only for the
 * surface's motion, so a backdrop that exits more slowly is cut off when the surface unmounts.
 */
const BACKDROP_PAIRS: Record<string, string> = { dialogBackdropMotion: 'dialogMotion' };

/** Check 6: the duration utility of `value` under exactly the variants `variant` (`''`: none). */
function durationUnder(value: string, variant: string): string | undefined {
  return words(value)
    .map(parseWord)
    .find(
      ({ variants, utility }) => variants.join(':') === variant && utility.startsWith('duration-'),
    )?.utility;
}

/** Check 6: the plain duration of `value`, the one without a variant (it times the enter). */
function plainDuration(value: string): string | undefined {
  return durationUnder(value, '');
}

/**
 * Check 6: the exit duration of `value`: its duration utility under exactly the exiting variant,
 * else its plain one (`undefined` without either).
 */
function exitDuration(value: string): string | undefined {
  return durationUnder(value, EXITING) ?? plainDuration(value);
}

/** Check 6: a finding when `backdrop` does not exit with the duration of `surface`. */
function backdropExitMismatch(surface: string, backdrop: string): string[] {
  const own = exitDuration(backdrop);
  const surfaces = exitDuration(surface);
  return own !== undefined && own === surfaces
    ? []
    : [`exits over ${own ?? 'no duration'}, its surface over ${surfaces ?? 'no duration'}`];
}

/**
 * Backdrop recipe per size → the recipe of its surface (per edge, carrying no duration of its own)
 * and the record of durations per size both are composed with (check 6 per size, D16).
 */
const SIZED_BACKDROP_PAIRS: Record<string, { surface: string; durations: string }> = {
  drawerBackdropMotion: { surface: 'drawerMotion', durations: 'drawerDurations' },
};

/**
 * Check 6 per size: for each size of `durations`, a finding when `backdrops` has no recipe for it,
 * when that recipe's plain (enter) or exit duration is not the size's, or when it does not exit
 * with a surface of `surfaces` (per edge) composed with the size's duration. Labelled `size` or
 * `size, edge`.
 */
function sizedBackdropMismatches(
  surfaces: Readonly<Record<string, string>>,
  durations: Readonly<Record<string, string>>,
  backdrops: Readonly<Record<string, string>>,
): string[] {
  return Object.entries(durations).flatMap(([size, duration]) => {
    const backdrop = Object.hasOwn(backdrops, size) ? backdrops[size] : undefined;
    if (backdrop === undefined) return [`${size}: no backdrop recipe`];
    const sizeFindings = [
      ['enters', plainDuration(backdrop)],
      ['exits', exitDuration(backdrop)],
    ].flatMap(([way, own]) =>
      own === duration
        ? []
        : [`${size}: ${way} over ${own ?? 'no duration'}, the size's duration is ${duration}`],
    );
    return sizeFindings.concat(
      Object.entries(surfaces).flatMap(([edge, surface]) =>
        backdropExitMismatch(`${surface} ${duration}`, backdrop).map(
          (finding) => `${size}, ${edge}: ${finding}`,
        ),
      ),
    );
  });
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

/**
 * Check 5 (D4): the recipes of positioned surfaces. floating-ui places them with an inline
 * `transform`, so a transition of that property would slide them from their last position (or the
 * viewport's corner) every time they move.
 */
const POSITIONED_RECIPES = ['popupMotion', 'tooltipMotion'];

/** Check 5 (D4, plan ruling 3): the positioned recipes that slide, so must list `translate`. */
const SLIDING_POSITIONED_RECIPES = ['popupMotion'];

/** Check 5 (plan ruling 3): the positioned recipes that only fade, so transition `opacity` alone. */
const FADING_POSITIONED_RECIPES = ['tooltipMotion'];

/** The transition utilities that transition `transform`: every property, or that one by name. */
const TRANSFORM_TRANSITIONS = new Set(['transition', 'transition-all', 'transition-transform']);

/** The properties an arbitrary transition utility lists (`transition-[opacity,translate]`). */
function arbitraryTransitionList(utility: string): string[] {
  const match = /^transition-\[(.+)\]$/.exec(utility);
  return match ? match[1].split(',').map((property) => property.trim()) : [];
}

/**
 * Check 5: the words of `value` that transition `transform`, under any variants: Tailwind's
 * `transition`, `transition-all` and `transition-transform`, and an arbitrary list that holds
 * `transform` or `all`.
 */
function transformTransitions(value: string): string[] {
  return words(value).filter((word) => {
    const { utility } = parseWord(word);
    if (TRANSFORM_TRANSITIONS.has(utility)) return true;
    return arbitraryTransitionList(utility).some(
      (property) => property === 'transform' || property === 'all',
    );
  });
}

/**
 * Check 5: whether a transition of `value` lists `translate` for the enter. A list counts under any
 * variant except the reduced-motion one (it moves nothing while motion is allowed) and the exiting
 * one (it would leave the enter without the slide), as check 2 counts timing.
 */
function listsTranslate(value: string): boolean {
  return words(value)
    .map(parseWord)
    .some(
      ({ variants, utility }) =>
        !isReduced(variants) &&
        !variants.includes(EXITING) &&
        arbitraryTransitionList(utility).includes('translate'),
    );
}

/**
 * Check 5: the properties the transitions of `value` name, under any variant except the
 * reduced-motion one, in order: each entry of an arbitrary list, the property of a named utility
 * (`opacity`, `colors`, `all`, …), and `default` for the bare utility (Tailwind's default list).
 */
function transitionedProperties(value: string): string[] {
  return words(value)
    .map(parseWord)
    .filter(({ variants, utility }) => !isReduced(variants) && isTransition(utility))
    .flatMap(({ utility }) => {
      const list = arbitraryTransitionList(utility);
      if (list.length > 0) return list;
      return utility === 'transition' ? ['default'] : [utility.slice('transition-'.length)];
    });
}

/**
 * The variants under which an inline drawer's structure lifts its panel's size cap: the children
 * of the element while it is not entered (while it enters or exits it is a grid whose track a
 * percentage cap would follow, squeezing the panel; entered, it has no box and the cap applies).
 */
const NOT_ENTERED_CHILD = 'not-data-[presence=entered]:*';

/** The utility that lifts the panel's size cap on the axis of each inline drawer edge. */
const PANEL_CAP_LIFTS: Record<string, string> = {
  start: 'max-w-none',
  end: 'max-w-none',
  left: 'max-w-none',
  right: 'max-w-none',
  bottom: 'max-h-none',
};

/**
 * The inline drawer's panel cap: for each edge of `lifts`, a finding when `structures` has no
 * value for it, when the value lacks the edge's lift under {@link NOT_ENTERED_CHILD}, or when it
 * holds a lift (of either axis) under any other variants.
 */
function panelCapFindings(
  structures: Readonly<Record<string, string>>,
  lifts: Readonly<Record<string, string>>,
): string[] {
  const liftUtilities = new Set(Object.values(lifts));
  return Object.entries(lifts).flatMap(([edge, lift]) => {
    const value = Object.hasOwn(structures, edge) ? structures[edge] : undefined;
    if (value === undefined) return [`${edge}: no structure`];
    const parsed = words(value).map(parseWord);
    const gated = parsed.some(
      ({ variants, utility }) => utility === lift && variants.join(':') === NOT_ENTERED_CHILD,
    );
    const misplaced = parsed
      .filter(
        ({ variants, utility }) =>
          liftUtilities.has(utility) &&
          (utility !== lift || variants.join(':') !== NOT_ENTERED_CHILD),
      )
      .map(({ variants, utility }) => `${edge}: ${[...variants, utility].join(':')}`);
    return (gated ? [] : [`${edge}: no ${NOT_ENTERED_CHILD}:${lift}`]).concat(misplaced);
  });
}

/**
 * The alignment utilities of a grid, per axis: how the items sit in their track
 * (`justify-items`, `align-items`) and how the track sits in the grid (`justify-content`,
 * `align-content`), each as Tailwind's named utility or an arbitrary property.
 */
const GRID_ALIGNMENT = {
  inline: {
    track: /^grid-cols-/,
    items: [/^justify-items-(.+)$/, /^\[justify-items:(.+)\]$/],
    content: [
      /^justify-(start|end|center|between|around|evenly|stretch|normal)$/,
      /^\[justify-content:(.+)\]$/,
    ],
  },
  block: {
    track: /^grid-rows-/,
    items: [/^items-(.+)$/, /^\[align-items:(.+)\]$/],
    content: [
      /^content-(start|end|center|between|around|evenly|stretch|normal)$/,
      /^\[align-content:(.+)\]$/,
    ],
  },
} as const;

/** The value of the first plain (variant-free) utility of `utilities` that matches `patterns`. */
function alignmentValue(
  utilities: readonly string[],
  patterns: readonly RegExp[],
): string | undefined {
  for (const utility of utilities) {
    for (const pattern of patterns) {
      const match = pattern.exec(utility);
      if (match) return match[1];
    }
  }
  return undefined;
}

/** A grid axis: `inline` (its column tracks) or `block` (its row tracks). */
type GridAxis = keyof typeof GRID_ALIGNMENT;

/**
 * The inline drawer's track alignment: for each structure with a column (row) track, a finding
 * when it does not align its items on that axis, or when its track sits elsewhere than its items
 * (an absent track alignment is the initial one, the start). The element is as large as the
 * collapse has opened, but a grid whose flex factors add up to less than 1 gives its track only
 * that fraction of the element, so a track left at the start while the panel sits at the end of
 * it leaves an empty strip between the visible panel and the page. With `collapsing`, a
 * structure it names is checked on that axis only: its other track stays whole (the pin of
 * {@link zeroMinimumTrackFindings}), filling the element, so its items stretch there as they do
 * once entered.
 */
function trackAlignmentFindings(
  structures: Readonly<Record<string, string>>,
  collapsing: Readonly<Record<string, GridAxis>> = {},
): string[] {
  return Object.entries(structures).flatMap(([edge, value]) => {
    const utilities = words(value)
      .map(parseWord)
      .filter(({ variants }) => variants.length === 0)
      .map(({ utility }) => utility);
    const axis = Object.hasOwn(collapsing, edge) ? collapsing[edge] : undefined;
    return Object.entries(GRID_ALIGNMENT).flatMap(([name, { track, items, content }]) => {
      if (axis !== undefined && name !== axis) return [];
      if (!utilities.some((utility) => track.test(utility))) return [];
      const item = alignmentValue(utilities, items);
      if (item === undefined) return [`${edge}: no item alignment`];
      const placed = alignmentValue(utilities, content) ?? 'start';
      return placed === item ? [] : [`${edge}: items ${item}, track ${placed}`];
    });
  });
}

/**
 * The axis whose track a collapse motion opens and closes: `inline` when it transitions the
 * column template, `block` when it transitions the row template; `undefined` for neither or both.
 */
function collapsingAxis(motionValue: string): GridAxis | undefined {
  const properties = transitionedProperties(motionValue);
  const columns = properties.includes('grid-template-columns');
  const rows = properties.includes('grid-template-rows');
  if (columns === rows) return undefined;
  return columns ? 'inline' : 'block';
}

/**
 * Every structure export of the module that is a grid in some phase (a plain grid display on a
 * value): a toast's container, a grid in every phase (it takes focus, so it never renders without
 * a box), and the collapse elements, a grid while they enter or exit. Each value pins the axis it
 * does not animate as well as the one it does ({@link zeroMinimumTrackFindings}).
 */
const GRID_STRUCTURES = ['collapseStructure', 'inlineDrawerStructure', 'toastStructure'];

/**
 * The plain (variant-free) track template of `axis` that has a zero minimum: an arbitrary
 * `minmax(0,…)` template, or Tailwind's `grid-cols-<n>`/`grid-rows-<n>` (each track
 * `minmax(0,1fr)`).
 */
function hasZeroMinimumTrack(utilities: readonly string[], axis: 'cols' | 'rows'): boolean {
  const arbitrary = new RegExp(`^grid-${axis}-\\[minmax\\(0,[^\\]]+\\)\\]$`);
  const counted = new RegExp(`^grid-${axis}-\\d+$`);
  return utilities.some((utility) => arbitrary.test(utility) || counted.test(utility));
}

/**
 * The grid tracks of a structure (D12, D14): for a value with a plain grid display, a finding per
 * axis without a zero-minimum track. Without a template the axis has one implicit track sized by
 * its content (an automatic minimum): a column then grows to the content's longest unbreakable
 * line (a long link, a label that does not wrap) past the element's width, so the part is wider
 * while the element is a grid than once entered; and a row cannot get smaller than the content,
 * so the element could not open from or close to nothing.
 */
function zeroMinimumTrackFindings(value: string): string[] {
  const utilities = words(value)
    .map(parseWord)
    .filter(({ variants }) => variants.length === 0)
    .map(({ utility }) => utility);
  if (!utilities.includes('grid')) return [];
  return (['cols', 'rows'] as const)
    .filter((axis) => !hasZeroMinimumTrack(utilities, axis))
    .map((axis) => `${axis}: no zero-minimum track`);
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
      ).toEqual(['duration-wave-*', 'ease-wave-*']);
    });

    it('reports a duration or a curve that times only the exit or only reduced motion', () => {
      expect(
        missingTimingTokens(
          'transition-opacity data-[presence=exiting]:duration-wave-fast ease-wave-easy-ease motion-reduce:transition-none',
        ),
      ).toEqual(['duration-wave-*']);
      expect(
        missingTimingTokens(
          'transition-opacity duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none',
        ),
      ).toEqual(['ease-wave-*']);
      expect(
        missingTimingTokens(
          'transition-opacity motion-reduce:duration-wave-fast motion-reduce:ease-wave-easy-ease motion-reduce:transition-none',
        ),
      ).toEqual(['duration-wave-*', 'ease-wave-*']);
    });

    it('accepts them next to an exit override, and needs none without a transition', () => {
      expect(
        missingTimingTokens(
          'transition-opacity duration-wave-normal data-[presence=exiting]:duration-wave-fast ease-wave-easy-ease data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none',
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

  describe('5. a positioned surface never transitions transform (D4)', () => {
    it('reports every transition that moves transform, under any variants', () => {
      expect(
        transformTransitions(
          'transition transition-all data-[presence=exiting]:transition-transform transition-[opacity,transform] transition-[all] transition-[opacity,translate] transition-opacity motion-reduce:transition-none',
        ),
      ).toEqual([
        'transition',
        'transition-all',
        'data-[presence=exiting]:transition-transform',
        'transition-[opacity,transform]',
        'transition-[all]',
      ]);
    });

    it('reads whether a transition lists translate for the enter', () => {
      expect(listsTranslate('transition-[opacity,translate] duration-wave-fast')).toBe(true);
      expect(
        listsTranslate('data-[side=top]:transition-[opacity,translate] duration-wave-fast'),
      ).toBe(true);
      expect(listsTranslate('data-[presence=exiting]:transition-[translate,opacity]')).toBe(false);
      expect(listsTranslate('transition-[opacity,scale] data-[side=top]:translate-y-1')).toBe(
        false,
      );
      expect(listsTranslate('transition-opacity motion-reduce:transition-[translate]')).toBe(false);
    });

    it('reads the properties a recipe transitions, outside reduced motion', () => {
      expect(
        transitionedProperties(
          'transition-opacity duration-wave-fast motion-reduce:transition-none data-[presence=exiting]:opacity-0',
        ),
      ).toEqual(['opacity']);
      expect(
        transitionedProperties(
          'transition-[opacity,translate] data-[presence=exiting]:transition-colors transition motion-reduce:transition-[scale]',
        ),
      ).toEqual(['opacity', 'translate', 'colors', 'default']);
      expect(transitionedProperties('duration-wave-fast motion-reduce:transition-none')).toEqual(
        [],
      );
    });

    it('holds for every positioned recipe, a string export of the module', () => {
      const exports: Readonly<Record<string, unknown>> = motion;
      expect(POSITIONED_RECIPES.length).toBeGreaterThan(0);
      // Every positioned recipe either slides or only fades, so a new one is checked for one of them.
      expect([...POSITIONED_RECIPES].sort()).toEqual(
        [...SLIDING_POSITIONED_RECIPES, ...FADING_POSITIONED_RECIPES].sort(),
      );
      for (const name of POSITIONED_RECIPES) {
        expect(typeof exports[name], name).toBe('string');
      }
      expect(
        POSITIONED_RECIPES.flatMap((name) =>
          transformTransitions(String(exports[name])).map((word) => `${name}: ${word}`),
        ),
      ).toEqual([]);
      expect(
        SLIDING_POSITIONED_RECIPES.filter((name) => !listsTranslate(String(exports[name]))),
      ).toEqual([]);
      expect(
        FADING_POSITIONED_RECIPES.flatMap((name) => {
          const properties = transitionedProperties(String(exports[name]));
          return properties.length === 1 && properties[0] === 'opacity'
            ? []
            : [`${name}: ${properties.join(', ') || 'nothing'}`];
        }),
      ).toEqual([]);
    });
  });

  describe('6. a backdrop exits with its surface (D16)', () => {
    it('reads the exit duration: the exiting one, else the plain one', () => {
      expect(
        exitDuration(
          'transition-opacity duration-wave-gentle data-[presence=exiting]:duration-wave-normal',
        ),
      ).toBe('duration-wave-normal');
      expect(exitDuration('transition-opacity duration-wave-gentle')).toBe('duration-wave-gentle');
      expect(
        exitDuration(
          'transition-opacity motion-reduce:duration-wave-fast motion-reduce:duration-0',
        ),
      ).toBeUndefined();
    });

    it('reads the plain duration: the one without a variant', () => {
      expect(
        plainDuration(
          'transition-opacity data-[presence=exiting]:duration-wave-normal duration-wave-gentle',
        ),
      ).toBe('duration-wave-gentle');
      expect(
        plainDuration('transition-opacity data-[presence=exiting]:duration-wave-normal'),
      ).toBeUndefined();
    });

    it('reports a backdrop that exits over another duration than its surface', () => {
      const surface =
        'transition-[opacity,scale] duration-wave-gentle data-[presence=exiting]:duration-wave-normal';
      expect(backdropExitMismatch(surface, 'transition-opacity duration-wave-gentle')).toEqual([
        'exits over duration-wave-gentle, its surface over duration-wave-normal',
      ]);
      expect(backdropExitMismatch(surface, 'transition-opacity')).toEqual([
        'exits over no duration, its surface over duration-wave-normal',
      ]);
      expect(
        backdropExitMismatch(
          surface,
          'transition-opacity duration-wave-slow data-[presence=exiting]:duration-wave-normal',
        ),
      ).toEqual([]);
    });

    it('holds for every pair, and every pair names two string recipes', () => {
      const exports: Readonly<Record<string, unknown>> = motion;
      const pairs = Object.entries(BACKDROP_PAIRS);
      expect(pairs.length).toBeGreaterThan(0);
      for (const [backdrop, surface] of pairs) {
        expect(typeof exports[backdrop], backdrop).toBe('string');
        expect(typeof exports[surface], surface).toBe('string');
      }
      expect(
        pairs.flatMap(([backdrop, surface]) =>
          backdropExitMismatch(String(exports[surface]), String(exports[backdrop])).map(
            (finding) => `${backdrop}: ${finding}`,
          ),
        ),
      ).toEqual([]);
    });

    it('reports a sized backdrop that enters or exits without its size’s duration, or exits otherwise than a surface', () => {
      const durations = { small: 'duration-wave-gentle', large: 'duration-wave-slow' };
      const surfaces = {
        start: 'transition-[translate] ease-wave-easy-ease motion-reduce:transition-none',
        end: 'transition-[translate] ease-wave-easy-ease data-[presence=exiting]:duration-wave-fast motion-reduce:transition-none',
      };
      expect(
        sizedBackdropMismatches(surfaces, durations, {
          small: 'transition-opacity duration-wave-gentle',
          large: 'transition-opacity duration-wave-gentle',
        }),
      ).toEqual([
        'small, end: exits over duration-wave-gentle, its surface over duration-wave-fast',
        "large: enters over duration-wave-gentle, the size's duration is duration-wave-slow",
        "large: exits over duration-wave-gentle, the size's duration is duration-wave-slow",
        'large, start: exits over duration-wave-gentle, its surface over duration-wave-slow',
        'large, end: exits over duration-wave-gentle, its surface over duration-wave-fast',
      ]);
      expect(
        sizedBackdropMismatches({ start: surfaces.start }, durations, {
          small: 'transition-opacity duration-wave-gentle',
        }),
      ).toEqual(['large: no backdrop recipe']);
      // A backdrop that exits over its size's duration but enters over another one.
      expect(
        sizedBackdropMismatches({ start: surfaces.start }, durations, {
          small:
            'transition-opacity duration-wave-slow data-[presence=exiting]:duration-wave-gentle',
          large: 'transition-opacity duration-wave-slow',
        }),
      ).toEqual([
        "small: enters over duration-wave-slow, the size's duration is duration-wave-gentle",
      ]);
      expect(
        sizedBackdropMismatches({ start: surfaces.start }, durations, {
          small: 'transition-opacity duration-wave-gentle',
          large: 'transition-opacity duration-wave-slow',
        }),
      ).toEqual([]);
    });

    it('holds for every size of every sized pair, which names records of strings', () => {
      const exports: Readonly<Record<string, unknown>> = motion;
      const pairs = Object.entries(SIZED_BACKDROP_PAIRS);
      expect(pairs.length).toBeGreaterThan(0);
      for (const [backdrop, { surface, durations }] of pairs) {
        for (const name of [backdrop, surface, durations]) {
          expect(isRecordOfStrings(exports[name]), name).toBe(true);
        }
        const backdrops = exports[backdrop] as Readonly<Record<string, string>>;
        const surfaces = exports[surface] as Readonly<Record<string, string>>;
        const sizes = exports[durations] as Readonly<Record<string, string>>;
        expect(Object.keys(backdrops).sort(), backdrop).toEqual(Object.keys(sizes).sort());
        expect(
          sizedBackdropMismatches(surfaces, sizes, backdrops).map(
            (finding) => `${backdrop}: ${finding}`,
          ),
        ).toEqual([]);
      }
    });
  });

  describe('the inline drawer structure lifts its panel’s size cap while not entered (D13)', () => {
    it('reports a missing lift, an ungated one and one on the wrong axis', () => {
      const lifts = { start: 'max-w-none', bottom: 'max-h-none' };
      expect(
        panelCapFindings(
          {
            start: 'grid overflow-hidden data-[presence=entered]:contents',
            bottom: 'grid *:max-h-none not-data-[presence=entered]:*:max-w-none',
          },
          lifts,
        ),
      ).toEqual([
        'start: no not-data-[presence=entered]:*:max-w-none',
        'bottom: no not-data-[presence=entered]:*:max-h-none',
        'bottom: *:max-h-none',
        'bottom: not-data-[presence=entered]:*:max-w-none',
      ]);
      expect(panelCapFindings({ start: 'grid' }, lifts)).toEqual([
        'start: no not-data-[presence=entered]:*:max-w-none',
        'bottom: no structure',
      ]);
      expect(
        panelCapFindings(
          {
            start: 'grid not-data-[presence=entered]:*:max-w-none',
            bottom: 'grid not-data-[presence=entered]:*:max-h-none',
          },
          lifts,
        ),
      ).toEqual([]);
    });

    it('compiles the lift to the children of an element that is not entered', () => {
      for (const [lift, property] of [
        ['max-w-none', 'max-width: none'],
        ['max-h-none', 'max-height: none'],
      ] as const) {
        const [css] = designSystem.candidatesToCss([`${NOT_ENTERED_CHILD}:${lift}`]);
        expect(css).toContain(':not([data-presence="entered"]) > *');
        expect(css).toContain(property);
      }
    });

    it('holds for every edge of inlineDrawerStructure', () => {
      const structures: Readonly<Record<string, string>> = motion.inlineDrawerStructure;
      expect(Object.keys(structures).sort()).toEqual(Object.keys(PANEL_CAP_LIFTS).sort());
      expect(panelCapFindings(structures, PANEL_CAP_LIFTS)).toEqual([]);
    });
  });

  describe('the inline drawer structure lays its track where it aligns the panel (D13)', () => {
    it('reports a track left at the start of items aligned elsewhere, and no item alignment', () => {
      expect(
        trackAlignmentFindings({
          start: 'grid grid-cols-[minmax(0,1fr)] justify-items-end overflow-hidden',
          left: 'grid grid-cols-[minmax(0,1fr)] [justify-items:right] overflow-hidden',
          end: 'grid grid-cols-[minmax(0,1fr)] justify-items-start justify-end',
          bottom: 'grid grid-rows-[minmax(0,1fr)] items-end',
          none: 'grid grid-cols-[minmax(0,1fr)] overflow-hidden',
          gated: 'grid grid-cols-[minmax(0,1fr)] justify-items-end data-[x]:justify-end',
        }),
      ).toEqual([
        'start: items end, track start',
        'left: items right, track start',
        'end: items start, track end',
        'bottom: items end, track start',
        'none: no item alignment',
        'gated: items end, track start',
      ]);
    });

    it('accepts a track aligned with its items, the initial start included, and no track', () => {
      expect(
        trackAlignmentFindings({
          start: 'grid grid-cols-[minmax(0,1fr)] justify-items-end justify-end',
          end: 'grid grid-cols-[minmax(0,1fr)] justify-items-start',
          left: 'grid grid-cols-[minmax(0,1fr)] [justify-items:right] [justify-content:right]',
          right: 'grid grid-cols-[minmax(0,1fr)] [justify-items:left] [justify-content:left]',
          bottom: 'grid grid-rows-[minmax(0,1fr)] items-start',
          flex: 'flex items-end',
        }),
      ).toEqual([]);
    });

    it('reads the collapsing axis from the motion, and checks only that axis of a pinned structure', () => {
      expect(
        collapsingAxis(
          'transition-[grid-template-columns,opacity] motion-reduce:transition-none data-[presence=exiting]:grid-cols-[minmax(0,0fr)]',
        ),
      ).toBe('inline');
      expect(collapsingAxis('transition-[grid-template-rows,opacity] duration-wave-fast')).toBe(
        'block',
      );
      expect(collapsingAxis('transition-[grid-template-rows,grid-template-columns]')).toBe(
        undefined,
      );
      expect(
        collapsingAxis('transition-opacity motion-reduce:transition-[grid-template-rows]'),
      ).toBe(undefined);
      const pinned =
        'grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-start overflow-hidden';
      // Without the axis, the pinned column (its items stretched) is reported.
      expect(trackAlignmentFindings({ bottom: pinned })).toEqual(['bottom: no item alignment']);
      expect(trackAlignmentFindings({ bottom: pinned }, { bottom: 'block' })).toEqual([]);
      // The collapsing axis is still checked.
      expect(
        trackAlignmentFindings(
          { bottom: pinned.replace('items-start', 'items-end') },
          { bottom: 'block' },
        ),
      ).toEqual(['bottom: items end, track start']);
      expect(trackAlignmentFindings({ start: pinned }, { start: 'inline' })).toEqual([
        'start: no item alignment',
      ]);
    });

    it('holds for every edge of inlineDrawerStructure, on the axis its motion collapses', () => {
      const structures: Readonly<Record<string, string>> = motion.inlineDrawerStructure;
      const width = collapsingAxis(motion.inlineDrawerMotion.width);
      const height = collapsingAxis(motion.inlineDrawerMotion.height);
      expect([width, height]).toEqual(['inline', 'block']);
      const collapsing = Object.fromEntries(
        Object.keys(structures).map((edge) => [edge, edge === 'bottom' ? height : width]),
      ) as Record<string, GridAxis>;
      expect(trackAlignmentFindings(structures, collapsing)).toEqual([]);
    });
  });

  describe('the collapse structure clips its part instead of stretching it into the track (D12)', () => {
    /** The variant-free utilities of a class string. */
    const plainUtilities = (value: string) =>
      words(value)
        .map(parseWord)
        .filter(({ variants }) => variants.length === 0)
        .map(({ utility }) => utility);

    it('reports a part stretched to the track, or placed away from where the track sits', () => {
      expect(
        trackAlignmentFindings({
          // The plan's literal: no alignment, so the part stretches.
          plan: 'grid grid-rows-[minmax(0,1fr)] overflow-hidden data-[presence=entered]:contents',
          stretched: 'grid grid-rows-[minmax(0,1fr)] items-stretch overflow-hidden',
          end: 'grid grid-rows-[minmax(0,1fr)] items-end overflow-hidden',
          gated: 'grid grid-rows-[minmax(0,1fr)] data-[presence=exiting]:items-start',
        }),
      ).toEqual([
        'plan: no item alignment',
        'stretched: items stretch, track start',
        'end: items end, track start',
        'gated: no item alignment',
      ]);
    });

    it('holds for collapseStructure: the part at the start of a track at the start', () => {
      const axis = collapsingAxis(motion.collapseMotion);
      expect(axis).toBe('block');
      expect(
        trackAlignmentFindings(
          { collapseStructure: motion.collapseStructure },
          { collapseStructure: axis! },
        ),
      ).toEqual([]);
      expect(plainUtilities(motion.collapseStructure)).toContain('items-start');
    });
  });

  describe('a grid structure pins both of its tracks to a zero minimum (D12, D14)', () => {
    it('reports an axis left to an implicit track, or a track with a minimum other than zero', () => {
      // The plan's toast literal: no column template, so the column grows to the content.
      expect(
        zeroMinimumTrackFindings(
          'grid grid-rows-[minmax(0,1fr)] not-data-[presence=entered]:overflow-hidden',
        ),
      ).toEqual(['cols: no zero-minimum track']);
      // The collapse literal of 0.15's first packages: its rows close, its column follows the part.
      expect(
        zeroMinimumTrackFindings(
          'grid grid-rows-[minmax(0,1fr)] items-start overflow-hidden data-[presence=entered]:contents',
        ),
      ).toEqual(['cols: no zero-minimum track']);
      // A side edge of the inline drawer as first built: its columns close, its row is implicit.
      expect(
        zeroMinimumTrackFindings(
          'grid shrink-0 grid-cols-[minmax(0,1fr)] justify-items-end justify-end overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none',
        ),
      ).toEqual(['rows: no zero-minimum track']);
      expect(zeroMinimumTrackFindings('grid grid-cols-[minmax(0,1fr)] grid-rows-[1fr]')).toEqual([
        'rows: no zero-minimum track',
      ]);
      expect(zeroMinimumTrackFindings('grid grid-cols-[auto] grid-rows-[minmax(0,1fr)]')).toEqual([
        'cols: no zero-minimum track',
      ]);
      // A template under a variant leaves the other phases without one.
      expect(
        zeroMinimumTrackFindings(
          'grid data-[presence=exiting]:grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]',
        ),
      ).toEqual(['cols: no zero-minimum track']);
      expect(zeroMinimumTrackFindings('grid overflow-hidden')).toEqual([
        'cols: no zero-minimum track',
        'rows: no zero-minimum track',
      ]);
    });

    it('accepts zero-minimum tracks on both axes, and a value that is no grid', () => {
      expect(
        zeroMinimumTrackFindings('grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]'),
      ).toEqual([]);
      expect(zeroMinimumTrackFindings('grid grid-cols-1 grid-rows-[minmax(0,0.5fr)]')).toEqual([]);
      expect(zeroMinimumTrackFindings('flex flex-col')).toEqual([]);
      expect(zeroMinimumTrackFindings('data-[presence=exiting]:grid')).toEqual([]);
    });

    /** The values of `lib/motion` with a plain grid display, as `{ name, label, value }`. */
    const gridValues = () =>
      recipeStrings(recipeEntries()).filter(({ value }) =>
        words(value).some((word) => word === 'grid'),
      );

    it('lists every grid structure of the module, each value of which is a grid', () => {
      const exports: Readonly<Record<string, unknown>> = motion;
      expect([...new Set(gridValues().map(({ name }) => name))].sort()).toEqual(
        [...GRID_STRUCTURES].sort(),
      );
      for (const name of GRID_STRUCTURES) {
        const value = exports[name];
        const values = typeof value === 'string' ? [value] : Object.values(value as object);
        expect(values.length, name).toBeGreaterThan(0);
        for (const item of values) expect(words(String(item)), name).toContain('grid');
      }
    });

    it('holds for every value of every grid structure', () => {
      const checked = gridValues();
      expect(checked.map(({ label }) => label)).toEqual(
        expect.arrayContaining([
          'collapseStructure',
          'inlineDrawerStructure.start',
          'inlineDrawerStructure.bottom',
          'toastStructure',
        ]),
      );
      expect(
        checked.flatMap(({ label, value }) =>
          zeroMinimumTrackFindings(value).map((finding) => `${label}: ${finding}`),
        ),
      ).toEqual([]);
    });

    it('keeps the toast container a grid in every phase: it takes focus, so it keeps its box', () => {
      expect(motion.toastStructure).not.toContain(':contents');
    });
  });
});
