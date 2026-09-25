import * as React from 'react';
import { cn } from '../../lib/cn';
import { resolveDeprecatedProp } from '../../lib/dev';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Orientation } from '../../lib/types';

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

/**
 * The Stack's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`).
 */
export interface StackOwnProps {
  /**
   * Layout axis of the stack.
   * @default 'vertical'
   */
  orientation?: Orientation;
  /**
   * @deprecated Use `orientation` (same values). Still works, warns once in development, and
   * `orientation` wins when both are given.
   */
  direction?: Orientation;
  /**
   * Gap size between stack items.
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

/**
 * Props of {@link Stack} rendered as `C` (default `'div'`). `StackProps` without a type argument
 * is the 0.4 name: the props of a Stack rendered as a `<div>`, including `ref`.
 */
export type StackProps<C extends React.ElementType = 'div'> = PolymorphicProps<C, StackOwnProps>;

type StackImplProps = StackOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * A one-dimensional layout: items stacked vertically (default) or horizontally with a token gap.
 *
 * @example
 * <Stack orientation="horizontal" gap="sm" align="center">
 *   <Avatar name="Ada" />
 *   <Text>Ada Lovelace</Text>
 * </Stack>
 */
export const Stack: PolymorphicComponent<'div', StackOwnProps> = (props) => {
  const {
    as,
    orientation: orientationProp,
    direction,
    gap = 'md',
    align,
    justify,
    wrap,
    inline,
    className,
    children,
    ref,
    ...rest
  } = props as StackImplProps;
  const Component: React.ElementType = as ?? 'div';
  const orientation =
    resolveDeprecatedProp('Stack', orientationProp, direction, 'direction', 'orientation') ??
    'vertical';

  return (
    <Component
      ref={ref}
      className={cn(
        inline ? 'inline-flex' : 'flex',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        gapMap[gap],
        align && alignMap[align],
        justify && justifyMap[justify],
        wrap && 'flex-wrap',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
};
Stack.displayName = 'Stack';
