import * as React from 'react';
import { wcn } from '../../lib/cn';
import { dividerClassNames } from '../../lib/classNames';
import { joinIds } from '../../lib/aria';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { useId } from '../../hooks/useId';
import type { Orientation } from '../../lib/types';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import { useAppClassName } from '../../hooks/useAppClassName';

/**
 * The Divider's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props
 * only). Every other prop comes from the rendered element (`as`).
 */
export interface DividerOwnProps {
  /** Orientation of the divider line.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /**
   * How the line looks: `'default'` is the border color, `'subtle'` a fainter line (the border
   * color at half strength), `'strong'` a firmer one and `'brand'` the brand color. Rendered as
   * `data-appearance`. Fluent's `appearance`.
   * @default 'default'
   */
  appearance?: DividerAppearance;
  /**
   * Insets the divider from the edges of its container by 12px along its length, so the line
   * stops short of both ends. Rendered as a boolean `data-inset`. Fluent's `inset`.
   * @default false
   */
  inset?: boolean;
  /**
   * Where the label sits along a divider that has one: `'center'` between two lines of equal
   * length, `'start'` or `'end'` with a short line (8px) on that side and the long line on the
   * other. `'start'` and `'end'` follow the writing direction. Rendered as `data-align-content`
   * on a labelled divider; a divider without a label ignores it. Fluent's `alignContent`.
   * @default 'center'
   */
  alignContent?: 'start' | 'center' | 'end';
  /**
   * Ref to the rendered element. Typed `HTMLElement` for every `as`, because the default element
   * depends on the props: an `<hr>` for a plain horizontal divider, a `<div>` otherwise.
   */
  ref?: React.Ref<HTMLElement>;
  /**
   * Props for the elements a labelled divider draws, by part, merged into each part's own: your
   * classes after the part's (yours win a conflict), your styles over its styles, your attributes
   * and handlers added, your ref attached. Every attribute the divider sets on a part is locked. A
   * part takes no `children` (the label's content is the divider's `children`). A divider without
   * a label draws no part and ignores them.
   */
  slotProps?: {
    /**
     * The two line segments around the label, `<div>`s (stable class `wave-divider__line`): the
     * same props reach both, so a ref object ends up with the second. Locked: `aria-hidden` (the
     * divider itself is the separator) and, unset, `role` and `tabIndex`.
     */
    line?: SlotPart<'div'>;
    /**
     * The label, a `<span>` around the divider's `children` (stable class `wave-divider__label`).
     * Locked: its `id`, which the separator's `aria-labelledby` names, and, unset, `role`,
     * `aria-label` (it would replace the label in the separator's name) and `hidden`, `inert` and
     * `aria-hidden`.
     */
    label?: SlotPart<'span'>;
  };
}

/** The looks of a divider line, as Fluent's `appearance` names them. */
export type DividerAppearance = 'default' | 'subtle' | 'brand' | 'strong';

/** The border color of each appearance: Fluent's neutral stroke 2, a fainter one, brand and stroke 1. */
const appearanceBorderClasses: Record<DividerAppearance, string> = {
  default: 'wave:border-border',
  subtle: 'wave:border-border/50',
  brand: 'wave:border-primary',
  strong: 'wave:border-stroke',
};

/** What a line segment locks: decorative, never a tab stop. */
const LINE_PART_LOCKS = { role: undefined, tabIndex: undefined, 'aria-hidden': true } as const;

/** What the label locks unset besides its id: a role, a name of its own and its hidden state. */
const LABEL_PART_LOCKS = {
  role: undefined,
  'aria-label': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/**
 * Props of {@link Divider} rendered as `C` (default `'hr'`). `DividerProps` without a type argument
 * is the 0.4 name.
 */
export type DividerProps<C extends React.ElementType = 'hr'> = PolymorphicProps<C, DividerOwnProps>;

/** The props the implementation reads, for any `as` (the public typing is `PolymorphicComponent`). */
type DividerImplProps = DividerOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
  };

const labelClassName = 'wave:shrink-0 wave:text-caption-1 wave:text-muted-foreground';

/**
 * A line that separates content, horizontally or vertically, optionally with a label in the middle.
 *
 * - A plain horizontal divider renders an `<hr>`; a vertical or labelled divider renders a
 *   `<div role="separator">` (`as` replaces the element in every case). `children` that render
 *   nothing (`''`, or an array, `Set` or generator of only empty items, such as an empty `.map()`
 *   result) are no label; `0` is one.
 * - A labelled divider is **one** separator named by its label (`aria-labelledby`); the two line
 *   segments around the label are presentational (`aria-hidden`). A consumer `aria-label` names it
 *   instead, and a consumer `aria-labelledby` is joined with the label.
 * - Vertical dividers set `aria-orientation="vertical"` and use logical borders (RTL-safe).
 *
 * @example
 * <Divider />
 * <Divider>OR</Divider>
 * <Divider orientation="vertical" />
 */
export const Divider: PolymorphicComponent<'hr', DividerOwnProps> = (props) => {
  const appClassName = useAppClassName(dividerClassNames.root);

  const {
    as,
    orientation = 'horizontal',
    appearance: appearanceProp = 'default',
    inset,
    alignContent: alignContentProp = 'center',
    className,
    children,
    ref,
    slotProps,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  } = props as DividerImplProps;
  const labelId = useId('divider-label');
  const vertical = orientation === 'vertical';
  // A value outside the unions (untyped code) draws the defaults.
  const appearance: DividerAppearance = Object.hasOwn(appearanceBorderClasses, appearanceProp)
    ? appearanceProp
    : 'default';
  const alignContent =
    alignContentProp === 'start' || alignContentProp === 'end' ? alignContentProp : 'center';
  const borderClass = appearanceBorderClasses[appearance];

  // The library's "renders nothing" rule: `0` is a label, while `''` or an array, Set or generator
  // of only empty items (an empty `.map()` result) is none.
  if (slotRendersContent(children)) {
    const Wrapper: React.ElementType = as ?? 'div';
    // A consumer aria-label names the separator; aria-labelledby would take precedence over it.
    const labelledBy = rest['aria-label'] ? ariaLabelledBy : joinIds(ariaLabelledBy, labelId);
    // The short side of an aligned label is 8px; the other line takes the rest.
    const lineClassName = (short: boolean) =>
      wcn(
        dividerClassNames.line,
        vertical
          ? 'wave:w-0 wave:min-h-2 wave:flex-1 wave:border-s'
          : 'wave:h-0 wave:min-w-2 wave:flex-1 wave:border-t',
        borderClass,
        short && (vertical ? 'wave:max-h-2' : 'wave:max-w-2'),
      );
    // The part's props go to both lines: its class and its locks are the same for each.
    const lineElement = (short: boolean) => (
      <div
        aria-hidden="true"
        className={lineClassName(short)}
        {...(slotProps?.line &&
          mergeSlotProps(slotProps.line, {
            className: lineClassName(short),
            locked: LINE_PART_LOCKS,
          }))}
      />
    );
    const labelClasses = wcn(dividerClassNames.label, labelClassName);
    // The label's props are the slot's defaults, its class the slot's base: a part's merged in,
    // after the id (which keeps its place in the markup).
    const labelProps = slotProps?.label
      ? {
          id: labelId,
          ...mergeSlotProps(slotProps.label, {
            className: labelClasses,
            locked: { ...LABEL_PART_LOCKS, id: labelId },
          }),
        }
      : { id: labelId, className: labelClasses };
    return (
      <Wrapper
        ref={ref}
        role="separator"
        aria-orientation={vertical ? 'vertical' : undefined}
        className={wcn(
          dividerClassNames.root,
          vertical
            ? 'wave:inline-flex wave:min-h-12 wave:flex-col wave:items-center wave:gap-1 wave:self-stretch'
            : 'wave:flex wave:items-center wave:gap-3',
          inset && (vertical ? 'wave:py-3' : 'wave:px-3'),
          appClassName,
          className,
        )}
        data-appearance={appearance}
        data-inset={inset ? '' : undefined}
        data-align-content={alignContent}
        {...rest}
        aria-labelledby={labelledBy}
      >
        {lineElement(alignContent === 'start')}
        {/* Rendered as a slot: a generator checked above was read once, and renderSlot renders
            the items read then. */}
        {renderSlot(children, 'span', labelProps.className as string, labelProps)}
        {lineElement(alignContent === 'end')}
      </Wrapper>
    );
  }

  if (vertical) {
    const Line: React.ElementType = as ?? 'div';
    return (
      <Line
        ref={ref}
        role="separator"
        aria-orientation="vertical"
        aria-labelledby={ariaLabelledBy}
        className={wcn(
          dividerClassNames.root,
          'wave:inline-block wave:h-6 wave:border-s',
          borderClass,
          inset && 'wave:my-3',
          appClassName,
          className,
        )}
        data-appearance={appearance}
        data-inset={inset ? '' : undefined}
        {...rest}
      />
    );
  }

  const Rule: React.ElementType = as ?? 'hr';
  return (
    <Rule
      ref={ref}
      role="separator"
      aria-labelledby={ariaLabelledBy}
      className={wcn(
        dividerClassNames.root,
        'wave:m-0 wave:h-0 wave:w-full wave:border-0 wave:border-t wave:border-solid',
        borderClass,
        // The rule is as wide as its container minus the two insets.
        inset && 'wave:mx-3 wave:w-[calc(100%-1.5rem)]',
        appClassName,
        className,
      )}
      data-appearance={appearance}
      data-inset={inset ? '' : undefined}
      {...rest}
    />
  );
};

Divider.displayName = 'Divider';
