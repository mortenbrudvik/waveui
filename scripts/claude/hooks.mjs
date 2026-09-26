#!/usr/bin/env node
/**
 * The Claude Code hooks of this repository, wired in .claude/settings.json.
 *
 * `after-edit` (PostToolUse on Edit|Write) formats the edited file with Prettier when
 * `npm run format` covers it and lints it with ESLint when `npm run lint` covers it (both read from
 * package.json), with the tools of the checkout that holds the file: an edit in a worktree under
 * .claude/worktrees/ uses that worktree's node_modules. ESLint errors and a file Prettier cannot
 * parse go back to Claude with exit code 2. Warnings are added to the tool result as context
 * instead: `npm run lint` fails on them too, but an edit in progress often has an unused import
 * for a moment. Files the conventions gate scans are recorded per session for `before-stop`.
 *
 * `before-stop` (Stop) runs src/__tests__/conventions.test.ts for the files recorded in this
 * session, once per checkout with that checkout's Vitest, and blocks the stop with the violations
 * (exit code 2). A checkout that passes is forgotten; failing files are kept for the next stop. It
 * does not check again while Claude continues because of it (`stop_hook_active`).
 *
 * Problems of the tooling itself (tools not installed, a crash) exit 1, which Claude Code shows
 * without blocking.
 *
 * Usage: node scripts/claude/hooks.mjs after-edit|before-stop < hook-input.json
 *
 * The helpers are exported for scripts/__tests__/claude-hooks.test.mjs; importing the module does
 * not run a hook. It starts through verify-dist's `runScript`.
 */
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { runScript } from '../verify-dist.mjs';

const PACKAGE_NAME = '@mortenbrudvik/waveui';
const CONVENTIONS_TEST = 'src/__tests__/conventions.test.ts';
/** Longest tool output passed on to Claude, in lines. */
const MAX_LINES = 40;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clip = (text) => {
  const lines = String(text).trimEnd().split('\n');
  return lines.length > MAX_LINES
    ? [...lines.slice(0, MAX_LINES), `… ${lines.length - MAX_LINES} more lines`].join('\n')
    : lines.join('\n');
};

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** The forward-slash path of `file` inside `root`, or null for a file outside it (or `root`). */
export function repoPath(root, file) {
  const rel = relative(root, file);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

/** A glob of the package scripts (`**`, `*`, `?` and `{a,b}`) as an anchored regular expression. */
function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    const end = ch === '{' ? glob.indexOf('}', i) : -1;
    if (ch === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
      source += '(?:.*/)?';
      i += 2;
    } else if (ch === '*' && glob[i + 1] === '*') {
      source += '.*';
      i += 1;
    } else if (ch === '*') source += '[^/]*';
    else if (ch === '?') source += '[^/]';
    else if (end !== -1) {
      source += `(?:${glob
        .slice(i + 1, end)
        .split(',')
        .map(escapeRegExp)
        .join('|')})`;
      i = end;
    } else source += escapeRegExp(ch);
  }
  return new RegExp(`^${source}$`);
}

const LINTABLE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const inNodeModules = (rel) => rel.split('/').includes('node_modules');

/**
 * Which repo paths `npm run format` and `npm run lint` cover: the quoted globs of the `format`
 * script, and the directories the `lint` script passes to ESLint (for the file types ESLint lints).
 */
export function sourceTargets(pkg) {
  const formatGlobs = [...(pkg.scripts?.format ?? '').matchAll(/"([^"]+)"/g)].map(([, glob]) =>
    globToRegExp(glob),
  );
  const lintDirs = (pkg.scripts?.lint ?? '')
    .split(/\s+/)
    .slice(1)
    .filter((token) => token && !token.startsWith('-') && !/^\d+$/.test(token))
    .map((dir) => (dir.endsWith('/') ? dir : `${dir}/`));
  return {
    format: (rel) => !inNodeModules(rel) && formatGlobs.some((glob) => glob.test(rel)),
    lint: (rel) =>
      !inNodeModules(rel) && LINTABLE.test(rel) && lintDirs.some((dir) => rel.startsWith(dir)),
  };
}

/**
 * Whether the conventions gate scans the file: every source of src/components (tests excluded)
 * and every stories/*.stories.tsx — the globs of src/__tests__/conventions.test.ts.
 */
export function isConventionsTarget(rel) {
  return (
    (/^src\/components\/.+\.tsx?$/.test(rel) && !rel.split('/').includes('__tests__')) ||
    /^stories\/[^/]+\.stories\.tsx$/.test(rel)
  );
}

/**
 * A Vitest `-t` pattern that selects the gate's test of each listed file: the gate names one test
 * per file after its repo path, and Vitest matches the pattern against `<describe> <test name>`.
 */
export function testNamePattern(rels) {
  return `(?:^| )(?:${rels.map(escapeRegExp).join('|')})$`;
}

/** ESLint `--format json` results as `path:line:column message [rule]` lines, by severity. */
export function eslintProblems(results, root) {
  const errors = [];
  const warnings = [];
  for (const result of results) {
    const rel = repoPath(root, result.filePath) ?? result.filePath;
    for (const message of result.messages) {
      const rule = message.ruleId ? ` [${message.ruleId}]` : '';
      const line = `${rel}:${message.line ?? 0}:${message.column ?? 0} ${message.message}${rule}`;
      (message.severity === 2 ? errors : warnings).push(line);
    }
  }
  return { errors, warnings };
}

/** A violation line of the gate: `file:line [rule] text — fix`. */
const VIOLATION = /^\S.*:\d+ \[[\w-]+\] /;

/**
 * The violations in a Vitest `--reporter=json` report of the conventions test, or the error of a
 * test file that failed before any of its tests ran.
 */
export function conventionViolations(report) {
  const violations = [];
  for (const file of report.testResults ?? []) {
    const failed = (file.assertionResults ?? []).filter((test) => test.status === 'failed');
    if (file.status === 'failed' && failed.length === 0) {
      return { violations, error: file.message || `${file.name} failed without a test result` };
    }
    for (const test of failed) {
      const text = (test.failureMessages ?? []).join('\n');
      const lines = text.split('\n').filter((line) => VIOLATION.test(line));
      violations.push(...(lines.length ? lines : [`${test.title}: ${text.split('\n')[0]}`]));
    }
  }
  return { violations };
}

/**
 * The files edited in each session, by checkout, in `<dir>/<session>.jsonl`. Entries are appended,
 * so hooks of parallel edits do not overwrite each other.
 */
export function createEditLog(dir) {
  const fileOf = (sessionId) => join(dir, `${String(sessionId).replace(/[^\w-]/g, '_')}.jsonl`);
  const entries = (sessionId) => {
    let text;
    try {
      text = readFileSync(fileOf(sessionId), 'utf8');
    } catch {
      return [];
    }
    return text
      .split('\n')
      .map(parseJson)
      .filter((entry) => typeof entry?.root === 'string' && typeof entry?.rel === 'string');
  };
  return {
    add(sessionId, root, rel) {
      mkdirSync(dir, { recursive: true });
      appendFileSync(fileOf(sessionId), `${JSON.stringify({ root, rel })}\n`);
    },
    read(sessionId) {
      const byRoot = {};
      for (const { root, rel } of entries(sessionId)) {
        const rels = (byRoot[root] ??= []);
        if (!rels.includes(rel)) rels.push(rel);
      }
      return byRoot;
    },
    clear(sessionId, root) {
      const kept = entries(sessionId).filter((entry) => entry.root !== root);
      if (kept.length === 0) rmSync(fileOf(sessionId), { force: true });
      else
        writeFileSync(
          fileOf(sessionId),
          kept.map((entry) => `${JSON.stringify(entry)}\n`).join(''),
        );
    },
  };
}

/** The PostToolUse hook: see the module comment. */
export function afterEdit(input, deps) {
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== 'string' || !deps.exists(filePath)) return { exitCode: 0 };
  const file = resolve(filePath);
  const root = deps.findRoot(dirname(file));
  const pkg = root ? deps.readJson(join(root, 'package.json')) : null;
  const rel = pkg?.name === PACKAGE_NAME ? repoPath(root, file) : null;
  if (!rel) return { exitCode: 0 };

  if (isConventionsTarget(rel)) deps.log.add(input.session_id, root, rel);
  const targets = sourceTargets(pkg);
  const format = targets.format(rel);
  const lint = targets.lint(rel);
  const prettier = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  const eslint = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
  const missing = [format && prettier, lint && eslint].filter((tool) => tool && !deps.exists(tool));
  if (missing.length) {
    return {
      exitCode: 1,
      stderr: `${missing.join(' and ')} not found: run npm ci in ${root} to format and lint edits there.\n`,
    };
  }

  const problems = [];
  const failures = [];
  let warnings = [];
  if (format) {
    const result = deps.run([prettier, '--write', file], { cwd: root });
    if (result.status !== 0) {
      problems.push(`Prettier could not format ${rel}:\n${clip(result.stderr || result.stdout)}`);
    }
  }
  if (lint) {
    const result = deps.run([eslint, '--format', 'json', '--no-warn-ignored', file], { cwd: root });
    const results = result.status === 0 || result.status === 1 ? parseJson(result.stdout) : null;
    if (Array.isArray(results)) {
      const found = eslintProblems(results, root);
      if (found.errors.length) {
        problems.push(
          `ESLint errors in ${rel} (npm run lint fails on them):\n${found.errors.join('\n')}`,
        );
      }
      warnings = found.warnings;
    } else {
      failures.push(`ESLint did not run on ${rel}:\n${clip(result.stderr || result.stdout)}`);
    }
  }

  if (problems.length)
    return { exitCode: 2, stderr: `${[...problems, ...failures].join('\n\n')}\n` };
  if (failures.length) return { exitCode: 1, stderr: `${failures.join('\n\n')}\n` };
  if (warnings.length) {
    const additionalContext =
      `ESLint warnings in ${rel}; npm run lint fails on warnings too, so fix them once the edit ` +
      `is complete:\n${warnings.join('\n')}`;
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext },
      }),
    };
  }
  return { exitCode: 0 };
}

/** The Stop hook: see the module comment. */
export function beforeStop(input, deps) {
  if (input?.stop_hook_active) return { exitCode: 0 };
  const sessionId = input?.session_id;
  const failed = [];
  const problems = [];
  for (const [root, rels] of Object.entries(deps.log.read(sessionId))) {
    const files = rels.filter((rel) => isConventionsTarget(rel) && deps.exists(join(root, rel)));
    if (files.length === 0) {
      deps.log.clear(sessionId, root);
      continue;
    }
    const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');
    if (!deps.exists(vitest)) {
      problems.push(`${vitest} not found: run npm ci in ${root} for the conventions check.`);
      continue;
    }
    const reportFile = deps.scratchFile(`conventions-${process.pid}-${Date.now()}.json`);
    const result = deps.run(
      [
        vitest,
        'run',
        CONVENTIONS_TEST,
        '--exclude',
        '.claude/**',
        '-t',
        testNamePattern(files),
        '--reporter=json',
        `--outputFile=${reportFile}`,
      ],
      { cwd: root },
    );
    const report = deps.readJson(reportFile);
    deps.remove(reportFile);
    if (!report) {
      problems.push(
        `The conventions check did not run in ${root}:\n${clip(result.stderr || result.stdout)}`,
      );
      continue;
    }
    const { violations, error } = conventionViolations(report);
    if (error) problems.push(`The conventions check could not run in ${root}:\n${clip(error)}`);
    else if (violations.length) failed.push({ root, violations });
    else deps.log.clear(sessionId, root);
  }

  if (failed.length) {
    const lines = failed.flatMap(({ root, violations }) =>
      failed.length > 1 ? [`In ${root}:`, ...violations] : violations,
    );
    const notes = problems.length ? `\n${problems.join('\n\n')}\n` : '';
    return {
      exitCode: 2,
      stderr:
        `The conventions gate (${CONVENTIONS_TEST}) fails for files edited in this session:\n` +
        `${lines.join('\n')}\n` +
        `Fix them before finishing; re-check one file with ` +
        `npx vitest run ${CONVENTIONS_TEST} -t "<path>".\n${notes}`,
    };
  }
  if (problems.length) return { exitCode: 1, stderr: `${problems.join('\n\n')}\n` };
  return { exitCode: 0 };
}

/** The real processes, files and git behind the hooks. */
function nodeDeps() {
  const dir = join(tmpdir(), 'waveui-claude-hooks');
  return {
    exists: existsSync,
    findRoot(start) {
      const git = spawnSync('git', ['-C', start, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
      });
      return git.status === 0 ? resolve(git.stdout.trim()) : null;
    },
    readJson(path) {
      try {
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        return null;
      }
    },
    run(args, { cwd }) {
      const child = spawnSync(process.execPath, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      return {
        status: child.status,
        stdout: child.stdout ?? '',
        stderr: child.error ? String(child.error) : (child.stderr ?? ''),
      };
    },
    log: createEditLog(dir),
    scratchFile(name) {
      mkdirSync(dir, { recursive: true });
      return join(dir, name);
    },
    remove: (path) => rmSync(path, { force: true }),
  };
}

const HOOKS = new Map([
  ['after-edit', afterEdit],
  ['before-stop', beforeStop],
]);

async function readAll(stream) {
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}

async function main() {
  const hook = HOOKS.get(process.argv[2]);
  if (!hook) {
    process.stderr.write(
      'Usage: node scripts/claude/hooks.mjs after-edit|before-stop < hook-input.json\n',
    );
    return 1;
  }
  const input = parseJson((await readAll(process.stdin)) || '{}');
  if (input === null) {
    process.stderr.write('scripts/claude/hooks.mjs: the hook input is not JSON\n');
    return 1;
  }
  const result = hook(input, nodeDeps());
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.exitCode;
}

await runScript(import.meta.url, main);
