import * as React from 'react';
import { wcn } from '../../lib/cn';
import { buttonClassNames, compoundButtonClassNames } from '../../lib/classNames';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Size, Appearance, IconPosition, Slot } from '../../lib/types';
import { Button } from './Button';
import { withPartClass } from './Button.slots';

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
  /**
   * Props for the elements the CompoundButton draws inside the button, by part, merged into each
   * part's own (Fluent UI's `contentContainer` and `secondaryContent` slot props; the button
   * itself and its `icon` are the Button's, reached through the CompoundButton's own props):
   * your classes after the part's (yours win a conflict), your styles over its styles, your
   * handlers and attributes added, your ref attached. Every attribute the CompoundButton sets on
   * a part is locked. A part takes no `children` (the label and `secondaryText` are its content).
   * No part carries a handler of the button: a click on a part is a click on the button, after
   * yours, so `preventDefault()` in yours cancels the button's native activation (the submission
   * of a submit button), while the button's own `onClick` still runs. While the button is
   * `disabled` or `disabledFocusable`, your `onClick` on a part is not called, as the button's
   * own is not. A CompoundButton with only an icon draws no part and ignores them.
   */
  slotProps?: {
    /**
     * The `<span>` column that holds the two lines of text (stable class
     * `wave-compound-button__content-container`). Locked: `data-wave-compound-content`, the
     * marker of the column.
     */
    contentContainer?: SlotPart<'span'>;
    /**
     * The `<span>` of the main label, the CompoundButton's `children`, whose text names the
     * button (stable class `wave-compound-button__primary-text`). Locked unset: `aria-label` (it
     * would replace the text in the button's name), `hidden`, `inert` and `aria-hidden`.
     */
    primaryText?: SlotPart<'span'>;
    /**
     * The `<span>` of the second line, rendered while `secondaryText` renders content, whose text
     * is part of the button's name (stable class `wave-compound-button__secondary-text`). Locked
     * unset: `aria-label`, `hidden`, `inert` and `aria-hidden`, as on `primaryText`.
     */
    secondaryText?: SlotPart<'span'>;
  };
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
  'extra-small': 'wave:py-0.5',
  small: 'wave:py-1',
  medium: 'wave:py-2',
  large: 'wave:py-3',
  'extra-large': 'wave:py-4',
};

/** The icon box per size (its SVG fills it): 24px at extra-small, 32px at small, else 40px. */
const iconBoxClasses: Record<Size, string> = {
  'extra-small': 'wave:size-6',
  small: 'wave:size-8',
  medium: 'wave:size-10',
  large: 'wave:size-10',
  'extra-large': 'wave:size-10',
};

/**
 * What the two text parts lock unset: their text is the button's name, which an `aria-label`
 * would replace and the hidden state would take away.
 */
const TEXT_PART_LOCKS = {
  'aria-label': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

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
    slotProps,
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
        icon={withPartClass(icon, compoundButtonClassNames.icon)}
        iconPosition={iconPosition}
        className={wcn(compoundButtonClassNames.root, className)}
      />
    );
  }

  const iconElement = renderSlot(
    slotRendersContent(icon) ? icon : undefined,
    'span',
    wcn(
      buttonClassNames.icon,
      compoundButtonClassNames.icon,
      'wave:inline-flex wave:shrink-0 wave:items-center wave:justify-center wave:[&>svg]:size-full',
      iconBoxClasses[size],
    ),
    { 'aria-hidden': true },
  );
  // A button that does not activate calls no click handler of a part either.
  const blockHandlers =
    rest.disabled || rest.disabledFocusable ? (['onClick'] as const) : undefined;
  const content = (
    <span
      {...mergeSlotProps(slotProps?.contentContainer, {
        className: wcn(
          compoundButtonClassNames.contentContainer,
          'wave:flex wave:min-w-0 wave:flex-col wave:items-start',
        ),
        locked: { 'data-wave-compound-content': '' },
        blockHandlers,
      })}
    >
      <span
        {...mergeSlotProps(slotProps?.primaryText, {
          className: wcn(compoundButtonClassNames.primaryText, 'wave:font-bold'),
          // The text names the button: a part neither renames nor hides it.
          locked: TEXT_PART_LOCKS,
          blockHandlers,
        })}
      >
        {label}
      </span>
      {hasSecondary && (
        <span
          {...mergeSlotProps(slotProps?.secondaryText, {
            className: wcn(
              compoundButtonClassNames.secondaryText,
              'wave:text-caption-1 wave:font-normal',
              appearance === 'primary'
                ? 'wave:text-primary-foreground'
                : 'wave:text-muted-foreground',
            ),
            locked: TEXT_PART_LOCKS,
            blockHandlers,
          })}
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
      className={wcn(
        compoundButtonClassNames.root,
        'wave:h-auto wave:items-center wave:justify-start wave:gap-3 wave:text-start',
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
