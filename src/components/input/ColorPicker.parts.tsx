import * as React from 'react';
import { useControllable } from '../../hooks/useControllable';
import type { FieldContextValue } from '../../hooks/useFieldControl';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import type { SwatchItem } from './SwatchPicker';
import { sameColor, type HexColor } from './colorUtils';

/*
 * The picker's labels and context, and how the standalone color parts bind to it (spec P3-05,
 * D21). `ColorArea`, `ColorSlider` and `AlphaSlider` read the context; `ColorPicker.tsx` provides
 * it and renders the picker-only parts. This module never imports `ColorPicker.tsx`.
 */

// wave-allow-color: default color value (user color data, C-TOKENS exception)
export const DEFAULT_COLOR = '#0f6cbd';

/** The default color of a standalone part: the default picker color in HSV. */
export const DEFAULT_PART_COLOR: HsvColor = { h: 208, s: 0.92, v: 0.74 };

/**
 * Texts of the ColorPicker's own parts and of the color parts bound to it, for localisation.
 * Every key is optional; missing keys use the English default.
 */
export interface ColorPickerLabels {
  /** Visible caption above the hex field.
   * @default 'Hex'
   */
  hex?: string;
  /** Accessible name of the hex text field.
   * @default 'Hex color value'
   */
  hexInput?: string;
  /** Error text shown (and used as the hex field's description) while the typed text can never be
   * a hex color, or when the field is left with text that is not one (such as `#12345`).
   * @default 'Enter a hex color such as #0f6cbd.'
   */
  hexError?: string;
  /** Accessible name of the preset swatches radiogroup.
   * @default 'Preset colors'
   */
  presets?: string;
  /** Visible label of the opacity row and accessible name of the opacity slider (a bound
   * `AlphaSlider`).
   * @default 'Opacity'
   */
  opacity?: string;
  /** Accessible name of a bound `ColorArea`'s group.
   * @default 'Saturation and brightness'
   */
  area?: string;
  /** Name of a bound area's saturation slider and of a bound `channel="saturation"` slider.
   * @default 'Saturation'
   */
  saturation?: string;
  /** Name of a bound area's brightness slider and of a bound `channel="value"` slider.
   * @default 'Brightness'
   */
  brightness?: string;
  /** Role description of a bound area's two sliders.
   * @default '2D slider'
   */
  roleDescription?: string;
  /** Name of a bound hue slider.
   * @default 'Hue'
   */
  hue?: string;
  /** Name of a bound `AlphaSlider` with `transparency`.
   * @default 'Transparency'
   */
  transparency?: string;
  /** Names the color at the end of the bound parts' value texts; return `''` to leave it out.
   * @default an English namer ("dark blue")
   */
  colorName?: (color: HsvColor) => string;
  /** Replaces a whole value text of a bound part, for languages whose order differs. */
  valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value' | 'alpha') => string;
}

/** The labels with every string default filled in (the two functions stay optional). */
export type ResolvedColorPickerLabels = Required<
  Omit<ColorPickerLabels, 'colorName' | 'valueText'>
> &
  Pick<ColorPickerLabels, 'colorName' | 'valueText'>;

export const DEFAULT_COLOR_PICKER_LABELS: ResolvedColorPickerLabels = {
  hex: 'Hex',
  hexInput: 'Hex color value',
  hexError: `Enter a hex color such as ${DEFAULT_COLOR}.`,
  presets: 'Preset colors',
  opacity: 'Opacity',
  area: 'Saturation and brightness',
  saturation: 'Saturation',
  brightness: 'Brightness',
  roleDescription: '2D slider',
  hue: 'Hue',
  transparency: 'Transparency',
};

/** What a ColorPicker shares with its parts and with the color parts bound to it. */
export interface ColorPickerContextValue {
  /** The working color: HSV, so hue and saturation survive gray, white and black. */
  hsv: HsvColor;
  /** Writes the working color from a bound part and reports its hex (only when the hex changes). */
  setHsv: (next: HsvColor) => void;
  /** The picker's value as given: a hex string, or a value that is not one (as given). */
  color: string;
  /** The value parsed (`#rrggbb` and the alpha byte), `null` while it is not a hex color. */
  parsed: HexColor | null;
  /** Writes the value as hex text (the hex field). */
  setColor: (next: string) => void;
  /** Applies a preset's `#rrggbb` at the current opacity and drops the hex field's draft. */
  pickPreset: (rgb: string) => void;
  /** The picker's presets as swatch items (values are `#rrggbb`). */
  presetItems: readonly SwatchItem[];
  /** The picker's `shape`, inherited by the bound parts and `ColorPicker.Preview`. */
  shape: ColorPickerShape;
  /** The picker's labels with every string default filled in. */
  labels: ResolvedColorPickerLabels;
  /** `true` while the value is not a hex color: the bound parts are disabled until one arrives. */
  disabled: boolean;
  /** Changes whenever the hex field must drop its draft: a form reset or a preset pick. */
  draftResetKey: number;
  /** The Field around the picker (its parts render in a `null` Field context). */
  field: FieldContextValue | null;
  /** The invalid state set on the picker from outside (its `aria-invalid` or the Field's), as given. */
  groupInvalid: React.AriaAttributes['aria-invalid'];
  /** The consumer's `aria-errormessage`, routed to the hex field while that state is set. */
  errorMessageId: string | undefined;
  /** The hex field registers its `<input>` here (the hidden input's `onInvalid` focuses it). */
  registerHexInput: (input: HTMLInputElement | null) => void;
}

export const ColorPickerContext = React.createContext<ColorPickerContextValue | null>(null);
ColorPickerContext.displayName = 'ColorPickerContext';

/** The enclosing ColorPicker's context, or `null` outside one (the standalone parts need none). */
export function useColorPickerContext(): ColorPickerContextValue | null {
  return React.useContext(ColorPickerContext);
}

/** What a color part passes to {@link useColorPartState}. */
export interface ColorPartOptions {
  value: HsvColor | undefined;
  defaultValue: HsvColor | undefined;
  onValueChange: ((value: HsvColor) => void) | undefined;
  disabled: boolean;
}

/** Where a color part's color lives: in the enclosing picker (bound) or in the part. */
export interface ColorPartState {
  /** The enclosing picker when the part binds to it, else `null`. */
  picker: ColorPickerContextValue | null;
  /** The color as given (bound: the picker's working color). */
  color: HsvColor;
  /**
   * Writes a new color. Bound: the picker's working color, then the part's own `onValueChange`
   * (a part given only the callback listens; C-NAMING). Otherwise the part's state, through
   * `useControllable`.
   */
  setColor: (next: HsvColor) => void;
  /** Restores `defaultValue` on a form reset, reporting only a real change; nothing while bound. */
  reset: () => void;
  /** The part's `disabled`, or the picker's disabled state while bound. */
  disabled: boolean;
}

const noop = () => {};

/**
 * The binding rule of `ColorArea`, `ColorSlider` and `AlphaSlider` (D21): inside a ColorPicker, a
 * part with neither `value` nor `defaultValue` reads and writes the picker's working color;
 * anywhere else, or with either prop, it keeps its own color.
 */
export function useColorPartState({
  value,
  defaultValue,
  onValueChange,
  disabled,
}: ColorPartOptions): ColorPartState {
  const context = useColorPickerContext();
  const picker =
    context !== null && value === undefined && defaultValue === undefined ? context : null;
  const initial = defaultValue ?? DEFAULT_PART_COLOR;
  const [own, setOwn] = useControllable(value, initial, picker ? undefined : onValueChange);
  if (picker) {
    return {
      picker,
      color: picker.hsv,
      setColor: (next) => {
        picker.setHsv(next);
        onValueChange?.(next);
      },
      reset: noop,
      disabled: disabled || picker.disabled,
    };
  }
  return {
    picker: null,
    color: own,
    setColor: setOwn,
    reset: () => {
      if (!sameColor(own, initial)) setOwn(initial);
    },
    disabled,
  };
}
