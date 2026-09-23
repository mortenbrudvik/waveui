import type * as React from 'react';
import { useDismiss, type DismissLayer, type UseDismissOptions } from './useDismiss';
import { useFocusTrap, type UseFocusTrapOptions } from './useFocusTrap';
import { useModalIsolation } from './useModalIsolation';
import { useRestoreFocus } from './useRestoreFocus';
import { useScrollLock } from './useScrollLock';

/** Options of {@link useModalLayer}: `useDismiss` options (kind is always `'modal'`) plus focus. */
export interface UseModalLayerOptions extends Omit<UseDismissOptions, 'kind'> {
  /** The modal surface, held in state via a callback ref. */
  container: HTMLElement | null;
  /** What the focus trap focuses first. @default 'first' */
  initialFocus?: UseFocusTrapOptions['initialFocus'];
  /** The trigger: preferred focus-restore target. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Consumer override for the focus-restore target. */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Everything a modal surface (Dialog, Drawer) needs, composed in the order that works:
 *
 * 1. `useDismiss({ kind: 'modal' })` — Escape and outside presses (the backdrop is outside the
 *    content surface, so a click on it dismisses; a drag from the content does not).
 * 2. `useFocusTrap` — initial focus, Tab cycle incl. toasts and descendant layers.
 * 3. `useModalIsolation` — the rest of the page is `inert` (instead of `aria-modal`).
 * 4. `useScrollLock` — ref-counted page scroll lock.
 * 5. `useRestoreFocus` — the opener (or `triggerRef`/`finalFocusRef`) gets focus back.
 *
 * On close the trap is released before the isolation is lifted, and the isolation is lifted
 * before focus is restored (an inert opener cannot take focus). Wrap the surface in
 * `Portal layerId={layerId}` so layers opened inside the modal become its descendants.
 */
export function useModalLayer(options: UseModalLayerOptions): DismissLayer {
  const { container, initialFocus, triggerRef, finalFocusRef, ...dismissOptions } = options;
  const { open } = options;

  const layer = useDismiss({ ...dismissOptions, kind: 'modal' });
  useFocusTrap(container, { enabled: open, layerId: layer.layerId, initialFocus });
  useModalIsolation(open, { layerId: layer.layerId, container });
  useScrollLock(open);
  useRestoreFocus({ enabled: open, container, triggerRef, finalFocusRef });

  return layer;
}
