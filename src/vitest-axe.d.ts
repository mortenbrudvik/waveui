/**
 * Type augmentation for the custom matchers registered in `src/test-setup.ts`: jest-dom's and
 * vitest-axe's `toHaveNoViolations`.
 *
 * Both are added to Vitest's `Matchers<R, T>` interface, the extension point for custom matchers
 * since Vitest 5: `Assertion`, the asymmetric matchers and `expect.extend` read it, and `R` is
 * `void` for a synchronous assertion and `Promise<void>` through `.resolves`/`.rejects`.
 * - jest-dom 7's `/vitest` entry augments `Assertion<T>`, which does not merge with Vitest 5's
 *   `Assertion<R, T>` (TS2428), so the setup registers the matchers from `/matchers` and this file
 *   extends `Matchers` with the package's `TestingLibraryMatchers` instead.
 * - vitest-axe 0.1 only ships an augmentation of the legacy global `Vi.Assertion` namespace, which
 *   Vitest no longer reads, so `expect(results).toHaveNoViolations()` would not type-check without
 *   this file.
 *
 * It also re-declares the `toHaveNoViolations` value export of `vitest-axe/matchers`: the package's
 * `matchers.d.ts` re-exports everything with `export type *`, which makes the runtime function
 * unusable as a value (TS1362) even though `matchers.js` exports it. A local export shadows the
 * type-only star re-export.
 *
 * Part of the dev program (`tsconfig.dev.json`) only; the library program excludes it.
 */
import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import type { AxeCore } from 'vitest-axe';
import type { NoViolationsMatcherResult } from 'vitest-axe/matchers';

declare module 'vitest' {
  // The type parameters must repeat Vitest's own declaration for the interfaces to merge.
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- repeated for the merge
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {
    /** vitest-axe: fails when the axe results contain violations. */
    toHaveNoViolations: () => R;
  }
}

declare module 'vitest-axe/matchers' {
  export function toHaveNoViolations(results: AxeCore.AxeResults): NoViolationsMatcherResult;
}
