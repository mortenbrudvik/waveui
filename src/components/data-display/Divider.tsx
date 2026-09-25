import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { useId } from '../../hooks/useId';
import type { Orientation } from '../../lib/types';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';

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
   * Ref to the rendered element. Typed `HTMLElement` for every `as`, because the default element
   * depends on the props: an `<hr>` for a plain horizontal divider, a `<div>` otherwise.
   */
  ref?: React.Ref<HTMLElement>;
}

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

const labelClassName = 'shrink-0 text-caption-1 text-muted-foreground';

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
  const {
    as,
    orientation = 'horizontal',
    className,
    children,
    ref,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  } = props as DividerImplProps;
  const labelId = useId('divider-label');
  const vertical = orientation === 'vertical';

  // The library's "renders nothing" rule: `0` is a label, while `''` or an array, Set or generator
  // of only empty items (an empty `.map()` result) is none.
  if (slotRendersContent(children)) {
    const Wrapper: React.ElementType = as ?? 'div';
    // A consumer aria-label names the separator; aria-labelledby would take precedence over it.
    const labelledBy = rest['aria-label'] ? ariaLabelledBy : joinIds(ariaLabelledBy, labelId);
    const lineClassName = vertical
      ? 'w-0 min-h-2 flex-1 border-s border-border'
      : 'h-0 min-w-2 flex-1 border-t border-border';
    return (
      <Wrapper
        ref={ref}
        role="separator"
        aria-orientation={vertical ? 'vertical' : undefined}
        className={cn(
          vertical
            ? 'inline-flex min-h-12 flex-col items-center gap-1 self-stretch'
            : 'flex items-center gap-3',
          className,
        )}
        {...rest}
        aria-labelledby={labelledBy}
      >
        <div aria-hidden="true" className={lineClassName} />
        {/* Rendered as a slot: a generator checked above was read once, and renderSlot renders
            the items read then. */}
        {renderSlot(children, 'span', labelClassName, { id: labelId })}
        <div aria-hidden="true" className={lineClassName} />
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
        className={cn('inline-block h-6 border-s border-border', className)}
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
      className={cn('m-0 h-0 w-full border-0 border-t border-solid border-border', className)}
      {...rest}
    />
  );
};

Divider.displayName = 'Divider';
