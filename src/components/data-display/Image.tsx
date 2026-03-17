import * as React from 'react';
import { cn } from '../../lib/cn';

export type ImageFit = 'none' | 'center' | 'contain' | 'cover' | 'default';
export type ImageShape = 'circular' | 'rounded' | 'square';

/** Properties for the Image component. */
export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
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

export const Image = (
    {
      fit = 'default',
      shape = 'square',
      shadow = false,
      block = false,
      bordered = false,
      className,
      alt, ref, ...rest }: ImageProps & { ref?: React.Ref<HTMLImageElement> }) => {
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
