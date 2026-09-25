// @vitest-environment node
/**
 * Storybook build configuration (spec §3.3; repo-level#1, #36): `.storybook/main.ts` registers
 * the a11y and docs addons and turns the library's Vite plugins into a Storybook app build
 * (Tailwind added, `vite:dts` removed, the export-docblock plugin placed after Storybook's docgen);
 * `.storybook/preview.css` compiles the library styles with the stories as an extra source;
 * `scripts/verify-storybook.mjs` asserts the emitted CSS.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { STORYBOOK_DOCGEN_PLUGIN } from '../../.storybook/exportDocblocks.ts';
import storybookMain from '../../.storybook/main.ts';
import viteConfig from '../../vite.config.ts';
import { createWorkDir, removeWorkDir } from '../verify-dist.mjs';
import {
  checkStorybookCss,
  expectedDirectionClasses,
  expectedStoryOnly,
  main,
  verifyStorybook,
} from '../verify-storybook.mjs';

/** A `wave-rtl:` class compiled with Wave's direction variant (src/styles/variants.css). */
const DIRECTION = String.raw`@supports selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where(:nth-child(n of :dir(rtl))){scale:-1 1}}@supports not selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where([dir=rtl],[dir=rtl] *){scale:-1 1}}`;

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

async function pluginNames(plugins) {
  const names = [];
  for (const plugin of await Promise.all([plugins].flat(Infinity))) {
    if (Array.isArray(plugin)) names.push(...(await pluginNames(plugin)));
    else if (plugin) names.push(plugin.name);
  }
  return names;
}

describe('.storybook/main.ts', () => {
  it('registers the a11y and docs addons (repo-level#24, repo-level#36)', () => {
    const addons = storybookMain.addons.map((addon) =>
      typeof addon === 'string' ? addon : addon.name,
    );
    expect(addons).toEqual(
      expect.arrayContaining(['@storybook/addon-a11y', '@storybook/addon-docs']),
    );
  });

  it('adds the Tailwind plugin and removes vite:dts from the library plugins', async () => {
    const config = await storybookMain.viteFinal({ plugins: [...viteConfig.plugins] }, {});
    const names = await pluginNames(config.plugins);
    expect(names).not.toContain('vite:dts');
    expect(names).toEqual(expect.arrayContaining(['@tailwindcss/vite:scan']));
    expect(names.some((name) => name.startsWith('vite:react'))).toBe(true);
  });

  it('removes vite:dts from nested arrays and promises and keeps every other plugin', async () => {
    const config = await storybookMain.viteFinal(
      {
        plugins: [
          { name: 'keep-a' },
          [{ name: 'vite:dts' }, { name: 'keep-b' }],
          null,
          false,
          Promise.resolve([{ name: 'vite:dts' }, { name: 'keep-c' }]),
        ],
      },
      {},
    );
    const names = await pluginNames(config.plugins);
    expect(names.filter((name) => !name.startsWith('@tailwindcss/'))).toEqual([
      'keep-a',
      'keep-b',
      'keep-c',
      'wave:export-docblocks',
    ]);
  });

  it("runs the export-docblock plugin right after Storybook's docgen plugin (C-DOCS)", async () => {
    const config = await storybookMain.viteFinal(
      { plugins: [{ name: 'first' }, { name: STORYBOOK_DOCGEN_PLUGIN }, { name: 'other' }] },
      {},
    );
    const names = await pluginNames(config.plugins);
    expect(names.slice(0, 4)).toEqual([
      'first',
      STORYBOOK_DOCGEN_PLUGIN,
      'wave:export-docblocks',
      'other',
    ]);
    expect(names.filter((name) => name === 'wave:export-docblocks')).toHaveLength(1);
  });

  it('adds the Tailwind plugin once', async () => {
    const once = await storybookMain.viteFinal({ plugins: [] }, {});
    const twice = await storybookMain.viteFinal({ plugins: once.plugins }, {});
    const names = await pluginNames(twice.plugins);
    expect(names.filter((name) => name === '@tailwindcss/vite:scan')).toHaveLength(1);
  });
});

describe('.storybook/preview.css (repo-level#1)', () => {
  const css = readFileSync(join(root, '.storybook', 'preview.css'), 'utf8');

  it('compiles the library stylesheet with the stories as an extra Tailwind source', () => {
    expect(css).toMatch(/@import\s+(['"])\.\.\/src\/styles\/styles\.css\1;/);
    expect(css).toMatch(/@source\s+(['"])\.\.\/stories\1;/);
  });

  it('adds no Preflight or other global styles (Storybook renders like a consumer)', () => {
    const imports = [...css.matchAll(/@import\s+(['"])([^'"]+)\1/g)].map((match) => match[2]);
    expect(imports).toEqual(['../src/styles/styles.css']);
  });
});

describe('checkStorybookCss', () => {
  const styled = '.flex{display:flex}.bg-primary{background-color:var(--wave-primary)}';

  it('passes CSS with the library utilities and every story-only utility', () => {
    expect(
      checkStorybookCss(`${styled}.m-6{margin:1.5rem}.w-7{width:1.75rem}`, ['m-6', 'w-7']),
    ).toEqual({ errors: [], storyOnly: ['m-6', 'w-7'] });
  });

  it('reports unstyled Storybook CSS (no .bg-primary)', () => {
    const { errors } = checkStorybookCss('.m-6{margin:1.5rem}', ['m-6']);
    expect(errors).toEqual([expect.stringMatching(/\.bg-primary/)]);
  });

  it('reports CSS compiled without the stories as a source, naming the missing utilities', () => {
    const { errors, storyOnly } = checkStorybookCss(styled, ['m-6', 'w-7']);
    expect(errors).toEqual([expect.stringMatching(/lacks 2 of the 2 .*m-6 w-7.*@source/)]);
    expect(storyOnly).toEqual([]);
  });

  it('reports a partial set of story-only utilities', () => {
    const { errors } = checkStorybookCss(`${styled}.m-6{margin:1.5rem}`, ['m-6', 'w-7']);
    expect(errors).toEqual([expect.stringMatching(/lacks 1 of the 2 .*\(w-7\)/)]);
  });

  it('passes when the stories use no utility the library lacks (nothing to require)', () => {
    expect(checkStorybookCss(styled, [])).toEqual({ errors: [], storyOnly: [] });
  });

  describe("the library's wave-rtl classes (C-LOGICAL)", () => {
    const directionClasses = ['wave-rtl:-scale-x-100'];

    it('passes when each is compiled with the direction variant', () => {
      expect(checkStorybookCss(styled + DIRECTION, [], directionClasses)).toEqual({
        errors: [],
        storyOnly: [],
      });
    });

    it('reports classes whose :dir(rtl) the build rewrote to :lang()', () => {
      // What `storybook build` emitted for the 0.5 variant: Vite's CSS minifier (Lightning CSS,
      // Chrome 111 target) rewrote `:where(:dir(rtl))` to a `:lang()` list (shortened here).
      const lowered = String.raw`@supports selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where(:is(:lang(ae),:lang(ar),:lang(he),:lang(yi))){scale:-1 1}}@supports not selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where([dir=rtl],[dir=rtl] *){scale:-1 1}}`;
      expect(checkStorybookCss(styled + lowered, [], directionClasses).errors).toEqual([
        'the Storybook CSS selects 1 wave-rtl class by :lang() (wave-rtl:-scale-x-100): the ' +
          "CSS minifier rewrote :dir(rtl) of Wave's direction variant, so the class never " +
          'matches a story that sets dir without a right-to-left lang',
      ]);
    });

    it('reports classes compiled without the direction variant', () => {
      const tailwindRtl = String.raw`.wave-rtl\:-scale-x-100:where(:dir(rtl),[dir=rtl],[dir=rtl] *){scale:-1 1}`;
      expect(checkStorybookCss(styled + tailwindRtl, [], directionClasses).errors).toEqual([
        "the Storybook CSS lacks Wave's direction variant for 1 of the 1 wave-rtl classes of " +
          'the library (wave-rtl:-scale-x-100): expected :where(:nth-child(n of :dir(rtl))) ' +
          'under @supports selector(:nth-child(n of :dir(rtl))) and the [dir=rtl] fallback ' +
          '(src/styles/variants.css)',
      ]);
    });
  });
});

describe('expectedStoryOnly (reference compile)', () => {
  // Under the repository's node_modules/.cache, so `tailwindcss/*.css` resolves as it does here;
  // removed with its parent once no other run uses the parent (no empty directory is left).
  const run = createWorkDir(
    join(root, 'node_modules', '.cache', 'wave-verify-storybook-test'),
    'run-',
  );
  const projects = run.work;
  afterAll(() => removeWorkDir(run));

  /** A project laid out like this repository, without any .storybook folder. */
  function project(storySource, component = "export const box = cn('flex p-4');\n") {
    const dir = mkdtempSync(join(projects, 'p-'));
    const files = {
      'src/styles/styles.css':
        "@import 'tailwindcss/theme.css' theme(inline);\n@import './tokens.css';\n" +
        "@import './base.css';\n@import 'tailwindcss/utilities.css' source(none);\n" +
        "@source '../components';\n",
      'src/styles/tokens.css': '.wave-dark { color-scheme: dark; }\n',
      'src/styles/base.css': '.wave-root { margin: 0; }\n',
      'src/components/Box.tsx': component,
      'stories/Box.stories.tsx': storySource,
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    return dir;
  }

  it('compiles the library stylesheet with stories/ and keeps the story-only utilities', () => {
    const dir = project('<Box className="flex m-6 w-7 notautility" />;\n');
    expect(expectedStoryOnly(dir)).toEqual(['m-6', 'w-7']);
  });

  it('is empty when the stories use only library utilities', () => {
    const dir = project('<Box className="flex p-4" />;\n');
    expect(expectedStoryOnly(dir)).toEqual([]);
  });

  it('expectedDirectionClasses lists the wave-rtl classes of library class strings only', () => {
    const dir = project(
      '<Box className="wave-rtl:ms-2" />;\n',
      '// wave-rtl:pe-2 in a comment is no class\n' +
        "export const box = cn('flex wave-rtl:-scale-x-100', 'hover:wave-rtl:ps-1');\n",
    );
    expect(expectedDirectionClasses(dir)).toEqual(['hover:wave-rtl:ps-1', 'wave-rtl:-scale-x-100']);
  });
});

describe('verifyStorybook and main', () => {
  const work = mkdtempSync(join(tmpdir(), 'wave-verify-storybook-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));
  const expected = ['m-6'];

  function staticDir(files) {
    const dir = mkdtempSync(join(work, 'static-'));
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    return dir;
  }

  it('finds the preview stylesheet among the emitted CSS files', () => {
    const dir = staticDir({
      'assets/manager.css': '.sb-bar{display:flex}',
      'assets/iframe-abc.css': '.bg-primary{color:red}.m-6{margin:1.5rem}',
      'index.html': '<html></html>',
    });
    expect(verifyStorybook(dir, expected)).toEqual({
      errors: [],
      file: 'assets/iframe-abc.css',
      storyOnly: ['m-6'],
    });
  });

  it('reports a build without CSS and a missing directory', () => {
    expect(verifyStorybook(staticDir({ 'index.html': '' }), expected).errors).toEqual([
      expect.stringMatching(/no CSS/),
    ]);
    expect(verifyStorybook(join(work, 'missing'), expected).errors).toEqual([
      expect.stringMatching(/does not exist/),
    ]);
  });

  it('reports the closest candidate when no stylesheet passes', () => {
    const dir = staticDir({ 'assets/iframe.css': '.bg-primary{color:red}' });
    const result = verifyStorybook(dir, expected);
    expect(result.file).toBe('assets/iframe.css');
    expect(result.errors).toEqual([expect.stringMatching(/used only in stories/)]);
  });

  it('exits 0 for a verified build and 1 otherwise', () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    const good = staticDir({
      'assets/iframe.css': `.bg-primary{color:red}.m-6{margin:1.5rem}${DIRECTION}`,
    });
    const direction = ['wave-rtl:-scale-x-100'];
    expect(main(['--dir', good], io, expected, direction)).toBe(0);
    expect(lines.pop()).toMatch(
      /OK \(\.bg-primary and all 1 story-only utilities, e\.g\. m-6; all 1 wave-rtl classes of the library with Wave's direction variant\)$/,
    );
    expect(main(['--dir', good], io, [], direction)).toBe(0);
    expect(lines.pop()).toMatch(
      /OK \(\.bg-primary; the stories use no utility the library lacks, so there is no story-only utility to check; all 1 wave-rtl classes of the library with Wave's direction variant\)$/,
    );
    expect(main(['--dir', join(work, 'missing')], io, expected, direction)).toBe(1);
    expect(lines.splice(0)).toEqual([
      `verify-storybook: 1 problem(s) in ${relative(process.cwd(), join(work, 'missing'))}:`,
      `  - ${join(work, 'missing')} does not exist (run storybook build first)`,
    ]);
  });

  it('exits 1 for a build whose wave-rtl classes select by :lang()', () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    const lowered = staticDir({
      'assets/iframe.css':
        '.bg-primary{color:red}' +
        String.raw`@supports selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where(:is(:lang(ae),:lang(ar))){scale:-1 1}}`,
    });
    expect(main(['--dir', lowered], io, [], ['wave-rtl:-scale-x-100'])).toBe(1);
    expect(lines).toEqual([
      `verify-storybook: 1 problem(s) in ${relative(process.cwd(), lowered)}/assets/iframe.css:`,
      '  - the Storybook CSS selects 1 wave-rtl class by :lang() (wave-rtl:-scale-x-100): the ' +
        "CSS minifier rewrote :dir(rtl) of Wave's direction variant, so the class never " +
        'matches a story that sets dir without a right-to-left lang',
    ]);
  });
});
