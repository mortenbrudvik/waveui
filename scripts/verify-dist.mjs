#!/usr/bin/env node
/**
 * Verifies the library build in `dist/` (spec §3.1; repo-level#2, #3, #4, #5). `npm run build`
 * runs it last, after `vite build` and `scripts/build-css.mjs`.
 *
 * Checks:
 *   - directives: every component and hook module (`dist/components/**`, `dist/hooks/**`, both
 *     formats) starts with `"use client"`; no other file does — not `dist/lib/cn.*`, not
 *     `dist/index.*`, not any `index.*` barrel, not the bundler runtime (repo-level#2);
 *   - declarations: `dist/index.d.ts` and its `dist/index.d.cts` copy for the `require`
 *     condition (repo-level#5); each declares and exports the public names on
 *     {@link REQUIRED_DECLARATIONS} (a class-name constant among them), so an empty roll-up
 *     (only `export { }`) fails the build; every component it exports carries a JSDoc (C-DOCS: a
 *     compound is documented on its `Object.assign` export, which is what the roll-up keeps);
 *   - development mode: `dist/lib/dev.mjs` and `dist/lib/dev.cjs` still read
 *     `process.env.NODE_ENV` at run time, so a consumer's bundler decides between development and
 *     production (a `define` in vite.config.ts would inline the library's own build mode);
 *   - imports: every bare import is a dependency or peer dependency of package.json (or a
 *     subpath of one), relative imports resolve inside `dist/`, no Node.js builtin is imported
 *     and no dependency was bundled into `dist/` (repo-level#4);
 *   - react-server: the package loads in a React Server Component (repo-level#2). A copy of
 *     `dist/` in which every `"use client"` module is replaced by client references (what an RSC
 *     bundler does) is loaded under `node --conditions=react-server`: every other module — the
 *     `index.*` entries, `dist/lib/**`, the bundler runtime — must evaluate (no client-only
 *     React API at module scope, no dotting into a client reference such as `Card.Header`);
 *     `dist/lib/cn.*` must work and `dist/index.*` must export the server-side `cn`;
 *     `dist/lib/color.*` and `dist/lib/toaster.*` must exist and work on the server (the color
 *     helpers convert; a handle's dispatch returns an id and adds no global), and `dist/index.*`
 *     must export `hsvToHex`, `hexToHsv` and `createToaster` from them, not from a client module;
 *     so must the token modules of 0.17 (`dist/lib/tokens.*`, `dist/lib/waveTokens.*`,
 *     `dist/lib/brand.*`: `getTokenStyle` writes the custom properties, `waveTokens` reads them,
 *     `createBrandTokens` gives the default ramp for the default seed), and `dist/index.*` must
 *     export `getTokenStyle`, `createBrandTokens`, `waveTokens` and `chartPalette` from them;
 *   - class names (P3-00): every export of `dist/lib/classNames.*` (the stable class-name
 *     registry) is exported by `dist/index.*` with the same value, in both formats
 *     ({@link checkClassNameExports}); under the react-server condition `dist/index.*` exports
 *     `buttonClassNames` as a plain object whose root is `wave-button`, and every export of
 *     `dist/lib/classNames.*` is an object of strings;
 *   - flat names: every sub-component of a compound export (`Card.Header`) is also exported
 *     from `dist/index.mjs` under its flat name (`CardHeader`), bound to the same component
 *     (C-COMPOUND, repo-level#2) — except the components on {@link PENDING_FLAT_EXPORTS}, a
 *     bridge that closes before publishing (`--final`);
 *   - CommonJS parity: `dist/index.cjs` exports the same names as `dist/index.mjs`;
 *   - tree-shaking: a probe entry importing only `Button` from `dist/index.mjs`, bundled with
 *     Vite's own `build()` API, contains only Button's module and its static imports — no
 *     Dialog code (repo-level#3), and neither the presence core (`hooks/usePresence`) nor
 *     `Presence`. The probe honours package.json `sideEffects` exactly as a consumer's bundler
 *     does. The bundle also keeps Button's class string `'wave-button'` and drops the Dialog
 *     surface's `'wave-dialog-content'` (the registry is tree-shaken per constant; a listed
 *     string that occurs in no module of dist is an error); an import of only `Field` contains
 *     no InfoButton module, so a Field-only bundle never includes InfoButton's overlay code,
 *     nor its class string `'wave-info-button'`;
 *   - presence core: an import of only `Presence` contains `hooks/usePresence` (the probe finds
 *     the core where it is used), and the closure of `usePresence` + `Presence`, minified with
 *     bare imports external, stays within {@link PRESENCE_BUDGET} and imports nothing but
 *     `react` and `react/jsx-runtime`. The CLI prints the measured sizes;
 *   - opt-in modules (0.8): an import of only `Button` contains none of {@link OPT_IN_MODULES}
 *     (the color parts and helpers, the toaster handle), and an import of only `Toaster`
 *     contains `hooks/usePresence`;
 *   - motion (0.15, D23): an import of only `Button` contains neither `lib/motion` nor
 *     `hooks/useMotion`, none of the recipe literals of `dist/lib/motion.mjs` (at least
 *     {@link MOTION_RECIPE_MIN}, the release count, read at run time) and no string with a
 *     presence variant (`[presence=`, matched in a minified bundle, so comments do not count); the
 *     controls of {@link MOTION_INCLUDE_PROBES} prove the same matchers: an import of only `Dialog`
 *     contains both modules, its two recipe literals and the presence variant, one of only
 *     `Accordion` the motion module, the collapse hook and the collapse's two literals, and one of
 *     only `MessageBarGroup` the presence group, the motion module and the bars' three literals;
 *     an import of only `MessageBar` contains neither the presence core nor the presence group
 *     ({@link EXCLUSION_PROBES_0_15}, D21);
 *   - 0.11: the exclusion probes of {@link EXCLUSION_PROBES_0_11} and the inclusion probes of
 *     {@link INCLUSION_PROBES_0_11} (tags, TagPicker, Dialog and Drawer, Nav, Hamburger and
 *     NavDrawer); no name of {@link MODULE_ONLY_NAMES} (the motion internals of 0.15, the
 *     data-scale seams of 0.16 and the token seams of 0.17 among them) is exported from
 *     `dist/index.mjs` or `dist/index.d.ts`; the roll-ups export each of
 *     {@link VALUE_AND_TYPE_DECLARATIONS} both as a type and as a value (`TagPickerOption`);
 *   - 0.16 (spec §11): an import of only `useVirtualWindow` or only `useSelection` holds no
 *     component ({@link HOOK_PROBES_0_16}); an import of only `DataGrid` holds no FlatTree code,
 *     one of only `FlatTree` no DataGrid code, one of only `Button` or only `MessageBar` none of
 *     {@link DATA_SCALE_MODULES} and one of only `Tree` none but the moved cascade
 *     ({@link EXCLUSION_PROBES_0_16}, with the positive controls of {@link INCLUSION_PROBES_0_16});
 *     the closure of `useVirtualWindow`, minified, stays within {@link VIRTUAL_BUDGET} and imports
 *     nothing but `react`, and that of `DataGrid` within {@link DATA_GRID_BUDGET}. The CLI prints
 *     the measured sizes, and those of the imports of {@link RECORDED_IMPORTS} (DataGrid-only,
 *     Tree-only, Button-only, MessageBar-only) against 0.15.0;
 *   - 0.17 (spec §10): an import of only `createBrandTokens` holds the brand generator and no
 *     names tuple, component or React module, and none of the development contrast check of a
 *     full ramp; one of only `waveTokens` the tuple and the token core, and no brand generator,
 *     component or React module ({@link HOOK_PROBES_0_17}); one of only `Dialog` or only `Tree`
 *     holds neither the tuple nor the brand generator (for the Dialog also no fragment of their
 *     code: no token name, no brand warning key), one of only `Button` or only `MessageBar` none of
 *     {@link TOKEN_MODULES} and not the provider ({@link EXCLUSION_PROBES_0_17}, with the positive
 *     controls of {@link INCLUSION_PROBES_0_17}); the imports of {@link RECORDED_IMPORTS_0_17} stay
 *     within their budgets (createBrandTokens-only and waveTokens-only 3 KiB gzip; Button-only,
 *     MessageBar-only, Tree-only, Dialog-only and WaveProvider + Dialog within their allowances over
 *     0.16.0), which the CLI prints with the 0.16.0 sizes; no JavaScript, CSS or declaration file
 *     of dist names a chart library of the stories ({@link DEV_ONLY_LIBRARIES}, R14).
 *
 * Every probe and size bundles as a consumer's production build: `process.env.NODE_ENV` is defined
 * as `"production"` whatever this process has (Vitest runs with `test`), so development-only code
 * is neither seen nor measured.
 *
 * Usage: node scripts/verify-dist.mjs [--dist <dir>] [--no-pending | --final]
 *   --dist        the dist directory (default: dist); its parent holds the package.json
 *   --no-pending  ignore PENDING_FLAT_EXPORTS (every compound must have its flat names)
 *   --final       the publish gate (`prepublishOnly`, final gate of the review-fix spec §7.2):
 *                 like --no-pending, and PENDING_FLAT_EXPORTS itself must be empty
 *
 * The checks are exported and tested by scripts/__tests__/verify-dist.test.mjs; importing the
 * module does not run them.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/**
 * A temporary bridge: components whose flat sub-component names (`<Parent><Member>`,
 * C-COMPOUND) are not exported from `dist/index.mjs` yet. The list is empty: phase 6 (0.11)
 * listed `TagPicker`, `Drawer` and `Nav` until INTEGRATION exported the flat names of their new
 * parts (`TagPickerControl`, `DrawerHeader`, `NavSectionHeader`, …). Phase 5 (0.10) listed `SwatchPicker` until the input
 * barrel exported `SwatchPickerRow`. Phase 2 (0.7) did the same for `Toolbar`, which became a
 * compound (`Toolbar.Button`, …) before the button barrel exported the flat names of its parts,
 * and phase 3 (0.8) for `ColorPicker`, `MessageBar`, `Toast` and `Tree` while their new parts
 * (`Toast.Title`, `MessageBar.Actions`, `ColorPicker.HexField`, `Tree.ItemPersonaLayout`, …)
 * landed before the barrels exported their flat names. A future compound whose parts land before
 * their flat names goes on it the same way. The rules:
 *   - an entry whose flat names all exist fails the check ("remove it"), and so does an entry
 *     that is not an exported component, so the list only shrinks;
 *   - an entry that is exported but not a compound yet is tolerated;
 *   - `--final` (`prepublishOnly`, the final gate) ignores the list and fails while it is not
 *     empty, so no release ships with the bridge open.
 * A compound that is not listed must export every flat name. A flat name that is exported must
 * equal its dotted member, listed or not.
 */
export const PENDING_FLAT_EXPORTS = [];

/**
 * The presence core's probes: an import of only `Button` drops it, an import of only
 * `PRESENCE_INCLUDE_KEEP` holds it, and the closure of the two names fits the budget. The budget
 * is the first measured size plus 25 % (5,443 and 2,341 bytes in 0.7.0, against the 5 KiB and
 * 2 KiB of the phase 2 design, adjusted once as its open question 8 allows).
 */
const PRESENCE_MODULE = 'hooks/usePresence.mjs';
const PRESENCE_INCLUDE_KEEP = 'Menu';
/** An import of only `Field` drops this module: Field imports a marker module, never InfoButton. */
const INFO_BUTTON_MODULE = 'components/data-display/InfoButton.mjs';
const PRESENCE_BUDGET = {
  names: ['usePresence', 'Presence'],
  maxMinifiedBytes: 6804,
  maxGzipBytes: 2927,
  allowedExternals: ['react', 'react/jsx-runtime'],
};

/**
 * Modules an import of only `Button` must not contain (spec D30, 0.8): the color parts, the public
 * color helpers and the toaster handle are opt-in. Each must exist in `dist`, or the probe would
 * pass vacuously. Sorted.
 */
export const OPT_IN_MODULES = [
  'components/input/AlphaSlider.mjs',
  'components/input/ColorArea.mjs',
  'components/input/ColorSlider.mjs',
  'lib/color.mjs',
  'lib/toaster.mjs',
];

/**
 * The exclusion probes of 0.10 (spec D37): an import of only `Calendar` holds no listbox code (the
 * hook, `Option`, `Dropdown`), and an import of only `Listbox` holds no calendar code.
 */
const CALENDAR_ONLY = {
  keep: 'Calendar',
  drop: 'Dropdown',
  dropModules: ['hooks/useListbox.mjs', 'components/input/Option.mjs'],
};
const LISTBOX_ONLY = { keep: 'Listbox', drop: 'Calendar' };

/** An import of only this component holds the presence core (spec D29): its toasts mount on it. */
const TOASTER_INCLUDE_KEEP = 'Toaster';

/**
 * The server-safe modules of 0.8 that a Server Component reaches through the entry (spec D18,
 * D33), with the token modules of 0.17 (spec §10, R16): each must exist, and pass its check in
 * {@link serverProbeSource}.
 */
const SERVER_SAFE_MODULES = [
  'lib/brand.mjs',
  'lib/brand.cjs',
  'lib/color.mjs',
  'lib/color.cjs',
  'lib/date.mjs',
  'lib/date.cjs',
  'lib/toaster.mjs',
  'lib/toaster.cjs',
  'lib/tokens.mjs',
  'lib/tokens.cjs',
  'lib/waveTokens.mjs',
  'lib/waveTokens.cjs',
];

/**
 * The class-name strings of the Button-only probe (P3-00): the bundle keeps Button's root class
 * and drops the Dialog surface's, so the registry (`lib/classNames`) is tree-shaken per constant.
 */
const BUTTON_ONLY_STRINGS = { keepStrings: ['wave-button'], dropStrings: ['wave-dialog-content'] };

/**
 * The class-name strings of the Field-only probe (0.9): Field reaches no InfoButton code, so its
 * bundle also drops InfoButton's root class from the registry.
 */
const FIELD_ONLY_STRINGS = { dropStrings: ['wave-info-button'] };

/**
 * The exclusion probes of 0.11 (spec §6.2): each import of only `keep` must drop `drop`, the
 * modules of `dropModules` and the class strings of `dropStrings`. A Tag holds no group, roving,
 * Avatar or listbox code; a TagGroup and an InteractionTag no listbox or each other's code; a
 * Combobox none of TagPicker's or the tags'; a Dialog and a Drawer none of each other's root (both
 * reach only `Dialog.shared` and `Dialog.slots`); a Toaster no surface code (its offset reads
 * `lib/layers` only); a Nav and a Hamburger none of the drawer panel, the modal layer or each
 * other's root; a NavDrawer none of the public Drawer or the Nav compound.
 */
export const EXCLUSION_PROBES_0_11 = [
  {
    keep: 'Tag',
    drop: 'TagPicker',
    dropModules: [
      'components/data-display/TagGroup.mjs',
      'components/data-display/InteractionTag.mjs',
      'components/data-display/Avatar.mjs',
      'components/button/Toolbar.navigation.mjs',
      'hooks/useListbox.mjs',
    ],
    keepStrings: ['wave-tag'],
    dropStrings: ['wave-tag-group', 'wave-tag-picker'],
  },
  {
    keep: 'TagGroup',
    drop: 'TagPicker',
    dropModules: ['hooks/useListbox.mjs', 'components/input/Option.mjs'],
  },
  { keep: 'InteractionTag', drop: 'TagGroup' },
  {
    keep: 'Combobox',
    drop: 'TagPicker',
    dropModules: [
      'components/input/TagPicker.root.mjs',
      'components/input/TagPicker.parts.mjs',
      'components/input/TagPicker.option.mjs',
      'components/data-display/TagGroup.mjs',
      'components/data-display/Tag.mjs',
    ],
    dropStrings: ['wave-tag-picker-list'],
  },
  {
    keep: 'Dialog',
    drop: 'Drawer',
    dropModules: ['components/overlays/Drawer.root.mjs', 'components/overlays/Drawer.panel.mjs'],
  },
  { keep: 'Drawer', drop: 'Dialog' },
  {
    keep: 'Toaster',
    drop: 'Drawer',
    dropModules: [
      'components/overlays/Dialog.mjs',
      'components/overlays/Dialog.shared.mjs',
      'components/overlays/Drawer.root.mjs',
      'components/overlays/Drawer.panel.mjs',
    ],
  },
  {
    keep: 'Nav',
    drop: 'NavDrawer',
    dropModules: [
      'components/overlays/Drawer.panel.mjs',
      'hooks/useModalLayer.mjs',
      'hooks/useRovingTabIndex.mjs',
    ],
    keepStrings: ['wave-nav'],
    dropStrings: ['wave-nav-drawer', 'wave-hamburger'],
  },
  {
    keep: 'Hamburger',
    drop: 'NavDrawer',
    dropModules: [
      'components/overlays/Drawer.panel.mjs',
      'hooks/useModalLayer.mjs',
      'components/navigation/Nav.root.mjs',
    ],
    keepStrings: ['wave-hamburger'],
    dropStrings: ['wave-nav-drawer'],
  },
  {
    keep: 'NavDrawer',
    drop: 'Drawer',
    dropModules: [
      'components/overlays/Drawer.root.mjs',
      'components/overlays/Drawer.parts.mjs',
      'components/navigation/Nav.mjs',
    ],
  },
];

/** Component modules an import of only a standalone hook or utility must not hold (0.12). */
const OVERLAY_COMPONENT_MODULES = [
  'components/button/Button.mjs',
  'components/overlays/Dialog.mjs',
  'components/overlays/Popover.mjs',
  'components/navigation/Menu.mjs',
];

/**
 * The hook probes of 0.12 (spec §5): an import of only `keep`, a public hook or utility, holds
 * each of `modules`, none of `dropModules` and imports none of the `dropExternals` packages, so
 * a hook that needs no positioning library does not pull one in.
 */
export const HOOK_PROBES_0_12 = [
  {
    keep: 'useFocusVisible',
    modules: ['hooks/useFocusVisible.mjs'],
    dropModules: [...OVERLAY_COMPONENT_MODULES, 'hooks/usePopupPosition.mjs'],
    dropExternals: ['@floating-ui/react-dom'],
  },
  {
    keep: 'useFocusableGroup',
    modules: ['hooks/useFocusableGroup.mjs', 'lib/focus.mjs'],
    dropModules: [...OVERLAY_COMPONENT_MODULES, 'hooks/usePopupPosition.mjs'],
    dropExternals: ['@floating-ui/react-dom'],
  },
  {
    keep: 'getFirstTabbable',
    modules: ['lib/focus.mjs'],
    dropModules: [...OVERLAY_COMPONENT_MODULES, 'hooks/usePopupPosition.mjs'],
    dropExternals: ['@floating-ui/react-dom'],
  },
  {
    keep: 'useModalOpen',
    modules: ['hooks/useModalOpen.mjs', 'lib/layers.mjs'],
    dropModules: [...OVERLAY_COMPONENT_MODULES, 'hooks/usePopupPosition.mjs'],
    dropExternals: ['@floating-ui/react-dom'],
  },
  {
    keep: 'usePopupPosition',
    modules: ['hooks/usePopupPosition.mjs'],
    dropModules: OVERLAY_COMPONENT_MODULES,
    dropExternals: [],
  },
];

/** Component modules an import of only an Avatar helper must not hold (0.13). */
const AVATAR_COMPONENT_MODULES = [
  'components/data-display/Avatar.mjs',
  'components/data-display/AvatarGroup.mjs',
  'components/data-display/Persona.mjs',
];

/**
 * The helper probes of 0.13 (spec §9): an import of only `getInitials` or only
 * `partitionAvatarGroupItems`, two pure functions, holds its own module, no Avatar component and
 * no React module.
 */
export const HOOK_PROBES_0_13 = [
  {
    keep: 'getInitials',
    modules: ['lib/initials.mjs'],
    dropModules: AVATAR_COMPONENT_MODULES,
    dropExternals: ['react', 'react/jsx-runtime'],
  },
  {
    keep: 'partitionAvatarGroupItems',
    modules: ['components/data-display/AvatarGroup.partition.mjs'],
    dropModules: AVATAR_COMPONENT_MODULES,
    dropExternals: ['react', 'react/jsx-runtime'],
  },
];

/** Component modules an import of only the table helper must not hold (0.14). */
const TABLE_COMPONENT_MODULES = [
  'components/table/DataGrid.mjs',
  'components/table/Table.mjs',
  'components/table/Table.shared.mjs',
];

/**
 * Component modules an import of only a breadcrumb helper must not hold (0.14): the Breadcrumb,
 * and the Menu and Overflow it is built on.
 */
const BREADCRUMB_COMPONENT_MODULES = [
  'components/navigation/Breadcrumb.mjs',
  'components/navigation/Menu.mjs',
  'components/layout/Overflow.mjs',
];

/**
 * The helper probes of 0.14 (spec D5): an import of only `createTableColumn`, or of only one of
 * the breadcrumb helpers, pure functions of `src/lib`, holds its own module, no component of the
 * table or the breadcrumb and no React module.
 */
export const HOOK_PROBES_0_14 = [
  {
    keep: 'createTableColumn',
    modules: ['lib/table.mjs'],
    dropModules: TABLE_COMPONENT_MODULES,
    dropExternals: ['react', 'react/jsx-runtime'],
  },
  ...[
    'partitionBreadcrumbItems',
    'truncateBreadcrumbLongName',
    'truncateBreadcrumbLongTooltip',
    'isTruncatableBreadcrumbContent',
  ].map((keep) => ({
    keep,
    modules: ['lib/breadcrumb.mjs'],
    dropModules: BREADCRUMB_COMPONENT_MODULES,
    dropExternals: ['react', 'react/jsx-runtime'],
  })),
];

/**
 * The modules that 0.16 adds to dist (spec §11): the pure cores of `src/lib`, the selection and
 * window hooks, the table hooks, the DataGrid's store, contexts, header, window and column sizing,
 * `Table.ResizeHandle`, the data mode of the pickers and `FlatTree` with its model. An import of
 * only `Button` or only `MessageBar` holds none of them, so both stay as they were in 0.15
 * ({@link EXCLUSION_PROBES_0_16}). Sorted.
 */
export const DATA_SCALE_MODULES = [
  'components/input/Option.data.mjs',
  'components/layout/FlatTree.context.mjs',
  'components/layout/FlatTree.item.mjs',
  'components/layout/FlatTree.mjs',
  'components/layout/useFlatTree.mjs',
  'components/table/DataGrid.context.mjs',
  'components/table/DataGrid.header.mjs',
  'components/table/DataGrid.sizing.mjs',
  'components/table/DataGrid.store.mjs',
  'components/table/DataGrid.window.mjs',
  'components/table/Table.resize.mjs',
  'components/table/useTableColumnSizing.mjs',
  'components/table/useTableFeatures.mjs',
  'components/table/useTableSelection.mjs',
  'components/table/useTableSort.mjs',
  'hooks/useSelection.mjs',
  'hooks/useVirtualWindow.mjs',
  'lib/columnSizing.mjs',
  'lib/flatTree.mjs',
  'lib/selection.mjs',
  'lib/treeCascade.mjs',
  'lib/virtual.mjs',
];

/** The tree cascade, moved out of `Tree.selection` in 0.16 (R20): Tree and FlatTree share it. */
const TREE_CASCADE_MODULE = 'lib/treeCascade.mjs';

/** The modules of FlatTree and its model, which an import of only `DataGrid` must not hold. */
const FLAT_TREE_MODULES = [
  'components/layout/FlatTree.context.mjs',
  'components/layout/FlatTree.item.mjs',
  'components/layout/useFlatTree.mjs',
  'lib/flatTree.mjs',
  TREE_CASCADE_MODULE,
];

/**
 * The DataGrid's modules and the table code it is built on, which an import of only `FlatTree`
 * must not hold.
 */
const DATA_GRID_MODULES = [
  'components/table/DataGrid.context.mjs',
  'components/table/DataGrid.header.mjs',
  'components/table/DataGrid.sizing.mjs',
  'components/table/DataGrid.store.mjs',
  'components/table/DataGrid.window.mjs',
  'components/table/Table.resize.mjs',
  'components/table/Table.shared.mjs',
  'components/table/useGridNavigation.mjs',
  'lib/columnSizing.mjs',
  'lib/selection.mjs',
];

/**
 * The hook probes of 0.16 (spec §11): an import of only `useVirtualWindow` holds the window and
 * its layout core and no component, and one of only `useSelection` holds the selection core and
 * no component, so no table code (`dropPrefixes`: no module under `components/`). Neither
 * renders, so neither imports the JSX runtime.
 */
export const HOOK_PROBES_0_16 = [
  {
    keep: 'useVirtualWindow',
    modules: ['hooks/useVirtualWindow.mjs', 'lib/virtual.mjs'],
    dropModules: [],
    dropPrefixes: ['components/'],
    dropExternals: ['react/jsx-runtime'],
  },
  {
    keep: 'useSelection',
    modules: ['hooks/useSelection.mjs', 'lib/selection.mjs'],
    dropModules: [
      'components/table/DataGrid.store.mjs',
      'components/table/useTableFeatures.mjs',
      'components/table/useTableSelection.mjs',
    ],
    dropPrefixes: ['components/'],
    dropExternals: ['react/jsx-runtime'],
  },
];

/**
 * The exclusion probes of 0.16 (spec §11, R20): an import of only `DataGrid` holds no FlatTree and
 * one of only `FlatTree` no DataGrid; an import of only `Button` or only `MessageBar` holds none of
 * the 0.16 modules, and one of only `Tree` none but the cascade it moved to (`lib/treeCascade`).
 */
export const EXCLUSION_PROBES_0_16 = [
  { keep: 'DataGrid', drop: 'FlatTree', dropModules: FLAT_TREE_MODULES },
  { keep: 'FlatTree', drop: 'DataGrid', dropModules: DATA_GRID_MODULES },
  { keep: 'Button', drop: 'DataGrid', dropModules: DATA_SCALE_MODULES },
  { keep: 'MessageBar', drop: 'DataGrid', dropModules: DATA_SCALE_MODULES },
  {
    keep: 'Tree',
    drop: 'FlatTree',
    dropModules: DATA_SCALE_MODULES.filter((path) => path !== TREE_CASCADE_MODULE),
  },
];

/**
 * The inclusion probes of 0.16: the positive controls of {@link EXCLUSION_PROBES_0_16}, so an
 * exclusion cannot pass because a module is missing. A DataGrid holds its selection store, its
 * window, its column sizing and the selection core; a FlatTree its item and context; a Tree the
 * moved cascade.
 */
export const INCLUSION_PROBES_0_16 = [
  {
    keep: 'DataGrid',
    modules: [
      'components/table/DataGrid.store.mjs',
      'components/table/DataGrid.window.mjs',
      'components/table/DataGrid.sizing.mjs',
      'lib/selection.mjs',
      'lib/columnSizing.mjs',
    ],
  },
  {
    keep: 'FlatTree',
    modules: ['components/layout/FlatTree.item.mjs', 'components/layout/FlatTree.context.mjs'],
  },
  { keep: 'Tree', modules: [TREE_CASCADE_MODULE] },
];

/**
 * The window's budget (spec §11): the closure of an import of only `useVirtualWindow`, minified
 * with bare imports external (the window, its layout core and the development warning it shares
 * with every component), imports nothing but `react`. The budget is the size first measured for
 * 0.16.0 (3,532 bytes minified, 1,695 gzip) plus 25 %, the gzip size held at the spec's ceiling of
 * 2 KiB (25 % more would be 2,119).
 */
export const VIRTUAL_BUDGET = {
  names: ['useVirtualWindow'],
  maxMinifiedBytes: 4415,
  maxGzipBytes: 2048,
  allowedExternals: ['react'],
};

/**
 * The DataGrid-only budget (spec §11): the import grows by the selection core, the column sizing
 * and the window support, so its size was measured first, for 0.16.0 (69,592 bytes minified,
 * 23,545 gzip), and the budget is that plus 25 %; raise it only deliberately. The closure imports
 * nothing but the package's own dependencies and peers (every component reaches `clsx` and
 * `tailwind-merge` through `cn`; the grid uses `react-dom`), so a new dependency fails it.
 */
export const DATA_GRID_BUDGET = {
  names: ['DataGrid'],
  maxMinifiedBytes: 86990,
  maxGzipBytes: 29431,
  allowedExternals: ['clsx', 'react', 'react-dom', 'react/jsx-runtime', 'tailwind-merge'],
};

/**
 * Imports whose size verify-dist measures and prints against their size in the published 0.15.0
 * package (minified and gzip bytes, bare imports external; spec §11, recorded in §16). The
 * DataGrid-only import also has a `budget` ({@link DATA_GRID_BUDGET}); the others are printed for
 * drift only: in 0.16 a Tree-only import changed only by the moved cascade (R20), and Button-only
 * and MessageBar-only imports were as in 0.15.0 (0.17 budgets all three against 0.16.0 in
 * {@link RECORDED_IMPORTS_0_17}).
 */
export const RECORDED_IMPORTS = [
  {
    names: ['DataGrid'],
    baseline: { version: '0.15.0', minified: 48403, gzip: 16520 },
    budget: DATA_GRID_BUDGET,
  },
  { names: ['Tree'], baseline: { version: '0.15.0', minified: 47248, gzip: 16201 } },
  { names: ['Button'], baseline: { version: '0.15.0', minified: 11195, gzip: 3855 } },
  { names: ['MessageBar'], baseline: { version: '0.15.0', minified: 26831, gzip: 9312 } },
];

/** The token core of 0.17 (`src/lib/tokens.ts`): the provider's conversion and merge. */
const TOKEN_CORE_MODULE = 'lib/tokens.mjs';
/** The names tuple with `waveTokens` and `chartPalette` (`src/lib/waveTokens.ts`). */
const WAVE_TOKENS_MODULE = 'lib/waveTokens.mjs';
/** The brand generator (`src/lib/brand.ts`). */
const BRAND_MODULE = 'lib/brand.mjs';
/** The provider, whose context every Portal and `useDirection` reads. */
const PROVIDER_MODULE = 'components/provider/WaveProvider.mjs';

/** The modules of the 0.17 token features (spec §10), which a Button or MessageBar never holds. */
export const TOKEN_MODULES = [BRAND_MODULE, TOKEN_CORE_MODULE, WAVE_TOKENS_MODULE];

/**
 * A token name of the names tuple (`WAVE_TOKEN_NAMES`, spec §10), found as a fragment of minified
 * code: the build writes the tuple as one string that it splits at run time, so no name is a
 * string literal of its own. No other token name contains this one.
 */
const TOKEN_NAMES_MARKER = 'paletteSteelTintForeground';

/** A fragment of the brand generator's code: the prefix of its warning keys. */
const BRAND_MARKER = 'createBrandTokens:';

/**
 * The key prefix of the development contrast check of a full ramp (R8): the check and its table
 * read `process.env.NODE_ENV`, so a production bundle drops them.
 */
const BRAND_CHECK_MARKER = 'createBrandTokens:contrast';

/** The React packages, which no server-safe helper imports. */
const REACT_PACKAGES = ['react', 'react-dom', 'react/jsx-runtime'];

/**
 * The helper probes of 0.17 (spec §10): an import of only `createBrandTokens` holds the brand
 * generator and neither the names tuple nor any component or React module, and, as every probe
 * bundles for production, none of the development contrast check of a full ramp (spec §6.3, R8:
 * {@link BRAND_CHECK_MARKER}); an import of only `waveTokens` holds the tuple and the token core,
 * and neither the brand generator nor any component or React module.
 */
export const HOOK_PROBES_0_17 = [
  {
    keep: 'createBrandTokens',
    modules: [BRAND_MODULE],
    dropModules: [WAVE_TOKENS_MODULE],
    dropPrefixes: ['components/'],
    dropExternals: REACT_PACKAGES,
    dropSubstrings: [BRAND_CHECK_MARKER],
  },
  {
    keep: 'waveTokens',
    modules: [WAVE_TOKENS_MODULE, TOKEN_CORE_MODULE],
    dropModules: [BRAND_MODULE],
    dropPrefixes: ['components/'],
    dropExternals: REACT_PACKAGES,
  },
];

/**
 * The exclusion probes of 0.17 (spec §10, R6): an import of only `Dialog`, which holds a Portal and
 * so the provider's context and token style, holds neither the names tuple nor the brand generator,
 * no module of theirs and no fragment of their code ({@link TOKEN_NAMES_MARKER}, {@link
 * BRAND_MARKER}); one of only `Tree`, which reads the provider's context for its direction, neither
 * module either; one of only `Button` or only `MessageBar` none of {@link TOKEN_MODULES} and not
 * the provider. `drop: null` drops no component by name: the Dialog and the Tree hold the
 * provider's module for its context, though not the provider component.
 */
export const EXCLUSION_PROBES_0_17 = [
  {
    keep: 'Dialog',
    drop: null,
    dropModules: [BRAND_MODULE, WAVE_TOKENS_MODULE],
    dropSubstrings: [TOKEN_NAMES_MARKER, BRAND_MARKER],
  },
  { keep: 'Tree', drop: null, dropModules: [BRAND_MODULE, WAVE_TOKENS_MODULE] },
  { keep: 'Button', drop: 'WaveProvider', dropModules: TOKEN_MODULES },
  { keep: 'MessageBar', drop: 'WaveProvider', dropModules: TOKEN_MODULES },
];

/**
 * The inclusion probes of 0.17: the positive controls of {@link EXCLUSION_PROBES_0_17}. The code of
 * an import of only `waveTokens` holds the tuple's marker and that of one of only
 * `createBrandTokens` the brand marker, both in a production build, so the fragments the Dialog
 * probe looks for are found where they are; an import of only `WaveProvider` holds the token core;
 * one of only `Tree` the provider's module (`useDirection` reads its context, which is why the
 * Tree's allowance in {@link RECORDED_IMPORTS_0_17} is larger than `cn`'s).
 */
export const INCLUSION_PROBES_0_17 = [
  { keep: 'waveTokens', modules: [WAVE_TOKENS_MODULE], substrings: [TOKEN_NAMES_MARKER] },
  { keep: 'createBrandTokens', modules: [BRAND_MODULE], substrings: [BRAND_MARKER] },
  { keep: 'WaveProvider', modules: [PROVIDER_MODULE, TOKEN_CORE_MODULE] },
  { keep: 'Tree', modules: [PROVIDER_MODULE] },
];

/**
 * The budget of an import of only `createBrandTokens` (spec §10): 3 KiB gzip; minified, the size
 * first measured for 0.17.0 (3,596 bytes, 1,932 gzip) plus 25 %, as {@link VIRTUAL_BUDGET} has it.
 * The closure imports nothing.
 */
export const BRAND_TOKENS_BUDGET = {
  names: ['createBrandTokens'],
  maxMinifiedBytes: 4495,
  maxGzipBytes: 3072,
  allowedExternals: [],
};

/**
 * The budget of an import of only `waveTokens` (spec §10): 3 KiB gzip; minified, the size first
 * measured for 0.17.0 (3,071 bytes, 969 gzip) plus 25 %. The closure imports nothing.
 */
export const WAVE_TOKENS_BUDGET = {
  names: ['waveTokens'],
  maxMinifiedBytes: 3839,
  maxGzipBytes: 3072,
  allowedExternals: [],
};

/** The externals of a component's closure: `cn`'s two dependencies and React. */
const COMPONENT_EXTERNALS = ['clsx', 'react', 'react/jsx-runtime', 'tailwind-merge'];
/** The externals of a closure with a Portal, which also imports `react-dom`. */
const PORTAL_EXTERNALS = ['clsx', 'react', 'react-dom', 'react/jsx-runtime', 'tailwind-merge'];

/**
 * The 0.17 budgets (spec §10, with the build's rulings, which correct it for Tree and add the
 * provider with a Dialog), measured as {@link measureImport} measures and printed against the size
 * in the published 0.16.0 package where the import had one (`baseline: null` for the new ones),
 * both measured with this release's build tools, as {@link RECORDED_IMPORTS} measures 0.15.0. Each
 * budget is the 0.16.0 size plus its allowance, in bytes minified and gzip:
 *   - `Button` and `MessageBar`: +64 and +32, for `cn`, which recognises the two new font families
 *     (R13); otherwise byte for byte 0.16.0's;
 *   - `Tree`: +128 and +64, `cn`'s allowance and the provider's context, which Tree reads for its
 *     direction (`useDirection`) and which has three members more (R17);
 *   - `Dialog` without the provider component: +1 KiB and +0.4 KiB (1,024 and 409), the Portal's
 *     token style and the context;
 *   - `WaveProvider` with `Dialog`: +1.5 KiB and +0.7 KiB (1,536 and 716), the provider's token
 *     handling (`lib/tokens`) too;
 *   - `createBrandTokens` and `waveTokens`: new, 3 KiB gzip ({@link BRAND_TOKENS_BUDGET}, {@link
 *     WAVE_TOKENS_BUDGET}).
 * A KiB fraction is rounded down, so no budget is above the spec's figure, and each closure
 * imports only the externals it has.
 */
export const RECORDED_IMPORTS_0_17 = [
  { names: ['createBrandTokens'], baseline: null, budget: BRAND_TOKENS_BUDGET },
  { names: ['waveTokens'], baseline: null, budget: WAVE_TOKENS_BUDGET },
  {
    names: ['Button'],
    baseline: { version: '0.16.0', minified: 11195, gzip: 3855 },
    budget: {
      names: ['Button'],
      maxMinifiedBytes: 11259,
      maxGzipBytes: 3887,
      allowedExternals: COMPONENT_EXTERNALS,
    },
  },
  {
    names: ['MessageBar'],
    baseline: { version: '0.16.0', minified: 26831, gzip: 9312 },
    budget: {
      names: ['MessageBar'],
      maxMinifiedBytes: 26895,
      maxGzipBytes: 9344,
      allowedExternals: COMPONENT_EXTERNALS,
    },
  },
  {
    names: ['Tree'],
    baseline: { version: '0.16.0', minified: 47248, gzip: 16196 },
    budget: {
      names: ['Tree'],
      maxMinifiedBytes: 47376,
      maxGzipBytes: 16260,
      allowedExternals: COMPONENT_EXTERNALS,
    },
  },
  {
    names: ['Dialog'],
    baseline: { version: '0.16.0', minified: 70721, gzip: 23723 },
    budget: {
      names: ['Dialog'],
      maxMinifiedBytes: 71745,
      maxGzipBytes: 24132,
      allowedExternals: PORTAL_EXTERNALS,
    },
  },
  {
    names: ['WaveProvider', 'Dialog'],
    baseline: { version: '0.16.0', minified: 71884, gzip: 24127 },
    budget: {
      names: ['WaveProvider', 'Dialog'],
      maxMinifiedBytes: 73420,
      maxGzipBytes: 24843,
      allowedExternals: PORTAL_EXTERNALS,
    },
  },
];

/**
 * The libraries of the chart stories (R14, 0.17): `recharts` and `chart.js`, devDependencies that
 * only `stories/Charts.stories.tsx` imports, and Chart.js's colour dependency (`@kurkle/color`).
 * No file of dist names them ({@link checkDevOnlyLibraries}).
 */
export const DEV_ONLY_LIBRARIES = ['recharts', 'chart.js', 'kurkle'];

/**
 * The inclusion probes of 0.11 (spec §6.2): an import of only `keep` holds each of `modules`, so
 * the exclusion probes above cannot pass because a module is missing. A TagPicker is built on the
 * tags, and Dialog, Drawer and NavDrawer mount through the presence core.
 */
export const INCLUSION_PROBES_0_11 = [
  {
    keep: 'TagPicker',
    modules: [
      'components/input/TagPicker.parts.mjs',
      'components/input/TagPicker.option.mjs',
      'components/data-display/Tag.mjs',
      'components/data-display/TagGroup.mjs',
    ],
  },
  { keep: 'Dialog', modules: ['hooks/usePresence.mjs'] },
  { keep: 'Drawer', modules: ['components/overlays/Drawer.panel.mjs', 'hooks/usePresence.mjs'] },
  {
    keep: 'NavDrawer',
    modules: [
      'components/overlays/Drawer.panel.mjs',
      'components/navigation/Nav.root.mjs',
      'hooks/usePresence.mjs',
      'hooks/useRovingTabIndex.mjs',
    ],
  },
];

/**
 * Names that stay module-only (spec §4.5 of 0.11): `dist/index.mjs` exports none of them and the
 * rolled-up `dist/index.d.ts` exports none of them as a value or a type ({@link
 * checkModuleOnlyNames}). The foundation's seams, the tag seams, the drawer panel shell and the
 * overlay slots, the Nav seam, NavDrawer's contexts and TagPicker's internals; since 0.14 (spec
 * D6) also the parts the tables share (`Table.shared`, the sort arrows), the Overflow store,
 * TeachingPopover's root, context and surface, and the event predicates of the selectable
 * containers; since 0.15 (spec §16 Q1) every export of the motion internals: the recipe
 * constants, `resolveMotion` and `usesLegacyMotion` of `lib/motion`, and the hooks `useMotion`,
 * `useCollapsePresence`, `useFocusBeforeClose` and `usePresenceGroup` with their types; since
 * 0.16 (spec §11) every export of the data-scale modules that the entry does not export: the pure
 * cores (`lib/selection`, `lib/virtual`, `lib/columnSizing`, `lib/treeCascade`, `lib/flatTree`),
 * the table plugin seam and the sort of the table hooks, the DataGrid's store, contexts, header,
 * window and sizing modules, the data mode of the pickers, FlatTree's context, and the predicates
 * and contexts the hooks share with them (`ownsArrowKeys`, `returnFocusToGridCell`,
 * `ListboxOptionPositionContext`, …); since 0.17 (spec §10) the seams of the token modules: the
 * token core's conversion, collection and merge (`tokenVariable`, `collectTokenStyle`,
 * `mergeTokenOverrides`) and its type-level twin `TokenVariable`, the names tuple
 * `WAVE_TOKEN_NAMES`, and the brand generator's default ramp, rounding sides, contrast table and
 * check. The roll-up declares `TokenVariable` and `WAVE_TOKEN_NAMES` without exporting them (the
 * exported `waveTokens` and `WaveTokenName` refer to them), which the check accepts.
 * `verify-dist.test.mjs` reads the groups from the sources (those of 0.16 and 0.17 with the
 * TypeScript compiler, against the entry), so a new one cannot be missed. Sorted.
 */
export const MODULE_ONLY_NAMES = [
  'AvatarSizeContext',
  'AvatarSizeContextValue',
  'BRAND_CONTRAST_PAIRS',
  'CreateOptionKnown',
  'DEFAULT_BRAND_RAMP',
  'DEFAULT_COLUMN_WIDTH',
  'DEFAULT_MIN_COLUMN_WIDTH',
  'DEFAULT_SELECTION_HEADER_LABEL',
  'DEFAULT_SELECT_ALL_LABEL',
  'DataGridColumnResizeHandle',
  'DataGridColumnSizing',
  'DataGridContext',
  'DataGridContextValue',
  'DataGridFixedLayoutContext',
  'DataGridHeaderRowHintContext',
  'DataGridHeaderSlotsContext',
  'DataGridItemRowData',
  'DataGridItemSelectionDisabledContext',
  'DataGridItemsContext',
  'DataGridItemsContextValue',
  'DataGridRenderRow',
  'DataGridResizeContext',
  'DataGridResizeContextValue',
  'DataGridRowContext',
  'DataGridRowContextValue',
  'DataGridRowIdContext',
  'DataGridSection',
  'DataGridSectionContext',
  'DataGridSelectionHeaderSlot',
  'DataGridSortContext',
  'DataGridSortContextValue',
  'DataGridSpacerRow',
  'DataGridWindowContext',
  'DataGridWindowContextValue',
  'DataGridWindowRow',
  'DataGridWindowRowContext',
  'DataGridWindowState',
  'DrawerCloseButton',
  'DrawerCloseButtonProps',
  'DrawerContext',
  'DrawerContextValue',
  'DrawerHeaderContext',
  'DrawerPanel',
  'DrawerPanelProps',
  'DrawerPartContext',
  'DrawerPartPlacement',
  'DrawerRoot',
  'DrawerScrollState',
  'DrawerScrollStateContext',
  'ExactMatchCandidate',
  'FlatTreeContext',
  'FlatTreeContextValue',
  'FlatTreeIndex',
  'FlatTreeIssue',
  'FlatTreeNodeRecord',
  'FlatTreeRow',
  'FocusWithin',
  'ForeignEventOptions',
  'GroupVisibilityRecord',
  'HeaderSlotRegistry',
  'HeldFocus',
  'INTERACTIVE_SELECTOR',
  'InteractionTagContext',
  'ItemMeta',
  'ListboxContext',
  'ListboxItemsState',
  'ListboxOptionPosition',
  'ListboxOptionPositionContext',
  'ModalBackdrop',
  'ModalBackdropProps',
  'ModalBackdropSlot',
  'ModalCloseButton',
  'ModalCloseButtonProps',
  'NO_GROUPS',
  'NO_IDS',
  'NavCategoryStore',
  'NavCategoryValueContext',
  'NavContext',
  'NavContextValue',
  'NavDrawerContext',
  'NavDrawerContextValue',
  'NavDrawerLayoutContext',
  'NavDrawerLayoutContextValue',
  'NavPartKind',
  'NavRoot',
  'NavRovingContext',
  'NavRovingContextValue',
  'NavValueKind',
  'OverflowStore',
  'PresenceGroupEntry',
  'ROUNDS_DARKER',
  'ResolvedTagPickerLabels',
  'SELECTION_CELL_CLASSES',
  'SELECTION_COLUMN_WIDTH',
  'ScrollOffsetInput',
  'SelectionStore',
  'SelectionUniverse',
  'SortArrowDownIcon',
  'SortArrowUpIcon',
  'StoreConfig',
  'TAG_DISMISS_SELECTOR',
  'TAG_GROUP_SELECTOR',
  'TAG_ITEM_SELECTOR',
  'TOOLBAR_ITEM_SELECTOR',
  'TableFeaturePluginImplementation',
  'TablePartKind',
  'TableSelectionControl',
  'TableSelectionControlProps',
  'TableSortButton',
  'TableSortButtonProps',
  'TagGroupContext',
  'TagGroupContextValue',
  'TagGroupHostContext',
  'TagGroupHostOptions',
  'TagGroupMode',
  'TagHostContext',
  'TagHostContextValue',
  'TagOverflowElements',
  'TagPickerContext',
  'TagPickerContextValue',
  'TagPickerControlContext',
  'TagPickerControlContextValue',
  'TagPickerInputOnlyProps',
  'TagPickerRoot',
  'TagPickerTriggerKind',
  'TagPickerTriggerProps',
  'TeachingPopoverContext',
  'TeachingPopoverContextValue',
  'TeachingPopoverRoot',
  'TeachingPopoverSurfaceContext',
  'TeachingPopoverSurfaceContextValue',
  'TeachingPopoverTarget',
  'TeachingSurface',
  'TokenVariable',
  'TreeNode',
  'UseCollapsePresenceOptions',
  'UseCollapsePresenceResult',
  'UseDataGridColumnSizingOptions',
  'UseDataGridWindowOptions',
  'UseFocusBeforeCloseOptions',
  'UseNavRootStateOptions',
  'UsePresenceGroupResult',
  'UseTagGroupItemOptions',
  'UseTagOverflowOptions',
  'UseToolbarNavigationOptions',
  'VirtualLayoutInput',
  'WAVE_TOKEN_NAMES',
  'buildFlatTreeIndex',
  'carouselFadeMotion',
  'carouselSlideMotion',
  'cellBase',
  'checkBrandRamp',
  'clampColumnWidth',
  'clearIds',
  'collapseMotion',
  'collapseStructure',
  'collectTokenStyle',
  'computeCheckStates',
  'computeVirtualLayout',
  'containsValue',
  'createCategoryStore',
  'createHeaderSlotRegistry',
  'createOptionText',
  'createSelectionStore',
  'createTableFeaturePlugin',
  'dialogBackdropMotion',
  'dialogMotion',
  'drawerBackdropMotion',
  'drawerDurations',
  'drawerMotion',
  'endsTextSelection',
  'expandIconMotion',
  'findCategoriesContaining',
  'findExactMatch',
  'flatTreeForest',
  'getColumnEntry',
  'getNavPartKind',
  'getTablePartKind',
  'getWindowNavigationModel',
  'hasIsolatingModalBelow',
  'hasResizeObserver',
  'initialColumnWidth',
  'inlineDrawerMotion',
  'inlineDrawerStructure',
  'isDismissKey',
  'isForeignEvent',
  'isHiddenByCss',
  'isRepeatedActivation',
  'isSelectionCellElement',
  'isTextEntryElement',
  'markNavPart',
  'markTablePart',
  'mergeTokenOverrides',
  'messageBarGroupEnterMotion',
  'messageBarGroupExitMotion',
  'messageBarGroupItemStructure',
  'navActionsRevealMotion',
  'ownsArrowKeys',
  'popupMotion',
  'progressIndeterminateMotion',
  'renderListboxItem',
  'renderListboxItems',
  'renderListboxWindow',
  'renderWindowRows',
  'resolveColumnWidths',
  'resolveMotion',
  'returnFocusToGridCell',
  'sameIds',
  'scrollOffsetForIndex',
  'scrollSeparatorClasses',
  'selectAllIds',
  'sortTableRows',
  'summarizeSelection',
  'tabIndicatorMotion',
  'tagListControls',
  'tagRootClasses',
  'toastMotion',
  'toastStructure',
  'toggleCheck',
  'toggleId',
  'tokenVariable',
  'tooltipMotion',
  'totalWidth',
  'useBackdropAppearance',
  'useCollapsePresence',
  'useDataGridColumnSizing',
  'useDataGridContext',
  'useDataGridRowContext',
  'useDataGridSortContext',
  'useDataGridWindow',
  'useDataModeWarnings',
  'useDismissControlFocus',
  'useDrawerContext',
  'useDrawerOpen',
  'useFlatTreeContext',
  'useFocusBeforeClose',
  'useFocusWithin',
  'useHeldFocus',
  'useItemsAndChildrenWarning',
  'useModalOpener',
  'useMotionClasses',
  'useMotionPreference',
  'useNavContext',
  'useNavListChildCheck',
  'useNavRootState',
  'useNavValue',
  'usePresenceGroup',
  'useRecordCategory',
  'useScrollState',
  'useShownListScroll',
  'useTagGroupContext',
  'useTagGroupItem',
  'useTagOverflow',
  'useTagPickerContext',
  'useTagPickerControlContext',
  'useTeachingPopoverContext',
  'useToolbarNavigation',
  'usesLegacyMotion',
  'visibleFlatItems',
];

/**
 * Names that `dist/index.d.ts` and `dist/index.d.cts` must export both as a type and as a value
 * (0.11 spec §6.2): `TagPickerOption` is the interface of an `options` entry and the
 * `TagPicker.Option` component. A roll-up that keeps only one meaning breaks one of the two uses.
 */
export const VALUE_AND_TYPE_DECLARATIONS = ['TagPickerOption'];

const JS_FILE = /\.(mjs|cjs|js)$/;

// -------------------------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------------------------

/** Every file under `dir`, as `/`-separated paths relative to it. */
function listFiles(dir, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(dir, path));
    else files.push(path);
  }
  return files.sort();
}

function toPosix(path) {
  return path.split(sep).join('/');
}

/** Real path, case-folded on Windows (paths are case-insensitive there). */
function canonicalPath(path) {
  const real = realpathSync(path);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

/** A script's file name without its extension, case-folded. */
function scriptName(path) {
  return basename(path)
    .replace(/\.[cm]?js$/i, '')
    .toLowerCase();
}

/**
 * How the module at `metaUrl` was loaded, given the script path Node was started with (`argv1`):
 *   - `main`: it is that script (compared by real path, so a symlink, junction or drive-letter
 *     case difference still matches);
 *   - `mismatch`: a script with this module's name that could not be matched to it;
 *   - `imported`: anything else (a test or another script imported the module).
 */
export function entryStatus(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return 'imported';
  const self = fileURLToPath(metaUrl);
  try {
    if (canonicalPath(self) === canonicalPath(resolve(argv1))) return 'main';
  } catch {
    // An unresolvable path is not this module; the name check below decides.
  }
  return scriptName(argv1) === scriptName(self) ? 'mismatch' : 'imported';
}

/** Whether the module at `metaUrl` is the script Node was started with (see entryStatus). */
export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  return entryStatus(metaUrl, argv1) === 'main';
}

/**
 * The entry point of a gate script: runs `main` and sets the exit code to its
 * result when Node was started with the module at `metaUrl`. A script of the module's name that
 * cannot be matched to it never passes silently: it reports that nothing was checked and sets
 * exit code 1. Returns the exit code it set (undefined when the module was imported).
 */
export async function runScript(metaUrl, main, { argv1 = process.argv[1], io = console } = {}) {
  const status = entryStatus(metaUrl, argv1);
  if (status === 'imported') return undefined;
  if (status === 'main') {
    process.exitCode = await main();
  } else {
    io.error(
      `${scriptName(fileURLToPath(metaUrl))}: cannot confirm that ${argv1} is ` +
        `${fileURLToPath(metaUrl)}; nothing was checked`,
    );
    process.exitCode = 1;
  }
  return process.exitCode;
}

/** Index just past the comment or whitespace run at `i` (or `i` itself). */
function skipTrivia(code, i, { newlines = true } = {}) {
  for (;;) {
    const ch = code[i];
    if (ch === '\n' || ch === '\r') {
      if (!newlines) return i;
      i++;
    } else if (ch === ' ' || ch === '\t' || ch === '\uFEFF') i++;
    else if (code.startsWith('//', i)) {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end;
    } else if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
    } else return i;
  }
}

/** Characters that continue an expression when they start the next line (no ASI before them). */
const CONTINUES_EXPRESSION = new Set([...'.[(+-*/%,?=<>&|^`']);

/**
 * The directive prologue of a script or module: the raw texts of the string-literal statements
 * at its start (`"use strict"`, `"use client"`), before the first other statement. Comments, a
 * hashbang and ASI-terminated directives are handled; template literals are never directives.
 */
export function directivePrologue(code) {
  const directives = [];
  let i = code.startsWith('#!') ? code.indexOf('\n') : 0;
  if (i === -1) return directives;
  for (;;) {
    i = skipTrivia(code, i);
    const quote = code[i];
    if (quote !== '"' && quote !== "'") return directives;
    let end = i + 1;
    while (end < code.length && code[end] !== quote && code[end] !== '\n') {
      end += code[end] === '\\' ? 2 : 1;
    }
    if (code[end] !== quote) return directives;
    const text = code.slice(i + 1, end);
    let next = skipTrivia(code, end + 1, { newlines: false });
    if (code[next] === ';') {
      next++;
    } else if (next < code.length && code[next] !== '\n' && code[next] !== '\r') {
      // Same line, no semicolon: the literal is part of a larger expression.
      if (code[next] !== '}') return directives;
    } else {
      const after = skipTrivia(code, next);
      if (
        after < code.length &&
        (CONTINUES_EXPRESSION.has(code[after]) || /^(in|instanceof)\b/.test(code.slice(after)))
      ) {
        return directives;
      }
    }
    directives.push(text);
    i = next;
  }
}

/**
 * Whether a dist file (path relative to `dist/`, `/`-separated) must start with `"use client"`:
 * component and hook modules, never `index.*` barrels. Mirrors `useClient` in vite.config.ts.
 */
export function expectsUseClient(path) {
  const segments = path.split('/');
  if (segments[0] !== 'components' && segments[0] !== 'hooks') return false;
  if (segments.includes('node_modules')) return false;
  return !/^index\.(mjs|cjs|js)$/.test(segments[segments.length - 1]);
}

/**
 * The module specifiers a built file imports (static, dynamic and `require`), also from
 * whitespace-minified code: a static `import`/`export … from` starts the file or follows a line
 * break, `;`, `}` or a comment (`import{a}from"x"`, `export*from"./y.mjs"`).
 */
export function importSpecifiers(code) {
  const specifiers = new Set();
  const statics =
    /(?:^|[;}\n]|\*\/)\s*(?:import|export)\s*(?:[^'"`;]*?\bfrom\s*)?(["'])([^"'\n]+)\1/g;
  const calls = /\b(?:import|require)\(\s*(["'`])([^"'`\n]+)\1\s*\)/g;
  for (const pattern of [statics, calls]) {
    for (const match of code.matchAll(pattern)) specifiers.add(match[2]);
  }
  return [...specifiers];
}

/** The package name of a bare specifier (`@scope/name/sub` → `@scope/name`). */
function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// -------------------------------------------------------------------------------------------
// Checks
// -------------------------------------------------------------------------------------------

/** `"use client"` on every component/hook module and on nothing else (repo-level#2). */
export function checkDirectives(dist) {
  const errors = [];
  let modules = 0;
  for (const path of listFiles(dist).filter((file) => JS_FILE.test(file))) {
    const expected = expectsUseClient(path);
    const has = directivePrologue(readFileSync(join(dist, path), 'utf8')).includes('use client');
    if (expected) modules++;
    if (expected && !has) errors.push(`${path} lacks "use client"`);
    if (!expected && has) {
      errors.push(
        `${path} must not start with "use client" (only component and hook modules do; ` +
          'barrels and src/lib stay importable from Server Components)',
      );
    }
  }
  if (modules === 0) {
    errors.push('no component or hook modules in dist (not built with preserveModules?)');
  }
  return errors;
}

/** A component name: PascalCase with a lower-case letter (not a `Z_INDEX` constant). */
const COMPONENT_NAME = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/;

/**
 * Public names that `dist/index.d.ts` and `dist/index.d.cts` must declare and export: a utility,
 * a component, a props type, a compound, a hook and a class-name constant. The build passes with
 * an empty roll-up: vite-plugin-dts 4 rolls up only `export { }` when TypeScript writes the
 * declarations somewhere else than it expects (TypeScript 6 without `rootDir` in tsconfig.json).
 * Without this list, only `npm run test:pack`, which type-checks the packed tarball, would notice.
 */
export const REQUIRED_DECLARATIONS = [
  'cn',
  'Button',
  'ButtonProps',
  'Menu',
  'usePresence',
  'useActiveDescendant',
  'Calendar',
  'TagGroup',
  'NavDrawer',
  'buttonClassNames',
];

/**
 * The top-level declarations of a rolled-up declaration file: the first declaration of every
 * value (`declare const`, `declare function`) and of every type (`interface`, `type`, `class`,
 * `enum`); the names exported by a value declaration or an export list (exported name → local
 * name; the roll-up renames some: `declare const Image_2` + `export { Image_2 as Image }`); and
 * the names exported by a type declaration.
 */
function indexDeclarations(dts) {
  const ts = require('typescript');
  const file = ts.createSourceFile(
    'index.d.ts',
    dts,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const isExported = (statement) =>
    (ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  const valueNames = (statement) => {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations
        .filter((declaration) => ts.isIdentifier(declaration.name))
        .map((declaration) => declaration.name.text);
    }
    return ts.isFunctionDeclaration(statement) && statement.name ? [statement.name.text] : [];
  };
  const typeName = (statement) =>
    (ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
      ? statement.name.text
      : undefined;

  const values = new Map();
  const types = new Map();
  const exported = new Map();
  const exportedTypes = new Set();
  const listed = new Map();
  for (const statement of file.statements) {
    for (const name of valueNames(statement)) {
      if (!values.has(name)) values.set(name, statement);
      if (isExported(statement)) exported.set(name, name);
    }
    const type = typeName(statement);
    if (type !== undefined) {
      if (!types.has(type)) types.set(type, statement);
      if (isExported(statement)) exportedTypes.add(type);
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        exported.set(element.name.text, (element.propertyName ?? element.name).text);
        listed.set(element.name.text, (element.propertyName ?? element.name).text);
      }
    }
  }
  return { values, types, exported, exportedTypes, listed };
}

/**
 * The components a rolled-up declaration file (`dist/index.d.ts`) exports without a JSDoc, in
 * declaration order (C-DOCS). A component is an exported value (`declare
 * const` or `declare function`) with a PascalCase name, exported directly or renamed by the roll-up
 * (`declare const Image_2` + `export { Image_2 as Image }`). Its JSDoc is the `/** … *\/` block
 * right before its first declaration (for overloads, the first signature).
 */
export function undocumentedComponents(dts) {
  const ts = require('typescript');
  const hasJsDoc = (statement) =>
    (ts.getLeadingCommentRanges(dts, statement.getFullStart()) ?? []).some((range) =>
      /^\/\*\*\s/.test(dts.slice(range.pos, range.end)),
    );
  const { values, exported } = indexDeclarations(dts);
  return [...exported]
    .filter(([name, local]) => COMPONENT_NAME.test(name) && values.has(local))
    .map(([name, local]) => ({ name, statement: values.get(local) }))
    .filter(({ statement }) => !hasJsDoc(statement))
    .sort((a, b) => a.statement.pos - b.statement.pos)
    .map(({ name }) => name);
}

/**
 * The names of `names` that a rolled-up declaration file does not both declare and export, in
 * the order given. A name counts when a declaration of that name (a value or a type) is exported,
 * or when an export list exports a declaration of the file under it (`export { Image_2 as Image }`).
 */
export function missingDeclarations(dts, names) {
  const { values, types, exported, exportedTypes } = indexDeclarations(dts);
  return names.filter((name) => {
    if (exportedTypes.has(name)) return false;
    const local = exported.get(name);
    return local === undefined || !(values.has(local) || types.has(local));
  });
}

/**
 * The names of `names` that a rolled-up declaration file does not export both as a type and as a
 * value, in the order given: an exported interface or type alias and an exported `declare const`
 * or `declare function` of one name, or an export list entry (`export { X_2 as X }`) whose local
 * name declares both (a list exports every meaning; an exported value declaration only the value).
 */
export function missingValueAndTypeDeclarations(dts, names) {
  const { values, types, exported, exportedTypes, listed } = indexDeclarations(dts);
  return names.filter((name) => {
    const local = listed.get(name);
    const value =
      (local !== undefined && values.has(local)) ||
      (exported.get(name) === name && values.has(name));
    const type = exportedTypes.has(name) || (local !== undefined && types.has(local));
    return !(value && type);
  });
}

/**
 * `index.d.ts` and its `index.d.cts` copy for the `require` condition (repo-level#5); each
 * declares and exports `requiredDeclarations` (default {@link REQUIRED_DECLARATIONS}), so an empty
 * or partial roll-up fails, and exports each of `valueAndTypeDeclarations` (default {@link
 * VALUE_AND_TYPE_DECLARATIONS}) both as a type and as a value; every component the declarations
 * export has a JSDoc (C-DOCS).
 */
export function checkDeclarations(
  dist,
  {
    requiredDeclarations = REQUIRED_DECLARATIONS,
    valueAndTypeDeclarations = VALUE_AND_TYPE_DECLARATIONS,
  } = {},
) {
  const errors = [];
  const dts = join(dist, 'index.d.ts');
  const dcts = join(dist, 'index.d.cts');
  const esm = existsSync(dts) ? readFileSync(dts, 'utf8') : undefined;
  const cjs = existsSync(dcts) ? readFileSync(dcts, 'utf8') : undefined;
  if (esm === undefined) errors.push('index.d.ts is missing');
  else if (esm.trim() === '') errors.push('index.d.ts is empty');
  if (cjs === undefined) {
    errors.push('index.d.cts is missing (CommonJS consumers would get ESM-typed declarations)');
  } else if (esm !== undefined && cjs !== esm) {
    errors.push('index.d.cts differs from index.d.ts (it must be a copy of the rolled-up file)');
  }
  for (const [name, text] of [
    ['index.d.ts', esm],
    ['index.d.cts', cjs],
  ]) {
    // Reported above: a missing file, an empty index.d.ts, an index.d.cts that is not its copy.
    if (text === undefined || text.trim() === '') continue;
    const missing = missingDeclarations(text, requiredDeclarations);
    if (missing.length > 0) {
      errors.push(
        `${name} does not declare and export ${missing.join(', ')} (an empty or partial ` +
          "roll-up: check tsconfig.json's rootDir and the declaration plugin in vite.config.ts)",
      );
      continue;
    }
    for (const both of missingValueAndTypeDeclarations(text, valueAndTypeDeclarations)) {
      errors.push(
        `${name} does not export ${both} both as a type and as a value (the interface and the ` +
          'component of one name: export the name once, without `type`, from the barrel)',
      );
    }
  }
  for (const name of esm ? undocumentedComponents(esm) : []) {
    errors.push(
      `index.d.ts: the exported component ${name} has no JSDoc (document it on its export, C-DOCS)`,
    );
  }
  return errors;
}

/**
 * `dist/lib/dev.mjs` and `dist/lib/dev.cjs` keep the literal `process.env.NODE_ENV` expression:
 * the consumer's bundler replaces it, so development warnings follow the consumer's
 * build mode. A `define` in vite.config.ts would inline the library's own mode instead.
 */
export function checkDevEnvironment(dist) {
  const errors = [];
  for (const path of ['lib/dev.mjs', 'lib/dev.cjs']) {
    const file = join(dist, path);
    if (!existsSync(file)) errors.push(`${path} is missing`);
    else if (!readFileSync(file, 'utf8').includes('process.env.NODE_ENV')) {
      errors.push(
        `${path} does not read process.env.NODE_ENV: the build inlined the mode (a \`define\` in ` +
          "vite.config.ts?), so the consumer's bundler can no longer choose development or production",
      );
    }
  }
  return errors;
}

/**
 * Every import of the built files: bare specifiers are declared dependencies or peer
 * dependencies (or subpaths of one), relative ones resolve inside `dist/`; no Node.js builtins
 * and no bundled `node_modules` code (repo-level#4).
 */
export function checkImports(dist, pkg) {
  const errors = [];
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
  const files = listFiles(dist);
  for (const path of files) {
    if (path.split('/').includes('node_modules')) {
      errors.push(`bundled dependency in dist: ${path} (dependencies must stay external)`);
    }
  }
  const distRoot = resolve(dist);
  for (const path of files.filter((file) => JS_FILE.test(file))) {
    if (path.split('/').includes('node_modules')) continue;
    const code = readFileSync(join(dist, path), 'utf8');
    for (const specifier of importSpecifiers(code)) {
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(join(distRoot, path)), specifier);
        const inside = !relative(distRoot, target).startsWith('..');
        if (!inside || !existsSync(target)) {
          errors.push(`${path} imports "${specifier}", which does not resolve inside dist`);
        }
      } else if (specifier.startsWith('node:') || isBuiltin(specifier)) {
        errors.push(`${path} imports the Node.js builtin "${specifier}"`);
      } else if (/^([a-zA-Z]:|\/|file:)/.test(specifier)) {
        errors.push(`${path} imports the absolute path "${specifier}"`);
      } else if (!declared.has(packageName(specifier))) {
        errors.push(`${path} imports "${specifier}", which is not a dependency or peer dependency`);
      }
    }
  }
  return errors;
}

/**
 * No JavaScript, CSS or declaration file of `dist` holds the name of a library of `names` (default
 * {@link DEV_ONLY_LIBRARIES}; R14, 0.17): a chart library of the stories reaches the package
 * neither as an import, nor as bundled code (whose region comments name its `node_modules` path),
 * nor as a type. The names are matched as packages write them (case-sensitive), so prose in a
 * JSDoc ("Recharts", "Chart.js") does not count; source maps, which quote the sources, are not
 * read.
 */
export function checkDevOnlyLibraries(dist, names = DEV_ONLY_LIBRARIES) {
  const errors = [];
  for (const path of listFiles(dist).filter((file) => /\.([cm]?js|css|d\.[cm]?ts)$/.test(file))) {
    const text = readFileSync(join(dist, path), 'utf8');
    for (const name of names) {
      if (text.includes(name)) {
        errors.push(
          `${path} holds "${name}" (a library of the stories only, R14: it must not reach dist)`,
        );
      }
    }
  }
  return errors;
}

/**
 * `path` without the Windows namespace prefix (`\\?\C:\…`, `\\?\UNC\server\…`) that
 * `mkdirSync(…, { recursive: true })` returns on Windows, so it compares with plain paths.
 */
function withoutNamespace(path) {
  return resolve(path.replace(/^\\\\\?\\UNC\\/, '\\\\').replace(/^\\\\\?\\/, ''));
}

/**
 * Error codes of a `mkdir`/`mkdtemp` that raced a concurrent run removing the shared parent:
 * ENOENT once it is gone, EPERM while Windows still has it delete-pending.
 */
const WORK_DIR_RACE_CODES = new Set(['ENOENT', 'EPERM']);
const WORK_DIR_ATTEMPTS = 10;

/** Blocks the (synchronous) caller for `ms` milliseconds. */
function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Creates a fresh work directory `<parent>/<prefix>XXXXXX`, creating `parent` and any missing
 * ancestor first. Returns `{ work, created }`, where `created` is the outermost directory this
 * call created (undefined when `parent` existed), for {@link removeWorkDir}.
 *
 * Concurrent runs share `parent`, and each removes it once empty, so either step can race a
 * removal (ENOENT, or EPERM while Windows has `parent` delete-pending): both steps are retried
 * together, with a short back-off, before the error is thrown.
 */
export function createWorkDir(parent, prefix) {
  let created;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const made = mkdirSync(parent, { recursive: true });
      const first = made === undefined ? undefined : withoutNamespace(made);
      if (first !== undefined && (created === undefined || first.length < created.length)) {
        created = first;
      }
      return { work: mkdtempSync(join(parent, prefix)), created };
    } catch (error) {
      if (!WORK_DIR_RACE_CODES.has(error?.code) || attempt === WORK_DIR_ATTEMPTS) throw error;
      pause(attempt * 2);
    }
  }
}

/**
 * Removes a work directory made by {@link createWorkDir}, then — so a run leaves no empty
 * directory behind — its parent once empty (also when an earlier run left it), and each
 * ancestor up to the `created` one while empty. A directory that still holds something, such as
 * the work directory of a concurrent run, is kept. Removing the work directory is retried on a
 * transient Windows lock (EBUSY/EPERM), so cleanup in a `finally` does not mask a result.
 */
export function removeWorkDir({ work, created }) {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  const stop = resolve(created ?? dirname(work));
  let dir = dirname(resolve(work));
  for (;;) {
    try {
      rmdirSync(dir);
    } catch {
      return; // not empty, or already removed by a concurrent run
    }
    const up = dirname(dir);
    if (dir === stop || up === dir || !`${up}${sep}`.startsWith(`${stop}${sep}`)) return;
    dir = up;
  }
}

/** Whether a built file is CommonJS (`.cjs`, or `.js` in a package without `type: module`). */
function isCommonJs(path, packageType) {
  return path.endsWith('.cjs') || (path.endsWith('.js') && packageType !== 'module');
}

/**
 * The source of a module standing in for a `"use client"` module on the server, as an RSC
 * bundler substitutes it: every export (`names`) is a client reference — a function that throws
 * when called and whose other properties can be neither read ("Cannot access Card.Header on the
 * server") nor assigned, like React's own client references — so evaluating the server module
 * graph never runs client code. As in React, reading `then` throws too ("Cannot await or return
 * from a thenable"), so server code that awaits a client reference or passes it to
 * `Promise.resolve` fails here as it does in an RSC bundler. `format` is `esm` or `cjs`.
 */
export function clientReferenceStub(path, names, format) {
  const helper = `const clientReference = (name) => {
  const target = function () {
    throw new Error('Attempted to call ' + name + '() from the server: it is exported by the "use client" module ' + ${JSON.stringify(path)});
  };
  Object.defineProperties(target, {
    $$typeof: { value: Symbol.for('react.client.reference') },
    $$id: { value: ${JSON.stringify(path)} + '#' + name },
    $$async: { value: false },
    name: { value: name },
  });
  const readable = new Set(['$$typeof', '$$id', '$$async', 'name']);
  const undefinedKeys = new Set(['displayName', 'defaultProps', '_debugInfo', 'toJSON']);
  const refuse = () => {
    throw new Error('Cannot assign to a client module from a server module.');
  };
  return new Proxy(target, {
    get(target, key) {
      if (typeof key === 'symbol' || readable.has(key)) return target[key];
      if (undefinedKeys.has(key)) return undefined;
      if (key === 'then') {
        throw new Error(
          'Cannot await or return from a thenable. You cannot await a client module from a ' +
            'server component.',
        );
      }
      throw new Error(
        'Cannot access ' + name + '.' + key + ' on the server. You cannot dot into a client ' +
          'module from a server component. You can only pass the imported name through.',
      );
    },
    set: refuse,
    defineProperty: refuse,
    deleteProperty: refuse,
  });
};
`;
  if (format === 'cjs') {
    const assignments = names
      .filter((name) => name !== '__esModule')
      .map(
        (name) => `exports[${JSON.stringify(name)}] = clientReference(${JSON.stringify(name)});`,
      );
    return [
      "'use strict';",
      helper,
      "Object.defineProperty(exports, '__esModule', { value: true });",
      ...assignments,
      '',
    ].join('\n');
  }
  const declarations = names.map(
    (name, index) => `const reference${index} = clientReference(${JSON.stringify(name)});`,
  );
  const specifiers = names.map((name, index) => `reference${index} as ${JSON.stringify(name)}`);
  return [
    helper,
    ...declarations,
    names.length > 0 ? `export { ${specifiers.join(', ')} };` : 'export {};',
    '',
  ].join('\n');
}

/**
 * The script run under `node --conditions=react-server` that loads each of `files` (paths
 * relative to `dir`) and prints `{ [path]: { phase, message } }` for the failures: `load` when
 * the module does not evaluate, `check` when it loads but `lib/cn.*` does not work, `index.*`
 * does not export the server-side `cn` and a plain `buttonClassNames`, or `lib/classNames.*`
 * exports anything but objects of strings.
 */
function serverProbeSource(dir, files, format) {
  const load =
    format === 'cjs'
      ? `const load = async (path) => require(require('node:path').join(${JSON.stringify(dir)}, path));`
      : `const base = ${JSON.stringify(pathToFileURL(`${dir}/`).href)};\n` +
        'const load = (path) => import(new URL(path, base).href);';
  return `${load}
const files = ${JSON.stringify(files)};
const check = (path, m) => {
  if (/^lib\\/cn\\.[cm]?js$/.test(path)) {
    if (typeof m.cn !== 'function') throw new Error('cn is not exported');
    const out = m.cn('a', false, 'b');
    if (out !== 'a b') throw new Error("cn('a', false, 'b') returned " + JSON.stringify(out));
  }
  if (/^lib\\/classNames\\.[cm]?js$/.test(path)) {
    const names = Object.keys(m).filter((name) => name !== 'default' && name !== '__esModule');
    if (names.length === 0) throw new Error('exports no class-name constant');
    for (const name of names) {
      const value = m[name];
      if (
        typeof value !== 'object' ||
        value === null ||
        !Object.values(value).every((item) => typeof item === 'string')
      ) {
        throw new Error(name + ' is not an object of class-name strings');
      }
    }
  }
  if (/^index\\.[cm]?js$/.test(path)) {
    if (typeof m.cn !== 'function') throw new Error('cn is not exported');
    if (m.cn.$$typeof === Symbol.for('react.client.reference')) {
      throw new Error('cn is a client reference (re-exported from a "use client" module)');
    }
    const constants = m.buttonClassNames;
    if (typeof constants !== 'object' || constants === null) {
      throw new Error(
        'buttonClassNames is not a plain object (missing, or a client reference re-exported from a "use client" module)',
      );
    }
    if (constants.root !== 'wave-button') {
      throw new Error('buttonClassNames.root is ' + JSON.stringify(constants.root) + ", not 'wave-button'");
    }
  }
  if (/^lib\\/color\\.[cm]?js$/.test(path)) {
    if (typeof m.hsvToHex !== 'function' || typeof m.hexToHsv !== 'function') {
      throw new Error('hsvToHex and hexToHsv are not both exported');
    }
    const red = m.hsvToHex({ h: 0, s: 1, v: 1 });
    if (red !== '#ff0000') {
      throw new Error('hsvToHex({ h: 0, s: 1, v: 1 }) returned ' + JSON.stringify(red));
    }
    const hsv = m.hexToHsv('#ff0000');
    if (!hsv || hsv.h !== 0 || hsv.s !== 1 || hsv.v !== 1 || 'a' in hsv) {
      throw new Error("hexToHsv('#ff0000') returned " + JSON.stringify(hsv));
    }
  }
  if (/^lib\\/toaster\\.[cm]?js$/.test(path)) {
    if (typeof m.createToaster !== 'function') throw new Error('createToaster is not exported');
    const handle = m.createToaster();
    for (const key of ['dispatchToast', 'dismissToast', 'dismissAllToasts']) {
      if (typeof handle[key] !== 'function') throw new Error('the handle has no ' + key + '()');
    }
    // A dispatch on the server does nothing (spec D33): it returns its id and leaves no state
    // behind for the next request.
    const globals = Reflect.ownKeys(globalThis).length;
    const id = handle.dispatchToast('x');
    if (typeof id !== 'string' || id === '') {
      throw new Error("dispatchToast('x') returned " + JSON.stringify(id) + ', not an id');
    }
    const given = handle.dispatchToast({ title: 'x', toastId: 'fixed' });
    if (given !== 'fixed') {
      throw new Error("dispatchToast({ toastId: 'fixed' }) returned " + JSON.stringify(given));
    }
    handle.dismissToast(id);
    handle.dismissAllToasts();
    if (Reflect.ownKeys(globalThis).length !== globals) {
      throw new Error('a dispatch on the server added a global (it must do nothing)');
    }
  }
  if (/^lib\\/date\\.[cm]?js$/.test(path)) {
    const day = new Date(2024, 0, 31);
    const next = typeof m.addDays === 'function' ? m.addDays(day, 1) : undefined;
    if (!(next instanceof Date) || next.getMonth() !== 1 || next.getDate() !== 1) {
      throw new Error('addDays(new Date(2024, 0, 31), 1) returned ' + String(next) + ', not 1 February 2024');
    }
    if (day.getDate() !== 31) throw new Error('addDays changed its argument');
  }
  if (/^lib\\/tokens\\.[cm]?js$/.test(path)) {
    const style =
      typeof m.getTokenStyle === 'function'
        ? m.getTokenStyle({ brand80: '#c43e00', zOverlay: 2000 })
        : undefined;
    if (JSON.stringify(style) !== '{"--wave-brand-80":"#c43e00","--wave-z-overlay":"2000"}') {
      throw new Error("getTokenStyle({ brand80: '#c43e00', zOverlay: 2000 }) returned " + JSON.stringify(style));
    }
    if (m.getTokenStyle(null) !== undefined) {
      throw new Error('getTokenStyle(null) returned ' + JSON.stringify(m.getTokenStyle(null)) + ', not undefined');
    }
  }
  if (/^lib\\/waveTokens\\.[cm]?js$/.test(path)) {
    const tokens = m.waveTokens;
    if (typeof tokens !== 'object' || tokens === null || !Array.isArray(m.chartPalette)) {
      throw new Error('waveTokens and chartPalette are not both exported');
    }
    const first = tokens[m.chartPalette[0]];
    if (first !== 'var(--wave-palette-blue)' || tokens.brand80 !== 'var(--wave-brand-80)') {
      throw new Error(
        'waveTokens[chartPalette[0]] is ' + JSON.stringify(first) + ' and waveTokens.brand80 ' +
          JSON.stringify(tokens.brand80) + ', not "var(--wave-palette-blue)" and "var(--wave-brand-80)"',
      );
    }
  }
  if (/^lib\\/brand\\.[cm]?js$/.test(path)) {
    if (typeof m.createBrandTokens !== 'function') throw new Error('createBrandTokens is not exported');
    // The default seed gives the default ramp: its 16 stops, stop 80 the seed itself.
    const brand = m.createBrandTokens('#0f6cbd');
    if (!brand || Object.keys(brand).length !== 16 || brand.brand80 !== '#0f6cbd') {
      throw new Error(
        "createBrandTokens('#0f6cbd') returned " +
          (brand && Object.keys(brand).length === 16
            ? 'a brand80 of ' + JSON.stringify(brand.brand80) + ', not "#0f6cbd"'
            : JSON.stringify(brand)),
      );
    }
  }
  if (/^index\\.[cm]?js$/.test(path)) {
    for (const name of ['hsvToHex', 'hexToHsv', 'createToaster', 'addDays', 'getTokenStyle', 'createBrandTokens']) {
      if (typeof m[name] !== 'function') throw new Error(name + ' is not exported');
      if (m[name].$$typeof === Symbol.for('react.client.reference')) {
        throw new Error(name + ' is a client reference (re-exported from a "use client" module)');
      }
    }
    for (const name of ['waveTokens', 'chartPalette']) {
      if (typeof m[name] !== 'object' || m[name] === null) {
        throw new Error(
          name + ' is not a plain object (missing, or a client reference re-exported from a "use client" module)',
        );
      }
    }
    const next = m.addDays(new Date(2024, 0, 31), 1);
    if (!(next instanceof Date) || next.getMonth() !== 1 || next.getDate() !== 1) {
      throw new Error('addDays(new Date(2024, 0, 31), 1) returned ' + String(next) + ', not a Date');
    }
  }
};
const message = (error) => String((error && error.message) || error).split('\\n')[0];
(async () => {
  const failures = {};
  for (const path of files) {
    let m;
    try {
      m = await load(path);
    } catch (error) {
      failures[path] = { phase: 'load', message: message(error) };
      continue;
    }
    try {
      check(path, m);
    } catch (error) {
      failures[path] = { phase: 'check', message: message(error) };
    }
  }
  process.stdout.write('\\n' + JSON.stringify(failures) + '\\n');
})();
`;
}

/** Runs a probe script with `node --conditions=react-server`; returns its failures. */
function runServerProbe(script) {
  const result = spawnSync(process.execPath, ['--conditions=react-server', script], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const last = (result.stdout ?? '').trim().split('\n').pop() ?? '';
  try {
    if (result.status === 0) return JSON.parse(last);
  } catch {
    // Reported below.
  }
  const output = `${result.stderr}${result.stdout}`.trim().split('\n');
  const reason = output.find((line) => /Error|error:/.test(line)) ?? output[0] ?? '';
  throw new Error(`the probe exited with ${result.status}: ${reason.trim()}`);
}

/** Dist-relative paths of the relative imports of the dist file `path`. */
function relativeImports(dist, path) {
  const file = join(dist, path);
  return importSpecifiers(readFileSync(file, 'utf8'))
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => toPosix(relative(dist, resolve(dirname(file), specifier))));
}

/**
 * The package loads in a React Server Component (repo-level#2). An RSC bundler replaces every
 * `"use client"` module with client references and evaluates the rest on the server — the
 * `index.*` entries, `dist/lib/**` and the bundler runtime. This check does the same with a copy
 * of `dist` (export names of the client modules read by loading them normally, the copy placed
 * next to `dist` so dependencies resolve alike) and loads every other module, both formats, under
 * `node --conditions=react-server`. Reported: a module that does not evaluate (a client-only
 * React API at module scope, dotting into a client reference) — only the root cause, not the
 * modules that fail because they import it; a `lib/cn.*` that does not work; an `index.*` whose
 * `cn` is missing or a client reference, or whose `buttonClassNames` is no plain object with the
 * root `wave-button`; a `lib/classNames.*` export that is not an object of strings.
 */
export async function checkServerImport(dist) {
  const errors = [];
  const distRoot = resolve(dist);
  for (const path of ['lib/cn.mjs', 'lib/cn.cjs']) {
    if (!existsSync(join(distRoot, path))) errors.push(`${path} is missing`);
  }
  for (const path of SERVER_SAFE_MODULES) {
    if (!existsSync(join(distRoot, path))) errors.push(`${path} is missing`);
  }
  const manifest = join(distRoot, '..', 'package.json');
  const packageType = existsSync(manifest) ? readJson(manifest).type : undefined;
  const files = listFiles(distRoot).filter(
    (path) => JS_FILE.test(path) && !path.split('/').includes('node_modules'),
  );
  const clientFiles = new Set(
    files.filter((path) =>
      directivePrologue(readFileSync(join(distRoot, path), 'utf8')).includes('use client'),
    ),
  );

  // Export names of the client modules, read under the default conditions. A client module that
  // does not load at all is broken for every consumer (checkImports and the entry-loading checks
  // report it); it is left as is, and a server module importing it is not blamed for it.
  const stubs = new Map();
  const unloadable = new Set();
  for (const path of clientFiles) {
    const file = join(distRoot, path);
    const format = isCommonJs(path, packageType) ? 'cjs' : 'esm';
    try {
      const names = Object.keys(
        format === 'cjs' ? require(file) : await import(pathToFileURL(file).href),
      );
      stubs.set(path, clientReferenceStub(path, names, format));
    } catch {
      unloadable.add(path);
    }
  }

  // Next to dist, so the dependencies resolve from the copy as they do from dist.
  const run = createWorkDir(
    join(dirname(distRoot), 'node_modules', '.cache', 'wave-verify-dist'),
    'rsc-',
  );
  const { work } = run;
  const failures = {};
  try {
    const copy = join(work, 'dist');
    cpSync(distRoot, copy, { recursive: true, filter: (source) => !source.endsWith('.map') });
    writeFileSync(join(work, 'package.json'), JSON.stringify({ type: packageType ?? 'commonjs' }));
    for (const [path, source] of stubs) writeFileSync(join(copy, path), source);

    const serverFiles = files.filter((path) => !clientFiles.has(path));
    for (const format of ['esm', 'cjs']) {
      const selected = serverFiles.filter(
        (path) => isCommonJs(path, packageType) === (format === 'cjs'),
      );
      if (selected.length === 0) continue;
      const probe = join(work, format === 'cjs' ? 'probe.cjs' : 'probe.mjs');
      writeFileSync(probe, serverProbeSource(toPosix(copy), selected, format));
      try {
        Object.assign(failures, runServerProbe(probe));
      } catch (error) {
        errors.push(`react-server check (${format}) failed: ${error.message}`);
      }
    }
  } finally {
    removeWorkDir(run);
  }

  for (const [path, { phase, message }] of Object.entries(failures).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (phase === 'load') {
      // A module that fails only because a module it imports fails (or is missing, or is an
      // unloadable client module) is not the cause; that module is reported instead (a missing
      // one by checkImports).
      const dependencies = relativeImports(distRoot, path);
      if (
        dependencies.some(
          (dep) => dep in failures || unloadable.has(dep) || !existsSync(join(distRoot, dep)),
        )
      ) {
        continue;
      }
      errors.push(
        `${path} does not load under node --conditions=react-server, so a Server Component ` +
          `importing the package fails: ${message}`,
      );
    } else {
      errors.push(`${path} under node --conditions=react-server: ${message}`);
    }
  }
  return errors;
}

/** A React component value: a function, or a memo/forwardRef/lazy/context object. */
function isComponentLike(value) {
  if (typeof value === 'function') return true;
  return value !== null && typeof value === 'object' && typeof value.$$typeof === 'symbol';
}

/**
 * The flat sub-component names of the module namespace `mod` (C-COMPOUND): for every export with
 * capitalised component members (`Card.Header`), `CardHeader` must be exported and be the same
 * component. Compounds on `pendingFlatExports` may lack flat names (returned as `pending`), and
 * listed components that are no compound yet are returned as `planned`; a listed compound that
 * is complete, or a listed name that is no exported component, is an error, so the list only
 * shrinks. `final` closes the bridge: the list is ignored and must be empty.
 */
export function checkFlatExports(
  mod,
  { pendingFlatExports = PENDING_FLAT_EXPORTS, final = false } = {},
) {
  const errors = [];
  const pending = [];
  const planned = [];
  if (final && pendingFlatExports.length > 0) {
    errors.push(
      `PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs still lists ` +
        `${[...pendingFlatExports].sort().join(', ')}: the flat-name bridge must be empty ` +
        'before publishing (export the flat names from the barrels, then empty the list)',
    );
  }
  const pendingSet = new Set(final ? [] : pendingFlatExports);
  const compounds = new Set();
  for (const [name, value] of Object.entries(mod)) {
    if (!/^[A-Z]/.test(name) || !isComponentLike(value)) continue;
    const members = Object.keys(value).filter(
      (key) => /^[A-Z]/.test(key) && isComponentLike(value[key]),
    );
    if (members.length === 0) continue;
    compounds.add(name);
    const missing = [];
    for (const member of members) {
      const flat = `${name}${member}`;
      if (!(flat in mod)) missing.push(flat);
      else if (mod[flat] !== value[member]) errors.push(`${flat} !== ${name}.${member}`);
    }
    if (missing.length === 0) {
      if (pendingSet.has(name)) {
        errors.push(
          `remove "${name}" from PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs: ` +
            'all its flat names are exported',
        );
      }
    } else if (pendingSet.has(name)) {
      pending.push(...missing);
    } else {
      for (const flat of missing) {
        errors.push(
          `${flat} is not exported from dist/index.mjs (flat name of ` +
            `${name}.${flat.slice(name.length)}, needed by Server Components)`,
        );
      }
    }
  }
  for (const name of pendingSet) {
    if (compounds.has(name)) continue;
    if (/^[A-Z]/.test(name) && Object.hasOwn(mod, name) && isComponentLike(mod[name])) {
      planned.push(name);
    } else {
      errors.push(
        `remove "${name}" from PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs: ` +
          'it is not an exported component',
      );
    }
  }
  return { errors: errors.sort(), pending: pending.sort(), planned: planned.sort() };
}

/**
 * The names of `names` (default {@link MODULE_ONLY_NAMES}) that the package exports although
 * they are module-only: a value of the module namespace `mod` (`dist/index.mjs`; `index.cjs`
 * exports the same names, {@link checkCjsParity}), or a value or a type that the rolled-up
 * declarations `dts` (`dist/index.d.ts`, when given) export.
 */
export function checkModuleOnlyNames(mod, dts, names = MODULE_ONLY_NAMES) {
  const errors = [];
  const declarations = dts === undefined ? undefined : indexDeclarations(dts);
  for (const name of names) {
    if (Object.hasOwn(mod, name)) {
      errors.push(
        `dist/index.mjs exports ${name}, which is module-only (keep it out of the barrels)`,
      );
    } else if (
      declarations &&
      (declarations.exported.has(name) || declarations.exportedTypes.has(name))
    ) {
      errors.push(`index.d.ts exports ${name}, which is module-only (keep it out of the barrels)`);
    }
  }
  return errors;
}

/** The export names of a namespace or CommonJS exports object. */
function exportNames(mod) {
  return Object.keys(mod).filter((name) => name !== 'default' && name !== '__esModule');
}

/** `dist/index.cjs` exports exactly the names of `dist/index.mjs`. */
export async function checkCjsParity(dist) {
  const esm = exportNames(await import(pathToFileURL(resolve(dist, 'index.mjs')).href));
  const cjs = exportNames(require(resolve(dist, 'index.cjs')));
  const errors = [];
  const onlyEsm = esm.filter((name) => !cjs.includes(name));
  const onlyCjs = cjs.filter((name) => !esm.includes(name));
  if (onlyEsm.length > 0) errors.push(`index.cjs lacks ${onlyEsm.sort().join(', ')}`);
  if (onlyCjs.length > 0) errors.push(`index.mjs lacks ${onlyCjs.sort().join(', ')}`);
  return errors;
}

/**
 * The stable class-name registry (`dist/lib/classNames.*`, spec P3-00) is public API: every
 * constant it exports is exported by the entry of the same format (`dist/index.mjs`,
 * `dist/index.cjs`) with the same value. {@link checkFlatExports} walks only capitalised
 * components, so without this check a constant missing from the entry would pass.
 */
export async function checkClassNameExports(dist) {
  const errors = [];
  const distRoot = resolve(dist);
  const load = (file) => (file.endsWith('.cjs') ? require(file) : import(pathToFileURL(file).href));
  for (const [registryPath, entryPath] of [
    ['lib/classNames.mjs', 'index.mjs'],
    ['lib/classNames.cjs', 'index.cjs'],
  ]) {
    const registryFile = join(distRoot, registryPath);
    if (!existsSync(registryFile)) {
      errors.push(`${registryPath} is missing (the class-name registry, src/lib/classNames.ts)`);
      continue;
    }
    const registry = await load(registryFile);
    const entry = await load(join(distRoot, entryPath));
    for (const name of exportNames(registry)) {
      if (!Object.hasOwn(entry, name)) {
        errors.push(
          `${entryPath} does not export ${name} (a class-name constant of ${registryPath})`,
        );
      } else if (!isDeepStrictEqual(entry[name], registry[name])) {
        errors.push(`${entryPath} exports ${name} with another value than ${registryPath}`);
      }
    }
  }
  return errors;
}

/** Relative paths (in `dist/`) of the modules `path` statically imports, transitively. */
function importClosure(dist, path) {
  const closure = new Set();
  const queue = [path];
  while (queue.length > 0) {
    const current = queue.pop();
    if (closure.has(current)) continue;
    closure.add(current);
    const file = join(dist, current);
    if (!existsSync(file)) continue;
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      queue.push(toPosix(relative(dist, resolve(dirname(file), specifier))));
    }
  }
  return closure;
}

/** Folds a path for comparison (case-insensitive on Windows). */
function fold(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

/** Whether a module id is a bare import (a package), which the probes keep external. */
function isBareImport(id) {
  return /^[^./\0]/.test(id) && !/^[a-zA-Z]:/.test(id);
}

/**
 * Bundles an entry that imports `names` from `dist/index.mjs` with Vite's `build()` API (no
 * write, bare imports external) and returns the output chunks. Every bundle is a production build,
 * whatever `NODE_ENV` this process has: `process.env.NODE_ENV` is defined as `"production"`, as a
 * consumer's production build defines it, so development-only code (the warnings of `lib/dev`, the
 * contrast check of a full brand ramp) is dropped from what the probes see and measure. Vite would
 * otherwise define it from the environment (Vitest runs with `test`). `minify` minifies, as a
 * consumer's production bundle does.
 */
async function bundleImport(distRoot, names, { minify = false } = {}) {
  const { build } = await import('vite');
  const probeDir = mkdtempSync(join(tmpdir(), 'wave-treeshake-'));
  try {
    const entry = join(probeDir, 'probe.mjs');
    const index = toPosix(join(distRoot, 'index.mjs'));
    const list = names.join(', ');
    writeFileSync(
      entry,
      `import { ${list} } from ${JSON.stringify(index)};\nexport { ${list} };\n`,
    );
    const result = await build({
      configFile: false,
      root: probeDir,
      logLevel: 'silent',
      publicDir: false,
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        write: false,
        minify,
        emptyOutDir: false,
        copyPublicDir: false,
        rolldownOptions: {
          input: entry,
          preserveEntrySignatures: 'exports-only',
          external: isBareImport,
          output: { format: 'es' },
          onLog: () => {},
        },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    return outputs.flatMap((output) => output.output).filter((item) => item.type === 'chunk');
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
}

/** The dist modules in `chunks`, as paths relative to `distRoot` (original case). */
function bundledModules(distRoot, chunks) {
  const byFolded = new Map(listFiles(distRoot).map((path) => [fold(path), path]));
  const distPrefix = `${fold(toPosix(distRoot))}/`;
  const included = new Set();
  for (const id of chunks.flatMap((chunk) => chunk.moduleIds)) {
    const folded = fold(toPosix(id));
    if (!folded.startsWith(distPrefix)) continue;
    const path = folded.slice(distPrefix.length);
    included.add(byFolded.get(path) ?? path);
  }
  return included;
}

/** A string literal `text` in any quotes: `'…'`, `"…"` or a template literal without substitutions. */
function quotedLiteral(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(["'\`])${escaped}\\1`);
}

/**
 * The code of a minified bundle of an import of only `keep`: the minifier drops comments and keeps
 * the contents of string literals, so a fragment found here is in code, not in a comment.
 */
async function minifiedCode(distRoot, keep) {
  const chunks = await bundleImport(distRoot, [keep], { minify: true });
  return chunks.map((chunk) => chunk.code).join('\n');
}

/**
 * Tree-shaking probe (repo-level#3): bundles an entry that imports only `keep` from
 * `dist/index.mjs` with Vite's `build()` API (no write, no minification, bare imports external)
 * and asserts that the bundle holds `keep`'s module, only it and its static imports, no code of
 * `drop` (its module or its `displayName`) and none of `dropModules` (dist-relative module paths,
 * such as `hooks/usePresence.mjs`; a listed module that does not exist in `dist` is an error, since
 * the probe would pass vacuously). `keepStrings` and `dropStrings` (the stable class names, P3-00;
 * the motion recipe literals, D23) are string literals, matched with their quotes, that the bundle
 * must, or must not, contain; a listed string that occurs in no JavaScript module of `dist` is an
 * error for the same reason. `dropSubstrings` are fragments that no code of the bundle may contain
 * outside comments (`[presence=`: no string of a Button-only bundle may hold a presence variant),
 * checked on a second, minified bundle of the same entry, which drops comments and keeps string
 * contents. Since the motion resolver's own literal holds `[presence=`, a bundle that reaches
 * `lib/motion` always contains it: the positive control of the recipes is
 * {@link probeIncludes}'s `strings` (the recipe literals), never the fragment alone. `drop: null`
 * drops no component by name, only `dropModules` and the strings (the 0.17 token probes: a Dialog
 * holds the provider's module for its context, but none of the token modules it does not use).
 *
 * The bundler reports module ids as real paths, so the probe imports and matches them through
 * the real path of `dist`: a dist reached through a symlink or a junction (a linked checkout or
 * `node_modules`) is checked module by module, not silently passed with no module matched.
 */
export async function probeTreeShaking(
  dist,
  {
    keep = 'Button',
    drop = 'Dialog',
    dropModules = [],
    keepStrings = [],
    dropStrings = [],
    dropSubstrings = [],
  } = {},
) {
  const errors = [];
  const distRoot = realpathSync(resolve(dist));
  const files = listFiles(distRoot);
  const components = files.filter((path) => path.startsWith('components/'));
  const keepModules = components.filter((path) => path.endsWith(`/${keep}.mjs`));
  const listedModules = new Set(dropModules.map(fold));
  const existing = new Set(files.map(fold));
  for (const path of dropModules) {
    if (!existing.has(fold(path))) {
      errors.push(
        `${path}, listed to be dropped from the bundle of an import of only ${keep}, does not exist in dist`,
      );
    }
  }
  const distCode = files
    .filter((path) => JS_FILE.test(path))
    .map((path) => readFileSync(join(distRoot, path), 'utf8'))
    .join('\n');
  const foundStrings = new Set();
  for (const text of [...keepStrings, ...dropStrings]) {
    if (quotedLiteral(text).test(distCode)) {
      foundStrings.add(text);
    } else {
      errors.push(
        `"${text}", listed for the bundle of an import of only ${keep}, occurs in no module of dist (the probe would pass vacuously)`,
      );
    }
  }
  const dropped = new Set([
    ...(drop === null ? [] : components.filter((path) => path.endsWith(`/${drop}.mjs`)).map(fold)),
    ...listedModules,
  ]);
  if (keepModules.length === 0) {
    errors.push(`no dist module for ${keep} (components/**/${keep}.mjs): dist is not per module`);
  }

  const chunks = await bundleImport(distRoot, [keep]);
  const code = chunks.map((chunk) => chunk.code).join('\n');
  const included = bundledModules(distRoot, chunks);
  const allowed = new Set();
  for (const path of keepModules) {
    for (const module of importClosure(distRoot, path)) allowed.add(fold(module));
  }
  for (const path of keepModules) {
    if (!included.has(path)) {
      errors.push(`${path} is not in the bundle of an import of only ${keep}`);
    }
  }
  for (const path of [...included].sort()) {
    if (dropped.has(fold(path))) {
      errors.push(
        `${path} is in the bundle of an import of only ${keep} (${drop === null ? 'it' : drop} must be dropped)`,
      );
    } else if (!allowed.has(fold(path))) {
      errors.push(`${path} is in the bundle of an import of only ${keep} (not one of its imports)`);
    }
  }
  const displayName = (name) => new RegExp(`\\.displayName\\s*=\\s*(["'\`])${name}\\1`);
  if (drop !== null && displayName(drop).test(code)) {
    errors.push(
      `${drop} code (displayName "${drop}") is in the bundle of an import of only ${keep}`,
    );
  }
  if (keepModules.length > 0 && !displayName(keep).test(code)) {
    errors.push(`the probe bundle lacks ${keep} (displayName "${keep}")`);
  }
  for (const text of keepStrings) {
    if (foundStrings.has(text) && !quotedLiteral(text).test(code)) {
      errors.push(`the bundle of an import of only ${keep} lacks the string "${text}"`);
    }
  }
  for (const text of dropStrings) {
    if (foundStrings.has(text) && quotedLiteral(text).test(code)) {
      errors.push(
        `the bundle of an import of only ${keep} contains the string "${text}" (an unused constant was not tree-shaken)`,
      );
    }
  }
  if (dropSubstrings.length > 0) {
    const minified = await minifiedCode(distRoot, keep);
    for (const text of dropSubstrings) {
      if (minified.includes(text)) {
        errors.push(
          `the bundle of an import of only ${keep} contains "${text}" outside comments (its minified code)`,
        );
      }
    }
  }
  return errors;
}

/**
 * The motion recipes' module (spec §2.2, D23): server-safe, so the probe imports it in Node.js.
 * Vite emits it only once a component imports it.
 */
const MOTION_MODULE = 'lib/motion.mjs';

/**
 * The fewest recipe literals {@link motionRecipeLiterals} accepts from {@link MOTION_MODULE}: the
 * release count of spec §2.2's table (0.15), every literal of `src/lib/motion.ts` read by
 * {@link motionLiteralsOf} (`verify-dist.test.mjs` pins the two equal). A recipe the build drops
 * (no component imports it, so Rollup leaves it out) fails the probe, which would otherwise stop
 * looking for its literal in the Button-only bundle; a new recipe raises the count.
 */
export const MOTION_RECIPE_MIN = 38;

/** The motion hook's module (spec §2.3, D23): only a component that animates imports it. */
const MOTION_HOOK_MODULE = 'hooks/useMotion.mjs';

/** The keyed presence group's module (spec §2.6, D21): only MessageBarGroup imports it. */
const PRESENCE_GROUP_MODULE = 'hooks/usePresenceGroup.mjs';

/**
 * The exclusion probes of 0.15 (spec §2.10, D21): an import of only `MessageBar` holds neither the
 * presence core nor the presence group, so a page of MessageBars without a MessageBarGroup loads
 * none of the group's motion.
 */
export const EXCLUSION_PROBES_0_15 = [
  {
    keep: 'MessageBar',
    drop: 'MessageBarGroup',
    dropModules: [PRESENCE_MODULE, PRESENCE_GROUP_MODULE],
  },
];

/**
 * The positive controls of the Button-only motion probe (spec §2.10, D23): an import of only
 * `keep` holds each of `modules` and the literals of `recipes` (exports of {@link MOTION_MODULE},
 * read by name from dist with {@link motionRecipeValues}), and its code each of `substrings`, so
 * the matchers that must find nothing in the Button-only bundle find motion where it is: the
 * Dialog's surface and backdrop, the collapse of Accordion (and so of Tree and Nav, on the same
 * hook), and the bars of a MessageBarGroup on the presence group.
 */
export const MOTION_INCLUDE_PROBES = [
  {
    keep: 'Dialog',
    modules: [MOTION_MODULE, MOTION_HOOK_MODULE],
    recipes: ['dialogMotion', 'dialogBackdropMotion'],
    substrings: ['[presence='],
  },
  {
    keep: 'Accordion',
    modules: [MOTION_MODULE, 'hooks/useCollapsePresence.mjs'],
    recipes: ['collapseStructure', 'collapseMotion'],
  },
  {
    keep: 'MessageBarGroup',
    modules: [PRESENCE_GROUP_MODULE, MOTION_MODULE],
    recipes: [
      'messageBarGroupItemStructure',
      'messageBarGroupExitMotion',
      'messageBarGroupEnterMotion',
    ],
  },
];

/**
 * The text one of which every motion literal holds (spec §2.10; `duration-wave-` because the drawer
 * durations, a recipe composed with the drawer motion at run time, hold none of the other three).
 */
const MOTION_RECIPE_MARKERS = ['[presence=', 'transition', 'animate-', 'duration-wave-'];

/**
 * Every string value of the exports of the module namespace `mod`, one level into records
 * (exports in name order, as a module namespace lists them, a record's values in key order), each
 * value once: the recipe literals of a motion module. Functions (the resolver) are skipped.
 * Errors, prefixed with `label`: a value holds none of {@link MOTION_RECIPE_MARKERS} (not a
 * recipe), or an export is neither a string, a record of strings nor a function.
 * {@link motionRecipeLiterals} reads `dist/lib/motion.mjs` with it, and `verify-dist.test.mjs`
 * the source module, `src/lib/motion.ts`, to pin {@link MOTION_RECIPE_MIN}.
 */
export function motionLiteralsOf(mod, label = MOTION_MODULE) {
  const literals = [];
  const errors = [];
  const add = (name, value) => {
    if (!MOTION_RECIPE_MARKERS.some((marker) => value.includes(marker))) {
      errors.push(
        `${label}: ${name} ("${value}") holds none of ${MOTION_RECIPE_MARKERS.join(', ')} (not a recipe)`,
      );
    }
    if (!literals.includes(value)) literals.push(value);
  };
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === 'function') continue;
    if (typeof value === 'string') {
      add(name, value);
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'string')
    ) {
      for (const [key, item] of Object.entries(value)) add(`${name}.${key}`, item);
    } else {
      errors.push(`${label}: ${name} is neither a string, a record of strings nor a function`);
    }
  }
  return { literals, errors };
}

/**
 * Every recipe literal of `dist/lib/motion.mjs` ({@link motionLiteralsOf}), imported by file URL:
 * the literals the Button-only probe must not find (`dropStrings`; spec D23). Errors: those of
 * {@link motionLiteralsOf}, the module does not exist (the probe would pass vacuously), or it
 * holds fewer than `min` distinct literals.
 */
export async function motionRecipeLiterals(dist, { min = MOTION_RECIPE_MIN } = {}) {
  const file = join(realpathSync(resolve(dist)), MOTION_MODULE);
  if (!existsSync(file)) {
    return { literals: [], errors: [`${MOTION_MODULE} does not exist in dist`] };
  }
  const { literals, errors } = motionLiteralsOf(await import(pathToFileURL(file).href));
  if (literals.length < min) {
    errors.push(
      `${MOTION_MODULE} holds ${literals.length} recipe literals, fewer than the minimum of ${min}`,
    );
  }
  return { literals, errors };
}

/**
 * The values of the recipes `names` of `dist/lib/motion.mjs` (imported by file URL), in the order
 * of `names`: the literals a positive control looks for in the bundle of the component that uses
 * them (spec §2.10). Errors: the module does not exist, or a name is not a string export.
 */
export async function motionRecipeValues(dist, names) {
  const file = join(realpathSync(resolve(dist)), MOTION_MODULE);
  if (!existsSync(file)) {
    return { strings: [], errors: [`${MOTION_MODULE} does not exist in dist`] };
  }
  const mod = await import(pathToFileURL(file).href);
  const strings = [];
  const errors = [];
  for (const name of names) {
    if (typeof mod[name] === 'string') strings.push(mod[name]);
    else errors.push(`${MOTION_MODULE} exports no recipe string ${name}`);
  }
  return { strings, errors };
}

/**
 * Inclusion probe: bundles an entry that imports only `keep` from `dist/index.mjs`, as the
 * tree-shaking probe does, and reports each of `modules` (dist-relative module paths) that is not
 * in the bundle — a probe that detects a module where it is used, so a check that it is dropped
 * elsewhere cannot pass because the module is missing. `strings` are string literals, matched
 * whole with their quotes, that the bundle must contain; `substrings` are fragments its code
 * (minified, so comments are dropped and string contents kept) must contain: the same matchers as
 * the tree-shaking probe's `dropStrings` and `dropSubstrings`, so a positive control proves they
 * see what they look for (spec D23). The recipes' control lists their literals in `strings`: the
 * motion resolver's own literal holds `[presence=`, so that fragment alone is found in any bundle
 * that reaches `lib/motion`, recipes or not.
 */
export async function probeIncludes(dist, { keep, modules, strings = [], substrings = [] }) {
  const distRoot = realpathSync(resolve(dist));
  const chunks = await bundleImport(distRoot, [keep]);
  const included = new Set([...bundledModules(distRoot, chunks)].map(fold));
  const errors = modules
    .filter((path) => !included.has(fold(path)))
    .map((path) => `${path} is not in the bundle of an import of only ${keep}`);
  const code = chunks.map((chunk) => chunk.code).join('\n');
  for (const text of strings) {
    if (!quotedLiteral(text).test(code)) {
      errors.push(`the bundle of an import of only ${keep} lacks the string "${text}"`);
    }
  }
  if (substrings.length > 0) {
    const minified = await minifiedCode(distRoot, keep);
    for (const text of substrings) {
      if (!minified.includes(text)) {
        errors.push(
          `the bundle of an import of only ${keep} lacks "${text}" outside comments (its minified code)`,
        );
      }
    }
  }
  return errors;
}

/**
 * Hook probe: bundles an entry that imports only `keep` from `dist/index.mjs` and reports each of
 * `modules` missing from the bundle, each of `dropModules` in it (a listed module that does not
 * exist in `dist` is an error: the probe would pass vacuously), each other module of the bundle
 * under one of the `dropPrefixes` (dist directories such as `components/`; a prefix that no module
 * of `dist` is under is an error for the same reason), each of `dropExternals` that the bundle
 * imports, and each of `dropSubstrings` that the code of its minified bundle holds (fragments of
 * code that a production build drops, such as a development check's warning keys; a fragment that
 * no JavaScript module of `dist` holds is an error, for the same reason).
 */
export async function probeHook(
  dist,
  {
    keep,
    modules = [],
    dropModules = [],
    dropPrefixes = [],
    dropExternals = [],
    dropSubstrings = [],
  },
) {
  const distRoot = realpathSync(resolve(dist));
  const files = listFiles(distRoot);
  const existing = new Set(files.map(fold));
  const errors = [];
  for (const path of [...modules, ...dropModules]) {
    if (!existing.has(fold(path)))
      errors.push(`${path}, listed for the hook ${keep}, does not exist in dist`);
  }
  for (const prefix of dropPrefixes) {
    if (!files.some((path) => fold(path).startsWith(fold(prefix)))) {
      errors.push(
        `no module of dist is under ${prefix}, listed for the hook ${keep} (the probe would pass vacuously)`,
      );
    }
  }
  const chunks = await bundleImport(distRoot, [keep]);
  const bundled = [...bundledModules(distRoot, chunks)].sort();
  const included = new Set(bundled.map(fold));
  for (const path of modules) {
    if (!included.has(fold(path)))
      errors.push(`${path} is not in the bundle of an import of only ${keep}`);
  }
  const listed = new Set(dropModules.map(fold));
  for (const path of dropModules) {
    if (included.has(fold(path)))
      errors.push(`${path} is in the bundle of an import of only ${keep}`);
  }
  for (const path of bundled) {
    if (listed.has(fold(path))) continue;
    const prefix = dropPrefixes.find((candidate) => fold(path).startsWith(fold(candidate)));
    if (prefix !== undefined) {
      errors.push(
        `${path} is in the bundle of an import of only ${keep} (no module under ${prefix} may be)`,
      );
    }
  }
  const chunkNames = new Set(chunks.map((chunk) => chunk.fileName));
  const imported = new Set(
    chunks
      .flatMap((chunk) => [...chunk.imports, ...chunk.dynamicImports])
      .filter((id) => !chunkNames.has(id)),
  );
  for (const id of dropExternals) {
    if (imported.has(id)) errors.push(`the bundle of an import of only ${keep} imports ${id}`);
  }
  if (dropSubstrings.length > 0) {
    const distCode = files
      .filter((path) => JS_FILE.test(path))
      .map((path) => readFileSync(join(distRoot, path), 'utf8'))
      .join('\n');
    const minified = await minifiedCode(distRoot, keep);
    for (const text of dropSubstrings) {
      if (!distCode.includes(text)) {
        errors.push(
          `"${text}", listed for the hook ${keep}, occurs in no module of dist (the probe would pass vacuously)`,
        );
      } else if (minified.includes(text)) {
        errors.push(
          `the bundle of an import of only ${keep} contains "${text}" outside comments (its minified code)`,
        );
      }
    }
  }
  return errors;
}

/**
 * The size of an import of `names` from `dist/index.mjs`: a minified Vite build of an entry that
 * imports them, bare imports external, as a consumer's production bundle has it. Returns the
 * minified and gzip (`node:zlib`) sizes in bytes and the external ids the closure imports (sorted).
 */
export async function measureImport(dist, names) {
  const distRoot = realpathSync(resolve(dist));
  const chunks = await bundleImport(distRoot, names, { minify: true });
  const code = chunks.map((chunk) => chunk.code).join('\n');
  const chunkNames = new Set(chunks.map((chunk) => chunk.fileName));
  const externals = [
    ...new Set(
      chunks
        .flatMap((chunk) => [...chunk.imports, ...chunk.dynamicImports])
        .filter((id) => !chunkNames.has(id)),
    ),
  ].sort();
  return { minified: Buffer.byteLength(code), gzip: gzipSync(code).length, externals };
}

/**
 * Size budget probe: measures an import of `names` ({@link measureImport}). Returns the minified
 * and gzip sizes in bytes, the external ids the closure imports (sorted), an error for each budget
 * exceeded, and an error for each external id not in `allowedExternals` (a dependency outside the
 * measurement, such as tailwind-merge through `cn`, would hide its size).
 */
export async function probeSizeBudget(
  dist,
  { names, maxMinifiedBytes, maxGzipBytes, allowedExternals },
) {
  const { minified, gzip, externals } = await measureImport(dist, names);
  const label = names.join(' + ');
  const errors = [];
  if (minified > maxMinifiedBytes) {
    errors.push(`${label}: ${minified} bytes minified, over the budget of ${maxMinifiedBytes}`);
  }
  if (gzip > maxGzipBytes) {
    errors.push(`${label}: ${gzip} bytes gzip, over the budget of ${maxGzipBytes}`);
  }
  for (const id of externals) {
    if (!allowedExternals.includes(id)) {
      errors.push(
        `${label} imports ${id}, outside the measured closure (allowed: ${allowedExternals.join(', ')})`,
      );
    }
  }
  return { minified, gzip, externals, errors };
}

/**
 * Runs every check on `dist` (its parent directory holds the package.json). Returns the errors,
 * the flat names still pending and the listed components that are no compound yet (see
 * {@link PENDING_FLAT_EXPORTS}), the measured sizes of the presence core (`budget`) and of the
 * window (`virtualBudget`; minified and gzip bytes, `null` when the probe failed), and the
 * measured sizes of {@link RECORDED_IMPORTS} and then of {@link RECORDED_IMPORTS_0_17}
 * (`recorded`: `{ names, minified, gzip, baseline }` each, `baseline` `null` for an import new in
 * 0.17, and its `budget` where it has one, whose errors join the others); `final` closes the
 * pending bridge.
 */
export async function verifyDist(
  dist,
  { pendingFlatExports = PENDING_FLAT_EXPORTS, final = false } = {},
) {
  const distRoot = resolve(dist);
  if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
    return {
      errors: [`${dist} does not exist (run vite build first)`],
      pending: [],
      planned: [],
      budget: null,
    };
  }
  const pkg = readJson(join(distRoot, '..', 'package.json'));
  const errors = [
    ...checkDeclarations(distRoot),
    ...checkDevEnvironment(distRoot),
    ...checkDirectives(distRoot),
    ...checkImports(distRoot, pkg),
    ...checkDevOnlyLibraries(distRoot),
  ];
  try {
    errors.push(...(await checkServerImport(distRoot)));
  } catch (error) {
    errors.push(`react-server check failed: ${error.message}`);
  }
  let pending = [];
  let planned = [];
  try {
    const mod = await import(pathToFileURL(join(distRoot, 'index.mjs')).href);
    const flat = checkFlatExports(mod, { pendingFlatExports, final });
    errors.push(...flat.errors);
    pending = flat.pending;
    planned = flat.planned;
    errors.push(...(await checkCjsParity(distRoot)));
    const dts = join(distRoot, 'index.d.ts');
    errors.push(
      ...checkModuleOnlyNames(mod, existsSync(dts) ? readFileSync(dts, 'utf8') : undefined),
    );
  } catch (error) {
    errors.push(`index.mjs/index.cjs do not load in Node.js: ${error.message}`);
  }
  try {
    errors.push(...(await checkClassNameExports(distRoot)));
  } catch (error) {
    errors.push(`class-name export check failed: ${error.message}`);
  }
  try {
    errors.push(
      ...(await probeTreeShaking(distRoot, {
        keep: 'Button',
        drop: 'Dialog',
        ...BUTTON_ONLY_STRINGS,
      })),
    );
    // D23 (0.15): an import of only Button holds no presence core, no motion module, no recipe
    // literal of lib/motion and no presence variant in any string.
    const motion = await motionRecipeLiterals(distRoot);
    errors.push(...motion.errors);
    errors.push(
      ...(await probeTreeShaking(distRoot, {
        keep: 'Button',
        drop: 'Presence',
        dropModules: [PRESENCE_MODULE, MOTION_MODULE, MOTION_HOOK_MODULE],
        dropStrings: motion.literals,
        dropSubstrings: ['[presence='],
      })),
    );
    errors.push(
      ...(await probeTreeShaking(distRoot, {
        keep: 'Button',
        drop: 'ColorArea',
        dropModules: OPT_IN_MODULES,
      })),
    );
    errors.push(
      ...(await probeTreeShaking(distRoot, {
        keep: 'Field',
        drop: 'InfoButton',
        dropModules: [INFO_BUTTON_MODULE],
        ...FIELD_ONLY_STRINGS,
      })),
    );
    // D37 (0.10): a Calendar holds no listbox code, a Listbox no calendar code.
    errors.push(...(await probeTreeShaking(distRoot, CALENDAR_ONLY)));
    errors.push(...(await probeTreeShaking(distRoot, LISTBOX_ONLY)));
    // 0.11: tags, pickers, overlays and navigation.
    for (const probe of EXCLUSION_PROBES_0_11) {
      errors.push(...(await probeTreeShaking(distRoot, probe)));
    }
    // D21 (0.15): a MessageBar holds no presence core and no presence group.
    for (const probe of EXCLUSION_PROBES_0_15) {
      errors.push(...(await probeTreeShaking(distRoot, probe)));
    }
    // 0.16 (spec §11): the grid and the flat tree hold none of each other's code, and a Button, a
    // MessageBar and a Tree none of the new modules (a Tree only the cascade it moved to).
    for (const probe of EXCLUSION_PROBES_0_16) {
      errors.push(...(await probeTreeShaking(distRoot, probe)));
    }
    // 0.17 (spec §10): a Dialog and a Tree hold neither the names tuple nor the brand generator,
    // and a Button and a MessageBar no token module and not the provider.
    for (const probe of EXCLUSION_PROBES_0_17) {
      errors.push(...(await probeTreeShaking(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`tree-shaking probe failed: ${error.message}`);
  }
  try {
    for (const probe of HOOK_PROBES_0_12) {
      errors.push(...(await probeHook(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.12 hook probe failed: ${error.message}`);
  }
  try {
    for (const probe of HOOK_PROBES_0_13) {
      errors.push(...(await probeHook(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.13 helper probe failed: ${error.message}`);
  }
  try {
    for (const probe of HOOK_PROBES_0_14) {
      errors.push(...(await probeHook(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.14 helper probe failed: ${error.message}`);
  }
  try {
    for (const probe of HOOK_PROBES_0_16) {
      errors.push(...(await probeHook(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.16 hook probe failed: ${error.message}`);
  }
  try {
    for (const probe of HOOK_PROBES_0_17) {
      errors.push(...(await probeHook(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.17 helper probe failed: ${error.message}`);
  }
  try {
    for (const probe of INCLUSION_PROBES_0_11) {
      errors.push(...(await probeIncludes(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.11 include probe failed: ${error.message}`);
  }
  try {
    for (const probe of INCLUSION_PROBES_0_16) {
      errors.push(...(await probeIncludes(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.16 include probe failed: ${error.message}`);
  }
  try {
    for (const probe of INCLUSION_PROBES_0_17) {
      errors.push(...(await probeIncludes(distRoot, probe)));
    }
  } catch (error) {
    errors.push(`0.17 include probe failed: ${error.message}`);
  }
  try {
    errors.push(
      ...(await probeIncludes(distRoot, {
        keep: PRESENCE_INCLUDE_KEEP,
        modules: [PRESENCE_MODULE],
      })),
    );
  } catch (error) {
    errors.push(`presence include probe failed: ${error.message}`);
  }
  try {
    errors.push(
      ...(await probeIncludes(distRoot, {
        keep: TOASTER_INCLUDE_KEEP,
        modules: [PRESENCE_MODULE],
      })),
    );
  } catch (error) {
    errors.push(`toaster include probe failed: ${error.message}`);
  }
  try {
    // D23 (0.15): the positive controls of the Button-only motion probe. Each component's own
    // recipe literals prove its matchers (the resolver's literal alone holds the presence variant).
    for (const { recipes, ...probe } of MOTION_INCLUDE_PROBES) {
      const values = await motionRecipeValues(distRoot, recipes);
      errors.push(...values.errors);
      errors.push(...(await probeIncludes(distRoot, { ...probe, strings: values.strings })));
    }
  } catch (error) {
    errors.push(`motion include probe failed: ${error.message}`);
  }
  let budget = null;
  try {
    const {
      minified,
      gzip,
      errors: budgetErrors,
    } = await probeSizeBudget(distRoot, PRESENCE_BUDGET);
    errors.push(...budgetErrors);
    budget = { minified, gzip };
  } catch (error) {
    errors.push(`presence size budget probe failed: ${error.message}`);
  }
  let virtualBudget = null;
  try {
    const {
      minified,
      gzip,
      errors: budgetErrors,
    } = await probeSizeBudget(distRoot, VIRTUAL_BUDGET);
    errors.push(...budgetErrors);
    virtualBudget = { minified, gzip };
  } catch (error) {
    errors.push(`window size budget probe failed: ${error.message}`);
  }
  const recorded = [];
  try {
    for (const { names, baseline, budget: importBudget } of [
      ...RECORDED_IMPORTS,
      ...RECORDED_IMPORTS_0_17,
    ]) {
      if (importBudget) {
        const {
          minified,
          gzip,
          errors: budgetErrors,
        } = await probeSizeBudget(distRoot, importBudget);
        errors.push(...budgetErrors);
        recorded.push({ names, minified, gzip, baseline, budget: importBudget });
      } else {
        const { minified, gzip } = await measureImport(distRoot, names);
        recorded.push({ names, minified, gzip, baseline });
      }
    }
  } catch (error) {
    errors.push(`recorded size measurement failed: ${error.message}`);
  }
  return { errors, pending, planned, budget, virtualBudget, recorded };
}

/**
 * `size` against `base` as a signed percentage with two decimals (`+43.78 %`, `-0.03 %`), fine
 * enough for the ±1 % of the Tree-only import.
 */
function percentChange(size, base) {
  const change = ((size - base) / base) * 100;
  return `${change < 0 ? '' : '+'}${change.toFixed(2)} %`;
}

function parseArgs(argv) {
  const options = {
    dist: join(root, 'dist'),
    pendingFlatExports: PENDING_FLAT_EXPORTS,
    final: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dist') options.dist = resolve(argv[++i]);
    else if (argv[i] === '--no-pending') options.pendingFlatExports = [];
    else if (argv[i] === '--final') options.final = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return options;
}

/** CLI entry; returns the exit code. `io` receives the report (default: the console). */
export async function main(argv = process.argv.slice(2), io = console) {
  const { dist, pendingFlatExports, final } = parseArgs(argv);
  const { errors, pending, planned, budget, virtualBudget, recorded } = await verifyDist(dist, {
    pendingFlatExports,
    final,
  });
  const where = toPosix(relative(process.cwd(), dist) || dist);
  if (budget) {
    io.log(
      `verify-dist: presence core (${PRESENCE_BUDGET.names.join(' + ')}): ` +
        `${budget.minified} B minified (budget ${PRESENCE_BUDGET.maxMinifiedBytes}), ` +
        `${budget.gzip} B gzip (budget ${PRESENCE_BUDGET.maxGzipBytes})`,
    );
  }
  if (virtualBudget) {
    io.log(
      `verify-dist: window (${VIRTUAL_BUDGET.names.join(' + ')}): ` +
        `${virtualBudget.minified} B minified (budget ${VIRTUAL_BUDGET.maxMinifiedBytes}), ` +
        `${virtualBudget.gzip} B gzip (budget ${VIRTUAL_BUDGET.maxGzipBytes})`,
    );
  }
  for (const { names, minified, gzip, baseline, budget: importBudget } of recorded ?? []) {
    const limit = (max) => (importBudget ? ` (budget ${max})` : '');
    // An import new in 0.17 has no baseline to compare with.
    const against = baseline
      ? ` (${baseline.version}: ${baseline.minified} B, ${baseline.gzip} B; ` +
        `${percentChange(minified, baseline.minified)}, ${percentChange(gzip, baseline.gzip)})`
      : '';
    io.log(
      `verify-dist: ${names.join(' + ')}-only import: ` +
        `${minified} B minified${limit(importBudget?.maxMinifiedBytes)}, ` +
        `${gzip} B gzip${limit(importBudget?.maxGzipBytes)}${against}`,
    );
  }
  if (errors.length > 0) {
    io.error(`verify-dist: ${errors.length} problem(s) in ${where}:`);
    for (const error of errors) io.error(`  - ${error}`);
    return 1;
  }
  if (pending.length > 0 || planned.length > 0) {
    const parts = [];
    if (pending.length > 0) parts.push(`flat names ${pending.join(', ')}`);
    if (planned.length > 0) parts.push(`not compounds yet: ${planned.join(', ')}`);
    io.log(
      `verify-dist: PENDING_FLAT_EXPORTS bridge open (C-COMPOUND; ${parts.join('; ')}). ` +
        '`verify-dist --final` (prepublishOnly, the final gate) fails until it is empty.',
    );
  }
  io.log(`verify-dist: ${where} OK${final ? ' (final)' : ''}`);
  return 0;
}

await runScript(import.meta.url, main);
