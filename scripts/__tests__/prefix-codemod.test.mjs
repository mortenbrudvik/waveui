// @vitest-environment node
/**
 * The prefix codemod of the library's own utilities and its compile check
 * (`scripts/prefix-codemod.mjs`, Phase 14 spec R6), on a fixture tree with the real theme and
 * variants: what it prefixes and what it leaves alone, idempotence, the `cn` rename, the two tiers
 * of `--check` and the committed allowlist.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  formatAllowlist,
  listFiles,
  loadTypeScript,
  main,
  parseArgs,
  unprefixedWords,
  loadUtilityTest,
} from '../prefix-codemod.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The fixture's sources: a component, a class map, a recipe module and a slot helper's caller. */
const SOURCES = {
  'src/lib/cn.ts':
    "export const wcn = (...a: unknown[]) => a.filter(Boolean).join(' ');\nexport const cn = wcn;\n",
  'src/lib/styles.ts': [
    "export const focusRing = 'focus-visible:outline-2 focus-visible:outline-ring';",
    "export const recipe = { fill: 'bg-primary text-primary-foreground', none: 'hidden' };",
    '',
  ].join('\n'),
  'src/components/Box.tsx': [
    "import { cn } from '../lib/cn';",
    "import { focusRing } from '../lib/styles';",
    "const sizeClasses = { small: 'h-6 px-2', large: 'h-10 px-4' } as const;",
    "export function Box({ size = 'small', open }: { size?: 'small' | 'large'; open?: boolean }) {",
    "  const position = { position: 'relative' as const, overflow: 'hidden' as const };",
    "  const strategy = 'fixed';",
    '  return (',
    '    <div',
    '      role="grid"',
    '      data-strategy={strategy}',
    '      style={position}',
    "      className={cn('group/row relative flex', sizeClasses[size], open && 'grid', focusRing)}",
    '    />',
    '  );',
    '}',
    'export const glued = (suffix: string) => cn(`p-1 flex${suffix}`);',
    '',
  ].join('\n'),
  'src/components/__tests__/Box.test.tsx': "export const ignored = 'p-4';\n",
};

let project = '';
const write = (path, content) => {
  mkdirSync(dirname(join(project, path)), { recursive: true });
  writeFileSync(join(project, path), content);
};
const read = (path) => readFileSync(join(project, path), 'utf8');
const run = async (argv) => {
  const lines = [];
  const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
  const code = await main(['--root', project, ...argv], { io });
  return { code, lines };
};

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'wave-prefix-codemod-'));
  mkdirSync(join(project, 'src/styles'), { recursive: true });
  for (const name of ['theme.css', 'variants.css']) {
    copyFileSync(join(ROOT, 'src/styles', name), join(project, 'src/styles', name));
  }
  for (const [path, content] of Object.entries(SOURCES)) write(path, content);
});

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('prefix-codemod --write', () => {
  it('counts on a dry run and writes nothing', async () => {
    const { code, lines } = await run(['src/components', 'src/lib']);
    expect(code).toBe(0);
    expect(lines).toEqual([
      'prefix-codemod: 14 word(s) (14 distinct) prefixed in 2 of 3 file(s) (dry run); 3 cn ' +
        'rename(s), 1 glued, 0 escaped, 0 outside',
    ]);
    expect(read('src/components/Box.tsx')).toBe(SOURCES['src/components/Box.tsx']);
  }, 60_000);

  it('prefixes the class contexts, renames cn, and leaves every other string alone', async () => {
    expect((await run(['--write', 'src/components', 'src/lib'])).code).toBe(0);
    const box = read('src/components/Box.tsx');
    expect(box).toContain("import { wcn } from '../lib/cn';");
    expect(box).toContain(
      "const sizeClasses = { small: 'wave:h-6 wave:px-2', large: 'wave:h-10 wave:px-4' } as const;",
    );
    expect(box).toContain(
      "className={wcn('wave:group/row wave:relative wave:flex', sizeClasses[size], open && 'wave:grid', focusRing)}",
    );
    // A positioning strategy, a role and style values are no classes.
    expect(box).toContain("position: 'relative' as const, overflow: 'hidden' as const");
    expect(box).toContain("const strategy = 'fixed';");
    expect(box).toContain('role="grid"');
    // A word glued to a substitution is reported and left alone; the rest of its literal is not.
    expect(box).toContain('wcn(`wave:p-1 flex${suffix}`)');
    // The recipe module: every top-level value is a class recipe.
    expect(read('src/lib/styles.ts')).toBe(
      [
        "export const focusRing = 'wave:focus-visible:outline-2 wave:focus-visible:outline-ring';",
        "export const recipe = { fill: 'wave:bg-primary wave:text-primary-foreground', none: 'wave:hidden' };",
        '',
      ].join('\n'),
    );
    // cn.ts itself and the tests are never touched.
    expect(read('src/lib/cn.ts')).toBe(SOURCES['src/lib/cn.ts']);
    expect(read('src/components/__tests__/Box.test.tsx')).toBe(
      SOURCES['src/components/__tests__/Box.test.tsx'],
    );
  }, 60_000);

  it('changes nothing on a second run', async () => {
    const before = read('src/components/Box.tsx');
    const { lines } = await run(['--write', 'src/components', 'src/lib']);
    expect(lines[0]).toMatch(
      /^prefix-codemod: 0 word\(s\) \(0 distinct\) prefixed in 0 of 3 file\(s\); 0 cn rename/,
    );
    expect(read('src/components/Box.tsx')).toBe(before);
  }, 60_000);
});

describe('prefix-codemod --check (two tiers)', () => {
  it('fails the word the codemod reported glued and left (tier 1), and writes the allowlist', async () => {
    const allow = join(project, 'scripts/prefix-allowlist.json');
    mkdirSync(dirname(allow), { recursive: true });
    const derived = await run(['--check', '--write-allowlist', 'src/components', 'src/lib']);
    expect(derived.lines.slice(1)).toEqual(['  src/components/Box.tsx:16 flex']);
    expect(derived.code).toBe(1);
    expect(JSON.parse(readFileSync(allow, 'utf8'))).toEqual({
      'src/components/Box.tsx': ['fixed', 'grid', 'hidden', 'relative'],
    });
  }, 60_000);

  it('passes once the glued word is prefixed by hand and the other words are allowed', async () => {
    write(
      'src/components/Box.tsx',
      read('src/components/Box.tsx').replace('flex${suffix}', 'wave:flex${suffix}'),
    );
    const report = join(project, 'check-report.json');
    const { code, lines } = await run(['--check', '--report', report, 'src/components', 'src/lib']);
    expect(lines).toEqual([
      'prefix-codemod --check: 0 unprefixed word(s) in class contexts; 0 outside the allowlist ' +
        'elsewhere (4 word-file pair(s), 4 word(s), in other literals) of 3 file(s); 15 prefixed ' +
        'class word(s) in 8 class literal(s)',
    ]);
    expect(code).toBe(0);
    // The report keeps the lines of every tier-2 pair.
    expect(JSON.parse(readFileSync(report, 'utf8')).untracedPlaces).toEqual({
      'src/components/Box.tsx': { fixed: [6], grid: [9], hidden: [5], relative: [5] },
    });
  }, 60_000);

  it('tier 1: an unprefixed relative in a wcn call fails although the file allows relative', async () => {
    const box = read('src/components/Box.tsx');
    write(
      'src/components/Box.tsx',
      box.replace(
        "'wave:group/row wave:relative wave:flex'",
        "'wave:group/row relative wave:flex'",
      ),
    );
    try {
      const { code, lines } = await run(['--check', 'src/components', 'src/lib']);
      expect(lines.slice(1)).toEqual(['  src/components/Box.tsx:12 relative']);
      expect(code).toBe(1);
    } finally {
      write('src/components/Box.tsx', box);
    }
  }, 60_000);

  it("tier 2: a new 'fixed' in a file the allowlist does not name for it fails", async () => {
    write('src/lib/strategy.ts', "export const strategy = 'fixed';\n");
    try {
      const { code, lines } = await run(['--check', 'src/components', 'src/lib']);
      expect(lines.slice(1)).toEqual(['  src/lib/strategy.ts:1 fixed']);
      expect(code).toBe(1);
    } finally {
      rmSync(join(project, 'src/lib/strategy.ts'));
    }
  }, 60_000);

  it('reads every string literal, never comments, imports or literal types', async () => {
    const ts = loadTypeScript();
    write(
      'src/lib/words.ts',
      [
        '// a flex comment and a relative one',
        "import type { X } from './grid';",
        "export type Mode = 'fixed' | 'absolute';",
        "export const label = 'inline-flex wave:p-2 sticky';",
        '',
      ].join('\n'),
    );
    try {
      const isUtility = await loadUtilityTest(project);
      const words = unprefixedWords(
        ts,
        [join(project, 'src/lib/words.ts').split('\\').join('/')],
        isUtility,
        'wave',
      );
      expect([...words.keys()].sort()).toEqual(['inline-flex', 'sticky']);
    } finally {
      rmSync(join(project, 'src/lib/words.ts'));
    }
  }, 60_000);
});

describe('the committed allowlist (scripts/prefix-allowlist.json)', () => {
  const allow = JSON.parse(readFileSync(join(ROOT, 'scripts/prefix-allowlist.json'), 'utf8'));

  it('is printed as Prettier prints it, sorted by file', async () => {
    const prettier = await import('prettier');
    const text = readFileSync(join(ROOT, 'scripts/prefix-allowlist.json'), 'utf8');
    expect(formatAllowlist(allow)).toBe(text);
    const options = {
      ...(await prettier.resolveConfig(join(ROOT, 'scripts/prefix-allowlist.json'))),
      parser: 'json',
    };
    expect(await prettier.format(text, options)).toBe(text);
    expect(Object.keys(allow)).toEqual([...Object.keys(allow)].sort());
  });

  it('names, for each file of src/components and src/lib, words its string literals hold', () => {
    const ts = loadTypeScript();
    const files = new Set(
      listFiles(ROOT, ['src/components', 'src/lib']).map((file) =>
        file.slice(ROOT.split('\\').join('/').length + 1),
      ),
    );
    for (const [file, words] of Object.entries(allow)) {
      expect(files.has(file), file).toBe(true);
      const sf = ts.createSourceFile(
        file,
        readFileSync(join(ROOT, file), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const found = new Set();
      const visit = (node) => {
        if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)
        ) {
          for (const word of node.text.split(/\s+/)) found.add(word);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      for (const word of words) expect(found.has(word), `${file} ${word}`).toBe(true);
    }
  });

  it('holds only words of the 22 the spike read (spec §6, Task 1)', () => {
    const SPIKE_WORDS =
      'absolute blur border collapse container filter fixed grid group hidden inline list-item outline relative resize ring rounded select-all static table underline visible'.split(
        ' ',
      );
    expect(
      [...new Set(Object.values(allow).flat())].every((word) => SPIKE_WORDS.includes(word)),
    ).toBe(true);
  });
});

describe('parseArgs', () => {
  it.each([
    [['--write', '--check', 'src'], '--write and --check exclude each other'],
    [['--write-allowlist', 'src'], '--write-allowlist needs --check'],
    [['--prefix', 'Wave', 'src'], '--prefix must be a Tailwind prefix'],
    [[], 'no files or directories given'],
    [['--fix', 'src'], 'unknown option --fix'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });

  it('makes a usage error exit 2', async () => {
    const lines = [];
    const code = await main(['--fix'], {
      io: { log: (l) => lines.push(l), error: (l) => lines.push(l) },
    });
    expect({ code, lines }).toEqual({ code: 2, lines: ['prefix-codemod: unknown option --fix'] });
  });
});
