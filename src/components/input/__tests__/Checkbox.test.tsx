import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../Checkbox';
import type { CheckboxLabelPosition, CheckboxProps } from '../Checkbox';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testSystemProps,
  testComposedHandler,
  testNoImplicitSubmit,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

/** The development warning of a Checkbox with children. */
const CHILDREN_WARNING = '[WaveUI] Checkbox: children are not rendered. Pass the label in `label`.';

describe('Checkbox', () => {
  testSystemProps(Checkbox, {
    expectedTag: 'label',
    displayName: 'Checkbox',
    control: { role: 'checkbox' },
    defaultProps: { label: 'Accept' },
    a11yVariants: [
      { name: 'checked', props: { defaultChecked: true } },
      { name: 'indeterminate', props: { indeterminate: true } },
      { name: 'disabled', props: { disabled: true } },
      { name: 'required with a name', props: { name: 'terms', required: true } },
      { name: 'label before', props: { labelPosition: 'before' } },
    ],
  });

  testNoImplicitSubmit(Checkbox, { defaultProps: { label: 'Accept' } });

  testComposedHandler(Checkbox, {
    handler: 'onClick',
    defaultProps: { label: 'Accept' },
    act: async ({ user }) => {
      await user.click(screen.getByRole('checkbox', { name: 'Accept' }));
    },
    assertInternal: () => {
      expect(screen.getByRole('checkbox', { name: 'Accept' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    },
    assertInternalSuppressed: () => {
      expect(screen.getByRole('checkbox', { name: 'Accept' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    },
  });

  it('is named by its label text', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByRole('checkbox')).toHaveAccessibleName('Accept terms');
  });

  it('has no accessible name and no label text when label is not provided', () => {
    render(<Checkbox data-testid="cb" />);
    expect(screen.getByRole('checkbox')).toHaveAccessibleName('');
    expect(screen.getByTestId('cb')).toHaveTextContent('');
  });

  it('starts unchecked by default', () => {
    render(<Checkbox />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('starts checked when defaultChecked is true', () => {
    render(<Checkbox defaultChecked />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Check" />);
    const cb = screen.getByRole('checkbox', { name: 'Check' });
    expect(cb).toHaveAttribute('aria-checked', 'false');
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'true');
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onCheckedChange in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Accept" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('checkbox', { name: 'Accept' }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('respects controlled checked prop', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Accept" checked={false} onCheckedChange={onCheckedChange} />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).toHaveAttribute('aria-checked', 'false');
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('fires onCheckedChange exactly once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <React.StrictMode>
        <Checkbox label="Accept" onCheckedChange={onCheckedChange} />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Accept' }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the deprecated onChange alias working and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onCheckedChange = vi.fn();
      const { rerender } = render(
        <Checkbox label="Accept" onChange={onChange} onCheckedChange={onCheckedChange} />,
      );
      rerender(<Checkbox label="Accept" onChange={onChange} onCheckedChange={onCheckedChange} />);
      await user.click(screen.getByRole('checkbox', { name: 'Accept' }));
      expect(onChange).toHaveBeenCalledWith(true);
      expect(onCheckedChange).toHaveBeenCalledWith(true);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Checkbox: `onChange` is deprecated and will be removed in 1.0. Use ' +
            '`onCheckedChange` instead.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it('toggles with Space from the keyboard', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Accept" onCheckedChange={onCheckedChange} />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    await user.tab();
    expect(cb).toHaveFocus();
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('aria-checked', 'true');
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
  });

  it('renders indeterminate state', () => {
    render(<Checkbox indeterminate />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('indeterminate overrides checked until the consumer clears it: a click still reports the toggled state', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Select all" indeterminate onCheckedChange={onCheckedChange} />);
    const cb = screen.getByRole('checkbox', { name: 'Select all' });
    await user.click(cb);
    await user.click(cb);
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
    // Display and aria-checked keep following `indeterminate`.
    expect(cb).toHaveAttribute('aria-checked', 'mixed');
  });

  it('tri-state "select all": clearing indeterminate in onCheckedChange shows the new state', async () => {
    const user = userEvent.setup();
    function SelectAll() {
      const [items, setItems] = React.useState([true, false]);
      const all = items.every(Boolean);
      return (
        <>
          <Checkbox
            label="Select all"
            checked={all}
            indeterminate={!all && items.some(Boolean)}
            onCheckedChange={(next) => setItems(items.map(() => next))}
          />
          {items.map((checked, i) => (
            <Checkbox
              key={i}
              label={`Item ${i + 1}`}
              checked={checked}
              onCheckedChange={(next) => setItems(items.map((v, j) => (j === i ? next : v)))}
            />
          ))}
        </>
      );
    }
    render(<SelectAll />);
    const selectAll = screen.getByRole('checkbox', { name: 'Select all' });
    expect(selectAll).toHaveAttribute('aria-checked', 'mixed');
    await user.click(selectAll);
    expect(selectAll).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Item 2' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Item 1' }));
    expect(selectAll).toHaveAttribute('aria-checked', 'mixed');
  });

  it('applies disabled state', () => {
    render(<Checkbox disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});

describe('Checkbox — props reach the checkbox control (C-ROUTING)', () => {
  it('routes id, aria-*, tabIndex and autoFocus to the role="checkbox" button', () => {
    render(
      <>
        <p id="cb-desc">More details</p>
        <Checkbox
          data-testid="root"
          id="my-cb"
          aria-describedby="cb-desc"
          aria-invalid
          aria-errormessage="cb-desc"
          aria-details="cb-desc"
          tabIndex={3}
          autoFocus
          label="Accept"
        />
      </>,
    );
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    const root = screen.getByTestId('root');
    expect(root.tagName).toBe('LABEL');
    expect(cb).toHaveAttribute('id', 'my-cb');
    expect(cb).toHaveAccessibleDescription('More details');
    expect(cb).toHaveAttribute('aria-invalid', 'true');
    expect(cb).toHaveAttribute('aria-errormessage', 'cb-desc');
    expect(cb).toHaveAttribute('aria-details', 'cb-desc');
    expect(cb).toHaveAttribute('tabindex', '3');
    expect(cb).toHaveFocus();
    for (const attr of ['id', 'aria-describedby', 'aria-invalid', 'tabindex']) {
      expect(root).not.toHaveAttribute(attr);
    }
  });

  it('keeps ref on the label and exposes the button through controlRef', () => {
    const ref = React.createRef<HTMLLabelElement>();
    const controlRef = React.createRef<HTMLButtonElement>();
    render(<Checkbox ref={ref} controlRef={controlRef} label="Accept" />);
    expect(ref.current?.tagName).toBe('LABEL');
    expect(controlRef.current).toBe(screen.getByRole('checkbox', { name: 'Accept' }));
  });

  it('routes focus and keyboard handlers to the button', async () => {
    const user = userEvent.setup();
    const targets: Record<string, EventTarget | null> = {};
    const record = (name: string) => (e: React.SyntheticEvent) => {
      targets[name] = e.currentTarget;
    };
    const onFocus = vi.fn(record('focus'));
    const onBlur = vi.fn(record('blur'));
    const onKeyDown = vi.fn(record('keydown'));
    const onKeyUp = vi.fn(record('keyup'));
    render(
      <Checkbox
        label="Accept"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      />,
    );
    await user.tab();
    await user.keyboard('a');
    await user.tab();
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(targets).toEqual({ focus: cb, keydown: cb, keyup: cb, blur: cb });
  });

  it('fires a consumer onClick once when the label text is clicked, and toggles once', async () => {
    const user = userEvent.setup();
    const currentTargets: EventTarget[] = [];
    const onClick = vi.fn((e: React.MouseEvent<HTMLButtonElement>) => {
      currentTargets.push(e.currentTarget);
    });
    render(<Checkbox label="Accept terms" onClick={onClick} />);
    await user.click(screen.getByText('Accept terms'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(currentTargets).toEqual([screen.getByRole('checkbox')]);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });
});

// axe exempts the dimmed label text of a disabled control only when that control references the
// text through aria-labelledby: its <label> exemption covers native inputs, not a role="checkbox"
// button. The reference does not depend on the disabled state, and the name stays the same.
describe('Checkbox — the label text names the control through aria-labelledby', () => {
  it.each([
    { state: 'enabled', disabled: false },
    { state: 'disabled', disabled: true },
  ])('references the label text and keeps its name ($state)', ({ disabled }) => {
    render(<Checkbox label="Accept" disabled={disabled} />);
    const cb = screen.getByRole('checkbox');
    const text = screen.getByText('Accept');
    expect(text.id).not.toBe('');
    expect(cb).toHaveAttribute('aria-labelledby', text.id);
    expect(cb).toHaveAccessibleName('Accept');
  });

  it('gives every checkbox its own label text id', () => {
    render(
      <>
        <Checkbox label="Email" />
        <Checkbox label="Phone" />
      </>,
    );
    const email = screen.getByText('Email');
    const phone = screen.getByText('Phone');
    expect(email.id).not.toBe(phone.id);
    expect(screen.getByRole('checkbox', { name: 'Email' })).toHaveAttribute(
      'aria-labelledby',
      email.id,
    );
    expect(screen.getByRole('checkbox', { name: 'Phone' })).toHaveAttribute(
      'aria-labelledby',
      phone.id,
    );
  });

  it('adds no aria-labelledby without label text (aria-label names it)', () => {
    render(<Checkbox aria-label="Select row" disabled />);
    const cb = screen.getByRole('checkbox');
    expect(cb).not.toHaveAttribute('aria-labelledby');
    expect(cb).toHaveAccessibleName('Select row');
  });

  it('a consumer aria-label keeps naming the control; no aria-labelledby is added', () => {
    render(<Checkbox label="Accept" aria-label="Accept the terms" />);
    const cb = screen.getByRole('checkbox');
    expect(cb).not.toHaveAttribute('aria-labelledby');
    expect(cb).toHaveAccessibleName('Accept the terms');
  });

  it('joins a consumer aria-labelledby with the label text (consumer ids first)', () => {
    render(
      <>
        <span id="terms-heading">Terms</span>
        <Checkbox label="Accept" aria-labelledby="terms-heading" disabled />
      </>,
    );
    const cb = screen.getByRole('checkbox');
    expect(cb).toHaveAttribute('aria-labelledby', `terms-heading ${screen.getByText('Accept').id}`);
    expect(cb).toHaveAccessibleName('Terms Accept');
  });

  it('passes a consumer aria-labelledby through unchanged next to a consumer aria-label', () => {
    render(
      <>
        <span id="terms-heading">Terms</span>
        <Checkbox label="Accept" aria-label="Accept the terms" aria-labelledby="terms-heading" />
      </>,
    );
    const cb = screen.getByRole('checkbox');
    expect(cb).toHaveAttribute('aria-labelledby', 'terms-heading');
    expect(cb).toHaveAccessibleName('Terms');
  });
});

describe('Checkbox — Field integration (FieldContext)', () => {
  it('is named by the Field label and described by its hint and error', () => {
    renderWithFieldContext(<Checkbox />, {
      hintId: FIELD_TEST_IDS.hintId,
      errorId: FIELD_TEST_IDS.errorId,
      required: true,
    });
    const cb = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
    expect(cb).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
    // Without label text the Field's <label htmlFor> alone names it.
    expect(cb).not.toHaveAttribute('aria-labelledby');
    expect(cb).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(cb).toHaveAttribute('aria-invalid', 'true');
    expect(cb).toHaveAttribute('aria-required', 'true');
  });

  it('is labelled through aria-labelledby when it carries its own id', () => {
    renderWithFieldContext(<Checkbox id="own-id" />);
    const cb = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
    expect(cb).toHaveAttribute('id', 'own-id');
    expect(cb).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
  });

  it.each([
    { state: 'enabled', disabled: false },
    { state: 'disabled', disabled: true },
  ])(
    'with label text, keeps the Field label and the label text in its name ($state)',
    ({ disabled }) => {
      renderWithFieldContext(<Checkbox label="Accept" disabled={disabled} />);
      const cb = screen.getByRole('checkbox');
      expect(cb).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
      // Both <label>s named it; aria-labelledby lists them in the same (document) order.
      expect(cb).toHaveAttribute(
        'aria-labelledby',
        `${FIELD_TEST_IDS.labelId} ${screen.getByText('Accept').id}`,
      );
      expect(cb).toHaveAccessibleName(`${FIELD_TEST_TEXT.label} Accept`);
    },
  );

  it('with label text and its own id, joins the Field label and the label text', () => {
    renderWithFieldContext(<Checkbox id="own-id" label="Accept" />);
    const cb = screen.getByRole('checkbox');
    expect(cb).toHaveAttribute(
      'aria-labelledby',
      `${FIELD_TEST_IDS.labelId} ${screen.getByText('Accept').id}`,
    );
    expect(cb).toHaveAccessibleName(`${FIELD_TEST_TEXT.label} Accept`);
  });

  it('a consumer aria-label wins over the Field label and the label text', () => {
    renderWithFieldContext(<Checkbox label="Accept" aria-label="Accept the terms" />);
    const cb = screen.getByRole('checkbox');
    expect(cb).not.toHaveAttribute('aria-labelledby');
    expect(cb).toHaveAccessibleName('Accept the terms');
  });

  it('a consumer aria-labelledby comes first, then the Field label and the label text', () => {
    renderWithFieldContext(
      <>
        <span id="terms-heading">Terms</span>
        <Checkbox label="Accept" aria-labelledby="terms-heading" />
      </>,
    );
    const cb = screen.getByRole('checkbox');
    expect(cb).toHaveAttribute(
      'aria-labelledby',
      `terms-heading ${FIELD_TEST_IDS.labelId} ${screen.getByText('Accept').id}`,
    );
    expect(cb).toHaveAccessibleName(`Terms ${FIELD_TEST_TEXT.label} Accept`);
  });

  it('a required Field makes the checkbox required in its form', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <Checkbox label="Accept" />
      </form>,
      { required: true },
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
  });

  it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <Checkbox required={false} />
      </form>,
      { required: true },
    );
    const cb = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
    expect(cb).not.toHaveAttribute('aria-required', 'true');
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });
});

describe('Checkbox — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  it('submits name=value while checked, nothing while unchecked', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Checkbox name="terms" value="yes" label="Accept" />
      </form>,
    );
    expect(new FormData(getForm()).getAll('terms')).toEqual([]);
    await user.click(screen.getByRole('checkbox', { name: 'Accept' }));
    expect(new FormData(getForm()).getAll('terms')).toEqual(['yes']);
  });

  it('submits "on" by default like a native checkbox', () => {
    render(
      <form aria-label="Form">
        <Checkbox name="newsletter" defaultChecked label="Newsletter" />
      </form>,
    );
    expect(new FormData(getForm()).get('newsletter')).toBe('on');
  });

  it('adds nothing to FormData without a name', () => {
    render(
      <form aria-label="Form">
        <Checkbox defaultChecked label="Accept" />
      </form>,
    );
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('associates with a form elsewhere through the form prop', () => {
    render(
      <>
        <form id="other-form" aria-label="Form" />
        <Checkbox name="terms" form="other-form" defaultChecked label="Accept" />
      </>,
    );
    expect(new FormData(getForm()).get('terms')).toBe('on');
  });

  it('required blocks validation until checked', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Checkbox name="terms" required label="Accept" />
      </form>,
    );
    expect(getForm().checkValidity()).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Accept' })).toHaveAttribute(
      'aria-required',
      'true',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Accept' }));
    expect(getForm().checkValidity()).toBe(true);
  });

  it('form reset restores defaultChecked', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Checkbox name="terms" defaultChecked label="Accept" />
      </form>,
    );
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'false');
    act(() => getForm().reset());
    expect(cb).toHaveAttribute('aria-checked', 'true');
  });

  it('a disabled checkbox is neither submitted nor validated, like a native one', () => {
    render(
      <form aria-label="Form">
        <Checkbox name="terms" required disabled label="Accept" />
        <Checkbox name="newsletter" defaultChecked disabled label="Newsletter" />
      </form>,
    );
    // The user cannot check a disabled box, so its requirement must not block the form.
    expect(getForm().checkValidity()).toBe(true);
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('controlled: a form reset reports defaultChecked once through onCheckedChange', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    function Controlled() {
      const [checked, setChecked] = React.useState(false);
      return (
        <form aria-label="Form">
          <Checkbox
            label="Accept"
            checked={checked}
            onCheckedChange={(next) => {
              onCheckedChange(next);
              setChecked(next);
            }}
          />
        </form>
      );
    }
    render(<Controlled />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'true');
    onCheckedChange.mockClear();
    act(() => getForm().reset());
    expect(onCheckedChange.mock.calls).toEqual([[false]]);
    expect(cb).toHaveAttribute('aria-checked', 'false');
  });

  it('form reset also restores a checkbox without a name', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Checkbox label="Accept" />
      </form>,
    );
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'true');
    act(() => getForm().reset());
    expect(cb).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Checkbox — styling tokens', () => {
  it('draws the unchecked box with the accessible stroke and a 2px radius', () => {
    render(<Checkbox label="Accept" />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).toHaveClass(
      'border-stroke-accessible',
      'rounded-xs',
      'forced-colors:border-[ButtonText]',
    );
    expect(cb).not.toHaveClass('rounded-sm');
    expect(cb).not.toHaveClass('border-input');
  });

  it('draws the checked box with primary and the glyph with primary-foreground (currentColor)', () => {
    render(<Checkbox label="Accept" defaultChecked />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).toHaveClass('bg-primary', 'border-primary', 'text-primary-foreground');
    const glyph = cb.querySelector('svg');
    expect(glyph).toHaveAttribute('stroke', 'currentColor');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('forced colors: the box keeps system colors (Highlight fill), only the glyph is the leaf', () => {
    render(<Checkbox label="Accept" defaultChecked />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    // The focusable box is not opted out of forced colors, so its focus outline and border are forced.
    expect(cb).toHaveClass('forced-colors:bg-[Highlight]', 'forced-colors:border-[Highlight]');
    expect(cb).not.toHaveClass('forced-colors:forced-color-adjust-none');
    expect(cb.querySelector('svg')).toHaveClass(
      'forced-colors:forced-color-adjust-none',
      'forced-colors:text-[HighlightText]',
    );
  });

  it('forced colors: a disabled checked box draws a GrayText glyph and border on Canvas, no Highlight', () => {
    render(<Checkbox label="Accept" defaultChecked disabled />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).toHaveClass('forced-colors:border-[GrayText]', 'forced-colors:bg-[Canvas]');
    expect(cb).not.toHaveClass('forced-colors:bg-[Highlight]');
    expect(cb).not.toHaveClass('forced-colors:border-[Highlight]');
    const glyph = cb.querySelector('svg');
    expect(glyph).toHaveClass('forced-colors:text-[GrayText]');
    expect(glyph).not.toHaveClass('forced-colors:bg-[Highlight]');
    expect(glyph).not.toHaveClass('forced-colors:text-[HighlightText]');
  });

  it('forced colors: a disabled indeterminate box has no Highlight fill either', () => {
    render(<Checkbox label="Accept" indeterminate disabled />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).toHaveClass('forced-colors:bg-[Canvas]');
    expect(cb).not.toHaveClass('forced-colors:bg-[Highlight]');
    expect(cb.querySelector('svg')).toHaveClass('forced-colors:text-[GrayText]');
  });

  it('draws the indeterminate glyph with currentColor', () => {
    render(<Checkbox label="Accept" indeterminate />);
    const glyph = screen.getByRole('checkbox', { name: 'Accept' }).querySelector('svg');
    expect(glyph).toHaveAttribute('stroke', 'currentColor');
  });

  it('sets its own zero padding and unchecked background, so app button styles cannot shift or fill the box (C-NATIVE)', () => {
    render(
      <>
        <Checkbox label="Off" />
        <Checkbox label="On" defaultChecked />
        <Checkbox label="Mixed" indeterminate />
      </>,
    );
    expect(screen.getByRole('checkbox', { name: 'Off' })).toHaveClass('p-0', 'bg-transparent');
    for (const name of ['On', 'Mixed']) {
      expect(screen.getByRole('checkbox', { name })).toHaveClass('p-0', 'bg-primary');
    }
  });

  it('draws the label text on the px type ramp like Field and Label (text-body-1)', () => {
    render(<Checkbox label="Accept" />);
    expect(screen.getByText('Accept')).toHaveClass('text-body-1');
    expect(screen.getByText('Accept')).not.toHaveClass('text-sm');
  });

  it('turns off the color transition for reduced motion', () => {
    render(<Checkbox label="Accept" />);
    expect(screen.getByRole('checkbox', { name: 'Accept' })).toHaveClass(
      'motion-reduce:transition-none',
    );
  });
});

describe('Checkbox — rich label and labelPosition', () => {
  const richLabel = (
    <>
      I agree to the <a href="#terms">terms</a>
    </>
  );

  it('a label with a link names the checkbox with its whole text', async () => {
    render(<Checkbox label={richLabel} />);
    const cb = screen.getByRole('checkbox', { name: 'I agree to the terms' });
    expect(screen.getByRole('link', { name: 'terms' })).toBeInTheDocument();
    expect(cb).toHaveAttribute('aria-checked', 'false');
    await expectNoA11yViolations();
  });

  it('clicking the label text toggles; clicking the link inside it does not', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <React.StrictMode>
        <Checkbox label={richLabel} onCheckedChange={onCheckedChange} />
      </React.StrictMode>,
    );
    const cb = screen.getByRole('checkbox', { name: 'I agree to the terms' });
    await user.click(screen.getByText(/I agree to the/));
    expect(cb).toHaveAttribute('aria-checked', 'true');
    // fireEvent, not userEvent: user-event forwards every click inside a <label> to its control,
    // while browsers (and jsdom) skip the forwarding for a click on interactive content.
    fireEvent.click(screen.getByRole('link', { name: 'terms' }));
    expect(cb).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange.mock.calls).toEqual([[true]]);
  });

  it('renders the label after the control by default, with data-label-position="after"', () => {
    render(<Checkbox label="Accept" data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-label-position', 'after');
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    const text = screen.getByText('Accept');
    expect(cb.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('labelPosition="before" renders the label before the control and keeps the name', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Accept" labelPosition="before" data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-label-position', 'before');
    const text = screen.getByText('Accept');
    expect(root.firstElementChild).toBe(text);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(text.compareDocumentPosition(cb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(text);
    expect(cb).toHaveAttribute('aria-checked', 'true');
    await expectNoA11yViolations();
  });

  it('keeps the DOM order of labelPosition="before" under dir="rtl"', () => {
    renderWithProviders(<Checkbox label="Accept" labelPosition="before" data-testid="root" />, {
      dir: 'rtl',
    });
    expect(screen.getByTestId('root').firstElementChild).toBe(screen.getByText('Accept'));
  });

  it('renders label={0} as content', () => {
    render(<Checkbox label={0} />);
    expect(screen.getByRole('checkbox', { name: '0' })).toHaveAttribute(
      'aria-labelledby',
      screen.getByText('0').id,
    );
  });

  it('does not render children and warns once that the label goes in `label`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { rerender } = render(
        <React.StrictMode>
          <Checkbox label="Accept">Ignored text</Checkbox>
        </React.StrictMode>,
      );
      rerender(
        <React.StrictMode>
          <Checkbox label="Accept">Ignored text</Checkbox>
        </React.StrictMode>,
      );
      expect(screen.queryByText('Ignored text')).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toHaveAccessibleName('Accept');
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn about children that render nothing', () => {
    const warn = vi.spyOn(console, 'warn');
    try {
      render(<Checkbox label="Accept">{null}</Checkbox>);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('Checkbox — disabledFocusable', () => {
  it('stays in the tab order with aria-disabled and the data attributes instead of disabled', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Accept" disabledFocusable data-testid="root" />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    await user.tab();
    expect(cb).toHaveFocus();
    expect(cb).not.toBeDisabled();
    expect(cb).toHaveAttribute('aria-disabled', 'true');
    expect(cb).toHaveAttribute('data-disabled', '');
    expect(cb).toHaveAttribute('data-disabled-focusable', '');
    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-disabled');
    await expectNoA11yViolations();
  });

  it('is not toggled by a click, the label text, Space or Enter, and calls no handler (StrictMode)', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <Checkbox
          label="Accept"
          disabledFocusable
          onCheckedChange={onCheckedChange}
          onClick={onClick}
        />
      </React.StrictMode>,
    );
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    await user.click(cb);
    await user.click(screen.getByText('Accept'));
    act(() => cb.focus());
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(cb).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a click, Space and Enter on the checkbox from reaching ancestor onClick handlers (like a natively disabled control)', async () => {
    const user = userEvent.setup();
    const onAncestorClick = vi.fn();
    const { rerender } = render(
      <div onClick={onAncestorClick}>
        <Checkbox label="Accept" disabledFocusable />
      </div>,
    );
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    await user.click(cb);
    act(() => cb.focus());
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onAncestorClick).not.toHaveBeenCalled();
    expect(cb).toHaveAttribute('aria-checked', 'false');

    // The same three activations of an available checkbox do reach the ancestor, once each.
    rerender(
      <div onClick={onAncestorClick}>
        <Checkbox label="Accept" />
      </div>,
    );
    await user.click(cb);
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onAncestorClick).toHaveBeenCalledTimes(3);
  });

  it('wins over disabled: the checkbox stays focusable', () => {
    render(<Checkbox label="Accept" disabled disabledFocusable />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).not.toBeDisabled();
    expect(cb).toHaveAttribute('aria-disabled', 'true');
  });

  it('has the disabled look, forced colors included', () => {
    render(<Checkbox label="Accept" disabledFocusable defaultChecked data-testid="root" />);
    expect(screen.getByTestId('root')).toHaveClass('cursor-not-allowed', 'opacity-50');
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).toHaveClass('forced-colors:border-[GrayText]', 'forced-colors:bg-[Canvas]');
    expect(cb.querySelector('svg')).toHaveClass('forced-colors:text-[GrayText]');
  });

  it('is neither submitted nor validated with its form', () => {
    render(
      <form aria-label="Form">
        <Checkbox name="terms" label="Accept" required defaultChecked disabledFocusable />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(Array.from(new FormData(form).keys())).toEqual([]);
    expect(form.checkValidity()).toBe(true);
  });

  it('does not block the submission of a required Field', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <Checkbox label="Accept" disabledFocusable />
      </form>,
      { required: true },
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });

  it('routes a consumer aria-disabled to the checkbox, which then only carries the attribute', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Accept" aria-disabled data-testid="root" />);
    const cb = screen.getByRole('checkbox', { name: 'Accept' });
    expect(cb).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-disabled');
    expect(cb).not.toHaveAttribute('data-disabled-focusable');
    // Without disabledFocusable, aria-disabled keeps its 0.5 meaning: the look and handlers stay.
    await user.click(cb);
    expect(cb).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Checkbox — types', () => {
  it('types disabledFocusable as an optional boolean', () => {
    expectTypeOf<CheckboxProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
  });

  it('types label as ReactNode and labelPosition as before/after', () => {
    expectTypeOf<CheckboxProps['label']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<CheckboxLabelPosition>().toEqualTypeOf<'before' | 'after'>();
    expectTypeOf<CheckboxProps['labelPosition']>().toEqualTypeOf<
      CheckboxLabelPosition | undefined
    >();
    // @ts-expect-error -- Checkbox labels go before or after the box only
    void (<Checkbox labelPosition="above" />);
    // @ts-expect-error -- Checkbox labels go before or after the box only
    void (<Checkbox labelPosition="below" />);
  });

  it('declares ref, controlRef and the routed handlers in CheckboxProps (C-REF, C-ROUTING)', () => {
    expectTypeOf<CheckboxProps['ref']>().toEqualTypeOf<React.Ref<HTMLLabelElement> | undefined>();
    expectTypeOf<CheckboxProps['controlRef']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<CheckboxProps['onClick']>().toEqualTypeOf<
      React.MouseEventHandler<HTMLButtonElement> | undefined
    >();
    expectTypeOf<CheckboxProps['onCheckedChange']>().toEqualTypeOf<
      ((checked: boolean) => void) | undefined
    >();
  });
});
