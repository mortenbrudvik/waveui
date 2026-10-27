import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import {
  drawerBackdropMotion,
  drawerDurations,
  drawerMotion,
  inlineDrawerMotion,
  inlineDrawerStructure,
  usesLegacyMotion,
} from '../../lib/motion';
import type { Slot, SlotObject } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import type { BackdropAppearance, ModalType, MotionSlot } from '../../lib/types';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useModalLayer } from '../../hooks/useModalLayer';
import { useMotionClasses } from '../../hooks/useMotion';
import { usePresence } from '../../hooks/usePresence';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { Portal } from '../portal/Portal';
import {
  useBackdropPress,
  useModalDismiss,
  useModalOpener,
  useOpenInsideWarning,
  useRaiseOnOpen,
  type ModalRequestOpen,
  type ModalTrigger,
} from './Dialog.shared';
import { ModalBackdrop } from './Dialog.slots';
import type { DrawerPosition, DrawerSize, DrawerType } from './Drawer.context';
import { getTabbableThrough, usePopoverTabOrder } from './Popover.shared';

/*
 * The drawer panel shell (D108): the panel element of both drawer types with its machinery, its
 * open state, and its placement, size and safe-area classes. Drawer's root and NavDrawer render it.
 * Imports the context module only among the Drawer modules (never the root, the parts or
 * `Drawer.tsx`), and no Nav module.
 */

/**
 * The open state a drawer reports (its triggers' `aria-expanded`, its contexts): an inline
 * drawer's state as it is; an overlay's `false` until the page has hydrated (the portal renders
 * only in the browser), so the server HTML never points `aria-controls` at a panel that is not
 * there.
 */
export function useDrawerOpen(type: DrawerType, openState: boolean): boolean {
  const isClient = useIsClient();
  return type === 'inline' ? openState : openState && isClient;
}

/** The axis a drawer's `size` applies to: the width at a side, the height at the bottom. */
type DrawerSizeAxis = 'width' | 'height';

/** The axis `size` sets for a drawer at `position`. */
function getDrawerSizeAxis(position: DrawerPosition): DrawerSizeAxis {
  return position === 'bottom' ? 'height' : 'width';
}

/**
 * The size classes, keyed by axis: 320px, 592px and 940px on the spacing scale (rem, so they
 * follow the user's font size), and `full` the whole axis. A width (height) class in the
 * consumer's `className` replaces the size, as the consumer's class comes last in `cn()`.
 */
const drawerSizeClasses: Readonly<Record<DrawerSizeAxis, Readonly<Record<DrawerSize, string>>>> = {
  width: { small: 'w-80', medium: 'w-148', large: 'w-235', full: 'w-full' },
  height: { small: 'h-80', medium: 'h-148', large: 'h-235', full: 'h-full' },
};

/**
 * A border on the panel's inner edge (the one facing the page): it marks the panel where the
 * shadow cannot, in high contrast (page, backdrop and panel are black) and in forced colors
 * (which drop shadows).
 */
const drawerEdgeClasses: Readonly<Record<DrawerPosition, string>> = {
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
const overlayPlacementClasses: Readonly<Record<DrawerPosition, string>> = {
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
function getOverlayInsetClasses(position: DrawerPosition, size: DrawerSize): string {
  if (position === 'bottom' && size !== 'full') return 'pb-[env(safe-area-inset-bottom)]';
  return 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]';
}

/**
 * The classes that place and size an overlay panel at `position`: the placement, the inner-edge
 * border, the size on the position's axis and the safe-area insets. They go after the panel's
 * base classes and before the consumer's `className`.
 */
function getOverlayPanelClasses(position: DrawerPosition, size: DrawerSize): string {
  return [
    overlayPlacementClasses[position],
    drawerEdgeClasses[position],
    drawerSizeClasses[getDrawerSizeAxis(position)][size],
    getOverlayInsetClasses(position, size),
  ].join(' ');
}

/**
 * The base classes of an inline panel: an element of the page layout that keeps its width in a
 * flex row and lets its body scroll once the layout bounds its height. Its inner edge is
 * transparent unless the Drawer has `separator` (`data-separator`), and always drawn in forced
 * colors.
 */
const inlinePanelClasses = [
  'relative flex min-h-0 shrink-0 flex-col max-w-full bg-background text-foreground',
  'border-transparent data-[separator]:border-border',
  forcedColors.border,
].join(' ');

/**
 * The classes that place and size an inline panel at `position`: the inner-edge border and the
 * size on the position's axis (a bottom panel is as wide as its container and never taller than
 * it). `full` is the container's width (height). No placement, insets or shadow: where the panel
 * sits is up to the page layout. They go after {@link inlinePanelClasses} and before the
 * consumer's `className`.
 */
function getInlinePanelClasses(position: DrawerPosition, size: DrawerSize): string {
  const axis = getDrawerSizeAxis(position);
  return [
    drawerEdgeClasses[position],
    axis === 'height' ? 'w-full max-h-full' : '',
    drawerSizeClasses[axis][size],
  ]
    .filter(Boolean)
    .join(' ');
}

/** What the drawer panel shell renders and wires (the frozen contract of D108). */
export interface DrawerPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The public component, for the warning keys and texts: `'Drawer'`, `'NavDrawer'`
   * (`<componentName>:open-inside`, `:backdrop-ignored`, `:focus-outside`, `:non-modal-full`).
   */
  componentName: string;
  /**
   * `'overlay'`: a portal, the backdrop, `role="dialog"` and the modal or non-modal machinery;
   * `'inline'`: the panel in place, with the inline focus restore only.
   */
  type: DrawerType;
  /** The reported open state, from {@link useDrawerOpen}. */
  open: boolean;
  /** The root's request function (`useModalOpenState`): Escape and the backdrop ask through it. */
  requestOpen: ModalRequestOpen;
  /** Rendered as `data-position`; picks the overlay's edge or the inline panel's inner edge. */
  position: DrawerPosition;
  /** Rendered as `data-size` (always: the component resolves its own default). */
  size: DrawerSize;
  /** Inline only: draws the inner edge (`data-separator`). Ignored by an overlay. */
  separator: boolean;
  /**
   * Overlay only: `modal`, `alert` or `non-modal` (`data-modal-type`, the role and the layer kind).
   * Ignored inline.
   */
  modalType: ModalType;
  /** `false` keeps the panel mounted while closed, `hidden` and `inert`. */
  unmountOnClose: boolean;
  /**
   * The element of an inline panel: `'aside'` (Drawer, a complementary landmark) or `'div'`
   * (NavDrawer, whose `<nav>` is the landmark).
   */
  inlineAs: 'aside' | 'div';
  /**
   * The root's triggers (`useModalTrigger()`), or `inertModalTrigger` for a component without
   * trigger parts (the layer and the inline restore then capture the element that had focus).
   */
  trigger: ModalTrigger;
  /** Where focus goes when the panel closes, if it can take focus (the root's `finalFocusRef`). */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * The panel's stable class(es), first in its `cn()`: `drawerClassNames.root`, followed by a
   * variant's root (`cn(drawerClassNames.root, navDrawerClassNames.root)`).
   */
  rootClassName: string;
  /**
   * The backdrop's stable class(es), first in its `cn()`: `drawerClassNames.backdrop`, followed by
   * a variant's (`cn(drawerClassNames.backdrop, navDrawerClassNames.backdrop)`).
   */
  backdropClassName: string;
  /**
   * The stable class(es) of the collapse element around an inline panel, first in its `cn()`:
   * `drawerClassNames.collapse`, followed by a variant's
   * (`cn(drawerClassNames.collapse, navDrawerClassNames.collapse)`). Unused by an overlay.
   */
  collapseClassName: string;
  /**
   * The `backdrop` slot (overlay `modal` and `alert` only; a slot on a non-modal or inline panel
   * renders nothing and warns). `null` renders no backdrop.
   */
  backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
  /**
   * The panel's motion slot: `undefined` the default, `null` none, a value replaces it (see
   * `MotionSlot`). The default of an overlay panel is its slide from its edge, on the panel; the
   * default of an inline panel is the collapse of the element around it (the space it takes opens
   * and closes on its axis, with a fade), on that element, and it is the element a value goes on.
   * Both take the duration of the panel's size. An inline panel at `full` has no motion: its
   * element carries the collapse structure only, also with a value. A `className` with presence
   * variants keeps 0.14's own motion while it is `undefined`: no default, and the presence core
   * waits for the panel element (inline too, rather than for the element around it).
   */
  motion?: MotionSlot | null;
  /**
   * The backdrop's motion slot (overlay `modal` and `alert` only): `undefined` the default fade
   * over the duration of the panel's size, `null` none, a value replaces it. Given on a non-modal
   * or inline panel (`null` included), it is ignored with the `backdrop-ignored` warning.
   */
  backdropMotion?: MotionSlot | null;
  /** The panel's id (always set: triggers point `aria-controls` at it). */
  id: string;
  /** Merged with the shell's own ref and the presence ref. */
  ref?: React.Ref<HTMLElement>;
  /** The panel's content, rendered as is: the shell adds no header, Close button or padding. */
  children?: React.ReactNode;
}

/**
 * The classes every overlay panel carries after its stable class: a fixed flex column on the
 * page's background with the overlay shadow, its inner edge in the border colour.
 */
const OVERLAY_PANEL_CLASSES =
  'fixed flex flex-col border-border bg-background text-foreground shadow-64';

/**
 * The drawer panel shell: the panel element of an overlay (in a portal, with its backdrop and the
 * modal or non-modal machinery) or of an inline drawer (in place, with the inline focus restore),
 * on the presence core, with the placement, size, separator and safe-area classes and the
 * `data-type`, `data-position`, `data-size`, `data-modal-type`, `data-separator` and
 * `data-presence` attributes. Returns `null` while unmounted. Its hooks key on `open`. An overlay
 * enters also when it mounts open, and its panel and backdrop carry their motion classes
 * (`motion`, `backdropMotion`); the presence core waits for the panel's. An inline panel renders
 * as the only child of a collapse element (`collapseClassName`, D13), which carries the presence
 * attributes too and the inline motion classes, and which the presence core waits for (the panel
 * itself under 0.14's `className` rule); it never enters on mount.
 *
 * It renders its `children` raw and provides no context: no header, title registry, Close button
 * or padding. The component that renders it holds the open state (`useModalOpenState`, then
 * {@link useDrawerOpen}), renders its triggers itself, names the panel, and calls
 * `useModalTriggerSession(trigger, open)` after rendering it (the shell's effects run first). A
 * change of `type` remounts the panel and its content.
 */
export const DrawerPanel = ({
  componentName,
  type,
  open,
  requestOpen,
  position,
  size,
  separator,
  modalType,
  unmountOnClose,
  inlineAs,
  trigger,
  finalFocusRef,
  rootClassName,
  backdropClassName,
  collapseClassName,
  backdrop,
  motion,
  backdropMotion,
  id,
  className,
  onKeyDown,
  ref,
  children,
  ...rest
}: DrawerPanelProps): React.ReactNode => {
  const inline = type === 'inline';
  const overlay = !inline;
  const nonModal = modalType === 'non-modal';
  const nonModalOverlay = overlay && nonModal;
  const keptMounted = !unmountOnClose;
  // The panel mounts through the presence core (D5, D103): kept mounted while closed with
  // `unmountOnClose={false}`, else removed once it has exited. An overlay also enters when it
  // mounts open (D9: an overlay open by default slides in on a client render as after hydration);
  // an inline panel is page content and never animates on mount.
  const {
    isMounted,
    ref: presenceRef,
    presenceProps,
  } = usePresence(open, { appear: overlay, unmountOnExit: unmountOnClose });
  // The motion classes over the size's duration: an overlay panel slides from its edge and its
  // backdrop fades with it; an inline panel's collapse element opens and closes its space on the
  // panel's axis (D13). A `className` with presence variants keeps 0.14's own motion (D19): no
  // default, and inline the presence core waits for the panel rather than its collapse element.
  const panelMotion = useMotionClasses(
    motion,
    inline
      ? `${inlineDrawerMotion[getDrawerSizeAxis(position)]} ${drawerDurations[size]}`
      : `${drawerMotion[position]} ${drawerDurations[size]}`,
    className,
  );
  const backdropMotionClassName = useMotionClasses(backdropMotion, drawerBackdropMotion[size]);
  const legacyMotion = usesLegacyMotion(motion, className);

  // The panel element of each type, held in state through its own callback ref. A change of `type`
  // remounts the panel (D105): the overlay's hooks see only the portaled element and the inline
  // restore only the inline one, also in the commit that swaps them (the inline restore then still
  // knows the panel that focus was lost from).
  const [overlayPanel, setOverlayPanel] = React.useState<HTMLElement | null>(null);
  const [inlinePanel, setInlinePanel] = React.useState<HTMLElement | null>(null);
  // The mounted panel of either type; each element clears it only while it is still the one held.
  const panelRef = React.useRef<HTMLElement | null>(null);
  const attachOverlayPanel = React.useCallback((node: HTMLElement | null) => {
    if (!node) return undefined;
    panelRef.current = node;
    setOverlayPanel(node);
    return () => {
      if (panelRef.current === node) panelRef.current = null;
      setOverlayPanel(null);
    };
  }, []);
  const attachInlinePanel = React.useCallback((node: HTMLElement | null) => {
    if (!node) return undefined;
    panelRef.current = node;
    setInlinePanel(node);
    return () => {
      if (panelRef.current === node) panelRef.current = null;
      setInlinePanel(null);
    };
  }, []);
  const overlayRef = useMergedRefs<HTMLElement>(ref, attachOverlayPanel, presenceRef);
  const inlineRef = useMergedRefs<HTMLElement>(
    ref,
    attachInlinePanel,
    legacyMotion ? presenceRef : null,
  );

  // An inline panel takes no focus on open and returns it on close only from inside (D101). Called
  // before useModalLayer: on a switch from inline to overlay it restores before the overlay's trap
  // moves focus in.
  useRestoreFocus({
    enabled: open && inline,
    container: inlinePanel,
    triggerRef: trigger.focusRef,
    finalFocusRef,
    requireFocusInside: true,
  });
  // The portal wrapper: a kept-mounted overlay moves to the top of its stack when it opens (D104),
  // before the layer registers and the trap moves focus in.
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  useRaiseOnOpen(open && overlay, keptMounted, portalRef);

  // A backdrop press asks to close, except an alert's (Escape still does; useModalLayer registers
  // its layer without outside presses).
  const backdropPress = useBackdropPress(panelRef, modalType !== 'alert');
  const onDismiss = useModalDismiss(requestOpen, componentName, backdropPress.afterOutsidePress);
  // Only an overlay is a layer: an inline panel is page content (no trap, isolation, scroll lock,
  // Escape or outside press; toasts keep their corner). The overlay's layer is the one the Toaster
  // measures (`modal`, or `dialog` for a non-modal one).
  const layer = useModalLayer({
    open: open && overlay,
    modalType,
    onDismiss,
    refs: [panelRef],
    container: overlayPanel,
    triggerRef: trigger.focusRef,
    finalFocusRef,
  });
  // A non-modal overlay keeps its place in the page's keyboard order right after its opener
  // (D87.5). Both hooks are always called (C-HOOKS, D91). The opener is captured whenever the
  // overlay opens, so a modal panel that turns non-modal while open (focus inside it by then)
  // still knows it.
  const opener = useModalOpener(open && overlay, trigger, overlayPanel);
  const onTabOrderKeyDown = usePopoverTabOrder({
    enabled: open && nonModalOverlay,
    surface: overlayPanel,
    anchorRef: opener,
    getPreviousStop: getTabbableThrough,
  });
  // A popup opened inside a kept-mounted panel that is still open when the panel closes (D106).
  useOpenInsideWarning(open, keptMounted, layer.layerId, componentName, panelRef);
  // A non-modal or inline panel has no backdrop: a given slot (not undefined, null or a boolean)
  // and a given backdrop motion (not undefined) are ignored.
  const backdropIgnored =
    (nonModal || inline) &&
    ((backdrop !== undefined && backdrop !== null && typeof backdrop !== 'boolean') ||
      backdropMotion !== undefined);
  React.useEffect(() => {
    if (!backdropIgnored) return;
    warnOnce(
      `${componentName}:backdrop-ignored`,
      `${componentName}: \`backdrop\` and \`backdropMotion\` are ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.`,
    );
  }, [backdropIgnored, componentName]);
  // A full non-modal overlay covers the page it leaves usable (D87.8).
  const coversUsablePage = open && nonModalOverlay && size === 'full';
  React.useEffect(() => {
    if (!coversUsablePage) return;
    warnOnce(
      `${componentName}:non-modal-full`,
      `${componentName}: \`size="full"\` with \`modalType="non-modal"\` covers the whole page while leaving it usable, so Tab reaches controls hidden behind the drawer. Use \`modalType="modal"\`, \`type="inline"\`, or a smaller size with its room reserved in the page layout.`,
    );
  }, [coversUsablePage, componentName]);

  if (!isMounted) return null;

  if (inline) {
    const InlinePanel = inlineAs;
    // In place, in its collapse element (D13): the presence element, which opens and closes the
    // panel's space and renders no box while open, so the panel lays out as in 0.14. A full panel's
    // size is its container's, so it has nothing to collapse from: no motion. The panel keeps the
    // consumer's props and no role, tabIndex or modal attributes (D100); both elements take the
    // presence attributes (after the consumer's props on the panel): hidden and inert while kept
    // closed.
    return (
      <div
        ref={legacyMotion ? undefined : presenceRef}
        {...presenceProps}
        className={cn(
          collapseClassName,
          inlineDrawerStructure[position],
          size === 'full' ? '' : panelMotion,
        )}
      >
        <InlinePanel
          ref={inlineRef}
          id={id}
          data-type="inline"
          data-position={position}
          data-size={size}
          data-separator={separator ? '' : undefined}
          {...rest}
          {...presenceProps}
          onKeyDown={onKeyDown}
          className={cn(
            rootClassName,
            inlinePanelClasses,
            getInlinePanelClasses(position, size),
            className,
          )}
        >
          {children}
        </InlinePanel>
      </div>
    );
  }

  return (
    <Portal ref={portalRef} layerId={layer.layerId}>
      {/* The backdrop of a modal or alert panel, the panel's sibling; a non-modal one has none.
          Both carry the presence attributes (D7, D103): hidden and inert while kept closed, so a
          closed panel leaves no backdrop over the page. */}
      {!nonModal && (
        <ModalBackdrop
          backdrop={backdrop}
          className={backdropClassName}
          layerId={layer.layerId}
          open={open}
          onMouseDown={backdropPress.onMouseDown}
          presenceProps={presenceProps}
          motionClassName={backdropMotionClassName}
        />
      )}
      <div
        ref={overlayRef}
        role={modalType === 'alert' ? 'alertdialog' : 'dialog'}
        id={id}
        tabIndex={-1}
        data-type="overlay"
        data-position={position}
        data-size={size}
        data-modal-type={modalType}
        {...rest}
        {...presenceProps}
        onKeyDown={composeEventHandlers(onKeyDown, onTabOrderKeyDown)}
        className={cn(
          rootClassName,
          OVERLAY_PANEL_CLASSES,
          getOverlayPanelClasses(position, size),
          panelMotion,
          className,
        )}
      >
        {children}
      </div>
    </Portal>
  );
};
DrawerPanel.displayName = 'DrawerPanel';
