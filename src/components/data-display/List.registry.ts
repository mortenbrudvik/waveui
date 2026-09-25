/**
 * The item registry of the List component (internal module: not re-exported by the barrels).
 *
 * Items register their value in a layout effect; the List reads the registered set during render
 * (C-HOOKS: an external store instead of setState in an effect).
 */

const NO_VALUES: readonly string[] = [];

/** What one mounted item registered. */
export interface ListItemRecord {
  /** The item's explicit `value` (`undefined`: the item cannot be selected). */
  value: string | undefined;
  /** Whether the item has an action (a selectable list with actions renders a grid). */
  hasAction: boolean;
  /** The item element's ref, read after a commit to keep the records in DOM order. */
  element: { readonly current: Element | null };
}

/** The data collected from the records, see {@link ListRegistrySnapshot}. */
export interface ListRegistryData {
  values: readonly string[];
  valueSet: ReadonlySet<string>;
  /** Values that more than one item holds, each listed once. */
  duplicates: readonly string[];
  count: number;
  hasActions: boolean;
}

/**
 * What the items of a List registered, published through `useSyncExternalStore`.
 *
 * Creating a snapshot is O(1): the data is collected from the records the first time it is read
 * (the List's next render), so a commit that mounts or unmounts n items costs O(n) in total
 * instead of one full rebuild per item (table-core#22). A newer snapshot replaces this one on every
 * change, and React always renders with the newest, so the lazily read records are the current
 * ones.
 */
export class ListRegistrySnapshot {
  private data: ListRegistryData | null = null;

  constructor(private readonly records: ReadonlyMap<object, ListItemRecord>) {}

  /** Item values in DOM order (see {@link ListRegistry.syncOrder}), without duplicates. */
  get values(): readonly string[] {
    return this.read().values;
  }

  get valueSet(): ReadonlySet<string> {
    return this.read().valueSet;
  }

  /** Values that more than one mounted item holds (each listed once). */
  get duplicates(): readonly string[] {
    return this.read().duplicates;
  }

  /** Number of mounted items (with or without a value). */
  get count(): number {
    return this.read().count;
  }

  /** Whether any item has an action. */
  get hasActions(): boolean {
    return this.read().hasActions;
  }

  /** Collects the data from the records: O(n), once per snapshot. Public for the cost test only. */
  build(): ListRegistryData {
    const values: string[] = [];
    const valueSet = new Set<string>();
    const duplicateSet = new Set<string>();
    let hasActions = false;
    for (const record of this.records.values()) {
      if (record.hasAction) hasActions = true;
      if (record.value === undefined) continue;
      if (valueSet.has(record.value)) {
        duplicateSet.add(record.value);
      } else {
        valueSet.add(record.value);
        values.push(record.value);
      }
    }
    const duplicates = duplicateSet.size > 0 ? Array.from(duplicateSet) : NO_VALUES;
    return { values, valueSet, duplicates, count: this.records.size, hasActions };
  }

  private read(): ListRegistryData {
    this.data ??= this.build();
    return this.data;
  }
}

/** The item that held focus when it was removed, recorded for the List's focus restore. */
export interface ListFocusLoss {
  /** The item's explicit `value`, if it has one. */
  value: string | undefined;
  /** Its position among the list's items. */
  index: number;
}

/**
 * The registry behind a List's snapshot.
 *
 * Only a selectable List publishes (`setActive(true)` in its layout effect): a plain list never
 * reads the registry, so its items' registrations cost O(1) and cause no renders. The snapshot is
 * `null` while inactive and until the List's first commit, so the server and the first client
 * render treat every selected value as present.
 */
export class ListRegistry {
  private readonly records = new Map<object, ListItemRecord>();
  private readonly listeners = new Set<() => void>();
  private active = false;
  private snapshot: ListRegistrySnapshot | null = null;
  private focusLoss: ListFocusLoss | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ListRegistrySnapshot | null => this.snapshot;

  getServerSnapshot = (): ListRegistrySnapshot | null => null;

  /**
   * Adds an item's record, or updates it in place: a `Map.set` on an existing token keeps its
   * position, so an item whose value or action changes does not move to the end. Publishes only
   * when the value or the action changed.
   */
  set(token: object, record: ListItemRecord): void {
    const previous = this.records.get(token);
    this.records.set(token, record);
    if (previous && previous.value === record.value && previous.hasAction === record.hasAction) {
      return;
    }
    this.publish();
  }

  /** Removes an item's record (on unmount only). */
  delete(token: object): void {
    if (this.records.delete(token)) this.publish();
  }

  /**
   * Puts the records in DOM order, so `values` (and with it the List's Tab stop, the first selected
   * item) follows the DOM. Items that mount between others register last, and keyed moves do not
   * register again, so the List calls this after each of its commits. O(n); publishes only when
   * the order changed. The records keep their registration order while an item is not a direct
   * child of `root` (an element wrapped around an item) or has no element.
   *
   * The children are walked with `nextElementSibling`, never through the `root.children`
   * collection: jsdom does not cache indexed `HTMLCollection` access, so an indexed loop (or
   * `Array.from`) is O(n²) there and made every commit of a large list in a consumer's test suite
   * cost seconds.
   */
  syncOrder(root: Element | null): void {
    if (!this.active || !root || this.records.size < 2) return;
    const byElement = new Map<Element, [object, ListItemRecord]>();
    for (const entry of this.records) {
      const element = entry[1].element.current;
      if (!element || element.parentElement !== root) return;
      byElement.set(element, entry);
    }
    const ordered: [object, ListItemRecord][] = [];
    const current = this.records.keys();
    let moved = false;
    for (let child = root.firstElementChild; child; child = child.nextElementSibling) {
      const entry = byElement.get(child);
      if (!entry) continue;
      ordered.push(entry);
      if (!moved && current.next().value !== entry[0]) moved = true;
    }
    if (!moved || ordered.length !== this.records.size) return;
    this.records.clear();
    for (const [token, record] of ordered) this.records.set(token, record);
    this.publish();
  }

  /** Called by the List after each commit that changes `selectable` (and on mount). */
  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      this.publish();
    } else if (this.snapshot !== null) {
      this.snapshot = null;
      this.notify();
    }
  }

  /** `values` without the ones no mounted item has (read at event time). */
  prune(values: readonly string[]): string[] {
    const snapshot = this.snapshot;
    return snapshot ? values.filter((value) => snapshot.valueSet.has(value)) : [...values];
  }

  /**
   * Records that a removed item (or action) held focus. Only the current commit can use it: the
   * record is dropped in a microtask, so a later commit never moves focus because of an old removal.
   */
  recordFocusLoss(loss: ListFocusLoss): void {
    this.focusLoss = loss;
    queueMicrotask(() => {
      if (this.focusLoss === loss) this.focusLoss = null;
    });
  }

  takeFocusLoss(): ListFocusLoss | null {
    const loss = this.focusLoss;
    this.focusLoss = null;
    return loss;
  }

  private publish(): void {
    if (!this.active) return;
    this.snapshot = new ListRegistrySnapshot(this.records);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
