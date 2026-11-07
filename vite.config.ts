/**
 * Library build (spec §3.1). `npm run build` runs it after the type check, then
 * `scripts/build-css.mjs` (the precompiled CSS; the library JS build compiles no CSS) and
 * `scripts/verify-dist.mjs`, which asserts every property configured here on the built `dist/`.
 *
 * - ES modules only (1.0, spec R4): one output file per source module (`preserveModules`),
 *   `dist/<path>.mjs`, so, with `"sideEffects": ["*.css"]`, a consumer bundler drops every module
 *   it does not import (repo-level#3). There is no CommonJS output: Node.js 22.12 and later
 *   loads the ES entry through `require()` too.
 * - Every dependency and peer dependency of package.json is external, subpaths included
 *   (repo-level#4).
 * - `"use client"` heads every component and hook module, never the `index` barrels or
 *   `src/lib`, so Server Components can import `cn` and the flat sub-component names
 *   (repo-level#2).
 * - Declarations are rolled up into `dist/index.d.ts` (repo-level#5), which every condition
 *   resolves.
 *
 * Storybook reuses this file's plugins, never its `build` block; `.storybook/main.ts` removes
 * `unplugin-dts` and adds the Tailwind plugin.
 */
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'unplugin-dts/vite';
import pkg from './package.json' with { type: 'json' };

const root = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(root, 'src');

const externalPackages = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

/**
 * Whether an import stays external: every dependency and peer dependency of package.json and
 * any subpath of one (`react/jsx-runtime`, `react-dom/client`, `@floating-ui/react-dom`).
 */
export function external(id: string): boolean {
  return externalPackages.some((name) => id === name || id.startsWith(`${name}/`));
}

/**
 * Output banner: `"use client";` for chunks whose facade module is a component or hook module
 * (`src/components/**`, `src/hooks/**`), except `index` barrels, which only re-export. Modules of
 * `src/lib` and chunks without a facade module (the runtime helpers) get no directive.
 */
export function useClient(chunk: { facadeModuleId: string | null }): string {
  const id = chunk.facadeModuleId;
  if (!id || id.startsWith('\0')) return '';
  const path = relative(srcDir, resolve(id));
  if (!path || path.startsWith('..') || isAbsolute(path)) return '';
  const [area, ...rest] = path.split(/[\\/]/);
  if (area !== 'components' && area !== 'hooks') return '';
  if (rest.length === 0 || rest.includes('node_modules')) return '';
  return /^index\.tsx?$/.test(rest[rest.length - 1]) ? '' : '"use client";';
}

/**
 * The roll-up of unplugin-dts 1 (the successor of the deprecated vite-plugin-dts) without what it
 * appends after api-extractor's output: every non-exported top-level `declare namespace` of the
 * per-file declarations, namely the `displayName` namespaces of functions that a module exports
 * through an export list (`BreadcrumbItem`, `NavItem`, `NavSubItem`, `DataGridRoot`) and the
 * `NodeJS` namespace of `src/env.d.ts`. A consumer that type-checks libraries
 * (`skipLibCheck: false`) gets TS2395 for the first kind ("Individual declarations in merged
 * declaration must be all exported or all local"). The roll-up itself ends with its last
 * `export { }` line, so everything after that line is such an appendix.
 */
export function withoutAppendedDeclarations(declarations: string): string {
  let end = -1;
  for (const match of declarations.matchAll(/^export \{ \}\r?\n/gm)) {
    end = match.index + match[0].length;
  }
  return end === -1 ? declarations : declarations.slice(0, end);
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      bundleTypes: true,
      tsconfigPath: './tsconfig.json',
      // unplugin-dts appends the non-exported namespaces once it has rolled up: drop them as it
      // writes the roll-up.
      beforeWriteFile: (filePath, content) =>
        /[\\/]index\.d\.ts$/.test(filePath)
          ? { content: withoutAppendedDeclarations(content) }
          : undefined,
    }),
  ],
  build: {
    // `formats: ['es']`: without it Vite 8 builds its default `['es', 'umd']`, and a UMD build
    // of a library with preserved modules fails.
    lib: { entry: resolve(srcDir, 'index.ts'), formats: ['es'] },
    sourcemap: true,
    rolldownOptions: {
      external,
      output: {
        format: 'es',
        entryFileNames: '[name].mjs',
        preserveModules: true,
        preserveModulesRoot: 'src',
        banner: useClient,
      },
    },
  },
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
});
