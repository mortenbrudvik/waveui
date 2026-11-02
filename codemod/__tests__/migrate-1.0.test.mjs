// @vitest-environment node
/**
 * The shipped 1.0 migration codemod (`codemod/migrate-1.0.mjs`, Phase 14 spec R6 "Migration"): its
 * table against tokens.css, the rewrite of each kind of file, the false positives it must leave
 * alone, idempotence, the files it reads (never node_modules) and its command line.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  collectFiles,
  COLOR_ROOTS,
  declaredNames,
  globToRegExp,
  main,
  parseThemeTable,
  printTable,
  rewriteFile,
  rewriteMarkup,
  rewriteScript,
  rewriteStyle,
  rewriteText,
  scriptStringRanges,
  SHARED_COLORS,
  THEME_TABLE,
} from '../migrate-1.0.mjs';
import { loadUtilityTest } from '../../scripts/prefix-codemod.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'codemod', 'migrate-1.0.mjs');
const TOKENS_CSS = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');

const rewrite = (text, options) => rewriteText(text, options);
const shared = { includeShared: true };

describe('the table', () => {
  it('is the namespaced keys of tokens.css (regenerate with --print-table on a failure)', () => {
    expect(THEME_TABLE).toEqual(parseThemeTable(TOKENS_CSS));
    expect(THEME_TABLE.colors).toContain('primary-hover');
    expect(THEME_TABLE.text).toEqual(expect.arrayContaining(['body-1', 'caption-2', 'display']));
    expect(THEME_TABLE.shadow).toEqual(['2', '4', '8', '16', '28', '64']);
    // The sub-keys of the type ramp are no utilities.
    expect(THEME_TABLE.text.some((step) => step.includes('--'))).toBe(false);
  });

  it('prints the declaration the file holds', () => {
    const source = readFileSync(SCRIPT, 'utf8');
    const block = /\/\/ BEGIN THEME TABLE[^\n]*\n([\s\S]*?)\n\/\/ END THEME TABLE/.exec(source)[1];
    const compact = (text) => text.replace(/\s+/g, '').replace(/,(?=[\]}])/g, '');
    expect(compact(block)).toBe(compact(printTable(parseThemeTable(TOKENS_CSS))));
  });

  it('shares 17 color names with a stock shadcn/ui theme', () => {
    expect(SHARED_COLORS).toEqual([
      'background',
      'foreground',
      'card',
      'card-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'primary',
      'primary-foreground',
      'accent',
      'accent-foreground',
      'destructive',
      'destructive-foreground',
      'border',
      'input',
      'ring',
    ]);
  });

  it('knows only roots that Tailwind compiles with a theme color, before and after', async () => {
    const internal = await loadUtilityTest(ROOT, { themes: [join(ROOT, 'src/styles/theme.css')] });
    const namespaced = await loadUtilityTest(ROOT, {
      themes: [join(ROOT, 'src/styles/tokens.css')],
    });
    for (const root of COLOR_ROOTS) {
      expect(internal(`${root}-primary`), root).toBe(true);
      expect(namespaced(`${root}-wave-primary`), root).toBe(true);
      // An app's build has no unnamespaced key any more: the old name renders nothing.
      expect(namespaced(`${root}-primary`), root).toBe(false);
    }
    for (const [before, after] of [
      ['text-body-1', 'text-wave-body-1'],
      ['shadow-4', 'shadow-wave-4'],
    ]) {
      expect(internal(before)).toBe(true);
      expect(namespaced(after)).toBe(true);
      expect(rewrite(before)).toBe(after);
    }
  }, 60_000);
});

describe('rewriteText', () => {
  it.each([
    ['bg-subtle-hover', 'bg-wave-subtle-hover'],
    ['bg-primary-hover', 'bg-wave-primary-hover'],
    ['text-body-1', 'text-wave-body-1'],
    ['text-body-1/6', 'text-wave-body-1/6'],
    ['shadow-28', 'shadow-wave-28'],
    [
      'border-t-stroke border-s-stroke-accessible',
      'border-t-wave-stroke border-s-wave-stroke-accessible',
    ],
    ['hover:bg-subtle-hover/50', 'hover:bg-wave-subtle-hover/50'],
    ['dark:text-success', 'dark:text-wave-success'],
    ['data-[state=open]:ring-palette-red', 'data-[state=open]:ring-wave-palette-red'],
    ['group-hover/row:fill-severe', 'group-hover/row:fill-wave-severe'],
    ['!bg-error bg-error!', '!bg-wave-error bg-wave-error!'],
    ['bg-subtle/[0.4] bg-subtle/(--alpha)', 'bg-wave-subtle/[0.4] bg-wave-subtle/(--alpha)'],
    [
      'from-brand-80 via-brand-10 to-transparent',
      'from-wave-brand-80 via-wave-brand-10 to-transparent',
    ],
  ])('rewrites %s', (before, after) => {
    expect(rewrite(before)).toBe(after);
  });

  it.each([
    ['an already namespaced class', 'text-wave-body-1 bg-wave-primary shadow-wave-4'],
    ['a word that is no utility', "'primary' primary appearance outline"],
    ['a Tailwind color or size', 'bg-red-500 text-sm shadow-lg shadow-4xl text-body-10'],
    ['a longer class', 'my-bg-subtle x-text-body-1 bg-subtle-hovered'],
    ['a selector or a property', '.bg-subtle { } #text-body-1 @bg-subtle'],
    ['an arbitrary value', 'bg-[bg-subtle] text-[text-body-1]'],
    [
      'the font, animation and motion utilities, already Wave’s',
      'font-wave animate-wave-spin duration-wave-fast ease-wave-linear',
    ],
  ])('leaves %s alone', (_, text) => {
    expect(rewrite(text, shared)).toBe(text);
  });

  it('rewrites the names a shadcn/ui theme shares only with includeShared, counting the rest', () => {
    const text =
      'bg-primary text-foreground hover:bg-primary/50 dark:text-foreground !bg-primary border-border ring-ring';
    const stats = { replacements: 0, shared: 0 };
    expect(rewriteText(text, { stats })).toBe(text);
    expect(stats).toEqual({ replacements: 0, shared: 7 });
    expect(rewrite(text, shared)).toBe(
      'bg-wave-primary text-wave-foreground hover:bg-wave-primary/50 dark:text-wave-foreground ' +
        '!bg-wave-primary border-wave-border ring-wave-ring',
    );
    // A shared name with a suffix is Wave's own token.
    expect(rewrite('bg-primary-hover text-primary-foreground')).toBe(
      'bg-wave-primary-hover text-primary-foreground',
    );
  });

  it('rewrites theme variable uses, never a declaration', () => {
    expect(
      rewrite(
        'var(--color-subtle) theme(--text-body-1--line-height) --theme(--shadow-4) ' +
          'bg-(--color-subtle-hover) bg-[var(--color-severe)]',
        { classes: false },
      ),
    ).toBe(
      'var(--color-wave-subtle) theme(--text-wave-body-1--line-height) --theme(--shadow-wave-4) ' +
        'bg-(--color-wave-subtle-hover) bg-[var(--color-wave-severe)]',
    );
    for (const text of [
      '--color-subtle: red;',
      "{ '--color-subtle': 'red' }",
      'var(--wave-subtle) var(--color-wave-subtle) var(--wave-shadow-4) var(--color-red-500)',
      'var(--color-primary)',
    ]) {
      expect(rewrite(text, { classes: false })).toBe(text);
    }
    expect(rewrite('var(--color-primary)', { ...shared, classes: false })).toBe(
      'var(--color-wave-primary)',
    );
  });

  it('leaves a class with Wave’s own prefix alone, and rewrites the app’s classes next to it', () => {
    // The library's 1.0 class strings: Tailwind puts the prefix before every other variant.
    const prefixed =
      'wave:bg-primary wave:hover:text-body-1 wave:data-[selected]:bg-subtle-hover/50 ' +
      'wave:shadow-4 wave:border-t-stroke wave:!bg-error wave:bg-error!';
    const stats = { replacements: 0, shared: 0 };
    expect(rewriteText(prefixed, { ...shared, stats })).toBe(prefixed);
    expect(stats).toEqual({ replacements: 0, shared: 0 });
    for (const quoted of [`'${prefixed}'`, `"${prefixed}"`, `\`${prefixed}\``]) {
      expect(rewrite(quoted, shared)).toBe(quoted);
    }
    expect(rewrite('wave:bg-subtle bg-subtle\twave:text-body-1\ntext-body-1', shared)).toBe(
      'wave:bg-subtle bg-wave-subtle\twave:text-body-1\ntext-wave-body-1',
    );
    // Only a leading `wave:` is the prefix: a variant that merely ends in it is not.
    expect(rewrite('hover:bg-subtle group-wave:bg-subtle', shared)).toBe(
      'hover:bg-wave-subtle group-wave:bg-wave-subtle',
    );
  });

  it('is idempotent', () => {
    const once = rewrite('bg-primary hover:text-body-1 shadow-4 var(--color-subtle)', shared);
    expect(rewrite(once, shared)).toBe(once);
  });
});

describe('scripts', () => {
  it('rewrites string literals and template text, never comments, regexes or JSX text', () => {
    const code = [
      '// bg-subtle in a comment',
      "/* 'bg-subtle' in a block comment */",
      "const a = 'bg-subtle';",
      'const b = "text-body-1";',
      "const c = `x ${y ? 'shadow-4' : `text-body-2`} bg-subtle`;",
      'const r = /bg-subtle/g;',
      'const d = a / 2; const e = "bg-subtle";',
      "const p = <p>Don't use bg-subtle here</p>;",
      'const q = <div className="bg-subtle" title={`text-body-1`} />;',
      "const appearance = 'primary';",
      '',
    ].join('\n');
    expect(rewriteScript(code, {})).toBe(
      [
        '// bg-subtle in a comment',
        "/* 'bg-subtle' in a block comment */",
        "const a = 'bg-wave-subtle';",
        'const b = "text-wave-body-1";',
        "const c = `x ${y ? 'shadow-wave-4' : `text-wave-body-2`} bg-wave-subtle`;",
        'const r = /bg-subtle/g;',
        'const d = a / 2; const e = "bg-wave-subtle";',
        "const p = <p>Don't use bg-subtle here</p>;",
        'const q = <div className="bg-wave-subtle" title={`text-wave-body-1`} />;',
        "const appearance = 'primary';",
        '',
      ].join('\n'),
    );
  });

  it('leaves a prefixed class alone across a template substitution, and nothing after it', () => {
    const code = [
      "const a = 'wave:bg-subtle bg-subtle';",
      // The substitution is a chain of variants: the text after it continues the class.
      'const b = `wave:${gate}bg-primary-hover wave:${track}:bg-stroke-accessible`;',
      'const c = `wave:${a}${b}text-body-1 ${x}text-body-1 bg-subtle`;',
      // A class that ended before the substitution, or a substitution after unprefixed text.
      'const d = `wave:p-2 ${gate}bg-subtle hover:${gate}bg-subtle`;',
      "const e = 'wave:'; const f = `${g}bg-subtle`;",
      '',
    ].join('\n');
    expect(rewriteScript(code, {})).toBe(
      [
        "const a = 'wave:bg-subtle bg-wave-subtle';",
        'const b = `wave:${gate}bg-primary-hover wave:${track}:bg-stroke-accessible`;',
        'const c = `wave:${a}${b}text-body-1 ${x}text-wave-body-1 bg-wave-subtle`;',
        'const d = `wave:p-2 ${gate}bg-wave-subtle hover:${gate}bg-wave-subtle`;',
        "const e = 'wave:'; const f = `${g}bg-wave-subtle`;",
        '',
      ].join('\n'),
    );
  });

  it('finds the strings of a closing JSX tag and a self-closing one as strings', () => {
    const code = '<a href="x">y</a>; const s = "bg-subtle"; <b/>; const t = \'shadow-4\';';
    const ranges = scriptStringRanges(code).map(([start, end]) => code.slice(start, end));
    expect(ranges).toEqual(['x', 'bg-subtle', 'shadow-4']);
  });
});

describe('stylesheets', () => {
  it('rewrites @apply lists and variable uses, never a comment, a declaration or a selector', () => {
    const css = [
      '/* @apply bg-subtle; var(--color-subtle) */',
      '.card { @apply hover:bg-subtle-hover text-body-1 !important; }',
      '.box { color: var(--color-subtle); box-shadow: var(--shadow-8); }',
      '@theme { --color-subtle: oklch(0.5 0 0); --color-brand: var(--color-severe); }',
      '.bg-subtle { padding: 0; }',
      '',
    ].join('\n');
    expect(rewriteStyle(css, {})).toBe(
      [
        '/* @apply bg-subtle; var(--color-subtle) */',
        '.card { @apply hover:bg-wave-subtle-hover text-wave-body-1 !important; }',
        '.box { color: var(--color-wave-subtle); box-shadow: var(--shadow-wave-8); }',
        '@theme { --color-subtle: oklch(0.5 0 0); --color-brand: var(--color-wave-severe); }',
        '.bg-subtle { padding: 0; }',
        '',
      ].join('\n'),
    );
  });
});

describe('markup', () => {
  it('rewrites class and style attributes, script and style blocks, never comments or text', () => {
    const html = [
      '<!-- <div class="bg-subtle"> -->',
      '<div class="bg-subtle p-2" style="color: var(--color-subtle)">bg-subtle as text</div>',
      "<span class='text-body-1'></span>",
      "<script>const c = 'shadow-8'; // 'shadow-4'</script>",
      '<style>.a { @apply text-body-2; }</style>',
      '',
    ].join('\n');
    expect(rewriteMarkup(html, {})).toBe(
      [
        '<!-- <div class="bg-subtle"> -->',
        '<div class="bg-wave-subtle p-2" style="color: var(--color-wave-subtle)">bg-subtle as text</div>',
        "<span class='text-wave-body-1'></span>",
        "<script>const c = 'shadow-wave-8'; // 'shadow-4'</script>",
        '<style>.a { @apply text-wave-body-2; }</style>',
        '',
      ].join('\n'),
    );
  });

  it('reads Vue and Svelte class bindings and directives', () => {
    expect(
      rewriteFile(
        'x.vue',
        '<template><b :class="{ \'bg-subtle\': on }" v-bind:class="[\'shadow-4\']" /></template>',
        {},
      ),
    ).toBe(
      '<template><b :class="{ \'bg-wave-subtle\': on }" v-bind:class="[\'shadow-wave-4\']" /></template>',
    );
    expect(rewriteFile('x.svelte', '<b class="text-body-1 {x}" class:bg-subtle={on} />', {})).toBe(
      '<b class="text-wave-body-1 {x}" class:bg-wave-subtle={on} />',
    );
  });

  it('reads the className of MDX, never its fenced code or prose', () => {
    const mdx = [
      'Use bg-subtle for a quiet background.',
      '',
      '<Card className="bg-subtle" />',
      '<Card className={`shadow-4 ${x}`} />',
      '',
      '```jsx',
      '<Card className="bg-subtle" />',
      '```',
      '',
    ].join('\n');
    expect(rewriteFile('x.mdx', mdx, {})).toBe(
      [
        'Use bg-subtle for a quiet background.',
        '',
        '<Card className="bg-wave-subtle" />',
        '<Card className={`shadow-wave-4 ${x}`} />',
        '',
        '```jsx',
        '<Card className="bg-subtle" />',
        '```',
        '',
      ].join('\n'),
    );
  });

  it('reads no other file type', () => {
    expect(rewriteFile('x.md', 'bg-subtle', {})).toBeUndefined();
    expect(rewriteFile('x.json', '{"c":"bg-subtle"}', {})).toBeUndefined();
  });
});

describe('declarations, file names and the app’s own theme keys', () => {
  it("leaves a style object's custom property and an @property registration, never a class key", () => {
    expect(
      rewriteScript("const s = { '--color-subtle': x, 'bg-subtle': on, \"--shadow-4\": y };", {}),
    ).toBe("const s = { '--color-subtle': x, 'bg-wave-subtle': on, \"--shadow-4\": y };");
    // A use in a value is rewritten.
    expect(rewriteScript("const v = { color: 'var(--color-subtle)' };", {})).toBe(
      "const v = { color: 'var(--color-wave-subtle)' };",
    );
    expect(
      rewriteStyle(
        '@property --color-subtle { syntax: "<color>"; } .a { color: var(--color-subtle); }',
        {},
      ),
    ).toBe(
      '@property --color-subtle { syntax: "<color>"; } .a { color: var(--color-wave-subtle); }',
    );
  });

  it('leaves a file name that starts like a utility', () => {
    expect(rewrite("'bg-subtle.png' 'shadow-4.svg' 'text-body-1.md'")).toBe(
      "'bg-subtle.png' 'shadow-4.svg' 'text-body-1.md'",
    );
    expect(rewrite('bg-subtle. bg-subtle/50')).toBe('bg-wave-subtle. bg-wave-subtle/50');
  });

  it("finds the names the app's files declare as their own theme keys", () => {
    expect(
      declaredNames([
        '@theme { --color-success: oklch(0.6 0.2 140); --color-error: red; --text-body-1: 15px; }',
        "const theme = { '--color-info': 'blue' };",
        // Not Wave's names, or already namespaced: nothing to keep.
        ':root { --color-brand: x; --color-wave-primary: y; --shadow-lg: z; }',
        // A use is no declaration.
        '.a { color: var(--color-severe); }',
      ]),
    ).toEqual({ color: ['error', 'info', 'success'], text: ['body-1'], shadow: [] });
  });

  it("treats those names as shared: left unless --include-shared, like shadcn/ui's", () => {
    const appNames = { color: ['success'], text: ['body-1'], shadow: [] };
    const stats = { replacements: 0, shared: 0 };
    expect(
      rewriteText('bg-success text-body-1 bg-severe var(--color-success) var(--text-body-1)', {
        appNames,
        stats,
      }),
    ).toBe('bg-success text-body-1 bg-wave-severe var(--color-success) var(--text-body-1)');
    expect(stats).toEqual({ replacements: 1, shared: 4 });
    expect(rewriteText('bg-success text-body-1', { appNames, includeShared: true })).toBe(
      'bg-wave-success text-wave-body-1',
    );
  });

  it('reads the declarations across the scanned files and says so', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wave-migrate-daisy-'));
    try {
      writeFileSync(join(dir, 'theme.css'), '@theme { --color-success: oklch(0.6 0.2 140); }\n');
      writeFileSync(join(dir, 'App.tsx'), '<i className="bg-success bg-severe" />\n');
      const lines = [];
      const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
      expect(main(['--dry-run', '.'], { cwd: dir, io })).toBe(0);
      expect(lines).toEqual([
        'migrate-1.0: the files declare --color-success: the app’s own names, left as they are ' +
          '(--include-shared rewrites them too)',
        'App.tsx:1\n  - <i className="bg-success bg-severe" />\n' +
          '  + <i className="bg-success bg-wave-severe" />',
        'migrate-1.0 (dry run): 1 replacement(s) in 1 of 2 file(s); 1 use(s) of a name shared ' +
          'with shadcn/ui or declared by the app left as they are (pass --include-shared if they ' +
          'named Wave’s tokens)',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('files', () => {
  let dir = '';
  const write = (path, content = '') => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'wave-migrate-files-'));
    write('src/App.tsx', '<i className="bg-primary text-body-1" />\n');
    write('src/app.css', '.a { @apply shadow-4; }\n');
    write('src/deep/Card.vue', '<b class="bg-subtle" />\n');
    write('src/notes.md', 'bg-subtle\n');
    write('node_modules/lib/index.js', "export const c = 'bg-subtle';\n");
    write('src/node_modules/inner.ts', "export const c = 'bg-subtle';\n");
    return () => rmSync(dir, { recursive: true, force: true });
  });

  it('walks directories for the file types it reads, never into node_modules', () => {
    const notes = [];
    const files = collectFiles(['.'], dir, notes).map((file) =>
      file
        .slice(dir.length + 1)
        .split('\\')
        .join('/'),
    );
    expect(files).toEqual(['src/App.tsx', 'src/app.css', 'src/deep/Card.vue']);
    expect(notes).toEqual([]);
  });

  it('takes globs, and refuses a path into node_modules', () => {
    const notes = [];
    const rel = (inputs) =>
      collectFiles(inputs, dir, notes).map((file) =>
        file
          .slice(dir.length + 1)
          .split('\\')
          .join('/'),
      );
    expect(rel(['src/**/*.{tsx,vue}'])).toEqual(['src/App.tsx', 'src/deep/Card.vue']);
    expect(rel(['src/*.css'])).toEqual(['src/app.css']);
    expect(rel(['node_modules/lib/index.js', 'src/notes.md', 'missing.ts', 'src/*.scss'])).toEqual(
      [],
    );
    expect(notes).toEqual([
      'node_modules/lib/index.js: node_modules is never migrated',
      'src/notes.md: not a file type the codemod reads',
      'missing.ts: not found',
      'src/*.scss: matched no file',
    ]);
  });

  it('turns globs into expressions over forward-slash paths', () => {
    expect(globToRegExp('**/*.tsx').test('a/b/c.tsx')).toBe(true);
    expect(globToRegExp('**/*.tsx').test('c.tsx')).toBe(true);
    expect(globToRegExp('*.tsx').test('a/c.tsx')).toBe(false);
    expect(globToRegExp('{a,b}/[xy]?.css').test('b/xz.css')).toBe(true);
  });
});

describe('main', () => {
  let dir = '';
  const run = (argv) => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    return { code: main(argv, { cwd: dir, io }), lines };
  };
  const APP = '<i className="bg-primary text-body-1 hover:bg-subtle-hover" />\n';

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('prints a diff-like report and writes nothing on a dry run', () => {
    dir = mkdtempSync(join(tmpdir(), 'wave-migrate-main-'));
    writeFileSync(join(dir, 'App.tsx'), APP);
    const { code, lines } = run(['--dry-run', 'App.tsx']);
    expect(code).toBe(0);
    expect(lines).toEqual([
      'App.tsx:1\n  - <i className="bg-primary text-body-1 hover:bg-subtle-hover" />\n' +
        '  + <i className="bg-primary text-wave-body-1 hover:bg-wave-subtle-hover" />',
      'migrate-1.0 (dry run): 2 replacement(s) in 1 of 1 file(s); 1 use(s) of a name shared with ' +
        'shadcn/ui left as they are (pass --include-shared if they named Wave\u2019s tokens)',
    ]);
    expect(readFileSync(join(dir, 'App.tsx'), 'utf8')).toBe(APP);
  });

  it('writes the files, and a second run changes nothing', () => {
    dir = mkdtempSync(join(tmpdir(), 'wave-migrate-main-'));
    writeFileSync(join(dir, 'App.tsx'), APP);
    expect(run(['--include-shared', '.']).lines).toEqual([
      'migrate-1.0: 3 replacement(s) in 1 of 1 file(s)',
    ]);
    expect(readFileSync(join(dir, 'App.tsx'), 'utf8')).toBe(
      '<i className="bg-wave-primary text-wave-body-1 hover:bg-wave-subtle-hover" />\n',
    );
    expect(run(['--include-shared', '.'])).toEqual({
      code: 0,
      lines: ['migrate-1.0: 0 replacement(s) in 0 of 1 file(s)'],
    });
  });

  it('exits 2 on a usage error and 1 when no file matches', () => {
    dir = mkdtempSync(join(tmpdir(), 'wave-migrate-main-'));
    expect(run([]).code).toBe(2);
    expect(run(['--fix', 'x']).code).toBe(2);
    expect(run(['nothing/**/*.tsx'])).toEqual({
      code: 1,
      lines: ['migrate-1.0: nothing/**/*.tsx: matched no file', 'migrate-1.0: no file to migrate'],
    });
  });

  it('runs as a script with Node.js alone (no dependency)', () => {
    dir = mkdtempSync(join(tmpdir(), 'wave-migrate-cli-'));
    writeFileSync(join(dir, 'app.css'), '.a { @apply shadow-4; color: var(--color-subtle); }\n');
    const result = spawnSync(process.execPath, [SCRIPT, 'app.css'], { cwd: dir, encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('migrate-1.0: 2 replacement(s) in 1 of 1 file(s)\n');
    expect(result.status).toBe(0);
    expect(readFileSync(join(dir, 'app.css'), 'utf8')).toBe(
      '.a { @apply shadow-wave-4; color: var(--color-wave-subtle); }\n',
    );
    // Its only imports are Node.js built-ins.
    const imports = [...readFileSync(SCRIPT, 'utf8').matchAll(/^import [^;]*? from '([^']+)';$/gm)];
    expect(imports.map(([, specifier]) => specifier).every((s) => s.startsWith('node:'))).toBe(
      true,
    );
    expect(imports.length).toBeGreaterThan(0);
  });
});
