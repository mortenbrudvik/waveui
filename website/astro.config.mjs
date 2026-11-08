// @ts-check
/**
 * The docs app (docs/superpowers/specs/2026-11-07-docs-site-design.md): pre-rendered static pages
 * under `/waveui/docs`, React islands for the live examples. The pages import the library from the
 * repository's own source (`../src`) and its stories (`../stories`), so Vite may read the parent
 * folder; `storybook/test` is replaced by a stub, so a story's `fn()` action pulls in no Storybook
 * or testing-library code. Tailwind compiles the stylesheets the pages import (the library sheet
 * with its `wave:` prefix, as Storybook does).
 *
 * The `waveui-example-islands` integration writes one example island per catalog entry to
 * `src/generated/examples/` (git-ignored) whenever the configuration loads, so `astro build`,
 * `astro dev` and the Vitest projects all find them (`src/examples/islands.ts` says why they are
 * generated). The generator is TypeScript and reads the catalog, so Vite's module runner loads it.
 * The same integration clears `.cache/story-report` when a build starts (`astro:build:start`), so
 * the report the pages then write holds exactly the pages of this build.
 *
 * The plugins of `plugins/` (website/BUDGET.md has the measurements):
 *
 * - `localStoryImages`: a story's image address on another host becomes an inline image, in every
 *   environment (no page requests anything from another host).
 * - `splitModules`: the client build splits the library's registries into one module per export,
 *   so a page loads the class names, icons and motion recipes its islands use, not those of all.
 * - `siteChunking`: the client build's `react` and `base` chunks, and the development warnings
 *   dropped from production code.
 */
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { runnerImport } from 'vite';
import { siteChunking } from './plugins/chunking.mjs';
import { localStoryImages } from './plugins/localImages.mjs';
import { REGISTRY_MODULES, splitModules } from './plugins/splitModules.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const siteRoot = fileURLToPath(new URL('.', import.meta.url));

/** The modules whose static closure is the `base` chunk: the shell island and the example runtime. */
const BASE_ROOTS = ['website/src/islands/ShellControls.tsx', 'website/src/islands/Example.tsx'];

/** Loads a TypeScript module of the site with Vite's module runner (build-time code). */
async function loadSiteModule(path) {
  const { module } = await runnerImport(fileURLToPath(new URL(path, import.meta.url)), {
    configFile: false,
    root: siteRoot,
    logLevel: 'silent',
  });
  return module;
}

/** @returns {import('astro').AstroIntegration} */
function exampleIslands() {
  return {
    name: 'waveui-example-islands',
    hooks: {
      'astro:config:setup': async () => {
        /** @type {{ writeExampleIslands: () => unknown }} */
        const { writeExampleIslands } = await loadSiteModule('./src/examples/islands.ts');
        writeExampleIslands();
      },
      'astro:build:start': async () => {
        /** @type {{ clearStoryReports: () => unknown }} */
        const { clearStoryReports } = await loadSiteModule('./src/examples/storyReport.ts');
        clearStoryReports();
      },
    },
  };
}

export default defineConfig({
  base: '/waveui/docs',
  trailingSlash: 'never',
  build: { assets: '_assets', format: 'file' },
  integrations: [react(), exampleIslands()],
  vite: {
    plugins: [
      tailwindcss(),
      localStoryImages({ storiesDir: `${repoRoot}stories` }),
      splitModules({ files: REGISTRY_MODULES.map((file) => `${repoRoot}${file}`) }),
      siteChunking({ baseRoots: BASE_ROOTS.map((file) => `${repoRoot}${file}`) }),
    ],
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
