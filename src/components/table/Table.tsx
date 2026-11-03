import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { wcn } from '../../lib/cn';
import {
  tableBodyClassNames,
  tableCellActionsClassNames,
  tableCellClassNames,
  tableCellLayoutClassNames,
  tableClassNames,
  tableHeaderCellClassNames,
  tableHeaderClassNames,
  tableRowClassNames,
  tableSelectionCellClassNames,
} from '../../lib/classNames';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnOnce } from '../../lib/dev';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { mergeSlotProps } from '../../lib/slotProps';
import type { SlotPart } from '../../lib/slotProps';
import { focusRing, forcedColors } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import { AvatarSizeContext } from '../data-display/Avatar.context';
import type { AvatarSizeContextValue } from '../data-display/Avatar.context';
import { TABLE_SIZE_CLASSES, TableSizeContext, useTableSize } from './Table.context';
import type { TableSize } from './Table.context';
import {
  TableSpacerRow,
  TableWindowContext,
  TableWindowRowContext,
  countRows,
  withRowIndexes,
} from './Table.window';
import type { TableWindowContextValue } from './Table.window';
import { TableResizeHandle } from './Table.resize';
import type { TableResizeHandleProps } from './Table.resize';
import { SELECTION_CELL_CLASSES, TableSelectionControl, TableSortButton } from './Table.shared';
import type { SortDirection } from './Table.shared';

export type { TableSize };

/** The fill a `Table.Row` draws, by `appearance`: `none` (no fill of its own), `brand` or `neutral`. */
export type TableRowAppearance = 'none' | 'brand' | 'neutral';

/** Properties for the Table component. */
export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * The density of the table: `'medium'` (the default; a one-line row is 44px tall), `'small'`
   * (34px) or `'extra-small'` (24px, with the caption type size in the cells). It sets the
   * padding of the cells, the header cells, the sort buttons and the selection cells, and the box
   * of the media of a `Table.CellLayout` (an Avatar 32, 24 or 20px). A class of your own on a
   * part still wins. Rendered as `data-size` on the table. Fluent's `size`.
   * @default 'medium'
   */
  size?: TableSize;
  /**
   * Renders only the body rows in view, plus an overscan, of a table with many rows: pass the
   * result of `useVirtualWindow({ itemSize })` (or an object of your own that implements
   * `VirtualWindow`) and give `Table.Body` the number of rows as `count` and a function child that
   * returns the row at an index (`<Table.Body count={n}>{(index) => <Table.Row>…</Table.Row>}`).
   * The rows that are not rendered are replaced by spacer rows (`aria-hidden`,
   * `data-virtual-spacer`) of their height. Fluent has no counterpart in its Table.
   *
   * The table's scroll wrapper (`containerProps`) becomes the window's scroller, so give it a
   * bounded height or maximum height (a class or a style in `containerProps`): without one the
   * window measures the whole list and renders every row (a development warning says so). The
   * wrapper is then always a keyboard-focusable `role="region"` and needs a name (a `<caption>` or
   * `containerProps['aria-label']`). Every body row has the window's `itemSize` as its height (the
   * table sets it on each row, drops the vertical padding of its cells and keeps their text on one
   * line, so a cell's content must fit in it), and the columns are laid out with a fixed table
   * layout: give the columns their widths (a width on the header cells or a `<colgroup>`), as they
   * would otherwise be as wide as the first row makes them. The header stays at the top of the
   * scroller: pass its height as `scrollPaddingStart` to `useVirtualWindow`. A row that holds focus
   * stays rendered when it is scrolled away.
   *
   * The table carries `aria-rowcount` (the header rows, `count` and the rows of a `<tfoot>`), every
   * row `aria-rowindex` (1-based, header rows first) and every body row `data-row-index` (its
   * 0-based index); `striped` follows the row's index. A table without a body that has `count` and
   * a function child ignores the window, with a development warning.
   */
  virtualWindow?: VirtualWindow;
  /**
   * Whether to apply alternating row background colors (odd body rows). The stripe has zero
   * specificity, so a row's own background class (`<Table.Row className="bg-selected">`) and its
   * hover color win over it.
   * @default false
   */
  striped?: boolean;
  /**
   * Props for the wrapper `<div>` around the `<table>`: a horizontally scrollable container
   * (`overflow-x-auto`). Use it for its className, style, ref or `aria-label`. While the table
   * scrolls horizontally, the wrapper is a keyboard-focusable `role="region"` named by
   * `containerProps['aria-label']`/`['aria-labelledby']`, else by the table's `<caption>`. While
   * it does not scroll, the wrapper has no role and its `aria-label`/`aria-labelledby` are left
   * off, unless you also pass a `role` in `containerProps` (then they are always applied).
   */
  containerProps?: Omit<React.ComponentPropsWithRef<'div'>, 'children'>;
  /** Table caption, header, body and row elements. */
  children: React.ReactNode;
  /** Ref to the `<table>` element. */
  ref?: React.Ref<HTMLTableElement>;
}

/** Properties for the TableHeader sub-component. */
export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Table header row elements. */
  children: React.ReactNode;
  /** Ref to the `<thead>` element. */
  ref?: React.Ref<HTMLTableSectionElement>;
}

/** Properties for the TableHeaderCell sub-component. */
export interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /**
   * Makes the column header a sort control: the content is wrapped in a `<button>` that fills the
   * cell, and the cell carries `aria-sort` (`"none"` while `sortDirection` is not set). The table
   * does not sort or track the direction; keep it in your state, set `sortDirection` and sort the
   * rows in `onSortClick`. The table keeps no grid semantics.
   * @default false
   */
  sortable?: boolean;
  /**
   * The direction the column is sorted in, shown as `aria-sort` and as the glyph of a sortable
   * header. Absent means the column is not sorted. Without `sortable` it has no effect.
   */
  sortDirection?: SortDirection;
  /**
   * Called with the click event when the sort button is activated (click, Enter or Space).
   * Fluent's `onSortClick`.
   */
  onSortClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * The glyph that shows the direction, only while `sortDirection` is set. It is decorative
   * (`aria-hidden`) and carries `data-direction`. `null` and `undefined` keep the default arrow
   * (up for ascending, down for descending); `false` or anything that renders nothing hides it. A
   * `<button>` or `Button` passed here is not nested: its children become the glyph.
   */
  sortIcon?: Slot<'span'>;
  /**
   * Content beside the header content, outside the sort button (a filter button, an info
   * button), so it is not part of the button's name. Nothing renders for content that renders
   * nothing.
   */
  aside?: Slot<'span'>;
  /**
   * Props for the element the header cell draws around its content, by part, merged into the
   * part's own (Fluent UI's `button` slot prop): your classes after the part's (yours win a
   * conflict), your styles over its styles, your handlers before its handlers, your ids added to
   * its `aria-labelledby` and `aria-describedby`, and your ref on the element. Every attribute the
   * cell sets on the part is locked and keeps the cell's value; you add the attributes it does not
   * set. A part takes no `children`: the cell's children fill it, and `sortIcon` and `aside` are
   * slots of their own.
   */
  slotProps?: {
    /**
     * The sort `<button>` of a `sortable` header, around the content and the direction glyph
     * (stable class `wave-table-header-cell__button`); a header that is not sortable draws none.
     * Locked: `type` and its click handler (your `onClick` runs first, and `preventDefault()` in
     * it skips `onSortClick`), and unset `role`, `tabIndex`, `disabled`, `contentEditable`,
     * `hidden`, `inert`, `aria-hidden` and the markers a grid's keyboard navigation reads
     * (`data-roving-container`, `data-grid-auxiliary`). The direction is the cell's `aria-sort`.
     */
    button?: SlotPart<'button'>;
  };
  /** Header cell content. */
  children: React.ReactNode;
  /** Ref to the `<th>` element. */
  ref?: React.Ref<HTMLTableCellElement>;
}

/** Properties for the TableBody sub-component. */
export interface TableBodyProps extends Omit<
  React.HTMLAttributes<HTMLTableSectionElement>,
  'children'
> {
  /**
   * The number of rows, for a body whose child is a function. The function is called with an index
   * from 0 to `count - 1`: with the table's `virtualWindow` only for the rows in view, otherwise
   * for every row. Ignored (with a development warning) when the child is not a function.
   */
  count?: number;
  /**
   * Table row elements, or a function that returns the row at an index (with `count`): a row
   * returned with a `key` keeps it (rows are keyed by their index otherwise), so key a row by its
   * data's id when the rows can reorder.
   */
  children: React.ReactNode | ((index: number) => React.ReactNode);
  /** Ref to the `<tbody>` element. */
  ref?: React.Ref<HTMLTableSectionElement>;
}

/** Properties for the TableRow sub-component. */
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * The fill the row draws: `'brand'` the selected token and `'neutral'` the subtle selected
   * token (the two fills a DataGrid gives a selected row), kept while the row is hovered;
   * `'none'` draws none (the row's hover color only). The table keeps no selection, so set it
   * from your rows' state: `appearance={selected ? 'brand' : 'none'}`. Your own background class
   * wins over it. Rendered as `data-appearance`. Fluent's `appearance`.
   * @default 'none'
   */
  appearance?: TableRowAppearance;
  /** Table cell elements. */
  children: React.ReactNode;
  /** Ref to the `<tr>` element. */
  ref?: React.Ref<HTMLTableRowElement>;
}

/** Properties for the TableCell sub-component. */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Cell content. */
  children: React.ReactNode;
  /** Ref to the `<td>` element. */
  ref?: React.Ref<HTMLTableCellElement>;
}

/** Second argument of `Table.SelectionCell`'s `onCheckedChange`: the event behind the change. */
export interface TableSelectionCellCheckedChangeDetails {
  /**
   * The DOM event behind the change: the click of the control (Space clicks it too), for an
   * uncontrolled radio the click that checked another radio of its group, or the form's `reset`
   * event when a form reset restores `defaultChecked`.
   */
  event: Event;
}

/**
 * Properties for the TableSelectionCell sub-component. The focus, key and change handlers are the
 * control's (C-ROUTING), so they replace the cell's.
 */
export interface TableSelectionCellProps extends Omit<
  React.TdHTMLAttributes<HTMLTableCellElement>,
  'children' | 'defaultChecked' | 'onChange' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp'
> {
  /**
   * The control: a checkbox (multiple selection, or a select-all in the header) or a radio (single
   * selection).
   * @default 'checkbox'
   */
  type?: 'checkbox' | 'radio';
  /**
   * Controlled checked state. `'mixed'` draws an indeterminate checkbox (a select-all whose rows
   * are partly selected); a click on it checks it. `'mixed'` is for checkboxes only: on a radio it
   * has no effect (the radio is drawn unchecked).
   */
  checked?: boolean | 'mixed';
  /**
   * Initial checked state for uncontrolled usage, also the state a form reset restores.
   * Uncontrolled radios that share a `name` uncheck each other, as a native radio group does.
   * @default false
   */
  defaultChecked?: boolean | 'mixed';
  /**
   * Called with the new checked state when the user checks or unchecks the control (not for no-op
   * updates), and when a form reset restores a `true` or `false` `defaultChecked`. The second
   * argument holds the event; WaveUI always passes it. The table keeps no selection: update your
   * rows' state here.
   */
  onCheckedChange?: (checked: boolean, details: TableSelectionCellCheckedChangeDetails) => void;
  /**
   * The native change event of the control, called before `onCheckedChange`;
   * `event.preventDefault()` in it cancels the change.
   */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Form field name of the control. With a name, the control submits `name=value` while checked. */
  name?: string;
  /**
   * Value the control submits while checked.
   * @default 'on'
   */
  value?: string;
  /** Id of the form the control belongs to, when the table is rendered outside that form. */
  form?: string;
  /** Natively disables the control: it cannot be checked or focused. */
  disabled?: boolean;
  /** The form must not be submitted while the control is unchecked (native validation). */
  required?: boolean;
  /**
   * Draws an unchecked control only while its row (a `Table.Row`) is hovered or holds focus; its
   * own keyboard focus, forced colors and a coarse pointer (touch) always draw it. It stays
   * focusable and named.
   * @default false
   */
  subtle?: boolean;
  /**
   * Hides the control and takes it out of the tab order, while the cell keeps its box (a row that
   * cannot be selected keeps the column aligned).
   * @default false
   */
  invisible?: boolean;
  /** Focus handler of the control. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Blur handler of the control. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Keydown handler of the control. */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Keyup handler of the control. */
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  /**
   * Props for the control inside the cell, by part, merged into the part's own (Fluent UI's
   * `checkboxIndicator` and `radioIndicator` slot props stand for it): your classes after the
   * part's (yours win a conflict), your styles over its styles, your handlers before its
   * handlers, your ids added to its `aria-labelledby` and `aria-describedby`, and your ref beside
   * its ref. Every attribute the cell sets on the control is locked and keeps the cell's value
   * (set it through the cell's own props); you add the attributes it does not set. A part takes
   * no `children`.
   */
  slotProps?: {
    /**
     * The `<input type="checkbox">` or `<input type="radio">`, the focusable control (stable
     * class `wave-table-selection-cell__control`; `controlRef` reaches it as well). Locked:
     * `type` and the checked state (with `defaultChecked`, `defaultValue` and `aria-checked`
     * unset: the control is controlled and natively checked), every prop the cell routes to it
     * (`id`, `name`, `value`, `form`, `disabled`, `required`, `autoFocus`, `tabIndex`, the
     * naming and other ARIA attributes, the focus and key handlers), and unset `role`,
     * `contentEditable`, `hidden`, `inert`, `aria-hidden` and the markers a grid's keyboard
     * navigation reads (`data-roving-container`, `data-grid-auxiliary`). Your handlers run
     * before the cell's: `preventDefault()` in your `onChange` cancels the change, its own
     * `onChange` and `onCheckedChange` included, and in your `onFocus`, `onBlur`, `onKeyDown` or
     * `onKeyUp` it skips the cell's prop of that event. A disabled control is natively disabled
     * and calls no click handler, yours included.
     */
    control?: SlotPart<'input'>;
  };
  /** Ref to the `<input>` element. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the `<td>` element. */
  ref?: React.Ref<HTMLTableCellElement>;
}

/** Properties for the TableCellLayout sub-component. */
export interface TableCellLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A picture before the text: an icon (drawn at 20px, 24px with the primary appearance) or an
   * Avatar, which takes a 32px box when it sets no `size` of its own. It is content, not hidden
   * from assistive technology: make an Avatar beside the person's name decorative.
   */
  media?: Slot<'span'>;
  /** A second line under the main text, in the caption size and the muted color. */
  description?: Slot<'span'>;
  /**
   * Keeps the main text and the description on one line each, ending in an ellipsis where they do
   * not fit. It takes effect where the column's width is bounded (a width on the column, or a
   * table layout that does not widen columns to fit their content).
   * @default false
   */
  truncate?: boolean;
  /**
   * `'primary'` draws the main text semibold and the media icon larger: the cell that names the
   * row. Rendered as `data-appearance` while set.
   */
  appearance?: 'primary';
  /**
   * Props for the elements the layout draws around its text, by part, merged into each part's
   * own (Fluent UI's `wrapper` and `main` slot props): your classes after the part's (yours win
   * a conflict), your styles over its styles, your handlers and attributes added, and your ref
   * on the element. A part takes no `children`: the layout draws the text, and `media` and
   * `description` are slots of their own.
   *
   * Each part locks, unset, `role`, `tabIndex` and `contentEditable` (each would make the text a
   * widget of a grid cell, which then takes another focus target), `aria-label` (it would replace
   * the text where the cell names something, such as a DataGrid row's selection control),
   * `data-roving-container` (it would make the cell's content a nested composite of a grid) and
   * `hidden`, `inert` and `aria-hidden`. The layout handles no event: an event on a part reaches
   * the cell after yours.
   */
  slotProps?: {
    /**
     * The `<div>` around the main text and the description, drawn while either renders content
     * (stable class `wave-table-cell-layout__content`).
     */
    content?: SlotPart<'div'>;
    /**
     * The `<span>` around the main text, the children, drawn while they render content (stable
     * class `wave-table-cell-layout__main`).
     */
    main?: SlotPart<'span'>;
  };
  /** The main text. */
  children?: React.ReactNode;
  /** Ref to the layout `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the TableCellActions sub-component. */
export interface TableCellActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Keeps the actions shown, also while the row is neither hovered nor focused: for example while
   * a menu opened from one of them is open.
   * @default false
   */
  visible?: boolean;
  /** The actions: buttons, a menu button. */
  children?: React.ReactNode;
  /** Ref to the `<div>` that holds the actions. */
  ref?: React.Ref<HTMLDivElement>;
}

const noopSubscribe = () => () => {};

/**
 * Whether `wrapper` scrolls horizontally, as an external store: a `ResizeObserver` on the wrapper
 * and the table re-checks `scrollWidth > clientWidth`. Without `ResizeObserver` (server, old
 * browsers, jsdom) the value is read on each render.
 */
function useHorizontalOverflow(wrapper: HTMLDivElement | null): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!wrapper || typeof ResizeObserver === 'undefined') return () => {};
      const observer = new ResizeObserver(onChange);
      observer.observe(wrapper);
      for (const child of Array.from(wrapper.children)) observer.observe(child);
      return () => observer.disconnect();
    },
    [wrapper],
  );
  const getSnapshot = React.useCallback(
    () => (wrapper ? wrapper.scrollWidth > wrapper.clientWidth : false),
    [wrapper],
  );
  return React.useSyncExternalStore(wrapper ? subscribe : noopSubscribe, getSnapshot, () => false);
}

/** A row count: a whole number, at least 0 (0 when it is not finite). */
function toRowCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function isCaption(node: React.ReactNode): node is React.ReactElement<{ id?: string }> {
  return isElementOfType(node, 'caption');
}

// The component-level JSDoc sits on the exported `Table` below.
const TableRoot = ({
  striped = false,
  size = 'medium',
  virtualWindow,
  containerProps,
  children,
  className,
  ref,
  ...props
}: TableProps) => {
  const {
    className: containerClassName,
    ref: containerRef,
    'aria-label': containerLabel,
    'aria-labelledby': containerLabelledBy,
    ...containerRest
  } = containerProps ?? {};

  // Name the scroll region after the caption (also one inside a Fragment): keep its id, or give it
  // one. The flattened children are then rendered under their flattened keys.
  const generatedCaptionId = useId('wave-table-caption');
  const flatChildren = flattenChildren(children);

  // --- window (a `Table.Body` with `count` and a function child) -----------------
  const childOf = (...types: unknown[]) =>
    flatChildren.find(({ node }) => isElementOfType(node, ...types))?.node;
  const headerChild = childOf(TableHeader, 'thead');
  const footerChild = childOf('tfoot');
  const bodyChild = childOf(TableBody);
  const bodyProps = isElementOfType<TableBodyProps>(bodyChild, TableBody)
    ? bodyChild.props
    : undefined;
  const bodyCount =
    typeof bodyProps?.children === 'function' && typeof bodyProps.count === 'number'
      ? toRowCount(bodyProps.count)
      : null;
  const windowActive = virtualWindow !== undefined && bodyCount !== null;
  const windowIgnored = virtualWindow !== undefined && !windowActive;
  const headerRowCount = isElementOfType<{ children?: React.ReactNode }>(
    headerChild,
    TableHeader,
    'thead',
  )
    ? countRows(headerChild.props.children)
    : 0;
  // Not memoised: the table's children are new elements at every render of the table anyway.
  const windowContext: TableWindowContextValue | null =
    windowActive && virtualWindow ? { virtualWindow, headerRowCount, striped } : null;
  const footerNode =
    windowActive &&
    bodyCount !== null &&
    React.isValidElement<{ children?: React.ReactNode }>(footerChild)
      ? React.cloneElement(
          footerChild,
          undefined,
          withRowIndexes(footerChild.props.children, headerRowCount + bodyCount + 1),
        )
      : null;
  const footerRowCount =
    footerNode && React.isValidElement<{ children?: React.ReactNode }>(footerChild)
      ? countRows(footerChild.props.children)
      : 0;

  const [wrapper, setWrapper] = React.useState<HTMLDivElement | null>(null);
  const wrapperRef = useMergedRefs<HTMLDivElement>(
    containerRef,
    setWrapper,
    windowActive ? virtualWindow?.scrollRef : undefined,
  );
  const scrollable = useHorizontalOverflow(wrapper);
  /** Whether the wrapper scrolls: sideways, or up and down through the window. */
  const scrolls = scrollable || windowActive;
  const captionIndex = flatChildren.findIndex(({ node }) => isCaption(node));
  const caption =
    captionIndex >= 0
      ? (flatChildren[captionIndex].node as React.ReactElement<{ id?: string }>)
      : null;
  const captionId = caption ? (caption.props.id ?? generatedCaptionId) : undefined;
  const nameCaption = caption !== null && caption.props.id === undefined;
  const content =
    nameCaption || footerNode
      ? flatChildren.map(({ key, node }, index) => (
          <React.Fragment key={key}>
            {nameCaption && index === captionIndex
              ? React.cloneElement(caption, { id: generatedCaptionId })
              : footerNode && node === footerChild
                ? footerNode
                : node}
          </React.Fragment>
        ))
      : children;

  const regionLabelledBy = containerLabel ? undefined : (containerLabelledBy ?? captionId);
  const named = Boolean(containerLabel || regionLabelledBy);
  const isRegion = scrolls && named;
  /** A role the consumer gave the wrapper: their name goes with it even while nothing scrolls. */
  const consumerRole = containerRest.role;

  React.useEffect(() => {
    if (scrollable && !named) {
      warnOnce(
        'Table:unnamed-scroll-region',
        'Table: the table scrolls horizontally but its scroll region has no name. Add a <caption> or containerProps["aria-label"].',
      );
    }
  }, [scrollable, named]);

  React.useEffect(() => {
    if (windowActive && !named) {
      warnOnce(
        'Table:unnamed-window-region',
        'Table: a table with a `virtualWindow` scrolls vertically but its scroll region has no name. Add a <caption> or containerProps["aria-label"].',
      );
    }
  }, [windowActive, named]);

  React.useEffect(() => {
    if (windowIgnored) {
      warnOnce(
        'Table:virtual-window-requires-count',
        'Table: `virtualWindow` needs a `Table.Body` with `count` and a function child that returns ' +
          'the row at an index; it is ignored, and every row is rendered.',
      );
    }
  }, [windowIgnored]);

  // Once mounted, and again once the table has rows: a scroller as tall as its rows (no bounded
  // height) lets the window measure the whole list, so it would render every row.
  const hasRows = (bodyCount ?? 0) > 0;
  React.useEffect(() => {
    if (!isDev || !windowActive || !wrapper) return;
    const { clientHeight, scrollHeight } = wrapper;
    const hasSpacer = wrapper.querySelector('[data-virtual-spacer]') !== null;
    const tableHeight = (wrapper.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    if (
      clientHeight > 0 &&
      scrollHeight > 0 &&
      scrollHeight <= clientHeight &&
      tableHeight >= clientHeight &&
      hasSpacer
    ) {
      warnOnce(
        'Table:virtual-window-height',
        'Table: the scroll wrapper of a table with `virtualWindow` has no bounded height (it is as ' +
          'tall as its rows), so the window renders every row. Give it a height or a maximum height ' +
          'in `containerProps` (a class or a style).',
      );
    }
  }, [windowActive, wrapper, hasRows]);

  return (
    <div
      {...containerRest}
      ref={wrapperRef}
      role={isRegion ? 'region' : consumerRole}
      tabIndex={scrolls ? 0 : containerRest.tabIndex}
      aria-label={scrolls || consumerRole !== undefined ? containerLabel : undefined}
      aria-labelledby={
        isRegion ? regionLabelledBy : consumerRole !== undefined ? containerLabelledBy : undefined
      }
      className={wcn(
        tableClassNames.container,
        'wave:overflow-x-auto wave:rounded-md wave:border wave:border-border',
        scrolls && focusRing,
        // The window lays the rows out: the browser's scroll anchoring only fights it.
        windowActive && 'wave:[overflow-anchor:none]',
        containerClassName,
      )}
    >
      <table
        ref={ref}
        data-striped={striped ? '' : undefined}
        data-size={size}
        // With a window: every row of the data, rendered or not, the header and the footer.
        aria-rowcount={
          windowActive && bodyCount !== null
            ? headerRowCount + bodyCount + footerRowCount
            : undefined
        }
        className={wcn(
          tableClassNames.root,
          'wave:w-full wave:border-separate wave:border-spacing-0',
          // The columns never change width as rows come and go.
          windowActive && 'wave:table-fixed',
          // `:where()` keeps the stripe at specificity 0, so any row class wins (C-CLASS). In a
          // window the rows draw it from their index (the spacer rows would shift the parity).
          striped && !windowActive && 'wave:[:where(&>tbody>tr:nth-child(odd))]:bg-card',
          className,
        )}
        {...props}
      >
        <TableSizeContext.Provider value={size}>
          {/* Reset for a table nested in a cell: its rows are not the outer row. */}
          <TableWindowContext.Provider value={windowContext}>
            <TableWindowRowContext.Provider value={null}>{content}</TableWindowRowContext.Provider>
          </TableWindowContext.Provider>
        </TableSizeContext.Provider>
      </table>
    </div>
  );
};
TableRoot.displayName = 'Table';

/**
 * The table's `<thead>`. In a table with a `virtualWindow` it stays at the top of the scroll wrapper
 * while the rows scroll under it, and each header row carries its `aria-rowindex`.
 */
const TableHeader = ({ children, className, ref, ...rest }: TableHeaderProps) => {
  const windowContext = React.useContext(TableWindowContext);
  return (
    <thead
      ref={ref}
      {...rest}
      className={wcn(
        tableHeaderClassNames.root,
        'wave:bg-card',
        // A header cell is positioned for its resize handle: the section is the sticky one.
        windowContext && 'wave:sticky wave:top-0 wave:z-1',
        className,
      )}
    >
      {windowContext ? withRowIndexes(children, 1) : children}
    </thead>
  );
};
TableHeader.displayName = 'TableHeader';

/** A column header cell (`<th scope="col">`). */
const TableHeaderCell = ({
  sortable = false,
  sortDirection,
  onSortClick,
  sortIcon,
  aside,
  slotProps,
  children,
  className,
  ref,
  ...props
}: TableHeaderCellProps) => {
  const size = useTableSize();
  const hasAside = slotRendersContent(aside);
  const asideNode = hasAside
    ? renderSlot(
        aside,
        'span',
        wcn(
          tableHeaderCellClassNames.aside,
          'wave:inline-flex wave:shrink-0 wave:items-center',
          sortable && 'wave:pe-4',
        ),
      )
    : null;

  let content: React.ReactNode = children;
  if (sortable) {
    content = (
      <div className="wave:flex wave:items-center">
        <TableSortButton
          component="Table.HeaderCell"
          direction={sortDirection}
          sortIcon={sortIcon}
          className={tableHeaderCellClassNames.button}
          iconClassName={tableHeaderCellClassNames.sortIcon}
          onClick={onSortClick}
          part={slotProps?.button}
        >
          {children}
        </TableSortButton>
        {asideNode}
      </div>
    );
  } else if (hasAside) {
    content = (
      <div className="wave:flex wave:items-center wave:gap-2">
        {children}
        {asideNode}
      </div>
    );
  }

  return (
    <th
      ref={ref}
      scope="col"
      aria-sort={sortable ? (sortDirection ?? 'none') : undefined}
      className={wcn(
        tableHeaderCellClassNames.root,
        'wave:px-4 wave:py-3 wave:text-start wave:font-semibold wave:text-caption-1 wave:uppercase wave:tracking-wider wave:border-b wave:border-border',
        TABLE_SIZE_CLASSES.header[size],
        sortable && 'wave:p-0 wave:hover:bg-subtle-hover',
        className,
      )}
      {...props}
    >
      {content}
    </th>
  );
};
TableHeaderCell.displayName = 'TableHeaderCell';

/**
 * The table's `<tbody>`. Its child can also be a function, called with the index of each row of
 * `count` rows to render the row: in a table with a `virtualWindow` for the rows in view only, with
 * a spacer row for each run of rows it leaves out (a row that holds focus stays rendered).
 */
const TableBody = ({
  count,
  children,
  className,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TableBodyProps) => {
  const windowContext = React.useContext(TableWindowContext);
  // The body row that holds focus stays rendered while it is scrolled out of the window.
  const [keptIndex, setKeptIndex] = React.useState<number | null>(null);
  const renderRow = typeof children === 'function' ? children : null;
  const sizeless = renderRow !== null && count === undefined;
  const unneededCount = renderRow === null && count !== undefined;
  React.useEffect(() => {
    if (sizeless) {
      warnOnce(
        'Table.Body:count',
        'Table.Body: a function child renders one row per index below `count`, which is not set, ' +
          'so the body has no rows.',
      );
    } else if (unneededCount) {
      warnOnce(
        'Table.Body:count-without-function',
        'Table.Body: `count` is ignored unless the child is a function that returns the row at an index.',
      );
    }
  }, [sizeless, unneededCount]);

  let content: React.ReactNode = typeof children === 'function' ? null : children;
  if (renderRow && count !== undefined) {
    const total = toRowCount(count);
    const rowAt = (index: number) => {
      const node = renderRow(index);
      const key = React.isValidElement(node) && node.key !== null ? node.key : index;
      return { key: `row:${key}`, node };
    };
    if (windowContext) {
      const { virtualWindow, headerRowCount, striped } = windowContext;
      content = virtualWindow
        .layout(total, { keep: keptIndex === null ? [] : [keptIndex] })
        .map((entry) => {
          if (entry.kind !== 'item')
            return <TableSpacerRow key={`spacer:${entry.key}`} size={entry.size} />;
          const { key, node } = rowAt(entry.index);
          return (
            <TableWindowRowContext.Provider
              key={key}
              value={{
                index: entry.index,
                ariaRowIndex: entry.index + headerRowCount + 1,
                height: virtualWindow.itemSize,
                striped: striped && entry.index % 2 === 0,
              }}
            >
              {node}
            </TableWindowRowContext.Provider>
          );
        });
    } else {
      content = Array.from({ length: total }, (_, index) => {
        const { key, node } = rowAt(index);
        return <React.Fragment key={key}>{node}</React.Fragment>;
      });
    }
  }

  const trackFocus = windowContext !== null;
  return (
    <tbody
      ref={ref}
      {...rest}
      className={wcn(tableBodyClassNames.root, className)}
      onFocus={
        trackFocus
          ? composeEventHandlers(
              onFocus,
              (event) => {
                const row = (event.target as Element).closest('tr[data-row-index]');
                const index = Number(row?.getAttribute('data-row-index'));
                if (row && event.currentTarget.contains(row) && Number.isInteger(index)) {
                  setKeptIndex(index);
                }
              },
              { checkDefaultPrevented: false },
            )
          : onFocus
      }
      onBlur={
        trackFocus
          ? composeEventHandlers(
              onBlur,
              (event) => {
                const next = event.relatedTarget;
                if (!(next instanceof Node && event.currentTarget.contains(next)))
                  setKeptIndex(null);
              },
              { checkDefaultPrevented: false },
            )
          : onBlur
      }
    >
      {content}
    </tbody>
  );
};
TableBody.displayName = 'TableBody';

/**
 * The fill of a row by `appearance`. The hover word is the row's own hover word, replaced, so a
 * filled row keeps its fill while it is hovered; `forcedColors.selectedContainer` outlines it
 * where forced colors drop the fill.
 */
const ROW_APPEARANCE_CLASSES: Record<TableRowAppearance, string | undefined> = {
  none: undefined,
  brand: 'wave:bg-selected wave:hover:bg-selected',
  neutral: 'wave:bg-subtle-selected wave:hover:bg-subtle-selected',
};

/**
 * A table row. Striping comes from the table (`striped`), so rows need no context. The row is the
 * `group/table-row` group whose hover or focus draws the subtle selection controls and the cell
 * actions inside it (Tree's rows keep their own group). `appearance` fills it (`brand` or
 * `neutral`, as a DataGrid fills a selected row); it carries `data-appearance`.
 */
const TableRow = ({
  appearance = 'none',
  children,
  className,
  style,
  ref,
  ...props
}: TableRowProps) => {
  // In a table with a `virtualWindow`: the row's place and, for a body row, its fixed height.
  const windowRow = React.useContext(TableWindowRowContext);
  return (
    <tr
      ref={ref}
      data-appearance={appearance}
      className={wcn(
        tableRowClassNames.root,
        'wave:group/table-row',
        'wave:hover:bg-subtle-hover wave:transition-colors wave:motion-reduce:transition-none',
        // The stripe of a windowed table, at specificity 0 as the table's own (a class wins).
        windowRow?.striped && 'wave:[:where(&)]:bg-card',
        ROW_APPEARANCE_CLASSES[appearance],
        appearance !== 'none' && forcedColors.selectedContainer,
        className,
      )}
      {...props}
      // The window lays the rows out at its row height and finds them by their index.
      style={windowRow?.height === undefined ? style : { ...style, height: windowRow.height }}
      {...(windowRow && {
        'aria-rowindex': windowRow.ariaRowIndex,
        'data-row-index': windowRow.index,
      })}
    >
      {children}
    </tr>
  );
};
TableRow.displayName = 'TableRow';

/** A data cell (`<td>`), the positioning box of a `Table.CellActions` inside it. */
const TableCell = ({ children, className, ref, ...props }: TableCellProps) => {
  const size = useTableSize();
  // A body row of a windowed table has the window's height: no block padding, one line of text.
  const windowedRow = React.useContext(TableWindowRowContext)?.index !== undefined;
  return (
    <td
      ref={ref}
      className={wcn(
        tableCellClassNames.root,
        'wave:relative wave:px-4 wave:py-3 wave:text-body-1 wave:border-b wave:border-border',
        TABLE_SIZE_CLASSES.cell[size],
        windowedRow &&
          'wave:py-0 wave:align-middle wave:overflow-hidden wave:text-ellipsis wave:whitespace-nowrap',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
};
TableCell.displayName = 'TableCell';

/**
 * A selection cell: a `<td>` with a native checkbox or radio (`type`), drawn as the DataGrid's.
 * The table keeps no selection, so the cell is usually controlled (`checked`, `onCheckedChange`)
 * from your rows' state; `checked="mixed"` draws a header select-all whose rows are partly
 * selected. `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, the other ARIA state
 * props, `autoFocus`, `tabIndex`, the focus, key and change handlers and `name`, `value`, `form`,
 * `disabled` and `required` go to the control (`controlRef`); `className`, `style`, `data-*`, the
 * other handlers and `ref` stay on the cell, which carries `data-type`. Name the control with
 * `aria-label` or `aria-labelledby` (the row's first cell); a development warning reports a
 * control without a name.
 */
const TableSelectionCell = ({
  type = 'checkbox',
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  onChange,
  name,
  value,
  form,
  disabled,
  required,
  subtle = false,
  invisible = false,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  autoFocus,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  slotProps,
  controlRef,
  className,
  ref,
  ...rest
}: TableSelectionCellProps) => {
  // The details of the change being made, set around the setter.
  const detailsRef = React.useRef<TableSelectionCellCheckedChangeDetails | undefined>(undefined);
  const [checked, setChecked, isControlled] = useControllable<boolean | 'mixed'>(
    checkedProp,
    defaultChecked,
    (next) => {
      // Only a form reset to a mixed `defaultChecked` sets `'mixed'`; the callback reports booleans.
      const details = detailsRef.current;
      if (next !== 'mixed' && details) onCheckedChange?.(next, details);
    },
  );
  const changeChecked = useEventCallback((next: boolean | 'mixed', event: Event) => {
    detailsRef.current = { event };
    try {
      setChecked(next);
    } finally {
      detailsRef.current = undefined;
    }
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedControlRef = useMergedRefs<HTMLInputElement>(inputRef, controlRef);
  const size = useTableSize();
  const windowedRow = React.useContext(TableWindowRowContext)?.index !== undefined;
  // A form reset reports the form's `reset` event.
  useFormReset(inputRef, (event) => changeChecked(defaultChecked, event), form);

  // A native radio group unchecks its other radios without an event, so an uncontrolled radio
  // listens for the click that checks another radio of its group: in the capture phase, before
  // React restores its controlled inputs from that click.
  const followsGroup = type === 'radio' && !isControlled && Boolean(name);
  React.useEffect(() => {
    const input = inputRef.current;
    if (!followsGroup || !input) return;
    const root = input.getRootNode();
    const handleClick = (event: Event) => {
      const target = event.target;
      if (target === input || !(target instanceof HTMLInputElement) || target.type !== 'radio') {
        return;
      }
      if (target.name === input.name && target.form === input.form && target.checked) {
        changeChecked(false, event);
      }
    };
    root.addEventListener('click', handleClick, true);
    return () => root.removeEventListener('click', handleClick, true);
  }, [followsGroup, changeChecked]);

  // Development diagnostics (C-DEV): a control needs a name; a `<label for>` gives one too.
  React.useEffect(() => {
    const input = inputRef.current;
    if (!isDev || !input || ariaLabel || ariaLabelledBy || (input.labels?.length ?? 0) > 0) return;
    warnOnce(
      'Table.SelectionCell:name',
      'Table.SelectionCell: the selection control has no accessible name. Pass `aria-label` ' +
        '(e.g. "Select Alpha") or `aria-labelledby` (e.g. the id of the row’s first cell).',
    );
  }, [ariaLabel, ariaLabelledBy, id]);

  return (
    <td
      ref={ref}
      data-type={type}
      {...rest}
      className={wcn(
        tableSelectionCellClassNames.root,
        SELECTION_CELL_CLASSES,
        TABLE_SIZE_CLASSES.selectionCell[size],
        windowedRow && 'wave:py-0 wave:align-middle',
        className,
      )}
    >
      <TableSelectionControl
        ref={mergedControlRef}
        type={type}
        checked={checked}
        subtle={subtle}
        invisible={invisible}
        id={id}
        name={name}
        value={value}
        form={form}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onChange={composeEventHandlers(onChange, (event) =>
          changeChecked(event.currentTarget.checked, event.nativeEvent),
        )}
        className={tableSelectionCellClassNames.control}
        part={slotProps?.control}
      />
    </td>
  );
};
TableSelectionCell.displayName = 'TableSelectionCell';

/** The box an Avatar in a cell layout's `media` takes when it sets no `size`, by table size. */
const CELL_LAYOUT_AVATAR_BOXES: Record<TableSize, AvatarSizeContextValue> = {
  medium: { size: 32 },
  small: { size: 24 },
  'extra-small': { size: 20 },
};

/** The media box by appearance and table size: its icon at 20px (24px primary) in a medium table. */
const CELL_LAYOUT_MEDIA_CLASSES = {
  default: {
    medium: 'wave:flex wave:shrink-0 wave:items-center wave:[&>svg]:size-5',
    small: 'wave:flex wave:shrink-0 wave:items-center wave:[&>svg]:size-5',
    'extra-small': 'wave:flex wave:shrink-0 wave:items-center wave:[&>svg]:size-4',
  },
  primary: {
    medium: 'wave:flex wave:shrink-0 wave:items-center wave:[&>svg]:size-6',
    small: 'wave:flex wave:shrink-0 wave:items-center wave:[&>svg]:size-5',
    'extra-small': 'wave:flex wave:shrink-0 wave:items-center wave:[&>svg]:size-4',
  },
} as const;

/**
 * What both parts of a cell layout lock unset (it sets no attribute of its own on them): a role,
 * a tab index and `contentEditable` (each makes the text a widget of a grid cell), a name (it
 * would replace the text where the cell names something), the marker of a nested composite of a
 * grid and the hidden state.
 */
const CELL_LAYOUT_PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  contentEditable: undefined,
  'aria-label': undefined,
  'data-roving-container': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/**
 * Lays out a cell's content: `media` (an icon or an Avatar), then the main text (children) with
 * an optional `description` under it. `truncate` keeps both lines to one line each with an
 * ellipsis; `appearance="primary"` draws the main text semibold, for the cell that names the row.
 */
const TableCellLayout = ({
  media,
  description,
  truncate = false,
  appearance,
  slotProps,
  children,
  className,
  ref,
  ...rest
}: TableCellLayoutProps) => {
  const size = useTableSize();
  const hasMedia = slotRendersContent(media);
  const hasMain = slotRendersContent(children);
  const hasDescription = slotRendersContent(description);
  const primary = appearance === 'primary';
  const contentClassName = wcn(
    tableCellLayoutClassNames.content,
    'wave:flex wave:flex-col',
    truncate && 'wave:min-w-0 wave:overflow-x-hidden',
  );
  const mainClassName = wcn(
    tableCellLayoutClassNames.main,
    truncate && 'wave:truncate',
    primary && 'wave:font-semibold',
  );
  return (
    <div
      ref={ref}
      data-appearance={appearance}
      data-truncate={truncate ? '' : undefined}
      {...rest}
      className={wcn(
        tableCellLayoutClassNames.root,
        'wave:flex wave:items-center wave:gap-2',
        truncate && 'wave:overflow-x-hidden',
        className,
      )}
    >
      {hasMedia && (
        // An Avatar without its own `size` takes the 32px box of a table row.
        <AvatarSizeContext.Provider value={CELL_LAYOUT_AVATAR_BOXES[size]}>
          {renderSlot(
            media,
            'span',
            wcn(
              tableCellLayoutClassNames.media,
              CELL_LAYOUT_MEDIA_CLASSES[primary ? 'primary' : 'default'][size],
            ),
          )}
        </AvatarSizeContext.Provider>
      )}
      {(hasMain || hasDescription) && (
        <div
          className={contentClassName}
          {...(slotProps?.content &&
            mergeSlotProps(slotProps.content, {
              className: contentClassName,
              locked: CELL_LAYOUT_PART_LOCKS,
            }))}
        >
          {hasMain && (
            <span
              className={mainClassName}
              {...(slotProps?.main &&
                mergeSlotProps(slotProps.main, {
                  className: mainClassName,
                  locked: CELL_LAYOUT_PART_LOCKS,
                }))}
            >
              {materialiseSlotContent(children)}
            </span>
          )}
          {hasDescription &&
            renderSlot(
              description,
              'span',
              wcn(
                tableCellLayoutClassNames.description,
                'wave:text-caption-1 wave:text-muted-foreground',
                truncate && 'wave:truncate',
              ),
            )}
        </div>
      )}
    </div>
  );
};
TableCellLayout.displayName = 'TableCellLayout';

/**
 * Where cell actions sit, over the end of their cell from its top edge to its bottom edge (the
 * buttons centred between them), and what they draw over the content under them: an opaque
 * background that follows the row's, over the full height of the cell, so wrapped text or a
 * layout with a description never shows above or below the buttons. That is the page background
 * behind a row without a fill, the row's hover color, the stripe of a striped table's odd body
 * rows (as the table's own zero-specificity rule) and the fill of a DataGrid's selected row
 * (brand and neutral appearances).
 */
const CELL_ACTIONS_CLASSES =
  'wave:absolute wave:inset-y-0 wave:end-0 wave:flex wave:items-center wave:gap-1 wave:px-1 wave:bg-background wave:group-hover/table-row:bg-subtle-hover wave:[:where([data-striped]>tbody>tr:nth-child(odd)>*)>&]:bg-card wave:[[data-selection-appearance=brand]>tbody>[data-selected]>*>&]:bg-selected wave:[[data-selection-appearance=neutral]>tbody>[data-selected]>*>&]:bg-subtle-selected wave:[tr[data-appearance=brand]>*>&]:bg-selected wave:[tr[data-appearance=neutral]>*>&]:bg-subtle-selected wave:transition-[opacity,background-color] wave:motion-reduce:transition-none';

/**
 * Transparent until the row is hovered or holds focus, or focus is in the actions themselves;
 * forced colors and a coarse pointer (touch) always draw them.
 */
const CELL_ACTIONS_REVEAL_CLASSES =
  'wave:opacity-0 wave:group-hover/table-row:opacity-100 wave:group-focus-within/table-row:opacity-100 wave:focus-within:opacity-100 wave:forced-colors:opacity-100 wave:pointer-coarse:opacity-100';

/**
 * Actions of a cell (buttons, a menu button), shown over the end of the cell while its row is
 * hovered or holds focus, and always in forced colors and on a coarse pointer (touch); `visible`
 * keeps them shown. They stay in the tab order while hidden, and Tab into them shows them. Place
 * them in a `Table.Cell` or `DataGrid.Cell`, whose row (`Table.Row`, `DataGrid.Row`) is the group
 * that shows them. Their opaque background follows the row's (hover, a striped table's stripe, a
 * DataGrid's selected row); a row with a background of its own needs the same class on its
 * actions. The element carries `data-visible` while `visible` is set.
 */
const TableCellActions = ({ visible = false, className, ref, ...rest }: TableCellActionsProps) => (
  <div
    ref={ref}
    data-visible={visible ? '' : undefined}
    {...rest}
    className={wcn(
      tableCellActionsClassNames.root,
      CELL_ACTIONS_CLASSES,
      visible ? undefined : CELL_ACTIONS_REVEAL_CLASSES,
      className,
    )}
  />
);
TableCellActions.displayName = 'TableCellActions';

export {
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableSelectionCell,
  TableCellLayout,
  TableCellActions,
  TableResizeHandle,
};
export type { TableResizeHandleProps };

/**
 * A non-interactive data table with an optional striped body, in three densities (`size`). The
 * table sits in a horizontally scrollable wrapper; while it scrolls, the wrapper is a focusable region (named by
 * `containerProps` or the `<caption>`) so keyboard users can scroll it.
 *
 * The table keeps no state: a sortable `Table.HeaderCell` reports its clicks, and a
 * `Table.SelectionCell` (a native checkbox or radio) its changes, for your state to sort and
 * select the rows. `Table.CellLayout` lays out a cell's media, text and description, and
 * `Table.CellActions` shows a cell's actions while its row is hovered or holds focus, and a
 * `Table.Row` fills itself with `appearance` (`brand` or `neutral`).
 *
 * A table of many rows renders only the rows in view with a `virtualWindow` (from
 * `useVirtualWindow`), a `count` on `Table.Body` and a function child that returns each row.
 *
 * Sub-components are available as `Table.Header`, `Table.HeaderCell`, `Table.Body`, `Table.Row`,
 * `Table.Cell`, `Table.SelectionCell`, `Table.CellLayout`, `Table.CellActions` and
 * `Table.ResizeHandle` (the separator that resizes a column, for a header cell's `aside`) in client
 * components, and as the flat exports `TableHeader`, `TableHeaderCell`, `TableBody`, `TableRow`,
 * `TableCell`, `TableSelectionCell`, `TableCellLayout`, `TableCellActions` and
 * `TableResizeHandle` (the form React Server Components can import).
 */
export const Table = /* @__PURE__ */ Object.assign(TableRoot, {
  Header: TableHeader,
  HeaderCell: TableHeaderCell,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  SelectionCell: TableSelectionCell,
  CellLayout: TableCellLayout,
  CellActions: TableCellActions,
  ResizeHandle: TableResizeHandle,
});
