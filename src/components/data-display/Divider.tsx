import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the Divider component. */
export interface DividerProps extends React.HTMLAttributes<HTMLElement> {
  /** Element type to render as. */
  as?: React.ElementType;
  /** Orientation of the divider line.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
}

export const Divider = ({ as, orientation = 'horizontal', className, children, ref, ...props }: DividerProps & { ref?: React.Ref<HTMLElement> }) => {
    if (orientation === 'vertical') {
      const VerticalComponent = as || 'div';
      return (
        <VerticalComponent
          ref={ref}
          className={cn('border-l border-border h-6 inline-block', className)}
          role="separator"
          aria-orientation="vertical"
          {...props}
        />
      );
    }

    if (children) {
      const WrapperComponent = as || 'div';
      return (
        <WrapperComponent
          ref={ref}
          className={cn('flex items-center gap-3', className)}
          role="separator"
          {...props}
        >
          <hr className="flex-1 border-t border-border" />
          <span className="text-caption-1 text-muted-foreground shrink-0">{children}</span>
          <hr className="flex-1 border-t border-border" />
        </WrapperComponent>
      );
    }

    const HrComponent = as || 'hr';
    return (
      <HrComponent
        ref={ref}
        className={cn('border-t border-border w-full', className)}
        role="separator"
        {...props}
      />
    );
  };

Divider.displayName = 'Divider';
