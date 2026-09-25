import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { resolveDeprecatedProp, warnOnce } from '../../lib/dev';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { FOCUSABLE_SELECTOR, getFirstTabbable } from '../../lib/focus';
import {
  isCloneableElement,
  renderTrigger,
  STATE_ARIA,
  unwrapFragment,
} from '../../lib/renderTrigger';
import type { PopupAlign, PopupSide } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useDismiss } from '../../hooks/useDismiss';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useEventCallback } from '../../hooks/useEventCallback';
import { Portal } from '../portal/Portal';

/** Color treatment of a tooltip (`TooltipProps.appearance`). */
export type TooltipAppearance = 'inverted' | 'normal';

/** Properties for the Tooltip component. */
export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  /** Content to display inside the tooltip (short, non-interactive text). */
  content: React.ReactNode;
  /**
   * Color treatment: `inverted` (dark surface in the light theme) or `normal` (the page
   * background with a border).
   * @default 'inverted'
   */
  appearance?: TooltipAppearance;
  /**
   * @deprecated Use `appearance` (`'dark'` → `'inverted'`, `'light'` → `'normal'`).
   */
  variant?: 'dark' | 'light';
  /** Delay in milliseconds before the tooltip appears on hover or focus.
   * @default 200
   */
  delay?: number;
  /**
   * How the tooltip relates to its child: `description` adds it to the child's
   * `aria-describedby`; `label` adds it to the child's `aria-labelledby`, naming an icon-only
   * button.
   * @default 'description'
   */
  relationship?: 'description' | 'label';
  /**
   * Side of the target the tooltip opens on. `start`/`end` follow the writing direction; the
   * tooltip flips to the opposite side when there is not enough room.
   * @default 'top'
   */
  side?: PopupSide;
  /** Alignment along the target's edge.
   * @default 'center'
   */
  align?: PopupAlign;
  /**
   * A single element that triggers the tooltip on hover and focus: it receives the
   * `aria-describedby`/`aria-labelledby`, plus any `id` and `aria-*` props given to the Tooltip
   * (a Fragment around one element counts as that element). Other children are wrapped in a
   * described `<span>` with a development warning, and their first focusable element gets the
   * relationship.
   */
  children: React.ReactElement;
  /** Ref to the wrapper `<span>` (the positioning anchor). */
  ref?: React.Ref<HTMLSpanElement>;
}

const VARIANT_APPEARANCE: Record<'dark' | 'light', TooltipAppearance> = {
  dark: 'inverted',
  light: 'normal',
};

const appearanceClasses: Record<TooltipAppearance, string> = {
  inverted: 'border border-inverted-border bg-inverted text-inverted-foreground',
  normal: 'border border-border bg-background text-foreground',
};

/**
 * Transparent `::before` hover bridge across the 8px gap (the positioning offset) on the side that
 * faces the trigger only, so the pointer can move onto the tooltip; the other sides get no bridge,
 * which would otherwise catch hovers and clicks meant for neighbouring controls.
 */
const bridgeClasses = [
  'before:absolute',
  // Tooltip above the trigger: a strip below it.
  'data-[side=top]:before:inset-x-0 data-[side=top]:before:top-full data-[side=top]:before:h-2',
  // Tooltip below the trigger: a strip above it.
  'data-[side=bottom]:before:inset-x-0 data-[side=bottom]:before:bottom-full data-[side=bottom]:before:h-2',
  // wave-allow-physical: data-side is the physical side resolved by the positioning
  'data-[side=left]:before:inset-y-0 data-[side=left]:before:left-full data-[side=left]:before:w-2',
  // wave-allow-physical: data-side is the physical side resolved by the positioning
  'data-[side=right]:before:inset-y-0 data-[side=right]:before:right-full data-[side=right]:before:w-2',
].join(' ');

/**
 * The visual surface: wrapping text, typography reset against the host (header cells, muted
 * panels), and the hover bridge towards the trigger.
 */
const surfaceClasses = `max-w-60 whitespace-normal break-words rounded px-3 py-1.5 text-caption-1 font-normal normal-case tracking-normal text-start shadow-8 ${bridgeClasses}`;

/** Grace period before hiding after the pointer leaves, so it can move onto the tooltip. */
const HIDE_DELAY_MS = 100;

type UnknownProps = Record<string, unknown>;
type Relationship = NonNullable<TooltipProps['relationship']>;

const HANDLER_KEY = /^on[A-Z]/;

/** Naming attributes a generic element such as the fallback `<span>` must not carry. */
const NAMING_ARIA = ['aria-label', 'aria-labelledby'] as const;

/**
 * Whether an event reached the wrapper from its own DOM subtree — the child — rather than through
 * a portal: React bubbles events from portaled content (the tooltip surface, a popup the child
 * renders in a portal) through the component tree.
 */
function isOwnEvent(event: React.SyntheticEvent): boolean {
  return (event.currentTarget as Node).contains(event.target as Node);
}

/** `handler`, called only for the wrapper's own events (see {@link isOwnEvent}). */
function ownEventsOnly<E extends React.SyntheticEvent>(
  handler: (event: E) => void,
): (event: E) => void {
  return (event) => {
    if (isOwnEvent(event)) handler(event);
  };
}

/**
 * Splits the props the Tooltip receives, from its consumer or from a parent that clones its child
 * (Menu.Trigger, Popover.Trigger, Dialog.Trigger, Field): `id` and `aria-*` describe the element
 * the Tooltip is attached to, so they go to the child; the rest stays on the wrapper `<span>`.
 */
function splitProps(props: UnknownProps): { childProps: UnknownProps; wrapperProps: UnknownProps } {
  const childProps: UnknownProps = {};
  const wrapperProps: UnknownProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'id' || key.startsWith('aria-')) childProps[key] = value;
    else if (HANDLER_KEY.test(key) && typeof value === 'function') {
      // The wrapper sees the child's events as they bubble, but not those that reach it through
      // a portal, such as a click on the tooltip surface (it would toggle a parent trigger).
      wrapperProps[key] = ownEventsOnly(value as (event: React.SyntheticEvent) => void);
    } else wrapperProps[key] = value;
  }
  return { childProps, wrapperProps };
}

function omit(props: UnknownProps, keys: readonly string[]): UnknownProps {
  const result = { ...props };
  for (const key of keys) delete result[key];
  return result;
}

function hasIdRef(el: Element, attribute: string, id: string): boolean {
  return (el.getAttribute(attribute) ?? '').split(/\s+/).includes(id);
}

function removeIdRef(el: Element, attribute: string, id: string): void {
  const rest = (el.getAttribute(attribute) ?? '')
    .split(/\s+/)
    .filter((value) => value && value !== id);
  if (rest.length > 0) el.setAttribute(attribute, rest.join(' '));
  else el.removeAttribute(attribute);
}

/**
 * Makes sure the element people focus carries the tooltip relationship. After each commit, when no
 * focusable element inside the wrapper references `tooltipId` through `attribute` — children in the
 * fallback span, a non-focusable child element, or a child component that drops the prop (a
 * Popover or Dialog root) — the id is added to the first tabbable element inside the wrapper and
 * kept there while the subtree changes; a development warning explains the nesting, except for
 * the fallback span, whose children shape `renderTrigger` already warned about.
 */
function useRelationshipTarget(
  wrapperRef: React.RefObject<HTMLSpanElement | null>,
  tooltipId: string,
  relationship: Relationship,
  childIsFallback: boolean,
): void {
  const appliedRef = React.useRef<{ element: Element; attribute: string } | null>(null);
  const attribute = relationship === 'label' ? 'aria-labelledby' : 'aria-describedby';

  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const update = () => {
      const applied = appliedRef.current;
      const carriers = Array.from(wrapper.querySelectorAll(`[${attribute}]`)).filter(
        (el) =>
          !(applied && applied.element === el && applied.attribute === attribute) &&
          hasIdRef(el, attribute, tooltipId),
      );
      const reached = carriers.some((el) => el.matches(FOCUSABLE_SELECTOR));
      const target = reached ? null : getFirstTabbable(wrapper);
      if (applied && (applied.element !== target || applied.attribute !== attribute)) {
        removeIdRef(applied.element, applied.attribute, tooltipId);
        appliedRef.current = null;
      }
      if (!target) return;
      if (!hasIdRef(target, attribute, tooltipId)) {
        target.setAttribute(attribute, joinIds(target.getAttribute(attribute), tooltipId) ?? '');
      }
      appliedRef.current = { element: target, attribute };
      if (!childIsFallback) {
        warnOnce(
          'Tooltip:focus-target',
          `Tooltip: the element that takes focus inside it did not get \`${attribute}\` (the child is not focusable, or is a component, such as a Popover or Dialog root, that does not pass the prop on), so it was added to the first focusable element inside. Put the Tooltip directly around the focusable element, e.g. <Popover.Trigger><Tooltip content="…"><Button /></Tooltip></Popover.Trigger>.`,
        );
      }
    };

    update();
    if (!appliedRef.current || typeof MutationObserver === 'undefined') return;
    // Keep it on the focusable element when the child replaces it or rewrites the attribute
    // without the Tooltip re-rendering.
    const observer = new MutationObserver(update);
    observer.observe(wrapper, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [attribute],
    });
    return () => observer.disconnect();
  });
}

/**
 * Shows a short text label or description for its child on hover and keyboard focus.
 *
 * - The text is always present as a hidden `role="tooltip"` element referenced by the child's
 *   `aria-describedby` (or `aria-labelledby` with `relationship="label"`), so screen readers get
 *   it on focus without waiting for the delay; the child's own ids are kept.
 * - The visual surface is rendered in a portal only while visible (it is `aria-hidden`, a copy of
 *   the description), positioned on `side`/`align` with flipping and shifting to stay in view.
 * - It stays visible while the pointer moves onto it, hides shortly after the pointer leaves or
 *   immediately on blur, and Escape hides it without closing an enclosing dialog or popover. Focus
 *   and hover inside a popup the child renders in a portal (a DatePicker calendar, a listbox) do
 *   not show it, and the pointer moving onto such a popup hides it.
 * - `id` and `aria-*` props given to the Tooltip go to its child, merged with the child's own (the
 *   child's `id` wins, id lists are joined, `aria-expanded`/`aria-controls`/`aria-haspopup` from
 *   the Tooltip win). `className`, `style`, `ref`, `data-*` and event handlers stay on the wrapper
 *   `<span>`; the handlers see the child's events as they bubble, not events from portaled
 *   content such as the tooltip surface or a popup the child renders in a portal (a DatePicker
 *   calendar, a listbox). `onMouseEnter` and `onMouseLeave` are the exception: React fires them
 *   along the component tree, so they also fire when the pointer moves onto or off the tooltip
 *   surface or such a popup. So the Tooltip can sit inside a trigger, and the trigger's
 *   id and state reach the button: `<Menu.Trigger><Tooltip content="…"><Button /></Tooltip>
 *   </Menu.Trigger>` (also `Popover.Trigger`, `Dialog.Trigger`, `Drawer.Trigger`). Around a
 *   trigger works too, since triggers pass `aria-describedby` on to their child.
 * - Wrap the focusable element itself. When the element that takes focus does not get the
 *   relationship (a Popover or Dialog root, a component that drops props, a non-focusable
 *   wrapper element), it is added to the first focusable element inside, with a development
 *   warning.
 *
 * @example
 * <Menu>
 *   <Menu.Trigger>
 *     <Tooltip content="Edit, duplicate or delete the item">
 *       <Button>Actions</Button>
 *     </Tooltip>
 *   </Menu.Trigger>
 *   <Menu.Popover>…</Menu.Popover>
 * </Menu>
 */
export const Tooltip = ({
  content,
  appearance: appearanceProp,
  variant,
  delay = 200,
  relationship = 'description',
  side = 'top',
  align = 'center',
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TooltipProps) => {
  const appearance =
    resolveDeprecatedProp(
      'Tooltip',
      appearanceProp,
      variant === undefined ? undefined : VARIANT_APPEARANCE[variant],
      'variant',
      'appearance',
    ) ?? 'inverted';
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);
  const surfaceRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId('tooltip');

  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open: visible,
    side,
    align,
    offset: 8,
  });
  const wrapperElementRef = useMergedRefs<HTMLSpanElement>(ref, wrapperRef, setReference);
  const surfaceElementRef = useMergedRefs<HTMLSpanElement>(surfaceRef, setFloating);

  // Timer handlers are event callbacks (stable, latest state): they are composed with the
  // consumer's handlers during render but only run from events and timers.
  const clearTimer = useEventCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  });

  const show = useEventCallback(() => {
    clearTimer();
    if (visible) return;
    if (delay <= 0) {
      setVisible(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      setVisible(true);
    }, delay);
  });

  const hide = useEventCallback(() => {
    clearTimer();
    setVisible(false);
  });

  const scheduleHide = useEventCallback(() => {
    clearTimer();
    if (!visible) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      setVisible(false);
    }, HIDE_DELAY_MS);
  });

  // An Escape-only layer while visible: Escape hides the tooltip before any enclosing overlay. The
  // wrapper is its anchor (its trigger, not its surface): Tab from the child inside a focus trap
  // moves on from the popover, portal or dialog around the wrapper.
  useDismiss({
    open: visible,
    onDismiss: hide,
    refs: [wrapperRef, surfaceRef],
    anchorRef: wrapperRef,
    kind: 'tooltip',
    outsidePress: false,
  });

  React.useEffect(() => {
    const timer = timerRef;
    return () => clearTimeout(timer.current);
  }, []);

  // The tooltip's own reactions ignore a popup the child renders in a portal: its focus and blur
  // are not the child's, entering it does not show the tooltip, and the pointer moving onto it
  // (no mouseleave reaches the wrapper then) hides the tooltip, which would cover it. The tooltip
  // surface itself is portaled too but belongs to the tooltip: it stays hoverable.
  const showOnEnter = useEventCallback((event: React.MouseEvent<HTMLSpanElement>) => {
    if (isOwnEvent(event) || surfaceRef.current?.contains(event.target as Node)) show();
  });
  const hideOverPortaledPopup = useEventCallback((event: React.MouseEvent<HTMLSpanElement>) => {
    if (!isOwnEvent(event) && !surfaceRef.current?.contains(event.target as Node)) hide();
  });

  const { childProps, wrapperProps } = splitProps(rest);
  const target = unwrapFragment(children);
  const childIsFallback = !isCloneableElement(target);
  const attribute = relationship === 'label' ? 'aria-labelledby' : 'aria-describedby';
  // Props given to the Tooltip come first, as if the child had them; then the tooltip's own id.
  // The fallback span is a generic element: no state ARIA and no naming on it (the relationship
  // then reaches its first focusable element through useRelationshipTarget).
  const triggerProps: UnknownProps = childIsFallback
    ? omit(childProps, [...STATE_ARIA, ...NAMING_ARIA])
    : { ...childProps };
  if (!childIsFallback || relationship === 'description') {
    triggerProps[attribute] = joinIds(childProps[attribute] as string | undefined, tooltipId);
  }
  const child = renderTrigger(target, triggerProps, { componentName: 'Tooltip' });
  useRelationshipTarget(wrapperRef, tooltipId, relationship, childIsFallback);

  return (
    <span
      ref={wrapperElementRef}
      {...wrapperProps}
      className={cn('inline-block', className)}
      onMouseEnter={composeEventHandlers(onMouseEnter, showOnEnter)}
      onMouseLeave={composeEventHandlers(onMouseLeave, scheduleHide)}
      onMouseOver={composeEventHandlers(
        wrapperProps.onMouseOver as React.MouseEventHandler<HTMLSpanElement> | undefined,
        hideOverPortaledPopup,
      )}
      onFocus={ownEventsOnly(composeEventHandlers(onFocus, show))}
      onBlur={ownEventsOnly(composeEventHandlers(onBlur, hide))}
    >
      {child}
      <span id={tooltipId} role="tooltip" hidden>
        {content}
      </span>
      {visible && (
        <Portal layer="tooltip">
          <span
            ref={surfaceElementRef}
            aria-hidden="true"
            data-wave-tooltip-surface=""
            {...floatingProps}
            className={cn(surfaceClasses, appearanceClasses[appearance])}
          >
            {content}
          </span>
        </Portal>
      )}
    </span>
  );
};

Tooltip.displayName = 'Tooltip';
