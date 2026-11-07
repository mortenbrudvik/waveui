import * as React from 'react';
import { getElementType } from '../../lib/children';
import { wcn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { SortArrowDownIcon, SortArrowUpIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { mergeSlotProps } from '../../lib/slotProps';
import type { SlotPart } from '../../lib/slotProps';
import { focusRingInset } from '../../lib/styles';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { unwrapButtonGlyph } from '../button/Button.slots';
import { TABLE_SIZE_CLASSES, useTableSize } from './Table.context';

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
export const SELECTION_CELL_CLASSES =
  'wave:w-10 wave:px-3 wave:py-3 wave:border-b wave:border-border';

/**
 * A subtle control is transparent while it is not checked, until the group named by `reveal` is
 * hovered or holds focus; its own keyboard focus, forced colors and a coarse pointer (touch) always
 * draw it (a control outside such a group still shows its focus ring). It stays focusable and named.
 */
const SUBTLE_CONTROL_CLASSES = {
  row: 'wave:opacity-0 wave:group-hover/table-row:opacity-100 wave:group-focus-within/table-row:opacity-100 wave:focus-visible:opacity-100 wave:forced-colors:opacity-100 wave:pointer-coarse:opacity-100 wave:transition-opacity wave:motion-reduce:transition-none',
  grid: 'wave:opacity-0 wave:group-hover/grid:opacity-100 wave:group-focus-within/grid:opacity-100 wave:focus-visible:opacity-100 wave:forced-colors:opacity-100 wave:pointer-coarse:opacity-100 wave:transition-opacity wave:motion-reduce:transition-none',
} as const;

/**
 * What a selection control part locks unset, before the control's own attributes (which follow
 * and win): a role, a tab index (the host decides it, and a grid's navigation writes it), the
 * form wiring and the required state (the control is a selection, not a form value, unless its
 * host routes them), the uncontrolled defaults and `aria-checked` (the control is controlled, and
 * its checked state is native), `contentEditable` (a grid takes an editable element for text
 * entry), the hidden state (a focusable control is never hidden) and the markers a grid's
 * navigation reads (a nested composite, an auxiliary widget). Written out, as every lock constant
 * of a part.
 */
const SELECTION_CONTROL_PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  name: undefined,
  form: undefined,
  required: undefined,
  defaultChecked: undefined,
  defaultValue: undefined,
  'aria-checked': undefined,
  contentEditable: undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
  'data-roving-container': undefined,
  'data-grid-auxiliary': undefined,
} as const;

/**
 * What a sort button part locks, before the button's own attributes (which follow and win): its
 * type, and unset a role, a tab index (a grid's navigation writes it), the disabled and hidden
 * state, `contentEditable` (a grid takes an editable element for text entry) and the markers a
 * grid's navigation reads (a nested composite, an auxiliary widget).
 */
const SORT_BUTTON_PART_LOCKS = {
  type: 'button',
  role: undefined,
  tabIndex: undefined,
  disabled: undefined,
  contentEditable: undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
  'data-roving-container': undefined,
  'data-grid-auxiliary': undefined,
} as const;

/** Properties of {@link TableSelectionControl}. */
export interface TableSelectionControlProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'checked' | 'defaultChecked' | 'part'
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
  /**
   * The host's part for the control (`slotProps.control`, `selectAllCheckbox` or
   * `selectionControl`), merged into the control's props: its classes last, its handlers first,
   * every attribute the control sets locked, and its ref beside the control's.
   */
  part?: SlotPart<'input'>;
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
 *
 * A host's `part` adds to the control: the attributes the host gives (`rest`), the type, the
 * checked state and the change handler are locked (a part's `onChange` runs first, and
 * `preventDefault()` in it skips the change), and so are the attributes of
 * {@link SELECTION_CONTROL_PART_LOCKS} the host does not give.
 */
export const TableSelectionControl = ({
  type,
  checked,
  subtle = false,
  reveal = 'row',
  invisible = false,
  className,
  onChange,
  part,
  ref,
  ...rest
}: TableSelectionControlProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  // A part's ref joins after the spread, so an inline one never detaches the control's own.
  const mergedRef = useMergedRefs<HTMLInputElement>(ref, inputRef, part?.ref);
  const mixed = checked === 'mixed';
  // Changes of a mixed control: the flag is applied again after each (see the JSDoc above).
  const [mixedChanges, setMixedChanges] = React.useState(0);

  React.useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = mixed;
  }, [mixed, mixedChanges]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (mixed) setMixedChanges((count) => count + 1);
    onChange?.(event);
  };
  const classes = wcn(
    className,
    'wave:accent-primary wave:cursor-pointer wave:disabled:cursor-not-allowed',
    focusRingInset,
    subtle && checked === false && SUBTLE_CONTROL_CLASSES[reveal],
    invisible && 'wave:invisible',
  );

  return (
    <input
      {...rest}
      type={type}
      checked={checked === true}
      onChange={handleChange}
      className={classes}
      {...(part &&
        mergeSlotProps(part, {
          className: classes,
          locked: {
            ...SELECTION_CONTROL_PART_LOCKS,
            ...rest,
            type,
            checked: checked === true,
            onChange: handleChange,
          },
        }))}
      ref={mergedRef}
    />
  );
};
TableSelectionControl.displayName = 'TableSelectionControl';

/** The direction of a sorted column. */
export type SortDirection = 'ascending' | 'descending';

/** Properties of {@link TableSortButton}. */
export interface TableSortButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'children' | 'part'
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
  /**
   * The host's `slotProps.button`, merged into the button's props: its classes last, its
   * handlers first, every attribute the button sets locked.
   */
  part?: SlotPart<'button'>;
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
 *
 * A host's `part` adds to the button: the attributes and handlers the host gives (`rest`) are
 * locked (a part's handler runs first, and `preventDefault()` in it skips the host's), and so are
 * the attributes of {@link SORT_BUTTON_PART_LOCKS}.
 */
export const TableSortButton = ({
  component,
  direction,
  sortIcon,
  iconClassName,
  className,
  part,
  children,
  ...rest
}: TableSortButtonProps) => {
  const size = useTableSize();
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
      icon = <Arrow data-direction={direction} className={wcn(iconClassName, 'wave:shrink-0')} />;
    } else if (slotRendersContent(glyph)) {
      icon = renderSlot(
        glyph,
        'span',
        wcn(iconClassName, 'wave:inline-flex wave:shrink-0 wave:items-center'),
        {
          'aria-hidden': true,
          'data-direction': direction,
        },
      );
    }
  }

  const classes = wcn(
    className,
    'wave:inline-flex wave:w-full wave:cursor-pointer wave:select-none wave:items-center wave:gap-1 wave:border-0 wave:bg-transparent wave:px-4 wave:py-3 wave:text-start wave:text-inherit wave:[font:inherit] wave:uppercase wave:tracking-wider',
    TABLE_SIZE_CLASSES.sortButton[size],
    focusRingInset,
  );
  return (
    <button
      type="button"
      {...rest}
      className={classes}
      {...(part &&
        mergeSlotProps(part, {
          className: classes,
          locked: { ...SORT_BUTTON_PART_LOCKS, ...rest },
        }))}
    >
      {children}
      {icon}
    </button>
  );
};
TableSortButton.displayName = 'TableSortButton';
