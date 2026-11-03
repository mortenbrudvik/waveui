import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea, type TextareaProps, type TextareaResize } from '../Textarea';
import { inputInvalid } from '../../../lib/styles';
import {
  testSystemProps,
  testFocusEvents,
  renderWithProviders,
  expectNoA11yViolations,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';
import { WaveProvider } from '../../provider/WaveProvider';

describe('Textarea', () => {
  testSystemProps(Textarea, {
    expectedTag: 'textarea',
    displayName: 'Textarea',
    defaultProps: { 'aria-label': 'Message' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'error message', props: { error: 'Message is required' } },
    ],
    conflictingClass: { className: 'px-4', overrides: 'wave:px-3' },
  });

  testFocusEvents(Textarea, { 'aria-label': 'Message' }, 'textarea');

  it('declares ref in TextareaProps (C-REF)', () => {
    expectTypeOf<TextareaProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLTextAreaElement> | undefined
    >();
  });

  it('renders the placeholder', () => {
    render(<Textarea aria-label="Message" placeholder="Enter text" />);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute(
      'placeholder',
      'Enter text',
    );
  });

  it('calls onChange for every typed character', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea aria-label="Message" onChange={onChange} />);
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'hi');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('hi');
  });

  it('applies the disabled state', () => {
    render(<Textarea aria-label="Message" disabled />);
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });

  it('uses token classes only (button-provider#3, input-basic#7)', () => {
    render(<Textarea aria-label="Message" />);
    const textarea = screen.getByRole('textbox', { name: 'Message' });
    expect(textarea).toHaveClass(
      'wave:border-input',
      'wave:border-b-stroke-accessible',
      'wave:placeholder:text-muted-foreground',
      'wave:focus:outline-hidden',
      'wave:focus:border-b-primary',
    );
    expect(textarea.className).not.toMatch(/#[0-9a-f]{3,8}|outline-none/i);
  });

  describe('error (input-basic#24)', () => {
    it('renders a string error as a sibling alert that describes the textarea', () => {
      const { container } = render(<Textarea aria-label="Message" error="Message is required" />);
      const textarea = screen.getByRole('textbox', { name: 'Message' });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Message is required');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
      expect(textarea).toHaveAccessibleDescription('Message is required');
      expect(textarea).toHaveAttribute('aria-errormessage', alert.id);
      expect(textarea).toHaveClass('wave:border-destructive');
      expect(container.firstElementChild).toBe(textarea);
    });

    it('customises the message element with errorMessageProps', () => {
      render(
        <Textarea aria-label="Message" error="Required" errorMessageProps={{ id: 'msg-error' }} />,
      );
      expect(screen.getByRole('alert')).toHaveAttribute('id', 'msg-error');
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute(
        'aria-describedby',
        'msg-error',
      );
    });

    it('error={true} keeps the flag-only look', () => {
      render(<Textarea aria-label="Message" error />);
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('lets the consumer aria-invalid={false} win: no error border and no message', () => {
      render(
        <>
          <Textarea aria-label="Message" error="Checking" aria-invalid={false} />
          <Textarea aria-label="Notes" error aria-invalid="false" />
        </>,
      );
      for (const name of ['Message', 'Notes']) {
        const textarea = screen.getByRole('textbox', { name });
        expect(textarea).toHaveAttribute('aria-invalid', 'false');
        expect(textarea).not.toHaveClass('wave:border-destructive');
        expect(textarea).not.toHaveAttribute('aria-describedby');
        expect(textarea).not.toHaveAttribute('aria-errormessage');
      }
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Checking')).not.toBeInTheDocument();
    });

    it('draws the invalid look with the shared inputInvalid recipe', () => {
      render(
        <>
          <Textarea aria-label="Message" error />
          <Textarea aria-label="Notes" aria-invalid />
        </>,
      );
      for (const name of ['Message', 'Notes']) {
        const textarea = screen.getByRole('textbox', { name });
        expect(textarea).toHaveClass(...inputInvalid.split(' '));
        expect(textarea).not.toHaveClass('wave:border-input');
      }
    });

    it('does not set aria-invalid without an error', () => {
      render(<Textarea aria-label="Message" />);
      expect(screen.getByRole('textbox', { name: 'Message' })).not.toHaveAttribute('aria-invalid');
    });

    it('passes axe with a string error', async () => {
      render(<Textarea aria-label="Message" error="Message is required" />);
      await expectNoA11yViolations();
    });
  });

  describe('sizes and appearances (Phase 4 P4-01)', () => {
    const box = (name = 'Notes') => screen.getByRole('textbox', { name });

    it('renders the 0.7 classes and medium outline attributes by default', () => {
      render(<Textarea aria-label="Notes" />);
      expect(box()).toHaveClass(
        'wave:min-h-20',
        'wave:px-3',
        'wave:py-2',
        'wave:text-body-1',
        'wave:resize-y',
        'wave:border-input',
      );
      expect(box()).toHaveAttribute('data-size', 'medium');
      expect(box()).toHaveAttribute('data-appearance', 'outline');
    });

    it.each([
      ['small', ['wave:min-h-16', 'wave:px-2', 'wave:py-1', 'wave:text-caption-1']],
      ['large', ['wave:min-h-24', 'wave:px-4', 'wave:py-2.5', 'wave:text-body-2']],
    ] as const)('size="%s"', (size, classes) => {
      render(<Textarea aria-label="Notes" size={size} />);
      expect(box()).toHaveClass(...classes);
      expect(box()).toHaveAttribute('data-size', size);
    });

    it.each([
      ['underline', ['wave:rounded-none', 'wave:border-0', 'wave:border-b', 'wave:bg-transparent']],
      ['filled-darker', ['wave:border-input-filled-stroke', 'wave:bg-input-filled-darker']],
      ['filled-lighter', ['wave:border-input-filled-stroke', 'wave:bg-input-filled-lighter']],
    ] as const)('appearance="%s" renders its classes', (appearance, classes) => {
      render(<Textarea aria-label="Notes" appearance={appearance} />);
      expect(box()).toHaveClass(...classes);
      expect(box()).toHaveAttribute('data-appearance', appearance);
    });

    it('underline keeps vertical resizing and square corners', () => {
      render(<Textarea aria-label="Notes" appearance="underline" />);
      expect(box()).toHaveClass(
        'wave:resize-y',
        'wave:rounded-none',
        'wave:border-0',
        'wave:border-b',
      );
    });

    it('takes the Field size; its own size wins', () => {
      const { rerender } = renderWithFieldContext(<Textarea />, { size: 'large' });
      expect(box(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'large');
      rerender(<Textarea size="small" />);
      expect(box(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'small');
    });

    it('takes WaveProvider inputDefaults; its own props win', () => {
      const { rerender } = renderWithProviders(<Textarea aria-label="Notes" />, {
        inputDefaults: { size: 'small', appearance: 'underline' },
      });
      expect(box()).toHaveAttribute('data-size', 'small');
      expect(box()).toHaveAttribute('data-appearance', 'underline');
      rerender(<Textarea aria-label="Notes" size="large" appearance="outline" />);
      expect(box()).toHaveAttribute('data-size', 'large');
      expect(box()).toHaveAttribute('data-appearance', 'outline');
    });

    it('takes the Field size and the provider appearance', () => {
      renderWithFieldContext(
        <WaveProvider inputDefaults={{ appearance: 'filled-darker' }}>
          <Textarea />
        </WaveProvider>,
        { size: 'large' },
      );
      const el = screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label });
      expect(el).toHaveAttribute('data-size', 'large');
      expect(el).toHaveAttribute('data-appearance', 'filled-darker');
    });

    it.each(['underline', 'filled-darker'] as const)(
      'an invalid %s field keeps the destructive border and the focus color on its bottom',
      (appearance) => {
        render(<Textarea aria-label="Notes" appearance={appearance} error />);
        expect(box()).toHaveClass('wave:border-destructive', 'wave:focus:border-b-primary');
      },
    );

    it.each(['underline', 'filled-darker'] as const)(
      'a Field error at %s keeps the destructive border and the focus color on its bottom',
      (appearance) => {
        renderWithFieldContext(<Textarea appearance={appearance} />, {
          errorId: FIELD_TEST_IDS.errorId,
        });
        expect(box(FIELD_TEST_TEXT.label)).toHaveClass(
          'wave:border-destructive',
          'wave:focus:border-b-primary',
        );
      },
    );
  });

  describe('resize (form-basic-13)', () => {
    it('resizes vertically by default, as before', () => {
      render(<Textarea aria-label="Notes" />);
      expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveClass('wave:resize-y');
    });

    it.each([
      ['none', 'wave:resize-none'],
      ['vertical', 'wave:resize-y'],
      ['horizontal', 'wave:resize-x'],
      ['both', 'wave:resize'],
    ] as const)('resize="%s" draws %s and no other resize class', (resize, expected) => {
      render(<Textarea aria-label="Notes" resize={resize} />);
      const classes = screen.getByRole('textbox', { name: 'Notes' }).className.split(' ');
      expect(classes.filter((name) => /^wave:resize/.test(name))).toEqual([expected]);
    });

    it('a consumer resize class replaces the prop value', () => {
      render(<Textarea aria-label="Notes" resize="none" className="resize-x" />);
      const textarea = screen.getByRole('textbox', { name: 'Notes' });
      expect(textarea).toHaveClass('resize-x');
      expect(textarea).not.toHaveClass('wave:resize-none');
    });

    it('falls back to vertical for a value outside the four (untyped code)', () => {
      // @ts-expect-error resize takes the four directions only
      render(<Textarea aria-label="Notes" resize="diagonal" />);
      expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveClass('wave:resize-y');
    });

    it('types the prop', () => {
      expectTypeOf<TextareaProps['resize']>().toEqualTypeOf<TextareaResize | undefined>();
      expectTypeOf<TextareaResize>().toEqualTypeOf<'none' | 'vertical' | 'horizontal' | 'both'>();
    });
  });

  describe('onValueChange (form-basic-15)', () => {
    it('calls onValueChange with the string value next to the native onChange', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(<Textarea aria-label="Notes" onChange={onChange} onValueChange={onValueChange} />);
      await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'hey');
      expect(onChange).toHaveBeenCalledTimes(3);
      expect(onChange.mock.calls[0][0]).toHaveProperty('target');
      expect(onValueChange).toHaveBeenCalledTimes(3);
      expect(onValueChange).toHaveBeenLastCalledWith('hey');
    });

    it('supports the controlled example with onValueChange', async () => {
      const user = userEvent.setup();
      function Example() {
        const [note, setNote] = React.useState('');
        return (
          <>
            <Textarea aria-label="Notes" value={note} onValueChange={setNote} />
            <output>{note}</output>
          </>
        );
      }
      render(<Example />);
      await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'a{Enter}b');
      expect(screen.getByRole('status')).toHaveTextContent(/a\s*b/);
      expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('a\nb');
    });

    it('fires onValueChange once per change in StrictMode', () => {
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Textarea aria-label="Notes" onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), { target: { value: 'x' } });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('x');
    });
  });
});
