import * as React from 'react';
import { flushSync } from 'react-dom';
import { wcn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { timePickerClassNames } from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { CheckIcon, DismissIcon } from '../../lib/icons';
import type { Slot } from '../../lib/slot';
import { popupMotion } from '../../lib/motion';
import {
  lockPositionStyle,
  mergeSlotProps,
  ROVING_PART_LOCKS,
  type SlotPart,
} from '../../lib/slotProps';
import {
  disabledStyles,
  focusRing,
  forcedColors,
  inputAppearanceClasses,
  inputFocus,
  inputHeightClasses,
  inputInvalid,
  inputPaddingClasses,
  inputTextClasses,
} from '../../lib/styles';
import type {
  CoreSize,
  InputAppearance,
  MotionSlot,
  PopupPositioningOptions,
} from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useDismiss } from '../../hooks/useDismiss';
import { useEventCallback } from '../../hooks/useEventCallback';
import { fieldLocks, useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import {
  ListboxContext,
  OPTION_STATE_LOCKS,
  preventMouseDown,
  useListbox,
  useListboxOption,
} from '../../hooks/useListbox';
import type { ListboxItem } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useMotionClasses } from '../../hooks/useMotion';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import { resolvePositioning, usePopupPosition } from '../../hooks/usePopupPosition';
import { HiddenInput } from '../internal/HiddenInput';
import { Portal } from '../portal/Portal';
import { PickerExpandButton, showsExpandButton } from './Combobox.expand';
import { PickerClearButton } from './PickerClearButton';
import { renderListboxWindow, useShownListScroll } from './Option.data';
import {
  DEFAULT_TIME_STEP,
  generateTimeOptions,
  localeTimeFormat,
  normalizeTimeStep,
  secondsToTime,
  secondsToValue,
  timeToSeconds,
  type TimeFormat,
} from './dateUtils';
import { useInputLook } from './inputLook';
import { isInvalidLook } from './Input';
import { usePickerSurfacePresence } from './pickerPresence';
import {
  pickerButtonOffset,
  pickerEndPadding,
  pickerGlyphSize,
  pickerIconButtonClasses,
} from './pickerStyles';
import type { RoutedHandlers } from './routedHandlers';
import { useAppClassName } from '../../hooks/useAppClassName';

/* ------------------------------------------------------------------ */
/*  Option                                                             */
/* ------------------------------------------------------------------ */

const OPTION_CLASSES =
  'wave:flex wave:cursor-pointer wave:items-center wave:gap-2 wave:px-3 wave:py-1.5 wave:text-body-1 wave:text-foreground wave:hover:bg-subtle-hover wave:data-[active]:bg-subtle-hover wave:data-[active]:outline-2 wave:data-[active]:outline-ring wave:data-[active]:-outline-offset-2 wave:data-[selected]:bg-subtle-selected wave:data-[selected]:font-semibold';

const CHECK_ICON_CLASSES = wcn(
  timePickerClassNames.checkIcon,
  'wave:flex wave:h-4 wave:w-4 wave:shrink-0 wave:items-center wave:justify-center',
);

interface TimePickerOptionProps {
  value: string;
  label: string;
  /** TimePicker's `slotProps.option`. */
  part: SlotPart<'li'> | undefined;
  /** TimePicker's `slotProps.checkIcon`. */
  checkIconPart: SlotPart<'span'> | undefined;
}

/**
 * One time option. Memoized: it re-renders only when its own active/selected state changes (read
 * from the listbox store), so moving the highlight renders two options, not the whole list. The
 * parts' props are merged only when given: an option renders often.
 */
const TimePickerOption = React.memo(function TimePickerOption({
  value,
  label,
  part,
  checkIconPart,
}: TimePickerOptionProps) {
  const { selected, optionProps } = useListboxOption<HTMLLIElement>({ value, label }, part?.ref);
  const { ref: optionRef, style: optionStyle, ...optionAttributes } = optionProps;
  const className = wcn(
    timePickerClassNames.option,
    OPTION_CLASSES,
    selected && forcedColors.selectedContainer,
  );
  return (
    <li
      {...optionAttributes}
      style={optionStyle}
      className={className}
      {...(part &&
        mergeSlotProps(part, {
          className,
          style: optionStyle,
          // The state attributes the option renders only while set stay its own when unset.
          locked: { ...OPTION_STATE_LOCKS, ...optionAttributes },
        }))}
      ref={optionRef}
    >
      <span
        className={CHECK_ICON_CLASSES}
        {...(checkIconPart && mergeSlotProps(checkIconPart, { className: CHECK_ICON_CLASSES }))}
      >
        {selected ? <CheckIcon size={12} /> : null}
      </span>
      {label}
    </li>
  );
});
TimePickerOption.displayName = 'TimePickerOption';

/* ------------------------------------------------------------------ */
/*  TimePicker                                                         */
/* ------------------------------------------------------------------ */

/** Why typed text was not accepted (see {@link TimePickerProps.onInvalidInput}). */
export type TimePickerInvalidReason = 'unparseable' | 'out-of-range' | 'not-listed';

/**
 * The TimePicker's built-in texts, for localization. Each member is optional and falls back to its
 * English default. The times themselves follow `format`.
 */
export interface TimePickerLabels {
  /** Name of the clear button.
   * @default 'Clear time'
   */
  clear?: string;
  /** Name of the expand button at the end of the input.
   * @default 'Show times'
   */
  expand?: string;
  /** Name of the list of times when the picker has no `aria-label`, `aria-labelledby` or Field
   * label to lend it.
   * @default 'Times'
   */
  list?: string;
  /** Status text (announced and shown in the open list) when `minTime`/`maxTime` leave no times.
   * @default 'No times available'
   */
  noTimes?: string;
  /** Status text (announced and shown in the open list) when the typed text matches no time.
   * @default 'No matching times'
   */
  noMatches?: string;
  /**
   * Message for text that is not a time. `format` is the display pattern (`'HH:mm'` or
   * `'h:mm AM'`).
   * @default (format) => `Enter a time in the format ${format}.`
   */
  invalidTime?: (format: string) => string;
  /**
   * Message for a time outside `minTime`/`maxTime`. The bounds are passed as the input shows times
   * (`format`); a bound that is not set is `undefined`.
   * @default (min, max) => `Enter a time between ${min} and ${max}.` (only `min`: `Enter a time on
   * or after ${min}.`; only `max`: `Enter a time on or before ${max}.`)
   */
  outOfRange?: (min: string | undefined, max: string | undefined) => string;
  /**
   * Message for a time that is not one of the listed times, with `freeform={false}`.
   * @default 'Choose a time from the list.'
   */
  notListed?: string;
}

const defaultInvalidTimeLabel = (format: string) => `Enter a time in the format ${format}.`;

const defaultOutOfRangeLabel = (min: string | undefined, max: string | undefined) => {
  if (min !== undefined && max !== undefined) return `Enter a time between ${min} and ${max}.`;
  if (min !== undefined) return `Enter a time on or after ${min}.`;
  return `Enter a time on or before ${max}.`;
};

/** Properties for the TimePicker component. */
export interface TimePickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'placeholder' | RoutedHandlers
> {
  /** Controlled selected time in `HH:mm` (24-hour) format; `''` for no time. */
  value?: string;
  /**
   * Initial time for uncontrolled usage (`HH:mm`).
   * @default ''
   */
  defaultValue?: string;
  /** Called with the new `HH:mm` value (`''` when cleared) whenever the selected time changes. */
  onValueChange?: (value: string) => void;
  /**
   * Time display format of the input and the options: `'12h'` (`1:30 PM`) or `'24h'` (`13:30`).
   * Without it, the times follow the hour cycle of the browser's language (`navigator.language`:
   * 12-hour in `en-US`, 24-hour in `en-GB` and many other locales). The server HTML and the
   * hydration render show 12-hour times, so hydration matches, and the picker switches to the
   * language's cycle right after; a picker mounted in the browser follows it from its first
   * render. Pass `format` for the same output on the server and in the browser (Fluent's
   * `hourCycle`).
   * @default the hour cycle of the browser's language (`'12h'` on the server and while hydrating)
   */
  format?: '12h' | '24h';
  /**
   * Shows and accepts seconds (Fluent UI's `showSeconds`): the value is `HH:mm:ss`, the input and
   * the options read `1:30:00 PM` or `13:30:00`, and typed seconds are kept (`2:00:15 PM`). The
   * options stay `step` minutes apart, on whole minutes. A controlled `value` of `HH:mm` still
   * selects its option and is reported back as `HH:mm:ss` when the user picks another. Without
   * it a time's seconds are dropped.
   * @default false
   */
  showSeconds?: boolean;
  /**
   * Text of a time, for the options and the input (Fluent UI's `formatDateToTimeString`, taking
   * the time as the picker's `HH:mm` or, with `showSeconds`, `HH:mm:ss` value rather than a
   * `Date`). It replaces `format`'s text, so the typed text is read by `parseTime` (the default
   * reader understands `13:30` and `1:30 PM`, which your format may not look like). An inline
   * function makes the options again on every render: keep its identity (a constant, or
   * `useCallback`). With it the message for text that is not a time (`labels.invalidTime`) is
   * given an example of the format, `formatTime('13:45')`, in place of the pattern.
   * @default the text of `format`
   */
  formatTime?: (value: string) => string;
  /**
   * Reads typed text into a time (Fluent UI's `validateFreeFormTime`, answering with the value
   * rather than an error type): return the `HH:mm` (or `HH:mm:ss`, `h:mm AM`) time the text
   * stands for, or `null` for text that is not a time, which is kept and reported as
   * `'unparseable'`. The time is still checked against `minTime`/`maxTime` (and the list, with
   * `freeform={false}`). Typing also filters the list by the options' labels and values. Pass it
   * with `formatTime` for a format the default reader does not know (`13h30`).
   * @default the reader of `13:30`, `13:30:15` and `1:30 PM`
   */
  parseTime?: (text: string) => string | null | undefined;
  /**
   * Whether a complete typed time that is not in the list can be selected (Fluent UI's
   * `freeform`, which defaults to `false` there). With `false` only the listed times can be: a
   * complete typed time that is not listed is kept and reported as `'not-listed'` (a time
   * outside `minTime`/`maxTime` is still `'out-of-range'`); picking an option, Enter on the
   * option typing made active and erasing the text work as before.
   * @default true
   */
  freeform?: boolean;
  /**
   * Minutes between options. A non-finite or non-positive value falls back to 30 (development
   * warning); fractions are floored.
   * @default 30
   */
  step?: number;
  /**
   * Earliest time (inclusive): `HH:mm`, `HH:mm:ss` or `h:mm AM`.
   * @default '00:00'
   */
  minTime?: string;
  /**
   * Latest time (inclusive): `HH:mm`, `HH:mm:ss` or `h:mm AM`. Invalid or reversed bounds give no
   * options (development warning, "No times available", see `labels`).
   * @default '23:59'
   */
  maxTime?: string;
  /**
   * Placeholder text shown when no time is selected.
   * @default 'Select a time'
   */
  placeholder?: string;
  /**
   * Whether the time picker is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /**
   * Size of the field: `small` (24px tall), `medium` (32px) or `large` (40px). Default: the
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`. The time
   * list keeps its size.
   */
  size?: CoreSize;
  /**
   * Advanced positioning of the popup (Fluent's `positioning`): `offset`, `fitViewport`,
   * `matchReferenceWidth` and `fallbackPlacements` (tried in order when the requested side has no
   * room). The popup opens below the field.
   * @default `{ matchReferenceWidth: true, fitViewport: true }`
   */
  positioning?: PopupPositioningOptions;
  /**
   * The popup surface's motion. By default it fades in and slides 4px away from the field, on the
   * side it opened on, over 200 ms with a decelerating curve, and fades out and slides back over
   * 100 ms with an accelerating curve (the time list stays in the surface while it exits); under
   * reduced motion it appears and disappears at once. The list does not fade out when its options
   * changed as it closed (a filter reset by the selection), nor does the status row. `null` turns
   * the motion off (the surface still renders its `data-presence` phases, which then end at
   * once); a class string or `{ className }` replaces the default classes with yours (see
   * `MotionSlot`), also under a `WaveProvider` with `motion="none"`, which otherwise turns the
   * default off. Fluent's popup `surfaceMotion`.
   * @default the fade and slide above
   */
  motion?: MotionSlot | null;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
  /**
   * Makes the input read-only: the list does not open and the value cannot change. Turning it (or
   * `disabled`) on while the user is typing drops the typed text.
   */
  readOnly?: boolean;
  /**
   * Whether to show a clear button when a time is selected (not shown while `readOnly`; shown
   * disabled while `disabled`). It is a tab stop after the input. Tab from erased text clears the
   * value before focus moves, so focus goes on past the clear button that disappears with it.
   * @default false
   */
  clearable?: boolean;
  /**
   * The glyph of the expand button at the end of the input (default: a chevron). The button
   * opens and closes the list without moving focus out of the input and is not a tab stop
   * (Alt+ArrowDown opens the list from the keyboard). `null` or `undefined` keep the chevron;
   * `false`, or a value that renders nothing, hides the button. Decorative content rendered
   * inside the built-in button: a `<button>` or `Button` passed here is not nested (its children
   * become the glyph, with a development warning).
   */
  expandIcon?: Slot<'span'>;
  /**
   * Renders only the options in view of a long list of times (a step of one minute makes 1,440),
   * plus an overscan, and spacers (`aria-hidden`, `data-virtual-spacer`) as tall as the options
   * they stand for: pass the result of `useVirtualWindow({ itemSize })`, or an object of your own
   * that implements `VirtualWindow`. The open list is the window's scroller (it scrolls within its
   * own maximum height, 15rem), has no block padding while windowed, and no scroll anchoring of
   * the browser; every option is exactly `itemSize` tall (the default option with one line of
   * text is 32 pixels tall). The window counts the listed options: typing
   * narrows it, as it narrows `aria-setsize`. The keys move over all of them, the active option
   * stays rendered while it is scrolled away, and opening the list scrolls the active option, else
   * the selected one, to the middle. A closed list renders no option. The server renders no list.
   */
  virtualWindow?: VirtualWindow;
  /**
   * Controlled open state of the list (never shown while `disabled` or `readOnly`). The list
   * renders only in the browser: an open picker is closed in the server HTML and opens once it has
   * hydrated.
   */
  open?: boolean;
  /**
   * Initial open state of the list for uncontrolled usage. A picker that starts disabled or
   * read-only starts closed. The list renders only in the browser: it is closed in the server HTML
   * and opens once the picker has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the list opens or closes (only when the state changes). */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called when edited text is not accepted on Enter or blur (once per edit): it is not a time
   * (`'unparseable'`) or lies outside `minTime`/`maxTime` (`'out-of-range'`). The text stays in the
   * input, which is marked `aria-invalid` and described by an error message (left to the
   * surrounding `Field` when it shows an error); Enter and leaving the input also close the list,
   * so it does not cover the message. Enter reports it again when pressed again.
   */
  onInvalidInput?: (text: string, reason: TimePickerInvalidReason) => void;
  /**
   * Names of the clear and expand buttons and of the list, the status texts of an empty list and
   * the error messages of rejected text, for localization. Unset members keep their English
   * defaults.
   */
  labels?: TimePickerLabels;
  /** Form field name: the `HH:mm` value is submitted under it (hidden input). */
  name?: string;
  /** Id of the `<form>` the value belongs to, when the picker is outside it. */
  form?: string;
  /**
   * Blocks form submission while no time is selected; sets `aria-required` on the input. Like a
   * native readonly input, a `readOnly` TimePicker does not block submission.
   */
  required?: boolean;
  /** Native `autocomplete` of the input. @default 'off' */
  autoComplete?: string;
  /** Native `maxlength` of the input. */
  maxLength?: number;
  /** Focus handler of the text input (the root keeps the other handlers). */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Blur handler of the text input. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Key handler of the text input; `preventDefault()` skips the picker's own keys. */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Key handler of the text input. */
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  /**
   * Ref to the text input, the `role="combobox"` element and the focusable control (Fluent UI's
   * `ref`, on its primary element). The root `<div>` is `slotProps.root.ref`.
   */
  ref?: React.Ref<HTMLInputElement>;
  /**
   * Props for the elements the TimePicker draws, by part, merged into each part's own (Fluent UI's
   * `root`, `input`, `clearIcon`, `expandIcon` and `listbox` slot props): your classes after the
   * part's (yours win a conflict), your styles over its styles, your handlers before its handlers
   * (`preventDefault()` in yours skips the TimePicker's handling of the event, its own `on…` prop
   * included), your ref beside its ref, and your ids added to its `aria-labelledby` and
   * `aria-describedby`. Every attribute the TimePicker sets on a part is locked and keeps the
   * TimePicker's value (set it through its own props); you add the attributes it does not set. A
   * part takes no `children`.
   */
  slotProps?: {
    /**
     * The root `<div>` around the input and its buttons, the error message and the list while
     * closed (stable class `wave-time-picker`), which the TimePicker's `className`, `style`,
     * `data-*` and other root props reach as well; its `ref` is the way to the root, since the
     * TimePicker's `ref` reaches the input. Your classes come after the TimePicker's `className`,
     * your style over its `style`. Locked: every prop you give the TimePicker itself that reaches
     * the root, `data-size`, `data-appearance`, and `hidden`, `inert` and `aria-hidden` (the
     * TimePicker's own: the root holds the input). Also locked, unset: `role`, `tabIndex` and the
     * roving markers (`data-roving-container`, `data-roving-disabled`, `data-roving-value`,
     * `aria-disabled`), so in a toolbar or another roving container the root is never a control of
     * its own and never hides the control from the arrow order. Your handlers run before the
     * TimePicker's own root handlers (`preventDefault()` in yours skips them). The root passes no
     * click to the input, so your `onClick` is called in every state, as the TimePicker's own
     * `onClick` is. Your ref joins the TimePicker's own, which keeps a press inside the root from
     * dismissing the open list.
     */
    root?: SlotPart<'div'>;
    /**
     * The `<input role="combobox">`, the focusable control (stable class
     * `wave-time-picker__input`; the TimePicker's `ref` reaches it as well). Locked: `type`,
     * `role`, `value` (and, unset, `defaultValue`: the TimePicker controls the text), `id`, the
     * naming, Field and listbox wiring (`aria-label`, `aria-invalid`, `aria-required`,
     * `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-haspopup`,
     * `aria-autocomplete`, `aria-errormessage`, `aria-details`), `disabled`, `readOnly`,
     * `placeholder`, every text input prop routed to it (`autoComplete`, `maxLength`,
     * `tabIndex`, …), `name`, `form` and `required` (the value is submitted by the TimePicker's
     * hidden input), `hidden`, `inert` and `aria-hidden` (a focusable control is never hidden).
     * Your handlers run before the TimePicker's: `preventDefault()` in your `onChange` ignores
     * the typed text, in your `onKeyDown` skips the picker's keys, in your `onBlur` keeps the
     * typed text uncommitted.
     */
    input?: SlotPart<'input'>;
    /**
     * The clear `<button>`, rendered with `clearable` while a time is selected (stable class
     * `wave-time-picker__clear-button`). Locked: `type`, `aria-label` (`labels.clear`),
     * `disabled`, `tabIndex`, `aria-disabled`, `hidden`, `inert` and `aria-hidden`. Your
     * `onClick` runs before the clear (`preventDefault()` skips it).
     */
    clearButton?: SlotPart<'button'>;
    /**
     * The expand `<button>` at the end of the input, rendered while `expandIcon` shows it (stable
     * class `wave-time-picker__expand-button`; `expandIcon` is its glyph). Locked: `type`,
     * `tabIndex` (never a tab stop), `aria-label` (`labels.expand`), `aria-expanded`,
     * `aria-controls`, `disabled` and `aria-disabled`. Your `onClick` runs before the toggle
     * (`preventDefault()` skips it).
     */
    expandButton?: SlotPart<'button'>;
    /**
     * The `<p role="alert">` that describes rejected text, rendered while the TimePicker shows its
     * own error (stable class `wave-time-picker__error-message`). Locked: `id`, which describes
     * the input, and `role`.
     */
    errorMessage?: SlotPart<'p'>;
    /**
     * The `<ul role="listbox">` of times, in the popup while it shows and hidden in place
     * otherwise (stable class `wave-time-picker__listbox`). Locked: `id`, `role`, `tabIndex`,
     * `hidden`, `inert`, `aria-hidden`, `aria-multiselectable`, `aria-activedescendant` and
     * `aria-label`; your `aria-labelledby` ids join the list's name.
     */
    listbox?: SlotPart<'ul'>;
    /**
     * Every `<li role="option">` of a time (stable class `wave-time-picker__option`). Locked:
     * `id`, `role`, `aria-selected`, `hidden`, the state attributes (`data-active`,
     * `data-selected`, `aria-disabled`, `data-disabled`) and the position attributes
     * (`aria-posinset`, `aria-setsize`), also while the option has none. Your `onClick` runs
     * before the selection (`preventDefault()` skips it).
     * Keep the object's identity across renders (a constant, or `useMemo`): the options skip
     * re-rendering only while it stays the same.
     */
    option?: SlotPart<'li'>;
    /**
     * The `<span>` of every option that holds the check glyph while the time is selected (stable
     * class `wave-time-picker__check-icon`). Keep its identity across renders, as `option`'s.
     */
    checkIcon?: SlotPart<'span'>;
    /**
     * The popup `<div>` around the list or the status row, rendered in a portal while the list
     * is open (stable class `wave-time-picker__surface`). Locked: `data-state`, `data-presence`,
     * `inert` while it exits, `data-side`, `data-align`, `role`, `id`, `hidden` and
     * `aria-hidden`; your `style` merges, but the position, the size limits and the visibility
     * the positioning sets win.
     */
    surface?: SlotPart<'div'>;
    /**
     * The status row of the open popup while no time is listed ("No matching times", "No times
     * available"; stable class `wave-time-picker__empty-message`). Locked: `aria-hidden` (a
     * status region announces the text) and `tabIndex` (unset: it is never a tab stop).
     */
    emptyMessage?: SlotPart<'div'>;
  };
}

/** The browser's language; `undefined` where there is no `navigator` (the runtime default). */
function browserLanguage(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.language;
}

/** Whether an option matches the (trimmed, lower-case) typed text: by label or `HH:mm` value. */
function matchesQuery(item: ListboxItem, text: string): boolean {
  return item.label.toLowerCase().includes(text) || item.value.includes(text);
}

/** Whether an option's label or `HH:mm` value starts with the (trimmed, lower-case) typed text. */
function startsWithQuery(item: ListboxItem, text: string): boolean {
  return item.label.toLowerCase().startsWith(text) || item.value.startsWith(text);
}

/**
 * A time input with a filterable list of times (APG editable combobox with list autocomplete).
 *
 * - Type to filter (by label or `HH:mm` value). A complete typed time (`2:00 PM`, `14:00`) makes
 *   its own option active — not an earlier one that merely contains the text, such as `12:00 PM`
 *   — and partial text makes the first option that starts with it active (`2:00 p` -> `2:00 PM`),
 *   else the first one that contains it; Enter commits the active option. Enter or leaving the
 *   field also commits a complete typed time that is not in the list (`9:15 AM`, `14:45`) when it
 *   lies within `minTime`/`maxTime`, and erased text clears the value (as the clear button does);
 *   Enter never submits the form with edited text, and both close the list. Other typed text is
 *   kept: the input is marked invalid and an error message describes it (`onInvalidInput`,
 *   reported once per edit) until the text is edited or replaced (an option, the clear button,
 *   Escape, a form reset, a new value from the parent). Escape on a closed list reverts any edit,
 *   erased text included, to the selected time.
 * - Click the input or the expand button at its end (a chevron, see `expandIcon`; not a tab stop,
 *   and it leaves focus in the input), press ArrowDown/ArrowUp or type to open; the list opens
 *   with every option and the selected one (when it is in the list) active and scrolled into
 *   view. Without one, no option is active until ArrowDown/ArrowUp or typing, so Enter lets the
 *   surrounding form submit. Escape, Tab, an outside press or focus leaving closes it. Typed text
 *   kept after Escape closed the list still filters it when it reopens: a click resumes the option
 *   typing made active, ArrowDown/ArrowUp start at the first/last match.
 * - `open`/`defaultOpen`/`onOpenChange` control the list. It closes when the picker becomes
 *   disabled or read-only (uncontrolled `open`: it stays closed when the picker is enabled again),
 *   and the text typed until then is dropped.
 * - Keys of an IME composition (its confirming Enter included) are left to the IME.
 * - `clearable` shows a clear button while a time is selected (not while read-only), a tab stop
 *   after the input. Tab from erased text clears the value first, so focus moves on past the
 *   picker instead of to the clear button that disappears.
 * - The value is `HH:mm` (24-hour) whatever the display `format`; values off the `step` grid or
 *   outside the bounds are still displayed in `format`. Without `format` the times follow the
 *   hour cycle of the browser's language; the server HTML and the hydration render show 12-hour
 *   times, so a server-rendered app passes `format` for the same output on the server.
 * - `showSeconds` adds seconds (the value becomes `HH:mm:ss`); `formatTime` and `parseTime` replace
 *   how times are written and read; `freeform={false}` limits the selection to the listed times
 *   (a complete typed time that is not listed is `'not-listed'`).
 * - **Size and appearance**: `size` resolves from its own prop, then the surrounding `Field`'s
 *   `size`, then `WaveProvider inputDefaults.size`, else `'medium'`; `appearance` from its own
 *   prop, then `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as
 *   `data-size` and `data-appearance` on the root `<div>`. The time list keeps its size.
 * - The input receives `ref`, `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 *   `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`,
 *   `autoFocus`, `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp` and the text input attributes
 *   `autoComplete`, `autoCapitalize`, `autoCorrect`, `maxLength`, `inputMode`, `spellCheck` and
 *   `enterKeyHint`. `className`, `style`, other `aria-*` attributes and the remaining props stay
 *   on the root `<div>` (`slotProps.root.ref` reaches it). Inside a `Field`, the input is
 *   labelled and described by it.
 * - `name`/`required` add a hidden input for native forms (`HH:mm`); the value resets with its form.
 * - The built-in names, status texts and error messages are English; `labels` localizes them.
 * - The open list renders only in the browser: an open list (`defaultOpen`, `open`) is closed in
 *   the server HTML and opens once the picker has hydrated.
 */
export const TimePicker = (props: TimePickerProps) => {
  const appClassName = useAppClassName(timePickerClassNames.root);

  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    format: formatProp,
    showSeconds = false,
    formatTime,
    parseTime,
    freeform = true,
    step = DEFAULT_TIME_STEP,
    minTime = '00:00',
    maxTime: maxTimeProp,
    placeholder = 'Select a time',
    disabled = false,
    size: sizeProp,
    positioning,
    motion,
    appearance: appearanceProp,
    readOnly,
    clearable = false,
    expandIcon,
    virtualWindow,
    open: openProp,
    defaultOpen,
    onOpenChange,
    onInvalidInput,
    labels,
    name,
    form,
    required,
    autoComplete = 'off',
    autoCapitalize,
    autoCorrect,
    maxLength,
    enterKeyHint,
    inputMode,
    spellCheck,
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
    className,
    style,
    ref,
    slotProps,
    ...rest
  } = props;

  const { size, appearance } = useInputLook(sizeProp, appearanceProp);

  // `false` on the server and while hydrating, `true` in every other client render.
  const isClient = useIsClient();
  // Without `format` the times follow the browser language's hour cycle (1.0). The server HTML
  // and the hydration render show 12-hour times, so hydration matches; the render after it
  // switches (derived during render, C-HOOKS). Read once per picker, not on every keystroke.
  const followsLocale = formatProp === undefined && isClient;
  const localeFormat = React.useMemo<TimeFormat>(
    () => (followsLocale ? localeTimeFormat(browserLanguage()) : '12h'),
    [followsLocale],
  );
  const format = formatProp ?? localeFormat;
  // The latest time of the day: with seconds the default runs to the last second.
  const maxTime = maxTimeProp ?? (showSeconds ? '23:59:59' : '23:59');

  /* ---- reading and writing times ---------------------------------- */

  // Seconds since midnight of a time in any spelling of the default reader, whole minutes
  // without `showSeconds`; `NaN` when it is no time.
  const readTime = React.useCallback(
    (text: string) => {
      const seconds = timeToSeconds(text);
      return showSeconds ? seconds : Math.floor(seconds / 60) * 60;
    },
    [showSeconds],
  );
  // Typed text: through `parseTime` when given, whose answer is read as any time.
  const readTyped = React.useCallback(
    (text: string) => {
      if (!parseTime) return readTime(text);
      const read = parseTime(text);
      return typeof read === 'string' ? readTime(read) : NaN;
    },
    [parseTime, readTime],
  );
  const toValue = (seconds: number) => secondsToValue(seconds, showSeconds);
  /** The text of a `HH:mm[:ss]` value; a value that is no time shows as it is. */
  const displayTime = (value: string): string => {
    const seconds = readTime(value);
    if (Number.isNaN(seconds)) return value;
    return formatTime ? formatTime(toValue(seconds)) : secondsToTime(seconds, format, showSeconds);
  };

  const [selectedValue, setSelectedValue] = useControllable<string>(
    valueProp,
    defaultValue ?? '',
    onValueChange,
  );

  /* ---- options, step and bounds ---------------------------------- */

  const stepValid = normalizeTimeStep(step).valid;
  const minSeconds = readTime(minTime);
  const maxSeconds = readTime(maxTime);
  const boundsValid =
    !Number.isNaN(minSeconds) && !Number.isNaN(maxSeconds) && minSeconds <= maxSeconds;
  const allOptions = React.useMemo(
    () => generateTimeOptions(step, minTime, maxTime, format, { showSeconds, formatTime }),
    [step, minTime, maxTime, format, showSeconds, formatTime],
  );

  // Once per invalid value and page (C-DEV), not once per instance and effect run.
  React.useEffect(() => {
    if (!stepValid) {
      warnOnce(
        `TimePicker:step:${String(step)}`,
        `TimePicker: \`step\` must be a positive number of minutes (received ${String(step)}); ` +
          `using ${DEFAULT_TIME_STEP}.`,
      );
    }
  }, [step, stepValid]);

  React.useEffect(() => {
    if (!boundsValid) {
      warnOnce(
        `TimePicker:bounds:${minTime}|${maxTime}`,
        `TimePicker: \`minTime\`/\`maxTime\` must be times such as "09:00", "09:00:00" or ` +
          `"9:00 AM" with minTime <= maxTime (received "${minTime}" / "${maxTime}"); no times are available.`,
      );
    }
  }, [minTime, maxTime, boundsValid]);

  /* ---- open state, draft text and query -------------------------- */

  const interactive = !disabled && !readOnly;
  const [openState, setOpen, openControlled] = useControllable<boolean>(
    openProp,
    // A picker that starts disabled or read-only never shows its list, so it starts closed (no
    // close to report later).
    (defaultOpen ?? false) && interactive,
    onOpenChange,
  );
  // The open list lives in a portal, which renders only in the browser: until then (the server
  // HTML, hydration) the picker shows the closed inline list and reports it closed, so
  // aria-controls and aria-activedescendant never name a missing element.
  const open = openState && interactive && isClient;
  // A list hidden because the picker became disabled or read-only is closed for good
  // (uncontrolled), so enabling the picker again does not bring it back; onOpenChange(false)
  // reports it (a consumer callback, so from an effect). A controlled `open` stays the parent's.
  React.useEffect(() => {
    if (!interactive && openState && !openControlled) setOpen(false);
  }, [interactive, openState, openControlled, setOpen]);
  /** Typed text; `null` shows the selected time's label (draft model). */
  const [draft, setDraft] = React.useState<string | null>(null);
  /** Why the typed text was rejected (it is kept and flagged); `null` while it is not. */
  const [invalid, setInvalid] = React.useState<TimePickerInvalidReason | null>(null);
  // Locking the picker while the user types drops the typed text and its error, so no later blur
  // commits it (adjusted during render, C-HOOKS).
  const [wasInteractive, setWasInteractive] = React.useState(interactive);
  if (wasInteractive !== interactive) {
    setWasInteractive(interactive);
    if (!interactive) {
      setDraft(null);
      setInvalid(null);
    }
  }
  // A new value from the parent replaces rejected text (the picker's own commits clear it
  // themselves), so the input never shows an error next to a valid value. Text the user is still
  // typing stays.
  const [seenValue, setSeenValue] = React.useState(selectedValue);
  if (seenValue !== selectedValue) {
    setSeenValue(selectedValue);
    if (invalid !== null) {
      setDraft(null);
      setInvalid(null);
    }
  }
  /**
   * Filter text: the typed text only, never the selected time's label, so opening without an edit
   * shows every option. Typed text kept while the list is closed (Escape) keeps filtering it, so
   * a reopened list shows what the input says.
   */
  const query = draft ?? '';

  const openList = () => {
    if (!interactive || open) return;
    setOpen(true);
  };
  const closeList = () => setOpen(false);

  // A complete time in any spelling the commit accepts (`2:00pm`, `09:00 AM`, `14:00:00`) keeps its
  // own option, so it stays listed and active, as Enter and blur commit it.
  const typedValue = React.useMemo(() => {
    const seconds = readTyped(query.trim());
    return Number.isNaN(seconds) ? null : secondsToValue(seconds, showSeconds);
  }, [query, readTyped, showSeconds]);
  const filter = React.useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return undefined;
    return (item: ListboxItem) => item.value === typedValue || matchesQuery(item, text);
  }, [query, typedValue]);

  /**
   * The option that typing `text` makes active. A complete time (`2:00 PM`, `14:00`) activates its
   * own option, never another one that merely contains the text (`12:00 PM`); when it is not in
   * the list (off-grid or out of bounds) nothing is active, so Enter commits the typed time or
   * nothing. Partial text activates the first option whose label or value starts with it (`2:00 p`
   * -> `2:00 PM`, `2` -> `2:00 AM`, not `12:00 AM`), else the first option that contains it.
   */
  const getTypedActiveValue = (text: string): string | null => {
    const needle = text.trim().toLowerCase();
    if (!needle) return null;
    const seconds = readTyped(text);
    if (!Number.isNaN(seconds)) {
      const exact = toValue(seconds);
      return allOptions.some((item) => item.value === exact) ? exact : null;
    }
    const match =
      allOptions.find((item) => startsWithQuery(item, needle)) ??
      allOptions.find((item) => matchesQuery(item, needle));
    return match?.value ?? null;
  };

  // Opening without typing activates the selected option only when it is in the list. An empty,
  // off-grid or out-of-range value activates nothing (ArrowDown/ArrowUp start at the first/last
  // option), so Enter on a freshly opened list commits nothing and the surrounding form submits.
  // With seconds a controlled `HH:mm` selects its `HH:mm:ss` option.
  const selectedKey = React.useMemo(() => {
    if (!showSeconds || !selectedValue) return selectedValue;
    const seconds = timeToSeconds(selectedValue);
    return Number.isNaN(seconds) ? selectedValue : secondsToValue(seconds, true);
  }, [selectedValue, showSeconds]);
  const selectedInList =
    selectedKey !== '' && allOptions.some((item) => item.value === selectedKey);

  const selectedValues = React.useMemo(() => (selectedKey ? [selectedKey] : []), [selectedKey]);

  const commitValue = (next: string) => {
    setSelectedValue(next);
    setDraft(null);
    setInvalid(null);
  };

  /**
   * Commits the typed text: erased text clears the value, a complete time within the bounds selects
   * it. Returns why any other text is not accepted (it is kept), else `null`.
   */
  const commitDraft = (text: string): TimePickerInvalidReason | null => {
    if (!text.trim()) {
      commitValue('');
      return null;
    }
    const seconds = readTyped(text);
    if (Number.isNaN(seconds)) return 'unparseable';
    if (!boundsValid || seconds < minSeconds || seconds > maxSeconds) return 'out-of-range';
    const value = toValue(seconds);
    if (!freeform && !allOptions.some((item) => item.value === value)) return 'not-listed';
    commitValue(value);
    return null;
  };

  /** Keeps rejected text, flags it and reports it. */
  const rejectDraft = (text: string, reason: TimePickerInvalidReason) => {
    setInvalid(reason);
    onInvalidInput?.(text, reason);
  };

  const clearDraft = () => {
    setDraft(null);
    setInvalid(null);
  };

  // The listbox counts as open only while it shows options: with no match nothing is displayed,
  // so `aria-expanded` is false and Escape reverts the typed text instead of closing an empty list.
  const hasMatches = React.useMemo(
    () => (filter ? allOptions.some(filter) : allOptions.length > 0),
    [allOptions, filter],
  );
  const expanded = open && hasMatches;

  const lb = useListbox({
    open: expanded,
    onOpenChange: (next) => (next ? openList() : closeList()),
    mode: 'editable',
    selectedValues,
    onSelect: (next) => commitValue(next),
    items: allOptions,
    filter,
    // An active option that the window does not render: scrolled to by its index among the shown
    // options, the window's count.
    onScrollToItem: virtualWindow
      ? (index) => virtualWindow.scrollToIndex(index, { align: 'auto' })
      : undefined,
    // Typing sets the active option itself (getTypedActiveValue in handleInputChange), so an exact
    // typed time wins over an earlier substring match; highlightOnFilter would force the first one.
    autoHighlight: draft === null && selectedInList ? 'selected' : false,
    idPrefix: 'timepicker-listbox',
    // Escape on a closed list reverts typed text (erased text: handleKeyDown); without a draft it is
    // left to enclosing layers.
    onClearDraft:
      draft !== null
        ? () => {
            clearDraft();
            closeList();
          }
        : undefined,
  });

  // The window scrolls the shown list only (the closed list in place is another, hidden element).
  const listScrollRef = useMergedRefs<HTMLUListElement>(
    expanded ? virtualWindow?.scrollRef : undefined,
  );
  useShownListScroll(
    expanded,
    virtualWindow,
    lb.items,
    lb.activeValue,
    selectedValue ? [selectedValue] : [],
  );
  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const renderWindowOption = React.useCallback(
    (item: ListboxItem) => (
      <TimePickerOption
        value={item.value}
        label={item.label}
        part={slotProps?.option}
        checkIconPart={slotProps?.checkIcon}
      />
    ),
    [slotProps?.option, slotProps?.checkIcon],
  );

  const displayLabel = selectedValue
    ? (lb.getItem(selectedKey)?.label ?? displayTime(selectedValue))
    : '';
  // Read-only pickers offer no clear action (the value cannot change).
  const showClear = clearable && !readOnly && selectedValue !== '';
  const statusMessage =
    open && !hasMatches
      ? allOptions.length === 0
        ? (labels?.noTimes ?? 'No times available')
        : (labels?.noMatches ?? 'No matching times')
      : '';

  /* ---- elements, dismissal, positioning --------------------------- */

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  // The root part's ref joins the root's own (the dismissal reads it) through a merged ref set
  // after the part's props, so an inline part ref never detaches the root's own.
  const rootRefs = useMergedRefs<HTMLDivElement>(rootRef, slotProps?.root?.ref);
  const inputRefs = useMergedRefs<HTMLInputElement>(ref, inputRef, slotProps?.input?.ref);

  const { layerId } = useDismiss({
    open,
    onDismiss: closeList,
    refs: [surfaceRef, rootRef],
    anchorRef: inputRef,
    kind: 'listbox',
    focusOutside: true,
  });

  const { setReference, setFloating, floatingProps, isPositioned } = usePopupPosition({
    open,
    side: 'bottom',
    align: 'start',
    ...resolvePositioning(positioning, { matchReferenceWidth: true, fitViewport: true }),
  });
  // The popup surface mounts through the presence core (the list stays in it while it exits) and
  // enters once it has its position, so a popup that flips enters on the side it ends up on.
  const motionClassName = useMotionClasses(motion, popupMotion);
  const popup = usePickerSurfacePresence(open ? (hasMatches ? 'list' : 'empty') : null, lb.items, {
    placed: isPositioned,
    hold: motionClassName === popupMotion,
  });
  const surfaceRefs = useMergedRefs<HTMLDivElement>(
    surfaceRef,
    setFloating,
    slotProps?.surface?.ref,
    popup.ref,
  );

  /* ---- forms and Field ------------------------------------------- */

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  // Like a native readonly input, a read-only picker is barred from constraint validation (the
  // user could not fix it); its value is still submitted.
  const validates = isRequired && !readOnly;
  const errorId = useId('timepicker-error');
  // A Field that shows an error describes the input itself (its message is not repeated).
  const showOwnError = invalid !== null && !field?.hasErrorMessage;
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': joinIds(ariaDescribedBy, showOwnError ? errorId : undefined),
    'aria-invalid': invalid !== null ? true : ariaInvalid,
    // An explicit `required={false}` wins over a required Field, so aria-required matches
    // `isRequired`.
    'aria-required': ariaRequired ?? required,
  });
  const invalidLook = isInvalidLook(false, fieldProps['aria-invalid']);

  useFormReset(
    inputRef,
    () => {
      setSelectedValue(defaultValue ?? '');
      clearDraft();
      closeList();
    },
    form,
  );

  /* ---- handlers --------------------------------------------------- */

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!interactive) return;
    const text = event.target.value;
    setDraft(text);
    setInvalid(null);
    if (!open) setOpen(true);
    // Every edit re-ranks the highlight (it opens the list in the same update when closed).
    lb.setActiveValue(getTypedActiveValue(text));
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!interactive) return;
      // Enter commits the active option: the exact typed time, the first match of partial text,
      // or the option moved to with the arrow keys.
      lb.onKeyDown(event);
      // Keys that belong to an IME composition (its confirming Enter) are left to the IME, as
      // useListbox leaves them.
      if (event.defaultPrevented || event.nativeEvent.isComposing) return;
      if (event.key === 'Escape' && draft === '' && displayLabel !== '') {
        // Erased text: useListbox calls onClearDraft only while the input has text, so Escape on a
        // closed list restores the selected time here (an open list was closed above). With nothing
        // to restore, Escape is left to enclosing layers.
        event.preventDefault();
        clearDraft();
        closeList();
        return;
      }
      if (event.key === 'Enter' && draft !== null) {
        // Edited text is committed (a complete time within the bounds; erased text clears) or kept
        // and flagged (reported on every Enter), never submitted with the form; untouched text
        // lets Enter submit. The list closes either way, so it does not cover the error message.
        event.preventDefault();
        const reason = commitDraft(draft);
        closeList();
        if (reason !== null) rejectDraft(draft, reason);
      }
      if (event.key === 'Tab' && !event.shiftKey && showClear && draft !== null && !draft.trim()) {
        // Erased text clears the value, and with it the clear button, the next tab stop. It is
        // settled before Tab moves focus (the blur would settle it while focus moves to that
        // button), so focus moves on to the tab stop after the picker instead of dropping to
        // <body> with the button (C-DISABLED).
        flushSync(() => commitDraft(draft));
      }
      if (event.key === 'Tab' && open && !expanded) {
        // useListbox closes the list on Tab only while it shows options. The status text shown
        // instead ('No matching times', 'No times available') closes too: the clear button, the
        // next tab stop, is inside the picker, so focus moving there does not dismiss it.
        closeList();
      }
    },
  );
  const handleKeyUp = composeEventHandlers(onKeyUp, lb.onKeyUp);

  const handleInputClick = () => {
    if (!interactive || open) return;
    openList();
    // Typed text kept after Escape resumes where typing left it: its matches (the filter) and the
    // option typing made active, so Enter commits the same time as before the list closed.
    if (draft !== null) lb.setActiveValue(getTypedActiveValue(draft));
  };

  const handleBlur = composeEventHandlers(onBlur, () => {
    if (!interactive || draft === null) return;
    // Leaving the input settles the edit as Enter does: rejected text is kept (text that was
    // already rejected is not reported again) and the list closes either way, so it does not cover
    // the error message.
    const reason = invalid === null ? commitDraft(draft) : null;
    closeList();
    if (reason !== null) rejectDraft(draft, reason);
  });

  // The expand button opens the list as a click in the input does (typed text kept after Escape
  // resumes its matches) and closes it; focus stays in (or returns to) the input.
  const handleExpandClick = () => {
    if (!interactive) return;
    if (open) closeList();
    else handleInputClick();
    inputRef.current?.focus();
  };

  // An event callback, so the part props merged during render hold no function that reads a ref.
  const handleClear = useEventCallback(() => {
    if (!interactive) return;
    commitValue('');
    inputRef.current?.focus();
  });

  /* ---- render ---------------------------------------------------- */

  const listboxLabelledBy = joinIds(ariaLabelledBy, field?.labelId);
  const renderListbox = (hidden: boolean, items: typeof lb.items = lb.items) => (
    <ul
      {...mergeSlotProps(slotProps?.listbox, {
        className: wcn(
          timePickerClassNames.listbox,
          // A window counts the options from the top of the list: no block padding, and the
          // browser's scroll anchoring only fights the window.
          virtualWindow
            ? 'wave:max-h-60 wave:min-h-0 wave:overflow-auto wave:[overflow-anchor:none] wave:focus:outline-hidden'
            : 'wave:max-h-60 wave:min-h-0 wave:overflow-auto wave:py-1 wave:focus:outline-hidden',
        ),
        ref: virtualWindow ? listScrollRef : undefined,
        locked: {
          inert: undefined,
          'aria-hidden': undefined,
          // The list props carry these only while set: a part sets neither.
          'aria-activedescendant': undefined,
          'aria-multiselectable': undefined,
          ...lb.getListboxProps(),
          'aria-labelledby': listboxLabelledBy,
          'aria-label': listboxLabelledBy ? undefined : (ariaLabel ?? labels?.list ?? 'Times'),
          hidden: hidden || undefined,
        },
      })}
    >
      {virtualWindow
        ? // The options of the window while the list shows; the closed list needs none.
          !hidden &&
          renderListboxWindow(
            items,
            virtualWindow,
            {
              selected: selectedSet,
              activeValue: lb.activeValue,
              renderOption: renderWindowOption,
            },
            timePickerClassNames.spacer,
          )
        : items.map((item) => (
            <TimePickerOption
              key={item.value}
              value={item.value}
              label={item.label}
              part={slotProps?.option}
              checkIconPart={slotProps?.checkIcon}
            />
          ))}
    </ul>
  );

  const showExpand = showsExpandButton(expandIcon);

  let errorMessage = '';
  if (showOwnError && invalid === 'unparseable') {
    // The pattern of the format; a `formatTime` of your own has none, so it gets an example.
    const pattern = formatTime
      ? formatTime(showSeconds ? '13:45:30' : '13:45')
      : `${format === '24h' ? 'HH:mm' : 'h:mm'}${showSeconds ? ':ss' : ''}${format === '24h' ? '' : ' AM'}`;
    errorMessage = (labels?.invalidTime ?? defaultInvalidTimeLabel)(pattern);
  } else if (showOwnError && invalid === 'not-listed') {
    errorMessage = labels?.notListed ?? 'Choose a time from the list.';
  } else if (showOwnError) {
    // Bounds the consumer did not set are `undefined`, not the defaults.
    errorMessage = (labels?.outOfRange ?? defaultOutOfRangeLabel)(
      props.minTime === undefined ? undefined : displayTime(minTime),
      maxTimeProp === undefined ? undefined : displayTime(maxTime),
    );
  }
  // aria-controls must name a listbox that is actually mounted. The closed list is inline only
  // while options exist; the open list is mounted only while something matches.
  const listboxMounted = open ? hasMatches : allOptions.length > 0;

  const { style: positionStyle, ...placement } = floatingProps;
  const surfaceProps = mergeSlotProps(slotProps?.surface, {
    className: wcn(
      timePickerClassNames.surface,
      'wave:flex wave:flex-col wave:overflow-hidden wave:rounded wave:border wave:border-border wave:bg-background wave:shadow-8',
      motionClassName,
    ),
    locked: {
      ...placement,
      'data-state': popup.exiting ? 'closed' : 'open',
      // The presence phase, and `inert` while the surface exits (a part cannot pretend otherwise).
      'data-presence': popup.presenceProps['data-presence'],
      inert: popup.presenceProps.inert,
      role: undefined,
      id: undefined,
      hidden: undefined,
      'aria-hidden': undefined,
    },
  });
  // A part's style merges, but the position, the size limits and the visibility the positioning
  // sets win.
  const surfaceStyle = lockPositionStyle(surfaceProps.style, positionStyle);

  const rootProps = mergeSlotProps(slotProps?.root, {
    className: wcn(
      timePickerClassNames.root,
      'wave:relative wave:inline-flex wave:flex-col',
      appClassName,
      className,
    ),
    style,
    locked: {
      'data-size': size,
      'data-appearance': appearance,
      // In a toolbar or another roving container the root holds a control of its arrow order: a
      // part makes it no composite that hides the control, no item and no second tab stop.
      ...ROVING_PART_LOCKS,
      // The TimePicker's own root props, after the data attributes as in 0.18, and over the
      // part's; the root holds the input, so only they hide it or take it out of reach.
      ...rest,
      hidden: rest.hidden,
      inert: rest.inert,
      'aria-hidden': rest['aria-hidden'],
    },
  });

  return (
    <ListboxContext.Provider value={lb.context}>
      <div {...rootProps} ref={rootRefs}>
        <div ref={setReference} className="wave:relative wave:flex wave:items-center">
          <input
            {...mergeSlotProps(slotProps?.input, {
              className: wcn(
                timePickerClassNames.input,
                inputHeightClasses[size],
                'wave:w-full',
                inputPaddingClasses[size],
                inputTextClasses[size],
                inputAppearanceClasses[appearance],
                'wave:text-foreground wave:placeholder:text-muted-foreground',
                inputFocus,
                disabledStyles,
                invalidLook && inputInvalid,
                pickerEndPadding(Number(showClear) + Number(showExpand), size),
              ),
              locked: {
                type: 'text',
                // The combobox props carry these only while set (an active option): a part sets
                // neither.
                'aria-activedescendant': undefined,
                'aria-autocomplete': undefined,
                ...lb.getComboboxProps(),
                'aria-controls': listboxMounted ? lb.listboxId : undefined,
                ...fieldProps,
                // The routed naming and Field attributes, set only through the TimePicker's own
                // props.
                ...fieldLocks(fieldProps),
                'aria-errormessage': ariaErrorMessage,
                'aria-details': ariaDetails,
                value: draft ?? displayLabel,
                // Controlled: a part's default value would only make React warn.
                defaultValue: undefined,
                onChange: handleInputChange,
                onClick: handleInputClick,
                onFocus,
                onBlur: handleBlur,
                onKeyDown: handleKeyDown,
                onKeyUp: handleKeyUp,
                placeholder,
                disabled,
                readOnly,
                autoComplete,
                autoCapitalize,
                autoCorrect,
                maxLength,
                enterKeyHint,
                inputMode,
                spellCheck,
                autoFocus,
                tabIndex,
                // The control's own: the hidden input submits the value, and a focusable control
                // is never hidden.
                name: undefined,
                form: undefined,
                hidden: undefined,
                inert: undefined,
                'aria-hidden': undefined,
              },
            })}
            ref={inputRefs}
          />
          {showClear && (
            <PickerClearButton
              fallbackRef={inputRef}
              // The literal marks C-BUTTON-TYPE; the merged props lock the type (a part cannot
              // change it).
              type="button"
              {...mergeSlotProps(slotProps?.clearButton, {
                className: wcn(
                  timePickerClassNames.clearButton,
                  pickerIconButtonClasses(size, appearance),
                  pickerButtonOffset(size, showExpand ? 2 : 1),
                  focusRing,
                  disabledStyles,
                ),
                locked: {
                  type: 'button',
                  'aria-label': labels?.clear ?? 'Clear time',
                  disabled,
                  tabIndex: undefined,
                  'aria-disabled': undefined,
                  'data-disabled': undefined,
                  'data-disabled-focusable': undefined,
                  hidden: undefined,
                  inert: undefined,
                  'aria-hidden': undefined,
                  // Keeps focus (and an open list) on the input while the pointer clears it.
                  onMouseDown: preventMouseDown,
                  onClick: handleClear,
                },
              })}
            >
              <DismissIcon size={pickerGlyphSize(size, 'icon')} />
            </PickerClearButton>
          )}
          {showExpand && (
            <PickerExpandButton
              component="TimePicker"
              expandIcon={expandIcon}
              label={labels?.expand ?? 'Show times'}
              expanded={expanded}
              listboxId={lb.listboxId}
              disabled={disabled || !!readOnly}
              onToggle={handleExpandClick}
              size={size}
              appearance={appearance}
              className={timePickerClassNames.expandButton}
              iconClassName={timePickerClassNames.expandIcon}
              part={slotProps?.expandButton}
            />
          )}
        </div>
        {showOwnError && (
          <p
            {...mergeSlotProps(slotProps?.errorMessage, {
              className: wcn(
                timePickerClassNames.errorMessage,
                'wave:mt-1 wave:text-caption-1 wave:text-error',
              ),
              locked: { id: errorId, role: 'alert' },
            })}
          >
            {errorMessage}
          </p>
        )}
        {!open && !popup.exiting && allOptions.length > 0 && renderListbox(true)}
        <span role="status" className="wave:sr-only">
          {statusMessage}
        </span>
        <HiddenInput
          name={name}
          form={form}
          disabled={disabled}
          value={selectedValue}
          type="text"
          required={validates}
          onInvalid={() => inputRef.current?.focus()}
        />
        {popup.mounted && (
          <Portal layerId={layerId}>
            <div {...surfaceProps} style={surfaceStyle} ref={surfaceRefs}>
              {popup.exiting ? (
                renderListbox(false, popup.heldItems)
              ) : hasMatches ? (
                renderListbox(false)
              ) : (
                <div
                  {...mergeSlotProps(slotProps?.emptyMessage, {
                    className: wcn(
                      timePickerClassNames.emptyMessage,
                      'wave:px-3 wave:py-1.5 wave:text-body-1 wave:text-muted-foreground',
                    ),
                    locked: { 'aria-hidden': 'true', tabIndex: undefined },
                  })}
                >
                  {statusMessage}
                </div>
              )}
            </div>
          </Portal>
        )}
      </div>
    </ListboxContext.Provider>
  );
};

TimePicker.displayName = 'TimePicker';
