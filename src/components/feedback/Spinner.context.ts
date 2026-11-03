import * as React from 'react';
import type { Size } from '../../lib/types';

/*
 * The size a surrounding `SpinnerContextProvider` gives its Spinners (Fluent's `SpinnerContext`).
 * Imports no component: `Spinner.tsx` imports this module, never the reverse.
 */

/**
 * Size of a {@link Spinner}: the five sizes of 0.x (12, 16, 24, 36 and 48px) and, as Fluent's,
 * `extra-tiny` (16px), `tiny` (20px) and `huge` (44px).
 */
export type SpinnerSize = Size | 'extra-tiny' | 'tiny' | 'huge';

/** What {@link SpinnerContextProvider} gives the Spinners below it. */
export interface SpinnerContextValue {
  /** The size a Spinner without a `size` of its own takes. */
  size?: SpinnerSize;
}

/** Internal: the value is `null` outside a `SpinnerContextProvider`. */
export const SpinnerContext = React.createContext<SpinnerContextValue | null>(null);
SpinnerContext.displayName = 'SpinnerContext';
