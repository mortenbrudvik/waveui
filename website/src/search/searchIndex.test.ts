import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog/catalog';
import { isHookEntry } from '../docs/page';
import { extractDocs } from '../docs/props';
import { componentHref } from '../shell/urls';
import type { SearchEntry } from './match';
import {
  buildSearchIndex,
  readSearchIndex,
  SEARCH_INDEX_URL,
  serialiseSearchIndex,
  type IndexedComponent,
} from './searchIndex';

const catalog = getCatalog();

describe('the search index', () => {
  const index = readSearchIndex();
  const byKind = (kind: SearchEntry['kind']) => index.filter((entry) => entry.kind === kind);

  it('the search index is deterministic (two builds of the function give identical output)', () => {
    expect(serialiseSearchIndex(readSearchIndex())).toBe(serialiseSearchIndex(index));
    // The order of the input does not matter either.
    const components: IndexedComponent[] = [
      { name: 'Button', slug: 'button', category: 'Buttons', props: ['size', 'appearance'] },
      { name: 'Avatar', slug: 'avatar', category: 'Data display', props: null },
    ];
    const pages = [
      { title: 'Theming', href: '/waveui/docs/theming' },
      { title: 'Changelog', href: '/waveui/docs/changelog' },
    ];
    expect(
      serialiseSearchIndex(buildSearchIndex([...components].reverse(), [...pages].reverse())),
    ).toBe(serialiseSearchIndex(buildSearchIndex(components, pages)));
    expect(buildSearchIndex(components, pages).map((entry) => entry.label)).toEqual([
      'Avatar',
      'Button',
      'Changelog',
      'Theming',
      'Button.appearance',
      'Button.size',
    ]);
  });

  it('contains all 80 components', () => {
    const components = byKind('component');
    expect(components).toHaveLength(80);
    expect(new Set(components.map((entry) => entry.label))).toEqual(
      new Set(catalog.map((entry) => entry.name)),
    );
    for (const entry of catalog) {
      expect(components.find((item) => item.label === entry.name)).toEqual({
        label: entry.name,
        kind: 'component',
        href: componentHref(entry.slug),
        detail: entry.category,
      });
    }
  });

  it("holds every prop of the component pages' props tables, leading to the table", () => {
    const props = byKind('prop');
    let expected = 0;
    for (const entry of catalog) {
      const docs = extractDocs(entry);
      if (isHookEntry(entry) || docs.props.length === 0) continue;
      expected += docs.props.length;
      for (const prop of docs.props) {
        expect(props).toContainEqual({
          label: `${entry.name}.${prop.name}`,
          kind: 'prop',
          href: `${componentHref(entry.slug)}#props`,
        });
      }
    }
    expect(props).toHaveLength(expected);
    expect(props.some((entry) => entry.label === 'DataGrid.columns')).toBe(true);
  });

  it('holds the guide pages and the components index', () => {
    expect(byKind('page')).toEqual([
      { label: 'All components', kind: 'page', href: '/waveui/docs/components' },
      { label: 'Changelog', kind: 'page', href: '/waveui/docs/changelog' },
      { label: 'Getting started', kind: 'page', href: '/waveui/docs/getting-started' },
      { label: 'Theming', kind: 'page', href: '/waveui/docs/theming' },
    ]);
  });

  it('is compact: under 30 KB gzipped, served under the app’s assets', () => {
    const json = serialiseSearchIndex(index);
    expect(gzipSync(json).length).toBeLessThan(30_000);
    expect(JSON.parse(json)).toEqual(index);
    expect(SEARCH_INDEX_URL).toBe('/waveui/docs/_assets/search-index.json');
  });
});
