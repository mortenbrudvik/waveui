import type { DrawerPosition, DrawerSize } from './Drawer.context';

/*
 * The drawer panel: its placement, size and safe-area classes. Imports the context module only
 * (never the root, the parts or `Drawer.tsx`).
 */

/** The axis a drawer's `size` applies to: the width at a side, the height at the bottom. */
export type DrawerSizeAxis = 'width' | 'height';

/** The axis `size` sets for a drawer at `position`. */
export function getDrawerSizeAxis(position: DrawerPosition): DrawerSizeAxis {
  return position === 'bottom' ? 'height' : 'width';
}

/**
 * The size classes, keyed by axis: 320px, 592px and 940px on the spacing scale (rem, so they
 * follow the user's font size), and `full` the whole axis. A width (height) class in the
 * consumer's `className` replaces the size, as the consumer's class comes last in `cn()`.
 */
export const drawerSizeClasses: Readonly<
  Record<DrawerSizeAxis, Readonly<Record<DrawerSize, string>>>
> = {
  width: { small: 'w-80', medium: 'w-148', large: 'w-235', full: 'w-full' },
  height: { small: 'h-80', medium: 'h-148', large: 'h-235', full: 'h-full' },
};

/**
 * A border on the panel's inner edge (the one facing the page): it marks the panel where the
 * shadow cannot, in high contrast (page, backdrop and panel are black) and in forced colors
 * (which drop shadows).
 */
export const drawerEdgeClasses: Readonly<Record<DrawerPosition, string>> = {
  start: 'border-e',
  end: 'border-s',
  left: 'border-r', // wave-allow-physical: the consumer asked for the physical left edge
  right: 'border-l', // wave-allow-physical: the consumer asked for the physical right edge
  bottom: 'border-t',
};

/**
 * Where an overlay panel is pinned: a side panel spans the window's height, a bottom one its
 * width; neither grows past the window (a size larger than the screen acts as `full`).
 */
export const overlayPlacementClasses: Readonly<Record<DrawerPosition, string>> = {
  start: 'start-0 top-0 h-full max-w-full',
  end: 'end-0 top-0 h-full max-w-full',
  left: 'left-0 top-0 h-full max-w-full', // wave-allow-physical: the consumer asked for the physical left edge
  right: 'right-0 top-0 h-full max-w-full', // wave-allow-physical: the consumer asked for the physical right edge
  bottom: 'inset-x-0 bottom-0 w-full max-h-full',
};

/**
 * The safe-area insets of the screen edges an overlay panel touches (the iOS home indicator, a
 * notch; `0` unless the page sets `viewport-fit=cover`). The panel has no padding of its own, so
 * the inset is the whole padding. A side panel touches the top and bottom edges; a bottom panel
 * the bottom edge, and the top one too at `full`. The side insets (a landscape notch) are not
 * padded.
 */
export function getOverlayInsetClasses(position: DrawerPosition, size: DrawerSize): string {
  if (position === 'bottom' && size !== 'full') return 'pb-[env(safe-area-inset-bottom)]';
  return 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]';
}

/**
 * The classes that place and size an overlay panel at `position`: the placement, the inner-edge
 * border, the size on the position's axis and the safe-area insets. They go after the panel's
 * base classes and before the consumer's `className`.
 */
export function getOverlayPanelClasses(position: DrawerPosition, size: DrawerSize): string {
  return [
    overlayPlacementClasses[position],
    drawerEdgeClasses[position],
    drawerSizeClasses[getDrawerSizeAxis(position)][size],
    getOverlayInsetClasses(position, size),
  ].join(' ');
}
