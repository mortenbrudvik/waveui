import * as React from 'react';
import type { ModalRequestOpen } from '../overlays/Dialog.shared';
import type { DrawerType } from '../overlays/Drawer.context';
import type { DrawerScrollState } from '../overlays/Drawer.scroll';

/*
 * The contexts of a NavDrawer: its open state for the Hamburgers inside it, and the scroll state of
 * its body for its parts. Internal; imports no runtime module but React (types only), so an import
 * of only `Hamburger` pulls in no drawer machinery.
 */

/** What a NavDrawer gives a Hamburger inside it (its header, or anywhere in its tree). */
export interface NavDrawerContextValue {
  /** The reported open state (an overlay's `false` until the page has hydrated). */
  open: boolean;
  /** Asks the NavDrawer to open or close, with the reason and event for `onOpenChange`. */
  requestOpen: ModalRequestOpen;
  /** The panel's id (the Hamburger's `aria-controls`). */
  panelId: string;
  /** How the drawer sits on the page. */
  type: DrawerType;
}

/**
 * The NavDrawer around a Hamburger (`null` outside one: the Hamburger is then a plain button the
 * app wires, so there is no missing-context error).
 */
export const NavDrawerContext = React.createContext<NavDrawerContextValue | null>(null);
NavDrawerContext.displayName = 'NavDrawerContext';

/** What a NavDrawer gives its Header, Body and Footer. */
export interface NavDrawerLayoutContextValue {
  /** The scroll state of the first mounted body (`'none'` on the server and without a body). */
  scrollState: DrawerScrollState;
  /**
   * Registers a body element (from its callback ref); the first one mounted is measured. Returns
   * the cleanup that forgets it.
   */
  registerBody: (element: HTMLElement) => () => void;
}

/**
 * The layout of the NavDrawer around a part (`null` outside one). Separate from the Nav state, so
 * a change of the scroll state re-renders the three parts and not the Nav items.
 */
export const NavDrawerLayoutContext = React.createContext<NavDrawerLayoutContextValue | null>(null);
NavDrawerLayoutContext.displayName = 'NavDrawerLayoutContext';
