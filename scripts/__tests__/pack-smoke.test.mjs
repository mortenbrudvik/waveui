// @vitest-environment node
/**
 * The package manifest (spec §3.2; repo-level#1, #3, #5) and the assertions of
 * `scripts/pack-smoke.mjs` (`npm run test:pack`). The smoke run itself packs the tarball and
 * installs it into the fixtures of `scripts/fixtures/` — too slow and network-bound for the unit
 * suite; `npm run test:pack` is part of `prepublishOnly` and of the final gate. Here every
 * assertion function is exercised on inputs that reproduce the defects it guards against.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_DIRECTION_CLASS,
  APP_TOKEN_OVERRIDE,
  checkFloorSmoke,
  checkPackedFiles,
  checkPlainCss,
  checkPlainSmoke,
  checkTailwindCss,
  checkTypeProgram,
  checkUtilitiesCss,
  checkViteCss,
  EXPORTED_SUBPATHS,
  fixtureManifest,
  pack,
  parseArgs,
  parsePackOutput,
  resolveFloorNode,
  viteBuildCss,
} from '../pack-smoke.mjs';
import { createWorkDir, removeWorkDir } from '../verify-dist.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

describe('package.json (spec §3.2)', () => {
  it('exports the ES module and its declarations to every condition (repo-level#5, spec R4)', () => {
    // ES modules only: `require()` loads the same entry on Node.js 22.12 and later.
    expect(pkg.exports['.']).toEqual({ types: './dist/index.d.ts', default: './dist/index.mjs' });
    // `types` must come first.
    expect(Object.keys(pkg.exports['.'])[0]).toBe('types');
    expect(pkg.main).toBe('./dist/index.mjs');
    expect(pkg).not.toHaveProperty('module');
    // Kept for `moduleResolution: node10`, which ignores `exports`.
    expect(pkg.types).toBe('./dist/index.d.ts');
  });

  it('maps the style entries to the precompiled CSS and the Tailwind sources (repo-level#1)', () => {
    const { '.': _main, ...styles } = pkg.exports;
    expect(styles).toEqual({
      './styles': './dist/styles.css',
      './styles.css': './dist/styles.css',
      './preflight.css': './dist/preflight.css',
      './utilities': './dist/utilities.css',
      './utilities.css': './dist/utilities.css',
      './tailwind': './src/styles/tailwind.css',
      './tailwind.css': './src/styles/tailwind.css',
      './tokens': './src/styles/tokens.css',
      './tokens.css': './src/styles/tokens.css',
      './variants': './src/styles/variants.css',
      './variants.css': './src/styles/variants.css',
      './package.json': './package.json',
    });
    expect(Object.keys(pkg.exports)).toEqual(['.', ...EXPORTED_SUBPATHS]);
  });

  it('has no ./legacy-tokens.css entry and ships neither removed stylesheet (removed in 1.0)', () => {
    // An import of the 0.4 compatibility layer fails to resolve (ERR_PACKAGE_PATH_NOT_EXPORTED,
    // or the bundler's equivalent) instead of loading a file; animations.css was never exported.
    expect(pkg.exports).not.toHaveProperty(['./legacy-tokens.css']);
    expect(EXPORTED_SUBPATHS).not.toContain('./legacy-tokens.css');
    for (const name of ['legacy-tokens.css', 'animations.css']) {
      expect(existsSync(join(root, 'src/styles', name)), name).toBe(false);
    }
  });

  it('exports the wave-rtl variant for custom Tailwind setups built on ./tokens', () => {
    // A custom setup imports ./tokens and ./variants for the app's own classes (the components
    // come from ./styles): without the variant, Tailwind silently drops every `wave-rtl:` class.
    expect(pkg.exports['./variants']).toBe('./src/styles/variants.css');
    expect(pkg.exports['./variants.css']).toBe('./src/styles/variants.css');
    expect(readFileSync(join(root, 'src/styles/variants.css'), 'utf8')).toMatch(
      /@custom-variant wave-rtl\b/,
    );
  });

  it('exports the token utilities, and keeps the precompiled utilities of ./tailwind internal (Phase 14 spec R6)', () => {
    expect(pkg.exports['./utilities']).toBe('./dist/utilities.css');
    expect(pkg.exports['./utilities.css']).toBe('./dist/utilities.css');
    // dist/components.css is imported by ./tailwind only, through its relative path.
    const targets = (value) =>
      typeof value === 'string' ? [value] : Object.values(value).flatMap(targets);
    expect(targets(pkg.exports)).not.toContain('./dist/components.css');
    expect(readFileSync(join(root, 'src/styles/tailwind.css'), 'utf8')).toMatch(
      /@import '\.\.\/\.\.\/dist\/components\.css' layer\(components\);/,
    );
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

  it('checks the types of a tarball it packs itself', () => {
    // `attw --pack` would run a nested `npm pack`, which writes nothing under
    // `npm publish --dry-run`; scripts/attw-pack.mjs packs without the dry run. The `esm-only`
    // profile: `node16` and `strict` fail an ES-only package by design (spec R4).
    expect(pkg.scripts['check:package']).toBe(
      'publint && node scripts/attw-pack.mjs --profile esm-only --exclude-entrypoints styles ' +
        'styles.css preflight.css utilities utilities.css tailwind tailwind.css tokens tokens.css ' +
        'variants variants.css',
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
    const targets = (value) =>
      typeof value === 'string' ? [value] : Object.values(value).flatMap(targets);
    for (const target of targets(pkg.exports)) {
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
    'dist/index.d.ts',
    'dist/styles.css',
    'dist/components.css',
    'dist/utilities.css',
    'dist/preflight.css',
    'dist/lib/cn.mjs',
    'dist/components/button/Button.mjs',
    'src/styles/tailwind.css',
    'src/styles/tokens.css',
    'src/styles/base.css',
    'src/styles/variants.css',
    'src/styles/styles.css',
  ];

  it('passes a tarball with every export target and nothing else from the sources', () => {
    expect(checkPackedFiles(good, pkg)).toEqual([]);
  });

  it('reports an export target missing from the tarball', () => {
    const errors = checkPackedFiles(
      good.filter((path) => path !== 'dist/index.d.ts' && path !== 'dist/styles.css'),
      pkg,
    );
    expect(errors).toEqual([
      expect.stringContaining('./dist/index.d.ts'),
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
    // variants.css defines the wave-rtl variant: an export target that tailwind.css imports.
    expect(
      checkPackedFiles(
        good.filter((path) => path !== 'src/styles/variants.css'),
        pkg,
      ),
    ).toEqual([
      'export target ./src/styles/variants.css is not in the tarball',
      'src/styles/tailwind.css @imports src/styles/variants.css, which is not in the tarball',
    ]);
  });

  it('reports a tarball without the precompiled utilities ./tailwind imports, without reading dist', () => {
    // dist/components.css is no export target: only the import of tailwind.css requires it. The
    // check reads the style sources only (dist is not built when the unit tests run).
    const read = vi.fn((path) => readFileSync(join(root, path), 'utf8'));
    expect(
      checkPackedFiles(
        good.filter((path) => path !== 'dist/components.css'),
        pkg,
        read,
      ),
    ).toEqual([
      'src/styles/tailwind.css @imports dist/components.css, which is not in the tarball',
    ]);
    expect(checkPackedFiles(good, pkg, read)).toEqual([]);
    expect(
      read.mock.calls.map(([path]) => path).filter((path) => !path.startsWith('src/styles/')),
    ).toEqual([]);
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
    '.focus-visible\\:outline-ring{outline-color:var(--wave-ring)}.focus-visible\\:-outline-offset-2{outline-offset:-2px}' +
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

describe('checkTailwindCss (repo-level#1; Phase 14 spec R6)', () => {
  /** A rule of Wave's direction variant for `name`, unminified as the fixture compiles it. */
  const directional = (name, declaration) =>
    String.raw`.${name.replace(':', '\\:')}{
      @supports selector(:nth-child(n of :dir(rtl))){&:where(:nth-child(n of :dir(rtl))){${declaration}}}
      @supports not selector(:nth-child(n of :dir(rtl))){&:where([dir="rtl"], [dir="rtl"] *){${declaration}}}}`;
  const COMPONENT_RULES =
    '.bg-primary{background-color:var(--wave-primary)}.text-body-1{font-size:14px}' +
    '.focus-visible\\:outline-ring:focus-visible{outline-color:var(--wave-ring)}' +
    '.focus-visible\\:-outline-offset-2:focus-visible{outline-offset:-2px}';
  const MOTION_RULES =
    '.duration-wave-normal{--tw-duration:var(--wave-duration-normal);transition-duration:var(--wave-duration-normal)}' +
    '.ease-wave-decelerate-mid{--tw-ease:var(--wave-curve-decelerate-mid);transition-timing-function:var(--wave-curve-decelerate-mid)}';
  const APP_RULES =
    '.p-4{padding:1rem}.bg-wave-primary{background-color:var(--wave-primary)}' +
    '.text-wave-body-1{font-size:14px}.border-wave-border{border-color:var(--wave-border)}' +
    '.shadow-wave-4{box-shadow:var(--wave-shadow-4)}.font-wave{font-family:var(--wave-font-family)}' +
    MOTION_RULES +
    directional(APP_DIRECTION_CLASS, 'rotate:180deg');
  const THEME =
    '@layer theme{:root,:host{--color-red-500:red}:root,.wave-light{--wave-primary:#0f6cbd}}';
  const BASE =
    '@layer base{*{box-sizing:border-box}.wave-root,.wave-portal{font-family:var(--wave-font-family)}}';
  const OVERRIDE = `@layer base{:root,.wave-light{--wave-primary:${APP_TOKEN_OVERRIDE}}}`;
  /** A `./tailwind` build: the corrected form of the spike (spec §6, Task 1). */
  const good =
    '@layer theme,base,components,utilities;' +
    THEME +
    BASE +
    `@layer components{${COMPONENT_RULES}}` +
    OVERRIDE +
    `@layer utilities{${APP_RULES}}`;
  const check = (css, options = {}) =>
    checkTailwindCss(css, { tokenOverride: APP_TOKEN_OVERRIDE, ...options });

  it('passes tokens in theme, the base and the override in base, the precompiled component classes in components, and the app classes', () => {
    expect(check(good)).toEqual([]);
  });

  it("reports a component class generated into @layer utilities (Tailwind scanned the package's dist)", () => {
    const scanned = good.replace(
      '@layer utilities{',
      '@layer utilities{.focus-visible\\:-outline-offset-2:focus-visible{outline-offset:-2px}',
    );
    expect(check(scanned)).toEqual([
      'the component class .focus-visible:-outline-offset-2 was generated into @layer utilities: ' +
        "Tailwind scanned the package's dist (./tailwind has no @source)",
    ]);
  });

  it('reports a component class that is missing or outside @layer components', () => {
    expect(check(good.replace('.bg-primary{background-color:var(--wave-primary)}', ''))).toEqual([
      'the component class .bg-primary is missing (does @mortenbrudvik/waveui/tailwind import dist/components.css?)',
    ]);
    const unlayered = good.replace(`@layer components{${COMPONENT_RULES}}`, COMPONENT_RULES);
    expect(check(unlayered)).toEqual(
      [
        'bg-primary',
        'text-body-1',
        'focus-visible:outline-ring',
        'focus-visible:-outline-offset-2',
      ].map(
        (name) =>
          `the component class .${name} must sit in @layer components, found in <unlayered>`,
      ),
    );
  });

  it('reports layers declared in another order (the app utilities would not win)', () => {
    const css = good.replace(
      '@layer theme,base,components,utilities;',
      '@layer theme,base,utilities,components;',
    );
    expect(check(css)).toEqual([
      'the layers must come in the order theme, base, components, utilities (found theme, base, utilities, components)',
    ]);
  });

  it("reports the app's token override when it is missing or outside @layer base", () => {
    expect(check(good.replace(OVERRIDE, ''))).toEqual([
      "missing the app's token override (--wave-primary: #c4314b)",
    ]);
    expect(check(good.replace(OVERRIDE, `:root{--wave-primary:${APP_TOKEN_OVERRIDE}}`))).toEqual([
      "the app's token override must sit in @layer base, found in <unlayered>",
    ]);
    // Without an expected override, an override counts as a Wave token outside the theme layer.
    expect(checkTailwindCss(good)).toEqual([
      'Wave tokens (--wave-primary) must sit in @layer theme, found in theme, base',
    ]);
  });

  it('reports Wave base rules and tokens outside their layers', () => {
    const base = good
      .replace('.wave-root,.wave-portal{font-family:var(--wave-font-family)}', '')
      .concat('.wave-root,.wave-portal{font-family:var(--wave-font-family)}');
    expect(check(base)).toEqual([
      'Wave base rules (.wave-root) must sit in @layer base, found in <unlayered>',
    ]);
    const tokens =
      good.replace(':root,.wave-light{--wave-primary:#0f6cbd}', '') +
      ':root,.wave-light{--wave-primary:#0f6cbd}';
    expect(check(tokens)).toEqual([
      'Wave tokens (--wave-primary) must sit in @layer theme, found in <unlayered>',
    ]);
  });

  it("reports a missing consumer utility (the fixture's own sources were not scanned)", () => {
    expect(check(good.replace('.p-4{padding:1rem}', ''))).toEqual([
      "the consumer utility .p-4 was not generated (the fixture's own sources were not scanned)",
    ]);
  });

  it('reports namespaced token utilities and motion utilities the Wave theme did not generate', () => {
    const withoutTokens = good
      .replace('.bg-wave-primary{background-color:var(--wave-primary)}', '')
      .replace('.shadow-wave-4{box-shadow:var(--wave-shadow-4)}', '');
    expect(check(withoutTokens)).toEqual([
      'the namespaced token utilities .bg-wave-primary, .shadow-wave-4 were not generated (the ' +
        'namespaced theme keys of @mortenbrudvik/waveui/tokens are missing)',
    ]);
    const withoutMotion = good
      .replace(/\.duration-wave-normal\{[^}]*\}/, '')
      .replace(/\.ease-wave-decelerate-mid\{[^}]*\}/, '');
    expect(check(withoutMotion)).toEqual([
      "the motion utilities .duration-wave-normal, .ease-wave-decelerate-mid were not generated (the Wave theme's --transition-duration-wave-* and --ease-wave-* mappings are missing)",
    ]);
    expect(check(good.replace(/\.ease-wave-decelerate-mid\{[^}]*\}/, ''))).toEqual([
      "the motion utilities .ease-wave-decelerate-mid were not generated (the Wave theme's --transition-duration-wave-* and --ease-wave-* mappings are missing)",
    ]);
  });

  describe('the wave-rtl classes (C-LOGICAL)', () => {
    const directionClasses = ['wave-rtl:-scale-x-100'];
    const compiled = `@layer components{${directional('wave-rtl:-scale-x-100', 'scale:-1 1')}}`;

    it("passes the dist's classes compiled with the variant in dist/components.css", () => {
      expect(check(good + compiled, { directionClasses })).toEqual([]);
    });

    it('reports a dist class that was not compiled with the variant', () => {
      expect(check(good, { directionClasses })).toEqual([
        "the dist classes wave-rtl:-scale-x-100 were not compiled with Wave's wave-rtl variant " +
          '(is dist/components.css compiled with src/styles/variants.css?)',
      ]);
    });

    it("reports the app's own class that was not compiled (the entry does not define wave-rtl)", () => {
      const css = good.replace(directional(APP_DIRECTION_CLASS, 'rotate:180deg'), '');
      expect(check(css)).toEqual([
        "the app's class wave-rtl:rotate-180 was not compiled with Wave's wave-rtl variant " +
          '(does @mortenbrudvik/waveui/tailwind import variants.css?)',
      ]);
    });
  });

  describe('the custom setup on ./tokens and ./variants.css (setup: "tokens")', () => {
    /** The app's classes on Wave's theme keys; no component class, no Wave base. */
    const tokens =
      '@layer theme,base,components,utilities;' + THEME + `@layer utilities{${APP_RULES}}`;

    it("passes tokens in theme and the app's classes, without a component class", () => {
      expect(checkTailwindCss(tokens, { setup: 'tokens' })).toEqual([]);
      // The dist's direction classes are not the setup's: the components come from ./styles.
      expect(
        checkTailwindCss(tokens, { setup: 'tokens', directionClasses: ['wave-rtl:-scale-x-100'] }),
      ).toEqual([]);
    });

    it('reports component classes (the setup compiled the components or ./tokens holds unnamespaced keys)', () => {
      const css = tokens.replace('@layer utilities{', '@layer utilities{.bg-primary{color:red}');
      expect(checkTailwindCss(css, { setup: 'tokens' })).toEqual([
        'the component classes .bg-primary are in the custom setup (its components come from ' +
          "./styles: ./tokens must hold no unnamespaced theme key, and the setup must not scan the package's dist)",
      ]);
    });

    it("reports the app's wave-rtl class that was not compiled (./variants.css not imported)", () => {
      const css = tokens.replace(directional(APP_DIRECTION_CLASS, 'rotate:180deg'), '');
      expect(checkTailwindCss(css, { setup: 'tokens' })).toEqual([
        "the app's class wave-rtl:rotate-180 was not compiled with Wave's wave-rtl variant " +
          '(does the setup import @mortenbrudvik/waveui/variants.css?)',
      ]);
    });

    it('still reports Wave tokens outside @layer theme', () => {
      const css =
        tokens.replace(':root,.wave-light{--wave-primary:#0f6cbd}', '') +
        ':root,.wave-light{--wave-primary:#0f6cbd}';
      expect(checkTailwindCss(css, { setup: 'tokens' })).toEqual([
        'Wave tokens (--wave-primary) must sit in @layer theme, found in <unlayered>',
      ]);
    });
  });

  it('rejects an unknown setup instead of checking it as the tokens setup', () => {
    expect(() => checkTailwindCss(good, { setup: 'custom' })).toThrow(
      new TypeError(`checkTailwindCss: unknown setup "custom" (expected 'tailwind' or 'tokens')`),
    );
  });
});

describe('checkUtilitiesCss (Phase 14 spec R6)', () => {
  const SAMPLE = [
    'bg-wave-primary',
    'text-wave-foreground',
    'border-wave-border',
    'ring-wave-ring',
    'fill-wave-palette-red',
    'stroke-wave-brand-80',
    'text-wave-body-1',
    'shadow-wave-4',
    'font-wave',
    'font-wave-mono',
    'animate-wave-spin',
  ];
  const good =
    '@layer properties{@supports ((-webkit-hyphens:none)){*,:before,:after{--tw-ring-color:initial}}}' +
    `@layer utilities{${SAMPLE.map((name) => `.${name}{color:var(--wave-primary)}`).join('')}}` +
    '@property --tw-ring-color{syntax:"*";inherits:false}' +
    '@keyframes wave-spin{to{transform:rotate(360deg)}}';

  it('passes the namespaced token utilities in @layer utilities, with the keyframes', () => {
    expect(checkUtilitiesCss(good)).toEqual([]);
  });

  it('reports a missing utility, a rule outside the layer and another class', () => {
    expect(
      checkUtilitiesCss(good.replace('.ring-wave-ring{color:var(--wave-primary)}', '')),
    ).toEqual(['missing the token utilities .ring-wave-ring']);
    expect(checkUtilitiesCss(`${good}.bg-wave-primary{color:red}`)).toEqual([
      'rules outside @layer utilities: .bg-wave-primary',
    ]);
    const other = good.replace(
      '@layer utilities{',
      String.raw`@layer utilities{.bg-primary{color:red}.hover\:bg-wave-primary:hover{color:red}`,
    );
    expect(checkUtilitiesCss(other)).toEqual([
      'holds classes other than the namespaced token utilities: bg-primary hover:bg-wave-primary',
    ]);
  });

  it('reports tokens, raw Tailwind source and missing keyframes', () => {
    expect(checkUtilitiesCss(`:root{--wave-primary:#0f6cbd}${good}`)).toEqual([
      'rules outside @layer utilities: :root',
      'declares Wave tokens (they come from ./styles)',
    ]);
    expect(checkUtilitiesCss(`@import 'tailwindcss';${good}`)).toEqual([
      `raw Tailwind source, not compiled CSS: "@import 'tailwindcss'"`,
    ]);
    expect(checkUtilitiesCss(good.replace('@keyframes wave-spin', '@keyframes spin'))).toEqual([
      'missing @keyframes wave-spin',
    ]);
  });
});

describe('the Tailwind fixture', () => {
  const fixture = join(root, 'scripts/fixtures/tailwind');

  it('compiles the documented ./tailwind entry and an app token override in its base layer', () => {
    const css = readFileSync(join(fixture, 'input.css'), 'utf8');
    expect(css).toMatch(/@import 'tailwindcss';\s*@import '@mortenbrudvik\/waveui\/tailwind';/);
    expect(css).toMatch(
      new RegExp(
        String.raw`@layer base \{\s*:root,\s*\.wave-light \{\s*--wave-primary: ${APP_TOKEN_OVERRIDE};\s*\}\s*\}`,
      ),
    );
    expect(css).not.toMatch(/@source/);
  });

  it('compiles the custom setup on ./tokens with ./variants.css and no @source of the package', () => {
    const css = readFileSync(join(fixture, 'tokens-input.css'), 'utf8');
    expect(css).toMatch(/@import 'tailwindcss';/);
    expect(css).toMatch(/@import '@mortenbrudvik\/waveui\/tokens' layer\(theme\);/);
    expect(css).toMatch(/@import '@mortenbrudvik\/waveui\/variants\.css';/);
    expect(css).not.toMatch(/@source/);
    expect(css).not.toMatch(/waveui\/tailwind/);
  });

  it("uses Wave's namespaced token, motion and direction utilities in its own source", () => {
    const html = readFileSync(join(fixture, 'src/app.html'), 'utf8');
    expect(html).toMatch(
      /<main class="[^"]*\bduration-wave-normal ease-wave-decelerate-mid\b[^"]*">/,
    );
    expect(html).toMatch(
      /<p\s+class="bg-wave-primary text-wave-body-1 border-wave-border shadow-wave-4 font-wave wave-rtl:rotate-180"\s*>/,
    );
  });
});

describe('the plain fixture', () => {
  it('has a Vite entry that imports the precompiled stylesheet as documented', () => {
    const entry = readFileSync(join(root, 'scripts/fixtures/plain/vite-entry.js'), 'utf8');
    expect(entry).toMatch(/^import '@mortenbrudvik\/waveui\/styles';$/m);
  });

  it('has a Vite entry that imports the token utilities', () => {
    const entry = readFileSync(join(root, 'scripts/fixtures/plain/utilities-entry.js'), 'utf8');
    expect(entry).toMatch(/^import '@mortenbrudvik\/waveui\/utilities\.css';$/m);
  });
});

describe('checkViteCss (an app built with the Vite defaults; C-LOGICAL)', () => {
  const directionClasses = ['wave-rtl:-scale-x-100', 'wave-rtl:-translate-x-[22px]'];
  const native = String.raw`@supports selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where(:nth-child(n of :dir(rtl))){scale:-1 1}.wave-rtl\:-translate-x-\[22px\]:where(:nth-child(n of :dir(rtl))){--tw-translate-x:-22px}}`;
  const fallback = String.raw`@supports not selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where([dir=rtl],[dir=rtl] *){scale:-1 1}.wave-rtl\:-translate-x-\[22px\]:where([dir=rtl],[dir=rtl] *){--tw-translate-x:-22px}}`;
  /**
   * What an app's Vite 8 build emitted for the 0.5 variant (`:where(:dir(rtl))`): Lightning CSS
   * rewrote `:dir(rtl)` to a `:lang()` list for Vite's default CSS target (list shortened).
   */
  const lowered =
    String.raw`@supports selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where(:is(:lang(ae),:lang(ar),:lang(he),:lang(yi))){scale:-1 1}.wave-rtl\:-translate-x-\[22px\]:where(:is(:lang(ae),:lang(ar),:lang(he),:lang(yi))){--tw-translate-x:-22px}}` +
    String.raw`@supports not selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where([dir=rtl],[dir=rtl] *){scale:-1 1}.wave-rtl\:-translate-x-\[22px\]:where([dir=rtl],[dir=rtl] *){--tw-translate-x:-22px}}`;

  it('passes when each class keeps the variant', () => {
    expect(checkViteCss(native + fallback, { directionClasses })).toEqual([]);
  });

  it('reports the classes whose :dir(rtl) the CSS minifier rewrote to :lang()', () => {
    expect(checkViteCss(lowered, { directionClasses })).toEqual([
      "the CSS minifier rewrote :dir(rtl) of Wave's wave-rtl variant to :lang(), so these " +
        'classes never match a page that sets dir without a right-to-left lang: ' +
        'wave-rtl:-scale-x-100 wave-rtl:-translate-x-[22px]',
    ]);
  });

  it('reports the classes the build emitted without the variant', () => {
    expect(
      checkViteCss(native.replace('.wave-rtl\\:-scale-x-100', '.x'), { directionClasses }),
    ).toEqual([
      "the classes wave-rtl:-scale-x-100 wave-rtl:-translate-x-[22px] lost Wave's wave-rtl " +
        'variant (:where(:nth-child(n of :dir(rtl))) under @supports selector(:nth-child(n of ' +
        ':dir(rtl))) and the [dir=rtl] fallback)',
    ]);
  });
});

describe('viteBuildCss (consumer builds with the Vite defaults; C-LOGICAL)', () => {
  // Under the repository's node_modules/.cache, so `tailwindcss` resolves as it does here;
  // removed with its parent once no other run uses the parent (no empty directory is left).
  const run = createWorkDir(join(root, 'node_modules', '.cache', 'wave-pack-smoke-test'), 'run-');
  afterAll(() => removeWorkDir(run));
  const variants = join(root, 'src', 'styles', 'variants.css');
  const directionClasses = ['wave-rtl:-scale-x-100', 'wave-rtl:-translate-x-[22px]'];

  /** A project directory with the given files; `variants` is the path of variants.css from it. */
  function project(files) {
    const dir = mkdtempSync(join(run.work, 'p-'));
    const from = relative(dir, variants).split('\\').join('/');
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(dir, path), content.replace('<variants>', from));
    }
    return dir;
  }

  it('keeps the ./tailwind variant on the element direction through Vite and Lightning CSS', async () => {
    const dir = project({
      'app.css':
        "@import 'tailwindcss';\n@import '<variants>';\n" +
        `@source inline('${directionClasses.join(' ')}');\n` +
        // A plain `:dir()` rule, which the build rewrites: the defaults lower `:dir()`.
        '.probe:dir(rtl) { color: red; }\n',
    });
    const css = await viteBuildCss(dir, 'app.css', { tailwind: true });
    expect(css).toMatch(/\.probe:is\(:lang\(ae\),:lang\(ar\)/);
    expect(checkViteCss(css, { directionClasses })).toEqual([]);
  }, 60_000);

  it('keeps the variant of the precompiled ./styles through an app build', async () => {
    // Compiled the way scripts/build-css.mjs compiles dist/styles.css: the Tailwind CLI, minified.
    const dir = project({
      'input.css':
        "@import 'tailwindcss/theme.css' theme(inline);\n@import '<variants>';\n" +
        "@import 'tailwindcss/utilities.css' source(none);\n" +
        `@source inline('${directionClasses.join(' ')}');\n`,
      'entry.js': "import './styles.css';\n",
    });
    const cli = createRequire(import.meta.url).resolve('@tailwindcss/cli/package.json');
    const { bin } = JSON.parse(readFileSync(cli, 'utf8'));
    const compiled = spawnSync(
      process.execPath,
      [
        join(dirname(cli), typeof bin === 'string' ? bin : bin.tailwindcss),
        '--input',
        'input.css',
        '--output',
        'styles.css',
        '--minify',
      ],
      { cwd: dir, encoding: 'utf8' },
    );
    expect(compiled.status, compiled.stderr).toBe(0);
    const css = await viteBuildCss(dir, 'entry.js');
    expect(checkViteCss(css, { directionClasses })).toEqual([]);
  }, 60_000);
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

  it('passes when import() and require() load the same names and every subpath resolves', () => {
    expect(checkPlainSmoke(good)).toEqual([]);
  });

  it('reports a way in that fails to load or lacks names', () => {
    const errors = checkPlainSmoke({
      cjs: { error: 'require() cannot be used on an ESM graph with top-level await', resolved },
      esm: { ...side, names: ['cn'] },
    });
    expect(errors.join('\n')).toMatch(/require failed: require\(\) cannot be used/);
    expect(errors.join('\n')).toMatch(/Button/);
  });

  it('reports a wrong cn result and names that differ between import() and require()', () => {
    const errors = checkPlainSmoke({
      esm: { ...side, cn: 'a false b' },
      cjs: { ...side, names: [...side.names, 'Extra'] },
    });
    expect(errors.join('\n')).toMatch(/cn/);
    expect(errors).toContain('only require() exposes Extra');
  });

  it('reports a name only import() exposes', () => {
    const errors = checkPlainSmoke({
      esm: { ...side, names: [...side.names, 'Extra'] },
      cjs: side,
    });
    expect(errors).toEqual(['only import() exposes Extra (require() lacks them)']);
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

  it('reports ./variants and ./variants.css resolving to different files', () => {
    const errors = checkPlainSmoke({
      ...good,
      cjs: { ...side, resolved: { ...resolved, './variants.css': '/elsewhere/variants.css' } },
    });
    expect(errors).toEqual(['require: ./variants and ./variants.css resolve to different files']);
  });
});

describe('the Node floor step (spec R4)', () => {
  const resolved = Object.fromEntries(
    EXPORTED_SUBPATHS.map((subpath) => [subpath, `/app/${subpath.replace(/\.css$/, '')}`]),
  );
  const side = { names: ['Button', 'WaveProvider', 'cn'], cn: 'a b', resolved };

  it('passes when require() on Node 22.12 exposes the names import() does', () => {
    expect(checkFloorSmoke({ esm: side, floor: side })).toEqual([]);
  });

  it('reports a require() that fails on the floor, such as a top-level await', () => {
    const errors = checkFloorSmoke({
      esm: side,
      floor: { error: 'require() cannot be used on an ESM graph with top-level await', resolved },
    });
    expect(errors).toEqual([
      'require (Node 22.12) failed: require() cannot be used on an ESM graph with top-level await',
    ]);
  });

  it('reports names that differ from import()', () => {
    const errors = checkFloorSmoke({ esm: side, floor: { ...side, names: ['cn'] } });
    expect(errors).toEqual([
      'require (Node 22.12) lacks Button, WaveProvider',
      'only import() exposes Button, WaveProvider (require() on Node 22.12 lacks them)',
    ]);
  });

  it('skips the step, with the reason, unless WAVE_NODE_FLOOR is a Node.js 22.12 binary', () => {
    const versionOf = (path) => ({ '/n/22.12': 'v22.12.0\n', '/n/24': 'v24.15.0\n' })[path];
    expect(resolveFloorNode({}, versionOf)).toEqual({
      skip: 'WAVE_NODE_FLOOR is not set (the path of a Node.js 22.12 binary)',
    });
    expect(resolveFloorNode({ WAVE_NODE_FLOOR: '/n/missing' }, versionOf)).toEqual({
      skip: 'WAVE_NODE_FLOOR (/n/missing) could not be run',
    });
    expect(resolveFloorNode({ WAVE_NODE_FLOOR: '/n/24' }, versionOf)).toEqual({
      skip: 'WAVE_NODE_FLOOR (/n/24) is v24.15.0, not Node.js 22.12',
    });
    expect(resolveFloorNode({ WAVE_NODE_FLOOR: '/n/22.12' }, versionOf)).toEqual({
      path: '/n/22.12',
    });
  });

  it('runs no binary when the variable is not set', () => {
    const versionOf = vi.fn();
    resolveFloorNode({}, versionOf);
    expect(versionOf).not.toHaveBeenCalled();
  });
});

describe('the plain fixture type programs (spec R4)', () => {
  const fixture = join(root, 'scripts/fixtures/plain');
  const read = (name) => JSON.parse(readFileSync(join(fixture, name), 'utf8'));

  it('checks the .mts file under module node16', () => {
    expect(read('tsconfig.json').files).toEqual(['types-esm.mts']);
    expect(read('tsconfig.json').compilerOptions.module).toBe('node16');
  });

  it('checks the .cts file under module node20 (node16 reports TS1479 for a require of an ES module)', () => {
    expect(read('tsconfig.cjs.json').files).toEqual(['types-cjs.cts']);
    expect(read('tsconfig.cjs.json').compilerOptions.module).toBe('node20');
  });

  it('keeps smoke.cjs as the require(esm) consumer', () => {
    const smoke = readFileSync(join(fixture, 'smoke.cjs'), 'utf8');
    expect(smoke).toMatch(/require\(name\)/);
    expect(smoke).toMatch(/require\(esm\)/);
  });
});

describe('checkTypeProgram (repo-level#5)', () => {
  it('passes when the program loaded index.d.ts', () => {
    expect(
      checkTypeProgram({
        status: 0,
        output: '/f/node_modules/@mortenbrudvik/waveui/dist/index.d.ts\n',
      }),
    ).toEqual([]);
  });

  it('reports type errors such as TS1479 (a CommonJS file that cannot require the ES entry)', () => {
    const errors = checkTypeProgram({
      status: 2,
      output:
        "types-cjs.cts(1,26): error TS1479: The current file is a CommonJS module whose imports will produce 'require' calls\n",
    });
    expect(errors.join('\n')).toMatch(/TS1479/);
  });

  it('reports a program that never loaded the declarations', () => {
    expect(checkTypeProgram({ status: 0, output: '/f/types-esm.mts\n' })).toEqual([
      expect.stringContaining('index.d.ts'),
    ]);
  });

  it("counts only this package's declarations, not another dependency's dist/index.d.*", () => {
    expect(
      checkTypeProgram({
        status: 0,
        output: [
          '/f/node_modules/other-lib/dist/index.d.ts',
          '/f/node_modules/@mortenbrudvik/waveui-extra/dist/index.d.ts',
          '/f/node_modules/@scope/lib/node_modules/@mortenbrudvik/waveuix/dist/index.d.ts',
        ].join('\n'),
      }),
    ).toEqual([expect.stringMatching(/consumers did not load .*dist\/index\.d\.ts/)]);
  });

  it('reads Windows paths from tsc --listFiles', () => {
    expect(
      checkTypeProgram({
        status: 0,
        output: 'C:\\w\\plain\\node_modules\\@mortenbrudvik\\waveui\\dist\\index.d.ts\r\n',
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

describe('parsePackOutput', () => {
  const result = {
    id: '@mortenbrudvik/waveui@0.7.0',
    name: '@mortenbrudvik/waveui',
    filename: 'mortenbrudvik-waveui-0.7.0.tgz',
    files: [{ path: 'LICENSE' }, { path: 'package.json' }],
  };

  it('reads the array npm 10 and 11 print', () => {
    expect(parsePackOutput(`${JSON.stringify([result], null, 2)}\n`)).toEqual(result);
  });

  it('reads the object keyed by package name npm 12 prints', () => {
    // The first `[` of this output opens `files`, not the result.
    const stdout = `${JSON.stringify({ [result.name]: result }, null, 2)}\n`;
    expect(parsePackOutput(stdout)).toEqual(result);
  });

  it('skips lines printed before the JSON', () => {
    const stdout = `> @mortenbrudvik/waveui@0.7.0 prepack\n> echo {x} [y]\n\n${JSON.stringify([result])}\n`;
    expect(parsePackOutput(stdout)).toEqual(result);
  });

  it('fails on output without JSON or with other than one package', () => {
    expect(() => parsePackOutput('npm notice nothing\n')).toThrow(/printed no JSON/);
    expect(() => parsePackOutput('[]\n')).toThrow(/0 packages instead of 1/);
    expect(() => parsePackOutput(JSON.stringify({ a: result, b: result }))).toThrow(
      /2 packages instead of 1/,
    );
  });
});

describe('pack', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('writes the tarball under npm publish --dry-run', () => {
    // npm exports its CLI config to the prepublishOnly scripts: a nested `npm pack` that
    // inherits npm_config_dry_run prints a tarball name but writes no file.
    vi.stubEnv('npm_config_dry_run', 'true');
    const dir = mkdtempSync(join(tmpdir(), 'wave-pack-test-'));
    try {
      const { tarball, files } = pack(dir);
      expect(existsSync(tarball)).toBe(true);
      expect(files).toContain('package.json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
