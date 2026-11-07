/**
 * Stand-in for `storybook/test` on the site (aliased in astro.config.mjs). Stories import `fn` for
 * their action args (`onClick: fn()`); the site records no calls, so an action is a no-op and no
 * testing-library or Vitest code reaches a page.
 *
 * `composeStory` of `@storybook/react` brings Storybook's preview modules along, and they import
 * more names from `storybook/test`: `configure` (`@storybook/react`'s preview entry, in its
 * `beforeAll`), `onMockCall` (the actions loader of `storybook/internal/csf`), and the mock and
 * query helpers of the test addon's loaders (`clearAllMocks`, `resetAllMocks`, `restoreAllMocks`,
 * `isMockFunction`, `within`, `uninstrumentedUserEvent`). None of them runs when a composed story
 * only renders (loaders and `beforeAll` run in `story.run()`), so each is an inert stub.
 */
export const fn =
  () =>
  (..._args: unknown[]): void => {};

export const configure = (_options: unknown): void => {};

export const onMockCall =
  (_callback: unknown): (() => void) =>
  () => {};

export const clearAllMocks = (): void => {};
export const resetAllMocks = (): void => {};
export const restoreAllMocks = (): void => {};
export const isMockFunction = (_value: unknown): boolean => false;
export const within = (_element: unknown): Record<string, never> => ({});
export const uninstrumentedUserEvent: Record<string, never> = {};
