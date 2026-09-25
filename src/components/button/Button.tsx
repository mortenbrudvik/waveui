import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { useEventCallback } from '../../hooks/useEventCallback';
import {
  materialiseSlotContent,
  renderSlot,
  slotRendersContent,
  VOID_ELEMENTS,
} from '../../lib/slot';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Size, Appearance, Slot } from '../../lib/types';
import { buttonClassName } from './buttonStyles';

/**
 * The Button's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`), so `as="a"` accepts `href`/`target`
 * and types `onClick` for an anchor.
 */
export interface ButtonOwnProps {
  /** Visual style variant.
   * @default 'outline'
   */
  appearance?: Appearance;
  /** Size affecting height, padding and font size.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Icon slot rendered before the label. Decorative: it renders with `aria-hidden="true"` (a slot
   * object can override it). An icon-only button needs `aria-label`, `aria-labelledby` or `title`.
   */
  icon?: Slot<'span'>;
  /**
   * Disables the button. Only the intrinsic form controls (`button`, the default, and `input`,
   * `select`, `textarea`) get the native `disabled` attribute. Every other `as` — `a`, `div`,
   * `span` and **any custom component**, including router links and styled or motion components
   * that render a native `<button>` — does not receive `disabled`: it gets `aria-disabled="true"`
   * and `tabIndex={-1}` instead (neither can be overridden), its clicks and Enter/Space are
   * prevented (a click does not reach ancestor `onClick` handlers either, as with a native
   * disabled button), and an `<a>` drops its `href`. Such an element leaves the tab order but, like
   * any `tabIndex={-1}` element, can still take focus from a mouse click, and a component's own
   * `:disabled` styling does not apply.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Props of {@link Button} rendered as `C` (default `'button'`). `ButtonProps` without a type
 * argument is the 0.4 name: the props of a Button rendered as a `<button>`, including `ref`.
 *
 * @example
 * interface SaveButtonProps extends ButtonProps { tracking?: string }
 * const props: ButtonProps<'a'> = { as: 'a', href: '/docs', appearance: 'primary' };
 */
export type ButtonProps<C extends React.ElementType = 'button'> = PolymorphicProps<
  C,
  ButtonOwnProps
>;

/** The props the implementation reads, for any `as` (the public typing is `PolymorphicComponent`). */
type ButtonImplProps = ButtonOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'onKeyDown' | 'onKeyUp'> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
  };

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
const NATIVE_DISABLED_ELEMENTS: ReadonlySet<string> = new Set([
  'button',
  'input',
  'select',
  'textarea',
]);

const isActivationKey = (key: string) => key === 'Enter' || key === ' ';

/**
 * A button with Fluent appearances and sizes.
 *
 * - Renders a `<button type="button">` by default (pass `type="submit"` to submit a form).
 * - `as` renders another element or component with correctly typed props
 *   (`<Button as="a" href="/docs">`, `<Button as={RouterLink} to="/">`).
 * - Non-button elements keep button semantics: an element that is not interactive by itself
 *   (`as="div"`, `as="span"`) gets `role="button"`, a tab stop and Enter/Space activation, and
 *   `disabled` becomes `aria-disabled` + `tabIndex={-1}` with clicks and keys prevented.
 * - A custom `as` component receives neither the `type="button"` default nor `disabled` (see
 *   `disabled`), even when it renders a native `<button>`: pass `type` yourself inside a form.
 * - The `icon` slot is decorative (`aria-hidden`); give icon-only buttons an `aria-label`.
 * - A consumer `aria-disabled="true"` shows the disabled look and suppresses hover and pressed
 *   colors, but the button stays focusable and its handlers still run: guard them yourself.
 * - Colors are theme tokens; hover and pressed styles never apply while disabled.
 * - Hover and pressed colors are gated (`not-disabled:not-aria-disabled:hover:`), which gives
 *   them a higher CSS specificity than a bare `hover:` class. To override them in `className`,
 *   use the same prefix (`not-disabled:not-aria-disabled:hover:bg-error`, which replaces the
 *   built-in class) or the important modifier (`hover:bg-error!`).
 *
 * @example
 * <Button appearance="primary" icon={<SaveIcon />}>Save</Button>
 * <Button as="a" href="/docs">Documentation</Button>
 * <Button icon={<CloseIcon />} aria-label="Close" appearance="subtle" />
 */
export const Button: PolymorphicComponent<'button', ButtonOwnProps> = (props) => {
  const {
    as,
    appearance = 'outline',
    size = 'medium',
    icon,
    disabled = false,
    className,
    children,
    ref,
    onClick,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...rest
  } = props as ButtonImplProps;

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

  const Component: React.ElementType = as ?? 'button';
  const tag = typeof Component === 'string' ? Component : null;
  const isNativeButton = tag === 'button';
  /** `disabled` works natively only on form controls; everything else uses aria-disabled. */
  const usesNativeDisabled = tag !== null && NATIVE_DISABLED_ELEMENTS.has(tag);
  /** An intrinsic element that is not interactive on its own needs button semantics. */
  const needsButtonSemantics = tag !== null && !INTERACTIVE_ELEMENTS.has(tag);
  const isVoid = tag !== null && VOID_ELEMENTS.has(tag);
  const ariaDisabled = rest['aria-disabled'];
  /**
   * An `icon` that renders nothing (`''` from `icon={name && <Icon />}`, an empty array, Set or
   * Fragment) is treated like no icon: no empty `aria-hidden` span, no gap, no icon-only sizing.
   */
  const iconElement = renderSlot(
    slotRendersContent(icon) ? icon : undefined,
    'span',
    'inline-flex shrink-0 items-center',
    { 'aria-hidden': true },
  );
  /** Derived from what renders, so an icon that renders nothing never counts. */
  const hasIcon = iconElement !== null;
  // A generator label is read once by the check; its items are what renders.
  const label = materialiseSlotContent(children);
  const hasLabel = slotRendersContent(label);
  const iconOnly = hasIcon && !hasLabel;

  const ariaLabel = rest['aria-label'];
  const ariaLabelledBy = rest['aria-labelledby'];
  const title = rest.title;
  React.useEffect(() => {
    if (iconOnly && !ariaLabel && !ariaLabelledBy && !title) {
      warnOnce(
        'Button:icon-only-name',
        'Button: an icon-only button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon is decorative and hidden from assistive technology).',
      );
    }
  }, [iconOnly, ariaLabel, ariaLabelledBy, title]);

  /**
   * Defaults the consumer may override (C-COMPOSE). They apply wherever the consumer's value is
   * `undefined` or `null` — also when the key is present, e.g. a wrapper that forwards
   * `type={type}` — so a forwarded `undefined` never drops `type="button"`, the role or the tab stop.
   */
  const defaults: Record<string, unknown> = {};
  /** Attributes the consumer must not override (C-COMPOSE: after `{...rest}`). */
  const enforced: Record<string, unknown> = {};
  let handleClick: React.MouseEventHandler<HTMLElement> | undefined = onClick;
  let handleKeyDown: React.KeyboardEventHandler<HTMLElement> | undefined = onKeyDown;
  let handleKeyUp: React.KeyboardEventHandler<HTMLElement> | undefined = onKeyUp;
  let handleBlur: React.FocusEventHandler<HTMLElement> | undefined = onBlur;

  if (isNativeButton) defaults.type = 'button';
  if (needsButtonSemantics) {
    defaults.role = 'button';
    defaults.tabIndex = 0;
  }

  if (usesNativeDisabled) {
    enforced.disabled = disabled || undefined;
  } else if (disabled) {
    // Not a form control: `disabled` has no effect, so expose and enforce the state ourselves.
    if (tag === 'a') {
      // Drop the destination (no middle-click or context-menu navigation) but keep the link role.
      defaults.role = 'link';
      enforced.href = undefined;
    }
    enforced['aria-disabled'] = true;
    enforced.tabIndex = -1;
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
  } else if (needsButtonSemantics) {
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

  // Only pass handlers that exist, so a custom `as` component keeps its own defaults.
  const handlers: Record<string, unknown> = {};
  if (handleClick) handlers.onClick = handleClick;
  if (handleKeyDown) handlers.onKeyDown = handleKeyDown;
  if (handleKeyUp) handlers.onKeyUp = handleKeyUp;
  if (handleBlur) handlers.onBlur = handleBlur;

  const elementProps: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(defaults)) elementProps[key] ??= value;

  const showDisabledLook = disabled || ariaDisabled === true || ariaDisabled === 'true';
  let content: React.ReactNode = label;
  if (isVoid) content = undefined;
  else if (iconElement) {
    content = (
      <>
        {iconElement}
        {label}
      </>
    );
  }

  return (
    <Component
      {...elementProps}
      {...handlers}
      ref={ref}
      className={cn(
        buttonClassName({ appearance, size, disabled: showDisabledLook, iconOnly }),
        hasIcon && hasLabel && 'gap-1.5',
        className,
      )}
      {...enforced}
    >
      {content}
    </Component>
  );
};

Button.displayName = 'Button';
