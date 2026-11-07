import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { CoreSize, MotionSlot, SelectionMode } from '../../lib/types';
import type { TreeNode } from './Tree.selection';

/** What a top-level item hands to the root for the tree order of a toggle. */
export interface TreeSelectionEntry {
  /** The item's value and the Tree.Item elements among its children, recursively. */
  node: TreeNode;
  /** The treeitem element, which orders the top-level items. */
  element: HTMLElement | null;
}

/**
 * `true` inside the child group of an item that the checked list checks (its own value or an
 * ancestor's is listed): every item there is checked.
 */
export const TreeCheckForcedContext = React.createContext(false);

/** Size of a Tree's rows: `small` rows are 24px high, `medium` (the default) 28px. */
export type TreeSize = Extract<CoreSize, 'small' | 'medium'>;

/**
 * The look of a Tree's rows: `subtle` fills a hovered or selected row with the subtle colors,
 * `subtle-alpha` with translucent ones (for a tree over an image or a tint), `transparent` draws
 * no fill (a selected row keeps its bold text and, in forced colors, its outline).
 */
export type TreeAppearance = 'subtle' | 'subtle-alpha' | 'transparent';

/** The second argument of an open-change callback: the item, its new state and the event. */
export interface TreeOpenChangeDetails {
  /**
   * The item that was expanded or collapsed. For the `*` key, which expands every collapsed
   * sibling of the focused item, the focused item.
   */
  value: string;
  /** Whether that item is open after the change (`true` for the `*` key). */
  open: boolean;
  /** The click or key press that asked for the change. */
  event: Event;
}

/**
 * What an item with an `open` or `onOpenChange` of its own tells the tree, so a key that expands
 * several items at once (`*`) reaches it too.
 */
export interface TreeItemOpenControl {
  /** The item's `open` is set: the tree's expanded list does not decide it. */
  owns: boolean;
  /** Asks the item to open (calls its `onOpenChange`). */
  open: (event: Event) => void;
}

export interface TreeContextValue {
  expanded: ReadonlySet<string>;
  /** Flips an item in the tree's expanded list; `event` becomes `details.event`. */
  toggle: (value: string, event: Event) => void;
  /** Expands items with one change; `origin` is the item of the key (`details.value`). */
  expand: (values: readonly string[], event: Event, origin: string) => void;
  /** Registers an item that has its own `open` or `onOpenChange`; returns the unregistration. */
  registerOpenControl: (value: string, control: TreeItemOpenControl) => () => void;
  activate: (value: string) => void;
  selected: string | null | undefined;
  current: string | null | undefined;
  getTabIndex: (value: string) => 0 | -1;
  focusValue: (value: string) => void;
  onItemFocus: (value: string) => void;
  /** The item that focus is on or inside (its actions); `null` while focus is outside the tree. */
  focusedItem: string | null;
  /** `'tree'` (Tab enters a row's actions) or `'treegrid'` (the arrow keys do). */
  navigationMode: 'tree' | 'treegrid';
  /**
   * Development only: counts a mounted item's value and warns once per value that several items
   * share. Returns the unregistration.
   */
  registerValue: (value: string) => () => void;
  /** The resolved selection mode. */
  selectionMode: 'none' | SelectionMode;
  /** The checked item values (`selectionMode="multiple"`); every item computes its state from them. */
  checked: ReadonlySet<string>;
  /** Toggles an item's check; `event` becomes `details.event` of `onCheckedItemsChange`. */
  toggleChecked: (value: string, event: Event) => void;
  /**
   * Registers a top-level item's selection entry, read when a check toggles to put the items in
   * tree order. Returns the unregistration.
   */
  registerTopLevel: (entry: React.RefObject<TreeSelectionEntry | null>) => () => void;
  /** The Tree's `motion`: the collapse of every child group (`undefined` the default). */
  motion: MotionSlot | null | undefined;
  /** Checks do not cascade (`independentChecks`). */
  independentChecks: boolean;
  /**
   * Checks the focused item and the visible items between it and the anchor (the item checked
   * last), as Shift+Space does; the anchor is the item itself without one.
   */
  checkRange: (value: string, event: Event) => void;
  /** Checks every item (Ctrl+A). */
  checkAll: (value: string, event: Event) => void;
  /** The treeitems that are visible now, in tree order. */
  getVisibleItems: () => HTMLElement[];
  /** The rows' size. */
  size: TreeSize;
  /** The rows' look. */
  appearance: TreeAppearance;
}

export const TreeContext = React.createContext<TreeContextValue | null>(null);

/** Value of the enclosing Tree.Item (`null` at the top level), for ArrowLeft → parent. */
export const TreeParentContext = React.createContext<string | null>(null);

/**
 * `true` inside the label of a Tree.Item, where a nested Tree.Item ends up when a component
 * renders it (the parent cannot see it among its children); its child group and every Tree root
 * reset it.
 */
export const TreeLabelContext = React.createContext(false);

/** The ids a Tree.ItemPersonaLayout registers with its item. */
export interface PersonaLayoutIds {
  /** The name element: the item's name. */
  nameId: string;
  /** The description element, while it renders: it joins the item's description. */
  descriptionId: string | undefined;
}

/** What a Tree.Item gives the content of its label. */
export interface TreeItemContextValue {
  /** Registers a persona layout's ids with the item; returns the unregistration. */
  registerLayout: (ids: PersonaLayoutIds) => () => void;
}

export const TreeItemContext = React.createContext<TreeItemContextValue | null>(null);

/**
 * What every `slotProps` part of a Tree.Item and a Tree.ItemPersonaLayout locks unset
 * (module-only): a role, since the tree finds its items by role (a part with an item's role would
 * become an item of its own); a tab index, since a tree has one tab stop, its roving item; the
 * marker of a roving container, which would take the items inside a part out of the tree's arrow
 * order; and the markers by which the tree reads an item (its row, label, checkbox, aside and
 * actions, and a persona layout's name), which decide the clicks and keys an item takes, the text
 * typeahead matches and what shows while it has focus. Spread it first in a part's `locked`
 * object; a part that carries one of them sets it after the spread.
 */
export const TREE_PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'data-roving-container': undefined,
  'data-tree-row': undefined,
  'data-tree-label': undefined,
  'data-tree-checkbox': undefined,
  'data-tree-aside': undefined,
  'data-tree-actions': undefined,
  'data-tree-persona-name': undefined,
} as const;

const INERT_ITEM_CONTEXT: TreeItemContextValue = { registerLayout: () => () => {} };

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useTreeItemContext(component: string): TreeItemContextValue {
  const context = React.useContext(TreeItemContext);
  if (context) return context;
  reportMissingContext(component, '<Tree.Item>');
  return INERT_ITEM_CONTEXT;
}

const INERT_CONTEXT: TreeContextValue = {
  expanded: new Set(),
  toggle: () => {},
  expand: () => {},
  registerOpenControl: () => () => {},
  activate: () => {},
  selected: undefined,
  current: undefined,
  getTabIndex: () => -1,
  focusValue: () => {},
  onItemFocus: () => {},
  focusedItem: null,
  navigationMode: 'tree',
  registerValue: () => () => {},
  selectionMode: 'none',
  checked: new Set(),
  toggleChecked: () => {},
  registerTopLevel: () => () => {},
  motion: undefined,
  independentChecks: false,
  checkRange: () => {},
  checkAll: () => {},
  getVisibleItems: () => [],
  size: 'medium',
  appearance: 'subtle',
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useTreeContext(component: string): TreeContextValue {
  const context = React.useContext(TreeContext);
  if (context) return context;
  reportMissingContext(component, '<Tree>');
  return INERT_CONTEXT;
}
