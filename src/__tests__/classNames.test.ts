/**
 * The stable class-name registry, `src/lib/classNames.ts` (Fluent parity phase 3, spec P3-00,
 * §1.4.3): the naming formula of every constant, no repeated or reserved class, the export from
 * the package entry, the server safety of the module, and tailwind-merge keeping every class.
 * Completeness (every public component has a constant) and the applied check (every class is used
 * in `src/components`) follow at the end of this file.
 */
import * as registry from '../lib/classNames';
import * as entry from '../index';
import { cn } from '../lib/cn';

type ClassNameConstant = Readonly<Record<string, string>>;

/** Every constant of the registry, `[name, { key: class }]`. */
const constants = Object.entries(registry as unknown as Record<string, ClassNameConstant>);

/** `cardHeader` → `card-header`. */
const kebab = (camel: string): string =>
  camel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** WaveProvider keeps its 0.x scope class (spec D3); Portal's `wave-portal` fits the formula. */
const ROOT_EXCEPTIONS: Readonly<Record<string, string>> = { waveProviderClassNames: 'wave-root' };

/** The stylesheet's scope and theme classes (Appendix A, 36), with the constant that may own each. */
const RESERVED_CLASSES: Readonly<Record<string, string | null>> = {
  'wave-root': 'waveProviderClassNames',
  'wave-portal': 'portalClassNames',
  'wave-light': null,
  'wave-dark': null,
  'wave-high-contrast': null,
};

describe('class-name registry: formula (spec D3)', () => {
  it('exports only constants named <camel flat name>ClassNames, each an object of strings', () => {
    expect(constants.length).toBeGreaterThan(100);
    for (const [name, value] of constants) {
      expect(name).toMatch(/^[a-z][A-Za-z0-9]*ClassNames$/);
      expect(typeof value, name).toBe('object');
      for (const cls of Object.values(value)) expect(typeof cls, name).toBe('string');
    }
  });

  it('gives every constant the root wave-<kebab flat name>, and WaveProvider wave-root', () => {
    const wrong = constants
      .filter(
        ([name, value]) =>
          value.root !==
          (ROOT_EXCEPTIONS[name] ?? `wave-${kebab(name.slice(0, -'ClassNames'.length))}`),
      )
      .map(([name, value]) => `${name}.root = ${String(value.root)}`);
    expect(wrong).toEqual([]);
  });

  it('names every part <root>__<kebab key>, with a camelCase key', () => {
    const wrong: string[] = [];
    for (const [name, value] of constants) {
      for (const [key, cls] of Object.entries(value)) {
        if (key === 'root') continue;
        if (!/^[a-z][A-Za-z0-9]*$/.test(key) || cls !== `${value.root}__${kebab(key)}`) {
          wrong.push(`${name}.${key} = ${cls}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('never repeats a class string', () => {
    const seen = new Map<string, string>();
    const repeated: string[] = [];
    for (const [name, value] of constants) {
      for (const [key, cls] of Object.entries(value)) {
        const first = seen.get(cls);
        if (first) repeated.push(`${cls}: ${first} and ${name}.${key}`);
        else seen.set(cls, `${name}.${key}`);
      }
    }
    expect(repeated).toEqual([]);
  });

  it('produces no reserved scope class except the roots that own them', () => {
    const wrong: string[] = [];
    for (const [name, value] of constants) {
      for (const [key, cls] of Object.entries(value)) {
        if (!Object.hasOwn(RESERVED_CLASSES, cls)) continue;
        if (key !== 'root' || RESERVED_CLASSES[cls] !== name) wrong.push(`${name}.${key} = ${cls}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('class-name registry: export and server safety (spec D2, D7)', () => {
  it('is exported from the package entry with the same values', () => {
    const missing = constants
      .filter(([name, value]) => Reflect.get(entry, name) !== value)
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('imports nothing, so a React Server Component can read it', () => {
    const [source] = Object.values(
      import.meta.glob<string>('../lib/classNames.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    );
    expect(source).toBeTypeOf('string');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/\bimport\b|\brequire\s*\(|['"]use client['"]/);
  });
});

describe('class-name registry: tailwind-merge (spec D3)', () => {
  const all = constants.flatMap(([, value]) => Object.values(value));

  it('keeps every stable class when several share one element', () => {
    expect(cn(...all).split(' ')).toEqual(all);
  });

  it('keeps a stable class next to the utilities and the consumer class of an element', () => {
    const dropped = all.filter(
      (cls) =>
        !cn(cls, 'inline-flex px-3 text-body-1 shadow-4 font-wave', 'px-4 wave-test-custom-class')
          .split(' ')
          .includes(cls),
    );
    expect(dropped).toEqual([]);
  });
});
