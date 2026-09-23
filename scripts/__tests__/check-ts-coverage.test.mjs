// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkTypesNode, lowestMajor } from '../check-ts-coverage.mjs';

describe('lowestMajor', () => {
  it.each([
    ['>=20.19.0', 20],
    ['^20.19 || >=22', 20],
    ['^20.19||>=22', 20],
    ['>=22 || ^20.19', 20],
    ['~20.19.43', 20],
    ['20', 20],
    ['20.x', 20],
    ['v20.1.0', 20],
    ['>= 20.19.0', 20],
    ['>=20.19.0 <21', 20],
    ['20.19.0 - 22', 20],
  ])('reads the floor of %s as %i', (range, major) => {
    expect(lowestMajor(range)).toBe(major);
  });

  it.each([
    ['20.0.0-rc1', 20],
    ['20.0.0-rc.1', 20],
    ['20.0.0-beta1.2', 20],
    ['20.1.0+build5', 20],
    ['20.1.0+5', 20],
    ['^20.0.0-rc1 || >=22.0.0-next3', 20],
  ])('ignores prerelease and build digits in %s', (range, major) => {
    expect(lowestMajor(range)).toBe(major);
  });

  it('does not treat upper bounds as floors', () => {
    expect(lowestMajor('< 21')).toBeUndefined();
    expect(lowestMajor('<=22')).toBeUndefined();
    expect(lowestMajor('>=20 < 18')).toBe(20);
  });

  it.each([[undefined], [''], ['*'], ['x'], ['latest']])('has no floor for %s', (range) => {
    expect(lowestMajor(range)).toBeUndefined();
  });
});

describe('checkTypesNode', () => {
  const pkg = (engines, types) => ({
    engines: engines === undefined ? undefined : { node: engines },
    devDependencies: types === undefined ? {} : { '@types/node': types },
  });

  it('passes when the declared and installed majors equal the engines floor', () => {
    expect(checkTypesNode(pkg('>=20.19.0', '^20.19.43'), 'package.json', () => '20.19.43')).toEqual(
      { failures: [], installed: '20.19.43' },
    );
  });

  it('passes for a prerelease @types/node of the floor major', () => {
    const { failures } = checkTypesNode(
      pkg('>=20.19.0', '^20.0.0-rc1'),
      'package.json',
      () => '20.0.0-rc1',
    );
    expect(failures).toEqual([]);
  });

  it('fails when the declared or installed major differs from the engines floor', () => {
    const { failures } = checkTypesNode(
      pkg('>=20.19.0', '^22.0.0'),
      'package.json',
      () => '24.1.0',
    );
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(
      /package\.json declares @types\/node \^22\.0\.0, but engines\.node/,
    );
    expect(failures[0]).toMatch(/npm install -D @types\/node@\^20/);
    expect(failures[1]).toMatch(/the installed @types\/node is 24\.1\.0/);
  });

  it('reports a missing @types/node as a readable failure instead of throwing', () => {
    const missing = () => {
      throw new Error("Cannot find module '@types/node/package.json'\nRequire stack:\n- x.mjs");
    };
    let result;
    expect(() => {
      result = checkTypesNode(pkg('>=20.19.0', '^20.19.43'), 'package.json', missing);
    }).not.toThrow();
    expect(result.installed).toBeUndefined();
    expect(result.failures).toEqual([
      "@types/node is not installed or unreadable (Cannot find module '@types/node/package.json'): " +
        'npm install -D @types/node@^20',
    ]);
  });

  it('reports an undeclared @types/node', () => {
    const { failures } = checkTypesNode(pkg('>=20.19.0'), 'package.json', () => '20.19.43');
    expect(failures).toEqual([
      'package.json does not declare @types/node in devDependencies, but engines.node is ' +
        '>=20.19.0: tsconfig.node.json must type-check against Node 20 ' +
        '(npm install -D @types/node@^20)',
    ]);
  });

  it('reports an engines.node range without a floor', () => {
    const { failures } = checkTypesNode(
      pkg(undefined, '^20.19.43'),
      'package.json',
      () => '20.1.0',
    );
    expect(failures).toEqual([
      'package.json has no engines.node lower bound (missing) to check @types/node against',
    ]);
  });
});

describe('check-ts-coverage.mjs as a script', () => {
  // Importing the module (as this file does) must not run the checks; running it as a script must,
  // or `npm run typecheck` would pass silently. The fixture program lies outside the repo, so the
  // dev-program checks fail, while the prerelease @types/node declaration must pass.
  const script = fileURLToPath(new URL('../check-ts-coverage.mjs', import.meta.url));
  let dir;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'check-ts-coverage-'));
    writeFileSync(join(dir, 'index.ts'), 'export {};\n');
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { noEmit: true, types: [] }, files: ['index.ts'] }),
    );
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        engines: { node: '>=20.19.0' },
        devDependencies: { '@types/node': '^20.0.0-rc1' },
      }),
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs the checks when executed directly and lists every failure readably', () => {
    const tsconfig = join(dir, 'tsconfig.json');
    const result = spawnSync(
      process.execPath,
      [script, '--dev', tsconfig, '--lib', tsconfig, '--package', join(dir, 'package.json')],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('check-ts-coverage: TypeScript program setup is wrong:');
    expect(result.stderr).toContain('does not type-check a test file under src/**/__tests__/');
    expect(result.stderr).toContain('does not type-check .storybook/preview.tsx');
    expect(result.stderr).not.toContain('@types/node');
    expect(result.stderr).not.toMatch(/\n\s+at /);
  }, 60_000);
});
