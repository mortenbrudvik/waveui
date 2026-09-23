import * as React from 'react';
import { mergeProps } from '../lib/mergeProps';
import { renderTrigger, STATE_ARIA, type TriggerChildren } from '../lib/renderTrigger';
import { warnOnce } from '../lib/dev';
import { useMergedRefs } from './useMergedRefs';
import { useEventCallback } from './useEventCallback';

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/**
 * Options of {@link useTriggerElement}. (`triggerProps.ref`, the hook's second argument, may be an
 * inline callback: it is re-attached after each commit; a stable ref is attached once.)
 */
export interface UseTriggerElementOptions {
  /** Public name used in development warnings, e.g. `'Dialog.Trigger'`. */
  componentName: string;
  /** `false` renders the 0.4 wrapper `<span>` around the children instead of cloning. @default true */
  asChild?: boolean;
  /**
   * Called (from an effect) with the id the trigger element ends up with: the child's own `id` when
   * it has one, otherwise `triggerProps.id`. Roots store it for `aria-labelledby`.
   */
  onResolvedId?: (id: string) => void;
}

type UnknownProps = Record<string, unknown>;

function isCloneableElement(node: unknown): node is React.ReactElement<UnknownProps> {
  return React.isValidElement(node) && node.type !== React.Fragment;
}

function isElementNode(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

/**
 * Renders a trigger (`Dialog.Trigger`, `Drawer.Trigger`, `Popover.Trigger`, `Menu.Trigger`,
 * `.Close`): puts `triggerProps` on the consumer's element.
 *
 * - **Single element child** (default): cloned with the trigger props merged in (F2 `mergeProps`):
 *   handlers composed (the child's run first; `preventDefault()` skips the trigger's), classes and
 *   styles merged, the child's own `id` kept, and live `aria-expanded` / `aria-controls` /
 *   `aria-haspopup` always winning over the child's values. The trigger ref and the child's own ref
 *   are merged with {@link useMergedRefs}, so a ref that keeps its identity is attached once and
 *   the element is not detached and re-attached on every render (stable positioning anchor and
 *   focus-restore target).
 * - **`triggerProps.ref`** does not have to be stable: an inline callback or a fresh `mergeRefs(…)`
 *   result is detached and re-attached after each commit (as React does for an inline ref), and a
 *   state-setting ref (`ref: setAnchor`) never loops. Pass a stable ref (an object ref, a
 *   `useCallback` or a state setter) so floating-ui's reference and restore targets are set once.
 * - **Render-prop child**: called with `triggerProps`.
 * - **`asChild={false}`**, text, Fragments or several children: the 0.4 wrapper `<span>` carrying
 *   the trigger props (F2 `renderTrigger`).
 * - **Automatic fallback**: when the cloned child has not attached its ref by the end of the mount
 *   layout effect (a custom component that neither forwards `ref` nor spreads props), the hook
 *   switches once to the wrapper span — whose click handler catches the bubbling click, so the
 *   trigger keeps working — and warns in development. A component that forwards `ref` but drops
 *   `onClick` cannot be detected.
 *
 * @param children      The trigger's children.
 * @param triggerProps  Props for the trigger element (`id`, state ARIA, handlers, `ref`; the ref may
 *   change between renders, a stable one is attached once).
 * @param options       See {@link UseTriggerElementOptions}.
 */
export function useTriggerElement<P>(
  children: TriggerChildren<P> | React.ReactNode,
  triggerProps: P,
  options: UseTriggerElementOptions,
): React.ReactNode {
  const { componentName, asChild = true, onResolvedId } = options;
  const [wrapperFallback, setWrapperFallback] = React.useState(false);

  const cloneable =
    asChild && !wrapperFallback && typeof children !== 'function' && isCloneableElement(children);
  const cloneTarget = cloneable ? (children as React.ReactElement<UnknownProps>) : null;
  const ourProps = triggerProps as UnknownProps;
  const ourRef = ourProps.ref as React.Ref<Element> | undefined;
  // The cloned child's own `ref` prop is read to merge it (React 19 keeps `ref` in props).
  const childRef = cloneTarget
    ? (cloneTarget.props.ref as React.Ref<Element> | undefined)
    : undefined;

  const attachedRef = React.useRef<Element | null>(null);
  const detectAttach = React.useCallback((node: Element | null) => {
    attachedRef.current = isElementNode(node) ? node : null;
  }, []);
  const mergedRef = useMergedRefs<Element>(ourRef, childRef, detectAttach);

  useIsomorphicLayoutEffect(() => {
    if (!cloneable || attachedRef.current) return;
    warnOnce(
      `trigger-ref:${componentName}`,
      `${componentName}: its child did not attach the trigger ref (a component that neither forwards \`ref\` nor spreads its props). It is rendered inside a <span> wrapper instead; forward \`ref\` and spread props onto the element, or pass asChild={false}.`,
    );
    // C-HOOKS site 2: the child never attached its ref after mount; switch to the wrapper span once.
    setWrapperFallback(true);
  }, [cloneable, componentName]);

  const ourId = typeof ourProps.id === 'string' ? ourProps.id : undefined;
  const childId =
    cloneTarget && typeof cloneTarget.props.id === 'string' ? cloneTarget.props.id : undefined;
  const resolvedId = childId ?? ourId;
  const reportId = useEventCallback(onResolvedId);
  React.useEffect(() => {
    if (resolvedId) reportId(resolvedId);
  }, [resolvedId, reportId]);

  if (cloneTarget) {
    const { ref: _theirRef, ...theirProps } = cloneTarget.props;
    const { ref: _ourRef, ...ourRest } = ourProps;
    const merged = mergeProps(ourRest, theirProps, { oursWin: STATE_ARIA });
    return React.cloneElement(cloneTarget, { ...merged, ref: mergedRef });
  }

  return renderTrigger(children, triggerProps, {
    componentName,
    asChild: asChild && !wrapperFallback,
  });
}
