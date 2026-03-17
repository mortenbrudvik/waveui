import * as React from 'react';
import { cn } from '../../lib/cn';
import { useId } from '../../hooks/useId';
import type { Status } from '../../lib/types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Options for dispatching a toast notification. */
export interface ToastOptions {
  /** Status level controlling the toast color and icon.
   * @default 'info'
   */
  status?: Status;
  /** Title text of the toast. */
  title: string;
  /** Optional body text displayed below the title. */
  body?: string;
  /** Auto-dismiss timeout in milliseconds. Set to 0 to disable auto-dismiss.
   * @default 5000
   */
  timeout?: number;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface ToasterContextValue {
  dispatchToast: (options: ToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToasterContext = React.createContext<ToasterContextValue>({
  dispatchToast: () => {},
  dismissToast: () => {},
});

export function useToastController() {
  return React.useContext(ToasterContext);
}

/* ------------------------------------------------------------------ */
/*  Toast (individual notification)                                   */
/* ------------------------------------------------------------------ */

/** Properties for the Toast component. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the toast appearance.
   * @default 'info'
   */
  status?: Status;
  /** Title text displayed in the toast. */
  title?: string;
  /** Callback invoked when the dismiss button is clicked. */
  onDismiss?: () => void;
}

const statusStyles: Record<Status, string> = {
  success: 'border-l-4 border-l-green-600',
  warning: 'border-l-4 border-l-yellow-500',
  error: 'border-l-4 border-l-destructive',
  info: 'border-l-4 border-l-primary',
};

const statusIcons: Record<Status, string> = {
  success: '\u2713',
  warning: '\u26A0',
  error: '\u2717',
  info: '\u2139',
};

const ToastRoot = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ status = 'info', title, onDismiss, className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        role={status === 'error' ? 'alert' : 'status'}
        aria-live={status === 'error' ? 'assertive' : 'polite'}
        className={cn(
          'flex items-start gap-3 rounded border border-border bg-background p-3 shadow-4',
          statusStyles[status],
          className,
        )}
        {...rest}
      >
        <span className="shrink-0 text-sm" aria-hidden="true">
          {statusIcons[status]}
        </span>
        <div className="flex-1 min-w-0">
          {title && <div className="text-body-2 font-semibold text-foreground">{title}</div>}
          {children && <div className="text-body-1 text-muted-foreground mt-0.5">{children}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    );
  },
);
ToastRoot.displayName = 'Toast';

/* ------------------------------------------------------------------ */
/*  Toaster (container)                                               */
/* ------------------------------------------------------------------ */

/** Properties for the Toaster container component. */
export interface ToasterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Screen corner position for the toast container.
   * @default 'bottom-right'
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

type ToastPosition = NonNullable<ToasterProps['position']>;

const positionMap: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

export const Toaster = React.forwardRef<HTMLDivElement, ToasterProps>(
  ({ position = 'bottom-right', className, children, ...rest }, ref) => {
    const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
    const prefix = useId('toast');
    const counterRef = React.useRef(0);
    const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Cleanup all timers on unmount
    React.useEffect(() => {
      const timers = timersRef.current;
      return () => {
        timers.forEach(clearTimeout);
      };
    }, []);

    const dispatchToast = React.useCallback(
      (options: ToastOptions) => {
        const id = `${prefix}-${++counterRef.current}`;
        const entry: ToastEntry = { id, ...options };
        setToasts((prev) => [...prev, entry]);

        const timeout = options.timeout ?? 5000;
        if (timeout > 0) {
          const timerId = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            timersRef.current.delete(id);
          }, timeout);
          timersRef.current.set(id, timerId);
        }
      },
      [prefix],
    );

    const dismissToast = React.useCallback((id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
      <ToasterContext.Provider value={{ dispatchToast, dismissToast }}>
        {children}
        <div
          ref={ref}
          className={cn('fixed z-[100] flex flex-col gap-2 w-80', positionMap[position], className)}
          {...rest}
        >
          {toasts.map((t) => (
            <ToastRoot
              key={t.id}
              status={t.status}
              title={t.title}
              onDismiss={() => dismissToast(t.id)}
            >
              {t.body}
            </ToastRoot>
          ))}
        </div>
      </ToasterContext.Provider>
    );
  },
);
Toaster.displayName = 'Toaster';

export const Toast = ToastRoot;
