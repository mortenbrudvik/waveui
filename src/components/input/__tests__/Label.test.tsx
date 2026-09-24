import * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label, type LabelProps } from '../Label';
import type { TextWeight } from '../../../lib/types';
import { testSystemProps } from '../../../test-utils';

describe('Label', () => {
  testSystemProps(Label, {
    expectedTag: 'label',
    displayName: 'Label',
    defaultProps: { children: 'Name' },
    a11yVariants: [
      { name: 'required', props: { required: true } },
      { name: 'disabled', props: { disabled: true } },
    ],
    conflictingClass: { className: 'text-body-2', overrides: 'text-body-1' },
  });

  it('declares ref in LabelProps (C-REF)', () => {
    expectTypeOf<LabelProps['ref']>().toEqualTypeOf<React.Ref<HTMLLabelElement> | undefined>();
  });

  it('adopts the shared TextWeight vocabulary (layout#16)', () => {
    expectTypeOf<NonNullable<LabelProps['weight']>>().toEqualTypeOf<TextWeight>();
  });

  it('renders its children as the label text', () => {
    render(
      <>
        <Label htmlFor="user">Username</Label>
        <input id="user" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Username' })).toBeInTheDocument();
  });

  it('shows an aria-hidden required indicator that is not part of the name', () => {
    render(
      <>
        <Label htmlFor="email" required>
          Email
        </Label>
        <input id="email" />
      </>,
    );
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('*')).toHaveClass('ms-1');
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
  });

  it('does not show a required indicator by default', () => {
    render(<Label>Name</Label>);
    expect(screen.queryByText('*')).toBeNull();
  });

  it('applies disabled styling', () => {
    render(
      <Label disabled data-testid="label">
        Name
      </Label>,
    );
    expect(screen.getByTestId('label')).toHaveClass('text-muted-foreground');
    expect(screen.getByTestId('label')).not.toHaveClass('text-foreground');
  });

  it('passes htmlFor to the label element', () => {
    render(
      <Label htmlFor="input-1" data-testid="label">
        Name
      </Label>,
    );
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'input-1');
  });

  describe('sizes (input-basic#40)', () => {
    it.each([
      ['small', 'text-caption-1'],
      ['medium', 'text-body-1'],
      ['large', 'text-body-2'],
    ] as const)('size %s uses %s', (size, token) => {
      render(
        <Label size={size} data-testid="label">
          Name
        </Label>,
      );
      const label = screen.getByTestId('label');
      expect(label).toHaveClass(token);
      for (const other of ['text-caption-1', 'text-body-1', 'text-body-2'].filter(
        (t) => t !== token,
      )) {
        expect(label).not.toHaveClass(other);
      }
    });

    it('defaults to medium (text-body-1)', () => {
      render(<Label data-testid="label">Name</Label>);
      expect(screen.getByTestId('label')).toHaveClass('text-body-1');
    });
  });

  describe('weight (layout#16)', () => {
    it.each([
      ['semibold', 'font-semibold'],
      ['bold', 'font-bold'],
    ] as const)('weight %s uses %s', (weight, cls) => {
      render(
        <Label weight={weight} data-testid="label">
          Name
        </Label>,
      );
      expect(screen.getByTestId('label')).toHaveClass(cls);
    });

    it('regular adds no bold weight class', () => {
      render(<Label data-testid="label">Name</Label>);
      const label = screen.getByTestId('label');
      expect(label).not.toHaveClass('font-semibold');
      expect(label).not.toHaveClass('font-bold');
    });
  });
});
