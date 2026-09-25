/**
 * Test helper for controls that consume `FieldContext`, so a control's tests cover Field
 * integration (label, hint, validation message, invalid and required state) without rendering the
 * real `Field`.
 *
 * Test-only: excluded from the library program like `src/test-utils.ts` (`tsconfig.json` excludes
 * `src/test-utils*`) and from the library build; type-checked by `tsconfig.dev.json`.
 *
 * @example
 * renderWithFieldContext(<Checkbox />, { hintId: FIELD_TEST_IDS.hintId, required: true });
 * const box = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
 * expect(box).toHaveAccessibleDescription(FIELD_TEST_TEXT.hint);
 * expect(box).toHaveAttribute('aria-required', 'true');
 *
 * @example
 * // A Field warning: the message describes the control, which is not invalid.
 * renderWithFieldContext(<Checkbox />, {
 *   validationState: 'warning',
 *   validationMessageId: FIELD_TEST_IDS.messageId,
 *   hintId: FIELD_TEST_IDS.hintId,
 * });
 * expect(screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label })).toHaveAccessibleDescription(
 *   `${FIELD_TEST_TEXT.message} ${FIELD_TEST_TEXT.hint}`,
 * );
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { FieldContext } from './hooks/useFieldControl';
import type { FieldContextValue } from './hooks/useFieldControl';

/** Default ids of the rendered label/hint/error/message elements. */
export const FIELD_TEST_IDS = {
  controlId: 'wave-test-field-control',
  labelId: 'wave-test-field-label',
  hintId: 'wave-test-field-hint',
  errorId: 'wave-test-field-error',
  messageId: 'wave-test-field-message',
} as const;

/** Default texts of the rendered label/hint/error/message elements. */
export const FIELD_TEST_TEXT = {
  label: 'Field label',
  hint: 'Field hint',
  error: 'Field error',
  message: 'Field message',
} as const;

/** Render options of {@link renderWithFieldContext}: RTL options plus the element texts. */
export interface RenderWithFieldContextOptions extends Omit<RenderOptions, 'wrapper' | 'queries'> {
  /** Label content. @default FIELD_TEST_TEXT.label */
  label?: React.ReactNode;
  /** Hint content (rendered only when `hintId` is set). @default FIELD_TEST_TEXT.hint */
  hint?: React.ReactNode;
  /** Error content (rendered only when `errorId` is set). @default FIELD_TEST_TEXT.error */
  error?: React.ReactNode;
  /**
   * Validation message content (rendered only when `validationMessageId` is set and differs from
   * `errorId`). @default FIELD_TEST_TEXT.message
   */
  message?: React.ReactNode;
}

/** Result of {@link renderWithFieldContext}. `rerender` keeps the Field around the new ui. */
export interface RenderWithFieldContextResult extends RenderResult {
  /** The context value that was provided. */
  field: FieldContextValue;
}

/**
 * Resolves the provided context from a partial value:
 * - `controlId` defaults to {@link FIELD_TEST_IDS}.controlId.
 * - `labelId` defaults to {@link FIELD_TEST_IDS}.labelId; pass `labelId: undefined` explicitly for
 *   a Field without a label.
 * - `hintId`/`errorId` default to `undefined` (nothing rendered).
 * - `validationState` is passed through when given; otherwise it is `'error'` when an `errorId`
 *   is given (like `Field` with an `error`) and absent without one.
 * - `validationMessageId` is passed through when given (absent otherwise, so a context with only
 *   an `errorId` keeps the shape of a Field before 0.6). `Field` sets it for a message in every
 *   state and sets `errorId` to the same id only in the error state: for an error message pass
 *   both, for a warning, success or neutral message only `validationMessageId`.
 * - `invalid` defaults to "the validation state is `'error'`", so a `'warning'` context is not
 *   invalid; `hasErrorMessage` to "the validation state is `'error'` and a message renders" (an
 *   `errorId` or a `validationMessageId`), like `Field`, whose error state without a message
 *   marks the control invalid but has no message a control would repeat. `required` defaults to
 *   `false`.
 * - `controlIdAssigned` is passed through when given (absent otherwise). With `true`, render the
 *   child that holds the control id yourself (`<Control id={FIELD_TEST_IDS.controlId} />`), the
 *   way `Field` passes it to its first child; controls without an `id` get their own id and are
 *   named through `aria-labelledby`.
 * - `controlIdClaim` is passed through when given (absent otherwise). With a claim
 *   (`createFieldControlIdClaim()`) only the first control without an `id` takes `controlId`, the
 *   way `Field` hands it out when it leaves its first child alone (a plain `<div>`).
 */
export function resolveFieldTestContext(value: Partial<FieldContextValue> = {}): FieldContextValue {
  const { errorId, validationMessageId } = value;
  const validationState = value.validationState ?? (errorId !== undefined ? 'error' : undefined);
  const isError = validationState === 'error';
  const hasMessage = errorId !== undefined || validationMessageId !== undefined;
  const resolved: FieldContextValue = {
    controlId: value.controlId ?? FIELD_TEST_IDS.controlId,
    labelId: 'labelId' in value ? value.labelId : FIELD_TEST_IDS.labelId,
    hintId: value.hintId,
    errorId,
    invalid: value.invalid ?? isError,
    required: value.required ?? false,
    hasErrorMessage: value.hasErrorMessage ?? (isError && hasMessage),
  };
  if (value.controlIdAssigned !== undefined) resolved.controlIdAssigned = value.controlIdAssigned;
  if (value.controlIdClaim !== undefined) resolved.controlIdClaim = value.controlIdClaim;
  if (validationState !== undefined) resolved.validationState = validationState;
  if (validationMessageId !== undefined) resolved.validationMessageId = validationMessageId;
  return resolved;
}

interface FieldHarnessProps {
  field: FieldContextValue;
  label: React.ReactNode;
  hint: React.ReactNode;
  error: React.ReactNode;
  message: React.ReactNode;
  children: React.ReactNode;
}

function FieldHarness({ field, label, hint, error, message, children }: FieldHarnessProps) {
  const { validationState, validationMessageId } = field;
  return (
    <div data-testid="wave-test-field">
      {field.labelId !== undefined && (
        <label id={field.labelId} htmlFor={field.controlId}>
          {label}
          {field.required && <span aria-hidden="true">*</span>}
        </label>
      )}
      <FieldContext.Provider value={field}>{children}</FieldContext.Provider>
      {field.errorId !== undefined && (
        <p id={field.errorId} role="alert">
          {error}
        </p>
      )}
      {validationMessageId !== undefined && validationMessageId !== field.errorId && (
        <p
          id={validationMessageId}
          role={validationState === 'error' || validationState === 'warning' ? 'alert' : undefined}
        >
          {message}
        </p>
      )}
      {field.hintId !== undefined && <p id={field.hintId}>{hint}</p>}
    </div>
  );
}

/**
 * Renders `ui` inside a `FieldContext.Provider` together with what `Field` renders around its
 * control, in Field's order: a real `<label id={labelId} htmlFor={controlId}>` (with an
 * `aria-hidden` asterisk when required) before it; after it an error `<p id={errorId}
 * role="alert">`, a validation message `<p id={validationMessageId}>` (when it differs from
 * `errorId`; `role="alert"` in the `error` and `warning` states) and the hint `<p id={hintId}>`.
 * Query the control by role and name (`getByRole(role, { name: FIELD_TEST_TEXT.label })`) and
 * assert the description with `toHaveAccessibleDescription`.
 *
 * @param ui      The control under test.
 * @param value   Partial context value, resolved by {@link resolveFieldTestContext}.
 * @param options RTL render options plus `label`/`hint`/`error`/`message` contents.
 */
export function renderWithFieldContext(
  ui: React.ReactElement,
  value?: Partial<FieldContextValue>,
  options: RenderWithFieldContextOptions = {},
): RenderWithFieldContextResult {
  const {
    label = FIELD_TEST_TEXT.label,
    hint = FIELD_TEST_TEXT.hint,
    error = FIELD_TEST_TEXT.error,
    message = FIELD_TEST_TEXT.message,
    ...renderOptions
  } = options;
  const field = resolveFieldTestContext(value);
  const wrap = (node: React.ReactNode) => (
    <FieldHarness field={field} label={label} hint={hint} error={error} message={message}>
      {node}
    </FieldHarness>
  );
  const result = render(wrap(ui), renderOptions);
  return {
    ...result,
    rerender: (next: React.ReactNode) => result.rerender(wrap(next)),
    field,
  };
}
