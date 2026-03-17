import * as React from 'react';
import { cn } from '../../lib/cn';
import type { TypographyVariant } from '../../lib/types';

/** Properties for the Text component. */
export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  /** Typography variant controlling font size and line height.
   * @default 'body-1'
   */
  variant?: TypographyVariant;
  /** Font weight override. */
  weight?: 400 | 600 | 700;
  /** Element type to render as.
   * @default 'span'
   */
  as?: React.ElementType;
}

const variantClasses: Record<TypographyVariant, string> = {
  'caption-2': 'text-caption-2',
  'caption-1': 'text-caption-1',
  'body-1': 'text-body-1',
  'body-2': 'text-body-2',
  'subtitle-2': 'text-subtitle-2',
  'subtitle-1': 'text-subtitle-1',
  'title-3': 'text-title-3',
  'title-2': 'text-title-2',
  'title-1': 'text-title-1',
  'large-title': 'text-large-title',
  display: 'text-display',
};

const weightClasses: Record<400 | 600 | 700, string> = {
  400: 'font-normal',
  600: 'font-semibold',
  700: 'font-bold',
};

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'body-1', weight, as: Component = 'span', className, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(variantClasses[variant], weight && weightClasses[weight], className)}
        {...props}
      />
    );
  },
);

Text.displayName = 'Text';
