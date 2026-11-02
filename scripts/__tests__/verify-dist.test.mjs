// @vitest-environment node
/**
 * `scripts/verify-dist.mjs` (repo-level#2, #3, #4, #5): every check runs against small synthetic
 * `dist/` trees that reproduce one packaging defect each — a missing or misplaced `"use client"`,
 * a single-module bundle that defeats tree-shaking, CommonJS output in a dist of ES modules, an
 * entry that `require()` cannot load, a bundled or undeclared dependency, a dotted-only compound —
 * and against a correct tree that passes.
 *
 * The fixtures live under the repository's `node_modules/.cache`, so `react` resolves from them
 * exactly as it does from the real `dist/` (the react-server check needs it).
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BRAND_TOKENS_BUDGET,
  BUDGET_MARGIN_0_18,
  checkClassNameExports,
  checkDeclarations,
  checkDevEnvironment,
  checkDevOnlyLibraries,
  checkDirectives,
  checkFlatExports,
  checkImports,
  checkModuleOnlyNames,
  checkNoCommonJs,
  checkRequireEsm,
  checkServerImport,
  checkTestOnlyModules,
  clientReferenceStub,
  createWorkDir,
  CUSTOMIZATION_MODULES,
  BASELINES_0_17_1,
  DATA_GRID_BUDGET,
  DATA_SCALE_MODULES,
  DEV_ONLY_LIBRARIES,
  directivePrologue,
  entryStatus,
  EXCLUSION_PROBES_0_11,
  EXCLUSION_PROBES_0_15,
  EXCLUSION_PROBES_0_16,
  EXCLUSION_PROBES_0_17,
  EXCLUSION_PROBES_0_18,
  expectsUseClient,
  HOOK_PROBES_0_16,
  HOOK_PROBES_0_17,
  HOOK_PROBES_0_18,
  importSpecifiers,
  INCLUSION_PROBES_0_11,
  INCLUSION_PROBES_0_16,
  INCLUSION_PROBES_0_17,
  INCLUSION_PROBES_0_18,
  isMainModule,
  main,
  measureImport,
  missingDeclarations,
  missingValueAndTypeDeclarations,
  MODULE_ONLY_NAMES,
  MOTION_INCLUDE_PROBES,
  MOTION_RECIPE_MIN,
  motionLiteralsOf,
  motionRecipeLiterals,
  motionRecipeValues,
  OPT_IN_MODULES,
  PENDING_FLAT_EXPORTS,
  probeHook,
  probeIncludes,
  probeSizeBudget,
  probeTreeShaking,
  RECORDED_IMPORTS,
  RECORDED_IMPORTS_0_17,
  RECORDED_IMPORTS_0_18,
  removeWorkDir,
  REQUIRED_DECLARATIONS,
  runScript,
  TEST_ONLY_MODULES,
  TOKEN_MODULES,
  undocumentedComponents,
  VALUE_AND_TYPE_DECLARATIONS,
  verifyDist,
  VIRTUAL_BUDGET,
  WAVE_TOKENS_BUDGET,
} from '../verify-dist.mjs';
// The source of `dist/lib/motion.mjs` (0.15): MOTION_RECIPE_MIN is the count of its literals.
import * as motionSource from '../../src/lib/motion.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
// Removed with its parent once no other run uses the parent (no empty directory is left behind).
const fixtureRun = createWorkDir(
  join(repoRoot, 'node_modules', '.cache', 'wave-verify-dist-test'),
  'run-',
);
const fixtureRoot = fixtureRun.work;
// Some 170 fixtures of about 100 files each: removing them takes more than the 10 s default of a
// hook on Windows, where a timed-out hook fails the file and leaves the directory behind.
afterAll(() => removeWorkDir(fixtureRun), 120_000);

const DIRECTIVE = '"use client";\n';

/**
 * The fixture's rolled-up declarations: every name on REQUIRED_DECLARATIONS (a utility, a
 * documented component, a props type, a documented compound, a hook and a class-name constant),
 * `TagPickerOption` as a type and a value (VALUE_AND_TYPE_DECLARATIONS), and the empty export
 * list that ends every roll-up.
 */
const DTS =
  'export declare function cn(...inputs: unknown[]): string;\n' +
  '/** A button. */\nexport declare const Button: (props: object) => null;\n' +
  'export declare type ButtonProps = { disabled?: boolean };\n' +
  '/** A menu. */\nexport declare const Menu: (props: object) => null;\n' +
  'export declare function usePresence(visible: boolean): { isMounted: boolean };\n' +
  'export declare function useActiveDescendant(): [string | null];\n' +
  '/** A calendar. */\nexport declare const Calendar: (props: object) => null;\n' +
  '/** A group of tags. */\nexport declare const TagGroup: (props: object) => null;\n' +
  '/** A navigation drawer. */\nexport declare const NavDrawer: (props: object) => null;\n' +
  'export declare interface TagPickerOption { value: string; label: string }\n' +
  '/** An option of a TagPicker. */\nexport declare const TagPickerOption: (props: object) => null;\n' +
  "export declare const buttonClassNames: { readonly root: 'wave-button'; readonly icon: 'wave-button__icon' };\n" +
  '\nexport { }\n';

/** What vite-plugin-dts rolls up when TypeScript writes the declarations elsewhere. */
const EMPTY_ROLL_UP = 'export { }\n';

/**
 * A correct preserveModules dist: Button, a Card and a Dialog compound, a hook and `cn`, the
 * modules of each phase since 0.11, the 0.15 modules of {@link withPhase10Modules}, the 0.16
 * modules of {@link withPhase11Modules}, the 0.17 modules of {@link withPhase12Modules} and the
 * 0.18 modules of {@link withPhase13Modules}.
 */
function goodFiles() {
  return withPhase13Modules(
    withPhase12Modules(withPhase11Modules(withPhase10Modules(goodFilesBefore015()))),
  );
}

/** The good files up to 0.14 ({@link goodFiles} adds the 0.15 modules). */
function goodFilesBefore015() {
  const component = (name, members = [], constant) => {
    const parts = members.map(
      (member) =>
        `function ${name}${member}() { return null; }\n${name}${member}.displayName = '${name}${member}';\n`,
    );
    const assign = members.length
      ? `export const ${name} = /* @__PURE__ */ Object.assign(${name}Root, { ${members
          .map((member) => `${member}: ${name}${member}`)
          .join(', ')} });\n`
      : `export const ${name} = ${name}Root;\n`;
    const classes = `${constant ? `${constant}.root, ` : ''}'${name.toLowerCase()}'`;
    return (
      `${DIRECTIVE}import { cn } from '../../lib/cn.mjs';\n` +
      (constant ? `import { ${constant} } from '../../lib/classNames.mjs';\n` : '') +
      `function ${name}Root(props) { return cn(${classes}, props && props.className); }\n` +
      `${name}Root.displayName = '${name}';\n${parts.join('')}${assign}` +
      (members.length ? `export { ${members.map((member) => name + member).join(', ')} };\n` : '')
    );
  };
  const button = component('Button', [], 'buttonClassNames');
  // Field and InfoButton (0.9): Field reaches no InfoButton code, so an import of only Field
  // drops the InfoButton module.
  const field = component('Field');
  const infoButton = component('InfoButton', [], 'infoButtonClassNames');
  const card = component('Card', ['Header']);
  // The Dialog resolves its two recipes through the motion hook (0.15), so an import of only
  // Dialog holds `lib/motion`, `hooks/useMotion` and both recipe literals.
  const dialog = withDialogMotion(component('Dialog', ['Trigger', 'Content']));
  const motion = fixtureMotionModules();
  // The presence core (0.7): a hook and a component on it, with React external.
  const usePresence =
    `${DIRECTIVE}import { useState } from 'react';\n` +
    "export function usePresence(visible) { const [phase] = useState(visible ? 'entered' : 'exited'); return { isMounted: visible, phase }; }\n";
  const presence =
    `${DIRECTIVE}import { jsx } from 'react/jsx-runtime';\n` +
    "import { usePresence } from '../../hooks/usePresence.mjs';\n" +
    "function Presence(props) { const { isMounted, phase } = usePresence(props.visible); return isMounted ? jsx('div', { 'data-presence': phase, children: props.children }) : null; }\n" +
    "Presence.displayName = 'Presence';\nexport { Presence };\n";
  // A component on the presence core (Menu.Popover, 0.7): an import of only Menu holds it.
  const menu =
    `${DIRECTIVE}import { jsx } from 'react/jsx-runtime';\n` +
    "import { usePresence } from '../../hooks/usePresence.mjs';\n" +
    "function Menu(props) { const { isMounted, phase } = usePresence(props.open); return isMounted ? jsx('div', { role: 'menu', 'data-presence': phase, children: props.children }) : null; }\n" +
    "Menu.displayName = 'Menu';\nexport { Menu };\n";
  // 0.8 (INTEGRATION): the opt-in color parts, the server-safe color helpers and toaster handle,
  // and a Toaster on the presence core.
  const colorPart = (name) =>
    `${DIRECTIVE}import { cn } from '../../lib/cn.mjs';\n` +
    "import { hsvToHex } from '../../lib/color.mjs';\n" +
    `function ${name}(props) { return cn('${name.toLowerCase()}', hsvToHex(props.value)); }\n` +
    `${name}.displayName = '${name}';\nexport { ${name} };\n`;
  const colorHelpers = `function channel(n, h, s, v) {
  const k = (n + h / 60) % 6;
  return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
}
function hsvToHex(c) {
  return '#' + [5, 3, 1].map((n) => channel(n, c.h, c.s, c.v).toString(16).padStart(2, '0')).join('');
}
function hexToHsv(text) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(text).trim());
  if (!match) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h =
    d === 0 ? 0 : max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}
`;
  const toasterHandle = `let handles = 0;
function createToaster() {
  const prefix = 'fixture-toaster-' + ++handles + '-';
  let count = 0;
  const idOf = (arg, options) =>
    (arg && typeof arg === 'object' && !('$$typeof' in arg) && arg.toastId) ||
    (options && options.toastId) ||
    prefix + ++count;
  return {
    dispatchToast: (arg, options) => idOf(arg, options),
    dismissToast: () => {},
    dismissAllToasts: () => {},
  };
}
`;
  // A Toaster on the presence core (0.8): an import of only Toaster holds it.
  const toaster =
    `${DIRECTIVE}import { jsx } from 'react/jsx-runtime';\n` +
    "import { usePresence } from '../../hooks/usePresence.mjs';\n" +
    "function Toaster(props) { const { isMounted, phase } = usePresence(true); return isMounted ? jsx('div', { role: 'region', 'data-presence': phase, children: props.children }) : null; }\n" +
    "Toaster.displayName = 'Toaster';\nexport { Toaster };\n";
  // 0.10 (INTEGRATION): the server-safe date helpers, the listbox core (a hook, Option, Listbox,
  // Dropdown) and a Calendar that holds none of it.
  const dateHelpers =
    'function addDays(date, days) { const next = new Date(date.getTime()); next.setDate(next.getDate() + days); return next; }\n';
  const useActiveDescendant = `${DIRECTIVE}import { useState } from 'react';\nexport function useActiveDescendant() { return useState(null); }\n`;
  const useListbox = `${DIRECTIVE}import { useState } from 'react';\nexport function useListbox() { return useState(null); }\n`;
  const option = `${DIRECTIVE}function Option() { return null; }\nOption.displayName = 'Option';\nexport { Option };\n`;
  const listboxUser = (name) =>
    `${DIRECTIVE}import { useListbox } from '../../hooks/useListbox.mjs';\n` +
    "import { Option } from './Option.mjs';\n" +
    `function ${name}() { useListbox(); return Option(); }\n${name}.displayName = '${name}';\nexport { ${name} };\n`;
  const calendar =
    `${DIRECTIVE}import { cn } from '../../lib/cn.mjs';\n` +
    "import { addDays } from '../../lib/date.mjs';\n" +
    "function Calendar(props) { return cn('calendar', String(addDays(props.value, 1))); }\n" +
    "Calendar.displayName = 'Calendar';\nexport { Calendar };\n";
  // src/lib/dev.ts reads the bundler-injected mode at call time.
  const dev =
    'function isDevEnvironment() {\n  try {\n    return process.env.NODE_ENV !== "production";\n  } catch {\n    return true;\n  }\n}\n' +
    'export const isDev = isDevEnvironment();\n';
  return withPhase9Modules(
    withPhase8Modules(
      withPhase7Modules(
        withPhase6Modules({
          'package.json': JSON.stringify({
            name: 'wave-fixture',
            type: 'module',
            sideEffects: ['*.css'],
            dependencies: { clsx: '^2.1.1' },
            peerDependencies: { react: '^19.0.0' },
          }),
          'dist/lib/cn.mjs':
            "export function cn(...inputs) { return inputs.filter(Boolean).join(' '); }\n",
          'dist/lib/classNames.mjs':
            "export const buttonClassNames = { root: 'wave-button', icon: 'wave-button__icon' };\n" +
            "export const dialogContentClassNames = { root: 'wave-dialog-content', body: 'wave-dialog-content__body' };\n" +
            "export const infoButtonClassNames = { root: 'wave-info-button', info: 'wave-info-button__info' };\n",
          'dist/lib/dev.mjs': dev,
          'dist/hooks/useThing.mjs': `${DIRECTIVE}import { useState } from 'react';\nexport function useThing() { return useState(0); }\n`,
          'dist/components/button/Button.mjs': button,
          'dist/components/input/Field.mjs': field,
          'dist/components/data-display/InfoButton.mjs': infoButton,
          'dist/components/layout/Card.mjs': card,
          'dist/components/overlays/Dialog.mjs': dialog,
          'dist/lib/motion.mjs': motion.module,
          'dist/hooks/useMotion.mjs': motion.hook,
          'dist/hooks/usePresence.mjs': usePresence,
          'dist/components/motion/Presence.mjs': presence,
          'dist/components/navigation/Menu.mjs': menu,
          'dist/components/input/ColorArea.mjs': colorPart('ColorArea'),
          'dist/components/input/ColorSlider.mjs': colorPart('ColorSlider'),
          'dist/components/input/AlphaSlider.mjs': colorPart('AlphaSlider'),
          'dist/components/feedback/Toaster.mjs': toaster,
          'dist/lib/date.mjs': `${dateHelpers}export { addDays };\n`,
          'dist/hooks/useActiveDescendant.mjs': useActiveDescendant,
          'dist/hooks/useListbox.mjs': useListbox,
          'dist/components/input/Option.mjs': option,
          'dist/components/input/Listbox.mjs': listboxUser('Listbox'),
          'dist/components/input/Dropdown.mjs': listboxUser('Dropdown'),
          'dist/components/input/Calendar.mjs': calendar,
          'dist/lib/color.mjs': `${colorHelpers}export { hsvToHex, hexToHsv };\n`,
          'dist/lib/toaster.mjs': `${toasterHandle}export { createToaster };\n`,
          'dist/index.mjs':
            "export { cn } from './lib/cn.mjs';\n" +
            "export { buttonClassNames, dialogContentClassNames } from './lib/classNames.mjs';\n" +
            "export { infoButtonClassNames } from './lib/classNames.mjs';\n" +
            "export { useThing } from './hooks/useThing.mjs';\n" +
            "export { Button } from './components/button/Button.mjs';\n" +
            "export { Field } from './components/input/Field.mjs';\n" +
            "export { InfoButton } from './components/data-display/InfoButton.mjs';\n" +
            "export { Card, CardHeader } from './components/layout/Card.mjs';\n" +
            "export { Dialog, DialogTrigger, DialogContent } from './components/overlays/Dialog.mjs';\n" +
            "export { usePresence } from './hooks/usePresence.mjs';\n" +
            "export { Presence } from './components/motion/Presence.mjs';\n" +
            "export { Menu } from './components/navigation/Menu.mjs';\n" +
            "export { hsvToHex, hexToHsv } from './lib/color.mjs';\n" +
            "export { createToaster } from './lib/toaster.mjs';\n" +
            "export { ColorArea } from './components/input/ColorArea.mjs';\n" +
            "export { ColorSlider } from './components/input/ColorSlider.mjs';\n" +
            "export { AlphaSlider } from './components/input/AlphaSlider.mjs';\n" +
            "export { Toaster } from './components/feedback/Toaster.mjs';\n" +
            "export { addDays } from './lib/date.mjs';\n" +
            "export { useActiveDescendant } from './hooks/useActiveDescendant.mjs';\n" +
            "export { Listbox } from './components/input/Listbox.mjs';\n" +
            "export { Dropdown } from './components/input/Dropdown.mjs';\n" +
            "export { Calendar } from './components/input/Calendar.mjs';\n",
          'dist/index.d.ts': DTS,
        }),
      ),
    ),
  );
}

/**
 * The 0.11 modules of the fixture (INTEGRATION): the shape of the real import graph that the
 * probes of EXCLUSION_PROBES_0_11 and INCLUSION_PROBES_0_11 check, one entry per dist module
 * (without its extension). `uses` are the [module, export] pairs a module calls; `members` the
 * parts of a compound (a part of another module is `[Member, module, export]`); `root` the
 * module and export a compound's root comes from; `exports` the names the entry re-exports;
 * `constant` the class-name constant the module reads. A `hook` module exports one function.
 */
const PHASE6_MODULES = {
  'components/button/Toolbar.navigation': { hook: 'useToolbarNavigation' },
  'components/data-display/Avatar': { name: 'Avatar', exports: ['Avatar'] },
  'components/data-display/Tag': { name: 'Tag', constant: 'tagClassNames', exports: ['Tag'] },
  'components/data-display/TagGroup': {
    name: 'TagGroup',
    constant: 'tagGroupClassNames',
    uses: [['components/button/Toolbar.navigation', 'useToolbarNavigation']],
    exports: ['TagGroup'],
  },
  'components/data-display/InteractionTag': {
    name: 'InteractionTag',
    members: [['Primary'], ['Secondary']],
    exports: ['InteractionTag', 'InteractionTagPrimary', 'InteractionTagSecondary'],
  },
  'components/input/Combobox': {
    name: 'Combobox',
    uses: [
      ['hooks/useListbox', 'useListbox'],
      ['components/input/Option', 'Option'],
    ],
    exports: ['Combobox'],
  },
  'components/input/TagPicker.option': {
    name: 'TagPickerOption',
    uses: [['components/input/Option', 'Option']],
  },
  'components/input/TagPicker.parts': {
    name: 'TagPickerList',
    constant: 'tagPickerListClassNames',
    uses: [
      ['components/data-display/Tag', 'Tag'],
      ['components/data-display/TagGroup', 'TagGroup'],
    ],
  },
  'components/input/TagPicker.root': {
    name: 'TagPickerRoot',
    displayName: 'TagPicker',
    constant: 'tagPickerClassNames',
    uses: [
      ['hooks/useListbox', 'useListbox'],
      ['components/data-display/Tag', 'Tag'],
    ],
  },
  'components/input/TagPicker': {
    name: 'TagPicker',
    root: ['components/input/TagPicker.root', 'TagPickerRoot'],
    members: [
      ['List', 'components/input/TagPicker.parts', 'TagPickerList'],
      ['Option', 'components/input/TagPicker.option', 'TagPickerOption'],
    ],
    exports: ['TagPicker', 'TagPickerList', 'TagPickerOption'],
  },
  'components/overlays/Dialog.shared': { hook: 'useModalOpenState' },
  'hooks/useModalLayer': { hook: 'useModalLayer' },
  'hooks/useRovingTabIndex': { hook: 'useRovingTabIndex' },
  'components/overlays/Drawer.panel': {
    name: 'DrawerPanel',
    uses: [
      ['hooks/useModalLayer', 'useModalLayer'],
      ['hooks/usePresence', 'usePresence'],
      ['components/overlays/Dialog.shared', 'useModalOpenState'],
    ],
  },
  'components/overlays/Drawer.root': {
    name: 'DrawerRoot',
    displayName: 'Drawer',
    uses: [
      ['components/overlays/Drawer.panel', 'DrawerPanel'],
      ['components/overlays/Dialog.shared', 'useModalOpenState'],
    ],
  },
  'components/overlays/Drawer.parts': {
    name: 'DrawerHeader',
    uses: [['components/overlays/Dialog.shared', 'useModalOpenState']],
  },
  'components/overlays/Drawer': {
    name: 'Drawer',
    root: ['components/overlays/Drawer.root', 'DrawerRoot'],
    members: [['Header', 'components/overlays/Drawer.parts', 'DrawerHeader']],
    exports: ['Drawer', 'DrawerHeader'],
  },
  'components/navigation/Nav.root': {
    name: 'NavRoot',
    displayName: 'Nav',
    constant: 'navClassNames',
  },
  'components/navigation/Nav': {
    name: 'Nav',
    root: ['components/navigation/Nav.root', 'NavRoot'],
    members: [['Divider']],
    exports: ['Nav', 'NavDivider'],
  },
  'components/navigation/Hamburger': {
    name: 'Hamburger',
    constant: 'hamburgerClassNames',
    exports: ['Hamburger'],
  },
  'components/navigation/NavDrawer': {
    name: 'NavDrawer',
    constant: 'navDrawerClassNames',
    uses: [
      ['components/overlays/Drawer.panel', 'DrawerPanel'],
      ['components/navigation/Nav.root', 'NavRoot'],
      ['hooks/usePresence', 'usePresence'],
      ['hooks/useRovingTabIndex', 'useRovingTabIndex'],
    ],
    members: [['Body']],
    exports: ['NavDrawer', 'NavDrawerBody'],
  },
};

/** The class-name constants of the 0.11 modules (each read by one module above). */
const PHASE6_CLASS_NAMES = {
  tagClassNames: 'wave-tag',
  tagGroupClassNames: 'wave-tag-group',
  tagPickerClassNames: 'wave-tag-picker',
  tagPickerListClassNames: 'wave-tag-picker-list',
  navClassNames: 'wave-nav',
  navDrawerClassNames: 'wave-nav-drawer',
  hamburgerClassNames: 'wave-hamburger',
};

/**
 * The code of the 0.11 module `path` with `spec` (see PHASE6_MODULES). Every module starts with
 * `"use client"`; a hook calls its uses, a component calls them in its render
 * (`function X(props) { … }`), so an import of the component keeps them.
 */
function phase6Module(path, spec) {
  const rel = (target) => {
    const relative = posix.relative(posix.dirname(path), target);
    return `${relative.startsWith('.') ? relative : `./${relative}`}.mjs`;
  };
  const imports = [];
  if (!spec.hook) imports.push(['lib/cn', 'cn']);
  if (spec.constant) imports.push(['lib/classNames', spec.constant]);
  for (const use of spec.uses ?? []) imports.push(use);
  if (spec.root) imports.push(spec.root);
  for (const [, module, name] of spec.members ?? []) if (module) imports.push([module, name]);
  const importLines = imports
    .map(([module, name]) => `import { ${name} } from '${rel(module)}';\n`)
    .join('');
  const calls = (spec.uses ?? []).map(([, name]) => `${name}(props); `).join('');
  if (spec.hook) {
    return `${DIRECTIVE}${importLines}export function ${spec.hook}(props) { ${calls}return null; }\n`;
  }
  const { name } = spec;
  const classes = `${spec.constant ? `${spec.constant}.root, ` : ''}'${name.toLowerCase()}'`;
  const local = (member) => `${name}${member}`;
  const rootName = spec.root ? spec.root[1] : `${name}Impl`;
  let code = '';
  if (!spec.root) {
    code +=
      `function ${rootName}(props) { ${calls}return cn(${classes}, props && props.className); }\n` +
      `${rootName}.displayName = '${spec.displayName ?? name}';\n`;
  }
  const members = spec.members ?? [];
  for (const [member, module] of members) {
    if (module) continue;
    code += `function ${local(member)}() { return null; }\n${local(member)}.displayName = '${local(member)}';\n`;
  }
  const memberName = ([member, module, imported]) => (module ? imported : local(member));
  const assign = members.length
    ? `/* @__PURE__ */ Object.assign(${rootName}, { ${members
        .map((member) => `${member[0]}: ${memberName(member)}`)
        .join(', ')} })`
    : rootName;
  const flat = members.map((member) => [local(member[0]), memberName(member)]);
  return (
    `${DIRECTIVE}${importLines}${code}export const ${name} = ${assign};\n` +
    flat.map(([as, from]) => `export { ${from === as ? as : `${from} as ${as}`} };\n`).join('')
  );
}

/** `code` (a module of the fixture) importing `name` from `target` and calling it in its render. */
function withCall(code, path, target, name) {
  const relative = posix.relative(posix.dirname(path), target);
  const specifier = `${relative.startsWith('.') ? relative : `./${relative}`}.mjs`;
  const line = `import { ${name} } from '${specifier}';\n`;
  const render = /function \w+\(props\) \{ /;
  expect(code).toMatch(render);
  return code
    .replace(DIRECTIVE, `${DIRECTIVE}${line}`)
    .replace(render, (match) => `${match}${name}(props); `);
}

/**
 * The good files with the 0.11 modules added: their code, their class names in the registry and
 * the entry, and their public names in the entry. The fixture's Dialog mounts through the
 * presence core and reads `Dialog.shared`, as the real one does.
 */
/**
 * The 0.12 modules of the fixture: the public hooks and utilities that HOOK_PROBES_0_12 bundle on
 * their own (each in its own module, importing no component), and a Popover component the probes
 * must not find in those bundles.
 */
function withPhase7Modules(files) {
  const result = { ...files };
  const modules = {
    'hooks/useFocusVisible': ['useFocusVisible', 'return false;', true],
    'hooks/usePopupPosition': ['usePopupPosition', 'return {};', true],
    'lib/focus': ['getFirstTabbable', 'return null;', false],
    'lib/layers': ['hasOpenModal', 'return false;', false],
  };
  for (const [path, [name, body, client]] of Object.entries(modules)) {
    const directive = client ? DIRECTIVE : '';
    result[`dist/${path}.mjs`] = `${directive}export function ${name}() { ${body} }\n`;
  }
  result['dist/hooks/useFocusableGroup.mjs'] =
    `${DIRECTIVE}import { getFirstTabbable } from '../lib/focus.mjs';\n` +
    'export function useFocusableGroup() { return { first: getFirstTabbable }; }\n';
  result['dist/hooks/useModalOpen.mjs'] =
    `${DIRECTIVE}import { hasOpenModal } from '../lib/layers.mjs';\n` +
    'export function useModalOpen() { return hasOpenModal(); }\n';
  result['dist/components/overlays/Popover.mjs'] =
    `${DIRECTIVE}function Popover() { return null; }\nPopover.displayName = 'Popover';\nexport { Popover };\n`;
  result['dist/index.mjs'] +=
    "export { useFocusVisible } from './hooks/useFocusVisible.mjs';\n" +
    "export { useFocusableGroup } from './hooks/useFocusableGroup.mjs';\n" +
    "export { usePopupPosition } from './hooks/usePopupPosition.mjs';\n" +
    "export { useModalOpen } from './hooks/useModalOpen.mjs';\n" +
    "export { getFirstTabbable } from './lib/focus.mjs';\n";
  return result;
}

/**
 * The 0.13 modules of the fixture: the two pure helpers that HOOK_PROBES_0_13 bundle on their own
 * (importing no component and no React module), and the Avatar components the probes must not
 * find in those bundles.
 */
function withPhase8Modules(files) {
  const result = { ...files };
  result['dist/lib/initials.mjs'] =
    'export function getInitials(name) { return name.slice(0, 1); }\n';
  result['dist/components/data-display/AvatarGroup.partition.mjs'] =
    `${DIRECTIVE}export function partitionAvatarGroupItems(options) { return { inlineItems: options.items, overflowItems: undefined }; }\n`;
  for (const name of ['Avatar', 'AvatarGroup', 'Persona']) {
    result[`dist/components/data-display/${name}.mjs`] =
      `${DIRECTIVE}import { createElement } from 'react';\nfunction ${name}() { return createElement('span'); }\n${name}.displayName = '${name}';\nexport { ${name} };\n`;
  }
  result['dist/index.mjs'] +=
    "export { getInitials } from './lib/initials.mjs';\n" +
    "export { partitionAvatarGroupItems } from './components/data-display/AvatarGroup.partition.mjs';\n";
  return result;
}

/** The breadcrumb helpers of `lib/breadcrumb` (0.14), in the order HOOK_PROBES_0_14 probes them. */
const BREADCRUMB_HELPERS = [
  'partitionBreadcrumbItems',
  'truncateBreadcrumbLongName',
  'truncateBreadcrumbLongTooltip',
  'isTruncatableBreadcrumbContent',
];

/**
 * A fixture `lib/breadcrumb` module: `body(name)` is the body of each helper, and `head` the code
 * before them (an import). Every helper is exported.
 */
function breadcrumbModule(body, head = '') {
  const helpers = BREADCRUMB_HELPERS.map((name) => `function ${name}() { ${body(name)} }\n`).join(
    '',
  );
  return `${head}${helpers}export { ${BREADCRUMB_HELPERS.join(', ')} };\n`;
}

/**
 * The 0.14 modules of the fixture: the pure helpers that HOOK_PROBES_0_14 bundle on their own
 * (`lib/table` and `lib/breadcrumb`, importing no component and no React module), and the table
 * and breadcrumb components (with the Overflow the Breadcrumb is built on) that the probes must
 * not find in those bundles.
 */
function withPhase9Modules(files) {
  const result = { ...files };
  const table =
    'function createTableColumn(options) { return { ...options, sortable: options.sortable ?? options.compare !== undefined }; }\n';
  result['dist/lib/table.mjs'] = `${table}export { createTableColumn };\n`;
  result['dist/lib/breadcrumb.mjs'] = breadcrumbModule(() => 'return null;');
  for (const [path, name] of [
    ['components/table/DataGrid', 'DataGrid'],
    ['components/table/Table', 'Table'],
    ['components/table/Table.shared', 'TableSelectionControl'],
    ['components/navigation/Breadcrumb', 'Breadcrumb'],
    ['components/layout/Overflow', 'Overflow'],
  ]) {
    result[`dist/${path}.mjs`] =
      `${DIRECTIVE}import { createElement } from 'react';\nfunction ${name}() { return createElement('div'); }\n${name}.displayName = '${name}';\nexport { ${name} };\n`;
  }
  result['dist/index.mjs'] +=
    "export { createTableColumn } from './lib/table.mjs';\n" +
    `export { ${BREADCRUMB_HELPERS.join(', ')} } from './lib/breadcrumb.mjs';\n`;
  return result;
}

/**
 * The 0.15 modules of the fixture (INTEGRATION), one entry per dist module (without its
 * extension): `imports` are [module, names] pairs (a bare module stays bare), `body` the code that
 * uses them, `exports` its names, and `entry` whether the package entry exports them. An Accordion
 * on the collapse hook and a MessageBarGroup on the presence group resolve their recipes from
 * `lib/motion` through `hooks/useMotion`, so the motion controls of MOTION_INCLUDE_PROBES find
 * their modules and literals; a MessageBar reaches neither (EXCLUSION_PROBES_0_15).
 */
const PHASE10_MODULES = {
  'hooks/useCollapsePresence': {
    imports: [
      ['lib/motion', ['collapseMotion', 'collapseStructure']],
      ['hooks/useMotion', ['useMotionClasses']],
      ['hooks/usePresence', ['usePresence']],
    ],
    body:
      'function useCollapsePresence(open, options) { const presence = usePresence(open); ' +
      "return { isMounted: presence.isMounted, className: collapseStructure + ' ' + useMotionClasses(options.motion, collapseMotion) }; }\n",
    exports: ['useCollapsePresence'],
  },
  'components/layout/Accordion': {
    imports: [
      ['lib/cn', ['cn']],
      ['hooks/useCollapsePresence', ['useCollapsePresence']],
    ],
    body:
      "function Accordion(props) { const collapse = useCollapsePresence(props.open, props); return cn('accordion', collapse.className, props.className); }\n" +
      "Accordion.displayName = 'Accordion';\n",
    exports: ['Accordion'],
    entry: true,
  },
  'components/feedback/MessageBar': {
    imports: [['lib/cn', ['cn']]],
    body:
      "function MessageBar(props) { return cn('message-bar', props && props.className); }\n" +
      "MessageBar.displayName = 'MessageBar';\n",
    exports: ['MessageBar'],
    entry: true,
  },
  'hooks/usePresenceGroup': {
    imports: [['react', ['useState']]],
    body:
      'function usePresenceGroup(children) { const [entries] = useState(() => [].concat(children ?? [])); ' +
      'return { entries, skipped: [], onExited: () => {} }; }\n',
    exports: ['usePresenceGroup'],
  },
  'components/feedback/MessageBarGroup': {
    imports: [
      ['lib/cn', ['cn']],
      [
        'lib/motion',
        ['messageBarGroupEnterMotion', 'messageBarGroupExitMotion', 'messageBarGroupItemStructure'],
      ],
      ['hooks/useMotion', ['useMotionClasses']],
      ['hooks/usePresence', ['usePresence']],
      ['hooks/usePresenceGroup', ['usePresenceGroup']],
    ],
    body:
      'function MessageBarGroup(props) { const { entries } = usePresenceGroup(props.children); const item = usePresence(entries.length > 0); ' +
      "return cn('message-bar-group', messageBarGroupItemStructure, useMotionClasses(props.motion, messageBarGroupExitMotion + ' ' + messageBarGroupEnterMotion), item.phase); }\n" +
      "MessageBarGroup.displayName = 'MessageBarGroup';\n",
    exports: ['MessageBarGroup'],
    entry: true,
  },
};

/** The code of the 0.15 module `path` with `spec` (see PHASE10_MODULES). */
function phase10Module(path, { imports, body, exports }) {
  const specifier = (target) => {
    if (!target.includes('/')) return target;
    const relative = posix.relative(posix.dirname(path), target);
    return `${relative.startsWith('.') ? relative : `./${relative}`}.mjs`;
  };
  const importLines = imports
    .map(([module, names]) => `import { ${names.join(', ')} } from '${specifier(module)}';\n`)
    .join('');
  return `${DIRECTIVE}${importLines}${body}export { ${exports.join(', ')} };\n`;
}

/** The good files with the 0.15 modules of PHASE10_MODULES, their public names in the entry. */
function withPhase10Modules(files) {
  const result = { ...files };
  for (const [path, spec] of Object.entries(PHASE10_MODULES)) {
    result[`dist/${path}.mjs`] = phase10Module(path, spec);
    if (!spec.entry) continue;
    result['dist/index.mjs'] += `export { ${spec.exports.join(', ')} } from './${path}.mjs';\n`;
  }
  return result;
}

/**
 * The 0.16 modules of the fixture (INTEGRATION), in the shape of PHASE10_MODULES: every module of
 * DATA_SCALE_MODULES, wired where a probe looks as the real ones are. The window and the selection
 * hooks sit on their cores and import no component; a DataGrid holds its selection store (on the
 * selection core), its header, window and column sizing (with `Table.ResizeHandle`); a FlatTree
 * compound holds its item and context; a Tree reaches the moved cascade through `Tree.selection`;
 * `useFlatTree` sits on the flat model and the cascade; the table hooks, the pickers' data mode and
 * the grid navigation hook stand alone. A `lib` module carries no `"use client"`.
 */
const PHASE11_MODULES = {
  'lib/virtual': {
    imports: [],
    body: "function computeVirtualLayout(options) { return [{ kind: 'item', index: options.first }]; }\n",
    exports: ['computeVirtualLayout'],
  },
  'hooks/useVirtualWindow': {
    imports: [
      ['react', ['useState']],
      ['lib/virtual', ['computeVirtualLayout']],
    ],
    body:
      'function useVirtualWindow(options) { const [first] = useState(0); ' +
      'return { itemSize: options.itemSize, layout: (count) => computeVirtualLayout({ count, first }) }; }\n',
    exports: ['useVirtualWindow'],
    entry: true,
  },
  'lib/selection': {
    imports: [],
    body: 'function toggleId(selected, id) { return selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]; }\n',
    exports: ['toggleId'],
  },
  'hooks/useSelection': {
    imports: [
      ['react', ['useState']],
      ['lib/selection', ['toggleId']],
    ],
    body:
      'function useSelection(options) { const [selected, setSelected] = useState(options.defaultSelectedItems ?? []); ' +
      'return { selected, toggle: (id) => setSelected(toggleId(selected, id)) }; }\n',
    exports: ['useSelection'],
    entry: true,
  },
  'lib/columnSizing': {
    imports: [],
    body: 'function totalWidth(widths) { return Object.values(widths).reduce((sum, width) => sum + width, 0); }\n',
    exports: ['totalWidth'],
  },
  'lib/treeCascade': {
    imports: [],
    body: "function computeCheckStates(nodes) { return new Map(nodes.map((node) => [node.value, 'unchecked'])); }\n",
    exports: ['computeCheckStates'],
  },
  'lib/flatTree': {
    imports: [['lib/treeCascade', ['computeCheckStates']]],
    body: 'function buildFlatTreeIndex(items) { return { items, checks: computeCheckStates(items) }; }\n',
    exports: ['buildFlatTreeIndex'],
  },
  'components/table/useTableFeatures': {
    imports: [['react', ['useMemo']]],
    body: 'function useTableFeatures(options) { return useMemo(() => ({ items: options.items }), [options.items]); }\n',
    exports: ['useTableFeatures'],
    entry: true,
  },
  'components/table/useTableSort': {
    imports: [['react', ['useState']]],
    body: 'function useTableSort(options) { const [sort] = useState(options.defaultSort ?? null); return { sort }; }\n',
    exports: ['useTableSort'],
    entry: true,
  },
  'components/table/useTableSelection': {
    imports: [['hooks/useSelection', ['useSelection']]],
    body: 'function useTableSelection(options) { return useSelection(options); }\n',
    exports: ['useTableSelection'],
    entry: true,
  },
  'components/table/useTableColumnSizing': {
    imports: [['lib/columnSizing', ['totalWidth']]],
    body: 'function useTableColumnSizing(options) { return { total: totalWidth(options.widths ?? {}) }; }\n',
    exports: ['useTableColumnSizing'],
    entry: true,
  },
  'components/table/useGridNavigation': {
    imports: [['react', ['useRef']]],
    body: 'function useGridNavigation() { return { gridRef: useRef(null) }; }\n',
    exports: ['useGridNavigation'],
  },
  'components/table/Table.resize': {
    imports: [['lib/cn', ['cn']]],
    body:
      "function TableResizeHandle(props) { return cn('resize-handle', props.className); }\n" +
      "TableResizeHandle.displayName = 'TableResizeHandle';\n",
    exports: ['TableResizeHandle'],
  },
  'components/table/DataGrid.store': {
    imports: [['lib/selection', ['toggleId']]],
    body: 'function createSelectionStore(ids) { return { toggle: (id) => toggleId(ids, id) }; }\n',
    exports: ['createSelectionStore'],
  },
  'components/table/DataGrid.context': {
    imports: [['react', ['createContext']]],
    body: 'const DataGridContext = createContext(null);\n',
    exports: ['DataGridContext'],
  },
  'components/table/DataGrid.header': {
    imports: [['components/table/DataGrid.context', ['DataGridContext']]],
    body:
      'function DataGridHeader() { return DataGridContext; }\n' +
      "DataGridHeader.displayName = 'DataGridHeader';\n",
    exports: ['DataGridHeader'],
  },
  'components/table/DataGrid.window': {
    imports: [['components/table/DataGrid.context', ['DataGridContext']]],
    body: 'function useDataGridWindow(options) { return { context: DataGridContext, window: options.virtualWindow }; }\n',
    exports: ['useDataGridWindow'],
  },
  'components/table/DataGrid.sizing': {
    imports: [
      ['lib/columnSizing', ['totalWidth']],
      ['components/table/Table.resize', ['TableResizeHandle']],
    ],
    body: 'function useDataGridColumnSizing(options) { return { total: totalWidth(options.widths ?? {}), handle: TableResizeHandle }; }\n',
    exports: ['useDataGridColumnSizing'],
  },
  // Replaces the 0.14 stand-in: the grid on its 0.16 modules (no `Table.shared`, which the 0.14
  // helper probe lists, so that probe's cases stay as they were).
  'components/table/DataGrid': {
    imports: [
      ['react', ['createElement']],
      ['components/table/DataGrid.store', ['createSelectionStore']],
      ['components/table/DataGrid.header', ['DataGridHeader']],
      ['components/table/DataGrid.window', ['useDataGridWindow']],
      ['components/table/DataGrid.sizing', ['useDataGridColumnSizing']],
    ],
    body:
      'function DataGrid(props) { createSelectionStore([]); useDataGridWindow(props); useDataGridColumnSizing(props); ' +
      "return createElement('table', null, createElement(DataGridHeader)); }\n" +
      "DataGrid.displayName = 'DataGrid';\n",
    exports: ['DataGrid'],
    entry: true,
  },
  'components/input/Option.data': {
    imports: [['components/input/Option', ['Option']]],
    body: 'function renderListboxItem(item) { return Option(item); }\n',
    exports: ['renderListboxItem'],
  },
  'components/layout/FlatTree.context': {
    imports: [['react', ['createContext']]],
    body: 'const FlatTreeContext = createContext(null);\n',
    exports: ['FlatTreeContext'],
  },
  'components/layout/FlatTree.item': {
    imports: [
      ['react', ['useContext']],
      ['components/layout/FlatTree.context', ['FlatTreeContext']],
    ],
    body:
      'function FlatTreeItem() { return useContext(FlatTreeContext); }\n' +
      "FlatTreeItem.displayName = 'FlatTreeItem';\n",
    exports: ['FlatTreeItem'],
  },
  'components/layout/FlatTree': {
    imports: [
      ['react', ['createElement']],
      ['components/layout/FlatTree.context', ['FlatTreeContext']],
      ['components/layout/FlatTree.item', ['FlatTreeItem']],
    ],
    body:
      'function FlatTreeRoot(props) { return createElement(FlatTreeContext.Provider, { value: props.model }, createElement(FlatTreeItem)); }\n' +
      "FlatTreeRoot.displayName = 'FlatTree';\n" +
      'const FlatTree = /* @__PURE__ */ Object.assign(FlatTreeRoot, { Item: FlatTreeItem });\n',
    exports: ['FlatTree', 'FlatTreeItem'],
    entry: true,
  },
  'components/layout/useFlatTree': {
    imports: [
      ['react', ['useMemo']],
      ['lib/flatTree', ['buildFlatTreeIndex']],
    ],
    body: 'function useFlatTree(items) { return useMemo(() => buildFlatTreeIndex(items), [items]); }\n',
    exports: ['useFlatTree'],
    entry: true,
  },
  'components/layout/Tree.selection': {
    imports: [['lib/treeCascade', ['computeCheckStates']]],
    body: 'function collectItems(nodes) { return computeCheckStates(nodes); }\n',
    exports: ['collectItems'],
  },
  // The Tree reads the provider's context for its direction, as the real one does (`useDirection`;
  // the provider module is one of the 0.17 modules of PHASE12_MODULES).
  'components/layout/Tree': {
    imports: [
      ['react', ['createElement']],
      ['components/layout/Tree.selection', ['collectItems']],
      ['components/provider/WaveProvider', ['useWaveTheme']],
    ],
    body:
      "function Tree(props) { collectItems(props.items ?? []); return createElement('div', { role: 'tree', dir: useWaveTheme().dir }); }\n" +
      "Tree.displayName = 'Tree';\n",
    exports: ['Tree'],
    entry: true,
  },
};

/** The code of the 0.16 module `path` (see PHASE11_MODULES). */
function phase11Module(path, spec) {
  const code = phase10Module(path, spec);
  return expectsUseClient(`${path}.mjs`) ? code : code.replace(DIRECTIVE, '');
}

/** The good files with the 0.16 modules of PHASE11_MODULES, their public names in the entry. */
function withPhase11Modules(files) {
  const result = { ...files };
  for (const [path, spec] of Object.entries(PHASE11_MODULES)) {
    result[`dist/${path}.mjs`] = phase11Module(path, spec);
    if (!spec.entry) continue;
    result['dist/index.mjs'] += `export { ${spec.exports.join(', ')} } from './${path}.mjs';\n`;
  }
  return result;
}

/**
 * The 0.17 modules of the fixture (INTEGRATION), in the shape of PHASE11_MODULES, except that
 * `entry` lists the names the package entry exports (the others are module-only seams): the token
 * core, the names tuple with `waveTokens` and `chartPalette`, the brand generator and the provider
 * that reads the token core. The tuple is one string split at run time, as the build writes it, so
 * a token name is a fragment of code and no string literal of its own; the brand generator's
 * contrast check runs only outside production (`process.env.NODE_ENV`), as the real one does, and
 * its seed warning in every build; the provider's `tokens` warnings run only outside production too
 * (since 0.17.1). Each `lib` module works on the server, where the react-server check calls it.
 */
const PHASE12_MODULES = {
  'lib/tokens': {
    imports: [],
    body:
      "function tokenVariable(name) { return '--wave-' + name.replace(/([A-Za-z])(\\d)/g, '$1-$2').replace(/[A-Z]/g, (capital) => '-' + capital).toLowerCase(); }\n" +
      'function getTokenStyle(overrides) { if (overrides == null) return undefined; const style = {}; ' +
      'for (const [key, value] of Object.entries(overrides)) if (value !== undefined) style[tokenVariable(key)] = String(value); ' +
      'return Object.keys(style).length > 0 ? style : undefined; }\n' +
      'function mergeTokenOverrides(parent, own) { return own === null ? {} : own === undefined ? parent : { ...parent, ...own }; }\n',
    exports: ['tokenVariable', 'getTokenStyle', 'mergeTokenOverrides'],
    entry: ['getTokenStyle'],
  },
  'lib/waveTokens': {
    imports: [['lib/tokens', ['tokenVariable']]],
    body:
      "const WAVE_TOKEN_NAMES = /* @__PURE__ */ 'primary.brand80.paletteBlue.palettePurple.paletteSteelTintForeground'.split('.');\n" +
      "const waveTokens = /* @__PURE__ */ Object.freeze(Object.fromEntries(WAVE_TOKEN_NAMES.map((name) => [name, 'var(' + tokenVariable(name) + ')'])));\n" +
      "const chartPalette = /* @__PURE__ */ Object.freeze(['paletteBlue', 'palettePurple']);\n",
    exports: ['WAVE_TOKEN_NAMES', 'waveTokens', 'chartPalette'],
    entry: ['waveTokens', 'chartPalette'],
  },
  'lib/brand': {
    imports: [['lib/dev', ['isDev']]],
    body:
      'const BRAND_STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160];\n' +
      "const DEFAULT_BRAND_RAMP = Object.fromEntries(BRAND_STOPS.map((stop) => [stop, stop === 80 ? '#0f6cbd' : '#7f7f7f']));\n" +
      'function warnOnce(key, message) { if (isDev) console.warn(key, message); }\n' +
      "function checkBrandRamp(ramp) { for (const stop of BRAND_STOPS) if (typeof ramp[stop] !== 'string') warnOnce('createBrandTokens:contrast:light:primary:' + stop, 'no colour'); }\n" +
      'function toTokens(ramp) { return Object.fromEntries(BRAND_STOPS.map((stop) => [`brand${stop}`, ramp[stop]])); }\n' +
      'function createBrandTokens(seed) {\n' +
      "  if (typeof seed === 'object' && seed !== null) {\n" +
      "    try { if (process.env.NODE_ENV !== 'production') checkBrandRamp(seed); } catch {}\n" +
      '    return toTokens(seed);\n' +
      '  }\n' +
      "  if (!/^#[0-9a-f]{6}$/i.test(String(seed))) warnOnce('createBrandTokens:seed', 'not a colour');\n" +
      '  return toTokens(DEFAULT_BRAND_RAMP);\n' +
      '}\n',
    exports: ['DEFAULT_BRAND_RAMP', 'checkBrandRamp', 'createBrandTokens'],
    entry: ['createBrandTokens'],
  },
  'components/provider/WaveProvider': {
    imports: [
      ['react', ['createContext', 'createElement', 'useContext']],
      ['lib/cn', ['cn']],
      ['lib/tokens', ['getTokenStyle', 'mergeTokenOverrides']],
    ],
    body:
      "const WaveContext = createContext({ dir: 'ltr', tokens: {} });\n" +
      'function useWaveTheme() { return useContext(WaveContext); }\n' +
      "function reportTokens(tokens) { try { if (process.env.NODE_ENV !== 'production') for (const key of Object.keys(tokens)) console.warn('WaveProvider:tokens:value:' + key); } catch {} }\n" +
      'function WaveProvider(props) { const parent = useWaveTheme(); const tokens = mergeTokenOverrides(parent.tokens, props.tokens); reportTokens(tokens); ' +
      "return createElement(WaveContext.Provider, { value: { dir: props.dir ?? parent.dir, tokens } }, createElement('div', { className: cn('wave-root', props.className), style: getTokenStyle(tokens) }, props.children)); }\n" +
      "WaveProvider.displayName = 'WaveProvider';\n",
    exports: ['WaveProvider', 'useWaveTheme'],
    entry: ['WaveProvider', 'useWaveTheme'],
  },
};

/** The code of the 0.17 module `path` (see PHASE12_MODULES). */
const phase12Module = phase11Module;

/** The good files with the 0.17 modules of PHASE12_MODULES, their `entry` names in the entry. */
function withPhase12Modules(files) {
  const result = { ...files };
  for (const [path, spec] of Object.entries(PHASE12_MODULES)) {
    result[`dist/${path}.mjs`] = phase12Module(path, spec);
    result['dist/index.mjs'] += `export { ${spec.entry.join(', ')} } from './${path}.mjs';\n`;
  }
  return result;
}

/**
 * The 0.18 modules of the fixture (INTEGRATION), in the shape of PHASE12_MODULES (`entry`: the
 * names the package entry exports; a module without it holds seams only): the part helper and the
 * native-props helper, server-safe and working on the server as the react-server check calls them;
 * Field's context module with its two public names; the context modules of RadioGroup, Menu,
 * MessageBar and DataGrid with their public hooks (the DataGrid's selection hook on the selection
 * store, as the real one reaches it through the inert context); and a RadioGroup on its context.
 * {@link withPhase13Modules} also has the MessageBar read its context module and merge its parts
 * with the helper, and the Dialog merge its surface's parts, as the real ones do; a Button reaches
 * none of them.
 */
const PHASE13_MODULES = {
  'lib/slotProps': {
    imports: [['lib/cn', ['cn']]],
    body:
      'const HIDDEN_PART_LOCKS = { hidden: undefined, inert: undefined };\n' +
      'function mergeSlotProps(part, own = {}) { return { ...own.defaults, ...part, ' +
      'className: part && part.className ? cn(own.className, part.className) : own.className, ...own.locked }; }\n',
    exports: ['HIDDEN_PART_LOCKS', 'mergeSlotProps'],
    entry: ['mergeSlotProps'],
  },
  'lib/nativeProps': {
    imports: [],
    body:
      "const NATIVE_GLOBAL_PROPS = 'id title onClick';\n" +
      "const NATIVE_TAG_PROPS = { button: 'disabled type' };\n" +
      'function getNativeElementProps(tag, props, excludedNames = []) { ' +
      "const kept = new Set((NATIVE_GLOBAL_PROPS + ' ' + (NATIVE_TAG_PROPS[tag] ?? '')).split(' ')); " +
      "return Object.fromEntries(Object.entries(props).filter(([name]) => !excludedNames.includes(name) && (kept.has(name) || name.startsWith('data-')))); }\n",
    exports: ['NATIVE_GLOBAL_PROPS', 'NATIVE_TAG_PROPS', 'getNativeElementProps'],
    entry: ['getNativeElementProps'],
  },
  'hooks/useFieldControl': {
    imports: [['react', ['createContext', 'createElement', 'useContext']]],
    body:
      'const FieldContext = createContext(null);\n' +
      'function useFieldContext() { return useContext(FieldContext); }\n' +
      'function FieldContextProvider(props) { return createElement(FieldContext.Provider, { value: props.value }, props.children); }\n' +
      "FieldContextProvider.displayName = 'FieldContextProvider';\n",
    exports: ['FieldContext', 'useFieldContext', 'FieldContextProvider'],
    entry: ['useFieldContext', 'FieldContextProvider'],
  },
  'components/input/RadioGroup.context': {
    imports: [['react', ['createContext', 'useContext']]],
    body:
      'const RadioGroupContext = createContext(null);\n' +
      'function useRadioGroupContext() { return useContext(RadioGroupContext); }\n' +
      "function useRadioGroupItem(value) { const group = useContext(RadioGroupContext); return { checked: group !== null && group.value === value, props: { role: 'radio' } }; }\n",
    exports: ['RadioGroupContext', 'useRadioGroupContext', 'useRadioGroupItem'],
    entry: ['useRadioGroupContext', 'useRadioGroupItem'],
  },
  'components/input/RadioGroup': {
    imports: [
      ['react', ['createElement']],
      ['components/input/RadioGroup.context', ['RadioGroupContext']],
    ],
    body:
      "function RadioGroup(props) { return createElement(RadioGroupContext.Provider, { value: { value: props.value } }, createElement('div', { role: 'radiogroup' }, props.children)); }\n" +
      "RadioGroup.displayName = 'RadioGroup';\n",
    exports: ['RadioGroup'],
    entry: ['RadioGroup'],
  },
  'components/navigation/Menu.context': {
    imports: [['react', ['createContext']]],
    body: 'const MenuContext = createContext(null);\nconst MenuListContext = createContext(null);\n',
    exports: ['MenuContext', 'MenuListContext'],
  },
  'components/navigation/Menu.hooks': {
    imports: [
      ['react', ['useContext']],
      ['components/navigation/Menu.context', ['MenuContext', 'MenuListContext']],
    ],
    body:
      'function useMenuContext() { const menu = useContext(MenuContext); return { open: menu !== null && menu.open, close: () => menu && menu.close(), isSubmenu: false }; }\n' +
      'function useMenuListContext() { const list = useContext(MenuListContext); return { hasIcons: list !== null && list.hasIcons, hasCheckmarks: false }; }\n',
    exports: ['useMenuContext', 'useMenuListContext'],
    entry: ['useMenuContext', 'useMenuListContext'],
  },
  'components/feedback/MessageBar.context': {
    imports: [['react', ['createContext', 'useContext']]],
    body:
      'const MessageBarContext = createContext(null);\n' +
      "function useMessageBarContext() { return useContext(MessageBarContext) ?? { status: 'info', layout: 'singleline' }; }\n",
    exports: ['MessageBarContext', 'useMessageBarContext'],
    entry: ['useMessageBarContext'],
  },
  'components/table/DataGrid.hooks': {
    imports: [
      ['react', ['useContext']],
      ['components/table/DataGrid.context', ['DataGridContext']],
      ['components/table/DataGrid.store', ['createSelectionStore']],
    ],
    body:
      'function useDataGridSort() { const grid = useContext(DataGridContext); return { sort: grid && grid.sort, setSort: () => {} }; }\n' +
      'function useDataGridSelection() { const grid = useContext(DataGridContext); const store = grid ? grid.store : createSelectionStore([]); ' +
      'return { selectedItems: [], toggle: (id) => store.toggle(id) }; }\n' +
      'function useDataGridRowId() { const grid = useContext(DataGridContext); return grid ? grid.rowId : undefined; }\n',
    exports: ['useDataGridSort', 'useDataGridSelection', 'useDataGridRowId'],
    entry: ['useDataGridSort', 'useDataGridSelection', 'useDataGridRowId'],
  },
};

/** The code of the 0.18 module `path` (see PHASE13_MODULES). */
const phase13Module = phase11Module;

/**
 * The calls of the real MessageBar and Dialog into the 0.18 modules: the MessageBar reads its
 * context module and merges its parts, the Dialog merges its surface's parts.
 */
const PHASE13_CALLS = [
  [
    'components/feedback/MessageBar',
    'components/feedback/MessageBar.context',
    'useMessageBarContext',
  ],
  ['components/feedback/MessageBar', 'lib/slotProps', 'mergeSlotProps'],
  ['components/overlays/Dialog', 'lib/slotProps', 'mergeSlotProps'],
];

/**
 * The good files with the 0.18 modules of PHASE13_MODULES, their `entry` names in the entry, and
 * the calls of PHASE13_CALLS.
 */
function withPhase13Modules(files) {
  const result = { ...files };
  for (const [path, spec] of Object.entries(PHASE13_MODULES)) {
    result[`dist/${path}.mjs`] = phase13Module(path, spec);
    if (!spec.entry) continue;
    result['dist/index.mjs'] += `export { ${spec.entry.join(', ')} } from './${path}.mjs';\n`;
  }
  for (const [path, target, name] of PHASE13_CALLS) {
    result[`dist/${path}.mjs`] = withCall(result[`dist/${path}.mjs`], path, target, name);
  }
  return result;
}

function withPhase6Modules(files) {
  const result = { ...files };
  for (const [path, spec] of Object.entries(PHASE6_MODULES)) {
    result[`dist/${path}.mjs`] = phase6Module(path, spec);
  }
  const constants = Object.entries(PHASE6_CLASS_NAMES);
  result['dist/lib/classNames.mjs'] += constants
    .map(([name, root]) => `export const ${name} = { root: '${root}' };\n`)
    .join('');
  const publicModules = Object.entries(PHASE6_MODULES).filter(([, spec]) => spec.exports);
  result['dist/index.mjs'] +=
    `export { ${constants.map(([name]) => name).join(', ')} } from './lib/classNames.mjs';\n` +
    publicModules
      .map(([path, spec]) => `export { ${spec.exports.join(', ')} } from './${path}.mjs';\n`)
      .join('');
  const dialog = 'dist/components/overlays/Dialog.mjs';
  result[dialog] = withCall(
    withCall(files[dialog], 'components/overlays/Dialog', 'hooks/usePresence', 'usePresence'),
    'components/overlays/Dialog',
    'components/overlays/Dialog.shared',
    'useModalOpenState',
  );
  return result;
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
    ['"use client";const e=import(`../x.mjs`);', ['use client']],
    ['// banner\n/* more */\n"use client";\nexport {};', ['use client']],
    ['"use strict";\n"use client";\nexport const a = 1;', ['use strict', 'use client']],
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
    // Dynamic imports and require() calls (an ES module may require() one), minified.
    ['const m=await import("./lazy.mjs")', ['./lazy.mjs']],
    [
      '"use client";const e=require(`../../_virtual/runtime.mjs`),t=require("react");',
      ['../../_virtual/runtime.mjs', 'react'],
    ],
  ])('finds the specifiers of %j', (code, expected) => {
    expect(importSpecifiers(code)).toEqual(expected);
  });

  it.each([
    'const important = fromValue("x");',
    'export const from = "./not-an-import.mjs";',
    'export default fromX("y");',
    'const a = "./not-an-import.mjs";',
  ])('finds no specifier in %j', (code) => {
    expect(importSpecifiers(code)).toEqual([]);
  });
});

describe('expectsUseClient', () => {
  it.each([
    ['components/button/Button.mjs', true],
    ['hooks/useControllable.mjs', true],
    ['components/button/index.mjs', false],
    ['hooks/index.mjs', false],
    ['index.mjs', false],
    ['lib/cn.mjs', false],
    ['_virtual/_rolldown/runtime.mjs', false],
  ])('%s -> %s', (path, expected) => {
    expect(expectsUseClient(path)).toBe(expected);
  });
});

describe('checkDirectives (repo-level#2)', () => {
  it('passes a correct dist', () => {
    expect(checkDirectives(fixture().dist)).toEqual([]);
  });

  it('reports a component or hook module without the directive', () => {
    const { dist } = fixture({
      'dist/components/button/Button.mjs': goodFiles()['dist/components/button/Button.mjs'].replace(
        DIRECTIVE,
        '',
      ),
      'dist/hooks/useThing.mjs': goodFiles()['dist/hooks/useThing.mjs'].replace(DIRECTIVE, ''),
    });
    const errors = checkDirectives(dist);
    expect(errors).toEqual([
      expect.stringContaining('components/button/Button.mjs'),
      expect.stringContaining('hooks/useThing.mjs'),
    ]);
    expect(errors.join('\n')).toMatch(/lacks "use client"/);
  });

  it('reports the directive in cn, in the entry and in any index barrel', () => {
    const { dist } = fixture({
      'dist/lib/cn.mjs': DIRECTIVE + goodFiles()['dist/lib/cn.mjs'],
      'dist/index.mjs': DIRECTIVE + goodFiles()['dist/index.mjs'],
      'dist/components/button/index.mjs': `${DIRECTIVE}export { Button } from './Button.mjs';\n`,
    });
    const errors = checkDirectives(dist);
    expect(errors).toHaveLength(3);
    for (const path of ['lib/cn.mjs', 'index.mjs', 'components/button/index.mjs']) {
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
  it('passes when index.d.ts declares and exports the required names', () => {
    expect(checkDeclarations(fixture().dist)).toEqual([]);
  });

  it('reports a missing or empty index.d.ts', () => {
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': null }).dist)).toEqual(
      expect.arrayContaining([expect.stringContaining('index.d.ts')]),
    );
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': '' }).dist)).not.toEqual([]);
  });

  it('reports an exported component without a JSDoc (C-DOCS)', () => {
    const dts = `${DTS}export declare const Card: () => null;\n`;
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': dts }).dist)).toEqual([
      'index.d.ts: the exported component Card has no JSDoc (document it on its export, C-DOCS)',
    ]);
  });

  it('finds every name on REQUIRED_DECLARATIONS in the fixture (extend DTS with the list)', () => {
    expect(REQUIRED_DECLARATIONS.length).toBeGreaterThan(0);
    expect(missingDeclarations(DTS, REQUIRED_DECLARATIONS)).toEqual([]);
  });

  it('reports an empty roll-up (only `export { }`)', () => {
    const { dist } = fixture({ 'dist/index.d.ts': EMPTY_ROLL_UP });
    expect(checkDeclarations(dist)).toEqual([
      "index.d.ts does not declare and export cn, Button, ButtonProps, Menu, usePresence, useActiveDescendant, Calendar, TagGroup, NavDrawer, buttonClassNames (an empty or partial roll-up: check tsconfig.json's rootDir and the declaration plugin in vite.config.ts)",
    ]);
  });

  it('names each required name a partial roll-up leaves out', () => {
    const dts = DTS.replace('export declare type ButtonProps', 'declare type ButtonProps').replace(
      '/** A menu. */\nexport declare const Menu',
      '/** A menu. */\ndeclare const Menu',
    );
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': dts }).dist)).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export ButtonProps, Menu \(/),
    ]);
  });

  it('takes the required names as an option', () => {
    expect(checkDeclarations(fixture().dist, { requiredDeclarations: ['cn', 'Card'] })).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export Card \(/),
    ]);
    const empty = fixture({ 'dist/index.d.ts': EMPTY_ROLL_UP });
    expect(
      checkDeclarations(empty.dist, { requiredDeclarations: [], valueAndTypeDeclarations: [] }),
    ).toEqual([]);
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
  it('passes when dist/lib/dev.mjs reads process.env.NODE_ENV at run time', () => {
    expect(checkDevEnvironment(fixture().dist)).toEqual([]);
  });

  it('reports a mode inlined at build time (a `define` in vite.config.ts) or a missing module', () => {
    const inlined = goodFiles()['dist/lib/dev.mjs'].replace('process.env.NODE_ENV', '"production"');
    expect(checkDevEnvironment(fixture({ 'dist/lib/dev.mjs': inlined }).dist)).toEqual([
      'lib/dev.mjs does not read process.env.NODE_ENV: the build inlined the mode (a `define` in ' +
        "vite.config.ts?), so the consumer's bundler can no longer choose development or production",
    ]);
    expect(checkDevEnvironment(fixture({ 'dist/lib/dev.mjs': null }).dist)).toEqual([
      'lib/dev.mjs is missing',
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
      'dist/lib/lazy.mjs': 'export const load = () => import(`left-pad`);\n',
    });
    const errors = checkImports(dist, pkg);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/lib\/extra\.mjs.*lodash\/merge/),
        expect.stringMatching(/lib\/extra\.mjs.*node:fs/),
        expect.stringMatching(/lib\/lazy\.mjs.*left-pad/),
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
  // Each check loads the fixture in a child Node.js process: more than Vitest's 5 s default
  // under load (the parallel gate, a CI runner), hence 30 s per check.
  const withIndexImport = (line) => ({
    'dist/index.mjs': `${line}\n${goodFiles()['dist/index.mjs']}`,
  });

  it('loads the package under the react-server condition', async () => {
    expect(await checkServerImport(fixture().dist)).toEqual([]);
  }, 30_000);

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
  }, 30_000);

  it('reports a cn that is missing or returns the wrong value', async () => {
    // Only the missing module: the modules that import it are not reported as well.
    expect(await checkServerImport(fixture({ 'dist/lib/cn.mjs': null }).dist)).toEqual([
      'lib/cn.mjs is missing',
    ]);
    expect(
      await checkServerImport(
        fixture({ 'dist/lib/cn.mjs': 'export function cn() { return 1; }\n' }).dist,
      ),
    ).toEqual([expect.stringContaining('lib/cn.mjs')]);
  }, 60_000);

  it('loads every other src/lib module the entry imports, not only cn', async () => {
    const { dist } = fixture({
      ...withIndexImport("export { ThemeContext } from './lib/theme.mjs';"),
      'dist/lib/theme.mjs':
        "import { createContext } from 'react';\nexport const ThemeContext = createContext(null);\n",
    });
    const errors = await checkServerImport(dist);
    expect(errors).toEqual([
      expect.stringMatching(/^lib\/theme\.mjs does not load under node --conditions=react-server/),
    ]);
    expect(errors.join('\n')).not.toMatch(/^index\.mjs/m);
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

  it('leaves no directory behind next to dist', async () => {
    const { dir, dist } = fixture();
    expect(await checkServerImport(dist)).toEqual([]);
    expect(readdirSync(dir).sort()).toEqual(['dist', 'package.json']);
  }, 30_000);

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
  }, 30_000);
});

describe('clientReferenceStub', () => {
  let stubs = 0;
  /** Loads `source` as an ES module (written next to the fixtures, so Node.js imports it). */
  const load = (source) => {
    const file = join(fixtureRoot, `stub-${++stubs}.mjs`);
    writeFileSync(file, source);
    return import(pathToFileURL(file).href);
  };

  it('exports a client reference per name', async () => {
    const source = clientReferenceStub('components/x/Card.mjs', ['Card', 'default']);
    expect(source).toMatch(/export \{ reference0 as "Card", reference1 as "default" \};/);

    const { Card, default: fallback } = await load(source);
    expect(fallback.$$id).toBe('components/x/Card.mjs#default');
    expect(Card.$$typeof).toBe(Symbol.for('react.client.reference'));
    expect(Card.$$id).toBe('components/x/Card.mjs#Card');
    expect(Card.displayName).toBeUndefined();
    expect(() => Card()).toThrow(/Attempted to call Card\(\) from the server/);
    expect(() => Card.Header).toThrow(/Cannot access Card\.Header on the server/);
    expect(() => {
      Card.displayName = 'Card';
    }).toThrow(/Cannot assign to a client module/);
  });

  it('cannot be awaited or resolved as a thenable, like React client references', async () => {
    const { Card } = await load(clientReferenceStub('components/x/Card.mjs', ['Card']));
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

describe('ES modules only (1.0, spec R4)', () => {
  const commonJs = (path) =>
    `${path} is CommonJS output: the package ships ES modules only ` +
    '(one ES output in vite.config.ts, no index.d.cts)';

  it('checkNoCommonJs passes a dist of ES modules, their maps and index.d.ts', () => {
    expect(checkNoCommonJs(fixture({ 'dist/index.mjs.map': '{}\n' }).dist)).toEqual([]);
  });

  it('checkNoCommonJs reports every CommonJS module, source map and declaration', () => {
    const { dist } = fixture({
      'dist/index.cjs': "exports.cn = require('./lib/cn.cjs').cn;\n",
      'dist/index.d.cts': DTS,
      'dist/lib/cn.cjs.map': '{}\n',
    });
    expect(checkNoCommonJs(dist)).toEqual([
      commonJs('index.cjs'),
      commonJs('index.d.cts'),
      commonJs('lib/cn.cjs.map'),
    ]);
  });

  it('checkRequireEsm passes an entry that require() loads with the names of import()', async () => {
    expect(await checkRequireEsm(fixture().dist)).toEqual([]);
  }, 30_000);

  it('checkRequireEsm reports a module graph with a top-level await', async () => {
    const files = goodFiles();
    // A module the entry imports waits at its top level: require() refuses the whole graph.
    const { dist } = fixture({
      'dist/lib/date.mjs': `await Promise.resolve();\n${files['dist/lib/date.mjs']}`,
    });
    expect(await checkRequireEsm(dist)).toEqual([
      expect.stringMatching(
        /^index\.mjs does not load through require\(\), so CommonJS consumers \(Node\.js 22\.12 and later\) cannot use the package: ERR_REQUIRE_ASYNC_MODULE: /,
      ),
    ]);
  }, 30_000);

  it('checkRequireEsm reports an entry whose require() gives other names than import()', async () => {
    // A `module.exports` export is what require() returns in place of the module namespace.
    const { dist } = fixture({
      'dist/index.mjs':
        "export const a = 1;\nconst other = { b: 2 };\nexport { other as 'module.exports' };\n",
    });
    expect(await checkRequireEsm(dist)).toEqual([
      'require() of index.mjs lacks a, module.exports, which import() exports',
      'require() of index.mjs has b, which import() does not export',
    ]);
  }, 30_000);

  it('checkRequireEsm reports a missing entry', async () => {
    expect(await checkRequireEsm(fixture({ 'dist/index.mjs': null }).dist)).toEqual([
      'index.mjs is missing',
    ]);
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
      files['dist/lib/classNames.mjs'] +
      files['dist/components/button/Button.mjs']
        .replace(DIRECTIVE, '')
        .replace(/^import .*\n/gm, '') +
      files['dist/components/overlays/Dialog.mjs']
        .replace(DIRECTIVE, '')
        .replace(/^import .*\n/gm, '');
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

describe('probeTreeShaking: a Field-only bundle (0.9)', () => {
  const fieldDrop = {
    keep: 'Field',
    drop: 'InfoButton',
    dropModules: ['components/data-display/InfoButton.mjs'],
    dropStrings: ['wave-info-button'],
  };

  it('passes when Field reaches no InfoButton code', async () => {
    expect(await probeTreeShaking(fixture().dist, fieldDrop)).toEqual([]);
  });

  it('reports the InfoButton module in the bundle of an import of only Field', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/input/Field.mjs': files['dist/components/input/Field.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { InfoButton } from '../data-display/InfoButton.mjs';\n",
        )
        .replace('return cn(', 'InfoButton({}); return cn('),
    });
    expect(await probeTreeShaking(dist, fieldDrop)).toEqual([
      'components/data-display/InfoButton.mjs is in the bundle of an import of only Field (InfoButton must be dropped)',
      'InfoButton code (displayName "InfoButton") is in the bundle of an import of only Field',
      'the bundle of an import of only Field contains the string "wave-info-button" (an unused constant was not tree-shaken)',
    ]);
  });

  it("reports InfoButton's class string in the bundle of an import of only Field", async () => {
    const files = goodFiles();
    const { dist } = fixture({
      // Field now also uses InfoButton's constant (not its module), so its bundle keeps the string.
      'dist/components/input/Field.mjs': files['dist/components/input/Field.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { infoButtonClassNames } from '../../lib/classNames.mjs';\n",
        )
        .replace('return cn(', 'return cn(infoButtonClassNames.root, '),
    });
    expect(await probeTreeShaking(dist, fieldDrop)).toEqual([
      'the bundle of an import of only Field contains the string "wave-info-button" (an unused constant was not tree-shaken)',
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

describe('probeSizeBudget', () => {
  const presenceBudget = {
    names: ['usePresence', 'Presence'],
    maxMinifiedBytes: 5120,
    maxGzipBytes: 2048,
    allowedExternals: ['react', 'react/jsx-runtime'],
  };

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
  it('is closed: the list is empty and the real exports pass, final mode included', async () => {
    expect(PENDING_FLAT_EXPORTS).toEqual([]);
    const mod = await import('../../src/index.ts');
    expect(checkFlatExports(mod)).toEqual({ errors: [], pending: [], planned: [] });
    expect(checkFlatExports(mod, { final: true })).toEqual({
      errors: [],
      pending: [],
      planned: [],
    });
  }, 60_000);

  it('the real exports carry the flat name of every compound member, the 0.8 parts included', async () => {
    const mod = await import('../../src/index.ts');
    const members = [
      ['Toast', 'Title'],
      ['Toast', 'Body'],
      ['Toast', 'Footer'],
      ['Toast', 'Close'],
      ['MessageBar', 'Title'],
      ['MessageBar', 'Actions'],
      ['ColorPicker', 'HexField'],
      ['ColorPicker', 'Swatches'],
      ['ColorPicker', 'Preview'],
      ['Tree', 'ItemPersonaLayout'],
      ['Toolbar', 'Button'],
      // 0.11
      ['Drawer', 'Header'],
      ['Drawer', 'HeaderTitle'],
      ['Drawer', 'HeaderNavigation'],
      ['Drawer', 'Body'],
      ['Drawer', 'Footer'],
      ['Nav', 'SectionHeader'],
      ['Nav', 'Divider'],
      ['Nav', 'AppItem'],
      ['Nav', 'AppItemStatic'],
      ['NavDrawer', 'Header'],
      ['NavDrawer', 'Body'],
      ['NavDrawer', 'Footer'],
      ['InteractionTag', 'Primary'],
      ['InteractionTag', 'Secondary'],
      ['TagPicker', 'Control'],
      ['TagPicker', 'Group'],
      ['TagPicker', 'Input'],
      ['TagPicker', 'Button'],
      ['TagPicker', 'List'],
      ['TagPicker', 'Option'],
      ['TagPicker', 'OptionGroup'],
    ];
    for (const [compound, member] of members) {
      expect(mod[`${compound}${member}`], `${compound}${member}`).toBe(mod[compound][member]);
    }
    const result = checkFlatExports(mod);
    expect(result.errors).toEqual([]);
    // Only the bridge's own entries may be planned or pending.
    expect(
      [...result.planned, ...result.pending].filter(
        (n) => !PENDING_FLAT_EXPORTS.some((entry) => n.startsWith(entry)),
      ),
    ).toEqual([]);
  }, 60_000);
});

describe('the 0.8 opt-in modules and the Toaster probe (INTEGRATION)', () => {
  it('lists the color parts, the color helpers and the toaster handle, sorted', () => {
    expect(OPT_IN_MODULES).toEqual([
      'components/input/AlphaSlider.mjs',
      'components/input/ColorArea.mjs',
      'components/input/ColorSlider.mjs',
      'lib/color.mjs',
      'lib/toaster.mjs',
    ]);
    expect([...OPT_IN_MODULES].sort()).toEqual(OPT_IN_MODULES);
  });

  it('passes when an import of only Button holds none of them', async () => {
    expect(
      await probeTreeShaking(fixture().dist, {
        keep: 'Button',
        drop: 'ColorArea',
        dropModules: OPT_IN_MODULES,
      }),
    ).toEqual([]);
  });

  it('verifyDist reports a Button bundle that holds the color helpers', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/button/Button.mjs': files['dist/components/button/Button.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { hsvToHex } from '../../lib/color.mjs';\n",
        )
        .replace('return cn(', 'hsvToHex({ h: 0, s: 0, v: 0 }); return cn('),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'lib/color.mjs is in the bundle of an import of only Button (ColorArea must be dropped)',
    ]);
  }, 90_000);

  it('verifyDist reports a Toaster bundle without the presence core', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/feedback/Toaster.mjs': files['dist/components/feedback/Toaster.mjs']
        .replace("import { usePresence } from '../../hooks/usePresence.mjs';\n", '')
        .replace(
          'const { isMounted, phase } = usePresence(true);',
          "const isMounted = true; const phase = 'entered';",
        ),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'hooks/usePresence.mjs is not in the bundle of an import of only Toaster',
    ]);
  }, 90_000);
});

describe('verifyDist: the 0.12 hook probes', () => {
  it('reports a hook whose bundle holds a component', async () => {
    const { dist } = fixture({
      'dist/hooks/useFocusVisible.mjs':
        '"use client";\n' +
        "import { Dialog } from '../components/overlays/Dialog.mjs';\n" +
        'export function useFocusVisible() { return Dialog.displayName === "x"; }\n',
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/overlays/Dialog.mjs is in the bundle of an import of only useFocusVisible',
    ]);
  }, 90_000);

  it('reports a hook that imports the positioning library without needing it', async () => {
    const { dist } = fixture({
      'dist/hooks/useFocusVisible.mjs':
        '"use client";\n' +
        "import { flip } from '@floating-ui/react-dom';\n" +
        'export function useFocusVisible() { return typeof flip; }\n',
    });
    const { errors } = await verifyDist(dist, noPending);
    // The fixture's package.json does not list the library, which a second check also reports.
    expect(errors).toContain(
      'the bundle of an import of only useFocusVisible imports @floating-ui/react-dom',
    );
  }, 90_000);

  it('reports a probe module that dist lacks', async () => {
    const { dist } = fixture();
    rmSync(join(dist, 'components/overlays/Popover.mjs'));
    const { errors } = await verifyDist(dist, noPending);
    expect(
      errors.some((error) =>
        /Popover\.mjs, listed for the hook .* does not exist in dist/.test(error),
      ),
    ).toBe(true);
  }, 90_000);
});

describe('verifyDist: the 0.13 helper probes', () => {
  it('reports a helper whose bundle holds an Avatar component', async () => {
    const { dist } = fixture({
      'dist/lib/initials.mjs':
        "import { Avatar } from '../components/data-display/Avatar.mjs';\n" +
        'export function getInitials() { return Avatar.displayName; }\n',
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/data-display/Avatar.mjs is in the bundle of an import of only getInitials',
      'the bundle of an import of only getInitials imports react',
    ]);
  }, 90_000);

  it('reports a helper that imports a React module', async () => {
    const { dist } = fixture({
      'dist/components/data-display/AvatarGroup.partition.mjs':
        '"use client";\n' +
        "import { useState } from 'react';\n" +
        'export function partitionAvatarGroupItems() { return useState(0); }\n',
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toContain(
      'the bundle of an import of only partitionAvatarGroupItems imports react',
    );
  }, 90_000);

  it('reports a helper module that dist lacks', async () => {
    const { dist } = fixture();
    rmSync(join(dist, 'components/data-display/Persona.mjs'));
    const { errors } = await verifyDist(dist, noPending);
    expect(
      errors.some((error) =>
        /Persona\.mjs, listed for the hook .* does not exist in dist/.test(error),
      ),
    ).toBe(true);
  }, 90_000);
});

describe('verifyDist: the 0.14 helper probes', () => {
  it('reports a table helper whose bundle holds a table component', async () => {
    const { dist } = fixture({
      'dist/lib/table.mjs':
        "import { DataGrid } from '../components/table/DataGrid.mjs';\n" +
        'export function createTableColumn(options) { return { ...options, grid: DataGrid.displayName }; }\n',
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/table/DataGrid.mjs is in the bundle of an import of only createTableColumn',
      'the bundle of an import of only createTableColumn imports react',
    ]);
  }, 90_000);

  it('probes each breadcrumb helper on its own', async () => {
    const code = breadcrumbModule(
      () => 'return Breadcrumb.displayName;',
      "import { Breadcrumb } from '../components/navigation/Breadcrumb.mjs';\n",
    );
    const { dist } = fixture({ 'dist/lib/breadcrumb.mjs': code });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      BREADCRUMB_HELPERS.flatMap((name) => [
        `components/navigation/Breadcrumb.mjs is in the bundle of an import of only ${name}`,
        `the bundle of an import of only ${name} imports react`,
      ]),
    );
  }, 90_000);

  it('reports a breadcrumb helper whose bundle holds the Overflow the Breadcrumb is built on', async () => {
    const code = breadcrumbModule(
      (name) =>
        name === 'truncateBreadcrumbLongTooltip' ? 'return Overflow.displayName;' : 'return null;',
      "import { Overflow } from '../components/layout/Overflow.mjs';\n",
    );
    const { dist } = fixture({ 'dist/lib/breadcrumb.mjs': code });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/layout/Overflow.mjs is in the bundle of an import of only truncateBreadcrumbLongTooltip',
      'the bundle of an import of only truncateBreadcrumbLongTooltip imports react',
    ]);
  }, 90_000);

  it('reports every helper of a module that imports a React module', async () => {
    // One helper uses React; the bundler keeps the external import for the others too.
    const code = breadcrumbModule(
      (name) =>
        name === 'partitionBreadcrumbItems' ? 'return React.useState(0);' : 'return null;',
      "import * as React from 'react';\n",
    );
    const { dist } = fixture({ 'dist/lib/breadcrumb.mjs': code });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      BREADCRUMB_HELPERS.map((name) => `the bundle of an import of only ${name} imports react`),
    );
  }, 90_000);

  it('reports a helper module that dist lacks', async () => {
    const { dist } = fixture();
    rmSync(join(dist, 'components/table/Table.shared.mjs'));
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toContain(
      'components/table/Table.shared.mjs, listed for the hook createTableColumn, does not exist in dist',
    );
  }, 90_000);
});

describe('checkServerImport: the 0.8 server-safe modules (INTEGRATION)', () => {
  it('reads the color helpers and createToaster from lib and from the entry', async () => {
    expect(await checkServerImport(fixture().dist)).toEqual([]);
  }, 30_000);

  it('reports a missing color or toaster module', async () => {
    const errors = await checkServerImport(
      fixture({ 'dist/lib/color.mjs': null, 'dist/lib/toaster.mjs': null }).dist,
    );
    expect(errors).toEqual(['lib/color.mjs is missing', 'lib/toaster.mjs is missing']);
  }, 30_000);

  it('reports a handle that calls client code on the server', async () => {
    const { dist } = fixture({
      'dist/lib/toaster.mjs':
        "import { useThing } from '../hooks/useThing.mjs';\n" +
        "export function createToaster() { return { dispatchToast: () => { useThing(); return 'id'; }, dismissToast() {}, dismissAllToasts() {} }; }\n",
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(
        /^lib\/toaster\.mjs under node --conditions=react-server: Attempted to call useThing\(\) from the server/,
      ),
    ]);
  }, 30_000);

  it('reports a handle whose dispatch returns no id', async () => {
    const { dist } = fixture({
      'dist/lib/toaster.mjs':
        'export function createToaster() { return { dispatchToast() {}, dismissToast() {}, dismissAllToasts() {} }; }\n',
    });
    expect(await checkServerImport(dist)).toEqual([
      "lib/toaster.mjs under node --conditions=react-server: dispatchToast('x') returned undefined, not an id",
    ]);
  }, 30_000);

  it('reports a handle that keeps server dispatches in a global', async () => {
    const { dist } = fixture({
      'dist/lib/toaster.mjs':
        'export function createToaster() {\n' +
        '  return {\n' +
        "    dispatchToast(arg) { (globalThis.__fixtureToasts ??= []).push(arg); return (arg && arg.toastId) || 'id'; },\n" +
        '    dismissToast() {},\n' +
        '    dismissAllToasts() {},\n' +
        '  };\n' +
        '}\n',
    });
    expect(await checkServerImport(dist)).toEqual([
      'lib/toaster.mjs under node --conditions=react-server: a dispatch on the server added a global (it must do nothing)',
    ]);
  }, 30_000);

  it('reports an entry whose createToaster comes from a "use client" module', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/hooks/useThing.mjs': `${files['dist/hooks/useThing.mjs']}export { createToaster } from '../lib/toaster.mjs';\n`,
      'dist/index.mjs': files['dist/index.mjs'].replace(
        "export { createToaster } from './lib/toaster.mjs';",
        "export { createToaster } from './hooks/useThing.mjs';",
      ),
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(
        /^index\.mjs under node --conditions=react-server: createToaster is a client reference/,
      ),
    ]);
  }, 30_000);
});

describe('the 0.10 probes (INTEGRATION)', () => {
  const calendarOnly = {
    keep: 'Calendar',
    drop: 'Dropdown',
    dropModules: ['hooks/useListbox.mjs', 'components/input/Option.mjs'],
  };
  const listboxOnly = { keep: 'Listbox', drop: 'Calendar' };

  it('passes when Calendar holds no listbox code and Listbox no calendar code', async () => {
    const { dist } = fixture();
    expect(await probeTreeShaking(dist, calendarOnly)).toEqual([]);
    expect(await probeTreeShaking(dist, listboxOnly)).toEqual([]);
  });

  it('reports a Calendar that imports the listbox hook', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/input/Calendar.mjs': files['dist/components/input/Calendar.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { useListbox } from '../../hooks/useListbox.mjs';\n",
        )
        .replace('return cn(', 'useListbox(); return cn('),
    });
    expect(await probeTreeShaking(dist, calendarOnly)).toEqual([
      'hooks/useListbox.mjs is in the bundle of an import of only Calendar (Dropdown must be dropped)',
    ]);
  });

  it('reports a Listbox that imports the Calendar', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/input/Listbox.mjs': files['dist/components/input/Listbox.mjs']
        .replace(
          "import { Option } from './Option.mjs';\n",
          "import { Option } from './Option.mjs';\nimport { Calendar } from './Calendar.mjs';\n",
        )
        .replace('return Option();', 'Calendar({ value: new Date(0) }); return Option();'),
    });
    expect(await probeTreeShaking(dist, listboxOnly)).toEqual([
      'components/input/Calendar.mjs is in the bundle of an import of only Listbox (Calendar must be dropped)',
      'Calendar code (displayName "Calendar") is in the bundle of an import of only Listbox',
    ]);
  });

  it('verifyDist runs both exclusion probes', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/input/Listbox.mjs': files['dist/components/input/Listbox.mjs']
        .replace(
          "import { Option } from './Option.mjs';\n",
          "import { Option } from './Option.mjs';\nimport { Calendar } from './Calendar.mjs';\n",
        )
        .replace('return Option();', 'Calendar({ value: new Date(0) }); return Option();'),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/input/Calendar.mjs is in the bundle of an import of only Listbox (Calendar must be dropped)',
      'Calendar code (displayName "Calendar") is in the bundle of an import of only Listbox',
    ]);
  }, 90_000);

  it('verifyDist reports a Calendar that imports the listbox hook (the CALENDAR_ONLY probe)', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/input/Calendar.mjs': files['dist/components/input/Calendar.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { useListbox } from '../../hooks/useListbox.mjs';\n",
        )
        .replace('return cn(', 'useListbox(); return cn('),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'hooks/useListbox.mjs is in the bundle of an import of only Calendar (Dropdown must be dropped)',
    ]);
  }, 90_000);

  it('reports a missing lib/date module', async () => {
    const errors = await checkServerImport(fixture({ 'dist/lib/date.mjs': null }).dist);
    expect(errors).toEqual(['lib/date.mjs is missing']);
  }, 30_000);

  it('reports a date module whose addDays does not return a Date', async () => {
    const { dist } = fixture({ 'dist/lib/date.mjs': 'export function addDays() { return 1; }\n' });
    expect(await checkServerImport(dist)).toEqual([
      // The entry re-exports the same function, so it fails there too.
      expect.stringMatching(/^index\.mjs under node --conditions=react-server: addDays/),
      expect.stringMatching(/^lib\/date\.mjs under node --conditions=react-server: addDays/),
    ]);
  }, 30_000);

  it('reports an entry whose addDays comes from a "use client" module', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/hooks/useThing.mjs': `${files['dist/hooks/useThing.mjs']}export { addDays } from '../lib/date.mjs';\n`,
      'dist/index.mjs': files['dist/index.mjs'].replace(
        "export { addDays } from './lib/date.mjs';",
        "export { addDays } from './hooks/useThing.mjs';",
      ),
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(
        /^index\.mjs under node --conditions=react-server: addDays is a client reference/,
      ),
    ]);
  }, 30_000);

  it.each(['useActiveDescendant', 'Calendar', 'TagGroup', 'NavDrawer'])(
    'requires %s in the roll-up',
    (name) => {
      expect(REQUIRED_DECLARATIONS).toContain(name);
      const dts = DTS.split('\n')
        .filter((line) => !new RegExp(`declare (const|function) ${name}\\b`).test(line))
        .join('\n');
      expect(checkDeclarations(fixture({ 'dist/index.d.ts': dts }).dist)).toEqual([
        expect.stringMatching(
          new RegExp(`^index\\.d\\.ts does not declare and export ${name} \\(`),
        ),
      ]);
    },
  );
});

describe('the 0.11 probes (INTEGRATION)', () => {
  /** The module that renders a probe's `keep`: a compound with an imported root renders there. */
  const RENDER_MODULE = {
    Tag: 'components/data-display/Tag',
    TagGroup: 'components/data-display/TagGroup',
    InteractionTag: 'components/data-display/InteractionTag',
    Combobox: 'components/input/Combobox',
    Dialog: 'components/overlays/Dialog',
    Drawer: 'components/overlays/Drawer.root',
    Toaster: 'components/feedback/Toaster',
    Nav: 'components/navigation/Nav.root',
    Hamburger: 'components/navigation/Hamburger',
    NavDrawer: 'components/navigation/NavDrawer',
  };
  /** An export of a fixture module (path without its extension). */
  const exportOf = (module) => {
    const spec = PHASE6_MODULES[module];
    if (spec) return spec.hook ?? spec.name;
    return { 'components/overlays/Dialog': 'Dialog', 'hooks/useListbox': 'useListbox' }[module];
  };
  /** The module of a dropped component (a probe without `dropModules`). */
  const DROP_MODULE = {
    TagGroup: 'components/data-display/TagGroup',
    Dialog: 'components/overlays/Dialog',
  };
  /** The module a defect adds to the bundle of `keep`: the first dropped module, else `drop`'s. */
  const droppedModule = ({ drop, dropModules = [] }) =>
    dropModules.length > 0 ? dropModules[0].replace(/\.mjs$/, '') : DROP_MODULE[drop];
  /** The fixture with `keep`'s render calling an export of the module that must be dropped. */
  const withDroppedImport = (probe) => {
    const files = goodFiles();
    const path = RENDER_MODULE[probe.keep];
    const module = droppedModule(probe);
    const file = `dist/${path}.mjs`;
    return {
      module,
      dist: fixture({ [file]: withCall(files[file], path, module, exportOf(module)) }).dist,
    };
  };

  it('lists the probes of the spec (§6.2)', () => {
    expect(EXCLUSION_PROBES_0_11.map(({ keep, drop }) => `${keep} without ${drop}`)).toEqual([
      'Tag without TagPicker',
      'TagGroup without TagPicker',
      'InteractionTag without TagGroup',
      'Combobox without TagPicker',
      'Dialog without Drawer',
      'Drawer without Dialog',
      'Toaster without Drawer',
      'Nav without NavDrawer',
      'Hamburger without NavDrawer',
      'NavDrawer without Drawer',
    ]);
    expect(INCLUSION_PROBES_0_11.map(({ keep }) => keep)).toEqual([
      'TagPicker',
      'Dialog',
      'Drawer',
      'NavDrawer',
    ]);
    for (const { keep } of EXCLUSION_PROBES_0_11) expect(RENDER_MODULE[keep], keep).toBeDefined();
  });

  it.each(EXCLUSION_PROBES_0_11.map((probe) => [probe.keep, probe.drop, probe]))(
    'an import of only %s drops %s: passes on a correct dist, reports the dropped module it imports',
    async (_keep, _drop, probe) => {
      expect(await probeTreeShaking(fixture().dist, probe)).toEqual([]);
      const { module, dist } = withDroppedImport(probe);
      expect(module).toBeDefined();
      expect(await probeTreeShaking(dist, probe)).toContain(
        `${module}.mjs is in the bundle of an import of only ${probe.keep} (${probe.drop} must be dropped)`,
      );
    },
    30_000,
  );

  it('reports the class string of a module a Tag must not reach', async () => {
    const probe = EXCLUSION_PROBES_0_11[0];
    const { dist } = withDroppedImport(probe);
    expect(await probeTreeShaking(dist, probe)).toEqual([
      'components/button/Toolbar.navigation.mjs is in the bundle of an import of only Tag (TagPicker must be dropped)',
      'components/data-display/TagGroup.mjs is in the bundle of an import of only Tag (TagPicker must be dropped)',
      'the bundle of an import of only Tag contains the string "wave-tag-group" (an unused constant was not tree-shaken)',
    ]);
  });

  /** A fixture in which `keep` reaches none of its included modules. */
  const INCLUSION_DEFECTS = {
    TagPicker: () => ({
      'dist/components/input/TagPicker.mjs': phase6Module('components/input/TagPicker', {
        name: 'TagPicker',
        members: [['List'], ['Option']],
      }),
    }),
    Dialog: (files) => ({
      'dist/components/overlays/Dialog.mjs': files['dist/components/overlays/Dialog.mjs']
        .replace("import { usePresence } from '../../hooks/usePresence.mjs';\n", '')
        .replace('usePresence(props); ', ''),
    }),
    Drawer: () => ({
      'dist/components/overlays/Drawer.root.mjs': phase6Module('components/overlays/Drawer.root', {
        ...PHASE6_MODULES['components/overlays/Drawer.root'],
        uses: [],
      }),
    }),
    NavDrawer: () => ({
      'dist/components/navigation/NavDrawer.mjs': phase6Module('components/navigation/NavDrawer', {
        ...PHASE6_MODULES['components/navigation/NavDrawer'],
        uses: [],
      }),
    }),
  };

  it.each(INCLUSION_PROBES_0_11.map((probe) => [probe.keep, probe]))(
    'an import of only %s holds its modules: passes on a correct dist, reports each one missing',
    async (keep, probe) => {
      expect(await probeIncludes(fixture().dist, probe)).toEqual([]);
      const { dist } = fixture(INCLUSION_DEFECTS[keep](goodFiles()));
      expect(await probeIncludes(dist, probe)).toEqual(
        probe.modules.map((path) => `${path} is not in the bundle of an import of only ${keep}`),
      );
    },
    30_000,
  );

  it('verifyDist runs the exclusion probes', async () => {
    const { dist } = withDroppedImport(EXCLUSION_PROBES_0_11[7]);
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/overlays/Drawer.panel.mjs is in the bundle of an import of only Nav (NavDrawer must be dropped)',
      'hooks/useModalLayer.mjs is in the bundle of an import of only Nav (NavDrawer must be dropped)',
    ]);
  }, 90_000);

  it('verifyDist runs the inclusion probes', async () => {
    const { dist } = fixture(INCLUSION_DEFECTS.NavDrawer());
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      INCLUSION_PROBES_0_11[3].modules.map(
        (path) => `${path} is not in the bundle of an import of only NavDrawer`,
      ),
    );
  }, 90_000);
});

describe('module-only names (0.11 INTEGRATION)', () => {
  it('lists the module-only names of spec §4.5, sorted and without duplicates', () => {
    expect(MODULE_ONLY_NAMES).toEqual([...new Set(MODULE_ONLY_NAMES)].sort());
    expect(MODULE_ONLY_NAMES).toEqual(
      expect.arrayContaining([
        'useToolbarNavigation',
        'TOOLBAR_ITEM_SELECTOR',
        'AvatarSizeContext',
        'hasIsolatingModalBelow',
        'TagGroupContext',
        'DrawerPanel',
        'NavRoot',
        'NavDrawerContext',
        'TagPickerRoot',
        'findExactMatch',
      ]),
    );
  });

  it('lists the 0.14 seams (spec D6): the shared table parts, the Overflow store, the tour context and the event predicates', () => {
    expect(MODULE_ONLY_NAMES).toEqual(
      expect.arrayContaining([
        'TableSelectionControl',
        'TableSortButton',
        'markTablePart',
        'getTablePartKind',
        'OverflowStore',
        'NO_IDS',
        'NO_GROUPS',
        'sameIds',
        'hasResizeObserver',
        'ItemMeta',
        'StoreConfig',
        'TeachingPopoverContext',
        'TeachingPopoverRoot',
        'TeachingSurface',
        'isForeignEvent',
        'SortArrowUpIcon',
      ]),
    );
  });

  it('lists every export of the internal motion modules (0.15, spec §16 Q1): the recipes, the resolver and the hooks', () => {
    // Read from the sources, so a new recipe constant or hook export is listed before it ships.
    const modules = [
      'src/lib/motion.ts',
      'src/hooks/useMotion.ts',
      'src/hooks/useCollapsePresence.ts',
      'src/hooks/useFocusBeforeClose.ts',
      'src/hooks/usePresenceGroup.ts',
    ];
    const names = [];
    for (const path of modules) {
      const source = readFileSync(join(repoRoot, path), 'utf8');
      // Every export is a declaration, so the pattern below sees each one.
      expect(source, path).not.toMatch(/^export\s+(?:type\s+)?(?:\{|\*)|^export\s+default\b/m);
      const found = Array.from(
        source.matchAll(
          /^export (?:declare )?(?:async )?(?:function\*?|const|let|class|interface|type|enum) (\w+)/gm,
        ),
        (match) => match[1],
      );
      expect(found.length, path).toBeGreaterThan(0);
      names.push(...found);
    }
    // The pattern finds every value the motion module exports at run time, records and functions.
    expect(names).toEqual(expect.arrayContaining(Object.keys(motionSource)));
    expect(names.filter((name) => !MODULE_ONLY_NAMES.includes(name))).toEqual([]);
    expect(MODULE_ONLY_NAMES).toEqual(
      expect.arrayContaining([
        'PresenceGroupEntry',
        'UseCollapsePresenceOptions',
        'UseCollapsePresenceResult',
        'UseFocusBeforeCloseOptions',
        'UsePresenceGroupResult',
        'resolveMotion',
        'useCollapsePresence',
        'useFocusBeforeClose',
        'useMotionClasses',
        'useMotionPreference',
        'usePresenceGroup',
        'collapseMotion',
        'dialogMotion',
        'popupMotion',
      ]),
    );
  });

  it('passes for an entry and a roll-up that export none of them', async () => {
    const { dist } = fixture();
    const mod = await import(pathToFileURL(join(dist, 'index.mjs')).href);
    expect(checkModuleOnlyNames(mod, DTS)).toEqual([]);
  });

  it('reports a module-only value of the entry and a module-only type of the roll-up', () => {
    const dts = `${DTS}export declare interface TagGroupContextValue { size: string }\n`;
    expect(
      checkModuleOnlyNames({ useToolbarNavigation: () => null, Tag: () => null }, dts),
    ).toEqual([
      'index.d.ts exports TagGroupContextValue, which is module-only (keep it out of the barrels)',
      'dist/index.mjs exports useToolbarNavigation, which is module-only (keep it out of the barrels)',
    ]);
    expect(checkModuleOnlyNames({}, undefined, ['Tag'])).toEqual([]);
  });

  it('verifyDist reports an entry that exports a module-only hook', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/index.mjs': `${files['dist/index.mjs']}export { useToolbarNavigation } from './components/button/Toolbar.navigation.mjs';\n`,
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'dist/index.mjs exports useToolbarNavigation, which is module-only (keep it out of the barrels)',
    ]);
  }, 90_000);
});

describe('names declared as a type and a value (0.11 INTEGRATION)', () => {
  it('lists TagPickerOption, the entry interface and the component', () => {
    expect(VALUE_AND_TYPE_DECLARATIONS).toEqual(['TagPickerOption']);
    expect(missingValueAndTypeDeclarations(DTS, VALUE_AND_TYPE_DECLARATIONS)).toEqual([]);
  });

  it('reports a name exported only as a type or only as a value', () => {
    const typeOnly = DTS.replace(
      '/** An option of a TagPicker. */\nexport declare const TagPickerOption',
      '/** An option of a TagPicker. */\ndeclare const TagPickerOption',
    );
    const valueOnly = DTS.replace(
      'export declare interface TagPickerOption',
      'declare interface TagPickerOption',
    );
    expect(typeOnly).not.toBe(DTS);
    expect(valueOnly).not.toBe(DTS);
    expect(missingValueAndTypeDeclarations(typeOnly, ['TagPickerOption'])).toEqual([
      'TagPickerOption',
    ]);
    expect(missingValueAndTypeDeclarations(valueOnly, ['TagPickerOption'])).toEqual([
      'TagPickerOption',
    ]);
    // An export list that renames the declarations exports both meanings.
    const renamed =
      'declare interface TagPickerOption_2 { value: string }\n' +
      '/** An option. */\ndeclare const TagPickerOption_2: () => null;\n' +
      'export { TagPickerOption_2 as TagPickerOption }\n';
    expect(missingValueAndTypeDeclarations(renamed, ['TagPickerOption'])).toEqual([]);
  });

  it('checkDeclarations reports a roll-up that keeps only the TagPickerOption interface', () => {
    const dts = DTS.replace(
      '/** An option of a TagPicker. */\nexport declare const TagPickerOption: (props: object) => null;\n',
      '',
    );
    expect(dts).not.toBe(DTS);
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': dts }).dist)).toEqual([
      'index.d.ts does not export TagPickerOption both as a type and as a value (the interface and the component of one name: export the name once, without `type`, from the barrel)',
    ]);
  });
});

describe('the class-name registry (P3-00)', () => {
  it('requires the class-name constants in the roll-up (buttonClassNames)', () => {
    expect(REQUIRED_DECLARATIONS).toContain('buttonClassNames');
    const dts = DTS.replace(/^export declare const buttonClassNames.*\n/m, '');
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': dts }).dist)).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export buttonClassNames \(/),
    ]);
  });

  it('reports an entry whose buttonClassNames is a client reference (from a "use client" module)', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/button/Button.mjs': `${files['dist/components/button/Button.mjs']}export { buttonClassNames } from '../../lib/classNames.mjs';\n`,
      'dist/index.mjs': files['dist/index.mjs'].replace(
        "export { buttonClassNames, dialogContentClassNames } from './lib/classNames.mjs';",
        "export { buttonClassNames } from './components/button/Button.mjs';\n" +
          "export { dialogContentClassNames } from './lib/classNames.mjs';",
      ),
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(
        /^index\.mjs under node --conditions=react-server: buttonClassNames is not a plain object/,
      ),
    ]);
  }, 30_000);

  it('reports a class-name module whose export is not an object of strings', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/lib/classNames.mjs': `${files['dist/lib/classNames.mjs']}export const brokenClassNames = { root: 1 };\n`,
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(
        /^lib\/classNames\.mjs under node --conditions=react-server: brokenClassNames is not an object of class-name strings/,
      ),
    ]);
  }, 30_000);

  it('passes when the entry exports every class-name constant with the same value', async () => {
    expect(await checkClassNameExports(fixture().dist)).toEqual([]);
  });

  it('reports a registry constant the entry does not export', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/index.mjs': files['dist/index.mjs'].replace(
        'export { buttonClassNames, dialogContentClassNames }',
        'export { buttonClassNames }',
      ),
    });
    expect(await checkClassNameExports(dist)).toEqual([
      'index.mjs does not export dialogContentClassNames (a class-name constant of lib/classNames.mjs)',
    ]);
  });

  it('reports a constant the entry exports with another value', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/index.mjs': files['dist/index.mjs'].replace(
        'export { buttonClassNames, dialogContentClassNames }',
        "export const buttonClassNames = { root: 'wave-button' };\nexport { dialogContentClassNames }",
      ),
    });
    expect(await checkClassNameExports(dist)).toEqual([
      'index.mjs exports buttonClassNames with another value than lib/classNames.mjs',
    ]);
  });

  it('reports a missing registry module', async () => {
    expect(await checkClassNameExports(fixture({ 'dist/lib/classNames.mjs': null }).dist)).toEqual([
      'lib/classNames.mjs is missing (the class-name registry, src/lib/classNames.ts)',
    ]);
  });
});

describe('probeTreeShaking: class-name strings (P3-00)', () => {
  const strings = { keepStrings: ['wave-button'], dropStrings: ['wave-dialog-content'] };

  it("passes when the bundle keeps Button's class string and drops the unused constant", async () => {
    expect(await probeTreeShaking(fixture().dist, strings)).toEqual([]);
  });

  it('reports a string that should have been dropped', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      // Button now also uses the Dialog surface's constant, so its bundle keeps that string.
      'dist/components/button/Button.mjs': files['dist/components/button/Button.mjs']
        .replace(
          'import { buttonClassNames } from',
          'import { buttonClassNames, dialogContentClassNames } from',
        )
        .replace(
          'cn(buttonClassNames.root, ',
          'cn(buttonClassNames.root, dialogContentClassNames.root, ',
        ),
    });
    expect(await probeTreeShaking(dist, strings)).toEqual([
      'the bundle of an import of only Button contains the string "wave-dialog-content" (an unused constant was not tree-shaken)',
    ]);
  });

  it('reports a string the bundle lacks', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/button/Button.mjs': files['dist/components/button/Button.mjs']
        .replace("import { buttonClassNames } from '../../lib/classNames.mjs';\n", '')
        .replace('cn(buttonClassNames.root, ', 'cn('),
    });
    expect(await probeTreeShaking(dist, strings)).toEqual([
      'the bundle of an import of only Button lacks the string "wave-button"',
    ]);
  });

  it('reports a listed string that occurs in no module of dist (the probe would pass vacuously)', async () => {
    expect(
      await probeTreeShaking(fixture().dist, {
        keepStrings: ['wave-button'],
        dropStrings: ['wave-gone'],
      }),
    ).toEqual([
      '"wave-gone", listed for the bundle of an import of only Button, occurs in no module of dist (the probe would pass vacuously)',
    ]);
  });
});

/**
 * The motion recipes of the fixture (spec §2.10, D23): the recipe literals its components read
 * (the Dialog's two; the collapse structure and motion of the Accordion; and, 0.15, the three of
 * the MessageBarGroup, whose structures and enter hold no transition, only the presence variant)
 * and a record of durations (the drawer durations hold no presence variant, no transition and no
 * animation). Every one is exported by both motion modules of the fixture, the good files' and
 * {@link motionModule}'s: a module the bundler reaches must export every name imported from it.
 */
const MOTION_RECIPES = {
  dialogMotion:
    'transition-[opacity,scale] duration-wave-gentle ease-wave-decelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
  dialogBackdropMotion:
    'transition-opacity duration-wave-gentle ease-wave-easy-ease motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
  collapseStructure:
    'grid grid-rows-[minmax(0,1fr)] overflow-hidden data-[presence=entered]:contents',
  collapseMotion:
    'transition-[grid-template-rows,opacity] duration-wave-normal ease-wave-easy-ease-max motion-reduce:transition-none data-[presence=exiting]:grid-rows-[minmax(0,0fr)]',
  messageBarGroupItemStructure:
    'grid grid-rows-[minmax(0,1fr)] items-end overflow-hidden data-[presence=entered]:contents',
  messageBarGroupExitMotion:
    'transition-[grid-template-rows,margin-bottom,opacity] duration-wave-gentle ease-wave-linear motion-reduce:transition-none data-[presence=exiting]:opacity-0',
  messageBarGroupEnterMotion: 'data-[presence=entering]:starting:opacity-0',
};
const MOTION_DURATIONS = { small: 'duration-wave-gentle', large: 'duration-wave-slow' };
/** The literals `motionRecipeLiterals` reads from the fixture: exports by name, records by key. */
const MOTION_LITERALS = [
  MOTION_RECIPES.collapseMotion,
  MOTION_RECIPES.collapseStructure,
  MOTION_RECIPES.dialogBackdropMotion,
  MOTION_RECIPES.dialogMotion,
  MOTION_DURATIONS.small,
  MOTION_DURATIONS.large,
  MOTION_RECIPES.messageBarGroupEnterMotion,
  MOTION_RECIPES.messageBarGroupExitMotion,
  MOTION_RECIPES.messageBarGroupItemStructure,
];

/**
 * The resolver of a fixture `lib/motion` (without its export), as the real module's: the slot, then
 * the provider's preference, then the recipe (1.0: no className rule, so no literal of its own).
 */
const MOTION_RESOLVER =
  'function resolveMotion(slot, recipe, preference) {\n' +
  "  if (slot === null) return '';\n" +
  "  if (slot !== undefined) return typeof slot === 'string' ? slot : slot.className;\n" +
  "  if (preference === 'none') return '';\n" +
  '  return recipe;\n' +
  '}\n';

/** A fixture `lib/motion.mjs`: the recipes, the durations, `extra` exports and the resolver. */
function motionModule(extra = '') {
  return (
    MOTION_RESOLVER +
    Object.entries(MOTION_RECIPES)
      .map(([name, value]) => `export const ${name} = '${value}';\n`)
      .join('') +
    `export const drawerDurations = ${JSON.stringify(MOTION_DURATIONS)};\n` +
    extra +
    'export { resolveMotion };\n'
  );
}

/**
 * The recipes of the good files' `lib/motion` (0.15): those of {@link MOTION_RECIPES}, which the
 * fixture's components read, then generated ones up to {@link MOTION_RECIPE_MIN}, so
 * `verifyDist`'s default minimum (the release count) holds.
 */
function fixtureMotionRecipes() {
  const recipes = { ...MOTION_RECIPES };
  for (let i = Object.keys(recipes).length; i < Math.max(MOTION_RECIPE_MIN, 2); i++) {
    recipes[`fixtureMotion${i}`] =
      `transition-opacity duration-wave-fast ease-wave-easy-ease motion-reduce:transition-none data-[presence=exiting]:opacity-${i}`;
  }
  return recipes;
}

/**
 * The good files' motion modules: `lib/motion` (the recipes of {@link fixtureMotionRecipes} and
 * the resolver) and `hooks/useMotion` on it.
 */
function fixtureMotionModules() {
  const recipes = Object.entries(fixtureMotionRecipes());
  return {
    module:
      MOTION_RESOLVER +
      recipes.map(([name, value]) => `export const ${name} = '${value}';\n`).join('') +
      'export { resolveMotion };\n',
    hook:
      `${DIRECTIVE}import { resolveMotion } from '../lib/motion.mjs';\n` +
      "export function useMotionClasses(slot, recipe) { return resolveMotion(slot, recipe, 'default'); }\n",
  };
}

/** The motion classes of the good files' Dialog: its surface's and its backdrop's recipe. */
const DIALOG_MOTION_CALLS =
  'useMotionClasses(props.motion, dialogMotion), useMotionClasses(props.backdropMotion, dialogBackdropMotion), ';

/** `dialog` (the fixture's component module) resolving its two recipes in its render. */
function withDialogMotion(dialog) {
  return dialog
    .replace(
      DIRECTIVE,
      `${DIRECTIVE}import { dialogBackdropMotion, dialogMotion } from '../../lib/motion.mjs';\n` +
        "import { useMotionClasses } from '../../hooks/useMotion.mjs';\n",
    )
    .replace('return cn(', `return cn(${DIALOG_MOTION_CALLS}`);
}

/**
 * The good files (whose Dialog resolves its recipes through `hooks/useMotion`, so an import of
 * only Dialog holds both motion modules) with the recipes and durations of {@link motionModule},
 * then `overrides`.
 */
function motionFixture(overrides = {}) {
  return fixture({ 'dist/lib/motion.mjs': motionModule(), ...overrides });
}

/** Button's module with `code` added to its render (before its `return`). */
function buttonWith(code, imports = '') {
  const files = goodFiles();
  return files['dist/components/button/Button.mjs']
    .replace(DIRECTIVE, `${DIRECTIVE}${imports}`)
    .replace('return cn(', `${code} return cn(`);
}

describe('motionRecipeLiterals (spec §2.10, D23)', () => {
  it('reads every string export of lib/motion.mjs, one level into records', async () => {
    const { dist } = motionFixture();
    expect(await motionRecipeLiterals(dist, { min: 4 })).toEqual({
      literals: MOTION_LITERALS,
      errors: [],
    });
  });

  it('defaults to a minimum of at least the Dialog’s two recipes', () => {
    expect(Number.isInteger(MOTION_RECIPE_MIN) && MOTION_RECIPE_MIN >= 2).toBe(true);
  });

  it('MOTION_RECIPE_MIN is the release count: the literals of src/lib/motion.ts, read as in dist', () => {
    // The source of dist/lib/motion.mjs, read by the rule motionRecipeLiterals applies to the
    // build: a new recipe raises the count here, and a recipe the build loses fails verifyDist.
    const { literals, errors } = motionLiteralsOf(motionSource, 'src/lib/motion.ts');
    expect(errors).toEqual([]);
    expect(literals).toHaveLength(MOTION_RECIPE_MIN);
  });

  it('motionLiteralsOf reads a module namespace: functions skipped, records one level deep, each value once', () => {
    const mod = {
      fade: 'transition-opacity duration-wave-fast',
      byEdge: { start: 'duration-wave-slow', end: 'transition-opacity duration-wave-fast' },
      resolve: () => '',
      count: 3,
    };
    expect(motionLiteralsOf(mod, 'fixture')).toEqual({
      literals: ['transition-opacity duration-wave-fast', 'duration-wave-slow'],
      errors: ['fixture: count is neither a string, a record of strings nor a function'],
    });
  });

  it('reads the good files’ recipes at the default minimum, exports in name order', async () => {
    // A module namespace lists its exports sorted by name (code units).
    const byName = Object.entries(fixtureMotionRecipes()).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    expect(await motionRecipeLiterals(fixture().dist)).toEqual({
      literals: byName.map(([, value]) => value),
      errors: [],
    });
    expect(byName).toHaveLength(Math.max(MOTION_RECIPE_MIN, 2));
  });

  it('reports fewer literals than the default minimum', async () => {
    const { dist } = fixture({
      'dist/lib/motion.mjs': `export const dialogMotion = '${MOTION_RECIPES.dialogMotion}';\n`,
    });
    expect(await motionRecipeLiterals(dist)).toEqual({
      literals: [MOTION_RECIPES.dialogMotion],
      errors: [
        `lib/motion.mjs holds 1 recipe literals, fewer than the minimum of ${MOTION_RECIPE_MIN}`,
      ],
    });
  });

  it('reports fewer literals than the minimum', async () => {
    const { dist } = motionFixture();
    expect((await motionRecipeLiterals(dist, { min: 10 })).errors).toEqual([
      'lib/motion.mjs holds 9 recipe literals, fewer than the minimum of 10',
    ]);
  });

  it('reports a value with none of the recipe markers, and an export of another kind', async () => {
    const { dist } = motionFixture({
      'dist/lib/motion.mjs': motionModule(
        "export const gridStructure = 'grid gap-2';\n" +
          "export const byEdge = { start: 'transition-[translate] duration-wave-slow', end: 'p-0' };\n" +
          'export const stagger = 40;\n',
      ),
    });
    const { literals, errors } = await motionRecipeLiterals(dist, { min: 0 });
    expect(literals).toContain('grid gap-2');
    expect(errors).toEqual([
      'lib/motion.mjs: byEdge.end ("p-0") holds none of [presence=, transition, animate-, duration-wave- (not a recipe)',
      'lib/motion.mjs: gridStructure ("grid gap-2") holds none of [presence=, transition, animate-, duration-wave- (not a recipe)',
      'lib/motion.mjs: stagger is neither a string, a record of strings nor a function',
    ]);
  });

  it('motionRecipeValues reads named recipes: the Dialog’s, for the positive control', async () => {
    expect(
      await motionRecipeValues(fixture().dist, ['dialogMotion', 'dialogBackdropMotion']),
    ).toEqual({
      strings: [MOTION_RECIPES.dialogMotion, MOTION_RECIPES.dialogBackdropMotion],
      errors: [],
    });
  });

  it('motionRecipeValues reports a name that is no string export, and a missing module', async () => {
    const { dist } = motionFixture();
    expect(
      await motionRecipeValues(dist, ['dialogMotion', 'drawerDurations', 'resolveMotion', 'gone']),
    ).toEqual({
      strings: [MOTION_RECIPES.dialogMotion],
      errors: [
        'lib/motion.mjs exports no recipe string drawerDurations',
        'lib/motion.mjs exports no recipe string resolveMotion',
        'lib/motion.mjs exports no recipe string gone',
      ],
    });
    const { dist: bare } = fixture({ 'dist/lib/motion.mjs': null });
    expect(await motionRecipeValues(bare, ['dialogMotion'])).toEqual({
      strings: [],
      errors: ['lib/motion.mjs does not exist in dist'],
    });
  });

  it('reports a dist without lib/motion.mjs (the probe would pass vacuously)', async () => {
    const { dist } = fixture({ 'dist/lib/motion.mjs': null });
    expect(await motionRecipeLiterals(dist, { min: 0 })).toEqual({
      literals: [],
      errors: ['lib/motion.mjs does not exist in dist'],
    });
  });
});

describe('probeTreeShaking: the motion recipes of a Button-only bundle (spec §2.10, D23)', () => {
  const motionDrop = (literals) => ({
    keep: 'Button',
    drop: 'Presence',
    dropModules: ['hooks/usePresence.mjs', 'lib/motion.mjs', 'hooks/useMotion.mjs'],
    dropStrings: literals,
    dropSubstrings: ['[presence='],
  });

  it('passes when Button reaches no motion code', async () => {
    const { dist } = motionFixture();
    const { literals } = await motionRecipeLiterals(dist, { min: 4 });
    expect(await probeTreeShaking(dist, motionDrop(literals))).toEqual([]);
  });

  it('reports a recipe literal in the bundle, also without the motion module', async () => {
    const { dist } = motionFixture({
      'dist/components/button/Button.mjs': buttonWith(
        `const motion = '${MOTION_RECIPES.dialogMotion}';`,
      ).replace('cn(buttonClassNames.root, ', 'cn(buttonClassNames.root, motion, '),
    });
    const { literals } = await motionRecipeLiterals(dist, { min: 4 });
    expect(await probeTreeShaking(dist, motionDrop(literals))).toEqual([
      `the bundle of an import of only Button contains the string "${MOTION_RECIPES.dialogMotion}" (an unused constant was not tree-shaken)`,
      'the bundle of an import of only Button contains "[presence=" outside comments (its minified code)',
    ]);
  });

  it('reports the motion module and its recipe in the bundle of a Button that imports it', async () => {
    const { dist } = motionFixture({
      'dist/components/button/Button.mjs': buttonWith(
        '',
        "import { dialogBackdropMotion } from '../../lib/motion.mjs';\n",
      ).replace('cn(buttonClassNames.root, ', 'cn(buttonClassNames.root, dialogBackdropMotion, '),
    });
    const { literals } = await motionRecipeLiterals(dist, { min: 4 });
    expect(await probeTreeShaking(dist, motionDrop(literals))).toEqual([
      'lib/motion.mjs is in the bundle of an import of only Button (Presence must be dropped)',
      `the bundle of an import of only Button contains the string "${MOTION_RECIPES.dialogBackdropMotion}" (an unused constant was not tree-shaken)`,
      'the bundle of an import of only Button contains "[presence=" outside comments (its minified code)',
    ]);
  });

  it('reports a presence variant in any string of the bundle, never in a comment', async () => {
    const inString = motionFixture({
      'dist/components/button/Button.mjs': buttonWith(
        "const legacy = 'p-0 data-[presence=exiting]:opacity-50';",
      ).replace('cn(buttonClassNames.root, ', 'cn(buttonClassNames.root, legacy, '),
    });
    // A doc comment before a declaration survives in the plain bundle (a comment inside a body
    // does not), so only the minified code tells it from a string.
    const inComment = motionFixture({
      'dist/components/button/Button.mjs': buttonWith('').replace(
        'function ButtonRoot(props)',
        '/** Animated by a data-[presence=exiting]:opacity-50 class in 0.14. */\nfunction ButtonRoot(props)',
      ),
    });
    const probe = { keep: 'Button', drop: 'Dialog', dropSubstrings: ['[presence='] };
    expect(await probeTreeShaking(inString.dist, probe)).toEqual([
      'the bundle of an import of only Button contains "[presence=" outside comments (its minified code)',
    ]);
    expect(await probeTreeShaking(inComment.dist, probe)).toEqual([]);
  }, 30_000);
});

describe('probeIncludes: strings and substrings (the positive control of D23)', () => {
  const dialogMotion = {
    keep: 'Dialog',
    modules: ['lib/motion.mjs', 'hooks/useMotion.mjs'],
    strings: [MOTION_RECIPES.dialogMotion],
    substrings: ['[presence='],
  };

  it('passes when the bundle holds the modules, the literals and the fragments', async () => {
    expect(await probeIncludes(motionFixture().dist, dialogMotion)).toEqual([]);
  });

  it('reports a literal the bundle lacks, matched whole', async () => {
    // The Dialog reads no drawer duration, and a recipe's word is no literal of its own.
    expect(
      await probeIncludes(motionFixture().dist, {
        ...dialogMotion,
        strings: [MOTION_DURATIONS.large, 'data-[presence=exiting]:opacity-0'],
      }),
    ).toEqual([
      `the bundle of an import of only Dialog lacks the string "${MOTION_DURATIONS.large}"`,
      'the bundle of an import of only Dialog lacks the string "data-[presence=exiting]:opacity-0"',
    ]);
  });

  it('reports a fragment the code lacks', async () => {
    expect(
      await probeIncludes(motionFixture().dist, {
        ...dialogMotion,
        substrings: ['[presence=', '[presence=gone'],
      }),
    ).toEqual([
      'the bundle of an import of only Dialog lacks "[presence=gone" outside comments (its minified code)',
    ]);
    expect(
      await probeIncludes(motionFixture().dist, {
        keep: 'Button',
        modules: [],
        substrings: ['[presence='],
      }),
    ).toEqual([
      'the bundle of an import of only Button lacks "[presence=" outside comments (its minified code)',
    ]);
  }, 30_000);
});

describe('the 0.15 probes (INTEGRATION)', () => {
  /** The module that renders a control's `keep`, and its fixture without any of its motion. */
  const MOTIONLESS = {
    Dialog: (files) => {
      const path = 'dist/components/overlays/Dialog.mjs';
      const motionImports =
        "import { dialogBackdropMotion, dialogMotion } from '../../lib/motion.mjs';\n" +
        "import { useMotionClasses } from '../../hooks/useMotion.mjs';\n";
      expect(files[path]).toContain(motionImports);
      expect(files[path]).toContain(DIALOG_MOTION_CALLS);
      return { [path]: files[path].replace(motionImports, '').replace(DIALOG_MOTION_CALLS, '') };
    },
    Accordion: () => ({
      'dist/components/layout/Accordion.mjs': phase10Module('components/layout/Accordion', {
        imports: [['lib/cn', ['cn']]],
        body: "function Accordion(props) { return cn('accordion', props.className); }\n",
        exports: ['Accordion'],
      }),
    }),
    MessageBarGroup: () => ({
      'dist/components/feedback/MessageBarGroup.mjs': phase10Module(
        'components/feedback/MessageBarGroup',
        {
          imports: [['lib/cn', ['cn']]],
          body: "function MessageBarGroup(props) { return cn('message-bar-group', props.className); }\n",
          exports: ['MessageBarGroup'],
        },
      ),
    }),
  };

  it('lists the probes of the spec (§2.10)', () => {
    expect(EXCLUSION_PROBES_0_15).toEqual([
      {
        keep: 'MessageBar',
        drop: 'MessageBarGroup',
        dropModules: ['hooks/usePresence.mjs', 'hooks/usePresenceGroup.mjs'],
      },
    ]);
    expect(MOTION_INCLUDE_PROBES).toEqual([
      {
        keep: 'Dialog',
        modules: ['lib/motion.mjs', 'hooks/useMotion.mjs'],
        recipes: ['dialogMotion', 'dialogBackdropMotion'],
        substrings: ['[presence='],
      },
      {
        keep: 'Accordion',
        modules: ['lib/motion.mjs', 'hooks/useCollapsePresence.mjs'],
        recipes: ['collapseStructure', 'collapseMotion'],
      },
      {
        keep: 'MessageBarGroup',
        modules: ['hooks/usePresenceGroup.mjs', 'lib/motion.mjs'],
        recipes: [
          'messageBarGroupItemStructure',
          'messageBarGroupExitMotion',
          'messageBarGroupEnterMotion',
        ],
      },
    ]);
    for (const { keep } of MOTION_INCLUDE_PROBES) expect(MOTIONLESS[keep], keep).toBeDefined();
  });

  it('an import of only MessageBar drops the presence core and the group: passes on a correct dist, reports each one it imports', async () => {
    const [probe] = EXCLUSION_PROBES_0_15;
    expect(await probeTreeShaking(fixture().dist, probe)).toEqual([]);
    const path = 'components/feedback/MessageBar';
    const file = `dist/${path}.mjs`;
    const files = goodFiles();
    const { dist } = fixture({
      [file]: withCall(
        withCall(files[file], path, 'hooks/usePresence', 'usePresence'),
        path,
        'hooks/usePresenceGroup',
        'usePresenceGroup',
      ),
    });
    expect(await probeTreeShaking(dist, probe)).toEqual([
      'hooks/usePresence.mjs is in the bundle of an import of only MessageBar (MessageBarGroup must be dropped)',
      'hooks/usePresenceGroup.mjs is in the bundle of an import of only MessageBar (MessageBarGroup must be dropped)',
    ]);
  }, 30_000);

  it.each(MOTION_INCLUDE_PROBES.map((probe) => [probe.keep, probe]))(
    'an import of only %s holds its motion modules and recipe literals: passes on a correct dist, reports each one missing',
    async (keep, { recipes, ...probe }) => {
      const good = fixture().dist;
      const values = await motionRecipeValues(good, recipes);
      expect(values.errors).toEqual([]);
      expect(values.strings).toEqual(recipes.map((name) => MOTION_RECIPES[name]));
      expect(await probeIncludes(good, { ...probe, strings: values.strings })).toEqual([]);

      const { dist } = fixture(MOTIONLESS[keep](goodFiles()));
      expect(await probeIncludes(dist, { ...probe, strings: values.strings })).toEqual([
        ...probe.modules.map((path) => `${path} is not in the bundle of an import of only ${keep}`),
        ...values.strings.map(
          (text) => `the bundle of an import of only ${keep} lacks the string "${text}"`,
        ),
        ...(probe.substrings ?? []).map(
          (text) =>
            `the bundle of an import of only ${keep} lacks "${text}" outside comments (its minified code)`,
        ),
      ]);
    },
    30_000,
  );

  it('verifyDist runs the MessageBar probe', async () => {
    const path = 'components/feedback/MessageBar';
    const file = `dist/${path}.mjs`;
    const { dist } = fixture({
      [file]: withCall(goodFiles()[file], path, 'hooks/usePresenceGroup', 'usePresenceGroup'),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'hooks/usePresenceGroup.mjs is in the bundle of an import of only MessageBar (MessageBarGroup must be dropped)',
    ]);
  }, 90_000);

  it('verifyDist runs the Accordion and MessageBarGroup controls', async () => {
    const files = goodFiles();
    const hook = 'dist/hooks/useCollapsePresence.mjs';
    const collapseCall = 'useMotionClasses(options.motion, collapseMotion)';
    const group = 'dist/components/feedback/MessageBarGroup.mjs';
    const groupImport = "import { usePresenceGroup } from '../../hooks/usePresenceGroup.mjs';\n";
    const groupCall = 'const { entries } = usePresenceGroup(props.children);';
    expect(files[hook]).toContain(collapseCall);
    expect(files[group]).toContain(groupImport);
    expect(files[group]).toContain(groupCall);
    const { dist } = fixture({
      // The collapse no longer reads its motion; the group no longer reaches the presence group.
      [hook]: files[hook].replace(collapseCall, "useMotionClasses(options.motion, '')"),
      [group]: files[group]
        .replace(groupImport, '')
        .replace(groupCall, 'const entries = [].concat(props.children ?? []);'),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      `the bundle of an import of only Accordion lacks the string "${MOTION_RECIPES.collapseMotion}"`,
      'hooks/usePresenceGroup.mjs is not in the bundle of an import of only MessageBarGroup',
    ]);
  }, 90_000);
});

describe('the 0.16 probes (INTEGRATION)', () => {
  /** The fixture module of `path` (see PHASE11_MODULES) with `change` applied to its spec. */
  const changed = (path, change) => ({
    [`dist/${path}.mjs`]: phase11Module(path, change(PHASE11_MODULES[path])),
  });
  /** The fixture module of `path` that also imports `name` from `target` and calls it. */
  const calling = (path, target, name) =>
    changed(path, (spec) => ({
      ...spec,
      imports: [...spec.imports, [target, [name]]],
      body: spec.body.replace(/\{ /, `{ ${name}(options); `),
    }));

  it('lists the 0.16 modules: every one has its source, and the fixture holds each', () => {
    expect(DATA_SCALE_MODULES).toEqual([...new Set(DATA_SCALE_MODULES)].sort());
    for (const path of DATA_SCALE_MODULES) {
      const source = join(repoRoot, 'src', path.replace(/\.mjs$/, ''));
      expect(
        existsSync(`${source}.ts`) || existsSync(`${source}.tsx`),
        `src/${path} has no source`,
      ).toBe(true);
    }
    const files = goodFiles();
    expect(DATA_SCALE_MODULES.filter((path) => !(`dist/${path}` in files))).toEqual([]);
  });

  it('lists the probes, the budget and the recorded imports of the spec (§11)', () => {
    expect(HOOK_PROBES_0_16.map(({ keep, dropPrefixes }) => [keep, dropPrefixes])).toEqual([
      ['useVirtualWindow', ['components/']],
      ['useSelection', ['components/']],
    ]);
    expect(HOOK_PROBES_0_16.map(({ modules }) => modules)).toEqual([
      ['hooks/useVirtualWindow.mjs', 'lib/virtual.mjs'],
      ['hooks/useSelection.mjs', 'lib/selection.mjs'],
    ]);
    expect(EXCLUSION_PROBES_0_16.map(({ keep, drop }) => `${keep} without ${drop}`)).toEqual([
      'DataGrid without FlatTree',
      'FlatTree without DataGrid',
      'Button without DataGrid',
      'MessageBar without DataGrid',
      'Tree without FlatTree',
    ]);
    const [dataGrid, flatTree, buttonOnly, messageBarOnly, treeOnly] = EXCLUSION_PROBES_0_16;
    expect(dataGrid.dropModules).toEqual(
      expect.arrayContaining(['components/layout/FlatTree.item.mjs', 'lib/flatTree.mjs']),
    );
    expect(flatTree.dropModules).toEqual(
      expect.arrayContaining(['components/table/DataGrid.store.mjs', 'lib/selection.mjs']),
    );
    expect(buttonOnly.dropModules).toEqual(DATA_SCALE_MODULES);
    expect(messageBarOnly.dropModules).toEqual(DATA_SCALE_MODULES);
    // R20: a Tree reaches the cascade it moved to, and no other module of 0.16.
    expect(treeOnly.dropModules).toEqual(
      DATA_SCALE_MODULES.filter((path) => path !== 'lib/treeCascade.mjs'),
    );
    expect(INCLUSION_PROBES_0_16.map(({ keep }) => keep)).toEqual(['DataGrid', 'FlatTree', 'Tree']);
    expect(INCLUSION_PROBES_0_16[2].modules).toEqual(['lib/treeCascade.mjs']);

    // Measured in 0.16.0 (3,532 and 1,695 bytes), plus 25 %; gzip at the ceiling of 2 KiB.
    expect(VIRTUAL_BUDGET).toEqual({
      names: ['useVirtualWindow'],
      maxMinifiedBytes: 4415,
      maxGzipBytes: 2048,
      allowedExternals: ['react'],
    });
    // Measured in 0.16.0 (69,592 and 23,545 bytes), plus 25 % (86,990 and 29,431), until 0.18
    // re-set it from the size measured at the end of Phase 13 (73,310 and 24,921) plus 512 and 192
    // (spec R23; RECORDED_IMPORTS_0_18 holds it).
    expect(DATA_GRID_BUDGET).toEqual({
      names: ['DataGrid'],
      maxMinifiedBytes: 73822,
      maxGzipBytes: 25113,
      allowedExternals: ['clsx', 'react', 'react-dom', 'react/jsx-runtime', 'tailwind-merge'],
    });
    // Printed against 0.15.0 for drift; the budgets live in the newest record.
    expect(RECORDED_IMPORTS).toEqual([
      { names: ['DataGrid'], baseline: { version: '0.15.0', minified: 48403, gzip: 16520 } },
      { names: ['Tree'], baseline: { version: '0.15.0', minified: 47248, gzip: 16201 } },
      { names: ['Button'], baseline: { version: '0.15.0', minified: 11195, gzip: 3855 } },
      { names: ['MessageBar'], baseline: { version: '0.15.0', minified: 26831, gzip: 9312 } },
    ]);
  });

  it('the hook probes pass on a correct dist and report a component or the JSX runtime in the bundle', async () => {
    for (const probe of HOOK_PROBES_0_16) {
      expect(await probeHook(fixture().dist, probe), probe.keep).toEqual([]);
    }
    const [windowProbe, selectionProbe] = HOOK_PROBES_0_16;
    // A module under components/ that no list names is reported by its directory.
    const withButton = fixture(
      calling('hooks/useVirtualWindow', 'components/button/Button', 'Button'),
    );
    expect(await probeHook(withButton.dist, windowProbe)).toEqual([
      'components/button/Button.mjs is in the bundle of an import of only useVirtualWindow (no module under components/ may be)',
    ]);
    const windowFile = 'dist/hooks/useVirtualWindow.mjs';
    const withJsx = fixture({
      [windowFile]: goodFiles()
        [windowFile].replace(DIRECTIVE, `${DIRECTIVE}import { jsx } from 'react/jsx-runtime';\n`)
        .replace('{ const [first]', "{ jsx('div', {}); const [first]"),
    });
    expect(await probeHook(withJsx.dist, windowProbe)).toEqual([
      'the bundle of an import of only useVirtualWindow imports react/jsx-runtime',
    ]);
    // A listed module is reported once, by name.
    const withStore = fixture(
      calling('hooks/useSelection', 'components/table/DataGrid.store', 'createSelectionStore'),
    );
    expect(await probeHook(withStore.dist, selectionProbe)).toEqual([
      'components/table/DataGrid.store.mjs is in the bundle of an import of only useSelection',
    ]);
  }, 30_000);

  it('probeHook reports a prefix that no module of dist is under (the probe would pass vacuously)', async () => {
    expect(
      await probeHook(fixture().dist, {
        keep: 'useVirtualWindow',
        modules: ['hooks/useVirtualWindow.mjs'],
        dropPrefixes: ['widgets/'],
      }),
    ).toEqual([
      'no module of dist is under widgets/, listed for the hook useVirtualWindow (the probe would pass vacuously)',
    ]);
  });

  /** For each exclusion probe: the call that leaks code into its bundle, and what it reports. */
  const LEAKS = {
    DataGrid: {
      leak: calling('components/table/DataGrid', 'components/layout/FlatTree.item', 'FlatTreeItem'),
      reports: [
        'components/layout/FlatTree.context.mjs is in the bundle of an import of only DataGrid (FlatTree must be dropped)',
        'components/layout/FlatTree.item.mjs is in the bundle of an import of only DataGrid (FlatTree must be dropped)',
      ],
    },
    FlatTree: {
      leak: calling(
        'components/layout/FlatTree',
        'components/table/DataGrid.store',
        'createSelectionStore',
      ),
      reports: [
        'components/table/DataGrid.store.mjs is in the bundle of an import of only FlatTree (DataGrid must be dropped)',
        'lib/selection.mjs is in the bundle of an import of only FlatTree (DataGrid must be dropped)',
      ],
    },
    Button: {
      leak: {
        'dist/components/button/Button.mjs': withCall(
          goodFiles()['dist/components/button/Button.mjs'],
          'components/button/Button',
          'hooks/useVirtualWindow',
          'useVirtualWindow',
        ),
      },
      reports: [
        'hooks/useVirtualWindow.mjs is in the bundle of an import of only Button (DataGrid must be dropped)',
        'lib/virtual.mjs is in the bundle of an import of only Button (DataGrid must be dropped)',
      ],
    },
    MessageBar: {
      leak: {
        'dist/components/feedback/MessageBar.mjs': withCall(
          goodFiles()['dist/components/feedback/MessageBar.mjs'],
          'components/feedback/MessageBar',
          'hooks/useSelection',
          'useSelection',
        ),
      },
      reports: [
        'hooks/useSelection.mjs is in the bundle of an import of only MessageBar (DataGrid must be dropped)',
        'lib/selection.mjs is in the bundle of an import of only MessageBar (DataGrid must be dropped)',
      ],
    },
    Tree: {
      leak: calling('components/layout/Tree', 'lib/flatTree', 'buildFlatTreeIndex'),
      reports: [
        'lib/flatTree.mjs is in the bundle of an import of only Tree (FlatTree must be dropped)',
      ],
    },
  };

  it.each(EXCLUSION_PROBES_0_16.map((probe) => [probe.keep, probe.drop, probe]))(
    'an import of only %s drops %s: passes on a correct dist, reports each module it leaks',
    async (keep, _drop, probe) => {
      expect(await probeTreeShaking(fixture().dist, probe)).toEqual([]);
      expect(LEAKS[keep], keep).toBeDefined();
      const { dist } = fixture(LEAKS[keep].leak);
      expect(await probeTreeShaking(dist, probe)).toEqual(LEAKS[keep].reports);
    },
    30_000,
  );

  /** For each inclusion probe: the fixture module without the code the probe looks for. */
  const WITHOUT = {
    DataGrid: () =>
      changed('components/table/DataGrid', (spec) => ({
        ...spec,
        imports: [['react', ['createElement']]],
        body: "function DataGrid() { return createElement('table'); }\nDataGrid.displayName = 'DataGrid';\n",
      })),
    FlatTree: () =>
      changed('components/layout/FlatTree', (spec) => ({
        ...spec,
        imports: [['react', ['createElement']]],
        body:
          "function FlatTreeRoot() { return createElement('div', { role: 'tree' }); }\n" +
          "FlatTreeRoot.displayName = 'FlatTree';\n" +
          'function FlatTreeItem() { return null; }\n' +
          "FlatTreeItem.displayName = 'FlatTreeItem';\n" +
          'const FlatTree = /* @__PURE__ */ Object.assign(FlatTreeRoot, { Item: FlatTreeItem });\n',
      })),
    Tree: () =>
      changed('components/layout/Tree.selection', (spec) => ({
        ...spec,
        imports: [],
        body: 'function collectItems(nodes) { return nodes; }\n',
      })),
  };

  it.each(INCLUSION_PROBES_0_16.map((probe) => [probe.keep, probe]))(
    'an import of only %s holds its modules: passes on a correct dist, reports each one missing',
    async (keep, probe) => {
      expect(await probeIncludes(fixture().dist, probe)).toEqual([]);
      const { dist } = fixture(WITHOUT[keep]());
      expect(await probeIncludes(dist, probe)).toEqual(
        probe.modules.map((path) => `${path} is not in the bundle of an import of only ${keep}`),
      );
    },
    30_000,
  );

  it('measureImport measures the minified closure of an import, as the size budget does', async () => {
    const { dist } = fixture();
    const measured = await measureImport(dist, ['useVirtualWindow']);
    expect(measured.externals).toEqual(['react']);
    expect(measured.minified).toBeGreaterThan(0);
    expect(measured.gzip).toBeGreaterThan(0);
    const budget = await probeSizeBudget(dist, VIRTUAL_BUDGET);
    expect(budget).toEqual({ ...measured, errors: [] });
  });

  it('verifyDist runs the exclusion, hook and inclusion probes of 0.16', async () => {
    const { dist } = fixture({
      ...LEAKS.Tree.leak,
      ...calling('hooks/useSelection', 'components/table/DataGrid.store', 'createSelectionStore'),
      ...WITHOUT.FlatTree(),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      ...LEAKS.Tree.reports,
      'components/table/DataGrid.store.mjs is in the bundle of an import of only useSelection',
      ...INCLUSION_PROBES_0_16[1].modules.map(
        (path) => `${path} is not in the bundle of an import of only FlatTree`,
      ),
    ]);
  }, 90_000);

  it('verifyDist reports a window over its budget, and an import outside react', async () => {
    const big = changed('lib/virtual', (spec) => ({
      ...spec,
      body: `const TABLE = ${JSON.stringify(noise(8000))};\n${spec.body.replace('[{', '[TABLE, {')}`,
    }));
    const result = await verifyDist(fixture(big).dist, noPending);
    expect(result.virtualBudget.minified).toBeGreaterThan(VIRTUAL_BUDGET.maxMinifiedBytes);
    expect(result.virtualBudget.gzip).toBeGreaterThan(VIRTUAL_BUDGET.maxGzipBytes);
    expect(result.errors).toEqual([
      `useVirtualWindow: ${result.virtualBudget.minified} bytes minified, over the budget of 4415`,
      `useVirtualWindow: ${result.virtualBudget.gzip} bytes gzip, over the budget of 2048`,
    ]);

    const withClsx = changed('lib/virtual', (spec) => ({
      ...spec,
      imports: [['clsx', ['clsx']]],
      body: spec.body.replace("kind: 'item'", "kind: clsx('item')"),
    }));
    expect((await verifyDist(fixture(withClsx).dist, noPending)).errors).toEqual([
      'useVirtualWindow imports clsx, outside the measured closure (allowed: react)',
    ]);
  }, 180_000);

  it('verifyDist gates the DataGrid-only import: passes on a correct dist, reports a grid over its budget and an import outside the dependencies', async () => {
    const good = await probeSizeBudget(fixture().dist, DATA_GRID_BUDGET);
    expect(good.errors).toEqual([]);
    expect(good.minified).toBeLessThanOrEqual(DATA_GRID_BUDGET.maxMinifiedBytes);

    // 120,000 characters of random base64, which gzip cannot shrink below 6 bits each (`noise`
    // repeats too soon at this length): over both budgets.
    const table = randomBytes(90_000).toString('base64');
    const big = changed('components/table/DataGrid', (spec) => ({
      ...spec,
      body: `const TABLE = ${JSON.stringify(table)};\n${spec.body.replace("createElement('table', null", "createElement('table', { title: TABLE }")}`,
    }));
    const result = await verifyDist(fixture(big).dist, noPending);
    const [dataGrid] = result.recorded;
    expect(dataGrid.minified).toBeGreaterThan(DATA_GRID_BUDGET.maxMinifiedBytes);
    expect(dataGrid.gzip).toBeGreaterThan(DATA_GRID_BUDGET.maxGzipBytes);
    // Reported once, by the 0.18 record that holds the budget.
    expect(result.errors).toEqual([
      `DataGrid: ${dataGrid.minified} bytes minified, over the budget of 73822`,
      `DataGrid: ${dataGrid.gzip} bytes gzip, over the budget of 25113`,
    ]);

    const withLibrary = changed('components/table/DataGrid.window', (spec) => ({
      ...spec,
      imports: [...spec.imports, ['virtual-rows', ['rows']]],
      body: spec.body.replace(
        'window: options.virtualWindow',
        'window: rows(options.virtualWindow)',
      ),
    }));
    expect(await probeSizeBudget(fixture(withLibrary).dist, DATA_GRID_BUDGET)).toEqual({
      minified: expect.any(Number),
      gzip: expect.any(Number),
      externals: ['react', 'virtual-rows'],
      errors: [
        'DataGrid imports virtual-rows, outside the measured closure (allowed: clsx, react, react-dom, react/jsx-runtime, tailwind-merge)',
      ],
    });
  }, 90_000);

  it('verifyDist measures the recorded imports, and main prints them with the window and DataGrid budgets', async () => {
    const { dist } = fixture();
    const measured = [];
    const { errors, virtualBudget, recorded } = await verifyDist(dist, {
      ...noPending,
      measure: (root, names) => {
        measured.push(names.join(' + '));
        return measureImport(root, names);
      },
    });
    expect(errors).toEqual([]);
    expect(virtualBudget).toEqual({ minified: expect.any(Number), gzip: expect.any(Number) });
    // 0.17 appends its own records (RECORDED_IMPORTS_0_17, against 0.16.0), and 0.18 its own
    // (RECORDED_IMPORTS_0_18, against 0.17.1).
    expect(recorded).toEqual(
      [...RECORDED_IMPORTS, ...RECORDED_IMPORTS_0_17, ...RECORDED_IMPORTS_0_18].map((entry) => ({
        ...entry,
        minified: expect.any(Number),
        gzip: expect.any(Number),
      })),
    );
    // An import recorded in several lists is measured once: one measurement per label.
    const labels = recorded.map(({ names }) => names.join(' + '));
    expect([...measured].sort()).toEqual([...new Set(labels)].sort());
    for (const label of ['DataGrid', 'Tree', 'Button', 'MessageBar']) {
      expect(labels.filter((each) => each === label).length, label).toBeGreaterThan(1);
      expect(
        measured.filter((each) => each === label),
        label,
      ).toEqual([label]);
    }
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', dist, '--no-pending'], io)).toBe(0);
    const output = lines.join('\n');
    expect(output).toMatch(
      /verify-dist: window \(useVirtualWindow\): \d+ B minified \(budget 4415\), \d+ B gzip \(budget 2048\)/,
    );
    expect(output).toMatch(
      /verify-dist: DataGrid-only import: \d+ B minified \(budget 73822\), \d+ B gzip \(budget 25113\) \(0\.17\.1: 70097 B, 23719 B; [+-]\d+\.\d{2} %, [+-]\d+\.\d{2} %\)/,
    );
    for (const [name, minified, gzip] of [
      ['DataGrid', 48403, 16520],
      ['Tree', 47248, 16201],
      ['Button', 11195, 3855],
      ['MessageBar', 26831, 9312],
    ]) {
      expect(output).toMatch(
        new RegExp(
          `verify-dist: ${name}-only import: \\d+ B minified, \\d+ B gzip \\(0\\.15\\.0: ${minified} B, ${gzip} B; [+-]\\d+\\.\\d{2} %, [+-]\\d+\\.\\d{2} %\\)`,
        ),
      );
    }
  }, 180_000);

  it('the real exports carry the 0.16 flat names', async () => {
    const mod = await import('../../src/index.ts');
    expect(mod.FlatTreeItem).toBe(mod.FlatTree.Item);
    expect(mod.TableResizeHandle).toBe(mod.Table.ResizeHandle);
    for (const name of ['useVirtualWindow', 'useSelection', 'useFlatTree', 'useTableFeatures']) {
      expect(mod[name], name).toBeTypeOf('function');
    }
  }, 60_000);

  it('lists every module-only export of the 0.16 modules, read with the compiler against the entry', () => {
    // The modules 0.16 adds, and those whose exports it changed. Every export the entry does not
    // export must be listed, so a new seam is checked before it ships.
    const sources = [
      ...DATA_SCALE_MODULES.map((path) => {
        const base = join(repoRoot, 'src', path.replace(/\.mjs$/, ''));
        return existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`;
      }),
      join(repoRoot, 'src/hooks/useRovingTabIndex.ts'),
      join(repoRoot, 'src/hooks/useListbox.ts'),
      join(repoRoot, 'src/components/table/useGridNavigation.ts'),
    ];
    const entry = join(repoRoot, 'src/index.ts');
    const config = ts.readConfigFile(join(repoRoot, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repoRoot);
    const program = ts.createProgram({
      rootNames: [entry, ...sources],
      options: { ...parsed.options, noEmit: true },
    });
    const checker = program.getTypeChecker();
    const exportsOf = (file) => {
      const source = program.getSourceFile(file);
      expect(source, file).toBeDefined();
      return checker.getExportsOfModule(checker.getSymbolAtLocation(source)).map((s) => s.name);
    };
    const entryNames = new Set(exportsOf(entry));
    const moduleOnly = sources.flatMap((file) =>
      exportsOf(file).filter((name) => !entryNames.has(name)),
    );
    expect(moduleOnly.filter((name) => !MODULE_ONLY_NAMES.includes(name))).toEqual([]);
    // The seams the reviews named, and the public names that stay out of the list.
    expect(moduleOnly).toEqual(
      expect.arrayContaining([
        'computeVirtualLayout',
        'resolveColumnWidths',
        'createTableFeaturePlugin',
        'TableFeaturePluginImplementation',
        'sortTableRows',
        'returnFocusToGridCell',
        'createSelectionStore',
        'buildFlatTreeIndex',
        'visibleFlatItems',
        'flatTreeForest',
        'FlatTreeContext',
        'useFlatTreeContext',
        'renderListboxWindow',
        'useShownListScroll',
        'useDataModeWarnings',
        'renderListboxItem',
        'ListboxOptionPositionContext',
        'ownsArrowKeys',
      ]),
    );
    for (const name of ['useVirtualWindow', 'VirtualEntry', 'FlatTreeItem', 'TableRowData']) {
      expect(MODULE_ONLY_NAMES, name).not.toContain(name);
    }
  }, 60_000);
});

describe('the 0.17 probes (INTEGRATION)', () => {
  /** The fixture module of `path` (see PHASE12_MODULES, else PHASE11_MODULES) with `change` applied. */
  const changed = (path, change) => ({
    [`dist/${path}.mjs`]: phase12Module(
      path,
      change(PHASE12_MODULES[path] ?? PHASE11_MODULES[path]),
    ),
  });
  /** The fixture module of `path` that also imports `name` from `target` and calls it. */
  const calling = (path, target, name) =>
    changed(path, (spec) => ({
      ...spec,
      imports: [...spec.imports, [target, [name]]],
      body: spec.body.replace(/\) \{ /, `) { ${name}(); `),
    }));
  /** The fixture component `path` (a module of goodFiles) that also imports `name` and calls it. */
  const componentCalling = (path, target, name) => ({
    [`dist/${path}.mjs`]: withCall(goodFiles()[`dist/${path}.mjs`], path, target, name),
  });

  it('lists the probes, the budgets and the recorded imports of the spec (§10)', () => {
    const react = ['react', 'react-dom', 'react/jsx-runtime'];
    expect(HOOK_PROBES_0_17).toEqual([
      {
        keep: 'createBrandTokens',
        modules: ['lib/brand.mjs'],
        dropModules: ['lib/waveTokens.mjs'],
        dropPrefixes: ['components/'],
        dropExternals: react,
        dropSubstrings: ['createBrandTokens:contrast'],
      },
      {
        keep: 'waveTokens',
        modules: ['lib/waveTokens.mjs', 'lib/tokens.mjs'],
        dropModules: ['lib/brand.mjs'],
        dropPrefixes: ['components/'],
        dropExternals: react,
      },
      { keep: 'WaveProvider', dropSubstrings: ['WaveProvider:tokens:'] },
    ]);
    expect(TOKEN_MODULES).toEqual(['lib/brand.mjs', 'lib/tokens.mjs', 'lib/waveTokens.mjs']);
    expect(EXCLUSION_PROBES_0_17).toEqual([
      {
        keep: 'Dialog',
        drop: null,
        dropModules: ['lib/brand.mjs', 'lib/waveTokens.mjs'],
        dropSubstrings: ['paletteSteelTintForeground', 'createBrandTokens:'],
      },
      { keep: 'Tree', drop: null, dropModules: ['lib/brand.mjs', 'lib/waveTokens.mjs'] },
      { keep: 'Button', drop: 'WaveProvider', dropModules: TOKEN_MODULES },
      { keep: 'MessageBar', drop: 'WaveProvider', dropModules: TOKEN_MODULES },
    ]);
    expect(INCLUSION_PROBES_0_17).toEqual([
      {
        keep: 'waveTokens',
        modules: ['lib/waveTokens.mjs'],
        substrings: ['paletteSteelTintForeground'],
      },
      { keep: 'createBrandTokens', modules: ['lib/brand.mjs'], substrings: ['createBrandTokens:'] },
      {
        keep: 'WaveProvider',
        modules: ['components/provider/WaveProvider.mjs', 'lib/tokens.mjs'],
      },
      { keep: 'Tree', modules: ['components/provider/WaveProvider.mjs'] },
    ]);
    expect(DEV_ONLY_LIBRARIES).toEqual(['recharts', 'chart.js', 'kurkle']);

    // Spec §10: 3 KiB gzip; minified, the size first measured for 0.17.0 (3,596 and 3,071 bytes)
    // plus 25 %.
    expect(BRAND_TOKENS_BUDGET).toEqual({
      names: ['createBrandTokens'],
      maxMinifiedBytes: 4495,
      maxGzipBytes: 3072,
      allowedExternals: [],
    });
    expect(WAVE_TOKENS_BUDGET).toEqual({
      names: ['waveTokens'],
      maxMinifiedBytes: 3839,
      maxGzipBytes: 3072,
      allowedExternals: [],
    });
    // The published 0.16.0 package, measured with this release's tools (the printed comparison).
    // The five component imports are printed for drift only: 0.18 budgets them against 0.17.1
    // (RECORDED_IMPORTS_0_18).
    const records = [
      [['Button'], { minified: 11195, gzip: 3855 }],
      [['MessageBar'], { minified: 26831, gzip: 9312 }],
      [['Tree'], { minified: 47248, gzip: 16196 }],
      [['Dialog'], { minified: 70721, gzip: 23723 }],
      [['WaveProvider', 'Dialog'], { minified: 71884, gzip: 24127 }],
    ];
    expect(RECORDED_IMPORTS_0_17).toEqual([
      { names: ['createBrandTokens'], baseline: null, budget: BRAND_TOKENS_BUDGET },
      { names: ['waveTokens'], baseline: null, budget: WAVE_TOKENS_BUDGET },
      ...records.map(([names, baseline]) => ({
        names,
        baseline: { version: '0.16.0', ...baseline },
      })),
    ]);
    // The 0.17 allowances (Dialog +0.4 KiB, WaveProvider with Dialog +0.7 KiB), rounded down: a
    // budget never above the spec's figure.
    expect(Math.floor(0.4 * 1024)).toBe(409);
    expect(Math.floor(0.7 * 1024)).toBe(716);
    // The 0.16.0 figures of Button, MessageBar and Tree are those of the 0.16.0 CHANGELOG.
    const changelog = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8');
    const section = changelog.slice(changelog.indexOf('## [0.16.0]'));
    for (const [name, minified, gzip] of [
      ['Tree', '47,248', '16,196'],
      ['Button', '11,195', '3,855'],
      ['MessageBar', '26,831', '9,312'],
    ]) {
      expect(section, name).toMatch(
        new RegExp(
          `An import of only \`${name}\` \\| [^|]+ \\| ${minified} \\(${gzip} gzip\\) \\|`,
        ),
      );
    }
  });

  it('the hook probes pass on a correct dist built for production, whatever NODE_ENV this process has', async () => {
    // Vitest runs with NODE_ENV=test, from which Vite would define process.env.NODE_ENV: the probes
    // define it as production, so the development contrast check of a full ramp is dropped.
    expect(process.env.NODE_ENV).not.toBe('production');
    for (const probe of HOOK_PROBES_0_17) {
      expect(await probeHook(fixture().dist, probe), probe.keep).toEqual([]);
    }
  }, 30_000);

  it('the createBrandTokens probe reports React, a component, the names tuple and the contrast check in the bundle', async () => {
    const [brandProbe, tokensProbe] = HOOK_PROBES_0_17;
    const withReact = fixture(
      changed('lib/brand', (spec) => ({
        ...spec,
        imports: [...spec.imports, ['react', ['useState']]],
        body: spec.body.replace(
          'function toTokens(ramp) { ',
          'function toTokens(ramp) { useState(0); ',
        ),
      })),
    );
    expect(await probeHook(withReact.dist, brandProbe)).toEqual([
      'the bundle of an import of only createBrandTokens imports react',
    ]);
    const withButton = fixture(calling('lib/brand', 'components/button/Button', 'Button'));
    expect(await probeHook(withButton.dist, brandProbe)).toEqual([
      'components/button/Button.mjs is in the bundle of an import of only createBrandTokens (no module under components/ may be)',
    ]);
    const withTuple = fixture(calling('lib/brand', 'lib/waveTokens', 'chartPalette'));
    expect(await probeHook(withTuple.dist, brandProbe)).toEqual([
      'lib/waveTokens.mjs is in the bundle of an import of only createBrandTokens',
    ]);
    // A check without the mode test stays in a production bundle.
    const unguarded = fixture(
      changed('lib/brand', (spec) => ({
        ...spec,
        body: spec.body.replace(
          "try { if (process.env.NODE_ENV !== 'production') checkBrandRamp(seed); } catch {}",
          'checkBrandRamp(seed);',
        ),
      })),
    );
    expect(await probeHook(unguarded.dist, brandProbe)).toEqual([
      'the bundle of an import of only createBrandTokens contains "createBrandTokens:contrast" outside comments (its minified code)',
    ]);
    // A fragment that no module of dist holds would let the probe pass vacuously.
    const renamed = fixture(
      changed('lib/brand', (spec) => ({
        ...spec,
        body: spec.body.replace("'createBrandTokens:contrast:light:primary:'", "'contrast:'"),
      })),
    );
    expect(await probeHook(renamed.dist, brandProbe)).toEqual([
      '"createBrandTokens:contrast", listed for the hook createBrandTokens, occurs in no module of dist (the probe would pass vacuously)',
    ]);
    const tokensWithButton = fixture(
      changed('lib/waveTokens', (spec) => ({
        ...spec,
        imports: [...spec.imports, ['components/button/Button', ['Button']]],
        body: spec.body.replace(
          'Object.fromEntries(WAVE_TOKEN_NAMES',
          'Object.fromEntries([...WAVE_TOKEN_NAMES, Button()]',
        ),
      })),
    );
    expect(await probeHook(tokensWithButton.dist, tokensProbe)).toEqual([
      'components/button/Button.mjs is in the bundle of an import of only waveTokens (no module under components/ may be)',
    ]);
  }, 60_000);

  it("the WaveProvider probe reports the provider's tokens warnings in a production bundle", async () => {
    const providerProbe = HOOK_PROBES_0_17.find((probe) => probe.keep === 'WaveProvider');
    expect(await probeHook(fixture().dist, providerProbe)).toEqual([]);
    // Warnings without the mode test stay in a production bundle.
    const unguarded = fixture(
      changed('components/provider/WaveProvider', (spec) => ({
        ...spec,
        body: spec.body.replace(
          "try { if (process.env.NODE_ENV !== 'production') for (const key of Object.keys(tokens)) console.warn('WaveProvider:tokens:value:' + key); } catch {}",
          "for (const key of Object.keys(tokens)) console.warn('WaveProvider:tokens:value:' + key);",
        ),
      })),
    );
    expect(await probeHook(unguarded.dist, providerProbe)).toEqual([
      'the bundle of an import of only WaveProvider contains "WaveProvider:tokens:" outside comments (its minified code)',
    ]);
    // A fragment that no module of dist holds would let the probe pass vacuously.
    const renamed = fixture(
      changed('components/provider/WaveProvider', (spec) => ({
        ...spec,
        body: spec.body.replace("'WaveProvider:tokens:value:'", "'tokens:value:'"),
      })),
    );
    expect(await probeHook(renamed.dist, providerProbe)).toEqual([
      '"WaveProvider:tokens:", listed for the hook WaveProvider, occurs in no module of dist (the probe would pass vacuously)',
    ]);
  }, 60_000);

  /** For each exclusion probe: the call that leaks code into its bundle, and what it reports. */
  const LEAKS = {
    Dialog: {
      leak: () => componentCalling('components/overlays/Dialog', 'lib/waveTokens', 'chartPalette'),
      reports: [
        'lib/waveTokens.mjs is in the bundle of an import of only Dialog (it must be dropped)',
        'the bundle of an import of only Dialog contains "paletteSteelTintForeground" outside comments (its minified code)',
      ],
    },
    Tree: {
      leak: () => calling('components/layout/Tree', 'lib/brand', 'createBrandTokens'),
      reports: ['lib/brand.mjs is in the bundle of an import of only Tree (it must be dropped)'],
    },
    Button: {
      leak: () => componentCalling('components/button/Button', 'lib/tokens', 'getTokenStyle'),
      reports: [
        'lib/tokens.mjs is in the bundle of an import of only Button (WaveProvider must be dropped)',
      ],
    },
    MessageBar: {
      leak: () =>
        componentCalling(
          'components/feedback/MessageBar',
          'components/provider/WaveProvider',
          'useWaveTheme',
        ),
      reports: [
        'components/provider/WaveProvider.mjs is in the bundle of an import of only MessageBar (WaveProvider must be dropped)',
        'lib/tokens.mjs is in the bundle of an import of only MessageBar (WaveProvider must be dropped)',
        'WaveProvider code (displayName "WaveProvider") is in the bundle of an import of only MessageBar',
      ],
    },
  };

  it.each(EXCLUSION_PROBES_0_17.map((probe) => [probe.keep, probe]))(
    'an import of only %s holds no token code it does not use: passes on a correct dist, reports each leak',
    async (keep, probe) => {
      expect(await probeTreeShaking(fixture().dist, probe)).toEqual([]);
      expect(LEAKS[keep], keep).toBeDefined();
      const { dist } = fixture(LEAKS[keep].leak());
      expect(await probeTreeShaking(dist, probe)).toEqual(LEAKS[keep].reports);
    },
    30_000,
  );

  it('a probe with drop: null drops no component by name', async () => {
    // The Dialog holds the provider's module (for its context): no component or displayName is
    // checked, only the listed modules and fragments.
    const { dist } = fixture(
      componentCalling(
        'components/overlays/Dialog',
        'components/provider/WaveProvider',
        'useWaveTheme',
      ),
    );
    expect(await probeTreeShaking(dist, { keep: 'Dialog', drop: null })).toEqual([]);
    expect(
      await probeTreeShaking(dist, { keep: 'Dialog', drop: null, dropModules: ['lib/tokens.mjs'] }),
    ).toEqual(['lib/tokens.mjs is in the bundle of an import of only Dialog (it must be dropped)']);
  }, 30_000);

  /** For each inclusion probe: the fixture without the code the probe looks for, and the report. */
  const WITHOUT = {
    waveTokens: {
      files: () =>
        changed('lib/waveTokens', (spec) => ({
          ...spec,
          body: spec.body.replace('.paletteSteelTintForeground', ''),
        })),
      reports: [
        'the bundle of an import of only waveTokens lacks "paletteSteelTintForeground" outside comments (its minified code)',
      ],
    },
    createBrandTokens: {
      files: () =>
        changed('lib/brand', (spec) => ({
          ...spec,
          body: spec.body.replaceAll("'createBrandTokens:", "'brand:"),
        })),
      reports: [
        'the bundle of an import of only createBrandTokens lacks "createBrandTokens:" outside comments (its minified code)',
      ],
    },
    WaveProvider: {
      files: () =>
        changed('components/provider/WaveProvider', (spec) => ({
          ...spec,
          imports: spec.imports.filter(([module]) => module !== 'lib/tokens'),
          body: spec.body
            .replace('mergeTokenOverrides(parent.tokens, props.tokens)', 'props.tokens')
            .replace('style: getTokenStyle(tokens)', 'style: tokens'),
        })),
      reports: ['lib/tokens.mjs is not in the bundle of an import of only WaveProvider'],
    },
    Tree: {
      files: () =>
        changed('components/layout/Tree', (spec) => ({
          ...spec,
          imports: spec.imports.filter(([module]) => module !== 'components/provider/WaveProvider'),
          body: spec.body.replace(', dir: useWaveTheme().dir', ''),
        })),
      reports: [
        'components/provider/WaveProvider.mjs is not in the bundle of an import of only Tree',
      ],
    },
  };

  it.each(INCLUSION_PROBES_0_17.map((probe) => [probe.keep, probe]))(
    'an import of only %s holds the code its exclusion looks for: passes on a correct dist, reports it missing',
    async (keep, probe) => {
      expect(await probeIncludes(fixture().dist, probe)).toEqual([]);
      expect(WITHOUT[keep], keep).toBeDefined();
      const { dist } = fixture(WITHOUT[keep].files());
      expect(await probeIncludes(dist, probe)).toEqual(WITHOUT[keep].reports);
    },
    30_000,
  );

  it('checkDevOnlyLibraries passes a correct dist and reports a chart library in code, styles or types, not in prose', () => {
    expect(checkDevOnlyLibraries(fixture().dist)).toEqual([]);
    const { dist } = fixture({
      'dist/components/data-display/Chart.mjs':
        `${DIRECTIVE}import { BarChart } from 'recharts';\n` +
        '/** Works with Recharts and Chart.js, as the guide shows. */\nexport { BarChart };\n',
      'dist/lib/chartColors.mjs':
        '//#region node_modules/@kurkle/color/dist/color.esm.js\nexport const a = 1;\n',
      'dist/styles.css': '.wave-chart { content: "chart.js"; }\n',
      'dist/index.d.ts': `${DTS}import type { ChartData } from 'chart.js';\n`,
    });
    expect(checkDevOnlyLibraries(dist)).toEqual([
      'components/data-display/Chart.mjs holds "recharts" (a library of the stories only, R14: it must not reach dist)',
      'index.d.ts holds "chart.js" (a library of the stories only, R14: it must not reach dist)',
      'lib/chartColors.mjs holds "kurkle" (a library of the stories only, R14: it must not reach dist)',
      'styles.css holds "chart.js" (a library of the stories only, R14: it must not reach dist)',
    ]);
  });

  it('checkServerImport reads the token helpers from lib and from the entry on the server', async () => {
    expect(await checkServerImport(fixture().dist)).toEqual([]);
    const missing = await checkServerImport(
      fixture({ 'dist/lib/brand.mjs': null, 'dist/lib/waveTokens.mjs': null }).dist,
    );
    expect(missing).toEqual(['lib/brand.mjs is missing', 'lib/waveTokens.mjs is missing']);
  }, 60_000);

  it('checkServerImport reports a token style, a token object or a brand ramp that is wrong on the server', async () => {
    const { dist } = fixture({
      ...changed('lib/tokens', (spec) => ({
        ...spec,
        body: spec.body.replace(".replace(/([A-Za-z])(\\d)/g, '$1-$2')", ''),
      })),
      ...changed('lib/brand', (spec) => ({
        ...spec,
        body: spec.body.replace("stop === 80 ? '#0f6cbd' : '#7f7f7f'", "'#7f7f7f'"),
      })),
    });
    expect(await checkServerImport(dist)).toEqual([
      'lib/brand.mjs under node --conditions=react-server: createBrandTokens(\'#0f6cbd\') returned a brand80 of "#7f7f7f", not "#0f6cbd"',
      'lib/tokens.mjs under node --conditions=react-server: getTokenStyle({ brand80: \'#c43e00\', zOverlay: 2000 }) returned {"--wave-brand80":"#c43e00","--wave-z-overlay":"2000"}',
      'lib/waveTokens.mjs under node --conditions=react-server: waveTokens[chartPalette[0]] is "var(--wave-palette-blue)" and waveTokens.brand80 "var(--wave-brand80)", not "var(--wave-palette-blue)" and "var(--wave-brand-80)"',
    ]);
  }, 60_000);

  it('checkServerImport reports an entry whose token helpers come from a "use client" module', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/hooks/useThing.mjs':
        `${files['dist/hooks/useThing.mjs']}` +
        "export { createBrandTokens } from '../lib/brand.mjs';\n" +
        "export { waveTokens } from '../lib/waveTokens.mjs';\n",
      'dist/index.mjs': files['dist/index.mjs']
        .replace(
          "export { createBrandTokens } from './lib/brand.mjs';",
          "export { createBrandTokens } from './hooks/useThing.mjs';",
        )
        .replace(
          "export { waveTokens, chartPalette } from './lib/waveTokens.mjs';",
          "export { waveTokens } from './hooks/useThing.mjs';\nexport { chartPalette } from './lib/waveTokens.mjs';",
        ),
    });
    expect(await checkServerImport(dist)).toEqual([
      expect.stringMatching(
        /^index\.mjs under node --conditions=react-server: createBrandTokens is a client reference/,
      ),
    ]);
    const objectOnly = fixture({
      'dist/hooks/useThing.mjs': `${files['dist/hooks/useThing.mjs']}export { waveTokens } from '../lib/waveTokens.mjs';\n`,
      'dist/index.mjs': files['dist/index.mjs'].replace(
        "export { waveTokens, chartPalette } from './lib/waveTokens.mjs';",
        "export { waveTokens } from './hooks/useThing.mjs';\nexport { chartPalette } from './lib/waveTokens.mjs';",
      ),
    });
    expect(await checkServerImport(objectOnly.dist)).toEqual([
      expect.stringMatching(
        /^index\.mjs under node --conditions=react-server: waveTokens is not a plain object \(missing, or a client reference/,
      ),
    ]);
  }, 60_000);

  it('verifyDist runs the 0.17 probes and the chart-library check', async () => {
    const { dist } = fixture({
      ...LEAKS.Tree.leak(),
      ...changed('lib/brand', (spec) => ({
        ...spec,
        body: spec.body.replace(
          "try { if (process.env.NODE_ENV !== 'production') checkBrandRamp(seed); } catch {}",
          'checkBrandRamp(seed);',
        ),
      })),
      ...WITHOUT.WaveProvider.files(),
      'dist/styles.css': '/* chart.js */\n',
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'styles.css holds "chart.js" (a library of the stories only, R14: it must not reach dist)',
      ...LEAKS.Tree.reports,
      'the bundle of an import of only createBrandTokens contains "createBrandTokens:contrast" outside comments (its minified code)',
      ...WITHOUT.WaveProvider.reports,
    ]);
  }, 180_000);

  it('verifyDist gates the 0.17 budgets: passes on a correct dist, reports an import over its budget', async () => {
    const good = await verifyDist(fixture().dist, noPending);
    expect(good.errors).toEqual([]);
    // 120,000 characters of random base64 (see the DataGrid budget): over every budget.
    const table = randomBytes(90_000).toString('base64');
    const { dist } = fixture(
      changed('lib/brand', (spec) => ({
        ...spec,
        body: `const TABLE = ${JSON.stringify(table)};\n${spec.body.replace("'#7f7f7f'", 'TABLE')}`,
      })),
    );
    const result = await verifyDist(dist, noPending);
    // The 0.17 records follow those of RECORDED_IMPORTS (against 0.15.0, without these budgets).
    const records = result.recorded.slice(RECORDED_IMPORTS.length);
    const brand = records.find(({ names }) => names.join() === 'createBrandTokens');
    const button = records.find(({ names }) => names.join() === 'Button');
    expect(brand.baseline).toBeNull();
    // The component imports of 0.17 have no budget there since 0.18 (RECORDED_IMPORTS_0_18).
    expect(button.baseline.version).toBe('0.16.0');
    expect(button.budget).toBeUndefined();
    expect(result.errors).toEqual([
      `createBrandTokens: ${brand.minified} bytes minified, over the budget of 4495`,
      `createBrandTokens: ${brand.gzip} bytes gzip, over the budget of 3072`,
    ]);
  }, 180_000);

  it('main prints the 0.17 imports against 0.16.0, and the new ones with their budgets', async () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', fixture().dist, '--no-pending'], io)).toBe(0);
    const output = lines.join('\n');
    expect(output).toMatch(
      /verify-dist: createBrandTokens-only import: \d+ B minified \(budget 4495\), \d+ B gzip \(budget 3072\)\n/,
    );
    expect(output).toMatch(
      /verify-dist: waveTokens-only import: \d+ B minified \(budget 3839\), \d+ B gzip \(budget 3072\)\n/,
    );
    // Without a budget since 0.18, which prints them with theirs against 0.17.1.
    for (const [label, minified, gzip] of [
      ['Button', 11195, 3855],
      ['MessageBar', 26831, 9312],
      ['Tree', 47248, 16196],
      ['Dialog', 70721, 23723],
      ['WaveProvider \\+ Dialog', 71884, 24127],
    ]) {
      expect(output).toMatch(
        new RegExp(
          `verify-dist: ${label}-only import: \\d+ B minified, \\d+ B gzip \\(0\\.16\\.0: ${minified} B, ${gzip} B; [+-]\\d+\\.\\d{2} %, [+-]\\d+\\.\\d{2} %\\)`,
        ),
      );
    }
  }, 180_000);

  it('the real exports carry the 0.17 names', async () => {
    const mod = await import('../../src/index.ts');
    for (const name of ['getTokenStyle', 'createBrandTokens']) {
      expect(mod[name], name).toBeTypeOf('function');
    }
    expect(mod.waveTokens.primary).toBe('var(--wave-primary)');
    expect(mod.waveTokens[mod.chartPalette[0]]).toBe('var(--wave-palette-blue)');
    expect(mod.getTokenStyle({ brand80: '#c43e00' })).toEqual({ '--wave-brand-80': '#c43e00' });
  }, 60_000);

  it('lists every module-only export of the 0.17 modules, read with the compiler against the entry', () => {
    const sources = ['src/lib/tokens.ts', 'src/lib/waveTokens.ts', 'src/lib/brand.ts'].map((path) =>
      join(repoRoot, path),
    );
    const entry = join(repoRoot, 'src/index.ts');
    const config = ts.readConfigFile(join(repoRoot, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repoRoot);
    const program = ts.createProgram({
      rootNames: [entry, ...sources],
      options: { ...parsed.options, noEmit: true },
    });
    const checker = program.getTypeChecker();
    const exportsOf = (file) => {
      const source = program.getSourceFile(file);
      expect(source, file).toBeDefined();
      return checker.getExportsOfModule(checker.getSymbolAtLocation(source)).map((s) => s.name);
    };
    const entryNames = new Set(exportsOf(entry));
    const moduleOnly = sources.flatMap((file) =>
      exportsOf(file).filter((name) => !entryNames.has(name)),
    );
    expect(moduleOnly.filter((name) => !MODULE_ONLY_NAMES.includes(name))).toEqual([]);
    expect([...moduleOnly].sort()).toEqual([
      'BRAND_CONTRAST_PAIRS',
      'DEFAULT_BRAND_RAMP',
      'ROUNDS_DARKER',
      'TokenVariable',
      'WAVE_TOKEN_NAMES',
      'checkBrandRamp',
      'collectTokenStyle',
      'mergeTokenOverrides',
      'tokenVariable',
    ]);
    for (const name of ['getTokenStyle', 'waveTokens', 'chartPalette', 'createBrandTokens']) {
      expect(MODULE_ONLY_NAMES, name).not.toContain(name);
    }
  }, 60_000);

  it('the roll-up declares the module-only types it needs without exporting them', async () => {
    // The checker reads `declare type TokenVariable` and `declare const WAVE_TOKEN_NAMES`, which
    // the exported `waveTokens` and `WaveTokenName` refer to, as declared but not exported.
    const dts =
      `${DTS}declare type TokenVariable<Name extends string> = \`--wave-\${Name}\`;\n` +
      "declare const WAVE_TOKEN_NAMES: readonly ['primary'];\n" +
      'export declare type WaveTokenName = (typeof WAVE_TOKEN_NAMES)[number];\n';
    expect(checkModuleOnlyNames({}, dts)).toEqual([]);
    expect(checkModuleOnlyNames({}, `${dts}export { TokenVariable }\n`)).toEqual([
      'index.d.ts exports TokenVariable, which is module-only (keep it out of the barrels)',
    ]);
  });
});

describe('the 0.18 probes (INTEGRATION)', () => {
  /**
   * The fixture module of `path` (see PHASE13_MODULES, else PHASE12_MODULES, else PHASE11_MODULES)
   * with `change` applied.
   */
  const changed = (path, change) => {
    const spec = PHASE13_MODULES[path] ?? PHASE12_MODULES[path] ?? PHASE11_MODULES[path];
    return { [`dist/${path}.mjs`]: phase13Module(path, change(spec)) };
  };
  /** The fixture module of `path` whose function `fn` also imports `name` from `target` and calls it. */
  const callingIn = (path, fn, target, name) =>
    changed(path, (spec) => {
      const start = new RegExp(`(function ${fn}\\([^)]*\\) \\{ )`);
      expect(spec.body).toMatch(start);
      return {
        ...spec,
        imports: [...spec.imports, [target, [name]]],
        body: spec.body.replace(start, `$1${name}(); `),
      };
    });
  /** The fixture component `path` (a module of goodFiles) that also imports `name` and calls it. */
  const componentCalling = (path, target, name) => ({
    [`dist/${path}.mjs`]: withCall(goodFiles()[`dist/${path}.mjs`], path, target, name),
  });
  /** The fixture component `path` without its call of `name` (one of PHASE13_CALLS). */
  const componentWithout = (path, target, name) => {
    const file = `dist/${path}.mjs`;
    const relative = posix.relative(posix.dirname(path), target);
    const line = `import { ${name} } from '${relative.startsWith('.') ? relative : `./${relative}`}.mjs';\n`;
    const code = goodFiles()[file];
    expect(code).toContain(line);
    expect(code).toContain(`${name}(props); `);
    return { [file]: code.replace(line, '').replace(`${name}(props); `, '') };
  };

  it('lists the 0.18 modules: each has its source and the fixture holds it; no module of the package imports one that only the tests read', () => {
    expect(CUSTOMIZATION_MODULES).toEqual([...new Set(CUSTOMIZATION_MODULES)].sort());
    for (const path of CUSTOMIZATION_MODULES) {
      const source = join(repoRoot, 'src', path.replace(/\.mjs$/, ''));
      expect(
        existsSync(`${source}.ts`) || existsSync(`${source}.tsx`),
        `src/${path} has no source`,
      ).toBe(true);
    }
    const files = goodFiles();
    expect(CUSTOMIZATION_MODULES.filter((path) => !(`dist/${path}` in files))).toEqual([]);

    expect(TEST_ONLY_MODULES).toEqual(['lib/slotParts']);
    const sources = readdirSync(join(repoRoot, 'src'), { recursive: true })
      .map((path) => String(path).replaceAll('\\', '/'))
      .filter((path) => /\.tsx?$/.test(path) && !/(^|\/)__tests__\//.test(path))
      .filter((path) => !/^test-utils/.test(path));
    for (const module of TEST_ONLY_MODULES) {
      expect(sources, module).toContain(`${module}.ts`);
    }
    const importers = sources.filter((path) =>
      importSpecifiers(readFileSync(join(repoRoot, 'src', path), 'utf8')).some((specifier) =>
        TEST_ONLY_MODULES.some((module) => specifier.endsWith(`/${module.split('/')[1]}`)),
      ),
    );
    expect(importers).toEqual([]);
  });

  it('lists the probes, the budgets and the recorded imports of the spec (§5, R23)', () => {
    const context = (...names) => names.map((name) => `components/${name}.mjs`);
    expect(HOOK_PROBES_0_18.map(({ keep, modules }) => [keep, modules])).toEqual([
      ['getNativeElementProps', ['lib/nativeProps.mjs']],
      ['mergeSlotProps', ['lib/slotProps.mjs']],
      ['useFieldContext', ['hooks/useFieldControl.mjs']],
      ['FieldContextProvider', ['hooks/useFieldControl.mjs']],
      ['useRadioGroupContext', context('input/RadioGroup.context')],
      ['useRadioGroupItem', context('input/RadioGroup.context')],
      ['useMenuContext', context('navigation/Menu.hooks', 'navigation/Menu.context')],
      ['useMenuListContext', context('navigation/Menu.hooks', 'navigation/Menu.context')],
      ['useMessageBarContext', context('feedback/MessageBar.context')],
      ['useDataGridSort', context('table/DataGrid.hooks', 'table/DataGrid.context')],
      [
        'useDataGridSelection',
        context('table/DataGrid.hooks', 'table/DataGrid.context', 'table/DataGrid.store'),
      ],
      ['useDataGridRowId', context('table/DataGrid.hooks', 'table/DataGrid.context')],
    ]);
    for (const probe of HOOK_PROBES_0_18) {
      expect(probe.dropPrefixes, probe.keep).toEqual(['components/', 'hooks/']);
    }
    const [nativeProps, slotProps, ...hooks] = HOOK_PROBES_0_18;
    for (const probe of [nativeProps, slotProps]) {
      expect(probe.dropModules, probe.keep).toEqual([]);
      expect(probe.dropExternals, probe.keep).toEqual(['react', 'react-dom', 'react/jsx-runtime']);
    }
    // Each hook: no component it belongs to, no presence core, no positioning, no portal.
    expect(hooks.map(({ keep, dropModules }) => [keep, ...dropModules])).toEqual(
      [
        ['useFieldContext', 'input/Field'],
        ['FieldContextProvider', 'input/Field'],
        ['useRadioGroupContext', 'input/RadioGroup'],
        ['useRadioGroupItem', 'input/RadioGroup'],
        ['useMenuContext', 'navigation/Menu'],
        ['useMenuListContext', 'navigation/Menu'],
        ['useMessageBarContext', 'feedback/MessageBar'],
        ['useDataGridSort', 'table/DataGrid'],
        ['useDataGridSelection', 'table/DataGrid'],
        ['useDataGridRowId', 'table/DataGrid'],
      ].map(([keep, component]) => [
        keep,
        `components/${component}.mjs`,
        'hooks/usePresence.mjs',
        'hooks/usePopupPosition.mjs',
      ]),
    );
    for (const probe of hooks) {
      expect(probe.dropExternals, probe.keep).toEqual(['react-dom', '@floating-ui/react-dom']);
    }
    expect(CUSTOMIZATION_MODULES).toEqual([
      'components/feedback/MessageBar.context.mjs',
      'components/input/RadioGroup.context.mjs',
      'components/navigation/Menu.hooks.mjs',
      'components/table/DataGrid.hooks.mjs',
      'hooks/useFieldControl.mjs',
      'lib/nativeProps.mjs',
      'lib/slotProps.mjs',
    ]);
    expect(EXCLUSION_PROBES_0_18).toEqual([
      { keep: 'Button', drop: null, dropModules: CUSTOMIZATION_MODULES },
      {
        keep: 'Dialog',
        drop: 'DataGrid',
        dropModules: CUSTOMIZATION_MODULES.filter((path) => path !== 'lib/slotProps.mjs'),
      },
      {
        keep: 'DataGrid',
        drop: null,
        dropModules: ['components/table/DataGrid.hooks.mjs', 'lib/nativeProps.mjs'],
      },
    ]);
    expect(INCLUSION_PROBES_0_18).toEqual([
      { keep: 'Dialog', modules: ['lib/slotProps.mjs'] },
      {
        keep: 'MessageBar',
        modules: ['components/feedback/MessageBar.context.mjs', 'lib/slotProps.mjs'],
      },
    ]);

    // Spec R23: each budget is the size measured at the end of Phase 13 plus 512 bytes minified
    // and 192 gzip; each import is printed against its size in the published 0.17.1 package.
    expect(BUDGET_MARGIN_0_18).toEqual({ minified: 512, gzip: 192 });
    expect(BASELINES_0_17_1).toEqual({
      Button: { minified: 11222, gzip: 3866 },
      MessageBar: { minified: 26858, gzip: 9324 },
      Tree: { minified: 47327, gzip: 16232 },
      Dialog: { minified: 70850, gzip: 23786 },
      'WaveProvider + Dialog': { minified: 73403, gzip: 24778 },
      DataGrid: { minified: 70097, gzip: 23719 },
    });
    const components = ['clsx', 'react', 'react/jsx-runtime', 'tailwind-merge'];
    const portal = ['clsx', 'react', 'react-dom', 'react/jsx-runtime', 'tailwind-merge'];
    const records = [
      [['Button'], [11222, 3866], [11079, 3865], [11591, 4057], components],
      [['MessageBar'], [26858, 9324], [29185, 10188], [29697, 10380], components],
      [['Tree'], [47327, 16232], [50387, 17260], [50899, 17452], components],
      [['Dialog'], [70850, 23786], [72599, 24466], [73111, 24658], portal],
      [['WaveProvider', 'Dialog'], [73403, 24778], [75147, 25458], [75659, 25650], portal],
      [['DataGrid'], [70097, 23719], [73310, 24921], [73822, 25113], portal],
    ];
    expect(RECORDED_IMPORTS_0_18).toEqual(
      records.map(([names, baseline, measured, budget, allowedExternals]) => ({
        names,
        baseline: { version: '0.17.1', minified: baseline[0], gzip: baseline[1] },
        measured: { minified: measured[0], gzip: measured[1] },
        budget: { names, maxMinifiedBytes: budget[0], maxGzipBytes: budget[1], allowedExternals },
      })),
    );
    expect(RECORDED_IMPORTS_0_18.at(-1).budget).toBe(DATA_GRID_BUDGET);
    for (const { names, measured, budget } of RECORDED_IMPORTS_0_18) {
      expect([budget.maxMinifiedBytes, budget.maxGzipBytes], names.join(' + ')).toEqual([
        measured.minified + BUDGET_MARGIN_0_18.minified,
        measured.gzip + BUDGET_MARGIN_0_18.gzip,
      ]);
    }
    // The growth over 0.17.1 that the script's header and spec §11 state.
    expect(
      RECORDED_IMPORTS_0_18.map(({ names, baseline, measured }) => [
        names.join(' + '),
        measured.minified - baseline.minified,
        measured.gzip - baseline.gzip,
      ]),
    ).toEqual([
      ['Button', -143, -1],
      ['MessageBar', 2327, 864],
      ['Tree', 3060, 1028],
      ['Dialog', 1749, 680],
      ['WaveProvider + Dialog', 1744, 680],
      ['DataGrid', 3213, 1202],
    ]);
    // The 0.17.1 sizes are those of the CHANGELOG's Size tables (0.17.1 changed only the
    // provider, so the component imports keep their 0.17.0 sizes).
    const log = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8');
    const rows = log.slice(log.indexOf('## [0.17.1]'), log.indexOf('## [0.16.0]')).split('\n');
    for (const [label, minified, gzip] of [
      ['only `Button`', '11,222', '3,866'],
      ['only `MessageBar`', '26,858', '9,324'],
      ['only `Tree`', '47,327', '16,232'],
      ['only `Dialog`', '70,850', '23,786'],
      ['`WaveProvider` and `Dialog`', '73,403', '24,778'],
      ['only `DataGrid`', '70,097', '23,719'],
    ]) {
      // The newest row of the import (0.17.1's table comes first), its last column.
      const row = rows.find((line) => line.startsWith(`| An import of ${label} |`));
      expect(row, label).toMatch(new RegExp(` \\| ${minified} \\(${gzip} gzip\\) \\|$`));
    }
  });

  it('the hook probes pass on a correct dist', async () => {
    const { dist } = fixture();
    for (const probe of HOOK_PROBES_0_18) {
      expect(await probeHook(dist, probe), probe.keep).toEqual([]);
    }
  }, 60_000);

  it('a helper probe reports React, a component or a hook in the bundle', async () => {
    const probe = (keep) => HOOK_PROBES_0_18.find((candidate) => candidate.keep === keep);
    const withReact = fixture(
      changed('lib/nativeProps', (spec) => ({
        ...spec,
        imports: [['react', ['useState']]],
        body: spec.body.replace('const kept = ', 'useState(0); const kept = '),
      })),
    );
    expect(await probeHook(withReact.dist, probe('getNativeElementProps'))).toEqual([
      'the bundle of an import of only getNativeElementProps imports react',
    ]);
    const withButton = fixture(
      callingIn('lib/slotProps', 'mergeSlotProps', 'components/button/Button', 'Button'),
    );
    expect(await probeHook(withButton.dist, probe('mergeSlotProps'))).toEqual([
      'components/button/Button.mjs is in the bundle of an import of only mergeSlotProps (no module under components/ may be)',
    ]);
    const withHook = fixture(
      callingIn('lib/slotProps', 'mergeSlotProps', 'hooks/useThing', 'useThing'),
    );
    expect(await probeHook(withHook.dist, probe('mergeSlotProps'))).toEqual([
      'hooks/useThing.mjs is in the bundle of an import of only mergeSlotProps (no module under hooks/ may be)',
      'the bundle of an import of only mergeSlotProps imports react',
    ]);
  }, 60_000);

  it('a context hook probe reports its component, another component, popup code and a portal', async () => {
    const probe = (keep) => HOOK_PROBES_0_18.find((candidate) => candidate.keep === keep);
    const cases = [
      [
        'useFieldContext',
        callingIn('hooks/useFieldControl', 'useFieldContext', 'components/input/Field', 'Field'),
        ['components/input/Field.mjs is in the bundle of an import of only useFieldContext'],
      ],
      [
        'useRadioGroupItem',
        callingIn(
          'components/input/RadioGroup.context',
          'useRadioGroupItem',
          'components/input/RadioGroup',
          'RadioGroup',
        ),
        ['components/input/RadioGroup.mjs is in the bundle of an import of only useRadioGroupItem'],
      ],
      [
        'useMenuListContext',
        callingIn(
          'components/navigation/Menu.hooks',
          'useMenuListContext',
          'hooks/usePresence',
          'usePresence',
        ),
        ['hooks/usePresence.mjs is in the bundle of an import of only useMenuListContext'],
      ],
      [
        'useMessageBarContext',
        callingIn(
          'components/feedback/MessageBar.context',
          'useMessageBarContext',
          'components/button/Button',
          'Button',
        ),
        [
          'components/button/Button.mjs is in the bundle of an import of only useMessageBarContext (no module under components/ may be)',
        ],
      ],
      [
        'useDataGridRowId',
        callingIn(
          'components/table/DataGrid.hooks',
          'useDataGridRowId',
          'react-dom',
          'createPortal',
        ),
        ['the bundle of an import of only useDataGridRowId imports react-dom'],
      ],
    ];
    for (const [keep, files, reports] of cases) {
      expect(await probeHook(fixture(files).dist, probe(keep)), keep).toEqual(reports);
    }
  }, 60_000);

  it("probeHook: a probe's modules may sit under its dropPrefixes, and nothing else may", async () => {
    const { dist } = fixture();
    const probe = {
      keep: 'useMenuContext',
      modules: ['components/navigation/Menu.hooks.mjs', 'components/navigation/Menu.context.mjs'],
      dropPrefixes: ['components/'],
    };
    expect(await probeHook(dist, probe)).toEqual([]);
    expect(
      await probeHook(dist, { ...probe, modules: ['components/navigation/Menu.hooks.mjs'] }),
    ).toEqual([
      'components/navigation/Menu.context.mjs is in the bundle of an import of only useMenuContext (no module under components/ may be)',
    ]);
  }, 30_000);

  /** For each exclusion probe: the call that leaks code into its bundle, and what it reports. */
  const LEAKS = {
    Button: {
      leak: () => componentCalling('components/button/Button', 'lib/slotProps', 'mergeSlotProps'),
      reports: [
        'lib/slotProps.mjs is in the bundle of an import of only Button (it must be dropped)',
      ],
    },
    Dialog: {
      leak: () =>
        componentCalling(
          'components/overlays/Dialog',
          'components/table/DataGrid.hooks',
          'useDataGridSort',
        ),
      reports: [
        'components/table/DataGrid.hooks.mjs is in the bundle of an import of only Dialog (DataGrid must be dropped)',
      ],
    },
    DataGrid: {
      leak: () =>
        callingIn(
          'components/table/DataGrid',
          'DataGrid',
          'components/table/DataGrid.hooks',
          'useDataGridSort',
        ),
      reports: [
        'components/table/DataGrid.hooks.mjs is in the bundle of an import of only DataGrid (it must be dropped)',
      ],
    },
  };

  it.each(EXCLUSION_PROBES_0_18.map((probe) => [probe.keep, probe]))(
    'an import of only %s holds none of the 0.18 modules it does not use: passes on a correct dist, reports a leak',
    async (keep, probe) => {
      expect(await probeTreeShaking(fixture().dist, probe)).toEqual([]);
      expect(LEAKS[keep], keep).toBeDefined();
      expect(await probeTreeShaking(fixture(LEAKS[keep].leak()).dist, probe)).toEqual(
        LEAKS[keep].reports,
      );
    },
    30_000,
  );

  /** For each inclusion probe: the fixture without the call the probe looks for, and the report. */
  const WITHOUT = {
    Dialog: {
      files: () =>
        componentWithout('components/overlays/Dialog', 'lib/slotProps', 'mergeSlotProps'),
      reports: ['lib/slotProps.mjs is not in the bundle of an import of only Dialog'],
    },
    MessageBar: {
      files: () =>
        componentWithout(
          'components/feedback/MessageBar',
          'components/feedback/MessageBar.context',
          'useMessageBarContext',
        ),
      reports: [
        'components/feedback/MessageBar.context.mjs is not in the bundle of an import of only MessageBar',
      ],
    },
  };

  it.each(INCLUSION_PROBES_0_18.map((probe) => [probe.keep, probe]))(
    'an import of only %s holds the 0.18 modules its exclusions look for: passes on a correct dist, reports one missing',
    async (keep, probe) => {
      expect(await probeIncludes(fixture().dist, probe)).toEqual([]);
      expect(WITHOUT[keep], keep).toBeDefined();
      expect(await probeIncludes(fixture(WITHOUT[keep].files()).dist, probe)).toEqual(
        WITHOUT[keep].reports,
      );
    },
    30_000,
  );

  it('checkTestOnlyModules passes a correct dist and reports every file of a module the tests read', () => {
    expect(checkTestOnlyModules(fixture().dist)).toEqual([]);
    const { dist } = fixture({
      'dist/lib/slotParts.mjs': 'export const SLOT_PROPS_KEYS = {};\n',
      'dist/lib/slotParts.mjs.map': '{}\n',
      // Only a module of that name counts, not one whose name starts like it.
      'dist/lib/slotPartsGuide.mjs': 'export const guide = 1;\n',
    });
    const reason = (module) =>
      `is in dist: ${module} is read by the tests only (no module of the package may import it)`;
    expect(checkTestOnlyModules(dist)).toEqual([
      `lib/slotParts.mjs ${reason('lib/slotParts')}`,
      `lib/slotParts.mjs.map ${reason('lib/slotParts')}`,
    ]);
  });

  it('checkServerImport reads the part helpers from lib and from the entry on the server', async () => {
    expect(await checkServerImport(fixture().dist)).toEqual([]);
    const missing = await checkServerImport(
      fixture({ 'dist/lib/slotProps.mjs': null, 'dist/lib/nativeProps.mjs': null }).dist,
    );
    expect(missing).toEqual(['lib/nativeProps.mjs is missing', 'lib/slotProps.mjs is missing']);
  }, 60_000);

  it('checkServerImport reports a part helper that is wrong on the server, and one the entry takes from a "use client" module', async () => {
    const { dist } = fixture({
      ...changed('lib/slotProps', (spec) => ({
        ...spec,
        body: spec.body.replace(', ...own.locked }', ' }'),
      })),
      ...changed('lib/nativeProps', (spec) => ({
        ...spec,
        body: spec.body.replace(" || name.startsWith('data-')", ''),
      })),
    });
    const helper =
      'getNativeElementProps(\'button\', { id, disabled, onClick, onValueChange, tone, data-x }, [\'id\']) kept ["disabled","onClick"]';
    const merge =
      "mergeSlotProps({ title: 'Yours', role: 'button' }, { className: 'part', locked: { role: " +
      "'status' } }) returned " +
      '{"title":"Yours","role":"button","className":"part"}';
    expect(await checkServerImport(dist)).toEqual([
      `lib/nativeProps.mjs under node --conditions=react-server: ${helper}`,
      `lib/slotProps.mjs under node --conditions=react-server: ${merge}`,
    ]);

    const files = goodFiles();
    const fromClient = fixture({
      'dist/hooks/useThing.mjs': `${files['dist/hooks/useThing.mjs']}export { mergeSlotProps } from '../lib/slotProps.mjs';\n`,
      'dist/index.mjs': files['dist/index.mjs'].replace(
        "export { mergeSlotProps } from './lib/slotProps.mjs';",
        "export { mergeSlotProps } from './hooks/useThing.mjs';",
      ),
    });
    expect(await checkServerImport(fromClient.dist)).toEqual([
      expect.stringMatching(
        /^index\.mjs under node --conditions=react-server: mergeSlotProps is a client reference/,
      ),
    ]);
  }, 60_000);

  it('verifyDist runs the 0.18 probes and the check of the test-only modules', async () => {
    const leak = callingIn(
      'components/feedback/MessageBar.context',
      'useMessageBarContext',
      'components/button/Button',
      'Button',
    );
    const { dist } = fixture({
      'dist/lib/slotParts.mjs': 'export const SLOT_PROPS_KEYS = {};\n',
      ...LEAKS.Button.leak(),
      ...leak,
      ...WITHOUT.Dialog.files(),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'lib/slotParts.mjs is in dist: lib/slotParts is read by the tests only (no module of the package may import it)',
      ...LEAKS.Button.reports,
      'components/button/Button.mjs is in the bundle of an import of only useMessageBarContext (no module under components/ may be)',
      ...WITHOUT.Dialog.reports,
    ]);
  }, 180_000);

  it('verifyDist gates the 0.18 budgets: passes on a correct dist, reports each import over its budget', async () => {
    const good = await verifyDist(fixture().dist, noPending);
    expect(good.errors).toEqual([]);
    // 120,000 characters of random base64 (see the DataGrid budget) in Button and in the part
    // helper, which MessageBar and Dialog merge their parts with: over those four budgets.
    const table = randomBytes(90_000).toString('base64');
    const { dist } = fixture({
      'dist/components/button/Button.mjs': goodFiles()['dist/components/button/Button.mjs'].replace(
        'function ButtonRoot(props) { return cn(',
        `const TABLE = ${JSON.stringify(table)};\nfunction ButtonRoot(props) { return cn(TABLE, `,
      ),
      ...changed('lib/slotProps', (spec) => ({
        ...spec,
        body: `const TABLE = ${JSON.stringify(table)};\n${spec.body.replace(
          '...own.locked }',
          "...own.locked, 'data-table': TABLE }",
        )}`,
      })),
    });
    const result = await verifyDist(dist, noPending);
    // The 0.18 records follow those of RECORDED_IMPORTS (0.15.0) and RECORDED_IMPORTS_0_17 (0.16.0).
    const records = result.recorded.slice(RECORDED_IMPORTS.length + RECORDED_IMPORTS_0_17.length);
    expect(
      records.map(({ names, baseline }) => `${names.join(' + ')} ${baseline.version}`),
    ).toEqual([
      'Button 0.17.1',
      'MessageBar 0.17.1',
      'Tree 0.17.1',
      'Dialog 0.17.1',
      'WaveProvider + Dialog 0.17.1',
      'DataGrid 0.17.1',
    ]);
    const over = (label, maxMinified, maxGzip) => {
      const { minified, gzip } = records.find(({ names }) => names.join(' + ') === label);
      return [
        `${label}: ${minified} bytes minified, over the budget of ${maxMinified}`,
        `${label}: ${gzip} bytes gzip, over the budget of ${maxGzip}`,
      ];
    };
    expect(result.errors).toEqual([
      ...over('Button', 11591, 4057),
      ...over('MessageBar', 29697, 10380),
      ...over('Dialog', 73111, 24658),
      ...over('WaveProvider + Dialog', 75659, 25650),
    ]);
  }, 180_000);

  it('main prints the 0.18 imports against 0.17.1, with their budgets', async () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', fixture().dist, '--no-pending'], io)).toBe(0);
    const output = lines.join('\n');
    for (const [label, minified, gzip, maxMinified, maxGzip] of [
      ['Button', 11222, 3866, 11591, 4057],
      ['MessageBar', 26858, 9324, 29697, 10380],
      ['Tree', 47327, 16232, 50899, 17452],
      ['Dialog', 70850, 23786, 73111, 24658],
      ['WaveProvider \\+ Dialog', 73403, 24778, 75659, 25650],
      ['DataGrid', 70097, 23719, 73822, 25113],
    ]) {
      expect(output).toMatch(
        new RegExp(
          `verify-dist: ${label}-only import: \\d+ B minified \\(budget ${maxMinified}\\), \\d+ B gzip \\(budget ${maxGzip}\\) \\(0\\.17\\.1: ${minified} B, ${gzip} B; [+-]\\d+\\.\\d{2} %, [+-]\\d+\\.\\d{2} %\\)`,
        ),
      );
    }
  }, 180_000);

  it('the real exports carry the 0.18 names, mergeSlotProps last in the entry', async () => {
    const mod = await import('../../src/index.ts');
    for (const name of [
      'mergeSlotProps',
      'getNativeElementProps',
      'useFieldContext',
      'FieldContextProvider',
      'useRadioGroupContext',
      'useRadioGroupItem',
      'useMenuContext',
      'useMenuListContext',
      'useMessageBarContext',
      'useDataGridSort',
      'useDataGridSelection',
      'useDataGridRowId',
    ]) {
      expect(mod[name], name).toBeTypeOf('function');
    }
    // Its export order sets the order of the helper's imports in every bundle (spec §11, Task 1).
    const entry = readFileSync(join(repoRoot, 'src/index.ts'), 'utf8');
    const values = [...entry.matchAll(/^export (?!type\b)[^;]*;/gms)].map(
      ([statement]) => statement,
    );
    expect(values.at(-1)).toBe("export { mergeSlotProps } from './lib/slotProps';");
  }, 60_000);

  it('lists every module-only export of the 0.18 modules, read with the compiler against the entry', () => {
    // The modules 0.18 adds: every export the entry does not export must be listed.
    const sources = [
      'src/lib/slotProps.ts',
      'src/lib/nativeProps.ts',
      'src/lib/slotParts.ts',
      'src/components/input/RadioGroup.context.ts',
      'src/components/navigation/Menu.hooks.ts',
      'src/components/feedback/MessageBar.context.ts',
      'src/components/table/DataGrid.hooks.ts',
    ].map((path) => join(repoRoot, path));
    // The seams 0.18 adds to modules that existed before (their older exports are not listed).
    const seams = {
      'src/components/data-display/AvatarGroup.parts.tsx': ['AVATAR_GROUP_PART_LOCKS'],
      'src/components/data-display/TagGroup.context.ts': ['BLOCK_CLICK', 'TAG_PART_LOCKS'],
      'src/components/input/Calendar.tsx': ['CalendarViewParts'],
      'src/components/input/Calendar.views.tsx': ['CalendarDayGridParts'],
      'src/components/input/Option.tsx': ['ListboxSurfaceParts', 'PickerListboxSurface'],
      'src/components/layout/Tree.context.ts': ['TREE_PART_LOCKS'],
      'src/components/navigation/Menu.context.ts': ['MenuListElementContext'],
      'src/components/navigation/Menu.shared.ts': ['BLOCK_CLICK', 'MENU_PART_LOCKS'],
      'src/components/navigation/Nav.context.ts': [
        'BLOCK_CLICK',
        'NAV_PART_LOCKS',
        'NAV_SHOWN_PART_LOCKS',
      ],
      'src/components/overlays/TeachingPopover.context.ts': [
        'hasRenderFunction',
        'withoutRenderFunction',
      ],
      'src/components/table/DataGrid.context.ts': ['DataGridSelectAllPartContext'],
      'src/components/table/DataGrid.store.ts': ['SelectionSnapshot'],
      'src/components/table/Table.resize.tsx': ['TableResizeHandlePartProps'],
      'src/hooks/useFieldControl.ts': ['fieldLocks'],
      'src/hooks/useListbox.ts': ['OPTION_STATE_LOCKS', 'preventMouseDown'],
      'src/lib/mergeProps.ts': ['ID_LIST_KEYS'],
      'src/lib/slot.ts': ['resolveWiredSlot'],
    };
    const entry = join(repoRoot, 'src/index.ts');
    const config = ts.readConfigFile(join(repoRoot, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repoRoot);
    const program = ts.createProgram({
      rootNames: [entry, ...sources, ...Object.keys(seams).map((path) => join(repoRoot, path))],
      options: { ...parsed.options, noEmit: true },
    });
    const checker = program.getTypeChecker();
    const exportsOf = (file) => {
      const source = program.getSourceFile(file);
      expect(source, file).toBeDefined();
      return checker.getExportsOfModule(checker.getSymbolAtLocation(source)).map((s) => s.name);
    };
    const entryNames = new Set(exportsOf(entry));
    const moduleOnly = sources.flatMap((file) =>
      exportsOf(file).filter((name) => !entryNames.has(name)),
    );
    expect(moduleOnly.filter((name) => !MODULE_ONLY_NAMES.includes(name))).toEqual([]);
    expect([...moduleOnly].sort()).toEqual([
      'BUTTON_PART_LOCKS',
      'ClassNameConstant',
      'HIDDEN_PART_LOCKS',
      'MessageBarContext',
      'NAMED_SLOT_PARTS',
      'NATIVE_EVENT_NAMES',
      'NATIVE_GLOBAL_PROPS',
      'NATIVE_NO_CAPTURE_EVENTS',
      'NATIVE_TAG_PROPS',
      'PENDING_SLOT_PARTS',
      'RadioGroupContext',
      'RadioGroupItemsContextValue',
      'RadioItemState',
      'SLOT_PART_EXCLUSIONS',
      'SLOT_PROPS_KEYS',
      'SLOT_PROPS_ROOT_OWNERS',
      'SlotPartExclusion',
      'SlotPartKey',
      'SlotPartLists',
      'composeAfterPart',
      'lockPositionStyle',
      'useRadioItemState',
    ]);
    for (const [path, names] of Object.entries(seams)) {
      const exported = exportsOf(join(repoRoot, path));
      for (const name of names) {
        expect(exported, `${path} exports ${name}`).toContain(name);
        expect(entryNames.has(name), `the entry exports ${name}`).toBe(false);
        expect(MODULE_ONLY_NAMES, name).toContain(name);
      }
    }
    // The public names of the new modules stay out of the list.
    for (const name of [
      'mergeSlotProps',
      'SlotPart',
      'SlotPartOwn',
      'getNativeElementProps',
      'NativeElementProps',
      'useFieldContext',
      'FieldContextProvider',
      'useRadioGroupContext',
      'useRadioGroupItem',
      'useMenuContext',
      'useMenuListContext',
      'useMessageBarContext',
      'useDataGridSort',
      'useDataGridSelection',
      'useDataGridRowId',
    ]) {
      expect(entryNames.has(name), name).toBe(true);
      expect(MODULE_ONLY_NAMES, name).not.toContain(name);
    }
  }, 60_000);

  it('lists the merge of the components (1.0, spec R6): lib/cn exports cn to the entry, the rest stays module-only', () => {
    const entry = join(repoRoot, 'src/index.ts');
    const cnModule = join(repoRoot, 'src/lib/cn.ts');
    const config = ts.readConfigFile(join(repoRoot, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repoRoot);
    const program = ts.createProgram({
      rootNames: [entry, cnModule],
      options: { ...parsed.options, noEmit: true },
    });
    const checker = program.getTypeChecker();
    const exportsOf = (file) =>
      checker
        .getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(file)))
        .map((symbol) => symbol.name);
    const entryNames = new Set(exportsOf(entry));
    expect(entryNames.has('cn')).toBe(true);
    const moduleOnly = exportsOf(cnModule).filter((name) => !entryNames.has(name));
    expect(moduleOnly.sort()).toEqual(['UTILITY_PREFIX', 'createWcn', 'twMerge', 'wcn']);
    for (const name of moduleOnly) expect(MODULE_ONLY_NAMES, name).toContain(name);
    expect(MODULE_ONLY_NAMES).not.toContain('cn');
  }, 60_000);
});

describe('verifyDist and main', () => {
  // Every test runs the whole check: its probes bundle the fixture with Vite several times and
  // load it in child Node.js processes. That takes about 6 s alone, and more than 30 s at times
  // under the parallel gate or on a CI runner, hence the 90 s timeouts, here and in the other
  // suites that run it (180 s or more where a test runs it more than once or measures the
  // recorded imports).
  it('passes a correct dist', async () => {
    const { dist } = fixture();
    const result = await verifyDist(dist, noPending);
    expect(result.errors).toEqual([]);
  }, 90_000);

  it('runs the class-name checks: a registry constant missing from the entry fails', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/index.mjs': files['dist/index.mjs'].replace(
        'export { buttonClassNames, dialogContentClassNames }',
        'export { buttonClassNames }',
      ),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'index.mjs does not export dialogContentClassNames (a class-name constant of lib/classNames.mjs)',
    ]);
  }, 90_000);

  it('runs the ES-only checks: a CommonJS file and a top-level await fail (spec R4)', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/index.d.cts': DTS,
      'dist/lib/date.mjs': `await Promise.resolve();\n${files['dist/lib/date.mjs']}`,
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'index.d.cts is CommonJS output: the package ships ES modules only (one ES output in vite.config.ts, no index.d.cts)',
      expect.stringMatching(
        /^index\.mjs does not load through require\(\), .*: ERR_REQUIRE_ASYNC_MODULE: /,
      ),
    ]);
  }, 90_000);

  it('collects the failures of every check', async () => {
    const { dist } = fixture({
      'dist/index.d.ts': null,
      'dist/index.cjs': 'exports.cn = () => "";\n',
      'dist/lib/cn.mjs': DIRECTIVE + goodFiles()['dist/lib/cn.mjs'],
      'dist/lib/dev.mjs': goodFiles()['dist/lib/dev.mjs'].replace(
        'process.env.NODE_ENV',
        '"production"',
      ),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      expect.arrayContaining([
        'index.d.ts is missing',
        expect.stringMatching(/^index\.cjs is CommonJS output/),
        expect.stringContaining('lib/cn.mjs'),
        expect.stringMatching(/^lib\/dev\.mjs does not read process\.env\.NODE_ENV/),
      ]),
    );
  }, 90_000);

  it('fails a dist whose JavaScript is correct but whose declarations rolled up empty', async () => {
    // TypeScript 6 without tsconfig.json's rootDir: the build passes, index.d.ts is `export { }`.
    const { dist } = fixture({ 'dist/index.d.ts': EMPTY_ROLL_UP });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export cn, Button, /),
    ]);
  }, 90_000);

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
  }, 90_000);

  it('runs the motion probe: a Button bundle with a recipe literal fails (D23)', async () => {
    const { dist } = fixture({
      'dist/components/button/Button.mjs': buttonWith(
        `const motion = '${MOTION_RECIPES.dialogMotion}';`,
      ).replace('cn(buttonClassNames.root, ', 'cn(buttonClassNames.root, motion, '),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      `the bundle of an import of only Button contains the string "${MOTION_RECIPES.dialogMotion}" (an unused constant was not tree-shaken)`,
      'the bundle of an import of only Button contains "[presence=" outside comments (its minified code)',
    ]);
  }, 90_000);

  it('runs the motion probe: a Button bundle with the motion modules fails (D23)', async () => {
    const { dist } = fixture({
      'dist/components/button/Button.mjs': buttonWith(
        '',
        "import { useMotionClasses } from '../../hooks/useMotion.mjs';\n",
      ).replace(
        'cn(buttonClassNames.root, ',
        "cn(buttonClassNames.root, useMotionClasses(props.motion, ''), ",
      ),
    });
    const { errors } = await verifyDist(dist, noPending);
    // The modules alone: the resolver holds no presence variant of its own since 1.0 (the
    // className rule is gone), and this Button keeps no recipe.
    expect(errors).toEqual([
      'hooks/useMotion.mjs is in the bundle of an import of only Button (Presence must be dropped)',
      'lib/motion.mjs is in the bundle of an import of only Button (Presence must be dropped)',
    ]);
  }, 90_000);

  it('runs the motion control: a Dialog bundle without one of its recipes fails (D23)', async () => {
    const dialog = 'dist/components/overlays/Dialog.mjs';
    const files = goodFiles();
    expect(files[dialog]).toContain(
      'useMotionClasses(props.backdropMotion, dialogBackdropMotion), ',
    );
    const { dist } = fixture({
      [dialog]: files[dialog].replace(
        'useMotionClasses(props.backdropMotion, dialogBackdropMotion), ',
        '',
      ),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      `the bundle of an import of only Dialog lacks the string "${MOTION_RECIPES.dialogBackdropMotion}"`,
    ]);
  }, 90_000);

  it('runs the Field probe: a Field bundle that pulls InfoButton fails', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/components/input/Field.mjs': files['dist/components/input/Field.mjs']
        .replace(
          "import { cn } from '../../lib/cn.mjs';\n",
          "import { cn } from '../../lib/cn.mjs';\nimport { InfoButton } from '../data-display/InfoButton.mjs';\n",
        )
        .replace('return cn(', 'InfoButton({}); return cn('),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/data-display/InfoButton.mjs is in the bundle of an import of only Field (InfoButton must be dropped)',
      'InfoButton code (displayName "InfoButton") is in the bundle of an import of only Field',
      'the bundle of an import of only Field contains the string "wave-info-button" (an unused constant was not tree-shaken)',
    ]);
  }, 90_000);

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
  }, 90_000);

  it('prints the measured presence budget', async () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', fixture().dist, '--no-pending'], io)).toBe(0);
    expect(lines.join('\n')).toMatch(
      /verify-dist: presence core \(usePresence \+ Presence\): \d+ B minified \(budget 6804\), \d+ B gzip \(budget 2927\)/,
    );
  }, 90_000);

  it('exits 0 for a correct dist and 1 otherwise', async () => {
    const quiet = { log: () => {}, error: () => {} };
    expect(await main(['--dist', fixture().dist, '--no-pending'], quiet)).toBe(0);
    expect(
      await main(['--dist', fixture({ 'dist/index.d.cts': DTS }).dist, '--no-pending'], quiet),
    ).toBe(1);
    expect(await main(['--dist', join(fixtureRoot, 'missing')], quiet)).toBe(1);
  }, 180_000);

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
  }, 180_000);

  it('tolerates pending flat names, and only while the bridge is open', async () => {
    const { dist } = fixture({
      'dist/index.mjs': goodFiles()['dist/index.mjs'].replace(
        'export { Card, CardHeader }',
        'export { Card }',
      ),
    });
    expect(await verifyDist(dist, { pendingFlatExports: ['Card'] })).toEqual({
      errors: [],
      pending: ['CardHeader'],
      planned: [],
      budget: { minified: expect.any(Number), gzip: expect.any(Number) },
      virtualBudget: { minified: expect.any(Number), gzip: expect.any(Number) },
      recorded: expect.any(Array),
    });
    expect((await verifyDist(dist, { pendingFlatExports: ['Card'], final: true })).errors).toEqual([
      expect.stringMatching(/CardHeader is not exported/),
      expect.stringMatching(/PENDING_FLAT_EXPORTS .*still lists Card/),
    ]);
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', dist, '--no-pending'], io)).toBe(1);
    expect(lines.join('\n')).toMatch(/CardHeader is not exported/);
  }, 270_000);
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
