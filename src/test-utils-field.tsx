/**
 * Test helper for controls that consume `FieldContext` (spec §2.5, §5.9), so P03–P06 test Field
 * integration without depending on P02's in-flight `Field`.
 *
 * Test-only: excluded from the library program like `src/test-utils.ts` (`tsconfig.json` excludes
 * `src/test-utils*`) and from the library build; type-checked by `tsconfig.dev.json`.
 *
 * @example
 * renderWithFieldContext(<Checkbox />, { hintId: FIELD_TEST_IDS.hintId, required: true });
 * const box = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
 * expect(box).toHaveAccessibleDescription(FIELD_TEST_TEXT.hint);
 * expect(box).toHaveAttribute('aria-required', 'true');
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { FieldContext } from './hooks/useFieldControl';
import type { FieldContextValue } from './hooks/useFieldControl';

/** Default ids of the rendered label/hint/error elements. */
export const FIELD_TEST_IDS = {
  controlId: 'wave-test-field-control',
  labelId: 'wave-test-field-label',
  hintId: 'wave-test-field-hint',
  errorId: 'wave-test-field-error',
} as const;

/** Default texts of the rendered label/hint/error elements. */
export const FIELD_TEST_TEXT = {
  label: 'Field label',
  hint: 'Field hint',
  error: 'Field error',
} as const;

/** Render options of {@link renderWithFieldContext}: RTL options plus the element texts. */
export interface RenderWithFieldContextOptions extends Omit<RenderOptions, 'wrapper' | 'queries'> {
  /** Label content. @default FIELD_TEST_TEXT.label */
  label?: React.ReactNode;
  /** Hint content (rendered only when `hintId` is set). @default FIELD_TEST_TEXT.hint */
  hint?: React.ReactNode;
  /** Error content (rendered only when `errorId` is set). @default FIELD_TEST_TEXT.error */
  error?: React.ReactNode;
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
 * - `invalid` and `hasErrorMessage` default to "an `errorId` is given" (like `Field` with an
 *   `error`); `required` defaults to `false`.
 */
export function resolveFieldTestContext(value: Partial<FieldContextValue> = {}): FieldContextValue {
  const errorId = value.errorId;
  return {
    controlId: value.controlId ?? FIELD_TEST_IDS.controlId,
    labelId: 'labelId' in value ? value.labelId : FIELD_TEST_IDS.labelId,
    hintId: value.hintId,
    errorId,
    invalid: value.invalid ?? errorId !== undefined,
    required: value.required ?? false,
    hasErrorMessage: value.hasErrorMessage ?? errorId !== undefined,
  };
}

interface FieldHarnessProps {
  field: FieldContextValue;
  label: React.ReactNode;
  hint: React.ReactNode;
  error: React.ReactNode;
  children: React.ReactNode;
}

function FieldHarness({ field, label, hint, error, children }: FieldHarnessProps) {
  return (
    <div data-testid="wave-test-field">
      {field.labelId !== undefined && (
        <label id={field.labelId} htmlFor={field.controlId}>
          {label}
          {field.required && <span aria-hidden="true">*</span>}
        </label>
      )}
      <FieldContext.Provider value={field}>{children}</FieldContext.Provider>
      {field.hintId !== undefined && <p id={field.hintId}>{hint}</p>}
      {field.errorId !== undefined && (
        <p id={field.errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Renders `ui` inside a `FieldContext.Provider` together with a real `<label id={labelId}
 * htmlFor={controlId}>` (with an `aria-hidden` asterisk when required), a hint `<p id={hintId}>`
 * and an error `<p id={errorId} role="alert">`, the way `Field` renders them (§5.1). Query the
 * control by role and name (`getByRole(role, { name: FIELD_TEST_TEXT.label })`) and assert the
 * description with `toHaveAccessibleDescription`.
 *
 * @param ui      The control under test.
 * @param value   Partial context value, resolved by {@link resolveFieldTestContext}.
 * @param options RTL render options plus `label`/`hint`/`error` contents.
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
    ...renderOptions
  } = options;
  const field = resolveFieldTestContext(value);
  const wrap = (node: React.ReactNode) => (
    <FieldHarness field={field} label={label} hint={hint} error={error}>
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
