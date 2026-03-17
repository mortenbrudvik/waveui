import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from '../ColorPicker';
import { testSystemProps } from '../../../test-utils';

describe('ColorPicker', () => {
  testSystemProps(ColorPicker, {
    expectedTag: 'div',
    displayName: 'ColorPicker',
    defaultProps: { 'aria-label': 'Color picker' },
  });

  it('renders without crashing', () => {
    render(<ColorPicker data-testid="picker" />);
    expect(screen.getByTestId('picker')).toBeInTheDocument();
  });

  it('renders hex input', () => {
    render(<ColorPicker />);
    expect(screen.getByLabelText('Hex color value')).toBeInTheDocument();
  });

  it('renders default preset swatches', () => {
    render(<ColorPicker />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
  });

  it('renders custom presets', () => {
    render(<ColorPicker presets={['#ff0000', '#00ff00', '#0000ff']} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('selects a preset on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker presets={['#ff0000', '#00ff00']} onChange={onChange} />);
    await user.click(screen.getByLabelText('#00ff00'));
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('updates hex input when preset is clicked', async () => {
    const user = userEvent.setup();
    render(<ColorPicker presets={['#ff0000', '#00ff00']} />);
    await user.click(screen.getByLabelText('#ff0000'));
    expect(screen.getByLabelText('Hex color value')).toHaveValue('#ff0000');
  });

  it('accepts manual hex input', async () => {
    const user = userEvent.setup();
    render(<ColorPicker defaultValue="#000000" />);
    const input = screen.getByLabelText('Hex color value');
    await user.clear(input);
    await user.type(input, 'abcdef');
    expect(input).toHaveValue('#abcdef');
  });

  it('reverts invalid hex on blur', async () => {
    const user = userEvent.setup();
    render(<ColorPicker defaultValue="#0f6cbd" />);
    const input = screen.getByLabelText('Hex color value');
    await user.clear(input);
    await user.type(input, '#zzz');
    await user.tab();
    expect(input).toHaveValue('#0f6cbd');
  });

  it('renders opacity slider when showOpacity is true', () => {
    render(<ColorPicker showOpacity />);
    expect(screen.getByLabelText('Opacity')).toBeInTheDocument();
  });

  it('does not render opacity slider by default', () => {
    render(<ColorPicker />);
    expect(screen.queryByLabelText('Opacity')).not.toBeInTheDocument();
  });

  it('controlled: respects value prop', () => {
    render(<ColorPicker value="#d13438" />);
    expect(screen.getByLabelText('Hex color value')).toHaveValue('#d13438');
  });

  it('renders with empty presets array', () => {
    render(<ColorPicker presets={[]} data-testid="picker" />);
    expect(screen.getByTestId('picker')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
