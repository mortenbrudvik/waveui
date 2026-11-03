import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { radioGroupClassNames, radioGroupItemClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnOnce } from '../../lib/dev';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import {
  HIDDEN_PART_LOCKS,
  mergeSlotProps,
  ROVING_PART_LOCKS,
  type SlotPart,
} from '../../lib/slotProps';
import { focusRing, forcedColors } from '../../lib/styles';
import type { Orientation } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { HiddenInput } from '../internal/HiddenInput';
import {
  RadioGroupContext,
  useRadioItemState,
  type RadioGroupItemsContextValue,
  type RadioLabelPosition,
} from './RadioGroup.context';

export type { RadioLabelPosition };

function warnDuplicateValue(value: string): void {
  warnOnce(
    `RadioGroup:duplicate:${value}`,
    `RadioGroup: several items share the value "${value}". Item values must be unique within a ` +
      'RadioGroup; items that share a value are checked together.',
  );
}

/* ---- RadioGroup ---- */
/** Properties for the RadioGroup component. */
export interface RadioGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Controlled selected value (`''` for no selection). */
  value?: string;
  /** Initial selected value for uncontrolled usage (also the value a form reset restores).
   * @default ''
   */
  defaultValue?: string;
  /** Called with the newly selected value when the selection changes (not when re-selecting). */
  onValueChange?: (value: string) => void;
  /**
   * Layout of the radio items (also `aria-orientation`). Arrow keys follow the APG radio pattern
   * in both layouts: Down/Right select the next item, Up/Left the previous one (Left/Right
   * mirrored under `dir="rtl"`).
   * @default 'vertical'
   */
  orientation?: Orientation;
  /**
   * Where the items draw their label, unless an item sets its own `labelPosition`: `after` the
   * radio (the default) or `below` it. `orientation="horizontal"` with `labelPosition="below"` is
   * Fluent UI's `layout="horizontal-stacked"`; `orientation` stands for the rest of its `layout`
   * (`vertical`, `horizontal`).
   * @default 'after'
   */
  labelPosition?: RadioLabelPosition;
  /** Disables every item of the group. */
  disabled?: boolean;
  /**
   * Form field name. With a name, the selected value is submitted with the form. No name is
   * generated: without one the group adds nothing to `FormData`.
   */
  name?: string;
  /** A value must be selected before the form can be submitted (native validation). */
  required?: boolean;
  /** Id of the form the group belongs to, when it is rendered outside that form. */
  form?: string;
  /** Ref to the `role="radiogroup"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

// The `role="radiogroup"` root, documented on the exported `RadioGroup` const.
const RadioGroupRoot = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  labelPosition = 'after',
  disabled = false,
  name,
  required,
  form,
  children,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  onKeyDown,
  onFocus,
  ref,
  ...rest
}: RadioGroupProps) => {
  const initialValue = defaultValue ?? '';
  const [value, setValue] = useControllable(valueProp, initialValue, onValueChange);

  const { containerProps, getTabIndex } = useRovingTabIndex({
    activeValue: value,
    orientation: 'both',
    loop: true,
    // APG radio group: moving focus also selects the item.
    onFocusMove: (next) => setValue(next),
  });

  const rootRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, containerProps.ref, rootRef);

  const field = useFieldContext();
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      // An explicit `required={false}` wins over a required Field, so aria-required always
      // matches the native validation below (`isRequired`).
      'aria-required': ariaRequired ?? required,
    },
    { labelable: false },
  );
  const isRequired = required ?? field?.required ?? false;

  useFormReset(rootRef, () => setValue(initialValue), form);

  // Development diagnostic (C-DEV): the items may sit anywhere inside the group (Fragments, wrapper
  // elements), so they are read from the DOM after each commit.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!isDev || !root) return;
    const seen = new Set<string>();
    for (const item of root.querySelectorAll<HTMLElement>('[role="radio"][data-roving-value]')) {
      // Its own items only: the roving marker cannot be overridden by the consumer (`role` can).
      if (item.closest('[data-roving-container]') !== root) continue;
      const itemValue = item.getAttribute('data-roving-value') ?? '';
      if (seen.has(itemValue)) warnDuplicateValue(itemValue);
      seen.add(itemValue);
    }
  });

  const focusTabStop = () => {
    rootRef.current?.querySelector<HTMLElement>('[data-roving-value][tabindex="0"]')?.focus();
  };

  // Arrow keys, Home and End move between the radios (and select) only when they are pressed on a
  // radio or on the group itself. A key pressed on other focusable content inside the group (a
  // link in an item's label) keeps its own meaning, such as scrolling the page.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const item = target.closest('[data-roving-value]');
    const fromOwnItem =
      item !== null && item.closest('[data-roving-container]') === event.currentTarget;
    if (target === event.currentTarget || fromOwnItem) containerProps.onKeyDown(event);
  };

  const contextValue = React.useMemo<RadioGroupItemsContextValue>(
    () => ({ value, disabled, select: setValue, getTabIndex, labelPosition }),
    [value, disabled, setValue, getTabIndex, labelPosition],
  );

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        role="radiogroup"
        {...fieldProps}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        className={wcn(
          radioGroupClassNames.root,
          'wave:relative wave:flex',
          orientation === 'vertical' ? 'wave:flex-col wave:gap-2' : 'wave:flex-row wave:gap-4',
          className,
        )}
        {...rest}
        ref={mergedRef}
        data-roving-container=""
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onFocus={composeEventHandlers(onFocus, containerProps.onFocus, {
          checkDefaultPrevented: false,
        })}
      >
        {children}
        <HiddenInput
          type="radio"
          name={name}
          form={form}
          disabled={disabled}
          value={value}
          required={isRequired}
          onInvalid={focusTabStop}
        />
      </div>
    </RadioGroupContext.Provider>
  );
};

RadioGroupRoot.displayName = 'RadioGroup';

/* ---- RadioItem ---- */
/** Forced-colors look of the dot of a disabled selected radio: GrayText, no Highlight fill. */
const disabledDot = 'wave:forced-colors:bg-[GrayText] wave:forced-colors:forced-color-adjust-none';

/** The handlers the label part drops while the radio is disabled: it does not select then. */
const BLOCK_CLICK = ['onClick'] as const;

/** Properties for the RadioItem component. */
export interface RadioItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'onChange'
> {
  /** Value associated with this radio option. */
  value: string;
  /**
   * Label next to the radio indicator (any phrasing content, links included, but no other form
   * controls). It names the radio through `aria-labelledby`, after a consumer `aria-labelledby`;
   * a consumer `aria-label` names it instead. Clicking its text selects the radio; clicking a link
   * inside it follows the link, and arrow keys on that link do not move between the radios. The
   * radio lines up with the first line of the label. `children` are not rendered: pass the label
   * here.
   */
  label?: React.ReactNode;
  /** Whether the radio item is disabled and non-interactive (also when the group is disabled). */
  disabled?: boolean;
  /**
   * Where the label sits: `after` the radio (the default, with the radio on the label's first
   * line) or `below` it, centred. Default: the group's `labelPosition`, else `'after'`. The root
   * carries it as `data-label-position`.
   * @default the group's `labelPosition`
   */
  labelPosition?: RadioLabelPosition;
  /** Class name of the item's root `<label>` element. */
  className?: string;
  /**
   * Class name of the element that renders the `label` text: after the element's own classes,
   * before a `slotProps.label` class.
   */
  labelClassName?: string;
  /** Ref to the `role="radio"` button. */
  ref?: React.Ref<HTMLButtonElement>;
  /**
   * Props for the elements the item draws, by part, merged into each part's own (Fluent UI's
   * `root`, `indicator` and `label` slot props): your classes after the part's (yours win a
   * conflict), your styles over its styles, your handlers before its handlers (`preventDefault()`
   * in yours skips the item's handling of the event, its own `on…` prop included), your ref
   * beside its ref, and your ids added to its `aria-labelledby` and `aria-describedby`. Every
   * attribute the item sets on a part is locked and keeps the item's value (set it through the
   * item's own props); you add the attributes it does not set. A part takes no `children`.
   */
  slotProps?: {
    /**
     * The root `<label>` around the radio and the label text (stable class
     * `wave-radio-group-item`), which the item's `className` reaches as well; its `ref` is the
     * one way to the label, since the item's `ref` and other props reach the radio. Your
     * classes come after the item's `className`. Locked: `htmlFor`, unset (the label labels the
     * radio it holds, and a `for` would send its clicks to another element), `hidden`, `inert`
     * and `aria-hidden`, unset (the root holds the radio, which only the item's own props hide),
     * and `role`, `tabIndex` and the roving markers the group reads (`data-roving-container`,
     * `data-roving-disabled`, `data-roving-value`, `aria-disabled`), unset (the root sits in the
     * group's arrow order: it is no composite that hides the radio, no item and no second tab
     * stop). Your `onClick` sees every click inside the root as it bubbles: a click on the
     * radio after the radio is selected, and a click on the label text first, before the
     * `<label>` passes it on to the radio, so the text's click reaches your `onClick` twice (the
     * text's own, then the radio's), as on any `<label>`; `preventDefault()` on the text's click
     * keeps the label from passing it on (no selection). It is not called while the radio is
     * disabled (its own `disabled` or the group's), as the radio is not selected then.
     */
    root?: SlotPart<'label'>;
    /**
     * The `role="radio"` `<button>` that draws the circle: the element the item's own props
     * and `ref` reach, but for `className` (stable class `wave-radio-group-item__indicator`).
     * Locked: `id`, `type`, `role`, `aria-checked`, `disabled`, `tabIndex` (the group's roving
     * tab stop), the roving markers the group finds its radios by (`data-roving-value`, and
     * `data-roving-container` and `data-roving-disabled` unset: a part can make the radio
     * neither a nested composite nor a skipped item of the arrow order), `aria-label`,
     * `hidden`, `inert` and `aria-hidden` (a focusable radio is hidden only by the item's own
     * props) and every prop you give the item itself. Your `onClick` runs before the item's
     * `onClick` and its selection (`preventDefault()` skips both); your other handlers run
     * before the item's.
     */
    indicator?: SlotPart<'button'>;
    /**
     * The `<span>` around the `label` text, rendered only with a `label` (stable class
     * `wave-radio-group-item__label`). Its classes come in the order: the element's own, then
     * `labelClassName`, then this part's `className`. Locked: `id`, which names the radio,
     * `aria-label` unset (it would replace the text in the name), and `role`, `tabIndex` and the
     * roving markers the group reads (`data-roving-container`, `data-roving-disabled`,
     * `data-roving-value`, `aria-disabled`), unset (the text sits in the group's roving
     * container: it is no item, composite or tab stop; a link inside it keeps its own). `hidden`,
     * `inert` and `aria-hidden` stay yours: the radio's `aria-labelledby` still reads hidden text.
     * Your `onClick` is not called while the radio is disabled (its own `disabled` or the
     * group's), as the radio is not selected then.
     */
    label?: SlotPart<'span'>;
  };
}

/**
 * One option of a {@link RadioGroup}: a `role="radio"` button inside a `<label>`.
 *
 * Native button props (`id`, `aria-*`, `data-*`, handlers, `style`) and `ref` go to the radio
 * button; `className` stays on the root `<label>` (which `slotProps.root` and its `ref` reach)
 * and `labelClassName` styles the label text. A consumer `onClick` runs before the selection;
 * `preventDefault()` in it cancels the selection. Must be rendered inside a RadioGroup (also
 * inside Fragments or wrapper elements). `label` takes rich content (a second line of subtext,
 * a link); `children` are not rendered (a development warning says so).
 */
export function RadioItem({
  value,
  label,
  disabled,
  labelPosition: labelPositionProp,
  className,
  labelClassName,
  onClick,
  'aria-labelledby': ariaLabelledBy,
  children,
  ref,
  slotProps,
  ...rest
}: RadioItemProps) {
  const {
    checked: selected,
    disabled: isDisabled,
    tabIndex,
    select,
    labelPosition: groupLabelPosition,
  } = useRadioItemState('RadioItem', value, disabled);
  // A value outside the two (untyped code) is skipped, like one outside a size.
  const labelPosition =
    labelPositionProp === 'after' || labelPositionProp === 'below'
      ? labelPositionProp
      : groupLabelPosition;
  const below = labelPosition === 'below';
  const hasChildren = slotRendersContent(children);
  React.useEffect(() => {
    if (hasChildren) {
      warnOnce(
        'RadioItem:children',
        'RadioItem: children are not rendered. Pass the label in `label`.',
      );
    }
  }, [hasChildren]);
  const generatedId = useId('radio-item');
  const labelTextId = useId('radio-item-label');

  // `0` is a label; `null`, `false`, `''` and empty collections are not (C-SLOTS).
  const hasLabel = slotRendersContent(label);
  // The label text names the radio through aria-labelledby, disabled or not: axe exempts the dimmed
  // text of a disabled radio only when the radio references it this way (its <label> exemption
  // covers native inputs only). A consumer aria-label still names the radio alone; a consumer
  // aria-labelledby comes first.
  const labelledBy =
    hasLabel && rest['aria-label'] === undefined
      ? joinIds(ariaLabelledBy, labelTextId)
      : ariaLabelledBy;
  const indicatorRef = useMergedRefs(ref, slotProps?.indicator?.ref);
  // The item's `style` is the part's own style, which a part style is merged over.
  const { style, ...restWithoutStyle } = rest;
  const indicatorProps = mergeSlotProps(slotProps?.indicator, {
    className: wcn(
      radioGroupItemClassNames.indicator,
      // p-0 and bg-transparent are set here, not left to the native reset, which any app button
      // style overrides (C-NATIVE).
      'wave:flex wave:h-[18px] wave:w-[18px] wave:shrink-0 wave:items-center wave:justify-center wave:rounded-full wave:border wave:bg-transparent wave:p-0 wave:transition-colors wave:motion-reduce:transition-none',
      // Centred on the 20px first line of the label text.
      hasLabel && !below && 'wave:mt-px',
      focusRing,
      selected ? 'wave:border-2 wave:border-primary' : 'wave:border-stroke-accessible',
      // Forced colors: the focusable circle keeps system colors (its focus outline stays
      // forced); only the dot opts out. A disabled radio draws GrayText, never Highlight.
      isDisabled
        ? forcedColors.disabled
        : selected
          ? 'wave:forced-colors:border-[Highlight]'
          : forcedColors.control,
    ),
    style,
    locked: {
      // The group's arrow order: a part makes the radio neither a nested composite nor a skipped
      // item (the item's own props, spread below, still can).
      'data-roving-container': undefined,
      'data-roving-disabled': undefined,
      id: generatedId,
      type: 'button',
      role: 'radio',
      ...restWithoutStyle,
      // Set only through the item's own props, whether or not they are given (a focusable
      // radio is hidden only by the item's own props).
      'aria-label': rest['aria-label'],
      hidden: rest.hidden,
      inert: rest.inert,
      'aria-hidden': rest['aria-hidden'],
      'aria-labelledby': labelledBy,
      'aria-checked': selected,
      disabled: isDisabled,
      tabIndex,
      'data-roving-value': value,
      onClick: composeEventHandlers(onClick, () => select(value)),
    },
  });
  const labelProps = mergeSlotProps(slotProps?.label, {
    className: wcn(
      radioGroupItemClassNames.label,
      'wave:text-body-1 wave:text-foreground',
      below && 'wave:text-center',
      labelClassName,
    ),
    // The text names the control through aria-labelledby: an aria-label would replace it. The
    // text sits in the group's roving container: a part makes it no item, tab stop or composite.
    locked: { id: labelTextId, 'aria-label': undefined, ...ROVING_PART_LOCKS },
    blockHandlers: isDisabled ? BLOCK_CLICK : undefined,
  });
  const rootProps = mergeSlotProps(slotProps?.root, {
    className: wcn(
      radioGroupItemClassNames.root,
      // items-start: the radio lines up with the first line of a label that wraps or has a
      // second line, not with its middle; below, the radio and the label are centred in a column.
      below
        ? 'wave:inline-flex wave:flex-col wave:items-center wave:gap-2 wave:select-none'
        : 'wave:inline-flex wave:items-start wave:gap-2 wave:select-none',
      // The dimmed look lifts while a focus ring shows inside the root (a link's in the label; a
      // disabled radio never takes focus): opacity would dim the ring below 3:1.
      isDisabled
        ? 'wave:cursor-not-allowed wave:opacity-50 wave:has-focus-visible:opacity-100'
        : 'wave:cursor-pointer',
      className,
    ),
    // The root holds the radio: a part neither hides it nor takes it out of reach, nor sends the
    // label's clicks to another element through a `for`, nor makes it a composite that hides the
    // radio from the group's arrow order, an item or a second tab stop.
    locked: {
      htmlFor: undefined,
      ...HIDDEN_PART_LOCKS,
      ...ROVING_PART_LOCKS,
      'data-label-position': labelPosition,
    },
    // The label passes a click to the radio, which is not selected while disabled.
    blockHandlers: isDisabled ? BLOCK_CLICK : undefined,
  });

  return (
    <label {...rootProps}>
      <button
        // The literal marks C-BUTTON-TYPE; the merged props hold the type (the item's props may
        // replace it, a part cannot).
        type="button"
        {...indicatorProps}
        ref={indicatorRef}
      >
        {selected && (
          <span
            aria-hidden="true"
            className={wcn(
              'wave:block wave:h-2 wave:w-2 wave:rounded-full wave:bg-primary',
              isDisabled ? disabledDot : forcedColors.selectedLeaf,
            )}
          />
        )}
      </button>
      {hasLabel && <span {...labelProps}>{materialiseSlotContent(label)}</span>}
    </label>
  );
}

RadioItem.displayName = 'RadioItem';

/**
 * Flat name of `RadioGroup.Item` (C-COMPOUND), for React Server Components, which cannot access
 * the dotted form. Same component as {@link RadioItem}.
 */
export const RadioGroupItem = RadioItem;

/** Props of {@link RadioGroupItem} (same as {@link RadioItemProps}). */
export type RadioGroupItemProps = RadioItemProps;

/**
 * A single-choice group of {@link RadioItem}s (`role="radiogroup"`).
 *
 * - One tab stop (the selected item, else the first enabled one); arrow keys move focus and select
 *   (APG radio group), Home/End jump to the ends, disabled items are skipped. A key pressed on a
 *   link inside an item's label stays the link's: it neither moves focus nor selects. Items may
 *   sit inside Fragments or wrapper elements. Every item needs its own `value` (a development
 *   warning names a value that several items share).
 * - Inside a `Field` it is named by the Field label (`aria-labelledby`) and described by its hint
 *   and error.
 * - With `name` (or `required`) it takes part in native forms; a form reset restores
 *   `defaultValue`.
 *
 * Use `RadioGroup.Item` (or the flat `RadioGroupItem`/`RadioItem` names) for the items. React
 * Server Components cannot access the dotted form, so they import the flat names; dotted access
 * needs a client file. An element of your own (a card with a title and a description) becomes one
 * of the group's radios through `useRadioGroupItem`, and `useRadioGroupContext` reads the group's
 * value from content inside it.
 */
export const RadioGroup = /* @__PURE__ */ Object.assign(RadioGroupRoot, { Item: RadioItem });
