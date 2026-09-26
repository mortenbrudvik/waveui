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
import { renderWithFieldContext, FIELD_TEST_TEXT } from '../../../test-utils-field';
import type { CoreSize } from '../../../lib/types';

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

    it('a disabled field with slots keeps a focus ring inside it at full strength', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Input
            aria-label="Price"
            disabled
            contentAfter={<button type="button">Currency help</button>}
          />
          <Input aria-label="Weight" contentAfter="kg" />
        </>,
      );
      await user.tab();
      expect(screen.getByRole('button', { name: 'Currency help' })).toHaveFocus();
      // The wrapper's opacity dims the outline of focusable slot content too, which would put the
      // ring below 3:1 (the disabled input never takes focus). tailwind-merge keeps both classes
      // (different variants); the variant wins while it matches.
      expect(screen.getByRole('textbox', { name: 'Price' }).parentElement).toHaveClass(
        'opacity-50',
        'has-focus-visible:opacity-100',
      );
      expect(screen.getByRole('textbox', { name: 'Weight' }).parentElement?.className).not.toMatch(
        /opacity/,
      );
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

describe('sizes and appearances (Phase 4 P4-01)', () => {
  const field = (name = 'Name') => screen.getByRole('textbox', { name });

  it('renders the 0.7 classes and medium outline attributes by default', () => {
    render(<Input aria-label="Name" />);
    expect(field()).toHaveClass(
      'h-8',
      'w-full',
      'px-3',
      'text-body-1',
      'rounded',
      'border',
      'border-input',
      'border-b-stroke-accessible',
      'bg-background',
    );
    expect(field()).toHaveAttribute('data-size', 'medium');
    expect(field()).toHaveAttribute('data-appearance', 'outline');
  });

  it.each([
    ['small', ['h-6', 'px-2', 'text-caption-1']],
    ['large', ['h-10', 'px-4', 'text-body-2']],
  ] as const)('size="%s" renders its height, padding and type ramp', (size, classes) => {
    render(<Input aria-label="Name" size={size} />);
    expect(field()).toHaveClass(...classes);
    expect(field()).toHaveAttribute('data-size', size);
  });

  it.each([
    ['underline', ['rounded-none', 'border-0', 'border-b', 'bg-transparent']],
    ['filled-darker', ['border-input-filled-stroke', 'bg-input-filled-darker']],
    ['filled-lighter', ['border-input-filled-stroke', 'bg-input-filled-lighter']],
  ] as const)('appearance="%s" renders its classes', (appearance, classes) => {
    render(<Input aria-label="Name" appearance={appearance} />);
    expect(field()).toHaveClass(...classes);
    expect(field()).toHaveAttribute('data-appearance', appearance);
  });

  it('takes the Field size; its own size wins', () => {
    const { rerender } = renderWithFieldContext(<Input />, { size: 'large' });
    expect(field(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'large');
    rerender(<Input size="small" />);
    expect(field(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'small');
  });

  it('takes WaveProvider inputDefaults; its own props win', () => {
    const { rerender } = renderWithProviders(<Input aria-label="Name" />, {
      inputDefaults: { size: 'small', appearance: 'underline' },
    });
    expect(field()).toHaveAttribute('data-size', 'small');
    expect(field()).toHaveAttribute('data-appearance', 'underline');
    rerender(<Input aria-label="Name" size="large" appearance="outline" />);
    expect(field()).toHaveAttribute('data-size', 'large');
    expect(field()).toHaveAttribute('data-appearance', 'outline');
  });

  it('updates classes and attributes when size and appearance change (Review Focus 2)', () => {
    const { rerender } = render(<Input aria-label="Name" size="small" />);
    rerender(<Input aria-label="Name" size="large" appearance="filled-darker" />);
    expect(field()).toHaveClass('h-10', 'bg-input-filled-darker');
    expect(field()).not.toHaveClass('h-6', 'bg-background');
    expect(field()).toHaveAttribute('data-size', 'large');
    expect(field()).toHaveAttribute('data-appearance', 'filled-darker');
  });

  it.each(['underline', 'filled-darker'] as const)(
    'an invalid %s field keeps the destructive border and the focus color on its bottom',
    (appearance) => {
      render(<Input aria-label="Name" appearance={appearance} error />);
      expect(field()).toHaveClass('border-destructive', 'focus:border-b-primary');
    },
  );

  it('with slots, the wrapper carries the size, the appearance and their attributes', () => {
    render(<Input aria-label="Name" size="large" appearance="filled-lighter" contentBefore="@" />);
    const wrapper = field().parentElement as HTMLElement;
    expect(wrapper).toHaveClass('h-10', 'text-body-2', 'bg-input-filled-lighter');
    expect(wrapper).toHaveAttribute('data-size', 'large');
    expect(wrapper).toHaveAttribute('data-appearance', 'filled-lighter');
    expect(field()).toHaveClass('px-3', 'text-body-2');
    expect(field()).not.toHaveAttribute('data-size');
  });
});

describe('htmlSize and the numeric size (Phase 4 D10)', () => {
  const field = () => screen.getByRole('textbox', { name: 'Name' });
  const NUMERIC_SIZE_WARNING =
    '[WaveUI] Input: `size={number}` is deprecated and will be removed in 1.0. Use `htmlSize` instead.';

  it('a numeric size renders the native attribute, keeps the medium design size and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<Input aria-label="Name" size={20} />);
    rerender(<Input aria-label="Name" size={20} />);
    expect(field()).toHaveAttribute('size', '20');
    expect(field()).toHaveAttribute('data-size', 'medium');
    expect(field()).toHaveClass('h-8');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(NUMERIC_SIZE_WARNING);
  });

  it('htmlSize alone renders the attribute without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Input aria-label="Name" htmlSize={12} size="small" />);
    expect(field()).toHaveAttribute('size', '12');
    expect(field()).toHaveAttribute('data-size', 'small');
    expect(warn).not.toHaveBeenCalled();
  });

  it('with both, htmlSize wins and the numeric form still warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Input aria-label="Name" htmlSize={12} size={20} />);
    expect(field()).toHaveAttribute('size', '12');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(NUMERIC_SIZE_WARNING);
  });

  it('types: CoreSize or a number', () => {
    expectTypeOf<InputProps['size']>().toEqualTypeOf<CoreSize | number | undefined>();
    // @ts-expect-error not a size
    render(<Input aria-label="Name" size="huge" />);
  });
});
