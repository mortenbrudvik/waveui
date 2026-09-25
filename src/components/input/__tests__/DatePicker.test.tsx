import * as React from 'react';
import { afterEach, beforeEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/DatePicker.stories';
import { DatePicker, type DatePickerLabels, type DatePickerProps } from '../DatePicker';
import { formatDate } from '../dateUtils';
import {
  axe,
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss, type DismissReason } from '../../../hooks/useDismiss';

/** "Today" in every test: Wednesday 18 June 2025, 14:30 local time. */
const NOW = new Date(2025, 5, 18, 14, 30);
const JUNE_15 = new Date(2025, 5, 15);

beforeEach(() => {
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function textbox(name = 'Date') {
  return screen.getByRole('textbox', { name });
}

function toggle() {
  return screen.getByRole('button', { name: 'Open calendar' });
}

function dialog() {
  return screen.getByRole('dialog');
}

function dayButton(name: string) {
  return within(screen.getByRole('grid')).getByRole('button', { name });
}

async function openCalendar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(toggle());
  return dialog();
}

/**
 * Focuses the input and replaces its text as one edit, without userEvent's change-on-blur
 * emulation. Use it before Alt+ArrowDown: the calendar then takes focus inside React's commit, and
 * userEvent would dispatch its emulated `change` for text it typed through a nested `act()` while
 * the outer one is still flushing, which React reports ("A component suspended inside an `act`
 * scope").
 */
function editText(text: string) {
  const input = textbox();
  act(() => input.focus());
  fireEvent.change(input, { target: { value: text } });
}

/** A hex/white/black color utility or the banned `enabled:` variant (C-TOKENS). */
const RAW_COLOR_OR_ENABLED = new RegExp(
  String.raw`\[#|\b(bg|text|border)-(white|black)\b|enabled:`,
);

/** Local calendar fields (TZ-agnostic). */
function fields(date: Date | null | undefined) {
  return date ? [date.getFullYear(), date.getMonth() + 1, date.getDate()] : date;
}

describe('DatePicker', () => {
  testSystemProps(DatePicker, {
    expectedTag: 'div',
    displayName: 'DatePicker',
    defaultProps: { 'aria-label': 'Date picker' },
    control: { role: 'textbox' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true, defaultValue: JUNE_15, clearable: true } },
    ],
  });

  testNoImplicitSubmit(DatePicker, {
    defaultProps: { 'aria-label': 'Date', defaultValue: JUNE_15, clearable: true },
  });

  describe('rendering and display format', () => {
    it('renders the placeholder', () => {
      render(<DatePicker aria-label="Date" placeholder="Pick a date" />);
      expect(textbox()).toHaveAttribute('placeholder', 'Pick a date');
    });

    it('formats the value with Intl numeric fields for the locale (input-datetime#1)', () => {
      const date = new Date(2025, 3, 3);
      const { rerender } = render(<DatePicker aria-label="Date" value={date} locale="en-GB" />);
      expect(textbox()).toHaveValue('03/04/2025');
      rerender(<DatePicker aria-label="Date" value={date} locale="en-US" />);
      expect(textbox()).toHaveValue('04/03/2025');
      rerender(<DatePicker aria-label="Date" value={date} />);
      expect(textbox()).toHaveValue(formatDate(date));
    });

    it('formats with a custom formatDate', () => {
      const format = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      render(
        <DatePicker
          aria-label="Date"
          defaultValue={new Date(2025, 0, 15)}
          formatDate={format}
          parseDate={() => null}
        />,
      );
      expect(textbox()).toHaveValue('2025-01-15');
    });

    it('follows a controlled value change', () => {
      const { rerender } = render(<DatePicker aria-label="Date" value={JUNE_15} locale="en-US" />);
      rerender(<DatePicker aria-label="Date" value={new Date(2025, 6, 4)} locale="en-US" />);
      expect(textbox()).toHaveValue('07/04/2025');
      rerender(<DatePicker aria-label="Date" value={null} locale="en-US" />);
      expect(textbox()).toHaveValue('');
    });

    it('follows a controlled value change while the calendar is open (input-datetime#13)', () => {
      const { rerender } = render(
        <DatePicker aria-label="Date" open value={JUNE_15} locale="en-US" />,
      );
      expect(dialog()).toBeInTheDocument();
      expect(textbox()).toHaveValue('06/15/2025');
      rerender(<DatePicker aria-label="Date" open value={new Date(2025, 6, 4)} locale="en-US" />);
      expect(dialog()).toBeInTheDocument();
      expect(textbox()).toHaveValue('07/04/2025');
    });

    it('uses the shared icons, hidden from assistive technology (input-datetime#22)', () => {
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} clearable />);
      expect(toggle().querySelector('svg')).toHaveAttribute('data-wave-icon', 'calendar');
      expect(toggle().querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      const clear = screen.getByRole('button', { name: 'Clear date' });
      expect(clear.querySelector('svg')).toHaveAttribute('data-wave-icon', 'dismiss');
    });

    it('gives the calendar and clear buttons 24px targets and pads the input logically (input-datetime#15)', () => {
      const { unmount } = render(<DatePicker aria-label="Date" />);
      expect(toggle()).toHaveClass('h-6', 'w-6', 'end-1');
      expect(textbox()).toHaveClass('pe-8');
      unmount();
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} clearable />);
      // Toggle at 4–28px from the end, clear button at 28–52px: two adjacent 24px targets.
      expect(screen.getByRole('button', { name: 'Clear date' })).toHaveClass('h-6', 'w-6', 'end-7');
      expect(textbox()).toHaveClass('pe-14');
    });

    it('gives every button its own padding and background, so an app-wide button rule cannot fill them (C-NATIVE)', () => {
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          clearable
          defaultOpen
        />,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(40); // toggle, clear, month buttons and 42 days
      for (const button of buttons) {
        expect(button).toHaveClass('p-0');
        expect(button).toHaveClass('bg-transparent');
      }
      // The selected day keeps its own fill.
      expect(dayButton('Sunday, June 15, 2025')).toHaveClass('data-[selected]:bg-primary');
    });

    it('uses theme tokens and gates hover on every button (button-provider#3)', () => {
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} clearable defaultOpen />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(40); // toggle, clear, month buttons and 42 days
      for (const button of buttons) {
        expect(button.className).not.toMatch(RAW_COLOR_OR_ENABLED);
        expect(button).toHaveClass('not-disabled:not-aria-disabled:hover:bg-subtle-hover');
      }
      expect(textbox()).toHaveClass('focus:outline-hidden');
    });

    it.each([
      ['defaultOpen', { defaultOpen: true }],
      ['open', { open: true }],
    ])('renders on the server with the formatted value and no calendar (%s)', (_label, props) => {
      const html = renderToString(
        <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} {...props} />,
      );
      expect(html).toContain('value="06/15/2025"');
      expect(html).not.toContain('role="dialog"');
    });

    it.each([
      ['a defaultOpen', { defaultOpen: true }],
      ['an open', { open: true }],
    ])('reports %s calendar closed on the server, so no reference dangles', (_label, props) => {
      const serverHtml = renderToString(
        <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} {...props} />,
      );
      expect(findDanglingIdRefsInHtml(serverHtml)).toEqual([]);
      const host = document.createElement('div'); // detached: nothing reaches document.body
      host.innerHTML = serverHtml;
      const toggleButton = host.querySelector('button[aria-haspopup="dialog"]');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it.each([
      ['defaultOpen', { defaultOpen: true }],
      ['open', { open: true }],
    ])('opens once hydrated (%s), without a hydration mismatch', async (_label, props) => {
      const element = (
        <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} {...props} />
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(error).not.toHaveBeenCalled();
        expect(toggle()).toHaveAttribute('aria-expanded', 'true');
        expect(toggle()).toHaveAttribute('aria-controls', dialog().id);
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('uses logical positions and mirrored chevrons in RTL (feedback-navigation#34, input-datetime#17)', () => {
      renderWithProviders(
        <DatePicker aria-label="Date" defaultValue={JUNE_15} clearable defaultOpen />,
        { dir: 'rtl' },
      );
      for (const button of [toggle(), screen.getByRole('button', { name: 'Clear date' })]) {
        expect(button.className).not.toMatch(/\b(left|right)-/);
      }
      expect(textbox().className).not.toMatch(/\bp[lr]-/);
      const previous = screen.getByRole('button', { name: 'Previous month' });
      const next = screen.getByRole('button', { name: 'Next month' });
      for (const button of [previous, next]) {
        const icon = button.querySelector('svg');
        // Wave's own direction variant: Tailwind's `rtl:` also matches inside an LTR subtree
        // (C-LOGICAL).
        expect(icon).toHaveClass('wave-rtl:-scale-x-100');
        expect(icon?.getAttribute('class')).not.toMatch(/(^|\s)rtl:/);
      }
    });

    it('draws the destructive border while the input is invalid', async () => {
      const user = userEvent.setup();
      const invalidClasses = ['border-destructive', 'focus:border-b-destructive'];
      const { unmount } = render(<DatePicker aria-label="Date" locale="en-US" />);
      expect(textbox()).toHaveClass('border-input', 'border-b-stroke-accessible');
      for (const name of invalidClasses) expect(textbox()).not.toHaveClass(name);
      // Its own rejected text.
      await user.type(textbox(), 'soon{Enter}');
      expect(textbox()).toHaveAttribute('aria-invalid', 'true');
      expect(textbox()).toHaveClass(...invalidClasses);
      expect(textbox()).not.toHaveClass('border-input');
      expect(textbox()).not.toHaveClass('border-b-stroke-accessible');
      await user.clear(textbox());
      for (const name of invalidClasses) expect(textbox()).not.toHaveClass(name);
      unmount();

      // The surrounding Field's error, unless the consumer overrides aria-invalid.
      const field = renderWithFieldContext(<DatePicker />, { errorId: FIELD_TEST_IDS.errorId });
      expect(textbox(FIELD_TEST_TEXT.label)).toHaveClass(...invalidClasses);
      field.rerender(<DatePicker aria-invalid={false} />);
      for (const name of invalidClasses) {
        expect(textbox(FIELD_TEST_TEXT.label)).not.toHaveClass(name);
      }
      field.unmount();

      render(<DatePicker aria-label="Date" aria-invalid />);
      expect(textbox()).toHaveClass(...invalidClasses);
    });
  });

  describe('typed entry (input-datetime#1, #13, #14)', () => {
    it('en-GB: typing 03/04/2025 and leaving the field commits 3 April', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" locale="en-GB" onValueChange={onValueChange} />);
      await user.type(textbox(), '03/04/2025');
      await user.tab();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const committed = onValueChange.mock.calls[0][0] as Date;
      expect(committed.getTime()).toBe(new Date(2025, 3, 3).getTime());
      expect(textbox()).toHaveValue('03/04/2025');
    });

    it('commits typed text on Enter', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" locale="en-US" onValueChange={onValueChange} />);
      await user.type(textbox(), '12/24/2025{Enter}');
      expect((onValueChange.mock.calls[0][0] as Date).getTime()).toBe(
        new Date(2025, 11, 24).getTime(),
      );
      expect(textbox()).toHaveValue('12/24/2025');
    });

    it('leaves the Enter that confirms an IME composition to the IME', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" locale="en-US" onValueChange={onValueChange} />);
      await user.type(textbox(), '12/24/2025');
      const notPrevented = fireEvent.keyDown(textbox(), { key: 'Enter', isComposing: true });
      expect(notPrevented).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(textbox()).toHaveValue('12/24/2025');
      fireEvent.keyDown(textbox(), { key: 'Enter' });
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 12, 24]);
    });

    it('accepts ISO text in any locale', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" locale="de-DE" onValueChange={onValueChange} />);
      await user.type(textbox(), '2025-04-03{Enter}');
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 4, 3]);
      expect(textbox()).toHaveValue('03.04.2025');
    });

    it('does not re-parse or emit when the field is focused and left without editing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-GB"
          defaultValue={new Date(2025, 3, 3)}
          onValueChange={onValueChange}
        />,
      );
      for (let i = 0; i < 2; i++) {
        await user.click(textbox());
        await user.tab();
      }
      expect(onValueChange).not.toHaveBeenCalled();
      expect(textbox()).toHaveValue('03/04/2025');
    });

    it('does not emit when the typed text is the same day', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-GB"
          defaultValue={new Date(2025, 3, 3, 15)}
          onValueChange={onValueChange}
        />,
      );
      await user.clear(textbox());
      await user.type(textbox(), '3/4/2025');
      await user.tab();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(textbox()).toHaveValue('03/04/2025');
    });

    it('clears the value when the text is erased', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} onValueChange={onValueChange} />);
      await user.clear(textbox());
      await user.tab();
      expect(onValueChange).toHaveBeenCalledWith(null);
    });

    it('parses with the default parser for the locale when only formatDate is given, and warns', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-GB"
          formatDate={(d) => d.toDateString()}
          onValueChange={onValueChange}
        />,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] DatePicker: `formatDate` is set without `parseDate`. Typed dates are parsed ' +
            'with the default parser for `locale` (its numeric format or yyyy-mm-dd), which may ' +
            'not read your format; pass `parseDate` as the inverse of `formatDate`.',
        ],
      ]);
      await user.type(textbox(), '03/04/2025{Enter}');
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 4, 3]);
      expect(textbox()).toHaveValue(new Date(2025, 3, 3).toDateString());
    });

    it('keeps unparseable text, marks the input invalid and describes the error', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onInvalidInput = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-GB"
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.clear(textbox());
      await user.type(textbox(), 'next friday');
      await user.tab();
      expect(textbox()).toHaveValue('next friday');
      expect(textbox()).toHaveAttribute('aria-invalid', 'true');
      expect(textbox()).toHaveAccessibleDescription('Enter a date in the format DD/MM/YYYY.');
      expect(onInvalidInput).toHaveBeenCalledWith('next friday', 'unparseable');
      expect(onValueChange).not.toHaveBeenCalled();

      await user.clear(textbox());
      expect(textbox()).not.toHaveAttribute('aria-invalid');
      await user.type(textbox(), '20/06/2025{Enter}');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
      expect(textbox()).not.toHaveAccessibleDescription();
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 6, 20]);
    });

    it('rejects typed dates outside minDate/maxDate and accepts both boundary days', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onInvalidInput = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          minDate={new Date(2025, 5, 10, 18)}
          maxDate={new Date(2025, 5, 20, 9)}
          onValueChange={onValueChange}
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.type(textbox(), '06/21/2025{Enter}');
      expect(onInvalidInput).toHaveBeenLastCalledWith('06/21/2025', 'out-of-range');
      expect(textbox()).toHaveAccessibleDescription(
        'Enter a date between 06/10/2025 and 06/20/2025.',
      );
      expect(onValueChange).not.toHaveBeenCalled();

      await user.clear(textbox());
      await user.type(textbox(), '06/20/2025{Enter}');
      expect(fields(onValueChange.mock.lastCall?.[0] as Date)).toEqual([2025, 6, 20]);
      await user.clear(textbox());
      await user.type(textbox(), '06/10/2025{Enter}');
      expect(fields(onValueChange.mock.lastCall?.[0] as Date)).toEqual([2025, 6, 10]);
      await user.clear(textbox());
      await user.type(textbox(), '06/09/2025{Enter}');
      expect(onInvalidInput).toHaveBeenLastCalledWith('06/09/2025', 'out-of-range');
    });

    it('rejects a typed date that disabledDates excludes', async () => {
      const user = userEvent.setup();
      const onInvalidInput = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          disabledDates={(d) => d.getDay() === 0}
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.type(textbox(), '06/15/2025{Enter}');
      expect(onInvalidInput).toHaveBeenCalledWith('06/15/2025', 'disabled');
      expect(textbox()).toHaveAccessibleDescription('This date is not available.');
    });

    it.each([
      [
        'an earlier date with only minDate',
        { minDate: new Date(2025, 5, 10, 18) },
        '06/09/2025',
        'Enter a date on or after 06/10/2025.',
      ],
      [
        'a later date with only maxDate',
        { maxDate: new Date(2025, 5, 20, 9) },
        '06/21/2025',
        'Enter a date on or before 06/20/2025.',
      ],
      [
        'text a custom parseDate rejects',
        { parseDate: () => null, formatDate: (d: Date) => d.toDateString() },
        'Jun 20',
        'Enter a valid date.',
      ],
    ])('describes %s with its own message', async (_, props, text, message) => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" {...props} />);
      await user.type(textbox(), `${text}{Enter}`);
      expect(textbox()).toHaveAttribute('aria-invalid', 'true');
      expect(textbox()).toHaveAccessibleDescription(message);
    });

    it('shows the controlled value again when the parent rejects a typed commit or a clear', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          value={JUNE_15}
          onValueChange={() => {}}
          clearable
        />,
      );
      await user.clear(textbox());
      await user.type(textbox(), '07/01/2025');
      await user.tab();
      expect(textbox()).toHaveValue('06/15/2025');
      await user.clear(textbox());
      await user.type(textbox(), '07/01/2025{Enter}');
      expect(textbox()).toHaveValue('06/15/2025');
      await user.click(screen.getByRole('button', { name: 'Clear date' }));
      expect(textbox()).toHaveValue('06/15/2025');
    });

    it('a parent value change replaces rejected text and its error', async () => {
      const user = userEvent.setup();
      function Parent() {
        const [value, setValue] = React.useState<Date | null>(null);
        return (
          <form aria-label="Form">
            <DatePicker
              aria-label="Date"
              locale="en-US"
              name="d"
              value={value}
              onValueChange={setValue}
            />
            <button type="button" onClick={() => setValue(new Date(2025, 5, 18))}>
              Today
            </button>
          </form>
        );
      }
      render(<Parent />);
      await user.type(textbox(), '02/31/2025{Enter}');
      expect(textbox()).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a date in the format MM/DD/YYYY.');
      await user.click(screen.getByRole('button', { name: 'Today' }));
      expect(textbox()).toHaveValue('06/18/2025');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
      expect(textbox()).not.toHaveAccessibleDescription();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(new FormData(form).get('d')).toBe('2025-06-18');
    });

    it('keeps text the user is still typing when the parent changes the value', async () => {
      const user = userEvent.setup();
      const props = { 'aria-label': 'Date', locale: 'en-US', onValueChange: () => {} };
      const { rerender } = render(<DatePicker {...props} value={JUNE_15} />);
      await user.clear(textbox());
      await user.type(textbox(), '07/0');
      rerender(<DatePicker {...props} value={new Date(2025, 6, 4)} />);
      expect(textbox()).toHaveFocus();
      expect(textbox()).toHaveValue('07/0');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
    });

    it('keeps typing when the parent re-renders with an inline formatDate', async () => {
      const user = userEvent.setup();
      function Parent() {
        const [, setTick] = React.useState(0);
        return (
          <>
            <DatePicker
              aria-label="Date"
              formatDate={(d) => d.toDateString()}
              parseDate={(text) => (text ? new Date(text) : null)}
            />
            <button type="button" onClick={() => setTick((t) => t + 1)}>
              Re-render
            </button>
          </>
        );
      }
      render(<Parent />);
      await user.type(textbox(), 'Jun 1');
      // fireEvent leaves focus in the input, so the text is not committed by a blur.
      fireEvent.click(screen.getByRole('button', { name: 'Re-render' }));
      expect(textbox()).toHaveFocus();
      expect(textbox()).toHaveValue('Jun 1');
    });

    it('lets Enter submit the form when the text was not edited', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit} aria-label="Form">
          <DatePicker aria-label="Date" defaultValue={JUNE_15} />
          <button type="submit">Save</button>
        </form>,
      );
      textbox().focus();
      await user.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('calendar dialog (input-datetime#2, #6, #20, #21)', () => {
    it.each([
      ['a selected day', { defaultValue: JUNE_15 }],
      [
        'bounds, unavailable days and a clear button',
        {
          defaultValue: JUNE_15,
          minDate: new Date(2025, 5, 10),
          maxDate: new Date(2025, 5, 20),
          disabledDates: (d: Date) => d.getDay() === 6,
          clearable: true,
        },
      ],
    ])('has no accessibility violations while open (%s)', async (_, props) => {
      render(<DatePicker aria-label="Date" defaultOpen {...props} />);
      await act(async () => {}); // let the popup position settle
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(await axe(document.body)).toHaveNoViolations();
    });

    it('exposes the popup on the toggle and as a named modal dialog', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} locale="en-US" />);
      expect(toggle()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(toggle()).not.toHaveAttribute('aria-controls');
      const popup = await openCalendar(user);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(toggle()).toHaveAttribute('aria-controls', popup.id);
      expect(popup).toHaveAttribute('aria-modal', 'true');
      expect(popup).toHaveAccessibleName('June 2025');
      expect(screen.getByRole('grid')).toHaveAccessibleName('June 2025');
    });

    it('flips the calendar above the field when there is no room below (overlays#37)', async () => {
      const html = document.documentElement;
      Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
      Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
      const box = (el: Element) => {
        if (el.getAttribute('role') === 'dialog') return { x: 0, y: 0, width: 280, height: 320 };
        if (el instanceof HTMLDivElement && el.firstElementChild instanceof HTMLInputElement) {
          return { x: 100, y: 700, width: 250, height: 32 };
        }
        return { x: 0, y: 0, width: 0, height: 0 };
      };
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const { x, y, width, height } = box(this);
        const rect = { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
        return { ...rect, toJSON: () => rect } as DOMRect;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return box(this).width;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return box(this).height;
      });
      try {
        render(<DatePicker aria-label="Date" defaultOpen />);
        await waitFor(() => expect(dialog()).toHaveAttribute('data-side', 'top'));
      } finally {
        Reflect.deleteProperty(html, 'clientWidth');
        Reflect.deleteProperty(html, 'clientHeight');
      }
    });

    it('renders the calendar in a portal, positioned below the field', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" data-testid="dp" />);
      const popup = await openCalendar(user);
      expect(screen.getByTestId('dp')).not.toContainElement(popup);
      expect(popup.closest('[data-wave-portal]')).not.toBeNull();
      expect(popup).toHaveAttribute('data-side', 'bottom');
    });

    it('opens from the toggle while the input has focus and stays open', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" />);
      await user.click(textbox());
      await user.click(toggle());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      expect(dialog()).toBeInTheDocument();
    });

    it('moves focus to the selected day on open', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} locale="en-US" />);
      await openCalendar(user);
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
    });

    it('moves focus to today when nothing is selected', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" />);
      await openCalendar(user);
      expect(dayButton('Wednesday, June 18, 2025')).toHaveFocus();
    });

    it('traps Tab inside the calendar', async () => {
      const user = userEvent.setup();
      render(
        <>
          <DatePicker aria-label="Date" defaultValue={JUNE_15} locale="en-US" />
          <button type="button">After</button>
        </>,
      );
      await openCalendar(user);
      await user.tab();
      expect(screen.getByRole('button', { name: 'Previous month' })).toHaveFocus();
      await user.tab();
      await user.tab();
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Next month' })).toHaveFocus();
    });

    it('Escape closes, calls onOpenChange(false) once and returns focus to the toggle', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<DatePicker aria-label="Date" onOpenChange={onOpenChange} />);
      await openCalendar(user);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      onOpenChange.mockClear();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(toggle()).toHaveFocus();
    });

    it('closes on an outside press and focuses the pressed control', async () => {
      const user = userEvent.setup();
      render(
        <>
          <DatePicker aria-label="Date" />
          <input aria-label="Other" />
          <p>Outside</p>
        </>,
      );
      await openCalendar(user);
      await user.click(screen.getByText('Outside'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // Nothing focusable was pressed: focus returns to where the calendar was opened from.
      expect(toggle()).toHaveFocus();
      await openCalendar(user);
      await user.click(screen.getByRole('textbox', { name: 'Other' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Other' })).toHaveFocus();
    });

    it('returns focus to the input after an outside press on a calendar opened from it', async () => {
      const user = userEvent.setup();
      render(
        <>
          <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />
          <p>Outside</p>
        </>,
      );
      textbox().focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
      await user.click(screen.getByText('Outside'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(textbox()).toHaveFocus();
    });

    it('closes when the toggle is pressed again', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" />);
      await openCalendar(user);
      await user.click(toggle());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(toggle()).toHaveFocus();
    });

    it('Alt+ArrowDown in the input opens the calendar', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />);
      textbox().focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(dialog()).toBeInTheDocument();
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
    });

    it('Alt+ArrowDown commits the edited text first and opens on its month', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
        />,
      );
      editText('09/10/2025');
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 9, 10]);
      expect(screen.getByRole('heading', { name: 'September 2025' })).toBeInTheDocument();
      expect(dayButton('Wednesday, September 10, 2025')).toHaveFocus();
    });

    it('Alt+ArrowDown with rejected text reports it once and keeps it', async () => {
      const user = userEvent.setup();
      const onInvalidInput = vi.fn();
      render(<DatePicker aria-label="Date" locale="en-US" onInvalidInput={onInvalidInput} />);
      editText('soon');
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(dialog()).toBeInTheDocument();
      expect(onInvalidInput).toHaveBeenCalledTimes(1);
      expect(onInvalidInput).toHaveBeenCalledWith('soon', 'unparseable');
      expect(textbox()).toHaveValue('soon');
    });

    it('Escape returns focus to the input when the calendar was opened from it', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />);
      textbox().focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(textbox()).toHaveFocus();
      // A later opening from the toggle returns there again.
      await openCalendar(user);
      await user.keyboard('{Escape}');
      expect(toggle()).toHaveFocus();
    });

    it('controlled open: Escape returns focus to the input after an accepted Alt+ArrowDown', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [open, setOpen] = React.useState(false);
        return (
          <DatePicker
            aria-label="Date"
            locale="en-US"
            defaultValue={JUNE_15}
            open={open}
            onOpenChange={setOpen}
          />
        );
      }
      render(<Controlled />);
      textbox().focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(textbox()).toHaveFocus();
    });

    it('controlled open: an Alt+ArrowDown opening the parent declined does not steer a later Escape to the input', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const props = {
        'aria-label': 'Date',
        locale: 'en-US',
        defaultValue: JUNE_15,
        onOpenChange,
      };
      const { rerender } = render(<DatePicker {...props} open={false} />);
      textbox().focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // The parent opens the calendar later on its own (not from the input).
      rerender(<DatePicker {...props} open />);
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      rerender(<DatePicker {...props} open={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(toggle()).toHaveFocus();
    });

    it('does not open or change while read-only, and shows no clear button', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" readOnly defaultValue={JUNE_15} clearable />);
      expect(textbox()).toHaveAttribute('readonly');
      expect(toggle()).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Clear date' })).not.toBeInTheDocument();
      expect(textbox()).toHaveClass('pe-8');
      textbox().focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(textbox()).not.toHaveValue('');
    });

    it('supports defaultOpen (uncontrolled)', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" defaultOpen />);
      expect(dialog()).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('controlled open: stays open when the parent ignores onOpenChange(false)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<DatePicker aria-label="Date" open onOpenChange={onOpenChange} />);
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(dialog()).toBeInTheDocument();
    });

    it('does not call onOpenChange when blur or Enter happen with the calendar closed', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<DatePicker aria-label="Date" locale="en-US" onOpenChange={onOpenChange} />);
      await user.type(textbox(), '06/20/2025{Enter}');
      await user.type(textbox(), '1');
      await user.tab();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('Escape closes only the calendar inside a parent layer (overlays#1)', async () => {
      const user = userEvent.setup();
      const onParentDismiss = vi.fn<(reason: DismissReason) => void>();
      function ParentLayer({ children }: { children: React.ReactNode }) {
        const ref = React.useRef<HTMLDivElement>(null);
        const { layerId } = useDismiss({ open: true, onDismiss: onParentDismiss, refs: [ref] });
        return (
          <DismissLayerProvider layerId={layerId}>
            <div ref={ref}>{children}</div>
          </DismissLayerProvider>
        );
      }
      render(
        <ParentLayer>
          <DatePicker aria-label="Date" />
        </ParentLayer>,
      );
      await openCalendar(user);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onParentDismiss).not.toHaveBeenCalled();
      expect(toggle()).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('selecting a day (input-basic#33, input-datetime#11)', () => {
    it('emits the exact local-midnight date, closes and shows it (uncontrolled)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
          onOpenChange={onOpenChange}
        />,
      );
      await openCalendar(user);
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect((onValueChange.mock.calls[0][0] as Date).getTime()).toBe(
        new Date(2025, 5, 20).getTime(),
      );
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      expect(textbox()).toHaveValue('06/20/2025');
      expect(textbox()).toHaveFocus();
    });

    it('keyboard and mouse selections emit the same start-of-day time', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" locale="en-US" onValueChange={onValueChange} />);
      await openCalendar(user);
      await user.keyboard('{Enter}');
      await user.click(textbox());
      await openCalendar(user);
      await user.click(dayButton('Tuesday, June 17, 2025'));
      await openCalendar(user);
      await user.click(dayButton('Wednesday, June 18, 2025'));
      const [keyboard, , mouse] = onValueChange.mock.calls.map(([d]) => (d as Date).getTime());
      expect(keyboard).toBe(new Date(2025, 5, 18).getTime());
      expect(mouse).toBe(keyboard);
    });

    it('Enter on today works with maxDate={new Date()} (a time of day)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" maxDate={new Date()} onValueChange={onValueChange} />);
      await openCalendar(user);
      await user.keyboard('{Enter}');
      expect((onValueChange.mock.calls[0][0] as Date).getTime()).toBe(
        new Date(2025, 5, 18).getTime(),
      );
    });

    it('Space selects like Enter', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} onValueChange={onValueChange} />);
      await openCalendar(user);
      await user.keyboard('{ArrowRight} ');
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 6, 16]);
    });

    it('does not select an unavailable day', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultOpen
          defaultValue={new Date(2025, 5, 1)}
          disabledDates={(d) => d.getDate() === 15}
          onValueChange={onValueChange}
        />,
      );
      const day15 = dayButton('Sunday, June 15, 2025');
      expect(day15).toHaveAttribute('aria-disabled', 'true');
      await user.click(day15);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(dialog()).toBeInTheDocument();
    });

    it('clears the value and empties the input', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          defaultValue={JUNE_15}
          clearable
          onValueChange={onValueChange}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Clear date' }));
      expect(onValueChange).toHaveBeenCalledWith(null);
      expect(textbox()).toHaveValue('');
      expect(textbox()).toHaveFocus();
    });

    it('clearing while the input holds edited text emits only the clear (input-datetime#13)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onInvalidInput = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          clearable
          onValueChange={onValueChange}
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.clear(textbox());
      await user.type(textbox(), '06/20/2025');
      await user.click(screen.getByRole('button', { name: 'Clear date' }));
      expect(onValueChange.mock.calls).toEqual([[null]]);
      expect(textbox()).toHaveValue('');
      expect(textbox()).toHaveFocus();
    });

    it('clearing while the input holds rejected text reports nothing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onInvalidInput = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          clearable
          onValueChange={onValueChange}
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.clear(textbox());
      await user.type(textbox(), 'someday');
      await user.click(screen.getByRole('button', { name: 'Clear date' }));
      expect(onInvalidInput).not.toHaveBeenCalled();
      expect(onValueChange.mock.calls).toEqual([[null]]);
      expect(textbox()).toHaveValue('');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
    });

    it('Tab from erased text clears the value and moves on to the calendar button: focus never drops to <body>', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <DatePicker
            aria-label="Date"
            defaultValue={JUNE_15}
            clearable
            onValueChange={onValueChange}
          />
        </React.StrictMode>,
      );
      await user.clear(textbox());
      await user.tab();
      // The erased text clears the value before Tab moves focus, so the clear button it removes is
      // skipped: focus goes where Tab goes without it.
      expect(onValueChange.mock.calls).toEqual([[null]]);
      expect(screen.queryByRole('button', { name: 'Clear date' })).not.toBeInTheDocument();
      expect(toggle()).toHaveFocus();
      expect(textbox()).toHaveValue('');
    });

    it('Tab from erased text reaches the clear button when a controlled parent keeps the value', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker aria-label="Date" value={JUNE_15} clearable onValueChange={onValueChange} />,
      );
      await user.clear(textbox());
      await user.tab();
      expect(onValueChange.mock.calls).toEqual([[null]]);
      expect(screen.getByRole('button', { name: 'Clear date' })).toHaveFocus();
    });
  });

  describe('grid keyboard (input-basic#31, input-datetime#4, #5, #12, #17, #18)', () => {
    async function openOn(
      date: Date,
      props: Partial<React.ComponentProps<typeof DatePicker>> = {},
    ) {
      const user = userEvent.setup();
      const utils = render(
        <DatePicker aria-label="Date" locale="en-US" defaultValue={date} {...props} />,
      );
      await openCalendar(user);
      return { user, ...utils };
    }

    function focusedLabel() {
      return document.activeElement?.getAttribute('aria-label');
    }

    it('arrows move focus by a day and a week', async () => {
      const { user } = await openOn(JUNE_15);
      await user.keyboard('{ArrowRight}');
      expect(focusedLabel()).toBe('Monday, June 16, 2025');
      await user.keyboard('{ArrowDown}');
      expect(focusedLabel()).toBe('Monday, June 23, 2025');
      await user.keyboard('{ArrowLeft}');
      expect(focusedLabel()).toBe('Sunday, June 22, 2025');
      await user.keyboard('{ArrowUp}');
      expect(focusedLabel()).toBe('Sunday, June 15, 2025');
    });

    it('keeps one tab stop on the focused day and none on the grid', async () => {
      await openOn(JUNE_15);
      const grid = screen.getByRole('grid');
      expect(grid).not.toHaveAttribute('tabindex');
      const stops = within(grid)
        .getAllByRole('button')
        .filter((b) => b.tabIndex === 0);
      expect(stops).toHaveLength(1);
      expect(stops[0]).toHaveAccessibleName('Sunday, June 15, 2025');
    });

    it('crossing a month boundary changes the heading', async () => {
      const { user } = await openOn(new Date(2025, 5, 30));
      await user.keyboard('{ArrowRight}');
      expect(focusedLabel()).toBe('Tuesday, July 1, 2025');
      expect(screen.getByRole('heading', { name: 'July 2025' })).toBeInTheDocument();
    });

    it('PageDown/PageUp clamp the day to the target month', async () => {
      const { user, unmount } = await openOn(new Date(2025, 0, 31));
      await user.keyboard('{PageDown}');
      expect(focusedLabel()).toBe('Friday, February 28, 2025');
      unmount();
      const second = await openOn(new Date(2025, 2, 31));
      await second.user.keyboard('{PageUp}');
      expect(focusedLabel()).toBe('Friday, February 28, 2025');
    });

    it('Shift+PageDown/PageUp move by a year with the same clamp', async () => {
      const { user } = await openOn(new Date(2024, 1, 29));
      await user.keyboard('{Shift>}{PageDown}{/Shift}');
      expect(focusedLabel()).toBe('Friday, February 28, 2025');
      await user.keyboard('{Shift>}{PageUp}{/Shift}');
      expect(focusedLabel()).toBe('Wednesday, February 28, 2024');
    });

    it('Home/End go to the start/end of the week (Sunday first)', async () => {
      const { user } = await openOn(new Date(2025, 5, 18));
      await user.keyboard('{Home}');
      expect(focusedLabel()).toBe('Sunday, June 15, 2025');
      await user.keyboard('{End}');
      expect(focusedLabel()).toBe('Saturday, June 21, 2025');
    });

    it('Home/End follow firstDayOfWeek', async () => {
      const { user } = await openOn(new Date(2025, 5, 15), { firstDayOfWeek: 1 });
      await user.keyboard('{Home}');
      expect(focusedLabel()).toBe('Monday, June 9, 2025');
      await user.keyboard('{End}');
      expect(focusedLabel()).toBe('Sunday, June 15, 2025');
    });

    it('mirrors ArrowLeft/ArrowRight in RTL', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />, {
        dir: 'rtl',
      });
      await openCalendar(user);
      await user.keyboard('{ArrowLeft}');
      expect(focusedLabel()).toBe('Monday, June 16, 2025');
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(focusedLabel()).toBe('Saturday, June 14, 2025');
    });

    it('the month buttons move the focused day by the same number of months', async () => {
      const { user } = await openOn(JUNE_15);
      await user.click(screen.getByRole('button', { name: 'Next month' }));
      expect(screen.getByRole('heading', { name: 'July 2025' })).toBeInTheDocument();
      const stop = within(screen.getByRole('grid'))
        .getAllByRole('button')
        .find((b) => b.tabIndex === 0);
      expect(stop).toHaveAccessibleName('Tuesday, July 15, 2025');
      stop?.focus();
      await user.keyboard('{ArrowRight}');
      expect(focusedLabel()).toBe('Wednesday, July 16, 2025');
      expect(screen.getByRole('heading', { name: 'July 2025' })).toBeInTheDocument();
    });

    it('works when opened through the controlled open prop', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          open={false}
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
          onOpenChange={onOpenChange}
        />,
      );
      rerender(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          open
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
          onOpenChange={onOpenChange}
        />,
      );
      expect(focusedLabel()).toBe('Sunday, June 15, 2025');
      await user.keyboard('{ArrowDown}{Enter}');
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 6, 22]);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(2);
    });

    it('a clicked unavailable day becomes the roving day (input-datetime#5)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          disabledDates={(d) => d.getDate() === 25}
          onValueChange={onValueChange}
        />,
      );
      await openCalendar(user);
      const day25 = dayButton('Wednesday, June 25, 2025');
      await user.click(day25);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(day25).toHaveFocus();
      expect(day25).toHaveAttribute('tabindex', '0');
      expect(dayButton('Sunday, June 15, 2025')).toHaveAttribute('tabindex', '-1');
      await user.keyboard('{ArrowRight}');
      expect(focusedLabel()).toBe('Thursday, June 26, 2025');
    });

    it('a clicked unavailable day of the next month keeps the month and roves from it', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          maxDate={new Date(2025, 5, 30)}
        />,
      );
      await openCalendar(user);
      const july1 = dayButton('Tuesday, July 1, 2025');
      await user.click(july1);
      expect(screen.getByRole('heading', { name: 'June 2025' })).toBeInTheDocument();
      expect(july1).toHaveFocus();
      expect(july1).toHaveAttribute('tabindex', '0');
      // Focus stays inside the range: back to the last available day.
      await user.keyboard('{ArrowLeft}');
      expect(focusedLabel()).toBe('Monday, June 30, 2025');
    });

    it('keyboard focus stays within minDate/maxDate', async () => {
      const { user } = await openOn(new Date(2025, 5, 19), {
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
  });

  describe('semantics and localisation (input-datetime#7, #8, #19, input-basic#34)', () => {
    it('announces the month and marks the selected day and today', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />);
      await openCalendar(user);
      const heading = screen.getByRole('heading', { name: 'June 2025' });
      expect(heading).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByRole('grid')).toHaveAttribute('aria-labelledby', heading.id);
      const selectedCells = screen
        .getAllByRole('gridcell')
        .filter((cell) => cell.getAttribute('aria-selected') === 'true');
      expect(selectedCells).toHaveLength(1);
      expect(within(selectedCells[0]).getByRole('button')).toHaveAccessibleName(
        'Sunday, June 15, 2025',
      );
      const current = within(screen.getByRole('grid'))
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-current') === 'date');
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveAccessibleName('Wednesday, June 18, 2025');
    });

    it('gives the focused selected day the focus ring, distinct from the today marker', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />);
      await openCalendar(user);
      const selected = dayButton('Sunday, June 15, 2025');
      expect(selected).toHaveFocus();
      expect(selected).toHaveClass(
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-ring',
      );
      expect(selected).toHaveAttribute('data-selected');
      expect(selected).toHaveClass('forced-colors:bg-[Highlight]');
      expect(dayButton('Wednesday, June 18, 2025')).toHaveAttribute('data-today');
    });

    it('orders the column headers by firstDayOfWeek and aligns the first row', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} firstDayOfWeek={1} />,
      );
      await openCalendar(user);
      const headers = screen.getAllByRole('columnheader');
      expect(headers.map((h) => h.getAttribute('aria-label'))).toEqual([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]);
      expect(headers[0]).toHaveTextContent('Mon');
      const firstRow = screen.getAllByRole('row')[1];
      const labels = within(firstRow)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'));
      expect(labels[0]).toBe('Monday, May 26, 2025');
      expect(labels[6]).toBe('Sunday, June 1, 2025');
    });

    it('localises the heading, weekdays and day labels (de-DE)', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Datum" locale="de-DE" defaultValue={JUNE_15} />);
      await user.click(toggle());
      expect(screen.getByRole('heading', { name: 'Juni 2025' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-label', 'Sonntag');
      expect(dayButton('Sonntag, 15. Juni 2025')).toHaveFocus();
      expect(textbox('Datum')).toHaveValue('15.06.2025');
    });

    it('exposes the selected state on the focused day button, not only on its gridcell', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />);
      await openCalendar(user);
      const selected = dayButton('Sunday, June 15, 2025');
      expect(selected).toHaveFocus();
      expect(selected).toHaveAttribute('aria-pressed', 'true');
      const pressed = within(screen.getByRole('grid'))
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed'));
      expect(pressed).toEqual([selected]);
      await user.keyboard('{ArrowRight}');
      expect(dayButton('Monday, June 16, 2025')).toHaveFocus();
      expect(dayButton('Monday, June 16, 2025')).not.toHaveAttribute('aria-pressed');
      // axe on an open calendar with a selected (pressed) day: 'calendar dialog' tests above.
    });

    it('keeps the grid, heading, day labels and text Gregorian when the locale default calendar is not (fa-IR)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="fa-IR"
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
        />,
      );
      expect(textbox()).toHaveValue('۲۰۲۵/۰۶/۱۵');
      await openCalendar(user);
      const gregorian = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('fa-IR', { ...options, calendar: 'gregory' }).format(JUNE_15);
      expect(
        screen.getByRole('heading', { name: gregorian({ month: 'long', year: 'numeric' }) }),
      ).toBeInTheDocument();
      const selected = dayButton(
        gregorian({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      );
      expect(selected).toHaveFocus();
      expect(selected).toHaveTextContent('۱۵');
      await user.keyboard('{Escape}');

      await user.clear(textbox());
      await user.type(textbox(), '۲۰۲۵/۰۶/۲۰{Enter}');
      expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 6, 20]);
      expect(textbox()).toHaveValue('۲۰۲۵/۰۶/۲۰');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
    });

    it('warns once in development about a malformed locale tag and uses the runtime default', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(
        <React.StrictMode>
          <DatePicker aria-label="Date" locale="de_DE" defaultValue={JUNE_15} />
          <DatePicker aria-label="Other" locale="de_DE" />
        </React.StrictMode>,
      );
      expect(textbox()).toHaveValue(formatDate(JUNE_15));
      rerender(
        <React.StrictMode>
          <DatePicker aria-label="Date" locale="de-DE" defaultValue={JUNE_15} />
          <DatePicker aria-label="Other" locale="de_DE" />
        </React.StrictMode>,
      );
      expect(textbox()).toHaveValue('15.06.2025');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] DatePicker: `locale` "de_DE" is not a valid BCP 47 language tag (use ' +
            'hyphens, as in "en-US"). The runtime default locale formats and parses the dates ' +
            'instead, so the server and the browser may render different text.',
        ],
      ]);
    });

    it('uses the runtime locale by default', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} />);
      await openCalendar(user);
      const heading = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
        JUNE_15,
      );
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    });

    it('localises the built-in button names and error texts with labels', async () => {
      const user = userEvent.setup();
      const labels: DatePickerLabels = {
        clear: 'Tøm dato',
        openCalendar: 'Åpne kalender',
        previousMonth: 'Forrige måned',
        nextMonth: 'Neste måned',
        invalidDate: (pattern) => `Skriv en dato som ${pattern ?? '?'}.`,
        outOfRange: (min, max) => `Velg mellom ${min ?? '-'} og ${max ?? '-'}.`,
        unavailableDate: 'Datoen er ikke ledig.',
      };
      render(
        <DatePicker
          aria-label="Dato"
          locale="nb-NO"
          defaultValue={JUNE_15}
          clearable
          minDate={new Date(2025, 5, 1)}
          maxDate={new Date(2025, 5, 30)}
          disabledDates={(date) => date.getDate() === 20}
          labels={labels}
        />,
      );
      expect(screen.getByRole('button', { name: 'Tøm dato' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Åpne kalender' }));
      expect(screen.getByRole('button', { name: 'Forrige måned' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Neste måned' })).toBeInTheDocument();
      await user.keyboard('{Escape}');

      const input = textbox('Dato');
      await user.clear(input);
      await user.type(input, 'snart{Enter}');
      expect(input).toHaveAccessibleDescription('Skriv en dato som DD.MM.YYYY.');
      await user.clear(input);
      await user.type(input, '01.07.2025{Enter}');
      expect(input).toHaveAccessibleDescription('Velg mellom 01.06.2025 og 30.06.2025.');
      await user.clear(input);
      await user.type(input, '20.06.2025{Enter}');
      expect(input).toHaveAccessibleDescription('Datoen er ikke ledig.');
    });

    it('passes no pattern to invalidDate with a custom parseDate, and only the set bound to outOfRange', async () => {
      const user = userEvent.setup();
      const invalidDate = vi.fn((_pattern: string | undefined) => 'Ugyldig.');
      const outOfRange = vi.fn((_min: string | undefined, _max: string | undefined) => 'Utenfor.');
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          formatDate={(date) => formatDate(date, 'en-US')}
          parseDate={(text) => (text === '07/01/2025' ? new Date(2025, 6, 1) : null)}
          maxDate={new Date(2025, 5, 30)}
          labels={{ invalidDate, outOfRange }}
        />,
      );
      await user.type(textbox(), 'soon{Enter}');
      expect(textbox()).toHaveAccessibleDescription('Ugyldig.');
      expect(invalidDate).toHaveBeenLastCalledWith(undefined);
      await user.clear(textbox());
      await user.type(textbox(), '07/01/2025{Enter}');
      expect(textbox()).toHaveAccessibleDescription('Utenfor.');
      expect(outOfRange).toHaveBeenLastCalledWith(undefined, '06/30/2025');
    });
  });

  describe('disabled and bounds (input-basic#32, repo-level#39)', () => {
    it('supports the disabled state', () => {
      render(<DatePicker aria-label="Date" disabled />);
      expect(textbox()).toBeDisabled();
      expect(toggle()).toBeDisabled();
    });

    it('an open picker that becomes disabled shows no grid and cannot select', () => {
      const onValueChange = vi.fn();
      const { rerender } = render(
        <DatePicker aria-label="Date" defaultOpen onValueChange={onValueChange} />,
      );
      expect(screen.getByRole('grid')).toBeInTheDocument();
      rerender(<DatePicker aria-label="Date" defaultOpen disabled onValueChange={onValueChange} />);
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('an uncontrolled calendar closed by disabling stays closed when re-enabled', () => {
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <DatePicker aria-label="Date" defaultOpen onOpenChange={onOpenChange} />,
      );
      expect(dialog()).toBeInTheDocument();
      rerender(<DatePicker aria-label="Date" defaultOpen disabled onOpenChange={onOpenChange} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[false]]);
      rerender(<DatePicker aria-label="Date" defaultOpen onOpenChange={onOpenChange} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(toggle()).not.toHaveFocus();
    });

    it('a read-only uncontrolled calendar stays closed when editable again', () => {
      const { rerender } = render(<DatePicker aria-label="Date" defaultOpen />);
      rerender(<DatePicker aria-label="Date" defaultOpen readOnly />);
      rerender(<DatePicker aria-label="Date" defaultOpen />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['disabled', { disabled: true }],
      ['read-only', { readOnly: true }],
    ])(
      'reports no close for a defaultOpen calendar that starts %s (it was never shown)',
      (_, lock) => {
        const onOpenChange = vi.fn();
        const { rerender } = render(
          <DatePicker aria-label="Date" defaultOpen onOpenChange={onOpenChange} {...lock} />,
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        rerender(<DatePicker aria-label="Date" defaultOpen onOpenChange={onOpenChange} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['read-only', { readOnly: true }],
      ['disabled', { disabled: true }],
    ])('drops typed text when it becomes %s, so no later blur commits it', async (_, lock) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const props = {
        'aria-label': 'Date',
        locale: 'en-US',
        defaultValue: JUNE_15,
        onValueChange,
      };
      const ui = (extra: object) => (
        <>
          <DatePicker {...props} {...extra} />
          <button type="button">After</button>
        </>
      );
      const { rerender } = render(ui({}));
      await user.clear(textbox());
      await user.type(textbox(), '07/01/2025');
      rerender(ui(lock));
      expect(textbox()).toHaveValue('06/15/2025');
      await user.tab();
      // Enabled again: focusing and leaving the field commits nothing either.
      rerender(ui({}));
      expect(textbox()).toHaveValue('06/15/2025');
      await user.click(textbox());
      await user.tab();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(textbox()).toHaveValue('06/15/2025');
    });

    it('drops rejected text and its error when it becomes read-only', async () => {
      const user = userEvent.setup();
      const props = { 'aria-label': 'Date', locale: 'en-US', defaultValue: JUNE_15 };
      const { rerender } = render(<DatePicker {...props} />);
      await user.clear(textbox());
      await user.type(textbox(), 'soon{Enter}');
      expect(textbox()).toHaveAttribute('aria-invalid', 'true');
      rerender(<DatePicker {...props} readOnly />);
      expect(textbox()).toHaveValue('06/15/2025');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('opens inside a range that excludes today', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          minDate={new Date(2024, 0, 1)}
          maxDate={new Date(2024, 11, 31)}
        />,
      );
      await openCalendar(user);
      expect(screen.getByRole('heading', { name: 'December 2024' })).toBeInTheDocument();
      expect(document.activeElement).toHaveAccessibleName('Tuesday, December 31, 2024');
      expect(screen.getByRole('button', { name: 'Next month' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it.each([
      ['Next month', { maxDate: new Date(2025, 11, 31) }, new Date(2025, 11, 10), 'December 2025'],
      ['Previous month', { minDate: new Date(2025, 0, 1) }, new Date(2025, 0, 10), 'January 2025'],
    ])(
      'an aria-disabled %s button ignores clicks and Enter and keeps focus',
      async (name, bounds, value, heading) => {
        const user = userEvent.setup();
        render(<DatePicker aria-label="Date" locale="en-US" defaultValue={value} {...bounds} />);
        await openCalendar(user);
        const button = screen.getByRole('button', { name });
        expect(button).toHaveAttribute('aria-disabled', 'true');
        await user.click(button);
        expect(button).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
        expect(button).toHaveFocus();
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(dialog()).toBeInTheDocument();
      },
    );

    it('keeps focus on an activated month button, so a second Enter moves on again', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
        />,
      );
      await openCalendar(user);
      await user.tab();
      await user.tab();
      const next = screen.getByRole('button', { name: 'Next month' });
      expect(next).toHaveFocus();
      await user.keyboard('{Enter}{Enter}');
      expect(screen.getByRole('heading', { name: 'August 2025' })).toBeInTheDocument();
      expect(next).toHaveFocus();
      expect(dialog()).toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('navigates months with the header buttons', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" defaultOpen defaultValue={JUNE_15} />);
      await user.click(screen.getByRole('button', { name: 'Previous month' }));
      expect(screen.getByRole('heading', { name: 'May 2025' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Next month' }));
      await user.click(screen.getByRole('button', { name: 'Next month' }));
      expect(screen.getByRole('heading', { name: 'July 2025' })).toBeInTheDocument();
    });
  });

  describe('Field and routing (input-basic#1, C-ROUTING)', () => {
    it('is named by the Field label and described by its hint and error', () => {
      renderWithFieldContext(<DatePicker />, {
        hintId: FIELD_TEST_IDS.hintId,
        errorId: FIELD_TEST_IDS.errorId,
        required: true,
      });
      const input = textbox(FIELD_TEST_TEXT.label);
      expect(input).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
      expect(input).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
      renderWithFieldContext(
        <form aria-label="Form">
          <DatePicker required={false} />
        </form>,
        { required: true },
      );
      const input = textbox(FIELD_TEST_TEXT.label);
      expect(input).not.toHaveAttribute('aria-required', 'true');
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });

    it('leaves the error text to a Field that renders its own error', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(<DatePicker locale="en-GB" />, { errorId: FIELD_TEST_IDS.errorId });
      await user.type(textbox(FIELD_TEST_TEXT.label), 'abc{Enter}');
      expect(textbox(FIELD_TEST_TEXT.label)).toHaveAccessibleDescription(FIELD_TEST_TEXT.error);
      expect(screen.queryByText(/Enter a date/)).not.toBeInTheDocument();
    });

    it('routes id, aria-describedby, focus handlers and controlRef to the input', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <>
          <p id="help">Your birthday</p>
          <DatePicker
            id="birthday"
            aria-label="Birthday"
            aria-describedby="help"
            onFocus={onFocus}
            onBlur={onBlur}
            controlRef={controlRef}
            data-testid="dp"
          />
        </>,
      );
      const input = textbox('Birthday');
      expect(input).toHaveAttribute('id', 'birthday');
      expect(input).toHaveAccessibleDescription('Your birthday');
      expect(controlRef.current).toBe(input);
      expect(screen.getByTestId('dp')).not.toHaveAttribute('id');
      await user.click(input);
      await user.tab();
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('routes the text input attributes autoCapitalize and autoCorrect to the input', () => {
      render(
        <DatePicker aria-label="Date" autoCapitalize="none" autoCorrect="off" data-testid="root" />,
      );
      expect(textbox()).toHaveAttribute('autocapitalize', 'none');
      expect(textbox()).toHaveAttribute('autocorrect', 'off');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocapitalize');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocorrect');
    });

    it('composes a consumer onKeyDown; preventDefault suppresses the Enter commit', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
        if (event.key === 'Enter') event.preventDefault();
      });
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          onKeyDown={onKeyDown}
          onValueChange={onValueChange}
        />,
      );
      await user.type(textbox(), '06/20/2025{Enter}');
      expect(onKeyDown).toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('types the routed focus and key handlers as input handlers', async () => {
      expectTypeOf<DatePickerProps['onFocus']>().toEqualTypeOf<
        React.FocusEventHandler<HTMLInputElement> | undefined
      >();
      expectTypeOf<DatePickerProps['onBlur']>().toEqualTypeOf<
        React.FocusEventHandler<HTMLInputElement> | undefined
      >();
      expectTypeOf<DatePickerProps['onKeyDown']>().toEqualTypeOf<
        React.KeyboardEventHandler<HTMLInputElement> | undefined
      >();
      expectTypeOf<DatePickerProps['onKeyUp']>().toEqualTypeOf<
        React.KeyboardEventHandler<HTMLInputElement> | undefined
      >();
      const user = userEvent.setup();
      const seen: string[] = [];
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          onFocus={(event) => seen.push(`focus:${event.currentTarget.value}`)}
          onKeyUp={(event) => seen.push(`keyup:${event.currentTarget.value}`)}
          onBlur={(event) => seen.push(`blur:${event.currentTarget.value}`)}
        />,
      );
      await user.click(textbox());
      await user.keyboard('1');
      await user.tab();
      expect(seen).toEqual(['focus:', 'keyup:1', 'blur:1']);
    });
  });

  describe('forms (input-basic#12)', () => {
    it('submits the ISO yyyy-mm-dd value under its name', () => {
      const { container } = render(
        <form aria-label="Form">
          <DatePicker aria-label="Date" name="due" defaultValue={new Date(2025, 3, 3, 23, 30)} />
        </form>,
      );
      const form = container.querySelector('form') as HTMLFormElement;
      expect(new FormData(form).get('due')).toBe('2025-04-03');
    });

    it('adds nothing to FormData without a name', () => {
      const { container } = render(
        <form aria-label="Form">
          <DatePicker aria-label="Date" defaultValue={JUNE_15} />
        </form>,
      );
      const form = container.querySelector('form') as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
    });

    it('resets to its default with the form (also without a name)', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <form aria-label="Form">
          <DatePicker aria-label="Named" name="due" locale="en-US" defaultValue={JUNE_15} />
          <DatePicker aria-label="Unnamed" locale="en-US" defaultValue={JUNE_15} />
        </form>,
      );
      await user.clear(textbox('Named'));
      await user.type(textbox('Named'), '07/01/2025{Enter}');
      await user.clear(textbox('Unnamed'));
      await user.type(textbox('Unnamed'), '07/02/2025{Enter}');
      const form = container.querySelector('form') as HTMLFormElement;
      expect(new FormData(form).get('due')).toBe('2025-07-01');
      act(() => form.reset());
      expect(textbox('Named')).toHaveValue('06/15/2025');
      expect(textbox('Unnamed')).toHaveValue('06/15/2025');
      expect(new FormData(form).get('due')).toBe('2025-06-15');
    });

    it('a reset emits the default as local midnight, and nothing when the day is unchanged (C-FORMS)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      function Parent() {
        const [, setTick] = React.useState(0);
        return (
          <form aria-label="Form">
            {/* A new default object on every render, with a time of day. */}
            <DatePicker
              aria-label="Date"
              locale="en-US"
              defaultValue={new Date(2025, 5, 15, 14, 30)}
              onValueChange={onValueChange}
            />
            <button type="button" onClick={() => setTick((t) => t + 1)}>
              Re-render
            </button>
          </form>
        );
      }
      render(<Parent />);
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      await user.click(screen.getByRole('button', { name: 'Re-render' }));
      act(() => form.reset());
      expect(onValueChange).not.toHaveBeenCalled();

      await user.clear(textbox());
      await user.type(textbox(), '07/01/2025{Enter}');
      onValueChange.mockClear();
      act(() => form.reset());
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const reset = onValueChange.mock.calls[0][0] as Date;
      expect(reset.getTime()).toBe(new Date(2025, 5, 15).getTime());
      expect(textbox()).toHaveValue('06/15/2025');
    });

    it.each([
      ['rejected text', 'soon{Tab}'],
      ['uncommitted text', '07/0'],
    ])('a reset drops %s and its error', async (_, keys) => {
      const user = userEvent.setup();
      render(
        <form aria-label="Form">
          <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />
          <button type="button">After</button>
        </form>,
      );
      await user.clear(textbox());
      await user.type(textbox(), keys);
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      act(() => form.reset());
      expect(textbox()).toHaveValue('06/15/2025');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
      expect(textbox()).not.toHaveAccessibleDescription();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('blocks submission while required and empty', () => {
      const { container } = render(
        <form aria-label="Form">
          <DatePicker aria-label="Date" name="due" required />
        </form>,
      );
      const form = container.querySelector('form') as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
      expect(textbox()).toHaveAttribute('aria-required', 'true');
    });

    it('focuses the input when the form reports it missing', () => {
      render(
        <form aria-label="Form">
          <DatePicker aria-label="Date" name="due" required />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(textbox()).not.toHaveFocus();
      act(() => {
        form.reportValidity();
      });
      expect(textbox()).toHaveFocus();
    });

    it('a disabled picker is not submitted and does not block submission', () => {
      render(
        <form aria-label="Form">
          <DatePicker aria-label="Date" name="due" defaultValue={JUNE_15} disabled />
          <DatePicker aria-label="Empty" name="empty" required disabled />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
      expect(form.checkValidity()).toBe(true);
    });

    it.each([
      ['its own required', { required: true, 'aria-label': 'Due' }, undefined],
      ['a required Field', {}, { required: true }],
    ])('does not block submission while read-only with %s', (_, props, fieldValue) => {
      const ui = (
        <form aria-label="Form">
          <DatePicker name="due" readOnly {...props} />
        </form>
      );
      if (fieldValue) renderWithFieldContext(ui, fieldValue);
      else render(ui);
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      // Like a native readonly input, it is barred from constraint validation: the user could
      // not fix it.
      expect(form.checkValidity()).toBe(true);
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
      expect(new FormData(form).get('due')).toBe('');
    });
  });

  describe('callbacks (input-basic#29)', () => {
    it('fires once per interaction in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <DatePicker
            aria-label="Date"
            locale="en-US"
            defaultValue={JUNE_15}
            onValueChange={onValueChange}
          />
        </React.StrictMode>,
      );
      await openCalendar(user);
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('does not fire when the selected day is picked again', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          onValueChange={onValueChange}
        />,
      );
      await openCalendar(user);
      await user.click(dayButton('Sunday, June 15, 2025'));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('keeps the deprecated onChange alias working and warns once', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onChange = vi.fn();
      const { rerender } = render(
        <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} onChange={onChange} />,
      );
      rerender(
        <DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} onChange={onChange} />,
      );
      await openCalendar(user);
      await user.click(dayButton('Friday, June 20, 2025'));
      expect(fields(onChange.mock.calls[0][0] as Date)).toEqual([2025, 6, 20]);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] DatePicker: `onChange` is deprecated and will be removed in 1.0. Use ' +
            '`onValueChange` instead.',
        ],
      ]);
    });
  });

  describe('CustomFormat story', () => {
    const { CustomFormat } = composeStories(stories);

    it('its parseDate rejects impossible days instead of rolling them over', async () => {
      const user = userEvent.setup();
      render(<CustomFormat />);
      await user.clear(textbox());
      await user.type(textbox(), '2025-02-30{Enter}');
      // Rolled over, it would be committed and shown as 2025-03-02.
      expect(textbox()).toHaveValue('2025-02-30');
      expect(textbox()).toHaveAttribute('aria-invalid', 'true');
      expect(textbox()).toHaveAccessibleDescription('Enter a valid date.');
      await user.clear(textbox());
      await user.type(textbox(), '2025-03-02{Enter}');
      expect(textbox()).toHaveValue('2025-03-02');
      expect(textbox()).not.toHaveAttribute('aria-invalid');
    });
  });

  it('has no accessibility violations with an invalid entry', async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" locale="en-GB" />);
    await user.type(textbox(), 'soon{Enter}');
    expect(textbox()).toHaveAttribute('aria-invalid', 'true');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
