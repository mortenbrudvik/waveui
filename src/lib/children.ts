/**
 * Children helpers for compound components: identify a part by its element type (lazy Server
 * Component references included) and flatten Fragments. Server-safe: no hooks and no DOM.
 */
import * as React from 'react';

const REACT_LAZY_TYPE = Symbol.for('react.lazy');

interface LazyElementType {
  $$typeof: symbol;
  _payload: unknown;
  _init: (payload: unknown) => unknown;
}

function isLazyElementType(type: unknown): type is LazyElementType {
  return (
    typeof type === 'object' &&
    type !== null &&
    (type as { $$typeof?: unknown }).$$typeof === REACT_LAZY_TYPE
  );
}

function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * The component (or tag) an element renders, with a lazy type unwrapped. A client component
 * written in a React Server Component reaches the client as a lazy reference
 * (`{ $$typeof: Symbol.for('react.lazy'), _payload, _init }`), so compare this, never
 * `element.type`, with a compound part.
 *
 * - Not an element: `undefined`.
 * - A lazy type: its resolved value (`_init(_payload)`); a loaded client reference resolves to the
 *   component. While the chunk is still loading, `_init` throws a thenable, which is rethrown so
 *   the calling component suspends exactly as rendering that lazy would. Any other error from
 *   `_init` returns the lazy object itself (it matches no part; rendering it reports the error).
 * - Anything else: `element.type` (a component, an intrinsic tag string, `React.Fragment`, …).
 */
export function getElementType(node: React.ReactNode): unknown {
  if (!React.isValidElement(node)) return undefined;
  const type: unknown = node.type;
  if (!isLazyElementType(type)) return type;
  try {
    return type._init(type._payload);
  } catch (error) {
    if (isThenable(error)) throw error;
    return type;
  }
}

/**
 * Whether `node` is an element whose type ({@link getElementType}, lazy types unwrapped) is one of
 * `types`. Use it instead of `child.type === Part`, which is false for a part written in a Server
 * Component; it also compares Fragments and intrinsic tags.
 *
 * @example
 * isElementOfType(child, TabListPanel, TabListPanels);
 * isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment);
 * isElementOfType(child, 'li');
 */
export function isElementOfType<P = unknown>(
  node: React.ReactNode,
  ...types: unknown[]
): node is React.ReactElement<P> {
  return React.isValidElement(node) && types.includes(getElementType(node));
}

/**
 * Direct children with Fragments flattened recursively (`null`, `undefined` and booleans dropped),
 * each with a key that is unique across the flattened list and keeps the consumer's own `key`
 * (a Fragment's key prefixes its children's keys: `.$group/.$a`). Use it wherever a component
 * counts, slices or classifies its direct children.
 *
 * @param children The children to flatten.
 * @param prefix   Prepended to every key (used for the recursion).
 */
export function flattenChildren(
  children: React.ReactNode,
  prefix = '',
): Array<{ key: string; node: React.ReactNode }> {
  const result: Array<{ key: string; node: React.ReactNode }> = [];
  React.Children.toArray(children).forEach((child, index) => {
    const key = `${prefix}${React.isValidElement(child) && child.key !== null ? child.key : index}`;
    if (isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment)) {
      result.push(...flattenChildren(child.props.children, `${key}/`));
    } else {
      result.push({ key, node: child });
    }
  });
  return result;
}
