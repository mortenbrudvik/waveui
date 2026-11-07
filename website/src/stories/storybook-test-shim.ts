/**
 * Stand-in for `storybook/test` on the site (aliased in astro.config.mjs). Stories import `fn` for
 * their action args (`onClick: fn()`); the site records no calls, so an action is a no-op and no
 * testing-library or Vitest code reaches a page.
 *
 * The site composes stories itself (runtime.tsx) and never runs a `play` function, so the other
 * names a `play` function may import (`expect`, `userEvent`, `within`, `waitFor`) only have to
 * exist: each is an inert stub. Storybook's own preview modules, which import more names from
 * `storybook/test`, are not part of the site.
 */
export const fn =
  () =>
  (..._args: unknown[]): void => {};

/** Never called: `play` functions do not run on the site. */
export const expect = (_actual: unknown): Record<string, never> => ({});

/** Never called: `play` functions do not run on the site. */
export const userEvent: Record<string, never> = {};

/** Never called: `play` functions do not run on the site. */
export const within = (_element: unknown): Record<string, never> => ({});

/** Never called: `play` functions do not run on the site. */
export const waitFor = async (_callback: unknown): Promise<void> => {};
