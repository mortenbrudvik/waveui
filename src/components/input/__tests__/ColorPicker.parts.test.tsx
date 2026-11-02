import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { DEFAULT_PART_COLOR, useColorPartState } from '../ColorPicker.parts';
import { ColorSlider } from '../ColorSlider';
import { PickerHarness } from './colorPartHarness';
import {
  ColorPicker,
  ColorPickerHexField,
  ColorPickerPreview,
  ColorPickerSwatches,
  type ColorPickerHexFieldProps,
  type ColorPickerProps,
} from '../ColorPicker';
import {
  colorPickerHexFieldClassNames,
  colorPickerPreviewClassNames,
  colorPickerSwatchesClassNames,
  swatchPickerClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  expectThrows,
  openingTags,
  testCompoundExposure,
  testRootPartRef,
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

/** React's development error for an unknown prop that reaches a DOM element, as logged. */
const UNKNOWN_PROP = (name: string) => [
  'React does not recognize the `%s` prop on a DOM element. If you intentionally want it to ' +
    'appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you ' +
    'accidentally passed it from a parent component, remove it from the DOM element.',
  name,
  name.toLowerCase(),
];

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
      ref: 'control',
      control: { role: 'textbox', tag: 'input' },
      wrapper: InPicker,
    });

    testRootPartRef(ColorPicker.HexField, { wrapper: InPicker });

    it('routes id, the labelling aria-*, autoFocus, tabIndex, focus handlers and ref to the input', () => {
      const ref = React.createRef<HTMLInputElement>();
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
              ref={ref}
              className="custom-field"
              data-testid="field"
            />
          </ColorPicker>
          <span id="accent-note">Six digits</span>
        </>,
      );
      const input = hexInput();
      expect(ref.current).toBe(input);
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

describe('ColorPicker.HexField — slotProps', () => {
  type HexFieldSlotProps = NonNullable<ColorPickerHexFieldProps['slotProps']>;
  const EVERY_PART: HexFieldSlotProps = { root: {}, label: {}, input: {}, errorMessage: {} };
  const ERROR_TEXT = 'Enter a hex color such as #0f6cbd.';
  const parts = (root: ParentNode) =>
    [
      colorPickerHexFieldClassNames.root,
      colorPickerHexFieldClassNames.label,
      colorPickerHexFieldClassNames.input,
      colorPickerHexFieldClassNames.errorMessage,
    ].flatMap((name) => Array.from(root.querySelectorAll(`.${name}`)));
  const inPicker = (field: React.ReactElement, props: Partial<ColorPickerProps> = {}) => (
    <ColorPicker aria-label="Accent" {...props}>
      {field}
    </ColorPicker>
  );

  it('renders the parts of 1f67a85 on the server (attributes sorted)', () => {
    // Captured from the dist of 1f67a85: the merged props may put the class before the locked
    // attributes.
    const tagsOf = (ui: React.ReactElement) => {
      const template = document.createElement('template');
      template.innerHTML = renderToString(ui);
      return openingTags(...parts(template.content));
    };
    expect(tagsOf(inPicker(<ColorPicker.HexField />))).toBe(
      [
        '<label class="wave-color-picker-hex-field flex min-w-0 flex-col gap-1">',
        '<span class="wave-color-picker-hex-field__label text-caption-1 text-muted-foreground">',
        '<input aria-label="Hex color value" autocomplete="off" class="wave-color-picker-hex-field__input w-24 rounded border border-input border-b-stroke-accessible bg-background px-2 py-1 text-body-1 text-foreground focus:outline-hidden focus:border-b-2 focus:border-b-primary" maxlength="9" spellcheck="false" type="text" value="#0f6cbd">',
      ].join('\n'),
    );
    expect(
      tagsOf(
        inPicker(
          <ColorPicker.HexField
            id="hex"
            aria-labelledby="own-label"
            aria-describedby="own-hint"
            aria-details="details"
            aria-required
            autoFocus
            tabIndex={2}
            inputMode="text"
            enterKeyHint="done"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck
          />,
          { 'aria-invalid': true, 'aria-errormessage': 'err' },
        ),
      ),
    ).toBe(
      [
        '<label class="wave-color-picker-hex-field flex min-w-0 flex-col gap-1">',
        '<span class="wave-color-picker-hex-field__label text-caption-1 text-muted-foreground">',
        '<input aria-describedby="err own-hint" aria-details="details" aria-errormessage="err" aria-invalid="true" aria-labelledby="own-label" aria-required="true" autocapitalize="off" autocomplete="off" autocorrect="off" autofocus="" class="wave-color-picker-hex-field__input w-24 rounded border bg-background px-2 py-1 text-body-1 text-foreground focus:outline-hidden focus:border-b-2 focus:border-b-primary border-destructive" enterkeyhint="done" id="hex" inputmode="text" maxlength="9" spellcheck="true" tabindex="2" type="text" value="#0f6cbd">',
      ].join('\n'),
    );
  });

  it('renders the parts of 1f67a85 in the client with an invalid draft (attributes sorted)', () => {
    // Captured from the dist of 1f67a85.
    render(inPicker(<ColorPicker.HexField />));
    fireEvent.change(hexInput(), { target: { value: 'zz' } });
    expect(openingTags(...parts(document))).toBe(
      [
        '<label class="wave-color-picker-hex-field flex min-w-0 flex-col gap-1">',
        '<span class="wave-color-picker-hex-field__label text-caption-1 text-muted-foreground">',
        '<input aria-describedby="wave-color-picker-error-_id0_" aria-invalid="true" aria-label="Hex color value" autocomplete="off" class="wave-color-picker-hex-field__input w-24 rounded border bg-background px-2 py-1 text-body-1 text-foreground focus:outline-hidden focus:border-b-2 focus:border-b-primary border-destructive" maxlength="9" spellcheck="false" type="text" value="#zz">',
        '<span class="wave-color-picker-hex-field__error-message text-caption-1 text-error" id="wave-color-picker-error-_id0_">',
      ].join('\n'),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const fields = [
      <ColorPicker.HexField key="plain" />,
      <ColorPicker.HexField
        key="routed"
        id="hex"
        aria-describedby="hint"
        tabIndex={0}
        inputMode="text"
        className="my-field"
      />,
      // The root's own props: the rest, the style and the hidden state.
      <ColorPicker.HexField
        key="root"
        className="c"
        style={{ color: 'red' }}
        title="t"
        hidden
        inert
        aria-hidden
        onPointerDown={() => {}}
      />,
    ];
    for (const field of fields) {
      expectInertSlotProps(
        (slotProps) => inPicker(React.cloneElement(field, { slotProps })),
        EVERY_PART,
      );
    }
    // With the error shown: the draft is state, so the same root re-renders with each value.
    const ui = (slotProps: HexFieldSlotProps | undefined) =>
      inPicker(<ColorPicker.HexField slotProps={slotProps} />, { 'aria-invalid': true });
    const { baseElement, rerender } = render(ui(undefined));
    fireEvent.change(hexInput(), { target: { value: 'zz' } });
    const markup = baseElement.innerHTML;
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
    for (const slotProps of [{}, EVERY_PART, undefined]) {
      rerender(ui(slotProps));
      expect(baseElement.innerHTML).toBe(markup);
    }
  });

  it('puts your className, style and data-* on each part, after its stable class and own classes', () => {
    render(
      inPicker(
        <ColorPicker.HexField
          slotProps={{
            label: { className: 'my-label', style: { color: 'red' }, 'data-part': 'label' },
            input: { className: 'my-input', style: { color: 'green' }, 'data-part': 'input' },
            errorMessage: {
              className: 'my-error',
              style: { color: 'blue' },
              'data-part': 'error',
            },
          }}
        />,
      ),
    );
    fireEvent.change(hexInput(), { target: { value: 'zz' } });
    for (const [element, stable, own, mine, part, color] of [
      [
        screen.getByText('Hex'),
        colorPickerHexFieldClassNames.label,
        'text-caption-1',
        'my-label',
        'label',
        'rgb(255, 0, 0)',
      ],
      [
        hexInput(),
        colorPickerHexFieldClassNames.input,
        'w-24',
        'my-input',
        'input',
        'rgb(0, 128, 0)',
      ],
      [
        screen.getByText(ERROR_TEXT),
        colorPickerHexFieldClassNames.errorMessage,
        'text-error',
        'my-error',
        'error',
        'rgb(0, 0, 255)',
      ],
    ] as const) {
      expect(element).toHaveClass(stable, own, mine);
      expect(element.classList[0]).toBe(stable);
      expect(element.classList[element.classList.length - 1]).toBe(mine);
      expect(element).toHaveAttribute('data-part', part);
      expect(element).toHaveStyle({ color });
    }
  });

  it('lets your class replace a conflicting class of the part', () => {
    render(inPicker(<ColorPicker.HexField slotProps={{ input: { className: 'w-32' } }} />));
    expect(hexInput()).toHaveClass('w-32');
    expect(hexInput()).not.toHaveClass('w-24');
  });

  it('attaches your refs to the parts, beside ref', () => {
    const root = React.createRef<HTMLLabelElement>();
    const label = React.createRef<HTMLSpanElement>();
    const input = React.createRef<HTMLInputElement>();
    const errorMessage = React.createRef<HTMLSpanElement>();
    const ref = React.createRef<HTMLInputElement>();
    render(
      inPicker(
        <ColorPicker.HexField
          ref={ref}
          slotProps={{
            root: { ref: root },
            label: { ref: label },
            input: { ref: input },
            errorMessage: { ref: errorMessage },
          }}
        />,
      ),
    );
    expect(errorMessage.current).toBeNull();
    fireEvent.change(hexInput(), { target: { value: 'zz' } });
    expect(label.current).toBe(screen.getByText('Hex'));
    expect(input.current).toBe(hexInput());
    expect(ref.current).toBe(hexInput());
    expect(errorMessage.current).toBe(screen.getByText(ERROR_TEXT));
    expect(root.current).toBe(hexInput().closest('label'));
  });

  it('runs your input handlers first, then the field’s own and its handling', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    render(
      inPicker(
        <ColorPicker.HexField
          onFocus={() => order.push('onFocus')}
          onKeyDown={() => order.push('onKeyDown')}
          onBlur={() => order.push('onBlur')}
          slotProps={{
            input: {
              onFocus: () => order.push('part focus'),
              onKeyDown: () => order.push('part key'),
              onChange: () => order.push('part change'),
              onBlur: () => order.push('part blur'),
            },
          }}
        />,
        { onValueChange: () => order.push('value') },
      ),
    );
    await user.click(hexInput());
    expect(order).toEqual(['part focus', 'onFocus']);
    await user.keyboard('{Control>}a{/Control}');
    order.length = 0;
    await user.keyboard('#abc{Enter}');
    // The last letter, then Enter, which applies the short color.
    expect(order.slice(-6)).toEqual([
      'part key',
      'onKeyDown',
      'part change',
      'part key',
      'onKeyDown',
      'value',
    ]);
    order.length = 0;
    await user.tab();
    expect(order).toEqual(['part key', 'onKeyDown', 'part blur', 'onBlur']);
    expect(hexInput()).toHaveValue('#aabbcc');
  });

  it('rejects the edit when your onChange prevents the default', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      inPicker(
        <ColorPicker.HexField
          slotProps={{
            input: {
              onChange: (event) => {
                if (/z/.test(event.currentTarget.value)) event.preventDefault();
              },
            },
          }}
        />,
        { onValueChange },
      ),
    );
    await user.click(hexInput());
    await user.keyboard('z');
    expect(hexInput()).toHaveValue('#0f6cbd');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('neither applies nor flags the typed text when your onBlur or Enter prevents the default', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const onValueChange = vi.fn();
    render(
      inPicker(
        <ColorPicker.HexField
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          slotProps={{
            input: {
              onBlur: (event) => event.preventDefault(),
              onKeyDown: (event) => {
                if (event.key === 'Enter') event.preventDefault();
              },
            },
          }}
        />,
        { onValueChange },
      ),
    );
    await user.tripleClick(hexInput());
    await user.keyboard('#abc{Enter}');
    expect(hexInput()).toHaveValue('#abc');
    expect(onValueChange).not.toHaveBeenCalled();
    // Only the Enter press was prevented: the field's own onKeyDown saw the other keys.
    expect(onKeyDown).toHaveBeenCalledTimes(4);
    await user.clear(hexInput());
    await user.keyboard('#12345');
    await user.tab();
    expect(onBlur).not.toHaveBeenCalled();
    expect(hexInput()).toHaveValue('#12345');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
  });

  it('calls your onChange and onValueChange once per edit in StrictMode', () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        {inPicker(<ColorPicker.HexField slotProps={{ input: { onChange } }} />, {
          onValueChange,
        })}
      </React.StrictMode>,
    );
    fireEvent.change(hexInput(), { target: { value: '#107c10' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('#107c10');
  });

  it('keeps the locked attributes of the input; your ids join its aria-labelledby and aria-describedby', () => {
    render(
      <>
        <span id="own-label">Own</span>
        <span id="extra-label">Extra</span>
        <span id="own-hint">Hint</span>
        <span id="extra-hint">More</span>
        {inPicker(
          <ColorPicker.HexField
            id="hex"
            aria-labelledby="own-label"
            aria-describedby="own-hint"
            tabIndex={2}
            inputMode="text"
            spellCheck
            slotProps={{
              input: {
                id: 'mine',
                type: 'search',
                value: 'nope',
                maxLength: 20,
                autoComplete: 'on',
                spellCheck: false,
                tabIndex: 5,
                inputMode: 'numeric',
                'aria-label': 'Other',
                'aria-labelledby': 'extra-label',
                'aria-describedby': 'extra-hint',
              },
            }}
          />,
        )}
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Own Extra' });
    expect(input).toHaveAttribute('id', 'hex');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('#0f6cbd');
    expect(input).toHaveAttribute('maxlength', '9');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('spellcheck', 'true');
    expect(input).toHaveAttribute('tabindex', '2');
    expect(input).toHaveAttribute('inputmode', 'text');
    expect(input).not.toHaveAttribute('aria-label');
    expect(input).toHaveAttribute('aria-labelledby', 'own-label extra-label');
    expect(input).toHaveAttribute('aria-describedby', 'own-hint extra-hint');
  });

  it('keeps the states the field leaves unset unset: a part cannot set them', () => {
    render(
      <form aria-label="Form">
        {inPicker(
          <ColorPicker.HexField
            slotProps={{
              input: {
                'aria-invalid': true,
                'aria-errormessage': 'err',
                'aria-required': true,
                'aria-details': 'details',
                tabIndex: 3,
                autoFocus: true,
                inputMode: 'numeric',
                enterKeyHint: 'go',
                autoCapitalize: 'on',
                autoCorrect: 'on',
                name: 'typed',
                form: 'elsewhere',
                required: true,
                hidden: true,
                'aria-hidden': true,
              },
            }}
          />,
          { name: 'accent' },
        )}
      </form>,
    );
    const input = hexInput();
    for (const attribute of [
      'aria-invalid',
      'aria-errormessage',
      'aria-required',
      'aria-details',
      'tabindex',
      'autofocus',
      'inputmode',
      'enterkeyhint',
      'autocapitalize',
      'autocorrect',
      'name',
      'form',
      'required',
      'hidden',
      'aria-hidden',
    ]) {
      expect(input).not.toHaveAttribute(attribute);
    }
    expect(input).not.toHaveFocus();
    // The picker submits the color under its own name, never the typed text.
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['accent', '#0f6cbd']]);
  });

  it('keeps the text its own: a part’s defaultValue never reaches the controlled input', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(inPicker(<ColorPicker.HexField slotProps={{ input: { defaultValue: '#ffffff' } }} />));
      expect(hexInput()).toHaveValue('#0f6cbd');
      // No warning of an input both controlled and uncontrolled: the part's default is unset.
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('keeps the input reachable: a part sets no inert on it', () => {
    render(inPicker(<ColorPicker.HexField slotProps={{ input: { inert: true } }} />));
    expect(hexInput()).not.toHaveAttribute('inert');
  });

  it('calls your label and errorMessage onClick in every state: the field is never disabled', () => {
    // A ColorPicker has no disabled state: while its value is not a hex color only the bound
    // color parts are disabled (the hue slider here), and the hex field stays editable.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const value of ['#0f6cbd', 'red']) {
        const onLabelClick = vi.fn();
        const onErrorClick = vi.fn();
        const { unmount } = render(
          inPicker(
            <>
              <ColorSlider />
              <ColorPicker.HexField
                slotProps={{
                  label: { onClick: onLabelClick },
                  errorMessage: { onClick: onErrorClick },
                }}
              />
            </>,
            { value },
          ),
        );
        expect(screen.getByRole('slider', { name: 'Hue' }).hasAttribute('disabled')).toBe(
          value === 'red',
        );
        expect(hexInput()).toBeEnabled();
        fireEvent.change(hexInput(), { target: { value: 'zz' } });
        fireEvent.click(screen.getByText('Hex'));
        fireEvent.click(screen.getByText(ERROR_TEXT));
        expect(onLabelClick).toHaveBeenCalledTimes(1);
        expect(onErrorClick).toHaveBeenCalledTimes(1);
        unmount();
      }
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] ColorPicker: "red" is not a hex color (#rrggbb or #rrggbbaa). Pass a hex ' +
            'value; the color area and sliders are disabled until then.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps the error message id that the input names', () => {
    render(inPicker(<ColorPicker.HexField slotProps={{ errorMessage: { id: 'mine' } }} />));
    fireEvent.change(hexInput(), { target: { value: 'zz' } });
    const error = screen.getByText(ERROR_TEXT);
    expect(error.id).not.toBe('mine');
    expect(hexInput()).toHaveAccessibleDescription(ERROR_TEXT);
  });

  it('adds the attributes the field does not set, such as a title or readOnly', () => {
    render(
      inPicker(
        <ColorPicker.HexField
          slotProps={{
            label: { title: 'Caption' },
            input: { title: 'Six or eight digits', readOnly: true },
          }}
        />,
      ),
    );
    expect(screen.getByText('Hex')).toHaveAttribute('title', 'Caption');
    expect(hexInput()).toHaveAttribute('title', 'Six or eight digits');
    expect(hexInput()).toHaveAttribute('readonly');
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      inPicker(
        <ColorPicker.HexField
          slotProps={{
            label: { className: 'my-label' },
            input: { className: 'my-input', title: 'Hex' },
            errorMessage: { className: 'my-error' },
          }}
        />,
      ),
    );
    fireEvent.change(hexInput(), { target: { value: 'zz' } });
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof HexFieldSlotProps>().toEqualTypeOf<
      'root' | 'label' | 'input' | 'errorMessage'
    >();
    expectTypeOf<NonNullable<HexFieldSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLabelElement> | undefined
    >();
    expectTypeOf<NonNullable<HexFieldSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<HexFieldSlotProps['input']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<NonNullable<HexFieldSlotProps['errorMessage']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: `labels.hexError` gives the error its text
    void (<ColorPicker.HexField slotProps={{ errorMessage: { children: 'Bad' } }} />);
    // @ts-expect-error -- a part takes no children: the field draws its content
    void (<ColorPicker.HexField slotProps={{ root: { children: 'x' } }} />);
  });

  describe('the root part', () => {
    const root = () => hexInput().closest('label') as HTMLElement;

    it("puts your className, style, data-* and attributes on the root <label>, after the field's className and style", () => {
      render(
        inPicker(
          <ColorPicker.HexField
            className="mine"
            style={{ color: 'red', width: 10 }}
            slotProps={{
              root: { className: 'my-root', style: { width: 20 }, 'data-part': 'root', title: 'R' },
            }}
          />,
        ),
      );
      expect(root().classList[0]).toBe(colorPickerHexFieldClassNames.root);
      expect(root().className).toMatch(/ mine my-root$/);
      expect(root()).toHaveStyle({ color: 'rgb(255, 0, 0)', width: '20px' });
      expect(root()).toHaveAttribute('data-part', 'root');
      expect(root()).toHaveAttribute('title', 'R');
      expect(hexInput()).not.toHaveAttribute('data-part');
      expect(hexInput()).not.toHaveAttribute('title');
    });

    it('lets your class replace a conflicting class of the root', () => {
      render(inPicker(<ColorPicker.HexField slotProps={{ root: { className: 'gap-2' } }} />));
      expect(root()).toHaveClass('gap-2');
      expect(root()).not.toHaveClass('gap-1');
    });

    it("keeps the props you give the field over the part's", () => {
      render(
        inPicker(
          <ColorPicker.HexField
            title="Own"
            data-x="own"
            slotProps={{ root: { title: 'Part', 'data-x': 'part' } }}
          />,
        ),
      );
      expect(root()).toHaveAttribute('title', 'Own');
      expect(root()).toHaveAttribute('data-x', 'own');
    });

    it('keeps its hidden state: a part changes none of it', () => {
      const { rerender } = render(
        inPicker(
          <ColorPicker.HexField
            slotProps={{ root: { hidden: true, inert: true, 'aria-hidden': true } }}
          />,
        ),
      );
      for (const attribute of ['hidden', 'inert', 'aria-hidden']) {
        expect(root()).not.toHaveAttribute(attribute);
      }
      // The field's own hidden state stays its own.
      rerender(
        inPicker(
          <ColorPicker.HexField
            hidden
            inert
            aria-hidden
            slotProps={{ root: { hidden: false, inert: false, 'aria-hidden': false } }}
          />,
        ),
      );
      const hiddenRoot = screen
        .getByRole('textbox', { name: 'Hex color value', hidden: true })
        .closest('label');
      expect(hiddenRoot).toHaveAttribute('hidden');
      expect(hiddenRoot).toHaveAttribute('inert');
      expect(hiddenRoot).toHaveAttribute('aria-hidden', 'true');
    });

    it("runs your root handlers before the field's own; preventDefault() in yours skips its own", () => {
      const order: string[] = [];
      const { rerender } = render(
        inPicker(
          <ColorPicker.HexField
            onPointerDown={() => order.push('own')}
            slotProps={{ root: { onPointerDown: () => order.push('part') } }}
          />,
        ),
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
      rerender(
        inPicker(
          <ColorPicker.HexField
            onPointerDown={() => order.push('own')}
            slotProps={{ root: { onPointerDown: (event) => event.preventDefault() } }}
          />,
        ),
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
    });

    // A click on the caption reaches the root, then the <label> passes it to the input, whose own
    // click bubbles to the root again: the browser's label behaviour.
    it('sees a click on the caption as it bubbles, before and after the label passes it to the input', async () => {
      const user = userEvent.setup();
      const targets: EventTarget[] = [];
      render(
        inPicker(
          <ColorPicker.HexField
            slotProps={{ root: { onClick: (event) => targets.push(event.target) } }}
          />,
        ),
      );
      const caption = screen.getByText('Hex');
      await user.click(caption);
      expect(targets).toEqual([caption, hexInput()]);
      expect(hexInput()).toHaveFocus();
      targets.length = 0;
      await user.click(hexInput());
      expect(targets).toEqual([hexInput()]);
    });

    it('keeps the caption from passing its click on when your root onClick prevents the default', () => {
      const onInputClick = vi.fn();
      render(
        inPicker(
          <ColorPicker.HexField
            slotProps={{
              root: { onClick: (event) => event.preventDefault() },
              input: { onClick: onInputClick },
            }}
          />,
        ),
      );
      fireEvent.click(screen.getByText('Hex'));
      expect(onInputClick).not.toHaveBeenCalled();
    });

    it('has no accessibility violations with the root customised', async () => {
      render(
        inPicker(
          <ColorPicker.HexField slotProps={{ root: { className: 'my-root', title: 'Hex' } }} />,
        ),
      );
      await expectNoA11yViolations();
    });
  });
});

// 1.0 (Phase 14, R5): `ref` reaches the hex <input>, the focusable control; the root <label> is
// `slotProps.root.ref`, and `controlRef` is gone. The field takes no part in a Field of its own
// (the picker's parts render in a `null` Field context: a Field names the picker's group).
describe('ColorPicker.HexField — ref reaches the control', () => {
  it('focuses the hex input through ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <InPicker>
        <ColorPicker.HexField ref={ref} />
      </InPicker>,
    );
    act(() => ref.current?.focus());
    expect(hexInput()).toHaveFocus();
  });

  it('gives ref and slotProps.input.ref the same input', () => {
    const ref = React.createRef<HTMLInputElement>();
    const input = React.createRef<HTMLInputElement>();
    render(
      <InPicker>
        <ColorPicker.HexField ref={ref} slotProps={{ input: { ref: input } }} />
      </InPicker>,
    );
    expect(ref.current).toBe(hexInput());
    expect(input.current).toBe(hexInput());
  });

  it("keeps the picker's invalid focus and form reset working with an inline ref that changes on every render", async () => {
    const user = userEvent.setup();
    const nodes: (HTMLInputElement | null)[] = [];
    const ui = (pass: number) => (
      <form aria-label="Form">
        <ColorPicker aria-label="Accent" name="accent" required defaultValue="#0f6cbd">
          <ColorPicker.HexField
            ref={(node) => {
              nodes.push(node);
            }}
            data-pass={pass}
          />
        </ColorPicker>
      </form>
    );
    const { container, rerender } = render(ui(0));
    rerender(ui(1));
    rerender(ui(2));
    const input = hexInput();
    expect(nodes.at(-1)).toBe(input);
    // The picker's hidden input focuses the hex field it registered, through the field's own ref.
    fireEvent.invalid(container.querySelector('input[required]') as HTMLInputElement);
    expect(input).toHaveFocus();
    await user.tripleClick(input);
    await user.keyboard('#zzz');
    rerender(ui(3));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    act(() => (screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).reset());
    expect(input).toHaveValue('#0f6cbd');
    expect(nodes.at(-1)).toBe(input);
  });

  it('attaches a callback ref once, keeps it across renders and detaches it on unmount', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <InPicker>
        <ColorPicker.HexField ref={ref} />
      </InPicker>,
    );
    const input = hexInput();
    rerender(
      <InPicker>
        <ColorPicker.HexField ref={ref} className="again" />
      </InPicker>,
    );
    expect(ref.mock.calls).toEqual([[input]]);
    unmount();
    expect(ref.mock.calls).toEqual([[input], [null]]);
  });

  it('in StrictMode, attaches only the control: React detaches and attaches it again on mount, once', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <React.StrictMode>
        <InPicker>
          <ColorPicker.HexField ref={ref} />
        </InPicker>
      </React.StrictMode>,
    );
    const input = hexInput();
    rerender(
      <React.StrictMode>
        <InPicker>
          <ColorPicker.HexField ref={ref} className="again" />
        </InPicker>
      </React.StrictMode>,
    );
    expect(ref.mock.calls).toEqual([[input], [null], [input]]);
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it('declares ref for the input, and no controlRef', () => {
    expectTypeOf<ColorPickerHexFieldProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<ColorPickerHexFieldProps>().not.toHaveProperty('controlRef');
    const labelRef = React.createRef<HTMLLabelElement>();
    // @ts-expect-error -- in 1.0 `ref` reaches the input; the root <label> is slotProps.root.ref
    void (<ColorPicker.HexField ref={labelRef} />);
  });

  it('has no controlRef: TypeScript rejects it, and untyped code puts an unknown prop on the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <InPicker>
          <ColorPicker.HexField
            // @ts-expect-error -- `controlRef` is removed in 1.0: `ref` reaches the input
            controlRef={controlRef}
          />
        </InPicker>,
      );
      expect(controlRef.current).toBeNull();
      expect(hexInput().closest('label')).toHaveAttribute('controlref', '[object Object]');
      expect(error.mock.calls).toEqual([UNKNOWN_PROP('controlRef')]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
