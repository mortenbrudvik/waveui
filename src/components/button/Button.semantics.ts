/**
 * Activation semantics shared by `Button` and `Link`: which element needs button semantics, the
 * defaults and enforced attributes of each tag and disabled state, and the handlers that add or
 * block activation. Internal to `src/components/button/` (not exported from the package).
 */
import * as React from 'react';
import { focusableDisabledProps } from '../../lib/aria';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { useEventCallback } from '../../hooks/useEventCallback';

/** Intrinsic elements that are interactive on their own: no `role="button"` or tab stop added. */
const INTERACTIVE_ELEMENTS: ReadonlySet<string> = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
]);

/** Intrinsic elements whose native `disabled` attribute makes them unavailable. */
export const NATIVE_DISABLED_ELEMENTS: ReadonlySet<string> = new Set([
  'button',
  'input',
  'select',
  'textarea',
]);

const isActivationKey = (key: string) => key === 'Enter' || key === ' ';

/**
 * Whether an intrinsic element needs button semantics: not interactive by itself, or an `<a>`
 * whose `href` is `undefined` or `null` (any string, `''` included, keeps it a link). `tag` is
 * `null` for a custom component, which never gets them.
 */
export function needsButtonSemantics(tag: string | null, href: unknown): boolean {
  if (tag === null) return false;
  if (tag === 'a') return href == null;
  return !INTERACTIVE_ELEMENTS.has(tag);
}

/** Options of {@link useButtonSemantics}. */
export interface ButtonSemanticsOptions {
  /**
   * The rendered intrinsic tag, or `null` for a custom `as` component (no role, tab stop or key
   * handling is added to it; the disabled attributes and handlers are).
   */
  tag: string | null;
  /** The consumer's `href` (decides link or button semantics for an `<a>`). */
  href: unknown;
  /** Makes the element unavailable: natively for form controls, with `aria-disabled` otherwise. */
  disabled: boolean;
  /** Unavailable but focusable and in the tab order. Wins over `disabled`. */
  disabledFocusable: boolean;
  /** The consumer's handlers; the returned handlers compose or replace them. */
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
  onBlur?: React.FocusEventHandler<HTMLElement>;
}

/** The result of {@link useButtonSemantics}. */
export interface ButtonSemantics {
  /**
   * Defaults the consumer may override (C-COMPOSE: `type`, `role`, `tabIndex`). Apply each one
   * wherever the consumer's value is `undefined` or `null`, so a wrapper that forwards
   * `type={type}` never drops `type="button"`, the role or the tab stop.
   */
  defaults: Record<string, unknown>;
  /**
   * Attributes the consumer must not override: spread after `{...rest}` (`disabled`,
   * `aria-disabled`, `data-disabled`, `data-disabled-focusable`, `href: undefined`, `tabIndex: -1`
   * for a disabled non-native element).
   */
  enforced: Record<string, unknown>;
  /** Only the handlers that exist, so a custom `as` component keeps its own defaults. */
  handlers: {
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
    onBlur?: React.FocusEventHandler<HTMLElement>;
  };
}

/**
 * Defaults, enforced attributes and composed handlers for Button and Link.
 *
 * - An intrinsic element that is not interactive by itself (`div`, `span`) and an `<a>` without
 *   `href` get `role="button"` and `tabIndex={0}` as defaults; Enter activates on keydown, Space
 *   arms on keydown (preventing page scroll) and activates on the following keyup, and moving
 *   focus in between cancels it (native button behaviour). A native `<button>` defaults to
 *   `type="button"`.
 * - `disabled` on a form control (`button`, `input`, `select`, `textarea`): the native attribute.
 *   On any other element: `aria-disabled` and `tabIndex={-1}`; an `<a>` drops its `href` and keeps
 *   `role="link"` when it had one (`role="button"` without).
 * - `disabledFocusable` (wins over `disabled`), for every element: `aria-disabled`,
 *   `data-disabled-focusable` and no native `disabled`; the element stays in the tab order (an
 *   `<a>` drops its `href` and gets `tabIndex={0}` as a default).
 * - Every disabled state renders `data-disabled`. While disabled without the native attribute, a
 *   click is prevented and stopped (a natively disabled button dispatches no click to ancestors),
 *   Enter and Space are prevented and not forwarded, and other keys reach the consumer.
 */
export function useButtonSemantics(options: ButtonSemanticsOptions): ButtonSemantics {
  const { tag, href, disabled, disabledFocusable, onClick, onKeyDown, onKeyUp, onBlur } = options;

  /**
   * Set by an unprevented Space keydown on the element itself; Space activates on keyup only while
   * it is set (like a native button: a keyup alone never clicks). Cleared on keyup and blur. The
   * ref is only touched from event handlers, through these two stable callbacks (C-HOOKS).
   */
  const spaceArmedRef = React.useRef(false);
  /** Arms (or disarms) Space activation. */
  const setSpaceArmed = useEventCallback((armed: boolean) => {
    spaceArmedRef.current = armed;
  });
  /** Reads and clears the Space arm. */
  const takeSpaceArmed = useEventCallback(() => {
    const armed = spaceArmedRef.current;
    spaceArmedRef.current = false;
    return armed;
  });

  const buttonLike = needsButtonSemantics(tag, href);
  const usesNativeDisabled = tag !== null && NATIVE_DISABLED_ELEMENTS.has(tag);

  const defaults: Record<string, unknown> = {};
  const enforced: Record<string, unknown> = {};
  let handleClick = onClick;
  let handleKeyDown = onKeyDown;
  let handleKeyUp = onKeyUp;
  let handleBlur = onBlur;

  if (tag === 'button') defaults.type = 'button';
  if (buttonLike) {
    defaults.role = 'button';
    defaults.tabIndex = 0;
  }

  const blocksActivation = disabledFocusable || (disabled && !usesNativeDisabled);
  if (disabledFocusable) {
    Object.assign(enforced, focusableDisabledProps(true, { reachable: true }));
    if (tag === 'a') {
      // Drop the destination (no middle-click or context-menu navigation) but keep the tab stop.
      defaults.role ??= 'link';
      defaults.tabIndex = 0;
      enforced.href = undefined;
    }
  } else if (disabled && usesNativeDisabled) {
    enforced.disabled = true;
    enforced['data-disabled'] = '';
  } else if (disabled) {
    // Not a form control: `disabled` has no effect, so expose and enforce the state ourselves.
    if (tag === 'a') {
      // Drop the destination but keep the link role when there was one.
      defaults.role ??= 'link';
      enforced.href = undefined;
    }
    Object.assign(enforced, focusableDisabledProps(true));
    enforced.tabIndex = -1;
  }

  if (blocksActivation) {
    // A natively disabled button dispatches no click at all, so ancestors never see this one.
    handleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    handleKeyDown = (event) => {
      if (isActivationKey(event.key)) {
        setSpaceArmed(false);
        event.preventDefault();
        return;
      }
      onKeyDown?.(event);
    };
    handleKeyUp = (event) => {
      if (isActivationKey(event.key)) {
        setSpaceArmed(false);
        event.preventDefault();
        return;
      }
      onKeyUp?.(event);
    };
  } else if (buttonLike) {
    // APG button: Enter activates on keydown; Space arms on keydown (preventing page scroll) and
    // activates on the following keyup. A consumer `preventDefault()` on the keydown cancels both.
    handleKeyDown = composeEventHandlers(onKeyDown, (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || !isActivationKey(event.key)) return;
      event.preventDefault();
      if (event.key === 'Enter') event.currentTarget.click();
      else setSpaceArmed(true);
    });
    handleKeyUp = (event) => {
      onKeyUp?.(event);
      if (event.key !== ' ') return;
      const armed = takeSpaceArmed();
      if (!armed || event.defaultPrevented || event.target !== event.currentTarget) return;
      event.preventDefault();
      event.currentTarget.click();
    };
    // Moving focus away between keydown and keyup cancels a Space activation (native behavior).
    handleBlur = composeEventHandlers(onBlur, () => setSpaceArmed(false), {
      checkDefaultPrevented: false,
    });
  }

  const handlers: ButtonSemantics['handlers'] = {};
  if (handleClick) handlers.onClick = handleClick;
  if (handleKeyDown) handlers.onKeyDown = handleKeyDown;
  if (handleKeyUp) handlers.onKeyUp = handleKeyUp;
  if (handleBlur) handlers.onBlur = handleBlur;

  return { defaults, enforced, handlers };
}
