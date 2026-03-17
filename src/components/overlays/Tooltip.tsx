import * as React from 'react';
import { cn } from '../../lib/cn';
import { useId } from '../../hooks/useId';

/** Properties for the Tooltip component. */
export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  /** Content to display inside the tooltip. */
  content: React.ReactNode;
  /** Visual variant of the tooltip.
   * @default 'dark'
   */
  variant?: 'dark' | 'light';
  /** Delay in milliseconds before the tooltip appears.
   * @default 200
   */
  delay?: number;
  /** Target element that triggers the tooltip on hover/focus. */
  children: React.ReactElement;
}

const variantClasses: Record<'dark' | 'light', string> = {
  dark: 'bg-[#242424] text-white',
  light: 'bg-white border border-border text-foreground',
};

export const Tooltip = React.forwardRef<HTMLSpanElement, TooltipProps>(
  ({ content, variant = 'dark', delay = 200, children, className, ...rest }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
    const tooltipId = useId('tooltip');

    const show = () => {
      timeoutRef.current = setTimeout(() => setVisible(true), delay);
    };

    const hide = () => {
      clearTimeout(timeoutRef.current);
      setVisible(false);
    };

    React.useEffect(() => {
      return () => clearTimeout(timeoutRef.current);
    }, []);

    if (!React.isValidElement(children)) return null;

    const child = React.cloneElement(children, { 'aria-describedby': visible ? tooltipId : undefined } as Partial<typeof children.props>);

    return (
      <span
        ref={ref}
        {...rest}
        className={cn('relative inline-block', className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {child}
        {visible && (
          <span
            role="tooltip"
            id={tooltipId}
            className={cn(
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 text-caption-1 px-3 py-1.5 rounded shadow whitespace-nowrap z-50',
              variantClasses[variant],
            )}
          >
            {content}
          </span>
        )}
      </span>
    );
  }
);

Tooltip.displayName = 'Tooltip';
