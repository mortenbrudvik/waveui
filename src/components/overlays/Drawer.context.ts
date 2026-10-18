import * as React from 'react';
import type { Slot } from '../../lib/slot';
import type {
  ModalOpenChangeReason,
  ModalType,
  OpenChangeDetails,
  SurfaceSize,
} from '../../lib/types';
import {
  inertModalTrigger,
  useRequiredContext,
  type ModalRequestOpen,
  type ModalTrigger,
} from './Dialog.shared';
import type { DrawerScrollState } from './Drawer.scroll';

/*
 * The Drawer's public types and its contexts. Imports no component: the root, the parts and the
 * panel modules read it, never the reverse.
 */

/**
 * Side of the screen the drawer is attached to. `start`/`end` follow the text direction (in a
 * right-to-left layout `end` is the left edge); `left`/`right` are physical sides; `bottom` runs
 * along the bottom edge, as wide as the viewport. An inline drawer sits where the page layout puts
 * it: the position picks its inner edge (the one facing the page content) and its size's axis.
 */
export type DrawerPosition = 'start' | 'end' | 'left' | 'right' | 'bottom';

/**
 * How much room a Drawer takes: its width at a side, its height at the bottom. `small` 320px,
 * `medium` 592px, `large` 940px; `full` the viewport (an inline drawer: its container). The shared
 * `SurfaceSize`.
 */
export type DrawerSize = SurfaceSize;

/**
 * How a Drawer sits on the page: `overlay`, a panel over the page (in a portal), or `inline`, a
 * panel in the page layout, rendered where the Drawer is. Fluent's `type`.
 */
export type DrawerType = 'overlay' | 'inline';

/**
 * How a `Drawer` relates to the page: `modal`, `alert` or `non-modal` (the shared `ModalType`;
 * `DialogModalType` is the same type).
 */
export type DrawerModalType = ModalType;

/**
 * Why a `Drawer` asks to open or close: `trigger` (`Drawer.Trigger`), `close`
 * (`Drawer.Close`), `close-button` (the built-in Close button), `escape`, `outside-press` (the
 * backdrop). The shared `ModalOpenChangeReason`, as for Dialog.
 */
export type DrawerOpenChangeReason = ModalOpenChangeReason;

/** The second argument of a `Drawer`'s `onOpenChange`: the reason and the DOM event. */
export type DrawerOpenChangeDetails = OpenChangeDetails<DrawerOpenChangeReason>;

/** What the Drawer root provides to its parts. */
export interface DrawerContextValue {
  open: boolean;
  /** Asks the root to open or close, with the reason and event for `onOpenChange`. */
  requestOpen: ModalRequestOpen;
  /** The trigger element (`attach`) and the focus-restore target resolved from it (`focusRef`). */
  trigger: ModalTrigger;
  /** The panel's id (for the trigger's `aria-controls`). */
  panelId: string;
  /** The drawer's `type`: the trigger of an inline drawer renders no `aria-haspopup`. */
  type: DrawerType;
  /** `true` for sub-components rendered inside the panel (a `Drawer.Trigger` there is misplaced). */
  inPanel: boolean;
  /** The accessible name of the built-in Close button (the Drawer's `closeLabel`). */
  closeLabel: string;
  /** The content of every built-in Close button (the Drawer's `closeButton`; `null` hides them). */
  closeButton: Slot<'span'> | undefined;
}

/** Provided by the Drawer root (`inPanel: false`) and again inside its panel (`inPanel: true`). */
export const DrawerContext = React.createContext<DrawerContextValue | null>(null);
DrawerContext.displayName = 'DrawerContext';

/** What a part reads outside a Drawer in production (C-CONTEXT): closed, requests ignored. */
const inertDrawerContext: DrawerContextValue = {
  open: false,
  requestOpen: () => {},
  trigger: inertModalTrigger,
  panelId: '',
  type: 'overlay',
  inPanel: false,
  closeLabel: 'Close',
  closeButton: undefined,
};

/**
 * C-CONTEXT: the enclosing Drawer's context. Outside a Drawer it throws
 * `[WaveUI] <componentName> must be used within Drawer` in development; in production it logs once
 * and returns an inert value.
 */
export function useDrawerContext(componentName: string): DrawerContextValue {
  return useRequiredContext(DrawerContext, componentName, 'Drawer', () => inertDrawerContext);
}

/**
 * Where the Drawer put a layout part (`Drawer.Header`, `Drawer.Body`, `Drawer.Footer`): `'placed'`
 * around the parts its scan of its direct children placed in the header area or after the body,
 * `'content'` around the body content. Every part provides `'content'` to its own children, so a
 * part nested in another part, in an element or in a component of yours reads `'content'`: it
 * renders where it is and warns. `null` outside a Drawer's panel (read as `'content'`).
 */
export type DrawerPartPlacement = 'placed' | 'content';

/** See {@link DrawerPartPlacement}. */
export const DrawerPartContext = React.createContext<DrawerPartPlacement | null>(null);
DrawerPartContext.displayName = 'DrawerPartContext';

/**
 * `true` inside a `Drawer.Header` (which provides it to its children), so a `Drawer.HeaderTitle`
 * there ends with the built-in Close button. The panel provides `false`, so a Drawer opened from a
 * header does not inherit it.
 */
export const DrawerHeaderContext = React.createContext(false);
DrawerHeaderContext.displayName = 'DrawerHeaderContext';

/**
 * The scroll state of the panel's scrolling body, which the built-in header, `Drawer.Header` and
 * `Drawer.Footer` render as `data-scroll-state` to draw their separators. `null` outside a
 * Drawer's panel (read as `'none'`).
 */
export const DrawerScrollStateContext = React.createContext<DrawerScrollState | null>(null);
DrawerScrollStateContext.displayName = 'DrawerScrollStateContext';
