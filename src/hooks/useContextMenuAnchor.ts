import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
   * The element focused at the gesture that opened the surface (not `<body>`, not inside the
   * surface's layer tree), else `null`: the first focus-return target of a context-opened surface.
   * Kept through its close; an open without a gesture (a controlled open) forgets it.
   */
  opener: React.RefObject<HTMLElement | null>;
  /**
   * Compose onto the trigger. The pointer handlers time a long press of a touch or pen pointer,
   * for browsers that fire no `contextmenu` for it (iOS Safari); they must be composed too.
   */
  triggerHandlers: {
    onContextMenu: React.MouseEventHandler<HTMLElement>;
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
    onPointerDown: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    onPointerUp: React.PointerEventHandler<HTMLElement>;
    onPointerCancel: React.PointerEventHandler<HTMLElement>;
  };
  /**
   * Compose onto the surface: while `enabled`, the browser's context menu never opens over it.
   * With `enabled: false` the handler does nothing, so a component may compose it in every mode
   * and only its context mode suppresses the browser's menu.
   */
  surfaceHandlers: { onContextMenu: React.MouseEventHandler<HTMLElement> };
}

/** Pixels a gesture's reference element may move before an outside scroll closes the surface. */
const SCROLL_TOLERANCE = 2;

/**
 * Milliseconds a touch or pen press is held before it is a long press of the hook's own. Longer
 * than the roughly 500 ms after which the browsers that fire `contextmenu` for a long press fire
 * it, so their event arrives first and cancels this timer: only a browser that fires none (iOS
 * Safari) reaches it.
 */
const LONG_PRESS_MS = 600;

/** Pixels a long press may drift before it is a drag or a scroll instead. */
const LONG_PRESS_SLOP = 10;

/** Milliseconds after a long press of the hook's own in which a `contextmenu` event is its echo. */
const LONG_PRESS_ECHO_MS = 1000;

/** A touch or pen press that waits to become a long press. */
interface LongPress {
  timer: ReturnType<typeof setTimeout>;
  pointerId: number;
  x: number;
  y: number;
}

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

/** An element whose movement since the gesture closes the surface, with its rectangle then. */
interface ScrollReference {
  element: Element;
  rect: DOMRect;
  /**
   * The element a pointer gesture landed on: once it has no box (removed, or `display: none`,
   * such as a row's hover-only action), it no longer counts, and the region alone decides.
   */
  optional: boolean;
}

/** Whether an element has left the document or the layout (it has no box). */
function hasNoBox(element: Element): boolean {
  if (!element.isConnected) return true;
  const rect = element.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0;
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
 *    layer tree calls `onClose('scroll', event)` only when a reference element of the gesture moved
 *    more than 2 px since the gesture. For a pointer gesture those are the trigger and the element
 *    the gesture landed on (the row under the pointer, which a scroll of the region's content
 *    moves), the latter only while it has a box: once it is removed or `display: none` (a row's
 *    hover-only action), the trigger alone counts. For a keyboard gesture the reference is the
 *    keyboard anchor, else the trigger. A scroll that moves none of them (a scroll in an unrelated
 *    panel) is ignored; inertial scrolling of the region's content that is still running at the
 *    right click moves the row, so it closes the surface.
 * 6. **Long press.** A touch or pen press on the trigger (a primary pointer, not on an editable
 *    field or an `aria-disabled` element) that is held for 600 ms without moving more than 10 px
 *    is a pointer gesture at its point, like a `contextmenu` event: browsers that report no
 *    `contextmenu` for a long press (iOS Safari) get the gesture this way. A browser that does
 *    report it fires its event around 500 ms, which cancels the timer, and a `contextmenu` right
 *    after a long press of the hook's own is its echo: prevented and ignored, so the surface opens
 *    once. A release, a cancel (a scroll), a move or a disabled hook cancels the timer.
 * 7. `anchor` and `origin` are replaced at the next gesture, not reset on close. `fromContext` is
 *    decided when `open` becomes `true`: `true` when a gesture of the hook caused that open, else
 *    `false`; a gesture while open makes it `true` (the surface moves to the gesture). It keeps its
 *    value while the surface is closed or exiting. `opener` is kept through the close too, and
 *    forgotten (`null`) when the surface opens without a gesture, so a close or Tab after that
 *    open never returns to an earlier gesture's element.
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
  // The keyboard flag and the reference elements' rectangles at the gesture: written in handlers
  // and effects only.
  const keyboardFlagRef = useRef<{ clear: () => void } | null>(null);
  const referencesRef = useRef<ScrollReference[]>([]);

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

  /**
   * Records the gesture and the rectangles of the elements whose movement closes the surface: the
   * required ones, then an optional one (see `ScrollReference.optional`).
   */
  const startGesture = useCallback(
    (
      anchor: HTMLElement | VirtualElement | null,
      origin: ContextOrigin,
      references: readonly Element[],
      optionalReference?: Element,
    ) => {
      const record = (element: Element, optional: boolean): ScrollReference => ({
        element,
        rect: element.getBoundingClientRect(),
        optional,
      });
      referencesRef.current = references.map((element) => record(element, false));
      if (optionalReference) referencesRef.current.push(record(optionalReference, true));
      setGesture({ anchor, origin, pending: true });
    },
    [],
  );

  const longPressRef = useRef<LongPress | null>(null);
  const longPressFiredAtRef = useRef(Number.NEGATIVE_INFINITY);
  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current.timer);
    longPressRef.current = null;
  }, []);
  useEffect(() => {
    if (!enabled) cancelLongPress();
  }, [enabled, cancelLongPress]);
  useEffect(() => cancelLongPress, [cancelLongPress]);

  const onTriggerContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!enabled || event.defaultPrevented || !isOwnEvent(event)) return;
      // The browser's own report of the long press: it comes first, or it echoes ours.
      cancelLongPress();
      if (Date.now() - longPressFiredAtRef.current < LONG_PRESS_ECHO_MS) {
        event.preventDefault();
        return;
      }
      if (isDisabledTrigger(event) || isEditableTarget(event.target)) return;
      event.preventDefault();
      // The browser's contextmenu for the key press: the surface stays at its keyboard anchor.
      if (keyboardFlagRef.current) return;
      const region = event.currentTarget;
      recordOpener(region.ownerDocument);
      // The region, and the element the gesture landed on (a row, which scrolls inside the
      // region; `isOwnEvent` keeps it inside) while it keeps a box.
      const target = event.target as Element;
      startGesture(
        pointAnchor(event.clientX, event.clientY, region),
        'pointer',
        [region],
        target === region ? undefined : target,
      );
      requestOpen('pointer', event.nativeEvent);
    },
    [enabled, recordOpener, startGesture, requestOpen, cancelLongPress],
  );

  const onTriggerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      cancelLongPress();
      if (!enabled || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
      if (!event.isPrimary || !isOwnEvent(event)) return;
      if (isDisabledTrigger(event) || isEditableTarget(event.target)) return;
      const region = event.currentTarget;
      const target = event.target as Element;
      const native = event.nativeEvent;
      const { clientX: x, clientY: y, pointerId } = event;
      const timer = setTimeout(() => {
        longPressRef.current = null;
        longPressFiredAtRef.current = Date.now();
        recordOpener(region.ownerDocument);
        startGesture(
          pointAnchor(x, y, region),
          'pointer',
          [region],
          target === region ? undefined : target,
        );
        requestOpen('pointer', native);
      }, LONG_PRESS_MS);
      longPressRef.current = { timer, pointerId, x, y };
    },
    [enabled, recordOpener, startGesture, requestOpen, cancelLongPress],
  );

  const onTriggerPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const press = longPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP) {
        cancelLongPress();
      }
    },
    [cancelLongPress],
  );

  const onTriggerPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (longPressRef.current?.pointerId === event.pointerId) cancelLongPress();
    },
    [cancelLongPress],
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
      startGesture(anchor, 'keyboard', [anchor ?? region]);
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

  // The opener belongs to the gesture: an open that no gesture caused (a controlled open from a
  // toolbar button) forgets the last gesture's, before any close or Tab can return to it. It is
  // kept through the close of a gesture-opened surface, which returns focus to it.
  useLayoutEffect(() => {
    if (open && !nextFromContext) opener.current = null;
  }, [open, nextFromContext]);

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
      const moved = referencesRef.current.some(({ element, rect, optional }) => {
        if (optional && hasNoBox(element)) return false;
        const now = element.getBoundingClientRect();
        return (
          Math.abs(now.left - rect.left) > SCROLL_TOLERANCE ||
          Math.abs(now.top - rect.top) > SCROLL_TOLERANCE
        );
      });
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
    () => ({
      onContextMenu: onTriggerContextMenu,
      onKeyDown: onTriggerKeyDown,
      onPointerDown: onTriggerPointerDown,
      onPointerMove: onTriggerPointerMove,
      onPointerUp: onTriggerPointerEnd,
      onPointerCancel: onTriggerPointerEnd,
    }),
    [
      onTriggerContextMenu,
      onTriggerKeyDown,
      onTriggerPointerDown,
      onTriggerPointerMove,
      onTriggerPointerEnd,
    ],
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
