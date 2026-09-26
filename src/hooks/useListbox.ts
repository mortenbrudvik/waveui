import * as React from 'react';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { getElementType } from '../lib/children';
import { isDev, reportMissingContext, warnOnce } from '../lib/dev';
import type { OpenChangeDetails } from '../lib/types';
import { useActiveDescendant } from './useActiveDescendant';
import { useEventCallback } from './useEventCallback';
import { useId } from './useId';
import { useMergedRefs } from './useMergedRefs';
import { isAltGraphCharacter, useTypeahead } from './useTypeahead';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/**
 * One option of a listbox: an entry of {@link UseListboxOptions.items} (data mode), or what an
 * option registers (registration mode, {@link useListboxOption}).
 */
export interface ListboxItem {
  /** Unique value within the listbox. */
  value: string;
  /** Display label (Combobox input text, Dropdown trigger text). */
  label: string;
  /** Text matched by typeahead and filters instead of `label`. */
  textValue?: string;
  /**
   * Disabled options are rendered but skipped by navigation, unless
   * {@link UseListboxOptions.disabledOptionsFocusable}, and never committed.
   * @default false
   */
  disabled?: boolean;
  /**
   * Hidden options are left out of navigation and rendering like filtered-out ones: never
   * highlighted, reached by typeahead or committed with the keyboard (registered options render
   * `hidden`). Their label stays known ({@link UseListboxResult.getItem}). In data mode (`items`)
   * it is the item's own flag; a registered option is hidden by its own `hidden` attribute or by a
   * hidden group around it.
   * @default false
   */
  hidden?: boolean;
}

/**
 * Why {@link UseListboxOptions.onOpenChange} was called: `'keyboard'` (a key opens the listbox, or
 * closes it without a commit), `'select'` (a commit closes it), `'escape'` or `'tab'` (Tab closes
 * it, after committing the active option in single-select select-only mode).
 */
export type ListboxOpenChangeReason = 'keyboard' | 'select' | 'escape' | 'tab';

/**
 * Second argument of {@link UseListboxOptions.onSelect}: the committed option and the event behind
 * the commit.
 */
export interface ListboxSelectDetails {
  /** The committed option. */
  item: ListboxItem;
  /** The key or click event behind the commit. */
  event: Event;
}

/** Options of {@link useListbox}. */
export interface UseListboxOptions {
  /**
   * Whether the listbox is shown. You own the open state: `onOpenChange` asks you to change it.
   * Standalone mode: whether the list has focus — an option is active only while it does.
   */
  open: boolean;
  /**
   * Called when a key (or a commit) wants to open or close the listbox. `details.reason` says why
   * (`'keyboard'`, `'select'` — a commit that closes the list —, `'escape'` or `'tab'`) and
   * `details.event` is the key or click event behind it. WaveUI always passes `details`; it is
   * typed optional until 1.0 so that code which calls this prop itself keeps compiling. Never
   * called in standalone mode.
   */
  onOpenChange?: (open: boolean, details?: OpenChangeDetails<ListboxOpenChangeReason>) => void;
  /**
   * `'editable'`: a text input combobox (Combobox, TagPicker, TimePicker).
   * `'select-only'`: a button/div combobox without text entry (Dropdown).
   * `'standalone'`: a listbox that holds focus itself (Listbox), with nothing to open or close:
   * `open` is its focus state, the keys move and commit (a commit keeps the committed option
   * active), Tab, Escape and Alt+Arrow keys are left to the page, `onOpenChange` is never called,
   * and a pointer press on an option focuses the list and activates the option without scrolling
   * (see {@link UseListboxResult.getListboxProps}).
   */
  mode: 'editable' | 'select-only' | 'standalone';
  /**
   * Several values can be selected: the list gets `aria-multiselectable`, and a commit keeps the
   * listbox open on the committed option (your `onSelect` adds or removes the value).
   * @default false
   */
  multiselect?: boolean;
  /** The selected values (`[]` when nothing is selected). */
  selectedValues: readonly string[];
  /**
   * Called when an option is committed: click, Enter/Space, and in single-select select-only mode
   * also Tab and Alt+ArrowUp (with `multiselect` they close without committing). `details.item` is
   * the committed option and `details.event` the key or click event behind the commit. WaveUI
   * always passes `details`; it is typed optional until 1.0 so that code which calls this prop
   * itself keeps compiling.
   */
  onSelect: (value: string, details?: ListboxSelectDetails) => void;
  /**
   * Data mode: the options, in list order. Omit it for registration mode, where the options
   * register themselves in DOM order: `Option`s, or option components of your own on
   * {@link useListboxOption}, rendered inside the listbox's context
   * ({@link UseListboxResult.context}, which `ListboxSurface` and `ListboxProvider` provide).
   */
  items?: readonly ListboxItem[];
  /**
   * The navigability predicate: an item it returns `false` for is filtered out — left out of the
   * keys, typeahead and {@link UseListboxResult.items}, never active, and rendered `hidden` as a
   * registered option (its label stays known). It is never called for a hidden item, which stays
   * out anyway. A picker builds it from its query, the text typed so far: by default, Combobox
   * keeps the options whose `textValue ?? label` contains it, ignoring case, and a component with
   * a `filter(option, query)` prop builds this predicate by binding its current query to it.
   * Without it, every item that is not hidden is navigable.
   */
  filter?: (item: ListboxItem) => boolean;
  /** Arrow keys wrap around at the ends. @default false */
  loop?: boolean;
  /**
   * Printable characters move to the matching option (on by default in select-only and standalone
   * mode).
   * @default mode !== 'editable'
   */
  typeahead?: boolean;
  /**
   * Keeps disabled options in the arrow-key, Home/End, PageUp/PageDown and typeahead order: they
   * still cannot be committed (Enter, Space and a click do nothing and the list stays open), and
   * while one is active, Tab and Alt+ArrowUp in single-select select-only mode close the listbox
   * without a commit. The `autoHighlight` fallback may then be a disabled option too.
   * @default false
   */
  disabledOptionsFocusable?: boolean;
  /**
   * The option that is active while no option is highlighted: `'selected'` — the first selected
   * navigable option in list order (not in `selectedValues` order), else the first option;
   * `'first'` — the first option; `false` — none. A highlighted option that leaves the navigable
   * set is dropped (the fallback takes over, also when the option returns); in editable mode a
   * text-editing key clears the highlight.
   * @default 'selected'
   */
  autoHighlight?: 'selected' | 'first' | false;
  /**
   * Whenever the options the keys reach (the navigable ones, the disabled ones only with
   * `disabledOptionsFocusable`) change while open, compared by content — as when typing filters
   * them — the first of them becomes active, also when the update that opens the listbox changes
   * them (compared with those before opening, as the keystroke that opens a filtered list does).
   * Opening with unchanged options keeps the `autoHighlight` start. It sets
   * {@link useActiveDescendant}'s `activateFirstOnChange`. In editable mode every text-editing key
   * while open makes the first option active as well, also when the options stay the same.
   * @default false
   */
  highlightOnFilter?: boolean;
  /**
   * Called after the active (highlighted) option changes — arrow keys, typeahead, the pointer, a
   * filter change, opening — and with `null` when the listbox closes. Passed straight through to
   * {@link useActiveDescendant}'s `onActiveValueChange`.
   */
  onActiveValueChange?: (value: string | null) => void;
  /** Prefix of the generated listbox id. @default 'listbox' */
  idPrefix?: string;
  /**
   * Editable: Escape with the listbox closed and text in the input calls this (and prevents the
   * default), so you can clear the typed text. Not handled when omitted.
   */
  onClearDraft?: () => void;
}

/** Props for the combobox element (spread them; see {@link UseListboxResult.getComboboxProps}). */
export interface ListboxComboboxProps {
  role: 'combobox';
  /** {@link UseListboxOptions.open}. */
  'aria-expanded': boolean;
  /** The listbox's id ({@link UseListboxResult.listboxId}). */
  'aria-controls': string;
  /** The active option's id, while the listbox is open and an option is active. */
  'aria-activedescendant'?: string;
  'aria-haspopup': 'listbox';
  /** Editable mode: typing filters the options. */
  'aria-autocomplete'?: 'list';
}

/** Props for the listbox element (see {@link UseListboxResult.getListboxProps}). */
export interface ListboxListProps {
  /** {@link UseListboxResult.listboxId}. */
  id: string;
  role: 'listbox';
  /** With {@link UseListboxOptions.multiselect}. */
  'aria-multiselectable'?: true;
  /** `-1` in the combobox modes (focus stays on the combobox); `0` in standalone mode. */
  tabIndex: 0 | -1;
  /** The combobox modes: keeps focus on the combobox while options are clicked. */
  onMouseDown?(event: React.MouseEvent): void;
  /** Standalone mode: the active option's id while the list has focus and an option is active. */
  'aria-activedescendant'?: string;
  /**
   * Standalone mode: the list element, which a pointer press on an option focuses. Merge it with
   * your own ref (a press warns in development when it was dropped).
   */
  ref?: React.RefCallback<HTMLElement>;
}

/** Result of {@link useListbox}. */
export interface UseListboxResult {
  /** Id of the listbox element. */
  listboxId: string;
  /**
   * The active (highlighted) option, derived during render; `null` while closed (in standalone
   * mode, while the list does not have focus).
   */
  activeValue: string | null;
  /** `getOptionId(activeValue)` while open and an option is active. */
  activeDescendantId: string | undefined;
  /**
   * The navigable items in DOM/data order: without filtered-out and hidden items; disabled ones
   * are included (navigation skips them, unless
   * {@link UseListboxOptions.disabledOptionsFocusable}).
   */
  items: ListboxItem[];
  /** Unfiltered lookup (registered options or `items`), e.g. for the selected option's label. */
  getItem(value: string): ListboxItem | undefined;
  /** `${listboxId}-opt-${n}`; `n` is assigned the first time a value is seen and never changes. */
  getOptionId(value: string): string;
  /**
   * Highlights `value` while open, scrolled into view like a keyboard highlight; `null` returns the
   * highlight to the `autoHighlight` option. The value is checked in the next render: if it is not
   * navigable then (disabled options count as not navigable unless
   * {@link UseListboxOptions.disabledOptionsFocusable}), it is dropped like `null`, and the
   * highlight returns to the `autoHighlight` option, or to none. A kept value is dropped when it
   * leaves the navigable set later. A value set while closed survives only when the same update
   * opens the listbox.
   */
  setActiveValue(value: string | null): void;
  /**
   * Attach to the combobox element (to the list in standalone mode). Ignores key events a handler
   * of yours already prevented (compose yours first).
   */
  onKeyDown(event: React.KeyboardEvent): void;
  /**
   * Attach to the combobox element next to `onKeyDown`. Required for a `<button>` combobox
   * (select-only): it prevents the Space keyup, so the native click does not toggle the listbox
   * again after the keydown opened or committed.
   */
  onKeyUp(event: React.KeyboardEvent): void;
  /**
   * Props for the combobox element (spread them): its role, `aria-expanded`, `aria-controls`,
   * `aria-haspopup`, `aria-activedescendant` while an option is active and, in editable mode,
   * `aria-autocomplete`. Not used in standalone mode, where the list itself has focus.
   */
  getComboboxProps(): ListboxComboboxProps;
  /**
   * Props for the listbox element (spread them). The combobox modes: `tabIndex: -1` and an
   * `onMouseDown` that keeps focus on the combobox while options are clicked. Standalone mode:
   * `tabIndex: 0`, `aria-activedescendant` while an option is active, and a `ref` (merge it with
   * yours: a pointer press on an option focuses the list through it), without `onMouseDown`.
   * Both: `aria-multiselectable` with `multiselect`.
   */
  getListboxProps(): ListboxListProps;
  /**
   * The context of the listbox's options: `ListboxSurface` provides it; for a list you render
   * yourself, pass it to `ListboxProvider` around the options.
   */
  context: ListboxContextValue;
}

/**
 * The per-option state of a listbox ({@link ListboxContextValue.store}) and the contract of option
 * components: {@link useListboxOption} is built on it, and so can an option component of your own
 * be. `register` adds an option, `getIndex` gives its stable id, and the flags say how to draw it:
 * subscribe with `useSyncExternalStore` and read one value (`() => store.isActive(value)`), so only
 * the options whose answer changed re-render.
 */
export interface ListboxStore {
  /** Calls `listener` after a flag of any option changed. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Whether `value` is the active option, the one `aria-activedescendant` points at. */
  isActive(value: string): boolean;
  /** Whether `value` is selected. */
  isSelected(value: string): boolean;
  /** Whether `value` is filtered out or hidden: render its option `hidden`. */
  isHidden(value: string): boolean;
  /**
   * The stable per-listbox index of `value`, assigned the first time the value is seen: the
   * option's id is `${listboxId}-opt-${getIndex(value)}` ({@link UseListboxResult.getOptionId}),
   * the same across filtering and remounts.
   */
  getIndex(value: string): number;
  /**
   * Registers an option and its element (registration mode): call it from a layout effect, as
   * {@link useListboxOption} does, and call the returned function to unregister, when the option
   * unmounts or before it registers a changed item. The options are ordered by their elements'
   * DOM position. The registrations of a commit are published once from the listbox's layout
   * effect (later ones once per microtask).
   */
  register(item: ListboxItem, element: React.RefObject<HTMLElement | null>): () => void;
}

/**
 * The context a listbox provides to its options (`useListbox(...).context`; pass it to
 * `ListboxProvider` for a list rendered without `ListboxSurface`).
 */
export interface ListboxContextValue {
  /** The listbox element's id, which the option ids start with. */
  listboxId: string;
  /** The per-option state and the registration of the options. */
  store: ListboxStore;
  /** Whether the listbox is {@link UseListboxOptions.multiselect}. */
  multiselect: boolean;
  /** The listbox's {@link UseListboxOptions.mode}: standalone options add the pointer press. */
  mode: 'editable' | 'select-only' | 'standalone';
  /**
   * Commits `value` (an option click): `item` stands for the option while it has not registered
   * yet, and `event` is the click behind the commit. A disabled option is never committed.
   */
  select(value: string, item: ListboxItem, event: Event): void;
  /** Highlights `value` (pointer movement); not scrolled into view, so the list stays put. */
  highlight(value: string): void;
  /**
   * Standalone mode: a pointer press on option `value` (its `mousedown`, whose default the option
   * prevents). Focuses the list without scrolling and makes the option active without scrolling
   * it into view, in one update, so the click that follows commits the pressed option even when
   * focus would have scrolled another option into view. A press on an option that cannot be
   * active (a disabled one, unless {@link UseListboxOptions.disabledOptionsFocusable}) keeps a
   * focused list's active option, and an unfocused list starts on its `autoHighlight` option,
   * not scrolled into view either. Development warns once when the list element is unknown
   * (the `ref` of {@link UseListboxResult.getListboxProps} was not passed on).
   */
  press(value: string): void;
}

/**
 * Props of {@link useListboxOption}. The option's position in the listbox follows its element's
 * DOM position, also when the option is memoized and only moved (see {@link useListbox}).
 */
export interface UseListboxOptionProps {
  /** The option's value, unique within the listbox. */
  value: string;
  /**
   * Display label; falls back to `textValue`, then the element's text content, then `value`. The
   * text content is re-read after every render of the option. Text that a child component changes
   * from its own state (without the option re-rendering) is not seen; pass `label` or `textValue`
   * for such options.
   */
  label?: string;
  /** Text matched by typeahead and filters instead of the label. */
  textValue?: string;
  /**
   * The option can never be committed; the keys skip it unless the listbox has
   * {@link UseListboxOptions.disabledOptionsFocusable}.
   * @default false
   */
  disabled?: boolean;
  /**
   * The option is hidden (its own `hidden` attribute, or a hidden group around it): it registers
   * as a hidden item ({@link ListboxItem.hidden}), so it is not navigable, and
   * `optionProps.hidden` is set from the first render (server included).
   * @default false
   */
  hidden?: boolean;
}

/**
 * Props for an option element (spread them onto the `<li>`; compose `onClick`, and `onMouseDown`
 * in standalone mode, with yours).
 */
export interface ListboxOptionElementProps<E extends HTMLElement = HTMLElement> {
  /**
   * The option's stable id ({@link UseListboxResult.getOptionId}), which `aria-activedescendant`
   * points at while the option is active.
   */
  id: string;
  role: 'option';
  'aria-selected': boolean;
  /** While disabled. */
  'aria-disabled'?: true;
  /** While filtered out or hidden. */
  hidden?: boolean;
  /** While the option is active, for styling. */
  'data-active'?: '';
  /** While selected, for styling. */
  'data-selected'?: '';
  /** While disabled, for styling. */
  'data-disabled'?: '';
  /** Commits the option (a disabled one does nothing). */
  onClick(event: React.MouseEvent<E>): void;
  /** Makes the option under the pointer active (not a disabled one), without scrolling the list. */
  onPointerMove(event: React.PointerEvent<E>): void;
  /** Standalone mode only: the pointer press ({@link ListboxContextValue.press}). */
  onMouseDown?(event: React.MouseEvent<E>): void;
  /** Registers the element; it also sets the `ref` passed to {@link useListboxOption}. */
  ref: React.RefCallback<E>;
}

/** Result of {@link useListboxOption}. */
export interface UseListboxOptionResult<E extends HTMLElement = HTMLElement> {
  /** The option's stable id. */
  id: string;
  /** Whether the option is selected. */
  selected: boolean;
  /** Whether the option is active (keyboard or pointer highlight). */
  active: boolean;
  /** Whether the option is disabled. */
  disabled: boolean;
  /** Filtered out, or hidden by its own props ({@link UseListboxOptionProps.hidden}). */
  hidden: boolean;
  /** Whether the surrounding listbox is {@link UseListboxOptions.multiselect}. */
  multiselect: boolean;
  /** Spread onto the option element (see {@link ListboxOptionElementProps}). */
  optionProps: ListboxOptionElementProps<E>;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

interface Registration {
  item: ListboxItem;
  element: React.RefObject<HTMLElement | null>;
  seq: number;
}

const EMPTY_ITEMS: ListboxItem[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

function getEmptyItems(): ListboxItem[] {
  return EMPTY_ITEMS;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function sameItem(a: ListboxItem, b: ListboxItem): boolean {
  return (
    a.value === b.value &&
    a.label === b.label &&
    a.textValue === b.textValue &&
    !!a.disabled === !!b.disabled &&
    !!a.hidden === !!b.hidden
  );
}

function sameItems(a: readonly ListboxItem[], b: readonly ListboxItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => sameItem(item, b[index]));
}

function compareRegistrations(a: Registration, b: Registration): number {
  const ea = a.element.current;
  const eb = b.element.current;
  if (ea && eb && ea !== eb && ea.isConnected && eb.isConnected) {
    const position = ea.compareDocumentPosition(eb);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  }
  return a.seq - b.seq;
}

class ListboxStoreImpl implements ListboxStore {
  private readonly indexByValue = new Map<string, number>();
  private readonly registrations = new Set<Registration>();
  private readonly stateListeners = new Set<() => void>();
  private readonly itemListeners = new Set<() => void>();
  private nextIndex = 0;
  private nextSeq = 0;
  private dirty = false;
  private flushScheduled = false;
  private itemsStale = false;
  private itemsSnapshot: ListboxItem[] = EMPTY_ITEMS;
  /** The registrations in the order of the last sort (the order {@link checkOrder} verifies). */
  private sorted: Registration[] = [];
  /** Watches the common ancestor of the option elements for moves ({@link syncObserver}). */
  private observer: MutationObserver | null = null;
  private observed: Node | null = null;
  /**
   * The observer has recorded every option move since the order was last verified, so a root
   * commit without `childList` records needs no {@link checkOrder} ({@link checkOrderAfterCommit}).
   * Cleared whenever the observed node changes: moves before `observe()` were not recorded.
   */
  private watching = false;
  /** The listbox root is mounted (between {@link connect} and {@link disconnect}). */
  private connected = false;
  private registrationMode = true;
  private active: string | null = null;
  private selected: ReadonlySet<string>;
  private hidden: ReadonlySet<string> = EMPTY_SET;

  constructor(selectedValues: readonly string[]) {
    this.selected = new Set(selectedValues);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  };

  subscribeItems = (listener: () => void): (() => void) => {
    this.itemListeners.add(listener);
    return () => {
      this.itemListeners.delete(listener);
    };
  };

  isActive = (value: string): boolean => this.active === value;
  isSelected = (value: string): boolean => this.selected.has(value);
  isHidden = (value: string): boolean => this.hidden.has(value);

  getIndex = (value: string): number => {
    let index = this.indexByValue.get(value);
    if (index === undefined) {
      index = this.nextIndex++;
      this.indexByValue.set(value, index);
    }
    return index;
  };

  register = (item: ListboxItem, element: React.RefObject<HTMLElement | null>): (() => void) => {
    const registration: Registration = { item, element, seq: this.nextSeq++ };
    this.registrations.add(registration);
    this.markDirty();
    return () => {
      this.registrations.delete(registration);
      this.markDirty();
    };
  };

  /** Registration-mode snapshot: registered options in DOM order, first of each value. */
  getItems = (): ListboxItem[] => {
    if (this.itemsStale) {
      this.itemsStale = false;
      const sorted = Array.from(this.registrations).sort(compareRegistrations);
      this.sorted = sorted;
      const seen = new Set<string>();
      const next: ListboxItem[] = [];
      for (const { item } of sorted) {
        if (seen.has(item.value)) continue;
        seen.add(item.value);
        next.push(item);
      }
      if (!sameItems(next, this.itemsSnapshot)) this.itemsSnapshot = next;
    }
    return this.itemsSnapshot;
  };

  /** The mounted element of an option (for scrolling); passed on detached, hence an arrow. */
  getElement = (value: string): HTMLElement | null => {
    for (const { item, element } of this.registrations) {
      const el = element.current;
      if (item.value === value && el && el.isConnected) return el;
    }
    return null;
  };

  setRegistrationMode(enabled: boolean): void {
    if (enabled === this.registrationMode) return;
    this.registrationMode = enabled;
    this.syncObserver();
  }

  /** The listbox root mounted (layout effect): start watching the option elements for moves. */
  connect(): void {
    this.connected = true;
    this.syncObserver();
  }

  /** The listbox root unmounted: stop watching. */
  disconnect(): void {
    this.connected = false;
    this.syncObserver();
  }

  /** Publishes pending registrations: one notification for everything registered since the last. */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.itemsStale = true;
    if (this.registrationMode) this.warnDuplicates();
    this.syncObserver();
    this.notifyItems();
  }

  /**
   * Re-sorts (and publishes) when the registered elements are no longer in document order. A keyed
   * reorder (a sort toggle, re-ranked results) moves option elements without registering them
   * again, so the order is verified after a commit of the listbox root that moved option elements
   * ({@link checkOrderAfterCommit}) and whenever the option elements move ({@link syncObserver}):
   * neighbours of the last sort are compared (n - 1 `compareDocumentPosition` calls), and only an
   * inversion publishes. Pending registrations are left to {@link flush}, which sorts anyway.
   */
  checkOrder(): void {
    if (!this.registrationMode || this.dirty || this.itemsStale) return;
    const sorted = this.sorted;
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1].element.current;
      const b = sorted[i].element.current;
      if (!a || !b || a === b || !a.isConnected || !b.isConnected) continue;
      if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) {
        this.itemsStale = true;
        this.notifyItems();
        return;
      }
    }
  }

  /**
   * The listbox root committed (layout effect): verifies the order when the commit may have moved
   * option elements. While the observer watches them, the moves of this commit are its pending
   * `childList` records (the callback runs only in a later microtask): they are taken here, so a
   * keyed reorder re-sorts in the same commit and is not checked again by the callback, and a
   * commit without records (a highlight move) costs O(1). Without an observer (fewer than two
   * options, no `MutationObserver`) or right after it started watching, every commit checks.
   */
  checkOrderAfterCommit(): void {
    // Only childList is observed, so every pending record is an insertion or removal.
    const moved = this.observer !== null && this.observer.takeRecords().length > 0;
    const recorded = this.watching;
    this.watching = this.observed !== null;
    if (recorded && !moved) return;
    this.checkOrder();
  }

  /** Syncs the root's derived render state for the option selectors (layout effect). */
  setRenderState(
    active: string | null,
    selected: ReadonlySet<string>,
    hidden: ReadonlySet<string>,
  ): void {
    let changed = false;
    if (active !== this.active) {
      this.active = active;
      changed = true;
    }
    if (!sameSet(selected, this.selected)) {
      this.selected = selected;
      changed = true;
    }
    if (!sameSet(hidden, this.hidden)) {
      this.hidden = hidden;
      changed = true;
    }
    if (changed) for (const listener of Array.from(this.stateListeners)) listener();
  }

  private notifyItems(): void {
    for (const listener of Array.from(this.itemListeners)) listener();
  }

  private readonly onMutation = (): void => {
    this.checkOrder();
  };

  /**
   * Observes (`childList`, `subtree`) the closest common ancestor of the connected option elements,
   * so a move that renders neither the listbox root nor the options — memoized options or hoisted
   * elements reordered by a wrapper component inside the listbox — still triggers
   * {@link checkOrder}. Recomputed when the registrations change (a remounted list registers
   * again); nothing is observed with fewer than two options, in data mode, before the root mounted
   * or without `MutationObserver` (server). Attribute and text changes are not observed.
   *
   * All options must live in one container at a time (consumer contract): options split over an
   * inline and a portaled list have `<body>` as their common ancestor, so every DOM mutation on
   * the page would re-check the order — development warns once.
   */
  private syncObserver(): void {
    const target =
      this.connected && this.registrationMode && typeof MutationObserver !== 'undefined'
        ? this.commonAncestor()
        : null;
    if (target === this.observed) return;
    this.observer?.disconnect();
    this.observed = target;
    this.watching = false;
    if (!target) return;
    if (isDev) warnIfPageWide(target);
    this.observer ??= new MutationObserver(this.onMutation);
    this.observer.observe(target, { childList: true, subtree: true });
  }

  private commonAncestor(): Node | null {
    let ancestor: Node | null = null;
    let count = 0;
    for (const { element } of this.registrations) {
      const el = element.current;
      if (!el || !el.isConnected) continue;
      count++;
      if (ancestor === null) {
        ancestor = el.parentNode;
        continue;
      }
      while (ancestor && !ancestor.contains(el)) ancestor = ancestor.parentNode;
      if (!ancestor) return null;
    }
    return count > 1 ? ancestor : null;
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      this.flush();
    });
  }

  private warnDuplicates(): void {
    const seen = new Set<string>();
    for (const { item } of this.registrations) {
      if (seen.has(item.value)) warnDuplicateValue(item.value);
      seen.add(item.value);
    }
  }
}

function warnDuplicateValue(value: string): void {
  warnOnce(
    `useListbox:duplicate:${value}`,
    `Listbox: several options share the value "${value}". Option values must be unique within ` +
      'a listbox; only the first one can be highlighted and selected.',
  );
}

function warnIfPageWide(ancestor: Node): void {
  const doc = ancestor.ownerDocument;
  if (!doc || (ancestor !== doc.body && ancestor !== doc.documentElement)) return;
  warnOnce(
    'useListbox:single-container',
    'Listbox: the options of one listbox are rendered in more than one container (for example an ' +
      'inline list kept mounted next to a portaled one). All options must live in a single ' +
      'container at a time: render the list inline only while closed and in the portal only ' +
      'while open.',
  );
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

/**
 * The listbox context of the options, provided by `ListboxProvider` (and `ListboxSurface`, which
 * renders one). Not public: a context object would need flat names for its `Provider` and
 * `Consumer` members.
 */
export const ListboxContext: React.Context<ListboxContextValue | null> =
  React.createContext<ListboxContextValue | null>(null);
ListboxContext.displayName = 'ListboxContext';

let inertContext: ListboxContextValue | null = null;

function getInertContext(): ListboxContextValue {
  inertContext ??= {
    listboxId: 'wave-listbox-inert',
    store: new ListboxStoreImpl([]),
    multiselect: false,
    mode: 'select-only',
    select: () => {},
    highlight: () => {},
    press: () => {},
  };
  return inertContext;
}

function useListboxContext(componentName: string): ListboxContextValue {
  const context = useContext(ListboxContext);
  if (context) return context;
  reportMissingContext(
    componentName,
    'a listbox (Listbox, Combobox, Dropdown or a ListboxProvider)',
  );
  return getInertContext();
}

/* ------------------------------------------------------------------ */
/*  collectOptionLabels                                                */
/* ------------------------------------------------------------------ */

const LISTBOX_ELEMENT_KIND = Symbol.for('@mortenbrudvik/waveui/listbox-element-kind');

/**
 * What {@link collectOptionLabels} does with the elements of a component marked by
 * {@link markListboxElement}: `'option'` reads a value and its label, `'group'` walks the children.
 */
export type ListboxElementKind = 'option' | 'group';

/**
 * Marks a component so {@link collectOptionLabels} recognises its elements: `'option'` (reads its
 * `value` prop and its label: the `label` prop, else `textValue`, else its text children, as
 * `Option`'s) or `'group'` (walks its `children`). Returns the component (function, `memo` or
 * `forwardRef` components). Mark every option or group component of your own that is rendered in
 * a listbox (`Option` and `OptionGroup` are marked): unmarked components are opaque to
 * {@link collectOptionLabels}, so their labels are unknown on the server and in the first client
 * render.
 *
 * @example
 * // Option components of your own, built on useListboxOption:
 * export const ColorOption = markListboxElement(ColorOptionImpl, 'option');
 * export const ColorGroup = markListboxElement(ColorGroupImpl, 'group');
 */
export function markListboxElement<C extends object>(component: C, kind: ListboxElementKind): C {
  Object.defineProperty(component, LISTBOX_ELEMENT_KIND, { value: kind, configurable: true });
  return component;
}

function kindOf(type: unknown): ListboxElementKind | undefined {
  if ((typeof type !== 'function' && typeof type !== 'object') || type === null) return undefined;
  const kind = (type as { [LISTBOX_ELEMENT_KIND]?: unknown })[LISTBOX_ELEMENT_KIND];
  return kind === 'option' || kind === 'group' ? kind : undefined;
}

interface OptionElementProps {
  value?: unknown;
  label?: unknown;
  textValue?: unknown;
  children?: React.ReactNode;
}

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    // Host elements and Fragments render their children; custom components are opaque.
    if (typeof node.type === 'string' || node.type === React.Fragment) {
      return textOf(node.props.children);
    }
    return '';
  }
  if (typeof node === 'object' && Symbol.iterator in node) {
    let text = '';
    for (const child of node as Iterable<React.ReactNode>) text += textOf(child);
    return text;
  }
  return '';
}

function optionLabel(props: OptionElementProps, value: string): string | undefined {
  if (typeof props.label === 'string') return props.label;
  if (typeof props.textValue === 'string') return props.textValue;
  if (props.children === null || props.children === undefined) return value;
  const text = textOf(props.children).trim();
  return text || undefined;
}

function walkOptions(children: React.ReactNode, labels: Map<string, string>): void {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<OptionElementProps>(child)) return;
    // An Option or OptionGroup written in a Server Component arrives as a lazy type: unwrap it.
    const type = getElementType(child);
    if (type === React.Fragment) {
      walkOptions(child.props.children, labels);
      return;
    }
    const kind = kindOf(type);
    if (kind === 'group') {
      walkOptions(child.props.children, labels);
      return;
    }
    if (kind !== 'option') return;
    const { value } = child.props;
    if (typeof value !== 'string' || labels.has(value)) return;
    const label = optionLabel(child.props, value);
    if (label !== undefined) labels.set(value, label);
  });
}

/**
 * Reads option labels from `children` during render (read-only), for display text before the
 * options have registered: on the server, in the first client render and during hydration
 * (layout effects have not run yet). Walks elements of components marked with
 * {@link markListboxElement}: `'option'` elements give `value → label` (`label` prop →
 * `textValue` → the text of their string/number children and host elements → `value` when they
 * have no children); `'group'` elements and Fragments are walked into. Other components are
 * opaque (their options resolve after registration). The first option of a value wins. A lazy
 * element type (an option or group written in a React Server Component) is unwrapped first.
 *
 * Display text = `listbox.getItem(value)?.label ?? collectOptionLabels(children).get(value)`
 * (`?? value` for freeform input only).
 */
export function collectOptionLabels(children: React.ReactNode): Map<string, string> {
  const labels = new Map<string, string>();
  walkOptions(children, labels);
  return labels;
}

/* ------------------------------------------------------------------ */
/*  useListbox                                                         */
/* ------------------------------------------------------------------ */

function hasText(element: EventTarget): boolean {
  return (
    (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
    element.value !== ''
  );
}

/** Ctrl/Cmd shortcuts that change the text: cut, paste, undo, redo. */
const TEXT_SHORTCUTS: ReadonlySet<string> = new Set(['x', 'v', 'z', 'y']);

/**
 * Editable: whether a keydown edits the text of the combobox input — printable characters (AltGr,
 * i.e. Ctrl+Alt, included), Backspace/Delete, the cut/paste/undo/redo shortcuts and the
 * `Process`/`Unidentified` keys of IMEs and virtual keyboards. Nothing edits a read-only or
 * disabled input.
 */
function editsText(event: React.KeyboardEvent): boolean {
  const target = event.currentTarget;
  if (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    (target.readOnly || target.disabled)
  ) {
    return false;
  }
  const { key } = event;
  if (key === 'Backspace' || key === 'Delete' || key === 'Process' || key === 'Unidentified') {
    return true;
  }
  if (key.length !== 1) return false;
  const shortcut = event.metaKey || (event.ctrlKey && !isAltGraphCharacter(event));
  return !shortcut || TEXT_SHORTCUTS.has(key.toLowerCase());
}

function preventMouseDown(event: React.MouseEvent): void {
  event.preventDefault();
}

/**
 * The listbox behaviour of Listbox, Combobox, Dropdown, TagPicker and TimePicker, and the base of a
 * custom picker: one navigable option list drives the highlight, `aria-activedescendant` and the
 * commit, so the highlighted option is always the one Enter selects. The highlight is
 * {@link useActiveDescendant}'s.
 *
 * - **Items.** Data mode (`items`) or registration mode: `Option`s, or option components of your
 *   own on {@link useListboxOption}, register inside the listbox's context (`context`, which
 *   `ListboxSurface` and `ListboxProvider` provide) in DOM order, `OptionGroup`s included. The
 *   registrations of one commit are published once from this hook's layout effect (which runs
 *   after the options'); later additions/removals are published once per microtask. A keyed
 *   reorder of the same options re-sorts them: the DOM order is re-checked after a commit of this
 *   hook's component that moved option elements (a highlight move moves none, so it costs O(1))
 *   and, while it is mounted, whenever option elements move (a `MutationObserver` on their
 *   common ancestor) — so memoized options or hoisted elements that a wrapper component inside
 *   the listbox reorders are re-sorted too, although neither the options nor this component
 *   render. Options register even when filtered out or hidden (they render `hidden` and are not
 *   navigable), so labels are always known — use {@link collectOptionLabels} for the display text
 *   before registration (SSR/first render). `filter` is the navigability predicate, which a
 *   picker builds from its query.
 * - **Active option** is derived during render: the highlighted value, else the `autoHighlight`
 *   fallback. The highlight is reset on close and after a single-select commit that closes the
 *   listbox, and dropped once it is not navigable any more (filtered out, hidden, removed by an
 *   update, or disabled without `disabledOptionsFocusable`), so it does not come back without a
 *   user action when the option returns. With
 *   `highlightOnFilter` the first option becomes active whenever the options change while open
 *   (`useActiveDescendant`'s `activateFirstOnChange`). Editable: a text-editing key (printable
 *   characters, Backspace/Delete, cut/paste/undo/redo) clears the highlight — visual focus
 *   returns to the textbox (APG) — so Enter after typing never commits an option highlighted
 *   before the edit; with `highlightOnFilter` the key makes the first option active instead.
 * - **Ids** `${listboxId}-opt-${n}` are stable per value (across filtering and remounts between
 *   an inline closed list and a portaled open list).
 * - **Store.** Options read their active/selected/hidden flags through a store, so moving the
 *   highlight re-renders only the old and the new option.
 * - **Keys (APG).** Editable: ArrowDown/ArrowUp open (selected, else first/last) and move;
 *   Alt+ArrowDown opens without moving; Alt+ArrowUp closes; Enter commits the active option (with
 *   the listbox closed Enter is not prevented, so forms submit); Escape closes (closed + text:
 *   `onClearDraft`); Tab closes; Home/End/printable keys stay with the input (text-editing keys
 *   clear the highlight, see above). Select-only:
 *   ArrowDown/ArrowUp/Home/End/typeahead open and position (a closed typeahead starts from the
 *   selected option; characters typed with AltGr, i.e. Ctrl+Alt on Windows, count); PageUp/PageDown
 *   jump 10; Enter/Space open or commit (always prevented on keydown, Space also on keyup, so a
 *   `<button>` combobox is not clicked again; a Space typed within 500 ms of a typeahead character
 *   continues the search instead); Alt+ArrowUp and Tab commit and close in single-select mode
 *   (with `multiselect` they only close; Tab is not prevented); Escape closes. Standalone (the
 *   list has focus; nothing opens or closes): ArrowDown/ArrowUp move (from no active option to
 *   the first/last), Home/End, PageUp/PageDown (10) and typeahead move; Enter and Space commit
 *   and keep the committed option active (a Space typed within 500 ms of a typeahead character
 *   continues the search instead); Tab, Escape and Alt+Arrow keys are not handled and not
 *   prevented, so the page and enclosing layers get them.
 *   "Selected" means the first selected navigable option in list order. Disabled options are
 *   skipped unless `disabledOptionsFocusable`, and never committed; hidden options are not
 *   navigable at all.
 * - The active option is scrolled into view (`{ block: 'nearest' }`) in a layout effect, except
 *   after a pointer highlight or a pointer press (the list would scroll under the pointer).
 *
 * **Consumer contract** (Listbox, Combobox, Dropdown, TagPicker, TimePicker and custom pickers):
 * - All options of a listbox live in a single container at a time (inline only while closed,
 *   portaled only while open — never both, not even for an exit animation; `ListboxSurface` does
 *   this). Options split over two containers are watched from `<body>` and registered twice
 *   (development warns).
 * - Spread `getComboboxProps()` onto the combobox element and attach **both** `onKeyDown` and
 *   `onKeyUp` to it (compose them with your own handlers). `onKeyUp` is required for a
 *   `<button>` combobox (select-only): without it the button's native click on Space keyup
 *   toggles the listbox again after a keydown commit.
 * - Registration mode: mark option and group components of your own with
 *   {@link markListboxElement} (`Option` and `OptionGroup` are marked; memo components can be
 *   marked too). {@link collectOptionLabels} walks only marked components, so without the marks
 *   the server render and the first client render have no display text.
 * - Display text: `getItem(value)?.label ?? collectOptionLabels(children).get(value)` (`?? value`
 *   for freeform input only). Editable pickers pass `onClearDraft` for Escape on a closed list.
 * - A popup list renders in `ListboxSurface`, placed and dismissed by `useListboxPopup`; a list
 *   rendered without it gets the options' context from `ListboxProvider`.
 * - Standalone mode (a listbox that holds focus): spread `getListboxProps()` onto the list and
 *   merge its `ref` with yours (a pointer press on an option focuses the list through it), attach
 *   `onKeyDown` to the list and pass the list's focus state as `open`. `getComboboxProps()` is not
 *   used.
 */
export function useListbox(options: UseListboxOptions): UseListboxResult {
  const {
    open,
    onOpenChange: onOpenChangeProp,
    mode,
    multiselect = false,
    selectedValues,
    onSelect,
    items: dataItems,
    filter,
    loop = false,
    typeahead = mode !== 'editable',
    disabledOptionsFocusable = false,
    autoHighlight = 'selected',
    highlightOnFilter = false,
    onActiveValueChange,
    idPrefix,
    onClearDraft,
  } = options;

  const standalone = mode === 'standalone';
  // Standalone mode has nothing to open or close (`open` is the list's focus state), so every open
  // change requested below — a key, a commit, a typeahead match — reaches no callback there.
  const onOpenChange = standalone ? undefined : onOpenChangeProp;
  // Standalone mode: the list element (from getListboxProps().ref), which a pointer press focuses.
  const [listElement, setListElement] = useState<HTMLElement | null>(null);

  const listboxId = useId(idPrefix ?? 'listbox');
  const [store] = useState(() => new ListboxStoreImpl(selectedValues));
  const dataMode = dataItems !== undefined;
  const registered = useSyncExternalStore(
    store.subscribeItems,
    dataMode ? getEmptyItems : store.getItems,
    getEmptyItems,
  );
  const allItems: readonly ListboxItem[] = dataItems ?? registered;

  const navigable = useMemo(
    () => allItems.filter((item) => !item.hidden && (!filter || filter(item))),
    [allItems, filter],
  );
  // The values useActiveDescendant navigates: enabled navigable items, or every navigable item
  // (disabled included) with disabledOptionsFocusable.
  const navigationValues = useMemo(
    () =>
      disabledOptionsFocusable
        ? navigable.map((item) => item.value)
        : navigable.filter((item) => !item.disabled).map((item) => item.value),
    [navigable, disabledOptionsFocusable],
  );
  const itemByValue = useMemo(() => {
    const map = new Map<string, ListboxItem>();
    for (const item of allItems) if (!map.has(item.value)) map.set(item.value, item);
    return map;
  }, [allItems]);
  // Filtered-out and hidden items: registered options read it to render `hidden`.
  const hiddenSet = useMemo(() => {
    if (navigable.length === allItems.length) return EMPTY_SET;
    const visible = new Set(navigable.map((item) => item.value));
    const hidden = new Set<string>();
    for (const item of allItems) if (!visible.has(item.value)) hidden.add(item.value);
    return hidden;
  }, [allItems, navigable]);
  const selectedSet = new Set(selectedValues);

  // In list order (APG), not in the order the values were selected.
  const firstSelected = navigationValues.find((value) => selectedSet.has(value)) ?? null;
  let fallback: string | null = null;
  if (autoHighlight === 'selected') fallback = firstSelected ?? navigationValues[0] ?? null;
  else if (autoHighlight === 'first') fallback = navigationValues[0] ?? null;

  const getOptionId = useCallback(
    (value: string) => `${listboxId}-opt-${store.getIndex(value)}`,
    [listboxId, store],
  );
  const getItem = useCallback((value: string) => itemByValue.get(value), [itemByValue]);

  // The active option, derived during render (C-HOOKS: no effect): the highlighted value (keyboard,
  // pointer, typeahead, setActiveValue), else the autoHighlight fallback. The highlight is forgotten
  // on close (one set while closed survives only when the same update opens the listbox) and
  // dropped once it is not navigable any more (filtered out, hidden, removed by an update, or
  // disabled without disabledOptionsFocusable), so it does not come back without a user action
  // when the option returns. highlightOnFilter: the first option whenever the navigable options
  // change while open, compared by content (an inline `filter` yields new arrays on every render)
  // and with the options before opening, so the keystroke that opens the listbox and filters it in
  // one update counts; opening with unchanged options (ArrowDown, a click) keeps the autoHighlight
  // start. Every highlight but the pointer's (a hover, a standalone press) is scrolled into view
  // (the list would scroll under the pointer).
  const ad = useActiveDescendant({
    items: navigationValues,
    getId: getOptionId,
    enabled: open,
    fallback,
    loop,
    activateFirstOnChange: highlightOnFilter,
    getElement: store.getElement,
    onActiveValueChange,
  });
  const { activeValue, activeDescendantId } = ad;

  const commit = useEventCallback(
    (value: string, reason: 'select' | 'tab', event: Event, fallbackItem?: ListboxItem): void => {
      const item = itemByValue.get(value) ?? fallbackItem;
      if (!item || item.disabled) return;
      onSelect(value, { item, event });
      // Standalone and multi-select commits keep the list as it is, on the committed option.
      if (standalone || (multiselect && reason === 'select')) {
        ad.setActiveValue(value);
      } else {
        ad.setActiveValue(null);
        onOpenChange?.(false, { reason, event });
      }
    },
  );

  const select = useEventCallback((value: string, item: ListboxItem, event: Event) => {
    commit(value, 'select', event, item);
  });

  // Standalone: an option's mousedown (its default prevented, so the browser neither focuses nor
  // scrolls). Focusing the list and moving to the option land in one update, so the render that
  // enables the active option (the consumer's focus state) has the pressed one, not the fallback
  // that the scroll effect would scroll under the pointer before the click. An option that
  // cannot be active is not moved to (the next render would drop it together with the highlight):
  // a focused list keeps its active option, and an unfocused one (`open` is its focus state)
  // starts on its fallback, moved to without scrolling for the same reason.
  const press = useEventCallback((value: string) => {
    if (listElement) {
      listElement.focus({ preventScroll: true });
    } else if (standalone) {
      warnOnce(
        'useListbox:list-ref',
        'useListbox: the list element is unknown, so a pointer press cannot focus the list. Pass ' +
          'the `ref` of `getListboxProps()` to the list element, merged with your own ref.',
      );
    }
    if (navigationValues.includes(value)) ad.setActiveValue(value, { scroll: false });
    else if (!open && fallback !== null) ad.setActiveValue(fallback, { scroll: false });
  });

  // The native keydown event behind a typeahead match, so onMatch (called from inside
  // onTypeahead(), itself only ever called from onKeyDown below) can report it: onMatch has no
  // event parameter of its own (useTypeahead is unchanged by this hook).
  const keyEventRef = useRef<Event | null>(null);

  const { onTypeahead } = useTypeahead({
    getItems: () =>
      navigable.map((item) => ({
        value: item.value,
        text: item.textValue ?? item.label,
        disabled: disabledOptionsFocusable ? false : item.disabled,
      })),
    onMatch: (value) => {
      ad.setActiveValue(value);
      const event = keyEventRef.current;
      if (!open && event) onOpenChange?.(true, { reason: 'keyboard', event });
    },
  });

  const onKeyDown = useEventCallback((event: React.KeyboardEvent) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    // Every open change and commit below comes from this key, so its native event is always
    // available; kept in a ref too, for the typeahead match handled outside this closure.
    keyEventRef.current = event.nativeEvent;
    // Editable: a key that edits the text returns visual focus to the textbox (APG) and is left to
    // the input: the highlight is cleared (highlightOnFilter: the first option), so Enter after
    // typing never commits an option highlighted before the edit.
    if (mode === 'editable' && open && editsText(event)) {
      ad.setActiveValue(highlightOnFilter ? (navigationValues[0] ?? null) : null);
    }
    const altGraph = isAltGraphCharacter(event);
    if ((event.ctrlKey && !altGraph) || event.metaKey) return;
    const { key, altKey } = event;
    // Standalone: nothing opens or closes, so Tab, Escape and Alt+Arrow keys are left to the page
    // and to enclosing layers (a Dialog's Escape), returned before anything is prevented.
    if (standalone && (key === 'Tab' || key === 'Escape' || (altKey && key.startsWith('Arrow')))) {
      return;
    }
    const selectOnly = mode === 'select-only';
    // Select-only and standalone: Home/End, PageUp/PageDown, Enter and Space act on the list.
    const editable = mode === 'editable';
    const first = navigationValues[0] ?? null;
    const last = navigationValues[navigationValues.length - 1] ?? null;

    const openWith = (value: string | null) => {
      ad.setActiveValue(value);
      if (!open) onOpenChange?.(true, { reason: 'keyboard', event: event.nativeEvent });
    };
    const commitOrClose = () => {
      if (activeValue !== null) commit(activeValue, 'select', event.nativeEvent);
      else if (!multiselect) {
        onOpenChange?.(false, { reason: 'keyboard', event: event.nativeEvent });
      }
    };

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (altKey) {
          if (!open) onOpenChange?.(true, { reason: 'keyboard', event: event.nativeEvent });
        } else if (!open) {
          openWith(firstSelected ?? first);
        } else {
          ad.next();
        }
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (altKey) {
          if (!open) return;
          // A disabled active option (disabledOptionsFocusable) closes instead of committing:
          // commit()'s own guard would otherwise leave the key unhandled.
          if (
            selectOnly &&
            !multiselect &&
            activeValue !== null &&
            !itemByValue.get(activeValue)?.disabled
          ) {
            commit(activeValue, 'select', event.nativeEvent);
          } else {
            onOpenChange?.(false, { reason: 'keyboard', event: event.nativeEvent });
          }
        } else if (!open) {
          openWith(firstSelected ?? last);
        } else {
          ad.prev();
        }
        return;
      case 'Home':
      case 'End':
        if (editable) return;
        event.preventDefault();
        openWith(key === 'Home' ? first : last);
        return;
      case 'PageUp':
      case 'PageDown':
        if (editable || !open) return;
        event.preventDefault();
        // Clamped at the ends, never wrapping (also with loop).
        ad.move(key === 'PageDown' ? 10 : -10);
        return;
      case 'Enter':
        if (editable) {
          // Closed: not prevented, so the surrounding form submits (APG).
          if (open && activeValue !== null) {
            event.preventDefault();
            commit(activeValue, 'select', event.nativeEvent);
          }
          return;
        }
        event.preventDefault();
        if (!open) onOpenChange?.(true, { reason: 'keyboard', event: event.nativeEvent });
        else commitOrClose();
        return;
      case 'Escape':
        if (open) {
          event.preventDefault();
          onOpenChange?.(false, { reason: 'escape', event: event.nativeEvent });
        } else if (editable && onClearDraft && hasText(event.currentTarget)) {
          event.preventDefault();
          onClearDraft();
        }
        return;
      case 'Tab':
        if (!open) return;
        // A disabled active option (disabledOptionsFocusable) closes instead of committing: see
        // the Alt+ArrowUp comment above.
        if (
          selectOnly &&
          !multiselect &&
          activeValue !== null &&
          !itemByValue.get(activeValue)?.disabled
        ) {
          commit(activeValue, 'tab', event.nativeEvent);
        } else {
          onOpenChange?.(false, { reason: 'tab', event: event.nativeEvent });
        }
        return;
      default:
        break;
    }

    if (key === ' ' && editable) return;
    if (!typeahead || (altKey && !altGraph) || key.length !== 1) {
      if (key === ' ' && !editable) {
        event.preventDefault();
        if (!open) onOpenChange?.(true, { reason: 'keyboard', event: event.nativeEvent });
        else commitOrClose();
      }
      return;
    }
    const current = open ? activeValue : firstSelected;
    if (onTypeahead(event, current)) {
      event.preventDefault();
      return;
    }
    if (key === ' ') {
      // Not part of a typeahead search: Space opens or commits (select-only; standalone: commits).
      event.preventDefault();
      if (!open) onOpenChange?.(true, { reason: 'keyboard', event: event.nativeEvent });
      else commitOrClose();
      return;
    }
    if (selectOnly && !open) {
      event.preventDefault();
      onOpenChange?.(true, { reason: 'keyboard', event: event.nativeEvent });
    }
  });

  const onKeyUp = useEventCallback((event: React.KeyboardEvent) => {
    // A <button> clicks on Space keyup: the keydown already opened or committed.
    if (mode === 'select-only' && event.key === ' ') event.preventDefault();
  });

  // Publish the registrations of this commit once, re-check the DOM order when this commit moved
  // options (a keyed reorder moves them without registering them again; a highlight move does not
  // move any), then sync the option selectors.
  useLayoutEffect(() => {
    store.setRegistrationMode(!dataMode);
    store.flush();
    store.checkOrderAfterCommit();
    store.setRenderState(activeValue, selectedSet, hiddenSet);
  });

  // While mounted, option moves that render neither this root nor the options (memoized options
  // reordered by a wrapper component) re-check the order through a MutationObserver.
  useLayoutEffect(() => {
    store.connect();
    return () => store.disconnect();
  }, [store]);

  useEffect(() => {
    if (!dataItems) return;
    const seen = new Set<string>();
    for (const item of dataItems) {
      if (seen.has(item.value)) warnDuplicateValue(item.value);
      seen.add(item.value);
    }
  }, [dataItems]);

  const context = useMemo<ListboxContextValue>(
    () => ({ listboxId, store, multiselect, mode, select, highlight: ad.highlight, press }),
    [listboxId, store, multiselect, mode, select, ad.highlight, press],
  );

  return {
    listboxId,
    activeValue,
    activeDescendantId,
    items: navigable,
    getItem,
    getOptionId,
    setActiveValue: ad.setActiveValue,
    onKeyDown,
    onKeyUp,
    getComboboxProps: () => {
      const props: ListboxComboboxProps = {
        role: 'combobox',
        'aria-expanded': open,
        'aria-controls': listboxId,
        'aria-haspopup': 'listbox',
      };
      if (activeDescendantId !== undefined) props['aria-activedescendant'] = activeDescendantId;
      if (mode === 'editable') props['aria-autocomplete'] = 'list';
      return props;
    },
    getListboxProps: () => {
      // Standalone: the list takes focus (its ref, for the pointer press) and carries the active
      // descendant; the combobox modes keep focus on the combobox.
      const props: ListboxListProps = standalone
        ? { id: listboxId, role: 'listbox', tabIndex: 0, ref: setListElement }
        : { id: listboxId, role: 'listbox', tabIndex: -1, onMouseDown: preventMouseDown };
      if (standalone && activeDescendantId !== undefined) {
        props['aria-activedescendant'] = activeDescendantId;
      }
      if (multiselect) props['aria-multiselectable'] = true;
      return props;
    },
    context,
  };
}

/* ------------------------------------------------------------------ */
/*  useListboxOption                                                   */
/* ------------------------------------------------------------------ */

const FLAG_ACTIVE = 1;
const FLAG_SELECTED = 2;
const FLAG_HIDDEN = 4;

/** What an option registered last (compared after each commit, see {@link useListboxOption}). */
interface OptionRegistration {
  store: ListboxStore;
  item: ListboxItem;
  unregister: () => void;
}

function optionFlags(store: ListboxStore, value: string): number {
  return (
    (store.isActive(value) ? FLAG_ACTIVE : 0) |
    (store.isSelected(value) ? FLAG_SELECTED : 0) |
    (store.isHidden(value) ? FLAG_HIDDEN : 0)
  );
}

/**
 * An option of the surrounding listbox, for option components of your own: the listbox's context
 * comes from `ListboxSurface` or `ListboxProvider` ({@link UseListboxResult.context}). Registers
 * the option (registration mode) and its element, and reads its flags from the listbox store, so
 * it re-renders only when its own active/selected/hidden state changes. Spread `optionProps` onto
 * the `<li>` (`id`, `role="option"`, `aria-selected`, `aria-disabled`, `hidden`, and
 * `data-active`/`data-selected`/`data-disabled` for styling) and compose its `onClick` — and in
 * standalone mode its `onMouseDown`, the pointer press — with your own handlers. Mark the
 * component with {@link markListboxElement}, so its label is known before it registers.
 *
 * Throws in development when used outside a listbox; in production it logs the error once and
 * renders an inert option.
 *
 * @typeParam E The option element type (`HTMLLIElement` for an `<li>`), so `ref` needs no cast.
 */
export function useListboxOption<E extends HTMLElement = HTMLElement>(
  props: UseListboxOptionProps,
  ref?: React.Ref<E>,
): UseListboxOptionResult<E> {
  const context = useListboxContext('Option');
  const { store, listboxId, multiselect, mode, select, highlight, press } = context;
  const { value, label, textValue, disabled = false, hidden: hiddenByConsumer = false } = props;

  const id = `${listboxId}-opt-${store.getIndex(value)}`;
  const flags = useSyncExternalStore(
    store.subscribe,
    () => optionFlags(store, value),
    () => optionFlags(store, value),
  );
  const active = (flags & FLAG_ACTIVE) !== 0;
  const selected = (flags & FLAG_SELECTED) !== 0;
  const hidden = hiddenByConsumer || (flags & FLAG_HIDDEN) !== 0;

  const elementRef = useRef<E | null>(null);
  const setElement = useCallback((element: E | null) => {
    elementRef.current = element;
  }, []);
  const mergedRef = useMergedRefs<E>(ref, setElement);
  const registrationRef = useRef<OptionRegistration | null>(null);

  // After every commit of this option: (re-)register when the item changed — including a label
  // read from the element's text, which any re-render can change. A move (keyed reorder) does not
  // register again; the listbox root sees it through its root commit or its MutationObserver.
  useLayoutEffect(() => {
    const text =
      label === undefined && textValue === undefined
        ? elementRef.current?.textContent?.trim()
        : undefined;
    const item: ListboxItem = { value, label: label ?? textValue ?? (text || value) };
    if (textValue !== undefined) item.textValue = textValue;
    if (disabled) item.disabled = true;
    if (hiddenByConsumer) item.hidden = true;
    const current = registrationRef.current;
    if (current && current.store === store && sameItem(current.item, item)) return;
    current?.unregister();
    registrationRef.current = { store, item, unregister: store.register(item, elementRef) };
  });
  useLayoutEffect(
    () => () => {
      registrationRef.current?.unregister();
      registrationRef.current = null;
    },
    [],
  );

  const onClick = useCallback(
    (event: React.MouseEvent<E>) => {
      if (disabled) return;
      const item: ListboxItem = { value, label: label ?? textValue ?? value };
      if (textValue !== undefined) item.textValue = textValue;
      select(value, item, event.nativeEvent);
    },
    [select, value, label, textValue, disabled],
  );

  const onPointerMove = useCallback(() => {
    if (!disabled && !store.isActive(value)) highlight(value);
  }, [highlight, store, value, disabled]);

  // Standalone: the browser would focus the list itself, and focus would scroll the list's
  // active option into view under the pointer before the click; the press focuses the list
  // without scrolling and makes this option active instead.
  const onMouseDown = useCallback(
    (event: React.MouseEvent<E>) => {
      event.preventDefault();
      press(value);
    },
    [press, value],
  );

  const optionProps: ListboxOptionElementProps<E> = {
    id,
    role: 'option',
    'aria-selected': selected,
    onClick,
    onPointerMove,
    ref: mergedRef,
  };
  if (mode === 'standalone') optionProps.onMouseDown = onMouseDown;
  if (disabled) {
    optionProps['aria-disabled'] = true;
    optionProps['data-disabled'] = '';
  }
  if (hidden) optionProps.hidden = true;
  if (active) optionProps['data-active'] = '';
  if (selected) optionProps['data-selected'] = '';

  return { id, selected, active, disabled, hidden, multiselect, optionProps };
}
