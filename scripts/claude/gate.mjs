#!/usr/bin/env node
/**
 * The exit gate of a phase (docs/ROADMAP.md §3), run by the /gate skill (.claude/skills/gate).
 *
 * Wave 1 runs the independent checks in parallel: typecheck, lint, format:check, test and
 * build-storybook. Wave 2 then runs the build chain one step at a time: build, verify-dist
 * --final, check:package and test:pack; the last three need the build and are skipped when it
 * fails in the same run. Each step's output goes to `<tmp>/waveui-gate-<time>/<step>.log`.
 *
 * The summary lists every step with its result, time and log, the last lines of each failed log,
 * and the criteria of §3 and CLAUDE.md that a script can check:
 *   - the top version section of CHANGELOG.md (the release in progress: package.json keeps the
 *     last release's version until the release commit) has Added, Changed, Deprecated and Size;
 *   - every exception added since the merge base with `--base`, committed or not (wave-allow-*
 *     markers, eslint-disable directives), states a reason;
 *   - the test output is clean: `test` runs with `--reporter=default`, because Vitest's reporter
 *     for AI agents hides the console output of passing tests, and act() and [WaveUI] warnings
 *     are counted;
 *   - which of README.md, docs/WAVE-UI-GUIDE.md and CLAUDE.md changed since that merge base.
 *
 * Usage: node scripts/claude/gate.mjs [--only <step,…>] [--skip <step,…>] [--base <ref>]
 * Exit code 0 when every planned step passed, 1 otherwise. The documentation criteria are
 * reported, not enforced: a fix round has no Deprecated section, for example.
 *
 * The helpers are exported for scripts/__tests__/claude-gate.test.mjs; importing the module does
 * not run the gate. It starts through verify-dist's `runScript`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScript } from '../verify-dist.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The exit gate of docs/ROADMAP.md §3, in the order the summary lists it. */
const STEPS = [
  { name: 'typecheck', wave: 1, command: ['npm', 'run', 'typecheck'] },
  { name: 'lint', wave: 1, command: ['npm', 'run', 'lint'] },
  { name: 'format:check', wave: 1, command: ['npm', 'run', 'format:check'] },
  { name: 'test', wave: 1, command: ['npm', 'test', '--', '--reporter=default'] },
  { name: 'build-storybook', wave: 1, command: ['npm', 'run', 'build-storybook'] },
  { name: 'build', wave: 2, command: ['npm', 'run', 'build'] },
  {
    name: 'verify-dist',
    wave: 2,
    command: ['node', 'scripts/verify-dist.mjs', '--final'],
    needs: 'build',
  },
  { name: 'check:package', wave: 2, command: ['npm', 'run', 'check:package'], needs: 'build' },
  { name: 'test:pack', wave: 2, command: ['npm', 'run', 'test:pack'], needs: 'build' },
];

const SUBSECTIONS = ['Added', 'Changed', 'Deprecated', 'Size'];
const DOCS = ['README.md', 'docs/WAVE-UI-GUIDE.md', 'CLAUDE.md'];
const TAIL_LINES = 30;

/** The steps to run: all of them, those named in `only`, minus those named in `skip`. */
export function planSteps({ only, skip = [] }) {
  const names = STEPS.map((step) => step.name);
  const unknown = [...(only ?? []), ...skip].filter((name) => !names.includes(name));
  if (unknown.length) {
    throw new Error(`unknown step ${unknown.join(', ')}; the steps are ${names.join(', ')}`);
  }
  return STEPS.filter(
    (step) => (only === undefined || only.includes(step.name)) && !skip.includes(step.name),
  );
}

/**
 * Runs the planned steps: wave 1 in parallel, then wave 2 in order. `runStep(step)` resolves to
 * `{ status, seconds, logFile, tail }`. Results come back in plan order, with `result` `passed`,
 * `failed` or `skipped` (and a `reason`).
 */
export async function runGate(steps, { runStep }) {
  const outcomes = new Map();
  const record = (step, outcome) =>
    outcomes.set(step.name, {
      name: step.name,
      result: outcome.status === 0 ? 'passed' : 'failed',
      seconds: outcome.seconds,
      logFile: outcome.logFile,
      tail: outcome.tail,
    });

  await Promise.all(
    steps.filter((step) => step.wave === 1).map(async (step) => record(step, await runStep(step))),
  );
  for (const step of steps.filter((candidate) => candidate.wave === 2)) {
    const needed = step.needs && outcomes.get(step.needs);
    if (needed && needed.result !== 'passed') {
      outcomes.set(step.name, {
        name: step.name,
        result: 'skipped',
        reason: `${step.needs} failed`,
      });
    } else {
      record(step, await runStep(step));
    }
  }
  return steps.map((step) => outcomes.get(step.name));
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The top `## [version]` section of CHANGELOG.md, the release in progress, and which §3
 * subsections it lacks.
 */
export function changelogCriteria(changelog) {
  const heading = /^## \[([^\]]+)\]/m.exec(changelog);
  if (!heading) return { version: null, section: false, missing: [...SUBSECTIONS] };
  const rest = changelog.slice(heading.index + 1);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const missing = SUBSECTIONS.filter(
    (name) => !new RegExp(`^### ${escapeRegExp(name)}\\b`, 'm').test(section),
  );
  return { version: heading[1], section: true, missing };
}

const MARKER = /wave-allow-(color|physical|motion)(?::([^\n]*))?/g;
const ESLINT_DISABLE = /eslint-disable(?:-next-line|-line)?\b(.*)$/;

/**
 * The exceptions that lines added in a unified diff make without a reason, as `file:line …`:
 * a wave-allow-* marker without text after its colon (up to a closing comment), and an
 * eslint-disable directive without the `-- <reason>` that C-HOOKS requires.
 */
export function exceptionProblems(diff) {
  const problems = [];
  let file = null;
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      file = text.slice(4).replace(/^b\//, '');
    } else if (text.startsWith('@@')) {
      line = Number(/\+(\d+)/.exec(text)?.[1] ?? 0);
    } else if (text.startsWith('+')) {
      const kinds = new Set();
      for (const [, kind, after] of text.matchAll(MARKER)) {
        const reason = (after ?? '').replace(/\*\/.*$/, '').trim();
        if (!reason) kinds.add(kind);
      }
      for (const kind of kinds) problems.push(`${file}:${line} wave-allow-${kind} has no reason`);
      const disable = ESLINT_DISABLE.exec(text);
      if (disable && !/\s--\s*\S/.test(disable[1])) {
        problems.push(`${file}:${line} eslint-disable has no \`-- reason\``);
      }
      line += 1;
    } else if (!text.startsWith('-') && !text.startsWith('\\')) {
      line += 1;
    }
  }
  return problems;
}

/** Untracked files (`{ path, content }`) as a diff that adds every line, for exceptionProblems. */
export function untrackedAsDiff(files) {
  return files
    .map(({ path, content }) => {
      const lines = content.replace(/\n$/, '').split('\n');
      return [`+++ b/${path}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join(
        '\n',
      );
    })
    .join('\n');
}

/** ANSI escape sequences (ESC `[` … letter), built from a string: tools ignore NO_COLOR at times. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');
const stripAnsi = (text) => text.replace(ANSI, '');

/** A console header of Vitest's default reporter: `stderr | <file> > <describe> > <test>`. */
const CONSOLE_HEADER = /^(?:stdout|stderr) \| (.+)$/;

/**
 * The act() and [WaveUI] warnings in a test log written with `--reporter=default`, with up to
 * five examples named after the test that printed them.
 */
export function testOutputWarnings(log) {
  let act = 0;
  let waveui = 0;
  let test = null;
  const examples = [];
  for (const line of stripAnsi(log).split('\n')) {
    const header = CONSOLE_HEADER.exec(line);
    if (header) {
      test = header[1];
      continue;
    }
    const isAct = line.includes('not wrapped in act(');
    const isWaveUI = line.includes('[WaveUI]');
    if (isAct) act += 1;
    if (isWaveUI) waveui += 1;
    if ((isAct || isWaveUI) && examples.length < 5) {
      examples.push(`${test ?? 'unknown test'}: ${line.trim()}`);
    }
  }
  return { act, waveui, examples };
}

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The markdown summary of a gate run: results, failed log tails and documentation criteria. */
export function formatSummary(results, docs) {
  const failed = results.filter((result) => result.result === 'failed');
  const title = failed.length
    ? `## Gate FAILED (${failed.length} of ${results.length} steps failed)`
    : `## Gate PASSED (${results.length} steps)`;
  const rows = results.map((result) =>
    result.result === 'skipped'
      ? `| ${result.name} | skipped (${result.reason}) | – | – |`
      : `| ${result.name} | ${result.result} | ${Math.round(result.seconds)} s | ${result.logFile} |`,
  );
  const tails = failed.flatMap((result) => [
    '',
    `### ${result.name} failed: last lines of ${result.logFile}`,
    '',
    '```',
    result.tail ?? '',
    '```',
  ]);
  const { changelog, testOutput } = docs;
  const changelogLine = !changelog.section
    ? '- CHANGELOG.md has no `## [x.y.z]` version section'
    : changelog.missing.length
      ? `- CHANGELOG.md [${changelog.version}] (the top section) lacks: ${changelog.missing.join(', ')}`
      : `- CHANGELOG.md [${changelog.version}] (the top section) has Added, Changed, Deprecated and Size`;
  const exceptionLines = docs.exceptions.length
    ? [
        `- Exceptions without a reason since ${docs.base}:`,
        ...docs.exceptions.map((problem) => `  - ${problem}`),
      ]
    : [`- Exceptions added since ${docs.base} (wave-allow markers, eslint-disable) state a reason`];
  const testLines = !testOutput
    ? []
    : testOutput.act + testOutput.waveui === 0
      ? ['- Test output is clean: no act() or [WaveUI] warnings']
      : [
          `- Test output: ${plural(testOutput.act, 'act() warning')} and ` +
            `${plural(testOutput.waveui, '[WaveUI] warning')} (CLAUDE.md Testing wants none), e.g.:`,
          ...testOutput.examples.map((example) => `  - ${example}`),
        ];
  const changedLine =
    `- Changed since ${docs.base}: ${docs.changedDocs.join(', ') || 'none'}` +
    (docs.unchangedDocs.length ? `; unchanged: ${docs.unchangedDocs.join(', ')}` : '');
  return [
    title,
    '',
    '| Step | Result | Time | Log |',
    '|---|---|---|---|',
    ...rows,
    ...tails,
    '',
    '### Documentation and output criteria (docs/ROADMAP.md §3, CLAUDE.md)',
    '',
    changelogLine,
    ...exceptionLines,
    ...testLines,
    changedLine,
    '',
  ].join('\n');
}

/** Runs one step in `cwd`, writing its output to a log in `logDir`. */
function spawnStep(step, { cwd, logDir }) {
  return new Promise((resolveStep) => {
    const started = Date.now();
    const logFile = join(logDir, `${step.name.replace(/[^\w-]/g, '-')}.log`);
    const log = createWriteStream(logFile);
    const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
    const [command, ...args] = step.command;
    // npm is a shell script (npm.cmd on Windows), so npm steps run through a shell, as one fixed
    // command line of STEPS: there is nothing to escape.
    const child =
      command === 'node'
        ? spawn(process.execPath, args, { cwd, env })
        : spawn(step.command.join(' '), { cwd, env, shell: true });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const finish = (status, error) => {
      if (error) log.write(`\n${error}\n`);
      log.end(() => {
        const lines = stripAnsi(readFileSync(logFile, 'utf8')).trimEnd().split('\n');
        resolveStep({
          status,
          seconds: (Date.now() - started) / 1000,
          logFile,
          tail: lines.slice(-TAIL_LINES).join('\n'),
        });
      });
    };
    child.on('error', (error) => finish(1, error));
    child.on('close', (code) => finish(code ?? 1));
  });
}

const git = (args) => {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : null;
};

const SCANNED = ['src', 'stories', '.storybook'];
const lines = (text) => (text ?? '').split('\n').filter(Boolean);

/**
 * The documentation and output criteria of the checkout, against the merge base with `base`,
 * and the test output of `testLog` (the log of the `test` step, when it ran).
 */
function docsCriteria(base, testLog) {
  const changelog = changelogCriteria(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'));
  const testOutput = testLog ? testOutputWarnings(readFileSync(testLog, 'utf8')) : null;
  const mergeBase = git(['merge-base', base, 'HEAD'])?.trim();
  if (!mergeBase) {
    return {
      base,
      changelog,
      testOutput,
      exceptions: [`no merge base with ${base}: exceptions not checked`],
      changedDocs: [],
      unchangedDocs: DOCS,
    };
  }
  const diff = git(['diff', '--unified=0', '--no-color', mergeBase, '--', ...SCANNED]) ?? '';
  const untracked = lines(
    git(['ls-files', '--others', '--exclude-standard', '--', ...SCANNED]),
  ).map((path) => ({ path, content: readFileSync(join(root, path), 'utf8') }));
  const changed = lines(git(['diff', '--name-only', mergeBase, '--', ...DOCS]));
  return {
    base,
    changelog,
    testOutput,
    exceptions: exceptionProblems(`${diff}\n${untrackedAsDiff(untracked)}`),
    changedDocs: DOCS.filter((doc) => changed.includes(doc)),
    unchangedDocs: DOCS.filter((doc) => !changed.includes(doc)),
  };
}

/** `--name value` and `--name=value` options. */
function option(argv, name) {
  const index = argv.findIndex((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index === -1) return undefined;
  return argv[index].includes('=') ? argv[index].split('=').slice(1).join('=') : argv[index + 1];
}

const list = (value) =>
  value
    ?.split(',')
    .map((name) => name.trim())
    .filter(Boolean);

async function main() {
  const argv = process.argv.slice(2);
  let steps;
  try {
    steps = planSteps({ only: list(option(argv, 'only')), skip: list(option(argv, 'skip')) });
  } catch (error) {
    console.error(`gate: ${error.message}`);
    return 1;
  }
  const base = option(argv, 'base') ?? 'main';
  const logDir = join(tmpdir(), `waveui-gate-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(logDir, { recursive: true });
  console.log(`gate: ${steps.map((step) => step.name).join(', ')} in ${root}; logs in ${logDir}`);
  const results = await runGate(steps, {
    runStep: (step) => spawnStep(step, { cwd: root, logDir }),
  });
  const testLog = results.find((result) => result.name === 'test' && result.logFile)?.logFile;
  console.log(formatSummary(results, docsCriteria(base, testLog)));
  return results.some((result) => result.result === 'failed') ? 1 : 0;
}

await runScript(import.meta.url, main);
