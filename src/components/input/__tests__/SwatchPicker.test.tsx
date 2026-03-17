import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwatchPicker } from '../SwatchPicker';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

const defaultItems = [
  { value: 'red', color: '#d13438', label: 'Red' },
  { value: 'blue', color: '#0f6cbd', label: 'Blue' },
  { value: 'green', color: '#107c10', label: 'Green' },
];

describe('SwatchPicker', () => {
  testForwardRef(SwatchPicker, 'div', { items: defaultItems });
  testRestSpread(SwatchPicker, { items: defaultItems });
  testClassName(SwatchPicker, { items: defaultItems });

  it('renders without crashing', () => {
    render(<SwatchPicker items={defaultItems} data-testid="swatch" />);
    expect(screen.getByTestId('swatch')).toBeInTheDocument();
  });

  it('renders all swatch items', () => {
    render(<SwatchPicker items={defaultItems} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('has radiogroup role', () => {
    render(<SwatchPicker items={defaultItems} data-testid="swatch" />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('selects an item on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwatchPicker items={defaultItems} onChange={onChange} />);
    await user.click(screen.getByLabelText('Blue'));
    expect(onChange).toHaveBeenCalledWith('blue');
  });

  it('shows selected state via aria-checked', async () => {
    const user = userEvent.setup();
    render(<SwatchPicker items={defaultItems} defaultValue="" />);
    const blueBtn = screen.getByLabelText('Blue');
    expect(blueBtn).toHaveAttribute('aria-checked', 'false');
    await user.click(blueBtn);
    expect(blueBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('controlled: respects value prop', () => {
    render(<SwatchPicker items={defaultItems} value="green" />);
    expect(screen.getByLabelText('Green')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Red')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders with different shapes', () => {
    const { rerender } = render(
      <SwatchPicker items={defaultItems} shape="square" data-testid="swatch" />,
    );
    expect(screen.getByTestId('swatch')).toBeInTheDocument();
    rerender(<SwatchPicker items={defaultItems} shape="rounded" data-testid="swatch" />);
    expect(screen.getByTestId('swatch')).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(
      <SwatchPicker items={defaultItems} size="small" data-testid="swatch" />,
    );
    expect(screen.getByTestId('swatch')).toBeInTheDocument();
    rerender(<SwatchPicker items={defaultItems} size="large" data-testid="swatch" />);
    expect(screen.getByTestId('swatch')).toBeInTheDocument();
  });
});
