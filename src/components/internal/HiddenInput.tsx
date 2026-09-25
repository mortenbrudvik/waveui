import * as React from 'react';
import { useId } from '../../hooks/useId';
import { getFirstTabbable } from '../../lib/focus';

export { useFormReset } from '../../hooks/useFormReset';

/** Properties of {@link HiddenInput} (internal; spec §2.5, C-FORMS). */
export interface HiddenInputProps {
  /** Field name. Without `name` (and without `required`) nothing is rendered. */
  name?: string;
  /** Id of the form the input belongs to, when the control is outside it. */
  form?: string;
  /** Disabled inputs are neither submitted nor validated. */
  disabled?: boolean;
  /**
   * The submitted value. Arrays → one input per value (an empty array submits nothing).
   * `null`/`undefined` → `''` for free values; for checkbox/radio kinds the input's `value`.
   */
  value: string | readonly string[] | null | undefined;
  /**
   * The kind of control. Without `required` every kind renders native `type="hidden"` inputs.
   * With `required` a real (visually hidden) input validates natively:
   * `'radio'` for single-choice groups (RadioGroup, Rating, SwatchPicker — the browser says
   * "select one of these options"), `'checkbox'` for booleans (Checkbox, Switch), `'text'` for free
   * values (pickers, SpinButton). `'hidden'` with `required` behaves like `'text'`.
   * @default 'hidden'
   */
  type?: 'hidden' | 'text' | 'checkbox' | 'radio';
  /**
   * Checkbox kind: whether the value is submitted / the requirement is met (default `false`).
   * Radio kind: default "a non-empty value is given".
   */
  checked?: boolean;
  /** Renders a real input that takes part in native constraint validation. */
  required?: boolean;
  /** Called when the form's validation fails on this input — focus the visible control here. */
  onInvalid?: (event: React.FormEvent<HTMLInputElement>) => void;
}

/**
 * Required inputs sit at the control's inline-start bottom corner inside its `relative` root, so the
 * browser's validation bubble and scroll-into-view point at the control (spec §2.5).
 */
const REQUIRED_STYLE: React.CSSProperties = {
  position: 'absolute',
  insetInlineStart: 0,
  bottom: 0,
  width: 1,
  height: 1,
  margin: 0,
  padding: 0,
  border: 0,
  opacity: 0,
  pointerEvents: 'none',
};

function noop() {}

/**
 * The browser focuses an invalid input when it reports the problem, after the `invalid` event (so
 * after `onInvalid` focused the control). This input is `aria-hidden` and invisible, so focus goes
 * straight back to the visible control: the element it came from when that is part of the same
 * control root, else the root's first tabbable element.
 *
 * The redirect must complete inside the browser's `focus()` call. Firefox
 * (`FormValidationChild.notifyInvalidSubmit`) calls `element.focus()`, then adds the `blur` listener
 * that hides its popup, then shows the popup; Chromium focuses the input, then shows the bubble,
 * which a later blur hides. Checked in Chromium 153 and Firefox 155 with a real submit click: a
 * synchronous redirect keeps the message and leaves focus on the control; without a redirect focus
 * stays on this invisible input; a deferred redirect (timer, next key) hides the message. Firefox
 * then closes its popup on the next click, scroll or zoom rather than on the control's blur.
 */
function redirectFocus(event: React.FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const root = input.parentElement;
  if (!root) return;
  const from = event.relatedTarget;
  const target =
    from instanceof HTMLElement && from !== input && root.contains(from)
      ? from
      : getFirstTabbable(root);
  if (target && target !== input) target.focus();
}

function firstValue(value: HiddenInputProps['value']): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return value[0] ?? null;
}

function valueList(value: HiddenInputProps['value']): readonly string[] {
  if (value == null) return [''];
  if (typeof value === 'string') return [value];
  return value;
}

/**
 * Native form participation for controls built on buttons and divs (C-FORMS). Renders `null`
 * unless the consumer passes `name` or `required` — components never invent a default name, so a
 * control inside an existing form adds no field of its own.
 *
 * - Without `required`: `type="hidden"` inputs carry the value (arrays: one per value; checkbox
 *   and radio kinds only while checked/chosen).
 * - With `required`: real inputs (`aria-hidden`, `tabIndex={-1}`, `pointer-events: none`,
 *   opacity 0, a no-op `onChange`) absolutely positioned inside the control's **`relative`
 *   root**, so native validation blocks submission with the right message and points at the
 *   control. `onInvalid` should focus the visible control; focus the browser moves to the input
 *   is sent back to the control. Browsers never report an unnamed radio as missing, so a required
 *   radio without `name` gets a unique group name while nothing is chosen (unchecked radios are
 *   not submitted, and the name is dropped once checked, so it never reaches `FormData`).
 *
 * Form reset is wired on the control with `useFormReset` (re-exported here), not by this input, so
 * uncontrolled controls without a name reset too.
 *
 * Internal (not exported from the package).
 */
export function HiddenInput(props: HiddenInputProps): React.ReactElement | null {
  const {
    name,
    form,
    disabled,
    value,
    type = 'hidden',
    checked,
    required = false,
    onInvalid,
  } = props;
  const radioGroupName = useId('wave-required');
  if (!name && !required) return null;

  const choice = type === 'checkbox' || type === 'radio';
  const single = firstValue(value);
  const isChecked =
    type === 'checkbox' ? (checked ?? false) : (checked ?? (single !== null && single !== ''));
  const choiceValue = type === 'checkbox' ? (single ?? 'on') : (single ?? '');

  if (!required) {
    const values = choice ? (isChecked ? [choiceValue] : []) : valueList(value);
    return (
      <>
        {values.map((v, index) => (
          <input
            key={`${index}:${v}`}
            type="hidden"
            name={name}
            form={form}
            disabled={disabled}
            value={v}
            data-wave-hidden-input=""
          />
        ))}
      </>
    );
  }

  const common = {
    form,
    disabled,
    required: true,
    'aria-hidden': true,
    tabIndex: -1,
    style: REQUIRED_STYLE,
    onChange: noop,
    onInvalid,
    onFocus: redirectFocus,
    'data-wave-hidden-input': '',
  } as const;

  if (choice) {
    // Chrome and Firefox treat an unnamed required radio as never missing; a unique group name
    // (only while unchecked, so it is never submitted) restores "select one of these options".
    const inputName = name || (type === 'radio' && !isChecked ? radioGroupName : undefined);
    return (
      <input {...common} type={type} name={inputName} value={choiceValue} checked={isChecked} />
    );
  }

  const values = valueList(value);
  if (values.length === 0) {
    // Nothing chosen: one empty, unnamed input keeps the requirement without submitting a value.
    return <input {...common} type="text" autoComplete="off" value="" />;
  }
  return (
    <>
      {values.map((v, index) => (
        <input
          key={`${index}:${v}`}
          {...common}
          type="text"
          autoComplete="off"
          name={name}
          value={v}
        />
      ))}
    </>
  );
}

HiddenInput.displayName = 'HiddenInput';
