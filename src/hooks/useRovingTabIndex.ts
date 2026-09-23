import * as React from 'react';
import { getArrowIntent, getDirection, type Direction } from '../lib/direction';
import { getFirstTabbable } from '../lib/focus';
import { setRef } from '../lib/mergeRefs';
import { useEventCallback } from './useEventCallback';
import { useTypeahead, type TypeaheadItem } from './useTypeahead';

/** Configuration options for the {@link useRovingTabIndex} hook. */
export interface UseRovingTabIndexOptions {
  /**
   * The selected value. It may be absent, `''` or `null` (nothing selected) and does not have to be
   * one of the items.
   */
  activeValue?: string | null;
  /**
   * Explicit item order (0.4 call shape). Omitted ⇒ the DOM order of the elements matching
   * `itemSelector`. Disabled items are skipped either way.
   */
  items?: string[];
  /**
   * Arrow key axis: `'horizontal'` uses Left/Right (mirrored in RTL), `'vertical'` uses Up/Down,
   * `'both'` uses all four.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /**
   * Whether arrow keys wrap around at the ends.
   * @default true
   */
  loop?: boolean;
  /** Text direction. Defaults to the direction of the container at key time (`getDirection`). */
  dir?: Direction;
  /**
   * Selector for the item elements inside the container.
   * @default '[data-roving-value]'
   */
  itemSelector?: string;
  /**
   * Printable characters move focus to the next item whose text (`data-roving-text`, else its
   * text content) starts with them.
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
   *  'active' — APG Toolbar (and the static Menu). */
  tabStop?: 'active' | 'last-focused';
  /** true ⇒ the hook writes tabIndex 0/-1 onto item elements itself and assigns
   *  data-roving-value="auto-<n>" to items that lack one. For containers that do not render their
   *  items (Toolbar children, Menu items, Tree rows). Default false (items call getTabIndex). */
  manageTabIndex?: boolean;
  /** Called after an arrow, Home/End or typeahead key moved focus to `value`. */
  onFocusMove?: (value: string, event: React.KeyboardEvent) => void;
}

/** Props to spread onto the container element. */
export interface RovingContainerProps {
  ref: React.RefCallback<HTMLElement>;
  'data-roving-container': '';
  onKeyDown: React.KeyboardEventHandler;
  onFocus: React.FocusEventHandler;
}

/** Result of {@link useRovingTabIndex}. */
export interface UseRovingTabIndexResult {
  /** Spread onto the container: ref, `data-roving-container` marker and the key/focus handlers. */
  containerProps: RovingContainerProps;
  /** The container's keydown handler (same function as `containerProps.onKeyDown`). */
  handleKeyDown: (e: React.KeyboardEvent) => void;
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

interface ResolvedItem {
  value: string;
  /** The item element (for a nested composite: its root). */
  element: HTMLElement;
  /** A nested composite (own roving container or composite role) counts as one item. */
  nested: boolean;
  disabled: boolean;
}

interface StoreOptions {
  itemSelector: string;
  manageTabIndex: boolean;
  items: string[] | undefined;
  activeValue: string | null;
  tabStop: 'active' | 'last-focused';
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

/** Roles whose widgets use the arrow keys themselves. */
const ARROW_KEY_OWNER_ROLES = new Set(['slider', 'spinbutton', 'combobox', 'textbox', 'searchbox']);

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
  'data-roving-disabled',
  'data-roving-value',
  'data-roving-container',
  'tabindex',
  'hidden',
  'inert',
  'role',
];

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function isNestedComposite(el: Element, roleComposites: boolean): boolean {
  if (el.hasAttribute('data-roving-container')) return true;
  if (!roleComposites) return false;
  const role = el.getAttribute('role');
  return role !== null && COMPOSITE_ROLES.has(role);
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

function isDisabledElement(el: HTMLElement): boolean {
  const marker = el.getAttribute('data-roving-disabled');
  if (marker !== null && marker !== 'false') return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  if ((el as { disabled?: unknown }).disabled === true) return true;
  try {
    return el.matches(':disabled');
  } catch {
    return false;
  }
}

/** Text-entry fields and widgets that use the arrow keys themselves (APG Toolbar). */
function ownsArrowKeys(target: EventTarget | null): boolean {
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

function resolveTabStop(
  enabledValues: readonly string[],
  activeValue: string | null,
  tabStop: 'active' | 'last-focused',
  lastFocused: string | null,
): string | null {
  if (tabStop === 'last-focused' && lastFocused !== null && enabledValues.includes(lastFocused)) {
    return lastFocused;
  }
  if (activeValue !== null && activeValue !== '' && enabledValues.includes(activeValue)) {
    return activeValue;
  }
  return enabledValues[0] ?? null;
}

function orderByItems(resolved: ResolvedItem[], items: string[] | undefined): ResolvedItem[] {
  if (!items) return resolved;
  const byValue = new Map(resolved.map((item) => [item.value, item]));
  const ordered: ResolvedItem[] = [];
  for (const value of items) {
    const item = byValue.get(value);
    if (item) ordered.push(item);
  }
  return ordered;
}

type SnapshotEntry = [value: string, enabled: 0 | 1];

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

  private readonly stamped = new WeakSet<Element>();
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
      // DOM facts only (order and disabled state); `items` is applied during render.
      const entries: SnapshotEntry[] = this.resolveOwn().map((item) => [
        item.value,
        item.disabled ? 0 : 1,
      ]);
      this.snapshot = JSON.stringify(entries);
    }
    return this.snapshot;
  };

  getServerSnapshot = (): string => '';

  setContainer(container: HTMLElement | null): void {
    if (container === this.container) return;
    this.disconnect();
    this.container = container;
    this.dirty = true;
    if (this.notify) {
      this.observe();
      this.notify();
    }
  }

  setLastFocused(value: string | null): void {
    this.lastFocused = value;
  }

  setOptions(options: StoreOptions): void {
    const previous = this.options;
    this.options = options;
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
      return [];
    }

    const result: ResolvedItem[] = [];
    const seen = new Set<Element>();
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
      // An author tabindex="-1" (a SpinButton stepper, SplitButton internals) opts out.
      if (
        !nested &&
        manageTabIndex &&
        candidate.getAttribute('tabindex') === '-1' &&
        !this.stamped.has(candidate)
      ) {
        continue;
      }
      seen.add(element);

      const item: ResolvedItem = {
        value: this.valueOf(element, nested),
        element,
        nested,
        disabled: isDisabledElement(element),
      };
      if (nested && !item.disabled && !getFocusTarget(item)) item.disabled = true;
      result.push(item);
    }
    return result;
  }

  /** manageTabIndex: writes tabIndex 0 on the tab stop and -1 on every other own item. */
  stamp(): void {
    if (!this.options.manageTabIndex || !this.container) return;
    const resolved = this.resolve();
    const enabledValues = resolved.filter((item) => !item.disabled).map((item) => item.value);
    const stop = resolveTabStop(
      enabledValues,
      this.options.activeValue,
      this.options.tabStop,
      this.lastFocused,
    );
    for (const item of resolved) {
      if (item.nested) continue;
      const { element } = item;
      this.stamped.add(element);
      const tabIndex = item.value === stop ? '0' : '-1';
      if (element.getAttribute('tabindex') !== tabIndex) element.setAttribute('tabindex', tabIndex);
      if (!element.hasAttribute('data-roving-value')) {
        element.setAttribute('data-roving-value', item.value);
      }
    }
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
    this.observer = new MutationObserver(() => {
      this.stamp();
      this.dirty = true;
      this.notify?.();
    });
    this.observer.observe(this.container, {
      subtree: true,
      childList: true,
      attributes: true,
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
 * Implements the WAI-ARIA roving tabindex pattern for composite widgets: one item holds the tab
 * stop (`tabIndex=0`, all others `-1`), arrow keys move focus between items, Home/End jump to the
 * ends, and (optionally) typeahead jumps by text. Used by RadioGroup and TabList.
 *
 * - **Items** come from the DOM at event time: elements matching `itemSelector` (default
 *   `[data-roving-value]`) whose nearest roving container is this one. A nested composite (an
 *   element with its own `data-roving-container`, or a radiogroup/listbox/grid/tablist/menu/tree/
 *   spinbutton role) counts as one item whose focus target is its own tab stop; the hook never
 *   writes tabindex inside it, so it keeps its own Tab stop. Pass `items` to fix the order instead.
 *   In the 0.4 call shape and with explicit `items`, only elements with their own roving container
 *   are nested composites: a role-only `radiogroup`/`tablist`/… element between the container and
 *   the items (the widget's root inside a wrapper that holds the ref) does not swallow them.
 * - **Disabled items** (`disabled`, `aria-disabled="true"`, `data-roving-disabled`) are skipped and
 *   never hold the tab stop. The enabled set is tracked with a MutationObserver, so an item that
 *   disables itself moves the tab stop without the owner re-rendering.
 * - **Tab stop** (`tabStop`): `'active'` — the enabled `activeValue` item, else the first enabled
 *   item; `'last-focused'` — the last focused enabled item, else the `'active'` rule.
 * - **Keys** are ignored when another handler already called `preventDefault()`, with Alt/Ctrl/Meta,
 *   and when they start in a text field, select, contenteditable, slider, spinbutton or combobox
 *   (Left/Right keep moving the caret). Left/Right are mirrored in RTL (`dir`, else the direction of
 *   the container at key time). Arrows move from the item the key started in; when it started on no
 *   item (focus on the container itself) next goes to the first enabled item and prev to the last.
 *   Handled keys call `preventDefault()`.
 *
 * @example
 * const { containerProps, getTabIndex } = useRovingTabIndex({ activeValue: value, orientation: 'both' });
 * <div role="radiogroup" {...containerProps}>
 *   <button role="radio" data-roving-value="a" tabIndex={getTabIndex('a')} />
 * </div>
 *
 * The 0.4 call shape `useRovingTabIndex(containerRef, options)` still works: pass the container's
 * ref object and attach `handleKeyDown` (and ideally `handleFocus`) yourself.
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

  // 0.4 call shape or explicit `items`: only elements with their own roving container are nested
  // composites (a role=radiogroup/tablist/… around the items is the widget's own root).
  const roleComposites = legacyRef === undefined && items === undefined;

  useIsomorphicLayoutEffect(() => {
    store.setOptions({ itemSelector, manageTabIndex, items, activeValue, tabStop, roleComposites });
    if (legacyRef) store.setContainer(legacyRef.current);
    store.stamp();
  });

  // Tab stop during render, from the DOM snapshot (null before the container is known).
  const domItems = React.useMemo(() => parseSnapshot(snapshot), [snapshot]);
  const enabledValues = React.useMemo<string[] | null>(() => {
    if (items) {
      if (!domItems) return items;
      const disabled = new Set(domItems.filter(([, on]) => on === 0).map(([value]) => value));
      return items.filter((value) => !disabled.has(value));
    }
    return domItems ? domItems.filter(([, on]) => on === 1).map(([value]) => value) : null;
  }, [items, domItems]);
  const tabStopValue = enabledValues
    ? resolveTabStop(enabledValues, activeValue, tabStop, focusedValue)
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
  const typeaheadMatchRef = React.useRef<string | null>(null);
  const { onTypeahead } = useTypeahead({
    getItems: () => typeaheadItemsRef.current,
    onMatch: (value) => {
      typeaheadMatchRef.current = value;
    },
  });

  const focusItem = (item: ResolvedItem | undefined): boolean => {
    if (!item || item.disabled) return false;
    const target = getFocusTarget(item);
    if (!target) return false;
    target.focus();
    store.setLastFocused(item.value);
    return true;
  };

  const handleKeyDown = useEventCallback((e: React.KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (ownsArrowKeys(e.target)) return;
    const container = store.container ?? (e.currentTarget as HTMLElement);
    const ordered = store.resolve(container);
    const enabled = ordered.filter((item) => !item.disabled);
    if (enabled.length === 0) return;

    // The item the key started in. None (the container itself has focus): next → first, prev → last.
    const target = e.target as Node;
    const current =
      ordered.find((item) => item.element === target || item.element.contains(target)) ?? null;

    let handled = false;
    let next: ResolvedItem | undefined;
    const intent = getArrowIntent(e.key, {
      orientation,
      dir: dir ?? getDirection(e.currentTarget as Element),
    });
    if (intent) {
      handled = true;
      if (!current) {
        next = intent === 'next' ? enabled[0] : enabled[enabled.length - 1];
      } else {
        const step = intent === 'next' ? 1 : -1;
        const count = ordered.length;
        let index = ordered.indexOf(current);
        for (let i = 0; i < count; i++) {
          index += step;
          if (index < 0 || index >= count) {
            if (!loop) break;
            index = (index + count) % count;
          }
          if (!ordered[index].disabled) {
            next = ordered[index];
            break;
          }
        }
      }
    } else if (homeEndKeys && (e.key === 'Home' || e.key === 'End')) {
      handled = true;
      next = e.key === 'Home' ? enabled[0] : enabled[enabled.length - 1];
    } else if (typeahead) {
      typeaheadItemsRef.current = ordered.map((item) => ({
        value: item.value,
        text: textOf(item.element),
        disabled: item.disabled,
      }));
      typeaheadMatchRef.current = null;
      if (onTypeahead(e, current?.value ?? null)) {
        handled = true;
        next = enabled.find((item) => item.value === typeaheadMatchRef.current);
      }
    }

    if (!handled) return;
    e.preventDefault();
    if (!next || next === current) return;
    if (focusItem(next)) onFocusMove?.(next.value, e);
  });

  const handleFocus = useEventCallback((e: React.FocusEvent) => {
    const container = store.container ?? (e.currentTarget as HTMLElement);
    const target = e.target as Node;
    const item = store
      .resolve(container)
      .find((candidate) => candidate.element === target || candidate.element.contains(target));
    if (!item) return;
    store.setLastFocused(item.value);
    setFocusedValue(item.value);
    store.stamp();
  });

  const focusValue = useEventCallback((value: string) => {
    focusItem(store.resolve().find((item) => item.value === value));
  });
  const focusFirst = useEventCallback(() => {
    focusItem(store.resolve().find((item) => !item.disabled));
  });
  const focusLast = useEventCallback(() => {
    const enabled = store.resolve().filter((item) => !item.disabled);
    focusItem(enabled[enabled.length - 1]);
  });

  const containerProps = React.useMemo<RovingContainerProps>(
    () => ({
      ref: containerRef,
      'data-roving-container': '',
      onKeyDown: handleKeyDown,
      onFocus: handleFocus,
    }),
    [containerRef, handleKeyDown, handleFocus],
  );

  return {
    containerProps,
    handleKeyDown,
    handleFocus,
    getTabIndex,
    focusedValue,
    focusValue,
    focusFirst,
    focusLast,
  };
}
