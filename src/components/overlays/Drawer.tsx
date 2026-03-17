import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { useId } from '../../hooks/useId';
import { useControllable } from '../../hooks/useControllable';

/** Properties for the Drawer component. */
export interface DrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state of the drawer. */
  open?: boolean;
  /** Default open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /** Callback invoked when the drawer open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Side of the screen from which the drawer slides in.
   * @default 'right'
   */
  position?: 'left' | 'right';
  /** Title displayed in the drawer header. */
  title?: string;
  /** Content to render inside the drawer body. */
  children: React.ReactNode;
}

const positionClasses: Record<'left' | 'right', string> = {
  left: 'left-0 top-0 h-full w-80',
  right: 'right-0 top-0 h-full w-80',
};

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(
  (
    {
      open: openProp,
      defaultOpen,
      onOpenChange,
      position = 'right',
      title,
      children,
      className,
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
    const panelRef = React.useRef<HTMLDivElement>(null);
    const previousFocusRef = React.useRef<HTMLElement | null>(null);
    const titleId = useId('drawer-title');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    // Lock body scroll when open
    React.useEffect(() => {
      if (open) {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = prev;
        };
      }
    }, [open]);

    // Merge refs
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    React.useEffect(() => {
      if (open) {
        previousFocusRef.current = document.activeElement as HTMLElement;
        requestAnimationFrame(() => {
          const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          firstFocusable?.focus();
        });
      } else if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }, [open]);

    React.useEffect(() => {
      if (!open) return;
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
        if (e.key === 'Tab') {
          const focusableElements = panelRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (!focusableElements?.length) {
            e.preventDefault();
            panelRef.current?.focus();
            return;
          }
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }, [open, setOpen]);

    if (!mounted || !open) return null;

    return createPortal(
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={(e) => {
          if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
            setOpen(false);
          }
        }}
      >
        <div
          ref={mergedRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          {...rest}
          className={cn(
            'fixed bg-background shadow-[0px_32px_64px_rgba(0,0,0,0.24)] flex flex-col',
            positionClasses[position],
            className,
          )}
        >
          <div className="p-4 border-b border-border flex justify-between items-center">
            {title && (
              <h2 id={titleId} className="text-subtitle-1 font-semibold">
                {title}
              </h2>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-[#f5f5f5] text-muted-foreground ml-auto"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>,
      document.body,
    );
  },
);

Drawer.displayName = 'Drawer';
