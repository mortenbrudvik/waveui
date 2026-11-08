/**
 * The size cache of `getImportSizes` on a small fake `dist` and a fake measurement: invalidation by
 * content, malformed entries, the atomic write and the message for an absent library build.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

import * as fs from 'node:fs';
import { getImportSizes, type ImportSizesOptions } from './sizes';

let scratch: string;
let dist: string;
let cacheFile: string;

const measure = vi.fn(async (_dist: string, names: string[]) => ({
  minified: 1000 + names[0]!.length,
  gzip: 400 + names[0]!.length,
  bytes: 0,
})) as unknown as NonNullable<ImportSizesOptions['measure']>;

function writeDist(chunk = 'export const answer = 41;\n') {
  mkdirSync(join(dist, 'components'), { recursive: true });
  writeFileSync(join(dist, 'index.mjs'), 'export { A, B };\n');
  writeFileSync(join(dist, 'components', 'a.mjs'), chunk);
}

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'wave-sizes-cache-'));
  dist = join(scratch, 'dist');
  cacheFile = join(scratch, 'cache', 'import-sizes.json');
  writeDist();
  vi.mocked(measure).mockClear();
  vi.mocked(fs.renameSync).mockClear();
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const options = () => ({ measure, cacheFile, names: ['A', 'B'] });

describe('getImportSizes cache', () => {
  it('an edit of a dist file that keeps its length invalidates the cache', async () => {
    await getImportSizes(dist, options());
    expect(measure).toHaveBeenCalledTimes(2);

    vi.mocked(measure).mockClear();
    await getImportSizes(dist, options());
    expect(measure).not.toHaveBeenCalled();

    // "41" -> "42": the same length, the same file list, a different content.
    writeDist('export const answer = 42;\n');
    await getImportSizes(dist, options());
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it('a renamed dist file with the same content invalidates the cache', async () => {
    await getImportSizes(dist, options());
    rmSync(join(dist, 'components', 'a.mjs'));
    writeFileSync(join(dist, 'components', 'b.mjs'), 'export const answer = 41;\n');
    vi.mocked(measure).mockClear();
    await getImportSizes(dist, options());
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a string', { minified: '1000', gzip: 400 }],
    ['a negative number', { minified: 1000, gzip: -1 }],
    ['zero', { minified: 0, gzip: 400 }],
    ['not finite (null from JSON)', { minified: 1000, gzip: null }],
    ['a missing field', { minified: 1000 }],
    ['not an object', 7],
    ['null', null],
  ])('an entry with %s is a miss and is measured again', async (_label, entry) => {
    await getImportSizes(dist, options());
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8')) as {
      key: string;
      sizes: Record<string, unknown>;
    };
    cached.sizes.A = entry;
    writeFileSync(cacheFile, JSON.stringify(cached));

    vi.mocked(measure).mockClear();
    const sizes = await getImportSizes(dist, options());
    expect(measure).toHaveBeenCalledTimes(1);
    expect(vi.mocked(measure).mock.calls[0]![1]).toEqual(['A']);
    expect(sizes.A).toEqual({ minified: 1001, gzip: 401 });
  });

  it('a cache that is not JSON, or not an object of sizes, is a miss', async () => {
    mkdirSync(join(scratch, 'cache'), { recursive: true });
    writeFileSync(cacheFile, '{ "key": ');
    await getImportSizes(dist, options());
    expect(measure).toHaveBeenCalledTimes(2);

    writeFileSync(cacheFile, JSON.stringify({ key: 'x', sizes: [1, 2] }));
    vi.mocked(measure).mockClear();
    await getImportSizes(dist, options());
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it('writes the cache through a temporary file that is renamed over it', async () => {
    await getImportSizes(dist, options());
    expect(fs.renameSync).toHaveBeenCalledTimes(1);
    const [from, to] = vi.mocked(fs.renameSync).mock.calls[0]!;
    expect(String(to)).toBe(cacheFile);
    expect(String(from)).not.toBe(cacheFile);
    expect(readdirSync(join(scratch, 'cache'))).toEqual(['import-sizes.json']);
    expect(JSON.parse(readFileSync(cacheFile, 'utf8')).sizes.A).toEqual({
      minified: 1001,
      gzip: 401,
    });
  });

  it('an unwritable cache location still gives the sizes', async () => {
    // A file where the cache directory should be: mkdir fails.
    writeFileSync(join(scratch, 'blocker'), '');
    const sizes = await getImportSizes(dist, {
      measure,
      cacheFile: join(scratch, 'blocker', 'import-sizes.json'),
      names: ['A'],
    });
    expect(sizes.A).toEqual({ minified: 1001, gzip: 401 });
  });

  it('an absent dist tells to run the library build first', async () => {
    const error = await getImportSizes(join(scratch, 'no-dist'), options()).then(
      () => undefined,
      (caught: unknown) => caught as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/npm run build/);
    expect(error?.message).toContain('no-dist');
    expect(measure).not.toHaveBeenCalled();
  });
});
