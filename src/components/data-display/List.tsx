import * as React from 'react';
import { cn } from '../../lib/cn';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext, warnDeprecated, warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { FOCUSABLE_SELECTOR, isFocusable } from '../../lib/focus';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { focusRingInset, forcedColors } from '../../lib/styles';
import type { SelectionMode } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { ListRegistry, type ListFocusLoss } from './List.registry';

/** Selection modes of {@link List}: the shared `SelectionMode` plus the deprecated `'multi'`. */
export type ListSelectionMode = SelectionMode | 'multi';

/**
 * Properties for the List component.
 *
 * The type parameter `M` is the `selectionMode` literal. It makes the single-selection props
 * (`selectedItem`, `defaultSelectedItem`, `onSelectedItemChange`) type errors when
 * `selectionMode="multiple"` is passed; `ListProps` without a type argument accepts every mode
 * (the 0.4 shape, extendable by interfaces).
 */
export interface ListProps<
  M extends ListSelectionMode = ListSelectionMode,
> extends React.HTMLAttributes<HTMLUListElement> {
  /** Whether list items can be selected.
   * @default false
   */
  selectable?: boolean;
  /**
   * Selection behavior when `selectable` is true. `'multi'` is a deprecated alias of `'multiple'`.
   * @default 'single'
   */
  selectionMode?: M;
  /**
   * Controlled array of selected item values (both modes). In single mode prefer `selectedItem`;
   * a single-selection list that receives several values warns in development.
   */
  selectedItems?: readonly string[];
  /** Default selected items for uncontrolled usage.
   * @default []
   */
  defaultSelectedItems?: readonly string[];
  /** Called with the next array of selected values when the selection changes (both modes). */
  onSelectionChange?: (selected: string[]) => void;
  /** Single mode: the controlled selected value (`null`: nothing selected). */
  selectedItem?: M extends 'single' ? string | null : never;
  /** Single mode: the initially selected value for uncontrolled usage. */
  defaultSelectedItem?: M extends 'single' ? string | null : never;
  /** Single mode: called with the newly selected value, or `null` when it was deselected. */
  onSelectedItemChange?: M extends 'single' ? (item: string | null) => void : never;
  /**
   * Ref to the root element: a `<ul>`, or a `<div role="grid">` for a selectable list whose items
   * have actions.
   */
  ref?: React.Ref<HTMLUListElement | HTMLDivElement>;
}

/** Properties for the ListItem component. */
export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  /**
   * Unique value identifying this item for selection tracking. An item without a value cannot be
   * selected (its `onClick` still runs). Items of a selectable list that share a value are
   * selected together (a development warning names the value).
   */
  value?: string;
  /**
   * Action element rendered at the end of the list item (e.g. a Delete button). Clicks and keys
   * that start inside it, or inside a popup it opens, never toggle the item's selection. An
   * action that renders nothing (`[]`, `null`, `false`, `''`, `<></>`) is no action. In a
   * selectable list, items with actions switch the list to grid semantics: the actions are reached
   * with the arrow keys, and their focusable elements (also ones added later) get
   * `tabindex="-1"`, except inside a nested composite widget such as a Toolbar, which keeps its own
   * Tab stop. When the first action appears or the last one disappears, the items remount (see
   * {@link List}).
   */
  action?: React.ReactNode;
  /** Ref to the item element: an `<li>`, or a `<div role="row">` in grid mode. */
  ref?: React.Ref<HTMLLIElement | HTMLDivElement>;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

/** `list`: plain list; `listbox`: selectable; `grid`: selectable with item actions. */
type ListMode = 'list' | 'listbox' | 'grid';

interface ListContextValue {
  mode: ListMode;
  selectedValues: ReadonlySet<string>;
  toggleItem: (value: string) => void;
  getTabIndex: (value: string) => 0 | -1;
  registry: ListRegistry;
}

const ListContext = React.createContext<ListContextValue | null>(null);
ListContext.displayName = 'ListContext';

let inertContext: ListContextValue | null = null;

function getInertContext(): ListContextValue {
  inertContext ??= {
    mode: 'list',
    selectedValues: new Set<string>(),
    toggleItem: () => {},
    getTabIndex: () => -1,
    registry: new ListRegistry(),
  };
  return inertContext;
}

function useListContext(componentName: string): ListContextValue {
  const context = React.useContext(ListContext);
  if (context) return context;
  reportMissingContext(componentName, 'a List');
  return getInertContext();
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EMPTY: readonly string[] = [];

/** Items that share a value are selected together and share their roving value. */
function warnDuplicateValue(value: string): void {
  warnOnce(
    `List:duplicate:${value}`,
    `List: several items share the value "${value}". Item values must be unique within a ` +
      'List; items with the same value are selected (and tab stops) together.',
  );
}

/**
 * Static look-ahead for the server and the first render: a direct `List.Item` (Fragments
 * flattened, also an item written in a Server Component) whose action renders content.
 */
function childrenHaveAction(children: React.ReactNode): boolean {
  return flattenChildren(children).some(
    ({ node }) =>
      isElementOfType<ListItemProps>(node, ListItem) && slotRendersContent(node.props.action),
  );
}

/** Elements whose events belong to themselves, not to the item that contains them. */
const INTERACTIVE_SELECTOR = [
  FOCUSABLE_SELECTOR,
  '[data-list-action]',
  'label',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(', ');

/**
 * Whether an item must leave `event` alone (no selection toggle): it started inside the action
 * container or a nested interactive element, or outside the item's DOM. React bubbles the events
 * of a popup portaled from an action (a Popover, Menu or Dialog) through the item's handlers
 * although their target lives elsewhere in the document; those never toggle the item (as in
 * Card).
 */
function isForeignEvent(event: React.SyntheticEvent<HTMLElement>): boolean {
  const item = event.currentTarget;
  const target = event.target as Partial<Node> | null;
  if (!target || typeof target.nodeType !== 'number' || !item.contains(target as Node)) {
    return true;
  }
  let node: Element | null =
    target.nodeType === Node.ELEMENT_NODE ? (target as Element) : (target.parentElement ?? null);
  for (; node && node !== item; node = node.parentElement) {
    if (node.matches(INTERACTIVE_SELECTOR)) return true;
  }
  return false;
}

const TEXT_ENTRY_ROLES: ReadonlySet<string> = new Set([
  'textbox',
  'searchbox',
  'combobox',
  'spinbutton',
  'slider',
]);

const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
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

/** Text-entry widgets keep the arrow keys (caret movement) and are entered with Enter/F2. */
function isTextEntry(el: Element): boolean {
  const role = el.getAttribute('role');
  if (role !== null && TEXT_ENTRY_ROLES.has(role)) return true;
  const tag = el.localName;
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  return el.matches('[contenteditable]:not([contenteditable="false"])');
}

function getFocusables(cell: HTMLElement): HTMLElement[] {
  return Array.from(cell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
    isFocusable(el),
  );
}

/*
 * The helpers below walk element children with `firstElementChild`/`nextElementSibling`, never
 * through a `children` collection: jsdom does not cache indexed `HTMLCollection` access, so
 * `Array.from(root.children)` or an indexed loop over a large list is O(n²) in consumers' test
 * suites (table-core#22).
 */

/** Position of an item element among its list's items (the root's element children). */
function getItemIndex(item: HTMLElement): number {
  if (!item.parentElement) return -1;
  let index = 0;
  for (let el = item.previousElementSibling; el; el = el.previousElementSibling) index++;
  return index;
}

/**
 * Where focus goes after the items remounted: the item with the same explicit value, else the item
 * now at the same position (the next one when the focused item itself was removed), else the last.
 * An item that cannot take focus itself (a plain list item) passes it to its first focusable
 * descendant.
 */
function getFocusRestoreTarget(root: HTMLElement, loss: ListFocusLoss): HTMLElement | null {
  let byValue: Element | null = null;
  let atIndex: Element | null = null;
  let last: Element | null = null;
  let index = 0;
  for (let el = root.firstElementChild; el; el = el.nextElementSibling, index++) {
    if (loss.value !== undefined && el.getAttribute('data-roving-value') === loss.value) {
      byValue = el;
      break;
    }
    if (index === loss.index) atIndex = el;
    last = el;
  }
  const item = (byValue ?? atIndex ?? (loss.index >= 0 ? last : null)) as HTMLElement | null;
  if (!item) return null;
  return item.hasAttribute('tabindex') ? item : (getFocusables(item)[0] ?? null);
}

/** The action cell of an item element (its direct `[data-list-action]` child), read at event time. */
function getActionCell(item: HTMLElement): HTMLElement | null {
  for (let child = item.firstElementChild; child; child = child.nextElementSibling) {
    if (child.hasAttribute('data-list-action')) return child as HTMLElement;
  }
  return null;
}

/**
 * The arrow-key stops inside an action cell, in DOM order. A text-entry widget is represented by
 * the cell itself (the cell takes focus; Enter/F2 enter the widget, Escape returns to the cell).
 */
function getActionStops(cell: HTMLElement): HTMLElement[] {
  const stops: HTMLElement[] = [];
  for (const el of getFocusables(cell)) {
    const stop = isTextEntry(el) ? cell : el;
    if (!stops.includes(stop)) stops.push(stop);
  }
  return stops;
}

/* ------------------------------------------------------------------ */
/*  List                                                               */
/* ------------------------------------------------------------------ */

// The List root, documented on the exported `List` const.
const ListRoot = <M extends ListSelectionMode = 'single'>(props: ListProps<M>): React.ReactNode => {
  const {
    selectable = false,
    selectionMode,
    selectedItems,
    defaultSelectedItems,
    onSelectionChange,
    selectedItem,
    defaultSelectedItem,
    onSelectedItemChange,
    className,
    children,
    ref,
    onKeyDown,
    onKeyDownCapture,
    onFocus,
    ...rest
  } = props as ListProps;

  if (selectionMode === 'multi') {
    warnDeprecated('List', 'selectionMode="multi"', 'selectionMode="multiple"');
  }
  const multiple = selectionMode === 'multiple' || selectionMode === 'multi';

  const controlledSelection = React.useMemo<readonly string[] | undefined>(() => {
    if (!multiple && selectedItem !== undefined) {
      return selectedItem === null ? EMPTY : [selectedItem];
    }
    return selectedItems;
  }, [multiple, selectedItem, selectedItems]);
  const defaultSelection = React.useMemo<readonly string[]>(() => {
    if (!multiple && defaultSelectedItem !== undefined && defaultSelectedItem !== null) {
      return [defaultSelectedItem];
    }
    return defaultSelectedItems ?? EMPTY;
  }, [multiple, defaultSelectedItem, defaultSelectedItems]);

  const [selected, setSelected] = useControllable<readonly string[]>(
    controlledSelection,
    defaultSelection,
    (next) => {
      // The callbacks receive their own mutable copy (the props accept readonly arrays).
      const selection = [...next];
      onSelectionChange?.(selection);
      if (!multiple) onSelectedItemChange?.(selection[0] ?? null);
    },
  );

  const [registry] = React.useState(() => new ListRegistry());
  React.useLayoutEffect(() => {
    registry.setActive(selectable);
  }, [registry, selectable]);
  const registered = React.useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getServerSnapshot,
  );

  // Effective selection: selected ∩ registered item values, derived during render (table-core#22).
  const effective = React.useMemo(
    () => (registered ? selected.filter((value) => registered.valueSet.has(value)) : selected),
    [registered, selected],
  );
  const selectedValues = React.useMemo<ReadonlySet<string>>(() => new Set(effective), [effective]);

  const hasActions =
    selectable && (registered ? registered.hasActions : childrenHaveAction(children));
  const mode: ListMode = !selectable ? 'list' : hasActions ? 'grid' : 'listbox';

  // The first selected item in DOM order (the registry keeps its values in DOM order).
  const tabStopValue = registered
    ? (registered.values.find((value) => selectedValues.has(value)) ?? null)
    : (effective[0] ?? null);

  const { containerProps, getTabIndex } = useRovingTabIndex({
    activeValue: tabStopValue,
    orientation: 'vertical',
    typeahead: (registered?.count ?? 0) > 7,
    tabStop: 'active',
    // The items are the root's children. A composite in an item action (a Toolbar, a radio group)
    // is part of its row, not an item: arrows and typeahead never move into it.
    itemSelector: ':scope > [data-roving-value]',
  });
  const {
    ref: rovingRef,
    onKeyDown: rovingKeyDown,
    onKeyDownCapture: rovingKeyDownCapture,
    onFocus: rovingFocus,
  } = containerProps;
  const rootElementRef = React.useRef<HTMLUListElement | HTMLDivElement | null>(null);
  const rootRef = useMergedRefs<HTMLUListElement | HTMLDivElement>(
    ref,
    selectable ? rovingRef : null,
    rootElementRef,
  );

  // Switching between list and grid semantics changes the root and item elements (`ul`/`li` ↔
  // `div`), so React remounts the items and the focused one is removed. Items record, while they
  // are still in the document, that they held focus (see ListItem); after the new items mounted,
  // focus moves to the same item (C-DISABLED: focus is never dropped to <body>).
  React.useLayoutEffect(() => {
    const loss = registry.takeFocusLoss();
    const root = rootElementRef.current;
    if (!loss || !root) return;
    const doc = root.ownerDocument;
    const active = doc.activeElement;
    // Focus placed elsewhere in this commit (an autoFocus, a restore-focus hook) wins.
    if (active && active !== doc.body && active.isConnected) return;
    getFocusRestoreTarget(root, loss)?.focus();
  }, [mode, registry]);

  // After every commit (the items' layout effects ran first): keep the registered values in DOM
  // order, so `tabStopValue` is the first selected item in the DOM even after items were inserted
  // between others or reordered by key (table-core#22). O(n); re-renders only when the order changed.
  React.useLayoutEffect(() => {
    registry.syncOrder(rootElementRef.current);
  });

  const toggleItem = React.useCallback(
    (value: string) => {
      setSelected((previous) => {
        // From the effective selection, so values of removed items are never reported again.
        const current = registry.prune(previous);
        const isSelected = current.includes(value);
        if (multiple) {
          return isSelected ? current.filter((item) => item !== value) : [...current, value];
        }
        return isSelected ? [] : [value];
      });
    },
    [multiple, registry, setSelected],
  );

  // Registered values of a selectable list that more than one item holds (development warning).
  const duplicates = registered?.duplicates ?? EMPTY;
  React.useEffect(() => {
    for (const value of duplicates) warnDuplicateValue(value);
  }, [duplicates]);

  const selectedCount = effective.length;
  React.useEffect(() => {
    if (selectable && !multiple && selectedCount > 1) {
      warnOnce(
        'List:single-several-selected',
        `List: a single-selection list (selectionMode "single") received ${selectedCount} selected items. Pass one value with \`selectedItem\`, or use selectionMode="multiple".`,
      );
    }
  }, [selectable, multiple, selectedCount]);

  const contextValue = React.useMemo<ListContextValue>(
    () => ({ mode, selectedValues, toggleItem, getTabIndex, registry }),
    [mode, selectedValues, toggleItem, getTabIndex, registry],
  );

  const Root = (mode === 'grid' ? 'div' : 'ul') as React.ElementType;
  const role = mode === 'grid' ? 'grid' : mode === 'listbox' ? 'listbox' : 'list';

  return (
    <ListContext.Provider value={contextValue}>
      <Root
        role={role}
        aria-multiselectable={selectable && multiple ? true : undefined}
        className={cn('m-0 list-none p-0', className)}
        {...rest}
        ref={rootRef}
        data-roving-container={selectable ? '' : undefined}
        onKeyDown={selectable ? composeEventHandlers(onKeyDown, rovingKeyDown) : onKeyDown}
        onKeyDownCapture={
          selectable
            ? composeEventHandlers(onKeyDownCapture, rovingKeyDownCapture)
            : onKeyDownCapture
        }
        onFocus={
          selectable
            ? composeEventHandlers(onFocus, rovingFocus, { checkDefaultPrevented: false })
            : onFocus
        }
      >
        {children}
      </Root>
    </ListContext.Provider>
  );
};
ListRoot.displayName = 'List';

/* ------------------------------------------------------------------ */
/*  ListItem                                                           */
/* ------------------------------------------------------------------ */

/**
 * An item of a {@link List} (also available as `List.Item`). Renders an `<li>` (`listitem`, or
 * `option` in a selectable list), or a `<div role="row">` in a selectable list with actions. In a
 * selectable list, Enter and Space toggle the selection without calling `onClick`, which receives
 * pointer clicks.
 *
 * Exported under the flat name `ListItem` so React Server Components can import it; `List.Item`
 * (dotted access) needs a client module.
 */
export const ListItem = ({
  value,
  action,
  className,
  children,
  onClick,
  onKeyDown,
  ref,
  ...rest
}: ListItemProps) => {
  const { mode, selectedValues, toggleItem, getTabIndex, registry } = useListContext('ListItem');
  const autoValue = useId('list-item');
  const selectableValue = value ? value : undefined;
  const rovingValue = selectableValue ?? autoValue;
  // An action that renders nothing (`[]`, `null`, booleans, `''`) is no action.
  const hasAction = slotRendersContent(action);
  const [token] = React.useState(() => ({}));
  const itemRef = React.useRef<HTMLLIElement | HTMLDivElement | null>(null);
  const itemRefs = useMergedRefs<HTMLLIElement | HTMLDivElement>(ref, itemRef);

  // The record is updated in place when the value or the action changes and removed only on
  // unmount, so the item keeps its place in the registry (table-core#22).
  React.useLayoutEffect(() => {
    registry.set(token, { value: selectableValue, hasAction, element: itemRef });
  }, [registry, token, selectableValue, hasAction]);
  React.useLayoutEffect(() => () => registry.delete(token), [registry, token]);

  // Focus inside the action when it disappears: if that switches the list from grid to listbox, the
  // List moves focus to this item in the next commit (see ListActionCell and ListRoot).
  const recordActionFocusLoss = useEventCallback((cell: HTMLElement) => {
    const item = cell.parentElement;
    registry.recordFocusLoss({ value: selectableValue, index: item ? getItemIndex(item) : -1 });
  });

  // Unmount: a layout-effect cleanup runs while the element is still in the document, so it can
  // tell whether it held focus. The List moves focus to the same item when its items remount
  // (list ↔ grid semantics); see ListRoot.
  React.useLayoutEffect(() => {
    const node = itemRef.current;
    return () => {
      if (!node) return;
      const active = node.ownerDocument.activeElement;
      if (active && node.contains(active)) {
        registry.recordFocusLoss({ value: selectableValue, index: getItemIndex(node) });
      }
    };
  }, [registry, selectableValue]);

  const isSelected = selectableValue !== undefined && selectedValues.has(selectableValue);
  const selectable = mode !== 'list';

  const activate = () => {
    if (selectableValue !== undefined) toggleItem(selectableValue);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (isForeignEvent(event)) return;
    activate();
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (isForeignEvent(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const rowElement = event.currentTarget;
    const target = event.target as HTMLElement;
    const cell = getActionCell(rowElement);

    if (!cell || !cell.contains(target)) {
      if (target !== rowElement) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
        return;
      }
      const intent = getArrowIntent(event.key, {
        orientation: 'horizontal',
        dir: getDirection(rowElement),
      });
      const first = intent === 'next' && cell ? getActionStops(cell)[0] : undefined;
      if (first) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    // Inside the action cell.
    if (target !== cell && isTextEntry(target)) {
      // The widget keeps its keys (caret movement, typing); Escape returns to the cell.
      if (event.key === 'Escape') {
        event.preventDefault();
        cell.focus();
      }
      return;
    }
    if (target === cell && (event.key === 'Enter' || event.key === 'F2')) {
      const entry = getFocusables(cell).find((el) => isTextEntry(el));
      if (entry) {
        event.preventDefault();
        entry.focus();
      }
      return;
    }
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(rowElement),
    });
    if (!intent) return;
    event.preventDefault();
    const stops = getActionStops(cell);
    const index = stops.indexOf(target);
    if (intent === 'next') {
      stops[index + 1]?.focus();
    } else if (index > 0) {
      stops[index - 1].focus();
    } else {
      rowElement.focus();
    }
  };

  const Element = (mode === 'grid' ? 'div' : 'li') as React.ElementType;
  const ContentCell = (mode === 'grid' ? 'div' : 'span') as React.ElementType;
  const role = mode === 'grid' ? 'row' : mode === 'listbox' ? 'option' : 'listitem';

  const interactiveProps: Record<string, unknown> = selectable
    ? {
        'aria-selected': isSelected,
        tabIndex: getTabIndex(rovingValue),
        'data-roving-value': rovingValue,
        'data-selected': isSelected ? '' : undefined,
        onClick: composeEventHandlers(onClick, handleClick),
        onKeyDown: composeEventHandlers(
          onKeyDown,
          mode === 'grid' ? handleRowKeyDown : handleOptionKeyDown,
        ),
      }
    : { onClick, onKeyDown };

  return (
    <Element
      role={role}
      className={cn(
        'flex items-center border-b border-border px-4 py-2 text-body-1',
        selectable && ['relative cursor-pointer', focusRingInset],
        selectable &&
          (isSelected
            ? [
                'bg-subtle-selected before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-primary',
                forcedColors.selectedContainer,
              ]
            : 'hover:bg-subtle-hover'),
        className,
      )}
      {...rest}
      ref={itemRefs}
      {...interactiveProps}
    >
      <ContentCell role={mode === 'grid' ? 'gridcell' : undefined} className="min-w-0 flex-1">
        {children}
      </ContentCell>
      {hasAction && (
        <ListActionCell grid={mode === 'grid'} onRemovedWithFocus={recordActionFocusLoss}>
          {/* A generator was read once by the check above: render its items. */}
          {materialiseSlotContent(action)}
        </ListActionCell>
      )}
    </Element>
  );
};
ListItem.displayName = 'ListItem';

/**
 * Nested composite widgets (a Toolbar, a RadioGroup, …) manage their own tab indexes, so the action
 * cell never writes `tabindex` on or inside one (the same rule as the DataGrid's cell widgets).
 */
const COMPOSITE_SELECTOR = [
  '[data-roving-container]',
  ...[
    'toolbar',
    'radiogroup',
    'listbox',
    'grid',
    'treegrid',
    'tablist',
    'menu',
    'menubar',
    'tree',
  ].map((role) => `[role="${role}"]`),
].join(', ');

/** Attributes that can put an element of an action cell (back) into the Tab order. */
const STAMP_OBSERVED_ATTRIBUTES = ['tabindex', 'href', 'contenteditable', 'controls'];

/**
 * Grid mode: takes the focusable elements of an action cell out of the Tab order (the row is the
 * only Tab stop; the actions are reached with the arrow keys) and keeps them out while the cell is
 * mounted. Returns the cleanup that disconnects the observer and restores the original values.
 *
 * It runs once per cell, not on every render of every item (an inline `action` has a new identity
 * on every parent render): a `MutationObserver` re-stamps when elements are added to the cell or an
 * element's `tabindex` is changed by someone else, including by an action component's own state.
 * Every candidate of `FOCUSABLE_SELECTOR` is stamped, disabled or hidden ones too, so an element
 * that is enabled or shown later is already out of the Tab order and no computed style is read.
 * Removed elements are dropped from the record on each pass. Nested composites are skipped (see
 * `COMPOSITE_SELECTOR`), and an element whose replaced `tabindex` something else re-applies (a
 * script that manages it) is left alone from then on, so the two never overwrite each other in an
 * endless loop of observer callbacks.
 */
function stampActionCell(cell: HTMLElement): () => void {
  /** Stamped elements with the `tabindex` they had before (`null`: none). */
  const stamped = new Map<HTMLElement, string | null>();
  /** Elements whose `tabindex` something else keeps re-applying: they are left to it. */
  const yielded = new WeakSet<HTMLElement>();
  const stamp = () => {
    for (const el of stamped.keys()) {
      if (!cell.contains(el)) stamped.delete(el);
    }
    for (const el of cell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
      const tabIndex = el.getAttribute('tabindex');
      if (tabIndex === '-1' || yielded.has(el)) continue;
      const composite = el.closest(COMPOSITE_SELECTOR);
      if (composite && cell.contains(composite)) continue;
      stamped.set(el, tabIndex);
      el.setAttribute('tabindex', '-1');
    }
  };
  stamp();
  if (typeof MutationObserver === 'undefined') return () => {};

  const observer = new MutationObserver((records) => {
    // The records of this cell's own writes are taken below, so these values were set by someone
    // else: a changed prop (the new value to restore), or a script that manages the element's
    // tabindex and re-applied the value this cell replaced. Yielding to the latter keeps the two
    // from overwriting each other forever.
    const changed = new Set<HTMLElement>();
    for (const record of records) {
      const target = record.target as HTMLElement;
      if (record.attributeName === 'tabindex' && stamped.has(target)) changed.add(target);
    }
    for (const el of changed) {
      const value = el.getAttribute('tabindex');
      if (value !== '-1' && value === stamped.get(el)) {
        stamped.delete(el);
        yielded.add(el);
      } else {
        stamped.set(el, value);
      }
    }
    stamp();
    observer.takeRecords();
  });
  observer.observe(cell, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: STAMP_OBSERVED_ATTRIBUTES,
  });
  return () => {
    observer.disconnect();
    for (const [el, original] of stamped) {
      if (original === null) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', original);
    }
    stamped.clear();
  };
}

interface ListActionCellProps {
  /** Grid mode: a focusable `gridcell` div whose widgets leave the Tab order; otherwise a `span`. */
  grid: boolean;
  /** Called when the cell is removed while focus is inside it (the cell is still in the document). */
  onRemovedWithFocus: (cell: HTMLElement) => void;
  children: React.ReactNode;
}

/**
 * The action cell of a {@link ListItem} (internal). React runs the layout-effect cleanups of a
 * removed subtree before it removes the subtree's DOM, but a component's own cleanups only after
 * its removed children are gone. So this cleanup, unlike one in ListItem, still sees focus inside
 * the cell when the action disappears (data-display#2).
 *
 * `grid` never changes for a mounted cell: switching between list and grid semantics changes the
 * List's root element, which remounts the items and their cells.
 */
function ListActionCell({ grid, onRemovedWithFocus, children }: ListActionCellProps) {
  const cellRef = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    const cell = cellRef.current;
    return () => {
      if (!cell) return;
      const active = cell.ownerDocument.activeElement;
      if (active && cell.contains(active)) onRemovedWithFocus(cell);
    };
  }, [onRemovedWithFocus, grid]);

  React.useLayoutEffect(() => {
    const cell = cellRef.current;
    return grid && cell ? stampActionCell(cell) : undefined;
  }, [grid]);

  const Cell = (grid ? 'div' : 'span') as React.ElementType;
  return (
    <Cell
      ref={cellRef}
      role={grid ? 'gridcell' : undefined}
      tabIndex={grid ? -1 : undefined}
      data-list-action=""
      className={cn('ms-2 shrink-0', grid && focusRingInset)}
    >
      {children}
    </Cell>
  );
}
ListActionCell.displayName = 'ListActionCell';

/**
 * A vertical list of items, optionally selectable.
 *
 * - **Plain** (`selectable` false): `role="list"` with `listitem`s; item actions stay in the
 *   normal Tab order.
 * - **Selectable** (APG Listbox): `role="listbox"` with `option`s and one Tab stop (the first
 *   selected option, else the first option). ArrowUp/Down move focus (wrapping), Home/End jump to
 *   the ends, typeahead is on for more than 7 items, Enter/Space and clicks toggle selection (a
 *   Space typed within 500 ms of a typeahead character continues the search instead).
 * - **Selectable with item actions** (APG Grid): `role="grid"` with `row`s (carrying
 *   `aria-selected`) and `gridcell`s for the content and the action. One Tab stop; Up/Down move
 *   between rows, Right/Left (mirrored in RTL) move into and out of the actions. A cell that holds
 *   a text-entry widget takes focus itself: Enter/F2 enter the widget, Escape returns to the cell.
 *   Clicks and keys that start inside an action, or inside a popup it opens (a Popover, a Menu),
 *   never toggle selection.
 * - **Switching semantics remounts the items.** Listbox/list and grid use different elements
 *   (`ul`/`li` and `div`), so when a selectable list gains its first item action, loses its last
 *   one, or `selectable` changes while items have actions, React remounts the items and their
 *   content: state inside them (an inline rename input's draft, an uncontrolled checkbox) is reset.
 *   Focus that is on an item or inside it when the list switches moves to the same item (by
 *   `value`, else by position; the next item when the focused one was removed), so the switch
 *   never drops it to `<body>`. This includes focus inside the last action when that action
 *   removes itself (an inline rename input that unmounts on Enter). An action that removes itself
 *   while focused without causing a switch drops focus, like any removed element. When the list
 *   may switch, keep such state in the parent (or keep an action on at least one item).
 * - Selection: `selectionMode` `'single'` (default) or `'multiple'`; controlled with
 *   `selectedItems` (or `selectedItem` in single mode) or uncontrolled with the `default*` props.
 *   Values of items that are no longer rendered are dropped from the reported selection.
 * - Sub-component: `List.Item` (also exported as `ListItem` for React Server Components).
 *
 * @example
 * <List selectable selectionMode="multiple" aria-label="Fruits" onSelectionChange={setFruits}>
 *   <List.Item value="apple">Apple</List.Item>
 *   <List.Item value="banana">Banana</List.Item>
 * </List>
 */
export const List = /* @__PURE__ */ Object.assign(ListRoot, {
  Item: ListItem,
});
