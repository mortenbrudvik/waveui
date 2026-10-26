import * as React from 'react';
import { preventIfDisabled } from '../../lib/aria';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import {
  breadcrumbClassNames,
  breadcrumbItemClassNames,
  breadcrumbOverflowClassNames,
} from '../../lib/classNames';
import { partitionBreadcrumbItems } from '../../lib/breadcrumb';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import type { CoreSize, FocusMode, Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { warnOnce } from '../../lib/dev';
import { ChevronRightIcon } from '../../lib/icons';
import { disabledStyles, focusRing } from '../../lib/styles';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { useTriggerElement } from '../../hooks/useTriggerElement';
import { Menu } from './Menu';

/** Properties for the Breadcrumb component. */
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Breadcrumb items to render; each one is placed in its own list item. Fragments are opened, so
   * the items of a conditional group (`{isAdmin && <>…</>}`) each get their own list item too.
   */
  children: React.ReactNode;
  /**
   * The most items the trail shows, the overflow button not counted. A longer trail collapses its
   * middle items, from `overflowIndex`, into a "…" button that opens a menu of them (a link item
   * becomes a `Menu.ItemLink`, a button item a `Menu.Item`). The first item and the last `current`
   * item are never hidden. Without it the whole trail is shown. A value below 1 means 6, as in
   * `partitionBreadcrumbItems`.
   */
  maxDisplayedItems?: number;
  /**
   * The index of the first collapsed item (with `maxDisplayedItems`). It is at least 1, so the
   * first item stays, and at most `maxDisplayedItems - 1`.
   * @default 1
   */
  overflowIndex?: number;
  /**
   * Accessible name of the overflow button (with `maxDisplayedItems`).
   * @default "More items"
   */
  overflowLabel?: string;
  /**
   * Text and divider size.
   * @default 'medium'
   */
  size?: CoreSize;
  /**
   * `'tab'`: every link is a Tab stop. `'arrow'`: the trail is one Tab stop (the last focused link
   * or button, at first the first one) and the arrow keys (mirrored in right-to-left layouts),
   * Home and End move between its links and the overflow button.
   * @default 'tab'
   */
  focusMode?: FocusMode;
  /**
   * The separator between items; a decorative `<span>`. `null` or `undefined` keep the chevron
   * (mirrored in right-to-left layouts); `false`, or content that renders nothing, hides the
   * separators. A custom divider is not mirrored.
   */
  divider?: Slot<'span'>;
  /** Ref to the `<nav>` element. */
  ref?: React.Ref<HTMLElement>;
}

/**
 * The props of Breadcrumb.Item that every branch shares ({@link BreadcrumbItemAnchorProps},
 * {@link BreadcrumbItemButtonProps}, {@link BreadcrumbItemDynamicProps}).
 */
export interface BreadcrumbItemOwnProps {
  /**
   * Whether this item represents the current page (`aria-current="page"`, rendered as text).
   * @default false
   */
  current?: boolean;
  /**
   * Slot for an icon displayed before the item text. Rendered with `aria-hidden="true"`. A falsy
   * icon (`''`, `0`) or a list of nothing renders no icon span.
   */
  icon?: Slot<'span'>;
  /**
   * Merge the item's props (classes, `aria-current`, handlers, ref) onto its single child element
   * instead of rendering an element — for router links:
   * `<Breadcrumb.Item asChild><RouterLink to="/docs">Docs</RouterLink></Breadcrumb.Item>`.
   * The icon is rendered inside the child. The item's `href` is passed on as a default (the
   * element's own `href` wins); with a router link, give the link its destination (`to`) instead.
   * `disabled` or `aria-disabled="true"`, on the item or on the element, makes it an unavailable
   * link: `aria-disabled`, out of the tab order, its own `onClick` dropped and the click cancelled
   * (a router link does not navigate); an `<a>` also loses its `href`.
   * @default false
   */
  asChild?: boolean;
  /** Label content of the breadcrumb item (with `asChild`: the link element). */
  children: React.ReactNode;
}

/**
 * The attributes only a link has (`target`, `download`, `hrefLang`, `ping`, …). Items without
 * `href` declare them as `undefined`, so they are a type error instead of landing on a `<button>`
 * or `<span>`. `rel` cannot be listed (React types it on every element, RDFa); every non-link item
 * drops it at run time instead.
 */
type NoAnchorOnlyAttributes = {
  [
    K in Exclude<
      keyof React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof React.ButtonHTMLAttributes<HTMLButtonElement>
    >
  ]?: undefined;
};

/** Breadcrumb.Item rendered as a link (`href` given): anchor attributes. */
export interface BreadcrumbItemAnchorProps
  extends
    BreadcrumbItemOwnProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BreadcrumbItemOwnProps> {
  /**
   * URL the breadcrumb item links to; renders an `<a>` (unless `current`). With `asChild` it is a
   * default for the element, whose own `href` wins. Required in this branch, so `href`
   * discriminates the union and handlers without `href` are typed as button handlers.
   */
  href: string;
  /**
   * Makes the link unavailable, as Link's `disabled` does: no `href`, `role="link"`,
   * `aria-disabled="true"`, out of the tab order, and the click is cancelled (`onClick` is not
   * called). `aria-disabled="true"` does the same.
   * @default false
   */
  disabled?: boolean;
  /** Ref to the rendered element (`<a>`, or `<span>` for the current item). */
  ref?: React.Ref<HTMLAnchorElement | HTMLSpanElement>;
}

/**
 * Breadcrumb.Item without `href`: a `<button type="button">` when `onClick` is given (button
 * attributes; `disabled` gives it the disabled look), plain text otherwise. A `rel` is not
 * rendered on either.
 */
export interface BreadcrumbItemButtonProps
  extends
    BreadcrumbItemOwnProps,
    NoAnchorOnlyAttributes,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BreadcrumbItemOwnProps> {
  /** Items without a link have no `href`. */
  href?: undefined;
  /** Ref to the rendered element (`<button>`, or `<span>` for text and the current item). */
  ref?: React.Ref<HTMLButtonElement | HTMLSpanElement>;
}

/**
 * Properties for the BreadcrumbItem sub-component: link props with `href`, button props without.
 *
 * A union type (0.4 had an interface): an interface cannot extend it, so extend one branch
 * (`interface X extends BreadcrumbItemAnchorProps`) or intersect
 * (`type X = BreadcrumbItemProps & { … }`). `React.ComponentProps<typeof Breadcrumb.Item>`
 * resolves to the last overload, {@link BreadcrumbItemDynamicProps}.
 */
export type BreadcrumbItemProps = BreadcrumbItemAnchorProps | BreadcrumbItemButtonProps;

/**
 * Breadcrumb.Item with an `href` known only at run time (`string | undefined`): a link when it is
 * a string, otherwise a button (with `onClick`) or text. Handlers receive `HTMLElement` events and
 * only the attributes all kinds share are accepted (the 0.4 prop shape). Resolved after the button
 * and link signatures.
 */
export interface BreadcrumbItemDynamicProps
  extends
    BreadcrumbItemOwnProps,
    Omit<React.HTMLAttributes<HTMLElement>, keyof BreadcrumbItemOwnProps> {
  /** URL the breadcrumb item links to when defined. */
  href?: string;
  /**
   * Makes a link or button item unavailable (see {@link BreadcrumbItemAnchorProps} and
   * {@link BreadcrumbItemButtonProps}); ignored, with a development warning, on a text or current
   * item.
   * @default false
   */
  disabled?: boolean;
  /** Ref to the rendered element. */
  ref?: React.Ref<HTMLElement>;
}

/** The props every item kind shares at runtime (the union narrowed by `href`). */
type BreadcrumbEntryProps = BreadcrumbItemOwnProps &
  Omit<React.AllHTMLAttributes<HTMLElement>, keyof BreadcrumbItemOwnProps | 'ref'> & {
    ref?: React.Ref<HTMLElement>;
  };

/**
 * Links, buttons and `asChild` elements. The hover underline is gated (C-TOKENS), and the
 * disabled look covers a `disabled` button and an `aria-disabled` link.
 */
const linkClasses = cn(
  'inline-flex cursor-pointer items-center text-primary no-underline not-disabled:not-aria-disabled:hover:underline',
  focusRing,
  disabledStyles,
);
const currentClasses = 'inline-flex items-center font-semibold text-foreground';
/** A current `asChild` element is the consumer's link: it takes focus and can be disabled. */
const currentChildClasses = cn(currentClasses, focusRing, disabledStyles);
const textClasses = 'inline-flex items-center text-foreground';

/**
 * The attributes only a `<button>` or an `<a>` has (`disabled`, `type`, `form*`, `name`, `value`;
 * `target`, `download`, `hrefLang`, `ping`, `media`, `referrerPolicy`). The button props allow
 * `disabled` without `onClick`, and a current item keeps its link attributes, so the `<span>` of
 * the text and current items drops them instead of rendering invalid markup
 * (`<span disabled>`, `<span target="_blank">`). Typed as a record so a key React adds to either
 * element's attributes is a compile error until it is listed here. `rel` is dropped as well: React
 * types it on every element (RDFa), but on a breadcrumb it comes with a link.
 */
type ControlOnlyAttribute =
  | Exclude<
      keyof React.ButtonHTMLAttributes<HTMLButtonElement>,
      keyof React.HTMLAttributes<HTMLElement>
    >
  | Exclude<
      keyof React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof React.HTMLAttributes<HTMLElement> | 'href'
    >;

const controlOnlyAttributes: ReadonlySet<string> = /* @__PURE__ */ new Set([
  'rel',
  ...Object.keys({
    disabled: true,
    type: true,
    form: true,
    formAction: true,
    formEncType: true,
    formMethod: true,
    formNoValidate: true,
    formTarget: true,
    name: true,
    value: true,
    target: true,
    download: true,
    hrefLang: true,
    ping: true,
    media: true,
    referrerPolicy: true,
  } satisfies Record<ControlOnlyAttribute, true>),
]);

/** The props that are valid on the `<span>` of a text or current item. */
function spanAttributes(rest: Record<string, unknown>): React.HTMLAttributes<HTMLSpanElement> {
  const attributes: Record<string, unknown> = {};
  for (const key of Object.keys(rest)) {
    if (!controlOnlyAttributes.has(key)) attributes[key] = rest[key];
  }
  return attributes as React.HTMLAttributes<HTMLSpanElement>;
}

/** Text step and divider size (px) of each size; literal classes for Tailwind's scan. */
const breadcrumbSizes = {
  small: { text: 'text-caption-1', divider: 12 },
  medium: { text: 'text-body-1', divider: 12 },
  large: { text: 'text-body-2', divider: 16 },
} as const satisfies Record<CoreSize, { text: string; divider: number }>;

/** The controls of the trail that the arrow keys visit (`focusMode="arrow"`). */
const BREADCRUMB_FOCUS_SELECTOR = 'a[href], button, [role="link"]';

/** The key of the list item that holds the overflow button; a flattened child key never matches. */
const OVERFLOW_KEY = '\u0000overflow';

type BreadcrumbEntry = ReturnType<typeof flattenChildren>[number];

/** The props of a trail item that the overflow menu reads. */
interface HiddenItemProps {
  href?: string;
  current?: boolean;
  icon?: Slot<'span'>;
  disabled?: boolean;
  asChild?: boolean;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

function isCurrentEntry(entry: BreadcrumbEntry): boolean {
  return (
    isElementOfType<HiddenItemProps>(entry.node, BreadcrumbItem) &&
    entry.node.props.current === true
  );
}

/**
 * The indexes of the entries that collapse into the overflow menu, ascending. The partition of
 * `partitionBreadcrumbItems` decides, except that the first entry and the last current one stay:
 * a protected entry in the range is replaced by the next unprotected entry after it, else before.
 */
function collapsedIndexes(
  entries: readonly BreadcrumbEntry[],
  maxDisplayedItems: number | undefined,
  overflowIndex: number,
): number[] {
  if (maxDisplayedItems === undefined) return [];
  const { overflowItems } = partitionBreadcrumbItems({
    items: entries.map((_, index) => index),
    maxDisplayedItems,
    overflowIndex: Math.max(1, overflowIndex),
  });
  if (!overflowItems) return [];
  const current = entries.map(isCurrentEntry).lastIndexOf(true);
  const isProtected = (index: number) => index === 0 || index === current;
  const collapsed = overflowItems.filter((index) => !isProtected(index));
  for (
    let next = overflowItems[overflowItems.length - 1] + 1;
    collapsed.length < overflowItems.length && next < entries.length;
    next++
  ) {
    if (!isProtected(next)) collapsed.push(next);
  }
  for (
    let before = overflowItems[0] - 1;
    collapsed.length < overflowItems.length && before >= 1;
    before--
  ) {
    if (!isProtected(before)) collapsed.push(before);
  }
  return collapsed.sort((a, b) => a - b);
}

/**
 * The menu item of a collapsed trail item: a `Menu.ItemLink` for a link (an `asChild` element
 * with an `href` too), a `Menu.Item` for a button. An item with neither is listed disabled, and an
 * element that is no `Breadcrumb.Item` is left out; both are not `mappable`.
 */
function overflowMenuItem(entry: BreadcrumbEntry): { node: React.ReactNode; mappable: boolean } {
  const item = entry.node;
  if (!isElementOfType<HiddenItemProps>(item, BreadcrumbItem)) {
    return { node: null, mappable: false };
  }
  const { href: itemHref, icon, disabled, asChild, children, onClick } = item.props;
  const inner =
    asChild && React.isValidElement<{ href?: string; children?: React.ReactNode }>(children)
      ? children
      : null;
  const label = inner ? inner.props.children : children;
  const href = itemHref ?? inner?.props.href;
  if (typeof href === 'string') {
    return {
      node: (
        <Menu.ItemLink
          key={entry.key}
          href={href}
          icon={icon}
          disabled={disabled}
          onClick={onClick}
        >
          {label}
        </Menu.ItemLink>
      ),
      mappable: true,
    };
  }
  return {
    node: (
      <Menu.Item
        key={entry.key}
        icon={icon}
        disabled={disabled || !onClick}
        onClick={onClick as React.MouseEventHandler<HTMLDivElement> | undefined}
      >
        {label}
      </Menu.Item>
    ),
    mappable: onClick !== undefined,
  };
}

const BreadcrumbRoot = ({
  children,
  maxDisplayedItems,
  overflowIndex = 1,
  overflowLabel = 'More items',
  size = 'medium',
  focusMode = 'tab',
  divider,
  className,
  onKeyDown,
  onFocus,
  ref,
  ...rest
}: BreadcrumbProps) => {
  // Fragments are opened (`{isAdmin && <>…</>}`), so every crumb gets its own list item and separator.
  const entries = flattenChildren(children);
  const collapsed = collapsedIndexes(entries, maxDisplayedItems, overflowIndex);
  const collapsedItems = collapsed.map((index) => overflowMenuItem(entries[index]));
  const unlistable = collapsedItems.some((item) => !item.mappable);
  React.useEffect(() => {
    if (unlistable) {
      warnOnce(
        'Breadcrumb:overflow-item',
        'Breadcrumb: a hidden item cannot be listed in the overflow menu (it has no `href` or `onClick`, or is not a Breadcrumb.Item): it is shown there disabled, or left out. Give it `href` or `onClick`.',
      );
    }
  }, [unlistable]);

  // The trail in order, the overflow button standing where the first collapsed item was.
  const trail: Array<{ key: string; node: React.ReactNode }> = [];
  entries.forEach((entry, index) => {
    if (!collapsed.includes(index)) {
      trail.push(entry);
    } else if (index === collapsed[0]) {
      trail.push({
        key: OVERFLOW_KEY,
        node: (
          <Menu>
            <Menu.Trigger>
              <button
                type="button"
                aria-label={overflowLabel}
                className={cn(breadcrumbOverflowClassNames.root, linkClasses, 'rounded px-1')}
              >
                <span aria-hidden="true" className={breadcrumbOverflowClassNames.icon}>
                  …
                </span>
              </button>
            </Menu.Trigger>
            <Menu.Popover>{collapsedItems.map((item) => item.node)}</Menu.Popover>
          </Menu>
        ),
      });
    }
  });

  const arrow = focusMode === 'arrow';
  const { containerProps } = useRovingTabIndex({
    itemSelector: BREADCRUMB_FOCUS_SELECTOR,
    manageTabIndex: arrow,
    tabStop: 'last-focused',
    orientation: 'horizontal',
  });
  const mergedRef = useMergedRefs<HTMLElement>(arrow ? containerProps.ref : null, ref);

  // `divider` is an optional indicator: unset keeps the chevron, a value that renders nothing hides it.
  const renderDivider = () =>
    divider == null ? (
      <ChevronRightIcon
        size={breadcrumbSizes[size].divider}
        data-wave-breadcrumb-separator=""
        className={cn(
          breadcrumbClassNames.divider,
          'shrink-0 text-muted-foreground wave-rtl:-scale-x-100',
        )}
      />
    ) : slotRendersContent(divider) ? (
      renderSlot(
        divider,
        'span',
        cn(breadcrumbClassNames.divider, 'inline-flex shrink-0 items-center text-muted-foreground'),
        { 'aria-hidden': true, 'data-wave-breadcrumb-separator': '' },
      )
    ) : null;

  return (
    <nav
      aria-label="Breadcrumb"
      data-size={size}
      data-focus-mode={focusMode}
      {...rest}
      ref={mergedRef}
      data-roving-container={arrow ? '' : undefined}
      onKeyDown={arrow ? composeEventHandlers(onKeyDown, containerProps.onKeyDown) : onKeyDown}
      onFocus={
        arrow
          ? composeEventHandlers(onFocus, containerProps.onFocus, { checkDefaultPrevented: false })
          : onFocus
      }
      className={cn(breadcrumbClassNames.root, className)}
    >
      <ol
        className={cn(
          breadcrumbClassNames.list,
          'm-0 flex list-none items-center gap-1 p-0',
          breadcrumbSizes[size].text,
        )}
      >
        {trail.map(({ key, node }, index) => (
          <li key={key} className={cn(breadcrumbClassNames.listItem, 'flex items-center gap-1')}>
            {index > 0 && renderDivider()}
            {node}
          </li>
        ))}
      </ol>
    </nav>
  );
};
BreadcrumbRoot.displayName = 'Breadcrumb';

interface BreadcrumbItemChildProps extends React.HTMLAttributes<HTMLElement> {
  /** The item's `href`, a default for the element (the element's own `href` wins). */
  href?: string;
  child: React.ReactElement<{ children?: React.ReactNode }>;
  icon: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
}

/**
 * Link's disabled contract for an `asChild` element: an `<a>` drops its `href` (it is still
 * announced as a link); any element gets `aria-disabled`, leaves the tab order and loses its own
 * `onClick`. The item's click handler cancels the click, so a router link does not navigate.
 */
function disableLinkChild(
  child: React.ReactElement<{ children?: React.ReactNode }>,
): React.ReactElement<{ children?: React.ReactNode }> {
  const anchor = isElementOfType(child, 'a')
    ? { href: undefined, role: 'link', disabled: undefined }
    : undefined;
  return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
    ...anchor,
    'aria-disabled': true,
    tabIndex: -1,
    onClick: undefined,
  }) as React.ReactElement<{ children?: React.ReactNode }>;
}

/**
 * `asChild` rendering: the item's props are merged onto the consumer's element with
 * `useTriggerElement` (the element's own handlers run first and its classes win conflicts; its
 * ref and the item's ref are both attached). The icon is placed inside the element.
 */
function BreadcrumbItemChild({ child, icon, ...itemProps }: BreadcrumbItemChildProps) {
  const target = icon ? React.cloneElement(child, undefined, icon, child.props.children) : child;
  const node = useTriggerElement(target, itemProps, { componentName: 'Breadcrumb.Item' });
  return <>{node}</>;
}

/**
 * One step of a breadcrumb trail:
 * - `href` → a link (`<a>`, anchor attributes);
 * - `current` → the current page as text (`<span aria-current="page">`);
 * - no `href` with `onClick` → a `<button type="button">` styled as a link;
 * - no `href` and no `onClick` → plain text (`<span>`; development warning for a non-current item);
 * - `asChild` → the props are merged onto the single child element (router links).
 *
 * Typed by overloads, resolved in order: without `href` (button props, button events), with a
 * string `href` (anchor props, anchor events), then an `href` that may be `undefined` at run time
 * ({@link BreadcrumbItemDynamicProps}: `HTMLElement` events).
 *
 * Also exported as `BreadcrumbItem` (import the flat name from React Server Components).
 */
function BreadcrumbItem(props: BreadcrumbItemButtonProps): React.ReactElement;
function BreadcrumbItem(props: BreadcrumbItemAnchorProps): React.ReactElement;
function BreadcrumbItem(props: BreadcrumbItemDynamicProps): React.ReactElement;
function BreadcrumbItem(
  props: BreadcrumbItemProps | BreadcrumbItemDynamicProps,
): React.ReactElement {
  const {
    href,
    current = false,
    icon,
    asChild = false,
    children,
    className,
    onClick,
    ref,
    ...rest
  } = props as BreadcrumbEntryProps;

  // A falsy icon (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in Nav,
  // Tree and Avatar, and so is a collection whose items render nothing: no empty span and no stray
  // `me-1` margin. The check does not consume a generator: renderSlot still renders its items.
  const renderedIcon =
    icon && slotRendersContent(icon)
      ? renderSlot(icon, 'span', cn(breadcrumbItemClassNames.icon, 'me-1 inline-flex shrink-0'), {
          'aria-hidden': true,
        })
      : null;
  const child =
    asChild && React.isValidElement<{ children?: React.ReactNode }>(children) ? children : null;
  const kind = child
    ? 'child'
    : current
      ? 'current'
      : href !== undefined
        ? 'link'
        : onClick
          ? 'button'
          : 'text';

  const invalidAsChild = asChild && child === null;
  const ignoredDisabled = rest.disabled === true && (kind === 'text' || kind === 'current');
  // Link and asChild items follow Link's disabled contract. `<a disabled>` does not block
  // navigation, and an `aria-disabled` link only looks disabled unless the click is cancelled.
  // With asChild the element is the link, so its own `disabled`/`aria-disabled` count too.
  const ariaDisabled = rest['aria-disabled'];
  const childProps = (child?.props ?? {}) as Record<string, unknown>;
  const linkDisabled = [
    rest.disabled,
    ariaDisabled,
    childProps.disabled,
    childProps['aria-disabled'],
  ].some((value) => value === true || value === 'true');
  React.useEffect(() => {
    if (invalidAsChild) {
      warnOnce(
        'Breadcrumb.Item:asChild',
        'Breadcrumb.Item: `asChild` expects a single element child (e.g. a router link); the item was rendered normally instead.',
      );
    }
    if (kind === 'text') {
      warnOnce(
        'Breadcrumb.Item:no-href',
        'Breadcrumb.Item: a non-current item without `href` or `onClick` renders as plain text, not a link. Pass `href` (or `onClick`, which renders a button) to make it navigable.',
      );
    }
    if (ignoredDisabled) {
      warnOnce(
        'Breadcrumb.Item:disabled',
        'Breadcrumb.Item: `disabled` applies to link, button and asChild items; it is ignored on a text or current item.',
      );
    }
  }, [invalidAsChild, kind, ignoredDisabled]);

  if (child) {
    const { disabled: _disabled, ...childRest } = rest;
    // Like the other item props, `href` is a default for the element (its own `href` wins). A
    // disabled link has no destination, so it is not passed then.
    const childHref = href !== undefined && !linkDisabled ? { href } : undefined;
    return (
      <BreadcrumbItemChild
        {...(childRest as React.HTMLAttributes<HTMLElement>)}
        {...childHref}
        ref={ref}
        onClick={preventIfDisabled(linkDisabled, onClick)}
        aria-current={current ? 'page' : undefined}
        className={cn(
          breadcrumbItemClassNames.root,
          current ? currentChildClasses : linkClasses,
          className,
        )}
        icon={renderedIcon}
        child={linkDisabled ? disableLinkChild(child) : child}
      />
    );
  }

  if (kind === 'current') {
    return (
      <span
        {...spanAttributes(rest)}
        ref={ref as React.Ref<HTMLSpanElement>}
        aria-current="page"
        onClick={onClick}
        className={cn(breadcrumbItemClassNames.root, currentClasses, className)}
      >
        {renderedIcon}
        {children}
      </span>
    );
  }

  if (kind === 'link') {
    const { disabled: _disabled, ...anchorRest } = rest;
    return (
      <a
        {...(anchorRest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={linkDisabled ? undefined : href}
        role={linkDisabled ? 'link' : anchorRest.role}
        aria-disabled={linkDisabled ? true : ariaDisabled}
        tabIndex={linkDisabled ? -1 : anchorRest.tabIndex}
        onClick={preventIfDisabled(linkDisabled, onClick)}
        className={cn(breadcrumbItemClassNames.root, linkClasses, className)}
      >
        {renderedIcon}
        {children}
      </a>
    );
  }

  if (kind === 'button') {
    // `rel` only belongs on a link: a button item drops it, like the text and current items.
    const { rel, ...buttonRest } = rest;
    return (
      <button
        type="button"
        {...(buttonRest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={onClick}
        className={cn(breadcrumbItemClassNames.root, linkClasses, className)}
      >
        {renderedIcon}
        {children}
      </button>
    );
  }

  return (
    <span
      {...spanAttributes(rest)}
      ref={ref as React.Ref<HTMLSpanElement>}
      className={cn(breadcrumbItemClassNames.root, textClasses, className)}
    >
      {renderedIcon}
      {children}
    </span>
  );
}
BreadcrumbItem.displayName = 'BreadcrumbItem';

/**
 * A breadcrumb trail: a `<nav aria-label="Breadcrumb">` landmark with an ordered list. Each child
 * is placed in its own list item (Fragments are opened, so each of their items gets one too); from
 * the second one on, the item begins with a decorative separator chevron that is mirrored in
 * right-to-left layouts (`divider` replaces or hides it).
 *
 * `maxDisplayedItems` collapses the middle of a long trail into a "…" menu button; `size` sets the
 * text step and `focusMode="arrow"` makes the trail one Tab stop with arrow-key navigation.
 *
 * `Breadcrumb.Item` is also exported as `BreadcrumbItem`: React Server Components import the flat
 * name, because dotted access needs a client file.
 *
 * @example
 * <Breadcrumb>
 *   <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
 *   <Breadcrumb.Item current>Settings</Breadcrumb.Item>
 * </Breadcrumb>
 */
export const Breadcrumb = /* @__PURE__ */ Object.assign(BreadcrumbRoot, {
  Item: BreadcrumbItem,
});

export { BreadcrumbItem };
