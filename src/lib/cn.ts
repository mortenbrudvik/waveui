import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge, type ConfigExtension } from 'tailwind-merge';

/**
 * The Tailwind prefix of the utilities the library draws, without the colon (1.0, Phase 14 spec
 * R6). The class strings of the components, the precompiled sheet and {@link wcn} carry it
 * together: every class string of the library is written with it, `dist/styles.css` is built with
 * `prefix(wave)`, and `wcn` merges those classes with an app's unprefixed ones. Module-only;
 * scripts/build-css.mjs reads it from this file's text and runs the compile check while it is set.
 */
export const UTILITY_PREFIX: string = 'wave';

/** The steps of Wave's type ramp. */
const TEXT = [
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
/** The levels of Wave's shadow scale. */
const SHADOW = ['2', '4', '8', '16', '28', '64'];
const DURATION = [
  'wave-ultra-fast',
  'wave-faster',
  'wave-fast',
  'wave-normal',
  'wave-gentle',
  'wave-slow',
  'wave-slower',
  'wave-ultra-slow',
];
const EASE = [
  'wave-accelerate-max',
  'wave-accelerate-mid',
  'wave-accelerate-min',
  'wave-decelerate-max',
  'wave-decelerate-mid',
  'wave-decelerate-min',
  'wave-easy-ease-max',
  'wave-easy-ease',
  'wave-linear',
];
const FONT = ['wave', 'wave-mono', 'wave-numeric'];
const ANIMATE = [
  'wave-spin',
  'wave-spin-slow',
  'wave-pulse',
  'wave-indeterminate',
  'wave-indeterminate-rtl',
];

/** The steps of a scale under their namespaced names (`wave-body-1`): the theme keys apps use. */
const namespaced = (values: string[]): string[] => values.map((value) => `wave-${value}`);

/**
 * The Wave scales the merge has to know, under both names: the steps of 0.x (`body-1`, `4`), which
 * the components write with {@link UTILITY_PREFIX} (`wave:text-body-1`), and the namespaced ones of
 * the theme keys an app writes (the same steps after `wave-`, `text-wave-body-1`). The font
 * families, animations, durations and curves carry `wave` in both.
 */
const WAVE_SCALES: NonNullable<ConfigExtension<string, string>['extend']> = {
  classGroups: { duration: [{ duration: DURATION }] },
  theme: {
    ease: EASE,
    text: /* @__PURE__ */ TEXT.concat(/* @__PURE__ */ namespaced(TEXT)),
    shadow: /* @__PURE__ */ SHADOW.concat(/* @__PURE__ */ namespaced(SHADOW)),
    font: FONT,
    animate: ANIMATE,
  },
};

/**
 * Builds the class merge for a Tailwind `prefix` (without the colon; empty for none). Module-only:
 * the library calls {@link wcn} and apps {@link cn}, both built from {@link UTILITY_PREFIX}; tests
 * build it for a prefix to prove the prefixed merge.
 *
 * - With a prefix it is tailwind-merge's `prefix` option plus an `experimentalParseClassName` that
 *   parses a class without the prefix as if it carried it, so a class and its prefixed twin are one
 *   utility. Wave's own classes carry the prefix and an app's `className` does not, so the app's
 *   class still replaces a conflicting Wave class of the same variant (the Tailwind padding utility
 *   of an app over Wave's own padding), as in 0.x; tailwind-merge's prefix alone would pass every
 *   unprefixed class through untouched. Both scales are known, so an app's `text-wave-*` size
 *   replaces Wave's size and keeps Wave's text colour. The parse it relies on is pinned by a test
 *   (tailwind-merge marks it experimental), and the dependency is pinned to an exact version.
 * - Without a prefix it is tailwind-merge with both of Wave's scales (the merge of 0.x).
 */
export function createWcn(prefix: string): (...inputs: ClassValue[]) => string {
  const marker = `${prefix}:`;
  const merge = /* @__PURE__ */ extendTailwindMerge({
    ...(prefix
      ? {
          prefix,
          experimentalParseClassName: ({ className, parseClassName }) =>
            parseClassName(className.startsWith(marker) ? className : marker + className),
        }
      : {}),
    extend: WAVE_SCALES,
  });
  return (...inputs) => merge(clsx(inputs));
}

/**
 * The class merge every component, slot helper and part helper of the library calls: joins class
 * names (clsx) and resolves Tailwind conflicts so the last class wins, with the component's
 * classes first and the consumer's `className` last. Module-only; the public {@link cn} is the
 * same merge. Built by {@link createWcn} for {@link UTILITY_PREFIX}, so a consumer's unprefixed
 * class replaces a conflicting prefixed class of the component.
 */
export const wcn = /* @__PURE__ */ createWcn(UTILITY_PREFIX);

/**
 * Joins class names (clsx) and resolves Tailwind conflicts so the **last** class wins — pass
 * your base classes first and the overriding ones last. It is the merge the components use
 * themselves.
 *
 * A class the library writes carries Wave's utility prefix (`wave:`): the public recipes
 * `focusRing`, `focusRingInset`, `inputFocus` and `inputFocusWithin` return such classes. A class
 * and its prefixed twin are one utility here, so your unprefixed class replaces the recipe's
 * conflicting one of the same variant: `cn(focusRing, className)` with a `className` that sets the
 * ring's offset keeps the recipe's ring and drops its offset.
 *
 * It knows Wave's scales under both names: the namespaced theme keys an app's Tailwind build gets
 * from `@mortenbrudvik/waveui/tailwind` or `./tokens` (`text-wave-body-1`, `shadow-wave-4`) and
 * the names of 0.x (`text-body-1`, `shadow-4`). A step of the type ramp is a font size, so a text
 * colour next to it is kept; a level of the shadow scale is a shadow size.
 *
 * A later class replaces only a conflicting class **of the same variant**. Variant and state
 * classes such as the gated `not-disabled:not-aria-disabled:hover:bg-…` or `data-[selected]:bg-…`
 * are kept next to a bare `hover:bg-…`/`bg-…` and win by specificity; override them with the same
 * prefix (`not-disabled:not-aria-disabled:hover:bg-wave-error`), the same data variant, or the
 * important modifier (`hover:bg-wave-error!`).
 *
 * @example
 * cn('text-wave-body-1 text-wave-foreground', className) // "text-wave-error" keeps the size
 */
export function cn(...inputs: ClassValue[]): string {
  return wcn(...inputs);
}
