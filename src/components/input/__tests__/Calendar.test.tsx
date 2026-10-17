import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { Calendar, type CalendarValueChangeDetails } from '../Calendar';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
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
      const heading = screen.getByText('June 2025');
      expect(heading.tagName).toBe('DIV');
      expect(heading).toHaveAttribute('aria-live', 'polite');
      expect(grid()).toHaveAttribute('aria-labelledby', heading.id);
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

    it('orders the tab stops: previous month, next month, then one day of the grid', async () => {
      const user = userEvent.setup();
      render(<Calendar aria-label="Due date" today={TODAY} locale="en-US" />);
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName('Previous month');
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
