import type { MotionPreference, MotionSlot } from './types';

/**
 * The motion of Wave's animated parts, in one server-safe module that imports nothing at run
 * time (types only), so a Server Component and the build's Node checks can reach it.
 *
 * Every recipe added here is one plain string literal per value, never a concatenation, a template
 * or a call: components compose the strings at run time, and the build reads each literal whole.
 * A recipe keys its classes on the presence core's phases and describes, in words in this comment,
 * which properties it moves, which duration and curve tokens it uses and which side it slides from;
 * the guide and the README hold the class strings themselves.
 *
 * This module holds the resolver below. The recipe constants are added with the parts that use them.
 */

/** The text of a class list that marks a presence variant written for 0.14's own motion. */
const PRESENCE_VARIANT = '[presence=';

function slotClassName(slot: MotionSlot): string {
  return typeof slot === 'string' ? slot : slot.className;
}

/**
 * Whether a part keeps 0.14's own motion: no slot, and a `className` that holds a presence
 * variant, which the consumer wrote to animate the surface themselves. That `className` then
 * turns the default motion off, as it did before the default existed.
 *
 * @param slot - The part's `motion` prop.
 * @param legacyClassName - The part's `className`; omit it for a part without that rule.
 */
export function usesLegacyMotion(
  slot: MotionSlot | null | undefined,
  legacyClassName?: string,
): boolean {
  return slot === undefined && (legacyClassName?.includes(PRESENCE_VARIANT) ?? false);
}

/**
 * The motion classes of an animated part: `null` none; a string or `{ className }` the
 * consumer's classes; `undefined` none under the provider's `'none'`, else `recipe`.
 * `legacyClassName` (the parts that keep 0.14's behaviour): a value containing a presence variant
 * gives no default motion.
 *
 * @param slot - The part's `motion` prop: `undefined` the default, `null` none, a value replaces it.
 * @param recipe - The part's default motion classes.
 * @param preference - The `motion` of the nearest `WaveProvider`.
 * @param legacyClassName - The part's `className`, for the parts that keep 0.14's behaviour.
 */
export function resolveMotion(
  slot: MotionSlot | null | undefined,
  recipe: string,
  preference: MotionPreference,
  legacyClassName?: string,
): string {
  if (slot === null) return '';
  if (slot !== undefined) return slotClassName(slot);
  if (preference === 'none') return '';
  if (usesLegacyMotion(slot, legacyClassName)) return '';
  return recipe;
}
