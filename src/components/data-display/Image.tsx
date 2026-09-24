import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import type { Shape } from '../../lib/types';

/**
 * How an image fits its box (the `width`/`height` attributes, or a size set with `className`):
 *
 * - `'default'`: the image fills the box. Its height follows its width, so the aspect ratio is
 *   kept (the attributes only give the ratio before the image loads); a height set with
 *   `className` fixes the box, and the image then stretches to it.
 * - `'none'`: not scaled; the image's top-left corner stays in view and the rest is cropped.
 * - `'center'`: not scaled; the middle of the image stays in view and the edges are cropped.
 * - `'contain'`: scaled to fit inside the box, keeping its aspect ratio (the box may show empty
 *   bands).
 * - `'cover'`: scaled to fill the box, keeping its aspect ratio (the edges are cropped).
 */
export type ImageFit = 'none' | 'center' | 'contain' | 'cover' | 'default';
/** Shape of the image corners (the shared {@link Shape} vocabulary). */
export type ImageShape = Shape;

/** Properties for the Image component. */
export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Text alternative of the image. Describe what the image shows, or pass `alt=""` when it is
   * decorative (it then is hidden from assistive technology). Leaving it out logs a development
   * warning; use {@link StrictImageProps} to require it at compile time (required in 1.0).
   */
  alt?: string;
  /**
   * How the image fits its box: `'default'` (fills it, keeping the aspect ratio through an
   * automatic height), `'none'` (not scaled, top-left corner in view), `'center'` (not scaled,
   * middle in view), `'contain'` or `'cover'`. See {@link ImageFit}.
   * @default 'default'
   */
  fit?: ImageFit;
  /** Shape of the image border radius.
   * @default 'square'
   */
  shape?: ImageShape;
  /** Whether to apply a shadow to the image.
   * @default false
   */
  shadow?: boolean;
  /**
   * Whether the image is displayed as a block element filling the width of its parent. Otherwise
   * it is inline and never wider than its parent. With the default `fit` the height follows the
   * width (the aspect ratio is kept); with another `fit` the box keeps its `height`.
   * @default false
   */
  block?: boolean;
  /** Whether to show a border around the image.
   * @default false
   */
  bordered?: boolean;
  /** Ref to the `<img>` element. */
  ref?: React.Ref<HTMLImageElement>;
}

/**
 * {@link ImageProps} with a required `alt`: the compile-time check that every image has a text
 * alternative (`alt=""` for decorative images). `ImageProps.alt` becomes required in 1.0.
 *
 * @example
 * const Photo = (props: StrictImageProps) => <Image {...props} />;
 */
export interface StrictImageProps extends Omit<ImageProps, 'alt'> {
  /** Text alternative of the image; `''` for a decorative image. */
  alt: string;
}

const fitMap: Record<ImageFit, string> = {
  // wave-allow-physical: the anchor is the image's own corner; image pixels never mirror in RTL.
  none: 'object-none object-left-top',
  center: 'object-none object-center',
  contain: 'object-contain',
  cover: 'object-cover',
  default: '',
};

const shapeMap: Record<ImageShape, string> = {
  circular: 'rounded-full',
  rounded: 'rounded',
  square: 'rounded-none',
};

/**
 * An `<img>` with Wave fit, shape, shadow and border options.
 *
 * Always pass `alt`: a description of the image, or `alt=""` for a decorative image. Without it
 * screen readers may announce the file name; a development warning points this out.
 *
 * @example
 * <Image src="/team.jpg" alt="The team at the 2026 offsite" shape="rounded" />
 */
export const Image = ({
  fit = 'default',
  shape = 'square',
  shadow = false,
  block = false,
  bordered = false,
  className,
  alt,
  ref,
  ...rest
}: ImageProps) => {
  const missingAlt = alt === undefined;
  React.useEffect(() => {
    if (missingAlt) {
      warnOnce(
        'Image:alt',
        'Image: `alt` is missing. Describe the image, or pass alt="" when it is decorative.',
      );
    }
  }, [missingAlt]);

  return (
    <img
      ref={ref}
      alt={alt}
      className={cn(
        fitMap[fit],
        shapeMap[shape],
        // Set here, not left to Preflight (C-NATIVE). The default fit fills the box, so an
        // automatic height keeps the aspect ratio; the other fits fit the image into the box.
        block ? 'block w-full' : 'inline-block max-w-full',
        fit === 'default' && 'h-auto',
        shadow && 'shadow-4',
        bordered && 'border border-border',
        className,
      )}
      {...rest}
    />
  );
};

Image.displayName = 'Image';
