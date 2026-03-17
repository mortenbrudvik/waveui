import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { Option, OptionGroup } from './Combobox';
import type { OptionProps } from './Combobox';

/* ------------------------------------------------------------------ */
/*  Dropdown                                                          */
/* ------------------------------------------------------------------ */

/** Properties for the Dropdown component. */
export interface DropdownProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled selected value. */
  value?: string;
  /** Initial selected value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Callback fired when an option is selected. */
  onOptionSelect?: (value: string) => void;
  /** Placeholder text shown when no value is selected.
   * @default 'Select an option'
   */
  placeholder?: string;
  /** Whether the dropdown is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
}

const DropdownRoot = React.forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      value: controlledValue,
      defaultValue = '',
      onOptionSelect,
      placeholder = 'Select an option',
      disabled = false,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const [selectedValue, setSelectedValue] = useControllable(
      controlledValue,
      defaultValue,
      onOptionSelect,
    );
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const listboxId = useId('dropdown-listbox');
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

    React.useEffect(() => {
      return () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      };
    }, []);

    // Derive display text from children
    const displayText = React.useMemo(() => {
      let text = '';
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === Option) {
          const props = child.props as OptionProps;
          if (props.value === selectedValue) {
            text = typeof props.children === 'string' ? props.children : props.value;
          }
        }
      });
      return text || selectedValue;
    }, [children, selectedValue]);

    const optionValues = React.useMemo(() => {
      const vals: string[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === Option) {
          vals.push((child.props as OptionProps).value);
        }
      });
      return vals;
    }, [children]);

    const selectOption = React.useCallback(
      (val: string) => {
        setSelectedValue(val);
        setOpen(false);
        buttonRef.current?.focus();
      },
      [setSelectedValue],
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else if (e.key === 'ArrowDown') {
          setActiveIndex((i) => Math.min(i + 1, optionValues.length - 1));
        } else if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
          const val = optionValues[activeIndex];
          if (val) selectOption(val);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    return (
      <div ref={ref} className={cn('relative inline-flex flex-col', className)} {...rest}>
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => setOpen(false), 200);
          }}
          className={cn(
            'h-8 w-full rounded border border-input bg-background px-3 text-sm text-left',
            'flex items-center justify-between',
            'focus:outline-none focus:border-b-2 focus:border-b-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            !displayText && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{displayText || placeholder}</span>
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={cn('shrink-0 ml-2 transition-transform', open && 'rotate-180')}
          >
            <path
              d="M3 4.5l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute top-full left-0 z-50 mt-1 w-full max-h-60 overflow-auto rounded border border-border bg-background py-1 shadow-4"
            onMouseDown={(e) => e.preventDefault()}
          >
            {React.Children.map(children, (child, i) => {
              if (!React.isValidElement(child)) return child;
              if (child.type === Option) {
                const props = child.props as OptionProps;
                const originalOnClick = (child as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick;
                return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
                  'aria-selected': props.value === selectedValue,
                  className: cn(
                    props.className,
                    props.value === selectedValue && 'bg-[#f0f0f0]',
                    i === activeIndex && 'bg-[#f5f5f5]',
                  ),
                  onClick: (e: React.MouseEvent) => {
                    if (props.disabled) return;
                    selectOption(props.value);
                    originalOnClick?.(e);
                  },
                });
              }
              return child;
            })}
          </ul>
        )}
      </div>
    );
  },
);
DropdownRoot.displayName = 'Dropdown';

export const Dropdown = Object.assign(DropdownRoot, {
  Option,
  OptionGroup,
});
