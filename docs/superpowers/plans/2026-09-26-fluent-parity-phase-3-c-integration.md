# WaveUI 0.8.0 Phase 3 — INTEGRATION (wave C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Join the four wave-B packages into the public 0.8 API: export every new part, type and helper through the barrels and the entry, close the four pending lists, add the `verify-dist` probes that need the wave-B modules, pin the cross-package behaviour with integration and public-type tests, and pass the full gate with `verify-dist --final`.

**Architecture:** INTEGRATION runs alone after wave B and owns every file while it runs. It extends the barrels and `src/index.ts` (the only place where the new names become public), empties `PENDING_FLAT_EXPORTS`, `PENDING_CLASS_NAMES`, `PENDING_PUBLIC_TYPES` and `PENDING_FLAT_MEMBERS` (keeping the constants for later phases), and adds tests that combine two or more packages through the package entry. Where two packages disagree, or a package disagrees with the spec, INTEGRATION fixes the owning module in the task that found the seam and records it for spec §10.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` — §3 (the INTEGRATION row and "Waves" 3), §4.3 (barrels, entry, compound members, pending lists), §4.4 (integration tests 1–11), §4.5 (public type tests), §6.2 (the INTEGRATION rows of the `verify-dist` table), §0.2 rules 24–25.

**Index:** `docs/superpowers/plans/2026-09-26-fluent-parity-phase-3.md` (wave order, entry conditions, cross-package contract, final gate).

**Commits:** one per task. When packages run in parallel in one checkout, only the lead runs git write commands (spec §0.2 rule 6): a package agent stops at the commit step and reports its file list. (INTEGRATION runs alone, so it commits task by task.)

## Global Constraints

- Toolchain: Node `^22.22.2 || ^24.15.0 || >=26.0.0`, npm >= 11.11 (devEngines). No new runtime dependency (spec D30).
- Branch and worktree: `feat/fluent-parity-phase-3` in `.claude/worktrees/fluent-parity-phase-3`. Never a bare `git stash`; never `checkout -b` in the main checkout.
- Commits: conventional-commit subjects (`feat(feedback): …`); no AI attribution trailer; one commit per task.
- File ownership (spec §3): only your package's files. `src/lib/classNames.ts` and `MessageBar.status.tsx` are read-only after wave A; the barrels and `src/index.ts` belong to INTEGRATION (wave C), except the registry export of Task A1.
- Conventions (CLAUDE.md, binding): C-REF (ref in props; `displayName` on every component and part), C-COMPOSE (consumer handlers first; `cn(<stable class>, <internal>, className)`; ignore events whose target is not DOM-inside `currentTarget`), C-CLASS (enumerated `data-*` always rendered, boolean ones present or absent, before `{...rest}`), C-TOKENS (theme tokens only; runtime colors only as inline custom-property values marked `// wave-allow-color: <reason>`), C-LOGICAL (logical utilities; the `wave-rtl:` variant only; horizontal arrows through `getArrowIntent`), C-FOCUS, C-MOTION (every `transition*`/`animate-*` string has a same-kind `motion-reduce:` variant; no component ships enter or exit motion, D29), C-DISABLED, C-NAMING, C-CONTEXT, C-MEMO, C-IDS, C-SLOTS, C-BUTTON-TYPE, C-NATIVE, C-ROUTING, C-FORMS, C-POPUPS, C-COMPOUND, C-PURE, C-HOOKS, C-DEV (`warnOnce` from effects; dotted keys such as `Toast.Title:unscanned`), C-DOCS, C-STORIES.
- Stable classes (spec §1.2): every element of a registered part carries exactly its Appendix A class, first in its `cn()` (or in `renderSlot`'s base classes), written as a literal member access (`toastTitleClassNames.root`); no state classes.
- Never write a Tailwind utility name as a bare word in comments or strings under `src/components` or `src/lib` (the CSS build fails on it).
- Tests: a test fails before its code exists (TDD); clean output (no act() warnings; every `[WaveUI]` warning asserted); never hard-code test counts; query by role and accessible name.
- Per task: the focused Vitest runs, `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, ESLint on the touched files with `--max-warnings 0`, and the conventions and stories gate filters for the touched components and stories.

INTEGRATION-specific:

- Wave C starts once the four wave-B packages (`P3-toasts`, `P3-messagebar`, `P3-color`, `P3-tree`) are committed. INTEGRATION owns every file while it runs and resolves their seams: a seam fix lands in the module that owns the behaviour, with its own test, in the task that found it, and goes into the wave C report (the lead records it in spec §10).
- Public names and types come only from the spec (§2 API blocks, §4.3, Appendix A). A wave-B name or type that differs from the spec is a seam: change it to the spec's, unless the lead rules otherwise (recorded for §10).
- Integration and public-type tests import from the package entry (`src/index.ts`), never from module paths: the barrels are under test.
- The pending lists end empty: `PENDING_FLAT_EXPORTS`, `PENDING_CLASS_NAMES`, `PENDING_PUBLIC_TYPES` and `PENDING_FLAT_MEMBERS` are `[]`, their constants and filters kept for later phases.
- Wave C ends with `node scripts/verify-dist.mjs --final` and the whole gate (`node scripts/claude/gate.mjs`) green.

## Review Focus

Cross-package conditions the spec implies but no spec-listed test exercises, most likely first. Each has its pinning test in the named task.

1. **The Toaster's focus shortcut while a real modal Dialog is open.** P3-03's tests use the `useModalLayer` harness; a real Dialog adds its focus trap, which returns focus that lands outside it in a microtask. Expected: focus stays on the newest toast's container (the region is allow-listed), and Escape returns focus to the element inside the Dialog while the Dialog stays open → Task I4.
2. **A Tooltip on a toast's button while a modal Dialog is open below.** Three Escape consumers meet: the tooltip's layer, the Toaster's viewport handler and the Dialog's layer. Expected: the first Escape hides only the tooltip, the second dismisses the toasts, the Dialog never closes, and focus returns into it → Task I4.
3. **A MessageBar with `MessageBar.Actions` and the default `layout="auto"`, hydrated where `ResizeObserver` does not exist** (consumers' jsdom test suites, embedded webviews). Expected: one row, no throw, no hydration warning (as Overflow, Dialog's footer and Table already guard `typeof ResizeObserver`) → Task I6.
4. **A required Field with an error around a composed ColorPicker whose parts are bound.** Expected: exactly one element carries the Field's control id, no id is duplicated, the area's inputs are not described by the Field's message or hint, exactly one required hidden input exists, and the form is valid (a color is always set) → Task I5.
5. **A Tree action's MenuButton inside a modal Dialog.** Expected: Escape in the menu closes only the menu and returns focus to the action (the Dialog stays open), ArrowLeft returns to the item, Space then toggles the item's check without opening the menu, and the next Escape closes the Dialog → Task I5.

## File Structure

| File | Responsibility in wave C |
|---|---|
| `src/components/feedback/index.ts` | Barrel: the Toast and MessageBar parts and their types (§4.3). |
| `src/components/input/index.ts` | Barrel: `ColorArea`, `ColorSlider`, `AlphaSlider`, the three ColorPicker members and their types. |
| `src/components/layout/index.ts` | Barrel: `TreeItemPersonaLayout`, `TreeItemPersonaLayoutProps`, `TreeCheckedItemsChangeDetails` (and `TreeLabels` if Task R3 added it). |
| `src/index.ts` | Entry: `hsvToHex`, `hexToHsv`, `createToaster`, type `ToasterHandle`. |
| `src/components/feedback/Toast.tsx`, `src/components/feedback/MessageBar.tsx`, `src/components/input/ColorPicker.tsx`, `src/components/layout/Tree.tsx` | Only where a name is missing: the compound module re-exports every public name of its package (D32), so each barrel keeps one import path per compound. |
| `src/__tests__/classNames.test.ts` | `PENDING_CLASS_NAMES` emptied. |
| `src/__tests__/public-types.test.ts` | `PENDING_PUBLIC_TYPES` emptied; the 0.8 type tests (§4.5). |
| `scripts/verify-dist.mjs` | `PENDING_FLAT_EXPORTS` emptied; `OPT_IN_MODULES` and the Button-only probe; the Toaster include probe; the react-server checks of `lib/color`, `lib/toaster` and the entry's helpers. |
| `scripts/__tests__/verify-dist.test.mjs` | The real-sources bridge test restored; fixture modules for the new probes; their tests. |
| `src/__tests__/integration.test.tsx` | `PENDING_FLAT_MEMBERS` emptied; the barrel cases; §4.4 cases 1–11; the Review Focus cases. |
| `stories/_helpers.ts` | `colorPickerShapeArgType` (the shared `shape` vocabulary of the color stories). |
| `stories/*.stories.tsx` that import `../src/components/…`, `../src/lib/color` or `../src/lib/toaster` | Imports switched to `'../src'` (rule 25); shared argTypes. |

Seam fixes, if any, touch the module that owns the behaviour (listed per task).

---

### Task I1: Barrels, entry exports and closing the pending lists

**Files:**
- Modify: `src/components/feedback/index.ts`, `src/components/input/index.ts`, `src/components/layout/index.ts`, `src/index.ts` (Utilities block)
- Modify (only for a missing name, Step 6): `src/components/feedback/Toast.tsx`, `src/components/feedback/MessageBar.tsx`, `src/components/input/ColorPicker.tsx`, `src/components/layout/Tree.tsx`
- Modify: `src/__tests__/classNames.test.ts` (`PENDING_CLASS_NAMES`), `src/__tests__/public-types.test.ts` (`PENDING_PUBLIC_TYPES`), `scripts/verify-dist.mjs` (`PENDING_FLAT_EXPORTS` and its JSDoc), `scripts/__tests__/verify-dist.test.mjs` (the bridge test)
- Modify: `src/__tests__/integration.test.tsx` (the `public barrel` describe)
- Modify: `stories/_helpers.ts`, every story that imports from `../src/components/…`, `../src/lib/color` or `../src/lib/toaster`
- Test: `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `src/__tests__/classNames.test.ts`, `scripts/__tests__/verify-dist.test.mjs`, `src/__tests__/stories.a11y.test.tsx`

**Interfaces:**
- Consumes (wave B, by the spec's names): from `./Toast` — `Toast`, `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`, `Toaster`, `useToastController`, types `ToastProps`, `ToastTitleProps`, `ToastBodyProps`, `ToastFooterProps`, `ToastCloseProps`, `ToastCloseRenderProps`, `ToasterProps`, `ToasterShortcuts`, `ToastOptions`, `ToastDispatchOptions`, `ToastController`, `ToastPosition`; from `./MessageBar` — `MessageBar`, `MessageBarTitle`, `MessageBarActions`, types `MessageBarProps`, `MessageBarTitleProps`, `MessageBarActionsProps`; from `./ColorPicker` — `ColorPicker`, `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`, their props types; `./ColorArea`, `./ColorSlider`, `./AlphaSlider` with `…Props` and `…Labels`; from `./Tree` — `Tree`, `TreeItem`, `TreeItemPersonaLayout`, types `TreeProps`, `TreeItemProps`, `TreeItemPersonaLayoutProps`, `TreeCheckedItemsChangeDetails` (and `TreeLabels` if Task R3 added it); `src/lib/color.ts` — `hsvToHex(color: HsvColor): string`, `hexToHsv(hex: string): HsvColor | null`; `src/lib/toaster.ts` — `createToaster(): ToasterHandle`, `interface ToasterHandle extends ToastController {}`; the pending lists written by Tasks A1, A15, A16 and R8.
- Produces: every name above importable from `src/index.ts`; `colorPickerShapeArgType` in `stories/_helpers.ts`; `PENDING_FLAT_EXPORTS = []`, `PENDING_CLASS_NAMES = []`, `PENDING_PUBLIC_TYPES = []`, `PENDING_FLAT_MEMBERS = []`.

- [ ] **Step 1: Record the baseline**

Run: `git log --oneline main..HEAD` and `npm test -- --reporter=default 2>&1 | tail -40`

Expected: the commits of wave A and of the four wave-B packages are on the branch, and every test passes (spec §0.2 rule 24): the barrel test "exports every sub-component of a compound under its flat name, equal to the dotted member" skips the ten new flat names through `PENDING_FLAT_MEMBERS`, the bridge Task A16 Step 6 added to `src/__tests__/integration.test.tsx`. Any failure is a wave-B regression or seam: stop and report it to the lead before changing anything.

- [ ] **Step 2: Write the failing barrel tests**

In `src/__tests__/integration.test.tsx`, `describe('public barrel (spec §5.11, C-COMPOUND)', …)`:

Change the floor of the compound count (Toast, MessageBar and ColorPicker become compounds; Tree already is one):

```tsx
    // At least 19 compounds in 0.7; Toast, MessageBar and ColorPicker join them in 0.8.
    expect(compounds).toBeGreaterThanOrEqual(22);
```

Add after `it('exports the new public hooks, utilities and Portal', …)`:

```tsx
  it('exports the 0.8 compound parts, the color parts and helpers, and createToaster', () => {
    const members: Array<[string, string]> = [
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
    ];
    for (const [compound, member] of members) {
      const flat = `${compound}${member}`;
      expect(barrel[flat], flat).toBeDefined();
      expect(barrel[flat], flat).toBe((barrel[compound] as Record<string, unknown>)[member]);
    }
    for (const name of [
      'ColorArea',
      'ColorSlider',
      'AlphaSlider',
      'createToaster',
      'hsvToHex',
      'hexToHsv',
    ]) {
      expect(barrel[name], name).toBeTypeOf('function');
    }
  });
```

Append the spec's internal 0.8 helpers to the `internal` array of `it('keeps internal helpers out of the public API', …)` (after `'ListRegistry',`):

```tsx
      'StatusText',
      'withPartClass',
      'getStableClassNames',
      'isToastOptions',
      'MessageBarPartContext',
      'useMessageBarReflow',
      'useColorPickerContext',
      'hsvToRgb',
      'rgbToHsv',
      'collectItems',
      'computeCheckStates',
      'toggleCheck',
```

- [ ] **Step 3: Empty the four pending lists**

`src/__tests__/integration.test.tsx` — replace the `PENDING_FLAT_MEMBERS` declaration (its comment and entries, as Task A16 Step 6 wrote them) with:

```tsx
/**
 * Flat names of compound members that a package attaches before the barrels export them (the
 * barrel test's twin of `PENDING_FLAT_EXPORTS` in `scripts/verify-dist.mjs`). Empty since wave C
 * of 0.8; a later phase whose parts land before their flat names lists them here the same way.
 */
const PENDING_FLAT_MEMBERS: readonly string[] = [];
```

`src/__tests__/classNames.test.ts` — replace the `PENDING_CLASS_NAMES` declaration (its comment and entries, as Task A15 wrote them) with:

```ts
/**
 * Constants and keys that a later wave applies (spec §0.2 rule 24, §1.4.3): the "applied" check
 * skips them. Empty since wave C of 0.8, when every Phase 3 part landed. A later phase that
 * registers parts before they exist lists them here and empties the list when they land.
 */
const PENDING_CLASS_NAMES: readonly string[] = [];
```

`src/__tests__/public-types.test.ts` — replace the `PENDING_PUBLIC_TYPES` declaration (as Task A1 wrote it) with:

```ts
/**
 * Public type names that a prop refers to before the barrels export them (spec §0.2 rule 24,
 * §1.5), matched against the name after `#` of the walk's labels. Empty since wave C of 0.8.
 */
const PENDING_PUBLIC_TYPES: readonly string[] = [];
```

`scripts/verify-dist.mjs` — set `export const PENDING_FLAT_EXPORTS = [];` and replace the first paragraph of its JSDoc (up to "The rules:"; the rules list stays as it is) with:

```js
/**
 * A temporary bridge: components whose flat sub-component names (`<Parent><Member>`,
 * C-COMPOUND) are not exported from `dist/index.mjs` yet. The list is empty: Fluent parity
 * phase 3 (0.8) listed `ColorPicker`, `MessageBar`, `Toast` and `Tree` while their new parts
 * (`Toast.Title`, `MessageBar.Actions`, `ColorPicker.HexField`, `Tree.ItemPersonaLayout`, …)
 * landed before the barrels exported their flat names, and emptied it again once the barrels did
 * (as phase 2 did for `Toolbar`). A future compound whose parts land before their flat names goes
 * on it the same way. The rules:
```

`scripts/__tests__/verify-dist.test.mjs` — replace the whole `describe('the flat-name bridge (PENDING_FLAT_EXPORTS)', …)` block (in whatever form Task A16 left it) with:

```js
describe('the flat-name bridge (PENDING_FLAT_EXPORTS)', () => {
  it('is empty: the real exports carry the flat name of every compound member, the 0.8 parts included', async () => {
    expect(PENDING_FLAT_EXPORTS).toEqual([]);
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
    ];
    for (const [compound, member] of members) {
      expect(mod[`${compound}${member}`], `${compound}${member}`).toBe(mod[compound][member]);
    }
    expect(checkFlatExports(mod)).toEqual({ errors: [], pending: [], planned: [] });
    expect(checkFlatExports(mod, { final: true })).toEqual({
      errors: [],
      pending: [],
      planned: [],
    });
  }, 60_000);
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run:
```bash
npx vitest run src/__tests__/integration.test.tsx -t "public barrel"
npx vitest run src/__tests__/public-types.test.ts
npx vitest run src/__tests__/classNames.test.ts
npx vitest run scripts/__tests__/verify-dist.test.mjs -t "flat-name bridge"
```
Expected: the barrel cases FAIL (`ToastTitle: expected undefined to be defined`, `createToaster: expected undefined to be 'function'`); `exports every named type that a public declaration refers to` FAILS with labels such as `components/feedback/Toaster.tsx#ToastDispatchOptions` and `lib/toaster.ts#ToasterHandle`; the bridge test FAILS (`ToastTitle is not exported from dist/index.mjs …`). `classNames.test.ts` passes when wave B applied every Phase 3 key; a failure there names a key, which Step 8 handles.

- [ ] **Step 5: Extend the barrels and the entry**

`src/components/feedback/index.ts` — the whole file:

```ts
export { MessageBar, MessageBarTitle, MessageBarActions } from './MessageBar';
export type { MessageBarProps, MessageBarTitleProps, MessageBarActionsProps } from './MessageBar';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps, ProgressBarColor } from './ProgressBar';

export { Spinner } from './Spinner';
export type { SpinnerProps, SpinnerAppearance } from './Spinner';

export { Skeleton, SkeletonGroup } from './Skeleton';
export type { SkeletonProps, SkeletonGroupProps } from './Skeleton';

export {
  Toast,
  ToastTitle,
  ToastBody,
  ToastFooter,
  ToastClose,
  Toaster,
  useToastController,
} from './Toast';
export type {
  ToastProps,
  ToastTitleProps,
  ToastBodyProps,
  ToastFooterProps,
  ToastCloseProps,
  ToastCloseRenderProps,
  ToasterProps,
  ToasterShortcuts,
  ToastOptions,
  ToastDispatchOptions,
  ToastController,
  ToastPosition,
} from './Toast';
```

`src/components/input/index.ts` — replace the `ColorPicker` export block with:

```ts
export {
  ColorPicker,
  ColorPickerHexField,
  ColorPickerSwatches,
  ColorPickerPreview,
  type ColorPickerProps,
  type ColorPickerPreset,
  type ColorPickerLabels,
  type ColorPickerHexFieldProps,
  type ColorPickerSwatchesProps,
  type ColorPickerPreviewProps,
} from './ColorPicker';
export { ColorArea, type ColorAreaProps, type ColorAreaLabels } from './ColorArea';
export { ColorSlider, type ColorSliderProps, type ColorSliderLabels } from './ColorSlider';
export { AlphaSlider, type AlphaSliderProps, type AlphaSliderLabels } from './AlphaSlider';
```

`src/components/layout/index.ts` — replace the `Tree` export lines with:

```ts
export { Tree, TreeItem, TreeItemPersonaLayout } from './Tree';
export type {
  TreeProps,
  TreeItemProps,
  TreeItemPersonaLayoutProps,
  TreeCheckedItemsChangeDetails,
} from './Tree';
```

If `src/components/layout/Tree.core.tsx` declares `TreeLabels` (Task R3 added it because the VoiceOver spike found `aria-checked` unannounced), add `TreeLabels,` after `TreeCheckedItemsChangeDetails,`.

`src/index.ts` — the Utilities block becomes (the `classNames` line is Task A1's; keep it where A1 put it):

```ts
// Utilities
export { cn } from './lib/cn';
export type * from './lib/types';
export { resolveSlot, renderSlot } from './lib/slot';
export type { Slot, SlotObject, ResolvedSlot } from './lib/slot';
export { composeEventHandlers } from './lib/composeEventHandlers';
export { mergeRefs } from './lib/mergeRefs';
export * from './lib/classNames';
export { hsvToHex, hexToHsv } from './lib/color';
export { createToaster } from './lib/toaster';
export type { ToasterHandle } from './lib/toaster';
```

(`HsvColor` and `ColorPickerShape` are public through `export type * from './lib/types'`.)

- [ ] **Step 6: Re-export any name a compound module lacks**

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: PASS, or `error TS2305: Module '"./Toast"' has no exported member 'ToastDispatchOptions'` (and the like) for names that wave B declared in a sibling module without re-exporting them from the compound module. For each such name, find its declaring module with `grep -rn "export \(interface\|type\|const\|function\) <Name>\b" src/components/<folder>/` and add the re-export to the compound module, next to its other flat re-exports (the compound module re-exports its package's public names, D32; the barrel keeps one import path per compound). The lines, by name, when they are missing:

`src/components/feedback/Toast.tsx`:
```ts
export { ToastTitle, ToastBody, ToastFooter, ToastClose } from './Toast.parts';
export type {
  ToastTitleProps,
  ToastBodyProps,
  ToastFooterProps,
  ToastCloseProps,
  ToastCloseRenderProps,
} from './Toast.parts';
export type { ToastDispatchOptions, ToasterShortcuts } from './Toaster';
```

`src/components/feedback/MessageBar.tsx`:
```ts
export { MessageBarTitle, MessageBarActions } from './MessageBar.parts';
export type { MessageBarTitleProps, MessageBarActionsProps } from './MessageBar.parts';
```

`src/components/input/ColorPicker.tsx`:
```ts
export { ColorPickerHexField, ColorPickerSwatches, ColorPickerPreview } from './ColorPicker.parts';
export type {
  ColorPickerHexFieldProps,
  ColorPickerSwatchesProps,
  ColorPickerPreviewProps,
} from './ColorPicker.parts';
```

`src/components/layout/Tree.tsx`:
```ts
export { TreeItemPersonaLayout } from './Tree.itemPersonaLayout';
export type { TreeItemPersonaLayoutProps } from './Tree.itemPersonaLayout';
export type { TreeCheckedItemsChangeDetails } from './Tree.core';
```

A name declared in a module other than the one shown above is re-exported from that module instead. Re-run `npx tsc -p tsconfig.json --noEmit` until it passes.

- [ ] **Step 7: Run the tests again**

Run the four commands of Step 4.

Expected: PASS. Two kinds of failure can remain:
- **The public-type walk names a type that §4.3 does not list** (for example `components/input/ColorSlider.tsx#ColorSliderChannel`): a named type in a public signature where the spec's API block writes the type inline. Inline it at its uses (the spec's form) and re-run. If several public props share it and it names a concept of its own, export it from the barrel instead, add a line for it to Task I3's block, and record the decision in the report. Never add it to `INTERNAL_HELPERS` (that list holds only key unions and masks, per its JSDoc).
- **`classNames.test.ts` names a Phase 3 key as not applied** (`treeItemClassNames.aside` occurs nowhere under `src/components`): apply it in the module that renders that element, first in its `cn()`, as a literal member access, with an assertion in that component's tests that reads the value from the constant. If the element does not exist as Appendix A registers it, stop: that is a registry change request for the lead (spec §4.1).

- [ ] **Step 8: Switch the stories to the package entry and share the color `shape` argType**

Find the module-path imports (components, and the wave-B stories' `../src/lib/color` and `../src/lib/toaster` imports):

```bash
grep -rnE "from '\.\./src/(components|lib/color|lib/toaster)" stories/
```

For each hit, move the imported names into the file's `'../src'` imports (values into its `import { … } from '../src';`, types into its `import type { … } from '../src';`, one statement of each kind per file), and delete the module-path import. For example, `stories/ColorArea.stories.tsx`:

```tsx
// before
import { ColorArea } from '../src/components/input/ColorArea';
import type { ColorAreaProps } from '../src/components/input/ColorArea';
// after
import { ColorArea } from '../src';
import type { ColorAreaProps } from '../src';
```

`stories/_helpers.ts` — in the header comment, change "the Field `validationState` and the Badge `appearance`/`color` values." to "the Field `validationState`, the Badge `appearance`/`color` values and the color `shape`."; add `ColorPickerShape` to the `import type { … } from '../src';` list; add after `const badgeColors = […] as const satisfies readonly BadgeColor[];`:

```ts
const colorPickerShapes = ['rounded', 'square'] as const satisfies readonly ColorPickerShape[];
```

and at the end of the file:

```ts
/** `shape` (`ColorPickerShape`) of ColorPicker, ColorArea, ColorSlider and AlphaSlider: rounded or square. */
export const colorPickerShapeArgType = {
  shape: { control: 'inline-radio', options: colorPickerShapes },
} satisfies ArgTypes;
```

In `stories/ColorArea.stories.tsx`, `stories/ColorSlider.stories.tsx`, `stories/AlphaSlider.stories.tsx` and `stories/ColorPicker.stories.tsx`: replace a local `shape` argType (an `options` list of `'rounded'` and `'square'`) with `...colorPickerShapeArgType`, or add it to the meta's `argTypes` when the story has none; in the two slider stories, replace a local `orientation` argType with `...orientationArgType`. Keep every other argType as the story has it. The ColorSlider meta then reads:

```tsx
import { colorPickerShapeArgType, orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Input/ColorSlider',
  component: ColorSlider,
  // args: unchanged
  argTypes: {
    ...colorPickerShapeArgType,
    ...orientationArgType,
    // the story's other argTypes (for example `channel`), unchanged
  },
} satisfies Meta<typeof ColorSlider>;
```

- [ ] **Step 9: Check the stories**

Run:
```bash
npx tsc -p tsconfig.dev.json --noEmit
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/ColorArea"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/ColorSlider"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/AlphaSlider"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/ColorPicker"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/Toast"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/MessageBar"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Layout/Tree"
npx vitest run src/__tests__/conventions.test.ts -t "stories/"
```
Expected: PASS.

- [ ] **Step 10: Build and run the publish gate of dist**

Run: `npm run build` then `node scripts/verify-dist.mjs --final`

Expected: `verify-dist: dist OK (final)`. A failure names its check: an undocumented new component in `index.d.ts` (add the component JSDoc of the spec's outline, C-DOCS), a flat name bound to another component, or a CJS parity gap.

- [ ] **Step 11: Quick checks**

Run:
```bash
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/feedback/index.ts src/components/input/index.ts src/components/layout/index.ts src/index.ts src/__tests__/integration.test.tsx src/__tests__/public-types.test.ts src/__tests__/classNames.test.ts scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs stories/ --max-warnings 0
npx vitest run src/__tests__/integration.test.tsx -t "public barrel" --reporter=default
```
Expected: PASS, no warnings in the output.

- [ ] **Step 12: Commit**

```bash
git add src/components/feedback/index.ts src/components/input/index.ts src/components/layout/index.ts src/index.ts src/__tests__/integration.test.tsx src/__tests__/public-types.test.ts src/__tests__/classNames.test.ts scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs stories/
git add src/components/feedback/Toast.tsx src/components/feedback/MessageBar.tsx src/components/input/ColorPicker.tsx src/components/layout/Tree.tsx
git commit -m "feat: export the 0.8 parts, color helpers and createToaster; close the pending lists"
```

(The second `git add` stages only the compound modules that Step 6 changed; an unchanged path adds nothing.)

---

### Task I2: `verify-dist` probes for the opt-in modules, the Toaster and the server-safe helpers

**Files:**
- Modify: `scripts/verify-dist.mjs` (constants after `PRESENCE_BUDGET`; `serverProbeSource`; `checkServerImport`; `verifyDist`; the header's "Checks" list)
- Test: `scripts/__tests__/verify-dist.test.mjs` (`goodFiles()` fixture modules; two new `describe` blocks)

**Interfaces:**
- Consumes: `probeTreeShaking(dist, { keep, drop, dropModules })` and `probeIncludes(dist, { keep, modules })` (0.7), `PRESENCE_MODULE`; the real `dist` of Task I1 (`components/input/ColorArea.mjs`, `ColorSlider.mjs`, `AlphaSlider.mjs`, `components/feedback/Toaster.mjs`, `lib/color.mjs`/`.cjs`, `lib/toaster.mjs`/`.cjs`; the entry exporting `hsvToHex`, `hexToHsv`, `createToaster`).
- Produces: `export const OPT_IN_MODULES: string[]` (sorted dist paths); the Toaster include probe; react-server checks for `lib/color.*`, `lib/toaster.*` and the entry's three helpers; error texts `"<path> is missing"`, `"<path> under node --conditions=react-server: <message>"`, `"<module> is in the bundle of an import of only Button (ColorArea must be dropped)"`, `"hooks/usePresence.mjs is not in the bundle of an import of only Toaster"`.

- [ ] **Step 1: Write the failing tests and their fixture modules**

In `scripts/__tests__/verify-dist.test.mjs`, add `OPT_IN_MODULES,` to the import list from `'../verify-dist.mjs'` (after `missingDeclarations,`).

In `goodFiles()`, after the `const menu = { … };` declaration, add:

```js
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
```

In the object `goodFiles()` returns, after `'dist/components/navigation/Menu.cjs': menu.cjs,`, add:

```js
    'dist/components/input/ColorArea.mjs': colorArea.esm,
    'dist/components/input/ColorArea.cjs': colorArea.cjs,
    'dist/components/input/ColorSlider.mjs': colorSlider.esm,
    'dist/components/input/ColorSlider.cjs': colorSlider.cjs,
    'dist/components/input/AlphaSlider.mjs': alphaSlider.esm,
    'dist/components/input/AlphaSlider.cjs': alphaSlider.cjs,
    'dist/components/feedback/Toaster.mjs': toaster.esm,
    'dist/components/feedback/Toaster.cjs': toaster.cjs,
    'dist/lib/color.mjs': `${colorHelpers}export { hsvToHex, hexToHsv };\n`,
    'dist/lib/color.cjs': `${colorHelpers}exports.hsvToHex = hsvToHex;\nexports.hexToHsv = hexToHsv;\n`,
    'dist/lib/toaster.mjs': `${toasterHandle}export { createToaster };\n`,
    'dist/lib/toaster.cjs': `${toasterHandle}exports.createToaster = createToaster;\n`,
```

Extend the fixture entries. In `'dist/index.mjs'`, after `"export { Menu } from './components/navigation/Menu.mjs';\n"` (keep any lines Task A16 added):

```js
      "export { hsvToHex, hexToHsv } from './lib/color.mjs';\n" +
      "export { createToaster } from './lib/toaster.mjs';\n" +
      "export { ColorArea } from './components/input/ColorArea.mjs';\n" +
      "export { ColorSlider } from './components/input/ColorSlider.mjs';\n" +
      "export { AlphaSlider } from './components/input/AlphaSlider.mjs';\n" +
      "export { Toaster } from './components/feedback/Toaster.mjs';\n",
```

In `'dist/index.cjs'`, after `"const menu = require('./components/navigation/Menu.cjs');\n"`:

```js
      "const color = require('./lib/color.cjs');\n" +
      "const toasterHandle = require('./lib/toaster.cjs');\n" +
      "const colorArea = require('./components/input/ColorArea.cjs');\n" +
      "const colorSlider = require('./components/input/ColorSlider.cjs');\n" +
      "const alphaSlider = require('./components/input/AlphaSlider.cjs');\n" +
      "const toaster = require('./components/feedback/Toaster.cjs');\n" +
```

and after `'exports.Menu = menu.Menu;\n'`:

```js
      'exports.hsvToHex = color.hsvToHex;\nexports.hexToHsv = color.hexToHsv;\n' +
      'exports.createToaster = toasterHandle.createToaster;\n' +
      'exports.ColorArea = colorArea.ColorArea;\nexports.ColorSlider = colorSlider.ColorSlider;\n' +
      'exports.AlphaSlider = alphaSlider.AlphaSlider;\nexports.Toaster = toaster.Toaster;\n',
```

(Move the string's closing `,` so the concatenation stays one expression.)

Add, after `describe('probeSizeBudget', …)`:

```js
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run scripts/__tests__/verify-dist.test.mjs`

Expected: FAIL — the file does not load: `SyntaxError: The requested module '../verify-dist.mjs' does not provide an export named 'OPT_IN_MODULES'`.

- [ ] **Step 3: Implement the probes and checks**

`scripts/verify-dist.mjs` — after the `PRESENCE_BUDGET` constant:

```js
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

/** An import of only this component holds the presence core (spec D29): its toasts mount on it. */
const TOASTER_INCLUDE_KEEP = 'Toaster';

/**
 * The server-safe modules of 0.8 that a Server Component reaches through the entry (spec D18,
 * D33): each must exist, and pass its check in {@link serverProbeSource}.
 */
const SERVER_SAFE_MODULES = [
  'lib/color.mjs',
  'lib/color.cjs',
  'lib/toaster.mjs',
  'lib/toaster.cjs',
];
```

In `serverProbeSource`, inside the template literal, after the closing brace of the `if (/^index\\.[cm]?js$/.test(path)) { … }` block of `check` (keep every block Task A16 added), add:

```js
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
  if (/^index\\.[cm]?js$/.test(path)) {
    for (const name of ['hsvToHex', 'hexToHsv', 'createToaster']) {
      if (typeof m[name] !== 'function') throw new Error(name + ' is not exported');
      if (m[name].$$typeof === Symbol.for('react.client.reference')) {
        throw new Error(name + ' is a client reference (re-exported from a "use client" module)');
      }
    }
  }
```

In `checkServerImport`, right after the `for (const path of ['lib/cn.mjs', 'lib/cn.cjs']) { … }` loop:

```js
  for (const path of SERVER_SAFE_MODULES) {
    if (!existsSync(join(distRoot, path))) errors.push(`${path} is missing`);
  }
```

In `verifyDist`, inside the `try` block of the tree-shaking probes, after the presence probe call:

```js
    errors.push(
      ...(await probeTreeShaking(distRoot, {
        keep: 'Button',
        drop: 'ColorArea',
        dropModules: OPT_IN_MODULES,
      })),
    );
```

and after the `try { … } catch` of the presence include probe:

```js
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
```

In the header's "Checks:" list, extend the react-server bullet with ", `dist/lib/color.*` and `dist/lib/toaster.*` must exist and work on the server (the color helpers convert; a handle's dispatch returns an id and adds no global), and `dist/index.*` must export `hsvToHex`, `hexToHsv` and `createToaster` from them, not from a client module", and add after the presence-core bullet:

```js
 *   - opt-in modules (0.8): an import of only `Button` contains none of {@link OPT_IN_MODULES}
 *     (the color parts and helpers, the toaster handle), and an import of only `Toaster`
 *     contains `hooks/usePresence`;
```

- [ ] **Step 4: Run the tests again**

Run: `npx vitest run scripts/__tests__/verify-dist.test.mjs`

Expected: PASS (the whole file: the extended fixture must keep every earlier case green, including `verifyDist and main › passes a correct dist` and the cases that assert an exact error list).

- [ ] **Step 5: Run the checks on the real dist**

Run: `npm run build` then `node scripts/verify-dist.mjs --final`

Expected: `verify-dist: dist OK (final)`. A failure names the module: an opt-in module pulled into the Button bundle (find the import chain from `components/button/Button.mjs` with `grep -rn "lib/color\|lib/toaster\|ColorArea" dist/components/button dist/lib`, and remove the import from the module that must not have it), `lib/toaster` not loading on the server (it imports a component or hook module: move the shared code into `src/lib`, spec D33), or the Toaster bundle lacking `hooks/usePresence`.

- [ ] **Step 6: Quick checks**

Run: `npx eslint scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs --max-warnings 0` and `npx prettier --check scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs
git commit -m "chore(scripts): probe the opt-in color and toaster modules, the Toaster and the server-safe helpers"
```

---

### Task I3: Public type tests of the 0.8 API

**Files:**
- Modify: `src/__tests__/public-types.test.ts` (imports; a new `describe` at the end)
- Test: the same file, checked by `npx tsc -p tsconfig.dev.json --noEmit` and Vitest

**Interfaces:**
- Consumes: the public entry of Task I1 (every type named below, and the registry constants of Task A1 through `typeof import('../index')`).
- Produces: nothing new; the tests pin §4.5.

- [ ] **Step 1: Write the type tests**

Add `ReactElement,` and `Ref,` to the `import type { … } from 'react';` list, and these names to the `import type { … } from '../index';` list (keep it sorted as it is; skip a name already there):

```ts
  AlphaSliderLabels,
  AlphaSliderProps,
  ColorAreaLabels,
  ColorAreaProps,
  ColorPickerHexFieldProps,
  ColorPickerLabels,
  ColorPickerPreviewProps,
  ColorPickerProps,
  ColorPickerShape,
  ColorPickerSwatchesProps,
  ColorSliderLabels,
  ColorSliderProps,
  HsvColor,
  MessageBarActionsProps,
  MessageBarProps,
  MessageBarTitleProps,
  SelectionMode,
  Status,
  ToastBodyProps,
  ToastCloseProps,
  ToastCloseRenderProps,
  ToastDispatchOptions,
  ToasterHandle,
  ToasterShortcuts,
  ToastFooterProps,
  ToastOptions,
  ToastProps,
  ToastTitleProps,
  TreeCheckedItemsChangeDetails,
  TreeItemPersonaLayoutProps,
  TreeItemProps,
  TreeProps,
```

Append at the end of the file:

```ts
// The 0.8 notifications, color, trees and class names, imported from the package entry
// (compile-time, `tsconfig.dev.json`). Values are read as types from the entry's namespace, so
// the file imports no runtime value.
type Entry = typeof import('../index');

describe('0.8 notifications, color, trees and class names from the package entry', () => {
  it('toasts: the dispatchToast overloads, the content options, the parts and the handle', () => {
    type DispatchToast = ToastController['dispatchToast'];
    expectTypeOf<DispatchToast>()
      .toBeCallableWith({ title: 'Saved' })
      .returns.toEqualTypeOf<string>();
    expectTypeOf<DispatchToast>()
      .toBeCallableWith({} as ReactElement, { timeout: 0, status: 'error' })
      .returns.toEqualTypeOf<string>();
    expectTypeOf<DispatchToast>().toBeCallableWith('Saved').returns.toEqualTypeOf<string>();
    // Types derived from the member keep 0.7's shape: TypeScript reads the last overload.
    expectTypeOf<Parameters<DispatchToast>>().toEqualTypeOf<[options: ToastOptions]>();
    expectTypeOf<ReturnType<DispatchToast>>().toEqualTypeOf<string>();
    expectTypeOf<ToastDispatchOptions>().toEqualTypeOf<{
      toastId?: string;
      timeout?: number;
      status?: Status;
      statusLabel?: string;
      announcement?: string;
    }>();

    expectTypeOf<ToastProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<ToastProps['title']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ToastTitleProps['action']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<ToastTitleProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<ToastBodyProps['subtitle']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<ToastFooterProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<ToastCloseProps['asChild']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ToastCloseProps['children']>().toEqualTypeOf<
      ReactNode | ((props: ToastCloseRenderProps) => ReactNode)
    >();
    expectTypeOf<ToastCloseRenderProps['onClick']>().toEqualTypeOf<
      MouseEventHandler<HTMLElement>
    >();
    expectTypeOf<ToastCloseRenderProps['ref']>().toEqualTypeOf<RefCallback<HTMLElement>>();
    expectTypeOf<ToastCloseRenderProps>().toExtend<HTMLAttributes<HTMLElement>>();
    expectTypeOf<Entry['Toast']['Title']>().toEqualTypeOf<Entry['ToastTitle']>();
    expectTypeOf<Entry['Toast']['Body']>().toEqualTypeOf<Entry['ToastBody']>();
    expectTypeOf<Entry['Toast']['Footer']>().toEqualTypeOf<Entry['ToastFooter']>();
    expectTypeOf<Entry['Toast']['Close']>().toEqualTypeOf<Entry['ToastClose']>();

    expectTypeOf<ToasterProps['shortcuts']>().toEqualTypeOf<ToasterShortcuts | undefined>();
    expectTypeOf<ToasterShortcuts>().toEqualTypeOf<{
      focus?: (event: KeyboardEvent) => boolean;
    }>();
    expectTypeOf<ToasterProps['toaster']>().toEqualTypeOf<ToasterHandle | undefined>();
    // The handle is the controller and nothing more (spec D33).
    expectTypeOf<ToasterHandle>().toEqualTypeOf<ToastController>();
    expectTypeOf<Entry['createToaster']>().toEqualTypeOf<() => ToasterHandle>();
  });

  it('MessageBar: layout and the parts', () => {
    expectTypeOf<MessageBarProps['layout']>().toEqualTypeOf<
      'auto' | 'singleline' | 'multiline' | undefined
    >();
    expectTypeOf<MessageBarTitleProps>().toExtend<HTMLAttributes<HTMLSpanElement>>();
    expectTypeOf<MessageBarActionsProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<Entry['MessageBar']['Title']>().toEqualTypeOf<Entry['MessageBarTitle']>();
    expectTypeOf<Entry['MessageBar']['Actions']>().toEqualTypeOf<Entry['MessageBarActions']>();
  });

  it('color: HsvColor, ColorPickerShape, the helpers, the standalone parts and the picker', () => {
    expectTypeOf<HsvColor>().toEqualTypeOf<{ h: number; s: number; v: number; a?: number }>();
    expectTypeOf<ColorPickerShape>().toEqualTypeOf<'rounded' | 'square'>();
    expectTypeOf<Entry['hsvToHex']>().toEqualTypeOf<(color: HsvColor) => string>();
    expectTypeOf<Entry['hexToHsv']>().toEqualTypeOf<(hex: string) => HsvColor | null>();

    expectTypeOf<ColorAreaProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorAreaProps['defaultValue']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorAreaProps['onValueChange']>().toEqualTypeOf<
      ((value: HsvColor) => void) | undefined
    >();
    expectTypeOf<ColorAreaProps['shape']>().toEqualTypeOf<ColorPickerShape | undefined>();
    expectTypeOf<ColorAreaProps['labels']>().toEqualTypeOf<ColorAreaLabels | undefined>();
    expectTypeOf<ColorAreaProps['controlRef']>().toEqualTypeOf<
      Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<ColorAreaLabels['colorName']>().toEqualTypeOf<
      ((color: HsvColor) => string) | undefined
    >();
    expectTypeOf<ColorAreaLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, channel: 'saturation' | 'value') => string) | undefined
    >();

    expectTypeOf<ColorSliderProps['channel']>().toEqualTypeOf<
      'hue' | 'saturation' | 'value' | undefined
    >();
    expectTypeOf<ColorSliderProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    expectTypeOf<ColorSliderProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorSliderLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, channel: 'hue' | 'saturation' | 'value') => string) | undefined
    >();

    expectTypeOf<AlphaSliderProps['transparency']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<AlphaSliderProps['labels']>().toEqualTypeOf<AlphaSliderLabels | undefined>();
    expectTypeOf<AlphaSliderProps>().not.toHaveProperty('channel');
    expectTypeOf<AlphaSliderLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, transparency: boolean) => string) | undefined
    >();

    expectTypeOf<ColorPickerProps['shape']>().toEqualTypeOf<ColorPickerShape | undefined>();
    expectTypeOf<ColorPickerProps['children']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<ColorPickerLabels['area']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ColorPickerLabels['colorName']>().toEqualTypeOf<
      ((color: HsvColor) => string) | undefined
    >();
    expectTypeOf<ColorPickerLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, channel: 'hue' | 'saturation' | 'value' | 'alpha') => string) | undefined
    >();
    expectTypeOf<ColorPickerHexFieldProps['controlRef']>().toEqualTypeOf<
      Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<ColorPickerSwatchesProps>().not.toHaveProperty('items');
    expectTypeOf<ColorPickerPreviewProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<Entry['ColorPicker']['HexField']>().toEqualTypeOf<Entry['ColorPickerHexField']>();
    expectTypeOf<Entry['ColorPicker']['Swatches']>().toEqualTypeOf<Entry['ColorPickerSwatches']>();
    expectTypeOf<Entry['ColorPicker']['Preview']>().toEqualTypeOf<Entry['ColorPickerPreview']>();
  });

  it('trees: selection modes, checked items with details, row content, persona rows and tabStop', () => {
    expectTypeOf<TreeProps['selectionMode']>().toEqualTypeOf<'none' | SelectionMode | undefined>();
    expectTypeOf<TreeProps['checkedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TreeProps['defaultCheckedItems']>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<TreeCheckedItemsChangeDetails>().toEqualTypeOf<{
      value: string;
      checked: boolean;
      event: Event;
    }>();
    // `details` is optional until 1.0: a handler of the items alone fits, a state setter too,
    // and code that calls the prop may pass the items only.
    type Handler = NonNullable<TreeProps['onCheckedItemsChange']>;
    const itemsOnly = (items: string[]) => void items;
    expectTypeOf(itemsOnly).toExtend<Handler>();
    expectTypeOf<Dispatch<SetStateAction<string[]>>>().toExtend<Handler>();
    expectTypeOf<Dispatch<SetStateAction<readonly string[]>>>().toExtend<Handler>();
    expectTypeOf<Handler>().toBeCallableWith(['docs']);
    expectTypeOf<Handler>().parameter(1).toEqualTypeOf<TreeCheckedItemsChangeDetails | undefined>();

    expectTypeOf<TreeProps['navigationMode']>().toEqualTypeOf<'tree' | 'treegrid' | undefined>();
    expectTypeOf<TreeItemProps['actions']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemProps['aside']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemProps['iconAfter']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TreeItemProps['expandIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TreeItemPersonaLayoutProps['media']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps['description']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps>().toExtend<HTMLAttributes<HTMLSpanElement>>();
    expectTypeOf<Entry['Tree']['ItemPersonaLayout']>().toEqualTypeOf<
      Entry['TreeItemPersonaLayout']
    >();
    expectTypeOf<UseRovingTabIndexOptions['tabStop']>().toEqualTypeOf<'active' | 'last-focused' | 'none' | undefined>();
  });

  it('class-name constants have literal, readonly types; the new unions refuse other values', () => {
    expectTypeOf<
      Entry['toastTitleClassNames']['label']
    >().toEqualTypeOf<'wave-toast-title__label'>();
    expectTypeOf<Entry['toasterClassNames']['toast']>().toEqualTypeOf<'wave-toaster__toast'>();
    expectTypeOf<Entry['colorAreaClassNames']['thumb']>().toEqualTypeOf<'wave-color-area__thumb'>();
    expectTypeOf<
      Entry['treeItemClassNames']['actions']
    >().toEqualTypeOf<'wave-tree-item__actions'>();
    expectTypeOf<
      Entry['treeItemPersonaLayoutClassNames']['main']
    >().toEqualTypeOf<'wave-tree-item-persona-layout__main'>();

    // @ts-expect-error the MessageBar layouts are auto, singleline and multiline
    const wrap: MessageBarProps['layout'] = 'wrap';
    // @ts-expect-error opacity has its own slider (AlphaSlider)
    const alpha: ColorSliderProps['channel'] = 'alpha';
    // @ts-expect-error Fluent's 'multiselect' is 'multiple' in WaveUI
    const multiselect: TreeProps['selectionMode'] = 'multiselect';
    // @ts-expect-error the navigation modes are tree and treegrid
    const grid: TreeProps['navigationMode'] = 'grid';
    // @ts-expect-error a ColorPicker is rounded or square
    const circular: ColorPickerProps['shape'] = 'circular';
    const classes = {} as Entry['buttonClassNames'];
    // @ts-expect-error the registry constants are readonly
    classes.root = 'wave-custom';
    expect([wrap, alpha, multiselect, grid, circular, classes.root]).toEqual([
      'wrap',
      'alpha',
      'multiselect',
      'grid',
      'circular',
      'wave-custom',
    ]);
  });
});
```

- [ ] **Step 2: Type-check and run**

Run: `npx tsc -p tsconfig.dev.json --noEmit` and `npx vitest run src/__tests__/public-types.test.ts`

Expected: PASS when wave B met the spec's types. Each failure is a seam: an assertion that does not hold means a declaration differs from the spec's API block (§2) — change the declaration in its owning module to the spec's type (for example `ColorPickerLabels['valueText']` with a channel union other than D22's), re-run, and list it in the report. An unused `@ts-expect-error` means a union accepts a value the spec rules out: narrow the union. If the spec itself is wrong, stop and ask the lead.

- [ ] **Step 3: Quick checks**

Run: `npx eslint src/__tests__/public-types.test.ts --max-warnings 0` and `npx tsc -p tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/public-types.test.ts
git commit -m "test: public types of the 0.8 API"
```

(Add the paths of any declaration fixed in Step 2 to the same commit.)

---

### Task I4: Toasts across components (§4.4 #1–#5, Review Focus 1–2)

**Files:**
- Modify: `src/__tests__/integration.test.tsx` (imports; a new section appended at the end of the file)
- Seam fixes, if a case fails (Step 3): `src/components/feedback/Toaster.tsx`, `src/components/feedback/Toast.parts.tsx`, `src/components/feedback/Toast.root.tsx`, `src/lib/toaster.ts`

**Interfaces:**
- Consumes: from the entry — `Toast` (with `Toast.Title` `action`, `Toast.Body`, `Toast.Footer`, `Toast.Close`), `Toaster` (`shortcuts`, `toaster`), `useToastController().dispatchToast(content, options?)`, `createToaster()`, `Link`, `Tooltip`, `Popover`, `Dialog`, `Menu`, `MenuButton`, `Button`, `Input`; the file's helpers `button`, `menuitem`, `tooltipSurface`, `NotifyButton`, `expectNoA11yViolations`.
- Produces (module-level helpers that Task I6 reuses): `ToastFileMenu()`, `UploadToastButton({ timeout }: { timeout?: number })`, `toastRegion(name?: string): HTMLElement`, `toastGroup(name: string): HTMLElement`, `politeMessages(name?: string): HTMLElement`.

- [ ] **Step 1: Write the tests**

Add to the value imports from `'../index'` (keep the list sorted: capitalised names first, then lowercase): `Link,`, `Toast,`, `createToaster,`.

Append at the end of `src/__tests__/integration.test.tsx`:

```tsx
// ---------------------------------------------------------------------------
// 0.8 (Fluent parity phase 3): toasts across components (spec §4.4 #1–#5)
// ---------------------------------------------------------------------------

/** The Toaster's region (`'Notifications'` unless the Toaster has its own `aria-label`). */
const toastRegion = (name = 'Notifications') => screen.getByRole('region', { name });
/** A toast's container: `role="group"`, named by its severity text and title (spec D10). */
const toastGroup = (name: string) => screen.getByRole('group', { name });
/** The Toaster's polite live region (0.7's `role="status"` region, one message per toast). */
const politeMessages = (name = 'Notifications') => within(toastRegion(name)).getByRole('status');

/** A MenuButton with a Menu, used as a toast's title action. */
function ToastFileMenu() {
  return (
    <Menu>
      <Menu.Trigger>
        <MenuButton size="small">More</MenuButton>
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item>Open file</Menu.Item>
        <Menu.Item>Copy link</Menu.Item>
      </Menu.Popover>
    </Menu>
  );
}

/** Dispatches a rich toast whose title action opens a Menu (spec §4.4 #1, #10). */
function UploadToastButton({ timeout }: { timeout?: number }) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast(
          <Toast status="success">
            <Toast.Title action={<ToastFileMenu />}>File uploaded</Toast.Title>
            <Toast.Body>report.pdf is ready.</Toast.Body>
          </Toast>,
          timeout === undefined ? undefined : { timeout },
        )
      }
    >
      Upload
    </Button>
  );
}

describe('a Menu in a dispatched toast (spec §4.4 #1)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function setup() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Toaster>
        <UploadToastButton timeout={3000} />
      </Toaster>,
    );
    await user.click(button('Upload'));
    expect(toastGroup('Success: File uploaded')).toBeInTheDocument();
    // Into the toast by keyboard: the pointer stays on Upload, outside the region, so only focus
    // can pause the timers.
    await user.tab();
    expect(button('More')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'More' })).toBeInTheDocument();
    expect(menuitem('Open file')).toHaveFocus();
    return { user };
  }

  it('keeps the timers paused while focus is in the menu, a portal opened from the toast', async () => {
    await setup();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(toastGroup('Success: File uploaded')).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });

  it('Escape closes only the menu first, then dismisses the toasts and returns focus to the origin', async () => {
    const { user } = await setup();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('More')).toHaveFocus();
    expect(toastGroup('Success: File uploaded')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Success: File uploaded' })).not.toBeInTheDocument();
    expect(button('Upload')).toHaveFocus();
  });

  it.each(['{Delete}', '{Backspace}'])('%s on a menu item keeps the toast and the menu', async (key) => {
    const { user } = await setup();
    await user.keyboard(key);
    await act(async () => {});
    expect(toastGroup('Success: File uploaded')).toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'More' })).toBeInTheDocument();
  });
});

describe('a rich toast over a modal Dialog (spec §4.4 #2)', () => {
  function DeleteRowButton({ onUndo }: { onUndo: () => void }) {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="success">
              <Toast.Title>Row deleted</Toast.Title>
              <Toast.Footer>
                <Toast.Close>
                  <Button onClick={onUndo}>Undo</Button>
                </Toast.Close>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Delete row
      </Button>
    );
  }

  function setup() {
    const onOpenChange = vi.fn();
    const onUndo = vi.fn();
    render(
      <Toaster>
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content title="Settings">
            <DeleteRowButton onUndo={onUndo} />
          </Dialog.Content>
        </Dialog>
      </Toaster>,
    );
    return { onOpenChange, onUndo, user: userEvent.setup() };
  }

  it('Tab reaches Undo while the Dialog is open; Escape dismisses the toasts and leaves the Dialog open', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Delete row'));
    expect(toastGroup('Success: Row deleted')).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
    await user.tab();
    expect(button('Undo')).toHaveFocus();
    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Success: Row deleted' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Delete row')).toHaveFocus();
  });

  it('Delete on a focused toast dismisses only that toast and focuses the next one', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Delete row'));
    await user.click(button('Delete row'));
    expect(screen.getAllByRole('group', { name: 'Success: Row deleted' })).toHaveLength(2);
    await user.tab();
    const [firstUndo] = screen.getAllByRole('button', { name: 'Undo' });
    expect(firstUndo).toHaveFocus();
    await user.keyboard('{Delete}');
    await act(async () => {});
    expect(screen.getAllByRole('group', { name: 'Success: Row deleted' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  function RenameToastButton() {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="warning">
              <Toast.Title>Report ready</Toast.Title>
              <Toast.Footer>
                <Dialog>
                  <Dialog.Trigger>
                    <Button>Rename</Button>
                  </Dialog.Trigger>
                  <Dialog.Content title="Rename report">
                    <Input aria-label="File name" defaultValue="report.pdf" />
                  </Dialog.Content>
                </Dialog>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Export
      </Button>
    );
  }

  it('Delete in a Dialog opened from a toast keeps the toast', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <RenameToastButton />
      </Toaster>,
    );
    await user.click(button('Export'));
    await user.click(button('Rename'));
    const dialog = screen.getByRole('dialog', { name: 'Rename report' });
    const close = within(dialog).getByRole('button', { name: 'Close' });
    act(() => close.focus());
    await act(async () => {});
    await user.keyboard('{Delete}');
    await act(async () => {});
    expect(toastGroup('Warning: Report ready')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rename report' })).toBeInTheDocument();
  });
});

describe('a Tooltip and a Popover on a toast (spec §4.4 #3)', () => {
  function ArchiveToastButton() {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="info">
              <Toast.Title
                action={
                  <Tooltip content="Restores the message" openDelay={0}>
                    <Button>Undo</Button>
                  </Tooltip>
                }
              >
                Moved to Archive
              </Toast.Title>
              <Toast.Footer>
                <Popover>
                  <Popover.Trigger>
                    <Button>Details</Button>
                  </Popover.Trigger>
                  <Popover.Content title="Details">
                    <p>Moved by a rule.</p>
                    <Button>Edit rule</Button>
                  </Popover.Content>
                </Popover>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Archive
      </Button>
    );
  }

  function setup() {
    render(
      <Toaster>
        <ArchiveToastButton />
      </Toaster>,
    );
    return userEvent.setup();
  }

  it('with the tooltip shown, Escape hides only the tooltip; the next Escape dismisses the toasts', async () => {
    const user = setup();
    await user.click(button('Archive'));
    await user.tab();
    const undo = button('Undo');
    expect(undo).toHaveFocus();
    await waitFor(() => expect(tooltipSurface()).not.toBeNull());
    expect(undo).toHaveAccessibleDescription('Restores the message');

    await user.keyboard('{Escape}');
    expect(tooltipSurface()).toBeNull();
    expect(toastGroup('Info: Moved to Archive')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Info: Moved to Archive' })).not.toBeInTheDocument();
    expect(button('Archive')).toHaveFocus();
  });

  it('Escape in a Popover opened from a toast closes only the popover', async () => {
    const user = setup();
    await user.click(button('Archive'));
    await user.click(button('Details'));
    const popover = screen.getByRole('dialog', { name: 'Details' });
    act(() => within(popover).getByRole('button', { name: 'Edit rule' }).focus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Details' })).not.toBeInTheDocument();
    expect(toastGroup('Info: Moved to Archive')).toBeInTheDocument();
    expect(button('Details')).toHaveFocus();
  });
});

describe('Toast.Close around a Link and a Button (spec §4.4 #4)', () => {
  function MoveToastButton({
    onUndo,
    onKeep,
  }: {
    onUndo?: React.MouseEventHandler<HTMLAnchorElement>;
    onKeep?: React.MouseEventHandler<HTMLButtonElement>;
  }) {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="info">
              <Toast.Title
                action={
                  <Toast.Close>
                    <Link href="#undo" onClick={onUndo}>
                      Undo
                    </Link>
                  </Toast.Close>
                }
              >
                Moved
              </Toast.Title>
              <Toast.Footer>
                <Toast.Close>
                  <Button onClick={onKeep}>Keep</Button>
                </Toast.Close>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Move
      </Button>
    );
  }

  it('a Link in the title action runs its handler and dismisses the toast', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster>
        <MoveToastButton onUndo={onUndo} />
      </Toaster>,
    );
    await user.click(button('Move'));
    await user.click(screen.getByRole('link', { name: 'Undo' }));
    await act(async () => {});
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Info: Moved' })).not.toBeInTheDocument();
  });

  it('a Button in the footer runs its handler and dismisses the toast', async () => {
    const onKeep = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster>
        <MoveToastButton onKeep={onKeep} />
      </Toaster>,
    );
    await user.click(button('Move'));
    await user.click(button('Keep'));
    await act(async () => {});
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Info: Moved' })).not.toBeInTheDocument();
  });

  it('preventDefault() in the Button’s onClick keeps the toast', async () => {
    const onKeep = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <Toaster>
        <MoveToastButton onKeep={onKeep} />
      </Toaster>,
    );
    await user.click(button('Move'));
    await user.click(button('Keep'));
    await act(async () => {});
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(toastGroup('Info: Moved')).toBeInTheDocument();
  });
});

// Created at module scope, as an app's toasts module creates them (P3-08).
const appToaster = createToaster();
const updatesToaster = createToaster();
/** Stands in for a router: the toast's link reads it from above the Toaster. */
const RouteContext = React.createContext('#/');

function DocumentLink() {
  const href = React.useContext(RouteContext);
  return <Link href={href}>Open</Link>;
}

/** A plain function outside React, as a query-cache callback or a server-event handler is. */
function notifySaved(): string {
  return appToaster.dispatchToast(
    <Toast status="success">
      <Toast.Title action={<DocumentLink />}>Saved</Toast.Title>
    </Toast>,
  );
}

describe('a module-scope toaster handle (spec §4.4 #5, P3-08)', () => {
  it('shows, announces once and dismisses a toast dispatched from a plain function; its content reads context from above the Toaster', async () => {
    render(
      <RouteContext.Provider value="#/documents/42">
        <Toaster toaster={appToaster}>
          <p>App</p>
        </Toaster>
      </RouteContext.Provider>,
    );
    let id = '';
    act(() => {
      id = notifySaved();
    });
    expect(id).not.toBe('');
    const group = toastGroup('Success: Saved');
    expect(within(group).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '#/documents/42',
    );
    const polite = politeMessages();
    expect(polite.children).toHaveLength(1);
    expect(polite).toHaveTextContent('Success: Saved Open');
    await expectNoA11yViolations(document.body);

    act(() => appToaster.dismissToast(id));
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Success: Saved' })).not.toBeInTheDocument();
  });

  it('a Toaster bound to a second handle stays independent', async () => {
    render(
      <>
        <Toaster toaster={appToaster}>
          <p>App</p>
        </Toaster>
        <Toaster toaster={updatesToaster} position="top-start" aria-label="Updates" />
      </>,
    );
    act(() => {
      updatesToaster.dispatchToast({ title: 'Update installed', timeout: 0 });
    });
    const updates = toastRegion('Updates');
    expect(
      within(updates).getByRole('group', { name: 'Info: Update installed' }),
    ).toBeInTheDocument();
    expect(within(toastRegion()).queryByRole('group')).toBeNull();

    act(() => appToaster.dismissAllToasts());
    await act(async () => {});
    expect(
      within(updates).getByRole('group', { name: 'Info: Update installed' }),
    ).toBeInTheDocument();

    act(() => updatesToaster.dismissAllToasts());
    await act(async () => {});
    expect(within(updates).queryByRole('group')).toBeNull();
  });
});

describe('toasts and a modal Dialog: the shortcut and a tooltip (Phase 3 review focus)', () => {
  it('the focus shortcut focuses the newest toast; Escape returns focus into the Dialog, which stays open', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster
        shortcuts={{
          focus: (event) => event.altKey && event.shiftKey && event.code === 'KeyN',
        }}
      >
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content title="Settings">
            <NotifyButton />
          </Dialog.Content>
        </Dialog>
      </Toaster>,
    );
    await user.click(button('Notify'));
    await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}');
    // The Dialog's focus trap decides about outside focus in a microtask.
    await act(async () => {});
    expect(toastGroup('Info: Saved')).toHaveFocus();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Info: Saved' })).not.toBeInTheDocument();
    expect(button('Notify')).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  function TooltipToastButton() {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="info">
              <Toast.Title
                action={
                  <Tooltip content="Restores the message" openDelay={0}>
                    <Button>Undo</Button>
                  </Tooltip>
                }
              >
                Moved to Archive
              </Toast.Title>
            </Toast>,
          )
        }
      >
        Archive
      </Button>
    );
  }

  it('over a modal Dialog, the first Escape hides only the tooltip, the next dismisses the toasts; the Dialog stays open', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster>
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content title="Mail">
            <TooltipToastButton />
          </Dialog.Content>
        </Dialog>
      </Toaster>,
    );
    await user.click(button('Archive'));
    await user.tab();
    expect(button('Undo')).toHaveFocus();
    await waitFor(() => expect(tooltipSurface()).not.toBeNull());

    await user.keyboard('{Escape}');
    expect(tooltipSurface()).toBeNull();
    expect(toastGroup('Info: Moved to Archive')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Info: Moved to Archive' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Mail' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Archive')).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/__tests__/integration.test.tsx -t "toast" --reporter=default`

Expected: PASS when the packages met their contracts, with no act() warning and no `[WaveUI]` warning in the output. Each failing case is a seam; Step 3 names the owning module.

- [ ] **Step 3: Fix the seams the cases found**

Fix each failure in the module named below, add a unit test for it in that module's own test file (the toasts package's `__tests__/Toaster.keyboard.test.tsx`, `Toaster.content.test.tsx`, `Toast.parts.test.tsx` or `src/lib/__tests__/toaster.test.ts`), and list it in the report:
- The timers run while focus is in the menu → `Toaster.tsx`: the viewport's pause handlers count React focus events from portals opened inside a toast (spec D14; the one C-COMPOSE exception).
- The first Escape closes the toasts (or the Dialog) instead of the menu or tooltip → `Toaster.tsx`: the viewport's Escape handler must ignore targets outside the viewport (`isOwnEvent`) and leave Escape to the layer stack while `getOpenLayers().some((layer) => layer.escape && viewport.contains(layer.getAnchor()))`; it prevents the default when it acts.
- The Dialog closes on the toasts' Escape → the same handler did not call `preventDefault()` (the region counts as inside every layer, `ALLOW_OUTSIDE_SELECTOR`).
- Delete in a portaled Dialog dismisses the toast → the container's keydown handler must check that the target is inside the container in the DOM.
- The shortcut's focus is pulled back into the Dialog → `Toaster.tsx` must focus the container itself (inside `[data-wave-focus-trap-allow]`); `src/hooks/useFocusTrap.ts` leaves focus in an allow-listed region alone.
- `preventDefault()` in the Button's `onClick` still dismisses → `Toast.parts.tsx`: `Toast.Close` composes the child's `onClick` first and skips the dismissal when it is prevented (as `Dialog.Close`).
- The handle's toast misses the context value, or its id is empty → `src/lib/toaster.ts` and the Toaster's binding in `Toaster.tsx` (the handle's toasts render inside the bound Toaster, spec P3-08).
- The announcement text differs from "Success: Saved Open" → `Toaster.tsx`'s announcement composition (spec D13: severity, title, body, then the actions' labels, never "Dismiss").

- [ ] **Step 4: Re-run and check the output**

Run: `npx vitest run src/__tests__/integration.test.tsx --reporter=default` (the whole file: the 0.7 toast cases must stay green)

Expected: PASS, clean output.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.dev.json --noEmit` and `npx eslint src/__tests__/integration.test.tsx --max-warnings 0`

Expected: PASS. (For a seam fix in a component module also run `npx vitest run src/__tests__/conventions.test.ts -t "<that module's path>"`.)

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/integration.test.tsx
git commit -m "test: toasts across components — a menu, a modal, a tooltip, a popover, Toast.Close and a handle"
```

(Add the paths of any seam fix and its unit test to the same commit.)

---

### Task I5: MessageBar, color and tree compositions (§4.4 #6–#9, Review Focus 4–5)

**Files:**
- Modify: `src/__tests__/integration.test.tsx` (imports; describes appended after Task I4's section)
- Seam fixes, if a case fails (Step 3): `src/components/feedback/MessageBar.tsx`, `src/components/feedback/MessageBar.parts.tsx`, `src/components/input/ColorPicker.tsx`, `src/components/input/ColorPicker.parts.tsx`, `src/components/input/ColorArea.tsx`, `src/components/input/ColorSlider.tsx`, `src/components/input/AlphaSlider.tsx`, `src/components/layout/Tree.core.tsx`

**Interfaces:**
- Consumes: from the entry — `MessageBar` (`MessageBar.Title`, `MessageBar.Actions`), `ColorPicker` (`ColorPicker.HexField`, `labels.area` default `'Saturation and brightness'`, `labels.hexInput` default `'Hex color value'`), `ColorArea`, `ColorSlider` (hue name `'Hue'`), `AlphaSlider`, `colorAreaClassNames` (`field`), `Tree` (`selectionMode`, `navigationMode`, `onCheckedItemsChange`, `Tree.Item` `actions`), `Field`, `Popover`, `Dialog`, `Menu`, `MenuButton`, `Button`; the file's helpers `button`, `menuitem`, `duplicateIds`, `expectNoA11yViolations`, `mockRect`.
- Produces: `stubPointerCapture(): void` (module-level test helper).

- [ ] **Step 1: Write the tests**

Add to the value imports from `'../index'`: `AlphaSlider,`, `ColorArea,`, `ColorSlider,`, `MessageBar,`, `colorAreaClassNames,`.

Append after Task I4's section:

```tsx
// ---------------------------------------------------------------------------
// 0.8: message bars, color and trees across components (spec §4.4 #6–#9)
// ---------------------------------------------------------------------------

describe('a MenuButton in MessageBar.Actions (spec §4.4 #6)', () => {
  it('reads the severity, the title and the body once, then the actions, and opens the menu from the action', async () => {
    const user = userEvent.setup();
    render(
      <MessageBar status="warning">
        <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
        <MessageBar.Actions>
          <Menu>
            <Menu.Trigger>
              <MenuButton>Options</MenuButton>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Install tonight</Menu.Item>
              <Menu.Item>Remind me later</Menu.Item>
            </Menu.Popover>
          </Menu>
        </MessageBar.Actions>
      </MessageBar>,
    );
    const bar = screen.getByRole('alert');
    // A live-region bar is not named by its title (spec D16): the title is read with the content.
    expect(bar).not.toHaveAttribute('aria-labelledby');
    expect(bar.textContent).toMatch(
      /^Warning: Update available A new version is ready to install\.\s*Options$/,
    );
    await user.click(within(bar).getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
    expect(menuitem('Install tonight')).toHaveFocus();
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('Options')).toHaveFocus();
  });
});

describe('a composed ColorPicker in a Field (spec §4.4 #7)', () => {
  function ThemeForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
    return (
      <form
        aria-label="Theme"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <Field label="Accent color" error="Pick a darker color">
          <ColorPicker name="accent" defaultValue="#808080">
            <ColorArea />
            <ColorSlider />
            <ColorPicker.HexField />
          </ColorPicker>
        </Field>
        <Button type="submit">Save</Button>
        <Button type="reset">Reset</Button>
      </form>
    );
  }

  it('names the picker by the Field label and describes its hex input by the Field error', async () => {
    render(<ThemeForm onSubmit={() => {}} />);
    const picker = screen.getByRole('group', { name: 'Accent color' });
    expect(
      within(picker).getByRole('group', { name: 'Saturation and brightness' }),
    ).toBeInTheDocument();
    const hex = within(picker).getByRole('textbox', { name: 'Hex color value' });
    expect(hex).toHaveAccessibleDescription(/Pick a darker color/);
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(within(picker).getByRole('slider', { name: 'Hue' })).toBeInTheDocument();
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('submits the hex color; a form reset restores the default and keeps the working hue', async () => {
    const onSubmit = vi.fn<(data: FormData) => void>();
    const user = userEvent.setup();
    render(<ThemeForm onSubmit={onSubmit} />);
    const hue = screen.getByRole('slider', { name: 'Hue' });
    const saturation = screen.getByRole('slider', { name: 'Saturation' });
    // The gray default has no hue of its own: the slider sets the working hue, the hex stays.
    fireEvent.change(hue, { target: { value: '120' } });
    await act(async () => {});
    fireEvent.change(saturation, { target: { value: '50' } });
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Hex color value' })).toHaveValue('#408040');

    await user.click(button('Save'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].get('accent')).toBe('#408040');

    await user.click(button('Reset'));
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Hex color value' })).toHaveValue('#808080');
    expect(hue).toHaveValue('120');
    expect(saturation).toHaveValue('0');
  });

  it('names a standalone ColorSlider by the Field label, not by its "Hue" default', () => {
    render(
      <Field label="Accent hue">
        <ColorSlider />
      </Field>,
    );
    expect(screen.getByRole('slider', { name: 'Accent hue' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull();
  });

  it('a required Field with an error: one control id, no duplicate ids, the area not described by the Field, one required input (review focus)', () => {
    render(
      <form aria-label="Theme">
        <Field label="Accent color" hint="Used for links" error="Pick a darker color" required>
          <ColorPicker name="accent">
            <ColorArea />
            <ColorSlider />
            <AlphaSlider />
            <ColorPicker.HexField />
          </ColorPicker>
        </Field>
      </form>,
    );
    const picker = screen.getByRole('group', { name: 'Accent color' });
    expect(duplicateIds()).toEqual([]);
    const label = screen.getByText(/Accent color/, { selector: 'label' });
    const controlId = label.getAttribute('for');
    if (controlId) {
      expect(document.querySelectorAll(`[id="${controlId}"]`)).toHaveLength(1);
      expect(picker.id).toBe(controlId);
    }
    const area = within(picker).getByRole('group', { name: 'Saturation and brightness' });
    for (const input of within(area).getAllByRole('slider', { hidden: true })) {
      expect(input).not.toHaveAccessibleDescription(/Pick a darker color|Used for links/);
    }
    const required = picker.querySelectorAll('input[required]');
    expect(required).toHaveLength(1);
    expect(required[0]).toHaveAttribute('name', 'accent');
    const form = screen.getByRole('form', { name: 'Theme' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });
});

/** jsdom has no pointer capture: a capture flag per test, restored afterwards. */
function stubPointerCapture() {
  const proto = Element.prototype;
  const names = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const;
  const previous = names.map((name) => Object.getOwnPropertyDescriptor(proto, name));
  let captured = false;
  const define = (name: (typeof names)[number], value: (...args: never[]) => unknown) =>
    Object.defineProperty(proto, name, { configurable: true, writable: true, value });
  define('setPointerCapture', () => {
    captured = true;
  });
  define('releasePointerCapture', () => {
    captured = false;
  });
  define('hasPointerCapture', () => captured);
  onTestFinished(() => {
    names.forEach((name, index) => {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else Reflect.deleteProperty(proto, name);
    });
  });
}

describe('a ColorPicker in a Popover (spec §4.4 #8)', () => {
  it('a drag on the area that ends outside the surface keeps the popover open; Escape closes it and returns focus', async () => {
    stubPointerCapture();
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger>
          <Button>Pick color</Button>
        </Popover.Trigger>
        <Popover.Content title="Color">
          <ColorPicker defaultValue="#0f6cbd" />
        </Popover.Content>
      </Popover>,
    );
    await user.click(button('Pick color'));
    const popover = screen.getByRole('dialog', { name: 'Color' });
    const area = within(popover).getByRole('group', { name: 'Saturation and brightness' });
    const field = area.querySelector<HTMLElement>(`.${colorAreaClassNames.field}`);
    expect(field).not.toBeNull();
    mockRect(area, { x: 0, y: 0, width: 200, height: 100 });
    mockRect(field!, { x: 0, y: 0, width: 200, height: 100 });

    // The press starts inside the surface; the move and the release happen far outside it (with
    // pointer capture the browser keeps targeting the area).
    await user.pointer([
      { keys: '[MouseLeft>]', target: field!, coords: { clientX: 50, clientY: 50 } },
      { target: field!, coords: { clientX: 500, clientY: 500 } },
      { keys: '[/MouseLeft]', target: field!, coords: { clientX: 500, clientY: 500 } },
    ]);
    expect(screen.getByRole('dialog', { name: 'Color' })).toBeInTheDocument();
    const saturation = within(area).getByRole('slider', { name: 'Saturation', hidden: true });
    const brightness = within(area).getByRole('slider', { name: 'Brightness', hidden: true });
    expect(saturation).toHaveValue('100');
    expect(brightness).toHaveValue('0');
    expect(saturation).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Color' })).not.toBeInTheDocument();
    expect(button('Pick color')).toHaveFocus();
  });
});

describe('a Tree with a MenuButton in its actions (spec §4.4 #9)', () => {
  function FileActions({ name }: { name: string }) {
    return (
      <Menu>
        <Menu.Trigger>
          <MenuButton size="small" aria-label={`More actions for ${name}`} />
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  function Files({ onItemSelect }: { onItemSelect?: (value: string) => void }) {
    return (
      <Tree aria-label="Files" navigationMode="treegrid" onItemSelect={onItemSelect}>
        <Tree.Item value="report" actions={<FileActions name="Report.docx" />}>
          Report.docx
        </Tree.Item>
        <Tree.Item value="notes">Notes.txt</Tree.Item>
      </Tree>
    );
  }

  it('ArrowRight reaches the action, ArrowDown opens its menu, Escape returns to it, ArrowLeft to the item', async () => {
    const onItemSelect = vi.fn();
    const user = userEvent.setup();
    render(<Files onItemSelect={onItemSelect} />);
    await user.tab();
    const report = screen.getByRole('treeitem', { name: 'Report.docx' });
    expect(report).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const more = button('More actions for Report.docx');
    expect(more).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { name: 'More actions for Report.docx' })).toBeInTheDocument();
    expect(menuitem('Rename')).toHaveFocus();
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(report).toHaveFocus();
    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('Enter on the action opens its menu and never activates the item', async () => {
    const onItemSelect = vi.fn();
    const user = userEvent.setup();
    render(<Files onItemSelect={onItemSelect} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'More actions for Report.docx' })).toBeInTheDocument();
    expect(onItemSelect).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(button('More actions for Report.docx')).toHaveFocus();
  });

  it('a checkbox Tree in a Dialog: Space toggles the item, Escape closes the Dialog', async () => {
    const onOpenChange = vi.fn();
    const onCheckedItemsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Choose folders">
          <Tree
            aria-label="Folders"
            selectionMode="multiple"
            onCheckedItemsChange={onCheckedItemsChange}
          >
            <Tree.Item value="docs">Documents</Tree.Item>
            <Tree.Item value="music">Music</Tree.Item>
          </Tree>
        </Dialog.Content>
      </Dialog>,
    );
    const docs = screen.getByRole('treeitem', { name: 'Documents' });
    act(() => docs.focus());
    await act(async () => {});
    await user.keyboard(' ');
    expect(docs).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    expect(onCheckedItemsChange).toHaveBeenCalledWith(['docs'], {
      value: 'docs',
      checked: true,
      event: expect.any(Event),
    });
    expect(screen.getByRole('dialog', { name: 'Choose folders' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });

  it('in a Dialog: Escape in the action’s menu closes only the menu; Space on the item toggles it; the next Escape closes the Dialog (review focus)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Files">
          <Tree aria-label="Files" selectionMode="multiple" navigationMode="treegrid">
            <Tree.Item value="report" actions={<FileActions name="Report.docx" />}>
              Report.docx
            </Tree.Item>
            <Tree.Item value="notes">Notes.txt</Tree.Item>
          </Tree>
        </Dialog.Content>
      </Dialog>,
    );
    const report = screen.getByRole('treeitem', { name: 'Report.docx' });
    act(() => report.focus());
    await act(async () => {});
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { name: 'More actions for Report.docx' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('More actions for Report.docx')).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{ArrowLeft}');
    expect(report).toHaveFocus();
    await user.keyboard(' ');
    expect(report).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/__tests__/integration.test.tsx -t "MessageBar|ColorPicker|ColorSlider|Tree with" --reporter=default`

Expected: PASS when the packages met their contracts; clean output. Each failure is a seam (Step 3).

- [ ] **Step 3: Fix the seams the cases found**

Fix each failure in the module named below, with a unit test in that module's own test file, and list it in the report:
- The bar's text order differs, or the bar is labelled → `MessageBar.tsx` (the partition puts the title first after the severity text; a live-region bar gets no `aria-labelledby`, D16).
- A second element with the Field's control id, a duplicated id, or an area input described by the Field → `ColorPicker.tsx` must render its children inside `<FieldContext.Provider value={null}>` (D21), and the bound parts must not call `useFieldControl` with the Field's context.
- More than one required input → a bound part rendered a `HiddenInput` (`ColorArea.tsx`, `ColorSlider.tsx`, `AlphaSlider.tsx`: bound parts render none, D21).
- The reset loses the working hue → `ColorPicker.tsx`'s working-color re-derivation keeps the hue for an achromatic value (D21).
- The drag closes the popover, or the values stay → `ColorArea.tsx`: `onPointerDown` on the root, `setPointerCapture`, the point read from the field's rectangle and clamped, focus on the input with the Tab stop.
- ArrowDown on the action moves to the next item, Enter or Space on it activates or checks the item, or Escape in the menu closes the Dialog → `Tree.core.tsx`: the toolbar leaves ArrowDown/ArrowUp to an action with `aria-haspopup`, the item's handlers ignore events from inside `[data-tree-actions]` (D27).

- [ ] **Step 4: Re-run and check the output**

Run: `npx vitest run src/__tests__/integration.test.tsx --reporter=default`

Expected: PASS, clean output.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.dev.json --noEmit` and `npx eslint src/__tests__/integration.test.tsx --max-warnings 0`

Expected: PASS (plus the conventions gate filter for any component module a seam fix touched).

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/integration.test.tsx
git commit -m "test: message bar actions, a composed ColorPicker and tree actions across components"
```

(Add the paths of any seam fix and its unit test to the same commit.)

---

### Task I6: Class names across compounds and the Server Component suite (§4.4 #10–#11, Review Focus 3)

**Files:**
- Modify: `src/__tests__/integration.test.tsx` (imports; the `cases` array of `describe('compounds composed in a React Server Component', …)`; two describes appended after Task I5's section)
- Seam fixes, if a case fails (Step 3): the module that renders the element (Appendix A), `src/components/button/Button.slots.tsx` (`withPartClass`), `src/components/feedback/MessageBar.reflow.ts`, `src/components/feedback/Toast.root.tsx`, `src/components/feedback/MessageBar.tsx`, `src/components/layout/Tree.core.tsx`, `src/components/layout/Tree.itemPersonaLayout.tsx`

**Interfaces:**
- Consumes: Task I4's `UploadToastButton`, `toastGroup`, `toastRegion`; from the entry — the flat parts `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`, `MessageBarTitle`, `MessageBarActions`, `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`, `TreeItem`, `TreeItemPersonaLayout`, `Avatar`, `Persona`, `SplitButton`, `Toolbar`, `createToaster`, and the registry constants named in Step 1; the file's `asClientReferences`, `ssrCase`, `findDanglingIdRefsInHtml`, `button`, `menuitem`.
- Produces: nothing new.

- [ ] **Step 1: Write the tests**

Add to the value imports from `'../index'`: `Avatar,`, `ColorPickerHexField,`, `ColorPickerPreview,`, `ColorPickerSwatches,`, `MessageBarActions,`, `MessageBarTitle,`, `Persona,`, `ToastBody,`, `ToastClose,`, `ToastFooter,`, `ToastTitle,`, `TreeItemPersonaLayout,`, `avatarClassNames,`, `buttonClassNames,`, `dialogContentClassNames,`, `dialogTitleClassNames,`, `menuButtonClassNames,`, `menuItemClassNames,`, `menuPopoverClassNames,`, `messageBarTitleClassNames,`, `personaClassNames,`, `splitButtonClassNames,`, `toastBodyClassNames,`, `toastClassNames,`, `toasterClassNames,`, `toastTitleClassNames,`, `toggleButtonClassNames,`, `toolbarClassNames,`, `toolbarToggleButtonClassNames,`.

In `describe('compounds composed in a React Server Component', …)`, add above `const cases: SsrCase[] = [`:

```tsx
  const toastDismiss = vi.fn();
```

and append these entries at the end of the `cases` array (before its closing `];`):

```tsx
    ssrCase({
      name: 'Toast (a title with an action, a body with a subtitle, a footer)',
      parts: { Title: ToastTitle, Body: ToastBody, Footer: ToastFooter, Close: ToastClose },
      tree: ({ Title, Body, Footer, Close }) => (
        <Toast status="success" onDismiss={toastDismiss}>
          <Title
            action={
              <Close>
                <Button>Undo</Button>
              </Close>
            }
          >
            Saved
          </Title>
          <Body subtitle="2 files">Your changes are saved.</Body>
          <Footer>
            <Button>View changes</Button>
          </Footer>
        </Toast>
      ),
      serverText: 'Your changes are saved.',
      interact: async (user) => {
        toastDismiss.mockClear();
        // Rendered by the app, not dispatched: its own live region (spec D10).
        const toast = screen.getByRole('status');
        expect(toast).toHaveTextContent(/^Success:\s*Saved/);
        expect(within(toast).getByText('2 files')).toHaveClass(toastBodyClassNames.subtitle);
        await user.click(button('Undo'));
        expect(toastDismiss).toHaveBeenCalledTimes(1);
      },
    }),
    ssrCase({
      name: 'MessageBar (a titled region with actions; no ResizeObserver, as in consumers’ jsdom)',
      parts: { Title: MessageBarTitle, Actions: MessageBarActions },
      tree: ({ Title, Actions }) => (
        <MessageBar status="warning" role="region">
          <Title>Update available</Title>A new version is ready to install.
          <Actions>
            <Button>Install</Button>
          </Actions>
        </MessageBar>
      ),
      serverText: 'Update available',
      interact: async (user) => {
        // The default layout="auto" with actions must not need a ResizeObserver (review focus).
        expect(globalThis.ResizeObserver).toBeUndefined();
        const bar = screen.getByRole('region', { name: 'Warning: Update available' });
        expect(bar).toHaveAttribute('data-layout', 'singleline');
        expect(within(bar).getByText('Update available')).toHaveClass(
          messageBarTitleClassNames.root,
        );
        await user.click(within(bar).getByRole('button', { name: 'Install' }));
        expect(bar).toHaveAttribute('data-layout', 'singleline');
      },
    }),
    ssrCase({
      name: 'ColorPicker (a custom layout of the preview, the hex field and the swatches)',
      parts: {
        HexField: ColorPickerHexField,
        Swatches: ColorPickerSwatches,
        Preview: ColorPickerPreview,
      },
      tree: ({ HexField, Swatches, Preview }) => (
        <ColorPicker aria-label="Accent" defaultValue="#0f6cbd">
          <Preview />
          <HexField />
          <Swatches />
        </ColorPicker>
      ),
      serverText: 'value="#0f6cbd"',
      interact: async (user) => {
        const hex = screen.getByRole('textbox', { name: 'Hex color value' });
        expect(hex).toHaveValue('#0f6cbd');
        await user.click(screen.getByRole('radio', { name: 'Red' }));
        expect(hex).toHaveValue('#d13438');
      },
    }),
    ssrCase({
      name: 'Tree (persona rows in a checkbox tree)',
      parts: { Item: TreeItem, ItemPersonaLayout: TreeItemPersonaLayout },
      tree: ({ Item, ItemPersonaLayout }) => (
        <Tree aria-label="People" selectionMode="multiple" defaultCheckedItems={['ada']}>
          <Item value="ada">
            <ItemPersonaLayout media={<Avatar name="Ada Lovelace" />} description="Engineer">
              Ada Lovelace
            </ItemPersonaLayout>
          </Item>
          <Item value="grace">
            <ItemPersonaLayout description="Admiral">Grace Hopper</ItemPersonaLayout>
          </Item>
        </Tree>
      ),
      serverText: 'aria-checked="true"',
      interact: async (user) => {
        const ada = screen.getByRole('treeitem', { name: 'Ada Lovelace' });
        expect(ada).toHaveAccessibleDescription('Engineer');
        expect(ada).toHaveAttribute('aria-checked', 'true');
        const grace = screen.getByRole('treeitem', { name: 'Grace Hopper' });
        expect(grace).toHaveAttribute('aria-checked', 'false');
        // The checkbox is named like its item: by the person's name, not the description (D25, D28).
        await user.click(screen.getByRole('checkbox', { name: 'Grace Hopper' }));
        expect(grace).toHaveAttribute('aria-checked', 'true');
      },
    }),
```

Append after Task I5's section:

```tsx
// ---------------------------------------------------------------------------
// 0.8: stable class names across compounds, server-safe exports (spec §4.4 #10–#11)
// ---------------------------------------------------------------------------

describe('stable class names across compounds (spec §4.4 #10)', () => {
  it('a Toolbar.ToggleButton carries the classes of Button, ToggleButton and its own, on its root and its icon', () => {
    render(
      <Toolbar aria-label="Formatting">
        <Toolbar.ToggleButton name="format" value="bold" icon={<svg data-testid="bold-icon" />}>
          Bold
        </Toolbar.ToggleButton>
      </Toolbar>,
    );
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toHaveClass(toolbarClassNames.root);
    expect(button('Bold')).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
      toolbarToggleButtonClassNames.root,
    );
    expect(screen.getByTestId('bold-icon').parentElement).toHaveClass(
      buttonClassNames.icon,
      toggleButtonClassNames.icon,
      toolbarToggleButtonClassNames.icon,
    );
  });

  it('a SplitButton’s halves carry the Button class and their part classes', () => {
    render(<SplitButton>Save</SplitButton>);
    expect(screen.getByRole('group')).toHaveClass(splitButtonClassNames.root);
    expect(button('Save')).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.primaryActionButton,
    );
    expect(button('More options')).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.menuButton,
    );
  });

  it('Dialog.Content’s close button and title heading carry their classes', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Settings">Body</Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveClass(dialogContentClassNames.root);
    expect(within(dialog).getByRole('heading', { name: 'Settings' })).toHaveClass(
      dialogTitleClassNames.root,
    );
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveClass(
      buttonClassNames.root,
      dialogContentClassNames.closeButton,
    );
  });

  it('Persona’s built-in Avatar carries the Avatar classes and the Persona part class', () => {
    const { container } = render(<Persona name="Ada Lovelace" secondaryText="Engineer" />);
    expect(container.firstElementChild).toHaveClass(personaClassNames.root);
    const avatar = container.querySelector(`.${personaClassNames.avatar}`);
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveClass(avatarClassNames.root, avatarClassNames.visual);
  });

  it('a Menu in a toast carries both components’ classes', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <UploadToastButton />
      </Toaster>,
    );
    await user.click(button('Upload'));
    expect(toastRegion()).toHaveClass(toasterClassNames.root);
    const group = toastGroup('Success: File uploaded');
    expect(group).toHaveClass(toasterClassNames.toast);
    const label = within(group).getByText('File uploaded');
    expect(label).toHaveClass(toastTitleClassNames.label);
    expect(label.closest(`.${toastTitleClassNames.root}`)).not.toBeNull();
    expect(label.closest(`.${toastClassNames.root}`)).not.toBeNull();
    const more = button('More');
    expect(more).toHaveClass(buttonClassNames.root, menuButtonClassNames.root);
    expect(more.closest(`.${toastTitleClassNames.action}`)).not.toBeNull();
    await user.click(more);
    expect(screen.getByRole('menu', { name: 'More' })).toHaveClass(menuPopoverClassNames.root);
    expect(menuitem('Open file')).toHaveClass(menuItemClassNames.root);
  });
});

/** Created at module scope, as an app's toasts module creates it (P3-08). */
const pageToaster = createToaster();

describe('server-safe 0.8 exports in a server render (spec §4.4 #11)', () => {
  /** A Server Component that styles app markup with a class-name constant (no client code). */
  function StyleNote() {
    return <p data-selector={`.${buttonClassNames.root}`}>Buttons</p>;
  }

  it('a Server Component reads a class-name constant from the entry: a plain string that Button renders first', () => {
    const html = renderToString(
      <>
        <StyleNote />
        <Button>Save</Button>
      </>,
    );
    expect(typeof buttonClassNames.root).toBe('string');
    expect(html).toContain(`data-selector=".${buttonClassNames.root}"`);
    expect(html).toMatch(new RegExp(`<button[^>]* class="${buttonClassNames.root}[ "]`));
  });

  it('a page whose module created a toaster handle renders no toast on the server; the hydrated Toaster shows the handle’s toasts', async () => {
    const tree = (
      <Toaster toaster={pageToaster}>
        <p>Page</p>
      </Toaster>
    );
    const html = renderToString(tree);
    expect(html).toContain('Page');
    expect(html).not.toContain('role="group"');
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    let root: Root | undefined;
    try {
      const error = vi.spyOn(console, 'error');
      await act(async () => {
        root = hydrateRoot(container, tree);
      });
      expect(error).not.toHaveBeenCalled();
      act(() => {
        pageToaster.dispatchToast({ title: 'Welcome back', timeout: 0 });
      });
      expect(screen.getByRole('group', { name: 'Info: Welcome back' })).toBeInTheDocument();
      act(() => pageToaster.dismissAllToasts());
      await act(async () => {});
      expect(screen.queryByRole('group', { name: 'Info: Welcome back' })).toBeNull();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/__tests__/integration.test.tsx -t "stable class names|React Server Component|server-safe" --reporter=default`

Expected: PASS when the packages met their contracts; clean output. The RSC cases run twice each (the same server HTML with lazy part types; hydration without a mismatch). Each failure is a seam (Step 3).

- [ ] **Step 3: Fix the seams the cases found**

Fix each failure in the module named below, with a unit test in that module's own test file, and list it in the report:
- A class missing or on another element → the module that renders the element, as Appendix A places it (first in its `cn()`, literal member access); a variant's icon class → `withPartClass` in `Button.slots.tsx`.
- The lazy tree renders different server HTML, or loses a part → the part identification of `Toast.root.tsx` (scan), `MessageBar.tsx` (partition) or `Tree.core.tsx`/`Tree.selection.ts` (`getElementType(…, { suspend: false })`) uses `isElementOfType`/`getElementType`, never `child.type === Part` (C-COMPOUND).
- The MessageBar case throws `ResizeObserver is not defined`, or logs a hydration error → `MessageBar.reflow.ts` subscribes only when `typeof ResizeObserver !== 'undefined'` (as `Overflow.tsx`'s `hasResizeObserver`, Dialog's footer and Table do) and keeps the server snapshot otherwise.
- The checkbox of a persona row is named "Grace Hopper Admiral" → `Tree.core.tsx`: the checkbox's `aria-labelledby` points at the element(s) that name the item, which is the persona's name once `Tree.ItemPersonaLayout` registers it (D25 "labelled by the item's label", D28 "the item is named by the name only").
- The hydrated handle shows no toast → the Toaster's binding (`Toaster.tsx`, in a layout effect after hydration) or `src/lib/toaster.ts`.

- [ ] **Step 4: Re-run and check the output**

Run: `npx vitest run src/__tests__/integration.test.tsx --reporter=default`

Expected: PASS, clean output.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.dev.json --noEmit` and `npx eslint src/__tests__/integration.test.tsx --max-warnings 0`

Expected: PASS (plus the conventions gate filter for any component module a seam fix touched).

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/integration.test.tsx
git commit -m "test: stable class names across compounds and the 0.8 server component cases"
```

(Add the paths of any seam fix and its unit test to the same commit.)

---

### Task I7: The wave C gate and the report

**Files:**
- Modify: whatever the gate shows broken (Step 3), with its test
- Report: the wave C report to the lead (the message of this task, not a file in the repository)

**Interfaces:**
- Consumes: Tasks I1–I6; `node scripts/claude/gate.mjs` (the exit gate of docs/ROADMAP.md §3: typecheck, lint, format:check, test with `--reporter=default`, build-storybook, build, `verify-dist --final`, check:package, test:pack).
- Produces: a green gate; the list of seam fixes and 0.7 test updates for spec §10. (The CHANGELOG sizes are Task D1's.)

- [ ] **Step 1: Confirm the bridges are closed**

Run:
```bash
grep -n "export const PENDING_FLAT_EXPORTS = \[\];" scripts/verify-dist.mjs
grep -n "const PENDING_CLASS_NAMES: readonly string\[\] = \[\];" src/__tests__/classNames.test.ts
grep -n "const PENDING_PUBLIC_TYPES: readonly string\[\] = \[\];" src/__tests__/public-types.test.ts
grep -n "const PENDING_FLAT_MEMBERS: readonly string\[\] = \[\];" src/__tests__/integration.test.tsx
grep -rnE "from '\.\./src/(components|lib/color|lib/toaster)" stories/ || echo "no module-path story imports"
```
Expected: one line from each of the first four commands, and `no module-path story imports`.

- [ ] **Step 2: Run the whole gate**

Run: `node scripts/claude/gate.mjs --base main` (about four minutes)

Expected: every step passes. The documentation criteria it reports (the CHANGELOG's top section with Added, Changed, Deprecated and Size; README, guide and CLAUDE.md changed) are reported, not enforced: DOCS writes them in wave D. The test step runs with `--reporter=default`; its act() and `[WaveUI]` warning counts must be zero.

- [ ] **Step 3: Fix what the gate found**

For each failing step, read the first error in its log (the summary names the log path), fix it, and re-run only that step (`node scripts/claude/gate.mjs --only <step>`):
- A 0.7 test outside the wave-B packages' files that fails because of a documented 0.8 change (spec §6.4 or CHANGELOG "Changed": the toast container, region-wide pausing, `data-layout`, `data-selection-mode`, the default ColorPicker layout) → update its assertion to the 0.8 behaviour with a comment naming the ruling (`// 0.8: every toast pauses while the region has focus (spec D14)`); list file:line in the report. Never delete a test.
- Any other failing test → a regression: fix the code (INTEGRATION owns every file) with a test that fails before the fix; list it in the report.
- `format:check` → `npx prettier --write <files>`; `lint` → fix the finding (no disable comment outside the spec's listed sites).
- `build-storybook`, `check:package`, `test:pack` → the named file; a story that no longer compiles after the imports switch is fixed in the story.

Commit the fixes (one commit per fix, conventional subject naming the folder, e.g. `fix(feedback): …`), then run the whole gate once more.

Expected: the gate passes.

- [ ] **Step 4: Sizes (no measurement here)**

The CHANGELOG sizes have one owner: Task D1 Step 4 (wave D) measures `dist/styles.css` and the Button-, Toaster-, ColorPicker-only and full-import bundles of this branch and of the published 0.7.0 package with one script, validated against the numbers of the 0.7.0 CHANGELOG. Here, only confirm spec §6.2's expectations from the gate's `verify-dist` output: the Button-only probe keeps `'wave-button'`, drops `'wave-dialog-content'` and contains no color, toast or tree module (Task I2's probes fail otherwise).

- [ ] **Step 5: Write the wave C report**

Send the lead a report with these sections:
1. **Gate:** each step of Step 2 with pass or fail, and the final run's summary line.
2. **Seam fixes:** per fix — the file, what the packages disagreed on (or where a package differed from the spec), the fix, the test that pins it, the task that found it. These become spec §10 notes.
3. **0.7 tests updated:** file:line, the old and the new assertion, the ruling (D-number or §6.4 entry).
4. **Decisions taken:** named types inlined or exported (Task I1 Step 7), the persona checkbox's name (Task I6), any `TreeLabels` export (Task I1 Step 5).
5. **Bundles:** the §6.2 probe results from the gate's `verify-dist` output (sizes are measured by Task D1).
6. **Open items for waves D and E:** anything DOCS must describe differently from the spec, and the behaviours the tests could assert only as attributes (for the real-browser and screen-reader checklist of spec §6.3).

- [ ] **Step 6: Commit**

No commit when Step 3 changed nothing. Otherwise each fix was committed in Step 3; confirm with `git status --short` that the tree is clean.
