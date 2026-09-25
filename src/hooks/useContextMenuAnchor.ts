import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { isDisabledTrigger, isEditableTarget, isOwnEvent } from '../lib/events';
import { isInsideLayerTree } from '../lib/layers';
import type { PopupRect, VirtualElement } from '../lib/types';
import { useEventCallback } from './useEventCallback';

/** Where a context gesture came from. */
export type ContextOrigin = 'pointer' | 'keyboard';

/** Options of {@link useContextMenuAnchor}. */
export interface UseContextMenuAnchorOptions {
  /** Whether context gestures on the trigger open the surface (`openOnContext`). */
  enabled: boolean;
  /** Whether the surface is open. */
  open: boolean;
  /** The trigger element (the context region), held in state: the point's `contextElement`. */
  trigger: HTMLElement | null;
  /** The surface's dismiss layer: context menus and scrolls inside its tree are inside. */
  layerId: string;
  /** A context gesture on the trigger asks to open (or, while open, to move to the new anchor). */
  onOpen: (origin: ContextOrigin, event: Event) => void;
  /** A context menu or an anchor-moving scroll outside asks a context-opened surface to close. */
  onClose: (reason: 'outside-context-menu' | 'scroll', event: Event) => void;
}

/** Returned by {@link useContextMenuAnchor}. Destructure it (react-hooks/refs, like usePresence). */
export interface ContextMenuAnchor {
  /**
   * The positioning anchor of the last context gesture: a zero-size `VirtualElement` at the
   * pointer (pointer origin), or the element that had focus when the key was pressed (keyboard
   * origin; `null` when that was the trigger itself). Kept until the next gesture, so an exiting
   * surface does not jump.
   */
  anchor: HTMLElement | VirtualElement | null;
  /** Whether the open surface was opened (last) by a context gesture; kept like `anchor`. */
  fromContext: boolean;
  /** The origin of the last gesture. */
  origin: ContextOrigin | null;
  /**
   * The element focused at the last gesture (not `<body>`, not inside the surface's layer tree),
   * else `null`: the first focus-return target of a context-opened surface.
   */
  opener: React.RefObject<HTMLElement | null>;
  /** Compose onto the trigger. */
  triggerHandlers: {
    onContextMenu: React.MouseEventHandler<HTMLElement>;
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  };
  /**
   * Compose onto the surface: while `enabled`, the browser's context menu never opens over it.
   * With `enabled: false` the handler does nothing, so a component may compose it in every mode
   * and only its context mode suppresses the browser's menu.
   */
  surfaceHandlers: { onContextMenu: React.MouseEventHandler<HTMLElement> };
}

/** Pixels the anchor's reference element may move before an outside scroll closes the surface. */
const SCROLL_TOLERANCE = 2;

/** Whether a keydown is the keyboard context gesture: Shift+F10 or the ContextMenu key. */
function isContextKey(event: React.KeyboardEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
}

/** A zero-size anchor at a viewport point, scrolled with `contextElement`'s containers. */
function pointAnchor(x: number, y: number, contextElement: Element): VirtualElement {
  const rect: PopupRect = { x, y, width: 0, height: 0, top: y, right: x, bottom: y, left: x };
  return { getBoundingClientRect: () => rect, contextElement };
}

/** The last gesture: its anchor and origin, and whether it has yet to decide `fromContext`. */
interface Gesture {
  anchor: HTMLElement | VirtualElement | null;
  origin: ContextOrigin;
  /** A gesture of the hook asked to open in this update (decides `fromContext`). */
  pending: boolean;
}

/**
 * Context-menu gestures on a trigger region (`openOnContext` on Menu and Popover): a right click
 * (a macOS Ctrl+click, a long press where the browser reports one) opens at the pointer, Shift+F10
 * and the ContextMenu key open at the focused element inside the region. Internal until the
 * positioning, dismiss and hover pieces become public (ROADMAP P7-01).
 *
 * 1. **Origin.** The trigger's keydown of Shift+F10 or ContextMenu sets a keyboard flag, which the
 *    next `pointerdown` anywhere, the next keydown of another key or the surface closing clear. A
 *    `contextmenu` on the trigger while the flag is set is the browser's event for that key press:
 *    it is prevented and changes nothing. Every other `contextmenu` is a pointer gesture at its
 *    point, whatever its `button` or pointer type.
 * 2. **Trigger `contextmenu`** (not default-prevented, not from a portal rendered inside the
 *    trigger, not from an `aria-disabled` element at or inside it, not from an editable field:
 *    those keep the browser's menu and open nothing): prevented; the focused element is recorded
 *    as `opener`; a pointer gesture stores a zero-size `VirtualElement` at the point (its
 *    `contextElement` is the trigger) as `anchor`; then `onOpen('pointer', event)`. A second
 *    gesture while open does the same (the surface moves).
 * 3. **Trigger keydown** of Shift+F10 or ContextMenu (same filters): prevented, the flag is set,
 *    `opener` recorded, `anchor` = the focused element inside the trigger (else `null`), then
 *    `onOpen('keyboard', event)`.
 * 4. **Surface `contextmenu`** is prevented while `enabled`, whether or not a gesture opened the
 *    surface. With `enabled: false` it is left to the browser (the surface handler is inert).
 * 5. **While open from a context gesture:** a `contextmenu` outside the layer tree and the trigger
 *    calls `onClose('outside-context-menu', event)` without preventing it; a scroll outside the
 *    layer tree calls `onClose('scroll', event)` only when the anchor's reference element (the
 *    point's `contextElement`, the keyboard anchor, else the trigger) moved more than 2 px since
 *    the gesture.
 * 6. `anchor` and `origin` are replaced at the next gesture, not reset on close. `fromContext` is
 *    decided when `open` becomes `true`: `true` when a gesture of the hook caused that open, else
 *    `false`; a gesture while open makes it `true` (the surface moves to the gesture). It keeps its
 *    value while the surface is closed or exiting.
 */
export function useContextMenuAnchor(options: UseContextMenuAnchorOptions): ContextMenuAnchor {
  const { enabled, open, trigger, layerId, onOpen, onClose } = options;

  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [fromContext, setFromContext] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(open);

  // `fromContext` during render (C-HOOKS: previous-value state): decided when `open` becomes
  // true, from the gesture requested in the same update.
  const pending = gesture?.pending ?? false;
  let nextFromContext = fromContext;
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) nextFromContext = pending;
  } else if (open && pending) {
    nextFromContext = true;
  }
  if (nextFromContext !== fromContext) setFromContext(nextFromContext);
  if (gesture && pending) setGesture({ ...gesture, pending: false });

  const opener = useRef<HTMLElement | null>(null);
  // The keyboard flag and the reference element's rectangle at the gesture: written in handlers
  // and effects only.
  const keyboardFlagRef = useRef<{ clear: () => void } | null>(null);
  const referenceRef = useRef<{ element: Element; rect: DOMRect } | null>(null);

  const requestOpen = useEventCallback(onOpen);
  const requestClose = useEventCallback(onClose);

  const clearKeyboardFlag = useCallback(() => {
    keyboardFlagRef.current?.clear();
    keyboardFlagRef.current = null;
  }, []);

  const setKeyboardFlag = useCallback(
    (doc: Document) => {
      clearKeyboardFlag();
      // Added during the keydown, after its capture phase: they see only later events.
      const clearOnPointer = () => clearKeyboardFlag();
      const clearOnKey = (event: KeyboardEvent) => {
        const again =
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey));
        if (!again) clearKeyboardFlag();
      };
      doc.addEventListener('pointerdown', clearOnPointer, true);
      doc.addEventListener('keydown', clearOnKey, true);
      keyboardFlagRef.current = {
        clear: () => {
          doc.removeEventListener('pointerdown', clearOnPointer, true);
          doc.removeEventListener('keydown', clearOnKey, true);
        },
      };
    },
    [clearKeyboardFlag],
  );

  /** The focused element, unless it is `<body>` or inside the surface's layer tree. */
  const recordOpener = useCallback(
    (doc: Document) => {
      const active = doc.activeElement as HTMLElement | null;
      opener.current =
        active && active !== doc.body && !isInsideLayerTree(layerId, active) ? active : null;
    },
    [layerId],
  );

  const startGesture = useCallback(
    (anchor: HTMLElement | VirtualElement | null, origin: ContextOrigin, reference: Element) => {
      referenceRef.current = { element: reference, rect: reference.getBoundingClientRect() };
      setGesture({ anchor, origin, pending: true });
    },
    [],
  );

  const onTriggerContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!enabled || event.defaultPrevented || !isOwnEvent(event)) return;
      if (isDisabledTrigger(event) || isEditableTarget(event.target)) return;
      event.preventDefault();
      // The browser's contextmenu for the key press: the surface stays at its keyboard anchor.
      if (keyboardFlagRef.current) return;
      const region = event.currentTarget;
      recordOpener(region.ownerDocument);
      startGesture(pointAnchor(event.clientX, event.clientY, region), 'pointer', region);
      requestOpen('pointer', event.nativeEvent);
    },
    [enabled, recordOpener, startGesture, requestOpen],
  );

  const onTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!enabled || !isContextKey(event) || event.defaultPrevented || !isOwnEvent(event)) return;
      if (isDisabledTrigger(event) || isEditableTarget(event.target)) return;
      event.preventDefault();
      const region = event.currentTarget;
      setKeyboardFlag(region.ownerDocument);
      recordOpener(region.ownerDocument);
      const target = event.target as HTMLElement;
      const anchor = target !== region ? target : null;
      startGesture(anchor, 'keyboard', anchor ?? region);
      requestOpen('keyboard', event.nativeEvent);
    },
    [enabled, setKeyboardFlag, recordOpener, startGesture, requestOpen],
  );

  // Only in context mode: a surface that composes this unconditionally keeps the browser's menu
  // (paste, spelling suggestions in its fields) while the hook is disabled.
  const onSurfaceContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (enabled) event.preventDefault();
    },
    [enabled],
  );

  // The flag clears when the surface closes; nothing is left behind on unmount.
  useEffect(() => {
    if (!open) clearKeyboardFlag();
  }, [open, clearKeyboardFlag]);
  useEffect(() => clearKeyboardFlag, [clearKeyboardFlag]);

  // While open from a context gesture: an outside context menu, or a scroll that moved the anchor.
  useEffect(() => {
    if (!enabled || !open || !fromContext || !trigger) return undefined;
    const doc = trigger.ownerDocument;
    const isOutside = (target: EventTarget | null) =>
      !(target && typeof (target as Node).nodeType === 'number') ||
      !isInsideLayerTree(layerId, target as Node);
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!isOutside(target) || (target && trigger.contains(target))) return;
      requestClose('outside-context-menu', event);
    };
    const onScroll = (event: Event) => {
      if (!isOutside(event.target)) return;
      const reference = referenceRef.current;
      if (!reference) return;
      const now = reference.element.getBoundingClientRect();
      const moved =
        Math.abs(now.left - reference.rect.left) > SCROLL_TOLERANCE ||
        Math.abs(now.top - reference.rect.top) > SCROLL_TOLERANCE;
      if (moved) requestClose('scroll', event);
    };
    doc.addEventListener('contextmenu', onContextMenu, true);
    doc.addEventListener('scroll', onScroll, true);
    return () => {
      doc.removeEventListener('contextmenu', onContextMenu, true);
      doc.removeEventListener('scroll', onScroll, true);
    };
  }, [enabled, open, fromContext, trigger, layerId, requestClose]);

  const triggerHandlers = useMemo(
    () => ({ onContextMenu: onTriggerContextMenu, onKeyDown: onTriggerKeyDown }),
    [onTriggerContextMenu, onTriggerKeyDown],
  );
  const surfaceHandlers = useMemo(
    () => ({ onContextMenu: onSurfaceContextMenu }),
    [onSurfaceContextMenu],
  );

  return {
    anchor: gesture?.anchor ?? null,
    fromContext: nextFromContext,
    origin: gesture?.origin ?? null,
    opener,
    triggerHandlers,
    surfaceHandlers,
  };
}
