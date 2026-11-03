/**
 * The 1.0 removals stay removed. Phase 14 deleted the aliases, exports, files and classes that
 * 0.x announced as deprecated; the inventory that tracked them retired with the last of them, and
 * this file replaces its absence checks: a name, a package file, a registry class or a stylesheet
 * rule that comes back fails here. What a removed prop or value did is proved a type error in the
 * component's own tests (`@ts-expect-error`).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Wave from '../index';
import type * as WaveTypes from '../index';
import * as registry from '../lib/classNames';

/** The repository root. */
const ROOT = join(import.meta.dirname, '..', '..');

/** Every class of the stable class-name registry, nested or not. */
function registryClasses(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const word of value.split(/\s+/)) into.add(word);
  } else if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) registryClasses(child, into);
  }
  return into;
}

/** The stylesheets of `src/styles` (not their tests), as text, read from disk. */
const stylesheets = (): string[] =>
  readdirSync(join(ROOT, 'src', 'styles'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(join(ROOT, 'src', 'styles', name), 'utf8'));

/** Every module of `src` but the tests and test helpers, by repository path (`src/…`). */
const SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>(
      ['../**/*.{ts,tsx}', '!../**/__tests__/**', '!../**/*.test.{ts,tsx}', '!../test-*'],
      { query: '?raw', import: 'default', eager: true },
    ),
  ).map(([path, source]) => [path.replace(/^\.\.\//, 'src/'), source]),
);

describe('1.0: the removed API stays removed', () => {
  it('exports no value of the removed Table.Head names', () => {
    expect(Object.keys(Wave).filter((name) => /^TableHead(Cell)?$/.test(name))).toEqual([]);
    expect('TableHead' in Wave).toBe(false);
    expect('TableHeadCell' in Wave).toBe(false);
    expect(Reflect.has(Wave.Table, 'Head')).toBe(false);
    expect(Reflect.has(Wave.Table, 'HeadCell')).toBe(false);
  });

  it('exports no type of the removed names', () => {
    // @ts-expect-error -- `TableHeadProps` is removed in 1.0
    type Head = WaveTypes.TableHeadProps;
    // @ts-expect-error -- `TableHeadCellProps` is removed in 1.0
    type HeadCell = WaveTypes.TableHeadCellProps;
    // @ts-expect-error -- `DataGridLegacySortProps` is removed in 1.0: the sort props are `items`, `sort`
    type Legacy = WaveTypes.DataGridLegacySortProps;
    // @ts-expect-error -- `LinkVariant` is removed in 1.0: use `LinkAppearance`
    type Variant = WaveTypes.LinkVariant;
    // @ts-expect-error -- `DeprecatedPresenceStatus` is removed in 1.0 (no member of the entry)
    type Presence = WaveTypes.DeprecatedPresenceStatus;
    const names: [Head?, HeadCell?, Legacy?, Variant?, Presence?] = [];
    expect(names).toEqual([]);
  });

  it('ships no legacy stylesheet: ./legacy-tokens.css and ./animations.css are not exports', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    const exported = Object.keys(manifest.exports);
    expect(exported.filter((key) => /legacy-tokens|animations/.test(key))).toEqual([]);
    expect(JSON.stringify(manifest.exports)).not.toMatch(/legacy-tokens|animations/);
    for (const file of ['legacy-tokens.css', 'animations.css']) {
      expect(existsSync(join(ROOT, 'src', 'styles', file))).toBe(false);
    }
  });

  it('holds none of the 0.x stylesheet text: the legacy names and the .dark and .high-contrast theme classes', () => {
    const css = stylesheets();
    for (const text of [
      'legacy-tokens',
      '--brand-',
      '--grey-',
      'animations.css',
      '.dark',
      '.high-contrast',
    ]) {
      expect(
        css.filter((sheet) => sheet.includes(text)),
        text,
      ).toEqual([]);
    }
  });

  it('keeps the old TagPicker classes out of the registry', () => {
    const classes = registryClasses(registry);
    expect(classes.has('wave-tag-picker__control')).toBe(false);
    expect(classes.has('wave-tag-picker__group')).toBe(false);
  });

  it('leaves no module of the library that names a removed export', () => {
    const names =
      /\b(TableHead(Cell)?(Props|CellProps)?|LinkVariant|DeprecatedPresenceStatus|DataGridLegacySortProps)\b/;
    const found = Object.entries(SOURCES)
      .filter(([, source]) => names.test(source))
      .map(([path]) => path);
    expect(found).toEqual([]);
  });
});
