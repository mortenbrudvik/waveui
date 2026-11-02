import * as React from 'react';
import { cn } from '../../lib/cn';
import { infoLabelClassNames } from '../../lib/classNames';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import type { MotionSlot } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { markFieldLabel } from '../input/fieldLabel';
import { Label, type LabelProps } from '../input/Label';
import { InfoButton, InfoNoteClassContext } from './InfoButton';

/** Properties for the InfoLabel component. */
export interface InfoLabelProps
  extends
    Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    Pick<LabelProps, 'htmlFor' | 'required' | 'size' | 'weight' | 'disabled'> {
  /** The label content (Fluent's `children`). */
  children?: React.ReactNode;
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
  /**
   * The motion of the info button's note, passed through unchanged (see `InfoButton`'s `motion`:
   * `undefined` is the default fade and slide, `null` none, a value replaces it). Fluent's
   * `Popover` `surfaceMotion`.
   * @default the fade and slide of InfoButton's note
   */
  motion?: MotionSlot | null;
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
  /**
   * Props for the elements the InfoLabel draws besides its root, by part, merged into each part's
   * own: your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref beside its ref. Every attribute the InfoLabel sets on
   * a part is locked and keeps its value (its own props routed there win); you add the
   * attributes it does not set. A part takes no `children`. The InfoLabel renders a `Label` and
   * an `InfoButton`: `label` and `infoButton` are their props, so their own rules apply, and
   * `info` is the InfoButton's `info` part (the InfoButton's beak is not a part here). Fluent UI's
   * InfoLabel has `label` and `infoButton` slots, and its `info` prop reaches the InfoButton's
   * `info` slot, the note.
   */
  slotProps?: {
    /**
     * The `<label>` of the label text, a `Label` (stable class `wave-info-label__label`). Your
     * handlers run as on a label of yours. Locked: `id` (the button's name points at it),
     * `htmlFor` and the Label props the InfoLabel passes on (`required`, `size`, `weight`,
     * `disabled`).
     */
    label?: SlotPart<'label'>;
    /**
     * The info `<button>`, the root of an `InfoButton` (stable class
     * `wave-info-label__info-button`): your props are the InfoButton's, so its rules apply (your
     * handlers run before its own; `preventDefault()` in yours skips its handling of the event,
     * its press and focus bookkeeping aside, as with an InfoButton you render). Locked: `id`,
     * `type` (a button), `aria-label` (`infoButtonLabel`), `aria-labelledby` (your ids are added
     * after the label's and the button's), `disabled` and `aria-haspopup` (unset), `tabIndex`,
     * `hidden`, `inert` and `aria-hidden` (unset), and the InfoButton props the InfoLabel passes on
     * (`info`, `size`, `openOnHover`, `motion` and the InfoButton's own `slotProps`, which carry
     * `info` below: one passed on through this part is ignored). A `data-*` attribute you set
     * replaces the InfoButton's own of that name (`data-size`), and its look does not follow it.
     */
    infoButton?: SlotPart<'button'>;
    /**
     * The InfoButton's note `<div role="note">`, rendered in a portal while it shows (stable
     * classes `wave-info-button__info` and `wave-info-label__info`): the InfoButton's `info`
     * part, with its locks and handler rules. The `motion` prop gives it its motion classes,
     * before yours.
     */
    info?: SlotPart<'div'>;
  };
}

/**
 * A label followed by a button that reveals more information about it (Fluent's InfoLabel): the
 * label renders in a real `<label htmlFor>`, and the button shows `info` — text, links or other
 * rich content — in a note next to it, rendered once whether the note is open or closed (see
 * `InfoButton`, which owns that note and its opening, closing and Tab order).
 *
 * - `children` is the label content.
 * - `htmlFor`, `required`, `size`, `weight` and `disabled` route to the `<label>`; `disabled` dims
 *   only the label text, and the info button stays usable.
 * - The button is named "‹label text› ‹infoButtonLabel›" through `aria-labelledby`, which points
 *   at the `<label>` and at the button's own id (whose `aria-label` supplies the second half), so
 *   several InfoLabels on a page are told apart; `infoButtonLabel` localizes that second half.
 *   `openOnHover`, `motion` and `size` reach the button too.
 * - No `controlRef`: InfoLabel is a label, not a form control, so C-ROUTING's composite-control
 *   routing does not apply to it; a layout that needs the button's own element renders `InfoButton`
 *   next to a `Label` instead.
 *
 * @example
 * <InfoLabel info="Use at least 8 characters.">Password</InfoLabel>
 */
export const InfoLabel = ({
  children,
  info,
  infoButtonLabel = 'Information',
  openOnHover,
  motion,
  id,
  htmlFor,
  required,
  size = 'medium',
  weight,
  disabled,
  className,
  ref,
  slotProps,
  ...rest
}: InfoLabelProps) => {
  const generatedLabelId = useId('info-label');
  // An empty `id` counts as unset, so the button's name never points at an empty id.
  const labelId = id || generatedLabelId;
  const buttonId = useId('info-label-button');
  // The note of this InfoButton carries the label's `info` class, its 0.8 popup class (P3-00 D8).
  const noteClass = React.useMemo(
    () => ({ buttonId, className: infoLabelClassNames.info }),
    [buttonId],
  );
  return (
    <span
      ref={ref}
      className={cn(infoLabelClassNames.root, 'inline-flex items-center gap-0', className)}
      {...rest}
    >
      <Label
        {...mergeSlotProps(slotProps?.label, {
          className: infoLabelClassNames.label,
          locked: { id: labelId, htmlFor, required, size, weight, disabled },
        })}
      >
        {children}
      </Label>
      <InfoNoteClassContext.Provider value={noteClass}>
        {/* The `infoButton` part is the InfoButton's own props; the `info` part reaches its note
            as the InfoButton's `info` part, which wins over one passed on through `infoButton`. */}
        <InfoButton
          {...mergeSlotProps(slotProps?.infoButton, {
            className: infoLabelClassNames.infoButton,
            locked: {
              id: buttonId,
              type: undefined,
              disabled: undefined,
              tabIndex: undefined,
              hidden: undefined,
              inert: undefined,
              'aria-hidden': undefined,
              'aria-haspopup': undefined,
              'aria-label': infoButtonLabel,
              'aria-labelledby': `${labelId} ${buttonId}`,
            },
          })}
          info={info}
          size={size}
          openOnHover={openOnHover}
          motion={motion}
          slotProps={slotProps?.info && { info: slotProps.info }}
        />
      </InfoNoteClassContext.Provider>
    </span>
  );
};

InfoLabel.displayName = 'InfoLabel';
markFieldLabel(InfoLabel);
