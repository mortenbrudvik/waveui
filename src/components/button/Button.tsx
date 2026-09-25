import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import {
  materialiseSlotContent,
  renderSlot,
  slotRendersContent,
  VOID_ELEMENTS,
} from '../../lib/slot';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Size, Appearance, IconPosition, Slot } from '../../lib/types';
import { useButtonSemantics } from './Button.semantics';
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
   * Icon slot rendered before the label (after it with `iconPosition="after"`). Decorative: it
   * renders with `aria-hidden="true"` (a slot object can override it). An icon-only button needs
   * `aria-label`, `aria-labelledby` or `title`.
   */
  icon?: Slot<'span'>;
  /**
   * Where the icon renders: before the label (the inline start) or after it (the inline end, e.g.
   * an "open in new window" glyph). Follows the writing direction through DOM order. Has no effect
   * on an icon-only button.
   * @default 'before'
   */
  iconPosition?: IconPosition;
  /**
   * Disables the button. Only the intrinsic form controls (`button`, the default, and `input`,
   * `select`, `textarea`) get the native `disabled` attribute. Every other `as` — `a`, `div`,
   * `span` and **any custom component**, including router links and styled or motion components
   * that render a native `<button>` — does not receive `disabled`: it gets `aria-disabled="true"`
   * and `tabIndex={-1}` instead (neither can be overridden), its clicks and Enter/Space are
   * prevented (a click does not reach ancestor `onClick` handlers either, as with a native
   * disabled button), and an `<a>` drops its `href` (it keeps `role="link"` when it had one,
   * `role="button"` otherwise). Such an element leaves the tab order but, like any
   * `tabIndex={-1}` element, can still take focus from a mouse click, and a component's own
   * `:disabled` styling does not apply. Every disabled Button also renders `data-disabled`.
   * @default false
   */
  disabled?: boolean;
  /**
   * Marks the button unavailable but keeps it focusable and in the tab order: for toolbar items, a
   * button that disables itself when activated, or a disabled button that needs a Tooltip. Renders
   * `aria-disabled="true"`, `data-disabled` and `data-disabled-focusable` instead of the native
   * `disabled` attribute. Clicks, Enter, Space and implicit form submission are prevented; your
   * `onClick` is not called and the click does not reach ancestor click handlers. Hover and pressed
   * colors are off. Wins over `disabled` when both are set. In a `Toolbar` it stays in the
   * arrow-key order.
   * @default false
   */
  disabledFocusable?: boolean;
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
    /** An anchor's destination (`as="a"`): without one, the anchor gets button semantics. */
    href?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
  };

/**
 * A button with Fluent appearances and sizes.
 *
 * - Renders a `<button type="button">` by default (pass `type="submit"` to submit a form).
 * - `as` renders another element or component with correctly typed props
 *   (`<Button as="a" href="/docs">`, `<Button as={RouterLink} to="/">`).
 * - Non-button elements keep button semantics: an element that is not interactive by itself
 *   (`as="div"`, `as="span"`) and an `as="a"` without `href` get `role="button"`, a tab stop and
 *   Enter/Space activation (an `<a>` with any `href`, `''` included, stays a link), and
 *   `disabled` becomes `aria-disabled` + `tabIndex={-1}` with clicks and keys prevented.
 * - A custom `as` component receives neither the `type="button"` default nor `disabled` (see
 *   `disabled`), even when it renders a native `<button>`: pass `type` yourself inside a form.
 * - The `icon` slot is decorative (`aria-hidden`); give icon-only buttons an `aria-label`.
 * - `disabledFocusable` keeps an unavailable button focusable (a Tooltip can explain why, a
 *   toolbar keeps it in its arrow-key order) and blocks its activation.
 * - A consumer `aria-disabled="true"` shows the disabled look and suppresses hover and pressed
 *   colors, but the button stays focusable and its handlers still run: guard them yourself, or use
 *   `disabledFocusable`, which does both.
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
    iconPosition = 'before',
    disabled = false,
    disabledFocusable = false,
    className,
    children,
    ref,
    onClick,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...rest
  } = props as ButtonImplProps;

  const Component: React.ElementType = as ?? 'button';
  const tag = typeof Component === 'string' ? Component : null;
  const isVoid = tag !== null && VOID_ELEMENTS.has(tag);
  // Defaults, enforced attributes and handlers per tag and disabled state (shared with Link).
  const { defaults, enforced, handlers } = useButtonSemantics({
    tag,
    href: rest.href,
    disabled,
    disabledFocusable,
    onClick,
    onKeyDown,
    onKeyUp,
    onBlur,
  });
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

  // Defaults apply wherever the consumer's value is `undefined` or `null` (C-COMPOSE), so a wrapper
  // that forwards `type={type}` never drops `type="button"`, the role or the tab stop.
  const elementProps: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(defaults)) elementProps[key] ??= value;

  const showDisabledLook =
    disabled || disabledFocusable || ariaDisabled === true || ariaDisabled === 'true';
  let content: React.ReactNode = label;
  if (isVoid) content = undefined;
  else if (iconElement) {
    // DOM order, so the icon follows the writing direction (no physical classes).
    content =
      iconPosition === 'after' ? (
        <>
          {label}
          {iconElement}
        </>
      ) : (
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
