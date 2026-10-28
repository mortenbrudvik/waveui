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
 *   edge), so it reads as sliding out to its own edge, and the track sits on that same side of the
 *   element: while the collapse is partly open, the grid gives its track only that fraction of
 *   the element, and a track left at the element's start would leave an empty strip between the
 *   visible panel and the page wherever the panel aligns to the end. While the element is not
 *   entered it also lifts the panel's own maximum on that axis (its width at a side, its height at
 *   the bottom): that maximum is a percentage, which inside the grid would follow the track and
 *   squeeze the panel's content as the track narrows, where the track should only clip the panel.
 *   Entered, the maximum applies again against the page, as before. Its track on the other axis
 *   (the row at a side, the column at the bottom) has a minimum of zero too and stays whole, so
 *   the panel fills the element on that axis as it fills its place once entered, rather than
 *   growing there to its content's own size.
 * - `inlineDrawerMotion`, the motion of that element per axis: its track and its opacity. It
 *   enters from an empty, transparent track with the mid decelerating curve and exits back to one
 *   with the min accelerating curve, so the space the panel takes in the layout opens and closes
 *   while the panel keeps its size. It holds no duration: the element adds its size's from
 *   `drawerDurations`.
 * - `popupMotion`, a positioned popup (Popover.Content, Menu.Popover and its submenus, the
 *   InfoButton note and the TeachingPopover surface): opacity and translate. It enters from
 *   transparent and moved 4px toward its anchor, on the axis of the side it opened on (the
 *   resolved physical side the surface renders as `data-side`: a popup below its anchor starts
 *   4px higher, one to its right 4px further left), over the normal duration (200 ms) with the mid
 *   decelerating curve, and exits back there over the faster duration (100 ms) with the min
 *   accelerating curve. It lists the properties it moves and never the one floating-ui places the
 *   popup with, so the popup never glides from its last position; a popup that renders no side (a
 *   TeachingPopover rendered in place, without a target) only fades.
 * - `tooltipMotion`, the Tooltip surface: opacity only. It fades in from transparent and back out
 *   over the faster duration (100 ms) with the easy-ease curve, both ways, and does not slide. Like
 *   the popups, it never lists the property floating-ui places the surface with.
 * - `collapseStructure`, the element around the part a disclosure opens and closes (Accordion's
 *   region, a Tree group, a Nav category's list; not motion: it is on the element whatever its
 *   motion slot holds). While the part is open the element renders no box of its own, so the part
 *   lays out in its parent as it did before the element existed; while it enters or exits, the
 *   element is a clipping grid of one row track whose minimum is zero, so the track can get
 *   smaller than the part, padding and borders included. The part sits at the top of that track
 *   at its own height rather than stretched to it: the track only clips the part, so a part that
 *   scrolls shows no scroll bar and keeps its line breaks, and its background and border cover
 *   all of its visible part (while the collapse is partly open, the grid gives its track only that
 *   fraction of the element, so a stretched part would be shorter than what the element shows).
 *   Its one column has a minimum of zero too and fills the element, so the part keeps the width it
 *   has once entered: a column sized by its content would grow to the part's longest unbreakable
 *   line (a long link, a label that does not wrap), and the part would be wider, its end side
 *   clipped and its lines broken anew, for as long as it moves.
 * - `collapseMotion`, the motion of that element: its row track and its opacity. It enters from
 *   an empty, transparent track and exits back to one over the normal duration (200 ms) with the
 *   max easy-ease curve, both ways, so the space the part takes opens and closes while the content
 *   keeps its width.
 * - `expandIconMotion`, the expand icon of a Nav category (its default chevron, or the span of a
 *   custom glyph): the transition of its transform over the fast duration (150 ms) with the
 *   easy-ease curve, both ways, so the chevron's half turn as the category opens and closes is
 *   animated. The turn itself is state, not motion: without this recipe the chevron still turns,
 *   at once.
 * - `navActionsRevealMotion`, the group of a Nav item's actions: the default transition on each
 *   of its direct children (so a button child keeps its colour transition, and its opacity fades)
 *   over the fast duration (150 ms) with the easy-ease curve, so an action fades in as its row is
 *   hovered or takes focus, and out again. It replaces any transition list of the children's own.
 * - `toastStructure`, the container of each toast of a Toaster (not motion: it is on the element
 *   whatever its motion slot holds): a grid of one cell around the one element that holds the
 *   toast's content, both of whose tracks have a minimum of zero. The row track can so get
 *   smaller than that content, and the column keeps the content to the container's width (a
 *   column sized by its content would grow to the content's longest unbreakable line, such as a
 *   long link, past the region's width). Unlike the elements of the disclosures it always has a
 *   box of its own (it takes focus); it clips what it holds while it enters or exits, and no
 *   longer once it is shown.
 * - `toastMotion`, the motion of that container per edge of the stack (the top or bottom edge its
 *   position names): its row track, its bottom margin, its opacity and translate. It enters over
 *   the gentle duration (250 ms) with the mid decelerating curve, all together: the track opens
 *   from empty, the margin returns from minus the region's 8px gap, and the toast fades in from
 *   transparent while it slides 8px in from beyond the stack's edge (from below at the bottom,
 *   from above at the top). It exits over the normal duration (200 ms) with the easy-ease curve:
 *   the toast fades out in place first, then the track and the margin close after a delay of the
 *   same normal duration, so the toasts around it glide together once it has faded. The margin
 *   makes up for the gap the region keeps after each toast, so nothing moves when the exited
 *   container unmounts. Under reduced motion nothing is transitioned, so the delay goes too.
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
 * clipping one-track grid on the panel's axis while it enters or exits, the panel and the track
 * against its inner edge (so no empty strip opens next to the page), the panel without its
 * percentage maximum on that axis (so it is clipped, not squeezed), and a whole track with a zero
 * minimum on the other axis (so the panel fills the element there, as once entered).
 */
export const inlineDrawerStructure: Readonly<Record<DrawerEdge, string>> = {
  start:
    'grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] justify-items-end justify-end overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none',
  end: 'grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] justify-items-start overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none',
  left: 'grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] [justify-items:right] [justify-content:right] overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none', // wave-allow-physical: the consumer asked for the physical left edge
  right:
    'grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] [justify-items:left] [justify-content:left] overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none', // wave-allow-physical: the consumer asked for the physical right edge
  bottom:
    'grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-start overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-h-none',
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

/**
 * The default motion of a positioned popup (Popover.Content, Menu.Popover and its submenus, the
 * InfoButton note and the TeachingPopover surface): a fade and a 4px slide away from its anchor,
 * by the side it opened on, 200 ms in and 100 ms out; only the fade without a side.
 */
export const popupMotion =
  'transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-faster data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[side=top]:data-[presence=entering]:starting:translate-y-1 data-[side=top]:data-[presence=exiting]:translate-y-1 data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 data-[side=bottom]:data-[presence=exiting]:-translate-y-1 data-[side=left]:data-[presence=entering]:starting:translate-x-1 data-[side=left]:data-[presence=exiting]:translate-x-1 data-[side=right]:data-[presence=entering]:starting:-translate-x-1 data-[side=right]:data-[presence=exiting]:-translate-x-1'; // wave-allow-physical: data-side is the resolved physical side

/** The Tooltip surface's default motion: a fade, 100 ms both ways, without a slide. */
export const tooltipMotion =
  'transition-opacity duration-wave-faster ease-wave-easy-ease motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0';

/**
 * The structure of the element around a disclosure's collapsing part (Accordion's region, a Tree
 * group, a Nav category's list): no box while open, a clipping one-track grid of rows while it
 * enters or exits, with the part at the top of the track at its own height (clipped, not
 * squeezed) and in a whole column with a zero minimum (the width it has once entered).
 */
export const collapseStructure =
  'grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-start overflow-hidden data-[presence=entered]:contents';

/**
 * A disclosure's default collapse, on the element around its part: the row track opens from zero
 * and closes back with a fade, 200 ms both ways.
 */
export const collapseMotion =
  'transition-[grid-template-rows,opacity] duration-wave-normal ease-wave-easy-ease-max motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:opacity-0';

/** The default motion of a Nav category's expand icon: its turn is animated, 150 ms both ways. */
export const expandIconMotion =
  'transition-transform duration-wave-fast ease-wave-easy-ease motion-reduce:transition-none';

/**
 * The default reveal of a Nav item's actions, on their group: each action fades in and out as
 * its row is hovered or takes focus, 150 ms both ways.
 */
export const navActionsRevealMotion =
  '*:transition *:duration-wave-fast *:ease-wave-easy-ease motion-reduce:*:transition-none';

/**
 * The structure of a toast's container: a one-cell grid around the toast's content element, its
 * tracks with a zero minimum (the content keeps the container's width), clipping it while the
 * container enters or exits.
 */
export const toastStructure =
  'grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] not-data-[presence=entered]:overflow-hidden';

/**
 * A toast container's default motion per edge of its stack: it opens, fades in and slides from
 * that edge together, 250 ms; it fades out over 200 ms, then closes over 200 ms more.
 */
export const toastMotion: Readonly<Record<'top' | 'bottom', string>> = {
  top: 'transition-[grid-template-rows,margin-bottom,opacity,translate] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-easy-ease data-[presence=exiting]:[transition-delay:var(--wave-duration-normal),var(--wave-duration-normal),0s,0s] motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:-translate-y-2 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0',
  bottom:
    'transition-[grid-template-rows,margin-bottom,opacity,translate] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-easy-ease data-[presence=exiting]:[transition-delay:var(--wave-duration-normal),var(--wave-duration-normal),0s,0s] motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:translate-y-2 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0',
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
