import * as React from 'react';
import { alphaSliderClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { hsvToHex } from '../../lib/color';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getDirection } from '../../lib/direction';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
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
export interface AlphaSliderProps extends Omit<
  ColorSliderProps,
  'channel' | 'labels' | 'slotProps'
> {
  /**
   * Shows transparency (100 % is fully transparent) instead of opacity: the rail, the input's
   * value, the value text and the arrow direction all follow it, while `value.a` stays the
   * opacity (Fluent's `transparency`).
   * @default false
   */
  transparency?: boolean;
  /** Texts of the slider; bound to a ColorPicker, the picker's `labels` fill the keys you leave out. */
  labels?: AlphaSliderLabels;
  /**
   * Props for the elements the slider draws, by part, merged into each part's own (Fluent UI's
   * `root`, `rail` and `thumb` slot props): your classes after the part's (yours win a
   * conflict), your styles over its styles, your handlers and attributes added, your ref
   * attached. Every attribute the slider sets on a part is locked. A part takes no `children`.
   * The rail and the thumb are drawn only: the slider itself is the invisible range input over
   * them, which takes the pointer and the keys and is reached through the slider's own props and
   * `ref`, so a part receives no press of its own.
   */
  slotProps?: {
    /**
     * The root `<div>` around the rail, the range input and the thumb (stable class
     * `wave-alpha-slider`), which the slider's `className`, `style`, `data-*` and other root
     * props reach as well; its `ref` is the way to the root, since the slider's `ref` reaches the
     * range input. Your classes come after the slider's `className`, your style over its `style`;
     * the custom properties that draw the value (the gradient, the thumb's position and color)
     * stay the slider's. Locked: every prop you give the slider itself that reaches the root,
     * `data-orientation`, `data-disabled`, and `hidden`, `inert` and `aria-hidden` (the slider's
     * own: the root holds the input). Your handlers run before the slider's own root handlers
     * (`preventDefault()` in yours skips them), and your `onClick` is called in every state, as
     * the slider's own `onClick` is: only the range input inside is natively disabled.
     */
    root?: SlotPart<'div'>;
    /**
     * The `<div>` that draws the rail: the checkerboard, with the color's gradient in a `<span>`
     * inside it (stable class `wave-alpha-slider__rail`). Locked: `aria-hidden`, which keeps the
     * drawing out of the accessibility tree, and `tabIndex` (unset: a drawing is never a tab
     * stop).
     */
    rail?: SlotPart<'div'>;
    /**
     * The `<span>` of the drawn thumb, placed at the value inside a box hidden from assistive
     * technology (stable class `wave-alpha-slider__thumb`). It sets no attribute of its own, so
     * none is locked.
     */
    thumb?: SlotPart<'span'>;
  };
}

const DEFAULT_LABELS = { opacity: 'Opacity', transparency: 'Transparency' } as const;

/**
 * A slider for a color's opacity, drawn over a checkerboard, horizontal (mirrored in right-to-left
 * layouts) or vertical (bottom to top); `transparency` shows transparency instead. The arrow keys
 * move by 1 %, Shift with an arrow and Page Up or Page Down by 10, Home and End to the ends. It is
 * named by `aria-label`, else the surrounding Field's label, else "Opacity" ("Transparency").
 * Inside a ColorPicker, leave `value` and `defaultValue` out and it binds to the picker. `ref`
 * reaches the range input, as the naming, validation and focus props do; `className`, `style` and
 * `data-*` stay on the root (`slotProps.root.ref` reaches it). Fluent's `AlphaSlider`, with
 * `value`/`onValueChange` for its `color`/`onChange`.
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
  slotProps,
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
  const mergedControlRef = useMergedRefs(inputRef, ref);
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

  const rootProps = mergeSlotProps(slotProps?.root, {
    className: wcn(
      alphaSliderClassNames.root,
      'wave:group/alpha-slider wave:relative wave:flex wave:touch-none wave:select-none wave:data-[disabled]:cursor-not-allowed wave:data-[disabled]:opacity-50',
      vertical ? RAIL_ROOT_VERTICAL : RAIL_ROOT_HORIZONTAL,
      className,
    ),
    style,
    locked: {
      'data-orientation': orientation,
      'data-disabled': part.disabled ? '' : undefined,
      // The slider's own root props, after the data attributes as in 0.18, and over the part's;
      // the root holds the input, so only they hide it or take it out of reach.
      ...rest,
      hidden: rest.hidden,
      inert: rest.inert,
      'aria-hidden': rest['aria-hidden'],
    },
  });
  // The value's drawing (the gradient, the thumb's position and color) after every other style.
  const rootStyle = {
    ...(rootProps.style as React.CSSProperties | undefined),
    '--wave-color-slider-gradient': alphaSliderGradient(shown, transparency, orientation),
    '--wave-color-slider-position': toPosition(current / 100),
    '--wave-color-thumb': hsvToHex(shown),
  } as React.CSSProperties;

  return (
    <div {...rootProps} style={rootStyle}>
      <div
        {...mergeSlotProps(slotProps?.rail, {
          className: wcn(
            alphaSliderClassNames.rail,
            'wave:relative wave:overflow-hidden wave:rounded-full wave:bg-[conic-gradient(var(--wave-stroke)_25%,var(--wave-background)_0_50%,var(--wave-stroke)_0_75%,var(--wave-background)_0)] wave:bg-size-[8px_8px] wave:forced-colors:forced-color-adjust-none',
            vertical ? RAIL_TRACK_VERTICAL : RAIL_TRACK_HORIZONTAL,
            resolvedShape === 'square' && 'wave:rounded-none',
          ),
          locked: { 'aria-hidden': 'true', tabIndex: undefined },
        })}
      >
        <span className={wcn('wave:absolute wave:inset-0', RAIL_GRADIENT)} />
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
        className={wcn(RAIL_INPUT_CLASSES, vertical ? RAIL_INPUT_VERTICAL : RAIL_INPUT_HORIZONTAL)}
      />
      <span aria-hidden="true" className={vertical ? THUMB_TRACK_VERTICAL : THUMB_TRACK_HORIZONTAL}>
        <span
          {...mergeSlotProps(slotProps?.thumb, {
            className: wcn(
              alphaSliderClassNames.thumb,
              COLOR_THUMB_CLASSES,
              vertical ? THUMB_POSITION_VERTICAL : THUMB_POSITION_HORIZONTAL,
              'wave:group-has-[:focus-visible]/alpha-slider:ring-2 wave:group-has-[:focus-visible]/alpha-slider:ring-background wave:forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas] wave:group-has-[:focus-visible]/alpha-slider:outline-2 wave:group-has-[:focus-visible]/alpha-slider:outline-offset-2 wave:group-has-[:focus-visible]/alpha-slider:outline-ring wave:forced-colors:group-has-[:focus-visible]/alpha-slider:outline-[Highlight]',
            ),
          })}
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
