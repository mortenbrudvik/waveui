import * as React from 'react';
import { useWaveTheme } from '../components/provider/WaveProvider';
import { warnOnce } from '../lib/dev';
import { resolveMotion, usesLegacyMotion } from '../lib/motion';
import type { MotionPreference, MotionSlot } from '../lib/types';

/**
 * The motion preference of the nearest `WaveProvider`: `'default'` outside one.
 *
 * @returns `'default'`, or `'none'` when a provider above turned motion off.
 */
export function useMotionPreference(): MotionPreference {
  return useWaveTheme().motion;
}

/**
 * The motion classes of an animated part against the provider's preference (see `resolveMotion`).
 *
 * @param slot - The part's `motion` prop: `undefined` the default, `null` none, a value replaces it.
 * @param recipe - The part's default motion classes.
 * @param legacyClassName - The part's `className`, for the parts that keep 0.14's behaviour.
 */
export function useMotionClasses(
  slot: MotionSlot | null | undefined,
  recipe: string,
  legacyClassName?: string,
): string {
  return resolveMotion(slot, recipe, useMotionPreference(), legacyClassName);
}

/**
 * Warns once per part, in development and from an effect, while its `className` holds a presence
 * variant and no `motion` is given: that 0.14 compatibility rule turns the default motion off and
 * is removed in 1.0.
 *
 * @param part - The part as the consumer writes it (`'Dialog.Content'`, `'Drawer'`).
 * @param slot - The part's `motion` prop.
 * @param className - The part's `className`.
 */
export function useLegacyMotionWarning(
  part: string,
  slot: MotionSlot | null | undefined,
  className: string | undefined,
): void {
  const legacy = usesLegacyMotion(slot, className);
  React.useEffect(() => {
    if (!legacy) return;
    // The mode is read here as `lib/dev` reads it, written out so a bundler replaces it: a
    // production bundle then drops the warning, its text and the `lib/dev` import. Without a
    // bundler and without `process` (an unbundled import in a browser), the read throws and it is
    // skipped.
    try {
      if (process.env.NODE_ENV !== 'production') {
        warnOnce(
          `${part}:legacy-motion`,
          `${part}: a className containing "[presence=" turns the default motion off; this compatibility rule is removed in 1.0 - pass the motion prop instead.`,
        );
      }
    } catch {
      // No `process`: see above.
    }
  }, [legacy, part]);
}
