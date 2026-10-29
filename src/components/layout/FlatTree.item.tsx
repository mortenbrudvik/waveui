import * as React from 'react';
import { flatTreeItemClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { isOwnEvent } from '../../lib/events';
import type { VisibleFlatItem } from '../../lib/flatTree';
import { CheckIcon, ChevronRightIcon, SubtractIcon } from '../../lib/icons';
import { disabledStyles, forcedColors } from '../../lib/styles';
import type { CheckState } from '../../lib/treeCascade';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useFlatTreeContext } from './FlatTree.context';

/** Properties for the FlatTreeItem sub-component. */
export interface FlatTreeItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The row the item shows: a visible item of the tree's model (`model.visibleItems`). */
  item: VisibleFlatItem & { checked?: CheckState };
  /** The item's content: what the tree's `renderItem` returns, else the item's label. */
  children?: React.ReactNode;
  /** Ref to the `role="treeitem"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Whether a click landed on the item's checkbox, which has a click of its own. */
function isCheckboxClick(event: React.MouseEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  return target?.closest?.('[data-flat-tree-checkbox]') != null;
}

/**
 * One row of a FlatTree, rendered by the tree for each visible item of its model (it is not
 * written by hand): a `role="treeitem"` element with the item's level, set size and position,
 * `aria-expanded` on a branch, and the expand chevron, the checkbox (multiple mode) or the radio
 * (single mode) of the nested `Tree`'s items, before the content. Levels are drawn by indenting
 * the row, since the items are siblings. In a windowed tree it is exactly the window's `itemSize`
 * tall.
 *
 * `ref`, `className` and the other props land on the treeitem element; its `onClick` receives the
 * clicks on the row, not those on the checkbox, and runs before the built-in activation (call
 * `event.preventDefault()` to skip it).
 */
export const FlatTreeItem = ({
  item: row,
  children,
  className,
  style,
  onClick,
  ref,
  ...rest
}: FlatTreeItemProps) => {
  const ctx = useFlatTreeContext('FlatTree.Item');
  const { item, level, position, setSize, isBranch, expanded, index } = row;
  const { value } = item;
  const disabled = item.disabled === true;
  const labelId = useId('flat-tree-item-label');
  const itemRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, itemRef);

  const checkState: CheckState | undefined =
    ctx.selectionMode === 'multiple' ? (row.checked ?? 'unchecked') : undefined;
  const isSelected = ctx.selected !== undefined ? ctx.selected === value : undefined;
  const isCurrent = ctx.current !== undefined && ctx.current !== null && ctx.current === value;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // A click from a portal opened in the content, or on the checkbox, is not the row's.
    if (!isOwnEvent(event) || isCheckboxClick(event)) return;
    onClick?.(event);
    if (!event.defaultPrevented) ctx.activate(row);
  };

  // The checkbox never takes focus (APG: focus stays on tree items): a press on it focuses its
  // item instead, and its click toggles the check without activating the item.
  const keepFocusOnItem = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    itemRef.current?.focus({ preventScroll: true });
  };
  const handleCheckboxClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    ctx.toggleChecked(row, event.nativeEvent);
  };

  const chevron = isBranch ? (
    <ChevronRightIcon
      className={cn(
        flatTreeItemClassNames.expandIcon,
        'shrink-0 transition-transform motion-reduce:transition-none',
        expanded ? 'rotate-90' : 'wave-rtl:-scale-x-100',
      )}
    />
  ) : (
    <span className="w-3 shrink-0" aria-hidden="true" />
  );

  const checkbox =
    checkState === undefined ? null : (
      <span
        role="checkbox"
        aria-checked={checkState === 'mixed' ? 'mixed' : checkState === 'checked'}
        aria-labelledby={labelId}
        aria-disabled={disabled ? true : undefined}
        tabIndex={-1}
        data-flat-tree-checkbox=""
        onMouseDown={keepFocusOnItem}
        onClick={handleCheckboxClick}
        className={cn(
          flatTreeItemClassNames.indicator,
          // Checkbox's box: 16px inside a 24px target (the pseudo-element), WCAG 2.5.8.
          'relative inline-flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors motion-reduce:transition-none',
          'before:absolute before:-inset-1',
          checkState === 'unchecked'
            ? cn('border-stroke-accessible bg-transparent', forcedColors.control)
            : 'border-primary bg-primary text-primary-foreground forced-colors:border-[Highlight] forced-colors:bg-[Highlight]',
        )}
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
  const radio =
    ctx.selectionMode === 'single' ? (
      <span
        aria-hidden="true"
        className={cn(
          flatTreeItemClassNames.indicator,
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none',
          isSelected
            ? 'border-2 border-primary forced-colors:border-[Highlight]'
            : cn('border-stroke-accessible', forcedColors.control),
        )}
      >
        {isSelected && (
          <span className={cn('block size-2 rounded-full bg-primary', forcedColors.selectedLeaf)} />
        )}
      </span>
    ) : null;

  // The level is drawn as indentation (one step per level, as a nested group's), and a windowed
  // item is exactly the window's item height: the window's arithmetic counts on it.
  const itemStyle: React.CSSProperties = { ...style };
  if (level > 1) itemStyle.paddingInlineStart = `${level - 1}rem`;
  if (ctx.itemSize !== undefined) itemStyle.height = ctx.itemSize;

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isCurrent ? true : undefined}
      aria-disabled={disabled ? true : undefined}
      data-selected={isSelected ? '' : undefined}
      data-current={isCurrent ? '' : undefined}
      data-checked={checkState === 'checked' ? '' : undefined}
      data-mixed={checkState === 'mixed' ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        flatTreeItemClassNames.root,
        // The focus ring is drawn on the row, inside the item's box.
        'box-border block outline-none',
        '[&:focus-visible>[data-flat-tree-row]]:outline-2 [&:focus-visible>[data-flat-tree-row]]:-outline-offset-2 [&:focus-visible>[data-flat-tree-row]]:outline-ring',
        disabledStyles,
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
      aria-checked={
        checkState === undefined
          ? undefined
          : checkState === 'mixed'
            ? 'mixed'
            : checkState === 'checked'
      }
      data-index={index}
      tabIndex={ctx.tabStop === value ? 0 : -1}
      style={itemStyle}
      onClick={handleClick}
      ref={mergedRef}
    >
      <div
        data-flat-tree-row=""
        className={cn(
          flatTreeItemClassNames.row,
          'box-border flex items-center gap-1.5 rounded px-2 py-1',
          ctx.itemSize !== undefined && 'h-full',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-subtle-hover',
          isSelected && cn('bg-subtle-selected font-semibold', forcedColors.selectedContainer),
        )}
      >
        {chevron}
        {checkbox ?? radio}
        <span id={labelId} className={cn(flatTreeItemClassNames.label, 'min-w-0 truncate')}>
          {children}
        </span>
      </div>
    </div>
  );
};
FlatTreeItem.displayName = 'FlatTreeItem';
