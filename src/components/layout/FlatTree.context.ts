import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { VisibleFlatItem } from '../../lib/flatTree';
import type { CheckState } from '../../lib/treeCascade';
import type { SelectionMode } from '../../lib/types';

/** One row of a FlatTree: a visible item of its model, with its check state in multiple mode. */
export type FlatTreeRow = VisibleFlatItem & { checked?: CheckState };

/** What a FlatTree gives each of its items. */
export interface FlatTreeContextValue {
  /** The resolved selection mode. */
  selectionMode: 'none' | SelectionMode;
  /** The selected value; `undefined` while no item carries `aria-selected` (multiple mode). */
  selected: string | null | undefined;
  /** The value of the current item, which gets `aria-current`. */
  current: string | null | undefined;
  /** The value of the item that holds the tab stop; `null` while no item can take it. */
  tabStop: string | null;
  /** The height of every item of a windowed tree, in pixels; `undefined` without a window. */
  itemSize: number | undefined;
  /** Activates a row (a click, Enter): a branch expands or collapses, and `onItemSelect` runs. */
  activate: (row: FlatTreeRow) => void;
  /** Toggles a row's check (multiple mode); `event` becomes `details.event`. */
  toggleChecked: (row: FlatTreeRow, event: Event) => void;
}

export const FlatTreeContext = React.createContext<FlatTreeContextValue | null>(null);

const INERT_CONTEXT: FlatTreeContextValue = {
  selectionMode: 'none',
  selected: undefined,
  current: undefined,
  tabStop: null,
  itemSize: undefined,
  activate: () => {},
  toggleChecked: () => {},
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useFlatTreeContext(component: string): FlatTreeContextValue {
  const context = React.useContext(FlatTreeContext);
  if (context) return context;
  reportMissingContext(component, '<FlatTree>');
  return INERT_CONTEXT;
}
