import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { focusRing } from '../../lib/styles';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';

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
        'overflow-x-auto rounded-md border border-border',
        scrollable && focusRing,
        containerClassName,
      )}
    >
      <table
        ref={ref}
        data-striped={striped ? '' : undefined}
        className={cn(
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
  <thead ref={ref} {...rest} className={cn('bg-card', className)}>
    {children}
  </thead>
);
TableHeader.displayName = 'TableHeader';

/** A column header cell (`<th scope="col">`). */
const TableHeaderCell = ({ children, className, ref, ...props }: TableHeaderCellProps) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      'px-4 py-3 text-start font-semibold text-caption-1 uppercase tracking-wider border-b border-border',
      className,
    )}
    {...props}
  >
    {children}
  </th>
);
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
  <tbody ref={ref} {...rest} className={className}>
    {children}
  </tbody>
);
TableBody.displayName = 'TableBody';

/** A table row. Striping comes from the table (`striped`), so rows need no context. */
const TableRow = ({ children, className, ref, ...props }: TableRowProps) => (
  <tr
    ref={ref}
    className={cn(
      'hover:bg-subtle-hover transition-colors motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    {children}
  </tr>
);
TableRow.displayName = 'TableRow';

/** A data cell (`<td>`). */
const TableCell = ({ children, className, ref, ...props }: TableCellProps) => (
  <td
    ref={ref}
    className={cn('px-4 py-3 text-body-1 border-b border-border', className)}
    {...props}
  >
    {children}
  </td>
);
TableCell.displayName = 'TableCell';

export { TableHeader, TableHeaderCell, TableHead, TableHeadCell, TableBody, TableRow, TableCell };

/**
 * A non-interactive data table with an optional striped body. The table sits in a horizontally
 * scrollable wrapper; while it scrolls, the wrapper is a focusable region (named by
 * `containerProps` or the `<caption>`) so keyboard users can scroll it.
 *
 * Sub-components are available as `Table.Header`, `Table.HeaderCell`, `Table.Body`, `Table.Row`
 * and `Table.Cell` in client components, and as the flat exports `TableHeader`,
 * `TableHeaderCell`, `TableBody`, `TableRow` and `TableCell` (the form React Server Components
 * can import). `Table.Head`/`Table.HeadCell` (`TableHead`/`TableHeadCell`) are deprecated aliases.
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
});
