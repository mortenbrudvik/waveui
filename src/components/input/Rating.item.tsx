import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext } from '../../lib/dev';
import { StarIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent, type Slot } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Size } from '../../lib/types';

/** Color of a rating's filled stars. */
export type RatingColor = 'neutral' | 'brand' | 'marigold';

/** Filled-star color of each `color` (unfilled stars keep the 3:1 outline token). */
export const FILLED_COLOR: Readonly<Record<RatingColor, string>> = {
  marigold: 'text-rating',
  brand: 'text-primary',
  neutral: 'text-foreground',
};

/** Icon size of each star size. */
export const sizeMap: Record<Size, string> = {
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

/** A filled star, or an outlined one (the outline keeps a 3:1 non-text contrast). */
export function Star({ filled, className }: { filled: boolean; className: string }) {
  return filled ? (
    <StarIcon className={className} />
  ) : (
    <StarIcon className={className} fill="none" stroke="currentColor" strokeWidth={1.5} />
  );
}
Star.displayName = 'Star';

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
  /** The color of the filled stars. */
  color: RatingColor;
  /** The glyph of a filled star, for every item (an item's own glyph wins). */
  iconFilled?: Slot<'span'>;
  /** The glyph of an unfilled star, for every item (an item's own glyph wins). */
  iconOutline?: Slot<'span'>;
  /** The stars cannot be chosen or previewed (a disabled Rating, and every RatingDisplay). */
  disabled: boolean;
  /** The accessible name of the star that chooses `value` (the root's `labels.star`). */
  starLabel: (value: number, max: number) => string;
  /** The roving `tabIndex` of the star whose `data-roving-value` is `key`. */
  getTabIndex: (key: string) => number;
  /** Chooses `value`; with `focus`, the radio of `value` also takes focus. */
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
  /** The star's full value, from 1 to the root's `max`: the rating it chooses, or shows. */
  value: number;
  /**
   * Ref to the star element: the `role="radio"` button in a Rating, the star `<span>` in a
   * RatingDisplay.
   */
  ref?: React.Ref<HTMLElement>;
}

/**
 * One star of a `Rating` or a `RatingDisplay`, drawn from its root: pass one per value from 1 to
 * `max` as the root's children, in place of the stars it generates.
 *
 * - In a `Rating` it is a `role="radio"` button named by the root's `labels.star` ("2 stars"),
 *   chosen, previewed and roved as a generated star is; in a `RatingDisplay` it is a star filled,
 *   partly filled or empty by the root's value.
 * - `className`, `style`, `data-*`, the other attributes, the handlers and `ref` go to that star
 *   element, the consumer's handlers first. Its role, name, checked state and tab stop come from
 *   the root.
 * - Outside a `Rating` or `RatingDisplay` it throws in development.
 */
export const RatingItem = ({ value, className, ref, ...rest }: RatingItemProps) => {
  const ctx = useRatingContext();
  const { registerItem } = ctx;
  React.useLayoutEffect(() => registerItem(value), [registerItem, value]);
  const starSize = sizeMap[ctx.size];
  const filledColor = FILLED_COLOR[ctx.color];

  // `rest` keeps every consumer handler: a star without handlers of its own (a display star)
  // spreads them all, and a star that composes one takes that one out of `rest` itself.
  if (ctx.kind === 'display') {
    // The share of this star that the drawn value covers, in whole percent.
    const percent = Math.round(Math.min(1, Math.max(0, ctx.drawnValue - (value - 1))) * 100);
    if (percent > 0 && percent < 100) {
      // The outline of an empty star, with the filled star clipped to the fraction over it from
      // the inline start (the reading direction of the stars, also under RTL).
      return (
        <span
          {...rest}
          ref={ref as React.Ref<HTMLSpanElement>}
          className={cn('relative inline-flex text-stroke-accessible', className)}
        >
          <Star filled={false} className={starSize} />
          <span
            className={cn('absolute inset-y-0 start-0 flex overflow-hidden', filledColor)}
            style={{ width: `${percent}%` }}
          >
            <Star filled className={cn(starSize, 'shrink-0')} />
          </span>
        </span>
      );
    }
    const filled = percent === 100;
    return (
      <span
        {...rest}
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn('inline-flex', filled ? filledColor : 'text-stroke-accessible', className)}
      >
        <Star filled={filled} className={starSize} />
      </span>
    );
  }

  // The radio composes the consumer's click and mouse-enter handlers with its own.
  const { onClick, onMouseEnter, ...radioProps } = rest;
  const key = String(value);
  const filled = ctx.drawnValue >= value;
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
        filled ? filledColor : 'text-stroke-accessible',
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
      <Star filled={filled} className={starSize} />
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
