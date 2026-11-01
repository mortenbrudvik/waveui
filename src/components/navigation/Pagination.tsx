import * as React from 'react';
import { cn } from '../../lib/cn';
import { paginationClassNames } from '../../lib/classNames';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { warnOnce } from '../../lib/dev';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../../lib/icons';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { disabledStyles, focusRing, forcedColors } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';

/** The kinds of Pagination buttons, as passed to `getItemAriaLabel`. */
export type PaginationItemType = 'first' | 'previous' | 'page' | 'next' | 'last';

/** Properties for the Pagination component. */
export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  /**
   * Controlled current page number (1-based). A value outside `1…totalPages` is shown clamped, and
   * `onPageChange` is called once with the clamped page so the parent can resync. The prop stays
   * authoritative: if the parent keeps the old value, it is shown again once it is back in range.
   */
  currentPage?: number;
  /**
   * Default current page for uncontrolled usage. When the current page falls outside
   * `1…totalPages` (for example because `totalPages` shrinks), the clamped page is kept and
   * reported once through `onPageChange`; it does not jump back when `totalPages` grows again.
   * @default 1
   */
  defaultCurrentPage?: number;
  /**
   * Total number of pages. A fractional value is rounded down; `0`, a negative value or `NaN`
   * renders nothing (non-integer values log a development warning).
   */
  totalPages: number;
  /**
   * Called with the target page whenever a page, First, Previous, Next or Last button is activated
   * — also when the current page is activated again (0.4 semantics) — and once when the current
   * page is clamped into `1…totalPages`.
   */
  onPageChange?: (page: number) => void;
  /** Number of page buttons to show on each side of the current page.
   * @default 1
   */
  siblingCount?: number;
  /**
   * Number of page buttons to always show at the start and end. With `0` no page is pinned there,
   * and an ellipsis marks the pages before or after the shown range.
   * @default 1
   */
  boundaryCount?: number;
  /** Whether to show previous/next navigation buttons.
   * @default true
   */
  showPreviousNext?: boolean;
  /** Whether to show first/last page navigation buttons.
   * @default false
   */
  showFirstLast?: boolean;
  /**
   * Whether the entire pagination control is disabled (every button gets the native `disabled`
   * attribute). Boundary buttons that point at the current page are not natively disabled: they use
   * `aria-disabled="true"` and stay focusable.
   * @default false
   */
  disabled?: boolean;
  /** Size of the pagination buttons.
   * @default 'medium'
   */
  size?: 'small' | 'medium';
  /**
   * Accessible name of each button, for localization. `page` is the page the button navigates to
   * (for `'page'` items, the page it shows); `selected` is `true` for the current page. Defaults:
   * `'First page'`, `'Previous page'`, `` `Page ${page}` ``, `'Next page'`, `'Last page'`. The
   * landmark itself is named with `aria-label` (default `'Pagination'`) or `aria-labelledby`.
   */
  getItemAriaLabel?: (type: PaginationItemType, page: number, selected: boolean) => string;
  /** Ref to the root `<nav>` element. */
  ref?: React.Ref<HTMLElement>;
  /**
   * Props for the elements the control draws inside its landmark, by part, merged into each
   * part's own: your classes after the part's (yours win a conflict), your styles over its
   * styles, your attributes and handlers added, your ref attached. Every attribute the control
   * sets on a part is locked, and no part takes another role or hides what it holds. A part takes
   * no `children` (the control draws their content). On a button your handler runs before the
   * button's own: `preventDefault()` in yours skips the page change, `onPageChange` included. The
   * list and the list items receive the buttons' events after them. Fluent UI has no Pagination.
   */
  slotProps?: {
    /**
     * The `<ol>` of the buttons (stable class `wave-pagination__list`). Locked: no role (it stays
     * a list), and no `hidden`, `inert` or `aria-hidden`, since it holds the buttons.
     */
    list?: SlotPart<'ol'>;
    /**
     * Every `<li>`: around each button, and around each ellipsis (stable class
     * `wave-pagination__list-item`). Locked: no role (it stays a list item); around a button no
     * `hidden`, `inert` or `aria-hidden`; around an ellipsis its `aria-hidden` and no tab index.
     */
    listItem?: SlotPart<'li'>;
    /**
     * The First button, with `showFirstLast` (stable class `wave-pagination__first-button`),
     * locked as the Previous button (`previousButton`): on the first page it is unavailable.
     */
    firstButton?: SlotPart<'button'>;
    /**
     * The Previous button, with `showPreviousNext` (stable class
     * `wave-pagination__previous-button`). Locked: `type`, its name (`aria-label`, from
     * `getItemAriaLabel`), `disabled` (the control's), its click (the page change), no
     * `aria-current`, no role or tab index, and no `hidden`, `inert` or `aria-hidden`. The button
     * has no `aria-labelledby` of its own: one of yours is passed on, not locked, and renames the
     * button (it comes before `aria-label` in the name). While it points at the current page (on
     * the first page) it is unavailable: `aria-disabled` and `data-disabled`, both locked (unset
     * otherwise), and your `onClick` is not called, as the page change is not.
     */
    previousButton?: SlotPart<'button'>;
    /**
     * Every page button (stable class `wave-pagination__page-button`), the current page's
     * included. Locked as the Previous button, with `aria-current="page"` on the current page's
     * and none on the others, and never unavailable (no `aria-disabled` or `data-disabled`).
     */
    pageButton?: SlotPart<'button'>;
    /**
     * The Next button, with `showPreviousNext` (stable class `wave-pagination__next-button`),
     * locked as the Previous button: on the last page it is unavailable.
     */
    nextButton?: SlotPart<'button'>;
    /**
     * The Last button, with `showFirstLast` (stable class `wave-pagination__last-button`), locked
     * as the Previous button: on the last page it is unavailable.
     */
    lastButton?: SlotPart<'button'>;
    /**
     * The "…" of every gap in the pages (stable class `wave-pagination__ellipsis`), inside its
     * `aria-hidden` list item. Locked: no tab index.
     */
    ellipsis?: SlotPart<'span'>;
  };
}

/** The `blockHandlers` of an unavailable button: no click of a part, as no page change. */
const BLOCK_CLICK = ['onClick'] as const;

/**
 * What the list, the list item of a button and the buttons lock unset: a role, and the hidden
 * state (each is or holds a button).
 */
const LIST_PART_LOCKS = {
  role: undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/** What the list item of an ellipsis locks: no role, its own `aria-hidden` and no tab index. */
const ELLIPSIS_ITEM_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'aria-hidden': 'true',
} as const;

/** What the ellipsis locks: no tab index (it sits in an `aria-hidden` list item). */
const ELLIPSIS_LOCKS = { tabIndex: undefined } as const;

function defaultGetItemAriaLabel(type: PaginationItemType, page: number): string {
  switch (type) {
    case 'first':
      return 'First page';
    case 'previous':
      return 'Previous page';
    case 'next':
      return 'Next page';
    case 'last':
      return 'Last page';
    default:
      return `Page ${page}`;
  }
}

/** A non-negative integer count, or `fallback` for `NaN`/`±Infinity`. */
function toCount(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

/** `page` rounded down and clamped into `1…pageCount` (`NaN` → 1). */
function clampPage(page: number, pageCount: number): number {
  if (Number.isNaN(page)) return 1;
  return Math.min(Math.max(1, Math.floor(page)), pageCount);
}

/**
 * The page items Pagination renders: page numbers and `'ellipsis'` markers, in order.
 *
 * Always shows `boundaryCount` pages at each end and `siblingCount` pages on each side of the
 * current page; a gap of exactly one page is filled with that page instead of an ellipsis. With
 * `boundaryCount` 0 no page is pinned at the ends, so a gap before the first or after the last
 * shown page gets an ellipsis too. When `totalPages` fits into those slots
 * (`2 × boundaryCount + 2 × siblingCount + 3`), every page is listed. `currentPage` is clamped
 * into `1…totalPages`; `totalPages < 1` returns `[]`.
 *
 * Exported from this module for tests and custom pagers; not part of the package barrel.
 *
 * @example getPaginationRange(20, 10) // [1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]
 * @example getPaginationRange(20, 10, 1, 0) // ['ellipsis', 9, 10, 11, 'ellipsis']
 */
export function getPaginationRange(
  totalPages: number,
  currentPage: number,
  siblingCount = 1,
  boundaryCount = 1,
): Array<number | 'ellipsis'> {
  const total = toCount(totalPages, 0);
  if (total < 1) return [];
  const current = clampPage(currentPage, total);
  const siblings = toCount(siblingCount, 1);
  const boundaries = toCount(boundaryCount, 1);

  // boundaries + siblings + current + 2 ellipsis slots
  const totalSlots = boundaries * 2 + siblings * 2 + 3;
  if (total <= totalSlots) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  for (let i = 1; i <= Math.min(boundaries, total); i++) pages.add(i);
  for (let i = Math.max(1, total - boundaries + 1); i <= total; i++) pages.add(i);
  for (let i = Math.max(1, current - siblings); i <= Math.min(total, current + siblings); i++) {
    pages.add(i);
  }
  pages.add(current);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const range: Array<number | 'ellipsis'> = [];
  /** Marks the pages between `before` and `after` (both exclusive). */
  const fillGap = (before: number, after: number) => {
    const gap = after - before;
    if (gap === 2) {
      // A single missing page: show it instead of an ellipsis.
      range.push(before + 1);
    } else if (gap > 2) {
      range.push('ellipsis');
    }
  };
  // The ends are virtual neighbours 0 and total + 1, so with `boundaryCount` 0 (no page pinned at
  // an end) a gap before the first or after the last shown page is marked as well.
  let previous = 0;
  for (const pageNumber of sorted) {
    fillGap(previous, pageNumber);
    range.push(pageNumber);
    previous = pageNumber;
  }
  fillGap(previous, total + 1);
  return range;
}

const itemBaseClasses = cn(
  'inline-flex items-center justify-center rounded border cursor-pointer transition-colors motion-reduce:transition-none',
  focusRing,
  disabledStyles,
);

const idleItemClasses =
  'border-border bg-transparent text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed';

const currentItemClasses = cn(
  'border-primary bg-primary text-primary-foreground',
  forcedColors.selectedLeaf,
);

/**
 * Directional glyphs point the other way in right-to-left layouts (C-LOGICAL), by the glyph's own
 * direction: Tailwind's bare variant would also match inside an LTR subtree of an RTL page.
 */
const chevronClasses = 'wave-rtl:-scale-x-100';

/**
 * Page navigation for paged content: page buttons with ellipses, optional Previous/Next and
 * First/Last buttons, inside a `<nav>` landmark named "Pagination" (override with `aria-label`).
 *
 * `onPageChange` is an event callback: it fires on every activation, including the current page.
 * Boundary buttons that point at the current page use `aria-disabled` and keep focus; the whole
 * control is disabled with `disabled`. Button names are localized with `getItemAriaLabel`.
 */
const Pagination = ({
  currentPage: controlledPage,
  defaultCurrentPage = 1,
  totalPages,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
  showPreviousNext = true,
  showFirstLast = false,
  disabled = false,
  size = 'medium',
  getItemAriaLabel = defaultGetItemAriaLabel,
  className,
  ref,
  slotProps,
  ...rest
}: PaginationProps) => {
  // `isControlled` is useControllable's sticky mode: a pager that was ever controlled stays
  // controlled, also when `currentPage` later becomes `undefined` (misuse; the hook warns and
  // reports `defaultCurrentPage`, which is then clamped like a controlled value).
  const [rawPage, setPage, isControlled] = useControllable(controlledPage, defaultCurrentPage);
  const emitPageChange = useEventCallback(onPageChange);

  const pageCount = toCount(totalPages, 0);
  const uncontrolled = !isControlled;
  // Uncontrolled: a clamp is stored, so the page does not jump back to the out-of-range value — and
  // out of sync with the last `onPageChange` — when `totalPages` grows again. Navigation clears it.
  // Controlled: the prop always wins.
  const [storedClamp, setStoredClamp] = React.useState<number | null>(null);
  const basePage = uncontrolled && storedClamp !== null ? storedClamp : rawPage;
  const page = clampPage(basePage, Math.max(1, pageCount));
  if (uncontrolled && pageCount >= 1 && !Object.is(page, basePage)) {
    setStoredClamp(page);
  }

  React.useEffect(() => {
    if (!Number.isInteger(totalPages)) {
      warnOnce(
        'Pagination:totalPages',
        `Pagination: \`totalPages\` must be an integer, received ${String(totalPages)}. ` +
          'Fractional values are rounded down; NaN and infinite values render nothing.',
      );
    }
  }, [totalPages]);

  // Tell the parent about a clamped page once per clamp (also under StrictMode's double effects). A
  // stored uncontrolled clamp keeps `page !== rawPage`, so growing `totalPages` does not re-notify;
  // neither does a pass through `totalPages={0}` (nothing rendered, the last clamp is kept).
  const notifiedClampRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (pageCount < 1) return;
    if (Object.is(page, rawPage)) {
      notifiedClampRef.current = null;
      return;
    }
    const clamp = `${String(rawPage)}->${page}`;
    if (notifiedClampRef.current === clamp) return;
    notifiedClampRef.current = clamp;
    emitPageChange(page);
  }, [page, rawPage, pageCount, emitPageChange]);

  if (pageCount < 1) return null;

  const range = getPaginationRange(pageCount, page, siblingCount, boundaryCount);
  const sizeClasses = size === 'small' ? 'h-7 w-7 text-caption-1' : 'h-8 w-8 text-body-1';
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  /** Event callback semantics: every activation of an available button emits (C-NAMING). */
  const goTo = (target: number) => {
    if (disabled || target < 1 || target > pageCount) return;
    setStoredClamp(null);
    setPage(target);
    emitPageChange(target);
  };

  // The parts, merged only when given: a pager renders a list item and a button per page.
  const listItemPart = slotProps?.listItem;
  const listItemProps = (locked: Record<string, unknown>) =>
    listItemPart &&
    mergeSlotProps(listItemPart, { className: paginationClassNames.listItem, locked });
  /** A button part with the button's own attributes and click locked. */
  const buttonPartProps = (
    part: SlotPart<'button'> | undefined,
    className: string,
    label: string,
    current: 'page' | undefined,
    unavailable: boolean,
    onClick: React.MouseEventHandler<HTMLButtonElement>,
  ) =>
    part &&
    mergeSlotProps(part, {
      className,
      locked: {
        ...LIST_PART_LOCKS,
        type: 'button',
        'aria-label': label,
        'aria-current': current,
        disabled,
        'aria-disabled': undefined,
        'data-disabled': undefined,
        ...(disabled ? {} : focusableDisabledProps(unavailable)),
        tabIndex: undefined,
        onClick,
      },
      blockHandlers: unavailable ? BLOCK_CLICK : undefined,
    });

  const renderNavButton = (
    type: Exclude<PaginationItemType, 'page'>,
    target: number,
    unavailable: boolean,
    icon: React.ReactNode,
    partClassName: string,
    part: SlotPart<'button'> | undefined,
  ) => {
    const label = getItemAriaLabel(type, target, false);
    const onClick = preventIfDisabled(unavailable, () => goTo(target));
    const buttonClassName = cn(partClassName, itemBaseClasses, sizeClasses, idleItemClasses);
    return (
      <li className={paginationClassNames.listItem} {...listItemProps(LIST_PART_LOCKS)}>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          {...(disabled ? {} : focusableDisabledProps(unavailable))}
          onClick={onClick}
          className={buttonClassName}
          {...buttonPartProps(part, buttonClassName, label, undefined, unavailable, onClick)}
        >
          {icon}
        </button>
      </li>
    );
  };

  const listClassName = cn(paginationClassNames.list, 'm-0 flex list-none items-center gap-1 p-0');
  return (
    <nav
      ref={ref}
      aria-label="Pagination"
      {...rest}
      className={cn(paginationClassNames.root, className)}
    >
      <ol
        className={listClassName}
        {...(slotProps?.list &&
          mergeSlotProps(slotProps.list, { className: listClassName, locked: LIST_PART_LOCKS }))}
      >
        {showFirstLast &&
          renderNavButton(
            'first',
            1,
            atStart,
            <ChevronDoubleLeftIcon className={chevronClasses} />,
            paginationClassNames.firstButton,
            slotProps?.firstButton,
          )}
        {showPreviousNext &&
          renderNavButton(
            'previous',
            Math.max(1, page - 1),
            atStart,
            <ChevronLeftIcon className={chevronClasses} />,
            paginationClassNames.previousButton,
            slotProps?.previousButton,
          )}

        {range.map((item, index) => {
          if (item === 'ellipsis') {
            const ellipsisClassName = cn(
              paginationClassNames.ellipsis,
              'inline-flex items-center justify-center text-muted-foreground',
              sizeClasses,
            );
            return (
              <li
                key={index < range.length / 2 ? 'start-ellipsis' : 'end-ellipsis'}
                aria-hidden="true"
                className={paginationClassNames.listItem}
                {...listItemProps(ELLIPSIS_ITEM_LOCKS)}
              >
                <span
                  className={ellipsisClassName}
                  {...(slotProps?.ellipsis &&
                    mergeSlotProps(slotProps.ellipsis, {
                      className: ellipsisClassName,
                      locked: ELLIPSIS_LOCKS,
                    }))}
                >
                  …
                </span>
              </li>
            );
          }
          const label = getItemAriaLabel('page', item, item === page);
          const current = item === page ? 'page' : undefined;
          const onClick = () => goTo(item);
          const buttonClassName = cn(
            paginationClassNames.pageButton,
            itemBaseClasses,
            sizeClasses,
            item === page ? currentItemClasses : idleItemClasses,
          );
          return (
            <li
              key={item}
              className={paginationClassNames.listItem}
              {...listItemProps(LIST_PART_LOCKS)}
            >
              <button
                type="button"
                aria-label={label}
                aria-current={current}
                disabled={disabled}
                onClick={onClick}
                className={buttonClassName}
                {...buttonPartProps(
                  slotProps?.pageButton,
                  buttonClassName,
                  label,
                  current,
                  false,
                  onClick,
                )}
              >
                {item}
              </button>
            </li>
          );
        })}

        {showPreviousNext &&
          renderNavButton(
            'next',
            Math.min(pageCount, page + 1),
            atEnd,
            <ChevronRightIcon className={chevronClasses} />,
            paginationClassNames.nextButton,
            slotProps?.nextButton,
          )}
        {showFirstLast &&
          renderNavButton(
            'last',
            pageCount,
            atEnd,
            <ChevronDoubleRightIcon className={chevronClasses} />,
            paginationClassNames.lastButton,
            slotProps?.lastButton,
          )}
      </ol>
    </nav>
  );
};
Pagination.displayName = 'Pagination';

export { Pagination };
