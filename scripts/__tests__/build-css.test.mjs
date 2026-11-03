// @vitest-environment node
/**
 * Unit tests of `scripts/build-css.mjs` helpers that have no fixture compile of their own, and
 * what `dist/styles.css` ships of the theme-independent tokens. The gate assertions and the other
 * compiles of the real style entries are tested in `src/styles/__tests__/tokens.test.ts`
 * ("scripts/build-css.mjs — gate assertions").
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  assertPrefixedCss,
  assertStylesCss,
  bareDirectionClasses,
  compileCheck,
  compileCheckSummary,
  main,
  readUtilityPrefix,
  utilityPrefixOf,
} from '../build-css.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** What build-css prints while UTILITY_PREFIX is empty. */
const SKIPPED_COMPILE_CHECK =
  'build-css: compile check skipped (UTILITY_PREFIX in src/lib/cn.ts is empty)';

describe('bareDirectionClasses (C-LOGICAL)', () => {
  it("lists the classes with Tailwind's rtl:/ltr: variant, compound and negated forms included", () => {
    const css = [
      String.raw`.rtl\:ms-2:where(:dir(rtl),[dir=rtl],[dir=rtl] *){margin-inline-start:.5rem}`,
      String.raw`.ltr\:me-2:where(:dir(ltr),[dir=ltr],[dir=ltr] *){margin-inline-end:.5rem}`,
      String.raw`.hover\:rtl\:pe-2:hover:where([dir=rtl] *){padding-inline-end:.5rem}`,
      String.raw`.rtl\:hover\:rotate-180:where([dir=rtl] *):hover{rotate:180deg}`,
      String.raw`.not-rtl\:ps-2:not(:where([dir=rtl] *)){padding-inline-start:.5rem}`,
      String.raw`.group-hover\:not-ltr\:ms-1:is(:where(.group):hover *):not(:where([dir=ltr] *)){margin-inline-start:.25rem}`,
    ].join('');
    expect(bareDirectionClasses(css)).toEqual([
      'group-hover:not-ltr:ms-1',
      'hover:rtl:pe-2',
      'ltr:me-2',
      'not-rtl:ps-2',
      'rtl:hover:rotate-180',
      'rtl:ms-2',
    ]);
  });

  it("accepts Wave's wave-rtl: variant and classes that only mention a direction", () => {
    const css = [
      String.raw`@supports selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where(:dir(rtl)){scale:-1 1}}`,
      String.raw`.hover\:wave-rtl\:pe-2:hover:where(:dir(rtl)){padding-inline-end:.5rem}`,
      String.raw`.data-\[dir\=rtl\]\:ms-2[data-dir=rtl]{margin-inline-start:.5rem}`,
      String.raw`.icon-rtl{scale:-1 1}`,
      String.raw`.ltr-start{text-align:start}`,
    ].join('');
    expect(bareDirectionClasses(css)).toEqual([]);
  });
});

describe('dist/styles.css — motion tokens', () => {
  /** Fluent's motion tokens: name → milliseconds (durations) or the bezier numbers (curves). */
  const DURATIONS = {
    'ultra-fast': 50,
    faster: 100,
    fast: 150,
    normal: 200,
    gentle: 250,
    slow: 300,
    slower: 400,
    'ultra-slow': 500,
  };
  const CURVES = {
    'accelerate-max': [0.9, 0.1, 1, 0.2],
    'accelerate-mid': [1, 0, 1, 1],
    'accelerate-min': [0.8, 0, 0.78, 1],
    'decelerate-max': [0.1, 0.9, 0.2, 1],
    'decelerate-mid': [0, 0, 0, 1],
    'decelerate-min': [0.33, 0, 0.1, 1],
    'easy-ease-max': [0.8, 0, 0.2, 1],
    'easy-ease': [0.33, 0, 0.67, 1],
    linear: [0, 0, 1, 1],
  };

  /** The values of the declarations of `name` in `css` (minified: `name:value` to `;` or `}`). */
  function declared(css, name) {
    return [...css.matchAll(new RegExp(`(?<=[{;\\s])${name}:([^;}]*)`, 'g'))].map((m) => m[1]);
  }

  function toMs(value) {
    const match = /^([\d.]+)(ms|s)$/.exec(value.trim());
    if (!match) return Number.NaN;
    return Math.round(Number(match[1]) * (match[2] === 's' ? 1000 : 1));
  }

  it('declares the 17 variables once each, with their values', () => {
    const out = mkdtempSync(join(tmpdir(), 'wave-build-css-motion-'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(main(['--out-dir', out])).toBe(0);
      expect(error).not.toHaveBeenCalled();
      // The compile check's line (the prefix is on since the flip) and the report.
      expect(log.mock.calls).toEqual([
        [
          expect.stringMatching(
            /^build-css: compile check passed \(prefix wave: \d+ class words in \d+ files, \d+ allowlisted pairs\)$/,
          ),
        ],
        [expect.stringMatching(/^build-css: .* OK$/)],
      ]);
      const css = readFileSync(join(out, 'styles.css'), 'utf8');
      const durations = Object.fromEntries(
        Object.keys(DURATIONS).map((name) => [
          name,
          declared(css, `--wave-duration-${name}`).map(toMs),
        ]),
      );
      expect(durations).toEqual(
        Object.fromEntries(Object.entries(DURATIONS).map(([name, ms]) => [name, [ms]])),
      );
      const curves = Object.fromEntries(
        Object.keys(CURVES).map((name) => [
          name,
          declared(css, `--wave-curve-${name}`).map((value) =>
            /^cubic-bezier\(([^)]*)\)$/.exec(value.trim())?.[1].split(',').map(Number),
          ),
        ]),
      );
      expect(curves).toEqual(
        Object.fromEntries(Object.entries(CURVES).map(([name, numbers]) => [name, [numbers]])),
      );
    } finally {
      log.mockRestore();
      error.mockRestore();
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('the utility prefix (Phase 14 spec R6)', () => {
  it('reads UTILITY_PREFIX from the text of src/lib/cn.ts', () => {
    expect(readUtilityPrefix("export const UTILITY_PREFIX: string = '';\n")).toBe('');
    expect(readUtilityPrefix("/** x */\nexport const UTILITY_PREFIX: string = 'wave';\n")).toBe(
      'wave',
    );
    expect(readUtilityPrefix('export const UTILITY_PREFIX = "wave";')).toBe('wave');
    // The repository's own declaration is readable (and empty until the flip).
    expect(utilityPrefixOf(ROOT)).toBe(
      readUtilityPrefix(readFileSync(join(ROOT, 'src/lib/cn.ts'), 'utf8')),
    );
  });

  it.each([
    ['no declaration', 'export const PREFIX = "";'],
    ['two declarations', "export const UTILITY_PREFIX = '';\nexport const UTILITY_PREFIX = '';"],
    ['an expression', "export const UTILITY_PREFIX: string = process.env.P ?? '';"],
  ])('refuses %s, so the check is never skipped by accident', (_, source) => {
    expect(() => readUtilityPrefix(source)).toThrow(/must declare `export const UTILITY_PREFIX/);
  });

  it('refuses a value that is no Tailwind prefix', () => {
    expect(() => readUtilityPrefix("export const UTILITY_PREFIX: string = 'Wave-';")).toThrow(
      /no Tailwind prefix/,
    );
  });

  it('has no prefix for a project without src/lib/cn.ts (the fixtures of the tests)', () => {
    const project = mkdtempSync(join(tmpdir(), 'wave-build-css-noprefix-'));
    try {
      expect(utilityPrefixOf(project)).toBeUndefined();
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

describe('the compile check (Phase 14 spec R6)', () => {
  /** A project with the real theme and variants, a prefix and the given sources. */
  let project = '';
  const write = (path, content) => {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), content);
  };
  const CN =
    "export const UTILITY_PREFIX: string = 'wave';\nexport const wcn = (...a: unknown[]) => a.join(' ');\n";
  const BOX = [
    "import { wcn } from '../lib/cn';",
    'export function Box({ fixed }: { fixed?: boolean }) {',
    "  const position = { position: 'relative' as const };",
    "  return <i style={position} className={wcn('wave:flex wave:relative', fixed && 'wave:p-2')} />;",
    '}',
    '',
  ].join('\n');

  beforeAll(() => {
    project = mkdtempSync(join(tmpdir(), 'wave-build-css-prefix-'));
    mkdirSync(join(project, 'src/styles'), { recursive: true });
    for (const name of ['theme.css', 'variants.css']) {
      copyFileSync(join(ROOT, 'src/styles', name), join(project, 'src/styles', name));
    }
    write('src/lib/cn.ts', CN);
    write('scripts/prefix-allowlist.json', '{ "src/components/Box.tsx": ["relative"] }\n');
  });

  afterAll(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('passes prefixed classes, and a word the allowlist names for its file elsewhere', () => {
    write('src/components/Box.tsx', BOX);
    const result = compileCheck(project, 'wave');
    expect(result).toEqual({
      ok: true,
      lines: [
        expect.stringMatching(
          /^prefix-codemod --check: 0 unprefixed word\(s\) in class contexts; 0 wave: word\(s\) that compile to nothing; 0 outside the allowlist/,
        ),
      ],
    });
    expect(compileCheckSummary(result.lines, 'wave')).toBe(
      'prefix wave: 3 class words in 2 files, 1 allowlisted pairs',
    );
  }, 60_000);

  it('says in one line that the compile check passed, before the build goes on', () => {
    write('src/components/Box.tsx', BOX);
    const printed = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args) => printed.push(args));
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => printed.push(args));
    try {
      // No dist: after the check, the outputs are missing.
      expect(main(['--check-only'], { projectRoot: project })).toBe(1);
      const lines = printed.map((args) => args.join(' '));
      expect(lines[0]).toBe(
        'build-css: compile check passed (prefix wave: 3 class words in 2 files, 1 allowlisted pairs)',
      );
      expect(lines.slice(1).every((line) => /does not exist/.test(line))).toBe(true);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  }, 60_000);

  it('fails an unprefixed relative in a wcn call although the style object allows relative', () => {
    write(
      'src/components/Box.tsx',
      BOX.replace("'wave:flex wave:relative'", "'wave:flex relative'"),
    );
    const result = compileCheck(project, 'wave');
    expect(result.ok).toBe(false);
    expect(result.lines.slice(1)).toEqual(['  src/components/Box.tsx:4 relative']);
  }, 60_000);

  it("fails a new 'fixed' in a file the allowlist does not name for it", () => {
    write('src/components/Box.tsx', `${BOX}export const strategy = 'fixed';\n`);
    const result = compileCheck(project, 'wave');
    expect(result.ok).toBe(false);
    expect(result.lines.slice(1)).toEqual(['  src/components/Box.tsx:6 fixed']);
  }, 60_000);

  // No `@source` of styles.css scans src/hooks: a class written there would ship no CSS.
  it('reads src/hooks too, where a prefixed word fails and an unprefixed one needs the allowlist', () => {
    write('src/components/Box.tsx', BOX);
    write(
      'src/hooks/useThing.ts',
      "export const strategy = 'fixed';\nexport const look = 'wave:flex';\n",
    );
    try {
      const result = compileCheck(project, 'wave');
      expect(result.ok).toBe(false);
      expect(result.lines.slice(1)).toEqual([
        '  src/hooks/useThing.ts:2 wave:flex (in src/hooks, which the CSS build does not scan: it compiles to nothing)',
        '  src/hooks/useThing.ts:1 fixed',
      ]);
    } finally {
      rmSync(join(project, 'src/hooks'), { recursive: true, force: true });
    }
  }, 60_000);

  it('stops build-css before any compile on a finding', () => {
    write(
      'src/components/Box.tsx',
      BOX.replace("'wave:flex wave:relative'", "'flex wave:relative'"),
    );
    const printed = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args) => printed.push(args));
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => printed.push(args));
    try {
      expect(main(['--check-only'], { projectRoot: project })).toBe(1);
      expect(printed.map((args) => args.join(' '))).toEqual([
        'build-css: the compile check failed (prefix wave):',
        expect.stringMatching(
          /^ {2}prefix-codemod --check: 1 unprefixed word\(s\) in class contexts/,
        ),
        '    src/components/Box.tsx:4 flex',
      ]);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  }, 60_000);

  it('is skipped, with one line, while the prefix is empty', () => {
    write('src/lib/cn.ts', "export const UTILITY_PREFIX: string = '';\n");
    write('src/components/Box.tsx', BOX.replace("'wave:flex wave:relative'", "'flex relative'"));
    const printed = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args) => printed.push(args));
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => printed.push(args));
    try {
      // No dist: the outputs are missing, after the line that says the check was skipped.
      expect(main(['--check-only'], { projectRoot: project })).toBe(1);
      const lines = printed.map((args) => args.join(' '));
      expect(lines[0]).toBe(SKIPPED_COMPILE_CHECK);
      expect(lines.slice(1)).toEqual(
        ['styles', 'components', 'utilities', 'preflight'].map((name) =>
          expect.stringMatching(new RegExp(`^build-css: .*${name}\\.css does not exist`)),
        ),
      );
    } finally {
      log.mockRestore();
      error.mockRestore();
      write('src/lib/cn.ts', CN);
    }
  });
});

describe('the prefixed styles.css assertions (Phase 14 spec R6)', () => {
  // A token whose name a prefixed theme key takes (`--shadow-4` under `wave`), as in tokens.css.
  const TOKENS =
    ':root, .wave-light { --wave-primary: #0f6cbd; --wave-shadow-4: 0 0 2px #0003; }\n' +
    '.wave-dark { color-scheme: dark; }';
  const BASE = '.wave-root, .wave-portal { color: var(--wave-foreground); }';
  const PREFIXED = [
    '@layer properties{@supports ((-webkit-hyphens:none)){*,:before,:after{--tw-border-style:solid}}}',
    ':root,.wave-light{--wave-primary:#0f6cbd}',
    '.wave-dark{color-scheme:dark}',
    '.wave-root,.wave-portal{color:var(--wave-foreground)}',
    String.raw`.wave\:bg-primary{background-color:var(--wave-primary)}`,
    String.raw`.wave\:\[--option-bg\:transparent\]{--option-bg:transparent}`,
    String.raw`.wave\:data-\[active\]\:\[--option-bg\:var\(--wave-subtle-hover\)\][data-active]{--option-bg:var(--wave-subtle-hover)}`,
    String.raw`.wave\:\[--wave-card-padding\:1rem\]{--wave-card-padding:1rem}`,
    '@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}',
  ].join('');
  const check = (css) =>
    assertPrefixedCss(css, { prefix: 'wave', tokensCss: TOKENS, baseCss: BASE });

  it('passes prefixed utilities, the style entries’ own classes and the allowed custom properties', () => {
    expect(check(PREFIXED)).toEqual([]);
  });

  it('fails a class without the prefix', () => {
    expect(
      check(`${PREFIXED}.bg-primary{background-color:var(--wave-primary)}.p-2{padding:.5rem}`),
    ).toEqual([
      'styles.css: holds classes without the utility prefix wave: (is the sheet built with ' +
        'prefix(wave)?): bg-primary p-2',
    ]);
  });

  it('fails a theme variable under any name (the needles of FORBIDDEN cannot see one prefixed)', () => {
    const leaked =
      ':root,:host{--wave-spacing:.25rem;--color-primary:var(--wave-primary);' +
      '--wave-shadow-4:var(--wave-shadow-4)}' +
      String.raw`.wave\:p-2{--wave-gap:1px;padding:.5rem}`;
    expect(check(PREFIXED + leaked)).toEqual([
      'styles.css: declares custom properties that are no token, no --tw-* property and no ' +
        'arbitrary property of a utility (theme variables?): --color-primary, --wave-gap, ' +
        '--wave-spacing',
      'styles.css: declares custom properties that refer to themselves (a theme key emitted ' +
        'under the prefix: has theme.css lost `reference`?): --wave-shadow-4',
    ]);
  });

  it('fails the self-reference a theme key leaves under the prefix, though its name is a token', () => {
    // theme.css without `reference`, built with prefix(wave): `--shadow-4` becomes the token's
    // own name and refers to itself (spike check 5).
    const leaked = ':root,:host{--wave-shadow-4:var(--wave-shadow-4)}';
    expect(check(PREFIXED + leaked)).toEqual([
      'styles.css: declares custom properties that refer to themselves (a theme key emitted ' +
        'under the prefix: has theme.css lost `reference`?): --wave-shadow-4',
    ]);
    // The token's own declaration is no self-reference.
    expect(check(`${PREFIXED}:root{--wave-shadow-4:0 0 2px #0003}`)).toEqual([]);
  });

  it('runs only with a prefix, and the required utilities are looked up with it', () => {
    const errors = assertStylesCss(PREFIXED, { tokensCss: TOKENS, baseCss: BASE, prefix: 'wave' });
    expect(errors).toContain('styles.css: missing utility .wave:text-body-1');
    expect(errors).not.toContain('styles.css: missing utility .wave:bg-primary');
    // Without the prefix none of it runs: the unprefixed names are required, nothing else.
    const unprefixed = assertStylesCss(PREFIXED, { tokensCss: TOKENS, baseCss: BASE });
    expect(unprefixed).toContain('styles.css: missing utility .bg-primary');
    expect(unprefixed.filter((error) => /utility prefix|custom properties/.test(error))).toEqual(
      [],
    );
  });
});
