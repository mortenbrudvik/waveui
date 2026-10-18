import * as React from 'react';
import { cn } from '../../lib/cn';
import { navDividerClassNames, navSectionHeaderClassNames } from '../../lib/classNames';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import type { HeadingLevel } from '../../lib/types';
import { useNavContext } from './Nav.context';

/*
 * The structural parts of a Nav: Nav.SectionHeader and Nav.Divider. Each renders its own list
 * item, so the Nav's lists stay valid; none has a value or registers with the Nav. Imports only
 * the contexts (`Nav.context.ts`); `Nav.tsx` attaches the parts to the compound.
 */

// ---------------------------------------------------------------------------
// Nav.SectionHeader
// ---------------------------------------------------------------------------

/** Properties for the NavSectionHeader sub-component. */
export interface NavSectionHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Level of the heading element (`<h1>` … `<h6>`). Pick the level that fits the page's outline.
   * Fluent's NavSectionHeader changes its element through `as`.
   * @default 3
   */
  headingLevel?: HeadingLevel;
  /** The header text. A header whose children render nothing renders nothing at all. */
  children?: React.ReactNode;
  /** Ref to the heading element. */
  ref?: React.Ref<HTMLHeadingElement>;
}

/**
 * A heading between groups of items (`<h3>` by default, `headingLevel`), in its own list item. It
 * names nothing by itself: place it before the items it introduces. A header whose children render
 * nothing renders nothing. It may also sit in a `Nav.Category`, between its sub-items.
 *
 * Also exported as `NavSectionHeader` (import the flat name from React Server Components).
 */
export const NavSectionHeader = ({
  headingLevel = 3,
  className,
  children,
  ref,
  ...rest
}: NavSectionHeaderProps) => {
  useNavContext('Nav.SectionHeader');
  // An empty heading fails axe's empty-heading rule: no content, no list item and no heading.
  if (!slotRendersContent(children)) return null;
  const Heading: `h${HeadingLevel}` = `h${headingLevel}`;
  return (
    <li className={navSectionHeaderClassNames.listItem}>
      <Heading
        {...rest}
        ref={ref}
        className={cn(
          navSectionHeaderClassNames.root,
          'm-0 px-4 pt-3 pb-1 text-caption-1 font-semibold text-muted-foreground text-start',
          className,
        )}
      >
        {materialiseSlotContent(children)}
      </Heading>
    </li>
  );
};
NavSectionHeader.displayName = 'NavSectionHeader';

// ---------------------------------------------------------------------------
// Nav.Divider
// ---------------------------------------------------------------------------

/** Properties for the NavDivider sub-component. */
export interface NavDividerProps extends Omit<
  React.HTMLAttributes<HTMLLIElement>,
  'children' | 'role' | 'aria-hidden'
> {
  /** Ref to the divider's list item. */
  ref?: React.Ref<HTMLLIElement>;
}

/**
 * A line between groups of items, in its own list item, hidden from assistive technology (a list
 * holds only list items; use `Nav.SectionHeader` to name a group). Fluent's NavDivider is a
 * `separator`, which a list cannot hold, so this one is decorative.
 *
 * Also exported as `NavDivider` (import the flat name from React Server Components).
 */
export const NavDivider = ({ className, ref, ...rest }: NavDividerProps) => {
  useNavContext('Nav.Divider');
  return (
    <li
      {...rest}
      ref={ref}
      // After the rest: a consumer's `aria-hidden={false}` would bring back an invalid list child.
      aria-hidden="true"
      className={cn(
        navDividerClassNames.root,
        'my-1 h-0 border-t border-border forced-colors:border-[CanvasText]',
        className,
      )}
    />
  );
};
NavDivider.displayName = 'NavDivider';
