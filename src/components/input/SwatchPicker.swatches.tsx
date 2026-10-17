import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { AddIcon, CheckIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { focusRing, forcedColors, motionSafeTransition } from '../../lib/styles';
import type { Shape } from '../../lib/types';
import { unwrapButtonGlyph, type UnwrappedButton } from '../button/Button.slots';
import { useSwatchPickerContext, type SwatchPickerSize } from './SwatchPicker.context';
import { getCheckColors, type CheckColors } from './colorUtils';

/*
 * The swatch kinds a `SwatchPicker` renders `items` through and a consumer can render as children
 * (D18, D21): `ColorSwatch`, `ImageSwatch` and `EmptySwatch`. Every swatch reads
 * `SwatchPickerContext` and puts its `ref`, `className`, `style`, name and rest props on its own
 * `<button>` (an explicit exception to C-ROUTING: there is no separate root, so a wrapping
 * Tooltip's ARIA and handlers reach the focused element without extra wiring).
 */

const sizeMap: Record<SwatchPickerSize, string> = {
  'extra-small': 'w-5 h-5',
  small: 'w-6 h-6',
  medium: 'w-8 h-8',
  large: 'w-10 h-10',
};

const glyphSizeMap: Record<SwatchPickerSize, number> = {
  'extra-small': 10,
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
 * user-supplied colors, `input-pickers#16`). Without `colors` (an image has no single luminance)
 * it is the theme's foreground glyph over a background halo.
 */
function SwatchCheck({ colors, size }: { colors: CheckColors | null; size: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none grid">
      <CheckIcon
        size={size}
        strokeWidth={4}
        className={cn('col-start-1 row-start-1', !colors && 'text-background')}
        style={colors ? { color: colors.halo } : undefined}
      />
      <CheckIcon
        size={size}
        strokeWidth={2}
        className={cn('col-start-1 row-start-1', !colors && 'text-foreground')}
        style={colors ? { color: colors.glyph } : undefined}
      />
    </span>
  );
}

/**
 * The diagonal slash of a disabled swatch, drawn like the check glyph (a halo line under a glyph
 * line), so the state does not rely on the swatch color or its opacity.
 */
function SwatchSlash({ colors }: { colors: CheckColors | null }) {
  return (
    <svg
      data-wave-swatch-slash=""
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <line
        x1="5"
        y1="19"
        x2="19"
        y2="5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={4}
        className={colors ? undefined : 'text-background'}
        style={colors ? { color: colors.halo } : undefined}
      />
      <line
        x1="5"
        y1="19"
        x2="19"
        y2="5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        className={colors ? undefined : 'text-foreground'}
        style={colors ? { color: colors.glyph } : undefined}
      />
    </svg>
  );
}

/** Warns once per swatch kind (not per value: `<Kind>:unnamed`, e.g. `ColorSwatch:unnamed`). */
function warnUnnamedSwatch(kind: string, value: string, fallback: string): void {
  warnOnce(
    `${kind}:unnamed`,
    `${kind}: swatch "${value}" has no accessible name, so it is announced by its ${fallback}. ` +
      'Pass `aria-label`, or wrap it in a Tooltip with `relationship="label"`.',
  );
}

/**
 * A swatch's `icon` as a glyph inside its wired button (C-SLOTS): a `<button>` or `Button` is
 * unwrapped (its children become the glyph) with a one-time warning (`<Kind>:icon-button`).
 */
function useSwatchIcon(kind: string, icon: Slot<'span'> | undefined): Slot<'span'> | undefined {
  const { glyph, button } = unwrapButtonGlyph(icon);
  useSwatchIconWarning(kind, button);
  return glyph;
}

/** The one-time `<Kind>:icon-button` warning for an unwrapped button. */
function useSwatchIconWarning(kind: string, button: UnwrappedButton | null): void {
  React.useEffect(() => {
    if (button) {
      warnOnce(
        `${kind}:icon-button`,
        `${kind}: \`icon\` received ${button}; its children render as the glyph of the swatch ` +
          'and its props were dropped (buttons cannot be nested). Pass icon content instead, ' +
          'e.g. `icon={<MyIcon />}`.',
      );
    }
  }, [button, kind]);
}

/** The picker's context with this swatch's own `size` and `shape` applied over the picker's. */
function useSwatchContext(kind: string, size?: SwatchPickerSize, shape?: Shape) {
  const context = useSwatchPickerContext(kind);
  return { ...context, size: size ?? context.size, shape: shape ?? context.shape };
}

/**
 * Focus outline offset: 4px, clear of a selected swatch's ring band (ring and offset, 4px); 2px at
 * `spacing="small"` so it does not cover the neighbour (D22), where it lies over that band.
 */
function outlineOffset(spacing: 'small' | 'medium'): string {
  return spacing === 'small' ? 'focus-visible:outline-offset-2' : 'focus-visible:outline-offset-4';
}

/** The classes every swatch kind shares: size, shape, box, motion, focus ring and disabled look. */
function swatchBaseClasses(
  size: SwatchPickerSize,
  shape: Shape,
  spacing: 'small' | 'medium',
): string {
  return cn(
    sizeMap[size],
    shapeMap[shape],
    // The padding is set here (C-NATIVE).
    'relative flex shrink-0 items-center justify-center border-2 p-0',
    motionSafeTransition,
    focusRing,
    outlineOffset(spacing),
    'disabled:cursor-not-allowed disabled:opacity-50',
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
  /**
   * Decorative glyph (`aria-hidden`) shown while the swatch is not selected; the check replaces it
   * while selected. A `<button>` or `Button` passed here is not nested: its children become the
   * glyph and a one-time development warning is logged.
   */
  icon?: Slot<'span'>;
  /**
   * CSS color of the swatch's border, for a color close to the page background (set by hand, as
   * in Fluent). In forced colors the system border color replaces it.
   */
  borderColor?: string;
  /**
   * Size of the swatch (20, 24, 32 or 40px).
   * @default the picker's
   */
  size?: SwatchPickerSize;
  /**
   * Shape of the swatch.
   * @default the picker's
   */
  shape?: Shape;
  /** Ref to the `role="radio"` button. */
  ref?: React.Ref<HTMLButtonElement>;
}

/** What `ColorSwatch` and `ImageSwatch` do differently. */
interface SwatchRadioProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'color'
> {
  kind: 'ColorSwatch' | 'ImageSwatch';
  value: string;
  /** What names the swatch when it has no name: 'color value' or 'value' (the warning's text). */
  fallbackKind: string;
  /** The accessible name of an unnamed swatch. */
  defaultName: string;
  /** The luminance-picked glyph colors; `null`: the theme's foreground over a background halo. */
  checkColors: CheckColors | null;
  /** The swatch's own background, border color and image (they win over a consumer `style`). */
  paint: Record<string, string>;
  /** Classes of the image swatch's covering background. */
  paintClassName?: string;
  /** A color swatch keeps its colors in forced colors (the color is the content). */
  keepsColors: boolean;
  icon?: Slot<'span'>;
  size?: SwatchPickerSize;
  shape?: Shape;
  ref?: React.Ref<HTMLButtonElement>;
}

/** The radio button shared by `ColorSwatch` and `ImageSwatch`. */
const SwatchRadio = ({
  kind,
  value,
  fallbackKind,
  defaultName,
  checkColors,
  paint,
  paintClassName,
  keepsColors,
  icon,
  size: sizeProp,
  shape: shapeProp,
  className,
  style,
  onClick,
  disabled,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ref,
  ...rest
}: SwatchRadioProps) => {
  const {
    value: selectedValue,
    select,
    size,
    shape,
    spacing,
    getTabIndex,
    register,
  } = useSwatchContext(kind, sizeProp, shapeProp);
  const isSelected = selectedValue === value;
  const glyph = useSwatchIcon(kind, icon);

  React.useLayoutEffect(() => register(value), [register, value]);

  const named = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  React.useEffect(() => {
    if (!named) warnUnnamedSwatch(kind, value, fallbackKind);
  }, [named, kind, value, fallbackKind]);

  return (
    <button
      type="button"
      role="radio"
      {...rest}
      ref={ref}
      disabled={disabled}
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : defaultName)}
      aria-labelledby={ariaLabelledBy}
      aria-checked={isSelected}
      data-roving-value={value}
      data-selected={isSelected ? '' : undefined}
      tabIndex={getTabIndex(value)}
      onClick={composeEventHandlers(onClick, () => select(value))}
      className={cn(
        swatchBaseClasses(size, shape, spacing),
        // A `borderColor` arrives as a variable, so the forced-colors edge below still wins.
        'border-[color:var(--wave-swatch-border,transparent)]',
        paintClassName,
        // User colors are the content: keep them (and the check glyph) in forced colors, with a
        // Highlight outline, which an opted-out element would otherwise draw in author colors.
        keepsColors &&
          'forced-colors:forced-color-adjust-none forced-colors:focus-visible:outline-[Highlight]',
        forcedColors.border,
        // An image stays in forced colors, so its selection needs a sign of its own.
        isSelected && !keepsColors && 'forced-colors:border-[Highlight]',
        isSelected
          ? cn(
              'ring-2 ring-foreground ring-offset-2 ring-offset-background',
              keepsColors && 'forced-colors:ring-[Highlight]',
            )
          : 'not-disabled:not-aria-disabled:hover:border-stroke-hover',
        className,
      )}
      style={{ ...style, ...paint }}
    >
      {isSelected ? (
        <SwatchCheck colors={checkColors} size={glyphSizeMap[size]} />
      ) : (
        glyph != null &&
        slotRendersContent(glyph) &&
        renderSlot(glyph, 'span', 'pointer-events-none inline-flex', {
          'aria-hidden': true,
          style: checkColors ? { color: checkColors.glyph } : undefined,
        })
      )}
      {disabled && <SwatchSlash colors={checkColors} />}
    </button>
  );
};
SwatchRadio.displayName = 'SwatchRadio';

// D18: swatches read SwatchPickerContext; their own ref/className/style/rest go straight to the
// button (an explicit exception to C-ROUTING's root/control split).
/**
 * One color swatch of a `SwatchPicker`, read from `items` or rendered directly as a child.
 * Outside a `SwatchPicker` it throws in development and renders inertly in production.
 *
 * **Naming**: give it `aria-label`, or wrap it in a `Tooltip` with `relationship="label"` (its
 * `aria-labelledby` reaches this element, since every rest prop lands on the swatch's own
 * button). Without either it is named by its `color` value and a development warning is logged.
 *
 * **Disabled**: `disabled` is native (out of the arrow keys and the tab order, never selected);
 * the swatch is dimmed and crossed by a diagonal slash, so the state does not rely on its color.
 *
 * @example
 * <SwatchPicker aria-label="Accent color">
 *   <ColorSwatch value="red" color="#d13438" aria-label="Red" />
 * </SwatchPicker>
 */
export const ColorSwatch = ({ color, borderColor, ...rest }: ColorSwatchProps) => {
  return (
    <SwatchRadio
      {...rest}
      kind="ColorSwatch"
      fallbackKind="color value"
      defaultName={color}
      checkColors={getCheckColors(color)}
      keepsColors
      paint={{
        backgroundColor: color,
        ...(borderColor !== undefined && { '--wave-swatch-border': borderColor }),
      }}
    />
  );
};
ColorSwatch.displayName = 'ColorSwatch';

/** Properties for the ImageSwatch component. */
export interface ImageSwatchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value'
> {
  /** Unique identifier for the swatch (the value the picker selects and a form submits). */
  value: string;
  /** URL of the image (drawn as a covering background image). */
  src: string;
  /**
   * Size of the swatch (20, 24, 32 or 40px).
   * @default the picker's
   */
  size?: SwatchPickerSize;
  /**
   * Shape of the swatch.
   * @default the picker's
   */
  shape?: Shape;
  /** Ref to the `role="radio"` button. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * One image swatch of a `SwatchPicker`: a pattern or texture drawn as a covering background
 * image. Outside a `SwatchPicker` it throws in development and renders inertly in production.
 *
 * **Naming**: give it `aria-label`, or wrap it in a `Tooltip` with `relationship="label"`.
 * Without either it is named by its `value` and a development warning is logged.
 *
 * **Selected and disabled**: an image has no single luminance, so the check and the disabled slash
 * are the theme's foreground glyph over a background halo. Unlike `ColorSwatch` it does not opt
 * out of forced colors (a background image stays).
 *
 * @example
 * <SwatchPicker aria-label="Pattern">
 *   <ImageSwatch value="dots" src="/dots.png" aria-label="Dots" />
 * </SwatchPicker>
 */
export const ImageSwatch = ({ src, ...rest }: ImageSwatchProps) => {
  return (
    <SwatchRadio
      {...rest}
      kind="ImageSwatch"
      fallbackKind="value"
      defaultName={rest.value}
      checkColors={null}
      keepsColors={false}
      paintClassName="bg-cover bg-center bg-no-repeat"
      paint={{ backgroundImage: `url(${JSON.stringify(src)})` }}
    />
  );
};
ImageSwatch.displayName = 'ImageSwatch';

/** Properties for the EmptySwatch component. */
export interface EmptySwatchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Accessible name of the button.
   * @default 'Add color'
   */
  'aria-label'?: string;
  /**
   * Decorative glyph (`aria-hidden`). `null` and `undefined` keep the plus glyph; `false` or
   * anything that renders nothing shows none. A `<button>` or `Button` passed here is not nested:
   * its children become the glyph and a one-time development warning is logged.
   * @default a plus glyph
   */
  icon?: Slot<'span'>;
  /**
   * Size of the swatch (20, 24, 32 or 40px).
   * @default the picker's
   */
  size?: SwatchPickerSize;
  /**
   * Shape of the swatch.
   * @default the picker's
   */
  shape?: Shape;
  /** Ref to the button. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * An "add" button inside a `SwatchPicker` (for example to open a color dialog): it has no value
 * and is never selected. In the row layout it is a plain button with its own tab stop, outside
 * the radio group's arrow order, and arrow keys pressed on it do nothing. Outside a
 * `SwatchPicker` it throws in development and renders inertly in production.
 *
 * @example
 * <SwatchPicker aria-label="Accent color" items={items}>
 *   <EmptySwatch onClick={openColorDialog} />
 * </SwatchPicker>
 */
export const EmptySwatch = ({
  icon,
  size: sizeProp,
  shape: shapeProp,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ref,
  ...rest
}: EmptySwatchProps) => {
  const { size, shape, spacing } = useSwatchContext('EmptySwatch', sizeProp, shapeProp);
  const { glyph, button } = unwrapButtonGlyph(icon);
  useSwatchIconWarning('EmptySwatch', button);
  // The optional-indicator rule: `null`/`undefined` keep the plus, anything that renders nothing
  // hides it; an unwrapped button whose children render nothing keeps the plus too.
  const content =
    icon == null || (button !== null && !slotRendersContent(glyph)) ? (
      <AddIcon size={glyphSizeMap[size]} />
    ) : (
      glyph
    );

  return (
    <button
      type="button"
      {...rest}
      ref={ref}
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Add color')}
      aria-labelledby={ariaLabelledBy}
      // The picker's root skips its arrow handling for events from here.
      data-wave-empty-swatch=""
      className={cn(
        swatchBaseClasses(size, shape, spacing),
        'border-dashed border-stroke-accessible bg-transparent text-foreground',
        forcedColors.control,
        'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
        className,
      )}
    >
      {slotRendersContent(content) &&
        renderSlot(content, 'span', 'pointer-events-none inline-flex', { 'aria-hidden': true })}
    </button>
  );
};
EmptySwatch.displayName = 'EmptySwatch';
