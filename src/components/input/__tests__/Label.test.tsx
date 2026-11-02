import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Label, type LabelProps } from '../Label';
import { labelClassNames } from '../../../lib/classNames';
import type { TextWeight } from '../../../lib/types';
import { expectInertSlotProps, sortAttributes, testSystemProps } from '../../../test-utils';

describe('Label', () => {
  testSystemProps(Label, {
    expectedTag: 'label',
    displayName: 'Label',
    defaultProps: { children: 'Name' },
    a11yVariants: [
      { name: 'required', props: { required: true } },
      { name: 'disabled', props: { disabled: true } },
    ],
    conflictingClass: { className: 'text-body-2', overrides: 'wave:text-body-1' },
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
    expect(screen.getByText('*')).toHaveClass('wave:ms-1');
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
    expect(screen.getByTestId('label')).toHaveClass('wave:text-muted-foreground');
    expect(screen.getByTestId('label')).not.toHaveClass('wave:text-foreground');
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
      ['small', 'wave:text-caption-1'],
      ['medium', 'wave:text-body-1'],
      ['large', 'wave:text-body-2'],
    ] as const)('size %s uses %s', (size, token) => {
      render(
        <Label size={size} data-testid="label">
          Name
        </Label>,
      );
      const label = screen.getByTestId('label');
      expect(label).toHaveClass(token);
      for (const other of ['wave:text-caption-1', 'wave:text-body-1', 'wave:text-body-2'].filter(
        (t) => t !== token,
      )) {
        expect(label).not.toHaveClass(other);
      }
    });

    it('defaults to medium (text-body-1)', () => {
      render(<Label data-testid="label">Name</Label>);
      expect(screen.getByTestId('label')).toHaveClass('wave:text-body-1');
    });
  });

  describe('required content (Phase 4 D27)', () => {
    it('true shows the decorative asterisk', () => {
      render(<Label required>Email</Label>);
      expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    });

    it('content replaces the asterisk inside the same decorative span', () => {
      render(<Label required={<span>(required)</span>}>Email</Label>);
      const indicator = screen.getByText('(required)').parentElement as HTMLElement;
      expect(indicator).toHaveAttribute('aria-hidden', 'true');
      expect(indicator).toHaveClass('wave:ms-1', 'wave:text-error');
      expect(screen.queryByText('*')).toBeNull();
    });

    it('content that renders nothing shows no indicator', () => {
      const { container } = render(<Label required="">Email</Label>);
      expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    });
  });

  describe('weight (layout#16)', () => {
    it.each([
      ['medium', 'wave:font-medium'],
      ['semibold', 'wave:font-semibold'],
      ['bold', 'wave:font-bold'],
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
      expect(label).not.toHaveClass('wave:font-medium');
      expect(label).not.toHaveClass('wave:font-semibold');
      expect(label).not.toHaveClass('wave:font-bold');
    });
  });
});

describe('Label — slotProps', () => {
  type LabelSlotProps = NonNullable<LabelProps['slotProps']>;

  it('renders the 0.17.1 markup without slotProps (attributes compared in sorted order)', () => {
    // Captured from 17abc07: the merged props may put the class before the locked attributes.
    expect(
      sortAttributes(
        renderToString(
          <Label required htmlFor="name">
            Name
          </Label>,
        ),
      ),
    ).toBe(
      [
        '<label class="wave-label wave:text-foreground wave:text-body-1" for="name">Name',
        '<span aria-hidden="true" class="wave-label__required wave:ms-1 wave:text-error">*',
        '</span>',
        '</label>',
      ].join(''),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: LabelProps[] = [
      { required: true },
      { required: <em>(required)</em>, disabled: true, size: 'large', weight: 'bold' },
      { required: false, htmlFor: 'x' },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps) => (
          <Label {...props} slotProps={slotProps}>
            Name
          </Label>
        ),
        { required: {} },
      );
    }
  });

  it('puts your className, style, data-*, handlers and ref on the required indicator', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const onClick = vi.fn();
    render(
      <Label
        required
        slotProps={{
          required: {
            ref,
            className: 'my-mark',
            style: { color: 'red' },
            'data-part': 'required',
            title: 'Required',
            onClick,
          },
        }}
      >
        Name
      </Label>,
    );
    const mark = screen.getByText('*');
    expect(ref.current).toBe(mark);
    expect(mark).toHaveClass(labelClassNames.required, 'wave:text-error', 'my-mark');
    expect(mark.classList[0]).toBe(labelClassNames.required);
    expect(mark.classList[mark.classList.length - 1]).toBe('my-mark');
    expect(mark).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(mark).toHaveAttribute('data-part', 'required');
    expect(mark).toHaveAttribute('title', 'Required');
    fireEvent.click(mark);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the indicator out of the name: aria-hidden is locked', () => {
    render(
      <>
        <Label htmlFor="name" required slotProps={{ required: { 'aria-hidden': false } }}>
          Name
        </Label>
        <input id="name" />
      </>,
    );
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('keeps the indicator out of the tab order: a part sets no tabIndex on it', () => {
    render(
      <Label required slotProps={{ required: { tabIndex: 0 } }}>
        Name
      </Label>,
    );
    expect(screen.getByText('*')).not.toHaveAttribute('tabindex');
  });

  it('ignores the part while no indicator is shown', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Label slotProps={{ required: { ref } }}>Name</Label>);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(ref.current).toBeNull();
  });

  it('types the part for its element, and takes no children', () => {
    expectTypeOf<keyof LabelSlotProps>().toEqualTypeOf<'required'>();
    expectTypeOf<NonNullable<LabelSlotProps['required']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- the part takes no children: `required` gives the indicator its content
    void (<Label slotProps={{ required: { children: '!' } }}>Name</Label>);
  });
});
