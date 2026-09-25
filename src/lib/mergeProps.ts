import type * as React from 'react';
import { cn } from './cn';
import { composeEventHandlers } from './composeEventHandlers';
import { mergeRefs } from './mergeRefs';
import { joinIds } from './aria';

/** Options of {@link mergeProps}. */
export interface MergePropsOptions {
  /**
   * Keys for which our value is kept whenever `ours` defines the key (even as `undefined`).
   * Triggers pass `['aria-expanded', 'aria-controls', 'aria-haspopup']` so a child's static
   * attribute never overrides live state.
   */
  oursWin?: readonly string[];
}

type AnyHandler = (event: { defaultPrevented: boolean }) => void;
type UnknownProps = Record<string, unknown>;

const HANDLER_KEY = /^on[A-Z]/;
const ID_LIST_KEYS = new Set(['aria-describedby', 'aria-labelledby']);

/**
 * Merges the props a component wants to put on an element (`ours`) with the props the consumer or
 * a cloned child already has (`theirs`). Pure: returns a new object and never mutates its inputs.
 *
 * - `on*` handlers present on both sides are composed with `composeEventHandlers` (theirs first;
 *   ours is skipped when theirs calls `preventDefault()`).
 * - `className` = `cn(ours, theirs)` (theirs win Tailwind conflicts); `style` = `{ ...ours, ...theirs }`.
 * - `aria-describedby` / `aria-labelledby` are joined with `joinIds(theirs, ours)`.
 * - `ref`s are merged with `mergeRefs` (a new callback per call: components that clone on every
 *   render use `useTriggerElement`/`useMergedRefs`, which memoise the merged ref).
 * - keys listed in `options.oursWin` keep our value whenever `ours` defines them.
 * - any other key: theirs wins unless it is `undefined`.
 */
export function mergeProps<A, B>(ours: A, theirs: B, options?: MergePropsOptions): A & B {
  const ourProps = (ours ?? {}) as UnknownProps;
  const theirProps = (theirs ?? {}) as UnknownProps;
  const oursWin = options?.oursWin ?? [];
  const result: UnknownProps = { ...ourProps };

  for (const key of Object.keys(theirProps)) {
    const theirValue = theirProps[key];
    const ourValue = ourProps[key];
    const ourHasKey = Object.prototype.hasOwnProperty.call(ourProps, key);

    if (ourHasKey && oursWin.includes(key)) continue;

    if (
      HANDLER_KEY.test(key) &&
      typeof ourValue === 'function' &&
      typeof theirValue === 'function'
    ) {
      result[key] = composeEventHandlers(theirValue as AnyHandler, ourValue as AnyHandler);
    } else if (key === 'className') {
      if (theirValue !== undefined) {
        result[key] = cn(ourValue as string | undefined, theirValue as string | undefined);
      }
    } else if (key === 'style') {
      if (theirValue !== undefined) {
        result[key] =
          ourValue && typeof ourValue === 'object'
            ? { ...(ourValue as React.CSSProperties), ...(theirValue as React.CSSProperties) }
            : theirValue;
      }
    } else if (ID_LIST_KEYS.has(key)) {
      if (theirValue !== undefined) {
        result[key] = joinIds(theirValue as string | undefined, ourValue as string | undefined);
      }
    } else if (key === 'ref') {
      if (theirValue != null) {
        result[key] =
          ourValue != null
            ? mergeRefs(ourValue as React.Ref<unknown>, theirValue as React.Ref<unknown>)
            : theirValue;
      }
    } else if (theirValue !== undefined) {
      result[key] = theirValue;
    }
  }

  return result as A & B;
}
