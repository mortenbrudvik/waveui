import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { StarIcon } from '../../lib/icons';
import { focusRing } from '../../lib/styles';
import type { Size } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { HiddenInput } from '../internal/HiddenInput';

/** Properties for the Rating component. */
export interface RatingProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Controlled rating value (`0` = no rating). */
  value?: number;
  /** Initial rating for uncontrolled usage (also the value a form reset restores).
   * @default 0
   */
  defaultValue?: number;
  /** Called with the new rating when it changes (not when the current star is chosen again). */
  onValueChange?: (value: number) => void;
  /**
   * Called with the new rating, exactly like `onValueChange`: only when the rating changes (0.4
   * also called it when the current star was clicked again, or a key was pressed at an end).
   * @deprecated Use `onValueChange`.
   */
  onChange?: (value: number) => void;
  /** Maximum number of stars.
   * @default 5
   */
  max?: number;
  /** Size of the star icons. Every size keeps a target of at least 24×24px.
   * @default 'medium'
   */
  size?: Size;
  /** Whether the rating is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /**
   * Form field name. With a name, the chosen rating is submitted with the form (nothing while no
   * star is chosen).
   */
  name?: string;
  /** A star must be chosen before the form can be submitted (native validation). */
  required?: boolean;
  /** Id of the form the rating belongs to, when it is rendered outside that form. */
  form?: string;
  /** Ref to the `role="radiogroup"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the RatingDisplay (read-only) component. */
export interface RatingDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Rating value to display. A fraction is drawn as a partly filled star (`4.6` fills 60% of the
   * fifth star), so the stars show the value the accessible name reports.
   */
  value: number;
  /** Maximum number of stars.
   * @default 5
   */
  max?: number;
  /** Size of the star icons.
   * @default 'medium'
   */
  size?: Size;
  /** Ref to the root element. */
  ref?: React.Ref<HTMLDivElement>;
}

const sizeMap: Record<Size, string> = {
  'extra-small': 'h-3 w-3',
  small: 'h-4 w-4',
  medium: 'h-5 w-5',
  large: 'h-6 w-6',
  'extra-large': 'h-8 w-8',
};

/** Padding that gives every interactive star a target of at least 24×24px (WCAG 2.5.8). */
const targetPaddingMap: Record<Size, string> = {
  'extra-small': 'p-1.5', // 12px icon + 12px
  small: 'p-1', // 16px icon + 8px
  medium: 'p-0.5', // 20px icon + 4px
  large: 'p-0.5',
  'extra-large': 'p-0.5',
};

/** A filled star, or an outlined one (the outline keeps a 3:1 non-text contrast). */
function Star({ filled, className }: { filled: boolean; className: string }) {
  return filled ? (
    <StarIcon className={className} />
  ) : (
    <StarIcon className={className} fill="none" stroke="currentColor" strokeWidth={1.5} />
  );
}

/**
 * A star rating input (`role="radiogroup"` of `role="radio"` stars).
 *
 * - One tab stop (the chosen star, else the first). Keys choose relative to the current rating and
 *   move focus to the chosen star, as in 0.4: Right/Up one star more, Left/Down one fewer
 *   (Left/Right mirrored under `dir="rtl"`), Home/End the first/last star. From an empty rating,
 *   Right/Up/Home choose 1 star. Keys at the ends (and Left/Down while empty) emit nothing.
 * - The keyboard cannot clear a rating: Left/Down stop at 1 star (APG radio group; 0.4 went down
 *   to 0). Only a controlled `value={0}` (or a form reset while `defaultValue` is 0) clears it.
 * - `onValueChange` (and the deprecated `onChange` alias) fire only when the rating changes, so
 *   choosing the current star again calls neither.
 * - Hovering previews a value; the preview never outlives the hover or a disabled state.
 * - Inside a `Field` it is named by the Field label (instead of the default "Rating") and
 *   described by its hint and error.
 * - With `name` (or `required`) it takes part in native forms; a form reset restores
 *   `defaultValue`.
 */
export const Rating = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  max = 5,
  size = 'medium',
  disabled = false,
  name,
  required,
  form,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  onKeyDown,
  onFocus,
  onMouseLeave,
  ref,
  ...rest
}: RatingProps) => {
  if (onChange !== undefined) warnDeprecated('Rating', 'onChange', 'onValueChange');
  const initialValue = defaultValue ?? 0;
  const [value, setValue] = useControllable(valueProp, initialValue, (next: number) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  const [hovered, setHovered] = React.useState(0);
  // A hover preview must not survive the rating becoming disabled (adjust state during render).
  const [prevDisabled, setPrevDisabled] = React.useState(disabled);
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    if (disabled) setHovered(0);
  }
  const displayValue = disabled ? value : hovered || value;

  // Roving tab stop (the chosen star, else the first) and focus moves; the keys are handled below.
  const { containerProps, getTabIndex, focusValue } = useRovingTabIndex({
    activeValue: value > 0 ? String(value) : null,
  });

  // Keys count from the current rating, not from the focused star (0.4 semantics): from an empty
  // rating, Tab lands on the unchosen first star and Right/Up/Home choose it. Never wraps.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    let next: number;
    if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = max;
    else if (e.key === 'ArrowUp') next = value + 1;
    else if (e.key === 'ArrowDown') next = value - 1;
    else {
      const intent = getArrowIntent(e.key, {
        orientation: 'horizontal',
        dir: getDirection(e.currentTarget),
      });
      if (!intent) return;
      next = intent === 'next' ? value + 1 : value - 1;
    }
    e.preventDefault();
    next = Math.min(next, max);
    // The ends are no-ops (nothing is emitted, focus stays), and Left/Down never clear to 0.
    if (disabled || next < 1 || next === value) return;
    focusValue(String(next));
    setValue(next);
  };

  const rootRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, containerProps.ref, rootRef);

  const field = useFieldContext();
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      // An explicit `required={false}` wins over a required Field, so aria-required always
      // matches the native validation below (`isRequired`).
      'aria-required': ariaRequired ?? required,
    },
    { labelable: false },
  );
  const isRequired = required ?? field?.required ?? false;
  const defaultName =
    fieldProps['aria-label'] === undefined && fieldProps['aria-labelledby'] === undefined
      ? 'Rating'
      : undefined;

  useFormReset(rootRef, () => setValue(initialValue), form);

  const focusTabStop = () => {
    rootRef.current?.querySelector<HTMLElement>('[data-roving-value][tabindex="0"]')?.focus();
  };

  const starSize = sizeMap[size];

  return (
    <div
      role="radiogroup"
      aria-label={defaultName}
      {...fieldProps}
      aria-disabled={disabled || undefined}
      className={cn(
        'relative inline-flex items-center gap-0.5',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
      ref={mergedRef}
      data-roving-container=""
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      onFocus={composeEventHandlers(onFocus, containerProps.onFocus, {
        checkDefaultPrevented: false,
      })}
      onMouseLeave={composeEventHandlers(onMouseLeave, () => setHovered(0), {
        checkDefaultPrevented: false,
      })}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const key = String(starValue);
        const filled = displayValue >= starValue;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
            data-roving-value={key}
            tabIndex={disabled ? -1 : getTabIndex(key)}
            disabled={disabled}
            className={cn(
              'inline-flex cursor-pointer rounded border-0 bg-transparent transition-colors motion-reduce:transition-none disabled:cursor-not-allowed',
              targetPaddingMap[size],
              focusRing,
              filled ? 'text-rating' : 'text-stroke-accessible',
            )}
            onClick={() => {
              // Choosing the current star again is a no-op for both callbacks (useControllable).
              if (!disabled) setValue(starValue);
            }}
            onMouseEnter={() => {
              if (!disabled) setHovered(starValue);
            }}
          >
            <Star filled={filled} className={starSize} />
          </button>
        );
      })}
      <HiddenInput
        type="radio"
        name={name}
        form={form}
        disabled={disabled}
        value={value > 0 ? String(value) : ''}
        required={isRequired}
        onInvalid={focusTabStop}
      />
    </div>
  );
};
Rating.displayName = 'Rating';

/**
 * A read-only star rating (`role="img"` named "Rating: <value> out of <max>"). A fractional value
 * is drawn with a partly filled star, so the stars and the name show the same value.
 */
export const RatingDisplay = ({
  value,
  max = 5,
  size = 'medium',
  className,
  ref,
  ...rest
}: RatingDisplayProps) => {
  const starSize = sizeMap[size];

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Rating: ${value} out of ${max}`}
      className={cn('inline-flex items-center gap-0.5', className)}
      {...rest}
    >
      {Array.from({ length: max }, (_, i) => {
        // The share of this star that the value covers, in whole percent.
        const percent = Math.round(Math.min(1, Math.max(0, value - i)) * 100);
        if (percent > 0 && percent < 100) {
          // The outline of an empty star, with the filled star clipped to the fraction over it
          // from the inline start (the reading direction of the stars, also under RTL).
          return (
            <span key={i} className="relative inline-flex text-stroke-accessible">
              <Star filled={false} className={starSize} />
              <span
                className="absolute inset-y-0 start-0 flex overflow-hidden text-rating"
                style={{ width: `${percent}%` }}
              >
                <Star filled className={cn(starSize, 'shrink-0')} />
              </span>
            </span>
          );
        }
        const filled = percent === 100;
        return (
          <span
            key={i}
            className={cn('inline-flex', filled ? 'text-rating' : 'text-stroke-accessible')}
          >
            <Star filled={filled} className={starSize} />
          </span>
        );
      })}
    </div>
  );
};
RatingDisplay.displayName = 'RatingDisplay';
