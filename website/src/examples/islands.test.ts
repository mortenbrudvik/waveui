/**
 * The generated example islands: one module per catalog entry that imports only that entry's story
 * file, so a page's client code holds one story file (the build measurement is in the Task 9
 * report; this checks the sources).
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog/catalog';
import { exampleIslandFiles, writeExampleIslands } from './islands';

const catalog = getCatalog();
const button = catalog.find((entry) => entry.slug === 'button')!;

describe('exampleIslandFiles', () => {
  const files = exampleIslandFiles(catalog, []);
  const byPath = new Map(files.map((file) => [file.path, file.content]));

  it('writes an island module and an Astro wrapper per catalog entry', () => {
    expect(files).toHaveLength(catalog.length * 2);
    expect([...byPath.keys()].sort()).toEqual(
      catalog.flatMap((entry) => [`${entry.slug}.astro`, `${entry.slug}.tsx`]).sort(),
    );
  });

  it('an island imports only its own story file, its meta and its stories by name', () => {
    const source = byPath.get('button.tsx')!;
    const imports = [...source.matchAll(/from '([^']+)'/g)].map(([, specifier]) => specifier);
    expect(imports).toEqual(['../../../../stories/Button.stories', '../../islands/Example']);
    expect(source).toContain(
      `import meta, { ${button.storyNames.join(', ')} } from '../../../../stories/Button.stories';`,
    );
    expect(source).toContain(
      `export default createExampleIsland('stories/Button.stories.tsx', { default: meta, ${button.storyNames.join(', ')} });`,
    );
    for (const entry of catalog) {
      const island = byPath.get(`${entry.slug}.tsx`)!;
      const storyImports = [...island.matchAll(/stories\/[\w.]+\.stories/g)].map(([m]) => m);
      expect(new Set(storyImports)).toEqual(new Set([entry.storyFile.replace(/\.tsx$/, '')]));
    }
  });

  it('the wrapper renders the island client:visible with the props it is given', () => {
    expect(byPath.get('button.astro')).toContain("import Island from './button.tsx';");
    expect(byPath.get('button.astro')).toContain('<Island client:visible {...Astro.props} />');
  });

  it('leaves skipped stories out', () => {
    const [first, ...rest] = button.storyNames;
    const source = exampleIslandFiles([button], [`${button.storyFile}#${first}`]).find(
      (file) => file.path === 'button.tsx',
    )!.content;
    expect(source).toContain(`import meta, { ${rest.join(', ')} } from`);
  });

  it('refuses a story named like the module’s own bindings', () => {
    expect(() => exampleIslandFiles([{ ...button, storyNames: ['Default', 'meta'] }], [])).toThrow(
      'stories/Button.stories.tsx#meta',
    );
  });
});

describe('writeExampleIslands', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('writes what changed, keeps what did not and removes stale files', () => {
    dir = mkdtempSync(join(tmpdir(), 'waveui-examples-'));
    writeFileSync(join(dir, 'removed-component.tsx'), 'stale');
    const first = writeExampleIslands(dir);
    expect(first.written).toHaveLength(catalog.length * 2);
    expect(first.removed).toEqual(['removed-component.tsx']);
    expect(readdirSync(dir)).toHaveLength(catalog.length * 2);
    expect(readFileSync(join(dir, 'button.astro'), 'utf8')).toContain('client:visible');

    const second = writeExampleIslands(dir);
    expect(second).toEqual({ written: [], removed: [] });
  });
});
