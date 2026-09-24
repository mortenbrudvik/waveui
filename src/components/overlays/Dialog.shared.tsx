import * as React from 'react';
import { isDev, warnOnce } from '../../lib/dev';
import { getFirstTabbable, isFocusable } from '../../lib/focus';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';

/*
 * Internal helpers shared by Dialog and Drawer (P15). Not exported from the package.
 */

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

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
   * root. Triggers call it through {@link useModalTriggerElement}.
   */
  activate: (target: unknown) => void;
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
   *    a controlled modal), and the restore captures it.
   * 2. Otherwise (Safari does not focus a clicked button; a modal opened from code), the trigger
   *    activated in this open session while it is still in the document.
   * 3. Otherwise the first mounted trigger that can take focus.
   *
   * A trigger resolves to itself when it can take focus, else to the first tabbable element inside
   * it, else `null`. Read-only.
   */
  focusRef: React.RefObject<HTMLElement | null>;
}

/** A trigger for components rendered outside their root (C-CONTEXT inert fallback). */
export const inertModalTrigger: ModalTrigger = {
  attach: () => undefined,
  activate: () => {},
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

/** The element focus returns to for a trigger element (see {@link ModalTrigger.focusRef}). */
function resolveTriggerFocusTarget(node: HTMLElement): HTMLElement | null {
  return isFocusable(node) ? node : getFirstTabbable(node);
}

function createModalTrigger(): ModalTrigger {
  // Every mounted trigger element, in the order they attached.
  const attached = new Set<HTMLElement>();
  // The trigger clicked in the current open session; forgotten when the modal closes or the
  // element detaches.
  let activated: HTMLElement | null = null;
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
      if (isElementTarget(target)) activated = target;
    },
    endSession: () => {
      activated = null;
    },
    focusRef: {
      get current() {
        // A focused element is the opener: the restore captures it (see ModalTrigger.focusRef).
        if (getFocusedElement()) return null;
        // The trigger that opened the modal decides, also when it cannot take focus any more.
        if (activated?.isConnected) return resolveTriggerFocusTarget(activated);
        for (const element of attached) {
          if (!element.isConnected) continue;
          const target = resolveTriggerFocusTarget(element);
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
 * {@link useModalTriggerElement}; the root passes `focusRef` to `useModalLayer` as its
 * `triggerRef` and scopes the activation to one open session with {@link useModalTriggerSession}.
 * Focus returns to the element that had focus when the modal opened; when nothing had focus, to
 * the trigger that opened it, else to the first mounted trigger. A wrapper `<span>` is not
 * focusable, so the restore target is the element inside it that is. Resolving when the ref is
 * read, not when it attaches, keeps a trigger that was disabled at mount (or whose content
 * changed) a valid target.
 */
export function useModalTrigger(): ModalTrigger {
  const [trigger] = React.useState(createModalTrigger);
  return trigger;
}

/** Returned by {@link useModalTriggerElement}. */
export interface ModalTriggerElement {
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
export function useModalTriggerElement(trigger: ModalTrigger): ModalTriggerElement {
  return React.useMemo(() => createModalTriggerElement(trigger), [trigger]);
}

/**
 * Scopes a trigger's activation to one open session (overlays#9): when the modal closes, the
 * activated trigger is forgotten, so a later open that no trigger started (a controlled modal
 * opened by the parent) does not return focus to it.
 *
 * It clears the activation in a layout effect, after the modal's focus restore has used it: call
 * it in the root component (whose effects run after its children's) and, when that component also
 * calls `useModalLayer`, after that call (a component's effects run in order).
 */
export function useModalTriggerSession(trigger: ModalTrigger, open: boolean): void {
  useIsomorphicLayoutEffect(() => {
    if (!open) trigger.endSession();
  }, [trigger, open]);
}

/**
 * C-CONTEXT: reads a compound component's context. Outside its root it throws
 * `[WaveUI] <componentName> must be used within <parentName>` in development, and in production
 * logs the same message and returns the inert value from `getInert`.
 */
export function useRequiredContext<T>(
  context: React.Context<T | null>,
  componentName: string,
  parentName: string,
  getInert: () => T,
): T {
  const value = React.useContext(context);
  if (value !== null) return value;
  const message = `[WaveUI] ${componentName} must be used within ${parentName}`;
  if (isDev) throw new Error(message);
  console.error(message);
  return getInert();
}

/** What a modal surface (`Dialog.Content`, the Drawer panel) provides to its descendants. */
export interface ModalSurfaceContextValue {
  /**
   * Registers the id of a title element (`Dialog.Title`, `Drawer.Title`) for the surface's
   * `aria-labelledby`. Returns the unregister function.
   */
  registerTitle: (id: string) => () => void;
}

/**
 * Provided by every modal surface; `null` outside one. Titles register with it, and
 * `Dialog.Footer` reads it to warn when it is rendered outside `Dialog.Content`.
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
