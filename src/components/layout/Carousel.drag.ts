import * as React from 'react';
import { isEditableTarget, isOwnEvent } from '../../lib/events';

/** The pointer has to move this far (px) before a press becomes a drag: a click stays a click. */
const DRAG_START_DISTANCE = 4;
/** A drag past this share of the viewport width changes the page. */
const COMMIT_DISTANCE_RATIO = 0.25;
/** A release faster than this (px/ms) changes the page whatever the distance. */
const COMMIT_VELOCITY = 0.5;
/** A last move older than this (ms) at the release does not count as speed. */
const STALE_SAMPLE = 100;

export interface UseCarouselDragOptions {
  /** Whether the track can be dragged at all; `false` attaches nothing. */
  enabled: boolean;
  /** The resolved direction: dragging towards the start of the page order shows the next page. */
  dir: 'ltr' | 'rtl';
  /** Called once when a drag ends: `1` shows the next page, `-1` the previous, `0` snaps back. */
  onCommit: (delta: -1 | 0 | 1) => void;
}

export interface UseCarouselDragResult {
  /** Whether a drag is in progress (the track follows the pointer, without a transition). */
  dragging: boolean;
  /** The horizontal pixels the track is displaced by while dragging, else 0. */
  offsetPx: number;
  /** Handlers for the track; empty when the drag is disabled. */
  handlers: {
    onPointerDown?: React.PointerEventHandler<HTMLElement>;
    onPointerMove?: React.PointerEventHandler<HTMLElement>;
    onPointerUp?: React.PointerEventHandler<HTMLElement>;
    onPointerCancel?: React.PointerEventHandler<HTMLElement>;
    onClickCapture?: React.MouseEventHandler<HTMLElement>;
  };
}

interface Session {
  pointerId: number;
  startX: number;
  /** The last two samples, for the release velocity. */
  prev: { x: number; t: number };
  last: { x: number; t: number };
  /** The viewport width at the press. */
  width: number;
  /** Past the start distance: the pointer is captured and the track follows. */
  active: boolean;
}

/**
 * Pointer dragging of a Carousel track. A press becomes a drag after a few pixels; the track then
 * follows the pointer and, on release, the page changes when the drag passed a quarter of the
 * viewport or left fast, else it snaps back. The click that ends a drag is swallowed once, so a
 * slide's link or button is not activated by the drag that started on it.
 */
export function useCarouselDrag({
  enabled,
  dir,
  onCommit,
}: UseCarouselDragOptions): UseCarouselDragResult {
  const [offsetPx, setOffsetPx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const session = React.useRef<Session | null>(null);
  const swallowClick = React.useRef(false);

  const finish = (commit: boolean) => {
    const current = session.current;
    session.current = null;
    if (!current?.active) return;
    setDragging(false);
    setOffsetPx(0);
    if (!commit) {
      onCommit(0);
      return;
    }
    const distance = current.last.x - current.startX;
    const elapsed = current.last.t - current.prev.t;
    // A pointer that rested before the release has no speed.
    const resting = performance.now() - current.last.t > STALE_SAMPLE;
    const velocity = elapsed > 0 && !resting ? (current.last.x - current.prev.x) / elapsed : 0;
    // Towards the start edge (left in LTR) shows the next page; RTL mirrors it.
    const forward = dir === 'rtl' ? 1 : -1;
    let delta: -1 | 0 | 1 = 0;
    if (Math.abs(velocity) > COMMIT_VELOCITY) delta = Math.sign(velocity) === forward ? 1 : -1;
    else if (current.width > 0 && Math.abs(distance) > current.width * COMMIT_DISTANCE_RATIO) {
      delta = Math.sign(distance) === forward ? 1 : -1;
    }
    onCommit(delta);
  };

  if (!enabled) return { dragging: false, offsetPx: 0, handlers: {} };

  const handlers: UseCarouselDragResult['handlers'] = {
    onPointerDown: (event) => {
      if (event.button !== 0 || !event.isPrimary || !isOwnEvent(event)) return;
      // A text field inside a slide keeps its own pointer behaviour (selecting text).
      if (isEditableTarget(event.target) || (event.target as Element).closest?.('select')) return;
      swallowClick.current = false;
      // A release that never reaches the track (the pointer left before the drag began) must not
      // leave the press open: the next move would start a drag with no button held.
      event.currentTarget.ownerDocument.addEventListener(
        'pointerup',
        () => {
          if (session.current && !session.current.active) session.current = null;
        },
        { capture: true, once: true },
      );
      const x = event.clientX;
      const t = performance.now();
      session.current = {
        pointerId: event.pointerId,
        startX: x,
        prev: { x, t },
        last: { x, t },
        width: event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0,
        active: false,
      };
    },
    onPointerMove: (event) => {
      const current = session.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (!current.active) {
        if (Math.abs(event.clientX - current.startX) < DRAG_START_DISTANCE) return;
        current.active = true;
        // Captured only now, so a plain click still reaches the slide's own button or link.
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }
      current.prev = current.last;
      current.last = { x: event.clientX, t: performance.now() };
      setOffsetPx(event.clientX - current.startX);
    },
    onPointerUp: (event) => {
      const current = session.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (current.active) swallowClick.current = true;
      finish(true);
    },
    onPointerCancel: (event) => {
      const current = session.current;
      if (!current || event.pointerId !== current.pointerId) return;
      finish(false);
    },
    onClickCapture: (event) => {
      // The click a browser sends after a mouse drag has a detail; a keyboard or programmatic
      // click (detail 0) is never that click, and a touch drag sends none.
      if (!swallowClick.current || event.detail === 0) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return { dragging, offsetPx, handlers };
}
