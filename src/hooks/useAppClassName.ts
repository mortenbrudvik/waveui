import * as React from 'react';
import type * as registry from '../lib/classNames';

/**
 * The root class of every public component and part, from the stable class-name registry (`wave-button`,
 * `wave-card-header`, …): the keys of `WaveProvider classNames`.
 */
export type WaveRootClassName = {
  [K in keyof typeof registry]: (typeof registry)[K] extends { readonly root: infer Root }
    ? Root extends string
      ? Root
      : never
    : never;
}[keyof typeof registry];

/**
 * App-wide classes by root class, as `WaveProvider classNames` takes them: the classes that every
 * component with that root class receives from the provider.
 */
export type WaveClassNames = { [K in WaveRootClassName]?: string };

/** What the providers above give: the merged map, or `null` without any (the default). */
export const AppClassNamesContext = React.createContext<WaveClassNames | null>(null);
AppClassNamesContext.displayName = 'AppClassNamesContext';

/**
 * The app-wide classes that `WaveProvider classNames` gives the root classes `roots` (a variant
 * passes its own root class and those of the components it is built on, base first): their class
 * lists joined, or `undefined` while no provider sets any. Every component calls it once with its
 * own root class(es) and composes the result into the `wcn()` of its root element, after its own
 * classes and before the consumer's `className`, so the consumer's classes still win. Module-only:
 * no provider code, one context read.
 */
export function useAppClassName(...roots: WaveRootClassName[]): string | undefined {
  const classNames = React.useContext(AppClassNamesContext);
  if (classNames === null) return undefined;
  let joined: string | undefined;
  for (const root of roots) {
    const value = classNames[root];
    if (value) joined = joined ? `${joined} ${value}` : value;
  }
  return joined;
}
