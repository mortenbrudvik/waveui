import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import {
  reportMissingContext,
  resolveDeprecatedProp,
  warnDeprecated,
  warnOnce,
} from '../../lib/dev';
import { getElementType } from '../../lib/children';
import { ChevronDownIcon } from '../../lib/icons';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** The two value namespaces of a Nav: items (Nav.Item and Nav.SubItem) and categories. */
type NavValueKind = 'item' | 'category';

/**
 * The category each sub-item was last shown in, by sub-item value: written from layout effects by
 * the mounted sub-items and by a closed category whose children hold the current value, read by
 * the categories with `useSyncExternalStore`. An entry outlives its sub-item, so a category closed
 * after its current sub-item was shown still knows it contains the current page.
 */
interface NavCategoryStore {
  /**
   * Records the category a mounted item renders in, or a closed category whose children hold the
   * value; `null` (an item outside any category) forgets an earlier entry, so a value moved out of
   * a category no longer marks it.
   */
  record: (value: string, category: string | null) => void;
  /** Forgets the entry of `value` while it is still `category`. */
  forget: (value: string, category: string) => void;
  /** The category last recorded for a sub-item value. */
  get: (value: string) => string | undefined;
  subscribe: (listener: () => void) => () => void;
}

function createCategoryStore(): NavCategoryStore {
  const categories = new Map<string, string>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    record(value, category) {
      if ((categories.get(value) ?? null) === category) return;
      if (category === null) categories.delete(value);
      else categories.set(value, category);
      notify();
    },
    forget(value, category) {
      if (categories.get(value) !== category) return;
      categories.delete(value);
      notify();
    },
    get: (value) => categories.get(value),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

interface NavContextValue {
  /** The selected item value (`''` when nothing is selected). */
  value: string;
  /** Selects an item (activation handler: also fires the deprecated `onNavItemSelect`). */
  select: (value: string) => void;
  openCategories: readonly string[];
  toggleCategory: (value: string) => void;
  /** Registers a mounted item or category value (duplicate warning); returns the cleanup. */
  registerValue: (kind: NavValueKind, value: string) => () => void;
  /** The `currentCategory` hint of the Nav. */
  currentCategory: string | undefined;
  categoryStore: NavCategoryStore;
}

const NavContext = React.createContext<NavContextValue | null>(null);
NavContext.displayName = 'NavContext';

const noop = () => {};
const INERT_NAV_CONTEXT: NavContextValue = {
  value: '',
  select: noop,
  openCategories: [],
  toggleCategory: noop,
  registerValue: () => noop,
  currentCategory: undefined,
  categoryStore: { record: noop, forget: noop, get: () => undefined, subscribe: () => noop },
};

/**
 * The value of the Nav.Category a sub-item renders in (`null` outside a category). It renders no
 * element; a sub-item outside a category is valid, so there is no missing-context error.
 */
const NavCategoryValueContext = React.createContext<string | null>(null);
NavCategoryValueContext.displayName = 'NavCategoryValueContext';

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
function useNavContext(componentName: string): NavContextValue {
  const context = React.useContext(NavContext);
  if (context) return context;
  reportMissingContext(componentName, 'Nav');
  return INERT_NAV_CONTEXT;
}

function warnDuplicateValue(kind: NavValueKind, value: string): void {
  warnOnce(
    `Nav:duplicate-${kind}:${value}`,
    kind === 'item'
      ? `Nav: several items share the value "${value}". Nav.Item and Nav.SubItem values must be unique within a Nav; every item with the current value is marked as the current page.`
      : `Nav: several categories share the value "${value}". Nav.Category values must be unique within a Nav; they open and close together.`,
  );
}

/** Registers the value of a mounted item or category, so Nav can warn about duplicates. */
function useNavValue(context: NavContextValue, kind: NavValueKind, value: string): void {
  const { registerValue } = context;
  React.useEffect(() => registerValue(kind, value), [registerValue, kind, value]);
}

/**
 * Records the category a mounted item renders in, which the category reads once closed (`null`
 * outside a category, which forgets a stale entry for the value).
 */
function useRecordCategory(context: NavContextValue, value: string): void {
  const category = React.useContext(NavCategoryValueContext);
  const { categoryStore } = context;
  React.useLayoutEffect(() => {
    categoryStore.record(value, category);
  }, [categoryStore, value, category]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Properties for the Nav component. */
export interface NavProps extends Omit<React.HTMLAttributes<HTMLElement>, 'defaultValue'> {
  /** Controlled value of the selected nav item. */
  value?: string;
  /**
   * Selected nav item value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Called with the new value when the selection changes (not when the current item is re-selected). */
  onValueChange?: (value: string) => void;
  /** @deprecated Use `value`. */
  selectedValue?: string;
  /** @deprecated Use `defaultValue`. */
  defaultSelectedValue?: string;
  /**
   * @deprecated Use `onValueChange`. Unlike `onValueChange`, it fires on every activation,
   * re-selecting the current item included (0.4 behaviour).
   */
  onNavItemSelect?: (value: string) => void;
  /** Controlled list of open category values. */
  openCategories?: readonly string[];
  /**
   * Categories open initially (uncontrolled). Without it, the categories that contain the
   * selected item (`value`, else `defaultValue`) start open, so the current page is visible on the
   * first render; an empty list keeps every category closed.
   */
  defaultOpenCategories?: readonly string[];
  /** Called with the new list of open category values (a new array) when a category is toggled. */
  onOpenCategoriesChange?: (openCategories: string[]) => void;
  /**
   * The `value` of the category that contains the current item, for sub-items Nav cannot find by
   * itself (rendered by your own component inside a closed category). Usually not needed: Nav
   * finds sub-items among a category's children (through Fragments and wrapper elements) and
   * remembers the category of the current sub-item once it has been shown. A hint, not state:
   * unlike Fluent's `selectedCategoryValue` it has no default or change callback.
   */
  currentCategory?: string;
  /** Ref to the `<nav>` element. */
  ref?: React.Ref<HTMLElement>;
}

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
  /** The category's sub-items (`Nav.SubItem`), rendered in its list while it is open. */
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
 * The attributes only a link has (`target`, `download`, `hrefLang`, `ping`, …). Button items
 * declare them as `undefined`, so they are a type error without `href` instead of landing on the
 * `<button>`. `rel` cannot be listed (React types it on every element, RDFa); a button item drops
 * it at run time instead.
 */
type NoAnchorOnlyAttributes = {
  [
    K in Exclude<
      keyof React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof React.ButtonHTMLAttributes<HTMLButtonElement>
    >
  ]?: undefined;
};

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
function renderIcon(icon: Slot<'span'> | undefined): React.ReactElement | null {
  return icon && slotRendersContent(icon)
    ? renderSlot(icon, 'span', iconClasses, { 'aria-hidden': true })
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

type ElementWithChildren = React.ReactElement<{ value?: unknown; children?: React.ReactNode }>;

function childrenOf(element: ElementWithChildren): React.ReactNode {
  const { children } = element.props;
  return typeof children === 'function' ? undefined : children;
}

/** Whether a thrown value suspends rendering (a loading lazy chunk, a pending promise). */
function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/*
 * The walks below run during Nav's render and reach consumer content at any depth. Content that
 * is still loading inside the consumer's own <Suspense> (a promise child, a lazy node, a
 * `React.lazy` component) suspends that boundary when React renders it; walking it must never
 * suspend Nav itself, which would hide the whole Nav behind an outer boundary. So a child that
 * cannot be read yet is skipped, and a lazy type that is still loading is not a part (its
 * children are still walked). Parts written in a Server Component arrive as loaded client
 * references and are recognized.
 */

/** Calls `visit` with each element of `nodes` (as `React.Children.forEach`), skipping pending ones. */
function forEachElement(nodes: React.ReactNode, visit: (child: ElementWithChildren) => void): void {
  if (Array.isArray(nodes)) {
    for (const node of nodes as React.ReactNode[]) forEachElement(node, visit);
    return;
  }
  try {
    React.Children.forEach(nodes, (child) => {
      if (React.isValidElement<ElementWithChildren['props']>(child)) visit(child);
    });
  } catch (error) {
    if (!isThenable(error)) throw error;
  }
}

/** Whether `element` is one of `types`; a lazy type still loading is none (it never suspends). */
function isPart(element: ElementWithChildren, ...types: unknown[]): boolean {
  return types.includes(getElementType(element, { suspend: false }));
}

/**
 * Whether `nodes` contain a Nav.Item/Nav.SubItem element with `value === selected` (parts written
 * in a Server Component, lazy client references, included). Called during render only.
 */
function containsValue(nodes: React.ReactNode, selected: string): boolean {
  let found = false;
  forEachElement(nodes, (child) => {
    if (found) return;
    if (isPart(child, NavItem, NavSubItem) && child.props.value === selected) {
      found = true;
    } else {
      found = containsValue(childrenOf(child), selected);
    }
  });
  return found;
}

/** The values of the Nav.Category elements (at any depth of JSX) that contain `selected`. */
function findCategoriesContaining(nodes: React.ReactNode, selected: string): string[] {
  const result: string[] = [];
  if (!selected) return result;
  const visit = (current: React.ReactNode) => {
    forEachElement(current, (child) => {
      const inner = childrenOf(child);
      if (
        isPart(child, NavCategory) &&
        typeof child.props.value === 'string' &&
        containsValue(inner, selected)
      ) {
        result.push(child.props.value);
      }
      visit(inner);
    });
  };
  visit(nodes);
  return result;
}

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

/** Shared rendering of Nav.Item and Nav.SubItem (link or button). */
function renderNavEntry(
  props: NavEntryProps,
  context: NavContextValue,
  classes: { base: string; selected: string; idle: string },
  withIcon: boolean,
): React.ReactElement {
  const { value, icon, disabled = false, href, className, children, onClick, ref, ...rest } = props;
  const isSelected = context.value === value;
  const isLink = href !== undefined;

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
      {withIcon && renderIcon(icon)}
      {withIcon ? <span className="flex-1 text-start">{children}</span> : children}
    </>
  );

  const entryClassName = cn(classes.base, isSelected ? classes.selected : classes.idle, className);

  if (isLink) {
    return (
      <li>
        <a
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
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
    <li>
      <button
        type="button"
        {...(buttonRest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
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
    <li ref={ref} {...rest} className={className}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-current={containsCurrent ? true : undefined}
        data-contains-current={containsCurrent ? '' : undefined}
        onClick={() => toggleCategory(value)}
        className={categoryButtonClasses}
      >
        {renderIcon(icon)}
        <span className="flex-1 text-start">{buttonLabel}</span>
        <ChevronDownIcon
          className={cn(
            'shrink-0 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <NavCategoryValueContext.Provider value={value}>
          <ul id={listId} className="m-0 list-none p-0">
            {items}
          </ul>
        </NavCategoryValueContext.Provider>
      )}
    </li>
  );
};
NavCategory.displayName = 'NavCategory';

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
  return renderNavEntry(props as NavEntryProps, context, itemClasses, true);
}
NavItem.displayName = 'NavItem';

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
  return renderNavEntry(props as NavEntryProps, context, subItemClasses, false);
}
NavSubItem.displayName = 'NavSubItem';

// ---------------------------------------------------------------------------
// Nav (root)
// ---------------------------------------------------------------------------

const NavRoot = ({
  value: valueProp,
  defaultValue: defaultValueProp,
  onValueChange,
  selectedValue,
  defaultSelectedValue,
  onNavItemSelect,
  openCategories: openCategoriesProp,
  defaultOpenCategories,
  onOpenCategoriesChange,
  currentCategory,
  className,
  children,
  ref,
  ...rest
}: NavProps) => {
  const controlledValue = resolveDeprecatedProp(
    'Nav',
    valueProp,
    selectedValue,
    'selectedValue',
    'value',
  );
  const defaultValue =
    resolveDeprecatedProp(
      'Nav',
      defaultValueProp,
      defaultSelectedValue,
      'defaultSelectedValue',
      'defaultValue',
    ) ?? '';
  if (onNavItemSelect !== undefined) warnDeprecated('Nav', 'onNavItemSelect', 'onValueChange');

  const [value, setValue] = useControllable(controlledValue, defaultValue, onValueChange);
  const notifyNavItemSelect = useEventCallback(onNavItemSelect);
  const select = React.useCallback(
    (next: string) => {
      setValue(next);
      // Deprecated event-named alias: every activation, re-selection included (C-NAMING).
      notifyNavItemSelect(next);
    },
    [setValue, notifyNavItemSelect],
  );

  const [initialOpenCategories] = React.useState<readonly string[]>(
    () =>
      defaultOpenCategories ?? findCategoriesContaining(children, controlledValue ?? defaultValue),
  );
  const [openCategories, setOpenCategories] = useControllable<readonly string[]>(
    openCategoriesProp,
    initialOpenCategories,
    (next) => onOpenCategoriesChange?.([...next]),
  );
  const toggleCategory = React.useCallback(
    (category: string) => {
      setOpenCategories((previous) =>
        previous.includes(category)
          ? previous.filter((entry) => entry !== category)
          : [...previous, category],
      );
    },
    [setOpenCategories],
  );

  // Duplicate values (C-DEV): the mounted items and categories per value (written from their
  // effects only); a second one with a value already in use warns once per value.
  const valueCountsRef = React.useRef<Map<string, number> | null>(null);
  const registerValue = React.useCallback((kind: NavValueKind, entry: string) => {
    const counts = (valueCountsRef.current ??= new Map<string, number>());
    const key = `${kind}:${entry}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > 1) warnDuplicateValue(kind, entry);
    return () => {
      const remaining = (counts.get(key) ?? 1) - 1;
      if (remaining > 0) counts.set(key, remaining);
      else counts.delete(key);
    };
  }, []);

  const [categoryStore] = React.useState(createCategoryStore);

  const contextValue = React.useMemo<NavContextValue>(
    () => ({
      value,
      select,
      openCategories,
      toggleCategory,
      registerValue,
      currentCategory,
      categoryStore,
    }),
    [value, select, openCategories, toggleCategory, registerValue, currentCategory, categoryStore],
  );

  return (
    <NavContext.Provider value={contextValue}>
      <nav
        aria-label="Navigation"
        {...rest}
        ref={ref}
        className={cn('w-60 border-e border-border bg-background py-2', className)}
      >
        <ul className="m-0 list-none p-0">{children}</ul>
      </nav>
    </NavContext.Provider>
  );
};
NavRoot.displayName = 'Nav';

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
 *
 * Sub-components are also exported under flat names (`NavCategory`, `NavItem`, `NavSubItem`):
 * React Server Components import those, because dotted access (`Nav.Item`) needs a client file.
 */
export const Nav = /* @__PURE__ */ Object.assign(NavRoot, {
  Category: NavCategory,
  Item: NavItem,
  SubItem: NavSubItem,
});

export { NavCategory, NavItem, NavSubItem };
