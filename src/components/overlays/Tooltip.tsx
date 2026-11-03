import * as React from 'react';
import { wcn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { tooltipClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { FOCUSABLE_SELECTOR, getFirstTabbable } from '../../lib/focus';
import { getGlobalRegistry } from '../../lib/globalRegistry';
import { mergeProps } from '../../lib/mergeProps';
import { tooltipMotion } from '../../lib/motion';
import {
  isCloneableElement,
  renderTrigger,
  STATE_ARIA,
  unwrapFragment,
} from '../../lib/renderTrigger';
import { lockPositionStyle, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import type { MotionSlot, PopupAlign, PopupPositioning, PopupSide } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useDismiss } from '../../hooks/useDismiss';
import { resolvePositioning, usePopupPosition } from '../../hooks/usePopupPosition';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useMotionClasses } from '../../hooks/useMotion';
import { usePresence } from '../../hooks/usePresence';
import { useEventCallback } from '../../hooks/useEventCallback';
import { usePopupTarget } from '../../hooks/useResolvedTarget';
import { Portal } from '../portal/Portal';
import { PopoverBeak } from './Popover.shared';

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
   * Milliseconds before the tooltip appears when the pointer rests on the child or the child
   * receives keyboard focus (Fluent's `showDelay`; unlike Menu's and Popover's `openDelay`, it
   * applies to focus too).
   * @default 200
   */
  openDelay?: number;
  /**
   * Milliseconds before it hides once the pointer has left the child and the tooltip (Fluent's
   * `hideDelay`); blur and Escape hide it at once.
   * @default 100
   */
  closeDelay?: number;
  /**
   * Controlled open state (Fluent's `visible`). The tooltip still asks to open on hover and focus
   * (after `openDelay`) and to close on leave, blur and Escape through `onOpenChange`. The surface
   * renders only in the browser: an open tooltip is closed in the server HTML and opens once it
   * has hydrated.
   */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called with the new open state when it changes (Fluent's `onVisibleChange`). It has no
   * `details` argument yet.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * How the tooltip relates to its child: `description` adds it to the child's
   * `aria-describedby`; `label` adds it to the child's `aria-labelledby`, naming an icon-only
   * button; `inaccessible` makes it a purely visual hint, for text that assistive technology
   * already has (a visible label, an `aria-label`): the child gets no `aria-describedby` or
   * `aria-labelledby` from the Tooltip and the hidden `role="tooltip"` text is not rendered. The
   * surface still shows on hover and focus. Fluent's `relationship`.
   * @default 'description'
   */
  relationship?: 'description' | 'label' | 'inaccessible';
  /**
   * Draws a beak, the small triangle that points at the child (or `positioning.target`), on the
   * surface. It takes the surface's fill and border. Fluent's `withArrow`.
   * @default false
   */
  withArrow?: boolean;
  /**
   * Renders no wrapper element: the Tooltip's handlers (hover, focus and blur), its `ref`, `id`,
   * `aria-*`, `className`, `style` and `data-*` merge onto the single child element instead, which
   * is also the anchor the surface is placed against. The child must forward `ref` and spread its
   * props (a component that does not is wrapped in the `<span>`, with a development warning). The
   * hidden description and the surface render next to the child, not around it, so the child
   * keeps its place in a flex or grid layout, an `inline-block` span no longer changes its box,
   * and `ref` reaches the child, not a `<span>`. Fluent's Tooltip has no wrapper, which is the
   * behavior of this prop; WaveUI keeps its `<span>` by default so existing layouts and the
   * `className` of the wrapper keep working.
   * @default false
   */
  asChild?: boolean;
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
   * Advanced positioning (Fluent's `positioning`): `offset`, `fitViewport`, `matchReferenceWidth`,
   * `fallbackPlacements` and `target`, an element or a `VirtualElement` to place the surface at
   * instead of the child (hover and focus on the child still show it; hold the element in state or
   * pass a ref object). `side` and `align` stay separate props. The hover bridge across the gap
   * covers the default 8px, so a larger `offset` leaves a gap the pointer cannot cross. The
   * surface hides while its anchor is scrolled out of view or clipped.
   * @default `{ offset: 8 }`
   */
  positioning?: PopupPositioning;
  /**
   * The motion of the tooltip's surface (the portaled box; `className` stays on the wrapper
   * `<span>`). By default it fades in over 100 ms and out over 100 ms with the easy-ease curve,
   * without a slide; under reduced motion it appears and disappears at once. `null` turns the
   * motion off (the surface still renders its `data-presence` phases, which then end at once); a
   * class string or `{ className }` replaces the default classes with yours (see `MotionSlot`),
   * also under a `WaveProvider` with `motion="none"`, which otherwise turns the default off. A
   * WaveUI addition: Fluent's Tooltip has no motion.
   * @default the fade above
   */
  motion?: MotionSlot | null;
  /**
   * A single element that triggers the tooltip on hover and focus: it receives the
   * `aria-describedby`/`aria-labelledby`, plus any `id` and `aria-*` props given to the Tooltip
   * (a Fragment around one element counts as that element). Other children are wrapped in a
   * described `<span>` with a development warning, and their first focusable element gets the
   * relationship.
   */
  children: React.ReactElement;
  /**
   * Ref to the wrapper `<span>` (the positioning anchor); with `asChild`, to the child element.
   */
  ref?: React.Ref<HTMLElement>;
  /**
   * Props for the element the Tooltip draws besides your child, by part, merged into the part's
   * own: your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref beside its ref. Every attribute the Tooltip sets on
   * the part is locked and keeps the Tooltip's value; you add the attributes it does not set. A
   * part takes no `children`. The part is Fluent UI's `content` slot, whose element is the
   * surface: here `content` takes the text, and `slotProps.content` the element's props.
   */
  slotProps?: {
    /**
     * The surface `<span>` that shows `content` in a portal while the tooltip is shown (stable
     * class `wave-tooltip__content`): a copy of the hidden description, hidden from assistive
     * technology; `motion` gives it its motion classes, before yours. It carries no handler of
     * the Tooltip: the Tooltip follows the pointer on it from the wrapper, through the component
     * tree, after yours, so `preventDefault()` in your `onMouseLeave` keeps the tooltip shown, as
     * it would in the content. Locked: `aria-hidden`, its marker `data-wave-tooltip-surface`,
     * `data-state`, `data-presence`, `inert`, `data-side` and `data-align`, and, unset, `role`,
     * `id`, `hidden` and `tabIndex`; your `style` merges, but the position the positioning sets
     * wins.
     */
    content?: SlotPart<'span'>;
    /**
     * The `<div>` of the beak, the rotated square on the edge of the surface that faces the child,
     * rendered with `withArrow` (stable class `wave-tooltip__beak`). The positioning places it,
     * and your ref is attached beside the Tooltip's. Locked: `aria-hidden` (it is a drawing), its
     * marker `data-wave-tooltip-arrow`, `tabIndex` (unset) and the keys of its style that the
     * positioning sets (`position`, `left`, `top` and the offset of the edge it sits on), which
     * win over yours.
     */
    beak?: SlotPart<'div'>;
  };
}

const appearanceClasses: Record<TooltipAppearance, string> = {
  inverted:
    'wave:border wave:border-inverted-border wave:bg-inverted wave:text-inverted-foreground',
  normal: 'wave:border wave:border-border wave:bg-background wave:text-foreground',
};

/**
 * Transparent `::before` hover bridge across the 8px gap (the positioning offset) on the side that
 * faces the trigger only, so the pointer can move onto the tooltip; the other sides get no bridge,
 * which would otherwise catch hovers and clicks meant for neighbouring controls.
 */
const bridgeClasses = [
  'wave:before:absolute',
  // Tooltip above the trigger: a strip below it.
  'wave:data-[side=top]:before:inset-x-0 wave:data-[side=top]:before:top-full wave:data-[side=top]:before:h-2',
  // Tooltip below the trigger: a strip above it.
  'wave:data-[side=bottom]:before:inset-x-0 wave:data-[side=bottom]:before:bottom-full wave:data-[side=bottom]:before:h-2',
  // wave-allow-physical: data-side is the physical side resolved by the positioning
  'wave:data-[side=left]:before:inset-y-0 wave:data-[side=left]:before:left-full wave:data-[side=left]:before:w-2',
  // wave-allow-physical: data-side is the physical side resolved by the positioning
  'wave:data-[side=right]:before:inset-y-0 wave:data-[side=right]:before:right-full wave:data-[side=right]:before:w-2',
].join(' ');

/**
 * The visual surface: wrapping text, typography reset against the host (header cells, muted
 * panels), and the hover bridge towards the trigger.
 */
const surfaceClasses = `wave:max-w-60 wave:whitespace-normal wave:break-words wave:rounded wave:px-3 wave:py-1.5 wave:text-caption-1 wave:font-normal wave:normal-case wave:tracking-normal wave:text-start wave:shadow-8 ${bridgeClasses}`;

type UnknownProps = Record<string, unknown>;
type Relationship = Exclude<NonNullable<TooltipProps['relationship']>, 'inaccessible'>;

/** The open tooltips' hide functions: showing one tooltip hides the others. */
function getOpenTooltips(): Set<() => void> {
  return getGlobalRegistry<Set<() => void>>('tooltips', () => new Set());
}

/** Whether the element (or a descendant of it) is a trigger whose popup is expanded. */
function hasExpandedTrigger(element: Element | null): boolean {
  if (!element) return false;
  return (
    element.getAttribute('aria-expanded') === 'true' ||
    element.querySelector('[aria-expanded="true"]') !== null
  );
}

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
  wrapperRef: React.RefObject<HTMLElement | null>,
  tooltipId: string,
  relationship: Relationship,
  childIsFallback: boolean,
  enabled: boolean,
  includeSelf: boolean,
): void {
  const appliedRef = React.useRef<{ element: Element; attribute: string } | null>(null);
  const attribute = relationship === 'label' ? 'aria-labelledby' : 'aria-describedby';

  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !enabled) return;

    const update = () => {
      const applied = appliedRef.current;
      // Without a wrapper the anchor is the child itself, which carries the id.
      const inside = Array.from(wrapper.querySelectorAll(`[${attribute}]`));
      const carriers = (includeSelf ? [wrapper, ...inside] : inside).filter(
        (el) =>
          !(applied && applied.element === el && applied.attribute === attribute) &&
          hasIdRef(el, attribute, tooltipId),
      );
      const reached = carriers.some((el) => el.matches(FOCUSABLE_SELECTOR));
      const target = reached ? null : getFirstTabbable(wrapper, { includeContainer: includeSelf });
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
 * - The visual surface is rendered in a portal while visible (it is `aria-hidden`, a copy of the
 *   description), positioned on `side`/`align` with flipping and shifting to stay in view.
 * - It fades in and out over 100 ms (see `motion`; at once under reduced motion). The surface
 *   mounts through the presence core: it carries `data-presence` and `data-state="open"`, and
 *   while it fades out `data-state="closed"` and `inert`, staying where it was until its exit
 *   ends; the Escape layer goes as it hides, not after the fade. Shown again during its exit, the
 *   same surface fades back in. The hidden description is unchanged in every phase.
 * - It appears `openDelay` after the pointer rests on the child or the child takes keyboard focus,
 *   stays visible while the pointer moves onto it, hides `closeDelay` after the pointer leaves or
 *   immediately on blur, and Escape hides it without closing an enclosing dialog or popover. Focus
 *   and hover inside a popup the child renders in a portal (a DatePicker calendar, a listbox) do
 *   not show it, and the pointer moving onto such a popup hides it.
 * - The open state is uncontrolled by default (`defaultOpen`). With `open` and `onOpenChange`
 *   (Fluent's `visible` and `onVisibleChange`) the parent owns it: hover, focus, leave, blur and
 *   Escape then only ask for a change, and `open` alone shows the surface.
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
 * * - **No wrapper.** `asChild` renders no `<span>`: the handlers, `ref` and props merge onto the
 *   child, which must forward `ref` and spread its props, and the hidden description and the
 *   surface render next to it.
 * - **Relationship.** `relationship="inaccessible"` shows a purely visual hint: no
 *   `aria-describedby` or `aria-labelledby` on the child, and no hidden description.
 * - **Beak and anchor.** `withArrow` draws a beak; `positioning.target` places the surface at
 *   another element or a `VirtualElement`, and the surface hides while its anchor is scrolled out of
 *   view or clipped.
 * - **One at a time.** Showing a tooltip hides every other one; a tooltip hides when the
 *   document is hidden (another tab), when the child's popup is expanded (a Menu or Popover its
 *   trigger opened: `aria-expanded="true"` on the child or an element inside it) and stays hidden
 *   while it is. While it fades out it keeps the content it showed, so a text you reset in
 *   `onOpenChange(false)` (a "Copied" back to "Copy") does not change during the fade.
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
  openDelay: openDelayProp,
  closeDelay = 100,
  open: openProp,
  defaultOpen,
  onOpenChange,
  relationship = 'description',
  withArrow = false,
  asChild = false,
  side = 'top',
  align = 'center',
  positioning,
  motion,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ref,
  slotProps,
  ...rest
}: TooltipProps) => {
  const appearance = appearanceProp ?? 'inverted';
  const openDelay = openDelayProp ?? 200;
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  // The surface lives in a portal, which renders only in the browser: until then (the server HTML,
  // hydration) the tooltip is closed; the hidden description is rendered either way.
  const isClient = useIsClient();
  const visible = open && isClient;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The anchor: the wrapper `<span>`, or with `asChild` the child element. Held in state for the
  // positioning and in a ref for event handlers.
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const [anchorElement, setAnchorElement] = React.useState<HTMLElement | null>(null);
  const surfaceRef = React.useRef<HTMLSpanElement | null>(null);
  const arrowRef = React.useRef<HTMLDivElement | null>(null);
  const tooltipId = useId('tooltip');
  const inaccessible = relationship === 'inaccessible';

  // The surface mounts and unmounts through the presence core, and enters also when it mounts
  // visible (a tooltip open by default fades in on a client render as after hydration); the
  // positioning and the Escape layer key on `visible`, so they go as it hides, not after its exit.
  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const { isMounted, ref: presenceRef, presenceProps } = usePresence(visible, { appear: true });
  const motionClassName = useMotionClasses(motion, tooltipMotion);
  // `positioning.target` places the surface at another element or point; the child stays the
  // trigger of the hover and the focus.
  const { target: customTarget } = usePopupTarget('Tooltip', undefined, positioning);
  const {
    setReference,
    setFloating,
    floatingProps,
    arrowStyles,
    side: placedSide,
  } = usePopupPosition({
    open: visible,
    side,
    align,
    arrowRef: withArrow ? arrowRef : undefined,
    // The surface hides while its anchor is scrolled out of view or clipped away.
    hideWhenDetached: true,
    ...resolvePositioning(positioning, { offset: 8 }),
  });
  React.useLayoutEffect(() => {
    setReference(customTarget ?? anchorElement);
  }, [customTarget, anchorElement, setReference]);
  const anchorCallback = useMergedRefs<HTMLElement>(ref, anchorRef, setAnchorElement);
  // The positioning and the presence core measure the surface: a part's ref goes beside theirs.
  const surfaceElementRef = useMergedRefs<HTMLSpanElement>(
    surfaceRef,
    setFloating,
    presenceRef,
    slotProps?.content?.ref,
  );
  // The positioning measures the beak: a part's ref goes beside its ref, never in its place.
  const beakRef = useMergedRefs<HTMLDivElement>(arrowRef, slotProps?.beak?.ref);

  // The content the surface shows: the live one while visible, else the one it last showed, so a
  // text reset as the tooltip closes does not change while it fades out (a previous-value state,
  // C-HOOKS).
  const [shownContent, setShownContent] = React.useState(content);
  if (visible && content !== shownContent) setShownContent(content);
  const surfaceContent = visible ? content : shownContent;

  // Timer handlers are event callbacks (stable, latest state): they are composed with the
  // consumer's handlers during render but only run from events and timers.
  const clearTimer = useEventCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  });
  // A trigger whose popup is expanded (a Menu or Popover it opened) shows no tooltip over it.
  const isTriggerExpanded = useEventCallback(() => hasExpandedTrigger(anchorRef.current));

  // show, hide and scheduleHide ask for the new state; a controlled tooltip changes only when the
  // parent updates `open`.
  const show = useEventCallback(() => {
    clearTimer();
    if (visible || isTriggerExpanded()) return;
    if (openDelay <= 0) {
      setOpen(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      if (!isTriggerExpanded()) setOpen(true);
    }, openDelay);
  });

  const hide = useEventCallback(() => {
    clearTimer();
    setOpen(false);
  });

  // The grace period after the pointer leaves lets it move onto the tooltip.
  const scheduleHide = useEventCallback(() => {
    clearTimer();
    if (!visible) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      setOpen(false);
    }, closeDelay);
  });

  // An Escape-only layer while visible: Escape hides the tooltip before any enclosing overlay. The
  // anchor is its trigger (not its surface): Tab from the child inside a focus trap moves on from
  // the popover, portal or dialog around it.
  useDismiss({
    open: visible,
    onDismiss: hide,
    refs: [anchorRef, surfaceRef],
    anchorRef,
    kind: 'tooltip',
    outsidePress: false,
  });

  React.useEffect(() => {
    const timer = timerRef;
    return () => clearTimeout(timer.current);
  }, []);

  // One tooltip at a time: showing one hides the others (the last to show stays).
  React.useEffect(() => {
    if (!visible) return;
    const shown = getOpenTooltips();
    for (const hideOther of Array.from(shown)) hideOther();
    shown.add(hide);
    return () => {
      shown.delete(hide);
    };
  }, [visible, hide]);

  // A tooltip over a hidden document (another tab, a minimised window) would be there when it
  // comes back, so it hides.
  React.useEffect(() => {
    if (!visible) return;
    const doc = anchorRef.current?.ownerDocument ?? document;
    const onVisibilityChange = () => {
      if (doc.hidden) hide();
    };
    doc.addEventListener('visibilitychange', onVisibilityChange);
    return () => doc.removeEventListener('visibilitychange', onVisibilityChange);
  }, [visible, hide]);

  // The trigger's popup expanding while the tooltip is shown (a click on a menu button) hides it.
  React.useEffect(() => {
    if (!visible || !anchorElement || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      if (hasExpandedTrigger(anchorElement)) hide();
    });
    observer.observe(anchorElement, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [visible, anchorElement, hide]);

  // The tooltip's own reactions ignore a popup the child renders in a portal: its focus and blur
  // are not the child's, entering it does not show the tooltip, and the pointer moving onto it
  // (no mouseleave reaches the anchor then) hides the tooltip, which would cover it. The tooltip
  // surface itself is portaled too but belongs to the tooltip: it stays hoverable.
  const showOnEnter = useEventCallback((event: React.MouseEvent<HTMLElement>) => {
    if (isOwnEvent(event) || surfaceRef.current?.contains(event.target as Node)) show();
  });
  const hideOverPortaledPopup = useEventCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!isOwnEvent(event) && !surfaceRef.current?.contains(event.target as Node)) hide();
  });

  const { childProps, wrapperProps } = splitProps(rest);
  const target = unwrapFragment(children);
  const childIsFallback = !isCloneableElement(target);
  // `asChild` needs an element to merge onto: a child that is not one (text, several elements) is
  // wrapped as it is without it, with the usual warning.
  const noWrapper = asChild && !childIsFallback;
  const attribute = relationship === 'label' ? 'aria-labelledby' : 'aria-describedby';
  // Props given to the Tooltip come first, as if the child had them; then the tooltip's own id.
  // The fallback span is a generic element: no state ARIA and no naming on it (the relationship
  // then reaches its first focusable element through useRelationshipTarget). An inaccessible
  // tooltip adds no relationship at all.
  const triggerProps: UnknownProps = childIsFallback
    ? omit(childProps, [...STATE_ARIA, ...NAMING_ARIA])
    : { ...childProps };
  if (!inaccessible && (!childIsFallback || relationship === 'description')) {
    triggerProps[attribute] = joinIds(childProps[attribute] as string | undefined, tooltipId);
  }
  const handlers = {
    onMouseEnter: composeEventHandlers(onMouseEnter, showOnEnter),
    onMouseLeave: composeEventHandlers(onMouseLeave, scheduleHide),
    onMouseOver: composeEventHandlers(
      wrapperProps.onMouseOver as React.MouseEventHandler<HTMLElement> | undefined,
      hideOverPortaledPopup,
    ),
    onFocus: ownEventsOnly(composeEventHandlers(onFocus, show)),
    onBlur: ownEventsOnly(composeEventHandlers(onBlur, hide)),
  };

  // Without a wrapper the child is the anchor: the Tooltip's props merge onto it, and its own
  // `ref` merges with the Tooltip's (one memoised callback, so it is not re-attached each render).
  const childOwnRef =
    noWrapper && isCloneableElement(target)
      ? (target.props.ref as React.Ref<HTMLElement> | undefined)
      : undefined;
  const childRef = useMergedRefs<HTMLElement>(anchorCallback, childOwnRef);
  React.useEffect(() => {
    if (!noWrapper || anchorRef.current) return;
    warnOnce(
      'Tooltip:child-ref',
      'Tooltip: with `asChild` its child did not attach the Tooltip ref (a component that neither forwards `ref` nor spreads its props), so the tooltip has no element to point at. Forward `ref` and spread the props onto the element, or remove `asChild`.',
    );
  });

  let child: React.ReactNode;
  if (noWrapper && isCloneableElement(target)) {
    const { ref: _theirRef, ...theirProps } = target.props;
    const ours: UnknownProps = {
      ...triggerProps,
      ...wrapperProps,
      ...handlers,
      className: wcn(className),
    };
    if (!className) delete ours.className;
    child = React.cloneElement(target, {
      ...mergeProps(ours, theirProps, { oursWin: STATE_ARIA }),
      ref: childRef,
    } as UnknownProps);
  } else {
    child = renderTrigger(target, triggerProps, { componentName: 'Tooltip' });
  }
  useRelationshipTarget(
    anchorRef,
    tooltipId,
    relationship === 'label' ? 'label' : 'description',
    childIsFallback,
    !inaccessible,
    noWrapper,
  );

  // The surface's props are merged only while it is mounted. The presence attributes are present
  // only in some phases: the keys they may add are locked unset before them.
  let surface: React.ReactNode = null;
  if (isMounted) {
    const surfaceProps = mergeSlotProps(slotProps?.content, {
      className: wcn(
        tooltipClassNames.content,
        surfaceClasses,
        appearanceClasses[appearance],
        motionClassName,
      ),
      locked: {
        role: undefined,
        id: undefined,
        tabIndex: undefined,
        hidden: undefined,
        inert: undefined,
        'aria-hidden': 'true',
        'data-wave-tooltip-surface': '',
        'data-state': visible ? 'open' : 'closed',
        ...presenceProps,
        'data-side': floatingProps['data-side'],
        'data-align': floatingProps['data-align'],
      },
    });
    const beak = mergeSlotProps(slotProps?.beak, {
      className: tooltipClassNames.beak,
      locked: { 'aria-hidden': 'true', 'data-wave-tooltip-arrow': '', tabIndex: undefined },
    });
    surface = (
      <Portal layer="tooltip">
        <span
          {...surfaceProps}
          ref={surfaceElementRef}
          style={lockPositionStyle(surfaceProps.style, floatingProps.style)}
        >
          {surfaceContent}
          {withArrow && (
            <PopoverBeak
              {...beak}
              ref={beakRef}
              side={placedSide}
              style={lockPositionStyle(beak.style, arrowStyles)}
            />
          )}
        </span>
      </Portal>
    );
  }

  // The text is always present, hidden, for the child's `aria-describedby`/`aria-labelledby`: an
  // inaccessible tooltip has none.
  const description = inaccessible ? null : (
    <span id={tooltipId} role="tooltip" hidden>
      {content}
    </span>
  );

  if (noWrapper) {
    return (
      <>
        {child}
        {description}
        {surface}
      </>
    );
  }

  return (
    <span
      ref={anchorCallback}
      {...wrapperProps}
      className={wcn(tooltipClassNames.root, 'wave:inline-block', className)}
      {...handlers}
    >
      {child}
      {description}
      {surface}
    </span>
  );
};

Tooltip.displayName = 'Tooltip';
