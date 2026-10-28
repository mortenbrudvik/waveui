// ---------------------------------------------------------------------------
// Selection store
// ---------------------------------------------------------------------------

type SelectAllState = 'all' | 'some' | 'none';

/**
 * The rows of a grid with `items`, whether rendered or not (see {@link SelectionStore.setUniverse}).
 *
 * @internal Not exported from the package (exported for its unit tests).
 */
export interface SelectionUniverse {
  /** The row ids of `items`, in their order (a repeated id counts once). */
  ids: readonly string[];
  /** The ids whose selection `isSelectionDisabled` disables. */
  disabled: ReadonlySet<string>;
}

/**
 * Selection state shared with the rows through `useSyncExternalStore`, so toggling one row
 * re-renders only that row (and the select-all header cell). The root pushes the committed
 * selection in a layout effect; rows register their ids. Select-all covers the rows of the
 * universe (a grid with `items`: every row id of `items`, rendered or not) or, without one, the
 * registered rows, whose effective selection is `selected ∩ registered`, derived on read (no
 * pruning effect).
 *
 * @internal Not exported from the package (exported for its unit tests).
 */
export interface SelectionStore {
  /**
   * Row subscription: notified only when the selection changes. Rows registering or unregistering
   * notify no row, so adding or removing k of n rows costs O(k), not O(k·n); the one exception is
   * single mode with several selected ids and no universe, where a row registering can move the
   * selected row.
   */
  subscribe(listener: () => void): () => void;
  /**
   * Select-all subscription: notified only when {@link getSelectAllState} changes (through the
   * selection, the universe, or rows registering and unregistering).
   */
  subscribeSelectAll(listener: () => void): () => void;
  /** Registers a rendered row id; returns the unregister function. */
  register(rowId: string): () => void;
  /**
   * Marks a row's selection disabled (`selectionCellProps.disabled`): select-all skips it and its
   * state counts only the other rows. Returns the function that undoes it. A row id is disabled
   * while any row registered with it is.
   */
  disable(rowId: string): () => void;
  /** Whether the row's selection is disabled (see {@link disable}). */
  isDisabled(rowId: string): boolean;
  /** How many rendered rows are registered with `rowId` (more than one: a duplicate). */
  countRegistrations(rowId: string): number;
  /** Sets the committed selection (layout effect of the root). */
  setSelected(items: readonly string[]): void;
  /**
   * Sets whether the grid is in single mode (layout effect of the root). Only then do rows
   * registering or unregistering re-check the one selected row of single mode and notify the rows.
   */
  setSingleMode(single: boolean): void;
  /**
   * Sets the universe of a grid with `items` (layout effect of the root; `null` without `items`).
   * With a universe, select-all and its state cover the ids of the universe whose selection is
   * disabled neither by it nor by a registered row, rendered or not, and registrations change only
   * which rows are disabled; the one selected row of single mode is the first selected id. O(n);
   * notifies no row, unless it moves the one selected row of single mode.
   */
  setUniverse(universe: SelectionUniverse | null): void;
  /**
   * Whether the row is selected. With `single`, only one row is: with a universe, the first
   * selected id; without one, the first selected id (in selection order) whose row is registered,
   * else the first selected id (before any row registered: the server render and the first client
   * render).
   */
  isSelected(rowId: string, single?: boolean): boolean;
  /**
   * Whether all, some or none of the rows select-all changes are selected: those of the universe,
   * else the registered rows, whose selection is not disabled (`'none'` without such rows). A
   * selected row whose selection is disabled counts toward nothing. O(1).
   */
  getSelectAllState(): SelectAllState;
  /** The ids select-all changes (see {@link getSelectAllState}), in the order of the universe. */
  getSelectableIds(): string[];
  /** The ids of the universe in its order; without one, the registered row ids. */
  getUniverseIds(): readonly string[];
  /** Whether there is a universe and `rowId` is not in it (select-all never changes the row). */
  isOutsideUniverse(rowId: string): boolean;
  /** Registered row ids in registration order. */
  getRegistered(): string[];
  /** `items` restricted to registered rows (order of `items`). */
  prune(items: readonly string[]): string[];
}

/**
 * Creates the {@link SelectionStore} of one DataGrid; `initialUniverse` is the universe of a grid
 * with `items` (see {@link SelectionStore.setUniverse}), so its first render knows the select-all
 * state.
 *
 * @internal Not exported from the package (exported for its unit tests).
 */
export function createSelectionStore(
  initial: readonly string[],
  initialSingleMode = false,
  initialUniverse: SelectionUniverse | null = null,
): SelectionStore {
  let selected: ReadonlySet<string> = new Set(initial);
  /** Registered row id -> number of rows registered with it. */
  const registered = new Map<string, number>();
  /** Row id -> number of `disable` calls in effect for it. */
  const disabled = new Map<string, number>();
  /** The universe last set (compared by identity, so setting it again costs nothing). */
  let universeInput: SelectionUniverse | null = null;
  /** The universe's ids in its order, without repeats; `null` without a universe. */
  let universeIds: readonly string[] | null = null;
  let universeIdSet: ReadonlySet<string> = new Set();
  let universeDisabled: ReadonlySet<string> = new Set();
  /** Row ids select-all changes: in the universe (or registered) and not disabled. */
  let enabledCount = 0;
  /** How many of those are selected (kept up to date, so select-all is O(1)). */
  let selectedEnabled = 0;
  let selectAll: SelectAllState = 'none';
  let singleMode = initialSingleMode;
  /** The one selected row of single mode (see `isSelected`); `undefined`: not computed yet. */
  let singleId: string | null | undefined;
  const rowListeners = new Set<() => void>();
  const selectAllListeners = new Set<() => void>();

  const notify = (listeners: Set<() => void>) => {
    for (const listener of Array.from(listeners)) listener();
  };

  /** Computed on read: O(selected ids) once per change, and only in single mode. */
  const getSingleId = (): string | null => {
    if (singleId !== undefined) return singleId;
    let first: string | null = null;
    for (const rowId of selected) {
      if (universeIds !== null || registered.has(rowId)) {
        first = rowId;
        break;
      }
      first ??= rowId;
    }
    singleId = first;
    return first;
  };

  /**
   * A row id registered or unregistered. Without a universe and with several selected ids, the
   * one selected row of single mode can move: in single mode it is re-checked and the rows are
   * notified if it moved.
   */
  const onRegistrationChange = (rowId: string) => {
    if (universeIds !== null || selected.size < 2 || !selected.has(rowId)) return;
    const previous = singleId;
    singleId = undefined;
    if (singleMode && getSingleId() !== previous) notify(rowListeners);
  };

  const computeSelectAll = (): SelectAllState => {
    if (selectedEnabled === 0) return 'none';
    return selectedEnabled === enabledCount ? 'all' : 'some';
  };

  const updateSelectAll = () => {
    const next = computeSelectAll();
    if (next === selectAll) return;
    selectAll = next;
    notify(selectAllListeners);
  };

  const isEnabled = (rowId: string) =>
    (universeIds !== null ? universeIdSet.has(rowId) : registered.has(rowId)) &&
    !disabled.has(rowId) &&
    !universeDisabled.has(rowId);

  /** Counts the selected rows select-all changes: O(selected ids). */
  const countSelected = () => {
    selectedEnabled = 0;
    for (const rowId of selected) if (isEnabled(rowId)) selectedEnabled += 1;
  };

  /** Takes a universe (or none) and counts again: O(n). */
  const applyUniverse = (universe: SelectionUniverse | null) => {
    universeInput = universe;
    universeIdSet = new Set(universe?.ids);
    universeIds = universe ? Array.from(universeIdSet) : null;
    universeDisabled = universe?.disabled ?? new Set();
    enabledCount = 0;
    for (const rowId of universeIds ?? registered.keys()) if (isEnabled(rowId)) enabledCount += 1;
    countSelected();
  };

  if (initialUniverse) {
    applyUniverse(initialUniverse);
    selectAll = computeSelectAll();
  }

  /**
   * Runs `change` (a registration or a `disable` of `rowId`) and keeps the counts of select-all in
   * step with whether the row is enabled before and after it.
   */
  const changeRow = (rowId: string, change: () => void) => {
    const wasEnabled = isEnabled(rowId);
    change();
    const nowEnabled = isEnabled(rowId);
    if (wasEnabled === nowEnabled) return;
    const step = nowEnabled ? 1 : -1;
    enabledCount += step;
    if (selected.has(rowId)) selectedEnabled += step;
  };

  /** Adds `step` to the count of `rowId` in `counts`, deleting it at zero. */
  const count = (counts: Map<string, number>, rowId: string, step: 1 | -1) => {
    const next = (counts.get(rowId) ?? 0) + step;
    if (next > 0) counts.set(rowId, next);
    else counts.delete(rowId);
  };

  const subscribeTo = (listeners: Set<() => void>) => (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    subscribe: subscribeTo(rowListeners),
    subscribeSelectAll: subscribeTo(selectAllListeners),
    register(rowId) {
      const first = !registered.has(rowId);
      changeRow(rowId, () => count(registered, rowId, 1));
      updateSelectAll();
      if (first) onRegistrationChange(rowId);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        changeRow(rowId, () => count(registered, rowId, -1));
        if (registered.has(rowId)) return;
        updateSelectAll();
        onRegistrationChange(rowId);
      };
    },
    disable(rowId) {
      changeRow(rowId, () => count(disabled, rowId, 1));
      updateSelectAll();
      let done = false;
      return () => {
        if (done) return;
        done = true;
        changeRow(rowId, () => count(disabled, rowId, -1));
        updateSelectAll();
      };
    },
    isDisabled(rowId) {
      return disabled.has(rowId);
    },
    setSelected(items) {
      const next = new Set(items);
      if (next.size === selected.size && items.every((item) => selected.has(item))) return;
      selected = next;
      singleId = undefined;
      countSelected();
      notify(rowListeners);
      updateSelectAll();
    },
    setSingleMode(single) {
      singleMode = single;
    },
    setUniverse(universe) {
      if (universe === universeInput) return;
      const previousSingleId = singleId;
      applyUniverse(universe);
      updateSelectAll();
      // With a universe the one selected row of single mode is the first selected id, without one
      // the first registered: it moves only when a grid gains or loses `items`.
      singleId = undefined;
      if (singleMode && previousSingleId !== undefined && getSingleId() !== previousSingleId) {
        notify(rowListeners);
      }
    },
    isSelected(rowId, single = false) {
      return single ? getSingleId() === rowId : selected.has(rowId);
    },
    countRegistrations(rowId) {
      return registered.get(rowId) ?? 0;
    },
    getSelectAllState() {
      return selectAll;
    },
    getSelectableIds() {
      return Array.from(universeIds ?? registered.keys()).filter(isEnabled);
    },
    getUniverseIds() {
      return universeIds ?? Array.from(registered.keys());
    },
    isOutsideUniverse(rowId) {
      return universeIds !== null && !universeIdSet.has(rowId);
    },
    getRegistered() {
      return Array.from(registered.keys());
    },
    prune(items) {
      return items.filter((item) => registered.has(item));
    },
  };
}
