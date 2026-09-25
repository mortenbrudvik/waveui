#!/usr/bin/env node
/**
 * Runs are-the-types-wrong on the tarball `npm publish` would upload (`npm run check:package`,
 * after publint): packs the package into a temporary directory with pack-smoke's
 * `pack()` and passes the tarball and every argument to `attw`.
 *
 * `attw --pack .` would run `npm pack` itself with the environment of the enclosing npm command.
 * `npm publish --dry-run` exports `npm_config_dry_run=true` to the prepublishOnly scripts, so
 * that nested pack writes no tarball and attw fails with ENOENT. `pack()` runs npm without the
 * dry run.
 *
 * Usage: node scripts/attw-pack.mjs [attw options]
 *
 * `main` is exported and tested by scripts/__tests__/attw-pack.test.mjs; importing the module
 * does not run it.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pack } from './pack-smoke.mjs';
import { runScript } from './verify-dist.mjs';

const require = createRequire(import.meta.url);

/** Runs the attw CLI (a devDependency) on `tarball` with `args`; returns its exit code. */
function runAttw(tarball, args) {
  const manifestPath = require.resolve('@arethetypeswrong/cli/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.attw;
  const result = spawnSync(process.execPath, [join(dirname(manifestPath), bin), tarball, ...args], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/** CLI entry; returns the exit code. `attw(tarball, args)` runs the check (default: the CLI). */
export function main(argv = process.argv.slice(2), { attw = runAttw } = {}) {
  const work = mkdtempSync(join(tmpdir(), 'wave-attw-pack-'));
  try {
    return attw(pack(work).tarball, argv);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

await runScript(import.meta.url, main);
