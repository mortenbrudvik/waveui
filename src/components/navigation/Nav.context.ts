import * as React from 'react';
import { getElementType } from '../../lib/children';
import { hasWarned, isDev, reportMissingContext, warnOnce } from '../../lib/dev';

/*
 * The contexts of a Nav root (Nav, NavDrawer) and its parts: the root's state (`NavContext`), the
 * category a sub-item renders in and the roving bookkeeping of an arrow-key body; the category
 * store; the part markers and the children walks that find the current page; the development check
 * of a Nav list's children; and the link-only attributes mask of the button items. Internal; it
 * imports no component, so a root reaches the parts through their markers, never through an import.
 */

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** The two value namespaces of a Nav: items (Nav.Item and Nav.SubItem) and categories. */
export type NavValueKind = 'item' | 'category';

/**
 * The category each sub-item was last shown in, by sub-item value: written from layout effects by
 * the mounted sub-items and by a closed category whose children hold the current value, read by
 * the categories with `useSyncExternalStore`. An entry outlives its sub-item, so a category closed
 * after its current sub-item was shown still knows it contains the current page.
 */
export interface NavCategoryStore {
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
  /** Subscribes to every change of an entry; returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
}

/** A new, empty category store (one per Nav root, created once). */
export function createCategoryStore(): NavCategoryStore {
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

/** The context a Nav root (Nav, NavDrawer) provides to its parts (0.10's fields, unchanged). */
export interface NavContextValue {
  /** The selected item value (`''` when nothing is selected). */
  value: string;
  /**
   * Activation of an item: sets the value, then calls the root's `onActivate` (every activation,
   * re-selection included; Nav's deprecated `onNavItemSelect`).
   */
  select: (value: string) => void;
  /** The values of the open categories. */
  openCategories: readonly string[];
  /** Opens a closed category, closes an open one. */
  toggleCategory: (value: string) => void;
  /** Registers a mounted item or category value (duplicate warning); returns the cleanup. */
  registerValue: (kind: NavValueKind, value: string) => () => void;
  /** The `currentCategory` hint of the root. */
  currentCategory: string | undefined;
  /** The categories the sub-items were last shown in. */
  categoryStore: NavCategoryStore;
}

/** The state of the Nav root around a part (`null` outside one). */
export const NavContext = React.createContext<NavContextValue | null>(null);
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
export const NavCategoryValueContext = React.createContext<string | null>(null);
NavCategoryValueContext.displayName = 'NavCategoryValueContext';

/**
 * The Nav root's context for the part `componentName` (C-CONTEXT): outside a Nav it throws
 * `[WaveUI] <componentName> must be used within Nav` in development, and in production logs once
 * and returns an inert value.
 */
export function useNavContext(componentName: string): NavContextValue {
  const context = React.useContext(NavContext);
  if (context) return context;
  reportMissingContext(componentName, 'Nav');
  return INERT_NAV_CONTEXT;
}

/** Registers the value of a mounted item or category, so the root can warn about duplicates. */
export function useNavValue(context: NavContextValue, kind: NavValueKind, value: string): void {
  const { registerValue } = context;
  React.useEffect(() => registerValue(kind, value), [registerValue, kind, value]);
}

/**
 * Records the category a mounted item renders in, which the category reads once closed (`null`
 * outside a category, which forgets a stale entry for the value).
 */
export function useRecordCategory(context: NavContextValue, value: string): void {
  const category = React.useContext(NavCategoryValueContext);
  const { categoryStore } = context;
  React.useLayoutEffect(() => {
    categoryStore.record(value, category);
  }, [categoryStore, value, category]);
}

// ---------------------------------------------------------------------------
// Roving bookkeeping (an arrow-key body)
// ---------------------------------------------------------------------------

/** What an arrow-key body (NavDrawer.Body `focusMode="arrow"`) gives the Nav parts inside it. */
export interface NavRovingContextValue {
  /**
   * Called by every Nav.Category from a layout effect keyed on `[context, value, containsCurrent]`:
   * `(value, true)` while it is a closed category that holds the current page, `(value, false)`
   * when it stops being one and in the effect's cleanup (an unmount, StrictMode's double mount).
   * Must be stable (memoised by the provider).
   */
  reportCurrentCategory: (category: string, holdsCurrent: boolean) => void;
}

/**
 * Provided (non-null) inside an arrow-key body: every Nav.Item and Nav.SubItem renders
 * `data-roving-value={value}` on its link or button (after the consumer's attributes: the
 * bookkeeping wins), and every category toggle `data-roving-value={'wave-nav-category:' + value}`
 * (stable, also while open), and reports as {@link NavRovingContextValue} says. `null` (the
 * default, every plain Nav): nothing is rendered or reported, so a Nav's server HTML is 0.10's.
 */
export const NavRovingContext = React.createContext<NavRovingContextValue | null>(null);
NavRovingContext.displayName = 'NavRovingContext';

// ---------------------------------------------------------------------------
// Part markers and the children walks
// ---------------------------------------------------------------------------

/** What a marked Nav part is to the walks: an entry (Nav.Item, Nav.SubItem) or a category. */
export type NavPartKind = 'entry' | 'category';

/** The marker property of a Nav part (module-private; read only by {@link getNavPartKind}). */
const NAV_PART: symbol = Symbol.for('wave.navPart');

/**
 * Marks `component` as a Nav part of `kind`, so the walks of a Nav root recognise its elements
 * without importing it; call it next to `displayName`. Returns `component`.
 */
export function markNavPart<T extends object>(component: T, kind: NavPartKind): T {
  (component as Record<symbol, unknown>)[NAV_PART] = kind;
  return component;
}

/**
 * The kind of Nav part `node` is an element of, or `null` for anything else. The type is resolved
 * with `getElementType(node, { suspend: false })`: a lazy client reference (a part written in a
 * Server Component) is recognised, and a lazy type still loading is no part (it never suspends).
 */
export function getNavPartKind(node: React.ReactNode): NavPartKind | null {
  const type = getElementType(node, { suspend: false });
  if ((typeof type !== 'function' && typeof type !== 'object') || type === null) return null;
  const kind = (type as Record<symbol, unknown>)[NAV_PART];
  return kind === 'entry' || kind === 'category' ? kind : null;
}

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
 * The walks below run during the render of a Nav root and of a category, and reach consumer
 * content at any depth. Content that is still loading inside the consumer's own <Suspense> (a
 * promise child, a lazy node, a `React.lazy` component) suspends that boundary when React renders
 * it; walking it must never suspend the Nav itself, which would hide the whole Nav behind an outer
 * boundary. So a child that cannot be read yet is skipped, and a lazy type that is still loading is
 * not a part (its children are still walked). Parts written in a Server Component arrive as loaded
 * client references and are recognized.
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

/**
 * Whether `nodes` contain a Nav.Item/Nav.SubItem element with `value === selected` (parts written
 * in a Server Component, lazy client references, included). Called during render only; never
 * suspends.
 */
export function containsValue(nodes: React.ReactNode, selected: string): boolean {
  let found = false;
  forEachElement(nodes, (child) => {
    if (found) return;
    if (getNavPartKind(child) === 'entry' && child.props.value === selected) {
      found = true;
    } else {
      found = containsValue(childrenOf(child), selected);
    }
  });
  return found;
}

/** The values of the Nav.Category elements (at any depth of JSX) that contain `selected`. */
export function findCategoriesContaining(nodes: React.ReactNode, selected: string): string[] {
  const result: string[] = [];
  if (!selected) return result;
  const visit = (current: React.ReactNode) => {
    forEachElement(current, (child) => {
      const inner = childrenOf(child);
      if (
        getNavPartKind(child) === 'category' &&
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

// ---------------------------------------------------------------------------
// The list-child check
// ---------------------------------------------------------------------------

/** The advice of the list-child warning, by what the list holds. */
const LIST_CHILD_ADVICE = {
  items:
    'Use the Nav parts (Nav.Item, Nav.Category, Nav.SectionHeader, Nav.Divider, Nav.AppItem, Nav.AppItemStatic) as its children, or wrap your own content in an <li>.',
  'sub-items':
    'Use Nav.SubItem, Nav.SectionHeader and Nav.Divider as its children, or wrap your own content in an <li>.',
} as const;

/** Element children a list may hold besides `<li>`: script-supporting elements (React's streaming placeholders). */
const ALLOWED_LIST_CHILDREN = new Set(['li', 'script', 'template']);

/**
 * What the first child node of `list` that a list cannot hold is (`a <div> element`, `text`), or
 * `null` when every child is an `<li>`, a script-supporting element, whitespace text or a comment.
 */
function describeInvalidListChild(list: HTMLElement): string | null {
  for (const node of Array.from(list.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).localName.toLowerCase();
      if (!ALLOWED_LIST_CHILDREN.has(tag)) return `a <${tag}> element`;
    } else if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '') {
      return 'text';
    }
  }
  return null;
}

/**
 * Development only: after every commit of the calling component, warns once per `owner`
 * (`${owner}:list-child`) at the first child node of `list` that is neither an `<li>`, `<script>`
 * nor `<template>` element nor whitespace text (comments, and the nothing that `null`, Fragments
 * and Suspense boundaries render, never warn). `contents` picks the advice: `'items'` the Nav
 * parts, `'sub-items'` Nav.SubItem, Nav.SectionHeader and Nav.Divider.
 */
export function useNavListChildCheck(
  list: React.RefObject<HTMLUListElement | null>,
  owner: string,
  contents: 'items' | 'sub-items',
): void {
  React.useEffect(() => {
    if (!isDev) return;
    const key = `${owner}:list-child`;
    const element = list.current;
    if (!element || hasWarned(key)) return;
    const invalid = describeInvalidListChild(element);
    if (invalid === null) return;
    warnOnce(
      key,
      `${owner}: its list holds ${invalid}, but a list can hold only <li> elements. ${LIST_CHILD_ADVICE[contents]}`,
    );
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The attributes only a link has (`target`, `download`, `hrefLang`, `ping`, …). Button items
 * declare them as `undefined`, so they are a type error without `href` instead of landing on the
 * `<button>`. `rel` cannot be listed (React types it on every element, RDFa); a button item drops
 * it at run time instead.
 */
export type NoAnchorOnlyAttributes = {
  [
    K in Exclude<
      keyof React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof React.ButtonHTMLAttributes<HTMLButtonElement>
    >
  ]?: undefined;
};
