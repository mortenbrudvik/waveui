import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { isOwnEvent } from '../../lib/events';
import { focusRing } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useIsClient } from '../../hooks/useIsClient';
import { useListbox } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { ListboxProvider, Option, OptionGroup } from './Option';
import { announceToggle, PickerAnnouncer } from './pickerLabels';
import { EMPTY_VALUES, resetValues, toggleValue, toValues } from './pickerValues';

/* ------------------------------------------------------------------ */
/*  Listbox                                                           */
/* ------------------------------------------------------------------ */

/**
 * The Listbox's built-in texts, for localization: the announcements of a `multiselect` toggle.
 * Each member is optional and falls back to its English default.
 */
export interface ListboxLabels {
  /**
   * Announced when a `multiselect` toggle selects an option; `count` is the number of values
   * selected after the change.
   * @default (label, count) => `${label} added, ${count} selected`
   */
  added?: (label: string, count: number) => string;
  /**
   * Announced when a `multiselect` toggle deselects an option; `count` is the number of values
   * selected after the change.
   * @default (label, count) => `${label} removed, ${count} selected`
   */
  removed?: (label: string, count: number) => string;
}

/** Properties for the Listbox component. */
export interface ListboxProps<M extends boolean = false> extends Omit<
  React.HTMLAttributes<HTMLUListElement>,
  'onChange' | 'defaultValue'
> {
  /**
   * Several options can be selected (Fluent's `multiselect`; List's `selectionMode="multiple"` is
   * the other widget): the value is an array, options draw a checkbox, Space, Enter and a click
   * toggle an option, and each toggle is announced. A non-literal `multiselect={flag}` is a type
   * error: render two elements, one for each mode.
   * @default false
   */
  multiselect?: M;
  /**
   * Controlled selected value (`''` for none), or with `multiselect` the selected values in
   * selection order (Fluent's `selectedOptions`).
   */
  value?: M extends true ? readonly string[] : string;
  /**
   * Initial selected value for uncontrolled usage, which a form reset restores.
   * @default '' (`[]` with `multiselect`)
   */
  defaultValue?: M extends true ? readonly string[] : string;
  /**
   * Called with the new value when it changes (a new array with `multiselect`; Fluent's
   * `onOptionSelect`, under WaveUI's value/onValueChange naming). In single-select mode, selecting
   * the selected option again changes nothing: the Listbox never deselects it.
   */
  onValueChange?: M extends true ? (value: string[]) => void : (value: string) => void;
  /**
   * Called after the active (highlighted) option changes — focus, arrow keys, typeahead, the
   * pointer — and with `null` when focus leaves the list (a switch to another window keeps the
   * active option). It reports what `aria-activedescendant` points at, from an effect once the
   * change commits. Fluent's `onActiveOptionChange` reports neither the pointer (its options have
   * no hover highlight) nor the loss of focus.
   */
  onActiveOptionChange?: (value: string | null) => void;
  /**
   * Takes the list out of the tab order (a click does not focus it either, as a disabled native
   * `<select>`) and dims it: its options take no pointer input, nothing can be selected, and
   * nothing is submitted or validated. Renders `aria-disabled` and `data-disabled`. An
   * `aria-disabled` of your own without `disabled` is passed through as it is: the list stays
   * interactive.
   * @default false
   */
  disabled?: boolean;
  /**
   * Focuses the list when it mounts in the browser (React focuses only form controls itself), not
   * while `disabled`. Server-rendered HTML carries the `autofocus` attribute for the browser's own
   * autofocus, so a hydrating list takes no focus, as React leaves a hydrated form control alone.
   * @default false
   */
  autoFocus?: boolean;
  /**
   * Keeps disabled options in the arrow-key, Home/End, PageUp/PageDown and typeahead order (the
   * option that is active on focus may then be a disabled one too); they still cannot be
   * selected (Space, Enter and a click do nothing). Unlike Fluent, which always keeps disabled
   * options reachable, WaveUI skips them by default.
   * @default false
   */
  disabledOptionsFocusable?: boolean;
  /** The `multiselect` toggle announcements, for localization. Unset members keep their English defaults. */
  labels?: ListboxLabels;
  /**
   * Name of the value in form submissions (renders a hidden input inside the list; one per value
   * with `multiselect`).
   */
  name?: string;
  /** Id of the form the value belongs to, when the Listbox is outside it. */
  form?: string;
  /**
   * A value is required to submit the form (native constraint validation); when validation finds
   * it empty, focus moves to the list.
   */
  required?: boolean;
  /**
   * Called on a key press on the list, before the built-in keys; `event.preventDefault()` skips
   * them.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLUListElement>;
  /** Ref to the `<ul role="listbox">`. */
  ref?: React.Ref<HTMLUListElement>;
}

/** The Listbox component's type: a multi-select signature, then the single-select one. */
export interface ListboxComponent {
  (props: ListboxProps<true> & { multiselect: true }): React.ReactNode;
  (props: ListboxProps): React.ReactNode;
  displayName?: string;
  Option: typeof Option;
  OptionGroup: typeof OptionGroup;
}

const UNNAMED_WARNING =
  'Listbox: the listbox has no accessible name. Pass `aria-label` or `aria-labelledby`, or ' +
  'render it inside a Field.';

/** The state attributes of a disabled list, rendered only while `disabled` (C-DISABLED). */
const DISABLED_ATTRIBUTES = { 'aria-disabled': true, 'data-disabled': '' } as const;

/** Whether `element` is the focused element of its document or shadow root. */
function isActiveElement(element: HTMLElement): boolean {
  return (element.getRootNode() as Partial<DocumentOrShadowRoot>).activeElement === element;
}

const ListboxRoot = (props: ListboxProps<boolean>) => {
  const {
    multiselect = false,
    value: valueProp,
    defaultValue,
    onValueChange,
    onActiveOptionChange,
    disabled = false,
    disabledOptionsFocusable = false,
    autoFocus = false,
    labels,
    name,
    form,
    required,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    className,
    children,
    ref,
    ...rest
  } = props;

  const field = useFieldContext();
  // `<label for>` does not reach a listbox, so a Field names it through aria-labelledby. An
  // explicit `required={false}` wins over a required Field, so aria-required matches the native
  // requirement below.
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-required': ariaRequired ?? required,
    },
    { labelable: false },
  );

  const [value, setValue] = useControllable<string | readonly string[]>(
    valueProp,
    defaultValue ?? (multiselect ? EMPTY_VALUES : ''),
    (next) => {
      // The two call signatures make `onValueChange` a union of incompatible functions from here:
      // the root itself is written against the wider, internal shape (D9).
      (onValueChange as ((value: string | string[]) => void) | undefined)?.(
        typeof next === 'string' ? next : [...next],
      );
    },
  );
  // Normalised for the listbox, the hidden inputs and the reset: a single value is its own
  // one-element array, and a `value` passed as `null` from JavaScript is none rather than a crash.
  const values = toValues(value);

  // The focus of the list itself (not of anything inside it): an option is active only while the
  // list has focus, so its outline never shows on a list the user is not in (D17).
  const [focused, setFocused] = React.useState(false);
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const isClient = useIsClient();
  // Whether the mount's autoFocus was handled: a later change never focuses the list.
  const autoFocusHandledRef = React.useRef(false);

  // The focus state follows the DOM, not only focus events, on mount, once hydrated and whenever
  // `disabled` changes: a list focused before hydration (a tab, the browser's autofocus) has focus
  // without a focus event React saw, and a browser that moves focus off a list whose tab stop went
  // away fires no blur. React focuses only form controls for `autoFocus`, so a list mounted in the
  // browser focuses itself; a hydrating one leaves focus where it is, as React does for a control.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!autoFocusHandledRef.current) {
      autoFocusHandledRef.current = true;
      if (autoFocus && !disabled && isClient) list.focus();
    }
    setFocused(!disabled && isActiveElement(list));
  }, [autoFocus, disabled, isClient]);

  const listbox = useListbox({
    open: focused && !disabled,
    mode: 'standalone',
    multiselect,
    selectedValues: values,
    // APG listbox: the arrows stop at the ends.
    loop: false,
    disabledOptionsFocusable,
    onSelect: (next, details) => {
      if (disabled) return;
      if (!multiselect) {
        // Selecting the selected option again is no change: useControllable skips it.
        setValue(next);
        return;
      }
      const { values: updated, added } = toggleValue(values, next);
      setValue(updated);
      // A toggle the user made (D41): a controlled change and a form reset never reach this
      // callback. `details` carries the registered option, whose label is its text.
      announceToggle(labels, details?.item.label ?? next, added, updated.length);
    },
    onActiveValueChange: onActiveOptionChange,
    idPrefix: 'listbox',
  });
  // The hook's ref must reach the list: a pointer press on an option focuses the list through it.
  const { ref: listElementRef, ...listProps } = listbox.getListboxProps();
  const mergedRef = useMergedRefs<HTMLUListElement>(ref, listRef, listElementRef);

  useFormReset(
    listRef,
    () => {
      if (!multiselect) {
        setValue(defaultValue ?? '');
        return;
      }
      // Compared by content (C-FORMS), so a reset that keeps the same values reports nothing.
      setValue((current) => resetValues(current, defaultValue));
    },
    form,
  );

  // C-DEV: a listbox needs a name; a blank one names nothing.
  const unnamed = !fieldProps['aria-label']?.trim() && !fieldProps['aria-labelledby']?.trim();
  React.useEffect(() => {
    if (unnamed) warnOnce('Listbox:unnamed', UNNAMED_WARNING);
  }, [unnamed]);

  // C-COMPOSE: keys typed in a portal rendered inside the list bubble through it in React; they
  // are not the list's.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (disabled || !isOwnEvent(event)) return;
    listbox.onKeyDown(event);
  };
  // Only the list's own focus counts: focus inside a portal rendered in it, or on its hidden
  // input (which hands focus back to the list), is not the list's.
  const handleFocus = (event: React.FocusEvent<HTMLUListElement>) => {
    if (event.target === event.currentTarget) setFocused(true);
  };
  // A switch to another window blurs the list but leaves it the active element, so the list keeps
  // its active option for the return, as a native `<select size>` keeps its keyboard position;
  // focus that moves elsewhere in the page changes the active element before the blur.
  const handleBlur = (event: React.FocusEvent<HTMLUListElement>) => {
    const list = event.currentTarget;
    if (event.target === list && !isActiveElement(list)) setFocused(false);
  };

  return (
    <ul
      {...rest}
      {...fieldProps}
      {...listProps}
      // The consumer's id (or the Field's control id), else the hook's; the option ids keep the
      // hook's prefix.
      id={fieldProps.id ?? listProps.id}
      tabIndex={disabled ? undefined : listProps.tabIndex}
      aria-activedescendant={listProps['aria-activedescendant']}
      aria-multiselectable={listProps['aria-multiselectable']}
      // Rendered only while disabled, so a consumer `aria-disabled` on an enabled list passes
      // through as it is (C-DISABLED: the list stays interactive).
      {...(disabled ? DISABLED_ATTRIBUTES : undefined)}
      // The server renders the `autofocus` attribute for the browser; the effect above focuses a
      // list mounted in the browser. Without autoFocus the prop stays out of hydration's check.
      autoFocus={autoFocus || undefined}
      ref={mergedRef}
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
      // Bookkeeping that mirrors the DOM: it runs even when a consumer handler prevents the event.
      onFocus={composeEventHandlers(onFocus, handleFocus, { checkDefaultPrevented: false })}
      onBlur={composeEventHandlers(onBlur, handleBlur, { checkDefaultPrevented: false })}
      className={cn(
        // The list's own margin, padding and markers are set here, not left to the native reset
        // (C-NATIVE).
        'relative m-0 flex list-none flex-col overflow-y-auto px-0 py-1 text-foreground',
        // The active option's outline shows focus; while no option can be active (an empty list,
        // every option hidden, or every option disabled without disabledOptionsFocusable), the
        // list's own ring does (WCAG 2.4.7). The outline is hidden only while focused, so forced
        // colors still draw one (C-FOCUS).
        listbox.activeValue === null ? focusRing : 'focus:outline-hidden',
        // Disabled: the options take no pointer input (inherited by the options of a group), so
        // none hovers and the list's own not-allowed cursor shows over them.
        disabled && 'cursor-not-allowed opacity-50 *:pointer-events-none',
        className,
      )}
    >
      {multiselect && <PickerAnnouncer />}
      <ListboxProvider value={listbox.context}>{children}</ListboxProvider>
      {/* Inside the list: a focused hidden input hands focus back to its parent element. */}
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={multiselect ? values : (values[0] ?? '')}
        type="text"
        required={required ?? field?.required ?? false}
        onInvalid={() => listRef.current?.focus()}
      />
    </ul>
  );
};
ListboxRoot.displayName = 'Listbox';

/** Flat name of `Listbox.Option` for React Server Components. */
export const ListboxOption = Option;
/** Flat name of `Listbox.OptionGroup` for React Server Components. */
export const ListboxOptionGroup = OptionGroup;

/**
 * A list of options that holds focus itself (APG listbox): one `<ul role="listbox">` of
 * `Option`s, whose `aria-activedescendant` points at the active option while the list has focus.
 * It is the picker option model shown in the page — typeahead, groups, disabled options and the
 * option look of Dropdown and Combobox. Use `List` with `selectable` (`selectionMode`) instead
 * when each item needs real focus, actions of its own or interactive content.
 *
 * - **Focus.** One tab stop. The active option exists only while the list has focus, and a
 *   switch to another window keeps it: the selected option (with `multiselect`, the first
 *   selected one in list order), else the first. While no option can be active (an empty list,
 *   every option hidden, or every option disabled without `disabledOptionsFocusable`) the list
 *   draws its own focus ring. A press on an option focuses the list and makes that option active
 *   without scrolling, so the click selects it even while the selected option is scrolled out of
 *   view. `autoFocus` focuses the list when it mounts.
 * - **Keys.** ArrowDown and ArrowUp move without wrapping, Home and End go to the first and last
 *   option, PageUp and PageDown move ten options, and typing moves to the matching option
 *   (typeahead). Space and Enter select the active option: the selection does not follow the
 *   active option. Tab, Escape and Alt+Arrow keys are left to the page, so an enclosing Dialog
 *   closes on Escape.
 * - **Selection.** `value`, `defaultValue` and `onValueChange` are Fluent's `selectedOptions`,
 *   `defaultSelectedOptions` and `onOptionSelect` under WaveUI's value naming. A single-select
 *   Listbox keeps the selected option when it is selected again (no deselection). `multiselect`
 *   turns the value into an array: options draw a checkbox, Space, Enter and a click toggle an
 *   option, the value keeps selection order, and every toggle the user makes is announced
 *   (`labels.added`/`labels.removed`; never a controlled change or a form reset). A non-literal
 *   `multiselect={flag}` is a type error: render two elements, one for each mode.
 * - **Disabled.** `disabled` takes the list out of the tab order (a click does not focus it
 *   either), dims it, takes pointer input off its options, selects nothing and submits nothing.
 *   Disabled options are skipped by the keys unless `disabledOptionsFocusable`, and are never
 *   selected.
 * - **Forms and Field.** With `name` the value is submitted with its form (one entry, or one per
 *   value with `multiselect`), and `required` needs a value (native validation; a missing value
 *   moves focus to the list). A reset of its form restores `defaultValue`, with or without a
 *   `name` (a `multiselect` reset is compared by content, so restoring the same values reports
 *   nothing). Inside a `Field` the list is labelled by its label, described by its message and
 *   hint, and takes its invalid and required state; otherwise name it with `aria-label` or
 *   `aria-labelledby` (development warns once when it has no name).
 * - It has no built-in height: give it one through `className` and it scrolls.
 *
 * Every prop, the `ref` and the handlers go to the `<ul>`. Sub-components: `Listbox.Option`,
 * `Listbox.OptionGroup`. React Server Components import the flat names `ListboxOption` /
 * `ListboxOptionGroup` (dotted access needs a client file).
 *
 * @example
 * <Listbox aria-label="Fruit" name="fruit" defaultValue="banana">
 *   <Listbox.Option value="apple">Apple</Listbox.Option>
 *   <Listbox.Option value="banana">Banana</Listbox.Option>
 * </Listbox>
 */
export const Listbox = /* @__PURE__ */ Object.assign(ListboxRoot, {
  Option,
  OptionGroup,
}) as ListboxComponent;
