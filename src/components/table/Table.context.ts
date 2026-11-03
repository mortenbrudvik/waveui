import * as React from 'react';

/** The density of a Table or DataGrid: how much room its rows and cells take. */
export type TableSize = 'medium' | 'small' | 'extra-small';

/**
 * The density a Table or DataGrid gives its parts (module-only; `medium` outside a table).
 * Optional by design: a cell rendered on its own draws as `medium`, so no hook reports a missing
 * provider.
 */
export const TableSizeContext = React.createContext<TableSize>('medium');

/** The density of the table around the caller. */
export function useTableSize(): TableSize {
  return React.useContext(TableSizeContext);
}

/**
 * What a size changes in a table's classes, merged after the medium classes of each part (so
 * `medium` adds nothing and the markup of a default table is unchanged): the padding of a data
 * cell, a header cell, the sort button inside a header and a selection cell; the `extra-small` data
 * cell also takes the caption type size. A word that conflicts with a medium word replaces it.
 */
export const TABLE_SIZE_CLASSES = {
  cell: {
    medium: undefined,
    small: 'wave:px-3 wave:py-1.75',
    'extra-small': 'wave:px-2 wave:py-1 wave:text-caption-1',
  },
  header: {
    medium: undefined,
    small: 'wave:px-3 wave:py-2',
    'extra-small': 'wave:px-2 wave:py-1',
  },
  sortButton: {
    medium: undefined,
    small: 'wave:px-3 wave:py-2',
    'extra-small': 'wave:px-2 wave:py-1',
  },
  selectionCell: {
    medium: undefined,
    small: 'wave:py-2',
    'extra-small': 'wave:px-2 wave:py-1',
  },
} as const satisfies Record<string, Record<TableSize, string | undefined>>;
