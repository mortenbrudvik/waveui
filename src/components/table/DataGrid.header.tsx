import * as React from 'react';
import { cn } from '../../lib/cn';
import { dataGridHeaderCellClassNames, dataGridHeaderClassNames } from '../../lib/classNames';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnOnce } from '../../lib/dev';
import { getColumnEntry } from '../../lib/columnSizing';
import { focusRingInset } from '../../lib/styles';
import type { SelectionMode } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import {
  DataGridHeaderRowHintContext,
  DataGridHeaderSlotsContext,
  DataGridSectionContext,
  createHeaderSlotRegistry,
  useDataGridContext,
  useDataGridSortContext,
  type HeaderSlotRegistry,
} from './DataGrid.context';
import {
  DataGridColumnResizeHandle,
  DataGridFixedLayoutContext,
  DataGridResizeContext,
} from './DataGrid.sizing';
import {
  DataGridWindowContext,
  DataGridWindowRowContext,
  type DataGridWindowRow,
} from './DataGrid.window';
import {
  SELECTION_CELL_CLASSES,
  TableSelectionControl,
  TableSortButton,
  getTablePartKind,
} from './Table.shared';
import type {
  DataGridHeaderCellProps,
  DataGridHeaderProps,
  DataGridSelectionCellProps,
} from './DataGrid';

export const cellBase = 'px-4 py-3 border-b border-border';

/** Whether `node` is an element of `DataGrid.SelectionCell` (lazy client references too). */
export function isSelectionCellElement(
  node: React.ReactNode,
): node is React.ReactElement<DataGridSelectionCellProps> {
  return getTablePartKind(node) === 'dataGridSelectionCell';
}

// ---------------------------------------------------------------------------
// Selection header cell (internal)
// ---------------------------------------------------------------------------

/**
 * The props of a header row's selection cell: the row's `selectionCellProps`, merged with a
 * `DataGrid.SelectionCell`'s own (whose `ref` is passed as `cellRef`).
 */
type HeaderSelectionCellProps = Omit<DataGridSelectionCellProps, 'ref'>;

interface DataGridSelectionHeaderCellProps {
  selectionMode: SelectionMode;
  /** The root class of `DataGrid.SelectionCell`, when the cell is one. */
  stableClassName?: string;
  cellProps?: HeaderSelectionCellProps;
  ref?: React.Ref<HTMLTableCellElement>;
}

function DataGridSelectionHeaderCell({
  selectionMode,
  stableClassName,
  cellProps,
  ref,
}: DataGridSelectionHeaderCellProps) {
  const { store, toggleAll, selectAllLabel, selectionHeaderLabel, subtleSelection } =
    useDataGridContext('DataGrid.Header');
  const state = React.useSyncExternalStore(
    store.subscribeSelectAll,
    store.getSelectAllState,
    store.getSelectAllState,
  );
  const {
    className,
    disabled,
    invisible,
    controlRef,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = cellProps ?? {};

  let checked: boolean | 'mixed' = false;
  if (state === 'all') checked = true;
  else if (state === 'some') checked = 'mixed';

  return (
    <th
      scope="col"
      {...rest}
      ref={ref}
      data-selection-cell=""
      className={cn(
        stableClassName,
        dataGridHeaderClassNames.selectionCell,
        SELECTION_CELL_CLASSES,
        'text-start',
        focusRingInset,
        className,
      )}
    >
      {selectionMode === 'multiple' ? (
        <TableSelectionControl
          ref={controlRef}
          type="checkbox"
          aria-label={ariaLabel ?? (ariaLabelledBy === undefined ? selectAllLabel : undefined)}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          checked={checked}
          disabled={disabled}
          invisible={invisible}
          subtle={subtleSelection}
          reveal="grid"
          onChange={(event) => toggleAll(event.nativeEvent)}
          className={dataGridHeaderClassNames.selectAllCheckbox}
        />
      ) : (
        <span className="sr-only">{selectionHeaderLabel}</span>
      )}
    </th>
  );
}

const INERT_HEADER_SLOTS: HeaderSlotRegistry = {
  subscribe: () => () => {},
  register: () => () => {},
  getFirst: () => null,
  refresh: () => {},
};

/**
 * The selection column's cell of one header row: the select-all header cell in the header's first
 * row (document order), an empty cell in every later row. `initialFirst` is the header's guess from
 * its children, used until the slots are registered (the initial and the server render).
 */
export function DataGridSelectionHeaderSlot({
  selectionMode,
  initialFirst,
  stableClassName,
  cellProps,
  ref,
}: DataGridSelectionHeaderCellProps & { initialFirst: boolean }) {
  const slots = React.useContext(DataGridHeaderSlotsContext) ?? INERT_HEADER_SLOTS;
  const [slot] = React.useState(() => ({}));
  const cellRef = React.useRef<HTMLTableCellElement | null>(null);
  const mergedRef = useMergedRefs<HTMLTableCellElement>(cellRef, ref);

  const getIsFirst = React.useCallback(() => {
    const first = slots.getFirst();
    return first === null ? initialFirst : first === slot;
  }, [slots, slot, initialFirst]);
  const getServerIsFirst = React.useCallback(() => initialFirst, [initialFirst]);
  const isFirst = React.useSyncExternalStore(slots.subscribe, getIsFirst, getServerIsFirst);

  React.useLayoutEffect(() => slots.register(slot, () => cellRef.current), [slots, slot]);

  if (isFirst) {
    return (
      <DataGridSelectionHeaderCell
        ref={mergedRef}
        selectionMode={selectionMode}
        stableClassName={stableClassName}
        cellProps={cellProps}
      />
    );
  }
  // A later header row's cell: none of the control's props apply.
  const {
    className,
    disabled: _disabled,
    invisible: _invisible,
    controlRef: _controlRef,
    'aria-label': _ariaLabel,
    'aria-labelledby': _ariaLabelledBy,
    'aria-describedby': _ariaDescribedBy,
    ...rest
  } = cellProps ?? {};
  return (
    <td
      {...rest}
      ref={mergedRef}
      data-selection-cell=""
      className={cn(
        stableClassName,
        dataGridHeaderClassNames.selectionCell,
        SELECTION_CELL_CLASSES,
        focusRingInset,
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Prepends the selection column's header slot (or `null`) to every `<tr>` in `children`, looking
 * inside Fragments, unless the row holds a `DataGrid.SelectionCell` (that cell is the slot), and
 * tells every row whether it is the header's first row: the cells of a `<tr>` and every other
 * element child (a `DataGrid.Row`, or a component that renders one). Every row gets the same child
 * shape in every selection mode, so switching `selectionMode` does not remount the header cells.
 * In a windowed grid each row also gets its `aria-rowindex` (1-based, in order).
 */
function withSelectionHeaderSlots(
  children: React.ReactNode,
  selectionMode: 'none' | SelectionMode,
  windowed: boolean,
): React.ReactNode {
  let position = 0;
  const visit = (nodes: React.ReactNode): React.ReactNode =>
    React.Children.map(nodes, (child) => {
      if (isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment)) {
        return React.cloneElement(child, undefined, visit(child.props.children));
      }
      if (!React.isValidElement(child)) return child;
      const isFirst = position === 0;
      position += 1;
      if (isElementOfType<React.HTMLAttributes<HTMLTableRowElement>>(child, 'tr')) {
        const cells = child.props.children;
        const slot =
          selectionMode === 'none' ||
          flattenChildren(cells).some(({ node }) => isSelectionCellElement(node)) ? null : (
            <DataGridSelectionHeaderSlot selectionMode={selectionMode} initialFirst={isFirst} />
          );
        return React.cloneElement(
          child,
          windowed ? { 'aria-rowindex': position } : undefined,
          slot,
          <DataGridHeaderRowHintContext.Provider value={isFirst}>
            {cells}
          </DataGridHeaderRowHintContext.Provider>,
        );
      }
      // A `DataGrid.Row` takes its `aria-rowindex` from the row context.
      const windowRow: DataGridWindowRow | null = windowed
        ? { index: undefined, ariaRowIndex: position, height: undefined }
        : null;
      return (
        <DataGridHeaderRowHintContext.Provider value={isFirst}>
          <DataGridWindowRowContext.Provider value={windowRow}>
            {child}
          </DataGridWindowRowContext.Provider>
        </DataGridHeaderRowHintContext.Provider>
      );
    });
  return visit(children);
}

/**
 * The grid's `<thead>`. When the grid is selectable, it prepends the selection column's header
 * cell to each `<tr>` child, also inside a Fragment, unless the row holds a
 * `DataGrid.SelectionCell`: the first header row gets the "Select all rows" checkbox (multiple
 * mode) or the "Selection" header (single mode; DataGrid's `labels` localizes both), later rows of
 * a grouped header an empty cell. A header row rendered by another component cannot get it (a
 * development warning says so): use `DataGrid.Row` for such a row, which adds the cell itself.
 * In a grid with a `virtualWindow` the header stays at the top of the grid's scroll wrapper while
 * the rows scroll under it, and each header row carries its `aria-rowindex`.
 */
export const DataGridHeader = ({ children, className, ref, ...rest }: DataGridHeaderProps) => {
  const { selectionMode } = useDataGridContext('DataGrid.Header');
  const windowed = React.useContext(DataGridWindowContext) !== null;
  const [thead, setThead] = React.useState<HTMLTableSectionElement | null>(null);
  const mergedRef = useMergedRefs<HTMLTableSectionElement>(ref, setThead);
  const [slots] = React.useState(createHeaderSlotRegistry);
  const content = withSelectionHeaderSlots(children, selectionMode, windowed);

  // Every commit, after the rows' slots registered: header rows can move without a slot mounting.
  React.useLayoutEffect(() => {
    slots.refresh();
  });

  // Every commit: header rows can come from components the header cannot see into.
  React.useEffect(() => {
    if (!isDev || !thead || selectionMode === 'none') return;
    const selectionCells = Array.from(thead.rows, (row) =>
      Array.from(row.cells).filter((cell) => cell.hasAttribute('data-selection-cell')),
    );
    if (
      selectionCells.some(
        (cells, index) => cells.length === 0 && thead.rows[index].cells.length > 0,
      )
    ) {
      warnOnce(
        'DataGrid.Header:missing-selection-cell',
        'DataGrid.Header: a header row has no selection column header cell, so the header has one ' +
          'column fewer than the selectable rows. Render header rows as `<tr>` children of ' +
          'DataGrid.Header (a Fragment is fine), or use `DataGrid.Row` for a header row that ' +
          'another component renders.',
      );
    }
    if (selectionCells.some((cells) => cells.length > 1)) {
      warnOnce(
        'DataGrid.Header:several-selection-cells',
        'DataGrid.Header: a header row has more than one selection cell. A DataGrid.SelectionCell ' +
          'rendered by another component is not seen, so the row also gets the automatic cell: ' +
          'render DataGrid.SelectionCell as a child of the row (a Fragment is fine).',
      );
    }
  });

  return (
    <DataGridSectionContext.Provider value="header">
      <DataGridHeaderSlotsContext.Provider value={slots}>
        <thead
          ref={mergedRef}
          className={cn(
            dataGridHeaderClassNames.root,
            'bg-card',
            // While a column resize handle drags, the header cells ignore the pointer.
            'in-data-[resizing]:pointer-events-none',
            // A windowed grid scrolls in its wrapper: the header stays at its top, over the rows
            // (on the section: a header cell is positioned for its resize handle).
            windowed && 'sticky top-0 z-1',
            className,
          )}
          {...rest}
        >
          {content}
        </thead>
      </DataGridHeaderSlotsContext.Provider>
    </DataGridSectionContext.Provider>
  );
};
DataGridHeader.displayName = 'DataGridHeader';

/**
 * A column header cell. A `sortable` header (with a `columnId`) renders its content inside a
 * `<button type="button">` that toggles the sort, followed by the direction glyph (`sortIcon`)
 * while its column is sorted; the `<th>` carries `aria-sort`. A consumer `onClick` (on the `<th>`)
 * runs before the sort, and calling `preventDefault()` in it cancels the sort (also for
 * Enter/Space on the button, which click it). In a grid with `resizableColumns`, the header cell
 * of a column of `columns` (by `columnId`) also holds the column's resize handle, after its
 * content, along its end edge (the cell is positioned for it); the cell is then named by its
 * content alone (`aria-labelledby`, unless it has a name of its own), not by the handle's label.
 * The handle is no target of the grid's navigation: a sortable cell's target stays its sort
 * button, and F2 on the cell or the button moves focus to the handle.
 */
export const DataGridHeaderCell = ({
  columnId,
  sortable = false,
  sortIcon,
  children,
  className,
  onClick,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ref,
  ...rest
}: DataGridHeaderCellProps) => {
  const { sort, requestSort } = useDataGridSortContext('DataGrid.HeaderCell');
  const resize = React.useContext(DataGridResizeContext);
  const fixedLayout = React.useContext(DataGridFixedLayoutContext);
  const labelId = useId('wave-datagrid-header-label');
  /** The column this header sorts, or `undefined` when it is not sortable. */
  const sortColumnId = sortable && columnId ? columnId : undefined;
  const sortedDirection =
    sortColumnId !== undefined && sort?.columnId === sortColumnId ? sort.direction : null;
  /** The column whose resize handle this cell holds. */
  const resizeColumnId =
    resize !== null &&
    columnId !== undefined &&
    getColumnEntry(resize.widths, columnId) !== undefined
      ? columnId
      : undefined;
  // The handle is content of the cell: without this, its label would join the cell's name. A
  // name prop given as `undefined` (forwarded by a wrapper) counts as none.
  const labelledByContent =
    resizeColumnId !== undefined && ariaLabel === undefined && ariaLabelledBy === undefined;
  const contentId = labelledByContent ? labelId : undefined;

  // The sort runs from the `<th>` once the button's click bubbled up to it, composed after the
  // consumer's `onClick` (C-COMPOSE): the consumer runs first and can cancel with preventDefault().
  // The sort button is the `<th>`'s first child (a resize handle may follow it); clicks elsewhere
  // in the cell, the handle included, do not sort.
  const sortOnButtonClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
    const button = event.currentTarget.firstElementChild;
    if (
      sortColumnId !== undefined &&
      button?.localName === 'button' &&
      button.contains(event.target as Node)
    ) {
      requestSort(sortColumnId, event.nativeEvent);
    }
  };

  React.useEffect(() => {
    if (sortable && !columnId) {
      warnOnce(
        'DataGrid.HeaderCell:sortable-without-columnId',
        'DataGrid.HeaderCell: `sortable` needs a `columnId`; the header is rendered as not sortable.',
      );
    }
  }, [sortable, columnId]);

  return (
    <th
      ref={ref}
      scope="col"
      aria-sort={sortColumnId !== undefined ? (sortedDirection ?? 'none') : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? contentId}
      className={cn(
        dataGridHeaderCellClassNames.root,
        cellBase,
        'text-start align-middle font-semibold text-caption-1 uppercase tracking-wider',
        focusRingInset,
        sortColumnId !== undefined && 'p-0 hover:bg-subtle-hover',
        // Columns laid out from widths: what does not fit is clipped, not drawn over the next.
        fixedLayout && 'overflow-hidden',
        // The box the resize handle is drawn in, along the end edge.
        resizeColumnId !== undefined && 'relative',
        className,
      )}
      {...rest}
      onClick={
        sortColumnId !== undefined ? composeEventHandlers(onClick, sortOnButtonClick) : onClick
      }
    >
      {sortColumnId !== undefined ? (
        <TableSortButton
          id={contentId}
          component="DataGrid.HeaderCell"
          direction={sortedDirection}
          sortIcon={sortIcon}
          className={dataGridHeaderCellClassNames.button}
          iconClassName={dataGridHeaderCellClassNames.sortIcon}
        >
          {children}
        </TableSortButton>
      ) : (
        <span id={contentId} className="inline-flex items-center gap-1">
          {children}
        </span>
      )}
      {resizeColumnId !== undefined && resize !== null && (
        <DataGridColumnResizeHandle columnId={resizeColumnId} context={resize} />
      )}
    </th>
  );
};
DataGridHeaderCell.displayName = 'DataGridHeaderCell';
