import * as React from 'react';
import { preventIfDisabled } from '../../lib/aria';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import type { Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { warnOnce } from '../../lib/dev';
import { ChevronRightIcon } from '../../lib/icons';
import { disabledStyles, focusRing } from '../../lib/styles';
import { useTriggerElement } from '../../hooks/useTriggerElement';

/** Properties for the Breadcrumb component. */
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Breadcrumb items to render; each one is placed in its own list item. Fragments are opened, so
   * the items of a conditional group (`{isAdmin && <>…</>}`) each get their own list item too.
   */
  children: React.ReactNode;
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

const BreadcrumbRoot = ({ children, className, ref, ...rest }: BreadcrumbProps) => {
  // Fragments are opened (`{isAdmin && <>…</>}`), so every crumb gets its own list item and separator.
  const items = flattenChildren(children);

  return (
    <nav ref={ref} aria-label="Breadcrumb" {...rest} className={className}>
      <ol className="m-0 flex list-none items-center gap-1 p-0 text-body-1">
        {items.map(({ key, node: child }, index) => (
          <li key={key} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRightIcon
                data-wave-breadcrumb-separator=""
                className="shrink-0 text-muted-foreground wave-rtl:-scale-x-100"
              />
            )}
            {child}
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
      ? renderSlot(icon, 'span', 'me-1 inline-flex shrink-0', { 'aria-hidden': true })
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
        className={cn(current ? currentChildClasses : linkClasses, className)}
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
        className={cn(currentClasses, className)}
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
        className={cn(linkClasses, className)}
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
        className={cn(linkClasses, className)}
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
      className={cn(textClasses, className)}
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
 * right-to-left layouts.
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
