import * as React from 'react';
import { cn } from '../../lib/cn';

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
} as const;

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;

const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
} as const;

/** Properties for the Stack component. */
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
  /** Layout direction of the stack.
   * @default 'vertical'
   */
  direction?: 'vertical' | 'horizontal';
  /** Gap size between stack items.
   * @default 'md'
   */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Cross-axis alignment of items. */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Main-axis justification of items. */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Whether items should wrap to the next line. */
  wrap?: boolean;
  /** Whether to use inline-flex instead of flex. */
  inline?: boolean;
}

const StackRoot = (
    {
      as: Component = 'div',
      direction = 'vertical',
      gap = 'md',
      align,
      justify,
      wrap,
      inline,
      className,
      children, ref, ...props }: StackProps & { ref?: React.Ref<HTMLElement> }) => {
    return (
      <Component
        ref={ref}
        className={cn(
          inline ? 'inline-flex' : 'flex',
          direction === 'horizontal' ? 'flex-row' : 'flex-col',
          gapMap[gap],
          align && alignMap[align],
          justify && justifyMap[justify],
          wrap && 'flex-wrap',
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  };
StackRoot.displayName = 'Stack';

export const Stack = StackRoot;
