import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Status, Slot } from '../../lib/types';
import { renderSlot } from '../../lib/slot';

/** Properties for the MessageBar component. */
export interface MessageBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the color and icon of the message bar.
   * @default 'info'
   */
  status?: Status;
  /** Callback invoked when the dismiss button is clicked. */
  onDismiss?: () => void;
  /** Slot for a custom status icon. */
  icon?: Slot<'span'>;
  /** Slot for a custom dismiss button. */
  dismiss?: Slot<'button'>;
  /** Message content to display. */
  children: React.ReactNode;
}

const statusClasses: Record<Status, string> = {
  info: 'bg-[#ebf3fc] border-l-[#0f6cbd]',
  success: 'bg-[#e0f2e0] border-l-[#107c10]',
  warning: 'bg-[#fff8cc] border-l-[#fde300]',
  error: 'bg-[#fde7e9] border-l-[#c50f1f]',
};

const defaultIcons: Record<Status, React.ReactNode> = {
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="#0f6cbd">
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.5 5v1h-1V7h1zm0 3v4h-1v-4h1z" />
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="#107c10">
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.36 5.65l-4 5a.5.5 0 01-.72.05l-2-2a.5.5 0 01.72-.7L9.13 11.76l3.6-4.5a.5.5 0 01.78.62l-.15.17z" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="#bc8b00">
      <path d="M9.15 3.45a1 1 0 011.7 0l6.86 11.44A1 1 0 0116.86 17H3.14a1 1 0 01-.85-1.53L9.15 3.45zM10.5 13v1h-1v-1h1zm0-5v4h-1V8h1z" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="#c50f1f">
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.5 5v4h-1V7h1zm0 6v1h-1v-1h1z" />
    </svg>
  ),
};

export const MessageBar = React.forwardRef<HTMLDivElement, MessageBarProps>(
  ({ status = 'info', onDismiss, icon, dismiss, children, className, ...rest }, ref) => {
    const renderedIcon = icon !== undefined
      ? renderSlot(icon, 'span', 'flex-shrink-0 mt-0.5')
      : <span className="flex-shrink-0 mt-0.5">{defaultIcons[status]}</span>;

    const renderedDismiss = dismiss !== undefined
      ? renderSlot(dismiss, 'button', 'ml-auto bg-transparent border-none cursor-pointer p-1 rounded hover:bg-black/5 text-muted-foreground')
      : onDismiss
        ? (
          <button
            onClick={onDismiss}
            className="ml-auto bg-transparent border-none cursor-pointer p-1 rounded hover:bg-black/5 text-muted-foreground"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )
        : null;

    return (
      <div
        ref={ref}
        role={status === 'error' || status === 'warning' ? 'alert' : 'status'}
        {...rest}
        className={cn(
          'px-4 py-3 rounded flex items-start gap-3 border-l-4',
          statusClasses[status],
          className,
        )}
      >
        {renderedIcon}
        <div className="flex-1 text-body-1">{children}</div>
        {renderedDismiss}
      </div>
    );
  }
);

MessageBar.displayName = 'MessageBar';
