import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea, type TextareaProps } from '../Textarea';
import { inputInvalid } from '../../../lib/styles';
import { testSystemProps, testFocusEvents, expectNoA11yViolations } from '../../../test-utils';

describe('Textarea', () => {
  testSystemProps(Textarea, {
    expectedTag: 'textarea',
    displayName: 'Textarea',
    defaultProps: { 'aria-label': 'Message' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'error message', props: { error: 'Message is required' } },
    ],
    conflictingClass: { className: 'px-4', overrides: 'px-3' },
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
      'border-input',
      'border-b-stroke-accessible',
      'placeholder:text-muted-foreground',
      'focus:outline-hidden',
      'focus:border-b-primary',
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
      expect(textarea).toHaveClass('border-destructive');
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
        expect(textarea).not.toHaveClass('border-destructive');
        expect(textarea).not.toHaveAttribute('aria-describedby');
        expect(textarea).not.toHaveAttribute('aria-errormessage');
      }
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Checking')).not.toBeInTheDocument();
    });

    it('draws the invalid look with the shared inputInvalid recipe (R8)', () => {
      render(
        <>
          <Textarea aria-label="Message" error />
          <Textarea aria-label="Notes" aria-invalid />
        </>,
      );
      for (const name of ['Message', 'Notes']) {
        const textarea = screen.getByRole('textbox', { name });
        expect(textarea).toHaveClass(...inputInvalid.split(' '));
        expect(textarea).not.toHaveClass('border-input');
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
});
