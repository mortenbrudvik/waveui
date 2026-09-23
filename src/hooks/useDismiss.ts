import * as React from 'react';
import { useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useId } from './useId';
import {
  getTopmostLayer,
  registerLayer,
  type DismissReason,
  type LayerKind,
  type LayerRecord,
} from '../lib/layers';

export type { DismissReason } from '../lib/layers';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/** Options of {@link useDismiss}. */
export interface UseDismissOptions {
  /** Whether the layer is open; the layer is registered only while `true`. */
  open: boolean;
  /** Called when the layer should close (the component sets its `open` state to `false`). */
  onDismiss: (reason: DismissReason, event: Event) => void;
  /**
   * Elements that belong to the layer: the content surface, the trigger/anchor and any extra
   * targets that must not count as "outside" (read at event time).
   */
  refs: ReadonlyArray<React.RefObject<HTMLElement | null>>;
  /** The trigger; focus traps leave a descendant layer through it (Tab → the element after it). */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** @default 'popover' */
  kind?: LayerKind;
  /** Whether Escape dismisses the layer. @default true */
  escape?: boolean;
  /**
   * Whether a press outside the layer's tree dismisses it. A predicate receives the `pointerdown`
   * event; returning `false` ignores that press. @default true
   */
  outsidePress?: boolean | ((event: PointerEvent | MouseEvent) => boolean);
  /** Whether focus moving outside the layer's tree dismisses it (listboxes). @default false */
  focusOutside?: boolean;
}

/** Returned by {@link useDismiss}. */
export interface DismissLayer {
  /** The layer's id: pass it to `Portal layerId` or `DismissLayerProvider` around the surface. */
  layerId: string;
  /** Whether the layer is currently the topmost open layer (read at call time). */
  isTopmost(): boolean;
}

/**
 * The id of the enclosing dismiss layer. React context survives portals, so a popover opened from
 * inside a dialog knows the dialog is its parent layer. `null` outside any layer.
 */
export const DismissLayerContext: React.Context<string | null> = React.createContext<string | null>(
  null,
);
DismissLayerContext.displayName = 'DismissLayerContext';

/**
 * Makes `layerId` the parent layer of everything rendered inside (`Portal layerId` does this for
 * its children automatically).
 */
export function DismissLayerProvider(props: {
  layerId: string;
  children: React.ReactNode;
}): React.ReactElement {
  return React.createElement(
    DismissLayerContext.Provider,
    { value: props.layerId },
    props.children,
  );
}

/**
 * Registers an open overlay surface as a **dismiss layer** in the shared layer stack and closes it
 * on Escape, outside presses and (optionally) focus leaving it — with correct nesting:
 *
 * - **Escape** (document `keydown`, bubble phase) is routed by focus location: the innermost layer
 *   whose tree contains the event target or the focused element is the scope, and the topmost
 *   escape-enabled layer of that scope's subtree handles it — so a tooltip or popover opened from
 *   the focused dialog closes before the dialog, while an unrelated layer opened later does not
 *   steal the key. With no escape-enabled layer there, an escape-enabled ancestor handles it; when
 *   no layer contains the focus (or none of those takes Escape), the global topmost
 *   escape-enabled one. Layers stacked below the topmost **isolating** modal (a Dialog/Drawer
 *   whose `useModalIsolation` is active — its ancestors and older siblings) never take Escape, so
 *   a modal that ignores Escape blocks it whether it is nested in a dialog or opened beside it.
 *   The handler calls `preventDefault()`. Events whose default is already prevented (an inner
 *   widget consumed Escape) and IME composition events are ignored.
 * - **Outside press**: on `pointerdown` (capture) every open layer whose tree does not contain the
 *   target is recorded; on the following `click` each recorded layer whose tree still does not
 *   contain the click target is dismissed (children first). A drag from inside to outside never
 *   dismisses, clicks inside nested portaled layers count as inside, a popup opened by the same
 *   click survives, and an external toggle works. Layers stacked below the topmost isolating modal
 *   are inert and never dismissed by presses on that modal or its backdrop; a `kind: 'modal'`
 *   layer without isolation (the DatePicker calendar) shields nothing, so a page click closes it
 *   and the layers around it. The pending press survives modifier keys (Shift/Ctrl+click) and
 *   ends on Enter/Space, on `pointercancel`, or when no click follows a mouse `pointerup` in the
 *   same task; touch and pen presses are kept until their click, which the browser dispatches
 *   from a separate tap gesture.
 * - **Focus outside** (`focusOutside: true`): dismisses when focus moves outside the layer's tree.
 *
 * A layer's tree is its `refs`, the portal wrappers rendered inside it, its descendant layers and
 * the `[data-wave-focus-trap-allow]` regions (toasts). Parentage comes from
 * {@link DismissLayerContext}: wrap the surface in `Portal layerId={layerId}` (or
 * {@link DismissLayerProvider}) so layers opened inside it become its children.
 *
 * @example
 * const { layerId } = useDismiss({ open, onDismiss: () => setOpen(false), refs: [surfaceRef, triggerRef], anchorRef: triggerRef });
 * return open && <Portal layerId={layerId}><div ref={surfaceRef}>…</div></Portal>;
 */
export function useDismiss(options: UseDismissOptions): DismissLayer {
  const layerId = useId('wave-layer');
  const parentId = React.useContext(DismissLayerContext);
  const latestRef = useRef({ options, parentId });

  // Current before any layout effect or event handler of this commit reads it.
  useInsertionEffect(() => {
    latestRef.current = { options, parentId };
  });

  const { open } = options;

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const latest = latestRef;
    const record: LayerRecord = {
      id: layerId,
      get parentId() {
        return latest.current.parentId;
      },
      get kind() {
        return latest.current.options.kind ?? 'popover';
      },
      order: 0,
      getElements: () => latest.current.options.refs.map((ref) => ref.current),
      getAnchor: () => latest.current.options.anchorRef?.current ?? null,
      get escape() {
        return latest.current.options.escape ?? true;
      },
      get outsidePress() {
        return latest.current.options.outsidePress ?? true;
      },
      get focusOutside() {
        return latest.current.options.focusOutside ?? false;
      },
      onDismiss: (reason, event) => latest.current.options.onDismiss(reason, event),
    };
    return registerLayer(record);
  }, [open, layerId]);

  return useMemo(
    () => ({
      layerId,
      isTopmost: () => getTopmostLayer()?.id === layerId,
    }),
    [layerId],
  );
}
