import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  navCategoryClassNames,
  navItemClassNames,
  navSubItemClassNames,
} from '../../lib/classNames';
import type { Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { warnDeprecated } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import { useId } from '../../hooks/useId';
import {
  NavCategoryValueContext,
  NavRovingContext,
  containsValue,
  markNavPart,
  useNavContext,
  useNavListChildCheck,
  useNavValue,
  useRecordCategory,
  type NavContextValue,
  type NavRovingContextValue,
  type NoAnchorOnlyAttributes,
} from './Nav.context';
import { NavAppItem, NavAppItemStatic, NavDivider, NavSectionHeader } from './Nav.parts';
import { NavRoot } from './Nav.root';

/*
 * The Nav compound: the item types, styles and rendering of Nav.Item and Nav.SubItem, Nav.Category,
 * the `Object.assign` with its JSDoc, the flat names and the type re-exports. Nothing imports this
 * module but the barrel: the root (`Nav.root.tsx`) and the contexts (`Nav.context.ts`) recognise
 * the parts by the markers set next to each `displayName` below; the structural parts live in
 * `Nav.parts.tsx`.
 */

export type { NavProps } from './Nav.root';
export type {
  NavSectionHeaderProps,
  NavDividerProps,
  NavAppItemOwnProps,
  NavAppItemAnchorProps,
  NavAppItemButtonProps,
  NavAppItemProps,
  NavAppItemDynamicProps,
  NavAppItemStaticProps,
} from './Nav.parts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Properties for the NavCategory sub-component. */
export interface NavCategoryProps extends React.HTMLAttributes<HTMLLIElement> {
  /**
   * Value identifying this category (used by `openCategories`), unique among the categories of
   * the Nav (a duplicate warns in development).
   */
  value: string;
  /**
   * Label of the category's toggle button (any content). Without it, the text children are used
   * as the label — deprecated: pass the label here and only the sub-items as children.
   */
  label?: React.ReactNode;
  /**
   * Icon displayed before the category label. Rendered with `aria-hidden="true"`. A falsy icon
   * (`''`, `0`) or a list of nothing renders no icon box.
   */
  icon?: Slot<'span'>;
  /**
   * The category's sub-items (`Nav.SubItem`), and `Nav.SectionHeader` and `Nav.Divider`, rendered
   * in its list while it is open.
   */
  children?: React.ReactNode;
  /** Ref to the category's `<li>` element. */
  ref?: React.Ref<HTMLLIElement>;
}

/**
 * The props of Nav.Item that every branch shares ({@link NavItemAnchorProps},
 * {@link NavItemButtonProps}, {@link NavItemDynamicProps}).
 */
export interface NavItemOwnProps {
  /**
   * Value identifying this nav item, unique among the items and sub-items of the Nav (a duplicate
   * warns in development).
   */
  value: string;
  /**
   * Icon displayed before the item label. Rendered with `aria-hidden="true"`. A falsy icon (`''`,
   * `0`) or a list of nothing renders no icon box.
   */
  icon?: Slot<'span'>;
  /**
   * Whether the item is disabled: a native `disabled` button, or an `aria-disabled` link without
   * `href`. Activating a disabled item never selects it; a disabled item whose value is the
   * current `value` still shows as current (`aria-current="page"` and the selected look), because
   * the current value belongs to the app.
   */
  disabled?: boolean;
  /** Label content. */
  children?: React.ReactNode;
}

/**
 * Nav.Item rendered as a link (`href` given): anchor attributes, and handlers typed on
 * `HTMLAnchorElement`. 0.4 typed every item's handlers on `HTMLButtonElement`, so with a string
 * `href` an unannotated 0.4 handler that reads a button-only member (such as
 * `e.currentTarget.form`) no longer compiles; a handler already typed as
 * `React.MouseEventHandler<HTMLButtonElement>` still does (React handler types are bivariant).
 */
export interface NavItemAnchorProps
  extends
    NavItemOwnProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof NavItemOwnProps> {
  /**
   * URL to navigate to; renders an `<a>`. Required in this branch, so `href` discriminates the
   * union and handlers without `href` are typed as button handlers.
   */
  href: string;
  /** Ref to the `<a>` element. */
  ref?: React.Ref<HTMLAnchorElement>;
}

/** Nav.Item rendered as a button (no `href`): button attributes (a `rel` is not rendered). */
export interface NavItemButtonProps
  extends
    NavItemOwnProps,
    NoAnchorOnlyAttributes,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof NavItemOwnProps> {
  /** Button items have no `href`. */
  href?: undefined;
  /** Ref to the `<button>` element. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Properties for the NavItem sub-component: link props with `href`, button props without.
 *
 * A union type (0.4 had an interface): an interface cannot extend it, so extend one branch
 * (`interface X extends NavItemButtonProps`) or intersect (`type X = NavItemProps & { … }`).
 * `React.ComponentProps<typeof Nav.Item>` resolves to the last overload,
 * {@link NavItemDynamicProps}.
 */
export type NavItemProps = NavItemAnchorProps | NavItemButtonProps;

/**
 * Nav.Item with an `href` known only at run time (`string | undefined`): a link when it is a
 * string, a button otherwise. Resolved after the button and link signatures.
 *
 * Only the attributes both elements share are accepted (no `target`, `download`, `type`, `form`,
 * …), and handlers receive events of either element (`HTMLAnchorElement | HTMLButtonElement`).
 * 0.4 typed them as button events (`HTMLAttributes<HTMLButtonElement>`), so an unannotated 0.4
 * handler that reads a button-only member (such as `e.currentTarget.form`) no longer compiles here;
 * narrow `e.currentTarget` first. (A string `href` types handlers on `HTMLAnchorElement`, see
 * {@link NavItemAnchorProps}; no `href` keeps `HTMLButtonElement`.)
 */
export interface NavItemDynamicProps
  extends
    NavItemOwnProps,
    Omit<React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement>, keyof NavItemOwnProps> {
  /** URL to navigate to; renders an `<a>` when defined, a `<button>` otherwise. */
  href?: string;
  /** Ref to the rendered `<a>` or `<button>` element. */
  ref?: React.Ref<HTMLAnchorElement | HTMLButtonElement>;
}

/**
 * The props of Nav.SubItem that every branch shares: those of {@link NavItemOwnProps} without
 * `icon`.
 */
export type NavSubItemOwnProps = Omit<NavItemOwnProps, 'icon'>;

/**
 * Nav.SubItem rendered as a link (`href` given): anchor attributes, and handlers typed on
 * `HTMLAnchorElement` (0.4: `HTMLButtonElement`); see {@link NavItemAnchorProps}.
 */
export interface NavSubItemAnchorProps
  extends
    NavSubItemOwnProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof NavSubItemOwnProps> {
  /**
   * URL to navigate to; renders an `<a>`. Required in this branch, so `href` discriminates the
   * union and handlers without `href` are typed as button handlers.
   */
  href: string;
  /** Ref to the `<a>` element. */
  ref?: React.Ref<HTMLAnchorElement>;
}

/** Nav.SubItem rendered as a button (no `href`): button attributes (a `rel` is not rendered). */
export interface NavSubItemButtonProps
  extends
    NavSubItemOwnProps,
    NoAnchorOnlyAttributes,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof NavSubItemOwnProps> {
  /** Button sub-items have no `href`. */
  href?: undefined;
  /** Ref to the `<button>` element. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Properties for the NavSubItem sub-component: link props with `href`, button props without.
 * A union type like {@link NavItemProps} (extend a branch or intersect; `React.ComponentProps`
 * resolves to {@link NavSubItemDynamicProps}).
 */
export type NavSubItemProps = NavSubItemAnchorProps | NavSubItemButtonProps;

/**
 * Nav.SubItem with an `href` known only at run time (`string | undefined`): a link when it is a
 * string, a button otherwise. Only the attributes both elements share are accepted, and handlers
 * receive events of either element (0.4 typed them as button events); see
 * {@link NavItemDynamicProps}.
 */
export interface NavSubItemDynamicProps
  extends
    NavSubItemOwnProps,
    Omit<React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement>, keyof NavSubItemOwnProps> {
  /** URL to navigate to; renders an `<a>` when defined, a `<button>` otherwise. */
  href?: string;
  /** Ref to the rendered `<a>` or `<button>` element. */
  ref?: React.Ref<HTMLAnchorElement | HTMLButtonElement>;
}

/** The props both entry kinds share at runtime (the union narrowed by `href`). */
type NavEntryProps = NavItemOwnProps &
  Omit<React.AllHTMLAttributes<HTMLElement>, keyof NavItemOwnProps | 'ref'> & {
    ref?: React.Ref<HTMLElement>;
  };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const iconClasses = 'flex h-5 w-5 shrink-0 items-center justify-center';

/**
 * The `icon` slot of Nav.Item and Nav.Category, or `null` when it renders nothing. A falsy icon
 * (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in 0.4 and as in
 * Avatar, and so is a collection whose items render nothing, so no empty 20px box is rendered
 * before the label. The check does not consume a generator: renderSlot still renders its items.
 */
function renderIcon(
  icon: Slot<'span'> | undefined,
  className: string | undefined,
): React.ReactElement | null {
  return icon && slotRendersContent(icon)
    ? renderSlot(icon, 'span', cn(className, iconClasses), { 'aria-hidden': true })
    : null;
}

const itemClasses = {
  base: cn(
    'flex w-full items-center gap-2 px-4 py-2 text-body-1 text-start no-underline transition-colors motion-reduce:transition-none',
    focusRingInset,
    disabledStyles,
  ),
  selected: 'bg-subtle-selected text-primary font-semibold border-s-2 border-s-primary',
  idle: 'text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover',
};

const subItemClasses = {
  base: cn(
    'flex w-full items-center ps-11 pe-4 py-1.5 text-body-1 text-start no-underline transition-colors motion-reduce:transition-none',
    focusRingInset,
    disabledStyles,
  ),
  selected: 'text-primary font-semibold',
  idle: 'text-muted-foreground not-disabled:not-aria-disabled:hover:text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover',
};

const categoryButtonClasses = cn(
  'flex w-full items-center gap-2 px-4 py-2 text-body-1 font-semibold text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover transition-colors motion-reduce:transition-none',
  // A closed category that contains the current page shows the selected look of an item.
  'data-[contains-current]:bg-subtle-selected data-[contains-current]:text-primary data-[contains-current]:border-s-2 data-[contains-current]:border-s-primary',
  focusRingInset,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Whether a click on a link opens it somewhere other than the current page, checked as routers
 * do: a modifier key (a new tab or window, a download), a mouse button other than the main one, a
 * `target` other than `_self`, or a `download` link. Only when the default is not prevented does
 * the browser actually open it there.
 */
function opensElsewhere(event: React.MouseEvent<HTMLElement>): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return true;
  }
  const link = event.currentTarget;
  const target = link.getAttribute('target');
  return (!!target && target.toLowerCase() !== '_self') || link.hasAttribute('download');
}

/** The stable classes of an entry, written literally by Nav.Item and Nav.SubItem. */
interface NavEntryClassNames {
  root: string;
  listItem: string;
  icon?: string;
  content?: string;
}

/**
 * Shared rendering of Nav.Item and Nav.SubItem (link or button). Inside an arrow-key body
 * (`roving` provided) the link or button also carries `data-roving-value={value}`, after the
 * consumer's attributes; in a plain Nav nothing is added.
 */
function renderNavEntry(
  props: NavEntryProps,
  context: NavContextValue,
  roving: NavRovingContextValue | null,
  classes: { base: string; selected: string; idle: string },
  stable: NavEntryClassNames,
  withIcon: boolean,
): React.ReactElement {
  const { value, icon, disabled = false, href, className, children, onClick, ref, ...rest } = props;
  const isSelected = context.value === value;
  const isLink = href !== undefined;
  const rovingProps = roving ? { 'data-roving-value': value } : undefined;

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    // A link is still selected when the consumer prevents its default (client-side routing:
    // `preventDefault()` + `router.push(href)`, whatever the modifier keys: the browser then opens
    // nothing elsewhere), but not when the browser opens it elsewhere (the current page does not
    // change); a button honours `preventDefault()` (C-COMPOSE).
    if (isLink ? !event.defaultPrevented && opensElsewhere(event) : event.defaultPrevented) return;
    context.select(value);
  };

  const content = (
    <>
      {withIcon && renderIcon(icon, stable.icon)}
      {withIcon ? (
        <span className={cn(stable.content, 'flex-1 text-start')}>{children}</span>
      ) : (
        children
      )}
    </>
  );

  const entryClassName = cn(
    stable.root,
    classes.base,
    isSelected ? classes.selected : classes.idle,
    className,
  );

  if (isLink) {
    return (
      <li className={stable.listItem}>
        <a
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          {...rovingProps}
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={disabled ? undefined : href}
          role={disabled ? 'link' : rest.role}
          aria-disabled={disabled ? true : rest['aria-disabled']}
          aria-current={isSelected ? 'page' : undefined}
          onClick={handleClick}
          className={entryClassName}
        >
          {content}
        </a>
      </li>
    );
  }

  // `rel` only belongs on a link: a button item drops it (React types it on every element).
  const { rel, ...buttonRest } = rest;
  return (
    <li className={stable.listItem}>
      <button
        type="button"
        {...(buttonRest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...rovingProps}
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled}
        aria-current={isSelected ? 'page' : undefined}
        onClick={handleClick}
        className={entryClassName}
      >
        {content}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Nav.Category
// ---------------------------------------------------------------------------

/**
 * A collapsible group of sub-items. Its toggle button shows `label` and reports `aria-expanded`
 * (and `aria-controls` while open); the sub-items render in a nested list while it is open.
 * Open state lives on `Nav` (`openCategories`/`defaultOpenCategories`).
 *
 * A closed category that contains the current item marks its toggle button with
 * `aria-current="true"` (the button is not the page's link, so not `"page"`),
 * `data-contains-current` and the selected look of `Nav.Item`. It contains the current item when
 * a `Nav.SubItem` with the current value is among its children (through Fragments and wrapper
 * elements, also in the server HTML), when the current sub-item was last shown in it (and has not
 * moved among another category's children since), or when it is the Nav's `currentCategory`. An
 * open category is not marked: its sub-item shows the current page.
 *
 * Also exported as `NavCategory` (import the flat name from React Server Components).
 */
const NavCategory = ({
  value,
  label,
  icon,
  className,
  children,
  ref,
  ...rest
}: NavCategoryProps) => {
  const context = useNavContext('Nav.Category');
  const roving = React.useContext(NavRovingContext);
  const {
    value: currentValue,
    openCategories,
    toggleCategory,
    currentCategory,
    categoryStore,
  } = context;
  useNavValue(context, 'category', value);
  const listId = useId('wave-nav-category');
  const isOpen = openCategories.includes(value);

  // The current sub-item is among the children of this closed category (also on the server).
  const holdsCurrentChild = !isOpen && currentValue !== '' && containsValue(children, currentValue);
  // The current sub-item was last shown in this category (none on the server).
  const holdsShownCurrent = React.useSyncExternalStore(
    categoryStore.subscribe,
    () => currentValue !== '' && categoryStore.get(currentValue) === value,
    () => false,
  );
  // Children that hold the current sub-item make this the category the Nav remembers for it, so a
  // category it was shown in before it moved here is no longer marked. The entry is forgotten when
  // they stop holding it (an open category records through its mounted sub-item instead).
  React.useLayoutEffect(() => {
    if (!holdsCurrentChild) return;
    categoryStore.record(currentValue, value);
    return () => categoryStore.forget(currentValue, value);
  }, [categoryStore, holdsCurrentChild, currentValue, value]);
  const containsCurrent =
    !isOpen && (currentCategory === value || holdsShownCurrent || holdsCurrentChild);
  // Inside an arrow-key body: whether this is a closed category that holds the current page (the
  // body's first Tab stop), before paint; nothing is reported in a plain Nav.
  React.useLayoutEffect(() => {
    if (!roving) return;
    roving.reportCurrentCategory(value, containsCurrent);
    return () => roving.reportCurrentCategory(value, false);
  }, [roving, value, containsCurrent]);
  // Development only: every child of the open list is an <li> (`Nav.Category:list-child`).
  const listRef = React.useRef<HTMLUListElement>(null);
  useNavListChildCheck(listRef, 'Nav.Category', 'sub-items');

  let buttonLabel: React.ReactNode = label;
  let items: React.ReactNode = children;
  if (label === undefined) {
    // Deprecated 0.4 path: the text children are the label, the other children the sub-items.
    warnDeprecated(
      'Nav.Category',
      'text children as the label',
      'label',
      'Pass the category label in `label` and only the sub-items as children.',
    );
    const parts = React.Children.toArray(children);
    const isText = (part: unknown) => typeof part === 'string' || typeof part === 'number';
    buttonLabel = parts.filter(isText).join('');
    items = parts.filter((part) => !isText(part));
  }

  return (
    <li ref={ref} {...rest} className={cn(navCategoryClassNames.root, className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-current={containsCurrent ? true : undefined}
        data-contains-current={containsCurrent ? '' : undefined}
        data-roving-value={roving ? `wave-nav-category:${value}` : undefined}
        onClick={() => toggleCategory(value)}
        className={cn(navCategoryClassNames.button, categoryButtonClasses)}
      >
        {renderIcon(icon, navCategoryClassNames.icon)}
        <span className={cn(navCategoryClassNames.label, 'flex-1 text-start')}>{buttonLabel}</span>
        <ChevronDownIcon
          className={cn(
            navCategoryClassNames.expandIcon,
            'shrink-0 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <NavCategoryValueContext.Provider value={value}>
          <ul
            ref={listRef}
            id={listId}
            className={cn(navCategoryClassNames.list, 'm-0 list-none p-0')}
          >
            {items}
          </ul>
        </NavCategoryValueContext.Provider>
      )}
    </li>
  );
};
NavCategory.displayName = 'NavCategory';
markNavPart(NavCategory, 'category');

// ---------------------------------------------------------------------------
// Nav.Item / Nav.SubItem
// ---------------------------------------------------------------------------

/**
 * A top-level navigation entry: a link when `href` is given (anchor props), a button otherwise
 * (button props). Clicking selects it (`aria-current="page"`); activating a disabled entry never
 * selects it (a disabled entry whose value is the current value still shows as current).
 *
 * A click that opens a link somewhere other than the current page selects nothing (the consumer's
 * `onClick` still runs, and the browser opens the link): Ctrl/Cmd/Shift/Alt-click, a mouse button
 * other than the main one, a `target` other than `_self`, or a `download` link. When the consumer's
 * `onClick` calls `preventDefault()` (client-side routing), the browser opens nothing, so the item
 * is selected whatever the keys, button or `target`.
 *
 * Typed by overloads, resolved in order: without `href` (button props, button events), with a
 * string `href` (anchor props, anchor events), then an `href` that may be `undefined` at run time
 * ({@link NavItemDynamicProps}: events of either element).
 *
 * Also exported as `NavItem` (import the flat name from React Server Components).
 */
function NavItem(props: NavItemButtonProps): React.ReactElement;
function NavItem(props: NavItemAnchorProps): React.ReactElement;
function NavItem(props: NavItemDynamicProps): React.ReactElement;
function NavItem(props: NavItemProps | NavItemDynamicProps): React.ReactElement {
  const context = useNavContext('Nav.Item');
  useNavValue(context, 'item', props.value);
  useRecordCategory(context, props.value);
  const roving = React.useContext(NavRovingContext);
  return renderNavEntry(
    props as NavEntryProps,
    context,
    roving,
    itemClasses,
    {
      root: navItemClassNames.root,
      listItem: navItemClassNames.listItem,
      icon: navItemClassNames.icon,
      content: navItemClassNames.content,
    },
    true,
  );
}
NavItem.displayName = 'NavItem';
markNavPart(NavItem, 'entry');

/**
 * An indented entry inside a `Nav.Category`: a link when `href` is given, a button otherwise.
 * Selected like `Nav.Item` (a click that the browser opens somewhere else selects nothing; one
 * whose default your `onClick` prevents is selected), and typed by overloads like `Nav.Item`
 * (button, link, then {@link NavSubItemDynamicProps}).
 *
 * Also exported as `NavSubItem` (import the flat name from React Server Components).
 */
function NavSubItem(props: NavSubItemButtonProps): React.ReactElement;
function NavSubItem(props: NavSubItemAnchorProps): React.ReactElement;
function NavSubItem(props: NavSubItemDynamicProps): React.ReactElement;
function NavSubItem(props: NavSubItemProps | NavSubItemDynamicProps): React.ReactElement {
  const context = useNavContext('Nav.SubItem');
  useNavValue(context, 'item', props.value);
  useRecordCategory(context, props.value);
  const roving = React.useContext(NavRovingContext);
  return renderNavEntry(
    props as NavEntryProps,
    context,
    roving,
    subItemClasses,
    { root: navSubItemClassNames.root, listItem: navSubItemClassNames.listItem },
    false,
  );
}
NavSubItem.displayName = 'NavSubItem';
markNavPart(NavSubItem, 'entry');

/**
 * A vertical side navigation (`<nav>` landmark, default name "Navigation") with items, links and
 * collapsible categories.
 *
 * - **Selection**: `value`/`defaultValue`/`onValueChange` (`onValueChange` fires only when the
 *   value changes). The deprecated `selectedValue`/`defaultSelectedValue`/`onNavItemSelect` still
 *   work; `onNavItemSelect` keeps firing on every activation, re-selection included. A click that
 *   opens a link in another tab or window (or downloads it) selects nothing, unless the item's
 *   `onClick` prevents the default (client-side routing: then nothing opens elsewhere).
 * - **Categories**: `openCategories`/`defaultOpenCategories`/`onOpenCategoriesChange`. Without
 *   `defaultOpenCategories`, the categories containing the selected item (`value` or
 *   `defaultValue`) start open. A closed category that contains the selected item marks its toggle
 *   (`aria-current="true"`, `data-contains-current`, the selected look); pass `currentCategory`
 *   for sub-items your own component renders inside a closed category.
 * - **Values** are unique: among the items and sub-items, and among the categories (a duplicate
 *   warns in development).
 * - **Structure**: every child of the Nav, and of a category, is a part or your own `<li>`; a
 *   development warning names anything else (a `<div>`, text, the wrapper of a Tooltip around an
 *   item). `Nav.SectionHeader` is a heading between groups of items (`<h3>` unless
 *   `headingLevel`, which stands for the `as` of Fluent's NavSectionHeader), and `Nav.Divider` a
 *   line between groups, hidden from assistive technology (Fluent's NavDivider is a separator).
 * - **App identity**: `Nav.AppItem` shows the app's name and logo at the top, as a link with
 *   `href` or a button; it is never selected. `Nav.AppItemStatic` shows them as plain text.
 *
 * Sub-components are also exported under flat names (`NavCategory`, `NavItem`, `NavSubItem`,
 * `NavSectionHeader`, `NavDivider`, `NavAppItem`, `NavAppItemStatic`): React Server Components
 * import those, because dotted access (`Nav.Item`) needs a client file.
 */
export const Nav = /* @__PURE__ */ Object.assign(NavRoot, {
  Category: NavCategory,
  Item: NavItem,
  SubItem: NavSubItem,
  SectionHeader: NavSectionHeader,
  Divider: NavDivider,
  AppItem: NavAppItem,
  AppItemStatic: NavAppItemStatic,
});

export {
  NavCategory,
  NavItem,
  NavSubItem,
  NavSectionHeader,
  NavDivider,
  NavAppItem,
  NavAppItemStatic,
};
