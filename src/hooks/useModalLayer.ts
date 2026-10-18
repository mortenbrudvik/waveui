import type * as React from 'react';
import type { ModalType } from '../lib/types';
import { useDismiss, type DismissLayer, type UseDismissOptions } from './useDismiss';
import { useFocusTrap, useInitialFocus, type UseFocusTrapOptions } from './useFocusTrap';
import { useModalIsolation } from './useModalIsolation';
import { useRestoreFocus } from './useRestoreFocus';
import { useScrollLock } from './useScrollLock';

/**
 * Options of {@link useModalLayer}: `useDismiss` options (the kind follows `modalType`) plus focus.
 */
export interface UseModalLayerOptions extends Omit<UseDismissOptions, 'kind'> {
  /** The modal surface, held in state via a callback ref. */
  container: HTMLElement | null;
  /**
   * `modal` (default) and `alert` register a `modal` layer, trap focus, isolate the page, lock its
   * scroll and restore focus (an `alert` layer ignores outside presses); `non-modal` registers a
   * `dialog` layer (`escape: 'inside'`, no outside press, no focus-outside), traps, isolates and
   * locks nothing, moves focus in on open with the trap's initial-focus rule and restores focus only
   * from inside (`requireFocusInside`).
   * @default 'modal'
   */
  modalType?: ModalType;
  /** What the focus trap (or a non-modal surface's initial focus) focuses first. @default 'first' */
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
 *
 * `modalType: 'alert'` composes the same with `outsidePress: false`. `modalType: 'non-modal'`
 * registers a `dialog` layer (Escape only from inside its tree, no outside press, no focus-outside
 * dismissal), keeps the trap, the isolation and the scroll lock off, moves focus in on open with
 * the trap's initial-focus rule (`useInitialFocus`) and restores focus only when it is inside the
 * surface at close, or was lost to `<body>` from inside it. Every hook is always called and keys on
 * `open`: a `modalType` that changes while open applies at once (the trap, isolation and lock
 * follow) and moves no focus. The Tab order of a non-modal surface (its place after the opener) is
 * the component's.
 *
 * A surface that mounts through the presence core (Dialog, Drawer) passes its open state as
 * `open`, never its mount (`isMounted`), and its element as `container` also while it is mounted
 * closed: the layer, the trap, the isolation and the scroll lock end and focus is restored in the
 * commit that closes it, while the element still runs its exit motion (`inert`) or stays mounted
 * (`hidden`, with `unmountOnClose={false}`); the next open starts them again with the same
 * element.
 */
export function useModalLayer(options: UseModalLayerOptions): DismissLayer {
  const {
    container,
    modalType = 'modal',
    initialFocus,
    triggerRef,
    finalFocusRef,
    ...dismissOptions
  } = options;
  const { open } = options;
  const nonModal = modalType === 'non-modal';
  const modal = open && !nonModal;

  const layer = useDismiss(
    nonModal
      ? {
          ...dismissOptions,
          kind: 'dialog',
          escape: 'inside',
          outsidePress: false,
          focusOutside: false,
        }
      : {
          ...dismissOptions,
          kind: 'modal',
          ...(modalType === 'alert' && { outsidePress: false }),
        },
  );
  useFocusTrap(container, { enabled: modal, layerId: layer.layerId, initialFocus });
  useInitialFocus(container, { enabled: open && nonModal, layerId: layer.layerId, initialFocus });
  useModalIsolation(modal, { layerId: layer.layerId, container });
  useScrollLock(modal);
  useRestoreFocus({
    enabled: open,
    container,
    triggerRef,
    finalFocusRef,
    requireFocusInside: nonModal,
  });

  return layer;
}
