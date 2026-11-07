/**
 * The splitter on the library modules the site's client build really splits (`REGISTRY_MODULES`),
 * so a library edit the splitter cannot handle, or one that would change what the split module
 * exports, fails here with the file's name rather than only in a site build.
 */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../src/repoRoot';
import { REGISTRY_MODULES, splitModule, SPLIT_QUERY } from './splitModules.mjs';

describe.each(REGISTRY_MODULES)('splitting %s', (file) => {
  const path = join(REPO_ROOT, file);
  const name = basename(file);

  it('splits without refusing any statement', () => {
    expect(() => splitModule(readFileSync(path, 'utf8'), name)).not.toThrow();
  });

  it('exports exactly the values the module exports', async () => {
    const { exports, parts } = splitModule(readFileSync(path, 'utf8'), name);
    const actual = Object.keys((await import(/* @vite-ignore */ path)) as object).sort();
    expect(actual.length, file).toBeGreaterThan(0);
    expect([...exports.keys()].sort(), file).toEqual(actual);
    // Each export comes from a part that declares its local name.
    for (const [exported, { local, part }] of exports) {
      expect(parts[part]?.names, `${file}: ${exported}`).toContain(local);
    }
  });

  it('has each part import only parts emitted before it, and only names they declare', () => {
    const { parts } = splitModule(readFileSync(path, 'utf8'), name);
    expect(parts.map((part) => part.index)).toEqual(parts.map((_, index) => index));
    const partImport = new RegExp(
      `import \\{ ([^}]+) \\} from '\\./${name.replace('.', '\\.')}\\?${SPLIT_QUERY}=(\\d+)';`,
      'g',
    );
    for (const part of parts) {
      for (const [, names, target] of part.code.matchAll(partImport)) {
        const index = Number(target);
        expect(index, `${file}: part ${part.index} imports part ${index}`).toBeLessThan(part.index);
        for (const imported of names!.split(', ')) {
          expect(parts[index]!.names, `${file}: part ${part.index}`).toContain(imported);
        }
      }
      // A part names no other part id in any other form.
      expect(part.code.split(`?${SPLIT_QUERY}=`).length - 1, `${file}: part ${part.index}`).toBe(
        [...part.code.matchAll(partImport)].length,
      );
    }
  });
});
