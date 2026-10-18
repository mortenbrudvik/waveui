import * as React from 'react';
import { isDev, reportMissingContext, warnOnce } from '../../lib/dev';
import { focusElement } from '../../lib/focus';
import { getOpenLayers, isDescendantLayer, type DismissReason } from '../../lib/layers';
import { mergeProps } from '../../lib/mergeProps';
import { STATE_ARIA } from '../../lib/renderTrigger';
import type { ModalOpenChangeReason, OpenChangeDetails } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { getTriggerFocusTarget, useTriggerElement } from '../../hooks/useTriggerElement';

/*
 * Internal helpers shared by Dialog and Drawer (P15). Not exported from the package.
 */

/** Why a modal root asks to open or close, and the event (`DialogOpenChangeDetails`). */
export type ModalOpenChangeDetails = OpenChangeDetails<ModalOpenChangeReason>;

/** Asks a modal root to open or close; see {@link useModalOpenState}. */
export type ModalRequestOpen = (open: boolean, details: ModalOpenChangeDetails) => void;

/**
 * The open state of a modal root (`Dialog`, `Drawer`): `useControllable`, plus the details of the
 * request behind each change. Every internal path asks through `requestOpen(next, details)`, which
 * writes `details` to a ref, calls the setter and clears the ref once the setter returns.
 * `useControllable` calls its `onChange` synchronously inside the setter, only when the value
 * changes, and that `onChange` passes the ref's details on as `onOpenChange(next, details)`.
 * Clearing the ref afterwards means a change that no request caused can never report a stale
 * reason.
 */
export function useModalOpenState(
  open: boolean | undefined,
  defaultOpen: boolean | undefined,
  onOpenChange: ((open: boolean, details?: ModalOpenChangeDetails) => void) | undefined,
): [open: boolean, requestOpen: ModalRequestOpen] {
  const detailsRef = React.useRef<ModalOpenChangeDetails | undefined>(undefined);
  const [value, setOpen] = useControllable(open, defaultOpen ?? false, (next: boolean) =>
    onOpenChange?.(next, detailsRef.current),
  );
  const requestOpen = React.useCallback<ModalRequestOpen>(
    (next, details) => {
      detailsRef.current = details;
      try {
        setOpen(next);
      } finally {
        detailsRef.current = undefined;
      }
    },
    [setOpen],
  );
  return [value, requestOpen];
}

/**
 * The `onDismiss` of a modal root's layer (`useModalLayer`): Escape and a backdrop press ask the
 * root to close, with their reason and event. `focus-outside` never reaches a modal layer (only a
 * layer registered with `focusOutside: true` gets it), so it is ignored with a development warning.
 *
 * @param requestOpen       The root's request function, from {@link useModalOpenState}.
 * @param componentName     The public name for the warning, e.g. `'Dialog'`.
 * @param afterOutsidePress Called right after an `outside-press` request (see
 *                          {@link useBackdropPress}).
 */
export function useModalDismiss(
  requestOpen: ModalRequestOpen,
  componentName: string,
  afterOutsidePress?: () => void,
): (reason: DismissReason, event: Event) => void {
  return React.useCallback(
    (reason: DismissReason, event: Event) => {
      switch (reason) {
        case 'escape':
          requestOpen(false, { reason, event });
          break;
        case 'outside-press':
          requestOpen(false, { reason, event });
          afterOutsidePress?.();
          break;
        case 'focus-outside':
          warnOnce(
            `${componentName}:focus-outside`,
            `${componentName} ignored a focus-outside dismissal: a modal surface does not close when focus leaves it.`,
          );
          break;
        default: {
          // Exhaustive: a new DismissReason does not compile here until it is mapped.
          const unmapped: never = reason;
          return unmapped;
        }
      }
    },
    [requestOpen, componentName, afterOutsidePress],
  );
}

/** Returned by {@link useBackdropPress}. */
export interface BackdropPress {
  /** `onMouseDown` of the backdrop element. Stable while `closesOnPress` stays the same. */
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  /** Pass it to {@link useModalDismiss}, which calls it after an `outside-press` request. Stable. */
  afterOutsidePress: () => void;
}

/**
 * What a press on a modal's backdrop does to focus (`Dialog.Content`, the Drawer panel). The
 * backdrop is the surface's sibling, so every mouse press on it, its content included, is a
 * backdrop press (a press that a portal opened from the backdrop's content bubbles through the
 * React tree is not).
 *
 * - When the press closes the modal (`closesOnPress`), the browser moves focus to `<body>` as
 *   usual, so the focused control blurs while it is still mounted and its blur-time commit runs
 *   (the typed text of a SpinButton or a picker, a consumer's `onBlur` autosave or validation)
 *   before the click closes the surface. The element inside the surface that had focus is
 *   remembered: when the surface is still open after the `outside-press` request (a controlled
 *   modal refused it), it gets focus back, in a microtask that runs after React has committed the
 *   request, and only while focus is still on `<body>` (a confirm dialog the refusal opened keeps
 *   its focus).
 * - When the press never closes the modal (an alert dialog), the press does not move focus at all
 *   (`preventDefault()`), so nothing blurs.
 *
 * @param surfaceRef    The surface element (the dialog or the drawer panel).
 * @param closesOnPress Whether a backdrop press asks the modal to close (its layer's `outsidePress`).
 */
export function useBackdropPress(
  surfaceRef: React.RefObject<HTMLElement | null>,
  closesOnPress: boolean,
): BackdropPress {
  // The element inside the surface that had focus when the last backdrop press started.
  const pressFocusRef = React.useRef<HTMLElement | null>(null);

  const onMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      // C-COMPOSE: only presses on the backdrop element or its content in the DOM.
      if (!event.currentTarget.contains(event.target as Node)) return;
      if (!closesOnPress) {
        event.preventDefault();
        return;
      }
      const focused = getFocusedElement();
      pressFocusRef.current = focused && surfaceRef.current?.contains(focused) ? focused : null;
    },
    [closesOnPress, surfaceRef],
  );

  const afterOutsidePress = React.useCallback(() => {
    const element = pressFocusRef.current;
    pressFocusRef.current = null;
    if (!element) return;
    // A close requested from the click is committed first (React flushes the update in a
    // microtask queued before this one): a closed surface no longer contains the element, or
    // (exiting, or kept mounted) is inert, so the element cannot take focus.
    queueMicrotask(() => {
      if (getFocusedElement() !== null || !surfaceRef.current?.contains(element)) return;
      focusElement(element, { preventScroll: true });
    });
  }, [surfaceRef]);

  return { onMouseDown, afterOutsidePress };
}

/** Whether `value` is a DOM event (duck-typed, so an event from another window counts too). */
function isDomEvent(value: unknown): value is Event {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<Event>).type === 'string' &&
    typeof (value as Partial<Event>).stopPropagation === 'function' &&
    !('nativeEvent' in value)
  );
}

/**
 * The DOM event behind a part's click handler call: a React event's `nativeEvent`, or a DOM event
 * passed as is. A render-prop child that calls the handler without its event (or with another
 * value) gets a new `click` event, so `details.event` is always an event.
 */
export function getNativeEvent(value: unknown): Event {
  const native =
    typeof value === 'object' && value !== null
      ? (value as { nativeEvent?: unknown }).nativeEvent
      : undefined;
  if (isDomEvent(native)) return native;
  if (isDomEvent(value)) return value;
  return new Event('click');
}

/** Returned by {@link useModalTrigger}. */
export interface ModalTrigger {
  /**
   * Callback ref for the element a trigger renders: the consumer's child, or the wrapper `<span>`
   * of `asChild={false}` and of the automatic fallback for a child that does not forward its ref.
   * Every trigger of the root attaches it (a root may have several). It returns a React 19 cleanup
   * that forgets that one element, so a trigger that unmounts never unregisters another. Stable.
   */
  attach: React.RefCallback<HTMLElement>;
  /**
   * Records the trigger that is opening the modal, for the open session that follows (anything that
   * is not an element is ignored). Focus returns to that trigger, not to another one of the same
   * root. Triggers call it through {@link useModalTriggerPart}.
   *
   * An activation the modal did not open for by the end of the task (a click that the parent of a
   * controlled modal rejected) is dropped, so it does not decide where focus returns after a later
   * open that no trigger started. React commits an accepted open within the same task.
   */
  activate: (target: unknown) => void;
  /**
   * Starts the open session: the activated trigger belongs to it until {@link endSession}.
   * {@link useModalTriggerSession} calls it when the modal opens.
   */
  startSession: () => void;
  /**
   * Ends the open session: forgets the activated trigger, so it does not decide where focus
   * returns after a later open that no trigger started. {@link useModalTriggerSession} calls it
   * when the modal closes.
   */
  endSession: () => void;
  /**
   * The focus-restore target, for the modal layer's `triggerRef`. Its `current` is resolved when it
   * is read (when the modal opens, and again on close if the opener captured then cannot take
   * focus any more):
   *
   * 1. `null` while an element other than `<body>` has focus: that element opened the modal (the
   *    clicked trigger, the button inside a trigger's wrapper span, or the parent's own button of
   *    a controlled modal), and the restore captures it. A trigger element itself with focus (a
   *    `tabIndex={-1}` wrapper span that a press focused, as Safari does for a click on the button
   *    inside it) resolves like any trigger instead.
   * 2. Otherwise (Safari does not focus a clicked button; a modal opened from code), the trigger
   *    activated in this open session while it is still in the document.
   * 3. Otherwise the first mounted trigger that can take focus.
   *
   * A trigger resolves with `getTriggerFocusTarget`, the rule of every trigger's focus return: the
   * element that carries the state ARIA (the button inside a wrapper span, the span when you made
   * it the trigger), else the first tabbable element inside it, else itself when it can take
   * focus, else `null`. Read-only.
   */
  focusRef: React.RefObject<HTMLElement | null>;
}

/** A trigger for components rendered outside their root (C-CONTEXT inert fallback). */
export const inertModalTrigger: ModalTrigger = {
  attach: () => undefined,
  activate: () => {},
  startSession: () => {},
  endSession: () => {},
  focusRef: { current: null },
};

function isElementTarget(target: unknown): target is HTMLElement {
  return typeof target === 'object' && target !== null && (target as Partial<Node>).nodeType === 1;
}

/** The element that has focus, or `null` when focus is on `<body>` (or nowhere). */
function getFocusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return null;
  return active.isConnected ? (active as HTMLElement) : null;
}

function createModalTrigger(): ModalTrigger {
  // Every mounted trigger element, in the order they attached.
  const attached = new Set<HTMLElement>();
  // The trigger clicked in the current open session (or in the task that is opening it);
  // forgotten when the modal closes, when the element detaches, or when no open followed the click.
  let activated: HTMLElement | null = null;
  // Whether an open session is running (between startSession and endSession).
  let sessionOpen = false;
  return {
    attach: (element) => {
      // Detaching runs the cleanup below (React 19 and useMergedRefs call it instead of passing
      // `null`), which knows which element leaves.
      if (!element) return undefined;
      attached.add(element);
      return () => {
        attached.delete(element);
        if (activated === element) activated = null;
      };
    },
    activate: (target) => {
      if (!isElementTarget(target)) return;
      activated = target;
      if (sessionOpen) return;
      // An accepted open commits before the next task starts; a rejected click leaves the modal
      // closed, and its activation must not outlive the task.
      setTimeout(() => {
        if (!sessionOpen && activated === target) activated = null;
      }, 0);
    },
    startSession: () => {
      sessionOpen = true;
    },
    endSession: () => {
      sessionOpen = false;
      activated = null;
    },
    focusRef: {
      get current() {
        // A focused element is the opener: the restore captures it (see ModalTrigger.focusRef),
        // unless it is a trigger element, which resolves like any trigger.
        const focused = getFocusedElement();
        if (focused) return attached.has(focused) ? getTriggerFocusTarget(focused) : null;
        // The trigger that opened the modal decides, also when it cannot take focus any more.
        if (activated?.isConnected) return getTriggerFocusTarget(activated);
        for (const element of attached) {
          if (!element.isConnected) continue;
          const target = getTriggerFocusTarget(element);
          if (target) return target;
        }
        return null;
      },
    },
  };
}

/**
 * The triggers of a modal root (`Dialog`, `Drawer`), overlays#9. Each `Dialog.Trigger`/
 * `Drawer.Trigger` attaches its element and activates it from its click handler through
 * {@link useModalTriggerPart}; the root passes `focusRef` to `useModalLayer` as its
 * `triggerRef` and scopes the activation to one open session with {@link useModalTriggerSession}.
 * Focus returns to the element that had focus when the modal opened; when nothing had focus, to
 * the trigger that opened it, else to the first mounted trigger. For a wrapper `<span>`, the
 * restore target is the element inside it that carries the state ARIA. Resolving when the ref is
 * read, not when it attaches, keeps a trigger that was disabled at mount (or whose content
 * changed) a valid target.
 */
export function useModalTrigger(): ModalTrigger {
  const [trigger] = React.useState(createModalTrigger);
  return trigger;
}

/** Returned by {@link useModalTriggerElement}. */
interface ModalTriggerElement {
  /**
   * Callback ref for the element one trigger renders (merge it with the consumer's ref): registers
   * it with the root's triggers and remembers it for `activate`. Stable.
   */
  attach: React.RefCallback<HTMLElement>;
  /**
   * Records this trigger as the one opening the modal: call it from the click handler, before
   * opening, with whatever the handler received. The element `attach` received wins, else the
   * event's `currentTarget`, so a render-prop child that calls `onClick()` without the event (or
   * with another value) is still recorded. Stable.
   */
  activate: (event?: unknown) => void;
}

function createModalTriggerElement(trigger: ModalTrigger): ModalTriggerElement {
  // The element this trigger rendered; a closure variable, not a React ref, so the click handler
  // that reads it can be passed around during render (C-HOOKS).
  let element: HTMLElement | null = null;
  return {
    attach: (node) => {
      if (!node) return undefined;
      element = node;
      const detach = trigger.attach(node);
      return () => {
        if (element === node) element = null;
        if (typeof detach === 'function') detach();
      };
    },
    activate: (event) => {
      const currentTarget =
        typeof event === 'object' && event !== null
          ? (event as { currentTarget?: unknown }).currentTarget
          : undefined;
      trigger.activate(element ?? currentTarget);
    },
  };
}

/**
 * One `Dialog.Trigger`/`Drawer.Trigger` of a modal root (overlays#9): attach `attach` to the
 * element the trigger renders and call `activate` from its click handler.
 */
function useModalTriggerElement(trigger: ModalTrigger): ModalTriggerElement {
  return React.useMemo(() => createModalTriggerElement(trigger), [trigger]);
}

/** The props of a trigger or close part (`Dialog.Trigger`, `Drawer.Close`, …). */
export interface ModalPartProps<RenderProps> extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'children'
> {
  /** A single element that receives the part's props, or a function that receives them. */
  children: React.ReactNode | ((props: RenderProps) => React.ReactNode);
  /** `false` renders a wrapper `<span>` carrying the click handler. */
  asChild?: boolean;
  /** Ref to the element the part renders. */
  ref?: React.Ref<HTMLElement>;
}

/** What {@link useModalTriggerPart} reads from the modal root. */
export interface ModalTriggerState {
  open: boolean;
  /**
   * Asks the root to open or close (reason `trigger`): to open while it is closed, to close while
   * it is open.
   */
  requestOpen: ModalRequestOpen;
  trigger: ModalTrigger;
  /** The surface's id for `aria-controls` while the modal is open. */
  controlsId: string | undefined;
  /**
   * `'dialog'` renders `aria-haspopup="dialog"`; `false` renders none (an inline drawer, whose
   * trigger shows and hides a panel in place).
   * @default 'dialog'
   */
  popup?: 'dialog' | false;
}

/**
 * Renders a `Dialog.Trigger`/`Drawer.Trigger`: its element gets `aria-haspopup="dialog"` (none
 * with `popup: false`, an inline drawer's trigger), `aria-expanded`, `aria-controls` (while open;
 * these always win over the child's own), a click handler that opens and closes the root (reason
 * `trigger`, with the click event: a click while it is open asks it to close) and records the
 * trigger that opens it (for the focus return), and a ref that registers it with the root's
 * triggers. On a wrapper span (`asChild={false}`, the automatic fallback), the state ARIA goes to
 * the first element in the tab order inside it (`useTriggerElement`).
 *
 * @param modal         The root's state, from its context.
 * @param props         The part's props.
 * @param componentName The public name for development warnings, e.g. `'Dialog.Trigger'`.
 */
export function useModalTriggerPart<RenderProps>(
  modal: ModalTriggerState,
  { children, asChild, ref, ...rest }: ModalPartProps<RenderProps>,
  componentName: string,
): React.ReactNode {
  const { open, requestOpen, trigger, controlsId, popup = 'dialog' } = modal;
  const { attach, activate } = useModalTriggerElement(trigger);
  const mergedRef = useMergedRefs<HTMLElement>(attach, ref);
  const toggleModal = React.useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      // Focus returns to this trigger, also when the root has several (overlays#9), and also when
      // a render-prop child calls `onClick()` without the event.
      if (!open) activate(event);
      requestOpen(!open, { reason: 'trigger', event: getNativeEvent(event) });
    },
    [open, activate, requestOpen],
  );

  // An inline drawer's trigger gets no `aria-haspopup` key at all, so a render-prop child that
  // spreads the props has none either.
  const stateAria = {
    ...(popup !== false && { 'aria-haspopup': popup }),
    'aria-expanded': open,
    'aria-controls': open ? controlsId : undefined,
  };
  const triggerProps = mergeProps({ ...stateAria, onClick: toggleModal, ref: mergedRef }, rest, {
    oursWin: STATE_ARIA,
  });

  return useTriggerElement(children, triggerProps as RenderProps, { componentName, asChild });
}

/**
 * Renders a `Dialog.Close`/`Drawer.Close`: composes a click handler that asks the root to close
 * (reason `close`, with the click event) onto its element (the child's own `onClick` runs first;
 * `preventDefault()` there keeps the modal open).
 *
 * @param requestOpen   The root's request function, from its context.
 * @param props         The part's props.
 * @param componentName The public name for development warnings, e.g. `'Dialog.Close'`.
 */
export function useModalClosePart<RenderProps>(
  requestOpen: ModalRequestOpen,
  { children, asChild, ref, ...rest }: ModalPartProps<RenderProps>,
  componentName: string,
): React.ReactNode {
  const mergedRef = useMergedRefs<HTMLElement>(ref);
  const close = React.useCallback(
    (event?: React.MouseEvent<HTMLElement>) =>
      requestOpen(false, { reason: 'close', event: getNativeEvent(event) }),
    [requestOpen],
  );
  const closeProps = mergeProps({ onClick: close, ref: mergedRef }, rest);
  return useTriggerElement(children, closeProps as RenderProps, { componentName, asChild });
}

/** The element {@link useModalOpener} captured, while it is in the document. */
interface ModalOpener {
  /** Records the opener (or forgets it, `null`). */
  set: (element: HTMLElement | null) => void;
  /** The captured opener while it is in the document, else `null`. Read-only. */
  ref: React.RefObject<HTMLElement | null>;
}

function createModalOpener(): ModalOpener {
  let element: HTMLElement | null = null;
  return {
    set: (next) => {
      element = next;
    },
    ref: {
      get current() {
        return element?.isConnected ? element : null;
      },
    },
  };
}

/**
 * The element a non-modal surface takes its keyboard place after (`usePopoverTabOrder`'s
 * `anchorRef`), captured in the insertion phase of the commit in which `enabled` becomes true,
 * before focus moves in: `trigger.focusRef.current`, which with nothing focused is the activated
 * or first trigger's focus target and is `null` while an element other than `<body>` has focus
 * (`ModalTrigger.focusRef` rule 1; a focused `tabIndex={-1}` trigger wrapper span resolves as a
 * trigger), so a focused trigger, the button inside a trigger's span or a controlled surface's own
 * opener is taken by the next step: else the focused element when it is not `<body>` and not
 * inside `surface`, else `null`. Cleared when `enabled` becomes false. An opener removed from the
 * document since reads as `null`, so the surface keeps its portal's place (the end of the page).
 */
export function useModalOpener(
  enabled: boolean,
  trigger: ModalTrigger,
  surface: HTMLElement | null,
): React.RefObject<HTMLElement | null> {
  const [opener] = React.useState(createModalOpener);
  const enabledRef = React.useRef(false);
  React.useInsertionEffect(() => {
    const wasEnabled = enabledRef.current;
    enabledRef.current = enabled;
    if (enabled === wasEnabled) return;
    if (!enabled) {
      opener.set(null);
      return;
    }
    const fromTrigger = trigger.focusRef.current;
    if (fromTrigger) {
      opener.set(fromTrigger);
      return;
    }
    const focused = getFocusedElement();
    opener.set(focused && !surface?.contains(focused) ? focused : null);
  });
  return opener.ref;
}

/**
 * Scopes a trigger's activation to one open session (overlays#9): when the modal opens, the
 * activated trigger joins the session; when it closes, the trigger is forgotten, so a later open
 * that no trigger started (a controlled modal opened by the parent) does not return focus to it.
 *
 * It updates the session in a layout effect, after the modal's focus restore has used the
 * activation: call it in the root component (whose effects run after its children's) and, when
 * that component also calls `useModalLayer`, after that call (a component's effects run in order).
 */
export function useModalTriggerSession(trigger: ModalTrigger, open: boolean): void {
  React.useLayoutEffect(() => {
    if (open) trigger.startSession();
    else trigger.endSession();
  }, [trigger, open]);
}

/**
 * Moves a kept-mounted surface to the top of its stack when it opens (D104). A portal's z-index is
 * its layer plus its nesting depth, so at equal depth the wrapper later in the document paints
 * above: a surface kept mounted since before another overlay opened (a confirm Dialog rendered
 * next to a Drawer) would open under it. In the commit in which `open` becomes `true`, a layout
 * effect moves the portal wrapper to the end of its container when it is not the container's last
 * element child (`container.appendChild(wrapper)`). The closed content is hidden, so the move loses
 * no visible state, and React removes the wrapper from the same parent later. An unmounting surface
 * is appended when it opens already, so pass `keptMounted: false` for it: it is never moved.
 *
 * Call it before `useModalLayer` (a component's layout effects run in order), so the move happens
 * before the layer registers, before other modals re-plan their isolation and before the focus
 * trap moves focus in.
 *
 * @param open        Whether the surface is open.
 * @param keptMounted `true` with `unmountOnClose={false}`.
 * @param wrapperRef  The `Portal`'s `ref` (its wrapper element).
 */
export function useRaiseOnOpen(
  open: boolean,
  keptMounted: boolean,
  wrapperRef: React.RefObject<HTMLElement | null>,
): void {
  // The open state of the previous commit: the move happens only in the opening commit, never
  // while the surface is open (a move would blur the element inside that has focus).
  const wasOpenRef = React.useRef(false);
  React.useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || wasOpen || !keptMounted) return;
    const wrapper = wrapperRef.current;
    const container = wrapper?.parentElement;
    if (wrapper && container && container.lastElementChild !== wrapper) {
      container.appendChild(wrapper);
    }
  });
}

/**
 * Development check of a kept-mounted surface (D106): a popup opened inside it (a Popover, a Menu,
 * a nested Dialog) that is still open when the surface closes stays open over the page, because
 * the content that would unmount it stays mounted. After each close of a kept-mounted surface it
 * schedules one check in a new task (`setTimeout(0)`, so a popup that the closing press itself
 * dismisses does not count) and warns once (`<componentName>:open-inside`) when an open layer
 * other than a tooltip descends from the surface's layer (`isDescendantLayer` follows the popup's
 * `parentId`, also after the surface's own layer unregistered) or has its anchor inside
 * `surfaceRef`'s element (an inline drawer, which registers no layer of its own, so a popup
 * opened inside it descends from no layer of the surface). Nothing runs with the default
 * `unmountOnClose`, where the popups unmount with the content, or in production.
 *
 * @param open          Whether the surface is open.
 * @param keptMounted   `true` with `unmountOnClose={false}`.
 * @param layerId       The surface's dismiss layer (`useModalLayer`'s `layerId`).
 * @param componentName The public name for the warning key and text: `'Dialog'`, `'Drawer'`.
 * @param surfaceRef    The surface element, for the anchor check (optional).
 */
export function useOpenInsideWarning(
  open: boolean,
  keptMounted: boolean,
  layerId: string,
  componentName: string,
  surfaceRef?: React.RefObject<HTMLElement | null>,
): void {
  const wasOpenRef = React.useRef(open);
  React.useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!isDev || open || !wasOpen || !keptMounted) return undefined;
    const timer = setTimeout(() => {
      const surface = surfaceRef?.current ?? null;
      const leftOpen = getOpenLayers().some((layer) => {
        if (layer.kind === 'tooltip') return false;
        if (isDescendantLayer(layer.id, layerId)) return true;
        const anchor = layer.getAnchor();
        return !!surface && !!anchor && surface.contains(anchor);
      });
      if (!leftOpen) return;
      warnOnce(
        `${componentName}:open-inside`,
        `${componentName} closed while a popup opened inside it is still open. With \`unmountOnClose={false}\` the popup stays open over the page: close it first, or keep the default \`unmountOnClose\`.`,
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [open, keptMounted, layerId, componentName, surfaceRef]);
}

/**
 * C-CONTEXT: reads a compound component's context. Outside its root it throws
 * `[WaveUI] <componentName> must be used within <parentName>` in development, and in production
 * logs the same message once per page (`reportMissingContext`) and returns the inert value from
 * `getInert`.
 */
export function useRequiredContext<T>(
  context: React.Context<T | null>,
  componentName: string,
  parentName: string,
  getInert: () => T,
): T {
  const value = React.useContext(context);
  if (value !== null) return value;
  reportMissingContext(componentName, parentName);
  return getInert();
}

/** What a modal surface (`Dialog.Content`, the Drawer panel) provides to its descendants. */
export interface ModalSurfaceContextValue {
  /**
   * Registers the id of a title element (`Dialog.Title`, `Drawer.Title`) for the surface's
   * `aria-labelledby`. Returns the unregister function.
   */
  registerTitle: (id: string) => () => void;
  /**
   * Receives the measured border-box height of the surface's sticky footer (`Dialog.Footer`) in
   * px, or `null` once it unmounts; the surface reserves it as the scroll padding of its body.
   * Absent on a surface without a footer part (the Drawer panel).
   */
  setFooterHeight?: (px: number | null) => void;
  /**
   * The element `Dialog.Title` actions portal into: the outlet in `Dialog.Content`'s title-actions
   * area, `null` until it is attached. Absent outside `Dialog.Content` (the Drawer panel), where a
   * title renders its action right after its heading.
   */
  titleActionsOutlet?: HTMLElement | null;
}

/**
 * Provided by every modal surface; `null` outside one. Titles register with it, and
 * `Dialog.Footer` reads it to report its height and to warn when it is rendered outside
 * `Dialog.Content`.
 */
export const ModalSurfaceContext = React.createContext<ModalSurfaceContextValue | null>(null);
ModalSurfaceContext.displayName = 'ModalSurfaceContext';

const inertSurface: ModalSurfaceContextValue = { registerTitle: () => () => {} };

/** Returned by {@link useTitleRegistry}. */
export interface TitleRegistry {
  /** The id of the first registered title, for `aria-labelledby`. */
  titleId: string | undefined;
  /** Whether a title is registered right now. Read it in effects and handlers, not during render. */
  hasTitle: () => boolean;
  /** The memoised value for `ModalSurfaceContext.Provider`. */
  context: ModalSurfaceContextValue;
}

/**
 * The title registry of a modal surface. A title registers its id from its ref callback (when its
 * element attaches), so the surface's `aria-labelledby` follows the title elements that are
 * actually rendered.
 */
export function useTitleRegistry(): TitleRegistry {
  const [ids, setIds] = React.useState<readonly string[]>([]);
  const countRef = React.useRef(0);

  const registerTitle = React.useCallback((id: string) => {
    countRef.current += 1;
    setIds((current) => [...current, id]);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      countRef.current -= 1;
      setIds((current) => {
        const index = current.indexOf(id);
        return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)];
      });
    };
  }, []);

  const hasTitle = React.useCallback(() => countRef.current > 0, []);
  const context = React.useMemo(() => ({ registerTitle }), [registerTitle]);
  return { titleId: ids[0], hasTitle, context };
}

/**
 * The `id` and `ref` of a title sub-component (`Dialog.Title`, `Drawer.Title`): the consumer's
 * `id` (or a generated one), registered with the enclosing surface while the element is mounted.
 */
export function useModalTitle(
  componentName: string,
  parentName: string,
  idProp: string | undefined,
  ref: React.Ref<HTMLHeadingElement> | undefined,
): { id: string; ref: React.RefCallback<HTMLHeadingElement> } {
  const { registerTitle } = useRequiredContext(
    ModalSurfaceContext,
    componentName,
    parentName,
    () => inertSurface,
  );
  const generatedId = useId('wave-modal-title');
  const id = idProp ?? generatedId;
  const register = React.useCallback(
    (node: HTMLHeadingElement | null) => (node ? registerTitle(id) : undefined),
    [registerTitle, id],
  );
  const mergedRef = useMergedRefs<HTMLHeadingElement>(ref, register);
  return { id, ref: mergedRef };
}

/**
 * Development warning (once per component) when an open modal surface has no accessible name:
 * no `title`, no registered title element, no `aria-label` and no `aria-labelledby`.
 *
 * @param surface       The open surface element (`null` while closed).
 * @param hasTitle      From {@link useTitleRegistry}.
 * @param componentName The public name, e.g. `'Dialog.Content'`.
 * @param titleName     The title sub-component to recommend, e.g. `'Dialog.Title'`.
 */
export function useUnnamedModalWarning(
  surface: HTMLElement | null,
  hasTitle: () => boolean,
  componentName: string,
  titleName: string,
): void {
  React.useEffect(() => {
    if (!surface) return;
    if (
      surface.hasAttribute('aria-label') ||
      surface.hasAttribute('aria-labelledby') ||
      hasTitle()
    ) {
      return;
    }
    warnOnce(
      `${componentName}:unnamed`,
      `${componentName} has no accessible name. Pass \`title\`, render a ${titleName} inside it, or give it \`aria-label\` or \`aria-labelledby\`.`,
    );
  }, [surface, hasTitle, componentName, titleName]);
}
