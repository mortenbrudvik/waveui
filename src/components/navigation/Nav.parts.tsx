import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  navAppItemClassNames,
  navAppItemStaticClassNames,
  navDividerClassNames,
  navSectionHeaderClassNames,
} from '../../lib/classNames';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import type { HeadingLevel, Slot } from '../../lib/types';
import { useNavContext, type NoAnchorOnlyAttributes } from './Nav.context';

/*
 * The parts of a Nav that carry no value: Nav.SectionHeader, Nav.Divider, Nav.AppItem and
 * Nav.AppItemStatic. Each renders its own list item, so the Nav's lists stay valid; none is
 * selected or registers with the Nav. Imports only the contexts (`Nav.context.ts`); `Nav.tsx`
 * attaches the parts to the compound.
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

// ---------------------------------------------------------------------------
// Nav.AppItem / Nav.AppItemStatic
// ---------------------------------------------------------------------------

/** The props of Nav.AppItem that every branch shares. */
export interface NavAppItemOwnProps {
  /**
   * The app's logo or an Avatar, before its name. Rendered with `aria-hidden="true"` in a box at
   * least 20px square that grows with its content. A falsy icon (`''`, `0`) or a list of nothing
   * renders no icon box.
   */
  icon?: Slot<'span'>;
  /** The app's name. */
  children?: React.ReactNode;
}

/**
 * Nav.AppItem rendered as a link (`href` given): anchor attributes, handlers typed on
 * `HTMLAnchorElement`.
 */
export interface NavAppItemAnchorProps
  extends
    NavAppItemOwnProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof NavAppItemOwnProps> {
  /**
   * URL of the app's start page; renders an `<a>`. Required in this branch, so `href`
   * discriminates the union.
   */
  href: string;
  /** Ref to the `<a>` element. */
  ref?: React.Ref<HTMLAnchorElement>;
}

/**
 * Nav.AppItem rendered as a button (no `href`): button attributes without `value` (an app item is
 * never selected).
 */
export interface NavAppItemButtonProps
  extends
    NavAppItemOwnProps,
    NoAnchorOnlyAttributes,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof NavAppItemOwnProps | 'value'> {
  /** Button app items have no `href`. */
  href?: undefined;
  /** Ref to the `<button>` element. */
  ref?: React.Ref<HTMLButtonElement>;
}

/** Properties for the NavAppItem sub-component: link props with `href`, button props without. */
export type NavAppItemProps = NavAppItemAnchorProps | NavAppItemButtonProps;

/**
 * Nav.AppItem with an `href` known only at run time (`string | undefined`): a link when it is a
 * string, a button otherwise; only the attributes both elements share, handlers of either element.
 */
export interface NavAppItemDynamicProps
  extends
    NavAppItemOwnProps,
    Omit<React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement>, keyof NavAppItemOwnProps> {
  /** URL of the app's start page; renders an `<a>` when defined, a `<button>` otherwise. */
  href?: string;
  /** Ref to the rendered `<a>` or `<button>` element. */
  ref?: React.Ref<HTMLAnchorElement | HTMLButtonElement>;
}

/** Properties for the NavAppItemStatic sub-component. */
export interface NavAppItemStaticProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The app's logo or an Avatar (as Nav.AppItem's `icon`). */
  icon?: Slot<'span'>;
  /** The app's name. */
  children?: React.ReactNode;
  /** Ref to the `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The props of both app item branches at run time (the union narrowed by `href`). */
type NavAppItemRuntimeProps = NavAppItemOwnProps &
  Omit<React.AllHTMLAttributes<HTMLElement>, keyof NavAppItemOwnProps | 'ref'> & {
    ref?: React.Ref<HTMLElement>;
  };

/** Layout of both app items: Nav.Item's padding and gap with the subtitle type. */
const appItemLayoutClasses =
  'flex w-full items-center gap-2 px-4 py-2 text-subtitle-2 text-start text-foreground';

const appItemClasses = cn(
  appItemLayoutClasses,
  'no-underline bg-transparent transition-colors motion-reduce:transition-none not-disabled:not-aria-disabled:hover:bg-subtle-hover',
  focusRingInset,
  disabledStyles,
);

/** The icon box: at least 20px square, so a 32px logo or a medium Avatar fits. */
const appIconClasses = 'flex min-h-5 min-w-5 shrink-0 items-center justify-center';

/**
 * The app's name and logo at the top of the navigation: a link with `href` (the app's start page),
 * a button otherwise. It is never selected and never marked as the current page (a consumer's
 * `aria-current` passes through), has no `value` and is not registered with the Nav; a click runs
 * only your `onClick` and the browser's default. A `disabled` button or an `aria-disabled` link
 * looks unavailable; the item adds no disabled logic of its own. Fluent's AppItem picks its element
 * through `as`; here `href` does.
 *
 * Typed by overloads like `Nav.Item`, resolved in order: without `href` (button props), with a
 * string `href` (anchor props), then an `href` that may be `undefined` at run time
 * ({@link NavAppItemDynamicProps}).
 *
 * Also exported as `NavAppItem` (import the flat name from React Server Components).
 */
export function NavAppItem(props: NavAppItemButtonProps): React.ReactElement;
export function NavAppItem(props: NavAppItemAnchorProps): React.ReactElement;
export function NavAppItem(props: NavAppItemDynamicProps): React.ReactElement;
export function NavAppItem(props: NavAppItemProps | NavAppItemDynamicProps): React.ReactElement {
  useNavContext('Nav.AppItem');
  const { icon, href, className, children, ref, ...rest } = props as NavAppItemRuntimeProps;
  const content = (
    <>
      {icon && slotRendersContent(icon)
        ? renderSlot(icon, 'span', cn(navAppItemClassNames.icon, appIconClasses), {
            'aria-hidden': true,
          })
        : null}
      <span className={cn(navAppItemClassNames.content, 'flex-1 text-start')}>{children}</span>
    </>
  );

  if (href !== undefined) {
    return (
      <li className={navAppItemClassNames.listItem}>
        <a
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={cn(navAppItemClassNames.root, appItemClasses, className)}
        >
          {content}
        </a>
      </li>
    );
  }

  // `rel` belongs only on a link and `value` on nothing: an app item is never selected.
  const { rel, value, ...buttonRest } = rest;
  return (
    <li className={navAppItemClassNames.listItem}>
      <button
        type="button"
        {...(buttonRest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={ref as React.Ref<HTMLButtonElement>}
        className={cn(navAppItemClassNames.root, appItemClasses, className)}
      >
        {content}
      </button>
    </li>
  );
}
NavAppItem.displayName = 'NavAppItem';

/**
 * The app's name and logo as plain text (not a link or button): the layout of `Nav.AppItem` in a
 * `<div>`, not focusable, with no role and no hover. It does not carry Nav.AppItem's class.
 *
 * Also exported as `NavAppItemStatic` (import the flat name from React Server Components).
 */
export const NavAppItemStatic = ({
  icon,
  className,
  children,
  ref,
  ...rest
}: NavAppItemStaticProps) => {
  useNavContext('Nav.AppItemStatic');
  return (
    <li className={navAppItemStaticClassNames.listItem}>
      <div
        {...rest}
        ref={ref}
        className={cn(
          navAppItemStaticClassNames.root,
          appItemLayoutClasses,
          'cursor-default',
          className,
        )}
      >
        {icon && slotRendersContent(icon)
          ? renderSlot(icon, 'span', cn(navAppItemStaticClassNames.icon, appIconClasses), {
              'aria-hidden': true,
            })
          : null}
        <span className={cn(navAppItemStaticClassNames.content, 'flex-1 text-start')}>
          {children}
        </span>
      </div>
    </li>
  );
};
NavAppItemStatic.displayName = 'NavAppItemStatic';
