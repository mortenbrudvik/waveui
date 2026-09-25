import * as React from 'react';
import { isElementOfType } from './children';
import { cn } from './cn';
import { warnOnce } from './dev';

/**
 * Object form of a Slot: full control over the rendered element.
 *
 * - `as` renders a different element or component than the slot's default (any element type).
 * - Every attribute of the default element `T` is accepted and forwarded (`{ src, alt }` for an
 *   `'img'` slot, `aria-label`/`title`/handlers for a `'span'` slot), plus `data-*` attributes.
 * - `className` is merged after the component's base classes, so it wins conflicts.
 *
 * @typeParam T - The slot's default element type.
 */
export type SlotObject<T extends React.ElementType = 'span'> = {
  /** Render a different element or component instead of the slot's default. */
  as?: React.ElementType;
  /** Content to render inside the slot element (ignored for void elements such as `img`). */
  children?: React.ReactNode;
  /** Class name(s) merged after the component's base classes (yours win). */
  className?: string;
  /** Inline styles for the slot element. */
  style?: React.CSSProperties;
  /** Ref to the rendered slot element. */
  ref?: React.Ref<unknown>;
  /** Any `data-*` attribute. */
  [dataAttribute: `data-${string}`]: unknown;
} & Omit<React.ComponentPropsWithoutRef<T>, 'children' | 'className' | 'style'>;

/**
 * Slot definition — a customisable sub-element of a component. Accepts:
 *
 * - any `React.ReactNode` as shorthand content (string, number, bigint, element, promise, or any
 *   iterable of nodes such as an array, a `Set` or a generator), rendered **inside** the slot's
 *   default element; `null`, `undefined`, `false` and `true` render nothing;
 * - a {@link SlotObject} (`{ as, className, children, ...attributes }`) for full control.
 *
 * An attributes object typed by an interface (`React.ImgHTMLAttributes<…>`) has no implicit
 * `data-*` index signature, so it is not assignable as is: spread it into a literal,
 * `image={{ ...imgProps }}`.
 *
 * @typeParam T - The slot's default element type.
 */
export type Slot<T extends React.ElementType = 'span'> = SlotObject<T> | React.ReactNode;

/** The normalized output of {@link resolveSlot}, ready for rendering. */
export interface ResolvedSlot {
  /** The element type to render (e.g., 'span', 'div', or a component). */
  Component: React.ElementType;
  /** Merged props including className and any extra HTML attributes. */
  props: Record<string, unknown>;
  /** The content to render inside the element. */
  children: React.ReactNode;
}

/**
 * HTML void elements: they can never have children. A slot whose default tag is one of these
 * renders a ReactElement slot as-is (instead of wrapping it) and never receives shorthand children.
 */
export const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

type UnknownProps = Record<string, unknown>;

function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
}

/**
 * A slot object is a plain object that is not a React element, not a React internal object
 * (`$$typeof`: portals, lazy nodes), not an iterable (arrays, Sets, generators) and not a thenable.
 * Everything else is content and renders as children of the default element.
 */
function isSlotObject(value: unknown): value is UnknownProps {
  if (typeof value !== 'object' || value === null) return false;
  if (React.isValidElement(value)) return false;
  if ('$$typeof' in value) return false;
  if (Symbol.iterator in value) return false;
  if (typeof (value as { then?: unknown }).then === 'function') return false;
  return isPlainObject(value);
}

function isVoidTag(tag: React.ElementType): boolean {
  return typeof tag === 'string' && VOID_ELEMENTS.has(tag);
}

/**
 * One-shot iterators (generators) are materialised into an array once and cached, so React never
 * enumerates a generator (it warns about that) and a second render of the same props (StrictMode)
 * sees the same items. Re-iterable collections (Set, custom iterables) are passed through.
 */
const materialisedIterators = new WeakMap<object, React.ReactNode[]>();

/** Whether `value` is a one-shot iterator (a generator): iterating it returns itself. */
function isOneShotIterator(value: object): boolean {
  if (Array.isArray(value) || !(Symbol.iterator in value)) return false;
  const iterable = value as Iterable<unknown>;
  return (iterable[Symbol.iterator]() as unknown) === iterable;
}

/**
 * Whether React would render anything for `node`: `null`, `undefined`, booleans and `''` render
 * nothing, and so does a Fragment, array or other iterable (Set, generator) whose content, at any
 * depth, is all of those. Dropping such content from a void element is silent (a conditional
 * `children: cond && x`, or a list mapped to nothing). A top-level generator is read through
 * {@link normaliseContent} (materialised once, so checking it does not consume it); a generator
 * nested in a collection or a Fragment is rendered by React as it is, so it is not read and counts
 * as content.
 */
function rendersContent(node: unknown, visiting: Set<object>, nested: boolean): boolean {
  if (node === undefined || node === null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (typeof node !== 'object') return true;
  if (React.isValidElement(node)) {
    if (!isElementOfType<{ children?: React.ReactNode }>(node, React.Fragment)) return true;
    return rendersContent(node.props.children, visiting, true);
  }
  if (!(Symbol.iterator in node)) return true;
  if (nested && isOneShotIterator(node)) return true;
  // A collection that contains itself adds nothing beyond what is already being checked.
  if (visiting.has(node)) return false;
  visiting.add(node);
  try {
    for (const item of normaliseContent(node) as Iterable<unknown>) {
      if (rendersContent(item, visiting, true)) return true;
    }
    return false;
  } finally {
    visiting.delete(node);
  }
}

/**
 * Whether a slot value renders any content — the one "renders nothing" rule of the library, for
 * slots and any other content a component shows or leaves out (labels, titles, dismiss content).
 *
 * `false` for `null`, `undefined`, booleans and `''`, and for a Fragment, array, `Set`, generator
 * or other iterable whose content, at any depth, is only those (`<></>`, `[null, '']`,
 * `<>{false}</>`); a Fragment is recognised by its unwrapped type, also when it is a client
 * reference written in a Server Component. `true` for everything else: text, numbers (including
 * `0`), other React elements (the helper cannot know what a component renders), slot objects
 * (they always render their element), promises, and a generator nested in a collection or a
 * Fragment (not read, so React still renders its items).
 *
 * A top-level generator is materialised once and cached, so checking it does not consume it:
 * render the checked value through `renderSlot`/`resolveSlot`, or, when you render it yourself,
 * through {@link materialiseSlotContent}. Never warns. Call it during render: a client reference
 * whose code is still loading suspends the caller, as rendering it would.
 *
 * Components use it to fall back when a slot is effectively empty, e.g. Avatar shows the initials
 * unless `icon && slotRendersContent(icon)`.
 *
 * @param slot A slot value or any React node.
 */
export function slotRendersContent(slot: unknown): boolean {
  return rendersContent(slot, new Set(), false);
}

/**
 * The content to render for a value that {@link slotRendersContent} checked, for a component that
 * renders it itself rather than through `renderSlot`/`resolveSlot`: a top-level generator is
 * replaced by its materialised items (the same array on every call, so a second render sees the
 * same items and React never enumerates the generator); every other value is returned as given.
 *
 * @example
 * const hasAction = slotRendersContent(action);
 * return hasAction ? <span className="ms-auto">{materialiseSlotContent(action)}</span> : null;
 *
 * @param content A slot value or any React node.
 */
export function materialiseSlotContent(content: unknown): React.ReactNode {
  return normaliseContent(content);
}

function normaliseContent(slot: unknown): React.ReactNode {
  if (typeof slot === 'object' && slot !== null && isOneShotIterator(slot)) {
    const iterable = slot as Iterable<React.ReactNode>;
    let cached = materialisedIterators.get(iterable);
    if (!cached) {
      cached = Array.from(iterable);
      materialisedIterators.set(iterable, cached);
    }
    return cached;
  }
  return slot as React.ReactNode;
}

function describeTag(tag: React.ElementType): string {
  return typeof tag === 'string' ? `<${tag}>` : 'a void element';
}

/** `cn(base, own)`, or `undefined` when there are no classes, so no empty `class=""` renders. */
function mergeClassName(baseClassName: string | undefined, className: unknown): string | undefined {
  return cn(baseClassName, className as string | undefined) || undefined;
}

/**
 * Resolves a Slot value into a `{ Component, props, children }` triple.
 *
 * - `null`, `undefined`, `false` and `true` resolve to `null` (render nothing).
 * - A slot object resolves to `Component = as ?? defaultAs`,
 *   `props = { ...defaultProps, ...attributes, className: cn(baseClassName, className) }` and its
 *   `children` (a generator materialised into an array once, as for shorthand content). When the
 *   element is void its `children` are always dropped, with a development warning only if they
 *   would have rendered (not for `null`, `undefined`, booleans or `''`, nor for a Fragment,
 *   array, Set or generator made only of those, at any depth).
 * - With a **void** default tag (`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`,
 *   `link`, `meta`, `param`, `source`, `track`, `wbr`) a ReactElement slot resolves to the
 *   element itself (its type and props, `defaultProps` underneath, className merged). A Fragment
 *   and shorthand content resolve to `null` with a development warning (none for content that
 *   renders nothing) — the component decides what a string means (Avatar treats it as `src`).
 * - Any other value (string, number, element, array, Set, generator, promise) becomes the children
 *   of `defaultAs` with `{ ...defaultProps, className: baseClassName }`.
 * - `props.className` is `undefined` (never `''`) when there are no classes, so no empty `class`
 *   attribute renders; it always replaces a `className` in `defaultProps`.
 *
 * @param slot           The slot value from component props.
 * @param defaultAs      The default element type (e.g., 'span', 'div'). Defaults to 'span'.
 * @param baseClassName  Base classes; the slot's own className is merged after them and wins.
 * @param defaultProps   Default attributes (e.g. `{ 'aria-hidden': true }` for icon slots) that
 *                       the slot's own props override.
 */
export function resolveSlot<T extends React.ElementType = 'span'>(
  slot: Slot<T> | undefined | null,
  defaultAs?: T,
  baseClassName?: string,
  defaultProps?: Record<string, unknown>,
): ResolvedSlot | null {
  if (slot === null || slot === undefined || typeof slot === 'boolean') {
    return null;
  }

  const tag: React.ElementType = defaultAs ?? 'span';
  const defaults: UnknownProps = defaultProps ?? {};

  if (isSlotObject(slot)) {
    const { as: slotAs, children, className, ...rest } = slot;
    const Component = (slotAs as React.ElementType | undefined) ?? tag;
    let content = normaliseContent(children);
    if (isVoidTag(Component)) {
      // A void element never receives children (React throws for any non-null value, even
      // `false` or `[]`); warn only when the dropped children would have rendered something.
      if (slotRendersContent(content)) {
        warnOnce(
          `slot:void-children:${String(Component)}`,
          `A slot rendered as ${describeTag(Component)} cannot have children; its \`children\` were ignored.`,
        );
      }
      content = undefined;
    }
    return {
      Component,
      props: {
        ...defaults,
        ...rest,
        className: mergeClassName(baseClassName, className),
      },
      children: content,
    };
  }

  if (isVoidTag(tag)) {
    if (React.isValidElement(slot) && slot.type !== React.Fragment) {
      const { children, className, ...elementProps } = slot.props as UnknownProps;
      return {
        Component: slot.type as React.ElementType,
        props: {
          ...defaults,
          ...elementProps,
          className: mergeClassName(baseClassName, className),
        },
        children: children as React.ReactNode,
      };
    }
    if (React.isValidElement(slot)) {
      warnOnce(
        `slot:void-fragment:${String(tag)}`,
        `A Fragment cannot stand in for ${describeTag(tag)} (a void element): it cannot take the slot's className or attributes. Pass the element itself or an object slot instead; the slot was not rendered.`,
      );
      return null;
    }
    if (slotRendersContent(slot)) {
      warnOnce(
        `slot:void-content:${String(tag)}`,
        `Slot content cannot be rendered inside ${describeTag(tag)} (a void element). Pass an element or an object slot instead; the slot was not rendered.`,
      );
    }
    return null;
  }

  return {
    Component: tag,
    props: {
      ...defaults,
      className: baseClassName || undefined,
    },
    children: normaliseContent(slot),
  };
}

/**
 * Renders a slot (see {@link resolveSlot} for the rules). Returns `null` when the slot is empty.
 *
 * @param slot           The slot value from component props.
 * @param defaultAs      The default element type (e.g., 'span', 'div'). Defaults to 'span'.
 * @param baseClassName  Base classes; the slot's own className is merged after them and wins.
 * @param defaultProps   Default attributes that the slot's own props override, e.g.
 *                       `renderSlot(icon, 'span', 'shrink-0', { 'aria-hidden': true })`.
 * @returns A React element, or `null` if the slot is empty.
 */
export function renderSlot<T extends React.ElementType = 'span'>(
  slot: Slot<T> | undefined | null,
  defaultAs?: React.ElementType,
  baseClassName?: string,
  defaultProps?: Record<string, unknown>,
): React.ReactElement | null {
  const resolved = resolveSlot<React.ElementType>(
    slot as Slot<React.ElementType>,
    defaultAs,
    baseClassName,
    defaultProps,
  );
  if (!resolved) return null;

  const { Component, props, children } = resolved;
  return children === undefined
    ? React.createElement(Component, props)
    : React.createElement(Component, props, children);
}
