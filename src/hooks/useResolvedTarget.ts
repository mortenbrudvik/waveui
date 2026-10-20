import * as React from 'react';
import type { PopupPositioning, PopupTarget, PopupTargetInput } from '../lib/types';
import { warnOnce } from '../lib/dev';

/** Whether a `target` is a ref object rather than an element or a `VirtualElement`. */
export function isTargetRef(
  target: PopupTargetInput | undefined,
): target is { readonly current: HTMLElement | null } {
  return target != null && typeof target === 'object' && 'current' in target;
}

/**
 * Internal. Turns a popup's `target` prop into a {@link PopupTarget}: an element or a
 * `VirtualElement` is returned as it is, a ref object becomes the element it holds. A ref cannot be
 * observed, so it is read once more after each commit of the popup (deferred, C-HOOKS): until then
 * the previous element is kept, and an element that attaches or detaches without the popup
 * rendering is noticed the next time the popup renders.
 */
export function useResolvedTarget(target: PopupTargetInput | undefined): PopupTarget | undefined {
  const [refElement, setRefElement] = React.useState<HTMLElement | null>(null);
  const ref = isTargetRef(target) ? target : null;
  React.useLayoutEffect(() => {
    if (!ref) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setRefElement(ref.current);
    });
    return () => {
      cancelled = true;
    };
  });
  if (isTargetRef(target)) return refElement;
  return target;
}

/**
 * Internal. Warns once (from an effect) when both `target` and `positioning.target` are set; the
 * component uses `target`.
 */
export function useTargetConflictWarning(
  component: string,
  target: PopupTargetInput | undefined,
  positioningTarget: PopupTargetInput | undefined,
): void {
  const conflict = target != null && positioningTarget != null;
  React.useEffect(() => {
    if (conflict) {
      warnOnce(
        `${component}:positioning-target`,
        `${component}: both target and positioning.target are set; target is used.`,
      );
    }
  }, [component, conflict]);
}

/**
 * Internal. The `target` of a popup that also takes `positioning`: the `target` prop, else
 * `positioning.target`, resolved by {@link useResolvedTarget}.
 */
export function usePopupTarget(
  component: string,
  target: PopupTargetInput | undefined,
  positioning: PopupPositioning | undefined,
): PopupTarget | undefined {
  useTargetConflictWarning(component, target, positioning?.target);
  return useResolvedTarget(target !== undefined ? target : positioning?.target);
}
