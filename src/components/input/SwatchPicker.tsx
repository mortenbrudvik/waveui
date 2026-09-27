import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import type { Shape } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { HiddenInput } from '../internal/HiddenInput';
import {
  SwatchPickerContext,
  useSwatchRegistry,
  type SwatchPickerContextValue,
  type SwatchPickerSize,
} from './SwatchPicker.context';
import { ColorSwatch } from './SwatchPicker.swatches';

export type { SwatchPickerSize } from './SwatchPicker.context';

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

/** Properties for the SwatchPicker component. */
export interface SwatchPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /**
   * The swatches to display, in order (a readonly array is accepted; it is never modified):
   * rendered as `ColorSwatch` elements, before `children`.
   */
  items?: readonly SwatchItem[];
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
  // D18: an explicit C-ROUTING exception — a swatch's own ref/className/style/rest land on its
  // button, so a wrapping element's props reach the element that has focus.
  /**
   * Swatches rendered directly, in order, after `items` (e.g. `ColorSwatch`): read the picker's
   * context, so they may be wrapped in a `Tooltip` or another element that forwards its own props.
   */
  children?: React.ReactNode;
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

/**
 * A single-select group of color swatches (`role="radiogroup"` of `role="radio"` buttons).
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
 * - **Composition**: `items` render as `ColorSwatch` elements before `children`, all in the one
 *   radiogroup. A `ColorSwatch` (or another swatch reading the picker's context) rendered directly
 *   as a child lets you wrap it, for example in a `Tooltip` with `relationship="label"` to name
 *   and describe it. A swatch rendered outside any `SwatchPicker` throws in development.
 *
 * @example
 * <SwatchPicker aria-label="Accent color" items={[{ value: 'red', color: '#d13438', label: 'Red' }]} />
 *
 * @example
 * <SwatchPicker aria-label="Accent color">
 *   <ColorSwatch value="red" color="#d13438" aria-label="Red" />
 * </SwatchPicker>
 */
export const SwatchPicker = ({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  children,
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
  const unlabelledItem = items?.find((item) => !item.label)?.value;
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

  const register = useSwatchRegistry();
  const contextValue = React.useMemo<SwatchPickerContextValue>(
    () => ({
      value,
      select: setValue,
      size,
      shape,
      layout: 'row',
      focusMode: 'arrow',
      spacing: 'medium',
      getTabIndex,
      register,
    }),
    [value, setValue, size, shape, getTabIndex, register],
  );

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
      <SwatchPickerContext.Provider value={contextValue}>
        {items?.map((item) => (
          <ColorSwatch
            key={item.value}
            value={item.value}
            color={item.color}
            aria-label={item.label || item.color}
          />
        ))}
        {children}
      </SwatchPickerContext.Provider>
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
