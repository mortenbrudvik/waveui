/**
 * Type augmentation for the vitest-axe matcher registered in `src/test-setup.ts`.
 *
 * vitest-axe 0.1 only ships an augmentation of the legacy global `Vi.Assertion` namespace, which
 * Vitest no longer reads, so `expect(results).toHaveNoViolations()` would not type-check. This
 * file augments Vitest's `Matchers<R, T>` interface, the extension point for custom matchers
 * since Vitest 5: `Assertion`, the asymmetric matchers and `expect.extend` read it, and `R` is
 * `void` for a synchronous assertion and `Promise<void>` through `.resolves`/`.rejects`.
 *
 * It also re-declares the `toHaveNoViolations` value export of `vitest-axe/matchers`: the package's
 * `matchers.d.ts` re-exports everything with `export type *`, which makes the runtime function
 * unusable as a value (TS1362) even though `matchers.js` exports it. A local export shadows the
 * type-only star re-export.
 *
 * Part of the dev program (`tsconfig.dev.json`) only; the library program excludes it.
 */
import 'vitest';
import type { AxeCore } from 'vitest-axe';
import type { NoViolationsMatcherResult } from 'vitest-axe/matchers';

declare module 'vitest' {
  // The type parameters must repeat Vitest's own declaration for the interfaces to merge.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    /** vitest-axe: fails when the axe results contain violations. */
    toHaveNoViolations: () => R;
  }
}

declare module 'vitest-axe/matchers' {
  export function toHaveNoViolations(results: AxeCore.AxeResults): NoViolationsMatcherResult;
}
