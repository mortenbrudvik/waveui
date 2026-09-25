import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { disabledStyles, inputFocus, inputInvalid } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { collectOptionLabels, useListbox } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { isInvalidLook } from './Input';
import { ListboxSurface, Option, OptionGroup, useListboxPopup } from './Option';
import type { RoutedHandlers } from './routedHandlers';

/* ------------------------------------------------------------------ */
/*  Dropdown                                                          */
/* ------------------------------------------------------------------ */

/** Properties for the Dropdown component. */
export interface DropdownProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | RoutedHandlers
> {
  /** Controlled selected value (`''` for none). */
  value?: string;
  /**
   * Initial selected value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Called with the new value when a different option is selected. */
  onValueChange?: (value: string) => void;
  /**
   * Called on every option activation, also when the current option is selected again.
   * @deprecated Use `onValueChange`.
   */
  onOptionSelect?: (value: string) => void;
  /** Controlled open state of the listbox. */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage. A dropdown that starts disabled starts closed. The
   * list renders only in the browser: it is closed in the server HTML and opens once the dropdown
   * has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the listbox opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Placeholder text shown when no value is selected. It is not an accessible name: label the
   * Dropdown with a `Field`, `aria-label` or `aria-labelledby`.
   * @default 'Select an option'
   */
  placeholder?: string;
  /**
   * Whether the dropdown is disabled and non-interactive. Turning it on while the listbox is open
   * closes it (`onOpenChange(false)`).
   * @default false
   */
  disabled?: boolean;
  /** Name of the value in form submissions (renders a hidden input). */
  name?: string;
  /** Id of the form the value belongs to, when the Dropdown is outside it. */
  form?: string;
  /** A value is required to submit the form (native constraint validation). */
  required?: boolean;
  /** Called when the `<button role="combobox">` receives focus (the root keeps other handlers). */
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  /** Called when the `<button role="combobox">` loses focus. */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  /**
   * Called on a key press on the `<button role="combobox">`, before the built-in listbox keys;
   * `event.preventDefault()` skips them.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Called when a key is released on the `<button role="combobox">`. */
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Ref to the `<button role="combobox">` (the focusable element). */
  controlRef?: React.Ref<HTMLButtonElement>;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

const DropdownRoot = (props: DropdownProps) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    onOptionSelect,
    open: openProp,
    defaultOpen,
    onOpenChange,
    placeholder = 'Select an option',
    disabled = false,
    name,
    form,
    required,
    autoFocus,
    tabIndex,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    'aria-errormessage': ariaErrorMessage,
    'aria-details': ariaDetails,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    controlRef,
    className,
    children,
    ref,
    ...rest
  } = props;

  if (onOptionSelect !== undefined) warnDeprecated('Dropdown', 'onOptionSelect', 'onValueChange');

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    // An explicit `required={false}` wins over a required Field, so aria-required matches
    // `isRequired`.
    'aria-required': ariaRequired ?? required,
  });
  // The error look follows the resolved state: the consumer's `aria-invalid` or the Field's.
  const invalidLook = isInvalidLook(false, fieldProps['aria-invalid']);

  const [value, setValue] = useControllable(valueProp, defaultValue ?? '', onValueChange);
  // A dropdown that starts disabled never shows its list, so it starts closed (no close to report
  // later).
  const [openState, setOpen] = useControllable(
    openProp,
    (defaultOpen ?? false) && !disabled,
    onOpenChange,
  );
  const open = openState && !disabled;
  // Disabling also closes the list itself, not only the derived `open`, so enabling it again does
  // not reopen it without a user action. The close is reported through onOpenChange (a consumer
  // callback from an effect, C-HOOKS); a controlled `open` that stays true is not shown meanwhile.
  const lockedOpen = disabled && openState;
  React.useEffect(() => {
    if (lockedOpen) setOpen(false);
  }, [lockedOpen, setOpen]);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  const labels = React.useMemo(() => collectOptionLabels(children), [children]);

  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'select-only',
    selectedValues: value ? [value] : [],
    onSelect: (next) => {
      setValue(next);
      onOptionSelect?.(next);
    },
    idPrefix: 'dropdown-listbox',
  });

  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef: buttonRef,
  });

  const rootMergedRef = useMergedRefs<HTMLDivElement>(rootRef, ref);
  const buttonMergedRef = useMergedRefs<HTMLButtonElement>(buttonRef, controlRef, setReference);

  useFormReset(buttonRef, () => setValue(defaultValue ?? ''), form);

  const displayText = value ? (listbox.getItem(value)?.label ?? labels.get(value) ?? '') : '';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open && !expanded && !event.nativeEvent.isComposing) {
      // Open with nothing shown (no options): close, but leave Escape to an enclosing layer
      // (overlays#1) instead of consuming it for an invisible list.
      setOpen(false);
      return;
    }
    listbox.onKeyDown(event);
  };

  const listLabelledBy =
    fieldProps['aria-label'] === undefined
      ? (fieldProps['aria-labelledby'] ?? field?.labelId)
      : fieldProps['aria-labelledby'];

  return (
    <div {...rest} ref={rootMergedRef} className={cn('relative inline-flex flex-col', className)}>
      <button
        type="button"
        {...fieldProps}
        {...listbox.getComboboxProps()}
        aria-expanded={expanded}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        ref={buttonMergedRef}
        disabled={disabled}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          // Every padding is set here (C-NATIVE), not left to an app-wide `button` rule.
          'flex h-8 w-full items-center justify-between rounded border border-input border-b-stroke-accessible bg-background px-3 py-0 text-start text-body-1 text-foreground',
          inputFocus,
          disabledStyles,
          invalidLook && inputInvalid,
        )}
      >
        <span className={cn('truncate', !displayText && 'text-muted-foreground')}>
          {displayText || placeholder}
        </span>
        <ChevronDownIcon
          className={cn(
            'ms-2 shrink-0 transition-transform motion-reduce:transition-none',
            expanded && 'rotate-180',
          )}
        />
      </button>
      <ListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        aria-label={fieldProps['aria-label']}
        aria-labelledby={listLabelledBy}
      >
        {children}
      </ListboxSurface>
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={value}
        type="text"
        required={isRequired}
        onInvalid={() => buttonRef.current?.focus()}
      />
    </div>
  );
};
DropdownRoot.displayName = 'Dropdown';

/** Flat name of `Dropdown.Option` for React Server Components. */
export const DropdownOption = Option;
/** Flat name of `Dropdown.OptionGroup` for React Server Components. */
export const DropdownOptionGroup = OptionGroup;

/**
 * A select-only combobox (APG): a button that opens a listbox of `Option`s. Enter, Space,
 * ArrowDown/ArrowUp, Home/End and typing a character open it and move the highlight
 * (`aria-activedescendant`); Enter/Space select, Tab selects the highlighted option and moves on,
 * Escape closes.
 *
 * The `<button>` receives `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`, `autoFocus`
 * and `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp`. `ref`, `className`, `style`, other `aria-*`
 * attributes and the remaining props stay on the root `<div>`. Inside a `Field` the button is
 * labelled and described by it — otherwise give it an `aria-label`. It shows the error look
 * whenever it ends up `aria-invalid` (its own `aria-invalid` or a `Field` error). With
 * `name`/`required` the value takes part in form submission, validation and reset. The open
 * listbox renders in a portal; while closed it stays in the DOM, hidden.
 *
 * Sub-components: `Dropdown.Option`, `Dropdown.OptionGroup`. React Server Components import the
 * flat names `DropdownOption` / `DropdownOptionGroup` (dotted access needs a client file).
 */
export const Dropdown = /* @__PURE__ */ Object.assign(DropdownRoot, {
  Option,
  OptionGroup,
});
