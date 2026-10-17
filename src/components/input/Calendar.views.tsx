import * as React from 'react';
import type { DayOfWeek, FirstWeekOfYear } from '../../lib/types';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusableDisabledProps } from '../../lib/aria';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { disabledStyles, focusRing, forcedColors } from '../../lib/styles';
import { getWeekNumber } from '../../lib/date';
import type { CalendarLabels } from './Calendar';
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
  'relative flex h-8 w-8 items-center justify-center rounded bg-transparent p-0 text-caption-1 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover data-[outside]:text-muted-foreground data-[today]:border data-[today]:border-primary data-[today]:font-semibold data-[selected]:bg-primary data-[selected]:font-semibold data-[selected]:text-primary-foreground not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover aria-disabled:line-through';

/** Internal: the stable classes of the day view's parts (see `CalendarDayGridProps.partClassNames`). */
export interface CalendarDayGridPartClassNames {
  /** On the `role="grid"` table. */
  grid?: string;
  /** On each weekday header cell. */
  weekday?: string;
  /** On each day button. */
  day?: string;
  /** On the header cell of the week-number column. */
  weekNumberHeader?: string;
  /** On each week's row header (its number). */
  weekNumber?: string;
  /** On the dot inside the button of a marked day. */
  markedDot?: string;
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
  /**
   * The selected days as ISO dates (`yyyy-mm-dd`): `aria-selected` on their cells, `aria-pressed`
   * and `data-selected` on their buttons.
   */
  selectedDays: ReadonlySet<string>;
  /** Today's day (`aria-current="date"`), or `null` while it is unknown (no day is marked). */
  today: Date | null;
  /** First day of the week, the first column (Home and End move to the row's ends). */
  firstDayOfWeek: DayOfWeek;
  /** BCP 47 locale of the weekday names, the day numbers and the day labels. */
  locale?: string;
  /** Adds a leading column of week numbers. @default false */
  showWeekNumbers?: boolean;
  /** Which week is week 1 of a year. @default 'first-day' */
  firstWeekOfYear?: FirstWeekOfYear;
  /** Returns `true` for days that draw a dot and are named "marked". */
  markedDates?: (date: Date) => boolean;
  /** Replaces the content of a day button (`defaultContent` is the day number). */
  renderDay?: (date: Date, defaultContent: React.ReactNode) => React.ReactNode;
  /** The accessible name of a day, from its default name (marked included). */
  dayLabel?: (date: Date, defaultLabel: string) => string;
  /** Names of the week-number column and the marked days. */
  labels?: CalendarLabels;
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
  selectedDays,
  today,
  firstDayOfWeek,
  locale,
  showWeekNumbers = false,
  firstWeekOfYear = 'first-day',
  markedDates,
  renderDay,
  dayLabel,
  labels,
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
          {showWeekNumbers && (
            // The weekday headers' pattern: a visible symbol hidden from assistive technology and
            // a visually hidden name (an aria-label alone on an empty header fails axe).
            <th
              scope="col"
              className={cn(
                partClassNames?.weekNumberHeader,
                'h-8 w-8 text-center text-caption-1 font-normal text-muted-foreground',
              )}
            >
              <span aria-hidden="true">#</span>
              <span className="sr-only">{labels?.week ?? 'Week'}</span>
            </th>
          )}
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
            {showWeekNumbers && (
              <th
                scope="row"
                aria-label={(labels?.weekNumber ?? defaultWeekNumber)(
                  getWeekNumber(week[0], { firstDayOfWeek, firstWeekOfYear }),
                )}
                className={cn(
                  partClassNames?.weekNumber,
                  'h-8 w-8 text-center text-caption-1 font-normal text-muted-foreground',
                )}
              >
                {getWeekNumber(week[0], { firstDayOfWeek, firstWeekOfYear })}
              </th>
            )}
            {week.map((day, column) => {
              const iso = formatISODate(day);
              const isSelected = selectedDays.has(iso);
              const isMarked = !!markedDates?.(day);
              const number = formatDayNumber(day, locale);
              const baseLabel = formatDayLabel(day, locale);
              const defaultLabel = isMarked
                ? (labels?.markedDay ?? defaultMarkedDay)(baseLabel)
                : baseLabel;
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
                    aria-label={dayLabel ? dayLabel(day, defaultLabel) : defaultLabel}
                    aria-pressed={isSelected || undefined}
                    aria-current={isToday ? 'date' : undefined}
                    {...focusableDisabledProps(unavailable)}
                    data-date={iso}
                    data-selected={isSelected ? '' : undefined}
                    data-today={isToday ? '' : undefined}
                    data-marked={isMarked ? '' : undefined}
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
                    {renderDay ? renderDay(day, number) : number}
                    {isMarked && (
                      // Decorative: the day's name says "marked". It is drawn in the text colour
                      // of the day, so it follows the selected and forced-colors looks.
                      <span
                        aria-hidden="true"
                        className={cn(
                          partClassNames?.markedDot,
                          'pointer-events-none absolute inset-x-0 bottom-0.5 mx-auto h-1 w-1 rounded-full bg-current forced-colors:forced-color-adjust-none',
                        )}
                      />
                    )}
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

const defaultMarkedDay = (dayLabel: string) => `${dayLabel}, marked`;
const defaultWeekNumber = (week: number) => `Week ${week}`;

// The month and year cells: the day buttons' look in a wider cell (C-NATIVE padding and
// background, the gated hover, the selected fill).
const PICKER_CELL_CLASSES =
  'flex h-12 w-14 items-center justify-center rounded bg-transparent p-0 text-caption-1 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover data-[outside]:text-muted-foreground data-[today]:border data-[today]:border-primary data-[today]:font-semibold data-[selected]:bg-primary data-[selected]:font-semibold data-[selected]:text-primary-foreground not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover';

/** The cells of a row of the month and year grids. */
const PICKER_COLUMNS = 4;

/** Internal: one cell of the month or the year grid. */
export interface CalendarPickerCell {
  /** The month (its 1st) or the year (its January 1). */
  date: Date;
  /** The visible text (`Jun`, `2025`). */
  text: string;
  /** The accessible name when it differs from the text (`June 2025`). */
  label?: string;
  /** The value's month or year (`aria-selected` on the cell, `aria-pressed` on the button). */
  selected: boolean;
  /** Today's month or year (`aria-current="date"`). */
  current: boolean;
  /** A year before or after the decade (muted). */
  outside: boolean;
  /** Wholly outside `minDate`/`maxDate`: `aria-disabled`, focusable, not pickable. */
  unavailable: boolean;
}

/** Internal: the stable classes of a month or year grid's parts. */
export interface CalendarPickerGridPartClassNames {
  /** On the `role="grid"` table. */
  grid?: string;
  /** On each cell button. */
  cell?: string;
}

/** Internal props of {@link CalendarPickerGrid}. */
export interface CalendarPickerGridProps {
  /** Id of the table (the header's buttons control it). */
  id: string;
  /** Id of the heading, which labels the table. */
  headingId: string;
  /** The 12 cells, in reading order (3 rows of 4). */
  cells: readonly CalendarPickerCell[];
  /** Index of the roving cell: the only cell button in the tab order. */
  focusIndex: number;
  /** Called with the number of cells a key moves by (arrows, Home and End). */
  onMoveFocus: (delta: number) => void;
  /** Called with the direction of PageUp (`-1`) and PageDown (`1`). */
  onPage: (direction: -1 | 1) => void;
  /** Called when a cell button receives focus (pointer or assistive technology). */
  onCellFocus: (date: Date) => void;
  /** Called with an available cell that is clicked (Enter and Space click the focused button). */
  onPick: (date: Date) => void;
  /** Called before the grid's own key handling (the calendar's Escape levels). */
  onKeyDown?: React.KeyboardEventHandler<HTMLTableElement>;
  /** Stable classes of the grid's parts. */
  partClassNames?: CalendarPickerGridPartClassNames;
  /** Ref to the table. */
  ref?: React.Ref<HTMLTableElement>;
}

/**
 * Internal: the month view (the 12 months of a year) or the year view (a decade with the year
 * before and after it) of a calendar, a `role="grid"` table of 3 rows of 4 cells with one roving
 * button in the tab order. Arrow keys move by a cell and a row (mirrored in RTL), Home/End to the
 * row's ends; PageUp/PageDown are passed to the view. Marked `data-wave-calendar-grid`, as the day
 * grid.
 */
export const CalendarPickerGrid = ({
  id,
  headingId,
  cells,
  focusIndex,
  onMoveFocus,
  onPage,
  onCellFocus,
  onPick,
  onKeyDown,
  partClassNames,
  ref,
}: CalendarPickerGridProps) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const column = focusIndex % PICKER_COLUMNS;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const intent = getArrowIntent(event.key, {
          orientation: 'horizontal',
          dir: getDirection(event.currentTarget),
        });
        event.preventDefault();
        onMoveFocus(intent === 'next' ? 1 : -1);
        return;
      }
      case 'ArrowDown':
        event.preventDefault();
        onMoveFocus(PICKER_COLUMNS);
        return;
      case 'ArrowUp':
        event.preventDefault();
        onMoveFocus(-PICKER_COLUMNS);
        return;
      case 'Home':
        event.preventDefault();
        onMoveFocus(-column);
        return;
      case 'End':
        event.preventDefault();
        onMoveFocus(PICKER_COLUMNS - 1 - column);
        return;
      case 'PageDown':
      case 'PageUp':
        event.preventDefault();
        onPage(event.key === 'PageDown' ? 1 : -1);
        return;
      default:
      // Enter and Space activate the focused cell button natively (click).
    }
  };

  const rows: CalendarPickerCell[][] = [];
  for (let i = 0; i < cells.length; i += PICKER_COLUMNS) {
    rows.push(cells.slice(i, i + PICKER_COLUMNS));
  }

  return (
    <table
      ref={ref}
      id={id}
      role="grid"
      aria-labelledby={headingId}
      data-wave-calendar-grid=""
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      className={cn(partClassNames?.grid, 'border-collapse')}
    >
      <tbody>
        {rows.map((row, rowIndex) => (
          // Keyed by position, so the focused button survives a change of the year or decade.
          <tr key={rowIndex}>
            {row.map((cell, column) => {
              const index = rowIndex * PICKER_COLUMNS + column;
              return (
                <td key={column} role="gridcell" aria-selected={cell.selected} className="p-0">
                  <button
                    type="button"
                    tabIndex={index === focusIndex ? 0 : -1}
                    aria-label={cell.label}
                    aria-pressed={cell.selected || undefined}
                    aria-current={cell.current ? 'date' : undefined}
                    {...focusableDisabledProps(cell.unavailable)}
                    data-selected={cell.selected ? '' : undefined}
                    data-today={cell.current ? '' : undefined}
                    data-outside={cell.outside ? '' : undefined}
                    onFocus={() => onCellFocus(cell.date)}
                    onClick={() => {
                      if (!cell.unavailable) onPick(cell.date);
                    }}
                    className={cn(
                      partClassNames?.cell,
                      PICKER_CELL_CLASSES,
                      focusRing,
                      disabledStyles,
                      cell.selected && forcedColors.selectedLeaf,
                    )}
                  >
                    {cell.text}
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

CalendarPickerGrid.displayName = 'CalendarPickerGrid';
