import * as React from 'react';
import { focusableDisabledProps, joinIds } from '../../lib/aria';
import { switchClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { focusRing, forcedColors } from '../../lib/styles';
import type { LabelPosition, Size } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { fieldLocks, useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';

/*
 * Forced colors: the focusable track keeps system-color utilities, so the browser still forces its
 * focus outline; only the thumb (the leaf indicator) opts out of forced colors. A disabled switch
 * draws a GrayText thumb and border on Canvas, without the Highlight fill.
 */
const onTrack = 'forced-colors:border-[Highlight] forced-colors:bg-[Highlight]';
const disabledOnTrack = 'forced-colors:border-[GrayText] forced-colors:bg-[Canvas]';

/** The handlers a part drops while the switch is unavailable: it does not activate then. */
const BLOCK_CLICK = ['onClick'] as const;

/** Handlers that run on the `role="switch"` button instead of the root label (C-ROUTING). */
type SwitchControlHandlers = 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';

/** Where a Switch renders its label: after the track (default), before it or above it. */
export type SwitchLabelPosition = Extract<LabelPosition, 'before' | 'after' | 'above'>;

/** Size of the track: a 32x16 track with a 10px thumb, or the 0.7 40x20 track with a 14px thumb. */
export type SwitchSize = Extract<Size, 'small' | 'medium'>;

/** Per-size track, thumb and label-offset classes. */
const SWITCH_SIZE: Readonly<
  Record<SwitchSize, { track: string; thumb: string; on: string; off: string; offset: string }>
> = {
  small: {
    // The target layer is placed against the padding box inside the 1px border: 14 + 2 × 5 = 24px.
    track: 'h-[16px] w-[32px] before:absolute before:inset-x-0 before:-inset-y-[5px]',
    thumb: 'h-[10px] w-[10px]',
    on: 'translate-x-[18px] wave-rtl:-translate-x-[18px]',
    off: 'translate-x-[2px] wave-rtl:-translate-x-[2px]',
    offset: 'mt-0.5',
  },
  medium: {
    track: 'h-[20px] w-[40px]',
    thumb: 'h-[14px] w-[14px]',
    on: 'translate-x-[22px] wave-rtl:-translate-x-[22px]',
    off: 'translate-x-[2px] wave-rtl:-translate-x-[2px]',
    offset: '',
  },
};

/** Properties for the Switch component. */
export interface SwitchProps extends Omit<
  React.HTMLAttributes<HTMLLabelElement>,
  'onChange' | 'defaultChecked' | SwitchControlHandlers
> {
  /** Controlled checked (on/off) state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled usage (also the value a form reset restores).
   * @default false
   */
  defaultChecked?: boolean;
  /** Called with the new checked state when the switch is toggled (not for no-op updates). */
  onCheckedChange?: (checked: boolean) => void;
  /** Whether the switch is disabled and non-interactive. */
  disabled?: boolean;
  /**
   * Marks the switch unavailable but keeps it focusable and in the tab order: for a disabled
   * switch that needs a Tooltip, or one in a toolbar. Renders `aria-disabled="true"`,
   * `data-disabled` and `data-disabled-focusable` on the switch instead of the native `disabled`
   * attribute. The switch cannot be toggled and is not submitted with its form; your `onClick` is
   * not called, and a click on the switch (or Space and Enter) does not reach ancestor click
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
   * Where the label renders: after the control (default), before it, or above it. The DOM order
   * follows the visual order.
   * @default 'after'
   */
  labelPosition?: SwitchLabelPosition;
  /**
   * Size of the track: the 0.7 40x20 track with a 14px thumb, or a small 32x16 track with a 10px
   * thumb and a 24px-tall pointer target. Unlike the text controls and pickers, Switch does not
   * read a surrounding Field's size or a WaveProvider's input defaults: this prop is the only
   * source of its size.
   * @default 'medium'
   */
  size?: SwitchSize;
  /**
   * Form field name. With a name, the switch takes part in native form submission: it submits
   * `name=value` while on.
   */
  name?: string;
  /** Value submitted while on.
   * @default 'on'
   */
  value?: string;
  /** The form must not be submitted while the switch is off (native validation). */
  required?: boolean;
  /** Id of the form the switch belongs to, when it is rendered outside that form. */
  form?: string;
  /** Click handler of the switch control (the `role="switch"` button). */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Focus handler of the switch control. */
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  /** Blur handler of the switch control. */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  /** Keydown handler of the switch control. */
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Keyup handler of the switch control. */
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>;
  /**
   * Ref to the focusable `role="switch"` button (Fluent UI's `ref`, on its primary element). The
   * root `<label>` is `slotProps.root.ref`.
   */
  ref?: React.Ref<HTMLButtonElement>;
  /**
   * Props for the elements the Switch draws, by part, merged into each part's own (Fluent UI's
   * `root`, `indicator` and `label` slot props): your classes after the part's (yours win a
   * conflict), your styles over its styles, your handlers before its handlers (`preventDefault()`
   * in yours skips the Switch's handling of the event, its own `on…` prop included), your ref
   * beside its ref, and your ids added to its `aria-labelledby` and `aria-describedby`. Every
   * attribute the Switch sets on a part is locked and keeps the Switch's value (set it through
   * the Switch's own props); you add the attributes it does not set. A part takes no `children`.
   */
  slotProps?: {
    /**
     * The root `<label>` around the switch and the label text (stable class `wave-switch`), which
     * the Switch's `className`, `style`, `data-*` and other root props reach as well; its `ref`
     * is the way to the label, since the Switch's `ref` reaches the switch. Your classes come
     * after the Switch's `className`, your style over its `style`. Locked: every prop you give
     * the Switch itself that reaches the root, `data-label-position`, `data-size`, `htmlFor`
     * (unset: the label labels the switch it holds, and a `for` would send its clicks to another
     * element), and `hidden`, `inert` and `aria-hidden` (the Switch's own: the root holds the
     * switch). Your handlers run before the Switch's own root handlers (`preventDefault()` in
     * yours skips them). Your `onClick` sees every click inside the root as it bubbles: a click
     * on the switch after the switch has toggled, and a click on the label text first, before
     * the `<label>` passes it on to the switch, so the text's click reaches your `onClick` twice
     * (the text's own, then the switch's), as on any `<label>`; `preventDefault()` on the text's
     * click keeps the label from passing it on (no toggle). It is not called while the switch
     * is `disabled` or `disabledFocusable`, as the switch does not toggle then.
     */
    root?: SlotPart<'label'>;
    /**
     * The `role="switch"` `<button>`, the focusable control (stable class `wave-switch__track`;
     * the Switch's `ref` reaches it as well). Locked: `id`, `type`, `role`, `aria-checked`,
     * `disabled`, `tabIndex`, `autoFocus`, the attributes of `disabledFocusable`, the naming and
     * Field attributes routed to it (`aria-label`, `aria-invalid`, `aria-required`,
     * `aria-errormessage`, `aria-details`, `aria-disabled`), `required` (unset: the hidden input
     * carries it), `form` (the switch belongs to the form of its own `form` prop, as its hidden
     * input does), `hidden`, `inert` and `aria-hidden` (a focusable control is never hidden).
     * Your `onClick` runs before the Switch's `onClick` and its toggle (`preventDefault()` skips
     * both) and is not called under `disabledFocusable`; your focus and key handlers run before
     * the Switch's.
     */
    track?: SlotPart<'button'>;
    /**
     * The decorative thumb `<span>` inside the track (stable class `wave-switch__thumb`).
     * Locked: `aria-hidden`, and `tabIndex` (unset: the thumb is never a tab stop). Your
     * `onClick` is not called while the switch is `disabled` or `disabledFocusable`, as the
     * switch does not toggle then.
     */
    thumb?: SlotPart<'span'>;
    /**
     * The `<span>` around the `label` text, rendered only with a `label` (stable class
     * `wave-switch__label`). Locked: `id`, which names the control, and `aria-label` unset (it
     * would replace the text in the name). `hidden`, `inert` and `aria-hidden` stay yours: the
     * control's `aria-labelledby` still reads hidden text. Your `onClick` is not called while the
     * switch is `disabled` or `disabledFocusable`, as the switch does not toggle then.
     */
    label?: SlotPart<'span'>;
  };
}

/**
 * An on/off toggle drawn as a `role="switch"` button inside a `<label>`.
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
 * - The thumb position mirrors when the switch itself is right-to-left (its nearest `dir`), so a
 *   switch in an LTR subtree of an RTL page keeps the LTR layout.
 * - `label` takes rich content (a link) and renders after the switch, or before or above it with
 *   `labelPosition` (the root carries `data-label-position`). Beside the label, the switch lines
 *   up with the first line of a label that wraps or has a second line. `children` are not
 *   rendered (a development warning says so).
 * - `size` (`small`, `medium`) sets the track and thumb dimensions; the root carries `data-size`.
 *   Switch does not read a surrounding `Field`'s size or a `WaveProvider`'s input defaults.
 */
export const Switch = ({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  disabledFocusable = false,
  label,
  labelPosition = 'after',
  size = 'medium',
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
}: SwitchProps) => {
  const hasChildren = slotRendersContent(children);
  React.useEffect(() => {
    if (hasChildren) {
      warnOnce('Switch:children', 'Switch: children are not rendered. Pass the label in `label`.');
    }
  }, [hasChildren]);
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, onCheckedChange);

  const generatedId = useId('switch');
  const labelTextId = useId('switch-label');
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
  const mergedControlRef = useMergedRefs(buttonRef, ref, slotProps?.track?.ref);
  useFormReset(buttonRef, () => setChecked(defaultChecked), form);

  // A size outside the union (from untyped code) renders, and is reported in the data attribute,
  // as the default: TypeScript rejects one, but the value still reaches this render.
  const resolvedSize: SwitchSize = Object.hasOwn(SWITCH_SIZE, size) ? size : 'medium';
  const sizeMetrics = SWITCH_SIZE[resolvedSize];
  // Focusable-disabled wins over `disabled`: the switch stays focusable but looks and acts disabled.
  const unavailable = disabled || disabledFocusable;
  // The parts inside the switch do not activate while it is unavailable, as the switch does not.
  const partBlock = unavailable ? BLOCK_CLICK : undefined;
  const labelProps = mergeSlotProps(slotProps?.label, {
    className: cn(switchClassNames.label, 'text-body-1 text-foreground'),
    // The text names the control through aria-labelledby: an aria-label would replace it.
    locked: { id: labelTextId, 'aria-label': undefined },
    blockHandlers: partBlock,
  });
  const labelText = hasLabel ? <span {...labelProps}>{materialiseSlotContent(label)}</span> : null;
  const labelFirst = labelPosition === 'before' || labelPosition === 'above';
  const trackProps = mergeSlotProps(slotProps?.track, {
    className: cn(
      switchClassNames.track,
      // The whole control is sized in px, like the Checkbox box and the radio circle: the
      // thumb and its offsets are px, so a track in rem would stop fitting them at any root
      // font size other than 16px. Medium keeps the 0.7 look, a 40x20 track around a 14px
      // thumb, a 2px gap on every side. Small is a 32x16 track around a 10px thumb, the same
      // 2px gap, and a transparent strip behind the track that grows the pointer target to
      // 24px tall. No padding is assumed here, unlike the native reset that any app button
      // style overrides (C-NATIVE): the thumb offsets rely on it staying at zero.
      'relative inline-flex shrink-0 items-center rounded-full border p-0 transition-colors duration-200 motion-reduce:transition-none',
      sizeMetrics.track,
      // The offset centres the track on the label line beside it; above the label, the
      // column gap alone separates them.
      hasLabel && labelPosition !== 'above' && sizeMetrics.offset,
      focusRing,
      checked
        ? cn('border-primary bg-primary', unavailable ? disabledOnTrack : onTrack)
        : cn(
            'border-stroke-accessible bg-transparent',
            unavailable ? forcedColors.disabled : forcedColors.control,
          ),
    ),
    locked: {
      // The routed naming and Field attributes, set only through the Switch's own props.
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
      role: 'switch',
      'aria-checked': checked,
      // The control's own: a part's `form` would reset it with another form than its hidden input
      // submits with, and a focusable control is never hidden.
      form: undefined,
      hidden: undefined,
      inert: undefined,
      'aria-hidden': undefined,
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
    // Under disabledFocusable your click handler is not called, as the Switch's `onClick` is not.
    blockHandlers: disabledFocusable ? BLOCK_CLICK : undefined,
  });
  const thumbProps = mergeSlotProps(slotProps?.thumb, {
    className: cn(
      switchClassNames.thumb,
      'block rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
      sizeMetrics.thumb,
      checked
        ? cn(sizeMetrics.on, 'bg-primary-foreground')
        : cn(sizeMetrics.off, 'bg-stroke-accessible'),
      unavailable
        ? 'forced-colors:bg-[GrayText]'
        : checked
          ? 'forced-colors:bg-[HighlightText]'
          : 'forced-colors:bg-[ButtonText]',
    ),
    locked: { 'aria-hidden': 'true', tabIndex: undefined },
    // The thumb sits in the track, which `disabledFocusable` leaves natively enabled.
    blockHandlers: partBlock,
  });
  const rootProps = mergeSlotProps(slotProps?.root, {
    className: cn(
      switchClassNames.root,
      // items-start: the track lines up with the top of the label's first line, not its
      // middle, when the label wraps or has a second line; medium's 20px track matches that
      // 20px line exactly, small's 16px track gets an offset below to stay centred on it.
      'relative inline-flex items-start gap-2 select-none',
      labelPosition === 'above' && 'flex-col gap-1',
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
      // The label labels the switch it holds: a part's `for` would send the text's clicks to
      // another element (the Switch's own, from untyped code, still wins below).
      htmlFor: undefined,
      // The Switch's own root props, after the data attributes as in 0.18, and over the part's;
      // the root holds the switch, so only they hide it or take it out of reach.
      ...rest,
      hidden: rest.hidden,
      inert: rest.inert,
      'aria-hidden': rest['aria-hidden'],
    },
    // The label passes a click to the switch, which does not toggle while unavailable.
    blockHandlers: partBlock,
  });

  return (
    <label {...rootProps}>
      {labelFirst && labelText}
      <button
        // The literal marks C-BUTTON-TYPE; the merged props lock the type (a part cannot change it).
        type="button"
        {...trackProps}
        ref={mergedControlRef}
      >
        <span {...thumbProps} />
      </button>
      {!labelFirst && labelText}
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

Switch.displayName = 'Switch';
