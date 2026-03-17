import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker } from '../TagPicker';

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
];

describe('TagPicker', () => {
  it('renders without crashing', () => {
    render(<TagPicker options={options} data-testid="picker" />);
    expect(screen.getByTestId('picker')).toBeInTheDocument();
  });

  it('forwards ref to container div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<TagPicker ref={ref} options={options} data-testid="picker" />);
    expect(ref.current).toBe(screen.getByTestId('picker'));
  });

  it('merges custom className', () => {
    render(<TagPicker options={options} data-testid="picker" className="my-cls" />);
    expect(screen.getByTestId('picker').className).toContain('my-cls');
  });

  it('renders placeholder when no values selected', () => {
    render(<TagPicker options={options} placeholder="Pick fruits" />);
    expect(screen.getByPlaceholderText('Pick fruits')).toBeInTheDocument();
  });

  it('shows dropdown options on focus', async () => {
    const user = userEvent.setup();
    render(<TagPicker options={options} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('filters options based on input', async () => {
    const user = userEvent.setup();
    render(<TagPicker options={options} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'ban');
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('selects an option on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagPicker options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(screen.getByText('Apple'));
    expect(onChange).toHaveBeenCalledWith(['apple']);
  });

  it('renders selected values as tags', () => {
    render(<TagPicker options={options} value={['apple', 'banana']} />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('removes a tag when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagPicker options={options} value={['apple', 'banana']} onChange={onChange} />);
    const removeButtons = screen.getAllByLabelText(/Remove/);
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(['banana']);
  });

  it('removes last tag on Backspace when input is empty', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagPicker options={options} defaultValue={['apple', 'banana']} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['apple']);
  });

  it('navigates options with arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagPicker options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['apple']);
  });

  it('does not show already-selected options in the dropdown', async () => {
    const user = userEvent.setup();
    render(<TagPicker options={options} value={['apple']} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.queryByText('Apple')).toBeInTheDocument(); // visible as tag
    const listItems = screen.getAllByRole('option');
    const labels = listItems.map((li) => li.textContent);
    expect(labels).not.toContain('Apple');
  });

  it('applies disabled state', () => {
    render(<TagPicker options={options} disabled data-testid="picker" />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('has combobox aria attributes', async () => {
    const user = userEvent.setup();
    render(<TagPicker options={options} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls');
  });
});
