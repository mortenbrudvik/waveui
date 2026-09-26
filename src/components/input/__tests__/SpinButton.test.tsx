import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SpinButton,
  type SpinButtonLabels,
  type SpinButtonProps,
  type SpinButtonAllowEmptyProps,
} from '../SpinButton';
import { inputInvalidWithin } from '../../../lib/styles';
import { testFocusEvents, testSystemProps, renderWithProviders } from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

const spin = (name = 'Quantity') => screen.getByRole('spinbutton', { name });
const incrementButton = () => screen.getByRole('button', { name: 'Increment' });
const decrementButton = () => screen.getByRole('button', { name: 'Decrement' });

function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

const UNNAMED_WARNING =
  '[WaveUI] SpinButton: the spinbutton has no accessible name. Pass `aria-label` or ' +
  '`aria-labelledby`, use a <label htmlFor>, or render it inside a Field.';

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
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] SpinButton: `onChange` is deprecated and will be removed in 1.0. Use ' +
            '`onValueChange` instead.',
        ],
      ]);
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

  it('consumes the Escape that reverts a draft; without a draft Escape reaches enclosing layers (C-POPUPS)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" defaultValue={4} onValueChange={onValueChange} />);
    // Wave's layer stack (Dialog, Drawer, Popover) listens on the document and skips prevented
    // events: a prevented Escape keeps an enclosing Dialog open.
    const prevented: boolean[] = [];
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') prevented.push(event.defaultPrevented);
    };
    document.addEventListener('keydown', listener);
    try {
      await user.clear(spin());
      await user.type(spin(), '9{Escape}');
      expect(spin()).toHaveValue('4');
      await user.keyboard('{Escape}');
      expect(prevented).toEqual([true, false]);
      expect(spin()).toHaveValue('4');
      expect(onValueChange).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', listener);
    }
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

  // step * 10 carries float error for many decimal steps (0.07 * 10 = 0.7000000000000001).
  it.each([
    [0.07, 0.7],
    [0.09, 0.9],
    [0.14, 1.4],
    [0.33, 3.3],
  ])('PageUp/PageDown with step=%s move by exactly ten steps', async (step, big) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" step={step} onValueChange={onValueChange} />);
    await user.click(spin());
    await user.keyboard('{PageUp}');
    expect(spin()).toHaveValue(String(big));
    expect(spin()).toHaveAttribute('aria-valuenow', String(big));
    expect(onValueChange).toHaveBeenLastCalledWith(big);
    await user.keyboard('{PageDown}{PageDown}');
    expect(spin()).toHaveValue(String(-big));
    expect(onValueChange).toHaveBeenLastCalledWith(-big);
  });

  it('keeps the precision of a largeStep finer than the step', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" step={1} largeStep={0.25} />);
    await user.click(spin());
    await user.keyboard('{PageUp}{PageUp}{PageUp}');
    expect(spin()).toHaveValue('0.75');
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
      expect(warn.mock.calls).toEqual([[UNNAMED_WARNING]]);
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
      expect(warn).not.toHaveBeenCalled();
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

  it('marks an invalid state on the wrapper with the shared recipe', () => {
    render(<SpinButton aria-label="Quantity" aria-invalid data-testid="root" />);
    expect(spin()).toHaveAttribute('aria-invalid', 'true');
    const root = screen.getByTestId('root');
    expect(root).toHaveClass(...inputInvalidWithin.split(' '));
    // Keeps the destructive border and shows the focus color on the focused bottom border
    // (Phase 4 D4).
    expect(root).toHaveClass('focus-within:border-b-primary');
    for (const replaced of ['border-input', 'border-b-stroke-accessible']) {
      expect(root).not.toHaveClass(replaced);
    }
  });

  it.each([['grammar'], ['spelling']] as const)(
    'passes aria-invalid="%s" through unchanged, without the error look',
    (token) => {
      render(<SpinButton aria-label="Quantity" aria-invalid={token} data-testid="root" />);
      expect(spin()).toHaveAttribute('aria-invalid', token);
      const root = screen.getByTestId('root');
      expect(root).not.toHaveClass('border-destructive');
      expect(root).toHaveClass('border-input');
    },
  );

  it('flags typed text that is not a number although the consumer passes aria-invalid={false}', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" aria-invalid={false} data-testid="root" />);
    expect(spin()).toHaveAttribute('aria-invalid', 'false');
    await user.clear(spin());
    await user.type(spin(), 'abc');
    expect(spin()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('root')).toHaveClass('border-destructive');
  });

  it('gives the step buttons their own padding and background, so an app-wide button rule cannot fill them (C-NATIVE)', () => {
    render(<SpinButton aria-label="Quantity" />);
    for (const button of [incrementButton(), decrementButton()]) {
      expect(button).toHaveClass('p-0');
      expect(button).toHaveClass('bg-transparent');
    }
  });

  it('puts hidden on the root, the visible field (not on the input)', () => {
    render(<SpinButton aria-label="Quantity" hidden data-testid="root" />);
    // base.css's scoped `[hidden]` rule hides it over its `inline-flex`.
    expect(screen.getByTestId('root')).toHaveAttribute('hidden');
    expect(screen.getByRole('spinbutton', { hidden: true })).not.toHaveAttribute('hidden');
  });

  it('names the step buttons with labels', async () => {
    const user = userEvent.setup();
    const labels: SpinButtonLabels = { increment: 'Augmenter', decrement: 'Diminuer' };
    render(<SpinButton aria-label="Quantité" defaultValue={2} labels={labels} />);
    await user.click(screen.getByRole('button', { name: 'Augmenter' }));
    expect(spin('Quantité')).toHaveValue('3');
    await user.click(screen.getByRole('button', { name: 'Diminuer' }));
    await user.click(screen.getByRole('button', { name: 'Diminuer' }));
    expect(spin('Quantité')).toHaveValue('1');
    expect(screen.queryByRole('button', { name: 'Increment' })).toBeNull();
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

  it('Enter commits the typed draft and still submits the form with it', async () => {
    const user = userEvent.setup();
    const submitted: unknown[] = [];
    render(
      <form
        aria-label="Form"
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get('qty'));
        }}
      >
        <SpinButton aria-label="Quantity" name="qty" defaultValue={2} />
        <button type="submit">Save</button>
      </form>,
    );
    await user.clear(spin());
    await user.type(spin(), '7{Enter}');
    expect(submitted).toEqual(['7']);
    expect(spin()).toHaveValue('7');
  });

  it('a disabled spin button submits nothing', () => {
    render(
      <form aria-label="Form">
        <SpinButton aria-label="Quantity" name="qty" defaultValue={3} disabled />
      </form>,
    );
    expect(new FormData(getForm()).getAll('qty')).toEqual([]);
  });

  it('form reset clears a typed draft although the value already equals defaultValue', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <form aria-label="Form">
        <SpinButton aria-label="Quantity" defaultValue={4} onValueChange={onValueChange} />
      </form>,
    );
    await user.clear(spin());
    await user.type(spin(), 'abc');
    expect(spin()).toHaveAttribute('aria-invalid', 'true');
    // A programmatic reset while the input keeps focus (no blur commits or reverts the draft).
    act(() => getForm().reset());
    expect(spin()).toHaveFocus();
    expect(spin()).toHaveValue('4');
    expect(spin()).not.toHaveAttribute('aria-invalid');
    expect(onValueChange).not.toHaveBeenCalled();
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

describe('sizes, appearances and geometry (Phase 4 D13, D20)', () => {
  const root = () => spin().closest('[data-size]') as HTMLElement;

  it('medium outline: a 32px root, full-height 32px-wide buttons, a 48px flexible input', () => {
    render(<SpinButton aria-label="Quantity" />);
    expect(root()).toHaveClass('h-8', 'text-body-1', 'border-input', 'bg-background');
    expect(root()).toHaveAttribute('data-size', 'medium');
    expect(root()).toHaveAttribute('data-appearance', 'outline');
    expect(incrementButton()).toHaveClass('h-full', 'w-8', 'border-s', 'border-input');
    expect(decrementButton()).toHaveClass('h-full', 'w-8', 'border-e', 'border-input');
    expect(spin()).toHaveClass('h-full', 'w-12', 'flex-auto', 'min-w-0', 'text-body-1');
  });

  it.each([
    ['small', 'h-6', 'w-6', 'w-10', 'text-caption-1'],
    ['large', 'h-10', 'w-10', 'w-14', 'text-body-2'],
  ] as const)('size="%s"', (size, rootHeight, buttonWidth, inputWidth, text) => {
    render(<SpinButton aria-label="Quantity" size={size} />);
    expect(root()).toHaveClass(rootHeight, text);
    expect(incrementButton()).toHaveClass(buttonWidth);
    expect(spin()).toHaveClass(inputWidth);
  });

  it('the separators render only in outline; on filled-darker the buttons hover one step darker', () => {
    render(<SpinButton aria-label="Quantity" appearance="filled-darker" />);
    expect(root()).toHaveClass('bg-input-filled-darker');
    expect(incrementButton()).not.toHaveClass('border-s');
    expect(decrementButton()).not.toHaveClass('border-e');
    expect(incrementButton()).toHaveClass('not-disabled:not-aria-disabled:hover:bg-subtle-pressed');
    // tailwind-merge must not silently keep the outline hover class alongside the filled-darker one.
    expect(incrementButton()).not.toHaveClass(
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
    );
  });

  it('takes the Field size', () => {
    renderWithFieldContext(<SpinButton />, { size: 'large' });
    const el = screen.getByRole('spinbutton', { name: FIELD_TEST_TEXT.label });
    expect(el.closest('[data-size]')).toHaveAttribute('data-size', 'large');
  });

  // The cases below are the rest of §2.1's "Tests (per control, in its test file)" paragraph
  // (binding for every text control, SpinButton included), beyond what the brief's tests above
  // cover: every appearance's classes and attribute, an own size winning over the Field's, the
  // provider's inputDefaults with an own prop winning, and the invalid look at underline and
  // filled-darker, through the Field and through the control's own invalid state.

  it.each([
    ['underline', ['rounded-none', 'border-0', 'border-b', 'bg-transparent']],
    ['filled-darker', ['border-input-filled-stroke', 'bg-input-filled-darker']],
    ['filled-lighter', ['border-input-filled-stroke', 'bg-input-filled-lighter']],
  ] as const)(
    'appearance="%s" renders its classes and attribute, with no separators',
    (appearance, classes) => {
      render(<SpinButton aria-label="Quantity" appearance={appearance} />);
      expect(root()).toHaveClass(...classes);
      expect(root()).toHaveAttribute('data-appearance', appearance);
      expect(incrementButton()).not.toHaveClass('border-s');
      expect(decrementButton()).not.toHaveClass('border-e');
    },
  );

  it("the SpinButton's own size wins over the Field size", () => {
    const { rerender } = renderWithFieldContext(<SpinButton />, { size: 'large' });
    const fieldRoot = () =>
      screen
        .getByRole('spinbutton', { name: FIELD_TEST_TEXT.label })
        .closest('[data-size]') as HTMLElement;
    expect(fieldRoot()).toHaveAttribute('data-size', 'large');
    rerender(<SpinButton size="small" />);
    expect(fieldRoot()).toHaveAttribute('data-size', 'small');
  });

  it('takes WaveProvider inputDefaults; its own props win', () => {
    const { rerender } = renderWithProviders(<SpinButton aria-label="Quantity" />, {
      inputDefaults: { size: 'small', appearance: 'underline' },
    });
    expect(root()).toHaveAttribute('data-size', 'small');
    expect(root()).toHaveAttribute('data-appearance', 'underline');
    rerender(<SpinButton aria-label="Quantity" size="large" appearance="outline" />);
    expect(root()).toHaveAttribute('data-size', 'large');
    expect(root()).toHaveAttribute('data-appearance', 'outline');
  });

  it.each(['underline', 'filled-darker'] as const)(
    "typed non-numeric text (the control's own invalid state) keeps the destructive border at %s",
    async (appearance) => {
      const user = userEvent.setup();
      render(<SpinButton aria-label="Quantity" appearance={appearance} />);
      await user.clear(spin());
      await user.type(spin(), 'abc');
      expect(root()).toHaveClass('border-destructive', 'focus-within:border-b-primary');
    },
  );

  it.each(['underline', 'filled-darker'] as const)(
    'a Field error at %s keeps the destructive border and the focus color on its bottom',
    (appearance) => {
      renderWithFieldContext(<SpinButton appearance={appearance} />, {
        errorId: FIELD_TEST_IDS.errorId,
      });
      const wrapper = screen
        .getByRole('spinbutton', { name: FIELD_TEST_TEXT.label })
        .closest('[data-size]') as HTMLElement;
      expect(wrapper).toHaveClass('border-destructive', 'focus-within:border-b-primary');
    },
  );
});

describe('allowEmpty (Phase 4 D16, D17)', () => {
  it('starts empty without a value: no text, no aria-valuenow', () => {
    render(<SpinButton aria-label="Quantity" allowEmpty />);
    expect(spin()).toHaveValue('');
    expect(spin()).not.toHaveAttribute('aria-valuenow');
  });

  it('clearing and committing emits null once (blur and Enter), in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <SpinButton
          aria-label="Quantity"
          allowEmpty
          defaultValue={3}
          onValueChange={onValueChange}
        />
      </React.StrictMode>,
    );
    await user.clear(spin());
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(spin()).toHaveValue('');
  });

  // The spec's Tests paragraph lists both commit paths ("on blur and on Enter"); the case above
  // exercises Enter, this one blur (spec case added beyond the brief).
  it('clearing and committing on blur emits null once, in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <SpinButton
          aria-label="Quantity"
          allowEmpty
          defaultValue={3}
          onValueChange={onValueChange}
        />
      </React.StrictMode>,
    );
    await user.clear(spin());
    await user.tab();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(spin()).toHaveValue('');
  });

  it('without allowEmpty, clearing still reverts (0.7)', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={3} />);
    await user.clear(spin());
    await user.tab();
    expect(spin()).toHaveValue('3');
  });

  it('stepping from empty starts at 0 and clamps: min 1 gives 1 both ways', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SpinButton aria-label="Quantity" allowEmpty min={1} />);
    // Phase 4 D15 tracks focus (for displayValue): a bare .focus() now updates state too.
    act(() => spin().focus());
    await user.keyboard('{ArrowUp}');
    expect(spin()).toHaveValue('1');
    unmount();
    render(<SpinButton aria-label="Quantity" allowEmpty min={1} />);
    act(() => spin().focus());
    await user.keyboard('{ArrowDown}');
    expect(spin()).toHaveValue('1');
  });

  it('keeps both step buttons enabled while empty', () => {
    render(<SpinButton aria-label="Quantity" allowEmpty min={0} max={10} />);
    expect(incrementButton()).toBeEnabled();
    expect(decrementButton()).toBeEnabled();
  });

  it('required and empty: the hidden input blocks the submit and focuses the spinbutton', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit} aria-label="Order">
        <SpinButton aria-label="Quantity" allowEmpty required name="qty" />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    // Phase 4 D15 tracks focus (for displayValue): checkValidity() fires `invalid` on the empty
    // required hidden input, whose handler now updates that state too.
    act(() => {
      expect(form.checkValidity()).toBe(false);
    });
    const hidden = form.elements.namedItem('qty') as HTMLInputElement;
    expect(hidden.validity.valueMissing).toBe(true);
    act(() => form.requestSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(spin()).toHaveFocus();
  });

  it('submits "" through the hidden input and resets to null', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <SpinButton aria-label="Quantity" allowEmpty name="qty" />
        <button type="reset">Reset</button>
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    expect(new FormData(form).get('qty')).toBe('');
    // Phase 4 D15 tracks focus (for displayValue): a bare .focus() now updates state too.
    act(() => spin().focus());
    await user.keyboard('{ArrowUp}');
    expect(new FormData(form).get('qty')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(spin()).toHaveValue('');
  });

  it('a controlled null from outside replaces a typed draft (Review Focus 4)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SpinButton aria-label="Quantity" allowEmpty value={5} onValueChange={() => {}} />,
    );
    await user.type(spin(), '7');
    expect(spin()).toHaveValue('57');
    rerender(<SpinButton aria-label="Quantity" allowEmpty value={null} onValueChange={() => {}} />);
    expect(spin()).toHaveValue('');
  });

  it('types: null only with allowEmpty; onChange readable on the union', () => {
    expectTypeOf<SpinButtonProps['value']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SpinButtonAllowEmptyProps['value']>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<React.ComponentProps<typeof SpinButton>>().toEqualTypeOf<
      SpinButtonProps | SpinButtonAllowEmptyProps
    >();
    expectTypeOf<SpinButtonProps['onValueChange']>().toEqualTypeOf<
      ((value: number) => void) | undefined
    >();
    expectTypeOf<SpinButtonAllowEmptyProps['onValueChange']>().toEqualTypeOf<
      ((value: number | null) => void) | undefined
    >();
    type Props = React.ComponentProps<typeof SpinButton>;
    expectTypeOf<Props['onChange']>().toEqualTypeOf<((value: number) => void) | undefined>();
    interface Wrapper extends SpinButtonProps {
      hint?: string;
    }
    expectTypeOf<Wrapper['value']>().toEqualTypeOf<number | undefined>();
    // @ts-expect-error null needs allowEmpty
    render(<SpinButton aria-label="Quantity" value={null} />);
    const flag: boolean = Math.random() > 1;
    // @ts-expect-error a boolean variable fits neither member
    render(<SpinButton aria-label="Quantity" allowEmpty={flag} value={null} />);
  });
});

describe('displayValue (Phase 4 D15)', () => {
  function Currency(props: { readOnly?: boolean }) {
    const [value, setValue] = React.useState(1);
    return (
      <SpinButton
        aria-label="Price"
        value={value}
        onValueChange={setValue}
        displayValue={`$${value.toFixed(2)}`}
        {...props}
      />
    );
  }
  const price = () => screen.getByRole('spinbutton', { name: 'Price' });

  it('shows displayValue and uses it as aria-valuetext while not focused', () => {
    render(<Currency />);
    expect(price()).toHaveValue('$1.00');
    expect(price()).toHaveAttribute('aria-valuetext', '$1.00');
    expect(price()).toHaveAttribute('aria-valuenow', '1');
  });

  it('shows the plain number while focused and editable, and displayValue again after blur', async () => {
    const user = userEvent.setup();
    render(<Currency />);
    await user.click(price());
    expect(price()).toHaveValue('1');
    expect(price()).toHaveAttribute('aria-valuetext', '$1.00');
    await user.keyboard('{ArrowUp}');
    expect(price()).toHaveValue('2');
    expect(price()).toHaveAttribute('aria-valuetext', '$2.00');
    await user.tab();
    expect(price()).toHaveValue('$2.00');
  });

  it('reselects the whole text when the focus switch happens with everything selected', () => {
    render(<Currency />);
    const input = price() as HTMLInputElement;
    input.setSelectionRange(0, input.value.length);
    act(() => input.focus());
    expect(input.value).toBe('1');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
  });

  it('keeps displayValue while focused but read-only', async () => {
    const user = userEvent.setup();
    render(<Currency readOnly />);
    await user.click(price());
    expect(price()).toHaveValue('$1.00');
  });

  it('a consumer aria-valuetext wins', () => {
    render(
      <SpinButton aria-label="Price" value={1} displayValue="$1.00" aria-valuetext="one dollar" />,
    );
    expect(price()).toHaveAttribute('aria-valuetext', 'one dollar');
  });

  it('is ignored when uncontrolled, with one warning', () => {
    const warn = spyWarn();
    try {
      render(<SpinButton aria-label="Price" defaultValue={1} displayValue="$1.00" />);
      expect(price()).toHaveValue('1');
      expect(price()).not.toHaveAttribute('aria-valuetext');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] SpinButton: `displayValue` is ignored while the value is uncontrolled; pass `value` (and update it in `onValueChange`).',
      );
    } finally {
      warn.mockRestore();
    }
  });

  // Deferred from Task B6 (spec §2 P4-02 Tests: "required + empty: … also when a `displayValue`
  // is shown for the empty value"), for a controlled value with allowEmpty. D15's "while focused
  // and editable it shows the plain number" and D17's "while focused and editable, an empty value
  // shows '' (never String(null))" both win over displayValue, so right after committing to null
  // with Enter (which keeps focus) the field shows the empty text, not a display string. D17 also
  // explains why the *hidden* input, not the visible one, decides validity: once blurred, the
  // visible input legitimately shows its displayValue for the empty value, so its own `required`
  // cannot catch the empty value (spec case added beyond the brief).
  it('with a controlled value and displayValue, clearing and committing to null shows the empty text while still focused and the display text once blurred; required still blocks the empty value through the hidden input', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function Order() {
      const [value, setValue] = React.useState<number | null>(3);
      return (
        <form onSubmit={onSubmit} aria-label="Order">
          <SpinButton
            aria-label="Quantity"
            allowEmpty
            required
            name="qty"
            value={value}
            onValueChange={(next) => {
              onValueChange(next);
              setValue(next);
            }}
            displayValue={value === null ? 'No value' : `${value} units`}
          />
        </form>
      );
    }
    render(<Order />);
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;

    // Not focused yet: the empty-value rule does not apply (value is 3), so displayValue shows.
    expect(spin()).toHaveValue('3 units');
    await user.click(spin());
    // Focused: the plain number, not the display text (D15).
    expect(spin()).toHaveValue('3');
    await user.clear(spin());
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(null);
    // Still focused right after commit: the focused/editable rule wins over displayValue even
    // for the empty value.
    expect(spin()).toHaveValue('');
    expect(onSubmit).not.toHaveBeenCalled();

    await user.tab();
    // Blurred: the empty value now shows its displayValue ("shown for the empty value") — yet
    // the hidden input, not this visible text, decides validity.
    expect(spin()).toHaveValue('No value');
    // checkValidity() fires `invalid` on the empty required hidden input, whose handler focuses
    // the spinbutton (a state update, since Phase 4 D15 tracks focus for displayValue).
    act(() => {
      expect(form.checkValidity()).toBe(false);
    });
    const hidden = form.elements.namedItem('qty') as HTMLInputElement;
    expect(hidden.validity.valueMissing).toBe(true);
    act(() => form.requestSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(spin()).toHaveFocus();
  });
});
