import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, findRepoRoot } from './repoRoot';

const here = dirname(fileURLToPath(import.meta.url));

describe('findRepoRoot', () => {
  it('finds the repository from a source module', () => {
    expect(REPO_ROOT).toBe(resolve(here, '../..'));
  });

  it('finds it from a bundled chunk deeper in the site (the build moves the modules)', () => {
    // A built page's server code runs from website/dist/.prerender/chunks/.
    expect(findRepoRoot(resolve(here, '../dist/.prerender/chunks'))).toBe(REPO_ROOT);
  });

  it('skips package.json files of other packages and fails outside the repository', () => {
    const outside = mkdtempSync(join(tmpdir(), 'waveui-root-'));
    try {
      const nested = join(outside, 'a', 'b');
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(outside, 'a', 'package.json'), JSON.stringify({ name: 'other' }));
      expect(() => findRepoRoot(nested)).toThrow(/no WaveUI repository above/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
