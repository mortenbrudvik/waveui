import * as React from 'react';
import { cn } from '../../lib/cn';
import { labelClassNames } from '../../lib/classNames';
import { markFieldLabel } from './fieldLabel';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import type { CoreSize, TextWeight } from '../../lib/types';

/** Properties for the Label component. */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Whether to show a required indicator. `true` shows a decorative asterisk; other content
   * replaces it (for example a `(required)` text). Decorative (`aria-hidden`), so it must not be
   * focusable; mark the control itself `required`.
   * @default false
   */
  required?: boolean | React.ReactNode;
  /** Whether the label is visually dimmed.
   * @default false
   */
  disabled?: boolean;
  /** Text size of the label: `small` = caption-1, `medium` = body-1, `large` = body-2.
   * @default 'medium'
   */
  size?: CoreSize;
  /** Font weight of the label (the shared `TextWeight` vocabulary).
   * @default 'regular'
   */
  weight?: TextWeight;
  /** Ref to the `<label>` element. */
  ref?: React.Ref<HTMLLabelElement>;
  /**
   * Props for the elements the Label draws inside its root, by part, merged into each part's
   * own (Fluent UI's `required` slot prop): your classes after the part's (yours win a
   * conflict), your styles over its styles, your handlers and attributes added, your ref
   * attached. Every attribute the Label sets on a part is locked. A part takes no `children`
   * (the `required` prop gives the indicator its content).
   */
  slotProps?: {
    /**
     * The `<span>` of the required indicator, rendered while `required` shows one (stable class
     * `wave-label__required`). Locked: `aria-hidden`, which keeps it out of the label's name.
     */
    required?: SlotPart<'span'>;
  };
}

const sizeMap: Record<CoreSize, string> = {
  small: 'text-caption-1',
  medium: 'text-body-1',
  large: 'text-body-2',
};

const weightMap: Record<TextWeight, string | undefined> = {
  regular: undefined,
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

/**
 * A text label for a form control (`htmlFor`), on the Fluent type ramp. The optional required
 * indicator is decorative (`aria-hidden`). `Field` renders its own label; use `Label` for custom
 * layouts.
 *
 * @example
 * <Label htmlFor="email" required>Email</Label>
 * <Input id="email" required />
 */
export const Label = ({
  required = false,
  disabled = false,
  size = 'medium',
  weight = 'regular',
  className,
  children,
  ref,
  slotProps,
  ...rest
}: LabelProps) => {
  const requiredProps = mergeSlotProps(slotProps?.required, {
    className: cn(labelClassNames.required, 'ms-1 text-error'),
    locked: { 'aria-hidden': 'true' },
  });
  return (
    <label
      ref={ref}
      className={cn(
        labelClassNames.root,
        disabled ? 'text-muted-foreground' : 'text-foreground',
        sizeMap[size],
        weightMap[weight],
        className,
      )}
      {...rest}
    >
      {children}
      {required === true ? (
        <span {...requiredProps}>*</span>
      ) : required !== false && slotRendersContent(required) ? (
        <span {...requiredProps}>{materialiseSlotContent(required)}</span>
      ) : null}
    </label>
  );
};

Label.displayName = 'Label';
markFieldLabel(Label);
