import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, type SelectProps } from '../Select';
import { inputInvalid } from '../../../lib/styles';
import type { CoreSize } from '../../../lib/types';
import {
  testSystemProps,
  testFocusEvents,
  renderWithProviders,
  expectNoA11yViolations,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

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
    conflictingClass: { className: 'h-10', overrides: 'wave:h-8' },
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
        'wave:border-input',
        'wave:border-b-stroke-accessible',
        'wave:focus:outline-hidden',
        'wave:focus:border-b-primary',
      );
      expect(select.className).toContain('var(--wave-muted-foreground)');
      expect(select.className).not.toMatch(/%23|#[0-9a-f]{3,8}|outline-none/i);
    });

    it('places the chevron at the inline end in RTL (C-LOGICAL, wave-rtl: variant)', () => {
      renderWithProviders(<Select aria-label="Letter">{options}</Select>, { dir: 'rtl' });
      const select = screen.getByRole('combobox', { name: 'Letter' });
      expect(select).toHaveClass(
        'wave:ps-3',
        'wave:pe-8',
        'wave:bg-[position:right_16px_center,right_11px_center]',
        'wave:wave-rtl:bg-[position:left_11px_center,left_16px_center]',
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
      expect(select.className).not.toMatch(/(^|\s)wave:rtl:/);
      expect(select).toHaveClass('wave:wave-rtl:bg-[position:left_11px_center,left_16px_center]');
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
      expect(select).toHaveClass('wave:border-destructive');
      expect(container.firstElementChild).toBe(select);
    });

    it('customises the message element with errorMessageProps', () => {
      render(
        <Select aria-label="Letter" error="Pick one" errorMessageProps={{ className: 'italic' }}>
          {options}
        </Select>,
      );
      expect(screen.getByRole('alert')).toHaveClass('italic', 'wave:text-caption-1');
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
        expect(select).not.toHaveClass('wave:border-destructive');
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
        expect(select).not.toHaveClass('wave:border-input');
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

describe('sizes and appearances (Phase 4 P4-01)', () => {
  const select = (name = 'Country') => screen.getByRole('combobox', { name });
  const renderSelect = (props: Partial<SelectProps> = {}) =>
    render(
      <Select aria-label="Country" {...props}>
        <option>Norway</option>
      </Select>,
    );

  it('renders the 0.7 classes (paddings and chevron) by default', () => {
    renderSelect();
    expect(select()).toHaveClass(
      'wave:h-8',
      'wave:ps-3',
      'wave:pe-8',
      'wave:text-body-1',
      'wave:bg-[size:5px_5px,5px_5px]',
      'wave:bg-[position:right_16px_center,right_11px_center]',
    );
    expect(select()).toHaveAttribute('data-size', 'medium');
    expect(select()).toHaveAttribute('data-appearance', 'outline');
  });

  it.each([
    [
      'small',
      [
        'wave:h-6',
        'wave:ps-2',
        'wave:pe-6',
        'wave:text-caption-1',
        'wave:bg-[size:4px_4px,4px_4px]',
      ],
    ],
    [
      'large',
      [
        'wave:h-10',
        'wave:ps-4',
        'wave:pe-10',
        'wave:text-body-2',
        'wave:bg-[size:6px_6px,6px_6px]',
      ],
    ],
  ] as const)('size="%s" scales the paddings and the chevron', (size, classes) => {
    renderSelect({ size });
    expect(select()).toHaveClass(...classes);
  });

  it.each([
    ['underline', ['wave:rounded-none', 'wave:border-0', 'wave:border-b', 'wave:bg-transparent']],
    ['filled-darker', ['wave:border-input-filled-stroke', 'wave:bg-input-filled-darker']],
    ['filled-lighter', ['wave:border-input-filled-stroke', 'wave:bg-input-filled-lighter']],
  ] as const)('appearance="%s" renders its classes', (appearance, classes) => {
    renderSelect({ appearance });
    expect(select()).toHaveClass(...classes);
    expect(select()).toHaveAttribute('data-appearance', appearance);
  });

  it('a filled appearance keeps the chevron image next to its fill', () => {
    renderSelect({ appearance: 'filled-darker' });
    expect(select()).toHaveClass('wave:bg-input-filled-darker');
    expect(select().className).toContain('bg-[image:');
  });

  it('takes the Field size; its own size wins', () => {
    const { rerender } = renderWithFieldContext(
      <Select>
        <option>Norway</option>
      </Select>,
      { size: 'large' },
    );
    expect(select(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'large');
    rerender(
      <Select size="small">
        <option>Norway</option>
      </Select>,
    );
    expect(select(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'small');
  });

  it('takes WaveProvider inputDefaults; its own props win', () => {
    const { rerender } = renderWithProviders(
      <Select aria-label="Country">
        <option>Norway</option>
      </Select>,
      { inputDefaults: { size: 'small', appearance: 'underline' } },
    );
    expect(select()).toHaveAttribute('data-size', 'small');
    expect(select()).toHaveAttribute('data-appearance', 'underline');
    rerender(
      <Select aria-label="Country" size="large" appearance="outline">
        <option>Norway</option>
      </Select>,
    );
    expect(select()).toHaveAttribute('data-size', 'large');
    expect(select()).toHaveAttribute('data-appearance', 'outline');
  });

  it.each(['underline', 'filled-darker'] as const)(
    'an invalid %s field keeps the destructive border and the focus color on its bottom',
    (appearance) => {
      renderSelect({ appearance, error: true });
      expect(select()).toHaveClass('wave:border-destructive', 'wave:focus:border-b-primary');
    },
  );

  it.each(['underline', 'filled-darker'] as const)(
    'a Field error at %s keeps the destructive border and the focus color on its bottom',
    (appearance) => {
      renderWithFieldContext(
        <Select appearance={appearance}>
          <option>Norway</option>
        </Select>,
        { errorId: FIELD_TEST_IDS.errorId },
      );
      expect(select(FIELD_TEST_TEXT.label)).toHaveClass(
        'wave:border-destructive',
        'wave:focus:border-b-primary',
      );
    },
  );

  it.each([
    ['a number', 4],
    ['a digit-only string (0.7 HTML style)', '5'],
  ])(
    'has no numeric size (removed in 1.0): %s renders neither the native attribute nor a design size',
    (_label, value) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      // @ts-expect-error -- a numeric `size` is removed in 1.0: use `htmlSize`
      renderSelect({ size: value as number });
      // Without the native `size` the `<select>` keeps the accessible role `combobox`.
      const el = select();
      expect(el).not.toHaveAttribute('size');
      expect(el).toHaveAttribute('data-size', 'medium');
      expect(el).toHaveClass('wave:h-8', 'wave:text-body-1');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    },
  );

  it('another untyped size string renders the medium outline defaults, without the attribute', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderSelect({
      size: 'huge' as unknown as 'medium',
      appearance: 'glass' as unknown as 'outline',
    });
    const el = select();
    expect(el).not.toHaveAttribute('size');
    expect(el).toHaveAttribute('data-size', 'medium');
    expect(el).toHaveAttribute('data-appearance', 'outline');
    expect(el).toHaveClass('wave:h-8', 'wave:text-body-1', 'wave:border-input');
    expect(warn).not.toHaveBeenCalled();
  });

  it('htmlSize alone does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderSelect({ htmlSize: 3 });
    // A `size` greater than 1 gives the `<select>` the accessible role `listbox` (jsdom follows
    // the HTML-AAM mapping here), so it is no longer reachable as a `combobox`: query by label.
    const el = screen.getByLabelText('Country');
    expect(el).toHaveAttribute('size', '3');
    expect(warn).not.toHaveBeenCalled();
  });

  it('htmlSize next to a numeric size from untyped code: htmlSize alone reaches the attribute', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error -- a numeric `size` is removed in 1.0: use `htmlSize`
    renderSelect({ htmlSize: 3, size: 4 });
    // A native `size` greater than 1 makes the `<select>` a `listbox`: query by label.
    const el = screen.getByLabelText('Country');
    expect(el).toHaveAttribute('size', '3');
    expect(warn).not.toHaveBeenCalled();
  });

  it('types: CoreSize only', () => {
    expectTypeOf<SelectProps['size']>().toEqualTypeOf<CoreSize | undefined>();
    render(
      // @ts-expect-error not a size
      <Select aria-label="Country" size="huge">
        <option>Norway</option>
      </Select>,
    );
  });
});
