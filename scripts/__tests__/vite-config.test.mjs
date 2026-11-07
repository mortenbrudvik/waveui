// @vitest-environment node
/**
 * Library build configuration (`vite.config.ts`, spec §3.1): externals derived from the manifest
 * (repo-level#4), one ES module per source module and no CommonJS output (repo-level#3; 1.0, spec
 * R4), and the `"use client"` banner for component and hook modules only (repo-level#2).
 * `scripts/verify-dist.mjs` asserts the same properties on the built `dist/`.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as viteConfig from '../../vite.config.ts';

const { default: config, external, useClient } = viteConfig;

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

  it('builds the entry as an ES library only (Vite 8 would add UMD without formats)', () => {
    expect(build.lib).toEqual({
      entry: expect.stringMatching(/src[\\/]index\.ts$/),
      formats: ['es'],
    });
  });

  it('emits one ES module per source module, named .mjs, and no CommonJS (spec R4)', () => {
    expect(build.rolldownOptions.output).toEqual({
      format: 'es',
      entryFileNames: '[name].mjs',
      preserveModules: true,
      preserveModulesRoot: 'src',
      banner: useClient,
    });
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
    expect(names).toContain('unplugin-dts');
  });

  it('rolls up index.d.ts and makes no CommonJS copy of it (repo-level#5, spec R4)', () => {
    // 0.x copied the roll-up to index.d.cts after the declaration build.
    expect(viteConfig).not.toHaveProperty('copyIndexDtsToDcts');
  });
});

describe('withoutAppendedDeclarations (unplugin-dts appends non-exported namespaces)', () => {
  const { withoutAppendedDeclarations } = viteConfig;

  it('keeps the roll-up up to its last export list and drops the appended namespaces', () => {
    const rollUp = 'export declare const a: 1;\n\nexport { }\n';
    const appended = `${rollUp}\n\ndeclare namespace NavItem {\n    var displayName: string;\n}\n`;
    expect(withoutAppendedDeclarations(appended)).toBe(rollUp);
  });

  it('leaves a roll-up with nothing appended, and one without an export list, as it is', () => {
    expect(withoutAppendedDeclarations('export { }\n')).toBe('export { }\n');
    expect(withoutAppendedDeclarations('declare const a: 1;\n')).toBe('declare const a: 1;\n');
  });

  it('handles CRLF line endings', () => {
    expect(withoutAppendedDeclarations('x\r\nexport { }\r\ndeclare namespace A {}\r\n')).toBe(
      'x\r\nexport { }\r\n',
    );
  });
});
