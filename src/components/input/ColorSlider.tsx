import * as React from 'react';
import { colorSliderClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { hsvToHex } from '../../lib/color';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getDirection } from '../../lib/direction';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import type { ColorPickerShape, HsvColor, Orientation } from '../../lib/types';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { useColorPartState } from './ColorPicker.parts';
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
  colorSliderGradient,
  displayColor,
  railKeyTarget,
  sliderValueText,
  toPercent,
  toPosition,
} from './colorUtils';

/** Texts of a ColorSlider, for localisation. Every key is optional. */
export interface ColorSliderLabels {
  /** Name of a hue slider.
   * @default 'Hue'
   */
  hue?: string;
  /** Name of a `channel="saturation"` slider.
   * @default 'Saturation'
   */
  saturation?: string;
  /** Name of a `channel="value"` slider.
   * @default 'Brightness'
   */
  brightness?: string;
  /** Names the color at the end of a hue slider's value text; return `''` to leave it out.
   * @default an English namer ("blue")
   */
  colorName?: (color: HsvColor) => string;
  /** Replaces the value text, for languages whose order differs. */
  valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value') => string;
}

/** Properties for the ColorSlider component. */
export interface ColorSliderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  /** The channel the slider edits.
   * @default 'hue'
   */
  channel?: 'hue' | 'saturation' | 'value';
  /** `'vertical'` draws the rail from bottom to top (Fluent's `vertical`).
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /**
   * The color (Fluent's `color`). Inside a ColorPicker, leave `value` and `defaultValue` out to
   * bind the slider to the picker.
   */
  value?: HsvColor;
  /**
   * Initial color for uncontrolled usage (also what a form reset restores).
   * @default the brand blue, `{ h: 208, s: 0.92, v: 0.74 }` (`#0f6cbd`)
   */
  defaultValue?: HsvColor;
  /**
   * Called with the new color on every step (a key, the pointer or assistive technology) that
   * changes it (Fluent's `onChange`). A bound slider calls it too.
   */
  onValueChange?: (value: HsvColor) => void;
  /**
   * `'square'` removes the corner radius of the rail (the thumb stays round). Bound to a
   * ColorPicker, the picker's shape unless you pass one.
   * @default 'rounded'
   */
  shape?: ColorPickerShape;
  /** Texts of the slider; bound to a ColorPicker, the picker's `labels` fill the keys you leave out. */
  labels?: ColorSliderLabels;
  /**
   * Unavailable: the input is natively disabled and the slider dimmed. A bound slider is also
   * disabled while the picker's value is not a hex color.
   * @default false
   */
  disabled?: boolean;
  /** Form field name: the color is submitted as hex (`hsvToHex`). Ignored while bound to a ColorPicker. */
  name?: string;
  /** Id of the form the slider belongs to, when it is rendered outside that form. */
  form?: string;
  /**
   * Marks the hidden form input required (a color is always set, so it never blocks). A consumer
   * `aria-required` does the same: a slider supports neither, so neither is set on it.
   */
  required?: boolean;
  /**
   * Ref to the `<input type="range">`, the slider (Fluent UI's `ref`, on its primary element).
   * The root `<div>` is `slotProps.root.ref`.
   */
  ref?: React.Ref<HTMLInputElement>;
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
     * `wave-color-slider`), which the slider's `className`, `style`, `data-*` and other root
     * props reach as well; its `ref` is the way to the root, since the slider's `ref` reaches the
     * range input. Your classes come after the slider's `className`, your style over its `style`;
     * the custom properties that draw the value (the gradient, the thumb's position and color)
     * stay the slider's. Locked: every prop you give the slider itself that reaches the root,
     * `data-orientation`, `data-channel`, `data-disabled`, and `hidden`, `inert` and
     * `aria-hidden` (the slider's own: the root holds the input). Your handlers run before the
     * slider's own root handlers (`preventDefault()` in yours skips them), and your `onClick` is
     * called in every state, as the slider's own `onClick` is: only the range input inside is
     * natively disabled.
     */
    root?: SlotPart<'div'>;
    /**
     * The `<div>` that draws the gradient rail (stable class `wave-color-slider__rail`).
     * Locked: `aria-hidden`, which keeps the drawing out of the accessibility tree, and
     * `tabIndex` (unset: a drawing is never a tab stop).
     */
    rail?: SlotPart<'div'>;
    /**
     * The `<span>` of the drawn thumb, placed at the value inside a box hidden from assistive
     * technology (stable class `wave-color-slider__thumb`). It sets no attribute of its own, so
     * none is locked.
     */
    thumb?: SlotPart<'span'>;
  };
}

const DEFAULT_LABELS = { hue: 'Hue', saturation: 'Saturation', brightness: 'Brightness' } as const;

/** The `labels` key that names each channel. */
const NAME_KEY = { hue: 'hue', saturation: 'saturation', value: 'brightness' } as const;

/**
 * A slider for one channel of an HSV color: hue (the default), saturation or brightness
 * (`channel="value"`), horizontal (mirrored in right-to-left layouts) or vertical (bottom to top).
 * The arrow keys move by 1 (hue in degrees, the others in percent), Shift with an arrow and Page
 * Up or Page Down by 10, Home and End to the ends. It is named by `aria-label`, else the
 * surrounding Field's label, else "Hue", "Saturation" or "Brightness"; a hue slider's value text
 * names the color ("210°, blue"). Inside a ColorPicker, leave `value` and `defaultValue` out and
 * it binds to the picker. `ref` reaches the range input, as the naming, validation and focus
 * props do; `className`, `style` and `data-*` stay on the root (`slotProps.root.ref` reaches it).
 * Fluent's `ColorSlider`, with `value`/`onValueChange` for its `color`/`onChange` and
 * `orientation` for its `vertical`.
 *
 * @example
 * <ColorSlider value={color} onValueChange={setColor} />
 */
export const ColorSlider = ({
  channel = 'hue',
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
}: ColorSliderProps) => {
  const part = useColorPartState({ value, defaultValue, onValueChange, disabled });
  const { picker } = part;
  const strings = {
    ...DEFAULT_LABELS,
    ...(picker && {
      hue: picker.labels.hue,
      saturation: picker.labels.saturation,
      brightness: picker.labels.brightness,
      colorName: picker.labels.colorName,
      valueText: picker.labels.valueText,
    }),
    ...labels,
  };
  const resolvedShape = shape ?? picker?.shape ?? 'rounded';
  const vertical = orientation === 'vertical';
  const shown = displayColor(part.color);
  const max = channel === 'hue' ? 360 : 100;
  const current =
    channel === 'hue'
      ? Math.round(shown.h)
      : toPercent(channel === 'saturation' ? shown.s : shown.v);

  const field = useFieldContext();
  const fieldProps = useFieldControl({
    id,
    // The built-in name only without a Field: an aria-label would beat the Field's <label for>.
    'aria-label':
      ariaLabel ??
      (field === null && ariaLabelledBy === undefined ? strings[NAME_KEY[channel]] : undefined),
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

  /** Applies a value of the slider's range (the hue in degrees, the others in percent). */
  const apply = (next: number) => {
    if (next === current) return;
    const color = part.color;
    part.setColor(
      channel === 'hue'
        ? { ...color, h: next }
        : channel === 'saturation'
          ? { ...color, s: next / 100 }
          : { ...color, v: next / 100 },
    );
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
        max,
      );
      if (target === null) return;
      event.preventDefault();
      apply(target);
    },
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (part.disabled) return;
    apply(Math.min(max, Math.max(0, Math.round(Number(event.currentTarget.value)))));
  };

  const rootProps = mergeSlotProps(slotProps?.root, {
    className: wcn(
      colorSliderClassNames.root,
      'wave:group/color-slider wave:relative wave:flex wave:touch-none wave:select-none wave:data-[disabled]:cursor-not-allowed wave:data-[disabled]:opacity-50',
      vertical ? RAIL_ROOT_VERTICAL : RAIL_ROOT_HORIZONTAL,
      className,
    ),
    style,
    locked: {
      'data-orientation': orientation,
      'data-channel': channel,
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
    '--wave-color-slider-gradient': colorSliderGradient(channel, shown, orientation),
    '--wave-color-slider-position': toPosition(current / max),
    '--wave-color-thumb':
      channel === 'hue'
        ? hsvToHex({ h: shown.h, s: 1, v: 1 })
        : hsvToHex({ h: shown.h, s: shown.s, v: shown.v }),
  } as React.CSSProperties;

  return (
    <div {...rootProps} style={rootStyle}>
      <div
        {...mergeSlotProps(slotProps?.rail, {
          className: wcn(
            colorSliderClassNames.rail,
            'wave:rounded-full wave:forced-colors:forced-color-adjust-none',
            RAIL_GRADIENT,
            vertical ? RAIL_TRACK_VERTICAL : RAIL_TRACK_HORIZONTAL,
            resolvedShape === 'square' && 'wave:rounded-none',
          ),
          locked: { 'aria-hidden': 'true', tabIndex: undefined },
        })}
      />
      <input
        type="range"
        {...inputFieldProps}
        ref={mergedControlRef}
        min={0}
        max={max}
        step={1}
        value={current}
        disabled={part.disabled}
        dir={vertical ? 'ltr' : undefined}
        aria-orientation={vertical ? 'vertical' : undefined}
        aria-valuetext={sliderValueText(shown, channel, strings)}
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
              colorSliderClassNames.thumb,
              COLOR_THUMB_CLASSES,
              vertical ? THUMB_POSITION_VERTICAL : THUMB_POSITION_HORIZONTAL,
              'wave:group-has-[:focus-visible]/color-slider:ring-2 wave:group-has-[:focus-visible]/color-slider:ring-background wave:forced-colors:group-has-[:focus-visible]/color-slider:ring-[Canvas] wave:group-has-[:focus-visible]/color-slider:outline-2 wave:group-has-[:focus-visible]/color-slider:outline-offset-2 wave:group-has-[:focus-visible]/color-slider:outline-ring wave:forced-colors:group-has-[:focus-visible]/color-slider:outline-[Highlight]',
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

ColorSlider.displayName = 'ColorSlider';
