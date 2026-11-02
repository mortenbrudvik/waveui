import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { ColorSlider, type ColorSliderProps } from '../ColorSlider';
import { colorSliderClassNames } from '../../../lib/classNames';
import type { HsvColor, Orientation } from '../../../lib/types';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testRootPartRef,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { PickerHarness } from './colorPartHarness';

const BRAND: HsvColor = { h: 210, s: 0.92, v: 0.74 };
const slider = (name = 'Hue') => screen.getByRole('slider', { name });

/** React's development error for an unknown prop that reaches a DOM element, as logged. */
const UNKNOWN_PROP = (name: string) => [
  'React does not recognize the `%s` prop on a DOM element. If you intentionally want it to ' +
    'appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you ' +
    'accidentally passed it from a parent component, remove it from the DOM element.',
  name,
  name.toLowerCase(),
];
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
    ref: 'control',
    control: { role: 'slider', tag: 'input' },
    a11yVariants: [
      { name: 'saturation', props: { channel: 'saturation' } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'disabled', props: { disabled: true } },
      { name: 'in a form', props: { name: 'accent', required: true } },
    ],
  });

  testRootPartRef(ColorSlider);

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

    it('routes id, aria-describedby, aria-invalid, aria-errormessage, aria-details, tabIndex and ref to the input', () => {
      const ref = React.createRef<HTMLInputElement>();
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
            ref={ref}
          />
          <span id="hint">Pick a hue</span>
          <span id="error">Out of gamut</span>
          <span id="more">Details</span>
        </>,
      );
      const input = slider();
      expect(ref.current).toBe(input);
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

describe('ColorSlider — slotProps', () => {
  type ColorSliderSlotProps = NonNullable<ColorSliderProps['slotProps']>;
  const EVERY_PART: ColorSliderSlotProps = { root: {}, rail: {}, thumb: {} };
  const DARK_BLUE: HsvColor = { h: 220, s: 0.72, v: 0.4 };
  const parts = (root: ParentNode) =>
    [`.${colorSliderClassNames.rail}`, `.${colorSliderClassNames.thumb}`].map(
      (selector) => root.querySelector(selector) as Element,
    );

  it('renders the parts of 1f67a85 on the server and in the client (attributes sorted)', () => {
    // Captured from the dist of 1f67a85: the merged props may put the class before the locked
    // attributes.
    const template = document.createElement('template');
    template.innerHTML = renderToString(<ColorSlider defaultValue={DARK_BLUE} />);
    expect(openingTags(...parts(template.content))).toBe(
      [
        '<div aria-hidden="true" class="wave-color-slider__rail rounded-full forced-colors:forced-color-adjust-none bg-(image:--wave-color-slider-gradient) mx-3 h-3 flex-1 wave-rtl:-scale-x-100">',
        '<span class="wave-color-slider__thumb pointer-events-none absolute size-6 rounded-full border-2 border-background bg-(--wave-color-thumb) ring-1 ring-foreground forced-colors:forced-color-adjust-none forced-colors:border-[Canvas] forced-colors:ring-[CanvasText] start-(--wave-color-slider-position) top-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 -translate-y-1/2 group-has-[:focus-visible]/color-slider:ring-2 group-has-[:focus-visible]/color-slider:ring-background forced-colors:group-has-[:focus-visible]/color-slider:ring-[Canvas] group-has-[:focus-visible]/color-slider:outline-2 group-has-[:focus-visible]/color-slider:outline-offset-2 group-has-[:focus-visible]/color-slider:outline-ring forced-colors:group-has-[:focus-visible]/color-slider:outline-[Highlight]">',
      ].join('\n'),
    );
    render(
      <ColorSlider
        defaultValue={DARK_BLUE}
        orientation="vertical"
        shape="square"
        channel="value"
      />,
    );
    expect(openingTags(...parts(document))).toBe(
      [
        '<div aria-hidden="true" class="wave-color-slider__rail forced-colors:forced-color-adjust-none bg-(image:--wave-color-slider-gradient) my-3 w-3 flex-1 rounded-none">',
        '<span class="wave-color-slider__thumb pointer-events-none absolute size-6 rounded-full border-2 border-background bg-(--wave-color-thumb) ring-1 ring-foreground forced-colors:forced-color-adjust-none forced-colors:border-[Canvas] forced-colors:ring-[CanvasText] bottom-(--wave-color-slider-position) start-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 translate-y-1/2 group-has-[:focus-visible]/color-slider:ring-2 group-has-[:focus-visible]/color-slider:ring-background forced-colors:group-has-[:focus-visible]/color-slider:ring-[Canvas] group-has-[:focus-visible]/color-slider:outline-2 group-has-[:focus-visible]/color-slider:outline-offset-2 group-has-[:focus-visible]/color-slider:outline-ring forced-colors:group-has-[:focus-visible]/color-slider:outline-[Highlight]">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: ColorSliderProps[] = [
      { defaultValue: DARK_BLUE },
      { channel: 'saturation', orientation: 'vertical', shape: 'square' },
      { channel: 'value', disabled: true, name: 'accent', required: true, 'aria-label': 'Tone' },
      // The root's own props: the rest, the style and the hidden state.
      {
        className: 'c',
        style: { color: 'red' },
        title: 't',
        hidden: true,
        inert: true,
        'aria-hidden': true,
        onPointerDown: () => {},
      },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => <ColorSlider {...props} slotProps={slotProps} />,
        EVERY_PART,
      );
    }
    // Bound to a ColorPicker.
    expectInertSlotProps(
      (slotProps) => (
        <PickerHarness>
          <ColorSlider slotProps={slotProps} />
        </PickerHarness>
      ),
      EVERY_PART,
    );
  });

  it('puts your className, style and data-* on each part, after its stable class and own classes', () => {
    render(
      <ColorSlider
        defaultValue={DARK_BLUE}
        slotProps={{
          rail: { className: 'my-rail', style: { opacity: 0.5 }, 'data-part': 'rail' },
          thumb: { className: 'my-thumb', style: { opacity: 0.25 }, 'data-part': 'thumb' },
        }}
      />,
    );
    const input = slider();
    for (const [element, stable, own, mine, part, opacity] of [
      [railOf(input), colorSliderClassNames.rail, 'flex-1', 'my-rail', 'rail', '0.5'],
      [thumbOf(input), colorSliderClassNames.thumb, 'size-6', 'my-thumb', 'thumb', '0.25'],
    ] as const) {
      expect(element).toHaveClass(stable, own, mine);
      expect(element.classList[0]).toBe(stable);
      expect(element.classList[element.classList.length - 1]).toBe(mine);
      expect(element).toHaveAttribute('data-part', part);
      expect(element).toHaveStyle({ opacity });
    }
  });

  it('lets your class replace a conflicting class of the part', () => {
    render(
      <ColorSlider defaultValue={DARK_BLUE} slotProps={{ rail: { className: 'rounded-md' } }} />,
    );
    const rail = railOf(slider());
    expect(rail).toHaveClass('rounded-md');
    expect(rail).not.toHaveClass('rounded-full');
  });

  it('attaches your refs to the parts, beside ref', () => {
    const root = React.createRef<HTMLDivElement>();
    const rail = React.createRef<HTMLDivElement>();
    const thumb = React.createRef<HTMLSpanElement>();
    const ref = React.createRef<HTMLInputElement>();
    render(
      <ColorSlider
        ref={ref}
        defaultValue={DARK_BLUE}
        slotProps={{ root: { ref: root }, rail: { ref: rail }, thumb: { ref: thumb } }}
      />,
    );
    const input = slider();
    expect(rail.current).toBe(railOf(input));
    expect(thumb.current).toBe(thumbOf(input));
    expect(ref.current).toBe(input);
    expect(root.current).toBe(rootOf(input));
  });

  it('keeps the rail out of the tab order: a part sets no tabIndex on it', () => {
    render(<ColorSlider defaultValue={DARK_BLUE} slotProps={{ rail: { tabIndex: 0 } }} />);
    expect(railOf(slider())).not.toHaveAttribute('tabindex');
  });

  it('adds your attributes and handlers; the rail stays hidden from assistive technology', () => {
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    render(
      <ColorSlider
        defaultValue={DARK_BLUE}
        onValueChange={onValueChange}
        slotProps={{
          rail: { 'aria-hidden': false, title: 'Hue rail', onClick },
          thumb: { title: 'Thumb', onClick },
        }}
      />,
    );
    const input = slider();
    const rail = railOf(input);
    expect(rail).toHaveAttribute('aria-hidden', 'true');
    expect(rail).toHaveAttribute('title', 'Hue rail');
    expect(thumbOf(input)).toHaveAttribute('title', 'Thumb');
    fireEvent.click(rail);
    fireEvent.click(thumbOf(input));
    expect(onClick).toHaveBeenCalledTimes(2);
    // The slider is its input, which no part reaches: its keys still work.
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenCalledWith({ ...DARK_BLUE, h: 221 });
  });

  it('reaches the parts of a slider bound to a ColorPicker', () => {
    render(
      <PickerHarness>
        <ColorSlider
          slotProps={{ rail: { className: 'my-rail' }, thumb: { className: 'my-thumb' } }}
        />
      </PickerHarness>,
    );
    expect(railOf(slider())).toHaveClass('my-rail');
    expect(thumbOf(slider())).toHaveClass('my-thumb');
  });

  it('keeps the mirrored classes of a horizontal slider under dir="rtl" next to yours', () => {
    renderWithProviders(
      <ColorSlider
        defaultValue={DARK_BLUE}
        slotProps={{ rail: { className: 'my-rail' }, thumb: { className: 'my-thumb' } }}
      />,
      { dir: 'rtl' },
    );
    const input = slider();
    expect(railOf(input)).toHaveClass('wave-rtl:-scale-x-100', 'my-rail');
    expect(thumbOf(input)).toHaveClass('wave-rtl:translate-x-1/2', 'my-thumb');
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <ColorSlider
        defaultValue={DARK_BLUE}
        slotProps={{
          rail: { className: 'my-rail', title: 'Rail' },
          thumb: { className: 'my-thumb' },
        }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof ColorSliderSlotProps>().toEqualTypeOf<'root' | 'rail' | 'thumb'>();
    expectTypeOf<NonNullable<ColorSliderSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<ColorSliderSlotProps['rail']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<ColorSliderSlotProps['thumb']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the slider draws them
    void (<ColorSlider slotProps={{ rail: { children: 'Rail' } }} />);
    // @ts-expect-error -- a part takes no children: the slider draws its content
    void (<ColorSlider slotProps={{ root: { children: 'x' } }} />);
  });

  describe('the root part', () => {
    const control = (label = 'Hue') => screen.getByRole('slider', { name: label, hidden: true });
    const root = (label?: string) => rootOf(control(label));

    it("puts your className, style, data-* and attributes on the root <div>, after the slider's className and style", () => {
      render(
        <ColorSlider
          className="mine"
          style={{ color: 'red', width: 10 }}
          slotProps={{
            root: { className: 'my-root', style: { width: 20 }, 'data-part': 'root', title: 'R' },
          }}
        />,
      );
      expect(root().classList[0]).toBe(colorSliderClassNames.root);
      expect(root().className).toMatch(/ mine my-root$/);
      expect(root()).toHaveStyle({ color: 'rgb(255, 0, 0)', width: '20px' });
      expect(root()).toHaveAttribute('data-part', 'root');
      expect(root()).toHaveAttribute('title', 'R');
      expect(control()).not.toHaveAttribute('data-part');
      expect(control()).not.toHaveAttribute('title');
    });

    it("keeps the custom properties that draw the value the slider's: a part style does not move the thumb", () => {
      const keys = [
        '--wave-color-slider-gradient',
        '--wave-color-slider-position',
        '--wave-color-thumb',
      ];
      const { rerender } = render(<ColorSlider defaultValue={{ h: 0, s: 1, v: 1 }} />);
      const drawn = keys.map((key) => root().style.getPropertyValue(key));
      expect(drawn.every((value) => value !== '')).toBe(true);
      const partStyle = Object.fromEntries(
        keys.map((key) => [key, 'initial']),
      ) as React.CSSProperties;
      rerender(
        <ColorSlider
          defaultValue={{ h: 0, s: 1, v: 1 }}
          slotProps={{ root: { style: partStyle } }}
        />,
      );
      expect(keys.map((key) => root().style.getPropertyValue(key))).toEqual(drawn);
    });

    it('lets your class replace a conflicting class of the root', () => {
      render(<ColorSlider slotProps={{ root: { className: 'items-start' } }} />);
      expect(root()).toHaveClass('items-start');
      expect(root()).not.toHaveClass('items-center');
    });

    it("keeps the props you give the slider over the part's", () => {
      render(
        <ColorSlider
          title="Own"
          data-x="own"
          slotProps={{ root: { title: 'Part', 'data-x': 'part' } }}
        />,
      );
      expect(root()).toHaveAttribute('title', 'Own');
      expect(root()).toHaveAttribute('data-x', 'own');
    });

    it('keeps its data attributes and its hidden state: a part changes none of them', () => {
      const { rerender } = render(
        <ColorSlider
          orientation="vertical"
          channel="saturation"
          slotProps={{
            root: {
              'data-orientation': 'horizontal',
              'data-channel': 'hue',
              'data-disabled': '',
              hidden: true,
              inert: true,
              'aria-hidden': true,
            },
          }}
        />,
      );
      expect(root('Saturation')).toHaveAttribute('data-orientation', 'vertical');
      expect(root('Saturation')).toHaveAttribute('data-channel', 'saturation');
      expect(root('Saturation')).not.toHaveAttribute('data-disabled');
      for (const attribute of ['hidden', 'inert', 'aria-hidden']) {
        expect(root('Saturation')).not.toHaveAttribute(attribute);
      }
      // The slider's own hidden state stays its own.
      rerender(
        <ColorSlider
          hidden
          inert
          aria-hidden
          slotProps={{ root: { hidden: false, inert: false, 'aria-hidden': false } }}
        />,
      );
      expect(root()).toHaveAttribute('hidden');
      expect(root()).toHaveAttribute('inert');
      expect(root()).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps data-disabled the state of the slider, which a disabled slider sets', () => {
      render(<ColorSlider disabled slotProps={{ root: { 'data-disabled': 'no' } }} />);
      expect(root()).toHaveAttribute('data-disabled', '');
    });

    it("runs your root handlers before the slider's own; preventDefault() in yours skips its own", () => {
      const order: string[] = [];
      const { rerender } = render(
        <ColorSlider
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: () => order.push('part') } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
      rerender(
        <ColorSlider
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: (event) => event.preventDefault() } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
    });

    it('calls your root onClick in every state, as the slider calls its own: only the range input is disabled', () => {
      const onClick = vi.fn();
      const own = vi.fn();
      const { rerender } = render(<ColorSlider onClick={own} slotProps={{ root: { onClick } }} />);
      fireEvent.click(root());
      rerender(<ColorSlider disabled onClick={own} slotProps={{ root: { onClick } }} />);
      fireEvent.click(root());
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(own).toHaveBeenCalledTimes(2);
    });

    it('reaches the root of a slider bound to a ColorPicker', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <PickerHarness>
          <ColorSlider slotProps={{ root: { ref, className: 'my-root' } }} />
        </PickerHarness>,
      );
      expect(ref.current).toBe(root());
      expect(root()).toHaveClass('my-root');
    });

    it('has no accessibility violations with the root customised', async () => {
      render(<ColorSlider slotProps={{ root: { className: 'my-root', title: 'Pick' } }} />);
      await expectNoA11yViolations();
    });
  });
});

// 1.0 (Phase 14, R5): `ref` reaches the range input, the slider itself; the root <div> is
// `slotProps.root.ref`, and `controlRef` is gone.
describe('ColorSlider — ref reaches the control', () => {
  it('focuses the slider through ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<ColorSlider ref={ref} />);
    act(() => ref.current?.focus());
    expect(slider()).toHaveFocus();
  });

  it('keeps the invalid focus and the form reset working with an inline ref that changes on every render', () => {
    const nodes: (HTMLInputElement | null)[] = [];
    const ui = (pass: number) => (
      <form aria-label="Form">
        <ColorSlider
          ref={(node) => {
            nodes.push(node);
          }}
          name="accent"
          required
          defaultValue={{ h: 0, s: 1, v: 1 }}
          data-pass={pass}
        />
      </form>
    );
    const { container, rerender } = render(ui(0));
    rerender(ui(1));
    rerender(ui(2));
    const input = slider();
    expect(nodes.at(-1)).toBe(input);
    // The hidden input's invalid event focuses the slider through the slider's own ref.
    fireEvent.invalid(container.querySelector('input[name="accent"]') as HTMLInputElement);
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '120' } });
    rerender(ui(3));
    expect(input).toHaveValue('120');
    act(() => (screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).reset());
    expect(input).toHaveValue('0');
    expect(nodes.at(-1)).toBe(input);
  });

  it('reaches the input of a slider bound to a ColorPicker', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <PickerHarness>
        <ColorSlider ref={ref} />
      </PickerHarness>,
    );
    expect(ref.current).toBe(slider());
  });

  it('attaches a callback ref once, keeps it across renders and detaches it on unmount', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(<ColorSlider ref={ref} />);
    const input = slider();
    rerender(<ColorSlider ref={ref} disabled orientation="vertical" />);
    expect(ref.mock.calls).toEqual([[input]]);
    unmount();
    expect(ref.mock.calls).toEqual([[input], [null]]);
  });

  it('in StrictMode, attaches only the control: React detaches and attaches it again on mount, once', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <React.StrictMode>
        <ColorSlider ref={ref} />
      </React.StrictMode>,
    );
    const input = slider();
    rerender(
      <React.StrictMode>
        <ColorSlider ref={ref} disabled />
      </React.StrictMode>,
    );
    expect(ref.mock.calls).toEqual([[input], [null], [input]]);
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it('reaches the control the Field label points at', () => {
    const ref = React.createRef<HTMLInputElement>();
    renderWithFieldContext(<ColorSlider ref={ref} />);
    const fieldLabel = screen.getByText(FIELD_TEST_TEXT.label).closest('label') as HTMLLabelElement;
    expect(ref.current).toBe(slider(FIELD_TEST_TEXT.label));
    expect(ref.current?.id).toBe(fieldLabel.htmlFor);
  });

  it('declares ref for the range input, and no controlRef', () => {
    expectTypeOf<ColorSliderProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<ColorSliderProps>().not.toHaveProperty('controlRef');
    const divRef = React.createRef<HTMLDivElement>();
    // @ts-expect-error -- in 1.0 `ref` reaches the range input; the root <div> is slotProps.root.ref
    void (<ColorSlider ref={divRef} />);
  });

  it('has no controlRef: TypeScript rejects it, and untyped code puts an unknown prop on the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <ColorSlider
          // @ts-expect-error -- `controlRef` is removed in 1.0: `ref` reaches the range input
          controlRef={controlRef}
        />,
      );
      expect(controlRef.current).toBeNull();
      expect(rootOf(slider())).toHaveAttribute('controlref', '[object Object]');
      expect(error.mock.calls).toEqual([UNKNOWN_PROP('controlRef')]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
