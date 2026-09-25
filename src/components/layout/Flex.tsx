import * as React from 'react';
import { cn } from '../../lib/cn';
import { hasWarned, isDev, warnOnce } from '../../lib/dev';
import { getTabbableElements } from '../../lib/focus';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import { useMergedRefs } from '../../hooks/useMergedRefs';

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

/** Warn-once key of the "reversed order with focusable content" diagnostic. */
const REVERSE_WARNING = 'Flex:reverse-focus-order';

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
} as const;

/**
 * The Flex's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`).
 */
export interface FlexOwnProps {
  /**
   * Flex direction.
   *
   * **Accessibility:** `row-reverse` and `column-reverse` reverse the *visual* order only. Tab order
   * and screen-reader reading order still follow the DOM, so they run opposite to what sighted
   * users see (WCAG 1.3.2, 2.4.3). For focusable or meaningful content, reorder the DOM instead; a
   * development warning fires when a reversed Flex contains focusable elements.
   * @default 'row'
   */
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  /**
   * Flex wrap behavior. `wrap-reverse` reverses the visual line order only (see `direction`).
   */
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  /** Cross-axis alignment of items. */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** Main-axis justification of items. */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Gap size between flex items. */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to use inline-flex instead of flex. */
  inline?: boolean;
  /** Whether the flex container should grow to fill available space in its own flex parent. */
  grow?: boolean;
  /**
   * How the container shrinks in its own flex parent: `false` prevents shrinking (`shrink-0`),
   * `true` sets `shrink` explicitly (the CSS default, useful to undo an inherited `shrink-0`).
   * Unset emits no class.
   */
  shrink?: boolean;
}

/**
 * Props of {@link Flex} rendered as `C` (default `'div'`). `FlexProps` without a type argument is
 * the 0.4 name: the props of a Flex rendered as a `<div>`, including `ref`.
 */
export type FlexProps<C extends React.ElementType = 'div'> = PolymorphicProps<C, FlexOwnProps>;

type FlexImplProps = FlexOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * A flexbox layout container with token-based gaps.
 *
 * Reversed directions (`row-reverse`, `column-reverse`, `wrap="wrap-reverse"`) change the visual
 * order only: keep them for decorative or static content and reorder the DOM for anything
 * focusable (a development warning fires otherwise).
 *
 * @example
 * <Flex gap="md" align="center" justify="between">
 *   <Text>Title</Text>
 *   <Button>Action</Button>
 * </Flex>
 */
export const Flex: PolymorphicComponent<'div', FlexOwnProps> = (props) => {
  const {
    as,
    direction = 'row',
    wrap,
    align,
    justify,
    gap,
    inline,
    grow,
    shrink,
    className,
    children,
    ref,
    ...rest
  } = props as FlexImplProps;
  const Component: React.ElementType = as ?? 'div';
  const reversed =
    direction === 'row-reverse' || direction === 'column-reverse' || wrap === 'wrap-reverse';

  const rootRef = React.useRef<HTMLElement | null>(null);
  const mergedRef = useMergedRefs<HTMLElement>(ref, rootRef);

  // Development diagnostic (C-DEV): children change without prop changes, so check every commit
  // until the warning has fired once; after that the DOM scan is skipped.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!isDev || !reversed || !root || hasWarned(REVERSE_WARNING)) return;
    if (getTabbableElements(root).length > 0) {
      warnOnce(
        REVERSE_WARNING,
        'Flex: a reversed direction or wrap (`row-reverse`, `column-reverse`, `wrap-reverse`) changes the visual order only, so keyboard and screen-reader order run opposite to what users see. Reorder the DOM for focusable content instead.',
      );
    }
  });

  return (
    <Component
      ref={mergedRef}
      className={cn(
        inline ? 'inline-flex' : 'flex',
        directionMap[direction],
        wrap && wrapMap[wrap],
        align && alignMap[align],
        justify && justifyMap[justify],
        gap && gapMap[gap],
        grow && 'grow',
        shrink === true && 'shrink',
        shrink === false && 'shrink-0',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
};
Flex.displayName = 'Flex';
