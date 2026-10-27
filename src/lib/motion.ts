import type { MotionPreference, MotionSlot, SurfaceSize } from './types';

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
 * - `drawerMotion`, the overlay panel of Drawer and NavDrawer, per edge: opacity and translate. It
 *   enters from transparent and moved out by its whole width (its whole height at the bottom)
 *   beyond its edge, with the mid decelerating curve, and exits back there with the min
 *   accelerating curve. The start and end edges follow the text direction (a right-to-left
 *   counterpart on the same value), the left and right edges do not mirror. It holds no duration:
 *   the panel adds its size's from `drawerDurations`.
 * - `drawerDurations`, the duration of an overlay panel per size, the same both ways: the gentle
 *   duration (250 ms) when small, the slow one (300 ms) when medium, the slower one (400 ms) when
 *   large and the ultra-slow one (500 ms) when full.
 * - `drawerBackdropMotion`, the overlay drawer's backdrop per size: opacity only, with the linear
 *   curve and its size's duration both ways, so it ends with the panel.
 * - `inlineDrawerStructure`, the element around an inline drawer's panel, per edge (not motion: it
 *   is on the element whatever its motion slot holds). While the drawer is open the element
 *   renders no box of its own, so the panel lays out in the page as it did before the element
 *   existed; while it enters or exits, the element is a clipping grid of one track on the panel's
 *   axis (columns at a side, rows at the bottom) whose minimum is zero, so the track can get
 *   smaller than the panel, padding and borders included, and it keeps its size in a flex row. The
 *   panel sits against the inner edge of that track (the end at the start edge, the start at the
 *   end edge, the physical right and left at the left and right edges, the top at the bottom
 *   edge), so it reads as sliding out to its own edge. While the element is not entered it also
 *   lifts the panel's own maximum on that axis (its width at a side, its height at the bottom):
 *   that maximum is a percentage, which inside the grid would follow the track and squeeze the
 *   panel's content as the track narrows, where the track should only clip the panel. Entered,
 *   the maximum applies again against the page, as before.
 * - `inlineDrawerMotion`, the motion of that element per axis: its track and its opacity. It
 *   enters from an empty, transparent track with the mid decelerating curve and exits back to one
 *   with the min accelerating curve, so the space the panel takes in the layout opens and closes
 *   while the panel keeps its size. It holds no duration: the element adds its size's from
 *   `drawerDurations`.
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

/**
 * An edge a drawer is attached to (Drawer's `DrawerPosition`, which lives in a client component
 * module that this module does not import).
 */
type DrawerEdge = 'start' | 'end' | 'left' | 'right' | 'bottom';

/**
 * The overlay drawer panel's default motion per edge: a slide from beyond its edge and a fade,
 * timed by `drawerDurations` (composed at run time).
 */
export const drawerMotion: Readonly<Record<DrawerEdge, string>> = {
  start:
    'transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:-translate-x-full data-[presence=exiting]:-translate-x-full wave-rtl:data-[presence=entering]:starting:translate-x-full wave-rtl:data-[presence=exiting]:translate-x-full',
  end: 'transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:translate-x-full data-[presence=exiting]:translate-x-full wave-rtl:data-[presence=entering]:starting:-translate-x-full wave-rtl:data-[presence=exiting]:-translate-x-full',
  left: 'transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:-translate-x-full data-[presence=exiting]:-translate-x-full', // wave-allow-physical: left and right drawers do not mirror
  right:
    'transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:translate-x-full data-[presence=exiting]:translate-x-full', // wave-allow-physical: left and right drawers do not mirror
  bottom:
    'transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:translate-y-full data-[presence=exiting]:translate-y-full',
};

/** The overlay drawer panel's duration per size: 250, 300, 400 and 500 ms, both ways. */
export const drawerDurations: Readonly<Record<SurfaceSize, string>> = {
  small: 'duration-wave-gentle',
  medium: 'duration-wave-slow',
  large: 'duration-wave-slower',
  full: 'duration-wave-ultra-slow',
};

/** The overlay drawer backdrop's default motion per size: a linear fade over its size's duration. */
export const drawerBackdropMotion: Readonly<Record<SurfaceSize, string>> = {
  small:
    'transition-opacity duration-wave-gentle ease-wave-linear motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
  medium:
    'transition-opacity duration-wave-slow ease-wave-linear motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
  large:
    'transition-opacity duration-wave-slower ease-wave-linear motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
  full: 'transition-opacity duration-wave-ultra-slow ease-wave-linear motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
};

/**
 * The structure of the element around an inline drawer's panel, per edge: no box while open, a
 * clipping one-track grid on the panel's axis while it enters or exits, the panel against its
 * inner edge and without its percentage maximum on that axis (so it is clipped, not squeezed).
 */
export const inlineDrawerStructure: Readonly<Record<DrawerEdge, string>> = {
  start:
    'grid shrink-0 grid-cols-[minmax(0,1fr)] justify-items-end overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none',
  end: 'grid shrink-0 grid-cols-[minmax(0,1fr)] justify-items-start overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none',
  left: 'grid shrink-0 grid-cols-[minmax(0,1fr)] [justify-items:right] overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none', // wave-allow-physical: the consumer asked for the physical left edge
  right:
    'grid shrink-0 grid-cols-[minmax(0,1fr)] [justify-items:left] overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none', // wave-allow-physical: the consumer asked for the physical right edge
  bottom:
    'grid shrink-0 grid-rows-[minmax(0,1fr)] items-start overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-h-none',
};

/**
 * The inline drawer's default motion per axis, on the element around its panel: the track opens
 * from zero and closes back with a fade, timed by `drawerDurations` (composed at run time).
 */
export const inlineDrawerMotion: Readonly<Record<'width' | 'height', string>> = {
  width:
    'transition-[grid-template-columns,opacity] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:grid-cols-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-cols-[minmax(0,0fr)] data-[presence=exiting]:opacity-0',
  height:
    'transition-[grid-template-rows,opacity] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:opacity-0',
};

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
