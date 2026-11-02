// @vitest-environment node
/**
 * The test migration of the utilities flip (`scripts/prefix-tests-codemod.mjs`, Phase 14 spec R6
 * "Transition"), on a fixture tree with the real theme and variants: Wave's own classes prefixed,
 * a consumer's class left alone, selectors escaped, markup, `it.each` rows, loops and helpers
 * traced, the public `cn` renamed where a test models the components' merge, idempotence and the
 * report of what it could not classify.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  decodeJsString,
  isTestFile,
  main,
  parseArgs,
  selectorClasses,
} from '../prefix-tests-codemod.mjs';
import { main as prefixSrc } from '../prefix-codemod.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const BOX_TEST = [
  "import { cn } from '../../lib/cn';",
  "import { testSystemProps } from '../../test-utils';",
  "const GATE = 'not-disabled:not-aria-disabled:hover:';",
  "const heights = { small: 'h-6', large: 'h-10' };",
  'function expectNone(element: Element, classes: readonly string[]) {',
  '  for (const name of classes) expect(element).not.toHaveClass(name);',
  '}',
  'declare const el: HTMLElement;',
  'declare const html: string;',
  "testSystemProps(Box, { conflictingClass: { className: 'p-8', overrides: 'p-4' } });",
  "it('a consumer p-2 replaces the padding (title: text-body-1)', () => {",
  '  render(<Box className="p-2" />);',
  "  expect(el).toHaveClass('p-2', 'flex');",
  "  expect(el).not.toHaveClass('p-4');",
  '});',
  "it.each([['small', 'h-6'], ['large', 'h-10']])('size %s', (size, cls) => {",
  '  render(<Box size={size} />);',
  '  expect(el).toHaveClass(cls, heights[size]);',
  '});',
  "it('gates its hover', () => {",
  '  expect(el).toHaveClass(`${GATE}bg-subtle-hover`);',
  "  expectNone(el, ['w-80', 'w-148']);",
  "  for (const word of ['inline-flex', 'items-center']) expect(el).toHaveClass(word);",
  "  expect(el.querySelector('.sr-only')).toBeNull();",
  "  expect(el.closest('.custom-root')).toBeNull();",
  '  expect(html).toBe(\'<div class="wave-box flex p-4">x</div>\');',
  "  expect(Array.from(el.classList).sort()).toEqual(['gap-1', 'flex'].sort());",
  "  expect(getComputedStyle(el).display).toBe('inline-block');",
  '});',
  "it('models the merge', () => {",
  "  const Own = ({ className }: { className?: string }) => <i className={cn('flex p-4', className)} />;",
  "  expect(cn(heights.small, 'text-error')).toContain('text-error');",
  '  render(<Own />);',
  '});',
  "export const unused = 'bg-primary text-foreground';",
  "it.each([16, 24])('box %d', (px) => {",
  '  expect(el.className).toContain(`w-${px / 4}`);',
  '});',
  '',
].join('\n');

const MIGRATED = [
  "import { wcn } from '../../lib/cn';",
  "import { testSystemProps } from '../../test-utils';",
  "const GATE = 'not-disabled:not-aria-disabled:hover:';",
  "const heights = { small: 'wave:h-6', large: 'wave:h-10' };",
  'function expectNone(element: Element, classes: readonly string[]) {',
  '  for (const name of classes) expect(element).not.toHaveClass(name);',
  '}',
  'declare const el: HTMLElement;',
  'declare const html: string;',
  "testSystemProps(Box, { conflictingClass: { className: 'p-8', overrides: 'wave:p-4' } });",
  "it('a consumer p-2 replaces the padding (title: text-body-1)', () => {",
  '  render(<Box className="p-2" />);',
  "  expect(el).toHaveClass('p-2', 'wave:flex');",
  "  expect(el).not.toHaveClass('wave:p-4');",
  '});',
  "it.each([['small', 'wave:h-6'], ['large', 'wave:h-10']])('size %s', (size, cls) => {",
  '  render(<Box size={size} />);',
  '  expect(el).toHaveClass(cls, heights[size]);',
  '});',
  "it('gates its hover', () => {",
  '  expect(el).toHaveClass(`wave:${GATE}bg-subtle-hover`);',
  "  expectNone(el, ['wave:w-80', 'wave:w-148']);",
  "  for (const word of ['wave:inline-flex', 'wave:items-center']) expect(el).toHaveClass(word);",
  "  expect(el.querySelector('.wave\\\\:sr-only')).toBeNull();",
  "  expect(el.closest('.custom-root')).toBeNull();",
  '  expect(html).toBe(\'<div class="wave-box wave:flex wave:p-4">x</div>\');',
  "  expect(Array.from(el.classList).sort()).toEqual(['wave:gap-1', 'wave:flex'].sort());",
  "  expect(getComputedStyle(el).display).toBe('inline-block');",
  '});',
  "it('models the merge', () => {",
  "  const Own = ({ className }: { className?: string }) => <i className={wcn('wave:flex wave:p-4', className)} />;",
  "  expect(wcn(heights.small, 'text-error')).toContain('text-error');",
  '  render(<Own />);',
  '});',
  "export const unused = 'bg-primary text-foreground';",
  "it.each([16, 24])('box %d', (px) => {",
  '  expect(el.className).toContain(`w-${px / 4}`);',
  '});',
  '',
].join('\n');

const FILES = {
  'src/lib/cn.ts': "export const cn = (...a: unknown[]) => a.join(' ');\nexport const wcn = cn;\n",
  'src/test-utils.ts':
    'export function testSystemProps(_c: unknown, options: { conflictingClass?: { className: string; overrides: string } }) {\n' +
    '  const conflicting = options.conflictingClass!;\n' +
    '  render(<i className={conflicting.className} />);\n' +
    '  expect(el).toHaveClass(conflicting.className);\n' +
    '  expect(el).not.toHaveClass(conflicting.overrides);\n' +
    '}\n',
  'src/components/__tests__/Box.test.tsx': BOX_TEST,
  // A test of the public cn: never migrated.
  'src/lib/__tests__/cn.test.ts':
    "import { cn } from '../cn';\nexpect(cn('px-4', 'px-2')).toBe('px-2');\n",
  // Not a test file: never read.
  'src/components/Box.tsx': "export const Box = () => <i className={'p-4'} />;\n",
};

let project = '';
const read = (path) => readFileSync(join(project, path), 'utf8');
const run = async (argv) => {
  const lines = [];
  const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
  const code = await main(['--root', project, ...argv], { io });
  return { code, lines };
};

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'wave-prefix-tests-'));
  mkdirSync(join(project, 'src/styles'), { recursive: true });
  for (const name of ['theme.css', 'variants.css']) {
    copyFileSync(join(ROOT, 'src/styles', name), join(project, 'src/styles', name));
  }
  for (const [path, content] of Object.entries(FILES)) {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), content);
  }
});

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('prefix-tests-codemod', () => {
  it('reports what it could not classify, with its place', async () => {
    const report = join(project, 'report.json');
    const { code, lines } = await run(['--report', report, 'src']);
    expect(code).toBe(0);
    expect(lines).toEqual([
      expect.stringMatching(
        /^prefix-tests-codemod: \d+ class word\(s\), 1 selector\(s\) and 2 markup word\(s\) prefixed in 1 of 2 file\(s\) \(dry run\); 3 cn rename\(s\); 3 literal\(s\) left for a manual decision$/,
      ),
    ]);
    const { unclassified, perFile } = JSON.parse(readFileSync(report, 'utf8'));
    expect(unclassified).toEqual([
      {
        place: 'src/components/__tests__/Box.test.tsx:28',
        kind: 'subject',
        words: ['inline-block'],
        text: "'inline-block'",
      },
      {
        place: 'src/components/__tests__/Box.test.tsx:35',
        kind: 'untraced',
        words: [],
        text: "'bg-primary text-foreground'",
      },
      {
        place: 'src/components/__tests__/Box.test.tsx:37',
        kind: 'glued',
        words: ['w-${…}'],
        text: '`w-${px / 4}`',
      },
    ]);
    expect(Object.keys(perFile)).toEqual(['src/components/__tests__/Box.test.tsx']);
    // A dry run writes nothing.
    expect(read('src/components/__tests__/Box.test.tsx')).toBe(BOX_TEST);
  }, 60_000);

  it("prefixes Wave's classes and leaves a consumer's, a title's and every other string's", async () => {
    expect((await run(['--write', 'src'])).code).toBe(0);
    expect(read('src/components/__tests__/Box.test.tsx')).toBe(MIGRATED);
    // The tests of the public cn, a helper's own literals-free code and the sources: untouched.
    expect(read('src/lib/__tests__/cn.test.ts')).toBe(FILES['src/lib/__tests__/cn.test.ts']);
    expect(read('src/test-utils.ts')).toBe(FILES['src/test-utils.ts']);
    expect(read('src/components/Box.tsx')).toBe(FILES['src/components/Box.tsx']);
  }, 60_000);

  it('changes nothing on a second run (--check passes)', async () => {
    const { code, lines } = await run(['--check', 'src']);
    expect(lines[0]).toMatch(
      /^prefix-tests-codemod: 0 class word\(s\), 0 selector\(s\) and 0 markup word\(s\) prefixed in 0 of 2 file\(s\) \(check\); 0 cn rename\(s\)/,
    );
    expect(code).toBe(0);
    expect(read('src/components/__tests__/Box.test.tsx')).toBe(MIGRATED);
  }, 60_000);

  it('fails --check while a file still needs the migration', async () => {
    writeFileSync(
      join(project, 'src/components/__tests__/More.test.tsx'),
      "expect(el).toHaveClass('rounded-md');\n",
    );
    try {
      const { code, lines } = await run(['--check', 'src']);
      expect(lines.slice(1)).toEqual(['  src/components/__tests__/More.test.tsx']);
      expect(code).toBe(1);
    } finally {
      rmSync(join(project, 'src/components/__tests__/More.test.tsx'));
    }
  }, 60_000);
});

describe('helpers', () => {
  it('knows the test files and helpers', () => {
    for (const path of [
      'src/components/__tests__/Box.test.tsx',
      'src/test-utils.ts',
      'src/test-utils-field.tsx',
      'src/components/navigation/__tests__/menuHarness.tsx',
    ]) {
      expect(isTestFile(path), path).toBe(true);
    }
    expect(isTestFile('src/components/Box.tsx')).toBe(false);
  });

  it('decodes a JavaScript string with the raw index of each character', () => {
    expect(decodeJsString(String.raw`.a\\:b\n`)).toEqual({
      cooked: '.a\\:b\n',
      map: [0, 1, 2, 4, 5, 6, 8],
    });
  });

  it('finds the class selectors of a selector, unescaped, never in an attribute value', () => {
    expect(selectorClasses(String.raw`div.sr-only > .data-\[x\]\:p-2[data-v="a.b"], .x1`)).toEqual([
      { index: 4, name: 'sr-only' },
      { index: 15, name: 'data-[x]:p-2' },
      { index: 47, name: 'x1' },
    ]);
  });

  it.each([
    [['--write', '--check', 'src'], '--write and --check exclude each other'],
    [['--prefix', 'Wave', 'src'], '--prefix must be a Tailwind prefix'],
    [[], 'no files or directories given'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });
});

describe('the run order, kept negatives and subjects (fix round 1)', () => {
  /** A project with a recipe module, so src can be prefixed by the src codemod. */
  const ORDER_TEST = [
    "import { durations } from '../../lib/styles';",
    "const MAP = { a: 'flex', b: 'grid' } as const;",
    'declare const el: HTMLElement;',
    "it.each(['a', 'b'] as const)('map %s', (key) => {",
    '  expect(el).toHaveClass(`${MAP[key]}`);',
    '  expect(el).not.toHaveClass(`${durations.small}`);',
    '});',
    '',
  ].join('\n');
  const NEGATIVE_TEST = [
    'declare const option: HTMLElement;',
    "it('keeps a negative of a class passed in', () => {",
    '  render(<Group className="flex" />);',
    "  expect(option).not.toHaveClass('flex');",
    "  expect(option).toHaveClass('grid');",
    '});',
    "it('reads an array of other values as no class list', () => {",
    "  expect([option.id, 'grid']).toEqual(['x', 'grid']);",
    '});',
    "it('sets the classes itself', () => {",
    "  option.className = 'start-0 p-2';",
    "  expect(option).toHaveClass('start-0');",
    '});',
    '',
  ].join('\n');
  const SOURCES = {
    'src/lib/cn.ts':
      "export const cn = (...a: unknown[]) => a.join(' ');\nexport const wcn = cn;\n",
    'src/lib/styles.ts': [
      "export const durations = { small: 'duration-wave-slow', large: 'duration-wave-slower' };",
      "export const focusRing = 'focus-visible:outline-2';",
      '',
    ].join('\n'),
    'src/components/__tests__/Order.test.tsx': ORDER_TEST,
    'src/components/__tests__/Negative.test.tsx': NEGATIVE_TEST,
  };
  const makeProject = () => {
    const dir = mkdtempSync(join(tmpdir(), 'wave-prefix-order-'));
    mkdirSync(join(dir, 'src/styles'), { recursive: true });
    for (const name of ['theme.css', 'variants.css']) {
      copyFileSync(join(ROOT, 'src/styles', name), join(dir, 'src/styles', name));
    }
    for (const [path, content] of Object.entries(SOURCES)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    return dir;
  };
  const quiet = () => {
    const lines = [];
    return { lines, io: { log: (line) => lines.push(line), error: (line) => lines.push(line) } };
  };
  const projects = [];
  afterAll(() => {
    for (const dir of projects) rmSync(dir, { recursive: true, force: true });
  });

  it('refuses --write while src is unprefixed, and a dry run warns', async () => {
    const dir = makeProject();
    projects.push(dir);
    const write = quiet();
    expect(await main(['--root', dir, '--write', 'src'], { io: write.io })).toBe(2);
    expect(write.lines).toEqual([
      'prefix-tests-codemod: src is not prefixed yet (src/lib/styles.ts): the flip runs ' +
        'scripts/prefix-codemod.mjs --write over src first, then this tool ' +
        '(--allow-unprefixed-src writes anyway)',
    ]);
    expect(readFileSync(join(dir, 'src/components/__tests__/Order.test.tsx'), 'utf8')).toBe(
      ORDER_TEST,
    );
    const dry = quiet();
    expect(await main(['--root', dir, 'src'], { io: dry.io })).toBe(0);
    expect(dry.lines[0]).toBe(
      'prefix-tests-codemod: warning: src is not prefixed yet (src/lib/styles.ts): the flip runs ' +
        'scripts/prefix-codemod.mjs --write over src first, then this tool',
    );
  }, 60_000);

  it('gives the same tests in either order of the two codemods, never a double prefix', async () => {
    const testsFirst = makeProject();
    const srcFirst = makeProject();
    projects.push(testsFirst, srcFirst);
    const src = ['src/components', 'src/lib', 'src/hooks'].slice(0, 2);
    // Tests first, then src.
    expect(
      await main(['--root', testsFirst, '--write', '--allow-unprefixed-src', 'src'], quiet()),
    ).toBe(0);
    expect(await prefixSrc(['--root', testsFirst, '--write', ...src], quiet())).toBe(0);
    // src first, then the tests.
    expect(await prefixSrc(['--root', srcFirst, '--write', ...src], quiet())).toBe(0);
    expect(await main(['--root', srcFirst, '--write', 'src'], quiet())).toBe(0);
    for (const name of ['Order', 'Negative']) {
      const path = `src/components/__tests__/${name}.test.tsx`;
      expect(readFileSync(join(testsFirst, path), 'utf8'), name).toBe(
        readFileSync(join(srcFirst, path), 'utf8'),
      );
    }
    // The map's values are prefixed where they are written; the substitutions get no prefix.
    expect(readFileSync(join(srcFirst, 'src/components/__tests__/Order.test.tsx'), 'utf8')).toBe(
      ORDER_TEST.replace("{ a: 'flex', b: 'grid' }", "{ a: 'wave:flex', b: 'wave:grid' }"),
    );
    expect(readFileSync(join(srcFirst, 'src/lib/styles.ts'), 'utf8')).toContain(
      "small: 'wave:duration-wave-slow'",
    );
  }, 60_000);

  it('reports a negative assertion a class passed in keeps, and reads subjects by their shape', async () => {
    const dir = makeProject();
    projects.push(dir);
    expect(await prefixSrc(['--root', dir, '--write', 'src/components', 'src/lib'], quiet())).toBe(
      0,
    );
    const report = join(dir, 'report.json');
    expect(await main(['--root', dir, '--write', '--report', report, 'src'], quiet())).toBe(0);
    expect(readFileSync(join(dir, 'src/components/__tests__/Negative.test.tsx'), 'utf8')).toBe(
      NEGATIVE_TEST.replace("toHaveClass('grid')", "toHaveClass('wave:grid')"),
    );
    expect(JSON.parse(readFileSync(report, 'utf8')).unclassified).toEqual([
      {
        place: 'src/components/__tests__/Negative.test.tsx:4',
        kind: 'kept-negative',
        words: ['flex'],
        sites: [
          'src/components/__tests__/Negative.test.tsx:4 (passed in at ' +
            'src/components/__tests__/Negative.test.tsx:3)',
        ],
        text: "'flex'",
      },
    ]);
  }, 60_000);
});
