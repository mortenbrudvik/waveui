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
import { basename, dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  checkCjsParity,
  checkClassNameExports,
  checkDeclarations,
  checkDevEnvironment,
  checkDirectives,
  checkFlatExports,
  checkImports,
  checkModuleOnlyNames,
  checkServerImport,
  clientReferenceStub,
  createWorkDir,
  directivePrologue,
  entryStatus,
  EXCLUSION_PROBES_0_11,
  expectsUseClient,
  importSpecifiers,
  INCLUSION_PROBES_0_11,
  isMainModule,
  main,
  missingDeclarations,
  missingValueAndTypeDeclarations,
  MODULE_ONLY_NAMES,
  MOTION_RECIPE_MIN,
  motionRecipeLiterals,
  OPT_IN_MODULES,
  PENDING_FLAT_EXPORTS,
  probeIncludes,
  probeSizeBudget,
  probeTreeShaking,
  removeWorkDir,
  REQUIRED_DECLARATIONS,
  runScript,
  undocumentedComponents,
  VALUE_AND_TYPE_DECLARATIONS,
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

/** A correct preserveModules dist: Button, a Card and a Dialog compound, a hook and `cn`. */
function goodFiles() {
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
    const esm =
      `${DIRECTIVE}import { cn } from '../../lib/cn.mjs';\n` +
      (constant ? `import { ${constant} } from '../../lib/classNames.mjs';\n` : '') +
      `function ${name}Root(props) { return cn(${classes}, props && props.className); }\n` +
      `${name}Root.displayName = '${name}';\n${parts.join('')}${assign}` +
      (members.length ? `export { ${members.map((member) => name + member).join(', ')} };\n` : '');
    const cjs =
      `${DIRECTIVE}const { cn } = require('../../lib/cn.cjs');\n` +
      (constant ? `const { ${constant} } = require('../../lib/classNames.cjs');\n` : '') +
      `function ${name}Root(props) { return cn(${classes}, props && props.className); }\n` +
      `${name}Root.displayName = '${name}';\n${parts.join('')}` +
      `exports.${name} = Object.assign(${name}Root, { ${members
        .map((member) => `${member}: ${name}${member}`)
        .join(', ')} });\n` +
      members.map((member) => `exports.${name}${member} = ${name}${member};\n`).join('');
    return { esm, cjs };
  };
  const button = component('Button', [], 'buttonClassNames');
  // Field and InfoButton (0.9): Field reaches no InfoButton code, so an import of only Field
  // drops the InfoButton module.
  const field = component('Field');
  const infoButton = component('InfoButton', [], 'infoButtonClassNames');
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
  // 0.8 (INTEGRATION): the opt-in color parts, the server-safe color helpers and toaster handle,
  // and a Toaster on the presence core.
  const colorPart = (name) => ({
    esm:
      `${DIRECTIVE}import { cn } from '../../lib/cn.mjs';\n` +
      "import { hsvToHex } from '../../lib/color.mjs';\n" +
      `function ${name}(props) { return cn('${name.toLowerCase()}', hsvToHex(props.value)); }\n` +
      `${name}.displayName = '${name}';\nexport { ${name} };\n`,
    cjs:
      `${DIRECTIVE}const { cn } = require('../../lib/cn.cjs');\n` +
      "const { hsvToHex } = require('../../lib/color.cjs');\n" +
      `function ${name}(props) { return cn('${name.toLowerCase()}', hsvToHex(props.value)); }\n` +
      `${name}.displayName = '${name}';\nexports.${name} = ${name};\n`,
  });
  const colorArea = colorPart('ColorArea');
  const colorSlider = colorPart('ColorSlider');
  const alphaSlider = colorPart('AlphaSlider');
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
  const toaster = {
    esm:
      `${DIRECTIVE}import { jsx } from 'react/jsx-runtime';\n` +
      "import { usePresence } from '../../hooks/usePresence.mjs';\n" +
      "function Toaster(props) { const { isMounted, phase } = usePresence(true); return isMounted ? jsx('div', { role: 'region', 'data-presence': phase, children: props.children }) : null; }\n" +
      "Toaster.displayName = 'Toaster';\nexport { Toaster };\n",
    cjs:
      `${DIRECTIVE}const jsxRuntime = require('react/jsx-runtime');\n` +
      "const hook = require('../../hooks/usePresence.cjs');\n" +
      "function Toaster(props) { const { isMounted, phase } = hook.usePresence(true); return isMounted ? jsxRuntime.jsx('div', { role: 'region', 'data-presence': phase, children: props.children }) : null; }\n" +
      "Toaster.displayName = 'Toaster';\nexports.Toaster = Toaster;\n",
  };
  // 0.10 (INTEGRATION): the server-safe date helpers, the listbox core (a hook, Option, Listbox,
  // Dropdown) and a Calendar that holds none of it.
  const dateHelpers =
    'function addDays(date, days) { const next = new Date(date.getTime()); next.setDate(next.getDate() + days); return next; }\n';
  const useActiveDescendant = {
    esm: `${DIRECTIVE}import { useState } from 'react';\nexport function useActiveDescendant() { return useState(null); }\n`,
    cjs: `${DIRECTIVE}const react = require('react');\nexports.useActiveDescendant = function useActiveDescendant() { return react.useState(null); };\n`,
  };
  const useListbox = {
    esm: `${DIRECTIVE}import { useState } from 'react';\nexport function useListbox() { return useState(null); }\n`,
    cjs: `${DIRECTIVE}const react = require('react');\nexports.useListbox = function useListbox() { return react.useState(null); };\n`,
  };
  const option = {
    esm: `${DIRECTIVE}function Option() { return null; }\nOption.displayName = 'Option';\nexport { Option };\n`,
    cjs: `${DIRECTIVE}function Option() { return null; }\nOption.displayName = 'Option';\nexports.Option = Option;\n`,
  };
  const listboxUser = (name) => ({
    esm:
      `${DIRECTIVE}import { useListbox } from '../../hooks/useListbox.mjs';\n` +
      "import { Option } from './Option.mjs';\n" +
      `function ${name}() { useListbox(); return Option(); }\n${name}.displayName = '${name}';\nexport { ${name} };\n`,
    cjs:
      `${DIRECTIVE}const hook = require('../../hooks/useListbox.cjs');\n` +
      "const option = require('./Option.cjs');\n" +
      `function ${name}() { hook.useListbox(); return option.Option(); }\n${name}.displayName = '${name}';\nexports.${name} = ${name};\n`,
  });
  const listbox = listboxUser('Listbox');
  const dropdown = listboxUser('Dropdown');
  const calendar = {
    esm:
      `${DIRECTIVE}import { cn } from '../../lib/cn.mjs';\n` +
      "import { addDays } from '../../lib/date.mjs';\n" +
      "function Calendar(props) { return cn('calendar', String(addDays(props.value, 1))); }\n" +
      "Calendar.displayName = 'Calendar';\nexport { Calendar };\n",
    cjs:
      `${DIRECTIVE}const { cn } = require('../../lib/cn.cjs');\n` +
      "const { addDays } = require('../../lib/date.cjs');\n" +
      "function Calendar(props) { return cn('calendar', String(addDays(props.value, 1))); }\n" +
      "Calendar.displayName = 'Calendar';\nexports.Calendar = Calendar;\n",
  };
  // src/lib/dev.ts reads the bundler-injected mode at call time.
  const dev = (exportSyntax) =>
    `function isDevEnvironment() {\n  try {\n    return process.env.NODE_ENV !== "production";\n  } catch {\n    return true;\n  }\n}\n${exportSyntax}`;
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
          'dist/lib/cn.cjs':
            "exports.cn = function cn(...inputs) { return inputs.filter(Boolean).join(' '); };\n",
          'dist/lib/classNames.mjs':
            "export const buttonClassNames = { root: 'wave-button', icon: 'wave-button__icon' };\n" +
            "export const dialogContentClassNames = { root: 'wave-dialog-content', body: 'wave-dialog-content__body' };\n" +
            "export const infoButtonClassNames = { root: 'wave-info-button', info: 'wave-info-button__info' };\n",
          'dist/lib/classNames.cjs':
            "exports.buttonClassNames = { root: 'wave-button', icon: 'wave-button__icon' };\n" +
            "exports.dialogContentClassNames = { root: 'wave-dialog-content', body: 'wave-dialog-content__body' };\n" +
            "exports.infoButtonClassNames = { root: 'wave-info-button', info: 'wave-info-button__info' };\n",
          'dist/lib/dev.mjs': dev('export const isDev = isDevEnvironment();\n'),
          'dist/lib/dev.cjs': dev('exports.isDev = isDevEnvironment();\n'),
          'dist/hooks/useThing.mjs': `${DIRECTIVE}import { useState } from 'react';\nexport function useThing() { return useState(0); }\n`,
          'dist/hooks/useThing.cjs': `${DIRECTIVE}const react = require('react');\nexports.useThing = function useThing() { return react.useState(0); };\n`,
          'dist/components/button/Button.mjs': button.esm,
          'dist/components/button/Button.cjs': button.cjs,
          'dist/components/input/Field.mjs': field.esm,
          'dist/components/input/Field.cjs': field.cjs,
          'dist/components/data-display/InfoButton.mjs': infoButton.esm,
          'dist/components/data-display/InfoButton.cjs': infoButton.cjs,
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
          'dist/components/input/ColorArea.mjs': colorArea.esm,
          'dist/components/input/ColorArea.cjs': colorArea.cjs,
          'dist/components/input/ColorSlider.mjs': colorSlider.esm,
          'dist/components/input/ColorSlider.cjs': colorSlider.cjs,
          'dist/components/input/AlphaSlider.mjs': alphaSlider.esm,
          'dist/components/input/AlphaSlider.cjs': alphaSlider.cjs,
          'dist/components/feedback/Toaster.mjs': toaster.esm,
          'dist/components/feedback/Toaster.cjs': toaster.cjs,
          'dist/lib/date.mjs': `${dateHelpers}export { addDays };\n`,
          'dist/lib/date.cjs': `${dateHelpers}exports.addDays = addDays;\n`,
          'dist/hooks/useActiveDescendant.mjs': useActiveDescendant.esm,
          'dist/hooks/useActiveDescendant.cjs': useActiveDescendant.cjs,
          'dist/hooks/useListbox.mjs': useListbox.esm,
          'dist/hooks/useListbox.cjs': useListbox.cjs,
          'dist/components/input/Option.mjs': option.esm,
          'dist/components/input/Option.cjs': option.cjs,
          'dist/components/input/Listbox.mjs': listbox.esm,
          'dist/components/input/Listbox.cjs': listbox.cjs,
          'dist/components/input/Dropdown.mjs': dropdown.esm,
          'dist/components/input/Dropdown.cjs': dropdown.cjs,
          'dist/components/input/Calendar.mjs': calendar.esm,
          'dist/components/input/Calendar.cjs': calendar.cjs,
          'dist/lib/color.mjs': `${colorHelpers}export { hsvToHex, hexToHsv };\n`,
          'dist/lib/color.cjs': `${colorHelpers}exports.hsvToHex = hsvToHex;\nexports.hexToHsv = hexToHsv;\n`,
          'dist/lib/toaster.mjs': `${toasterHandle}export { createToaster };\n`,
          'dist/lib/toaster.cjs': `${toasterHandle}exports.createToaster = createToaster;\n`,
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
          'dist/index.cjs':
            "Object.defineProperty(exports, '__esModule', { value: true });\n" +
            "const cn = require('./lib/cn.cjs');\n" +
            "const classNames = require('./lib/classNames.cjs');\n" +
            "const hook = require('./hooks/useThing.cjs');\n" +
            "const button = require('./components/button/Button.cjs');\n" +
            "const field = require('./components/input/Field.cjs');\n" +
            "const infoButton = require('./components/data-display/InfoButton.cjs');\n" +
            "const card = require('./components/layout/Card.cjs');\n" +
            "const dialog = require('./components/overlays/Dialog.cjs');\n" +
            "const presenceHook = require('./hooks/usePresence.cjs');\n" +
            "const presence = require('./components/motion/Presence.cjs');\n" +
            "const menu = require('./components/navigation/Menu.cjs');\n" +
            "const color = require('./lib/color.cjs');\n" +
            "const toasterHandle = require('./lib/toaster.cjs');\n" +
            "const colorArea = require('./components/input/ColorArea.cjs');\n" +
            "const colorSlider = require('./components/input/ColorSlider.cjs');\n" +
            "const alphaSlider = require('./components/input/AlphaSlider.cjs');\n" +
            "const toaster = require('./components/feedback/Toaster.cjs');\n" +
            "const date = require('./lib/date.cjs');\n" +
            "const activeDescendant = require('./hooks/useActiveDescendant.cjs');\n" +
            "const listbox = require('./components/input/Listbox.cjs');\n" +
            "const dropdown = require('./components/input/Dropdown.cjs');\n" +
            "const calendar = require('./components/input/Calendar.cjs');\n" +
            'exports.cn = cn.cn;\nexports.useThing = hook.useThing;\nexports.Button = button.Button;\n' +
            'exports.Field = field.Field;\nexports.InfoButton = infoButton.InfoButton;\n' +
            'exports.buttonClassNames = classNames.buttonClassNames;\n' +
            'exports.dialogContentClassNames = classNames.dialogContentClassNames;\n' +
            'exports.infoButtonClassNames = classNames.infoButtonClassNames;\n' +
            'exports.Card = card.Card;\nexports.CardHeader = card.CardHeader;\n' +
            'exports.Dialog = dialog.Dialog;\nexports.DialogTrigger = dialog.DialogTrigger;\n' +
            'exports.DialogContent = dialog.DialogContent;\n' +
            'exports.usePresence = presenceHook.usePresence;\nexports.Presence = presence.Presence;\n' +
            'exports.Menu = menu.Menu;\n' +
            'exports.hsvToHex = color.hsvToHex;\nexports.hexToHsv = color.hexToHsv;\n' +
            'exports.createToaster = toasterHandle.createToaster;\n' +
            'exports.ColorArea = colorArea.ColorArea;\nexports.ColorSlider = colorSlider.ColorSlider;\n' +
            'exports.AlphaSlider = alphaSlider.AlphaSlider;\nexports.Toaster = toaster.Toaster;\n' +
            'exports.addDays = date.addDays;\nexports.useActiveDescendant = activeDescendant.useActiveDescendant;\n' +
            'exports.Listbox = listbox.Listbox;\nexports.Dropdown = dropdown.Dropdown;\n' +
            'exports.Calendar = calendar.Calendar;\n',
          'dist/index.d.ts': DTS,
          'dist/index.d.cts': DTS,
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
 * The ESM and CommonJS code of the 0.11 module `path` with `spec` (see PHASE6_MODULES). Every
 * module starts with `"use client"`; a hook calls its uses, a component calls them in its render
 * (`function X(props) { … }`), so an import of the component keeps them.
 */
function phase6Module(path, spec) {
  const rel = (target, ext) => {
    const relative = posix.relative(posix.dirname(path), target);
    return `${relative.startsWith('.') ? relative : `./${relative}`}.${ext}`;
  };
  const imports = [];
  if (!spec.hook) imports.push(['lib/cn', 'cn']);
  if (spec.constant) imports.push(['lib/classNames', spec.constant]);
  for (const use of spec.uses ?? []) imports.push(use);
  if (spec.root) imports.push(spec.root);
  for (const [, module, name] of spec.members ?? []) if (module) imports.push([module, name]);
  const esmImports = imports
    .map(([module, name]) => `import { ${name} } from '${rel(module, 'mjs')}';\n`)
    .join('');
  const cjsImports = imports
    .map(([module, name]) => `const { ${name} } = require('${rel(module, 'cjs')}');\n`)
    .join('');
  const calls = (spec.uses ?? []).map(([, name]) => `${name}(props); `).join('');
  if (spec.hook) {
    const body = `function ${spec.hook}(props) { ${calls}return null; }\n`;
    return {
      esm: `${DIRECTIVE}${esmImports}export ${body}`,
      cjs: `${DIRECTIVE}${cjsImports}${body}exports.${spec.hook} = ${spec.hook};\n`,
    };
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
  return {
    esm:
      `${DIRECTIVE}${esmImports}${code}export const ${name} = ${assign};\n` +
      flat.map(([as, from]) => `export { ${from === as ? as : `${from} as ${as}`} };\n`).join(''),
    cjs:
      `${DIRECTIVE}${cjsImports}${code}exports.${name} = ${assign};\n` +
      flat.map(([as, from]) => `exports.${as} = ${from};\n`).join(''),
  };
}

/** `code` (a module of the fixture) importing `name` from `target` and calling it in its render. */
function withCall(code, path, target, name, ext = 'mjs') {
  const relative = posix.relative(posix.dirname(path), target);
  const specifier = `${relative.startsWith('.') ? relative : `./${relative}`}.${ext}`;
  const line =
    ext === 'mjs'
      ? `import { ${name} } from '${specifier}';\n`
      : `const { ${name} } = require('${specifier}');\n`;
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
    result[`dist/${path}.cjs`] = `${directive}exports.${name} = function ${name}() { ${body} };\n`;
  }
  result['dist/hooks/useFocusableGroup.mjs'] =
    `${DIRECTIVE}import { getFirstTabbable } from '../lib/focus.mjs';\n` +
    'export function useFocusableGroup() { return { first: getFirstTabbable }; }\n';
  result['dist/hooks/useFocusableGroup.cjs'] =
    `${DIRECTIVE}const { getFirstTabbable } = require('../lib/focus.cjs');\n` +
    'exports.useFocusableGroup = function useFocusableGroup() { return { first: getFirstTabbable }; };\n';
  result['dist/hooks/useModalOpen.mjs'] =
    `${DIRECTIVE}import { hasOpenModal } from '../lib/layers.mjs';\n` +
    'export function useModalOpen() { return hasOpenModal(); }\n';
  result['dist/hooks/useModalOpen.cjs'] =
    `${DIRECTIVE}const { hasOpenModal } = require('../lib/layers.cjs');\n` +
    'exports.useModalOpen = function useModalOpen() { return hasOpenModal(); };\n';
  result['dist/components/overlays/Popover.mjs'] =
    `${DIRECTIVE}function Popover() { return null; }\nPopover.displayName = 'Popover';\nexport { Popover };\n`;
  result['dist/components/overlays/Popover.cjs'] =
    `${DIRECTIVE}function Popover() { return null; }\nPopover.displayName = 'Popover';\nexports.Popover = Popover;\n`;
  result['dist/index.mjs'] +=
    "export { useFocusVisible } from './hooks/useFocusVisible.mjs';\n" +
    "export { useFocusableGroup } from './hooks/useFocusableGroup.mjs';\n" +
    "export { usePopupPosition } from './hooks/usePopupPosition.mjs';\n" +
    "export { useModalOpen } from './hooks/useModalOpen.mjs';\n" +
    "export { getFirstTabbable } from './lib/focus.mjs';\n";
  result['dist/index.cjs'] +=
    "const phase7Focus = require('./hooks/useFocusVisible.cjs');\n" +
    "const phase7Group = require('./hooks/useFocusableGroup.cjs');\n" +
    "const phase7Position = require('./hooks/usePopupPosition.cjs');\n" +
    "const phase7ModalOpen = require('./hooks/useModalOpen.cjs');\n" +
    "const phase7Tabbable = require('./lib/focus.cjs');\n" +
    'exports.useFocusVisible = phase7Focus.useFocusVisible;\n' +
    'exports.useFocusableGroup = phase7Group.useFocusableGroup;\n' +
    'exports.usePopupPosition = phase7Position.usePopupPosition;\n' +
    'exports.useModalOpen = phase7ModalOpen.useModalOpen;\n' +
    'exports.getFirstTabbable = phase7Tabbable.getFirstTabbable;\n';
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
  result['dist/lib/initials.cjs'] =
    'exports.getInitials = function getInitials(name) { return name.slice(0, 1); };\n';
  result['dist/components/data-display/AvatarGroup.partition.mjs'] =
    `${DIRECTIVE}export function partitionAvatarGroupItems(options) { return { inlineItems: options.items, overflowItems: undefined }; }\n`;
  result['dist/components/data-display/AvatarGroup.partition.cjs'] =
    `${DIRECTIVE}exports.partitionAvatarGroupItems = function partitionAvatarGroupItems(options) { return { inlineItems: options.items, overflowItems: undefined }; };\n`;
  for (const name of ['Avatar', 'AvatarGroup', 'Persona']) {
    result[`dist/components/data-display/${name}.mjs`] =
      `${DIRECTIVE}import { createElement } from 'react';\nfunction ${name}() { return createElement('span'); }\n${name}.displayName = '${name}';\nexport { ${name} };\n`;
    result[`dist/components/data-display/${name}.cjs`] =
      `${DIRECTIVE}const { createElement } = require('react');\nfunction ${name}() { return createElement('span'); }\n${name}.displayName = '${name}';\nexports.${name} = ${name};\n`;
  }
  result['dist/index.mjs'] +=
    "export { getInitials } from './lib/initials.mjs';\n" +
    "export { partitionAvatarGroupItems } from './components/data-display/AvatarGroup.partition.mjs';\n";
  result['dist/index.cjs'] +=
    "const phase8Initials = require('./lib/initials.cjs');\n" +
    "const phase8Partition = require('./components/data-display/AvatarGroup.partition.cjs');\n" +
    'exports.getInitials = phase8Initials.getInitials;\n' +
    'exports.partitionAvatarGroupItems = phase8Partition.partitionAvatarGroupItems;\n';
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
 * before them (an import). Every helper is exported in both formats.
 */
function breadcrumbModule(body, head = { esm: '', cjs: '' }) {
  const helpers = BREADCRUMB_HELPERS.map((name) => `function ${name}() { ${body(name)} }\n`).join(
    '',
  );
  return {
    esm: `${head.esm}${helpers}export { ${BREADCRUMB_HELPERS.join(', ')} };\n`,
    cjs: `${head.cjs}${helpers}${BREADCRUMB_HELPERS.map((name) => `exports.${name} = ${name};\n`).join('')}`,
  };
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
  result['dist/lib/table.cjs'] = `${table}exports.createTableColumn = createTableColumn;\n`;
  const breadcrumb = breadcrumbModule(() => 'return null;');
  result['dist/lib/breadcrumb.mjs'] = breadcrumb.esm;
  result['dist/lib/breadcrumb.cjs'] = breadcrumb.cjs;
  for (const [path, name] of [
    ['components/table/DataGrid', 'DataGrid'],
    ['components/table/Table', 'Table'],
    ['components/table/Table.shared', 'TableSelectionControl'],
    ['components/navigation/Breadcrumb', 'Breadcrumb'],
    ['components/layout/Overflow', 'Overflow'],
  ]) {
    result[`dist/${path}.mjs`] =
      `${DIRECTIVE}import { createElement } from 'react';\nfunction ${name}() { return createElement('div'); }\n${name}.displayName = '${name}';\nexport { ${name} };\n`;
    result[`dist/${path}.cjs`] =
      `${DIRECTIVE}const { createElement } = require('react');\nfunction ${name}() { return createElement('div'); }\n${name}.displayName = '${name}';\nexports.${name} = ${name};\n`;
  }
  result['dist/index.mjs'] +=
    "export { createTableColumn } from './lib/table.mjs';\n" +
    `export { ${BREADCRUMB_HELPERS.join(', ')} } from './lib/breadcrumb.mjs';\n`;
  result['dist/index.cjs'] +=
    "const phase9Table = require('./lib/table.cjs');\n" +
    "const phase9Breadcrumb = require('./lib/breadcrumb.cjs');\n" +
    'exports.createTableColumn = phase9Table.createTableColumn;\n' +
    BREADCRUMB_HELPERS.map((name) => `exports.${name} = phase9Breadcrumb.${name};\n`).join('');
  return result;
}

function withPhase6Modules(files) {
  const result = { ...files };
  for (const [path, spec] of Object.entries(PHASE6_MODULES)) {
    const { esm, cjs } = phase6Module(path, spec);
    result[`dist/${path}.mjs`] = esm;
    result[`dist/${path}.cjs`] = cjs;
  }
  const constants = Object.entries(PHASE6_CLASS_NAMES);
  result['dist/lib/classNames.mjs'] += constants
    .map(([name, root]) => `export const ${name} = { root: '${root}' };\n`)
    .join('');
  result['dist/lib/classNames.cjs'] += constants
    .map(([name, root]) => `exports.${name} = { root: '${root}' };\n`)
    .join('');
  const publicModules = Object.entries(PHASE6_MODULES).filter(([, spec]) => spec.exports);
  result['dist/index.mjs'] +=
    `export { ${constants.map(([name]) => name).join(', ')} } from './lib/classNames.mjs';\n` +
    publicModules
      .map(([path, spec]) => `export { ${spec.exports.join(', ')} } from './${path}.mjs';\n`)
      .join('');
  result['dist/index.cjs'] +=
    constants.map(([name]) => `exports.${name} = classNames.${name};\n`).join('') +
    publicModules
      .map(
        ([path, spec], i) =>
          `const phase6Module${i} = require('./${path}.cjs');\n` +
          spec.exports.map((name) => `exports.${name} = phase6Module${i}.${name};\n`).join(''),
      )
      .join('');
  for (const ext of ['mjs', 'cjs']) {
    const path = `dist/components/overlays/Dialog.${ext}`;
    result[path] = withCall(
      withCall(files[path], 'components/overlays/Dialog', 'hooks/usePresence', 'usePresence', ext),
      'components/overlays/Dialog',
      'components/overlays/Dialog.shared',
      'useModalOpenState',
      ext,
    );
  }
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
      "index.d.ts does not declare and export cn, Button, ButtonProps, Menu, usePresence, useActiveDescendant, Calendar, TagGroup, NavDrawer, buttonClassNames (an empty or partial roll-up: check tsconfig.json's rootDir and the declaration plugin in vite.config.ts)",
      "index.d.cts does not declare and export cn, Button, ButtonProps, Menu, usePresence, useActiveDescendant, Calendar, TagGroup, NavDrawer, buttonClassNames (an empty or partial roll-up: check tsconfig.json's rootDir and the declaration plugin in vite.config.ts)",
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
        /^index\.d\.cts does not declare and export cn, Button, ButtonProps, Menu, usePresence, useActiveDescendant, Calendar, TagGroup, NavDrawer, buttonClassNames \(/,
      ),
    ]);
  });

  it('takes the required names as an option', () => {
    expect(checkDeclarations(fixture().dist, { requiredDeclarations: ['cn', 'Card'] })).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export Card \(/),
      expect.stringMatching(/^index\.d\.cts does not declare and export Card \(/),
    ]);
    const empty = fixture({ 'dist/index.d.ts': EMPTY_ROLL_UP, 'dist/index.d.cts': EMPTY_ROLL_UP });
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

  // Two checks, each loading the fixture in two child Node.js processes: slow under load (the
  // parallel gate, a CI runner), hence the timeout.
  it('reports a cn that is missing or returns the wrong value', async () => {
    expect(await checkServerImport(fixture({ 'dist/lib/cn.cjs': null }).dist)).toEqual([
      expect.stringContaining('lib/cn.cjs'),
    ]);
    expect(
      await checkServerImport(
        fixture({ 'dist/lib/cn.mjs': 'export function cn() { return 1; }\n' }).dist,
      ),
    ).toEqual([expect.stringContaining('lib/cn.mjs')]);
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);
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
  }, 30_000);

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
  }, 30_000);

  it('reports a probe module that dist lacks', async () => {
    const { dist } = fixture();
    rmSync(join(dist, 'components/overlays/Popover.mjs'));
    const { errors } = await verifyDist(dist, noPending);
    expect(
      errors.some((error) =>
        /Popover\.mjs, listed for the hook .* does not exist in dist/.test(error),
      ),
    ).toBe(true);
  }, 30_000);
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
  }, 30_000);

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
  }, 30_000);

  it('reports a helper module that dist lacks', async () => {
    const { dist } = fixture();
    rmSync(join(dist, 'components/data-display/Persona.mjs'));
    const { errors } = await verifyDist(dist, noPending);
    expect(
      errors.some((error) =>
        /Persona\.mjs, listed for the hook .* does not exist in dist/.test(error),
      ),
    ).toBe(true);
  }, 30_000);
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
  }, 30_000);

  it('probes each breadcrumb helper on its own', async () => {
    const { esm } = breadcrumbModule(() => 'return Breadcrumb.displayName;', {
      esm: "import { Breadcrumb } from '../components/navigation/Breadcrumb.mjs';\n",
      cjs: '',
    });
    const { dist } = fixture({ 'dist/lib/breadcrumb.mjs': esm });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      BREADCRUMB_HELPERS.flatMap((name) => [
        `components/navigation/Breadcrumb.mjs is in the bundle of an import of only ${name}`,
        `the bundle of an import of only ${name} imports react`,
      ]),
    );
  }, 30_000);

  it('reports a breadcrumb helper whose bundle holds the Overflow the Breadcrumb is built on', async () => {
    const { esm } = breadcrumbModule(
      (name) =>
        name === 'truncateBreadcrumbLongTooltip' ? 'return Overflow.displayName;' : 'return null;',
      { esm: "import { Overflow } from '../components/layout/Overflow.mjs';\n", cjs: '' },
    );
    const { dist } = fixture({ 'dist/lib/breadcrumb.mjs': esm });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'components/layout/Overflow.mjs is in the bundle of an import of only truncateBreadcrumbLongTooltip',
      'the bundle of an import of only truncateBreadcrumbLongTooltip imports react',
    ]);
  }, 30_000);

  it('reports every helper of a module that imports a React module', async () => {
    // One helper uses React; the bundler keeps the external import for the others too.
    const { esm } = breadcrumbModule(
      (name) =>
        name === 'partitionBreadcrumbItems' ? 'return React.useState(0);' : 'return null;',
      { esm: "import * as React from 'react';\n", cjs: '' },
    );
    const { dist } = fixture({ 'dist/lib/breadcrumb.mjs': esm });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      BREADCRUMB_HELPERS.map((name) => `the bundle of an import of only ${name} imports react`),
    );
  }, 30_000);

  it('reports a helper module that dist lacks', async () => {
    const { dist } = fixture();
    rmSync(join(dist, 'components/table/Table.shared.mjs'));
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toContain(
      'components/table/Table.shared.mjs, listed for the hook createTableColumn, does not exist in dist',
    );
  }, 30_000);
});

describe('checkServerImport: the 0.8 server-safe modules (INTEGRATION)', () => {
  it('reads the color helpers and createToaster from lib and from the entry', async () => {
    expect(await checkServerImport(fixture().dist)).toEqual([]);
  }, 30_000);

  it('reports a missing color or toaster module', async () => {
    const errors = await checkServerImport(
      fixture({ 'dist/lib/color.mjs': null, 'dist/lib/toaster.cjs': null }).dist,
    );
    expect(errors).toEqual(['lib/color.mjs is missing', 'lib/toaster.cjs is missing']);
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
  }, 30_000);

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
  }, 30_000);

  it('reports a missing lib/date module', async () => {
    const errors = await checkServerImport(fixture({ 'dist/lib/date.cjs': null }).dist);
    expect(errors).toEqual(['lib/date.cjs is missing']);
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
      expect(
        checkDeclarations(fixture({ 'dist/index.d.ts': dts, 'dist/index.d.cts': dts }).dist),
      ).toEqual([
        expect.stringMatching(
          new RegExp(`^index\\.d\\.ts does not declare and export ${name} \\(`),
        ),
        expect.stringMatching(
          new RegExp(`^index\\.d\\.cts does not declare and export ${name} \\(`),
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
      }).esm,
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
      }).esm,
    }),
    NavDrawer: () => ({
      'dist/components/navigation/NavDrawer.mjs': phase6Module('components/navigation/NavDrawer', {
        ...PHASE6_MODULES['components/navigation/NavDrawer'],
        uses: [],
      }).esm,
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
  }, 30_000);

  it('verifyDist runs the inclusion probes', async () => {
    const { dist } = fixture(INCLUSION_DEFECTS.NavDrawer());
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual(
      INCLUSION_PROBES_0_11[3].modules.map(
        (path) => `${path} is not in the bundle of an import of only NavDrawer`,
      ),
    );
  }, 30_000);
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
      'dist/index.cjs': `${files['dist/index.cjs']}exports.useToolbarNavigation = require('./components/button/Toolbar.navigation.cjs').useToolbarNavigation;\n`,
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'dist/index.mjs exports useToolbarNavigation, which is module-only (keep it out of the barrels)',
    ]);
  }, 30_000);
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
    expect(
      checkDeclarations(fixture({ 'dist/index.d.ts': dts, 'dist/index.d.cts': dts }).dist),
    ).toEqual([
      'index.d.ts does not export TagPickerOption both as a type and as a value (the interface and the component of one name: export the name once, without `type`, from the barrel)',
      'index.d.cts does not export TagPickerOption both as a type and as a value (the interface and the component of one name: export the name once, without `type`, from the barrel)',
    ]);
  });
});

describe('the class-name registry (P3-00)', () => {
  it('requires the class-name constants in the roll-up (buttonClassNames)', () => {
    expect(REQUIRED_DECLARATIONS).toContain('buttonClassNames');
    const dts = DTS.replace(/^export declare const buttonClassNames.*\n/m, '');
    expect(
      checkDeclarations(fixture({ 'dist/index.d.ts': dts, 'dist/index.d.cts': dts }).dist),
    ).toEqual([
      expect.stringMatching(/^index\.d\.ts does not declare and export buttonClassNames \(/),
      expect.stringMatching(/^index\.d\.cts does not declare and export buttonClassNames \(/),
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
  });

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
  });

  it('passes when the entry exports every class-name constant with the same value, in both formats', async () => {
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
      'dist/index.cjs': files['dist/index.cjs'].replace(
        'exports.buttonClassNames = classNames.buttonClassNames;',
        "exports.buttonClassNames = { root: 'wave-button' };",
      ),
    });
    expect(await checkClassNameExports(dist)).toEqual([
      'index.cjs exports buttonClassNames with another value than lib/classNames.cjs',
    ]);
  });

  it('reports a missing registry module', async () => {
    expect(await checkClassNameExports(fixture({ 'dist/lib/classNames.cjs': null }).dist)).toEqual([
      'lib/classNames.cjs is missing (the class-name registry, src/lib/classNames.ts)',
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
 * The motion recipes of the fixture (spec §2.10, D23): two recipe literals and a record of
 * durations (the drawer durations hold no presence variant, no transition and no animation).
 */
const MOTION_RECIPES = {
  dialogMotion:
    'transition-[opacity,scale] duration-wave-gentle ease-wave-decelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
  dialogBackdropMotion:
    'transition-opacity duration-wave-gentle ease-wave-easy-ease motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0',
};
const MOTION_DURATIONS = { small: 'duration-wave-gentle', large: 'duration-wave-slow' };
/** The literals `motionRecipeLiterals` reads from the fixture: exports by name, records by key. */
const MOTION_LITERALS = [
  MOTION_RECIPES.dialogBackdropMotion,
  MOTION_RECIPES.dialogMotion,
  MOTION_DURATIONS.small,
  MOTION_DURATIONS.large,
];

/**
 * A fixture `lib/motion.mjs`: the recipes, the durations, `extra` exports and the resolver, whose
 * own literal holds the presence-variant text, as the real module's does.
 */
function motionModule(extra = '') {
  return (
    "const PRESENCE_VARIANT = '[presence=';\n" +
    Object.entries(MOTION_RECIPES)
      .map(([name, value]) => `export const ${name} = '${value}';\n`)
      .join('') +
    `export const drawerDurations = ${JSON.stringify(MOTION_DURATIONS)};\n` +
    extra +
    'export function resolveMotion(slot, recipe, preference, legacyClassName) {\n' +
    "  if (slot === null) return '';\n" +
    "  if (slot !== undefined) return typeof slot === 'string' ? slot : slot.className;\n" +
    "  if (preference === 'none') return '';\n" +
    "  if (legacyClassName !== undefined && legacyClassName.includes(PRESENCE_VARIANT)) return '';\n" +
    '  return recipe;\n' +
    '}\n'
  );
}

/**
 * The good files with the motion modules: `lib/motion`, `hooks/useMotion` on it, and a Dialog
 * that resolves its recipe through both (an import of only Dialog holds them), then `overrides`.
 */
function motionFixture(overrides = {}) {
  const files = goodFiles();
  const dialog = 'dist/components/overlays/Dialog.mjs';
  return fixture({
    'dist/lib/motion.mjs': motionModule(),
    'dist/hooks/useMotion.mjs':
      `${DIRECTIVE}import { resolveMotion } from '../lib/motion.mjs';\n` +
      "export function useMotionClasses(slot, recipe) { return resolveMotion(slot, recipe, 'default'); }\n",
    [dialog]: files[dialog]
      .replace(
        DIRECTIVE,
        `${DIRECTIVE}import { dialogMotion } from '../../lib/motion.mjs';\n` +
          "import { useMotionClasses } from '../../hooks/useMotion.mjs';\n",
      )
      .replace(
        /function \w+\(props\) \{ /,
        (match) => `${match}useMotionClasses(props.motion, dialogMotion); `,
      ),
    ...overrides,
  });
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

  it('defaults to a non-negative minimum', () => {
    expect(Number.isInteger(MOTION_RECIPE_MIN) && MOTION_RECIPE_MIN >= 0).toBe(true);
  });

  it('reports fewer literals than the minimum', async () => {
    const { dist } = motionFixture();
    expect((await motionRecipeLiterals(dist, { min: 5 })).errors).toEqual([
      'lib/motion.mjs holds 4 recipe literals, fewer than the minimum of 5',
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

  it('reports a dist without lib/motion.mjs (the probe would pass vacuously)', async () => {
    expect(await motionRecipeLiterals(fixture().dist, { min: 0 })).toEqual({
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
  });
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
    expect(
      await probeIncludes(motionFixture().dist, {
        ...dialogMotion,
        strings: [MOTION_RECIPES.dialogBackdropMotion, 'data-[presence=exiting]:opacity-0'],
      }),
    ).toEqual([
      `the bundle of an import of only Dialog lacks the string "${MOTION_RECIPES.dialogBackdropMotion}"`,
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
  });
});

describe('verifyDist and main', () => {
  // Every test runs the whole check: its probes bundle the fixture with Vite several times and
  // load it in child Node.js processes. That takes about a second alone, and more than Vitest's
  // 5 s default under the parallel gate or on a CI runner, hence the 30 s timeouts.
  it('passes a correct dist', async () => {
    const { dist } = fixture();
    const result = await verifyDist(dist, noPending);
    expect(result.errors).toEqual([]);
  }, 30_000);

  it('runs the class-name checks: a registry constant missing from the entry fails', async () => {
    const files = goodFiles();
    const { dist } = fixture({
      'dist/index.mjs': files['dist/index.mjs'].replace(
        'export { buttonClassNames, dialogContentClassNames }',
        'export { buttonClassNames }',
      ),
      'dist/index.cjs': files['dist/index.cjs'].replace(
        'exports.dialogContentClassNames = classNames.dialogContentClassNames;\n',
        '',
      ),
    });
    const { errors } = await verifyDist(dist, noPending);
    expect(errors).toEqual([
      'index.mjs does not export dialogContentClassNames (a class-name constant of lib/classNames.mjs)',
      'index.cjs does not export dialogContentClassNames (a class-name constant of lib/classNames.cjs)',
    ]);
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

  it('prints the measured presence budget', async () => {
    const lines = [];
    const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    expect(await main(['--dist', fixture().dist, '--no-pending'], io)).toBe(0);
    expect(lines.join('\n')).toMatch(
      /verify-dist: presence core \(usePresence \+ Presence\): \d+ B minified \(budget 6804\), \d+ B gzip \(budget 2927\)/,
    );
  }, 30_000);

  it('exits 0 for a correct dist and 1 otherwise', async () => {
    const quiet = { log: () => {}, error: () => {} };
    expect(await main(['--dist', fixture().dist, '--no-pending'], quiet)).toBe(0);
    expect(
      await main(['--dist', fixture({ 'dist/index.d.cts': null }).dist, '--no-pending'], quiet),
    ).toBe(1);
    expect(await main(['--dist', join(fixtureRoot, 'missing')], quiet)).toBe(1);
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);
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
