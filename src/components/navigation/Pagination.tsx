import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

/** Properties for the Pagination component. */
export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Controlled current page number. */
  currentPage?: number;
  /** Default current page for uncontrolled usage.
   * @default 1
   */
  defaultCurrentPage?: number;
  /** Total number of pages. */
  totalPages: number;
  /** Callback invoked when the page changes. */
  onPageChange?: (page: number) => void;
  /** Number of page buttons to show on each side of the current page.
   * @default 1
   */
  siblingCount?: number;
  /** Number of page buttons to always show at the start and end.
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
  /** Whether the entire pagination control is disabled.
   * @default false
   */
  disabled?: boolean;
  /** Size of the pagination buttons.
   * @default 'medium'
   */
  size?: 'small' | 'medium';
}

function getPaginationRange(
  totalPages: number,
  currentPage: number,
  siblingCount: number,
  boundaryCount: number,
): (number | 'ellipsis')[] {
  // If total pages is small enough, show all pages without ellipsis
  const totalSlots = boundaryCount * 2 + siblingCount * 2 + 3; // boundaries + siblings + current + 2 ellipsis slots
  if (totalPages <= totalSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const range: (number | 'ellipsis')[] = [];

  // Build set of pages that should be shown
  const pages = new Set<number>();

  // Boundary pages at start
  for (let i = 1; i <= Math.min(boundaryCount, totalPages); i++) {
    pages.add(i);
  }

  // Boundary pages at end
  for (let i = Math.max(1, totalPages - boundaryCount + 1); i <= totalPages; i++) {
    pages.add(i);
  }

  // Sibling pages around current
  for (
    let i = Math.max(1, currentPage - siblingCount);
    i <= Math.min(totalPages, currentPage + siblingCount);
    i++
  ) {
    pages.add(i);
  }

  // Always include current page
  pages.add(currentPage);

  // Sort and insert ellipses for gaps (but fill single-page gaps)
  const sorted = Array.from(pages).sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap === 2) {
        // Single page gap — include the missing page instead of ellipsis
        range.push(sorted[i - 1] + 1);
      } else if (gap > 2) {
        range.push('ellipsis');
      }
    }
    range.push(sorted[i]);
  }

  return range;
}

const ChevronLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M7.5 2.5L4.5 6L7.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M4.5 2.5L7.5 6L4.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronDoubleLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M6.5 2.5L3.5 6L6.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 2.5L7 6L10 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronDoubleRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M2 2.5L5 6L2 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 2.5L8.5 6L5.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  (
    {
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
      className,
      ...rest
    },
    ref,
  ) => {
    const [currentPage, setCurrentPage] = useControllable(
      controlledPage,
      defaultCurrentPage,
      onPageChange,
    );

    if (totalPages < 1) return null;

    const range = getPaginationRange(totalPages, currentPage, siblingCount, boundaryCount);

    const sizeClasses = size === 'small' ? 'h-7 w-7 text-caption-1' : 'h-8 w-8 text-body-1';

    const buttonBase = cn(
      'inline-flex items-center justify-center rounded border border-border transition-colors',
      sizeClasses,
      disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer',
    );

    const handlePageChange = (page: number) => {
      if (!disabled && page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    };

    return (
      <nav ref={ref} aria-label="Pagination" {...rest} className={cn(className)}>
        <ol className="flex items-center gap-1 list-none m-0 p-0">
          {showFirstLast && (
            <li>
              <button
                type="button"
                aria-label="First page"
                disabled={disabled || currentPage === 1}
                onClick={() => handlePageChange(1)}
                className={cn(
                  buttonBase,
                  'hover:bg-[#f0f0f0]',
                  (disabled || currentPage === 1) && 'opacity-50 pointer-events-none',
                )}
              >
                <ChevronDoubleLeftIcon />
              </button>
            </li>
          )}

          {showPreviousNext && (
            <li>
              <button
                type="button"
                aria-label="Previous page"
                disabled={disabled || currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={cn(
                  buttonBase,
                  'hover:bg-[#f0f0f0]',
                  (disabled || currentPage === 1) && 'opacity-50 pointer-events-none',
                )}
              >
                <ChevronLeftIcon />
              </button>
            </li>
          )}

          {range.map((item, index) =>
            item === 'ellipsis' ? (
              <li key={`ellipsis-${index}`}>
                <span
                  className={cn(
                    'inline-flex items-center justify-center text-muted-foreground',
                    sizeClasses,
                  )}
                  aria-hidden="true"
                >
                  ...
                </span>
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === currentPage ? 'page' : undefined}
                  disabled={disabled}
                  onClick={() => handlePageChange(item)}
                  className={cn(
                    buttonBase,
                    item === currentPage
                      ? 'bg-primary text-white border-primary'
                      : 'hover:bg-[#f0f0f0] text-foreground',
                  )}
                >
                  {item}
                </button>
              </li>
            ),
          )}

          {showPreviousNext && (
            <li>
              <button
                type="button"
                aria-label="Next page"
                disabled={disabled || currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className={cn(
                  buttonBase,
                  'hover:bg-[#f0f0f0]',
                  (disabled || currentPage === totalPages) && 'opacity-50 pointer-events-none',
                )}
              >
                <ChevronRightIcon />
              </button>
            </li>
          )}

          {showFirstLast && (
            <li>
              <button
                type="button"
                aria-label="Last page"
                disabled={disabled || currentPage === totalPages}
                onClick={() => handlePageChange(totalPages)}
                className={cn(
                  buttonBase,
                  'hover:bg-[#f0f0f0]',
                  (disabled || currentPage === totalPages) && 'opacity-50 pointer-events-none',
                )}
              >
                <ChevronDoubleRightIcon />
              </button>
            </li>
          )}
        </ol>
      </nav>
    );
  },
);
Pagination.displayName = 'Pagination';

export { Pagination };
