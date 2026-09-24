import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Slot } from '../../lib/types';
import { renderSlot } from '../../lib/slot';
import { isDev, resolveDeprecatedProp, warnDeprecated } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface NavContextValue {
  /** The selected item value (`''` when nothing is selected). */
  value: string;
  /** Selects an item (activation handler: also fires the deprecated `onNavItemSelect`). */
  select: (value: string) => void;
  openCategories: string[];
  toggleCategory: (value: string) => void;
}

const NavContext = React.createContext<NavContextValue | null>(null);
NavContext.displayName = 'NavContext';

const INERT_NAV_CONTEXT: NavContextValue = {
  value: '',
  select: () => {},
  openCategories: [],
  toggleCategory: () => {},
};

/** C-CONTEXT: throws in development, logs and returns an inert value in production. */
function useNavContext(componentName: string): NavContextValue {
  const context = React.useContext(NavContext);
  if (context) return context;
  const message = `[WaveUI] ${componentName} must be used within Nav`;
  if (isDev) throw new Error(message);
  console.error(message);
  return INERT_NAV_CONTEXT;
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
  openCategories?: string[];
  /**
   * Categories open initially (uncontrolled). Defaults to the categories that contain the
   * selected item, so the current page is visible on the first render.
   */
  defaultOpenCategories?: string[];
  /** Called with the new list of open category values when a category is toggled. */
  onOpenCategoriesChange?: (openCategories: string[]) => void;
  /** Ref to the `<nav>` element. */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the NavCategory sub-component. */
export interface NavCategoryProps extends React.HTMLAttributes<HTMLLIElement> {
  /** Unique value identifying this category (used by `openCategories`). */
  value: string;
  /**
   * Label of the category's toggle button (any content). Without it, the text children are used
   * as the label — deprecated: pass the label here and only the sub-items as children.
   */
  label?: React.ReactNode;
  /** Icon displayed before the category label. Rendered with `aria-hidden="true"`. */
  icon?: Slot<'span'>;
  /** The category's sub-items (`Nav.SubItem`), rendered in its list while it is open. */
  children?: React.ReactNode;
  /** Ref to the category's `<li>` element. */
  ref?: React.Ref<HTMLLIElement>;
}

interface NavItemOwnProps {
  /** Unique value identifying this nav item. */
  value: string;
  /** Icon displayed before the item label. Rendered with `aria-hidden="true"`. */
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
  [K in Exclude<
    keyof React.AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof React.ButtonHTMLAttributes<HTMLButtonElement>
  >]?: undefined;
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

type NavSubItemOwnProps = Omit<NavItemOwnProps, 'icon'>;

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

/** Whether `nodes` contain a Nav.Item/Nav.SubItem element with `value === selected`. */
function containsValue(nodes: React.ReactNode, selected: string): boolean {
  let found = false;
  React.Children.forEach(nodes, (child) => {
    if (found || !React.isValidElement<ElementWithChildren['props']>(child)) return;
    if ((child.type === NavItem || child.type === NavSubItem) && child.props.value === selected) {
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
    React.Children.forEach(current, (child) => {
      if (!React.isValidElement<ElementWithChildren['props']>(child)) return;
      const inner = childrenOf(child);
      if (
        child.type === NavCategory &&
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
    // `preventDefault()` + `router.push(href)`); a button honours `preventDefault()` (C-COMPOSE).
    if (!isLink && event.defaultPrevented) return;
    context.select(value);
  };

  const content = (
    <>
      {withIcon && renderSlot(icon, 'span', iconClasses, { 'aria-hidden': true })}
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
  const { openCategories, toggleCategory } = useNavContext('Nav.Category');
  const listId = useId('wave-nav-category');
  const isOpen = openCategories.includes(value);

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
        onClick={() => toggleCategory(value)}
        className={categoryButtonClasses}
      >
        {renderSlot(icon, 'span', iconClasses, { 'aria-hidden': true })}
        <span className="flex-1 text-start">{buttonLabel}</span>
        <ChevronDownIcon
          className={cn(
            'shrink-0 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <ul id={listId} className="m-0 list-none p-0">
          {items}
        </ul>
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
  return renderNavEntry(props as NavEntryProps, context, itemClasses, true);
}
NavItem.displayName = 'NavItem';

/**
 * An indented entry inside a `Nav.Category`: a link when `href` is given, a button otherwise.
 * Typed by overloads like `Nav.Item` (button, link, then {@link NavSubItemDynamicProps}).
 *
 * Also exported as `NavSubItem` (import the flat name from React Server Components).
 */
function NavSubItem(props: NavSubItemButtonProps): React.ReactElement;
function NavSubItem(props: NavSubItemAnchorProps): React.ReactElement;
function NavSubItem(props: NavSubItemDynamicProps): React.ReactElement;
function NavSubItem(props: NavSubItemProps | NavSubItemDynamicProps): React.ReactElement {
  const context = useNavContext('Nav.SubItem');
  return renderNavEntry(props as NavEntryProps, context, subItemClasses, false);
}
NavSubItem.displayName = 'NavSubItem';

// ---------------------------------------------------------------------------
// Nav (root)
// ---------------------------------------------------------------------------

/**
 * A vertical side navigation (`<nav>` landmark, default name "Navigation") with items, links and
 * collapsible categories.
 *
 * - **Selection**: `value`/`defaultValue`/`onValueChange` (`onValueChange` fires only when the
 *   value changes). The deprecated `selectedValue`/`defaultSelectedValue`/`onNavItemSelect` still
 *   work; `onNavItemSelect` keeps firing on every activation, re-selection included.
 * - **Categories**: `openCategories`/`defaultOpenCategories`/`onOpenCategoriesChange`. Without
 *   `defaultOpenCategories`, the categories containing the selected item start open.
 *
 * Sub-components are also exported under flat names (`NavCategory`, `NavItem`, `NavSubItem`):
 * React Server Components import those, because dotted access (`Nav.Item`) needs a client file.
 */
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

  const [initialOpenCategories] = React.useState<string[]>(
    () =>
      defaultOpenCategories ?? findCategoriesContaining(children, controlledValue ?? defaultValue),
  );
  const [openCategories, setOpenCategories] = useControllable(
    openCategoriesProp,
    initialOpenCategories,
    onOpenCategoriesChange,
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

  const contextValue = React.useMemo<NavContextValue>(
    () => ({ value, select, openCategories, toggleCategory }),
    [value, select, openCategories, toggleCategory],
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

export const Nav = /* @__PURE__ */ Object.assign(NavRoot, {
  Category: NavCategory,
  Item: NavItem,
  SubItem: NavSubItem,
});

export { NavCategory, NavItem, NavSubItem };
