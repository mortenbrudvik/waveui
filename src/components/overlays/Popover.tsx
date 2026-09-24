import * as React from 'react';
import { cn } from '../../lib/cn';
import { isDev, warnOnce } from '../../lib/dev';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getFirstTabbable, getTabbableElements, isFocusable } from '../../lib/focus';
import type { PopupAlign, PopupSide } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useControllable, type SetValue } from '../../hooks/useControllable';
import { useDismiss } from '../../hooks/useDismiss';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useTriggerElement } from '../../hooks/useTriggerElement';
import { Portal } from '../portal/Portal';

/** Properties for the Popover component. */
export interface PopoverProps {
  /** Controlled open state of the popover. */
  open?: boolean;
  /** Default open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called with the requested open state (trigger click, Escape, outside press). */
  onOpenChange?: (open: boolean) => void;
  /**
   * Side of the trigger the content opens on. `start`/`end` follow the writing direction. The
   * content flips to the opposite side when there is not enough room.
   * @default 'bottom'
   */
  side?: PopupSide;
  /** Alignment of the content along the trigger's edge.
   * @default 'start'
   */
  align?: PopupAlign;
  /**
   * Elements outside the popover whose presses must not dismiss it, e.g. an external toggle
   * button that opens and closes the popover itself.
   */
  ignoreOutsideRefs?: ReadonlyArray<React.RefObject<HTMLElement | null>>;
  /** `Popover.Trigger` and `Popover.Content`. */
  children: React.ReactNode;
}

/**
 * Props the trigger puts on its element; a render-prop child of `Popover.Trigger` receives them
 * (spread them onto the element that opens the popover).
 */
export type PopoverTriggerChildProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  id: string;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  /** The content's id, only while the popover is open. */
  'aria-controls': string | undefined;
  onClick: React.MouseEventHandler<HTMLElement>;
  ref: React.RefCallback<HTMLElement>;
};

/** Properties for the PopoverTrigger sub-component. */
export interface PopoverTriggerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The element that toggles the popover (its props are merged onto it), or a render function
   * that receives the trigger props.
   */
  children: React.ReactNode | ((props: PopoverTriggerChildProps) => React.ReactNode);
  /**
   * `false` renders the 0.4 wrapper `<span>` carrying the trigger props around the children
   * instead of merging them onto the child. The span gets no `aria-haspopup`, `aria-expanded` or
   * `aria-controls` (a generic element cannot carry them), so prefer the default, which puts them
   * on the child. A render-prop child ignores `asChild` and receives every prop.
   * @default true
   */
  asChild?: boolean;
  /** Ref to the trigger element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the PopoverContent sub-component. */
export interface PopoverContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Content to render inside the popover. */
  children: React.ReactNode;
  /**
   * Visible heading rendered at the top of the popover; it names the dialog. Without `title`,
   * `aria-label` or `aria-labelledby`, the popover is labelled by its trigger.
   */
  title?: React.ReactNode;
  /** Id of the surface; the trigger's `aria-controls` follows it. Defaults to a generated id. */
  id?: string;
  /** Ref to the popover surface. */
  ref?: React.Ref<HTMLDivElement>;
}

type PhysicalSide = 'top' | 'bottom' | 'left' | 'right';

interface PopoverContextValue {
  open: boolean;
  setOpen: SetValue<boolean>;
  /** The content's id: the consumer's `Popover.Content` id when given, else a generated one. */
  contentId: string;
  /** `Popover.Content` reports the consumer's `id` so the trigger's `aria-controls` follows it. */
  setCustomContentId: (id: string | undefined) => void;
  triggerId: string;
  /** The id the trigger element ended up with (the child's own id wins). */
  resolvedTriggerId: string | undefined;
  setResolvedTriggerId: (id: string) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  /** The trigger element as state (read during render, e.g. to check the labelling id). */
  triggerElement: HTMLElement | null;
  /** Ref callback for the trigger element: focus-restore target and positioning anchor. */
  triggerElementRef: React.RefCallback<HTMLElement>;
  /** Ref callback for the surface: dismissal, focus restore and positioning. */
  surfaceElementRef: React.RefCallback<HTMLElement>;
  arrowRef: React.RefObject<HTMLDivElement | null>;
  /** Tab from the open trigger enters the portaled content. */
  onTriggerKeyDown: React.KeyboardEventHandler<HTMLElement>;
  /** Tab past the content's edges continues around the trigger in the page order. */
  onContentKeyDown: React.KeyboardEventHandler<HTMLElement>;
  layerId: string;
  floatingProps: { 'data-side': string; 'data-align': string; style: React.CSSProperties };
  arrowStyles: React.CSSProperties;
  placedSide: PhysicalSide;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);
PopoverContext.displayName = 'PopoverContext';

let inertContext: PopoverContextValue | null = null;

/** Production fallback for a misplaced sub-component: a closed popover that does nothing. */
function getInertContext(): PopoverContextValue {
  inertContext ??= {
    open: false,
    setOpen: () => {},
    contentId: 'wave-popover-inert-content',
    setCustomContentId: () => {},
    triggerId: 'wave-popover-inert-trigger',
    resolvedTriggerId: undefined,
    setResolvedTriggerId: () => {},
    triggerRef: { current: null },
    triggerElement: null,
    triggerElementRef: () => {},
    surfaceElementRef: () => {},
    arrowRef: { current: null },
    onTriggerKeyDown: () => {},
    onContentKeyDown: () => {},
    layerId: 'wave-popover-inert-layer',
    floatingProps: { 'data-side': 'bottom', 'data-align': 'start', style: {} },
    arrowStyles: {},
    placedSide: 'bottom',
  };
  return inertContext;
}

function usePopoverContext(componentName: string): PopoverContextValue {
  const context = React.useContext(PopoverContext);
  if (context) return context;
  const message = `[WaveUI] ${componentName} must be used within Popover.`;
  if (isDev) throw new Error(message);
  console.error(message);
  return getInertContext();
}

/** Borders of the rotated square beak that face the trigger, per final physical side. */
const ARROW_BORDER: Record<PhysicalSide, string> = {
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  top: 'border-b border-r',
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  bottom: 'border-t border-l',
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  left: 'border-t border-r',
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  right: 'border-b border-l',
};

/**
 * The element that takes focus for the trigger: the trigger itself, or — for the wrapper `<span>`
 * of `asChild={false}` and of the automatic fallback — the first tabbable element inside it.
 */
function getTriggerFocusTarget(trigger: HTMLElement | null): HTMLElement | null {
  if (!trigger) return null;
  return isFocusable(trigger) ? trigger : getFirstTabbable(trigger);
}

/**
 * The trigger id that `Popover.Content`'s default `aria-labelledby` can point at: the resolved id
 * when an element in the document has it; otherwise the id the trigger element actually carries —
 * that of its focus target (for example the Button inside a Tooltip that sits between
 * `Popover.Trigger` and the Button, whose own id wins), else its own. `undefined` when the trigger
 * element has no id (a render-prop child that does not spread `id`), so the reference never
 * dangles. Before the trigger element is known, the resolved id.
 */
function findTriggerLabelId(
  trigger: HTMLElement | null,
  resolvedId: string | undefined,
): string | undefined {
  if (!trigger) return resolvedId;
  if (resolvedId && trigger.ownerDocument.getElementById(resolvedId)) return resolvedId;
  return getTriggerFocusTarget(trigger)?.id || trigger.id || undefined;
}

const subscribeNothing = (): (() => void) => () => {};

/**
 * The first tabbable element after `anchor` in document order that is in the same portal as the
 * anchor (or, like it, in the page) and outside `exclude`.
 */
function getTabbableAfter(anchor: HTMLElement, exclude: HTMLElement): HTMLElement | null {
  const scope = anchor.closest('[data-wave-portal]');
  for (const el of getTabbableElements(anchor.ownerDocument.body)) {
    if (exclude.contains(el) || anchor.contains(el)) continue;
    if (el.closest('[data-wave-portal]') !== scope) continue;
    if (anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return el;
  }
  return null;
}

// A const arrow (like DialogRoot and DrawerRoot): its type can be named in consumers' declaration
// files, e.g. a story's `satisfies Meta<typeof Popover>` (a function declaration's `typeof` cannot,
// TS4023).
const PopoverRoot = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  side = 'bottom',
  align = 'start',
  ignoreOutsideRefs,
  children,
}: PopoverProps) => {
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const generatedContentId = useId('popover-content');
  const [customContentId, setCustomContentId] = React.useState<string | undefined>(undefined);
  const contentId = customContentId ?? generatedContentId;
  const triggerId = useId('popover-trigger');
  const [resolvedTriggerId, setResolvedTriggerId] = React.useState<string | undefined>(undefined);
  const [surface, setSurface] = React.useState<HTMLElement | null>(null);
  const [triggerElement, setTriggerElement] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const surfaceRef = React.useRef<HTMLElement | null>(null);
  const arrowRef = React.useRef<HTMLDivElement | null>(null);

  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const {
    setReference,
    setFloating,
    floatingProps,
    arrowStyles,
    side: placedSide,
  } = usePopupPosition({ open, side, align, offset: 8, arrowRef });

  const { layerId } = useDismiss({
    open,
    onDismiss: () => setOpen(false),
    refs: [surfaceRef, triggerRef, ...(ignoreOutsideRefs ?? [])],
    anchorRef: triggerRef,
    kind: 'popover',
  });

  // A wrapper-span trigger cannot take focus itself: fall back to the element inside it.
  const getRestoreFallback = React.useCallback(() => getTriggerFocusTarget(triggerRef.current), []);
  useRestoreFocus({
    enabled: open,
    container: surface,
    triggerRef,
    fallback: getRestoreFallback,
    onlyIfFocusInside: true,
  });

  const triggerElementRef = useMergedRefs<HTMLElement>(triggerRef, setReference, setTriggerElement);
  const surfaceElementRef = useMergedRefs<HTMLElement>(surfaceRef, setSurface, setFloating);

  // Keyboard order of the portaled content (it lives at the end of the document): Tab from the
  // open trigger enters it, Tab past its last element continues after the trigger, and Shift+Tab
  // from its first element returns to the trigger (the element inside a wrapper span) — the order
  // of 0.4's inline content.
  const onTriggerKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || event.shiftKey || !open) return;
    const surfaceElement = surfaceRef.current;
    const first = surfaceElement ? getFirstTabbable(surfaceElement) : null;
    if (!first) return;
    event.preventDefault();
    first.focus();
  });

  const onContentKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const surfaceElement = surfaceRef.current;
    const trigger = triggerRef.current;
    const active = surfaceElement?.ownerDocument.activeElement;
    // Events from nested portaled layers bubble here through React: only handle our own content.
    if (!surfaceElement || !trigger || !active || !surfaceElement.contains(active)) return;
    const tabbables = getTabbableElements(surfaceElement);
    if (event.shiftKey) {
      if (active !== surfaceElement && active !== tabbables[0]) return;
      const target = getTriggerFocusTarget(trigger);
      if (!target) return;
      event.preventDefault();
      target.focus();
      return;
    }
    if (tabbables.length > 0 && active !== tabbables[tabbables.length - 1]) return;
    const next = getTabbableAfter(trigger, surfaceElement);
    if (!next) return;
    event.preventDefault();
    next.focus();
  });

  const context = React.useMemo<PopoverContextValue>(
    () => ({
      open,
      setOpen,
      contentId,
      setCustomContentId,
      triggerId,
      resolvedTriggerId,
      setResolvedTriggerId,
      triggerRef,
      triggerElement,
      triggerElementRef,
      surfaceElementRef,
      arrowRef,
      onTriggerKeyDown,
      onContentKeyDown,
      layerId,
      floatingProps,
      arrowStyles,
      placedSide,
    }),
    [
      open,
      setOpen,
      contentId,
      triggerId,
      resolvedTriggerId,
      triggerElement,
      triggerElementRef,
      surfaceElementRef,
      onTriggerKeyDown,
      onContentKeyDown,
      layerId,
      floatingProps,
      arrowStyles,
      placedSide,
    ],
  );

  return <PopoverContext.Provider value={context}>{children}</PopoverContext.Provider>;
};

PopoverRoot.displayName = 'Popover';

/**
 * The element that toggles the popover. Its props are merged onto the single child (no wrapper
 * element): `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (while open), an `id` that
 * labels the content, a composed `onClick` and the ref used as positioning anchor and focus-return
 * target. The child's own `id`, handlers and classes are kept; the live state ARIA always wins.
 * A render function receives the props instead (spread all of them, `id` included: the content is
 * named by it); `asChild={false}` renders the 0.4 wrapper span (without the state ARIA), and a
 * custom child that neither forwards `ref` nor spreads its props falls back to that span
 * automatically (with a development warning).
 *
 * A Tooltip goes between the trigger and the button: it passes the trigger's `id` and ARIA on to
 * the button, which the Tooltip also describes.
 *
 * @example
 * <Popover.Trigger>
 *   <Tooltip content="Narrow the list">
 *     <Button>Filters</Button>
 *   </Tooltip>
 * </Popover.Trigger>
 *
 * Also exported as `PopoverTrigger` for React Server Components, which cannot use the dotted
 * `Popover.Trigger` (that needs a client file).
 */
export const PopoverTrigger = ({
  children,
  asChild,
  id: idProp,
  onClick,
  onKeyDown,
  ref,
  ...rest
}: PopoverTriggerProps) => {
  const {
    open,
    setOpen,
    contentId,
    triggerId,
    triggerElementRef,
    setResolvedTriggerId,
    onTriggerKeyDown,
  } = usePopoverContext('Popover.Trigger');
  const elementRef = useMergedRefs<HTMLElement>(ref, triggerElementRef);

  // The explicit wrapper span (0.4 markup) carries no state ARIA: a generic span cannot (axe
  // aria-allowed-attr). A render-prop child still receives it.
  const stateAria =
    asChild === false && typeof children !== 'function'
      ? {}
      : {
          'aria-haspopup': 'dialog' as const,
          'aria-expanded': open,
          'aria-controls': open ? contentId : undefined,
        };
  const triggerProps = {
    ...rest,
    id: idProp ?? triggerId,
    ...stateAria,
    onClick: composeEventHandlers(onClick, () => setOpen((current) => !current)),
    onKeyDown: composeEventHandlers(onKeyDown, onTriggerKeyDown),
    ref: elementRef,
  } as PopoverTriggerChildProps;

  return useTriggerElement(children, triggerProps, {
    componentName: 'Popover.Trigger',
    asChild,
    onResolvedId: setResolvedTriggerId,
  });
};
PopoverTrigger.displayName = 'PopoverTrigger';

/**
 * The popover surface: a non-modal `role="dialog"` rendered in a portal (so overflow containers
 * never clip it) and positioned next to the trigger with a beak, flipping and shifting to stay in
 * the viewport. It closes on Escape and on a press outside (presses inside nested overlays opened
 * from it count as inside), and focus returns to the trigger when it closes while focus was inside.
 * Named by `title`, `aria-label`/`aria-labelledby`, or else by its trigger: `aria-labelledby`
 * points at the id the trigger element carries in the document (never at a missing id; a
 * development warning names the problem when the trigger has none). A consumer `id` is
 * kept, and the trigger's `aria-controls` follows it. The beak inherits the surface's background
 * and border colors, so a `className` that changes them restyles the beak too.
 *
 * Also exported as `PopoverContent` for React Server Components, which cannot use the dotted
 * `Popover.Content` (that needs a client file).
 */
export const PopoverContent = ({
  children,
  title,
  id: idProp,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  onKeyDown,
  ref,
  ...rest
}: PopoverContentProps) => {
  const {
    open,
    contentId,
    setCustomContentId,
    resolvedTriggerId,
    triggerRef,
    triggerElement,
    surfaceElementRef,
    arrowRef,
    layerId,
    floatingProps,
    arrowStyles,
    placedSide,
    onContentKeyDown,
  } = usePopoverContext('Popover.Content');
  const titleId = useId('popover-title');
  const elementRef = useMergedRefs<HTMLDivElement>(ref, surfaceElementRef);
  const hasTitle = title !== undefined && title !== null && title !== false && title !== '';
  const labelledByTrigger = ariaLabelledBy === undefined && !ariaLabel && !hasTitle;
  const checkTrigger = open && labelledByTrigger;

  // The trigger id in the document, re-read when the trigger's ids change: a Tooltip between
  // Popover.Trigger and the Button leaves the Button's own id in place, and a render-prop child
  // may not spread `id` at all — never point aria-labelledby at an id that is not there.
  const subscribeTrigger = React.useCallback(
    (onChange: () => void) => {
      if (!checkTrigger || !triggerElement || typeof MutationObserver === 'undefined') {
        return subscribeNothing();
      }
      const observer = new MutationObserver(onChange);
      observer.observe(triggerElement, {
        attributes: true,
        attributeFilter: ['id'],
        childList: true,
        subtree: true,
      });
      return () => observer.disconnect();
    },
    [checkTrigger, triggerElement],
  );
  const triggerLabelId = React.useSyncExternalStore(
    subscribeTrigger,
    () => (checkTrigger ? findTriggerLabelId(triggerElement, resolvedTriggerId) : undefined),
    () => (checkTrigger ? resolvedTriggerId : undefined),
  );

  const labelledBy =
    ariaLabelledBy ?? (ariaLabel ? undefined : hasTitle ? titleId : triggerLabelId);
  const customId = idProp || undefined;

  // Report the consumer's id to the root so the trigger's `aria-controls` points at it.
  React.useEffect(() => {
    setCustomContentId(customId);
    return () => setCustomContentId(undefined);
  }, [customId, setCustomContentId]);

  React.useEffect(() => {
    if (!checkTrigger) return;
    // Read after commit: a trigger's ref is attached by now even before it reported its id.
    const trigger = triggerRef.current;
    if (!trigger) {
      warnOnce(
        'Popover.Content:name',
        'Popover.Content: the popover has no accessible name. Pass `title`, `aria-label` or `aria-labelledby`, or open it from a Popover.Trigger.',
      );
    } else if (!findTriggerLabelId(trigger, resolvedTriggerId)) {
      warnOnce(
        'Popover.Content:trigger-id',
        'Popover.Content: the popover is named by its trigger, but the trigger element has no `id` (a render-prop child of Popover.Trigger must spread the `id` it receives), so the popover has no accessible name. Spread every trigger prop onto the element, or pass `title`, `aria-label` or `aria-labelledby`.',
      );
    }
  }, [checkTrigger, resolvedTriggerId, triggerRef]);

  if (!open) return null;

  return (
    <Portal layerId={layerId}>
      <div
        role="dialog"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        {...rest}
        ref={elementRef}
        id={customId ?? contentId}
        data-side={floatingProps['data-side']}
        data-align={floatingProps['data-align']}
        style={{ ...style, ...floatingProps.style }}
        onKeyDown={composeEventHandlers(onKeyDown, onContentKeyDown)}
        className={cn(
          'w-64 rounded-md border border-border bg-background p-4 text-body-1 font-normal text-foreground normal-case tracking-normal text-start shadow-4',
          className,
        )}
      >
        <div
          ref={arrowRef}
          aria-hidden="true"
          data-wave-popover-arrow=""
          style={arrowStyles}
          className={cn('size-2 rotate-45 border-inherit bg-inherit', ARROW_BORDER[placedSide])}
        />
        {hasTitle && (
          <h2 id={titleId} className="mb-2 text-subtitle-2 font-semibold">
            {title}
          </h2>
        )}
        {children}
      </div>
    </Portal>
  );
};
PopoverContent.displayName = 'PopoverContent';

/**
 * A non-modal popup anchored to a trigger: `Popover.Trigger` (merges its props onto the child
 * button) and `Popover.Content` (portaled, positioned `role="dialog"` surface). Use it for custom
 * popups such as filters or details; for a menu button use `Menu.Trigger` and `Menu.Popover`,
 * which add menu semantics and keyboard support.
 *
 * Controlled (`open`/`onOpenChange`) or uncontrolled (`defaultOpen`); `side`/`align` place the
 * content, and `ignoreOutsideRefs` lists external elements (such as a toggle button) whose presses
 * do not dismiss it.
 *
 * @example
 * <Popover>
 *   <Popover.Trigger><Button>Details</Button></Popover.Trigger>
 *   <Popover.Content title="Details">…</Popover.Content>
 * </Popover>
 */
export const Popover = /* @__PURE__ */ Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
});
