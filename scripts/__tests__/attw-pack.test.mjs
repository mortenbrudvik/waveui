// @vitest-environment node
/**
 * `scripts/attw-pack.mjs` (`npm run check:package`, tooling-code-1): are-the-types-wrong runs on
 * a tarball the script packs itself, so `npm publish --dry-run` (which exports
 * `npm_config_dry_run=true` to prepublishOnly) no longer makes the nested pack write nothing.
 * attw itself is replaced by a stub; `npm run check:package` runs the real one.
 */
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../attw-pack.mjs';

describe('attw-pack.mjs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hands attw a packed tarball and every argument, also under npm publish --dry-run', () => {
    vi.stubEnv('npm_config_dry_run', 'true');
    const calls = [];
    const attw = (tarball, args) => {
      calls.push({ tarball, packed: existsSync(tarball), args });
      return 7;
    };
    expect(main(['--profile', 'node16'], { attw })).toBe(7);
    expect(calls).toEqual([
      {
        tarball: expect.stringMatching(/mortenbrudvik-waveui-[\d.]+\.tgz$/),
        packed: true,
        args: ['--profile', 'node16'],
      },
    ]);
    // The temporary tarball is removed afterwards.
    expect(existsSync(calls[0].tarball)).toBe(false);
  }, 60_000);
});
