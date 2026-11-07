/// <reference types="vitest/config" />
/**
 * The site's tests run with the site's Vite configuration (astro.config.mjs through Astro's
 * `getViteConfig`: the React integration, Tailwind and the `storybook/test` stub), in two projects:
 *
 * - `site`: Node, or jsdom where a file asks for it (`// @vitest-environment jsdom`).
 * - `shell`: the app shell's tests, which render `.astro` layouts with Astro's container API and
 *   then hydrate the island in the same document. They need jsdom's globals and the SSR
 *   transform at once (an `.astro` file transformed for the browser refuses to render), which
 *   `test/jsdom-ssr.ts` provides; a docblock can name only an installed environment package, so
 *   the project selects it.
 */
import { getViteConfig } from 'astro/config';

const SHELL_TESTS = ['src/shell/**/*.test.{ts,tsx}'];

export default getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'site',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
          exclude: SHELL_TESTS,
        },
      },
      {
        extends: true,
        test: { name: 'shell', include: SHELL_TESTS, environment: './test/jsdom-ssr.ts' },
      },
    ],
  },
});
