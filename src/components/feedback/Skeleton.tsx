import * as React from 'react';
import { skeletonClassNames, skeletonGroupClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import type { Shape } from '../../lib/types';

/**
 * Forced colors replace the author fill with the page color, so the placeholder would vanish: it
 * is painted `GrayText` instead (a leaf element, so opting out of forced colors reaches nothing
 * else).
 */
const forcedColorsFill =
  'wave:forced-colors:bg-[GrayText] wave:forced-colors:forced-color-adjust-none';

const shapeClasses: Record<Shape, string> = {
  rounded: 'wave:rounded',
  circular: 'wave:rounded-full',
  square: 'wave:rounded-none',
};

/**
 * The sizes of a {@link Skeleton} in pixels (Fluent's `SkeletonItem` sizes): the height of a
 * `rounded` placeholder, the width and height of a `circular` or `square` one.
 */
export type SkeletonSize =
  8 | 12 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 72 | 96 | 120 | 128;

/** The animation of a {@link Skeleton}: a `pulse` of its opacity, or a `wave`, a shimmer that sweeps across it. */
export type SkeletonAnimation = 'pulse' | 'wave';

/** The fill of a {@link Skeleton}: `opaque` (the skeleton color) or `translucent`, for a placeholder over an image. */
export type SkeletonAppearance = 'opaque' | 'translucent';

/** The height of a `rounded` placeholder per size. */
const heightClasses: Record<SkeletonSize, string> = {
  8: 'wave:h-2',
  12: 'wave:h-3',
  16: 'wave:h-4',
  20: 'wave:h-5',
  24: 'wave:h-6',
  28: 'wave:h-7',
  32: 'wave:h-8',
  36: 'wave:h-9',
  40: 'wave:h-10',
  48: 'wave:h-12',
  56: 'wave:h-14',
  64: 'wave:h-16',
  72: 'wave:h-18',
  96: 'wave:h-24',
  120: 'wave:h-30',
  128: 'wave:h-32',
};

/** The width and height of a `circular` or `square` placeholder per size. */
const boxClasses: Record<SkeletonSize, string> = {
  8: 'wave:size-2',
  12: 'wave:size-3',
  16: 'wave:size-4',
  20: 'wave:size-5',
  24: 'wave:size-6',
  28: 'wave:size-7',
  32: 'wave:size-8',
  36: 'wave:size-9',
  40: 'wave:size-10',
  48: 'wave:size-12',
  56: 'wave:size-14',
  64: 'wave:size-16',
  72: 'wave:size-18',
  96: 'wave:size-24',
  120: 'wave:size-30',
  128: 'wave:size-32',
};

/** The size a placeholder takes when nothing else gives it a height. */
const DEFAULT_SIZE: SkeletonSize = 16;

/** The fill per appearance: the skeleton token, or the page color at 60%. */
const appearanceClasses: Record<SkeletonAppearance, string> = {
  opaque: 'wave:bg-skeleton',
  translucent: 'wave:bg-background/60',
};

/**
 * The animation per kind. `pulse` fades the placeholder. `wave` sweeps a highlight over it: a
 * pseudo-element a little under half the width of the placeholder, a transparent gradient through
 * the page color, moved by the keyframes of the indeterminate ProgressBar (mirrored in
 * right-to-left). Reduced motion stops the pulse and removes the highlight; in forced colors the
 * highlight is removed so the `GrayText` fill stays plain.
 */
const animationClasses: Record<SkeletonAnimation, string> = {
  pulse: 'wave:animate-wave-pulse wave:motion-reduce:animate-none',
  wave: 'wave:relative wave:overflow-hidden wave:after:absolute wave:after:inset-y-0 wave:after:start-0 wave:after:w-2/5 wave:after:bg-linear-90 wave:after:from-transparent wave:after:via-background/60 wave:after:to-transparent wave:after:animate-wave-indeterminate wave:wave-rtl:after:animate-wave-indeterminate-rtl wave:motion-reduce:after:animate-none wave:motion-reduce:after:hidden wave:forced-colors:after:hidden',
};

/** What a `Skeleton.Group` gives the placeholders inside it; a placeholder's own prop wins. */
interface SkeletonGroupDefaults {
  size?: SkeletonSize;
  shape?: Shape;
  animation?: SkeletonAnimation;
  appearance?: SkeletonAppearance;
}

const SkeletonGroupContext = React.createContext<SkeletonGroupDefaults | null>(null);
SkeletonGroupContext.displayName = 'SkeletonGroupContext';

/** Properties for the Skeleton component. */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton placeholder. */
  width?: string | number;
  /** Height of the skeleton placeholder. */
  height?: string | number;
  /**
   * Preset size in pixels, as Fluent's `SkeletonItem`: the height of a `rounded` placeholder (its
   * width fills the line), the width and height of a `circular` or `square` one. A `width` or
   * `height` of yours sets that dimension instead. Without a size, a surrounding `Skeleton.Group`
   * gives one; without that, a placeholder that has no `height` is 16px tall (a `circular` or
   * `square` one with neither dimension is 16px square), where 0.x drew none. The root carries
   * `data-size` while a size is set.
   * @default the group's size, else 16 when it has no `height`
   */
  size?: SkeletonSize;
  /**
   * Geometry of the placeholder: `rounded` (4px radius), `circular` (avatars) or `square`. Without
   * one, a surrounding `Skeleton.Group` gives it. Fluent's `shape` (`rectangle`, `circle`, `square`).
   * @default 'rounded', or the group's shape
   */
  shape?: Shape;
  /**
   * `pulse` fades the placeholder in and out; `wave` sweeps a highlight across it (Fluent's
   * default animation, `wave`; WaveUI keeps `pulse`). Both stop for reduced motion. Without one, a
   * surrounding `Skeleton.Group` gives it.
   * @default 'pulse', or the group's animation
   */
  animation?: SkeletonAnimation;
  /**
   * `opaque` fills with the skeleton color; `translucent` fills with the page color at 60% so an
   * image or a colored surface shows through. Without one, a surrounding `Skeleton.Group` gives it.
   * @default 'opaque', or the group's appearance
   */
  appearance?: SkeletonAppearance;
  ref?: React.Ref<HTMLDivElement>;
}

// The component-level JSDoc sits on the exported `Skeleton` below (it reaches index.d.ts).
const SkeletonRoot = ({
  width,
  height,
  size: sizeProp,
  shape: shapeProp,
  animation: animationProp,
  appearance: appearanceProp,
  className,
  style,
  ref,
  ...rest
}: SkeletonProps) => {
  const group = React.useContext(SkeletonGroupContext);
  // A value outside the unions (from untyped code) renders as the default instead of throwing.
  const pick = <T extends string>(
    own: T | undefined,
    inherited: T | undefined,
    table: Record<T, string>,
    fallback: T,
  ): T => {
    const value = own ?? inherited ?? fallback;
    return Object.hasOwn(table, value) ? value : fallback;
  };
  const shape = pick(shapeProp, group?.shape, shapeClasses, 'rounded');
  const animation = pick(animationProp, group?.animation, animationClasses, 'pulse');
  const appearance = pick(appearanceProp, group?.appearance, appearanceClasses, 'opaque');
  const requestedSize = sizeProp ?? group?.size;
  const size =
    requestedSize !== undefined && Object.hasOwn(heightClasses, requestedSize)
      ? requestedSize
      : undefined;
  // The geometry a size gives, or the default when nothing else gives a height: a rounded
  // placeholder is a line, the other shapes a box. A `height` or `width` of yours is an inline
  // style, so it wins over the class.
  const boxy = shape !== 'rounded';
  const dimensionsGiven = boxy ? width !== undefined || height !== undefined : height !== undefined;
  const sizeClass =
    size !== undefined
      ? (boxy ? boxClasses : heightClasses)[size]
      : dimensionsGiven
        ? undefined
        : (boxy ? boxClasses : heightClasses)[DEFAULT_SIZE];

  return (
    <div
      aria-hidden="true"
      data-shape={shape}
      data-animation={animation}
      data-appearance={appearance}
      data-size={size}
      {...rest}
      ref={ref}
      className={wcn(
        skeletonClassNames.root,
        appearanceClasses[appearance],
        animationClasses[animation],
        forcedColorsFill,
        shapeClasses[shape],
        sizeClass,
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
  /** The `size` of every `Skeleton` in the group that has none of its own. */
  size?: SkeletonSize;
  /** The `shape` of every `Skeleton` in the group that has none of its own. */
  shape?: Shape;
  /** The `animation` of every `Skeleton` in the group that has none of its own. */
  animation?: SkeletonAnimation;
  /** The `appearance` of every `Skeleton` in the group that has none of its own. */
  appearance?: SkeletonAppearance;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Container for the Skeletons of a loading region: `aria-busy="true"` plus a visually hidden
 * `label` ("Loading"), while the placeholders stay decorative. It uses no live-region role, so it
 * does not interrupt; announce completion separately if needed. When the content arrives, remove
 * the group or pass `aria-busy={false}`, which also drops the hidden label (no stale "Loading" is
 * read before the content). A forwarded `aria-busy={undefined}` keeps the busy default. Its
 * `size`, `shape`, `animation` and `appearance` are the defaults of the Skeletons inside it (a
 * Skeleton's own prop wins), so a list of placeholders is set once. Flat
 * export for React Server Components (`Skeleton.Group` in client files).
 */
export const SkeletonGroup = ({
  label = 'Loading',
  size,
  shape,
  animation,
  appearance,
  // Destructured with a default rather than set before `{...rest}`: a wrapper that forwards
  // `aria-busy={props['aria-busy']}` passes `undefined`, which must not strip the busy state.
  'aria-busy': busy = true,
  className,
  children,
  ref,
  ...rest
}: SkeletonGroupProps) => {
  const loading = busy !== false && busy !== 'false';
  const defaults = React.useMemo<SkeletonGroupDefaults>(
    () => ({ size, shape, animation, appearance }),
    [size, shape, animation, appearance],
  );
  return (
    <div
      {...rest}
      aria-busy={busy}
      ref={ref}
      className={wcn(skeletonGroupClassNames.root, className)}
    >
      {loading && <span className="wave:sr-only">{label}</span>}
      <SkeletonGroupContext.Provider value={defaults}>{children}</SkeletonGroupContext.Provider>
    </div>
  );
};
SkeletonGroup.displayName = 'SkeletonGroup';

/**
 * A decorative loading placeholder. Each Skeleton is `aria-hidden` (a consumer `aria-hidden`
 * overrides it); wrap the placeholders of a loading region in {@link SkeletonGroup}
 * (`Skeleton.Group`), which marks it busy, gives it a visually hidden "Loading" label and sets
 * the `size`, `shape`, `animation` and `appearance` of the placeholders inside it.
 *
 * - `size` is a preset in pixels (Fluent's sizes, 8 to 128): the height of a `rounded` line, the
 *   width and height of a `circular` or `square` box. A placeholder with no `height` is 16px tall.
 * - `animation="wave"` sweeps a highlight across it instead of pulsing; both stop for reduced
 *   motion. `appearance="translucent"` lets what is behind it show.
 * - In forced-colors mode the placeholders are painted `GrayText`. In React Server Components use
 *   the flat export `SkeletonGroup` instead of `Skeleton.Group`.
 *
 * @example
 * <Skeleton.Group label="Loading profile" animation="wave">
 *   <Skeleton shape="circular" size={32} />
 *   <Skeleton width={160} size={12} />
 * </Skeleton.Group>
 */
export const Skeleton = /* @__PURE__ */ Object.assign(SkeletonRoot, { Group: SkeletonGroup });
