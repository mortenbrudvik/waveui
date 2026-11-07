/**
 * Vitest's jsdom environment with the SSR transform (`viteEnvironment: 'ssr'`): the shell's tests
 * render `.astro` files with Astro's container API, which needs their server build, and then
 * hydrate the island in jsdom. The `shell` project of vitest.config.ts selects it.
 */
import { builtinEnvironments, type Environment } from 'vitest/runtime';

const jsdomSsr: Environment = {
  ...builtinEnvironments.jsdom,
  name: 'jsdom-ssr',
  viteEnvironment: 'ssr',
};

export default jsdomSsr;
