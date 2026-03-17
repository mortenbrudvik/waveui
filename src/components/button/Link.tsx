import * as React from 'react';
import { cn } from '../../lib/cn';

export type LinkVariant = 'inline' | 'standalone' | 'subtle';

/** Properties for the Link component. */
export interface LinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Custom element type to render as.
   * @default 'a'
   */
  as?: React.ElementType;
  /** Visual style variant for the link.
   * @default 'inline'
   */
  variant?: LinkVariant;
  /** Whether the link is disabled and non-interactive. */
  disabled?: boolean;
}

const variantClasses: Record<LinkVariant, string> = {
  inline: 'text-primary hover:underline',
  standalone: 'font-semibold text-primary hover:underline',
  subtle: 'text-foreground hover:underline',
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ as, variant = 'inline', disabled, className, children, onClick, ...props }, ref) => {
    const Component = as || 'a';
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    return (
      <Component
        ref={ref}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={handleClick}
        className={cn(
          'transition-colors cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          variantClasses[variant],
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Link.displayName = 'Link';
