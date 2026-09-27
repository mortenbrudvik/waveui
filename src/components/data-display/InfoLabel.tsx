import * as React from 'react';
import { cn } from '../../lib/cn';
import { resolveDeprecatedProp } from '../../lib/dev';
import { useId } from '../../hooks/useId';
import { markFieldLabel } from '../input/fieldLabel';
import { Label, type LabelProps } from '../input/Label';
import { InfoButton } from './InfoButton';

/** Properties for the InfoLabel component. */
export interface InfoLabelProps
  extends
    Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    Pick<LabelProps, 'htmlFor' | 'required' | 'size' | 'weight' | 'disabled'> {
  /** The label content (Fluent's `children`). */
  children?: React.ReactNode;
  /**
   * The label content.
   * @deprecated Use `children`.
   */
  label?: React.ReactNode;
  /** The information the info button's note shows: text, links or other rich content. */
  info: React.ReactNode;
  /**
   * Accessible name of the info button: the second half of its name, after the label text
   * ("Password Information"). Localize it here.
   * @default 'Information'
   */
  infoButtonLabel?: string;
  /**
   * Opens the note on a mouse hover, after a short delay, and on keyboard focus, next to a click
   * (see `InfoButton`'s `openOnHover`, which this passes through unchanged).
   * @default true
   */
  openOnHover?: boolean;
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/**
 * A label followed by a button that reveals more information about it (Fluent's InfoLabel): the
 * label renders in a real `<label htmlFor>`, and the button shows `info` — text, links or other
 * rich content — in a note next to it, rendered once whether the note is open or closed (see
 * `InfoButton`, which owns that note and its opening, closing and Tab order).
 *
 * - `children` is the label content; `label` is a deprecated alias (a warning fires once, and
 *   `children` wins when both are given).
 * - `htmlFor`, `required`, `size`, `weight` and `disabled` route to the `<label>`; `disabled` dims
 *   only the label text, and the info button stays usable.
 * - The button is named "‹label text› ‹infoButtonLabel›" through `aria-labelledby`, which points
 *   at the `<label>` and at the button's own id (whose `aria-label` supplies the second half), so
 *   several InfoLabels on a page are told apart; `infoButtonLabel` localizes that second half.
 *   `openOnHover` and `size` reach the button too.
 * - No `controlRef`: InfoLabel is a label, not a form control, so C-ROUTING's composite-control
 *   routing does not apply to it; a layout that needs the button's own element renders `InfoButton`
 *   next to a `Label` instead.
 *
 * @example
 * <InfoLabel info="Use at least 8 characters.">Password</InfoLabel>
 */
export const InfoLabel = ({
  children,
  label,
  info,
  infoButtonLabel = 'Information',
  openOnHover,
  id,
  htmlFor,
  required,
  size = 'medium',
  weight,
  disabled,
  className,
  ref,
  ...rest
}: InfoLabelProps) => {
  const content = resolveDeprecatedProp('InfoLabel', children, label, 'label', 'children');
  const generatedLabelId = useId('info-label');
  const labelId = id ?? generatedLabelId;
  const buttonId = useId('info-label-button');
  return (
    <span ref={ref} className={cn('inline-flex items-center gap-0', className)} {...rest}>
      <Label
        id={labelId}
        htmlFor={htmlFor}
        required={required}
        size={size}
        weight={weight}
        disabled={disabled}
      >
        {content}
      </Label>
      <InfoButton
        id={buttonId}
        info={info}
        size={size}
        openOnHover={openOnHover}
        aria-label={infoButtonLabel}
        aria-labelledby={`${labelId} ${buttonId}`}
      />
    </span>
  );
};

InfoLabel.displayName = 'InfoLabel';
markFieldLabel(InfoLabel);
