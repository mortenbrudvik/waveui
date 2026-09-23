import * as React from 'react';
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
 * - shorthand content (string, number, bigint, element, or any iterable of nodes such as an
 *   array, a `Set` or a generator), rendered **inside** the slot's default element;
 * - a {@link SlotObject} (`{ as, className, children, ...attributes }`) for full control;
 * - `null`, `undefined`, `false` or `true`, which render nothing.
 *
 * @typeParam T - The slot's default element type.
 */
export type Slot<T extends React.ElementType = 'span'> =
  | SlotObject<T>
  | React.ReactElement
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Iterable<React.ReactNode>;

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

/**
 * Whether React would render anything for `node`: `null`, `undefined`, booleans and `''` render
 * nothing, and so does an array or other iterable (Set, generator) whose items, at any depth, are
 * all of those. Dropping such content from a void element is silent (a conditional
 * `children: cond && x`, or a list mapped to nothing). Iterables are read through
 * {@link normaliseContent}, so checking a generator does not consume it.
 */
function rendersContent(node: unknown, visiting: Set<object> = new Set()): boolean {
  if (node === undefined || node === null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (typeof node !== 'object' || !(Symbol.iterator in node)) return true;
  // A collection that contains itself adds nothing beyond what is already being checked.
  if (visiting.has(node)) return false;
  visiting.add(node);
  try {
    for (const item of normaliseContent(node) as Iterable<unknown>) {
      if (rendersContent(item, visiting)) return true;
    }
    return false;
  } finally {
    visiting.delete(node);
  }
}

function normaliseContent(slot: unknown): React.ReactNode {
  if (
    typeof slot === 'object' &&
    slot !== null &&
    !Array.isArray(slot) &&
    Symbol.iterator in slot
  ) {
    const iterable = slot as Iterable<React.ReactNode>;
    const iterator = iterable[Symbol.iterator]();
    if ((iterator as unknown) === iterable) {
      let cached = materialisedIterators.get(iterable);
      if (!cached) {
        cached = Array.from({ [Symbol.iterator]: () => iterator });
        materialisedIterators.set(iterable, cached);
      }
      return cached;
    }
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
 *   `children`. When the element is void its `children` are always dropped, with a development
 *   warning only if they would have rendered (not for `null`, `undefined`, `false`, `true` or
 *   `''`, nor for an array, Set or generator made only of those, at any depth).
 * - With a **void** default tag (`img`, `input`, `hr`, …, see {@link VOID_ELEMENTS}) a ReactElement
 *   slot resolves to the element itself (its type and props, `defaultProps` underneath, className
 *   merged). A Fragment and shorthand content resolve to `null` with a development warning (none
 *   for content that renders nothing: `''`, or an iterable made only of empty values) — the
 *   component decides what a string means (Avatar treats it as `src`).
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
    let content = children as React.ReactNode;
    if (isVoidTag(Component)) {
      // A void element never receives children (React throws for any non-null value, even
      // `false` or `[]`); warn only when the dropped children would have rendered something.
      if (rendersContent(content)) {
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
    if (rendersContent(slot)) {
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
