import * as React from 'react';
import { cn } from '../../lib/cn';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Size, Appearance, IconPosition, Slot } from '../../lib/types';
import { Button } from './Button';

/**
 * The CompoundButton's own props (the XOwnProps rule of `PolymorphicProps`: component-specific
 * props only). Every other prop comes from the rendered element (`as`).
 */
export interface CompoundButtonOwnProps {
  /**
   * Secondary descriptive text displayed below the main label (part of the accessible name).
   * Content that renders nothing (`''`, `[]`, `<></>`) renders no second line.
   */
  secondaryText?: React.ReactNode;
  /** Visual style variant.
   * @default 'outline'
   */
  appearance?: Appearance;
  /** Size affecting padding and font size.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Disables the button. As with {@link Button}: a native `disabled` attribute for form controls
   * (the default `button`); every other `as` gets `aria-disabled="true"` and `tabIndex={-1}`, its
   * activation is prevented and an `<a>` drops its `href`.
   * @default false
   */
  disabled?: boolean;
  /**
   * Marks the button unavailable but keeps it focusable and in the tab order (for a Tooltip
   * that explains why, or a toolbar). Renders `aria-disabled="true"`, `data-disabled` and
   * `data-disabled-focusable` instead of the native `disabled` attribute; clicks, Enter, Space
   * and implicit form submission are prevented, and your `onClick` is not called. Wins over
   * `disabled` when both are set. In a `Toolbar` it stays in the arrow-key order.
   * @default false
   */
  disabledFocusable?: boolean;
  /**
   * Icon shown beside the two lines of text, in a 40px box (32px at `small`, 24px at
   * `extra-small`) whose SVG fills it. Decorative (`aria-hidden`). A CompoundButton with only an
   * icon (no label, no `secondaryText`) is an icon-only button: it looks and is checked like an
   * icon-only `Button` and needs `aria-label`, `aria-labelledby` or `title`.
   */
  icon?: Slot<'span'>;
  /**
   * Where the icon renders: before the text column (the inline start) or after it (the inline
   * end). Follows the writing direction through DOM order. Has no effect without an icon or on
   * an icon-only button.
   * @default 'before'
   */
  iconPosition?: IconPosition;
}

/**
 * Props of {@link CompoundButton} rendered as `C` (default `'button'`). `CompoundButtonProps`
 * without a type argument is the 0.4 name: the props of a CompoundButton rendered as a
 * `<button>`, including `ref`.
 */
export type CompoundButtonProps<C extends React.ElementType = 'button'> = PolymorphicProps<
  C,
  CompoundButtonOwnProps
>;

/**
 * Vertical padding per size. The height is content-sized (`h-auto` replaces Button's fixed
 * height); horizontal padding and font size come from Button.
 */
const paddingClasses: Record<Size, string> = {
  'extra-small': 'py-0.5',
  small: 'py-1',
  medium: 'py-2',
  large: 'py-3',
  'extra-large': 'py-4',
};

/** The icon box per size (its SVG fills it): 24px at extra-small, 32px at small, else 40px. */
const iconBoxClasses: Record<Size, string> = {
  'extra-small': 'size-6',
  small: 'size-8',
  medium: 'size-10',
  large: 'size-10',
  'extra-large': 'size-10',
};

/** The props the implementation reads, for any `as`. */
type CompoundButtonImplProps = CompoundButtonOwnProps & {
  as?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
};

/** `Button` widened to any element props, so `as` and the rest props pass through untyped. */
const BaseButton = Button as React.ElementType;

/**
 * A button with a main label and a secondary line of text below it, and an optional icon beside
 * them. Built on {@link Button}: same appearances, sizes, token colors, `type="button"` default,
 * `disabled`/`disabledFocusable` and polymorphic `as` behaviour (`as="a"` renders a link; a
 * non-interactive `as` gets `role="button"`, a tab stop and Enter/Space activation; `disabled`
 * becomes `aria-disabled` on non-form-control elements).
 *
 * - The text lines sit in a column wrapper (`span[data-wave-compound-content]`); the icon renders
 *   before or after it (`iconPosition`).
 * - With only an icon (no label and no `secondaryText`) it is an icon-only `Button`: square, with
 *   the icon-only sizing and name check.
 *
 * @example
 * <CompoundButton secondaryText="Opens your email client">Send mail</CompoundButton>
 * <CompoundButton icon={<CalendarIcon />} secondaryText="Next Monday at 9:00">
 *   Schedule
 * </CompoundButton>
 * <CompoundButton as="a" href="/signup" appearance="primary" secondaryText="Free for 30 days">
 *   Create account
 * </CompoundButton>
 */
export const CompoundButton: PolymorphicComponent<'button', CompoundButtonOwnProps> = (props) => {
  const {
    secondaryText,
    appearance = 'outline',
    size = 'medium',
    icon,
    iconPosition = 'before',
    className,
    children,
    ...rest
  } = props as CompoundButtonImplProps;
  // Content that renders nothing (`''`, `[]`, `<></>`) counts as absent; a generator is read once
  // by the check and its items render.
  const label = materialiseSlotContent(children);
  const secondary = materialiseSlotContent(secondaryText);
  const hasSecondary = slotRendersContent(secondary);

  // Without any text it is an icon-only (or empty) Button: Button's own sizing and name check.
  if (!slotRendersContent(label) && !hasSecondary) {
    return (
      <BaseButton
        {...rest}
        appearance={appearance}
        size={size}
        icon={icon}
        iconPosition={iconPosition}
        className={className}
      />
    );
  }

  const iconElement = renderSlot(
    slotRendersContent(icon) ? icon : undefined,
    'span',
    cn('inline-flex shrink-0 items-center justify-center [&>svg]:size-full', iconBoxClasses[size]),
    { 'aria-hidden': true },
  );
  const content = (
    <span data-wave-compound-content="" className="flex min-w-0 flex-col items-start">
      <span className="font-bold">{label}</span>
      {hasSecondary && (
        <span
          className={cn(
            'text-caption-1 font-normal',
            appearance === 'primary' ? 'text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {secondary}
        </span>
      )}
    </span>
  );

  return (
    <BaseButton
      {...rest}
      appearance={appearance}
      size={size}
      className={cn(
        'h-auto items-center justify-start gap-3 text-start',
        paddingClasses[size],
        className,
      )}
    >
      {iconPosition === 'after' ? (
        <>
          {content}
          {iconElement}
        </>
      ) : (
        <>
          {iconElement}
          {content}
        </>
      )}
    </BaseButton>
  );
};

CompoundButton.displayName = 'CompoundButton';
