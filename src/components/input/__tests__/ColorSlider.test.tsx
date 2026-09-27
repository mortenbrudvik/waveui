import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { ColorSlider, type ColorSliderProps } from '../ColorSlider';
import { colorSliderClassNames } from '../../../lib/classNames';
import type { HsvColor, Orientation } from '../../../lib/types';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { PickerHarness } from './colorPartHarness';

const BRAND: HsvColor = { h: 210, s: 0.92, v: 0.74 };
const slider = (name = 'Hue') => screen.getByRole('slider', { name });
const rootOf = (input: HTMLElement) =>
  input.closest<HTMLElement>(`.${colorSliderClassNames.root}`) as HTMLElement;
const railOf = (input: HTMLElement) =>
  rootOf(input).querySelector<HTMLElement>(`.${colorSliderClassNames.rail}`) as HTMLElement;
const thumbOf = (input: HTMLElement) =>
  rootOf(input).querySelector<HTMLElement>(`.${colorSliderClassNames.thumb}`) as HTMLElement;

describe('ColorSlider', () => {
  testSystemProps(ColorSlider, {
    expectedTag: 'div',
    displayName: 'ColorSlider',
    control: { role: 'slider' },
    a11yVariants: [
      { name: 'saturation', props: { channel: 'saturation' } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'disabled', props: { disabled: true } },
      { name: 'in a form', props: { name: 'accent', required: true } },
    ],
  });

  it('is a hue slider named "Hue", 0–360, whose value text names the color', () => {
    render(<ColorSlider defaultValue={BRAND} />);
    const input = slider();
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '360');
    expect(input).toHaveValue('210');
    expect(input).toHaveAttribute('aria-valuetext', '210°, blue');
  });

  it.each([
    ['saturation', 'Saturation', '92', '92%'],
    ['value', 'Brightness', '74', '74%'],
  ] as const)(
    'channel="%s" is named "%s", runs 0–100 and says the percentage',
    (channel, name, value, text) => {
      render(<ColorSlider channel={channel} defaultValue={BRAND} />);
      const input = slider(name);
      expect(input).toHaveAttribute('max', '100');
      expect(input).toHaveValue(value);
      expect(input).toHaveAttribute('aria-valuetext', text);
    },
  );

  it('always renders data-orientation and data-channel, and data-disabled while disabled', () => {
    const { rerender } = render(<ColorSlider />);
    const root = rootOf(slider());
    expect(root).toHaveAttribute('data-orientation', 'horizontal');
    expect(root).toHaveAttribute('data-channel', 'hue');
    expect(root).not.toHaveAttribute('data-disabled');
    rerender(<ColorSlider orientation="vertical" channel="saturation" disabled />);
    expect(root).toHaveAttribute('data-orientation', 'vertical');
    expect(root).toHaveAttribute('data-channel', 'saturation');
    expect(root).toHaveAttribute('data-disabled', '');
    expect(slider('Saturation')).toBeDisabled();
  });

  it('draws the rail from --wave-color-slider-gradient and places and styles the thumb', () => {
    render(<ColorSlider channel="saturation" defaultValue={{ h: 0, s: 0.5, v: 1 }} />);
    const input = slider('Saturation');
    const root = rootOf(input);
    expect(root.style.getPropertyValue('--wave-color-slider-gradient')).toBe(
      'linear-gradient(to right, #ffffff, #ff0000)',
    );
    expect(root.style.getPropertyValue('--wave-color-slider-position')).toBe('50%');
    expect(root.style.getPropertyValue('--wave-color-thumb')).toBe('#ff8080');
    expect(railOf(input)).toHaveClass(
      'bg-(image:--wave-color-slider-gradient)',
      'wave-rtl:-scale-x-100',
    );
    expect(thumbOf(input)).toHaveClass(
      'size-6',
      'group-has-[:focus-visible]/color-slider:outline-2',
      'group-has-[:focus-visible]/color-slider:outline-ring',
      'group-has-[:focus-visible]/color-slider:ring-background',
      'forced-colors:group-has-[:focus-visible]/color-slider:ring-[Canvas]',
    );
    expect(root).toHaveClass('group/color-slider');
  });

  it('shape="square" removes the corner radius of the rail', () => {
    render(<ColorSlider shape="square" />);
    expect(railOf(slider())).toHaveClass('rounded-none');
    expect(railOf(slider())).not.toHaveClass('rounded-full');
  });

  describe('keyboard', () => {
    it.each([
      ['{ArrowRight}', 51],
      ['{ArrowUp}', 51],
      ['{ArrowLeft}', 49],
      ['{ArrowDown}', 49],
      ['{Shift>}{ArrowRight}{/Shift}', 60],
      ['{PageUp}', 60],
      ['{PageDown}', 40],
      ['{Home}', 0],
      ['{End}', 100],
    ])('%s moves a saturation slider to %s %%', async (keys, percent) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorSlider
          channel="saturation"
          defaultValue={{ h: 0, s: 0.5, v: 1 }}
          onValueChange={onValueChange}
        />,
      );
      act(() => slider('Saturation').focus());
      await user.keyboard(keys);
      expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: percent / 100, v: 1 }]]);
    });

    it('moves the hue by degrees; End keeps the thumb at the end and reports h: 360', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<ColorSlider defaultValue={{ h: 350, s: 1, v: 1 }} onValueChange={onValueChange} />);
      act(() => slider().focus());
      await user.keyboard('{End}');
      expect(onValueChange.mock.calls).toEqual([[{ h: 360, s: 1, v: 1 }]]);
      expect(slider()).toHaveValue('360');
      expect(rootOf(slider()).style.getPropertyValue('--wave-color-slider-position')).toBe('100%');
    });

    it('a key at the end of the range changes and reports nothing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorSlider
          channel="value"
          defaultValue={{ h: 0, s: 1, v: 1 }}
          onValueChange={onValueChange}
        />,
      );
      act(() => slider('Brightness').focus());
      await user.keyboard('{End}{ArrowUp}');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('mirrors the horizontal arrows in right-to-left layouts', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <ColorSlider
          channel="saturation"
          defaultValue={{ h: 0, s: 0.5, v: 1 }}
          onValueChange={onValueChange}
        />,
        { dir: 'rtl' },
      );
      act(() => slider('Saturation').focus());
      await user.keyboard('{ArrowLeft}');
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 0.51, v: 1 });
    });

    it('a vertical slider keeps the bottom as the minimum in right-to-left layouts: Up and Right increase', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <ColorSlider
          orientation="vertical"
          channel="value"
          defaultValue={{ h: 0, s: 1, v: 0.5 }}
          onValueChange={onValueChange}
        />,
        { dir: 'rtl' },
      );
      const input = slider('Brightness');
      expect(input).toHaveAttribute('aria-orientation', 'vertical');
      expect(input).toHaveAttribute('dir', 'ltr');
      expect(railOf(input)).not.toHaveClass('wave-rtl:-scale-x-100');
      act(() => input.focus());
      await user.keyboard('{ArrowUp}');
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 1, v: 0.51 });
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 1, v: 0.52 });
    });

    it('leaves browser shortcuts alone: Alt, Ctrl or Meta with a key is neither handled nor prevented', () => {
      const onValueChange = vi.fn();
      render(
        <ColorSlider
          channel="saturation"
          defaultValue={{ h: 0, s: 0.5, v: 1 }}
          onValueChange={onValueChange}
        />,
      );
      const input = slider('Saturation');
      expect(fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'Home', ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'End', metaKey: true })).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("runs the consumer's onKeyDown first; preventDefault() keeps the value", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorSlider
          defaultValue={{ h: 10, s: 1, v: 1 }}
          onValueChange={onValueChange}
          onKeyDown={(event) => event.preventDefault()}
        />,
      );
      act(() => slider().focus());
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  it('applies the change events assistive technology sends', () => {
    const onValueChange = vi.fn();
    render(<ColorSlider defaultValue={{ h: 10, s: 1, v: 1 }} onValueChange={onValueChange} />);
    fireEvent.change(slider(), { target: { value: '120' } });
    expect(onValueChange.mock.calls).toEqual([[{ h: 120, s: 1, v: 1 }]]);
  });

  it('shows an out-of-range or non-finite color clamped, steps from there and writes no NaN', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <ColorSlider aria-label="Wrapped hue" value={{ h: 720, s: 1.5, v: Number.NaN }} />
        <ColorSlider
          aria-label="Clamped saturation"
          channel="saturation"
          value={{ h: -30, s: 1.5, v: Number.NaN }}
          onValueChange={onValueChange}
        />
      </>,
    );
    expect(slider('Wrapped hue')).toHaveValue('0');
    expect(slider('Clamped saturation')).toHaveValue('100');
    for (const input of screen.getAllByRole('slider')) {
      expect(rootOf(input).getAttribute('style')).not.toMatch(/NaN/);
    }
    act(() => slider('Clamped saturation').focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith({ h: -30, s: 0.99, v: Number.NaN });
  });

  it('keeps a controlled value whose parent ignores onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorSlider value={{ h: 10, s: 1, v: 1 }} onValueChange={onValueChange} />);
    act(() => slider().focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[{ h: 11, s: 1, v: 1 }], [{ h: 11, s: 1, v: 1 }]]);
    expect(slider()).toHaveValue('10');
  });

  it('reports each change once in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <ColorSlider defaultValue={{ h: 10, s: 1, v: 1 }} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    act(() => slider().focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  describe('naming and routing (C-ROUTING)', () => {
    it('the Field label names the input, not "Hue"', () => {
      renderWithFieldContext(<ColorSlider />);
      expect(screen.getByRole('slider', { name: FIELD_TEST_TEXT.label })).toHaveAttribute(
        'id',
        FIELD_TEST_IDS.controlId,
      );
      expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull();
    });

    it('a consumer aria-label or aria-labelledby wins over the built-in name', () => {
      render(
        <>
          <ColorSlider aria-label="Tint" />
          <span id="shade-label">Shade</span>
          <ColorSlider channel="value" aria-labelledby="shade-label" />
        </>,
      );
      expect(slider('Tint')).toBeInTheDocument();
      expect(slider('Shade')).toBeInTheDocument();
      expect(screen.queryByRole('slider', { name: 'Brightness' })).toBeNull();
    });

    it('routes id, aria-describedby, aria-invalid, aria-errormessage, aria-details, tabIndex and controlRef to the input', () => {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <>
          <ColorSlider
            data-testid="root"
            id="hue"
            aria-describedby="hint"
            aria-invalid
            aria-errormessage="error"
            aria-details="more"
            tabIndex={-1}
            controlRef={controlRef}
          />
          <span id="hint">Pick a hue</span>
          <span id="error">Out of gamut</span>
          <span id="more">Details</span>
        </>,
      );
      const input = slider();
      expect(controlRef.current).toBe(input);
      expect(input).toHaveAttribute('id', 'hue');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-errormessage', 'error');
      expect(input).toHaveAttribute('aria-details', 'more');
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input).toHaveAccessibleDescription('Pick a hue');
      const root = screen.getByTestId('root');
      expect(root).not.toHaveAttribute('id');
      expect(root).not.toHaveAttribute('aria-invalid');
    });

    it('never puts aria-required on the slider: required and aria-required make the hidden input required', () => {
      const { container } = render(
        <form aria-label="Form">
          <ColorSlider aria-required />
        </form>,
      );
      expect(slider()).not.toHaveAttribute('aria-required');
      expect(slider()).not.toBeRequired();
      expect(container.querySelectorAll('input[required]')).toHaveLength(1);
    });
  });

  describe('forms (C-FORMS)', () => {
    it('submits the color as hex under its name; a form reset restores defaultValue', () => {
      const onValueChange = vi.fn();
      render(
        <form aria-label="Form">
          <ColorSlider
            name="hue"
            defaultValue={{ h: 0, s: 1, v: 1 }}
            onValueChange={onValueChange}
          />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(new FormData(form).get('hue')).toBe('#ff0000');
      fireEvent.change(slider(), { target: { value: '120' } });
      expect(new FormData(form).get('hue')).toBe('#00ff00');
      act(() => form.reset());
      expect(new FormData(form).get('hue')).toBe('#ff0000');
      expect(onValueChange.mock.calls).toEqual([[{ h: 120, s: 1, v: 1 }], [{ h: 0, s: 1, v: 1 }]]);
    });

    it('adds nothing to the form without name or required', () => {
      render(
        <form aria-label="Form">
          <ColorSlider />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
    });

    it('a disabled slider submits nothing; enabled it still submits the hex', () => {
      const { unmount } = render(
        <form aria-label="Form">
          <ColorSlider name="hue" defaultValue={{ h: 0, s: 1, v: 1 }} disabled />
        </form>,
      );
      expect(
        new FormData(screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).get('hue'),
      ).toBeNull();
      unmount();

      render(
        <form aria-label="Form">
          <ColorSlider name="hue" defaultValue={{ h: 0, s: 1, v: 1 }} />
        </form>,
      );
      expect(
        new FormData(screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).get('hue'),
      ).toBe('#ff0000');
    });
  });

  describe('inside a ColorPicker (bound)', () => {
    it("reads and writes the picker's working color, takes its shape and labels, and renders no hidden input", async () => {
      const user = userEvent.setup();
      const onHsvChange = vi.fn();
      const { container } = render(
        <form aria-label="Form">
          <PickerHarness
            initial={{ h: 100, s: 1, v: 1 }}
            shape="square"
            labels={{ hue: 'Farbton' }}
            onHsvChange={onHsvChange}
          >
            <ColorSlider name="ignored" />
          </PickerHarness>
        </form>,
      );
      const input = slider('Farbton');
      expect(input).toHaveValue('100');
      expect(railOf(input)).toHaveClass('rounded-none');
      act(() => input.focus());
      await user.keyboard('{ArrowRight}');
      expect(onHsvChange.mock.calls).toEqual([[{ h: 101, s: 1, v: 1 }]]);
      expect(input).toHaveValue('101');
      expect(container.querySelector('input[name="ignored"]')).toBeNull();
    });

    it('is disabled while the picker is', () => {
      render(
        <PickerHarness disabled>
          <ColorSlider />
        </PickerHarness>,
      );
      expect(slider()).toBeDisabled();
      expect(rootOf(slider())).toHaveAttribute('data-disabled', '');
    });

    it('stays independent with its own defaultValue', async () => {
      const user = userEvent.setup();
      const onHsvChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <PickerHarness onHsvChange={onHsvChange}>
          <ColorSlider defaultValue={{ h: 30, s: 1, v: 1 }} onValueChange={onValueChange} />
        </PickerHarness>,
      );
      act(() => slider().focus());
      await user.keyboard('{ArrowRight}');
      expect(onValueChange.mock.calls).toEqual([[{ h: 31, s: 1, v: 1 }]]);
      expect(onHsvChange).not.toHaveBeenCalled();
    });
  });

  it('renders on the server and hydrates without warnings', () => {
    const ui = <ColorSlider channel="saturation" defaultValue={BRAND} />;
    const html = renderToString(ui);
    expect(html).toContain('--wave-color-slider-gradient');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, ui);
      });
      expect(error).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
    }
  });

  it('types: the channel and orientation unions', () => {
    expectTypeOf<ColorSliderProps['channel']>().toEqualTypeOf<
      'hue' | 'saturation' | 'value' | undefined
    >();
    expectTypeOf<ColorSliderProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    expectTypeOf<ColorSliderProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    // @ts-expect-error alpha has its own component, AlphaSlider
    const alpha = <ColorSlider channel="alpha" />;
    expect(alpha).toBeTruthy();
  });
});
