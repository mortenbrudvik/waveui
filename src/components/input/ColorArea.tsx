import * as React from 'react';
import { colorAreaClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { hsvToHex } from '../../lib/color';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isOwnEvent } from '../../lib/events';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { useColorPartState } from './ColorPicker.parts';
import {
  COLOR_THUMB_CLASSES,
  areaValueText,
  colorAreaGradient,
  displayColor,
  toPercent,
  toPosition,
} from './colorUtils';

/** Texts of a ColorArea, for localisation. Every key is optional. */
export interface ColorAreaLabels {
  /** Name of the horizontal slider.
   * @default 'Saturation'
   */
  saturation?: string;
  /** Name of the vertical slider (the `value` channel).
   * @default 'Brightness'
   */
  brightness?: string;
  /** Role description of both sliders.
   * @default '2D slider'
   */
  roleDescription?: string;
  /** Names the color at the end of each value text; return `''` to leave it out.
   * @default an English namer ("dark blue")
   */
  colorName?: (color: HsvColor) => string;
  /** Replaces a whole value text, for languages whose order differs. */
  valueText?: (color: HsvColor, channel: 'saturation' | 'value') => string;
}

/** Properties for the ColorArea component. */
export interface ColorAreaProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  /**
   * The color (Fluent's `color`). Inside a ColorPicker, leave `value` and `defaultValue` out to
   * bind the area to the picker.
   */
  value?: HsvColor;
  /**
   * Initial color for uncontrolled usage (also what a form reset restores).
   * @default the brand blue, `{ h: 208, s: 0.92, v: 0.74 }` (`#0f6cbd`)
   */
  defaultValue?: HsvColor;
  /**
   * Called with the new color on every step (a key, a pointer move or assistive technology) that
   * changes it (Fluent's `onChange`). A bound area calls it too.
   */
  onValueChange?: (value: HsvColor) => void;
  /**
   * `'square'` removes the corner radius (the thumb stays round). Bound to a ColorPicker, the
   * picker's shape unless you pass one.
   * @default 'rounded'
   */
  shape?: ColorPickerShape;
  /** Texts of the area; bound to a ColorPicker, the picker's `labels` fill the keys you leave out. */
  labels?: ColorAreaLabels;
  /**
   * Unavailable: both inputs are natively disabled, pointer presses are ignored and the area is
   * dimmed. A bound area is also disabled while the picker's value is not a hex color.
   * @default false
   */
  disabled?: boolean;
  /** Form field name: the color is submitted as hex (`hsvToHex`). Ignored while bound to a ColorPicker. */
  name?: string;
  /** Id of the form the area belongs to, when it is rendered outside that form. */
  form?: string;
  /**
   * Marks the hidden form input required (a color is always set, so it never blocks). A consumer
   * `aria-required` does the same: a group supports neither, so neither is set on it.
   */
  required?: boolean;
  /** Ref to the saturation `<input type="range">`. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root `role="group"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The two axes: saturation (x) and brightness (y, the `value` channel). */
type AreaAxis = 'saturation' | 'value';

const DEFAULT_LABELS = {
  saturation: 'Saturation',
  brightness: 'Brightness',
  roleDescription: '2D slider',
} as const;

/** A whole percentage clamped to 0–100. */
function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * A 2-D color field: saturation from left to right (mirrored in right-to-left layouts) and
 * brightness from bottom to top, at the value's hue. ArrowLeft and ArrowRight move saturation by
 * 1 %, ArrowUp and ArrowDown brightness; Shift with an arrow moves by 10, Page Up and Page Down
 * move brightness by 10, and Home and End set saturation to 0 and 100. It is one Tab stop holding
 * two sliders for assistive technology, "Saturation" and "Brightness", whose value texts start
 * with their own channel and name the color; focus follows the axis a key moves. Inside a
 * ColorPicker, leave `value` and `defaultValue` out and it binds to the picker. Fluent's
 * `ColorArea`, with `value`/`onValueChange` for its `color`/`onChange`.
 *
 * @example
 * <ColorArea aria-label="Accent color" value={color} onValueChange={setColor} />
 */
export const ColorArea = ({
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
  autoFocus,
  tabIndex,
  onKeyDown,
  ref,
  ...rest
}: ColorAreaProps) => {
  const part = useColorPartState({ value, defaultValue, onValueChange, disabled });
  const { picker } = part;
  const strings = {
    ...DEFAULT_LABELS,
    ...(picker && {
      saturation: picker.labels.saturation,
      brightness: picker.labels.brightness,
      roleDescription: picker.labels.roleDescription,
      colorName: picker.labels.colorName,
      valueText: picker.labels.valueText,
    }),
    ...labels,
  };
  const resolvedShape = shape ?? picker?.shape ?? 'rounded';
  const color = part.color;
  const shown = displayColor(color);
  const saturation = toPercent(shown.s);
  const brightness = toPercent(shown.v);

  const [activeAxis, setActiveAxis] = React.useState<AreaAxis>('saturation');
  // Bumped together with `activeAxis` from a keyboard-driven axis change, so the layout effect
  // below can move focus only for those changes (never an AT-driven change or a real focus event).
  // A plain counter, not a ref: react-hooks/refs only allows a ref's `current` to be touched from
  // an effect, a ref callback or a function assigned directly to a JSX handler prop, not one passed
  // through `composeEventHandlers`.
  const [focusToken, setFocusToken] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const saturationRef = React.useRef<HTMLInputElement>(null);
  const brightnessRef = React.useRef<HTMLInputElement>(null);
  const mergedRootRef = useMergedRefs(ref, rootRef);
  const mergedSaturationRef = useMergedRefs(saturationRef, controlRef);
  /** The last `focusToken` this component already moved focus for (read/written in the effect only). */
  const handledFocusTokenRef = React.useRef(0);

  React.useLayoutEffect(() => {
    if (handledFocusTokenRef.current === focusToken) return;
    handledFocusTokenRef.current = focusToken;
    (activeAxis === 'saturation' ? saturationRef : brightnessRef).current?.focus({
      preventScroll: true,
    });
  }, [activeAxis, focusToken]);

  const field = useFieldContext();
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label':
        ariaLabel ?? (picker && ariaLabelledBy === undefined ? picker.labels.area : undefined),
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    { labelable: false },
  );
  // A group supports neither aria-invalid, aria-required nor `required` (ARIA 1.2): the invalid
  // state goes to both inputs and the required state to the hidden input.
  const {
    'aria-invalid': invalid,
    'aria-required': _ariaRequired,
    required: _required,
    ...groupProps
  } = fieldProps;
  const isInvalid = invalid !== undefined && invalid !== false && invalid !== 'false';
  const errorMessageId = (isInvalid && ariaErrorMessage) || undefined;
  const isRequired =
    required ?? (ariaRequired === true || ariaRequired === 'true' || (field?.required ?? false));

  useFormReset(rootRef, part.reset, form);

  /** Applies a whole percentage to one axis, keeping the other channels as given. */
  const applyAxis = (axis: AreaAxis, percent: number) => {
    if (percent === (axis === 'saturation' ? saturation : brightness)) return;
    part.setColor(
      axis === 'saturation' ? { ...color, s: percent / 100 } : { ...color, v: percent / 100 },
    );
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (part.disabled || !isOwnEvent(event) || event.nativeEvent.isComposing) return;
      // A key with Alt, Ctrl or Meta belongs to the browser (Alt+Left is "back").
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const step = event.shiftKey ? 10 : 1;
      let axis: AreaAxis;
      let next: number;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          const intent = getArrowIntent(event.key, {
            orientation: 'horizontal',
            dir: getDirection(event.currentTarget),
          });
          axis = 'saturation';
          next = saturation + (intent === 'next' ? step : -step);
          break;
        }
        case 'ArrowUp':
          axis = 'value';
          next = brightness + step;
          break;
        case 'ArrowDown':
          axis = 'value';
          next = brightness - step;
          break;
        case 'PageUp':
          axis = 'value';
          next = brightness + 10;
          break;
        case 'PageDown':
          axis = 'value';
          next = brightness - 10;
          break;
        case 'Home':
          axis = 'saturation';
          next = 0;
          break;
        case 'End':
          axis = 'saturation';
          next = 100;
          break;
        default:
          return;
      }
      // Prevented, so the native range input never moves on its own.
      event.preventDefault();
      if (axis !== activeAxis) {
        setActiveAxis(axis);
        setFocusToken((token) => token + 1);
      }
      applyAxis(axis, clampPercent(next));
    },
  );

  /** A change event from assistive technology (a swipe): that input becomes the Tab stop. */
  const handleInputChange = (axis: AreaAxis) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (part.disabled) return;
    if (axis !== activeAxis) setActiveAxis(axis);
    applyAxis(axis, clampPercent(Math.round(Number(event.currentTarget.value))));
  };

  const handleInputFocus = (axis: AreaAxis) => () => {
    if (axis !== activeAxis) setActiveAxis(axis);
  };

  const textLabels = {
    saturation: strings.saturation,
    brightness: strings.brightness,
    colorName: strings.colorName,
    valueText: strings.valueText,
  };

  const areaStyle = {
    ...style,
    '--wave-color-area-gradient': colorAreaGradient(shown.h),
    '--wave-color-area-x': toPosition(shown.s),
    '--wave-color-area-y': toPosition(shown.v),
    '--wave-color-thumb': hsvToHex({ h: shown.h, s: shown.s, v: shown.v }),
  } as React.CSSProperties;

  const inputProps = (axis: AreaAxis) => ({
    type: 'range' as const,
    min: 0,
    max: 100,
    step: 1,
    disabled: part.disabled,
    'aria-roledescription': strings.roleDescription,
    'aria-invalid': invalid,
    'aria-errormessage': errorMessageId,
    // One Tab stop: the input used last (C-ROUTING: a consumer tabIndex applies to it).
    tabIndex: axis === activeAxis ? (tabIndex ?? 0) : -1,
    onChange: handleInputChange(axis),
    onFocus: handleInputFocus(axis),
    className: 'sr-only',
  });

  return (
    <div
      role="group"
      data-disabled={part.disabled ? '' : undefined}
      {...groupProps}
      className={cn(
        colorAreaClassNames.root,
        'group/color-area relative h-40 w-full min-w-40 touch-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        resolvedShape === 'square' ? 'rounded-none' : 'rounded',
        className,
      )}
      style={areaStyle}
      {...rest}
      ref={mergedRootRef}
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        className={cn(
          colorAreaClassNames.field,
          'absolute inset-0 rounded-[inherit] bg-(image:--wave-color-area-gradient) wave-rtl:-scale-x-100 forced-colors:forced-color-adjust-none',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          colorAreaClassNames.thumb,
          COLOR_THUMB_CLASSES,
          'start-(--wave-color-area-x) bottom-(--wave-color-area-y) -translate-x-1/2 wave-rtl:translate-x-1/2 translate-y-1/2',
          'group-has-[:focus-visible]/color-area:ring-2 group-has-[:focus-visible]/color-area:ring-background forced-colors:group-has-[:focus-visible]/color-area:ring-[Canvas] group-has-[:focus-visible]/color-area:outline-2 group-has-[:focus-visible]/color-area:outline-offset-2 group-has-[:focus-visible]/color-area:outline-ring forced-colors:group-has-[:focus-visible]/color-area:outline-[Highlight]',
        )}
      />
      <input
        {...inputProps('saturation')}
        ref={mergedSaturationRef}
        value={saturation}
        aria-label={strings.saturation}
        aria-valuetext={areaValueText(shown, 'saturation', textLabels)}
        autoFocus={autoFocus}
      />
      <input
        {...inputProps('value')}
        ref={brightnessRef}
        value={brightness}
        aria-label={strings.brightness}
        aria-orientation="vertical"
        aria-valuetext={areaValueText(shown, 'value', textLabels)}
      />
      {!picker && (
        <HiddenInput
          type="text"
          name={name}
          form={form}
          disabled={part.disabled}
          value={hsvToHex(color)}
          required={isRequired}
          onInvalid={() =>
            (activeAxis === 'saturation' ? saturationRef : brightnessRef).current?.focus()
          }
        />
      )}
    </div>
  );
};

ColorArea.displayName = 'ColorArea';
