import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Slider, type SliderProps } from '../Slider';
import { forcedColors } from '../../../lib/styles';
import { testSystemProps, testFocusEvents } from '../../../test-utils';

/** The fill variable of a slider: the share of the rail up to the thumb. */
function progress(slider: HTMLElement): string {
  return slider.style.getPropertyValue('--wave-slider-progress');
}

/**
 * Makes range inputs report a value snapped to `step`, as browsers do (jsdom only clamps it to
 * `min`/`max`). Returns the restore function.
 */
function simulateStepSnapping(): () => void {
  const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const spy = vi.spyOn(HTMLInputElement.prototype, 'value', 'get').mockImplementation(function (
    this: HTMLInputElement,
  ) {
    const raw = String(native?.get?.call(this));
    if (this.type !== 'range') return raw;
    const step = Number(this.step) || 1;
    const min = Number(this.min) || 0;
    return String(min + Math.round((Number(raw) - min) / step) * step);
  });
  return () => spy.mockRestore();
}

/** A WebKit rail gradient class: the filled color up to the thumb, the rest after it. */
function gradient(direction: string, filled: string, rest: string): string {
  return `bg-[linear-gradient(${direction},${filled}_var(--wave-slider-progress),${rest}_var(--wave-slider-progress))]`;
}

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

  describe('progress fill', () => {
    it.each([
      { props: { value: 0 }, expected: '0%' },
      { props: { value: 25 }, expected: '25%' },
      { props: { value: 100 }, expected: '100%' },
      { props: { value: 15, min: 10, max: 20 }, expected: '50%' },
      { props: { value: -5, min: -10, max: 10 }, expected: '25%' },
      { props: { value: 10, min: 10, max: 10 }, expected: '0%' },
      { props: { value: 15, min: 20, max: 10 }, expected: '0%' },
    ] satisfies Array<{ props: Partial<SliderProps>; expected: string }>)(
      'sets --wave-slider-progress to $expected for $props',
      ({ props, expected }) => {
        render(<Slider aria-label="Volume" onValueChange={() => {}} {...props} />);
        expect(progress(screen.getByRole('slider', { name: 'Volume' }))).toBe(expected);
      },
    );

    it('uses defaultValue, else the native midpoint, while uncontrolled', () => {
      render(
        <>
          <Slider aria-label="Volume" defaultValue={40} />
          <Slider aria-label="Balance" />
          <Slider aria-label="Treble" min={0} max={10} />
        </>,
      );
      expect(progress(screen.getByRole('slider', { name: 'Volume' }))).toBe('40%');
      expect(progress(screen.getByRole('slider', { name: 'Balance' }))).toBe('50%');
      expect(progress(screen.getByRole('slider', { name: 'Treble' }))).toBe('50%');
    });

    it('a controlled value off the step grid ends with the fill of the snapped value', () => {
      const restore = simulateStepSnapping();
      try {
        render(<Slider aria-label="Volume" value={33} step={10} onValueChange={() => {}} />);
        const slider = screen.getByRole('slider', { name: 'Volume' });
        expect(slider).toHaveValue('30');
        expect(progress(slider)).toBe('30%');
      } finally {
        restore();
      }
    });

    it('follows the controlled value', () => {
      const { rerender } = render(
        <Slider aria-label="Volume" value={20} onValueChange={() => {}} />,
      );
      rerender(<Slider aria-label="Volume" value={70} onValueChange={() => {}} />);
      expect(progress(screen.getByRole('slider', { name: 'Volume' }))).toBe('70%');
    });

    it('keeps the fill at the controlled value when the parent rejects a change', () => {
      render(<Slider aria-label="Volume" value={20} onValueChange={() => {}} />);
      const slider = screen.getByRole('slider', { name: 'Volume' });
      fireEvent.change(slider, { target: { value: '70' } });
      expect(slider).toHaveValue('20');
      expect(progress(slider)).toBe('20%');
    });

    it('an uncontrolled slider updates the fill on input and change events without any handler', () => {
      render(<Slider aria-label="Volume" defaultValue={10} />);
      const slider = screen.getByRole('slider', { name: 'Volume' });
      fireEvent.input(slider, { target: { value: '40' } });
      expect(progress(slider)).toBe('40%');
      fireEvent.change(slider, { target: { value: '60' } });
      expect(progress(slider)).toBe('60%');
    });

    it('an uncontrolled slider keeps the fill at the thumb when its props change', () => {
      const { rerender } = render(<Slider aria-label="Volume" defaultValue={10} />);
      const slider = screen.getByRole('slider', { name: 'Volume' });
      fireEvent.change(slider, { target: { value: '80' } });
      rerender(<Slider aria-label="Volume" defaultValue={20} />);
      expect(slider).toHaveValue('80');
      expect(progress(slider)).toBe('80%');
      rerender(<Slider aria-label="Volume" defaultValue={20} max={200} />);
      expect(progress(slider)).toBe('40%');
    });

    it('still calls the consumer onChange and onValueChange once per change (StrictMode)', () => {
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Slider
            aria-label="Volume"
            defaultValue={10}
            onChange={onChange}
            onValueChange={onValueChange}
          />
        </React.StrictMode>,
      );
      const slider = screen.getByRole('slider', { name: 'Volume' });
      fireEvent.change(slider, { target: { value: '30' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls).toEqual([[30]]);
      expect(progress(slider)).toBe('30%');
    });

    it('calls onValueChange and moves the fill even when the consumer onChange prevents the default', () => {
      const onValueChange = vi.fn();
      render(
        <Slider
          aria-label="Volume"
          defaultValue={10}
          onChange={(event) => event.preventDefault()}
          onValueChange={onValueChange}
        />,
      );
      const slider = screen.getByRole('slider', { name: 'Volume' });
      fireEvent.change(slider, { target: { value: '30' } });
      expect(onValueChange.mock.calls).toEqual([[30]]);
      expect(progress(slider)).toBe('30%');
    });

    it("still gives the consumer's ref the input (object and callback refs)", () => {
      const objectRef = React.createRef<HTMLInputElement>();
      const callbackRef = vi.fn();
      render(
        <>
          <Slider aria-label="Volume" ref={objectRef} />
          <Slider aria-label="Balance" ref={callbackRef} />
        </>,
      );
      expect(objectRef.current).toBe(screen.getByRole('slider', { name: 'Volume' }));
      expect(callbackRef).toHaveBeenLastCalledWith(screen.getByRole('slider', { name: 'Balance' }));
    });

    it('a form reset restores the fill with the value', async () => {
      render(
        <form aria-label="Settings">
          <Slider aria-label="Volume" defaultValue={10} />
        </form>,
      );
      const slider = screen.getByRole('slider', { name: 'Volume' });
      fireEvent.change(slider, { target: { value: '90' } });
      expect(progress(slider)).toBe('90%');
      act(() => (screen.getByRole('form', { name: 'Settings' }) as HTMLFormElement).reset());
      // The reset event fires before the form restores the value: the fill follows a microtask later.
      await act(async () => {});
      expect(slider).toHaveValue('10');
      expect(progress(slider)).toBe('10%');
    });

    it('a form reset restores the fill when `form` points at a form elsewhere', async () => {
      render(
        <>
          <form id="settings-form" aria-label="Settings" />
          <Slider aria-label="Volume" defaultValue={10} form="settings-form" />
        </>,
      );
      const slider = screen.getByRole('slider', { name: 'Volume' });
      fireEvent.change(slider, { target: { value: '90' } });
      act(() => (screen.getByRole('form', { name: 'Settings' }) as HTMLFormElement).reset());
      await act(async () => {});
      expect(slider).toHaveValue('10');
      expect(progress(slider)).toBe('10%');
    });

    it("keeps the consumer's style and sets the fill variable after it", () => {
      render(
        <Slider
          aria-label="Volume"
          defaultValue={30}
          style={
            {
              marginTop: 4,
              '--wave-slider-progress': '99%',
              '--custom': 'kept',
            } as React.CSSProperties
          }
        />,
      );
      const slider = screen.getByRole('slider', { name: 'Volume' });
      expect(slider.style.marginTop).toBe('4px');
      expect(slider.style.getPropertyValue('--custom')).toBe('kept');
      expect(progress(slider)).toBe('30%');
    });

    it('draws the fill with a token gradient on WebKit (mirrored for RTL) and the progress part on Firefox', () => {
      render(<Slider aria-label="Volume" />);
      const slider = screen.getByRole('slider', { name: 'Volume' });
      const track = '[&::-webkit-slider-runnable-track]';
      const tokens = ['var(--wave-primary)', 'var(--wave-stroke-accessible)'] as const;
      expect(slider).toHaveClass(
        `${track}:${gradient('to_right', ...tokens)}`,
        `wave-rtl:${track}:${gradient('to_left', ...tokens)}`,
        '[&::-moz-range-progress]:h-1',
        '[&::-moz-range-progress]:rounded-full',
        '[&::-moz-range-progress]:bg-primary',
        // Forced colors: the filled part in Highlight, the rest in CanvasText.
        `forced-colors:${track}:${gradient('to_right', 'Highlight', 'CanvasText')}`,
        `forced-colors:wave-rtl:${track}:${gradient('to_left', 'Highlight', 'CanvasText')}`,
        'forced-colors:[&::-moz-range-progress]:bg-[Highlight]',
        // A disabled rail stays GrayText (forcedColors.rangeInput), without the Highlight fill.
        `forced-colors:disabled:${track}:bg-none`,
        'forced-colors:disabled:[&::-moz-range-progress]:bg-[GrayText]',
      );
      // The rail color stays underneath the gradient.
      expect(slider).toHaveClass(`${track}:bg-stroke-accessible`);
      expect(slider.className).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    });

    it('renders the fill variable on the server, so it does not jump on hydration', () => {
      expect(renderToString(<Slider aria-label="Volume" defaultValue={25} />)).toContain(
        '--wave-slider-progress:25%',
      );
      expect(
        renderToString(<Slider aria-label="Volume" value={60} onValueChange={() => {}} />),
      ).toContain('--wave-slider-progress:60%');
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

    it('keeps the rail, the thumb and the focus outline visible in forced colors', () => {
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

    it('centres the thumb on the rail with a margin derived from both sizes, not a px offset', () => {
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
