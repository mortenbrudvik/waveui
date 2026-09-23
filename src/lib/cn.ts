import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge configured with the Wave theme scales, so custom utilities are grouped
 * correctly: `text-body-1` is a font size (not a text colour), `shadow-4` is a shadow size (not a
 * shadow colour), `font-wave` is a font family and `animate-wave-*` are animations.
 */
export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'caption-2',
        'caption-1',
        'body-1',
        'body-2',
        'subtitle-2',
        'subtitle-1',
        'title-3',
        'title-2',
        'title-1',
        'large-title',
        'display',
      ],
      shadow: ['2', '4', '8', '16', '28', '64'],
      font: ['wave'],
      animate: [
        'wave-spin',
        'wave-spin-slow',
        'wave-pulse',
        'wave-indeterminate',
        'wave-indeterminate-rtl',
      ],
    },
  },
});

/**
 * Joins class names (clsx) and resolves Tailwind conflicts so the **last** class wins — pass
 * internal classes first and the consumer's `className` last (user classes always win).
 *
 * @example
 * cn('text-body-1 text-foreground', className) // className="text-primary" keeps text-body-1
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
