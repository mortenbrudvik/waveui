import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';

const columnsMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
} as const;

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
} as const;

const columnGapMap = {
  none: 'gap-x-0',
  xs: 'gap-x-1',
  sm: 'gap-x-2',
  md: 'gap-x-3',
  lg: 'gap-x-4',
  xl: 'gap-x-6',
} as const;

const rowGapMap = {
  none: 'gap-y-0',
  xs: 'gap-y-1',
  sm: 'gap-y-2',
  md: 'gap-y-3',
  lg: 'gap-y-4',
  xl: 'gap-y-6',
} as const;

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;

const justifyMap = {
  start: 'justify-items-start',
  center: 'justify-items-center',
  end: 'justify-items-end',
  stretch: 'justify-items-stretch',
} as const;

/**
 * The Grid's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`).
 */
export interface GridOwnProps {
  /** Number of grid columns. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  /** Number of equal-height grid rows (`grid-template-rows`, merged with `style`). */
  rows?: number;
  /** Uniform gap size between grid items. */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Horizontal gap size between grid columns. */
  columnGap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Vertical gap size between grid rows. */
  rowGap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Vertical alignment of items within the grid. */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Horizontal alignment of items within the grid. */
  justify?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * Props of {@link Grid} rendered as `C` (default `'div'`). `GridProps` without a type argument is
 * the 0.4 name: the props of a Grid rendered as a `<div>`, including `ref`.
 */
export type GridProps<C extends React.ElementType = 'div'> = PolymorphicProps<C, GridOwnProps>;

type GridImplProps = GridOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * A CSS grid layout with a fixed column count and token gaps.
 *
 * @example
 * <Grid columns={3} gap="md">
 *   <Card>…</Card>
 *   <Card>…</Card>
 *   <Card>…</Card>
 * </Grid>
 */
export const Grid: PolymorphicComponent<'div', GridOwnProps> = (props) => {
  const {
    as,
    columns,
    rows,
    gap,
    columnGap,
    rowGap,
    align,
    justify,
    className,
    style,
    children,
    ref,
    ...rest
  } = props as GridImplProps;
  const Component: React.ElementType = as ?? 'div';
  const rowStyle = rows ? { gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` } : undefined;

  return (
    <Component
      ref={ref}
      className={cn(
        'grid',
        columns && columnsMap[columns],
        gap && gapMap[gap],
        columnGap && columnGapMap[columnGap],
        rowGap && rowGapMap[rowGap],
        align && alignMap[align],
        justify && justifyMap[justify],
        className,
      )}
      style={{ ...rowStyle, ...style }}
      {...rest}
    >
      {children}
    </Component>
  );
};
Grid.displayName = 'Grid';
