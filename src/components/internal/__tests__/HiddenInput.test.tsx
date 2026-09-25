import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { HiddenInput, useFormReset, type HiddenInputProps } from '../HiddenInput';
import { useFormReset as useFormResetFromHooks } from '../../../hooks/useFormReset';
import { axe } from '../../../test-utils';

function hiddenInputs(root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[data-wave-hidden-input]'));
}

/** A stand-in control: a relative root with a focusable button and the hidden input. */
function Control(props: HiddenInputProps & { label?: string }) {
  const { label = 'Control', ...rest } = props;
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  return (
    <span style={{ position: 'relative' }} data-testid="root">
      <button type="button" ref={buttonRef}>
        {label}
      </button>
      <HiddenInput {...rest} onInvalid={rest.onInvalid ?? (() => buttonRef.current?.focus())} />
    </span>
  );
}

function renderInForm(ui: React.ReactElement, formProps: React.ComponentProps<'form'> = {}) {
  const result = render(
    <form aria-label="Test form" {...formProps}>
      {ui}
    </form>,
  );
  const form = result.container.querySelector('form') as HTMLFormElement;
  return { ...result, form };
}

describe('HiddenInput — rendering rules', () => {
  it('renders nothing without name or required (no default names, C-FORMS)', () => {
    const { form } = renderInForm(<HiddenInput value="a" />);
    expect(hiddenInputs()).toHaveLength(0);
    expect(Array.from(new FormData(form).keys())).toEqual([]);
  });

  it('with a name: one native hidden input carrying the value', () => {
    const { form } = renderInForm(<HiddenInput name="country" value="us" />);
    const [input] = hiddenInputs();
    expect(input.type).toBe('hidden');
    expect(new FormData(form).get('country')).toBe('us');
  });

  it('null/undefined free values submit an empty string', () => {
    const { form } = renderInForm(<HiddenInput name="country" value={null} />);
    expect(new FormData(form).get('country')).toBe('');
  });

  it('arrays → one input per value; an empty array submits nothing', () => {
    const { form, rerender } = renderInForm(<HiddenInput name="tags" value={['a', 'b', 'c']} />);
    expect(new FormData(form).getAll('tags')).toEqual(['a', 'b', 'c']);
    rerender(
      <form aria-label="Test form">
        <HiddenInput name="tags" value={[]} />
      </form>,
    );
    expect(new FormData(form).getAll('tags')).toEqual([]);
  });

  it('checkbox kind (not required): submitted only while checked, value defaults to "on"', () => {
    const { form, rerender } = renderInForm(
      <HiddenInput name="agree" type="checkbox" value={null} />,
    );
    expect(new FormData(form).has('agree')).toBe(false);
    rerender(
      <form aria-label="Test form">
        <HiddenInput name="agree" type="checkbox" value={null} checked />
      </form>,
    );
    expect(new FormData(form).get('agree')).toBe('on');
    rerender(
      <form aria-label="Test form">
        <HiddenInput name="agree" type="checkbox" value="yes" checked />
      </form>,
    );
    expect(new FormData(form).get('agree')).toBe('yes');
  });

  it('radio kind (not required): submitted only when a value is chosen', () => {
    const { form, rerender } = renderInForm(<HiddenInput name="size" type="radio" value="" />);
    expect(new FormData(form).has('size')).toBe(false);
    rerender(
      <form aria-label="Test form">
        <HiddenInput name="size" type="radio" value="m" />
      </form>,
    );
    expect(new FormData(form).get('size')).toBe('m');
  });

  it('disabled inputs are not submitted', () => {
    const { form } = renderInForm(<HiddenInput name="country" value="us" disabled />);
    expect(new FormData(form).has('country')).toBe(false);
  });

  it('the form attribute associates the input with a form elsewhere in the document', () => {
    render(
      <>
        <form id="external" aria-label="External" />
        <HiddenInput name="country" value="us" form="external" />
      </>,
    );
    const form = document.getElementById('external') as HTMLFormElement;
    expect(new FormData(form).get('country')).toBe('us');
  });
});

describe('HiddenInput — required (native validation)', () => {
  it('free values use a required text input that is invalid while empty', () => {
    const { form, rerender } = renderInForm(<Control required value="" />);
    const [input] = hiddenInputs();
    expect(input.type).toBe('text');
    expect(input.required).toBe(true);
    expect(input.validity.valueMissing).toBe(true);
    expect(form.checkValidity()).toBe(false);
    rerender(
      <form aria-label="Test form">
        <Control required value="us" />
      </form>,
    );
    expect(form.checkValidity()).toBe(true);
  });

  it('required without a name validates but submits nothing', () => {
    const { form } = renderInForm(<Control required value="us" />);
    expect(form.checkValidity()).toBe(true);
    expect(Array.from(new FormData(form).keys())).toEqual([]);
  });

  it('required with a name submits the value', () => {
    const { form } = renderInForm(<Control required name="country" value="us" />);
    expect(new FormData(form).get('country')).toBe('us');
  });

  it('required arrays: invalid while empty (placeholder carries no name), one input per value', () => {
    const { form, rerender } = renderInForm(<Control required name="tags" value={[]} />);
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).getAll('tags')).toEqual([]);
    rerender(
      <form aria-label="Test form">
        <Control required name="tags" value={['a', 'b']} />
      </form>,
    );
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).getAll('tags')).toEqual(['a', 'b']);
  });

  it('single-choice groups use a required radio (the "select one of these options" message)', () => {
    const { form, rerender } = renderInForm(<Control required type="radio" name="size" value="" />);
    const [input] = hiddenInputs();
    expect(input.type).toBe('radio');
    expect(input.validity.valueMissing).toBe(true);
    rerender(
      <form aria-label="Test form">
        <Control required type="radio" name="size" value="m" />
      </form>,
    );
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get('size')).toBe('m');
  });

  it('a required radio without a name gets its own group name until a value is chosen', () => {
    // Chrome and Firefox never report an unnamed radio as valueMissing (jsdom does), so without a
    // group name `required` would not block submission. The name never reaches FormData: unchecked
    // radios are not submitted, and it is dropped once the radio is checked (C-FORMS).
    function Two({ a, b }: { a: string; b: string }) {
      return (
        <form aria-label="Test form">
          <Control required type="radio" value={a} label="A" />
          <Control required type="radio" value={b} label="B" />
        </form>
      );
    }
    const { container, rerender } = render(<Two a="" b="" />);
    const form = container.querySelector('form') as HTMLFormElement;
    const [a, b] = hiddenInputs();
    expect(a.name).not.toBe('');
    expect(b.name).not.toBe('');
    expect(a.name).not.toBe(b.name); // separate groups: one control's choice cannot satisfy another
    expect(Array.from(new FormData(form).keys())).toEqual([]);

    rerender(<Two a="m" b="" />);
    const [chosen, open] = hiddenInputs();
    expect(chosen.checked).toBe(true);
    expect(chosen).not.toHaveAttribute('name');
    expect(open.name).not.toBe('');
    expect(Array.from(new FormData(form).keys())).toEqual([]);
    expect(form.checkValidity()).toBe(false); // B is still missing

    rerender(<Two a="m" b="s" />);
    expect(form.checkValidity()).toBe(true);
    expect(Array.from(new FormData(form).keys())).toEqual([]);
  });

  it('a required radio keeps the consumer’s name in every state', () => {
    const { form, rerender } = renderInForm(<Control required type="radio" name="size" value="" />);
    expect(hiddenInputs()[0].name).toBe('size');
    rerender(
      <form aria-label="Test form">
        <Control required type="radio" name="size" value="m" />
      </form>,
    );
    expect(hiddenInputs()[0].name).toBe('size');
    expect(new FormData(form).get('size')).toBe('m');
  });

  it('booleans use a required checkbox (invalid while unchecked)', () => {
    const { form, rerender } = renderInForm(<Control required type="checkbox" value={null} />);
    const [input] = hiddenInputs();
    expect(input.type).toBe('checkbox');
    expect(input.validity.valueMissing).toBe(true);
    rerender(
      <form aria-label="Test form">
        <Control required type="checkbox" name="agree" value={null} checked />
      </form>,
    );
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get('agree')).toBe('on');
  });

  it('is hidden from AT and the tab order, and absolutely positioned inside the control root', () => {
    render(<Control required value="" />);
    const [input] = hiddenInputs();
    expect(input).toHaveAttribute('aria-hidden', 'true');
    expect(input.tabIndex).toBe(-1);
    expect(input.parentElement).toBe(screen.getByTestId('root'));
    expect(input.style.position).toBe('absolute');
    expect(input.style.insetInlineStart).toBe('0px');
    expect(input.style.bottom).toBe('0px');
    expect(input.style.width).toBe('1px');
    expect(input.style.height).toBe('1px');
    expect(input.style.opacity).toBe('0');
    expect(input.style.pointerEvents).toBe('none');
  });

  it('does not warn about a controlled input without onChange', () => {
    const spy = vi.spyOn(console, 'error');
    render(
      <>
        <Control required value="x" />
        <Control required type="checkbox" value={null} checked />
        <Control required type="radio" value="x" />
      </>,
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('onInvalid runs when validation fails (the control focuses itself)', () => {
    const onInvalid = vi.fn();
    const { form } = renderInForm(<Control required value="" onInvalid={onInvalid} />);
    form.checkValidity();
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it('the default stand-in onInvalid moves focus to the visible control', () => {
    const { form } = renderInForm(<Control required value="" label="Pick" />);
    form.checkValidity();
    expect(screen.getByRole('button', { name: 'Pick' })).toHaveFocus();
  });

  it('focus that lands on the input (browser validation) goes back to the control', () => {
    render(<Control required value="" label="Pick" />);
    const button = screen.getByRole('button', { name: 'Pick' });
    button.focus();
    hiddenInputs()[0].focus();
    expect(button).toHaveFocus();
  });

  it('sends focus back synchronously, before the browser listens for the input’s blur', () => {
    // Interactive validation reports the problem on this input. Firefox 155
    // (FormValidationChild.notifyInvalidSubmit): `element.focus()`, then
    // `element.addEventListener('blur', …)` (which hides the popup), then shows the popup. Chromium
    // 153 focuses the input, then shows the bubble, and hides it when the input blurs later. Only a
    // redirect that completes inside `focus()` keeps the message visible (verified in both engines);
    // a deferred one (timer, next key) blurs the input after the popup is shown and hides it.
    vi.useFakeTimers();
    try {
      const { form } = renderInForm(<Control required value="" label="Pick" />);
      const [input] = hiddenInputs();
      const button = screen.getByRole('button', { name: 'Pick' });
      form.checkValidity(); // 'invalid' → onInvalid focuses the control
      expect(button).toHaveFocus();
      const hidePopup = vi.fn();
      input.focus(); // the browser reports the problem on the input …
      input.addEventListener('blur', hidePopup); // … then watches its blur
      expect(button).toHaveFocus();
      act(() => {
        vi.runOnlyPendingTimers(); // a deferred redirect would blur the input now
      });
      expect(button).toHaveFocus();
      expect(hidePopup).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('focus arriving from outside the control goes to the control’s first tabbable element', () => {
    render(
      <>
        <button type="button">Outside</button>
        <Control required value="" label="Pick" />
      </>,
    );
    screen.getByRole('button', { name: 'Outside' }).focus();
    hiddenInputs()[0].focus();
    expect(screen.getByRole('button', { name: 'Pick' })).toHaveFocus();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        <Control required value="" label="Text" />
        <Control required type="radio" value="" label="Radio" />
        <Control required type="checkbox" value={null} label="Checkbox" />
        <Control name="plain" value="v" label="Plain" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('HiddenInput module', () => {
  it('re-exports useFormReset from src/hooks', () => {
    expect(useFormReset).toBe(useFormResetFromHooks);
  });

  it('has a displayName', () => {
    expect(HiddenInput.displayName).toBe('HiddenInput');
  });
});
