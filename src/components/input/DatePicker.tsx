import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';

/* ------------------------------------------------------------------ */
/*  Internal calendar helpers                                          */
/* ------------------------------------------------------------------ */

function getCalendarDays(year: number, month: number, firstDayOfWeek: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const offset = (startDay - firstDayOfWeek + 7) % 7;
  const days: Date[] = [];

  // Fill 6 rows x 7 columns = 42 cells
  for (let i = -offset; i < 42 - offset; i++) {
    days.push(new Date(year, month, 1 + i));
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isDateDisabled(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  disabledDates?: (d: Date) => boolean,
): boolean {
  if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) {
    return true;
  }
  if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) {
    return true;
  }
  if (disabledDates?.(date)) {
    return true;
  }
  return false;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function defaultFormatDate(date: Date): string {
  return date.toLocaleDateString();
}

function defaultParseDate(str: string): Date | null {
  if (!str.trim()) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/* ------------------------------------------------------------------ */
/*  DatePicker                                                         */
/* ------------------------------------------------------------------ */

/** Properties for the DatePicker component. */
export interface DatePickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Controlled selected date. */
  value?: Date | null;
  /** Initial date for uncontrolled usage.
   * @default null
   */
  defaultValue?: Date | null;
  /** Callback fired when the selected date changes. */
  onChange?: (date: Date | null) => void;
  /** Custom function to format a Date into display text. */
  formatDate?: (date: Date) => string;
  /** Custom function to parse user input text into a Date. */
  parseDate?: (str: string) => Date | null;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Function returning true for dates that should be disabled. */
  disabledDates?: (date: Date) => boolean;
  /** Placeholder text shown when no date is selected.
   * @default 'Select a date'
   */
  placeholder?: string;
  /** Whether the date picker is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /** Whether to show a clear button when a date is selected.
   * @default false
   */
  clearable?: boolean;
  /** First day of the week (0 = Sunday, 1 = Monday, etc.).
   * @default 0
   */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Controlled open state of the calendar popup. */
  open?: boolean;
  /** Callback fired when the calendar popup open state changes. */
  onOpenChange?: (open: boolean) => void;
}

const DatePickerRoot = ({
  value: controlledValue,
  defaultValue = null,
  onChange,
  formatDate = defaultFormatDate,
  parseDate = defaultParseDate,
  minDate,
  maxDate,
  disabledDates,
  placeholder = 'Select a date',
  disabled = false,
  clearable = false,
  firstDayOfWeek = 0,
  open: controlledOpen,
  onOpenChange,
  className,
  ref,
  ...rest
}: DatePickerProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [selectedDate, setSelectedDate] = useControllable<Date | null>(
      controlledValue,
      defaultValue,
      onChange,
    );
    const [openState, setOpenState] = React.useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : openState;
    const setOpen = React.useCallback(
      (val: boolean) => {
        if (controlledOpen === undefined) {
          setOpenState(val);
        }
        onOpenChange?.(val);
      },
      [controlledOpen, onOpenChange],
    );

    const [inputText, setInputText] = React.useState('');
    const [viewMonth, setViewMonth] = React.useState(() => {
      const d = selectedDate ?? new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [focusedDay, setFocusedDay] = React.useState<Date | null>(null);

    const gridId = useId('datepicker-grid');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const gridRef = React.useRef<HTMLTableElement>(null);
    const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

    const today = new Date();

    // Clean up blur timeout on unmount
    React.useEffect(
      () => () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      },
      [],
    );

    // Sync input text with selected date when calendar is not open
    React.useEffect(() => {
      if (!open) {
        setInputText(selectedDate ? formatDate(selectedDate) : '');
      }
    }, [open, selectedDate, formatDate]);

    // Update viewMonth when selected date changes
    React.useEffect(() => {
      if (selectedDate) {
        setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
      }
    }, [selectedDate]);

    const calendarDays = React.useMemo(
      () => getCalendarDays(viewMonth.getFullYear(), viewMonth.getMonth(), firstDayOfWeek),
      [viewMonth, firstDayOfWeek],
    );

    const dayHeaders = React.useMemo(() => {
      const headers: string[] = [];
      for (let i = 0; i < 7; i++) {
        headers.push(DAY_LABELS[(firstDayOfWeek + i) % 7]);
      }
      return headers;
    }, [firstDayOfWeek]);

    const selectDate = React.useCallback(
      (date: Date) => {
        if (isDateDisabled(date, minDate, maxDate, disabledDates)) return;
        setSelectedDate(date);
        setOpen(false);
        inputRef.current?.focus();
      },
      [setSelectedDate, setOpen, minDate, maxDate, disabledDates],
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
    };

    const handleInputBlur = () => {
      // Try to parse the typed text
      const parsed = parseDate(inputText);
      if (parsed && !isDateDisabled(parsed, minDate, maxDate, disabledDates)) {
        setSelectedDate(parsed);
      } else if (!inputText.trim()) {
        setSelectedDate(null);
      } else {
        // Revert to previous value
        setInputText(selectedDate ? formatDate(selectedDate) : '');
      }
      blurTimeoutRef.current = setTimeout(() => setOpen(false), 200);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const parsed = parseDate(inputText);
        if (parsed && !isDateDisabled(parsed, minDate, maxDate, disabledDates)) {
          selectDate(parsed);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleToggleCalendar = () => {
      if (disabled) return;
      setOpen(!open);
      if (!open) {
        const d = selectedDate ?? today;
        setFocusedDay(d);
        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    };

    const navigateMonth = (delta: number) => {
      setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const handleGridKeyDown = (e: React.KeyboardEvent) => {
      if (!focusedDay) return;

      let next: Date | null = null;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          next = new Date(
            focusedDay.getFullYear(),
            focusedDay.getMonth(),
            focusedDay.getDate() + 1,
          );
          break;
        case 'ArrowLeft':
          e.preventDefault();
          next = new Date(
            focusedDay.getFullYear(),
            focusedDay.getMonth(),
            focusedDay.getDate() - 1,
          );
          break;
        case 'ArrowDown':
          e.preventDefault();
          next = new Date(
            focusedDay.getFullYear(),
            focusedDay.getMonth(),
            focusedDay.getDate() + 7,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          next = new Date(
            focusedDay.getFullYear(),
            focusedDay.getMonth(),
            focusedDay.getDate() - 7,
          );
          break;
        case 'PageDown':
          e.preventDefault();
          next = new Date(
            focusedDay.getFullYear(),
            focusedDay.getMonth() + 1,
            focusedDay.getDate(),
          );
          break;
        case 'PageUp':
          e.preventDefault();
          next = new Date(
            focusedDay.getFullYear(),
            focusedDay.getMonth() - 1,
            focusedDay.getDate(),
          );
          break;
        case 'Enter':
          e.preventDefault();
          selectDate(focusedDay);
          return;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          inputRef.current?.focus();
          return;
      }

      if (next) {
        setFocusedDay(next);
        if (!isSameMonth(next, viewMonth)) {
          setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
        }
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedDate(null);
      setInputText('');
      inputRef.current?.focus();
    };

    return (
      <div ref={ref} className={cn('relative inline-flex flex-col', className)} {...rest}>
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'h-8 w-full rounded border border-input bg-background px-3 pr-16 text-sm',
              'focus:outline-none focus:border-b-2 focus:border-b-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
          {clearable && selectedDate && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="absolute right-8 flex h-4 w-4 items-center justify-center text-[#707070] hover:text-foreground"
              aria-label="Clear date"
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
          <button
            type="button"
            onClick={handleToggleCalendar}
            disabled={disabled}
            className="absolute right-2 flex h-4 w-4 items-center justify-center text-[#707070] hover:text-foreground"
            aria-label="Open calendar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        {open && (
          <div
            className="absolute top-full left-0 z-50 mt-1 rounded border border-border bg-background p-3 shadow-4"
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Calendar header */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f5f5f5]"
                aria-label="Previous month"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M7.5 9L4.5 6l3-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <span className="text-sm font-semibold">
                {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f5f5f5]"
                aria-label="Next month"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 3l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {/* Calendar grid */}
            <table
              ref={gridRef}
              id={gridId}
              role="grid"
              tabIndex={0}
              onKeyDown={handleGridKeyDown}
              className="border-collapse"
              aria-label="Calendar"
            >
              <thead>
                <tr>
                  {dayHeaders.map((d) => (
                    <th
                      key={d}
                      className="h-7 w-7 text-center text-xs font-medium text-muted-foreground"
                      scope="col"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }, (_, row) => (
                  <tr key={row}>
                    {calendarDays.slice(row * 7, row * 7 + 7).map((day, col) => {
                      const isCurrentMonth = isSameMonth(day, viewMonth);
                      const isSelected = selectedDate != null && isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, today);
                      const isFocused = focusedDay != null && isSameDay(day, focusedDay);
                      const isDisabled = isDateDisabled(day, minDate, maxDate, disabledDates);

                      return (
                        <td key={col} className="p-0">
                          <button
                            type="button"
                            tabIndex={-1}
                            disabled={isDisabled}
                            onClick={() => selectDate(day)}
                            className={cn(
                              'h-7 w-7 rounded text-xs',
                              'hover:bg-[#f5f5f5]',
                              !isCurrentMonth && 'text-muted-foreground opacity-40',
                              isToday && !isSelected && 'border border-primary',
                              isSelected && 'bg-primary text-white hover:bg-primary',
                              isFocused && !isSelected && 'ring-1 ring-primary',
                              isDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                            )}
                            aria-label={day.toDateString()}
                          >
                            {day.getDate()}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
};
DatePickerRoot.displayName = 'DatePicker';

export const DatePicker = DatePickerRoot;
