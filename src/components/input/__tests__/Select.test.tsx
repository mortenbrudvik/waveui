import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, type SelectProps } from '../Select';
import { inputInvalid } from '../../../lib/styles';
import {
  testSystemProps,
  testFocusEvents,
  renderWithProviders,
  expectNoA11yViolations,
} from '../../../test-utils';

const options = [
  React.createElement('option', { key: 'a', value: 'a' }, 'Alpha'),
  React.createElement('option', { key: 'b', value: 'b' }, 'Beta'),
];

describe('Select', () => {
  testSystemProps(Select, {
    expectedTag: 'select',
    displayName: 'Select',
    defaultProps: { 'aria-label': 'Letter', children: options },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'error message', props: { error: 'Pick a letter' } },
    ],
    conflictingClass: { className: 'h-10', overrides: 'h-8' },
  });

  testFocusEvents(Select, { 'aria-label': 'Letter', children: options }, 'select');

  it('declares ref in SelectProps (C-REF)', () => {
    expectTypeOf<SelectProps['ref']>().toEqualTypeOf<React.Ref<HTMLSelectElement> | undefined>();
  });

  it('renders its options', () => {
    render(<Select aria-label="Letter">{options}</Select>);
    const select = screen.getByRole('combobox', { name: 'Letter' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Alpha', 'Beta']);
    expect(select).toHaveValue('a');
  });

  it('calls onChange with the native event when the value changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select aria-label="Letter" onChange={onChange}>
        {options}
      </Select>,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Letter' }), 'b');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as React.ChangeEvent<HTMLSelectElement>).target.value).toBe(
      'b',
    );
  });

  it('applies the disabled state', () => {
    render(
      <Select aria-label="Letter" disabled>
        {options}
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Letter' })).toBeDisabled();
  });

  describe('tokens (button-provider#3, input-basic#7)', () => {
    it('uses token classes only: accessible bottom stroke, token chevron, focus recipe', () => {
      render(<Select aria-label="Letter">{options}</Select>);
      const select = screen.getByRole('combobox', { name: 'Letter' });
      expect(select).toHaveClass(
        'border-input',
        'border-b-stroke-accessible',
        'focus:outline-hidden',
        'focus:border-b-primary',
      );
      expect(select.className).toContain('var(--wave-muted-foreground)');
      expect(select.className).not.toMatch(/%23|#[0-9a-f]{3,8}|outline-none/i);
    });

    it('places the chevron at the inline end in RTL (C-LOGICAL, wave-rtl: variant)', () => {
      renderWithProviders(<Select aria-label="Letter">{options}</Select>, { dir: 'rtl' });
      const select = screen.getByRole('combobox', { name: 'Letter' });
      expect(select).toHaveClass(
        'ps-3',
        'pe-8',
        'bg-[position:right_16px_center,right_11px_center]',
        'wave-rtl:bg-[position:left_11px_center,left_16px_center]',
      );
      expect(select.className).not.toMatch(/\b(pl|pr)-/);
    });

    it('places the chevron by its own direction, not by an RTL ancestor (C-LOGICAL)', () => {
      // Tailwind's `rtl:` also matches `[dir=rtl] *`: the chevron of a select in an LTR subtree of
      // an RTL page would sit at the left, over the option text, with `pe-8` reserving the right.
      renderWithProviders(
        <div dir="ltr">
          <Select aria-label="Letter">{options}</Select>
        </div>,
        { dir: 'rtl' },
      );
      const select = screen.getByRole('combobox', { name: 'Letter' });
      expect(select.className).not.toMatch(/(^|\s)rtl:/);
      expect(select).toHaveClass('wave-rtl:bg-[position:left_11px_center,left_16px_center]');
    });
  });

  describe('error (input-basic#24)', () => {
    it('renders a string error as a sibling alert that describes the select', () => {
      const { container } = render(
        <Select aria-label="Letter" error="Pick a letter">
          {options}
        </Select>,
      );
      const select = screen.getByRole('combobox', { name: 'Letter' });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Pick a letter');
      expect(select).toHaveAttribute('aria-invalid', 'true');
      expect(select).toHaveAccessibleDescription('Pick a letter');
      expect(select).toHaveAttribute('aria-errormessage', alert.id);
      expect(select).toHaveClass('border-destructive');
      expect(container.firstElementChild).toBe(select);
    });

    it('customises the message element with errorMessageProps', () => {
      render(
        <Select aria-label="Letter" error="Pick one" errorMessageProps={{ className: 'italic' }}>
          {options}
        </Select>,
      );
      expect(screen.getByRole('alert')).toHaveClass('italic', 'text-caption-1');
    });

    it('error={true} keeps the flag-only look', () => {
      render(
        <Select aria-label="Letter" error>
          {options}
        </Select>,
      );
      expect(screen.getByRole('combobox', { name: 'Letter' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('lets the consumer aria-invalid={false} win: no error border and no message', () => {
      render(
        <>
          <Select aria-label="Letter" error="Checking" aria-invalid={false}>
            {options}
          </Select>
          <Select aria-label="Digit" error aria-invalid="false">
            {options}
          </Select>
        </>,
      );
      for (const name of ['Letter', 'Digit']) {
        const select = screen.getByRole('combobox', { name });
        expect(select).toHaveAttribute('aria-invalid', 'false');
        expect(select).not.toHaveClass('border-destructive');
        expect(select).not.toHaveAttribute('aria-describedby');
        expect(select).not.toHaveAttribute('aria-errormessage');
      }
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Checking')).not.toBeInTheDocument();
    });

    it('draws the invalid look with the shared inputInvalid recipe', () => {
      render(
        <>
          <Select aria-label="Letter" error>
            {options}
          </Select>
          <Select aria-label="Digit" aria-invalid>
            {options}
          </Select>
        </>,
      );
      for (const name of ['Letter', 'Digit']) {
        const select = screen.getByRole('combobox', { name });
        expect(select).toHaveClass(...inputInvalid.split(' '));
        expect(select).not.toHaveClass('border-input');
      }
    });

    it('does not set aria-invalid without an error', () => {
      render(<Select aria-label="Letter">{options}</Select>);
      expect(screen.getByRole('combobox', { name: 'Letter' })).not.toHaveAttribute('aria-invalid');
    });

    it('passes axe with a string error', async () => {
      render(
        <Select aria-label="Letter" error="Pick a letter">
          {options}
        </Select>,
      );
      await expectNoA11yViolations();
    });
  });
});
