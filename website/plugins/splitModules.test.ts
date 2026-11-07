import { describe, expect, it } from 'vitest';
import { splitModule, splitModules } from './splitModules.mjs';

const ICONS = `import * as React from 'react';
import { withFlipClass } from './flipIcon';
import type { Size } from './types';

export interface IconProps { size?: Size }

function createIcon(name: string) {
  const Icon = (props: IconProps) => <svg className={withFlipClass(name)} {...props} />;
  Icon.displayName = name;
  return Icon;
}

const CHEVRON = 'M 0 0';

export const DismissIcon = /* @__PURE__ */ createIcon('dismiss');
export const ChevronIcon = /* @__PURE__ */ createIcon(CHEVRON);
`;

describe('splitModule', () => {
  it('gives each exported declaration a part and keeps a shared helper in a part of its own', () => {
    const { facade, parts } = splitModule(ICONS, 'icons.tsx');
    const dismiss = parts.find((part) => part.names.includes('DismissIcon'));
    const chevron = parts.find((part) => part.names.includes('ChevronIcon'));
    const helper = parts.find((part) => part.names.includes('createIcon'));
    expect(dismiss && chevron && helper).toBeTruthy();
    expect(new Set([dismiss, chevron, helper]).size).toBe(3);

    expect(facade).toContain(
      `export { DismissIcon } from './icons.tsx?wave-split=${dismiss!.index}';`,
    );
    expect(facade).toContain(
      `export { ChevronIcon } from './icons.tsx?wave-split=${chevron!.index}';`,
    );
    expect(facade).not.toContain('createIcon');
    // Types are erased: the facade re-exports values only.
    expect(facade).not.toContain('IconProps');

    // A part imports the helper from the helper's part and the library imports it uses.
    expect(dismiss!.code).toContain(
      `import { createIcon } from './icons.tsx?wave-split=${helper!.index}';`,
    );
    expect(dismiss!.code).toContain("const DismissIcon = /* @__PURE__ */ createIcon('dismiss');");
    expect(dismiss!.code).toContain('export { DismissIcon };');
    expect(dismiss!.code).not.toContain('CHEVRON');
    const constant = parts.find((part) => part.names.includes('CHEVRON'))!;
    expect(constant.code).toBe("const CHEVRON = 'M 0 0';\nexport { CHEVRON };\n");
    expect(chevron!.code).toContain(
      `import { CHEVRON } from './icons.tsx?wave-split=${constant.index}';`,
    );
    expect(helper!.code).toContain("import { withFlipClass } from './flipIcon';");
    expect(helper!.code).toContain("import * as React from 'react';");
    expect(helper!.code).toContain('function createIcon(name: string) {');
    expect(helper!.code).toContain('export { createIcon };');
    // The import the part does not use stays out of it.
    expect(dismiss!.code).not.toContain('./flipIcon');
  });

  it('keeps declarations that reference each other in one part', () => {
    const source = `const isEven = (n: number): boolean => (n === 0 ? true : isOdd(n - 1));
const isOdd = (n: number): boolean => (n === 0 ? false : isEven(n - 1));
export const parity = (n: number) => (isEven(n) ? 'even' : 'odd');
export const half = 2;
`;
    const { parts } = splitModule(source, 'parity.ts');
    const pair = parts.find((part) => part.names.includes('isEven'))!;
    expect(pair.names).toContain('isOdd');
    const parity = parts.find((part) => part.names.includes('parity'))!;
    expect(parity).not.toBe(pair);
    expect(parity.code).toContain(`import { isEven } from './parity.ts?wave-split=${pair.index}';`);
    // Each part is emitted after the parts it imports from.
    expect(pair.index).toBeLessThan(parity.index);
  });

  it('keeps a `let` or `var` binding in one part with every declaration that uses it', () => {
    const source = `let cache: number | undefined;
var hits = 0;
export function get() { hits++; return (cache ??= 1); }
export const peek = () => cache;
export const count = () => hits;
export const unrelated = 2;
`;
    const { parts } = splitModule(source, 'cache.ts');
    const cache = parts.find((part) => part.names.includes('cache'))!;
    expect(cache.names.sort()).toEqual(['cache', 'count', 'get', 'hits', 'peek']);
    expect(parts.find((part) => part.names.includes('unrelated'))).not.toBe(cache);
  });

  it('puts a statement that mutates a declaration in that declaration’s part', () => {
    const source = `export function Thing() { return null; }
Thing.displayName = 'Thing';
export const other = 1;
`;
    const { parts } = splitModule(source, 'thing.ts');
    const thing = parts.find((part) => part.names.includes('Thing'))!;
    expect(thing.code).toContain("Thing.displayName = 'Thing';");
    expect(parts.find((part) => part.names.includes('other'))!.code).not.toContain('displayName');
  });

  it('reads export lists, renames and re-exports from other modules', () => {
    const source = `const a = 1;
const b = 2;
export { a, b as bee };
export { c } from './c';
export * from './d';
export type { T } from './t';
`;
    const { facade, parts } = splitModule(source, 'list.ts');
    const a = parts.find((part) => part.names.includes('a'))!;
    const b = parts.find((part) => part.names.includes('b'))!;
    expect(facade).toContain(`export { a } from './list.ts?wave-split=${a.index}';`);
    expect(facade).toContain(`export { b as bee } from './list.ts?wave-split=${b.index}';`);
    expect(facade).toContain("export { c } from './c';");
    expect(facade).toContain("export * from './d';");
    expect(facade).not.toContain('./t');
  });

  it('does not count a property name or an object key as a reference', () => {
    const source = `const root = 'r';
export const names = { root: 'wave-x', other: 'y' };
export const read = (value: { root: string }) => value.root;
`;
    const { parts } = splitModule(source, 'names.ts');
    for (const part of parts.filter((item) => !item.names.includes('root'))) {
      expect(part.code).not.toContain('wave-split');
    }
  });

  it('refuses a side-effect import, which importers of the parts would skip', () => {
    expect(() => splitModule("import './register';\nexport const a = 1;\n", 'effects.ts')).toThrow(
      "effects.ts: cannot split a side-effect import (import './register';): it runs when the module loads, which importers of its parts skip",
    );
  });

  it('refuses a top-level expression other than a property assignment to a declared name', () => {
    const icons = (statement: string) =>
      [
        "import { register } from './registry';",
        'export const DismissIcon = () => null;',
        statement,
        '',
      ].join('\n');
    // A call would run only when its part is imported, not when the module loads.
    expect(() => splitModule(icons('register(DismissIcon);'), 'icons.tsx')).toThrow(
      'icons.tsx: cannot split the top-level expression `register(DismissIcon);`: only a property assignment to a declared name (`Name.prop = …`) may stand at the top level',
    );
    expect(() => splitModule(icons('DismissIcon.count += 1;'), 'icons.tsx')).toThrow(
      /icons\.tsx: cannot split the top-level expression `DismissIcon\.count \+= 1;`/,
    );
    expect(() => splitModule(icons("register.icons = 'all';"), 'icons.tsx')).toThrow(
      "icons.tsx: cannot split `register.icons = 'all';`: it assigns to `register`, which the module does not declare",
    );
    // The accepted shape still goes with its declaration.
    const { parts } = splitModule(icons("DismissIcon.displayName = 'DismissIcon';"), 'icons.tsx');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.code).toContain("DismissIcon.displayName = 'DismissIcon';");
  });

  it('refuses a top-level statement it cannot place', () => {
    expect(() => splitModule("console.log('loaded');\nexport const a = 1;\n", 'side.ts')).toThrow(
      /side\.ts: cannot split the top-level expression `console\.log\('loaded'\);`/,
    );
    expect(() => splitModule('if (globalThis.x) {}\nexport const a = 1;\n', 'if.ts')).toThrow(
      /if\.ts: cannot split a top-level IfStatement/,
    );
    expect(() => splitModule('export default 42;\n', 'default.ts')).toThrow(
      /default\.ts: cannot split `export default` of an expression/,
    );
  });
});

describe('splitModules (the Vite plugin)', () => {
  it('loads the facade for the module and each part for its query, for the listed files only', async () => {
    const files = new Map([['/repo/src/lib/icons.tsx', ICONS]]);
    const plugin = splitModules({
      files: ['/repo/src/lib/icons.tsx'],
      readFile: (file: string) => files.get(file)!,
    });
    const load = plugin.load as (id: string) => string | undefined;
    const facade = load('/repo/src/lib/icons.tsx');
    expect(facade).toContain("from './icons.tsx?wave-split=");
    const part = load('/repo/src/lib/icons.tsx?wave-split=0');
    expect(part).toContain('createIcon');
    expect(load('/repo/src/lib/other.tsx')).toBeUndefined();
    expect(load('/repo/src/lib/icons.tsx?raw')).toBeUndefined();
  });

  it('rewrites an importer to import each name from its part', async () => {
    const files = new Map([['/repo/src/lib/icons.tsx', ICONS]]);
    const plugin = splitModules({
      files: ['/repo/src/lib/icons.tsx'],
      readFile: (file: string) => files.get(file)!,
    });
    const transform = plugin.transform as (
      this: { resolve: (source: string, importer: string) => Promise<{ id: string } | null> },
      code: string,
      id: string,
    ) => Promise<{ code: string } | undefined>;
    const context = {
      resolve: async (source: string) =>
        source.endsWith('/icons') ? { id: '/repo/src/lib/icons.tsx' } : { id: `/repo/${source}` },
    };
    const parts = splitModule(ICONS, 'icons.tsx').parts;
    const part = (name: string) =>
      `/repo/src/lib/icons.tsx?wave-split=${parts.find((item) => item.names.includes(name))!.index}`;

    const importer = [
      "import * as React from 'react';",
      "import { DismissIcon, ChevronIcon as Chevron, type IconProps } from '../lib/icons';",
      "import type { IconComponent } from '../lib/icons';",
      "export { DismissIcon as Close } from '../lib/icons';",
      "import * as Icons from '../lib/icons';",
      'export const x = [DismissIcon, Chevron, Icons];',
      '',
    ].join('\n');
    const result = await transform.call(context, importer, '/repo/src/components/Thing.tsx');
    expect(result!.code).toBe(
      [
        "import * as React from 'react';",
        `import { DismissIcon } from '${part('DismissIcon')}'; import { ChevronIcon as Chevron } from '${part('ChevronIcon')}';`,
        "import type { IconComponent } from '../lib/icons';",
        `export { DismissIcon as Close } from '${part('DismissIcon')}';`,
        "import * as Icons from '../lib/icons';",
        'export const x = [DismissIcon, Chevron, Icons];',
        '',
      ].join('\n'),
    );

    // A module that names no listed file is left alone, and so is the listed file itself.
    expect(await transform.call(context, "import { a } from './other';\n", '/repo/x.ts')).toBe(
      undefined,
    );
    expect(await transform.call(context, ICONS, '/repo/src/lib/icons.tsx')).toBe(undefined);
  });

  it('keeps a name the listed file re-exports from elsewhere on the original specifier', async () => {
    const plugin = splitModules({
      files: ['/repo/lib/list.ts'],
      readFile: () => "export { c } from './c';\nexport const a = 1;\n",
    });
    const transform = plugin.transform as unknown as (
      this: { resolve: () => Promise<{ id: string }> },
      code: string,
      id: string,
    ) => Promise<{ code: string } | undefined>;
    const result = await transform.call(
      { resolve: async () => ({ id: '/repo/lib/list.ts' }) },
      "import { a, c } from './lib/list';\n",
      '/repo/x.ts',
    );
    expect(result!.code).toBe(
      "import { a } from '/repo/lib/list.ts?wave-split=0'; import { c } from './lib/list';\n",
    );
  });

  it('resolves a part id, relative or absolute, to the part', async () => {
    const plugin = splitModules({ files: ['/repo/src/lib/icons.tsx'], readFile: () => ICONS });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => string | undefined;
    expect(resolveId('./icons.tsx?wave-split=2', '/repo/src/lib/icons.tsx')).toBe(
      '/repo/src/lib/icons.tsx?wave-split=2',
    );
    expect(resolveId('/repo/src/lib/icons.tsx?wave-split=2', '/repo/src/x.tsx')).toBe(
      '/repo/src/lib/icons.tsx?wave-split=2',
    );
    expect(resolveId('./other.tsx?wave-split=2', '/repo/src/lib/icons.tsx')).toBe(undefined);
  });

  it('matches Windows paths with either separator', () => {
    const plugin = splitModules({
      files: ['C:\\repo\\src\\lib\\icons.tsx'],
      readFile: () => ICONS,
    });
    const load = plugin.load as (id: string) => string | undefined;
    expect(load('C:/repo/src/lib/icons.tsx')).toContain("from './icons.tsx?wave-split=");
  });
});
