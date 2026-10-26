import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
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
import { isDev, warnDeprecated, warnOnce } from '../../lib/dev';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { AvatarSizeContext } from '../data-display/Avatar.context';
import type { AvatarSizeContextValue } from '../data-display/Avatar.context';
import { SELECTION_CELL_CLASSES, TableSelectionControl, TableSortButton } from './Table.shared';
import type { SortDirection } from './Table.shared';

/** Properties for the Table component. */
export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
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
  /** Header cell content. */
  children: React.ReactNode;
  /** Ref to the `<th>` element. */
  ref?: React.Ref<HTMLTableCellElement>;
}

/** @deprecated Use `TableHeaderProps` (`Table.Header`). */
export type TableHeadProps = TableHeaderProps;

/** @deprecated Use `TableHeaderCellProps` (`Table.HeaderCell`). */
export type TableHeadCellProps = TableHeaderCellProps;

/** Properties for the TableBody sub-component. */
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Table row elements. */
  children: React.ReactNode;
  /** Ref to the `<tbody>` element. */
  ref?: React.Ref<HTMLTableSectionElement>;
}

/** Properties for the TableRow sub-component. */
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
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
   * The DOM event behind the change: the click of the control (Space clicks it too), or, for an
   * uncontrolled radio, the click that checked another radio of its group.
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
   * are partly selected); a click on it checks it.
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
   * argument holds the event. The table keeps no selection: update your rows' state here.
   */
  onCheckedChange?: (checked: boolean, details?: TableSelectionCellCheckedChangeDetails) => void;
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
   * Draws an unchecked control only while its row (a `Table.Row`) is hovered or holds focus;
   * forced colors and a coarse pointer (touch) always draw it. It stays focusable and named.
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

function isCaption(node: React.ReactNode): node is React.ReactElement<{ id?: string }> {
  return isElementOfType(node, 'caption');
}

// The component-level JSDoc sits on the exported `Table` below.
const TableRoot = ({
  striped = false,
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

  const [wrapper, setWrapper] = React.useState<HTMLDivElement | null>(null);
  const wrapperRef = useMergedRefs<HTMLDivElement>(containerRef, setWrapper);
  const scrollable = useHorizontalOverflow(wrapper);

  // Name the scroll region after the caption (also one inside a Fragment): keep its id, or give it
  // one. The flattened children are then rendered under their flattened keys.
  const generatedCaptionId = useId('wave-table-caption');
  const flatChildren = flattenChildren(children);
  const captionIndex = flatChildren.findIndex(({ node }) => isCaption(node));
  const caption =
    captionIndex >= 0
      ? (flatChildren[captionIndex].node as React.ReactElement<{ id?: string }>)
      : null;
  const captionId = caption ? (caption.props.id ?? generatedCaptionId) : undefined;
  const content =
    caption && caption.props.id === undefined
      ? flatChildren.map(({ key, node }, index) => (
          <React.Fragment key={key}>
            {index === captionIndex
              ? React.cloneElement(caption, { id: generatedCaptionId })
              : node}
          </React.Fragment>
        ))
      : children;

  const regionLabelledBy = containerLabel ? undefined : (containerLabelledBy ?? captionId);
  const named = Boolean(containerLabel || regionLabelledBy);
  const isRegion = scrollable && named;
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

  return (
    <div
      {...containerRest}
      ref={wrapperRef}
      role={isRegion ? 'region' : consumerRole}
      tabIndex={scrollable ? 0 : containerRest.tabIndex}
      aria-label={scrollable || consumerRole !== undefined ? containerLabel : undefined}
      aria-labelledby={
        isRegion ? regionLabelledBy : consumerRole !== undefined ? containerLabelledBy : undefined
      }
      className={cn(
        tableClassNames.container,
        'overflow-x-auto rounded-md border border-border',
        scrollable && focusRing,
        containerClassName,
      )}
    >
      <table
        ref={ref}
        data-striped={striped ? '' : undefined}
        className={cn(
          tableClassNames.root,
          'w-full border-separate border-spacing-0',
          // `:where()` keeps the stripe at specificity 0, so any row class wins (C-CLASS).
          striped && '[:where(&>tbody>tr:nth-child(odd))]:bg-card',
          className,
        )}
        {...props}
      >
        {content}
      </table>
    </div>
  );
};
TableRoot.displayName = 'Table';

/** The table's `<thead>`. */
const TableHeader = ({ children, className, ref, ...rest }: TableHeaderProps) => (
  <thead ref={ref} {...rest} className={cn(tableHeaderClassNames.root, 'bg-card', className)}>
    {children}
  </thead>
);
TableHeader.displayName = 'TableHeader';

/** A column header cell (`<th scope="col">`). */
const TableHeaderCell = ({
  sortable = false,
  sortDirection,
  onSortClick,
  sortIcon,
  aside,
  children,
  className,
  ref,
  ...props
}: TableHeaderCellProps) => {
  const hasAside = slotRendersContent(aside);
  const asideNode = hasAside
    ? renderSlot(
        aside,
        'span',
        cn(
          tableHeaderCellClassNames.aside,
          'inline-flex shrink-0 items-center',
          sortable && 'pe-4',
        ),
      )
    : null;

  let content: React.ReactNode = children;
  if (sortable) {
    content = (
      <div className="flex items-center">
        <TableSortButton
          component="Table.HeaderCell"
          direction={sortDirection}
          sortIcon={sortIcon}
          className={tableHeaderCellClassNames.button}
          iconClassName={tableHeaderCellClassNames.sortIcon}
          onClick={onSortClick}
        >
          {children}
        </TableSortButton>
        {asideNode}
      </div>
    );
  } else if (hasAside) {
    content = (
      <div className="flex items-center gap-2">
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
      className={cn(
        tableHeaderCellClassNames.root,
        'px-4 py-3 text-start font-semibold text-caption-1 uppercase tracking-wider border-b border-border',
        sortable && 'p-0 hover:bg-subtle-hover',
        className,
      )}
      {...props}
    >
      {content}
    </th>
  );
};
TableHeaderCell.displayName = 'TableHeaderCell';

/** @deprecated Use `Table.Header` (`TableHeader`). */
const TableHead = (props: TableHeadProps) => {
  warnDeprecated('Table', 'Table.Head', 'Table.Header');
  return <TableHeader {...props} />;
};
TableHead.displayName = 'TableHead';

/** @deprecated Use `Table.HeaderCell` (`TableHeaderCell`). */
const TableHeadCell = (props: TableHeadCellProps) => {
  warnDeprecated('Table', 'Table.HeadCell', 'Table.HeaderCell');
  return <TableHeaderCell {...props} />;
};
TableHeadCell.displayName = 'TableHeadCell';

/** The table's `<tbody>`. */
const TableBody = ({ children, className, ref, ...rest }: TableBodyProps) => (
  <tbody ref={ref} {...rest} className={cn(tableBodyClassNames.root, className)}>
    {children}
  </tbody>
);
TableBody.displayName = 'TableBody';

/**
 * A table row. Striping comes from the table (`striped`), so rows need no context. The row is the
 * `group/table-row` group whose hover or focus draws the subtle selection controls and the cell
 * actions inside it (Tree's rows keep their own group).
 */
const TableRow = ({ children, className, ref, ...props }: TableRowProps) => (
  <tr
    ref={ref}
    className={cn(
      tableRowClassNames.root,
      'group/table-row',
      'hover:bg-subtle-hover transition-colors motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    {children}
  </tr>
);
TableRow.displayName = 'TableRow';

/** A data cell (`<td>`), the positioning box of a `Table.CellActions` inside it. */
const TableCell = ({ children, className, ref, ...props }: TableCellProps) => (
  <td
    ref={ref}
    className={cn(
      tableCellClassNames.root,
      'relative px-4 py-3 text-body-1 border-b border-border',
      className,
    )}
    {...props}
  >
    {children}
  </td>
);
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
      if (next !== 'mixed') onCheckedChange?.(next, detailsRef.current);
    },
  );
  const changeChecked = useEventCallback((next: boolean, event: Event) => {
    detailsRef.current = { event };
    try {
      setChecked(next);
    } finally {
      detailsRef.current = undefined;
    }
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedControlRef = useMergedRefs<HTMLInputElement>(inputRef, controlRef);
  useFormReset(inputRef, () => setChecked(defaultChecked), form);

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
      className={cn(tableSelectionCellClassNames.root, SELECTION_CELL_CLASSES, className)}
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
      />
    </td>
  );
};
TableSelectionCell.displayName = 'TableSelectionCell';

/** The box an Avatar in a cell layout's `media` takes when it sets no `size`. */
const CELL_LAYOUT_AVATAR_BOX: AvatarSizeContextValue = { size: 32 };

/** The media box: its icon at 20px, or 24px with the primary appearance. */
const CELL_LAYOUT_MEDIA_CLASSES = {
  default: 'flex shrink-0 items-center [&>svg]:size-5',
  primary: 'flex shrink-0 items-center [&>svg]:size-6',
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
  children,
  className,
  ref,
  ...rest
}: TableCellLayoutProps) => {
  const hasMedia = slotRendersContent(media);
  const hasMain = slotRendersContent(children);
  const hasDescription = slotRendersContent(description);
  const primary = appearance === 'primary';
  return (
    <div
      ref={ref}
      data-appearance={appearance}
      data-truncate={truncate ? '' : undefined}
      {...rest}
      className={cn(
        tableCellLayoutClassNames.root,
        'flex items-center gap-2',
        truncate && 'overflow-x-hidden',
        className,
      )}
    >
      {hasMedia && (
        // An Avatar without its own `size` takes the 32px box of a table row.
        <AvatarSizeContext.Provider value={CELL_LAYOUT_AVATAR_BOX}>
          {renderSlot(
            media,
            'span',
            cn(
              tableCellLayoutClassNames.media,
              CELL_LAYOUT_MEDIA_CLASSES[primary ? 'primary' : 'default'],
            ),
          )}
        </AvatarSizeContext.Provider>
      )}
      {(hasMain || hasDescription) && (
        <div
          className={cn(
            tableCellLayoutClassNames.content,
            'flex flex-col',
            truncate && 'min-w-0 overflow-x-hidden',
          )}
        >
          {hasMain && (
            <span
              className={cn(
                tableCellLayoutClassNames.main,
                truncate && 'truncate',
                primary && 'font-semibold',
              )}
            >
              {materialiseSlotContent(children)}
            </span>
          )}
          {hasDescription &&
            renderSlot(
              description,
              'span',
              cn(
                tableCellLayoutClassNames.description,
                'text-caption-1 text-muted-foreground',
                truncate && 'truncate',
              ),
            )}
        </div>
      )}
    </div>
  );
};
TableCellLayout.displayName = 'TableCellLayout';

/**
 * Where cell actions sit, over the end of their cell, and what they draw over the content under
 * them: an opaque background that follows the row's. That is the page background behind a row
 * without a fill, the row's hover color, the stripe of a striped table's odd body rows (as the
 * table's own zero-specificity rule) and the fill of a DataGrid's selected row (brand and
 * neutral appearances).
 */
const CELL_ACTIONS_CLASSES =
  'absolute end-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1 bg-background group-hover/table-row:bg-subtle-hover [:where([data-striped]>tbody>tr:nth-child(odd)>*)>&]:bg-card [[data-selection-appearance=brand]>tbody>[data-selected]>*>&]:bg-selected [[data-selection-appearance=neutral]>tbody>[data-selected]>*>&]:bg-subtle-selected transition-[opacity,background-color] motion-reduce:transition-none';

/**
 * Transparent until the row is hovered or holds focus, or focus is in the actions themselves;
 * forced colors and a coarse pointer (touch) always draw them.
 */
const CELL_ACTIONS_REVEAL_CLASSES =
  'opacity-0 group-hover/table-row:opacity-100 group-focus-within/table-row:opacity-100 focus-within:opacity-100 forced-colors:opacity-100 pointer-coarse:opacity-100';

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
    className={cn(
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
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableSelectionCell,
  TableCellLayout,
  TableCellActions,
};

/**
 * A non-interactive data table with an optional striped body. The table sits in a horizontally
 * scrollable wrapper; while it scrolls, the wrapper is a focusable region (named by
 * `containerProps` or the `<caption>`) so keyboard users can scroll it.
 *
 * The table keeps no state: a sortable `Table.HeaderCell` reports its clicks, and a
 * `Table.SelectionCell` (a native checkbox or radio) its changes, for your state to sort and
 * select the rows. `Table.CellLayout` lays out a cell's media, text and description, and
 * `Table.CellActions` shows a cell's actions while its row is hovered or holds focus.
 *
 * Sub-components are available as `Table.Header`, `Table.HeaderCell`, `Table.Body`, `Table.Row`,
 * `Table.Cell`, `Table.SelectionCell`, `Table.CellLayout` and `Table.CellActions` in client
 * components, and as the flat exports `TableHeader`, `TableHeaderCell`, `TableBody`, `TableRow`,
 * `TableCell`, `TableSelectionCell`, `TableCellLayout` and `TableCellActions` (the form React
 * Server Components can import). `Table.Head`/`Table.HeadCell` (`TableHead`/`TableHeadCell`) are
 * deprecated aliases.
 */
export const Table = /* @__PURE__ */ Object.assign(TableRoot, {
  Header: TableHeader,
  HeaderCell: TableHeaderCell,
  /** @deprecated Use `Table.Header`. */
  Head: TableHead,
  /** @deprecated Use `Table.HeaderCell`. */
  HeadCell: TableHeadCell,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  SelectionCell: TableSelectionCell,
  CellLayout: TableCellLayout,
  CellActions: TableCellActions,
});
