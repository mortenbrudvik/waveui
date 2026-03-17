import * as React from 'react';
import { cn } from '../../lib/cn';

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

/** Properties for the Grid component. */
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
  /** Number of grid columns. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  /** Number of grid rows. */
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

const GridRoot = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      as: Component = 'div',
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
      ...props
    },
    ref,
  ) => {
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
        {...props}
      >
        {children}
      </Component>
    );
  },
);
GridRoot.displayName = 'Grid';

export const Grid = GridRoot;
