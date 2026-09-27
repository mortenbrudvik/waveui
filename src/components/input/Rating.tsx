import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { slotRendersContent, type Slot } from '../../lib/slot';
import type { Size } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { HiddenInput } from '../internal/HiddenInput';
import {
  INERT_RATING_CONTEXT,
  RatingContext,
  RatingItem,
  ratingItems,
  resolveRatingColor,
  StarGlyph,
  useRatingItemChecks,
  useRatingItemRegistry,
  useStarGlyphs,
  type RatingColor,
  type RatingContextValue,
} from './Rating.item';

/**
 * The Rating's built-in star names, for localization. Each member is optional and falls back to
 * its English default.
 */
export interface RatingLabels {
  /**
   * Accessible name of the radio that chooses `value`: a whole star (1 to `max`), and with
   * `step={0.5}` a half value too ("2.5 stars").
   * @default (value) => value === 1 ? '1 star' : `${value} stars`
   */
  star?: (value: number, max: number) => string;
}

const defaultStarLabel = (value: number) => `${value} star${value !== 1 ? 's' : ''}`;

/** Properties for the Rating component. */
export interface RatingProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'color'
> {
  /**
   * Controlled rating value (`0` = no rating): a whole number of stars, or with `step={0.5}` a
   * multiple of 0.5. A value between two steps (2.7) checks no radio, is drawn as the step below
   * it (2.5) and holds the tab stop there; the keys move it to the next or previous step.
   */
  value?: number;
  /** Initial rating for uncontrolled usage (also the value a form reset restores).
   * @default 0
   */
  defaultValue?: number;
  /** Called with the new rating when it changes (not when the current star is chosen again). */
  onValueChange?: (value: number) => void;
  /**
   * Called with the new rating, exactly like `onValueChange`: only when the rating changes (0.4
   * also called it when the current star was clicked again, or a key was pressed at an end).
   * @deprecated Use `onValueChange`.
   */
  onChange?: (value: number) => void;
  /** Maximum number of stars.
   * @default 5
   */
  max?: number;
  /**
   * The grain of the rating: `1` (whole stars) or `0.5` (half stars). With `0.5`, each star stays
   * one pointer target of at least 24×24px (a larger `size` keeps a larger one): the half is
   * chosen by the pointer's position over it (the half at the inline start, which mirrors under
   * `dir="rtl"`), and two transparent radios per star, the half value then the full value, serve
   * the keyboard and screen readers. The keys then move by half a star. A value other than `0.5`
   * (from untyped code) counts as `1`. RatingDisplay has no `step`: it draws any fraction.
   * @default 1
   */
  step?: 0.5 | 1;
  /** Size of the star icons. Every size keeps a target of at least 24×24px.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Color of the filled stars: `marigold` (default), `brand` or `neutral`; unfilled stars keep a
   * 3:1 outline. Fluent's default is `neutral`. A value outside the three (from untyped code)
   * renders as `marigold`; the root carries `data-color` with the resolved value.
   * @default 'marigold'
   */
  color?: RatingColor;
  /**
   * The glyph of a filled star. `iconFilled` and `iconOutline` are the glyphs of a filled and an
   * unfilled star, as a pair; decorative. Fluent's RatingDisplay takes one `icon`; here a filled
   * and an unfilled star must differ by shape, not by color alone.
   *
   * - Each glyph is sized by `size` (an SVG child fills the star) and takes the star's color
   *   (paint it with `currentColor`). A half-filled star (`step={0.5}`) clips the filled glyph
   *   over the unfilled one from the inline start.
   * - `null`, `undefined` and a value that renders nothing draw the default star. A value that
   *   renders nothing, and a pair with only one of the two set, log a development warning.
   * - A `<button>` or `Button` element (or a slot object whose `as` is one) is not nested in the
   *   star: its children become the glyph (the default star when they render nothing), its props
   *   are dropped, and a development warning says so (in place of the warning for a value that
   *   renders nothing).
   * - A `Rating.Item` that sets its own pair draws that one instead.
   */
  iconFilled?: Slot<'span'>;
  /**
   * The glyph of an unfilled star, as a pair with `iconFilled` (its rules apply); decorative.
   * Fluent's RatingDisplay takes one `icon`; here a filled and an unfilled star must differ by
   * shape, not by color alone.
   */
  iconOutline?: Slot<'span'>;
  /** Whether the rating is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /**
   * Form field name. With a name, the chosen rating is submitted with the form (nothing while no
   * star is chosen).
   */
  name?: string;
  /** A star must be chosen before the form can be submitted (native validation). */
  required?: boolean;
  /** Id of the form the rating belongs to, when it is rendered outside that form. */
  form?: string;
  /**
   * Names of the stars ("1 star", "2 stars", …, and "2.5 stars" for a half value), for
   * localization. The group's own name is `aria-label` (default "Rating"). Unset members keep
   * their English defaults.
   */
  labels?: RatingLabels;
  /**
   * Custom stars: one `Rating.Item` per value from 1 to `max`, in place of the generated stars
   * (when the children render content). `max` still sets the key range and the star names.
   */
  children?: React.ReactNode;
  /** Ref to the `role="radiogroup"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Built-in texts of RatingDisplay, for localization. */
export interface RatingDisplayLabels {
  /**
   * Accessible name. `formattedValue` is `value` formatted with `locale` (as shown).
   * @default (value, max, formattedValue) => `Rating: ${formattedValue} out of ${max}`
   */
  rating?: (value: number, max: number, formattedValue: string) => string;
  /**
   * Count part of the name.
   * @default (count, formatted) => count === 1 ? '1 rating' : `${formatted} ratings`
   */
  count?: (count: number, formattedCount: string) => string;
}

/** Properties for the RatingDisplay (read-only) component. */
export interface RatingDisplayProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  /**
   * Rating value to display. A fraction is drawn as a partly filled star (`4.6` fills 60% of the
   * fifth star), so the stars show the value the accessible name reports.
   */
  value: number;
  /** Maximum number of stars.
   * @default 5
   */
  max?: number;
  /** Size of the star icons (and of the value and count text).
   * @default 'medium'
   */
  size?: Size;
  /**
   * Color of the filled stars: `marigold` (default), `brand` or `neutral`; unfilled stars keep a
   * 3:1 outline. Fluent's default is `neutral`. A value outside the three (from untyped code)
   * renders as `marigold`; the root carries `data-color` with the resolved value.
   * @default 'marigold'
   */
  color?: RatingColor;
  /**
   * The glyph of a filled star. `iconFilled` and `iconOutline` are the glyphs of a filled and an
   * unfilled star, as a pair; decorative. Fluent's RatingDisplay takes one `icon`; here a filled
   * and an unfilled star must differ by shape, not by color alone.
   *
   * - Each glyph is sized by `size` (an SVG child fills the star) and takes the star's color
   *   (paint it with `currentColor`). A partly filled star clips the filled glyph over the
   *   unfilled one from the inline start, and the `compact` star is the filled glyph.
   * - `null`, `undefined` and a value that renders nothing draw the default star. A value that
   *   renders nothing, and a pair with only one of the two set, log a development warning.
   * - A `<button>` or `Button` element (or a slot object whose `as` is one) is not nested in the
   *   star: its children become the glyph (the default star when they render nothing), its props
   *   are dropped, and a development warning says so (in place of the warning for a value that
   *   renders nothing).
   * - A `RatingDisplay.Item` that sets its own pair draws that one instead.
   */
  iconFilled?: Slot<'span'>;
  /**
   * The glyph of an unfilled star, as a pair with `iconFilled` (its rules apply); decorative.
   * Fluent's RatingDisplay takes one `icon`; here a filled and an unfilled star must differ by
   * shape, not by color alone.
   */
  iconOutline?: Slot<'span'>;
  /**
   * Shows the value as text after the stars, formatted with `locale` (up to one decimal).
   * @default false
   */
  showValue?: boolean;
  /**
   * Number of ratings: shown as "(1,160)" after the value with the locale's digit grouping, and
   * added to the accessible name ("…, 1,160 ratings").
   */
  count?: number;
  /**
   * One filled star followed by the value (and the count) instead of `max` stars. Implies
   * `showValue`.
   * @default false
   */
  compact?: boolean;
  /**
   * BCP 47 locale of the value and count formatting (runtime default when omitted; pass it when
   * rendering on the server). A tag `Intl` rejects (the POSIX `de_DE`, a typo) falls back to the
   * runtime default locale (development warning).
   */
  locale?: string;
  /** Built-in texts, for localization. */
  labels?: RatingDisplayLabels;
  /**
   * Custom stars: one `RatingDisplay.Item` per value from 1 to `max`, in place of the generated
   * stars (when the children render content). A `compact` display ignores them.
   */
  children?: React.ReactNode;
  /** Ref to the root element. */
  ref?: React.Ref<HTMLDivElement>;
}

const RatingRoot = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  max = 5,
  step: stepProp,
  size = 'medium',
  color,
  iconFilled,
  iconOutline,
  disabled = false,
  name,
  required,
  form,
  labels,
  className,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  onKeyDown,
  onFocus,
  onMouseLeave,
  ref,
  ...rest
}: RatingProps) => {
  if (onChange !== undefined) warnDeprecated('Rating', 'onChange', 'onValueChange');
  const initialValue = defaultValue ?? 0;
  const [value, setValue] = useControllable(valueProp, initialValue, (next: number) => {
    onValueChange?.(next);
    onChange?.(next);
  });
  // The items draw whole or half stars only, so the keys move by one of the two (untyped code
  // may pass another number).
  const step: 0.5 | 1 = stepProp === 0.5 ? 0.5 : 1;

  const [hovered, setHovered] = React.useState(0);
  // A hover preview must not survive the rating becoming disabled (adjust state during render).
  const [prevDisabled, setPrevDisabled] = React.useState(disabled);
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    if (disabled) setHovered(0);
  }
  const drawnValue = disabled ? value : hovered || value;

  // Roving tab stop (the radio of the chosen value, else the first) and focus moves; the keys are
  // handled below. A value between two steps holds the tab stop on the radio below it (D23).
  const { containerProps, getTabIndex, focusValue } = useRovingTabIndex({
    activeValue: value >= step ? String(Math.floor(value / step) * step) : null,
  });

  // The next and previous multiples of `step`: a value between two steps (a controlled 2.7 at
  // step 0.5) moves to the step above or below it (3 or 2.5).
  const up = (v: number) => Math.floor(v / step) * step + step;
  const down = (v: number) => Math.ceil(v / step) * step - step;

  // Keys count from the current rating, not from the focused radio (0.4 semantics): from an empty
  // rating, Tab lands on the unchosen first radio and Right/Up/Home choose it. Never wraps.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    let next: number;
    if (e.key === 'Home') next = step;
    else if (e.key === 'End') next = max;
    else if (e.key === 'ArrowUp') next = up(value);
    else if (e.key === 'ArrowDown') next = down(value);
    else {
      const intent = getArrowIntent(e.key, {
        orientation: 'horizontal',
        dir: getDirection(e.currentTarget),
      });
      if (!intent) return;
      next = intent === 'next' ? up(value) : down(value);
    }
    e.preventDefault();
    next = Math.min(next, max);
    // The ends are no-ops (nothing is emitted, focus stays), and Left/Down never clear to 0.
    if (disabled || next < step || next === value) return;
    focusValue(String(next));
    setValue(next);
  };

  const rootRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, containerProps.ref, rootRef);

  const field = useFieldContext();
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      // An explicit `required={false}` wins over a required Field, so aria-required always
      // matches the native validation below (`isRequired`).
      'aria-required': ariaRequired ?? required,
    },
    { labelable: false },
  );
  const isRequired = required ?? field?.required ?? false;
  const defaultName =
    fieldProps['aria-label'] === undefined && fieldProps['aria-labelledby'] === undefined
      ? 'Rating'
      : undefined;

  useFormReset(rootRef, () => setValue(initialValue), form);

  const focusTabStop = () => {
    rootRef.current?.querySelector<HTMLElement>('[data-roving-value][tabindex="0"]')?.focus();
  };

  // A pointer click on a half star focuses the radio it chose, so the keyboard continues from
  // there, without scrolling: the star is under the pointer already (D22).
  const focusChosen = useEventCallback((key: string) => {
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-roving-value="${key}"]`)
      ?.focus({ preventScroll: true });
  });

  const resolvedColor = resolveRatingColor(color);
  const glyphs = useStarGlyphs('Rating', iconFilled, iconOutline);
  const starLabel = labels?.star ?? defaultStarLabel;
  const { registerItem, counts } = useRatingItemRegistry();
  // Whether the root draws its own children instead of the `max` generated stars (D26): the
  // generated stars always cover every value on their own, so only a custom item set can leave
  // one missing.
  const hasItems = slotRendersContent(children);
  useRatingItemChecks(counts, max, hasItems);
  const context = React.useMemo<RatingContextValue>(
    () => ({
      kind: 'input',
      value,
      drawnValue,
      step,
      max,
      size,
      color: resolvedColor,
      glyphs,
      disabled,
      starLabel,
      getTabIndex,
      choose: (next, focus) => {
        setValue(next);
        if (focus) focusChosen(String(next));
      },
      preview: setHovered,
      registerItem,
    }),
    [
      value,
      drawnValue,
      step,
      max,
      size,
      resolvedColor,
      glyphs,
      disabled,
      starLabel,
      getTabIndex,
      setValue,
      focusChosen,
      registerItem,
    ],
  );

  return (
    <div
      role="radiogroup"
      aria-label={defaultName}
      {...fieldProps}
      aria-disabled={disabled || undefined}
      data-color={resolvedColor}
      className={cn(
        'relative inline-flex items-center gap-0.5',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
      ref={mergedRef}
      data-roving-container=""
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      onFocus={composeEventHandlers(onFocus, containerProps.onFocus, {
        checkDefaultPrevented: false,
      })}
      onMouseLeave={composeEventHandlers(onMouseLeave, () => setHovered(0), {
        checkDefaultPrevented: false,
      })}
    >
      <RatingContext.Provider value={context}>{ratingItems(children, max)}</RatingContext.Provider>
      <HiddenInput
        type="radio"
        name={name}
        form={form}
        disabled={disabled}
        value={value > 0 ? String(value) : ''}
        required={isRequired}
        onInvalid={focusTabStop}
      />
    </div>
  );
};
RatingRoot.displayName = 'Rating';

/** Text size of the value and the count, following the star size. */
const textSizeMap: Record<Size, string> = {
  'extra-small': 'text-caption-1',
  small: 'text-caption-1',
  medium: 'text-body-1',
  large: 'text-body-2',
  'extra-large': 'text-body-2',
};

const defaultRatingLabel = (_value: number, max: number, formattedValue: string) =>
  `Rating: ${formattedValue} out of ${max}`;
const defaultCountLabel = (count: number, formattedCount: string) =>
  count === 1 ? '1 rating' : `${formattedCount} ratings`;

/** `locale` when `Intl` accepts it as a language tag, else `undefined` (the runtime default). */
function supportedLocale(locale: string | undefined): string | undefined {
  if (locale === undefined) return undefined;
  try {
    Intl.getCanonicalLocales(locale);
    return locale;
  } catch {
    return undefined;
  }
}

const RatingDisplayRoot = ({
  value,
  max = 5,
  size = 'medium',
  color,
  iconFilled,
  iconOutline,
  showValue = false,
  count,
  compact = false,
  locale,
  labels,
  className,
  children,
  ref,
  ...rest
}: RatingDisplayProps) => {
  const formatLocale = supportedLocale(locale);
  const invalidLocale = locale !== undefined && formatLocale === undefined;
  React.useEffect(() => {
    if (invalidLocale) {
      warnOnce(
        `RatingDisplay:invalid-locale:${locale}`,
        `RatingDisplay: \`locale\` "${locale}" is not a valid BCP 47 language tag (use hyphens, as ` +
          'in "en-US"). The runtime default locale formats the value instead, so the server and ' +
          'the browser may render different text.',
      );
    }
  }, [invalidLocale, locale]);

  const formattedValue = new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 1 }).format(
    value,
  );
  const formattedCount =
    count === undefined ? undefined : new Intl.NumberFormat(formatLocale).format(count);
  const ratingName = (labels?.rating ?? defaultRatingLabel)(value, max, formattedValue);
  const name =
    count === undefined || formattedCount === undefined
      ? ratingName
      : `${ratingName}, ${(labels?.count ?? defaultCountLabel)(count, formattedCount)}`;
  const showText = showValue || compact || count !== undefined;
  const textSize = textSizeMap[size];

  const resolvedColor = resolveRatingColor(color);
  const glyphs = useStarGlyphs('RatingDisplay', iconFilled, iconOutline);
  const { registerItem, counts } = useRatingItemRegistry();
  // A compact display ignores `children` (D26): it never renders items of its own, so a value
  // from 1 to `max` without an item is never "missing" on purpose.
  const hasItems = !compact && slotRendersContent(children);
  useRatingItemChecks(counts, max, hasItems);
  // Read-only: the stars take the inert actions (they choose, preview and rove nothing).
  const context = React.useMemo<RatingContextValue>(
    () => ({
      ...INERT_RATING_CONTEXT,
      kind: 'display',
      value,
      drawnValue: value,
      max,
      size,
      color: resolvedColor,
      glyphs,
      registerItem,
    }),
    [value, max, size, resolvedColor, glyphs, registerItem],
  );

  return (
    <div
      ref={ref}
      role="img"
      aria-label={name}
      data-compact={compact ? '' : undefined}
      data-color={resolvedColor}
      className={cn('inline-flex items-center gap-0.5', className)}
      {...rest}
    >
      {compact ? (
        <StarGlyph fraction={1} size={size} color={resolvedColor} glyphs={glyphs} />
      ) : (
        <RatingContext.Provider value={context}>
          {ratingItems(children, max)}
        </RatingContext.Provider>
      )}
      {showText && (
        <span className={cn('ms-1 font-semibold text-foreground', textSize)}>{formattedValue}</span>
      )}
      {formattedCount !== undefined && (
        <span className={cn('ms-1 text-muted-foreground', textSize)}>({formattedCount})</span>
      )}
    </div>
  );
};
RatingDisplayRoot.displayName = 'RatingDisplay';

/**
 * A star rating input (`role="radiogroup"` of `role="radio"` stars).
 *
 * - One tab stop (the radio of the chosen value, else the first). Keys choose relative to the
 *   current rating and move focus to the chosen radio, as in 0.4: Right/Up one `step` more (a
 *   star, or half a star), Left/Down one fewer (Left/Right mirrored under `dir="rtl"`), Home the
 *   smallest value (`step`) and End `max`. From an empty rating, Right/Up/Home choose `step`.
 *   Keys at the ends (and Left/Down while empty) emit nothing.
 * - The keyboard cannot clear a rating: Left/Down stop at `step` (APG radio group; 0.4 went down
 *   to 0). Only a controlled `value={0}` (or a form reset while `defaultValue` is 0) clears it.
 * - `step={0.5}` offers half stars. Each star stays one pointer target, which chooses by the
 *   pointer's position (its half from the inline start, else its full value) and then focuses
 *   the radio it chose; it holds two transparent radios ("2.5 stars", "3 stars") for the
 *   keyboard and screen readers, and draws the focus ring of either. A controlled value between
 *   two steps checks no radio and is drawn as the step below it; the keys move it to the next or
 *   previous step.
 * - `onValueChange` (and the deprecated `onChange` alias) fire only when the rating changes, so
 *   choosing the current star again calls neither.
 * - Hovering previews a value (half stars preview by the pointer's position); the preview never
 *   outlives the hover or a disabled state.
 * - `color` colors the filled stars (`marigold`, the default, `brand` or `neutral`; the root
 *   carries `data-color`); `iconFilled` and `iconOutline` replace the star glyphs, as a pair.
 * - Inside a `Field` it is named by the Field label (instead of the default "Rating") and
 *   described by its hint and error. The stars are named "1 star", "2 stars", … (and a half value
 *   "2.5 stars"); `labels` localizes these names.
 * - With `name` (or `required`) it takes part in native forms; a form reset restores
 *   `defaultValue`.
 * - The stars are generated from `max`. Children that render content replace them: one
 *   `Rating.Item` per value from 1 to `max`, chosen, previewed, roved and named as the generated
 *   stars are (`max` still sets the key range and the star names).
 *
 * Sub-component: `Rating.Item` (the same component as `RatingDisplay.Item`). React Server
 * Components import its flat name `RatingItem` (dotted access needs a client file).
 */
export const Rating = /* @__PURE__ */ Object.assign(RatingRoot, { Item: RatingItem });

/**
 * A read-only star rating (`role="img"` named "Rating: <value> out of <max>"). A fractional value
 * is drawn with a partly filled star, so the stars and the name show the same value.
 *
 * - `showValue` adds the value as text after the stars, `count` the number of ratings ("(1,160)",
 *   also added to the name), and `compact` shows one filled star with the value instead of `max`
 *   stars (the root carries `data-compact`). Without them only the stars show.
 * - The value (up to one decimal) and the count are formatted with `locale`, in the text and in
 *   the name; `labels` localizes the name. Pass `locale` when rendering on the server.
 * - `color` colors the filled stars (`marigold`, the default, `brand` or `neutral`; the root
 *   carries `data-color`); `iconFilled` and `iconOutline` replace the star glyphs, as a pair.
 * - The stars are generated from `max`. Children that render content replace them: one
 *   `RatingDisplay.Item` per value from 1 to `max`. A `compact` display ignores them.
 *
 * Sub-component: `RatingDisplay.Item` (the same component as `Rating.Item`). React Server
 * Components import its flat name `RatingDisplayItem`, or `RatingItem` (dotted access needs a
 * client file).
 */
export const RatingDisplay = /* @__PURE__ */ Object.assign(RatingDisplayRoot, {
  Item: RatingItem,
});

/**
 * Flat name of `RatingDisplay.Item` for React Server Components (the same component as
 * `RatingItem`).
 */
export const RatingDisplayItem = RatingItem;

export { RatingItem, type RatingItemProps, type RatingColor } from './Rating.item';
