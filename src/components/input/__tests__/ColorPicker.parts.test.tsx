import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { DEFAULT_PART_COLOR, useColorPartState } from '../ColorPicker.parts';
import { PickerHarness } from './colorPartHarness';
import {
  ColorPicker,
  ColorPickerHexField,
  ColorPickerPreview,
  ColorPickerSwatches,
} from '../ColorPicker';
import {
  colorPickerHexFieldClassNames,
  colorPickerPreviewClassNames,
  colorPickerSwatchesClassNames,
  swatchPickerClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectThrows,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';

function inPicker(props: { disabled?: boolean } = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PickerHarness initial={{ h: 120, s: 0.5, v: 0.5 }} disabled={props.disabled}>
        {children}
      </PickerHarness>
    );
  };
}

describe('useColorPartState (the binding rule, D21)', () => {
  it('binds to an enclosing picker without value and defaultValue, and still reports to onValueChange', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: undefined,
          onValueChange,
          disabled: false,
        }),
      { wrapper: inPicker() },
    );
    expect(result.current.picker).not.toBeNull();
    expect(result.current.color).toEqual({ h: 120, s: 0.5, v: 0.5 });
    act(() => result.current.setColor({ h: 120, s: 0.8, v: 0.5 }));
    expect(result.current.color).toEqual({ h: 120, s: 0.8, v: 0.5 });
    expect(onValueChange.mock.calls).toEqual([[{ h: 120, s: 0.8, v: 0.5 }]]);
  });

  it('stays independent with its own defaultValue inside a picker', () => {
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: { h: 10, s: 1, v: 1 },
          onValueChange: undefined,
          disabled: false,
        }),
      { wrapper: inPicker() },
    );
    expect(result.current.picker).toBeNull();
    expect(result.current.color).toEqual({ h: 10, s: 1, v: 1 });
  });

  it('keeps its own state outside a picker, starting from the brand blue', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useColorPartState({
        value: undefined,
        defaultValue: undefined,
        onValueChange,
        disabled: false,
      }),
    );
    expect(result.current.picker).toBeNull();
    expect(result.current.color).toBe(DEFAULT_PART_COLOR);
    act(() => result.current.setColor({ h: 0, s: 1, v: 1 }));
    expect(result.current.color).toEqual({ h: 0, s: 1, v: 1 });
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1 }]]);
  });

  it("takes the picker's disabled state while bound", () => {
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: undefined,
          onValueChange: undefined,
          disabled: false,
        }),
      { wrapper: inPicker({ disabled: true }) },
    );
    expect(result.current.disabled).toBe(true);
  });

  it('reset restores defaultValue and reports only a real change (a new but equal object is none)', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useColorPartState({
        value: undefined,
        defaultValue: { h: 10, s: 1, v: 1 },
        onValueChange,
        disabled: false,
      }),
    );
    act(() => result.current.reset());
    expect(onValueChange).not.toHaveBeenCalled();
    act(() => result.current.setColor({ h: 20, s: 1, v: 1 }));
    act(() => result.current.reset());
    expect(onValueChange.mock.calls).toEqual([[{ h: 20, s: 1, v: 1 }], [{ h: 10, s: 1, v: 1 }]]);
  });
});

function InPicker({ children }: { children: React.ReactNode }) {
  return <ColorPicker aria-label="Accent">{children}</ColorPicker>;
}

const hexInput = () => screen.getByRole('textbox', { name: 'Hex color value' });

describe('ColorPicker parts (D21)', () => {
  testCompoundExposure(ColorPicker, ['HexField', 'Swatches', 'Preview']);

  it('exports every part under its flat name (C-COMPOUND)', () => {
    expect(ColorPickerHexField).toBe(ColorPicker.HexField);
    expect(ColorPickerSwatches).toBe(ColorPicker.Swatches);
    expect(ColorPickerPreview).toBe(ColorPicker.Preview);
  });

  it('renders the same with the parts as Server Component references', () => {
    const HexField = asClientReference(ColorPicker.HexField);
    const Swatches = asClientReference(ColorPicker.Swatches);
    const Preview = asClientReference(ColorPicker.Preview);
    const plain = renderToString(
      <ColorPicker aria-label="Accent">
        <ColorPicker.Preview />
        <ColorPicker.HexField />
        <ColorPicker.Swatches />
      </ColorPicker>,
    );
    const lazy = renderToString(
      <ColorPicker aria-label="Accent">
        <Preview />
        <HexField />
        <Swatches />
      </ColorPicker>,
    );
    expect(lazy).toBe(plain);
  });

  it.each([
    ['ColorPicker.HexField', <ColorPicker.HexField key="hex" />],
    ['ColorPicker.Swatches', <ColorPicker.Swatches key="swatches" />],
    ['ColorPicker.Preview', <ColorPicker.Preview key="preview" />],
  ])('%s outside a ColorPicker throws in development (C-CONTEXT)', (name, ui) => {
    expectThrows(ui, `[WaveUI] ${name} must be used within <ColorPicker>`);
  });

  describe('ColorPicker.HexField', () => {
    testSystemProps(ColorPicker.HexField, {
      expectedTag: 'label',
      displayName: 'ColorPickerHexField',
      control: { role: 'textbox' },
      wrapper: InPicker,
    });

    it('routes id, the labelling aria-*, autoFocus, tabIndex, focus handlers and controlRef to the input', () => {
      const controlRef = React.createRef<HTMLInputElement>();
      const onFocus = vi.fn();
      render(
        <>
          <ColorPicker aria-label="Accent">
            <ColorPicker.HexField
              id="accent-hex"
              aria-describedby="accent-note"
              tabIndex={-1}
              autoFocus
              onFocus={onFocus}
              controlRef={controlRef}
              className="custom-field"
              data-testid="field"
            />
          </ColorPicker>
          <span id="accent-note">Six digits</span>
        </>,
      );
      const input = hexInput();
      expect(controlRef.current).toBe(input);
      expect(input).toHaveAttribute('id', 'accent-hex');
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input).toHaveAccessibleDescription('Six digits');
      expect(input).toHaveFocus();
      expect(onFocus).toHaveBeenCalledTimes(1);
      const field = screen.getByTestId('field');
      expect(field.tagName).toBe('LABEL');
      expect(field).toHaveClass(colorPickerHexFieldClassNames.root, 'custom-field');
      expect(field).not.toHaveAttribute('id');
    });

    it('a consumer aria-label names the input instead of labels.hexInput', () => {
      render(
        <ColorPicker aria-label="Accent">
          <ColorPicker.HexField aria-label="Farbe (hex)" />
        </ColorPicker>,
      );
      expect(screen.getByRole('textbox', { name: 'Farbe (hex)' })).toBeInTheDocument();
    });

    it('carries its part classes on the caption, the input and the error', async () => {
      const user = userEvent.setup();
      render(
        <ColorPicker aria-label="Accent">
          <ColorPicker.HexField />
        </ColorPicker>,
      );
      expect(screen.getByText('Hex')).toHaveClass(colorPickerHexFieldClassNames.label);
      expect(hexInput()).toHaveClass(colorPickerHexFieldClassNames.input);
      await user.tripleClick(hexInput());
      await user.keyboard('#zzz');
      expect(screen.getByText('Enter a hex color such as #0f6cbd.')).toHaveClass(
        colorPickerHexFieldClassNames.errorMessage,
      );
    });

    it('drops a flagged draft on a form reset (0.7 rule)', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Form">
          <ColorPicker aria-label="Accent" defaultValue="#0f6cbd">
            <ColorPicker.HexField />
          </ColorPicker>
        </form>,
      );
      await user.tripleClick(hexInput());
      await user.keyboard('#zzz');
      await user.tab();
      expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
      act(() => (screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).reset());
      expect(hexInput()).toHaveValue('#0f6cbd');
      expect(hexInput()).not.toHaveAttribute('aria-invalid');
    });

    it('drops a flagged draft on a preset pick (0.7 rule)', async () => {
      const user = userEvent.setup();
      render(
        <ColorPicker aria-label="Accent" defaultValue="#0f6cbd">
          <ColorPicker.HexField />
          <ColorPicker.Swatches />
        </ColorPicker>,
      );
      await user.tripleClick(hexInput());
      await user.keyboard('#zzz');
      await user.tab();
      await user.click(screen.getByRole('radio', { name: 'Red' }));
      expect(hexInput()).toHaveValue('#d13438');
      expect(hexInput()).not.toHaveAttribute('aria-invalid');
    });

    it('drops a flagged draft when the value changes from outside (0.7 rule)', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ColorPicker aria-label="Accent" value="#0f6cbd" onValueChange={() => {}}>
          <ColorPicker.HexField />
        </ColorPicker>,
      );
      await user.tripleClick(hexInput());
      await user.keyboard('#12345');
      await user.tab();
      expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
      rerender(
        <ColorPicker aria-label="Accent" value="#107c10" onValueChange={() => {}}>
          <ColorPicker.HexField />
        </ColorPicker>,
      );
      expect(hexInput()).toHaveValue('#107c10');
      expect(hexInput()).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('ColorPicker.Swatches', () => {
    testSystemProps(ColorPicker.Swatches, {
      expectedTag: 'div',
      displayName: 'ColorPickerSwatches',
      wrapper: InPicker,
    });

    it("renders the picker's presets as a SwatchPicker with both classes; picking keeps the opacity", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorPicker aria-label="Accent" defaultValue="#ff000080" onValueChange={onValueChange}>
          <ColorPicker.Swatches />
        </ColorPicker>,
      );
      const swatches = screen.getByRole('radiogroup', { name: 'Preset colors' });
      expect(swatches).toHaveClass(colorPickerSwatchesClassNames.root, swatchPickerClassNames.root);
      await user.click(screen.getByRole('radio', { name: 'Blue' }));
      expect(onValueChange).toHaveBeenLastCalledWith('#0f6cbd80');
    });

    it('takes SwatchPicker props (a name, a size) and renders nothing without presets', () => {
      const { rerender } = render(
        <ColorPicker aria-label="Accent">
          <ColorPicker.Swatches aria-label="Brand colors" size="large" />
        </ColorPicker>,
      );
      const swatches = screen.getByRole('radiogroup', { name: 'Brand colors' });
      expect(swatches.querySelector('[role="radio"]')).toHaveClass('w-10', 'h-10');
      rerender(
        <ColorPicker aria-label="Accent" presets={[]}>
          <ColorPicker.Swatches />
        </ColorPicker>,
      );
      expect(screen.queryByRole('radiogroup')).toBeNull();
    });
  });

  describe('ColorPicker.Preview', () => {
    testSystemProps(ColorPicker.Preview, {
      expectedTag: 'div',
      displayName: 'ColorPickerPreview',
      wrapper: InPicker,
    });

    it('shows the current color, is decorative, keeps its color in forced colors and follows the shape', () => {
      const { container } = render(
        <ColorPicker aria-label="Accent" defaultValue="#0f6cbd80" shape="square">
          <ColorPicker.Preview />
        </ColorPicker>,
      );
      const preview = container.querySelector<HTMLElement>('[data-color-preview]') as HTMLElement;
      expect(preview).toHaveClass(
        colorPickerPreviewClassNames.root,
        'rounded-none',
        'forced-colors:forced-color-adjust-none',
      );
      expect(preview).toHaveAttribute('aria-hidden', 'true');
      expect(preview).toHaveStyle({ backgroundColor: 'rgba(15, 108, 189, 0.5)' });
    });
  });
});
