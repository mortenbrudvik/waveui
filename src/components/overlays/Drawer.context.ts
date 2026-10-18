import * as React from 'react';
import type { ModalOpenChangeReason, OpenChangeDetails, SurfaceSize } from '../../lib/types';
import {
  inertModalTrigger,
  useRequiredContext,
  type ModalRequestOpen,
  type ModalTrigger,
} from './Dialog.shared';

/*
 * The Drawer's public types and its contexts. Imports no component: the root, the parts and the
 * panel modules read it, never the reverse.
 */

/**
 * Side of the screen the drawer is attached to. `start`/`end` follow the text direction (in a
 * right-to-left layout `end` is the left edge); `left`/`right` are physical sides; `bottom` runs
 * along the bottom edge, as wide as the viewport.
 */
export type DrawerPosition = 'start' | 'end' | 'left' | 'right' | 'bottom';

/**
 * How much room a Drawer takes: its width at a side, its height at the bottom. `small` 320px,
 * `medium` 592px, `large` 940px; `full` the viewport. The shared `SurfaceSize`.
 */
export type DrawerSize = SurfaceSize;

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
  /** `true` for sub-components rendered inside the panel (a `Drawer.Trigger` there is misplaced). */
  inPanel: boolean;
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
  inPanel: false,
};

/**
 * C-CONTEXT: the enclosing Drawer's context. Outside a Drawer it throws
 * `[WaveUI] <componentName> must be used within Drawer` in development; in production it logs once
 * and returns an inert value.
 */
export function useDrawerContext(componentName: string): DrawerContextValue {
  return useRequiredContext(DrawerContext, componentName, 'Drawer', () => inertDrawerContext);
}
