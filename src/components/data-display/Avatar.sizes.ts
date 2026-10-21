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
  16: 'w-4 h-4 text-[10px]',
  20: 'w-5 h-5 text-[10px]',
  24: 'w-6 h-6 text-[10px]',
  28: 'w-7 h-7 text-xs',
  32: 'w-8 h-8 text-xs',
  36: 'w-9 h-9 text-sm',
  40: 'w-10 h-10 text-sm',
  48: 'w-12 h-12 text-base',
  56: 'w-14 h-14 text-lg',
  64: 'w-16 h-16 text-xl',
  72: 'w-18 h-18 text-2xl',
  96: 'w-24 h-24 text-3xl',
  120: 'w-30 h-30 text-4xl',
  128: 'w-32 h-32 text-4xl',
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
  if (shape === 'circular') return 'rounded-full';
  return pixels >= 40 ? 'rounded-md' : 'rounded-sm';
}
