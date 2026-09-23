import { useId as useReactId } from 'react';

/**
 * Generates a stable, SSR-safe unique id, optionally with a prefix. Wraps React's `useId` so every
 * component builds DOM ids the same way (C-IDS).
 *
 * The part after the prefix is React's opaque id; its format depends on the React version, so never
 * parse it or write selectors or test expectations against a literal form. Query elements by role
 * and relationship (`aria-labelledby`, `htmlFor`) instead, and use `CSS.escape` when an id has to
 * go into a selector.
 *
 * @param prefix - Optional string prepended with a hyphen: `useId('button')` returns
 *   `button-<react id>`.
 * @returns A unique id string, identical on the server and the client.
 */
export function useId(prefix?: string): string {
  const id = useReactId();
  return prefix ? `${prefix}-${id}` : id;
}
