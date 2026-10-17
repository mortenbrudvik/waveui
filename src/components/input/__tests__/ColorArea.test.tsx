import * as React from 'react';
import {
  describe,
  it,
  expect,
  expectTypeOf,
  vi,
  afterEach,
  beforeEach,
  onTestFinished,
} from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { ColorArea, type ColorAreaProps } from '../ColorArea';
import { colorAreaClassNames } from '../../../lib/classNames';
import { hsvToHex } from '../../../lib/color';
import type { HsvColor } from '../../../lib/types';
import {
  mockMatchMedia,
  mockRect,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { PickerHarness } from './colorPartHarness';

const DARK_BLUE: HsvColor = { h: 220, s: 0.72, v: 0.4 };
const MIDDLE: HsvColor = { h: 100, s: 0.5, v: 0.5 };
const group = (name = 'Accent') => screen.getByRole('group', { name });
// `hidden: true`: where the primary pointer is not coarse, the input without the Tab stop is
// aria-hidden (Task C8). `name` is a matcher function, not a string: `dom-accessibility-api`
// always computes the accessible name of a self-`aria-hidden` element as `''` (it never receives
// this query's `hidden: true`, which only lifts the later accessibility-tree filter), so the
// matcher reads the raw `aria-label` attribute instead — the same value while it is exposed.
const sliderNamed = (label: string) =>
  screen.getByRole('slider', {
    hidden: true,
    name: (_accessibleName, element) => element.getAttribute('aria-label') === label,
  });
const saturationInput = () => sliderNamed('Saturation');
const brightnessInput = () => sliderNamed('Brightness');

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
      'forced-colors:group-has-[:focus-visible]/color-area:ring-[Canvas]',
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

    it('mirrors the saturation arrows in right-to-left layouts; the vertical arrow is unaffected', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />,
        { dir: 'rtl' },
      );
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowLeft}');
      expect(onValueChange).toHaveBeenLastCalledWith({ ...MIDDLE, s: 0.51 });
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).toHaveBeenLastCalledWith(MIDDLE);
      await user.keyboard('{ArrowUp}');
      expect(onValueChange).toHaveBeenLastCalledWith({ ...MIDDLE, v: 0.51 });
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

  it('an assistive-technology change on the unfocused input moves the Tab stop, not focus', () => {
    const onValueChange = vi.fn();
    render(
      <>
        <button type="button">Elsewhere</button>
        <ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    act(() => elsewhere.focus());
    fireEvent.change(brightnessInput(), { target: { value: '80' } });
    expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, v: 0.8 }]]);
    expect(brightnessInput()).toHaveAttribute('tabindex', '0');
    expect(saturationInput()).toHaveAttribute('tabindex', '-1');
    expect(elsewhere).toHaveFocus();
  });

  it('a key on the axis of an earlier assistive-technology change moves focus there', () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <ColorArea aria-label="Accent" defaultValue={MIDDLE} />
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    act(() => elsewhere.focus());
    fireEvent.change(brightnessInput(), { target: { value: '80' } });
    expect(elsewhere).toHaveFocus();
    fireEvent.keyDown(brightnessInput(), { key: 'ArrowUp' });
    expect(brightnessInput()).toHaveFocus();
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
      const saturation = sliderNamed('Sättigung');
      const brightness = sliderNamed('Helligkeit');
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

    it('leaves aria-errormessage off both inputs while the area is not invalid', () => {
      render(
        <>
          <ColorArea aria-label="Accent" aria-errormessage="accent-error" />
          <span id="accent-error">Pick a darker color.</span>
        </>,
      );
      expect(saturationInput()).not.toHaveAttribute('aria-errormessage');
      expect(brightnessInput()).not.toHaveAttribute('aria-errormessage');
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

    it('a disabled part submits nothing; enabled it still submits the hex', () => {
      const { unmount } = render(
        <form aria-label="Form">
          <ColorArea
            aria-label="Accent"
            name="accent"
            defaultValue={{ h: 0, s: 1, v: 1 }}
            disabled
          />
        </form>,
      );
      expect(
        new FormData(screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).get('accent'),
      ).toBeNull();
      unmount();

      render(
        <form aria-label="Form">
          <ColorArea aria-label="Accent" name="accent" defaultValue={{ h: 0, s: 1, v: 1 }} />
        </form>,
      );
      expect(
        new FormData(screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).get('accent'),
      ).toBe('#ff0000');
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

  describe('pointer (D19)', () => {
    const CAPTURE_METHODS = [
      'setPointerCapture',
      'releasePointerCapture',
      'hasPointerCapture',
    ] as const;
    let saved: Array<[string, PropertyDescriptor | undefined]> = [];

    beforeEach(() => {
      // jsdom has no pointer capture: a stand-in that remembers the captured pointer ids.
      const captured = new WeakMap<Element, Set<number>>();
      saved = CAPTURE_METHODS.map((name) => [
        name,
        Object.getOwnPropertyDescriptor(Element.prototype, name),
      ]);
      Object.defineProperties(Element.prototype, {
        setPointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            const ids = captured.get(this) ?? new Set<number>();
            ids.add(pointerId);
            captured.set(this, ids);
          },
        },
        releasePointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            captured.get(this)?.delete(pointerId);
          },
        },
        hasPointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            return captured.get(this)?.has(pointerId) ?? false;
          },
        },
      });
    });

    afterEach(() => {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
        else Reflect.deleteProperty(Element.prototype, name);
      }
    });

    function renderArea(props: Partial<ColorAreaProps> = {}, dir?: 'rtl') {
      const onValueChange = vi.fn();
      const ui = (
        <ColorArea
          aria-label="Accent"
          defaultValue={MIDDLE}
          onValueChange={onValueChange}
          {...props}
        />
      );
      if (dir) renderWithProviders(ui, { dir });
      else render(ui);
      const root = group();
      mockRect(root.querySelector(`.${colorAreaClassNames.field}`) as Element, {
        left: 0,
        top: 0,
        width: 200,
        height: 100,
      });
      return { root, onValueChange };
    }

    it.each(['mouse', 'touch', 'pen'])(
      'a %s press jumps the thumb to the point, focuses the Tab stop and drags while captured',
      (pointerType) => {
        const { root, onValueChange } = renderArea();
        fireEvent.pointerDown(root, {
          pointerId: 1,
          button: 0,
          isPrimary: true,
          pointerType,
          clientX: 50,
          clientY: 25,
        });
        expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 0.25, v: 0.75 });
        expect(saturationInput()).toHaveFocus();
        expect(root.hasPointerCapture(1)).toBe(true);
        fireEvent.pointerMove(root, { pointerId: 1, pointerType, clientX: 100, clientY: 50 });
        expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 0.5, v: 0.5 });
        root.releasePointerCapture(1);
        fireEvent.pointerMove(root, { pointerId: 1, pointerType, clientX: 150, clientY: 0 });
        expect(onValueChange).toHaveBeenCalledTimes(2);
      },
    );

    it('clamps a drag outside the field to its edges', () => {
      const { root, onValueChange } = renderArea();
      fireEvent.pointerDown(root, {
        pointerId: 1,
        button: 0,
        isPrimary: true,
        clientX: 50,
        clientY: 50,
      });
      fireEvent.pointerMove(root, { pointerId: 1, clientX: 300, clientY: -20 });
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 1, v: 1 });
    });

    it('mirrors the x axis in right-to-left layouts', () => {
      const { root, onValueChange } = renderArea({}, 'rtl');
      fireEvent.pointerDown(root, {
        pointerId: 1,
        button: 0,
        isPrimary: true,
        clientX: 50,
        clientY: 25,
      });
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 0.75, v: 0.75 });
    });

    it('focuses the input that has the Tab stop (brightness after an ArrowUp)', async () => {
      const user = userEvent.setup();
      const { root } = renderArea();
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowUp}');
      expect(brightnessInput()).toHaveFocus();
      // Focus must leave the area before the press, or the assertion below would hold even
      // without the press moving it (the ArrowUp above already focused brightnessInput).
      act(() => brightnessInput().blur());
      expect(brightnessInput()).not.toHaveFocus();
      fireEvent.pointerDown(root, {
        pointerId: 1,
        button: 0,
        isPrimary: true,
        clientX: 10,
        clientY: 10,
      });
      expect(brightnessInput()).toHaveFocus();
    });

    it.each(['mouse', 'touch', 'pen'])(
      'a %s press focuses the Tab stop without a focus ring (focusVisible: false); a key keeps it',
      async (pointerType) => {
        const user = userEvent.setup();
        const { root } = renderArea();
        const focus = vi.spyOn(HTMLInputElement.prototype, 'focus');
        onTestFinished(() => focus.mockRestore());
        fireEvent.pointerDown(root, {
          pointerId: 1,
          button: 0,
          isPrimary: true,
          pointerType,
          clientX: 50,
          clientY: 25,
        });
        expect(saturationInput()).toHaveFocus();
        expect(focus.mock.calls).toEqual([[{ preventScroll: true, focusVisible: false }]]);
        focus.mockClear();
        // A key moves focus by script too, and keeps the ring the browser gives it.
        await user.keyboard('{ArrowUp}');
        expect(brightnessInput()).toHaveFocus();
        expect(focus.mock.calls).toEqual([[{ preventScroll: true }]]);
      },
    );

    it('ignores a secondary button', () => {
      const secondary = renderArea();
      fireEvent.pointerDown(secondary.root, {
        pointerId: 1,
        button: 2,
        isPrimary: true,
        clientX: 50,
        clientY: 25,
      });
      expect(secondary.onValueChange).not.toHaveBeenCalled();
    });

    it('ignores a second (non-primary) finger', () => {
      const { root, onValueChange } = renderArea();
      fireEvent.pointerDown(root, {
        pointerId: 2,
        button: 0,
        isPrimary: false,
        pointerType: 'touch',
        clientX: 50,
        clientY: 25,
      });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(root.hasPointerCapture(2)).toBe(false);
      // The default axis (saturation) is what the press would have focused, had it not been
      // ignored.
      expect(saturationInput()).not.toHaveFocus();
    });

    it('ignores a press the consumer prevented', () => {
      const { root, onValueChange } = renderArea({
        onPointerDown: (event) => event.preventDefault(),
      });
      fireEvent.pointerDown(root, {
        pointerId: 1,
        button: 0,
        isPrimary: true,
        clientX: 50,
        clientY: 25,
      });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(root.hasPointerCapture(1)).toBe(false);
    });

    it('ignores presses while disabled', () => {
      const { root, onValueChange } = renderArea({ disabled: true });
      fireEvent.pointerDown(root, {
        pointerId: 1,
        button: 0,
        isPrimary: true,
        clientX: 50,
        clientY: 25,
      });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(root.hasPointerCapture(1)).toBe(false);
    });
  });

  describe('exposure: one slider unless the primary pointer is coarse (D19)', () => {
    it('hides the input without the Tab stop from assistive technology, following the Tab stop', async () => {
      const user = userEvent.setup();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} />);
      expect(screen.getAllByRole('slider')).toEqual([saturationInput()]);
      expect(brightnessInput()).toHaveAttribute('aria-hidden', 'true');
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowUp}');
      expect(screen.getAllByRole('slider')).toEqual([brightnessInput()]);
      expect(saturationInput()).toHaveAttribute('aria-hidden', 'true');
      expect(brightnessInput()).not.toHaveAttribute('aria-hidden');
    });

    it('exposes both inputs on a coarse (touch) primary pointer, still with one Tab stop', () => {
      mockMatchMedia({ '(pointer: coarse)': true });
      render(<ColorArea aria-label="Accent" />);
      expect(screen.getAllByRole('slider')).toHaveLength(2);
      expect(brightnessInput()).not.toHaveAttribute('aria-hidden');
      expect(brightnessInput()).toHaveAttribute('tabindex', '-1');
    });

    it('follows a change of the primary pointer', () => {
      const restore = mockMatchMedia({ '(pointer: coarse)': true });
      render(<ColorArea aria-label="Accent" />);
      expect(screen.getAllByRole('slider')).toHaveLength(2);
      restore();
      expect(screen.getAllByRole('slider')).toHaveLength(1);
    });
  });

  function hydrate(ui: React.ReactElement, before?: () => void) {
    const html = renderToString(ui);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    before?.();
    const error = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    return {
      html,
      container,
      run(check: () => void) {
        try {
          act(() => {
            root = hydrateRoot(container, ui);
          });
          expect(error).not.toHaveBeenCalled();
          check();
        } finally {
          act(() => root?.unmount());
          container.remove();
          error.mockRestore();
        }
      },
    };
  }

  it('renders the one-slider model on the server and hydrates without warnings', () => {
    const server = hydrate(<ColorArea aria-label="Accent" defaultValue={DARK_BLUE} />);
    expect(server.html).toContain('--wave-color-area-gradient');
    expect(server.container.querySelector('input[aria-label="Brightness"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    server.run(() => {
      expect(server.container.querySelector('input[aria-label="Brightness"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });
  });

  it('hydrates on a coarse pointer without warnings and exposes both inputs afterwards', () => {
    const server = hydrate(<ColorArea aria-label="Accent" />, () => {
      mockMatchMedia({ '(pointer: coarse)': true });
    });
    server.run(() => {
      expect(server.container.querySelector('input[aria-label="Brightness"]')).not.toHaveAttribute(
        'aria-hidden',
      );
    });
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
