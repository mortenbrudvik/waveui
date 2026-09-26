// @vitest-environment node
/**
 * `scripts/verify-dist.mjs` (repo-level#2, #3, #4, #5): every check runs against small synthetic
 * `dist/` trees that reproduce one packaging defect each — a missing or misplaced `"use client"`,
 * a single-module bundle that defeats tree-shaking, a missing CommonJS declaration, a bundled or
 * undeclared dependency, a dotted-only compound — and against a correct tree that passes.
 *
 * The fixtures live under the repository's `node_modules/.cache`, so `react` resolves from them
 * exactly as it does from the real `dist/` (the react-server check needs it).
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  checkCjsParity,
  checkDeclarations,
  checkDevEnvironment,
  checkDirectives,
  checkFlatExports,
  checkImports,
  checkServerImport,
  clientReferenceStub,
  createWorkDir,
  directivePrologue,
  entryStatus,
  expectsUseClient,
  importSpecifiers,
  isMainModule,
  main,
  missingDeclarations,
  PENDING_FLAT_EXPORTS,
  probeIncludes,
  probeSizeBudget,
  probeTreeShaking,
  removeWorkDir,
  REQUIRED_DECLARATIONS,
  runScript,
  undocumentedComponents,
  verifyDist,
} from '../verify-dist.mjs';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
// Removed with its parent once no other run uses the parent (no empty directory is left behind).
const fixtureRun = createWorkDir(
  join(repoRoot, 'node_modules', '.cache', 'wave-verify-dist-test'),
  'run-',
);
const fixtureRoot = fixtureRun.work;
afterAll(() => removeWorkDir(fixtureRun));

const DIRECTIVE = '"use client";\n';

/**
 * The fixture's rolled-up declarations: every name on REQUIRED_DECLARATIONS (a utility, a
 * documented component, a props type, a documented compound and a hook), and the empty export
 * list that ends every roll-up.
 */
const DTS =
  'export declare function cn(...inputs: unknown[]): string;\n' +
  '/** A button. */\nexport declare const Button: (props: object) => null;\n' +
  'export declare type ButtonProps = { disabled?: boolean };\n' +
  '/** A menu. */\nexport declare const Menu: (props: object) => null;\n' +
  'export declare function usePresence(visible: boolean): { isMounted: boolean };\n' +
  '\nexport { }\n';

/** What vite-plugin-dts rolls up when TypeScript writes the declarations elsewhere. */
const EMPTY_ROLL_UP = 'export { }\n';

/** A correct preserveModules dist: Button, a Card and a Dialog compound, a hook and `cn`. */
function goodFiles() {
  const component = (name, members = []) => {
    const parts = members.map(
      (member) =>
        `function ${name}${member}() { return null; }\n${name}${member}.displayName = '${name}${member}';\n`,
    );
    const assign = members.length
      ? `export const ${name} = /* @__PURE__ */ Object.assign(${name}Root, { ${members
          .map((member) => `${member}: ${name}${member}`)
          .join(', ')} });\n`
      : `export const ${name} = ${name}Root;\n`;
    const esm =
      `${DIRECTIVE}import { cn } from '../../lib/cn.mjs';\n` +
      `function ${name}Root(props) { return cn('${name.toLowerCase()}', props && props.className); }\n` +
      `${name}Root.displayName = '${name}';\n${parts.join('')}${assign}` +
      (members.length ? `export { ${members.map((member) => name + member).join(', ')} };\n` : '');
    const cjs =
      `${DIRECTIVE}const { cn } = require('../../lib/cn.cjs');\n` +
      `function ${name}Root(props) { return cn('${name.toLowerCase()}', props && props.className); }\n` +
      `${name}Root.displayName = '${name}';\n${parts.join('')}` +
      `exports.${name} = Object.assign(${name}Root, { ${members
        .map((member) => `${member}: ${name}${member}`)
        .join(', ')} });\n` +
      members.map((member) => `exports.${name}${member} = ${name}${member};\n`).join('');
    return { esm, cjs };
  };
  const button = component('Button');
  const card = component('Card', ['Header']);
  const dialog = component('Dialog', ['Trigger', 'Content']);
  // The presence core (0.7): a hook and a component on it, with React external.
  const usePresence = {
    esm:
      `${DIRECTIVE}import { useState } from 'react';\n` +
      "export function usePresence(visible) { const [phase] = useState(visible ? 'entered' : 'exited'); return { isMounted: visible, phase }; }\n",
    cjs:
      `${DIRECTIVE}const react = require('react');\n` +
      "exports.usePresence = function usePresence(visible) { const [phase] = react.useState(visible ? 'entered' : 'exited'); return { isMounted: visible, phase }; };\n",
  };
  const presence = {
    esm:
      `${DIRECTIVE}import { jsx } from 'react/jsx-runtime';\n` +
      "import { usePresence } from '../../hooks/usePresence.mjs';\n" +
      "function Presence(props) { const { isMounted, phase } = usePresence(props.visible); return isMounted ? jsx('div', { 'data-presence': phase, children: props.children }) : null; }\n" +
      "Presence.displayName = 'Presence';\nexport { Presence };\n",
    cjs:
      `${DIRECTIVE}const jsxRuntime = require('react/jsx-runtime');\n` +
      "const hook = require('../../hooks/usePresence.cjs');\n" +
      "function Presence(props) { const { isMounted, phase } = hook.usePresence(props.visible); return isMounted ? jsxRuntime.jsx('div', { 'data-presence': phase, children: props.children }) : null; }\n" +
      "Presence.displayName = 'Presence';\nexports.Presence = Presence;\n",
  };
  // A component on the presence core (Menu.Popover, 0.7): an import of only Menu holds it.
  const menu = {
    esm:
      `${DIRECTIVE}import { jsx } from 'react/jsx-runtime';\n` +
      "import { usePresence } from '../../hooks/usePresence.mjs';\n" +
      "function Menu(props) { const { isMounted, phase } = usePresence(props.open); return isMounted ? jsx('div', { role: 'menu', 'data-presence': phase, children: props.children }) : null; }\n" +
      "Menu.displayName = 'Menu';\nexport { Menu };\n",
    cjs:
      `${DIRECTIVE}const jsxRuntime = require('react/jsx-runtime');\n` +
      "const hook = require('../../hooks/usePresence.cjs');\n" +
      "function Menu(props) { const { isMounted, phase } = hook.usePresence(props.open); return isMounted ? jsxRuntime.jsx('div', { role: 'menu', 'data-presence': phase, children: props.children }) : null; }\n" +
      "Menu.displayName = 'Menu';\nexports.Menu = Menu;\n",
  };
  // src/lib/dev.ts reads the bundler-injected mode at call time.
  const dev = (exportSyntax) =>
    `function isDevEnvironment() {\n  try {\n    return process.env.NODE_ENV !== "production";\n  } catch {\n    return true;\n  }\n}\n${exportSyntax}`;
  return {
    'package.json': JSON.stringify({
      name: 'wave-fixture',
      type: 'module',
      sideEffects: ['*.css'],
      dependencies: { clsx: '^2.1.1' },
      peerDependencies: { react: '^19.0.0' },
    }),
    'dist/lib/cn.mjs':
      "export function cn(...inputs) { return inputs.filter(Boolean).join(' '); }\n",
    'dist/lib/cn.cjs':
      "exports.cn = function cn(...inputs) { return inputs.filter(Boolean).join(' '); };\n",
    'dist/lib/dev.mjs': dev('export const isDev = isDevEnvironment();\n'),
    'dist/lib/dev.cjs': dev('exports.isDev = isDevEnvironment();\n'),
    'dist/hooks/useThing.mjs': `${DIRECTIVE}import { useState } from 'react';\nexport function useThing() { return useState(0); }\n`,
    'dist/hooks/useThing.cjs': `${DIRECTIVE}const react = require('react');\nexports.useThing = function useThing() { return react.useState(0); };\n`,
    'dist/components/button/Button.mjs': button.esm,
    'dist/components/button/Button.cjs': button.cjs,
    'dist/components/layout/Card.mjs': card.esm,
    'dist/components/layout/Card.cjs': card.cjs,
    'dist/components/overlays/Dialog.mjs': dialog.esm,
    'dist/components/overlays/Dialog.cjs': dialog.cjs,
    'dist/hooks/usePresence.mjs': usePresence.esm,
    'dist/hooks/usePresence.cjs': usePresence.cjs,
    'dist/components/motion/Presence.mjs': presence.esm,
    'dist/components/motion/Presence.cjs': presence.cjs,
    'dist/components/navigation/Menu.mjs': menu.esm,
    'dist/components/navigation/Menu.cjs': menu.cjs,
    'dist/index.mjs':
      "export { cn } from './lib/cn.mjs';\n" +
      "export { useThing } from './hooks/useThing.mjs';\n" +
      "export { Button } from './components/button/Button.mjs';\n" +
      "export { Card, CardHeader } from './components/layout/Card.mjs';\n" +
      "export { Dialog, DialogTrigger, DialogContent } from './components/overlays/Dialog.mjs';\n" +
      "export { usePresence } from './hooks/usePresence.mjs';\n" +
      "export { Presence } from './components/motion/Presence.mjs';\n" +
      "export { Menu } from './components/navigation/Menu.mjs';\n",
    'dist/index.cjs':
      "Object.defineProperty(exports, '__esModule', { value: true });\n" +
      "const cn = require('./lib/cn.cjs');\n" +
      "const hook = require('./hooks/useThing.cjs');\n" +
      "const button = require('./components/button/Button.cjs');\n" +
      "const card = require('./components/layout/Card.cjs');\n" +
      "const dialog = require('./components/overlays/Dialog.cjs');\n" +
      "const presenceHook = require('./hooks/usePresence.cjs');\n" +
      "const presence = require('./components/motion/Presence.cjs');\n" +
      "const menu = require('./components/navigation/Menu.cjs');\n" +
      'exports.cn = cn.cn;\nexports.useThing = hook.useThing;\nexports.Button = button.Button;\n' +
      'exports.Card = card.Card;\nexports.CardHeader = card.CardHeader;\n' +
      'exports.Dialog = dialog.Dialog;\nexports.DialogTrigger = dialog.DialogTrigger;\n' +
      'exports.DialogContent = dialog.DialogContent;\n' +
      'exports.usePresence = presenceHook.usePresence;\nexports.Presence = presence.Presence;\n' +
      'exports.Menu = menu.Menu;\n',
    'dist/index.d.ts': DTS,
    'dist/index.d.cts': DTS,
  };
}

let fixtureCount = 0;

/** Writes a fixture package (the good files, with `overrides`; `null` removes a file). */
function fixture(overrides = {}) {
  const dir = join(fixtureRoot, `f${++fixtureCount}`);
  const files = { ...goodFiles(), ...overrides };
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return { dir, dist: join(dir, 'dist') };
}

const noPending = { pendingFlatExports: [] };

describe('directivePrologue', () => {
  it.each([
    ['"use client";import x from "y";', ['use client']],
    ["'use client'\nimport x from 'y';", ['use client']],
    ['"use client";const e=require(`../x.cjs`);', ['use client']],
    ['// banner\n/* more */\n"use client";\nexport {};', ['use client']],
    ['"use strict";\n"use client";\nexports.a = 1;', ['use strict', 'use client']],
    ['#!/usr/bin/env node\n"use client";', ['use client']],
  ])('reads the prologue of %j', (code, expected) => {
    expect(directivePrologue(code)).toEqual(expected);
  });

  it.each([
    'const x = "use client";',
    '`use client`;\nexport {};',
    'import "use client";',
    '"use client" + suffix;',
    '',
  ])('finds no directive in %j', (code) => {
    expect(directivePrologue(code)).toEqual([]);
  });
});

describe('importSpecifiers', () => {
  it.each([
    ['import { a } from "left-pad";', ['left-pad']],
    ["import x, { y } from './z.mjs';\nexport * from './w.mjs';", ['./z.mjs', './w.mjs']],
    ['import "./side.mjs";\nexport { a as b } from "./q.mjs";', ['./side.mjs', './q.mjs']],
    ['export * as ns from "./ns.mjs";', ['./ns.mjs']],
    // Whitespace-minified ES output.
    ['import{a as b}from"left-pad";', ['left-pad']],
    ['export*from"./y.mjs";', ['./y.mjs']],
    ['export{a as b}from"./q.mjs"', ['./q.mjs']],
    ['const x=1;import{a}from"./m.mjs"', ['./m.mjs']],
    [
      '"use client";import{jsx as e}from"react/jsx-runtime";import"./s.mjs";',
      ['react/jsx-runtime', './s.mjs'],
    ],
    ['function f(){}import{c}from"./c.mjs";', ['./c.mjs']],
    ['/*! banner */import{d}from"./d.mjs";', ['./d.mjs']],
    // Dynamic imports and CommonJS requires, minified.
    ['const m=await import("./lazy.mjs")', ['./lazy.mjs']],
    [
      '"use client";const e=require(`../../_virtual/runtime.cjs`),t=require("react");',
      ['../../_virtual/runtime.cjs', 'react'],
    ],
  ])('finds the specifiers of %j', (code, expected) => {
    expect(importSpecifiers(code)).toEqual(expected);
  });

  it.each([
    'const important = fromValue("x");',
    'export const from = "./not-an-import.mjs";',
    'export default fromX("y");',
    'exports.a = "./not-an-import.cjs";',
  ])('finds no specifier in %j', (code) => {
    expect(importSpecifiers(code)).toEqual([]);
  });
});

describe('expectsUseClient', () => {
  it.each([
    ['components/button/Button.mjs', true],
    ['components/button/Button.cjs', true],
    ['hooks/useControllable.mjs', true],
    ['components/button/index.mjs', false],
    ['hooks/index.cjs', false],
    ['index.mjs', false],
    ['index.cjs', false],
    ['lib/cn.mjs', false],
    ['lib/cn.cjs', false],
    ['_virtual/_rolldown/runtime.cjs', false],
  ])('%s -> %s', (path, expected) => {
    expect(expectsUseClient(path)).toBe(expected);
  });
});

describe('checkDirectives (repo-level#2)', () => {
  it('passes a correct dist', () => {
    expect(checkDirectives(fixture().dist)).toEqual([]);
  });

  it('reports a component or hook module without the directive, per format', () => {
    const { dist } = fixture({
      'dist/components/button/Button.mjs': goodFiles()['dist/components/button/Button.mjs'].replace(
        DIRECTIVE,
        '',
      ),
      'dist/hooks/useThing.cjs': goodFiles()['dist/hooks/useThing.cjs'].replace(DIRECTIVE, ''),
    });
    const errors = checkDirectives(dist);
    expect(errors).toEqual([
      expect.stringContaining('components/button/Button.mjs'),
      expect.stringContaining('hooks/useThing.cjs'),
    ]);
    expect(errors.join('\n')).toMatch(/lacks "use client"/);
  });

  it('reports the directive in cn, in the entry and in any index barrel', () => {
    const { dist } = fixture({
      'dist/lib/cn.mjs': DIRECTIVE + goodFiles()['dist/lib/cn.mjs'],
      'dist/index.cjs': DIRECTIVE + goodFiles()['dist/index.cjs'],
      'dist/components/button/index.mjs': `${DIRECTIVE}export { Button } from './Button.mjs';\n`,
    });
    const errors = checkDirectives(dist);
    expect(errors).toHaveLength(3);
    for (const path of ['lib/cn.mjs', 'index.cjs', 'components/button/index.mjs']) {
      expect(errors.some((error) => error.includes(path) && /must not/.test(error))).toBe(true);
    }
  });

  it('reports a dist without per-module component files (a single bundle)', () => {
    const files = {};
    for (const path of Object.keys(goodFiles())) {
      if (path.startsWith('dist/components/') || path.startsWith('dist/hooks/')) {
        files[path] = null;
      }
    }
    expect(checkDirectives(fixture(files).dist)).toEqual([
      expect.stringMatching(/no component or hook modules/),
    ]);
  });
});

describe('checkDeclarations (repo-level#5)', () => {
  it('passes when index.d.ts and its index.d.cts copy exist', () => {
    expect(checkDeclarations(fixture().dist)).toEqual([]);
  });

  it('reports a missing index.d.cts', () => {
    expect(checkDeclarations(fixture({ 'dist/index.d.cts': null }).dist)).toEqual([
      expect.stringContaining('index.d.cts'),
    ]);
  });

  it('reports a missing or empty index.d.ts', () => {
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': null }).dist)).toEqual(
      expect.arrayContaining([expect.stringContaining('index.d.ts')]),
    );
    expect(
      checkDeclarations(fixture({ 'dist/index.d.ts': '', 'dist/index.d.cts': '' }).dist),
    ).not.toEqual([]);
  });

  it('reports an index.d.cts that is not a copy of index.d.ts', () => {
    expect(
      checkDeclarations(fixture({ 'dist/index.d.cts': `${DTS}export declare const x: 1;\n` }).dist),
    ).toEqual([expect.stringMatching(/index\.d\.cts differs/)]);
  });

  it('reports an exported component without a JSDoc (C-DOCS)', () => {
    const dts = `${DTS}export declare const Card: () => null;\n`;
    expect(
      checkDeclarations(fixture({ 'dist/index.d.ts': dts, 'dist/index.d.cts': dts }).dist),
    ).toEqual([
      'index.d.ts: the exported component Card has no JSDoc (document it on its export, C-DOCS)',
    ]);
  });

  it('finds every name on REQUIRED_DECLARATIONS in the fixture (extend DTS with the list)', () => {
    expect(REQUIRED_DECLARATIONS.length).toBeGreaterThan(0);
    expect(missingDeclarations(DTS, REQUIRED_DECLARATIONS)).toEqual([]);
  });

  it('reports an empty roll-up (only `export { }`) in both files', () => {
    const { dist } = fixture({
      'dist/index.d.ts': EMPTY_ROLL_UP,
      'dist/index.d.cts': EMPTY_ROLL_UP,
    });
    expect(checkDeclarations(dist)).toEqual([
      "index.d.ts does not declare and export cn, Button, ButtonProps, Menu, usePresence (an empty or partial roll-up: check tsconfig.json's rootDir and the declaration plugin in vite.config.ts)",
      "index.d.cts does not declare and export cn, Button, ButtonProps, Menu, usePresence (an empty or partial roll-up: check tsconfig.json's rootDir and the declaration plugin in vite.config.ts)",
    ]);
  });

  it('names each required name a partial roll-up leaves out', () => {
    const dts = DTS.replace('export declare type ButtonProps', 'declare type ButtonProps').replace(
      '/** A menu. */\nexport declare const Menu',
      '/** A menu. */\ndeclare const Menu',
    );
    expect(
      checkDeclarations(fixture({ 'dist/index.d.ts': dts, 'dist/index.d.cts': dts }).dist),
    ).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export ButtonProps, Menu \(/),
      expect.stringMatching(/^index\.d\.cts does not declare and export ButtonProps, Menu \(/),
    ]);
  });

  it('checks index.d.cts on its own', () => {
    expect(checkDeclarations(fixture({ 'dist/index.d.cts': EMPTY_ROLL_UP }).dist)).toEqual([
      expect.stringMatching(/index\.d\.cts differs/),
      expect.stringMatching(
        /^index\.d\.cts does not declare and export cn, Button, ButtonProps, Menu, usePresence \(/,
      ),
    ]);
  });

  it('takes the required names as an option', () => {
    expect(checkDeclarations(fixture().dist, { requiredDeclarations: ['cn', 'Card'] })).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export Card \(/),
      expect.stringMatching(/^index\.d\.cts does not declare and export Card \(/),
    ]);
    const empty = fixture({ 'dist/index.d.ts': EMPTY_ROLL_UP, 'dist/index.d.cts': EMPTY_ROLL_UP });
    expect(checkDeclarations(empty.dist, { requiredDeclarations: [] })).toEqual([]);
  });
});

describe('missingDeclarations', () => {
  it('accepts exported values and types, also when an export list renames them', () => {
    const dts = [
      'export declare function cn(...inputs: unknown[]): string;',
      '/** A compound. */',
      'export declare const Card: { (props: CardProps): JSX.Element; Header: typeof CardHeader };',
      'export declare interface CardProps { title?: string }',
      "export declare type Size = 'small' | 'large';",
      'export declare enum Level { Low, High }',
      'export declare class Store {}',
      'declare const Image_2: () => null;',
      'declare interface Option_2 { value: string }',
      'export { Image_2 as Image }',
      'export { Option_2 as Option }',
      'export { }',
    ].join('\n');
    const names = ['cn', 'Card', 'CardProps', 'Size', 'Level', 'Store', 'Image', 'Option'];
    expect(missingDeclarations(dts, names)).toEqual([]);
  });

  it('names, in the given order, what is absent, local or exported without a declaration', () => {
    const dts = [
      'declare const Button: () => null;',
      'declare interface ButtonProps { disabled?: boolean }',
      'export { Ghost }',
      'export { Phantom_2 as Phantom }',
      'export { }',
    ].join('\n');
    expect(
      missingDeclarations(dts, ['usePresence', 'Button', 'ButtonProps', 'Ghost', 'Phantom']),
    ).toEqual(['usePresence', 'Button', 'ButtonProps', 'Ghost', 'Phantom']);
    expect(missingDeclarations('export { }\n', ['cn'])).toEqual(['cn']);
    expect(missingDeclarations('export { }\n', [])).toEqual([]);
  });
});

describe('undocumentedComponents (C-DOCS)', () => {
  it('accepts the declaration shapes of the rolled-up index.d.ts when they are documented', () => {
    const dts = [
      '/** A compound. */',
      'export declare const Card: {',
      '    (props: CardProps): JSX.Element;',
      '    Header: typeof CardHeader;',
      '};',
      '/** A polymorphic one. */',
      "export declare const Text: PolymorphicComponent<'span', TextOwnProps>;",
      '/** Documented on the first overload. */',
      'export declare function BreadcrumbItem(props: A): React_2.ReactElement;',
      '',
      'export declare function BreadcrumbItem(props: B): React_2.ReactElement;',
      '/** Renamed by the roll-up (a name the DOM lib also declares). */',
      'declare const Image_2: {',
      '    (props: ImageProps): JSX.Element;',
      '};',
      'export { Image_2 as Image }',
      '/** A namespace merged with a function. */',
      'export declare function RadioItem(props: RadioItemProps): JSX.Element;',
      'export declare namespace RadioItem {',
      '    var displayName: string;',
      '}',
    ].join('\n');
    expect(undocumentedComponents(dts)).toEqual([]);
  });

  it('names every exported component without a JSDoc, in declaration order', () => {
    const dts = [
      '/* A plain comment is no JSDoc. */',
      'export declare const Card: () => null;',
      '// Neither is a line comment.',
      'export declare function Item(props: A): R;',
      '/** Only the first overload counts. */',
      'export declare function Item(props: B): R;',
      'declare const Image_2: () => null;',
      'export { Image_2 as Image }',
    ].join('\n');
    expect(undocumentedComponents(dts)).toEqual(['Card', 'Item', 'Image']);
  });

  it('asks nothing of hooks, utilities, constants, types and unexported declarations', () => {
    const dts = [
      'export declare function useThing(): number;',
      'export declare function cn(...inputs: unknown[]): string;',
      'export declare const Z_INDEX: { dialog: number };',
      'export declare interface CardProps { title?: string }',
      "export declare type Size = 'small' | 'large';",
      'declare const Internal: () => null;',
    ].join('\n');
    expect(undocumentedComponents(dts)).toEqual([]);
  });
});

describe('checkDevEnvironment', () => {
  it('passes when dist/lib/dev.* read process.env.NODE_ENV at run time', () => {
    expect(checkDevEnvironment(fixture().dist)).toEqual([]);
  });

  it('reports a mode inlined at build time (a `define` in vite.config.ts) or a missing module', () => {
    const inlined = goodFiles()['dist/lib/dev.mjs'].replace('process.env.NODE_ENV', '"production"');
    expect(
      checkDevEnvironment(fixture({ 'dist/lib/dev.mjs': inlined, 'dist/lib/dev.cjs': null }).dist),
    ).toEqual([
      'lib/dev.mjs does not read process.env.NODE_ENV: the build inlined the mode (a `define` in ' +
        "vite.config.ts?), so the consumer's bundler can no longer choose development or production",
      'lib/dev.cjs is missing',
    ]);
  });
});

describe('checkImports (repo-level#4)', () => {
  const pkg = { dependencies: { clsx: '^2' }, peerDependencies: { react: '^19' } };

  it('passes when every bare import is a declared (peer) dependency or its subpath', () => {
    const { dist } = fixture({
      'dist/lib/extra.mjs':
        "import { clsx } from 'clsx';\nimport { jsx } from 'react/jsx-runtime';\nexport { clsx, jsx };\n",
    });
    expect(checkImports(dist, pkg)).toEqual([]);
  });

  it('reports an undeclared bare import and a node builtin', () => {
    const { dist } = fixture({
      'dist/lib/extra.mjs':
        "import merge from 'lodash/merge';\nimport fs from 'node:fs';\nexport { merge, fs };\n",
      'dist/lib/extra.cjs': 'const x = require(`left-pad`);\nexports.x = x;\n',
    });
    const errors = checkImports(dist, pkg);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/lib\/extra\.mjs.*lodash\/merge/),
        expect.stringMatching(/lib\/extra\.mjs.*node:fs/),
        expect.stringMatching(/lib\/extra\.cjs.*left-pad/),
      ]),
    );
  });

  it('reports a relative import that does not resolve inside dist', () => {
    const { dist } = fixture({
      'dist/lib/extra.mjs':
        "export { x } from './missing.mjs';\nexport { y } from '../../src/y.ts';\n",
    });
    expect(checkImports(dist, pkg)).toEqual([
      expect.stringMatching(/missing\.mjs/),
      expect.stringMatching(/src\/y\.ts/),
    ]);
  });

  it('reports a dependency bundled into dist (a node_modules path in the output)', () => {
    const { dist } = fixture({
      'dist/node_modules/clsx/dist/clsx.mjs': 'export function clsx() {}\n',
    });
    expect(checkImports(dist, pkg)).toEqual([expect.stringMatching(/bundled dependency/)]);
  });
});

describe('checkServerImport (repo-level#2)', () => {
  const withIndexImport = (line) => ({
    'dist/index.mjs': `${line}\n${goodFiles()['dist/index.mjs']}`,
  });

  it('loads the package in both formats under the react-server condition', async () => {
    expect(await checkServerImport(fixture().dist)).toEqual([]);
  });

  it('reports a cn module that needs client-only React APIs', async () => {
    const { dist } = fixture({
      'dist/lib/cn.mjs':
        "import { createContext } from 'react';\nconst Ctx = createContext(null);\n" +
        "export function cn(...inputs) { return Ctx && inputs.filter(Boolean).join(' '); }\n",
    });
    // Only the cause: index.mjs, which imports lib/cn.mjs, is not reported as well.
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(/lib\/cn\.mjs.*react-server/s),
    ]);
  });

  it('reports a cn that is missing or returns the wrong value', async () => {
    expect(await checkServerImport(fixture({ 'dist/lib/cn.cjs': null }).dist)).toEqual([
      expect.stringContaining('lib/cn.cjs'),
    ]);
    expect(
      await checkServerImport(
        fixture({ 'dist/lib/cn.mjs': 'export function cn() { return 1; }\n' }).dist,
      ),
    ).toEqual([expect.stringContaining('lib/cn.mjs')]);
  });

  it('loads every other src/lib module the entry imports, not only cn', async () => {
    const { dist } = fixture({
      ...withIndexImport("export { ThemeContext } from './lib/theme.mjs';"),
      'dist/lib/theme.mjs':
        "import { createContext } from 'react';\nexport const ThemeContext = createContext(null);\n",
      'dist/lib/theme.cjs':
        "const react = require('react');\nexports.ThemeContext = react.createContext(null);\n",
    });
    const errors = await checkServerImport(dist);
    expect(errors).toEqual([
      expect.stringMatching(/^lib\/theme\.cjs does not load under node --conditions=react-server/),
      expect.stringMatching(/^lib\/theme\.mjs does not load under node --conditions=react-server/),
    ]);
    expect(errors.join('\n')).not.toMatch(/^index\.mjs/m);
  });

  it('treats "use client" modules as client references, never evaluated on the server', async () => {
    const dialog = goodFiles()['dist/components/overlays/Dialog.mjs'].replace(
      "import { cn } from '../../lib/cn.mjs';\n",
      "import { cn } from '../../lib/cn.mjs';\nimport { createContext } from 'react';\n" +
        'const DialogContext = createContext(null);\n',
    );
    const { dist } = fixture({
      'dist/components/overlays/Dialog.mjs': dialog,
      // A server module may import (and pass through) a client component or hook.
      'dist/lib/registry.mjs':
        "import { useThing } from '../hooks/useThing.mjs';\nexport const registry = [useThing];\n",
      ...withIndexImport("export { registry } from './lib/registry.mjs';"),
    });
    expect(await checkServerImport(dist)).toEqual([]);
  });

  it('reports server code that dots into a client reference (Card.Header)', async () => {
    const { dist } = fixture({
      ...withIndexImport(
        "import { Card as CardRoot } from './components/layout/Card.mjs';\n" +
          'export const CardHeaderAlias = CardRoot.Header;',
      ),
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(/^index\.mjs does not load .*Cannot access Card\.Header on the server/),
    ]);
  });

  it('reports server code that awaits a client reference, as React refuses it', async () => {
    const { dist } = fixture({
      ...withIndexImport(
        "import { Card as CardRoot } from './components/layout/Card.mjs';\n" +
          'export const CardResolved = await Promise.resolve(CardRoot);',
      ),
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(/^index\.mjs does not load .*Cannot await or return from a thenable/),
    ]);
  });

  it('leaves no directory behind next to dist', async () => {
    const { dir, dist } = fixture();
    expect(await checkServerImport(dist)).toEqual([]);
    expect(readdirSync(dir).sort()).toEqual(['dist', 'package.json']);
  });

  it('reports an entry whose cn comes from a "use client" module', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/hooks/useThing.mjs': `${files['dist/hooks/useThing.mjs']}export { cn } from '../lib/cn.mjs';\n`,
      'dist/index.mjs': files['dist/index.mjs'].replace(
        "export { cn } from './lib/cn.mjs';",
        "export { cn } from './hooks/useThing.mjs';",
      ),
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(/^index\.mjs under node --conditions=react-server: cn is a client/),
    ]);
  });
});

describe('clientReferenceStub', () => {
  it('exports a client reference per name, in both formats', async () => {
    const esm = clientReferenceStub('components/x/Card.mjs', ['Card', 'default'], 'esm');
    expect(esm).toMatch(/export \{ reference0 as "Card", reference1 as "default" \};/);
    const cjs = clientReferenceStub('components/x/Card.cjs', ['Card', '__esModule'], 'cjs');
    expect(cjs).toMatch(/exports\["Card"\] = clientReference\("Card"\);/);
    expect(cjs).not.toMatch(/exports\["__esModule"\]/);

    const exports = {};
    new Function('exports', cjs)(exports);
    const { Card } = exports;
    expect(Card.$$typeof).toBe(Symbol.for('react.client.reference'));
    expect(Card.$$id).toBe('components/x/Card.cjs#Card');
    expect(Card.displayName).toBeUndefined();
    expect(() => Card()).toThrow(/Attempted to call Card\(\) from the server/);
    expect(() => Card.Header).toThrow(/Cannot access Card\.Header on the server/);
    expect(() => {
      Card.displayName = 'Card';
    }).toThrow(/Cannot assign to a client module/);
  });

  it('cannot be awaited or resolved as a thenable, like React client references', async () => {
    const exports = {};
    new Function('exports', clientReferenceStub('components/x/Card.cjs', ['Card'], 'cjs'))(exports);
    const { Card } = exports;
    const thenable = /Cannot await or return from a thenable/;
    expect(() => Card.then).toThrow(thenable);
    await expect(Promise.resolve(Card)).rejects.toThrow(thenable);
    await expect((async () => Card)()).rejects.toThrow(thenable);
  });
});

describe('createWorkDir and removeWorkDir', () => {
  const base = () => mkdtempSync(join(fixtureRoot, 'work-'));

  it('removes the work directory, its parent and every ancestor the run created', () => {
    const dir = base();
    const run = createWorkDir(join(dir, 'node_modules', '.cache', 'wave-x'), 'rsc-');
    expect(run.created).toBe(join(dir, 'node_modules'));
    expect(basename(run.work)).toMatch(/^rsc-/);
    expect(existsSync(run.work)).toBe(true);
    removeWorkDir(run);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('removes an empty parent left by an earlier run, but no ancestor it did not create', () => {
    const dir = base();
    const parent = join(dir, 'node_modules', '.cache', 'wave-x');
    mkdirSync(parent, { recursive: true });
    const run = createWorkDir(parent, 'rsc-');
    expect(run.created).toBeUndefined();
    removeWorkDir(run);
    expect(existsSync(parent)).toBe(false);
    expect(readdirSync(join(dir, 'node_modules', '.cache'))).toEqual([]);
  });

  it('keeps a parent that still holds the work directory of a concurrent run', () => {
    const parent = join(base(), 'cache');
    const first = createWorkDir(parent, 'rsc-');
    const second = createWorkDir(parent, 'rsc-');
    removeWorkDir(first);
    expect(readdirSync(parent)).toEqual([basename(second.work)]);
    removeWorkDir(second);
    expect(existsSync(parent)).toBe(false);
  });

  // Concurrent runs (two builds, CI jobs or agents) share the parent, and each run removes it
  // once empty: a run's mkdir/mkdtemp can land while another run deletes the parent (ENOENT)
  // or while Windows still has it delete-pending (EPERM). Neither may fail the run.
  it('survives concurrent runs that create and remove work directories in one parent', async () => {
    const parent = join(base(), 'wave-x'); // its parent exists, as node_modules/.cache does
    const child = [
      `import { createWorkDir, removeWorkDir } from ${JSON.stringify(
        new URL('../verify-dist.mjs', import.meta.url).href,
      )};`,
      'const [parent, start, duration] = process.argv.slice(1);',
      'while (Date.now() < Number(start)) {}', // start together, whatever the spawn latency
      'const end = Date.now() + Number(duration);',
      'let cycles = 0;',
      'const errors = [];',
      'while (Date.now() < end) {',
      '  cycles += 1;',
      "  try { removeWorkDir(createWorkDir(parent, 'rsc-')); }",
      '  catch (error) { errors.push(`${error.code}: ${error.message}`); }',
      '}',
      'process.stdout.write(JSON.stringify({ cycles, errors }));',
    ].join('\n');
    const start = String(Date.now() + 1000);
    const runs = await Promise.all(
      [1, 2, 3].map(
        () =>
          new Promise((done, fail) => {
            const proc = spawn(
              process.execPath,
              ['--input-type=module', '-e', child, parent, start, '1500'],
              { stdio: ['ignore', 'pipe', 'pipe'] },
            );
            let out = '';
            let err = '';
            proc.stdout.on('data', (chunk) => (out += chunk));
            proc.stderr.on('data', (chunk) => (err += chunk));
            proc.on('error', fail);
            proc.on('close', (code) =>
              code === 0 ? done(JSON.parse(out)) : fail(new Error(`exit ${code}: ${err}`)),
            );
          }),
      ),
    );
    expect([...new Set(runs.flatMap((run) => run.errors))]).toEqual([]);
    expect(runs.every((run) => run.cycles > 0)).toBe(true);
    // No work directory is left behind (the last run removes the parent too, unless Windows
    // still had a removed entry pending when it tried).
    expect(existsSync(parent) ? readdirSync(parent) : []).toEqual([]);
  }, 30_000);
});

describe('checkFlatExports (repo-level#2, C-COMPOUND)', () => {
  const Root = () => null;
  const Header = () => null;
  const Footer = () => null;
  const compound = Object.assign(Root, { Header, Footer, displayName: 'Card' });

  it('passes when every sub-component has a flat <Parent><Member> export equal to it', () => {
    const mod = { Card: compound, CardHeader: Header, CardFooter: Footer, cn: () => '' };
    expect(checkFlatExports(mod, noPending)).toEqual({ errors: [], pending: [], planned: [] });
  });

  it('reports a missing flat name and a flat name bound to another component', () => {
    const mod = { Card: compound, CardHeader: Footer };
    expect(checkFlatExports(mod, noPending).errors).toEqual([
      expect.stringMatching(/CardFooter is not exported/),
      expect.stringMatching(/CardHeader !== Card\.Header/),
    ]);
  });

  it('treats memo, forwardRef and lazy objects as sub-components', () => {
    const Memo = { $$typeof: Symbol.for('react.memo'), type: Header };
    const Parent = Object.assign(() => null, { Item: Memo });
    expect(checkFlatExports({ List: Parent }, noPending).errors).toEqual([
      expect.stringMatching(/ListItem is not exported/),
    ]);
  });

  it('ignores lower-case statics and non-component values', () => {
    const Parent = Object.assign(() => null, { displayName: 'X', Sizes: ['a'], Default: 3 });
    expect(checkFlatExports({ Parent }, noPending)).toEqual({
      errors: [],
      pending: [],
      planned: [],
    });
  });

  it('tolerates compounds on the pending list and reports them', () => {
    const result = checkFlatExports({ Card: compound }, { pendingFlatExports: ['Card'] });
    expect(result.errors).toEqual([]);
    expect(result.pending).toEqual(['CardFooter', 'CardHeader']);
  });

  it('still reports a wrong flat binding of a pending compound', () => {
    const result = checkFlatExports(
      { Card: compound, CardHeader: Footer },
      { pendingFlatExports: ['Card'] },
    );
    expect(result.errors).toEqual([expect.stringMatching(/CardHeader !== Card\.Header/)]);
  });

  it('reports a pending entry that is complete or no exported component (the list shrinks)', () => {
    const mod = { Card: compound, CardHeader: Header, CardFooter: Footer, cn: () => '' };
    expect(checkFlatExports(mod, { pendingFlatExports: ['Card', 'Gone', 'cn'] }).errors).toEqual([
      expect.stringMatching(/remove "Card" from PENDING_FLAT_EXPORTS.*all its flat names/),
      expect.stringMatching(/remove "Gone" from PENDING_FLAT_EXPORTS.*not an exported component/),
      expect.stringMatching(/remove "cn" from PENDING_FLAT_EXPORTS.*not an exported component/),
    ]);
  });

  it('tolerates a listed component that becomes a compound later (wave D) as planned', () => {
    const Drawer = () => null;
    const result = checkFlatExports({ Drawer }, { pendingFlatExports: ['Drawer'] });
    expect(result).toEqual({ errors: [], pending: [], planned: ['Drawer'] });
  });

  it('closes the bridge in final mode: the list is ignored and must be empty', () => {
    const Drawer = () => null;
    const final = checkFlatExports(
      { Card: compound, Drawer },
      { pendingFlatExports: ['Card', 'Drawer'], final: true },
    );
    expect(final.errors).toEqual([
      expect.stringMatching(/CardFooter is not exported/),
      expect.stringMatching(/CardHeader is not exported/),
      expect.stringMatching(/PENDING_FLAT_EXPORTS .*still lists Card, Drawer/),
    ]);
    expect(final.pending).toEqual([]);
    expect(final.planned).toEqual([]);

    const complete = { Card: compound, CardHeader: Header, CardFooter: Footer };
    expect(checkFlatExports(complete, { pendingFlatExports: [], final: true })).toEqual({
      errors: [],
      pending: [],
      planned: [],
    });
  });

  it('keeps the pending list free of duplicates and sorted', () => {
    expect(new Set(PENDING_FLAT_EXPORTS).size).toBe(PENDING_FLAT_EXPORTS.length);
    expect(PENDING_FLAT_EXPORTS).toEqual([...PENDING_FLAT_EXPORTS].sort());
  });
});

describe('checkCjsParity', () => {
  it('passes when index.cjs exports the names of index.mjs', async () => {
    expect(await checkCjsParity(fixture().dist)).toEqual([]);
  });

  it('reports names missing from either format', async () => {
    const { dist } = fixture({
      'dist/index.cjs': goodFiles()['dist/index.cjs'].replace(
        'exports.CardHeader = card.CardHeader;\n',
        '',
      ),
    });
    expect(await checkCjsParity(dist)).toEqual([expect.stringMatching(/CardHeader/)]);
  });
});

describe('probeTreeShaking (repo-level#3)', () => {
  it('bundles only Button and its imports from a per-module dist', async () => {
    expect(await probeTreeShaking(fixture().dist)).toEqual([]);
  });

  it('reports Dialog code kept by a dist without sideEffects', async () => {
    const { dist } = fixture({
      'package.json': JSON.stringify({ name: 'wave-fixture', type: 'module' }),
    });
    const errors = await probeTreeShaking(dist);
    expect(errors.join('\n')).toMatch(/components\/overlays\/Dialog\.mjs/);
  });

  it('reports a single-module bundle', async () => {
    const files = goodFiles();
    const single =
      files['dist/lib/cn.mjs'] +
      files['dist/components/button/Button.mjs']
        .replace(DIRECTIVE, '')
        .replace(/^import .*\n/m, '') +
      files['dist/components/overlays/Dialog.mjs']
        .replace(DIRECTIVE, '')
        .replace(/^import .*\n/m, '');
    const { dist } = fixture({ 'dist/index.mjs': single });
    const errors = await probeTreeShaking(dist);
    expect(errors.join('\n')).toMatch(/index\.mjs/);
    expect(errors.join('\n')).toMatch(/Dialog/);
    expect(errors.join('\n')).toMatch(/components\/button\/Button\.mjs is not in the bundle/);
  });

  // The bundler reports module ids as real paths, so a dist reached through a symlink or a
  // junction (a linked node_modules, a linked checkout) must still be matched module by module.
  it('checks every module of a dist reached through a symlink or junction', async () => {
    const linked = (dir) => {
      const link = join(fixtureRoot, `link-${basename(dir)}`);
      symlinkSync(dir, link, 'junction');
      return { link, dist: join(link, 'dist') };
    };
    const good = linked(fixture().dir);
    const leaky = linked(
      fixture({ 'package.json': JSON.stringify({ name: 'wave-fixture', type: 'module' }) }).dir,
    );
    try {
      expect(await probeTreeShaking(good.dist)).toEqual([]);
      expect((await probeTreeShaking(leaky.dist)).join('\n')).toMatch(
        /components\/overlays\/Dialog\.mjs is in the bundle/,
      );
    } finally {
      unlinkSync(good.link);
      unlinkSync(leaky.link);
    }
  });
});

describe('probeTreeShaking: modules that must be dropped', () => {
  const presenceDrop = { keep: 'Button', drop: 'Presence', dropModules: ['hooks/usePresence.mjs'] };

  it('passes when neither the drop component nor the listed modules are in the bundle', async () => {
    expect(await probeTreeShaking(fixture().dist, presenceDrop)).toEqual([]);
  });

  it('reports a listed module that is in the bundle', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      // Button now uses the presence hook, so its bundle holds the hook's module.
      'dist/components/button/Button.mjs': files['dist/components/button/Button.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { usePresence } from '../../hooks/usePresence.mjs';\n",
        )
        .replace('return cn(', 'usePresence(true); return cn('),
    });
    expect(await probeTreeShaking(dist, presenceDrop)).toEqual([
      'hooks/usePresence.mjs is in the bundle of an import of only Button (Presence must be dropped)',
    ]);
  });

  it('reports a listed module that does not exist in dist (the probe would pass vacuously)', async () => {
    const errors = await probeTreeShaking(fixture().dist, {
      ...presenceDrop,
      dropModules: ['hooks/useGone.mjs'],
    });
    expect(errors).toEqual([
      'hooks/useGone.mjs, listed to be dropped from the bundle of an import of only Button, does not exist in dist',
    ]);
  });
});

describe('probeIncludes', () => {
  it('passes when every listed module is in the bundle of an import of only `keep`', async () => {
    expect(
      await probeIncludes(fixture().dist, { keep: 'Presence', modules: ['hooks/usePresence.mjs'] }),
    ).toEqual([]);
  });

  it('reports a listed module that is not in the bundle', async () => {
    expect(
      await probeIncludes(fixture().dist, { keep: 'Button', modules: ['hooks/usePresence.mjs'] }),
    ).toEqual(['hooks/usePresence.mjs is not in the bundle of an import of only Button']);
  });
});

describe('probeSizeBudget', () => {
  const presenceBudget = {
    names: ['usePresence', 'Presence'],
    maxMinifiedBytes: 5120,
    maxGzipBytes: 2048,
    allowedExternals: ['react', 'react/jsx-runtime'],
  };

  /** A string that gzip cannot shrink much: `length` pseudo-random letters and digits. */
  function noise(length) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let seed = 42;
    let text = '';
    for (let i = 0; i < length; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      text += alphabet[seed % alphabet.length];
    }
    return text;
  }

  it('measures a small closure and passes it', async () => {
    const result = await probeSizeBudget(fixture().dist, presenceBudget);
    expect(result.errors).toEqual([]);
    expect(result.externals).toEqual(['react', 'react/jsx-runtime']);
    expect(result.minified).toBeGreaterThan(0);
    expect(result.gzip).toBeGreaterThan(0);
    expect(result.gzip).toBeLessThan(result.minified);
  });

  it('reports a closure over the minified and the gzip budget', async () => {
    const { dist } = fixture({
      'dist/hooks/usePresence.mjs':
        `${DIRECTIVE}import { useState } from 'react';\n` +
        `const TABLE = ${JSON.stringify(noise(8000))};\n` +
        'export function usePresence(visible) { useState(TABLE); return { isMounted: visible, phase: TABLE }; }\n',
    });
    const result = await probeSizeBudget(dist, presenceBudget);
    expect(result.minified).toBeGreaterThan(5120);
    expect(result.gzip).toBeGreaterThan(2048);
    expect(result.errors).toEqual([
      `usePresence + Presence: ${result.minified} bytes minified, over the budget of 5120`,
      `usePresence + Presence: ${result.gzip} bytes gzip, over the budget of 2048`,
    ]);
  });

  it('reports an external import outside allowedExternals (its size would hide outside the measure)', async () => {
    const { dist } = fixture({
      'dist/hooks/usePresence.mjs':
        `${DIRECTIVE}import { useState } from 'react';\nimport { clsx } from 'clsx';\n` +
        "export function usePresence(visible) { useState(0); return { isMounted: visible, phase: clsx('entered') }; }\n",
    });
    const result = await probeSizeBudget(dist, presenceBudget);
    expect(result.externals).toEqual(['clsx', 'react', 'react/jsx-runtime']);
    expect(result.errors).toEqual([
      'usePresence + Presence imports clsx, outside the measured closure (allowed: react, react/jsx-runtime)',
    ]);
  });
});

describe('the flat-name bridge (PENDING_FLAT_EXPORTS)', () => {
  it('is empty: the real exports carry the flat name of every compound member, Toolbar included', async () => {
    expect(PENDING_FLAT_EXPORTS).toEqual([]);
    const mod = await import('../../src/index.ts');
    expect(Object.keys(mod.Toolbar).filter((key) => /^[A-Z]/.test(key))).not.toEqual([]);
    expect(checkFlatExports(mod)).toEqual({ errors: [], pending: [], planned: [] });
    expect(checkFlatExports(mod, { final: true })).toEqual({
      errors: [],
      pending: [],
      planned: [],
    });
  }, 60_000);
});

describe('verifyDist and main', () => {
  it('passes a correct dist', async () => {
    const { dist } = fixture();
    const result = await verifyDist(dist, noPending);
    expect(result.errors).toEqual([]);
  });

  it('collects the failures of every check', async () => {
    const { dist } = fixture({
      'dist/index.d.cts': null,
      'dist/lib/cn.mjs': DIRECTIVE + goodFiles()['dist/lib/cn.mjs'],
      'dist/lib/dev.cjs': null,
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('index.d.cts'),
        expect.stringContaining('lib/cn.mjs'),
        'lib/dev.cjs is missing',
      ]),
    );
  });

  it('fails a dist whose JavaScript is correct but whose declarations rolled up empty', async () => {
    // TypeScript 6 without tsconfig.json's rootDir: the build passes, index.d.ts is `export { }`.
    const { dist } = fixture({
      'dist/index.d.ts': EMPTY_ROLL_UP,
      'dist/index.d.cts': EMPTY_ROLL_UP,
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export cn, Button, /),
      expect.stringMatching(/^index\.d\.cts does not declare and export cn, Button, /),
    ]);
  });

  it('runs the presence probes: a Button bundle with the presence core fails', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/button/Button.mjs': files['dist/components/button/Button.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { usePresence } from '../../hooks/usePresence.mjs';\n",
        )
        .replace('return cn(', 'usePresence(true); return cn('),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'hooks/usePresence.mjs is in the bundle of an import of only Button (Presence must be dropped)',
    ]);
  });

  it('reports a dist without the presence core module (the include probe)', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      // Menu no longer uses the hook module: an import of only Menu lacks it.
      'dist/components/navigation/Menu.mjs': files['dist/components/navigation/Menu.mjs']
        .replace("import { usePresence } from '../../hooks/usePresence.mjs';\n", '')
        .replace(
          'const { isMounted, phase } = usePresence(props.open);',
          "const isMounted = props.open; const phase = 'entered';",
        ),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'hooks/usePresence.mjs is not in the bundle of an import of only Menu',
    ]);
  });

  it('prints the measured presence budget', async () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', fixture().dist, '--no-pending'], io)).toBe(0);
    expect(lines.join('\n')).toMatch(
      /verify-dist: presence core \(usePresence \+ Presence\): \d+ B minified \(budget 6804\), \d+ B gzip \(budget 2927\)/,
    );
  });

  it('exits 0 for a correct dist and 1 otherwise', async () => {
    const quiet = { log: () => {}, error: () => {} };
    expect(await main(['--dist', fixture().dist, '--no-pending'], quiet)).toBe(0);
    expect(
      await main(['--dist', fixture({ 'dist/index.d.cts': null }).dist, '--no-pending'], quiet),
    ).toBe(1);
    expect(await main(['--dist', join(fixtureRoot, 'missing')], quiet)).toBe(1);
  });

  it('fails the final gate (--final) while PENDING_FLAT_EXPORTS is not empty', async () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    const code = await main(['--dist', fixture().dist, '--final'], io);
    if (PENDING_FLAT_EXPORTS.length > 0) {
      expect(code).toBe(1);
      expect(lines.join('\n')).toMatch(/PENDING_FLAT_EXPORTS .*still lists/);
    } else {
      expect(code).toBe(0);
    }
    const { errors } = await verifyDist(fixture().dist, { pendingFlatExports: [], final: true });
    expect(errors).toEqual([]);
  });

  it('tolerates pending flat names, and only while the bridge is open', async () => {
    const { dist } = fixture({
      'dist/index.mjs': goodFiles()['dist/index.mjs'].replace(
        'export { Card, CardHeader }',
        'export { Card }',
      ),
      'dist/index.cjs': goodFiles()['dist/index.cjs'].replace(
        'exports.CardHeader = card.CardHeader;\n',
        '',
      ),
    });
    expect(await verifyDist(dist, { pendingFlatExports: ['Card'] })).toEqual({
      errors: [],
      pending: ['CardHeader'],
      planned: [],
      budget: { minified: expect.any(Number), gzip: expect.any(Number) },
    });
    expect((await verifyDist(dist, { pendingFlatExports: ['Card'], final: true })).errors).toEqual([
      expect.stringMatching(/CardHeader is not exported/),
      expect.stringMatching(/PENDING_FLAT_EXPORTS .*still lists Card/),
    ]);
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', dist, '--no-pending'], io)).toBe(1);
    expect(lines.join('\n')).toMatch(/CardHeader is not exported/);
  });
});

describe('the entry guard of the gate scripts', () => {
  // verify-dist, verify-storybook, pack-smoke and attw-pack run their checks only when Node was
  // started with them. A guard that stopped recognising its own script would make the publish
  // gate exit 0 without checking anything, so it is tested like build-css's entryStatus.
  const scripts = dirname(fileURLToPath(new URL('../verify-dist.mjs', import.meta.url)));
  const script = join(scripts, 'verify-dist.mjs');
  const url = pathToFileURL(script).href;
  let scratch = '';
  /** A junction (a symlink off Windows) to the repo's real scripts/ directory. */
  let link = '';

  const isLink = (path) => lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() === true;

  /** Removes the link itself (never its target); `unlink` refuses a real directory. */
  function removeLink() {
    if (isLink(link)) unlinkSync(link);
    if (existsSync(link) || isLink(link)) throw new Error(`could not remove ${link}`);
  }

  /** Runs a script of scripts/ (or of `dir`) as Node's entry script. */
  function runNode(file, args) {
    const result = spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
  }

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'wave-entry-guard-'));
    link = join(scratch, 'scripts-link');
    symlinkSync(scripts, link, 'junction');
  });

  afterAll(() => {
    // The link goes first, so the recursive removal never depends on how rmSync treats a link
    // to the real scripts/ directory.
    removeLink();
    rmSync(scratch, { recursive: true, force: true });
  });

  it('matches its own script, and neither another script nor a missing one', () => {
    expect(entryStatus(url, script)).toBe('main');
    expect(isMainModule(url, script)).toBe(true);
    expect(entryStatus(url, join(scripts, 'build-css.mjs'))).toBe('imported');
    expect(isMainModule(url, join(scripts, 'build-css.mjs'))).toBe(false);
    expect(entryStatus(url, undefined)).toBe('imported');
    expect(isMainModule(url, undefined)).toBe(false);
  });

  it.runIf(process.platform === 'win32')('compares paths case-insensitively on Windows', () => {
    expect(isMainModule(url, script.toUpperCase())).toBe(true);
  });

  it('matches its script invoked through a symlink or junction', () => {
    expect(isLink(link)).toBe(true);
    expect(isMainModule(url, join(link, 'verify-dist.mjs'))).toBe(true);
  });

  it('reports a script of its name that it cannot match as a mismatch', () => {
    const impostor = join(scratch, 'verify-dist.mjs');
    writeFileSync(impostor, '// not the real script\n');
    expect(entryStatus(url, impostor)).toBe('mismatch');
    expect(entryStatus(url, join(scratch, 'missing', 'VERIFY-DIST.MJS'))).toBe('mismatch');
  });

  it('runScript runs main for its own script, fails closed on a mismatch, else does nothing', async () => {
    const saved = process.exitCode;
    const lines = [];
    const io = { error: (line) => lines.push(line) };
    const main = vi.fn(async () => 3);
    try {
      expect(await runScript(url, main, { argv1: script, io })).toBe(3);
      expect(process.exitCode).toBe(3);
      expect(main).toHaveBeenCalledTimes(1);

      process.exitCode = saved;
      const impostor = join(scratch, 'verify-dist.mjs');
      expect(await runScript(url, main, { argv1: impostor, io })).toBe(1);
      expect(process.exitCode).toBe(1);
      expect(lines).toEqual([
        `verify-dist: cannot confirm that ${impostor} is ${script}; nothing was checked`,
      ]);

      process.exitCode = saved;
      expect(await runScript(url, main, { argv1: join(scripts, 'pack-smoke.mjs'), io })).toBe(
        undefined,
      );
      expect(process.exitCode).toBe(saved);
      expect(main).toHaveBeenCalledTimes(1);
    } finally {
      process.exitCode = saved;
    }
  });

  it('verify-dist.mjs fails on a missing dist, run directly or through the junction', () => {
    const missing = join(scratch, 'no-dist');
    for (const file of [script, join(link, 'verify-dist.mjs')]) {
      const result = runNode(file, ['--dist', missing]);
      expect(result.stderr).toContain('does not exist (run vite build first)');
      expect(result.status).toBe(1);
    }
  }, 60_000);

  it('verify-storybook.mjs fails on a missing build directory', () => {
    const result = runNode(join(link, 'verify-storybook.mjs'), ['--dir', join(scratch, 'none')]);
    expect(result.stderr).toContain('does not exist (run storybook build first)');
    expect(result.status).toBe(1);
  }, 60_000);

  it('pack-smoke.mjs checks its arguments before packing anything', () => {
    const result = runNode(join(link, 'pack-smoke.mjs'), ['--fixture', 'nope']);
    expect(result.stderr).toContain('unknown fixture: nope');
    expect(result.status).toBe(1);
  }, 60_000);
});
