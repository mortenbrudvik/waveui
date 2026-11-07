// @ts-check
/**
 * The docs app (docs/superpowers/specs/2026-11-07-docs-site-design.md): pre-rendered static pages
 * under `/waveui/docs`, React islands for the live examples. The pages import the library from the
 * repository's own source (`../src`) and its stories (`../stories`), so Vite may read the parent
 * folder; `storybook/test` is replaced by a stub, so a story's `fn()` action pulls in no Storybook
 * or testing-library code. Tailwind compiles the stylesheets the pages import (the library sheet
 * with its `wave:` prefix, as Storybook does).
 */
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  base: '/waveui/docs',
  trailingSlash: 'never',
  build: { assets: '_assets', format: 'file' },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        'storybook/test': fileURLToPath(
          new URL('./src/stories/storybook-test-shim.ts', import.meta.url),
        ),
      },
    },
    server: { fs: { allow: [repoRoot] } },
  },
});
