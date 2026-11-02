import * as React from 'react';
import { wcn } from '../../lib/cn';
import { imageClassNames } from '../../lib/classNames';
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
   * Text alternative of the image, required. Describe what the image shows, or pass `alt=""` when
   * it is decorative (it then is hidden from assistive technology). JavaScript code that leaves it
   * out gets a development warning.
   */
  alt: string;
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
 * {@link ImageProps} under the name 0.18 gave its strict form, the props with a required `alt`.
 * Since 1.0 `ImageProps.alt` is required, so the two are the same type.
 */
export type StrictImageProps = ImageProps;

const fitMap: Record<ImageFit, string> = {
  // wave-allow-physical: the anchor is the image's own corner; image pixels never mirror in RTL.
  none: 'wave:object-none wave:object-left-top',
  center: 'wave:object-none wave:object-center',
  contain: 'wave:object-contain',
  cover: 'wave:object-cover',
  default: '',
};

const shapeMap: Record<ImageShape, string> = {
  circular: 'wave:rounded-full',
  rounded: 'wave:rounded',
  square: 'wave:rounded-none',
};

/**
 * An `<img>` with Wave fit, shape, shadow and border options.
 *
 * `alt` is required: a description of the image, or `alt=""` for a decorative image. Without it
 * screen readers may announce the file name, so JavaScript code that leaves it out gets a
 * development warning.
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
  // Required by the types; untyped code may still leave it out (C-DEV: from an effect, once).
  const missingAlt = (alt as string | undefined) === undefined;
  React.useEffect(() => {
    if (missingAlt) {
      warnOnce(
        'Image:alt-missing',
        'Image: `alt` is required. Describe the image, or pass alt="" when it is decorative.',
      );
    }
  }, [missingAlt]);

  return (
    <img
      ref={ref}
      alt={alt}
      className={wcn(
        imageClassNames.root,
        fitMap[fit],
        shapeMap[shape],
        // Set here, not left to Preflight (C-NATIVE). The default fit fills the box, so an
        // automatic height keeps the aspect ratio; the other fits fit the image into the box.
        block ? 'wave:block wave:w-full' : 'wave:inline-block wave:max-w-full',
        fit === 'default' && 'wave:h-auto',
        shadow && 'wave:shadow-4',
        bordered && 'wave:border wave:border-border',
        className,
      )}
      {...rest}
    />
  );
};

Image.displayName = 'Image';
