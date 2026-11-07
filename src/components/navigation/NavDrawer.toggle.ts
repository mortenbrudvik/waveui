import * as React from 'react';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import type { DrawerOpenChangeDetails, DrawerType } from '../overlays/Drawer.context';

/*
 * `useNavDrawerToggle`: the state of a NavDrawer that a Hamburger outside it opens and closes, and
 * the props that wire the two. Imports no component, and only types from the overlay modules, so
 * an import of only the hook holds no drawer machinery.
 */

/** Options of {@link useNavDrawerToggle}. */
export interface UseNavDrawerToggleOptions {
  /** Controlled open state. Pass `drawerProps` to the NavDrawer either way. */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called with the next open state and `details` (`reason`: `trigger` for the Hamburger,
   * `escape` and `outside-press` from the NavDrawer, and the `event`) whenever it changes, with
   * the NavDrawer's own details. A controlled state stays as it is until you update `open`.
   */
  onOpenChange?: (open: boolean, details: DrawerOpenChangeDetails) => void;
  /**
   * How the NavDrawer sits on the page, which decides the Hamburger's `aria-haspopup`: an
   * `overlay` is a dialog (`aria-haspopup="dialog"`, and `aria-expanded` is `false` until the page
   * has hydrated, as the NavDrawer's portal renders only in the browser); an `inline` drawer is
   * part of the page (no `aria-haspopup`).
   * @default 'overlay'
   */
  type?: DrawerType;
  /**
   * The id of the NavDrawer's panel, which the Hamburger's `aria-controls` names while the drawer
   * is open. Generated when not given.
   */
  id?: string;
}

/** The props that make a Hamburger outside a NavDrawer its toggle. */
export interface NavDrawerToggleHamburgerProps {
  /** Whether the drawer is open (an overlay is closed until the page has hydrated). */
  'aria-expanded': boolean;
  /** The panel's id while the drawer is open. */
  'aria-controls': string | undefined;
  /** `'dialog'` for an overlay drawer, none for an inline one. */
  'aria-haspopup': 'dialog' | undefined;
  /** Toggles the drawer (reason `trigger`). A click that arrives from a portal opened inside the button is ignored. */
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  /** Holds the button, so focus returns to it when the drawer closes (`drawerProps.finalFocusRef`). */
  ref: React.RefCallback<HTMLButtonElement>;
}

/** The props that connect a NavDrawer to the toggle. */
export interface NavDrawerToggleDrawerProps {
  /** The open state. */
  open: boolean;
  /** Takes the drawer's own requests (Escape, a backdrop press) into the state. */
  onOpenChange: (open: boolean, details: DrawerOpenChangeDetails) => void;
  /** As given to the hook. */
  type: DrawerType;
  /** The panel's id, named by the Hamburger's `aria-controls`. */
  id: string;
  /** The Hamburger: focus returns to it when the drawer closes. */
  finalFocusRef: React.RefObject<HTMLElement | null>;
}

/** What {@link useNavDrawerToggle} returns. */
export interface UseNavDrawerToggleResult {
  /** The open state of the drawer. */
  open: boolean;
  /** Spread onto the Hamburger. */
  hamburgerProps: NavDrawerToggleHamburgerProps;
  /** Spread onto the NavDrawer. */
  drawerProps: NavDrawerToggleDrawerProps;
}

/**
 * Wires a Hamburger outside a NavDrawer (in the page's header) to the drawer: the open state, the
 * Hamburger's `aria-expanded`, `aria-controls` (while the drawer is open) and `aria-haspopup` (for
 * an overlay), its toggle, and `finalFocusRef`, so focus returns to the Hamburger when the drawer
 * closes. A Hamburger inside the NavDrawer needs none of this: it reads the drawer itself.
 *
 * ```tsx
 * const { hamburgerProps, drawerProps } = useNavDrawerToggle({ type: 'overlay' });
 * return (
 *   <>
 *     <Hamburger {...hamburgerProps} />
 *     <NavDrawer {...drawerProps}>…</NavDrawer>
 *   </>
 * );
 * ```
 *
 * The state is `open`/`defaultOpen`/`onOpenChange`, as the NavDrawer's, and the callback gets the
 * NavDrawer's details. Fluent UI has no such hook: its apps wire the Hamburger by hand.
 */
export function useNavDrawerToggle({
  open: openProp,
  defaultOpen,
  onOpenChange,
  type = 'overlay',
  id,
}: UseNavDrawerToggleOptions = {}): UseNavDrawerToggleResult {
  // The details of the request behind a change, written around the setter that `useControllable`
  // calls the callback inside of (only on a change) and cleared right after.
  const detailsRef = React.useRef<DrawerOpenChangeDetails | undefined>(undefined);
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, (next: boolean) => {
    const details = detailsRef.current;
    if (details) onOpenChange?.(next, details);
  });
  const requestOpen = React.useCallback(
    (next: boolean, details: DrawerOpenChangeDetails) => {
      detailsRef.current = details;
      try {
        setOpen(next);
      } finally {
        detailsRef.current = undefined;
      }
    },
    [setOpen],
  );

  const generatedId = useId('wave-nav-drawer');
  const panelId = id ?? generatedId;
  // An overlay renders in a portal, in the browser only: until then the drawer is not there, so
  // the Hamburger reports it closed and points `aria-controls` at nothing.
  const isClient = useIsClient();
  const reportedOpen = open && (type !== 'overlay' || isClient);

  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const setButton = React.useCallback((element: HTMLButtonElement | null) => {
    buttonRef.current = element;
  }, []);

  const onClick = React.useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (event) => {
      if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
      requestOpen(!open, { reason: 'trigger', event: event.nativeEvent });
    },
    [open, requestOpen],
  );

  return React.useMemo(
    () => ({
      open: reportedOpen,
      hamburgerProps: {
        'aria-expanded': reportedOpen,
        'aria-controls': reportedOpen ? panelId : undefined,
        'aria-haspopup': type === 'overlay' ? 'dialog' : undefined,
        onClick,
        ref: setButton,
      },
      drawerProps: {
        open,
        onOpenChange: requestOpen,
        type,
        id: panelId,
        finalFocusRef: buttonRef,
      },
    }),
    [reportedOpen, open, panelId, type, onClick, setButton, requestOpen],
  );
}
