import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { CheckIcon } from '../../lib/icons';
import { focusRing, forcedColors, motionSafeTransition } from '../../lib/styles';
import type { Shape, Size } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { HiddenInput } from '../internal/HiddenInput';
import { getCheckColors } from './colorUtils';

/** Represents a single color swatch option. */
export interface SwatchItem {
  /** Unique identifier for the swatch (the value `onValueChange` reports and a form submits). */
  value: string;
  /** CSS color value (e.g., hex, rgb) used as the swatch background. */
  color: string;
  /**
   * Accessible name of the swatch, e.g. `'Cranberry'`. **Required for accessibility**: without it
   * the swatch is announced by its raw color value (`'#d13438'`) and a development warning is
   * logged.
   */
  label?: string;
}

/** Size of the swatches. */
export type SwatchPickerSize = Extract<Size, 'small' | 'medium' | 'large'>;

/** Properties for the SwatchPicker component. */
export interface SwatchPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** The swatches to display, in order (a readonly array is accepted; it is never modified). */
  items: readonly SwatchItem[];
  /** Controlled selected swatch value (`''` = nothing selected). */
  value?: string;
  /** Initial selected value for uncontrolled usage (also what a form reset restores).
   * @default ''
   */
  defaultValue?: string;
  /** Called with the new value when the selection changes (not when the selected swatch is chosen again). */
  onValueChange?: (value: string) => void;
  /**
   * Called with the new value when the selection changes.
   * @deprecated Use `onValueChange`.
   */
  onChange?: (value: string) => void;
  /** Size of each swatch button (24, 32 or 40px).
   * @default 'medium'
   */
  size?: SwatchPickerSize;
  /** Shape of each swatch button.
   * @default 'circular'
   */
  shape?: Shape;
  /**
   * Form field name. With a name, the selected swatch's `value` is submitted with the form
   * (nothing while no swatch is selected).
   */
  name?: string;
  /** A swatch must be selected before the form can be submitted (native validation). */
  required?: boolean;
  /** Id of the form the picker belongs to, when it is rendered outside that form. */
  form?: string;
  /** Ref to the `role="radiogroup"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

const sizeMap: Record<SwatchPickerSize, string> = {
  small: 'w-6 h-6',
  medium: 'w-8 h-8',
  large: 'w-10 h-10',
};

const checkSizeMap: Record<SwatchPickerSize, number> = {
  small: 12,
  medium: 16,
  large: 20,
};

const shapeMap: Record<Shape, string> = {
  circular: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded',
};

/**
 * The check glyph of the selected swatch: black or white by the swatch's luminance, drawn over a
 * halo in the other color so it stays visible on any swatch (C-TOKENS exception for
 * user-supplied colors, `input-pickers#16`).
 */
function SwatchCheck({ color, size }: { color: string; size: number }) {
  const { glyph, halo } = getCheckColors(color);
  return (
    <span aria-hidden="true" className="pointer-events-none grid">
      <CheckIcon
        size={size}
        strokeWidth={4}
        className="col-start-1 row-start-1"
        style={{ color: halo }}
      />
      <CheckIcon
        size={size}
        strokeWidth={2}
        className="col-start-1 row-start-1"
        style={{ color: glyph }}
      />
    </span>
  );
}

/**
 * A single-select grid of color swatches (`role="radiogroup"` of `role="radio"` buttons).
 *
 * - **Keyboard** (APG radio group): one tab stop — the selected swatch, else the first. All four
 *   arrow keys move focus and select (Left/Right mirrored under `dir="rtl"`), wrapping at the
 *   ends; Home/End jump to the first/last swatch.
 * - **Selected indicator**: an offset ring in the foreground color (drawn on the page background,
 *   not on the swatch) plus a check glyph whose color is picked by the swatch's luminance, so the
 *   selection never relies on color alone.
 * - **Naming**: give the group a name with `aria-label`/`aria-labelledby` or render it inside a
 *   `Field`, and give every item a `label`; both are reported in development when missing.
 * - **Forms**: with `name` (or `required`) it takes part in native forms; a form reset restores
 *   `defaultValue`.
 *
 * @example
 * <SwatchPicker aria-label="Accent color" items={[{ value: 'red', color: '#d13438', label: 'Red' }]} />
 */
export const SwatchPicker = ({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  size = 'medium',
  shape = 'circular',
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
  ref,
  ...rest
}: SwatchPickerProps) => {
  if (onChange !== undefined) warnDeprecated('SwatchPicker', 'onChange', 'onValueChange');
  const initialValue = defaultValue ?? '';
  const [value, setValue] = useControllable(valueProp, initialValue, (next: string) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  const { containerProps, getTabIndex } = useRovingTabIndex({
    activeValue: value || null,
    orientation: 'both',
    // APG radio group: moving focus also selects.
    onFocusMove: (next) => setValue(next),
  });

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
      // An explicit `required={false}` wins over a required Field, so aria-required matches
      // `isRequired`.
      'aria-required': ariaRequired ?? required,
    },
    { labelable: false },
  );
  const isRequired = required ?? field?.required ?? false;

  const unnamed =
    fieldProps['aria-label'] === undefined && fieldProps['aria-labelledby'] === undefined;
  const unlabelledItem = items.find((item) => !item.label)?.value;
  React.useEffect(() => {
    if (unnamed) {
      warnOnce(
        'SwatchPicker:unnamed',
        'SwatchPicker: the radiogroup has no accessible name. Pass `aria-label` or `aria-labelledby`, or render it inside a Field.',
      );
    }
  }, [unnamed]);
  React.useEffect(() => {
    if (unlabelledItem !== undefined) {
      warnOnce(
        'SwatchPicker:item-label',
        `SwatchPicker: swatch "${unlabelledItem}" has no \`label\`, so it is announced by its color value. Give every item a \`label\`.`,
      );
    }
  }, [unlabelledItem]);

  useFormReset(rootRef, () => setValue(initialValue), form);

  const focusTabStop = () => {
    rootRef.current?.querySelector<HTMLElement>('[data-roving-value][tabindex="0"]')?.focus();
  };

  return (
    <div
      role="radiogroup"
      {...fieldProps}
      className={cn('relative flex flex-wrap gap-2', className)}
      {...rest}
      ref={mergedRef}
      data-roving-container=""
      onKeyDown={composeEventHandlers(onKeyDown, containerProps.onKeyDown)}
      onFocus={composeEventHandlers(onFocus, containerProps.onFocus, {
        checkDefaultPrevented: false,
      })}
    >
      {items.map((item) => {
        const isSelected = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={item.label || item.color}
            data-roving-value={item.value}
            data-selected={isSelected ? '' : undefined}
            tabIndex={getTabIndex(item.value)}
            onClick={() => setValue(item.value)}
            className={cn(
              sizeMap[size],
              shapeMap[shape],
              // The padding is set here (C-NATIVE); the swatch color is its background.
              'relative flex shrink-0 items-center justify-center border-2 border-transparent p-0',
              motionSafeTransition,
              // User colors are the content: keep them (and the check glyph) in forced colors.
              'forced-colors:forced-color-adjust-none',
              forcedColors.border,
              focusRing,
              // Outside the selection ring, so both stay visible together.
              'focus-visible:outline-offset-4',
              isSelected
                ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                : 'hover:border-stroke-hover',
            )}
            style={{ backgroundColor: item.color }}
          >
            {isSelected && <SwatchCheck color={item.color} size={checkSizeMap[size]} />}
          </button>
        );
      })}
      <HiddenInput
        type="radio"
        name={name}
        form={form}
        value={value}
        required={isRequired}
        onInvalid={focusTabStop}
      />
    </div>
  );
};

SwatchPicker.displayName = 'SwatchPicker';
