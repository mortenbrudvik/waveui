import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PickerExpandButton,
  showsExpandButton,
  type PickerExpandButtonProps,
} from '../Combobox.expand';
import { testDisplayName } from '../../../test-utils';

/** The expand button with the props every picker passes; `overrides` replaces any of them. */
function renderButton(overrides: Partial<PickerExpandButtonProps> = {}) {
  const props: PickerExpandButtonProps = {
    component: 'Combobox',
    expandIcon: undefined,
    label: 'Open',
    expanded: false,
    listboxId: 'listbox',
    disabled: false,
    onToggle: vi.fn(),
    ...overrides,
  };
  render(<PickerExpandButton {...props} />);
  return screen.getByRole('button', { name: 'Open' });
}

describe('PickerExpandButton (module-only)', () => {
  testDisplayName(PickerExpandButton, 'PickerExpandButton');

  it('keeps showsExpandButton’s optional-indicator rule', () => {
    expect(showsExpandButton(undefined)).toBe(true);
    expect(showsExpandButton(null)).toBe(true);
    expect(showsExpandButton(false)).toBe(false);
  });

  // 0.11 spec §1.12.
  describe('dimDisabled', () => {
    it('PickerExpandButton dims itself while disabled by default', () => {
      const button = renderButton({ disabled: true });
      expect(button).toBeDisabled();
      expect(button).toHaveClass(
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',
        'aria-disabled:cursor-not-allowed',
        'aria-disabled:opacity-50',
        'aria-disabled:focus-visible:opacity-100',
      );
    });

    it('dimDisabled={true} is the default look', () => {
      const button = renderButton({ disabled: true, dimDisabled: true });
      expect(button).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });

    it('dimDisabled={false} keeps only the not-allowed cursor', () => {
      const button = renderButton({ disabled: true, dimDisabled: false });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:cursor-not-allowed');
      // One class per assertion: a multi-class `.not.toHaveClass` passes when any one is missing.
      expect(button).not.toHaveClass('disabled:opacity-50');
      expect(button).not.toHaveClass('aria-disabled:opacity-50');
      expect(button).not.toHaveClass('aria-disabled:cursor-not-allowed');
      expect(button).not.toHaveClass('aria-disabled:focus-visible:opacity-100');
      // The rest of the button is unchanged.
      expect(button).toHaveClass('absolute', 'h-6', 'w-6', 'end-1', 'bg-transparent', 'p-0');
    });

    it('passes a className first, so a positioning class of the host stays', () => {
      const button = renderButton({ className: 'top-1.5', dimDisabled: false });
      expect(button.className.split(' ')[0]).toBe('top-1.5');
      // The medium box (24px at the inline end) stays next to it.
      expect(button).toHaveClass('top-1.5', 'absolute', 'h-6', 'w-6', 'end-1');
    });

    it('types dimDisabled as an optional boolean', () => {
      expectTypeOf<PickerExpandButtonProps['dimDisabled']>().toEqualTypeOf<boolean | undefined>();
    });
  });
});
