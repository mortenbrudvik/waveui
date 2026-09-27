import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { isOwnEvent } from '../../lib/events';
import { StarIcon } from '../../lib/icons';
import { materialiseSlotContent, renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Size } from '../../lib/types';
import { unwrapButtonGlyph, type UnwrappedButton } from '../button/Button.slots';

/** Color of a rating's filled stars. */
export type RatingColor = 'neutral' | 'brand' | 'marigold';

/** Filled-star color of each `color` (unfilled stars keep {@link UNFILLED_COLOR}). */
export const FILLED_COLOR: Readonly<Record<RatingColor, string>> = {
  marigold: 'text-rating',
  brand: 'text-primary',
  neutral: 'text-foreground',
};

/** Unfilled-star color in every `color`: the outline token, with a 3:1 non-text contrast. */
const UNFILLED_COLOR = 'text-stroke-accessible';

/**
 * The color a root draws (Phase 4 D24): `color` itself, or `'marigold'` (the default) for
 * `undefined` and for a value outside the union from untyped code.
 */
export function resolveRatingColor(color: RatingColor | undefined): RatingColor {
  return color === 'brand' || color === 'neutral' ? color : 'marigold';
}

/** Icon size of each star size. */
const sizeMap: Record<Size, string> = {
  'extra-small': 'h-3 w-3',
  small: 'h-4 w-4',
  medium: 'h-5 w-5',
  large: 'h-6 w-6',
  'extra-large': 'h-8 w-8',
};

/** Padding that gives every interactive star a target of at least 24×24px (WCAG 2.5.8). */
const targetPaddingMap: Record<Size, string> = {
  'extra-small': 'p-1.5', // 12px icon + 12px
  small: 'p-1', // 16px icon + 8px
  medium: 'p-0.5', // 20px icon + 4px
  large: 'p-0.5',
  'extra-large': 'p-0.5',
};

/**
 * The glyphs a star draws, from an `iconFilled`/`iconOutline` pair resolved by
 * {@link useStarGlyphs}: `null` draws the default star.
 */
export interface StarGlyphs {
  /** The glyph of a filled star, or `null` for the default star. */
  filled: Slot<'span'> | null;
  /** The glyph of an unfilled star, or `null` for the default star. */
  outline: Slot<'span'> | null;
}

/** The default stars: what a rating without an icon pair draws. */
const DEFAULT_GLYPHS: StarGlyphs = { filled: null, outline: null };

/** One glyph of an icon pair, resolved, with what its development warnings need. */
interface ResolvedGlyph {
  /** What the star draws: the glyph, or `null` for the default star. */
  glyph: Slot<'span'> | null;
  /** The button unwrapped from the slot, if any. */
  button: UnwrappedButton | null;
  /** The slot is set but renders nothing (an unwrapped button warns about itself instead). */
  empty: boolean;
}

/**
 * One glyph of an icon pair (C-SLOTS: a required indicator, and a glyph inside a wired button,
 * the radio of a Rating): a button passed as the glyph is unwrapped, its children becoming the
 * glyph, and `null`, `undefined` and a value that renders nothing keep the default star.
 */
function resolveGlyph(slot: Slot<'span'> | undefined): ResolvedGlyph {
  const { glyph, button } = unwrapButtonGlyph(slot);
  const renders = slotRendersContent(glyph);
  return {
    glyph: renders ? glyph : null,
    button,
    empty: slot != null && button === null && !renders,
  };
}

/** The development warnings of one glyph of a pair (C-DEV: from an effect, once per key). */
function useGlyphWarnings(
  component: string,
  name: 'iconFilled' | 'iconOutline',
  { button, empty }: ResolvedGlyph,
) {
  React.useEffect(() => {
    if (empty) {
      warnOnce(
        `${component}:${name}-empty`,
        `${component}: \`${name}\` renders nothing, so the default star is used.`,
      );
    }
    if (button) {
      warnOnce(
        `${component}:${name}-button`,
        `${component}: \`${name}\` received ${button}; its children render as the glyph of the ` +
          'star and its props were dropped (buttons cannot be nested). Pass icon content ' +
          `instead, e.g. \`${name}={<MyIcon />}\`.`,
      );
    }
  }, [component, name, empty, button]);
}

/**
 * The glyphs of a component's `iconFilled`/`iconOutline` pair (Phase 4 D25), with the pair's
 * development warnings, each from an effect and once per key (C-DEV): only one of the two set
 * (`<component>:icon-pair`), a glyph that renders nothing (`<component>:iconFilled-empty`,
 * `<component>:iconOutline-empty`) and a button unwrapped (`<component>:iconFilled-button`,
 * `<component>:iconOutline-button`). The result keeps its identity while the glyphs do.
 *
 * @param component The public name that starts the keys and messages: `'Rating'`,
 *   `'RatingDisplay'` or `'Rating.Item'`.
 */
export function useStarGlyphs(
  component: string,
  iconFilled: Slot<'span'> | undefined,
  iconOutline: Slot<'span'> | undefined,
): StarGlyphs {
  const filled = resolveGlyph(iconFilled);
  const outline = resolveGlyph(iconOutline);
  // A custom glyph next to the default star mixes shapes.
  const onlyOne = (iconFilled === undefined) !== (iconOutline === undefined);
  React.useEffect(() => {
    if (onlyOne) {
      warnOnce(
        `${component}:icon-pair`,
        `${component}: pass both \`iconFilled\` and \`iconOutline\`: with only one of them, the ` +
          'other is the default star.',
      );
    }
  }, [component, onlyOne]);
  useGlyphWarnings(component, 'iconFilled', filled);
  useGlyphWarnings(component, 'iconOutline', outline);
  const filledGlyph = filled.glyph;
  const outlineGlyph = outline.glyph;
  return React.useMemo(
    () => ({ filled: filledGlyph, outline: outlineGlyph }),
    [filledGlyph, outlineGlyph],
  );
}

/** How a whole star looks, filled or unfilled: see {@link starLook}. */
interface StarLook {
  /** The color class: the rating color when filled, else the outline token. */
  colorClass: string;
  /** The glyph of the pair to draw (`null`: the default star). */
  glyph: Slot<'span'> | null;
}

/**
 * The one look of a star (every star kind draws through it): a filled star takes the rating
 * color and the filled glyph of the pair, an unfilled star the outline token and the outline
 * glyph.
 */
function starLook(filled: boolean, color: RatingColor, glyphs: StarGlyphs): StarLook {
  return filled
    ? { colorClass: FILLED_COLOR[color], glyph: glyphs.filled }
    : { colorClass: UNFILLED_COLOR, glyph: glyphs.outline };
}

/**
 * Draws only the glyph of a star, in the color its box sets: the custom `glyph` when there is
 * one, in a decorative span of the star's size (an SVG child fills it), else the default star,
 * filled or outlined. The box around it (a {@link StarGlyph}, or the radio of a whole star)
 * carries the color.
 */
function GlyphLayer({
  filled,
  glyph,
  className,
}: {
  filled: boolean;
  glyph: Slot<'span'> | null;
  className: string;
}) {
  if (glyph != null) {
    return renderSlot(glyph, 'span', cn('inline-flex shrink-0 [&>svg]:size-full', className), {
      'aria-hidden': true,
    });
  }
  return filled ? (
    <StarIcon className={className} />
  ) : (
    <StarIcon className={className} fill="none" stroke="currentColor" strokeWidth={1.5} />
  );
}
GlyphLayer.displayName = 'GlyphLayer';

/** Properties of {@link StarGlyph}. */
export interface StarGlyphProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  /**
   * How much of the star is filled: `1` filled, `0` unfilled, and a partly filled star in between
   * (clamped to 0…1, drawn to the whole percent).
   */
  fraction: number;
  /** The star size. */
  size: Size;
  /** The color of the filled glyph; the unfilled glyph keeps the 3:1 outline token. */
  color: RatingColor;
  /** The glyphs to draw, from {@link useStarGlyphs}. */
  glyphs: StarGlyphs;
  /** Ref to the star's `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/**
 * One star drawn filled to `fraction`, in a `<span>` that is the star's own box, so it draws the
 * same wherever it is placed: at 1 the filled glyph in the rating color, at 0 the unfilled glyph
 * in the outline color, and in between the unfilled glyph with the filled glyph clipped over it
 * from the inline start to the fraction (the reading direction of the stars, also under RTL).
 * The stars of a RatingDisplay (each item, and the compact star) and the half stars of a Rating
 * draw through it; a whole radio star is a box itself (its button carries the color) and draws
 * its glyph with {@link GlyphLayer}.
 */
export const StarGlyph = ({
  fraction,
  size,
  color,
  glyphs,
  className,
  ref,
  ...rest
}: StarGlyphProps) => {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const starSize = sizeMap[size];
  if (percent > 0 && percent < 100) {
    const unfilled = starLook(false, color, glyphs);
    const filled = starLook(true, color, glyphs);
    return (
      <span
        {...rest}
        ref={ref}
        className={cn('relative inline-flex', unfilled.colorClass, className)}
      >
        <GlyphLayer filled={false} glyph={unfilled.glyph} className={starSize} />
        <span
          className={cn('absolute inset-y-0 start-0 flex overflow-hidden', filled.colorClass)}
          style={{ width: `${percent}%` }}
        >
          <GlyphLayer filled glyph={filled.glyph} className={cn(starSize, 'shrink-0')} />
        </span>
      </span>
    );
  }
  const filled = percent === 100;
  const look = starLook(filled, color, glyphs);
  return (
    <span {...rest} ref={ref} className={cn('inline-flex', look.colorClass, className)}>
      <GlyphLayer filled={filled} glyph={look.glyph} className={starSize} />
    </span>
  );
};
StarGlyph.displayName = 'StarGlyph';

/**
 * What a Rating or a RatingDisplay tells its items: the stars render from it, whether the root
 * generated them or the consumer passed them as children.
 */
export interface RatingContextValue {
  /** `'input'`: the items are the radios of a Rating; `'display'`: the drawn stars of a RatingDisplay. */
  kind: 'input' | 'display';
  /** The chosen rating (a Rating) or the displayed value (a RatingDisplay). */
  value: number;
  /** The value the stars draw: a Rating's hover preview while there is one, else `value`. */
  drawnValue: number;
  /** The grain of the values a star chooses. */
  step: 0.5 | 1;
  /** The number of stars: the key range, and the second argument of `starLabel`. */
  max: number;
  /** The star size. */
  size: Size;
  /** The color of the filled stars (resolved: a value outside the union is `'marigold'`). */
  color: RatingColor;
  /**
   * The glyphs of the root's `iconFilled`/`iconOutline` pair, for every item (an item that sets
   * its own pair draws that one instead).
   */
  glyphs: StarGlyphs;
  /** The stars cannot be chosen or previewed (a disabled Rating, and every RatingDisplay). */
  disabled: boolean;
  /** The accessible name of the star that chooses `value` (the root's `labels.star`). */
  starLabel: (value: number, max: number) => string;
  /** The roving `tabIndex` of the star whose `data-roving-value` is `key`. */
  getTabIndex: (key: string) => number;
  /**
   * Chooses `value`; with `focus`, the radio of `value` also takes focus, without scrolling (a
   * pointer click on a half star).
   */
  choose: (value: number, focus: boolean) => void;
  /** Previews `value` under the mouse (`0` clears the preview). */
  preview: (value: number) => void;
  /** Counts a mounted item's value; returns the cleanup that uncounts it. */
  registerItem: (value: number) => () => void;
}

const noop = () => {};

/**
 * The context of an item outside a rating (production; development throws there): an empty,
 * read-only star. RatingDisplay starts from it, since its stars choose, preview and rove nothing.
 */
export const INERT_RATING_CONTEXT: RatingContextValue = {
  kind: 'display',
  value: 0,
  drawnValue: 0,
  step: 1,
  max: 5,
  size: 'medium',
  color: 'marigold',
  glyphs: DEFAULT_GLYPHS,
  disabled: true,
  starLabel: () => '',
  getTabIndex: () => -1,
  choose: noop,
  preview: noop,
  registerItem: () => noop,
};

/** Provided by Rating and RatingDisplay to their items; `null` outside them. */
export const RatingContext = React.createContext<RatingContextValue | null>(null);
RatingContext.displayName = 'RatingContext';

/** C-CONTEXT: throws in development, logs once and returns the inert value in production. */
export function useRatingContext(): RatingContextValue {
  const context = React.useContext(RatingContext);
  if (context) return context;
  reportMissingContext('Rating.Item', 'a rating (Rating or RatingDisplay)');
  return INERT_RATING_CONTEXT;
}

/** The item registry of a rating root: the values of its mounted items, counted. */
export interface RatingItemRegistry {
  /**
   * Counts a mounted item's value and returns the cleanup that uncounts it. Items call it from a
   * layout effect.
   */
  registerItem: (value: number) => () => void;
  /**
   * How many mounted items have each value. The items change it in their layout effects, so read
   * it in an effect of the root (a passive effect runs after every layout effect of the commit),
   * never during render.
   */
  counts: ReadonlyMap<number, number>;
}

/**
 * A rating root's item registry: one object, with the same `registerItem` and `counts`, for the
 * root's lifetime, so the memoized context keeps its identity.
 */
export function useRatingItemRegistry(): RatingItemRegistry {
  const [registry] = React.useState<RatingItemRegistry>(() => {
    const counts = new Map<number, number>();
    return {
      counts,
      registerItem: (value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        return () => {
          const count = (counts.get(value) ?? 1) - 1;
          if (count > 0) counts.set(value, count);
          else counts.delete(value);
        };
      },
    };
  });
  return registry;
}

/** Properties for the RatingItem component (`Rating.Item`, `RatingDisplay.Item`). */
export interface RatingItemProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'role' | 'aria-checked' | 'aria-label' | 'aria-labelledby' | 'tabIndex' | 'children' | 'onChange'
> {
  /**
   * The star's full value, from 1 to the root's `max`: the rating it chooses (with the root's
   * `step={0.5}` also its half, `value - 0.5`), or shows.
   */
  value: number;
  /**
   * The glyph of this star when filled, as a pair with `iconOutline`, following the rules of the
   * root's `iconFilled` (a button is unwrapped, its children becoming the glyph, and a value or
   * button children that render nothing draw the default star). An item that sets either glyph
   * of the pair (`null` included) draws its own pair instead of its root's, and a glyph it leaves
   * unset is the default star (a development warning says so).
   */
  iconFilled?: Slot<'span'>;
  /**
   * The glyph of this star when unfilled, as a pair with `iconFilled`, following the rules of the
   * root's `iconOutline` (a button is unwrapped, its children becoming the glyph, and a value or
   * button children that render nothing draw the default star). An item that sets either glyph
   * of the pair (`null` included) draws its own pair instead of its root's, and a glyph it leaves
   * unset is the default star (a development warning says so).
   */
  iconOutline?: Slot<'span'>;
  /**
   * Ref to the star element: the `role="radio"` button in a Rating, the star `<span>` in a Rating
   * with `step={0.5}` and in a RatingDisplay.
   */
  ref?: React.Ref<HTMLElement>;
}

/**
 * One star of a `Rating` or a `RatingDisplay`, drawn from its root: pass one per value from 1 to
 * `max` as the root's children, in place of the stars it generates.
 *
 * - In a `Rating` it is a `role="radio"` button named by the root's `labels.star` ("2 stars"),
 *   chosen, previewed and roved as a generated star is. With the root's `step={0.5}` it is a star
 *   `<span>`, one pointer target that chooses by the pointer's position, holding two transparent
 *   radios: its half value, then its full value ("1.5 stars", "2 stars"). In a `RatingDisplay` it
 *   is a star filled, partly filled or empty by the root's value.
 * - It draws the root's `color` and glyph pair, or its own `iconFilled`/`iconOutline` pair when it
 *   sets one.
 * - `className`, `style`, `data-*`, the other attributes, the handlers and `ref` go to that star
 *   element, the consumer's handlers first. The role, name, checked state and tab stop of its
 *   radio (or radios) come from the root.
 * - Outside a `Rating` or `RatingDisplay` it throws in development.
 */
export const RatingItem = ({
  value,
  iconFilled,
  iconOutline,
  className,
  ref,
  ...rest
}: RatingItemProps) => {
  const ctx = useRatingContext();
  const { registerItem } = ctx;
  React.useLayoutEffect(() => registerItem(value), [registerItem, value]);
  // The item's own pair, when it sets either glyph, replaces its root's pair as a whole.
  const ownGlyphs = useStarGlyphs('Rating.Item', iconFilled, iconOutline);
  const glyphs = iconFilled !== undefined || iconOutline !== undefined ? ownGlyphs : ctx.glyphs;

  // `rest` keeps every consumer handler: a star without handlers of its own (a display star)
  // spreads them all, and a star that composes one takes that one out of `rest` itself.
  if (ctx.kind === 'display') {
    // Filled by the share of this star that the drawn value covers.
    return (
      <StarGlyph
        {...rest}
        ref={ref as React.Ref<HTMLSpanElement>}
        className={className}
        fraction={ctx.drawnValue - (value - 1)}
        size={ctx.size}
        color={ctx.color}
        glyphs={glyphs}
      />
    );
  }

  if (ctx.step === 0.5) {
    // A half star (D22): one pointer target (a span with the padding of a whole star) holding two
    // transparent radios over its halves, the half value first. The pointer chooses by its
    // position over the star; the keyboard and screen readers use the radios. The span composes
    // the consumer's click and pointer-move handlers with its own.
    const { onClick, onPointerMove, ...starProps } = rest;
    const half = value - 0.5;
    const drawn = ctx.drawnValue;
    const fraction = drawn >= value ? 1 : drawn >= half ? 0.5 : 0;
    // The value under the pointer: the half from the inline start (mirrored under RTL), else the
    // full value.
    const pick = (event: React.MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const fromStart =
        getDirection(event.currentTarget) === 'rtl'
          ? rect.right - event.clientX
          : event.clientX - rect.left;
      return fromStart < rect.width / 2 ? half : value;
    };
    return (
      <span
        {...starProps}
        ref={ref as React.Ref<HTMLSpanElement>}
        data-rating-star=""
        className={cn(
          'relative inline-flex cursor-pointer rounded',
          targetPaddingMap[ctx.size],
          'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
          ctx.disabled && 'cursor-not-allowed',
          className,
        )}
        onClick={composeEventHandlers(onClick, (event) => {
          // A click on a radio (Space, Enter, a screen reader, `click()`) chose its own value, and
          // a click without a press (`detail` 0) or from a portal inside the star is not the
          // pointer's to place.
          if (ctx.disabled || event.detail === 0 || !isOwnEvent(event)) return;
          if ((event.target as Element).closest('[role="radio"]')) return;
          ctx.choose(pick(event), true);
        })}
        onPointerMove={composeEventHandlers(onPointerMove, (event) => {
          if (!ctx.disabled && event.pointerType === 'mouse' && isOwnEvent(event)) {
            ctx.preview(pick(event));
          }
        })}
      >
        <StarGlyph fraction={fraction} size={ctx.size} color={ctx.color} glyphs={glyphs} />
        {[half, value].map((radioValue, index) => {
          const radioKey = String(radioValue);
          return (
            <button
              key={radioKey}
              type="button"
              role="radio"
              aria-checked={ctx.value === radioValue}
              aria-label={ctx.starLabel(radioValue, ctx.max)}
              data-roving-value={radioKey}
              tabIndex={ctx.disabled ? -1 : ctx.getTabIndex(radioKey)}
              disabled={ctx.disabled}
              className={cn(
                'pointer-events-none absolute inset-y-0 w-1/2 border-0 bg-transparent p-0 opacity-0',
                index === 0 ? 'start-0' : 'end-0',
              )}
              onClick={() => {
                // Choosing the current value again is a no-op for both callbacks (useControllable).
                if (!ctx.disabled) ctx.choose(radioValue, false);
              }}
            />
          );
        })}
      </span>
    );
  }

  // The radio composes the consumer's click and mouse-enter handlers with its own. It is the
  // star's box itself (the button carries the color), so it draws only the glyph.
  const { onClick, onMouseEnter, ...radioProps } = rest;
  const key = String(value);
  const filled = ctx.drawnValue >= value;
  const look = starLook(filled, ctx.color, glyphs);
  return (
    <button
      type="button"
      {...radioProps}
      ref={ref as React.Ref<HTMLButtonElement>}
      role="radio"
      aria-checked={ctx.value === value}
      aria-label={ctx.starLabel(value, ctx.max)}
      data-roving-value={key}
      tabIndex={ctx.disabled ? -1 : ctx.getTabIndex(key)}
      disabled={ctx.disabled}
      className={cn(
        'inline-flex cursor-pointer rounded border-0 bg-transparent transition-colors motion-reduce:transition-none disabled:cursor-not-allowed',
        targetPaddingMap[ctx.size],
        focusRing,
        look.colorClass,
        className,
      )}
      onClick={composeEventHandlers(onClick, () => {
        // Choosing the current star again is a no-op for both callbacks (useControllable).
        if (!ctx.disabled) ctx.choose(value, false);
      })}
      onMouseEnter={composeEventHandlers(onMouseEnter, () => {
        if (!ctx.disabled) ctx.preview(value);
      })}
    >
      <GlyphLayer filled={filled} glyph={look.glyph} className={sizeMap[ctx.size]} />
    </button>
  );
};
RatingItem.displayName = 'RatingItem';

/**
 * A root's stars: its `children` when they render content, else one generated item per value
 * from 1 to `max`.
 */
export function ratingItems(children: React.ReactNode, max: number): React.ReactNode {
  const items = materialiseSlotContent(children);
  return slotRendersContent(items)
    ? items
    : Array.from({ length: max }, (_, i) => <RatingItem key={i + 1} value={i + 1} />);
}
