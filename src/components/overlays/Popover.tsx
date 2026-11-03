import * as React from 'react';
import { wcn } from '../../lib/cn';
import { popoverContentClassNames } from '../../lib/classNames';
import { isDev, reportMissingContext, warnOnce } from '../../lib/dev';
import { popupMotion } from '../../lib/motion';
import { slotRendersContent } from '../../lib/slot';
import { lockPositionStyle, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusElement, getFirstTabbable, isConnectedAndFocusable } from '../../lib/focus';
import { isInsideLayerTree, Z_INDEX } from '../../lib/layers';
import type {
  MotionSlot,
  OpenChangeDetails,
  PopupAlign,
  PopupPositioning,
  PopupSide,
  PopupTarget,
  PopupTargetInput,
} from '../../lib/types';
import { usePopupTarget } from '../../hooks/useResolvedTarget';
import { useId } from '../../hooks/useId';
import { useControllable } from '../../hooks/useControllable';
import { useContextMenuAnchor, type ContextMenuAnchor } from '../../hooks/useContextMenuAnchor';
import { useDismiss } from '../../hooks/useDismiss';
import { useFocusBeforeClose } from '../../hooks/useFocusBeforeClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useHoverIntent, type HoverIntent } from '../../hooks/useHoverIntent';
import { useMotionClasses } from '../../hooks/useMotion';
import { usePresence } from '../../hooks/usePresence';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { resolvePositioning, usePopupPosition } from '../../hooks/usePopupPosition';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useIsClient } from '../../hooks/useIsClient';
import {
  getTriggerFocusTarget,
  useTriggerElement,
  useTriggerFocusRef,
} from '../../hooks/useTriggerElement';
import { Portal } from '../portal/Portal';
import { getNativeEvent } from './Dialog.shared';
import {
  getTabbableThrough,
  isFocusInSurfaceTree,
  PopoverBeak,
  popoverAppearanceClasses,
  popoverScrollerClasses,
  popoverSizeClasses,
  usePopoverTabOrder,
  type PopoverAppearance,
  type PopoverPhysicalSide,
  type PopoverSize,
} from './Popover.shared';

export type { PopoverAppearance, PopoverSize } from './Popover.shared';

/**
 * Why a {@link Popover} asks to open or close: `trigger` (a click on `Popover.Trigger`), `hover`
 * (`openOnHover`), `context` (a context gesture, or a right click outside, with `openOnContext`),
 * `escape`, `outside-press`, `scroll` (`closeOnScroll`, or the scroll of a context popover's row)
 * and `parent-closed` (the Dialog, Drawer or popup it was opened from closed).
 */
export type PopoverOpenChangeReason =
  'trigger' | 'hover' | 'context' | 'escape' | 'outside-press' | 'scroll' | 'parent-closed';

/** The second argument of a {@link Popover}'s `onOpenChange`: the reason and the DOM event. */
export type PopoverOpenChangeDetails = OpenChangeDetails<PopoverOpenChangeReason>;

/** Properties for the Popover component. */
export interface PopoverProps {
  /**
   * Controlled open state of the popover. The content renders only in the browser: an open
   * popover is closed in the server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Default open state for uncontrolled usage. The content renders only in the browser: a
   * popover open by default is closed in the server HTML and opens once it has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called with the requested open state when it differs from the current one: a trigger click,
   * Escape and an outside press; the hover opening and closing of `openOnHover`; a scroll with
   * `closeOnScroll`; the close of the Dialog, Drawer or popup it was opened from; and, with
   * `openOnContext`, a context gesture (a right click, a macOS Ctrl+click, Shift+F10 or the
   * ContextMenu key), a right click outside, and a scroll that moves the row it opened at.
   *
   * The second argument says why (`details.reason`: `trigger`, `hover`, `context`, `escape`,
   * `outside-press`, `scroll` or `parent-closed`) and passes the DOM event behind the request
   * (`details.event`), so a controlled popover can refuse only some ways of closing. WaveUI
   * always passes it; it is typed optional so that a handler written before it keeps compiling
   * (a next major makes it required, as Dialog's is).
   */
  onOpenChange?: (open: boolean, details?: PopoverOpenChangeDetails) => void;
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
  /**
   * Open the popover when a mouse pointer rests on its trigger (a hover card), and close it once
   * the pointer has been off the trigger and the content for `closeDelay` while focus is not
   * inside the content. A popover opened by hover does not take focus, and its hover close leaves
   * focus where it is; a click on its trigger keeps it open and keeps focus where it is (a second
   * click closes it, as without hover). After Escape or an outside press it does not reopen until
   * the pointer has left the trigger. Touch and pen never open it by hover, and an `aria-disabled`
   * trigger never opens. A triangle between the trigger and the content keeps it open while the
   * pointer moves diagonally into it. Ignored with `openOnContext` (development warning).
   * @default false
   */
  openOnHover?: boolean;
  /**
   * Milliseconds a hovering mouse pointer rests on the trigger before the popover opens (mouse
   * hover only).
   * @default 250
   */
  openDelay?: number;
  /**
   * Milliseconds before a hover-opened popover closes once the mouse pointer has left it and its
   * trigger (Fluent's `mouseLeaveDelay`; mouse hover only).
   * @default 500
   */
  closeDelay?: number;
  /**
   * Make `Popover.Trigger` a context-menu region (a list, a row, a canvas): a right click (a
   * Ctrl+click on macOS, a long press where the browser reports one) opens the popover at the
   * pointer and leaves focus where it is (Tab from that element enters the content), and
   * Shift+F10 or the ContextMenu key opens it at the focused element inside the region and moves
   * focus into the content, instead of a click. Focus returns to the element that had it. The
   * browser's context menu is suppressed there and inside the content, except in text fields
   * inside the region, which keep it. A press elsewhere, a right click outside or a scroll that
   * moves the row it opened at (the one under the pointer, or the focused one), as a scroll of
   * the region's own content does, closes it. The trigger gets no `aria-haspopup`/`aria-expanded`
   * (it is not a popover button; with a render-prop child, do not spread them): name the content
   * with `title`, `aria-label` or `aria-labelledby`, and consider `aria-keyshortcuts="Shift+F10"`
   * on the region. iOS Safari reports no long press. `openOnHover` is ignored with it.
   * @default false
   */
  openOnContext?: boolean;
  /**
   * Where to place the content instead of next to `Popover.Trigger`: an element or a
   * `VirtualElement` (a rectangle, such as a point; an inline object is fine). With a controlled
   * `open`, a popover with a `target` needs no trigger; name it with `title`, `aria-label` or
   * `aria-labelledby`, and give a toggle button you use as the target `aria-haspopup="dialog"`,
   * `aria-expanded` and `aria-controls` yourself. A press on a target element does not close the
   * popover, and Tab from it enters the content when there is no trigger. Hold the element in
   * state, or pass a ref object (read after each render of the popover, so an element that attaches without it rendering is noticed on its next render). A popover
   * opened by `openOnContext` is placed at the gesture instead.
   */
  target?: PopupTargetInput;
  /**
   * Advanced positioning (Fluent's `positioning`): `offset` (px from the anchor), `fitViewport`
   * (limit the content to the space the viewport leaves; Fluent's `autoSize`), `matchReferenceWidth`,
   * `fallbackPlacements` (tried in order when the requested side has no room) and `target` (used
   * when the `target` prop is not set). `side` and `align` stay separate props.
   * @default `{ offset: 8 }`
   */
  positioning?: PopupPositioning;
  /**
   * Draws the beak, the small triangle that points at the trigger (or `target`). Pass `false` for
   * a surface without it; the beak slot (`slotProps.beak`) then renders nothing. Fluent's
   * `withArrow`, whose default is no arrow: WaveUI keeps drawing it by default.
   * @default true
   */
  withArrow?: boolean;
  /**
   * Traps focus in the content while it is open, like a dialog that leaves the page usable:
   * focus moves into the content when it opens (its first focusable element, else the content
   * itself) and Tab and Shift+Tab cycle inside it, toasts and popups opened from it included;
   * Escape and a press outside still close it. A hover-opened popover (`openOnHover`) takes no
   * trap until a click pins it. The page is not made `inert` and does not stop scrolling. Without
   * it, focus stays on the trigger when the popover opens and Tab enters the content from there
   * (WaveUI's design, popoversurface-3). Fluent's `trapFocus`.
   * @default false
   */
  trapFocus?: boolean;
  /**
   * Renders the content in place, as the next sibling of the element that renders `Popover.Content`
   * (position it where the trigger is: it is placed with the `absolute` strategy against its
   * nearest positioned ancestor), instead of in a portal at the end of the document. Use it
   * where the content must stay inside its container: a shadow root, a region that is
   * rotated or scaled, a tab order that must follow the DOM. The content still moves in and out
   * with its dismiss layer. Fluent's `inline`.
   * @default false
   */
  inline?: boolean;
  /**
   * Closes the popover when anything outside it scrolls (the page, or any scrollable container; a
   * scroll inside the content or inside a popup opened from it does not), reporting the reason
   * `scroll`. Fluent's `closeOnScroll`.
   * @default false
   */
  closeOnScroll?: boolean;
  /**
   * The look of the content: `neutral` (the page background with a border), `brand` (the brand
   * fill) or `inverted` (a dark surface in the light theme). Rendered as `data-appearance`.
   * Fluent's `appearance`, which has `brand` and `inverted` and a neutral default.
   * @default 'neutral'
   */
  appearance?: PopoverAppearance;
  /**
   * The padding of the content: `small` (12px), `medium` (16px) or `large` (20px). Rendered as
   * `data-size`. The width is 16rem; put a width in `className` for another. Fluent's `size`.
   * @default 'medium'
   */
  size?: PopoverSize;
  /** `Popover.Trigger` and `Popover.Content`. */
  children: React.ReactNode;
}

/**
 * Props the trigger puts on its element; a render-prop child of `Popover.Trigger` receives them
 * (spread them onto the element that opens the popover). With `openOnContext` the element is a
 * context-menu region, not a popover button: do not spread `aria-haspopup`, `aria-expanded` and
 * `aria-controls` onto it (`aria-expanded` is then always `false`, `aria-controls` is absent and
 * `onClick` does nothing); spread ones are removed after each commit, with a development warning.
 */
export type PopoverTriggerChildProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  id: string;
  /**
   * `dialog`; the render function receives `undefined` for it, and an element none, while
   * `Popover.Content` has the role `group` or `region`, which no `aria-haspopup` value describes.
   */
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  /** The content's id, only while the popover is open (never with `openOnContext`). */
  'aria-controls': string | undefined;
  onClick: React.MouseEventHandler<HTMLElement>;
  /**
   * Moves Tab from the open trigger into the portaled content (which lives at the end of the
   * document), so the keyboard order follows the trigger.
   */
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
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
   * instead of merging them onto the child. `aria-haspopup`, `aria-expanded` and `aria-controls`,
   * which a generic element cannot carry, go to the first element in the tab order inside the
   * span. A render-prop child ignores `asChild` and receives every prop.
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
   * `aria-label` or `aria-labelledby`, the popover is labelled by its trigger, except with
   * `openOnContext` (a region's text is no name), where it needs one of them.
   */
  title?: React.ReactNode;
  /** Id of the surface; the trigger's `aria-controls` follows it. Defaults to a generated id. */
  id?: string;
  /**
   * The surface's role, `dialog` by default (a `role` you pass wins, as before). Pass `group` for a
   * popover that only presents content, a hover card or a list of details, which a dialog
   * would over-announce; `alertdialog` for one that interrupts. While it is `group` or
   * `region` the trigger carries no `aria-haspopup`, which has no value for such a role.
   * Name a `group` with `title`, `aria-label` or `aria-labelledby`. Fluent's `PopoverSurface`
   * role, which is `group` unless `trapFocus` is set.
   * @default 'dialog'
   */
  role?: React.AriaRole;
  /**
   * The popover's motion. By default it fades in and slides 4px away from its trigger, on the
   * side it opened on, over 200 ms with a decelerating curve, and fades out and slides back over
   * 100 ms with an accelerating curve; under reduced motion it appears and disappears at once.
   * `null` turns the motion off (the surface still renders its `data-presence` phases, which then
   * end at once); a class string or `{ className }` replaces the default classes with yours (see
   * `MotionSlot`), also under a `WaveProvider` with `motion="none"`, which otherwise turns the
   * default off. Fluent's `Popover` `surfaceMotion`.
   * @default the fade and slide above
   */
  motion?: MotionSlot | null;
  /** Ref to the popover surface. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the elements the surface draws besides your content, by part, merged into each
   * part's own: your classes after the part's (yours win a conflict), your styles over its
   * styles, your attributes and handlers added, your ref beside its ref. Every attribute the
   * popover sets on a part is locked and keeps the popover's value; you add the attributes it
   * does not set. A part takes no `children`. No part carries a handler of the popover: yours
   * run as those of the content do, before the popover's own handling of the event, which
   * `preventDefault()` in yours skips as it does in the content (an Escape you prevent keeps the
   * popover open). The surface takes the Content's own props. Fluent UI has no such parts: its
   * `PopoverSurface` draws the beak only with `withArrow`, and has no title.
   */
  slotProps?: {
    /**
     * The `<div>` of the beak, the rotated square on the edge that faces the trigger (stable
     * class `wave-popover-content__beak`). The positioning places it, and your ref is attached
     * beside the popover's. Locked: `aria-hidden` (it is a drawing), `tabIndex` (unset: a drawing
     * is never a tab stop), its marker `data-wave-popover-arrow`, and the keys of its style that
     * the positioning sets (`position`, `left`, `top` and the offset of the edge it sits on),
     * which win over yours.
     */
    beak?: SlotPart<'div'>;
    /**
     * The `<h2>` heading of `title`, rendered while `title` renders content (stable class
     * `wave-popover-content__title`). Locked: `id`, which the surface's `aria-labelledby` names
     * (unless you pass `aria-label` or `aria-labelledby`).
     */
    title?: SlotPart<'h2'>;
  };
}

interface PopoverContextValue {
  open: boolean;
  setOpen: (
    next: boolean | ((current: boolean) => boolean),
    details: PopoverOpenChangeDetails,
  ) => void;
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
  /** The trigger's click: toggles the popover, or pins one that hover opened (keeps it open). */
  onTriggerClick: (event?: unknown) => void;
  /** Tab from the open trigger enters the portaled content. */
  onTriggerKeyDown: React.KeyboardEventHandler<HTMLElement>;
  /** Hover opening (`openOnHover`): composed onto the trigger; `null` without it. */
  hoverTriggerHandlers: HoverIntent['triggerHandlers'] | null;
  /** Hover opening (`openOnHover`): composed onto the content; `null` without it. */
  hoverSurfaceHandlers: HoverIntent['surfaceHandlers'] | null;
  /** `openOnContext`: the trigger is a context-menu region, not a popover button. */
  contextMode: boolean;
  /** Context gestures (`openOnContext`): composed onto the trigger; `null` without it. */
  contextTriggerHandlers: ContextMenuAnchor['triggerHandlers'] | null;
  /** Composed onto the content: suppresses the browser's context menu there in context mode. */
  onContentContextMenu: React.MouseEventHandler<HTMLElement>;
  /** Opened by a keyboard context gesture: the content takes focus (itself when nothing can). */
  keyboardContext: boolean;
  /** Tab past the content's edges continues around the trigger in the page order. */
  onContentKeyDown: React.KeyboardEventHandler<HTMLElement>;
  layerId: string;
  floatingProps: { 'data-side': string; 'data-align': string; style: React.CSSProperties };
  arrowStyles: React.CSSProperties;
  placedSide: PopoverPhysicalSide;
  /** `positioning.fitViewport`: the content scrolls inside the border when it is limited. */
  fitViewport: boolean;
  /** `withArrow`: whether the beak is drawn. */
  withArrow: boolean;
  /** `inline`: the content renders in place instead of a portal. */
  inline: boolean;
  /** `trapFocus` (and not hover-opened): focus is trapped in the content while it is open. */
  trapped: boolean;
  appearance: PopoverAppearance;
  size: PopoverSize;
  /** The role the content reports, `undefined` until it has mounted (read as `dialog`). */
  contentRole: string | undefined;
  /** `Popover.Content` reports its role so the trigger's `aria-haspopup` follows it. */
  setContentRole: (role: string | undefined) => void;
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
    onTriggerClick: () => {},
    onTriggerKeyDown: () => {},
    hoverTriggerHandlers: null,
    hoverSurfaceHandlers: null,
    contextMode: false,
    contextTriggerHandlers: null,
    onContentContextMenu: () => {},
    keyboardContext: false,
    onContentKeyDown: () => {},
    layerId: 'wave-popover-inert-layer',
    floatingProps: { 'data-side': 'bottom', 'data-align': 'start', style: {} },
    arrowStyles: {},
    placedSide: 'bottom',
    fitViewport: false,
    withArrow: true,
    inline: false,
    trapped: false,
    appearance: 'neutral',
    size: 'medium',
    contentRole: undefined,
    setContentRole: () => {},
  };
  return inertContext;
}

function usePopoverContext(componentName: string): PopoverContextValue {
  const context = React.useContext(PopoverContext);
  if (context) return context;
  reportMissingContext(componentName, 'Popover');
  return getInertContext();
}

/** The ids of an id list that exist in `doc`, joined; `undefined` when none does. */
function presentIds(doc: Document, ids: string | null): string | undefined {
  const present = (ids ?? '').split(/\s+/).filter((id) => id && doc.getElementById(id));
  return present.length > 0 ? present.join(' ') : undefined;
}

/**
 * The ids `Popover.Content`'s default `aria-labelledby` points at, so the popover gets its
 * trigger's name. The named element is the one with the resolved id when the document has it,
 * otherwise the trigger's focus target (for example the Button inside a Tooltip that sits between
 * `Popover.Trigger` and the Button, whose own id wins), else the trigger element. When that
 * element is itself named through `aria-labelledby` (an icon-only Button inside
 * `Tooltip relationship="label"`, or a button labelled by a visible label), its label ids are
 * returned: a name computation does not follow a second `aria-labelledby` hop, so pointing at the
 * button would leave the popover unnamed. Otherwise the element's id, else the trigger's own.
 * `undefined` when none of them has an id (a render-prop child that does not spread `id`), so the
 * reference never dangles; only ids present in the document are returned. Before the trigger
 * element is known, the resolved id.
 */
function findTriggerLabelId(
  trigger: HTMLElement | null,
  resolvedId: string | undefined,
): string | undefined {
  if (!trigger) return resolvedId;
  const doc = trigger.ownerDocument;
  const named =
    (resolvedId ? doc.getElementById(resolvedId) : null) ??
    getTriggerFocusTarget(trigger) ??
    trigger;
  return (
    presentIds(doc, named.getAttribute('aria-labelledby')) ?? (named.id || trigger.id || undefined)
  );
}

/**
 * Whether one of the elements an id list references has text for a name: its own `aria-label`
 * or text, or a descendant's `aria-label`, `alt` or `title`. Deliberately lenient (it only drives
 * a development warning): content that assistive technology ignores still counts as text.
 */
function referencesText(doc: Document, ids: string): boolean {
  return ids.split(/\s+/).some((id) => {
    const el = id ? doc.getElementById(id) : null;
    if (!el) return false;
    if (el.getAttribute('aria-label')?.trim() || el.textContent?.trim()) return true;
    return !!el.querySelector(
      '[aria-label]:not([aria-label=""]), [alt]:not([alt=""]), [title]:not([title=""])',
    );
  });
}

const subscribeNothing = (): (() => void) => () => {};

/** Why an open popover opened: hover (it closes by hover), or anything else (it is pinned). */
type OpenReason = 'hover' | 'other';

/** Whether a `target` is an element rather than a VirtualElement (duck typed, any realm). */
function isElementTarget(target: PopupTarget | undefined): target is HTMLElement {
  return !!target && typeof (target as Partial<Node>).nodeType === 'number';
}

/** A read-only ref whose `current` is `resolve()` at the time it is read (event time). */
function createResolvedRef(resolve: () => HTMLElement | null): React.RefObject<HTMLElement | null> {
  return {
    get current() {
      return resolve();
    },
  };
}

/**
 * The content's previous stop: the focus target of the element it follows (the trigger, the row of
 * a context gesture, a `target` element), else the tab stop before that element.
 */
function getPopoverPreviousStop(
  anchor: HTMLElement,
  surface: HTMLElement,
  order?: readonly HTMLElement[],
): HTMLElement | null {
  return getTriggerFocusTarget(anchor) ?? getTabbableThrough(anchor, surface, order);
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
  openOnHover = false,
  openDelay = 250,
  closeDelay = 500,
  openOnContext = false,
  target: targetProp,
  positioning,
  withArrow = true,
  trapFocus = false,
  inline = false,
  closeOnScroll = false,
  appearance = 'neutral',
  size = 'medium',
  children,
}: PopoverProps) => {
  const { target, pending: targetPending } = usePopupTarget('Popover', targetProp, positioning);
  // Every internal path asks through `setOpenWith(next, details)`, which writes `details` to a ref,
  // calls the setter and clears the ref once the setter returns (as `useModalOpenState` does):
  // `useControllable` calls its `onChange` synchronously inside the setter, only when the value
  // changes, and that `onChange` passes the ref's details on as `onOpenChange(next, details)`.
  const detailsRef = React.useRef<PopoverOpenChangeDetails | undefined>(undefined);
  const [openState, setOpen] = useControllable(openProp, defaultOpen ?? false, (next: boolean) =>
    onOpenChange?.(next, detailsRef.current),
  );
  const setOpenWith = useEventCallback(
    (next: boolean | ((current: boolean) => boolean), details: PopoverOpenChangeDetails) => {
      detailsRef.current = details;
      try {
        setOpen(next);
      } finally {
        detailsRef.current = undefined;
      }
    },
  );
  // A hover close in flight (written in handlers, read when the popover closes): set when the hover
  // intent asks to close, so that close moves no focus even when a controlled parent applies it in
  // a later render (a transition). Every other request to open or close forgets it, and so does
  // the next opening.
  const hoverCloseRef = React.useRef(false);
  const requestOpen = useEventCallback(
    (next: boolean | ((current: boolean) => boolean), details: PopoverOpenChangeDetails) => {
      hoverCloseRef.current = false;
      setOpenWith(next, details);
    },
  );
  const isHoverClose = React.useCallback(() => hoverCloseRef.current, []);
  // The content lives in a portal, which renders only in the browser: until then (the server
  // HTML, hydration) the popover reports itself closed, so the trigger's aria-expanded and
  // aria-controls never describe content that is not there.
  const isClient = useIsClient();
  const open = openState && isClient;

  // Why the popover opened, decided when it opens (C-HOOKS: a previous-value state): `hover` when
  // hover asked for that open (a request consumed by the next render, so an open that a
  // controlled parent refused does not linger), else `other` (click, keys, a context gesture, a
  // controlled open).
  const [openReason, setOpenReason] = React.useState<OpenReason>('other');
  const [hoverRequested, setHoverRequested] = React.useState(false);
  const [previousOpen, setPreviousOpen] = React.useState(open);
  let reason = openReason;
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) reason = hoverRequested ? 'hover' : 'other';
  }
  if (reason !== openReason) setOpenReason(reason);
  if (hoverRequested) setHoverRequested(false);

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
  // A `target` element (not a VirtualElement) belongs to the dismiss layer, anchors the keyboard
  // order without a trigger and can take focus back.
  const targetElement = isElementTarget(target) ? target : null;
  const targetRef = React.useRef<HTMLElement | null>(null);
  React.useInsertionEffect(() => {
    targetRef.current = targetElement;
  }, [targetElement]);

  // Destructured: react-hooks/refs treats an object whose member is passed to `ref` as a ref.
  const {
    setReference,
    setFloating,
    floatingProps: positionedProps,
    arrowStyles,
    side: placedSide,
  } = usePopupPosition({
    open,
    side,
    align,
    arrowRef: withArrow ? arrowRef : undefined,
    // An inline surface is positioned against its nearest positioned ancestor, as it lies in place.
    strategy: inline ? 'absolute' : undefined,
    ...resolvePositioning(positioning, { offset: 8 }),
  });
  // A ref target that holds no element yet keeps the popup hidden (as TeachingPopover's is).
  const floatingProps = React.useMemo(
    () =>
      targetPending
        ? { ...positionedProps, style: { ...positionedProps.style, visibility: 'hidden' as const } }
        : positionedProps,
    [targetPending, positionedProps],
  );

  // The one focus resolver: the focus-return fallback and the layer's anchor (where a surface
  // opened from the content restores focus once its opener is gone). In context mode the element
  // focused at the gesture (the row) first; then the trigger's focus target (for a wrapper span,
  // the element inside it that carries the state ARIA), a focusable `target` element, and the
  // trigger itself. The context hook's opener ref is stable; it is filled in once the hook runs.
  const contextOpenerRef = React.useRef<React.RefObject<HTMLElement | null> | null>(null);
  const resolveFocusTarget = useEventCallback((): HTMLElement | null => {
    const gestureOpener = openOnContext ? contextOpenerRef.current?.current : null;
    if (gestureOpener && isConnectedAndFocusable(gestureOpener)) return gestureOpener;
    const trigger = triggerRef.current;
    const triggerTarget = trigger ? getTriggerFocusTarget(trigger) : null;
    if (triggerTarget) return triggerTarget;
    const targetEl = targetRef.current;
    if (targetEl && isConnectedAndFocusable(targetEl)) return targetEl;
    return trigger;
  });
  const focusTargetRef = React.useMemo(
    () => createResolvedRef(resolveFocusTarget),
    [resolveFocusTarget],
  );

  // In context mode the region is no part of the layer: a primary press elsewhere in it closes the
  // popover like any outside press. A Ctrl+press inside it is a macOS context click, whose
  // `contextmenu` moves the popover instead.
  const isOutsidePress = useEventCallback(
    (event: PointerEvent | MouseEvent) =>
      !(event.ctrlKey && triggerRef.current?.contains(event.target as Node)),
  );
  const { layerId } = useDismiss({
    open,
    onDismiss: (why, event) =>
      // `focus-outside` never reaches this layer (it does not ask for it).
      requestOpen(false, { reason: why === 'focus-outside' ? 'outside-press' : why, event }),
    refs: openOnContext
      ? [surfaceRef, targetRef, ...(ignoreOutsideRefs ?? [])]
      : [surfaceRef, triggerRef, targetRef, ...(ignoreOutsideRefs ?? [])],
    anchorRef: focusTargetRef,
    kind: 'popover',
    outsidePress: openOnContext ? isOutsidePress : true,
  });

  // A keyboard context gesture moves focus into the content, once it is there (see below).
  const focusContentRef = React.useRef(false);
  const {
    anchor: contextAnchor,
    fromContext,
    origin: contextOrigin,
    opener: contextOpener,
    triggerHandlers: contextTriggerHandlers,
    surfaceHandlers: contextSurfaceHandlers,
  } = useContextMenuAnchor({
    enabled: openOnContext,
    open,
    trigger: triggerElement,
    layerId,
    onOpen: (origin, event) => {
      focusContentRef.current = origin === 'keyboard';
      requestOpen(true, { reason: 'context', event });
    },
    onClose: (why, event) =>
      requestOpen(false, { reason: why === 'scroll' ? 'scroll' : 'context', event }),
  });
  React.useInsertionEffect(() => {
    contextOpenerRef.current = contextOpener;
  }, [contextOpener]);

  // Focus returns to the element that takes focus for the trigger, as Shift+Tab from the content
  // does, when the popover closes while focus is inside it or on `<body>`; a hover close restores
  // only focus inside, so it never moves focus. In context mode it returns to the element focused
  // at the gesture (the row): the region is no restore target of its own (as `triggerRef` it
  // would be taken for the opener).
  const triggerFocusRef = useTriggerFocusRef(triggerRef);
  useRestoreFocus({
    enabled: open,
    container: surface,
    triggerRef: openOnContext ? undefined : triggerFocusRef,
    finalFocusRef: openOnContext ? contextOpener : undefined,
    fallback: resolveFocusTarget,
    onlyIfFocusInside: true,
    isHoverClose,
  });
  // Focus before close, on every close: the content stays mounted while it exits, so when the
  // popover closes with focus inside it, focus moves in the closing commit to where
  // useRestoreFocus would put it, in its order: the element focused at the gesture (context mode),
  // the element focused when the popover opened (the trigger's focus target first, but not in
  // context mode, whose region is no opener), then the focus resolver. A Dialog opened by a button
  // of the content as it closes then records that element as its opener, not the button, which
  // the exiting surface still holds. A hover close finds no focus inside (focus there blocks it),
  // and unmounting is left to useRestoreFocus.
  useFocusBeforeClose({
    open,
    surfaceRef,
    captureOpener: () => (openOnContext ? null : triggerFocusRef.current),
    candidates: (opener) => [
      openOnContext ? contextOpener.current : null,
      opener,
      resolveFocusTarget(),
    ],
  });
  React.useLayoutEffect(() => {
    if (open) hoverCloseRef.current = false;
  }, [open]);

  const triggerElementRef = useMergedRefs<HTMLElement>(triggerRef, setTriggerElement);
  const surfaceElementRef = useMergedRefs<HTMLElement>(surfaceRef, setSurface, setFloating);

  // The positioning anchor: the context gesture (the pointer, or the focused row, else the
  // trigger's focus target, else the trigger) while the popover was opened by one, else `target`,
  // else the trigger. A new VirtualElement on every render repositions without a render loop.
  React.useLayoutEffect(() => {
    if (fromContext) {
      setReference(
        contextAnchor ??
          (triggerElement && (getTriggerFocusTarget(triggerElement) ?? triggerElement)),
      );
    } else {
      setReference(target ?? triggerElement);
    }
  }, [contextAnchor, fromContext, target, triggerElement, setReference]);

  // After the commit that has the surface (and after a gesture while open): focus its first
  // tabbable element, else the surface itself (it then has `tabIndex={-1}`). A gesture whose open
  // was refused leaves nothing pending. No deps: every commit, since a gesture always renders.
  React.useLayoutEffect(() => {
    if (!focusContentRef.current) return;
    if (!open) {
      focusContentRef.current = false;
      return;
    }
    if (!surface) return;
    focusContentRef.current = false;
    focusElement(getFirstTabbable(surface) ?? surface, { preventScroll: true });
  });

  React.useEffect(() => {
    if (!openOnHover || !openOnContext) return;
    warnOnce(
      'Popover:hover-and-context',
      'Popover: `openOnHover` is ignored with `openOnContext`: a context popover opens on a right click, Shift+F10 or the ContextMenu key, not on hover.',
    );
  }, [openOnHover, openOnContext]);

  // Hover opening: a popover that hover opened closes by hover until a click on the trigger pins
  // it; focus inside the content (or a layer opened from it) keeps it open, focus on the trigger
  // does not.
  const hoverEnabled = openOnHover && !openOnContext;
  const canHoverClose = useEventCallback(
    () => reason === 'hover' && !isFocusInSurfaceTree(surfaceRef.current, layerId),
  );
  const {
    triggerHandlers: hoverTriggerHandlers,
    surfaceHandlers: hoverSurfaceHandlers,
    cancel: cancelHover,
  } = useHoverIntent({
    enabled: hoverEnabled,
    open,
    openDelay,
    closeDelay,
    trigger: triggerElement,
    surface,
    onOpen: (event) => {
      setHoverRequested(true);
      requestOpen(true, { reason: 'hover', event });
    },
    onClose: (event) => {
      // Before the request: a parent may apply it synchronously (flushSync).
      hoverCloseRef.current = true;
      setOpenWith(false, { reason: 'hover', event });
    },
    canClose: canHoverClose,
  });

  const onTriggerClick = useEventCallback((event?: unknown) => {
    cancelHover();
    if (open && reason === 'hover') setOpenReason('other');
    else requestOpen((current) => !current, { reason: 'trigger', event: getNativeEvent(event) });
  });

  // `closeOnScroll`: a scroll anywhere outside the content (and the popups opened from it) closes
  // it. The scroll event does not bubble, so the capture phase of the document sees every scroller.
  const onDocumentScroll = useEventCallback((event: Event) => {
    const scrolled = event.target;
    const inside =
      scrolled instanceof Node &&
      (!!surfaceRef.current?.contains(scrolled) || isInsideLayerTree(layerId, scrolled));
    if (!inside) requestOpen(false, { reason: 'scroll', event });
  });
  React.useEffect(() => {
    if (!open || !closeOnScroll) return;
    const doc = (surfaceRef.current ?? triggerRef.current)?.ownerDocument ?? document;
    doc.addEventListener('scroll', onDocumentScroll, true);
    return () => doc.removeEventListener('scroll', onDocumentScroll, true);
  }, [open, closeOnScroll, onDocumentScroll]);

  // `trapFocus`: focus moves into the content and cycles in it while it is open, but not while a
  // hover opened it (a hover card takes no focus until a click pins it).
  const trapped = trapFocus && reason !== 'hover';
  useFocusTrap(surface, { enabled: open && trapped, layerId });

  // The element the content follows in the keyboard order: in context mode the element focused
  // at the gesture when it lies inside the region, else the trigger, else a `target` element.
  // With neither (a VirtualElement target and no trigger) the content keeps the portal's place.
  const resolveTabAnchor = useEventCallback((): HTMLElement | null => {
    const trigger = triggerRef.current;
    const gestureOpener = openOnContext ? contextOpener.current : null;
    if (gestureOpener && trigger?.contains(gestureOpener)) return gestureOpener;
    return trigger ?? targetRef.current;
  });
  const tabAnchorRef = React.useMemo(() => createResolvedRef(resolveTabAnchor), [resolveTabAnchor]);

  // Keyboard order of the portaled content (it lives at the end of the document), as if it
  // followed the trigger like 0.4's inline content: Tab from the open trigger enters it (here, in
  // the trigger's own `onKeyDown`, which runs before a dialog's focus trap), Tab past its last
  // element continues after the trigger, Shift+Tab from its first element returns to the trigger
  // (the element inside a wrapper span), and Shift+Tab from the element after the trigger enters
  // it at its last element. The end of the page does not visit it a second time where its portal
  // is, and no Tab cycle forms (see usePopoverTabOrder). In a context region only Tab from the
  // element the content follows enters it; Tab on the region's other rows moves on as usual.
  const onTriggerKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    // A trapped or inline popover takes no part in this order: focus is already inside it, or the
    // content lies in the DOM where the browser's own order finds it.
    if (event.key !== 'Tab' || event.shiftKey || !open || trapped || inline) return;
    if (openOnContext) {
      const anchor = resolveTabAnchor();
      if (!anchor || event.target !== (getTriggerFocusTarget(anchor) ?? anchor)) return;
    }
    const surfaceElement = surfaceRef.current;
    const first = surfaceElement ? getFirstTabbable(surfaceElement) : null;
    if (!first) return;
    event.preventDefault();
    first.focus();
  });

  const onContentKeyDown = usePopoverTabOrder({
    enabled: open && !trapped && !inline,
    surface,
    anchorRef: tabAnchorRef,
    // Shift+Tab from the content's first element returns to the trigger (the element in a span),
    // or, when nothing in the trigger can take focus, to the tab stop before it.
    getPreviousStop: getPopoverPreviousStop,
  });

  const keyboardContext = fromContext && contextOrigin === 'keyboard';
  const [contentRole, setContentRole] = React.useState<string | undefined>(undefined);
  const context = React.useMemo<PopoverContextValue>(
    () => ({
      open,
      setOpen: requestOpen,
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
      onTriggerClick,
      onTriggerKeyDown,
      hoverTriggerHandlers: hoverEnabled ? hoverTriggerHandlers : null,
      hoverSurfaceHandlers: hoverEnabled ? hoverSurfaceHandlers : null,
      contextMode: openOnContext,
      contextTriggerHandlers: openOnContext ? contextTriggerHandlers : null,
      onContentContextMenu: contextSurfaceHandlers.onContextMenu,
      keyboardContext,
      onContentKeyDown,
      layerId,
      floatingProps,
      arrowStyles,
      placedSide,
      fitViewport: positioning?.fitViewport === true,
      withArrow,
      inline,
      trapped,
      appearance,
      size,
      contentRole,
      setContentRole,
    }),
    [
      open,
      requestOpen,
      contentId,
      triggerId,
      resolvedTriggerId,
      triggerElement,
      triggerElementRef,
      surfaceElementRef,
      onTriggerClick,
      onTriggerKeyDown,
      hoverEnabled,
      hoverTriggerHandlers,
      hoverSurfaceHandlers,
      openOnContext,
      contextTriggerHandlers,
      contextSurfaceHandlers,
      keyboardContext,
      onContentKeyDown,
      layerId,
      floatingProps,
      arrowStyles,
      placedSide,
      positioning?.fitViewport,
      withArrow,
      inline,
      trapped,
      appearance,
      size,
      contentRole,
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
 * named by it); `asChild={false}` renders the 0.4 wrapper span, and a custom child that neither
 * forwards `ref` nor spreads its props falls back to that span automatically (with a development
 * warning). On the span, the state ARIA goes to the first element in the tab order inside it, and
 * focus returns to that element (to the span when you made it the trigger with a `role` such as
 * `button` and `tabIndex={0}`, or when nothing inside it can take focus).
 *
 * With `openOnHover` a mouse pointer resting on it opens the popover, and a click pins a
 * hover-opened popover instead of closing it. With `openOnContext` it is a context-menu region (a
 * list, a row, a canvas) instead of a button: it receives its `id` and the context-menu and key
 * handlers, but no state ARIA and no click toggle (a render function still receives every prop:
 * do not spread the state ARIA then).
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
  onContextMenu,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  ref,
  ...rest
}: PopoverTriggerProps) => {
  const {
    open,
    contentId,
    triggerId,
    triggerElementRef,
    setResolvedTriggerId,
    onTriggerClick,
    onTriggerKeyDown,
    hoverTriggerHandlers: hover,
    contextMode,
    contextTriggerHandlers: gesture,
    contentRole,
  } = usePopoverContext('Popover.Trigger');
  const elementRef = useMergedRefs<HTMLElement>(ref, triggerElementRef);

  // On a wrapper span (`asChild={false}`, the automatic fallback) useTriggerElement moves the
  // state ARIA onto the first element in the tab order inside it. The hover handlers are there
  // only with `openOnHover`, the context handlers only with `openOnContext`. A context region is
  // no popover button: it gets no state ARIA and no click toggle (useTriggerElement
  // `omitStateAria`), and a render-prop child reads a constant closed state.
  const triggerProps = {
    ...rest,
    id: idProp ?? triggerId,
    // A content with another role than a dialog (a `group`) has no `aria-haspopup` value.
    'aria-haspopup':
      contentRole === 'group' || contentRole === 'region' ? undefined : ('dialog' as const),
    'aria-expanded': contextMode ? false : open,
    'aria-controls': open && !contextMode ? contentId : undefined,
    onClick: composeEventHandlers(onClick, contextMode ? undefined : onTriggerClick),
    onKeyDown: composeEventHandlers(
      onKeyDown,
      gesture ? composeEventHandlers(gesture.onKeyDown, onTriggerKeyDown) : onTriggerKeyDown,
    ),
    onContextMenu: gesture
      ? composeEventHandlers(onContextMenu, gesture.onContextMenu)
      : onContextMenu,
    onPointerEnter: hover
      ? composeEventHandlers(onPointerEnter, hover.onPointerEnter)
      : onPointerEnter,
    onPointerMove: hover ? composeEventHandlers(onPointerMove, hover.onPointerMove) : onPointerMove,
    onPointerLeave: hover
      ? composeEventHandlers(onPointerLeave, hover.onPointerLeave)
      : onPointerLeave,
    ref: elementRef,
  } as PopoverTriggerChildProps;

  return useTriggerElement(children, triggerProps, {
    componentName: 'Popover.Trigger',
    asChild,
    onResolvedId: setResolvedTriggerId,
    omitStateAria: contextMode,
  });
};
PopoverTrigger.displayName = 'PopoverTrigger';

/**
 * The popover surface: a non-modal `role="dialog"` rendered in a portal (so overflow containers
 * never clip it) and positioned next to the trigger with a beak, flipping and shifting to stay in
 * the viewport. It closes on Escape and on a press outside (presses inside nested overlays opened
 * from it count as inside), and focus returns to the trigger when it closes while focus was inside.
 * In the keyboard order it follows the trigger, like inline content: Tab from the open trigger
 * enters it, Tab past its last element continues after the trigger, and Shift+Tab from the element
 * after the trigger enters it at its last element. Tab from the last element of the page moves
 * past it, and Shift+Tab from outside the page reaches the page's last element first, so a lap
 * visits it once. For a trigger outside the tab order (nothing in it can take focus, or
 * `tabIndex={-1}`), Tab from the tab stop before the trigger enters it, and Shift+Tab from its
 * first element returns to the trigger, or to that tab stop when nothing in the trigger can take
 * focus. With no tab stop before the trigger, the content is reached at the end of the page.
 * Named by `title`, `aria-label`/`aria-labelledby`, or else by its trigger: `aria-labelledby`
 * points at the id the trigger element carries in the document, or at the trigger's own label
 * elements when the trigger is named through `aria-labelledby` (an icon-only Button inside
 * `Tooltip relationship="label"`); never at a missing id. A development warning names the problem
 * when the trigger has no id or no text. With `openOnContext` it is never named by the trigger (a
 * region's text is no name): pass `title`, `aria-label` or `aria-labelledby` (a development
 * warning otherwise). A consumer `id` is kept, and the trigger's `aria-controls` follows it. The
 * beak inherits the surface's background and border colors, so a `className` that changes them
 * restyles the beak too.
 *
 * With `openOnContext` it opens at the pointer of a right click, or at the focused row for
 * Shift+F10 and the ContextMenu key, and it follows that row in the keyboard order; with a
 * `target` it is placed at the target and, without a trigger, follows a target element in the
 * keyboard order.
 *
 * It moves in and out: the surface fades in and slides 4px away from its trigger over 200 ms, and
 * fades out and slides back over 100 ms, on the side it opened on (`data-side`); a popover open by
 * default animates in when it mounts in the browser. Under reduced motion it appears and
 * disappears at once. `motion` turns the motion off (`null`) or replaces its classes, and a
 * `WaveProvider` with `motion="none"` turns the default off. The surface mounts through the
 * presence core (`usePresence`): it carries `data-presence="entering" | "entered" | "exiting"` and
 * `data-state="open"`, and while it closes `data-state="closed"` and `inert`, so it stays on
 * screen, where it was, until its exit motion ends. Focus, the dismiss layer, the trigger's
 * `aria-expanded` and `aria-controls`, and positioning follow the open state, not the exit: focus
 * inside a closing popover moves, in the commit that closes it, to where the popover returns
 * focus (so a Dialog opened by a button of the popover as it closes returns focus there too, not
 * to that button), and a hover close moves no focus. Without motion it unmounts as soon as it
 * closes.
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
  onContextMenu,
  onPointerEnter,
  onPointerLeave,
  motion,
  role = 'dialog',
  ref,
  slotProps,
  ...rest
}: PopoverContentProps) => {
  const {
    open,
    contentId,
    setCustomContentId,
    setContentRole,
    withArrow,
    inline,
    trapped,
    appearance,
    size,
    resolvedTriggerId,
    triggerRef,
    triggerElement,
    surfaceElementRef,
    arrowRef,
    layerId,
    floatingProps,
    arrowStyles,
    placedSide,
    fitViewport,
    onContentKeyDown,
    hoverSurfaceHandlers: hover,
    contextMode,
    onContentContextMenu,
    keyboardContext,
  } = usePopoverContext('Popover.Content');
  const titleId = useId('popover-title');
  // The surface mounts and unmounts through the presence core, and enters also when it mounts open
  // (a popover open by default animates in on a client render as after hydration); the root keys
  // everything else on `open`, so focus moves out and the layer goes on close, not after the exit.
  const { isMounted, ref: presenceRef, presenceProps } = usePresence(open, { appear: true });
  const motionClassName = useMotionClasses(motion, popupMotion);
  const elementRef = useMergedRefs<HTMLDivElement>(ref, surfaceElementRef, presenceRef);
  // The positioning measures the beak: a part's ref goes beside its ref, never in its place.
  const beakRef = useMergedRefs<HTMLDivElement>(arrowRef, slotProps?.beak?.ref);
  const hasTitle = slotRendersContent(title);
  const unnamed = ariaLabelledBy === undefined && !ariaLabel && !hasTitle;
  // A context region is no popover button, and its whole text is no name: in context mode the
  // content is never labelled by the trigger.
  const checkTrigger = open && unnamed && !contextMode;

  // The trigger's label ids in the document, re-read when the trigger's ids or labels change: a
  // Tooltip between Popover.Trigger and the Button leaves the Button's own id in place (and with
  // `relationship="label"` names it through `aria-labelledby`), and a render-prop child may not
  // spread `id` at all — never point aria-labelledby at an id that is not there.
  const subscribeTrigger = React.useCallback(
    (onChange: () => void) => {
      if (!checkTrigger || !triggerElement || typeof MutationObserver === 'undefined') {
        return subscribeNothing();
      }
      const observer = new MutationObserver(onChange);
      observer.observe(triggerElement, {
        attributes: true,
        attributeFilter: ['id', 'aria-labelledby'],
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
  // And the role, so the trigger's `aria-haspopup` follows it.
  React.useEffect(() => {
    setContentRole(role);
    return () => setContentRole(undefined);
  }, [role, setContentRole]);

  React.useEffect(() => {
    if (!open || !unnamed || !contextMode || !isDev) return;
    warnOnce(
      'Popover.Content:name',
      'Popover.Content: the popover has no accessible name. A context popover (openOnContext) is not named by its region: pass `title`, `aria-label` or `aria-labelledby`.',
    );
  }, [open, unnamed, contextMode]);

  React.useEffect(() => {
    if (!checkTrigger || !isDev) return;
    // Read after commit: a trigger's ref is attached by now even before it reported its id.
    const trigger = triggerRef.current;
    if (!trigger) {
      warnOnce(
        'Popover.Content:name',
        'Popover.Content: the popover has no accessible name. Pass `title`, `aria-label` or `aria-labelledby`, or open it from a Popover.Trigger.',
      );
      return;
    }
    const labelIds = findTriggerLabelId(trigger, resolvedTriggerId);
    if (!labelIds) {
      warnOnce(
        'Popover.Content:trigger-id',
        'Popover.Content: the popover is named by its trigger, but the trigger element has no `id` (a render-prop child of Popover.Trigger must spread the `id` it receives), so the popover has no accessible name. Spread every trigger prop onto the element, or pass `title`, `aria-label` or `aria-labelledby`.',
      );
    } else if (!referencesText(trigger.ownerDocument, labelIds)) {
      warnOnce(
        'Popover.Content:trigger-name',
        'Popover.Content: the popover is named by its trigger, but the trigger has no text to name it (an icon-only trigger needs `aria-label`, or `aria-labelledby` pointing at text), so the popover has no accessible name. Name the trigger, or pass `title`, `aria-label` or `aria-labelledby`.',
      );
    }
  }, [checkTrigger, resolvedTriggerId, triggerRef, triggerLabelId]);

  if (!isMounted) return null;

  const titleAndChildren = (
    <>
      {hasTitle && (
        <h2
          {...mergeSlotProps(slotProps?.title, {
            className: wcn(
              popoverContentClassNames.title,
              'wave:mb-2 wave:text-subtitle-2 wave:font-semibold',
            ),
            locked: { id: titleId },
          })}
        >
          {title}
        </h2>
      )}
      {children}
    </>
  );
  const beak = mergeSlotProps(slotProps?.beak, {
    className: popoverContentClassNames.beak,
    locked: { 'aria-hidden': 'true', 'data-wave-popover-arrow': '', tabIndex: undefined },
  });

  return (
    <Portal disabled={inline} layerId={layerId}>
      <div
        role={role}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={keyboardContext || trapped ? -1 : undefined}
        data-appearance={appearance}
        data-size={size}
        {...rest}
        {...presenceProps}
        ref={elementRef}
        id={customId ?? contentId}
        data-state={open ? 'open' : 'closed'}
        data-side={floatingProps['data-side']}
        data-align={floatingProps['data-align']}
        // An inline surface has no portal wrapper to stack it: it takes the overlay layer itself.
        style={{
          ...(inline ? { zIndex: Z_INDEX.overlay } : undefined),
          ...style,
          ...floatingProps.style,
        }}
        onKeyDown={composeEventHandlers(onKeyDown, onContentKeyDown)}
        onContextMenu={composeEventHandlers(onContextMenu, onContentContextMenu)}
        onPointerEnter={
          hover ? composeEventHandlers(onPointerEnter, hover.onPointerEnter) : onPointerEnter
        }
        onPointerLeave={
          hover ? composeEventHandlers(onPointerLeave, hover.onPointerLeave) : onPointerLeave
        }
        className={wcn(
          popoverContentClassNames.root,
          'wave:w-64 wave:rounded-md wave:border wave:text-body-1 wave:font-normal wave:normal-case wave:tracking-normal wave:text-start wave:shadow-4',
          popoverAppearanceClasses[appearance],
          popoverSizeClasses[size],
          motionClassName,
          className,
        )}
      >
        {withArrow && (
          <PopoverBeak
            {...beak}
            ref={beakRef}
            side={placedSide}
            style={lockPositionStyle(beak.style, arrowStyles)}
          />
        )}
        {fitViewport ? (
          // The beak sits half outside the border, so the scroller is inside it: the viewport
          // limit minus the content's padding (2 x the size's) and border (2 x 1px).
          <div className={popoverScrollerClasses[size]}>{titleAndChildren}</div>
        ) : (
          titleAndChildren
        )}
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
 * - **Hover cards:** `openOnHover` opens it when a mouse pointer rests on the trigger
 *   (`openDelay`) and closes it once the pointer has left the trigger and the content
 *   (`closeDelay`), unless focus is inside; a click on the trigger pins it.
 * - **Context popovers:** `openOnContext` makes the trigger a context-menu region: a right click
 *   opens it at the pointer, Shift+F10 or the ContextMenu key at the focused row (with focus
 *   moving into the content). Name the content with `title` or `aria-label`.
 * - **Custom anchors:** `target` places it at another element or at a `VirtualElement` (a point, a
 *   text selection); with a controlled `open` it needs no trigger.
 * - **Motion:** the content fades and slides in from its trigger and back out as it closes;
 *   `Popover.Content`'s `motion` turns it off or replaces it.
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
