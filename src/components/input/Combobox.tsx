import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/* ------------------------------------------------------------------ */
/*  Option & OptionGroup (shared with Dropdown)                       */
/* ------------------------------------------------------------------ */

/** Properties for the Option component used within Combobox and Dropdown. */
export interface OptionProps extends React.LiHTMLAttributes<HTMLLIElement> {
  /** Value associated with this option. */
  value: string;
  /** Whether the option is disabled and non-selectable. */
  disabled?: boolean;
}

export const Option = React.forwardRef<HTMLLIElement, OptionProps>(
  ({ value, disabled = false, className, children, ...rest }, ref) => {
    return (
      <li
        ref={ref}
        role="option"
        data-value={value}
        aria-disabled={disabled || undefined}
        className={cn(
          'px-3 py-1.5 text-body-1 cursor-pointer select-none',
          'hover:bg-[#f5f5f5]',
          disabled && 'text-muted-foreground cursor-not-allowed',
          className,
        )}
        {...rest}
      >
        {children ?? value}
      </li>
    );
  },
);
Option.displayName = 'Option';

/** Properties for the OptionGroup component used to group options. */
export interface OptionGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Heading label for the option group. */
  label: string;
}

export const OptionGroup = React.forwardRef<HTMLDivElement, OptionGroupProps>(
  ({ label, className, children, ...rest }, ref) => {
    return (
      <div ref={ref} role="group" aria-label={label} className={cn(className)} {...rest}>
        <div className="px-3 py-1 text-caption-1 font-semibold text-muted-foreground">{label}</div>
        <ul role="presentation">{children}</ul>
      </div>
    );
  },
);
OptionGroup.displayName = 'OptionGroup';

/* ------------------------------------------------------------------ */
/*  Combobox context                                                  */
/* ------------------------------------------------------------------ */

interface ComboboxContextValue {
  selectedValue: string;
  selectOption: (value: string, label: string) => void;
  activeIndex: number;
}

const ComboboxContext = React.createContext<ComboboxContextValue>({
  selectedValue: '',
  selectOption: () => {},
  activeIndex: -1,
});

/* ------------------------------------------------------------------ */
/*  Combobox                                                          */
/* ------------------------------------------------------------------ */

/** Properties for the Combobox component. */
export interface ComboboxProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled selected value. */
  value?: string;
  /** Initial selected value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Callback fired when an option is selected. */
  onOptionSelect?: (value: string) => void;
  /** Placeholder text shown when no value is selected. */
  placeholder?: string;
  /** Whether the combobox is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /** Whether to allow free-form text input that filters options.
   * @default false
   */
  freeform?: boolean;
}

const ComboboxRoot = React.forwardRef<HTMLDivElement, ComboboxProps>(
  (
    {
      value: controlledValue,
      defaultValue = '',
      onOptionSelect,
      placeholder,
      disabled = false,
      freeform = false,
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
    const [inputValue, setInputValue] = React.useState(defaultValue);
    const [open, setOpen] = React.useState(false);

    // Sync inputValue when controlled value changes externally
    React.useEffect(() => {
      if (controlledValue !== undefined) {
        setInputValue(controlledValue);
      }
    }, [controlledValue]);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const listboxId = useId('combobox-listbox');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

    React.useEffect(() => {
      return () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      };
    }, []);

    const selectOption = React.useCallback(
      (val: string, label: string) => {
        setSelectedValue(val);
        setInputValue(label);
        setOpen(false);
        inputRef.current?.focus();
      },
      [setSelectedValue],
    );

    // Collect option values and labels for keyboard nav
    const optionEntries = React.useMemo(() => {
      const entries: { value: string; label: string }[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === Option) {
          const props = child.props as OptionProps;
          entries.push({
            value: props.value,
            label: typeof props.children === 'string' ? props.children : props.value,
          });
        }
      });
      return entries;
    }, [children]);

    // Filter children based on input (only in freeform mode where user types freely)
    const filteredChildren = React.useMemo(() => {
      if (!freeform || !inputValue) return children;
      const filter = inputValue.toLowerCase();
      return React.Children.toArray(children).filter((child) => {
        if (!React.isValidElement(child)) return true;
        if (child.type === Option) {
          const props = child.props as OptionProps;
          const text = (
            typeof props.children === 'string' ? props.children : props.value
          ).toLowerCase();
          return text.includes(filter);
        }
        return true;
      });
    }, [children, inputValue, freeform]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => Math.min(i + 1, optionEntries.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0 && open) {
        e.preventDefault();
        const entry = optionEntries[activeIndex];
        if (entry) selectOption(entry.value, entry.label);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    return (
      <ComboboxContext.Provider value={{ selectedValue, selectOption, activeIndex }}>
        <div ref={ref} className={cn('relative inline-flex flex-col', className)} {...rest}>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            disabled={disabled}
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
              if (freeform) setSelectedValue(e.target.value);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // delay to allow click on option
              blurTimeoutRef.current = setTimeout(() => setOpen(false), 200);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              'h-8 w-full rounded border border-input bg-background px-3 text-sm text-foreground',
              'focus:outline-none focus:border-b-2 focus:border-b-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
          {open && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute top-full left-0 z-50 mt-1 w-full max-h-60 overflow-auto rounded border border-border bg-background py-1 shadow-4"
              onMouseDown={(e) => e.preventDefault()}
            >
              {/* eslint-disable-next-line react-hooks/refs -- false positive: Children.map + cloneElement pattern, no refs accessed */}
              {React.Children.map(filteredChildren, (child, i) => {
                if (!React.isValidElement(child)) return child;
                if (child.type === Option) {
                  const props = child.props as OptionProps;
                  const originalOnClick = (
                    child as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
                  ).props.onClick;
                  return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
                    'aria-selected': props.value === selectedValue,
                    className: cn(
                      props.className,
                      props.value === selectedValue && 'bg-[#f0f0f0]',
                      i === activeIndex && 'bg-[#f5f5f5]',
                    ),
                    onClick: (e: React.MouseEvent) => {
                      if (props.disabled) return;
                      const label =
                        typeof props.children === 'string' ? props.children : props.value;
                      selectOption(props.value, label);
                      originalOnClick?.(e);
                    },
                  });
                }
                return child;
              })}
            </ul>
          )}
        </div>
      </ComboboxContext.Provider>
    );
  },
);
ComboboxRoot.displayName = 'Combobox';

export const Combobox = Object.assign(ComboboxRoot, {
  Option,
  OptionGroup,
});
