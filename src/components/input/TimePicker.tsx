import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length !== 2 || parts.some((p) => Number.isNaN(p))) return NaN;
  const [h, m] = parts;
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(minutes: number, format: '12h' | '24h'): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  if (format === '24h') {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function generateTimeOptions(
  step: number,
  min: string,
  max: string,
  format: '12h' | '24h',
): Array<{ value: string; label: string }> {
  const minMinutes = timeToMinutes(min);
  const maxMinutes = timeToMinutes(max);
  if (Number.isNaN(minMinutes) || Number.isNaN(maxMinutes)) return [];
  const options: Array<{ value: string; label: string }> = [];
  for (let m = minMinutes; m <= maxMinutes; m += step) {
    const h24 = Math.floor(m / 60) % 24;
    const mm = m % 60;
    const value = `${String(h24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const label = minutesToTime(m, format);
    options.push({ value, label });
  }
  return options;
}

/* ------------------------------------------------------------------ */
/*  TimePicker                                                         */
/* ------------------------------------------------------------------ */

/** Properties for the TimePicker component. */
export interface TimePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled selected time in 'HH:mm' format. */
  value?: string;
  /** Initial time for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Callback fired when the selected time changes. */
  onChange?: (time: string) => void;
  /** Time display format.
   * @default '12h'
   */
  format?: '12h' | '24h';
  /** Interval in minutes between available time options.
   * @default 30
   */
  step?: number;
  /** Earliest selectable time in 'HH:mm' format.
   * @default '00:00'
   */
  minTime?: string;
  /** Latest selectable time in 'HH:mm' format.
   * @default '23:59'
   */
  maxTime?: string;
  /** Placeholder text shown when no time is selected.
   * @default 'Select a time'
   */
  placeholder?: string;
  /** Whether the time picker is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /** Whether to show a clear button when a time is selected.
   * @default false
   */
  clearable?: boolean;
}

const TimePickerRoot = (
    {
      value: controlledValue,
      defaultValue = '',
      onChange,
      format = '12h',
      step = 30,
      minTime = '00:00',
      maxTime = '23:59',
      placeholder = 'Select a time',
      disabled = false,
      clearable = false,
      className, ref, ...rest }: TimePickerProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [selectedValue, setSelectedValue] = useControllable(
      controlledValue,
      defaultValue,
      onChange,
    );
    const [open, setOpen] = React.useState(false);
    const [inputText, setInputText] = React.useState('');
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const listboxId = useId('timepicker-listbox');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

    React.useEffect(() => {
      return () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      };
    }, []);

    const allOptions = React.useMemo(
      () => generateTimeOptions(step, minTime, maxTime, format),
      [step, minTime, maxTime, format],
    );

    const filteredOptions = React.useMemo(() => {
      if (!inputText) return allOptions;
      const lower = inputText.toLowerCase();
      return allOptions.filter(
        (opt) => opt.label.toLowerCase().includes(lower) || opt.value.includes(lower),
      );
    }, [allOptions, inputText]);

    // Derive display text from selected value
    const displayLabel = React.useMemo(() => {
      if (!selectedValue) return '';
      const opt = allOptions.find((o) => o.value === selectedValue);
      return opt ? opt.label : selectedValue;
    }, [selectedValue, allOptions]);

    // Sync input text with selected value when not open
    React.useEffect(() => {
      if (!open) {
        setInputText(displayLabel);
      }
    }, [open, displayLabel]);

    // Scroll active option into view
    React.useEffect(() => {
      if (open && activeIndex >= 0 && listRef.current) {
        const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
        item?.scrollIntoView({ block: 'nearest' });
      }
    }, [open, activeIndex]);

    const selectOption = React.useCallback(
      (val: string) => {
        setSelectedValue(val);
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
      },
      [setSelectedValue],
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
      if (!open) setOpen(true);
      setActiveIndex(-1);
    };

    const handleInputFocus = () => {
      setOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (open && activeIndex >= 0 && filteredOptions[activeIndex]) {
          selectOption(filteredOptions[activeIndex].value);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedValue('');
      setInputText('');
      inputRef.current?.focus();
    };

    return (
      <div ref={ref} className={cn('relative inline-flex flex-col', className)} {...rest}>
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            value={inputText}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              blurTimeoutRef.current = setTimeout(() => setOpen(false), 200);
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'h-8 w-full rounded border border-input bg-background px-3 text-sm',
              'focus:outline-none focus:border-b-2 focus:border-b-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              clearable && selectedValue && 'pr-8',
            )}
          />
          {clearable && selectedValue && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="absolute right-2 flex h-4 w-4 items-center justify-center text-[#707070] hover:text-foreground"
              aria-label="Clear time"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
        {open && filteredOptions.length > 0 && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="absolute top-full left-0 z-50 mt-1 w-full max-h-60 overflow-auto rounded border border-border bg-background py-1 shadow-4"
            onMouseDown={(e) => e.preventDefault()}
          >
            {filteredOptions.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === selectedValue}
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-sm',
                  'hover:bg-[#f5f5f5]',
                  opt.value === selectedValue && 'bg-[#f0f0f0]',
                  i === activeIndex && 'bg-[#f5f5f5]',
                )}
                onClick={() => selectOption(opt.value)}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
TimePickerRoot.displayName = 'TimePicker';

export const TimePicker = TimePickerRoot;
