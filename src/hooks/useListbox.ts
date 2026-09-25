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
import { useEventCallback } from './useEventCallback';
import { useId } from './useId';
import { useMergedRefs } from './useMergedRefs';
import { isAltGraphCharacter, useTypeahead } from './useTypeahead';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/** One option of a listbox. */
export interface ListboxItem {
  /** Unique value within the listbox. */
  value: string;
  /** Display label (Combobox input text, Dropdown trigger text). */
  label: string;
  /** Text matched by typeahead and filters instead of `label`. */
  textValue?: string;
  /** Disabled options are rendered but skipped by navigation and never committed. */
  disabled?: boolean;
  /**
   * Hidden options (the consumer's `hidden` attribute) are left out of navigation and rendering
   * like filtered-out ones: never highlighted, reached by typeahead or committed with the keyboard
   * (registered options render `hidden`). Their label stays known
   * ({@link UseListboxResult.getItem}).
   */
  hidden?: boolean;
}

/** Why {@link UseListboxOptions.onOpenChange} was called. */
export type ListboxOpenChangeReason = 'keyboard' | 'select' | 'escape' | 'tab';

/** Options of {@link useListbox}. */
export interface UseListboxOptions {
  /** Whether the listbox is shown. The consumer owns the open state. */
  open: boolean;
  /** Called when a key (or a commit) wants to open or close the listbox. */
  onOpenChange: (open: boolean, reason: ListboxOpenChangeReason) => void;
  /**
   * `'editable'`: a text input combobox (Combobox, TagPicker, TimePicker).
   * `'select-only'`: a button/div combobox without text entry (Dropdown).
   */
  mode: 'editable' | 'select-only';
  /** Several values can be selected; committing keeps the listbox open. */
  multiple?: boolean;
  /** The selected values (`[]` when nothing is selected). */
  selectedValues: readonly string[];
  /**
   * Called when an option is committed: click, Enter/Space, and in single-select select-only mode
   * also Tab and Alt+ArrowUp (with `multiple` they close without committing).
   */
  onSelect: (value: string, item: ListboxItem) => void;
  /**
   * Data mode: the options. Omitted ⇒ registration mode — the `Option` children register
   * themselves through {@link ListboxContext} ({@link useListboxOption}).
   */
  items?: readonly ListboxItem[];
  /** Hides items from navigation and rendering (registered options render `hidden`). */
  filter?: (item: ListboxItem) => boolean;
  /** Arrow keys wrap around at the ends. @default false */
  loop?: boolean;
  /** Printable characters move to the matching option. @default mode === 'select-only' */
  typeahead?: boolean;
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
   * Editable: whenever the navigable set changes while open (typing), its first option becomes
   * active — also when the keystroke that opens the listbox changes the set (compared with the set
   * before opening) — and so does every text-editing key while open, also when the set stays the
   * same. Opening with an unchanged set keeps the `autoHighlight` start.
   */
  highlightOnFilter?: boolean;
  /** Prefix of the generated listbox id. @default 'listbox' */
  idPrefix?: string;
  /**
   * Editable: Escape with the listbox closed and text in the input calls this (and prevents the
   * default) so the consumer can clear its draft text. Not handled when omitted.
   */
  onClearDraft?: () => void;
}

/** Props for the combobox element (spread them; see {@link UseListboxResult.getComboboxProps}). */
export interface ListboxComboboxProps {
  role: 'combobox';
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-activedescendant'?: string;
  'aria-haspopup': 'listbox';
  'aria-autocomplete'?: 'list';
}

/** Props for the listbox element (see {@link UseListboxResult.getListboxProps}). */
export interface ListboxListProps {
  id: string;
  role: 'listbox';
  'aria-multiselectable'?: true;
  tabIndex: -1;
  /** Keeps focus on the combobox while options are clicked. */
  onMouseDown(event: React.MouseEvent): void;
}

/** Result of {@link useListbox}. */
export interface UseListboxResult {
  /** Id of the listbox element. */
  listboxId: string;
  /** The active (highlighted) option, derived during render; `null` while closed. */
  activeValue: string | null;
  /** `getOptionId(activeValue)` while open and an option is active. */
  activeDescendantId: string | undefined;
  /**
   * The navigable items in DOM/data order: without filtered-out and hidden items; disabled ones
   * are included (navigation skips them).
   */
  items: ListboxItem[];
  /** Unfiltered lookup (registered options or `items`), e.g. for the selected option's label. */
  getItem(value: string): ListboxItem | undefined;
  /** `${listboxId}-opt-${n}`; `n` is assigned the first time a value is seen and never changes. */
  getOptionId(value: string): string;
  /**
   * Highlights an option while open (ignored when it is not navigable or disabled; dropped when it
   * leaves the navigable set later). Scrolled into view like a keyboard highlight.
   */
  setActiveValue(value: string | null): void;
  /** Attach to the combobox element. Ignores events a consumer handler already prevented. */
  onKeyDown(event: React.KeyboardEvent): void;
  /**
   * Attach to the combobox element next to `onKeyDown`. Required for a `<button>` combobox
   * (select-only): it prevents the Space keyup, so the native click does not toggle the listbox
   * again after the keydown opened or committed.
   */
  onKeyUp(event: React.KeyboardEvent): void;
  getComboboxProps(): ListboxComboboxProps;
  getListboxProps(): ListboxListProps;
  /** Provide it with `<ListboxContext.Provider value={context}>` around the options. */
  context: ListboxContextValue;
}

/**
 * Per-option state of a listbox. Subscribe with `useSyncExternalStore` and read one value
 * (`() => store.isHidden(value)`), so only components whose answer changed re-render.
 */
export interface ListboxStore {
  subscribe(listener: () => void): () => void;
  isActive(value: string): boolean;
  isSelected(value: string): boolean;
  isHidden(value: string): boolean;
  /** The stable per-listbox index of `value`, assigned the first time the value is seen. */
  getIndex(value: string): number;
  /**
   * Registers an option and its element. The registrations of a commit are published once from
   * the listbox root's layout effect (later ones once per microtask). Returns the unregister.
   */
  register(item: ListboxItem, element: React.RefObject<HTMLElement | null>): () => void;
}

/** Value of {@link ListboxContext} (use {@link UseListboxResult.context}). */
export interface ListboxContextValue {
  listboxId: string;
  store: ListboxStore;
  /** Commits `value` (option click). */
  select(value: string, item: ListboxItem): void;
  /** Highlights `value` (pointer movement); not scrolled into view, so the list stays put. */
  highlight(value: string): void;
}

/**
 * Props of {@link useListboxOption}. The option's position in the listbox follows its element's
 * DOM position, also when the option is memoized and only moved (see {@link useListbox}).
 */
export interface UseListboxOptionProps {
  value: string;
  /**
   * Display label; falls back to `textValue`, then the element's text content, then `value`. The
   * text content is re-read after every render of the option. Text that a child component changes
   * from its own state (without the option re-rendering) is not seen; pass `label` or `textValue`
   * for such options.
   */
  label?: string;
  textValue?: string;
  disabled?: boolean;
  /**
   * The consumer hid the option (its own `hidden` attribute, or a hidden group around it): it
   * registers as a hidden item ({@link ListboxItem.hidden}), so it is not navigable, and
   * `optionProps.hidden` is set from the first render (server included).
   */
  hidden?: boolean;
}

/** Props for an option element (spread them onto the `<li>`; compose `onClick` with yours). */
export interface ListboxOptionProps<E extends HTMLElement = HTMLElement> {
  id: string;
  role: 'option';
  'aria-selected': boolean;
  'aria-disabled'?: true;
  hidden?: boolean;
  'data-active'?: '';
  'data-selected'?: '';
  'data-disabled'?: '';
  onClick(event: React.MouseEvent<E>): void;
  onPointerMove(event: React.PointerEvent<E>): void;
  ref: React.RefCallback<E>;
}

/** Result of {@link useListboxOption}. */
export interface UseListboxOptionResult<E extends HTMLElement = HTMLElement> {
  id: string;
  selected: boolean;
  active: boolean;
  disabled: boolean;
  /** Filtered out, or hidden by the consumer ({@link UseListboxOptionProps.hidden}). */
  hidden: boolean;
  optionProps: ListboxOptionProps<E>;
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

function sameValues(a: readonly ListboxItem[], b: readonly ListboxItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => item.value === b[index].value);
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

  /** The mounted element of an option (for scrolling). */
  getElement(value: string): HTMLElement | null {
    for (const { item, element } of this.registrations) {
      const el = element.current;
      if (item.value === value && el && el.isConnected) return el;
    }
    return null;
  }

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

/** Provided by listbox roots (`<ListboxContext.Provider value={listbox.context}>`). */
export const ListboxContext: React.Context<ListboxContextValue | null> =
  React.createContext<ListboxContextValue | null>(null);
ListboxContext.displayName = 'ListboxContext';

let inertContext: ListboxContextValue | null = null;

function getInertContext(): ListboxContextValue {
  inertContext ??= {
    listboxId: 'wave-listbox-inert',
    store: new ListboxStoreImpl([]),
    select: () => {},
    highlight: () => {},
  };
  return inertContext;
}

function useListboxContext(componentName: string): ListboxContextValue {
  const context = useContext(ListboxContext);
  if (context) return context;
  reportMissingContext(componentName, 'a listbox (Combobox or Dropdown)');
  return getInertContext();
}

/* ------------------------------------------------------------------ */
/*  collectOptionLabels                                                */
/* ------------------------------------------------------------------ */

const LISTBOX_ELEMENT_KIND = Symbol.for('@mortenbrudvik/waveui/listbox-element-kind');

/** What {@link collectOptionLabels} does with a marked component's elements. */
export type ListboxElementKind = 'option' | 'group';

/**
 * Marks a component so {@link collectOptionLabels} recognises its elements: `'option'` (reads
 * `value` and the label) or `'group'` (walks its `children`). Returns the component (function,
 * `memo` or `forwardRef` components). Required for every exported option/group component:
 * unmarked components are opaque to {@link collectOptionLabels}, so their labels are unknown on
 * the server and in the first client render.
 *
 * @example
 * export const Option = markListboxElement(OptionImpl, 'option');
 * export const OptionGroup = markListboxElement(OptionGroupImpl, 'group');
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

function step(
  values: readonly string[],
  current: string | null,
  delta: number,
  loop: boolean,
): string | null {
  const count = values.length;
  if (count === 0) return null;
  const index = current === null ? -1 : values.indexOf(current);
  if (index === -1) return delta > 0 ? values[0] : values[count - 1];
  let next = index + delta;
  if (next < 0 || next >= count) {
    next =
      loop && Math.abs(delta) === 1
        ? (next + count) % count
        : Math.max(0, Math.min(count - 1, next));
  }
  return values[next];
}

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
 * The listbox behaviour shared by Combobox, Dropdown, TagPicker and TimePicker (spec §2.5): one
 * navigable option list drives the highlight, `aria-activedescendant` and the commit, so the
 * highlighted option is always the one Enter selects.
 *
 * - **Items.** Data mode (`items`) or registration mode: `Option`s call {@link useListboxOption}
 *   inside {@link ListboxContext} and register in DOM order (OptionGroups included). The
 *   registrations of one commit are published once from this hook's layout effect (which runs
 *   after the options'); later additions/removals are published once per microtask. A keyed
 *   reorder of the same options re-sorts them: the DOM order is re-checked after a commit of this
 *   hook's component that moved option elements (a highlight move moves none, so it costs O(1))
 *   and, while it is mounted, whenever option elements move (a `MutationObserver` on their
 *   common ancestor) — so memoized options or hoisted elements that a wrapper component inside
 *   the listbox reorders are re-sorted too, although neither the options nor this component
 *   render. Options register even when filtered out or hidden by the consumer (they render
 *   `hidden` and are not navigable), so labels are always known — use {@link collectOptionLabels}
 *   for the display text before registration (SSR/first render).
 * - **Active option** is derived during render: the highlighted value, else the `autoHighlight`
 *   fallback. The highlight is reset on close and after a single-select commit, and dropped once
 *   it is not navigable and enabled any more (filtered out, hidden, removed by an update,
 *   disabled), so it does not come back without a user action when the option returns. Editable:
 *   a text-editing key (printable characters, Backspace/Delete, cut/paste/undo/redo) clears it —
 *   visual focus returns to the textbox (APG) — so Enter after typing never commits an option
 *   highlighted before the edit.
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
 *   (with `multiple` they only close; Tab is not prevented); Escape closes.
 *   "Selected" means the first selected navigable option in list order. Disabled options are
 *   skipped and never committed; hidden options are not navigable at all.
 * - The active option is scrolled into view (`{ block: 'nearest' }`) in a layout effect, except
 *   after a pointer highlight (the list would scroll under the pointer).
 *
 * **Consumer contract** (Combobox, Dropdown, TagPicker, TimePicker). Beyond the spec §2.5 signature:
 * - All options of a listbox live in a single container at a time (§5.5: inline only while
 *   closed, portaled only while open — never both, not even for an exit animation). Options split
 *   over two containers are watched from `<body>` and registered twice (development warns).
 * - Spread `getComboboxProps()` onto the combobox element and attach **both** `onKeyDown` and
 *   `onKeyUp` to it (compose them with the consumer's handlers, C-COMPOSE). `onKeyUp` is required
 *   for a `<button>` combobox (select-only): without it the button's native click on Space keyup
 *   toggles the listbox again after a keydown commit.
 * - Registration mode: export the option components through {@link markListboxElement}
 *   (`Option = markListboxElement(OptionImpl, 'option')`, `OptionGroup =
 *   markListboxElement(OptionGroupImpl, 'group')`; memo components can be marked too).
 *   {@link collectOptionLabels} walks only marked components, so without the marks the server
 *   render and the first client render have no display text.
 * - Display text: `getItem(value)?.label ?? collectOptionLabels(children).get(value)` (`?? value`
 *   for freeform input only). Editable consumers pass `onClearDraft` for Escape on a closed list.
 */
export function useListbox(options: UseListboxOptions): UseListboxResult {
  const {
    open,
    onOpenChange,
    mode,
    multiple = false,
    selectedValues,
    onSelect,
    items: dataItems,
    filter,
    loop = false,
    typeahead = mode === 'select-only',
    autoHighlight = 'selected',
    highlightOnFilter = false,
    idPrefix,
    onClearDraft,
  } = options;

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
  const enabledValues = useMemo(
    () => navigable.filter((item) => !item.disabled).map((item) => item.value),
    [navigable],
  );
  const enabledSet = useMemo(() => new Set(enabledValues), [enabledValues]);
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

  // The highlighted value (keyboard, pointer, typeahead, setActiveValue), adjusted during render
  // (C-HOOKS: no effect) and stored once:
  // - reset on close (also a highlight set while closed);
  // - highlightOnFilter: moved to the first option when the navigable set changes (below);
  // - dropped once it is not navigable and enabled any more (filtered out, hidden, removed by an
  //   update, disabled), so the option is not highlighted again without a user action when it
  //   returns.
  const [activeRaw, setActiveRaw] = useState<string | null>(null);
  let highlighted = open ? activeRaw : null;

  // highlightOnFilter: compared by content, not identity — an inline `filter` yields a new array on
  // every render pass (also the pass React repeats after this state update). The set is tracked
  // while closed too, so the keystroke that opens the listbox and filters it in the same update
  // counts as a filter change (compared with the set before opening); opening with an unchanged
  // set (ArrowDown, a click) keeps the autoHighlight start.
  const [filterTrack, setFilterTrack] = useState(() => ({ open, items: navigable }));
  if (highlightOnFilter) {
    const itemsChanged = !sameValues(filterTrack.items, navigable);
    if (itemsChanged || filterTrack.open !== open) {
      setFilterTrack({ open, items: navigable });
      if (open && itemsChanged) highlighted = enabledValues[0] ?? null;
    }
  }
  if (highlighted !== null && !enabledSet.has(highlighted)) highlighted = null;
  if (highlighted !== activeRaw) setActiveRaw(highlighted);

  // In list order (APG), not in the order the values were selected.
  const firstSelected = enabledValues.find((value) => selectedSet.has(value)) ?? null;
  let fallback: string | null = null;
  if (autoHighlight === 'selected') fallback = firstSelected ?? enabledValues[0] ?? null;
  else if (autoHighlight === 'first') fallback = enabledValues[0] ?? null;
  const activeValue = open ? (highlighted ?? fallback) : null;

  const getOptionId = useCallback(
    (value: string) => `${listboxId}-opt-${store.getIndex(value)}`,
    [listboxId, store],
  );
  const activeDescendantId = activeValue !== null ? getOptionId(activeValue) : undefined;
  const getItem = useCallback((value: string) => itemByValue.get(value), [itemByValue]);

  // The value the pointer highlighted, until the scroll effect has seen it: a pointer highlight is
  // not scrolled into view. Every other highlight (keyboard, typeahead, setActiveValue) clears it.
  const pointerHighlightRef = useRef<string | null>(null);
  const setActive = useCallback((value: string | null) => {
    pointerHighlightRef.current = null;
    setActiveRaw(value);
  }, []);
  const setActiveValue = setActive;

  const commit = useEventCallback(
    (value: string, reason: 'select' | 'tab', fallbackItem?: ListboxItem): void => {
      const item = itemByValue.get(value) ?? fallbackItem;
      if (!item || item.disabled) return;
      onSelect(value, item);
      if (multiple && reason === 'select') {
        setActive(value);
      } else {
        setActive(null);
        onOpenChange(false, reason);
      }
    },
  );

  const select = useEventCallback((value: string, item: ListboxItem) => {
    commit(value, 'select', item);
  });

  const highlight = useEventCallback((value: string) => {
    if (!open || !enabledSet.has(value) || value === activeValue) return;
    pointerHighlightRef.current = value;
    setActiveRaw(value);
  });

  const { onTypeahead } = useTypeahead({
    getItems: () =>
      navigable.map((item) => ({
        value: item.value,
        text: item.textValue ?? item.label,
        disabled: item.disabled,
      })),
    onMatch: (value) => {
      setActive(value);
      if (!open) onOpenChange(true, 'keyboard');
    },
  });

  const onKeyDown = useEventCallback((event: React.KeyboardEvent) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    // Editable: a key that edits the text returns visual focus to the textbox (APG) and is left to
    // the input: the highlight is cleared (highlightOnFilter: the first option), so Enter after
    // typing never commits an option highlighted before the edit.
    if (mode === 'editable' && open && editsText(event)) {
      setActive(highlightOnFilter ? (enabledValues[0] ?? null) : null);
    }
    const altGraph = isAltGraphCharacter(event);
    if ((event.ctrlKey && !altGraph) || event.metaKey) return;
    const { key, altKey } = event;
    const selectOnly = mode === 'select-only';
    const first = enabledValues[0] ?? null;
    const last = enabledValues[enabledValues.length - 1] ?? null;

    const openWith = (value: string | null) => {
      setActive(value);
      if (!open) onOpenChange(true, 'keyboard');
    };
    const move = (delta: number) => setActive(step(enabledValues, activeValue, delta, loop));
    const commitOrClose = () => {
      if (activeValue !== null) commit(activeValue, 'select');
      else if (!multiple) onOpenChange(false, 'keyboard');
    };

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (altKey) {
          if (!open) onOpenChange(true, 'keyboard');
        } else if (!open) {
          openWith(firstSelected ?? first);
        } else {
          move(1);
        }
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (altKey) {
          if (!open) return;
          if (selectOnly && !multiple && activeValue !== null) commit(activeValue, 'select');
          else onOpenChange(false, 'keyboard');
        } else if (!open) {
          openWith(firstSelected ?? last);
        } else {
          move(-1);
        }
        return;
      case 'Home':
      case 'End':
        if (!selectOnly) return;
        event.preventDefault();
        openWith(key === 'Home' ? first : last);
        return;
      case 'PageUp':
      case 'PageDown':
        if (!selectOnly || !open) return;
        event.preventDefault();
        move(key === 'PageDown' ? 10 : -10);
        return;
      case 'Enter':
        if (!selectOnly) {
          // Closed: not prevented, so the surrounding form submits (APG).
          if (open && activeValue !== null) {
            event.preventDefault();
            commit(activeValue, 'select');
          }
          return;
        }
        event.preventDefault();
        if (!open) onOpenChange(true, 'keyboard');
        else commitOrClose();
        return;
      case 'Escape':
        if (open) {
          event.preventDefault();
          onOpenChange(false, 'escape');
        } else if (!selectOnly && onClearDraft && hasText(event.currentTarget)) {
          event.preventDefault();
          onClearDraft();
        }
        return;
      case 'Tab':
        if (!open) return;
        if (selectOnly && !multiple && activeValue !== null) commit(activeValue, 'tab');
        else onOpenChange(false, 'tab');
        return;
      default:
        break;
    }

    if (key === ' ' && !selectOnly) return;
    if (!typeahead || (altKey && !altGraph) || key.length !== 1) {
      if (key === ' ' && selectOnly) {
        event.preventDefault();
        if (!open) onOpenChange(true, 'keyboard');
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
      // Not part of a typeahead search: Space opens or commits (select-only).
      event.preventDefault();
      if (!open) onOpenChange(true, 'keyboard');
      else commitOrClose();
      return;
    }
    if (selectOnly && !open) {
      event.preventDefault();
      onOpenChange(true, 'keyboard');
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

  // Keep the active option visible in the scrollable listbox — not after a pointer highlight: the
  // option under the pointer is already (at least partly) visible, and scrolling would move the
  // list under the pointer.
  useLayoutEffect(() => {
    const fromPointer = activeValue !== null && activeValue === pointerHighlightRef.current;
    pointerHighlightRef.current = null;
    if (activeValue === null || fromPointer) return;
    const element =
      store.getElement(activeValue) ??
      (typeof document !== 'undefined' ? document.getElementById(getOptionId(activeValue)) : null);
    element?.scrollIntoView?.({ block: 'nearest' });
  }, [activeValue, getOptionId, store]);

  useEffect(() => {
    if (!dataItems) return;
    const seen = new Set<string>();
    for (const item of dataItems) {
      if (seen.has(item.value)) warnDuplicateValue(item.value);
      seen.add(item.value);
    }
  }, [dataItems]);

  const context = useMemo<ListboxContextValue>(
    () => ({ listboxId, store, select, highlight }),
    [listboxId, store, select, highlight],
  );

  return {
    listboxId,
    activeValue,
    activeDescendantId,
    items: navigable,
    getItem,
    getOptionId,
    setActiveValue,
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
      const props: ListboxListProps = {
        id: listboxId,
        role: 'listbox',
        tabIndex: -1,
        onMouseDown: preventMouseDown,
      };
      if (multiple) props['aria-multiselectable'] = true;
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
 * An option of the surrounding listbox ({@link ListboxContext}). Registers the option (registration
 * mode) and its element, and reads its flags from the listbox store, so it re-renders only when
 * its own active/selected/hidden state changes. Spread `optionProps` onto the `<li>` (`id`,
 * `role="option"`, `aria-selected`, `aria-disabled`, `hidden`, `data-active`/`data-selected`/
 * `data-disabled` for styling, C-CLASS) and compose its `onClick` with the consumer's.
 *
 * Throws in development when used outside a listbox; in production it logs the error once and
 * renders an inert option (C-CONTEXT).
 *
 * @typeParam E The option element type (`HTMLLIElement` for an `<li>`), so `ref` needs no cast.
 */
export function useListboxOption<E extends HTMLElement = HTMLElement>(
  props: UseListboxOptionProps,
  ref?: React.Ref<E>,
): UseListboxOptionResult<E> {
  const context = useListboxContext('Option');
  const { store, listboxId, select, highlight } = context;
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

  const onClick = useCallback(() => {
    if (disabled) return;
    const item: ListboxItem = { value, label: label ?? textValue ?? value };
    if (textValue !== undefined) item.textValue = textValue;
    select(value, item);
  }, [select, value, label, textValue, disabled]);

  const onPointerMove = useCallback(() => {
    if (!disabled && !store.isActive(value)) highlight(value);
  }, [highlight, store, value, disabled]);

  const optionProps: ListboxOptionProps<E> = {
    id,
    role: 'option',
    'aria-selected': selected,
    onClick,
    onPointerMove,
    ref: mergedRef,
  };
  if (disabled) {
    optionProps['aria-disabled'] = true;
    optionProps['data-disabled'] = '';
  }
  if (hidden) optionProps.hidden = true;
  if (active) optionProps['data-active'] = '';
  if (selected) optionProps['data-selected'] = '';

  return { id, selected, active, disabled, hidden, optionProps };
}
