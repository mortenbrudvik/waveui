import { useId as useReactId } from 'react';

/**
 * Generate a stable unique ID, optionally with a prefix.
 * Wraps React's useId for consistent usage across components.
 *
 * @param prefix - Optional string prepended to the generated ID (e.g., `'button'` produces `'button-:r0:'`).
 * @returns A unique, SSR-safe identifier string.
 */
export function useId(prefix?: string): string {
  const id = useReactId();
  return prefix ? `${prefix}-${id}` : id;
}
