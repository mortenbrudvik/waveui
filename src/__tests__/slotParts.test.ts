/**
 * The completeness gate of `slotProps` (Phase 13, R2, R4, R7): every part key of the class-name
 * registry (`src/lib/classNames.ts`, each key of a constant but `root`) is exactly one of a
 * `slotProps` key of its component, a named slot, an exclusion with a reason, or pending, as the
 * lists of `src/lib/slotParts.ts` say. The gate also fails on a list entry that names no registry
 * constant or part key (an exclusion whose part was renamed, say), on a key listed twice and on an
 * exclusion without a one-line reason. The per-component `slotProps` tests prove that a component
 * declares the keys `SLOT_PROPS_KEYS` gives it; this file proves the lists cover the registry.
 * The registry and this gate supersede the part list of the Phase 3 spec's Appendix A (R4).
 */
import * as registry from '../lib/classNames';
import * as entry from '../index';
import * as slotParts from '../lib/slotParts';
import {
  NAMED_SLOT_PARTS,
  PENDING_SLOT_PARTS,
  SLOT_PART_EXCLUSIONS,
  SLOT_PROPS_KEYS,
} from '../lib/slotParts';

type ListName = 'a slotProps key' | 'a named slot' | 'an exclusion' | 'pending';

/** Every constant of the registry, `[name, { key: class }]`. */
const constants = Object.entries(
  registry as unknown as Record<string, Readonly<Record<string, string>>>,
);

/** `[list, constant, key]` for every entry of the four lists, in list order. */
function listEntries(): [ListName, string, string][] {
  const fromMap = (list: ListName, map: object): [ListName, string, string][] =>
    Object.entries(map as Record<string, readonly string[] | undefined>).flatMap(
      ([constant, keys]) =>
        (keys ?? []).map((key): [ListName, string, string] => [list, constant, key]),
    );
  return [
    ...fromMap('a slotProps key', SLOT_PROPS_KEYS),
    ...fromMap('a named slot', NAMED_SLOT_PARTS),
    ...SLOT_PART_EXCLUSIONS.map(({ component, key }): [ListName, string, string] => [
      'an exclusion',
      component,
      key,
    ]),
    ...fromMap('pending', PENDING_SLOT_PARTS),
  ];
}

/** The lists that hold `constant.key`, once per entry. */
function membership(): Map<string, ListName[]> {
  const found = new Map<string, ListName[]>();
  for (const [list, constant, key] of listEntries()) {
    const id = `${constant}.${key}`;
    found.set(id, [...(found.get(id) ?? []), list]);
  }
  return found;
}

describe('slotProps completeness gate (R7)', () => {
  it('resolves every part key of every registry constant through exactly one list', () => {
    const lists = membership();
    const wrong: string[] = [];
    for (const [constant, value] of constants) {
      for (const key of Object.keys(value)) {
        if (key === 'root') continue;
        const id = `${constant}.${key}`;
        const found = [...new Set(lists.get(id) ?? [])];
        if (found.length === 0) {
          wrong.push(`${id}: neither a slotProps key, a named slot, an exclusion nor pending`);
        } else if (found.includes('a slotProps key') && found.includes('a named slot')) {
          wrong.push(
            `${id}: both a slotProps key and a named slot (R2: a named slot is not repeated)`,
          );
        } else if (found.includes('pending') && found.length > 1) {
          const resolved = found.filter((list) => list !== 'pending').join(' and ');
          wrong.push(`${id}: pending, but already ${resolved}`);
        } else if (found.length > 1) {
          wrong.push(`${id}: both ${found.join(' and ')}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('names only registry constants and their part keys', () => {
    const parts = new Map(
      constants.map(([constant, value]) => [
        constant,
        Object.keys(value).filter((key) => key !== 'root'),
      ]),
    );
    const wrong = listEntries().flatMap(([list, constant, key]) => {
      const keys = parts.get(constant);
      if (keys === undefined)
        return [`${constant}: no constant of the class-name registry (${list})`];
      return keys.includes(key) ? [] : [`${constant}.${key}: no part key of ${constant} (${list})`];
    });
    expect([...new Set(wrong)]).toEqual([]);
  });

  it('lists each part key once per list, and no constant without keys', () => {
    const seen = new Set<string>();
    const wrong: string[] = [];
    for (const [list, constant, key] of listEntries()) {
      const id = `${list}: ${constant}.${key}`;
      if (seen.has(id)) wrong.push(`${constant}.${key}: listed twice as ${list}`);
      seen.add(id);
    }
    for (const [list, map] of [
      ['SLOT_PROPS_KEYS', SLOT_PROPS_KEYS],
      ['NAMED_SLOT_PARTS', NAMED_SLOT_PARTS],
      ['PENDING_SLOT_PARTS', PENDING_SLOT_PARTS],
    ] as const) {
      for (const [constant, keys] of Object.entries(map as Record<string, readonly string[]>)) {
        if (keys.length === 0) wrong.push(`${constant}: an empty entry of ${list} (remove it)`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('gives every exclusion a one-line reason', () => {
    const wrong = SLOT_PART_EXCLUSIONS.filter(
      ({ reason }) => typeof reason !== 'string' || reason.trim() === '' || /[\r\n]/.test(reason),
    ).map(({ component, key }) => `${component}.${key}: an exclusion without a one-line reason`);
    expect(wrong).toEqual([]);
  });
});

describe('slotParts module', () => {
  it('is data for the gate only: the package entry does not export it', () => {
    const exported = Object.keys(slotParts).filter((name) => Reflect.has(entry, name));
    expect(exported).toEqual([]);
  });

  it('imports types only, so it stays server-safe', () => {
    const [source] = Object.values(
      import.meta.glob<string>('../lib/slotParts.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    );
    expect(source).toBeTypeOf('string');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/['"]use client['"]|\brequire\s*\(/);
    const imports = code.match(/^\s*import\b[^;]*;/gm) ?? [];
    expect(imports.filter((line) => !/^\s*import\s+type\b/.test(line))).toEqual([]);
  });
});
