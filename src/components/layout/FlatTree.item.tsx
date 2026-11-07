import * as React from 'react';
import { flatTreeItemClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { isOwnEvent } from '../../lib/events';
import type { VisibleFlatItem } from '../../lib/flatTree';
import { CheckIcon, ChevronRightIcon, SubtractIcon } from '../../lib/icons';
import { HIDDEN_PART_LOCKS, mergeSlotProps } from '../../lib/slotProps';
import { disabledStyles, focusRingInset, forcedColors } from '../../lib/styles';
import type { CheckState } from '../../lib/treeCascade';
import { useId } from '../../hooks/useId';
import { useFlatTreeContext } from './FlatTree.context';
import { CELL_ATTRIBUTE } from './FlatTree.treegrid';
import { useAppClassName } from '../../hooks/useAppClassName';

/** Properties for the FlatTreeItem sub-component. */
export interface FlatTreeItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The row the item shows: a visible item of the tree's model (`model.visibleItems`). */
  item: VisibleFlatItem & { checked?: CheckState };
  /** The item's content: what the tree's `renderItem` returns, else the item's label. */
  children?: React.ReactNode;
  /**
   * The content of the item's further cells, in order: what the tree's `renderCells` returns. Each
   * is drawn in a `role="gridcell"` element after the item's own cell. Only a
   * `navigationMode="treegrid"` tree draws them.
   */
  cells?: readonly React.ReactNode[];
  /** Ref to the `role="treeitem"` element (`role="row"` in a treegrid). */
  ref?: React.Ref<HTMLDivElement>;
}

/** Whether a click landed on the item's checkbox, which has a click of its own. */
function isCheckboxClick(event: React.MouseEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  return target?.closest?.('[data-flat-tree-checkbox]') != null;
}

/**
 * Whether a click landed in one of a treegrid row's further cells (not its own content cell):
 * what is in them, such as a button, is theirs, and never activates the row.
 */
function isFurtherCellClick(event: React.MouseEvent<HTMLElement>): boolean {
  const cell = (event.target as Element | null)?.closest?.(`[${CELL_ATTRIBUTE}]`);
  return cell != null && cell.getAttribute(CELL_ATTRIBUTE) !== '0';
}

/**
 * The checkbox never takes focus (APG: focus stays on tree items): a press on it focuses its item
 * instead, the treeitem its row sits in (the row is the checkbox's parent and the treeitem's
 * child). Found from the event, so a part can take it as its own handler.
 */
function keepFocusOnItem(event: React.MouseEvent<HTMLSpanElement>): void {
  event.preventDefault();
  event.currentTarget
    .closest('[data-flat-tree-row]')
    ?.parentElement?.focus({ preventScroll: true });
}

/**
 * What every `slotProps` part of an item locks unset: a role (a part with an item's role would be
 * a treeitem of its own), a tab index (a tree has one tab stop, its focused item), and the markers
 * by which the tree reads an item (its row, which the focus ring is drawn on, and its checkbox,
 * whose clicks are not the row's). A part that carries one sets it after the spread.
 */
const PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'data-flat-tree-row': undefined,
  'data-flat-tree-checkbox': undefined,
  [CELL_ATTRIBUTE]: undefined,
} as const;

/**
 * The `blockHandlers` of a disabled item's parts: the item activates, expands and checks on no
 * click, and calls no click handler of a part.
 */
const BLOCK_CLICK = ['onClick'] as const;

/**
 * One row of a FlatTree, rendered by the tree for each visible item of its model (it is not
 * written by hand): a `role="treeitem"` element with the item's level, set size and position,
 * `aria-expanded` on a branch, and the expand chevron, the checkbox (multiple mode) or the radio
 * (single mode) of the nested `Tree`'s items, before the content. Levels are drawn by indenting
 * the row, since the items are siblings. In a windowed tree it is exactly the window's `itemSize`
 * tall.
 *
 * In a `navigationMode="treegrid"` tree the element is a `role="row"` with `aria-level`,
 * `aria-posinset`, `aria-setsize`, `aria-rowindex` and `aria-expanded` on branches. Its content
 * (chevron, check and label) sits in the first `gridcell`, and `cells` draw the others. A row
 * carries no `aria-checked`: the checkbox, a `role="checkbox"` inside the first cell, does.
 *
 * `ref`, `className` and the other props land on the treeitem element; its `onClick` receives the
 * clicks on the row, not those on the checkbox, and runs before the built-in activation (call
 * `event.preventDefault()` to skip it).
 */
export const FlatTreeItem = ({
  item: row,
  children,
  cells,
  className,
  style,
  onClick,
  ref,
  ...rest
}: FlatTreeItemProps) => {
  const appClassName = useAppClassName(flatTreeItemClassNames.root);

  const ctx = useFlatTreeContext('FlatTree.Item');
  const { item, level, position, setSize, isBranch, expanded, index } = row;
  const { value } = item;
  const disabled = item.disabled === true;
  const treegrid = ctx.treegrid === true;
  const cellCount = 1 + (treegrid ? (cells?.length ?? 0) : 0);
  // In a treegrid the tab stop is the row, or one of its cells while a cell is the focused one.
  const tabStopHere = ctx.tabStop === value;
  const tabStopCell =
    treegrid && tabStopHere && ctx.tabStopCell != null && ctx.tabStopCell < cellCount
      ? ctx.tabStopCell
      : null;
  const labelId = useId('flat-tree-item-label');
  // The tree's parts, merged only when given: a tree renders many items. A disabled item's parts
  // get no click of yours.
  const parts = ctx.slotProps;
  const blockHandlers = disabled ? BLOCK_CLICK : undefined;

  const checkState: CheckState | undefined =
    ctx.selectionMode === 'multiple' ? (row.checked ?? 'unchecked') : undefined;
  const ariaChecked = checkState === 'mixed' ? 'mixed' : checkState === 'checked';
  const isSelected = ctx.selected !== undefined ? ctx.selected === value : undefined;
  const isCurrent = ctx.current !== undefined && ctx.current !== null && ctx.current === value;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // A click from a portal opened in the content, or on the checkbox, is not the row's.
    if (!isOwnEvent(event) || isCheckboxClick(event)) return;
    if (treegrid && isFurtherCellClick(event)) return;
    onClick?.(event);
    if (!event.defaultPrevented) ctx.activate(row);
  };

  // The checkbox never takes focus (`keepFocusOnItem`), and its click toggles the check without
  // activating the item.
  const handleCheckboxClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    ctx.toggleChecked(row, event.nativeEvent);
  };

  const chevronClasses = isBranch
    ? wcn(
        flatTreeItemClassNames.expandIcon,
        'wave:shrink-0 wave:transition-transform wave:motion-reduce:transition-none',
        expanded ? 'wave:rotate-90' : 'wave:wave-rtl:-scale-x-100',
      )
    : undefined;
  const chevron = isBranch ? (
    <ChevronRightIcon
      className={chevronClasses}
      {...(parts?.expandIcon &&
        mergeSlotProps(parts.expandIcon, {
          className: chevronClasses,
          locked: { ...PART_LOCKS, 'aria-hidden': true, focusable: 'false' },
          blockHandlers,
        }))}
    />
  ) : (
    <span className="wave:w-3 wave:shrink-0" aria-hidden="true" />
  );

  const checkboxClasses =
    checkState === undefined
      ? undefined
      : wcn(
          flatTreeItemClassNames.indicator,
          // Checkbox's box: 16px inside a 24px target (the pseudo-element), WCAG 2.5.8.
          'wave:relative wave:inline-flex wave:size-4 wave:shrink-0 wave:items-center wave:justify-center wave:rounded-xs wave:border wave:transition-colors wave:motion-reduce:transition-none',
          'wave:before:absolute wave:before:-inset-1',
          checkState === 'unchecked'
            ? wcn('wave:border-stroke-accessible wave:bg-transparent', forcedColors.control)
            : 'wave:border-primary wave:bg-primary wave:text-primary-foreground wave:forced-colors:border-[Highlight] wave:forced-colors:bg-[Highlight]',
        );
  const checkbox =
    checkState === undefined ? null : (
      <span
        role="checkbox"
        aria-checked={ariaChecked}
        aria-labelledby={labelId}
        aria-disabled={disabled ? true : undefined}
        tabIndex={-1}
        data-flat-tree-checkbox=""
        onMouseDown={keepFocusOnItem}
        onClick={handleCheckboxClick}
        className={checkboxClasses}
        {...(parts?.indicator &&
          mergeSlotProps(parts.indicator, {
            className: checkboxClasses,
            locked: {
              ...PART_LOCKS,
              ...HIDDEN_PART_LOCKS,
              role: 'checkbox',
              'aria-checked': ariaChecked,
              'aria-labelledby': labelId,
              'aria-disabled': disabled ? true : undefined,
              tabIndex: -1,
              'data-flat-tree-checkbox': '',
              onMouseDown: keepFocusOnItem,
              onClick: handleCheckboxClick,
            },
            blockHandlers,
          }))}
      >
        {checkState === 'mixed' ? (
          <SubtractIcon size={12} className={forcedColors.selectedLeaf} />
        ) : checkState === 'checked' ? (
          <CheckIcon size={12} className={forcedColors.selectedLeaf} />
        ) : null}
      </span>
    );

  // Single mode: a decorative radio (the treeitem's aria-selected carries the state). A click on
  // it is a click on the row, so it activates the item.
  const radioClasses =
    ctx.selectionMode === 'single'
      ? wcn(
          flatTreeItemClassNames.indicator,
          'wave:inline-flex wave:size-4 wave:shrink-0 wave:items-center wave:justify-center wave:rounded-full wave:border wave:transition-colors wave:motion-reduce:transition-none',
          isSelected
            ? 'wave:border-2 wave:border-primary wave:forced-colors:border-[Highlight]'
            : wcn('wave:border-stroke-accessible', forcedColors.control),
        )
      : undefined;
  const radio =
    ctx.selectionMode === 'single' ? (
      <span
        aria-hidden="true"
        className={radioClasses}
        {...(parts?.indicator &&
          mergeSlotProps(parts.indicator, {
            className: radioClasses,
            locked: { ...PART_LOCKS, 'aria-hidden': true },
            blockHandlers,
          }))}
      >
        {isSelected && (
          <span
            className={wcn(
              'wave:block wave:size-2 wave:rounded-full wave:bg-primary',
              forcedColors.selectedLeaf,
            )}
          />
        )}
      </span>
    ) : null;

  // The level is drawn as indentation (one step per level, as a nested group's), and a windowed
  // item is exactly the window's item height: the window's arithmetic counts on it.
  const itemStyle: React.CSSProperties = { ...style };
  if (level > 1) itemStyle.paddingInlineStart = `${level - 1}rem`;
  if (ctx.itemSize !== undefined) itemStyle.height = ctx.itemSize;

  const selectedLook = wcn(
    'wave:bg-subtle-selected wave:font-semibold',
    forcedColors.selectedContainer,
  );
  const rowClasses = treegrid
    ? // The first cell: the hover and selected looks are the whole row's (the item's).
      wcn(
        flatTreeItemClassNames.row,
        'wave:box-border wave:flex wave:min-w-0 wave:flex-1 wave:items-center wave:gap-1.5 wave:rounded wave:px-2 wave:py-1',
        ctx.itemSize !== undefined && 'wave:h-full',
        disabled ? 'wave:cursor-not-allowed' : 'wave:cursor-pointer',
        focusRingInset,
      )
    : wcn(
        flatTreeItemClassNames.row,
        'wave:box-border wave:flex wave:items-center wave:gap-1.5 wave:rounded wave:px-2 wave:py-1',
        ctx.itemSize !== undefined && 'wave:h-full',
        disabled ? 'wave:cursor-not-allowed' : 'wave:cursor-pointer wave:hover:bg-subtle-hover',
        isSelected && selectedLook,
      );
  const cellClasses = wcn(
    flatTreeItemClassNames.cell,
    'wave:box-border wave:flex wave:shrink-0 wave:items-center wave:gap-1 wave:rounded wave:px-2 wave:py-1',
    ctx.itemSize !== undefined && 'wave:h-full',
    focusRingInset,
  );
  const itemLook = treegrid
    ? wcn(
        'wave:box-border wave:flex wave:items-stretch wave:rounded',
        !disabled && 'wave:hover:bg-subtle-hover',
        isSelected && selectedLook,
        focusRingInset,
      )
    : wcn(
        // The focus ring is drawn on the row, inside the item's box.
        'wave:box-border wave:block wave:outline-none',
        'wave:[&:focus-visible>[data-flat-tree-row]]:outline-2 wave:[&:focus-visible>[data-flat-tree-row]]:-outline-offset-2 wave:[&:focus-visible>[data-flat-tree-row]]:outline-ring',
      );
  const labelClasses = wcn(flatTreeItemClassNames.label, 'wave:min-w-0 wave:truncate');

  return (
    <div
      role={treegrid ? 'row' : 'treeitem'}
      aria-selected={isSelected}
      aria-current={isCurrent ? true : undefined}
      aria-disabled={disabled ? true : undefined}
      data-selected={isSelected ? '' : undefined}
      data-current={isCurrent ? '' : undefined}
      data-checked={checkState === 'checked' ? '' : undefined}
      data-mixed={checkState === 'mixed' ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={wcn(
        flatTreeItemClassNames.root,
        itemLook,
        disabledStyles,
        appClassName,
        className,
      )}
      {...rest}
      // Named by its content only: the treeitem also holds the chevron and the checkbox. A consumer
      // aria-labelledby or aria-label replaces it.
      aria-labelledby={
        rest['aria-labelledby'] ?? (rest['aria-label'] === undefined ? labelId : undefined)
      }
      // From the model, after the rest props: the positions and states are the data's.
      aria-level={level}
      aria-setsize={setSize}
      aria-posinset={position}
      aria-expanded={isBranch ? expanded : undefined}
      aria-checked={checkState === undefined || treegrid ? undefined : ariaChecked}
      aria-rowindex={treegrid ? index + 1 : undefined}
      data-index={index}
      tabIndex={tabStopHere && tabStopCell === null ? 0 : -1}
      style={itemStyle}
      onClick={handleClick}
      ref={ref}
    >
      <div
        data-flat-tree-row=""
        {...(treegrid && {
          role: 'gridcell',
          tabIndex: tabStopCell === 0 ? 0 : -1,
          [CELL_ATTRIBUTE]: '0',
        })}
        className={rowClasses}
        {...(parts?.row &&
          mergeSlotProps(parts.row, {
            className: rowClasses,
            locked: {
              ...PART_LOCKS,
              ...HIDDEN_PART_LOCKS,
              'data-flat-tree-row': '',
              ...(treegrid && {
                role: 'gridcell',
                tabIndex: tabStopCell === 0 ? 0 : -1,
                [CELL_ATTRIBUTE]: '0',
              }),
            },
            blockHandlers,
          }))}
      >
        {chevron}
        {checkbox ?? radio}
        <span
          id={labelId}
          className={labelClasses}
          {...(parts?.label &&
            mergeSlotProps(parts.label, {
              className: labelClasses,
              locked: { ...PART_LOCKS, ...HIDDEN_PART_LOCKS, id: labelId, 'aria-label': undefined },
              blockHandlers,
            }))}
        >
          {children}
        </span>
      </div>
      {treegrid &&
        cells?.map((content, at) => {
          const cellIndex = at + 1;
          const tabIndex = tabStopCell === cellIndex ? 0 : -1;
          return (
            <div
              key={cellIndex}
              role="gridcell"
              tabIndex={tabIndex}
              {...{ [CELL_ATTRIBUTE]: String(cellIndex) }}
              className={cellClasses}
              {...(parts?.cell &&
                mergeSlotProps(parts.cell, {
                  className: cellClasses,
                  locked: {
                    ...PART_LOCKS,
                    ...HIDDEN_PART_LOCKS,
                    role: 'gridcell',
                    tabIndex,
                    [CELL_ATTRIBUTE]: String(cellIndex),
                  },
                  blockHandlers,
                }))}
            >
              {content}
            </div>
          );
        })}
    </div>
  );
};
FlatTreeItem.displayName = 'FlatTreeItem';
