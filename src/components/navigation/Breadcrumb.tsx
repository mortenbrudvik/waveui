import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Slot } from '../../lib/types';
import { renderSlot } from '../../lib/slot';

/** Properties for the Breadcrumb component. */
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  /** Breadcrumb items to render. */
  children: React.ReactNode;
}

/** Properties for the BreadcrumbItem sub-component. */
export interface BreadcrumbItemProps extends React.HTMLAttributes<HTMLElement> {
  /** URL the breadcrumb item links to. */
  href?: string;
  /** Whether this item represents the current page. */
  current?: boolean;
  /** Slot for an icon displayed before the item text. */
  icon?: Slot<'span'>;
  /** Label content of the breadcrumb item. */
  children: React.ReactNode;
}

const ChevronIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    className="text-muted-foreground"
  >
    <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BreadcrumbRoot = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ children, className, ...rest }, ref) => {
    const items = React.Children.toArray(children);

    return (
      <nav ref={ref} aria-label="Breadcrumb" {...rest} className={className}>
        <ol className="flex items-center gap-1 text-body-1 list-none m-0 p-0">
          {items.map((child, index) => (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true">
                  <ChevronIcon />
                </span>
              )}
              {child}
            </li>
          ))}
        </ol>
      </nav>
    );
  }
);
BreadcrumbRoot.displayName = 'Breadcrumb';

const BreadcrumbItem = React.forwardRef<HTMLElement, BreadcrumbItemProps>(
  ({ href, current, icon, children, className, ...rest }, ref) => {
    const renderedIcon = renderSlot(icon, 'span', 'flex-shrink-0 mr-1');

    if (current) {
      return (
        <span
          ref={ref as React.Ref<HTMLSpanElement>}
          aria-current="page"
          {...rest}
          className={cn('text-foreground font-semibold inline-flex items-center', className)}
        >
          {renderedIcon}
          {children}
        </span>
      );
    }

    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        {...rest}
        className={cn('text-primary hover:underline cursor-pointer inline-flex items-center', className)}
      >
        {renderedIcon}
        {children}
      </a>
    );
  }
);
BreadcrumbItem.displayName = 'BreadcrumbItem';

export const Breadcrumb = Object.assign(BreadcrumbRoot, {
  Item: BreadcrumbItem,
});
