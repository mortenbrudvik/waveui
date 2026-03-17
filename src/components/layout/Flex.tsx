import * as React from 'react';
import { cn } from '../../lib/cn';

const directionMap = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  column: 'flex-col',
  'column-reverse': 'flex-col-reverse',
} as const;

const wrapMap = {
  nowrap: 'flex-nowrap',
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
} as const;

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
} as const;

const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
} as const;

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
} as const;

/** Properties for the Flex component. */
export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
  /** Flex direction.
   * @default 'row'
   */
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  /** Flex wrap behavior. */
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  /** Cross-axis alignment of items. */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** Main-axis justification of items. */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Gap size between flex items. */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to use inline-flex instead of flex. */
  inline?: boolean;
  /** Whether the flex container should grow to fill available space. */
  grow?: boolean;
  /** Whether the flex container should shrink if necessary. */
  shrink?: boolean;
}

const FlexRoot = (
    {
      as: Component = 'div',
      direction = 'row',
      wrap,
      align,
      justify,
      gap,
      inline,
      grow,
      shrink,
      className,
      children, ref, ...props }: FlexProps & { ref?: React.Ref<HTMLElement> }) => {
    return (
      <Component
        ref={ref}
        className={cn(
          inline ? 'inline-flex' : 'flex',
          directionMap[direction],
          wrap && wrapMap[wrap],
          align && alignMap[align],
          justify && justifyMap[justify],
          gap && gapMap[gap],
          grow && 'grow',
          shrink && 'shrink',
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  };
FlexRoot.displayName = 'Flex';

export const Flex = FlexRoot;
