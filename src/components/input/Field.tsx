import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { warnOnce } from '../../lib/dev';
import { ErrorIcon, SuccessIcon, WarningIcon, type IconComponent } from '../../lib/icons';
import { materialiseSlotContent, renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import type { Orientation, ValidationState } from '../../lib/types';
import { useId } from '../../hooks/useId';
import {
  FieldContext,
  createFieldControlIdClaim,
  type FieldContextValue,
} from '../../hooks/useFieldControl';

/** Props Field reads from and merges into its first element child. */
interface InjectedFieldProps {
  id?: string;
  role?: string;
  type?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-required'?: React.AriaAttributes['aria-required'];
  required?: boolean;
}

/** Properties for the Field component. */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Label displayed above the control (beside it with `orientation="horizontal"`); names the
   * control.
   */
  label?: React.ReactNode;
  /** Hint shown below the control, after any validation message; describes the control. */
  hint?: React.ReactNode;
  /**
   * Validation error. Content is rendered below the control in a `role="alert"` element that
   * describes the control, and the control is marked `aria-invalid`. `true` marks the control
   * invalid without a message. A value that renders nothing (`null`, `false`, `''`, or an array of
   * only those, such as an empty `errors.map(…)`) is no error; `0` is content.
   *
   * Shorthand for `validationState="error"` with this message; wins over `validationMessage` and
   * `validationState` (development warning when both are set).
   */
  error?: React.ReactNode;
  /**
   * Validation state of `validationMessage`: `error` marks the control invalid (`aria-invalid`) and
   * announces the message (`role="alert"`); `warning` announces it without marking the control
   * invalid; `success` and `none` show it without announcing. Default: `'error'` when
   * `validationMessage` renders content, else `'none'`. Ignored while `error` is set.
   */
  validationState?: ValidationState;
  /**
   * Message below the control, styled and announced by `validationState`; it describes the control
   * (`aria-describedby`). `error` is the shorthand for an error message and wins over this prop.
   */
  validationMessage?: React.ReactNode;
  /**
   * Icon before the message. Default: an error, warning or success glyph per state; none for
   * `'none'`. `null` (or content that renders nothing) shows no icon. Decorative (`aria-hidden`).
   */
  validationMessageIcon?: Slot<'span'>;
  /**
   * `vertical`: the label above the control. `horizontal`: the label in a start column (a third
   * of the width) beside the control; the message and the hint stay below the control. The
   * label's first line lines up with a 32px control (Input, Select, …) and with the first line of
   * a Checkbox, Switch or RadioGroup, which gets 6px of padding above and below for it. The
   * horizontal layout wraps the control in a column, so changing `orientation` on a mounted Field
   * remounts the control: an uncontrolled control loses its state and focus (control it, or keep
   * one orientation while the Field is mounted).
   * @default 'vertical'
   */
  orientation?: Orientation;
  /**
   * Whether the field is required: shows a decorative asterisk next to the label, sets
   * `aria-required`, and turns on native constraint validation. `<input>`, `<select>`,
   * `<textarea>` and Input, Select, Textarea, Slider, SearchBox and SpinButton get the native
   * `required` attribute. Checkbox, Switch, RadioGroup, Rating, ColorPicker, SwatchPicker,
   * Combobox, Dropdown, TagPicker, DatePicker and TimePicker render a hidden required input (with
   * or without `name`), so submit is blocked until they are checked, switched on or have a value.
   * An explicit `required={false}` on the control wins, including for `aria-required`.
   */
  required?: boolean;
  /**
   * The id of the control the label points at, when the control has no `id` of its own
   * (default: a generated id).
   */
  htmlFor?: string;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Intrinsic elements a `<label htmlFor>` can name (HTML "labelable elements"). */
const LABELABLE_ELEMENTS: ReadonlySet<string> = new Set([
  'button',
  'input',
  'meter',
  'output',
  'progress',
  'select',
  'textarea',
]);

/** `<input>` types whose implicit role is `button`: they take neither `aria-required` nor `required`. */
const BUTTON_INPUT_TYPES: ReadonlySet<string> = new Set(['button', 'image', 'reset', 'submit']);

/**
 * Roles that cannot be named (ARIA 1.2 "name prohibited") or that remove semantics: an element
 * with one of them is a layout wrapper, not a widget, and Field leaves it alone.
 */
const UNNAMED_ROLES: ReadonlySet<string> = new Set([
  'caption',
  'code',
  'deletion',
  'emphasis',
  'generic',
  'insertion',
  'none',
  'paragraph',
  'presentation',
  'strong',
  'subscript',
  'superscript',
]);

/** Roles that support `aria-required` (ARIA 1.2, including the roles that inherit it). */
const ARIA_REQUIRED_ROLES: ReadonlySet<string> = new Set([
  'checkbox',
  'columnheader',
  'combobox',
  'gridcell',
  'listbox',
  'radiogroup',
  'rowheader',
  'searchbox',
  'spinbutton',
  'switch',
  'textbox',
  'tree',
  'treegrid',
]);

/**
 * How Field merges into its first element child:
 * - `label-for`: components (library controls, consumer inputs, wrappers such as Tooltip),
 *   labelable intrinsic elements (`<input>`, `<select>`, `<button>`, …) and role-less custom
 *   elements (`<my-text-field>`, possibly form-associated). The child receives the `id` the
 *   `<label htmlFor>` points at (unless it has its own id, which the label then uses).
 * - `labelledby`: an intrinsic element with an explicit widget `role` (a consumer's own
 *   `<div role="radiogroup">`). A `<label htmlFor>` cannot name it, so it is named through
 *   `aria-labelledby` and receives no `id` (a library control inside it keeps the control id).
 */
type MergeMode = 'label-for' | 'labelledby';

/** The first token of an explicit `role` attribute (lower case), or `undefined`. */
function explicitRole(role: unknown): string | undefined {
  if (typeof role !== 'string') return undefined;
  return role.trim().split(/\s+/)[0]?.toLowerCase() || undefined;
}

/** Whether `type` is an autonomous custom element (`<my-text-field>`): its tag name has a hyphen. */
function isCustomElement(type: unknown): type is string {
  return typeof type === 'string' && type.includes('-');
}

/**
 * Whether an intrinsic element is a native form control that takes a value (`<select>`,
 * `<textarea>`, or an `<input>` that is not a button): it takes the native `required` attribute
 * and, without an explicit role, `aria-required`.
 */
function isNativeValueControl(tag: string, inputType: unknown): boolean {
  if (tag === 'select' || tag === 'textarea') return true;
  if (tag !== 'input') return false;
  return typeof inputType !== 'string' || !BUTTON_INPUT_TYPES.has(inputType.trim().toLowerCase());
}

/**
 * Whether Field may add `aria-required` to `child`: a component (it may render any control and
 * decides where the attribute goes), an element whose explicit role supports it, or a native form
 * control that takes a value. Never a `<button>`, `<meter>`, `<output>`, `<progress>`, button-type
 * `<input>` or role-less custom element, where axe reports `aria-allowed-attr`.
 */
function supportsAriaRequired(child: React.ReactElement<InjectedFieldProps>): boolean {
  if (typeof child.type !== 'string') return true;
  const role = explicitRole(child.props.role);
  if (role !== undefined) return ARIA_REQUIRED_ROLES.has(role);
  return isNativeValueControl(child.type, child.props.type);
}

/**
 * Whether and how Field merges its props into `child` (see {@link MergeMode}). A Fragment and a
 * role-less (or presentational) non-labelable intrinsic wrapper (`<div>`, `<span>`) are left
 * alone; the library control inside them reads `FieldContext`. A role-less custom element
 * (`<my-text-field>`) is treated like a component: it may be a form-associated element, which a
 * `<label htmlFor>` names.
 */
function getMergeMode(child: React.ReactElement<InjectedFieldProps>): MergeMode | undefined {
  if (child.type === React.Fragment) return undefined;
  if (typeof child.type !== 'string' || LABELABLE_ELEMENTS.has(child.type)) return 'label-for';
  const role = explicitRole(child.props.role);
  if (role !== undefined) return UNNAMED_ROLES.has(role) ? undefined : 'labelledby';
  return isCustomElement(child.type) ? 'label-for' : undefined;
}

interface FieldChildren {
  /** The element child Field merges into, or `undefined`. */
  target: React.ReactElement<InjectedFieldProps> | undefined;
  /** How Field merges into `target` (`undefined` when there is no target). */
  mode: MergeMode | undefined;
  /** How many element children there are (only the first one is merged). */
  elementCount: number;
}

function inspectChildren(children: React.ReactNode): FieldChildren {
  let first: React.ReactElement<InjectedFieldProps> | undefined;
  let elementCount = 0;
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<InjectedFieldProps>(child)) return;
    elementCount += 1;
    if (first === undefined) first = child;
  });
  const mode = first ? getMergeMode(first) : undefined;
  return { target: mode ? first : undefined, mode, elementCount };
}

/** What Field merges into its first element child. */
interface FieldMergeState {
  controlId: string;
  labelId: string | undefined;
  /** The id of the rendered validation message, in any state. */
  messageId: string | undefined;
  hintId: string | undefined;
  /** Only the `error` validation state is invalid. */
  invalid: boolean;
  required: boolean;
}

/**
 * Returns `children` with Field's props merged into the merge target (only defined keys; the
 * child's own `id`, `aria-label`, `aria-invalid`, `aria-required` and `required` are kept, its
 * `aria-labelledby` and `aria-describedby` are joined with the message and the hint).
 */
function mergeIntoFirstChild(children: React.ReactNode, state: FieldMergeState): React.ReactNode {
  const { target, mode } = inspectChildren(children);
  // Always map, so the children keep the same keys whether or not one of them is merged.
  if (!target || !mode) return React.Children.map(children, (child) => child);

  const childProps = target.props;
  // React renders a boolean `true` on a custom element as an empty attribute (`aria-invalid=""`).
  const ariaTrue = isCustomElement(target.type) ? 'true' : true;
  const injected: InjectedFieldProps = {};
  if (mode === 'label-for') {
    if (childProps.id === undefined) injected.id = state.controlId;
  } else if (state.labelId !== undefined && childProps['aria-label'] === undefined) {
    injected['aria-labelledby'] = joinIds(childProps['aria-labelledby'], state.labelId);
  }
  if (state.messageId || state.hintId) {
    injected['aria-describedby'] = joinIds(
      childProps['aria-describedby'],
      state.messageId,
      state.hintId,
    );
  }
  // The child's own `aria-invalid` wins, as `useFieldControl` lets it win for a nested control.
  if (state.invalid && childProps['aria-invalid'] === undefined) {
    injected['aria-invalid'] = ariaTrue;
  }
  // A child's own `required={false}` wins: it gets neither `aria-required` nor `required`, so what
  // is announced matches what is validated.
  if (state.required && childProps.required !== false) {
    if (childProps['aria-required'] === undefined && supportsAriaRequired(target)) {
      injected['aria-required'] = ariaTrue;
    }
    if (
      typeof target.type === 'string' &&
      isNativeValueControl(target.type, childProps.type) &&
      childProps.required === undefined
    ) {
      injected.required = true;
    }
  }
  return React.Children.map(children, (child) =>
    child === target ? React.cloneElement(target, injected) : child,
  );
}

/** Primitive facts about the children, read during render (no element objects escape). */
function getChildInfo(children: React.ReactNode): {
  elementCount: number;
  targetId: string | undefined;
  controlIdAssigned: boolean;
} {
  const { target, mode, elementCount } = inspectChildren(children);
  // Only a label-for target holds the control id (Field merges it, or the target's own id becomes
  // the control id). A <label htmlFor> cannot name a role widget, so the library control inside
  // one keeps the control id. With `controlIdAssigned`, a library control that receives no id is
  // nested in the target or is a later sibling: useFieldControl gives it an id of its own and
  // names it through aria-labelledby.
  const assigned = mode === 'label-for';
  return {
    elementCount,
    targetId: assigned ? target?.props.id : undefined,
    controlIdAssigned: assigned,
  };
}

/** The default glyph of each message state (`none` has none). */
const MESSAGE_ICONS: Readonly<Record<ValidationState, IconComponent | null>> = {
  error: ErrorIcon,
  warning: WarningIcon,
  success: SuccessIcon,
  none: null,
};

/** Text color of each message state (the `*-tint-foreground` tokens keep 4.5:1 on page and card). */
const MESSAGE_COLORS: Readonly<Record<ValidationState, string>> = {
  error: 'text-error',
  warning: 'text-warning-tint-foreground',
  success: 'text-success-tint-foreground',
  none: 'text-muted-foreground',
};

/**
 * Horizontal layout: the label's first line is centred on a 32px row, the height of an Input, a
 * Select and the other text controls. Checkbox, Switch and RadioGroup rows are one 20px line, so a
 * first child that holds one (also a wrapper of several) gets 6px above and below: its first line
 * then lines up with the label's, also when its label wraps or a group lists its items one below
 * the other.
 */
const SHORT_ROW_FIRST_CHILD =
  '[&>:first-child:has([role=checkbox],[role=switch],label>[role=radio])]:py-1.5';

/** The icon box before a message: 12px glyphs line up with the first line of caption text. */
const MESSAGE_ICON_CLASSES = 'mt-0.5 inline-flex shrink-0';

/**
 * The icon before a message: the state's glyph while `icon` is `undefined`, else the consumer's
 * slot (`null` or content that renders nothing shows none).
 */
function renderMessageIcon(state: ValidationState, icon: Slot<'span'> | undefined) {
  if (icon !== undefined) {
    return slotRendersContent(icon)
      ? renderSlot(icon, 'span', MESSAGE_ICON_CLASSES, { 'aria-hidden': true })
      : null;
  }
  const Icon = MESSAGE_ICONS[state];
  return Icon ? (
    <span aria-hidden="true" className={MESSAGE_ICON_CLASSES}>
      <Icon size={12} />
    </span>
  ) : null;
}

/**
 * Lays out a form control with a label, a validation message, a hint and a required indicator,
 * and wires them to the control.
 *
 * - Validation: `validationMessage` with a `validationState` (`error`, `warning`, `success`,
 *   `none`), or `error`, the shorthand for an error message. The message renders below the
 *   control with the state's icon and color, followed by the hint (which stays visible); both
 *   describe the control. Only the `error` state marks the control `aria-invalid`; `error` and
 *   `warning` messages are announced (`role="alert"`). The root carries `data-validation-state`
 *   and `data-orientation`.
 * - `orientation="horizontal"` puts the label in a start column beside the control, with the
 *   message and the hint below the control. The label lines up with the first line of the
 *   control (a Checkbox, Switch or RadioGroup gets 6px of padding above and below for it).
 * - Provides `FieldContext`: the library's inputs (Input, Select, Textarea, Slider, SearchBox,
 *   Checkbox, Switch, RadioGroup, Rating, SpinButton, pickers, …) read it wherever they are inside
 *   the Field and are named by the label, described by the message and the hint and marked
 *   invalid/required.
 * - Merges into its **first** element child (a native `<input>`/`<select>`/`<textarea>`, a
 *   library control or your own component): `id` (unless the child has one — the label then
 *   points at the child's id), `aria-describedby` (joined with the child's own ids),
 *   `aria-invalid` (in the error state), `aria-required` and, for native form controls that take a
 *   value, `required`. Only defined values are merged; the child's own values are kept, so a
 *   child's `aria-invalid={false}` stays valid while the Field error still describes it (as for a
 *   library control nested deeper). Further element children are rendered as they are.
 * - `aria-required` is added only where it is allowed: components (Field cannot see what they
 *   render, so they decide where it goes — see the wrapper note below), `<input>` (not
 *   `type="button"`/`"submit"`/`"reset"`/`"image"`), `<select>`, `<textarea>`, and elements
 *   whose explicit `role` supports it (`checkbox`, `combobox`, `switch`, `textbox`, …). A
 *   `<button>`, `<meter>`, `<output>` or `<progress>` is labelled and described but not marked
 *   required.
 * - Your own widget built on an element with an explicit `role` (`<div role="radiogroup">`) is
 *   named through `aria-labelledby` (joined with its own; not added when it has an
 *   `aria-label`), described, marked invalid, and gets `aria-required` when its role supports
 *   it. It receives no `id`, because a `<label htmlFor>` cannot name it. A role-less `<div>` or
 *   `<span>` wrapper (or a `role="presentation"`/`"none"` one) is left alone: the library
 *   control inside it reads `FieldContext`.
 * - A custom element (`<my-text-field>`) without a role is treated like a component: it receives
 *   the `id`, the description and `aria-invalid` (a form-associated custom element is named by
 *   the label). Field does not guess its semantics: pass `required`/`aria-required` or an
 *   explicit `role` yourself.
 * - **One control per Field.** A Field labels and describes a single control; wrap each control
 *   in its own Field (a development warning is logged when a Field has more than one element
 *   child). Further element children are rendered as they are. A library control among them
 *   still reads `FieldContext`, so it shares the Field's name and description (when the first
 *   child holds the control id, it gets an id of its own and is named through
 *   `aria-labelledby`). Several library controls inside one plain wrapper element (`<div>`) are
 *   all named and described too: the first one takes the control id the label points at, the
 *   others get ids of their own and are named through `aria-labelledby` (when the first one is
 *   removed, the next one takes the control id over).
 * - **Wrapper and layout components around a library control** (a `Tooltip`, your own `Row`):
 *   put them inside a plain element (`<div>`, `<div className="flex">`), which Field leaves
 *   alone; the library control inside then holds the control id and is labelled, described and
 *   marked invalid/required through `FieldContext`. Field cannot see inside a component, so a
 *   component **first child** is treated as the control (it may be your own input): it receives
 *   the control `id`, `aria-describedby`, `aria-invalid` and, with `required`, `aria-required`,
 *   and a wrapper puts them on its own element (Tooltip's `<span>`, the layout `<div>`). The
 *   library control inside still gets an id of its own and is named by the label through
 *   `aria-labelledby`, but clicking the label does not focus it, and with `required`,
 *   `aria-required` on the wrapper's non-widget element is an ARIA error (axe
 *   `aria-allowed-attr`), even though the control inside is correctly marked required.
 *
 * @example
 * <Field label="Email" hint="We never share it" error={errors.email} required>
 *   <Input type="email" value={email} onValueChange={setEmail} />
 * </Field>
 *
 * @example
 * <Field label="Password" hint="At least 12 characters" validationState="warning"
 *   validationMessage="This password is common">
 *   <Input type="password" />
 * </Field>
 *
 * @example
 * // A wrapper component goes inside a plain element.
 * <Field label="Name" required>
 *   <div>
 *     <Tooltip content="As on your passport">
 *       <Input />
 *     </Tooltip>
 *   </div>
 * </Field>
 */
export const Field = ({
  label,
  hint,
  error,
  validationState,
  validationMessage,
  validationMessageIcon,
  orientation = 'vertical',
  required = false,
  htmlFor,
  className,
  children,
  ref,
  ...rest
}: FieldProps) => {
  const fieldId = useId('field');
  // Hands the control id to one library control when Field leaves its first child alone.
  const [controlIdClaim] = React.useState(createFieldControlIdClaim);
  const { elementCount, targetId, controlIdAssigned } = getChildInfo(children);

  // The library's "renders nothing" rule: nullish, booleans, '' and collections of only those (an
  // empty `errors.map(…)`) are no label, hint or message; `0` is content.
  const errorRendersContent = slotRendersContent(error);
  const usesError = error === true || errorRendersContent;
  const validationMessageRendersContent = slotRendersContent(validationMessage);
  // `error` is the shorthand for an error message and wins over the validation props.
  const state: ValidationState = usesError
    ? 'error'
    : (validationState ?? (validationMessageRendersContent ? 'error' : 'none'));
  const message = usesError ? (errorRendersContent ? error : undefined) : validationMessage;
  const hasMessage = usesError ? errorRendersContent : validationMessageRendersContent;
  const invalid = state === 'error';
  const hasHint = slotRendersContent(hint);
  const errorAndValidation =
    usesError &&
    (validationMessageRendersContent ||
      (validationState !== undefined && validationState !== 'error'));

  const controlId = targetId ?? htmlFor ?? fieldId;
  const hasLabel = slotRendersContent(label);
  const labelId = hasLabel ? `${fieldId}-label` : undefined;
  // The error message keeps its 0.5 id; the other states get their own.
  const messageId = hasMessage ? `${fieldId}-${invalid ? 'error' : 'message'}` : undefined;
  const errorId = invalid ? messageId : undefined;
  const hasErrorMessage = invalid && hasMessage;
  const hintId = hasHint ? `${fieldId}-hint` : undefined;

  React.useEffect(() => {
    if (elementCount > 1) {
      warnOnce(
        'Field:multiple-children',
        "Field: only the first element child receives the Field's id and ARIA attributes; the other " +
          `${elementCount - 1} element child(ren) are rendered unchanged. Wrap each control in its own Field.`,
      );
    }
  }, [elementCount]);

  React.useEffect(() => {
    if (errorAndValidation) {
      warnOnce(
        'Field:error-and-validation',
        'Field: `error` and `validationMessage`/`validationState` are both set; `error` wins. Use one of them.',
      );
    }
  }, [errorAndValidation]);

  const context = React.useMemo<FieldContextValue>(
    () => ({
      controlId,
      labelId,
      hintId,
      errorId,
      invalid,
      required,
      hasErrorMessage,
      controlIdAssigned,
      controlIdClaim,
      validationState: state,
      validationMessageId: messageId,
    }),
    [
      controlId,
      labelId,
      hintId,
      errorId,
      invalid,
      required,
      hasErrorMessage,
      controlIdAssigned,
      controlIdClaim,
      state,
      messageId,
    ],
  );

  const content = mergeIntoFirstChild(children, {
    controlId,
    labelId,
    messageId,
    hintId,
    invalid,
    required,
  });

  const horizontal = orientation === 'horizontal';
  const control = (
    <>
      <FieldContext.Provider value={context}>{content}</FieldContext.Provider>
      {/* Keyed by state: a message whose state changes (a hint-only Field that gets an error, a
          warning that becomes an error) is a newly inserted element, which screen readers
          announce reliably as an alert, not an existing node with a new role. */}
      {hasMessage ? (
        <p
          key={`message-${state}`}
          id={messageId}
          role={state === 'error' || state === 'warning' ? 'alert' : undefined}
          data-validation-state={state}
          className={cn('mt-1 flex items-start gap-1 text-caption-1', MESSAGE_COLORS[state])}
        >
          {renderMessageIcon(state, validationMessageIcon)}
          <span>{materialiseSlotContent(message)}</span>
        </p>
      ) : null}
      {hasHint ? (
        <p key="hint" id={hintId} className="mt-1 text-caption-1 text-muted-foreground">
          {materialiseSlotContent(hint)}
        </p>
      ) : null}
    </>
  );

  return (
    <div
      ref={ref}
      data-orientation={orientation}
      data-validation-state={state}
      className={cn('flex', horizontal ? 'flex-row items-start gap-x-3' : 'flex-col', className)}
      {...rest}
    >
      {hasLabel ? (
        <label
          id={labelId}
          htmlFor={controlId}
          className={cn(
            'mb-1 text-body-1 font-semibold text-foreground',
            // Beside the control: a third of the width, its first line centred on a 32px row.
            horizontal && 'mb-0 shrink-0 basis-1/3 pt-1.5',
          )}
        >
          {materialiseSlotContent(label)}
          {required && (
            <span aria-hidden="true" className="ms-0.5 text-error">
              *
            </span>
          )}
        </label>
      ) : null}
      {horizontal ? (
        <div className={cn('flex min-w-0 flex-1 flex-col', SHORT_ROW_FIRST_CHILD)}>{control}</div>
      ) : (
        control
      )}
    </div>
  );
};

Field.displayName = 'Field';
