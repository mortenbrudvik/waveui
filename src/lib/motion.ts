import type { MotionPreference, MotionSlot } from './types';

/**
 * The motion of Wave's animated parts, in one server-safe module that imports nothing at run
 * time (types only), so a Server Component and the build's Node checks can reach it.
 *
 * Every recipe is one plain string literal per value, never a concatenation, a template or a call:
 * components compose the strings at run time, and the build reads each literal whole. A recipe
 * keys its classes on the presence core's phases (the enter's start gated on the entering phase,
 * the exit on the exiting phase), times them with Wave's duration and curve tokens, lists the
 * properties it moves and switches its transition off under reduced motion. This comment
 * describes each recipe in words and never writes a class: the CSS build reads every word of this
 * file.
 *
 * - `dialogMotion`, the Dialog surface: opacity and scale. It enters from transparent at 85% of its
 *   size over the gentle duration (250 ms) with the mid decelerating curve, and exits back to the
 *   same over the normal duration (200 ms) with the min accelerating curve.
 * - `dialogBackdropMotion`, the Dialog backdrop: opacity only, with the easy-ease curve. It fades in
 *   over the gentle duration and out over the normal duration, the surface's exit, so the backdrop
 *   never outlasts the surface (the presence core waits only for the surface).
 *
 * The resolver below picks the classes of a part: its motion slot, the provider's preference and
 * the className rule of the parts that keep 0.14's own motion.
 */

/** The Dialog surface's default motion: scale and fade, 250 ms in and 200 ms out. */
export const dialogMotion =
  'transition-[opacity,scale] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:scale-85 data-[presence=exiting]:opacity-0 data-[presence=exiting]:scale-85';

/** The Dialog backdrop's default motion: a fade, 250 ms in and 200 ms out (the surface's exit). */
export const dialogBackdropMotion =
  'transition-opacity duration-wave-gentle ease-wave-easy-ease data-[presence=exiting]:duration-wave-normal motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0';

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
