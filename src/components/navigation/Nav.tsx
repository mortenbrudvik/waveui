import * as React from 'react';
import { wcn } from '../../lib/cn';
import {
  navCategoryClassNames,
  navItemClassNames,
  navSubItemClassNames,
} from '../../lib/classNames';
import type { MotionPreference, MotionSlot, Slot } from '../../lib/types';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
// Aliased: `expandIconMotion` is also Nav.Category's prop.
import {
  expandIconMotion as expandIconRecipe,
  navActionsRevealMotion as navActionsReveal,
} from '../../lib/motion';
import { disabledStyles, focusRingInset } from '../../lib/styles';
import { useCollapsePresence } from '../../hooks/useCollapsePresence';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useMotionClasses, useMotionPreference } from '../../hooks/useMotion';
import { unwrapButtonGlyph } from '../button/Button.slots';
import {
  BLOCK_CLICK,
  NAV_SHOWN_PART_LOCKS,
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
import { useAppClassName } from '../../hooks/useAppClassName';

/*
 * The Nav compound: the item types, styles and rendering of Nav.Item and Nav.SubItem, Nav.Category,
 * the `Object.assign` with its JSDoc, the flat names and the type re-exports. Nothing imports this
 * module but the barrel: the root (`Nav.root.tsx`) and the contexts (`Nav.context.ts`) recognise
 * the parts by the markers set next to each `displayName` below; the structural parts live in
 * `Nav.parts.tsx`.
 */

export type { NavProps, NavDensity, NavSelectDetails, NavCategoryToggleDetails } from './Nav.root';
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
   * Label of the category's toggle button (any content). The children are only the sub-items.
   */
  label: React.ReactNode;
  /**
   * Icon displayed before the category label. Rendered with `aria-hidden="true"`. A falsy icon
   * (`''`, `0`) or a list of nothing renders no icon box.
   */
  icon?: Slot<'span'>;
  /**
   * Replaces the expand chevron at the end of the toggle button (decorative, `aria-hidden`).
   * `null`/`undefined` keep the chevron, which turns while the category is open; `false`, or
   * anything that renders nothing, hides it (`aria-expanded` still reports the state). Your glyph
   * renders as given in a span with the expand icon's class and is not turned, so a glyph that
   * shows the state itself works (a plus or a minus, picked from your `openCategories`). It is
   * rendered inside the toggle button: a `<button>` or `Button` passed here (or a slot object
   * whose `as` is one) is not nested (its children become the glyph and its props are dropped,
   * with a development warning).
   */
  expandIcon?: Slot<'span'>;
  /**
   * Replaces the motion of the expand icon (Fluent's `NavCategoryItem expandIconMotion`): by
   * default the chevron's half turn as the category opens and closes is animated over the fast
   * duration (150 ms) with the easy-ease curve, both ways, and so is any transform of the span
   * around your own `expandIcon`. The turn itself is not motion: `null` turns the animation off
   * and the chevron still turns, at once; a class string or `{ className }` replaces it with
   * plain transition classes and a reduced-motion counterpart (the icon has no presence phases).
   * A `WaveProvider` with `motion="none"` turns the default off, and a value here still applies
   * under it.
   * @default the animated turn described above
   */
  expandIconMotion?: MotionSlot | null;
  /**
   * Replaces the collapse of the category's list (Fluent's `NavSubItemGroup collapseMotion`), on
   * the element around its `<ul>`: by default the space the list takes opens from nothing and
   * closes back to it, with a fade, over the normal duration (200 ms) with the max easy-ease
   * curve, both ways. `null` turns it off (the list appears and disappears at once); a class
   * string or `{ className }` replaces it, written as `MotionSlot` describes. A `WaveProvider`
   * with `motion="none"` turns the default off, and a value here still applies under it.
   * @default the collapse described above
   */
  motion?: MotionSlot | null;
  /**
   * The category's sub-items (`Nav.SubItem`), and `Nav.SectionHeader` and `Nav.Divider`, rendered
   * in its list while it is open (and while the list collapses after a close).
   */
  children?: React.ReactNode;
  /** Ref to the category's `<li>` element. */
  ref?: React.Ref<HTMLLIElement>;
  /**
   * Props for the elements the category draws inside its list item, by part, merged into each
   * part's own: your classes after the part's (yours win a conflict), your styles over its styles,
   * your attributes and handlers added, your ref beside its ref. Every attribute the category sets
   * on a part is locked and keeps the category's value, and no part takes a role, a tab index or a
   * roving container's marker, so a part changes neither the Nav's entries nor an arrow-key body's
   * order. A part takes no `children` (the category draws their content); the `<li>` takes the
   * category's own props, `icon` and `expandIcon` fill their own slots, and the collapse element
   * around the list is the `motion` slot's. Fluent UI's NavCategoryItem is the toggle button itself
   * and its NavSubItemGroup the list.
   */
  slotProps?: {
    /**
     * The toggle `<button>`, which holds the icon, the label and the chevron (stable class
     * `wave-nav-category__button`). Locked: `type`, `aria-expanded`, `aria-controls` (the list's
     * id, only while open), `aria-current` and `data-contains-current` (only while closed with the
     * current page), the value an arrow-key body tracks it by, no role or tab index, no
     * `disabled`, `aria-disabled` or roving container's marker, and no `hidden`, `inert` or
     * `aria-hidden`. An `aria-label` of yours names it instead of the label. Its `onClick`, which
     * opens or closes the category, is locked and runs after yours: `preventDefault()` in yours
     * keeps the category as it is. A click whose default was prevented before it reached the
     * button (in label or icon content, or in a capture handler) keeps it too while you give an
     * `onClick` here or the `label` part is given; otherwise such a click toggles the category,
     * as without `slotProps`. In an arrow-key body your `onKeyDown` runs before the body's arrow
     * keys, which `preventDefault()` in yours skips.
     */
    button?: SlotPart<'button'>;
    /**
     * The `<span>` of `label` inside the toggle button, which names it (stable class
     * `wave-nav-category__label`). Locked: no `aria-label` (it would replace the label in the
     * button's name), no role, tab index or roving container's marker, and no `hidden`, `inert`
     * or `aria-hidden`. An `aria-labelledby` of yours is joined, not locked: its ids rename the
     * button. It carries no handler of the category: a click on it is a click on the toggle
     * button, after yours. While this part is given, a click whose default is prevented before it
     * reaches the button (in yours, in your label or icon content, or in a capture handler) keeps
     * the category as it is.
     */
    label?: SlotPart<'span'>;
    /**
     * The `<ul>` of the sub-items, rendered while the category is open and while its list collapses
     * after a close (stable class `wave-nav-category__list`). Locked: its `id` (the toggle
     * button's `aria-controls`), no role (it stays a list for its list items), no tab index or
     * roving container's marker, and no `hidden`, `inert` or `aria-hidden`, since it holds the
     * sub-items (the collapse element around it hides them while it closes). It carries no
     * handler of the category: the events of the sub-items reach yours after their own handling
     * and, in an arrow-key body, before the body's arrow keys, which `preventDefault()` in yours
     * skips.
     */
    list?: SlotPart<'ul'>;
  };
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
  /**
   * Controls beside the item in its row (Fluent's SplitNavItem): a ToggleButton that pins the
   * page, a MenuButton with more commands, each with its own name (a Tooltip with
   * `relationship="label"` names an icon-only one). They render after the item's link or button,
   * never inside it, in a group named by the item; each is a Tab stop after the item, and a click
   * or key on one never selects the item. They are drawn while the row is hovered or has focus,
   * while one of them is pressed or has its popup open, and always in forced colours and on touch
   * screens; otherwise they are transparent and still focusable. They fade in and out over 150 ms
   * (at once under reduced motion or a `WaveProvider` with `motion="none"`); the fade sets the
   * transition of each direct child of the group, so a transition of your own on one is replaced.
   * They stay enabled when the item is `disabled`. With actions, the selected background and
   * indicator are drawn on the row (the item's list item, `.wave-nav-item__list-item`), so a
   * `className` on the item no longer covers them. Content that renders nothing renders no group.
   * Fluent's `actionButton`, `toggleButton` and `menuButton` slots and their tooltips are your own
   * controls here.
   */
  actions?: React.ReactNode;
  /**
   * Props for the elements the item draws around and inside its link or button, by part, merged
   * into each part's own: your classes after the part's (yours win a conflict), your styles over
   * its styles, your attributes and handlers added, your ref attached. Every attribute the item
   * sets on a part is locked and keeps the item's value, and no part takes a role, a tab index or
   * a roving container's marker, so a part changes neither the Nav's entries nor an arrow-key
   * body's order. A part takes no `children` (the item draws their content); the link or button
   * takes the item's own props and `icon` fills its own slot. No part carries a handler of the
   * item. Fluent UI's NavItem is the link or button itself; its SplitNavItem draws the actions.
   */
  slotProps?: {
    /**
     * The `<li>` that holds the link or button and, with `actions`, the actions beside it (stable
     * class `wave-nav-item__list-item`); with actions it is the item's row, which draws the
     * selected look. Locked: no role (it stays a list item), no tab index or roving container's
     * marker, and no `hidden`, `inert` or `aria-hidden`, since it holds the item. The link or
     * button and the actions handle their events before yours; in an arrow-key body your
     * `onKeyDown` runs before the body's arrow keys, which `preventDefault()` in yours skips.
     */
    listItem?: SlotPart<'li'>;
    /**
     * The `<span>` of the label inside the link or button, which names the item (stable class
     * `wave-nav-item__content`). Locked: no `aria-label` (it would replace the label in the
     * item's name), no role, tab index or roving container's marker, and no `hidden`, `inert` or
     * `aria-hidden`. An `aria-labelledby` of yours is joined, not locked: its ids rename the item.
     * A click on it is a click on the item, after yours: `preventDefault()` in
     * yours acts as in the item's `onClick` (a button item is not selected; a link is not
     * followed and is still selected, as with client-side routing). While the item is `disabled`
     * your `onClick` here is not called, as the item's own is not.
     */
    content?: SlotPart<'span'>;
    /**
     * The `<span>` of `actions`, rendered while `actions` renders content (stable class
     * `wave-nav-item__actions`). Locked: its role (`group`), its name (`aria-labelledby`, the
     * item; your ids are joined after it), its marker, no tab index or roving container's marker
     * (each action is a stop of its own) and no `hidden`, `inert` or `aria-hidden`, since it holds
     * the actions. The actions handle their events before yours; in an arrow-key body your
     * `onKeyDown` runs before the body's arrow keys, which `preventDefault()` in yours skips.
     */
    actions?: SlotPart<'span'>;
  };
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
 * `icon`, and `slotProps` without the label's part (a sub-item draws no label span).
 */
export type NavSubItemOwnProps = Omit<NavItemOwnProps, 'icon' | 'slotProps'> & {
  /**
   * Props for the elements the sub-item draws around its link or button, by part, merged into
   * each part's own: your classes after the part's (yours win a conflict), your styles over its
   * styles, your attributes and handlers added, your ref attached. Every attribute the sub-item
   * sets on a part is locked and keeps the sub-item's value, and no part takes a role, a tab index
   * or a roving container's marker, so a part changes neither the Nav's entries nor an arrow-key
   * body's order. A part takes no `children` (the sub-item draws their content); the link or
   * button takes the sub-item's own props. No part carries a handler of the sub-item. Fluent UI's
   * NavSubItem is the link or button itself; its SplitNavItem draws the actions.
   */
  slotProps?: {
    /**
     * The `<li>` that holds the link or button and, with `actions`, the actions beside it (stable
     * class `wave-nav-sub-item__list-item`); with actions it is the sub-item's row. Locked: no
     * role (it stays a list item), no tab index or roving container's marker, and no `hidden`,
     * `inert` or `aria-hidden`, since it holds the sub-item. The link or button and the actions
     * handle their events before yours; in an arrow-key body your `onKeyDown` runs before the
     * body's arrow keys, which `preventDefault()` in yours skips.
     */
    listItem?: SlotPart<'li'>;
    /**
     * The `<span>` of `actions`, rendered while `actions` renders content (stable class
     * `wave-nav-sub-item__actions`). Locked: its role (`group`), its name (`aria-labelledby`, the
     * sub-item; your ids are joined after it), its marker, no tab index or roving container's
     * marker (each action is a stop of its own) and no `hidden`, `inert` or `aria-hidden`, since
     * it holds the actions. The actions handle their events before yours; in an arrow-key body
     * your `onKeyDown` runs before the body's arrow keys, which `preventDefault()` in yours skips.
     */
    actions?: SlotPart<'span'>;
  };
};

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

const iconClasses =
  'wave:flex wave:h-5 wave:w-5 wave:shrink-0 wave:items-center wave:justify-center';

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
    ? renderSlot(icon, 'span', wcn(className, iconClasses), { 'aria-hidden': true })
    : null;
}

/**
 * The vertical padding a `small` density sets: it replaces the medium row's, which stays in each
 * base string (so a medium row renders the classes it always did).
 */
const smallPadding = {
  entry: 'wave:py-1',
  subEntry: 'wave:py-0.5',
  category: 'wave:py-1',
} as const;

const itemClasses = {
  small: smallPadding.entry,
  base: wcn(
    'wave:flex wave:w-full wave:items-center wave:gap-2 wave:px-4 wave:py-2 wave:text-body-1 wave:text-start wave:no-underline wave:transition-colors wave:motion-reduce:transition-none',
    focusRingInset,
    disabledStyles,
  ),
  selected:
    'wave:bg-subtle-selected wave:text-primary wave:font-semibold wave:border-s-2 wave:border-s-primary',
  idle: 'wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover',
  // With actions, the selected background and indicator move to the row (D121).
  selectedInRow: 'wave:text-primary wave:font-semibold',
  rowSelected: 'wave:bg-subtle-selected wave:border-s-2 wave:border-s-primary',
};

const subItemClasses = {
  small: smallPadding.subEntry,
  base: wcn(
    'wave:flex wave:w-full wave:items-center wave:ps-11 wave:pe-4 wave:py-1.5 wave:text-body-1 wave:text-start wave:no-underline wave:transition-colors wave:motion-reduce:transition-none',
    focusRingInset,
    disabledStyles,
  ),
  selected: 'wave:text-primary wave:font-semibold',
  idle: 'wave:text-muted-foreground wave:not-disabled:not-aria-disabled:hover:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover',
  // Sub-items have no selected background: a sub-item row gets only the hover.
  selectedInRow: 'wave:text-primary wave:font-semibold',
  rowSelected: undefined,
};

/** The classes an entry's link or button and its row share. */
interface NavEntryClasses {
  /** The vertical padding of a `small` density. */
  small: string;
  base: string;
  selected: string;
  idle: string;
  selectedInRow: string;
  rowSelected: string | undefined;
}

/**
 * The row of an entry with actions (D121): the list item lays out the link or button and the
 * actions side by side and carries the selected look, or the hover of an enabled entry. A list
 * item cannot be disabled, so its hover needs no gate.
 */
const rowClasses =
  'wave:group/nav-row wave:flex wave:items-center wave:transition-colors wave:motion-reduce:transition-none';
const rowHoverClasses = 'wave:hover:bg-subtle-hover';

/**
 * The actions element (D120). Each direct child is transparent until the row is hovered or has
 * focus inside it, and is always drawn in forced colours and on devices without hover; a child
 * that is or holds a pressed toggle or an expanded trigger stays drawn (the first pair covers an
 * action wrapped in a Tooltip's span, the second a bare one). Opacity keeps every action
 * focusable, so Shift+Tab and a focus return reach it. The reveal fades: `renderNavEntry` adds
 * the actions' reveal motion of `lib/motion` to these classes unless the provider's motion is
 * `'none'` (it has no slot: it is not a presence motion).
 */
const actionsClasses = wcn(
  'wave:flex wave:shrink-0 wave:items-center wave:gap-1 wave:pe-2',
  'wave:*:opacity-0 wave:group-hover/nav-row:*:opacity-100 wave:group-focus-within/nav-row:*:opacity-100',
  'wave:forced-colors:*:opacity-100 wave:[@media(hover:none)]:*:opacity-100',
  'wave:*:has-[[aria-pressed=true]]:opacity-100 wave:*:has-[[aria-expanded=true]]:opacity-100',
  'wave:[&>[aria-pressed=true]]:opacity-100 wave:[&>[aria-expanded=true]]:opacity-100',
);

const categoryButtonClasses = wcn(
  'wave:flex wave:w-full wave:items-center wave:gap-2 wave:px-4 wave:py-2 wave:text-body-1 wave:font-semibold wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:transition-colors wave:motion-reduce:transition-none',
  // A closed category that contains the current page shows the selected look of an item.
  'wave:data-[contains-current]:bg-subtle-selected wave:data-[contains-current]:text-primary wave:data-[contains-current]:border-s-2 wave:data-[contains-current]:border-s-primary',
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
  actions: string;
  icon?: string;
  content?: string;
  /** The app-wide classes of the item's root class (`WaveProvider classNames`). */
  appClassName?: string;
}

/**
 * Shared rendering of Nav.Item and Nav.SubItem (link or button). Inside an arrow-key body
 * (`roving` provided) the link or button also carries `data-roving-value={value}`, after the
 * consumer's attributes; in a plain Nav nothing is added. With `actions` that render content, the
 * list item becomes the row (D121) and holds the link or button, then the actions in a group named
 * by it through `generatedId` (unless the consumer gave an `id`), siblings, never nested (D119);
 * the group's reveal fades unless `motionPreference` is `'none'`. Each part of `slotProps` is
 * merged only when given, so an entry without it allocates nothing more.
 */
function renderNavEntry(
  props: NavEntryProps,
  context: NavContextValue,
  roving: NavRovingContextValue | null,
  classes: NavEntryClasses,
  stable: NavEntryClassNames,
  withIcon: boolean,
  generatedId: string,
  motionPreference: MotionPreference,
  category: string | null,
): React.ReactElement {
  const {
    value,
    icon,
    disabled = false,
    href,
    className,
    children,
    onClick,
    actions,
    ref,
    slotProps,
    ...rest
  } = props;
  const isSelected = context.value === value;
  const isLink = href !== undefined;
  const rovingProps = roving ? { 'data-roving-value': value } : undefined;
  // No empty group (`actions={cond && <Button />}` with `cond` false); the id is rendered only
  // while the group points at it, so an item without actions keeps its 0.10 HTML.
  const hasActions = slotRendersContent(actions);
  const itemId = rest.id ?? generatedId;
  const idProps = hasActions ? { id: itemId } : undefined;

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
    context.select(value, { event: event.nativeEvent, category: category ?? undefined });
  };

  // The parts are merged only when given: a Nav renders many entries.
  const contentPart = slotProps?.content;
  const contentClassName = withIcon
    ? wcn(stable.content, 'wave:flex-1 wave:text-start')
    : undefined;
  const content = (
    <>
      {withIcon && renderIcon(icon, stable.icon)}
      {withIcon ? (
        <span
          className={contentClassName}
          {...(contentPart &&
            mergeSlotProps(contentPart, {
              className: contentClassName,
              locked: { ...NAV_SHOWN_PART_LOCKS, 'aria-label': undefined },
              blockHandlers: disabled ? BLOCK_CLICK : undefined,
            }))}
        >
          {children}
        </span>
      ) : (
        children
      )}
    </>
  );

  const entryClassName = wcn(
    stable.root,
    classes.base,
    isSelected ? (hasActions ? classes.selectedInRow : classes.selected) : classes.idle,
    context.density === 'small' && classes.small,
    hasActions && 'wave:min-w-0 wave:flex-1',
    stable.appClassName,
    className,
  );

  const listItemClassName = hasActions
    ? wcn(
        stable.listItem,
        rowClasses,
        isSelected && classes.rowSelected ? classes.rowSelected : !disabled && rowHoverClasses,
      )
    : stable.listItem;
  const listItemProps =
    slotProps?.listItem &&
    mergeSlotProps(slotProps.listItem, {
      className: listItemClassName,
      locked: NAV_SHOWN_PART_LOCKS,
    });

  let actionsGroup: React.ReactElement | null = null;
  if (hasActions) {
    const actionsPart = slotProps?.actions;
    const actionsClassName = wcn(
      stable.actions,
      actionsClasses,
      motionPreference === 'none' ? undefined : navActionsReveal,
    );
    actionsGroup = (
      <span
        role="group"
        aria-labelledby={itemId}
        data-wave-nav-actions=""
        className={actionsClassName}
        {...(actionsPart &&
          mergeSlotProps(actionsPart, {
            className: actionsClassName,
            locked: {
              ...NAV_SHOWN_PART_LOCKS,
              role: 'group',
              'aria-labelledby': itemId,
              'data-wave-nav-actions': '',
            },
          }))}
      >
        {materialiseSlotContent(actions)}
      </span>
    );
  }

  if (isLink) {
    return (
      <li className={listItemClassName} {...listItemProps}>
        <a
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          {...idProps}
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
        {actionsGroup}
      </li>
    );
  }

  // `rel` only belongs on a link: a button item drops it (React types it on every element).
  const { rel, ...buttonRest } = rest;
  return (
    <li className={listItemClassName} {...listItemProps}>
      <button
        type="button"
        {...(buttonRest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...idProps}
        {...rovingProps}
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled}
        aria-current={isSelected ? 'page' : undefined}
        onClick={handleClick}
        className={entryClassName}
      >
        {content}
      </button>
      {actionsGroup}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Nav.Category
// ---------------------------------------------------------------------------

/**
 * A collapsible group of sub-items. Its toggle button shows `label` and reports `aria-expanded`
 * (and `aria-controls` while open); the sub-items render in a nested list while it is open and
 * while the list collapses after a close. Open state lives on `Nav`
 * (`openCategories`/`defaultOpenCategories`).
 *
 * The list renders as the only child of a collapse element (its stable class
 * `wave-nav-category__collapse`), which opens and closes the list's space (`motion`) and has no
 * box of its own while the category is open, so the list lays out in the category as before. A
 * category open by default appears without motion. After a close the list stays in the document
 * until the collapse ends, `inert` (its items leave the Tab order and an arrow-key body's arrow
 * keys at once), while the toggle button already reports the category closed, without
 * `aria-controls`; opening the category again during the collapse keeps the same list. Focus
 * inside the list when the category closes moves to the toggle button. The expand chevron turns
 * while the category is open (`expandIcon` replaces it, `expandIconMotion` animates its turn).
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
  expandIcon,
  expandIconMotion,
  motion,
  className,
  children,
  ref,
  slotProps,
  ...rest
}: NavCategoryProps) => {
  const appClassName = useAppClassName(navCategoryClassNames.root);

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

  // The list renders in a collapse element (the presence element) while the category is open
  // and, after a close, until that element's motion ends; focus inside the list at the close
  // moves to the toggle button.
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const {
    isMounted: isListMounted,
    wrapperRef: collapseRef,
    presenceProps: collapsePresenceProps,
    className: collapseClassName,
  } = useCollapsePresence(isOpen, {
    motion,
    partRef: listRef,
    getTrigger: () => buttonRef.current,
  });
  // A part's ref joins the button's and the list's own after the spread: an inline ref never
  // detaches them (the collapse moves focus through them, the development check reads the list).
  const buttonMergedRef = useMergedRefs<HTMLButtonElement>(buttonRef, slotProps?.button?.ref);
  const listMergedRef = useMergedRefs<HTMLUListElement>(listRef, slotProps?.list?.ref);

  // The optional-indicator slot rule (C-SLOTS): `null`/`undefined` keep the chevron, which turns
  // while open; `false` or content that renders nothing hides it; a custom glyph is rendered as
  // given in its span and never turned. `expandIconMotion` animates the transform of either. The
  // glyph sits inside the toggle button, so a button passed as the glyph is unwrapped (its
  // children are the glyph, its props are dropped), never nested.
  const { glyph: expandGlyph, button: expandIconButton } = unwrapButtonGlyph(expandIcon);
  React.useEffect(() => {
    if (expandIconButton) {
      warnOnce(
        'Nav.Category:expandIcon-button',
        `Nav.Category: \`expandIcon\` received ${expandIconButton}; its children render as the ` +
          'glyph of the toggle button and its props were dropped (buttons cannot be nested). ' +
          'Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.',
      );
    }
  }, [expandIconButton]);
  const expandIconMotionClassName = useMotionClasses(expandIconMotion, expandIconRecipe);
  let expandIconElement: React.ReactNode = null;
  if (expandGlyph === undefined || expandGlyph === null) {
    expandIconElement = (
      <ChevronDownIcon
        className={wcn(
          navCategoryClassNames.expandIcon,
          'wave:shrink-0',
          expandIconMotionClassName,
          isOpen && 'wave:rotate-180',
        )}
      />
    );
  } else if (slotRendersContent(expandGlyph)) {
    expandIconElement = renderSlot(
      expandGlyph,
      'span',
      wcn(
        navCategoryClassNames.expandIcon,
        'wave:inline-flex wave:shrink-0',
        expandIconMotionClassName,
      ),
      { 'aria-hidden': true },
    );
  }

  // The parts are merged only when given, with the attributes the category sets on each (those it
  // sets only in some states included, as `undefined` otherwise) locked.
  const buttonPart = slotProps?.button;
  const labelPart = slotProps?.label;
  const listPart = slotProps?.list;

  // As in 0.17.1, a click that reaches the button toggles the category whatever prevented its
  // default before. While the label part is given, a prevented click keeps the category as it is,
  // so `preventDefault()` in that part (inside the button) acts as in the button part, whose merge
  // already skips this locked handler on a prevented event.
  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!(labelPart && event.defaultPrevented)) toggleCategory(value, event.nativeEvent);
  };
  const ariaControls = isOpen ? listId : undefined;
  const ariaCurrent = containsCurrent ? true : undefined;
  const containsCurrentMarker = containsCurrent ? '' : undefined;
  const rovingValue = roving ? `wave-nav-category:${value}` : undefined;
  const buttonClassName = wcn(
    navCategoryClassNames.button,
    categoryButtonClasses,
    context.density === 'small' && smallPadding.category,
  );
  const labelClassName = wcn(navCategoryClassNames.label, 'wave:flex-1 wave:text-start');
  const listClassName = isListMounted
    ? wcn(navCategoryClassNames.list, 'wave:m-0 wave:list-none wave:p-0')
    : undefined;

  return (
    <li ref={ref} {...rest} className={wcn(navCategoryClassNames.root, appClassName, className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={ariaControls}
        aria-current={ariaCurrent}
        data-contains-current={containsCurrentMarker}
        data-roving-value={rovingValue}
        onClick={handleToggle}
        className={buttonClassName}
        {...(buttonPart &&
          mergeSlotProps(buttonPart, {
            className: buttonClassName,
            locked: {
              ...NAV_SHOWN_PART_LOCKS,
              type: 'button',
              disabled: undefined,
              'aria-disabled': undefined,
              'data-roving-disabled': undefined,
              'aria-expanded': isOpen,
              'aria-controls': ariaControls,
              'aria-current': ariaCurrent,
              'data-contains-current': containsCurrentMarker,
              'data-roving-value': rovingValue,
              onClick: handleToggle,
            },
          }))}
        ref={buttonMergedRef}
      >
        {renderIcon(icon, navCategoryClassNames.icon)}
        <span
          className={labelClassName}
          {...(labelPart &&
            mergeSlotProps(labelPart, {
              className: labelClassName,
              locked: { ...NAV_SHOWN_PART_LOCKS, 'aria-label': undefined },
            }))}
        >
          {label}
        </span>
        {expandIconElement}
      </button>
      {isListMounted && (
        <NavCategoryValueContext.Provider value={value}>
          <div
            ref={collapseRef}
            {...collapsePresenceProps}
            className={wcn(navCategoryClassNames.collapse, collapseClassName)}
          >
            <ul
              id={listId}
              className={listClassName}
              {...(listPart &&
                mergeSlotProps(listPart, {
                  className: listClassName,
                  locked: { ...NAV_SHOWN_PART_LOCKS, id: listId },
                }))}
              ref={listMergedRef}
            >
              {children}
            </ul>
          </div>
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
 * `actions` puts your own controls (a pin toggle, a menu button) beside the item in its row, in a
 * group named by the item; they never select it.
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
  const appClassName = useAppClassName(navItemClassNames.root);
  const context = useNavContext('Nav.Item');
  useNavValue(context, 'item', props.value);
  useRecordCategory(context, props.value);
  const roving = React.useContext(NavRovingContext);
  const category = React.useContext(NavCategoryValueContext);
  // Called always, rendered only while the item's actions render (D119).
  const generatedId = useId('wave-nav-item');
  const motionPreference = useMotionPreference();
  return renderNavEntry(
    props as NavEntryProps,
    context,
    roving,
    itemClasses,
    {
      appClassName,
      root: navItemClassNames.root,
      listItem: navItemClassNames.listItem,
      actions: navItemClassNames.actions,
      icon: navItemClassNames.icon,
      content: navItemClassNames.content,
    },
    true,
    generatedId,
    motionPreference,
    category,
  );
}
NavItem.displayName = 'NavItem';
markNavPart(NavItem, 'entry');

/**
 * An indented entry inside a `Nav.Category`: a link when `href` is given, a button otherwise.
 * Selected like `Nav.Item` (a click that the browser opens somewhere else selects nothing; one
 * whose default your `onClick` prevents is selected), and typed by overloads like `Nav.Item`
 * (button, link, then {@link NavSubItemDynamicProps}). Takes `actions` like `Nav.Item`.
 *
 * Also exported as `NavSubItem` (import the flat name from React Server Components).
 */
function NavSubItem(props: NavSubItemButtonProps): React.ReactElement;
function NavSubItem(props: NavSubItemAnchorProps): React.ReactElement;
function NavSubItem(props: NavSubItemDynamicProps): React.ReactElement;
function NavSubItem(props: NavSubItemProps | NavSubItemDynamicProps): React.ReactElement {
  const appClassName = useAppClassName(navSubItemClassNames.root);
  const context = useNavContext('Nav.SubItem');
  useNavValue(context, 'item', props.value);
  useRecordCategory(context, props.value);
  const roving = React.useContext(NavRovingContext);
  const category = React.useContext(NavCategoryValueContext);
  // Called always, rendered only while the sub-item's actions render (D119).
  const generatedId = useId('wave-nav-item');
  const motionPreference = useMotionPreference();
  return renderNavEntry(
    props as NavEntryProps,
    context,
    roving,
    subItemClasses,
    {
      appClassName,
      root: navSubItemClassNames.root,
      listItem: navSubItemClassNames.listItem,
      actions: navSubItemClassNames.actions,
    },
    false,
    generatedId,
    motionPreference,
    category,
  );
}
NavSubItem.displayName = 'NavSubItem';
markNavPart(NavSubItem, 'entry');

/**
 * A vertical side navigation (`<nav>` landmark, default name "Navigation") with items, links and
 * collapsible categories.
 *
 * - **Selection**: `value`/`defaultValue`/`onValueChange` (`onValueChange` fires only when the
 *   value changes). A click that opens a link in another tab or window (or downloads it) selects
 *   nothing, unless the item's `onClick` prevents the default (client-side routing: then nothing
 *   opens elsewhere).
 * - **Callbacks**: `onValueChange(value, details)` reports the selected item with the click and
 *   the category it sits in, and `onOpenCategoriesChange(openCategories, details)` the toggled
 *   category, whether it is open now and the click.
 * - **Density**: `density="small"` sets the rows 8px shorter (`data-density`).
 * - **Categories**: `openCategories`/`defaultOpenCategories`/`onOpenCategoriesChange`;
 *   `multiple={false}` keeps at most one category open. Without
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
 * - **Item actions**: `actions` on `Nav.Item` and `Nav.SubItem` (Fluent's SplitNavItem) puts your
 *   own controls beside the item, in a group named by it; each is a Tab stop after the item, and
 *   none selects it. They fade in while the row is hovered or has focus, while one is pressed or
 *   has its menu open, and are always drawn on touch screens and in forced colours. With actions, a
 *   selected item's background and indicator are drawn on its row (`.wave-nav-item__list-item`).
 * - **Motion**: a category's list opens and closes its space with a short collapse and fade
 *   (`motion` on `Nav.Category`), its chevron's turn is animated (`expandIconMotion`) and item
 *   actions fade in. None of these defaults runs under reduced motion, and a `WaveProvider` with
 *   `motion="none"` turns them off, while a category's own `motion` or `expandIconMotion` value
 *   still applies. Focus inside a list that closes moves to its category's toggle button.
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
