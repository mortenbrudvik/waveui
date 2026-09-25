/**
 * Type augmentation for the vitest-axe matcher registered in `src/test-setup.ts`.
 *
 * vitest-axe 0.1 only ships an augmentation of the legacy global `Vi.Assertion` namespace, which
 * Vitest 4 no longer reads, so `expect(results).toHaveNoViolations()` did not type-check. This file
 * augments the `vitest` module the same way `@testing-library/jest-dom/vitest` does.
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
import type { AxeMatchers, NoViolationsMatcherResult } from 'vitest-axe/matchers';

declare module 'vitest' {
  // Type parameters must match Vitest's own declarations for the interfaces to merge.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

declare module 'vitest-axe/matchers' {
  export function toHaveNoViolations(results: AxeCore.AxeResults): NoViolationsMatcherResult;
}
