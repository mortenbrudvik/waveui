import * as React from 'react';
import { tableResizeHandleClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { mergeSlotProps } from '../../lib/slotProps';
import type { SlotPart } from '../../lib/slotProps';
import { focusRing } from '../../lib/styles';
import { useEventCallback } from '../../hooks/useEventCallback';

/** How far an arrow key moves the edge, in pixels, and how far with Shift held. */
const KEY_STEP = 20;
const SHIFT_KEY_STEP = 5;

/** The work that runs whatever the handler before it does with the event. */
const ALWAYS = { checkDefaultPrevented: false } as const;

/**
 * What a handle part locks unset, before the handle's own attributes (which follow and win): the
 * hidden state (a focusable widget is never hidden) and the marker of a nested composite, which
 * a grid's navigation reads.
 */
const HANDLE_PART_LOCKS = {
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
  'data-roving-container': undefined,
} as const;

/**
 * The props a DataGrid header cell renders its handle with (module-only): the public props and
 * the cell's `resizeHandle` part, merged into the handle's element. Not a prop of
 * `Table.ResizeHandle` (whose `part` is the native attribute); the cell merges the part's ref
 * into its own `ref`.
 */
export interface TableResizeHandlePartProps extends TableResizeHandleProps {
  slotPart?: SlotPart<'div'>;
}

/** Properties for the TableResizeHandle sub-component. */
export interface TableResizeHandleProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onResize' | 'onReset'
> {
  /** The column's current width in pixels. It is reported as `aria-valuenow`. */
  width: number;
  /**
   * The narrowest the column can be, in pixels. The handle never asks for less, and Home sets it.
   * It is reported as `aria-valuemin`.
   * @default 0
   */
  minWidth?: number;
  /**
   * The widest the column can be, in pixels. The handle never asks for more, and End sets it.
   * Without a maximum there is no `aria-valuemax` and End does nothing.
   */
  maxWidth?: number;
  /**
   * Called with the width the user asks for, in whole pixels, held between `minWidth` and
   * `maxWidth`: while a pointer drags (at most once per animation frame) and for every handled
   * key, then `details` with the event behind it. The handle always passes `details`; it is typed
   * optional through 0.x, as every `details` argument. The handle keeps no width of its own, so a
   * parent that ignores the call leaves the column where it is.
   */
  onResize: (width: number, details?: { event: Event }) => void;
  /** Called with the event when the handle is double-clicked: reset the column's width. */
  onReset?: (details: { event: Event }) => void;
  /**
   * Called when Escape is pressed on the handle, or Enter or Space is released on it after being
   * pressed there: move focus back to the header cell. Enter and Space are consumed from their
   * keydown on (their repeats included), so a held key never reaches the element that focus moves
   * to. Without it those keys are left to the handle's ancestors.
   */
  onLeave?: () => void;
  /**
   * The accessible name of the separator.
   * @default 'Resize column'
   */
  label?: string;
  /**
   * Builds `aria-valuetext` from the width.
   * @default (width) => `${width} pixels`
   */
  valueText?: (width: number) => string;
  /** Ref to the `<div>` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** What a pointer drag keeps between its events. */
interface DragState {
  pointerId: number;
  startX: number;
  startWidth: number;
  /** `1`, or `-1` in a right-to-left table, where moving toward the end narrows the column. */
  sign: 1 | -1;
  latestX: number;
  latestEvent: Event | null;
  /** The last width handed to `onResize`, so a width is not reported twice in a row. */
  lastWidth: number;
  /** The animation frame that will apply the latest position, while one is waiting. */
  frame: number | null;
}

/**
 * The drag handle of a column's edge: a vertical `role="separator"` with `aria-valuenow`, meant
 * for the `aside` slot of a `Table.HeaderCell` whose cell is positioned, since the handle is drawn
 * along the cell's end edge. A DataGrid with `resizableColumns` renders it in the header cell of
 * each of its columns itself (a `DataGrid.HeaderCell` has no `aside` slot). A pointer drag (mouse,
 * touch or pen) resizes through `onResize`, with the movement mirrored in right-to-left tables;
 * the arrow keys move the edge by 20 pixels (5 with Shift), Home sets the minimum width and End
 * the maximum one. A double click calls `onReset`. The handle is a Tab stop (`tabIndex` 0), so the
 * keys work in a static table; a grid that manages its own tab stops overrides `tabIndex`. The
 * handle carries `data-grid-auxiliary`, so a grid's cell navigation does not take it for the
 * cell's own widget.
 *
 * It keeps no width: spread the result of `useTableColumnSizing`'s `getResizeHandleProps(columnId)`
 * onto it, or pass `width`, `minWidth` and `onResize` from your own state.
 */
const TableResizeHandle = ({
  width,
  minWidth = 0,
  maxWidth,
  onResize,
  onReset,
  onLeave,
  label = 'Resize column',
  valueText,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onDoubleClick,
  onKeyDown,
  onKeyUp,
  onBlur,
  className,
  ref,
  ...rest
}: TableResizeHandleProps) => {
  const dragRef = React.useRef<DragState | null>(null);
  const [dragging, setDragging] = React.useState(false);
  /** The Enter or Space pressed on the handle whose release leaves it; `null` otherwise. */
  const leaveKeyRef = React.useRef<string | null>(null);

  const clamp = (value: number) => Math.max(minWidth, Math.min(maxWidth ?? Infinity, value));

  // Applies the latest pointer position of the drag. It reads the latest props, also when an
  // animation frame calls it after a render.
  const applyDrag = useEventCallback(() => {
    const drag = dragRef.current;
    if (!drag?.latestEvent) return;
    const next = clamp(Math.round(drag.startWidth + (drag.latestX - drag.startX) * drag.sign));
    if (next === drag.lastWidth) return;
    drag.lastWidth = next;
    onResize(next, { event: drag.latestEvent });
  });

  // Ends the drag; `flush` first applies a move that still waits for its frame.
  const endDrag = (flush: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.frame !== null) window.cancelAnimationFrame(drag.frame);
    drag.frame = null;
    if (flush) applyDrag();
    dragRef.current = null;
    setDragging(false);
  };

  // A frame that is still waiting when the handle unmounts must not call `onResize`: cancelled in
  // the commit that removes the handle, before a frame can run.
  const cancelDragOnUnmount = useEventCallback(() => endDrag(false));
  React.useLayoutEffect(() => cancelDragOnUnmount, [cancelDragOnUnmount]);

  const startDrag = useEventCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || dragRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
      sign: getDirection(event.currentTarget) === 'rtl' ? -1 : 1,
      latestX: event.clientX,
      latestEvent: null,
      lastWidth: width,
      frame: null,
    };
    setDragging(true);
  });

  const moveDrag = useEventCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.latestX = event.clientX;
    drag.latestEvent = event.nativeEvent;
    // One call per frame, with the last position.
    if (drag.frame === null) {
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = null;
        applyDrag();
      });
    }
  });

  const releaseDrag = useEventCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== dragRef.current?.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    endDrag(true);
  });

  const cancelDrag = useEventCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === dragRef.current?.pointerId) endDrag(false);
  });

  const loseCapture = useEventCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === dragRef.current?.pointerId) endDrag(false);
  });

  const handleDoubleClick = composeEventHandlers(
    onDoubleClick,
    (event: React.MouseEvent<HTMLDivElement>) => {
      onReset?.({ event: event.nativeEvent });
    },
  );

  const handleKey = useEventCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    const resizeTo = (next: number) => {
      if (next !== width) onResize(next, { event: event.nativeEvent });
    };
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    });
    if (intent) {
      const step = event.shiftKey ? SHIFT_KEY_STEP : KEY_STEP;
      resizeTo(clamp(Math.round(width + (intent === 'next' ? step : -step))));
    } else if (event.key === 'Home') {
      resizeTo(clamp(minWidth));
    } else if (event.key === 'End' && maxWidth !== undefined) {
      resizeTo(clamp(maxWidth));
    } else if (onLeave && event.key === 'Escape') {
      onLeave();
    } else if (onLeave && (event.key === 'Enter' || event.key === ' ')) {
      // Left on the release: focus moved now would hand the key's repeats (and Space's keyup,
      // which activates a button) to the element focus moves to. A repeat alone, of a key
      // pressed before focus came here, leaves nothing to release.
      if (!event.repeat) leaveKeyRef.current = event.key;
    } else {
      return;
    }
    // A handled key does not also move the grid.
    event.preventDefault();
    event.stopPropagation();
  });

  // Composed without the default-prevented check: the pressed key is forgotten at its release,
  // also when a consumer handled the release (then nothing else happens).
  const leaveOnRelease = useEventCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const pressed = leaveKeyRef.current !== null && event.key === leaveKeyRef.current;
    if (pressed) leaveKeyRef.current = null;
    if (!pressed || event.defaultPrevented || event.target !== event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    onLeave?.();
  });

  // A pressed Enter or Space is forgotten when focus leaves the handle before its release.
  const forgetPressedKey = useEventCallback(() => {
    leaveKeyRef.current = null;
  });

  // A DataGrid header cell's `resizeHandle` part (see TableResizeHandlePartProps), never a prop of
  // the public handle.
  const { slotPart: part, ...divProps } = rest as typeof rest &
    Pick<TableResizeHandlePartProps, 'slotPart'>;
  const classes = cn(
    tableResizeHandleClassNames.root,
    'absolute inset-y-0 end-0 z-1 w-2 cursor-col-resize touch-none select-none border-e-2 border-transparent',
    'hover:border-stroke-accessible focus-visible:border-primary data-[dragging]:border-primary',
    // The line is a border, so forced colors paint it only where it shows.
    'forced-colors:forced-color-adjust-none forced-colors:hover:border-[ButtonText] forced-colors:focus-visible:border-[Highlight] forced-colors:data-[dragging]:border-[Highlight]',
    focusRing,
    className,
  );
  // The handle's attributes, in their order, and the handlers that act on an event: with a part,
  // all of them are locked (a part's handler runs first and may cancel the action).
  const own: SlotPart<'div'> = {
    tabIndex: 0,
    'aria-label': label,
    'data-dragging': dragging ? '' : undefined,
    ...divProps,
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-valuenow': width,
    'aria-valuemin': minWidth,
    'aria-valuemax': maxWidth,
    'aria-valuetext': valueText ? valueText(width) : `${Math.round(width)} pixels`,
    'data-grid-auxiliary': '',
  };
  const actions = {
    onPointerDown: composeEventHandlers(onPointerDown, startDrag),
    onPointerMove: composeEventHandlers(onPointerMove, moveDrag),
    onDoubleClick: handleDoubleClick,
    onKeyDown: composeEventHandlers(onKeyDown, handleKey),
  };
  // The end of a drag and the forgotten key: they run whatever the handler before them does.
  const releasePointer = composeEventHandlers(onPointerUp, releaseDrag, ALWAYS);
  const cancelPointer = composeEventHandlers(onPointerCancel, cancelDrag, ALWAYS);
  const losePointer = composeEventHandlers(onLostPointerCapture, loseCapture, ALWAYS);
  const releaseKey = composeEventHandlers(onKeyUp, leaveOnRelease, ALWAYS);
  const blur = composeEventHandlers(onBlur, forgetPressedKey, ALWAYS);

  return (
    <div
      {...own}
      className={classes}
      {...actions}
      onPointerUp={releasePointer}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={losePointer}
      onKeyUp={releaseKey}
      onBlur={blur}
      {...(part && {
        ...mergeSlotProps(part, {
          className: classes,
          locked: { ...HANDLE_PART_LOCKS, ...own, ...actions },
        }),
        // After the part's handler whatever it does: the end of a drag, the forgotten key, and
        // the host's focus work (a DataGrid header cell measures its column).
        onPointerUp: composeEventHandlers(part.onPointerUp, releasePointer, ALWAYS),
        onPointerCancel: composeEventHandlers(part.onPointerCancel, cancelPointer, ALWAYS),
        onLostPointerCapture: composeEventHandlers(part.onLostPointerCapture, losePointer, ALWAYS),
        onKeyUp: composeEventHandlers(part.onKeyUp, releaseKey, ALWAYS),
        onBlur: composeEventHandlers(part.onBlur, blur, ALWAYS),
        onFocus: composeEventHandlers(part.onFocus, divProps.onFocus, ALWAYS),
      })}
      // After the part: the host merges the part's ref into this one.
      ref={ref}
    />
  );
};
TableResizeHandle.displayName = 'TableResizeHandle';

export { TableResizeHandle };
