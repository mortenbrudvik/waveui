import * as React from 'react';
import { getElementType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { SortArrowDownIcon, SortArrowUpIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { focusRingInset } from '../../lib/styles';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { unwrapButtonGlyph } from '../button/Button.slots';

// ---------------------------------------------------------------------------
// Part markers
// ---------------------------------------------------------------------------

/** The kinds of table parts a marker identifies (see {@link markTablePart}). */
export type TablePartKind = 'dataGridSelectionCell';

const TABLE_PART: symbol = Symbol.for('wave.tablePart');

/**
 * Marks `component` as a table part of `kind`, so a row or a header recognises its elements among
 * its children without comparing types (the `markNavPart` pattern); call it next to
 * `displayName`. Returns `component`.
 */
export function markTablePart<T extends object>(component: T, kind: TablePartKind): T {
  (component as Record<symbol, unknown>)[TABLE_PART] = kind;
  return component;
}

/**
 * The kind of table part `node` is an element of, or `null` for anything else. The type is
 * resolved with `getElementType(node, { suspend: false })`: a lazy client reference (a part
 * written in a Server Component) is recognised, and a lazy type still loading is no part (it never
 * suspends).
 */
export function getTablePartKind(node: React.ReactNode): TablePartKind | null {
  const type = getElementType(node, { suspend: false });
  if ((typeof type !== 'function' && typeof type !== 'object') || type === null) return null;
  const kind = (type as Record<symbol, unknown>)[TABLE_PART];
  return kind === 'dataGridSelectionCell' ? kind : null;
}

// ---------------------------------------------------------------------------
// Selection control
// ---------------------------------------------------------------------------

/** The box of a selection cell (DataGrid's and Table.SelectionCell's): 40px wide, a row's rule. */
export const SELECTION_CELL_CLASSES = 'w-10 px-3 py-3 border-b border-border';

/**
 * A subtle control is transparent while it is not checked, until the group named by `reveal` is
 * hovered or holds focus; its own keyboard focus, forced colors and a coarse pointer (touch) always
 * draw it (a control outside such a group still shows its focus ring). It stays focusable and named.
 */
const SUBTLE_CONTROL_CLASSES = {
  row: 'opacity-0 group-hover/table-row:opacity-100 group-focus-within/table-row:opacity-100 focus-visible:opacity-100 forced-colors:opacity-100 pointer-coarse:opacity-100 transition-opacity motion-reduce:transition-none',
  grid: 'opacity-0 group-hover/grid:opacity-100 group-focus-within/grid:opacity-100 focus-visible:opacity-100 forced-colors:opacity-100 pointer-coarse:opacity-100 transition-opacity motion-reduce:transition-none',
} as const;

/** Properties of {@link TableSelectionControl}. */
export interface TableSelectionControlProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'checked' | 'defaultChecked'
> {
  /** A checkbox (multiple selection, select-all) or a radio (single selection). */
  type: 'checkbox' | 'radio';
  /** The checked state; `'mixed'` draws an indeterminate checkbox. */
  checked: boolean | 'mixed';
  /**
   * Transparent while not checked, until the group named by `reveal` is hovered or holds focus
   * (its own keyboard focus, forced colors and a coarse pointer always draw it). It stays focusable
   * and named.
   * @default false
   */
  subtle?: boolean;
  /**
   * The group whose hover or focus draws a subtle control: its row (the `group/table-row`
   * element; not the `group/row` of Tree's rows, which a Tree in a cell keeps to itself) or the
   * whole grid (`group/grid`).
   * @default 'row'
   */
  reveal?: keyof typeof SUBTLE_CONTROL_CLASSES;
  /** Not drawn and not focusable; its box keeps its space. @default false */
  invisible?: boolean;
  /** The host's stable class for the control, merged first. */
  className?: string;
  /** Ref to the `<input>` element. */
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * The native selection control of a table row or header (DataGrid, Table): an
 * `<input type="checkbox">` or `<input type="radio">` drawn in the theme's accent color, with the
 * focus ring of a cell. It is controlled: `checked` is the state, and `'mixed'` sets the
 * checkbox's `indeterminate` flag, which is set again after every change of a mixed control (a
 * click clears it, and a parent that keeps the state mixed, or ignores the change, renders nothing
 * new). A `disabled` control is natively disabled.
 */
export const TableSelectionControl = ({
  type,
  checked,
  subtle = false,
  reveal = 'row',
  invisible = false,
  className,
  onChange,
  ref,
  ...rest
}: TableSelectionControlProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs<HTMLInputElement>(ref, inputRef);
  const mixed = checked === 'mixed';
  // Changes of a mixed control: the flag is applied again after each (see the JSDoc above).
  const [mixedChanges, setMixedChanges] = React.useState(0);

  React.useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = mixed;
  }, [mixed, mixedChanges]);

  return (
    <input
      {...rest}
      ref={mergedRef}
      type={type}
      checked={checked === true}
      onChange={(event) => {
        if (mixed) setMixedChanges((count) => count + 1);
        onChange?.(event);
      }}
      className={cn(
        className,
        'accent-primary cursor-pointer disabled:cursor-not-allowed',
        focusRingInset,
        subtle && checked === false && SUBTLE_CONTROL_CLASSES[reveal],
        invisible && 'invisible',
      )}
    />
  );
};
TableSelectionControl.displayName = 'TableSelectionControl';

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
