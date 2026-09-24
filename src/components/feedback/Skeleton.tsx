import * as React from 'react';
import { cn } from '../../lib/cn';
import { resolveDeprecatedProp } from '../../lib/dev';
import type { Shape } from '../../lib/types';

/** The 0.4 `variant` values (deprecated) and the shape each one renders. */
type SkeletonVariant = 'text' | 'circular' | 'rectangular';

/** `rectangular` rendered with the default 4px radius in 0.4, so it maps to `rounded`. */
const variantShapes: Record<SkeletonVariant, Shape> = {
  text: 'rounded',
  circular: 'circular',
  rectangular: 'rounded',
};

const shapeClasses: Record<Shape, string> = {
  rounded: 'rounded',
  circular: 'rounded-full',
  square: 'rounded-none',
};

/** Properties for the Skeleton component. */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton placeholder. */
  width?: string | number;
  /** Height of the skeleton placeholder. */
  height?: string | number;
  /**
   * Geometry of the placeholder: `rounded` (4px radius), `circular` (avatars) or `square`.
   * @default 'rounded'
   */
  shape?: Shape;
  /**
   * @deprecated Use `shape`: `text` and `rectangular` → `rounded` (their 0.4 look), `circular` →
   * `circular`. Still works, warns once in development, and `shape` wins when both are given.
   */
  variant?: SkeletonVariant;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A decorative loading placeholder. Each Skeleton is `aria-hidden` (a consumer `aria-hidden`
 * overrides it); wrap the placeholders of a loading region in {@link SkeletonGroup}
 * (`Skeleton.Group`), which marks it busy and gives it a visually hidden "Loading" label.
 * The pulse animation stops for reduced motion.
 *
 * @example
 * <Skeleton.Group label="Loading profile">
 *   <Skeleton shape="circular" width={32} height={32} />
 *   <Skeleton width={160} height={12} />
 * </Skeleton.Group>
 */
const SkeletonRoot = ({
  width,
  height,
  shape: shapeProp,
  variant,
  className,
  style,
  ref,
  ...rest
}: SkeletonProps) => {
  const shape =
    resolveDeprecatedProp(
      'Skeleton',
      shapeProp,
      variant === undefined ? undefined : variantShapes[variant],
      'variant',
      'shape',
    ) ?? 'rounded';

  return (
    <div
      aria-hidden="true"
      {...rest}
      ref={ref}
      className={cn(
        'bg-skeleton animate-wave-pulse motion-reduce:animate-none',
        shapeClasses[shape],
        className,
      )}
      style={{ width, height, ...style }}
    />
  );
};
SkeletonRoot.displayName = 'Skeleton';

/** Properties for the Skeleton.Group component. */
export interface SkeletonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visually hidden text announced in place of the decorative placeholders. Localize it.
   * @default 'Loading'
   */
  label?: string;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Container for the Skeletons of a loading region: `aria-busy="true"` plus a visually hidden
 * `label` ("Loading"), while the placeholders stay decorative. It uses no live-region role, so it
 * does not interrupt; announce completion separately if needed. Remove it (or pass
 * `aria-busy={false}`) when the content arrives. Flat export for React Server Components
 * (`Skeleton.Group` in client files).
 */
export const SkeletonGroup = ({
  label = 'Loading',
  children,
  ref,
  ...rest
}: SkeletonGroupProps) => (
  <div aria-busy="true" {...rest} ref={ref}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);
SkeletonGroup.displayName = 'SkeletonGroup';

/**
 * Skeleton with the `Skeleton.Group` sub-component. In React Server Components use the flat
 * export `SkeletonGroup` instead of `Skeleton.Group`.
 */
export const Skeleton = /* @__PURE__ */ Object.assign(SkeletonRoot, { Group: SkeletonGroup });
