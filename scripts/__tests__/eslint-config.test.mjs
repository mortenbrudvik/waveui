// @vitest-environment node
/**
 * The lint gate (`npm run lint`, eslint.config.mjs). react-hooks' recommended
 * preset reports `exhaustive-deps` as a warning, so a hook whose effect misses a dependency (a
 * stale closure) must still fail the `lint` script: it runs ESLint with its own options on a
 * source that is never written to disk.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const require = createRequire(import.meta.url);
const eslint = join(dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');

/**
 * Lints `code` as the file `path` with the options of the `lint` script (its directories left
 * out); returns ESLint's exit code and report.
 */
function lintAs(path, code) {
  const [command, ...args] = pkg.scripts.lint.split(/\s+/);
  expect(command).toBe('eslint');
  const options = args.filter((arg) => !arg.endsWith('/'));
  const result = spawnSync(
    process.execPath,
    [eslint, ...options, '--stdin', '--stdin-filename', path],
    { cwd: root, input: code, encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  return { status: result.status, report: `${result.stdout}${result.stderr}` };
}

const hook = (deps) =>
  [
    "import * as React from 'react';",
    '',
    'export function useProbe(a: number, v: number) {',
    '  React.useEffect(() => {',
    '    document.title = String(a + v);',
    `  }, [${deps}]);`,
    '}',
    '',
  ].join('\n');

describe('npm run lint', () => {
  it('passes a hook whose effect lists its dependencies', () => {
    expect(lintAs('src/hooks/useProbe.ts', hook('a, v'))).toEqual({ status: 0, report: '' });
  }, 60_000);

  it('fails on a hook whose effect misses dependencies (a stale closure)', () => {
    const { status, report } = lintAs('src/hooks/useProbe.ts', hook(''));
    expect(report).toContain('react-hooks/exhaustive-deps');
    expect(status).toBe(1);
  }, 60_000);
});
