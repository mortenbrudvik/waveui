import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, type InputProps } from '../Input';
import {
  testSystemProps,
  testFocusEvents,
  renderWithProviders,
  expectNoA11yViolations,
} from '../../../test-utils';

describe('Input', () => {
  testSystemProps(Input, {
    expectedTag: 'input',
    displayName: 'Input',
    defaultProps: { 'aria-label': 'test' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'error message', props: { error: 'Required' } },
      { name: 'error flag', props: { error: true } },
    ],
    conflictingClass: { className: 'px-4', overrides: 'px-3' },
  });

  testFocusEvents(Input, { 'aria-label': 'test' }, 'input');

  it('declares ref in InputProps (C-REF)', () => {
    expectTypeOf<InputProps['ref']>().toEqualTypeOf<React.Ref<HTMLInputElement> | undefined>();
  });

  it('renders the placeholder', () => {
    render(<Input aria-label="Name" placeholder="Enter text" />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute(
      'placeholder',
      'Enter text',
    );
  });

  it('renders as a plain input without slots', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input').tagName.toLowerCase()).toBe('input');
  });

  describe('slots', () => {
    it('renders contentBefore as ReactNode shorthand', () => {
      render(<Input contentBefore={<span data-testid="before">$</span>} aria-label="Price" />);
      expect(screen.getByTestId('before').parentElement).toHaveClass('ps-2');
    });

    it('renders contentBefore as SlotObject', () => {
      render(
        <Input
          aria-label="Price"
          contentBefore={{
            children: <span data-testid="before-slot">$</span>,
            className: 'custom',
          }}
        />,
      );
      expect(screen.getByTestId('before-slot').parentElement).toHaveClass('custom');
    });

    it('renders contentAfter as ReactNode shorthand', () => {
      render(<Input contentAfter={<span data-testid="after">kg</span>} aria-label="Weight" />);
      expect(screen.getByTestId('after').parentElement).toHaveClass('pe-2');
    });

    it('renders contentAfter as SlotObject', () => {
      render(
        <Input
          aria-label="Weight"
          contentAfter={{ children: <span data-testid="after-slot">kg</span>, className: 'custom' }}
        />,
      );
      expect(screen.getByTestId('after-slot').parentElement).toHaveClass('custom');
    });

    it('wraps in a span with the focus-within recipe when a slot is provided', () => {
      const { container } = render(<Input aria-label="Price" contentBefore={<span>$</span>} />);
      const wrapper = container.firstElementChild;
      expect(wrapper?.tagName.toLowerCase()).toBe('span');
      expect(wrapper).toHaveClass('focus-within:border-b-2', 'focus-within:border-b-primary');
      expect(screen.getByRole('textbox', { name: 'Price' })).toHaveClass('focus:outline-hidden');
    });

    it('puts className, style and hidden on the bordered wrapper; ref, id, aria-* and data-* on the input', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(
        <Input
          ref={ref}
          aria-label="Price"
          contentBefore="$"
          id="price"
          data-testid="price"
          className="w-40"
          style={{ maxWidth: 160 }}
        />,
      );
      const input = screen.getByRole('textbox', { name: 'Price' });
      const wrapper = input.parentElement as HTMLElement;
      expect(wrapper.tagName.toLowerCase()).toBe('span');
      // The wrapper is the visible field: both sizing mechanisms reach it.
      expect(wrapper).toHaveClass('w-40');
      expect(wrapper).toHaveStyle({ maxWidth: '160px' });
      expect(input).not.toHaveAttribute('style');
      expect(input).not.toHaveClass('w-40');
      expect(ref.current).toBe(input);
      expect(input).toHaveAttribute('id', 'price');
      expect(screen.getByTestId('price')).toBe(input);
    });

    it('hides the whole field with hidden, not only the inner input', () => {
      const { container } = render(<Input aria-label="Price" contentAfter="kg" hidden />);
      const wrapper = container.firstElementChild as HTMLElement;
      // base.css's scoped `[hidden]` rule hides it over its `inline-flex`.
      expect(wrapper).toHaveAttribute('hidden');
      expect(wrapper.querySelector('input')).not.toHaveAttribute('hidden');
    });

    it('renders a plain input for slot values that render nothing (C-SLOTS)', () => {
      const showIcon = false;
      const { container } = render(
        <>
          <Input aria-label="Search" contentBefore={showIcon && <span>?</span>} className="w-40" />
          <Input aria-label="Weight" contentAfter="" contentBefore={[]} className="w-40" />
        </>,
      );
      for (const name of ['Search', 'Weight']) {
        const input = screen.getByRole('textbox', { name });
        expect(input.parentElement).toBe(container);
        expect(input).toHaveClass('w-40', 'px-3');
      }
      expect(container.querySelector('span')).toBeNull();
    });

    it('keeps className, style and hidden on the input without slots', () => {
      const { container } = render(
        <Input aria-label="Name" className="w-40" style={{ maxWidth: 160 }} hidden />,
      );
      const input = container.firstElementChild as HTMLElement;
      expect(input.tagName.toLowerCase()).toBe('input');
      expect(input).toHaveClass('w-40');
      expect(input).toHaveStyle({ maxWidth: '160px' });
      expect(input).toHaveAttribute('hidden');
    });

    it('uses logical padding for the slots in RTL (C-LOGICAL)', () => {
      renderWithProviders(
        <Input
          aria-label="Price"
          contentBefore={<span data-testid="before">$</span>}
          contentAfter={<span data-testid="after">kr</span>}
        />,
        { dir: 'rtl' },
      );
      expect(screen.getByTestId('before').parentElement).toHaveClass('shrink-0', 'ps-2');
      expect(screen.getByTestId('after').parentElement).toHaveClass('shrink-0', 'pe-2');
      const className = screen.getByTestId('before').parentElement?.parentElement?.className ?? '';
      expect(className).not.toMatch(/\b(pl|pr|ml|mr)-/);
    });
  });

  describe('tokens (button-provider#3, input-basic#7)', () => {
    it('uses the accessible stroke for the bottom border and token placeholder', () => {
      render(<Input aria-label="Name" />);
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveClass(
        'border-input',
        'border-b-stroke-accessible',
        'placeholder:text-muted-foreground',
        'focus:outline-hidden',
        'focus:border-b-primary',
      );
      expect(input.className).not.toMatch(/#[0-9a-f]{3,8}|outline-none/i);
    });

    it('uses the accessible stroke on the slot wrapper', () => {
      const { container } = render(<Input aria-label="Price" contentBefore="$" />);
      expect(container.firstElementChild).toHaveClass('border-input', 'border-b-stroke-accessible');
      expect(screen.getByRole('textbox', { name: 'Price' })).toHaveClass(
        'placeholder:text-muted-foreground',
      );
    });
  });

  describe('error (input-basic#24)', () => {
    it('renders a string error as a sibling alert that describes the input', () => {
      const { container } = render(<Input aria-label="Email" error="Email is required" />);
      const input = screen.getByRole('textbox', { name: 'Email' });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Email is required');
      expect(alert.tagName.toLowerCase()).toBe('span');
      expect(alert).toHaveClass('text-caption-1', 'text-error');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription('Email is required');
      expect(input).toHaveAttribute('aria-errormessage', alert.id);
      // The control stays the first (root) element; the message is its next sibling.
      expect(container.firstElementChild).toBe(input);
      expect(input.nextElementSibling).toBe(alert);
    });

    it('keeps ref and className on the control when the message renders', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} aria-label="Email" className="w-64" error="Required" />);
      const input = screen.getByRole('textbox', { name: 'Email' });
      expect(ref.current).toBe(input);
      expect(input).toHaveClass('w-64', 'border-destructive');
      expect(screen.getByRole('alert')).not.toHaveClass('w-64');
    });

    it('renders the message after the slot wrapper', () => {
      const { container } = render(
        <Input aria-label="Price" contentBefore="$" error="Price is required" />,
      );
      expect(container.firstElementChild?.tagName.toLowerCase()).toBe('span');
      expect(container.firstElementChild?.nextElementSibling).toBe(screen.getByRole('alert'));
      expect(screen.getByRole('textbox', { name: 'Price' })).toHaveAccessibleDescription(
        'Price is required',
      );
    });

    it('joins the message id with the consumer aria-describedby', () => {
      render(
        <>
          <span id="help">Use your work address</span>
          <Input aria-label="Email" aria-describedby="help" error="Invalid address" />
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
        'Use your work address Invalid address',
      );
    });

    it('customises the message element with errorMessageProps', () => {
      render(
        <Input
          aria-label="Email"
          error="Required"
          errorMessageProps={{ id: 'email-error', className: 'font-semibold' }}
        />,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('id', 'email-error');
      expect(alert).toHaveClass('font-semibold', 'text-error');
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
        'aria-describedby',
        'email-error',
      );
    });

    it('error={true} keeps the flag-only look without a message', () => {
      render(<Input aria-label="Email" error />);
      const input = screen.getByRole('textbox', { name: 'Email' });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveClass('border-destructive');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('does not set aria-invalid without an error', () => {
      render(<Input aria-label="Email" />);
      expect(screen.getByRole('textbox', { name: 'Email' })).not.toHaveAttribute('aria-invalid');
    });

    it('matches the error border to aria-invalid="true" set by the consumer (input-basic#1)', () => {
      render(
        <>
          <Input aria-label="Plain" aria-invalid />
          <Input aria-label="Slotted" aria-invalid="true" contentAfter="kg" />
          <Input aria-label="Spelling" aria-invalid="spelling" />
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Plain' })).toHaveClass('border-destructive');
      expect(screen.getByRole('textbox', { name: 'Slotted' }).parentElement).toHaveClass(
        'border-destructive',
      );
      expect(screen.getByRole('textbox', { name: 'Spelling' })).not.toHaveClass(
        'border-destructive',
      );
    });

    it('lets the consumer aria-invalid={false} win: no error border and no message', () => {
      render(
        <>
          <Input aria-label="Email" error="Checking" aria-invalid={false} />
          <Input aria-label="Price" error="Too high" aria-invalid="false" contentAfter="kg" />
          <Input aria-label="Name" error aria-invalid={false} />
        </>,
      );
      const email = screen.getByRole('textbox', { name: 'Email' });
      const price = screen.getByRole('textbox', { name: 'Price' });
      const name = screen.getByRole('textbox', { name: 'Name' });
      expect(email).toHaveAttribute('aria-invalid', 'false');
      expect(price).toHaveAttribute('aria-invalid', 'false');
      expect(name).toHaveAttribute('aria-invalid', 'false');
      // The look matches the state assistive technology reports (valid).
      expect(email).not.toHaveClass('border-destructive');
      expect(price.parentElement).not.toHaveClass('border-destructive');
      expect(name).not.toHaveClass('border-destructive');
      // No error message is rendered, announced or referenced for a valid control.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Checking')).not.toBeInTheDocument();
      expect(screen.queryByText('Too high')).not.toBeInTheDocument();
      for (const control of [email, price, name]) {
        expect(control).not.toHaveAttribute('aria-describedby');
        expect(control).not.toHaveAttribute('aria-errormessage');
      }
    });

    it('keeps the error border and message with a consumer aria-invalid="spelling"', () => {
      render(<Input aria-label="Title" error="Check the spelling" aria-invalid="spelling" />);
      const input = screen.getByRole('textbox', { name: 'Title' });
      expect(input).toHaveAttribute('aria-invalid', 'spelling');
      expect(input).toHaveClass('border-destructive');
      expect(input).toHaveAccessibleDescription('Check the spelling');
      expect(input).toHaveAttribute('aria-errormessage', screen.getByRole('alert').id);
    });

    it('passes axe with a string error', async () => {
      render(<Input aria-label="Email" error="Email is required" />);
      await expectNoA11yViolations();
    });
  });

  describe('onValueChange (input-basic#29, repo-level#16)', () => {
    it('calls onValueChange with the string value next to the native onChange', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(<Input aria-label="Name" onChange={onChange} onValueChange={onValueChange} />);
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'hello');
      expect(onChange).toHaveBeenCalledTimes(5);
      expect(onChange.mock.calls[0][0]).toHaveProperty('target');
      expect(onValueChange).toHaveBeenCalledTimes(5);
      expect(onValueChange).toHaveBeenLastCalledWith('hello');
    });

    it('supports the natural controlled example with onValueChange', async () => {
      const user = userEvent.setup();
      function Example() {
        const [name, setName] = React.useState('');
        return (
          <>
            <Input aria-label="Name" value={name} onValueChange={setName} />
            <output>{name}</output>
          </>
        );
      }
      render(<Example />);
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
      expect(screen.getByRole('status')).toHaveTextContent('Ada');
    });

    it('fires onValueChange once per change in StrictMode', () => {
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Input aria-label="Name" onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'x' } });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('x');
    });
  });
});
