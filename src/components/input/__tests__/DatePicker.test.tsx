import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '../DatePicker';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('DatePicker', () => {
  testForwardRef(DatePicker, 'div');
  testRestSpread(DatePicker);
  testClassName(DatePicker);

  it('renders without crashing', () => {
    render(<DatePicker data-testid="dp" />);
    expect(screen.getByTestId('dp')).toBeInTheDocument();
  });

  it('renders placeholder', () => {
    render(<DatePicker placeholder="Pick a date" />);
    expect(screen.getByPlaceholderText('Pick a date')).toBeInTheDocument();
  });

  it('opens calendar on calendar button click', async () => {
    const user = userEvent.setup();
    render(<DatePicker />);
    await user.click(screen.getByLabelText('Open calendar'));
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('selects a date on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker onChange={onChange} open />);
    // Find and click a day button (the 15th of the currently viewed month)
    const dayButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '15');
    await user.click(dayButtons[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const selectedDate = onChange.mock.calls[0][0] as Date;
    expect(selectedDate.getDate()).toBe(15);
  });

  it('navigates to previous month', async () => {
    const user = userEvent.setup();
    render(<DatePicker open defaultValue={new Date(2025, 5, 15)} />);
    await user.click(screen.getByLabelText('Previous month'));
    expect(screen.getByText('May 2025')).toBeInTheDocument();
  });

  it('navigates to next month', async () => {
    const user = userEvent.setup();
    render(<DatePicker open defaultValue={new Date(2025, 5, 15)} />);
    await user.click(screen.getByLabelText('Next month'));
    expect(screen.getByText('July 2025')).toBeInTheDocument();
  });

  it('formats date using formatDate prop', () => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    render(<DatePicker defaultValue={new Date(2025, 0, 15)} formatDate={formatDate} />);
    const input = screen.getByPlaceholderText('Select a date');
    expect(input).toHaveValue('2025-01-15');
  });

  it('disables dates based on disabledDates prop', async () => {
    const user = userEvent.setup();
    const disabledDates = (d: Date) => d.getDate() === 15;
    const onChange = vi.fn();
    render(
      <DatePicker
        open
        defaultValue={new Date(2025, 5, 1)}
        disabledDates={disabledDates}
        onChange={onChange}
      />,
    );
    const dayButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '15');
    // The 15th should be disabled
    const day15 = dayButtons[0];
    expect(day15).toBeDisabled();
    await user.click(day15);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports controlled value', () => {
    const date = new Date(2025, 3, 20);
    render(<DatePicker value={date} />);
    const input = screen.getByPlaceholderText('Select a date');
    expect(input).toHaveValue(date.toLocaleDateString());
  });

  it('supports disabled state', () => {
    render(<DatePicker disabled />);
    expect(screen.getByPlaceholderText('Select a date')).toBeDisabled();
    expect(screen.getByLabelText('Open calendar')).toBeDisabled();
  });

  it('shows clear button when clearable and value is set', () => {
    render(<DatePicker defaultValue={new Date(2025, 0, 1)} clearable />);
    expect(screen.getByLabelText('Clear date')).toBeInTheDocument();
  });

  it('clears value on clear button click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker defaultValue={new Date(2025, 0, 1)} clearable onChange={onChange} />);
    await user.click(screen.getByLabelText('Clear date'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders day-of-week headers', async () => {
    const user = userEvent.setup();
    render(<DatePicker />);
    await user.click(screen.getByLabelText('Open calendar'));
    expect(screen.getByText('Su')).toBeInTheDocument();
    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('Tu')).toBeInTheDocument();
    expect(screen.getByText('We')).toBeInTheDocument();
    expect(screen.getByText('Th')).toBeInTheDocument();
    expect(screen.getByText('Fr')).toBeInTheDocument();
    expect(screen.getByText('Sa')).toBeInTheDocument();
  });
});
