import * as React from 'react';
import type { WaveDir } from '../components/provider/WaveProvider';
import { isDev, warnOnce } from '../lib/dev';
import { getArrowIntent, getDirection } from '../lib/direction';
import { getFirstTabbable, isHiddenInput } from '../lib/focus';
import { setRef } from '../lib/mergeRefs';
import { useEventCallback } from './useEventCallback';
import { isAltGraphCharacter, useTypeahead, type TypeaheadItem } from './useTypeahead';

/**
 * Configuration options for the {@link useRovingTabIndex} hook. Disabled items are skipped; items
 * marked `data-disabled-focusable` (the `disabledFocusable` prop of WaveUI buttons, links and
 * choice controls) stay reachable and may hold the tab stop: APG allows focusable disabled items.
 */
export interface UseRovingTabIndexOptions {
  /**
   * The selected value. It may be absent, `''` or `null` (nothing selected) and does not have to be
   * one of the items.
   */
  activeValue?: string | null;
  /**
   * Explicit item order (0.4 call shape). Omitted ⇒ the DOM order of the elements matching
   * `itemSelector`. Disabled items are skipped either way, and so are listed values with no
   * element in the container (not rendered, or `hidden`/`inert`): they never hold the tab stop.
   */
  items?: readonly string[];
  /**
   * Arrow key axis: `'horizontal'` uses Left/Right (mirrored in RTL), `'vertical'` uses Up/Down,
   * `'both'` uses all four, in the DOM order of the items.
   *
   * `'grid'` is a two-dimensional grid: Left/Right move through the cells in reading order across
   * rows (mirrored in RTL); Up/Down go to the cell at the same index in the previous or next row,
   * else to the nearest enabled cell of that row (the earlier one on a tie), skipping rows without
   * an enabled cell, and stop at the first and last row; Home/End go to the first and last enabled
   * cell of the row, Ctrl+Home/End of the grid (whatever `homeEndKeys` says). Rows are the
   * `role="row"` elements inside the container, else groups of `columns` items in DOM order. Without
   * either, `'grid'` acts as `'both'` and a development warning says so.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | 'both' | 'grid';
  /**
   * With `orientation: 'grid'` and no `role="row"` elements: the number of cells per row. The last
   * row may be shorter.
   */
  columns?: number;
  /**
   * Whether arrow keys wrap around at the ends.
   * @default true
   */
  loop?: boolean;
  /** Text direction. Defaults to the direction of the container at key time (`getDirection`). */
  dir?: WaveDir;
  /**
   * Selector for the item elements inside the container. A selector the browser rejects matches
   * nothing (no item is navigable or tabbable) and logs a development warning.
   * @default '[data-roving-value]'
   */
  itemSelector?: string;
  /**
   * Printable characters move focus to the next item whose text (`data-roving-text`, else its
   * text content) starts with them. A Space typed within 500 ms of another character continues
   * the search instead of activating the focused item: `containerProps.onKeyDownCapture` calls
   * `preventDefault()` on it before an item's own keydown handler runs, so that handler must skip
   * default-prevented events (`composeEventHandlers` does). Keys typed in content nested inside an
   * item (a row's action button) are not typeahead. A character typed with AltGr (which Windows
   * reports as Ctrl+Alt, e.g. Polish `ł`) is typeahead text; other Ctrl, Alt or Meta
   * combinations, Ctrl+Alt+Space included, are shortcuts and ignored. A match whose `focus()`
   * leaves focus where it was is passed over for the next item that matches.
   * @default false
   */
  typeahead?: boolean;
  /**
   * Whether Home/End move to the first/last enabled item.
   * @default true
   */
  homeEndKeys?: boolean;
  /** Which item holds the tab stop. 'active' (default): the enabled activeValue item, else the first
   *  enabled item — APG Tabs/Radio/Listbox/Tree. 'last-focused': the last focused enabled item, else
   *  'active' — APG Toolbar (and the static Menu). Either way a nested composite or a control that
   *  uses the arrow keys itself (text field, select, slider, spin button, editable combobox) holds
   *  it only when no other item can: arrows pressed there never lead back to the other items, so
   *  focusing one keeps the tab stop on the last focused other item. 'none': no item holds it
   *  (every item gets tabIndex -1; a nested composite keeps its own tab stop, and one marked
   *  `data-roving-transparent` joins the group's arrow order), for a composite reached only by
   *  the arrow keys of an enclosing widget or by a script (a tree row's actions); the keys,
   *  `focusValue`, `focusFirst` and `focusLast` keep working. */
  tabStop?: 'active' | 'last-focused' | 'none';
  /** true ⇒ the hook writes tabIndex 0/-1 onto item elements itself and assigns
   *  data-roving-value="auto-<n>" to items that lack one. For containers that do not render their
   *  items (Toolbar children, Menu items, Tree rows). Default false (items call getTabIndex).
   *  Matches that cannot take focus are no items: `input[type=hidden]` is skipped, and a control
   *  hidden by CSS inside the container (`display: none` or `visibility: hidden` on it or on an
   *  ancestor inside the container) is treated as disabled (skipped, never the tab stop, stamped
   *  -1). A container hidden as a whole from outside keeps its items and tab stop.
   *  When the container stops being one (its ref detaches, as when `containerProps` are no longer
   *  spread, or moves to another element) or `manageTabIndex` turns false, every element the hook
   *  stamped gets its own `tabindex` back (the attribute it had at its first stamp, or none; a
   *  `tabIndex` its author rendered since, the commit that detaches the container included, stays)
   *  and loses a `data-roving-value` the hook added (one React rendered stays). An element that
   *  stops being an item (`itemSelector`, or a changed selector, no longer matches it) is handed
   *  back the same way. The last focused item and the generated values are kept, so a container
   *  that attaches again starts where it was. */
  manageTabIndex?: boolean;
  /** Called after an arrow, Home/End or typeahead key moved focus to `value`. */
  onFocusMove?: (value: string, event: React.KeyboardEvent) => void;
}

/** Props to spread onto the container element. */
export interface RovingContainerProps {
  ref: React.RefCallback<HTMLElement>;
  'data-roving-container': '';
  onKeyDown: React.KeyboardEventHandler;
  /** With `typeahead`: default-prevents a Space that continues a search, before item handlers. */
  onKeyDownCapture: React.KeyboardEventHandler;
  onFocus: React.FocusEventHandler;
}

/** Result of {@link useRovingTabIndex}. */
export interface UseRovingTabIndexResult {
  /** Spread onto the container: ref, `data-roving-container` marker and the key/focus handlers. */
  containerProps: RovingContainerProps;
  /** The container's keydown handler (same function as `containerProps.onKeyDown`). */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /**
   * The container's capture-phase keydown handler (same function as
   * `containerProps.onKeyDownCapture`). With `typeahead`, it extends the search with a Space that
   * continues one and calls `preventDefault()`, before an item's own keydown handler runs: an item
   * that activates on Space must skip default-prevented events (`composeEventHandlers` does).
   */
  handleKeyDownCapture: (e: React.KeyboardEvent) => void;
  /** The container's focus handler (same function as `containerProps.onFocus`). */
  handleFocus: (e: React.FocusEvent) => void;
  /** `0` for the item that holds the tab stop, `-1` for every other item. */
  getTabIndex: (value: string) => 0 | -1;
  /** The value of the item that last received focus, or `null`. */
  focusedValue: string | null;
  /** Focuses the item with this value (ignored when it is disabled or unknown). */
  focusValue: (value: string) => void;
  /** Focuses the first enabled item. */
  focusFirst: () => void;
  /** Focuses the last enabled item. */
  focusLast: () => void;
}

/** The rows of a grid: the items of the `role="row"` elements, else groups of `columns` items. */
function groupIntoRows(
  ordered: readonly ResolvedItem[],
  container: HTMLElement,
  columns: number | undefined,
): ResolvedItem[][] | null {
  const rowElements = container.querySelectorAll<HTMLElement>('[role="row"]');
  if (rowElements.length > 0) {
    return Array.from(rowElements).map((row) =>
      ordered.filter((item) => row.contains(item.element)),
    );
  }
  if (columns !== undefined && columns > 0) {
    const rows: ResolvedItem[][] = [];
    for (let start = 0; start < ordered.length; start += columns) {
      rows.push(ordered.slice(start, start + columns));
    }
    return rows;
  }
  return null;
}

/**
 * Where a grid key (Up/Down, Home/End, Ctrl+Home/End) goes from `current`: the cells to try, in
 * order; `'stay'` when the key is the grid's but nothing is further that way; `undefined` when it is
 * not a grid key, or focus is not on a cell of a row (the container's own handling applies).
 */
function gridTargets(
  e: React.KeyboardEvent,
  rows: readonly ResolvedItem[][],
  current: ResolvedItem | null | undefined,
): ResolvedItem[] | 'stay' | undefined {
  const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
  const homeEnd = e.key === 'Home' || e.key === 'End';
  if (!current || (!vertical && !homeEnd)) return undefined;
  const rowIndex = rows.findIndex((row) => row.includes(current));
  if (rowIndex < 0) return undefined;
  if (homeEnd) {
    const scope = (e.ctrlKey ? rows.flat() : rows[rowIndex]).filter((item) => !item.disabled);
    const target = e.key === 'Home' ? scope[0] : scope[scope.length - 1];
    return target && target !== current ? [target] : 'stay';
  }
  // The column is the index in the row, counting every cell (disabled ones included).
  const column = rows[rowIndex].indexOf(current);
  const delta = e.key === 'ArrowDown' ? 1 : -1;
  for (let r = rowIndex + delta; r >= 0 && r < rows.length; r += delta) {
    let best: ResolvedItem | undefined;
    let bestDistance = Infinity;
    rows[r].forEach((item, index) => {
      if (item.disabled) return;
      const distance = Math.abs(index - column);
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    });
    if (best) return [best];
  }
  return 'stay';
}

interface ResolvedItem {
  value: string;
  /** The item element (for a nested composite: its root). */
  element: HTMLElement;
  /** A nested composite (own roving container or composite role) counts as one item. */
  nested: boolean;
  /**
   * Skipped by the keys and never the tab stop: disabled, a nested composite with nothing to
   * focus, or (`manageTabIndex`) hidden by CSS.
   */
  disabled: boolean;
}

interface StoreOptions {
  itemSelector: string;
  manageTabIndex: boolean;
  items: readonly string[] | undefined;
  activeValue: string | null;
  tabStop: 'active' | 'last-focused' | 'none';
  /**
   * Whether an element with a composite role but no roving container of its own is a nested
   * composite (one item). Off in the 0.4 call shape and with explicit `items`, where such an element
   * is usually the widget's own root inside a wrapper that carries the container ref.
   */
  roleComposites: boolean;
}

const DEFAULT_ITEM_SELECTOR = '[data-roving-value]';

/** Roles of widgets that manage their own children: an element with one of them is one item. */
const COMPOSITE_ROLES = new Set([
  'radiogroup',
  'listbox',
  'grid',
  'treegrid',
  'tablist',
  'menu',
  'menubar',
  'tree',
  'spinbutton',
]);

/**
 * Roles whose widgets use the arrow keys themselves. A combobox does only when it is editable (an
 * `<input>` or contenteditable, caught by the native checks): a select-only combobox such as
 * Dropdown's `<button role="combobox">` uses Up/Down, Home and End, never Left/Right.
 */
const ARROW_KEY_OWNER_ROLES = new Set(['slider', 'spinbutton', 'textbox', 'searchbox']);

/** `<input>` types that do not use the arrow keys for text editing. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'reset',
  'submit',
]);

const OBSERVED_ATTRIBUTES = [
  'disabled',
  'aria-disabled',
  'data-disabled-focusable',
  'data-roving-disabled',
  'data-roving-value',
  'data-roving-container',
  'data-roving-transparent',
  'tabindex',
  'hidden',
  'inert',
  'role',
  // Whether an item uses the arrow keys itself (text input types, contenteditable).
  'type',
  'contenteditable',
];

/**
 * Whether `el` is a nested composite: it has its own roving container, or (with `roleComposites`)
 * a composite role. An element marked `data-roving-transparent` is never one by its role (a
 * `role="radiogroup"` whose radios are items of the enclosing container, `Toolbar.RadioGroup`);
 * its own `data-roving-container` still makes it one.
 */
function isNestedComposite(el: Element, roleComposites: boolean): boolean {
  if (el.hasAttribute('data-roving-container')) return true;
  if (!roleComposites || el.hasAttribute('data-roving-transparent')) return false;
  const role = el.getAttribute('role');
  return role !== null && COMPOSITE_ROLES.has(role);
}

/** Whether `el` is a nested composite or inside one, below `container`. */
function isInNestedComposite(el: Element, container: Element, roleComposites: boolean): boolean {
  for (let node: Element | null = el; node && node !== container; node = node.parentElement) {
    if (isNestedComposite(node, roleComposites)) return true;
  }
  return false;
}

/** What the hook knows of an element it stamped, to hand it back to its author. */
interface StampedOriginal {
  /**
   * The author's own `tabindex` attribute, or `null`: read at the first stamp, and replaced by the
   * one the author writes while the element is stamped (React rendering another `tabIndex`; the
   * next stamp overwrites it in the DOM).
   */
  tabIndex: string | null;
  /** The `tabindex` the hook left on the element at its last stamp. */
  stamped: string;
  /** The `data-roving-value` the hook added (a generated value), or `null` when it added none. */
  addedValue: string | null;
}

/**
 * Every element the hook stamps carries both attributes, whatever `itemSelector` matched it: the
 * hand-back finds its elements through them, also one the selector no longer matches.
 */
const STAMPED_SELECTOR = '[tabindex], [data-roving-value]';

function matchesSelector(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    // A selector the browser rejects matches nothing.
    return false;
  }
}

/**
 * The elements whose last `tabindex` write in `records` left the value it found: the author
 * (through React) wrote the value the stamp had left. The hook only writes to change a value, so
 * such a write is never its own. Needs records with `attributeOldValue`.
 */
function rewrittenTabIndex(records: readonly MutationRecord[]): Set<Node> {
  const last = new Map<Node, MutationRecord>();
  for (const record of records) {
    if (record.type === 'attributes' && record.attributeName === 'tabindex') {
      last.set(record.target, record);
    }
  }
  const rewritten = new Set<Node>();
  for (const [target, record] of last) {
    if (record.oldValue === (target as Element).getAttribute('tabindex')) rewritten.add(target);
  }
  return rewritten;
}

function isFocusableSelf(el: HTMLElement): boolean {
  return el.tabIndex >= 0 && !el.hasAttribute('disabled');
}

/** The element to focus for an item: the item itself, or a nested composite's own tab stop. */
function getFocusTarget(item: ResolvedItem): HTMLElement | null {
  const { element } = item;
  if (!item.nested || isFocusableSelf(element)) return element;
  const ownStop = element.querySelector<HTMLElement>('[tabindex="0"]');
  if (ownStop) return ownStop;
  const tabbable = getFirstTabbable(element);
  return tabbable instanceof HTMLElement ? tabbable : null;
}

/**
 * Whether the keys skip an item, in this order: the composite's own `data-roving-disabled` marker
 * (not `"false"`) and native `disabled` skip it; `data-disabled-focusable` keeps it (a
 * `disabledFocusable` control: APG allows focusable disabled items); `aria-disabled="true"` skips
 * it.
 */
function isDisabledElement(el: HTMLElement): boolean {
  const marker = el.getAttribute('data-roving-disabled');
  if (marker !== null && marker !== 'false') return true;
  if (isNativelyDisabled(el)) return true;
  if (el.hasAttribute('data-disabled-focusable')) return false;
  return el.getAttribute('aria-disabled') === 'true';
}

function isNativelyDisabled(el: HTMLElement): boolean {
  if ((el as { disabled?: unknown }).disabled === true) return true;
  try {
    return el.matches(':disabled');
  } catch {
    return false;
  }
}

/**
 * Text-entry fields and widgets that use the arrow keys themselves (APG Toolbar).
 *
 * Internal: shared with the windowed List's keys, which leave the same keys alone; not exported
 * from the package.
 */
export function ownsArrowKeys(target: EventTarget | null): boolean {
  if (!target || (target as Node).nodeType !== 1) return false;
  const el = target as HTMLElement;
  const role = el.getAttribute('role');
  if (role !== null && ARROW_KEY_OWNER_ROLES.has(role)) return true;
  const tag = el.localName;
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  const editable = el.closest('[contenteditable]');
  return editable !== null && editable.getAttribute('contenteditable') !== 'false';
}

/**
 * Whether an item can hold the container's tab stop: not a nested composite (it keeps a tab stop
 * of its own) and not a control that uses the arrow keys itself. From either, the arrow keys never
 * lead to the other items, so a tab stop there would leave them reachable by keyboard only through
 * it (or not at all).
 */
function canHoldTabStop(item: ResolvedItem): boolean {
  return !item.nested && !ownsArrowKeys(item.element);
}

/**
 * Whether CSS inside `container` keeps `el` from taking focus (browsers ignore `focus()` on it):
 * `display: none` on it or on an ancestor inside `container`, `visibility: hidden`/`collapse` set
 * inside `container`, or a place inside a closed `<details>` other than its summary. Hiding from
 * outside the container (a surface that stays invisible until it is positioned, a consumer panel)
 * hides the whole item set and does not count: showing it again changes nothing the hook observes,
 * so nothing would re-stamp. `cache` holds, for one resolution, whether an element hides its whole
 * subtree (the `display` and `<details>` checks).
 *
 * Internal: shared with Tree's treegrid navigation; not exported from the package.
 */
export function isHiddenByCss(
  el: Element,
  container: Element,
  cache: Map<Element, boolean>,
): boolean {
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  for (let node: Element | null = el; node && node !== container; node = node.parentElement) {
    let hidden = cache.get(node);
    if (hidden === undefined) {
      const parent = node.parentElement;
      hidden =
        view.getComputedStyle(node).display === 'none' ||
        (parent !== null &&
          parent.localName === 'details' &&
          !parent.hasAttribute('open') &&
          Array.from(parent.children).find((child) => child.localName === 'summary') !== node);
      cache.set(node, hidden);
    }
    if (hidden) return true;
  }
  const { visibility } = view.getComputedStyle(el);
  if (visibility !== 'hidden' && visibility !== 'collapse') return false;
  // Visibility is inherited, so `el` also reads hidden when an ancestor of the container hides the
  // whole container. It counts only when the container itself is visible, i.e. when the hiding is
  // set inside it (on `el` or on a wrapper between them).
  return view.getComputedStyle(container).visibility === 'visible';
}

/** Whether focus is on `el` or inside it (in its document or shadow root). */
function hasFocus(el: HTMLElement): boolean {
  const active = (el.getRootNode() as Node & { activeElement?: Element | null }).activeElement;
  return !!active && el.contains(active);
}

function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * How an item takes part in the tab stop: `0` never (disabled), `1` can hold it, `2` holds it only
 * when no item can (a nested composite, or a control that uses the arrow keys itself).
 */
type TabStopRank = 0 | 1 | 2;

/** One item of the published DOM snapshot, and the input of {@link resolveTabStop}. */
type SnapshotEntry = [value: string, rank: TabStopRank];

function toEntry(item: ResolvedItem): SnapshotEntry {
  return [item.value, item.disabled ? 0 : canHoldTabStop(item) ? 1 : 2];
}

/**
 * The value that holds the tab stop, among the items of the best rank present (`1`, else `2`):
 * with 'last-focused' the last focused one, else the `activeValue` item, else the first one.
 */
function resolveTabStop(
  entries: readonly SnapshotEntry[],
  activeValue: string | null,
  tabStop: 'active' | 'last-focused',
  lastFocused: string | null,
): string | null {
  const rank = entries.some(([, r]) => r === 1) ? 1 : 2;
  const values = entries.filter(([, r]) => r === rank).map(([value]) => value);
  if (tabStop === 'last-focused' && lastFocused !== null && values.includes(lastFocused)) {
    return lastFocused;
  }
  if (activeValue !== null && activeValue !== '' && values.includes(activeValue)) {
    return activeValue;
  }
  return values[0] ?? null;
}

function orderByItems(
  resolved: ResolvedItem[],
  items: readonly string[] | undefined,
): ResolvedItem[] {
  if (!items) return resolved;
  const byValue = new Map(resolved.map((item) => [item.value, item]));
  const ordered: ResolvedItem[] = [];
  for (const value of items) {
    const item = byValue.get(value);
    if (item) ordered.push(item);
  }
  return ordered;
}

/**
 * Per-hook store: resolves items from the DOM, publishes the enabled set to React through
 * `useSyncExternalStore` (a MutationObserver on the container notifies it), and stamps tabIndex in
 * `manageTabIndex` mode.
 */
class RovingStore {
  container: HTMLElement | null = null;
  lastFocused: string | null = null;
  options: StoreOptions = {
    itemSelector: DEFAULT_ITEM_SELECTOR,
    manageTabIndex: false,
    items: undefined,
    activeValue: null,
    tabStop: 'active',
    roleComposites: true,
  };

  private readonly stamped = new WeakMap<Element, StampedOriginal>();
  private readonly autoValues = new WeakMap<Element, string>();
  private autoCounter = 0;
  private notify: (() => void) | null = null;
  private observer: MutationObserver | null = null;
  private dirty = true;
  private snapshot = '';

  subscribe = (notify: () => void): (() => void) => {
    this.notify = notify;
    this.observe();
    return () => {
      this.notify = null;
      this.disconnect();
    };
  };

  getSnapshot = (): string => {
    if (!this.container) return '';
    if (this.dirty) {
      this.dirty = false;
      // DOM facts only (order and tab stop rank); `items` is applied during render.
      this.snapshot = JSON.stringify(this.resolveOwn().map(toEntry));
    }
    return this.snapshot;
  };

  getServerSnapshot = (): string => '';

  /**
   * Attaches the store to `container` (`null` detaches it). A container that stops being one (its
   * ref detached, or the store moved to another element) first hands every element it stamped back
   * to its author, with the writes its observer has not delivered yet (the `tabIndex` React
   * rendered in the commit that detaches it). Only a store that manages tabIndex has stamped
   * anything: `setOptions` hands the stamps back the moment `manageTabIndex` turns off.
   */
  setContainer(container: HTMLElement | null): void {
    if (container === this.container) return;
    // Disconnecting drops the pending records anyway; the hand-back reads them first.
    const records = this.takeRecords();
    this.disconnect();
    if (this.container && this.options.manageTabIndex) {
      this.release(this.container, 'all', records);
    }
    this.container = container;
    this.dirty = true;
    if (this.notify) {
      this.observe();
      this.notify();
    }
  }

  /**
   * Records a focused item for the 'last-focused' tab stop. An item that cannot hold the tab stop
   * (a nested composite, a control that uses the arrow keys itself) leaves the last one in place.
   */
  recordFocus(item: ResolvedItem): void {
    if (canHoldTabStop(item)) this.lastFocused = item.value;
  }

  setOptions(options: StoreOptions): void {
    const previous = this.options;
    this.options = options;
    // `manageTabIndex` turned off: the elements stamped so far go back to their author. The records
    // taken here are not delivered; the notification below stands in for them. (A changed
    // `itemSelector` hands back what it no longer matches at the next stamp.)
    if (previous.manageTabIndex && !options.manageTabIndex && this.container) {
      this.release(this.container, 'all', this.takeRecords());
    }
    if (
      previous.itemSelector !== options.itemSelector ||
      previous.manageTabIndex !== options.manageTabIndex ||
      previous.roleComposites !== options.roleComposites
    ) {
      this.dirty = true;
      this.notify?.();
    }
  }

  /** Own items in navigation order: the explicit `items` order when given, else DOM order. */
  resolve(container: HTMLElement | null = this.container): ResolvedItem[] {
    return orderByItems(this.resolveOwn(container), this.options.items);
  }

  /** Own items of the container in DOM order (items of nested composites excluded). */
  resolveOwn(container: HTMLElement | null = this.container): ResolvedItem[] {
    if (!container) return [];
    const { itemSelector, manageTabIndex, roleComposites } = this.options;
    let candidates: HTMLElement[];
    try {
      candidates = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
    } catch {
      // An invalid selector (warned from an effect in development): this runs during render
      // (getSnapshot), where throwing would take the whole tree down.
      return [];
    }

    const result: ResolvedItem[] = [];
    const seen = new Set<Element>();
    const cssHidden = new Map<Element, boolean>();
    for (const candidate of candidates) {
      let composite: HTMLElement | null = null;
      let hidden = false;
      for (
        let node: HTMLElement | null = candidate;
        node && node !== container;
        node = node.parentElement
      ) {
        if (isNestedComposite(node, roleComposites)) composite = node;
        if (node.hidden || node.hasAttribute('inert')) hidden = true;
      }
      if (hidden) continue;

      const element = composite ?? candidate;
      if (seen.has(element)) continue;
      const nested = composite !== null;
      if (!nested && manageTabIndex) {
        // An author tabindex="-1" (a SpinButton stepper, SplitButton internals) opts out.
        if (candidate.getAttribute('tabindex') === '-1' && !this.stamped.has(candidate)) continue;
        // A hidden form input (HiddenInput's `type="hidden"`) is never focusable.
        if (isHiddenInput(candidate)) continue;
      }
      seen.add(element);

      const item: ResolvedItem = {
        value: this.valueOf(element, nested),
        element,
        nested,
        disabled: isDisabledElement(element),
      };
      if (nested && !item.disabled && !getFocusTarget(item)) item.disabled = true;
      // Consumer children hidden by CSS (a responsive `hidden md:inline-flex` control). Treated as
      // disabled rather than dropped, so it is stamped -1 and is no extra Tab stop once the CSS
      // shows it again (a CSS change triggers no mutation, hence no re-stamp).
      if (manageTabIndex && !item.disabled && isHiddenByCss(element, container, cssHidden)) {
        item.disabled = true;
      }
      result.push(item);
    }
    return result;
  }

  /**
   * manageTabIndex: writes tabIndex 0 on the tab stop and -1 on every other own item. An element
   * it stamped that is no longer one of its items (it now belongs to a nested composite, as when a
   * `data-roving-transparent` marker is removed, or `itemSelector` no longer matches it) is handed
   * back first. A `tabindex` the author rendered since the last stamp becomes the element's own.
   */
  stamp(): void {
    if (!this.options.manageTabIndex || !this.container) return;
    this.release(this.container, 'stale');
    const resolved = this.resolve();
    const stop =
      this.options.tabStop === 'none'
        ? null
        : resolveTabStop(
            resolved.map(toEntry),
            this.options.activeValue,
            this.options.tabStop,
            this.lastFocused,
          );
    for (const item of resolved) {
      if (item.nested) continue;
      const { element } = item;
      const tabIndex = item.value === stop ? '0' : '-1';
      const current = element.getAttribute('tabindex');
      let original = this.stamped.get(element);
      if (!original) {
        original = { tabIndex: current, stamped: tabIndex, addedValue: null };
        this.stamped.set(element, original);
      } else {
        // Another value than the last stamp left: the author rendered it, so it is the element's own.
        if (current !== original.stamped) original.tabIndex = current;
        original.stamped = tabIndex;
      }
      if (current !== tabIndex) element.setAttribute('tabindex', tabIndex);
      if (!element.hasAttribute('data-roving-value')) {
        element.setAttribute('data-roving-value', item.value);
        original.addedValue = item.value;
      }
    }
  }

  /**
   * Hands elements it stamped inside `container` back to their author and drops their records, so
   * a later stamp reads them afresh. The `tabindex` the record holds as the author's is put back
   * (removed when there was none), unless the author wrote one since the last stamp, which stays:
   * another value than the stamp's, or the stamp's value written again (seen in the pending
   * `records`). A `data-roving-value` the hook added is removed while it still holds the generated
   * value (one React renders stays). The generated values and the last focused item are kept: a
   * container that attaches again starts where it was. `'stale'`: only the elements that are no
   * longer its items, because they belong to a nested composite or `itemSelector` no longer matches
   * them (every stamp); `'all'`: every element (the container detaches or is replaced, or
   * `manageTabIndex` turns off).
   */
  private release(
    container: HTMLElement,
    scope: 'stale' | 'all',
    records: readonly MutationRecord[] = [],
  ): void {
    const rewritten = rewrittenTabIndex(records);
    const { itemSelector, roleComposites } = this.options;
    for (const element of Array.from(container.querySelectorAll<HTMLElement>(STAMPED_SELECTOR))) {
      const original = this.stamped.get(element);
      if (!original) continue;
      if (
        scope === 'stale' &&
        matchesSelector(element, itemSelector) &&
        !isInNestedComposite(element, container, roleComposites)
      ) {
        continue;
      }
      this.stamped.delete(element);
      const current = element.getAttribute('tabindex');
      const authorWrote = current !== original.stamped || rewritten.has(element);
      // Written only to change the value: the hook's own writes never keep one (`rewrittenTabIndex`).
      if (!authorWrote && current !== original.tabIndex) {
        if (original.tabIndex === null) element.removeAttribute('tabindex');
        else element.setAttribute('tabindex', original.tabIndex);
      }
      if (
        original.addedValue !== null &&
        element.getAttribute('data-roving-value') === original.addedValue
      ) {
        element.removeAttribute('data-roving-value');
      }
    }
  }

  /**
   * Takes over, as the element's own, a `tabindex` the author wrote with the value the stamp had
   * left (`rewrittenTabIndex`): the next stamp cannot tell it from its own. Another value is taken
   * over by the next stamp.
   */
  private adopt(records: readonly MutationRecord[]): void {
    for (const target of rewrittenTabIndex(records)) {
      const original = this.stamped.get(target as Element);
      if (original) original.tabIndex = (target as Element).getAttribute('tabindex');
    }
  }

  /** The records the observer has not delivered yet; it delivers none of them afterwards. */
  private takeRecords(): MutationRecord[] {
    return this.observer?.takeRecords() ?? [];
  }

  private valueOf(element: HTMLElement, nested: boolean): string {
    const own = nested ? null : element.getAttribute('data-roving-value');
    if (own !== null) return own;
    let generated = this.autoValues.get(element);
    if (generated === undefined) {
      this.autoCounter += 1;
      generated = `auto-${this.autoCounter}`;
      this.autoValues.set(element, generated);
    }
    return generated;
  }

  private observe(): void {
    if (!this.container || this.observer || typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver((records) => {
      this.adopt(records);
      this.stamp();
      this.dirty = true;
      this.notify?.();
    });
    this.observer.observe(this.container, {
      subtree: true,
      childList: true,
      attributes: true,
      // With the old value, a write that keeps a value shows as the author's (`rewrittenTabIndex`).
      attributeOldValue: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    });
    this.dirty = true;
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}

function parseSnapshot(snapshot: string): SnapshotEntry[] | null {
  if (snapshot === '') return null;
  try {
    return JSON.parse(snapshot) as SnapshotEntry[];
  } catch {
    return null;
  }
}

function textOf(element: HTMLElement): string {
  return element.getAttribute('data-roving-text') ?? element.textContent ?? '';
}

/**
 * Whether an event target is the container or inside its DOM. React bubbles events from a portal
 * (a Menu.Popover or Popover.Content a Toolbar item renders) through the container although their
 * target is elsewhere in the document; those events are not the container's to handle.
 */
function isInContainer(container: Node, target: EventTarget | null): boolean {
  if (!target || typeof (target as Node).nodeType !== 'number') return false;
  return target === container || container.contains(target as Node);
}

/**
 * The item an event started in: the innermost item element that is the target or one of its
 * ancestors (up to the container). Items can nest (an APG treeitem contains the group of its child
 * treeitems), so the first containing item in DOM order would be the outermost ancestor.
 */
function findOwningItem(
  items: readonly ResolvedItem[],
  target: EventTarget | null,
  container: Node,
): ResolvedItem | null {
  if (items.length === 0 || !target || typeof (target as Node).nodeType !== 'number') return null;
  const byElement = new Map<Node, ResolvedItem>(items.map((item) => [item.element, item]));
  for (let node: Node | null = target as Node; node && node !== container; node = node.parentNode) {
    const item = byElement.get(node);
    if (item) return item;
  }
  return null;
}

/**
 * Whether a key started on the item itself (on the container when it started on no item), not on
 * content nested inside the item, such as a row's action button.
 */
function startsOnItem(item: ResolvedItem | null, target: EventTarget | null, container: Node) {
  return item ? target === getFocusTarget(item) : target === container;
}

/**
 * Implements the WAI-ARIA roving tabindex pattern for composite widgets: one item holds the tab
 * stop (`tabIndex=0`, all others `-1`), arrow keys move focus between items, Home/End jump to the
 * ends, and (optionally) typeahead jumps by text. Used by RadioGroup, Rating, SwatchPicker, List,
 * TabList, Tree, Menu and Toolbar.
 *
 * - **Items** come from the DOM at event time: elements matching `itemSelector` (default
 *   `[data-roving-value]`) whose nearest roving container is this one. A nested composite (an
 *   element with its own `data-roving-container`, or a radiogroup/listbox/grid/tablist/menu/tree/
 *   spinbutton role) counts as one item whose focus target is its own tab stop; the hook never
 *   writes tabindex inside it, so it keeps its own Tab stop. An element marked
 *   `data-roving-transparent` is never a nested composite by its role: its items are items of this
 *   container (the radios of `Toolbar.RadioGroup`); it must not carry a `data-roving-container`.
 *   Pass `items` to fix the order instead.
 *   In the 0.4 call shape and with explicit `items`, only elements with their own roving container
 *   are nested composites: a role-only `radiogroup`/`tablist`/… element between the container and
 *   the items (the widget's root inside a wrapper that holds the ref) does not swallow them.
 * - **Disabled items** (`data-roving-disabled`, `disabled`, `aria-disabled="true"`) are skipped and
 *   never hold the tab stop. Items marked `data-disabled-focusable` (the `disabledFocusable` prop
 *   of WaveUI buttons, links and choice controls) stay reachable and may hold the tab stop: APG
 *   allows focusable disabled items. The attribute only overrides `aria-disabled`: an item that is
 *   natively disabled or marked `data-roving-disabled` is still skipped. The enabled set is
 *   tracked with a MutationObserver, so an item that disables itself moves the tab stop without
 *   the owner re-rendering. With `manageTabIndex`, a control hidden by CSS counts as disabled and
 *   `input[type=hidden]` is no item.
 * - **Hand-back** (`manageTabIndex`): a container that stops being one (its ref detaches or moves
 *   to another element) or that stops managing tabIndex gives every element it stamped its own
 *   `tabindex` back (the one it had, or the one its author rendered since) and removes the
 *   `data-roving-value` it added, so each control is its own Tab stop again; attached again, it
 *   stamps again from the last focused item. An element `itemSelector` no longer matches is handed
 *   back at once.
 * - **Tab stop** (`tabStop`): `'active'` — the enabled `activeValue` item, else the first enabled
 *   item; `'last-focused'` — the last focused enabled item, else the `'active'` rule. A nested
 *   composite or a control that uses the arrow keys itself holds it only when no other item can;
 *   `'none'` — no item: every item is `tabIndex=-1` (a nested composite keeps its own tab stop;
 *   mark it `data-roving-transparent` to join the group's arrow order), and focus reaches the
 *   items only through the keys or a script.
 * - **Keys** are ignored when another handler already called `preventDefault()`; with Meta; with
 *   Alt or Ctrl, except a single character typed with AltGr (Ctrl+Alt on Windows), which is
 *   typeahead text (arrows, Home, End and Space with Ctrl+Alt stay ignored); and when they start
 *   in a text field, select, contenteditable, slider, spinbutton or editable combobox (Left/Right
 *   keep moving the caret; a select-only combobox such as Dropdown's button does not keep them).
 *   Left/Right are mirrored in RTL (`dir`, else the direction of the container at key time).
 *   Arrows and typeahead move from the item the key started in — the innermost one when items
 *   nest, as treeitems do inside their parent's group; when it started on no item (focus on the
 *   container itself) next goes to the first enabled item and prev to the last.
 *   An item whose `focus()` leaves focus where it was (the browser ignores it on an element CSS
 *   hides) is passed over for the next one, and is never recorded or reported to `onFocusMove`.
 *   Handled keys call `preventDefault()`. Keys and focus from outside the container's DOM — a
 *   popup an item renders through a portal, whose events React bubbles through the container —
 *   are ignored, so focus never leaves an open menu or popover for the container's items.
 *
 * @example
 * const { containerProps, getTabIndex } = useRovingTabIndex({ activeValue: value, orientation: 'both' });
 * <div role="radiogroup" {...containerProps}>
 *   <button role="radio" data-roving-value="a" tabIndex={getTabIndex('a')} />
 * </div>
 *
 * The 0.4 call shape `useRovingTabIndex(containerRef, options)` still works: pass the container's
 * ref object and attach `handleKeyDown` (and ideally `handleFocus`, and with `typeahead`
 * `handleKeyDownCapture` as `onKeyDownCapture`) yourself.
 *
 * @param options - See {@link UseRovingTabIndexOptions}.
 * @returns See {@link UseRovingTabIndexResult}.
 */
export function useRovingTabIndex(options: UseRovingTabIndexOptions): UseRovingTabIndexResult;
export function useRovingTabIndex(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseRovingTabIndexOptions,
): UseRovingTabIndexResult;
export function useRovingTabIndex(
  refOrOptions: React.RefObject<HTMLElement | null> | UseRovingTabIndexOptions,
  maybeOptions?: UseRovingTabIndexOptions,
): UseRovingTabIndexResult {
  const legacyRef =
    maybeOptions !== undefined ? (refOrOptions as React.RefObject<HTMLElement | null>) : undefined;
  const options = (maybeOptions ?? refOrOptions) as UseRovingTabIndexOptions;
  const {
    activeValue = null,
    items,
    orientation = 'horizontal',
    columns,
    loop = true,
    dir,
    itemSelector = DEFAULT_ITEM_SELECTOR,
    typeahead = false,
    homeEndKeys = true,
    tabStop = 'active',
    manageTabIndex = false,
    onFocusMove,
  } = options;

  const [store] = React.useState(() => new RovingStore());
  const snapshot = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [focusedValue, setFocusedValue] = React.useState<string | null>(null);
  // The last focused item that can hold the tab stop ('last-focused' during render).
  const [focusedStop, setFocusedStop] = React.useState<string | null>(null);

  // 0.4 call shape or explicit `items`: only elements with their own roving container are nested
  // composites (a role=radiogroup/tablist/… around the items is the widget's own root).
  const roleComposites = legacyRef === undefined && items === undefined;

  React.useLayoutEffect(() => {
    store.setOptions({ itemSelector, manageTabIndex, items, activeValue, tabStop, roleComposites });
    if (legacyRef) store.setContainer(legacyRef.current);
    store.stamp();
  });

  // C-DEV: `resolveOwn` treats a selector the browser rejects as "no items" (it runs during render,
  // where it must not throw), so the developer hears about it here.
  React.useEffect(() => {
    if (isDev && !isValidSelector(itemSelector)) {
      warnOnce(
        `useRovingTabIndex:itemSelector:${itemSelector}`,
        `useRovingTabIndex: itemSelector "${itemSelector}" is not a valid CSS selector in this browser; no item is navigable or tabbable.`,
      );
    }
  }, [itemSelector]);

  // C-DEV: a grid needs rows, from role="row" elements or a `columns` count.
  React.useEffect(() => {
    if (!isDev || orientation !== 'grid' || columns) return;
    const container = store.container;
    if (container && container.querySelector('[role="row"]') === null) {
      warnOnce(
        'useRovingTabIndex:grid-rows',
        'useRovingTabIndex: orientation "grid" needs role="row" elements around the items or a `columns` count; without either it acts as "both".',
      );
    }
  });

  // Tab stop during render, from the DOM snapshot (null before the container is known).
  const domItems = React.useMemo(() => parseSnapshot(snapshot), [snapshot]);
  const stopEntries = React.useMemo<readonly SnapshotEntry[] | null>(() => {
    if (!items) return domItems;
    // Explicit `items`: the listed values the DOM has, in the listed order. Every listed value
    // before the container is known, or while the DOM has none of them yet (items rendered in the
    // commit the snapshot has not caught up with).
    if (domItems) {
      const ranks = new Map(domItems);
      const present = items.flatMap((value): SnapshotEntry[] => {
        const rank = ranks.get(value);
        return rank === undefined ? [] : [[value, rank]];
      });
      if (present.length > 0) return present;
    }
    return items.map((value): SnapshotEntry => [value, 1]);
  }, [items, domItems]);
  const tabStopValue =
    tabStop === 'none'
      ? null
      : stopEntries
        ? resolveTabStop(stopEntries, activeValue, tabStop, focusedStop)
        : activeValue || null;

  const getTabIndex = React.useCallback(
    (value: string): 0 | -1 => (value === tabStopValue ? 0 : -1),
    [tabStopValue],
  );

  const containerRef = React.useCallback(
    (node: HTMLElement | null) => {
      store.setContainer(node);
      if (legacyRef) setRef(legacyRef, node);
    },
    [store, legacyRef],
  );

  const typeaheadItemsRef = React.useRef<TypeaheadItem[]>([]);
  // Every item matching the typed characters, in search order (the first is the match).
  const typeaheadMatchesRef = React.useRef<readonly string[]>([]);
  const { onTypeahead, isSearching } = useTypeahead({
    getItems: () => typeaheadItemsRef.current,
    onMatch: (_value, matches) => {
      typeaheadMatchesRef.current = matches;
    },
  });

  /** Focuses an item; `true` only when focus actually moved there (then it is recorded). */
  const focusItem = (item: ResolvedItem | undefined): boolean => {
    if (!item || item.disabled) return false;
    const target = getFocusTarget(item);
    if (!target) return false;
    target.focus();
    // Browsers ignore focus() on an element CSS hides (display: none, visibility: hidden).
    if (!hasFocus(target)) return false;
    store.recordFocus(item);
    return true;
  };

  /** Focuses the first item of `candidates` that takes focus. */
  const focusFirstOf = (candidates: readonly ResolvedItem[]): void => {
    for (const item of candidates) {
      if (focusItem(item)) return;
    }
  };

  // `spaceOnly` (the capture phase) handles nothing but a Space that continues a typeahead search.
  const handleKeys = useEventCallback((e: React.KeyboardEvent, spaceOnly: boolean) => {
    // Ctrl, Alt and Meta combinations are shortcuts, except a single character typed with AltGr
    // (Ctrl+Alt on Windows), which is typeahead text: arrows, Home, End and Space with it stay
    // shortcuts.
    const gridCtrlHomeEnd =
      orientation === 'grid' && e.ctrlKey && !e.altKey && (e.key === 'Home' || e.key === 'End');
    const shortcut =
      e.metaKey || ((e.altKey || e.ctrlKey) && !isAltGraphCharacter(e) && !gridCtrlHomeEnd);
    if (e.defaultPrevented || shortcut) return;
    if (ownsArrowKeys(e.target)) return;
    const container = store.container ?? (e.currentTarget as HTMLElement);
    // A key from a portaled popup is the popup's: never pull focus back out of it.
    if (!isInContainer(container, e.target)) return;
    const ordered = store.resolve(container);
    const enabled = ordered.filter((item) => !item.disabled);
    if (enabled.length === 0) return;

    // The (innermost) item the key started in. None (the container itself has focus): next → first,
    // prev → last.
    const current = findOwningItem(ordered, e.target, container);

    let handled = false;
    // Where focus goes, in order of preference: an item whose focus() does not move focus (hidden
    // by CSS) passes the key on to the next one.
    let targets: ResolvedItem[] = [];
    const rows =
      orientation === 'grid' && !spaceOnly ? groupIntoRows(ordered, container, columns) : null;
    const gridMove = rows ? gridTargets(e, rows, current) : undefined;
    const intent =
      spaceOnly || gridMove
        ? null
        : getArrowIntent(e.key, {
            orientation: orientation === 'grid' ? (rows ? 'horizontal' : 'both') : orientation,
            dir: dir ?? getDirection(e.currentTarget as Element),
          });
    if (gridMove) {
      handled = true;
      targets = gridMove === 'stay' ? [] : gridMove;
    } else if (intent) {
      handled = true;
      if (!current) {
        targets = intent === 'next' ? enabled : [...enabled].reverse();
      } else {
        const step = intent === 'next' ? 1 : -1;
        const count = ordered.length;
        let index = ordered.indexOf(current);
        for (let i = 1; i < count; i++) {
          index += step;
          if (index < 0 || index >= count) {
            if (!loop) break;
            index = (index + count) % count;
          }
          if (!ordered[index].disabled) targets.push(ordered[index]);
        }
      }
    } else if (!spaceOnly && homeEndKeys && (e.key === 'Home' || e.key === 'End')) {
      handled = true;
      targets = e.key === 'Home' ? enabled : [...enabled].reverse();
    } else if (typeahead && startsOnItem(current, e.target, container)) {
      typeaheadItemsRef.current = ordered.map((item) => ({
        value: item.value,
        text: textOf(item.element),
        disabled: item.disabled,
      }));
      typeaheadMatchesRef.current = [];
      if (onTypeahead(e, current?.value ?? null)) {
        handled = true;
        // The match first, then the next ones, for a match that does not take focus.
        targets = typeaheadMatchesRef.current.flatMap((value) =>
          enabled.filter((item) => item.value === value),
        );
      }
    }

    if (!handled) return;
    e.preventDefault();
    for (const next of targets) {
      // Back at the item the key started on (Home on the first item): focus stays.
      if (next === current) return;
      if (focusItem(next)) {
        onFocusMove?.(next.value, e);
        return;
      }
    }
  });

  const handleKeyDown = useEventCallback((e: React.KeyboardEvent) => handleKeys(e, false));

  // A Space that continues a typeahead search belongs to the search, not to the focused item: it is
  // handled and default-prevented in the capture phase, so the item's own keydown handler, which
  // skips default-prevented events, does not activate the item.
  const handleKeyDownCapture = useEventCallback((e: React.KeyboardEvent) => {
    if (typeahead && e.key === ' ' && isSearching()) handleKeys(e, true);
  });

  const handleFocus = useEventCallback((e: React.FocusEvent) => {
    const container = store.container ?? (e.currentTarget as HTMLElement);
    if (!isInContainer(container, e.target)) return;
    const item = findOwningItem(store.resolve(container), e.target, container);
    if (!item) return;
    store.recordFocus(item);
    setFocusedValue(item.value);
    if (canHoldTabStop(item)) setFocusedStop(item.value);
    store.stamp();
  });

  const focusValue = useEventCallback((value: string) => {
    focusItem(store.resolve().find((item) => item.value === value));
  });
  const focusFirst = useEventCallback(() => {
    focusFirstOf(store.resolve().filter((item) => !item.disabled));
  });
  const focusLast = useEventCallback(() => {
    focusFirstOf(
      store
        .resolve()
        .filter((item) => !item.disabled)
        .reverse(),
    );
  });

  const containerProps = React.useMemo<RovingContainerProps>(
    () => ({
      ref: containerRef,
      'data-roving-container': '',
      onKeyDown: handleKeyDown,
      onKeyDownCapture: handleKeyDownCapture,
      onFocus: handleFocus,
    }),
    [containerRef, handleKeyDown, handleKeyDownCapture, handleFocus],
  );

  return {
    containerProps,
    handleKeyDown,
    handleKeyDownCapture,
    handleFocus,
    getTabIndex,
    focusedValue,
    focusValue,
    focusFirst,
    focusLast,
  };
}
