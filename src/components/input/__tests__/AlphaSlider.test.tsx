import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlphaSlider, type AlphaSliderProps } from '../AlphaSlider';
import { alphaSliderClassNames } from '../../../lib/classNames';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
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

  it('types: no channel; transparency is a boolean', () => {
    expectTypeOf<AlphaSliderProps['transparency']>().toEqualTypeOf<boolean | undefined>();
    // @ts-expect-error AlphaSlider has no channel
    const withChannel = <AlphaSlider channel="hue" />;
    expect(withChannel).toBeTruthy();
  });
});
