import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the Toolbar component. An `aria-label` is required for accessibility
 * to describe the toolbar's purpose (e.g., "Formatting options").
 */
export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Custom element type to render as.
   * @default 'div'
   */
  as?: React.ElementType;
}

export const Toolbar = ({ as, className, children, ref, ...props }: ToolbarProps & { ref?: React.Ref<HTMLElement> }) => {
    const Component = as || 'div';
    return (
      <Component
        ref={ref}
        role="toolbar"
        className={cn('inline-flex items-center gap-1 p-1 border border-border rounded', className)}
        {...props}
      >
        {children}
      </Component>
    );
  };

Toolbar.displayName = 'Toolbar';
