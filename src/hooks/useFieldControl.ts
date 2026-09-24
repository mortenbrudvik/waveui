import * as React from 'react';
import { joinIds } from '../lib/aria';
import { useId } from './useId';

/**
 * What a `Field` tells the control inside it (spec §2.5, §5.1). `Field` (P02) provides it; every
 * library input reads it through {@link useFieldControl}.
 */
export interface FieldContextValue {
  /** The id the Field's `<label htmlFor>` points at. */
  controlId: string;
  /** The id of the Field's `<label>`, used for `aria-labelledby` on non-labelable controls. */
  labelId: string | undefined;
  /** The id of the rendered hint, if any. */
  hintId: string | undefined;
  /** The id of the rendered error message, if any. */
  errorId: string | undefined;
  /** Whether the Field is in an error state. */
  invalid: boolean;
  /** Whether the Field is required. */
  required: boolean;
  /** Field renders the error message itself; controls with their own `error` must not repeat it. */
  hasErrorMessage: boolean;
  /**
   * Field already gave `controlId` to its first child, a label-for merge target (component,
   * labelable element, custom element), whether Field merged it or it was the child's own id; a
   * control that receives no `id` prop is then not that child (it is nested inside it, e.g.
   * `Field > Tooltip > Input`, or a later sibling) and must not reuse `controlId`.
   * {@link useFieldControl} gives such a control its own id and names it through
   * `aria-labelledby`. Absent or `false`: a control without an `id` uses `controlId`.
   */
  controlIdAssigned?: boolean;
}

/**
 * Context provided by `Field`. `null` outside a Field (controls then use only their own props).
 */
export const FieldContext: React.Context<FieldContextValue | null> =
  React.createContext<FieldContextValue | null>(null);
FieldContext.displayName = 'FieldContext';

/** The surrounding Field's context value, or `null` when the control is not inside a Field. */
export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

/** The labelling/validation props a control receives from its consumer and from its Field. */
export interface FieldControlProps {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-required'?: React.AriaAttributes['aria-required'];
  required?: boolean;
}

/** Options of {@link useFieldControl}. */
export interface UseFieldControlOptions {
  /**
   * Whether the focusable element can be the target of `<label htmlFor>` (`<input>`, `<button>`,
   * `<select>`, `<textarea>`). Non-labelable controls (`role="radiogroup"`/`role="group"` divs)
   * are named with `aria-labelledby` instead.
   * @default true
   */
  labelable?: boolean;
  /**
   * Whether the focusable element is a native form control (Input, Select, Textarea, Slider,
   * SpinButton's input), so the Field's `required` becomes the native `required` attribute and
   * constraint validation runs. Controls built on buttons or divs validate through `HiddenInput`.
   * @default false
   */
  nativeRequired?: boolean;
}

/**
 * Merges a control's own labelling props with its surrounding `Field` (spec §2.5). Spread the
 * result onto the **focusable element** (C-ROUTING). Consumer values are merged, never overwritten,
 * and only defined keys are returned, so spreading never clears an attribute.
 *
 * - `id`: the consumer's id; else, when the Field already gave `controlId` to its first child
 *   (`controlIdAssigned`) — so this control is nested inside that child or a later sibling — a
 *   generated id of its own; else the Field's `controlId`. The first child itself receives
 *   `controlId` as its `id` prop from Field, so it keeps it.
 * - `aria-labelledby`: when the consumer set an `aria-label`, only the consumer's
 *   `aria-labelledby`; otherwise, when the control is not labelable **or** its id is not the
 *   Field's `controlId` (it carries its own id, or is not the Field's first child, so
 *   `<label htmlFor>` does not reach it), the consumer's ids plus the Field's `labelId`.
 * - `aria-describedby`: the consumer's ids, then the Field's error and hint ids (deduplicated).
 * - `aria-invalid` / `aria-required`: the consumer's value, else `true` when the Field is
 *   invalid/required.
 * - `required`: only with `nativeRequired` — the consumer's value, else the Field's `required`.
 * - `aria-label`: passed through.
 *
 * @example
 * const fieldProps = useFieldControl({ id, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy,
 *   'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, 'aria-required': ariaRequired });
 * return <button role="switch" {...fieldProps} />;
 */
export function useFieldControl(
  props: FieldControlProps,
  options: UseFieldControlOptions = {},
): FieldControlProps {
  const field = useFieldContext();
  // Always called (stable hook order); used only when the Field's controlId is taken.
  const fallbackId = useId('field-control');
  const { labelable = true, nativeRequired = false } = options;

  const id = props.id ?? (field?.controlIdAssigned ? fallbackId : field?.controlId);

  let labelledBy = props['aria-labelledby'];
  if (field && props['aria-label'] === undefined && (!labelable || id !== field.controlId)) {
    labelledBy = joinIds(labelledBy, field.labelId);
  }

  const describedBy = field
    ? joinIds(props['aria-describedby'], field.errorId, field.hintId)
    : props['aria-describedby'];
  const invalid = props['aria-invalid'] ?? (field?.invalid || undefined);
  const ariaRequired = props['aria-required'] ?? (field?.required || undefined);
  const required = nativeRequired ? (props.required ?? (field?.required || undefined)) : undefined;

  const result: FieldControlProps = {};
  if (id !== undefined) result.id = id;
  if (props['aria-label'] !== undefined) result['aria-label'] = props['aria-label'];
  if (labelledBy !== undefined) result['aria-labelledby'] = labelledBy;
  if (describedBy !== undefined) result['aria-describedby'] = describedBy;
  if (invalid !== undefined) result['aria-invalid'] = invalid;
  if (ariaRequired !== undefined) result['aria-required'] = ariaRequired;
  if (required !== undefined) result.required = required;
  return result;
}
