import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import type { Shape } from '../../lib/types';

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
  /** How the image fits within its container.
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
  /** Whether the image is displayed as a block element filling its container width.
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
  none: 'object-none',
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
        block ? 'block w-full' : 'inline-block',
        shadow && 'shadow-4',
        bordered && 'border border-border',
        className,
      )}
      {...rest}
    />
  );
};

Image.displayName = 'Image';
