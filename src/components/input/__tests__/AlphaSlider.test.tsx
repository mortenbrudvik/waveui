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
  testSystemProps,
} from '../../../test-utils';
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
    control: { role: 'slider' },
    a11yVariants: [
      { name: 'transparency', props: { transparency: true } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'disabled', props: { disabled: true } },
    ],
  });

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
    expect(rail).toHaveClass('forced-colors:forced-color-adjust-none', 'wave-rtl:-scale-x-100');
    expect(rail.firstElementChild).toHaveClass('bg-(image:--wave-color-slider-gradient)');
    expect(rootOf(input).querySelector(`.${alphaSliderClassNames.thumb}`)).toHaveClass(
      'group-has-[:focus-visible]/alpha-slider:outline-ring',
      'forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas]',
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
  const EVERY_PART: AlphaSliderSlotProps = { rail: {}, thumb: {} };
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
        '<div aria-hidden="true" class="wave-alpha-slider__rail relative overflow-hidden rounded-full bg-[conic-gradient(var(--wave-stroke)_25%,var(--wave-background)_0_50%,var(--wave-stroke)_0_75%,var(--wave-background)_0)] bg-size-[8px_8px] forced-colors:forced-color-adjust-none mx-3 h-3 flex-1 wave-rtl:-scale-x-100">',
        '<span class="absolute inset-0 bg-(image:--wave-color-slider-gradient)">',
        '<span class="wave-alpha-slider__thumb pointer-events-none absolute size-6 rounded-full border-2 border-background bg-(--wave-color-thumb) ring-1 ring-foreground forced-colors:forced-color-adjust-none forced-colors:border-[Canvas] forced-colors:ring-[CanvasText] start-(--wave-color-slider-position) top-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 -translate-y-1/2 group-has-[:focus-visible]/alpha-slider:ring-2 group-has-[:focus-visible]/alpha-slider:ring-background forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas] group-has-[:focus-visible]/alpha-slider:outline-2 group-has-[:focus-visible]/alpha-slider:outline-offset-2 group-has-[:focus-visible]/alpha-slider:outline-ring forced-colors:group-has-[:focus-visible]/alpha-slider:outline-[Highlight]">',
      ].join('\n'),
    );
    render(
      <AlphaSlider defaultValue={HALF_RED} orientation="vertical" shape="square" transparency />,
    );
    expect(openingTags(...parts(document))).toBe(
      [
        '<div aria-hidden="true" class="wave-alpha-slider__rail relative overflow-hidden bg-[conic-gradient(var(--wave-stroke)_25%,var(--wave-background)_0_50%,var(--wave-stroke)_0_75%,var(--wave-background)_0)] bg-size-[8px_8px] forced-colors:forced-color-adjust-none my-3 w-3 flex-1 rounded-none">',
        '<span class="absolute inset-0 bg-(image:--wave-color-slider-gradient)">',
        '<span class="wave-alpha-slider__thumb pointer-events-none absolute size-6 rounded-full border-2 border-background bg-(--wave-color-thumb) ring-1 ring-foreground forced-colors:forced-color-adjust-none forced-colors:border-[Canvas] forced-colors:ring-[CanvasText] bottom-(--wave-color-slider-position) start-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 translate-y-1/2 group-has-[:focus-visible]/alpha-slider:ring-2 group-has-[:focus-visible]/alpha-slider:ring-background forced-colors:group-has-[:focus-visible]/alpha-slider:ring-[Canvas] group-has-[:focus-visible]/alpha-slider:outline-2 group-has-[:focus-visible]/alpha-slider:outline-offset-2 group-has-[:focus-visible]/alpha-slider:outline-ring forced-colors:group-has-[:focus-visible]/alpha-slider:outline-[Highlight]">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: AlphaSliderProps[] = [
      { defaultValue: HALF_RED },
      { transparency: true, orientation: 'vertical', shape: 'square' },
      { disabled: true, name: 'opacity', required: true, 'aria-label': 'Alpha' },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => <AlphaSlider {...props} slotProps={slotProps} />,
        EVERY_PART,
      );
    }
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
      [railOf(input), alphaSliderClassNames.rail, 'overflow-hidden', 'my-rail', 'rail', '0.5'],
      [thumbOf(input), alphaSliderClassNames.thumb, 'size-6', 'my-thumb', 'thumb', '0.25'],
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
      'absolute inset-0 bg-(image:--wave-color-slider-gradient)',
    );
  });

  it('lets your class replace a conflicting class of the part', () => {
    render(
      <AlphaSlider defaultValue={HALF_RED} slotProps={{ rail: { className: 'rounded-md' } }} />,
    );
    const rail = railOf(slider());
    expect(rail).toHaveClass('rounded-md');
    expect(rail).not.toHaveClass('rounded-full');
  });

  it('attaches your refs to the parts, beside controlRef and ref', () => {
    const rail = React.createRef<HTMLDivElement>();
    const thumb = React.createRef<HTMLSpanElement>();
    const controlRef = React.createRef<HTMLInputElement>();
    const ref = React.createRef<HTMLDivElement>();
    render(
      <AlphaSlider
        ref={ref}
        controlRef={controlRef}
        defaultValue={HALF_RED}
        slotProps={{ rail: { ref: rail }, thumb: { ref: thumb } }}
      />,
    );
    const input = slider();
    expect(rail.current).toBe(railOf(input));
    expect(thumb.current).toBe(thumbOf(input));
    expect(controlRef.current).toBe(input);
    expect(ref.current).toBe(rootOf(input));
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
    expect(railOf(input)).toHaveClass('wave-rtl:-scale-x-100', 'my-rail');
    expect(thumbOf(input)).toHaveClass('wave-rtl:translate-x-1/2', 'my-thumb');
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
    expectTypeOf<keyof AlphaSliderSlotProps>().toEqualTypeOf<'rail' | 'thumb'>();
    expectTypeOf<NonNullable<AlphaSliderSlotProps['rail']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<AlphaSliderSlotProps['thumb']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the slider draws them
    void (<AlphaSlider slotProps={{ thumb: { children: 'Thumb' } }} />);
  });
});
