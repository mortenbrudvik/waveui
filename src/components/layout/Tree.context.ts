import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';

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
  /**
   * Development only: counts a mounted item's value and warns once per value that several items
   * share. Returns the unregistration.
   */
  registerValue: (value: string) => () => void;
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
  registerValue: () => () => {},
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useTreeContext(component: string): TreeContextValue {
  const context = React.useContext(TreeContext);
  if (context) return context;
  reportMissingContext(component, '<Tree>');
  return INERT_CONTEXT;
}
