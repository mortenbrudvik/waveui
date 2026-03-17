import * as React from 'react';
import { cn } from '../../lib/cn';
import { useId } from '../../hooks/useId';
import { useControllable } from '../../hooks/useControllable';

/** Properties for the Popover component. */
export interface PopoverProps {
  /** Controlled open state of the popover. */
  open?: boolean;
  /** Default open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /** Callback invoked when the popover open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Popover trigger and content elements. */
  children: React.ReactNode;
}

/** Properties for the PopoverTrigger sub-component. */
export interface PopoverTriggerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Trigger element that toggles the popover on click. */
  children: React.ReactNode;
}

/** Properties for the PopoverContent sub-component. */
export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to render inside the popover. */
  children: React.ReactNode;
}

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
}

const PopoverContext = React.createContext<PopoverContextValue>({
  open: false,
  setOpen: () => {},
  contentId: '',
});

function usePopoverContext() {
  return React.useContext(PopoverContext);
}

function PopoverRoot({ open: openProp, defaultOpen, onOpenChange, children }: PopoverProps) {
  const [isOpen, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const ref = React.useRef<HTMLDivElement>(null);
  const contentId = useId('popover-content');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, setOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  return (
    <PopoverContext.Provider value={{ open: isOpen, setOpen, contentId }}>
      <div ref={ref} className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

const PopoverTrigger = React.forwardRef<HTMLSpanElement, PopoverTriggerProps>(
  ({ children, ...rest }, ref) => {
    const { open, setOpen, contentId } = usePopoverContext();
    return (
      <span
        ref={ref}
        {...rest}
        className="inline-block"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        {children}
      </span>
    );
  },
);
PopoverTrigger.displayName = 'PopoverTrigger';

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ children, className, ...rest }, ref) => {
    const { open, contentId } = usePopoverContext();

    if (!open) return null;

    return (
      <div
        ref={ref}
        role="dialog"
        id={contentId}
        {...rest}
        className={cn(
          'absolute mt-2 bg-background border border-border rounded-lg p-4 shadow-4 w-64 z-40',
          className,
        )}
      >
        <div className="absolute -top-[6px] left-4 w-3 h-3 rotate-45 bg-background border-l border-t border-border" />
        {children}
      </div>
    );
  },
);
PopoverContent.displayName = 'PopoverContent';

PopoverRoot.displayName = 'Popover';

export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
});
