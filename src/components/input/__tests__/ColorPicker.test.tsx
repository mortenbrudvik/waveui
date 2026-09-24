import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from '../ColorPicker';
import { expectNoA11yViolations, testSystemProps } from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

const hexInput = () => screen.getByRole('textbox', { name: 'Hex color value' });
const preset = (name: string) => screen.getByRole('radio', { name });
const opacitySlider = () => screen.getByRole('slider', { name: 'Opacity' });
const preview = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-color-preview]');

function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

function warnings(spy: ReturnType<typeof spyWarn>, text: string) {
  return spy.mock.calls.filter(([msg]) => String(msg).includes(text));
}

describe('ColorPicker', () => {
  testSystemProps(ColorPicker, {
    expectedTag: 'div',
    displayName: 'ColorPicker',
    defaultProps: { 'aria-label': 'Brand color' },
    a11yVariants: [
      { name: 'with opacity', props: { showOpacity: true, defaultValue: '#0f6cbd80' } },
      {
        name: 'labelled presets',
        props: { presets: [{ color: '#d13438', label: 'Cranberry' }], defaultValue: '#d13438' },
      },
      { name: 'in a form', props: { name: 'color', required: true } },
    ],
  });

  it('is a group named by aria-label (input-pickers#24)', () => {
    render(<ColorPicker aria-label="Brand color" />);
    expect(screen.getByRole('group', { name: 'Brand color' })).toBeInTheDocument();
  });

  it('is named by aria-labelledby', () => {
    render(
      <>
        <span id="picker-heading">Accent</span>
        <ColorPicker aria-labelledby="picker-heading" />
      </>,
    );
    expect(screen.getByRole('group', { name: 'Accent' })).toBeInTheDocument();
  });

  it('renders the hex input', () => {
    render(<ColorPicker defaultValue="#112233" />);
    expect(hexInput()).toHaveValue('#112233');
  });

  it('renders the default presets with color names', () => {
    render(<ColorPicker />);
    const group = screen.getByRole('radiogroup', { name: 'Preset colors' });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(8);
    expect(preset('Blue')).toHaveAttribute('aria-checked', 'true');
    expect(preset('Red')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders custom presets', () => {
    render(<ColorPicker presets={['#ff0000', '#00ff00', '#0000ff']} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('renders with an empty presets array', () => {
    render(<ColorPicker presets={[]} aria-label="Brand color" />);
    expect(screen.getByRole('group', { name: 'Brand color' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('selects a preset on click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker presets={['#ff0000', '#00ff00']} onValueChange={onValueChange} />);
    await user.click(preset('#00ff00'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('#00ff00');
    expect(preset('#00ff00')).toHaveAttribute('aria-checked', 'true');
  });

  it('updates the hex input when a preset is clicked', async () => {
    const user = userEvent.setup();
    render(<ColorPicker presets={['#ff0000', '#00ff00']} />);
    await user.click(preset('#ff0000'));
    expect(hexInput()).toHaveValue('#ff0000');
  });

  it('controlled: respects the value prop', () => {
    render(<ColorPicker value="#d13438" />);
    expect(hexInput()).toHaveValue('#d13438');
    expect(preset('Red')).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onValueChange exactly once per interaction in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <ColorPicker presets={['#ff0000', '#00ff00']} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(preset('#00ff00'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.tripleClick(hexInput());
    await user.keyboard('#123456');
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith('#123456');
  });

  it('keeps the deprecated onChange alias working and warns once', async () => {
    const warn = spyWarn();
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(<ColorPicker presets={['#ff0000']} onChange={onChange} />);
      rerender(<ColorPicker presets={['#ff0000']} onChange={onChange} />);
      await user.click(preset('#ff0000'));
      expect(onChange).toHaveBeenCalledWith('#ff0000');
      const deprecations = warnings(warn, 'ColorPicker: `onChange` is deprecated');
      expect(deprecations).toHaveLength(1);
      expect(String(deprecations[0][0])).toContain('Use `onValueChange` instead.');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('ColorPicker — hex input (input-basic#41, input-pickers#24, #25)', () => {
  it('commits typed hex: onValueChange, preview and preset state follow', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <ColorPicker
        defaultValue="#000000"
        presets={['#abcdef', '#ff0000']}
        onValueChange={onValueChange}
      />,
    );
    await user.clear(hexInput());
    await user.type(hexInput(), 'abcdef');
    expect(hexInput()).toHaveValue('#abcdef');
    expect(onValueChange).toHaveBeenLastCalledWith('#abcdef');
    expect(preview(container)).toHaveStyle({ backgroundColor: 'rgb(171, 205, 239)' });
    expect(preset('#abcdef')).toHaveAttribute('aria-checked', 'true');
  });

  it('never reports an invalid value, flags it while typing and keeps it flagged on blur', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#0f6cbd" onValueChange={onValueChange} />);
    const input = hexInput();
    await user.tripleClick(input);
    await user.keyboard('#zzz');
    expect(input).toHaveValue('#zzz');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a hex color such as #0f6cbd.');

    // Leaving the field does not throw the text away without a message (WCAG 3.3.1).
    await user.tab();
    expect(input).toHaveValue('#zzz');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a hex color such as #0f6cbd.');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not flag an incomplete but still possible hex value while typing', async () => {
    const user = userEvent.setup();
    render(<ColorPicker defaultValue="#0f6cbd" />);
    await user.tripleClick(hexInput());
    await user.keyboard('#12');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
    expect(hexInput()).not.toHaveAccessibleDescription();
  });

  it('applies a typed #rgb on blur, keeping the current opacity', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <ColorPicker defaultValue="#0f6cbd" onValueChange={onValueChange} />,
    );
    await user.tripleClick(hexInput());
    await user.keyboard('#abc');
    expect(onValueChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onValueChange.mock.calls).toEqual([['#aabbcc']]);
    expect(hexInput()).toHaveValue('#aabbcc');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
    expect(preview(container)).toHaveStyle({ backgroundColor: 'rgb(170, 187, 204)' });
  });

  it('a blurred #rgb keeps the current opacity and a #rgba brings its own alpha', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#0f6cbd80" onValueChange={onValueChange} />);
    // user.clear, not a select-all: user-event refuses typing into a full maxLength field.
    await user.clear(hexInput());
    await user.type(hexInput(), 'abc');
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith('#aabbcc80');
    expect(hexInput()).toHaveValue('#aabbcc80');

    await user.clear(hexInput());
    await user.type(hexInput(), '#abcd');
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith('#aabbccdd');
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it('flags an incomplete hex value on blur and keeps the text (WCAG 3.3.1)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#0f6cbd" onValueChange={onValueChange} />);
    const input = hexInput();
    await user.tripleClick(input);
    await user.keyboard('#12345');
    expect(input).not.toHaveAttribute('aria-invalid');
    await user.tab();
    expect(input).toHaveValue('#12345');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a hex color such as #0f6cbd.');
    expect(onValueChange).not.toHaveBeenCalled();
    await expectNoA11yViolations();

    // Correcting the text applies it and clears the error.
    await user.click(input);
    await user.keyboard('{End}6');
    expect(onValueChange).toHaveBeenLastCalledWith('#123456');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAccessibleDescription();
  });

  it('Enter applies a typed #rgb like leaving the field, and flags invalid text', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#0f6cbd80" onValueChange={onValueChange} />);
    const input = hexInput();
    await user.clear(input);
    await user.type(input, '#abc{Enter}');
    expect(onValueChange.mock.calls).toEqual([['#aabbcc80']]);
    expect(input).toHaveValue('#aabbcc80');
    expect(input).toHaveFocus();

    await user.clear(input);
    await user.type(input, '#12345{Enter}');
    expect(input).toHaveValue('#12345');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a hex color such as #0f6cbd.');

    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('#aabbcc80');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('ignores surrounding whitespace in pasted hex text', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#0f6cbd" onValueChange={onValueChange} />);
    const input = hexInput();
    // user.clear, not a select-all: user-event sizes a paste by maxLength minus the full value.
    await user.clear(input);
    await user.paste('#abcdef ');
    expect(onValueChange.mock.calls).toEqual([['#abcdef']]);
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAccessibleDescription();
    await user.tab();
    expect(input).toHaveValue('#abcdef');

    await user.clear(input);
    await user.paste(' 123456');
    expect(onValueChange).toHaveBeenLastCalledWith('#123456');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('shows the current value again when the field is left empty', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#0f6cbd" onValueChange={onValueChange} />);
    await user.clear(hexInput());
    await user.tab();
    expect(hexInput()).toHaveValue('#0f6cbd');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');

    await user.tripleClick(hexInput());
    await user.keyboard('#');
    await user.tab();
    expect(hexInput()).toHaveValue('#0f6cbd');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('a value change from elsewhere replaces a flagged hex text', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ColorPicker value="#0f6cbd" onValueChange={() => {}} />);
    await user.tripleClick(hexInput());
    await user.keyboard('#12345');
    await user.tab();
    expect(hexInput()).toHaveAttribute('aria-invalid', 'true');

    rerender(<ColorPicker value="#107c10" onValueChange={() => {}} />);
    expect(hexInput()).toHaveValue('#107c10');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
  });

  it('a preset click replaces a flagged hex text', async () => {
    const user = userEvent.setup();
    render(<ColorPicker defaultValue="#0f6cbd" />);
    await user.tripleClick(hexInput());
    await user.keyboard('#zzz');
    await user.tab();
    expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
    await user.click(preset('Red'));
    expect(hexInput()).toHaveValue('#d13438');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
  });

  it('shows the real value again after blur when a controlled parent rejects the typed color', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker value="#0f6cbd" onValueChange={onValueChange} />);
    await user.clear(hexInput());
    await user.type(hexInput(), '123456');
    expect(onValueChange).toHaveBeenLastCalledWith('#123456');
    await user.tab();
    expect(hexInput()).toHaveValue('#0f6cbd');
    // The complete value was offered while typing: leaving the field does not offer it again.
    expect(onValueChange).toHaveBeenCalledTimes(1);

    await user.clear(hexInput());
    await user.type(hexInput(), 'abc');
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith('#aabbcc');
    expect(hexInput()).toHaveValue('#0f6cbd');
    expect(hexInput()).not.toHaveAttribute('aria-invalid');
  });

  it('shows the real value after a preset click that a controlled parent rejects', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker value="#0f6cbd" onValueChange={onValueChange} />);
    await user.click(preset('Red'));
    expect(onValueChange).toHaveBeenCalledWith('#d13438');
    expect(hexInput()).toHaveValue('#0f6cbd');
    expect(preset('Blue')).toHaveAttribute('aria-checked', 'true');
    expect(preset('Red')).toHaveAttribute('aria-checked', 'false');
  });

  it('follows an external value change while not editing', () => {
    const { rerender } = render(<ColorPicker value="#0f6cbd" />);
    rerender(<ColorPicker value="#107c10" />);
    expect(hexInput()).toHaveValue('#107c10');
    expect(preset('Green')).toHaveAttribute('aria-checked', 'true');
  });

  it('uses the shared input focus indicator (focus:outline-hidden, never outline-none)', () => {
    render(<ColorPicker />);
    expect(hexInput()).toHaveClass('focus:outline-hidden', 'focus:border-b-primary');
    expect(hexInput()).not.toHaveClass('focus:outline-none');
  });
});

describe('ColorPicker — opacity (input-pickers#15, input-basic#30)', () => {
  it('renders the opacity slider only with showOpacity', () => {
    const { rerender } = render(<ColorPicker />);
    expect(screen.queryByRole('slider', { name: 'Opacity' })).not.toBeInTheDocument();
    rerender(<ColorPicker showOpacity />);
    expect(opacitySlider()).toBeInTheDocument();
  });

  it('derives the opacity from the alpha byte of a 9-character value', () => {
    const { container } = render(<ColorPicker showOpacity defaultValue="#0f6cbd80" />);
    expect(opacitySlider()).toHaveValue('50');
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(preview(container)).toHaveStyle({ backgroundColor: 'rgba(15, 108, 189, 0.5)' });
    // Presets compare the rgb part, so the translucent default still marks its preset.
    expect(preset('Blue')).toHaveAttribute('aria-checked', 'true');
  });

  it('follows the alpha of a controlled value', () => {
    const { rerender } = render(<ColorPicker showOpacity value="#0f6cbd" />);
    expect(opacitySlider()).toHaveValue('100');
    rerender(<ColorPicker showOpacity value="#0f6cbd40" />);
    expect(opacitySlider()).toHaveValue('25');
  });

  it('emits the alpha byte when the slider moves and keeps the preset selected', () => {
    const onValueChange = vi.fn();
    render(
      <ColorPicker
        showOpacity
        presets={['#ff0000']}
        defaultValue="#ff0000"
        onValueChange={onValueChange}
      />,
    );
    fireEvent.change(opacitySlider(), { target: { value: '50' } });
    expect(onValueChange).toHaveBeenLastCalledWith('#ff000080');
    expect(opacitySlider()).toHaveValue('50');
    expect(preset('#ff0000')).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the opacity when a preset is picked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPicker
        showOpacity
        presets={['#ff0000', '#00ff00']}
        defaultValue="#ff000080"
        onValueChange={onValueChange}
      />,
    );
    await user.click(preset('#00ff00'));
    expect(onValueChange).toHaveBeenLastCalledWith('#00ff0080');
    expect(opacitySlider()).toHaveValue('50');
  });

  it('keeps the opacity when a 6-digit hex is typed', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker showOpacity defaultValue="#ff000080" onValueChange={onValueChange} />);
    // (user-event refuses to type into a full maxLength field even over a selection: clear first)
    await user.clear(hexInput());
    await user.keyboard('#abcdef');
    expect(onValueChange).toHaveBeenLastCalledWith('#abcdef80');
  });

  it('takes the alpha of a typed 8-digit hex', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker showOpacity defaultValue="#ff0000" onValueChange={onValueChange} />);
    await user.tripleClick(hexInput());
    await user.keyboard('#abcdef40');
    expect(onValueChange).toHaveBeenLastCalledWith('#abcdef40');
    expect(opacitySlider()).toHaveValue('25');
  });

  it('rejects a non-hex value such as "red" with a development warning instead of emitting "redff"', () => {
    const warn = spyWarn();
    try {
      const onValueChange = vi.fn();
      render(<ColorPicker showOpacity value="red" onValueChange={onValueChange} />);
      expect(hexInput()).toHaveValue('red');
      expect(opacitySlider()).toBeDisabled();
      fireEvent.change(opacitySlider(), { target: { value: '40' } });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(warnings(warn, 'ColorPicker: "red" is not a hex color')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('ColorPicker — presets (input-pickers#16, #17, #23)', () => {
  it('accepts { color, label } presets and names them by label', () => {
    render(
      <ColorPicker
        presets={[{ color: '#d13438', label: 'Cranberry' }, '#107c10']}
        defaultValue="#d13438"
      />,
    );
    expect(preset('Cranberry')).toHaveAttribute('aria-checked', 'true');
    expect(preset('#107c10')).toHaveAttribute('aria-checked', 'false');
  });

  it('compares presets case-insensitively on the rgb part', () => {
    render(<ColorPicker presets={['#ABCDEF']} defaultValue="#abcdefcc" />);
    expect(preset('#ABCDEF')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the selected preset with an offset ring and a check glyph', () => {
    render(<ColorPicker presets={['#0f6cbd', '#d13438']} defaultValue="#0f6cbd" />);
    const selected = preset('#0f6cbd');
    expect(selected).toHaveClass('ring-2', 'ring-offset-2', 'ring-foreground');
    expect(selected.querySelector('[data-wave-icon="check"]')).not.toBeNull();
    expect(preset('#d13438').querySelector('[data-wave-icon="check"]')).toBeNull();
  });

  it('renders presets as one roving radiogroup: arrows move and pick', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPicker
        presets={['#ff0000', '#00ff00', '#0000ff']}
        defaultValue="#00ff00"
        onValueChange={onValueChange}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    act(() => preset('#00ff00').focus());
    await user.keyboard('{ArrowRight}');
    expect(preset('#0000ff')).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('#0000ff');
    expect(hexInput()).toHaveValue('#0000ff');
  });

  it('drops non-hex presets with a development warning', () => {
    const warn = spyWarn();
    try {
      render(<ColorPicker presets={['#ff0000', 'teal']} />);
      expect(screen.getAllByRole('radio')).toHaveLength(1);
      expect(warnings(warn, 'ColorPicker: preset "teal" is not a hex color')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('ColorPicker — Field integration (FieldContext)', () => {
  it('names the group with the Field label and describes it with the hint', () => {
    renderWithFieldContext(<ColorPicker />, { hintId: FIELD_TEST_IDS.hintId });
    const group = screen.getByRole('group', { name: FIELD_TEST_TEXT.label });
    expect(group).toHaveAccessibleDescription(FIELD_TEST_TEXT.hint);
  });

  it('a consumer aria-label wins over the Field label', () => {
    renderWithFieldContext(<ColorPicker aria-label="Accent" />);
    expect(screen.getByRole('group', { name: 'Accent' })).toBeInTheDocument();
  });

  it('keeps the Field wiring on the group: the presets radiogroup does not repeat it (input-basic#1)', () => {
    const { container } = renderWithFieldContext(<ColorPicker />, {
      required: true,
      errorId: FIELD_TEST_IDS.errorId,
      hintId: FIELD_TEST_IDS.hintId,
    });
    const group = screen.getByRole('group', { name: FIELD_TEST_TEXT.label });
    expect(group).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
    expect(container.querySelectorAll(`[id="${FIELD_TEST_IDS.controlId}"]`)).toHaveLength(1);
    expect(group).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);

    const presets = screen.getByRole('radiogroup', { name: 'Preset colors' });
    expect(presets).not.toHaveAttribute('id');
    expect(presets).not.toHaveAttribute('aria-labelledby');
    expect(presets).not.toHaveAttribute('aria-describedby');
    expect(presets).not.toHaveAttribute('aria-invalid');
    expect(presets).not.toHaveAttribute('aria-required');
    // The Field's required state is carried by the picker's one hidden text input only.
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(container.querySelectorAll('input[required]')).toHaveLength(1);
  });

  it('a required Field does not block the form through the presets for a non-hex value', () => {
    const warn = spyWarn();
    try {
      renderWithFieldContext(
        <form aria-label="Form">
          <ColorPicker presets={['#ff0000']} value="red" />
        </form>,
        { required: true },
      );
      expect(screen.getByRole('radio', { name: '#ff0000' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect((screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).checkValidity()).toBe(
        true,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('puts the invalid state on the hex textbox, not on the group (input-pickers#24)', () => {
    renderWithFieldContext(<ColorPicker />, { errorId: FIELD_TEST_IDS.errorId });
    const group = screen.getByRole('group', { name: FIELD_TEST_TEXT.label });
    expect(group).not.toHaveAttribute('aria-invalid');
    expect(group).toHaveAccessibleDescription(FIELD_TEST_TEXT.error);
    expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
    // Focus lands on the hex textbox: it says why it is invalid, not only that it is.
    expect(hexInput()).toHaveAccessibleDescription(FIELD_TEST_TEXT.error);
  });

  it('describes the hex textbox with both the Field error and its own error', async () => {
    const user = userEvent.setup();
    renderWithFieldContext(<ColorPicker />, { errorId: FIELD_TEST_IDS.errorId });
    await user.tripleClick(hexInput());
    await user.keyboard('#zzz');
    expect(hexInput()).toHaveAccessibleDescription(
      `Enter a hex color such as #0f6cbd. ${FIELD_TEST_TEXT.error}`,
    );
  });

  it('routes a consumer aria-invalid to the hex textbox', () => {
    render(<ColorPicker aria-label="Accent" aria-invalid />);
    expect(screen.getByRole('group', { name: 'Accent' })).not.toHaveAttribute('aria-invalid');
    expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('routes a consumer aria-errormessage to the hex textbox, never to the group', async () => {
    render(
      <>
        <ColorPicker aria-label="Accent" aria-invalid aria-errormessage="accent-error" />
        <span id="accent-error">Pick a brand color.</span>
      </>,
    );
    const group = screen.getByRole('group', { name: 'Accent' });
    expect(group).not.toHaveAttribute('aria-errormessage');
    expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
    expect(hexInput()).toHaveAttribute('aria-errormessage', 'accent-error');
    expect(hexInput()).toHaveAccessibleDescription('Pick a brand color.');
    await expectNoA11yViolations();
  });

  it('keeps a consumer aria-errormessage off the hex textbox while not invalid', () => {
    render(
      <>
        <ColorPicker aria-label="Accent" aria-errormessage="accent-error" />
        <span id="accent-error">Pick a brand color.</span>
      </>,
    );
    expect(screen.getByRole('group', { name: 'Accent' })).not.toHaveAttribute('aria-errormessage');
    expect(hexInput()).not.toHaveAttribute('aria-errormessage');
    expect(hexInput()).not.toHaveAccessibleDescription();
  });

  it('turns a consumer aria-required into a required hidden input, never on the group', async () => {
    const { container } = render(
      <form aria-label="Form">
        <ColorPicker aria-label="Accent" aria-required />
      </form>,
    );
    const group = screen.getByRole('group', { name: 'Accent' });
    expect(group).not.toHaveAttribute('aria-required');
    expect(group).not.toHaveAttribute('required');
    expect(container.querySelectorAll('input[required]')).toHaveLength(1);
    expect((screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).checkValidity()).toBe(
      true,
    );
    await expectNoA11yViolations();
  });
});

describe('ColorPicker — labels (input-pickers#23)', () => {
  it('uses English defaults', () => {
    render(<ColorPicker aria-label="Accent" showOpacity />);
    expect(screen.getByText('Hex')).toBeInTheDocument();
    expect(hexInput()).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Preset colors' })).toBeInTheDocument();
    expect(opacitySlider()).toBeInTheDocument();
  });

  it('accepts localised labels, including the hex error message', async () => {
    const user = userEvent.setup();
    render(
      <ColorPicker
        aria-label="Farbe"
        showOpacity
        labels={{
          hex: 'Hex-Wert',
          hexInput: 'Hexadezimaler Farbwert',
          hexError: 'Geben Sie eine Hex-Farbe wie #0f6cbd ein.',
          presets: 'Vorgabefarben',
          opacity: 'Deckkraft',
        }}
      />,
    );
    expect(screen.getByText('Hex-Wert')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Vorgabefarben' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Deckkraft' })).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Hexadezimaler Farbwert' });
    await user.tripleClick(input);
    await user.keyboard('#zzz');
    expect(input).toHaveAccessibleDescription('Geben Sie eine Hex-Farbe wie #0f6cbd ein.');
  });
});

describe('ColorPicker — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  it('submits the current color under its name', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <ColorPicker name="color" presets={['#ff0000', '#00ff00']} defaultValue="#ff0000" />
      </form>,
    );
    expect(new FormData(getForm()).getAll('color')).toEqual(['#ff0000']);
    await user.click(preset('#00ff00'));
    expect(new FormData(getForm()).getAll('color')).toEqual(['#00ff00']);
  });

  it('Enter in the hex field applies a typed #rgb before the form is submitted', async () => {
    const user = userEvent.setup();
    const submitted: unknown[] = [];
    render(
      <form
        aria-label="Form"
        onSubmit={(e) => {
          e.preventDefault();
          submitted.push(new FormData(e.currentTarget).get('color'));
        }}
      >
        <ColorPicker name="color" defaultValue="#0f6cbd" />
        <button type="submit">Save</button>
      </form>,
    );
    await user.tripleClick(hexInput());
    await user.keyboard('#abc{Enter}');
    expect(submitted).toEqual(['#aabbcc']);
    expect(hexInput()).toHaveValue('#aabbcc');
  });

  it('adds nothing to FormData without a name', () => {
    render(
      <form aria-label="Form">
        <ColorPicker showOpacity />
      </form>,
    );
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('required is satisfied by the current color', () => {
    render(
      <form aria-label="Form">
        <ColorPicker name="color" required />
      </form>,
    );
    expect(getForm().checkValidity()).toBe(true);
    expect(getForm().querySelector('input[name="color"]')).toBeRequired();
  });

  it('form reset restores defaultValue (with and without a name)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <ColorPicker
          aria-label="Named"
          name="color"
          presets={['#ff0000', '#00ff00']}
          defaultValue="#ff0000"
        />
        <ColorPicker aria-label="Unnamed" presets={['#ff0000', '#00ff00']} defaultValue="#00ff00" />
      </form>,
    );
    const named = screen.getByRole('group', { name: 'Named' });
    const unnamed = screen.getByRole('group', { name: 'Unnamed' });
    await user.click(named.querySelectorAll<HTMLElement>('[role="radio"]')[1]);
    await user.click(unnamed.querySelectorAll<HTMLElement>('[role="radio"]')[0]);
    act(() => getForm().reset());
    expect(named.querySelector('[aria-checked="true"]')).toHaveAccessibleName('#ff0000');
    expect(unnamed.querySelector('[aria-checked="true"]')).toHaveAccessibleName('#00ff00');
    expect(new FormData(getForm()).getAll('color')).toEqual(['#ff0000']);
    const hexInputs = screen.getAllByRole('textbox', { name: 'Hex color value' });
    expect(hexInputs.map((i) => (i as HTMLInputElement).value)).toEqual(['#ff0000', '#00ff00']);
  });

  it('uncontrolled: form reset reports only the default color (input-basic#12)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const untouched = vi.fn();
    render(
      <form aria-label="Form">
        <ColorPicker
          aria-label="Changed"
          showOpacity
          defaultValue="#0f6cbd80"
          onValueChange={onValueChange}
        />
        <ColorPicker aria-label="Untouched" onValueChange={untouched} />
      </form>,
    );
    const changed = screen.getByRole('group', { name: 'Changed' });
    await user.click(within(changed).getByRole('radio', { name: 'Red' }));
    expect(onValueChange.mock.calls).toEqual([['#d1343880']]);

    act(() => getForm().reset());
    expect(onValueChange.mock.calls).toEqual([['#d1343880'], ['#0f6cbd80']]);
    expect(untouched).not.toHaveBeenCalled();
    expect(within(changed).getByRole('radio', { name: 'Blue' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(changed).getByRole('slider', { name: 'Opacity' })).toHaveValue('50');
  });

  it('deprecated onChange alias: a form reset reports only the default color, like onValueChange (C-NAMING, input-basic#12)', async () => {
    const warn = spyWarn();
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const untouched = vi.fn();
      render(
        <form aria-label="Form">
          <ColorPicker
            aria-label="Changed"
            showOpacity
            defaultValue="#0f6cbd80"
            onChange={onChange}
          />
          <ColorPicker aria-label="Untouched" onChange={untouched} />
        </form>,
      );
      const changed = screen.getByRole('group', { name: 'Changed' });
      await user.click(within(changed).getByRole('radio', { name: 'Red' }));
      expect(onChange.mock.calls).toEqual([['#d1343880']]);

      act(() => getForm().reset());
      expect(onChange.mock.calls).toEqual([['#d1343880'], ['#0f6cbd80']]);
      expect(untouched).not.toHaveBeenCalled();
      expect(warnings(warn, 'ColorPicker: `onChange` is deprecated')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('controlled: form reset reports only the default color (input-basic#12)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const untouched = vi.fn();
    function Controlled() {
      const [color, setColor] = React.useState('#0f6cbd80');
      return (
        <ColorPicker
          aria-label="Changed"
          showOpacity
          value={color}
          defaultValue="#0f6cbd80"
          onValueChange={(next) => {
            onValueChange(next);
            setColor(next);
          }}
        />
      );
    }
    render(
      <form aria-label="Form">
        <Controlled />
        <ColorPicker
          aria-label="Untouched"
          value="#107c10"
          defaultValue="#107c10"
          onValueChange={untouched}
        />
      </form>,
    );
    const changed = screen.getByRole('group', { name: 'Changed' });
    await user.click(within(changed).getByRole('radio', { name: 'Red' }));
    expect(onValueChange.mock.calls).toEqual([['#d1343880']]);

    act(() => getForm().reset());
    expect(onValueChange.mock.calls).toEqual([['#d1343880'], ['#0f6cbd80']]);
    expect(untouched).not.toHaveBeenCalled();
    expect(within(changed).getByRole('radio', { name: 'Blue' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
