import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slider } from '../Slider';
import { testSystemProps, testFocusEvents } from '../../../test-utils';

describe('Slider', () => {
  testSystemProps(Slider, {
    expectedTag: 'input',
    displayName: 'Slider',
    defaultProps: { 'aria-label': 'Volume' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  testFocusEvents(Slider, { 'aria-label': 'Volume' }, 'input');

  it('renders without crashing', () => {
    render(<Slider aria-label="Volume" />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('renders as type="range"', () => {
    render(<Slider data-testid="slider" />);
    expect(screen.getByTestId('slider')).toHaveAttribute('type', 'range');
  });

  it('sets min/max/step attributes', () => {
    render(<Slider min={0} max={100} step={5} data-testid="slider" />);
    const el = screen.getByTestId('slider');
    expect(el).toHaveAttribute('min', '0');
    expect(el).toHaveAttribute('max', '100');
    expect(el).toHaveAttribute('step', '5');
  });

  it('uses label as aria-label', () => {
    render(<Slider label="Volume" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Volume');
  });

  it('sets defaultValue', () => {
    render(<Slider defaultValue={50} data-testid="slider" />);
    expect(screen.getByTestId('slider')).toHaveValue('50');
  });

  it('applies disabled state', () => {
    render(<Slider disabled data-testid="slider" />);
    expect(screen.getByTestId('slider')).toBeDisabled();
  });
});
