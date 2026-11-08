/// <reference types="vitest/config" />
/**
 * The site's tests run with the site's Vite configuration (astro.config.mjs through Astro's
 * `getViteConfig`: the React integration, Tailwind and the `storybook/test` stub), in three projects:
 *
 * - `site`: Node, or jsdom where a file asks for it (`// @vitest-environment jsdom`).
 * - `shell`: the tests that render `.astro` files with Astro's container API and then hydrate an
 *   island in the same document (the app shell, the example island). They need jsdom's globals
 *   and the SSR transform at once (an `.astro` file transformed for the browser refuses to
 *   render), which `test/jsdom-ssr.ts` provides; a docblock can name only an installed
 *   environment package, so the project selects it.
 * - `pages`: the tests of the built pages in `dist` (`tests/`). They read an earlier
 *   `astro build` and skip, naming the reason, when there is none or it is older than the sources
 *   (`test/builtSite.ts`); `npm run site:test:pages` builds first and requires them.
 */
import { getViteConfig } from 'astro/config';

const SHELL_TESTS = [
  'src/shell/**/*.test.{ts,tsx}',
  'src/islands/example.test.tsx',
  'src/islands/example.sweep.test.tsx',
  'src/islands/search.test.tsx',
];

export default getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'site',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'plugins/**/*.test.ts'],
          exclude: SHELL_TESTS,
        },
      },
      {
        extends: true,
        test: { name: 'shell', include: SHELL_TESTS, environment: './test/jsdom-ssr.ts' },
      },
      {
        extends: true,
        test: { name: 'pages', include: ['tests/**/*.test.ts'], testTimeout: 120_000 },
      },
    ],
  },
});
