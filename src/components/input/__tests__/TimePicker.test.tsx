import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePicker } from '../TimePicker';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('TimePicker', () => {
  testForwardRef(TimePicker, 'div');
  testRestSpread(TimePicker);
  testClassName(TimePicker);

  it('renders without crashing', () => {
    render(<TimePicker data-testid="tp" />);
    expect(screen.getByTestId('tp')).toBeInTheDocument();
  });

  it('renders placeholder', () => {
    render(<TimePicker placeholder="Pick a time" />);
    expect(screen.getByPlaceholderText('Pick a time')).toBeInTheDocument();
  });

  it('shows dropdown on click', async () => {
    const user = userEvent.setup();
    render(<TimePicker data-testid="tp" />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects a time on option click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker onChange={onChange} step={60} />);
    await user.click(screen.getByRole('combobox'));
    // In 12h format, first option should be "12:00 AM"
    await user.click(screen.getByText('12:00 AM'));
    expect(onChange).toHaveBeenCalledWith('00:00');
  });

  it('displays 12h format by default', async () => {
    const user = userEvent.setup();
    render(<TimePicker step={60} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('12:00 AM')).toBeInTheDocument();
    expect(screen.getByText('1:00 PM')).toBeInTheDocument();
  });

  it('displays 24h format when specified', async () => {
    const user = userEvent.setup();
    render(<TimePicker format="24h" step={60} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
  });

  it('supports controlled value', () => {
    render(<TimePicker value="09:00" step={60} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('9:00 AM');
  });

  it('supports disabled state', () => {
    render(<TimePicker disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows clear button when clearable and value is set', () => {
    render(<TimePicker defaultValue="09:00" clearable />);
    expect(screen.getByLabelText('Clear time')).toBeInTheDocument();
  });

  it('clears value on clear button click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker defaultValue="09:00" clearable onChange={onChange} />);
    await user.click(screen.getByLabelText('Clear time'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('filters options based on input text', async () => {
    const user = userEvent.setup();
    render(<TimePicker step={60} />);
    const input = screen.getByRole('combobox');
    await user.clear(input);
    await user.type(input, '1:00 P');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('1:00 PM')).toBeInTheDocument();
  });
});
