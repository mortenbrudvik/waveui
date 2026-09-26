import { useEffect, useInsertionEffect, useLayoutEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { isDisabledTrigger } from '../lib/events';

/** Options of {@link useHoverIntent}. */
export interface UseHoverIntentOptions {
  /** Whether hover opens and closes the surface. */
  enabled: boolean;
  /** Whether the surface is open (for any reason). */
  open: boolean;
  /** Milliseconds from the pointer entering the trigger to `onOpen`. */
  openDelay: number;
  /** Milliseconds from "the pointer is on neither the trigger nor the surface" to `onClose`. */
  closeDelay: number;
  /** The trigger and the surface elements, held in state (C-POPUPS). */
  trigger: HTMLElement | null;
  surface: HTMLElement | null;
  /** Hover asks to open. */
  onOpen: (event: PointerEvent) => void;
  /** Hover asks to close. */
  onClose: (event: Event) => void;
  /**
   * Whether the hover close applies now; read when a close would start and again when it fires.
   * The component returns `false` for a pinned surface (opened or re-activated by click, keys or a
   * context gesture) and while focus is inside the surface's layer tree. Focus on the trigger does
   * not count.
   */
  canClose: () => boolean;
  /** Coordinates the safe zones of sibling triggers (the submenu triggers of one menu list). */
  group?: HoverIntentGroup;
}

/** Shared by the sibling triggers of one list; create one per list with `createHoverIntentGroup()`. */
export interface HoverIntentGroup {
  /** Whether a sibling's active safe zone contains this viewport point. */
  isHeld(x: number, y: number): boolean;
}

/** Returned by {@link useHoverIntent}; compose the handlers with the consumer's (C-COMPOSE). */
export interface HoverIntent {
  triggerHandlers: {
    onPointerEnter: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    onPointerLeave: React.PointerEventHandler<HTMLElement>;
  };
  surfaceHandlers: {
    onPointerEnter: React.PointerEventHandler<HTMLElement>;
    onPointerLeave: React.PointerEventHandler<HTMLElement>;
  };
  /** Clears pending timers: call it on click, keyboard and context opens, and on close. */
  cancel: () => void;
  /**
   * Starts the close timer now when the pointer is on neither the trigger nor the surface, for a
   * surface that has just become unpinned (a submenu that lost focus to hover focus). Does nothing
   * while the pointer is on either.
   */
  startClose: (event: Event) => void;
}

interface Point {
  x: number;
  y: number;
}

/** A safe zone: the triangle from the point where the pointer left the trigger to the surface. */
interface SafeZone {
  apex: Point;
  a: Point;
  b: Point;
}

/** Pixels a point may lie outside a triangle, or an edge be off, and still count. */
const TOLERANCE = 1;

/** Only a mouse hovers; an event without a pointer type (no PointerEvent support) is a mouse. */
function isMouse(pointerType: string | undefined): boolean {
  return pointerType !== 'touch' && pointerType !== 'pen';
}

/** Whether the triangle `zone` contains the point, within {@link TOLERANCE}. */
function zoneContains({ apex, a, b }: SafeZone, x: number, y: number): boolean {
  const orientation = (a.x - apex.x) * (b.y - apex.y) - (a.y - apex.y) * (b.x - apex.x);
  if (orientation === 0) return false;
  const sign = Math.sign(orientation);
  const edges: Array<[Point, Point]> = [
    [apex, a],
    [a, b],
    [b, apex],
  ];
  return edges.every(([u, v]) => {
    const length = Math.hypot(v.x - u.x, v.y - u.y);
    if (length === 0) return true;
    const distance = ((v.x - u.x) * (y - u.y) - (v.y - u.y) * (x - u.x)) / length;
    return distance * sign >= -TOLERANCE;
  });
}

/**
 * The edge of `surface` that faces `trigger`: its left edge when it starts at or after the
 * trigger's right edge, else its right edge when it ends at or before the trigger's left edge,
 * else its top edge when it starts below the trigger, else its bottom edge.
 */
function facingEdge(trigger: DOMRect, surface: DOMRect): [Point, Point] {
  if (surface.left >= trigger.right - TOLERANCE) {
    return [
      { x: surface.left, y: surface.top },
      { x: surface.left, y: surface.bottom },
    ];
  }
  if (surface.right <= trigger.left + TOLERANCE) {
    return [
      { x: surface.right, y: surface.top },
      { x: surface.right, y: surface.bottom },
    ];
  }
  const y = surface.top >= trigger.bottom - TOLERANCE ? surface.top : surface.bottom;
  return [
    { x: surface.left, y },
    { x: surface.right, y },
  ];
}

/** The active safe zones of each group. */
const groupZones = new WeakMap<HoverIntentGroup, Set<SafeZone>>();

/** Creates the group of the sibling triggers of one list (a menu list's submenu triggers). */
export function createHoverIntentGroup(): HoverIntentGroup {
  const zones = new Set<SafeZone>();
  const group: HoverIntentGroup = {
    isHeld(x, y) {
      for (const zone of zones) if (zoneContains(zone, x, y)) return true;
      return false;
    },
  };
  groupZones.set(group, zones);
  return group;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * The pointer state and timers of one trigger and its surface. Its fields are written only by its
 * handlers, timers and the hook's effects, never during render.
 */
class HoverController {
  private options: UseHoverIntentOptions;
  private open: boolean;
  private onTrigger = false;
  private onSurface = false;
  private openTimer: Timer | undefined;
  private closeTimer: Timer | undefined;
  /** The pointer's last point over the trigger (for the group's hold check). */
  private lastPoint: Point | null = null;
  /** An opening was held by a sibling's safe zone: the next move over the trigger retries. */
  private held = false;
  /** Hover opening is off until the pointer leaves the trigger (dismissed stays dismissed). */
  private suppressed = false;
  /** The hook's own `onClose` asked for the close that is coming. */
  private closing = false;
  private zone: SafeZone | null = null;
  private zoneDocument: Document | null = null;

  constructor(options: UseHoverIntentOptions) {
    this.options = options;
    this.open = options.open;
  }

  setOptions(options: UseHoverIntentOptions): void {
    this.options = options;
  }

  /**
   * Follows the open state. A close the hook did not cause, while the pointer is on the trigger,
   * suppresses hover opening until the pointer leaves it.
   */
  setOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    if (open) {
      this.clearOpen();
    } else {
      this.clearClose();
      this.endZone();
      if (!this.closing && this.onTrigger) this.suppressed = true;
    }
    this.closing = false;
  }

  triggerEnter = (event: React.PointerEvent<HTMLElement>): void => {
    if (!isMouse(event.pointerType) || isDisabledTrigger(event)) return;
    this.onTrigger = true;
    this.lastPoint = { x: event.clientX, y: event.clientY };
    this.endZone();
    this.clearClose();
    if (this.options.enabled && !this.options.open && !this.suppressed) {
      this.startOpen(event.nativeEvent);
    }
  };

  triggerMove = (event: React.PointerEvent<HTMLElement>): void => {
    if (!isMouse(event.pointerType) || isDisabledTrigger(event)) return;
    this.lastPoint = { x: event.clientX, y: event.clientY };
    // Only an opening a sibling's safe zone held is retried by a move.
    if (!this.held || this.openTimer !== undefined) return;
    this.held = false;
    if (this.options.enabled && !this.options.open && !this.suppressed) {
      this.startOpen(event.nativeEvent);
    }
  };

  triggerLeave = (event: React.PointerEvent<HTMLElement>): void => {
    if (!isMouse(event.pointerType)) return;
    this.onTrigger = false;
    this.held = false;
    this.suppressed = false;
    this.clearOpen();
    if (!this.options.enabled || !this.options.open) return;
    this.startZone(event.clientX, event.clientY);
    if (!this.onSurface) this.startCloseIfAllowed(event.nativeEvent);
  };

  surfaceEnter = (event: React.PointerEvent<HTMLElement>): void => {
    if (!isMouse(event.pointerType)) return;
    this.onSurface = true;
    this.clearClose();
    this.endZone();
  };

  surfaceLeave = (event: React.PointerEvent<HTMLElement>): void => {
    if (!isMouse(event.pointerType)) return;
    this.onSurface = false;
    if (!this.options.enabled || !this.options.open || this.onTrigger) return;
    this.startCloseIfAllowed(event.nativeEvent);
  };

  /** Focus left the surface's DOM: with the pointer on neither, the close timer starts. */
  surfaceFocusOut = (event: FocusEvent): void => {
    const surface = event.currentTarget as Node;
    const next = event.relatedTarget as Node | null;
    if (next && surface.contains(next)) return;
    if (!this.options.enabled || !this.options.open || this.onTrigger || this.onSurface) return;
    this.restartClose(event);
  };

  startClose = (event: Event): void => {
    if (!this.options.enabled || !this.options.open || this.onTrigger || this.onSurface) return;
    this.restartClose(event);
  };

  cancel = (): void => {
    this.clearOpen();
    this.clearClose();
    this.endZone();
    this.held = false;
  };

  private startOpen(event: PointerEvent): void {
    this.clearOpen();
    this.openTimer = setTimeout(() => {
      this.openTimer = undefined;
      const { enabled, open, group, onOpen } = this.options;
      if (!enabled || open || this.suppressed || !this.onTrigger) return;
      const point = this.lastPoint;
      if (group && point && group.isHeld(point.x, point.y)) {
        this.held = true;
        return;
      }
      onOpen(event);
    }, this.options.openDelay);
  }

  private startCloseIfAllowed(event: Event): void {
    if (this.options.canClose()) this.restartClose(event);
  }

  private restartClose(event: Event): void {
    this.clearClose();
    this.closeTimer = setTimeout(() => {
      this.closeTimer = undefined;
      const { enabled, open, canClose, onClose } = this.options;
      if (!enabled || !open || this.onTrigger || this.onSurface || !canClose()) return;
      this.closing = true;
      this.endZone();
      onClose(event);
    }, this.options.closeDelay);
  }

  private clearOpen(): void {
    if (this.openTimer !== undefined) clearTimeout(this.openTimer);
    this.openTimer = undefined;
  }

  private clearClose(): void {
    if (this.closeTimer !== undefined) clearTimeout(this.closeTimer);
    this.closeTimer = undefined;
  }

  /** The safe zone from the leave point to the surface's facing edge (a surface with a size). */
  private startZone(x: number, y: number): void {
    this.endZone();
    const { trigger, surface, group } = this.options;
    if (!trigger || !surface) return;
    const surfaceRect = surface.getBoundingClientRect();
    if (surfaceRect.width <= 0 || surfaceRect.height <= 0) return;
    const [a, b] = facingEdge(trigger.getBoundingClientRect(), surfaceRect);
    this.zone = { apex: { x, y }, a, b };
    if (group) groupZones.get(group)?.add(this.zone);
    this.zoneDocument = trigger.ownerDocument;
    this.zoneDocument.addEventListener('pointermove', this.documentMove);
  }

  private endZone(): void {
    const { zone } = this;
    if (!zone) return;
    this.zone = null;
    const { group } = this.options;
    if (group) groupZones.get(group)?.delete(zone);
    this.zoneDocument?.removeEventListener('pointermove', this.documentMove);
    this.zoneDocument = null;
  }

  /** A mouse move while the zone is active: inside, the close restarts; outside, the zone ends. */
  private documentMove = (event: PointerEvent): void => {
    if (!isMouse(event.pointerType) || !this.zone) return;
    if (!this.options.open) {
      this.endZone();
      return;
    }
    if (zoneContains(this.zone, event.clientX, event.clientY)) this.restartClose(event);
    else this.endZone();
  };

  dispose(): void {
    this.cancel();
  }
}

/**
 * Opens and closes a surface on mouse hover, with a triangular safe zone towards it (Menu,
 * Popover). Internal until the positioning, dismiss and hover pieces become public (ROADMAP
 * P7-01). Compose `triggerHandlers` onto the trigger and `surfaceHandlers` onto the surface, after
 * the consumer's handlers; destructure the result.
 *
 * 1. **Mouse only.** Touch and pen pointer events are ignored; an event without a pointer type is
 *    a mouse. Events from an `aria-disabled="true"` element at or inside the trigger open nothing.
 * 2. **Open.** The pointer entering the trigger of a closed surface starts the `openDelay` timer;
 *    leaving the trigger first cancels it. When a sibling's safe zone (the `group`) holds the
 *    pointer's last point as it fires, it does not open, and the next `pointermove` over the
 *    trigger starts it again (moves restart nothing otherwise).
 * 3. **Close.** When the pointer leaves the trigger or the surface, is over neither and
 *    `canClose()` is `true`, the `closeDelay` timer starts; at expiry `canClose()` is read again.
 *    The pointer entering the trigger or the surface cancels it (React enter and leave follow the
 *    component tree, so a portal rendered inside the surface counts as inside). Focus leaving the
 *    surface while the pointer is over neither, and `startClose()`, start the same timer.
 * 4. **Safe zone.** When the pointer leaves the trigger of an open surface that has a size, the
 *    triangle from the leave point to the surface's facing edge is active: every mouse move inside
 *    it restarts the close timer, so the surface stays open while the pointer moves towards it and
 *    closes `closeDelay` after it stops; a move outside ends the zone and leaves the timer alone;
 *    entering the surface or the trigger ends it too. The group reports it to the siblings.
 * 5. `cancel()`, closing and unmounting clear the timers and the zone; the document listener
 *    exists only while a zone is active.
 * 6. **Dismissed stays dismissed.** When the surface closes without the hook's own `onClose`
 *    (Escape, an outside press, item activation, a controlled close) while the pointer is on the
 *    trigger, hover opening is off until the pointer leaves the trigger.
 */
export function useHoverIntent(options: UseHoverIntentOptions): HoverIntent {
  const [controller] = useState(() => new HoverController(options));

  // The latest options, before any layout effect or event handler reads them.
  useInsertionEffect(() => {
    controller.setOptions(options);
  });

  const { open, enabled, surface } = options;
  useLayoutEffect(() => {
    controller.setOpen(open);
  }, [controller, open]);

  useLayoutEffect(() => {
    if (!enabled) controller.cancel();
  }, [controller, enabled]);

  useEffect(() => {
    if (!surface) return undefined;
    surface.addEventListener('focusout', controller.surfaceFocusOut);
    return () => surface.removeEventListener('focusout', controller.surfaceFocusOut);
  }, [controller, surface]);

  useEffect(() => () => controller.dispose(), [controller]);

  return useMemo<HoverIntent>(
    () => ({
      triggerHandlers: {
        onPointerEnter: controller.triggerEnter,
        onPointerMove: controller.triggerMove,
        onPointerLeave: controller.triggerLeave,
      },
      surfaceHandlers: {
        onPointerEnter: controller.surfaceEnter,
        onPointerLeave: controller.surfaceLeave,
      },
      cancel: controller.cancel,
      startClose: controller.startClose,
    }),
    [controller],
  );
}
