import * as React from 'react';
import { focusableDisabledProps, joinIds } from '../../lib/aria';
import { checkboxClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { CheckIcon, SubtractIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { focusRing, forcedColors } from '../../lib/styles';
import type { LabelPosition, Shape, Size } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { fieldLocks, useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';

/*
 * Forced colors: the focusable box keeps system-color utilities, so the browser still forces its
 * focus outline and border; only the glyph (the leaf indicator) opts out of forced colors. A
 * disabled box draws a GrayText glyph and border on Canvas, without the Highlight fill.
 */
const checkedBox = 'forced-colors:border-[Highlight] forced-colors:bg-[Highlight]';
const disabledCheckedBox = 'forced-colors:border-[GrayText] forced-colors:bg-[Canvas]';
const disabledGlyph = 'forced-colors:text-[GrayText] forced-colors:forced-color-adjust-none';

/** The handlers a part drops while the checkbox is unavailable: it does not activate then. */
const BLOCK_CLICK = ['onClick'] as const;

/** Handlers that run on the `role="checkbox"` button instead of the root label (C-ROUTING). */
type CheckboxControlHandlers = 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';

/** Where a Checkbox renders its label: after the box (default) or before it. */
export type CheckboxLabelPosition = Extract<LabelPosition, 'before' | 'after'>;

/** Size of the box: an 18px box (the 0.7 look) or a 22px box with a bigger glyph. */
export type CheckboxSize = Extract<Size, 'medium' | 'large'>;

/** Shape of the box: square corners (the 0.7 look) or a circular, round box. */
export type CheckboxShape = Extract<Shape, 'square' | 'circular'>;

/** Per-size box, glyph and label-offset classes. */
const CHECKBOX_SIZE: Readonly<
  Record<CheckboxSize, { box: string; glyph: number; offset: string }>
> = {
  medium: { box: 'h-[18px] w-[18px]', glyph: 12, offset: 'mt-px' },
  large: { box: 'h-[22px] w-[22px]', glyph: 16, offset: '-mt-px' },
};

/** Per-shape corner classes. */
const CHECKBOX_SHAPE: Readonly<Record<CheckboxShape, string>> = {
  square: 'rounded-xs',
  circular: 'rounded-full',
};

/** Properties for the Checkbox component. */
export interface CheckboxProps extends Omit<
  React.HTMLAttributes<HTMLLabelElement>,
  'onChange' | 'defaultChecked' | CheckboxControlHandlers
> {
  /** Controlled checked state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled usage (also the value a form reset restores).
   * @default false
   */
  defaultChecked?: boolean;
  /**
   * Shows the mixed state: the dash glyph and `aria-checked="mixed"`, whatever `checked` is. A
   * click still toggles `checked` and calls `onCheckedChange`, but the checkbox keeps showing and
   * announcing "mixed" until you clear `indeterminate`. For a tri-state "select all", derive
   * `checked` and `indeterminate` from the items and set every item in `onCheckedChange`.
   * @default false
   */
  indeterminate?: boolean;
  /** Called with the new checked state when it changes (not for no-op updates). */
  onCheckedChange?: (checked: boolean) => void;
  /** Whether the checkbox is disabled and non-interactive. */
  disabled?: boolean;
  /**
   * Marks the checkbox unavailable but keeps it focusable and in the tab order: for a disabled
   * checkbox that needs a Tooltip, or one in a toolbar. Renders `aria-disabled="true"`,
   * `data-disabled` and `data-disabled-focusable` on the checkbox instead of the native `disabled`
   * attribute. The checkbox cannot be toggled and is not submitted with its form; your `onClick`
   * is not called, and a click on the checkbox (or Space and Enter) does not reach ancestor click
   * handlers, as for a natively disabled control. Wins over `disabled` when both are set. In a
   * roving container (a `Toolbar`) it stays in the arrow-key order.
   * @default false
   */
  disabledFocusable?: boolean;
  /**
   * Label next to the control (any phrasing content, links included, but no other form
   * controls). It names the control through `aria-labelledby`, after a consumer or Field
   * `aria-labelledby`; a consumer `aria-label` names it instead. Clicking its text toggles the
   * control; clicking a link inside it follows the link. `children` are not rendered: pass the
   * label here.
   */
  label?: React.ReactNode;
  /**
   * Where the label renders: after the control (default) or before it. The DOM order follows the
   * visual order.
   * @default 'after'
   */
  labelPosition?: CheckboxLabelPosition;
  /**
   * Size of the box: an 18px box (the 0.7 look) or a 22px box with a bigger glyph. Unlike the
   * text controls and pickers, Checkbox does not read a surrounding Field's size or a
   * WaveProvider's input defaults: this prop is the only source of its size.
   * @default 'medium'
   */
  size?: CheckboxSize;
  /**
   * Shape of the box: square corners (the 0.7 look) or a circular, round box.
   * @default 'square'
   */
  shape?: CheckboxShape;
  /**
   * Form field name. With a name, the checkbox takes part in native form submission: it submits
   * `name=value` while checked.
   */
  name?: string;
  /** Value submitted while checked.
   * @default 'on'
   */
  value?: string;
  /** The form must not be submitted while the checkbox is unchecked (native validation). */
  required?: boolean;
  /** Id of the form the checkbox belongs to, when it is rendered outside that form. */
  form?: string;
  /** Click handler of the checkbox control (the `role="checkbox"` button). */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Focus handler of the checkbox control. */
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  /** Blur handler of the checkbox control. */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  /** Keydown handler of the checkbox control. */
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Keyup handler of the checkbox control. */
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>;
  /**
   * Ref to the focusable `role="checkbox"` button (Fluent UI's `ref`, on its primary element).
   * The root `<label>` is `slotProps.root.ref`.
   */
  ref?: React.Ref<HTMLButtonElement>;
  /**
   * Props for the elements the Checkbox draws, by part, merged into each part's own (Fluent UI's
   * `root`, `indicator` and `label` slot props): your classes after the part's (yours win a
   * conflict), your styles over its styles, your handlers before its handlers (`preventDefault()`
   * in yours skips the Checkbox's handling of the event, its own `on…` prop included), your ref
   * beside its ref, and your ids added to its `aria-labelledby` and `aria-describedby`. Every
   * attribute the Checkbox sets on a part is locked and keeps the Checkbox's value (set it
   * through the Checkbox's own props); you add the attributes it does not set. A part takes no
   * `children`.
   */
  slotProps?: {
    /**
     * The root `<label>` around the box and the label text (stable class `wave-checkbox`), which
     * the Checkbox's `className`, `style`, `data-*` and other root props reach as well; its
     * `ref` is the way to the label, since the Checkbox's `ref` reaches the box. Your classes
     * come after the Checkbox's `className`, your style over its `style`. Locked: every prop you
     * give the Checkbox itself that reaches the root, `data-label-position`, `data-size`,
     * `data-shape`, `htmlFor` (unset: the label labels the box it holds, and a `for` would send
     * its clicks to another element), and `hidden`, `inert` and `aria-hidden` (the Checkbox's
     * own: the root holds the box). Your handlers run before the Checkbox's own root handlers
     * (`preventDefault()` in yours skips them). Your `onClick` sees every click inside the root
     * as it bubbles: a click on the box after the box has toggled, and a click on the label text
     * first, before the `<label>` passes it on to the box, so the text's click reaches your
     * `onClick` twice (the text's own, then the box's), as on any `<label>`; `preventDefault()`
     * on the text's click keeps the label from passing it on (no toggle). It is not called while
     * the checkbox is `disabled` or `disabledFocusable`, as the checkbox does not toggle then.
     */
    root?: SlotPart<'label'>;
    /**
     * The `role="checkbox"` `<button>` that draws the box, the focusable control (stable class
     * `wave-checkbox__indicator`; the Checkbox's `ref` reaches it as well). Locked: `id`, `type`,
     * `role`, `aria-checked`, `disabled`, `tabIndex`, `autoFocus`, the attributes of
     * `disabledFocusable`, the naming and Field attributes routed to it (`aria-label`,
     * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `aria-disabled`),
     * `required` (unset: the hidden input carries it), `form` (the checkbox belongs to the form
     * of its own `form` prop, as its hidden input does), `hidden`, `inert` and `aria-hidden` (a
     * focusable control is never hidden). Your `onClick` runs before the Checkbox's `onClick`
     * and its toggle (`preventDefault()` skips both) and is not called under
     * `disabledFocusable`; your focus and key handlers run before the Checkbox's.
     */
    indicator?: SlotPart<'button'>;
    /**
     * The `<span>` around the `label` text, rendered only with a `label` (stable class
     * `wave-checkbox__label`). Locked: `id`, which names the control, and `aria-label` unset (it
     * would replace the text in the name). `hidden`, `inert` and `aria-hidden` stay yours: the
     * control's `aria-labelledby` still reads hidden text. Your `onClick` is not called while the
     * checkbox is `disabled` or `disabledFocusable`, as the checkbox does not toggle then.
     */
    label?: SlotPart<'span'>;
  };
}

/**
 * A checkbox for a boolean (or mixed) choice, drawn as a `role="checkbox"` button inside a
 * `<label>`.
 *
 * - `ref` reaches the control; the root `<label>` receives `className`, `style` and `data-*`
 *   (`slotProps.root.ref` reaches it); the control receives `id`,
 *   `aria-label`/`-labelledby`/`-describedby`/`-invalid`/`-required`/`-errormessage`/
 *   `-details`/`-disabled`, `tabIndex`, `autoFocus` and the click, focus and key handlers. A
 *   consumer `onClick` runs once per activation, before the toggle; `preventDefault()` in it
 *   cancels the toggle.
 * - Inside a `Field` it is named by the Field label (followed by its own `label` text) and described
 *   by the Field message and hint.
 * - With `name` (or `required`) it takes part in native forms like `<input type="checkbox">`, and
 *   a form reset restores `defaultChecked`.
 * - `label` takes rich content (a link to the terms) and renders after the box, or before it with
 *   `labelPosition="before"` (the root carries `data-label-position`). The box lines up with the
 *   first line of a label that wraps or has a second line. `children` are not rendered (a
 *   development warning says so).
 * - `size` (`medium`, `large`) and `shape` (`square`, `circular`) set the box's dimensions and
 *   corners; the root carries `data-size` and `data-shape`. Checkbox does not read a surrounding
 *   `Field`'s size or a `WaveProvider`'s input defaults.
 */
export const Checkbox = ({
  checked: checkedProp,
  defaultChecked = false,
  indeterminate = false,
  onCheckedChange,
  disabled = false,
  disabledFocusable = false,
  label,
  labelPosition = 'after',
  size = 'medium',
  shape = 'square',
  name,
  value,
  required,
  form,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  'aria-disabled': ariaDisabled,
  autoFocus,
  tabIndex,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  className,
  style,
  children,
  ref,
  slotProps,
  ...rest
}: CheckboxProps) => {
  const hasChildren = slotRendersContent(children);
  React.useEffect(() => {
    if (hasChildren) {
      warnOnce(
        'Checkbox:children',
        'Checkbox: children are not rendered. Pass the label in `label`.',
      );
    }
  }, [hasChildren]);
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, onCheckedChange);

  const generatedId = useId('checkbox');
  const labelTextId = useId('checkbox-label');
  const field = useFieldContext();
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    // An explicit `required={false}` wins over a required Field, so aria-required always matches
    // the native validation below (`isRequired`).
    'aria-required': ariaRequired ?? required,
  });
  const isRequired = required ?? field?.required ?? false;
  // `0` is a label; `null`, `false`, `''` and empty collections are not (C-SLOTS).
  const hasLabel = slotRendersContent(label);
  // The label text names the control through aria-labelledby, disabled or not: axe exempts the
  // dimmed text of a disabled control only when the control references it this way (its <label>
  // exemption covers native inputs only). A consumer aria-label still names the control alone.
  // The ids already there (the consumer's, the Field label from useFieldControl) come first, then
  // the Field label whose <label htmlFor> targets this control (aria-labelledby would hide it), so
  // the name keeps every label.
  const labelledBy =
    hasLabel && fieldProps['aria-label'] === undefined
      ? joinIds(
          fieldProps['aria-labelledby'],
          field && fieldProps.id === field.controlId ? field.labelId : undefined,
          labelTextId,
        )
      : fieldProps['aria-labelledby'];

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const mergedControlRef = useMergedRefs(buttonRef, ref, slotProps?.indicator?.ref);
  useFormReset(buttonRef, () => setChecked(defaultChecked), form);

  const on = checked || indeterminate;
  // A size or shape outside the unions (from untyped code) renders, and is reported in the data
  // attributes, as the default: TypeScript rejects one, but the value still reaches this render.
  const resolvedSize: CheckboxSize = Object.hasOwn(CHECKBOX_SIZE, size) ? size : 'medium';
  const resolvedShape: CheckboxShape = Object.hasOwn(CHECKBOX_SHAPE, shape) ? shape : 'square';
  const sizeMetrics = CHECKBOX_SIZE[resolvedSize];
  const shapeClass = CHECKBOX_SHAPE[resolvedShape];
  // Focusable-disabled wins over `disabled`: the box stays focusable but looks and acts disabled.
  const unavailable = disabled || disabledFocusable;
  // The glyph is the forced-colors leaf; the box stays on system colors (see `checkedBox`).
  const glyphClassName = unavailable ? disabledGlyph : forcedColors.selectedLeaf;
  const labelProps = mergeSlotProps(slotProps?.label, {
    className: cn(checkboxClassNames.label, 'text-body-1 text-foreground'),
    // The text names the control through aria-labelledby: an aria-label would replace it.
    locked: { id: labelTextId, 'aria-label': undefined },
    // The label does not activate while the checkbox is unavailable, as the checkbox does not.
    blockHandlers: unavailable ? BLOCK_CLICK : undefined,
  });
  const labelText = hasLabel ? <span {...labelProps}>{materialiseSlotContent(label)}</span> : null;
  const indicatorProps = mergeSlotProps(slotProps?.indicator, {
    className: cn(
      checkboxClassNames.indicator,
      // p-0 and the unchecked bg-transparent are set here, not left to the native reset, which
      // any app button style overrides (C-NATIVE).
      cn(
        'flex shrink-0 items-center justify-center border p-0 transition-colors motion-reduce:transition-none',
        sizeMetrics.box,
        shapeClass,
      ),
      // Centred on the label's 20px first line: nudged down at medium, up at large.
      hasLabel && sizeMetrics.offset,
      focusRing,
      on
        ? cn(
            'border-primary bg-primary text-primary-foreground',
            unavailable ? disabledCheckedBox : checkedBox,
          )
        : cn(
            'border-stroke-accessible bg-transparent',
            unavailable ? forcedColors.disabled : forcedColors.control,
          ),
    ),
    locked: {
      // The routed naming and Field attributes, set only through the Checkbox's own props.
      ...fieldLocks(fieldProps),
      id: generatedId,
      type: 'button',
      ...fieldProps,
      'aria-labelledby': labelledBy,
      'aria-errormessage': ariaErrorMessage,
      'aria-details': ariaDetails,
      'aria-disabled': ariaDisabled,
      autoFocus,
      tabIndex,
      onFocus,
      onBlur,
      onKeyDown,
      onKeyUp,
      role: 'checkbox',
      // The control's own: a part's `form` would reset it with another form than its hidden input
      // submits with, and a focusable control is never hidden.
      form: undefined,
      hidden: undefined,
      inert: undefined,
      'aria-hidden': undefined,
      'aria-checked': indeterminate ? 'mixed' : checked,
      disabled: disabled && !disabledFocusable,
      ...focusableDisabledProps(disabledFocusable, { reachable: true }),
      onClick: disabledFocusable
        ? // Clicks, Space and Enter (which click a button) neither toggle nor reach `onClick`,
          // and, as a natively disabled control dispatches no click, no ancestor sees them.
          (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
          }
        : composeEventHandlers(onClick, () => setChecked((prev) => !prev)),
    },
    // Under disabledFocusable your click handler is not called, as the Checkbox's `onClick`
    // is not.
    blockHandlers: disabledFocusable ? BLOCK_CLICK : undefined,
  });
  const rootProps = mergeSlotProps(slotProps?.root, {
    className: cn(
      checkboxClassNames.root,
      // items-start: the box lines up with the first line of a label that wraps or has a second
      // line, not with its middle.
      'relative inline-flex items-start gap-2 select-none',
      // The dimmed look lifts while a focus ring shows inside the root (the control's, under
      // disabledFocusable, or a link's in the label): opacity would dim the ring below 3:1.
      unavailable
        ? 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100'
        : 'cursor-pointer',
      className,
    ),
    style,
    locked: {
      'data-label-position': labelPosition,
      'data-size': resolvedSize,
      'data-shape': resolvedShape,
      // The label labels the box it holds: a part's `for` would send the text's clicks to
      // another element (the Checkbox's own, from untyped code, still wins below).
      htmlFor: undefined,
      // The Checkbox's own root props, after the data attributes as in 0.18, and over the
      // part's; the root holds the box, so only they hide it or take it out of reach.
      ...rest,
      hidden: rest.hidden,
      inert: rest.inert,
      'aria-hidden': rest['aria-hidden'],
    },
    // The label passes a click to the box, which does not toggle while unavailable.
    blockHandlers: unavailable ? BLOCK_CLICK : undefined,
  });

  return (
    <label {...rootProps}>
      {labelPosition === 'before' && labelText}
      <button
        // The literal marks C-BUTTON-TYPE; the merged props lock the type (a part cannot change it).
        type="button"
        {...indicatorProps}
        ref={mergedControlRef}
      >
        {indeterminate ? (
          <SubtractIcon size={sizeMetrics.glyph} className={glyphClassName} />
        ) : checked ? (
          <CheckIcon size={sizeMetrics.glyph} className={glyphClassName} />
        ) : null}
      </button>
      {labelPosition !== 'before' && labelText}
      <HiddenInput
        type="checkbox"
        name={name}
        form={form}
        disabled={unavailable}
        value={value}
        checked={checked}
        required={isRequired}
        onInvalid={() => buttonRef.current?.focus()}
      />
    </label>
  );
};

Checkbox.displayName = 'Checkbox';
