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
import { getStableClassNames } from '../test-utils';

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

// ---------------------------------------------------------------------------
// Completeness and the applied check (spec §1.4.3)
// ---------------------------------------------------------------------------

/**
 * Public components that render no element of their own (spec D3), so they have no constant. An
 * entry the package entry does not export yet (`ToastClose` before INTEGRATION) is ignored.
 */
const NO_ELEMENT: readonly string[] = [
  'Dialog', // a context provider: Dialog.Content renders the surface
  'DialogClose', // clones its child (asChild={false} renders a wrapper span that takes className)
  'DialogTrigger', // clones its child
  'DismissLayerProvider', // a context provider: the custom surface renders the element (0.12)
  'DrawerClose', // clones its child
  'DrawerTrigger', // clones its child
  'ListboxProvider', // a context provider: the custom picker renders the list (phase 5)
  'MenuTrigger', // clones its child
  'Popover', // a context provider: Popover.Content renders the surface
  'PopoverTrigger', // clones its child
  'Presence', // clones its child
  'TeachingPopoverTrigger', // clones its child (0.14)
  'ToastClose', // clones its child (phase 3)
];

/**
 * Constants and keys that a later wave applies (spec §0.2 rule 24, §1.4.3): the "applied" check
 * skips them, and a whole constant also the "names a public component" check. Empty since wave D
 * of 0.11, when every Phase 6 part landed. A later phase that registers parts before they exist
 * lists them here and empties the list when they land. 0.15: MessageBarGroup's constant, until
 * the package entry exports the component (INTEGRATION).
 */
const PENDING_CLASS_NAMES: readonly string[] = ['messageBarGroupClassNames'];

const isPending = (name: string, key?: string): boolean =>
  PENDING_CLASS_NAMES.includes(name) ||
  (key !== undefined && PENDING_CLASS_NAMES.includes(`${name}.${key}`));

function isComponentLike(value: unknown): value is object {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}

function displayNameOf(value: object): string {
  const own: unknown = Reflect.get(value, 'displayName');
  if (typeof own === 'string') return own;
  const inner: unknown = Reflect.get(value, 'type'); // React.memo(Component)
  if ((typeof inner === 'function' || typeof inner === 'object') && inner !== null) {
    const name: unknown = Reflect.get(inner, 'displayName');
    if (typeof name === 'string') return name;
  }
  return '';
}

/** The entry's public components and their compound members, by flat name (`CardHeader`). */
function publicComponents(): Map<string, object> {
  const found = new Map<string, object>();
  for (const [name, value] of Object.entries(entry)) {
    if (!/^[A-Z]/.test(name) || !isComponentLike(value)) continue;
    found.set(name, value);
    for (const key of Object.keys(value)) {
      const member: unknown = Reflect.get(value, key);
      if (/^[A-Z]/.test(key) && isComponentLike(member)) found.set(`${name}${key}`, member);
    }
  }
  return found;
}

/**
 * The constant of a public component: by its flat name, else by its displayName (the alias table
 * of `getStableClassNames`: `RadioItem`, `TableHead`, and `ComboboxOption`, whose value is Option).
 */
function constantOf(flatName: string, value: object): string | undefined {
  const byName = `${flatName[0].toLowerCase()}${flatName.slice(1)}ClassNames`;
  if (Object.hasOwn(registry, byName)) return byName;
  return getStableClassNames(displayNameOf(value))?.constant;
}

describe('class-name registry: completeness (spec §1.4.3)', () => {
  const components = publicComponents();

  it('has a constant for every public component and compound member, or lists it on NO_ELEMENT', () => {
    const missing = [...components]
      .filter(
        ([flat, value]) => constantOf(flat, value) === undefined && !NO_ELEMENT.includes(flat),
      )
      .map(([flat]) => flat)
      .sort();
    expect(missing).toEqual([]);
  });

  it('lists on NO_ELEMENT only components without a constant, sorted', () => {
    const wrong = NO_ELEMENT.filter((flat) => {
      const value = components.get(flat);
      return value !== undefined && constantOf(flat, value) !== undefined;
    });
    expect(wrong).toEqual([]);
    expect(NO_ELEMENT).toEqual([...new Set(NO_ELEMENT)].sort());
  });

  it("resolves every public component's displayName to its constant (the gate rule and testClassName find it)", () => {
    const unresolved = [...components]
      .filter(([flat, value]) => {
        const constant = constantOf(flat, value);
        return (
          constant !== undefined && getStableClassNames(displayNameOf(value))?.constant !== constant
        );
      })
      .map(([flat, value]) => `${flat} (displayName "${displayNameOf(value)}")`);
    expect(unresolved).toEqual([]);
  });

  it('names every constant after a public component, except the pending Phase 3 constants', () => {
    const orphans = constants
      .map(([name]) => name)
      .filter((name) => !isPending(name))
      .filter(
        (name) => !components.has(`${name[0].toUpperCase()}${name.slice(1, -'ClassNames'.length)}`),
      );
    expect(orphans).toEqual([]);
  });
});

describe('class-name registry: applied in src/components (spec §1.4.3)', () => {
  const sources = Object.values(
    import.meta.glob<string>(['../components/**/*.{ts,tsx}', '!**/__tests__/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).join('\n');

  it('uses every root and part as <constant>.<key> in a component module, except the pending ones', () => {
    const unapplied: string[] = [];
    for (const [name, value] of constants) {
      for (const key of Object.keys(value)) {
        if (isPending(name, key)) continue;
        if (!new RegExp(`(?<![\\w$])${name}\\.${key}(?![\\w$])`).test(sources)) {
          unapplied.push(`${name}.${key}`);
        }
      }
    }
    expect(unapplied.sort()).toEqual([]);
  });

  it('keeps PENDING_CLASS_NAMES sorted, free of duplicates and naming registry entries', () => {
    expect(PENDING_CLASS_NAMES).toEqual([...new Set(PENDING_CLASS_NAMES)].sort());
    const unknown = PENDING_CLASS_NAMES.filter((pending) => {
      const [name, key] = pending.split('.');
      const constant: unknown = Reflect.get(registry, name);
      return (
        typeof constant !== 'object' ||
        constant === null ||
        (key !== undefined && !Object.hasOwn(constant, key))
      );
    });
    expect(unknown).toEqual([]);
  });
});
