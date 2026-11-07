/// <reference types="vitest/config" />
/**
 * The site's tests run with the site's Vite configuration (astro.config.mjs through Astro's
 * `getViteConfig`: the React integration, Tailwind and the `storybook/test` stub), in Node.
 */
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
});
