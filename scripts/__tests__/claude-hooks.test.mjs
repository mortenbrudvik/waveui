// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import {
  afterEdit,
  beforeStop,
  conventionViolations,
  createEditLog,
  eslintProblems,
  isConventionsTarget,
  repoPath,
  sourceTargets,
  testNamePattern,
} from '../claude/hooks.mjs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const hooksScript = fileURLToPath(new URL('../claude/hooks.mjs', import.meta.url));

const ROOT = resolve(tmpdir(), 'waveui-hooks-test', 'wave');
const WORKTREE = resolve(ROOT, '.claude', 'worktrees', 'feature');
const PRETTIER = join('node_modules', 'prettier', 'bin', 'prettier.cjs');
const ESLINT = join('node_modules', 'eslint', 'bin', 'eslint.js');
const VITEST = join('node_modules', 'vitest', 'vitest.mjs');

describe('repoPath', () => {
  it('returns the forward-slash path of a file inside the checkout', () => {
    const file = join(ROOT, 'src', 'components', 'input', 'Switch.tsx');
    expect(repoPath(ROOT, file)).toBe('src/components/input/Switch.tsx');
  });

  it('returns null outside the checkout, including a sibling whose name starts the same', () => {
    expect(repoPath(ROOT, resolve(ROOT, '..', 'wave-docs', 'a.ts'))).toBeNull();
    expect(repoPath(ROOT, resolve(tmpdir(), 'elsewhere', 'a.ts'))).toBeNull();
    expect(repoPath(ROOT, ROOT)).toBeNull();
  });
});

describe('sourceTargets', () => {
  const { format, lint } = sourceTargets(pkg);

  it.each([
    'src/components/input/Switch.tsx',
    'src/hooks/useId.ts',
    'stories/Menu.stories.tsx',
    '.storybook/preview.css',
    '.storybook/main.ts',
    'scripts/verify-dist.mjs',
    'scripts/fixtures/plain/package.json',
  ])('formats %s, as npm run format does', (rel) => {
    expect(format(rel)).toBe(true);
  });

  it.each([
    'README.md',
    'CHANGELOG.md',
    'docs/ROADMAP.md',
    'src/styles/tokens.css',
    'vitest.config.ts',
    'package.json',
    'scripts/fixtures/plain/node_modules/react/index.js',
  ])('leaves %s unformatted, as npm run format does', (rel) => {
    expect(format(rel)).toBe(false);
  });

  it.each([
    'src/components/input/Switch.tsx',
    'src/lib/cn.ts',
    'stories/Button.stories.tsx',
    '.storybook/main.ts',
    'scripts/pack-smoke.mjs',
    'scripts/fixtures/plain/smoke.cjs',
  ])('lints %s, as npm run lint does', (rel) => {
    expect(lint(rel)).toBe(true);
  });

  it.each([
    '.storybook/preview.css',
    'src/styles/tokens.css',
    'vitest.config.ts',
    'docs/WAVE-UI-GUIDE.md',
    'scripts/fixtures/plain/package.json',
    'scripts/fixtures/plain/node_modules/react/index.js',
  ])('does not lint %s, as npm run lint does not', (rel) => {
    expect(lint(rel)).toBe(false);
  });

  it('follows the package scripts instead of a fixed list', () => {
    const narrow = sourceTargets({
      scripts: { format: 'prettier --write "src/**/*.ts"', lint: 'eslint --max-warnings 0 src/' },
    });
    expect(narrow.format('src/lib/cn.ts')).toBe(true);
    expect(narrow.format('src/components/input/Switch.tsx')).toBe(false);
    expect(narrow.lint('src/lib/cn.ts')).toBe(true);
    expect(narrow.lint('stories/Button.stories.tsx')).toBe(false);
  });
});

describe('isConventionsTarget', () => {
  it.each([
    'src/components/navigation/Menu.root.tsx',
    'src/components/input/pickerStyles.ts',
    'stories/Menu.stories.tsx',
  ])('selects %s, which the conventions gate scans', (rel) => {
    expect(isConventionsTarget(rel)).toBe(true);
  });

  it.each([
    'src/components/navigation/__tests__/Menu.test.tsx',
    'src/hooks/useId.ts',
    'src/lib/cn.ts',
    'stories/helpers/fixtures.tsx',
    'src/components/input/README.md',
  ])('skips %s, which the conventions gate does not scan', (rel) => {
    expect(isConventionsTarget(rel)).toBe(false);
  });
});

describe('testNamePattern', () => {
  const pattern = new RegExp(
    testNamePattern(['src/components/navigation/Menu.tsx', 'stories/Menu.stories.tsx']),
  );

  it('matches the full test names of the listed files', () => {
    expect(
      pattern.test('conventions gate: src/components src/components/navigation/Menu.tsx'),
    ).toBe(true);
    expect(pattern.test('conventions gate: stories (raw colors) stories/Menu.stories.tsx')).toBe(
      true,
    );
  });

  it('matches no other file, whatever characters the paths contain', () => {
    expect(
      pattern.test('conventions gate: src/components src/components/navigation/Menu.items.tsx'),
    ).toBe(false);
    expect(
      pattern.test('conventions gate: src/components src/components/navigation/MenuXtsx'),
    ).toBe(false);
    expect(
      pattern.test('conventions gate: src/components src/components/navigation/Menu.tsx.bak'),
    ).toBe(false);
  });
});

describe('eslintProblems', () => {
  const file = join(ROOT, 'src', 'components', 'a', 'A.tsx');
  const results = [
    {
      filePath: file,
      messages: [
        {
          ruleId: 'react-hooks/rules-of-hooks',
          severity: 2,
          message: 'React Hook "useState" is called conditionally.',
          line: 12,
          column: 5,
          nodeType: 'Identifier',
          endLine: 12,
          endColumn: 13,
        },
        {
          ruleId: '@typescript-eslint/no-unused-vars',
          severity: 1,
          message: "'x' is defined but never used.",
          line: 3,
          column: 7,
          nodeType: 'Identifier',
          endLine: 3,
          endColumn: 8,
        },
        {
          ruleId: null,
          fatal: true,
          severity: 2,
          message: "Parsing error: ')' expected.",
          line: 20,
          column: 1,
        },
      ],
      suppressedMessages: [],
      errorCount: 2,
      fatalErrorCount: 1,
      warningCount: 1,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      usedDeprecatedRules: [],
    },
  ];

  it('separates errors from warnings, with the repo path, position and rule of each', () => {
    expect(eslintProblems(results, ROOT)).toEqual({
      errors: [
        'src/components/a/A.tsx:12:5 React Hook "useState" is called conditionally. [react-hooks/rules-of-hooks]',
        "src/components/a/A.tsx:20:1 Parsing error: ')' expected.",
      ],
      warnings: [
        "src/components/a/A.tsx:3:7 'x' is defined but never used. [@typescript-eslint/no-unused-vars]",
      ],
    });
  });
});

/** A Vitest JSON report of the conventions test, shaped as `--reporter=json` writes it. */
function conventionsReport({ failures = {}, skipped = [], fileError } = {}) {
  const failed = Object.entries(failures).map(([title, lines]) => ({
    ancestorTitles: ['conventions gate: src/components'],
    fullName: `conventions gate: src/components ${title}`,
    status: 'failed',
    title,
    duration: 17,
    failureMessages: [
      `AssertionError: \n${lines.join('\n')}\n: expected ${lines.length} to be +0 // Object.is equality\n    at C:/wave/src/__tests__/conventions.test.ts:1724:55`,
    ],
  }));
  const pending = skipped.map((title) => ({
    ancestorTitles: ['conventions gate: src/components'],
    fullName: `conventions gate: src/components ${title}`,
    status: 'skipped',
    title,
    failureMessages: [],
  }));
  return {
    numTotalTestSuites: 1,
    numFailedTests: failed.length,
    numPassedTests: 0,
    numPendingTests: pending.length,
    numTotalTests: failed.length + pending.length,
    success: failed.length === 0 && !fileError,
    testResults: [
      {
        name: 'C:/wave/src/__tests__/conventions.test.ts',
        status: failed.length || fileError ? 'failed' : 'passed',
        message: fileError ?? '',
        assertionResults: fileError ? [] : [...failed, ...pending],
      },
    ],
  };
}

const DIRECTION_LINE =
  "src/components/button/Button.tsx:1 [direction-variant] rtl:ms-2 — use Wave's `wave-rtl:` variant (C-LOGICAL)";
const FOCUS_LINE =
  'src/components/button/Button.tsx:4 [focus-outline-none] focus:outline-none — use `focus:outline-hidden` (C-FOCUS)';

describe('conventionViolations', () => {
  it('returns the violation lines of each failed file', () => {
    const report = conventionsReport({
      failures: { 'src/components/button/Button.tsx': [DIRECTION_LINE, FOCUS_LINE] },
      skipped: ['src/components/button/Link.tsx'],
    });
    expect(conventionViolations(report)).toEqual({ violations: [DIRECTION_LINE, FOCUS_LINE] });
  });

  it('returns nothing for a passing run', () => {
    expect(conventionViolations(conventionsReport({ skipped: ['x.tsx'] }))).toEqual({
      violations: [],
    });
  });

  it('reports a test file that failed before any test ran as an error', () => {
    const report = conventionsReport({ fileError: 'Failed to load url ../components/x.tsx' });
    expect(conventionViolations(report)).toEqual({
      violations: [],
      error: 'Failed to load url ../components/x.tsx',
    });
  });
});

describe('createEditLog', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'waveui-edit-log-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the files of each checkout and session apart, without duplicates', () => {
    const log = createEditLog(dir);
    log.add('s1', ROOT, 'src/components/a/A.tsx');
    log.add('s1', ROOT, 'src/components/a/A.tsx');
    log.add('s1', WORKTREE, 'stories/B.stories.tsx');
    log.add('s2', ROOT, 'src/components/c/C.tsx');
    expect(log.read('s1')).toEqual({
      [ROOT]: ['src/components/a/A.tsx'],
      [WORKTREE]: ['stories/B.stories.tsx'],
    });
    expect(log.read('s2')).toEqual({ [ROOT]: ['src/components/c/C.tsx'] });
    expect(log.read('s3')).toEqual({});
  });

  it('clears one checkout of a session and keeps the rest', () => {
    const log = createEditLog(dir);
    log.add('s1', ROOT, 'src/components/a/A.tsx');
    log.add('s1', WORKTREE, 'stories/B.stories.tsx');
    log.clear('s1', ROOT);
    expect(log.read('s1')).toEqual({ [WORKTREE]: ['stories/B.stories.tsx'] });
    log.clear('s1', WORKTREE);
    expect(log.read('s1')).toEqual({});
    expect(readdirSync(dir)).toEqual([]);
  });

  it('keeps a session id with path characters inside its directory', () => {
    const inner = join(dir, 'inner');
    const log = createEditLog(inner);
    log.add('../../evil', ROOT, 'src/components/a/A.tsx');
    expect(readdirSync(dir)).toEqual(['inner']);
    expect(readdirSync(inner)).toHaveLength(1);
    expect(log.read('../../evil')).toEqual({ [ROOT]: ['src/components/a/A.tsx'] });
  });
});

/**
 * Dependencies of afterEdit/beforeStop with the processes replaced: `run` answers per tool (the
 * script path is the first argument) and records every call; files and checkouts are listed.
 */
function fakeDeps({
  existing = [],
  roots = [ROOT],
  packageName = '@mortenbrudvik/waveui',
  answers = {},
} = {}) {
  const calls = [];
  const logDir = mkdtempSync(join(tmpdir(), 'waveui-hook-deps-'));
  const exists = new Set(existing.map((p) => resolve(p)));
  const deps = {
    exists: (path) => exists.has(resolve(path)),
    // The innermost listed checkout that contains `dir` (a worktree inside the main checkout).
    findRoot: (dir) =>
      roots
        .filter((root) => resolve(dir) === root || resolve(dir).startsWith(root + sep))
        .sort((a, b) => b.length - a.length)[0] ?? null,
    readJson: (path) => {
      if (path.endsWith('package.json')) return { ...pkg, name: packageName };
      try {
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        return null;
      }
    },
    run: (args, { cwd }) => {
      calls.push({ args, cwd });
      const tool = Object.keys(answers).find((name) => args[0].endsWith(name));
      const answer = tool ? answers[tool] : undefined;
      return (
        (typeof answer === 'function' ? answer(args) : answer) ?? {
          status: 0,
          stdout: '',
          stderr: '',
        }
      );
    },
    log: createEditLog(logDir),
    scratchFile: (name) => join(logDir, name),
    remove: (path) => rmSync(path, { force: true }),
  };
  onTestFinished(() => rmSync(logDir, { recursive: true, force: true }));
  return { deps, calls };
}

const eslintJson = (file, messages) =>
  JSON.stringify([
    {
      filePath: file,
      messages,
      suppressedMessages: [],
      errorCount: messages.filter((m) => m.severity === 2).length,
      fatalErrorCount: 0,
      warningCount: messages.filter((m) => m.severity === 1).length,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      usedDeprecatedRules: [],
    },
  ]);

const toolsOf = (root) => [join(root, PRETTIER), join(root, ESLINT), join(root, VITEST)];

describe('afterEdit', () => {
  const switchFile = join(ROOT, 'src', 'components', 'input', 'Switch.tsx');
  const edit = (file) => ({
    session_id: 'session-1',
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: file },
  });

  it('formats and lints an edited component, records it for the stop check and passes it', () => {
    const { deps, calls } = fakeDeps({
      existing: [switchFile, ...toolsOf(ROOT)],
      answers: { 'eslint.js': { status: 0, stdout: eslintJson(switchFile, []), stderr: '' } },
    });
    expect(afterEdit(edit(switchFile), deps)).toEqual({ exitCode: 0 });
    expect(calls).toEqual([
      { args: [join(ROOT, PRETTIER), '--write', switchFile], cwd: ROOT },
      {
        args: [join(ROOT, ESLINT), '--format', 'json', '--no-warn-ignored', switchFile],
        cwd: ROOT,
      },
    ]);
    expect(deps.log.read('session-1')).toEqual({ [ROOT]: ['src/components/input/Switch.tsx'] });
  });

  it('returns lint errors to Claude with exit code 2', () => {
    const { deps } = fakeDeps({
      existing: [switchFile, ...toolsOf(ROOT)],
      answers: {
        'eslint.js': {
          status: 1,
          stdout: eslintJson(switchFile, [
            {
              ruleId: 'react-hooks/rules-of-hooks',
              severity: 2,
              message: 'React Hook "useState" is called conditionally.',
              line: 12,
              column: 5,
            },
          ]),
          stderr: '',
        },
      },
    });
    const result = afterEdit(edit(switchFile), deps);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      'src/components/input/Switch.tsx:12:5 React Hook "useState" is called conditionally. [react-hooks/rules-of-hooks]',
    );
  });

  it('adds lint warnings to the tool result as context, without the error exit code', () => {
    const { deps } = fakeDeps({
      existing: [switchFile, ...toolsOf(ROOT)],
      answers: {
        'eslint.js': {
          status: 0,
          stdout: eslintJson(switchFile, [
            {
              ruleId: '@typescript-eslint/no-unused-vars',
              severity: 1,
              message: "'x' is defined but never used.",
              line: 3,
              column: 7,
            },
          ]),
          stderr: '',
        },
      },
    });
    const result = afterEdit(edit(switchFile), deps);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(output.hookSpecificOutput.additionalContext).toContain(
      "src/components/input/Switch.tsx:3:7 'x' is defined but never used. [@typescript-eslint/no-unused-vars]",
    );
  });

  it('returns the Prettier error of a file it cannot parse with exit code 2', () => {
    const { deps } = fakeDeps({
      existing: [switchFile, ...toolsOf(ROOT)],
      answers: {
        'prettier.cjs': {
          status: 2,
          stdout: '',
          stderr: '[error] src/components/input/Switch.tsx: SyntaxError: Unexpected token (4:1)',
        },
        'eslint.js': { status: 0, stdout: eslintJson(switchFile, []), stderr: '' },
      },
    });
    const result = afterEdit(edit(switchFile), deps);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('SyntaxError: Unexpected token (4:1)');
  });

  it('only formats a Storybook stylesheet and does not record it', () => {
    const css = join(ROOT, '.storybook', 'preview.css');
    const { deps, calls } = fakeDeps({ existing: [css, ...toolsOf(ROOT)] });
    expect(afterEdit(edit(css), deps)).toEqual({ exitCode: 0 });
    expect(calls).toEqual([{ args: [join(ROOT, PRETTIER), '--write', css], cwd: ROOT }]);
    expect(deps.log.read('session-1')).toEqual({});
  });

  it('runs no tool on a file that no npm script covers', () => {
    const doc = join(ROOT, 'docs', 'ROADMAP.md');
    const { deps, calls } = fakeDeps({ existing: [doc, ...toolsOf(ROOT)] });
    expect(afterEdit(edit(doc), deps)).toEqual({ exitCode: 0 });
    expect(calls).toEqual([]);
  });

  it('runs no tool outside a WaveUI checkout', () => {
    const outside = resolve(tmpdir(), 'elsewhere', 'src', 'a.ts');
    const other = fakeDeps({ existing: [outside] });
    expect(afterEdit(edit(outside), other.deps)).toEqual({ exitCode: 0 });
    expect(other.calls).toEqual([]);

    const foreign = fakeDeps({ existing: [switchFile, ...toolsOf(ROOT)], packageName: 'other' });
    expect(afterEdit(edit(switchFile), foreign.deps)).toEqual({ exitCode: 0 });
    expect(foreign.calls).toEqual([]);
  });

  it('runs no tool for a file deleted since the edit', () => {
    const { deps, calls } = fakeDeps({ existing: toolsOf(ROOT) });
    expect(afterEdit(edit(switchFile), deps)).toEqual({ exitCode: 0 });
    expect(calls).toEqual([]);
  });

  it('uses the tools of the checkout that holds the file (a worktree)', () => {
    const file = join(WORKTREE, 'src', 'components', 'input', 'Switch.tsx');
    const { deps, calls } = fakeDeps({
      existing: [file, ...toolsOf(WORKTREE)],
      roots: [ROOT, WORKTREE],
      answers: { 'eslint.js': { status: 0, stdout: eslintJson(file, []), stderr: '' } },
    });
    expect(afterEdit(edit(file), deps)).toEqual({ exitCode: 0 });
    expect(calls.map((call) => [call.args[0], call.cwd])).toEqual([
      [join(WORKTREE, PRETTIER), WORKTREE],
      [join(WORKTREE, ESLINT), WORKTREE],
    ]);
    expect(deps.log.read('session-1')).toEqual({
      [WORKTREE]: ['src/components/input/Switch.tsx'],
    });
  });

  it('reports a checkout without installed tools without blocking', () => {
    const { deps, calls } = fakeDeps({ existing: [switchFile] });
    const result = afterEdit(edit(switchFile), deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('npm ci');
    expect(calls).toEqual([]);
  });

  it('reports an ESLint crash without blocking', () => {
    const { deps } = fakeDeps({
      existing: [switchFile, ...toolsOf(ROOT)],
      answers: { 'eslint.js': { status: 2, stdout: '', stderr: 'Oops! Something went wrong!' } },
    });
    const result = afterEdit(edit(switchFile), deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Oops! Something went wrong!');
  });
});

describe('beforeStop', () => {
  const button = 'src/components/button/Button.tsx';
  const story = 'stories/Button.stories.tsx';
  const stop = (extra = {}) => ({
    session_id: 'session-1',
    hook_event_name: 'Stop',
    stop_hook_active: false,
    ...extra,
  });
  /** A Vitest answer that writes `report` to the `--outputFile=` path it was given. */
  const writesReport =
    (report, status = report.success ? 0 : 1) =>
    (args) => {
      const out = args.find((arg) => arg.startsWith('--outputFile='));
      writeFileSync(out.slice('--outputFile='.length), JSON.stringify(report));
      return { status, stdout: '', stderr: '' };
    };

  it('passes without a run when nothing was edited', () => {
    const { deps, calls } = fakeDeps({ existing: toolsOf(ROOT) });
    expect(beforeStop(stop(), deps)).toEqual({ exitCode: 0 });
    expect(calls).toEqual([]);
  });

  it('does not check again while Claude continues because of this hook', () => {
    const { deps, calls } = fakeDeps({ existing: [join(ROOT, button), ...toolsOf(ROOT)] });
    deps.log.add('session-1', ROOT, button);
    expect(beforeStop(stop({ stop_hook_active: true }), deps)).toEqual({ exitCode: 0 });
    expect(calls).toEqual([]);
  });

  it('returns the violations with exit code 2 and keeps the files for the next stop', () => {
    const { deps, calls } = fakeDeps({
      existing: [join(ROOT, button), join(ROOT, story), ...toolsOf(ROOT)],
      answers: {
        'vitest.mjs': writesReport(conventionsReport({ failures: { [button]: [DIRECTION_LINE] } })),
      },
    });
    deps.log.add('session-1', ROOT, button);
    deps.log.add('session-1', ROOT, story);

    const result = beforeStop(stop(), deps);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(DIRECTION_LINE);
    expect(deps.log.read('session-1')).toEqual({ [ROOT]: [button, story] });
    expect(calls).toHaveLength(1);
    const [script, ...args] = calls[0].args;
    expect(script).toBe(join(ROOT, VITEST));
    expect(calls[0].cwd).toBe(ROOT);
    expect(args.slice(0, 4)).toEqual([
      'run',
      'src/__tests__/conventions.test.ts',
      '--exclude',
      '.claude/**',
    ]);
    const pattern = new RegExp(args[args.indexOf('-t') + 1]);
    expect(pattern.test(`conventions gate: src/components ${button}`)).toBe(true);
    expect(pattern.test(`conventions gate: stories (raw colors) ${story}`)).toBe(true);
    expect(pattern.test('conventions gate: src/components src/components/button/Link.tsx')).toBe(
      false,
    );
    expect(args).toContain('--reporter=json');
  });

  it('clears the files of a checkout that passes', () => {
    const { deps } = fakeDeps({
      existing: [join(ROOT, button), ...toolsOf(ROOT)],
      answers: { 'vitest.mjs': writesReport(conventionsReport({ skipped: ['x.tsx'] })) },
    });
    deps.log.add('session-1', ROOT, button);
    expect(beforeStop(stop(), deps)).toEqual({ exitCode: 0 });
    expect(deps.log.read('session-1')).toEqual({});
  });

  it('checks each checkout with its own Vitest', () => {
    const { deps, calls } = fakeDeps({
      existing: [join(ROOT, button), join(WORKTREE, story), ...toolsOf(ROOT), ...toolsOf(WORKTREE)],
      roots: [ROOT, WORKTREE],
      answers: { 'vitest.mjs': writesReport(conventionsReport({ skipped: ['x.tsx'] })) },
    });
    deps.log.add('session-1', ROOT, button);
    deps.log.add('session-1', WORKTREE, story);
    expect(beforeStop(stop(), deps)).toEqual({ exitCode: 0 });
    expect(calls.map((call) => [call.args[0], call.cwd])).toEqual([
      [join(ROOT, VITEST), ROOT],
      [join(WORKTREE, VITEST), WORKTREE],
    ]);
  });

  it('forgets files deleted since the edit without a run', () => {
    const { deps, calls } = fakeDeps({ existing: toolsOf(ROOT) });
    deps.log.add('session-1', ROOT, button);
    expect(beforeStop(stop(), deps)).toEqual({ exitCode: 0 });
    expect(calls).toEqual([]);
    expect(deps.log.read('session-1')).toEqual({});
  });

  it('reports a run without a report without blocking, and keeps the files', () => {
    const { deps } = fakeDeps({
      existing: [join(ROOT, button), ...toolsOf(ROOT)],
      answers: { 'vitest.mjs': { status: 1, stdout: '', stderr: 'Error: Cannot find module x' } },
    });
    deps.log.add('session-1', ROOT, button);
    const result = beforeStop(stop(), deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Cannot find module x');
    expect(deps.log.read('session-1')).toEqual({ [ROOT]: [button] });
  });
});

describe('hooks.mjs command line', () => {
  const runHook = (args, input) =>
    spawnSync(process.execPath, [hooksScript, ...args], { input, encoding: 'utf8' });

  it('passes an edit outside any checkout without output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'waveui-hook-cli-'));
    try {
      const file = join(dir, 'a.ts');
      writeFileSync(file, 'export const a = 1;\n');
      const result = runHook(
        ['after-edit'],
        JSON.stringify({ session_id: 'cli', tool_input: { file_path: file } }),
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects an unknown command without blocking', () => {
    const result = runHook(['before-lunch'], '{}');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('after-edit');
  });
});
