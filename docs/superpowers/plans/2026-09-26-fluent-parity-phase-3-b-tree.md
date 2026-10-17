# WaveUI 0.8.0 Phase 3 — P3-tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Tree a multi-select mode with cascading, exposed checkboxes and a mixed state, a single-select radio mode, row content (actions, aside, `iconAfter`, `expandIcon`), a keyboard-only `treegrid` navigation mode and `Tree.ItemPersonaLayout`, without changing a 0.7 tree that uses none of them.

**Architecture:** `Tree.tsx` is split as `Menu.tsx` was in 0.7: the compound module keeps the `Object.assign(…)` compound, its docblock and the flat re-exports, `Tree.core.tsx` holds the root and `Tree.Item` (the item recognises a nested Tree by the root's type, so they share a module), `Tree.context.ts` the contexts, `Tree.selection.ts` the pure cascade model and `Tree.itemPersonaLayout.tsx` the persona layout; imports only point away from `Tree.tsx`. Each item computes its own check state from its own children (the rule that forms child groups) and the checked list, so states render on the server; the top-level items hand their static subtrees to the root, which builds the tree order of a toggle from them. Row actions are a toolbar of the row's own with a roving tab stop from `useRovingTabIndex` (new `tabStop: 'none'`), shown and hidden by CSS only.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` — P3-06 and P3-07 (§2), rulings D23–D28 and D32 (§0.3), the class-name contract §4.1, the P3-tree bullets of §6.4, checklist item 5 of §6.3 (manual; named in the package report), Appendix A rows `treeClassNames`, `treeItemClassNames`, `treeItemPersonaLayoutClassNames`.

**Index:** `docs/superpowers/plans/2026-09-26-fluent-parity-phase-3.md` (wave order, entry conditions, cross-package contract, final gate).

**Commits:** one per task. When packages run in parallel in one checkout, only the lead runs git write commands (spec §0.2 rule 6): a package agent stops at the commit step and reports its file list.

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

Package-specific:

- Owned files: `src/components/layout/Tree.tsx`, `Tree.core.tsx`, `Tree.context.ts`, `Tree.selection.ts`, `Tree.itemPersonaLayout.tsx` and their tests, `stories/Tree.stories.tsx`, `src/hooks/useRovingTabIndex.ts` and `src/hooks/__tests__/useRovingTabIndex.test.tsx` (the `tabStop` option only), and the `'Tree'` entry of `PENDING_FLAT_EXPORTS` in `scripts/verify-dist.mjs` (Task R8; the only change to that file).
- Starts after wave A is committed: `Tree.tsx` then already carries the stable classes of Task A8 (`treeClassNames.root`; `treeItemClassNames.root`, `.row`, `.expandIcon`, `.icon`, `.label`, `.group`). The snippets below show them; anchor every edit on the code you read.
- The VoiceOver spike result decides the marked extra step of Task R3 (`TreeLabels`): read it in the "Wave A report" section at the end of `docs/superpowers/plans/2026-09-26-fluent-parity-phase-3-a-foundation.md` (Task A17 writes it).
- `UseRovingTabIndexOptions['tabStop']` already exists in 0.7 as `'active' | 'last-focused'`, so the spec's `tabStop?: boolean` (D27, P3-07) cannot be added under that name: Task R5 adds the value `'none'` to the existing option instead (no item holds the tab stop). INTEGRATION's type test and DOCS use `'active' | 'last-focused' | 'none'`.
- The barrel is INTEGRATION's: it exports `TreeItemPersonaLayout`, `TreeItemPersonaLayoutProps`, `TreeCheckedItemsChangeDetails` (and `TreeLabels` when Task R3's extra step ran) from `./Tree`, which re-exports all of them.

## Review Focus

1. **Duplicate item values in a checkbox tree** (the 0.7 duplicate warning already fires): a toggle must not crash, each value appears once in the emitted array, and every item with the value renders its state from the checked list. → Task R3 (`duplicate values` test; model case in Task R2).
2. **Items rendered through the app's own component.** At the top level (one component per root node that returns a `Tree.Item` with its nested `Tree.Item`s as direct children, which 0.7 supports) the cascade must work as for written-out items, because each item scans its own children and the top-level items register with the root. Nested inside another item (a recursive component), 0.7 renders the item in the parent's label with the `Tree.Item:inside-label` warning; the parent's check then does not reach it, and the item toggles only its own value, as documented in `Tree.Item`'s JSDoc. → Task R3 (`app components` tests).
3. **A controlled parent that ignores `onCheckedItemsChange`**: the rendered checks stay at `checkedItems`, and each click emits the array computed from the rendered state again (never from a state the parent rejected). → Task R3 (`controlled parent that ignores the callback` test).
4. **Children added later under a listed parent** (lazy loading): the new children render checked because an ancestor is listed, a later toggle lists them individually, and a listed placeholder value that no item has any more is kept as an unmatched value. → Task R3 (`children added later` test; model case in Task R2).
5. **`actions` whose content renders nothing** (`[]`, `false`, `<></>`, `[null, '']`, a condition that is false): no toolbar element, no end cell, no visibility classes on the item, and `navigationMode="treegrid"` behaves as `'tree'` for that row. → Task R6 (`renders no toolbar` test) and Task R7 (`a row without actions` test).

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/components/layout/Tree.tsx` (modify) | The compound (`Object.assign(TreeRoot, { Item, ItemPersonaLayout })`), its component docblock, the flat re-exports and the type re-exports the barrel imports; nothing imports it | R1, R3, R6, R7, R8 |
| `src/components/layout/Tree.core.tsx` (create) | `TreeRoot` (props, expansion, selection state, roving tab stop, context) and `TreeItem` (child groups, check state, row layout, keys and clicks), `TreeItemActions` (the row's toolbar), their helpers | R1, R3, R4, R6, R7, R8 |
| `src/components/layout/Tree.context.ts` (create) | The Tree, parent, label, check-forced and item contexts, their hooks, inert values and shared types | R1, R3, R6, R7, R8 |
| `src/components/layout/Tree.selection.ts` (create) | The pure cascade model: `collectItems`, `computeCheckStates`, `toggleCheck` | R2 |
| `src/components/layout/Tree.itemPersonaLayout.tsx` (create) | `TreeItemPersonaLayout` (media, name, description; registers the ids with its item) | R8 |
| `src/components/layout/__tests__/Tree.test.tsx` (modify) | 0.7 suite; gains `data-selection-mode` and the new compound member | R3, R8 |
| `src/components/layout/__tests__/Tree.selection.test.ts` (create) | Table-driven tests of the model | R2 |
| `src/components/layout/__tests__/Tree.multiselect.test.tsx` (create) | Multiple, single and none modes | R3, R4 |
| `src/components/layout/__tests__/Tree.actions.test.tsx` (create) | Row content, actions, aside, isolation, both navigation modes | R6, R7 |
| `src/components/layout/__tests__/Tree.itemPersonaLayout.test.tsx` (create) | The persona layout | R8 |
| `src/hooks/useRovingTabIndex.ts` (modify) | `tabStop: 'none'` | R5 |
| `src/hooks/__tests__/useRovingTabIndex.test.tsx` (modify) | Its tests and the widened type test | R5 |
| `scripts/verify-dist.mjs` (modify) | `'Tree'` on `PENDING_FLAT_EXPORTS` | R8 |
| `stories/Tree.stories.tsx` (modify) | `MultiSelect`, `ControlledChecks`, `SingleSelect`, `LazyChildren`, `RowActions`, `TreegridNavigation`, `AsideContent`, `CustomExpandIcon`, `PersonaRows` | R9 |

**How 0.7 forms child groups** (read at `Tree.tsx:367-383`, bcbdb51): a `Tree.Item` runs `flattenChildren(children)` over its own children and sorts each node with `isElementOfType`: a `Tree.Item` element (the first one's `value` becomes `firstChildValue`) or a nested `Tree` element goes to the child group, everything else to the label. So nested items count when they are written directly, inside Fragments, or returned by a render function (`children.map(renderNode)`, an array); an item that a component renders is invisible to the parent and lands in its label, where `TreeLabelContext` makes it warn `Tree.Item:inside-label` once. The root does not scan its children at all: top-level items register themselves through the context, so a component that renders a top-level `Tree.Item` works in 0.7. The cascade scan (`collectItems`, Task R2) uses exactly the item rule: it descends only into `Tree.Item` elements' `children`, through Fragments and arrays, never into a nested `Tree` or any other element, and never into a `leaf` item.

---

### Task R1: Split `Tree.tsx` into compound, core and context modules (no behaviour change)

**Files:**
- Create: `src/components/layout/Tree.core.tsx`
- Create: `src/components/layout/Tree.context.ts`
- Modify: `src/components/layout/Tree.tsx` (becomes the compound module)
- Test: `src/components/layout/__tests__/Tree.test.tsx` (unchanged; the safety net), `.storybook/__tests__/exportDocblocks.test.ts` (unchanged)

**Interfaces:**
- Consumes: the wave-A `Tree.tsx` (its stable classes from `src/lib/classNames.ts`).
- Produces: `Tree.context.ts` exports `TreeContextValue`, `TreeContext`, `TreeParentContext`, `TreeLabelContext`, `useTreeContext(component: string): TreeContextValue`; `Tree.core.tsx` exports `TreeProps`, `TreeItemProps`, `TreeRoot`, `TreeItem`; `Tree.tsx` exports `Tree`, `TreeItem`, `type TreeProps`, `type TreeItemProps` (the barrel keeps importing from `./Tree`).

- [ ] **Step 1: Run the Tree suite as the baseline**

Run: `npx vitest run src/components/layout/__tests__/Tree.test.tsx`
Expected: PASS (every 0.7 test, with wave A's stable-class case of `testSystemProps`).

- [ ] **Step 2: Create `src/components/layout/Tree.context.ts`**

Move these declarations out of `Tree.tsx` unchanged (their comments included) and export them: the `TreeContextValue` interface, `TreeContext`, `TreeParentContext`, `TreeLabelContext`, `INERT_CONTEXT` (not exported) and `useTreeContext`. The file:

```ts
import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';

/** The Tree root's state and actions, read by every Tree.Item. */
export interface TreeContextValue {
  expanded: ReadonlySet<string>;
  toggle: (value: string) => void;
  expand: (values: readonly string[]) => void;
  activate: (value: string) => void;
  selected: string | null | undefined;
  current: string | null | undefined;
  getTabIndex: (value: string) => 0 | -1;
  focusValue: (value: string) => void;
  onItemFocus: (value: string) => void;
  /**
   * Development only: counts a mounted item's value and warns once per value that several items
   * share. Returns the unregistration.
   */
  registerValue: (value: string) => () => void;
}

export const TreeContext = React.createContext<TreeContextValue | null>(null);

/** Value of the enclosing Tree.Item (`null` at the top level), for ArrowLeft → parent. */
export const TreeParentContext = React.createContext<string | null>(null);

/**
 * `true` inside the label of a Tree.Item, where a nested Tree.Item ends up when a component
 * renders it (the parent cannot see it among its children); its child group and every Tree root
 * reset it.
 */
export const TreeLabelContext = React.createContext(false);

const INERT_CONTEXT: TreeContextValue = {
  expanded: new Set(),
  toggle: () => {},
  expand: () => {},
  activate: () => {},
  selected: undefined,
  current: undefined,
  getTabIndex: () => -1,
  focusValue: () => {},
  onItemFocus: () => {},
  registerValue: () => () => {},
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useTreeContext(component: string): TreeContextValue {
  const context = React.useContext(TreeContext);
  if (context) return context;
  reportMissingContext(component, '<Tree>');
  return INERT_CONTEXT;
}
```

- [ ] **Step 3: Create `src/components/layout/Tree.core.tsx`**

Move every remaining declaration of `Tree.tsx` except the `Export` section (the compound docblock, `export const Tree` and `export { TreeItem }`), unchanged and in the same order: `EMPTY`, `ITEM_IN_LABEL_MESSAGE`, `warnDuplicateValue`, the `TreeProps` interface, `TreeRoot` (+ `TreeRoot.displayName = 'Tree'`), the `TreeItemProps` interface, `syncTypeaheadText`, `isOwnKeyEvent`, `isOwnClick`, `TreeItem` with its JSDoc (+ `TreeItem.displayName = 'TreeItem'`). Change only the declarations' `export` keywords and the imports:

```tsx
import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { treeClassNames, treeItemClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { ChevronRightIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import {
  TreeContext,
  TreeLabelContext,
  TreeParentContext,
  useTreeContext,
  type TreeContextValue,
} from './Tree.context';
```

Exports of `Tree.core.tsx`: `export interface TreeProps`, `export const TreeRoot`, `export interface TreeItemProps`, `export const TreeItem`. `TreeRoot` keeps carrying **no** docblock of its own (the compound's docblock stays on `Tree` in `Tree.tsx`; `.storybook/__tests__/exportDocblocks.test.ts` fails if the sibling root gains one, C-DOCS). The `/* ---- Tree ---- */` banner comments may move along (they are no docblocks).

- [ ] **Step 4: Reduce `src/components/layout/Tree.tsx` to the compound module**

The whole file:

```tsx
import { TreeItem, TreeRoot } from './Tree.core';

export type { TreeItemProps, TreeProps } from './Tree.core';

/**
 * A hierarchical list (WAI-ARIA Tree View pattern) with a single tab stop: Up/Down move between
 * visible items, Home/End to the first/last, Right expands or moves to the first child, Left
 * collapses or moves to the parent (both mirrored in RTL), Enter/Space activate (and toggle a
 * parent), `*` expands the siblings, and typing jumps to an item by its text.
 *
 * Keyboard focus enters at the `selected` item, else the first item; while focus is inside, the
 * tab stop follows it, so Shift+Tab leaves the tree.
 *
 * Items are `Tree.Item` elements; nested items are written in their parent's children (directly,
 * in Fragments, or returned by a render function), not rendered by a component of their own.
 * Every item needs a `value` that is unique within the Tree.
 *
 * `Tree.Item` is also exported as `TreeItem` for React Server Components, which cannot use the
 * dotted form.
 */
export const Tree = /* @__PURE__ */ Object.assign(TreeRoot, {
  Item: TreeItem,
});

export { TreeItem };
```

(The docblock is 0.7's, word for word; Tasks R3, R6 and R8 rewrite it.)

- [ ] **Step 5: Run the Tree suite, the docblock gate and the conventions gate**

Run: `npx vitest run src/components/layout/__tests__/Tree.test.tsx .storybook/__tests__/exportDocblocks.test.ts`
Expected: PASS (the docblock test lists `Tree (src/components/layout/Tree.tsx)` and finds `TreeRoot` in `Tree.core.tsx` without a docblock).

Run: `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/Tree"`
Expected: PASS for `Tree.tsx`, `Tree.core.tsx` and `Tree.context.ts` (the `class-names` rule finds `treeClassNames.root` and `treeItemClassNames.root` in `Tree.core.tsx`, which sets both display names).

- [ ] **Step 6: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit` (includes `src/components/layout/index.ts`, which still imports `Tree`, `TreeItem`, `TreeProps` and `TreeItemProps` from `./Tree`), `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts --max-warnings 0`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts
git commit -m "refactor(layout): split Tree into compound, core and context modules"
```

---

### Task R2: The cascade model (`Tree.selection.ts`)

**Files:**
- Create: `src/components/layout/Tree.selection.ts`
- Test: `src/components/layout/__tests__/Tree.selection.test.ts`

**Interfaces:**
- Consumes: `flattenChildren`, `getElementType` from `src/lib/children.ts`.
- Produces (internal, used by Task R3):
  - `interface TreeNode { value: string; children: TreeNode[] }`
  - `type CheckState = 'checked' | 'mixed' | 'unchecked'`
  - `interface TreeElementTypes { item: unknown; tree: unknown }`
  - `collectItems(children: React.ReactNode, types: TreeElementTypes): TreeNode[]`
  - `computeCheckStates(nodes: readonly TreeNode[], listed: ReadonlySet<string>, ancestorListed?: boolean): Map<string, CheckState>`
  - `toggleCheck(nodes: readonly TreeNode[], listed: readonly string[], value: string): string[]`

- [ ] **Step 1: Write the failing tests**

Create `src/components/layout/__tests__/Tree.selection.test.ts`:

```ts
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { asClientReference } from '../../../test-utils';
import {
  collectItems,
  computeCheckStates,
  toggleCheck,
  type CheckState,
  type TreeNode,
} from '../Tree.selection';

/** Stand-ins for the item and tree types: the model receives the types it compares with. */
const Item = (_props: { value: string; leaf?: boolean; children?: React.ReactNode }) => null;
const NestedTree = (_props: { children?: React.ReactNode }) => null;
const TYPES = { item: Item, tree: NestedTree };
const h = React.createElement;

const node = (value: string, ...children: TreeNode[]): TreeNode => ({ value, children });

/**
 * docs
 *   work
 *     report
 *     slides
 *   personal
 * images
 *   photo
 * readme
 */
const FILES: TreeNode[] = [
  node('docs', node('work', node('report'), node('slides')), node('personal')),
  node('images', node('photo')),
  node('readme'),
];

const statesOf = (listed: string[], nodes: TreeNode[] = FILES, ancestorListed = false) =>
  Object.fromEntries(computeCheckStates(nodes, new Set(listed), ancestorListed));

describe('collectItems', () => {
  it('collects items written directly, in Fragments and in arrays (render functions), in element order', () => {
    const children = [
      h(Item, { key: 'a', value: 'a' }),
      h(React.Fragment, { key: 'f' }, h(Item, { value: 'b' }), [h(Item, { key: 'c', value: 'c' })]),
    ];
    expect(collectItems(children, TYPES)).toEqual([node('a'), node('b'), node('c')]);
  });

  it('descends into the children of items only, and ignores label content', () => {
    const tree = h(
      Item,
      { value: 'docs' },
      'Documents',
      h('span', null, 'label text', h(Item, { value: 'inside-label' })),
      h(Item, { value: 'work' }, 'Work', h(Item, { value: 'report' }, 'Report')),
    );
    expect(collectItems(tree, TYPES)).toEqual([node('docs', node('work', node('report')))]);
  });

  it('gives a leaf item no children, and does not enter a nested tree', () => {
    const tree = [
      h(Item, { key: 'l', value: 'leafy', leaf: true }, 'Leafy', h(Item, { value: 'hidden' })),
      h(Item, { key: 'n', value: 'holder' }, 'Holder', h(NestedTree, null, h(Item, { value: 'own' }))),
    ];
    expect(collectItems(tree, TYPES)).toEqual([node('leafy'), node('holder')]);
  });

  it('counts items whatever their expansion: the scan reads elements, not the DOM', () => {
    const deep = h(Item, { value: 'a' }, h(Item, { value: 'b' }, h(Item, { value: 'c' })));
    expect(collectItems(deep, TYPES)).toEqual([node('a', node('b', node('c')))]);
  });

  it('recognises an item written in a Server Component (a loaded lazy type)', () => {
    const LazyItem = asClientReference(Item);
    expect(collectItems(h(LazyItem, { value: 'lazy' }, h(LazyItem, { value: 'child' })), TYPES)).toEqual([
      node('lazy', node('child')),
    ]);
  });

  it('skips a lazy type whose code is still loading instead of suspending', () => {
    const Loading = React.lazy(() => new Promise<{ default: typeof Item }>(() => {}));
    expect(() => collectItems(h(Loading, { value: 'later' }), TYPES)).not.toThrow();
    expect(collectItems(h(Loading, { value: 'later' }), TYPES)).toEqual([]);
  });
});

describe('computeCheckStates', () => {
  it.each<[string, string[], Record<string, CheckState>]>([
    [
      'a listed leaf: its ancestors are mixed',
      ['report'],
      { report: 'checked', slides: 'unchecked', work: 'mixed', docs: 'mixed', personal: 'unchecked' },
    ],
    ['all children checked: the parent is checked', ['report', 'slides'], { work: 'checked', docs: 'mixed' }],
    ['checks propagate up two levels', ['report', 'slides', 'personal'], { work: 'checked', docs: 'checked' }],
    [
      'a listed parent checks every descendant',
      ['docs'],
      { docs: 'checked', work: 'checked', report: 'checked', slides: 'checked', personal: 'checked', images: 'unchecked' },
    ],
    [
      'a listed middle item checks below and mixes above',
      ['work'],
      { work: 'checked', report: 'checked', slides: 'checked', docs: 'mixed', personal: 'unchecked' },
    ],
    ['a single checked child checks its parent', ['photo'], { images: 'checked', photo: 'checked' }],
    ['a leaf is checked only when listed or under a listed ancestor', ['readme'], { readme: 'checked', docs: 'unchecked', photo: 'unchecked' }],
    ['values that match no item change nothing', ['ghost'], { docs: 'unchecked', readme: 'unchecked' }],
  ])('%s', (_name, listed, expected) => {
    expect(statesOf(listed)).toMatchObject(expected);
  });

  it('with ancestorListed, every item is checked (an item under a listed parent)', () => {
    expect(new Set(Object.values(statesOf([], [FILES[0]], true)))).toEqual(new Set(['checked']));
  });

  it('keeps the state of the first item of a duplicated value', () => {
    const nodes = [node('x', node('a')), node('x')];
    expect(statesOf(['a'], nodes)).toEqual({ x: 'checked', a: 'checked' });
  });
});

describe('toggleCheck', () => {
  it.each<[string, string[], string, string[]]>([
    ['checks an unchecked leaf', [], 'report', ['report']],
    ['completing the siblings checks the parent (tree order)', ['report'], 'slides', ['work', 'report', 'slides']],
    ['checks a parent and every descendant', [], 'docs', ['docs', 'work', 'report', 'slides', 'personal']],
    ['unchecks a checked parent and every descendant', ['docs'], 'docs', []],
    ['unchecking under a listed parent lists the siblings instead', ['docs'], 'report', ['slides', 'personal']],
    ['toggling a mixed item checks it and its descendants', ['report'], 'work', ['work', 'report', 'slides']],
    ['keeps listed values that match no item, after the tree order', ['ghost', 'report'], 'slides', ['work', 'report', 'slides', 'ghost']],
    ['adds a value no item has to the unmatched values', ['report'], 'ghost', ['report', 'ghost']],
    ['removes a value no item has from the unmatched values', ['report', 'ghost'], 'ghost', ['report']],
    ['emits every value once, also when the list repeats one', ['report', 'report'], 'readme', ['report', 'readme']],
  ])('%s', (_name, listed, value, expected) => {
    expect(toggleCheck(FILES, listed, value)).toEqual(expected);
  });

  it('emits a duplicated value once and toggles its first item', () => {
    expect(toggleCheck([node('x', node('a')), node('x')], [], 'a')).toEqual(['x', 'a']);
  });

  it('a placeholder child is an item like any other; once real children replace it, its listed value is kept as unmatched', () => {
    const loading = [node('remote', node('remote-loading'))];
    expect(toggleCheck(loading, [], 'remote')).toEqual(['remote', 'remote-loading']);
    const loaded = [node('remote', node('a'), node('b'))];
    expect(toggleCheck(loaded, ['remote', 'remote-loading'], 'a')).toEqual(['b', 'remote-loading']);
  });

  it('a leaf item (no scanned children) toggles only itself', () => {
    const tree = collectItems(
      h(Item, { value: 'leafy', leaf: true }, h(Item, { value: 'hidden' })),
      TYPES,
    );
    expect(toggleCheck(tree, [], 'leafy')).toEqual(['leafy']);
  });

  it('returns a new array and never mutates the listed values', () => {
    const listed = Object.freeze(['report']) as readonly string[];
    const next = toggleCheck(FILES, listed, 'slides');
    expect(next).not.toBe(listed);
    expect(listed).toEqual(['report']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/layout/__tests__/Tree.selection.test.ts`
Expected: FAIL — `Failed to resolve import "../Tree.selection"`.

- [ ] **Step 3: Implement `src/components/layout/Tree.selection.ts`**

```ts
import * as React from 'react';
import { flattenChildren, getElementType } from '../../lib/children';

/** One Tree.Item of the cascade model: its value and the items nested in it. */
export interface TreeNode {
  value: string;
  children: TreeNode[];
}

/** The check state of an item in a `selectionMode="multiple"` tree. */
export type CheckState = 'checked' | 'mixed' | 'unchecked';

/** The element types the scan compares with: the item type, and the tree type (a tree of its own). */
export interface TreeElementTypes {
  item: unknown;
  tree: unknown;
}

interface ItemElementProps {
  value?: unknown;
  leaf?: unknown;
  children?: React.ReactNode;
}

/**
 * The Tree.Item elements among `children`, recursively and in element order: the rule that forms
 * an item's child group (items written directly, in Fragments, or returned by a render function),
 * so the items of a collapsed item count too. A `leaf` item has none; a nested tree is a tree of
 * its own; any other element is not entered (an item that a component renders is not part of a
 * child group). A lazy type whose code is still loading is skipped instead of suspending the
 * caller (`getElementType(…, { suspend: false })`, as walks deeper than the direct children do).
 */
export function collectItems(children: React.ReactNode, types: TreeElementTypes): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const { node } of flattenChildren(children)) {
    if (!React.isValidElement<ItemElementProps>(node)) continue;
    const type = getElementType(node, { suspend: false });
    if (type === types.tree || type !== types.item) continue;
    const { value, leaf, children: nested } = node.props;
    if (typeof value !== 'string') continue;
    nodes.push({ value, children: leaf === true ? [] : collectItems(nested, types) });
  }
  return nodes;
}

function forEachNode(nodes: readonly TreeNode[], visit: (node: TreeNode) => void): void {
  for (const node of nodes) {
    visit(node);
    forEachNode(node.children, visit);
  }
}

/** The first item with `value` in tree order and its ancestors, from the top down; `null` if none. */
function findPath(nodes: readonly TreeNode[], value: string): TreeNode[] | null {
  for (const node of nodes) {
    if (node.value === value) return [node];
    const below = findPath(node.children, value);
    if (below) return [node, ...below];
  }
  return null;
}

/**
 * The check state of every item: checked when its value is listed, when an ancestor's value is
 * listed (or `ancestorListed`), or when it has nested items and all of them are checked; mixed
 * when some of them are checked or mixed; else unchecked. For a value that several items share,
 * the first item in tree order decides the entry.
 */
export function computeCheckStates(
  nodes: readonly TreeNode[],
  listed: ReadonlySet<string>,
  ancestorListed = false,
): Map<string, CheckState> {
  const first = new Map<string, TreeNode>();
  forEachNode(nodes, (candidate) => {
    if (!first.has(candidate.value)) first.set(candidate.value, candidate);
  });
  const states = new Map<string, CheckState>();
  const visit = (current: TreeNode, forcedAbove: boolean): CheckState => {
    const forced = forcedAbove || listed.has(current.value);
    const childStates = current.children.map((child) => visit(child, forced));
    let state: CheckState;
    if (forced) state = 'checked';
    else if (childStates.length === 0) state = 'unchecked';
    else if (childStates.every((childState) => childState === 'checked')) state = 'checked';
    else if (childStates.some((childState) => childState !== 'unchecked')) state = 'mixed';
    else state = 'unchecked';
    if (first.get(current.value) === current) states.set(current.value, state);
    return state;
  };
  for (const top of nodes) visit(top, ancestorListed);
  return states;
}

/**
 * The checked items after toggling `value`. A checked item and every item nested in it become
 * unchecked; an unchecked or mixed one and every item nested in it become checked; its ancestors
 * then follow their nested items. Returns every checked item in tree order (fully checked parents
 * included, mixed ones not), each value once, followed by the listed values that match no item,
 * in their order; a value that no item has is added to, or removed from, those.
 */
export function toggleCheck(
  nodes: readonly TreeNode[],
  listed: readonly string[],
  value: string,
): string[] {
  const states = computeCheckStates(nodes, new Set(listed));
  const checked = new Set<string>();
  for (const [itemValue, state] of states) {
    if (state === 'checked') checked.add(itemValue);
  }
  const known = new Set<string>();
  forEachNode(nodes, (candidate) => known.add(candidate.value));
  const unmatched = Array.from(new Set(listed.filter((listedValue) => !known.has(listedValue))));

  const path = findPath(nodes, value);
  if (path) {
    const target = path[path.length - 1];
    const turnOn = states.get(value) !== 'checked';
    forEachNode([target], (candidate) => {
      if (turnOn) checked.add(candidate.value);
      else checked.delete(candidate.value);
    });
    for (let index = path.length - 2; index >= 0; index -= 1) {
      const ancestor = path[index];
      if (ancestor.children.every((child) => checked.has(child.value))) checked.add(ancestor.value);
      else checked.delete(ancestor.value);
    }
  } else {
    const at = unmatched.indexOf(value);
    if (at === -1) unmatched.push(value);
    else unmatched.splice(at, 1);
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  forEachNode(nodes, (candidate) => {
    if (checked.has(candidate.value) && !seen.has(candidate.value)) {
      seen.add(candidate.value);
      ordered.push(candidate.value);
    }
  });
  return [...ordered, ...unmatched];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/layout/__tests__/Tree.selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/components/layout/Tree.selection.ts src/components/layout/__tests__/Tree.selection.test.ts --max-warnings 0`, `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/Tree.selection.ts"`
Expected: no errors; the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Tree.selection.ts src/components/layout/__tests__/Tree.selection.test.ts
git commit -m "feat(layout): cascade model for Tree checks"
```

---
### Task R3: `selectionMode="multiple"` — exposed checkboxes, the cascade, Space and `checkedItems`

**Files:**
- Modify: `src/components/layout/Tree.context.ts`
- Modify: `src/components/layout/Tree.core.tsx`
- Modify: `src/components/layout/Tree.tsx` (docblock paragraph; type re-export)
- Modify: `src/components/layout/__tests__/Tree.test.tsx` (one `data-selection-mode` case)
- Test: `src/components/layout/__tests__/Tree.multiselect.test.tsx` (create)

**Interfaces:**
- Consumes: Task R2's `collectItems`, `computeCheckStates`, `toggleCheck`, `TreeNode`, `CheckState`; `treeItemClassNames.indicator` (Appendix A; a Phase 3 key on `PENDING_CLASS_NAMES`, so the registry test does not require it yet).
- Produces:
  - `TreeProps` gains `selectionMode?: 'none' | SelectionMode`, `checkedItems?: readonly string[]`, `defaultCheckedItems?: readonly string[]`, `onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void`.
  - `export interface TreeCheckedItemsChangeDetails { value: string; checked: boolean; event: Event }` (in `Tree.core.tsx`, re-exported by `Tree.tsx`).
  - `TreeContextValue` gains `selectionMode`, `checked: ReadonlySet<string>`, `toggleChecked(value: string, event: Event): void`, `registerTopLevel(entry: React.RefObject<TreeSelectionEntry | null>): () => void`.
  - `Tree.context.ts` gains `export interface TreeSelectionEntry { node: TreeNode; element: HTMLElement | null }` and `export const TreeCheckForcedContext` (boolean).
  - Internal DOM markers: `data-tree-checkbox` on the checkbox (Tasks R6–R8 rely on it).

- [ ] **Step 1: Write the failing tests**

Create `src/components/layout/__tests__/Tree.multiselect.test.tsx`:

```tsx
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, type TreeCheckedItemsChangeDetails, type TreeProps } from '../Tree';
import { treeItemClassNames } from '../../../lib/classNames';
import { forcedColors } from '../../../lib/styles';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/**
 * docs
 *   work
 *     report
 *     slides
 *   personal
 * images
 *   photo
 * readme
 * Tree order: docs, work, report, slides, personal, images, photo, readme.
 */
const files = (
  <>
    <Tree.Item value="docs">
      Documents
      <Tree.Item value="work">
        Work
        <Tree.Item value="report">Report.docx</Tree.Item>
        <Tree.Item value="slides">Slides.pptx</Tree.Item>
      </Tree.Item>
      <Tree.Item value="personal">Personal.txt</Tree.Item>
    </Tree.Item>
    <Tree.Item value="images">
      Images
      <Tree.Item value="photo">Photo.jpg</Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme">Readme.md</Tree.Item>
  </>
);

const ALL_EXPANDED = ['docs', 'work', 'images'];

const item = (name: string) => screen.getByRole('treeitem', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });

/** The `[WaveUI]` warnings logged so far (asserted, never silenced). */
const warnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.map(([message]) => String(message));

const ITEM_IN_LABEL_WARNING =
  '[WaveUI] Tree.Item was rendered inside the label of another Tree.Item, so it is not part ' +
  "of that item's child group: the parent cannot expand, its name includes the nested " +
  'text, and a treeitem sits inside a label (axe aria-required-parent). A Tree.Item finds ' +
  'its nested items among its own children (written directly, in Fragments, or returned ' +
  'by a render function such as `children.map(renderNode)`), but not inside a component ' +
  'that renders Tree.Item itself. Build a data-driven tree with a render function instead ' +
  'of a recursive component.';

function renderChecks(props: Partial<TreeProps> = {}) {
  return render(
    <Tree aria-label="Files" selectionMode="multiple" {...props}>
      {files}
    </Tree>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Tree - selectionMode="multiple"', () => {
  it('marks the tree multiselectable and renders each item state with aria-checked and data-*', () => {
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['report'] });
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('aria-multiselectable', 'true');
    expect(tree).toHaveAttribute('data-selection-mode', 'multiple');

    expect(item('Report.docx')).toHaveAttribute('aria-checked', 'true');
    expect(item('Report.docx')).toHaveAttribute('data-checked', '');
    expect(item('Report.docx')).not.toHaveAttribute('data-mixed');
    expect(item('Work')).toHaveAttribute('aria-checked', 'mixed');
    expect(item('Work')).toHaveAttribute('data-mixed', '');
    expect(item('Work')).not.toHaveAttribute('data-checked');
    expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
    expect(item('Slides.pptx')).toHaveAttribute('aria-checked', 'false');
    expect(item('Slides.pptx')).not.toHaveAttribute('data-checked');
    expect(item('Slides.pptx')).not.toHaveAttribute('data-mixed');
    // An item carries aria-checked or aria-selected, never both (APG).
    expect(item('Readme.md')).not.toHaveAttribute('aria-selected');

    expect(checkbox('Report.docx')).toHaveAttribute('aria-checked', 'true');
    expect(checkbox('Work')).toHaveAttribute('aria-checked', 'mixed');
    expect(checkbox('Slides.pptx')).toHaveAttribute('aria-checked', 'false');
  });

  it('a listed parent checks every descendant, and a parent whose collapsed descendants are all listed is checked', () => {
    const { unmount } = renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['docs'] });
    for (const name of ['Documents', 'Work', 'Report.docx', 'Slides.pptx', 'Personal.txt']) {
      expect(item(name)).toHaveAttribute('aria-checked', 'true');
    }
    expect(item('Images')).toHaveAttribute('aria-checked', 'false');
    unmount();

    // Collapsed: the nested items are not rendered, but they are the parent's descendants.
    renderChecks({ defaultCheckedItems: ['report', 'slides', 'personal'] });
    expect(item('Documents')).toHaveAttribute('aria-checked', 'true');
  });

  it('draws an exposed checkbox after the chevron: outside the Tab order, named by the item, skipped by the arrow keys', async () => {
    const user = userEvent.setup();
    renderChecks({ defaultExpandedItems: ['docs'] });
    const box = checkbox('Documents');
    expect(box).toHaveAttribute('tabindex', '-1');
    expect(box).toHaveClass(treeItemClassNames.indicator);
    expect(box).not.toHaveAttribute('data-roving-value');
    const row = item('Documents').querySelector('[data-tree-row]')!;
    expect(row.children[0].tagName.toLowerCase()).toBe('svg');
    expect(row.children[1]).toBe(box);

    act(() => item('Documents').focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
  });

  it('Space toggles the focused item with details { value, checked, event }; Enter activates without toggling', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onItemSelect = vi.fn();
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, onCheckedItemsChange, onItemSelect });

    act(() => item('Work').focus());
    await user.keyboard(' ');
    expect(onCheckedItemsChange.mock.calls).toEqual([
      [['work', 'report', 'slides'], { value: 'work', checked: true, event: expect.any(KeyboardEvent) }],
    ]);
    expect(item('Work')).toHaveAttribute('aria-checked', 'true');
    expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
    expect(item('Work')).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(onCheckedItemsChange).toHaveBeenLastCalledWith([], {
      value: 'work',
      checked: false,
      event: expect.any(KeyboardEvent),
    });

    act(() => item('Readme.md').focus());
    await user.keyboard('{Enter}');
    expect(onItemSelect.mock.calls).toEqual([['readme']]);
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(2);
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'false');
  });

  it('a click on the checkbox toggles the check, does not activate or expand, and keeps focus on the item', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onItemSelect = vi.fn();
    renderChecks({ onCheckedItemsChange, onItemSelect });
    await user.click(checkbox('Documents'));
    expect(onCheckedItemsChange.mock.calls).toEqual([
      [
        ['docs', 'work', 'report', 'slides', 'personal'],
        { value: 'docs', checked: true, event: expect.any(MouseEvent) },
      ],
    ]);
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Documents')).toHaveFocus();
  });

  it('a click elsewhere on the row activates the item and does not toggle', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const onItemSelect = vi.fn();
    renderChecks({ onCheckedItemsChange, onItemSelect });
    await user.click(screen.getByText('Readme.md'));
    expect(onItemSelect.mock.calls).toEqual([['readme']]);
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'false');
  });

  it('uncontrolled: defaultCheckedItems seeds the checks and each toggle calls back', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    renderChecks({ defaultExpandedItems: ['images'], defaultCheckedItems: ['photo'], onCheckedItemsChange });
    expect(item('Images')).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox('Photo.jpg'));
    expect(onCheckedItemsChange).toHaveBeenLastCalledWith([], expect.objectContaining({ value: 'photo', checked: false }));
    expect(item('Images')).toHaveAttribute('aria-checked', 'false');
    expect(Object.isFrozen(onCheckedItemsChange.mock.calls[0][0])).toBe(false);
  });

  it('controlled: the checks follow a parent that accepts the change', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [checked, setChecked] = React.useState<string[]>([]);
      return (
        <Tree aria-label="Files" selectionMode="multiple" checkedItems={checked} onCheckedItemsChange={setChecked}>
          {files}
        </Tree>
      );
    }
    render(<Controlled />);
    await user.click(checkbox('Images'));
    expect(item('Images')).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox('Readme.md'));
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'true');
    expect(item('Images')).toHaveAttribute('aria-checked', 'true');
  });

  it('a controlled parent that ignores the callback keeps the rendered checks, and each click emits from them again', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    renderChecks({ checkedItems: ['readme'], onCheckedItemsChange });
    await user.click(checkbox('Images'));
    await user.click(checkbox('Images'));
    expect(onCheckedItemsChange.mock.calls.map(([items]) => items)).toEqual([
      ['images', 'photo', 'readme'],
      ['images', 'photo', 'readme'],
    ]);
    expect(item('Images')).toHaveAttribute('aria-checked', 'false');
    expect(item('Readme.md')).toHaveAttribute('aria-checked', 'true');
  });

  it('accepts readonly lists and emits a mutable one', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    const listed = ['readme'] as const;
    renderChecks({ checkedItems: listed, onCheckedItemsChange });
    await user.click(checkbox('Images'));
    expect(Object.isFrozen(onCheckedItemsChange.mock.calls[0][0])).toBe(false);
  });

  it('StrictMode: onCheckedItemsChange fires exactly once per toggle', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <Tree aria-label="Files" selectionMode="multiple" onCheckedItemsChange={onCheckedItemsChange}>
          {files}
        </Tree>
      </React.StrictMode>,
    );
    await user.click(checkbox('Documents'));
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    act(() => item('Readme.md').focus());
    await user.keyboard(' ');
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(2);
  });

  it('a Space that continues a typeahead search does not toggle', async () => {
    const user = userEvent.setup();
    const onCheckedItemsChange = vi.fn();
    render(
      <Tree aria-label="States" selectionMode="multiple" onCheckedItemsChange={onCheckedItemsChange}>
        <Tree.Item value="al">Alabama</Tree.Item>
        <Tree.Item value="nj">New Jersey</Tree.Item>
        <Tree.Item value="ny">New York</Tree.Item>
      </Tree>,
    );
    act(() => item('Alabama').focus());
    await user.keyboard('new y');
    expect(item('New York')).toHaveFocus();
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
  });

  it('keeps * (expand siblings) and current', async () => {
    const user = userEvent.setup();
    renderChecks({ current: 'readme' });
    act(() => item('Documents').focus());
    await user.keyboard('*');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Images')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Readme.md')).toHaveAttribute('aria-current', 'true');
  });

  it('draws the checkbox with Checkbox forced-colors recipe', () => {
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['report'] });
    expect(checkbox('Report.docx')).toHaveClass('forced-colors:border-[Highlight]', 'forced-colors:bg-[Highlight]');
    expect(checkbox('Slides.pptx')).toHaveClass(...forcedColors.control.split(' '));
    expect(checkbox('Report.docx').querySelector('svg')).toHaveClass(...forcedColors.selectedLeaf.split(' '));
    expect(checkbox('Work').querySelector('svg')).toHaveClass(...forcedColors.selectedLeaf.split(' '));
    expect(checkbox('Slides.pptx').querySelector('svg')).toBeNull();
  });

  it('renders the states on the server and hydrates without warnings', async () => {
    const tree = (
      <Tree aria-label="Files" selectionMode="multiple" defaultExpandedItems={['docs']} defaultCheckedItems={['personal']}>
        {files}
      </Tree>
    );
    const html = renderToString(tree);
    expect(html).toContain('aria-multiselectable="true"');
    expect(html).toMatch(/role="checkbox" aria-checked="mixed"/);
    expect(html).toMatch(/role="checkbox" aria-checked="true"/);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
      expect(item('Personal.txt')).toHaveAttribute('aria-checked', 'true');
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
      warn.mockRestore();
    }
  });

  it('RTL: the checkbox sits after the chevron, at the start side', () => {
    renderWithProviders(
      <Tree aria-label="Files" selectionMode="multiple">
        {files}
      </Tree>,
      { dir: 'rtl' },
    );
    const row = item('Documents').querySelector('[data-tree-row]')!;
    expect(row.children[0].tagName.toLowerCase()).toBe('svg');
    expect(row.children[1]).toHaveAttribute('role', 'checkbox');
  });

  it('has no accessibility violations with a mixed parent', async () => {
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['report'] });
    await expectNoA11yViolations();
  });

  describe('warnings (C-DEV)', () => {
    it('selected has no effect in a checkbox tree', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ui = (
        <Tree aria-label="Files" selectionMode="multiple" selected="readme">
          {files}
        </Tree>
      );
      const { rerender } = render(ui);
      rerender(ui);
      expect(item('Readme.md')).not.toHaveAttribute('aria-selected');
      expect(warnings(warn)).toEqual([
        '[WaveUI] Tree: `selected` has no effect with selectionMode="multiple"; use ' +
          '`checkedItems`, and `current` for the item the user is on.',
      ]);
    });

    it('checkedItems or defaultCheckedItems without selectionMode="multiple"', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tree aria-label="Files" defaultCheckedItems={['readme']}>
          {files}
        </Tree>,
      );
      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(item('Readme.md')).not.toHaveAttribute('aria-checked');
      expect(warnings(warn)).toEqual([
        '[WaveUI] Tree: `checkedItems` and `defaultCheckedItems` need selectionMode="multiple"; ' +
          'without it the tree draws no checkboxes and ignores them.',
      ]);
    });
  });

  describe('edge cases', () => {
    it('duplicate values: no crash, the value is emitted once, every item with it shows the state', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onCheckedItemsChange = vi.fn();
      render(
        <Tree aria-label="Files" selectionMode="multiple" onCheckedItemsChange={onCheckedItemsChange}>
          <Tree.Item value="a">First</Tree.Item>
          <Tree.Item value="a">Copy</Tree.Item>
          <Tree.Item value="b">Second</Tree.Item>
        </Tree>,
      );
      await user.click(checkbox('Copy'));
      expect(onCheckedItemsChange.mock.calls.map(([items]) => items)).toEqual([['a']]);
      expect(item('First')).toHaveAttribute('aria-checked', 'true');
      expect(item('Copy')).toHaveAttribute('aria-checked', 'true');
      expect(warnings(warn)).toEqual([
        '[WaveUI] Tree: several items share the value "a". Item values must be unique within a ' +
          'Tree; items with the same value share their expanded, selected and focus state.',
      ]);
    });

    it('app components at the top level: each item scans its own children, so checks cascade', async () => {
      const user = userEvent.setup();
      const onCheckedItemsChange = vi.fn();
      function FolderNode({ id, name, entries }: { id: string; name: string; entries: string[] }) {
        return (
          <Tree.Item value={id}>
            {name}
            {entries.map((entry) => (
              <Tree.Item key={entry} value={entry}>
                {entry}
              </Tree.Item>
            ))}
          </Tree.Item>
        );
      }
      render(
        <Tree aria-label="Files" selectionMode="multiple" defaultExpandedItems={['docs']} onCheckedItemsChange={onCheckedItemsChange}>
          <FolderNode id="docs" name="Documents" entries={['a.txt', 'b.txt']} />
          <Tree.Item value="readme">Readme.md</Tree.Item>
        </Tree>,
      );
      await user.click(checkbox('Documents'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['docs', 'a.txt', 'b.txt'],
        expect.objectContaining({ value: 'docs', checked: true }),
      );
      expect(item('a.txt')).toHaveAttribute('aria-checked', 'true');
      await user.click(checkbox('a.txt'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(['b.txt'], expect.objectContaining({ value: 'a.txt', checked: false }));
      expect(item('Documents')).toHaveAttribute('aria-checked', 'mixed');
    });

    it('an item a nested component renders lands in the parent label (0.7 warning): the parent check does not reach it, and it toggles its own value', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onCheckedItemsChange = vi.fn();
      function FileNode({ value }: { value: string }) {
        return <Tree.Item value={value}>{value}</Tree.Item>;
      }
      render(
        <Tree aria-label="Files" selectionMode="multiple" onCheckedItemsChange={onCheckedItemsChange}>
          <Tree.Item value="docs">
            Documents
            <FileNode value="a.txt" />
          </Tree.Item>
        </Tree>,
      );
      const [docsBox, fileBox] = screen.getAllByRole('checkbox');
      await user.click(docsBox);
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(['docs'], expect.objectContaining({ value: 'docs' }));
      expect(fileBox).toHaveAttribute('aria-checked', 'false');
      await user.click(fileBox);
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(['docs', 'a.txt'], expect.objectContaining({ value: 'a.txt', checked: true }));
      expect(warnings(warn)).toEqual([ITEM_IN_LABEL_WARNING]);
    });

    it('children added later under a listed parent render checked; a listed placeholder value is kept as unmatched', async () => {
      const user = userEvent.setup();
      const onCheckedItemsChange = vi.fn();
      function Remote({ loaded, checked }: { loaded: boolean; checked: string[] }) {
        return (
          <Tree
            aria-label="Remote files"
            selectionMode="multiple"
            defaultExpandedItems={['remote']}
            checkedItems={checked}
            onCheckedItemsChange={onCheckedItemsChange}
          >
            <Tree.Item value="remote">
              Remote
              {loaded ? (
                <>
                  <Tree.Item value="r1">One</Tree.Item>
                  <Tree.Item value="r2">Two</Tree.Item>
                </>
              ) : (
                <Tree.Item value="remote-loading">Loading…</Tree.Item>
              )}
            </Tree.Item>
          </Tree>
        );
      }
      const { rerender } = render(<Remote loaded={false} checked={['remote']} />);
      expect(item('Loading…')).toHaveAttribute('aria-checked', 'true');
      rerender(<Remote loaded checked={['remote']} />);
      expect(item('One')).toHaveAttribute('aria-checked', 'true');
      expect(item('Two')).toHaveAttribute('aria-checked', 'true');
      await user.click(checkbox('One'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(['r2'], expect.objectContaining({ value: 'r1', checked: false }));

      rerender(<Remote loaded checked={['remote', 'remote-loading']} />);
      await user.click(checkbox('Two'));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['r1', 'remote-loading'],
        expect.objectContaining({ value: 'r2', checked: false }),
      );
    });
  });

  it('types: the mode union, readonly lists, a mutable emitted list and the details (C-NAMING)', () => {
    expectTypeOf<TreeProps['selectionMode']>().toEqualTypeOf<'none' | 'single' | 'multiple' | undefined>();
    expectTypeOf<TreeProps['checkedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TreeProps['defaultCheckedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<NonNullable<TreeProps['onCheckedItemsChange']>>().parameter(0).toEqualTypeOf<string[]>();
    expectTypeOf<NonNullable<TreeProps['onCheckedItemsChange']>>()
      .parameter(1)
      .toEqualTypeOf<TreeCheckedItemsChangeDetails | undefined>();
    expectTypeOf<TreeCheckedItemsChangeDetails>().toEqualTypeOf<{ value: string; checked: boolean; event: Event }>();
    // A one-argument callback and a state setter are accepted.
    expectTypeOf<(items: string[]) => void>().toExtend<NonNullable<TreeProps['onCheckedItemsChange']>>();
    expectTypeOf<React.Dispatch<React.SetStateAction<string[]>>>().toExtend<
      NonNullable<TreeProps['onCheckedItemsChange']>
    >();
    // @ts-expect-error Fluent's 'multiselect' is spelled 'multiple' in WaveUI
    const fluentName = <Tree aria-label="x" selectionMode="multiselect" />;
    expect(fluentName).toBeTruthy();
  });
});
```

Add one case to `src/components/layout/__tests__/Tree.test.tsx`, inside `describe('Tree', …)` after `'renders with role=tree and tree items'`:

```tsx
  it('renders data-selection-mode="none" by default, and no aria-multiselectable (C-CLASS)', () => {
    render(<Tree aria-label="Files">{fileTree}</Tree>);
    const tree = screen.getByRole('tree', { name: 'Files' });
    expect(tree).toHaveAttribute('data-selection-mode', 'none');
    expect(tree).not.toHaveAttribute('aria-multiselectable');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/layout/__tests__/Tree.multiselect.test.tsx src/components/layout/__tests__/Tree.test.tsx -t "selection"`
Expected: FAIL — no element with role `checkbox`, no `aria-multiselectable`/`data-selection-mode`, and the type test errors in `npx tsc -p tsconfig.dev.json --noEmit` (`selectionMode` does not exist on `TreeProps`, `TreeCheckedItemsChangeDetails` is not exported).

- [ ] **Step 3: Extend `Tree.context.ts`**

Add the imports and declarations:

```ts
import type { SelectionMode } from '../../lib/types';
import type { TreeNode } from './Tree.selection';

/** What a top-level item hands to the root for the tree order of a toggle. */
export interface TreeSelectionEntry {
  /** The item's value and the Tree.Item elements among its children, recursively. */
  node: TreeNode;
  /** The treeitem element, which orders the top-level items. */
  element: HTMLElement | null;
}

/**
 * `true` inside the child group of an item that the checked list checks (its own value or an
 * ancestor's is listed): every item there is checked.
 */
export const TreeCheckForcedContext = React.createContext(false);
```

Add to `TreeContextValue` (after `registerValue`):

```ts
  /** The resolved selection mode. */
  selectionMode: 'none' | SelectionMode;
  /** The checked item values (`selectionMode="multiple"`); every item computes its state from them. */
  checked: ReadonlySet<string>;
  /** Toggles an item's check; `event` becomes `details.event` of `onCheckedItemsChange`. */
  toggleChecked: (value: string, event: Event) => void;
  /**
   * Registers a top-level item's selection entry, read when a check toggles to put the items in
   * tree order. Returns the unregistration.
   */
  registerTopLevel: (entry: React.RefObject<TreeSelectionEntry | null>) => () => void;
```

Add to `INERT_CONTEXT`:

```ts
  selectionMode: 'none',
  checked: new Set(),
  toggleChecked: () => {},
  registerTopLevel: () => () => {},
```

- [ ] **Step 4: Add the props, the details type and the helpers to `Tree.core.tsx`**

Imports (replace the icon import and add the others):

```tsx
import { CheckIcon, ChevronRightIcon, SubtractIcon } from '../../lib/icons';
import type { SelectionMode } from '../../lib/types';
import {
  TreeCheckForcedContext,
  TreeContext,
  TreeLabelContext,
  TreeParentContext,
  useTreeContext,
  type TreeContextValue,
  type TreeSelectionEntry,
} from './Tree.context';
import {
  collectItems,
  computeCheckStates,
  toggleCheck,
  type CheckState,
  type TreeNode,
} from './Tree.selection';
```

After `warnDuplicateValue`, add the messages and the forest helper:

```tsx
const SELECTED_WITH_MULTIPLE_MESSAGE =
  'Tree: `selected` has no effect with selectionMode="multiple"; use `checkedItems`, and ' +
  '`current` for the item the user is on.';

const CHECKED_WITHOUT_MULTIPLE_MESSAGE =
  'Tree: `checkedItems` and `defaultCheckedItems` need selectionMode="multiple"; without it the ' +
  'tree draws no checkboxes and ignores them.';

/** The registered top-level subtrees in document order, which is the tree order of their items. */
function forestInTreeOrder(
  entries: ReadonlySet<React.RefObject<TreeSelectionEntry | null>> | null,
): TreeNode[] {
  if (!entries) return [];
  return Array.from(entries, (entry) => entry.current)
    .filter((entry): entry is TreeSelectionEntry => entry !== null)
    .sort((a, b) => {
      if (!a.element || !b.element || a.element === b.element) return 0;
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    })
    .map((entry) => entry.node);
}
```

Before `TreeProps`, add:

```tsx
/** The second argument of `onCheckedItemsChange`. */
export interface TreeCheckedItemsChangeDetails {
  /** The item that was toggled. */
  value: string;
  /** Its new state (a toggle never leaves it mixed). */
  checked: boolean;
  /** The DOM event of the toggle: a keyboard event for Space, a mouse event for a click. */
  event: Event;
}
```

In `TreeProps`, replace the JSDoc of `onItemSelect` and `selected`, and add the four props after `current`:

```tsx
  /**
   * Called with an item's value every time it is activated (a click on its row, Enter, or Space
   * unless the tree has checkboxes), also when the same item is activated again.
   */
  onItemSelect?: (value: string) => void;
  /**
   * Value of the selected item. When set (also to `null`), every item carries `aria-selected`, and
   * the selected item is where keyboard focus enters the tree. It has no effect with
   * `selectionMode="multiple"` (a development warning): items carry `aria-checked` instead.
   */
  selected?: string | null;
  /** Value of the current item (for example the open page): it gets `aria-current="true"`. */
  current?: string | null;
  /**
   * How items are selected. `'none'`: activation only (0.7; `selected` highlights one item).
   * `'single'`: a radio indicator on every item for `selected`/`onItemSelect`. `'multiple'`: a
   * checkbox on every item, bound to `checkedItems`; checking an item checks its descendants, and a
   * parent shows checked, mixed or unchecked from them. Fluent's `'multiselect'` is `'multiple'`.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
  /** Controlled checked items (`selectionMode="multiple"`); see the cascade rule in the component docs. */
  checkedItems?: readonly string[];
  /**
   * Initially checked items (uncontrolled).
   * @default []
   */
  defaultCheckedItems?: readonly string[];
  /**
   * Called with every checked item (in tree order) when a check changes (Fluent's `onCheckedChange`).
   * WaveUI always passes `details`; it is typed optional until 1.0.
   */
  onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void;
```

(The `'single'` sentence of `selectionMode` already describes Task R4's behaviour; Task R4 implements it and adds the matching sentence to `selected`.)

- [ ] **Step 5: Update `TreeRoot`**

Destructure the new props (with the default) after `current`:

```tsx
  selectionMode = 'none',
  checkedItems,
  defaultCheckedItems,
  onCheckedItemsChange,
```

After `activate`, add the checked state, the registration and the toggle:

```tsx
  // Checked items (`selectionMode="multiple"`). useControllable passes the value only, so a toggle
  // hands `details` to the change callback through a ref it writes and clears in the same event.
  const [initialChecked] = React.useState<readonly string[]>(() => defaultCheckedItems ?? EMPTY);
  const pendingDetails = React.useRef<TreeCheckedItemsChangeDetails | undefined>(undefined);
  const [checkedList, setCheckedList] = useControllable<readonly string[]>(
    checkedItems,
    initialChecked,
    (next) => onCheckedItemsChange?.([...next], pendingDetails.current),
  );
  const checked = React.useMemo(() => new Set(checkedList), [checkedList]);

  // The top-level items' subtrees (each item scans its own children), read when a check toggles:
  // they give the emitted list its tree order.
  const topLevel = React.useRef<Set<React.RefObject<TreeSelectionEntry | null>> | null>(null);
  const registerTopLevel = React.useCallback(
    (entry: React.RefObject<TreeSelectionEntry | null>) => {
      topLevel.current ??= new Set();
      const entries = topLevel.current;
      entries.add(entry);
      return () => {
        entries.delete(entry);
      };
    },
    [],
  );
  const toggleChecked = useEventCallback((value: string, event: Event) => {
    const forest = forestInTreeOrder(topLevel.current);
    setCheckedList((previous) => {
      const next = toggleCheck(forest, previous, value);
      pendingDetails.current = { value, checked: next.includes(value), event };
      return next;
    });
    pendingDetails.current = undefined;
  });

  // An item carries aria-checked or aria-selected, never both (APG).
  const effectiveSelected = selectionMode === 'multiple' ? undefined : selected;

  React.useEffect(() => {
    if (selectionMode === 'multiple' && selected !== undefined) {
      warnOnce('Tree:selected-with-multiple', SELECTED_WITH_MULTIPLE_MESSAGE);
    }
  }, [selectionMode, selected]);
  const hasCheckedProps = checkedItems !== undefined || defaultCheckedItems !== undefined;
  React.useEffect(() => {
    if (selectionMode !== 'multiple' && hasCheckedProps) {
      warnOnce('Tree:checked-without-multiple', CHECKED_WITHOUT_MULTIPLE_MESSAGE);
    }
  }, [selectionMode, hasCheckedProps]);
```

Change the roving hook's `activeValue` to `focusedItem ?? effectiveSelected ?? null`. Replace the context memo:

```tsx
  const context = React.useMemo<TreeContextValue>(
    () => ({
      expanded,
      toggle,
      expand,
      activate,
      selected: effectiveSelected,
      current,
      getTabIndex,
      focusValue,
      onItemFocus: setFocusedItem,
      registerValue,
      selectionMode,
      checked,
      toggleChecked,
      registerTopLevel,
    }),
    [
      expanded,
      toggle,
      expand,
      activate,
      effectiveSelected,
      current,
      getTabIndex,
      focusValue,
      registerValue,
      selectionMode,
      checked,
      toggleChecked,
      registerTopLevel,
    ],
  );
```

In the JSX, wrap the `role="tree"` element in `<TreeCheckForcedContext.Provider value={false}>` (inside `TreeParentContext.Provider`, so a nested Tree starts unforced: it is a tree of its own) and add the two attributes before `{...rest}`:

```tsx
          <div
            role="tree"
            data-selection-mode={selectionMode}
            aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
            className={cn(treeClassNames.root, 'text-body-1', className)}
            {...rest}
```

- [ ] **Step 6: Update `isOwnClick` and `TreeItem`**

`isOwnClick` (the checkbox's click toggles; it is no activation):

```tsx
/**
 * Whether a click landed on this treeitem's own row (or on the treeitem element itself). Clicks
 * in its child group, including the indentation gutter beside the nested rows, clicks on nested
 * items and clicks on its checkbox are not its own.
 */
function isOwnClick(event: React.MouseEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  if (target === event.currentTarget) return true;
  if (target?.closest?.('[data-tree-checkbox]')) return false;
  return target?.closest?.('[data-tree-row]')?.parentElement === event.currentTarget;
}
```

In `TreeItem`'s JSDoc, append to the paragraph about nested items: "The checks of a `selectionMode=\"multiple\"` tree cascade by the same rule, so an item that such a component renders is not checked with its parent." and to the paragraph about `onClick`: "In a checkbox tree, a click on the item's checkbox toggles its check and is not passed to `onClick`."

In `TreeItem`, after `const labelId = useId('tree-item-label');`, add the context read and the merged ref, and use `mergedRef` as the treeitem's `ref`:

```tsx
  const ancestorListed = React.useContext(TreeCheckForcedContext);
  const itemRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, itemRef);
```

Replace `const { registerValue } = ctx;` with `const { registerValue, registerTopLevel } = ctx;`. After the nested-items scan, add the item's state and its registration:

```tsx
  // Checkbox tree: the item computes its state from its own subtree (the child-group rule) and
  // the checked list, so every state renders on the server and needs no other item. A top-level
  // item also hands its subtree to the root, which orders a toggle's list by it.
  const multiple = ctx.selectionMode === 'multiple';
  const ownNode = React.useMemo<TreeNode | null>(
    () =>
      multiple
        ? { value, children: leaf ? [] : collectItems(children, { item: TreeItem, tree: TreeRoot }) }
        : null,
    [multiple, value, leaf, children],
  );
  const checkState: CheckState | undefined = ownNode
    ? computeCheckStates([ownNode], ctx.checked, ancestorListed).get(value)
    : undefined;
  const selectionEntry = React.useRef<TreeSelectionEntry | null>(null);
  React.useLayoutEffect(() => {
    selectionEntry.current = ownNode ? { node: ownNode, element: itemRef.current } : null;
  });
  const isTopLevel = parent === null && !insideLabel;
  React.useLayoutEffect(
    () => (multiple && isTopLevel ? registerTopLevel(selectionEntry) : undefined),
    [multiple, isTopLevel, registerTopLevel],
  );
```

Split Enter and Space in `handleKeyDown`'s switch (the other cases unchanged):

```tsx
      case 'Enter':
        event.preventDefault();
        activate();
        return;
      case ' ':
        event.preventDefault();
        // A checkbox tree toggles the focused item's check (APG); the other modes activate.
        if (checkState !== undefined) ctx.toggleChecked(value, event.nativeEvent);
        else activate();
        return;
```

After `handleKeyDown`, add the checkbox handlers and the indicator:

```tsx
  // The checkbox never takes focus (APG: focus stays on tree items): a press on it focuses its
  // item instead, and its click toggles the check without activating the item.
  const keepFocusOnItem = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    itemRef.current?.focus({ preventScroll: true });
  };
  const handleCheckboxClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    ctx.toggleChecked(value, event.nativeEvent);
  };

  const indicator =
    checkState === undefined ? null : (
      <span
        role="checkbox"
        aria-checked={checkState === 'mixed' ? 'mixed' : checkState === 'checked'}
        aria-labelledby={labelId}
        tabIndex={-1}
        data-tree-checkbox=""
        onMouseDown={keepFocusOnItem}
        onClick={handleCheckboxClick}
        className={cn(
          treeItemClassNames.indicator,
          // Checkbox's box: 16px inside a 24px target (the pseudo-element), WCAG 2.5.8.
          'relative inline-flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors motion-reduce:transition-none',
          'before:absolute before:-inset-1',
          checkState === 'unchecked'
            ? cn('border-stroke-accessible bg-transparent', forcedColors.control)
            : 'border-primary bg-primary text-primary-foreground forced-colors:border-[Highlight] forced-colors:bg-[Highlight]',
        )}
      >
        {checkState === 'mixed' ? (
          <SubtractIcon size={12} className={forcedColors.selectedLeaf} />
        ) : checkState === 'checked' ? (
          <CheckIcon size={12} className={forcedColors.selectedLeaf} />
        ) : null}
      </span>
    );

  // Items in this item's group are checked when the list checks this item or an ancestor.
  const groupListed = ancestorListed || (multiple && ctx.checked.has(value));
```

In the JSX: add the boolean attributes before `{...rest}`, `aria-checked` after it, the indicator after the chevron, the provider around the group, and `ref={mergedRef}`:

```tsx
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isCurrent ? true : undefined}
      data-checked={checkState === 'checked' ? '' : undefined}
      data-mixed={checkState === 'mixed' ? '' : undefined}
      className={cn(
        treeItemClassNames.root,
        // The focus ring is drawn on the row: an outline on the treeitem would surround its
        // whole subtree.
        'block outline-none',
        '[&:focus-visible>[data-tree-row]]:outline-2 [&:focus-visible>[data-tree-row]]:-outline-offset-2 [&:focus-visible>[data-tree-row]]:outline-ring',
        className,
      )}
      {...rest}
      // Named by its label only: the treeitem also contains its icon and its child group. A
      // consumer aria-labelledby or aria-label replaces it.
      aria-labelledby={
        rest['aria-labelledby'] ?? (rest['aria-label'] === undefined ? labelId : undefined)
      }
      aria-expanded={hasChildren ? isExpanded : undefined}
      // From the checked list, after the rest props, so a consumer cannot contradict it.
      aria-checked={
        checkState === undefined ? undefined : checkState === 'mixed' ? 'mixed' : checkState === 'checked'
      }
      tabIndex={ctx.getTabIndex(value)}
      data-roving-value={value}
      data-selected={isSelected ? '' : undefined}
      data-current={isCurrent ? '' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={composeEventHandlers(onFocus, handleFocus, { checkDefaultPrevented: false })}
      ref={mergedRef}
    >
      <div
        data-tree-row=""
        className={cn(
          treeItemClassNames.row,
          'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-subtle-hover',
          isSelected && cn('bg-subtle-selected font-semibold', forcedColors.selectedContainer),
        )}
      >
        {hasChildren ? (
          <ChevronRightIcon
            className={cn(
              treeItemClassNames.expandIcon,
              'shrink-0 transition-transform motion-reduce:transition-none',
              isExpanded ? 'rotate-90' : 'wave-rtl:-scale-x-100',
            )}
          />
        ) : (
          <span className="w-3 shrink-0" aria-hidden="true" />
        )}
        {indicator}
        {iconNode}
        <span
          id={labelId}
          data-tree-label=""
          data-roving-text={typeaheadText}
          className={cn(treeItemClassNames.label, 'truncate')}
        >
          <TreeLabelContext.Provider value>{labelContent}</TreeLabelContext.Provider>
        </span>
      </div>
      {hasChildren && isExpanded && (
        <TreeParentContext.Provider value={value}>
          <TreeCheckForcedContext.Provider value={groupListed}>
            <TreeLabelContext.Provider value={false}>
              <div role="group" className={cn(treeItemClassNames.group, 'ps-4')}>
                {nestedItems}
              </div>
            </TreeLabelContext.Provider>
          </TreeCheckForcedContext.Provider>
        </TreeParentContext.Provider>
      )}
    </div>
```

- [ ] **Step 7: Update `Tree.tsx`**

Add `TreeCheckedItemsChangeDetails` to the type re-export:

```tsx
export type { TreeCheckedItemsChangeDetails, TreeItemProps, TreeProps } from './Tree.core';
```

In the compound docblock, replace "Enter/Space activate (and toggle a parent)" with "Enter activates (and toggles a parent), and so does Space unless the tree has checkboxes", and insert after the "Keyboard focus enters …" paragraph:

```
 * `selectionMode="multiple"` draws a checkbox on every item, bound to `checkedItems`: Space
 * toggles the focused item's check, a click on the checkbox toggles it, and a click elsewhere on
 * the row activates the item (as Enter does). Checks cascade: checking an item checks every item
 * nested in it, and an item shows checked when all of its nested items are checked, mixed when
 * some are. `onCheckedItemsChange` receives every checked item in tree order (fully checked parents
 * included), followed by listed values that match no item, and `details` (`value`, `checked`,
 * `event`).
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/components/layout/__tests__/Tree.multiselect.test.tsx src/components/layout/__tests__/Tree.test.tsx src/components/layout/__tests__/Tree.selection.test.ts`
Expected: PASS (the whole 0.7 suite included: `'none'` adds only `data-selection-mode`).

Run: `npx vitest run src/components/layout/__tests__/Tree.multiselect.test.tsx --reporter=default`
Expected: no act() warnings and no unasserted `[WaveUI]` output.

- [ ] **Step 9 (only if the wave A report says VoiceOver does not announce `aria-checked` on a treeitem; spec §6.3, §8 Q18): add `TreeLabels`**

Append to `Tree.multiselect.test.tsx`:

```tsx
describe('Tree - state texts for VoiceOver (labels)', () => {
  it('describes every item of a checkbox tree by its state', () => {
    renderChecks({ defaultExpandedItems: ALL_EXPANDED, defaultCheckedItems: ['report'] });
    expect(item('Report.docx')).toHaveAccessibleDescription('checked');
    expect(item('Work')).toHaveAccessibleDescription('partially checked');
    expect(item('Slides.pptx')).toHaveAccessibleDescription('not checked');
    // The state text is no part of the name.
    expect(item('Report.docx')).toHaveAccessibleName('Report.docx');
  });

  it('takes its texts from labels, and keeps a consumer description first', () => {
    render(
      <>
        <Tree
          aria-label="Dateien"
          selectionMode="multiple"
          defaultCheckedItems={['readme']}
          labels={{ checked: 'ausgewählt', mixed: 'teilweise ausgewählt', unchecked: 'nicht ausgewählt' }}
        >
          <Tree.Item value="readme" aria-describedby="hint">
            Readme.md
          </Tree.Item>
          <Tree.Item value="notes">Notes.md</Tree.Item>
        </Tree>
        <span id="hint">Projektdatei</span>
      </>,
    );
    expect(item('Readme.md')).toHaveAccessibleDescription('Projektdatei ausgewählt');
    expect(item('Notes.md')).toHaveAccessibleDescription('nicht ausgewählt');
  });

  it('renders no state text outside a checkbox tree', () => {
    render(<Tree aria-label="Files">{files}</Tree>);
    expect(item('Readme.md')).not.toHaveAttribute('aria-describedby');
  });
});
```

Implementation. In `Tree.core.tsx`, before `TreeProps`:

```tsx
/** Visually hidden state texts of a checkbox tree's items (`Tree` `labels`). */
export interface TreeLabels {
  /** @default 'checked' */
  checked?: string;
  /** @default 'partially checked' */
  mixed?: string;
  /** @default 'not checked' */
  unchecked?: string;
}
```

`TreeProps` gains:

```tsx
  /**
   * The visually hidden state text that describes each item of a `selectionMode="multiple"` tree,
   * for screen readers that do not announce a tree item's checked state (VoiceOver).
   */
  labels?: TreeLabels;
```

`TreeContextValue` gains `stateLabels: Record<CheckState, string>;` (with `import type { CheckState, TreeNode } from './Tree.selection';` in `Tree.context.ts`, so the context module still imports nothing from `Tree.core.tsx`), and `INERT_CONTEXT` gets `stateLabels: { checked: 'checked', mixed: 'partially checked', unchecked: 'not checked' }`. In `TreeRoot`, destructure `labels` and add `stateLabels` to the context and its dependencies:

```tsx
  const stateLabels = React.useMemo<Record<CheckState, string>>(
    () => ({
      checked: labels?.checked ?? 'checked',
      mixed: labels?.mixed ?? 'partially checked',
      unchecked: labels?.unchecked ?? 'not checked',
    }),
    [labels?.checked, labels?.mixed, labels?.unchecked],
  );
```

In `TreeItem`: `const stateTextId = useId('tree-item-state');`; after `{...rest}`, `aria-describedby={joinIds(rest['aria-describedby'], checkState !== undefined ? stateTextId : undefined)}` (import `joinIds` from `'../../lib/aria'`); inside the row, right after the label span:

```tsx
        {checkState !== undefined && (
          <span id={stateTextId} className="sr-only">
            {ctx.stateLabels[checkState]}
          </span>
        )}
```

`Tree.tsx` re-exports `type TreeLabels`. Tasks R6 and R8 keep `checkState !== undefined ? stateTextId : undefined` as the second argument of their `joinIds(…)` for `aria-describedby` when this step ran. Run the three new tests (they fail before the implementation, pass after), and add `TreeLabels` to the package report's barrel requests.

- [ ] **Step 10: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/__tests__/Tree.multiselect.test.tsx src/components/layout/__tests__/Tree.test.tsx --max-warnings 0`, `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/Tree"`, `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Layout/Tree"`
Expected: no errors; the existing Tree stories still pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/__tests__/Tree.multiselect.test.tsx src/components/layout/__tests__/Tree.test.tsx
git commit -m "feat(layout): Tree multi-select with cascading checks and a mixed state"
```

---
### Task R4: `selectionMode="single"` radios; `'none'` unchanged

**Files:**
- Modify: `src/components/layout/Tree.core.tsx`
- Test: `src/components/layout/__tests__/Tree.multiselect.test.tsx` (append)

**Interfaces:**
- Consumes: Task R3's `selectionMode` prop, `effectiveSelected`, the indicator slot in the row, `treeItemClassNames.indicator`.
- Produces: in `'single'`, `selected` is read as `selected ?? null` (every item carries `aria-selected` from the first render); the warning key `Tree:single-without-selected`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/layout/__tests__/Tree.multiselect.test.tsx`:

```tsx
describe('Tree - selectionMode="single"', () => {
  /** The row's indicator: the decorative radio in single mode. */
  const radioOf = (name: string) =>
    item(name).querySelector<HTMLElement>(`:scope > [data-tree-row] > .${treeItemClassNames.indicator}`);

  it('draws a decorative radio on every item and fills the selected one', () => {
    render(
      <Tree aria-label="Files" selectionMode="single" selected="readme" defaultExpandedItems={ALL_EXPANDED}>
        {files}
      </Tree>,
    );
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('data-selection-mode', 'single');
    expect(tree).not.toHaveAttribute('aria-multiselectable');
    expect(screen.queryByRole('checkbox')).toBeNull();
    for (const name of ['Documents', 'Work', 'Report.docx', 'Readme.md']) {
      expect(radioOf(name)).toHaveAttribute('aria-hidden', 'true');
    }
    expect(radioOf('Readme.md')!.children).toHaveLength(1);
    expect(radioOf('Documents')!.children).toHaveLength(0);
    expect(item('Readme.md')).toHaveAttribute('aria-selected', 'true');
    expect(item('Documents')).toHaveAttribute('aria-selected', 'false');
    expect(item('Readme.md')).not.toHaveAttribute('aria-checked');
  });

  it('with selected={null}, every item carries aria-selected="false" and nothing warns', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <Tree aria-label="Files" selectionMode="single" selected={null}>
        {files}
      </Tree>,
    );
    for (const treeitem of screen.getAllByRole('treeitem')) {
      expect(treeitem).toHaveAttribute('aria-selected', 'false');
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('without selected, warns once and still puts aria-selected="false" on every item', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ui = (
      <Tree aria-label="Files" selectionMode="single">
        {files}
      </Tree>
    );
    const { rerender } = render(ui);
    rerender(ui);
    for (const treeitem of screen.getAllByRole('treeitem')) {
      expect(treeitem).toHaveAttribute('aria-selected', 'false');
    }
    expect(warnings(warn)).toEqual([
      '[WaveUI] Tree: selectionMode="single" draws a radio on every item for `selected`; pass ' +
        '`selected` (null while nothing is selected) and update it from `onItemSelect`.',
    ]);
  });

  it('a click on the radio, Space and Enter activate the item, as in 0.7', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    render(
      <Tree aria-label="Files" selectionMode="single" selected={null} onItemSelect={onItemSelect}>
        {files}
      </Tree>,
    );
    await user.click(radioOf('Readme.md')!);
    act(() => item('Images').focus());
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onItemSelect.mock.calls).toEqual([['readme'], ['images'], ['images']]);
  });

  it('a controlled selection moves the filled radio', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [selected, setSelected] = React.useState<string | null>(null);
      return (
        <Tree aria-label="Files" selectionMode="single" selected={selected} onItemSelect={setSelected}>
          {files}
        </Tree>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByText('Readme.md'));
    expect(item('Readme.md')).toHaveAttribute('aria-selected', 'true');
    expect(radioOf('Readme.md')!.children).toHaveLength(1);
    expect(radioOf('Images')!.children).toHaveLength(0);
  });

  it('has no accessibility violations', async () => {
    render(
      <Tree aria-label="Files" selectionMode="single" selected="work" defaultExpandedItems={ALL_EXPANDED}>
        {files}
      </Tree>,
    );
    await expectNoA11yViolations();
  });
});

describe('Tree - selectionMode="none" (the default)', () => {
  it('adds only data-selection-mode: no indicator, aria-checked, data-checked or aria-selected', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        {files}
      </Tree>,
    );
    expect(screen.getByRole('tree')).toHaveAttribute('data-selection-mode', 'none');
    expect(document.querySelector(`.${treeItemClassNames.indicator}`)).toBeNull();
    for (const treeitem of screen.getAllByRole('treeitem')) {
      expect(treeitem).not.toHaveAttribute('aria-checked');
      expect(treeitem).not.toHaveAttribute('data-checked');
      expect(treeitem).not.toHaveAttribute('data-mixed');
      expect(treeitem).not.toHaveAttribute('aria-selected');
    }
    // The spacer and the label: nothing is added to a 0.7 row.
    expect(item('Readme.md').querySelector('[data-tree-row]')!.children).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/layout/__tests__/Tree.multiselect.test.tsx -t "single"`
Expected: FAIL — no indicator element in single mode (`radioOf(...)` is `null`), no `aria-selected` without `selected`, no warning.

- [ ] **Step 3: Implement**

In `Tree.core.tsx`, add the message after `CHECKED_WITHOUT_MULTIPLE_MESSAGE`:

```tsx
const SINGLE_WITHOUT_SELECTED_MESSAGE =
  'Tree: selectionMode="single" draws a radio on every item for `selected`; pass `selected` ' +
  '(null while nothing is selected) and update it from `onItemSelect`.';
```

In `TreeRoot`, replace `effectiveSelected` and add the warning effect after the other two:

```tsx
  // An item carries aria-checked or aria-selected, never both (APG); in single mode every item
  // carries aria-selected from the first render, so the radios and the state agree.
  const effectiveSelected =
    selectionMode === 'multiple'
      ? undefined
      : selectionMode === 'single'
        ? (selected ?? null)
        : selected;
```

```tsx
  React.useEffect(() => {
    if (selectionMode === 'single' && selected === undefined) {
      warnOnce('Tree:single-without-selected', SINGLE_WITHOUT_SELECTED_MESSAGE);
    }
  }, [selectionMode, selected]);
```

Append to the JSDoc of `TreeProps.selected`: "With `selectionMode=\"single\"` every item carries `aria-selected` even while it is not set (a development warning: the radios need it)."

In `TreeItem`, rename Task R3's `const indicator = checkState === undefined ? null : (<span role="checkbox" …>…</span>);` to `const checkbox = …` (its expression unchanged), and add the radio and the choice right after it:

```tsx
  // Single mode: a decorative radio (the treeitem's aria-selected carries the state). A click on
  // it is a click on the row, so it activates the item.
  const radio =
    ctx.selectionMode === 'single' ? (
      <span
        aria-hidden="true"
        className={cn(
          treeItemClassNames.indicator,
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none',
          isSelected
            ? 'border-2 border-primary forced-colors:border-[Highlight]'
            : cn('border-stroke-accessible', forcedColors.control),
        )}
      >
        {isSelected && (
          <span className={cn('block size-2 rounded-full bg-primary', forcedColors.selectedLeaf)} />
        )}
      </span>
    ) : null;
  // A tree item shows its checkbox in multiple mode, its radio in single mode, and nothing else.
  const indicator = checkbox ?? radio;
```

(The row keeps rendering `{indicator}` after the chevron.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/layout/__tests__/Tree.multiselect.test.tsx src/components/layout/__tests__/Tree.test.tsx`
Expected: PASS.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/components/layout/Tree.core.tsx src/components/layout/__tests__/Tree.multiselect.test.tsx --max-warnings 0`, `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/Tree.core.tsx"`, `npx vitest run src/components/layout/__tests__/Tree.multiselect.test.tsx --reporter=default`
Expected: no errors; clean output.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Tree.core.tsx src/components/layout/__tests__/Tree.multiselect.test.tsx
git commit -m "feat(layout): Tree single-select radio indicators"
```

---

### Task R5: `useRovingTabIndex` — `tabStop: 'none'`

**Files:**
- Modify: `src/hooks/useRovingTabIndex.ts` (the option's type and JSDoc, `StoreOptions`, `RovingStore.stamp`, the render-time tab stop, the hook's JSDoc)
- Test: `src/hooks/__tests__/useRovingTabIndex.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `UseRovingTabIndexOptions['tabStop']` is `'active' | 'last-focused' | 'none' | undefined`; with `'none'`, `getTabIndex(value)` returns `-1` for every value, `manageTabIndex` stamps `-1` on every item, and the arrow keys, Home/End, typeahead, `focusValue`, `focusFirst` and `focusLast` keep working. Task R6's row toolbar passes `'none'` or `'last-focused'`.

The spec (D27, P3-07) sketches `tabStop?: boolean`, but 0.7 already has `tabStop?: 'active' | 'last-focused'` (which item holds the tab stop), so a boolean of the same name would break every existing call. `'none'` says the same thing inside the existing option: no item holds it.

- [ ] **Step 1: Write the failing tests**

In `src/hooks/__tests__/useRovingTabIndex.test.tsx`, widen the `Managed` harness's prop type:

```tsx
  tabStop?: UseRovingTabIndexOptions['tabStop'];
```

Add a `describe` block inside `describe('useRovingTabIndex', …)`, after `describe('manageTabIndex (button-provider#12)', …)`:

```tsx
  describe("tabStop 'none' (a composite reached by the arrow keys or a script only)", () => {
    it('stamps tabIndex=-1 on every managed item; Tab passes the group, and the arrow keys still move', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">before</button>
          <Managed tabStop="none">
            <button type="button">Bold</button>
            <button type="button">Italic</button>
          </Managed>
          <button type="button">after</button>
        </>,
      );
      expect(button('Bold')).toHaveAttribute('tabindex', '-1');
      expect(button('Italic')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(button('before')).toHaveFocus();
      await user.tab();
      expect(button('after')).toHaveFocus();

      focus(button('Bold'));
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      expect(button('Italic')).toHaveAttribute('tabindex', '-1');
      expect(button('Bold')).toHaveAttribute('tabindex', '-1');
    });

    it('getTabIndex returns -1 for every item, the active one included', () => {
      let latest: UseRovingTabIndexResult | undefined;
      render(<DomGroup items={ABC} activeValue="b" tabStop="none" onResult={(result) => (latest = result)} />);
      expect(['a', 'b', 'c'].map((value) => latest!.getTabIndex(value))).toEqual([-1, -1, -1]);
      expect(button('b')).toHaveAttribute('tabindex', '-1');
    });

    it('focusFirst still focuses the first enabled item', () => {
      let latest: UseRovingTabIndexResult | undefined;
      render(
        <Managed tabStop="none" onResult={(result) => (latest = result)}>
          <button type="button" disabled>
            Cut
          </button>
          <button type="button">Copy</button>
        </Managed>,
      );
      act(() => latest!.focusFirst());
      expect(button('Copy')).toHaveFocus();
    });

    it("switching to 'last-focused' gives the last focused item the tab stop, and back to 'none' removes it", async () => {
      const user = userEvent.setup();
      function Switchable({ tabStop }: { tabStop: UseRovingTabIndexOptions['tabStop'] }) {
        return (
          <Managed tabStop={tabStop}>
            <button type="button">Bold</button>
            <button type="button">Italic</button>
          </Managed>
        );
      }
      const { rerender } = render(<Switchable tabStop="none" />);
      focus(button('Bold'));
      await user.keyboard('{ArrowRight}');
      rerender(<Switchable tabStop="last-focused" />);
      expect(button('Italic')).toHaveAttribute('tabindex', '0');
      expect(button('Bold')).toHaveAttribute('tabindex', '-1');
      rerender(<Switchable tabStop="none" />);
      expect(button('Italic')).toHaveAttribute('tabindex', '-1');
    });
  });
```

Change the type assertion in `'has exported option and result types'`:

```tsx
      expectTypeOf<UseRovingTabIndexOptions['tabStop']>().toEqualTypeOf<
        'active' | 'last-focused' | 'none' | undefined
      >();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/__tests__/useRovingTabIndex.test.tsx -t "none"`
Expected: FAIL — `Bold` has `tabindex="0"` (the unknown value falls back to the `'active'` rule) and `getTabIndex('a')` is `0`. `npx tsc -p tsconfig.dev.json --noEmit` also fails on `tabStop="none"`.

- [ ] **Step 3: Implement**

In `src/hooks/useRovingTabIndex.ts`, replace the option's declaration and JSDoc in `UseRovingTabIndexOptions`:

```ts
  /** Which item holds the tab stop. 'active' (default): the enabled activeValue item, else the first
   *  enabled item — APG Tabs/Radio/Listbox/Tree. 'last-focused': the last focused enabled item, else
   *  'active' — APG Toolbar (and the static Menu). Either way a nested composite or a control that
   *  uses the arrow keys itself (text field, select, slider, spin button, editable combobox) holds
   *  it only when no other item can: arrows pressed there never lead back to the other items, so
   *  focusing one keeps the tab stop on the last focused other item. 'none': no item holds it
   *  (every item gets tabIndex -1), for a composite reached only by the arrow keys of an enclosing
   *  widget or by a script (a tree row's actions); the keys, `focusValue`, `focusFirst` and
   *  `focusLast` keep working. */
  tabStop?: 'active' | 'last-focused' | 'none';
```

In `StoreOptions`: `tabStop: 'active' | 'last-focused' | 'none';`.

In `RovingStore.stamp()`, replace the `stop` computation:

```ts
    const stop =
      this.options.tabStop === 'none'
        ? null
        : resolveTabStop(
            resolved.map(toEntry),
            this.options.activeValue,
            this.options.tabStop,
            this.lastFocused,
          );
```

In the hook body, replace `tabStopValue`:

```ts
  const tabStopValue =
    tabStop === 'none'
      ? null
      : stopEntries
        ? resolveTabStop(stopEntries, activeValue, tabStop, focusedStop)
        : activeValue || null;
```

In the hook's JSDoc bullet **Tab stop** (`tabStop`), append: "; `'none'` — no item: every item is `tabIndex=-1`, and focus reaches the items only through the keys or a script."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/useRovingTabIndex.test.tsx`
Expected: PASS (the 0.7 cases unchanged: the default is still `'active'`).

- [ ] **Step 5: Quick checks, and the hook's consumers**

Run: `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/hooks/useRovingTabIndex.ts src/hooks/__tests__/useRovingTabIndex.test.tsx --max-warnings 0`
Run: `npx vitest run src/components/button/__tests__/Toolbar.test.tsx src/components/layout/__tests__/Tree.test.tsx src/components/navigation/__tests__/Menu.test.tsx src/components/input/__tests__/RadioGroup.test.tsx src/components/layout/__tests__/TabList.test.tsx`
Expected: no errors; the consumers pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useRovingTabIndex.ts src/hooks/__tests__/useRovingTabIndex.test.tsx
git commit -m "feat(hooks): useRovingTabIndex tabStop 'none' for composites without a tab stop"
```

---
### Task R6: Row content — `iconAfter`, `expandIcon`, `aside`, `actions`; isolation; Tab into the actions

**Files:**
- Modify: `src/components/layout/Tree.context.ts` (`focusedItem`)
- Modify: `src/components/layout/Tree.core.tsx`
- Modify: `src/components/layout/Tree.tsx` (docblock paragraph)
- Test: `src/components/layout/__tests__/Tree.actions.test.tsx` (create)

**Interfaces:**
- Consumes: Task R5's `tabStop: 'none'`; `treeItemClassNames.iconAfter`, `.aside`, `.actions`, `.expandIcon` (Appendix A; the first three are on `PENDING_CLASS_NAMES`); `isOwnEvent` from `src/lib/events.ts`; `slotRendersContent`, `materialiseSlotContent`, `renderSlot` from `src/lib/slot.ts`; `joinIds` from `src/lib/aria.ts`.
- Produces:
  - `TreeItemProps` gains `actions?: React.ReactNode`, `aside?: React.ReactNode`, `iconAfter?: Slot<'span'>`, `expandIcon?: Slot<'span'>`.
  - `TreeContextValue` gains `focusedItem: string | null` (the item that focus is on or inside; `null` while focus is outside the tree).
  - Internal: `TreeItemActions` (props `labelledBy`, `tabStop`, `children`; Task R7 adds `navigationMode` and `onReturn`), `TREE_ITEM_SELECTOR`, `ACTION_ITEM_SELECTOR`, DOM markers `data-tree-actions`, `data-tree-aside`, `data-tree-end`.

The class strings below compile with Tailwind 4.3 as intended (checked with the CLI while this plan was written): `group-hover/row:` sits under `@media (hover: hover)`, `not-forced-colors:` under `@media not (forced-colors: active)`, and the item-level selector `[&:focus>[data-tree-row]_[data-tree-actions]]:visible` becomes `…:focus > [data-tree-row] [data-tree-actions]`, which never reaches a nested item's row (the child combinator stops at the item's own row). `visible` is on the CSS entry's `@source not inline()` list, which excludes only the bare word; the variant forms used here are separate candidates and are generated.

- [ ] **Step 1: Write the failing tests**

Create `src/components/layout/__tests__/Tree.actions.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, type TreeProps } from '../Tree';
import { Menu } from '../../navigation/Menu';
import { MenuButton } from '../../button/MenuButton';
import { treeItemClassNames } from '../../../lib/classNames';
import type { Slot } from '../../../lib/types';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

const item = (name: string) => screen.getByRole('treeitem', { name });
const button = (name: string) => screen.getByRole('button', { name });
const toolbar = (name: string) => screen.getByRole('toolbar', { name });
const rowOf = (name: string) => item(name).querySelector<HTMLElement>(':scope > [data-tree-row]')!;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Documents (expanded) › Work, and Readme.md; every row has actions. */
function Rows({ onRename, ...props }: Partial<TreeProps> & { onRename?: () => void }) {
  return (
    <>
      <button type="button">Before</button>
      <Tree aria-label="Files" defaultExpandedItems={['docs']} {...props}>
        <Tree.Item
          value="docs"
          actions={
            <>
              <button type="button" onClick={onRename}>
                Rename Documents
              </button>
              <button type="button">Delete Documents</button>
            </>
          }
        >
          Documents
          <Tree.Item value="work" actions={<button type="button">Rename Work</button>}>
            Work
          </Tree.Item>
        </Tree.Item>
        <Tree.Item value="readme" actions={<button type="button">Rename Readme</button>}>
          Readme.md
        </Tree.Item>
      </Tree>
      <button type="button">After</button>
    </>
  );
}

describe('Tree.Item - row content', () => {
  it('lays the row out as chevron, icon, label, iconAfter, then the aside and the actions at the end', () => {
    render(
      <Tree aria-label="Files">
        <Tree.Item
          value="docs"
          icon="📁"
          iconAfter={<svg data-testid="after" />}
          aside="3 files"
          actions={<button type="button">Rename Documents</button>}
        >
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    const [chevron, icon, label, after, end] = Array.from(rowOf('Documents').children);
    expect(chevron).toHaveClass(treeItemClassNames.expandIcon);
    expect(icon).toHaveClass(treeItemClassNames.icon);
    expect(label).toHaveClass(treeItemClassNames.label, 'min-w-0');
    expect(after).toHaveClass(treeItemClassNames.iconAfter);
    expect(after).toHaveAttribute('aria-hidden', 'true');
    expect(within(after as HTMLElement).getByTestId('after')).toBeInTheDocument();
    expect(end).toHaveAttribute('data-tree-end', '');
    const [aside, actions] = Array.from(end.children);
    expect(aside).toHaveClass(treeItemClassNames.aside);
    expect(aside).toHaveTextContent('3 files');
    expect(actions).toBe(toolbar('Documents'));
    expect(actions).toHaveClass(treeItemClassNames.actions);
    expect(item('Documents')).toHaveAccessibleName('Documents');
  });

  it.each<[string, Slot<'span'>]>([
    ["''", ''],
    ['0', 0],
    ['false', false],
    ['null', null],
    ['an empty array', []],
    ['an array of empty items', [null, '']],
  ])('renders no iconAfter span for %s, as for icon', (_name, iconAfter) => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="plain">Plain</Tree.Item>
        <Tree.Item value="empty" iconAfter={iconAfter}>
          Empty
        </Tree.Item>
      </Tree>,
    );
    expect(rowOf('Empty').children).toHaveLength(rowOf('Plain').children.length);
    expect(rowOf('Empty').querySelector(`.${treeItemClassNames.iconAfter}`)).toBeNull();
  });

  describe('expandIcon (optional indicator)', () => {
    const parent = (expandIcon: Slot<'span'> | undefined, expanded = false) =>
      render(
        <Tree aria-label="Files" defaultExpandedItems={expanded ? ['docs'] : []}>
          <Tree.Item value="docs" expandIcon={expandIcon}>
            Documents
            <Tree.Item value="work">Work</Tree.Item>
          </Tree.Item>
        </Tree>,
      );

    it.each<[string, Slot<'span'> | undefined]>([
      ['undefined', undefined],
      ['null', null],
    ])('%s keeps the default chevron', (_name, expandIcon) => {
      parent(expandIcon);
      const chevron = rowOf('Documents').children[0];
      expect(chevron.tagName.toLowerCase()).toBe('svg');
      expect(chevron).toHaveClass(treeItemClassNames.expandIcon, 'wave-rtl:-scale-x-100');
    });

    it('a custom glyph replaces it, decorative and not rotated', () => {
      parent(<span data-testid="glyph">+</span>, true);
      const glyph = rowOf('Documents').children[0];
      expect(glyph.tagName.toLowerCase()).toBe('span');
      expect(glyph).toHaveClass(treeItemClassNames.expandIcon);
      expect(glyph).toHaveAttribute('aria-hidden', 'true');
      expect(glyph).not.toHaveClass('rotate-90');
      expect(within(glyph as HTMLElement).getByTestId('glyph')).toBeInTheDocument();
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    });

    it.each<[string, Slot<'span'>]>([
      ['false', false],
      ["''", ''],
      ['an empty array', []],
    ])('%s hides it; the column stays and aria-expanded still reports the state', (_name, expandIcon) => {
      parent(expandIcon);
      expect(rowOf('Documents').querySelector(`.${treeItemClassNames.expandIcon}`)).toBeNull();
      expect(rowOf('Documents').children[0]).toHaveAttribute('aria-hidden', 'true');
      expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    });

    it('a leaf ignores it', () => {
      render(
        <Tree aria-label="Files">
          <Tree.Item value="readme" expandIcon={<span>+</span>}>
            Readme.md
          </Tree.Item>
        </Tree>,
      );
      expect(rowOf('Readme.md').querySelector(`.${treeItemClassNames.expandIcon}`)).toBeNull();
    });
  });

  describe('aside', () => {
    it('describes the item, after a consumer description', () => {
      render(
        <>
          <Tree aria-label="Files">
            <Tree.Item value="docs" aside="3 files" aria-describedby="hint">
              Documents
            </Tree.Item>
          </Tree>
          <span id="hint">Shared</span>
        </>,
      );
      expect(item('Documents')).toHaveAccessibleDescription('Shared 3 files');
      expect(item('Documents')).toHaveAccessibleName('Documents');
    });

    it('gives way to the actions only where they share its place', () => {
      render(
        <Tree aria-label="Files">
          <Tree.Item value="docs" aside="3 files" actions={<button type="button">Rename Documents</button>}>
            Documents
          </Tree.Item>
          <Tree.Item value="readme" aside="New">
            Readme.md
          </Tree.Item>
        </Tree>,
      );
      const shared = rowOf('Documents').querySelector(`.${treeItemClassNames.aside}`)!;
      expect(shared).toHaveClass(
        'not-forced-colors:group-hover/row:invisible',
        '[@media(hover:hover)]:not-forced-colors:group-focus-within/end:invisible',
      );
      expect(item('Documents')).toHaveClass(
        '[@media(hover:hover)]:not-forced-colors:[&:focus>[data-tree-row]_[data-tree-aside]]:invisible',
      );
      expect(rowOf('Documents').querySelector('[data-tree-end]')).toHaveClass(
        'group/end',
        '[&>*]:[grid-area:1/1]',
        'forced-colors:flex',
        '[@media(hover:none)]:flex',
      );
      const alone = rowOf('Readme.md').querySelector(`.${treeItemClassNames.aside}`)!;
      expect(alone.className).not.toMatch(/invisible/);
      expect(item('Readme.md').className).not.toMatch(/data-tree-aside/);
      expect(item('Readme.md')).toHaveAccessibleDescription('New');
    });

    it('a click on the aside activates the item, as a click on its label does', async () => {
      const user = userEvent.setup();
      const onItemSelect = vi.fn();
      render(
        <Tree aria-label="Files" onItemSelect={onItemSelect}>
          <Tree.Item value="docs" aside="3 files">
            Documents
          </Tree.Item>
        </Tree>,
      );
      await user.click(screen.getByText('3 files'));
      expect(onItemSelect.mock.calls).toEqual([['docs']]);
    });
  });
});

describe('Tree.Item - actions', () => {
  it('renders a toolbar named by the item, invisible until the row is hovered or the item or an action has focus', () => {
    render(<Rows />);
    const actions = toolbar('Documents');
    expect(actions).toHaveAttribute('aria-orientation', 'horizontal');
    expect(actions).toHaveAttribute('data-tree-actions', '');
    expect(actions).toHaveClass(
      treeItemClassNames.actions,
      'invisible',
      'group-hover/row:visible',
      'focus-within:visible',
      'forced-colors:visible',
      '[@media(hover:none)]:visible',
    );
    expect(rowOf('Documents')).toHaveClass('group/row');
    expect(item('Documents')).toHaveClass('[&:focus>[data-tree-row]_[data-tree-actions]]:visible');
  });

  it.each<[string, React.ReactNode]>([
    ['[]', []],
    ['false', false],
    ['<></>', <></>],
    ["[null, '']", [null, '']],
  ])('renders no toolbar, end cell or visibility classes for actions=%s', (_name, actions) => {
    render(
      <Tree aria-label="Files">
        <Tree.Item value="a" actions={actions}>
          Alpha
        </Tree.Item>
        <Tree.Item value="b">Beta</Tree.Item>
      </Tree>,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(rowOf('Alpha').querySelector('[data-tree-end]')).toBeNull();
    expect(rowOf('Alpha').children).toHaveLength(rowOf('Beta').children.length);
    expect(item('Alpha').className).toBe(item('Beta').className);
    expect(rowOf('Alpha')).not.toHaveClass('group/row');
  });

  it("tree mode: Tab from the focused item enters its actions (one stop), the arrows move inside with wrapping, Shift+Tab returns, Tab leaves", async () => {
    const user = userEvent.setup();
    render(<Rows />);
    for (const name of ['Rename Documents', 'Delete Documents', 'Rename Work', 'Rename Readme']) {
      expect(button(name)).toHaveAttribute('tabindex', '-1');
    }
    act(() => item('Documents').focus());
    expect(button('Rename Documents')).toHaveAttribute('tabindex', '0');
    expect(button('Delete Documents')).toHaveAttribute('tabindex', '-1');
    expect(button('Rename Work')).toHaveAttribute('tabindex', '-1');
    expect(button('Rename Readme')).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.tab({ shift: true });
    expect(item('Documents')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(button('After')).toHaveFocus();
    // Focus left the tree: no toolbar keeps a Tab stop.
    expect(button('Rename Documents')).toHaveAttribute('tabindex', '-1');
  });

  it('the arrow keys move between items, never into a row actions', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Readme.md')).toHaveFocus();
  });

  it('ArrowDown and ArrowUp on an action move to the next and previous item', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    act(() => item('Documents').focus());
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
    act(() => item('Readme.md').focus());
    await user.tab();
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('Work')).toHaveFocus();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s on an action runs only the action: no activation, expansion or check toggle', async (_name, key) => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onItemSelect = vi.fn();
    const onCheckedItemsChange = vi.fn();
    render(
      <Rows
        onRename={onRename}
        onItemSelect={onItemSelect}
        selectionMode="multiple"
        onCheckedItemsChange={onCheckedItemsChange}
      />,
    );
    act(() => item('Documents').focus());
    await user.tab();
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard(key);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(onCheckedItemsChange).not.toHaveBeenCalled();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('a click on an action runs only the action', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onItemSelect = vi.fn();
    render(<Rows onRename={onRename} onItemSelect={onItemSelect} />);
    await user.click(button('Rename Documents'));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('* and a letter pressed on an action do nothing to the tree; * on the item still expands its siblings', async () => {
    const user = userEvent.setup();
    render(<Rows defaultExpandedItems={[]} />);
    act(() => item('Readme.md').focus());
    await user.tab();
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard('*');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('d');
    expect(button('Rename Readme')).toHaveFocus();
    act(() => item('Readme.md').focus());
    await user.keyboard('*');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
  });

  it('ArrowDown on a MenuButton action opens its menu instead of moving to the next item', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files">
        <Tree.Item
          value="readme"
          actions={
            <Menu>
              <Menu.Trigger>
                <MenuButton>More for Readme</MenuButton>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Delete</Menu.Item>
              </Menu.Popover>
            </Menu>
          }
        >
          Readme.md
        </Tree.Item>
        <Tree.Item value="notes">Notes.md</Tree.Item>
      </Tree>,
    );
    act(() => item('Readme.md').focus());
    await user.tab();
    expect(button('More for Readme')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(button('More for Readme')).toHaveFocus();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('RTL: the arrows inside the actions are mirrored', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Rows />, { dir: 'rtl' });
    act(() => item('Documents').focus());
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(button('Delete Documents')).toHaveFocus();
  });

  it('StrictMode: one Tab stop per toolbar, on the focused item only', () => {
    render(
      <React.StrictMode>
        <Rows />
      </React.StrictMode>,
    );
    act(() => item('Documents').focus());
    const stops = screen.getAllByRole('button').filter((el) => el.closest('[data-tree-actions]') && el.tabIndex === 0);
    expect(stops).toEqual([button('Rename Documents')]);
  });

  it('has no accessibility violations with actions and an aside', async () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Tree.Item value="docs" aside="2 files" actions={<button type="button">Rename Documents</button>}>
          Documents
          <Tree.Item value="work" actions={<button type="button">Rename Work</button>}>
            Work
          </Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await expectNoA11yViolations();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/layout/__tests__/Tree.actions.test.tsx`
Expected: FAIL — no `toolbar` role, no `iconAfter`/aside elements (the props are passed through `...rest` to the treeitem, and React warns about the unknown `aside` and `actions` attributes), `npx tsc -p tsconfig.dev.json --noEmit` reports the unknown props.

- [ ] **Step 3: Extend the context**

In `Tree.context.ts`, `TreeContextValue` gains:

```ts
  /** The item that focus is on or inside (its actions); `null` while focus is outside the tree. */
  focusedItem: string | null;
```

and `INERT_CONTEXT` gains `focusedItem: null,`.

- [ ] **Step 4: Add the props, selectors, class strings and `TreeItemActions` to `Tree.core.tsx`**

Imports: add `import { joinIds } from '../../lib/aria';`, `import { isOwnEvent } from '../../lib/events';`, and `materialiseSlotContent` to the slot import (`import { materialiseSlotContent, renderSlot, slotRendersContent, type Slot } from '../../lib/slot';`).

`TreeItemProps` gains, after `icon`:

```tsx
  /** Icon after the label (decorative, `aria-hidden`; a falsy value renders nothing, as `icon`). */
  iconAfter?: Slot<'span'>;
  /**
   * Replaces the expand chevron (decorative). `null`/`undefined` keep the chevron; `false`, or
   * anything that renders nothing, hides it (`aria-expanded` still reports the state). Not rotated.
   */
  expandIcon?: Slot<'span'>;
  /**
   * Non-interactive content at the end of the row, such as a count or a badge. It describes the item
   * (`aria-describedby`); it hides while the actions show on hover or focus.
   */
  aside?: React.ReactNode;
  /**
   * Buttons at the end of the row (a toolbar named by the item's label). Shown while the row is
   * hovered or the item or its actions have focus, and always in forced colors and without hover
   * (touch). Tab reaches them from the focused item (`navigationMode="tree"`), or the arrow keys do
   * (`"treegrid"`). Keys and clicks on them never activate or check the item.
   */
  actions?: React.ReactNode;
```

(`navigationMode` arrives in Task R7; its JSDoc mention here already describes that task's behaviour.)

After `forestInTreeOrder`, add:

```tsx
/**
 * The tree's own items for the tab stop and the arrow keys: the treeitems. A row's actions are a
 * roving container of their own, which the default selector would count as one more item.
 */
const TREE_ITEM_SELECTOR = '[role="treeitem"]';

/** Every focusable control a row's actions can hold (Toolbar's rule). */
const ACTION_ITEM_SELECTOR = 'button, [href], input, select, textarea, [role="button"], [tabindex]';

/** Shows a row's actions while its item has focus (`:focus`, also after a click, so Tab reaches them). */
const ACTIONS_ON_ITEM_FOCUS = '[&:focus>[data-tree-row]_[data-tree-actions]]:visible';

/** Makes the aside invisible while its item has focus, where the actions take its place. */
const ASIDE_OFF_ON_ITEM_FOCUS =
  '[@media(hover:hover)]:not-forced-colors:[&:focus>[data-tree-row]_[data-tree-aside]]:invisible';

/**
 * The actions stay invisible until the row is hovered or the item or an action has focus, and
 * always show in forced colors and without hover (touch). An invisible action takes no focus.
 */
const ACTIONS_VISIBILITY =
  'invisible group-hover/row:visible focus-within:visible forced-colors:visible [@media(hover:none)]:visible';

/** The aside gives way to the actions where the two share one place. */
const ASIDE_OFF_WITH_ACTIONS =
  'not-forced-colors:group-hover/row:invisible [@media(hover:hover)]:not-forced-colors:group-focus-within/end:invisible';

/** Aside and actions share one cell, and sit side by side where the actions always show. */
const END_CELL_SHARED = '[&>*]:[grid-area:1/1] forced-colors:flex [@media(hover:none)]:flex';
```

Replace `isOwnKeyEvent` and `isOwnClick`:

```tsx
/**
 * Whether a keyboard event belongs to this treeitem: its target (the focused element) is this
 * treeitem or inside its row, not a nested item and not the row's actions (their keys are theirs).
 */
function isOwnKeyEvent(event: React.KeyboardEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  if (target?.closest?.('[data-tree-actions]')) return false;
  return target?.closest?.('[role="treeitem"]') === event.currentTarget;
}

/**
 * Whether a click landed on this treeitem's own row (or on the treeitem element itself). Clicks
 * in its child group, including the indentation gutter beside the nested rows, clicks on nested
 * items, on its checkbox and on its actions are not its own.
 */
function isOwnClick(event: React.MouseEvent<HTMLElement>): boolean {
  const target = event.target as Element | null;
  if (target === event.currentTarget) return true;
  if (target?.closest?.('[data-tree-checkbox], [data-tree-actions]')) return false;
  return target?.closest?.('[data-tree-row]')?.parentElement === event.currentTarget;
}
```

Before `TreeItem`, add the toolbar component:

```tsx
interface TreeItemActionsProps {
  /** Id of the element that names the item. */
  labelledBy: string;
  /** `'last-focused'` while the actions hold a Tab stop (their item has focus), else `'none'`. */
  tabStop: 'last-focused' | 'none';
  children: React.ReactNode;
}

/**
 * A row's actions: the consumer's controls rove with the arrow keys and hold at most one Tab
 * stop. A key pressed on an action is the action's: ArrowDown and ArrowUp on an action that opens
 * a popup (`aria-haspopup`) never move focus to another item.
 */
const TreeItemActions = ({ labelledBy, tabStop, children }: TreeItemActionsProps) => {
  const { containerProps } = useRovingTabIndex({
    itemSelector: ACTION_ITEM_SELECTOR,
    manageTabIndex: true,
    orientation: 'horizontal',
    tabStop,
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    // A key from a popup an action opened reaches here through the React tree: not ours.
    if (event.defaultPrevented || !isOwnEvent(event)) return;
    const popup = (event.target as Element).getAttribute('aria-haspopup');
    if (
      (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
      popup !== null &&
      popup !== 'false'
    ) {
      event.preventDefault();
    }
  };

  return (
    <span
      role="toolbar"
      aria-labelledby={labelledBy}
      aria-orientation="horizontal"
      data-tree-actions=""
      data-roving-container=""
      ref={containerProps.ref}
      onKeyDown={composeEventHandlers(handleKeyDown, containerProps.onKeyDown)}
      onFocus={containerProps.onFocus}
      className={cn(treeItemClassNames.actions, 'inline-flex items-center gap-1', ACTIONS_VISIBILITY)}
    >
      {children}
    </span>
  );
};
TreeItemActions.displayName = 'TreeItemActions';
```

In `TreeRoot`, pass `itemSelector: TREE_ITEM_SELECTOR` to `useRovingTabIndex` and add `focusedItem` to the context value and its dependency list.

- [ ] **Step 5: Rewrite `TreeItem` with the row content**

`TreeItem` after this task, in full (the parts of Tasks R3 and R4 included; the checkbox is the element Task R4 named `checkbox`):

```tsx
export const TreeItem = ({
  value,
  icon,
  iconAfter,
  expandIcon,
  aside,
  actions,
  leaf = false,
  className,
  children,
  onClick,
  onKeyDown,
  onFocus,
  ref,
  ...props
}: TreeItemProps) => {
  const { 'data-roving-text': typeaheadText, ...rest } = props as typeof props & {
    'data-roving-text'?: string;
  };
  const ctx = useTreeContext('Tree.Item');
  const parent = React.useContext(TreeParentContext);
  const insideLabel = React.useContext(TreeLabelContext);
  const ancestorListed = React.useContext(TreeCheckForcedContext);
  const isExpanded = ctx.expanded.has(value);
  const labelId = useId('tree-item-label');
  const asideId = useId('tree-item-aside');
  const itemRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, itemRef);

  const { registerValue, registerTopLevel } = ctx;
  React.useEffect(() => registerValue(value), [registerValue, value]);
  React.useEffect(() => {
    if (insideLabel) warnOnce('Tree.Item:inside-label', ITEM_IN_LABEL_MESSAGE);
  }, [insideLabel]);

  // Nested Tree.Items (and, as in 0.4, nested Trees) form the child group; the rest is the label.
  // Parts are identified through their element type, so parts written in a Server Component
  // (lazy references) count too.
  const nestedItems: React.ReactNode[] = [];
  const labelContent: React.ReactNode[] = [];
  let firstChildValue: string | undefined;
  flattenChildren(children).forEach(({ key, node: child }) => {
    const keyed = <React.Fragment key={key}>{child}</React.Fragment>;
    if (isElementOfType<TreeItemProps>(child, TreeItem)) {
      firstChildValue ??= child.props.value;
      nestedItems.push(keyed);
    } else if (isElementOfType(child, TreeRoot)) {
      nestedItems.push(keyed);
    } else {
      labelContent.push(keyed);
    }
  });

  // Checkbox tree: the item computes its state from its own subtree (the child-group rule) and
  // the checked list, so every state renders on the server and needs no other item. A top-level
  // item also hands its subtree to the root, which orders a toggle's list by it.
  const multiple = ctx.selectionMode === 'multiple';
  const ownNode = React.useMemo<TreeNode | null>(
    () =>
      multiple
        ? { value, children: leaf ? [] : collectItems(children, { item: TreeItem, tree: TreeRoot }) }
        : null,
    [multiple, value, leaf, children],
  );
  const checkState: CheckState | undefined = ownNode
    ? computeCheckStates([ownNode], ctx.checked, ancestorListed).get(value)
    : undefined;
  const selectionEntry = React.useRef<TreeSelectionEntry | null>(null);
  React.useLayoutEffect(() => {
    selectionEntry.current = ownNode ? { node: ownNode, element: itemRef.current } : null;
  });
  const isTopLevel = parent === null && !insideLabel;
  React.useLayoutEffect(
    () => (multiple && isTopLevel ? registerTopLevel(selectionEntry) : undefined),
    [multiple, isTopLevel, registerTopLevel],
  );

  // A falsy icon (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in 0.4
  // and as in Avatar, and so is a collection whose items render nothing: no empty span adds a gap
  // to the row. The check does not consume a generator: renderSlot still renders its items.
  const iconNode =
    icon && slotRendersContent(icon)
      ? renderSlot(icon, 'span', cn(treeItemClassNames.icon, 'inline-flex shrink-0'), {
          'aria-hidden': true,
        })
      : null;
  const iconAfterNode =
    iconAfter && slotRendersContent(iconAfter)
      ? renderSlot(iconAfter, 'span', cn(treeItemClassNames.iconAfter, 'inline-flex shrink-0'), {
          'aria-hidden': true,
        })
      : null;
  // No empty aside and no empty toolbar (`actions={cond && <Button />}` with `cond` false).
  const hasAside = slotRendersContent(aside);
  const hasActions = slotRendersContent(actions);
  const hasChildren = nestedItems.length > 0 && !leaf;
  const isSelected = ctx.selected !== undefined ? ctx.selected === value : undefined;
  const isCurrent = ctx.current !== undefined && ctx.current !== null && ctx.current === value;

  // The optional-indicator slot rule (C-SLOTS): `null`/`undefined` keep the chevron, `false` or
  // content that renders nothing hides it (the spacer keeps the column), and a custom glyph is
  // rendered as given, not rotated.
  let chevron: React.ReactNode = <span className="w-3 shrink-0" aria-hidden="true" />;
  if (hasChildren && (expandIcon === undefined || expandIcon === null)) {
    chevron = (
      <ChevronRightIcon
        className={cn(
          treeItemClassNames.expandIcon,
          'shrink-0 transition-transform motion-reduce:transition-none',
          isExpanded ? 'rotate-90' : 'wave-rtl:-scale-x-100',
        )}
      />
    );
  } else if (hasChildren && slotRendersContent(expandIcon)) {
    chevron = renderSlot(expandIcon, 'span', cn(treeItemClassNames.expandIcon, 'inline-flex shrink-0'), {
      'aria-hidden': true,
    });
  }

  const activate = () => {
    if (hasChildren) ctx.toggle(value);
    ctx.activate(value);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOwnClick(event)) return;
    onClick?.(event);
    if (!event.defaultPrevented) activate();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOwnKeyEvent(event)) return;
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    const rtl = getDirection(event.currentTarget) === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        activate();
        return;
      case ' ':
        event.preventDefault();
        // A checkbox tree toggles the focused item's check (APG); the other modes activate.
        if (checkState !== undefined) ctx.toggleChecked(value, event.nativeEvent);
        else activate();
        return;
      case forward:
        event.preventDefault();
        if (!hasChildren) return;
        if (!isExpanded) ctx.toggle(value);
        else if (firstChildValue !== undefined) ctx.focusValue(firstChildValue);
        return;
      case back:
        event.preventDefault();
        if (hasChildren && isExpanded) ctx.toggle(value);
        else if (parent !== null) ctx.focusValue(parent);
        return;
      case '*': {
        event.preventDefault();
        const siblings = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
          ':scope > [role="treeitem"][aria-expanded="false"][data-roving-value]',
        );
        ctx.expand(
          Array.from(siblings ?? [], (el) => el.getAttribute('data-roving-value') ?? '').filter(
            Boolean,
          ),
        );
        return;
      }
      default:
    }
  };

  // The checkbox never takes focus (APG: focus stays on tree items): a press on it focuses its
  // item instead, and its click toggles the check without activating the item.
  const keepFocusOnItem = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    itemRef.current?.focus({ preventScroll: true });
  };
  const handleCheckboxClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    ctx.toggleChecked(value, event.nativeEvent);
  };

  const checkbox =
    checkState === undefined ? null : (
      <span
        role="checkbox"
        aria-checked={checkState === 'mixed' ? 'mixed' : checkState === 'checked'}
        aria-labelledby={labelId}
        tabIndex={-1}
        data-tree-checkbox=""
        onMouseDown={keepFocusOnItem}
        onClick={handleCheckboxClick}
        className={cn(
          treeItemClassNames.indicator,
          // Checkbox's box: 16px inside a 24px target (the pseudo-element), WCAG 2.5.8.
          'relative inline-flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors motion-reduce:transition-none',
          'before:absolute before:-inset-1',
          checkState === 'unchecked'
            ? cn('border-stroke-accessible bg-transparent', forcedColors.control)
            : 'border-primary bg-primary text-primary-foreground forced-colors:border-[Highlight] forced-colors:bg-[Highlight]',
        )}
      >
        {checkState === 'mixed' ? (
          <SubtractIcon size={12} className={forcedColors.selectedLeaf} />
        ) : checkState === 'checked' ? (
          <CheckIcon size={12} className={forcedColors.selectedLeaf} />
        ) : null}
      </span>
    );
  // Single mode: a decorative radio (the treeitem's aria-selected carries the state). A click on
  // it is a click on the row, so it activates the item.
  const radio =
    ctx.selectionMode === 'single' ? (
      <span
        aria-hidden="true"
        className={cn(
          treeItemClassNames.indicator,
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none',
          isSelected
            ? 'border-2 border-primary forced-colors:border-[Highlight]'
            : cn('border-stroke-accessible', forcedColors.control),
        )}
      >
        {isSelected && (
          <span className={cn('block size-2 rounded-full bg-primary', forcedColors.selectedLeaf)} />
        )}
      </span>
    ) : null;
  // A tree item shows its checkbox in multiple mode, its radio in single mode, and nothing else.
  const indicator = checkbox ?? radio;

  // Items in this item's group are checked when the list checks this item or an ancestor.
  const groupListed = ancestorListed || (multiple && ctx.checked.has(value));

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) ctx.onItemFocus(value);
  };

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isCurrent ? true : undefined}
      data-checked={checkState === 'checked' ? '' : undefined}
      data-mixed={checkState === 'mixed' ? '' : undefined}
      className={cn(
        treeItemClassNames.root,
        // The focus ring is drawn on the row: an outline on the treeitem would surround its
        // whole subtree.
        'block outline-none',
        '[&:focus-visible>[data-tree-row]]:outline-2 [&:focus-visible>[data-tree-row]]:-outline-offset-2 [&:focus-visible>[data-tree-row]]:outline-ring',
        hasActions && ACTIONS_ON_ITEM_FOCUS,
        hasActions && hasAside && ASIDE_OFF_ON_ITEM_FOCUS,
        className,
      )}
      {...rest}
      // Named by its label only: the treeitem also contains its icon and its child group. A
      // consumer aria-labelledby or aria-label replaces it.
      aria-labelledby={
        rest['aria-labelledby'] ?? (rest['aria-label'] === undefined ? labelId : undefined)
      }
      // The aside describes the item, after a consumer description.
      aria-describedby={joinIds(rest['aria-describedby'], hasAside ? asideId : undefined)}
      aria-expanded={hasChildren ? isExpanded : undefined}
      // From the checked list, after the rest props, so a consumer cannot contradict it.
      aria-checked={
        checkState === undefined ? undefined : checkState === 'mixed' ? 'mixed' : checkState === 'checked'
      }
      tabIndex={ctx.getTabIndex(value)}
      data-roving-value={value}
      data-selected={isSelected ? '' : undefined}
      data-current={isCurrent ? '' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={composeEventHandlers(onFocus, handleFocus, { checkDefaultPrevented: false })}
      ref={mergedRef}
    >
      <div
        data-tree-row=""
        className={cn(
          treeItemClassNames.row,
          'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-subtle-hover',
          hasActions && 'group/row',
          isSelected && cn('bg-subtle-selected font-semibold', forcedColors.selectedContainer),
        )}
      >
        {chevron}
        {indicator}
        {iconNode}
        <span
          id={labelId}
          data-tree-label=""
          data-roving-text={typeaheadText}
          // The label shrinks (and truncates) when the row has content after it.
          className={cn(treeItemClassNames.label, 'truncate', (iconAfterNode || hasAside || hasActions) && 'min-w-0')}
        >
          <TreeLabelContext.Provider value>{labelContent}</TreeLabelContext.Provider>
        </span>
        {iconAfterNode}
        {(hasAside || hasActions) && (
          <span
            data-tree-end=""
            className={cn(
              'group/end ms-auto inline-grid shrink-0 items-center gap-1',
              hasAside && hasActions && END_CELL_SHARED,
            )}
          >
            {hasAside && (
              <span
                id={asideId}
                data-tree-aside=""
                className={cn(
                  treeItemClassNames.aside,
                  'inline-flex items-center text-caption-1 text-muted-foreground',
                  hasActions && ASIDE_OFF_WITH_ACTIONS,
                )}
              >
                {materialiseSlotContent(aside)}
              </span>
            )}
            {hasActions && (
              <TreeItemActions
                labelledBy={labelId}
                tabStop={ctx.focusedItem === value ? 'last-focused' : 'none'}
              >
                {materialiseSlotContent(actions)}
              </TreeItemActions>
            )}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <TreeParentContext.Provider value={value}>
          <TreeCheckForcedContext.Provider value={groupListed}>
            <TreeLabelContext.Provider value={false}>
              <div role="group" className={cn(treeItemClassNames.group, 'ps-4')}>
                {nestedItems}
              </div>
            </TreeLabelContext.Provider>
          </TreeCheckForcedContext.Provider>
        </TreeParentContext.Provider>
      )}
    </div>
  );
};
TreeItem.displayName = 'TreeItem';
```

If Task R3's extra step (TreeLabels) ran, keep its state-text span right after the label span and its id as the second argument of `joinIds` for `aria-describedby` (`joinIds(rest['aria-describedby'], checkState !== undefined ? stateTextId : undefined, hasAside ? asideId : undefined)`).

Update `TreeItem`'s JSDoc: in the event-handler paragraph, say that `onClick` receives neither clicks on the checkbox nor on the actions, and that `onKeyDown` receives no keys pressed in the actions; add a paragraph: "`actions` render in a toolbar at the end of the row, named by the item; keys and clicks on them belong to them and never activate or check the item. `aside` sits before them and describes the item."

- [ ] **Step 6: Update the compound docblock in `Tree.tsx`**

Insert after the checkbox paragraph of Task R3:

```
 * Row content: `actions` (buttons at the end of the row, in a toolbar named by the item, shown on
 * hover and focus, and always where there is no hover or colors are forced), `aside` (a count or a
 * badge that describes the item), `iconAfter` and `expandIcon`. Tab from the focused item enters
 * its actions and Shift+Tab returns. Keys and clicks on the actions never activate or check the
 * item.
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/layout/__tests__/Tree.actions.test.tsx src/components/layout/__tests__/Tree.multiselect.test.tsx src/components/layout/__tests__/Tree.test.tsx`
Expected: PASS (the 0.7 RTL chevron assertions and the empty-icon row counts included).

Run: `npx vitest run src/components/layout/__tests__/Tree.actions.test.tsx --reporter=default`
Expected: no act() warnings, no React unknown-prop warnings, no `[WaveUI]` output.

- [ ] **Step 8: Quick checks and the CSS build**

Run: `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/__tests__/Tree.actions.test.tsx --max-warnings 0`, `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/Tree"`
Run: `node scripts/build-css.mjs`
Expected: no errors; the CSS build's word check passes: every utility word the new comments and strings contain is also a word of a library class string (`invisible`, the variant classes) or on the CSS entry's `@source not inline()` list (`visible`). If it names a stray word, rephrase that comment (CLAUDE.md "Styling").

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/__tests__/Tree.actions.test.tsx
git commit -m "feat(layout): Tree row actions, aside, iconAfter and expandIcon"
```

---
### Task R7: `navigationMode="treegrid"` (keyboard only)

**Files:**
- Modify: `src/components/layout/Tree.context.ts` (`navigationMode`)
- Modify: `src/components/layout/Tree.core.tsx`
- Modify: `src/components/layout/Tree.tsx` (docblock sentence)
- Test: `src/components/layout/__tests__/Tree.actions.test.tsx` (append)

**Interfaces:**
- Consumes: Task R6's `TreeItemActions`, `ACTION_ITEM_SELECTOR`, `focusedItem`; `getArrowIntent`, `getDirection` (`src/lib/direction.ts`); `isEditableTarget` (`src/lib/events.ts`); `isHiddenInput` (`src/lib/focus.ts`).
- Produces: `TreeProps` gains `navigationMode?: 'tree' | 'treegrid'`; `TreeContextValue` gains `navigationMode`; `TreeItemActions` gains the props `navigationMode` and `onReturn`; internal helpers `firstAction(toolbar)` and `focusFirstAction(item)`.

- [ ] **Step 1: Write the failing tests**

Add `fireEvent` to the Testing Library import of `Tree.actions.test.tsx` (`import { act, fireEvent, render, screen, within } from '@testing-library/react';`) and append:

```tsx
describe('Tree - navigationMode="treegrid"', () => {
  it('gives no action a Tab stop: Tab from the focused item leaves the tree', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Documents').focus());
    for (const name of ['Rename Documents', 'Delete Documents', 'Rename Work', 'Rename Readme']) {
      expect(button(name)).toHaveAttribute('tabindex', '-1');
    }
    await user.tab();
    expect(button('After')).toHaveFocus();
  });

  it('"next" expands a collapsed parent, then moves into its actions, not to its first child; the arrows walk the actions without wrapping; "previous" on the first action returns', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" defaultExpandedItems={[]} />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Documents')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Delete Documents')).toHaveFocus();
    // The last action: "next" does nothing, and is still taken (default prevented).
    expect(fireEvent.keyDown(button('Delete Documents'), { key: 'ArrowRight' })).toBe(false);
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Documents')).toHaveFocus();
  });

  it('a leaf with actions: "next" moves into them', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Readme')).toHaveFocus();
  });

  it('Home and End move to the first and last action, not to the first and last item', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{End}');
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(button('Rename Documents')).toHaveFocus();
  });

  it('ArrowDown and ArrowUp on an action focus the next and previous visible item', async () => {
    const user = userEvent.setup();
    render(<Rows navigationMode="treegrid" />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowDown}');
    expect(item('Work')).toHaveFocus();
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowUp}');
    expect(item('Work')).toHaveFocus();
  });

  it('a row without actions behaves as in tree mode: "next" on an open parent moves to its first child', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files" navigationMode="treegrid" defaultExpandedItems={['docs']}>
        <Tree.Item value="docs" actions={false}>
          Documents
          <Tree.Item value="work">Work</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    expect(item('Work')).toHaveFocus();
  });

  it('Enter on an action never activates the item, and letters typed there are no typeahead', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onItemSelect = vi.fn();
    render(<Rows navigationMode="treegrid" onRename={onRename} onItemSelect={onItemSelect} />);
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onItemSelect).not.toHaveBeenCalled();
    await user.keyboard('w');
    expect(button('Rename Documents')).toHaveFocus();
  });

  it('skips a disabled first action: "next" lands on the first enabled one, and "previous" there returns', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="Files" navigationMode="treegrid">
        <Tree.Item
          value="readme"
          actions={
            <>
              <button type="button" disabled>
                Locked
              </button>
              <button type="button">Rename Readme</button>
            </>
          }
        >
          Readme.md
        </Tree.Item>
      </Tree>,
    );
    act(() => item('Readme.md').focus());
    await user.keyboard('{ArrowRight}');
    expect(button('Rename Readme')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Readme.md')).toHaveFocus();
  });

  it('RTL: ArrowLeft moves into the actions and ArrowRight on the first action returns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Rows navigationMode="treegrid" />, { dir: 'rtl' });
    act(() => item('Documents').focus());
    await user.keyboard('{ArrowLeft}');
    expect(button('Rename Documents')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(button('Delete Documents')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(item('Documents')).toHaveFocus();
  });

  it('keeps the tree roles', () => {
    render(<Rows navigationMode="treegrid" />);
    expect(screen.getByRole('tree', { name: 'Files' })).toBeInTheDocument();
    expect(screen.queryByRole('treegrid')).toBeNull();
    expect(item('Documents')).toHaveAttribute('role', 'treeitem');
  });
});
```

Add to the type checks of `Tree.multiselect.test.tsx`'s `'types: …'` test:

```tsx
    expectTypeOf<TreeProps['navigationMode']>().toEqualTypeOf<'tree' | 'treegrid' | undefined>();
    // @ts-expect-error only the two navigation modes exist
    const gridMode = <Tree aria-label="x" navigationMode="grid" />;
    expect(gridMode).toBeTruthy();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/layout/__tests__/Tree.actions.test.tsx -t "treegrid"`
Expected: FAIL — the focused item's first action has `tabindex="0"`, ArrowRight on the open parent focuses `Work`, and `navigationMode` reaches the DOM as an unknown attribute.

- [ ] **Step 3: Implement**

`Tree.context.ts`: `TreeContextValue` gains

```ts
  /** `'tree'` (Tab enters a row's actions) or `'treegrid'` (the arrow keys do). */
  navigationMode: 'tree' | 'treegrid';
```

and `INERT_CONTEXT` gains `navigationMode: 'tree',`.

`Tree.core.tsx` imports: `import { getArrowIntent, getDirection } from '../../lib/direction';`, `import { isEditableTarget, isOwnEvent } from '../../lib/events';`, `import { isHiddenInput } from '../../lib/focus';`.

`TreeProps` gains:

```tsx
  /**
   * `'tree'`: Tab from a focused item enters its actions. `'treegrid'`: the "next" arrow (ArrowRight,
   * ArrowLeft in RTL) moves into an item's actions and "previous" returns; on an expanded parent
   * "next" no longer moves to the first child (ArrowDown does). The roles stay `tree` and `treeitem`
   * (Fluent's `navigationMode`).
   * @default 'tree'
   */
  navigationMode?: 'tree' | 'treegrid';
```

In `TreeRoot`, destructure `navigationMode = 'tree',` and add `navigationMode` to the context value and its dependencies.

After `END_CELL_SHARED`, add the helpers:

```tsx
/**
 * The first action the toolbar's arrow keys reach, by the roving hook's rule: not natively
 * disabled, not marked `data-roving-disabled`, not `aria-disabled` unless focusable-disabled, not a
 * hidden form input and not inside a `hidden` or `inert` element of the toolbar.
 */
function firstAction(toolbar: HTMLElement): HTMLElement | null {
  for (const el of Array.from(toolbar.querySelectorAll<HTMLElement>(ACTION_ITEM_SELECTOR))) {
    if (isHiddenInput(el) || el.matches(':disabled')) continue;
    const concealed = el.closest('[hidden], [inert]');
    if (concealed && toolbar.contains(concealed)) continue;
    const marker = el.getAttribute('data-roving-disabled');
    if (marker !== null && marker !== 'false') continue;
    if (el.getAttribute('aria-disabled') === 'true' && !el.hasAttribute('data-disabled-focusable')) {
      continue;
    }
    return el;
  }
  return null;
}

/** Focuses the first action of an item's own row; `false` when the row has none. */
function focusFirstAction(item: HTMLElement): boolean {
  const toolbar = item.querySelector<HTMLElement>(':scope > [data-tree-row] [data-tree-actions]');
  const first = toolbar ? firstAction(toolbar) : null;
  if (!first) return false;
  first.focus();
  return true;
}
```

Replace `TreeItemActions` (props and key handler; the JSX is unchanged):

```tsx
interface TreeItemActionsProps {
  /** Id of the element that names the item. */
  labelledBy: string;
  /** `'last-focused'` while the actions hold a Tab stop (their item has focus, tree mode), else `'none'`. */
  tabStop: 'last-focused' | 'none';
  /** `'treegrid'`: the arrows do not wrap, and "previous" on the first action returns to the item. */
  navigationMode: 'tree' | 'treegrid';
  /** Moves focus back to the item. */
  onReturn: () => void;
  children: React.ReactNode;
}

/**
 * A row's actions: the consumer's controls rove with the arrow keys and hold at most one Tab
 * stop. A key pressed on an action is the action's: ArrowDown and ArrowUp on an action that opens
 * a popup (`aria-haspopup`) never move focus to another item. In treegrid navigation, "previous"
 * on the first action returns to the item.
 */
const TreeItemActions = ({
  labelledBy,
  tabStop,
  navigationMode,
  onReturn,
  children,
}: TreeItemActionsProps) => {
  const treegrid = navigationMode === 'treegrid';
  const { containerProps } = useRovingTabIndex({
    itemSelector: ACTION_ITEM_SELECTOR,
    manageTabIndex: true,
    orientation: 'horizontal',
    loop: !treegrid,
    tabStop,
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    // A key from a popup an action opened reaches here through the React tree: not ours.
    if (event.defaultPrevented || !isOwnEvent(event)) return;
    const target = event.target as HTMLElement;
    const popup = target.getAttribute('aria-haspopup');
    if (
      (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
      popup !== null &&
      popup !== 'false'
    ) {
      event.preventDefault();
      return;
    }
    if (!treegrid || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(target)) {
      return;
    }
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    });
    if (intent === 'prev' && target === firstAction(event.currentTarget)) {
      event.preventDefault();
      onReturn();
    }
  };

  return (
    <span
      role="toolbar"
      aria-labelledby={labelledBy}
      aria-orientation="horizontal"
      data-tree-actions=""
      data-roving-container=""
      ref={containerProps.ref}
      onKeyDown={composeEventHandlers(handleKeyDown, containerProps.onKeyDown)}
      onFocus={containerProps.onFocus}
      className={cn(treeItemClassNames.actions, 'inline-flex items-center gap-1', ACTIONS_VISIBILITY)}
    >
      {children}
    </span>
  );
};
TreeItemActions.displayName = 'TreeItemActions';
```

In `TreeItem`, replace the forward and back cases of `handleKeyDown` with an arrow-intent block after the switch (Enter, Space and `*` stay in the switch; remove the `rtl`, `forward` and `back` constants):

```tsx
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        activate();
        return;
      case ' ':
        event.preventDefault();
        // A checkbox tree toggles the focused item's check (APG); the other modes activate.
        if (checkState !== undefined) ctx.toggleChecked(value, event.nativeEvent);
        else activate();
        return;
      case '*': {
        event.preventDefault();
        const siblings = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
          ':scope > [role="treeitem"][aria-expanded="false"][data-roving-value]',
        );
        ctx.expand(
          Array.from(siblings ?? [], (el) => el.getAttribute('data-roving-value') ?? '').filter(
            Boolean,
          ),
        );
        return;
      }
      default:
    }

    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    });
    if (intent === 'next') {
      event.preventDefault();
      if (hasChildren && !isExpanded) {
        ctx.toggle(value);
        return;
      }
      // Treegrid navigation moves into the row's actions, also from an open parent (Down reaches
      // its first child), where APG's tree moves to the first child.
      if (ctx.navigationMode === 'treegrid' && focusFirstAction(event.currentTarget)) return;
      if (hasChildren && firstChildValue !== undefined) ctx.focusValue(firstChildValue);
    } else if (intent === 'prev') {
      event.preventDefault();
      if (hasChildren && isExpanded) ctx.toggle(value);
      else if (parent !== null) ctx.focusValue(parent);
    }
```

Pass the new props to the toolbar and restrict its Tab stop to tree mode:

```tsx
              <TreeItemActions
                labelledBy={labelId}
                tabStop={ctx.navigationMode === 'tree' && ctx.focusedItem === value ? 'last-focused' : 'none'}
                navigationMode={ctx.navigationMode}
                onReturn={() => ctx.focusValue(value)}
              >
                {materialiseSlotContent(actions)}
              </TreeItemActions>
```

In the `Tree.tsx` docblock, append to the row-content paragraph: "With `navigationMode=\"treegrid\"`, Right (Left in right-to-left layouts) moves from an item into its actions and Left returns, the actions take no Tab stop, and on an open parent Right moves into its actions rather than to its first child (Down does); the roles stay `tree` and `treeitem`." Replace "Right expands or moves to the first child" in the first paragraph with "Right expands or moves to the first child (or into the row's actions, see below)".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/layout/__tests__/Tree.actions.test.tsx src/components/layout/__tests__/Tree.test.tsx src/components/layout/__tests__/Tree.multiselect.test.tsx`
Expected: PASS (the 0.7 keyboard and RTL tests pass through the new arrow-intent block).

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/__tests__/Tree.actions.test.tsx src/components/layout/__tests__/Tree.multiselect.test.tsx --max-warnings 0`, `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/Tree"`, `npx vitest run src/components/layout/__tests__/Tree.actions.test.tsx --reporter=default`
Expected: no errors; clean output.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/__tests__/Tree.actions.test.tsx src/components/layout/__tests__/Tree.multiselect.test.tsx
git commit -m "feat(layout): Tree navigationMode treegrid"
```

---

### Task R8: `Tree.ItemPersonaLayout`, the compound member and the flat-name bridge

**Files:**
- Create: `src/components/layout/Tree.itemPersonaLayout.tsx`
- Modify: `src/components/layout/Tree.context.ts` (the item context)
- Modify: `src/components/layout/Tree.core.tsx` (registration, name, description, typeahead)
- Modify: `src/components/layout/Tree.tsx` (member, flat name, types, docblock)
- Modify: `src/components/layout/__tests__/Tree.test.tsx` (`testCompoundExposure`)
- Modify: `scripts/verify-dist.mjs` (`'Tree'` on `PENDING_FLAT_EXPORTS`, and nothing else)
- Test: `src/components/layout/__tests__/Tree.itemPersonaLayout.test.tsx` (create)

**Interfaces:**
- Consumes: `treeItemPersonaLayoutClassNames` (Appendix A: `root`, `media`, `main`, `description`; on `PENDING_CLASS_NAMES`); `testSystemProps` with the stable-class case of Task A13 (it finds `treeItemPersonaLayoutClassNames` from the display name `TreeItemPersonaLayout`).
- Produces:
  - `export interface TreeItemPersonaLayoutProps extends React.HTMLAttributes<HTMLSpanElement> { media?: React.ReactNode; description?: React.ReactNode; ref?: React.Ref<HTMLSpanElement> }`
  - `export const TreeItemPersonaLayout` (display name `TreeItemPersonaLayout`), attached as `Tree.ItemPersonaLayout`, re-exported flat from `Tree.tsx` with its props type.
  - `Tree.context.ts`: `PersonaLayoutIds`, `TreeItemContextValue`, `TreeItemContext`, `useTreeItemContext(component)`.
  - Internal marker `data-tree-persona-name` on the name element.

- [ ] **Step 1: Write the failing tests**

Create `src/components/layout/__tests__/Tree.itemPersonaLayout.test.tsx`:

```tsx
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, TreeItemPersonaLayout, type TreeItemPersonaLayoutProps } from '../Tree';
import { Avatar } from '../../data-display/Avatar';
import { treeItemPersonaLayoutClassNames } from '../../../lib/classNames';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  testSystemProps,
  type TestWrapper,
} from '../../../test-utils';

const item = (name: string) => screen.getByRole('treeitem', { name });

const InItem: TestWrapper = ({ children }) => (
  <Tree aria-label="People">
    <Tree.Item value="kat">{children}</Tree.Item>
  </Tree>
);

const person = (name: string, description?: string) => (
  <Tree.ItemPersonaLayout media={<Avatar decorative name={name} size="small" />} description={description}>
    {name}
  </Tree.ItemPersonaLayout>
);

describe('Tree.ItemPersonaLayout', () => {
  testSystemProps(Tree.ItemPersonaLayout, {
    expectedTag: 'span',
    displayName: 'TreeItemPersonaLayout',
    defaultProps: { children: 'Kat Sharp', description: 'Designer' },
    wrapper: InItem,
  });

  it('is exported under its flat name (C-COMPOUND)', () => {
    expect(TreeItemPersonaLayout).toBe(Tree.ItemPersonaLayout);
  });

  it('names the item by the name only and describes it by the description; each part carries its class', () => {
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
      </Tree>,
    );
    const kat = item('Kat Sharp');
    expect(kat).toHaveAccessibleDescription('Designer');
    const root = kat.querySelector(`.${treeItemPersonaLayoutClassNames.root}`)!;
    expect(root.querySelector(`.${treeItemPersonaLayoutClassNames.media}`)).not.toBeNull();
    expect(screen.getByText('Kat Sharp')).toHaveClass(treeItemPersonaLayoutClassNames.main);
    expect(screen.getByText('Designer')).toHaveClass(treeItemPersonaLayoutClassNames.description);
  });

  it('without a description, adds no description; without media, renders no media element', () => {
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat">
          <Tree.ItemPersonaLayout>Kat Sharp</Tree.ItemPersonaLayout>
        </Tree.Item>
      </Tree>,
    );
    expect(item('Kat Sharp')).not.toHaveAttribute('aria-describedby');
    expect(document.querySelector(`.${treeItemPersonaLayoutClassNames.description}`)).toBeNull();
    expect(document.querySelector(`.${treeItemPersonaLayoutClassNames.media}`)).toBeNull();
  });

  it("a consumer aria-label on the item still names it, and the item's aside joins the description", () => {
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat" aria-label="Kat Sharp (away)" aside="Away">
          {person('Kat Sharp', 'Designer')}
        </Tree.Item>
      </Tree>,
    );
    expect(item('Kat Sharp (away)')).toHaveAccessibleDescription('Away Designer');
  });

  it('typeahead matches the name, not the avatar initials in front of it', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="People">
        <Tree.Item value="mia">{person('Mia Lopez')}</Tree.Item>
        <Tree.Item value="luca">{person('Luca Mora')}</Tree.Item>
      </Tree>,
    );
    act(() => item('Mia Lopez').focus());
    await user.keyboard('lu');
    expect(item('Luca Mora')).toHaveFocus();
  });

  it('in a checkbox tree with actions, the checkbox and the toolbar are named by the name', () => {
    render(
      <Tree aria-label="People" selectionMode="multiple">
        <Tree.Item value="kat" actions={<button type="button">Message Kat</button>}>
          {person('Kat Sharp', 'Designer')}
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('checkbox', { name: 'Kat Sharp' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Kat Sharp' })).toBeInTheDocument();
  });

  it('throws outside a Tree.Item (C-CONTEXT)', () => {
    expectThrows(
      <Tree.ItemPersonaLayout>Kat Sharp</Tree.ItemPersonaLayout>,
      '[WaveUI] Tree.ItemPersonaLayout must be used within <Tree.Item>',
    );
  });

  it('written in a Server Component (a lazy type): the same server HTML, and it names the item the same', () => {
    const LazyLayout = asClientReference(Tree.ItemPersonaLayout);
    const people = (Layout: typeof Tree.ItemPersonaLayout) => (
      <Tree aria-label="People">
        <Tree.Item value="kat">
          <Layout description="Designer">Kat Sharp</Layout>
        </Tree.Item>
      </Tree>
    );
    expect(renderToString(people(LazyLayout))).toBe(renderToString(people(Tree.ItemPersonaLayout)));
    render(people(LazyLayout));
    expect(item('Kat Sharp')).toHaveAccessibleDescription('Designer');
  });

  it('StrictMode: the registration survives the double effects', () => {
    render(
      <React.StrictMode>
        <Tree aria-label="People">
          <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
        </Tree>
      </React.StrictMode>,
    );
    expect(item('Kat Sharp')).toHaveAccessibleDescription('Designer');
  });

  it('removing the layout gives the item its label name back', () => {
    const { rerender } = render(
      <Tree aria-label="People">
        <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
      </Tree>,
    );
    rerender(
      <Tree aria-label="People">
        <Tree.Item value="kat">Kat Sharp, designer</Tree.Item>
      </Tree>,
    );
    expect(item('Kat Sharp, designer')).not.toHaveAttribute('aria-describedby');
  });

  it('has no accessibility violations with persona rows', async () => {
    render(
      <Tree aria-label="People" defaultExpandedItems={['team']}>
        <Tree.Item value="team">
          Design team
          <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
          <Tree.Item value="luca">{person('Luca Mora', 'Researcher')}</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await expectNoA11yViolations();
  });

  it('types (C-REF)', () => {
    expectTypeOf<TreeItemPersonaLayoutProps['media']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps['description']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
  });
});
```

In `src/components/layout/__tests__/Tree.test.tsx`, change `testCompoundExposure(Tree, ['Item']);` to:

```tsx
  testCompoundExposure(Tree, ['Item', 'ItemPersonaLayout']);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/layout/__tests__/Tree.itemPersonaLayout.test.tsx src/components/layout/__tests__/Tree.test.tsx -t "compound|ItemPersonaLayout"`
Expected: FAIL — `TreeItemPersonaLayout` is not exported, `Tree.ItemPersonaLayout` is undefined.

- [ ] **Step 3: Add the item context**

In `Tree.context.ts`:

```ts
/** The ids a Tree.ItemPersonaLayout registers with its item. */
export interface PersonaLayoutIds {
  /** The name element: the item's name. */
  nameId: string;
  /** The description element, while it renders: it joins the item's description. */
  descriptionId: string | undefined;
}

/** What a Tree.Item gives the content of its label. */
export interface TreeItemContextValue {
  /** Registers a persona layout's ids with the item; returns the unregistration. */
  registerLayout: (ids: PersonaLayoutIds) => () => void;
}

export const TreeItemContext = React.createContext<TreeItemContextValue | null>(null);

const INERT_ITEM_CONTEXT: TreeItemContextValue = { registerLayout: () => () => {} };

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useTreeItemContext(component: string): TreeItemContextValue {
  const context = React.useContext(TreeItemContext);
  if (context) return context;
  reportMissingContext(component, '<Tree.Item>');
  return INERT_ITEM_CONTEXT;
}
```

- [ ] **Step 4: Create `src/components/layout/Tree.itemPersonaLayout.tsx`**

```tsx
import * as React from 'react';
import { treeItemPersonaLayoutClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { useId } from '../../hooks/useId';
import { useTreeItemContext } from './Tree.context';

/** Properties for the TreeItemPersonaLayout sub-component (Fluent's `TreeItemPersonaLayout`). */
export interface TreeItemPersonaLayoutProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * The person's picture, usually an Avatar (`size="small"`, 32 px, fits a row). The name is shown
   * next to it, so make it decorative (`<Avatar decorative … />`).
   */
  media?: React.ReactNode;
  /** A second line under the name; it describes the item. */
  description?: React.ReactNode;
  ref?: React.Ref<HTMLSpanElement>;
}

/**
 * Lays out an item's label as a person: `media`, the name (children) and a `description` under
 * it. Use it as a Tree.Item's label content: the item is named by the name and described by the
 * description. Also exported as `TreeItemPersonaLayout` (Fluent's name; import the flat name from
 * React Server Components).
 */
export const TreeItemPersonaLayout = ({
  media,
  description,
  className,
  children,
  ref,
  ...rest
}: TreeItemPersonaLayoutProps) => {
  const { registerLayout } = useTreeItemContext('Tree.ItemPersonaLayout');
  const nameId = useId('tree-persona-name');
  const descriptionId = useId('tree-persona-description');
  const hasMedia = slotRendersContent(media);
  const hasDescription = slotRendersContent(description);

  React.useLayoutEffect(
    () => registerLayout({ nameId, descriptionId: hasDescription ? descriptionId : undefined }),
    [registerLayout, nameId, descriptionId, hasDescription],
  );

  return (
    <span
      ref={ref}
      className={cn(treeItemPersonaLayoutClassNames.root, 'flex min-w-0 items-center gap-2', className)}
      {...rest}
    >
      {hasMedia && (
        <span className={cn(treeItemPersonaLayoutClassNames.media, 'inline-flex shrink-0')}>
          {materialiseSlotContent(media)}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span
          id={nameId}
          data-tree-persona-name=""
          className={cn(treeItemPersonaLayoutClassNames.main, 'truncate')}
        >
          {children}
        </span>
        {hasDescription && (
          <span
            id={descriptionId}
            className={cn(
              treeItemPersonaLayoutClassNames.description,
              'truncate text-caption-1 text-muted-foreground',
            )}
          >
            {materialiseSlotContent(description)}
          </span>
        )}
      </span>
    </span>
  );
};
TreeItemPersonaLayout.displayName = 'TreeItemPersonaLayout';
```

- [ ] **Step 5: Register the layout in `TreeItem`, name and describe the item by it, and type ahead by the name**

`Tree.core.tsx` imports gain `TreeItemContext`, `type PersonaLayoutIds` and `type TreeItemContextValue` from `./Tree.context`.

In `TreeItem`, after `mergedRef`:

```tsx
  // A Tree.ItemPersonaLayout in the label registers its name and description: the item is named
  // by the name only and described by the description.
  const [layoutIds, setLayoutIds] = React.useState<PersonaLayoutIds | null>(null);
  const registerLayout = React.useCallback((ids: PersonaLayoutIds) => {
    setLayoutIds(ids);
    return () => setLayoutIds((current) => (current === ids ? null : current));
  }, []);
  const itemContext = React.useMemo<TreeItemContextValue>(() => ({ registerLayout }), [registerLayout]);
  const nameId = layoutIds?.nameId ?? labelId;
```

Change the three name references from `labelId` to `nameId` (the label span keeps `id={labelId}`):
- `aria-labelledby={rest['aria-labelledby'] ?? (rest['aria-label'] === undefined ? nameId : undefined)}`
- the checkbox's `aria-labelledby={nameId}`
- `<TreeItemActions labelledBy={nameId} …>`

Join the description (keep Task R3's state-text id second if that step ran):

```tsx
      aria-describedby={joinIds(
        rest['aria-describedby'],
        hasAside ? asideId : undefined,
        layoutIds?.descriptionId,
      )}
```

Provide the item context around the label content:

```tsx
          <TreeLabelContext.Provider value>
            <TreeItemContext.Provider value={itemContext}>{labelContent}</TreeItemContext.Provider>
          </TreeLabelContext.Provider>
```

In `syncTypeaheadText`, read a persona name first:

```tsx
function syncTypeaheadText(tree: HTMLElement): void {
  tree.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((treeitem) => {
    const label = treeitem.querySelector<HTMLElement>(
      ':scope > [data-tree-row] > [data-tree-label]',
    );
    if (!label) return;
    // A persona layout's name is the item's name, so it is its typeahead text too (not the media,
    // such as an avatar's initials, or the description).
    const personaName = label.querySelector<HTMLElement>('[data-tree-persona-name]');
    const text =
      label.getAttribute('data-roving-text') ?? personaName?.textContent ?? label.textContent ?? '';
    if (treeitem.getAttribute('data-roving-text') !== text) {
      treeitem.setAttribute('data-roving-text', text);
    }
  });
}
```

(Update its JSDoc: "…to the text of its label (a persona layout's name when the label holds one), so neither the icon nor the nested items take part…".)

- [ ] **Step 6: Attach the member in `Tree.tsx`**

```tsx
import { TreeItem, TreeRoot } from './Tree.core';
import { TreeItemPersonaLayout } from './Tree.itemPersonaLayout';

export type { TreeCheckedItemsChangeDetails, TreeItemProps, TreeProps } from './Tree.core';
export type { TreeItemPersonaLayoutProps } from './Tree.itemPersonaLayout';

/** …docblock (below)… */
export const Tree = /* @__PURE__ */ Object.assign(TreeRoot, {
  Item: TreeItem,
  ItemPersonaLayout: TreeItemPersonaLayout,
});

export { TreeItem, TreeItemPersonaLayout };
```

(Add `TreeLabels` to the `./Tree.core` type re-export if Task R3's extra step ran.) In the docblock, extend the items paragraph with "`Tree.ItemPersonaLayout` lays out a person (media, name and description) as an item's label." and replace the last paragraph with: "`Tree.Item` and `Tree.ItemPersonaLayout` are also exported as `TreeItem` and `TreeItemPersonaLayout` for React Server Components, which cannot use the dotted form."

- [ ] **Step 7: Put `'Tree'` on the flat-name bridge**

`checkFlatExports` now finds `Tree.ItemPersonaLayout` without `TreeItemPersonaLayout` in the entry (the barrel is INTEGRATION's), so `Tree` joins the bridge in this commit, in sorted place, and nowhere earlier (a listed complete compound is an error). In `scripts/verify-dist.mjs`:

```js
export const PENDING_FLAT_EXPORTS = ['ColorPicker', 'MessageBar', 'Toast', 'Tree'];
```

(If the wave-B list differs, insert `'Tree'` where `[...PENDING_FLAT_EXPORTS].sort()` puts it; change nothing else in the file.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/components/layout/__tests__/Tree.itemPersonaLayout.test.tsx src/components/layout/__tests__/Tree.test.tsx src/components/layout/__tests__/Tree.actions.test.tsx src/components/layout/__tests__/Tree.multiselect.test.tsx`
Expected: PASS.

Run: `npx vitest run scripts/__tests__/verify-dist.test.mjs -t "PENDING_FLAT_EXPORTS|sorted|bridge"`
Expected: PASS (the sorted-list case, and Task A16's real-sources case, which reports `Tree` as pending: `TreeItemPersonaLayout` is not in the entry yet).

Run: `npx vitest run .storybook/__tests__/exportDocblocks.test.ts`
Expected: PASS.

- [ ] **Step 9: Quick checks, the build and verify-dist**

Run: `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint src/components/layout scripts/verify-dist.mjs --max-warnings 0`, `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/Tree"`
Run: `npm run build`
Expected: no errors; `verify-dist` reports the bridge open for `ColorPicker`, `MessageBar`, `Toast` and `Tree` (planned or pending), and no other error.

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/Tree.itemPersonaLayout.tsx src/components/layout/__tests__/Tree.itemPersonaLayout.test.tsx src/components/layout/__tests__/Tree.test.tsx scripts/verify-dist.mjs
git commit -m "feat(layout): Tree.ItemPersonaLayout"
```

---
### Task R9: Stories, the package gate and the package report

**Files:**
- Modify: `stories/Tree.stories.tsx`
- Test: `src/__tests__/stories.a11y.test.tsx` (unchanged; it renders every story), `src/__tests__/conventions.test.ts` (unchanged; raw colors in stories)

**Interfaces:**
- Consumes: every API of Tasks R3–R8 through `'../src'` (Tree's module path is unchanged, so `Tree.ItemPersonaLayout` is reachable through the compound before INTEGRATION extends the barrel; spec §0.2 rule 25 concerns new modules only); `Avatar`, `Badge`, `Button` (0.7).
- Produces: the stories `MultiSelect`, `ControlledChecks`, `SingleSelect`, `LazyChildren`, `RowActions`, `TreegridNavigation`, `AsideContent`, `CustomExpandIcon`, `PersonaRows` (spec P3-06 and P3-07 "Stories").

- [ ] **Step 1: Run the story gate on the current file (baseline)**

Run: `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Layout/Tree"`
Expected: PASS for the four 0.7 stories.

- [ ] **Step 2: Write the stories**

In `stories/Tree.stories.tsx`, change the import line and the meta args, and append the stories after `ControlledSelection` (the four 0.7 stories stay unchanged):

```tsx
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Badge, Button, Tree } from '../src';

const meta = {
  title: 'Components/Layout/Tree',
  component: Tree,
  args: {
    'aria-label': 'File explorer',
    style: { width: 280 },
    onItemSelect: fn(),
    onExpandedItemsChange: fn(),
    onCheckedItemsChange: fn(),
  },
} satisfies Meta<typeof Tree>;
```

```tsx
/**
 * `selectionMode="multiple"`: a checkbox on every item. Checking a folder checks everything in it,
 * and a folder shows mixed while only some of its items are checked. Space toggles the focused
 * item, a click on the checkbox toggles it, and a click elsewhere on the row still activates the
 * item.
 */
export const MultiSelect: Story = {
  args: {
    'aria-label': 'Files to back up',
    selectionMode: 'multiple',
    defaultExpandedItems: ['docs', 'work'],
    defaultCheckedItems: ['report'],
  },
  render: (args) => <Tree {...args}>{files}</Tree>,
};

/**
 * Controlled checks: `checkedItems` and `onCheckedItemsChange`, which receives every checked item
 * in tree order (a fully checked folder included) and `details` (`value`, `checked`, `event`).
 */
export const ControlledChecks: Story = {
  args: {
    'aria-label': 'Files to share',
    selectionMode: 'multiple',
    defaultExpandedItems: ['docs'],
  },
  render: function ControlledChecksTree(args) {
    const [checked, setChecked] = React.useState<string[]>(['personal']);
    return (
      <div>
        <Tree
          {...args}
          checkedItems={checked}
          onCheckedItemsChange={(next, details) => {
            setChecked(next);
            args.onCheckedItemsChange?.(next, details);
          }}
        >
          {files}
        </Tree>
        <p className="mt-2 text-caption-1 text-muted-foreground">
          Checked: {checked.length > 0 ? checked.join(', ') : 'none'}
        </p>
      </div>
    );
  },
};

/** `selectionMode="single"`: a radio on every item for `selected`, updated from `onItemSelect`. */
export const SingleSelect: Story = {
  args: {
    'aria-label': 'Save to folder',
    selectionMode: 'single',
    defaultExpandedItems: ['docs'],
  },
  render: function SingleSelectTree(args) {
    const [selected, setSelected] = React.useState<string | null>('work');
    return (
      <Tree
        {...args}
        selected={selected}
        onItemSelect={(value) => {
          setSelected(value);
          args.onItemSelect?.(value);
        }}
      >
        {files}
      </Tree>
    );
  },
};

/**
 * A checked folder whose items load when it opens: they arrive checked, because their folder is
 * listed. The placeholder's value is dropped from the checked list when the real items replace
 * it, so it does not linger as a value no item has.
 */
export const LazyChildren: Story = {
  args: {
    'aria-label': 'Remote files',
    selectionMode: 'multiple',
  },
  render: function LazyChildrenTree(args) {
    const [checked, setChecked] = React.useState<string[]>(['remote']);
    const [expanded, setExpanded] = React.useState<string[]>([]);
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      if (loaded || !expanded.includes('remote')) return undefined;
      const timer = window.setTimeout(() => {
        setLoaded(true);
        setChecked((current) => current.filter((value) => value !== 'remote-loading'));
      }, 800);
      return () => window.clearTimeout(timer);
    }, [expanded, loaded]);
    return (
      <Tree
        {...args}
        expandedItems={expanded}
        onExpandedItemsChange={(next) => {
          setExpanded(next);
          args.onExpandedItemsChange?.(next);
        }}
        checkedItems={checked}
        onCheckedItemsChange={(next, details) => {
          setChecked(next);
          args.onCheckedItemsChange?.(next, details);
        }}
      >
        <Tree.Item value="remote">
          Remote drive
          {loaded ? (
            <>
              <Tree.Item value="budget">Budget.xlsx</Tree.Item>
              <Tree.Item value="minutes">Minutes.docx</Tree.Item>
            </>
          ) : (
            <Tree.Item value="remote-loading">Loading…</Tree.Item>
          )}
        </Tree.Item>
        <Tree.Item value="local">Local notes.md</Tree.Item>
      </Tree>
    );
  },
};

/** Two text buttons for a row's actions. */
function RowButtons() {
  return (
    <>
      <Button size="small" appearance="subtle">
        Rename
      </Button>
      <Button size="small" appearance="subtle">
        Delete
      </Button>
    </>
  );
}

/** Folders and files whose rows have actions. */
const filesWithActions = (
  <>
    <Tree.Item value="docs" actions={<RowButtons />}>
      Documents
      <Tree.Item value="report" actions={<RowButtons />}>
        Annual Report.docx
      </Tree.Item>
      <Tree.Item value="slides" actions={<RowButtons />}>
        Presentation.pptx
      </Tree.Item>
    </Tree.Item>
    <Tree.Item value="readme" actions={<RowButtons />}>
      README.md
    </Tree.Item>
  </>
);

/**
 * `actions`: buttons at the end of the row, in a toolbar named by the item. They show while the
 * row is hovered or the item has focus, and always on touch screens and in forced colors. Tab from
 * the focused item enters them; keys and clicks on them never activate the item.
 */
export const RowActions: Story = {
  args: {
    'aria-label': 'Files with actions',
    defaultExpandedItems: ['docs'],
  },
  render: (args) => <Tree {...args}>{filesWithActions}</Tree>,
};

/**
 * `navigationMode="treegrid"`: Right (Left in right-to-left layouts) moves from an item into its
 * actions and Left returns; the actions take no Tab stop, and Down on an open folder reaches its
 * first item. The roles stay `tree` and `treeitem`.
 */
export const TreegridNavigation: Story = {
  args: {
    'aria-label': 'Files, grid navigation',
    navigationMode: 'treegrid',
    defaultExpandedItems: ['docs'],
  },
  render: (args) => <Tree {...args}>{filesWithActions}</Tree>,
};

/**
 * `aside`: a count or a badge at the end of the row that describes the item. It gives way to the
 * actions on hover and focus, and sits beside them where they always show.
 */
export const AsideContent: Story = {
  args: {
    'aria-label': 'Mail folders',
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="inbox" aside="12 unread">
        Inbox
      </Tree.Item>
      <Tree.Item value="drafts" aside={<Badge appearance="tint">New</Badge>}>
        Drafts
      </Tree.Item>
      <Tree.Item
        value="junk"
        aside="40"
        actions={
          <Button size="small" appearance="subtle">
            Empty
          </Button>
        }
      >
        Junk
      </Tree.Item>
    </Tree>
  ),
};

/** `expandIcon` replaces the chevron (decorative, not rotated); `false` hides it. */
export const CustomExpandIcon: Story = {
  args: {
    'aria-label': 'Projects',
    defaultExpandedItems: ['web'],
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="web" expandIcon={{ children: '📂', style: { fontSize: 12 } }}>
        Website
        <Tree.Item value="home">Home page</Tree.Item>
      </Tree.Item>
      <Tree.Item value="app" expandIcon={false}>
        App
        <Tree.Item value="login">Login screen</Tree.Item>
      </Tree.Item>
    </Tree>
  ),
};

const team = [
  { id: 'kat', name: 'Kat Sharp', role: 'Product designer' },
  { id: 'luca', name: 'Luca Mora', role: 'Researcher' },
  { id: 'mia', name: 'Mia Lopez', role: 'Content designer' },
];

/**
 * `Tree.ItemPersonaLayout` lays out an item's label as a person: the item is named by the name and
 * described by the description, and typing a name moves to it.
 */
export const PersonaRows: Story = {
  args: {
    'aria-label': 'Team',
    defaultExpandedItems: ['design'],
  },
  render: (args) => (
    <Tree {...args}>
      <Tree.Item value="design">
        Design
        {team.map((person) => (
          <Tree.Item key={person.id} value={person.id}>
            <Tree.ItemPersonaLayout
              media={<Avatar decorative name={person.name} size="small" />}
              description={person.role}
            >
              {person.name}
            </Tree.ItemPersonaLayout>
          </Tree.Item>
        ))}
      </Tree.Item>
    </Tree>
  ),
};
```

- [ ] **Step 3: Run the story gates**

Run: `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Layout/Tree"`
Expected: PASS for every Tree story, the nine new ones included (no axe violation, no dangling id reference).

Run: `npx vitest run src/__tests__/conventions.test.ts -t "stories/Tree.stories.tsx"`
Expected: PASS (no raw color; the emoji is text).

- [ ] **Step 4: The package gate (spec §6.1)**

Run: `npx vitest run src/components/layout src/hooks/__tests__/useRovingTabIndex.test.tsx .storybook/__tests__/exportDocblocks.test.ts scripts/__tests__/verify-dist.test.mjs src/__tests__/classNames.test.ts src/__tests__/public-types.test.ts`
Expected: PASS. `classNames.test.ts` skips the Phase 3 keys through `PENDING_CLASS_NAMES`; `public-types.test.ts` skips `TreeItemPersonaLayoutProps`, `TreeCheckedItemsChangeDetails` (and `TreeLabels`) through `PENDING_PUBLIC_TYPES`, now that public props use them (spec §0.2 rule 24).

Run: `npx vitest run src/components/layout src/hooks/__tests__/useRovingTabIndex.test.tsx --reporter=default`
Expected: no act() warnings, no React warnings, no unasserted `[WaveUI]` output.

Run: `npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout"`, `npm run typecheck`, `npm run lint`, `npm run format:check`
Expected: PASS (the library program includes `src/components/layout/index.ts`, which still compiles against `./Tree`).

Run: `npm run build`, then `npm run build-storybook`
Expected: `verify-dist` passes with the bridge open for `ColorPicker`, `MessageBar`, `Toast` and `Tree`; `verify-storybook` passes (the story classes are story-only utilities it accepts, and every `wave-rtl:` class keeps Wave's direction variant).

- [ ] **Step 5: Commit**

```bash
git add stories/Tree.stories.tsx
git commit -m "docs(layout): Tree stories for checks, radios, row actions and persona rows"
```

- [ ] **Step 6: Write the package report (to the lead; no file)**

Report, in this order:

1. **Barrel requests (INTEGRATION, spec §4.3):** `src/components/layout/index.ts` exports `TreeItemPersonaLayout` and the types `TreeItemPersonaLayoutProps`, `TreeCheckedItemsChangeDetails` (and `TreeLabels` if Task R3's Step 9 ran), all from `./Tree`. Empty `PENDING_PUBLIC_TYPES` of them and remove `'Tree'` from `PENDING_FLAT_EXPORTS`. The public type test of §4.5 asserts `UseRovingTabIndexOptions['tabStop']` as `'active' | 'last-focused' | 'none' | undefined` (see note 1 below), `TreeProps['navigationMode']` as `'tree' | 'treegrid' | undefined`, `TreeProps['selectionMode']` as `'none' | SelectionMode | undefined`.
2. **0.7 tests changed (with the reason):** `Tree.test.tsx` — `testCompoundExposure` lists `ItemPersonaLayout` (new member); one added case for `data-selection-mode="none"`. `useRovingTabIndex.test.tsx` — the `Managed` harness accepts every `tabStop` value, and the option's type assertion includes `'none'`. No 0.7 assertion was deleted.
3. **Behaviour asserted only as attributes or classes (jsdom), for the real-browser and screen-reader checklist (spec §6.3 item 5):** NVDA, JAWS, Narrator (the Toggle pattern), VoiceOver and TalkBack announce a parent's mixed state on the item and on its checkbox; whether NVDA says "not selected" on every item of the `aria-multiselectable` tree; Space toggles; a double tap (VoiceOver iOS, TalkBack) on the checkbox toggles and on the item activates, also on an expanded parent; Voice Control and Dragon reach the checkbox by name ("click Documents" / "click checkbox"); the actions show on hover, on focus, on touch and in forced colors, and the aside shows beside them where they always show (the shared cell becomes a flex row there); the treegrid arrows reach the actions and back; JAWS and NVDA in focus mode on an action; the toolbar is announced with the item's name; forced colors draw the checkbox and radio indicators; at 320 px width and 400 % zoom the rows reflow without cutting off their actions; the 24 px checkbox target (its pseudo-element) receives the tap.
4. **Spec §10 notes (deliberate differences from the spec):**
   1. `useRovingTabIndex` has no boolean `tabStop` (spec D27, P3-07 API): 0.7 already exports `tabStop?: 'active' | 'last-focused'`, so the option gains the value `'none'` instead; the row toolbar passes `'last-focused'` while its item has focus in tree mode and `'none'` otherwise. CHANGELOG "Types": `UseRovingTabIndexOptions['tabStop']` gains `'none'`.
   2. The tree's roving hook selects `[role="treeitem"]` items: the spec's "the tree's roving hook skips the toolbar's buttons (a nested composite, 0.7)" does not hold, because a nested composite is one item of the enclosing arrow order, so the default selector would have put each row toolbar between two items.
   3. The cascade is not computed by the root from a scan of its own children (P3-06 Behaviour, "Model"): each item scans its own children with `collectItems` and computes its state, and the top-level items register their subtrees with the root, which orders a toggle's list by document position. This keeps the spec's rule and output, renders every state on the server, and also cascades in trees whose top-level nodes are rendered by an app component, which 0.7 supports (the root never scanned its children); nested items rendered by a component remain outside their parent's child group, as in 0.7.
   4. The label is not `flex-1` (P3-07 row layout): the end cell (aside and actions) takes `ms-auto`, and the label gains `min-w-0` only when the row has content after it, so `iconAfter` follows the label text (as Fluent's) and a 0.7 row keeps its classes exactly.
   5. The aside and the actions share one grid cell (the actions over the aside) on devices with hover and without forced colors, and sit side by side (flex) where the actions always show; the item-level `:focus` selectors use the child combinator on the row, so a parent's focus never shows its nested rows' actions.
   6. A hidden custom `expandIcon` (`false`, or content that renders nothing) leaves the 12 px spacer in place, so the labels stay aligned with their siblings.
   7. A press on the checkbox focuses its item (the checkbox never takes focus), so focus stays on tree items (APG) after a pointer toggle.
   8. `data-navigation-mode` is not rendered: the spec lists no attribute for `navigationMode`, although C-CLASS (Phase 2 D24) exposes enumerated props; a later phase may add it as a DOM addition.
5. **Docs input (DOCS):** README "Trees" (the three modes; the cascade rule and the emitted list; drop a placeholder's value when real children arrive; `details`; the actions, the aside, both navigation modes and how `'treegrid'` differs from APG; `Tree.ItemPersonaLayout` with a decorative `size="small"` Avatar); the keyboard table (Space toggles in a checkbox tree; the treegrid keys; Tab into a row's actions); "Hooks and utilities" (`tabStop: 'none'`); "React Server Components" (`TreeItemPersonaLayout`); CHANGELOG "DOM" (`data-selection-mode` on every Tree; `data-checked`/`data-mixed` on checkbox-tree items), "Types" (`typeof Tree` gains `ItemPersonaLayout`; `tabStop` gains `'none'`) and the notice that `details` of `onCheckedItemsChange` becomes required in 1.0.
