import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { SortArrowDownIcon, SortArrowUpIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { focusRingInset } from '../../lib/styles';
import { unwrapButtonGlyph } from '../button/Button.slots';

/** The direction of a sorted column. */
export type SortDirection = 'ascending' | 'descending';

/** Properties of {@link TableSortButton}. */
export interface TableSortButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'children'
> {
  /** The header cell's public name, for the development warning (`DataGrid.HeaderCell`). */
  component: string;
  /** The column's sort direction; `null` or `undefined` while it is not sorted (no glyph). */
  direction: SortDirection | null | undefined;
  /** The header cell's `sortIcon` slot. */
  sortIcon: Slot<'span'> | undefined;
  /** The host's stable class for the glyph (its `sortIcon` part). */
  iconClassName: string;
  /**
   * The host's stable class for the button (its `button` part). It is merged first, so the
   * button's own classes win where they conflict.
   */
  className?: string;
  /** The header content. */
  children?: React.ReactNode;
}

/**
 * The sort button of a sortable column header (DataGrid, Table): a `<button type="button">` that
 * fills its `<th>` and holds the header content, then, while the column is sorted, the direction
 * glyph. The glyph is decorative (`aria-hidden`; the header's `aria-sort` tells the direction) and
 * carries `data-direction`. The default glyph is an arrow, up for ascending and down for
 * descending; `sortIcon` follows the rule of optional indicators (C-SLOTS): `null` and
 * `undefined` keep the arrow, `false` or any value that renders nothing shows none, other content
 * renders in a `<span>`. A `<button>` or `Button` element passed as `sortIcon`, or a slot object
 * whose `as` is one, is not nested: its children become the glyph (the arrow when they render
 * nothing), its props are dropped and a one-time development warning names the slot.
 */
export const TableSortButton = ({
  component,
  direction,
  sortIcon,
  iconClassName,
  className,
  children,
  ...rest
}: TableSortButtonProps) => {
  const { glyph, button } = unwrapButtonGlyph(sortIcon);
  React.useEffect(() => {
    if (button) {
      warnOnce(
        `${component}:sortIcon-button`,
        `${component}: \`sortIcon\` received ${button}; its children render as the sort glyph ` +
          'and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. ' +
          '`sortIcon={<MyIcon />}`.',
      );
    }
  }, [button, component]);

  let icon: React.ReactNode = null;
  if (direction) {
    if (sortIcon == null || (button !== null && !slotRendersContent(glyph))) {
      const Arrow = direction === 'ascending' ? SortArrowUpIcon : SortArrowDownIcon;
      icon = <Arrow data-direction={direction} className={cn(iconClassName, 'shrink-0')} />;
    } else if (slotRendersContent(glyph)) {
      icon = renderSlot(glyph, 'span', cn(iconClassName, 'inline-flex shrink-0 items-center'), {
        'aria-hidden': true,
        'data-direction': direction,
      });
    }
  }

  return (
    <button
      type="button"
      {...rest}
      className={cn(
        className,
        'inline-flex w-full cursor-pointer select-none items-center gap-1 border-0 bg-transparent px-4 py-3 text-start text-inherit [font:inherit] uppercase tracking-wider',
        focusRingInset,
      )}
    >
      {children}
      {icon}
    </button>
  );
};
TableSortButton.displayName = 'TableSortButton';
