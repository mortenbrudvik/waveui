import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { joinIds } from '../../lib/aria';
import { focusRing, inputFocus, inputInvalid } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { FieldContext, useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { SwatchPicker } from './SwatchPicker';
import type { SwatchItem } from './SwatchPicker';
import {
  alphaToOpacity,
  formatHexColor,
  isHexDraft,
  normalizeHexColor,
  opacityToAlpha,
  parseHexColor,
  parseHexInput,
} from './colorUtils';

/** A named preset color. */
export interface ColorPickerPreset {
  /**
   * Hex color (`#rrggbb`; `#rgb` is expanded). A preset has no opacity of its own: alpha digits
   * (`#rgba`, `#rrggbbaa`) are ignored with a development warning, and picking the preset keeps
   * the current opacity.
   */
  color: string;
  /** Accessible name of the preset swatch, e.g. `'Cranberry'`. */
  label: string;
}

/**
 * Texts of the ColorPicker's own parts, for localisation. Every key is optional; missing keys use
 * the English default.
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
  /** Visible label and accessible name of the opacity slider.
   * @default 'Opacity'
   */
  opacity?: string;
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
   * skipped (development warning). Picking a preset keeps the current opacity: a preset's alpha
   * digits are ignored (development warning), and a string preset that carries them is announced
   * by the `#rrggbb` color it applies.
   * @default Blue, Red, Green, Yellow, Purple, Teal, Pink and Black (Fluent brand colors)
   */
  presets?: ReadonlyArray<string | ColorPickerPreset>;
  /** Whether to show the opacity slider. The opacity is the alpha byte of `value`.
   * @default false
   */
  showOpacity?: boolean;
  /** Texts of the picker's own parts (hex field, error, presets, opacity), for localisation. */
  labels?: ColorPickerLabels;
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

// wave-allow-color: default color value (user color data, C-TOKENS exception)
const DEFAULT_COLOR = '#0f6cbd';

const DEFAULT_LABELS: Required<ColorPickerLabels> = {
  hex: 'Hex',
  hexInput: 'Hex color value',
  hexError: `Enter a hex color such as ${DEFAULT_COLOR}.`,
  presets: 'Preset colors',
  opacity: 'Opacity',
};

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

/** The hex field's text while the user edits it (`null` state = the field shows the value). */
interface HexDraft {
  /** The typed text. */
  text: string;
  /** Kept after leaving the field because it is not a hex color, so it is flagged as invalid. */
  flagged: boolean;
}

/** A hex draft without digits (`''` or a lone `#`): leaving the field shows the value again. */
function isBlankDraft(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === '' || trimmed === '#';
}

/** Whether typed hex text carries its own alpha digits (`#rgba` or `#rrggbbaa`). */
function hasAlphaDigits(text: string): boolean {
  const digits = text.trim().replace(/^#/, '').length;
  return digits === 4 || digits === 8;
}

/**
 * A color picker: a preview, a hex text field, optional preset swatches and an optional opacity
 * slider, grouped as a named `role="group"`.
 *
 * - **Value**: a hex color, `#rrggbb` or `#rrggbbaa`. The opacity slider shows and edits the
 *   value's alpha byte; picking a preset or typing a 6-digit hex keeps the current opacity.
 * - **Hex field**: the text is a draft (surrounding whitespace is dropped). Complete 6- or 8-digit
 *   values are applied while typing; text that can never be a hex color is flagged at once
 *   (`aria-invalid` plus the `hexError` description). Leaving the field or pressing Enter applies
 *   a short `#rgb` (keeping the current opacity) or `#rgba`, then shows the current value again
 *   (also when a controlled parent rejected the typed color); an empty field (or a lone `#`) also
 *   shows the current value again. Any other text is kept and flagged instead of being thrown
 *   away, until it is corrected, cleared, or the value changes from elsewhere (a preset, the
 *   opacity slider, the parent, a form reset). Enter still submits the surrounding form, with the
 *   color just applied; while the text is flagged, the form submits the last applied color.
 * - **Presets** render as a SwatchPicker radiogroup ("Preset colors"): one tab stop, arrow keys
 *   move and pick, and the selected preset shows a ring and a check glyph.
 * - **Naming**: `aria-label`/`aria-labelledby` name the group; inside a `Field` its label does, and
 *   the Field's hint and error describe the group. The invalid state (`aria-invalid`, from the
 *   Field or the prop) is set on the hex field, since `role="group"` does not support it, and the
 *   hex field is then also described by the Field's error and by a consumer `aria-errormessage`
 *   (which is routed to the hex field too). A consumer `aria-required` makes the hidden form input
 *   required instead of reaching the group. The texts of the picker's own parts are localised with
 *   `labels`.
 * - **Forms**: with `name` the color is submitted with the form; a form reset restores
 *   `defaultValue` and reports it through `onValueChange` only when the color changes.
 *
 * @example
 * <ColorPicker aria-label="Accent color" showOpacity value={color} onValueChange={setColor} />
 */
export const ColorPicker = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  presets = DEFAULT_PRESETS,
  showOpacity = false,
  labels,
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
  ref,
  ...rest
}: ColorPickerProps) => {
  if (onChange !== undefined) warnDeprecated('ColorPicker', 'onChange', 'onValueChange');
  // The default is written like every edit (R10): the picker shows, submits and restores it as a
  // lowercase `#rrggbb`/`#rrggbbaa`. A value that is not a hex color stays as given (warning below).
  const rawDefault = defaultValue ?? DEFAULT_COLOR;
  const initialValue = normalizeHexColor(rawDefault) ?? rawDefault;
  const strings = { ...DEFAULT_LABELS, ...labels };
  const [color, setColor] = useControllable(valueProp, initialValue, (next: string) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  const parsed = parseHexColor(color);
  const alpha = parsed?.alpha ?? 255;
  const opacity = alphaToOpacity(alpha);

  /** The single commit path: every edit is `#rrggbb` + an alpha byte. */
  const commit = (rgb: string, nextAlpha: number) => setColor(formatHexColor(rgb, nextAlpha));

  // The hex text is a draft over `color` while the user edits it (null = show `color`).
  const [draft, setDraft] = React.useState<HexDraft | null>(null);
  // A value change from elsewhere (a preset, the opacity slider, the parent, a form reset) replaces
  // a flagged draft, so the field never shows stale text next to the new preview (input-pickers#25).
  // While the user types, the draft is not flagged and stays.
  const [syncedColor, setSyncedColor] = React.useState(color);
  if (color !== syncedColor) {
    setSyncedColor(color);
    if (draft?.flagged) setDraft(null);
  }
  const hexText = draft?.text ?? color;
  // Text that can never be a hex color is flagged while typing; an incomplete one once the user
  // leaves the field with it (`flagged`).
  const draftInvalid =
    draft !== null && !isBlankDraft(draft.text) && (draft.flagged || !isHexDraft(draft.text));

  const {
    items: presetItems,
    invalid: invalidPresets,
    translucent: translucentPresets,
  } = resolvePresets(presets);
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
  const hexInputRef = React.useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, rootRef);

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
      setDraft(null);
    },
    form,
  );

  const errorId = useId('wave-color-picker-error');
  // The hex field carries the picker's invalid state: its own flagged text, or the Field's/prop's.
  const hexInvalid = draftInvalid || fieldInvalid;

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Surrounding whitespace (a pasted `'#abcdef '`) is dropped, so the text that is checked,
    // committed and shown is the same.
    let text = e.target.value.trim();
    if (text !== '' && !text.startsWith('#')) text = `#${text}`;
    setDraft({ text, flagged: false });
    const typed = parseHexInput(text);
    // A 6-digit hex keeps the current opacity; an 8-digit one brings its own alpha.
    if (typed) commit(typed.rgb, hasAlphaDigits(text) ? typed.alpha : alpha);
  };

  /** Finishes the hex draft when the field is left or Enter is pressed. */
  const finishHexDraft = () => {
    if (draft === null || draft.flagged) return;
    const typed = parseHexColor(draft.text);
    if (typed || isBlankDraft(draft.text)) {
      // A short `#rgb` (current opacity) or `#rgba` is applied here; complete 6- and 8-digit
      // values were applied while typing, so a rejecting parent is not asked twice. Then the field
      // shows the current value (also when a controlled parent rejected it).
      if (typed && !parseHexInput(draft.text)) {
        commit(typed.rgb, hasAlphaDigits(draft.text) ? typed.alpha : alpha);
      }
      setDraft(null);
      return;
    }
    // Text that is not a hex color is kept and flagged instead of silently thrown away (WCAG 3.3.1).
    setDraft({ text: draft.text, flagged: true });
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Not prevented: Enter still submits the surrounding form, which then carries the color just
    // applied (the submit follows the keydown, after React has rendered the new value).
    if (e.key === 'Enter' && !e.defaultPrevented && !e.nativeEvent.isComposing) finishHexDraft();
  };

  const handlePreset = (rgb: string) => {
    // Only a preset color is committed. The presets' own form reset reports `''` (no swatch): it
    // is ignored here, and the picker's reset restores `defaultValue` (input-basic#12).
    const preset = parseHexColor(rgb);
    if (!preset) return;
    setDraft(null);
    commit(preset.rgb, alpha);
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!parsed) return;
    commit(parsed.rgb, opacityToAlpha(Number(e.target.value)));
  };

  const selectedPreset = parsed ? parsed.rgb : '';

  return (
    <div
      role="group"
      {...groupProps}
      className={cn(
        'relative inline-flex flex-col gap-3 rounded border border-border bg-background p-3 shadow-4',
        className,
      )}
      {...rest}
      ref={mergedRef}
    >
      {/* Color preview and hex input */}
      <div className="flex items-center gap-2">
        <div
          data-color-preview=""
          className="h-10 w-10 shrink-0 rounded border border-border"
          style={{ backgroundColor: parsed ? formatHexColor(parsed.rgb, parsed.alpha) : color }}
          aria-hidden="true"
        />
        <label className="flex flex-col gap-1">
          <span className="text-caption-1 text-muted-foreground">{strings.hex}</span>
          <input
            ref={hexInputRef}
            type="text"
            value={hexText}
            onChange={handleHexChange}
            onKeyDown={handleHexKeyDown}
            onBlur={finishHexDraft}
            aria-label={strings.hexInput}
            aria-invalid={hexInvalid || undefined}
            aria-errormessage={errorMessageId}
            aria-describedby={joinIds(
              draftInvalid && errorId,
              fieldInvalid && field?.errorId,
              errorMessageId,
            )}
            maxLength={9}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              'w-24 rounded border border-input border-b-stroke-accessible bg-background px-2 py-1 text-body-1 text-foreground',
              inputFocus,
              hexInvalid && inputInvalid,
            )}
          />
        </label>
      </div>
      {draftInvalid && (
        <span id={errorId} className="text-caption-1 text-error">
          {strings.hexError}
        </span>
      )}

      {/* Preset swatches: the Field wiring (id, label, hint/error, invalid, required) stays on the
          group, so the nested radiogroup does not read the surrounding FieldContext. */}
      {presetItems.length > 0 && (
        <FieldContext.Provider value={null}>
          <SwatchPicker
            items={presetItems}
            value={selectedPreset}
            onValueChange={handlePreset}
            aria-label={strings.presets}
            size="small"
            shape="rounded"
          />
        </FieldContext.Provider>
      )}

      {/* Opacity slider */}
      {showOpacity && (
        <div className="flex items-center gap-2">
          <span className="w-14 text-caption-1 text-muted-foreground">{strings.opacity}</span>
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
          <span className="w-10 text-end text-caption-1 text-muted-foreground">{opacity}%</span>
        </div>
      )}

      <HiddenInput
        type="text"
        name={name}
        form={form}
        value={color}
        required={isRequired}
        onInvalid={() => hexInputRef.current?.focus()}
      />
    </div>
  );
};

ColorPicker.displayName = 'ColorPicker';
