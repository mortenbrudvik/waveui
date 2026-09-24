import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider, type SliderProps } from '../Slider';
import { forcedColors } from '../../../lib/styles';
import { testSystemProps, testFocusEvents } from '../../../test-utils';

describe('Slider', () => {
  testSystemProps(Slider, {
    expectedTag: 'input',
    displayName: 'Slider',
    defaultProps: { 'aria-label': 'Volume' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'label prop', props: { 'aria-label': undefined, label: 'Volume' } },
    ],
  });

  testFocusEvents(Slider, { 'aria-label': 'Volume' }, 'input');

  it('declares ref in SliderProps (C-REF)', () => {
    expectTypeOf<SliderProps['ref']>().toEqualTypeOf<React.Ref<HTMLInputElement> | undefined>();
  });

  it('renders a range input', () => {
    render(<Slider aria-label="Volume" />);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('type', 'range');
  });

  it('sets min/max/step attributes', () => {
    render(<Slider aria-label="Volume" min={0} max={100} step={5} />);
    const el = screen.getByRole('slider', { name: 'Volume' });
    expect(el).toHaveAttribute('min', '0');
    expect(el).toHaveAttribute('max', '100');
    expect(el).toHaveAttribute('step', '5');
  });

  it('uses label as the accessible name', () => {
    render(<Slider label="Volume" />);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-label', 'Volume');
  });

  it('lets aria-label win over label', () => {
    render(<Slider label="Volume" aria-label="Master volume" />);
    expect(screen.getByRole('slider', { name: 'Master volume' })).toBeInTheDocument();
  });

  it('sets defaultValue', () => {
    render(<Slider aria-label="Volume" defaultValue={50} />);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('50');
  });

  it('applies the disabled state', () => {
    render(<Slider aria-label="Volume" disabled />);
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeDisabled();
  });

  describe('onValueChange (input-basic#29)', () => {
    it('calls onValueChange with a number next to the native onChange', () => {
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <Slider
          aria-label="Volume"
          defaultValue={10}
          onChange={onChange}
          onValueChange={onValueChange}
        />,
      );
      fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), {
        target: { value: '30' },
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect((onChange.mock.calls[0][0] as React.ChangeEvent<HTMLInputElement>).target.value).toBe(
        '30',
      );
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(30);
    });

    it('works as a controlled slider with onValueChange only', () => {
      function Example() {
        const [value, setValue] = React.useState(20);
        return (
          <>
            <Slider aria-label="Volume" value={value} onValueChange={setValue} />
            <output>{value}</output>
          </>
        );
      }
      render(<Example />);
      fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), {
        target: { value: '70' },
      });
      expect(screen.getByRole('status')).toHaveTextContent('70');
      expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('70');
    });

    it('fires onValueChange once per change in StrictMode', () => {
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Slider aria-label="Volume" onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), {
        target: { value: '42' },
      });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(42);
    });
  });

  describe('tokens (button-provider#3)', () => {
    it('draws the rail with the accessible stroke (3:1) and a token thumb ring', () => {
      render(<Slider aria-label="Volume" />);
      const slider = screen.getByRole('slider', { name: 'Volume' });
      expect(slider).toHaveClass(
        '[&::-webkit-slider-runnable-track]:bg-stroke-accessible',
        '[&::-moz-range-track]:bg-stroke-accessible',
        '[&::-webkit-slider-thumb]:border-background',
        '[&::-moz-range-thumb]:border-background',
        'focus-visible:outline-ring',
      );
      expect(slider.className).not.toMatch(/#[0-9a-f]{3,8}|border-white|bg-white/i);
    });

    it('keeps the rail, the thumb and the focus outline visible in forced colors (x-styling-4)', () => {
      // The rail and thumb are author backgrounds of pseudo-elements, which forced colors replace
      // with Canvas: without the recipe only a hollow thumb outline would remain.
      render(
        <>
          <Slider aria-label="Volume" />
          <Slider aria-label="Balance" disabled />
        </>,
      );
      for (const name of ['Volume', 'Balance']) {
        expect(screen.getByRole('slider', { name })).toHaveClass(
          ...forcedColors.rangeInput.split(' '),
        );
      }
    });

    it('centres the thumb on the rail with a margin derived from both sizes, not a px offset (x-styling-3)', () => {
      render(<Slider aria-label="Volume" />);
      const className = screen.getByRole('slider', { name: 'Volume' }).className;
      /** The spacing-scale number of a `<part>:<utility>-<n>` class. */
      function units(part: string, utility: string): number {
        const escaped = `${part}:${utility}`.replace(/[[\]&:]/g, (c) => `\\${c}`);
        const match = className.match(
          new RegExp(`(?:^|\\s)${escaped}-(\\d+(?:\\.\\d+)?)(?=\\s|$)`),
        );
        if (!match) throw new Error(`no ${part}:${utility}-<n> class in "${className}"`);
        return Number(match[1]);
      }
      const thumb = '[&::-webkit-slider-thumb]';
      const track = '[&::-webkit-slider-runnable-track]';
      // WebKit/Blink align the thumb's top with the track's top: pull it up by half the difference.
      expect(units(thumb, '-mt')).toBe((units(thumb, 'h') - units(track, 'h')) / 2);
      expect(units(thumb, 'w')).toBe(units(thumb, 'h'));
      expect(className).not.toMatch(/slider-thumb\]:-?mt-\[/);
    });
  });
});
