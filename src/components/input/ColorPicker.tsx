import * as React from 'react';
import { colorPickerClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { hexToHsv, hsvToHex } from '../../lib/color';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { getFirstTabbable } from '../../lib/focus';
import { slotRendersContent } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { FieldContext, useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import type { SwatchItem } from './SwatchPicker';
import {
  ColorPickerContext,
  ColorPickerHexField,
  ColorPickerPreview,
  ColorPickerSwatches,
  DEFAULT_COLOR,
  DEFAULT_COLOR_PICKER_LABELS,
  DEFAULT_PART_COLOR,
  type ColorPickerContextValue,
  type ColorPickerLabels,
} from './ColorPicker.parts';
import {
  alphaToOpacity,
  formatHexColor,
  normalizeHexColor,
  opacityToAlpha,
  parseHexColor,
} from './colorUtils';

export { ColorPickerHexField, ColorPickerPreview, ColorPickerSwatches };
export type { ColorPickerLabels };
export type {
  ColorPickerHexFieldProps,
  ColorPickerPreviewProps,
  ColorPickerSwatchesProps,
} from './ColorPicker.parts';

/** A named preset color. */
export interface ColorPickerPreset {
  /**
   * Hex color (`#rrggbb`; `#rgb` is expanded). A preset has no opacity of its own: picking it keeps
   * the current opacity, so its alpha digits (`#rgba`, `#rrggbbaa`) are ignored. An alpha below
   * `f`/`ff` logs a development warning; an opaque one (`#rgbf`, `#rrggbbff`) changes nothing.
   */
  color: string;
  /** Accessible name of the preset swatch, e.g. `'Cranberry'`. */
  label: string;
}

/** Properties for the ColorPicker component. */
export interface ColorPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /**
   * Controlled hex color: `#rrggbb`, or `#rrggbbaa` with an alpha byte (e.g. `'#0f6cbd80'` for
   * 50% opacity). Other formats are not supported (development warning).
   */
  value?: string;
  /**
   * Initial hex color for uncontrolled usage (also what a form reset restores). Like every edit it
   * is shown, submitted and reported as a lowercase `#rrggbb`, or `#rrggbbaa` when it is not fully
   * opaque (`'#ABC'` becomes `'#aabbcc'`).
   * @default '#0f6cbd'
   */
  defaultValue?: string;
  /**
   * Called with the new color when it changes: a lowercase `#rrggbb`, or `#rrggbbaa` when the color
   * is not fully opaque.
   */
  onValueChange?: (color: string) => void;
  /**
   * Called with the new color when it changes.
   * @deprecated Use `onValueChange`.
   */
  onChange?: (color: string) => void;
  /**
   * Preset colors shown as quick-select swatches. Pass `{ color, label }` objects so screen reader
   * users hear a name; a plain hex string is announced by its hex code. Non-hex presets are
   * skipped (development warning). Picking a preset keeps the current opacity, so a preset's alpha
   * digits are ignored. With an alpha below `f`/`ff` (`#rgba`, `#rrggbbaa`) there is a development
   * warning, and a string preset is announced by the `#rrggbb` color it applies; an opaque alpha
   * (`#rgbf`, `#rrggbbff`) changes nothing, and the string stays the name as written. With
   * `children`, the presets feed only `ColorPicker.Swatches`.
   * @default Blue, Red, Green, Yellow, Purple, Teal, Pink and Black (Fluent brand colors)
   */
  presets?: ReadonlyArray<string | ColorPickerPreset>;
  /** Whether the default layout shows the opacity row (the opacity is the alpha byte of `value`).
   * Does nothing with `children`.
   * @default false
   */
  showOpacity?: boolean;
  /** Texts of the picker's own parts and of the color parts bound to it, for localisation. */
  labels?: ColorPickerLabels;
  /**
   * `'square'` removes the corner radius of the preview and of the color parts bound to the
   * picker (the area and the rails).
   * @default 'rounded'
   */
  shape?: ColorPickerShape;
  /**
   * Your own layout: `ColorArea`, `ColorSlider` and `AlphaSlider` (bound to the picker while they
   * have neither `value` nor `defaultValue`) and the parts `ColorPicker.HexField`,
   * `ColorPicker.Swatches` and `ColorPicker.Preview`. Without children the picker renders its
   * default layout. With children, `showOpacity` does nothing and `presets` feed only
   * `ColorPicker.Swatches`.
   */
  children?: React.ReactNode;
  /** Form field name. With a name, the current color is submitted with the form. */
  name?: string;
  /**
   * Marks the hidden form input as required (a color is always chosen, so it never blocks). A
   * consumer `aria-required` has the same effect: `role="group"` does not support it, so it is not
   * rendered on the group.
   */
  required?: boolean;
  /** Id of the form the picker belongs to, when it is rendered outside that form. */
  form?: string;
  /** Ref to the root `role="group"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

const DEFAULT_PRESETS: readonly ColorPickerPreset[] = [
  { color: '#0f6cbd', label: 'Blue' }, // wave-allow-color: preset swatch data
  { color: '#d13438', label: 'Red' }, // wave-allow-color: preset swatch data
  { color: '#107c10', label: 'Green' }, // wave-allow-color: preset swatch data
  { color: '#ffb900', label: 'Yellow' }, // wave-allow-color: preset swatch data
  { color: '#5c2d91', label: 'Purple' }, // wave-allow-color: preset swatch data
  { color: '#008272', label: 'Teal' }, // wave-allow-color: preset swatch data
  { color: '#e3008c', label: 'Pink' }, // wave-allow-color: preset swatch data
  { color: '#242424', label: 'Black' }, // wave-allow-color: preset swatch data
];

interface ResolvedPresets {
  items: SwatchItem[];
  /** Presets that are not hex colors (skipped). */
  invalid: string[];
  /** Presets with an alpha byte below 255, which a preset cannot apply (ignored). */
  translucent: string[];
}

/** Normalises presets to swatch items keyed by their lowercase `#rrggbb` (duplicates dropped). */
function resolvePresets(presets: ReadonlyArray<string | ColorPickerPreset>): ResolvedPresets {
  const items: SwatchItem[] = [];
  const invalid: string[] = [];
  const translucent: string[] = [];
  const seen = new Set<string>();
  for (const preset of presets) {
    const color = typeof preset === 'string' ? preset : preset.color;
    const parsed = parseHexColor(color);
    if (!parsed) {
      invalid.push(color);
      continue;
    }
    // Picking a preset keeps the current opacity, so its own alpha never applies.
    const hasAlpha = parsed.alpha !== 255;
    if (hasAlpha) translucent.push(color);
    if (seen.has(parsed.rgb)) continue;
    seen.add(parsed.rgb);
    // A string preset is announced by its hex code: the color it applies, without the alpha.
    const stringLabel = hasAlpha ? parsed.rgb : color;
    items.push({
      value: parsed.rgb,
      color: parsed.rgb,
      label: typeof preset === 'string' ? stringLabel : preset.label,
    });
  }
  return { items, invalid, translucent };
}

// The ColorPicker root, documented on the exported `ColorPicker` const.
const ColorPickerRoot = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  presets = DEFAULT_PRESETS,
  showOpacity = false,
  labels,
  shape = 'rounded',
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
  'aria-errormessage': ariaErrorMessage,
  children,
  ref,
  ...rest
}: ColorPickerProps) => {
  if (onChange !== undefined) warnDeprecated('ColorPicker', 'onChange', 'onValueChange');
  // The default is written like every edit (C-FORMS): the picker shows, submits and restores it as
  // a lowercase `#rrggbb`/`#rrggbbaa`. A value that is not a hex color stays as given (warning
  // below).
  const rawDefault = defaultValue ?? DEFAULT_COLOR;
  const initialValue = normalizeHexColor(rawDefault) ?? rawDefault;
  const strings = React.useMemo(() => ({ ...DEFAULT_COLOR_PICKER_LABELS, ...labels }), [labels]);
  const [color, setColor] = useControllable(valueProp, initialValue, (next: string) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  const parsed = React.useMemo(() => parseHexColor(color), [color]);
  const alpha = parsed?.alpha ?? 255;
  const opacity = alphaToOpacity(alpha);

  const {
    items: presetItems,
    invalid: invalidPresets,
    translucent: translucentPresets,
  } = React.useMemo(() => resolvePresets(presets), [presets]);
  const invalidPresetKey = invalidPresets.join('\n');
  const translucentPresetKey = translucentPresets.join('\n');
  const invalidValue = parsed ? null : color;

  React.useEffect(() => {
    if (invalidValue !== null) {
      warnOnce(
        'ColorPicker:invalid-value',
        `ColorPicker: "${invalidValue}" is not a hex color (#rrggbb or #rrggbbaa). Pass a hex value; the opacity slider is disabled until then.`,
      );
    }
  }, [invalidValue]);
  React.useEffect(() => {
    if (!invalidPresetKey) return;
    for (const preset of invalidPresetKey.split('\n')) {
      warnOnce(
        `ColorPicker:invalid-preset:${preset}`,
        `ColorPicker: preset "${preset}" is not a hex color (#rgb or #rrggbb) and is not shown.`,
      );
    }
  }, [invalidPresetKey]);
  React.useEffect(() => {
    if (!translucentPresetKey) return;
    for (const preset of translucentPresetKey.split('\n')) {
      warnOnce(
        `ColorPicker:alpha-preset:${preset}`,
        `ColorPicker: preset "${preset}" has an alpha byte, which is ignored: picking a preset keeps the current opacity. Pass the color as #rgb or #rrggbb.`,
      );
    }
  }, [translucentPresetKey]);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const hexInputRef = React.useRef<HTMLInputElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, rootRef);
  const registerHexInput = React.useCallback((input: HTMLInputElement | null) => {
    hexInputRef.current = input;
  }, []);
  // Changes whenever the hex field must drop its draft: a form reset or a preset pick.
  const [draftResetKey, setDraftResetKey] = React.useState(0);

  const field = useFieldContext();
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    { labelable: false },
  );
  // A group supports neither aria-invalid, aria-required nor a native `required` (ARIA 1.2): the
  // invalid state goes to the hex field and the required state to the hidden form input.
  const {
    'aria-invalid': groupInvalid,
    'aria-required': _ariaRequired,
    required: _required,
    ...groupProps
  } = fieldProps;
  const fieldInvalid =
    groupInvalid !== undefined && groupInvalid !== false && groupInvalid !== 'false';
  // A consumer aria-required is not supported on the group either: it requires the hidden input.
  const isRequired =
    required ?? (ariaRequired === true || ariaRequired === 'true' || (field?.required ?? false));
  // The consumer's error message belongs to the invalid state set from outside (the prop or the
  // Field), so it is routed to the hex field only while that state is set.
  const errorMessageId = (fieldInvalid && ariaErrorMessage) || undefined;

  useFormReset(
    rootRef,
    () => {
      // Only a real change is reported: the same color in another spelling (a controlled `#ABC`
      // against the default `#aabbcc`) is not one.
      if ((normalizeHexColor(color) ?? color) !== initialValue) setColor(initialValue);
      setDraftResetKey((key) => key + 1);
    },
    form,
  );

  const pickPreset = useEventCallback((rgb: string) => {
    // Only a preset color is committed. The presets' own form reset reports `''` (no swatch): it
    // is ignored here, and the picker's reset restores `defaultValue` (input-basic#12).
    const preset = parseHexColor(rgb);
    if (!preset) return;
    setDraftResetKey((key) => key + 1);
    setColor(formatHexColor(preset.rgb, alpha));
  });

  // Replaced by the working color in the next task: here the bound parts read the value's HSV.
  const hsv = React.useMemo(() => hexToHsv(color) ?? DEFAULT_PART_COLOR, [color]);
  const setHsv = useEventCallback((next: HsvColor) => {
    if (parsed) setColor(hsvToHex(next));
  });

  const context = React.useMemo<ColorPickerContextValue>(
    () => ({
      hsv,
      setHsv,
      color,
      parsed,
      setColor,
      pickPreset,
      presetItems,
      shape,
      labels: strings,
      disabled: parsed === null,
      draftResetKey,
      field,
      groupInvalid,
      errorMessageId,
      registerHexInput,
    }),
    [
      hsv,
      setHsv,
      color,
      parsed,
      setColor,
      pickPreset,
      presetItems,
      shape,
      strings,
      draftResetKey,
      field,
      groupInvalid,
      errorMessageId,
      registerHexInput,
    ],
  );

  const handleOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!parsed) return;
    setColor(formatHexColor(parsed.rgb, opacityToAlpha(Number(event.target.value))));
  };

  /** The hidden input's `onInvalid`: the hex field when there is one, else the first tabbable element. */
  const focusInvalidTarget = () => {
    const root = rootRef.current;
    (hexInputRef.current ?? (root ? getFirstTabbable(root) : null))?.focus();
  };

  return (
    <div
      role="group"
      {...groupProps}
      className={cn(
        colorPickerClassNames.root,
        'relative inline-flex flex-col gap-3 rounded border border-border bg-background p-3 shadow-4',
        className,
      )}
      {...rest}
      ref={mergedRef}
    >
      <ColorPickerContext.Provider value={context}>
        {/* The Field wiring (id, label, hint and error, invalid, required) stays on the group:
            the parts inside never read the surrounding FieldContext. */}
        <FieldContext.Provider value={null}>
          {slotRendersContent(children) ? (
            children
          ) : (
            <>
              <div className="flex items-start gap-2">
                <ColorPickerPreview />
                <ColorPickerHexField />
              </div>
              <ColorPickerSwatches />
              {showOpacity && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      colorPickerClassNames.opacityLabel,
                      'w-14 text-caption-1 text-muted-foreground',
                    )}
                  >
                    {strings.opacity}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacity}
                    onChange={handleOpacityChange}
                    disabled={!parsed}
                    aria-label={strings.opacity}
                    aria-valuetext={`${opacity}%`}
                    className={cn(
                      'h-1 flex-1 accent-primary disabled:cursor-not-allowed disabled:opacity-50',
                      focusRing,
                    )}
                  />
                  <span
                    className={cn(
                      colorPickerClassNames.opacityValue,
                      'w-10 text-end text-caption-1 text-muted-foreground',
                    )}
                  >
                    {opacity}%
                  </span>
                </div>
              )}
            </>
          )}
        </FieldContext.Provider>
      </ColorPickerContext.Provider>
      <HiddenInput
        type="text"
        name={name}
        form={form}
        value={color}
        required={isRequired}
        onInvalid={focusInvalidTarget}
      />
    </div>
  );
};

ColorPickerRoot.displayName = 'ColorPicker';

/**
 * A color picker whose value is a hex string (`#rrggbb`, or `#rrggbbaa` with an alpha byte),
 * grouped as a named `role="group"`.
 *
 * - **Default layout** (no children): a preview and the hex field, preset swatches and, with
 *   `showOpacity`, an opacity row.
 * - **Your own layout** (children): `ColorArea`, `ColorSlider` and `AlphaSlider`, which bind to
 *   the picker while they have neither `value` nor `defaultValue`, and the parts
 *   `ColorPicker.HexField`, `ColorPicker.Swatches` and `ColorPicker.Preview`.
 * - **Hex field**: the text is a draft. Complete 6- and 8-digit values apply while typing; text
 *   that can never be a hex color is flagged at once (`aria-invalid` plus the `hexError`
 *   description). Leaving the field or pressing Enter applies a short `#rgb` (keeping the current
 *   opacity) or `#rgba`, then shows the current value again; other text stays flagged until it is
 *   corrected, cleared, or the value changes from elsewhere. Enter still submits the surrounding
 *   form, with the color just applied.
 * - **Presets** render as a SwatchPicker radiogroup ("Preset colors"): one tab stop, arrow keys
 *   move and pick, and picking keeps the current opacity.
 * - **Naming**: `aria-label`/`aria-labelledby` name the group; inside a `Field` its label does,
 *   and the Field's hint and error describe the group. The invalid state (`aria-invalid`, from the
 *   Field or the prop) is set on the hex field, since `role="group"` does not support it, and a
 *   consumer `aria-errormessage` goes there too. A consumer `aria-required` makes the hidden form
 *   input required instead. The built-in texts are localised with `labels`.
 * - **Forms**: with `name` the color is submitted with the form; a form reset restores
 *   `defaultValue` and reports it through `onValueChange` only when the color changes.
 *
 * React Server Components cannot dot into a client module: import the flat names
 * `ColorPickerHexField`, `ColorPickerSwatches` and `ColorPickerPreview` there;
 * `ColorPicker.HexField` etc. work in client files.
 *
 * @example
 * <ColorPicker aria-label="Accent color" showOpacity value={color} onValueChange={setColor} />
 *
 * <ColorPicker aria-label="Accent color" value={color} onValueChange={setColor}>
 *   <ColorArea />
 *   <ColorSlider />
 *   <ColorPicker.HexField />
 * </ColorPicker>
 */
export const ColorPicker = /* @__PURE__ */ Object.assign(ColorPickerRoot, {
  HexField: ColorPickerHexField,
  Swatches: ColorPickerSwatches,
  Preview: ColorPickerPreview,
});
