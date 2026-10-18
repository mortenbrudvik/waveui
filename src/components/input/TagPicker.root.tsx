import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { tagPickerClassNames } from '../../lib/classNames';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import type { Slot } from '../../lib/slot';
import type { CoreSize, InputAppearance, Size, TagAppearance, TagSize } from '../../lib/types';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { collectOptionLabels, useListbox, type ListboxItem } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { useInputLook } from './inputLook';
import { isInvalidLook } from './Input';
import { useListboxPopup } from './Option';
import { announceToggle } from './pickerLabels';
import { EMPTY_VALUES, sameValues } from './pickerValues';
import type { RoutedHandlers } from './routedHandlers';
import { TagPickerContext } from './TagPicker.context';
import type {
  ResolvedTagPickerLabels,
  TagPickerContextValue,
  TagPickerInputOnlyProps,
  TagPickerTriggerKind,
  TagPickerTriggerProps,
} from './TagPicker.context';
import { createOptionText, findExactMatch } from './TagPicker.create';
import type { ExactMatchCandidate } from './TagPicker.create';
import type { TagPickerOption } from './TagPicker.option';
import { useFocusWithin, useTagOverflow } from './TagPicker.overflow';
import { TagPickerControl, TagPickerList, tagListControls } from './TagPicker.parts';

/**
 * The TagPicker's built-in names, descriptions and announcements, for localization. Each member is
 * optional and falls back to its English default.
 */
export interface TagPickerLabels {
  /** Name of a tag's remove button.
   * @default (label) => `Remove ${label}`
   */
  remove?: (label: string) => string;
  /** Name of the list of selected tags.
   * @default 'Selected'
   */
  selected?: string;
  /** Description of the input that sums up the selected tags (their labels, in order).
   * @default (labels) => `Selected: ${labels.join(', ')}`
   */
  summary?: (labels: string[]) => string;
  /** Announcement when a tag is added; `count` is the number of tags after the change.
   * @default (label, count) => `${label} added, ${count} selected`
   */
  added?: (label: string, count: number) => string;
  /** Announcement when a tag is removed; `count` is the number of tags after the change.
   * @default (label, count) => `${label} removed, ${count} selected`
   */
  removed?: (label: string, count: number) => string;
  /** Status text (announced, and shown in the popup) when the typed text matches no option.
   * @default 'No matches'
   */
  noMatches?: string;
  /**
   * Text and name of the create option (`allowCreate`), from the trimmed typed text.
   * @default (text) => `Create "${text}"`
   */
  create?: (text: string) => string;
  /** Name of the clear button (`clearable`). @default 'Clear selection' */
  clear?: string;
  /** Name of the expand button at the end of the field. @default 'Show options' */
  expand?: string;
  /**
   * The "+N" text of the single-line layout (`overflow="count"`); hidden from assistive
   * technology, which hears the input's summary of every tag.
   * @default (count) => `+${count}`
   */
  overflowCount?: (count: number) => string;
}

/** Sizes of TagPicker (Fluent's): medium (the 0.7 look), large and extra-large. */
export type TagPickerSize = Extract<Size, 'medium' | 'large' | 'extra-large'>;

/** Properties for the TagPicker component. */
export interface TagPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | RoutedHandlers
> {
  /**
   * The options, the array form (`{ value, label, media?, secondaryContent? }`). With parts whose
   * `TagPicker.List` has children it only names values (tags, announcements). Changed in 0.11:
   * optional.
   */
  options?: readonly TagPickerOption[];
  /**
   * The parts: `TagPicker.Control` and `TagPicker.List`, directly inside TagPicker (a Fragment is
   * fine). Without children TagPicker renders both with their defaults; without a
   * `TagPicker.List` it renders the default list after the children.
   */
  children?: React.ReactNode;
  /**
   * Controlled array of selected option values (`[]` for none). Fluent's `selectedOptions`.
   */
  value?: readonly string[];
  /**
   * Initial selected values for uncontrolled usage; a form reset restores them.
   * @default []
   */
  defaultValue?: readonly string[];
  /**
   * Called with the new selection when it changes: a tag is added (an option, or a created tag)
   * or removed, or a form reset restores different tags. Fluent's `onOptionSelect`.
   */
  onValueChange?: (value: string[]) => void;
  /**
   * Called with the new selection when it changes: a tag is added or removed, or a form reset
   * restores different tags.
   * @deprecated Use `onValueChange`.
   */
  onChange?: (value: string[]) => void;
  /**
   * Controlled open state of the option list. The list renders only in the browser: an open
   * picker is closed in the server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage. A picker that starts disabled or read-only starts
   * closed. The list renders only in the browser: it is closed in the server HTML and opens once
   * the picker has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the option list opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Shown by TagPicker.Input or TagPicker.Button while no tag is selected; the part's own
   * `placeholder` wins.
   * @default 'Select...'
   */
  placeholder?: string;
  /**
   * Whether an option matches the typed text (the query). Called with every listed option, also
   * the options of `TagPicker.List`'s children (its `value`, `label` and `textValue`), and the
   * text whenever the text is not empty, never with a selected option or the create option; an
   * option it returns `false` for is filtered out. It may keep options that do not contain the
   * text: `filter={() => true}` with `query` and `onQueryChange` leaves the matching to you (a
   * server-side search that replaces `options`); for a create entry, use `allowCreate`. With a
   * server-side search, keep the selected options in `options` (they are never listed): a
   * selected value without an option shows its raw value as the tag label, with a development
   * warning (the "Async search" story does this).
   * @default a case-insensitive substring match on the option's `textValue ?? label`
   */
  filter?: (option: ListboxItem, query: string) => boolean;
  /**
   * Controlled query: the text typed since the last tag was added, which filters the options and
   * shows in the input (hidden while `disabled` or `readOnly`). Not used with TagPicker.Button.
   */
  query?: string;
  /**
   * Initial query for uncontrolled usage. A TagPicker that starts disabled or read-only starts
   * without it (as it starts closed). Not used with TagPicker.Button.
   * @default ''
   */
  defaultQuery?: string;
  /**
   * Called with the new query when it changes: as the user types, and with `''` when it resets (a
   * tag added or created, Escape on the closed list, the clear button, a form reset, or `disabled`
   * or `readOnly` turned on while text is typed). A blur or a close keeps the text. A TagPicker
   * that mounts disabled or read-only reports nothing: it keeps a controlled query, which shows
   * once it unlocks. Not used with TagPicker.Button.
   */
  onQueryChange?: (query: string) => void;
  /**
   * Whether the tag picker is disabled: nothing can be added or removed, the remove buttons leave
   * the tab order, and the expand and clear buttons are disabled. The field dims once.
   * @default false
   */
  disabled?: boolean;
  /**
   * Size of the tags and the field: `medium` (the 0.7 look), `large` or `extra-large` (Fluent's
   * union; TagPicker has no `small`). Default: the surrounding Field's `size`, else `WaveProvider
   * inputDefaults.size`, else `'medium'`; a Field or provider `small` gives `'medium'` too. Its
   * tags are one Tag size smaller: medium → extra-small, large → small, extra-large → medium. The
   * option list keeps its size.
   */
  size?: TagPickerSize;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`. The tags are
   * filled, outlined on `filled-darker`.
   */
  appearance?: InputAppearance;
  /** Name of the values in form submissions (one hidden input per value). */
  name?: string;
  /** Id of the form the values belong to, when the TagPicker is outside it. */
  form?: string;
  /**
   * At least one tag is required to submit the form (native constraint validation). Like a native
   * readonly input, a `readOnly` TagPicker does not block submission.
   */
  required?: boolean;
  /**
   * The `autocomplete` attribute of TagPicker.Input's `<input role="combobox">`. Browser autofill
   * is off unless you set it (for example `'on'`). With TagPicker.Button, not used.
   * @default 'off'
   */
  autoComplete?: string;
  /**
   * The maximum length of the typed text (`maxlength` of TagPicker.Input's `<input>`). With
   * TagPicker.Button, not used.
   */
  maxLength?: number;
  /**
   * The selection cannot be changed: the trigger is read-only, the tags have no remove buttons,
   * the expand button is disabled and the clear button hidden, and the option list neither opens
   * (click, keyboard, a controlled `open`) nor adds tags; Escape is left to the page. Turning it
   * (or `disabled`) on while the list is open closes it (`onOpenChange(false)`); a focused remove
   * button hands focus to the trigger.
   */
  readOnly?: boolean;
  /**
   * Lets the user add a tag of their own text: while the trimmed text matches no option label
   * and no selected value (ignoring case) and no option value, the list ends with a create option
   * (`labels.create`); Enter on it or a click adds the text as a tag, calls `onOptionCreate`, and
   * clears the text. Needs `TagPicker.Input` (not `TagPicker.Button`). WaveUI-only: Fluent's
   * TagPicker has no free tagging.
   * @default false
   */
  allowCreate?: boolean;
  /**
   * Called with the trimmed text when the user creates a tag, before `onValueChange` reports the
   * new value. Add an option for it if you keep options: until then the tag shows the raw text.
   * WaveUI-only (see `allowCreate`).
   */
  onOptionCreate?: (text: string) => void;
  /**
   * Shows a clear button at the end of the field while a tag is selected (not while `readOnly`;
   * disabled while `disabled`): it removes every tag (`onValueChange([])`), clears the typed
   * text, closes the list and focuses the trigger (the input, or `TagPicker.Button`). A Tab stop
   * after the trigger. The name of Fluent's Combobox and Dropdown prop.
   * @default false
   */
  clearable?: boolean;
  /**
   * The glyph of the expand button at the end of the field (default: a chevron). The button
   * opens and closes the list, keeps focus on the trigger and is not a Tab stop. `null` or
   * `undefined` keep the chevron; `false`, or a value that renders nothing, hides the button.
   * Decorative: a `<button>` passed here is unwrapped. `TagPicker.Control`'s `expandIcon` wins.
   */
  expandIcon?: Slot<'span'>;
  /**
   * `'wrap'`: the tags wrap onto more lines. `'count'`: while focus is outside the picker and its
   * list is closed, the tags stay on one line and the ones that do not fit give way to "+N"
   * (`labels.overflowCount`); focusing the picker shows them all. The tags are measured by
   * position: your own Tags in `TagPicker.Group` render in `value` order. WaveUI-only: Fluent's
   * single-line layout is a story, not a prop.
   * @default 'wrap'
   */
  overflow?: 'wrap' | 'count';
  /**
   * Names of the remove buttons and the tag list, the summary that describes the trigger, the
   * announcements, the "No matches" text, the create option, the clear and expand buttons and the
   * "+N" count, for localization. Unset members keep their English defaults.
   */
  labels?: TagPickerLabels;
  /**
   * Called when TagPicker.Input's `<input role="combobox">` receives focus (the root keeps other
   * handlers). With TagPicker.Button, pass it (and `ref`) on the Button.
   */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Called when TagPicker.Input's `<input>` loses focus. With TagPicker.Button, pass it on the Button. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /**
   * Called on a key press in TagPicker.Input's `<input>`, after the Input's own `onKeyDown` and
   * before the built-in listbox and tag keys; `event.preventDefault()` skips them. With
   * TagPicker.Button, pass it on the Button.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Called when a key is released in TagPicker.Input's `<input>`. With TagPicker.Button, pass it on the Button. */
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  /**
   * Ref to TagPicker.Input's `<input role="combobox">` (the focusable element). With
   * TagPicker.Button, pass `ref` on the Button.
   */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * How the picker came to be locked (`disabled` or `readOnly`): not at all, by a change while
 * mounted, or since it mounted.
 */
type LockState = 'unlocked' | 'locked' | 'mounted-locked';

const TAG_PICKER_SIZES: readonly TagPickerSize[] = ['medium', 'large', 'extra-large'];
const EMPTY_OPTIONS: readonly TagPickerOption[] = [];
const EMPTY_LABELS: ReadonlyMap<string, string> = new Map();

/** The tag size of each picker size (Fluent's mapping, D54). */
const TAG_SIZE: Readonly<Record<TagPickerSize, TagSize>> = {
  medium: 'extra-small',
  large: 'small',
  'extra-large': 'medium',
};

const defaultRemoveLabel = (label: string) => `Remove ${label}`;
const defaultSummaryLabel = (labels: string[]) => `Selected: ${labels.join(', ')}`;
const defaultCreateLabel = (text: string) => `Create "${text}"`;
const defaultOverflowCountLabel = (count: number) => `+${count}`;

/** The default `filter` (Phase 5 D13): a case-insensitive substring of `textValue ?? label`. */
function matchesText(item: ListboxItem, text: string): boolean {
  return (item.textValue ?? item.label).toLowerCase().includes(text.toLowerCase());
}

function triggerMessage(count: number): string {
  return `TagPicker: render exactly one trigger, \`TagPicker.Input\` or \`TagPicker.Button\`, inside \`TagPicker.Control\` (found ${count}).`;
}

const ALLOW_CREATE_BUTTON_MESSAGE =
  'TagPicker: `allowCreate` needs `TagPicker.Input`: `TagPicker.Button` has no text to create a tag from, so no create option is offered.';

const LIST_PLACEMENT_MESSAGE =
  'TagPicker.List: render one TagPicker.List, directly inside TagPicker (a Fragment is fine). A second list, or one inside a component of your own, splits the options over two lists.';

/** The `TagPicker.List` among the direct children and Fragments, if any (D50). */
function findList(
  children: React.ReactNode,
): React.ReactElement<{ children?: React.ReactNode }> | undefined {
  if (children === null || children === undefined) return undefined;
  for (const { node } of flattenChildren(children)) {
    if (isElementOfType<{ children?: React.ReactNode }>(node, TagPickerList)) return node;
  }
  return undefined;
}

export const TagPickerRoot = (props: TagPickerProps) => {
  const {
    options = EMPTY_OPTIONS,
    children,
    value: valueProp,
    defaultValue,
    onValueChange,
    onChange,
    open: openProp,
    defaultOpen,
    onOpenChange,
    placeholder = 'Select...',
    filter,
    query: queryProp,
    defaultQuery,
    onQueryChange,
    disabled = false,
    size: sizeProp,
    appearance: appearanceProp,
    name,
    form,
    required,
    autoComplete = 'off',
    autoCapitalize,
    autoCorrect,
    maxLength,
    readOnly = false,
    allowCreate = false,
    onOptionCreate,
    clearable = false,
    expandIcon,
    overflow: overflowProp = 'wrap',
    labels,
    inputMode,
    spellCheck,
    enterKeyHint,
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
    ref,
    ...rest
  } = props;

  if (onChange !== undefined) warnDeprecated('TagPicker', 'onChange', 'onValueChange');
  const overflow = overflowProp === 'count' ? 'count' : 'wrap';

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  // Like a native readonly input, a read-only TagPicker is barred from constraint validation (the
  // user could not fix it); its values are still submitted.
  const validates = isRequired && !readOnly;
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
  const {
    id: triggerId,
    'aria-label': triggerLabel,
    'aria-labelledby': triggerLabelledBy,
    'aria-describedby': triggerDescribedBy,
    'aria-invalid': triggerInvalid,
    'aria-required': triggerRequired,
  } = fieldProps;
  // The error look follows the resolved state: the consumer's `aria-invalid` or the Field's.
  const invalidLook = isInvalidLook(false, triggerInvalid);
  const { size, appearance } = useInputLook(sizeProp, appearanceProp, {
    sizes: TAG_PICKER_SIZES,
    defaultSize: 'medium',
  });
  const coreSize: CoreSize = size === 'medium' ? 'medium' : 'large';
  const tagSize = TAG_SIZE[size];
  // A muted tag would barely show on the darker fill: outlined there (D54).
  const tagAppearance: TagAppearance = appearance === 'filled-darker' ? 'outline' : 'filled';

  const [selected, setSelected] = useControllable<readonly string[]>(
    valueProp,
    defaultValue ?? EMPTY_VALUES,
    (next) => {
      // The props are read only; the callbacks receive an array of their own.
      const list = [...next];
      onValueChange?.(list);
      onChange?.(list);
    },
  );
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const interactive = !disabled && !readOnly;
  // A picker that starts disabled or read-only never shows its list, so it starts closed (no close
  // to report later).
  const [openState, setOpen] = useControllable(
    openProp,
    (defaultOpen ?? false) && interactive,
    onOpenChange,
  );
  // The open list lives in a portal, which renders only in the browser: until then (the server
  // HTML, hydration) the picker shows the closed inline list and reports it closed, so
  // aria-controls and aria-activedescendant never name a missing element.
  const isClient = useIsClient();
  const open = openState && interactive && isClient;
  // The trigger parts (D63): their kind decides the listbox mode; the server HTML and the first
  // render use the editable mode of `TagPicker.Input`.
  const triggersRef = React.useRef(new Map<object, TagPickerTriggerKind>());
  const [triggerKind, setTriggerKind] = React.useState<TagPickerTriggerKind>('input');
  const registerTrigger = React.useCallback((kind: TagPickerTriggerKind) => {
    const token = {};
    const triggers = triggersRef.current;
    const firstKind = () => triggers.values().next().value ?? 'input';
    triggers.set(token, kind);
    setTriggerKind(firstKind());
    return () => {
      triggers.delete(token);
      setTriggerKind(firstKind());
    };
  }, []);
  const listCountRef = React.useRef(0);
  const registerList = React.useCallback(() => {
    listCountRef.current += 1;
    return () => {
      listCountRef.current -= 1;
    };
  }, []);
  // After every commit (every part's layout effect has run): exactly one trigger and one List.
  React.useEffect(() => {
    const triggers = triggersRef.current.size;
    if (triggers !== 1) warnOnce('TagPicker:trigger', triggerMessage(triggers));
    if (listCountRef.current > 1) warnOnce('TagPicker.List:placement', LIST_PLACEMENT_MESSAGE);
  });
  const isButtonTrigger = triggerKind === 'button';

  // The query (D12): the text typed since the last tag was added, which filters the options. A
  // picker that starts locked starts without a query, as it starts closed.
  const [queryState, setQuery] = useControllable(
    queryProp,
    interactive ? (defaultQuery ?? '') : '',
    onQueryChange,
  );
  // Locking the control (readOnly/disabled) while typing drops the typed text: hidden during
  // render here, and the reset reported from an effect, since `onQueryChange` never runs during
  // render (D12). `lock` is how the picker came to be locked (previous-value pattern, C-HOOKS):
  // `'locked'` by a change while mounted, whose reset is reported once, or `'mounted-locked'`
  // since it mounted, which reports nothing and keeps a controlled query, hidden until the picker
  // unlocks (R20).
  // `TagPicker.Button` has no text entry, so no query filters its list (D63).
  const query = interactive && !isButtonTrigger ? queryState : '';
  const [lock, setLock] = React.useState<LockState>(interactive ? 'unlocked' : 'mounted-locked');
  if (interactive && lock !== 'unlocked') setLock('unlocked');
  else if (!interactive && lock === 'unlocked') setLock('locked');
  React.useEffect(() => {
    if (lock === 'locked') setQuery('');
  }, [lock, setQuery]);
  // Locking also closes the list itself, not only the derived `open`, so unlocking does not reopen
  // it without a user action. The close is reported through onOpenChange (a consumer callback from
  // an effect, C-HOOKS); a controlled `open` that stays true is still not shown while locked.
  const lockedOpen = !interactive && openState;
  React.useEffect(() => {
    if (lockedOpen) setOpen(false);
  }, [lockedOpen, setOpen]);
  // Keeps the shared live regions alive while mounted: every addition and removal is announced
  // (`announceToggle`).
  useAnnounce();

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const controlElementRef = React.useRef<HTMLDivElement | null>(null);
  const groupRef = React.useRef<HTMLDivElement | null>(null);
  const chipRef = React.useRef<HTMLSpanElement | null>(null);
  const summaryId = useId('tagpicker-summary');
  const createValue = useId('tagpicker-create');

  React.useEffect(() => {
    if (allowCreate && isButtonTrigger) {
      warnOnce('TagPicker:allowCreate-button', ALLOW_CREATE_BUTTON_MESSAGE);
    }
  }, [allowCreate, isButtonTrigger]);

  // The parts form (D50): a List among the direct children with children of its own switches the
  // listbox to registration mode; `options` then only names values.
  const listElement = findList(children);
  const listChildren = listElement?.props.children;
  const registration = listChildren !== undefined && listChildren !== null;
  const collected = React.useMemo(
    () => (registration ? collectOptionLabels(listChildren) : EMPTY_LABELS),
    [registration, listChildren],
  );

  const optionByValue = React.useMemo(() => {
    const map = new Map<string, TagPickerOption>();
    for (const option of options) if (!map.has(option.value)) map.set(option.value, option);
    return map;
  }, [options]);

  const resolvedLabels = React.useMemo<ResolvedTagPickerLabels>(
    () => ({
      remove: labels?.remove ?? defaultRemoveLabel,
      selected: labels?.selected ?? 'Selected',
      create: labels?.create ?? defaultCreateLabel,
      clear: labels?.clear ?? 'Clear selection',
      expand: labels?.expand ?? 'Show options',
      overflowCount: labels?.overflowCount ?? defaultOverflowCountLabel,
      noMatches: labels?.noMatches ?? 'No matches',
    }),
    [labels],
  );

  // The create option (D59) needs the text input, an interactive picker and an open list.
  const offersCreate =
    allowCreate && interactive && !isButtonTrigger && open && query.trim() !== '';
  // Data mode: the duplicate check reads every `options` entry, before the listbox, since the
  // create item is one of its items.
  const dataCreateText =
    offersCreate && !registration
      ? createOptionText(query, {
          labels: options.map((option) => option.label),
          values: options.map((option) => option.value),
          selected,
        })
      : null;

  const items = React.useMemo<ListboxItem[] | undefined>(() => {
    if (registration) return undefined;
    const available: ListboxItem[] = options
      .filter((option) => !selectedSet.has(option.value))
      .map((option) => ({ value: option.value, label: option.label }));
    if (dataCreateText !== null) {
      available.push({ value: createValue, label: resolvedLabels.create(dataCreateText) });
    }
    return available;
  }, [registration, options, selectedSet, dataCreateText, createValue, resolvedLabels]);

  // useListbox's navigability predicate (D58): the create option always, never a selected option,
  // and `filter` (else the default) bound to the typed text while there is any.
  const listFilter = React.useMemo(() => {
    if (!registration && !query) return undefined;
    const matches = filter ?? matchesText;
    return (item: ListboxItem) =>
      item.value === createValue ||
      (!selectedSet.has(item.value) && (query === '' || matches(item, query)));
  }, [registration, query, filter, selectedSet, createValue]);

  // Adds a listed option (`label`: the committed item's).
  const addTag = (value: string, label: string) => {
    if (!interactive || selected.includes(value)) return;
    const next = [...selected, value];
    setSelected(next);
    setQuery('');
    announceToggle(labels, label, true, next.length);
  };

  // Creates a tag of the trimmed text (D59): the create option was offered for it.
  const commitCreate = () => {
    const text = query.trim();
    if (!interactive || text === '') return;
    onOptionCreate?.(text);
    const next = [...selected, text];
    setSelected(next);
    setQuery('');
    announceToggle(labels, text, true, next.length);
  };

  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: isButtonTrigger ? 'select-only' : 'editable',
    multiselect: true,
    selectedValues: selected,
    onSelect: (value, details) => {
      if (value === createValue) commitCreate();
      else addTag(value, details?.item.label ?? value);
    },
    items,
    filter: listFilter,
    // Typing a filter makes its first match active (as in Combobox), so Enter adds what the list
    // shows instead of submitting the form. Nothing is active on open or with the text cleared.
    // The Button trigger starts on the first listed option, as Dropdown does.
    autoHighlight: isButtonTrigger ? 'selected' : query ? 'first' : false,
    idPrefix: 'tagpicker-listbox',
    onClearDraft: query && !isButtonTrigger ? () => setQuery('') : undefined,
  });

  // A value's label (D58): its registered option's, else the List children's (the server and the
  // first render), else the `options` entry's, else the raw value.
  const getItem = listbox.getItem;
  const labelOf = React.useCallback(
    (value: string): string =>
      (registration ? getItem(value)?.label : undefined) ??
      collected.get(value) ??
      optionByValue.get(value)?.label ??
      value,
    [registration, getItem, collected, optionByValue],
  );

  // Registration mode: the create option is a rendered Option, so the duplicate check runs after
  // the listbox, over the labels it lists in this render and those of the selected values.
  let createText: string | null = dataCreateText;
  if (offersCreate && registration) {
    const listed = listbox.items.filter((item) => item.value !== createValue);
    createText = createOptionText(query, {
      labels: [
        ...options.map((option) => option.label),
        ...collected.values(),
        ...listed.map((item) => item.label),
        ...selected.map(labelOf),
      ],
      values: [
        ...options.map((option) => option.value),
        ...collected.keys(),
        ...listed.map((item) => item.value),
      ],
      selected,
    });
  }
  const showCreate = createText !== null;

  // aria-expanded only while a listbox with options (or the create option) is shown
  // (input-pickers#21).
  const expanded = open && (listbox.items.length > 0 || showCreate);
  const noMatchesText = resolvedLabels.noMatches;
  // The popup shows the options, or "No matches" for a query.
  const surfaceOpen = open && (expanded || query !== '');
  const noMatches = surfaceOpen && !expanded && !showCreate;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef: triggerRef,
  });

  const rootMergedRef = useMergedRefs<HTMLDivElement>(rootRef, ref);

  useFormReset(
    rootRef,
    () => {
      // Compared by content (C-FORMS): an inline default is a new array on every render, and a
      // reset that keeps the same tags reports nothing.
      const initial = defaultValue ?? EMPTY_VALUES;
      setSelected((current) => (sameValues(current, initial) ? current : [...initial]));
      setQuery('');
    },
    form,
  );

  // The single-line layout (D62): collapsed while focus is outside the root and the list closed.
  const {
    focusWithin,
    onFocus: trackFocus,
    onBlur: trackBlur,
  } = useFocusWithin(overflow === 'count');
  const collapsed = overflow === 'count' && !focusWithin && !open;
  const tagLabels = React.useMemo(() => selected.map(labelOf), [selected, labelOf]);
  const hiddenValues = useTagOverflow({
    active: collapsed,
    values: selected,
    labels: tagLabels,
    control: controlElementRef,
    group: groupRef,
    chip: chipRef,
    trigger: triggerRef,
  });

  const focusTrigger = useEventCallback(() => {
    triggerRef.current?.focus();
  });
  const toggleOpen = useEventCallback(() => {
    if (interactive) setOpen(!open);
  });
  const removeTag = useEventCallback((value: string) => {
    if (!interactive || !selected.includes(value)) return;
    const next = selected.filter((v) => v !== value);
    setSelected(next);
    announceToggle(labels, labelOf(value), false, next.length);
  });
  const clear = useEventCallback(() => {
    focusTrigger();
    if (!interactive) return;
    if (selected.length > 0) setSelected([]);
    setQuery('');
    setOpen(false);
  });
  const editText = useEventCallback((text: string) => {
    if (!interactive) return;
    setQuery(text);
    if (!open) setOpen(true);
    // The option whose label equals the typed text becomes active (D60); a user edit only.
    const candidates: Iterable<ExactMatchCandidate> = registration
      ? Array.from(collected, ([value, label]) => ({ value, label }))
      : options;
    listbox.setActiveValue(findExactMatch(text, candidates, selectedSet));
  });
  const focusLastTagControl = useEventCallback(() => {
    const group = groupRef.current;
    const last = group ? tagListControls(group).at(-1) : undefined;
    last?.focus();
    return last !== undefined;
  });
  const setOpenStable = useEventCallback((next: boolean) => setOpen(next));
  const entryOf = React.useCallback((value: string) => optionByValue.get(value), [optionByValue]);

  const triggerProps = React.useMemo<TagPickerTriggerProps>(
    () => ({
      id: triggerId,
      'aria-label': triggerLabel,
      'aria-labelledby': triggerLabelledBy,
      'aria-describedby': triggerDescribedBy,
      'aria-invalid': triggerInvalid,
      'aria-required': triggerRequired,
      'aria-errormessage': ariaErrorMessage,
      'aria-details': ariaDetails,
      tabIndex,
      autoFocus,
    }),
    [
      triggerId,
      triggerLabel,
      triggerLabelledBy,
      triggerDescribedBy,
      triggerInvalid,
      triggerRequired,
      ariaErrorMessage,
      ariaDetails,
      tabIndex,
      autoFocus,
    ],
  );
  const inputProps = React.useMemo<TagPickerInputOnlyProps>(
    () => ({
      autoComplete,
      autoCapitalize,
      autoCorrect,
      maxLength,
      inputMode,
      spellCheck,
      enterKeyHint,
      onFocus,
      onBlur,
      onKeyDown,
      onKeyUp,
      controlRef,
    }),
    [
      autoComplete,
      autoCapitalize,
      autoCorrect,
      maxLength,
      inputMode,
      spellCheck,
      enterKeyHint,
      onFocus,
      onBlur,
      onKeyDown,
      onKeyUp,
      controlRef,
    ],
  );
  const listLabelledBy =
    triggerLabel === undefined ? (triggerLabelledBy ?? field?.labelId) : triggerLabelledBy;
  const listLabel = React.useMemo(
    () => ({ 'aria-label': triggerLabel, 'aria-labelledby': listLabelledBy }),
    [triggerLabel, listLabelledBy],
  );

  const hasSummary = selected.length > 0;
  const context = React.useMemo<TagPickerContextValue>(
    () => ({
      size,
      appearance,
      coreSize,
      tagSize,
      tagAppearance,
      disabled,
      readOnly,
      interactive,
      invalidLook,
      selected,
      labelOf,
      entryOf,
      labels: resolvedLabels,
      placeholder,
      options,
      warnsUnknownValues: !registration && !allowCreate,
      dataMode: !registration,
      listbox,
      open,
      expanded,
      query,
      surfaceOpen,
      showCreate,
      createText: createText ?? '',
      createValue,
      emptyContent: query !== '' && !showCreate,
      layerId,
      surfaceRef,
      floatingProps,
      listLabel,
      triggerProps,
      inputProps,
      summaryId: hasSummary ? summaryId : undefined,
      triggerRef,
      setReference,
      controlRef: controlElementRef,
      groupRef,
      chipRef,
      registerTrigger,
      registerList,
      triggerKind,
      setOpen: setOpenStable,
      toggleOpen,
      focusTrigger,
      removeTag,
      clear,
      editText,
      focusLastTagControl,
      expandIcon,
      clearable,
      overflow,
      collapsed,
      hiddenValues,
    }),
    [
      size,
      appearance,
      coreSize,
      tagSize,
      tagAppearance,
      disabled,
      readOnly,
      interactive,
      invalidLook,
      selected,
      labelOf,
      entryOf,
      resolvedLabels,
      placeholder,
      options,
      registration,
      allowCreate,
      listbox,
      open,
      expanded,
      query,
      surfaceOpen,
      showCreate,
      createText,
      createValue,
      layerId,
      surfaceRef,
      floatingProps,
      listLabel,
      triggerProps,
      inputProps,
      hasSummary,
      summaryId,
      setReference,
      registerTrigger,
      registerList,
      triggerKind,
      setOpenStable,
      toggleOpen,
      focusTrigger,
      removeTag,
      clear,
      editText,
      focusLastTagControl,
      expandIcon,
      clearable,
      overflow,
      collapsed,
      hiddenValues,
    ],
  );

  const parts =
    children === undefined || children === null ? (
      <>
        <TagPickerControl />
        <TagPickerList />
      </>
    ) : (
      <>
        {children}
        {/* A parts form without a List still has its listbox, so aria-controls never dangles. */}
        {listElement === undefined && <TagPickerList />}
      </>
    );

  return (
    <div
      data-size={size}
      data-appearance={appearance}
      data-overflow={overflow}
      data-collapsed={collapsed ? '' : undefined}
      {...rest}
      ref={rootMergedRef}
      className={cn(tagPickerClassNames.root, 'relative', className)}
      // Focus inside the root (DOM containment) expands the single-line layout.
      onFocus={trackFocus}
      onBlur={trackBlur}
    >
      <TagPickerContext.Provider value={context}>{parts}</TagPickerContext.Provider>
      {hasSummary && (
        // Describes the trigger. The list itself would read every "Remove …" button name too.
        <span id={summaryId} hidden>
          {(labels?.summary ?? defaultSummaryLabel)(selected.map(labelOf))}
        </span>
      )}
      {/* Mounted before its text: a live region added together with its text is not announced by
          every screen reader. The row in the popup is the visible copy. */}
      <span role="status" className="sr-only">
        {noMatches && noMatchesText}
      </span>
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={selected}
        type="text"
        required={validates}
        onInvalid={focusTrigger}
      />
    </div>
  );
};
TagPickerRoot.displayName = 'TagPicker';
