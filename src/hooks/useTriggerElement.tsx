import * as React from 'react';
import { mergeProps } from '../lib/mergeProps';
import {
  isCloneableElement,
  renderTrigger,
  STATE_ARIA,
  unwrapFragment,
  type TriggerChildren,
} from '../lib/renderTrigger';
import { warnOnce } from '../lib/dev';
import { FOCUSABLE_SELECTOR, getFirstTabbable, isFocusable, isHiddenInput } from '../lib/focus';
import { useMergedRefs } from './useMergedRefs';
import { useEventCallback } from './useEventCallback';

/**
 * Options of {@link useTriggerElement}. (`triggerProps.ref`, the hook's second argument, may be an
 * inline callback: it is re-attached after each commit; a stable ref is attached once.)
 */
export interface UseTriggerElementOptions {
  /** Public name used in development warnings, e.g. `'Dialog.Trigger'`. */
  componentName: string;
  /**
   * `false` renders the 0.4 wrapper `<span>` around the children instead of cloning; the state
   * ARIA moves onto the element inside it, as for the automatic fallback. @default true
   */
  asChild?: boolean;
  /**
   * Called (from an effect) with the id the trigger element ends up with: the child's own `id` when
   * it has one, otherwise `triggerProps.id`. Roots store it for `aria-labelledby`.
   */
  onResolvedId?: (id: string) => void;
}

type UnknownProps = Record<string, unknown>;

/** Roles that make an element no widget of its own. */
const GENERIC_ROLES: ReadonlySet<string> = new Set(['generic', 'none', 'presentation']);

/** Whether a `role` value (attribute or prop) names a role other than a generic one. */
function isNonGenericRole(role: unknown): boolean {
  if (typeof role !== 'string') return false;
  const first = role.trim().split(/\s+/)[0];
  return first !== '' && !GENERIC_ROLES.has(first);
}

/** Whether a `tabIndex` prop puts its element in the tab order. */
function isInTabOrder(tabIndex: unknown): boolean {
  if (typeof tabIndex === 'number') return tabIndex >= 0;
  return typeof tabIndex === 'string' && tabIndex.trim() !== '' && Number(tabIndex) >= 0;
}

/**
 * The element that acts as the trigger rendered as `el` (a cloned child, or the wrapper `<span>`
 * of `asChild={false}`, of text children and of the automatic fallback): `el` itself when it is
 * interactive — in the tab order by markup (`tabIndex >= 0`: a button, or a span the consumer
 * gave `tabIndex={0}`) or given a role other than a generic one (`role="button"`) — else the
 * first element inside it in the tab order by markup, else `null`. The trigger's state ARIA
 * belongs on it, and focus returns to it ({@link getTriggerFocusTarget}). Read from the markup, not
 * `getFirstTabbable`: that skips an `inert` subtree, and the page around a trigger is inert while
 * its modal dialog is open. Internal (not exported from the package entry).
 */
export function getTriggerTarget(el: HTMLElement): HTMLElement | null {
  if (el.tabIndex >= 0 || isNonGenericRole(el.getAttribute('role'))) return el;
  for (const candidate of el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (!isHiddenInput(candidate) && candidate.tabIndex >= 0) return candidate;
  }
  return null;
}

/**
 * The element that takes focus for the trigger rendered as `trigger`: the one rule of every focus
 * return of Menu, Popover, Dialog and Drawer (Escape, outside press, item activation, Tab and
 * Shift+Tab, the Close part). It is the {@link getTriggerTarget} element, which carries the state
 * ARIA, when that can take focus now, so a `tabIndex={-1}` wrapper span gives way to the button
 * inside it; else the first tabbable element inside `trigger` (a span given only a `role`); else
 * `trigger` itself when it can take focus (a `<button tabIndex={-1}>` child, a `tabIndex={-1}`
 * span holding only text); else `null`. Internal (not exported from the package entry).
 */
export function getTriggerFocusTarget(trigger: HTMLElement | null): HTMLElement | null {
  if (!trigger) return null;
  const target = getTriggerTarget(trigger);
  if (target && isFocusable(target)) return target;
  return getFirstTabbable(trigger) ?? (isFocusable(trigger) ? trigger : null);
}

/**
 * A read-only ref for `useRestoreFocus`'s `triggerRef` and `useDismiss`'s `anchorRef` (Menu,
 * Popover; the anchor is where a surface opened from the popup restores focus once its opener is
 * gone): resolved when it is read, to {@link getTriggerFocusTarget} of the element in
 * `triggerRef`, or to that element itself when nothing in it can take focus (the restore then goes
 * to the element next to where it is, as for any opener that cannot take focus). Stable while
 * `triggerRef` is.
 */
export function useTriggerFocusRef(
  triggerRef: React.RefObject<HTMLElement | null>,
): React.RefObject<HTMLElement | null> {
  return React.useMemo(() => createTriggerFocusRef(triggerRef), [triggerRef]);
}

function createTriggerFocusRef(
  triggerRef: React.RefObject<HTMLElement | null>,
): React.RefObject<HTMLElement | null> {
  return {
    get current() {
      const trigger = triggerRef.current;
      return trigger && (getTriggerFocusTarget(trigger) ?? trigger);
    },
  };
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
 * - **Render-prop child**: called with `triggerProps` (all of them, whatever `asChild` says).
 * - **`asChild={false}`**: the 0.4 wrapper `<span>` carrying the trigger props except the state
 *   ARIA, which moves as in the automatic fallback below (so a button inside is announced as
 *   opening the popup).
 * - **Text, a Fragment of several elements, several children**: a wrapper `<span>` (with a
 *   development warning from `renderTrigger`) carrying the trigger props except the state ARIA,
 *   which moves as in the automatic fallback below.
 * - **A wrapper span the consumer made the trigger** (`tabIndex={0}` or a `role` such as
 *   `"button"` passed to the trigger, e.g. `<Menu.Trigger asChild={false} role="button"
 *   tabIndex={0}>Actions</Menu.Trigger>`): the span keeps the state ARIA, as the element that
 *   takes focus and is announced ({@link getTriggerTarget}).
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

  // A wrapper span: the explicit one of `asChild={false}`, the automatic fallback of a single
  // element child, or children that cannot be cloned (text, several elements). The trigger is the
  // element inside, so the state ARIA, which a generic span cannot carry, goes to the first element
  // it rendered in the tab order — unless the consumer made the span itself the trigger
  // (`tabIndex`, `role`, see getTriggerTarget): then the span keeps it.
  const autoWrapper = asChild && wrapperFallback && singleElement;
  const wrapper = !isRenderProp && !cloneable;
  const wrapperIsTrigger =
    wrapper && (isInTabOrder(ourProps.tabIndex) || isNonGenericRole(ourProps.role));
  const movedAria = wrapper && !wrapperIsTrigger ? pickStateAria(ourProps) : null;
  // No deps: runs after every commit of the trigger (which re-renders on every state change), so
  // the attributes follow the live state and the child's current first tabbable element. A new
  // target rendered by the child without a trigger commit is picked up at the next one.
  React.useLayoutEffect(() => {
    const span = attachedRef.current;
    if (!movedAria || !span) return undefined;
    const target = getTriggerTarget(span as HTMLElement);
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

  if (wrapper) {
    const { ref: _ourRef, ...ourRest } = ourProps;
    const wrapperProps: UnknownProps = { ...ourRest, ref: mergedRef };
    if (!wrapperIsTrigger) for (const key of STATE_ARIA) delete wrapperProps[key];
    // The explicit 0.4 span renders the children as given. Otherwise `asChild` lets renderTrigger
    // warn about children it cannot clone; the automatic fallback (a single element, never cloned
    // again) warned above.
    return asChild
      ? renderTrigger(content, wrapperProps, { componentName, asChild: !autoWrapper })
      : renderTrigger(children, wrapperProps, { componentName, asChild: false });
  }

  // A render-prop child.
  return renderTrigger(children, triggerProps, { componentName, asChild: false });
}
