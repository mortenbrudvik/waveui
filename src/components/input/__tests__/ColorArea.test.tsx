import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { ColorArea, type ColorAreaProps } from '../ColorArea';
import { colorAreaClassNames } from '../../../lib/classNames';
import { hsvToHex } from '../../../lib/color';
import type { HsvColor } from '../../../lib/types';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { PickerHarness } from './colorPartHarness';

const DARK_BLUE: HsvColor = { h: 220, s: 0.72, v: 0.4 };
const MIDDLE: HsvColor = { h: 100, s: 0.5, v: 0.5 };
const group = (name = 'Accent') => screen.getByRole('group', { name });
// `hidden: true`: where the primary pointer is not coarse, the input without the Tab stop is
// aria-hidden (Task C8).
const saturationInput = () => screen.getByRole('slider', { name: 'Saturation', hidden: true });
const brightnessInput = () => screen.getByRole('slider', { name: 'Brightness', hidden: true });

describe('ColorArea', () => {
  testSystemProps(ColorArea, {
    expectedTag: 'div',
    displayName: 'ColorArea',
    defaultProps: { 'aria-label': 'Accent' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'in a form', props: { name: 'accent', required: true } },
      { name: 'square', props: { shape: 'square' } },
    ],
  });

  it('is a group of two range inputs, "Saturation" and "Brightness", described as a 2D slider', () => {
    render(<ColorArea aria-label="Accent" defaultValue={DARK_BLUE} />);
    const saturation = saturationInput();
    const brightness = brightnessInput();
    expect(group()).toContainElement(saturation);
    expect(saturation).toHaveValue('72');
    expect(brightness).toHaveValue('40');
    expect(saturation).toHaveAttribute('aria-roledescription', '2D slider');
    expect(brightness).toHaveAttribute('aria-roledescription', '2D slider');
    expect(brightness).toHaveAttribute('aria-orientation', 'vertical');
    expect(saturation).not.toHaveAttribute('aria-orientation');
    expect(saturation).toHaveAttribute(
      'aria-valuetext',
      'Saturation 72%, Brightness 40%, dark blue',
    );
    expect(brightness).toHaveAttribute(
      'aria-valuetext',
      'Brightness 40%, Saturation 72%, dark blue',
    );
  });

  it('draws the field from --wave-color-area-gradient and places the thumb by saturation and brightness', () => {
    render(<ColorArea aria-label="Accent" defaultValue={{ h: 208, s: 0.25, v: 0.75 }} />);
    const root = group();
    expect(root.style.getPropertyValue('--wave-color-area-gradient')).toBe(
      'linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, #0088ff)',
    );
    expect(root.style.getPropertyValue('--wave-color-area-x')).toBe('25%');
    expect(root.style.getPropertyValue('--wave-color-area-y')).toBe('75%');
    expect(root.style.getPropertyValue('--wave-color-thumb')).toBe(
      hsvToHex({ h: 208, s: 0.25, v: 0.75 }),
    );
    const field = root.querySelector(`.${colorAreaClassNames.field}`);
    expect(field).toHaveAttribute('aria-hidden', 'true');
    expect(field).toHaveClass(
      'bg-(image:--wave-color-area-gradient)',
      'wave-rtl:-scale-x-100',
      'forced-colors:forced-color-adjust-none',
    );
    expect(root.querySelector(`.${colorAreaClassNames.thumb}`)).toHaveClass(
      'size-6',
      'start-(--wave-color-area-x)',
      'bottom-(--wave-color-area-y)',
      'group-has-[:focus-visible]/color-area:outline-ring',
      'group-has-[:focus-visible]/color-area:ring-background',
    );
    expect(root).toHaveClass('group/color-area', 'touch-none', 'rounded');
  });

  it('shape="square" removes the corner radius', () => {
    render(<ColorArea aria-label="Accent" shape="square" />);
    expect(group()).toHaveClass('rounded-none');
    expect(group()).not.toHaveClass('rounded');
  });

  describe('keyboard (D19)', () => {
    it.each([
      ['{ArrowRight}', { s: 0.51 }],
      ['{ArrowLeft}', { s: 0.49 }],
      ['{Shift>}{ArrowRight}{/Shift}', { s: 0.6 }],
      ['{Home}', { s: 0 }],
      ['{End}', { s: 1 }],
      ['{ArrowUp}', { v: 0.51 }],
      ['{ArrowDown}', { v: 0.49 }],
      ['{Shift>}{ArrowDown}{/Shift}', { v: 0.4 }],
      ['{PageUp}', { v: 0.6 }],
      ['{PageDown}', { v: 0.4 }],
    ])('%s changes %o', async (keys, change) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />);
      act(() => saturationInput().focus());
      await user.keyboard(keys);
      expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, ...change }]]);
    });

    it('moves focus and the one Tab stop to the input of the axis that changed', async () => {
      const user = userEvent.setup();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} />);
      expect(saturationInput()).toHaveAttribute('tabindex', '0');
      expect(brightnessInput()).toHaveAttribute('tabindex', '-1');
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowUp}');
      expect(brightnessInput()).toHaveFocus();
      expect(brightnessInput()).toHaveAttribute('tabindex', '0');
      expect(saturationInput()).toHaveAttribute('tabindex', '-1');
      await user.keyboard('{ArrowLeft}');
      expect(saturationInput()).toHaveFocus();
      expect(saturationInput()).toHaveAttribute('tabindex', '0');
    });

    it('is one Tab stop', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <ColorArea aria-label="Accent" />
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      await user.tab();
      expect(saturationInput()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('mirrors the saturation arrows in right-to-left layouts', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />,
        { dir: 'rtl' },
      );
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowLeft}');
      expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, s: 0.51 }]]);
    });

    it('a key at the end of an axis changes and reports nothing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorArea
          aria-label="Accent"
          defaultValue={{ h: 0, s: 1, v: 1 }}
          onValueChange={onValueChange}
        />,
      );
      act(() => saturationInput().focus());
      await user.keyboard('{End}{ArrowRight}');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('leaves browser shortcuts alone: Alt, Ctrl or Meta with a key is neither handled nor prevented', () => {
      const onValueChange = vi.fn();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />);
      const input = saturationInput();
      expect(fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'Home', ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'ArrowUp', metaKey: true })).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("runs the consumer's onKeyDown first; preventDefault() keeps the color", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorArea
          aria-label="Accent"
          defaultValue={MIDDLE}
          onValueChange={onValueChange}
          onKeyDown={(event) => event.preventDefault()}
        />,
      );
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  it('applies the change events assistive technology sends, and gives that input the Tab stop', () => {
    const onValueChange = vi.fn();
    render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />);
    fireEvent.change(brightnessInput(), { target: { value: '80' } });
    expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, v: 0.8 }]]);
    expect(brightnessInput()).toHaveAttribute('tabindex', '0');
  });

  describe('value texts and labels (D22)', () => {
    it('labels rename the sliders and their role description, colorName replaces the namer, valueText the whole text', () => {
      render(
        <ColorArea
          aria-label="Accent"
          defaultValue={DARK_BLUE}
          labels={{
            saturation: 'Sättigung',
            brightness: 'Helligkeit',
            roleDescription: '2D-Regler',
            colorName: () => 'dunkelblau',
            valueText: (color, channel) => `${channel} ${Math.round(color.v * 100)}`,
          }}
        />,
      );
      const saturation = screen.getByRole('slider', { name: 'Sättigung', hidden: true });
      const brightness = screen.getByRole('slider', { name: 'Helligkeit', hidden: true });
      expect(saturation).toHaveAttribute('aria-roledescription', '2D-Regler');
      expect(saturation).toHaveAttribute('aria-valuetext', 'saturation 40');
      expect(brightness).toHaveAttribute('aria-valuetext', 'value 40');
    });

    it("colorName returning '' drops the name", () => {
      render(
        <ColorArea aria-label="Accent" defaultValue={DARK_BLUE} labels={{ colorName: () => '' }} />,
      );
      expect(saturationInput()).toHaveAttribute('aria-valuetext', 'Saturation 72%, Brightness 40%');
    });
  });

  describe('naming and routing (C-ROUTING)', () => {
    it('the Field label names the group and the Field hint describes it', () => {
      renderWithFieldContext(<ColorArea />, { hintId: FIELD_TEST_IDS.hintId });
      const root = screen.getByRole('group', { name: FIELD_TEST_TEXT.label });
      expect(root).toHaveAccessibleDescription(FIELD_TEST_TEXT.hint);
    });

    it('without a name the group has none (the sliders are named)', () => {
      render(<ColorArea />);
      expect(screen.getByRole('group')).not.toHaveAccessibleName();
      expect(saturationInput()).toHaveAccessibleName('Saturation');
    });

    it('puts aria-invalid and aria-errormessage on both inputs, never on the group', () => {
      render(
        <>
          <ColorArea aria-label="Accent" aria-invalid aria-errormessage="accent-error" />
          <span id="accent-error">Pick a darker color.</span>
        </>,
      );
      expect(group()).not.toHaveAttribute('aria-invalid');
      expect(group()).not.toHaveAttribute('aria-errormessage');
      for (const input of [saturationInput(), brightnessInput()]) {
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-errormessage', 'accent-error');
      }
    });

    it('takes the invalid state of a surrounding Field on both inputs', () => {
      renderWithFieldContext(<ColorArea />, { errorId: FIELD_TEST_IDS.errorId });
      expect(saturationInput()).toHaveAttribute('aria-invalid', 'true');
      expect(brightnessInput()).toHaveAttribute('aria-invalid', 'true');
    });

    it('routes controlRef and autoFocus to the saturation input and tabIndex to the Tab stop', () => {
      const controlRef = React.createRef<HTMLInputElement>();
      render(<ColorArea aria-label="Accent" controlRef={controlRef} autoFocus tabIndex={-1} />);
      expect(controlRef.current).toBe(saturationInput());
      expect(saturationInput()).toHaveFocus();
      expect(saturationInput()).toHaveAttribute('tabindex', '-1');
      expect(brightnessInput()).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('forms (C-FORMS)', () => {
    it('submits the color as hex under its name; a form reset restores defaultValue', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <form aria-label="Form">
          <ColorArea
            aria-label="Accent"
            name="accent"
            defaultValue={{ h: 0, s: 1, v: 1 }}
            onValueChange={onValueChange}
          />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(new FormData(form).get('accent')).toBe('#ff0000');
      act(() => saturationInput().focus());
      await user.keyboard('{Home}');
      expect(new FormData(form).get('accent')).toBe('#ffffff');
      act(() => form.reset());
      expect(new FormData(form).get('accent')).toBe('#ff0000');
      expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 0, v: 1 }], [{ h: 0, s: 1, v: 1 }]]);
    });

    it('required and aria-required make the hidden input required; the inputs never are', () => {
      const { container } = render(
        <form aria-label="Form">
          <ColorArea aria-label="Accent" aria-required />
        </form>,
      );
      expect(group()).not.toHaveAttribute('aria-required');
      expect(saturationInput()).not.toBeRequired();
      expect(container.querySelectorAll('input[required]')).toHaveLength(1);
    });

    it('adds nothing to the form without name or required', () => {
      render(
        <form aria-label="Form">
          <ColorArea aria-label="Accent" />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
    });
  });

  it('disabled: both inputs disabled, data-disabled on the group, keys ignored', () => {
    const onValueChange = vi.fn();
    render(<ColorArea aria-label="Accent" disabled onValueChange={onValueChange} />);
    expect(group()).toHaveAttribute('data-disabled', '');
    expect(saturationInput()).toBeDisabled();
    expect(brightnessInput()).toBeDisabled();
    fireEvent.keyDown(saturationInput(), { key: 'ArrowRight' });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows an out-of-range or non-finite color clamped, steps from there and writes no NaN', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorArea
        aria-label="Accent"
        value={{ h: 720, s: 1.5, v: Number.NaN }}
        onValueChange={onValueChange}
      />,
    );
    expect(saturationInput()).toHaveValue('100');
    expect(brightnessInput()).toHaveValue('0');
    expect(group().getAttribute('style')).not.toMatch(/NaN/);
    act(() => saturationInput().focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith({ h: 720, s: 0.99, v: Number.NaN });
  });

  it('keeps a controlled value whose parent ignores onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorArea aria-label="Accent" value={MIDDLE} onValueChange={onValueChange} />);
    act(() => saturationInput().focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, s: 0.51 }], [{ ...MIDDLE, s: 0.51 }]]);
    expect(saturationInput()).toHaveValue('50');
  });

  it('reports each change once in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    act(() => saturationInput().focus());
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  describe('inside a ColorPicker (bound)', () => {
    it("reads and writes the working color, is named by labels.area, takes the picker's shape and renders no hidden input", async () => {
      const user = userEvent.setup();
      const onHsvChange = vi.fn();
      const { container } = render(
        <form aria-label="Form">
          <PickerHarness initial={MIDDLE} shape="square" onHsvChange={onHsvChange}>
            <ColorArea name="ignored" />
          </PickerHarness>
        </form>,
      );
      const root = group('Saturation and brightness');
      expect(root).toHaveClass('rounded-none');
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowRight}');
      expect(onHsvChange.mock.calls).toEqual([[{ ...MIDDLE, s: 0.51 }]]);
      expect(saturationInput()).toHaveValue('51');
      expect(container.querySelector('input[name="ignored"]')).toBeNull();
    });
  });

  it('renders on the server and hydrates without warnings', () => {
    const ui = <ColorArea aria-label="Accent" defaultValue={DARK_BLUE} />;
    const html = renderToString(ui);
    expect(html).toContain('--wave-color-area-gradient');
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

  it('types: an HsvColor value and the ColorPicker shapes', () => {
    expectTypeOf<ColorAreaProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorAreaProps['onValueChange']>().toEqualTypeOf<
      ((value: HsvColor) => void) | undefined
    >();
    // @ts-expect-error a color part is rounded or square
    const circular = <ColorArea shape="circular" />;
    expect(circular).toBeTruthy();
  });
});
