import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import { isOwnEvent } from '../../lib/events';

/*
 * The context a `RadioGroup` gives its items, and the public hooks that read it for content and
 * radios of your own (P13-02, R13): `useRadioGroupContext`, a narrow view of the group, and
 * `useRadioGroupItem`, the props of a radio element. The context object and its full value stay
 * internal (R11). Imports no component: `RadioGroup.tsx` imports this module, never the reverse.
 */

/** What a `RadioGroup` gives its items. Internal: the public hooks return narrow views of it. */
export interface RadioGroupItemsContextValue {
  /** The selected value (`''` when nothing is selected). */
  value: string;
  /** Group-level disabled state. */
  disabled: boolean;
  /**
   * Selects a value when an item is activated (click, Space, Enter). Arrow keys select through
   * the roving hook's `onFocusMove` instead. Both paths use the same `setValue`, so
   * `onValueChange` fires only when the value changes (C-NAMING).
   */
  select: (value: string) => void;
  /** Roving tab index of an item. */
  getTabIndex: (value: string) => 0 | -1;
}

/** Internal: provided by `RadioGroup`, read through the hooks of this module. */
export const RadioGroupContext = React.createContext<RadioGroupItemsContextValue | null>(null);
RadioGroupContext.displayName = 'RadioGroupContext';

const noop = () => {};

/** Nothing selected, nothing selectable, no tab stop: outside a RadioGroup in production. */
const INERT_CONTEXT: RadioGroupItemsContextValue = {
  value: '',
  disabled: false,
  select: noop,
  getTabIndex: () => -1,
};

/**
 * The surrounding RadioGroup's context; throws in development outside one, logs once and returns
 * an inert value in production (C-CONTEXT).
 */
function useRadioGroupItemsContext(componentName: string): RadioGroupItemsContextValue {
  const context = React.useContext(RadioGroupContext);
  if (context) return context;
  reportMissingContext(componentName, 'a RadioGroup');
  return INERT_CONTEXT;
}

/** The state of one item of a RadioGroup. */
export interface RadioItemState {
  /** Whether the item's value is the selected one. */
  checked: boolean;
  /** Whether the item is disabled, on its own or through the group. */
  disabled: boolean;
  /** `0` on the item that holds the group's tab stop, `-1` on the others and on a disabled item. */
  tabIndex: 0 | -1;
  /** The group's selection. */
  select: (value: string) => void;
}

/**
 * The state of the item `value` of the surrounding RadioGroup, computed once for `RadioGroup.Item`
 * and `useRadioGroupItem`, so a built-in item and one of your own agree on checked, disabled and the
 * tab stop. Internal.
 */
export function useRadioItemState(
  componentName: string,
  value: string,
  disabled: boolean | undefined,
): RadioItemState {
  const group = useRadioGroupItemsContext(componentName);
  const isDisabled = Boolean(disabled || group.disabled);
  return {
    checked: group.value === value,
    disabled: isDisabled,
    tabIndex: isDisabled ? -1 : group.getTabIndex(value),
    select: group.select,
  };
}

/** The state of a `RadioGroup` that {@link useRadioGroupContext} returns. */
export interface RadioGroupContextValue {
  /** The selected value; `undefined` while nothing is selected (the group's `value` is `''`). */
  value: string | undefined;
  /**
   * Whether the whole group is disabled (its `disabled` prop). An item can also be disabled on its
   * own, which this does not report.
   */
  disabled: boolean;
  /**
   * Selects `value`, as activating its item does: the group's `onValueChange` fires when the value
   * changes, and a controlled group shows the value its parent passes back. It selects whether or
   * not the group is disabled (read `disabled` to decide).
   */
  select: (value: string) => void;
}

/**
 * The state of the surrounding `RadioGroup`, for content of your own inside it: the selected
 * `value`, whether the group is `disabled`, and `select` to choose a value. It is a narrow view of
 * the group (the context object is not public), and the same object while none of the three
 * changes. To make an element of your own one of the group's radios, use `useRadioGroupItem`.
 *
 * Must be called inside a `RadioGroup`: outside one it throws in development and, in production,
 * logs once and returns an inert value (nothing selected, not disabled, `select` does nothing).
 *
 * Fluent UI's counterpart is `useRadioGroupContextValue_unstable`, which returns the group's props
 * (`name`, `value`, `disabled`, `layout`, …) with no way to select, and an empty object outside a
 * group.
 *
 * @example
 * function PlanSummary() {
 *   const { value } = useRadioGroupContext();
 *   return <p>{value === undefined ? 'Choose a plan' : `Chosen: ${value}`}</p>;
 * }
 */
export function useRadioGroupContext(): RadioGroupContextValue {
  const { value, disabled, select } = useRadioGroupItemsContext('useRadioGroupContext');
  const selected = value === '' ? undefined : value;
  return React.useMemo(() => ({ value: selected, disabled, select }), [selected, disabled, select]);
}

/** Options of {@link useRadioGroupItem}. */
export interface UseRadioGroupItemOptions {
  /**
   * Disables the item: the arrow keys skip it, it never holds the tab stop, and clicks and keys do
   * not select it. A disabled group disables every item, whatever this says.
   * @default false
   */
  disabled?: boolean;
}

/** Result of {@link useRadioGroupItem}. */
export interface UseRadioGroupItemResult {
  /**
   * The props to spread on the element that is the radio. Compose a handler of your own with the
   * returned one (`composeEventHandlers(yours, props.onClick)`) rather than replacing it.
   */
  props: {
    /** The radio role. */
    role: 'radio';
    /** Whether the item is the selected one. */
    'aria-checked': boolean;
    /** `true` while the item is disabled, absent otherwise: the group's arrow keys skip it. */
    'aria-disabled'?: boolean;
    /**
     * `0` on the item that holds the group's single tab stop (the selected item, else the first
     * enabled one), `-1` on every other item and on a disabled one.
     */
    tabIndex: 0 | -1;
    /** The item's value: the group finds its items, their order and the tab stop by it. */
    'data-roving-value': string;
    /**
     * Selects an enabled item. Ignores an event whose default was prevented and one React bubbles
     * from a portal the element renders.
     */
    onClick: React.MouseEventHandler<HTMLElement>;
    /**
     * Space and Enter select an enabled item (calling `preventDefault()`, so Space does not scroll
     * the page). Ignores an event whose default was prevented and keys pressed on anything but the
     * element itself. The group handles the arrow keys, Home and End.
     */
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  };
  /** Whether the item is selected (`props['aria-checked']`), to draw it. */
  checked: boolean;
  /** Whether the item is disabled, by `options.disabled` or by the group, to draw it. */
  disabled: boolean;
}

/**
 * Makes an element of your own a radio of the surrounding `RadioGroup` (a card with a title and a
 * description, a tile with a picture): returns the props to spread on it, whether it is checked
 * and whether it is disabled. With them the element joins the group as `RadioGroup.Item` does: one
 * tab stop for the group (the selected item, else the first enabled one), arrow keys that move
 * focus and select (Left and Right mirrored under `dir="rtl"`), Home and End, Space and Enter to
 * select, disabled items skipped, the group's `onValueChange`, its form value (the group submits
 * the selected value under its `name`; the item renders no input), the focus a failed validation
 * moves to the tab stop, and the duplicate-value warning. Built-in items and items of your own can
 * share a group.
 *
 * - Name the element (`aria-labelledby` pointing at its title, or `aria-label`) and describe it
 *   (`aria-describedby`) yourself, and draw its checked, disabled and focused looks (from `checked`
 *   and `disabled`, or the ARIA attributes), with a focus indicator a keyboard user can see: the
 *   library's own is the exported `focusRing` class string, which you add with `cn()`.
 * - The content of a radio is presentational: put no link, button or other control inside it.
 * - Compose a handler of your own with the returned one (`composeEventHandlers(yours,
 *   props.onClick)`): `preventDefault()` in yours cancels the selection.
 * - `value` must be unique within the group and not `''`, the group's "nothing selected".
 *
 * Must be called inside a `RadioGroup`: outside one it throws in development and, in production,
 * logs once and returns the props of an inert radio (unchecked, out of the tab order, selecting
 * nothing).
 *
 * Fluent UI has no hook for a radio of your own: its `Radio` renders a native radio input, which
 * its state hook (`useRadioBase_unstable`) builds.
 *
 * @example
 * function PlanCard({ value, title }: { value: string; title: string }) {
 *   const id = useId('plan');
 *   const { props, checked } = useRadioGroupItem(value);
 *   return (
 *     <div {...props} aria-labelledby={id} data-checked={checked ? '' : undefined}>
 *       <span id={id}>{title}</span>
 *     </div>
 *   );
 * }
 */
export function useRadioGroupItem(
  value: string,
  options?: UseRadioGroupItemOptions,
): UseRadioGroupItemResult {
  const { checked, disabled, tabIndex, select } = useRadioItemState(
    'useRadioGroupItem',
    value,
    options?.disabled,
  );
  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled || event.defaultPrevented || !isOwnEvent(event)) return;
    select(value);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (disabled || event.defaultPrevented || event.target !== event.currentTarget) return;
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    select(value);
  };
  return {
    props: {
      role: 'radio',
      'aria-checked': checked,
      ...(disabled && { 'aria-disabled': true }),
      tabIndex,
      'data-roving-value': value,
      onClick,
      onKeyDown,
    },
    checked,
    disabled,
  };
}
