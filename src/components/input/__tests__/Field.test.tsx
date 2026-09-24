import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, type FieldProps } from '../Field';
import { Input } from '../Input';
import { Select } from '../Select';
import { Textarea } from '../Textarea';
import { Slider } from '../Slider';
import { SearchBox } from '../SearchBox';
import { useFieldContext, type FieldContextValue } from '../../../hooks/useFieldControl';
import { testSystemProps, expectNoA11yViolations } from '../../../test-utils';

describe('Field', () => {
  testSystemProps(Field, {
    expectedTag: 'div',
    displayName: 'Field',
    defaultProps: { label: 'Name', children: <input /> },
    a11yVariants: [
      { name: 'hint', props: { hint: 'Your full name' } },
      { name: 'error', props: { error: 'Name is required' } },
      { name: 'required', props: { required: true } },
    ],
    conflictingClass: { className: 'flex-row', overrides: 'flex-col' },
  });

  it('declares ref in FieldProps (C-REF)', () => {
    expectTypeOf<FieldProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
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

    it('inserts a new alert element when an error replaces the hint (input-basic#17)', () => {
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
      // announce reliably.
      expect(alert).not.toBe(hint);
      expect(hint).not.toBeInTheDocument();
      expect(alert).toHaveTextContent('Name is required');
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
        'Name is required',
      );
    });

    it('shows the error instead of the hint when both are provided', () => {
      render(
        <Field label="Name" error="Error!" hint="Hint">
          <input />
        </Field>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Error!');
      expect(screen.queryByText('Hint')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription('Error!');
    });

    it('does not set aria-invalid when there is no error', () => {
      render(
        <Field label="Name">
          <input />
        </Field>,
      );
      expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-invalid');
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
      render(
        <Field label="First">
          <input data-testid="first" />
          <input data-testid="second" />
        </Field>,
      );
      expect(screen.getByTestId('first')).toHaveAccessibleName('First');
      expect(screen.getByTestId('second')).not.toHaveAttribute('id');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/^\[WaveUI\] Field:/);
      warn.mockRestore();
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
      expect(custom).toHaveAttribute(
        'aria-describedby',
        screen.getByRole('alert').getAttribute('id'),
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
      expect(screen.getByRole('searchbox', { name: 'Find' })).toHaveClass('border-destructive');
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
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
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
      const seen: Record<string, boolean | undefined> = {};
      function Probe({ name, ...props }: React.HTMLAttributes<HTMLSpanElement> & { name: string }) {
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
      warn.mockRestore();
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
