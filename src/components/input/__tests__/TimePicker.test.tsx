import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import {
  TimePicker,
  type TimePickerInvalidReason,
  type TimePickerLabels,
  type TimePickerProps,
} from '../TimePicker';
import {
  axe,
  expectInertSlotProps,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  mockRect,
  openingTags,
  renderWithProviders,
  testNoImplicitSubmit,
  testRootPartRef,
  testSystemProps,
  UNKNOWN_PROP,
} from '../../../test-utils';
import { timePickerClassNames } from '../../../lib/classNames';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss, type DismissReason } from '../../../hooks/useDismiss';
import { useListboxOption } from '../../../hooks/useListbox';
import { Button } from '../../button/Button';

// Pass-through spy on the option hook: every option render calls it once (render-count test).
vi.mock('../../../hooks/useListbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useListbox')>();
  return { ...actual, useListboxOption: vi.fn(actual.useListboxOption) };
});

function combobox(name?: string) {
  return name === undefined ? screen.getByRole('combobox') : screen.getByRole('combobox', { name });
}

/** A hex/white/black color utility or the banned `enabled:` variant (C-TOKENS). */
const RAW_COLOR_OR_ENABLED = new RegExp(
  String.raw`\[#|\b(bg|text|border)-(white|black)\b|enabled:`,
);

function optionNames() {
  return screen.queryAllByRole('option').map((option) => option.textContent);
}

function expandButton(name = 'Show times') {
  return screen.getByRole('button', { name });
}

/** The portaled surface of the open list (its options or its status text); `null` while closed. */
function listSurface() {
  return document.querySelector('[data-wave-portal]');
}

const EXPAND_ICON_BUTTON =
  '[WaveUI] TimePicker: `expandIcon` received a button element; its children render as the ' +
  'glyph of the built-in expand button and its props were dropped (buttons cannot be nested). ' +
  'Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.';

const INVALID_12H = 'Enter a time in the format h:mm AM.';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TimePicker', () => {
  testSystemProps(TimePicker, {
    expectedTag: 'div',
    displayName: 'TimePicker',
    defaultProps: { 'aria-label': 'Time picker' },
    ref: 'control',
    control: { role: 'combobox', tag: 'input' },
    a11yVariants: [
      { name: 'with value and clear button', props: { defaultValue: '09:00', clearable: true } },
      { name: 'disabled', props: { disabled: true, defaultValue: '09:00' } },
      { name: 'read-only', props: { readOnly: true, defaultValue: '09:00', clearable: true } },
      { name: 'open', props: { defaultOpen: true, defaultValue: '09:00', clearable: true } },
    ],
  });

  testRootPartRef(TimePicker, { props: { 'aria-label': 'Time picker' } });

  testNoImplicitSubmit(TimePicker, {
    defaultProps: { 'aria-label': 'Time', defaultValue: '09:00', clearable: true },
  });

  describe('rendering', () => {
    it('renders the placeholder', () => {
      render(<TimePicker aria-label="Time" placeholder="Pick a time" />);
      expect(combobox('Time')).toHaveAttribute('placeholder', 'Pick a time');
    });

    it('displays the value in 12h format by default and in 24h when asked', () => {
      const { rerender } = render(<TimePicker aria-label="Time" value="13:30" />);
      expect(combobox('Time')).toHaveValue('1:30 PM');
      rerender(<TimePicker aria-label="Time" value="13:30" format="24h" />);
      expect(combobox('Time')).toHaveValue('13:30');
    });

    it('shows an off-grid or out-of-range value in the requested format (input-datetime#28)', () => {
      const { rerender } = render(<TimePicker aria-label="Time" value="09:15" step={30} />);
      expect(combobox('Time')).toHaveValue('9:15 AM');
      rerender(<TimePicker aria-label="Time" value="20:00" maxTime="17:00" />);
      expect(combobox('Time')).toHaveValue('8:00 PM');
    });

    it('follows a controlled value change', () => {
      const { rerender } = render(<TimePicker aria-label="Time" value="09:00" />);
      rerender(<TimePicker aria-label="Time" value="10:30" />);
      expect(combobox('Time')).toHaveValue('10:30 AM');
      rerender(<TimePicker aria-label="Time" value="" />);
      expect(combobox('Time')).toHaveValue('');
    });

    it('uses the shared dismiss icon in the clear button (input-datetime#22)', () => {
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable />);
      const clear = screen.getByRole('button', { name: 'Clear time' });
      const icon = clear.querySelector('svg');
      expect(icon).toHaveAttribute('data-wave-icon', 'dismiss');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('gives the clear button a 24px target and pads the input logically (input-datetime#15)', () => {
      const { unmount } = render(<TimePicker aria-label="Time" defaultValue="09:00" clearable />);
      // Next to the expand button at the end.
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveClass(
        'wave:h-6',
        'wave:w-6',
        'wave:end-7',
      );
      expect(expandButton()).toHaveClass('wave:h-6', 'wave:w-6', 'wave:end-1');
      expect(combobox('Time')).toHaveClass('wave:pe-14');
      unmount();
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable expandIcon={false} />);
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveClass(
        'wave:h-6',
        'wave:w-6',
        'wave:end-1',
      );
      expect(combobox('Time')).toHaveClass('wave:pe-8');
    });

    it('gives the clear button its own padding and background (C-NATIVE)', () => {
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable />);
      const clear = screen.getByRole('button', { name: 'Clear time' });
      expect(clear).toHaveClass('wave:p-0');
      expect(clear).toHaveClass('wave:bg-transparent');
    });

    it('uses theme tokens and gates hover on the clear button (button-provider#3)', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable step={60} />);
      const clear = screen.getByRole('button', { name: 'Clear time' });
      expect(clear).toHaveClass('wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover');
      await user.click(combobox('Time'));
      const listbox = screen.getByRole('listbox');
      for (const el of [clear, combobox('Time'), listbox, ...screen.getAllByRole('option')]) {
        expect(el.className).not.toMatch(RAW_COLOR_OR_ENABLED);
      }
      expect(combobox('Time')).toHaveClass('wave:focus:outline-hidden');
    });

    it('renders on the server with the label and a hidden inline list', () => {
      const html = renderToString(<TimePicker aria-label="Time" defaultValue="09:00" step={60} />);
      // Parsed, not searched: class names such as `focus:outline-hidden` contain "hidden" too.
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = html;
      expect(parsed.querySelector('input[role="combobox"]')).toHaveAttribute('value', '9:00 AM');
      const listbox = parsed.querySelector('[role="listbox"]');
      expect(listbox).not.toBeNull();
      expect(listbox).toHaveAttribute('hidden');
      expect(listbox?.querySelectorAll('[role="option"]')).toHaveLength(24);
    });

    it.each([
      ['a defaultOpen', { defaultOpen: true }],
      ['an open', { open: true }],
    ])('renders %s list closed on the server, so every referenced id exists', (_label, props) => {
      const serverHtml = renderToString(
        <TimePicker aria-label="Time" defaultValue="09:00" step={60} {...props} />,
      );
      expect(findDanglingIdRefsInHtml(serverHtml)).toEqual([]);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = serverHtml;
      const input = parsed.querySelector('input[role="combobox"]');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(parsed.querySelector('[role="listbox"]')).toHaveAttribute('hidden');
    });

    it.each([
      ['defaultOpen', { defaultOpen: true }],
      ['open', { open: true }],
    ])('opens once hydrated (%s), without a hydration mismatch', async (_label, props) => {
      const element = <TimePicker aria-label="Time" defaultValue="09:00" step={60} {...props} />;
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
        const listbox = screen.getByRole('listbox');
        expect(combobox('Time')).toHaveAttribute('aria-expanded', 'true');
        expect(combobox('Time')).toHaveAttribute('aria-controls', listbox.id);
        expect(combobox('Time')).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('option', { name: '9:00 AM' }).id,
        );
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('draws the destructive border while the input is invalid', () => {
      const invalidClasses = ['wave:border-destructive'];
      const { unmount } = render(<TimePicker aria-label="Time" />);
      expect(combobox('Time')).toHaveClass('wave:border-input', 'wave:border-b-stroke-accessible');
      for (const name of invalidClasses) expect(combobox('Time')).not.toHaveClass(name);
      unmount();

      const field = renderWithFieldContext(<TimePicker />, { errorId: FIELD_TEST_IDS.errorId });
      expect(combobox(FIELD_TEST_TEXT.label)).toHaveClass(...invalidClasses);
      expect(combobox(FIELD_TEST_TEXT.label)).not.toHaveClass('wave:border-input');
      expect(combobox(FIELD_TEST_TEXT.label)).not.toHaveClass('wave:border-b-stroke-accessible');
      // Keeps the destructive border and shows the focus color on the focused bottom border
      // (Phase 4 D4).
      expect(combobox(FIELD_TEST_TEXT.label)).toHaveClass('wave:focus:border-b-primary');
      field.rerender(<TimePicker aria-invalid={false} />);
      for (const name of invalidClasses) {
        expect(combobox(FIELD_TEST_TEXT.label)).not.toHaveClass(name);
      }
      field.unmount();

      render(<TimePicker aria-label="Time" aria-invalid="true" />);
      expect(combobox('Time')).toHaveClass(...invalidClasses);
    });

    it('uses logical positions in RTL (feedback-navigation#34)', () => {
      renderWithProviders(<TimePicker aria-label="Time" defaultValue="09:00" clearable />, {
        dir: 'rtl',
      });
      const clear = screen.getByRole('button', { name: 'Clear time' });
      expect(clear).toHaveClass('wave:end-7');
      expect(expandButton()).toHaveClass('wave:end-1');
      for (const button of [clear, expandButton()]) {
        expect(button.className).not.toMatch(/\b(left|right)-/);
      }
      expect(combobox('Time').className).not.toMatch(/\bp[lr]-/);
    });
  });

  describe('opening and options', () => {
    it('opens on click and shows every option', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      await user.click(combobox('Time'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(24);
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'true');
    });

    it('lists 12h labels by default and 24h labels when asked', async () => {
      const user = userEvent.setup();
      const { unmount } = render(<TimePicker aria-label="Time" step={60} />);
      await user.click(combobox('Time'));
      expect(screen.getByRole('option', { name: '12:00 AM' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1:00 PM' })).toBeInTheDocument();
      unmount();
      render(<TimePicker aria-label="Time" format="24h" step={60} />);
      await user.click(combobox('Time'));
      expect(screen.getByRole('option', { name: '00:00' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '13:00' })).toBeInTheDocument();
    });

    it('opening with a value shows all options, the selected one active and scrolled into view (input-datetime#23)', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="09:00" step={60} />);
      await user.click(combobox('Time'));
      expect(screen.getAllByRole('option')).toHaveLength(24);
      const nine = screen.getByRole('option', { name: '9:00 AM' });
      expect(nine).toHaveAttribute('aria-selected', 'true');
      expect(combobox('Time')).toHaveAttribute('aria-activedescendant', nine.id);
      const scrolled = vi.mocked(Element.prototype.scrollIntoView).mock.contexts;
      expect(scrolled).toContain(nine);
    });

    it('selects a time on option click, closes the list and shows the label', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" onValueChange={onValueChange} step={60} />);
      await user.click(combobox('Time'));
      await user.click(screen.getByRole('option', { name: '12:00 AM' }));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('00:00');
      expect(combobox('Time')).toHaveValue('12:00 AM');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveFocus();
    });

    it('renders the open list in a portal and the closed list inline and hidden (single container)', async () => {
      const user = userEvent.setup();
      const { container } = render(<TimePicker aria-label="Time" step={60} data-testid="tp" />);
      const root = screen.getByTestId('tp');
      const inline = container.querySelector('[role="listbox"]');
      expect(inline).toHaveAttribute('hidden');
      expect(root).toContainElement(inline as HTMLElement);
      expect(combobox('Time')).toHaveAttribute('aria-controls', inline?.id);

      await user.click(combobox('Time'));
      const listbox = screen.getByRole('listbox');
      expect(root).not.toContainElement(listbox);
      expect(container.querySelectorAll('[role="listbox"]')).toHaveLength(0);
      expect(listbox.closest('[data-wave-portal]')).not.toBeNull();
      expect(listbox.closest('[data-side]')).toHaveAttribute('data-side', 'bottom');
      expect(combobox('Time')).toHaveAttribute('aria-controls', listbox.id);
    });

    it('has no accessibility violations while open', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="10:00" step={60} clearable />);
      await user.click(combobox('Time'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(await axe(document.body)).toHaveNoViolations();
    });

    it('does not open or change while read-only', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          readOnly
          defaultValue="09:00"
          onValueChange={onValueChange}
        />,
      );
      expect(combobox('Time')).toHaveAttribute('readonly');
      await user.click(combobox('Time'));
      await user.keyboard('{ArrowDown}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveValue('9:00 AM');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open while disabled', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" disabled />);
      expect(combobox('Time')).toBeDisabled();
      await user.click(combobox('Time'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it.each([
      ['disabled', { disabled: true }],
      ['read-only', { readOnly: true }],
    ])('an open list closes when the picker becomes %s and commits nothing', async (_, lock) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const props = { 'aria-label': 'Time', step: 60, onValueChange };
      const { rerender } = render(<TimePicker {...props} />);
      await user.click(combobox('Time'));
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      rerender(<TimePicker {...props} {...lock} />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
      expect(combobox('Time')).not.toHaveAttribute('aria-activedescendant');
      await user.keyboard('{ArrowDown}{Enter}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      // Unlocked again, the list stays closed until the user opens it.
      rerender(<TimePicker {...props} />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it.each([
      ['read-only', { readOnly: true }],
      ['disabled', { disabled: true }],
    ])('drops typed text when it becomes %s, so no later blur commits it', async (_, lock) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const props = { 'aria-label': 'Time', defaultValue: '09:00', onValueChange };
      const ui = (extra: object) => (
        <>
          <TimePicker {...props} {...extra} />
          <button type="button">After</button>
        </>
      );
      const { rerender } = render(ui({}));
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '2:00 PM');
      rerender(ui(lock));
      expect(combobox('Time')).toHaveValue('9:00 AM');
      await user.tab();
      rerender(ui({}));
      expect(combobox('Time')).toHaveValue('9:00 AM');
      await user.click(combobox('Time'));
      await user.tab();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(combobox('Time')).toHaveValue('9:00 AM');
    });
  });

  describe('open state', () => {
    it('controlled open: shows the list while `open` is true and reports requests', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const props = { 'aria-label': 'Time', step: 60, onOpenChange };
      const { rerender } = render(<TimePicker {...props} open={false} />);
      await user.click(combobox('Time'));
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      rerender(<TimePicker {...props} open />);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      // The parent keeps it open.
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      rerender(<TimePicker {...props} open={false} />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('a controlled open list is not shown while disabled or read-only', () => {
      const { rerender } = render(<TimePicker aria-label="Time" step={60} open disabled />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      rerender(<TimePicker aria-label="Time" step={60} open readOnly />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      rerender(<TimePicker aria-label="Time" step={60} open />);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('defaultOpen shows the list initially (uncontrolled)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          defaultValue="09:00"
          step={60}
          defaultOpen
          onOpenChange={onOpenChange}
        />,
      );
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '9:00 AM' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[false]]);
    });

    it('an uncontrolled list closed by locking reports it once and stays closed', () => {
      const onOpenChange = vi.fn();
      const props = { 'aria-label': 'Time', step: 60, defaultOpen: true, onOpenChange };
      const { rerender } = render(<TimePicker {...props} />);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      rerender(<TimePicker {...props} disabled />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[false]]);
      rerender(<TimePicker {...props} />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it.each([
      ['disabled', { disabled: true }],
      ['read-only', { readOnly: true }],
    ])('reports no close for a defaultOpen list that starts %s (it was never shown)', (_, lock) => {
      const onOpenChange = vi.fn();
      const props = { 'aria-label': 'Time', step: 60, defaultOpen: true, onOpenChange };
      const { rerender } = render(<TimePicker {...props} {...lock} />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      rerender(<TimePicker {...props} />);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('fires onOpenChange once per opening and closing in StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <TimePicker aria-label="Time" step={60} onOpenChange={onOpenChange} />
        </React.StrictMode>,
      );
      await user.click(combobox('Time'));
      expect(onOpenChange.mock.calls).toEqual([[true]]);
      await user.keyboard('{Escape}');
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });
  });

  describe('filtering (input-basic#35)', () => {
    it('shows exactly the matching options', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      await user.type(combobox('Time'), '1:00 P');
      expect(optionNames()).toEqual(['1:00 PM', '11:00 PM']);
      expect(screen.queryByRole('option', { name: '2:00 PM' })).not.toBeInTheDocument();
    });

    it('matches the 24h value with the 12h format', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" format="12h" step={60} />);
      await user.type(combobox('Time'), '13:');
      expect(optionNames()).toEqual(['1:00 PM']);
    });

    it('renders no listbox and aria-expanded=false when nothing matches (input-datetime#29)', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      await user.type(combobox('Time'), 'zz');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
      expect(combobox('Time')).not.toHaveAttribute('aria-activedescendant');
      expect(combobox('Time')).not.toHaveAttribute('aria-controls');
      expect(screen.getByRole('status')).toHaveTextContent('No matching times');
    });

    it.each([
      ['2:00pm', '2:00 PM', '14:00'],
      ['09:00 AM', '9:00 AM', '09:00'],
      ['14:00:00', '2:00 PM', '14:00'],
      ['2:00 p.m.', '2:00 PM', '14:00'],
    ])(
      'keeps the option of a complete time typed as %s listed and active',
      async (typed, label, value) => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(<TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />);
        await user.type(combobox('Time'), typed);
        const option = screen.getByRole('option', { name: label });
        expect(combobox('Time')).toHaveAttribute('aria-expanded', 'true');
        expect(combobox('Time')).toHaveAttribute('aria-activedescendant', option.id);
        expect(screen.getByRole('status').textContent).toBe('');
        await user.keyboard('{Enter}');
        expect(onValueChange.mock.calls).toEqual([[value]]);
        expect(combobox('Time')).toHaveValue(label);
      },
    );
  });

  describe('keyboard (input-basic#31, input-pickers#3)', () => {
    it('ArrowDown opens, moves the active option and aria-activedescendant follows', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      const input = combobox('Time');
      input.focus();
      await user.keyboard('{ArrowDown}');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      const first = screen.getByRole('option', { name: '12:00 AM' });
      expect(input).toHaveAttribute('aria-activedescendant', first.id);
      await user.keyboard('{ArrowDown}{ArrowDown}');
      const third = screen.getByRole('option', { name: '2:00 AM' });
      expect(input).toHaveAttribute('aria-activedescendant', third.id);
      expect(third).toHaveAttribute('data-active');
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '1:00 AM' }).id,
      );
    });

    it('Enter commits the active option and closes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={60} onValueChange={onValueChange} />);
      combobox('Time').focus();
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('01:00');
      expect(combobox('Time')).toHaveValue('1:00 AM');
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
    });

    it('Escape closes and clears aria-activedescendant', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      combobox('Time').focus();
      await user.keyboard('{ArrowDown}');
      expect(combobox('Time')).toHaveAttribute('aria-activedescendant');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).not.toHaveAttribute('aria-activedescendant');
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
    });

    it('typing makes the first match active and Enter commits it (input-datetime#24)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />);
      await user.type(combobox('Time'), '10:3');
      const match = screen.getByRole('option', { name: '10:30 AM' });
      expect(combobox('Time')).toHaveAttribute('aria-activedescendant', match.id);
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('10:30');
      expect(combobox('Time')).toHaveValue('10:30 AM');
    });

    it('partial text makes an option that starts with it active before one that only contains it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />);
      // '2' is also inside '12:00 AM', the first option in the list.
      await user.type(combobox('Time'), '2');
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '2:00 AM' }).id,
      );
      await user.type(combobox('Time'), ':00 p');
      expect(optionNames()).toEqual(['12:00 PM', '2:00 PM']);
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '2:00 PM' }).id,
      );
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('14:00');
    });

    it('partial text without a starting match falls back to the first option containing it', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} format="24h" />);
      await user.type(combobox('Time'), '2:');
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '02:00' }).id,
      );
    });

    it('an exact typed time is the active option and Enter commits it, not an earlier substring match', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />);
      // '2:00 PM' is also a substring of '12:00 PM', which comes first in the list.
      await user.type(combobox('Time'), '2:00 PM');
      expect(optionNames()).toEqual(['12:00 PM', '2:00 PM']);
      const exact = screen.getByRole('option', { name: '2:00 PM' });
      expect(combobox('Time')).toHaveAttribute('aria-activedescendant', exact.id);
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('14:00');
      expect(combobox('Time')).toHaveValue('2:00 PM');

      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '2:00 AM{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith('02:00');
      expect(combobox('Time')).toHaveValue('2:00 AM');
    });

    it('Enter and blur commit the same time for an exact typed time', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />
          <button type="button">Next</button>
        </>,
      );
      await user.type(combobox('Time'), '2:30 PM');
      await user.tab();
      expect(onValueChange).toHaveBeenLastCalledWith('14:30');
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '2:30 PM{Enter}');
      // Same day as before: nothing new to emit, and not '12:30'.
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(combobox('Time')).toHaveValue('2:30 PM');
    });

    it('a complete typed time outside the bounds does not commit another option on Enter', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit} aria-label="Form">
          <TimePicker aria-label="Time" maxTime="13:00" onValueChange={onValueChange} />
          <button type="submit">Save</button>
        </form>,
      );
      await user.type(combobox('Time'), '2:00 PM');
      // '12:00 PM' still matches the text, but it is not what was typed.
      expect(optionNames()).toEqual(['12:00 PM']);
      expect(combobox('Time')).not.toHaveAttribute('aria-activedescendant');
      await user.keyboard('{Enter}');
      expect(onValueChange).not.toHaveBeenCalled();
      // Edited text is never submitted with the form.
      expect(onSubmit).not.toHaveBeenCalled();
      expect(combobox('Time')).toHaveValue('2:00 PM');
    });

    it('an option chosen with the arrow keys after typing wins over the typed time', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />);
      await user.type(combobox('Time'), '2:00 PM{ArrowUp}');
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '12:00 PM' }).id,
      );
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('12:00');
    });

    it('opening an empty picker activates no option, so Enter commits nothing and submits the form', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit} aria-label="Form">
          <TimePicker aria-label="Time" step={60} onValueChange={onValueChange} />
          <button type="submit">Save</button>
        </form>,
      );
      await user.click(combobox('Time'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(combobox('Time')).not.toHaveAttribute('aria-activedescendant');
      expect(document.querySelector('[role="option"][data-active]')).toBeNull();
      await user.keyboard('{Enter}');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('opening with an off-grid value activates no option', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" defaultValue="09:15" onValueChange={onValueChange} />);
      await user.click(combobox('Time'));
      expect(combobox('Time')).not.toHaveAttribute('aria-activedescendant');
      await user.keyboard('{Enter}');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(combobox('Time')).toHaveValue('9:15 AM');
    });

    it('Enter commits a valid typed time that is not in the list', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />);
      await user.type(combobox('Time'), '9:15 AM{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('09:15');
      expect(combobox('Time')).toHaveValue('9:15 AM');
    });

    it('blur commits a valid exact typed time and keeps anything else, flagged', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <TimePicker aria-label="Time" defaultValue="08:00" onValueChange={onValueChange} />
          <button type="button">Next</button>
        </>,
      );
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '14:45');
      await user.tab();
      expect(onValueChange).toHaveBeenLastCalledWith('14:45');
      expect(combobox('Time')).toHaveValue('2:45 PM');

      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '14:');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      // The rejected text stays (it was reverted to the selected time before 0.6), flagged.
      expect(combobox('Time')).toHaveValue('14:');
      expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not commit a typed time outside minTime/maxTime', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          minTime="09:00"
          maxTime="17:00"
          onValueChange={onValueChange}
        />,
      );
      await user.type(combobox('Time'), '18:15{Enter}');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('erasing the text and pressing Enter clears the value without submitting the form', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      const { container } = render(
        <form onSubmit={onSubmit} aria-label="Form">
          <TimePicker
            aria-label="Time"
            name="start"
            defaultValue="09:00"
            onValueChange={onValueChange}
          />
          <button type="submit">Save</button>
        </form>,
      );
      await user.clear(combobox('Time'));
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('');
      expect(onSubmit).not.toHaveBeenCalled();
      expect(combobox('Time')).toHaveValue('');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      const form = container.querySelector('form') as HTMLFormElement;
      expect(new FormData(form).get('start')).toBe('');
    });

    it('erasing the text and leaving the field clears the value', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <TimePicker aria-label="Time" defaultValue="09:00" onValueChange={onValueChange} />
          <button type="button">Next</button>
        </>,
      );
      await user.clear(combobox('Time'));
      await user.tab();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('');
      expect(combobox('Time')).toHaveValue('');
    });

    it('erased text shows the controlled value again when the parent rejects the clear', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" value="09:00" onValueChange={onValueChange} />);
      await user.clear(combobox('Time'));
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('');
      expect(combobox('Time')).toHaveValue('9:00 AM');
    });

    it('Escape with the list closed reverts typed text (onClearDraft)', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="09:00" />);
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), 'zz');
      await user.keyboard('{Escape}');
      expect(combobox('Time')).toHaveValue('9:00 AM');
    });

    it('Escape with the list closed reverts erased text, so leaving the field keeps the value', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <TimePicker aria-label="Time" defaultValue="09:00" onValueChange={onValueChange} />
          <button type="button">Next</button>
        </>,
      );
      await user.clear(combobox('Time'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      // The first Escape closes the list, the second restores the selected time.
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveValue('');
      await user.keyboard('{Escape}');
      expect(combobox('Time')).toHaveValue('9:00 AM');
      await user.tab();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(combobox('Time')).toHaveValue('9:00 AM');
    });

    it('reopening by click with kept typed text shows its matches and the option typing made active', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={60} onValueChange={onValueChange} />);
      await user.type(combobox('Time'), '10');
      expect(optionNames()).toEqual(['10:00 AM', '10:00 PM']);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveValue('10');

      await user.click(combobox('Time'));
      expect(combobox('Time')).toHaveValue('10');
      expect(optionNames()).toEqual(['10:00 AM', '10:00 PM']);
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '10:00 AM' }).id,
      );
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('10:00');
      expect(combobox('Time')).toHaveValue('10:00 AM');

      // Once committed, the next opening shows every option again.
      await user.click(combobox('Time'));
      expect(screen.getAllByRole('option')).toHaveLength(24);
    });

    it('reopening with ArrowDown/ArrowUp with kept typed text starts at its first/last match', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      await user.type(combobox('Time'), '10{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      await user.keyboard('{ArrowDown}');
      expect(optionNames()).toEqual(['10:00 AM', '10:00 PM']);
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '10:00 AM' }).id,
      );
      await user.keyboard('{Escape}{ArrowUp}');
      expect(optionNames()).toEqual(['10:00 AM', '10:00 PM']);
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '10:00 PM' }).id,
      );
      expect(combobox('Time')).toHaveValue('10');
    });

    it('leaves the Enter that confirms an IME composition to the IME', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<TimePicker aria-label="Time" step={30} onValueChange={onValueChange} />);
      // 9:15 is not in the list: only the typed-time commit could take it.
      await user.type(combobox('Time'), '9:15');
      const notPrevented = fireEvent.keyDown(combobox('Time'), { key: 'Enter', isComposing: true });
      expect(notPrevented).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(combobox('Time')).toHaveValue('9:15');
      fireEvent.keyDown(combobox('Time'), { key: 'Enter' });
      expect(onValueChange).toHaveBeenCalledWith('09:15');
      expect(combobox('Time')).toHaveValue('9:15 AM');
    });

    it('Enter with the list closed and no edit is not prevented (forms submit)', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit} aria-label="Form">
          <TimePicker aria-label="Time" defaultValue="09:00" />
          <button type="submit">Save</button>
        </form>,
      );
      combobox('Time').focus();
      await user.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('step and bounds (input-datetime#25)', () => {
    it('falls back to 30 minutes and warns once per invalid step in development', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error');
      render(
        <React.StrictMode>
          <TimePicker aria-label="Time" step={0} data-testid="tp" />
          <TimePicker aria-label="Again" step={0} />
          <TimePicker aria-label="Other" step={-5} />
        </React.StrictMode>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TimePicker: `step` must be a positive number of minutes (received 0); using 30.',
        ],
        [
          '[WaveUI] TimePicker: `step` must be a positive number of minutes (received -5); using 30.',
        ],
      ]);
      expect(error).not.toHaveBeenCalled();
      expect(
        within(screen.getByTestId('tp')).getAllByRole('option', { hidden: true }),
      ).toHaveLength(48);
    });

    it('includes both bounds and stops at an off-step maxTime', async () => {
      const user = userEvent.setup();
      render(
        <TimePicker aria-label="Time" format="24h" minTime="09:00" maxTime="10:40" step={45} />,
      );
      await user.click(combobox('Time'));
      expect(optionNames()).toEqual(['09:00', '09:45', '10:30']);
    });

    it('accepts HH:mm:ss and 12h bounds', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" minTime="9:00 AM" maxTime="11:00:00" step={60} />);
      await user.click(combobox('Time'));
      expect(optionNames()).toEqual(['9:00 AM', '10:00 AM', '11:00 AM']);
    });

    it('warns once about invalid bounds and shows "No times available" instead of a list', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error');
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <TimePicker aria-label="Time" minTime="17:00" maxTime="nine" />
          <TimePicker aria-label="Again" minTime="17:00" maxTime="nine" />
        </React.StrictMode>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TimePicker: `minTime`/`maxTime` must be times such as "09:00", "09:00:00" or ' +
            '"9:00 AM" with minTime <= maxTime (received "17:00" / "nine"); no times are available.',
        ],
      ]);
      expect(error).not.toHaveBeenCalled();
      await user.click(combobox('Time'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
      expect(combobox('Time')).not.toHaveAttribute('aria-controls');
      expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual([
        'No times available',
        '',
      ]);
    });
  });

  describe('clear', () => {
    it('clears the value, empties the input and keeps focus on it with the list closed', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          defaultValue="09:00"
          clearable
          onValueChange={onValueChange}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Clear time' }));
      expect(onValueChange).toHaveBeenCalledWith('');
      expect(combobox('Time')).toHaveValue('');
      expect(combobox('Time')).toHaveFocus();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear time' })).not.toBeInTheDocument();
    });

    it('keeps an open list open (input-datetime#2)', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable step={60} />);
      await user.click(combobox('Time'));
      await user.click(screen.getByRole('button', { name: 'Clear time' }));
      expect(combobox('Time')).toHaveValue('');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('renders no clear button while read-only', () => {
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable readOnly />);
      expect(screen.queryByRole('button', { name: 'Clear time' })).not.toBeInTheDocument();
      // Room for the (disabled) expand button only.
      expect(combobox('Time')).not.toHaveClass('wave:pe-14');
      expect(combobox('Time')).toHaveClass('wave:pe-8');
    });

    it('shows the controlled value again when the parent rejects the clear', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" value="09:00" clearable onValueChange={() => {}} />);
      await user.click(screen.getByRole('button', { name: 'Clear time' }));
      expect(combobox('Time')).toHaveValue('9:00 AM');
    });

    it('Tab from erased text clears the value and moves on past the picker: focus never drops to <body>', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <TimePicker
            aria-label="Time"
            defaultValue="09:00"
            clearable
            onValueChange={onValueChange}
          />
          <button type="button">Next</button>
        </React.StrictMode>,
      );
      await user.clear(combobox('Time'));
      await user.tab();
      // The erased text clears the value before Tab moves focus, so the clear button it removes is
      // skipped: focus goes where Tab goes without it (the expand button is not a tab stop).
      expect(onValueChange.mock.calls).toEqual([['']]);
      expect(screen.queryByRole('button', { name: 'Clear time' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      expect(combobox('Time')).toHaveValue('');
    });

    it('Tab from erased text reaches the clear button when a controlled parent keeps the value', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <TimePicker aria-label="Time" value="09:00" clearable onValueChange={onValueChange} />
          <button type="button">Next</button>
        </>,
      );
      await user.clear(combobox('Time'));
      await user.tab();
      expect(onValueChange.mock.calls).toEqual([['']]);
      expect(combobox('Time')).toHaveValue('9:00 AM');
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveFocus();
    });
  });

  describe('expand button', () => {
    it('toggles the list and keeps focus in the input', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<TimePicker aria-label="Time" step={60} onOpenChange={onOpenChange} />);
      await user.click(expandButton());
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'true');
      expect(combobox('Time')).toHaveFocus();
      await user.click(expandButton());
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveFocus();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('follows the list with aria-expanded and aria-controls', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      expect(expandButton()).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton()).not.toHaveAttribute('aria-controls');
      await user.click(expandButton());
      expect(expandButton()).toHaveAttribute('aria-expanded', 'true');
      expect(expandButton()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
      // Text that matches no time shows no list.
      await user.type(combobox('Time'), 'zz');
      expect(expandButton()).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton()).not.toHaveAttribute('aria-controls');
    });

    it('reopens kept typed text with its matches and the option typing made active', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      await user.type(combobox('Time'), '10{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      await user.click(expandButton());
      expect(optionNames()).toEqual(['10:00 AM', '10:00 PM']);
      expect(combobox('Time')).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: '10:00 AM' }).id,
      );
    });

    it('is not a tab stop; the clear button is', async () => {
      const user = userEvent.setup();
      render(
        <>
          <TimePicker aria-label="Time" defaultValue="09:00" clearable />
          <button type="button">Next</button>
        </>,
      );
      expect(expandButton()).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(combobox('Time')).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    });

    it('is disabled while the picker is disabled or read-only', () => {
      const { rerender } = render(<TimePicker aria-label="Time" disabled />);
      expect(expandButton()).toBeDisabled();
      rerender(<TimePicker aria-label="Time" readOnly />);
      expect(expandButton()).toBeDisabled();
    });

    it('turns its glyph while the list is open, without motion when reduced', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      const glyph = () => expandButton().firstElementChild;
      expect(glyph()).toHaveAttribute('aria-hidden', 'true');
      expect(glyph()).toHaveClass(
        'wave:transition-transform',
        'wave:motion-reduce:transition-none',
      );
      expect(glyph()?.querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
      await user.click(expandButton());
      expect(glyph()).toHaveClass('wave:rotate-180');
    });

    it('keeps the chevron with expandIcon null and hides the button with false', () => {
      const { rerender } = render(<TimePicker aria-label="Time" expandIcon={null} />);
      expect(expandButton().querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
      rerender(<TimePicker aria-label="Time" expandIcon={false} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(combobox('Time').className).not.toMatch(/\bpe-/);
      rerender(<TimePicker aria-label="Time" expandIcon={<></>} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders custom content as the decorative glyph of the built-in button', () => {
      render(<TimePicker aria-label="Time" expandIcon={<svg data-testid="clock" />} />);
      const clock = screen.getByTestId('clock');
      expect(clock.closest('button')).toBe(expandButton());
      expect(clock.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(expandButton()).toHaveAccessibleName('Show times');
    });

    it.each([
      [
        'a <button>',
        <button key="native" type="button">
          ▾
        </button>,
      ],
      ['a Button', <Button key="wave">▾</Button>],
    ])(
      'does not nest %s passed as expandIcon: its children become the glyph (warns once)',
      (_label, expandIcon) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<TimePicker aria-label="Time" expandIcon={expandIcon} />);
        expect(document.querySelectorAll('button')).toHaveLength(1);
        expect(expandButton()).toHaveTextContent('▾');
        expect(warn.mock.calls).toEqual([[EXPAND_ICON_BUTTON]]);
      },
    );

    it('is named by labels.expand', () => {
      render(<TimePicker aria-label="Zeit" labels={{ expand: 'Uhrzeiten anzeigen' }} />);
      expect(expandButton('Uhrzeiten anzeigen')).toBeInTheDocument();
    });
  });

  describe('rejected text', () => {
    it('keeps text that is not a time on Enter, flags it and describes the error', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onInvalidInput = vi.fn();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit} aria-label="Form">
          <TimePicker
            aria-label="Time"
            defaultValue="09:00"
            onValueChange={onValueChange}
            onInvalidInput={onInvalidInput}
          />
          <button type="submit">Save</button>
        </form>,
      );
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), 'soon{Enter}');
      expect(combobox('Time')).toHaveValue('soon');
      expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
      expect(combobox('Time')).toHaveAccessibleDescription(INVALID_12H);
      expect(screen.getByRole('alert')).toHaveTextContent(INVALID_12H);
      expect(screen.getByRole('alert')).toHaveClass(
        'wave:mt-1',
        'wave:text-caption-1',
        'wave:text-error',
      );
      expect(onInvalidInput.mock.calls).toEqual([['soon', 'unparseable']]);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('keeps rejected text on blur and flags it instead of reverting it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onInvalidInput = vi.fn();
      render(
        <>
          <TimePicker
            aria-label="Time"
            defaultValue="08:00"
            format="24h"
            onValueChange={onValueChange}
            onInvalidInput={onInvalidInput}
          />
          <button type="button">Next</button>
        </>,
      );
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '25:00');
      await user.tab();
      expect(combobox('Time')).toHaveValue('25:00');
      expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
      expect(combobox('Time')).toHaveAccessibleDescription('Enter a time in the format HH:mm.');
      expect(onInvalidInput.mock.calls).toEqual([['25:00', 'unparseable']]);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('reports an edit once in StrictMode: blur after Enter stays quiet, Enter again reports', async () => {
      const user = userEvent.setup();
      const onInvalidInput = vi.fn<(text: string, reason: TimePickerInvalidReason) => void>();
      render(
        <React.StrictMode>
          <TimePicker aria-label="Time" onInvalidInput={onInvalidInput} />
          <button type="button">Next</button>
        </React.StrictMode>,
      );
      await user.type(combobox('Time'), 'soon{Enter}');
      await user.tab();
      expect(onInvalidInput.mock.calls).toEqual([['soon', 'unparseable']]);
      await user.click(combobox('Time'));
      await user.keyboard('{Enter}');
      expect(onInvalidInput.mock.calls).toEqual([
        ['soon', 'unparseable'],
        ['soon', 'unparseable'],
      ]);
      // A new edit is reported again, here by the blur.
      await user.type(combobox('Time'), 'er');
      await user.tab();
      expect(onInvalidInput.mock.calls).toHaveLength(3);
      expect(onInvalidInput).toHaveBeenLastCalledWith('sooner', 'unparseable');
    });

    it.each([
      ['text that still matches options', { maxTime: '13:00' }, '2:00 PM', ['12:00 PM']],
      ['text that matches nothing', {}, 'soon', []],
    ])(
      'closes the list when Enter rejects %s, so the popup does not cover the error message',
      async (_label, props, text, matches) => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(<TimePicker aria-label="Time" {...props} onOpenChange={onOpenChange} />);
        await user.type(combobox('Time'), text);
        const popup = () => document.querySelector('[data-wave-portal]');
        expect(popup()).not.toBeNull();
        expect(optionNames()).toEqual(matches);
        await user.keyboard('{Enter}');
        expect(combobox('Time')).toHaveValue(text);
        expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
        expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
        expect(popup()).toBeNull();
        expect(screen.getByRole('alert')).toBeVisible();
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        expect(combobox('Time')).toHaveFocus();
        // Editing the text reopens the list (and clears the error).
        await user.type(combobox('Time'), '{Backspace}');
        expect(popup()).not.toBeNull();
        expect(combobox('Time')).not.toHaveAttribute('aria-invalid');
      },
    );

    it('closes the list when Tab to the clear button rejects text, so the popup does not cover the error message', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onInvalidInput = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          defaultValue="09:00"
          clearable
          onOpenChange={onOpenChange}
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), 'zz');
      expect(listSurface()).toHaveTextContent('No matching times');
      await user.tab();
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveFocus();
      expect(combobox('Time')).toHaveValue('zz');
      expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent(INVALID_12H);
      expect(listSurface()).toBeNull();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
      expect(onInvalidInput.mock.calls).toEqual([['zz', 'unparseable']]);
    });

    it('closes the list when a press on its status text takes focus from the input and rejects the text', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<TimePicker aria-label="Time" onOpenChange={onOpenChange} />);
      await user.type(combobox('Time'), 'zz');
      await user.click(screen.getByText('No matching times', { selector: 'div' }));
      expect(combobox('Time')).not.toHaveFocus();
      expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent(INVALID_12H);
      expect(listSurface()).toBeNull();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('flags a time outside minTime/maxTime as out of range', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onInvalidInput = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          minTime="09:00"
          maxTime="17:00"
          onValueChange={onValueChange}
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.type(combobox('Time'), '18:15{Enter}');
      expect(onInvalidInput.mock.calls).toEqual([['18:15', 'out-of-range']]);
      expect(combobox('Time')).toHaveValue('18:15');
      expect(combobox('Time')).toHaveAccessibleDescription(
        'Enter a time between 9:00 AM and 5:00 PM.',
      );
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('flags any time while the bounds are invalid as out of range', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onInvalidInput = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          minTime="17:00"
          maxTime="09:00"
          onInvalidInput={onInvalidInput}
        />,
      );
      await user.type(combobox('Time'), '12:00{Enter}');
      expect(onInvalidInput.mock.calls).toEqual([['12:00', 'out-of-range']]);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TimePicker: `minTime`/`maxTime` must be times such as "09:00", "09:00:00" or ' +
            '"9:00 AM" with minTime <= maxTime (received "17:00" / "09:00"); no times are available.',
        ],
      ]);
    });

    it.each([
      ['12h', '12h', 'Enter a time between 9:00 AM and 5:30 PM.'],
      ['24h', '24h', 'Enter a time between 09:00 and 17:30.'],
    ] as const)('shows the bounds in the %s format', async (_label, format, message) => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" format={format} minTime="9:00 AM" maxTime="17:30" />);
      await user.type(combobox('Time'), '18:00{Enter}');
      expect(combobox('Time')).toHaveAccessibleDescription(message);
    });

    it.each([
      ['an earlier time with only minTime', { minTime: '09:00' }, '8:00 AM', 'on or after 9:00 AM'],
      ['a later time with only maxTime', { maxTime: '17:00' }, '6:00 PM', 'on or before 5:00 PM'],
    ])('describes %s with its own message', async (_label, props, text, range) => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" {...props} />);
      await user.type(combobox('Time'), `${text}{Enter}`);
      expect(combobox('Time')).toHaveAccessibleDescription(`Enter a time ${range}.`);
    });

    it('localizes the messages: invalidTime gets the display pattern, outOfRange undefined for a missing bound', async () => {
      const user = userEvent.setup();
      const invalidTime = vi.fn((format: string) => `Ungültig (${format})`);
      const outOfRange = vi.fn(
        (min: string | undefined, max: string | undefined) =>
          `Zwischen ${min ?? '-'} und ${max ?? '-'}`,
      );
      const labels: TimePickerLabels = { invalidTime, outOfRange };
      const { unmount } = render(
        <TimePicker aria-label="Zeit" format="24h" maxTime="17:00" labels={labels} />,
      );
      await user.type(combobox('Zeit'), 'bald{Enter}');
      expect(invalidTime).toHaveBeenLastCalledWith('HH:mm');
      expect(combobox('Zeit')).toHaveAccessibleDescription('Ungültig (HH:mm)');
      await user.clear(combobox('Zeit'));
      await user.type(combobox('Zeit'), '18:00{Enter}');
      expect(outOfRange).toHaveBeenLastCalledWith(undefined, '17:00');
      expect(combobox('Zeit')).toHaveAccessibleDescription('Zwischen - und 17:00');
      unmount();

      render(<TimePicker aria-label="Zeit" minTime="09:00" labels={labels} />);
      await user.type(combobox('Zeit'), 'bald{Enter}');
      expect(invalidTime).toHaveBeenLastCalledWith('h:mm AM');
      await user.clear(combobox('Zeit'));
      await user.type(combobox('Zeit'), '8:00 AM{Enter}');
      expect(outOfRange).toHaveBeenLastCalledWith('9:00 AM', undefined);
    });

    describe('clearing the error', () => {
      async function reject(user: ReturnType<typeof userEvent.setup>, text = 'soon') {
        await user.clear(combobox('Time'));
        await user.type(combobox('Time'), `${text}{Enter}`);
        expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
      }

      function expectValid(value: string) {
        expect(combobox('Time')).toHaveValue(value);
        expect(combobox('Time')).not.toHaveAttribute('aria-invalid');
        expect(combobox('Time')).not.toHaveAccessibleDescription();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      }

      it('editing the text clears it', async () => {
        const user = userEvent.setup();
        render(<TimePicker aria-label="Time" />);
        await reject(user);
        await user.type(combobox('Time'), 'x');
        expectValid('soonx');
      });

      it('selecting an option clears it', async () => {
        const user = userEvent.setup();
        render(<TimePicker aria-label="Time" maxTime="13:00" />);
        // Out of range, but '12:00 PM' still matches the text and is listed when the list, which
        // the rejected Enter closed, opens again.
        await reject(user, '2:00 PM');
        await user.click(combobox('Time'));
        await user.click(screen.getByRole('option', { name: '12:00 PM' }));
        expectValid('12:00 PM');
      });

      it('the clear button clears it', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const onInvalidInput = vi.fn();
        render(
          <TimePicker
            aria-label="Time"
            defaultValue="09:00"
            clearable
            onValueChange={onValueChange}
            onInvalidInput={onInvalidInput}
          />,
        );
        await reject(user);
        await user.click(screen.getByRole('button', { name: 'Clear time' }));
        expectValid('');
        expect(onValueChange.mock.calls).toEqual([['']]);
        expect(onInvalidInput).toHaveBeenCalledTimes(1);
      });

      it('Escape reverting the text clears it', async () => {
        const user = userEvent.setup();
        render(<TimePicker aria-label="Time" defaultValue="09:00" />);
        await reject(user);
        await user.keyboard('{Escape}');
        expectValid('9:00 AM');
      });

      it('a new value from the parent replaces the rejected text', async () => {
        const user = userEvent.setup();
        function Parent() {
          const [value, setValue] = React.useState('');
          return (
            <>
              <TimePicker aria-label="Time" value={value} onValueChange={setValue} />
              <button type="button" onClick={() => setValue('10:00')}>
                Ten
              </button>
            </>
          );
        }
        render(<Parent />);
        await reject(user);
        await user.click(screen.getByRole('button', { name: 'Ten' }));
        expectValid('10:00 AM');
      });

      it('a form reset clears it', async () => {
        const user = userEvent.setup();
        render(
          <form aria-label="Form">
            <TimePicker aria-label="Time" defaultValue="09:00" />
          </form>,
        );
        await reject(user);
        const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
        act(() => form.reset());
        expectValid('9:00 AM');
      });

      it.each([
        ['disabled', { disabled: true }],
        ['read-only', { readOnly: true }],
      ])('becoming %s drops the rejected text and clears it', async (_label, props) => {
        const user = userEvent.setup();
        const { rerender } = render(<TimePicker aria-label="Time" defaultValue="09:00" />);
        await reject(user);
        rerender(<TimePicker aria-label="Time" defaultValue="09:00" {...props} />);
        expectValid('9:00 AM');
      });
    });

    it('leaves the error text to a Field that shows an error', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(<TimePicker />, { errorId: FIELD_TEST_IDS.errorId });
      await user.type(combobox(FIELD_TEST_TEXT.label), 'soon{Enter}');
      expect(combobox(FIELD_TEST_TEXT.label)).toHaveAttribute('aria-invalid', 'true');
      expect(combobox(FIELD_TEST_TEXT.label)).toHaveAccessibleDescription(FIELD_TEST_TEXT.error);
      expect(screen.queryByText(INVALID_12H)).not.toBeInTheDocument();
    });

    it('shows its own error next to a Field warning', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(<TimePicker />, {
        validationState: 'warning',
        validationMessageId: FIELD_TEST_IDS.messageId,
      });
      await user.type(combobox(FIELD_TEST_TEXT.label), 'soon{Enter}');
      expect(combobox(FIELD_TEST_TEXT.label)).toHaveAccessibleDescription(
        `${INVALID_12H} ${FIELD_TEST_TEXT.message}`,
      );
    });

    it('has no accessibility violations while invalid', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable />);
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), 'soon{Enter}');
      expect(combobox('Time')).toHaveAttribute('aria-invalid', 'true');
      expect(await axe(document.body)).toHaveNoViolations();
    });
  });

  describe('localised built-in texts', () => {
    const labels: TimePickerLabels = {
      clear: 'Uhrzeit löschen',
      list: 'Uhrzeiten',
      noTimes: 'Keine Uhrzeiten verfügbar',
      noMatches: 'Keine passenden Uhrzeiten',
    };

    it('names the clear button with labels.clear', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <TimePicker
          aria-label="Zeit"
          defaultValue="09:00"
          clearable
          labels={labels}
          onValueChange={onValueChange}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Uhrzeit löschen' }));
      expect(onValueChange.mock.calls).toEqual([['']]);
    });

    it('names the list with labels.list when the picker lends it no label', async () => {
      const user = userEvent.setup();
      render(
        <>
          <label htmlFor="start">Beginn</label>
          <TimePicker id="start" step={60} labels={labels} />
        </>,
      );
      await user.click(combobox('Beginn'));
      expect(screen.getByRole('listbox', { name: 'Uhrzeiten' })).toBeInTheDocument();
    });

    it('announces and shows labels.noMatches for text that matches no time', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Zeit" step={60} labels={labels} />);
      await user.type(combobox('Zeit'), 'zz');
      expect(screen.getByRole('status')).toHaveTextContent('Keine passenden Uhrzeiten');
      const visible = screen
        .getAllByText('Keine passenden Uhrzeiten')
        .filter((element) => element.getAttribute('aria-hidden') === 'true');
      expect(visible).toHaveLength(1);
    });

    it('announces labels.noTimes when the bounds leave no times', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<TimePicker aria-label="Zeit" minTime="17:00" maxTime="09:00" labels={labels} />);
      await user.click(combobox('Zeit'));
      expect(screen.getByRole('status')).toHaveTextContent('Keine Uhrzeiten verfügbar');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TimePicker: `minTime`/`maxTime` must be times such as "09:00", "09:00:00" or ' +
            '"9:00 AM" with minTime <= maxTime (received "17:00" / "09:00"); no times are available.',
        ],
      ]);
    });
  });

  describe('dismissal (input-datetime#2, overlays#1)', () => {
    it('closes on an outside click', async () => {
      const user = userEvent.setup();
      render(
        <>
          <TimePicker aria-label="Time" step={60} />
          <p>Outside</p>
        </>,
      );
      await user.click(combobox('Time'));
      await user.click(screen.getByText('Outside'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes when focus leaves with Tab', async () => {
      const user = userEvent.setup();
      render(
        <>
          <TimePicker aria-label="Time" step={60} />
          <button type="button">After</button>
        </>,
      );
      await user.click(combobox('Time'));
      await user.tab();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('Tab to the clear button closes the status text shown instead of options (text rejected by Enter, reopened)', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable />);
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), 'zz{Enter}');
      await user.click(combobox('Time'));
      expect(listSurface()).toHaveTextContent('No matching times');
      await user.tab();
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveFocus();
      expect(listSurface()).toBeNull();
      expect(screen.getByRole('alert')).toHaveTextContent(INVALID_12H);
    });

    it('Tab to the clear button closes the status text shown instead of options (bounds that leave no times)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      render(
        <TimePicker
          aria-label="Time"
          defaultValue="09:00"
          clearable
          minTime="17:00"
          maxTime="09:00"
        />,
      );
      await user.click(combobox('Time'));
      expect(listSurface()).toHaveTextContent('No times available');
      await user.tab();
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveFocus();
      expect(listSurface()).toBeNull();
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TimePicker: `minTime`/`maxTime` must be times such as "09:00", "09:00:00" or ' +
            '"9:00 AM" with minTime <= maxTime (received "17:00" / "09:00"); no times are available.',
        ],
      ]);
    });

    it('Tab to the clear button commits a typed time that is not in the list and leaves the list closed', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          defaultValue="09:00"
          clearable
          onValueChange={onValueChange}
          onOpenChange={onOpenChange}
        />,
      );
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '9:15 AM');
      await user.tab();
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveFocus();
      expect(combobox('Time')).toHaveValue('9:15 AM');
      expect(onValueChange.mock.calls).toEqual([['09:15']]);
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
      expect(listSurface()).toBeNull();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });

    it('Escape closes only the listbox inside a parent layer; a second Escape reaches the parent', async () => {
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
          <TimePicker aria-label="Time" defaultValue="09:00" step={60} />
        </ParentLayer>,
      );
      await user.click(combobox('Time'));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
      expect(onParentDismiss.mock.calls[0][0]).toBe('escape');
    });

    it('Escape that restores erased text stays with the picker; with nothing to restore it reaches the parent', async () => {
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
          <TimePicker aria-label="With value" defaultValue="09:00" step={60} />
          <TimePicker aria-label="Empty" step={60} />
        </ParentLayer>,
      );
      await user.clear(combobox('With value'));
      await user.keyboard('{Escape}{Escape}');
      expect(combobox('With value')).toHaveValue('9:00 AM');
      expect(onParentDismiss).not.toHaveBeenCalled();

      await user.type(combobox('Empty'), '9');
      await user.clear(combobox('Empty'));
      await user.keyboard('{Escape}');
      expect(onParentDismiss).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onParentDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('option states (input-datetime#10, input-pickers#27)', () => {
    it('distinguishes the active option from the selected one', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="01:00" step={60} />);
      await user.click(combobox('Time'));
      await user.keyboard('{ArrowDown}');
      const selected = screen.getByRole('option', { name: '1:00 AM' });
      const active = screen.getByRole('option', { name: '2:00 AM' });
      expect(selected).toHaveAttribute('aria-selected', 'true');
      expect(selected).toHaveAttribute('data-selected');
      expect(selected).not.toHaveAttribute('data-active');
      expect(selected.querySelector('[data-wave-icon="check"]')).not.toBeNull();
      expect(selected).toHaveClass(
        'wave:data-[selected]:font-semibold',
        'wave:data-[selected]:bg-subtle-selected',
      );
      expect(active).toHaveAttribute('data-active');
      expect(active).toHaveAttribute('aria-selected', 'false');
      expect(active.querySelector('[data-wave-icon="check"]')).toBeNull();
      expect(active).toHaveClass(
        'wave:data-[active]:bg-subtle-hover',
        'wave:data-[active]:outline-2',
        'wave:data-[active]:outline-ring',
        'wave:data-[active]:-outline-offset-2',
      );
    });

    it('re-renders only the previous and the next active option on ArrowDown', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" step={60} />);
      // Opening an empty picker activates nothing; the first ArrowDown activates 12:00 AM.
      await user.click(combobox('Time'));
      await user.keyboard('{ArrowDown}');
      const spy = vi.mocked(useListboxOption);
      spy.mockClear();
      await user.keyboard('{ArrowDown}');
      const rendered = spy.mock.calls.map(([props]) => props.value);
      expect(rendered.sort()).toEqual(['00:00', '01:00']);
    });
  });

  describe('Field and routing (input-basic#1, C-ROUTING)', () => {
    it('is named by the Field label and described by its hint and error', () => {
      renderWithFieldContext(<TimePicker />, {
        hintId: FIELD_TEST_IDS.hintId,
        errorId: FIELD_TEST_IDS.errorId,
        required: true,
      });
      const input = combobox(FIELD_TEST_TEXT.label);
      expect(input).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
      expect(input).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
      renderWithFieldContext(
        <form aria-label="Form">
          <TimePicker required={false} />
        </form>,
        { required: true },
      );
      const input = combobox(FIELD_TEST_TEXT.label);
      expect(input).not.toHaveAttribute('aria-required', 'true');
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });

    it('routes id, aria-describedby, focus handlers and ref to the input', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const ref = React.createRef<HTMLInputElement>();
      render(
        <>
          <p id="help">Opening hours only</p>
          <TimePicker
            id="start"
            aria-label="Start"
            aria-describedby="help"
            onFocus={onFocus}
            onBlur={onBlur}
            ref={ref}
            data-testid="tp"
          />
        </>,
      );
      const input = combobox('Start');
      expect(input).toHaveAttribute('id', 'start');
      expect(input).toHaveAccessibleDescription('Opening hours only');
      expect(ref.current).toBe(input);
      expect(screen.getByTestId('tp')).not.toHaveAttribute('id');
      await user.click(input);
      await user.tab();
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('routes the text input attributes autoCapitalize and autoCorrect to the input', () => {
      render(
        <TimePicker aria-label="Time" autoCapitalize="none" autoCorrect="off" data-testid="root" />,
      );
      expect(combobox('Time')).toHaveAttribute('autocapitalize', 'none');
      expect(combobox('Time')).toHaveAttribute('autocorrect', 'off');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocapitalize');
      expect(screen.getByTestId('root')).not.toHaveAttribute('autocorrect');
    });

    it('composes a consumer onKeyDown; preventDefault suppresses the built-in keys', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TimePicker aria-label="Time" onKeyDown={() => {}} />);
      combobox('Time').focus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      rerender(<TimePicker aria-label="Time" onKeyDown={(e) => e.preventDefault()} />);
      await user.keyboard('{ArrowDown}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('types the routed focus and key handlers as input handlers', async () => {
      expectTypeOf<TimePickerProps['onFocus']>().toEqualTypeOf<
        React.FocusEventHandler<HTMLInputElement> | undefined
      >();
      expectTypeOf<TimePickerProps['onBlur']>().toEqualTypeOf<
        React.FocusEventHandler<HTMLInputElement> | undefined
      >();
      expectTypeOf<TimePickerProps['onKeyDown']>().toEqualTypeOf<
        React.KeyboardEventHandler<HTMLInputElement> | undefined
      >();
      expectTypeOf<TimePickerProps['onKeyUp']>().toEqualTypeOf<
        React.KeyboardEventHandler<HTMLInputElement> | undefined
      >();
      const user = userEvent.setup();
      const seen: string[] = [];
      render(
        <TimePicker
          aria-label="Time"
          onFocus={(event) => seen.push(`focus:${event.currentTarget.value}`)}
          onKeyUp={(event) => seen.push(`keyup:${event.currentTarget.value}`)}
          onBlur={(event) => seen.push(`blur:${event.currentTarget.value}`)}
        />,
      );
      await user.click(combobox('Time'));
      await user.keyboard('z');
      await user.tab();
      // The consumer's blur handler runs first (C-COMPOSE), so it still sees the typed text.
      expect(seen).toEqual(['focus:', 'keyup:z', 'blur:z']);
    });
  });

  describe('forms (input-basic#12)', () => {
    it('submits the HH:mm value under its name', () => {
      const { container } = render(
        <form aria-label="Form">
          <TimePicker aria-label="Time" name="start" defaultValue="09:30" />
        </form>,
      );
      const form = container.querySelector('form') as HTMLFormElement;
      expect(new FormData(form).get('start')).toBe('09:30');
    });

    it('adds nothing to FormData without a name', () => {
      const { container } = render(
        <form aria-label="Form">
          <TimePicker aria-label="Time" defaultValue="09:30" />
        </form>,
      );
      const form = container.querySelector('form') as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
    });

    it('resets to its default with the form (also without a name)', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <form aria-label="Form">
          <TimePicker aria-label="Named" name="start" defaultValue="09:00" step={60} />
          <TimePicker aria-label="Unnamed" defaultValue="10:00" step={60} />
        </form>,
      );
      await user.click(combobox('Named'));
      await user.click(screen.getByRole('option', { name: '3:00 PM' }));
      await user.click(combobox('Unnamed'));
      await user.click(screen.getByRole('option', { name: '4:00 PM' }));
      const form = container.querySelector('form') as HTMLFormElement;
      expect(new FormData(form).get('start')).toBe('15:00');
      act(() => form.reset());
      expect(combobox('Named')).toHaveValue('9:00 AM');
      expect(combobox('Unnamed')).toHaveValue('10:00 AM');
      expect(new FormData(form).get('start')).toBe('09:00');
    });

    it('a reset drops kept typed text, so a reopened list shows every option', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Form">
          <TimePicker aria-label="Time" defaultValue="09:00" step={60} />
        </form>,
      );
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '10{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveValue('10');
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      act(() => form.reset());
      expect(combobox('Time')).toHaveValue('9:00 AM');
      await user.click(combobox('Time'));
      expect(screen.getAllByRole('option')).toHaveLength(24);
    });

    it('blocks submission while required and empty', () => {
      const { container } = render(
        <form aria-label="Form">
          <TimePicker aria-label="Time" name="start" required />
        </form>,
      );
      const form = container.querySelector('form') as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
      expect(combobox('Time')).toHaveAttribute('aria-required', 'true');
    });

    it('focuses the input when the form reports it missing', () => {
      render(
        <form aria-label="Form">
          <TimePicker aria-label="Time" name="start" required />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(combobox('Time')).not.toHaveFocus();
      act(() => {
        form.reportValidity();
      });
      expect(combobox('Time')).toHaveFocus();
    });

    it('a disabled picker is not submitted and does not block submission', () => {
      render(
        <form aria-label="Form">
          <TimePicker aria-label="Time" name="start" defaultValue="09:00" disabled />
          <TimePicker aria-label="Empty" name="end" required disabled />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
      expect(form.checkValidity()).toBe(true);
    });

    it.each([
      ['its own required', { required: true, 'aria-label': 'Start' }, undefined],
      ['a required Field', {}, { required: true }],
    ])('does not block submission while read-only with %s', (_, props, fieldValue) => {
      const ui = (
        <form aria-label="Form">
          <TimePicker name="start" readOnly {...props} />
        </form>
      );
      if (fieldValue) renderWithFieldContext(ui, fieldValue);
      else render(ui);
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      // Like a native readonly input, it is barred from constraint validation: the user could
      // not fix it.
      expect(form.checkValidity()).toBe(true);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-required', 'true');
      expect(new FormData(form).get('start')).toBe('');
    });
  });

  describe('callbacks (input-basic#29)', () => {
    it('onValueChange fires only when the value changes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          defaultValue="09:00"
          step={60}
          onValueChange={onValueChange}
        />,
      );
      await user.click(combobox('Time'));
      await user.click(screen.getByRole('option', { name: '9:00 AM' }));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('fires once per interaction in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <TimePicker aria-label="Time" step={60} onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      await user.click(combobox('Time'));
      await user.click(screen.getByRole('option', { name: '2:00 AM' }));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('has no onChange alias of onValueChange: the 0.4 name is removed in 1.0', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <TimePicker
          aria-label="Time"
          step={60}
          // @ts-expect-error -- `onChange(value)` is removed in 1.0: use `onValueChange`
          onChange={onChange}
          onValueChange={onValueChange}
        />,
      );
      await user.click(combobox('Time'));
      await user.click(screen.getByRole('option', { name: '3:00 AM' }));
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), '4:00 AM{Enter}');
      expect(onValueChange.mock.calls).toEqual([['03:00'], ['04:00']]);
      // Untyped code that still passes it gets no value: it is never called with a time.
      expect(onChange).not.toHaveBeenCalledWith(expect.any(String));
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('lists the options of the open listbox inside it', async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Time" minTime="09:00" maxTime="10:00" step={30} />);
    await user.click(combobox('Time'));
    const listbox = screen.getByRole('listbox');
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['9:00 AM', '9:30 AM', '10:00 AM']);
  });

  describe('sizes and appearances (Phase 4 P4-01)', () => {
    const renderPicker = (props: Partial<TimePickerProps> = {}) =>
      render(<TimePicker aria-label="Start" clearable defaultValue="09:00" {...props} />);
    const input = () => screen.getByRole('combobox', { name: 'Start' });
    const root = () => input().closest('[data-size]') as HTMLElement;
    const clear = () => screen.getByRole('button', { name: 'Clear time' });
    const expand = () => screen.getByRole('button', { name: 'Show times' });

    it('keeps the 0.7 classes and renders the medium outline attributes', () => {
      renderPicker();
      expect(input()).toHaveClass(
        'wave:h-8',
        'wave:px-3',
        'wave:text-body-1',
        'wave:border-input',
        'wave:pe-14',
      );
      expect(expand()).toHaveClass('wave:h-6', 'wave:w-6', 'wave:end-1');
      expect(clear()).toHaveClass('wave:h-6', 'wave:w-6', 'wave:end-7');
      expect(root()).toHaveAttribute('data-size', 'medium');
      expect(root()).toHaveAttribute('data-appearance', 'outline');
    });

    it('small: 24px field, 20px buttons with hit layers at end-1 and end-7, pe-13', () => {
      renderPicker({ size: 'small' });
      expect(input()).toHaveClass('wave:h-6', 'wave:px-2', 'wave:text-caption-1', 'wave:pe-13');
      expect(expand()).toHaveClass('wave:size-5', 'wave:before:-inset-0.5', 'wave:end-1');
      expect(clear()).toHaveClass('wave:size-5', 'wave:before:-inset-0.5', 'wave:end-7');
    });

    it('large: 40px field, 32px buttons at end-1 and end-9, pe-18', () => {
      renderPicker({ size: 'large' });
      expect(input()).toHaveClass('wave:h-10', 'wave:px-4', 'wave:text-body-2', 'wave:pe-18');
      expect(expand()).toHaveClass('wave:size-8', 'wave:end-1');
      expect(clear()).toHaveClass('wave:size-8', 'wave:end-9');
    });

    it('an appearance styles the input; the time list does not change', async () => {
      const user = userEvent.setup();
      renderPicker({ appearance: 'filled-darker', size: 'large' });
      expect(input()).toHaveClass('wave:bg-input-filled-darker');
      await user.click(expand());
      expect(screen.getAllByRole('option')[0]).toHaveClass(
        'wave:px-3',
        'wave:py-1.5',
        'wave:text-body-1',
      );
    });

    it('takes the Field size', () => {
      renderWithFieldContext(<TimePicker />, { size: 'large' });
      const el = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(el.closest('[data-size]')).toHaveAttribute('data-size', 'large');
      expect(el).toHaveClass('wave:h-10', 'wave:text-body-2');
    });

    // Spec cases added beyond the brief (§2.1's Tests paragraph, binding via §2.2's "as §2.1 for
    // each picker"): each appearance with its data-appearance; the Field size with an own size
    // winning; WaveProvider inputDefaults with own props winning; invalid (a Field error and
    // TimePicker's own rejected-text invalid state) at underline and filled-darker; the glyph
    // widths per size for both buttons; the expandIcon rule (Phase 1 D21) at every size; RTL.

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
      const { rerender } = renderWithFieldContext(<TimePicker />, { size: 'large' });
      const byName = () =>
        screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label }).closest('[data-size]');
      expect(byName()).toHaveAttribute('data-size', 'large');
      rerender(<TimePicker size="small" />);
      expect(byName()).toHaveAttribute('data-size', 'small');
    });

    it('takes WaveProvider inputDefaults; its own props win', () => {
      const { rerender } = renderWithProviders(<TimePicker aria-label="Start" />, {
        inputDefaults: { size: 'small', appearance: 'underline' },
      });
      expect(root()).toHaveAttribute('data-size', 'small');
      expect(root()).toHaveAttribute('data-appearance', 'underline');
      rerender(<TimePicker aria-label="Start" size="large" appearance="outline" />);
      expect(root()).toHaveAttribute('data-size', 'large');
      expect(root()).toHaveAttribute('data-appearance', 'outline');
    });

    it.each(['underline', 'filled-darker'] as const)(
      'an invalid %s field keeps the destructive border and the focus color on its bottom (Field error)',
      (appearance) => {
        renderWithFieldContext(<TimePicker appearance={appearance} />, {
          errorId: FIELD_TEST_IDS.errorId,
        });
        const byName = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
        expect(byName).toHaveClass('wave:border-destructive', 'wave:focus:border-b-primary');
      },
    );

    it.each(['underline', 'filled-darker'] as const)(
      'a rejected time at appearance="%s" keeps the destructive border and the focus color on its bottom (TimePicker\'s own invalid state)',
      async (appearance) => {
        const user = userEvent.setup();
        renderPicker({ appearance });
        await user.clear(input());
        await user.type(input(), 'zz');
        await user.keyboard('{Enter}');
        expect(input()).toHaveAttribute('aria-invalid', 'true');
        expect(input()).toHaveClass('wave:border-destructive', 'wave:focus:border-b-primary');
      },
    );

    it.each([
      ['small', 12, 12],
      ['medium', 12, 16],
      ['large', 16, 20],
    ] as const)('glyph widths at size=%s: chevron %spx, clear %spx', (size, chevronPx, clearPx) => {
      renderPicker({ size });
      expect(expand().querySelector('svg')).toHaveAttribute('width', String(chevronPx));
      expect(clear().querySelector('svg')).toHaveAttribute('width', String(clearPx));
    });

    describe('the expandIcon rule at every size (Phase 1 D21)', () => {
      it.each([
        ['small', null, 12],
        ['small', undefined, 12],
        ['medium', null, 12],
        ['medium', undefined, 12],
        ['large', null, 16],
        ['large', undefined, 16],
      ] as const)('keeps the chevron sized for %s with expandIcon %s', (size, expandIcon, px) => {
        renderPicker({ size, expandIcon });
        expect(expand().querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
        expect(expand().querySelector('svg')).toHaveAttribute('width', String(px));
      });

      it.each(['small', 'medium', 'large'] as const)(
        'hides the button at size=%s with expandIcon false',
        (size) => {
          renderPicker({ size, expandIcon: false });
          expect(screen.queryByRole('button', { name: 'Show times' })).not.toBeInTheDocument();
        },
      );

      it.each(['small', 'medium', 'large'] as const)(
        'renders a custom expandIcon as given at size=%s',
        (size) => {
          renderPicker({ size, expandIcon: <svg data-testid="clock" /> });
          expect(screen.getByTestId('clock').closest('button')).toBe(expand());
        },
      );
    });

    it('keeps the buttons at the inline end in RTL', () => {
      renderWithProviders(
        <TimePicker aria-label="Start" size="large" clearable defaultValue="09:30" />,
        { dir: 'rtl' },
      );
      expect(screen.getByRole('button', { name: 'Show times' })).toHaveClass('wave:end-1');
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveClass('wave:end-9');
    });
  });
});

describe('TimePicker — format follows the browser language (1.0, P14-06)', () => {
  const INVALID_24H = 'Enter a time in the format HH:mm.';

  /** Makes `navigator.language` read `language` (jsdom's is `en-US`); restored after each test. */
  function browserLanguage(language: string) {
    return vi.spyOn(Navigator.prototype, 'language', 'get').mockReturnValue(language);
  }

  /** `Intl.DateTimeFormat` resolving `resolved`, so the hour cycle comes from the stub. */
  function stubHourCycle(resolved: Partial<Intl.ResolvedDateTimeFormatOptions>) {
    return vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      class {
        resolvedOptions() {
          return resolved;
        }
      } as unknown as typeof Intl.DateTimeFormat,
    );
  }

  it.each([
    ['en-US', '1:30 PM', '1:00 PM', INVALID_12H],
    ['en-GB', '13:30', '13:00', INVALID_24H],
    ['de-DE', '13:30', '13:00', INVALID_24H],
  ])(
    'without format, %s shows %s, lists %s and asks for its pattern',
    async (language, display, option, invalid) => {
      browserLanguage(language);
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="13:30" step={60} />);
      expect(combobox('Time')).toHaveValue(display);
      await user.click(combobox('Time'));
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(24);
      await user.clear(combobox('Time'));
      await user.type(combobox('Time'), 'soon{Enter}');
      expect(combobox('Time')).toHaveAccessibleDescription(invalid);
    },
  );

  it.each([
    [{ hourCycle: 'h23' }, '13:30'],
    [{ hourCycle: 'h24' }, '13:30'],
    [{ hourCycle: 'h11' }, '1:30 PM'],
    [{ hourCycle: 'h12' }, '1:30 PM'],
    [{ hour12: false }, '13:30'],
  ] as const)(
    'reads the hour cycle of navigator.language through Intl: %j shows %s',
    (resolved, display) => {
      browserLanguage('xx-XX');
      const intl = stubHourCycle(resolved);
      render(<TimePicker aria-label="Time" value="13:30" />);
      expect(combobox('Time')).toHaveValue(display);
      expect(intl).toHaveBeenCalledWith('xx-XX', { hour: 'numeric' });
    },
  );

  it.each([
    ['de-DE', '12h', '1:30 PM'],
    ['en-US', '24h', '13:30'],
  ] as const)(
    'an explicit format wins: %s with format="%s" shows %s',
    (language, format, display) => {
      const languageGetter = browserLanguage(language);
      const intl = vi.spyOn(Intl, 'DateTimeFormat');
      render(<TimePicker aria-label="Time" value="13:30" format={format} />);
      expect(combobox('Time')).toHaveValue(display);
      // The language is not even read.
      expect(languageGetter).not.toHaveBeenCalled();
      expect(intl).not.toHaveBeenCalled();
    },
  );

  it('reads the language once per picker, not on every keystroke', async () => {
    browserLanguage('de-DE');
    const intl = vi.spyOn(Intl, 'DateTimeFormat');
    const user = userEvent.setup();
    render(<TimePicker aria-label="Time" defaultValue="09:00" />);
    expect(intl).toHaveBeenCalledTimes(1);
    await user.clear(combobox('Time'));
    await user.type(combobox('Time'), '14');
    expect(intl).toHaveBeenCalledTimes(1);
  });

  it('switches when format is removed, and back when it is given again', () => {
    browserLanguage('de-DE');
    const { rerender } = render(<TimePicker aria-label="Time" value="13:30" format="12h" />);
    expect(combobox('Time')).toHaveValue('1:30 PM');
    rerender(<TimePicker aria-label="Time" value="13:30" />);
    expect(combobox('Time')).toHaveValue('13:30');
    rerender(<TimePicker aria-label="Time" value="13:30" format="12h" />);
    expect(combobox('Time')).toHaveValue('1:30 PM');
  });

  it('renders 12-hour times on the server, without reading the language', () => {
    const languageGetter = browserLanguage('de-DE');
    const html = renderToString(<TimePicker aria-label="Time" defaultValue="13:30" step={60} />);
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = html;
    expect(parsed.querySelector('input[role="combobox"]')).toHaveAttribute('value', '1:30 PM');
    const options = Array.from(parsed.querySelectorAll('[role="option"]'), (o) => o.textContent);
    expect(options).toContain('1:00 PM');
    expect(options).not.toContain('13:00');
    expect(languageGetter).not.toHaveBeenCalled();
  });

  it('hydrates the 12-hour server HTML without a mismatch, then follows a 24-hour language', async () => {
    const languageGetter = browserLanguage('de-DE');
    const element = <TimePicker aria-label="Time" defaultValue="13:30" step={60} />;
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    const serverInput = container.querySelector('input');
    // What the hydration commit shows (a parent's layout effect runs once, in that commit).
    const firstCommit: Array<{ value: string | undefined; languageReads: number }> = [];
    function Probe({ children }: { children: React.ReactNode }) {
      React.useLayoutEffect(() => {
        firstCommit.push({
          value: container.querySelector('input')?.value,
          languageReads: languageGetter.mock.calls.length,
        });
      }, []);
      return children;
    }
    const error = vi.spyOn(console, 'error');
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <Probe>{element}</Probe>, { onRecoverableError });
      });
      expect(firstCommit).toEqual([{ value: '1:30 PM', languageReads: 0 }]);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      // Hydrated in place (a mismatch would have replaced the server's elements), then switched.
      expect(container.querySelector('input')).toBe(serverInput);
      expect(combobox('Time')).toHaveValue('13:30');
      expect(languageGetter).toHaveBeenCalled();
      const listbox = container.querySelector('[role="listbox"]');
      const options = Array.from(listbox?.querySelectorAll('[role="option"]') ?? [], (o) =>
        o.textContent?.trim(),
      );
      expect(options).toContain('13:00');
      expect(options).not.toContain('1:00 PM');
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it('a picker mounted in the browser follows the language from its first commit', () => {
    browserLanguage('de-DE');
    const commits: Array<string | undefined> = [];
    function Probe({ children }: { children: React.ReactNode }) {
      React.useLayoutEffect(() => {
        commits.push(screen.getByRole<HTMLInputElement>('combobox').value);
      }, []);
      return children;
    }
    render(
      <Probe>
        <TimePicker aria-label="Time" defaultValue="13:30" />
      </Probe>,
    );
    expect(commits).toEqual(['13:30']);
  });

  it('types format as the two patterns; the default is no longer a fixed value', () => {
    expectTypeOf<TimePickerProps['format']>().toEqualTypeOf<'12h' | '24h' | undefined>();
  });
});

describe('TimePicker — slotProps', () => {
  type TimePickerSlotProps = NonNullable<TimePickerProps['slotProps']>;
  const EVERY_PART: TimePickerSlotProps = {
    root: {},
    input: {},
    clearButton: {},
    expandButton: {},
    errorMessage: {},
    listbox: {},
    option: {},
    checkIcon: {},
    surface: {},
    emptyMessage: {},
  };
  const part = (name: string) => document.querySelector<HTMLElement>(`.${name}`);
  const all = (name: string) => Array.from(document.querySelectorAll<HTMLElement>(`.${name}`));
  /** Three times, 9:00 AM to 10:00 AM. */
  const BOUNDS = { minTime: '09:00', maxTime: '10:00' } as const;

  /** Types text no time matches; Enter then rejects it, which shows the error message. */
  async function typeRejected(reject: boolean) {
    const input = combobox();
    fireEvent.change(input, { target: { value: 'zz' } });
    if (reject) fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {});
  }

  it('renders the 0.17.1 parts without slotProps (opening tags, attributes sorted)', async () => {
    // Captured from b8941ef, open client renders: the merged props may put the class before the
    // locked attributes.
    const { unmount } = render(
      <TimePicker aria-label="Time" defaultOpen defaultValue="09:30" clearable {...BOUNDS} />,
    );
    await act(async () => {});
    const { input, clearButton, expandButton, surface, listbox, option, checkIcon } =
      timePickerClassNames;
    expect(
      openingTags(
        ...[input, clearButton, expandButton, surface, listbox, option, checkIcon].flatMap(all),
      ),
    ).toBe(
      [
        '<input aria-activedescendant="timepicker-listbox-_id0_-opt-0" aria-autocomplete="list" aria-controls="timepicker-listbox-_id0_" aria-expanded="true" aria-haspopup="listbox" aria-label="Time" autocomplete="off" class="wave-time-picker__input wave:h-8 wave:w-full wave:px-3 wave:text-body-1 wave:rounded wave:border wave:border-input wave:border-b-stroke-accessible wave:bg-background wave:text-foreground wave:placeholder:text-muted-foreground wave:focus:outline-hidden wave:focus:border-b-2 wave:focus:border-b-primary wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:pe-14" placeholder="Select a time" role="combobox" type="text" value="9:30 AM">',
        '<button aria-label="Clear time" class="wave-time-picker__clear-button wave:absolute wave:flex wave:h-6 wave:w-6 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground wave:end-7 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" type="button">',
        '<button aria-controls="timepicker-listbox-_id0_" aria-expanded="true" aria-label="Show times" class="wave-time-picker__expand-button wave:absolute wave:flex wave:h-6 wave:w-6 wave:items-center wave:justify-center wave:rounded wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground wave:end-1 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100" tabindex="-1" type="button">',
        '<div class="wave-time-picker__surface wave:flex wave:flex-col wave:overflow-hidden wave:rounded wave:border wave:border-border wave:bg-background wave:shadow-8 wave:transition-[opacity,translate] wave:duration-wave-normal wave:ease-wave-decelerate-mid wave:data-[presence=exiting]:duration-wave-faster wave:data-[presence=exiting]:ease-wave-accelerate-min wave:motion-reduce:transition-none wave:data-[presence=entering]:starting:opacity-0 wave:data-[presence=exiting]:opacity-0 wave:data-[side=top]:data-[presence=entering]:starting:translate-y-1 wave:data-[side=top]:data-[presence=exiting]:translate-y-1 wave:data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 wave:data-[side=bottom]:data-[presence=exiting]:-translate-y-1 wave:data-[side=left]:data-[presence=entering]:starting:translate-x-1 wave:data-[side=left]:data-[presence=exiting]:translate-x-1 wave:data-[side=right]:data-[presence=entering]:starting:-translate-x-1 wave:data-[side=right]:data-[presence=exiting]:-translate-x-1" data-align="start" data-presence="entered" data-side="bottom" data-state="open" style="position: fixed; left: 0px; top: 0px; width: var(--wave-popup-reference-width); max-width: var(--wave-popup-available-width); max-height: var(--wave-popup-available-height); transform: translate(8px, 4px); --wave-popup-available-width: 0px; --wave-popup-available-height: 0px; --wave-popup-reference-width: 0px;">',
        '<ul aria-label="Time" class="wave-time-picker__listbox wave:max-h-60 wave:min-h-0 wave:overflow-auto wave:py-1 wave:focus:outline-hidden" id="timepicker-listbox-_id0_" role="listbox" tabindex="-1">',
        '<li aria-selected="false" class="wave-time-picker__option wave:flex wave:cursor-pointer wave:items-center wave:gap-2 wave:px-3 wave:py-1.5 wave:text-body-1 wave:text-foreground wave:hover:bg-subtle-hover wave:data-[active]:bg-subtle-hover wave:data-[active]:outline-2 wave:data-[active]:outline-ring wave:data-[active]:-outline-offset-2 wave:data-[selected]:bg-subtle-selected wave:data-[selected]:font-semibold" id="timepicker-listbox-_id0_-opt-1" role="option">',
        '<li aria-selected="true" class="wave-time-picker__option wave:flex wave:cursor-pointer wave:items-center wave:gap-2 wave:px-3 wave:py-1.5 wave:text-body-1 wave:text-foreground wave:hover:bg-subtle-hover wave:data-[active]:bg-subtle-hover wave:data-[active]:outline-2 wave:data-[active]:outline-ring wave:data-[active]:-outline-offset-2 wave:data-[selected]:bg-subtle-selected wave:data-[selected]:font-semibold wave:forced-colors:outline-2 wave:forced-colors:outline-[Highlight] wave:forced-colors:-outline-offset-2" data-active="" data-selected="" id="timepicker-listbox-_id0_-opt-0" role="option">',
        '<li aria-selected="false" class="wave-time-picker__option wave:flex wave:cursor-pointer wave:items-center wave:gap-2 wave:px-3 wave:py-1.5 wave:text-body-1 wave:text-foreground wave:hover:bg-subtle-hover wave:data-[active]:bg-subtle-hover wave:data-[active]:outline-2 wave:data-[active]:outline-ring wave:data-[active]:-outline-offset-2 wave:data-[selected]:bg-subtle-selected wave:data-[selected]:font-semibold" id="timepicker-listbox-_id0_-opt-2" role="option">',
        '<span class="wave-time-picker__check-icon wave:flex wave:h-4 wave:w-4 wave:shrink-0 wave:items-center wave:justify-center">',
        '<span class="wave-time-picker__check-icon wave:flex wave:h-4 wave:w-4 wave:shrink-0 wave:items-center wave:justify-center">',
        '<span class="wave-time-picker__check-icon wave:flex wave:h-4 wave:w-4 wave:shrink-0 wave:items-center wave:justify-center">',
      ].join('\n'),
    );
    unmount();

    const second = render(<TimePicker aria-label="Time" {...BOUNDS} />);
    await typeRejected(false);
    expect(openingTags(...[surface, timePickerClassNames.emptyMessage].flatMap(all))).toBe(
      [
        '<div class="wave-time-picker__surface wave:flex wave:flex-col wave:overflow-hidden wave:rounded wave:border wave:border-border wave:bg-background wave:shadow-8 wave:transition-[opacity,translate] wave:duration-wave-normal wave:ease-wave-decelerate-mid wave:data-[presence=exiting]:duration-wave-faster wave:data-[presence=exiting]:ease-wave-accelerate-min wave:motion-reduce:transition-none wave:data-[presence=entering]:starting:opacity-0 wave:data-[presence=exiting]:opacity-0 wave:data-[side=top]:data-[presence=entering]:starting:translate-y-1 wave:data-[side=top]:data-[presence=exiting]:translate-y-1 wave:data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 wave:data-[side=bottom]:data-[presence=exiting]:-translate-y-1 wave:data-[side=left]:data-[presence=entering]:starting:translate-x-1 wave:data-[side=left]:data-[presence=exiting]:translate-x-1 wave:data-[side=right]:data-[presence=entering]:starting:-translate-x-1 wave:data-[side=right]:data-[presence=exiting]:-translate-x-1" data-align="start" data-presence="entered" data-side="bottom" data-state="open" style="position: fixed; left: 0px; top: 0px; width: var(--wave-popup-reference-width); max-width: var(--wave-popup-available-width); max-height: var(--wave-popup-available-height); transform: translate(8px, 4px); --wave-popup-available-width: 0px; --wave-popup-available-height: 0px; --wave-popup-reference-width: 0px;">',
        '<div aria-hidden="true" class="wave-time-picker__empty-message wave:px-3 wave:py-1.5 wave:text-body-1 wave:text-muted-foreground">',
      ].join('\n'),
    );
    second.unmount();

    render(<TimePicker aria-label="Time" {...BOUNDS} />);
    await typeRejected(true);
    expect(openingTags(...[input, timePickerClassNames.errorMessage, listbox].flatMap(all))).toBe(
      [
        '<input aria-autocomplete="list" aria-controls="timepicker-listbox-_id0_" aria-describedby="timepicker-error-_id1_" aria-expanded="false" aria-haspopup="listbox" aria-invalid="true" aria-label="Time" autocomplete="off" class="wave-time-picker__input wave:h-8 wave:w-full wave:px-3 wave:text-body-1 wave:rounded wave:border wave:bg-background wave:text-foreground wave:placeholder:text-muted-foreground wave:focus:outline-hidden wave:focus:border-b-2 wave:focus:border-b-primary wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:border-destructive wave:pe-8" placeholder="Select a time" role="combobox" type="text" value="zz">',
        '<p class="wave-time-picker__error-message wave:mt-1 wave:text-caption-1 wave:text-error" id="timepicker-error-_id1_" role="alert">',
        '<ul aria-label="Time" class="wave-time-picker__listbox wave:max-h-60 wave:min-h-0 wave:overflow-auto wave:py-1 wave:focus:outline-hidden" hidden="" id="timepicker-listbox-_id0_" role="listbox" tabindex="-1">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: TimePickerProps[] = [
      { 'aria-label': 'Time', defaultOpen: true, defaultValue: '09:30', clearable: true },
      { 'aria-label': 'Time', defaultValue: '09:30', clearable: true },
      {
        id: 'own',
        'aria-label': 'Time',
        'aria-describedby': 'hint',
        required: true,
        name: 'time',
        disabled: true,
        clearable: true,
        defaultValue: '09:00',
      },
      { 'aria-label': 'Time', readOnly: true, expandIcon: false, defaultValue: '10:00' },
      // The root's own props: the rest, the style and the hidden state.
      {
        'aria-label': 'Time',
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
        (slotProps) => <TimePicker {...props} {...BOUNDS} slotProps={slotProps} />,
        EVERY_PART,
      );
    }
    // Your own data attributes on the root, the locked ones among them.
    expectInertSlotProps(
      (slotProps) => (
        <TimePicker aria-label="Time" data-size="large" data-x="1" slotProps={slotProps} />
      ),
      EVERY_PART,
    );
  });

  it('renders the same markup with an error message and an empty list, with and without slotProps', async () => {
    for (const reject of [false, true]) {
      const { baseElement, rerender, unmount } = render(
        <TimePicker aria-label="Time" {...BOUNDS} />,
      );
      await typeRejected(reject);
      const markup = baseElement.innerHTML;
      for (const slotProps of [{}, EVERY_PART, undefined]) {
        rerender(<TimePicker aria-label="Time" {...BOUNDS} slotProps={slotProps} />);
        expect(baseElement.innerHTML).toBe(markup);
      }
      unmount();
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
      expandButton: React.createRef<HTMLButtonElement>(),
      listbox: React.createRef<HTMLUListElement>(),
      option: React.createRef<HTMLLIElement>(),
      checkIcon: React.createRef<HTMLSpanElement>(),
      surface: React.createRef<HTMLDivElement>(),
    };
    const ref = React.createRef<HTMLInputElement>();
    render(
      <TimePicker
        aria-label="Time"
        defaultOpen
        defaultValue="09:30"
        clearable
        ref={ref}
        {...BOUNDS}
        slotProps={{
          root: mine('root', refs.root),
          input: mine('input', refs.input),
          clearButton: mine('clearButton', refs.clearButton),
          expandButton: mine('expandButton', refs.expandButton),
          listbox: mine('listbox', refs.listbox),
          option: mine('option', refs.option),
          checkIcon: mine('checkIcon', refs.checkIcon),
          surface: mine('surface', refs.surface),
        }}
      />,
    );
    await act(async () => {});
    const names = Object.keys(refs) as (keyof typeof refs)[];
    for (const name of names) {
      const elements = all(timePickerClassNames[name]);
      expect(elements.length).toBeGreaterThan(0);
      for (const element of elements) {
        expect(element.classList[0]).toBe(timePickerClassNames[name]);
        expect(element.classList[element.classList.length - 1]).toBe(`my-${name}`);
        expect(element).toHaveStyle({ opacity: '0.5' });
        expect(element).toHaveAttribute('data-part', name);
      }
      // One ref, several options: it holds the last one attached.
      expect(elements).toContain(refs[name].current);
    }
    expect(ref.current).toBe(refs.input.current);
    expect(all(timePickerClassNames.option)).toHaveLength(3);
    // The surface is still placed: the positioning holds the same element.
    expect(refs.surface.current).toHaveStyle({ position: 'fixed' });
  });

  it('puts your props on the error message and the empty row', async () => {
    const errorMessage = React.createRef<HTMLParagraphElement>();
    const emptyMessage = React.createRef<HTMLDivElement>();
    const slotProps: TimePickerSlotProps = {
      errorMessage: { ref: errorMessage, className: 'my-error', 'data-part': 'error' },
      emptyMessage: { ref: emptyMessage, className: 'my-empty', 'data-part': 'empty' },
    };
    render(<TimePicker aria-label="Time" {...BOUNDS} slotProps={slotProps} />);
    await typeRejected(false);
    expect(emptyMessage.current).toBe(part(timePickerClassNames.emptyMessage));
    expect(emptyMessage.current).toHaveClass(timePickerClassNames.emptyMessage, 'my-empty');
    expect(emptyMessage.current).toHaveAttribute('aria-hidden', 'true');
    fireEvent.keyDown(combobox(), { key: 'Enter' });
    await act(async () => {});
    expect(errorMessage.current).toBe(screen.getByRole('alert'));
    expect(errorMessage.current).toHaveClass(timePickerClassNames.errorMessage, 'my-error');
    expect(errorMessage.current).toHaveAttribute('data-part', 'error');
  });

  it('keeps the empty row out of the tab order: a part sets no tabIndex on it', async () => {
    render(
      <TimePicker aria-label="Time" {...BOUNDS} slotProps={{ emptyMessage: { tabIndex: 0 } }} />,
    );
    await typeRejected(false);
    expect(part(timePickerClassNames.emptyMessage)).not.toHaveAttribute('tabindex');
  });

  it('keeps the input and the clear button reachable: a part sets no inert on them', () => {
    render(
      <TimePicker
        aria-label="Time"
        defaultValue="09:00"
        clearable
        slotProps={{ input: { inert: true }, clearButton: { inert: true } }}
      />,
    );
    expect(combobox()).not.toHaveAttribute('inert');
    expect(part(timePickerClassNames.clearButton)).not.toHaveAttribute('inert');
  });

  it('runs your option onClick before the selection, once per click in StrictMode; preventDefault() skips it', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <React.StrictMode>
        <TimePicker
          aria-label="Time"
          defaultOpen
          onValueChange={onValueChange}
          {...BOUNDS}
          slotProps={{ option: { onClick: (event) => event.preventDefault() } }}
        />
      </React.StrictMode>,
    );
    await act(async () => {});
    await user.click(screen.getByRole('option', { name: '9:30 AM' }));
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(
      <React.StrictMode>
        <TimePicker
          aria-label="Time"
          defaultOpen
          onValueChange={onValueChange}
          {...BOUNDS}
          slotProps={{ option: { onClick } }}
        />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('option', { name: '9:30 AM' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('09:30');
  });

  it("runs your input handlers first; preventDefault() skips the TimePicker's keys", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onInvalidInput = vi.fn();
    render(
      <TimePicker
        aria-label="Time"
        onInvalidInput={onInvalidInput}
        onKeyDown={() => order.push('onKeyDown')}
        {...BOUNDS}
        slotProps={{
          input: {
            onKeyDown: (event) => {
              order.push('part key');
              if (event.key === 'Enter') event.preventDefault();
            },
          },
        }}
      />,
    );
    await user.click(combobox());
    await user.keyboard('zz');
    order.length = 0;
    await user.keyboard('{Enter}');
    expect(order).toEqual(['part key']);
    expect(onInvalidInput).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('runs your clearButton and expandButton onClick first; preventDefault() skips the clear and the toggle', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <TimePicker
        aria-label="Time"
        defaultValue="09:30"
        clearable
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
        {...BOUNDS}
        slotProps={{
          clearButton: { onClick: (event) => event.preventDefault() },
          expandButton: { onClick: (event) => event.preventDefault() },
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear time' }));
    await user.click(expandButton());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(combobox()).toHaveValue('9:30 AM');
  });

  it('keeps the locked attributes of the input, the options, the list and the surface', async () => {
    render(
      <>
        <span id="extra">Extra</span>
        <TimePicker
          id="own"
          aria-label="Time"
          defaultOpen
          defaultValue="09:30"
          name="time"
          {...BOUNDS}
          slotProps={{
            input: {
              id: 'mine',
              type: 'search',
              value: 'noon',
              name: 'mine',
              form: 'elsewhere',
              hidden: true,
              'aria-hidden': true,
              'aria-controls': 'nowhere',
              'aria-describedby': 'extra',
            },
            option: {
              id: 'mine-option',
              role: 'menuitem',
              hidden: true,
              'aria-selected': true,
              'data-active': 'yes',
            },
            listbox: { id: 'mine-list', role: 'menu', hidden: true, 'aria-label': 'Other' },
            surface: {
              id: 'mine-surface',
              role: 'dialog',
              hidden: true,
              'data-state': 'closed',
              'data-side': 'top',
              style: { left: 40, zIndex: 3 },
            },
          }}
        />
      </>,
    );
    await act(async () => {});
    const input = combobox('Time');
    expect(input).toHaveAttribute('id', 'own');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('9:30 AM');
    expect(input).not.toHaveAttribute('name');
    expect(input).not.toHaveAttribute('form');
    expect(input).not.toHaveAttribute('hidden');
    expect(input).not.toHaveAttribute('aria-hidden');
    expect(input).toHaveAttribute('aria-describedby', 'extra');
    const list = screen.getByRole('listbox', { name: 'Time' });
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(list.id).toMatch(/^timepicker-listbox-/);
    expect(list).not.toHaveAttribute('hidden');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.id).toMatch(/^timepicker-listbox-.*-opt-\d+$/);
      expect(option).not.toHaveAttribute('hidden');
    }
    expect(options.filter((option) => option.getAttribute('aria-selected') === 'true')).toEqual([
      screen.getByRole('option', { name: '9:30 AM' }),
    ]);
    expect(options.filter((option) => option.hasAttribute('data-active'))).toEqual([
      screen.getByRole('option', { name: '9:30 AM' }),
    ]);
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: '9:30 AM' }).id,
    );
    const surface = part(timePickerClassNames.surface)!;
    expect(surface).not.toHaveAttribute('id');
    expect(surface).not.toHaveAttribute('role');
    expect(surface).not.toHaveAttribute('hidden');
    expect(surface).toHaveAttribute('data-state', 'open');
    expect(surface).toHaveAttribute('data-side', 'bottom');
    expect(surface).toHaveStyle({ left: '0px', zIndex: '3' });
  });

  it('submits only the hidden input: the input part takes no name or form', () => {
    render(
      <form aria-label="Booking">
        <TimePicker
          aria-label="Time"
          name="time"
          defaultValue="09:30"
          {...BOUNDS}
          slotProps={{ input: { name: 'typed' } }}
        />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Booking' }) as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['time', '09:30']]);
  });

  it('keeps the text its own: a part’s defaultValue never reaches the controlled input', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <TimePicker
          aria-label="Time"
          defaultValue="09:30"
          {...BOUNDS}
          slotProps={{ input: { defaultValue: 'noon' } }}
        />,
      );
      expect(combobox('Time')).toHaveValue('9:30 AM');
      // No warning of an input both controlled and uncontrolled: the part's default is unset.
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('locks the surface’s presence attributes: a part sets no data-presence, data-state or inert', async () => {
    render(
      <TimePicker
        aria-label="Time"
        defaultOpen
        {...BOUNDS}
        slotProps={{ surface: { 'data-presence': 'exiting', 'data-state': 'closed', inert: true } }}
      />,
    );
    await act(async () => {});
    const surface = part(timePickerClassNames.surface)!;
    expect(surface).toHaveAttribute('data-state', 'open');
    expect(surface).toHaveAttribute('data-presence', 'entered');
    expect(surface).not.toHaveAttribute('inert');
  });

  it('keeps the locked attributes of the error message', async () => {
    render(
      <TimePicker
        aria-label="Time"
        {...BOUNDS}
        slotProps={{ errorMessage: { id: 'mine', role: 'status' } }}
      />,
    );
    await typeRejected(true);
    const message = screen.getByRole('alert');
    expect(message.id).not.toBe('mine');
    expect(combobox('Time')).toHaveAttribute('aria-describedby', message.id);
  });

  it('ignores the parts the TimePicker does not render', () => {
    const refs = [
      React.createRef<HTMLButtonElement>(),
      React.createRef<HTMLParagraphElement>(),
      React.createRef<HTMLDivElement>(),
      React.createRef<HTMLDivElement>(),
    ] as const;
    render(
      <TimePicker
        aria-label="Time"
        {...BOUNDS}
        slotProps={{
          clearButton: { ref: refs[0], className: 'my-part' },
          errorMessage: { ref: refs[1], className: 'my-part' },
          surface: { ref: refs[2], className: 'my-part' },
          emptyMessage: { ref: refs[3], className: 'my-part' },
        }}
      />,
    );
    expect(combobox('Time')).toBeInTheDocument();
    for (const ref of refs) expect(ref.current).toBeNull();
    expect(document.querySelector('.my-part')).toBeNull();
  });

  it('keeps the attributes its wiring renders only while set: closed, a part sets none of them', () => {
    render(
      <TimePicker
        aria-label="Time"
        defaultValue="09:30"
        {...BOUNDS}
        slotProps={{
          input: { 'aria-activedescendant': 'bogus' },
          listbox: { 'aria-activedescendant': 'bogus', 'aria-multiselectable': true },
          option: {
            'aria-posinset': 9,
            'aria-setsize': 9,
            'aria-disabled': true,
            'data-disabled': 'yes',
            'data-selected': 'yes',
          },
        }}
      />,
    );
    const input = combobox('Time');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    const list = screen.getByRole('listbox', { hidden: true });
    expect(list).toHaveAttribute('hidden');
    expect(list).not.toHaveAttribute('aria-activedescendant');
    expect(list).not.toHaveAttribute('aria-multiselectable');
    const options = within(list).getAllByRole('option', { hidden: true });
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option).not.toHaveAttribute('aria-posinset');
      expect(option).not.toHaveAttribute('aria-setsize');
      expect(option).not.toHaveAttribute('aria-disabled');
      expect(option).not.toHaveAttribute('data-disabled');
    }
    // Only the selected option is marked selected.
    expect(options.filter((option) => option.hasAttribute('data-selected'))).toEqual([
      within(list).getByRole('option', { name: '9:30 AM', hidden: true }),
    ]);
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <TimePicker
        aria-label="Time"
        defaultOpen
        defaultValue="09:30"
        clearable
        {...BOUNDS}
        slotProps={{
          input: { className: 'my-input', title: 'Pick a time' },
          clearButton: { className: 'my-clear' },
          expandButton: { className: 'my-expand' },
          listbox: { className: 'my-list' },
          option: { className: 'my-option' },
          checkIcon: { className: 'my-check' },
          surface: { className: 'my-surface' },
        }}
      />,
    );
    await act(async () => {});
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof TimePickerSlotProps>().toEqualTypeOf<
      | 'root'
      | 'input'
      | 'clearButton'
      | 'expandButton'
      | 'errorMessage'
      | 'listbox'
      | 'option'
      | 'checkIcon'
      | 'surface'
      | 'emptyMessage'
    >();
    expectTypeOf<NonNullable<TimePickerSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<TimePickerSlotProps['input']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<NonNullable<TimePickerSlotProps['errorMessage']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLParagraphElement> | undefined
    >();
    expectTypeOf<NonNullable<TimePickerSlotProps['option']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<NonNullable<TimePickerSlotProps['checkIcon']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the TimePicker draws its content
    void (<TimePicker slotProps={{ option: { children: 'Noon' } }} />);
    // @ts-expect-error -- a part takes no children: the TimePicker draws its content
    void (<TimePicker slotProps={{ root: { children: 'x' } }} />);
  });

  describe('the root part', () => {
    const root = () => part(timePickerClassNames.root)!;

    it("puts your className, style, data-* and attributes on the root <div>, after the TimePicker's className and style", () => {
      render(
        <TimePicker
          aria-label="Time"
          className="mine"
          style={{ color: 'red', width: 10 }}
          slotProps={{
            root: { className: 'my-root', style: { width: 20 }, 'data-part': 'root', title: 'R' },
          }}
        />,
      );
      expect(root().classList[0]).toBe(timePickerClassNames.root);
      expect(root().className).toMatch(/ mine my-root$/);
      expect(root()).toHaveStyle({ color: 'rgb(255, 0, 0)', width: '20px' });
      expect(root()).toHaveAttribute('data-part', 'root');
      expect(root()).toHaveAttribute('title', 'R');
      expect(combobox()).not.toHaveAttribute('data-part');
      expect(combobox()).not.toHaveAttribute('title');
    });

    it('lets your class replace a conflicting class of the root', () => {
      render(<TimePicker aria-label="Time" slotProps={{ root: { className: 'flex-row' } }} />);
      expect(root()).toHaveClass('flex-row');
      expect(root()).not.toHaveClass('wave:flex-col');
    });

    it("keeps the props you give the TimePicker over the part's", () => {
      render(
        <TimePicker
          aria-label="Time"
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
        <TimePicker
          aria-label="Time"
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
      // The TimePicker's own hidden state stays its own.
      rerender(
        <TimePicker
          aria-label="Time"
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

    it("runs your root handlers before the TimePicker's own; preventDefault() in yours skips its own", () => {
      const order: string[] = [];
      const { rerender } = render(
        <TimePicker
          aria-label="Time"
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: () => order.push('part') } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
      rerender(
        <TimePicker
          aria-label="Time"
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: (event) => event.preventDefault() } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
    });

    it("opens on a click in the input whatever your root onClick does: the opening is the input's own, before the click reaches the root", async () => {
      const user = userEvent.setup();
      render(
        <TimePicker
          aria-label="Time"
          {...BOUNDS}
          slotProps={{ root: { onClick: (event) => event.preventDefault() } }}
        />,
      );
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    });

    it('calls your root onClick in every state, as the TimePicker calls its own: the root passes no click to the input', () => {
      const onClick = vi.fn();
      const own = vi.fn();
      const { rerender } = render(
        <TimePicker aria-label="Time" onClick={own} slotProps={{ root: { onClick } }} />,
      );
      fireEvent.click(root());
      rerender(
        <TimePicker aria-label="Time" disabled onClick={own} slotProps={{ root: { onClick } }} />,
      );
      fireEvent.click(root());
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(own).toHaveBeenCalledTimes(2);
    });

    it('keeps a press inside the root from dismissing the open list, also with an inline part ref', async () => {
      const user = userEvent.setup();
      const nodes: (HTMLDivElement | null)[] = [];
      const ui = (pass: number) => (
        <>
          <TimePicker
            aria-label="Time"
            {...BOUNDS}
            data-pass={pass}
            slotProps={{
              root: {
                ref: (node) => {
                  nodes.push(node);
                },
              },
            }}
          />
          <p>Outside</p>
        </>
      );
      const { rerender } = render(ui(0));
      await user.click(combobox());
      rerender(ui(1));
      rerender(ui(2));
      expect(nodes.at(-1)).toBe(root());
      // A press on the root itself (no focus move): inside the popup's tree.
      fireEvent.pointerDown(root());
      fireEvent.click(root());
      await act(async () => {});
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      fireEvent.pointerDown(screen.getByText('Outside'));
      fireEvent.click(screen.getByText('Outside'));
      await act(async () => {});
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('has no accessibility violations with the root customised', async () => {
      render(
        <TimePicker
          aria-label="Time"
          defaultOpen
          {...BOUNDS}
          slotProps={{ root: { className: 'my-root', title: 'Pick a time' } }}
        />,
      );
      await act(async () => {});
      await expectNoA11yViolations();
    });
  });
});

// 1.0 (Phase 14, R5): `ref` reaches the <input role="combobox">, the focusable control; the root
// <div> is `slotProps.root.ref`, and `controlRef` is gone.
describe('TimePicker — ref reaches the control', () => {
  it('focuses the input through ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<TimePicker ref={ref} aria-label="Time" />);
    act(() => ref.current?.focus());
    expect(combobox('Time')).toHaveFocus();
  });

  it('gives ref the input beside slotProps.input.ref, and slotProps.root.ref the root', () => {
    const ref = React.createRef<HTMLInputElement>();
    const root = React.createRef<HTMLDivElement>();
    const input = React.createRef<HTMLInputElement>();
    render(
      <TimePicker
        ref={ref}
        aria-label="Time"
        slotProps={{ root: { ref: root }, input: { ref: input } }}
      />,
    );
    expect(ref.current).toBe(combobox('Time'));
    expect(input.current).toBe(combobox('Time'));
    expect(root.current).toHaveClass(timePickerClassNames.root);
    expect(root.current).toContainElement(combobox('Time'));
  });

  it('keeps the invalid focus and the form reset working with an inline ref that changes on every render', async () => {
    const user = userEvent.setup();
    const nodes: (HTMLInputElement | null)[] = [];
    const ui = (pass: number) => (
      <form aria-label="Order">
        <TimePicker
          ref={(node) => {
            nodes.push(node);
          }}
          name="time"
          required
          minTime="09:00"
          maxTime="10:00"
          aria-label="Time"
          data-pass={pass}
        />
      </form>
    );
    const { rerender } = render(ui(0));
    rerender(ui(1));
    rerender(ui(2));
    const input = combobox('Time');
    expect(nodes.at(-1)).toBe(input);
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    // The hidden input's invalid event focuses the combobox through the TimePicker's own ref.
    act(() => {
      form.reportValidity();
    });
    expect(input).toHaveFocus();
    await user.click(input);
    await user.click(screen.getByRole('option', { name: '9:30 AM' }));
    rerender(ui(3));
    expect(input).toHaveValue('9:30 AM');
    expect(form.checkValidity()).toBe(true);
    act(() => form.reset());
    expect(input).toHaveValue('');
    expect(form.checkValidity()).toBe(false);
    expect(nodes.at(-1)).toBe(input);
  });

  it('keeps the popup placed against the field with an inline ref that changes on every render', async () => {
    const html = document.documentElement;
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
    try {
      const user = userEvent.setup();
      const nodes: (HTMLInputElement | null)[] = [];
      const ui = (pass: number) => (
        <TimePicker
          aria-label="Time"
          minTime="09:00"
          maxTime="10:00"
          ref={(node) => {
            nodes.push(node);
          }}
          data-pass={pass}
        />
      );
      const { rerender } = render(ui(0));
      // The popup is placed against the row around the input and its buttons.
      mockRect(combobox('Time').parentElement!, { x: 100, y: 100, width: 200, height: 32 });
      rerender(ui(1));
      await user.click(combobox('Time'));
      rerender(ui(2));
      rerender(ui(3));
      const surface = () =>
        document.querySelector<HTMLElement>(`.${timePickerClassNames.surface}`)!;
      await waitFor(() =>
        expect(surface().style.getPropertyValue('--wave-popup-reference-width')).toBe('200px'),
      );
      expect(surface()).toHaveAttribute('data-side', 'bottom');
      expect(nodes.at(-1)).toBe(combobox('Time'));
    } finally {
      Reflect.deleteProperty(html, 'clientWidth');
      Reflect.deleteProperty(html, 'clientHeight');
    }
  });

  it('attaches a callback ref once, keeps it across renders and detaches it on unmount', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(<TimePicker ref={ref} aria-label="Time" />);
    const input = combobox('Time');
    rerender(<TimePicker ref={ref} aria-label="Time" defaultValue="09:00" disabled />);
    expect(ref.mock.calls).toEqual([[input]]);
    unmount();
    expect(ref.mock.calls).toEqual([[input], [null]]);
  });

  it('in StrictMode, attaches only the control: React detaches and attaches it again on mount, once', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <React.StrictMode>
        <TimePicker ref={ref} aria-label="Time" />
      </React.StrictMode>,
    );
    const input = combobox('Time');
    rerender(
      <React.StrictMode>
        <TimePicker ref={ref} aria-label="Time" readOnly />
      </React.StrictMode>,
    );
    expect(ref.mock.calls).toEqual([[input], [null], [input]]);
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it('reaches the control the Field label points at', () => {
    const ref = React.createRef<HTMLInputElement>();
    renderWithFieldContext(<TimePicker ref={ref} />);
    const fieldLabel = screen.getByText(FIELD_TEST_TEXT.label).closest('label') as HTMLLabelElement;
    expect(ref.current).toBe(combobox(FIELD_TEST_TEXT.label));
    expect(ref.current?.id).toBe(fieldLabel.htmlFor);
  });

  it('declares ref (for the input), and no controlRef', () => {
    expectTypeOf<TimePickerProps['ref']>().toEqualTypeOf<React.Ref<HTMLInputElement> | undefined>();
    expectTypeOf<TimePickerProps>().not.toHaveProperty('controlRef');
    const divRef = React.createRef<HTMLDivElement>();
    // @ts-expect-error -- in 1.0 `ref` reaches the input; the root <div> is slotProps.root.ref
    void (<TimePicker aria-label="Time" ref={divRef} />);
  });

  it('has no controlRef: TypeScript rejects it, and untyped code puts an unknown prop on the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <TimePicker
          aria-label="Time"
          // @ts-expect-error -- `controlRef` is removed in 1.0: `ref` reaches the input
          controlRef={controlRef}
        />,
      );
      expect(controlRef.current).toBeNull();
      expect(document.querySelector(`.${timePickerClassNames.root}`)).toHaveAttribute(
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
