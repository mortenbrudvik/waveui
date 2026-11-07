import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import * as library from '../../../src';
import { getCatalog, readCatalog } from './catalog';

// The catalog's reads of the stories directory are counted (the memo test); every call passes on.
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, readdirSync: vi.fn(fs.readdirSync) };
});

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('component catalog', () => {
  const catalog = getCatalog();

  it('has exactly 80 components', () => {
    expect(catalog).toHaveLength(80);
  });

  it('slugs are unique lower-case kebab', () => {
    const slugs = catalog.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    }
    const slugOf = (name: string) => catalog.find((entry) => entry.name === name)?.slug;
    expect(slugOf('DataGrid')).toBe('data-grid');
    expect(slugOf('Button')).toBe('button');
    expect(slugOf('TeachingPopover')).toBe('teaching-popover');
    // The two entries that are not one component: a bare "features" is no URL for the table hooks.
    expect(slugOf('Features')).toBe('table-features');
    expect(slugOf('Custom overlays')).toBe('custom-overlays');
  });

  it('every storyFile exists', () => {
    for (const entry of catalog) {
      expect(entry.storyFile).toMatch(/^stories\/[A-Za-z]+\.stories\.tsx$/);
      expect(existsSync(resolve(REPO_ROOT, entry.storyFile)), entry.storyFile).toBe(true);
    }
  });

  it('every entry has at least one story', () => {
    for (const entry of catalog) {
      expect(entry.storyNames.length, entry.title).toBeGreaterThan(0);
      expect(entry.storyNames).not.toContain('default');
      expect(entry.storyNames).not.toContain('meta');
    }
  });

  it('categories are Button, Data Display, Feedback, Input, Layout, Motion, Navigation, Overlays, Provider, Table, Typography', () => {
    const categories = [...new Set(catalog.map((entry) => entry.category))];
    expect(categories).toEqual([
      'Button',
      'Data Display',
      'Feedback',
      'Input',
      'Layout',
      'Motion',
      'Navigation',
      'Overlays',
      'Provider',
      'Table',
      'Typography',
    ]);
  });

  it('no title outside Components/ is listed', () => {
    for (const entry of catalog) {
      expect(entry.title).toMatch(/^Components\/[^/]+\/[^/]+$/);
    }
    expect(catalog.some((entry) => entry.title.startsWith('Guides/'))).toBe(false);
  });

  it('is sorted by category then name and titles are unique', () => {
    const keys = catalog.map((entry) => `${entry.category}/${entry.name}`);
    const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'en'));
    expect(keys).toEqual(sorted);
    expect(new Set(catalog.map((entry) => entry.title)).size).toBe(catalog.length);
    for (const entry of catalog) {
      expect(entry.title).toBe(`Components/${entry.category}/${entry.name}`);
    }
  });

  it('every exportName is exported by the library entry', () => {
    for (const entry of catalog) {
      expect(library, entry.title).toHaveProperty(entry.exportName);
    }
  });

  it('exportName is the component the story shows, not its story wrapper', () => {
    const exportOf = (name: string) => catalog.find((entry) => entry.name === name)?.exportName;
    expect(exportOf('Menu')).toBe('Menu');
    expect(exportOf('DataGrid')).toBe('DataGrid');
    expect(exportOf('FlatTree')).toBe('FlatTree');
    expect(exportOf('Features')).toBe('useTableFeatures');
    expect(exportOf('Custom overlays')).toBe('useModalLayer');
  });

  it('lists the named story exports in source order', () => {
    const button = catalog.find((entry) => entry.name === 'Button');
    expect(button?.storyFile).toBe('stories/Button.stories.tsx');
    expect(button?.storyNames.slice(0, 3)).toEqual(['Default', 'Primary', 'Outline']);
    expect(button?.storyNames).toHaveLength(14);
  });

  it('reads the repository relative to the module, not the working directory', () => {
    const original = process.cwd();
    process.chdir(resolve(REPO_ROOT, 'website'));
    try {
      expect(readCatalog()).toHaveLength(80);
    } finally {
      process.chdir(original);
    }
  });

  it('reads the stories once per process and hands out copies the caller may change', () => {
    getCatalog();
    vi.mocked(readdirSync).mockClear();
    const first = getCatalog();
    const second = getCatalog();
    expect(readdirSync).not.toHaveBeenCalled();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    first.pop();
    first[0]!.name = 'Changed';
    first[1]!.storyNames.push('Changed');
    expect(getCatalog()).toEqual(second);
    expect(getCatalog()).toEqual(readCatalog());
  });
});
