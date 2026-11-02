import * as React from 'react';
import { stackClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { Orientation } from '../../lib/types';

const gapMap = {
  none: 'wave:gap-0',
  xs: 'wave:gap-1',
  sm: 'wave:gap-2',
  md: 'wave:gap-3',
  lg: 'wave:gap-4',
  xl: 'wave:gap-6',
} as const;

const alignMap = {
  start: 'wave:items-start',
  center: 'wave:items-center',
  end: 'wave:items-end',
  stretch: 'wave:items-stretch',
} as const;

const justifyMap = {
  start: 'wave:justify-start',
  center: 'wave:justify-center',
  end: 'wave:justify-end',
  between: 'wave:justify-between',
  around: 'wave:justify-around',
  evenly: 'wave:justify-evenly',
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
  const orientation = orientationProp ?? 'vertical';

  return (
    <Component
      ref={ref}
      className={wcn(
        stackClassNames.root,
        inline ? 'wave:inline-flex' : 'wave:flex',
        orientation === 'horizontal' ? 'wave:flex-row' : 'wave:flex-col',
        gapMap[gap],
        align && alignMap[align],
        justify && justifyMap[justify],
        wrap && 'wave:flex-wrap',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
};
Stack.displayName = 'Stack';
