import * as React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
  expectTypeOf,
  onTestFinished,
  vi,
} from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/DatePicker.stories';
import type { CalendarLabels } from '../Calendar';
import { DatePicker, type DatePickerLabels, type DatePickerProps } from '../DatePicker';
import { formatDate } from '../dateUtils';
import {
  axe,
  expectInertSlotProps,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  openingTags,
  renderWithProviders,
  testNoImplicitSubmit,
  testRootPartRef,
  testSystemProps,
  UNKNOWN_PROP,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { datePickerClassNames } from '../../../lib/classNames';
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
    ref: 'control',
    control: { role: 'textbox', tag: 'input' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true, defaultValue: JUNE_15, clearable: true } },
    ],
  });

  testRootPartRef(DatePicker, { props: { 'aria-label': 'Date picker' } });

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
      expect(toggle()).toHaveClass('wave:h-6', 'wave:w-6', 'wave:end-1');
      expect(textbox()).toHaveClass('wave:pe-8');
      unmount();
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} clearable />);
      // Toggle at 4–28px from the end, clear button at 28–52px: two adjacent 24px targets.
      expect(screen.getByRole('button', { name: 'Clear date' })).toHaveClass(
        'wave:h-6',
        'wave:w-6',
        'wave:end-7',
      );
      expect(textbox()).toHaveClass('wave:pe-14');
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
        expect(button).toHaveClass('wave:p-0');
        expect(button).toHaveClass('wave:bg-transparent');
      }
      // The selected day keeps its own fill.
      expect(dayButton('Sunday, June 15, 2025')).toHaveClass('wave:data-[selected]:bg-primary');
    });

    it('uses theme tokens and gates hover on every button (button-provider#3)', () => {
      render(<DatePicker aria-label="Date" defaultValue={JUNE_15} clearable defaultOpen />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(40); // toggle, clear, month buttons and 42 days
      for (const button of buttons) {
        expect(button.className).not.toMatch(RAW_COLOR_OR_ENABLED);
        expect(button).toHaveClass('wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover');
      }
      expect(textbox()).toHaveClass('wave:focus:outline-hidden');
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
        expect(icon).toHaveClass('wave:wave-rtl:-scale-x-100');
        expect(icon?.getAttribute('class')).not.toMatch(/(^|\s)wave:rtl:/);
      }
    });

    it('draws the destructive border while the input is invalid', async () => {
      const user = userEvent.setup();
      const invalidClasses = ['wave:border-destructive'];
      const { unmount } = render(<DatePicker aria-label="Date" locale="en-US" />);
      expect(textbox()).toHaveClass('wave:border-input', 'wave:border-b-stroke-accessible');
      for (const name of invalidClasses) expect(textbox()).not.toHaveClass(name);
      // Its own rejected text.
      await user.type(textbox(), 'soon{Enter}');
      expect(textbox()).toHaveAttribute('aria-invalid', 'true');
      expect(textbox()).toHaveClass(...invalidClasses);
      expect(textbox()).not.toHaveClass('wave:border-input');
      expect(textbox()).not.toHaveClass('wave:border-b-stroke-accessible');
      // Keeps the destructive border and shows the focus color on the focused bottom border
      // (Phase 4 D4).
      expect(textbox()).toHaveClass('wave:focus:border-b-primary');
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
      expect(screen.getByRole('button', { name: 'June 2025' })).toHaveFocus();
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
      expect(textbox()).toHaveClass('wave:pe-8');
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

    it('an unavailable day that has keyboard focus shows its focus ring at full strength', async () => {
      const { user } = await openOn(JUNE_15, { disabledDates: (d) => d.getDate() === 16 });
      await user.keyboard('{ArrowRight}');
      const day16 = dayButton('Monday, June 16, 2025');
      expect(day16).toHaveFocus();
      expect(day16).toHaveAttribute('aria-disabled', 'true');
      // Dimmed, except while its ring shows: `opacity` would dim the ring below 3:1. The variant's
      // higher specificity wins over `aria-disabled:opacity-50` while it matches.
      expect(day16).toHaveClass(
        'wave:aria-disabled:line-through',
        'wave:aria-disabled:opacity-50',
        'wave:aria-disabled:focus-visible:opacity-100',
      );
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
        'wave:focus-visible:outline-2',
        'wave:focus-visible:outline-offset-2',
        'wave:focus-visible:outline-ring',
      );
      expect(selected).toHaveAttribute('data-selected');
      expect(selected).toHaveClass('wave:forced-colors:bg-[Highlight]');
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

    it('routes id, aria-describedby, focus handlers and ref to the input', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const ref = React.createRef<HTMLInputElement>();
      render(
        <>
          <p id="help">Your birthday</p>
          <DatePicker
            id="birthday"
            aria-label="Birthday"
            aria-describedby="help"
            onFocus={onFocus}
            onBlur={onBlur}
            ref={ref}
            data-testid="dp"
          />
        </>,
      );
      const input = textbox('Birthday');
      expect(input).toHaveAttribute('id', 'birthday');
      expect(input).toHaveAccessibleDescription('Your birthday');
      expect(ref.current).toBe(input);
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

    it('has no onChange alias of onValueChange: the 0.4 name is removed in 1.0', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          // @ts-expect-error -- `onChange(date)` is removed in 1.0: use `onValueChange`
          onChange={onChange}
          onValueChange={onValueChange}
        />,
      );
      await openCalendar(user);
      await user.click(dayButton('Friday, June 20, 2025'));
      await user.clear(textbox());
      await user.type(textbox(), '6/25/2025{Enter}');
      expect(onValueChange.mock.calls.map(([date]) => fields(date as Date))).toEqual([
        [2025, 6, 20],
        [2025, 6, 25],
      ]);
      // Untyped code that still passes it gets no value: it is never called with a date.
      expect(onChange).not.toHaveBeenCalledWith(expect.any(Date));
      expect(warn).not.toHaveBeenCalled();
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

  describe('the shared calendar (0.10)', () => {
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

    it('names the dialog and the grid by the month text, with the heading button inside the heading', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" defaultValue={JUNE_15} />);
      await user.click(toggle());
      const popup = dialog();
      expect(popup).toHaveAccessibleName('June 2025');
      expect(within(popup).getByRole('grid')).toHaveAccessibleName('June 2025');
      const heading = within(popup).getByRole('heading', { level: 2, name: 'June 2025' });
      const button = within(heading).getByRole('button', { name: 'June 2025' });
      expect(button).toHaveAccessibleDescription('Choose a month');
      expect(heading).not.toContainElement(
        document.getElementById(button.getAttribute('aria-describedby') ?? ''),
      );
    });

    it('keeps the dialog open on Escape in its month view, focus inside the dialog', async () => {
      const escapes = trackEscapes();
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          onOpenChange={onOpenChange}
        />,
      );
      await user.click(toggle());
      const popup = dialog();
      await user.click(within(popup).getByRole('button', { name: 'June 2025' }));
      expect(within(popup).getByRole('grid')).toHaveAccessibleName('2025');
      expect(popup).toContainElement(document.activeElement as HTMLElement);
      await user.click(within(popup).getByRole('button', { name: '2025' }));
      expect(popup).toContainElement(document.activeElement as HTMLElement);
      await user.keyboard('{Escape}');
      await act(async () => {});
      expect(within(popup).getByRole('grid')).toHaveAccessibleName('2025');
      expect(popup).toContainElement(document.activeElement as HTMLElement);
      await user.keyboard('{Escape}');
      await act(async () => {});
      expect(within(popup).getByRole('grid')).toHaveAccessibleName('June 2025');
      expect(document.activeElement).toHaveAccessibleName('Sunday, June 15, 2025');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(escapes).toEqual([true, true, true]);
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('forwards week numbers, firstWeekOfYear and firstDayOfWeek to its calendar', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          showWeekNumbers
          firstDayOfWeek={1}
          firstWeekOfYear="first-four-day-week"
        />,
      );
      await user.click(toggle());
      const rowHeaders = within(dialog()).getAllByRole('rowheader');
      expect(rowHeaders[0]).toHaveAttribute('aria-label', 'Week 22');
      expect(rowHeaders[1]).toHaveAttribute('aria-label', 'Week 23');
      expect(within(dialog()).getAllByRole('columnheader')[0]).toHaveAccessibleName('Week');
    });

    it('forwards markedDates, renderDay and dayLabel', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          markedDates={(date) => date.getDate() === 16}
          renderDay={(date, content) => (date.getDate() === 17 ? <>{content} (3)</> : content)}
          dayLabel={(date, label) => (date.getDate() === 17 ? `${label}, 3 events` : label)}
        />,
      );
      await user.click(toggle());
      expect(dayButton('Monday, June 16, 2025, marked')).toHaveAttribute('data-marked');
      expect(dayButton('Tuesday, June 17, 2025, 3 events')).toHaveTextContent('17 (3)');
    });

    it('forwards today and initialVisibleDate', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          today={new Date(2031, 2, 9)}
          initialVisibleDate={new Date(2031, 2, 1)}
        />,
      );
      await user.click(toggle());
      expect(screen.getByRole('grid')).toHaveAccessibleName('March 2031');
      expect(dayButton('Sunday, March 9, 2031')).toHaveAttribute('aria-current', 'date');
      expect(document.activeElement).toHaveAccessibleName('Sunday, March 9, 2031');
    });

    it('showMonthPicker={false} keeps the month text plain', async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          showMonthPicker={false}
        />,
      );
      await user.click(toggle());
      expect(within(dialog()).queryByRole('button', { name: 'June 2025' })).not.toBeInTheDocument();
      expect(within(dialog()).getByRole('heading', { name: 'June 2025' })).toBeInTheDocument();
    });

    it('showGoToToday adds the footer button, which focuses today without picking it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={new Date(2025, 8, 3)}
          showGoToToday
          onValueChange={onValueChange}
        />,
      );
      await user.click(toggle());
      await user.click(within(dialog()).getByRole('button', { name: 'Go to today' }));
      expect(screen.getByRole('grid')).toHaveAccessibleName('June 2025');
      expect(document.activeElement).toHaveAccessibleName('Wednesday, June 18, 2025');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('has no footer by default', async () => {
      const user = userEvent.setup();
      render(<DatePicker aria-label="Date" locale="en-US" />);
      await user.click(toggle());
      expect(within(dialog()).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(
        within(dialog()).queryByRole('button', { name: 'Go to today' }),
      ).not.toBeInTheDocument();
    });

    describe('showCloseButton', () => {
      it('closes the calendar and returns focus to the toggle, as Escape does', async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
          <DatePicker
            aria-label="Date"
            locale="en-US"
            showCloseButton
            onOpenChange={onOpenChange}
          />,
        );
        await user.click(toggle());
        await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(toggle()).toHaveFocus();
        expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
      });

      it('returns focus to the input after Alt+ArrowDown, as Escape does', async () => {
        const user = userEvent.setup();
        render(<DatePicker aria-label="Date" locale="en-US" showCloseButton />);
        act(() => textbox().focus());
        await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
        await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(textbox()).toHaveFocus();
      });

      it('Escape on the footer buttons steps back in the month view and closes only from the days', async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
          <DatePicker
            aria-label="Date"
            locale="en-US"
            defaultValue={JUNE_15}
            showCloseButton
            showGoToToday
            onOpenChange={onOpenChange}
          />,
        );
        await user.click(toggle());
        await user.click(within(dialog()).getByRole('button', { name: 'June 2025' }));
        for (const name of ['Go to today', 'Close']) {
          act(() => within(dialog()).getByRole('button', { name }).focus());
          await user.keyboard('{Escape}');
          expect(screen.getByRole('dialog')).toBeInTheDocument();
          expect(screen.getByRole('grid')).toHaveAccessibleName('June 2025');
          await user.click(within(dialog()).getByRole('button', { name: 'June 2025' }));
        }
        expect(onOpenChange.mock.calls).toEqual([[true]]);
        act(() => within(dialog()).getByRole('button', { name: 'Close' }).focus());
        await user.keyboard('{Escape}');
        expect(screen.getByRole('grid')).toHaveAccessibleName('June 2025');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        act(() => within(dialog()).getByRole('button', { name: 'Close' }).focus());
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
      });

      it('closes from the month view too, and selects nothing', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
          <DatePicker
            aria-label="Date"
            locale="en-US"
            defaultValue={JUNE_15}
            showCloseButton
            onValueChange={onValueChange}
          />,
        );
        await user.click(toggle());
        await user.click(within(dialog()).getByRole('button', { name: 'June 2025' }));
        await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('is the last tab stop of the dialog, after Go to today, and the trap wraps to the previous-month button', async () => {
        const user = userEvent.setup();
        render(<DatePicker aria-label="Date" locale="en-US" showCloseButton showGoToToday />);
        await user.click(toggle());
        expect(document.activeElement).toHaveAccessibleName('Wednesday, June 18, 2025');
        await user.tab();
        expect(document.activeElement).toHaveAccessibleName('Go to today');
        await user.tab();
        expect(document.activeElement).toHaveAccessibleName('Close');
        await user.tab();
        expect(document.activeElement).toHaveAccessibleName('Previous month');
      });

      it('localizes its name with labels.close, and the footer with labels.goToToday', async () => {
        const user = userEvent.setup();
        const labels: DatePickerLabels = { close: 'Schließen', goToToday: 'Heute' };
        render(<DatePicker aria-label="Date" showCloseButton showGoToToday labels={labels} />);
        await user.click(toggle());
        expect(within(dialog()).getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
        expect(within(dialog()).getByRole('button', { name: 'Heute' })).toBeInTheDocument();
      });

      it('passes axe with the footer', async () => {
        const user = userEvent.setup();
        render(<DatePicker aria-label="Date" locale="en-US" showCloseButton showGoToToday />);
        await user.click(toggle());
        expect(await axe(document.body)).toHaveNoViolations();
      });

      it('gives its footer buttons their own padding, background and gated hover', async () => {
        const user = userEvent.setup();
        render(<DatePicker aria-label="Date" locale="en-US" showCloseButton showGoToToday />);
        await user.click(toggle());
        for (const name of ['Close', 'Go to today']) {
          expect(within(dialog()).getByRole('button', { name })).toHaveClass(
            'wave:p-0',
            'wave:bg-transparent',
            'wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover',
            'wave:focus-visible:outline-2',
          );
        }
      });
    });

    it('types its labels as the calendar labels with close', () => {
      expectTypeOf<DatePickerLabels>().toExtend<CalendarLabels>();
      expectTypeOf<DatePickerLabels['close']>().toEqualTypeOf<string | undefined>();
    });
  });

  it('has no accessibility violations with an invalid entry', async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" locale="en-GB" />);
    await user.type(textbox(), 'soon{Enter}');
    expect(textbox()).toHaveAttribute('aria-invalid', 'true');
    expect(await axe(document.body)).toHaveNoViolations();
  });

  describe('sizes and appearances (Phase 4 P4-01)', () => {
    const renderPicker = (props: Partial<DatePickerProps> = {}) =>
      render(
        <DatePicker aria-label="Due" clearable defaultValue={new Date(2026, 0, 5)} {...props} />,
      );
    const input = () => screen.getByRole('textbox', { name: 'Due' });
    const root = () => input().closest('[data-size]') as HTMLElement;
    const calendar = () => screen.getByRole('button', { name: 'Open calendar' });
    const clear = () => screen.getByRole('button', { name: 'Clear date' });

    it('keeps the 0.7 classes and renders the medium outline attributes', () => {
      renderPicker();
      expect(input()).toHaveClass(
        'wave:h-8',
        'wave:px-3',
        'wave:text-body-1',
        'wave:border-input',
        'wave:pe-14',
      );
      expect(calendar()).toHaveClass('wave:h-6', 'wave:w-6', 'wave:end-1');
      expect(clear()).toHaveClass('wave:h-6', 'wave:w-6', 'wave:end-7');
      expect(root()).toHaveAttribute('data-size', 'medium');
      expect(root()).toHaveAttribute('data-appearance', 'outline');
    });

    it('small: 20px buttons with hit layers at end-1 and end-7, pe-13', () => {
      renderPicker({ size: 'small' });
      expect(input()).toHaveClass('wave:h-6', 'wave:px-2', 'wave:text-caption-1', 'wave:pe-13');
      expect(calendar()).toHaveClass('wave:size-5', 'wave:before:-inset-0.5', 'wave:end-1');
      expect(clear()).toHaveClass('wave:size-5', 'wave:before:-inset-0.5', 'wave:end-7');
    });

    it('large: 32px buttons at end-1 and end-9, pe-18, 20px glyphs', () => {
      renderPicker({ size: 'large' });
      expect(input()).toHaveClass('wave:h-10', 'wave:px-4', 'wave:text-body-2', 'wave:pe-18');
      expect(calendar()).toHaveClass('wave:size-8', 'wave:end-1');
      expect(clear()).toHaveClass('wave:size-8', 'wave:end-9');
      expect(calendar().querySelector('svg')).toHaveAttribute('width', '20');
    });

    it('an appearance styles the input; the calendar dialog does not change', async () => {
      const user = userEvent.setup();
      renderPicker({ appearance: 'underline', size: 'large' });
      expect(input()).toHaveClass('wave:border-0', 'wave:border-b');
      await user.click(calendar());
      expect(screen.getByRole('dialog')).toHaveClass('wave:p-3', 'wave:shadow-16');
    });

    it('takes the Field size', () => {
      renderWithFieldContext(<DatePicker />, { size: 'small' });
      const el = screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label });
      expect(el.closest('[data-size]')).toHaveAttribute('data-size', 'small');
    });

    // Spec cases added beyond the brief (§2.1's Tests paragraph, binding via §2.2's "as §2.1 for
    // each picker"): each appearance with its data-appearance; the Field size with an own size
    // winning; WaveProvider inputDefaults with own props winning; invalid (a Field error and
    // DatePicker's own rejected-text invalid state) at underline and filled-darker; the glyph
    // widths per size for both buttons; RTL.

    it.each([
      ['underline', ['wave:rounded-none', 'wave:border-0', 'wave:border-b', 'wave:bg-transparent']],
      ['filled-darker', ['wave:border-input-filled-stroke', 'wave:bg-input-filled-darker']],
      ['filled-lighter', ['wave:border-input-filled-stroke', 'wave:bg-input-filled-lighter']],
    ] as const)(
      'appearance="%s" renders its classes and data-appearance',
      (appearance, classes) => {
        renderPicker({ appearance });
        expect(input()).toHaveClass(...classes);
        expect(root()).toHaveAttribute('data-appearance', appearance);
      },
    );

    it('takes the Field size; its own size wins', () => {
      const { rerender } = renderWithFieldContext(<DatePicker />, { size: 'large' });
      const byName = () =>
        screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label }).closest('[data-size]');
      expect(byName()).toHaveAttribute('data-size', 'large');
      rerender(<DatePicker size="small" />);
      expect(byName()).toHaveAttribute('data-size', 'small');
    });

    it('takes WaveProvider inputDefaults; its own props win', () => {
      const { rerender } = renderWithProviders(<DatePicker aria-label="Due" />, {
        inputDefaults: { size: 'small', appearance: 'underline' },
      });
      expect(root()).toHaveAttribute('data-size', 'small');
      expect(root()).toHaveAttribute('data-appearance', 'underline');
      rerender(<DatePicker aria-label="Due" size="large" appearance="outline" />);
      expect(root()).toHaveAttribute('data-size', 'large');
      expect(root()).toHaveAttribute('data-appearance', 'outline');
    });

    it.each(['underline', 'filled-darker'] as const)(
      'an invalid %s field keeps the destructive border and the focus color on its bottom (Field error)',
      (appearance) => {
        renderWithFieldContext(<DatePicker appearance={appearance} />, {
          errorId: FIELD_TEST_IDS.errorId,
        });
        const byName = screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label });
        expect(byName).toHaveClass('wave:border-destructive', 'wave:focus:border-b-primary');
      },
    );

    it.each(['underline', 'filled-darker'] as const)(
      'a rejected date at appearance="%s" keeps the destructive border and the focus color on its bottom (DatePicker\'s own invalid state)',
      async (appearance) => {
        const user = userEvent.setup();
        renderPicker({ appearance });
        await user.clear(input());
        await user.type(input(), 'soon');
        await user.keyboard('{Enter}');
        expect(input()).toHaveAttribute('aria-invalid', 'true');
        expect(input()).toHaveClass('wave:border-destructive', 'wave:focus:border-b-primary');
      },
    );

    it.each([
      ['small', 12],
      ['medium', 16],
      ['large', 20],
    ] as const)('glyph widths at size=%s: %spx for both buttons', (size, px) => {
      renderPicker({ size });
      expect(calendar().querySelector('svg')).toHaveAttribute('width', String(px));
      expect(clear().querySelector('svg')).toHaveAttribute('width', String(px));
    });

    it('keeps the buttons at the inline end in RTL', () => {
      renderWithProviders(
        <DatePicker aria-label="Due" size="large" clearable defaultValue={new Date(2026, 0, 5)} />,
        { dir: 'rtl' },
      );
      expect(screen.getByRole('button', { name: 'Open calendar' })).toHaveClass('wave:end-1');
      expect(screen.getByRole('button', { name: 'Clear date' })).toHaveClass('wave:end-9');
    });
  });
});

describe('DatePicker — slotProps', () => {
  type DatePickerSlotProps = NonNullable<DatePickerProps['slotProps']>;
  const EVERY_PART: DatePickerSlotProps = {
    root: {},
    input: {},
    clearButton: {},
    openCalendarButton: {},
    errorMessage: {},
    surface: {},
    header: {},
    previousMonthButton: {},
    heading: {},
    headingButton: {},
    nextMonthButton: {},
    grid: {},
    weekday: {},
    weekNumberHeader: {},
    weekNumber: {},
    day: {},
    markedDot: {},
    month: {},
    year: {},
    footer: {},
    todayButton: {},
    closeButton: {},
  };
  const k = datePickerClassNames;
  /** Every part: a value to clear, week numbers, a marked day (the 20th), a bound and both footer buttons. */
  const FULL = {
    'aria-label': 'Date',
    locale: 'en-US',
    today: new Date(2025, 5, 12),
    defaultValue: JUNE_15,
    minDate: new Date(2025, 5, 3),
    clearable: true,
    showWeekNumbers: true,
    showGoToToday: true,
    showCloseButton: true,
    markedDates: (date: Date) => date.getDate() === 20,
  } satisfies DatePickerProps;
  const all = (name: string, root: ParentNode = document) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${name}`));
  const part = (name: string) => document.querySelector<HTMLElement>(`.${name}`);
  const select = (selectors: string[]) =>
    selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  /** The pinned days: unavailable, today, selected, marked, plain and outside the month. */
  const DAYS = ['2025-06-01', '2025-06-12', '2025-06-15', '2025-06-20', '2025-06-21', '2025-07-01'];

  /** Types text that is no date and presses Enter: the error message shows. */
  function typeRejected() {
    const input = textbox();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'zz' } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }

  it('renders the 0.17.1 parts without slotProps (opening tags, attributes sorted)', async () => {
    // Captured from dbf64ac, open client renders: the merged props may put the class before the
    // locked attributes.
    const { unmount } = render(<DatePicker {...FULL} defaultOpen />);
    await act(async () => {});
    expect(
      openingTags(
        ...select([
          `.${k.input}`,
          `.${k.clearButton}`,
          `.${k.openCalendarButton}`,
          `.${k.surface}`,
          `.${k.header}`,
          `.${k.previousMonthButton}`,
          `.${k.heading}`,
          `.${k.headingButton}`,
          `.${k.nextMonthButton}`,
          `.${k.grid}`,
          `.${k.weekday}[abbr="Sunday"]`,
          `.${k.weekNumberHeader}`,
          `.${k.weekNumber}[aria-label="Week 23"]`,
          ...DAYS.map((iso) => `.${k.day}[data-date="${iso}"]`),
          `.${k.markedDot}`,
          `.${k.footer}`,
          `.${k.todayButton}`,
          `.${k.closeButton}`,
        ]),
      ),
    ).toBe(
      [
        '<input aria-label="Date" autocomplete="off" class="wave-date-picker__input wave:h-8 wave:w-full wave:px-3 wave:text-body-1 wave:rounded wave:border wave:border-input wave:border-b-stroke-accessible wave:bg-background wave:text-foreground wave:placeholder:text-muted-foreground wave:focus:outline-hidden wave:focus:border-b-2 wave:focus:border-b-primary wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:pe-14" placeholder="Select a date" type="text" value="06/15/2025">',
        '<button aria-label="Clear date" class="wave-date-picker__clear-button wave:absolute wave:flex wave:h-6 wave:w-6 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground wave:end-7 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
        '<button aria-controls="datepicker-dialog-_id0_" aria-expanded="true" aria-haspopup="dialog" aria-label="Open calendar" class="wave-date-picker__open-calendar-button wave:absolute wave:flex wave:h-6 wave:w-6 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground wave:end-1 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
        '<div aria-labelledby="datepicker-heading-_id1_" aria-modal="true" class="wave-date-picker__surface wave:rounded-md wave:border wave:border-border wave:bg-background wave:p-3 wave:text-foreground wave:shadow-16 wave:transition-[opacity,translate] wave:duration-wave-normal wave:ease-wave-decelerate-mid wave:data-[presence=exiting]:duration-wave-faster wave:data-[presence=exiting]:ease-wave-accelerate-min wave:motion-reduce:transition-none wave:data-[presence=entering]:starting:opacity-0 wave:data-[presence=exiting]:opacity-0 wave:data-[side=top]:data-[presence=entering]:starting:translate-y-1 wave:data-[side=top]:data-[presence=exiting]:translate-y-1 wave:data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 wave:data-[side=bottom]:data-[presence=exiting]:-translate-y-1 wave:data-[side=left]:data-[presence=entering]:starting:translate-x-1 wave:data-[side=left]:data-[presence=exiting]:translate-x-1 wave:data-[side=right]:data-[presence=entering]:starting:-translate-x-1 wave:data-[side=right]:data-[presence=exiting]:-translate-x-1" data-align="start" data-presence="entered" data-side="bottom" data-state="open" id="datepicker-dialog-_id0_" role="dialog" style="position: fixed; left: 0px; top: 0px; transform: translate(8px, 4px);">',
        '<div class="wave-date-picker__header wave:mb-2 wave:flex wave:items-center wave:justify-between wave:gap-2">',
        '<button aria-controls="calendar-grid-_id2_" aria-disabled="true" aria-label="Previous month" class="wave-date-picker__previous-month-button wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-disabled="" type="button">',
        '<h2 aria-live="polite" class="wave-date-picker__heading wave:text-body-1 wave:font-semibold" id="datepicker-heading-_id1_">',
        '<button aria-describedby="calendar-heading-hint-_id3_" class="wave-date-picker__heading-button wave:flex wave:h-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:px-2 wave:text-body-1 wave:font-semibold wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring" type="button">',
        '<button aria-controls="calendar-grid-_id2_" aria-label="Next month" class="wave-date-picker__next-month-button wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
        '<table aria-labelledby="datepicker-heading-_id1_" class="wave-date-picker__grid wave:border-collapse" data-wave-calendar-grid="" id="calendar-grid-_id2_" role="grid">',
        '<th abbr="Sunday" aria-label="Sunday" class="wave-date-picker__weekday wave:h-8 wave:w-8 wave:text-center wave:text-caption-1 wave:font-normal wave:text-muted-foreground" scope="col">',
        '<th class="wave-date-picker__week-number-header wave:h-8 wave:w-8 wave:text-center wave:text-caption-1 wave:font-normal wave:text-muted-foreground" scope="col">',
        '<th aria-label="Week 23" class="wave-date-picker__week-number wave:h-8 wave:w-8 wave:text-center wave:text-caption-1 wave:font-normal wave:text-muted-foreground" scope="row">',
        '<button aria-disabled="true" aria-label="Sunday, June 1, 2025" class="wave-date-picker__day wave:relative wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-date="2025-06-01" data-disabled="" tabindex="-1" type="button">',
        '<button aria-current="date" aria-label="Thursday, June 12, 2025" class="wave-date-picker__day wave:relative wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-date="2025-06-12" data-today="" tabindex="-1" type="button">',
        '<button aria-label="Sunday, June 15, 2025" aria-pressed="true" class="wave-date-picker__day wave:relative wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:forced-colors:bg-[Highlight] wave:forced-colors:text-[HighlightText] wave:forced-colors:forced-color-adjust-none" data-date="2025-06-15" data-selected="" tabindex="0" type="button">',
        '<button aria-label="Friday, June 20, 2025, marked" class="wave-date-picker__day wave:relative wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-date="2025-06-20" data-marked="" tabindex="-1" type="button">',
        '<button aria-label="Saturday, June 21, 2025" class="wave-date-picker__day wave:relative wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-date="2025-06-21" tabindex="-1" type="button">',
        '<button aria-label="Tuesday, July 1, 2025" class="wave-date-picker__day wave:relative wave:flex wave:h-8 wave:w-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-date="2025-07-01" data-outside="" tabindex="-1" type="button">',
        '<span aria-hidden="true" class="wave-date-picker__marked-dot wave:pointer-events-none wave:absolute wave:inset-x-0 wave:bottom-0.5 wave:mx-auto wave:h-1 wave:w-1 wave:rounded-full wave:bg-current wave:forced-colors:forced-color-adjust-none">',
        '<div class="wave-date-picker__footer wave:mt-2 wave:flex wave:items-center wave:justify-end wave:gap-2">',
        '<button class="wave-date-picker__today-button wave:flex wave:h-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:px-3 wave:text-body-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
        '<button class="wave-date-picker__close-button wave:flex wave:h-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:px-3 wave:text-body-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
      ].join('\n'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'June 2025' }));
    expect(
      openingTags(
        ...select([
          `.${k.heading}`,
          `.${k.headingButton}`,
          `.${k.grid}`,
          ...['January 2025', 'June 2025', 'July 2025'].map(
            (name) => `.${k.month}[aria-label="${name}"]`,
          ),
        ]),
      ),
    ).toBe(
      [
        '<h2 aria-live="polite" class="wave-date-picker__heading wave:text-body-1 wave:font-semibold" id="datepicker-heading-_id0_">',
        '<button aria-describedby="calendar-heading-hint-_id1_" class="wave-date-picker__heading-button wave:flex wave:h-8 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:px-2 wave:text-body-1 wave:font-semibold wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring" type="button">',
        '<table aria-labelledby="datepicker-heading-_id0_" class="wave-date-picker__grid wave:border-collapse" data-wave-calendar-grid="" id="calendar-grid-_id2_" role="grid">',
        '<button aria-disabled="true" aria-label="January 2025" class="wave-date-picker__month wave:flex wave:h-12 wave:w-14 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-disabled="" tabindex="-1" type="button">',
        '<button aria-current="date" aria-label="June 2025" aria-pressed="true" class="wave-date-picker__month wave:flex wave:h-12 wave:w-14 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:forced-colors:bg-[Highlight] wave:forced-colors:text-[HighlightText] wave:forced-colors:forced-color-adjust-none" data-selected="" data-today="" tabindex="0" type="button">',
        '<button aria-label="July 2025" class="wave-date-picker__month wave:flex wave:h-12 wave:w-14 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" tabindex="-1" type="button">',
      ].join('\n'),
    );
    fireEvent.click(screen.getByRole('button', { name: '2025' }));
    // 2019 (outside the decade and before minDate), 2025 (selected and current), 2026, 2030.
    const years = all(k.year).filter((_, index) => [0, 6, 7, 11].includes(index));
    expect(openingTags(...all(k.grid), ...years)).toBe(
      [
        '<table aria-labelledby="datepicker-heading-_id0_" class="wave-date-picker__grid wave:border-collapse" data-wave-calendar-grid="" id="calendar-grid-_id1_" role="grid">',
        '<button aria-disabled="true" class="wave-date-picker__year wave:flex wave:h-12 wave:w-14 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-disabled="" data-outside="" tabindex="-1" type="button">',
        '<button aria-current="date" aria-pressed="true" class="wave-date-picker__year wave:flex wave:h-12 wave:w-14 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:forced-colors:bg-[Highlight] wave:forced-colors:text-[HighlightText] wave:forced-colors:forced-color-adjust-none" data-selected="" data-today="" tabindex="0" type="button">',
        '<button class="wave-date-picker__year wave:flex wave:h-12 wave:w-14 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" tabindex="-1" type="button">',
        '<button class="wave-date-picker__year wave:flex wave:h-12 wave:w-14 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-caption-1 wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:data-[outside]:text-muted-foreground wave:data-[today]:border wave:data-[today]:border-primary wave:data-[today]:font-semibold wave:data-[selected]:bg-primary wave:data-[selected]:font-semibold wave:data-[selected]:text-primary-foreground wave:not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover wave:aria-disabled:line-through wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" data-outside="" tabindex="-1" type="button">',
      ].join('\n'),
    );
    unmount();

    render(<DatePicker aria-label="Date" locale="en-US" />);
    typeRejected();
    await act(async () => {});
    expect(openingTags(...select([`.${k.input}`, `.${k.errorMessage}`]))).toBe(
      [
        '<input aria-describedby="datepicker-error-_id0_" aria-invalid="true" aria-label="Date" autocomplete="off" class="wave-date-picker__input wave:h-8 wave:w-full wave:px-3 wave:text-body-1 wave:rounded wave:border wave:bg-background wave:text-foreground wave:placeholder:text-muted-foreground wave:focus:outline-hidden wave:focus:border-b-2 wave:focus:border-b-primary wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:border-destructive wave:pe-8" placeholder="Select a date" type="text" value="zz">',
        '<p class="wave-date-picker__error-message wave:mt-1 wave:text-caption-1 wave:text-error" id="datepicker-error-_id0_" role="alert">',
      ].join('\n'),
    );
  });

  it('renders the 0.17.1 parts on the server, the calendar closed', () => {
    const template = document.createElement('template');
    template.innerHTML = renderToString(<DatePicker {...FULL} defaultOpen />);
    const root = template.content;
    expect(
      openingTags(
        ...[k.input, k.clearButton, k.openCalendarButton].flatMap((name) => all(name, root)),
      ),
    ).toBe(
      [
        '<input aria-label="Date" autocomplete="off" class="wave-date-picker__input wave:h-8 wave:w-full wave:px-3 wave:text-body-1 wave:rounded wave:border wave:border-input wave:border-b-stroke-accessible wave:bg-background wave:text-foreground wave:placeholder:text-muted-foreground wave:focus:outline-hidden wave:focus:border-b-2 wave:focus:border-b-primary wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:pe-14" placeholder="Select a date" type="text" value="06/15/2025">',
        '<button aria-label="Clear date" class="wave-date-picker__clear-button wave:absolute wave:flex wave:h-6 wave:w-6 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground wave:end-7 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
        '<button aria-expanded="false" aria-haspopup="dialog" aria-label="Open calendar" class="wave-date-picker__open-calendar-button wave:absolute wave:flex wave:h-6 wave:w-6 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground wave:end-1 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
      ].join('\n'),
    );
    expect(all(k.surface, root)).toEqual([]);
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: DatePickerProps[] = [
      FULL,
      { ...FULL, defaultOpen: true },
      {
        ...FULL,
        defaultOpen: true,
        showMonthPicker: false,
        firstDayOfWeek: 1,
        today: new Date(2030, 0, 1),
      },
      {
        'aria-label': 'Date',
        id: 'own',
        'aria-describedby': 'hint',
        required: true,
        name: 'due',
        disabled: true,
        clearable: true,
        defaultValue: JUNE_15,
        size: 'small',
        appearance: 'underline',
      },
      { 'aria-label': 'Date', readOnly: true, defaultValue: JUNE_15 },
      // The root's own props: the rest, the style and the hidden state.
      {
        'aria-label': 'Date',
        className: 'c',
        style: { color: 'red' },
        title: 't',
        hidden: true,
        inert: true,
        'aria-hidden': true,
        onPointerDown: () => {},
      },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => <DatePicker {...props} slotProps={slotProps} />,
        EVERY_PART,
      );
    }
    // Your own data attributes on the root, the locked ones among them.
    expectInertSlotProps(
      (slotProps) => (
        <DatePicker aria-label="Date" data-size="large" data-x="1" slotProps={slotProps} />
      ),
      EVERY_PART,
    );
  });

  it('renders the same markup in the month and year views and with an error, with and without slotProps', async () => {
    for (const steps of [['June 2025'], ['June 2025', '2025']]) {
      const { baseElement, rerender, unmount } = render(<DatePicker {...FULL} defaultOpen />);
      await act(async () => {});
      for (const name of steps) fireEvent.click(screen.getByRole('button', { name }));
      const markup = baseElement.innerHTML;
      for (const slotProps of [{}, EVERY_PART, undefined]) {
        rerender(<DatePicker {...FULL} defaultOpen slotProps={slotProps} />);
        expect(baseElement.innerHTML).toBe(markup);
      }
      unmount();
    }
    const { baseElement, rerender } = render(<DatePicker aria-label="Date" locale="en-US" />);
    typeRejected();
    await act(async () => {});
    const markup = baseElement.innerHTML;
    for (const slotProps of [{}, EVERY_PART, undefined]) {
      rerender(<DatePicker aria-label="Date" locale="en-US" slotProps={slotProps} />);
      expect(baseElement.innerHTML).toBe(markup);
    }
  });

  it('puts your className, style, data-* and ref on each part, after its stable class and own classes', async () => {
    const mine = <E extends HTMLElement>(name: string, ref: React.Ref<E>) => ({
      ref,
      className: `my-${name}`,
      style: { opacity: 0.5 },
      'data-part': name,
    });
    const refs = {
      root: React.createRef<HTMLDivElement>(),
      input: React.createRef<HTMLInputElement>(),
      clearButton: React.createRef<HTMLButtonElement>(),
      openCalendarButton: React.createRef<HTMLButtonElement>(),
      surface: React.createRef<HTMLDivElement>(),
      header: React.createRef<HTMLDivElement>(),
      previousMonthButton: React.createRef<HTMLButtonElement>(),
      heading: React.createRef<HTMLHeadingElement>(),
      headingButton: React.createRef<HTMLButtonElement>(),
      nextMonthButton: React.createRef<HTMLButtonElement>(),
      grid: React.createRef<HTMLTableElement>(),
      weekday: React.createRef<HTMLTableCellElement>(),
      weekNumberHeader: React.createRef<HTMLTableCellElement>(),
      weekNumber: React.createRef<HTMLTableCellElement>(),
      day: React.createRef<HTMLButtonElement>(),
      markedDot: React.createRef<HTMLSpanElement>(),
      month: React.createRef<HTMLButtonElement>(),
      year: React.createRef<HTMLButtonElement>(),
      footer: React.createRef<HTMLDivElement>(),
      todayButton: React.createRef<HTMLButtonElement>(),
      closeButton: React.createRef<HTMLButtonElement>(),
    };
    const ref = React.createRef<HTMLInputElement>();
    render(
      <DatePicker
        {...FULL}
        defaultOpen
        ref={ref}
        slotProps={{
          root: mine('root', refs.root),
          input: mine('input', refs.input),
          clearButton: mine('clearButton', refs.clearButton),
          openCalendarButton: mine('openCalendarButton', refs.openCalendarButton),
          surface: mine('surface', refs.surface),
          header: mine('header', refs.header),
          previousMonthButton: mine('previousMonthButton', refs.previousMonthButton),
          heading: mine('heading', refs.heading),
          headingButton: mine('headingButton', refs.headingButton),
          nextMonthButton: mine('nextMonthButton', refs.nextMonthButton),
          grid: mine('grid', refs.grid),
          weekday: mine('weekday', refs.weekday),
          weekNumberHeader: mine('weekNumberHeader', refs.weekNumberHeader),
          weekNumber: mine('weekNumber', refs.weekNumber),
          day: mine('day', refs.day),
          markedDot: mine('markedDot', refs.markedDot),
          month: mine('month', refs.month),
          year: mine('year', refs.year),
          footer: mine('footer', refs.footer),
          todayButton: mine('todayButton', refs.todayButton),
          closeButton: mine('closeButton', refs.closeButton),
        }}
      />,
    );
    await act(async () => {});
    const check = (names: (keyof typeof refs)[]) => {
      for (const name of names) {
        const elements = all(k[name]);
        expect(elements.length, name).toBeGreaterThan(0);
        for (const element of elements) {
          expect(element.classList[0]).toBe(k[name]);
          expect(element.classList[element.classList.length - 1]).toBe(`my-${name}`);
          expect(element).toHaveStyle({ opacity: '0.5' });
          expect(element).toHaveAttribute('data-part', name);
        }
        // One ref, several cells: it holds the last one attached.
        expect(elements).toContain(refs[name].current);
      }
    };
    check([
      'root',
      'input',
      'clearButton',
      'openCalendarButton',
      'surface',
      'header',
      'previousMonthButton',
      'heading',
      'headingButton',
      'nextMonthButton',
      'grid',
      'weekday',
      'weekNumberHeader',
      'weekNumber',
      'day',
      'markedDot',
      'footer',
      'todayButton',
      'closeButton',
    ]);
    expect(ref.current).toBe(refs.input.current);
    expect(refs.heading.current?.tagName).toBe('H2');
    // The surface is still placed (the positioning holds the same element), and its trap still
    // finds the grid: focus moved to the selected day.
    expect(refs.surface.current).toHaveStyle({ position: 'fixed' });
    expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'June 2025' }));
    check(['month', 'grid', 'heading', 'headingButton']);
    fireEvent.click(screen.getByRole('button', { name: '2025' }));
    check(['year', 'grid']);
  });

  it('puts your props on the error message and keeps its id and role', () => {
    const ref = React.createRef<HTMLParagraphElement>();
    render(
      <DatePicker
        aria-label="Date"
        locale="en-US"
        slotProps={{
          errorMessage: {
            ref,
            className: 'my-error',
            'data-part': 'error',
            id: 'mine',
            role: 'status',
          },
        }}
      />,
    );
    typeRejected();
    const message = screen.getByRole('alert');
    expect(ref.current).toBe(message);
    expect(message).toHaveClass(k.errorMessage, 'my-error');
    expect(message).toHaveAttribute('data-part', 'error');
    expect(message.id).not.toBe('mine');
    expect(textbox()).toHaveAttribute('aria-describedby', message.id);
  });

  it("runs your input handlers first; preventDefault() skips the DatePicker's keys and commit", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onInvalidInput = vi.fn();
    render(
      <DatePicker
        aria-label="Date"
        locale="en-US"
        onInvalidInput={onInvalidInput}
        onKeyDown={() => order.push('onKeyDown')}
        slotProps={{
          input: {
            onKeyDown: (event) => {
              order.push('part key');
              if (event.key === 'Enter') event.preventDefault();
            },
            onBlur: (event) => event.preventDefault(),
          },
        }}
      />,
    );
    await user.click(textbox());
    await user.keyboard('zz');
    order.length = 0;
    await user.keyboard('{Enter}');
    expect(order).toEqual(['part key']);
    await user.tab();
    expect(toggle()).toHaveFocus();
    expect(onInvalidInput).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(textbox()).toHaveValue('zz');
  });

  it('ignores typed text when your input onChange prevents it', async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        aria-label="Date"
        locale="en-US"
        defaultValue={JUNE_15}
        slotProps={{ input: { onChange: (event) => event.preventDefault() } }}
      />,
    );
    await user.type(textbox(), '1');
    expect(textbox()).toHaveValue('06/15/2025');
  });

  it('runs your clear and toggle onClick first; preventDefault() skips the clear and the toggle', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    const prevent = (event: React.MouseEvent) => event.preventDefault();
    render(
      <DatePicker
        aria-label="Date"
        locale="en-US"
        defaultValue={JUNE_15}
        clearable
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
        slotProps={{ clearButton: { onClick: prevent }, openCalendarButton: { onClick: prevent } }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear date' }));
    await user.click(toggle());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(textbox()).toHaveValue('06/15/2025');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs your surface, Close and day handlers first, once per event in StrictMode; preventDefault() keeps the calendar open', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const onClick = vi.fn();
    const prevent = (event: React.MouseEvent) => event.preventDefault();
    const slotProps = (day: DatePickerSlotProps['day']): DatePickerSlotProps => ({
      surface: {
        onKeyDown: (event) => {
          if (event.key === 'Escape') event.preventDefault();
        },
      },
      closeButton: { onClick: prevent },
      day,
    });
    const { rerender } = render(
      <React.StrictMode>
        <DatePicker
          {...FULL}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          slotProps={slotProps({ onClick: prevent })}
        />
      </React.StrictMode>,
    );
    await openCalendar(user);
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await user.keyboard('{Escape}');
    expect(dialog()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog()).toBeInTheDocument();
    await user.click(dayButton('Wednesday, June 18, 2025'));
    expect(dialog()).toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(
      <React.StrictMode>
        <DatePicker
          {...FULL}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          slotProps={slotProps({ onClick })}
        />
      </React.StrictMode>,
    );
    await user.click(dayButton('Wednesday, June 18, 2025'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(fields(onValueChange.mock.calls[0][0] as Date)).toEqual([2025, 6, 18]);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it("moves the calendar's tab stop after your day onFocus, and calls no onClick of yours on a disabled button or an unavailable day", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onFocus = vi.fn((event: React.FocusEvent) => event.preventDefault());
    render(
      <DatePicker
        {...FULL}
        slotProps={{ previousMonthButton: { onClick }, day: { onClick, onFocus } }}
      />,
    );
    await openCalendar(user);
    // June 2025 starts the range (minDate June 3): the previous button is disabled, focusable.
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(dayButton('Sunday, June 1, 2025'));
    expect(onClick).not.toHaveBeenCalled();
    expect(dialog()).toBeInTheDocument();
    act(() => dayButton('Wednesday, June 18, 2025').focus());
    expect(dayButton('Wednesday, June 18, 2025')).toHaveAttribute('tabindex', '0');
    expect(dayButton('Sunday, June 15, 2025')).toHaveAttribute('tabindex', '-1');
    await user.keyboard('{ArrowRight}');
    expect(dayButton('Thursday, June 19, 2025')).toHaveFocus();
    await user.click(dayButton('Thursday, June 19, 2025'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(textbox()).toHaveValue('06/19/2025');
  });

  it('keeps the locked attributes of the input, the buttons, the surface and the heading', async () => {
    render(
      <>
        <span id="extra">Extra</span>
        <DatePicker
          {...FULL}
          id="own"
          name="due"
          defaultOpen
          slotProps={{
            input: {
              id: 'mine',
              type: 'date',
              value: 'noon',
              name: 'mine',
              form: 'elsewhere',
              hidden: true,
              'aria-hidden': true,
              readOnly: true,
              placeholder: 'When?',
              'aria-describedby': 'extra',
            },
            clearButton: {
              type: 'submit',
              'aria-label': 'Wipe',
              disabled: true,
              tabIndex: -1,
              hidden: true,
            },
            openCalendarButton: {
              'aria-expanded': false,
              'aria-controls': 'nowhere',
              'aria-haspopup': 'menu',
              disabled: true,
              'aria-hidden': true,
            },
            surface: {
              id: 'mine-surface',
              role: 'menu',
              'aria-modal': false,
              hidden: true,
              inert: true,
              'aria-hidden': true,
              'data-state': 'closed',
              'data-side': 'top',
              'data-presence': 'exiting',
              'aria-labelledby': 'extra',
              style: { left: 40, zIndex: 3 },
            },
            heading: { id: 'mine-heading', 'aria-live': 'off', hidden: true },
          }}
        />
      </>,
    );
    await act(async () => {});
    const input = textbox();
    expect(input).toHaveAttribute('id', 'own');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('06/15/2025');
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveAttribute('placeholder', 'Select a date');
    for (const attribute of ['name', 'form', 'hidden', 'aria-hidden']) {
      expect(input).not.toHaveAttribute(attribute);
    }
    expect(input).toHaveAttribute('aria-describedby', 'extra');
    const clear = screen.getByRole('button', { name: 'Clear date' });
    expect(clear).toHaveAttribute('type', 'button');
    expect(clear).not.toBeDisabled();
    expect(clear).not.toHaveAttribute('tabindex');
    expect(clear).not.toHaveAttribute('hidden');
    const surface = dialog();
    expect(surface).toHaveClass(k.surface);
    expect(surface.id).toMatch(/^datepicker-dialog-/);
    expect(surface).toHaveAttribute('aria-modal', 'true');
    for (const attribute of ['hidden', 'inert', 'aria-hidden']) {
      expect(surface).not.toHaveAttribute(attribute);
    }
    expect(surface).toHaveAttribute('data-presence', 'entered');
    expect(surface).toHaveAttribute('data-state', 'open');
    expect(surface).toHaveAttribute('data-side', 'bottom');
    expect(surface).toHaveStyle({ left: '0px', zIndex: '3' });
    const button = toggle();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', surface.id);
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('aria-hidden');
    const heading = part(k.heading)!;
    expect(heading.tagName).toBe('H2');
    expect(heading.id).toMatch(/^datepicker-heading-/);
    expect(heading).toHaveAttribute('aria-live', 'polite');
    expect(heading).not.toHaveAttribute('hidden');
    expect(surface).toHaveAttribute('aria-labelledby', `${heading.id} extra`);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('keeps the input reachable: a part sets no inert on it', () => {
    render(<DatePicker aria-label="Date" slotProps={{ input: { inert: true } }} />);
    expect(textbox()).not.toHaveAttribute('inert');
  });

  it('submits only the hidden input: the input part takes no name or form', () => {
    render(
      <form aria-label="Booking">
        <DatePicker
          aria-label="Date"
          name="due"
          defaultValue={JUNE_15}
          slotProps={{ input: { name: 'typed' } }}
        />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Booking' }) as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['due', '2025-06-15']]);
  });

  it('keeps the text its own: a part’s defaultValue never reaches the controlled input', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <DatePicker
        aria-label="Date"
        locale="en-US"
        defaultValue={JUNE_15}
        slotProps={{ input: { defaultValue: '01/01/2000' } }}
      />,
    );
    expect(textbox()).toHaveValue('06/15/2025');
    // No warning of an input both controlled and uncontrolled: the part's default is unset.
    expect(error).not.toHaveBeenCalled();
  });

  it('keeps the attributes its wiring renders only while set: a part sets none of them', async () => {
    const user = userEvent.setup();
    const disabledState = {
      'aria-disabled': true,
      'data-disabled': '',
      'data-disabled-focusable': '',
    } as const;
    render(
      <DatePicker
        {...FULL}
        slotProps={{
          input: {
            id: 'mine',
            'aria-label': 'Other',
            'aria-invalid': true,
            'aria-required': true,
            required: true,
          },
          openCalendarButton: { ...disabledState, 'aria-controls': 'nowhere' },
          clearButton: disabledState,
          nextMonthButton: disabledState,
          day: {
            ...disabledState,
            'aria-pressed': true,
            'aria-current': 'date',
            'data-selected': '',
            'data-today': '',
            'data-marked': '',
            'data-outside': '',
          },
        }}
      />,
    );
    const input = textbox();
    expect(input.id).not.toBe('mine');
    for (const attribute of ['aria-invalid', 'aria-required', 'required']) {
      expect(input).not.toHaveAttribute(attribute);
    }
    const button = toggle();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    for (const attribute of ['aria-controls', ...Object.keys(disabledState)]) {
      expect(button).not.toHaveAttribute(attribute);
    }
    for (const attribute of Object.keys(disabledState)) {
      expect(screen.getByRole('button', { name: 'Clear date' })).not.toHaveAttribute(attribute);
    }
    await openCalendar(user);
    for (const attribute of Object.keys(disabledState)) {
      expect(screen.getByRole('button', { name: 'Next month' })).not.toHaveAttribute(attribute);
    }
    const plain = dayButton('Saturday, June 21, 2025');
    for (const attribute of [
      ...Object.keys(disabledState),
      'aria-pressed',
      'aria-current',
      'data-selected',
      'data-today',
      'data-marked',
      'data-outside',
    ]) {
      expect(plain).not.toHaveAttribute(attribute);
    }
  });

  it('ignores the parts the DatePicker does not render', () => {
    const refs = [
      React.createRef<HTMLButtonElement>(),
      React.createRef<HTMLParagraphElement>(),
      React.createRef<HTMLDivElement>(),
      React.createRef<HTMLDivElement>(),
      React.createRef<HTMLTableElement>(),
      React.createRef<HTMLButtonElement>(),
      React.createRef<HTMLButtonElement>(),
    ] as const;
    render(
      <DatePicker
        aria-label="Date"
        slotProps={{
          clearButton: { ref: refs[0], className: 'my-part' },
          errorMessage: { ref: refs[1], className: 'my-part' },
          surface: { ref: refs[2], className: 'my-part' },
          header: { ref: refs[3], className: 'my-part' },
          grid: { ref: refs[4], className: 'my-part' },
          day: { ref: refs[5], className: 'my-part' },
          closeButton: { ref: refs[6], className: 'my-part' },
        }}
      />,
    );
    expect(textbox()).toBeInTheDocument();
    for (const ref of refs) expect(ref.current).toBeNull();
    expect(document.querySelector('.my-part')).toBeNull();
  });

  it('has no accessibility violations with every part customised', async () => {
    const custom = (name: string) => ({ className: `my-${name}`, 'data-part': name });
    render(
      <DatePicker
        {...FULL}
        defaultOpen
        slotProps={{
          input: { ...custom('input'), title: 'A date' },
          clearButton: custom('clear'),
          openCalendarButton: custom('toggle'),
          surface: custom('surface'),
          header: custom('header'),
          previousMonthButton: custom('previous'),
          heading: custom('heading'),
          headingButton: custom('heading-button'),
          nextMonthButton: custom('next'),
          grid: custom('grid'),
          weekday: custom('weekday'),
          weekNumberHeader: custom('week-number-header'),
          weekNumber: custom('week-number'),
          day: custom('day'),
          markedDot: custom('dot'),
          footer: custom('footer'),
          todayButton: custom('today'),
          closeButton: custom('close'),
        }}
      />,
    );
    await act(async () => {});
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof DatePickerSlotProps>().toEqualTypeOf<
      | 'root'
      | 'input'
      | 'clearButton'
      | 'openCalendarButton'
      | 'errorMessage'
      | 'surface'
      | 'header'
      | 'previousMonthButton'
      | 'heading'
      | 'headingButton'
      | 'nextMonthButton'
      | 'grid'
      | 'weekday'
      | 'weekNumberHeader'
      | 'weekNumber'
      | 'day'
      | 'markedDot'
      | 'month'
      | 'year'
      | 'footer'
      | 'todayButton'
      | 'closeButton'
    >();
    expectTypeOf<NonNullable<DatePickerSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<DatePickerSlotProps['input']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<NonNullable<DatePickerSlotProps['errorMessage']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLParagraphElement> | undefined
    >();
    expectTypeOf<NonNullable<DatePickerSlotProps['surface']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<DatePickerSlotProps['heading']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLHeadingElement> | undefined
    >();
    expectTypeOf<NonNullable<DatePickerSlotProps['grid']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLTableElement> | undefined
    >();
    expectTypeOf<NonNullable<DatePickerSlotProps['day']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the DatePicker draws its content
    void (<DatePicker aria-label="Date" slotProps={{ closeButton: { children: 'Done' } }} />);
    // @ts-expect-error -- a part takes no children: the DatePicker draws its content
    void (<DatePicker aria-label="Date" slotProps={{ root: { children: 'x' } }} />);
  });

  describe('the root part', () => {
    const root = () => part(k.root)!;

    it("puts your className, style, data-* and attributes on the root <div>, after the DatePicker's className and style", () => {
      render(
        <DatePicker
          aria-label="Date"
          className="mine"
          style={{ color: 'red', width: 10 }}
          slotProps={{
            root: { className: 'my-root', style: { width: 20 }, 'data-part': 'root', title: 'R' },
          }}
        />,
      );
      expect(root().classList[0]).toBe(k.root);
      expect(root().className).toMatch(/ mine my-root$/);
      expect(root()).toHaveStyle({ color: 'rgb(255, 0, 0)', width: '20px' });
      expect(root()).toHaveAttribute('data-part', 'root');
      expect(root()).toHaveAttribute('title', 'R');
      expect(textbox()).not.toHaveAttribute('data-part');
      expect(textbox()).not.toHaveAttribute('title');
    });

    it('reaches the root only: the open calendar, which takes the other parts, takes none of it', async () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <DatePicker
          {...FULL}
          defaultOpen
          slotProps={{ root: { ref, className: 'my-root', 'data-part': 'root', title: 'R' } }}
        />,
      );
      await act(async () => {});
      expect(dialog()).toBeInTheDocument();
      expect(ref.current).toBe(root());
      expect(document.querySelectorAll('.my-root')).toHaveLength(1);
      expect(document.querySelectorAll('[data-part="root"]')).toHaveLength(1);
      expect(document.querySelectorAll('[title="R"]')).toHaveLength(1);
    });

    it('lets your class replace a conflicting class of the root', () => {
      render(<DatePicker aria-label="Date" slotProps={{ root: { className: 'flex-row' } }} />);
      expect(root()).toHaveClass('flex-row');
      expect(root()).not.toHaveClass('wave:flex-col');
    });

    it("keeps the props you give the DatePicker over the part's", () => {
      render(
        <DatePicker
          aria-label="Date"
          title="Own"
          data-x="own"
          data-size="large"
          slotProps={{ root: { title: 'Part', 'data-x': 'part' } }}
        />,
      );
      expect(root()).toHaveAttribute('title', 'Own');
      expect(root()).toHaveAttribute('data-x', 'own');
      // Your own data-size reaches the root as in 0.18 (after the resolved one).
      expect(root()).toHaveAttribute('data-size', 'large');
    });

    it('keeps its data attributes and its hidden state: a part changes none of them', () => {
      const { rerender } = render(
        <DatePicker
          aria-label="Date"
          size="large"
          appearance="underline"
          slotProps={{
            root: {
              'data-size': 'medium',
              'data-appearance': 'outline',
              hidden: true,
              inert: true,
              'aria-hidden': true,
            },
          }}
        />,
      );
      expect(root()).toHaveAttribute('data-size', 'large');
      expect(root()).toHaveAttribute('data-appearance', 'underline');
      for (const attribute of ['hidden', 'inert', 'aria-hidden']) {
        expect(root()).not.toHaveAttribute(attribute);
      }
      // The DatePicker's own hidden state stays its own.
      rerender(
        <DatePicker
          aria-label="Date"
          hidden
          inert
          aria-hidden
          slotProps={{ root: { hidden: false, inert: false, 'aria-hidden': false } }}
        />,
      );
      expect(root()).toHaveAttribute('hidden');
      expect(root()).toHaveAttribute('inert');
      expect(root()).toHaveAttribute('aria-hidden', 'true');
    });

    it("runs your root handlers before the DatePicker's own; preventDefault() in yours skips its own", () => {
      const order: string[] = [];
      const { rerender } = render(
        <DatePicker
          aria-label="Date"
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: () => order.push('part') } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
      rerender(
        <DatePicker
          aria-label="Date"
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: (event) => event.preventDefault() } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
    });

    it("opens the calendar from the toggle whatever your root onClick does: the toggle is the button's own, before the click reaches the root", async () => {
      const user = userEvent.setup();
      render(
        <DatePicker
          aria-label="Date"
          slotProps={{ root: { onClick: (event) => event.preventDefault() } }}
        />,
      );
      await user.click(toggle());
      expect(dialog()).toBeInTheDocument();
    });

    it('calls your root onClick in every state, as the DatePicker calls its own: the root passes no click to the input', () => {
      const onClick = vi.fn();
      const own = vi.fn();
      const { rerender } = render(
        <DatePicker aria-label="Date" onClick={own} slotProps={{ root: { onClick } }} />,
      );
      fireEvent.click(root());
      rerender(
        <DatePicker aria-label="Date" disabled onClick={own} slotProps={{ root: { onClick } }} />,
      );
      fireEvent.click(root());
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(own).toHaveBeenCalledTimes(2);
    });

    it('has no accessibility violations with the root customised', async () => {
      render(
        <DatePicker
          aria-label="Date"
          defaultOpen
          slotProps={{ root: { className: 'my-root', title: 'Pick a date' } }}
        />,
      );
      await act(async () => {});
      await expectNoA11yViolations();
    });
  });
});

// 1.0 (Phase 14, R5): `ref` reaches the text <input>, the focusable control; the root <div> is
// `slotProps.root.ref`, and `controlRef` is gone.
describe('DatePicker — ref reaches the control', () => {
  it('focuses the input through ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<DatePicker ref={ref} aria-label="Date" />);
    act(() => ref.current?.focus());
    expect(textbox()).toHaveFocus();
  });

  it('gives ref the input beside slotProps.input.ref, and slotProps.root.ref the root', () => {
    const ref = React.createRef<HTMLInputElement>();
    const root = React.createRef<HTMLDivElement>();
    const input = React.createRef<HTMLInputElement>();
    render(
      <DatePicker
        ref={ref}
        aria-label="Date"
        slotProps={{ root: { ref: root }, input: { ref: input } }}
      />,
    );
    expect(ref.current).toBe(textbox());
    expect(input.current).toBe(textbox());
    expect(root.current).toHaveClass(datePickerClassNames.root);
    expect(root.current).toContainElement(textbox());
  });

  it('keeps the invalid focus and the form reset working with an inline ref that changes on every render', async () => {
    const user = userEvent.setup();
    const nodes: (HTMLInputElement | null)[] = [];
    const ui = (pass: number) => (
      <form aria-label="Order">
        <DatePicker
          ref={(node) => {
            nodes.push(node);
          }}
          name="due"
          required
          locale="en-US"
          aria-label="Date"
          data-pass={pass}
        />
      </form>
    );
    const { rerender } = render(ui(0));
    rerender(ui(1));
    rerender(ui(2));
    const input = textbox();
    expect(nodes.at(-1)).toBe(input);
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    // The hidden input's invalid event focuses the input through the DatePicker's own ref.
    act(() => {
      form.reportValidity();
    });
    expect(input).toHaveFocus();
    await openCalendar(user);
    await user.click(dayButton('Friday, June 20, 2025'));
    rerender(ui(3));
    expect(input).toHaveValue('06/20/2025');
    expect(form.checkValidity()).toBe(true);
    act(() => form.reset());
    expect(input).toHaveValue('');
    expect(form.checkValidity()).toBe(false);
    expect(nodes.at(-1)).toBe(input);
  });

  it("keeps the calendar's anchors with an inline ref that changes on every render: its placement and its focus return", async () => {
    const html = document.documentElement;
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
    // The calendar is placed against the row around the input and its buttons, near the
    // viewport's bottom: it flips above it.
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
      const user = userEvent.setup();
      const nodes: (HTMLInputElement | null)[] = [];
      const ui = (pass: number) => (
        <DatePicker
          aria-label="Date"
          locale="en-US"
          defaultValue={JUNE_15}
          ref={(node) => {
            nodes.push(node);
          }}
          data-pass={pass}
        />
      );
      const { rerender } = render(ui(0));
      rerender(ui(1));
      act(() => textbox().focus());
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      rerender(ui(2));
      rerender(ui(3));
      await waitFor(() => expect(dialog()).toHaveAttribute('data-side', 'top'));
      expect(dayButton('Sunday, June 15, 2025')).toHaveFocus();
      // Escape returns focus to where the calendar was opened from: the input.
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(textbox()).toHaveFocus();
      // Opened from the toggle, it returns focus to the toggle.
      await openCalendar(user);
      rerender(ui(4));
      await user.keyboard('{Escape}');
      expect(toggle()).toHaveFocus();
      expect(nodes.at(-1)).toBe(textbox());
    } finally {
      Reflect.deleteProperty(html, 'clientWidth');
      Reflect.deleteProperty(html, 'clientHeight');
    }
  });

  it('attaches a callback ref once, keeps it across renders and detaches it on unmount', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(<DatePicker ref={ref} aria-label="Date" />);
    const input = textbox();
    rerender(<DatePicker ref={ref} aria-label="Date" defaultValue={JUNE_15} disabled />);
    expect(ref.mock.calls).toEqual([[input]]);
    unmount();
    expect(ref.mock.calls).toEqual([[input], [null]]);
  });

  it('in StrictMode, attaches only the control: React detaches and attaches it again on mount, once', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <React.StrictMode>
        <DatePicker ref={ref} aria-label="Date" />
      </React.StrictMode>,
    );
    const input = textbox();
    rerender(
      <React.StrictMode>
        <DatePicker ref={ref} aria-label="Date" readOnly />
      </React.StrictMode>,
    );
    expect(ref.mock.calls).toEqual([[input], [null], [input]]);
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it('reaches the control the Field label points at', () => {
    const ref = React.createRef<HTMLInputElement>();
    renderWithFieldContext(<DatePicker ref={ref} />);
    const fieldLabel = screen.getByText(FIELD_TEST_TEXT.label).closest('label') as HTMLLabelElement;
    expect(ref.current).toBe(textbox(FIELD_TEST_TEXT.label));
    expect(ref.current?.id).toBe(fieldLabel.htmlFor);
  });

  it('declares ref (for the input), and no controlRef', () => {
    expectTypeOf<DatePickerProps['ref']>().toEqualTypeOf<React.Ref<HTMLInputElement> | undefined>();
    expectTypeOf<DatePickerProps>().not.toHaveProperty('controlRef');
    const divRef = React.createRef<HTMLDivElement>();
    // @ts-expect-error -- in 1.0 `ref` reaches the input; the root <div> is slotProps.root.ref
    void (<DatePicker aria-label="Date" ref={divRef} />);
  });

  it('has no controlRef: TypeScript rejects it, and untyped code puts an unknown prop on the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <DatePicker
          aria-label="Date"
          // @ts-expect-error -- `controlRef` is removed in 1.0: `ref` reaches the input
          controlRef={controlRef}
        />,
      );
      expect(controlRef.current).toBeNull();
      expect(document.querySelector(`.${datePickerClassNames.root}`)).toHaveAttribute(
        'controlref',
        '[object Object]',
      );
      expect(error.mock.calls).toEqual([UNKNOWN_PROP('controlRef')]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
