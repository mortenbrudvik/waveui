import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { SelectionMode } from '../../lib/types';
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

export interface TreeContextValue {
  expanded: ReadonlySet<string>;
  toggle: (value: string) => void;
  expand: (values: readonly string[]) => void;
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
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useTreeContext(component: string): TreeContextValue {
  const context = React.useContext(TreeContext);
  if (context) return context;
  reportMissingContext(component, '<Tree>');
  return INERT_CONTEXT;
}
