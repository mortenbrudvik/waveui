import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { useId } from '../../hooks/useId';
import { useControllable } from '../../hooks/useControllable';

/** Properties for the Dialog component. */
export interface DialogProps {
  /** Controlled open state of the dialog. */
  open?: boolean;
  /** Default open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /** Callback invoked when the dialog open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Dialog trigger, content, and footer elements. */
  children: React.ReactNode;
}

/** Properties for the DialogContent sub-component. */
export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Title displayed at the top of the dialog. */
  title?: string;
  /** Width size of the dialog.
   * @default 'medium'
   */
  size?: 'small' | 'medium';
  /** Content to render inside the dialog body. */
  children: React.ReactNode;
}

/** Properties for the DialogFooter sub-component. */
export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Footer content, typically action buttons. */
  children: React.ReactNode;
}

/** Properties for the DialogTrigger sub-component. */
export interface DialogTriggerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Trigger element that opens the dialog on click. */
  children: React.ReactNode;
}

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
});

function useDialogContext() {
  return React.useContext(DialogContext);
}

function DialogRoot({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  const [isOpen, setOpen] = useControllable(open, defaultOpen ?? false, onOpenChange);

  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

const DialogTrigger = React.forwardRef<HTMLSpanElement, DialogTriggerProps>(
  ({ children, ...rest }, ref) => {
    const { setOpen } = useDialogContext();
    return (
      <span ref={ref} {...rest} onClick={() => setOpen(true)} className="inline-block">
        {children}
      </span>
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

const sizeClasses: Record<'small' | 'medium', string> = {
  small: 'w-[400px]',
  medium: 'w-[600px]',
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ title, size = 'medium', children, className, ...rest }, ref) => {
    const { open, setOpen } = useDialogContext();
    const contentRef = React.useRef<HTMLDivElement>(null);
    const previousFocusRef = React.useRef<HTMLElement | null>(null);
    const titleId = useId('dialog-title');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    // Lock body scroll when open
    React.useEffect(() => {
      if (open) {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
      }
    }, [open]);

    // Merge refs
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    React.useEffect(() => {
      if (open) {
        previousFocusRef.current = document.activeElement as HTMLElement;
        requestAnimationFrame(() => {
          const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
          const focusableElements = contentRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusableElements?.length) {
            e.preventDefault();
            contentRef.current?.focus();
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
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        onClick={(e) => {
          if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
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
            'bg-background rounded-xl p-6 relative',
            'shadow-[0px_32px_64px_rgba(0,0,0,0.14),0px_2px_21px_rgba(0,0,0,0.07)]',
            sizeClasses[size],
            className,
          )}
        >
          {title && (
            <h2 id={titleId} className="text-subtitle-1 font-semibold">{title}</h2>
          )}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 p-1 rounded hover:bg-[#f5f5f5] text-muted-foreground"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <div className="text-body-1 text-muted-foreground mt-2">{children}</div>
        </div>
      </div>,
      document.body,
    );
  }
);
DialogContent.displayName = 'DialogContent';

const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <div ref={ref} {...rest} className={cn('flex justify-end gap-2 mt-6', className)}>
        {children}
      </div>
    );
  }
);
DialogFooter.displayName = 'DialogFooter';

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Footer: DialogFooter,
});

(Dialog as any).displayName = 'Dialog';
