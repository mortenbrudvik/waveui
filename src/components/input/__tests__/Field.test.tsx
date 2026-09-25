import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, type FieldProps } from '../Field';
import { Checkbox } from '../Checkbox';
import { Input } from '../Input';
import { RadioGroup, RadioItem } from '../RadioGroup';
import { Select } from '../Select';
import { Textarea } from '../Textarea';
import { Slider } from '../Slider';
import { SearchBox } from '../SearchBox';
import { Switch } from '../Switch';
import {
  useFieldContext,
  useFieldControl,
  type FieldContextValue,
  type FieldControlProps,
} from '../../../hooks/useFieldControl';
import type { Orientation, Slot, ValidationState } from '../../../lib/types';
import { testSystemProps, expectNoA11yViolations, renderWithProviders } from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

/** The development warning of a Field with more than one element child. */
function multipleChildrenWarning(extra: number) {
  return (
    "[WaveUI] Field: only the first element child receives the Field's id and ARIA attributes; " +
    `the other ${extra} element child(ren) are rendered unchanged. Wrap each control in its own ` +
    'Field.'
  );
}

/** The development warning of a Field whose `error` hides a validation message or state. */
const ERROR_AND_VALIDATION_WARNING =
  '[WaveUI] Field: `error` and `validationMessage`/`validationState` are both set; `error` wins. ' +
  'Use one of them.';

/**
 * The first child of a horizontal Field's control column that the column's first-row rule pads,
 * or `null`. jsdom applies no Tailwind CSS, so the selector of the rule's arbitrary variant is
 * matched instead.
 */
function paddedFirstChild(column: Element): Element | null {
  const selector = [...column.classList]
    .map((name) => /^\[&>(:first-child:has\(.+\))\]:py-1\.5$/.exec(name)?.[1])
    .find((match) => match !== undefined);
  return selector === undefined ? null : column.querySelector(`:scope > ${selector}`);
}

/** The `<p>` that renders a Field message, found by its text. */
function messageElement(text: string): HTMLElement {
  const element = screen.getByText(text).closest('p');
  if (!element) throw new Error(`no <p> around "${text}"`);
  return element;
}

describe('Field', () => {
  testSystemProps(Field, {
    expectedTag: 'div',
    displayName: 'Field',
    defaultProps: { label: 'Name', children: <input /> },
    a11yVariants: [
      { name: 'hint', props: { hint: 'Your full name' } },
      { name: 'error', props: { error: 'Name is required' } },
      { name: 'required', props: { required: true } },
      {
        name: 'warning message and hint',
        props: { validationState: 'warning', validationMessage: 'Looks unusual', hint: 'Hint' },
      },
      {
        name: 'success message',
        props: { validationState: 'success', validationMessage: 'Available' },
      },
      { name: 'horizontal', props: { orientation: 'horizontal', hint: 'Hint' } },
    ],
    conflictingClass: { className: 'flex-row', overrides: 'flex-col' },
  });

  it('declares ref in FieldProps (C-REF)', () => {
    expectTypeOf<FieldProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });

  it('types the validation and orientation props', () => {
    expectTypeOf<FieldProps['validationState']>().toEqualTypeOf<ValidationState | undefined>();
    expectTypeOf<FieldProps['validationMessage']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<FieldProps['validationMessageIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<FieldProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    // @ts-expect-error -- not a validation state
    void (<Field validationState="info" />);
  });

  it('renders the child control inside the root with only a generated id (no label, hint or error)', () => {
    render(
      <Field data-testid="root">
        <input />
      </Field>,
    );
    const input = screen.getByRole('textbox');
    expect(screen.getByTestId('root')).toContainElement(input);
    expect(input.id).toMatch(/^field-/);
    for (const attr of ['aria-describedby', 'aria-invalid', 'aria-required', 'required']) {
      expect(input).not.toHaveAttribute(attr);
    }
    expect(document.querySelector('label')).toBeNull();
  });

  describe('label', () => {
    it('labels the child without htmlFor', () => {
      render(
        <Field label="Name">
          <input />
        </Field>,
      );
      expect(screen.getByLabelText('Name')).toBe(screen.getByRole('textbox', { name: 'Name' }));
    });

    it('keeps the child id and points the label at it', () => {
      render(
        <Field label="Email">
          <input id="email" />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Email' });
      expect(input).toHaveAttribute('id', 'email');
      expect(screen.getByText('Email').closest('label')).toHaveAttribute('for', 'email');
    });

    it('gives the child the htmlFor id when it has none', () => {
      render(
        <Field label="Email" htmlFor="email-input">
          <input />
        </Field>,
      );
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('id', 'email-input');
    });

    it('accepts ReactNode label, hint and error', () => {
      render(
        <Field label={<em>Rich label</em>} hint={<strong>Rich hint</strong>}>
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Rich label' });
      expect(input).toHaveAccessibleDescription('Rich hint');
    });
  });

  describe('required (input-basic#16)', () => {
    it('hides the asterisk from assistive technology', () => {
      render(
        <Field label="Username" required>
          <input />
        </Field>,
      );
      expect(screen.getByRole('textbox', { name: 'Username' })).toBeInTheDocument();
      expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    });

    it('sets aria-required and native required on an intrinsic form control', () => {
      render(
        <Field label="Username" required>
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Username' });
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toBeRequired();
      expect((input as HTMLInputElement).validity.valueMissing).toBe(true);
    });

    it('does not set aria-required or required when not required', () => {
      render(
        <Field label="Username">
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Username' });
      expect(input).not.toHaveAttribute('aria-required');
      expect(input).not.toBeRequired();
    });

    it('injects native required only into intrinsic form controls (components read FieldContext)', () => {
      function Custom(props: React.InputHTMLAttributes<HTMLInputElement>) {
        const { required, ...rest } = props;
        return <input data-required={String(required)} {...rest} />;
      }
      render(
        <Field label="Custom" required>
          <Custom />
        </Field>,
      );
      const box = screen.getByRole('textbox', { name: 'Custom' });
      expect(box).toHaveAttribute('aria-required', 'true');
      expect(box).toHaveAttribute('data-required', 'undefined');
    });

    it('sets native required on the library Input and runs constraint validation', () => {
      render(
        <Field label="Username" required>
          <Input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Username' });
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-required', 'true');
      expect((input as HTMLInputElement).validity.valueMissing).toBe(true);
    });

    it('sets native required on the library Select, Textarea and Slider', () => {
      render(
        <>
          <Field label="Country" required>
            <Select>
              <option value="">Choose</option>
              <option value="no">Norway</option>
            </Select>
          </Field>
          <Field label="Bio" required>
            <Textarea />
          </Field>
          <Field label="Volume" required>
            <Slider />
          </Field>
        </>,
      );
      const select = screen.getByRole('combobox', { name: 'Country' });
      expect(select).toBeRequired();
      expect((select as HTMLSelectElement).validity.valueMissing).toBe(true);
      expect(screen.getByRole('textbox', { name: 'Bio' })).toBeRequired();
      expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('required');
    });

    it('does not put aria-required on a labelable element whose role does not support it', async () => {
      render(
        <>
          <Field label="Pick a date" required>
            <button type="button" data-testid="button">
              Open
            </button>
          </Field>
          <Field label="Send" required>
            <input type="submit" value="Send" data-testid="submit" />
          </Field>
          <Field label="Reset" required>
            <input type="reset" value="Reset" data-testid="reset" />
          </Field>
          <Field label="Strength" required>
            <meter value={0.5} data-testid="meter" />
          </Field>
          <Field label="Upload" required>
            <progress value={0.5} data-testid="progress" />
          </Field>
          <Field label="Total" required>
            <output data-testid="output">4</output>
          </Field>
        </>,
      );
      for (const testId of ['button', 'submit', 'reset', 'meter', 'progress', 'output']) {
        const element = screen.getByTestId(testId);
        expect(element, testId).not.toHaveAttribute('aria-required');
        // Native `required` only applies to form controls that take a value.
        expect(element, testId).not.toHaveAttribute('required');
        // Still labelled through <label htmlFor> (the id is merged).
        expect(element.id, testId).toMatch(/^field-/);
      }
      expect(screen.getByRole('button', { name: 'Pick a date' })).toBe(
        screen.getByTestId('button'),
      );
      await expectNoA11yViolations();
    });

    it('keeps aria-required on labelable elements whose role supports it', () => {
      render(
        <>
          <Field label="Accept" required>
            <input type="checkbox" />
          </Field>
          <Field label="Level" required>
            <input type="range" />
          </Field>
          <Field label="Dark mode" required>
            <button type="button" role="switch" aria-checked="false" />
          </Field>
        </>,
      );
      const checkbox = screen.getByRole('checkbox', { name: 'Accept' });
      expect(checkbox).toHaveAttribute('aria-required', 'true');
      expect(checkbox).toBeRequired();
      expect(screen.getByRole('slider', { name: 'Level' })).toHaveAttribute(
        'aria-required',
        'true',
      );
      const toggle = screen.getByRole('switch', { name: 'Dark mode' });
      expect(toggle).toHaveAttribute('aria-required', 'true');
      expect(toggle).not.toHaveAttribute('required');
    });

    it('keeps aria-required on component children (they may render any control)', () => {
      function PickerTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        return <button type="button" role="combobox" aria-expanded="false" {...props} />;
      }
      render(
        <Field label="Date" required>
          <PickerTrigger />
        </Field>,
      );
      expect(screen.getByRole('combobox', { name: 'Date' })).toHaveAttribute(
        'aria-required',
        'true',
      );
    });

    it('sets native required on a library Input that is not the first child (FieldContext)', () => {
      render(
        <Field label="Username" required>
          <div>
            <Input />
          </div>
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Username' });
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('hint and error', () => {
    it('describes the control with the hint', () => {
      render(
        <Field label="Name" hint="Enter your full name">
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAccessibleDescription('Enter your full name');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders the error in an alert linked via aria-describedby (input-basic#17)', () => {
      render(
        <Field label="Name" error="This field is required">
          <input />
        </Field>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAccessibleDescription('This field is required');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('inserts a new alert element when an error appears, and keeps the hint', () => {
      const { rerender } = render(
        <Field label="Name" hint="Enter your full name">
          <input />
        </Field>,
      );
      const hint = screen.getByText('Enter your full name');
      rerender(
        <Field label="Name" hint="Enter your full name" error="Name is required">
          <input />
        </Field>,
      );
      const alert = screen.getByRole('alert');
      // A new node, not the hint's <p> with role="alert" added: insertion is what screen readers
      // announce reliably. The hint stays below the error.
      expect(alert).not.toBe(hint);
      expect(hint).toBeInTheDocument();
      expect(hint.closest('p')).not.toHaveAttribute('role');
      expect(alert).toHaveTextContent('Name is required');
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
        'Name is required Enter your full name',
      );
    });

    it('shows the hint after the error when both are provided (the hint stays visible)', () => {
      render(
        <Field label="Name" error="Error!" hint="Hint">
          <input />
        </Field>,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Error!');
      const hint = messageElement('Hint');
      // Document order: the message, then the hint.
      expect(alert.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAttribute('aria-describedby', `${alert.id} ${hint.id}`);
      expect(input).toHaveAccessibleDescription('Error! Hint');
    });

    it('does not set aria-invalid when there is no error', () => {
      render(
        <Field label="Name">
          <input />
        </Field>,
      );
      expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-invalid');
    });

    it('treats an error list that renders nothing as no error: the control stays valid and the hint shows (C-SLOTS)', () => {
      const errors: string[] = [];
      render(
        <>
          <Field
            label="Email"
            hint="We never share it"
            error={errors.map((e) => (
              <span key={e}>{e}</span>
            ))}
          >
            <Input />
          </Field>
          <Field label="Name" hint="Your full name" error={[null, false, '']}>
            <input />
          </Field>
        </>,
      );
      const email = screen.getByRole('textbox', { name: 'Email' });
      const name = screen.getByRole('textbox', { name: 'Name' });
      for (const control of [email, name]) {
        expect(control).not.toHaveAttribute('aria-invalid');
        expect(control).not.toHaveClass('border-destructive');
      }
      expect(email).toHaveAccessibleDescription('We never share it');
      expect(name).toHaveAccessibleDescription('Your full name');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders no label or hint element for values that render nothing (C-SLOTS)', () => {
      render(
        <Field label={[]} hint={[undefined, true]}>
          <input aria-label="Code" />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Code' });
      expect(document.querySelector('label')).toBeNull();
      expect(input).not.toHaveAttribute('aria-describedby');
      expect(input).not.toHaveAttribute('aria-labelledby');
    });

    it('still counts an error list with content (and 0) as an error message', () => {
      render(
        <>
          <Field
            label="Email"
            error={['Too short'].map((e) => (
              <span key={e}>{e}</span>
            ))}
          >
            <input />
          </Field>
          <Field label="Count" error={0}>
            <input />
          </Field>
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
        'Too short',
      );
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByRole('textbox', { name: 'Count' })).toHaveAccessibleDescription('0');
      expect(screen.getAllByRole('alert')).toHaveLength(2);
    });

    it('error={true} marks the control invalid without a message', () => {
      render(
        <Field label="Name" error hint="Hint">
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(input).toHaveAccessibleDescription('Hint');
    });
  });

  describe('validation state (validationState, validationMessage, validationMessageIcon)', () => {
    /** A custom control built on `useFieldControl`, with the role of a combobox. */
    function ComboboxLike(props: FieldControlProps) {
      const fieldProps = useFieldControl(props);
      return <input role="combobox" aria-expanded="false" {...fieldProps} />;
    }

    const STATES = [
      { state: 'error', role: 'alert', invalid: true, icon: 'error', idSuffix: '-error' },
      { state: 'warning', role: 'alert', invalid: false, icon: 'warning', idSuffix: '-message' },
      { state: 'success', role: null, invalid: false, icon: 'success', idSuffix: '-message' },
      { state: 'none', role: null, invalid: false, icon: null, idSuffix: '-message' },
    ] as const;

    it.each(STATES)(
      'renders a $state message before the hint, with its role, icon and id',
      async ({ state, role, invalid, icon, idSuffix }) => {
        render(
          <Field
            label="Name"
            hint="Hint"
            validationState={state}
            validationMessage="Message"
            data-testid="root"
          >
            <input />
          </Field>,
        );
        const message = messageElement('Message');
        const hint = messageElement('Hint');
        const input = screen.getByRole('textbox', { name: 'Name' });
        expect(screen.getByTestId('root')).toHaveAttribute('data-validation-state', state);
        expect(message).toHaveAttribute('data-validation-state', state);
        expect(message.id).toMatch(new RegExp(`${idSuffix}$`));
        if (role) expect(message).toHaveAttribute('role', role);
        else expect(message).not.toHaveAttribute('role');
        expect(hint).not.toHaveAttribute('role');
        expect(input).toHaveAttribute('aria-describedby', `${message.id} ${hint.id}`);
        expect(input).toHaveAccessibleDescription('Message Hint');
        if (invalid) expect(input).toHaveAttribute('aria-invalid', 'true');
        else expect(input).not.toHaveAttribute('aria-invalid');
        const glyph = message.querySelector('svg');
        if (icon) {
          expect(glyph).toHaveAttribute('data-wave-icon', icon);
          expect(glyph?.closest('[aria-hidden="true"]')).not.toBeNull();
          expect(glyph).toHaveAttribute('fill', 'currentColor');
        } else {
          expect(glyph).toBeNull();
        }
        await expectNoA11yViolations();
      },
    );

    it('colors each message with its token', () => {
      render(
        <>
          {STATES.map(({ state }) => (
            <Field
              key={state}
              label={`${state} field`}
              validationState={state}
              validationMessage={`${state} message`}
            >
              <input />
            </Field>
          ))}
        </>,
      );
      expect(messageElement('error message')).toHaveClass('text-error');
      expect(messageElement('warning message')).toHaveClass('text-warning-tint-foreground');
      expect(messageElement('success message')).toHaveClass('text-success-tint-foreground');
      expect(messageElement('none message')).toHaveClass('text-muted-foreground');
    });

    it.each(STATES)(
      'marks an Input, a Checkbox, a combobox and a native input invalid only in the error state ($state)',
      ({ state, invalid }) => {
        render(
          <>
            <Field label="Input" hint="Hint" validationState={state} validationMessage="Input msg">
              <Input />
            </Field>
            <Field label="Box" hint="Hint" validationState={state} validationMessage="Box msg">
              <Checkbox />
            </Field>
            <Field label="Combo" hint="Hint" validationState={state} validationMessage="Combo msg">
              <ComboboxLike />
            </Field>
            <Field
              label="Native"
              hint="Hint"
              validationState={state}
              validationMessage="Native msg"
            >
              <input />
            </Field>
          </>,
        );
        const controls = [
          [screen.getByRole('textbox', { name: 'Input' }), 'Input msg'],
          [screen.getByRole('checkbox', { name: 'Box' }), 'Box msg'],
          [screen.getByRole('combobox', { name: 'Combo' }), 'Combo msg'],
          [screen.getByRole('textbox', { name: 'Native' }), 'Native msg'],
        ] as const;
        for (const [control, text] of controls) {
          expect(control, text).toHaveAccessibleDescription(`${text} Hint`);
          if (invalid) expect(control, text).toHaveAttribute('aria-invalid', 'true');
          else expect(control, text).not.toHaveAttribute('aria-invalid');
        }
      },
    );

    it('treats a validationMessage without a validationState as an error', () => {
      render(
        <Field label="Name" validationMessage="Required">
          <input />
        </Field>,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Required');
      expect(alert).toHaveAttribute('data-validation-state', 'error');
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription('Required');
    });

    it('validationState="error" without a message marks the control invalid and renders no message', () => {
      render(
        <Field label="Name" hint="Hint" validationState="error" data-testid="root">
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription('Hint');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('root').querySelectorAll('p')).toHaveLength(1);
      expect(screen.getByTestId('root')).toHaveAttribute('data-validation-state', 'error');
    });

    it('renders a label, message and hint given as generators (checked without being consumed)', () => {
      function* text(value: string) {
        yield value;
      }
      render(
        <Field label={text('Name')} validationMessage={text('Too short')} hint={text('Hint')}>
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAccessibleDescription('Too short Hint');
    });

    it('renders no message element and no state for a message that renders nothing', () => {
      render(
        <Field label="Name" hint="Hint" validationMessage={[null, '']} data-testid="root">
          <input />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).toHaveAccessibleDescription('Hint');
      expect(screen.getByTestId('root')).toHaveAttribute('data-validation-state', 'none');
      expect(screen.getByTestId('root').querySelectorAll('p')).toHaveLength(1);
    });

    it('keeps the 0.5 error behaviour: `error` renders the message in the error state', () => {
      render(
        <Field label="Name" error="Required" data-testid="root">
          <input />
        </Field>,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-validation-state', 'error');
      expect(alert.id).toMatch(/-error$/);
      expect(alert.querySelector('[data-wave-icon="error"]')).not.toBeNull();
      expect(screen.getByTestId('root')).toHaveAttribute('data-validation-state', 'error');
    });

    it('error wins over validationMessage and validationState, with a development warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <Field
            label="Name"
            error="Required"
            validationState="warning"
            validationMessage="Looks unusual"
          >
            <input />
          </Field>,
        );
        expect(screen.getByRole('alert')).toHaveTextContent('Required');
        expect(screen.queryByText('Looks unusual')).not.toBeInTheDocument();
        const input = screen.getByRole('textbox', { name: 'Name' });
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAccessibleDescription('Required');
        expect(warn.mock.calls).toEqual([[ERROR_AND_VALIDATION_WARNING]]);
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      {
        name: 'error={true} and a validationMessage',
        props: { error: true, validationMessage: 'x' },
      },
      {
        name: 'an error and validationState="success"',
        props: { error: 'e', validationState: 'success' },
      },
    ] satisfies Array<{ name: string; props: Partial<FieldProps> }>)(
      'warns about $name',
      ({ props }) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          render(
            <Field label="Name" {...props}>
              <input />
            </Field>,
          );
          expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute(
            'aria-invalid',
            'true',
          );
          expect(screen.queryByText('x')).not.toBeInTheDocument();
          expect(warn.mock.calls).toEqual([[ERROR_AND_VALIDATION_WARNING]]);
        } finally {
          warn.mockRestore();
        }
      },
    );

    it('does not warn when error and validationState="error" agree', () => {
      const warn = vi.spyOn(console, 'warn');
      try {
        render(
          <Field label="Name" error="Required" validationState="error">
            <input />
          </Field>,
        );
        expect(screen.getByRole('alert')).toHaveTextContent('Required');
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('validationMessageIcon={null} or content that renders nothing shows no icon', () => {
      render(
        <>
          <Field label="A" validationMessage="No icon" validationMessageIcon={null}>
            <input />
          </Field>
          <Field
            label="B"
            validationState="warning"
            validationMessage="Empty icon"
            validationMessageIcon={[false, '']}
          >
            <input />
          </Field>
        </>,
      );
      for (const text of ['No icon', 'Empty icon']) {
        const message = messageElement(text);
        expect(message.querySelector('svg'), text).toBeNull();
        // Only the text span: no empty icon element.
        expect(message.children, text).toHaveLength(1);
      }
    });

    it('renders a custom validationMessageIcon instead of the default, decoratively', () => {
      render(
        <Field
          label="Name"
          validationState="success"
          validationMessage="Available"
          validationMessageIcon={<svg data-testid="custom-icon" />}
        >
          <input />
        </Field>,
      );
      const message = messageElement('Available');
      const custom = screen.getByTestId('custom-icon');
      expect(message).toContainElement(custom);
      expect(custom.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(message.querySelector('[data-wave-icon]')).toBeNull();
      // The icon comes before the text.
      expect(message.firstElementChild).toContainElement(custom);
    });

    it('re-inserts the message element when the state changes from warning to error', () => {
      const ui = (state: ValidationState) => (
        <Field label="Name" validationState={state} validationMessage="Check the name">
          <input />
        </Field>
      );
      const { rerender } = render(ui('warning'));
      const warning = messageElement('Check the name');
      expect(warning).toHaveAttribute('role', 'alert');
      rerender(ui('error'));
      const error = messageElement('Check the name');
      // A new node, so the error is announced as a new alert.
      expect(error).not.toBe(warning);
      expect(warning).not.toBeInTheDocument();
      expect(error).toHaveAttribute('data-validation-state', 'error');
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
    });

    it('describes an Input by its own error and a Field warning (both messages show)', () => {
      render(
        <Field
          label="Email"
          hint="Hint"
          validationState="warning"
          validationMessage="Unusual domain"
        >
          <Input error="Invalid address" />
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Email' });
      expect(screen.getByText('Invalid address')).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      // Field merges its message and hint into the Input's props; the Input adds its own error.
      expect(input).toHaveAccessibleDescription('Unusual domain Hint Invalid address');
    });

    it('provides the validation state and message id in FieldContext', () => {
      /** Renders the context members it reads as data attributes. */
      function Probe(props: React.InputHTMLAttributes<HTMLInputElement>) {
        const field = useFieldContext();
        return (
          <input
            {...props}
            data-state={field?.validationState}
            data-message-id={field?.validationMessageId}
            data-error-id={field?.errorId}
            data-invalid={String(field?.invalid)}
            data-has-error-message={String(field?.hasErrorMessage)}
          />
        );
      }
      render(
        <>
          <Field label="Warning" validationState="warning" validationMessage="Heads up">
            <Probe />
          </Field>
          <Field label="Error" validationMessage="Required">
            <Probe />
          </Field>
          <Field label="Plain">
            <Probe />
          </Field>
        </>,
      );
      const context = (name: string) => {
        const { state, messageId, errorId, invalid, hasErrorMessage } = screen.getByRole(
          'textbox',
          { name },
        ).dataset;
        return { state, messageId, errorId, invalid, hasErrorMessage };
      };
      expect(context('Warning')).toEqual({
        state: 'warning',
        messageId: messageElement('Heads up').id,
        errorId: undefined,
        invalid: 'false',
        hasErrorMessage: 'false',
      });
      expect(context('Error')).toEqual({
        state: 'error',
        messageId: messageElement('Required').id,
        errorId: messageElement('Required').id,
        invalid: 'true',
        hasErrorMessage: 'true',
      });
      expect(context('Plain')).toEqual({
        state: 'none',
        messageId: undefined,
        errorId: undefined,
        invalid: 'false',
        hasErrorMessage: 'false',
      });
    });
  });

  describe('orientation', () => {
    it('renders data-orientation="vertical" by default with the label above the control', () => {
      render(
        <Field label="Name" data-testid="root">
          <input />
        </Field>,
      );
      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-orientation', 'vertical');
      expect(root).toHaveClass('flex-col');
    });

    it('horizontal: the label in a start column, the control, message and hint in a column beside it', async () => {
      render(
        <Field
          label="Name"
          hint="Hint"
          validationState="warning"
          validationMessage="Message"
          orientation="horizontal"
          data-testid="root"
        >
          <input />
        </Field>,
      );
      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-orientation', 'horizontal');
      expect(root).toHaveClass('flex-row', 'items-start');
      const label = screen.getByText('Name').closest('label');
      expect(root.firstElementChild).toBe(label);
      expect(label).toHaveClass('basis-1/3', 'shrink-0', 'mb-0');
      const input = screen.getByRole('textbox', { name: 'Name' });
      const column = input.parentElement as HTMLElement;
      expect(column).not.toBe(root);
      expect(column.parentElement).toBe(root);
      expect(column).toHaveClass('flex', 'flex-1', 'min-w-0', 'flex-col');
      expect(column).toContainElement(messageElement('Message'));
      expect(column).toContainElement(messageElement('Hint'));
      expect(input).toHaveAccessibleDescription('Message Hint');
      await expectNoA11yViolations();
    });

    it('horizontal keeps the DOM order under dir="rtl"', () => {
      renderWithProviders(
        <Field label="Name" hint="Hint" orientation="horizontal" data-testid="root">
          <input />
        </Field>,
        { dir: 'rtl' },
      );
      const root = screen.getByTestId('root');
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(root.firstElementChild).toBe(screen.getByText('Name').closest('label'));
      expect(root.lastElementChild).toContainElement(input);
      expect(root.className).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-/);
    });

    it.each(['ltr', 'rtl'] as const)(
      'horizontal (%s): a Switch, Checkbox or RadioGroup gets a 32px first row, so its first line lines up with the label',
      (dir) => {
        renderWithProviders(
          <>
            <Field label="Display name" orientation="horizontal">
              <Input />
            </Field>
            <Field label="Notifications" orientation="horizontal">
              <Switch label="Email me about replies" />
            </Field>
            <Field label="Newsletter" orientation="horizontal">
              <Checkbox label="Send me the monthly newsletter" />
            </Field>
            <Field label="Theme" orientation="horizontal">
              <RadioGroup>
                <RadioItem value="light" label="Light" />
                <RadioItem value="dark" label="Dark" />
              </RadioGroup>
            </Field>
            <Field label="Alerts" orientation="horizontal">
              <div className="flex flex-col gap-2">
                <Checkbox label="Email" />
                <Checkbox label="Push" />
              </div>
            </Field>
          </>,
          { dir },
        );
        const column = (control: HTMLElement) => {
          const root = control.closest('[data-orientation="horizontal"]');
          if (!root?.lastElementChild) throw new Error('no horizontal Field around the control');
          return root.lastElementChild;
        };
        // The label is centred on a 32px row (6px above its 20px line)...
        for (const name of ['Display name', 'Notifications', 'Newsletter', 'Theme', 'Alerts']) {
          expect(screen.getByText(name).closest('label')).toHaveClass('pt-1.5');
        }
        // ...a 32px control fills that row as it is...
        const input = screen.getByRole('textbox', { name: 'Display name' });
        expect(paddedFirstChild(column(input))).toBeNull();
        // ...and a control of 20px rows gets 6px above and below its first row.
        const toggle = screen.getByRole('switch', { name: 'Notifications Email me about replies' });
        expect(paddedFirstChild(column(toggle))).toBe(toggle.closest('label'));
        const box = screen.getByRole('checkbox', {
          name: 'Newsletter Send me the monthly newsletter',
        });
        expect(paddedFirstChild(column(box))).toBe(box.closest('label'));
        const group = screen.getByRole('radiogroup', { name: 'Theme' });
        expect(paddedFirstChild(column(group))).toBe(group);
        const email = screen.getByRole('checkbox', { name: 'Alerts Email' });
        expect(paddedFirstChild(column(email))).toBe(email.closest('label')?.parentElement);
      },
    );

    it('horizontal without a label: the column takes the full width', () => {
      render(
        <Field orientation="horizontal" hint="Hint" data-testid="root">
          <input aria-label="Code" />
        </Field>,
      );
      const root = screen.getByTestId('root');
      expect(root.children).toHaveLength(1);
      expect(root.firstElementChild).toHaveClass('flex-1');
      expect(root.firstElementChild).toContainElement(
        screen.getByRole('textbox', { name: 'Code' }),
      );
    });
  });

  describe('a custom control with renderWithFieldContext', () => {
    /** A custom switch built on `useFieldControl` (CLAUDE.md "Field wiring for a custom control"). */
    function CustomSwitch(props: FieldControlProps) {
      const fieldProps = useFieldControl(props);
      return <button type="button" role="switch" aria-checked="false" {...fieldProps} />;
    }

    it('is described by a Field warning and its hint, and not marked invalid', () => {
      renderWithFieldContext(<CustomSwitch />, {
        validationState: 'warning',
        validationMessageId: FIELD_TEST_IDS.messageId,
        hintId: FIELD_TEST_IDS.hintId,
      });
      const control = screen.getByRole('switch', { name: FIELD_TEST_TEXT.label });
      expect(control).toHaveAccessibleDescription(
        `${FIELD_TEST_TEXT.message} ${FIELD_TEST_TEXT.hint}`,
      );
      expect(control).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('merges instead of overwriting (input-basic#15)', () => {
    it("joins the child's aria-describedby with the hint", () => {
      render(
        <>
          <span id="ext">External help</span>
          <Field label="Name" hint="Hint text">
            <input aria-describedby="ext" />
          </Field>
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
        'External help Hint text',
      );
    });

    it("keeps the child's aria-describedby when Field has no hint or error", () => {
      render(
        <>
          <span id="ext">External help</span>
          <Field label="Name">
            <input aria-describedby="ext" />
          </Field>
        </>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAttribute('aria-describedby', 'ext');
      expect(input).toHaveAccessibleDescription('External help');
    });

    it('keeps aria-invalid set by the child when Field has no error', () => {
      render(
        <Field label="Email">
          <Input error />
        </Field>,
      );
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    it("keeps a first child's own aria-invalid, as for a nested control (the Field error still describes it)", () => {
      render(
        <>
          <Field label="Code" error="Checking">
            <Input aria-invalid={false} />
          </Field>
          <Field label="Nested" error="Checking">
            <div>
              <Input aria-invalid={false} />
            </div>
          </Field>
          <Field label="Native" error="Checking">
            <input aria-invalid="false" />
          </Field>
          <Field label="Spelling" error="Checking">
            <input aria-invalid="spelling" />
          </Field>
        </>,
      );
      for (const name of ['Code', 'Nested', 'Native']) {
        const control = screen.getByRole('textbox', { name });
        expect(control, name).toHaveAttribute('aria-invalid', 'false');
        expect(control, name).toHaveAccessibleDescription('Checking');
      }
      expect(screen.getByRole('textbox', { name: 'Code' })).not.toHaveClass('border-destructive');
      expect(screen.getByRole('textbox', { name: 'Spelling' })).toHaveAttribute(
        'aria-invalid',
        'spelling',
      );
    });

    it('passes only defined keys to the child', () => {
      const received: Array<Record<string, unknown>> = [];
      function Probe(props: Record<string, unknown>) {
        received.push(props);
        return <input aria-label="Probe" />;
      }
      render(
        <Field>
          <Probe />
        </Field>,
      );
      const keys = Object.keys(received[received.length - 1]);
      expect(keys).toEqual(['id']);
    });

    it('gives only the first element child the id and warns about more', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <Field label="First">
            <input data-testid="first" />
            <input data-testid="second" />
          </Field>,
        );
        expect(screen.getByTestId('first')).toHaveAccessibleName('First');
        expect(screen.getByTestId('second')).not.toHaveAttribute('id');
        expect(warn.mock.calls).toEqual([[multipleChildrenWarning(1)]]);
      } finally {
        warn.mockRestore();
      }
    });

    it('does not clone a non-labelable wrapper element (the control inside reads FieldContext)', () => {
      render(
        <Field label="Name" hint="Hint">
          <div data-testid="wrapper">
            <Input />
          </div>
        </Field>,
      );
      expect(screen.getByTestId('wrapper')).not.toHaveAttribute('id');
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAccessibleDescription('Hint');
    });

    it('merges into a custom widget with an explicit role and names it through aria-labelledby', () => {
      render(
        <Field label="Size" error="Pick a size" required>
          <div role="radiogroup" tabIndex={0}>
            <span>Small</span>
          </div>
        </Field>,
      );
      const group = screen.getByRole('radiogroup', { name: 'Size' });
      expect(group).toHaveAttribute('aria-labelledby', screen.getByText('Size').id);
      expect(group).toHaveAccessibleDescription('Pick a size');
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(group).toHaveAttribute('aria-required', 'true');
      // Not a native form control: no `required`, and no id (a <label htmlFor> cannot name it).
      expect(group).not.toHaveAttribute('required');
      expect(group).not.toHaveAttribute('id');
    });

    it("keeps a role widget's own naming (aria-labelledby joined, aria-label respected)", () => {
      render(
        <>
          <span id="own-label">Shirt</span>
          <Field label="Size" hint="Pick one">
            <div role="listbox" aria-labelledby="own-label" data-testid="labelled" />
          </Field>
          <Field label="Colour" hint="Pick one">
            <div role="listbox" aria-label="Shirt colour" data-testid="aria-label" />
          </Field>
        </>,
      );
      expect(screen.getByTestId('labelled')).toHaveAccessibleName('Shirt Size');
      expect(screen.getByTestId('labelled')).toHaveAccessibleDescription('Pick one');
      expect(screen.getByTestId('aria-label')).toHaveAccessibleName('Shirt colour');
      expect(screen.getByTestId('aria-label')).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByTestId('aria-label')).toHaveAccessibleDescription('Pick one');
    });

    it('names a role="group" wrapper and the library control inside it without duplicate ids', () => {
      render(
        <Field label="Name" hint="Hint" required>
          <div role="group">
            <Input />
          </div>
        </Field>,
      );
      const group = screen.getByRole('group', { name: 'Name' });
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(group).not.toHaveAttribute('id');
      expect(document.querySelectorAll(`[id="${input.id}"]`)).toHaveLength(1);
      expect(input).toHaveAccessibleDescription('Hint');
      expect(input).toBeRequired();
      // aria-required is not allowed on role="group".
      expect(group).not.toHaveAttribute('aria-required');
    });

    it('gives a custom element the id, like a component (form-associated elements are labelable)', () => {
      render(
        <Field label="Name" hint="Your full name" error="Required" required>
          {React.createElement('my-text-field', { 'data-testid': 'custom' })}
        </Field>,
      );
      const custom = screen.getByTestId('custom');
      expect(custom.id).toMatch(/^field-/);
      expect(screen.getByText('Name').closest('label')).toHaveAttribute('for', custom.id);
      // The error message, then the hint (which stays visible next to the error).
      expect(custom).toHaveAttribute(
        'aria-describedby',
        `${screen.getByRole('alert').id} ${messageElement('Your full name').id}`,
      );
      expect(custom).toHaveAttribute('aria-invalid', 'true');
      // A role-less element takes no aria-required and no native required (the element decides):
      // pass `required`/`aria-required` or an explicit `role` yourself.
      expect(custom).not.toHaveAttribute('aria-required');
      expect(custom).not.toHaveAttribute('required');
    });

    it('names a custom element with an explicit widget role through aria-labelledby', () => {
      render(
        <Field label="Size" required>
          {React.createElement('my-radio-group', { role: 'radiogroup', 'data-testid': 'custom' })}
        </Field>,
      );
      const custom = screen.getByTestId('custom');
      expect(screen.getByRole('radiogroup', { name: 'Size' })).toBe(custom);
      expect(custom).not.toHaveAttribute('id');
      expect(custom).toHaveAttribute('aria-required', 'true');
    });

    it('leaves a presentational wrapper alone', () => {
      render(
        <Field label="Name" error="Required">
          <div role="presentation" data-testid="wrapper">
            <Input />
          </div>
        </Field>,
      );
      const wrapper = screen.getByTestId('wrapper');
      for (const attr of ['id', 'aria-labelledby', 'aria-describedby', 'aria-invalid']) {
        expect(wrapper).not.toHaveAttribute(attr);
      }
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription('Required');
    });
  });

  describe('invalid look (input-basic#1)', () => {
    it('gives the library controls the error border from the Field error', () => {
      render(
        <>
          <Field label="Name" error="Required">
            <Input />
          </Field>
          <Field label="Price" error="Required">
            <Input contentBefore="$" />
          </Field>
          <Field label="Country" error>
            <Select>
              <option value="no">Norway</option>
            </Select>
          </Field>
          <Field label="Bio" error="Too short">
            <Textarea />
          </Field>
          <Field label="City" error="Unknown city">
            <div>
              <Input />
            </div>
          </Field>
          <Field label="Find" error="Nothing found">
            <SearchBox />
          </Field>
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveClass('border-destructive');
      // With content slots the border is drawn by the wrapper.
      expect(screen.getByRole('textbox', { name: 'Price' }).parentElement).toHaveClass(
        'border-destructive',
      );
      expect(screen.getByRole('combobox', { name: 'Country' })).toHaveClass('border-destructive');
      expect(screen.getByRole('textbox', { name: 'Bio' })).toHaveClass('border-destructive');
      expect(screen.getByRole('textbox', { name: 'City' })).toHaveClass('border-destructive');
      // SearchBox draws the field with its root, around the input.
      expect(screen.getByRole('searchbox', { name: 'Find' }).parentElement).toHaveClass(
        'border-destructive',
      );
    });

    it('keeps the normal border without an error', () => {
      render(
        <>
          <Field label="Name" hint="Hint">
            <Input />
          </Field>
          <Field label="Bio">
            <Textarea />
          </Field>
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveClass('border-destructive');
      expect(screen.getByRole('textbox', { name: 'Bio' })).not.toHaveClass('border-destructive');
    });
  });

  describe('FieldContext (input-basic#1)', () => {
    it('provides ids and state to the controls inside', () => {
      const warn = vi.spyOn(console, 'warn');
      let context: FieldContextValue | null = null;
      function ProbeInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
        context = useFieldContext();
        return <input {...props} />;
      }
      render(
        <Field label="Name" hint="Hint" required>
          <ProbeInput />
        </Field>,
      );
      // A single element child: no "multiple children" warning.
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(context).not.toBeNull();
      const value = context as unknown as FieldContextValue;
      expect(value.controlId).toBe(input.id);
      expect(document.getElementById(value.labelId ?? '')).toHaveTextContent('Name');
      expect(document.getElementById(value.hintId ?? '')).toHaveTextContent('Hint');
      expect(value).toMatchObject({
        errorId: undefined,
        invalid: false,
        required: true,
        hasErrorMessage: false,
        controlIdAssigned: true,
      });
    });

    it('names, describes and invalidates a SearchBox (C-ROUTING)', () => {
      render(
        <Field label="Find" error="Nothing found">
          <SearchBox />
        </Field>,
      );
      const box = screen.getByRole('searchbox', { name: 'Find' });
      expect(box).toHaveAccessibleDescription('Nothing found');
      expect(box).toHaveAttribute('aria-invalid', 'true');
    });

    it("does not duplicate the Input's own error message inside a Field that renders one", () => {
      render(
        <Field label="Email" error="Field error">
          <Input error="Input error" />
        </Field>,
      );
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.queryByText('Input error')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
        'Field error',
      );
    });

    it('labels a control with its own id through aria-labelledby', () => {
      render(
        <Field label="Name">
          <span>
            <Input id="own" />
          </span>
        </Field>,
      );
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('id', 'own');
    });

    it('wires a library control inside a wrapper component placed in a plain element (documented pattern, input-basic#15)', async () => {
      // Stand-in for Tooltip (P16, §5.9): a component that spreads id/aria-* onto its own <span>.
      function TooltipLike(props: React.HTMLAttributes<HTMLSpanElement>) {
        return <span className="inline-block" {...props} />;
      }
      render(
        <Field label="Name" hint="As on your passport" required>
          <div>
            <TooltipLike>
              <Input />
            </TooltipLike>
          </div>
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAccessibleDescription('As on your passport');
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-required', 'true');
      // Neither the plain element nor the wrapper component receives Field's attributes.
      for (const wrapper of [input.parentElement, input.parentElement?.parentElement]) {
        for (const attr of ['id', 'aria-describedby', 'aria-invalid', 'aria-required']) {
          expect(wrapper, attr).not.toHaveAttribute(attr);
        }
      }
      for (const element of document.querySelectorAll('[id]')) {
        expect(document.querySelectorAll(`[id="${element.id}"]`), element.id).toHaveLength(1);
      }
      await expectNoA11yViolations();
    });

    it('names a library control with its own id inside a layout component', () => {
      function Row(props: React.HTMLAttributes<HTMLDivElement>) {
        return <div className="flex" {...props} />;
      }
      render(
        <Field label="Name" hint="Hint">
          <Row>
            <Input id="own" />
          </Row>
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(input).toHaveAttribute('id', 'own');
      expect(input).toHaveAccessibleDescription('Hint');
      for (const element of document.querySelectorAll('[id]')) {
        expect(document.querySelectorAll(`[id="${element.id}"]`), element.id).toHaveLength(1);
      }
    });

    it('names a library control nested in a component first child that holds the control id', () => {
      function Row(props: React.HTMLAttributes<HTMLDivElement>) {
        return <div className="flex" {...props} />;
      }
      // Stand-in for Tooltip (P16, §5.9): a component that spreads id/aria-* onto its own <span>.
      function TooltipLike(props: React.HTMLAttributes<HTMLSpanElement>) {
        return <span className="inline-block" {...props} />;
      }
      render(
        <>
          <Field label="Own id wrapper" hint="Hint">
            <Row id="row">
              <Input />
            </Row>
          </Field>
          <Field label="Tooltip wrapper" hint="Hint">
            <TooltipLike>
              <Input />
            </TooltipLike>
          </Field>
          <Field label="Direct">
            <Input />
          </Field>
        </>,
      );
      for (const name of ['Own id wrapper', 'Tooltip wrapper']) {
        const input = screen.getByRole('textbox', { name });
        expect(input, name).toHaveAccessibleDescription('Hint');
        expect(input, name).toHaveAttribute('aria-labelledby');
      }
      expect(screen.getByRole('textbox', { name: 'Own id wrapper' })).not.toHaveAttribute(
        'id',
        'row',
      );
      // The first child itself keeps label-for naming (no aria-labelledby).
      expect(screen.getByRole('textbox', { name: 'Direct' })).not.toHaveAttribute(
        'aria-labelledby',
      );
      for (const element of document.querySelectorAll('[id]')) {
        expect(document.querySelectorAll(`[id="${element.id}"]`), element.id).toHaveLength(1);
      }
    });

    it('names a second library control that is a later sibling of the first child', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <Field label="Range" hint="Hint">
            <Input data-testid="first" />
            <Input data-testid="second" />
          </Field>,
        );
        const first = screen.getByTestId('first');
        const second = screen.getByTestId('second');
        expect(first).toHaveAccessibleName('Range');
        expect(first).not.toHaveAttribute('aria-labelledby');
        expect(second).toHaveAccessibleName('Range');
        expect(second).toHaveAccessibleDescription('Hint');
        expect(second.id).not.toBe(first.id);
        for (const element of document.querySelectorAll('[id]')) {
          expect(document.querySelectorAll(`[id="${element.id}"]`), element.id).toHaveLength(1);
        }
        // Still one control per Field: the multiple-children warning stays.
        expect(warn.mock.calls).toEqual([[multipleChildrenWarning(1)]]);
      } finally {
        warn.mockRestore();
      }
    });

    it('names every library control inside a plain wrapper element and keeps the ids unique', async () => {
      const warn = vi.spyOn(console, 'warn');
      try {
        render(
          <Field label="Price range" hint="In euros">
            <div>
              <Input data-testid="min" />
              <Input data-testid="max" />
            </div>
          </Field>,
        );
        const min = screen.getByTestId('min');
        const max = screen.getByTestId('max');
        // The first control takes the control id the label points at; the second gets an id of
        // its own and is named through aria-labelledby.
        expect(screen.getByText('Price range').closest('label')).toHaveAttribute('for', min.id);
        expect(min).not.toHaveAttribute('aria-labelledby');
        expect(max.id).not.toBe(min.id);
        for (const input of [min, max]) {
          expect(input).toHaveAccessibleName('Price range');
          expect(input).toHaveAccessibleDescription('In euros');
        }
        for (const element of document.querySelectorAll('[id]')) {
          expect(document.querySelectorAll(`[id="${element.id}"]`), element.id).toHaveLength(1);
        }
        // One element child: no multiple-children warning.
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
      await expectNoA11yViolations();
    });

    it('moves the control id to the next control inside the wrapper when the first one is removed', () => {
      const error = vi.spyOn(console, 'error');
      try {
        const ui = (showMin: boolean) => (
          <Field label="Price range">
            <div>
              {showMin && <Input data-testid="min" />}
              <Input data-testid="max" />
            </div>
          </Field>
        );
        const { rerender } = render(ui(true));
        expect(screen.getByTestId('max')).toHaveAttribute('aria-labelledby');
        rerender(ui(false));
        const max = screen.getByTestId('max');
        expect(screen.getByText('Price range').closest('label')).toHaveAttribute('for', max.id);
        expect(max).not.toHaveAttribute('aria-labelledby');
        expect(max).toHaveAccessibleName('Price range');
        expect(error).not.toHaveBeenCalled();
      } finally {
        error.mockRestore();
      }
    });

    it('leaves a Fragment first child alone (the control inside reads FieldContext)', () => {
      render(
        <Field label="Name" hint="Hint" required>
          <>
            <Input />
          </>
        </Field>,
      );
      const input = screen.getByRole('textbox', { name: 'Name' });
      // Named through <label htmlFor>: the control holds the control id itself.
      expect(screen.getByText('Name').closest('label')).toHaveAttribute('for', input.id);
      expect(input).not.toHaveAttribute('aria-labelledby');
      expect(input).toHaveAccessibleDescription('Hint');
      expect(input).toBeRequired();
    });

    it('tells the controls inside whether the first child holds the control id (controlIdAssigned)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const seen: Record<string, boolean | undefined> = {};
        function Probe({
          name,
          ...props
        }: React.HTMLAttributes<HTMLSpanElement> & { name: string }) {
          seen[name] = useFieldContext()?.controlIdAssigned;
          return <span {...props} />;
        }
        function Row(props: React.HTMLAttributes<HTMLDivElement>) {
          return <div {...props} />;
        }
        render(
          <>
            <Field label="Component">
              <Probe name="component" />
            </Field>
            <Field label="Own id">
              <Row id="own">
                <Probe name="nested" />
              </Row>
            </Field>
            <Field label="Input">
              <input />
              <Probe name="sibling" />
            </Field>
            <Field label="Plain wrapper">
              <div>
                <Probe name="div" />
              </div>
            </Field>
            <Field label="Role widget">
              <div role="group">
                <Probe name="group" />
              </div>
            </Field>
          </>,
        );
        expect(seen).toEqual({
          component: true,
          nested: true,
          sibling: true,
          div: false,
          group: false,
        });
        // Only the "Input" Field has two element children.
        expect(warn.mock.calls).toEqual([[multipleChildrenWarning(1)]]);
      } finally {
        warn.mockRestore();
      }
    });

    it('passes axe with a library control, hint and required', async () => {
      render(
        <Field label="Email" hint="We never share it" required>
          <Input type="email" />
        </Field>,
      );
      await expectNoA11yViolations();
    });
  });
});
