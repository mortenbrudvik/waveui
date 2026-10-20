import { useSyncExternalStore } from 'react';
import { hasOpenModal, subscribeLayers } from '../lib/layers';

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether a modal surface is open (a Dialog, an overlay Drawer, an alert, the DatePicker's calendar, or your
 * own `useDismiss({ kind: 'modal' })` layer): `true` from the
 * commit that opens it to the commit that closes it, not until its exit motion ends. A non-modal
 * Dialog or Drawer, a Popover or a Menu is no modal. `false` on the server and during hydration.
 *
 * Use it to hold back app behavior the modal should own, such as global keyboard shortcuts, instead
 * of guessing from the page's `inert` attributes.
 *
 * @example
 * const modalOpen = useModalOpen();
 * useEffect(() => {
 *   if (modalOpen) return;
 *   const onKey = (event: KeyboardEvent) => { if (event.key === '/') focusSearch(); };
 *   document.addEventListener('keydown', onKey);
 *   return () => document.removeEventListener('keydown', onKey);
 * }, [modalOpen]);
 */
export function useModalOpen(): boolean {
  return useSyncExternalStore(subscribeLayers, hasOpenModal, getServerSnapshot);
}
