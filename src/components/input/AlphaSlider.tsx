import * as React from 'react';
import { alphaSliderClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { hsvToHex } from '../../lib/color';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getDirection } from '../../lib/direction';
import type { HsvColor } from '../../lib/types';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { useColorPartState } from './ColorPicker.parts';
import type { ColorSliderProps } from './ColorSlider';
import {
  COLOR_THUMB_CLASSES,
  RAIL_GRADIENT,
  RAIL_INPUT_CLASSES,
  RAIL_INPUT_HORIZONTAL,
  RAIL_INPUT_VERTICAL,
  RAIL_ROOT_HORIZONTAL,
  RAIL_ROOT_VERTICAL,
  RAIL_TRACK_HORIZONTAL,
  RAIL_TRACK_VERTICAL,
  THUMB_POSITION_HORIZONTAL,
  THUMB_POSITION_VERTICAL,
  THUMB_TRACK_HORIZONTAL,
  THUMB_TRACK_VERTICAL,
  alphaSliderGradient,
  alphaValueText,
  displayColor,
  railKeyTarget,
  toPercent,
  toPosition,
} from './colorUtils';

/** Texts of an AlphaSlider, for localisation. Every key is optional. */
export interface AlphaSliderLabels {
  /** Name of the slider.
   * @default 'Opacity'
   */
  opacity?: string;
  /** Name of the slider with `transparency`.
   * @default 'Transparency'
   */
  transparency?: string;
  /** Replaces the value text ("40%"), for languages whose order differs. */
  valueText?: (color: HsvColor, transparency: boolean) => string;
}

/** Properties for the AlphaSlider component. */
export interface AlphaSliderProps extends Omit<ColorSliderProps, 'channel' | 'labels'> {
  /**
   * Shows transparency (100 % is fully transparent) instead of opacity: the rail, the input's
   * value, the value text and the arrow direction all follow it, while `value.a` stays the
   * opacity (Fluent's `transparency`).
   * @default false
   */
  transparency?: boolean;
  /** Texts of the slider; bound to a ColorPicker, the picker's `labels` fill the keys you leave out. */
  labels?: AlphaSliderLabels;
}

const DEFAULT_LABELS = { opacity: 'Opacity', transparency: 'Transparency' } as const;

/**
 * A slider for a color's opacity, drawn over a checkerboard, horizontal (mirrored in right-to-left
 * layouts) or vertical (bottom to top); `transparency` shows transparency instead. The arrow keys
 * move by 1 %, Shift with an arrow and Page Up or Page Down by 10, Home and End to the ends. It is
 * named by `aria-label`, else the surrounding Field's label, else "Opacity" ("Transparency").
 * Inside a ColorPicker, leave `value` and `defaultValue` out and it binds to the picker. Fluent's
 * `AlphaSlider`, with `value`/`onValueChange` for its `color`/`onChange`.
 *
 * @example
 * <AlphaSlider value={color} onValueChange={setColor} />
 */
export const AlphaSlider = ({
  transparency = false,
  orientation = 'horizontal',
  value,
  defaultValue,
  onValueChange,
  shape,
  labels,
  disabled = false,
  name,
  form,
  required,
  controlRef,
  className,
  style,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  autoFocus,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  ref,
  ...rest
}: AlphaSliderProps) => {
  const part = useColorPartState({ value, defaultValue, onValueChange, disabled });
  const { picker } = part;
  const pickerValueText = picker?.labels.valueText;
  const strings = {
    ...DEFAULT_LABELS,
    ...(picker && {
      opacity: picker.labels.opacity,
      transparency: picker.labels.transparency,
      valueText: pickerValueText && ((color: HsvColor) => pickerValueText(color, 'alpha')),
    }),
    ...labels,
  };
  const resolvedShape = shape ?? picker?.shape ?? 'rounded';
  const vertical = orientation === 'vertical';
  const shown = displayColor(part.color);
  const opacity = toPercent(shown.a);
  const current = transparency ? 100 - opacity : opacity;

  const field = useFieldContext();
  const fieldProps = useFieldControl({
    id,
    'aria-label':
      ariaLabel ??
      (field === null && ariaLabelledBy === undefined
        ? transparency
          ? strings.transparency
          : strings.opacity
        : undefined),
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  });
  // A slider supports neither aria-required nor a native `required`: the hidden input carries it.
  const { 'aria-required': _ariaRequired, required: _required, ...inputFieldProps } = fieldProps;
  const invalid = inputFieldProps['aria-invalid'];
  const isInvalid = invalid !== undefined && invalid !== false && invalid !== 'false';
  const isRequired =
    required ?? (ariaRequired === true || ariaRequired === 'true' || (field?.required ?? false));

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedControlRef = useMergedRefs(inputRef, controlRef);
  useFormReset(inputRef, part.reset, form);

  /** Applies a value of the input's range: the opacity in percent, or the transparency. */
  const apply = (next: number) => {
    if (next === current) return;
    part.setColor({ ...part.color, a: (transparency ? 100 - next : next) / 100 });
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (part.disabled || event.nativeEvent.isComposing) return;
      const target = railKeyTarget(
        event.key,
        event,
        getDirection(event.currentTarget),
        current,
        100,
      );
      if (target === null) return;
      event.preventDefault();
      apply(target);
    },
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (part.disabled) return;
    apply(Math.min(100, Math.max(0, Math.round(Number(event.currentTarget.value)))));
  };

  const sliderStyle = {
    ...style,
    '--wave-color-slider-gradient': alphaSliderGradient(shown, transparency, orientation),
    '--wave-color-slider-position': toPosition(current / 100),
    '--wave-color-thumb': hsvToHex(shown),
  } as React.CSSProperties;

  return (
    <div
      data-orientation={orientation}
      data-disabled={part.disabled ? '' : undefined}
      className={cn(
        alphaSliderClassNames.root,
        'group/alpha-slider relative flex touch-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        vertical ? RAIL_ROOT_VERTICAL : RAIL_ROOT_HORIZONTAL,
        className,
      )}
      style={sliderStyle}
      {...rest}
      ref={ref}
    >
      <div
        aria-hidden="true"
        className={cn(
          alphaSliderClassNames.rail,
          'relative overflow-hidden rounded-full bg-[conic-gradient(var(--wave-stroke)_25%,var(--wave-background)_0_50%,var(--wave-stroke)_0_75%,var(--wave-background)_0)] bg-size-[8px_8px] forced-colors:forced-color-adjust-none',
          vertical ? RAIL_TRACK_VERTICAL : RAIL_TRACK_HORIZONTAL,
          resolvedShape === 'square' && 'rounded-none',
        )}
      >
        <span className={cn('absolute inset-0', RAIL_GRADIENT)} />
      </div>
      <input
        type="range"
        {...inputFieldProps}
        ref={mergedControlRef}
        min={0}
        max={100}
        step={1}
        value={current}
        disabled={part.disabled}
        dir={vertical ? 'ltr' : undefined}
        aria-orientation={vertical ? 'vertical' : undefined}
        aria-valuetext={alphaValueText(shown, transparency, strings.valueText)}
        aria-errormessage={(isInvalid && ariaErrorMessage) || undefined}
        aria-details={ariaDetails}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onChange={handleChange}
        className={cn(RAIL_INPUT_CLASSES, vertical ? RAIL_INPUT_VERTICAL : RAIL_INPUT_HORIZONTAL)}
      />
      <span aria-hidden="true" className={vertical ? THUMB_TRACK_VERTICAL : THUMB_TRACK_HORIZONTAL}>
        <span
          className={cn(
            alphaSliderClassNames.thumb,
            COLOR_THUMB_CLASSES,
            vertical ? THUMB_POSITION_VERTICAL : THUMB_POSITION_HORIZONTAL,
            'group-has-[:focus-visible]/alpha-slider:ring-2 group-has-[:focus-visible]/alpha-slider:ring-background forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas] group-has-[:focus-visible]/alpha-slider:outline-2 group-has-[:focus-visible]/alpha-slider:outline-offset-2 group-has-[:focus-visible]/alpha-slider:outline-ring forced-colors:group-has-[:focus-visible]/alpha-slider:outline-[Highlight]',
          )}
        />
      </span>
      {!picker && (
        <HiddenInput
          type="text"
          name={name}
          form={form}
          disabled={part.disabled}
          value={hsvToHex(part.color)}
          required={isRequired}
          onInvalid={() => inputRef.current?.focus()}
        />
      )}
    </div>
  );
};

AlphaSlider.displayName = 'AlphaSlider';
