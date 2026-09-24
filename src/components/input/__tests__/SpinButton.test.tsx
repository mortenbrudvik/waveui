import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpinButton } from '../SpinButton';
import { testFocusEvents, testSystemProps } from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

const spin = (name = 'Quantity') => screen.getByRole('spinbutton', { name });
const incrementButton = () => screen.getByRole('button', { name: 'Increment' });
const decrementButton = () => screen.getByRole('button', { name: 'Decrement' });

function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

function warnings(spy: ReturnType<typeof spyWarn>, text: string) {
  return spy.mock.calls.filter(([msg]) => String(msg).includes(text));
}

describe('SpinButton', () => {
  testSystemProps(SpinButton, {
    expectedTag: 'div',
    displayName: 'SpinButton',
    defaultProps: { 'aria-label': 'Quantity' },
    control: { role: 'spinbutton' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'at its bounds', props: { min: 0, max: 0, defaultValue: 0 } },
      { name: 'invalid', props: { 'aria-invalid': true } },
      { name: 'in a form', props: { name: 'qty', required: true } },
    ],
  });

  testFocusEvents(SpinButton, { 'aria-label': 'Quantity' }, 'input');

  it('renders a spinbutton with increment and decrement buttons', () => {
    render(<SpinButton aria-label="Quantity" />);
    expect(spin()).toBeInTheDocument();
    expect(incrementButton()).toBeInTheDocument();
    expect(decrementButton()).toBeInTheDocument();
  });

  it('shows the default value of 0', () => {
    render(<SpinButton aria-label="Quantity" />);
    expect(spin()).toHaveValue('0');
  });

  it('shows a custom defaultValue', () => {
    render(<SpinButton aria-label="Quantity" defaultValue={10} />);
    expect(spin()).toHaveValue('10');
  });

  it('increments and decrements with the buttons', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={5} />);
    await user.click(incrementButton());
    expect(spin()).toHaveValue('6');
    await user.click(decrementButton());
    await user.click(decrementButton());
    expect(spin()).toHaveValue('4');
  });

  it('respects the step prop', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={0} step={5} />);
    await user.click(incrementButton());
    expect(spin()).toHaveValue('5');
  });

  it('clamps to max and disables increment there', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={9} max={10} />);
    await user.click(incrementButton());
    expect(spin()).toHaveValue('10');
    expect(incrementButton()).toBeDisabled();
  });

  it('clamps to min and disables decrement there', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={1} min={0} />);
    await user.click(decrementButton());
    expect(spin()).toHaveValue('0');
    expect(decrementButton()).toBeDisabled();
  });

  it('reports value changes through onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" defaultValue={0} onValueChange={onValueChange} />);
    await user.click(incrementButton());
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(1);
  });

  it('controlled: keeps the value until the parent updates it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" value={5} onValueChange={onValueChange} />);
    await user.click(incrementButton());
    expect(spin()).toHaveValue('5');
    expect(onValueChange).toHaveBeenCalledWith(6);
  });

  it('sets aria-valuenow, aria-valuemin and aria-valuemax', () => {
    render(<SpinButton aria-label="Quantity" defaultValue={5} min={0} max={10} />);
    expect(spin()).toHaveAttribute('aria-valuenow', '5');
    expect(spin()).toHaveAttribute('aria-valuemin', '0');
    expect(spin()).toHaveAttribute('aria-valuemax', '10');
  });

  it('disables all controls when disabled', () => {
    render(<SpinButton aria-label="Quantity" disabled />);
    expect(incrementButton()).toBeDisabled();
    expect(decrementButton()).toBeDisabled();
    expect(spin()).toBeDisabled();
  });

  it('fires onValueChange exactly once per interaction in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <SpinButton aria-label="Quantity" onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.click(incrementButton());
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.click(spin());
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenCalledTimes(2);
    await user.clear(spin());
    await user.type(spin(), '7{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(onValueChange).toHaveBeenLastCalledWith(7);
  });

  it('keeps the deprecated onChange alias working and warns once', async () => {
    const warn = spyWarn();
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(<SpinButton aria-label="Quantity" onChange={onChange} />);
      rerender(<SpinButton aria-label="Quantity" onChange={onChange} />);
      await user.click(incrementButton());
      expect(onChange).toHaveBeenCalledWith(1);
      const deprecations = warnings(warn, 'SpinButton: `onChange` is deprecated');
      expect(deprecations).toHaveLength(1);
      expect(String(deprecations[0][0])).toContain('Use `onValueChange` instead.');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('SpinButton — typing (draft model, input-basic#2)', () => {
  it('lets a multi-digit value be typed when min is larger than the first digit', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SpinButton
        aria-label="Quantity"
        min={10}
        max={100}
        defaultValue={10}
        onValueChange={onValueChange}
      />,
    );
    await user.clear(spin());
    await user.type(spin(), '50');
    expect(spin()).toHaveValue('50');
    expect(onValueChange).not.toHaveBeenCalled();
    await user.tab();
    expect(spin()).toHaveValue('50');
    expect(spin()).toHaveAttribute('aria-valuenow', '50');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(50);
  });

  it('accepts decimals and commits on Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" onValueChange={onValueChange} />);
    await user.clear(spin());
    await user.type(spin(), '1.5');
    expect(spin()).toHaveValue('1.5');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(1.5);
    expect(spin()).toHaveValue('1.5');
  });

  it('accepts negative values', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" onValueChange={onValueChange} />);
    await user.clear(spin());
    await user.type(spin(), '-3');
    expect(spin()).toHaveValue('-3');
    expect(spin()).not.toHaveAttribute('aria-invalid');
    await user.tab();
    expect(onValueChange).toHaveBeenCalledWith(-3);
    expect(spin()).toHaveValue('-3');
  });

  it('clamps a typed value when it is committed', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" max={10} onValueChange={onValueChange} />);
    await user.clear(spin());
    await user.type(spin(), '50');
    await user.tab();
    expect(onValueChange).toHaveBeenCalledWith(10);
    expect(spin()).toHaveValue('10');
  });

  it('can be cleared while editing and reverts on blur', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" defaultValue={4} onValueChange={onValueChange} />);
    await user.clear(spin());
    expect(spin()).toHaveValue('');
    await user.tab();
    expect(spin()).toHaveValue('4');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('flags non-numeric text as invalid and reverts it on blur', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" defaultValue={4} onValueChange={onValueChange} />);
    await user.clear(spin());
    await user.type(spin(), 'abc');
    expect(spin()).toHaveValue('abc');
    expect(spin()).toHaveAttribute('aria-invalid', 'true');
    await user.tab();
    expect(spin()).toHaveValue('4');
    expect(spin()).not.toHaveAttribute('aria-invalid');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('Escape reverts the draft', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={4} />);
    await user.clear(spin());
    await user.type(spin(), '9{Escape}');
    expect(spin()).toHaveValue('4');
  });

  it('resyncs the draft when the value changes from outside', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SpinButton aria-label="Quantity" value={5} />);
    await user.clear(spin());
    await user.type(spin(), '7');
    rerender(<SpinButton aria-label="Quantity" value={9} />);
    expect(spin()).toHaveValue('9');
  });

  it('shows the real value after a controlled parent rejects a typed value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" value={5} onValueChange={onValueChange} />);
    await user.clear(spin());
    await user.type(spin(), '8{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(8);
    expect(spin()).toHaveValue('5');
  });
});

describe('SpinButton — decimal steps (input-basic#3)', () => {
  it('rounds to the step precision when stepping up and down', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" step={0.1} onValueChange={onValueChange} />);
    for (let i = 0; i < 3; i++) await user.click(incrementButton());
    expect(spin()).toHaveValue('0.3');
    expect(spin()).toHaveAttribute('aria-valuenow', '0.3');
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([0.1, 0.2, 0.3]);
    for (let i = 0; i < 3; i++) await user.click(decrementButton());
    expect(spin()).toHaveValue('0');
    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });

  it('keeps the precision of the value when it is finer than the step', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={1.25} step={0.1} />);
    await user.click(incrementButton());
    expect(spin()).toHaveValue('1.35');
  });

  it('reaches a decimal max exactly and disables increment there', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={0.1} step={0.1} max={0.3} />);
    await user.click(incrementButton());
    await user.click(incrementButton());
    expect(spin()).toHaveValue('0.3');
    expect(incrementButton()).toBeDisabled();
  });
});

describe('SpinButton — keyboard (input-basic#4)', () => {
  it('ArrowUp/ArrowDown step by step', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={5} step={2} />);
    await user.click(spin());
    await user.keyboard('{ArrowUp}');
    expect(spin()).toHaveValue('7');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(spin()).toHaveValue('3');
  });

  it('PageUp/PageDown step by ten steps, or by largeStep', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SpinButton aria-label="Quantity" defaultValue={50} />);
    await user.click(spin());
    await user.keyboard('{PageUp}');
    expect(spin()).toHaveValue('60');
    await user.keyboard('{PageDown}{PageDown}');
    expect(spin()).toHaveValue('40');
    rerender(<SpinButton aria-label="Quantity" defaultValue={50} largeStep={25} />);
    await user.keyboard('{PageUp}');
    expect(spin()).toHaveValue('65');
  });

  it('Home/End go to min/max when they are finite', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={5} min={-2} max={12} />);
    await user.click(spin());
    await user.keyboard('{End}');
    expect(spin()).toHaveValue('12');
    await user.keyboard('{Home}');
    expect(spin()).toHaveValue('-2');
  });

  it('Home/End leave the value alone without finite bounds', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" defaultValue={5} onValueChange={onValueChange} />);
    await user.click(spin());
    await user.keyboard('{Home}{End}');
    expect(spin()).toHaveValue('5');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('clamps at the bounds and emits nothing there', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SpinButton
        aria-label="Quantity"
        defaultValue={9}
        min={0}
        max={10}
        onValueChange={onValueChange}
      />,
    );
    await user.click(spin());
    await user.keyboard('{PageUp}');
    expect(spin()).toHaveValue('10');
    await user.keyboard('{ArrowUp}');
    expect(spin()).toHaveValue('10');
    expect(onValueChange.mock.calls).toEqual([[10]]);
  });

  it('steps from a typed draft', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={1} />);
    await user.clear(spin());
    await user.type(spin(), '7{ArrowUp}');
    expect(spin()).toHaveValue('8');
  });

  it('the +/- buttons follow the typed draft, like the arrow keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SpinButton aria-label="Quantity" min={0} max={5} value={0} onValueChange={onValueChange} />,
    );
    expect(decrementButton()).toBeDisabled();
    await user.clear(spin());
    await user.type(spin(), '3');
    // The committed value is still 0, but the draft 3 can be decremented.
    expect(decrementButton()).toBeEnabled();
    await user.click(decrementButton());
    expect(onValueChange).toHaveBeenLastCalledWith(2);
  });

  it('disables increment while the typed draft is at or above max', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" min={0} max={5} defaultValue={1} />);
    expect(incrementButton()).toBeEnabled();
    await user.clear(spin());
    await user.type(spin(), '5');
    expect(incrementButton()).toBeDisabled();
    expect(decrementButton()).toBeEnabled();
  });

  it('does not step while readOnly', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={3} readOnly />);
    await user.click(spin());
    await user.keyboard('{ArrowUp}{PageUp}');
    expect(spin()).toHaveValue('3');
    expect(incrementButton()).toBeDisabled();
  });

  it('the +/- buttons are not tab stops and keep focus on the spinbutton', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SpinButton aria-label="Quantity" defaultValue={8} max={10} />
        <button type="button">After</button>
      </>,
    );
    expect(incrementButton()).toHaveAttribute('tabindex', '-1');
    expect(decrementButton()).toHaveAttribute('tabindex', '-1');
    await user.click(spin());
    await user.click(incrementButton());
    await user.click(incrementButton());
    // The button reached the bound and became disabled, but focus never left the spinbutton.
    expect(incrementButton()).toBeDisabled();
    expect(spin()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });
});

describe('SpinButton — naming, routing and styling', () => {
  it('has no hard-coded "Value" name and warns in development when unnamed', () => {
    const warn = spyWarn();
    try {
      render(<SpinButton />);
      const input = screen.getByRole('spinbutton');
      expect(input).not.toHaveAttribute('aria-label');
      expect(warnings(warn, 'SpinButton: the spinbutton has no accessible name')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn when named by a <label>', () => {
    const warn = spyWarn();
    try {
      render(
        <>
          <label htmlFor="qty">Quantity</label>
          <SpinButton id="qty" />
        </>,
      );
      expect(spin()).toHaveAttribute('id', 'qty');
      expect(warnings(warn, 'SpinButton')).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });

  it('routes id, ARIA, input attributes and focus/keyboard handlers to the input (C-ROUTING)', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const ref = React.createRef<HTMLDivElement>();
    const controlRef = React.createRef<HTMLInputElement>();
    render(
      <>
        <span id="qty-help">Between 1 and 5</span>
        <SpinButton
          ref={ref}
          controlRef={controlRef}
          id="qty"
          aria-label="Quantity"
          aria-describedby="qty-help"
          placeholder="Amount"
          onKeyDown={onKeyDown}
          className="custom-root"
          data-testid="root"
        />
      </>,
    );
    const input = spin();
    expect(input).toHaveAttribute('id', 'qty');
    expect(input).toHaveAccessibleDescription('Between 1 and 5');
    expect(input).toHaveAttribute('placeholder', 'Amount');
    expect(controlRef.current).toBe(input);
    const root = screen.getByTestId('root');
    expect(ref.current).toBe(root);
    expect(root).toHaveClass('custom-root');
    expect(root).not.toHaveAttribute('id');
    await user.click(input);
    await user.keyboard('{ArrowUp}');
    expect(onKeyDown).toHaveBeenCalled();
    expect(input).toHaveValue('1');
  });

  it('routes spellCheck and maxLength to the input, not the root (C-ROUTING)', () => {
    render(
      <SpinButton aria-label="Quantity" spellCheck={false} maxLength={4} data-testid="root" />,
    );
    expect(spin()).toHaveAttribute('spellcheck', 'false');
    expect(spin()).toHaveAttribute('maxlength', '4');
    const root = screen.getByTestId('root');
    expect(root).not.toHaveAttribute('spellcheck');
    expect(root).not.toHaveAttribute('maxlength');
  });

  it('a consumer onKeyDown that prevents default suppresses stepping', async () => {
    const user = userEvent.setup();
    render(
      <SpinButton aria-label="Quantity" defaultValue={2} onKeyDown={(e) => e.preventDefault()} />,
    );
    await user.click(spin());
    await user.keyboard('{ArrowUp}');
    expect(spin()).toHaveValue('2');
  });

  it('shows focus with a bottom border on the wrapper (input-basic#5)', () => {
    render(<SpinButton aria-label="Quantity" data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root).toHaveClass('focus-within:border-b-2', 'focus-within:border-b-primary');
    expect(spin()).toHaveClass('focus:outline-hidden');
    expect(spin()).not.toHaveClass('outline-none');
    expect(spin()).not.toHaveClass('outline-hidden');
  });

  it('gates the button hover/pressed colors with the disabled state and uses tokens', () => {
    render(<SpinButton aria-label="Quantity" />);
    for (const button of [incrementButton(), decrementButton()]) {
      expect(button).toHaveClass(
        'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
        'not-disabled:not-aria-disabled:active:bg-subtle-pressed',
      );
      expect(button.className).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
    expect(decrementButton()).toHaveClass('border-e');
    expect(incrementButton()).toHaveClass('border-s');
  });

  it('draws the step glyphs with the shared decorative icons (§5.7)', () => {
    render(<SpinButton aria-label="Quantity" />);
    for (const [button, name] of [
      [incrementButton(), 'add'],
      [decrementButton(), 'subtract'],
    ] as const) {
      const svgs = button.querySelectorAll('svg');
      expect(svgs).toHaveLength(1);
      const svg = svgs[0];
      expect(svg).toHaveAttribute('data-wave-icon', name);
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      expect(svg).toHaveAttribute('width', '12');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    }
  });

  it('marks an invalid state on the wrapper', () => {
    render(<SpinButton aria-label="Quantity" aria-invalid data-testid="root" />);
    expect(spin()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('root')).toHaveClass('border-destructive');
  });

  it.each([
    [{ min: 0 }, 'numeric'],
    [{ min: 0, step: 0.5 }, 'decimal'],
    [{}, 'text'],
    [{ min: 0, inputMode: 'tel' as const }, 'tel'],
  ])('picks a virtual keyboard that can type the allowed values (%o → %s)', (props, expected) => {
    render(<SpinButton aria-label="Quantity" {...props} />);
    expect(spin()).toHaveAttribute('inputmode', expected);
  });
});

describe('SpinButton — Field integration (FieldContext)', () => {
  it('is labelled by the Field, described by hint and error, and natively required', () => {
    renderWithFieldContext(<SpinButton />, {
      hintId: FIELD_TEST_IDS.hintId,
      errorId: FIELD_TEST_IDS.errorId,
      required: true,
    });
    const input = screen.getByRole('spinbutton', { name: FIELD_TEST_TEXT.label });
    expect(input).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toBeRequired();
  });

  it('is labelled through aria-labelledby when it carries its own id', () => {
    renderWithFieldContext(<SpinButton id="own-id" />);
    expect(screen.getByRole('spinbutton', { name: FIELD_TEST_TEXT.label })).toHaveAttribute(
      'id',
      'own-id',
    );
  });
});

describe('SpinButton — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  it('submits the committed value under its name', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <SpinButton aria-label="Quantity" name="qty" defaultValue={2} step={0.5} />
      </form>,
    );
    expect(new FormData(getForm()).getAll('qty')).toEqual(['2']);
    await user.click(incrementButton());
    expect(new FormData(getForm()).getAll('qty')).toEqual(['2.5']);
    // A draft is not submitted until it is committed.
    await user.clear(spin());
    await user.type(spin(), '7');
    expect(new FormData(getForm()).getAll('qty')).toEqual(['2.5']);
  });

  it('adds nothing to FormData without a name', () => {
    render(
      <form aria-label="Form">
        <SpinButton aria-label="Quantity" defaultValue={3} />
      </form>,
    );
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('required makes the input natively required (an emptied field blocks submission)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <SpinButton aria-label="Quantity" name="qty" required />
      </form>,
    );
    expect(spin()).toBeRequired();
    expect(getForm().checkValidity()).toBe(true);
    await user.clear(spin());
    expect(getForm().checkValidity()).toBe(false);
  });

  it('form reset restores defaultValue (with and without a name)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <SpinButton aria-label="Named" name="qty" defaultValue={2} />
        <SpinButton aria-label="Unnamed" defaultValue={7} />
      </form>,
    );
    await user.click(screen.getAllByRole('button', { name: 'Increment' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Increment' })[1]);
    expect(spin('Named')).toHaveValue('3');
    expect(spin('Unnamed')).toHaveValue('8');
    act(() => getForm().reset());
    expect(spin('Named')).toHaveValue('2');
    expect(spin('Unnamed')).toHaveValue('7');
    expect(new FormData(getForm()).getAll('qty')).toEqual(['2']);
  });
});
