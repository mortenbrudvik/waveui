import * as React from 'react';
import type { DayOfWeek } from '../../lib/types';
import { cn } from '../../lib/cn';
import { focusableDisabledProps } from '../../lib/aria';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { disabledStyles, focusRing, forcedColors } from '../../lib/styles';
import {
  addDays,
  addMonths,
  formatDayLabel,
  formatDayNumber,
  formatISODate,
  getWeekdayNames,
  isSameDay,
  isSameMonth,
} from './dateUtils';

// An unavailable day stays focusable in the roving grid (`aria-disabled`); the day button adds
// `disabledStyles`, whose dimmed look lifts while the focus ring shows (opacity would dim the ring).
const DAY_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded bg-transparent p-0 text-caption-1 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover data-[outside]:text-muted-foreground data-[today]:border data-[today]:border-primary data-[today]:font-semibold data-[selected]:bg-primary data-[selected]:font-semibold data-[selected]:text-primary-foreground not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover aria-disabled:line-through';

/** Internal: the stable classes of the day view's parts (see `CalendarDayGridProps.partClassNames`). */
export interface CalendarDayGridPartClassNames {
  /** On the `role="grid"` table. */
  grid?: string;
  /** On each weekday header cell. */
  weekday?: string;
  /** On each day button. */
  day?: string;
}

/** Internal props of {@link CalendarDayGrid}. */
export interface CalendarDayGridProps {
  /** Id of the table (the header's month buttons control it). */
  id: string;
  /** Id of the month heading, which labels the table. */
  headingId: string;
  /** The month the grid shows; days of other months are marked `data-outside`. */
  viewMonth: Date;
  /** The 42 days of the grid as 6 weeks. */
  weeks: Date[][];
  /** The roving day: the only day button in the tab order, and the start of the arrow keys. */
  focusTarget: Date;
  /** The selected day (`aria-selected` on its cell, `aria-pressed` on its button). */
  value: Date | null;
  /** Today's day (`aria-current="date"`). */
  today: Date;
  /** First day of the week, the first column (Home and End move to the row's ends). */
  firstDayOfWeek: DayOfWeek;
  /** BCP 47 locale of the weekday names, the day numbers and the day labels. */
  locale?: string;
  /** Whether a day cannot be picked; it stays focusable and is `aria-disabled`. */
  isUnavailable: (date: Date) => boolean;
  /** Called with the day a key moves to (before clamping into the bounds). */
  onMoveFocus: (date: Date) => void;
  /** Called when a day button receives focus (pointer or assistive technology). */
  onDayFocus: (date: Date) => void;
  /** Called with an available day that is clicked (Enter and Space click the focused button). */
  onPick: (date: Date) => void;
  /** Stable classes of the grid's parts, from the component that renders the view. */
  partClassNames?: CalendarDayGridPartClassNames;
  /** Ref to the table. */
  ref?: React.Ref<HTMLTableElement>;
}

/**
 * Internal: the day view of a calendar, a `role="grid"` table of 6 weeks with one roving day
 * button in the tab order. Arrow keys move by day and week (mirrored in RTL), PageUp/PageDown by
 * month, Shift+PageUp/PageDown by year, Home/End to the start and end of the week; Enter and Space
 * click the focused day button. Marked `data-wave-calendar-grid`, so a surrounding focus trap
 * finds its tab stop.
 */
export const CalendarDayGrid = ({
  id,
  headingId,
  viewMonth,
  weeks,
  focusTarget,
  value,
  today,
  firstDayOfWeek,
  locale,
  isUnavailable,
  onMoveFocus,
  onDayFocus,
  onPick,
  partClassNames,
  ref,
}: CalendarDayGridProps) => {
  const weekdays = React.useMemo(
    () => getWeekdayNames(locale, firstDayOfWeek),
    [locale, firstDayOfWeek],
  );
  const focusIso = formatISODate(focusTarget);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const weekOffset = (focusTarget.getDay() - firstDayOfWeek + 7) % 7;
    let next: Date;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const intent = getArrowIntent(event.key, {
          orientation: 'horizontal',
          dir: getDirection(event.currentTarget),
        });
        next = addDays(focusTarget, intent === 'next' ? 1 : -1);
        break;
      }
      case 'ArrowDown':
        next = addDays(focusTarget, 7);
        break;
      case 'ArrowUp':
        next = addDays(focusTarget, -7);
        break;
      case 'PageDown':
        next = addMonths(focusTarget, event.shiftKey ? 12 : 1);
        break;
      case 'PageUp':
        next = addMonths(focusTarget, event.shiftKey ? -12 : -1);
        break;
      case 'Home':
        next = addDays(focusTarget, -weekOffset);
        break;
      case 'End':
        next = addDays(focusTarget, 6 - weekOffset);
        break;
      default:
        // Enter and Space activate the focused day button natively (click).
        return;
    }
    event.preventDefault();
    onMoveFocus(next);
  };

  return (
    <table
      ref={ref}
      id={id}
      role="grid"
      aria-labelledby={headingId}
      data-wave-calendar-grid=""
      onKeyDown={handleKeyDown}
      className={cn(partClassNames?.grid, 'border-collapse')}
    >
      <thead>
        <tr>
          {weekdays.map((weekday) => (
            <th
              key={weekday.long}
              scope="col"
              abbr={weekday.long}
              aria-label={weekday.long}
              className={cn(
                partClassNames?.weekday,
                'h-8 w-8 text-center text-caption-1 font-normal text-muted-foreground',
              )}
            >
              <span aria-hidden="true">{weekday.short}</span>
              <span className="sr-only">{weekday.long}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, row) => (
          // Rows and cells are keyed by position, so the focused button survives a month change
          // and focus stays in the grid while it moves to the new day.
          <tr key={row}>
            {week.map((day, column) => {
              const iso = formatISODate(day);
              const isSelected = isSameDay(day, value);
              const isToday = isSameDay(day, today);
              const isFocused = iso === focusIso;
              const unavailable = isUnavailable(day);
              return (
                <td key={column} role="gridcell" aria-selected={isSelected} className="p-0">
                  {/* Focus rests on the button, and screen readers do not reliably announce the
                      gridcell's aria-selected from inside it: the selected day's button is also
                      pressed. */}
                  <button
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    aria-label={formatDayLabel(day, locale)}
                    aria-pressed={isSelected || undefined}
                    aria-current={isToday ? 'date' : undefined}
                    {...focusableDisabledProps(unavailable)}
                    data-date={iso}
                    data-selected={isSelected ? '' : undefined}
                    data-today={isToday ? '' : undefined}
                    data-outside={isSameMonth(day, viewMonth) ? undefined : ''}
                    onFocus={() => onDayFocus(day)}
                    onClick={() => {
                      if (!unavailable) onPick(day);
                    }}
                    className={cn(
                      partClassNames?.day,
                      DAY_CLASSES,
                      focusRing,
                      disabledStyles,
                      isSelected && forcedColors.selectedLeaf,
                    )}
                  >
                    {formatDayNumber(day, locale)}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

CalendarDayGrid.displayName = 'CalendarDayGrid';
