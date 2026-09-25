/**
 * Library build (spec §3.1). `npm run build` runs it after the type check, then
 * `scripts/build-css.mjs` (the precompiled CSS; the library JS build compiles no CSS) and
 * `scripts/verify-dist.mjs`, which asserts every property configured here on the built `dist/`.
 *
 * - One output file per source module (`preserveModules`) in both formats — `dist/<path>.mjs`
 *   and `dist/<path>.cjs` — so, with `"sideEffects": ["*.css"]`, a consumer bundler drops every
 *   module it does not import (repo-level#3).
 * - Every dependency and peer dependency of package.json is external, subpaths included
 *   (repo-level#4).
 * - `"use client"` heads every component and hook module, never the `index` barrels or
 *   `src/lib`, so Server Components can import `cn` and the flat sub-component names
 *   (repo-level#2).
 * - Declarations are rolled up into `dist/index.d.ts` and copied to `dist/index.d.cts` for the
 *   `require` condition (repo-level#5).
 *
 * Storybook reuses this file's plugins, never its `build` block; `.storybook/main.ts` removes
 * `vite:dts` and adds the Tailwind plugin.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with { type: 'json' };

const root = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(root, 'src');
const outDir = resolve(root, 'dist');

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
 * Copies the rolled-up `index.d.ts` to `index.d.cts`, the declaration of the `require` condition
 * (a `.d.ts` file of a `"type": "module"` package describes an ES module, so CommonJS consumers
 * need their own). Throws when the rolled-up declaration is missing, failing the build.
 */
export function copyIndexDtsToDcts(dir: string = outDir): void {
  const source = join(dir, 'index.d.ts');
  if (!existsSync(source)) {
    throw new Error(`copyIndexDtsToDcts: ${source} was not emitted`);
  }
  copyFileSync(source, join(dir, 'index.d.cts'));
}

const perModule = {
  preserveModules: true,
  preserveModulesRoot: 'src',
  banner: useClient,
} as const;

export default defineConfig({
  plugins: [
    react(),
    dts({
      rollupTypes: true,
      tsconfigPath: './tsconfig.json',
      afterBuild: () => copyIndexDtsToDcts(),
    }),
  ],
  build: {
    // No `formats`: Vite ignores it (and warns) when `output` is an array.
    lib: { entry: resolve(srcDir, 'index.ts') },
    sourcemap: true,
    rolldownOptions: {
      external,
      output: [
        { ...perModule, format: 'es', entryFileNames: '[name].mjs' },
        { ...perModule, format: 'cjs', entryFileNames: '[name].cjs', exports: 'named' },
      ],
    },
  },
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
});
