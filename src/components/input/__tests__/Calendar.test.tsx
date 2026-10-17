import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { Calendar, type CalendarValueChangeDetails } from '../Calendar';
import { calendarClassNames } from '../../../lib/classNames';
import { axe, renderWithProviders, testSystemProps } from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';

/** The clock in every test: Wednesday 18 June 2025, 14:30 local time. */
const NOW = new Date(2025, 5, 18, 14, 30);
/** The `today` prop of the tests that fix it: Thursday 12 June 2025. */
const TODAY = new Date(2025, 5, 12);
const JUNE_15 = new Date(2025, 5, 15);

beforeEach(() => {
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Local calendar fields (TZ-agnostic). */
function fields(date: Date | null | undefined) {
  return date ? [date.getFullYear(), date.getMonth() + 1, date.getDate()] : date;
}

function grid() {
  return screen.getByRole('grid');
}

function dayButton(name: string) {
  return within(grid()).getByRole('button', { name });
}

/** The day buttons in the tab order (the roving tab stop). */
function tabStops(container: ParentNode = grid()) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-date]')).filter(
    (button) => button.getAttribute('tabindex') === '0',
  );
}

function focusedLabel() {
  return document.activeElement?.getAttribute('aria-label');
}

/** The element that labels the grid: the month text (or the year, or the decade). */
function headingElement() {
  const heading = document.getElementById(grid().getAttribute('aria-labelledby') ?? '');
  if (!heading) throw new Error('the grid has no heading');
  return heading;
}

/** The `[data-date]` of the day marked `aria-current="date"`, or `null`. */
function markedToday(container: ParentNode = document) {
  return container.querySelector('[aria-current="date"]')?.getAttribute('data-date') ?? null;
}

const HYDRATION_WARNING =
  '[WaveUI] Calendar: rendered on the server without `today`, `initialVisibleDate` or `value`, ' +
  "so the month shown first comes from the server's clock and the browser may show another " +
  'month. Pass `today` or `initialVisibleDate`.';

describe('Calendar', () => {
  testSystemProps(Calendar, {
    expectedTag: 'div',
    displayName: 'Calendar',
    defaultProps: { 'aria-label': 'Due date', today: TODAY },
    a11yVariants: [
      { name: 'selected', props: { defaultValue: JUNE_15 } },
      {
        name: 'bounded and required',
        props: { minDate: new Date(2025, 5, 5), required: true, name: 'due' },
      },
    ],
  });

  describe('structure', () => {
    it('is a named group around the month header and the day grid', () => {
      render(<Calendar aria-label="Due date" today={TODAY} locale="en-US" />);
      const group = screen.getByRole('group', { name: 'Due date' });
      expect(within(group).getByRole('grid', { name: 'June 2025' })).toBeInTheDocument();
      expect(within(group).getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
      expect(within(group).getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    });

    it('renders the month text in a live div, not a heading, which labels the grid', () => {
      render(<Calendar aria-label="Due date" today={TODAY} locale="en-US" />);
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      const heading = headingElement();
      expect(heading.tagName).toBe('DIV');
      expect(heading).toHaveTextContent('June 2025');
      expect(heading).toHaveAttribute('aria-live', 'polite');
      expect(grid()).toHaveAccessibleName('June 2025');
    });

    it('keeps the month text plain with showMonthPicker={false}', () => {
      render(
        <Calendar aria-label="Due date" today={TODAY} locale="en-US" showMonthPicker={false} />,
      );
      expect(screen.queryByRole('button', { name: 'June 2025' })).not.toBeInTheDocument();
      expect(screen.getByText('June 2025')).toBe(headingElement());
      expect(screen.queryByText('Choose a month')).not.toBeInTheDocument();
    });

    it('localizes the month buttons with labels', () => {
      render(
        <Calendar
          aria-label="Due date"
          today={TODAY}
          labels={{ previousMonth: 'Vorheriger Monat', nextMonth: 'Nächster Monat' }}
        />,
      );
      expect(screen.getByRole('button', { name: 'Vorheriger Monat' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nächster Monat' })).toBeInTheDocument();
    });

    it('orders the tab stops: previous month, the heading button, next month, then one day of the grid', async () => {
      const user = userEvent.setup();
      render(<Calendar aria-label="Due date" today={TODAY} locale="en-US" />);
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName('Previous month');
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName('June 2025');
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName('Next month');
      await user.tab();
      expect(focusedLabel()).toBe('Thursday, June 12, 2025');
      await user.tab();
      expect(document.body).toHaveFocus();
    });
  });

  describe('grid keyboard (the 0.7 DatePicker cases)', () => {
    function renderOn(date: Date, props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const utils = render(
        <Calendar
          aria-label="Date"
          locale="en-US"
          today={TODAY}
          defaultValue={date}
          onValueChange={onValueChange}
          {...props}
        />,
      );
      const [stop] = tabStops();
      act(() => stop.focus());
      return { user, onValueChange, ...utils };
    }

    it('arrows move focus by a day and a week', async () => {
      const { user } = renderOn(JUNE_15);
      await user.keyboard('{ArrowRight}');
      expect(focusedLabel()).toBe('Monday, June 16, 2025');
      await user.keyboard('{ArrowDown}');
      expect(focusedLabel()).toBe('Monday, June 23, 2025');
      await user.keyboard('{ArrowLeft}');
      expect(focusedLabel()).toBe('Sunday, June 22, 2025');
      await user.keyboard('{ArrowUp}');
      expect(focusedLabel()).toBe('Sunday, June 15, 2025');
    });

    it('keeps one tab stop on the focused day and none on the grid', () => {
      renderOn(JUNE_15);
      expect(grid()).not.toHaveAttribute('tabindex');
      const stops = tabStops();
      expect(stops).toHaveLength(1);
      expect(stops[0]).toHaveAccessibleName('Sunday, June 15, 2025');
    });

    it('crossing a month boundary changes the month text', async () => {
      const { user } = renderOn(new Date(2025, 5, 30));
      await user.keyboard('{ArrowRight}');
      expect(focusedLabel()).toBe('Tuesday, July 1, 2025');
      expect(grid()).toHaveAccessibleName('July 2025');
    });

    it('PageDown/PageUp clamp the day to the target month', async () => {
      const { user, unmount } = renderOn(new Date(2025, 0, 31));
      await user.keyboard('{PageDown}');
      expect(focusedLabel()).toBe('Friday, February 28, 2025');
      unmount();
      const second = renderOn(new Date(2025, 2, 31));
      await second.user.keyboard('{PageUp}');
      expect(focusedLabel()).toBe('Friday, February 28, 2025');
    });

    it('Shift+PageDown/PageUp move by a year with the same clamp', async () => {
      const { user } = renderOn(new Date(2024, 1, 29));
      await user.keyboard('{Shift>}{PageDown}{/Shift}');
      expect(focusedLabel()).toBe('Friday, February 28, 2025');
      await user.keyboard('{Shift>}{PageUp}{/Shift}');
      expect(focusedLabel()).toBe('Wednesday, February 28, 2024');
    });

    it('Home/End go to the start/end of the week (Sunday first)', async () => {
      const { user } = renderOn(new Date(2025, 5, 18));
      await user.keyboard('{Home}');
      expect(focusedLabel()).toBe('Sunday, June 15, 2025');
      await user.keyboard('{End}');
      expect(focusedLabel()).toBe('Saturday, June 21, 2025');
    });

    it('Home/End follow firstDayOfWeek', async () => {
      const { user } = renderOn(JUNE_15, { firstDayOfWeek: 1 });
      await user.keyboard('{Home}');
      expect(focusedLabel()).toBe('Monday, June 9, 2025');
      await user.keyboard('{End}');
      expect(focusedLabel()).toBe('Sunday, June 15, 2025');
    });

    it('mirrors ArrowLeft/ArrowRight in RTL', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <Calendar aria-label="Date" locale="en-US" today={TODAY} defaultValue={JUNE_15} />,
        { dir: 'rtl' },
      );
      act(() => tabStops()[0].focus());
      await user.keyboard('{ArrowLeft}');
      expect(focusedLabel()).toBe('Monday, June 16, 2025');
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(focusedLabel()).toBe('Saturday, June 14, 2025');
    });

    it('Enter selects the focused day and Space selects like Enter', async () => {
      const { user, onValueChange } = renderOn(JUNE_15);
      await user.keyboard('{ArrowRight}{Enter}');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 6, 16]);
      expect(dayButton('Monday, June 16, 2025')).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('{ArrowRight} ');
      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(fields(onValueChange.mock.calls[1][0] as Date)).toEqual([2025, 6, 17]);
      expect(dayButton('Tuesday, June 17, 2025')).toHaveFocus();
    });

    it('does not select an unavailable day, which stays focusable', async () => {
      const { user, onValueChange } = renderOn(JUNE_15, {
        disabledDates: (d) => d.getDate() === 16,
      });
      await user.keyboard('{ArrowRight}{Enter}');
      expect(dayButton('Monday, June 16, 2025')).toHaveFocus();
      expect(dayButton('Monday, June 16, 2025')).toHaveAttribute('aria-disabled', 'true');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('keyboard focus stays within minDate/maxDate', async () => {
      const { user } = renderOn(new Date(2025, 5, 19), {
        minDate: new Date(2025, 5, 10),
        maxDate: new Date(2025, 5, 20),
      });
      await user.keyboard('{ArrowDown}');
      expect(focusedLabel()).toBe('Friday, June 20, 2025');
      await user.keyboard('{PageUp}');
      expect(focusedLabel()).toBe('Tuesday, June 10, 2025');
      expect(screen.getByRole('button', { name: 'Previous month' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('the month buttons move the focused day by the same number of months', async () => {
      const { user } = renderOn(JUNE_15);
      await user.click(screen.getByRole('button', { name: 'Next month' }));
      expect(grid()).toHaveAccessibleName('July 2025');
      expect(tabStops()[0]).toHaveAccessibleName('Tuesday, July 15, 2025');
    });
  });

  describe('value (D25)', () => {
    it('emits the picked day as local midnight with details.range, only on change', async () => {
      const user = userEvent.setup();
      const onValueChange =
        vi.fn<(date: Date | null, details?: CalendarValueChangeDetails) => void>();
      render(
        <Calendar
          aria-label="Date"
          locale="en-US"
          today={TODAY}
          defaultValue={new Date(2025, 5, 15, 9, 45)}
          onValueChange={onValueChange}
        />,
      );
      await user.click(dayButton('Sunday, June 15, 2025'));
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [date, details] = onValueChange.mock.calls[0];
      expect(date?.getTime()).toBe(new Date(2025, 5, 20).getTime());
      expect(details?.range.map((day) => day.getTime())).toEqual([new Date(2025, 5, 20).getTime()]);
      expect(dayButton('Friday, June 20, 2025')).toHaveAttribute('aria-pressed', 'true');
      expect(dayButton('Sunday, June 15, 2025')).not.toHaveAttribute('aria-pressed');
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('fires once per pick in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Calendar
            aria-label="Date"
            locale="en-US"
            today={TODAY}
            defaultValue={JUNE_15}
            onValueChange={onValueChange}
          />
        </React.StrictMode>,
      );
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('a controlled value only changes through the parent', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Calendar
          aria-label="Date"
          locale="en-US"
          today={TODAY}
          value={JUNE_15}
          onValueChange={onValueChange}
        />,
      );
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(dayButton('Sunday, June 15, 2025')).toHaveAttribute('aria-pressed', 'true');
      expect(dayButton('Friday, June 20, 2025')).not.toHaveAttribute('aria-pressed');
    });

    it('shows the month of a controlled value that moves to another month', () => {
      const { rerender } = render(
        <Calendar aria-label="Date" locale="en-US" today={TODAY} value={JUNE_15} />,
      );
      expect(grid()).toHaveAccessibleName('June 2025');
      rerender(
        <Calendar aria-label="Date" locale="en-US" today={TODAY} value={new Date(2025, 7, 4)} />,
      );
      expect(grid()).toHaveAccessibleName('August 2025');
      expect(tabStops()[0]).toHaveAccessibleName('Monday, August 4, 2025');
      expect(dayButton('Monday, August 4, 2025')).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps the shown month when a controlled value moves within it or to null', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Calendar aria-label="Date" locale="en-US" today={TODAY} value={JUNE_15} />,
      );
      await user.click(screen.getByRole('button', { name: 'Next month' }));
      expect(grid()).toHaveAccessibleName('July 2025');
      rerender(<Calendar aria-label="Date" locale="en-US" today={TODAY} value={null} />);
      expect(grid()).toHaveAccessibleName('July 2025');
      rerender(
        <Calendar aria-label="Date" locale="en-US" today={TODAY} value={new Date(2025, 6, 9)} />,
      );
      expect(grid()).toHaveAccessibleName('July 2025');
      expect(dayButton('Wednesday, July 9, 2025')).toHaveAttribute('aria-pressed', 'true');
    });

    it('a picked day of the next month shows that month and keeps focus on it', async () => {
      const user = userEvent.setup();
      render(<Calendar aria-label="Date" locale="en-US" today={TODAY} defaultValue={JUNE_15} />);
      await user.click(dayButton('Tuesday, July 1, 2025'));
      expect(grid()).toHaveAccessibleName('July 2025');
      expect(dayButton('Tuesday, July 1, 2025')).toHaveFocus();
      expect(dayButton('Tuesday, July 1, 2025')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('forms (D35)', () => {
    it('submits the ISO yyyy-mm-dd value under its name', () => {
      render(
        <form aria-label="Form">
          <Calendar
            aria-label="Date"
            today={TODAY}
            name="due"
            defaultValue={new Date(2025, 3, 3, 23, 30)}
          />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(new FormData(form).get('due')).toBe('2025-04-03');
    });

    it('adds nothing to FormData without a name', () => {
      render(
        <form aria-label="Form">
          <Calendar aria-label="Date" today={TODAY} defaultValue={JUNE_15} />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
    });

    it('resets to its default with the form and emits the restored range', async () => {
      const user = userEvent.setup();
      const onValueChange =
        vi.fn<(date: Date | null, details?: CalendarValueChangeDetails) => void>();
      render(
        <form aria-label="Form">
          <Calendar
            aria-label="Date"
            locale="en-US"
            today={TODAY}
            name="due"
            defaultValue={new Date(2025, 5, 15, 14, 30)}
            onValueChange={onValueChange}
          />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      act(() => form.reset());
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(new FormData(form).get('due')).toBe('2025-06-20');
      onValueChange.mockClear();
      act(() => form.reset());
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [date, details] = onValueChange.mock.calls[0];
      expect(date?.getTime()).toBe(new Date(2025, 5, 15).getTime());
      expect(details?.range.map((day) => day.getTime())).toEqual([new Date(2025, 5, 15).getTime()]);
      expect(new FormData(form).get('due')).toBe('2025-06-15');
      expect(dayButton('Sunday, June 15, 2025')).toHaveAttribute('aria-pressed', 'true');
    });

    it('emits the restored range once per form reset in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange =
        vi.fn<(date: Date | null, details?: CalendarValueChangeDetails) => void>();
      render(
        <React.StrictMode>
          <form aria-label="Form">
            <Calendar
              aria-label="Date"
              locale="en-US"
              today={TODAY}
              defaultValue={JUNE_15}
              onValueChange={onValueChange}
            />
          </form>
        </React.StrictMode>,
      );
      await user.click(dayButton('Friday, June 20, 2025'));
      onValueChange.mockClear();
      act(() => (screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).reset());
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [date, details] = onValueChange.mock.calls[0];
      expect(date?.getTime()).toBe(JUNE_15.getTime());
      expect(details?.range.map((day) => day.getTime())).toEqual([JUNE_15.getTime()]);
    });

    it('a reset without a default emits null with an empty range', async () => {
      const user = userEvent.setup();
      const onValueChange =
        vi.fn<(date: Date | null, details?: CalendarValueChangeDetails) => void>();
      render(
        <form aria-label="Form">
          <Calendar aria-label="Date" locale="en-US" today={TODAY} onValueChange={onValueChange} />
        </form>,
      );
      await user.click(dayButton('Friday, June 20, 2025'));
      onValueChange.mockClear();
      act(() => (screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).reset());
      expect(onValueChange.mock.calls).toEqual([[null, { range: [] }]]);
    });

    it('blocks submission while required and empty, and focuses the tab stop', () => {
      render(
        <form aria-label="Form">
          <Calendar aria-label="Date" locale="en-US" today={TODAY} name="due" required />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
      expect(screen.getByRole('group', { name: 'Date' })).not.toHaveAttribute('aria-required');
      act(() => {
        form.reportValidity();
      });
      expect(dayButton('Thursday, June 12, 2025')).toHaveFocus();
    });

    it('a required calendar with a value submits', () => {
      render(
        <form aria-label="Form">
          <Calendar aria-label="Date" today={TODAY} required defaultValue={JUNE_15} />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });

    it('says "Required" in its description instead of aria-required', () => {
      render(<Calendar aria-label="Date" today={TODAY} required />);
      const group = screen.getByRole('group', { name: 'Date' });
      expect(group).toHaveAccessibleDescription('Required');
      expect(group).not.toHaveAttribute('aria-required');
    });

    it('localizes the required hint and drops a consumer aria-required', () => {
      render(
        <Calendar
          aria-label="Datum"
          aria-required="true"
          today={TODAY}
          labels={{ required: 'Pflichtfeld' }}
        />,
      );
      const group = screen.getByRole('group', { name: 'Datum' });
      expect(group).toHaveAccessibleDescription('Pflichtfeld');
      expect(group).not.toHaveAttribute('aria-required');
    });
  });

  describe('Field (D35, C-ROUTING)', () => {
    it('takes the label, the description, aria-invalid and the required hint on the group', () => {
      renderWithFieldContext(<Calendar today={TODAY} locale="en-US" />, {
        hintId: FIELD_TEST_IDS.hintId,
        errorId: FIELD_TEST_IDS.errorId,
        required: true,
      });
      const group = screen.getByRole('group', { name: FIELD_TEST_TEXT.label });
      expect(group).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
      expect(group).toHaveAccessibleDescription(
        `${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint} Required`,
      );
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(group).not.toHaveAttribute('aria-required');
    });

    it('a required Field blocks submission; an explicit required={false} wins', () => {
      const { rerender } = renderWithFieldContext(
        <form aria-label="Form">
          <Calendar today={TODAY} />
        </form>,
        { required: true },
      );
      const form = () => screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form().checkValidity()).toBe(false);
      rerender(
        <form aria-label="Form">
          <Calendar today={TODAY} required={false} />
        </form>,
      );
      expect(form().checkValidity()).toBe(true);
      expect(
        screen.getByRole('group', { name: FIELD_TEST_TEXT.label }),
      ).not.toHaveAccessibleDescription();
    });
  });

  describe('today and SSR (D28)', () => {
    it('marks the today prop and makes it the tab stop without a value', () => {
      render(<Calendar aria-label="Date" locale="en-US" today={TODAY} />);
      const today = dayButton('Thursday, June 12, 2025');
      expect(today).toHaveAttribute('aria-current', 'date');
      expect(today).toHaveAttribute('data-today');
      expect(markedToday()).toBe('2025-06-12');
      expect(tabStops()).toEqual([today]);
    });

    it('marks the current date without the prop in a client render', () => {
      render(<Calendar aria-label="Date" locale="en-US" />);
      expect(grid()).toHaveAccessibleName('June 2025');
      expect(markedToday()).toBe('2025-06-18');
      expect(tabStops()[0]).toHaveAccessibleName('Wednesday, June 18, 2025');
    });

    it('marks no day in the server HTML without the today prop', () => {
      const host = document.createElement('div');
      host.innerHTML = renderToString(
        <Calendar aria-label="Date" locale="en-US" initialVisibleDate={new Date(2025, 5, 1)} />,
      );
      expect(markedToday(host)).toBeNull();
      expect(host.querySelector('[data-today]')).toBeNull();
      // The tab stop is the first available day of the month, not today.
      expect(tabStops(host).map((button) => button.dataset.date)).toEqual(['2025-06-01']);
    });

    it('server HTML: the tab stop is the selected day in the month, else the first available day', () => {
      const host = document.createElement('div');
      host.innerHTML = renderToString(
        <>
          <Calendar aria-label="Selected" locale="en-US" defaultValue={JUNE_15} />
          <Calendar
            aria-label="Bounded"
            locale="en-US"
            initialVisibleDate={new Date(2025, 5, 1)}
            minDate={new Date(2025, 5, 10)}
          />
        </>,
      );
      const [selected, bounded] = Array.from(host.querySelectorAll('[role="group"]'));
      expect(tabStops(selected).map((button) => button.dataset.date)).toEqual(['2025-06-15']);
      expect(tabStops(bounded).map((button) => button.dataset.date)).toEqual(['2025-06-10']);
    });

    it('marks the today prop in the server HTML', () => {
      const host = document.createElement('div');
      host.innerHTML = renderToString(<Calendar aria-label="Date" locale="en-US" today={TODAY} />);
      expect(markedToday(host)).toBe('2025-06-12');
    });

    it('treats today as unknown until hydration without the today prop', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2025, 5, 29, 23, 30));
      const html = renderToString(
        <Calendar aria-label="Due date" initialVisibleDate={new Date(2025, 5, 1)} />,
      );
      expect(html).not.toContain('aria-current');
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        vi.setSystemTime(new Date(2025, 5, 30, 1, 30)); // another day in the browser
        const errors = vi.spyOn(console, 'error');
        await act(async () => {
          root = hydrateRoot(
            container,
            <Calendar aria-label="Due date" initialVisibleDate={new Date(2025, 5, 1)} />,
          );
        });
        expect(errors).not.toHaveBeenCalled();
        expect(container.querySelector('[aria-current="date"]')).toHaveAttribute(
          'data-date',
          '2025-06-30',
        );
        expect(tabStops(container).map((button) => button.dataset.date)).toEqual(['2025-06-30']);
      } finally {
        act(() => root?.unmount());
        container.remove();
        vi.useRealTimers();
      }
    });

    it('warns after a hydration render without today, initialVisibleDate or value', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ui = (
        <>
          <Calendar aria-label="No date" locale="en-US" />
          <Calendar aria-label="Today" locale="en-US" today={TODAY} />
          <Calendar aria-label="Visible" locale="en-US" initialVisibleDate={TODAY} />
          <Calendar aria-label="Value" locale="en-US" defaultValue={JUNE_15} />
        </>
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(ui);
      document.body.appendChild(container);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, ui);
        });
        expect(warn.mock.calls).toEqual([[HYDRATION_WARNING]]);
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('does not warn without a date in a client render', () => {
      const warn = vi.spyOn(console, 'warn');
      render(<Calendar aria-label="Date" locale="en-US" />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('the month shown first (D28)', () => {
    it('shows initialVisibleDate when there is no value', () => {
      render(
        <Calendar
          aria-label="Date"
          locale="en-US"
          today={TODAY}
          initialVisibleDate={new Date(2025, 9, 20)}
        />,
      );
      expect(grid()).toHaveAccessibleName('October 2025');
      // Today is not in October: the tab stop is the first day of the month.
      expect(tabStops()[0]).toHaveAccessibleName('Wednesday, October 1, 2025');
    });

    it('the value wins over initialVisibleDate', () => {
      render(
        <Calendar
          aria-label="Date"
          locale="en-US"
          today={TODAY}
          defaultValue={JUNE_15}
          initialVisibleDate={new Date(2025, 9, 20)}
        />,
      );
      expect(grid()).toHaveAccessibleName('June 2025');
    });

    it('initialVisibleDate wins over today', () => {
      render(
        <Calendar
          aria-label="Date"
          locale="en-US"
          today={TODAY}
          initialVisibleDate={new Date(2025, 2, 1)}
        />,
      );
      expect(grid()).toHaveAccessibleName('March 2025');
    });

    it.each([
      [
        'before minDate',
        { minDate: new Date(2025, 10, 5) },
        'November 2025',
        'Wednesday, November 5, 2025',
      ],
      [
        'after maxDate',
        { maxDate: new Date(2025, 1, 14) },
        'February 2025',
        'Friday, February 14, 2025',
      ],
    ])('clamps initialVisibleDate %s into the bounds', (_, bounds, month, stop) => {
      render(
        <Calendar
          aria-label="Date"
          locale="en-US"
          today={TODAY}
          initialVisibleDate={new Date(2025, 5, 1)}
          {...bounds}
        />,
      );
      expect(grid()).toHaveAccessibleName(month);
      expect(tabStops()[0]).toHaveAccessibleName(stop);
    });

    it('clamps today into the bounds without a value or initialVisibleDate', () => {
      render(
        <Calendar aria-label="Date" locale="en-US" today={TODAY} minDate={new Date(2025, 8, 3)} />,
      );
      expect(grid()).toHaveAccessibleName('September 2025');
      expect(tabStops()[0]).toHaveAccessibleName('Wednesday, September 3, 2025');
    });
  });

  describe('the heading button (D26)', () => {
    it('is named by the month text and described by a hidden hint outside the heading', () => {
      render(<Calendar aria-label="Due date" today={TODAY} locale="en-US" />);
      const button = screen.getByRole('button', { name: 'June 2025' });
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAccessibleDescription('Choose a month');
      const hint = document.getElementById(button.getAttribute('aria-describedby') ?? '');
      expect(hint).toHaveAttribute('hidden');
      const heading = headingElement();
      expect(heading).toContainElement(button);
      expect(heading).not.toContainElement(hint);
      expect(heading).toHaveAttribute('aria-live', 'polite');
      expect(grid()).toHaveAccessibleName('June 2025');
    });

    it('localizes the hints with labels.chooseMonth and labels.chooseYear', async () => {
      const user = userEvent.setup();
      render(
        <Calendar
          aria-label="Datum"
          today={TODAY}
          locale="de-DE"
          labels={{ chooseMonth: 'Monat wählen', chooseYear: 'Jahr wählen' }}
        />,
      );
      const button = screen.getByRole('button', { name: 'Juni 2025' });
      expect(button).toHaveAccessibleDescription('Monat wählen');
      await user.click(button);
      expect(screen.getByRole('button', { name: '2025' })).toHaveAccessibleDescription(
        'Jahr wählen',
      );
    });
  });

  describe('month and year views (D26, D27)', () => {
    function renderCalendar(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const utils = render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
          {...props}
        />,
      );
      return { user, onValueChange, ...utils };
    }

    function group() {
      return screen.getByRole('group', { name: 'Due date' });
    }

    /** Focus is on an element of the calendar, never on `<body>`. */
    function expectFocusInCalendar() {
      expect(document.activeElement).not.toBe(document.body);
      expect(group()).toContainElement(document.activeElement as HTMLElement);
    }

    /** The focused cell of the grid (the active element, which must be in the grid). */
    function expectFocusedCell(name: string) {
      expectFocusInCalendar();
      expect(grid()).toContainElement(document.activeElement as HTMLElement);
      expect(document.activeElement).toHaveAccessibleName(name);
    }

    function cell(name: string) {
      return within(grid()).getByRole('button', { name });
    }

    const DECADE_2020 = /^2020\s*–\s*2029$/;
    const DECADE_2030 = /^2030\s*–\s*2039$/;
    const DECADE_2010 = /^2010\s*–\s*2019$/;

    /** Opens the month view from the day view's heading button. */
    async function openMonths(user: ReturnType<typeof userEvent.setup>, heading = 'June 2025') {
      await user.click(screen.getByRole('button', { name: heading }));
    }

    /** Opens the year view from the month view's heading button. */
    async function openYears(user: ReturnType<typeof userEvent.setup>, heading = '2025') {
      await user.click(screen.getByRole('button', { name: heading }));
    }

    /** Records `defaultPrevented` of every Escape that reaches the document. */
    function trackEscapes() {
      const seen: boolean[] = [];
      const listener = (event: KeyboardEvent) => {
        if (event.key === 'Escape') seen.push(event.defaultPrevented);
      };
      document.addEventListener('keydown', listener);
      onTestFinished(() => document.removeEventListener('keydown', listener));
      return seen;
    }

    it('the heading button shows the month view and focuses the month of the focused day', async () => {
      const { user } = renderCalendar();
      await user.click(screen.getByRole('button', { name: 'Next month' }));
      await openMonths(user, 'July 2025');
      expect(grid()).toHaveAccessibleName('2025');
      expectFocusedCell('July 2025');
      expect(within(grid()).getAllByRole('gridcell')).toHaveLength(12);
      expect(within(grid()).getAllByRole('row')).toHaveLength(3);
      expect(cell('July 2025')).toHaveTextContent('Jul');
      expect(cell('July 2025')).toHaveAttribute('tabindex', '0');
      expect(
        within(grid())
          .getAllByRole('button')
          .filter((button) => button.tabIndex === 0),
      ).toHaveLength(1);
      // The header moves by a year, and its heading button leads to the year view.
      expect(screen.getByRole('button', { name: 'Previous year' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next year' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2025' })).toHaveAccessibleDescription(
        'Choose a year',
      );
      expect(headingElement()).toHaveAttribute('aria-live', 'polite');
      expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
    });

    it('marks the selected month (aria-selected, aria-pressed) and the current month', async () => {
      const { user } = renderCalendar({ defaultValue: new Date(2025, 2, 3) });
      await openMonths(user, 'March 2025');
      const march = cell('March 2025');
      expect(march.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true');
      expect(march).toHaveAttribute('aria-pressed', 'true');
      expect(march).toHaveAttribute('data-selected');
      expect(cell('June 2025')).toHaveAttribute('aria-current', 'date');
      expect(cell('June 2025')).not.toHaveAttribute('aria-pressed');
      expect(cell('June 2025').closest('[role="gridcell"]')).toHaveAttribute(
        'aria-selected',
        'false',
      );
      expect(within(grid()).getAllByRole('button', { current: 'date' })).toHaveLength(1);
    });

    it('moves between months with the arrows, Home/End and PageUp/PageDown', async () => {
      const { user } = renderCalendar();
      await openMonths(user);
      expectFocusedCell('June 2025');
      await user.keyboard('{ArrowRight}');
      expectFocusedCell('July 2025');
      await user.keyboard('{ArrowDown}');
      expectFocusedCell('November 2025');
      await user.keyboard('{ArrowLeft}');
      expectFocusedCell('October 2025');
      await user.keyboard('{ArrowUp}');
      expectFocusedCell('June 2025');
      await user.keyboard('{Home}');
      expectFocusedCell('May 2025');
      await user.keyboard('{End}');
      expectFocusedCell('August 2025');
      await user.keyboard('{PageDown}');
      expectFocusedCell('August 2026');
      expect(grid()).toHaveAccessibleName('2026');
      await user.keyboard('{PageUp}{PageUp}');
      expectFocusedCell('August 2024');
      expect(grid()).toHaveAccessibleName('2024');
      // Crossing the end of a year shows the next one.
      await user.keyboard('{ArrowDown}{ArrowRight}');
      expectFocusedCell('January 2025');
      expect(grid()).toHaveAccessibleName('2025');
      await user.keyboard('{ArrowUp}');
      expectFocusedCell('September 2024');
    });

    it('mirrors ArrowLeft/ArrowRight in RTL in the month and year views', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <Calendar aria-label="Due date" locale="en-US" today={TODAY} defaultValue={JUNE_15} />,
        { dir: 'rtl' },
      );
      await openMonths(user);
      await user.keyboard('{ArrowLeft}');
      expectFocusedCell('July 2025');
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expectFocusedCell('May 2025');
      await openYears(user);
      await user.keyboard('{ArrowLeft}');
      expectFocusedCell('2026');
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expectFocusedCell('2024');
    });

    it('a month pick shows its days, keeping the day of the month clamped to the month', async () => {
      const { user, onValueChange } = renderCalendar({ defaultValue: new Date(2025, 0, 31) });
      await openMonths(user, 'January 2025');
      await user.keyboard('{ArrowRight}{Enter}');
      expect(grid()).toHaveAccessibleName('February 2025');
      expect(focusedLabel()).toBe('Friday, February 28, 2025');
      expectFocusInCalendar();
      expect(tabStops()).toHaveLength(1);
      // A click picks too; picking selects no day.
      await openMonths(user, 'February 2025');
      await user.click(cell('April 2025'));
      expect(grid()).toHaveAccessibleName('April 2025');
      expect(focusedLabel()).toBe('Monday, April 28, 2025');
      expectFocusInCalendar();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('a month pick clamps the day into minDate/maxDate', async () => {
      const { user } = renderCalendar({
        defaultValue: new Date(2025, 0, 31),
        maxDate: new Date(2025, 1, 20),
      });
      await openMonths(user, 'January 2025');
      await user.click(cell('February 2025'));
      expect(grid()).toHaveAccessibleName('February 2025');
      expect(focusedLabel()).toBe('Thursday, February 20, 2025');
    });

    it('the year view shows the decade with the year before and after, and its keys', async () => {
      const { user } = renderCalendar();
      await openMonths(user);
      await openYears(user);
      expect(grid()).toHaveAccessibleName(DECADE_2020);
      expect(headingElement()).toHaveTextContent(DECADE_2020);
      expect(headingElement()).toHaveAttribute('aria-live', 'polite');
      // The decade heading is text: no button, no hint.
      expect(within(headingElement()).queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText('Choose a year')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous decade' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next decade' })).toBeInTheDocument();
      const years = within(grid()).getAllByRole('button');
      expect(years.map((year) => year.textContent)).toEqual([
        '2019',
        '2020',
        '2021',
        '2022',
        '2023',
        '2024',
        '2025',
        '2026',
        '2027',
        '2028',
        '2029',
        '2030',
      ]);
      expect(cell('2019')).toHaveAttribute('data-outside');
      expect(cell('2030')).toHaveAttribute('data-outside');
      expect(cell('2020')).not.toHaveAttribute('data-outside');
      expect(cell('2025')).toHaveAttribute('aria-pressed', 'true');
      expect(cell('2025')).toHaveAttribute('aria-current', 'date');
      expectFocusedCell('2025');
      await user.keyboard('{ArrowRight}');
      expectFocusedCell('2026');
      await user.keyboard('{ArrowDown}');
      expectFocusedCell('2030');
      expect(grid()).toHaveAccessibleName(DECADE_2020);
      await user.keyboard('{ArrowRight}');
      expectFocusedCell('2031');
      expect(grid()).toHaveAccessibleName(DECADE_2030);
      await user.keyboard('{Home}');
      expectFocusedCell('2029');
      expect(grid()).toHaveAccessibleName(DECADE_2030);
      await user.keyboard('{PageUp}');
      expectFocusedCell('2019');
      expect(grid()).toHaveAccessibleName(DECADE_2020);
      await user.keyboard('{End}');
      expectFocusedCell('2022');
      await user.keyboard('{ArrowUp}');
      expectFocusedCell('2018');
      expect(grid()).toHaveAccessibleName(DECADE_2010);
      await user.keyboard('{PageDown}{PageDown}');
      expectFocusedCell('2038');
      expect(grid()).toHaveAccessibleName(DECADE_2030);
    });

    it('a year pick shows its months with the same month focused', async () => {
      const { user } = renderCalendar();
      await openMonths(user);
      await user.keyboard('{ArrowRight}');
      await openYears(user);
      expectFocusedCell('2025');
      await user.keyboard('{ArrowRight}{ArrowRight}{Enter}');
      expect(grid()).toHaveAccessibleName('2027');
      expectFocusedCell('July 2027');
      await openYears(user, '2027');
      await user.click(cell('2021'));
      expect(grid()).toHaveAccessibleName('2021');
      expectFocusedCell('July 2021');
      await user.keyboard('{Enter}');
      expect(grid()).toHaveAccessibleName('July 2021');
      expect(focusedLabel()).toBe('Thursday, July 15, 2021');
    });

    it('the header buttons move by a year and by a decade', async () => {
      const { user } = renderCalendar();
      await openMonths(user);
      await user.click(screen.getByRole('button', { name: 'Next year' }));
      expect(grid()).toHaveAccessibleName('2026');
      expect(within(grid()).getByRole('button', { name: 'June 2026' })).toHaveAttribute(
        'tabindex',
        '0',
      );
      await openYears(user, '2026');
      await user.click(screen.getByRole('button', { name: 'Previous decade' }));
      expect(grid()).toHaveAccessibleName(DECADE_2010);
      expect(cell('2016')).toHaveAttribute('tabindex', '0');
      expectFocusInCalendar();
    });

    it('Escape goes from the years to the months to the days, each showing its period before drilling up', async () => {
      const escapes = trackEscapes();
      const { user } = renderCalendar();
      await openMonths(user);
      await user.keyboard('{PageDown}');
      expectFocusedCell('June 2026');
      await openYears(user, '2026');
      await user.keyboard('{PageDown}{ArrowRight}');
      expectFocusedCell('2037');
      await user.keyboard('{Escape}');
      expect(grid()).toHaveAccessibleName('2026');
      expectFocusedCell('June 2026');
      await user.keyboard('{ArrowRight}{Escape}');
      expect(grid()).toHaveAccessibleName('June 2025');
      expectFocusedCell('Sunday, June 15, 2025');
      expect(escapes).toEqual([true, true]);
      // In the day view Escape is not the calendar's.
      await user.keyboard('{Escape}');
      expect(escapes).toEqual([true, true, false]);
      expect(grid()).toHaveAccessibleName('June 2025');
    });

    it('Escape on a header button of the month view goes back too', async () => {
      const escapes = trackEscapes();
      const { user } = renderCalendar();
      await openMonths(user);
      act(() => screen.getByRole('button', { name: 'Next year' }).focus());
      await user.keyboard('{Escape}');
      expect(grid()).toHaveAccessibleName('June 2025');
      expectFocusedCell('Sunday, June 15, 2025');
      expect(escapes).toEqual([true]);
    });

    it('never leaves focus on <body> across the view changes', async () => {
      const { user } = renderCalendar();
      act(() => tabStops()[0].focus());
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      expect(document.activeElement).toHaveAccessibleName('June 2025');
      await user.keyboard('{Enter}');
      expectFocusedCell('June 2025');
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      expect(document.activeElement).toHaveAccessibleName('2025');
      // The heading button becomes text in the year view: focus moves into the grid.
      await user.keyboard(' ');
      expectFocusedCell('2025');
      await user.keyboard('{Enter}');
      expectFocusedCell('June 2025');
      await user.keyboard('{Enter}');
      expectFocusedCell('Sunday, June 15, 2025');
      await openMonths(user);
      expectFocusedCell('June 2025');
      await user.keyboard('{Escape}');
      expectFocusedCell('Sunday, June 15, 2025');
    });

    it('marks months and years wholly outside minDate/maxDate aria-disabled, focusable and unpickable', async () => {
      const { user } = renderCalendar({
        minDate: new Date(2025, 2, 15),
        maxDate: new Date(2027, 9, 1),
      });
      await openMonths(user);
      for (const name of ['January 2025', 'February 2025']) {
        expect(cell(name)).toHaveAttribute('aria-disabled', 'true');
        expect(cell(name)).not.toBeDisabled();
      }
      expect(cell('March 2025')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByRole('button', { name: 'Previous year' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      // A click focuses it and picks nothing.
      await user.click(cell('January 2025'));
      expect(cell('January 2025')).toHaveFocus();
      expect(grid()).toHaveAccessibleName('2025');
      await user.keyboard('{Enter}');
      expect(grid()).toHaveAccessibleName('2025');
      // The keys stay within the bounds.
      await user.keyboard('{ArrowRight}');
      expectFocusedCell('March 2025');
      await user.keyboard('{ArrowLeft}{PageUp}');
      expectFocusedCell('March 2025');
      await user.keyboard('{End}');
      expectFocusedCell('April 2025');
      await user.keyboard('{PageDown}{PageDown}{ArrowDown}{ArrowDown}');
      expectFocusedCell('October 2027');
      expect(cell('November 2027')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: 'Next year' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await openYears(user, '2027');
      for (const year of ['2019', '2024', '2028', '2030']) {
        expect(cell(year)).toHaveAttribute('aria-disabled', 'true');
      }
      for (const year of ['2025', '2026', '2027']) {
        expect(cell(year)).not.toHaveAttribute('aria-disabled');
      }
      await user.click(cell('2024'));
      expect(cell('2024')).toHaveFocus();
      expect(grid()).toHaveAccessibleName(DECADE_2020);
    });

    it('inverted bounds (minDate after maxDate) disable the header buttons and the keys clamp', async () => {
      const { user } = renderCalendar({
        defaultValue: null,
        minDate: new Date(2025, 5, 20),
        maxDate: new Date(2025, 5, 10),
      });
      const expectHeaderDisabled = (previous: string, next: string) => {
        expect(screen.getByRole('button', { name: previous })).toHaveAttribute(
          'aria-disabled',
          'true',
        );
        expect(screen.getByRole('button', { name: next })).toHaveAttribute('aria-disabled', 'true');
      };
      expectHeaderDisabled('Previous month', 'Next month');
      expect(tabStops()).toHaveLength(1);
      act(() => tabStops()[0].focus());
      await user.keyboard('{PageDown}{PageUp}{Shift>}{PageDown}{PageUp}{/Shift}{ArrowRight}');
      expect(grid()).toHaveAccessibleName('June 2025');
      expect(tabStops()).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Next month' }));
      expect(grid()).toHaveAccessibleName('June 2025');
      await openMonths(user);
      expectHeaderDisabled('Previous year', 'Next year');
      await user.keyboard('{PageDown}{PageUp}{ArrowRight}{ArrowLeft}');
      expect(grid()).toHaveAccessibleName('2025');
      expectFocusedCell('June 2025');
      await openYears(user);
      expectHeaderDisabled('Previous decade', 'Next decade');
      await user.keyboard('{PageDown}{PageUp}{ArrowDown}');
      expect(grid()).toHaveAccessibleName(DECADE_2020);
      expectFocusedCell('2025');
    });

    it('bounds that exclude whole decades disable the decade buttons, and paging clamps', async () => {
      const { user } = renderCalendar({
        minDate: new Date(2021, 1, 1),
        maxDate: new Date(2028, 5, 30),
      });
      await openMonths(user);
      await openYears(user);
      for (const name of ['Previous decade', 'Next decade']) {
        expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
      }
      for (const year of ['2019', '2020', '2029', '2030']) {
        expect(cell(year)).toHaveAttribute('aria-disabled', 'true');
      }
      await user.keyboard('{PageUp}');
      expectFocusedCell('2021');
      await user.keyboard('{PageDown}');
      expectFocusedCell('2028');
      await user.click(screen.getByRole('button', { name: 'Next decade' }));
      expect(grid()).toHaveAccessibleName(DECADE_2020);
    });

    it('a month where every day is unavailable keeps one tab stop, and the keys end', async () => {
      const { user } = renderCalendar({ defaultValue: null, disabledDates: () => true });
      expect(tabStops()).toHaveLength(1);
      expect(tabStops()[0]).toHaveAccessibleName('Thursday, June 12, 2025');
      act(() => tabStops()[0].focus());
      await user.keyboard('{ArrowRight}{ArrowDown}{Home}{End}{PageDown}{ArrowLeft}');
      expect(focusedLabel()).toBe('Sunday, July 20, 2025');
      expect(tabStops()).toHaveLength(1);
      await user.keyboard('{Enter}');
      expect(tabStops()).toHaveLength(1);
      // Its month is no less reachable in the month view.
      await openMonths(user, 'July 2025');
      expect(cell('July 2025')).not.toHaveAttribute('aria-disabled');
    });

    it('gives every button of every view its own padding, background, gated hover and focus ring', async () => {
      const { user } = renderCalendar();
      const expectButtonClasses = () => {
        for (const button of within(group()).getAllByRole('button')) {
          expect(button).toHaveClass(
            'p-0',
            'bg-transparent',
            'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
            'focus-visible:outline-2',
          );
        }
      };
      expectButtonClasses();
      await openMonths(user);
      expectButtonClasses();
      await openYears(user);
      expectButtonClasses();
      // The navigation buttons and the cells are at least 32px tall.
      for (const button of within(group()).getAllByRole('button')) {
        expect(button.className).toMatch(/(^|\s)h-(8|10|12)(\s|$)/);
      }
    });

    it('passes axe in the month and the year view', async () => {
      const { user } = renderCalendar({ minDate: new Date(2025, 2, 15) });
      await openMonths(user);
      expect(await axe(document.body)).toHaveNoViolations();
      await openYears(user);
      expect(await axe(document.body)).toHaveNoViolations();
    });

    it('writes the years in the locale digits and calendar (th-TH)', async () => {
      const { user } = renderCalendar({ locale: 'th-TH' });
      const month = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(
        JUNE_15,
      );
      await openMonths(user, month);
      expect(grid()).toHaveAccessibleName('2568');
      await openYears(user, '2568');
      expectFocusedCell('2568');
    });
  });

  describe('week numbers (D30)', () => {
    function renderWeeks(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
      const user = userEvent.setup();
      const utils = render(
        <Calendar aria-label="Due date" locale="en-US" today={TODAY} showWeekNumbers {...props} />,
      );
      return { user, ...utils };
    }

    it('adds a row header per week, named "Week n", under a header cell with a hidden "Week"', () => {
      renderWeeks();
      const rowHeaders = within(grid()).getAllByRole('rowheader');
      expect(rowHeaders).toHaveLength(6);
      expect(rowHeaders[0]).toHaveAttribute('scope', 'row');
      expect(rowHeaders[0]).toHaveAttribute('aria-label', 'Week 23');
      expect(rowHeaders.map((header) => header.textContent)).toEqual([
        '23',
        '24',
        '25',
        '26',
        '27',
        '28',
      ]);
      const headers = within(grid()).getAllByRole('columnheader');
      expect(headers).toHaveLength(8);
      const corner = headers[0];
      expect(corner.querySelector('[aria-hidden="true"]')).toHaveTextContent('#');
      expect(corner.querySelector('.sr-only')).toHaveTextContent('Week');
      expect(corner).toHaveAccessibleName('Week');
    });

    it('draws no week column by default', () => {
      render(<Calendar aria-label="Due date" locale="en-US" today={TODAY} />);
      expect(within(grid()).queryAllByRole('rowheader')).toHaveLength(0);
      expect(within(grid()).getAllByRole('columnheader')).toHaveLength(7);
    });

    it('localizes the header text and the row names with labels', () => {
      renderWeeks({
        labels: { week: 'Woche', weekNumber: (week) => `Kalenderwoche ${week}` },
      });
      expect(within(grid()).getAllByRole('columnheader')[0]).toHaveAccessibleName('Woche');
      expect(within(grid()).getAllByRole('rowheader')[0]).toHaveAttribute(
        'aria-label',
        'Kalenderwoche 23',
      );
    });

    it('applies firstWeekOfYear and firstDayOfWeek (the three rules at a year boundary)', () => {
      const first = (props: Partial<React.ComponentProps<typeof Calendar>>) => {
        const { unmount } = renderWeeks({
          initialVisibleDate: new Date(2021, 0, 15),
          firstDayOfWeek: 1,
          ...props,
        });
        const text = within(grid()).getAllByRole('rowheader')[0].textContent;
        unmount();
        return text;
      };
      // The first row of January 2021 starts on Monday 28 December 2020.
      expect(first({})).toBe('1');
      expect(first({ firstWeekOfYear: 'first-day' })).toBe('1');
      expect(first({ firstWeekOfYear: 'first-full-week' })).toBe('52');
      expect(first({ firstWeekOfYear: 'first-four-day-week' })).toBe('53');
    });

    it('numbers the weeks in ISO 8601 with Monday weeks and the four-day rule', () => {
      renderWeeks({ firstDayOfWeek: 1, firstWeekOfYear: 'first-four-day-week' });
      // The grid starts on Monday 26 May 2025 (ISO week 22).
      expect(within(grid()).getAllByRole('rowheader')[0]).toHaveAttribute('aria-label', 'Week 22');
      expect(within(grid()).getAllByRole('rowheader')[1]).toHaveAttribute('aria-label', 'Week 23');
    });

    it('is skipped by the keys and the tab order', async () => {
      const user = userEvent.setup();
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          defaultValue={JUNE_15}
          showWeekNumbers
        />,
      );
      expect(grid().querySelectorAll('th[tabindex], th button')).toHaveLength(0);
      expect(tabStops()).toHaveLength(1);
      act(() => tabStops()[0].focus());
      await user.keyboard('{ArrowLeft}');
      expect(focusedLabel()).toBe('Saturday, June 14, 2025');
      await user.keyboard('{Home}');
      expect(focusedLabel()).toBe('Sunday, June 8, 2025');
      await user.keyboard('{ArrowLeft}');
      expect(focusedLabel()).toBe('Saturday, June 7, 2025');
      await user.keyboard('{End}{ArrowRight}');
      expect(focusedLabel()).toBe('Sunday, June 8, 2025');
    });

    it('passes axe', async () => {
      renderWeeks({ defaultValue: JUNE_15, markedDates: (date) => date.getDate() === 20 });
      expect(await axe(document.body)).toHaveNoViolations();
    });

    it('keeps the month and year views free of week numbers', async () => {
      const { user } = renderWeeks();
      await user.click(screen.getByRole('button', { name: 'June 2025' }));
      expect(within(grid()).queryAllByRole('rowheader')).toHaveLength(0);
    });
  });

  describe('marked days (D31)', () => {
    const marked = (date: Date) => date.getDate() === 16;

    it('draws a decorative dot in the current text colour and names the day "marked"', () => {
      render(<Calendar aria-label="Due date" locale="en-US" today={TODAY} markedDates={marked} />);
      const button = dayButton('Monday, June 16, 2025, marked');
      expect(button).toHaveAttribute('data-marked');
      const dot = button.querySelector(`.${calendarClassNames.markedDot}`);
      expect(dot).toHaveAttribute('aria-hidden', 'true');
      expect(dot).toHaveClass('bg-current');
      expect(dot).toBeEmptyDOMElement();
      expect(button).toHaveTextContent('16');
      expect(grid().querySelectorAll('button[data-marked]')).toHaveLength(1);
      expect(dayButton('Tuesday, June 17, 2025')).not.toHaveAttribute('data-marked');
      expect(
        dayButton('Tuesday, June 17, 2025').querySelector(`.${calendarClassNames.markedDot}`),
      ).toBeNull();
    });

    it('calls markedDates with local-midnight dates', () => {
      const markedDates = vi.fn((_date: Date) => false);
      render(<Calendar aria-label="Due date" today={TODAY} markedDates={markedDates} />);
      expect(markedDates).toHaveBeenCalled();
      for (const [date] of markedDates.mock.calls) {
        expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([0, 0, 0]);
      }
    });

    it('localizes the suffix with labels.markedDay', () => {
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          markedDates={marked}
          labels={{ markedDay: (label) => `${label} (event)` }}
        />,
      );
      expect(dayButton('Monday, June 16, 2025 (event)')).toBeInTheDocument();
    });

    it('keeps the dot on a selected day', () => {
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          defaultValue={new Date(2025, 5, 16)}
          markedDates={marked}
        />,
      );
      const button = dayButton('Monday, June 16, 2025, marked');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button.querySelector(`.${calendarClassNames.markedDot}`)).not.toBeNull();
    });
  });

  describe('custom day content (D31)', () => {
    it('renderDay replaces the content inside the button, which keeps its name and state', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const renderDay = vi.fn((date: Date, content: React.ReactNode) => (
        <span data-testid={`day-${date.getDate()}`}>
          {content}
          {date.getDate() === 17 ? <i>3 events</i> : null}
        </span>
      ));
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          onValueChange={onValueChange}
          renderDay={renderDay}
        />,
      );
      const button = dayButton('Tuesday, June 17, 2025');
      expect(button).toHaveTextContent('173 events');
      expect(button).toContainElement(screen.getAllByTestId('day-17')[0]);
      expect(renderDay).toHaveBeenCalledWith(expect.any(Date), '17');
      await user.click(button);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(dayButton('Tuesday, June 17, 2025')).toHaveAttribute('aria-pressed', 'true');
    });

    it('dayLabel sets the name and receives the default label (marked included)', () => {
      const dayLabel = vi.fn((date: Date, label: string) =>
        date.getDate() === 17 ? `${label}, 3 events` : label,
      );
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          markedDates={(date) => date.getDate() === 16}
          dayLabel={dayLabel}
          renderDay={(date, content) => (date.getDate() === 17 ? <>{content} (3)</> : content)}
        />,
      );
      expect(dayButton('Tuesday, June 17, 2025, 3 events')).toHaveTextContent('17 (3)');
      expect(dayLabel).toHaveBeenCalledWith(expect.any(Date), 'Monday, June 16, 2025, marked');
      expect(dayButton('Monday, June 16, 2025, marked')).toBeInTheDocument();
    });

    it('passes axe with custom content', async () => {
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          renderDay={(_date, content) => <span>{content}</span>}
          dayLabel={(_date, label) => `${label}!`}
        />,
      );
      expect(await axe(document.body)).toHaveNoViolations();
    });
  });

  describe('range selection (D29)', () => {
    const times = (days: Date[] | undefined) => days?.map((day) => day.getTime());
    const jun = (...days: number[]) => days.map((day) => new Date(2025, 5, day).getTime());

    function renderRange(props: Partial<React.ComponentProps<typeof Calendar>>) {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          onValueChange={onValueChange}
          {...props}
        />,
      );
      const selected = () =>
        Array.from(grid().querySelectorAll<HTMLElement>('button[data-selected]')).map((button) =>
          button.getAttribute('data-date'),
        );
      const lastDetails = () =>
        (onValueChange.mock.calls.at(-1) as [Date | null, CalendarValueChangeDetails])[1];
      return { user, onValueChange, selected, lastDetails };
    }

    it("'week' selects the week of the picked day, the value being the picked day", async () => {
      const { user, onValueChange, selected, lastDetails } = renderRange({
        selectionRange: 'week',
      });
      await user.click(dayButton('Wednesday, June 18, 2025'));
      expect(fields(onValueChange.mock.calls[0][0])).toEqual([2025, 6, 18]);
      expect(times(lastDetails().range)).toEqual(jun(15, 16, 17, 18, 19, 20, 21));
      expect(selected()).toEqual([
        '2025-06-15',
        '2025-06-16',
        '2025-06-17',
        '2025-06-18',
        '2025-06-19',
        '2025-06-20',
        '2025-06-21',
      ]);
      for (const iso of selected()) {
        const button = grid().querySelector<HTMLElement>(`button[data-date="${iso}"]`);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(button?.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true');
      }
      expect(dayButton('Saturday, June 14, 2025')).not.toHaveAttribute('aria-pressed');
      expect(grid()).not.toHaveAttribute('aria-multiselectable');
    });

    it("'week' follows firstDayOfWeek", async () => {
      const { user, lastDetails } = renderRange({ selectionRange: 'week', firstDayOfWeek: 1 });
      await user.click(dayButton('Sunday, June 15, 2025'));
      expect(times(lastDetails().range)).toEqual(jun(9, 10, 11, 12, 13, 14, 15));
    });

    it("'work-week' selects Monday to Friday of the week", async () => {
      const { user, selected, lastDetails } = renderRange({ selectionRange: 'work-week' });
      await user.click(dayButton('Wednesday, June 18, 2025'));
      expect(times(lastDetails().range)).toEqual(jun(16, 17, 18, 19, 20));
      expect(selected()).toHaveLength(5);
    });

    it("'work-week' with workWeekDays, in the order of the week", async () => {
      const { user, lastDetails } = renderRange({
        selectionRange: 'work-week',
        workWeekDays: [6, 0],
      });
      await user.click(dayButton('Wednesday, June 18, 2025'));
      expect(times(lastDetails().range)).toEqual(jun(15, 21));
    });

    it("'work-week' with Monday weeks lists Saturday before Sunday", async () => {
      const { user, lastDetails } = renderRange({
        selectionRange: 'work-week',
        workWeekDays: [0, 6],
        firstDayOfWeek: 1,
      });
      await user.click(dayButton('Wednesday, June 18, 2025'));
      expect(times(lastDetails().range)).toEqual(jun(21, 22));
    });

    it("'month' selects every day of the month, not the days of the neighbouring months", async () => {
      const { user, selected, lastDetails } = renderRange({ selectionRange: 'month' });
      await user.click(dayButton('Wednesday, June 18, 2025'));
      expect(lastDetails().range).toHaveLength(30);
      expect(times(lastDetails().range)?.[0]).toBe(new Date(2025, 5, 1).getTime());
      expect(times(lastDetails().range)?.[29]).toBe(new Date(2025, 5, 30).getTime());
      expect(selected()).toHaveLength(30);
      expect(dayButton('Tuesday, July 1, 2025')).not.toHaveAttribute('data-selected');
    });

    it('leaves unavailable days out of the range', async () => {
      const { user, selected, lastDetails } = renderRange({
        selectionRange: 'week',
        minDate: new Date(2025, 5, 17),
        disabledDates: (date) => date.getDate() === 19,
      });
      await user.click(dayButton('Wednesday, June 18, 2025'));
      expect(times(lastDetails().range)).toEqual(jun(17, 18, 20, 21));
      expect(selected()).toEqual(['2025-06-17', '2025-06-18', '2025-06-20', '2025-06-21']);
    });

    it('draws the range of a controlled value, also when it moves', () => {
      const { rerender } = render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          selectionRange="week"
          value={new Date(2025, 5, 4)}
        />,
      );
      expect(grid().querySelectorAll('button[data-selected]')).toHaveLength(7);
      expect(dayButton('Sunday, June 1, 2025')).toHaveAttribute('aria-pressed', 'true');
      rerender(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          selectionRange="week"
          value={new Date(2025, 5, 18)}
        />,
      );
      expect(dayButton('Sunday, June 1, 2025')).not.toHaveAttribute('aria-pressed');
      expect(dayButton('Saturday, June 21, 2025')).toHaveAttribute('aria-pressed', 'true');
    });

    it('picking another day of the selected week still fires, picking the same day does not', async () => {
      const { user, onValueChange } = renderRange({
        selectionRange: 'week',
        defaultValue: new Date(2025, 5, 18),
      });
      await user.click(dayButton('Thursday, June 19, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      await user.click(dayButton('Thursday, June 19, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('emits the range of the restored value on a form reset', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <form>
          <Calendar
            aria-label="Due date"
            locale="en-US"
            today={TODAY}
            selectionRange="week"
            defaultValue={new Date(2025, 5, 18)}
            onValueChange={onValueChange}
          />
          <button type="reset">Reset</button>
        </form>,
      );
      await user.click(dayButton('Sunday, June 8, 2025'));
      onValueChange.mockClear();
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(times(onValueChange.mock.calls[0][1].range)).toEqual(jun(15, 16, 17, 18, 19, 20, 21));
    });

    it('does not mark the month view by range', async () => {
      const { user } = renderRange({ selectionRange: 'month', defaultValue: JUNE_15 });
      await user.click(screen.getByRole('button', { name: 'June 2025' }));
      expect(grid().querySelectorAll('button[data-selected]')).toHaveLength(1);
    });
  });

  describe('Go to today (D32)', () => {
    function renderToday(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          showGoToToday
          onValueChange={onValueChange}
          {...props}
        />,
      );
      return { user, onValueChange };
    }

    it('adds no footer by default', () => {
      render(<Calendar aria-label="Due date" today={TODAY} />);
      expect(screen.queryByRole('button', { name: 'Go to today' })).not.toBeInTheDocument();
    });

    it('shows the month of today and focuses today without selecting anything', async () => {
      const { user, onValueChange } = renderToday({ defaultValue: new Date(2025, 8, 3) });
      expect(grid()).toHaveAccessibleName('September 2025');
      await user.click(screen.getByRole('button', { name: 'Go to today' }));
      expect(grid()).toHaveAccessibleName('June 2025');
      expect(document.activeElement).toHaveAccessibleName('Thursday, June 12, 2025');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(grid().querySelectorAll('button[data-selected]')).toHaveLength(0);
    });

    it('focuses today when its month is already shown but another day has the focus', async () => {
      const { user, onValueChange } = renderToday({ defaultValue: JUNE_15 });
      act(() => tabStops()[0].focus());
      await user.keyboard('{ArrowDown}');
      expect(focusedLabel()).toBe('Sunday, June 22, 2025');
      await user.click(screen.getByRole('button', { name: 'Go to today' }));
      expect(focusedLabel()).toBe('Thursday, June 12, 2025');
      expect(tabStops()).toHaveLength(1);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('focuses today again when it is already the roving day and the button has the focus', async () => {
      const { user } = renderToday();
      const button = screen.getByRole('button', { name: 'Go to today' });
      await user.click(button);
      expect(focusedLabel()).toBe('Thursday, June 12, 2025');
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(focusedLabel()).toBe('Thursday, June 12, 2025');
    });

    it('returns from the month and year views to the day view of today', async () => {
      const { user } = renderToday({ defaultValue: new Date(2020, 1, 3) });
      await user.click(screen.getByRole('button', { name: 'February 2020' }));
      await user.click(screen.getByRole('button', { name: '2020' }));
      expect(grid()).toHaveAccessibleName(/^2020\s*–\s*2029$/);
      await user.click(screen.getByRole('button', { name: 'Go to today' }));
      expect(grid()).toHaveAccessibleName('June 2025');
      expect(document.activeElement).toHaveAccessibleName('Thursday, June 12, 2025');
    });

    it('is natively disabled while today is outside minDate/maxDate', () => {
      renderToday({ minDate: new Date(2025, 5, 13) });
      const button = screen.getByRole('button', { name: 'Go to today' });
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('aria-disabled');
    });

    it('is disabled after maxDate too, and enabled on the bounds', () => {
      const { unmount } = render(
        <Calendar aria-label="A" today={TODAY} showGoToToday maxDate={new Date(2025, 5, 11)} />,
      );
      expect(screen.getByRole('button', { name: 'Go to today' })).toBeDisabled();
      unmount();
      render(
        <Calendar
          aria-label="B"
          today={TODAY}
          showGoToToday
          minDate={TODAY}
          maxDate={new Date(2025, 5, 12, 23)}
        />,
      );
      expect(screen.getByRole('button', { name: 'Go to today' })).toBeEnabled();
    });

    it('localizes the name with labels.goToToday', () => {
      renderToday({ labels: { goToToday: 'Zu heute' } });
      expect(screen.getByRole('button', { name: 'Zu heute' })).toBeInTheDocument();
    });

    it('comes after the grid in the tab order', async () => {
      const { user } = renderToday();
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();
      expect(focusedLabel()).toBe('Thursday, June 12, 2025');
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName('Go to today');
    });

    it('is enabled in the server HTML without today, and disabled once hydrated out of range', () => {
      const element = (
        <Calendar
          aria-label="Due date"
          locale="en-US"
          initialVisibleDate={TODAY}
          showGoToToday
          minDate={new Date(2030, 0, 1)}
        />
      );
      const host = document.createElement('div');
      host.innerHTML = renderToString(element);
      const serverButton = Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Go to today',
      );
      expect(serverButton).toBeDefined();
      expect(serverButton?.hasAttribute('disabled')).toBe(false);
      render(element);
      expect(screen.getByRole('button', { name: 'Go to today' })).toBeDisabled();
    });

    it('passes axe', async () => {
      renderToday();
      expect(await axe(document.body)).toHaveNoViolations();
    });
  });

  describe('view state (E4 review)', () => {
    function renderView(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const utils = render(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
          {...props}
        />,
      );
      return { user, onValueChange, ...utils };
    }

    function expectFocusInGrid() {
      expect(document.activeElement).not.toBe(document.body);
      expect(grid()).toContainElement(document.activeElement as HTMLElement);
    }

    it('M2: inverted bounds in different years never hang the year and month keys', async () => {
      const { user } = renderView({
        defaultValue: null,
        minDate: new Date(2027, 2, 1),
        maxDate: new Date(2023, 4, 1),
      });
      const keys =
        '{ArrowRight}{ArrowLeft}{ArrowDown}{ArrowUp}{End}{Home}{PageDown}{PageUp}{PageDown}';
      // The month first shown is minDate's, the bound the inverted range clamps into.
      await user.click(screen.getByRole('button', { name: 'March 2027' }));
      await user.keyboard(keys);
      expectFocusInGrid();
      // The keys clamp into the bound that wins (maxDate's May 2023) and end there.
      expect(grid()).toHaveAccessibleName('2023');
      expect(document.activeElement).toHaveAccessibleName('May 2023');
      await user.click(screen.getByRole('button', { name: /^20\d\d$/ }));
      await user.keyboard(keys);
      expectFocusInGrid();
      expect(grid()).toHaveAccessibleName(/^2020\s*–\s*2029$/);
      expect(document.activeElement).toHaveTextContent('2023');
      expect(
        within(grid())
          .getAllByRole('button')
          .filter((b) => b.tabIndex === 0),
      ).toHaveLength(1);
    });

    it('M3: the month view follows a controlled value that moves to another year', async () => {
      const { user, rerender } = renderView({ value: JUNE_15, defaultValue: undefined });
      await user.click(screen.getByRole('button', { name: 'June 2025' }));
      expect(grid()).toHaveAccessibleName('2025');
      rerender(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          value={new Date(2027, 2, 3)}
        />,
      );
      expect(grid()).toHaveAccessibleName('2027');
      const march = within(grid()).getByRole('button', { name: 'March 2027' });
      expect(march).toHaveAttribute('tabindex', '0');
      expect(march).toHaveAttribute('aria-pressed', 'true');
    });

    it('M3: the year view follows it to the decade of the new value', async () => {
      const { user, rerender } = renderView({ value: JUNE_15, defaultValue: undefined });
      await user.click(screen.getByRole('button', { name: 'June 2025' }));
      await user.click(screen.getByRole('button', { name: '2025' }));
      expect(grid()).toHaveAccessibleName(/^2020\s*–\s*2029$/);
      rerender(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          value={new Date(2041, 2, 3)}
        />,
      );
      expect(grid()).toHaveAccessibleName(/^2040\s*–\s*2049$/);
      expect(within(grid()).getByRole('button', { name: '2041' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('M4: turning showMonthPicker off while the month view is open returns to the days', async () => {
      const { user, rerender } = renderView();
      await user.click(screen.getByRole('button', { name: 'June 2025' }));
      expect(grid()).toHaveAccessibleName('2025');
      rerender(
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          defaultValue={JUNE_15}
          showMonthPicker={false}
        />,
      );
      expect(grid()).toHaveAccessibleName('June 2025');
      expectFocusInGrid();
      expect(document.activeElement).toHaveAccessibleName('Sunday, June 15, 2025');
      expect(screen.queryByRole('button', { name: 'June 2025' })).not.toBeInTheDocument();
    });

    it('M4: ... and from the year view; turning it on again shows the days, not the old view', async () => {
      const { user, rerender } = renderView();
      await user.click(screen.getByRole('button', { name: 'June 2025' }));
      await user.click(screen.getByRole('button', { name: '2025' }));
      const element = (showMonthPicker: boolean) => (
        <Calendar
          aria-label="Due date"
          locale="en-US"
          today={TODAY}
          defaultValue={JUNE_15}
          showMonthPicker={showMonthPicker}
        />
      );
      rerender(element(false));
      expect(grid()).toHaveAccessibleName('June 2025');
      expectFocusInGrid();
      rerender(element(true));
      expect(grid()).toHaveAccessibleName('June 2025');
      expect(screen.getByRole('button', { name: 'June 2025' })).toBeInTheDocument();
    });

    it('M5: a drill down and back fires nothing twice in StrictMode and keeps focus in the grid', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Calendar
            aria-label="Due date"
            locale="en-US"
            today={TODAY}
            defaultValue={JUNE_15}
            onValueChange={onValueChange}
          />
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: 'June 2025' }));
      expectFocusInGrid();
      await user.click(screen.getByRole('button', { name: '2025' }));
      expectFocusInGrid();
      await user.click(within(grid()).getByRole('button', { name: '2026' }));
      expectFocusInGrid();
      await user.click(within(grid()).getByRole('button', { name: 'March 2026' }));
      expect(grid()).toHaveAccessibleName('March 2026');
      expectFocusInGrid();
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(dayButton('Sunday, March 15, 2026'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    describe('M5: the Escape handler', () => {
      /** `defaultPrevented` of every Escape that reaches the document. */
      function trackEscapes() {
        const seen: boolean[] = [];
        const listener = (event: KeyboardEvent) => {
          if (event.key === 'Escape') seen.push(event.defaultPrevented);
        };
        document.addEventListener('keydown', listener);
        onTestFinished(() => document.removeEventListener('keydown', listener));
        return seen;
      }

      async function openMonths(wrapper?: (ui: React.ReactElement) => React.ReactElement) {
        const user = userEvent.setup();
        const ui = (
          <Calendar aria-label="Due date" locale="en-US" today={TODAY} defaultValue={JUNE_15} />
        );
        render(wrapper ? wrapper(ui) : ui);
        await user.click(screen.getByRole('button', { name: 'June 2025' }));
        return user;
      }

      it('goes back one level and consumes the key', async () => {
        const escapes = trackEscapes();
        const user = await openMonths();
        await user.keyboard('{Escape}');
        expect(grid()).toHaveAccessibleName('June 2025');
        expect(escapes).toEqual([true]);
      });

      it('ignores a key of an IME composition', async () => {
        await openMonths();
        fireEvent.keyDown(document.activeElement as HTMLElement, {
          key: 'Escape',
          isComposing: true,
        });
        expect(grid()).toHaveAccessibleName('2025');
      });

      it('ignores a key that was already handled', async () => {
        const user = await openMonths((ui) => (
          <div onKeyDownCapture={(event) => event.preventDefault()}>{ui}</div>
        ));
        await user.keyboard('{Escape}');
        expect(grid()).toHaveAccessibleName('2025');
      });

      it('ignores other keys', async () => {
        const user = await openMonths();
        await user.keyboard('x');
        expect(grid()).toHaveAccessibleName('2025');
      });
    });
  });

  describe('locale', () => {
    it('localizes the month text, weekdays and day labels', () => {
      render(<Calendar aria-label="Datum" locale="de-DE" today={TODAY} defaultValue={JUNE_15} />);
      expect(grid()).toHaveAccessibleName('Juni 2025');
      expect(dayButton('Sonntag, 15. Juni 2025')).toHaveAttribute('aria-pressed', 'true');
    });

    it('warns once in development about a malformed locale tag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <React.StrictMode>
          <Calendar aria-label="Date" locale="de_DE" today={TODAY} />
          <Calendar aria-label="Other" locale="de_DE" today={TODAY} />
        </React.StrictMode>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Calendar: `locale` "de_DE" is not a valid BCP 47 language tag (use hyphens, ' +
            'as in "en-US"). The runtime default locale formats the dates instead, so the server ' +
            'and the browser may render different text.',
        ],
      ]);
    });
  });
});
