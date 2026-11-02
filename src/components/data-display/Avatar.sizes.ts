import type { Size } from '../../lib/types';

/**
 * The numeric sizes of an Avatar, in pixels (Fluent's 14 sizes). A literal union: Tailwind can only
 * generate the classes of {@link avatarBoxClasses}.
 */
export type AvatarNumericSize =
  16 | 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 72 | 96 | 120 | 128;

/** The size of an Avatar: a named size (24 to 56px) or one of the {@link AvatarNumericSize}s. */
export type AvatarSize = Size | AvatarNumericSize;

/** Pixel box of each named size. */
const NAMED_PIXELS: Readonly<Record<Size, AvatarNumericSize>> = {
  'extra-small': 24,
  small: 32,
  medium: 40,
  large: 48,
  'extra-large': 56,
};

/** The pixel box of an Avatar size. */
export function avatarPixelSize(size: AvatarSize): number {
  return typeof size === 'number' ? size : NAMED_PIXELS[size];
}

/** Width, height and text size classes per pixel box. Literal strings only. */
export const avatarBoxClasses: Readonly<Record<AvatarNumericSize, string>> = {
  16: 'wave:w-4 wave:h-4 wave:text-[10px]',
  20: 'wave:w-5 wave:h-5 wave:text-[10px]',
  24: 'wave:w-6 wave:h-6 wave:text-[10px]',
  28: 'wave:w-7 wave:h-7 wave:text-xs',
  32: 'wave:w-8 wave:h-8 wave:text-xs',
  36: 'wave:w-9 wave:h-9 wave:text-sm',
  40: 'wave:w-10 wave:h-10 wave:text-sm',
  48: 'wave:w-12 wave:h-12 wave:text-base',
  56: 'wave:w-14 wave:h-14 wave:text-lg',
  64: 'wave:w-16 wave:h-16 wave:text-xl',
  72: 'wave:w-18 wave:h-18 wave:text-2xl',
  96: 'wave:w-24 wave:h-24 wave:text-3xl',
  120: 'wave:w-30 wave:h-30 wave:text-4xl',
  128: 'wave:w-32 wave:h-32 wave:text-4xl',
};

/** The box classes of an Avatar size. */
export function avatarSizeClassesFor(size: AvatarSize): string {
  return avatarBoxClasses[typeof size === 'number' ? size : NAMED_PIXELS[size]];
}

/** The size a presence badge takes on an avatar of this pixel box. */
export function avatarBadgeSize(pixels: number): Size {
  if (pixels <= 24) return 'extra-small';
  if (pixels <= 32) return 'small';
  if (pixels <= 56) return 'medium';
  if (pixels <= 96) return 'large';
  return 'extra-large';
}

/** The corner radius of an Avatar shape: a circle, or rounded-md from 40px and rounded-sm below. */
export function avatarShapeClasses(shape: 'circular' | 'square', pixels: number): string {
  if (shape === 'circular') return 'wave:rounded-full';
  return pixels >= 40 ? 'wave:rounded-md' : 'wave:rounded-sm';
}
