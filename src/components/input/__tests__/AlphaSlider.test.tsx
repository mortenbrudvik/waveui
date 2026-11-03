import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { AlphaSlider, type AlphaSliderProps } from '../AlphaSlider';
import { alphaSliderClassNames } from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testRootPartRef,
  testSystemProps,
  UNKNOWN_PROP,
} from '../../../test-utils';
import { FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { PickerHarness } from './colorPartHarness';

const slider = (name = 'Opacity') => screen.getByRole('slider', { name });
const rootOf = (input: HTMLElement) =>
  input.closest<HTMLElement>(`.${alphaSliderClassNames.root}`) as HTMLElement;
const railOf = (input: HTMLElement) =>
  rootOf(input).querySelector<HTMLElement>(`.${alphaSliderClassNames.rail}`) as HTMLElement;

describe('AlphaSlider', () => {
  testSystemProps(AlphaSlider, {
    expectedTag: 'div',
    displayName: 'AlphaSlider',
    ref: 'control',
    control: { role: 'slider', tag: 'input' },
    a11yVariants: [
      { name: 'transparency', props: { transparency: true } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  testRootPartRef(AlphaSlider);

  it('shows the opacity: "Opacity", 0–100, the percentage as value text; no alpha is 100 %', () => {
    // Two separate mounts, not a rerender: switching the same instance from an uncontrolled
    // defaultValue to a controlled value is a real (and separately covered) mode change, and
    // would fire useControllable's dev warning here for a reason unrelated to this assertion.
    const { unmount } = render(<AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} />);
    expect(slider()).toHaveValue('40');
    expect(slider()).toHaveAttribute('max', '100');
    expect(slider()).toHaveAttribute('aria-valuetext', '40%');
    unmount();
    render(<AlphaSlider value={{ h: 0, s: 1, v: 1 }} />);
    expect(slider()).toHaveValue('100');
  });

  it('transparency flips the input value, the name, the value text, the rail and the arrows', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <AlphaSlider
        transparency
        defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }}
        onValueChange={onValueChange}
      />,
    );
    const input = slider('Transparency');
    expect(input).toHaveValue('60');
    expect(input).toHaveAttribute('aria-valuetext', '60%');
    expect(rootOf(input).style.getPropertyValue('--wave-color-slider-gradient')).toBe(
      'linear-gradient(to right, #ff0000, transparent)',
    );
    act(() => input.focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1, a: 0.39 }]]);
  });

  it('draws the rail over a checkerboard of theme tokens and reads its gradient from the custom property', () => {
    render(<AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }} />);
    const input = slider();
    expect(rootOf(input).style.getPropertyValue('--wave-color-slider-gradient')).toBe(
      'linear-gradient(to right, transparent, #ff0000)',
    );
    expect(rootOf(input).style.getPropertyValue('--wave-color-thumb')).toBe('#ff000080');
    const rail = railOf(input);
    expect(rail.className).toContain('var(--wave-stroke)');
    expect(rail.className).toContain('var(--wave-background)');
    expect(rail).toHaveClass(
      'wave:forced-colors:forced-color-adjust-none',
      'wave:wave-rtl:-scale-x-100',
    );
    expect(rail.firstElementChild).toHaveClass('wave:bg-(image:--wave-color-slider-gradient)');
    expect(rootOf(input).querySelector(`.${alphaSliderClassNames.thumb}`)).toHaveClass(
      'wave:group-has-[:focus-visible]/alpha-slider:outline-ring',
      'wave:forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas]',
    );
  });

  it.each([
    ['{ArrowRight}', 0.51],
    ['{ArrowLeft}', 0.49],
    ['{Shift>}{ArrowUp}{/Shift}', 0.6],
    ['{PageDown}', 0.4],
    ['{Home}', 0],
    ['{End}', 1],
  ])('%s moves the opacity to %s', async (keys, alpha) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }} onValueChange={onValueChange} />,
    );
    act(() => slider().focus());
    await user.keyboard(keys);
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1, a: alpha }]]);
  });

  it('mirrors a horizontal rail in right-to-left layouts; a vertical one keeps the bottom as the minimum', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderWithProviders(
      <>
        <AlphaSlider
          aria-label="Row"
          defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }}
          onValueChange={onValueChange}
        />
        <AlphaSlider
          aria-label="Column"
          orientation="vertical"
          defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }}
        />
      </>,
      { dir: 'rtl' },
    );
    act(() => slider('Row').focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 1, v: 1, a: 0.51 });
    expect(slider('Column')).toHaveAttribute('dir', 'ltr');
    expect(slider('Column')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('shows an out-of-range or non-finite alpha clamped and writes no NaN', () => {
    render(
      <>
        <AlphaSlider aria-label="Over" value={{ h: 0, s: 1, v: 1, a: 1.4 }} />
        <AlphaSlider
          aria-label="Not a number"
          value={{ h: Number.NaN, s: 1, v: 1, a: Number.NaN }}
        />
      </>,
    );
    expect(slider('Over')).toHaveValue('100');
    expect(slider('Not a number')).toHaveValue('100');
    for (const input of screen.getAllByRole('slider')) {
      expect(rootOf(input).getAttribute('style')).not.toMatch(/NaN/);
    }
  });

  it('labels.valueText replaces the value text', () => {
    render(
      <AlphaSlider
        defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }}
        labels={{
          valueText: (color, transparency) => `${transparency ? 'clear' : 'solid'} ${color.a}`,
        }}
      />,
    );
    expect(slider()).toHaveAttribute('aria-valuetext', 'solid 0.4');
  });

  it('submits the color with its alpha byte as hex (C-FORMS)', () => {
    render(
      <form aria-label="Form">
        <AlphaSlider name="tint" defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(new FormData(form).get('tint')).toBe('#ff000066');
    fireEvent.change(slider(), { target: { value: '100' } });
    expect(new FormData(form).get('tint')).toBe('#ff0000');
  });

  it('a disabled slider submits nothing; enabled it still submits the hex', () => {
    const { unmount } = render(
      <form aria-label="Form">
        <AlphaSlider name="tint" defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} disabled />
      </form>,
    );
    expect(
      new FormData(screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).get('tint'),
    ).toBeNull();
    unmount();

    render(
      <form aria-label="Form">
        <AlphaSlider name="tint" defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} />
      </form>,
    );
    expect(
      new FormData(screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).get('tint'),
    ).toBe('#ff000066');
  });

  it("bound: takes the picker's opacity and transparency names and writes the working color", async () => {
    const user = userEvent.setup();
    const onHsvChange = vi.fn();
    render(
      <PickerHarness
        initial={{ h: 0, s: 1, v: 1, a: 0.5 }}
        labels={{ opacity: 'Deckkraft', transparency: 'Transparenz' }}
        onHsvChange={onHsvChange}
      >
        <AlphaSlider />
        <AlphaSlider transparency />
      </PickerHarness>,
    );
    expect(slider('Transparenz')).toHaveValue('50');
    act(() => slider('Deckkraft').focus());
    await user.keyboard('{ArrowUp}');
    expect(onHsvChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1, a: 0.51 }]]);
    expect(slider('Transparenz')).toHaveValue('49');
  });

  it('reports each change once in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    act(() => slider().focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1, a: 0.41 }]]);
  });

  it('renders on the server and hydrates without warnings', () => {
    const ui = <AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} />;
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
      expect(slider()).toHaveValue('40');
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
    }
  });

  it('types: no channel; transparency is a boolean', () => {
    expectTypeOf<AlphaSliderProps['transparency']>().toEqualTypeOf<boolean | undefined>();
    // @ts-expect-error AlphaSlider has no channel
    const withChannel = <AlphaSlider channel="hue" />;
    expect(withChannel).toBeTruthy();
  });
});

describe('AlphaSlider — slotProps', () => {
  type AlphaSliderSlotProps = NonNullable<AlphaSliderProps['slotProps']>;
  const EVERY_PART: AlphaSliderSlotProps = { root: {}, rail: {}, thumb: {} };
  const HALF_RED = { h: 0, s: 1, v: 1, a: 0.4 };
  const thumbOf = (input: HTMLElement) =>
    rootOf(input).querySelector<HTMLElement>(`.${alphaSliderClassNames.thumb}`) as HTMLElement;
  const parts = (root: ParentNode) =>
    [
      `.${alphaSliderClassNames.rail}`,
      `.${alphaSliderClassNames.rail} > span`,
      `.${alphaSliderClassNames.thumb}`,
    ].map((selector) => root.querySelector(selector) as Element);

  it('renders the parts of 1f67a85 on the server and in the client (attributes sorted)', () => {
    // Captured from the dist of 1f67a85 (the rail's gradient span with them): the merged props
    // may put the class before the locked attributes.
    const template = document.createElement('template');
    template.innerHTML = renderToString(<AlphaSlider defaultValue={HALF_RED} />);
    expect(openingTags(...parts(template.content))).toBe(
      [
        '<div aria-hidden="true" class="wave-alpha-slider__rail wave:relative wave:overflow-hidden wave:rounded-full wave:bg-[conic-gradient(var(--wave-stroke)_25%,var(--wave-background)_0_50%,var(--wave-stroke)_0_75%,var(--wave-background)_0)] wave:bg-size-[8px_8px] wave:forced-colors:forced-color-adjust-none wave:mx-3 wave:h-3 wave:flex-1 wave:wave-rtl:-scale-x-100">',
        '<span class="wave:absolute wave:inset-0 wave:bg-(image:--wave-color-slider-gradient)">',
        '<span class="wave-alpha-slider__thumb wave:pointer-events-none wave:absolute wave:size-6 wave:rounded-full wave:border-2 wave:border-background wave:bg-(--wave-color-thumb) wave:ring-1 wave:ring-foreground wave:forced-colors:forced-color-adjust-none wave:forced-colors:border-[Canvas] wave:forced-colors:ring-[CanvasText] wave:start-(--wave-color-slider-position) wave:top-1/2 wave:-translate-x-1/2 wave:wave-rtl:translate-x-1/2 wave:-translate-y-1/2 wave:group-has-[:focus-visible]/alpha-slider:ring-2 wave:group-has-[:focus-visible]/alpha-slider:ring-background wave:forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas] wave:group-has-[:focus-visible]/alpha-slider:outline-2 wave:group-has-[:focus-visible]/alpha-slider:outline-offset-2 wave:group-has-[:focus-visible]/alpha-slider:outline-ring wave:forced-colors:group-has-[:focus-visible]/alpha-slider:outline-[Highlight]">',
      ].join('\n'),
    );
    render(
      <AlphaSlider defaultValue={HALF_RED} orientation="vertical" shape="square" transparency />,
    );
    expect(openingTags(...parts(document))).toBe(
      [
        '<div aria-hidden="true" class="wave-alpha-slider__rail wave:relative wave:overflow-hidden wave:bg-[conic-gradient(var(--wave-stroke)_25%,var(--wave-background)_0_50%,var(--wave-stroke)_0_75%,var(--wave-background)_0)] wave:bg-size-[8px_8px] wave:forced-colors:forced-color-adjust-none wave:my-3 wave:w-3 wave:flex-1 wave:rounded-none">',
        '<span class="wave:absolute wave:inset-0 wave:bg-(image:--wave-color-slider-gradient)">',
        '<span class="wave-alpha-slider__thumb wave:pointer-events-none wave:absolute wave:size-6 wave:rounded-full wave:border-2 wave:border-background wave:bg-(--wave-color-thumb) wave:ring-1 wave:ring-foreground wave:forced-colors:forced-color-adjust-none wave:forced-colors:border-[Canvas] wave:forced-colors:ring-[CanvasText] wave:bottom-(--wave-color-slider-position) wave:start-1/2 wave:-translate-x-1/2 wave:wave-rtl:translate-x-1/2 wave:translate-y-1/2 wave:group-has-[:focus-visible]/alpha-slider:ring-2 wave:group-has-[:focus-visible]/alpha-slider:ring-background wave:forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas] wave:group-has-[:focus-visible]/alpha-slider:outline-2 wave:group-has-[:focus-visible]/alpha-slider:outline-offset-2 wave:group-has-[:focus-visible]/alpha-slider:outline-ring wave:forced-colors:group-has-[:focus-visible]/alpha-slider:outline-[Highlight]">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: AlphaSliderProps[] = [
      { defaultValue: HALF_RED },
      { transparency: true, orientation: 'vertical', shape: 'square' },
      { disabled: true, name: 'opacity', required: true, 'aria-label': 'Alpha' },
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
        (slotProps) => <AlphaSlider {...props} slotProps={slotProps} />,
        EVERY_PART,
      );
    }
    // Bound to a ColorPicker.
    expectInertSlotProps(
      (slotProps) => (
        <PickerHarness>
          <AlphaSlider slotProps={slotProps} />
        </PickerHarness>
      ),
      EVERY_PART,
    );
  });

  it('puts your className, style and data-* on each part, after its stable class and own classes', () => {
    render(
      <AlphaSlider
        defaultValue={HALF_RED}
        slotProps={{
          rail: { className: 'my-rail', style: { opacity: 0.5 }, 'data-part': 'rail' },
          thumb: { className: 'my-thumb', style: { opacity: 0.25 }, 'data-part': 'thumb' },
        }}
      />,
    );
    const input = slider();
    for (const [element, stable, own, mine, part, opacity] of [
      [railOf(input), alphaSliderClassNames.rail, 'wave:overflow-hidden', 'my-rail', 'rail', '0.5'],
      [thumbOf(input), alphaSliderClassNames.thumb, 'wave:size-6', 'my-thumb', 'thumb', '0.25'],
    ] as const) {
      expect(element).toHaveClass(stable, own, mine);
      expect(element.classList[0]).toBe(stable);
      expect(element.classList[element.classList.length - 1]).toBe(mine);
      expect(element).toHaveAttribute('data-part', part);
      expect(element).toHaveStyle({ opacity });
    }
    // The gradient inside the rail is no part: it keeps its own classes only.
    expect(railOf(input).firstElementChild).toHaveAttribute(
      'class',
      'wave:absolute wave:inset-0 wave:bg-(image:--wave-color-slider-gradient)',
    );
  });

  it('lets your class replace a conflicting class of the part', () => {
    render(
      <AlphaSlider defaultValue={HALF_RED} slotProps={{ rail: { className: 'rounded-md' } }} />,
    );
    const rail = railOf(slider());
    expect(rail).toHaveClass('rounded-md');
    expect(rail).not.toHaveClass('wave:rounded-full');
  });

  it('attaches your refs to the parts, beside ref', () => {
    const root = React.createRef<HTMLDivElement>();
    const rail = React.createRef<HTMLDivElement>();
    const thumb = React.createRef<HTMLSpanElement>();
    const ref = React.createRef<HTMLInputElement>();
    render(
      <AlphaSlider
        ref={ref}
        defaultValue={HALF_RED}
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
    render(<AlphaSlider defaultValue={HALF_RED} slotProps={{ rail: { tabIndex: 0 } }} />);
    expect(railOf(slider())).not.toHaveAttribute('tabindex');
  });

  it('adds your attributes and handlers; the rail stays hidden from assistive technology', () => {
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    render(
      <AlphaSlider
        defaultValue={HALF_RED}
        onValueChange={onValueChange}
        slotProps={{
          rail: { 'aria-hidden': false, title: 'Opacity rail', onClick },
          thumb: { title: 'Thumb', onClick },
        }}
      />,
    );
    const input = slider();
    const rail = railOf(input);
    expect(rail).toHaveAttribute('aria-hidden', 'true');
    expect(rail).toHaveAttribute('title', 'Opacity rail');
    expect(thumbOf(input)).toHaveAttribute('title', 'Thumb');
    fireEvent.click(rail);
    fireEvent.click(thumbOf(input));
    expect(onClick).toHaveBeenCalledTimes(2);
    // The slider is its input, which no part reaches: its keys still work.
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenCalledWith({ ...HALF_RED, a: 0.41 });
  });

  it('reaches the parts of a slider bound to a ColorPicker', () => {
    render(
      <PickerHarness>
        <AlphaSlider
          slotProps={{ rail: { className: 'my-rail' }, thumb: { className: 'my-thumb' } }}
        />
      </PickerHarness>,
    );
    expect(railOf(slider())).toHaveClass('my-rail');
    expect(thumbOf(slider())).toHaveClass('my-thumb');
  });

  it('keeps the mirrored classes of a horizontal slider under dir="rtl" next to yours', () => {
    renderWithProviders(
      <AlphaSlider
        defaultValue={HALF_RED}
        slotProps={{ rail: { className: 'my-rail' }, thumb: { className: 'my-thumb' } }}
      />,
      { dir: 'rtl' },
    );
    const input = slider();
    expect(railOf(input)).toHaveClass('wave:wave-rtl:-scale-x-100', 'my-rail');
    expect(thumbOf(input)).toHaveClass('wave:wave-rtl:translate-x-1/2', 'my-thumb');
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <AlphaSlider
        defaultValue={HALF_RED}
        slotProps={{
          rail: { className: 'my-rail', title: 'Rail' },
          thumb: { className: 'my-thumb' },
        }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, its own and not ColorSlider’s, and takes no children', () => {
    expectTypeOf<keyof AlphaSliderSlotProps>().toEqualTypeOf<'root' | 'rail' | 'thumb'>();
    expectTypeOf<NonNullable<AlphaSliderSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<AlphaSliderSlotProps['rail']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<AlphaSliderSlotProps['thumb']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the slider draws them
    void (<AlphaSlider slotProps={{ thumb: { children: 'Thumb' } }} />);
    // @ts-expect-error -- a part takes no children: the slider draws its content
    void (<AlphaSlider slotProps={{ root: { children: 'x' } }} />);
  });

  describe('the root part', () => {
    const control = (label = 'Opacity') =>
      screen.getByRole('slider', { name: label, hidden: true });
    const root = (label?: string) => rootOf(control(label));

    it("puts your className, style, data-* and attributes on the root <div>, after the slider's className and style", () => {
      render(
        <AlphaSlider
          className="mine"
          style={{ color: 'red', width: 10 }}
          slotProps={{
            root: { className: 'my-root', style: { width: 20 }, 'data-part': 'root', title: 'R' },
          }}
        />,
      );
      expect(root().classList[0]).toBe(alphaSliderClassNames.root);
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
      const { rerender } = render(<AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} />);
      const drawn = keys.map((key) => root().style.getPropertyValue(key));
      expect(drawn.every((value) => value !== '')).toBe(true);
      const partStyle = Object.fromEntries(
        keys.map((key) => [key, 'initial']),
      ) as React.CSSProperties;
      rerender(
        <AlphaSlider
          defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }}
          slotProps={{ root: { style: partStyle } }}
        />,
      );
      expect(keys.map((key) => root().style.getPropertyValue(key))).toEqual(drawn);
    });

    it('lets your class replace a conflicting class of the root', () => {
      render(<AlphaSlider slotProps={{ root: { className: 'items-start' } }} />);
      expect(root()).toHaveClass('items-start');
      expect(root()).not.toHaveClass('wave:items-center');
    });

    it("keeps the props you give the slider over the part's", () => {
      render(
        <AlphaSlider
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
        <AlphaSlider
          orientation="vertical"
          slotProps={{
            root: {
              'data-orientation': 'horizontal',
              'data-disabled': '',
              hidden: true,
              inert: true,
              'aria-hidden': true,
            },
          }}
        />,
      );
      expect(root('Opacity')).toHaveAttribute('data-orientation', 'vertical');
      expect(root('Opacity')).not.toHaveAttribute('data-disabled');
      for (const attribute of ['hidden', 'inert', 'aria-hidden']) {
        expect(root('Opacity')).not.toHaveAttribute(attribute);
      }
      // The slider's own hidden state stays its own.
      rerender(
        <AlphaSlider
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
      render(<AlphaSlider disabled slotProps={{ root: { 'data-disabled': 'no' } }} />);
      expect(root()).toHaveAttribute('data-disabled', '');
    });

    it("runs your root handlers before the slider's own; preventDefault() in yours skips its own", () => {
      const order: string[] = [];
      const { rerender } = render(
        <AlphaSlider
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: () => order.push('part') } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
      rerender(
        <AlphaSlider
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
      const { rerender } = render(<AlphaSlider onClick={own} slotProps={{ root: { onClick } }} />);
      fireEvent.click(root());
      rerender(<AlphaSlider disabled onClick={own} slotProps={{ root: { onClick } }} />);
      fireEvent.click(root());
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(own).toHaveBeenCalledTimes(2);
    });

    it('reaches the root of a slider bound to a ColorPicker', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <PickerHarness>
          <AlphaSlider slotProps={{ root: { ref, className: 'my-root' } }} />
        </PickerHarness>,
      );
      expect(ref.current).toBe(root());
      expect(root()).toHaveClass('my-root');
    });

    it('has no accessibility violations with the root customised', async () => {
      render(<AlphaSlider slotProps={{ root: { className: 'my-root', title: 'Pick' } }} />);
      await expectNoA11yViolations();
    });
  });
});

// 1.0 (Phase 14, R5): `ref` reaches the range input, the slider itself; the root <div> is
// `slotProps.root.ref`, and `controlRef` is gone.
describe('AlphaSlider — ref reaches the control', () => {
  it('focuses the slider through ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<AlphaSlider ref={ref} />);
    act(() => ref.current?.focus());
    expect(slider()).toHaveFocus();
  });

  it('keeps the invalid focus and the form reset working with an inline ref that changes on every render', () => {
    const nodes: (HTMLInputElement | null)[] = [];
    const ui = (pass: number) => (
      <form aria-label="Form">
        <AlphaSlider
          ref={(node) => {
            nodes.push(node);
          }}
          name="accent"
          required
          defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }}
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
    fireEvent.change(input, { target: { value: '80' } });
    rerender(ui(3));
    expect(input).toHaveValue('80');
    act(() => (screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).reset());
    expect(input).toHaveValue('40');
    expect(nodes.at(-1)).toBe(input);
  });

  it('reaches the input of a slider bound to a ColorPicker', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <PickerHarness>
        <AlphaSlider ref={ref} />
      </PickerHarness>,
    );
    expect(ref.current).toBe(slider());
  });

  it('attaches a callback ref once, keeps it across renders and detaches it on unmount', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(<AlphaSlider ref={ref} />);
    const input = slider();
    rerender(<AlphaSlider ref={ref} disabled orientation="vertical" />);
    expect(ref.mock.calls).toEqual([[input]]);
    unmount();
    expect(ref.mock.calls).toEqual([[input], [null]]);
  });

  it('in StrictMode, attaches only the control: React detaches and attaches it again on mount, once', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <React.StrictMode>
        <AlphaSlider ref={ref} />
      </React.StrictMode>,
    );
    const input = slider();
    rerender(
      <React.StrictMode>
        <AlphaSlider ref={ref} disabled />
      </React.StrictMode>,
    );
    expect(ref.mock.calls).toEqual([[input], [null], [input]]);
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it('reaches the control the Field label points at', () => {
    const ref = React.createRef<HTMLInputElement>();
    renderWithFieldContext(<AlphaSlider ref={ref} />);
    const fieldLabel = screen.getByText(FIELD_TEST_TEXT.label).closest('label') as HTMLLabelElement;
    expect(ref.current).toBe(slider(FIELD_TEST_TEXT.label));
    expect(ref.current?.id).toBe(fieldLabel.htmlFor);
  });

  it('declares ref for the range input, and no controlRef', () => {
    expectTypeOf<AlphaSliderProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<AlphaSliderProps>().not.toHaveProperty('controlRef');
    const divRef = React.createRef<HTMLDivElement>();
    // @ts-expect-error -- in 1.0 `ref` reaches the range input; the root <div> is slotProps.root.ref
    void (<AlphaSlider ref={divRef} />);
  });

  it('has no controlRef: TypeScript rejects it, and untyped code puts an unknown prop on the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <AlphaSlider
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
