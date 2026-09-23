// @vitest-environment node
/**
 * The package manifest (spec §3.2; repo-level#1, #3, #5) and the assertions of
 * `scripts/pack-smoke.mjs` (`npm run test:pack`). The smoke run itself packs the tarball and
 * installs it into the fixtures of `scripts/fixtures/` — too slow and network-bound for the unit
 * suite; `npm run test:pack` is part of `prepublishOnly` and of the final gate. Here every
 * assertion function is exercised on inputs that reproduce the defects it guards against.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkPackedFiles,
  checkPlainCss,
  checkPlainSmoke,
  checkTailwindCss,
  checkTypeProgram,
  EXPORTED_SUBPATHS,
  fixtureManifest,
  parseArgs,
} from '../pack-smoke.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

describe('package.json (spec §3.2)', () => {
  it('nests the declarations under the import and require conditions (repo-level#5)', () => {
    expect(pkg.exports['.']).toEqual({
      import: { types: './dist/index.d.ts', default: './dist/index.mjs' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    });
    // `types` must come first inside each condition.
    expect(Object.keys(pkg.exports['.'].import)[0]).toBe('types');
    expect(Object.keys(pkg.exports['.'].require)[0]).toBe('types');
    expect(pkg.main).toBe('./dist/index.cjs');
    expect(pkg.module).toBe('./dist/index.mjs');
    expect(pkg.types).toBe('./dist/index.d.ts');
  });

  it('maps the style entries to the precompiled CSS and the Tailwind sources (repo-level#1)', () => {
    const { '.': _main, ...styles } = pkg.exports;
    expect(styles).toEqual({
      './styles': './dist/styles.css',
      './styles.css': './dist/styles.css',
      './preflight.css': './dist/preflight.css',
      './tailwind': './src/styles/tailwind.css',
      './tailwind.css': './src/styles/tailwind.css',
      './tokens': './src/styles/tokens.css',
      './tokens.css': './src/styles/tokens.css',
      './legacy-tokens.css': './src/styles/legacy-tokens.css',
      './package.json': './package.json',
    });
    expect(Object.keys(pkg.exports)).toEqual(['.', ...EXPORTED_SUBPATHS]);
  });

  it('publishes dist and the style sources without their tests', () => {
    expect(pkg.files).toEqual(['dist', 'src/styles', '!src/styles/__tests__']);
  });

  it('marks only CSS as side-effectful, so bundlers drop unused modules (repo-level#3)', () => {
    expect(pkg.sideEffects).toEqual(['*.css']);
  });

  it('builds the CSS and verifies dist in `build`', () => {
    expect(pkg.scripts.build).toBe(
      'tsc -p tsconfig.json --noEmit && vite build && node scripts/build-css.mjs && node scripts/verify-dist.mjs',
    );
  });

  it('runs the packaging smoke test and every gate before publishing', () => {
    expect(pkg.scripts['test:pack']).toBe('node scripts/pack-smoke.mjs');
    // `verify-dist --final` closes the PENDING_FLAT_EXPORTS bridge that `npm run build` accepts
    // while the component packages add their flat names (repo-level#2).
    expect(pkg.scripts.prepublishOnly).toBe(
      'npm run typecheck && npm run build && node scripts/verify-dist.mjs --final && npm test && ' +
        'npm run check:package && npm run test:pack',
    );
  });

  it('verifies the Storybook build right after building it', () => {
    expect(pkg.scripts['build-storybook']).toBe(
      'storybook build && node scripts/verify-storybook.mjs',
    );
  });

  it('declares Tailwind as an optional peer (the ./tailwind entry needs it)', () => {
    expect(pkg.peerDependencies.tailwindcss).toMatch(/^\^4\./);
    expect(pkg.peerDependenciesMeta).toEqual({ tailwindcss: { optional: true } });
  });

  it('points every export target at a file the package publishes', () => {
    const published = (target) =>
      target === './package.json' ||
      pkg.files
        .filter((entry) => !entry.startsWith('!'))
        .some((entry) => target.startsWith(`./${entry}/`));
    for (const target of Object.values(pkg.exports).flatMap((value) =>
      typeof value === 'string'
        ? [value]
        : Object.values(value).flatMap((condition) => Object.values(condition)),
    )) {
      expect(published(target), target).toBe(true);
    }
  });
});

describe('checkPackedFiles', () => {
  const good = [
    'package.json',
    'README.md',
    'LICENSE',
    'dist/index.mjs',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
    'dist/styles.css',
    'dist/preflight.css',
    'dist/lib/cn.mjs',
    'dist/components/button/Button.mjs',
    'src/styles/tailwind.css',
    'src/styles/tokens.css',
    'src/styles/base.css',
    'src/styles/legacy-tokens.css',
    'src/styles/styles.css',
  ];

  it('passes a tarball with every export target and nothing else from the sources', () => {
    expect(checkPackedFiles(good, pkg)).toEqual([]);
  });

  it('reports an export target missing from the tarball', () => {
    const errors = checkPackedFiles(
      good.filter((path) => path !== 'dist/index.d.cts' && path !== 'dist/styles.css'),
      pkg,
    );
    expect(errors).toEqual([
      expect.stringContaining('./dist/index.d.cts'),
      expect.stringContaining('./dist/styles.css'),
    ]);
  });

  it('reports tests, stories, component sources and scripts in the tarball', () => {
    const errors = checkPackedFiles(
      [
        ...good,
        'src/styles/__tests__/tokens.test.ts',
        'stories/Button.stories.tsx',
        'src/components/button/Button.tsx',
        'scripts/build-css.mjs',
      ],
      pkg,
    );
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/__tests__/);
    expect(errors.join('\n')).toMatch(/stories/);
    expect(errors.join('\n')).toMatch(/src\/components/);
    expect(errors.join('\n')).toMatch(/scripts/);
  });

  it('reports a tarball whose @import of a style source is not published', () => {
    const errors = checkPackedFiles(
      good.filter((path) => path !== 'src/styles/base.css'),
      pkg,
    );
    expect(errors).toEqual([expect.stringContaining('src/styles/base.css')]);
  });
});

describe('checkPlainCss (repo-level#1)', () => {
  const reset =
    ':where(.wave-root,.wave-portal) :where(button,input,select,textarea){font:inherit;margin:0}';
  const good =
    '@layer properties{@supports (x:y){*,:before{--tw-border-style:solid}}}' +
    ':root,.wave-light{--wave-primary:#0f6cbd}' +
    '.wave-root,.wave-portal{font-family:var(--wave-font-family)}' +
    reset +
    '.bg-primary{background-color:var(--wave-primary)}' +
    '.text-body-1{font-size:14px}' +
    '@keyframes wave-spin{to{transform:rotate(360deg)}}';

  it('passes unlayered CSS with the classes, tokens, keyframes and scoped reset', () => {
    expect(checkPlainCss(good)).toEqual([]);
  });

  it('reports layered output (unlayered consumer CSS would beat every Wave rule)', () => {
    const errors = checkPlainCss(`@layer theme,base,utilities;@layer utilities{${good}}`);
    expect(errors.join('\n')).toMatch(/@layer/);
  });

  it.each([
    ['.bg-primary', good.replace('.bg-primary{', '.bg-secondary{')],
    ['.text-body-1', good.replace('.text-body-1{', '.text-body-2{')],
    ['--wave-primary', good.replace('--wave-primary:', '--primary:')],
    ['@keyframes wave-spin', good.replace('@keyframes wave-spin', '@keyframes spin')],
    ['reset', good.replace(reset, '')],
  ])('reports missing %s', (what, css) => {
    expect(checkPlainCss(css).join('\n')).toContain(what === 'reset' ? 'native' : what);
  });

  it('reports raw Tailwind source (the 0.4 ./styles entry)', () => {
    expect(
      checkPlainCss("@import 'tailwindcss';\n@theme inline { --color-primary: red; }").join('\n'),
    ).toMatch(/@import|@theme/);
  });
});

describe('checkTailwindCss (repo-level#1)', () => {
  const good =
    '@layer theme,base,components,utilities;' +
    '@layer theme{:root,:host{--color-red-500:red}:root,.wave-light{--wave-primary:#0f6cbd}}' +
    '@layer base{*{box-sizing:border-box}.wave-root,.wave-portal{font-family:var(--wave-font-family)}}' +
    '@layer utilities{.bg-primary{background-color:var(--color-primary)}.text-body-1{font-size:14px}.p-4{padding:1rem}}';

  it('passes Wave tokens in theme, base rules in base and the component classes from dist', () => {
    expect(checkTailwindCss(good)).toEqual([]);
  });

  it('reports component classes that were not generated (dist not scanned)', () => {
    const css = good.replace('.bg-primary{background-color:var(--color-primary)}', '');
    expect(checkTailwindCss(css).join('\n')).toMatch(/\.bg-primary/);
  });

  it('reports Wave base rules outside @layer base', () => {
    const css = good
      .replace('.wave-root,.wave-portal{font-family:var(--wave-font-family)}', '')
      .concat('.wave-root,.wave-portal{font-family:var(--wave-font-family)}');
    expect(checkTailwindCss(css).join('\n')).toMatch(/@layer base/);
  });

  it('reports Wave tokens outside @layer theme', () => {
    const css =
      good.replace(':root,.wave-light{--wave-primary:#0f6cbd}', '') +
      ':root,.wave-light{--wave-primary:#0f6cbd}';
    expect(checkTailwindCss(css).join('\n')).toMatch(/@layer theme/);
  });

  it("reports a missing consumer utility (the fixture's own sources were not scanned)", () => {
    expect(checkTailwindCss(good.replace('.p-4{padding:1rem}', '')).join('\n')).toMatch(/\.p-4/);
  });
});

describe('checkPlainSmoke', () => {
  // `./x` and `./x.css` are aliases of one file.
  const resolved = Object.fromEntries(
    EXPORTED_SUBPATHS.map((subpath) => [
      subpath,
      `/app/node_modules/@mortenbrudvik/waveui/${subpath.replace(/^\.\//, '').replace(/\.css$/, '')}`,
    ]),
  );
  const side = { names: ['Button', 'WaveProvider', 'cn', 'CardHeader'], cn: 'a b', resolved };
  const good = { esm: side, cjs: side };

  it('passes when ESM and CJS load the same names and every subpath resolves', () => {
    expect(checkPlainSmoke(good)).toEqual([]);
  });

  it('reports a format that fails to load or lacks names', () => {
    const errors = checkPlainSmoke({
      cjs: { error: "Cannot find module './dist/index.cjs'", resolved },
      esm: { ...side, names: ['cn'] },
    });
    expect(errors.join('\n')).toMatch(/require.*Cannot find module/);
    expect(errors.join('\n')).toMatch(/Button/);
  });

  it('reports a wrong cn result and names that differ between the formats', () => {
    const errors = checkPlainSmoke({
      esm: { ...side, cn: 'a false b' },
      cjs: { ...side, names: [...side.names, 'Extra'] },
    });
    expect(errors.join('\n')).toMatch(/cn/);
    expect(errors.join('\n')).toMatch(/Extra/);
  });

  it('reports a subpath that does not resolve and aliases that resolve apart', () => {
    const errors = checkPlainSmoke({
      ...good,
      esm: {
        ...side,
        resolved: { ...resolved, './tailwind': null, './styles.css': '/elsewhere/styles.css' },
      },
    });
    expect(errors.join('\n')).toMatch(/\.\/tailwind does not resolve/);
    expect(errors.join('\n')).toMatch(/\.\/styles and \.\/styles\.css/);
  });
});

describe('checkTypeProgram (repo-level#5)', () => {
  it('passes when the ESM file got index.d.ts and the CommonJS file index.d.cts', () => {
    expect(
      checkTypeProgram({
        status: 0,
        output:
          '/f/node_modules/@mortenbrudvik/waveui/dist/index.d.ts\n/f/node_modules/@mortenbrudvik/waveui/dist/index.d.cts\n',
      }),
    ).toEqual([]);
  });

  it('reports type errors such as TS1479 (ESM-typed declarations for require)', () => {
    const errors = checkTypeProgram({
      status: 2,
      output:
        "types-cjs.cts(1,26): error TS1479: The current file is a CommonJS module whose imports will produce 'require' calls\n",
    });
    expect(errors.join('\n')).toMatch(/TS1479/);
  });

  it('reports a program that never loaded the CommonJS declaration', () => {
    expect(
      checkTypeProgram({
        status: 0,
        output: '/f/node_modules/@mortenbrudvik/waveui/dist/index.d.ts\n',
      }),
    ).toEqual([expect.stringContaining('index.d.cts')]);
  });

  it("counts only this package's declarations, not another dependency's dist/index.d.*", () => {
    expect(
      checkTypeProgram({
        status: 0,
        output: [
          '/f/node_modules/other-lib/dist/index.d.ts',
          '/f/node_modules/@mortenbrudvik/waveui-extra/dist/index.d.cts',
          '/f/node_modules/@scope/lib/node_modules/@mortenbrudvik/waveuix/dist/index.d.cts',
        ].join('\n'),
      }),
    ).toEqual([
      expect.stringMatching(/ES module consumer did not load .*dist\/index\.d\.ts/),
      expect.stringMatching(/CommonJS consumer did not load .*dist\/index\.d\.cts/),
    ]);
  });

  it('reads Windows paths from tsc --listFiles', () => {
    expect(
      checkTypeProgram({
        status: 0,
        output:
          'C:\\w\\plain\\node_modules\\@mortenbrudvik\\waveui\\dist\\index.d.ts\r\n' +
          'C:\\w\\plain\\node_modules\\@mortenbrudvik\\waveui\\dist\\index.d.cts\r\n',
      }),
    ).toEqual([]);
  });
});

describe('fixtureManifest', () => {
  it('adds the tarball and pins the fixture dependencies to the installed versions', () => {
    const manifest = fixtureManifest(
      {
        name: 'fixture',
        private: true,
        type: 'module',
        smokeDependencies: ['react', 'tailwindcss'],
      },
      'C:\\tmp\\pack\\mortenbrudvik-waveui-0.5.0.tgz',
      (name) => ({ react: '19.2.4', tailwindcss: '4.2.2' })[name],
    );
    expect(manifest).toEqual({
      name: 'fixture',
      private: true,
      type: 'module',
      dependencies: {
        '@mortenbrudvik/waveui': 'file:C:/tmp/pack/mortenbrudvik-waveui-0.5.0.tgz',
        react: '19.2.4',
        tailwindcss: '4.2.2',
      },
    });
  });

  it('fails for a dependency that is not installed in the repository', () => {
    expect(() =>
      fixtureManifest({ smokeDependencies: ['nope'] }, '/tmp/x.tgz', () => undefined),
    ).toThrow(/nope/);
  });
});

describe('parseArgs', () => {
  it('defaults to both fixtures and cleans up', () => {
    expect(parseArgs([])).toEqual({ fixtures: ['plain', 'tailwind'], keep: false });
  });

  it('selects fixtures and keeps the work directory on request', () => {
    expect(parseArgs(['--fixture', 'tailwind', '--keep'])).toEqual({
      fixtures: ['tailwind'],
      keep: true,
    });
    expect(() => parseArgs(['--fixture', 'other'])).toThrow(/other/);
  });
});
