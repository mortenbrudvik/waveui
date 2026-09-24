import * as React from 'react';
import { mergeProps } from '../lib/mergeProps';
import { renderTrigger, STATE_ARIA, type TriggerChildren } from '../lib/renderTrigger';
import { warnOnce } from '../lib/dev';
import { FOCUSABLE_SELECTOR } from '../lib/focus';
import { useMergedRefs } from './useMergedRefs';
import { useEventCallback } from './useEventCallback';

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

/** The element of a single-element Fragment (`<><Button /></>`); other children as given. */
function unwrapFragment(children: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(children) || children.type !== React.Fragment) return children;
  const inner = (children.props as { children?: React.ReactNode }).children;
  return React.isValidElement(inner) ? unwrapFragment(inner) : children;
}

function isElementNode(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

type StateAriaValues = Partial<Record<(typeof STATE_ARIA)[number], unknown>>;

/** The state ARIA keys present in `props` (a key given as `undefined` removes the attribute). */
function pickStateAria(props: UnknownProps): StateAriaValues {
  const values: StateAriaValues = {};
  for (const key of STATE_ARIA) {
    if (key in props) values[key] = props[key];
  }
  return values;
}

/**
 * The element that receives the state ARIA inside the fallback wrapper: its first element in the
 * tab order by markup (`tabIndex >= 0`). Not `getFirstTabbable`: that skips an `inert` subtree,
 * and the page around a trigger is inert while its modal dialog is open.
 */
function findStateAriaTarget(wrapper: Element): Element | null {
  for (const el of wrapper.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    const hiddenInput = el.localName === 'input' && (el as HTMLInputElement).type === 'hidden';
    if (!hiddenInput && el.tabIndex >= 0) return el;
  }
  return null;
}

/** Writes `values` onto `target` and returns a cleanup that restores its own attributes. */
function moveStateAria(target: Element, values: StateAriaValues): () => void {
  const previous = Object.keys(values).map((key) => [key, target.getAttribute(key)] as const);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) target.removeAttribute(key);
    else target.setAttribute(key, String(value));
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === null) target.removeAttribute(key);
      else target.setAttribute(key, value);
    }
  };
}

/**
 * Renders a trigger (`Dialog.Trigger`, `Drawer.Trigger`, `Popover.Trigger`, `Menu.Trigger`,
 * `.Close`): puts `triggerProps` on the consumer's element.
 *
 * - **Single element child** (default): cloned with the trigger props merged in (`mergeProps`):
 *   handlers composed (the child's run first; `preventDefault()` skips the trigger's), classes and
 *   styles merged, the child's own `id` kept, and live `aria-expanded` / `aria-controls` /
 *   `aria-haspopup` always winning over the child's values. The trigger ref and the child's own ref
 *   are merged with {@link useMergedRefs}, so a ref that keeps its identity is attached once and
 *   the element is not detached and re-attached on every render (stable positioning anchor and
 *   focus-restore target). A Fragment around a single element (`<><Button /></>`) is unwrapped and
 *   its element cloned.
 * - **`triggerProps.ref`** does not have to be stable: an inline callback or a fresh `mergeRefs(…)`
 *   result is detached and re-attached after each commit (as React does for an inline ref), and a
 *   state-setting ref (`ref: setAnchor`) never loops. Pass a stable ref (an object ref, a
 *   `useCallback` or a state setter) so floating-ui's reference and restore targets are set once.
 * - **Render-prop child**: called with `triggerProps`.
 * - **`asChild={false}`**: the 0.4 wrapper `<span>` carrying the trigger props (`renderTrigger`).
 * - **Text, a Fragment of several elements, several children**: a wrapper `<span>` (with a
 *   development warning from `renderTrigger`) carrying the trigger props except the state ARIA,
 *   which moves as in the automatic fallback below.
 * - **Automatic fallback**: when the cloned child has not attached its ref by the end of the mount
 *   layout effect (a custom component that neither forwards `ref` nor spreads props), the hook
 *   switches once to the wrapper span — whose click handler catches the bubbling click, so the
 *   trigger keeps working — and warns in development. The span keeps the other trigger props (`id`,
 *   handlers, ref), but the state ARIA (`aria-haspopup`, `aria-expanded`, `aria-controls`), which
 *   a generic span cannot carry, moves after each commit onto the first element inside it in the
 *   tab order (the child's own values restored when it stops being that element), or is dropped
 *   when there is none. A component that forwards `ref` but drops `onClick` cannot be detected.
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

  const isRenderProp = typeof children === 'function';
  // A Fragment around one element is that element (children of a conditional expression).
  const content = isRenderProp ? null : unwrapFragment(children as React.ReactNode);
  const singleElement = isCloneableElement(content);
  const cloneable = asChild && !wrapperFallback && singleElement;
  const cloneTarget = cloneable ? (content as React.ReactElement<UnknownProps>) : null;
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

  React.useLayoutEffect(() => {
    if (!cloneable || attachedRef.current) return;
    warnOnce(
      `trigger-ref:${componentName}`,
      `${componentName}: its child did not attach the trigger ref (a component that neither forwards \`ref\` nor spreads its props). It is rendered inside a <span> wrapper instead; forward \`ref\` and spread props onto the element, or pass asChild={false}.`,
    );
    // C-HOOKS site 2: the child never attached its ref after mount; switch to the wrapper span once.
    setWrapperFallback(true);
  }, [cloneable, componentName]);

  // A wrapper span the consumer did not ask for (`asChild` is not false): the automatic fallback of
  // a single element child, or children that cannot be cloned (text, several elements). The
  // trigger is the element inside, so the state ARIA, which a generic span cannot carry, goes to
  // the first element it rendered in the tab order.
  const autoWrapper = asChild && wrapperFallback && singleElement;
  const implicitWrapper = asChild && !isRenderProp && !cloneable;
  const movedAria = implicitWrapper ? pickStateAria(ourProps) : null;
  // No deps: runs after every commit of the trigger (which re-renders on every state change), so
  // the attributes follow the live state and the child's current first tabbable element. A new
  // target rendered by the child without a trigger commit is picked up at the next one.
  React.useLayoutEffect(() => {
    const wrapper = attachedRef.current;
    if (!movedAria || !wrapper) return undefined;
    const target = findStateAriaTarget(wrapper);
    return target ? moveStateAria(target, movedAria) : undefined;
  });

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

  if (implicitWrapper) {
    const { ref: _ourRef, ...ourRest } = ourProps;
    const wrapperProps: UnknownProps = { ...ourRest, ref: mergedRef };
    for (const key of STATE_ARIA) delete wrapperProps[key];
    // `asChild` lets renderTrigger warn about children it cannot clone; the automatic fallback
    // (a single element, never cloned again) warned above.
    return renderTrigger(content, wrapperProps, { componentName, asChild: !autoWrapper });
  }

  // A render-prop child, or the explicit 0.4 wrapper span (`asChild={false}`).
  return renderTrigger(children, triggerProps, { componentName, asChild: false });
}
