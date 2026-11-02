import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, type InputProps } from '../Input';
import { inputClassNames } from '../../../lib/classNames';
import {
  testSystemProps,
  testFocusEvents,
  renderWithProviders,
  expectInertSlotProps,
  sortAttributes,
  expectNoA11yViolations,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';
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

  it.each(['underline', 'filled-darker'] as const)(
    'a Field error at %s keeps the destructive border and the focus color on its bottom',
    (appearance) => {
      renderWithFieldContext(<Input appearance={appearance} />, {
        errorId: FIELD_TEST_IDS.errorId,
      });
      expect(field(FIELD_TEST_TEXT.label)).toHaveClass(
        'border-destructive',
        'focus:border-b-primary',
      );
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

describe('htmlSize (Phase 4 D10), and no numeric size (removed in 1.0)', () => {
  const field = () => screen.getByRole('textbox', { name: 'Name' });

  it.each([
    ['a number', 20],
    ['a digit-only string (0.7 HTML style)', '20'],
  ])(
    'has no numeric size (removed in 1.0): %s renders neither the native attribute nor a design size',
    (_label, value) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { rerender } = render(
        // @ts-expect-error -- a numeric `size` is removed in 1.0: use `htmlSize`
        <Input aria-label="Name" size={value as number} />,
      );
      expect(field()).not.toHaveAttribute('size');
      expect(field()).toHaveAttribute('data-size', 'medium');
      expect(field()).toHaveClass('h-8', 'px-3', 'text-body-1');
      // Next to htmlSize, which alone reaches the native attribute.
      rerender(
        // @ts-expect-error -- a numeric `size` is removed in 1.0: use `htmlSize`
        <Input aria-label="Name" htmlSize={12} size={value as number} />,
      );
      expect(field()).toHaveAttribute('size', '12');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    },
  );

  it('htmlSize alone renders the attribute without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Input aria-label="Name" htmlSize={12} size="small" />);
    expect(field()).toHaveAttribute('size', '12');
    expect(field()).toHaveAttribute('data-size', 'small');
    expect(warn).not.toHaveBeenCalled();
  });

  it('another untyped size string renders the medium outline defaults, without the attribute', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Input
        aria-label="Name"
        size={'huge' as unknown as 'medium'}
        appearance={'glass' as unknown as 'outline'}
      />,
    );
    expect(field()).not.toHaveAttribute('size');
    expect(field()).toHaveAttribute('data-size', 'medium');
    expect(field()).toHaveAttribute('data-appearance', 'outline');
    expect(field()).toHaveClass('h-8', 'px-3', 'text-body-1', 'border-input');
    expect(warn).not.toHaveBeenCalled();
  });

  it('types: CoreSize only', () => {
    expectTypeOf<InputProps['size']>().toEqualTypeOf<CoreSize | undefined>();
    // @ts-expect-error not a size
    render(<Input aria-label="Name" size="huge" />);
  });
});

describe('Input — slotProps', () => {
  type InputSlotProps = NonNullable<InputProps['slotProps']>;
  const EVERY_PART: InputSlotProps = { root: {}, input: {} };

  it('renders the 0.17.1 markup without slotProps (attributes compared in sorted order)', () => {
    // Captured from 17abc07: the merged props may put the class before the locked attributes.
    expect(
      sortAttributes(
        renderToString(
          <Input aria-label="Name" placeholder="p" style={{ width: 10 }} error="Wrong" />,
        ),
      ),
    ).toBe(
      [
        '<input aria-describedby="error-_R_0_" aria-errormessage="error-_R_0_" aria-invalid="true" aria-label="Name" class="wave-input wave-input__input h-8 w-full px-3 text-body-1 rounded border bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-b-2 focus:border-b-primary disabled:cursor-not-allowed disabled:opacity-50 border-destructive" data-appearance="outline" data-size="medium" placeholder="p" style="width:10px">',
        '<span class="wave-input__error-message mt-1 block text-caption-1 text-error" id="error-_R_0_" role="alert">Wrong',
        '</span>',
      ].join(''),
    );
    expect(
      sortAttributes(
        renderToString(<Input aria-label="Name" contentBefore="@" style={{ width: 10 }} />),
      ),
    ).toBe(
      [
        '<span class="wave-input inline-flex w-full items-center h-8 text-body-1 rounded border border-input border-b-stroke-accessible bg-background text-foreground focus-within:border-b-2 focus-within:border-b-primary" data-appearance="outline" data-size="medium" style="width:10px">',
        '<span class="wave-input__content-before shrink-0 ps-2">@',
        '</span>',
        '<input aria-label="Name" class="wave-input__input h-full w-full min-w-0 bg-transparent px-2 text-body-1 text-foreground placeholder:text-muted-foreground focus:outline-hidden disabled:cursor-not-allowed">',
        '</span>',
      ].join(''),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: InputProps[] = [
      { 'aria-label': 'Name' },
      {
        'aria-label': 'Name',
        placeholder: 'p',
        style: { width: 10 },
        className: 'c',
        type: 'email',
      },
      { 'aria-label': 'Name', error: 'Wrong', size: 'small', appearance: 'underline' },
      { 'aria-label': 'Name', disabled: true, readOnly: true, required: true, htmlSize: 20 },
      { 'aria-label': 'Name', contentBefore: '@' },
      {
        'aria-label': 'Name',
        contentAfter: '!',
        hidden: true,
        style: { width: 10 },
        className: 'c',
      },
      { 'aria-label': 'Name', contentBefore: '@', error: 'Wrong', disabled: true },
    ];
    for (const props of cases) {
      expectInertSlotProps((slotProps) => <Input {...props} slotProps={slotProps} />, EVERY_PART);
    }
  });

  describe('without content slots: root and input are one <input>', () => {
    it('applies the root part, then the input part, after the Input classes', () => {
      render(
        <Input
          aria-label="Name"
          className="mine"
          slotProps={{
            root: { className: 'root-part', style: { width: 10, color: 'red' }, title: 'Root' },
            input: { className: 'input-part', style: { width: 20 }, title: 'Input' },
          }}
        />,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input.className).toMatch(
        /^wave-input wave-input__input .* mine root-part input-part$/,
      );
      expect(input).toHaveStyle({ width: '20px', color: 'rgb(255, 0, 0)' });
      expect(input).toHaveAttribute('title', 'Input');
    });

    it('attaches the root and input refs to the input, beside ref', () => {
      const root = React.createRef<HTMLElement>();
      const inputRef = React.createRef<HTMLInputElement>();
      const ref = React.createRef<HTMLInputElement>();
      render(
        <Input
          ref={ref}
          aria-label="Name"
          slotProps={{ root: { ref: root }, input: { ref: inputRef } }}
        />,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(root.current).toBe(input);
      expect(inputRef.current).toBe(input);
      expect(ref.current).toBe(input);
    });

    it("merges your style over the Input's own style", () => {
      render(
        <Input
          aria-label="Name"
          style={{ color: 'red', width: 10 }}
          slotProps={{ input: { style: { width: 20 } } }}
        />,
      );
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveStyle({
        color: 'rgb(255, 0, 0)',
        width: '20px',
      });
    });
  });

  describe('with content slots: root is the wrapper', () => {
    it('puts the root part on the wrapper and the input part on the input', () => {
      const root = React.createRef<HTMLElement>();
      const inputRef = React.createRef<HTMLInputElement>();
      render(
        <Input
          aria-label="Name"
          contentBefore="@"
          style={{ width: 100 }}
          slotProps={{
            root: { ref: root, className: 'my-root', style: { color: 'red' }, 'data-part': 'root' },
            input: { ref: inputRef, className: 'my-input', 'data-part': 'input' },
          }}
        />,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      const wrapper = input.parentElement as HTMLElement;
      expect(root.current).toBe(wrapper);
      expect(inputRef.current).toBe(input);
      expect(wrapper).toHaveClass(inputClassNames.root, 'my-root');
      expect(wrapper.classList[0]).toBe(inputClassNames.root);
      expect(wrapper.classList[wrapper.classList.length - 1]).toBe('my-root');
      expect(wrapper).toHaveStyle({ width: '100px', color: 'rgb(255, 0, 0)' });
      expect(wrapper).toHaveAttribute('data-part', 'root');
      expect(input).toHaveClass(inputClassNames.input, 'my-input');
      expect(input.classList[input.classList.length - 1]).toBe('my-input');
      expect(input).toHaveAttribute('data-part', 'input');
      expect(input).not.toHaveClass('my-root');
    });

    it('keeps the locked attributes of the wrapper', () => {
      render(
        <Input
          aria-label="Name"
          contentBefore="@"
          size="small"
          slotProps={{ root: { hidden: true, 'data-size': 'large', 'data-appearance': 'x' } }}
        />,
      );
      const wrapper = screen.getByRole('textbox', { name: 'Name' }).parentElement;
      expect(wrapper).not.toHaveAttribute('hidden');
      expect(wrapper).toHaveAttribute('data-size', 'small');
      expect(wrapper).toHaveAttribute('data-appearance', 'outline');
    });
  });

  it("runs your onChange first, then the Input's onChange and onValueChange", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    render(
      <Input
        aria-label="Name"
        onChange={() => order.push('onChange')}
        onValueChange={() => order.push('onValueChange')}
        slotProps={{ input: { onChange: () => order.push('part') } }}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'a');
    expect(order).toEqual(['part', 'onChange', 'onValueChange']);
  });

  it("skips the Input's change handlers when your onChange prevents the default", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Input
        aria-label="Name"
        onValueChange={onValueChange}
        slotProps={{ root: { onChange: (event) => event.preventDefault() } }}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'a');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('calls onValueChange once per change in StrictMode with a part handler', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(
      <React.StrictMode>
        <Input
          aria-label="Name"
          onValueChange={onValueChange}
          slotProps={{ input: { onChange } }}
        />
      </React.StrictMode>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'a');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('a');
  });

  it('keeps the locked attributes of the input, and the props you give the Input win', () => {
    renderWithFieldContext(
      <Input
        placeholder="From the Input"
        error="Wrong"
        slotProps={{
          input: {
            id: 'mine',
            'aria-label': 'Other',
            'aria-invalid': false,
            'aria-required': false,
            'aria-errormessage': 'other',
            required: false,
            disabled: true,
            readOnly: true,
            size: 3,
            placeholder: 'From the part',
            'data-size': 'large',
          },
        }}
      />,
      { required: true },
    );
    const input = screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label });
    expect(input.id).toBe(FIELD_TEST_IDS.controlId);
    expect(input).not.toHaveAttribute('aria-label');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toBeRequired();
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute('readonly');
    expect(input).not.toHaveAttribute('size');
    expect(input).toHaveAttribute('placeholder', 'From the Input');
    expect(input).toHaveAttribute('data-size', 'medium');
    expect(input.getAttribute('aria-errormessage')).toBe(
      screen.getByRole('alert').getAttribute('id'),
    );
  });

  it('keeps a controlled Input’s value its own: no part’s defaultValue reaches the input', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const own = { value: 'Own', onChange: () => {} };
      render(
        <>
          <Input aria-label="Input" {...own} slotProps={{ input: { defaultValue: 'Part' } }} />
          <Input aria-label="Root" {...own} slotProps={{ root: { defaultValue: 'Part' } }} />
          <Input
            aria-label="Wrapped"
            contentBefore="@"
            {...own}
            slotProps={{ input: { defaultValue: 'Part' } }}
          />
        </>,
      );
      for (const name of ['Input', 'Root', 'Wrapped']) {
        expect(screen.getByRole('textbox', { name })).toHaveValue('Own');
      }
      // No warning of an input both controlled and uncontrolled: the parts' defaults are unset.
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('keeps an uncontrolled Input uncontrolled: no part’s value reaches the input', async () => {
    const user = userEvent.setup();
    const part = { value: 'Part' };
    render(
      <>
        <Input aria-label="Input" defaultValue="Own" slotProps={{ input: part }} />
        <Input
          aria-label="Root"
          defaultValue="Own"
          // The root part is typed for the wrapper, which takes no value: from untyped code.
          slotProps={{ root: part as unknown as InputSlotProps['root'] }}
        />
        <Input
          aria-label="Wrapped"
          contentBefore="@"
          defaultValue="Own"
          slotProps={{ input: part }}
        />
      </>,
    );
    for (const name of ['Input', 'Root', 'Wrapped']) {
      const input = screen.getByRole('textbox', { name });
      expect(input).toHaveValue('Own');
      await user.type(input, '!');
      expect(input).toHaveValue('Own!');
    }
  });

  it('adds the attributes the Input does not set, and joins your ids to its description', () => {
    render(
      <>
        <span id="extra">Extra</span>
        <Input
          aria-label="Name"
          error="Wrong"
          slotProps={{
            input: { placeholder: 'From the part', 'aria-describedby': 'extra', type: 'email' },
          }}
        />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAttribute('placeholder', 'From the part');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('aria-describedby', `${screen.getByRole('alert').id} extra`);
  });

  it.each([
    ['one <input>', {}],
    ['a wrapper', { contentBefore: '@' }],
  ] as const)('takes hidden from the Input itself in %s, never from a part', (_, shape) => {
    const { rerender } = render(
      <Input
        aria-label="Name"
        {...shape}
        slotProps={{ root: { hidden: true }, input: { hidden: true, 'aria-hidden': true } }}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    const field = input.closest(`.${inputClassNames.root}`) as HTMLElement;
    expect(field).not.toHaveAttribute('hidden');
    expect(input).not.toHaveAttribute('hidden');
    expect(input).not.toHaveAttribute('aria-hidden');
    rerender(<Input aria-label="Name" {...shape} hidden slotProps={{ root: { hidden: false } }} />);
    expect(field).toHaveAttribute('hidden');
  });

  it.each([
    ['one <input>', {}],
    ['a wrapper', { contentBefore: '@' }],
  ] as const)('takes inert from the Input itself in %s, never from a part', (_, shape) => {
    const { rerender } = render(
      <Input
        aria-label="Name"
        {...shape}
        slotProps={{ root: { inert: true, 'aria-hidden': true }, input: { inert: true } }}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    const field = input.closest(`.${inputClassNames.root}`) as HTMLElement;
    expect(field).not.toHaveAttribute('inert');
    expect(field).not.toHaveAttribute('aria-hidden');
    expect(input).not.toHaveAttribute('inert');
    rerender(<Input aria-label="Name" {...shape} inert />);
    expect(screen.getByRole('textbox', { name: 'Name', hidden: true })).toHaveAttribute('inert');
  });

  it.each([
    ['enabled', false, 1],
    ['disabled', true, 0],
  ] as const)('calls your wrapper onClick only while the Input is %s', (_, disabled, calls) => {
    const onClick = vi.fn();
    render(
      <Input
        aria-label="Name"
        contentBefore="@"
        disabled={disabled}
        slotProps={{ root: { onClick } }}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.click(input.closest(`.${inputClassNames.root}`) as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(calls);
  });

  it('has no accessibility violations with both shapes customised', async () => {
    render(
      <>
        <Input
          aria-label="One"
          slotProps={{ root: { className: 'r' }, input: { className: 'i' } }}
        />
        <Input
          aria-label="Two"
          contentBefore="@"
          slotProps={{ root: { className: 'r' }, input: { className: 'i' } }}
        />
      </>,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof InputSlotProps>().toEqualTypeOf<'root' | 'input'>();
    expectTypeOf<NonNullable<InputSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLElement> | undefined
    >();
    expectTypeOf<NonNullable<InputSlotProps['input']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<NonNullable<InputSlotProps['input']>>().toHaveProperty('placeholder');
    expectTypeOf<NonNullable<InputSlotProps['root']>>().not.toHaveProperty('placeholder');
    // @ts-expect-error -- a part takes no children
    void (<Input slotProps={{ root: { children: 'x' } }} />);
  });
});
