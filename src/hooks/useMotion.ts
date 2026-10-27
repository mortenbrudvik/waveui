import { useWaveTheme } from '../components/provider/WaveProvider';
import { resolveMotion } from '../lib/motion';
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
