import * as React from 'react';
import { useControllable } from '../../hooks/useControllable';
import type { FieldContextValue } from '../../hooks/useFieldControl';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { joinIds } from '../../lib/aria';
import {
  colorPickerHexFieldClassNames,
  colorPickerPreviewClassNames,
  colorPickerSwatchesClassNames,
} from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext } from '../../lib/dev';
import { inputFocus, inputInvalid } from '../../lib/styles';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import { isInvalidLook } from './Input';
import { SwatchPicker, type SwatchItem, type SwatchPickerProps } from './SwatchPicker';
import {
  formatHexColor,
  isHexDraft,
  parseHexColor,
  parseHexInput,
  sameColor,
  type HexColor,
} from './colorUtils';

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

// ---------------------------------------------------------------------------------------------
// The picker-only parts: ColorPicker.HexField, ColorPicker.Swatches, ColorPicker.Preview
// ---------------------------------------------------------------------------------------------

/** The context a misplaced part renders with in production (C-CONTEXT). */
const INERT_PICKER_CONTEXT: ColorPickerContextValue = {
  hsv: DEFAULT_PART_COLOR,
  setHsv: noop,
  color: DEFAULT_COLOR,
  parsed: null,
  setColor: noop,
  pickPreset: noop,
  presetItems: [],
  shape: 'rounded',
  labels: DEFAULT_COLOR_PICKER_LABELS,
  disabled: true,
  draftResetKey: 0,
  field: null,
  groupInvalid: undefined,
  errorMessageId: undefined,
  registerHexInput: noop,
};

/**
 * The context of a picker-only part: throws `[WaveUI] <name> must be used within <ColorPicker>`
 * in development; logs once and returns an inert value in production (C-CONTEXT).
 */
export function usePickerPartContext(componentName: string): ColorPickerContextValue {
  const context = React.useContext(ColorPickerContext);
  if (context) return context;
  reportMissingContext(componentName, '<ColorPicker>');
  return INERT_PICKER_CONTEXT;
}

/** The hex field's text while the user edits it (`null` state: the field shows the value). */
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
 * Properties for the ColorPickerHexField sub-component. `id`, the labelling and validation
 * `aria-*` (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`,
 * `aria-errormessage`, `aria-details`, `aria-required`), `autoFocus`, `tabIndex`, the focus and key
 * handlers and the text-entry attributes (`inputMode`, `enterKeyHint`, `autoCapitalize`,
 * `autoCorrect`, `spellCheck`) go to the `<input>`; everything else stays on the outer label.
 */
export interface ColorPickerHexFieldProps extends React.HTMLAttributes<HTMLElement> {
  /** Ref to the hex `<input>`. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the field's outer element: the label around the caption, the input and the error. */
  ref?: React.Ref<HTMLLabelElement>;
}

/**
 * The hex text field of a ColorPicker: a caption, the input and its error. The text is a draft:
 * complete 6- and 8-digit values apply while typing, text that can never be a hex color is
 * flagged at once, and leaving the field (or Enter) applies a short `#rgb`/`#rgba` and shows the
 * value again; other text stays flagged until it is corrected, cleared, or the value changes from
 * elsewhere (a preset, another part, the parent, a form reset). Inside a Field it carries the
 * Field's invalid state and error. Must be inside a ColorPicker. Also exported as
 * `ColorPickerHexField` (import the flat name in React Server Components).
 */
export const ColorPickerHexField = ({
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  'aria-required': ariaRequired,
  autoFocus,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  inputMode,
  enterKeyHint,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  controlRef,
  className,
  ref,
  ...rest
}: ColorPickerHexFieldProps) => {
  const picker = usePickerPartContext('ColorPicker.HexField');
  const { color, parsed, field, groupInvalid, errorMessageId, labels } = picker;
  const alpha = parsed?.alpha ?? 255;

  // The hex text is a draft over `color` while the user edits it (null: show `color`).
  const [draft, setDraft] = React.useState<HexDraft | null>(null);
  // A value change from elsewhere replaces a flagged draft (input-pickers#25); while the user
  // types, the draft is not flagged and stays.
  const [syncedColor, setSyncedColor] = React.useState(color);
  if (color !== syncedColor) {
    setSyncedColor(color);
    if (draft?.flagged) setDraft(null);
  }
  // A form reset or a preset pick drops any draft.
  const [seenResetKey, setSeenResetKey] = React.useState(picker.draftResetKey);
  if (picker.draftResetKey !== seenResetKey) {
    setSeenResetKey(picker.draftResetKey);
    setDraft(null);
  }
  const hexText = draft?.text ?? color;
  const draftInvalid =
    draft !== null && !isBlankDraft(draft.text) && (draft.flagged || !isHexDraft(draft.text));
  // Any invalid state from outside (the picker's prop or the Field) is set on the input as is;
  // only `true` shows the error look.
  const fieldInvalid =
    groupInvalid !== undefined && groupInvalid !== false && groupInvalid !== 'false';
  const errorId = useId('wave-color-picker-error');
  const resolvedInvalid =
    ariaInvalid ?? (draftInvalid ? true : fieldInvalid ? groupInvalid : undefined);
  const invalidLook = isInvalidLook(false, resolvedInvalid);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(inputRef, controlRef, picker.registerHexInput);

  /** The single commit path: every edit is `#rrggbb` + an alpha byte. */
  const commit = (rgb: string, nextAlpha: number) =>
    picker.setColor(formatHexColor(rgb, nextAlpha));

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Surrounding whitespace (a pasted `'#abcdef '`) is dropped, so the text that is checked,
    // committed and shown is the same.
    let text = event.target.value.trim();
    if (text !== '' && !text.startsWith('#')) text = `#${text}`;
    setDraft({ text, flagged: false });
    const typed = parseHexInput(text);
    // A 6-digit hex keeps the current opacity; an 8-digit one brings its own alpha.
    if (typed) commit(typed.rgb, hasAlphaDigits(text) ? typed.alpha : alpha);
  };

  /** Finishes the draft when the field is left or Enter is pressed. */
  const finishDraft = () => {
    if (draft === null || draft.flagged) return;
    const typed = parseHexColor(draft.text);
    if (typed || isBlankDraft(draft.text)) {
      // A short `#rgb` (current opacity) or `#rgba` is applied here; complete values were
      // applied while typing, so a rejecting parent is not asked twice. Then the field shows the
      // current value (also when a controlled parent rejected it).
      if (typed && !parseHexInput(draft.text)) {
        commit(typed.rgb, hasAlphaDigits(draft.text) ? typed.alpha : alpha);
      }
      setDraft(null);
      return;
    }
    // Text that is not a hex color is kept and flagged instead of thrown away (WCAG 3.3.1).
    setDraft({ text: draft.text, flagged: true });
  };

  const handleBlur = composeEventHandlers(onBlur, finishDraft);
  // Not prevented: Enter still submits the surrounding form, with the color just applied.
  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' && !event.nativeEvent.isComposing) finishDraft();
    },
  );

  return (
    <label
      ref={ref}
      className={cn(colorPickerHexFieldClassNames.root, 'flex min-w-0 flex-col gap-1', className)}
      {...rest}
    >
      <span
        className={cn(colorPickerHexFieldClassNames.label, 'text-caption-1 text-muted-foreground')}
      >
        {labels.hex}
      </span>
      <input
        ref={mergedInputRef}
        id={id}
        type="text"
        value={hexText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onFocus={onFocus}
        onBlur={handleBlur}
        aria-label={ariaLabel ?? (ariaLabelledBy === undefined ? labels.hexInput : undefined)}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={resolvedInvalid}
        aria-errormessage={ariaErrorMessage ?? errorMessageId}
        aria-describedby={joinIds(
          draftInvalid && errorId,
          field?.validationMessageId ?? (fieldInvalid ? field?.errorId : undefined),
          errorMessageId,
          ariaDescribedBy,
        )}
        aria-details={ariaDetails}
        aria-required={ariaRequired}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck ?? false}
        maxLength={9}
        autoComplete="off"
        className={cn(
          colorPickerHexFieldClassNames.input,
          'w-24 rounded border border-input border-b-stroke-accessible bg-background px-2 py-1 text-body-1 text-foreground',
          inputFocus,
          invalidLook && inputInvalid,
        )}
      />
      {draftInvalid && (
        <span
          id={errorId}
          className={cn(colorPickerHexFieldClassNames.errorMessage, 'text-caption-1 text-error')}
        >
          {labels.hexError}
        </span>
      )}
    </label>
  );
};

ColorPickerHexField.displayName = 'ColorPickerHexField';

/** Properties for the ColorPickerSwatches sub-component: the picker's `presets` as a SwatchPicker. */
export type ColorPickerSwatchesProps = Omit<
  SwatchPickerProps,
  'items' | 'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'name' | 'form' | 'required'
>;

/**
 * The picker's `presets` as swatches (a SwatchPicker named by `labels.presets`, small and rounded
 * unless you pass `size` or `shape`). Picking one keeps the opacity. Renders nothing without
 * presets. Must be inside a ColorPicker. Also exported as `ColorPickerSwatches`.
 */
export const ColorPickerSwatches = ({
  className,
  'aria-label': ariaLabel,
  size = 'small',
  shape = 'rounded',
  ...rest
}: ColorPickerSwatchesProps) => {
  const picker = usePickerPartContext('ColorPicker.Swatches');
  if (picker.presetItems.length === 0) return null;
  return (
    <SwatchPicker
      aria-label={
        ariaLabel ?? (rest['aria-labelledby'] === undefined ? picker.labels.presets : undefined)
      }
      size={size}
      shape={shape}
      {...rest}
      className={cn(colorPickerSwatchesClassNames.root, className)}
      items={picker.presetItems}
      value={picker.parsed ? picker.parsed.rgb : ''}
      onValueChange={picker.pickPreset}
    />
  );
};

ColorPickerSwatches.displayName = 'ColorPickerSwatches';

/** Properties for the ColorPickerPreview sub-component. */
export interface ColorPickerPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A swatch of the picker's current color (decorative, `aria-hidden`); it keeps its color in forced
 * colors and follows the picker's `shape`. Must be inside a ColorPicker. Also exported as
 * `ColorPickerPreview`.
 */
export const ColorPickerPreview = ({ className, style, ref, ...rest }: ColorPickerPreviewProps) => {
  const picker = usePickerPartContext('ColorPicker.Preview');
  const shown = picker.parsed
    ? formatHexColor(picker.parsed.rgb, picker.parsed.alpha)
    : picker.color;
  return (
    <div
      data-color-preview=""
      aria-hidden="true"
      {...rest}
      ref={ref}
      className={cn(
        colorPickerPreviewClassNames.root,
        'h-10 w-10 shrink-0 rounded border border-border forced-colors:forced-color-adjust-none',
        picker.shape === 'square' && 'rounded-none',
        className,
      )}
      style={{ ...style, backgroundColor: shown }}
    />
  );
};

ColorPickerPreview.displayName = 'ColorPickerPreview';
