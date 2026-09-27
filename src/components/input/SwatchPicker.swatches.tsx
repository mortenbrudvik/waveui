import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { CheckIcon } from '../../lib/icons';
import { focusRing, forcedColors, motionSafeTransition } from '../../lib/styles';
import type { Shape } from '../../lib/types';
import { useSwatchPickerContext, type SwatchPickerSize } from './SwatchPicker.context';
import { getCheckColors } from './colorUtils';

/*
 * The swatch kinds a `SwatchPicker` renders `items` through and a consumer can render as children
 * (D18, D21): `ColorSwatch` here; `ImageSwatch` and `EmptySwatch` join in a later package of this
 * phase. Every swatch reads `SwatchPickerContext` and puts its `ref`, `className`, `style`, name
 * and rest props on its own `<button>` (an explicit exception to C-ROUTING: there is no separate
 * root, so a wrapping Tooltip's ARIA and handlers reach the focused element without extra wiring).
 */

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

/** Warns once per swatch kind (not per value: `<Kind>:unnamed`, e.g. `ColorSwatch:unnamed`). */
function warnUnnamedSwatch(kind: string, value: string): void {
  warnOnce(
    `${kind}:unnamed`,
    `${kind}: swatch "${value}" has no accessible name, so it is announced by its color value. ` +
      'Pass `aria-label`, or wrap it in a Tooltip with `relationship="label"`.',
  );
}

/** Properties for the ColorSwatch component. */
export interface ColorSwatchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'color'
> {
  /** Unique identifier for the swatch (the value the picker selects and a form submits). */
  value: string;
  /** CSS color value (e.g., hex, rgb) used as the swatch background (a runtime user color). */
  color: string;
  /** Ref to the `role="radio"` button. */
  ref?: React.Ref<HTMLButtonElement>;
}

// D18: swatches read SwatchPickerContext; their own ref/className/style/rest go straight to the
// button (an explicit exception to C-ROUTING's root/control split).
/**
 * One color swatch of a `SwatchPicker`, read from `items` or rendered directly as a child.
 * Outside a `SwatchPicker` it throws in development and renders inertly in production
 * (C-CONTEXT).
 *
 * **Naming**: give it `aria-label`, or wrap it in a `Tooltip` with `relationship="label"` (its
 * `aria-labelledby` reaches this element, since every rest prop lands on the swatch's own
 * button). Without either it is named by its `color` value and a development warning is logged.
 *
 * @example
 * <SwatchPicker aria-label="Accent color">
 *   <ColorSwatch value="red" color="#d13438" aria-label="Red" />
 * </SwatchPicker>
 */
export const ColorSwatch = ({
  value,
  color,
  className,
  style,
  onClick,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ref,
  ...rest
}: ColorSwatchProps) => {
  const {
    value: selectedValue,
    select,
    size,
    shape,
    getTabIndex,
    register,
  } = useSwatchPickerContext('ColorSwatch');
  const isSelected = selectedValue === value;

  React.useLayoutEffect(() => register(value), [register, value]);

  const named = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  React.useEffect(() => {
    if (!named) warnUnnamedSwatch('ColorSwatch', value);
  }, [named, value]);

  return (
    <button
      type="button"
      role="radio"
      {...rest}
      ref={ref}
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : color)}
      aria-labelledby={ariaLabelledBy}
      aria-checked={isSelected}
      data-roving-value={value}
      data-selected={isSelected ? '' : undefined}
      tabIndex={getTabIndex(value)}
      onClick={composeEventHandlers(onClick, () => select(value))}
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
        className,
      )}
      style={{ ...style, backgroundColor: color }}
    >
      {isSelected && <SwatchCheck color={color} size={checkSizeMap[size]} />}
    </button>
  );
};
ColorSwatch.displayName = 'ColorSwatch';
