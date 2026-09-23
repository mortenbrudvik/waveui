// @vitest-environment node
/**
 * Library build configuration (`vite.config.ts`, spec §3.1): externals derived from the manifest
 * (repo-level#4), one output file per source module (repo-level#3), the `"use client"` banner for
 * component and hook modules only (repo-level#2), and the CommonJS declaration copy
 * (repo-level#5). `scripts/verify-dist.mjs` asserts the same properties on the built `dist/`.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import config, { copyIndexDtsToDcts, external, useClient } from '../../vite.config.ts';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const src = (path) => join(root, 'src', ...path.split('/'));

/** Every plugin of the config, nested arrays flattened. */
function pluginNames() {
  return config.plugins
    .flat(Infinity)
    .filter(Boolean)
    .map((plugin) => plugin.name);
}

describe('external (repo-level#4)', () => {
  const declared = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];

  it('covers every dependency and peer dependency of package.json', () => {
    expect(declared).toEqual(
      expect.arrayContaining([
        'react',
        'react-dom',
        'clsx',
        'tailwind-merge',
        '@floating-ui/react-dom',
      ]),
    );
    for (const name of declared) expect(external(name), name).toBe(true);
  });

  it.each([
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom/client',
    'react-dom/server',
    '@floating-ui/react-dom/dist/floating-ui.react-dom.mjs',
    'tailwind-merge/es5',
  ])('externalises the subpath %s', (id) => {
    expect(external(id)).toBe(true);
  });

  it.each([
    './Button',
    '../lib/cn',
    '@/lib/cn',
    'reactive',
    'react-domino',
    'clsx-extra',
    '@floating-ui/react',
    src('lib/cn.ts'),
    '\0rolldown/runtime.js',
  ])('bundles %s', (id) => {
    expect(external(id)).toBe(false);
  });
});

describe('useClient banner (repo-level#2)', () => {
  const chunk = (facadeModuleId) => ({ facadeModuleId });

  it.each([
    'components/button/Button.tsx',
    'components/provider/WaveProvider.tsx',
    'components/input/Option.tsx',
    'components/table/useGridNavigation.ts',
    'hooks/useControllable.ts',
    'hooks/useTriggerElement.tsx',
  ])('adds the directive to src/%s', (path) => {
    expect(useClient(chunk(src(path)))).toBe('"use client";');
  });

  it.each([
    'index.ts',
    'components/button/index.ts',
    'components/overlays/index.ts',
    'hooks/index.ts',
    'components/button/index.tsx',
    'lib/cn.ts',
    'lib/slot.ts',
    'lib/renderTrigger.tsx',
  ])('leaves src/%s without a directive', (path) => {
    expect(useClient(chunk(src(path)))).toBe('');
  });

  it('accepts POSIX separators for a Windows project path', () => {
    expect(useClient(chunk(src('components/button/Button.tsx').split('\\').join('/')))).toBe(
      '"use client";',
    );
  });

  it('adds nothing to chunks without a facade module or outside src', () => {
    expect(useClient(chunk(null))).toBe('');
    expect(useClient(chunk('\0rolldown/runtime.js'))).toBe('');
    expect(
      useClient(chunk(join(root, 'node_modules', 'x', 'src', 'components', 'Thing.tsx'))),
    ).toBe('');
    // A path that merely contains `/src/components/` above the project is not a component module.
    expect(useClient(chunk(join(root, '..', 'src', 'components', 'Thing.tsx')))).toBe('');
  });
});

describe('library build options (repo-level#2, repo-level#3)', () => {
  const { build } = config;

  it('keeps only the entry in build.lib (formats come from the output array)', () => {
    expect(build.lib).toEqual({ entry: expect.stringMatching(/src[\\/]index\.ts$/) });
  });

  it('emits one file per source module in both formats, named .mjs / .cjs', () => {
    const outputs = build.rolldownOptions.output;
    expect(Array.isArray(outputs)).toBe(true);
    expect(outputs.map((output) => output.format)).toEqual(['es', 'cjs']);
    for (const output of outputs) {
      expect(output.preserveModules).toBe(true);
      expect(output.preserveModulesRoot).toBe('src');
      expect(output.banner).toBe(useClient);
    }
    expect(outputs[0].entryFileNames).toBe('[name].mjs');
    expect(outputs[1].entryFileNames).toBe('[name].cjs');
    expect(outputs[1].exports).toBe('named');
  });

  it('uses the manifest-derived external function', () => {
    expect(build.rolldownOptions.external).toBe(external);
  });

  it('emits source maps', () => {
    expect(build.sourcemap).toBe(true);
  });

  it('does not compile CSS in the library build (scripts/build-css.mjs does)', () => {
    const names = pluginNames();
    expect(names.some((name) => /tailwind/i.test(name))).toBe(false);
    expect(names).toContain('vite:dts');
  });
});

describe('copyIndexDtsToDcts (repo-level#5)', () => {
  let dir;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('copies the rolled-up index.d.ts to index.d.cts', () => {
    dir = mkdtempSync(join(tmpdir(), 'wave-dts-'));
    const dts =
      "import { ClassValue } from 'clsx';\nexport declare function cn(...inputs: ClassValue[]): string;\n";
    writeFileSync(join(dir, 'index.d.ts'), dts);
    copyIndexDtsToDcts(dir);
    expect(readFileSync(join(dir, 'index.d.cts'), 'utf8')).toBe(dts);
  });

  it('fails the build when the rolled-up declaration is missing', () => {
    dir = mkdtempSync(join(tmpdir(), 'wave-dts-'));
    expect(() => copyIndexDtsToDcts(dir)).toThrow(/index\.d\.ts/);
    expect(existsSync(join(dir, 'index.d.cts'))).toBe(false);
  });
});
