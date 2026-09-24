import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Size, Appearance } from '../../lib/types';
import { Button } from './Button';

/**
 * The CompoundButton's own props (the XOwnProps rule of `PolymorphicProps`: component-specific
 * props only). Every other prop comes from the rendered element (`as`).
 */
export interface CompoundButtonOwnProps {
  /** Secondary descriptive text displayed below the main label (part of the accessible name). */
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
   */
  disabled?: boolean;
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

/** Vertical padding per size; height, horizontal padding and font size come from Button. */
const paddingClasses: Record<Size, string> = {
  'extra-small': 'py-0.5',
  small: 'py-1',
  medium: 'py-2',
  large: 'py-3',
  'extra-large': 'py-4',
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
 * A button with a main label and a secondary line of text below it. Built on {@link Button}:
 * same appearances, sizes, token colors, `type="button"` default and polymorphic `as` behaviour
 * (`as="a"` renders a link; a non-interactive `as` gets `role="button"`, a tab stop and
 * Enter/Space activation; `disabled` becomes `aria-disabled` on non-form-control elements).
 *
 * @example
 * <CompoundButton secondaryText="Opens your email client">Send mail</CompoundButton>
 * <CompoundButton as="a" href="/signup" appearance="primary" secondaryText="Free for 30 days">
 *   Create account
 * </CompoundButton>
 */
export const CompoundButton: PolymorphicComponent<'button', CompoundButtonOwnProps> = (props) => {
  const {
    secondaryText,
    appearance = 'outline',
    size = 'medium',
    className,
    children,
    ...rest
  } = props as CompoundButtonImplProps;

  return (
    <BaseButton
      {...rest}
      appearance={appearance}
      size={size}
      className={cn('h-auto flex-col items-start text-start', paddingClasses[size], className)}
    >
      <span className="font-bold">{children}</span>
      {secondaryText != null && secondaryText !== false && secondaryText !== '' && (
        <span
          className={cn(
            'text-caption-1 font-normal',
            appearance === 'primary' ? 'text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {secondaryText}
        </span>
      )}
    </BaseButton>
  );
};

CompoundButton.displayName = 'CompoundButton';
