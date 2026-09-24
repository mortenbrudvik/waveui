import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { TimePicker } from '../TimePicker';
import {
  axe,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { DismissLayerProvider, useDismiss, type DismissReason } from '../../../hooks/useDismiss';
import { useListboxOption } from '../../../hooks/useListbox';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TimePicker', () => {
  testSystemProps(TimePicker, {
    expectedTag: 'div',
    displayName: 'TimePicker',
    defaultProps: { 'aria-label': 'Time picker' },
    control: { role: 'combobox' },
    a11yVariants: [
      { name: 'with value and clear button', props: { defaultValue: '09:00', clearable: true } },
      { name: 'disabled', props: { disabled: true, defaultValue: '09:00' } },
    ],
  });

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
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable />);
      expect(screen.getByRole('button', { name: 'Clear time' })).toHaveClass('h-6', 'w-6', 'end-1');
      expect(combobox('Time')).toHaveClass('pe-8');
    });

    it('uses theme tokens and gates hover on the clear button (button-provider#3)', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" defaultValue="09:00" clearable step={60} />);
      const clear = screen.getByRole('button', { name: 'Clear time' });
      expect(clear).toHaveClass('not-disabled:not-aria-disabled:hover:bg-subtle-hover');
      await user.click(combobox('Time'));
      const listbox = screen.getByRole('listbox');
      for (const el of [clear, combobox('Time'), listbox, ...screen.getAllByRole('option')]) {
        expect(el.className).not.toMatch(RAW_COLOR_OR_ENABLED);
      }
      expect(combobox('Time')).toHaveClass('focus:outline-hidden');
    });

    it('renders on the server with the label and a hidden inline list', () => {
      const html = renderToString(<TimePicker aria-label="Time" defaultValue="09:00" step={60} />);
      expect(html).toContain('value="9:00 AM"');
      expect(html).toContain('role="listbox"');
      expect(html).toContain('hidden');
    });

    it('uses logical positions in RTL (feedback-navigation#34)', () => {
      renderWithProviders(<TimePicker aria-label="Time" defaultValue="09:00" clearable />, {
        dir: 'rtl',
      });
      const clear = screen.getByRole('button', { name: 'Clear time' });
      expect(clear).toHaveClass('end-1');
      expect(clear.className).not.toMatch(/\b(left|right)-/);
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
      expect(screen.getByRole('status')).toHaveTextContent('No matching times');
    });
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

    it('blur commits a valid exact typed time and reverts anything else', async () => {
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
      expect(combobox('Time')).toHaveValue('2:45 PM');
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
    it('falls back to 30 minutes and reports an invalid step in development', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<TimePicker aria-label="Time" step={0} />);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('[WaveUI] TimePicker: `step`'));
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(48);
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

    it('reports invalid bounds and shows "No times available" instead of a list', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" minTime="17:00" maxTime="nine" />);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('`minTime`/`maxTime`'));
      await user.click(combobox('Time'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(combobox('Time')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('status')).toHaveTextContent('No times available');
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
      expect(combobox('Time')).not.toHaveClass('pe-8');
    });

    it('shows the controlled value again when the parent rejects the clear', async () => {
      const user = userEvent.setup();
      render(<TimePicker aria-label="Time" value="09:00" clearable onValueChange={() => {}} />);
      await user.click(screen.getByRole('button', { name: 'Clear time' }));
      expect(combobox('Time')).toHaveValue('9:00 AM');
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
        'data-[selected]:font-semibold',
        'data-[selected]:bg-subtle-selected',
      );
      expect(active).toHaveAttribute('data-active');
      expect(active).toHaveAttribute('aria-selected', 'false');
      expect(active.querySelector('[data-wave-icon="check"]')).toBeNull();
      expect(active).toHaveClass(
        'data-[active]:bg-subtle-hover',
        'data-[active]:outline-2',
        'data-[active]:outline-ring',
        'data-[active]:-outline-offset-2',
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

    it('routes id, aria-describedby, focus handlers and controlRef to the input', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <>
          <p id="help">Opening hours only</p>
          <TimePicker
            id="start"
            aria-label="Start"
            aria-describedby="help"
            onFocus={onFocus}
            onBlur={onBlur}
            controlRef={controlRef}
            data-testid="tp"
          />
        </>,
      );
      const input = combobox('Start');
      expect(input).toHaveAttribute('id', 'start');
      expect(input).toHaveAccessibleDescription('Opening hours only');
      expect(controlRef.current).toBe(input);
      expect(screen.getByTestId('tp')).not.toHaveAttribute('id');
      await user.click(input);
      await user.tab();
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledTimes(1);
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

    it('keeps the deprecated onChange alias working and warns once', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      const { rerender } = render(
        <TimePicker
          aria-label="Time"
          step={60}
          onChange={onChange}
          onValueChange={onValueChange}
        />,
      );
      rerender(
        <TimePicker
          aria-label="Time"
          step={60}
          onChange={onChange}
          onValueChange={onValueChange}
        />,
      );
      await user.click(combobox('Time'));
      await user.click(screen.getByRole('option', { name: '3:00 AM' }));
      expect(onChange).toHaveBeenCalledWith('03:00');
      expect(onValueChange).toHaveBeenCalledWith('03:00');
      const deprecations = warn.mock.calls.filter(([message]) =>
        String(message).includes('TimePicker: `onChange` is deprecated'),
      );
      expect(deprecations).toHaveLength(1);
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
});
