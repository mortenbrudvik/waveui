# WaveUI 0.8.0 Phase 3 — Wave A (F3-foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every public component and part a stable, public class name from one server-safe registry (`src/lib/classNames.ts`), apply the classes to every existing component without any other change, and enforce them with a conventions rule, a `testSystemProps` check, a registry test and `verify-dist` checks, so the wave-B packages only apply constants that already exist.

**Architecture:** One module of `as const` string constants (`wave-<kebab flat name>`, parts `<root>__<kebab key>`), exported from the package entry; components import their constants and put the root class first in the `cn()` of the element that receives `className`, and variants hand their icon class to Button through `withPartClass`. Four enforcement layers check the result: the gate rule `class-names`, a new `testClassName` case, `src/__tests__/classNames.test.ts` and `scripts/verify-dist.mjs`; four pending lists (`PENDING_CLASS_NAMES`, `PENDING_PUBLIC_TYPES`, `PENDING_FLAT_EXPORTS` and, for the barrel test of `integration.test.tsx`, `PENDING_FLAT_MEMBERS`) keep every gate green while wave B lands the Phase 3 parts.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` — §0.2 rules 19–25, D1–D8, §1 (1.1–1.7), P3-00, §4.1–4.2, §6.4 (the F3 and Scripts bullets), Appendix A. Tasks A1–A3 build the registry and its helpers, A4–A12 apply §1.2 to every existing component folder (with the per-folder DOM class tests and the §6.4 exact-class test updates; A4, the button folder, runs first because the other folders assert Button's classes on the Buttons they render), and A13–A17 add the enforcement, the exit gate and the VoiceOver spike.

**Index:** docs/superpowers/plans/2026-09-26-fluent-parity-phase-3.md (wave order, entry conditions, cross-package contract, final gate).

**Commits:** one per task. When packages run in parallel in one checkout, only the lead runs git write commands (spec §0.2 rule 6): a package agent stops at the commit step and reports its file list. (Wave A is exclusive, so its tasks run one after another.)

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

Wave A specifics:

- Wave A is exclusive (spec §0.2 rule 19): a component module changes by its stable classes only (no markup, attribute or style change), plus `StatusText`'s `id`; `src/index.ts` gains only the registry export.
- Class strings live only in `src/lib/classNames.ts`: a component reads them by literal member access (`buttonClassNames.root`) and never writes a `'wave-…'` literal of its own.
- The **0.8** constants and keys of Appendix A are registered in Task A1 and applied by wave B, never in wave A; they stay on `PENDING_CLASS_NAMES` until INTEGRATION.
- `npm run build` stays green with the flat-name bridge open (`node scripts/verify-dist.mjs`, never `--final`, until INTEGRATION empties `PENDING_FLAT_EXPORTS`).
- The VoiceOver spike (Task A17) is recorded in this file's "Wave A report" section before Task R3 starts.

## Review Focus

1. **A part class on the wrong element where a root or part moves between layouts** (Avatar with and without `badge`, Input with and without slot content, a portaled surface, a part that renders only in some states): a reader expects the class on the element Appendix A names in every layout → Tasks A4–A12 (each folder's `stableClassNames.test.tsx` renders every such layout).
2. **Variants of variants**: `Toolbar.ToggleButton`'s root and icon carry three classes each, through two `withPartClass` layers, with a single icon element and the consumer's slot class still last → Task A2 ("applies twice without a second wrapper") and Task A13 (`carries` of `ToolbarToggleButton`).
3. **`withPartClass` edge inputs**: `0` is content, `''`, `[]`, `<></>`, `null` and `false` stay nothing, a generator is read once, and a slot object keeps its own `as`, `className`, `ref` and a void element → Task A2.
4. **tailwind-merge dropping a stable class**: two stable classes on one element, or a stable class next to utilities and a consumer class, all survive `cn()` → Task A1 ("class-name registry: tailwind-merge") and Task A13 (the case renders with the consumer class).
5. **A public component whose `displayName` differs from its flat name and is missing from the alias table** would silently escape both the gate rule and the `testClassName` case → Task A15 ("resolves every public component's displayName to its constant").

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/classNames.ts` (create) | The registry of Appendix A: one `as const` constant per public component and part, server-safe (imports nothing), public | A1 |
| `src/index.ts` (modify) | `export * from './lib/classNames';` in the Utilities block | A1 |
| `src/__tests__/classNames.test.ts` (create) | Formula, uniqueness, reserved classes, entry export, server safety, tailwind-merge (A1); completeness, `NO_ELEMENT`, displayName resolution, `PENDING_CLASS_NAMES`, applied check (A15) | A1, A15 |
| `src/__tests__/public-types.test.ts` (modify) | Literal types of the constants; `PENDING_PUBLIC_TYPES` skipped by the public-type walk | A1 |
| `src/components/button/Button.slots.tsx` (modify) | `withPartClass`, the slot helper that adds a variant's part class to the icon Button draws | A2 |
| `src/components/button/__tests__/Button.slots.test.tsx` (modify) | `withPartClass` cases | A2 |
| `src/components/button/Toolbar.parts.tsx` (modify) | `withIconBox` replaced by `withPartClass` (identical output) | A2 |
| `src/components/feedback/MessageBar.status.tsx` (modify) | `StatusText` takes an `id` | A3 |
| `src/components/feedback/__tests__/MessageBar.test.tsx` (modify) | The `StatusText` `id` cases | A3 |
| every component module under `src/components/**` that renders a registered component or part (modify, classes only); `src/components/<folder>/__tests__/stableClassNames.test.tsx` (create, one per folder); the §6.4 exact-class tests (modify) | Appendix A applied (spec §1.2) and pinned per element | A4–A12 |
| `src/test-utils.ts` (modify) | `getStableClassNames`, `DISPLAY_NAME_ALIASES`, `VARIANT_BASES`, the stable-class case of `testClassName` | A13 |
| `src/__tests__/test-utils.test.tsx` (modify) | The lookup and the new case | A13 |
| `src/__tests__/conventions.test.ts` (modify) | The gate rule `class-names` and its fixtures | A14 |
| `scripts/verify-dist.mjs` (modify) | Server probe of the constants, `checkClassNameExports`, `keepStrings`/`dropStrings`, `REQUIRED_DECLARATIONS`, `PENDING_FLAT_EXPORTS` | A16 |
| `scripts/__tests__/verify-dist.test.mjs` (modify) | Fixture dist with a registry; the new checks; the bridge case on the real sources | A16 |
| `src/__tests__/integration.test.tsx` (modify) | `PENDING_FLAT_MEMBERS`: the barrel test skips the ten new flat member names until wave C | A16 |
| this file (modify) | The "Wave A report" section, with the VoiceOver spike result | A17 |
| outside the repository: `tree-spike.html`, `spike-server.mjs` | Throwaway VoiceOver spike page and server | A17 |

---

### Task A1: The class-name registry, its entry export and its formula tests

**Files:**
- Create: `src/lib/classNames.ts`
- Create: `src/__tests__/classNames.test.ts`
- Modify: `src/index.ts` (the `// Utilities` block, after `export { mergeRefs } from './lib/mergeRefs';`)
- Modify: `src/__tests__/public-types.test.ts` (the `import type { … } from '../index'` list at `:29-141`, `INTERNAL_HELPERS` at `:292-305`, the walk test at `:411-413`, a new `describe` at the end)

**Interfaces:**
- Consumes: nothing.
- Produces: the 131 `<camel flat name>ClassNames` constants of Appendix A (for example `buttonClassNames = { root: 'wave-button', icon: 'wave-button__icon' } as const`), exported from `src/lib/classNames.ts` and from the package entry; `PENDING_PUBLIC_TYPES: readonly string[]` in `src/__tests__/public-types.test.ts` (emptied by Task I1); `src/__tests__/classNames.test.ts` with the `constants` table that Task A15 extends.

- [ ] **Step 1: Write the failing registry test**

Create `src/__tests__/classNames.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/classNames.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/classNames" from "src/__tests__/classNames.test.ts"`.

- [ ] **Step 3: Create the registry**

Create `src/lib/classNames.ts` with exactly this content (every constant and key of Appendix A, the **0.8** ones included, grouped by folder in Appendix A's order):

```ts
/**
 * Stable class names of every public component and part. A root class sits on the element that
 * receives your `className`, and a part class on each element that a prop or slot fills or that
 * draws structure (an icon, a dismiss button, a track, a surface). Style them from your own CSS,
 * or build a typed selector from a constant (`` `.${buttonClassNames.icon}` ``). This module
 * imports nothing and holds string constants only, so a React Server Component can read it.
 *
 * - **Names.** A root is `wave-` plus the kebab-cased flat export name (`Button` → `wave-button`,
 *   `CardHeader` → `wave-card-header`); a part is the root, two underscores and the kebab-cased
 *   part key (`wave-button__icon`); a constant is the camel-cased flat name plus `ClassNames`
 *   (`cardHeaderClassNames`). WaveProvider and Portal keep their existing scope classes,
 *   `wave-root` and `wave-portal`.
 * - **Placement.** A component puts its root class first in its class list, so your `className`
 *   still wins a conflict; a slot part keeps its class when a slot object renders another element
 *   (`icon={{ as: 'img', … }}`).
 * - **Variants and nesting.** A variant also carries the classes of the component it is built on
 *   (ToggleButton's root is `wave-button wave-toggle-button`, its icon
 *   `wave-button__icon wave-toggle-button__icon`), and a public component rendered inside another
 *   also carries the parent's part class (SplitButton's halves are `wave-button` plus
 *   `wave-split-button__primary-action-button` or `wave-split-button__menu-button`).
 * - **No state classes.** State lives in `data-*` attributes and ARIA (`[data-pressed]`,
 *   `[data-disabled]`, `[aria-expanded='true']`).
 * - **Stability.** Before 1.0 no class is removed; a renamed part keeps its old class next to the
 *   new one until then.
 *
 * Not to be confused with the internal `buttonClassName()` helper of `buttonStyles.ts` (one
 * letter shorter), which returns Button's utility classes.
 */

// ---------------------------------------------------------------------------
// button
// ---------------------------------------------------------------------------

/**
 * Button: `root` on the rendered element (`<button>`, or your `as`); `icon` on the icon box.
 * Style them from your own CSS (`.wave-button`, `.wave-button__icon`). State is not a class: use
 * the `data-*` attributes (`[data-pressed]`, `[data-disabled]`).
 */
export const buttonClassNames = {
  root: 'wave-button',
  icon: 'wave-button__icon',
} as const;

/**
 * CompoundButton (also carries Button's root and icon classes): `root` on the rendered element;
 * `icon` on the icon box (Button's icon span in the icon-only layout); `contentContainer` on the
 * text column; `primaryText` on the main line; `secondaryText` on the second line.
 */
export const compoundButtonClassNames = {
  root: 'wave-compound-button',
  icon: 'wave-compound-button__icon',
  contentContainer: 'wave-compound-button__content-container',
  primaryText: 'wave-compound-button__primary-text',
  secondaryText: 'wave-compound-button__secondary-text',
} as const;

/**
 * ToggleButton (also carries Button's root and icon classes): `root` on the `<button>`; `icon` on
 * Button's icon span.
 */
export const toggleButtonClassNames = {
  root: 'wave-toggle-button',
  icon: 'wave-toggle-button__icon',
} as const;

/**
 * SplitButton: `root` on the `role="group"` element; `primaryActionButton` and `menuButton` on its
 * two Buttons (which also carry Button's root); `icon` on the primary half's icon span and
 * `menuIcon` on the menu half's (both also carry Button's icon class).
 */
export const splitButtonClassNames = {
  root: 'wave-split-button',
  primaryActionButton: 'wave-split-button__primary-action-button',
  menuButton: 'wave-split-button__menu-button',
  icon: 'wave-split-button__icon',
  menuIcon: 'wave-split-button__menu-icon',
} as const;

/**
 * MenuButton (also carries Button's root and icon classes): `root` on the `<button>`; `icon` on
 * Button's icon span; `menuIcon` on the default chevron `<svg>`, or on the span of your
 * `menuIcon`.
 */
export const menuButtonClassNames = {
  root: 'wave-menu-button',
  icon: 'wave-menu-button__icon',
  menuIcon: 'wave-menu-button__menu-icon',
} as const;

/** Link: `root` on the rendered element (`<a>`, or your `as`). */
export const linkClassNames = { root: 'wave-link' } as const;

/** Toolbar: `root` on the `role="toolbar"` element (your `as`, default `<div>`). */
export const toolbarClassNames = { root: 'wave-toolbar' } as const;

/**
 * Toolbar.Button (also carries Button's root and icon classes): `root` on the rendered element;
 * `icon` on Button's icon span (the icon box of `vertical`).
 */
export const toolbarButtonClassNames = {
  root: 'wave-toolbar-button',
  icon: 'wave-toolbar-button__icon',
} as const;

/**
 * Toolbar.ToggleButton (also carries the root and icon classes of Button and ToggleButton):
 * `root` on the `<button>`; `icon` on the icon span.
 */
export const toolbarToggleButtonClassNames = {
  root: 'wave-toolbar-toggle-button',
  icon: 'wave-toolbar-toggle-button__icon',
} as const;

/**
 * Toolbar.RadioButton (also carries the root and icon classes of Button and ToggleButton):
 * `root` on the `role="radio"` button; `icon` on the icon span.
 */
export const toolbarRadioButtonClassNames = {
  root: 'wave-toolbar-radio-button',
  icon: 'wave-toolbar-radio-button__icon',
} as const;

/** Toolbar.RadioGroup: `root` on the `role="radiogroup"` element. */
export const toolbarRadioGroupClassNames = { root: 'wave-toolbar-radio-group' } as const;

/** Toolbar.Group: `root` on the group element. */
export const toolbarGroupClassNames = { root: 'wave-toolbar-group' } as const;

/** Toolbar.Divider: `root` on the `role="separator"` element. */
export const toolbarDividerClassNames = { root: 'wave-toolbar-divider' } as const;

// ---------------------------------------------------------------------------
// data-display
// ---------------------------------------------------------------------------

/**
 * Avatar: `root` on the avatar span (with `badge`, on the outer wrapper); `visual` on the circle
 * (the root without `badge`, the inner span with it); `image` on the `<img>` (or the element of
 * your `image` slot); `icon` on the `icon` slot, else on the default person `<svg>`; `initials`
 * on the initials span; `badge` on the `badge` slot.
 */
export const avatarClassNames = {
  root: 'wave-avatar',
  visual: 'wave-avatar__visual',
  image: 'wave-avatar__image',
  icon: 'wave-avatar__icon',
  initials: 'wave-avatar__initials',
  badge: 'wave-avatar__badge',
} as const;

/**
 * AvatarGroup: `root` on the `role="group"` element; `item` on the wrapper around each shown
 * member; `overflowButton` on the "+N" button; `surface` on its popup; `list` on the popup's
 * `<ul>`; `listItem` on each of its `<li>`.
 */
export const avatarGroupClassNames = {
  root: 'wave-avatar-group',
  item: 'wave-avatar-group__item',
  overflowButton: 'wave-avatar-group__overflow-button',
  surface: 'wave-avatar-group__surface',
  list: 'wave-avatar-group__list',
  listItem: 'wave-avatar-group__list-item',
} as const;

/** Badge: `root` on the badge span. */
export const badgeClassNames = { root: 'wave-badge' } as const;

/**
 * CounterBadge (also carries Badge's root): `root` on the badge span (a count it does not show
 * renders no element).
 */
export const counterBadgeClassNames = { root: 'wave-counter-badge' } as const;

/** PresenceBadge: `root` on the `role="img"` span; `icon` on the status glyph `<svg>`. */
export const presenceBadgeClassNames = {
  root: 'wave-presence-badge',
  icon: 'wave-presence-badge__icon',
} as const;

/**
 * Tag: `root` on the rendered element (your `as`, default `<span>`); `primaryText` on the content
 * span; `dismissButton` on the Dismiss button; `dismissIcon` on the icon inside it (what
 * `dismissIcon` renders, a merged Button's icon span, else the default `<svg>`).
 */
export const tagClassNames = {
  root: 'wave-tag',
  primaryText: 'wave-tag__primary-text',
  dismissButton: 'wave-tag__dismiss-button',
  dismissIcon: 'wave-tag__dismiss-icon',
} as const;

/**
 * Persona: `root` on the persona element; `avatar` on the built-in Avatar (which also carries
 * Avatar's root and `visual` classes) or on your `avatar` slot; `badge` on the element that
 * places the badge; `primaryText` on the name; `secondaryText` on the second line.
 */
export const personaClassNames = {
  root: 'wave-persona',
  avatar: 'wave-persona__avatar',
  badge: 'wave-persona__badge',
  primaryText: 'wave-persona__primary-text',
  secondaryText: 'wave-persona__secondary-text',
} as const;

/**
 * Divider: `root` on the `<hr>` of a plain horizontal divider, else on the `role="separator"`
 * element (or your `as`); `line` on each of the two line elements of a labelled divider; `label`
 * on its label span.
 */
export const dividerClassNames = {
  root: 'wave-divider',
  line: 'wave-divider__line',
  label: 'wave-divider__label',
} as const;

/** InfoLabel: `root` on the outer span; `infoButton` on the info button; `info` on its popup. */
export const infoLabelClassNames = {
  root: 'wave-info-label',
  infoButton: 'wave-info-label__info-button',
  info: 'wave-info-label__info',
} as const;

/** Image: `root` on the `<img>`. */
export const imageClassNames = { root: 'wave-image' } as const;

/** List: `root` on the `<ul>` (the `role="grid"` element of a selectable list with actions). */
export const listClassNames = { root: 'wave-list' } as const;

/**
 * List.Item: `root` on the `<li>` (the `role="row"` element of a list with actions); `content` on
 * the content element; `action` on the action cell.
 */
export const listItemClassNames = {
  root: 'wave-list-item',
  content: 'wave-list-item__content',
  action: 'wave-list-item__action',
} as const;

// ---------------------------------------------------------------------------
// feedback
// ---------------------------------------------------------------------------

/**
 * MessageBar: `root` on the bar; `icon` on the status icon span; `body` on the text column (it
 * holds `MessageBar.Title`); `dismissButton` on the Dismiss button; `dismissIcon` on the icon
 * inside it (what `dismiss` renders, a merged Button's icon span, else the default `<svg>`).
 */
export const messageBarClassNames = {
  root: 'wave-message-bar',
  icon: 'wave-message-bar__icon',
  body: 'wave-message-bar__body',
  dismissButton: 'wave-message-bar__dismiss-button',
  dismissIcon: 'wave-message-bar__dismiss-icon',
} as const;

/** MessageBar.Title: `root` on the title span. */
export const messageBarTitleClassNames = { root: 'wave-message-bar-title' } as const;

/** MessageBar.Actions: `root` on the element that holds the actions. */
export const messageBarActionsClassNames = { root: 'wave-message-bar-actions' } as const;

/**
 * ProgressBar: `root` on the `role="progressbar"` element (the track); `bar` on the fill; `label`
 * on the label of `showLabel` (a sibling of the root).
 */
export const progressBarClassNames = {
  root: 'wave-progress-bar',
  bar: 'wave-progress-bar__bar',
  label: 'wave-progress-bar__label',
} as const;

/**
 * Spinner: `root` on the outer span; `spinner` on the ring; `label` on the label span (also while
 * only screen readers get it, without `labelVisible`).
 */
export const spinnerClassNames = {
  root: 'wave-spinner',
  spinner: 'wave-spinner__spinner',
  label: 'wave-spinner__label',
} as const;

/** Skeleton: `root` on the placeholder element. */
export const skeletonClassNames = { root: 'wave-skeleton' } as const;

/** Skeleton.Group: `root` on the group element. */
export const skeletonGroupClassNames = { root: 'wave-skeleton-group' } as const;

/**
 * Toast: `root` on the toast; `icon` on the status icon span (or your `icon` slot); `content` on
 * the text column that holds the title, body and footer; `dismissButton` on the Dismiss button.
 */
export const toastClassNames = {
  root: 'wave-toast',
  icon: 'wave-toast__icon',
  content: 'wave-toast__content',
  dismissButton: 'wave-toast__dismiss-button',
} as const;

/**
 * Toast.Title: `root` on the title row (also the one the `title` prop renders); `label` on the
 * title text, which names the toast; `action` on the `action` slot at the row's end.
 */
export const toastTitleClassNames = {
  root: 'wave-toast-title',
  label: 'wave-toast-title__label',
  action: 'wave-toast-title__action',
} as const;

/**
 * Toast.Body: `root` on the body element (also the one plain children render); `subtitle` on the
 * `subtitle` line inside it.
 */
export const toastBodyClassNames = {
  root: 'wave-toast-body',
  subtitle: 'wave-toast-body__subtitle',
} as const;

/** Toast.Footer: `root` on the row of actions. */
export const toastFooterClassNames = { root: 'wave-toast-footer' } as const;

/**
 * Toaster: `root` on the portaled toast region; `toast` on the `role="group"` container the
 * Toaster renders around each toast.
 */
export const toasterClassNames = {
  root: 'wave-toaster',
  toast: 'wave-toaster__toast',
} as const;

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

/**
 * Input: `root` on the `<input>`, or, with `contentBefore` or `contentAfter` content, on the
 * wrapper that draws the field; `input` on the `<input>` (also when it is the root);
 * `contentBefore` and `contentAfter` on the slot spans; `errorMessage` on the `role="alert"`
 * message after the control.
 */
export const inputClassNames = {
  root: 'wave-input',
  input: 'wave-input__input',
  contentBefore: 'wave-input__content-before',
  contentAfter: 'wave-input__content-after',
  errorMessage: 'wave-input__error-message',
} as const;

/** Textarea: `root` on the `<textarea>`; `errorMessage` on the message after it, as Input's. */
export const textareaClassNames = {
  root: 'wave-textarea',
  errorMessage: 'wave-textarea__error-message',
} as const;

/** Select: `root` on the `<select>`; `errorMessage` on the message after it, as Input's. */
export const selectClassNames = {
  root: 'wave-select',
  errorMessage: 'wave-select__error-message',
} as const;

/**
 * Field: `root` on the field element; `label` on the `<label>`; `required` on the asterisk;
 * `validationMessage` on the message; `validationMessageIcon` on its icon; `hint` on the hint.
 */
export const fieldClassNames = {
  root: 'wave-field',
  label: 'wave-field__label',
  required: 'wave-field__required',
  validationMessage: 'wave-field__validation-message',
  validationMessageIcon: 'wave-field__validation-message-icon',
  hint: 'wave-field__hint',
} as const;

/** Label: `root` on the `<label>`; `required` on the asterisk. */
export const labelClassNames = {
  root: 'wave-label',
  required: 'wave-label__required',
} as const;

/**
 * Checkbox: `root` on the `<label>`; `indicator` on the `role="checkbox"` button (the box);
 * `label` on the label text.
 */
export const checkboxClassNames = {
  root: 'wave-checkbox',
  indicator: 'wave-checkbox__indicator',
  label: 'wave-checkbox__label',
} as const;

/** RadioGroup: `root` on the `role="radiogroup"` element. */
export const radioGroupClassNames = { root: 'wave-radio-group' } as const;

/**
 * RadioGroup.Item: `root` on the `<label>` (where `className` lands; `ref` and the other props go
 * to the radio); `indicator` on the `role="radio"` button; `label` on the label text.
 */
export const radioGroupItemClassNames = {
  root: 'wave-radio-group-item',
  indicator: 'wave-radio-group-item__indicator',
  label: 'wave-radio-group-item__label',
} as const;

/**
 * Switch: `root` on the `<label>`; `track` on the `role="switch"` button; `thumb` on its thumb;
 * `label` on the label text.
 */
export const switchClassNames = {
  root: 'wave-switch',
  track: 'wave-switch__track',
  thumb: 'wave-switch__thumb',
  label: 'wave-switch__label',
} as const;

/**
 * SearchBox: `root` on the element that draws the field; `contentBefore` on the span that holds
 * the search icon or your slot; `input` on the `<input type="search">`; `contentAfter` on the span
 * that holds your slot; `dismissButton` on the clear button; `dismissIcon` on the icon inside it
 * (what `dismiss` renders, a merged Button's icon span, else the default `<svg>`).
 */
export const searchBoxClassNames = {
  root: 'wave-search-box',
  contentBefore: 'wave-search-box__content-before',
  input: 'wave-search-box__input',
  contentAfter: 'wave-search-box__content-after',
  dismissButton: 'wave-search-box__dismiss-button',
  dismissIcon: 'wave-search-box__dismiss-icon',
} as const;

/** Slider: `root` on the `<input type="range">` (its rail and thumb are pseudo-elements). */
export const sliderClassNames = { root: 'wave-slider' } as const;

/**
 * SpinButton: `root` on the outer element; `decrementButton` on the − button; `input` on the
 * `role="spinbutton"` input; `incrementButton` on the + button.
 */
export const spinButtonClassNames = {
  root: 'wave-spin-button',
  decrementButton: 'wave-spin-button__decrement-button',
  input: 'wave-spin-button__input',
  incrementButton: 'wave-spin-button__increment-button',
} as const;

/**
 * Option (also Combobox.Option and Dropdown.Option): `root` on the `role="option"` element;
 * `checkIcon` on the check `<svg>`; `content` on the content span.
 */
export const optionClassNames = {
  root: 'wave-option',
  checkIcon: 'wave-option__check-icon',
  content: 'wave-option__content',
} as const;

/**
 * OptionGroup (also Combobox.OptionGroup and Dropdown.OptionGroup): `root` on the group's entry
 * in the list; `label` on its heading; `list` on the `role="group"` list of its options.
 */
export const optionGroupClassNames = {
  root: 'wave-option-group',
  label: 'wave-option-group__label',
  list: 'wave-option-group__list',
} as const;

/**
 * Combobox: `root` on the outer element; `input` on the `role="combobox"` input; `clearButton` on
 * the clear button; `expandButton` on the expand button and `expandIcon` on its glyph; `listbox`
 * on the `role="listbox"` list; `surface` on its portaled popup; `emptyMessage` on the
 * "No matches" row.
 */
export const comboboxClassNames = {
  root: 'wave-combobox',
  input: 'wave-combobox__input',
  clearButton: 'wave-combobox__clear-button',
  expandButton: 'wave-combobox__expand-button',
  expandIcon: 'wave-combobox__expand-icon',
  listbox: 'wave-combobox__listbox',
  surface: 'wave-combobox__surface',
  emptyMessage: 'wave-combobox__empty-message',
} as const;

/**
 * Dropdown: `root` on the outer element; `button` on the `role="combobox"` button; `value` on the
 * value or placeholder span; `expandIcon` on the chevron `<svg>`; `clearButton` on the clear
 * button; `listbox` on the `role="listbox"` list; `surface` on its portaled popup.
 */
export const dropdownClassNames = {
  root: 'wave-dropdown',
  button: 'wave-dropdown__button',
  value: 'wave-dropdown__value',
  expandIcon: 'wave-dropdown__expand-icon',
  clearButton: 'wave-dropdown__clear-button',
  listbox: 'wave-dropdown__listbox',
  surface: 'wave-dropdown__surface',
} as const;

/**
 * TagPicker: `root` on the outer element; `control` on the tag area; `group` on the list of tags;
 * `tag` on each tag; `removeButton` on each tag's remove button; `input` on the `role="combobox"`
 * input; `listbox` on the `role="listbox"` list; `option` on each Option it renders (which also
 * carries Option's classes); `surface` on the portaled popup; `emptyMessage` on the "No matches"
 * row.
 */
export const tagPickerClassNames = {
  root: 'wave-tag-picker',
  control: 'wave-tag-picker__control',
  group: 'wave-tag-picker__group',
  tag: 'wave-tag-picker__tag',
  removeButton: 'wave-tag-picker__remove-button',
  input: 'wave-tag-picker__input',
  listbox: 'wave-tag-picker__listbox',
  option: 'wave-tag-picker__option',
  surface: 'wave-tag-picker__surface',
  emptyMessage: 'wave-tag-picker__empty-message',
} as const;

/**
 * TimePicker: `root` on the outer element; `input` on the `role="combobox"` input; `clearButton`
 * on the clear button; `expandButton` on the expand button and `expandIcon` on its glyph;
 * `errorMessage` on the `role="alert"` message; `listbox` on the `role="listbox"` list; `option`
 * on each option; `checkIcon` on each option's check column; `surface` on the portaled popup;
 * `emptyMessage` on its status row.
 */
export const timePickerClassNames = {
  root: 'wave-time-picker',
  input: 'wave-time-picker__input',
  clearButton: 'wave-time-picker__clear-button',
  expandButton: 'wave-time-picker__expand-button',
  expandIcon: 'wave-time-picker__expand-icon',
  errorMessage: 'wave-time-picker__error-message',
  listbox: 'wave-time-picker__listbox',
  option: 'wave-time-picker__option',
  checkIcon: 'wave-time-picker__check-icon',
  surface: 'wave-time-picker__surface',
  emptyMessage: 'wave-time-picker__empty-message',
} as const;

/**
 * DatePicker: `root` on the outer element; `input` on the text input; `clearButton` on the clear
 * button; `openCalendarButton` on the calendar button; `errorMessage` on the `role="alert"`
 * message; `surface` on the portaled `role="dialog"` calendar; `header` on its month row;
 * `previousMonthButton` and `nextMonthButton` on the month buttons; `heading` on the month
 * `<h2>`; `grid` on the calendar's `role="grid"` element; `weekday` on each weekday header cell;
 * `day` on each day button.
 */
export const datePickerClassNames = {
  root: 'wave-date-picker',
  input: 'wave-date-picker__input',
  clearButton: 'wave-date-picker__clear-button',
  openCalendarButton: 'wave-date-picker__open-calendar-button',
  errorMessage: 'wave-date-picker__error-message',
  surface: 'wave-date-picker__surface',
  header: 'wave-date-picker__header',
  previousMonthButton: 'wave-date-picker__previous-month-button',
  heading: 'wave-date-picker__heading',
  nextMonthButton: 'wave-date-picker__next-month-button',
  grid: 'wave-date-picker__grid',
  weekday: 'wave-date-picker__weekday',
  day: 'wave-date-picker__day',
} as const;

/** SwatchPicker: `root` on the `role="radiogroup"` element; `swatch` on each `role="radio"` button. */
export const swatchPickerClassNames = {
  root: 'wave-swatch-picker',
  swatch: 'wave-swatch-picker__swatch',
} as const;

/**
 * ColorPicker: `root` on the `role="group"` element; `opacityLabel` on the caption and
 * `opacityValue` on the percentage of the default layout's opacity row. Its color area and
 * sliders carry their own classes (ColorArea, ColorSlider, AlphaSlider).
 */
export const colorPickerClassNames = {
  root: 'wave-color-picker',
  opacityLabel: 'wave-color-picker__opacity-label',
  opacityValue: 'wave-color-picker__opacity-value',
} as const;

/**
 * ColorPicker.HexField: `root` on the field's outer element; `label` on the caption; `input` on
 * the hex `<input>`; `errorMessage` on the error text.
 */
export const colorPickerHexFieldClassNames = {
  root: 'wave-color-picker-hex-field',
  label: 'wave-color-picker-hex-field__label',
  input: 'wave-color-picker-hex-field__input',
  errorMessage: 'wave-color-picker-hex-field__error-message',
} as const;

/**
 * ColorPicker.Swatches (also carries SwatchPicker's root): `root` on the SwatchPicker it renders;
 * its swatches keep SwatchPicker's own `swatch` class.
 */
export const colorPickerSwatchesClassNames = { root: 'wave-color-picker-swatches' } as const;

/** ColorPicker.Preview: `root` on the preview swatch. */
export const colorPickerPreviewClassNames = { root: 'wave-color-picker-preview' } as const;

/**
 * ColorArea: `root` on the `role="group"` element; `field` on the gradient layer; `thumb` on the
 * thumb (the two range inputs are not parts).
 */
export const colorAreaClassNames = {
  root: 'wave-color-area',
  field: 'wave-color-area__field',
  thumb: 'wave-color-area__thumb',
} as const;

/** ColorSlider: `root` on the slider element; `rail` on the gradient rail; `thumb` on the thumb. */
export const colorSliderClassNames = {
  root: 'wave-color-slider',
  rail: 'wave-color-slider__rail',
  thumb: 'wave-color-slider__thumb',
} as const;

/** AlphaSlider: `root` on the slider element; `rail` on the rail; `thumb` on the thumb. */
export const alphaSliderClassNames = {
  root: 'wave-alpha-slider',
  rail: 'wave-alpha-slider__rail',
  thumb: 'wave-alpha-slider__thumb',
} as const;

/**
 * Rating: `root` on the `role="radiogroup"` element; `star` on each `role="radio"` button; `icon`
 * on each star `<svg>`.
 */
export const ratingClassNames = {
  root: 'wave-rating',
  star: 'wave-rating__star',
  icon: 'wave-rating__icon',
} as const;

/**
 * RatingDisplay: `root` on the `role="img"` element; `star` on each star span; `icon` on the star
 * `<svg>` elements; `value` on the value span; `count` on the count span.
 */
export const ratingDisplayClassNames = {
  root: 'wave-rating-display',
  star: 'wave-rating-display__star',
  icon: 'wave-rating-display__icon',
  value: 'wave-rating-display__value',
  count: 'wave-rating-display__count',
} as const;

// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------

/**
 * Card: `root` on the rendered element (your `as`, default `<div>`); `checkbox` on the built-in
 * selection checkbox; `checkmark` on the corner check `<svg>` of a selected card.
 */
export const cardClassNames = {
  root: 'wave-card',
  checkbox: 'wave-card__checkbox',
  checkmark: 'wave-card__checkmark',
} as const;

/** Card.Header: `root` on the rendered element; `title` on the title; `subtitle` on the subtitle. */
export const cardHeaderClassNames = {
  root: 'wave-card-header',
  title: 'wave-card-header__title',
  subtitle: 'wave-card-header__subtitle',
} as const;

/** Card.Body: `root` on the rendered element. */
export const cardBodyClassNames = { root: 'wave-card-body' } as const;

/** Card.Footer: `root` on the rendered element. */
export const cardFooterClassNames = { root: 'wave-card-footer' } as const;

/** Accordion: `root` on the accordion element. */
export const accordionClassNames = { root: 'wave-accordion' } as const;

/** Accordion.Item: `root` on the item element. */
export const accordionItemClassNames = { root: 'wave-accordion-item' } as const;

/**
 * Accordion.Trigger: `root` on the `<button>`; `heading` on the heading element around it (`<h1>`
 * to `<h6>`, from `headingLevel`); `expandIcon` on the chevron `<svg>`.
 */
export const accordionTriggerClassNames = {
  root: 'wave-accordion-trigger',
  heading: 'wave-accordion-trigger__heading',
  expandIcon: 'wave-accordion-trigger__expand-icon',
} as const;

/** Accordion.Panel: `root` on the `role="region"` element. */
export const accordionPanelClassNames = { root: 'wave-accordion-panel' } as const;

/** TabList: `root` on the `role="tablist"` element. */
export const tabListClassNames = { root: 'wave-tab-list' } as const;

/** TabList.Tab: `root` on the `role="tab"` button. */
export const tabListTabClassNames = { root: 'wave-tab-list-tab' } as const;

/** TabList.Panel: `root` on the `role="tabpanel"` element. */
export const tabListPanelClassNames = { root: 'wave-tab-list-panel' } as const;

/** TabList.Panels: `root` on the element around the panels. */
export const tabListPanelsClassNames = { root: 'wave-tab-list-panels' } as const;

/** Tree: `root` on the `role="tree"` element. */
export const treeClassNames = { root: 'wave-tree' } as const;

/**
 * Tree.Item: `root` on the `role="treeitem"` element; `row` on its row; `expandIcon` on the
 * chevron (or your `expandIcon`); `indicator` on the checkbox of a multi-select tree or the radio
 * of a single-select one; `icon` on the icon span; `label` on the label span; `iconAfter` on the
 * icon after the label; `aside` on the aside content; `actions` on the row's actions toolbar;
 * `group` on the `role="group"` element of its nested items.
 */
export const treeItemClassNames = {
  root: 'wave-tree-item',
  row: 'wave-tree-item__row',
  expandIcon: 'wave-tree-item__expand-icon',
  indicator: 'wave-tree-item__indicator',
  icon: 'wave-tree-item__icon',
  label: 'wave-tree-item__label',
  iconAfter: 'wave-tree-item__icon-after',
  aside: 'wave-tree-item__aside',
  actions: 'wave-tree-item__actions',
  group: 'wave-tree-item__group',
} as const;

/**
 * Tree.ItemPersonaLayout: `root` on the layout span; `media` on the picture; `main` on the name;
 * `description` on the description line.
 */
export const treeItemPersonaLayoutClassNames = {
  root: 'wave-tree-item-persona-layout',
  media: 'wave-tree-item-persona-layout__media',
  main: 'wave-tree-item-persona-layout__main',
  description: 'wave-tree-item-persona-layout__description',
} as const;

/**
 * Carousel: `root` on the `role="region"` element; `autoPlayButton` on the pause and start
 * button; `track` on the moving element around the slides; `slide` on each slide wrapper;
 * `previousButton` and `nextButton` on the arrow buttons; `picker` on the `role="group"` of
 * picker buttons; `pickerButton` on each of them; `pickerIndicator` on each button's dot.
 */
export const carouselClassNames = {
  root: 'wave-carousel',
  autoPlayButton: 'wave-carousel__auto-play-button',
  track: 'wave-carousel__track',
  slide: 'wave-carousel__slide',
  previousButton: 'wave-carousel__previous-button',
  nextButton: 'wave-carousel__next-button',
  picker: 'wave-carousel__picker',
  pickerButton: 'wave-carousel__picker-button',
  pickerIndicator: 'wave-carousel__picker-indicator',
} as const;

/** Carousel.Item: `root` on the item element. */
export const carouselItemClassNames = { root: 'wave-carousel-item' } as const;

/**
 * Overflow: `root` on the overflow element; `overflowButton` on the element around what
 * `overflowButton` renders.
 */
export const overflowClassNames = {
  root: 'wave-overflow',
  overflowButton: 'wave-overflow__overflow-button',
} as const;

/** Overflow.Item: `root` on the item element. */
export const overflowItemClassNames = { root: 'wave-overflow-item' } as const;

/** Stack: `root` on the rendered element. */
export const stackClassNames = { root: 'wave-stack' } as const;

/** Flex: `root` on the rendered element. */
export const flexClassNames = { root: 'wave-flex' } as const;

/** Grid: `root` on the rendered element. */
export const gridClassNames = { root: 'wave-grid' } as const;

// ---------------------------------------------------------------------------
// navigation
// ---------------------------------------------------------------------------

/**
 * Breadcrumb: `root` on the `<nav>`; `list` on its `<ol>`; `listItem` on each `<li>`; `divider`
 * on each separator `<svg>`.
 */
export const breadcrumbClassNames = {
  root: 'wave-breadcrumb',
  list: 'wave-breadcrumb__list',
  listItem: 'wave-breadcrumb__list-item',
  divider: 'wave-breadcrumb__divider',
} as const;

/**
 * Breadcrumb.Item: `root` on the link, button or text span it renders (or your `asChild`
 * element); `icon` on the icon span.
 */
export const breadcrumbItemClassNames = {
  root: 'wave-breadcrumb-item',
  icon: 'wave-breadcrumb-item__icon',
} as const;

/** Menu: `root` on the `role="menu"` element of a static menu (a popup menu has Menu.Popover's). */
export const menuClassNames = { root: 'wave-menu' } as const;

/**
 * Menu.Item: `root` on the `role="menuitem"` element; `checkmark` on the check column; `icon` on
 * the icon span; `content` on the label span; `shortcut` on the shortcut span;
 * `submenuIndicator` on the chevron `<svg>` of a submenu trigger.
 */
export const menuItemClassNames = {
  root: 'wave-menu-item',
  checkmark: 'wave-menu-item__checkmark',
  icon: 'wave-menu-item__icon',
  content: 'wave-menu-item__content',
  shortcut: 'wave-menu-item__shortcut',
  submenuIndicator: 'wave-menu-item__submenu-indicator',
} as const;

/**
 * Menu.ItemCheckbox (also carries Menu.Item's root and matching part classes): `root` on the
 * `role="menuitemcheckbox"` element; `checkmark`, `icon`, `content` and `shortcut` as on
 * Menu.Item.
 */
export const menuItemCheckboxClassNames = {
  root: 'wave-menu-item-checkbox',
  checkmark: 'wave-menu-item-checkbox__checkmark',
  icon: 'wave-menu-item-checkbox__icon',
  content: 'wave-menu-item-checkbox__content',
  shortcut: 'wave-menu-item-checkbox__shortcut',
} as const;

/**
 * Menu.ItemRadio (also carries Menu.Item's root and matching part classes): `root` on the
 * `role="menuitemradio"` element; `checkmark`, `icon`, `content` and `shortcut` as on Menu.Item.
 */
export const menuItemRadioClassNames = {
  root: 'wave-menu-item-radio',
  checkmark: 'wave-menu-item-radio__checkmark',
  icon: 'wave-menu-item-radio__icon',
  content: 'wave-menu-item-radio__content',
  shortcut: 'wave-menu-item-radio__shortcut',
} as const;

/**
 * Menu.ItemSwitch (also carries Menu.Item's root, `icon`, `content` and `shortcut` classes):
 * `root` on the `role="menuitemcheckbox"` element; `icon`, `content` and `shortcut` as on
 * Menu.Item; `track` on the switch; `thumb` on its thumb.
 */
export const menuItemSwitchClassNames = {
  root: 'wave-menu-item-switch',
  icon: 'wave-menu-item-switch__icon',
  content: 'wave-menu-item-switch__content',
  shortcut: 'wave-menu-item-switch__shortcut',
  track: 'wave-menu-item-switch__track',
  thumb: 'wave-menu-item-switch__thumb',
} as const;

/**
 * Menu.ItemLink (also carries Menu.Item's root and matching part classes): `root` on the
 * `role="menuitem"` link (`<a>`, or your `as`); `icon`, `content` and `shortcut` as on Menu.Item.
 */
export const menuItemLinkClassNames = {
  root: 'wave-menu-item-link',
  icon: 'wave-menu-item-link__icon',
  content: 'wave-menu-item-link__content',
  shortcut: 'wave-menu-item-link__shortcut',
} as const;

/** Menu.Divider: `root` on the `role="separator"` element. */
export const menuDividerClassNames = { root: 'wave-menu-divider' } as const;

/** Menu.Popover: `root` on the portaled `role="menu"` element. */
export const menuPopoverClassNames = { root: 'wave-menu-popover' } as const;

/** Menu.Group: `root` on the `role="group"` element. */
export const menuGroupClassNames = { root: 'wave-menu-group' } as const;

/** Menu.GroupHeader: `root` on the header element. */
export const menuGroupHeaderClassNames = { root: 'wave-menu-group-header' } as const;

/** Menu.SplitGroup: `root` on the `role="group"` element. */
export const menuSplitGroupClassNames = { root: 'wave-menu-split-group' } as const;

/** Nav: `root` on the `<nav>`; `list` on its `<ul>`. */
export const navClassNames = {
  root: 'wave-nav',
  list: 'wave-nav__list',
} as const;

/**
 * Nav.Category: `root` on its `<li>`; `button` on the toggle button; `icon` on the icon span;
 * `label` on the label span; `expandIcon` on the chevron `<svg>`; `list` on the `<ul>` of its
 * sub-items.
 */
export const navCategoryClassNames = {
  root: 'wave-nav-category',
  button: 'wave-nav-category__button',
  icon: 'wave-nav-category__icon',
  label: 'wave-nav-category__label',
  expandIcon: 'wave-nav-category__expand-icon',
  list: 'wave-nav-category__list',
} as const;

/**
 * Nav.Item: `root` on the `<a>` (with `href`) or `<button>`; `listItem` on the `<li>` around it;
 * `icon` on the icon span; `content` on the label span.
 */
export const navItemClassNames = {
  root: 'wave-nav-item',
  listItem: 'wave-nav-item__list-item',
  icon: 'wave-nav-item__icon',
  content: 'wave-nav-item__content',
} as const;

/** Nav.SubItem: `root` on the `<a>` or `<button>`; `listItem` on the `<li>` around it. */
export const navSubItemClassNames = {
  root: 'wave-nav-sub-item',
  listItem: 'wave-nav-sub-item__list-item',
} as const;

/**
 * Pagination: `root` on the `<nav>`; `list` on its `<ol>`; `listItem` on each `<li>`;
 * `firstButton`, `previousButton`, `pageButton`, `nextButton` and `lastButton` on its buttons;
 * `ellipsis` on each "…" span.
 */
export const paginationClassNames = {
  root: 'wave-pagination',
  list: 'wave-pagination__list',
  listItem: 'wave-pagination__list-item',
  firstButton: 'wave-pagination__first-button',
  previousButton: 'wave-pagination__previous-button',
  pageButton: 'wave-pagination__page-button',
  nextButton: 'wave-pagination__next-button',
  lastButton: 'wave-pagination__last-button',
  ellipsis: 'wave-pagination__ellipsis',
} as const;

/** Stepper: `root` on the `role="group"` element; `list` on its `<ol>`. */
export const stepperClassNames = {
  root: 'wave-stepper',
  list: 'wave-stepper__list',
} as const;

/**
 * Stepper.Step: `root` on the step's element inside its `<li>`; `listItem` on the `<li>`; `button`
 * on the `role="button"` element; `indicator` on the circle; `icon` on the `icon` slot inside it;
 * `label` on the label; `description` on the description; `connector` on the line to the next
 * step.
 */
export const stepperStepClassNames = {
  root: 'wave-stepper-step',
  listItem: 'wave-stepper-step__list-item',
  button: 'wave-stepper-step__button',
  indicator: 'wave-stepper-step__indicator',
  icon: 'wave-stepper-step__icon',
  label: 'wave-stepper-step__label',
  description: 'wave-stepper-step__description',
  connector: 'wave-stepper-step__connector',
} as const;

// ---------------------------------------------------------------------------
// overlays
// ---------------------------------------------------------------------------

/**
 * Dialog.Content: `root` on the surface (`role="dialog"` or `"alertdialog"`); `backdrop` on the
 * backdrop around it; `closeButton` on the built-in Close button (which also carries Button's
 * root); `body` on the scrolling body. The heading of its `title` prop carries Dialog.Title's
 * class.
 */
export const dialogContentClassNames = {
  root: 'wave-dialog-content',
  backdrop: 'wave-dialog-content__backdrop',
  closeButton: 'wave-dialog-content__close-button',
  body: 'wave-dialog-content__body',
} as const;

/** Dialog.Title: `root` on the `<h2>`. */
export const dialogTitleClassNames = { root: 'wave-dialog-title' } as const;

/** Dialog.Footer: `root` on the footer element. */
export const dialogFooterClassNames = { root: 'wave-dialog-footer' } as const;

/**
 * Popover.Content: `root` on the portaled `role="dialog"` surface; `beak` on the arrow; `title`
 * on the `<h2>` of `title`.
 */
export const popoverContentClassNames = {
  root: 'wave-popover-content',
  beak: 'wave-popover-content__beak',
  title: 'wave-popover-content__title',
} as const;

/** Tooltip: `root` on the span around your child; `content` on the portaled tooltip. */
export const tooltipClassNames = {
  root: 'wave-tooltip',
  content: 'wave-tooltip__content',
} as const;

/**
 * Drawer: `root` on the portaled panel (`role="dialog"`, while open); `backdrop` on the backdrop;
 * `header` on the header row; `closeButton` on the Close button (which also carries Button's
 * root); `body` on the scrolling body. The heading of its `title` prop carries Drawer.Title's
 * class.
 */
export const drawerClassNames = {
  root: 'wave-drawer',
  backdrop: 'wave-drawer__backdrop',
  header: 'wave-drawer__header',
  closeButton: 'wave-drawer__close-button',
  body: 'wave-drawer__body',
} as const;

/** Drawer.Title: `root` on the `<h2>`. */
export const drawerTitleClassNames = { root: 'wave-drawer-title' } as const;

/**
 * TeachingPopover: `root` on the `role="dialog"` surface; `beak` on the arrow; `closeButton`,
 * `backButton` and `nextButton` on its buttons (which also carry Button's root); `title` on the
 * `<h3>`; `body` on the step body; `footer` on the bottom row; `dot` on each step dot.
 */
export const teachingPopoverClassNames = {
  root: 'wave-teaching-popover',
  beak: 'wave-teaching-popover__beak',
  closeButton: 'wave-teaching-popover__close-button',
  title: 'wave-teaching-popover__title',
  body: 'wave-teaching-popover__body',
  footer: 'wave-teaching-popover__footer',
  dot: 'wave-teaching-popover__dot',
  backButton: 'wave-teaching-popover__back-button',
  nextButton: 'wave-teaching-popover__next-button',
} as const;

// ---------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------

/** Table: `root` on the `<table>`; `container` on the scroll wrapper around it. */
export const tableClassNames = {
  root: 'wave-table',
  container: 'wave-table__container',
} as const;

/** Table.Header (and the deprecated Table.Head): `root` on the `<thead>`. */
export const tableHeaderClassNames = { root: 'wave-table-header' } as const;

/** Table.HeaderCell (and the deprecated Table.HeadCell): `root` on the `<th>`. */
export const tableHeaderCellClassNames = { root: 'wave-table-header-cell' } as const;

/** Table.Body: `root` on the `<tbody>`. */
export const tableBodyClassNames = { root: 'wave-table-body' } as const;

/** Table.Row: `root` on the `<tr>`. */
export const tableRowClassNames = { root: 'wave-table-row' } as const;

/** Table.Cell: `root` on the `<td>`. */
export const tableCellClassNames = { root: 'wave-table-cell' } as const;

/** DataGrid: `root` on the grid element (`role="grid"`); `container` on the wrapper around it. */
export const dataGridClassNames = {
  root: 'wave-data-grid',
  container: 'wave-data-grid__container',
} as const;

/**
 * DataGrid.Header: `root` on the `<thead>`; `selectionCell` on the selection column's cell of
 * each header row; `selectAllCheckbox` on its checkbox.
 */
export const dataGridHeaderClassNames = {
  root: 'wave-data-grid-header',
  selectionCell: 'wave-data-grid-header__selection-cell',
  selectAllCheckbox: 'wave-data-grid-header__select-all-checkbox',
} as const;

/**
 * DataGrid.HeaderCell: `root` on the `<th>`; `button` on the sort button; `sortIcon` on its
 * direction `<svg>`.
 */
export const dataGridHeaderCellClassNames = {
  root: 'wave-data-grid-header-cell',
  button: 'wave-data-grid-header-cell__button',
  sortIcon: 'wave-data-grid-header-cell__sort-icon',
} as const;

/** DataGrid.Body: `root` on the `<tbody>`. */
export const dataGridBodyClassNames = { root: 'wave-data-grid-body' } as const;

/**
 * DataGrid.Row: `root` on the `<tr>`; `selectionCell` on its selection cell; `selectionControl`
 * on the checkbox or radio in it.
 */
export const dataGridRowClassNames = {
  root: 'wave-data-grid-row',
  selectionCell: 'wave-data-grid-row__selection-cell',
  selectionControl: 'wave-data-grid-row__selection-control',
} as const;

/** DataGrid.Cell: `root` on the `role="gridcell"` cell. */
export const dataGridCellClassNames = { root: 'wave-data-grid-cell' } as const;

// ---------------------------------------------------------------------------
// typography, provider, portal
// ---------------------------------------------------------------------------

/** Text: `root` on the rendered element (your `as`, default `<span>`). */
export const textClassNames = { root: 'wave-text' } as const;

/** WaveProvider: `root` on the themed element (the existing `wave-root` scope class). */
export const waveProviderClassNames = { root: 'wave-root' } as const;

/**
 * Portal: `root` on the portal wrapper (the existing `wave-portal` scope class; the wrapper also
 * takes your `className`).
 */
export const portalClassNames = { root: 'wave-portal' } as const;
```

- [ ] **Step 4: Run the test: only the entry export still fails**

Run: `npx vitest run src/__tests__/classNames.test.ts`
Expected: FAIL in one test only, "is exported from the package entry with the same values", with every constant name listed (`accordionClassNames`, …, `waveProviderClassNames`); every formula, server-safety and tailwind-merge test passes. If a formula test fails, the registry above was mistyped: fix the listed key, never the test.

- [ ] **Step 5: Export the registry from the package entry**

In `src/index.ts`, in the `// Utilities` block, after `export { mergeRefs } from './lib/mergeRefs';`, add:

```ts
export * from './lib/classNames';
```

- [ ] **Step 6: Run the test again**

Run: `npx vitest run src/__tests__/classNames.test.ts`
Expected: PASS (every test).

- [ ] **Step 7: Add the public types and the pending list**

In `src/__tests__/public-types.test.ts`:

1. Add three names to the `import type { … } from '../index'` list, in its case-insensitive order: `buttonClassNames` before `ButtonProps`, `toggleButtonClassNames` before `ToggleButtonProps`, `waveProviderClassNames` after `WaveDir`. (A value imported with `import type` can be used in `typeof`, which is all these tests need.)

2. After the `INTERNAL_HELPERS` constant (it ends at `:305`), add:

```ts
/**
 * Public types of Fluent parity phase 3 (spec §4.3, §0.2 rule 24) that a wave-B prop reaches
 * before INTEGRATION (wave C) exports them from the barrels: the walk skips them by name (the part
 * after `#` of a label). INTEGRATION empties the list; a later phase fills it the same way.
 */
const PENDING_PUBLIC_TYPES: readonly string[] = [
  'AlphaSliderLabels',
  'AlphaSliderProps',
  'ColorAreaLabels',
  'ColorAreaProps',
  'ColorPickerHexFieldProps',
  'ColorPickerPreviewProps',
  'ColorPickerSwatchesProps',
  'ColorSliderLabels',
  'ColorSliderProps',
  'MessageBarActionsProps',
  'MessageBarTitleProps',
  'ToastBodyProps',
  'ToastCloseProps',
  'ToastCloseRenderProps',
  'ToastDispatchOptions',
  'ToastFooterProps',
  'ToastTitleProps',
  'ToasterHandle',
  'ToasterShortcuts',
  'TreeCheckedItemsChangeDetails',
  'TreeItemPersonaLayoutProps',
  'TreeLabels',
];

/** `components/feedback/Toaster.tsx#ToastDispatchOptions` → `ToastDispatchOptions`. */
const typeNameOf = (label: string): string => label.slice(label.indexOf('#') + 1);
```

3. Replace the walk test at `:411-413`:

```ts
  it('exports every named type that a public declaration refers to', () => {
    expect(getUnexported().filter((label) => !(label in INTERNAL_HELPERS))).toEqual([]);
  }, 60_000);
```

with:

```ts
  it('exports every named type that a public declaration refers to', () => {
    expect(
      getUnexported().filter(
        (label) => !(label in INTERNAL_HELPERS) && !PENDING_PUBLIC_TYPES.includes(typeNameOf(label)),
      ),
    ).toEqual([]);
  }, 60_000);

  it('keeps PENDING_PUBLIC_TYPES sorted and free of duplicates', () => {
    expect(PENDING_PUBLIC_TYPES).toEqual([...new Set(PENDING_PUBLIC_TYPES)].sort());
  });
```

4. At the end of the file, add:

```ts
describe('0.8 stable class names from the package entry', () => {
  it('the registry constants are readonly objects of string literal types', () => {
    expectTypeOf<(typeof buttonClassNames)['root']>().toEqualTypeOf<'wave-button'>();
    expectTypeOf<(typeof buttonClassNames)['icon']>().toEqualTypeOf<'wave-button__icon'>();
    expectTypeOf<typeof toggleButtonClassNames>().toHaveProperty('icon');
    expectTypeOf<(typeof waveProviderClassNames)['root']>().toEqualTypeOf<'wave-root'>();
    const assignRoot = (constants: typeof buttonClassNames) => {
      // @ts-expect-error: the constants are `as const`, so their keys are readonly.
      constants.root = 'wave-button';
    };
    expectTypeOf(assignRoot).toBeFunction();
  });
});
```

- [ ] **Step 8: Run the public-type tests and the dev program**

Run: `npx vitest run src/__tests__/public-types.test.ts`
Expected: PASS (the walk finds no pending name yet; the list is sorted).

Run: `npx tsc -p tsconfig.dev.json --noEmit`
Expected: no errors (the `@ts-expect-error` line is used: assigning to a readonly key is an error).

- [ ] **Step 9: Check that the CSS build reads no utility from the registry**

Tailwind reads every word under `src/lib`, and `scripts/build-css.mjs` fails on a generated class that no library string uses.

Run: `node scripts/build-css.mjs --out-dir node_modules/.cache/wave-css-a1`
Expected: exit 0. If it reports a class that no class string of the library uses, the word comes from a comment of `src/lib/classNames.ts`: rephrase that comment (name the element by its role) and run the command again; do not touch `src/styles/styles.css` (not this package's file).

- [ ] **Step 10: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx eslint src/lib/classNames.ts src/index.ts src/__tests__/classNames.test.ts src/__tests__/public-types.test.ts --max-warnings 0
```
Expected: no errors, no warnings.

- [ ] **Step 11: Commit**

```bash
git add src/lib/classNames.ts src/index.ts src/__tests__/classNames.test.ts src/__tests__/public-types.test.ts
git commit -m "feat(lib): stable class-name registry, exported from the package entry"
```

---

### Task A2: `withPartClass` for the variants' part classes

**Files:**
- Modify: `src/components/button/Button.slots.tsx` (module header, imports, a new export after `mergedAriaDisabledClasses`)
- Modify: `src/components/button/Toolbar.parts.tsx:1-72` (imports and `withIconBox`) and `:99` (the `icon=` line of `ToolbarButton`)
- Test: `src/components/button/__tests__/Button.slots.test.tsx`

**Interfaces:**
- Consumes: `resolveSlot`, `slotRendersContent` and the `Slot`/`SlotObject` types from `src/lib/slot.ts`.
- Produces: `export function withPartClass(slot: Slot<'span'> | undefined, className: string): Slot<'span'> | undefined` from `src/components/button/Button.slots.tsx`. Task A4 uses it in ToggleButton, CompoundButton, MenuButton, SplitButton and the Toolbar buttons (`icon={withPartClass(icon, toggleButtonClassNames.icon)}`).

- [ ] **Step 1: Write the failing tests**

In `src/components/button/__tests__/Button.slots.test.tsx`, add `withPartClass` to the import from `'../Button.slots'`, add `import { renderSlot } from '../../../lib/slot';`, and append this `describe` inside `describe('Button.slots', …)`:

```tsx
  describe('withPartClass', () => {
    const part = 'wave-test-part';

    it('wraps shorthand content in a span that carries the class', () => {
      render(<>{renderSlot(withPartClass(<svg data-testid="glyph" />, part), 'span', 'base')}</>);
      const box = screen.getByTestId('glyph').parentElement;
      expect(box?.tagName).toBe('SPAN');
      expect(box?.className).toBe(`base ${part}`);
    });

    it("keeps a slot object's element, attributes, ref and own classes, the part class before its own", () => {
      const ref = React.createRef<HTMLElement>();
      const slot = { as: 'i', className: 'custom', title: 'Bold', ref, children: 'B' } as Slot<'span'>;
      render(<>{renderSlot(withPartClass(slot, part), 'span', 'base')}</>);
      const el = screen.getByTitle('Bold');
      expect(el.tagName).toBe('I');
      expect(el.className).toBe(`base ${part} custom`);
      expect(el).toHaveTextContent('B');
      expect(ref.current).toBe(el);
    });

    it('keeps the void element of a slot object, without children', () => {
      const slot = { as: 'img', src: 'data:,', alt: 'Logo' } as Slot<'span'>;
      render(<>{renderSlot(withPartClass(slot, part), 'span')}</>);
      expect(screen.getByRole('img', { name: 'Logo' })).toHaveClass(part);
    });

    it('applies twice without a second wrapper (a variant of a variant)', () => {
      const icon = withPartClass(
        withPartClass(<svg data-testid="glyph" />, 'wave-test-inner'),
        'wave-test-outer',
      );
      const { container } = render(<>{renderSlot(icon, 'span', 'base')}</>);
      const box = screen.getByTestId('glyph').parentElement;
      expect(box?.className).toBe('base wave-test-outer wave-test-inner');
      expect(box?.parentElement).toBe(container);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['false', false],
      ["''", ''],
      ['[]', []],
      ['<></>', <></>],
    ])('returns %s unchanged: it renders nothing, so no empty icon element appears', (_name, slot) => {
      expect(withPartClass(slot as Slot<'span'>, part)).toBe(slot);
    });

    it('treats 0 as content', () => {
      const { container } = render(<>{renderSlot(withPartClass(0, part), 'span')}</>);
      expect(container.querySelector(`.${part}`)).toHaveTextContent('0');
    });

    it('reads a generator once, so a second render shows the same items', () => {
      function* glyphs() {
        yield <svg key="glyph" data-testid="generated-glyph" />;
      }
      const slot = withPartClass(glyphs(), part);
      const { rerender } = render(<>{renderSlot(slot, 'span')}</>);
      rerender(<>{renderSlot(slot, 'span')}</>);
      expect(screen.getByTestId('generated-glyph').parentElement).toHaveClass(part);
    });

    it("becomes a Button's decorative icon span, with the class", () => {
      render(<Button icon={withPartClass(<svg data-testid="glyph" />, part)}>Bold</Button>);
      const span = screen.getByTestId('glyph').parentElement;
      expect(span).toHaveClass(part);
      expect(span).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('button', { name: 'Bold' })).toContainElement(span);
    });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/button/__tests__/Button.slots.test.tsx -t "withPartClass"`
Expected: FAIL — `withPartClass is not a function` (the export does not exist yet; TypeScript-aware runs also report the missing export).

- [ ] **Step 3: Implement `withPartClass`**

In `src/components/button/Button.slots.tsx`:

1. Add a bullet to the module header, after the "Glyph slots inside a wired button …" bullet:

```ts
 * - Variants that hand their `icon` to Button (ToggleButton, CompoundButton, MenuButton,
 *   SplitButton, the Toolbar buttons) add their part class to it: {@link withPartClass}.
```

2. Replace `import type { Slot } from '../../lib/slot';` with:

```ts
import { resolveSlot, slotRendersContent } from '../../lib/slot';
import type { Slot, SlotObject } from '../../lib/slot';
```

3. After the `mergedAriaDisabledClasses` constant, add:

```ts
/**
 * `slot` as a slot object whose element also carries `className`: a variant's part class on the
 * icon that Button draws (`icon={withPartClass(icon, toggleButtonClassNames.icon)}`), so Button's
 * icon span carries both components' classes and Button needs no class prop of its own.
 * Shorthand content becomes the children of a `<span>` with the class; a slot object keeps its
 * element, attributes, `ref` and own classes, with `className` before them (so the consumer's
 * class still wins a conflict). A slot that renders nothing (`null`, `false`, `''`, `[]`, `<></>`)
 * is returned as it is, so no empty icon element renders; applying it twice adds both classes to
 * one element.
 */
export function withPartClass(
  slot: Slot<'span'> | undefined,
  className: string,
): Slot<'span'> | undefined {
  if (!slotRendersContent(slot)) return slot;
  const resolved = resolveSlot(slot, 'span', className);
  if (!resolved) return slot;
  return {
    ...resolved.props,
    as: resolved.Component,
    children: resolved.children,
  } as SlotObject<'span'>;
}
```

- [ ] **Step 4: Run the tests again**

Run: `npx vitest run src/components/button/__tests__/Button.slots.test.tsx`
Expected: PASS (the new cases and the existing ones).

- [ ] **Step 5: Rebuild Toolbar's icon box on it (identical output)**

In `src/components/button/Toolbar.parts.tsx`:

1. Replace the import lines

```ts
import { resolveSlot, slotRendersContent } from '../../lib/slot';
import type { SlotObject } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import type { Size, Slot } from '../../lib/types';
import { Button } from './Button';
import type { ButtonOwnProps } from './Button';
```

with

```ts
import { forcedColors } from '../../lib/styles';
import type { Size } from '../../lib/types';
import { Button } from './Button';
import type { ButtonOwnProps } from './Button';
import { withPartClass } from './Button.slots';
```

2. Delete the `withIconBox` function and its JSDoc (the block that starts with `` * `icon` as a slot object whose element also carries `box` `` and ends with `} as SlotObject<'span'>;\n}`).

3. In `ToolbarButton`, replace

```tsx
      icon={vertical ? withIconBox(icon, verticalIconBoxClasses[effectiveSize]) : icon}
```

with

```tsx
      icon={vertical ? withPartClass(icon, verticalIconBoxClasses[effectiveSize]) : icon}
```

- [ ] **Step 6: Run the Toolbar tests (unchanged)**

Run: `npx vitest run src/components/button/__tests__/Toolbar.parts.test.tsx src/components/button/__tests__/Toolbar.test.tsx`
Expected: PASS with no test edited (the icon box keeps its classes; `withPartClass` has `withIconBox`'s logic).

- [ ] **Step 7: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/button/Button.slots.tsx src/components/button/Toolbar.parts.tsx src/components/button/__tests__/Button.slots.test.tsx --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/button/Button.slots.tsx"
npx vitest run src/__tests__/conventions.test.ts -t "src/components/button/Toolbar.parts.tsx"
```
Expected: no errors; both gate tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/button/Button.slots.tsx src/components/button/Toolbar.parts.tsx src/components/button/__tests__/Button.slots.test.tsx
git commit -m "feat(button): withPartClass adds a variant's part class to Button's icon"
```

---

### Task A3: `StatusText` takes an `id`

**Files:**
- Modify: `src/components/feedback/MessageBar.status.tsx:57-62`
- Test: `src/components/feedback/__tests__/MessageBar.test.tsx` (the `describe('internal status building blocks (feedback-navigation#4)')` block at `:1318-1321`)

**Interfaces:**
- Consumes: nothing.
- Produces: `StatusText({ label, id }: { label: string; id?: string })`. P3-toasts (the toast container's `aria-labelledby`) and P3-messagebar (a labelled MessageBar) pass the id; neither changes this module (spec §4.2).

- [ ] **Step 1: Write the failing tests**

In `src/components/feedback/__tests__/MessageBar.test.tsx`, inside `describe('internal status building blocks (feedback-navigation#4)', …)`, after the two `testDisplayName` lines, add:

```tsx
    // The bar and the toast container pass the id from Fluent parity phase 3 on (P3-04, P3-02).
    it('renders its id on the visually hidden text, so a labelled bar or toast can name it', () => {
      render(<StatusText label="Warning:" id="status-text-id" />);
      const text = document.getElementById('status-text-id');
      expect(text).toHaveClass('sr-only');
      expect(text?.textContent).toBe('Warning: ');
    });

    it('renders nothing for an empty label, so an id never names an empty element', () => {
      const { container } = render(<StatusText label="" id="status-text-id" />);
      expect(container).toBeEmptyDOMElement();
      expect(document.getElementById('status-text-id')).toBeNull();
    });
```

- [ ] **Step 2: Run them to see the first fail**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.test.tsx -t "internal status building blocks"`
Expected: FAIL in "renders its id on the visually hidden text…" (`expected null to have class "sr-only"`; the type check also rejects the unknown `id` prop); the empty-label case passes already.

- [ ] **Step 3: Implement**

In `src/components/feedback/MessageBar.status.tsx`, replace

```tsx
/** Visually hidden status text, followed by a space so it reads apart from the message. */
export function StatusText({ label }: { label: string }) {
  if (!label) return null;
  return <span className="sr-only">{`${label} `}</span>;
}
```

with

```tsx
/**
 * Visually hidden status text, followed by a space so it reads apart from the message. `id` lets
 * a labelled MessageBar or a toast container point `aria-labelledby` at it; an empty label
 * renders nothing, so pass the id only while the text renders.
 */
export function StatusText({ label, id }: { label: string; id?: string }) {
  if (!label) return null;
  return (
    <span id={id} className="sr-only">
      {`${label} `}
    </span>
  );
}
```

- [ ] **Step 4: Run the MessageBar and Toast tests**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.test.tsx src/components/feedback/__tests__/Toast.test.tsx`
Expected: PASS (both use `StatusText` without an id, unchanged).

- [ ] **Step 5: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/feedback/MessageBar.status.tsx src/components/feedback/__tests__/MessageBar.test.tsx --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/MessageBar.status.tsx"
```
Expected: no errors; the gate test passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/MessageBar.status.tsx src/components/feedback/__tests__/MessageBar.test.tsx
git commit -m "feat(feedback): StatusText takes an id for aria-labelledby"
```

---

### Task A4: Stable class names — button folder

**Files:**
- Create: `src/components/button/__tests__/stableClassNames.test.tsx`
- Modify: `src/components/button/Button.tsx` (import; icon `renderSlot`, `:161-166`; root `cn`, `:215-220`)
- Modify: `src/components/button/CompoundButton.tsx` (imports; icon-only branch `:139-149`; icon box `:151-156`; text column `:157-171`; root `:176-183`)
- Modify: `src/components/button/ToggleButton.tsx` (imports; destructure `icon`; JSX `:167-187`)
- Modify: `src/components/button/MenuButton.tsx` (imports; indicator `:115-121`; JSX `:143-155`)
- Modify: `src/components/button/SplitButton.tsx` (imports; JSX `:212-250`)
- Modify: `src/components/button/Link.tsx` (import; root `cn`, `:142-150`)
- Modify: `src/components/button/Toolbar.tsx` (import; root `cn`, `:154-159`)
- Modify: `src/components/button/Toolbar.parts.tsx` (imports; every part's JSX)
- Test (update the §6.4 exact-class assertions): `src/components/button/__tests__/ToggleButton.test.tsx:28-29` (feeds `:415, 426, 437, 452, 466, 548, 575, 589, 593, 611`), `Toolbar.test.tsx:57, 851-856, 876-884`, `Toolbar.parts.test.tsx:41, 228-230, 403-405, 443-445, 998-1000`, `MenuButton.test.tsx:540-541`, `CompoundButton.test.tsx:229-231`

**Interfaces:**
- Consumes (Task A1, `src/lib/classNames.ts`): `buttonClassNames` { root, icon }, `compoundButtonClassNames` { root, icon, contentContainer, primaryText, secondaryText }, `toggleButtonClassNames` { root, icon }, `splitButtonClassNames` { root, primaryActionButton, menuButton, icon, menuIcon }, `menuButtonClassNames` { root, icon, menuIcon }, `linkClassNames` { root }, `toolbarClassNames` { root }, `toolbarButtonClassNames` { root, icon }, `toolbarToggleButtonClassNames` { root, icon }, `toolbarRadioButtonClassNames` { root, icon }, `toolbarRadioGroupClassNames` { root }, `toolbarGroupClassNames` { root }, `toolbarDividerClassNames` { root }.
- Consumes (Task A2, `src/components/button/Button.slots.tsx`): `withPartClass(slot: Slot<'span'> | undefined, className: string): Slot<'span'> | undefined`.
- Produces: every 0.7 element of the button folder carries its Appendix A classes; Task A13's `testClassName` case, Task A14's `class-names` rule and Task A15's "applied" check rely on it. No new export; no markup, attribute or style change besides the classes (§0.2 rule 19).

- [ ] **Step 1: Write the failing DOM class test**

Create `src/components/button/__tests__/stableClassNames.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  buttonClassNames,
  compoundButtonClassNames,
  linkClassNames,
  menuButtonClassNames,
  splitButtonClassNames,
  toggleButtonClassNames,
  toolbarButtonClassNames,
  toolbarClassNames,
  toolbarDividerClassNames,
  toolbarGroupClassNames,
  toolbarRadioButtonClassNames,
  toolbarRadioGroupClassNames,
  toolbarToggleButtonClassNames,
} from '../../../lib/classNames';
import { Button } from '../Button';
import { CompoundButton } from '../CompoundButton';
import { Link } from '../Link';
import { MenuButton } from '../MenuButton';
import { SplitButton } from '../SplitButton';
import { ToggleButton } from '../ToggleButton';
import { Toolbar } from '../Toolbar';

/** A decorative glyph a test can find. */
const Glyph = ({ testId }: { testId: string }) => <svg data-testid={testId} aria-hidden="true" />;

/** The element a glyph sits in: the icon slot's element. */
const iconBox = (testId: string) => screen.getByTestId(testId).parentElement as HTMLElement;

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): button folder', () => {
  it('Button: the root on the rendered element, the icon on the icon element', () => {
    render(<Button icon={<Glyph testId="save-icon" />}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(buttonClassNames.root);
    expect(iconBox('save-icon')).toHaveClass(buttonClassNames.icon);
  });

  it('Button: the root follows `as`; an icon slot object that swaps the element keeps the icon class', () => {
    render(
      <Button as="a" href="#docs" icon={{ as: 'i', 'data-testid': 'docs-icon' }}>
        Docs
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveClass(buttonClassNames.root);
    const icon = screen.getByTestId('docs-icon');
    expect(icon.tagName).toBe('I');
    expect(icon).toHaveClass(buttonClassNames.icon);
  });

  it("CompoundButton: Button's classes and its own on the root, the icon box and the text parts", () => {
    render(
      <CompoundButton icon={<Glyph testId="mail-icon" />} secondaryText="Opens your mail app">
        Send mail
      </CompoundButton>,
    );
    const button = screen.getByRole('button', { name: /Send mail/ });
    expect(button).toHaveClass(buttonClassNames.root, compoundButtonClassNames.root);
    expect(iconBox('mail-icon')).toHaveClass(buttonClassNames.icon, compoundButtonClassNames.icon);
    expect(button.querySelector('[data-wave-compound-content]')).toHaveClass(
      compoundButtonClassNames.contentContainer,
    );
    expect(screen.getByText('Send mail')).toHaveClass(compoundButtonClassNames.primaryText);
    expect(screen.getByText('Opens your mail app')).toHaveClass(
      compoundButtonClassNames.secondaryText,
    );
  });

  it("CompoundButton icon-only: Button's icon element carries both icon classes", () => {
    render(<CompoundButton icon={<Glyph testId="solo-icon" />} aria-label="Send" />);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass(
      buttonClassNames.root,
      compoundButtonClassNames.root,
    );
    expect(iconBox('solo-icon')).toHaveClass(buttonClassNames.icon, compoundButtonClassNames.icon);
  });

  it("ToggleButton: Button's classes and its own on the root and the icon, also for a slot object", () => {
    render(
      <>
        <ToggleButton icon={<Glyph testId="bold-icon" />} aria-label="Bold" />
        <ToggleButton icon={{ as: 'i', 'data-testid': 'grid-icon' }} aria-label="Grid" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
    );
    expect(iconBox('bold-icon')).toHaveClass(buttonClassNames.icon, toggleButtonClassNames.icon);
    const slotIcon = screen.getByTestId('grid-icon');
    expect(slotIcon.tagName).toBe('I');
    expect(slotIcon).toHaveClass(buttonClassNames.icon, toggleButtonClassNames.icon);
  });

  it('MenuButton: root, icon, the default chevron and a custom indicator', () => {
    render(
      <>
        <MenuButton icon={<Glyph testId="actions-icon" />}>Actions</MenuButton>
        <MenuButton menuIcon={<Glyph testId="caret" />}>More</MenuButton>
      </>,
    );
    const actions = screen.getByRole('button', { name: 'Actions' });
    expect(actions).toHaveClass(buttonClassNames.root, menuButtonClassNames.root);
    expect(iconBox('actions-icon')).toHaveClass(buttonClassNames.icon, menuButtonClassNames.icon);
    expect(actions.querySelector('[data-wave-icon="chevron-down"]')).toHaveClass(
      menuButtonClassNames.menuIcon,
    );
    expect(iconBox('caret')).toHaveClass(menuButtonClassNames.menuIcon);
  });

  it("SplitButton: the group root, each half's own and part classes (consumer classes kept) and both icons", () => {
    render(
      <SplitButton
        icon={<Glyph testId="save-icon" />}
        menuIcon={<Glyph testId="menu-glyph" />}
        primaryActionButtonProps={{ className: 'consumer-primary' }}
        menuButtonProps={{ className: 'consumer-menu' }}
      >
        Save
      </SplitButton>,
    );
    expect(screen.getByRole('group')).toHaveClass(splitButtonClassNames.root);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.primaryActionButton,
      'consumer-primary',
    );
    expect(screen.getByRole('button', { name: 'More options' })).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.menuButton,
      'consumer-menu',
    );
    expect(iconBox('save-icon')).toHaveClass(buttonClassNames.icon, splitButtonClassNames.icon);
    expect(iconBox('menu-glyph')).toHaveClass(buttonClassNames.icon, splitButtonClassNames.menuIcon);
  });

  it("SplitButton: the default chevron's element carries the menu icon classes", () => {
    render(<SplitButton>Save</SplitButton>);
    const chevron = screen
      .getByRole('button', { name: 'More options' })
      .querySelector('[data-wave-icon="chevron-down"]');
    expect(chevron?.parentElement).toHaveClass(buttonClassNames.icon, splitButtonClassNames.menuIcon);
  });

  it('Link: the root on the rendered element', () => {
    render(<Link href="#top">Back to top</Link>);
    expect(screen.getByRole('link', { name: 'Back to top' })).toHaveClass(linkClassNames.root);
  });

  it('Toolbar and its parts: roots and icons, with the classes of every component they render through', () => {
    render(
      <Toolbar aria-label="Formatting">
        <Toolbar.Button icon={<Glyph testId="cut-icon" />}>Cut</Toolbar.Button>
        <Toolbar.Button vertical icon={<Glyph testId="paste-icon" />}>
          Paste
        </Toolbar.Button>
        <Toolbar.ToggleButton name="format" value="bold" icon={<Glyph testId="bold-icon" />}>
          Bold
        </Toolbar.ToggleButton>
        <Toolbar.Divider />
        <Toolbar.RadioGroup aria-label="Alignment">
          <Toolbar.RadioButton name="align" value="left" icon={<Glyph testId="left-icon" />}>
            Left
          </Toolbar.RadioButton>
        </Toolbar.RadioGroup>
        <Toolbar.Group aria-label="Sharing">
          <Toolbar.Button>Share</Toolbar.Button>
        </Toolbar.Group>
      </Toolbar>,
    );
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toHaveClass(toolbarClassNames.root);

    expect(screen.getByRole('button', { name: 'Cut' })).toHaveClass(
      buttonClassNames.root,
      toolbarButtonClassNames.root,
    );
    expect(iconBox('cut-icon')).toHaveClass(buttonClassNames.icon, toolbarButtonClassNames.icon);
    // With `vertical` the icon box is Button's icon element: it keeps its box classes too.
    expect(iconBox('paste-icon')).toHaveClass(
      buttonClassNames.icon,
      toolbarButtonClassNames.icon,
      'size-6',
    );

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
      toolbarToggleButtonClassNames.root,
    );
    expect(iconBox('bold-icon')).toHaveClass(
      buttonClassNames.icon,
      toggleButtonClassNames.icon,
      toolbarToggleButtonClassNames.icon,
    );

    expect(screen.getByRole('radio', { name: 'Left' })).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
      toolbarRadioButtonClassNames.root,
    );
    expect(iconBox('left-icon')).toHaveClass(
      buttonClassNames.icon,
      toggleButtonClassNames.icon,
      toolbarRadioButtonClassNames.icon,
    );

    expect(screen.getByRole('radiogroup', { name: 'Alignment' })).toHaveClass(
      toolbarRadioGroupClassNames.root,
    );
    expect(screen.getByRole('group', { name: 'Sharing' })).toHaveClass(toolbarGroupClassNames.root);
    expect(screen.getByRole('separator')).toHaveClass(toolbarDividerClassNames.root);
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(renderToString(<SplitButton>Save</SplitButton>));
    const [primary, menu] = Array.from(host.querySelectorAll('button'));
    expect(host.firstElementChild).toHaveClass(splitButtonClassNames.root);
    expect(primary).toHaveClass(buttonClassNames.root, splitButtonClassNames.primaryActionButton);
    expect(menu).toHaveClass(buttonClassNames.root, splitButtonClassNames.menuButton);
    expect(menu.firstElementChild).toHaveClass(buttonClassNames.icon, splitButtonClassNames.menuIcon);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/button/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case, e.g. `Expected the element to have class: wave-button` (no module applies the classes yet).

- [ ] **Step 3: `Button.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { buttonClassNames } from '../../lib/classNames';
```

Icon element — before:

```tsx
  const iconElement = renderSlot(
    slotRendersContent(icon) ? icon : undefined,
    'span',
    'inline-flex shrink-0 items-center',
    { 'aria-hidden': true },
  );
```

After:

```tsx
  const iconElement = renderSlot(
    slotRendersContent(icon) ? icon : undefined,
    'span',
    cn(buttonClassNames.icon, 'inline-flex shrink-0 items-center'),
    { 'aria-hidden': true },
  );
```

Root — before:

```tsx
      className={cn(
        buttonClassName({ appearance, size, disabled: showDisabledLook, iconOnly }),
        hasIcon && hasLabel && 'gap-1.5',
        className,
      )}
```

After:

```tsx
      className={cn(
        buttonClassNames.root,
        buttonClassName({ appearance, size, disabled: showDisabledLook, iconOnly }),
        hasIcon && hasLabel && 'gap-1.5',
        className,
      )}
```

(`buttonClassName()` in `buttonStyles.ts` stays unchanged: a style helper never gets a stable class, D4.)

- [ ] **Step 4: `CompoundButton.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { buttonClassNames, compoundButtonClassNames } from '../../lib/classNames';
```

and after `import { Button } from './Button';`:

```tsx
import { withPartClass } from './Button.slots';
```

Icon-only branch — before:

```tsx
      <BaseButton
        {...rest}
        appearance={appearance}
        size={size}
        icon={icon}
        iconPosition={iconPosition}
        className={className}
      />
```

After:

```tsx
      <BaseButton
        {...rest}
        appearance={appearance}
        size={size}
        icon={withPartClass(icon, compoundButtonClassNames.icon)}
        iconPosition={iconPosition}
        className={cn(compoundButtonClassNames.root, className)}
      />
```

Icon box (CompoundButton draws it itself, so it lists Button's icon class first, rule 2) — before:

```tsx
  const iconElement = renderSlot(
    slotRendersContent(icon) ? icon : undefined,
    'span',
    cn('inline-flex shrink-0 items-center justify-center [&>svg]:size-full', iconBoxClasses[size]),
    { 'aria-hidden': true },
  );
```

After:

```tsx
  const iconElement = renderSlot(
    slotRendersContent(icon) ? icon : undefined,
    'span',
    cn(
      buttonClassNames.icon,
      compoundButtonClassNames.icon,
      'inline-flex shrink-0 items-center justify-center [&>svg]:size-full',
      iconBoxClasses[size],
    ),
    { 'aria-hidden': true },
  );
```

Text column — before:

```tsx
    <span data-wave-compound-content="" className="flex min-w-0 flex-col items-start">
      <span className="font-bold">{label}</span>
      {hasSecondary && (
        <span
          className={cn(
            'text-caption-1 font-normal',
            appearance === 'primary' ? 'text-primary-foreground' : 'text-muted-foreground',
          )}
        >
```

After:

```tsx
    <span
      data-wave-compound-content=""
      className={cn(compoundButtonClassNames.contentContainer, 'flex min-w-0 flex-col items-start')}
    >
      <span className={cn(compoundButtonClassNames.primaryText, 'font-bold')}>{label}</span>
      {hasSecondary && (
        <span
          className={cn(
            compoundButtonClassNames.secondaryText,
            'text-caption-1 font-normal',
            appearance === 'primary' ? 'text-primary-foreground' : 'text-muted-foreground',
          )}
        >
```

Root (Button adds `wave-button`) — before:

```tsx
      className={cn(
        'h-auto items-center justify-start gap-3 text-start',
        paddingClasses[size],
        className,
      )}
```

After:

```tsx
      className={cn(
        compoundButtonClassNames.root,
        'h-auto items-center justify-start gap-3 text-start',
        paddingClasses[size],
        className,
      )}
```

- [ ] **Step 5: `ToggleButton.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { toggleButtonClassNames } from '../../lib/classNames';
```

and after `import { Button } from './Button';`:

```tsx
import { withPartClass } from './Button.slots';
```

Destructure `icon` — before:

```tsx
  isAccessible = false,
  className,
  onClick,
  ...props
}: ToggleButtonProps) => {
```

After:

```tsx
  isAccessible = false,
  icon,
  className,
  onClick,
  ...props
}: ToggleButtonProps) => {
```

JSX — before:

```tsx
    <Button
      {...props}
      appearance={appearance}
```

After:

```tsx
    <Button
      {...props}
      icon={withPartClass(icon, toggleButtonClassNames.icon)}
      appearance={appearance}
```

and before:

```tsx
      className={cn(
        isPressed && getPressedLayer(appearance, disabledLook, isAccessible),
        className,
      )}
```

After:

```tsx
      className={cn(
        toggleButtonClassNames.root,
        isPressed && getPressedLayer(appearance, disabledLook, isAccessible),
        className,
      )}
```

- [ ] **Step 6: `MenuButton.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { menuButtonClassNames } from '../../lib/classNames';
```

and change `import { unwrapButtonGlyph } from './Button.slots';` to:

```tsx
import { unwrapButtonGlyph, withPartClass } from './Button.slots';
```

Indicator — before:

```tsx
    menuIcon == null || (menuIconButton !== null && !slotRendersContent(glyph)) ? (
      <ChevronDownIcon className="shrink-0" />
    ) : slotRendersContent(glyph) ? (
      renderSlot(glyph, 'span', 'inline-flex shrink-0 items-center', { 'aria-hidden': true })
    ) : null;
```

After:

```tsx
    menuIcon == null || (menuIconButton !== null && !slotRendersContent(glyph)) ? (
      <ChevronDownIcon className={cn(menuButtonClassNames.menuIcon, 'shrink-0')} />
    ) : slotRendersContent(glyph) ? (
      renderSlot(glyph, 'span', cn(menuButtonClassNames.menuIcon, 'inline-flex shrink-0 items-center'), {
        'aria-hidden': true,
      })
    ) : null;
```

JSX — before:

```tsx
      icon={icon}
      className={cn('gap-1.5', unlabelled && unlabelledSizeClasses[size], className)}
```

After:

```tsx
      icon={withPartClass(icon, menuButtonClassNames.icon)}
      className={cn(
        menuButtonClassNames.root,
        'gap-1.5',
        unlabelled && unlabelledSizeClasses[size],
        className,
      )}
```

- [ ] **Step 7: `SplitButton.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { splitButtonClassNames } from '../../lib/classNames';
```

and change `import { unwrapButtonGlyph } from './Button.slots';` to:

```tsx
import { unwrapButtonGlyph, withPartClass } from './Button.slots';
```

Group root — before:

```tsx
      className={cn('inline-flex items-stretch', className)}
```

After:

```tsx
      className={cn(splitButtonClassNames.root, 'inline-flex items-stretch', className)}
```

Primary half (nested public component: its part class next to Button's own, merged with the consumer's `primaryActionButtonProps.className`, rule 4) — before:

```tsx
        icon={icon}
        iconPosition={iconPosition}
        className={cn(halfClasses, 'rounded-e-none border-e-0', primary.className)}
```

After:

```tsx
        icon={withPartClass(icon, splitButtonClassNames.icon)}
        iconPosition={iconPosition}
        className={cn(
          splitButtonClassNames.primaryActionButton,
          halfClasses,
          'rounded-e-none border-e-0',
          primary.className,
        )}
```

Menu half — before:

```tsx
        icon={menuIconRenders ? menuGlyph : <ChevronDownIcon />}
        className={cn(
          halfClasses,
          menuButtonSizeClasses[size],
```

After:

```tsx
        icon={withPartClass(
          menuIconRenders ? menuGlyph : <ChevronDownIcon />,
          splitButtonClassNames.menuIcon,
        )}
        className={cn(
          splitButtonClassNames.menuButton,
          halfClasses,
          menuButtonSizeClasses[size],
```

- [ ] **Step 8: `Link.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { linkClassNames } from '../../lib/classNames';
```

Root — before:

```tsx
      className={cn(
        'cursor-pointer transition-colors motion-reduce:transition-none',
```

After:

```tsx
      className={cn(
        linkClassNames.root,
        'cursor-pointer transition-colors motion-reduce:transition-none',
```

- [ ] **Step 9: `Toolbar.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { toolbarClassNames } from '../../lib/classNames';
```

Root — before:

```tsx
        className={cn(
          'inline-flex items-center gap-1 rounded border border-border',
```

After:

```tsx
        className={cn(
          toolbarClassNames.root,
          'inline-flex items-center gap-1 rounded border border-border',
```

- [ ] **Step 10: `Toolbar.parts.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import {
  toolbarButtonClassNames,
  toolbarDividerClassNames,
  toolbarGroupClassNames,
  toolbarRadioButtonClassNames,
  toolbarRadioGroupClassNames,
  toolbarToggleButtonClassNames,
} from '../../lib/classNames';
```

Task A2 already added `import { withPartClass } from './Button.slots';` here (it replaced the local `withIconBox` helper with it).

`ToolbarButton` — the `icon=` line reads, after Task A2, `icon={vertical ? withPartClass(icon, verticalIconBoxClasses[effectiveSize]) : icon}`. Replace that line and the `className=` line:

```tsx
      icon={vertical ? withPartClass(icon, verticalIconBoxClasses[effectiveSize]) : icon}
      data-vertical={vertical ? '' : undefined}
      className={cn(vertical && verticalButtonClasses, className)}
```

After (Button adds its own classes; the part class is chained after the box, so the icon box of a vertical button carries both):

```tsx
      icon={withPartClass(
        vertical ? withPartClass(icon, verticalIconBoxClasses[effectiveSize]) : icon,
        toolbarButtonClassNames.icon,
      )}
      data-vertical={vertical ? '' : undefined}
      className={cn(toolbarButtonClassNames.root, vertical && verticalButtonClasses, className)}
```

`ToolbarToggleButton` — before:

```tsx
export const ToolbarToggleButton = ({
  name,
  value,
  appearance = 'subtle',
  size,
  onClick,
  ...rest
}: ToolbarToggleButtonProps) => {
```

After:

```tsx
export const ToolbarToggleButton = ({
  name,
  value,
  appearance = 'subtle',
  size,
  icon,
  className,
  onClick,
  ...rest
}: ToolbarToggleButtonProps) => {
```

and in its JSX, before:

```tsx
    <ToggleButton
      {...rest}
      appearance={appearance}
      size={size ?? toolbar.size}
      pressed={checked.isChecked(name, value)}
      onClick={composeEventHandlers(onClick, (event) =>
        checked.toggle(name, value, event.nativeEvent),
      )}
    />
```

After (ToggleButton adds its own classes and Button's, on the root and through `withPartClass` on the icon):

```tsx
    <ToggleButton
      {...rest}
      icon={withPartClass(icon, toolbarToggleButtonClassNames.icon)}
      className={cn(toolbarToggleButtonClassNames.root, className)}
      appearance={appearance}
      size={size ?? toolbar.size}
      pressed={checked.isChecked(name, value)}
      onClick={composeEventHandlers(onClick, (event) =>
        checked.toggle(name, value, event.nativeEvent),
      )}
    />
```

`ToolbarRadioButton` — before:

```tsx
export const ToolbarRadioButton = ({
  name,
  value,
  appearance = 'subtle',
  size,
  onClick,
  ...rest
}: ToolbarRadioButtonProps) => {
```

After:

```tsx
export const ToolbarRadioButton = ({
  name,
  value,
  appearance = 'subtle',
  size,
  icon,
  className,
  onClick,
  ...rest
}: ToolbarRadioButtonProps) => {
```

and in its JSX, before:

```tsx
    <ToggleButton
      {...rest}
      role="radio"
```

After:

```tsx
    <ToggleButton
      {...rest}
      icon={withPartClass(icon, toolbarRadioButtonClassNames.icon)}
      className={cn(toolbarRadioButtonClassNames.root, className)}
      role="radio"
```

`ToolbarRadioGroup` — before:

```tsx
      className={cn('flex gap-1', orientation === 'vertical' && 'flex-col', className)}
    />
  );
};
ToolbarRadioGroup.displayName = 'ToolbarRadioGroup';
```

After:

```tsx
      className={cn(
        toolbarRadioGroupClassNames.root,
        'flex gap-1',
        orientation === 'vertical' && 'flex-col',
        className,
      )}
    />
  );
};
ToolbarRadioGroup.displayName = 'ToolbarRadioGroup';
```

`ToolbarGroup` — before:

```tsx
      className={cn('flex gap-1', orientation === 'vertical' && 'flex-col', className)}
    />
  );
};
ToolbarGroup.displayName = 'ToolbarGroup';
```

After:

```tsx
      className={cn(
        toolbarGroupClassNames.root,
        'flex gap-1',
        orientation === 'vertical' && 'flex-col',
        className,
      )}
    />
  );
};
ToolbarGroup.displayName = 'ToolbarGroup';
```

`ToolbarDivider` — before:

```tsx
      className={cn(
        vertical
          ? 'my-1 h-0 shrink-0 self-stretch border-t border-border'
```

After:

```tsx
      className={cn(
        toolbarDividerClassNames.root,
        vertical
          ? 'my-1 h-0 shrink-0 self-stretch border-t border-border'
```

- [ ] **Step 11: Run the DOM class test to verify it passes**

Run: `npx vitest run src/components/button/__tests__/stableClassNames.test.tsx`
Expected: PASS.

- [ ] **Step 12: Update the §6.4 exact-class assertions**

`ToggleButton.test.tsx` — add after the other imports:

```tsx
import { buttonClassNames, toggleButtonClassNames } from '../../../lib/classNames';
```

`classesFrom` (lines 28-29) feeds exactly the ten comparisons at `:415, 426, 437, 452, 466, 548, 575, 589, 593, 611`, all on the ToggleButton's `<button>`. Before:

```tsx
/** The classes of a `buttonClassName()` result as a sorted array. */
const classesFrom = (value: string) => value.split(/\s+/).filter(Boolean).sort();
```

After:

```tsx
/**
 * The classes a ToggleButton's `<button>` carries for a `buttonClassName()` result: the helper's
 * classes plus the stable classes of Button and ToggleButton (P3-00), as a sorted array.
 */
const classesFrom = (value: string) =>
  [...value.split(/\s+/).filter(Boolean), buttonClassNames.root, toggleButtonClassNames.root].sort();
```

`Toolbar.test.tsx` — add after the other imports:

```tsx
import {
  buttonClassNames,
  toggleButtonClassNames,
  toolbarButtonClassNames,
  toolbarRadioButtonClassNames,
  toolbarToggleButtonClassNames,
} from '../../../lib/classNames';
```

and after `const classesFrom = …` (line 57):

```tsx
/** A `buttonClassName()` result plus the stable classes the element carries (P3-00), sorted. */
const withStable = (value: string, ...stable: string[]) =>
  [...classesFrom(value), ...stable].sort();
```

Lines 851-856 — before:

```tsx
        const partClasses = classesFrom(buttonClassName({ appearance: 'subtle', size }));
        expect(classesOf(button('Cut'))).toEqual(partClasses);
        expect(classesOf(button('Bold'))).toEqual(partClasses);
        expect(classesOf(radio('Left'))).toEqual(partClasses);
        expect(classesOf(button('Plain'))).toEqual(classesFrom(buttonClassName()));
```

After:

```tsx
        const partClasses = buttonClassName({ appearance: 'subtle', size });
        expect(classesOf(button('Cut'))).toEqual(
          withStable(partClasses, buttonClassNames.root, toolbarButtonClassNames.root),
        );
        expect(classesOf(button('Bold'))).toEqual(
          withStable(
            partClasses,
            buttonClassNames.root,
            toggleButtonClassNames.root,
            toolbarToggleButtonClassNames.root,
          ),
        );
        expect(classesOf(radio('Left'))).toEqual(
          withStable(
            partClasses,
            buttonClassNames.root,
            toggleButtonClassNames.root,
            toolbarRadioButtonClassNames.root,
          ),
        );
        expect(classesOf(button('Plain'))).toEqual(
          withStable(buttonClassName(), buttonClassNames.root),
        );
```

Lines 876-884 — before:

```tsx
      expect(classesOf(button('Cut'))).toEqual(
        classesFrom(buttonClassName({ appearance: 'primary', size: 'large' })),
      );
      expect(classesOf(button('Bold'))).toEqual(
        classesFrom(buttonClassName({ appearance: 'subtle', size: 'extra-large' })),
      );
      expect(classesOf(radio('Left'))).toEqual(
        classesFrom(buttonClassName({ appearance: 'outline', size: 'large' })),
      );
```

After:

```tsx
      expect(classesOf(button('Cut'))).toEqual(
        withStable(
          buttonClassName({ appearance: 'primary', size: 'large' }),
          buttonClassNames.root,
          toolbarButtonClassNames.root,
        ),
      );
      expect(classesOf(button('Bold'))).toEqual(
        withStable(
          buttonClassName({ appearance: 'subtle', size: 'extra-large' }),
          buttonClassNames.root,
          toggleButtonClassNames.root,
          toolbarToggleButtonClassNames.root,
        ),
      );
      expect(classesOf(radio('Left'))).toEqual(
        withStable(
          buttonClassName({ appearance: 'outline', size: 'large' }),
          buttonClassNames.root,
          toggleButtonClassNames.root,
          toolbarRadioButtonClassNames.root,
        ),
      );
```

`Toolbar.parts.test.tsx` — add the same five-name import from `'../../../lib/classNames'` as in `Toolbar.test.tsx`, and after `const classesFrom = …` (line 41) the same `withStable` helper. Then:

- lines 228-230 (Share), before: `classesFrom(buttonClassName({ appearance: 'subtle', size: 'large' })),` → after:
  ```tsx
        withStable(
          buttonClassName({ appearance: 'subtle', size: 'large' }),
          buttonClassNames.root,
          toolbarButtonClassNames.root,
        ),
  ```
- lines 403-405 (Bold, pressed and accessible), before: `classesFrom(buttonClassName({ appearance: 'subtle', pressed: true, accessible: true })),` → after:
  ```tsx
        withStable(
          buttonClassName({ appearance: 'subtle', pressed: true, accessible: true }),
          buttonClassNames.root,
          toggleButtonClassNames.root,
          toolbarToggleButtonClassNames.root,
        ),
  ```
- lines 443-445 (Left, checked), before: `classesFrom(buttonClassName({ appearance: 'subtle', pressed: true })),` → after:
  ```tsx
        withStable(
          buttonClassName({ appearance: 'subtle', pressed: true }),
          buttonClassNames.root,
          toggleButtonClassNames.root,
          toolbarRadioButtonClassNames.root,
        ),
  ```
- lines 998-1000 (Cut, parts outside a Toolbar in production), before: `classesFrom(buttonClassName({ appearance: 'subtle', size: 'medium' })),` → after:
  ```tsx
        withStable(
          buttonClassName({ appearance: 'subtle', size: 'medium' }),
          buttonClassNames.root,
          toolbarButtonClassNames.root,
        ),
  ```

The `vertical` icon-box cases of `Toolbar.parts.test.tsx` use `toHaveClass` and stay unchanged (§6.4).

`MenuButton.test.tsx` — add `import { buttonClassNames, menuButtonClassNames } from '../../../lib/classNames';`; line 540, before:

```tsx
      const expected = [...buttonClassName({ appearance }).split(/\s+/), 'gap-1.5'].sort();
```

After:

```tsx
      const expected = [
        ...buttonClassName({ appearance }).split(/\s+/),
        'gap-1.5',
        buttonClassNames.root,
        menuButtonClassNames.root,
      ].sort();
```

`CompoundButton.test.tsx` — add `import { compoundButtonClassNames } from '../../../lib/classNames';`; lines 229-231 (the icon-only CompoundButton now differs from the icon-only Button by its own class), before:

```tsx
          expect(Array.from(compound.classList).sort()).toEqual(
            Array.from(button.classList).sort(),
          );
```

After:

```tsx
          expect(Array.from(compound.classList).sort()).toEqual(
            [...Array.from(button.classList), compoundButtonClassNames.root].sort(),
          );
```

- [ ] **Step 13: Run the folder's tests**

Run: `npx vitest run src/components/button`
Expected: PASS (the new file, the updated assertions and every other button test unchanged).

- [ ] **Step 14: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx prettier --write src/components/button
npx eslint src/components/button --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/button/"
```
Expected: all pass (Prettier only reformats the lines this task touched; commit its result).

- [ ] **Step 15: Commit**

```bash
git add src/components/button
git commit -m "feat(button): stable class names"
```

---

### Task A5: Stable class names — data-display folder

**Files:**
- Create: `src/components/data-display/__tests__/stableClassNames.test.tsx`
- Modify: `src/components/data-display/Avatar.tsx` (import; image `:294-339`; icon `:347-350`; initials and default glyph `:360-365`; badge `:402-405`; visual and roots `:408-429`)
- Modify: `src/components/data-display/AvatarGroup.tsx` (import; JSX `:233-301`)
- Modify: `src/components/data-display/Badge.tsx`, `CounterBadge.tsx`, `PresenceBadge.tsx`, `Image.tsx` (import; root `cn`)
- Modify: `src/components/data-display/Tag.tsx` (import; `defaultDismissContent`; `resolveDismissSlot`; dismiss button classes; root; content element)
- Modify: `src/components/data-display/Persona.tsx` (import; JSX `:73-90`)
- Modify: `src/components/data-display/Divider.tsx` (import; the three layouts)
- Modify: `src/components/data-display/InfoLabel.tsx` (import; JSX `:184-227`)
- Modify: `src/components/data-display/List.tsx` (import; root `:462`; item `:645-663`; action cell `:812`)

**Interfaces:**
- Consumes (Task A1): `avatarClassNames` { root, visual, image, icon, initials, badge }, `avatarGroupClassNames` { root, item, overflowButton, surface, list, listItem }, `badgeClassNames` { root }, `counterBadgeClassNames` { root }, `presenceBadgeClassNames` { root, icon }, `tagClassNames` { root, primaryText, dismissButton, dismissIcon }, `personaClassNames` { root, avatar, badge, primaryText, secondaryText }, `dividerClassNames` { root, line, label }, `infoLabelClassNames` { root, infoButton, info }, `imageClassNames` { root }, `listClassNames` { root }, `listItemClassNames` { root, content, action }.
- Produces: the data-display folder's 0.7 elements carry their Appendix A classes (Tasks A13–A15 rely on it). No new export.

- [ ] **Step 1: Write the failing DOM class test**

Create `src/components/data-display/__tests__/stableClassNames.test.tsx`:

```tsx
import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  avatarClassNames,
  avatarGroupClassNames,
  badgeClassNames,
  counterBadgeClassNames,
  dividerClassNames,
  imageClassNames,
  infoLabelClassNames,
  listClassNames,
  listItemClassNames,
  personaClassNames,
  presenceBadgeClassNames,
  tagClassNames,
} from '../../../lib/classNames';
import { Button } from '../../button/Button';
import { Avatar } from '../Avatar';
import { AvatarGroup } from '../AvatarGroup';
import { Badge } from '../Badge';
import { CounterBadge } from '../CounterBadge';
import { Divider } from '../Divider';
import { Image } from '../Image';
import { InfoLabel } from '../InfoLabel';
import { List } from '../List';
import { Persona } from '../Persona';
import { PresenceBadge } from '../PresenceBadge';
import { Tag } from '../Tag';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A decorative glyph a test can find. */
const Glyph = ({ testId }: { testId: string }) => <svg data-testid={testId} aria-hidden="true" />;

/** The element a glyph sits in: the slot's element. */
const iconBox = (testId: string) => screen.getByTestId(testId).parentElement as HTMLElement;

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): data-display folder', () => {
  it('Avatar without a badge: the circle is the root and carries the visual part; the initials part', () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveClass(
      avatarClassNames.root,
      avatarClassNames.visual,
    );
    expect(screen.getByText('AL')).toHaveClass(avatarClassNames.initials);
  });

  it('Avatar: the default person glyph, an icon slot, an image and an image slot element', () => {
    render(
      <>
        <Avatar data-testid="anonymous" />
        <Avatar name="Team" icon={<Glyph testId="team-icon" />} />
        <Avatar name="Ada Lovelace" src="ada.png" />
        <Avatar name="Grace Hopper" image={<img src="grace.png" alt="" data-testid="grace-image" />} />
      </>,
    );
    expect(
      screen.getByTestId('anonymous').querySelector('[data-wave-icon="person"]'),
    ).toHaveClass(avatarClassNames.icon);
    expect(iconBox('team-icon')).toHaveClass(avatarClassNames.icon);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveClass(avatarClassNames.image);
    expect(screen.getByTestId('grace-image')).toHaveClass(avatarClassNames.image);
  });

  it('Avatar with a badge: the root moves to the wrapper, the circle keeps the visual part', () => {
    render(
      <Avatar name="Ada Lovelace" badge={<PresenceBadge status="available" />} data-testid="avatar" />,
    );
    const root = screen.getByTestId('avatar');
    expect(root).toHaveClass(avatarClassNames.root);
    expect(root).not.toHaveClass(avatarClassNames.visual);
    const circle = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(circle).toHaveClass(avatarClassNames.visual);
    expect(circle).not.toHaveClass(avatarClassNames.root);
    expect(screen.getByRole('img', { name: 'Available' }).parentElement).toHaveClass(
      avatarClassNames.badge,
    );
  });

  it('AvatarGroup: root, member wrappers, overflow button and its popup list', async () => {
    const user = userEvent.setup();
    render(
      <AvatarGroup aria-label="Team" max={2}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
        <Avatar name="Alan Turing" />
      </AvatarGroup>,
    );
    expect(screen.getByRole('group', { name: 'Team' })).toHaveClass(avatarGroupClassNames.root);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).parentElement).toHaveClass(
      avatarGroupClassNames.item,
    );
    const overflow = screen.getByRole('button', { name: '1 more' });
    expect(overflow).toHaveClass(avatarGroupClassNames.overflowButton);
    await user.click(overflow);
    await act(async () => {});
    const surface = screen.getByRole('dialog', { name: '1 more' });
    expect(surface).toHaveClass(avatarGroupClassNames.surface);
    expect(within(surface).getByRole('list')).toHaveClass(avatarGroupClassNames.list);
    expect(within(surface).getByRole('listitem')).toHaveClass(avatarGroupClassNames.listItem);
  });

  it('Badge, CounterBadge (which also carries the Badge class) and PresenceBadge', () => {
    render(
      <>
        <Badge>New</Badge>
        <CounterBadge count={5} />
        <PresenceBadge status="busy" />
      </>,
    );
    expect(screen.getByText('New')).toHaveClass(badgeClassNames.root);
    expect(screen.getByText('New')).not.toHaveClass(counterBadgeClassNames.root);
    expect(screen.getByText('5')).toHaveClass(badgeClassNames.root, counterBadgeClassNames.root);
    const presence = screen.getByRole('img', { name: 'Busy' });
    expect(presence).toHaveClass(presenceBadgeClassNames.root);
    expect(presence.querySelector('svg')).toHaveClass(presenceBadgeClassNames.icon);
  });

  it('Tag: root, primary text, dismiss button and the default dismiss glyph', () => {
    render(
      <Tag dismissible onDismiss={() => {}}>
        Cherry
      </Tag>,
    );
    const content = screen.getByText('Cherry');
    expect(content).toHaveClass(tagClassNames.primaryText);
    expect(content.parentElement).toHaveClass(tagClassNames.root);
    const dismiss = screen.getByRole('button', { name: 'Dismiss Cherry' });
    expect(dismiss).toHaveClass(tagClassNames.dismissButton);
    expect(dismiss.querySelector('[data-wave-icon="dismiss"]')).toHaveClass(
      tagClassNames.dismissIcon,
    );
  });

  it('Tag: the dismiss icon part is the element `dismissIcon` renders, or a merged Button icon', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <Tag dismissible dismissIcon={<Glyph testId="kiwi-icon" />}>
          Kiwi
        </Tag>
        <Tag dismissible dismissIcon={{ className: 'text-error' }}>
          Plum
        </Tag>
        <Tag dismissible dismissIcon={<Button icon={<Glyph testId="fig-icon" />} />}>
          Fig
        </Tag>
      </>,
    );
    expect(iconBox('kiwi-icon')).toHaveClass(tagClassNames.dismissIcon);
    // A slot object without content wraps the default glyph: the wrapper is the part, once.
    const wrapper = screen.getByRole('button', { name: 'Dismiss Plum' }).querySelector('.text-error');
    expect(wrapper).toHaveClass(tagClassNames.dismissIcon);
    expect(wrapper?.querySelector('[data-wave-icon="dismiss"]')).not.toHaveClass(
      tagClassNames.dismissIcon,
    );
    expect(iconBox('fig-icon')).toHaveClass(tagClassNames.dismissIcon);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Tag: `dismissIcon` received a button. Its props were merged into the built-in dismiss button (a button cannot contain another button), which is named by its text label (or `dismissLabel`) and the tag content. Pass icon content instead, e.g. `dismissIcon={<CloseIcon />}`, and handle the dismissal in `onDismiss`.',
      ],
    ]);
  });

  it("Persona: root, the built-in Avatar (its own classes plus the avatar part), the badge element and the texts", () => {
    render(
      <Persona name="Ada Lovelace" secondaryText="Engineer" status="available" data-testid="persona" />,
    );
    const persona = screen.getByTestId('persona');
    expect(persona).toHaveClass(personaClassNames.root);
    // The built-in Avatar is decorative: the first aria-hidden element of the persona.
    expect(persona.querySelector('[aria-hidden="true"]')).toHaveClass(
      avatarClassNames.root,
      avatarClassNames.visual,
      personaClassNames.avatar,
    );
    expect(screen.getByRole('img', { name: 'Available' }).parentElement).toHaveClass(
      personaClassNames.badge,
    );
    expect(screen.getByText('Ada Lovelace')).toHaveClass(personaClassNames.primaryText);
    expect(screen.getByText('Engineer')).toHaveClass(personaClassNames.secondaryText);
  });

  it('Persona: an `avatar` slot carries the avatar part', () => {
    render(<Persona name="Grace Hopper" avatar={<Glyph testId="custom-avatar" />} />);
    expect(iconBox('custom-avatar')).toHaveClass(personaClassNames.avatar);
  });

  it('Divider: the root in each layout; a labelled divider draws two lines around its label', () => {
    render(
      <>
        <Divider data-testid="rule" />
        <Divider orientation="vertical" data-testid="line" />
        <Divider data-testid="labelled">Or</Divider>
      </>,
    );
    expect(screen.getByTestId('rule')).toHaveClass(dividerClassNames.root);
    expect(screen.getByTestId('line')).toHaveClass(dividerClassNames.root);
    const labelled = screen.getByTestId('labelled');
    expect(labelled).toHaveClass(dividerClassNames.root);
    expect(screen.getByText('Or')).toHaveClass(dividerClassNames.label);
    const lines = Array.from(labelled.children).filter(
      (child) => child.getAttribute('aria-hidden') === 'true',
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toHaveClass(dividerClassNames.line);
  });

  it('InfoLabel: root, info button and the info popup', async () => {
    render(<InfoLabel label="Email" info="Used to sign in" />);
    expect(screen.getByText('Email')).toHaveClass(infoLabelClassNames.root);
    const button = screen.getByRole('button', { name: 'Information' });
    expect(button).toHaveClass(infoLabelClassNames.infoButton);
    // Keyboard focus opens the popup (no hover timers involved).
    act(() => {
      button.focus();
    });
    await act(async () => {});
    expect(document.querySelector('[data-wave-infolabel-surface]')).toHaveClass(
      infoLabelClassNames.info,
    );
  });

  it('Image: the root on the img', () => {
    render(<Image src="chart.png" alt="Sales chart" />);
    expect(screen.getByRole('img', { name: 'Sales chart' })).toHaveClass(imageClassNames.root);
  });

  it('List and List.Item: root, item, content and action, as a list and as a grid', () => {
    const { unmount } = render(
      <List aria-label="Fruits">
        <List.Item action={<button type="button">Remove</button>}>Apple</List.Item>
      </List>,
    );
    expect(screen.getByRole('list', { name: 'Fruits' })).toHaveClass(listClassNames.root);
    expect(screen.getByRole('listitem')).toHaveClass(listItemClassNames.root);
    expect(screen.getByText('Apple')).toHaveClass(listItemClassNames.content);
    expect(screen.getByRole('button', { name: 'Remove' }).parentElement).toHaveClass(
      listItemClassNames.action,
    );
    unmount();

    render(
      <List selectable aria-label="Files">
        <List.Item value="report" action={<button type="button">Share</button>}>
          Report
        </List.Item>
      </List>,
    );
    expect(screen.getByRole('grid', { name: 'Files' })).toHaveClass(listClassNames.root);
    expect(screen.getByRole('row')).toHaveClass(listItemClassNames.root);
    expect(screen.getByText('Report')).toHaveClass(listItemClassNames.content);
    expect(screen.getByRole('button', { name: 'Share' }).parentElement).toHaveClass(
      listItemClassNames.action,
    );
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(<Persona name="Ada Lovelace" secondaryText="Engineer" status="available" />),
    );
    const persona = host.firstElementChild as HTMLElement;
    expect(persona).toHaveClass(personaClassNames.root);
    expect(persona.querySelector('[aria-hidden="true"]')).toHaveClass(
      avatarClassNames.root,
      avatarClassNames.visual,
      personaClassNames.avatar,
    );
    expect(persona.querySelector('[role="img"]')).toHaveClass(presenceBadgeClassNames.root);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/data-display/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case, e.g. `Expected the element to have class: wave-avatar`.

- [ ] **Step 3: `Avatar.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { avatarClassNames } from '../../lib/classNames';
```

The three image renderings (the two `<img className={IMAGE_CLASS} …>` for a string slot and for `src`, and the slot's base classes) — before, in each `<img>`:

```tsx
          className={IMAGE_CLASS}
```

After:

```tsx
          className={cn(avatarClassNames.image, IMAGE_CLASS)}
```

and before:

```tsx
      imageNode = renderSlot(slot as Slot<'img'>, 'img', IMAGE_CLASS, {
```

After:

```tsx
      imageNode = renderSlot(slot as Slot<'img'>, 'img', cn(avatarClassNames.image, IMAGE_CLASS), {
```

Icon slot — before:

```tsx
      ? renderSlot(icon, 'span', 'inline-flex', { 'aria-hidden': true })
```

After:

```tsx
      ? renderSlot(icon, 'span', cn(avatarClassNames.icon, 'inline-flex'), { 'aria-hidden': true })
```

Initials and the default glyph — before:

```tsx
    content = <span aria-hidden="true">{initials}</span>;
    colorClass = 'bg-primary text-primary-foreground';
  } else {
    content = <PersonIcon size="60%" />;
```

After:

```tsx
    content = (
      <span aria-hidden="true" className={avatarClassNames.initials}>
        {initials}
      </span>
    );
    colorClass = 'bg-primary text-primary-foreground';
  } else {
    content = <PersonIcon size="60%" className={avatarClassNames.icon} />;
```

Badge — before:

```tsx
      ? renderSlot(badge, 'span', 'absolute bottom-0 end-0 inline-flex')
```

After:

```tsx
      ? renderSlot(badge, 'span', cn(avatarClassNames.badge, 'absolute bottom-0 end-0 inline-flex'))
```

Visual and roots (the circle carries `visual` in both layouts; the root follows `className`, judgement 11) — before:

```tsx
  const visualClassName = cn(
    'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-bold',
    avatarSizeClasses[size],
    colorClass,
  );

  if (!hasBadge) {
    return (
      <span ref={rootVisualRef} {...a11yProps} {...rest} className={cn(visualClassName, className)}>
        {content}
      </span>
    );
  }

  return (
    <span ref={ref} {...rest} className={cn('relative inline-flex shrink-0', className)}>
```

After:

```tsx
  const visualClassName = cn(
    avatarClassNames.visual,
    'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-bold',
    avatarSizeClasses[size],
    colorClass,
  );

  if (!hasBadge) {
    return (
      <span
        ref={rootVisualRef}
        {...a11yProps}
        {...rest}
        className={cn(avatarClassNames.root, visualClassName, className)}
      >
        {content}
      </span>
    );
  }

  return (
    <span
      ref={ref}
      {...rest}
      className={cn(avatarClassNames.root, 'relative inline-flex shrink-0', className)}
    >
```

- [ ] **Step 4: `AvatarGroup.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { avatarGroupClassNames } from '../../lib/classNames';
```

Root — before: `className={cn('inline-flex items-center', className)}` → after:

```tsx
      className={cn(avatarGroupClassNames.root, 'inline-flex items-center', className)}
```

Member wrapper — before:

```tsx
          className={cn('inline-flex rounded-full ring-2 ring-background', i > 0 && '-ms-2')}
```

After:

```tsx
          className={cn(
            avatarGroupClassNames.item,
            'inline-flex rounded-full ring-2 ring-background',
            i > 0 && '-ms-2',
          )}
```

Overflow button — before:

```tsx
          className={cn(
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 font-semibold',
```

After:

```tsx
          className={cn(
            avatarGroupClassNames.overflowButton,
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 font-semibold',
```

Popup surface — before:

```tsx
            className={cn(
              'min-w-32 max-w-xs rounded-md border border-border bg-background p-2 text-body-1 text-foreground shadow-16',
```

After:

```tsx
            className={cn(
              avatarGroupClassNames.surface,
              'min-w-32 max-w-xs rounded-md border border-border bg-background p-2 text-body-1 text-foreground shadow-16',
```

List and items — before:

```tsx
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {hidden.map(({ key, node }) => (
                <li key={key} className="px-1 py-0.5">
```

After:

```tsx
            <ul className={cn(avatarGroupClassNames.list, 'm-0 flex list-none flex-col gap-1 p-0')}>
              {hidden.map(({ key, node }) => (
                <li key={key} className={cn(avatarGroupClassNames.listItem, 'px-1 py-0.5')}>
```

- [ ] **Step 5: `Badge.tsx`, `CounterBadge.tsx`, `PresenceBadge.tsx`, `Image.tsx`**

`Badge.tsx`: add `import { badgeClassNames } from '../../lib/classNames';` after the `cn` import; before:

```tsx
      className={cn(
        'rounded-full inline-flex items-center font-semibold',
```

After:

```tsx
      className={cn(
        badgeClassNames.root,
        'rounded-full inline-flex items-center font-semibold',
```

`CounterBadge.tsx` (a variant: Badge's class first, rule 2): add `import { badgeClassNames, counterBadgeClassNames } from '../../lib/classNames';`; before:

```tsx
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        dot
```

After:

```tsx
      className={cn(
        badgeClassNames.root,
        counterBadgeClassNames.root,
        'inline-flex items-center justify-center rounded-full',
        dot
```

`PresenceBadge.tsx`: add `import { presenceBadgeClassNames } from '../../lib/classNames';`; root, before:

```tsx
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-background',
```

After:

```tsx
      className={cn(
        presenceBadgeClassNames.root,
        'inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-background',
```

and the glyph, before:

```tsx
      <Icon size="100%" className={cn('size-full', glyph === 'arrow' && 'wave-rtl:-scale-x-100')} />
```

After:

```tsx
      <Icon
        size="100%"
        className={cn(
          presenceBadgeClassNames.icon,
          'size-full',
          glyph === 'arrow' && 'wave-rtl:-scale-x-100',
        )}
      />
```

`Image.tsx`: add `import { imageClassNames } from '../../lib/classNames';`; before:

```tsx
      className={cn(
        fitMap[fit],
```

After:

```tsx
      className={cn(
        imageClassNames.root,
        fitMap[fit],
```

- [ ] **Step 6: `Tag.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { tagClassNames } from '../../lib/classNames';
```

The default glyph takes the part class only where it is the dismiss button's own content (Appendix A: "the element `dismissIcon` renders, a merged Button's `icon` span, else the default svg"). Before:

```tsx
/** The decorative default dismiss glyph. */
function defaultDismissContent(): React.ReactNode {
  return <DismissIcon size={12} />;
}
```

After:

```tsx
/**
 * The decorative default dismiss glyph. It carries the dismiss icon part class when it is the
 * dismiss button's own content, not when the element of a slot object wraps it.
 */
function defaultDismissContent(className?: string): React.ReactNode {
  return <DismissIcon size={12} className={className} />;
}
```

In `resolveDismissSlot`, the empty-slot branch — before (first `return` of the function):

```tsx
  if (!slotRendersContent(slot)) {
    return {
      buttonProps: null,
      content: defaultDismissContent(),
```

After:

```tsx
  if (!slotRendersContent(slot)) {
    return {
      buttonProps: null,
      content: defaultDismissContent(tagClassNames.dismissIcon),
```

The merged-button branch — before:

```tsx
    const iconNode = slotRendersContent(icon)
      ? renderSlot(icon, 'span', iconClassName, { 'aria-hidden': true })
      : null;
```

After:

```tsx
    const iconNode = slotRendersContent(icon)
      ? renderSlot(icon, 'span', cn(tagClassNames.dismissIcon, iconClassName), {
          'aria-hidden': true,
        })
      : null;
```

and, in the same branch's `return`, before:

```tsx
          ? placeButtonIcon(iconNode, ownContent, isWaveButton && elementProps.iconPosition)
          : defaultDismissContent(),
```

After:

```tsx
          ? placeButtonIcon(iconNode, ownContent, isWaveButton && elementProps.iconPosition)
          : defaultDismissContent(tagClassNames.dismissIcon),
```

(The `<span className={iconClassName} dangerouslySetInnerHTML={markup} />` of a merged button's markup is its text content, not the icon: it stays unchanged.)

The slot-object branch — before:

```tsx
    if (slotRendersContent(ownProps.icon)) {
      contentProps.children = placeButtonIcon(
        renderSlot(ownProps.icon as Slot<'span'>, 'span', iconClassName),
        materialiseSlotContent(contentProps.children),
        ownProps.iconPosition,
      );
    } else if (slotWrapsDefaultContent(contentProps.as ?? 'span', contentProps)) {
      contentProps.children = defaultDismissContent();
    }
    return {
      buttonProps: isButtonObject || Object.keys(buttonProps).length > 0 ? buttonProps : null,
      content: renderSlot(contentProps as SlotObject<'span'>, 'span', iconClassName, {
        'aria-hidden': true,
      }),
```

After:

```tsx
    // The dismiss icon part is the merged Button's icon element when there is one, else the
    // element this slot object renders (a default glyph inside it stays without the part class).
    const hasButtonIcon = slotRendersContent(ownProps.icon);
    if (hasButtonIcon) {
      contentProps.children = placeButtonIcon(
        renderSlot(
          ownProps.icon as Slot<'span'>,
          'span',
          cn(tagClassNames.dismissIcon, iconClassName),
        ),
        materialiseSlotContent(contentProps.children),
        ownProps.iconPosition,
      );
    } else if (slotWrapsDefaultContent(contentProps.as ?? 'span', contentProps)) {
      contentProps.children = defaultDismissContent();
    }
    return {
      buttonProps: isButtonObject || Object.keys(buttonProps).length > 0 ? buttonProps : null,
      content: renderSlot(
        contentProps as SlotObject<'span'>,
        'span',
        cn(!hasButtonIcon && tagClassNames.dismissIcon, iconClassName),
        { 'aria-hidden': true },
      ),
```

The plain-content branch (last `return` of the function) — before:

```tsx
    content: renderSlot(slot as Slot<'span'>, 'span', iconClassName, { 'aria-hidden': true }),
```

After:

```tsx
    content: renderSlot(slot as Slot<'span'>, 'span', cn(tagClassNames.dismissIcon, iconClassName), {
      'aria-hidden': true,
    }),
```

The dismiss button (the merged slot's `className` still comes after ours through `mergeProps`) — before:

```tsx
    className: cn(
      'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground',
```

After:

```tsx
    className: cn(
      tagClassNames.dismissButton,
      'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground',
```

Root and content element — before:

```tsx
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted py-1 ps-3 text-body-1 text-foreground',
        dismissible ? 'pe-1.5' : 'pe-3',
        className,
      )}
      {...rest}
    >
      <span id={contentId} className="inline-flex items-center gap-1">
```

After:

```tsx
      className={cn(
        tagClassNames.root,
        'inline-flex items-center gap-1 rounded-full bg-muted py-1 ps-3 text-body-1 text-foreground',
        dismissible ? 'pe-1.5' : 'pe-3',
        className,
      )}
      {...rest}
    >
      <span id={contentId} className={cn(tagClassNames.primaryText, 'inline-flex items-center gap-1')}>
```

- [ ] **Step 7: `Persona.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { personaClassNames } from '../../lib/classNames';
```

JSX — before:

```tsx
    <div ref={ref} className={cn('inline-flex items-center gap-3', className)} {...props}>
      <div className="relative inline-flex shrink-0">
        {avatar && slotRendersContent(avatar) ? (
          renderSlot(avatar, 'span')
        ) : (
          <Avatar src={src} name={name} size={size} decorative />
        )}
        {badgeNode && <span className="absolute bottom-0 end-0 inline-flex">{badgeNode}</span>}
      </div>
      <div className="flex flex-col">
        <span className="font-semibold text-body-1">{name}</span>
        {secondaryText && (
          <span className="text-caption-1 text-muted-foreground">{secondaryText}</span>
        )}
      </div>
    </div>
```

After (the built-in Avatar keeps its own classes and gets the persona's `avatar` part through `className`, rule 4; the avatar and text columns are layout wrappers, judgement 27):

```tsx
    <div
      ref={ref}
      className={cn(personaClassNames.root, 'inline-flex items-center gap-3', className)}
      {...props}
    >
      <div className="relative inline-flex shrink-0">
        {avatar && slotRendersContent(avatar) ? (
          renderSlot(avatar, 'span', personaClassNames.avatar)
        ) : (
          <Avatar
            src={src}
            name={name}
            size={size}
            decorative
            className={personaClassNames.avatar}
          />
        )}
        {badgeNode && (
          <span className={cn(personaClassNames.badge, 'absolute bottom-0 end-0 inline-flex')}>
            {badgeNode}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className={cn(personaClassNames.primaryText, 'font-semibold text-body-1')}>
          {name}
        </span>
        {secondaryText && (
          <span
            className={cn(personaClassNames.secondaryText, 'text-caption-1 text-muted-foreground')}
          >
            {secondaryText}
          </span>
        )}
      </div>
    </div>
```

- [ ] **Step 8: `Divider.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { dividerClassNames } from '../../lib/classNames';
```

Labelled layout — before:

```tsx
    const lineClassName = vertical
      ? 'w-0 min-h-2 flex-1 border-s border-border'
      : 'h-0 min-w-2 flex-1 border-t border-border';
```

After:

```tsx
    const lineClassName = cn(
      dividerClassNames.line,
      vertical
        ? 'w-0 min-h-2 flex-1 border-s border-border'
        : 'h-0 min-w-2 flex-1 border-t border-border',
    );
```

and before:

```tsx
        className={cn(
          vertical
            ? 'inline-flex min-h-12 flex-col items-center gap-1 self-stretch'
            : 'flex items-center gap-3',
          className,
        )}
```

After:

```tsx
        className={cn(
          dividerClassNames.root,
          vertical
            ? 'inline-flex min-h-12 flex-col items-center gap-1 self-stretch'
            : 'flex items-center gap-3',
          className,
        )}
```

and before:

```tsx
        {renderSlot(children, 'span', labelClassName, { id: labelId })}
```

After:

```tsx
        {renderSlot(children, 'span', cn(dividerClassNames.label, labelClassName), { id: labelId })}
```

Vertical line — before: `className={cn('inline-block h-6 border-s border-border', className)}` → after:

```tsx
        className={cn(dividerClassNames.root, 'inline-block h-6 border-s border-border', className)}
```

Horizontal rule — before:

```tsx
      className={cn('m-0 h-0 w-full border-0 border-t border-solid border-border', className)}
```

After:

```tsx
      className={cn(
        dividerClassNames.root,
        'm-0 h-0 w-full border-0 border-t border-solid border-border',
        className,
      )}
```

- [ ] **Step 9: `InfoLabel.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { infoLabelClassNames } from '../../lib/classNames';
```

Root — before: `className={cn('inline-flex items-center gap-1 text-body-1', className)}` → after:

```tsx
      className={cn(infoLabelClassNames.root, 'inline-flex items-center gap-1 text-body-1', className)}
```

Info button — before:

```tsx
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground',
```

After:

```tsx
        className={cn(
          infoLabelClassNames.infoButton,
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground',
```

Popup — before:

```tsx
            className="w-max max-w-xs rounded-md border border-border bg-background px-3 py-2 text-caption-1 text-foreground shadow-16"
```

After:

```tsx
            className={cn(
              infoLabelClassNames.info,
              'w-max max-w-xs rounded-md border border-border bg-background px-3 py-2 text-caption-1 text-foreground shadow-16',
            )}
```

(The info glyph is the whole content of the info button: no class, judgement 26.)

- [ ] **Step 10: `List.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { listClassNames, listItemClassNames } from '../../lib/classNames';
```

List root — before: `className={cn('m-0 list-none p-0', className)}` → after:

```tsx
        className={cn(listClassNames.root, 'm-0 list-none p-0', className)}
```

Item root — before:

```tsx
      className={cn(
        'flex items-center border-b border-border px-4 py-2 text-body-1',
```

After:

```tsx
      className={cn(
        listItemClassNames.root,
        'flex items-center border-b border-border px-4 py-2 text-body-1',
```

Content element — before:

```tsx
      <ContentCell role={mode === 'grid' ? 'gridcell' : undefined} className="min-w-0 flex-1">
```

After:

```tsx
      <ContentCell
        role={mode === 'grid' ? 'gridcell' : undefined}
        className={cn(listItemClassNames.content, 'min-w-0 flex-1')}
      >
```

Action cell (the internal `ListActionCell` draws ListItem's `action` part; the member is named literally in this module, rule 8) — before:

```tsx
      className={cn('ms-2 shrink-0', grid && focusRingInset)}
```

After:

```tsx
      className={cn(listItemClassNames.action, 'ms-2 shrink-0', grid && focusRingInset)}
```

- [ ] **Step 11: Run the DOM class test to verify it passes**

Run: `npx vitest run src/components/data-display/__tests__/stableClassNames.test.tsx --reporter=default`
Expected: PASS, and no console output besides the asserted Tag warning (none printed: the spy is asserted and mocked).

- [ ] **Step 12: Run the folder's tests**

Run: `npx vitest run src/components/data-display`
Expected: PASS (§6.4: no data-display assertion compares a complete class string; Badge's `severe`/`important` equality renders the same classes on both sides).

- [ ] **Step 13: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx prettier --write src/components/data-display
npx eslint src/components/data-display --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/data-display/"
```
Expected: all pass (Prettier only reformats the lines this task touched; commit its result).

- [ ] **Step 14: Commit**

```bash
git add src/components/data-display
git commit -m "feat(data-display): stable class names"
```

---

### Task A6: Stable class names — feedback folder

**Files:**
- Create: `src/components/feedback/__tests__/stableClassNames.test.tsx`
- Modify: `src/components/feedback/MessageBar.tsx` (import; `defaultDismissContent`, `defaultDismiss`, `resolveDismiss`; icon, dismiss button, root, body)
- Modify: `src/components/feedback/ProgressBar.tsx` (import; bar, fill, label)
- Modify: `src/components/feedback/Spinner.tsx` (import; root, ring, label)
- Modify: `src/components/feedback/Skeleton.tsx` (import; Skeleton root; SkeletonGroup `className` through `cn`)
- Modify: `src/components/feedback/Toast.tsx` (import; the `Toast` root, icon, content column and dismiss button; the Toaster viewport)
- Not touched: `MessageBar.status.tsx` (Task A3 owns its `id`; `STATUS_*` helpers never get classes, D4)

**Interfaces:**
- Consumes (Task A1): `messageBarClassNames` { root, icon, body, dismissButton, dismissIcon }, `progressBarClassNames` { root, bar, label }, `spinnerClassNames` { root, spinner, label }, `skeletonClassNames` { root }, `skeletonGroupClassNames` { root }, `toastClassNames` { root, icon, content, dismissButton }, `toasterClassNames` { root } (its `toast` key is 0.8, applied by P3-toasts).
- Produces: the feedback folder's 0.7 elements carry their Appendix A classes. Wave B restructures `MessageBar.tsx` and `Toast.tsx` (P3-messagebar, P3-toasts) and must keep every class applied here on the element that carries it.

- [ ] **Step 1: Write the failing DOM class test**

Create `src/components/feedback/__tests__/stableClassNames.test.tsx`:

```tsx
import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  messageBarClassNames,
  progressBarClassNames,
  skeletonClassNames,
  skeletonGroupClassNames,
  spinnerClassNames,
  toastClassNames,
  toasterClassNames,
} from '../../../lib/classNames';
import { Button } from '../../button/Button';
import { MessageBar } from '../MessageBar';
import { ProgressBar } from '../ProgressBar';
import { Skeleton } from '../Skeleton';
import { Spinner } from '../Spinner';
import { Toast, Toaster, useToastController } from '../Toast';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A decorative glyph a test can find. */
const Glyph = ({ testId }: { testId: string }) => <svg data-testid={testId} aria-hidden="true" />;

/** The element a glyph sits in: the slot's element. */
const iconBox = (testId: string) => screen.getByTestId(testId).parentElement as HTMLElement;

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): feedback folder', () => {
  it('MessageBar: root, status icon, body, dismiss button and the default dismiss glyph', () => {
    render(
      <MessageBar status="warning" onDismiss={() => {}}>
        Update available
      </MessageBar>,
    );
    const bar = screen.getByRole('alert');
    expect(bar).toHaveClass(messageBarClassNames.root);
    expect(bar.firstElementChild).toHaveClass(messageBarClassNames.icon);
    expect(screen.getByText('Update available')).toHaveClass(messageBarClassNames.body);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss).toHaveClass(messageBarClassNames.dismissButton);
    expect(dismiss.querySelector('[data-wave-icon="dismiss"]')).toHaveClass(
      messageBarClassNames.dismissIcon,
    );
  });

  it('MessageBar: an icon slot, `dismiss` content, a slot object around the default glyph and a merged Button icon', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <MessageBar icon={<Glyph testId="custom-icon" />}>Saved</MessageBar>
        <MessageBar onDismiss={() => {}} dismiss={<Glyph testId="dismiss-glyph" />}>
          Synced
        </MessageBar>
        <MessageBar onDismiss={() => {}} dismiss={{ className: 'text-error' }}>
          Stored
        </MessageBar>
        <MessageBar onDismiss={() => {}} dismiss={<Button icon={<Glyph testId="merged-icon" />} />}>
          Queued
        </MessageBar>
      </>,
    );
    expect(iconBox('custom-icon')).toHaveClass(messageBarClassNames.icon);
    expect(iconBox('dismiss-glyph')).toHaveClass(messageBarClassNames.dismissIcon);
    const wrapper = document.querySelector('button .text-error');
    expect(wrapper).toHaveClass(messageBarClassNames.dismissIcon);
    expect(wrapper?.querySelector('[data-wave-icon="dismiss"]')).not.toHaveClass(
      messageBarClassNames.dismissIcon,
    );
    expect(iconBox('merged-icon')).toHaveClass(messageBarClassNames.dismissIcon);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] MessageBar: `dismiss` received a button element; its props were merged into the built-in dismiss button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.',
      ],
    ]);
  });

  it('ProgressBar: root on the progressbar, the fill, and the visible label outside the root', () => {
    render(<ProgressBar value={40} label="Upload" showLabel />);
    const bar = screen.getByRole('progressbar', { name: 'Upload' });
    expect(bar).toHaveClass(progressBarClassNames.root);
    expect(bar.firstElementChild).toHaveClass(progressBarClassNames.bar);
    const label = screen.getByText('Upload');
    expect(label).toHaveClass(progressBarClassNames.label);
    expect(bar.contains(label)).toBe(false);
  });

  it('Spinner: root, ring, and the label with and without `labelVisible`', () => {
    render(
      <>
        <Spinner label="Loading files" labelVisible data-testid="visible" />
        <Spinner label="Loading" data-testid="hidden-label" />
      </>,
    );
    const visible = screen.getByTestId('visible');
    expect(visible).toHaveClass(spinnerClassNames.root);
    expect(visible.querySelector('[data-wave-spinner-ring]')).toHaveClass(spinnerClassNames.spinner);
    expect(visible.querySelector('[data-wave-spinner-label]')).toHaveClass(spinnerClassNames.label);
    // The same element, visually hidden: it keeps its class (judgement 29).
    expect(
      screen.getByTestId('hidden-label').querySelector('[data-wave-spinner-label]'),
    ).toHaveClass(spinnerClassNames.label, 'sr-only');
  });

  it('Skeleton and Skeleton.Group', () => {
    render(
      <Skeleton.Group label="Loading profile" data-testid="group">
        <Skeleton width={160} height={12} data-testid="line" />
      </Skeleton.Group>,
    );
    expect(screen.getByTestId('group')).toHaveClass(skeletonGroupClassNames.root);
    expect(screen.getByTestId('line')).toHaveClass(skeletonClassNames.root);
  });

  it('Toast on its own: root, status icon, content column and dismiss button', () => {
    render(
      <Toast status="success" title="Saved" onDismiss={() => {}}>
        Your changes are live.
      </Toast>,
    );
    const toast = screen.getByRole('status');
    expect(toast).toHaveClass(toastClassNames.root);
    expect(toast.firstElementChild).toHaveClass(toastClassNames.icon);
    expect(screen.getByText('Saved').parentElement).toHaveClass(toastClassNames.content);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass(
      toastClassNames.dismissButton,
    );
  });

  it('Toaster: root on the viewport; a dispatched toast keeps only the Toast classes', async () => {
    const user = userEvent.setup();
    function Dispatcher() {
      const { dispatchToast } = useToastController();
      return (
        <button type="button" onClick={() => dispatchToast({ title: 'Saved' })}>
          Notify
        </button>
      );
    }
    render(
      <Toaster>
        <Dispatcher />
      </Toaster>,
    );
    expect(screen.getByRole('region', { name: 'Notifications' })).toHaveClass(toasterClassNames.root);
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    const toast = document.querySelector('[data-wave-toast]');
    expect(toast).toHaveClass(toastClassNames.root);
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(
        <MessageBar status="error" onDismiss={() => {}}>
          Upload failed
        </MessageBar>,
      ),
    );
    const bar = host.querySelector('[role="alert"]') as HTMLElement;
    expect(bar).toHaveClass(messageBarClassNames.root);
    expect(bar.firstElementChild).toHaveClass(messageBarClassNames.icon);
    expect(bar.querySelector('button')).toHaveClass(messageBarClassNames.dismissButton);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/feedback/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case, e.g. `Expected the element to have class: wave-message-bar`.

- [ ] **Step 3: `MessageBar.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { messageBarClassNames } from '../../lib/classNames';
```

The default glyph (the same rule as Tag's, Appendix A judgement 16) — before:

```tsx
/** The decorative default dismiss glyph. */
function defaultDismissContent(): React.ReactNode {
  return <DismissIcon />;
}
```

After:

```tsx
/**
 * The decorative default dismiss glyph. It carries the dismiss icon part class when it is the
 * dismiss button's own content, not when the element of a slot object wraps it.
 */
function defaultDismissContent(className?: string): React.ReactNode {
  return <DismissIcon className={className} />;
}
```

`defaultDismiss()` — before: `    content: defaultDismissContent(),` (inside `defaultDismiss`) → after:

```tsx
    content: defaultDismissContent(messageBarClassNames.dismissIcon),
```

Merged-button branch of `resolveDismiss` — before:

```tsx
    const iconNode =
      isWaveButton && slotRendersContent(icon)
        ? renderSlot(icon, 'span', dismissContentClassName, { 'aria-hidden': true })
        : null;
    const content =
      iconNode || slotRendersContent(children)
        ? placeButtonIcon(iconNode, children, element.props.iconPosition)
        : defaultDismissContent();
```

After:

```tsx
    const iconNode =
      isWaveButton && slotRendersContent(icon)
        ? renderSlot(icon, 'span', cn(messageBarClassNames.dismissIcon, dismissContentClassName), {
            'aria-hidden': true,
          })
        : null;
    const content =
      iconNode || slotRendersContent(children)
        ? placeButtonIcon(iconNode, children, element.props.iconPosition)
        : defaultDismissContent(messageBarClassNames.dismissIcon);
```

(The `<span className={dismissContentClassName} dangerouslySetInnerHTML={markup} />` of a merged button's markup is its text content: unchanged.)

Slot-object branch — the Wave Button's icon, before:

```tsx
        iconNode = renderSlot(value as Slot<'span'>, 'span', dismissContentClassName, {
          'aria-hidden': true,
        });
```

After:

```tsx
        iconNode = renderSlot(
          value as Slot<'span'>,
          'span',
          cn(messageBarClassNames.dismissIcon, dismissContentClassName),
          { 'aria-hidden': true },
        );
```

and the content element, before:

```tsx
  const elementProps = {
    'aria-hidden': true,
    ...contentProps,
    className: cn(dismissContentClassName, contentProps.className as string | undefined),
  };
```

After (the element the slot renders is the part, unless a merged Button's icon element already is; the default glyph it may wrap keeps `defaultDismissContent()` without the class):

```tsx
  const elementProps = {
    'aria-hidden': true,
    ...contentProps,
    className: cn(
      iconNode === null && messageBarClassNames.dismissIcon,
      dismissContentClassName,
      contentProps.className as string | undefined,
    ),
  };
```

Status icon — before:

```tsx
  const iconClassName = cn('mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status]);
```

After:

```tsx
  const iconClassName = cn(
    messageBarClassNames.icon,
    'mt-0.5 inline-flex shrink-0',
    STATUS_ICON_COLOR[status],
  );
```

Dismiss button — before:

```tsx
        className: cn(
          'ms-auto inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
```

After:

```tsx
        className: cn(
          messageBarClassNames.dismissButton,
          'ms-auto inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
```

Root and body — before:

```tsx
      className={cn(
        'flex items-start gap-3 rounded border-s-4 px-4 py-3 text-foreground',
        tintClasses[status],
        STATUS_BORDER[status],
        className,
      )}
    >
      {renderedIcon}
      <div className="min-w-0 flex-1 text-body-1">
```

After:

```tsx
      className={cn(
        messageBarClassNames.root,
        'flex items-start gap-3 rounded border-s-4 px-4 py-3 text-foreground',
        tintClasses[status],
        STATUS_BORDER[status],
        className,
      )}
    >
      {renderedIcon}
      <div className={cn(messageBarClassNames.body, 'min-w-0 flex-1 text-body-1')}>
```

- [ ] **Step 4: `ProgressBar.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { progressBarClassNames } from '../../lib/classNames';
```

Bar — before:

```tsx
      className={cn(
        'h-2 overflow-hidden rounded-full bg-track',
```

After:

```tsx
      className={cn(
        progressBarClassNames.root,
        'h-2 overflow-hidden rounded-full bg-track',
```

Fill — before:

```tsx
        className={cn(
          'h-full rounded-full',
          fillColorClasses[resolvedColor],
```

After:

```tsx
        className={cn(
          progressBarClassNames.bar,
          'h-full rounded-full',
          fillColorClasses[resolvedColor],
```

Visible label (a sibling of the root inside a wrapper with no class, judgement 12) — before:

```tsx
      <span id={labelId} className="text-body-1 text-foreground">
```

After:

```tsx
      <span id={labelId} className={cn(progressBarClassNames.label, 'text-body-1 text-foreground')}>
```

- [ ] **Step 5: `Spinner.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { spinnerClassNames } from '../../lib/classNames';
```

Root — before: `className={cn('inline-flex items-center gap-2', className)}` → after:

```tsx
      className={cn(spinnerClassNames.root, 'inline-flex items-center gap-2', className)}
```

Ring — before:

```tsx
          className={cn(
            'rounded-full border-2 animate-wave-spin motion-reduce:animate-wave-spin-slow',
```

After:

```tsx
          className={cn(
            spinnerClassNames.spinner,
            'rounded-full border-2 animate-wave-spin motion-reduce:animate-wave-spin-slow',
```

Label — before:

```tsx
        className={labelVisible ? cn('text-body-1', colors.label) : 'sr-only'}
```

After:

```tsx
        className={cn(
          spinnerClassNames.label,
          labelVisible ? cn('text-body-1', colors.label) : 'sr-only',
        )}
```

- [ ] **Step 6: `Skeleton.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { skeletonClassNames, skeletonGroupClassNames } from '../../lib/classNames';
```

Skeleton root — before:

```tsx
      className={cn(
        'bg-skeleton animate-wave-pulse motion-reduce:animate-none',
```

After:

```tsx
      className={cn(
        skeletonClassNames.root,
        'bg-skeleton animate-wave-pulse motion-reduce:animate-none',
```

SkeletonGroup (its `className` went through `...rest` without `cn()`; rule 1 switches it) — before:

```tsx
  'aria-busy': busy = true,
  children,
  ref,
  ...rest
}: SkeletonGroupProps) => {
  const loading = busy !== false && busy !== 'false';
  return (
    <div {...rest} aria-busy={busy} ref={ref}>
```

After:

```tsx
  'aria-busy': busy = true,
  className,
  children,
  ref,
  ...rest
}: SkeletonGroupProps) => {
  const loading = busy !== false && busy !== 'false';
  return (
    <div
      {...rest}
      aria-busy={busy}
      ref={ref}
      className={cn(skeletonGroupClassNames.root, className)}
    >
```

- [ ] **Step 7: `Toast.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { toastClassNames, toasterClassNames } from '../../lib/classNames';
```

`Toast` root, icon and content column — before:

```tsx
      className={cn(
        'flex items-start gap-3 rounded border border-s-4 border-border bg-background p-3 text-foreground shadow-4',
        STATUS_BORDER[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status])}
      >
        <StatusIcon status={status} />
      </span>
      <div className="min-w-0 flex-1">
```

After:

```tsx
      className={cn(
        toastClassNames.root,
        'flex items-start gap-3 rounded border border-s-4 border-border bg-background p-3 text-foreground shadow-4',
        STATUS_BORDER[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(toastClassNames.icon, 'mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status])}
      >
        <StatusIcon status={status} />
      </span>
      <div className={cn(toastClassNames.content, 'min-w-0 flex-1')}>
```

(The title and body `<div>`s get `toastTitleClassNames`/`toastBodyClassNames` from P3-toasts, when they become the parts: 0.8, not applied here.)

Dismiss button — before:

```tsx
          className={cn(
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
```

After:

```tsx
          className={cn(
            toastClassNames.dismissButton,
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
```

Toaster viewport — before:

```tsx
          className={cn(
            'fixed flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2',
```

After:

```tsx
          className={cn(
            toasterClassNames.root,
            'fixed flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2',
```

- [ ] **Step 8: Run the DOM class test to verify it passes**

Run: `npx vitest run src/components/feedback/__tests__/stableClassNames.test.tsx --reporter=default`
Expected: PASS with no unasserted console output.

- [ ] **Step 9: Run the folder's tests**

Run: `npx vitest run src/components/feedback`
Expected: PASS (§6.4: no feedback assertion compares a complete class string; `MessageBar.test.tsx:169` and `:1352` use presence and `toHaveClass`).

- [ ] **Step 10: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx prettier --write src/components/feedback
npx eslint src/components/feedback --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/"
```
Expected: all pass (Prettier only reformats the lines this task touched; commit its result).

- [ ] **Step 11: Commit**

```bash
git add src/components/feedback
git commit -m "feat(feedback): stable class names"
```

---

### Task A7: Stable class names — input folder

**Files:**
- Create: `src/components/input/__tests__/stableClassNames.test.tsx`
- Modify (classes only, spec §0.2 rule 19): `src/components/input/Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Field.tsx`, `Label.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Switch.tsx`, `SearchBox.tsx`, `Slider.tsx`, `SpinButton.tsx`, `Option.tsx`, `Combobox.expand.tsx`, `Combobox.tsx`, `Dropdown.tsx`, `TagPicker.tsx`, `TimePicker.tsx`, `DatePicker.tsx`, `SwatchPicker.tsx`, `ColorPicker.tsx`, `Rating.tsx` (all in `src/components/input/`)
- Unchanged: `pickerStyles.ts` (a shared style helper: never gets classes, D4), `colorUtils.ts`, `dateUtils.ts`, `routedHandlers.ts`, `index.ts`

**Interfaces:**
- Consumes (Task A1, `src/lib/classNames.ts`): `inputClassNames` {root, input, contentBefore, contentAfter, errorMessage}, `textareaClassNames` {root, errorMessage}, `selectClassNames` {root, errorMessage}, `fieldClassNames` {root, label, required, validationMessage, validationMessageIcon, hint}, `labelClassNames` {root, required}, `checkboxClassNames` {root, indicator, label}, `radioGroupClassNames` {root}, `radioGroupItemClassNames` {root, indicator, label}, `switchClassNames` {root, track, thumb, label}, `searchBoxClassNames` {root, contentBefore, input, contentAfter, dismissButton, dismissIcon}, `sliderClassNames` {root}, `spinButtonClassNames` {root, decrementButton, input, incrementButton}, `optionClassNames` {root, checkIcon, content}, `optionGroupClassNames` {root, label, list}, `comboboxClassNames` {root, input, clearButton, expandButton, expandIcon, listbox, surface, emptyMessage}, `dropdownClassNames` {root, button, value, expandIcon, clearButton, listbox, surface}, `tagPickerClassNames` {root, control, group, tag, removeButton, input, listbox, option, surface, emptyMessage}, `timePickerClassNames` {root, input, clearButton, expandButton, expandIcon, errorMessage, listbox, option, checkIcon, surface, emptyMessage}, `datePickerClassNames` {root, input, clearButton, openCalendarButton, errorMessage, surface, header, previousMonthButton, heading, nextMonthButton, grid, weekday, day}, `swatchPickerClassNames` {root, swatch}, `colorPickerClassNames` {root, opacityLabel, opacityValue}, `ratingClassNames` {root, star, icon}, `ratingDisplayClassNames` {root, star, icon, value, count}. The 0.8 constants of this folder (`colorPickerHexFieldClassNames`, `colorPickerSwatchesClassNames`, `colorPickerPreviewClassNames`, `colorAreaClassNames`, `colorSliderClassNames`, `alphaSliderClassNames`) are not applied here (they stay on `PENDING_CLASS_NAMES` until P3-color).
- Produces (internal class channels of shared renderers, spec §1.2 rule 8; nothing exported from the package, no public prop changes):
  - `useControlErrorMessage(error, errorMessageProps, consumerAriaInvalid?, partClassName?: string)` in `Input.tsx` (the host's `errorMessage` class, first in the message's `cn()`).
  - `ListboxSurfaceProps.listboxClassName?: string` and `ListboxSurfaceProps.surfaceClassName?: string` in `Option.tsx`.
  - `PickerExpandButtonProps.className?: string` (the button) and `PickerExpandButtonProps.iconClassName?: string` (the glyph span) in `Combobox.expand.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/components/input/__tests__/stableClassNames.test.tsx`:

```tsx
/**
 * Stable class names of the input folder (spec P3-00, Appendix A "input"): every root, part and
 * nested public component carries its registered class on the element the registry names, in
 * every layout where that element renders, portaled popups and the server HTML included. The
 * values are read from the registry, never written as literals.
 */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  checkboxClassNames,
  colorPickerClassNames,
  comboboxClassNames,
  datePickerClassNames,
  dropdownClassNames,
  fieldClassNames,
  inputClassNames,
  labelClassNames,
  optionClassNames,
  optionGroupClassNames,
  radioGroupClassNames,
  radioGroupItemClassNames,
  ratingClassNames,
  ratingDisplayClassNames,
  searchBoxClassNames,
  selectClassNames,
  sliderClassNames,
  spinButtonClassNames,
  swatchPickerClassNames,
  switchClassNames,
  tagPickerClassNames,
  textareaClassNames,
  timePickerClassNames,
} from '../../../lib/classNames';
import { Button } from '../../button/Button';
import { Checkbox } from '../Checkbox';
import { ColorPicker } from '../ColorPicker';
import { Combobox, Option, OptionGroup } from '../Combobox';
import { DatePicker } from '../DatePicker';
import { Dropdown } from '../Dropdown';
import { Field } from '../Field';
import { Input } from '../Input';
import { Label } from '../Label';
import { RadioGroup } from '../RadioGroup';
import { Rating, RatingDisplay } from '../Rating';
import { SearchBox } from '../SearchBox';
import { Select } from '../Select';
import { Slider } from '../Slider';
import { SpinButton } from '../SpinButton';
import { SwatchPicker } from '../SwatchPicker';
import { Switch } from '../Switch';
import { TagPicker } from '../TagPicker';
import { Textarea } from '../Textarea';
import { TimePicker } from '../TimePicker';

/** Server HTML in a detached element (never appended: src/test-setup.ts checks document.body). */
function parse(html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names: input folder', () => {
  it('Input: the <input> is root and input without slot content; the error message is a part', () => {
    render(<Input aria-label="Name" error="Enter a name" />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveClass(inputClassNames.root, inputClassNames.input);
    expect(screen.getByRole('alert')).toHaveClass(inputClassNames.errorMessage);
  });

  it('Input: with slot content the wrapper is the root and the <input> keeps its part class', () => {
    render(<Input aria-label="Price" contentBefore="$" contentAfter="USD" />);
    const input = screen.getByRole('textbox', { name: 'Price' });
    expect(input).toHaveClass(inputClassNames.input);
    expect(input).not.toHaveClass(inputClassNames.root);
    expect(input.parentElement).toHaveClass(inputClassNames.root);
    expect(screen.getByText('$')).toHaveClass(inputClassNames.contentBefore);
    expect(screen.getByText('USD')).toHaveClass(inputClassNames.contentAfter);
  });

  it('Textarea and Select: roots, and each one its own error message class', () => {
    render(
      <>
        <Textarea aria-label="Notes" error="Too short" />
        <Select aria-label="Size" error="Pick a size">
          <option>Small</option>
        </Select>
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveClass(textareaClassNames.root);
    expect(screen.getByRole('combobox', { name: 'Size' })).toHaveClass(selectClassNames.root);
    const [textareaError, selectError] = screen.getAllByRole('alert');
    expect(textareaError).toHaveClass(textareaClassNames.errorMessage);
    expect(textareaError).not.toHaveClass(inputClassNames.errorMessage);
    expect(selectError).toHaveClass(selectClassNames.errorMessage);
  });

  it('Field: root, label, required mark, validation message with its default icon, hint', () => {
    const { container } = render(
      <Field
        label="Email"
        required
        hint="Your work address"
        validationState="error"
        validationMessage="Enter an email"
      >
        <Input />
      </Field>,
    );
    expect(container.firstElementChild).toHaveClass(fieldClassNames.root);
    const label = container.querySelector('label') as HTMLLabelElement;
    expect(label).toHaveClass(fieldClassNames.label);
    expect(within(label).getByText('*')).toHaveClass(fieldClassNames.required);
    const message = screen.getByRole('alert');
    expect(message).toHaveClass(fieldClassNames.validationMessage);
    expect(message.firstElementChild).toHaveClass(fieldClassNames.validationMessageIcon);
    expect(screen.getByText('Your work address')).toHaveClass(fieldClassNames.hint);
  });

  it('Field: a validationMessageIcon slot renders inside the part element', () => {
    render(
      <Field
        label="Email"
        validationState="warning"
        validationMessage="Unusual domain"
        validationMessageIcon={<svg data-testid="custom-icon" />}
      >
        <Input />
      </Field>,
    );
    expect(screen.getByTestId('custom-icon').parentElement).toHaveClass(
      fieldClassNames.validationMessageIcon,
    );
  });

  it('Label: root and required mark', () => {
    render(
      <Label required htmlFor="name">
        Name
      </Label>,
    );
    const label = screen.getByText('Name');
    expect(label).toHaveClass(labelClassNames.root);
    expect(within(label).getByText('*')).toHaveClass(labelClassNames.required);
  });

  it('Checkbox: the <label> root, the box and the label text', () => {
    render(<Checkbox label="Subscribe" />);
    const box = screen.getByRole('checkbox', { name: 'Subscribe' });
    expect(box).toHaveClass(checkboxClassNames.indicator);
    expect(box.closest('label')).toHaveClass(checkboxClassNames.root);
    expect(screen.getByText('Subscribe')).toHaveClass(checkboxClassNames.label);
  });

  it('RadioGroup: the group; an item on its <label> (where className lands), radio and text', () => {
    render(
      <RadioGroup aria-label="Size" defaultValue="s">
        <RadioGroup.Item value="s" label="Small" className="wave-test-custom-class" />
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Size' })).toHaveClass(
      radioGroupClassNames.root,
    );
    const radio = screen.getByRole('radio', { name: 'Small' });
    expect(radio).toHaveClass(radioGroupItemClassNames.indicator);
    expect(radio).not.toHaveClass(radioGroupItemClassNames.root);
    expect(radio.closest('label')).toHaveClass(
      radioGroupItemClassNames.root,
      'wave-test-custom-class',
    );
    expect(screen.getByText('Small')).toHaveClass(radioGroupItemClassNames.label);
  });

  it('Switch: the <label> root, track, thumb and label text', () => {
    render(<Switch label="Wi-Fi" />);
    const track = screen.getByRole('switch', { name: 'Wi-Fi' });
    expect(track).toHaveClass(switchClassNames.track);
    expect(track.firstElementChild).toHaveClass(switchClassNames.thumb);
    expect(track.closest('label')).toHaveClass(switchClassNames.root);
    expect(screen.getByText('Wi-Fi')).toHaveClass(switchClassNames.label);
  });

  it('SearchBox: root, content wrappers, input, clear button and its default glyph', () => {
    render(<SearchBox aria-label="Search" defaultValue="cats" contentAfter={<kbd>/</kbd>} />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input).toHaveClass(searchBoxClassNames.input);
    const root = input.parentElement as HTMLElement;
    expect(root).toHaveClass(searchBoxClassNames.root);
    expect(root.firstElementChild).toHaveClass(searchBoxClassNames.contentBefore);
    // The kbd sits in the slot's own span inside the contentAfter wrapper (judgement 30).
    expect(screen.getByText('/').parentElement?.parentElement).toHaveClass(
      searchBoxClassNames.contentAfter,
    );
    const clear = screen.getByRole('button', { name: 'Clear search' });
    expect(clear).toHaveClass(searchBoxClassNames.dismissButton);
    expect(clear.querySelector('svg')).toHaveClass(searchBoxClassNames.dismissIcon);
  });

  it('SearchBox: the element a dismiss slot renders is the dismissIcon part', () => {
    render(
      <SearchBox aria-label="Search" defaultValue="cats" dismiss={<svg data-testid="own-glyph" />} />,
    );
    expect(screen.getByTestId('own-glyph').parentElement).toHaveClass(
      searchBoxClassNames.dismissIcon,
    );
  });

  it("SearchBox: a merged Button's icon span is the dismissIcon part", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="cats"
          dismiss={<Button icon={<svg data-testid="button-glyph" />} />}
        />,
      );
      expect(screen.getByTestId('button-glyph').parentElement).toHaveClass(
        searchBoxClassNames.dismissIcon,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] SearchBox: `dismiss` received a button element; its props were merged into the built-in clear button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<MyIcon />}`.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it('Slider: the range input is the root', () => {
    render(<Slider aria-label="Volume" />);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveClass(sliderClassNames.root);
  });

  it('SpinButton: root, step buttons and input', () => {
    render(<SpinButton aria-label="Quantity" defaultValue={2} />);
    const input = screen.getByRole('spinbutton', { name: 'Quantity' });
    expect(input).toHaveClass(spinButtonClassNames.input);
    expect(input.parentElement).toHaveClass(spinButtonClassNames.root);
    expect(screen.getByRole('button', { name: 'Decrement' })).toHaveClass(
      spinButtonClassNames.decrementButton,
    );
    expect(screen.getByRole('button', { name: 'Increment' })).toHaveClass(
      spinButtonClassNames.incrementButton,
    );
  });

  it('Combobox: root, input, buttons, glyph, listbox, surface, options and option groups', () => {
    render(
      <Combobox aria-label="Fruit" clearable defaultValue="apple" defaultOpen>
        <Option value="apple">Apple</Option>
        <OptionGroup label="Citrus">
          <Option value="orange">Orange</Option>
        </OptionGroup>
      </Combobox>,
    );
    const input = screen.getByRole('combobox', { name: 'Fruit' });
    expect(input).toHaveClass(comboboxClassNames.input);
    expect(input.parentElement?.parentElement).toHaveClass(comboboxClassNames.root);
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveClass(
      comboboxClassNames.clearButton,
    );
    const expand = screen.getByRole('button', { name: 'Show options' });
    expect(expand).toHaveClass(comboboxClassNames.expandButton);
    expect(expand.firstElementChild).toHaveClass(comboboxClassNames.expandIcon);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(comboboxClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(comboboxClassNames.surface);
    const apple = screen.getByRole('option', { name: 'Apple' });
    expect(apple).toHaveClass(optionClassNames.root);
    expect(apple.querySelector('svg')).toHaveClass(optionClassNames.checkIcon);
    expect(within(apple).getByText('Apple')).toHaveClass(optionClassNames.content);
    const citrus = screen.getByRole('group', { name: 'Citrus' });
    expect(citrus).toHaveClass(optionGroupClassNames.list);
    expect(citrus.parentElement).toHaveClass(optionGroupClassNames.root);
    expect(screen.getByText('Citrus')).toHaveClass(optionGroupClassNames.label);
  });

  it('Combobox: the "No matches" row of the popup is the emptyMessage part', async () => {
    const user = userEvent.setup();
    render(
      <Combobox aria-label="Fruit">
        <Option value="apple">Apple</Option>
      </Combobox>,
    );
    await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'zzz');
    const empty = screen.getByText('No matches', { selector: 'div' });
    expect(empty).toHaveClass(comboboxClassNames.emptyMessage);
    expect(empty.parentElement).toHaveClass(comboboxClassNames.surface);
  });

  it('Dropdown: root, button, value, chevron, clear button, listbox and surface', () => {
    render(
      <Dropdown aria-label="Color" clearable defaultValue="red" defaultOpen>
        <Option value="red">Red</Option>
        <Option value="green">Green</Option>
      </Dropdown>,
    );
    const button = screen.getByRole('combobox', { name: 'Color' });
    expect(button).toHaveClass(dropdownClassNames.button);
    expect(button.parentElement?.parentElement).toHaveClass(dropdownClassNames.root);
    expect(within(button).getByText('Red')).toHaveClass(dropdownClassNames.value);
    expect(button.querySelector('svg')).toHaveClass(dropdownClassNames.expandIcon);
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveClass(
      dropdownClassNames.clearButton,
    );
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(dropdownClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(dropdownClassNames.surface);
    expect(screen.getByRole('option', { name: 'Green' })).toHaveClass(optionClassNames.root);
  });

  it('TagPicker: root, tag area, tag list, tags, remove buttons, input, popup and its Options', () => {
    render(
      <TagPicker
        aria-label="Fruits"
        options={[
          { value: 'apple', label: 'Apple' },
          { value: 'banana', label: 'Banana' },
        ]}
        defaultValue={['apple']}
        defaultOpen
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Fruits' });
    expect(input).toHaveClass(tagPickerClassNames.input);
    const control = input.closest('[data-wave-tagpicker-control]') as HTMLElement;
    expect(control).toHaveClass(tagPickerClassNames.control);
    expect(control.parentElement).toHaveClass(tagPickerClassNames.root);
    expect(screen.getByRole('list', { name: 'Selected' })).toHaveClass(tagPickerClassNames.group);
    expect(screen.getByRole('listitem')).toHaveClass(tagPickerClassNames.tag);
    expect(screen.getByRole('button', { name: 'Remove Apple' })).toHaveClass(
      tagPickerClassNames.removeButton,
    );
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(tagPickerClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(tagPickerClassNames.surface);
    // A nested public component: Option's own classes plus the TagPicker part class (D5).
    const banana = screen.getByRole('option', { name: 'Banana' });
    expect(banana).toHaveClass(optionClassNames.root, tagPickerClassNames.option);
    expect(within(banana).getByText('Banana')).toHaveClass(optionClassNames.content);
  });

  it('TagPicker: the "No matches" row of the popup is the emptyMessage part', async () => {
    const user = userEvent.setup();
    render(<TagPicker aria-label="Fruits" options={[{ value: 'apple', label: 'Apple' }]} />);
    await user.type(screen.getByRole('combobox', { name: 'Fruits' }), 'zzz');
    const empty = screen.getByText('No matches', { selector: 'div' });
    expect(empty).toHaveClass(tagPickerClassNames.emptyMessage);
    expect(empty.parentElement).toHaveClass(tagPickerClassNames.surface);
  });

  it('TimePicker: root, input, buttons, glyph, listbox, surface and options with check columns', () => {
    render(<TimePicker aria-label="Start time" clearable defaultValue="09:00" defaultOpen />);
    const input = screen.getByRole('combobox', { name: 'Start time' });
    expect(input).toHaveClass(timePickerClassNames.input);
    expect(input.parentElement?.parentElement).toHaveClass(timePickerClassNames.root);
    expect(screen.getByRole('button', { name: 'Clear time' })).toHaveClass(
      timePickerClassNames.clearButton,
    );
    const expand = screen.getByRole('button', { name: 'Show times' });
    expect(expand).toHaveClass(timePickerClassNames.expandButton);
    expect(expand.firstElementChild).toHaveClass(timePickerClassNames.expandIcon);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(timePickerClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(timePickerClassNames.surface);
    const [option] = screen.getAllByRole('option');
    expect(option).toHaveClass(timePickerClassNames.option);
    // TimePicker's options are its own, not Option (judgement 6).
    expect(option).not.toHaveClass(optionClassNames.root);
    expect(option.firstElementChild).toHaveClass(timePickerClassNames.checkIcon);
  });

  it('TimePicker: the empty row of the popup and the error message are parts', async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start time" />);
    await user.type(screen.getByRole('combobox', { name: 'Start time' }), 'zz');
    const empty = screen.getByText('No matching times', { selector: 'div' });
    expect(empty).toHaveClass(timePickerClassNames.emptyMessage);
    expect(empty.parentElement).toHaveClass(timePickerClassNames.surface);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveClass(timePickerClassNames.errorMessage);
  });

  it('DatePicker: root, input, buttons, and the calendar surface with its parts', async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Start date" clearable defaultValue={new Date(2025, 0, 15)} />);
    const input = screen.getByRole('textbox', { name: 'Start date' });
    expect(input).toHaveClass(datePickerClassNames.input);
    expect(input.parentElement?.parentElement).toHaveClass(datePickerClassNames.root);
    expect(screen.getByRole('button', { name: 'Clear date' })).toHaveClass(
      datePickerClassNames.clearButton,
    );
    const open = screen.getByRole('button', { name: 'Open calendar' });
    expect(open).toHaveClass(datePickerClassNames.openCalendarButton);
    await user.click(open);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass(datePickerClassNames.surface);
    const previous = within(dialog).getByRole('button', { name: 'Previous month' });
    expect(previous).toHaveClass(datePickerClassNames.previousMonthButton);
    expect(previous.parentElement).toHaveClass(datePickerClassNames.header);
    expect(within(dialog).getByRole('button', { name: 'Next month' })).toHaveClass(
      datePickerClassNames.nextMonthButton,
    );
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveClass(
      datePickerClassNames.heading,
    );
    const grid = within(dialog).getByRole('grid');
    expect(grid).toHaveClass(datePickerClassNames.grid);
    expect(within(grid).getAllByRole('columnheader')[0]).toHaveClass(datePickerClassNames.weekday);
    expect(within(grid).getAllByRole('button')[0]).toHaveClass(datePickerClassNames.day);
  });

  it('DatePicker: the error message is a part', async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="End date" />);
    await user.type(screen.getByRole('textbox', { name: 'End date' }), '02/31/2025{Enter}');
    expect(screen.getByRole('alert')).toHaveClass(datePickerClassNames.errorMessage);
  });

  it('SwatchPicker: root and swatches', () => {
    render(
      <SwatchPicker
        aria-label="Accent"
        items={[{ value: 'blue', color: '#0f6cbd', label: 'Blue' }]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Accent' })).toHaveClass(
      swatchPickerClassNames.root,
    );
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveClass(swatchPickerClassNames.swatch);
  });

  it("ColorPicker: root and the opacity row's caption and readout (0.7 layout)", () => {
    render(
      <ColorPicker
        aria-label="Accent color"
        defaultValue="#0f6cbd"
        showOpacity
        presets={[{ color: '#d13438', label: 'Red' }]}
      />,
    );
    const picker = screen.getByRole('group', { name: 'Accent color' });
    expect(picker).toHaveClass(colorPickerClassNames.root);
    // The opacity row's caption and readout, found by their classes rather than as the slider's
    // siblings: P3-color (Task C10) replaces the slider with an AlphaSlider and keeps both spans.
    expect(picker.querySelector(`.${colorPickerClassNames.opacityLabel}`)).toHaveTextContent(
      'Opacity',
    );
    expect(picker.querySelector(`.${colorPickerClassNames.opacityValue}`)).toHaveTextContent(
      '100%',
    );
    // The presets are a SwatchPicker, which keeps its own root class.
    expect(screen.getByRole('radiogroup')).toHaveClass(swatchPickerClassNames.root);
  });

  it('Rating: root, stars and their glyphs', () => {
    render(<Rating aria-label="Score" defaultValue={3} />);
    expect(screen.getByRole('radiogroup', { name: 'Score' })).toHaveClass(ratingClassNames.root);
    const [star] = screen.getAllByRole('radio');
    expect(star).toHaveClass(ratingClassNames.star);
    expect(star.querySelector('svg')).toHaveClass(ratingClassNames.icon);
  });

  it('RatingDisplay: root, stars (the outer span of a partly filled one), glyphs, value, count', () => {
    render(<RatingDisplay value={3.5} showValue count={12} locale="en-US" />);
    const root = screen.getByRole('img');
    expect(root).toHaveClass(ratingDisplayClassNames.root);
    const stars = Array.from(root.children).slice(0, 5);
    for (const star of stars) expect(star).toHaveClass(ratingDisplayClassNames.star);
    const partial = stars[3];
    const glyphs = Array.from(partial.querySelectorAll('svg'));
    expect(glyphs).toHaveLength(2);
    for (const glyph of glyphs) expect(glyph).toHaveClass(ratingDisplayClassNames.icon);
    // The clipping span of a partly filled star is a layout wrapper (judgement 27).
    expect(partial.lastElementChild).not.toHaveClass(ratingDisplayClassNames.star);
    expect(within(root).getByText('3.5')).toHaveClass(ratingDisplayClassNames.value);
    expect(within(root).getByText('(12)')).toHaveClass(ratingDisplayClassNames.count);
  });

  it('RatingDisplay: the one star of the compact layout', () => {
    render(<RatingDisplay value={4} compact locale="en-US" />);
    const root = screen.getByRole('img');
    const star = root.firstElementChild as HTMLElement;
    expect(star).toHaveClass(ratingDisplayClassNames.star);
    expect(star.querySelector('svg')).toHaveClass(ratingDisplayClassNames.icon);
    expect(within(root).getByText('4')).toHaveClass(ratingDisplayClassNames.value);
  });

  it('renders the classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <Field label="Email" required hint="Your work address">
          <Input contentBefore="@" />
        </Field>,
      ),
    );
    expect(host.firstElementChild).toHaveClass(fieldClassNames.root);
    expect(host.querySelector('label')).toHaveClass(fieldClassNames.label);
    const input = host.querySelector('input');
    expect(input).toHaveClass(inputClassNames.input);
    expect(input?.parentElement).toHaveClass(inputClassNames.root);
    expect(host.querySelector('p')).toHaveClass(fieldClassNames.hint);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/input/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case (the registry of Task A1 exists, nothing applies it yet); the first failure reads `Expected the element to have class:` followed by `wave-input`.

- [ ] **Step 3: Input, Textarea and Select (and the shared error message)**

`src/components/input/Input.tsx` — add after the `cn` import:

```tsx
import { inputClassNames } from '../../lib/classNames';
```

The shared error message gets a class channel (rule 8: each host writes its own member). In the JSDoc of `useControlErrorMessage`, before the `@internal` line, add:

```tsx
 * `partClassName` is the host's stable `errorMessage` class, first in the message's classes
 * (Input, Select and Textarea each pass their own).
 *
```

Before:

```tsx
export function useControlErrorMessage(
  error: string | boolean | undefined,
  errorMessageProps: InputErrorMessageProps | undefined,
  consumerAriaInvalid?: React.AriaAttributes['aria-invalid'],
): ControlErrorMessage {
```

After:

```tsx
export function useControlErrorMessage(
  error: string | boolean | undefined,
  errorMessageProps: InputErrorMessageProps | undefined,
  consumerAriaInvalid?: React.AriaAttributes['aria-invalid'],
  partClassName?: string,
): ControlErrorMessage {
```

Before (inside the same function):

```tsx
      className={cn('mt-1 block text-caption-1 text-error', messageClassName)}
```

After:

```tsx
      className={cn(partClassName, 'mt-1 block text-caption-1 text-error', messageClassName)}
```

Before (in `Input`):

```tsx
  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
  );
```

After:

```tsx
  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
    inputClassNames.errorMessage,
  );
```

Before (the bordered wrapper of the slot layout):

```tsx
        className={cn(
          'inline-flex h-8 w-full items-center rounded border border-input border-b-stroke-accessible bg-background text-body-1 text-foreground',
```

After:

```tsx
        className={cn(
          inputClassNames.root,
          'inline-flex h-8 w-full items-center rounded border border-input border-b-stroke-accessible bg-background text-body-1 text-foreground',
```

Before:

```tsx
        {hasBefore && renderSlot(contentBefore, 'span', 'shrink-0 ps-2')}
```

After:

```tsx
        {hasBefore &&
          renderSlot(contentBefore, 'span', cn(inputClassNames.contentBefore, 'shrink-0 ps-2'))}
```

Before:

```tsx
          className={cn(
            'h-full w-full min-w-0 bg-transparent px-2 text-body-1 text-foreground',
```

After:

```tsx
          className={cn(
            inputClassNames.input,
            'h-full w-full min-w-0 bg-transparent px-2 text-body-1 text-foreground',
```

Before:

```tsx
        {hasAfter && renderSlot(contentAfter, 'span', 'shrink-0 pe-2')}
```

After:

```tsx
        {hasAfter &&
          renderSlot(contentAfter, 'span', cn(inputClassNames.contentAfter, 'shrink-0 pe-2'))}
```

Before (the `<input>` without slot content, which is both root and `input`, judgement 11):

```tsx
        className={cn(
          'h-8 w-full rounded border border-input border-b-stroke-accessible bg-background px-3 text-body-1 text-foreground',
```

After:

```tsx
        className={cn(
          inputClassNames.root,
          inputClassNames.input,
          'h-8 w-full rounded border border-input border-b-stroke-accessible bg-background px-3 text-body-1 text-foreground',
```

`src/components/input/Textarea.tsx` — add after the `cn` import:

```tsx
import { textareaClassNames } from '../../lib/classNames';
```

Before:

```tsx
  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
  );
```

After:

```tsx
  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
    textareaClassNames.errorMessage,
  );
```

Before:

```tsx
      className={cn(
        'min-h-20 w-full resize-y rounded border border-input border-b-stroke-accessible bg-background px-3 py-2 text-body-1 text-foreground',
```

After:

```tsx
      className={cn(
        textareaClassNames.root,
        'min-h-20 w-full resize-y rounded border border-input border-b-stroke-accessible bg-background px-3 py-2 text-body-1 text-foreground',
```

`src/components/input/Select.tsx` — add after the `cn` import:

```tsx
import { selectClassNames } from '../../lib/classNames';
```

Before:

```tsx
  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
  );
```

After:

```tsx
  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
    selectClassNames.errorMessage,
  );
```

Before:

```tsx
      className={cn(
        'h-8 w-full appearance-none rounded border border-input border-b-stroke-accessible bg-background ps-3 pe-8 text-body-1 text-foreground',
```

After:

```tsx
      className={cn(
        selectClassNames.root,
        'h-8 w-full appearance-none rounded border border-input border-b-stroke-accessible bg-background ps-3 pe-8 text-body-1 text-foreground',
```

- [ ] **Step 4: Field and Label**

`src/components/input/Field.tsx` — add after the `cn` import:

```tsx
import { fieldClassNames } from '../../lib/classNames';
```

Before (`renderMessageIcon`):

```tsx
  if (icon !== undefined) {
    return slotRendersContent(icon)
      ? renderSlot(icon, 'span', MESSAGE_ICON_CLASSES, { 'aria-hidden': true })
      : null;
  }
  const Icon = MESSAGE_ICONS[state];
  return Icon ? (
    <span aria-hidden="true" className={MESSAGE_ICON_CLASSES}>
      <Icon size={12} />
    </span>
  ) : null;
```

After:

```tsx
  if (icon !== undefined) {
    return slotRendersContent(icon)
      ? renderSlot(icon, 'span', cn(fieldClassNames.validationMessageIcon, MESSAGE_ICON_CLASSES), {
          'aria-hidden': true,
        })
      : null;
  }
  const Icon = MESSAGE_ICONS[state];
  return Icon ? (
    <span
      aria-hidden="true"
      className={cn(fieldClassNames.validationMessageIcon, MESSAGE_ICON_CLASSES)}
    >
      <Icon size={12} />
    </span>
  ) : null;
```

Before:

```tsx
          className={cn('mt-1 flex items-start gap-1 text-caption-1', MESSAGE_COLORS[state])}
```

After:

```tsx
          className={cn(
            fieldClassNames.validationMessage,
            'mt-1 flex items-start gap-1 text-caption-1',
            MESSAGE_COLORS[state],
          )}
```

Before:

```tsx
        <p key="hint" id={hintId} className="mt-1 text-caption-1 text-muted-foreground">
```

After:

```tsx
        <p
          key="hint"
          id={hintId}
          className={cn(fieldClassNames.hint, 'mt-1 text-caption-1 text-muted-foreground')}
        >
```

Before:

```tsx
      className={cn('flex', horizontal ? 'flex-row items-start gap-x-3' : 'flex-col', className)}
```

After:

```tsx
      className={cn(
        fieldClassNames.root,
        'flex',
        horizontal ? 'flex-row items-start gap-x-3' : 'flex-col',
        className,
      )}
```

Before:

```tsx
          className={cn(
            'mb-1 text-body-1 font-semibold text-foreground',
```

After:

```tsx
          className={cn(
            fieldClassNames.label,
            'mb-1 text-body-1 font-semibold text-foreground',
```

Before:

```tsx
            <span aria-hidden="true" className="ms-0.5 text-error">
```

After:

```tsx
            <span aria-hidden="true" className={cn(fieldClassNames.required, 'ms-0.5 text-error')}>
```

`src/components/input/Label.tsx` — add after the `cn` import:

```tsx
import { labelClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn(
        disabled ? 'text-muted-foreground' : 'text-foreground',
```

After:

```tsx
      className={cn(
        labelClassNames.root,
        disabled ? 'text-muted-foreground' : 'text-foreground',
```

Before:

```tsx
        <span className="ms-1 text-error" aria-hidden="true">
```

After:

```tsx
        <span className={cn(labelClassNames.required, 'ms-1 text-error')} aria-hidden="true">
```

- [ ] **Step 5: Checkbox, RadioGroup and Switch**

`src/components/input/Checkbox.tsx` — add after the `cn` import:

```tsx
import { checkboxClassNames } from '../../lib/classNames';
```

Before:

```tsx
    <span id={labelTextId} className="text-body-1 text-foreground">
```

After:

```tsx
    <span id={labelTextId} className={cn(checkboxClassNames.label, 'text-body-1 text-foreground')}>
```

Before (the root `<label>`):

```tsx
      className={cn(
        // items-start: the box lines up with the first line of a label that wraps or has a second
```

After:

```tsx
      className={cn(
        checkboxClassNames.root,
        // items-start: the box lines up with the first line of a label that wraps or has a second
```

Before (the `role="checkbox"` button):

```tsx
        className={cn(
          // p-0 and the unchecked bg-transparent are set here, not left to the native reset, which
```

After:

```tsx
        className={cn(
          checkboxClassNames.indicator,
          // p-0 and the unchecked bg-transparent are set here, not left to the native reset, which
```

`src/components/input/RadioGroup.tsx` — add after the `cn` import:

```tsx
import { radioGroupClassNames, radioGroupItemClassNames } from '../../lib/classNames';
```

Before (the group):

```tsx
        className={cn(
          'relative flex',
          orientation === 'vertical' ? 'flex-col gap-2' : 'flex-row gap-4',
```

After:

```tsx
        className={cn(
          radioGroupClassNames.root,
          'relative flex',
          orientation === 'vertical' ? 'flex-col gap-2' : 'flex-row gap-4',
```

Before (the item's `<label>`, where `className` lands; rule 5):

```tsx
    <label
      className={cn(
        // items-start: the radio lines up with the first line of a label that wraps or has a
```

After:

```tsx
    <label
      className={cn(
        radioGroupItemClassNames.root,
        // items-start: the radio lines up with the first line of a label that wraps or has a
```

Before (the `role="radio"` button):

```tsx
        className={cn(
          // p-0 and bg-transparent are set here, not left to the native reset, which any app button
```

After:

```tsx
        className={cn(
          radioGroupItemClassNames.indicator,
          // p-0 and bg-transparent are set here, not left to the native reset, which any app button
```

Before:

```tsx
        <span id={labelTextId} className={cn('text-body-1 text-foreground', labelClassName)}>
```

After:

```tsx
        <span
          id={labelTextId}
          className={cn(radioGroupItemClassNames.label, 'text-body-1 text-foreground', labelClassName)}
        >
```

`src/components/input/Switch.tsx` — add after the `cn` import:

```tsx
import { switchClassNames } from '../../lib/classNames';
```

Before:

```tsx
    <span id={labelTextId} className="text-body-1 text-foreground">
```

After:

```tsx
    <span id={labelTextId} className={cn(switchClassNames.label, 'text-body-1 text-foreground')}>
```

Before (the root `<label>`):

```tsx
      className={cn(
        // items-start: the 20px track lines up with the 20px first line of a label that wraps or
```

After:

```tsx
      className={cn(
        switchClassNames.root,
        // items-start: the 20px track lines up with the 20px first line of a label that wraps or
```

Before (the `role="switch"` button):

```tsx
        className={cn(
          // The whole control is sized in px, like the Checkbox box and the radio circle: the thumb
```

After:

```tsx
        className={cn(
          switchClassNames.track,
          // The whole control is sized in px, like the Checkbox box and the radio circle: the thumb
```

Before (the thumb):

```tsx
          className={cn(
            'block h-[14px] w-[14px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
```

After:

```tsx
          className={cn(
            switchClassNames.thumb,
            'block h-[14px] w-[14px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
```

- [ ] **Step 6: SearchBox, Slider and SpinButton**

`src/components/input/SearchBox.tsx` — add after the `cn` import:

```tsx
import { searchBoxClassNames } from '../../lib/classNames';
```

Before (`splitButtonLike`: a merged Button's icon becomes content):

```tsx
    const iconNode = renderSlot(props.icon as Slot<'span'>, 'span', 'inline-flex', {
      'aria-hidden': true,
    });
```

After:

```tsx
    const iconNode = renderSlot(
      props.icon as Slot<'span'>,
      'span',
      cn(searchBoxClassNames.dismissIcon, 'inline-flex'),
      { 'aria-hidden': true },
    );
```

Before (`resolveDismiss`: the element a content slot renders):

```tsx
  const content =
    contentChildren === undefined
      ? React.createElement(Component, { 'aria-hidden': true, ...contentProps })
      : React.createElement(Component, { 'aria-hidden': true, ...contentProps }, contentChildren);
```

After:

```tsx
  // The element the slot renders carries the dismissIcon part class, before the slot's own.
  const iconProps = {
    'aria-hidden': true,
    ...contentProps,
    className: cn(searchBoxClassNames.dismissIcon, contentProps.className as string | undefined),
  };
  const content =
    contentChildren === undefined
      ? React.createElement(Component, iconProps)
      : React.createElement(Component, iconProps, contentChildren);
```

(A slot object without children keeps the default glyph inside its own element: that element is the part, the inner default glyph gets no second class.)

Before (the clear button's base props):

```tsx
      className: cn(
        // Padding and background set here (C-NATIVE): an app-wide `button` rule cannot fill it.
```

After:

```tsx
      className: cn(
        searchBoxClassNames.dismissButton,
        // Padding and background set here (C-NATIVE): an app-wide `button` rule cannot fill it.
```

Before:

```tsx
        : (dismissParts.content ?? <DismissIcon />);
```

After:

```tsx
        : (dismissParts.content ?? <DismissIcon className={searchBoxClassNames.dismissIcon} />);
```

Before (the root):

```tsx
      className={cn(
        // The root draws the field; the slots, the text and the clear button are laid out side by
```

After:

```tsx
      className={cn(
        searchBoxClassNames.root,
        // The root draws the field; the slots, the text and the clear button are laid out side by
```

Before:

```tsx
      <span className="flex shrink-0 items-center ps-2">
```

After:

```tsx
      <span className={cn(searchBoxClassNames.contentBefore, 'flex shrink-0 items-center ps-2')}>
```

Before:

```tsx
        className={cn(
          'h-full min-w-0 flex-1 appearance-none border-none bg-transparent px-2 text-body-1 text-foreground',
```

After:

```tsx
        className={cn(
          searchBoxClassNames.input,
          'h-full min-w-0 flex-1 appearance-none border-none bg-transparent px-2 text-body-1 text-foreground',
```

Before:

```tsx
        <span className="flex shrink-0 items-center pe-2">
```

After:

```tsx
        <span className={cn(searchBoxClassNames.contentAfter, 'flex shrink-0 items-center pe-2')}>
```

`src/components/input/Slider.tsx` — add after the `cn` import:

```tsx
import { sliderClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn(
        'w-full cursor-pointer appearance-none bg-transparent',
```

After:

```tsx
      className={cn(
        sliderClassNames.root,
        'w-full cursor-pointer appearance-none bg-transparent',
```

`src/components/input/SpinButton.tsx` — add after the `cn` import:

```tsx
import { spinButtonClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn(
        'relative inline-flex items-center rounded border border-input border-b-stroke-accessible bg-background',
```

After:

```tsx
      className={cn(
        spinButtonClassNames.root,
        'relative inline-flex items-center rounded border border-input border-b-stroke-accessible bg-background',
```

Before:

```tsx
        className={cn(stepButtonClass, 'border-e', !disabled && 'disabled:opacity-50')}
```

After:

```tsx
        className={cn(
          spinButtonClassNames.decrementButton,
          stepButtonClass,
          'border-e',
          !disabled && 'disabled:opacity-50',
        )}
```

Before:

```tsx
        className="h-8 w-12 min-w-0 border-none bg-transparent text-center text-body-1 text-foreground focus:outline-hidden disabled:cursor-not-allowed [appearance:textfield]"
```

After:

```tsx
        className={cn(
          spinButtonClassNames.input,
          'h-8 w-12 min-w-0 border-none bg-transparent text-center text-body-1 text-foreground focus:outline-hidden disabled:cursor-not-allowed [appearance:textfield]',
        )}
```

Before:

```tsx
        className={cn(stepButtonClass, 'border-s', !disabled && 'disabled:opacity-50')}
```

After:

```tsx
        className={cn(
          spinButtonClassNames.incrementButton,
          stepButtonClass,
          'border-s',
          !disabled && 'disabled:opacity-50',
        )}
```

- [ ] **Step 7: Option, OptionGroup, the listbox surface and the expand button**

`src/components/input/Option.tsx` — add after the `cn` import:

```tsx
import { optionClassNames, optionGroupClassNames } from '../../lib/classNames';
```

Before (`OptionImpl`):

```tsx
      className={cn(OPTION_CLASSES, selected && forcedColors.selectedContainer, className)}
    >
      {showCheck && <CheckIcon className={cn('shrink-0', !selected && 'invisible')} />}
      <span className="min-w-0 flex-1">{children ?? value}</span>
```

After:

```tsx
      className={cn(
        optionClassNames.root,
        OPTION_CLASSES,
        selected && forcedColors.selectedContainer,
        className,
      )}
    >
      {showCheck && (
        <CheckIcon className={cn(optionClassNames.checkIcon, 'shrink-0', !selected && 'invisible')} />
      )}
      <span className={cn(optionClassNames.content, 'min-w-0 flex-1')}>{children ?? value}</span>
```

Before (`OptionGroupImpl`, whose `className` was passed through without `cn()`, rule 1):

```tsx
      hidden={hidden || empty || undefined}
      className={className}
    >
      <div
        id={labelId}
        role="presentation"
        className="px-3 py-1 text-caption-1 font-semibold text-muted-foreground"
      >
        {label}
      </div>
      <ul role="group" aria-labelledby={labelId}>
```

After:

```tsx
      hidden={hidden || empty || undefined}
      className={cn(optionGroupClassNames.root, className)}
    >
      <div
        id={labelId}
        role="presentation"
        className={cn(
          optionGroupClassNames.label,
          'px-3 py-1 text-caption-1 font-semibold text-muted-foreground',
        )}
      >
        {label}
      </div>
      <ul role="group" aria-labelledby={labelId} className={optionGroupClassNames.list}>
```

Before (`ListboxSurfaceProps`):

```tsx
  /** Options draw a check mark while selected. @default true */
  showCheck?: boolean;
  children?: React.ReactNode;
}
```

After:

```tsx
  /** Options draw a check mark while selected. @default true */
  showCheck?: boolean;
  /** The host's stable class for the listbox element (its `listbox` part). */
  listboxClassName?: string;
  /** The host's stable class for the portaled surface (its `surface` part). */
  surfaceClassName?: string;
  children?: React.ReactNode;
}
```

Before (`ListboxSurface`):

```tsx
    showCheck = true,
    children,
  } = props;
```

After:

```tsx
    showCheck = true,
    listboxClassName,
    surfaceClassName,
    children,
  } = props;
```

Before:

```tsx
          className="min-h-0 max-h-60 overflow-auto"
```

After:

```tsx
          className={cn(listboxClassName, 'min-h-0 max-h-60 overflow-auto')}
```

Before:

```tsx
          className="flex flex-col overflow-hidden rounded border border-border bg-background py-1 text-foreground shadow-4"
```

After:

```tsx
          className={cn(
            surfaceClassName,
            'flex flex-col overflow-hidden rounded border border-border bg-background py-1 text-foreground shadow-4',
          )}
```

`src/components/input/Combobox.expand.tsx` (shared by Combobox and TimePicker) — before (the props interface's end):

```tsx
  /** Opens or closes the list and returns focus to the input. */
  onToggle: () => void;
}
```

After:

```tsx
  /** Opens or closes the list and returns focus to the input. */
  onToggle: () => void;
  /** The host's stable class for the button (its `expandButton` part). */
  className?: string;
  /** The host's stable class for the glyph `<span>` (its `expandIcon` part). */
  iconClassName?: string;
}
```

Before:

```tsx
  disabled,
  onToggle,
}: PickerExpandButtonProps) => {
```

After:

```tsx
  disabled,
  onToggle,
  className,
  iconClassName,
}: PickerExpandButtonProps) => {
```

Before:

```tsx
      className={cn(PICKER_ICON_BUTTON_CLASSES, 'end-1', focusRing, disabledStyles)}
```

After:

```tsx
      className={cn(className, PICKER_ICON_BUTTON_CLASSES, 'end-1', focusRing, disabledStyles)}
```

Before:

```tsx
        cn(
          'inline-flex transition-transform motion-reduce:transition-none',
          expanded && 'rotate-180',
        ),
```

After:

```tsx
        cn(
          iconClassName,
          'inline-flex transition-transform motion-reduce:transition-none',
          expanded && 'rotate-180',
        ),
```

- [ ] **Step 8: Combobox, Dropdown and TagPicker**

`src/components/input/Combobox.tsx` — add after the `cn` import:

```tsx
import { comboboxClassNames } from '../../lib/classNames';
```

Before:

```tsx
    <div {...rest} ref={rootMergedRef} className={cn('relative inline-flex flex-col', className)}>
```

After:

```tsx
    <div
      {...rest}
      ref={rootMergedRef}
      className={cn(comboboxClassNames.root, 'relative inline-flex flex-col', className)}
    >
```

Before (the input):

```tsx
          className={cn(
            inputBase,
            'border-b-stroke-accessible',
```

After:

```tsx
          className={cn(
            comboboxClassNames.input,
            inputBase,
            'border-b-stroke-accessible',
```

Before (the clear button):

```tsx
            className={cn(
              PICKER_ICON_BUTTON_CLASSES,
              showExpand ? 'end-7' : 'end-1',
```

After:

```tsx
            className={cn(
              comboboxClassNames.clearButton,
              PICKER_ICON_BUTTON_CLASSES,
              showExpand ? 'end-7' : 'end-1',
```

Before (the end of the `PickerExpandButton` element):

```tsx
            disabled={disabled || !!readOnly}
            onToggle={handleExpandClick}
          />
```

After:

```tsx
            disabled={disabled || !!readOnly}
            onToggle={handleExpandClick}
            className={comboboxClassNames.expandButton}
            iconClassName={comboboxClassNames.expandIcon}
          />
```

Before:

```tsx
        open={open}
        expanded={expanded}
        emptyContent={
          draft ? (
            <div aria-hidden="true" className="px-3 py-1.5 text-body-1 text-muted-foreground">
```

After:

```tsx
        open={open}
        expanded={expanded}
        listboxClassName={comboboxClassNames.listbox}
        surfaceClassName={comboboxClassNames.surface}
        emptyContent={
          draft ? (
            <div
              aria-hidden="true"
              className={cn(
                comboboxClassNames.emptyMessage,
                'px-3 py-1.5 text-body-1 text-muted-foreground',
              )}
            >
```

`src/components/input/Dropdown.tsx` — add after the `cn` import:

```tsx
import { dropdownClassNames } from '../../lib/classNames';
```

Before:

```tsx
    <div {...rest} ref={rootMergedRef} className={cn('relative inline-flex flex-col', className)}>
```

After:

```tsx
    <div
      {...rest}
      ref={rootMergedRef}
      className={cn(dropdownClassNames.root, 'relative inline-flex flex-col', className)}
    >
```

Before (the `role="combobox"` button):

```tsx
          className={cn(
            // Every padding is set here (C-NATIVE), not left to an app-wide `button` rule. The end
```

After:

```tsx
          className={cn(
            dropdownClassNames.button,
            // Every padding is set here (C-NATIVE), not left to an app-wide `button` rule. The end
```

Before:

```tsx
          <span className={cn('truncate', !displayText && 'text-muted-foreground')}>
```

After:

```tsx
          <span
            className={cn(dropdownClassNames.value, 'truncate', !displayText && 'text-muted-foreground')}
          >
```

Before:

```tsx
          <ChevronDownIcon
            className={cn(
              'absolute end-3 transition-transform motion-reduce:transition-none',
```

After:

```tsx
          <ChevronDownIcon
            className={cn(
              dropdownClassNames.expandIcon,
              'absolute end-3 transition-transform motion-reduce:transition-none',
```

Before:

```tsx
            className={cn(PICKER_ICON_BUTTON_CLASSES, 'end-7', focusRing, disabledStyles)}
```

After:

```tsx
            className={cn(
              dropdownClassNames.clearButton,
              PICKER_ICON_BUTTON_CLASSES,
              'end-7',
              focusRing,
              disabledStyles,
            )}
```

Before:

```tsx
        open={open}
        expanded={expanded}
        aria-label={fieldProps['aria-label']}
```

After:

```tsx
        open={open}
        expanded={expanded}
        listboxClassName={dropdownClassNames.listbox}
        surfaceClassName={dropdownClassNames.surface}
        aria-label={fieldProps['aria-label']}
```

`src/components/input/TagPicker.tsx` — add after the `cn` import:

```tsx
import { tagPickerClassNames } from '../../lib/classNames';
```

Before (`TagRemoveButton`):

```tsx
      className={cn(
        // Padding and background set here (C-NATIVE), not left to an app-wide rule.
```

After:

```tsx
      className={cn(
        tagPickerClassNames.removeButton,
        // Padding and background set here (C-NATIVE), not left to an app-wide rule.
```

Before:

```tsx
    <div {...rest} ref={rootMergedRef} className={cn('relative', className)}>
```

After:

```tsx
    <div {...rest} ref={rootMergedRef} className={cn(tagPickerClassNames.root, 'relative', className)}>
```

Before (the tag area):

```tsx
        className={cn(
          'flex flex-wrap items-center gap-1 rounded border border-input border-b-stroke-accessible bg-background px-2 py-1.5',
```

After:

```tsx
        className={cn(
          tagPickerClassNames.control,
          'flex flex-wrap items-center gap-1 rounded border border-input border-b-stroke-accessible bg-background px-2 py-1.5',
```

Before (the `role="list"` of tags):

```tsx
            className="flex flex-wrap items-center gap-1"
```

After:

```tsx
            className={cn(tagPickerClassNames.group, 'flex flex-wrap items-center gap-1')}
```

Before (each tag):

```tsx
                  className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-body-1 text-foreground"
```

After:

```tsx
                  className={cn(
                    tagPickerClassNames.tag,
                    'inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-body-1 text-foreground',
                  )}
```

Before (the input):

```tsx
          className="min-w-15 flex-1 bg-transparent py-0.5 text-body-1 text-foreground placeholder:text-muted-foreground focus:outline-hidden"
```

After:

```tsx
          className={cn(
            tagPickerClassNames.input,
            'min-w-15 flex-1 bg-transparent py-0.5 text-body-1 text-foreground placeholder:text-muted-foreground focus:outline-hidden',
          )}
```

Before:

```tsx
        showCheck={false}
        emptyContent={
          query !== '' ? (
            <div aria-hidden="true" className="px-3 py-1.5 text-body-1 text-muted-foreground">
```

After:

```tsx
        showCheck={false}
        listboxClassName={tagPickerClassNames.listbox}
        surfaceClassName={tagPickerClassNames.surface}
        emptyContent={
          query !== '' ? (
            <div
              aria-hidden="true"
              className={cn(
                tagPickerClassNames.emptyMessage,
                'px-3 py-1.5 text-body-1 text-muted-foreground',
              )}
            >
```

Before (the Options TagPicker renders: a nested public component gets the part class through its `className`, rule 4):

```tsx
            <Option key={item.value} value={item.value} label={item.label}>
```

After:

```tsx
            <Option
              key={item.value}
              value={item.value}
              label={item.label}
              className={tagPickerClassNames.option}
            >
```

- [ ] **Step 9: TimePicker and DatePicker**

`src/components/input/TimePicker.tsx` — add after the `cn` import:

```tsx
import { timePickerClassNames } from '../../lib/classNames';
```

Before (`TimePickerOption`, TimePicker's own option, not Option):

```tsx
    <li {...optionProps} className={cn(OPTION_CLASSES, selected && forcedColors.selectedContainer)}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
```

After:

```tsx
    <li
      {...optionProps}
      className={cn(
        timePickerClassNames.option,
        OPTION_CLASSES,
        selected && forcedColors.selectedContainer,
      )}
    >
      <span
        className={cn(
          timePickerClassNames.checkIcon,
          'flex h-4 w-4 shrink-0 items-center justify-center',
        )}
      >
```

Before (`renderListbox`, used for the hidden inline list and the list in the popup):

```tsx
      className="max-h-60 min-h-0 overflow-auto py-1 focus:outline-hidden"
```

After:

```tsx
      className={cn(
        timePickerClassNames.listbox,
        'max-h-60 min-h-0 overflow-auto py-1 focus:outline-hidden',
      )}
```

Before:

```tsx
      <div {...rest} ref={rootRefs} className={cn('relative inline-flex flex-col', className)}>
```

After:

```tsx
      <div
        {...rest}
        ref={rootRefs}
        className={cn(timePickerClassNames.root, 'relative inline-flex flex-col', className)}
      >
```

Before (the input):

```tsx
            className={cn(
              inputBase,
              'border-b-stroke-accessible',
```

After:

```tsx
            className={cn(
              timePickerClassNames.input,
              inputBase,
              'border-b-stroke-accessible',
```

Before (the clear button):

```tsx
              className={cn(
                PICKER_ICON_BUTTON_CLASSES,
                showExpand ? 'end-7' : 'end-1',
```

After:

```tsx
              className={cn(
                timePickerClassNames.clearButton,
                PICKER_ICON_BUTTON_CLASSES,
                showExpand ? 'end-7' : 'end-1',
```

Before:

```tsx
              disabled={disabled || !!readOnly}
              onToggle={handleExpandClick}
            />
```

After:

```tsx
              disabled={disabled || !!readOnly}
              onToggle={handleExpandClick}
              className={timePickerClassNames.expandButton}
              iconClassName={timePickerClassNames.expandIcon}
            />
```

Before:

```tsx
          <p id={errorId} role="alert" className="mt-1 text-caption-1 text-error">
```

After:

```tsx
          <p
            id={errorId}
            role="alert"
            className={cn(timePickerClassNames.errorMessage, 'mt-1 text-caption-1 text-error')}
          >
```

Before (the popup):

```tsx
              className="flex flex-col overflow-hidden rounded border border-border bg-background shadow-8"
            >
              {hasMatches ? (
                renderListbox(false)
              ) : (
                <div aria-hidden="true" className="px-3 py-1.5 text-body-1 text-muted-foreground">
```

After:

```tsx
              className={cn(
                timePickerClassNames.surface,
                'flex flex-col overflow-hidden rounded border border-border bg-background shadow-8',
              )}
            >
              {hasMatches ? (
                renderListbox(false)
              ) : (
                <div
                  aria-hidden="true"
                  className={cn(
                    timePickerClassNames.emptyMessage,
                    'px-3 py-1.5 text-body-1 text-muted-foreground',
                  )}
                >
```

`src/components/input/DatePicker.tsx` — add after the `cn` import:

```tsx
import { datePickerClassNames } from '../../lib/classNames';
```

Before:

```tsx
    <div {...rest} ref={ref} className={cn('relative inline-flex flex-col', className)}>
```

After:

```tsx
    <div
      {...rest}
      ref={ref}
      className={cn(datePickerClassNames.root, 'relative inline-flex flex-col', className)}
    >
```

Before (the input):

```tsx
          className={cn(
            inputBase,
            'border-b-stroke-accessible',
```

After:

```tsx
          className={cn(
            datePickerClassNames.input,
            inputBase,
            'border-b-stroke-accessible',
```

Before:

```tsx
            className={cn(ICON_BUTTON_CLASSES, 'end-7', focusRing, disabledStyles)}
```

After:

```tsx
            className={cn(
              datePickerClassNames.clearButton,
              ICON_BUTTON_CLASSES,
              'end-7',
              focusRing,
              disabledStyles,
            )}
```

Before:

```tsx
          className={cn(ICON_BUTTON_CLASSES, 'end-1', focusRing, disabledStyles)}
```

After:

```tsx
          className={cn(
            datePickerClassNames.openCalendarButton,
            ICON_BUTTON_CLASSES,
            'end-1',
            focusRing,
            disabledStyles,
          )}
```

Before:

```tsx
        <p id={errorId} role="alert" className="mt-1 text-caption-1 text-error">
```

After:

```tsx
        <p
          id={errorId}
          role="alert"
          className={cn(datePickerClassNames.errorMessage, 'mt-1 text-caption-1 text-error')}
        >
```

Before (the calendar `role="dialog"` and its header row):

```tsx
            className="rounded-md border border-border bg-background p-3 text-foreground shadow-16"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
```

After:

```tsx
            className={cn(
              datePickerClassNames.surface,
              'rounded-md border border-border bg-background p-3 text-foreground shadow-16',
            )}
          >
            <div
              className={cn(datePickerClassNames.header, 'mb-2 flex items-center justify-between gap-2')}
            >
```

Before (the two navigation buttons and the heading; the same class line occurs twice, so the aria-label lines anchor each):

```tsx
                aria-label={labels?.previousMonth ?? 'Previous month'}
                aria-controls={gridId}
                {...focusableDisabledProps(previousDisabled)}
                onClick={preventIfDisabled(previousDisabled, () => navigateMonth(-1))}
                className={cn(NAV_BUTTON_CLASSES, focusRing, disabledStyles)}
```

After:

```tsx
                aria-label={labels?.previousMonth ?? 'Previous month'}
                aria-controls={gridId}
                {...focusableDisabledProps(previousDisabled)}
                onClick={preventIfDisabled(previousDisabled, () => navigateMonth(-1))}
                className={cn(
                  datePickerClassNames.previousMonthButton,
                  NAV_BUTTON_CLASSES,
                  focusRing,
                  disabledStyles,
                )}
```

Before:

```tsx
              <h2 id={headingId} aria-live="polite" className="text-body-1 font-semibold">
```

After:

```tsx
              <h2
                id={headingId}
                aria-live="polite"
                className={cn(datePickerClassNames.heading, 'text-body-1 font-semibold')}
              >
```

Before:

```tsx
                aria-label={labels?.nextMonth ?? 'Next month'}
                aria-controls={gridId}
                {...focusableDisabledProps(nextDisabled)}
                onClick={preventIfDisabled(nextDisabled, () => navigateMonth(1))}
                className={cn(NAV_BUTTON_CLASSES, focusRing, disabledStyles)}
```

After:

```tsx
                aria-label={labels?.nextMonth ?? 'Next month'}
                aria-controls={gridId}
                {...focusableDisabledProps(nextDisabled)}
                onClick={preventIfDisabled(nextDisabled, () => navigateMonth(1))}
                className={cn(
                  datePickerClassNames.nextMonthButton,
                  NAV_BUTTON_CLASSES,
                  focusRing,
                  disabledStyles,
                )}
```

Before (the `role="grid"` element):

```tsx
              className="border-collapse"
```

After:

```tsx
              className={cn(datePickerClassNames.grid, 'border-collapse')}
```

Before (each weekday header cell):

```tsx
                      className="h-8 w-8 text-center text-caption-1 font-normal text-muted-foreground"
```

After:

```tsx
                      className={cn(
                        datePickerClassNames.weekday,
                        'h-8 w-8 text-center text-caption-1 font-normal text-muted-foreground',
                      )}
```

Before (each day button):

```tsx
                            className={cn(
                              DAY_CLASSES,
```

After:

```tsx
                            className={cn(
                              datePickerClassNames.day,
                              DAY_CLASSES,
```

(The glyphs inside the clear, open-calendar and month buttons stay unclassed: the whole, uncontrolled content of a button part, judgement 26.)

- [ ] **Step 10: SwatchPicker, ColorPicker, Rating and RatingDisplay**

`src/components/input/SwatchPicker.tsx` — add after the `cn` import:

```tsx
import { swatchPickerClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn('relative flex flex-wrap gap-2', className)}
```

After:

```tsx
      className={cn(swatchPickerClassNames.root, 'relative flex flex-wrap gap-2', className)}
```

Before:

```tsx
            className={cn(
              sizeMap[size],
              shapeMap[shape],
```

After:

```tsx
            className={cn(
              swatchPickerClassNames.swatch,
              sizeMap[size],
              shapeMap[shape],
```

`src/components/input/ColorPicker.tsx` (0.7 layout; only `colorPickerClassNames`, the hex field, presets and preview parts are 0.8 and P3-color's) — add after the `cn` import:

```tsx
import { colorPickerClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn(
        'relative inline-flex flex-col gap-3 rounded border border-border bg-background p-3 shadow-4',
        className,
      )}
```

After:

```tsx
      className={cn(
        colorPickerClassNames.root,
        'relative inline-flex flex-col gap-3 rounded border border-border bg-background p-3 shadow-4',
        className,
      )}
```

Before:

```tsx
          <span className="w-14 text-caption-1 text-muted-foreground">{strings.opacity}</span>
```

After:

```tsx
          <span
            className={cn(colorPickerClassNames.opacityLabel, 'w-14 text-caption-1 text-muted-foreground')}
          >
            {strings.opacity}
          </span>
```

Before:

```tsx
          <span className="w-10 text-end text-caption-1 text-muted-foreground">{opacity}%</span>
```

After:

```tsx
          <span
            className={cn(
              colorPickerClassNames.opacityValue,
              'w-10 text-end text-caption-1 text-muted-foreground',
            )}
          >
            {opacity}%
          </span>
```

`src/components/input/Rating.tsx` — add after the `cn` import:

```tsx
import { ratingClassNames, ratingDisplayClassNames } from '../../lib/classNames';
```

Before (`Rating`'s root):

```tsx
      className={cn(
        'relative inline-flex items-center gap-0.5',
        disabled && 'pointer-events-none opacity-50',
```

After:

```tsx
      className={cn(
        ratingClassNames.root,
        'relative inline-flex items-center gap-0.5',
        disabled && 'pointer-events-none opacity-50',
```

Before (each star button):

```tsx
            className={cn(
              'inline-flex cursor-pointer rounded border-0 bg-transparent transition-colors motion-reduce:transition-none disabled:cursor-not-allowed',
```

After:

```tsx
            className={cn(
              ratingClassNames.star,
              'inline-flex cursor-pointer rounded border-0 bg-transparent transition-colors motion-reduce:transition-none disabled:cursor-not-allowed',
```

Before (its glyph; the same `<Star …>` line also occurs in RatingDisplay, so the `</button>` line anchors this one):

```tsx
            <Star filled={filled} className={starSize} />
          </button>
```

After:

```tsx
            <Star filled={filled} className={cn(ratingClassNames.icon, starSize)} />
          </button>
```

Before (`RatingDisplay`'s root):

```tsx
      className={cn('inline-flex items-center gap-0.5', className)}
```

After:

```tsx
      className={cn(ratingDisplayClassNames.root, 'inline-flex items-center gap-0.5', className)}
```

Before (the compact star):

```tsx
        <span className="inline-flex text-rating">
          <Star filled className={starSize} />
        </span>
```

After:

```tsx
        <span className={cn(ratingDisplayClassNames.star, 'inline-flex text-rating')}>
          <Star filled className={cn(ratingDisplayClassNames.icon, starSize)} />
        </span>
```

Before (a partly filled star: the outer span is the star, the clipping span is a layout wrapper):

```tsx
              <span key={i} className="relative inline-flex text-stroke-accessible">
                <Star filled={false} className={starSize} />
                <span
                  className="absolute inset-y-0 start-0 flex overflow-hidden text-rating"
                  style={{ width: `${percent}%` }}
                >
                  <Star filled className={cn(starSize, 'shrink-0')} />
                </span>
              </span>
```

After:

```tsx
              <span
                key={i}
                className={cn(ratingDisplayClassNames.star, 'relative inline-flex text-stroke-accessible')}
              >
                <Star filled={false} className={cn(ratingDisplayClassNames.icon, starSize)} />
                <span
                  className="absolute inset-y-0 start-0 flex overflow-hidden text-rating"
                  style={{ width: `${percent}%` }}
                >
                  <Star filled className={cn(ratingDisplayClassNames.icon, starSize, 'shrink-0')} />
                </span>
              </span>
```

Before (a full or empty star):

```tsx
            <span
              key={i}
              className={cn('inline-flex', filled ? 'text-rating' : 'text-stroke-accessible')}
            >
              <Star filled={filled} className={starSize} />
            </span>
```

After:

```tsx
            <span
              key={i}
              className={cn(
                ratingDisplayClassNames.star,
                'inline-flex',
                filled ? 'text-rating' : 'text-stroke-accessible',
              )}
            >
              <Star filled={filled} className={cn(ratingDisplayClassNames.icon, starSize)} />
            </span>
```

Before:

```tsx
        <span className={cn('ms-1 font-semibold text-foreground', textSize)}>{formattedValue}</span>
```

After:

```tsx
        <span className={cn(ratingDisplayClassNames.value, 'ms-1 font-semibold text-foreground', textSize)}>
          {formattedValue}
        </span>
```

Before:

```tsx
        <span className={cn('ms-1 text-muted-foreground', textSize)}>({formattedCount})</span>
```

After:

```tsx
        <span className={cn(ratingDisplayClassNames.count, 'ms-1 text-muted-foreground', textSize)}>
          ({formattedCount})
        </span>
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `npx vitest run src/components/input/__tests__/stableClassNames.test.tsx`
Expected: PASS (every case).

- [ ] **Step 12: Check the folder's existing class assertions**

Run: `grep -rnE "toHaveAttribute\('class'|\.className\)\.toBe\(|getAttribute\('class'\)\)\.toBe\(|classList\)\.toEqual|toMatchInlineSnapshot|toMatchSnapshot" src/components/input/__tests__`
Expected: no output. The folder's class assertions are `toHaveClass` subsets and negative regexes (`className).not.toMatch(…)` in Checkbox, ColorPicker, Combobox, DatePicker, Dropdown, Field, Input, RadioGroup, SearchBox, Select, Slider, SpinButton, SwatchPicker, Switch, TagPicker tests: opacity, `pe-`/`p[lr]-`, `(left|right)-`, `(start|end)-\d`, raw colors, `rtl:`, `ring`, `(h|w|size)-\d`); no pattern matches a `wave-…` class, so none changes (spec §6.4 lists none for this folder). If the grep finds a line, update only its class list: the helper's or literal classes plus the registry classes the element carries, read from the constants.

- [ ] **Step 13: Folder checks**

Run:

```bash
npx vitest run src/components/input
npx vitest run src/components/input/__tests__/stableClassNames.test.tsx --reporter=default
npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/"
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/input --max-warnings 0
node scripts/build-css.mjs
```

Expected: all pass; the `--reporter=default` run shows no act() warning and no `[WaveUI]` line besides the asserted SearchBox one (the spy swallows it); `build-css` passes (the added comments name no utility).

- [ ] **Step 14: Commit**

```bash
git add src/components/input/__tests__/stableClassNames.test.tsx src/components/input/Input.tsx src/components/input/Textarea.tsx src/components/input/Select.tsx src/components/input/Field.tsx src/components/input/Label.tsx src/components/input/Checkbox.tsx src/components/input/RadioGroup.tsx src/components/input/Switch.tsx src/components/input/SearchBox.tsx src/components/input/Slider.tsx src/components/input/SpinButton.tsx src/components/input/Option.tsx src/components/input/Combobox.expand.tsx src/components/input/Combobox.tsx src/components/input/Dropdown.tsx src/components/input/TagPicker.tsx src/components/input/TimePicker.tsx src/components/input/DatePicker.tsx src/components/input/SwatchPicker.tsx src/components/input/ColorPicker.tsx src/components/input/Rating.tsx
git commit -m "feat(input): stable class names"
```

---

### Task A8: Stable class names — layout folder

**Files:**
- Create: `src/components/layout/__tests__/stableClassNames.test.tsx`
- Modify (classes only, spec §0.2 rule 19): `src/components/layout/Card.tsx`, `Accordion.tsx`, `TabList.tsx`, `Tree.tsx`, `Carousel.tsx`, `Overflow.tsx`, `Stack.tsx`, `Flex.tsx`, `Grid.tsx`
- Unchanged: `disclosureIds.ts`, `index.ts`

**Interfaces:**
- Consumes (Task A1, `src/lib/classNames.ts`): `cardClassNames` {root, checkbox, checkmark}, `cardHeaderClassNames` {root, title, subtitle}, `cardBodyClassNames` {root}, `cardFooterClassNames` {root}, `accordionClassNames` {root}, `accordionItemClassNames` {root}, `accordionTriggerClassNames` {root, heading, expandIcon}, `accordionPanelClassNames` {root}, `tabListClassNames` {root}, `tabListTabClassNames` {root}, `tabListPanelClassNames` {root}, `tabListPanelsClassNames` {root}, `treeClassNames` {root}, `treeItemClassNames` {root, row, expandIcon, icon, label, group} (its 0.8 keys `indicator`, `iconAfter`, `aside`, `actions` are P3-tree's and stay on `PENDING_CLASS_NAMES`), `treeItemPersonaLayoutClassNames` (0.8, not applied), `carouselClassNames` {root, autoPlayButton, track, slide, previousButton, nextButton, picker, pickerButton, pickerIndicator}, `carouselItemClassNames` {root}, `overflowClassNames` {root, overflowButton}, `overflowItemClassNames` {root}, `stackClassNames`, `flexClassNames`, `gridClassNames` {root}.
- Produces: nothing new (no shared renderer here needs a class channel; every class is written in the module that sets the part's `displayName`, rule 8).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/__tests__/stableClassNames.test.tsx`:

```tsx
/**
 * Stable class names of the layout folder (spec P3-00, Appendix A "layout"): every root and part
 * carries its registered class on the element the registry names, in every layout where it
 * renders, on the server too. The values are read from the registry, never written as literals.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  accordionClassNames,
  accordionItemClassNames,
  accordionPanelClassNames,
  accordionTriggerClassNames,
  cardBodyClassNames,
  cardClassNames,
  cardFooterClassNames,
  cardHeaderClassNames,
  carouselClassNames,
  carouselItemClassNames,
  flexClassNames,
  gridClassNames,
  overflowClassNames,
  overflowItemClassNames,
  stackClassNames,
  tabListClassNames,
  tabListPanelClassNames,
  tabListPanelsClassNames,
  tabListTabClassNames,
  treeClassNames,
  treeItemClassNames,
} from '../../../lib/classNames';
import { Accordion } from '../Accordion';
import { Card } from '../Card';
import { Carousel } from '../Carousel';
import { Flex } from '../Flex';
import { Grid } from '../Grid';
import { Overflow } from '../Overflow';
import { Stack } from '../Stack';
import { TabList } from '../TabList';
import { Tree } from '../Tree';

/** Server HTML in a detached element (never appended: src/test-setup.ts checks document.body). */
function parse(html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/** A wrapper component around a Trigger: the Item renders the heading around it. */
function Wrap({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * jsdom has no layout: the Overflow row and its items get widths by `data-testid` (the wrapper of
 * the overflow button by the key `button`), as in Overflow.test.tsx. Returns the restore function.
 */
function stubOverflowWidths(widths: Record<string, number>): () => void {
  const targets: Array<[object, string]> = [
    [HTMLElement.prototype, 'offsetWidth'],
    [Element.prototype, 'clientWidth'],
    [Element.prototype, 'scrollWidth'],
  ];
  const saved = targets.map(([proto, name]) => Object.getOwnPropertyDescriptor(proto, name));
  const width = (el: Element): number => {
    if (el.hasAttribute('data-overflow-hidden')) return 0;
    const key = el.hasAttribute('data-overflow-button') ? 'button' : el.getAttribute('data-testid');
    return key !== null && key in widths ? widths[key] : 0;
  };
  for (const [proto, name] of targets) {
    Object.defineProperty(proto, name, {
      configurable: true,
      get(this: Element) {
        return width(this);
      },
    });
  }
  return () => {
    targets.forEach(([proto, name], i) => {
      const descriptor = saved[i];
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else Reflect.deleteProperty(proto, name);
    });
  };
}

describe('stable class names: layout folder', () => {
  it('Card: root, built-in checkbox, header with title and subtitle, body and footer', () => {
    render(
      <Card onSelect={() => {}} selected selectionControl="checkbox">
        <Card.Header title="Report" subtitle="Weekly" />
        <Card.Body>Body text</Card.Body>
        <Card.Footer>Footer text</Card.Footer>
      </Card>,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Report' });
    expect(checkbox).toHaveClass(cardClassNames.checkbox);
    expect(checkbox.parentElement).toHaveClass(cardClassNames.root);
    const title = screen.getByText('Report');
    expect(title).toHaveClass(cardHeaderClassNames.title);
    expect(title.parentElement).toHaveClass(cardHeaderClassNames.root);
    expect(screen.getByText('Weekly')).toHaveClass(cardHeaderClassNames.subtitle);
    expect(screen.getByText('Body text')).toHaveClass(cardBodyClassNames.root);
    expect(screen.getByText('Footer text')).toHaveClass(cardFooterClassNames.root);
  });

  it('Card: the check glyph of a selected card', () => {
    render(
      <Card data-testid="plan" onSelect={() => {}} selected>
        Plan
      </Card>,
    );
    const card = screen.getByTestId('plan');
    expect(card).toHaveClass(cardClassNames.root);
    expect(card.querySelector('svg')).toHaveClass(cardClassNames.checkmark);
  });

  it('Accordion: root, item, trigger with its heading and chevron, panel', () => {
    render(
      <Accordion defaultOpenItem="shipping">
        <Accordion.Item value="shipping">
          <Accordion.Trigger>Shipping</Accordion.Trigger>
          <Accordion.Panel>Ships in two days</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const trigger = screen.getByRole('button', { name: 'Shipping' });
    expect(trigger).toHaveClass(accordionTriggerClassNames.root);
    expect(trigger.querySelector('svg')).toHaveClass(accordionTriggerClassNames.expandIcon);
    // The heading sits outside the trigger's className target and keeps its part class.
    const heading = screen.getByRole('heading', { name: 'Shipping' });
    expect(heading).toHaveClass(accordionTriggerClassNames.heading);
    const item = heading.parentElement as HTMLElement;
    expect(item).toHaveClass(accordionItemClassNames.root);
    expect(item.parentElement).toHaveClass(accordionClassNames.root);
    expect(screen.getByRole('region', { name: 'Shipping' })).toHaveClass(
      accordionPanelClassNames.root,
    );
  });

  it('Accordion: the heading the item renders around a wrapped trigger is the heading part', () => {
    render(
      <Accordion>
        <Accordion.Item value="returns">
          <Wrap>
            <Accordion.Trigger>Returns</Accordion.Trigger>
          </Wrap>
          <Accordion.Panel>Within 30 days</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getByRole('heading', { name: 'Returns' })).toHaveClass(
      accordionTriggerClassNames.heading,
    );
  });

  it('TabList: the tablist element (not its wrapper), tabs, panels and the panels container', () => {
    render(
      <TabList aria-label="Sections" defaultValue="overview">
        <TabList.Tab value="overview">Overview</TabList.Tab>
        <TabList.Panels>
          <TabList.Panel value="overview">Overview panel</TabList.Panel>
        </TabList.Panels>
      </TabList>,
    );
    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    expect(tablist).toHaveClass(tabListClassNames.root);
    expect(tablist.parentElement).not.toHaveClass(tabListClassNames.root);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveClass(tabListTabClassNames.root);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveClass(tabListPanelClassNames.root);
    expect(panel.parentElement).toHaveClass(tabListPanelsClassNames.root);
  });

  it('Tree: root, item, row, chevron, icon, label and group', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Tree.Item value="docs" icon={<svg data-testid="folder-icon" />}>
          Documents
          <Tree.Item value="cv">CV.pdf</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('tree', { name: 'Files' })).toHaveClass(treeClassNames.root);
    const docs = screen.getByRole('treeitem', { name: 'Documents' });
    expect(docs).toHaveClass(treeItemClassNames.root);
    const row = docs.firstElementChild as HTMLElement;
    expect(row).toHaveClass(treeItemClassNames.row);
    expect(row.firstElementChild).toHaveClass(treeItemClassNames.expandIcon);
    expect(screen.getByTestId('folder-icon').parentElement).toHaveClass(treeItemClassNames.icon);
    expect(screen.getByText('Documents')).toHaveClass(treeItemClassNames.label);
    expect(screen.getByRole('group')).toHaveClass(treeItemClassNames.group);
  });

  it('Carousel: root, rotation button, track, slides, arrows, picker with buttons and dots; items', () => {
    render(
      <Carousel autoPlay>
        <Carousel.Item>Slide one</Carousel.Item>
        <Carousel.Item>Slide two</Carousel.Item>
      </Carousel>,
    );
    expect(screen.getByRole('region', { name: 'Carousel' })).toHaveClass(carouselClassNames.root);
    expect(screen.getByRole('button', { name: /slide rotation/ })).toHaveClass(
      carouselClassNames.autoPlayButton,
    );
    const slide = screen.getByRole('group', { name: 'Slide 1 of 2' });
    expect(slide).toHaveClass(carouselClassNames.slide);
    expect(slide.parentElement).toHaveClass(carouselClassNames.track);
    expect(screen.getByText('Slide one')).toHaveClass(carouselItemClassNames.root);
    expect(screen.getByRole('button', { name: 'Previous slide' })).toHaveClass(
      carouselClassNames.previousButton,
    );
    expect(screen.getByRole('button', { name: 'Next slide' })).toHaveClass(
      carouselClassNames.nextButton,
    );
    const picker = screen.getByRole('group', { name: 'Choose slide' });
    expect(picker).toHaveClass(carouselClassNames.picker);
    const [pickerButton] = within(picker).getAllByRole('button');
    expect(pickerButton).toHaveClass(carouselClassNames.pickerButton);
    expect(pickerButton.firstElementChild).toHaveClass(carouselClassNames.pickerIndicator);
  });

  it('Carousel: the root without slides', () => {
    render(<Carousel data-testid="empty" />);
    expect(screen.getByTestId('empty')).toHaveClass(carouselClassNames.root);
  });

  it('Overflow: root, items and the wrapper of the overflow button', () => {
    const restore = stubOverflowWidths({ overflow: 60, 'item-a': 40, 'item-b': 40, button: 20 });
    try {
      render(
        <Overflow
          data-testid="overflow"
          overflowButton={(count) => <button type="button">+{count}</button>}
        >
          <Overflow.Item itemId="a" data-testid="item-a">
            A
          </Overflow.Item>
          <Overflow.Item itemId="b" data-testid="item-b">
            B
          </Overflow.Item>
        </Overflow>,
      );
      expect(screen.getByTestId('overflow')).toHaveClass(overflowClassNames.root);
      expect(screen.getByTestId('item-a')).toHaveClass(overflowItemClassNames.root);
      expect(screen.getByTestId('item-b')).toHaveClass(overflowItemClassNames.root);
      expect(screen.getByRole('button', { name: '+1' }).parentElement).toHaveClass(
        overflowClassNames.overflowButton,
      );
    } finally {
      restore();
    }
  });

  it('Stack, Flex and Grid: the rendered element is the root', () => {
    render(
      <>
        <Stack data-testid="stack" />
        <Flex data-testid="flex" />
        <Grid data-testid="grid" />
      </>,
    );
    expect(screen.getByTestId('stack')).toHaveClass(stackClassNames.root);
    expect(screen.getByTestId('flex')).toHaveClass(flexClassNames.root);
    expect(screen.getByTestId('grid')).toHaveClass(gridClassNames.root);
  });

  it('renders the classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <>
          <Card>
            <Card.Header title="Report" />
          </Card>
          <Tree aria-label="Files" defaultExpandedItems={['docs']}>
            <Tree.Item value="docs">
              Documents
              <Tree.Item value="cv">CV.pdf</Tree.Item>
            </Tree.Item>
          </Tree>
        </>,
      ),
    );
    const card = host.firstElementChild as HTMLElement;
    expect(card).toHaveClass(cardClassNames.root);
    expect(card.firstElementChild).toHaveClass(cardHeaderClassNames.root);
    expect(host.querySelector('[role="tree"]')).toHaveClass(treeClassNames.root);
    expect(host.querySelector('[role="treeitem"]')).toHaveClass(treeItemClassNames.root);
    expect(host.querySelector('[data-tree-row]')).toHaveClass(treeItemClassNames.row);
    expect(host.querySelector('[role="group"]')).toHaveClass(treeItemClassNames.group);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/layout/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case; the first failure reads `Expected the element to have class:` followed by `wave-card__checkbox`.

- [ ] **Step 3: Card**

`src/components/layout/Card.tsx` — add after the `cn` import:

```tsx
import {
  cardBodyClassNames,
  cardClassNames,
  cardFooterClassNames,
  cardHeaderClassNames,
} from '../../lib/classNames';
```

Before (`CardRoot`):

```tsx
        className={cn(
          'overflow-hidden rounded-md border border-border bg-card shadow-4',
```

After:

```tsx
        className={cn(
          cardClassNames.root,
          'overflow-hidden rounded-md border border-border bg-card shadow-4',
```

Before:

```tsx
            className={cn(
              'absolute end-3 top-3 m-0 size-4 cursor-pointer accent-primary',
              focusRing,
            )}
```

After:

```tsx
            className={cn(
              cardClassNames.checkbox,
              'absolute end-3 top-3 m-0 size-4 cursor-pointer accent-primary',
              focusRing,
            )}
```

Before:

```tsx
          <CheckIcon size={12} className="absolute end-2 top-2 text-primary" />
```

After:

```tsx
          <CheckIcon
            size={12}
            className={cn(cardClassNames.checkmark, 'absolute end-2 top-2 text-primary')}
          />
```

Before (`CardHeader`):

```tsx
    <Component ref={ref} className={cn('p-4', titleId && 'pe-10', className)} {...rest}>
      {hasTitle && (
        <div id={titleId ?? undefined} className="text-subtitle-1">
          {materialiseSlotContent(title)}
        </div>
      )}
      {hasSubtitle && (
        <div className="text-caption-1 text-muted-foreground">
```

After:

```tsx
    <Component
      ref={ref}
      className={cn(cardHeaderClassNames.root, 'p-4', titleId && 'pe-10', className)}
      {...rest}
    >
      {hasTitle && (
        <div id={titleId ?? undefined} className={cn(cardHeaderClassNames.title, 'text-subtitle-1')}>
          {materialiseSlotContent(title)}
        </div>
      )}
      {hasSubtitle && (
        <div className={cn(cardHeaderClassNames.subtitle, 'text-caption-1 text-muted-foreground')}>
```

Before (`CardBody`):

```tsx
  return <Component ref={ref} className={cn('p-4 pt-0', className)} {...rest} />;
```

After:

```tsx
  return (
    <Component ref={ref} className={cn(cardBodyClassNames.root, 'p-4 pt-0', className)} {...rest} />
  );
```

Before (`CardFooter`):

```tsx
    <Component ref={ref} className={cn('flex justify-end gap-2 p-4 pt-0', className)} {...rest} />
```

After:

```tsx
    <Component
      ref={ref}
      className={cn(cardFooterClassNames.root, 'flex justify-end gap-2 p-4 pt-0', className)}
      {...rest}
    />
```

- [ ] **Step 4: Accordion and TabList**

`src/components/layout/Accordion.tsx` — add after the `cn` import:

```tsx
import {
  accordionClassNames,
  accordionItemClassNames,
  accordionPanelClassNames,
  accordionTriggerClassNames,
} from '../../lib/classNames';
```

Before (`AccordionRoot`):

```tsx
            <div ref={ref} className={cn('divide-y divide-border', className)} {...rest}>
```

After:

```tsx
            <div
              ref={ref}
              className={cn(accordionClassNames.root, 'divide-y divide-border', className)}
              {...rest}
            >
```

Before (`AccordionItem`: the heading it renders around a wrapped Trigger is the Trigger's `heading` part, Appendix A):

```tsx
          <Heading key={key} className={HEADING_CLASS}>
```

After:

```tsx
          <Heading key={key} className={cn(accordionTriggerClassNames.heading, HEADING_CLASS)}>
```

Before (`AccordionItem`'s root):

```tsx
        <div ref={ref} data-state={isOpen ? 'open' : 'closed'} className={cn(className)} {...rest}>
```

After:

```tsx
        <div
          ref={ref}
          data-state={isOpen ? 'open' : 'closed'}
          className={cn(accordionItemClassNames.root, className)}
          {...rest}
        >
```

Before (`AccordionTrigger`'s button):

```tsx
      className={cn(
        'flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-body-1 font-semibold text-foreground',
```

After:

```tsx
      className={cn(
        accordionTriggerClassNames.root,
        'flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-body-1 font-semibold text-foreground',
```

Before (its chevron):

```tsx
      <ChevronDownIcon
        size={16}
        className={cn(
          'shrink-0 transition-transform motion-reduce:transition-none',
```

After:

```tsx
      <ChevronDownIcon
        size={16}
        className={cn(
          accordionTriggerClassNames.expandIcon,
          'shrink-0 transition-transform motion-reduce:transition-none',
```

Before (its own heading):

```tsx
  return headingOutside ? button : <Heading className={HEADING_CLASS}>{button}</Heading>;
```

After:

```tsx
  return headingOutside ? (
    button
  ) : (
    <Heading className={cn(accordionTriggerClassNames.heading, HEADING_CLASS)}>{button}</Heading>
  );
```

Before (`AccordionPanel`, the misplaced panel's plain `<div>`):

```tsx
      <div className={cn(className)} {...rest} id={idProp || undefined} ref={ref}>
```

After:

```tsx
      <div
        className={cn(accordionPanelClassNames.root, className)}
        {...rest}
        id={idProp || undefined}
        ref={ref}
      >
```

Before (the `role="region"` panel):

```tsx
        className={cn('px-4 pb-3 text-body-1 text-muted-foreground', className)}
```

After:

```tsx
        className={cn(
          accordionPanelClassNames.root,
          'px-4 pb-3 text-body-1 text-muted-foreground',
          className,
        )}
```

`src/components/layout/TabList.tsx` — add after the `cn` import:

```tsx
import {
  tabListClassNames,
  tabListPanelClassNames,
  tabListPanelsClassNames,
  tabListTabClassNames,
} from '../../lib/classNames';
```

Before (the `role="tablist"` element; its outer wrapper gets no class, judgement 27):

```tsx
          className={cn(
            isVertical
              ? 'flex w-40 flex-col border-e border-border'
              : 'flex border-b border-border',
            className,
          )}
```

After:

```tsx
          className={cn(
            tabListClassNames.root,
            isVertical
              ? 'flex w-40 flex-col border-e border-border'
              : 'flex border-b border-border',
            className,
          )}
```

Before (`Tab`):

```tsx
      className={cn(
        'px-4 py-2 text-body-1 font-semibold transition-colors motion-reduce:transition-none',
```

After:

```tsx
      className={cn(
        tabListTabClassNames.root,
        'px-4 py-2 text-body-1 font-semibold transition-colors motion-reduce:transition-none',
```

Before (`TabPanel`):

```tsx
      className={cn('p-4', focusRing, className)}
```

After:

```tsx
      className={cn(tabListPanelClassNames.root, 'p-4', focusRing, className)}
```

Before (`TabPanels`):

```tsx
  <div ref={ref} className={cn('min-w-0 flex-1', className)} {...rest}>
```

After:

```tsx
  <div ref={ref} className={cn(tabListPanelsClassNames.root, 'min-w-0 flex-1', className)} {...rest}>
```

- [ ] **Step 5: Tree (0.7 elements only)**

`src/components/layout/Tree.tsx` — add after the `cn` import:

```tsx
import { treeClassNames, treeItemClassNames } from '../../lib/classNames';
```

Before (`TreeRoot`):

```tsx
          className={cn('text-body-1', className)}
```

After:

```tsx
          className={cn(treeClassNames.root, 'text-body-1', className)}
```

Before (the icon slot):

```tsx
      ? renderSlot(icon, 'span', 'inline-flex shrink-0', { 'aria-hidden': true })
```

After:

```tsx
      ? renderSlot(icon, 'span', cn(treeItemClassNames.icon, 'inline-flex shrink-0'), {
          'aria-hidden': true,
        })
```

Before (the treeitem):

```tsx
      className={cn(
        // The focus ring is drawn on the row: an outline on the treeitem would surround its
```

After:

```tsx
      className={cn(
        treeItemClassNames.root,
        // The focus ring is drawn on the row: an outline on the treeitem would surround its
```

Before (the row):

```tsx
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-subtle-hover',
```

After:

```tsx
        className={cn(
          treeItemClassNames.row,
          'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-subtle-hover',
```

Before (the chevron; the leaf's spacer beside it stays unclassed, a column spacer):

```tsx
          <ChevronRightIcon
            className={cn(
              'shrink-0 transition-transform motion-reduce:transition-none',
```

After:

```tsx
          <ChevronRightIcon
            className={cn(
              treeItemClassNames.expandIcon,
              'shrink-0 transition-transform motion-reduce:transition-none',
```

Before (the label):

```tsx
        <span id={labelId} data-tree-label="" data-roving-text={typeaheadText} className="truncate">
```

After:

```tsx
        <span
          id={labelId}
          data-tree-label=""
          data-roving-text={typeaheadText}
          className={cn(treeItemClassNames.label, 'truncate')}
        >
```

Before (the child group):

```tsx
            <div role="group" className="ps-4">
```

After:

```tsx
            <div role="group" className={cn(treeItemClassNames.group, 'ps-4')}>
```

- [ ] **Step 6: Carousel, Overflow, Stack, Flex and Grid**

`src/components/layout/Carousel.tsx` — add after the `cn` import:

```tsx
import { carouselClassNames, carouselItemClassNames } from '../../lib/classNames';
```

Before (the root without slides):

```tsx
    return <div ref={rootRef} className={cn('relative', className)} {...rootHandlers} {...rest} />;
```

After:

```tsx
    return (
      <div
        ref={rootRef}
        className={cn(carouselClassNames.root, 'relative', className)}
        {...rootHandlers}
        {...rest}
      />
    );
```

Before (the `role="region"` root):

```tsx
      className={cn('relative isolate overflow-hidden', className)}
```

After:

```tsx
      className={cn(carouselClassNames.root, 'relative isolate overflow-hidden', className)}
```

Before (the rotation button):

```tsx
          className={cn(controlButton, 'top-2 start-2')}
```

After:

```tsx
          className={cn(carouselClassNames.autoPlayButton, controlButton, 'top-2 start-2')}
```

Before (the track):

```tsx
        className="flex transition-transform duration-300 ease-in-out motion-reduce:transition-none"
```

After:

```tsx
        className={cn(
          carouselClassNames.track,
          'flex transition-transform duration-300 ease-in-out motion-reduce:transition-none',
        )}
```

Before (each slide wrapper):

```tsx
              className="w-full shrink-0"
```

After:

```tsx
              className={cn(carouselClassNames.slide, 'w-full shrink-0')}
```

Before:

```tsx
        className={cn(controlButton, 'top-1/2 start-2 -translate-y-1/2')}
```

After:

```tsx
        className={cn(carouselClassNames.previousButton, controlButton, 'top-1/2 start-2 -translate-y-1/2')}
```

Before:

```tsx
        className={cn(controlButton, 'top-1/2 end-2 -translate-y-1/2')}
```

After:

```tsx
        className={cn(carouselClassNames.nextButton, controlButton, 'top-1/2 end-2 -translate-y-1/2')}
```

Before (the picker group):

```tsx
        className="absolute inset-x-0 bottom-1 z-10 mx-auto flex w-fit"
```

After:

```tsx
        className={cn(carouselClassNames.picker, 'absolute inset-x-0 bottom-1 z-10 mx-auto flex w-fit')}
```

Before (each picker button and its dot):

```tsx
              className={cn('group inline-flex h-6 min-w-6 items-center justify-center', focusRing)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block h-2 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
```

After:

```tsx
              className={cn(
                carouselClassNames.pickerButton,
                'group inline-flex h-6 min-w-6 items-center justify-center',
                focusRing,
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  carouselClassNames.pickerIndicator,
                  'block h-2 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
```

Before (`CarouselItem`):

```tsx
    <div ref={ref} className={cn('p-4', className)} {...rest}>
```

After:

```tsx
    <div ref={ref} className={cn(carouselItemClassNames.root, 'p-4', className)} {...rest}>
```

(The chevron glyphs of the arrows stay unclassed: the whole content of a button part, judgement 26.)

`src/components/layout/Overflow.tsx` — add after the `cn` import:

```tsx
import { overflowClassNames, overflowItemClassNames } from '../../lib/classNames';
```

Before:

```tsx
        className={cn('flex items-center overflow-hidden p-1', className)}
```

After:

```tsx
        className={cn(overflowClassNames.root, 'flex items-center overflow-hidden p-1', className)}
```

Before:

```tsx
            className="sticky -end-1 flex shrink-0 items-center self-stretch ps-1 data-[overflow-pinned]:bg-background data-[overflow-pinned]:pe-1"
```

After:

```tsx
            className={cn(
              overflowClassNames.overflowButton,
              'sticky -end-1 flex shrink-0 items-center self-stretch ps-1 data-[overflow-pinned]:bg-background data-[overflow-pinned]:pe-1',
            )}
```

Before (`OverflowItem`):

```tsx
      className={cn('shrink-0', className)}
```

After:

```tsx
      className={cn(overflowItemClassNames.root, 'shrink-0', className)}
```

`src/components/layout/Stack.tsx` — add after the `cn` import `import { stackClassNames } from '../../lib/classNames';`, then before:

```tsx
      className={cn(
        inline ? 'inline-flex' : 'flex',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
```

After:

```tsx
      className={cn(
        stackClassNames.root,
        inline ? 'inline-flex' : 'flex',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
```

`src/components/layout/Flex.tsx` — add after the `cn` import `import { flexClassNames } from '../../lib/classNames';`, then before:

```tsx
      className={cn(
        inline ? 'inline-flex' : 'flex',
        directionMap[direction],
```

After:

```tsx
      className={cn(
        flexClassNames.root,
        inline ? 'inline-flex' : 'flex',
        directionMap[direction],
```

`src/components/layout/Grid.tsx` — add after the `cn` import `import { gridClassNames } from '../../lib/classNames';`, then before:

```tsx
      className={cn(
        'grid',
        columns && columnsMap[columns],
```

After:

```tsx
      className={cn(
        gridClassNames.root,
        'grid',
        columns && columnsMap[columns],
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/layout/__tests__/stableClassNames.test.tsx`
Expected: PASS (every case).

- [ ] **Step 8: Check the folder's existing class assertions**

Run: `grep -rnE "toHaveAttribute\('class'|\.className\)\.toBe\(|getAttribute\('class'\)\)\.toBe\(|classList\)\.toEqual|toMatchInlineSnapshot|toMatchSnapshot" src/components/layout/__tests__`
Expected: no output. The folder's class assertions are `toHaveClass` subsets, negative regexes (Accordion `enabled:`, Card `\[#`, Carousel `hover:`, Flex `gap-`, Grid `grid-cols-`, Overflow negative margins, TabList `enabled:`/`border-(r|l)`/`text-left|border-l`, Tree `pl-`/`rtl:`) and Carousel's chevron check (`classes.includes('-scale-x-100')`, on a glyph that gets no class); no pattern matches a `wave-…` class, so none changes (spec §6.4 lists none for this folder).

- [ ] **Step 9: Folder checks**

Run:

```bash
npx vitest run src/components/layout
npx vitest run src/components/layout/__tests__/stableClassNames.test.tsx --reporter=default
npx vitest run src/__tests__/conventions.test.ts -t "src/components/layout/"
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/layout --max-warnings 0
node scripts/build-css.mjs
```

Expected: all pass; no act() warning and no `[WaveUI]` line in the `--reporter=default` run.

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/__tests__/stableClassNames.test.tsx src/components/layout/Card.tsx src/components/layout/Accordion.tsx src/components/layout/TabList.tsx src/components/layout/Tree.tsx src/components/layout/Carousel.tsx src/components/layout/Overflow.tsx src/components/layout/Stack.tsx src/components/layout/Flex.tsx src/components/layout/Grid.tsx
git commit -m "feat(layout): stable class names"
```

---

### Task A9: Stable class names — navigation folder

**Files:**
- Create: `src/components/navigation/__tests__/stableClassNames.test.tsx`
- Modify (classes only, spec §0.2 rule 19): `src/components/navigation/Breadcrumb.tsx`, `Menu.root.tsx`, `Menu.items.tsx`, `Menu.selectable.tsx`, `Menu.link.tsx`, `Menu.popover.tsx`, `Menu.group.tsx`, `Menu.splitGroup.tsx`, `Nav.tsx`, `Pagination.tsx`, `Stepper.tsx`
- Unchanged: `Menu.tsx` (compound only), `Menu.context.ts`, `Menu.shared.ts` (`menuItemClasses`, `menuSurfaceClasses`, `menuPopoverClasses` are shared style helpers: never get classes, D4), `Menu.trigger.tsx` (`Menu.Trigger` clones its child: no constant), `index.ts`

**Interfaces:**
- Consumes (Task A1, `src/lib/classNames.ts`): `breadcrumbClassNames` {root, list, listItem, divider}, `breadcrumbItemClassNames` {root, icon}, `menuClassNames` {root}, `menuItemClassNames` {root, checkmark, icon, content, shortcut, submenuIndicator}, `menuItemCheckboxClassNames` {root, checkmark, icon, content, shortcut}, `menuItemRadioClassNames` {root, checkmark, icon, content, shortcut}, `menuItemSwitchClassNames` {root, icon, content, shortcut, track, thumb}, `menuItemLinkClassNames` {root, icon, content, shortcut}, `menuDividerClassNames`, `menuPopoverClassNames`, `menuGroupClassNames`, `menuGroupHeaderClassNames`, `menuSplitGroupClassNames` {root}, `navClassNames` {root, list}, `navCategoryClassNames` {root, button, icon, label, expandIcon, list}, `navItemClassNames` {root, listItem, icon, content}, `navSubItemClassNames` {root, listItem}, `paginationClassNames` {root, list, listItem, firstButton, previousButton, pageButton, nextButton, lastButton, ellipsis}, `stepperClassNames` {root, list}, `stepperStepClassNames` {root, listItem, button, indicator, icon, label, description, connector}.
- Produces (internal class channels of shared renderers, rule 8; nothing exported from the package):
  - `export interface MenuItemRowPartClassNames { checkmark?: string; icon?: string; content?: string; shortcut?: string }` and `MenuItemRowProps.partClassNames?: MenuItemRowPartClassNames` in `Menu.items.tsx`.
  - `SelectableMenuItemProps.rootClassName: string` and `.partClassNames: MenuItemRowPartClassNames` (module-private, `Menu.selectable.tsx`).
  - Nav (module-private): `interface NavEntryClassNames { root: string; listItem: string; icon?: string; content?: string }`, `renderNavEntry(props, context, classes, stable: NavEntryClassNames, withIcon)`, `renderIcon(icon, className: string | undefined)`.
  - Pagination (component-local): `renderNavButton(type, target, unavailable, icon, partClassName: string)`.

- [ ] **Step 1: Write the failing test**

Create `src/components/navigation/__tests__/stableClassNames.test.tsx`:

```tsx
/**
 * Stable class names of the navigation folder (spec P3-00, Appendix A "navigation"): every root,
 * part and variant carries its registered classes on the element the registry names, in every
 * layout where it renders, the portaled submenu and the server HTML included. The values are read
 * from the registry, never written as literals.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  breadcrumbClassNames,
  breadcrumbItemClassNames,
  menuClassNames,
  menuDividerClassNames,
  menuGroupClassNames,
  menuGroupHeaderClassNames,
  menuItemCheckboxClassNames,
  menuItemClassNames,
  menuItemLinkClassNames,
  menuItemRadioClassNames,
  menuItemSwitchClassNames,
  menuPopoverClassNames,
  menuSplitGroupClassNames,
  navCategoryClassNames,
  navClassNames,
  navItemClassNames,
  navSubItemClassNames,
  paginationClassNames,
  stepperClassNames,
  stepperStepClassNames,
} from '../../../lib/classNames';
import { Breadcrumb } from '../Breadcrumb';
import { Menu } from '../Menu';
import { Nav } from '../Nav';
import { Pagination } from '../Pagination';
import { Stepper } from '../Stepper';

/** Server HTML in a detached element (never appended: src/test-setup.ts checks document.body). */
function parse(html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/** The element the icon slot rendered around a test glyph. */
function iconBoxOf(testId: string): HTMLElement | null {
  return screen.getByTestId(testId).parentElement;
}

describe('stable class names: navigation folder', () => {
  it('Breadcrumb: root, list, list items, dividers; link, button, asChild and current items; icon', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="#home" icon={<svg data-testid="home-icon" />}>
          Home
        </Breadcrumb.Item>
        <Breadcrumb.Item onClick={() => {}}>Library</Breadcrumb.Item>
        <Breadcrumb.Item asChild>
          <a href="#docs">Docs</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item current>Reports</Breadcrumb.Item>
      </Breadcrumb>,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toHaveClass(breadcrumbClassNames.root);
    const list = within(nav).getByRole('list');
    expect(list).toHaveClass(breadcrumbClassNames.list);
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    for (const item of items) expect(item).toHaveClass(breadcrumbClassNames.listItem);
    expect(items[0].querySelector('[data-wave-breadcrumb-separator]')).toBeNull();
    expect(items[1].firstElementChild).toHaveClass(breadcrumbClassNames.divider);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass(breadcrumbItemClassNames.root);
    expect(iconBoxOf('home-icon')).toHaveClass(breadcrumbItemClassNames.icon);
    expect(screen.getByRole('button', { name: 'Library' })).toHaveClass(
      breadcrumbItemClassNames.root,
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveClass(breadcrumbItemClassNames.root);
    expect(screen.getByText('Reports')).toHaveClass(breadcrumbItemClassNames.root);
  });

  it('Menu: static root, item parts, the item kinds as variants, divider, group and split group', async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Edit" defaultCheckedValues={{ view: ['grid'], sort: ['name'], wrap: ['on'] }}>
        <Menu.Item icon={<svg data-testid="cut-icon" />} shortcut="Ctrl+X">
          Cut
        </Menu.Item>
        <Menu.ItemLink href="#settings" icon={<svg data-testid="settings-icon" />} shortcut="Ctrl+,">
          Settings
        </Menu.ItemLink>
        <Menu.Divider />
        <Menu.Group>
          <Menu.GroupHeader>View</Menu.GroupHeader>
          <Menu.ItemCheckbox
            name="view"
            value="grid"
            icon={<svg data-testid="grid-icon" />}
            shortcut="G"
          >
            Grid
          </Menu.ItemCheckbox>
          <Menu.ItemRadio name="sort" value="name" icon={<svg data-testid="sort-icon" />} shortcut="N">
            By name
          </Menu.ItemRadio>
          <Menu.ItemSwitch name="wrap" value="on" icon={<svg data-testid="wrap-icon" />} shortcut="W">
            Wrap
          </Menu.ItemSwitch>
        </Menu.Group>
        <Menu.SplitGroup>
          <Menu.Item>Save</Menu.Item>
          <Menu>
            <Menu.Trigger>
              <Menu.Item aria-label="Save options" />
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Save as</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.SplitGroup>
      </Menu>,
    );
    expect(screen.getByRole('menu', { name: 'Edit' })).toHaveClass(menuClassNames.root);

    const cut = screen.getByRole('menuitem', { name: /^Cut/ });
    expect(cut).toHaveClass(menuItemClassNames.root);
    expect(iconBoxOf('cut-icon')).toHaveClass(menuItemClassNames.icon);
    expect(within(cut).getByText('Cut')).toHaveClass(menuItemClassNames.content);
    expect(within(cut).getByText('Ctrl+X')).toHaveClass(menuItemClassNames.shortcut);
    // A plain item's check column is a placeholder: no part class (Appendix A, judgement 3).
    expect(cut.querySelector('[data-menu-column-space="checkmark"]')).not.toHaveClass(
      menuItemClassNames.checkmark,
    );

    const settings = screen.getByRole('menuitem', { name: /^Settings/ });
    expect(settings).toHaveClass(menuItemClassNames.root, menuItemLinkClassNames.root);
    expect(iconBoxOf('settings-icon')).toHaveClass(
      menuItemClassNames.icon,
      menuItemLinkClassNames.icon,
    );
    expect(within(settings).getByText('Settings')).toHaveClass(
      menuItemClassNames.content,
      menuItemLinkClassNames.content,
    );
    expect(within(settings).getByText('Ctrl+,')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemLinkClassNames.shortcut,
    );

    const grid = screen.getByRole('menuitemcheckbox', { name: /^Grid/ });
    expect(grid).toHaveClass(menuItemClassNames.root, menuItemCheckboxClassNames.root);
    expect(grid.querySelector('[data-menu-checkmark]')).toHaveClass(
      menuItemClassNames.checkmark,
      menuItemCheckboxClassNames.checkmark,
    );
    expect(iconBoxOf('grid-icon')).toHaveClass(
      menuItemClassNames.icon,
      menuItemCheckboxClassNames.icon,
    );
    expect(within(grid).getByText('Grid')).toHaveClass(
      menuItemClassNames.content,
      menuItemCheckboxClassNames.content,
    );
    expect(within(grid).getByText('G')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemCheckboxClassNames.shortcut,
    );

    const byName = screen.getByRole('menuitemradio', { name: /^By name/ });
    expect(byName).toHaveClass(menuItemClassNames.root, menuItemRadioClassNames.root);
    expect(byName.querySelector('[data-menu-checkmark]')).toHaveClass(
      menuItemClassNames.checkmark,
      menuItemRadioClassNames.checkmark,
    );
    expect(iconBoxOf('sort-icon')).toHaveClass(menuItemClassNames.icon, menuItemRadioClassNames.icon);
    expect(within(byName).getByText('By name')).toHaveClass(
      menuItemClassNames.content,
      menuItemRadioClassNames.content,
    );
    expect(within(byName).getByText('N')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemRadioClassNames.shortcut,
    );

    const wrap = screen.getByRole('menuitemcheckbox', { name: /^Wrap/ });
    expect(wrap).toHaveClass(menuItemClassNames.root, menuItemSwitchClassNames.root);
    const track = wrap.querySelector('[data-menu-switch]') as HTMLElement;
    expect(track).toHaveClass(menuItemSwitchClassNames.track);
    expect(track.firstElementChild).toHaveClass(menuItemSwitchClassNames.thumb);
    expect(iconBoxOf('wrap-icon')).toHaveClass(menuItemClassNames.icon, menuItemSwitchClassNames.icon);
    expect(within(wrap).getByText('Wrap')).toHaveClass(
      menuItemClassNames.content,
      menuItemSwitchClassNames.content,
    );
    expect(within(wrap).getByText('W')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemSwitchClassNames.shortcut,
    );

    expect(screen.getByRole('separator')).toHaveClass(menuDividerClassNames.root);
    expect(screen.getByRole('group', { name: 'View' })).toHaveClass(menuGroupClassNames.root);
    expect(screen.getByText('View')).toHaveClass(menuGroupHeaderClassNames.root);
    expect(screen.getByRole('menuitem', { name: 'Save' }).parentElement).toHaveClass(
      menuSplitGroupClassNames.root,
    );

    const half = screen.getByRole('menuitem', { name: 'Save options' });
    expect(half.querySelector('svg')).toHaveClass(menuItemClassNames.submenuIndicator);
    await user.click(half);
    const popover = screen.getByRole('menu', { name: 'Save options' });
    expect(popover).toHaveClass(menuPopoverClassNames.root);
    expect(popover).not.toHaveClass(menuClassNames.root);
  });

  it('Nav: root, list; items (link and button) with list item, icon and content; category; sub-items', () => {
    render(
      <Nav aria-label="Main" defaultValue="weekly" defaultOpenCategories={['reports']}>
        <Nav.Item value="home" href="#home" icon={<svg data-testid="home-icon" />}>
          Home
        </Nav.Item>
        <Nav.Item value="settings">Settings</Nav.Item>
        <Nav.Category value="reports" label="Reports" icon={<svg data-testid="reports-icon" />}>
          <Nav.SubItem value="weekly" href="#weekly">
            Weekly
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveClass(navClassNames.root);
    expect(nav.firstElementChild).toHaveClass(navClassNames.list);

    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toHaveClass(navItemClassNames.root);
    expect(home.parentElement).toHaveClass(navItemClassNames.listItem);
    expect(iconBoxOf('home-icon')).toHaveClass(navItemClassNames.icon);
    expect(within(home).getByText('Home')).toHaveClass(navItemClassNames.content);
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(settings).toHaveClass(navItemClassNames.root);
    expect(settings.parentElement).toHaveClass(navItemClassNames.listItem);

    const toggle = screen.getByRole('button', { name: 'Reports' });
    expect(toggle).toHaveClass(navCategoryClassNames.button);
    expect(toggle.parentElement).toHaveClass(navCategoryClassNames.root);
    expect(iconBoxOf('reports-icon')).toHaveClass(navCategoryClassNames.icon);
    expect(within(toggle).getByText('Reports')).toHaveClass(navCategoryClassNames.label);
    expect(toggle.lastElementChild).toHaveClass(navCategoryClassNames.expandIcon);

    const weekly = screen.getByRole('link', { name: 'Weekly' });
    expect(weekly).toHaveClass(navSubItemClassNames.root);
    expect(weekly.parentElement).toHaveClass(navSubItemClassNames.listItem);
    expect(weekly.parentElement?.parentElement).toHaveClass(navCategoryClassNames.list);
  });

  it('Pagination: root, list, every list item, the five button kinds and the ellipses', () => {
    render(<Pagination totalPages={10} defaultCurrentPage={5} showFirstLast />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toHaveClass(paginationClassNames.root);
    const list = nav.firstElementChild as HTMLElement;
    expect(list).toHaveClass(paginationClassNames.list);
    // Also the aria-hidden list items of the ellipses, which getAllByRole would skip.
    for (const item of Array.from(list.children)) {
      expect(item).toHaveClass(paginationClassNames.listItem);
    }
    expect(screen.getByRole('button', { name: 'First page' })).toHaveClass(
      paginationClassNames.firstButton,
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveClass(
      paginationClassNames.previousButton,
    );
    expect(screen.getByRole('button', { name: 'Page 5' })).toHaveClass(
      paginationClassNames.pageButton,
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveClass(
      paginationClassNames.nextButton,
    );
    expect(screen.getByRole('button', { name: 'Last page' })).toHaveClass(
      paginationClassNames.lastButton,
    );
    const ellipses = screen.getAllByText('…');
    expect(ellipses).toHaveLength(2);
    for (const ellipsis of ellipses) expect(ellipsis).toHaveClass(paginationClassNames.ellipsis);
  });

  it("Stepper: root, list; a step's list item, root, button, indicator, icon, label, description, connector", () => {
    render(
      <Stepper defaultActiveStep={1}>
        <Stepper.Step
          label="Account"
          description="Your details"
          icon={<svg data-testid="account-icon" />}
        />
        <Stepper.Step label="Plan" />
      </Stepper>,
    );
    const root = screen.getByRole('group', { name: 'Progress' });
    expect(root).toHaveClass(stepperClassNames.root);
    const list = within(root).getByRole('list');
    expect(list).toHaveClass(stepperClassNames.list);
    const [first] = within(list).getAllByRole('listitem');
    // The <li> sits outside the step's className target and keeps its part class.
    expect(first).toHaveClass(stepperStepClassNames.listItem);
    const stepRoot = first.firstElementChild as HTMLElement;
    expect(stepRoot).toHaveClass(stepperStepClassNames.root);
    const button = within(first).getByRole('button');
    expect(button).toHaveClass(stepperStepClassNames.button);
    expect(button.firstElementChild).toHaveClass(stepperStepClassNames.indicator);
    expect(iconBoxOf('account-icon')).toHaveClass(stepperStepClassNames.icon);
    expect(screen.getByText('Account')).toHaveClass(stepperStepClassNames.label);
    expect(screen.getByText('Your details')).toHaveClass(stepperStepClassNames.description);
    expect(stepRoot.lastElementChild).toHaveClass(stepperStepClassNames.connector);
  });

  it('renders the classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <>
          <Breadcrumb>
            <Breadcrumb.Item href="#home">Home</Breadcrumb.Item>
            <Breadcrumb.Item current>Reports</Breadcrumb.Item>
          </Breadcrumb>
          <Menu aria-label="File">
            <Menu.Item>Open</Menu.Item>
          </Menu>
        </>,
      ),
    );
    expect(host.querySelector('nav')).toHaveClass(breadcrumbClassNames.root);
    expect(host.querySelector('ol')).toHaveClass(breadcrumbClassNames.list);
    expect(host.querySelector('li')).toHaveClass(breadcrumbClassNames.listItem);
    expect(host.querySelector('[data-wave-breadcrumb-separator]')).toHaveClass(
      breadcrumbClassNames.divider,
    );
    expect(host.querySelector('a')).toHaveClass(breadcrumbItemClassNames.root);
    expect(host.querySelector('[role="menu"]')).toHaveClass(menuClassNames.root);
    expect(host.querySelector('[role="menuitem"]')).toHaveClass(menuItemClassNames.root);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/navigation/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case; the first failure reads `Expected the element to have class:` followed by `wave-breadcrumb`.

- [ ] **Step 3: Breadcrumb**

`src/components/navigation/Breadcrumb.tsx` — add after the `cn` import:

```tsx
import { breadcrumbClassNames, breadcrumbItemClassNames } from '../../lib/classNames';
```

Before (`BreadcrumbRoot`, whose `className` was passed through without `cn()`, rule 1):

```tsx
    <nav ref={ref} aria-label="Breadcrumb" {...rest} className={className}>
      <ol className="m-0 flex list-none items-center gap-1 p-0 text-body-1">
        {items.map(({ key, node: child }, index) => (
          <li key={key} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRightIcon
                data-wave-breadcrumb-separator=""
                className="shrink-0 text-muted-foreground wave-rtl:-scale-x-100"
              />
            )}
```

After:

```tsx
    <nav
      ref={ref}
      aria-label="Breadcrumb"
      {...rest}
      className={cn(breadcrumbClassNames.root, className)}
    >
      <ol
        className={cn(breadcrumbClassNames.list, 'm-0 flex list-none items-center gap-1 p-0 text-body-1')}
      >
        {items.map(({ key, node: child }, index) => (
          <li key={key} className={cn(breadcrumbClassNames.listItem, 'flex items-center gap-1')}>
            {index > 0 && (
              <ChevronRightIcon
                data-wave-breadcrumb-separator=""
                className={cn(
                  breadcrumbClassNames.divider,
                  'shrink-0 text-muted-foreground wave-rtl:-scale-x-100',
                )}
              />
            )}
```

Before (the icon slot):

```tsx
      ? renderSlot(icon, 'span', 'me-1 inline-flex shrink-0', { 'aria-hidden': true })
```

After:

```tsx
      ? renderSlot(icon, 'span', cn(breadcrumbItemClassNames.icon, 'me-1 inline-flex shrink-0'), {
          'aria-hidden': true,
        })
```

Before (the `asChild` element):

```tsx
        className={cn(current ? currentChildClasses : linkClasses, className)}
```

After:

```tsx
        className={cn(
          breadcrumbItemClassNames.root,
          current ? currentChildClasses : linkClasses,
          className,
        )}
```

Before (the current item):

```tsx
        className={cn(currentClasses, className)}
```

After:

```tsx
        className={cn(breadcrumbItemClassNames.root, currentClasses, className)}
```

Before (the link and the button item; the line occurs twice, apply both):

```tsx
        className={cn(linkClasses, className)}
```

After:

```tsx
        className={cn(breadcrumbItemClassNames.root, linkClasses, className)}
```

Before (the text item):

```tsx
      className={cn(textClasses, className)}
```

After:

```tsx
      className={cn(breadcrumbItemClassNames.root, textClasses, className)}
```

- [ ] **Step 4: The menu row and Menu.Item**

`src/components/navigation/Menu.items.tsx` — add after the `cn` import:

```tsx
import { menuDividerClassNames, menuItemClassNames } from '../../lib/classNames';
```

Before (`MenuItemRowProps`):

```tsx
   * @default true
   */
  markLabel?: boolean;
}
```

After:

```tsx
   * @default true
   */
  markLabel?: boolean;
  /**
   * Stable classes of the row's parts, written literally by each item kind (the check column,
   * the icon box, the label and the shortcut).
   */
  partClassNames?: MenuItemRowPartClassNames;
}

/** Internal: the stable classes of an item row's parts (see `MenuItemRowProps.partClassNames`). */
export interface MenuItemRowPartClassNames {
  checkmark?: string;
  icon?: string;
  content?: string;
  shortcut?: string;
}
```

Before (`MenuItemRow`):

```tsx
  end,
  markLabel = true,
}: MenuItemRowProps): React.ReactElement {
```

After:

```tsx
  end,
  markLabel = true,
  partClassNames,
}: MenuItemRowProps): React.ReactElement {
```

Before:

```tsx
      ? renderSlot(icon, 'span', 'flex h-5 w-5 shrink-0 items-center justify-center', {
          'aria-hidden': true,
          'data-menu-icon': '',
        })
```

After:

```tsx
      ? renderSlot(
          icon,
          'span',
          cn(partClassNames?.icon, 'flex h-5 w-5 shrink-0 items-center justify-center'),
          { 'aria-hidden': true, 'data-menu-icon': '' },
        )
```

Before:

```tsx
          data-menu-checkmark=""
          className="inline-flex w-4 shrink-0 items-center justify-center"
```

After:

```tsx
          data-menu-checkmark=""
          className={cn(partClassNames?.checkmark, 'inline-flex w-4 shrink-0 items-center justify-center')}
```

Before:

```tsx
      <span
        className="flex-1"
        data-menu-label={markLabel && hasLabel && typeof label !== 'string' ? '' : undefined}
      >
```

After:

```tsx
      <span
        className={cn(partClassNames?.content, 'flex-1')}
        data-menu-label={markLabel && hasLabel && typeof label !== 'string' ? '' : undefined}
      >
```

Before:

```tsx
        <span dir="auto" className="ms-4 text-caption-1 text-muted-foreground">
```

After:

```tsx
        <span
          dir="auto"
          className={cn(partClassNames?.shortcut, 'ms-4 text-caption-1 text-muted-foreground')}
        >
```

(The column placeholders of `renderColumnSpace` stay unclassed: `data-menu-column-space` is no part.)

Before (`MenuItem`):

```tsx
      className={cn(menuItemClasses, className)}
    >
      <MenuItemRow
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        end={
          isSubmenuTrigger ? (
            <ChevronRightIcon size={16} className="ms-auto shrink-0 wave-rtl:-scale-x-100" />
          ) : undefined
        }
      />
```

After:

```tsx
      className={cn(menuItemClassNames.root, menuItemClasses, className)}
    >
      <MenuItemRow
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        partClassNames={{
          icon: menuItemClassNames.icon,
          content: menuItemClassNames.content,
          shortcut: menuItemClassNames.shortcut,
        }}
        end={
          isSubmenuTrigger ? (
            <ChevronRightIcon
              size={16}
              className={cn(
                menuItemClassNames.submenuIndicator,
                'ms-auto shrink-0 wave-rtl:-scale-x-100',
              )}
            />
          ) : undefined
        }
      />
```

Before (`MenuDivider`):

```tsx
      className={cn('my-1 border-t border-border', className)}
```

After:

```tsx
      className={cn(menuDividerClassNames.root, 'my-1 border-t border-border', className)}
```

- [ ] **Step 5: The checkable and link items (variants, D5)**

`src/components/navigation/Menu.selectable.tsx` — add after the `cn` import:

```tsx
import {
  menuItemCheckboxClassNames,
  menuItemClassNames,
  menuItemRadioClassNames,
  menuItemSwitchClassNames,
} from '../../lib/classNames';
```

Before:

```tsx
import type { MenuItemProps } from './Menu.items';
```

After:

```tsx
import type { MenuItemProps, MenuItemRowPartClassNames } from './Menu.items';
```

Before (`SelectableMenuItemProps`):

```tsx
  /** The part's name in diagnostics (`Menu.ItemCheckbox`). */
  componentName: string;
}
```

After:

```tsx
  /** The part's name in diagnostics (`Menu.ItemCheckbox`). */
  componentName: string;
  /** The item element's stable classes: the base item's and the kind's own. */
  rootClassName: string;
  /** The row parts' stable classes (the base item's and the kind's own). */
  partClassNames: MenuItemRowPartClassNames;
}
```

Before (`renderSwitchIndicator`: the track and its thumb):

```tsx
      data-menu-switch=""
      className={cn(
        'relative inline-flex h-[16px] w-[32px] shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none',
```

After:

```tsx
      data-menu-switch=""
      className={cn(
        menuItemSwitchClassNames.track,
        'relative inline-flex h-[16px] w-[32px] shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none',
```

Before:

```tsx
      <span
        className={cn(
          'block h-[10px] w-[10px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
```

After:

```tsx
      <span
        className={cn(
          menuItemSwitchClassNames.thumb,
          'block h-[10px] w-[10px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
```

Before (`SelectableMenuItem`):

```tsx
function SelectableMenuItem({
  kind,
  componentName,
  name,
```

After:

```tsx
function SelectableMenuItem({
  kind,
  componentName,
  rootClassName,
  partClassNames,
  name,
```

Before:

```tsx
      className={cn(menuItemClasses, className)}
    >
      <MenuItemRow
        checkmark={checkColumn}
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        end={kind === 'switch' ? renderSwitchIndicator(checked, disabled) : undefined}
      />
```

After:

```tsx
      className={cn(rootClassName, menuItemClasses, className)}
    >
      <MenuItemRow
        checkmark={checkColumn}
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        partClassNames={partClassNames}
        end={kind === 'switch' ? renderSwitchIndicator(checked, disabled) : undefined}
      />
```

Before (the three kinds):

```tsx
export const MenuItemCheckbox = (props: MenuItemCheckboxProps) => (
  <SelectableMenuItem {...props} kind="checkbox" componentName="Menu.ItemCheckbox" />
);
```

After:

```tsx
export const MenuItemCheckbox = (props: MenuItemCheckboxProps) => (
  <SelectableMenuItem
    {...props}
    kind="checkbox"
    componentName="Menu.ItemCheckbox"
    rootClassName={cn(menuItemClassNames.root, menuItemCheckboxClassNames.root)}
    partClassNames={{
      checkmark: cn(menuItemClassNames.checkmark, menuItemCheckboxClassNames.checkmark),
      icon: cn(menuItemClassNames.icon, menuItemCheckboxClassNames.icon),
      content: cn(menuItemClassNames.content, menuItemCheckboxClassNames.content),
      shortcut: cn(menuItemClassNames.shortcut, menuItemCheckboxClassNames.shortcut),
    }}
  />
);
```

Before:

```tsx
export const MenuItemRadio = (props: MenuItemRadioProps) => (
  <SelectableMenuItem {...props} kind="radio" componentName="Menu.ItemRadio" />
);
```

After:

```tsx
export const MenuItemRadio = (props: MenuItemRadioProps) => (
  <SelectableMenuItem
    {...props}
    kind="radio"
    componentName="Menu.ItemRadio"
    rootClassName={cn(menuItemClassNames.root, menuItemRadioClassNames.root)}
    partClassNames={{
      checkmark: cn(menuItemClassNames.checkmark, menuItemRadioClassNames.checkmark),
      icon: cn(menuItemClassNames.icon, menuItemRadioClassNames.icon),
      content: cn(menuItemClassNames.content, menuItemRadioClassNames.content),
      shortcut: cn(menuItemClassNames.shortcut, menuItemRadioClassNames.shortcut),
    }}
  />
);
```

Before:

```tsx
export const MenuItemSwitch = (props: MenuItemSwitchProps) => (
  <SelectableMenuItem {...props} kind="switch" componentName="Menu.ItemSwitch" />
);
```

After (a switch item has no check column of its own, so no `checkmark` key):

```tsx
export const MenuItemSwitch = (props: MenuItemSwitchProps) => (
  <SelectableMenuItem
    {...props}
    kind="switch"
    componentName="Menu.ItemSwitch"
    rootClassName={cn(menuItemClassNames.root, menuItemSwitchClassNames.root)}
    partClassNames={{
      icon: cn(menuItemClassNames.icon, menuItemSwitchClassNames.icon),
      content: cn(menuItemClassNames.content, menuItemSwitchClassNames.content),
      shortcut: cn(menuItemClassNames.shortcut, menuItemSwitchClassNames.shortcut),
    }}
  />
);
```

`src/components/navigation/Menu.link.tsx` — add after the `cn` import:

```tsx
import { menuItemClassNames, menuItemLinkClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn(menuItemClasses, 'text-foreground no-underline', className)}
    >
      <MenuItemRow icon={icon} label={children} shortcut={shortcut} markLabel={!ownRovingText} />
```

After:

```tsx
      className={cn(
        menuItemClassNames.root,
        menuItemLinkClassNames.root,
        menuItemClasses,
        'text-foreground no-underline',
        className,
      )}
    >
      <MenuItemRow
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        partClassNames={{
          icon: cn(menuItemClassNames.icon, menuItemLinkClassNames.icon),
          content: cn(menuItemClassNames.content, menuItemLinkClassNames.content),
          shortcut: cn(menuItemClassNames.shortcut, menuItemLinkClassNames.shortcut),
        }}
      />
```

- [ ] **Step 6: The static menu, the popover, groups and the split group**

`src/components/navigation/Menu.root.tsx` — add after the `cn` import:

```tsx
import { menuClassNames } from '../../lib/classNames';
```

Before (the static menu's `role="menu"` element; a popup menu renders no root element):

```tsx
          className={cn(menuSurfaceClasses, focusRing, className)}
```

After:

```tsx
          className={cn(menuClassNames.root, menuSurfaceClasses, focusRing, className)}
```

`src/components/navigation/Menu.popover.tsx` — add after the `cn` import:

```tsx
import { menuPopoverClassNames } from '../../lib/classNames';
```

Before:

```tsx
          className={cn(menuPopoverClasses, className)}
```

After:

```tsx
          className={cn(menuPopoverClassNames.root, menuPopoverClasses, className)}
```

`src/components/navigation/Menu.group.tsx` — add after the `cn` import:

```tsx
import { menuGroupClassNames, menuGroupHeaderClassNames } from '../../lib/classNames';
```

Before (`MenuGroup` passed `className` through `rest` without `cn()`, rule 1):

```tsx
export const MenuGroup = ({ children, ref, ...rest }: MenuGroupProps) => {
```

After:

```tsx
export const MenuGroup = ({ children, className, ref, ...rest }: MenuGroupProps) => {
```

Before:

```tsx
      <div role="group" {...rest} ref={ref} aria-labelledby={labelledBy}>
```

After:

```tsx
      <div
        role="group"
        {...rest}
        ref={ref}
        aria-labelledby={labelledBy}
        className={cn(menuGroupClassNames.root, className)}
      >
```

Before (`MenuGroupHeader`; its column spacers stay unclassed):

```tsx
      className={cn(
        'flex items-center gap-2 px-3 pb-1 pt-2 text-caption-1 font-semibold text-muted-foreground',
```

After:

```tsx
      className={cn(
        menuGroupHeaderClassNames.root,
        'flex items-center gap-2 px-3 pb-1 pt-2 text-caption-1 font-semibold text-muted-foreground',
```

`src/components/navigation/Menu.splitGroup.tsx` — add after the `cn` import:

```tsx
import { menuSplitGroupClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn(
        'flex items-stretch [&>:first-child]:flex-1 [&>:last-child]:border-s [&>:last-child]:border-border',
```

After:

```tsx
      className={cn(
        menuSplitGroupClassNames.root,
        'flex items-stretch [&>:first-child]:flex-1 [&>:last-child]:border-s [&>:last-child]:border-border',
```

(The split group's halves are the consumer's elements and get no split-group class, judgement 8.)

- [ ] **Step 7: Nav**

`src/components/navigation/Nav.tsx` — add after the `cn` import:

```tsx
import {
  navCategoryClassNames,
  navClassNames,
  navItemClassNames,
  navSubItemClassNames,
} from '../../lib/classNames';
```

Before (`renderIcon`, shared by Nav.Item and Nav.Category):

```tsx
function renderIcon(icon: Slot<'span'> | undefined): React.ReactElement | null {
  return icon && slotRendersContent(icon)
    ? renderSlot(icon, 'span', iconClasses, { 'aria-hidden': true })
    : null;
}
```

After:

```tsx
function renderIcon(
  icon: Slot<'span'> | undefined,
  className: string | undefined,
): React.ReactElement | null {
  return icon && slotRendersContent(icon)
    ? renderSlot(icon, 'span', cn(className, iconClasses), { 'aria-hidden': true })
    : null;
}
```

Before (`renderNavEntry`'s signature):

```tsx
/** Shared rendering of Nav.Item and Nav.SubItem (link or button). */
function renderNavEntry(
  props: NavEntryProps,
  context: NavContextValue,
  classes: { base: string; selected: string; idle: string },
  withIcon: boolean,
): React.ReactElement {
```

After:

```tsx
/** The stable classes of an entry, written literally by Nav.Item and Nav.SubItem. */
interface NavEntryClassNames {
  root: string;
  listItem: string;
  icon?: string;
  content?: string;
}

/** Shared rendering of Nav.Item and Nav.SubItem (link or button). */
function renderNavEntry(
  props: NavEntryProps,
  context: NavContextValue,
  classes: { base: string; selected: string; idle: string },
  stable: NavEntryClassNames,
  withIcon: boolean,
): React.ReactElement {
```

Before:

```tsx
      {withIcon && renderIcon(icon)}
      {withIcon ? <span className="flex-1 text-start">{children}</span> : children}
    </>
  );

  const entryClassName = cn(classes.base, isSelected ? classes.selected : classes.idle, className);
```

After:

```tsx
      {withIcon && renderIcon(icon, stable.icon)}
      {withIcon ? (
        <span className={cn(stable.content, 'flex-1 text-start')}>{children}</span>
      ) : (
        children
      )}
    </>
  );

  const entryClassName = cn(
    stable.root,
    classes.base,
    isSelected ? classes.selected : classes.idle,
    className,
  );
```

Before (both branches of `renderNavEntry`; the line occurs twice, apply both):

```tsx
      <li>
```

After:

```tsx
      <li className={stable.listItem}>
```

(In the button branch the line reads `    <li>` with four spaces: the same change.)

Before (`NavCategory`, whose `className` was passed through without `cn()`, rule 1):

```tsx
    <li ref={ref} {...rest} className={className}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-current={containsCurrent ? true : undefined}
        data-contains-current={containsCurrent ? '' : undefined}
        onClick={() => toggleCategory(value)}
        className={categoryButtonClasses}
      >
        {renderIcon(icon)}
        <span className="flex-1 text-start">{buttonLabel}</span>
        <ChevronDownIcon
          className={cn(
            'shrink-0 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <NavCategoryValueContext.Provider value={value}>
          <ul id={listId} className="m-0 list-none p-0">
```

After:

```tsx
    <li ref={ref} {...rest} className={cn(navCategoryClassNames.root, className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-current={containsCurrent ? true : undefined}
        data-contains-current={containsCurrent ? '' : undefined}
        onClick={() => toggleCategory(value)}
        className={cn(navCategoryClassNames.button, categoryButtonClasses)}
      >
        {renderIcon(icon, navCategoryClassNames.icon)}
        <span className={cn(navCategoryClassNames.label, 'flex-1 text-start')}>{buttonLabel}</span>
        <ChevronDownIcon
          className={cn(
            navCategoryClassNames.expandIcon,
            'shrink-0 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <NavCategoryValueContext.Provider value={value}>
          <ul id={listId} className={cn(navCategoryClassNames.list, 'm-0 list-none p-0')}>
```

Before (`NavItem`):

```tsx
  return renderNavEntry(props as NavEntryProps, context, itemClasses, true);
```

After:

```tsx
  return renderNavEntry(
    props as NavEntryProps,
    context,
    itemClasses,
    {
      root: navItemClassNames.root,
      listItem: navItemClassNames.listItem,
      icon: navItemClassNames.icon,
      content: navItemClassNames.content,
    },
    true,
  );
```

Before (`NavSubItem`):

```tsx
  return renderNavEntry(props as NavEntryProps, context, subItemClasses, false);
```

After:

```tsx
  return renderNavEntry(
    props as NavEntryProps,
    context,
    subItemClasses,
    { root: navSubItemClassNames.root, listItem: navSubItemClassNames.listItem },
    false,
  );
```

Before (`NavRoot`):

```tsx
        className={cn('w-60 border-e border-border bg-background py-2', className)}
      >
        <ul className="m-0 list-none p-0">{children}</ul>
```

After:

```tsx
        className={cn(navClassNames.root, 'w-60 border-e border-border bg-background py-2', className)}
      >
        <ul className={cn(navClassNames.list, 'm-0 list-none p-0')}>{children}</ul>
```

- [ ] **Step 8: Pagination and Stepper**

`src/components/navigation/Pagination.tsx` — add after the `cn` import:

```tsx
import { paginationClassNames } from '../../lib/classNames';
```

Before (`renderNavButton`, local to the component):

```tsx
  const renderNavButton = (
    type: Exclude<PaginationItemType, 'page'>,
    target: number,
    unavailable: boolean,
    icon: React.ReactNode,
  ) => (
    <li>
      <button
        type="button"
        aria-label={getItemAriaLabel(type, target, false)}
        disabled={disabled}
        {...(disabled ? {} : focusableDisabledProps(unavailable))}
        onClick={preventIfDisabled(unavailable, () => goTo(target))}
        className={cn(itemBaseClasses, sizeClasses, idleItemClasses)}
      >
```

After:

```tsx
  const renderNavButton = (
    type: Exclude<PaginationItemType, 'page'>,
    target: number,
    unavailable: boolean,
    icon: React.ReactNode,
    partClassName: string,
  ) => (
    <li className={paginationClassNames.listItem}>
      <button
        type="button"
        aria-label={getItemAriaLabel(type, target, false)}
        disabled={disabled}
        {...(disabled ? {} : focusableDisabledProps(unavailable))}
        onClick={preventIfDisabled(unavailable, () => goTo(target))}
        className={cn(partClassName, itemBaseClasses, sizeClasses, idleItemClasses)}
      >
```

Before:

```tsx
    <nav ref={ref} aria-label="Pagination" {...rest} className={cn(className)}>
      <ol className="m-0 flex list-none items-center gap-1 p-0">
        {showFirstLast &&
          renderNavButton(
            'first',
            1,
            atStart,
            <ChevronDoubleLeftIcon className={chevronClasses} />,
          )}
        {showPreviousNext &&
          renderNavButton(
            'previous',
            Math.max(1, page - 1),
            atStart,
            <ChevronLeftIcon className={chevronClasses} />,
          )}
```

After:

```tsx
    <nav
      ref={ref}
      aria-label="Pagination"
      {...rest}
      className={cn(paginationClassNames.root, className)}
    >
      <ol className={cn(paginationClassNames.list, 'm-0 flex list-none items-center gap-1 p-0')}>
        {showFirstLast &&
          renderNavButton(
            'first',
            1,
            atStart,
            <ChevronDoubleLeftIcon className={chevronClasses} />,
            paginationClassNames.firstButton,
          )}
        {showPreviousNext &&
          renderNavButton(
            'previous',
            Math.max(1, page - 1),
            atStart,
            <ChevronLeftIcon className={chevronClasses} />,
            paginationClassNames.previousButton,
          )}
```

Before (the ellipsis and the page buttons):

```tsx
            <li
              key={index < range.length / 2 ? 'start-ellipsis' : 'end-ellipsis'}
              aria-hidden="true"
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center text-muted-foreground',
                  sizeClasses,
                )}
              >
                …
              </span>
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                aria-label={getItemAriaLabel('page', item, item === page)}
                aria-current={item === page ? 'page' : undefined}
                disabled={disabled}
                onClick={() => goTo(item)}
                className={cn(
                  itemBaseClasses,
```

After:

```tsx
            <li
              key={index < range.length / 2 ? 'start-ellipsis' : 'end-ellipsis'}
              aria-hidden="true"
              className={paginationClassNames.listItem}
            >
              <span
                className={cn(
                  paginationClassNames.ellipsis,
                  'inline-flex items-center justify-center text-muted-foreground',
                  sizeClasses,
                )}
              >
                …
              </span>
            </li>
          ) : (
            <li key={item} className={paginationClassNames.listItem}>
              <button
                type="button"
                aria-label={getItemAriaLabel('page', item, item === page)}
                aria-current={item === page ? 'page' : undefined}
                disabled={disabled}
                onClick={() => goTo(item)}
                className={cn(
                  paginationClassNames.pageButton,
                  itemBaseClasses,
```

Before:

```tsx
        {showPreviousNext &&
          renderNavButton(
            'next',
            Math.min(pageCount, page + 1),
            atEnd,
            <ChevronRightIcon className={chevronClasses} />,
          )}
        {showFirstLast &&
          renderNavButton(
            'last',
            pageCount,
            atEnd,
            <ChevronDoubleRightIcon className={chevronClasses} />,
          )}
```

After:

```tsx
        {showPreviousNext &&
          renderNavButton(
            'next',
            Math.min(pageCount, page + 1),
            atEnd,
            <ChevronRightIcon className={chevronClasses} />,
            paginationClassNames.nextButton,
          )}
        {showFirstLast &&
          renderNavButton(
            'last',
            pageCount,
            atEnd,
            <ChevronDoubleRightIcon className={chevronClasses} />,
            paginationClassNames.lastButton,
          )}
```

(The chevron glyphs stay unclassed: the whole content of a button part, judgement 26.)

`src/components/navigation/Stepper.tsx` — add after the `cn` import:

```tsx
import { stepperClassNames, stepperStepClassNames } from '../../lib/classNames';
```

Before (the icon slot):

```tsx
    indicator = renderSlot(icon, 'span', indicatorSlotClasses, { 'aria-hidden': true });
```

After:

```tsx
    indicator = renderSlot(icon, 'span', cn(stepperStepClassNames.icon, indicatorSlotClasses), {
      'aria-hidden': true,
    });
```

Before (the step's `<li>` and root; the root is where `className` lands):

```tsx
    <li ref={registerItem} className={cn('flex min-w-0', horizontal && !isLast && 'flex-1')}>
```

After:

```tsx
    <li
      ref={registerItem}
      className={cn(stepperStepClassNames.listItem, 'flex min-w-0', horizontal && !isLast && 'flex-1')}
    >
```

Before:

```tsx
        className={cn(horizontal ? 'flex flex-1 items-center' : 'flex flex-1 flex-col', className)}
```

After:

```tsx
        className={cn(
          stepperStepClassNames.root,
          horizontal ? 'flex flex-1 items-center' : 'flex flex-1 flex-col',
          className,
        )}
```

Before (the `role="button"` element):

```tsx
          className={cn(
            'relative flex rounded',
```

After:

```tsx
          className={cn(
            stepperStepClassNames.button,
            'relative flex rounded',
```

Before (the indicator circle):

```tsx
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none',
```

After:

```tsx
            className={cn(
              stepperStepClassNames.indicator,
              'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none',
```

Before (the label):

```tsx
              className={cn(
                'font-semibold',
                horizontal ? 'text-caption-1 whitespace-nowrap' : 'text-body-1',
```

After:

```tsx
              className={cn(
                stepperStepClassNames.label,
                'font-semibold',
                horizontal ? 'text-caption-1 whitespace-nowrap' : 'text-body-1',
```

Before (the description):

```tsx
                className={cn(
                  'text-muted-foreground',
                  horizontal ? 'text-caption-2 whitespace-nowrap' : 'text-caption-1',
```

After:

```tsx
                className={cn(
                  stepperStepClassNames.description,
                  'text-muted-foreground',
                  horizontal ? 'text-caption-2 whitespace-nowrap' : 'text-caption-1',
```

Before (the connector):

```tsx
            className={cn(
              'transition-colors motion-reduce:transition-none',
```

After:

```tsx
            className={cn(
              stepperStepClassNames.connector,
              'transition-colors motion-reduce:transition-none',
```

Before (`StepperRoot` and its list):

```tsx
        className={cn('flex', horizontal ? 'flex-row items-start' : 'flex-col', className)}
```

After:

```tsx
        className={cn(
          stepperClassNames.root,
          'flex',
          horizontal ? 'flex-row items-start' : 'flex-col',
          className,
        )}
```

Before:

```tsx
          className={cn(
            'm-0 flex list-none p-0',
            horizontal ? 'flex-1 flex-row items-start' : 'flex-col',
```

After:

```tsx
          className={cn(
            stepperClassNames.list,
            'm-0 flex list-none p-0',
            horizontal ? 'flex-1 flex-row items-start' : 'flex-col',
```

(The step's text column and its visually hidden status text stay unclassed: a layout wrapper and hidden text are no parts.)

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run src/components/navigation/__tests__/stableClassNames.test.tsx`
Expected: PASS (every case).

- [ ] **Step 10: Check the folder's existing class assertions**

Run: `grep -rnE "toHaveAttribute\('class'|\.className\)\.toBe\(|getAttribute\('class'\)\)\.toBe\(|classList\)\.toEqual|toMatchInlineSnapshot|toMatchSnapshot" src/components/navigation/__tests__`
Expected: no output. The folder's class assertions are `toHaveClass` subsets and negative regexes (Breadcrumb `rtl:`, Menu.items `border-l-|pl-2`, Menu raw colors, Nav `border-(l|r)`/`pl|pr`, Pagination `hover:`/`text-white`/`rtl:`, Stepper `text-white`/`ml-`/`\d+px`); no pattern matches a `wave-…` class, so none changes (spec §6.4 lists none for this folder). The `MenuItemRow` tests of `Menu.items.test.tsx` render the row without `partClassNames` and keep passing: `cn(undefined, 'flex-1')` is `flex-1`.

- [ ] **Step 11: Folder checks**

Run:

```bash
npx vitest run src/components/navigation
npx vitest run src/components/navigation/__tests__/stableClassNames.test.tsx --reporter=default
npx vitest run src/__tests__/conventions.test.ts -t "src/components/navigation/"
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/navigation --max-warnings 0
node scripts/build-css.mjs
```

Expected: all pass; no act() warning and no `[WaveUI]` line in the `--reporter=default` run; `build-css` passes (the added comments name no utility).

- [ ] **Step 12: Commit**

```bash
git add src/components/navigation/__tests__/stableClassNames.test.tsx src/components/navigation/Breadcrumb.tsx src/components/navigation/Menu.root.tsx src/components/navigation/Menu.items.tsx src/components/navigation/Menu.selectable.tsx src/components/navigation/Menu.link.tsx src/components/navigation/Menu.popover.tsx src/components/navigation/Menu.group.tsx src/components/navigation/Menu.splitGroup.tsx src/components/navigation/Nav.tsx src/components/navigation/Pagination.tsx src/components/navigation/Stepper.tsx
git commit -m "feat(navigation): stable class names"
```

---

### Task A10: Stable class names — overlays folder

**Files:**
- Create: `src/components/overlays/__tests__/stableClassNames.test.tsx`
- Modify: `src/components/overlays/Dialog.tsx` (import; `DialogContent` backdrop, surface, title heading, Close Button, body; `DialogTitle`; `DialogFooter`)
- Modify: `src/components/overlays/Drawer.tsx` (import; `DrawerTitle`; backdrop, panel, header, title heading, Close Button, body)
- Modify: `src/components/overlays/Popover.tsx` (import; `PopoverContent` surface, beak, title)
- Modify: `src/components/overlays/Tooltip.tsx` (import; wrapper, surface)
- Modify: `src/components/overlays/TeachingPopover.tsx` (import; surface, beak, Close, title, body, footer, dots, Back, Next)
- Test (update, §6.4): `src/components/overlays/__tests__/Drawer.test.tsx:1649`
- Not touched: `Popover.shared.tsx` (`PopoverBeak` is a shared renderer: the part class is passed through its `className` at each call site, D4), `Dialog.shared.tsx`

**Interfaces:**
- Consumes (Task A1): `buttonClassNames` { root } (tests only), `dialogContentClassNames` { root, backdrop, closeButton, body }, `dialogTitleClassNames` { root }, `dialogFooterClassNames` { root }, `popoverContentClassNames` { root, beak, title }, `tooltipClassNames` { root, content }, `drawerClassNames` { root, backdrop, header, closeButton, body }, `drawerTitleClassNames` { root }, `teachingPopoverClassNames` { root, beak, closeButton, title, body, footer, dot, backButton, nextButton }.
- Produces: the overlays folder's 0.7 elements carry their Appendix A classes; the Buttons these components render carry `wave-button` plus their part class (nested public components, D5).

- [ ] **Step 1: Write the failing DOM class test**

Create `src/components/overlays/__tests__/stableClassNames.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  buttonClassNames,
  dialogContentClassNames,
  dialogFooterClassNames,
  dialogTitleClassNames,
  drawerClassNames,
  drawerTitleClassNames,
  popoverContentClassNames,
  teachingPopoverClassNames,
  tooltipClassNames,
} from '../../../lib/classNames';
import { Dialog } from '../Dialog';
import { Drawer } from '../Drawer';
import { Popover } from '../Popover';
import { TeachingPopover } from '../TeachingPopover';
import type { TeachingPopoverStep } from '../TeachingPopover';
import { Tooltip } from '../Tooltip';

const steps: TeachingPopoverStep[] = [
  { title: 'Welcome', body: 'Start here.' },
  { title: 'Share', body: 'Invite your team.' },
];

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): overlays folder', () => {
  it('Dialog.Content: surface root, backdrop, the title heading, the Close Button, body and footer', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Edit profile">
          <p>Profile fields</p>
          <Dialog.Footer data-testid="footer">
            <button type="button">Save</button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>,
    );
    const surface = screen.getByRole('dialog', { name: 'Edit profile' });
    expect(surface).toHaveClass(dialogContentClassNames.root);
    expect(surface.parentElement).toHaveClass(dialogContentClassNames.backdrop);
    // The `title` prop's heading carries the Dialog.Title class (judgement 13).
    expect(screen.getByRole('heading', { name: 'Edit profile' })).toHaveClass(
      dialogTitleClassNames.root,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      buttonClassNames.root,
      dialogContentClassNames.closeButton,
    );
    expect(screen.getByText('Profile fields').parentElement).toHaveClass(
      dialogContentClassNames.body,
    );
    expect(screen.getByTestId('footer')).toHaveClass(dialogFooterClassNames.root);
  });

  it('Dialog.Title: the root on the heading', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Rename file</Dialog.Title>
          <p>Body</p>
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('heading', { name: 'Rename file' })).toHaveClass(
      dialogTitleClassNames.root,
    );
  });

  it('Drawer: panel root while open, backdrop, header, the title heading, the Close Button and body', () => {
    render(
      <Drawer title="Filters" defaultOpen>
        <p>Filter fields</p>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    expect(panel).toHaveClass(drawerClassNames.root);
    expect(panel.parentElement).toHaveClass(drawerClassNames.backdrop);
    expect(screen.getByRole('heading', { name: 'Filters' })).toHaveClass(drawerTitleClassNames.root);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass(buttonClassNames.root, drawerClassNames.closeButton);
    expect(close.parentElement).toHaveClass(drawerClassNames.header);
    expect(screen.getByText('Filter fields').parentElement).toHaveClass(drawerClassNames.body);
  });

  it('Drawer.Title: the root on the heading', () => {
    render(
      <Drawer defaultOpen>
        <Drawer.Title>Settings</Drawer.Title>
        <p>Body</p>
      </Drawer>,
    );
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveClass(
      drawerTitleClassNames.root,
    );
  });

  it('Popover.Content: surface root, beak and title', async () => {
    render(
      <Popover defaultOpen>
        <Popover.Trigger>
          <button type="button">Details</button>
        </Popover.Trigger>
        <Popover.Content title="Shipping">Ships in 2 days</Popover.Content>
      </Popover>,
    );
    await act(async () => {});
    const surface = screen.getByRole('dialog', { name: 'Shipping' });
    expect(surface).toHaveClass(popoverContentClassNames.root);
    expect(surface.querySelector('[data-wave-popover-arrow]')).toHaveClass(
      popoverContentClassNames.beak,
    );
    expect(screen.getByRole('heading', { name: 'Shipping' })).toHaveClass(
      popoverContentClassNames.title,
    );
  });

  it('Tooltip: root on the wrapper, content on the surface', async () => {
    render(
      <Tooltip content="Saves the draft" defaultOpen>
        <button type="button">Save</button>
      </Tooltip>,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Save' }).parentElement).toHaveClass(
      tooltipClassNames.root,
    );
    expect(document.querySelector('[data-wave-tooltip-surface]')).toHaveClass(
      tooltipClassNames.content,
    );
  });

  it('TeachingPopover: root and every part of the surface; its Buttons carry the Button class', () => {
    render(<TeachingPopover steps={steps} />);
    const surface = screen.getByRole('dialog', { name: /^Welcome/ });
    expect(surface).toHaveClass(teachingPopoverClassNames.root);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      buttonClassNames.root,
      teachingPopoverClassNames.closeButton,
    );
    expect(screen.getByRole('heading', { name: /^Welcome/ })).toHaveClass(
      teachingPopoverClassNames.title,
    );
    expect(screen.getByText('Start here.')).toHaveClass(teachingPopoverClassNames.body);
    const dots = Array.from(surface.querySelectorAll('[data-wave-teaching-popover-dot]'));
    expect(dots).toHaveLength(2);
    for (const dot of dots) expect(dot).toHaveClass(teachingPopoverClassNames.dot);
    // dot → its row (a layout wrapper, judgement 27) → the footer row.
    expect(dots[0].parentElement?.parentElement).toHaveClass(teachingPopoverClassNames.footer);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass(
      buttonClassNames.root,
      teachingPopoverClassNames.backButton,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass(
      buttonClassNames.root,
      teachingPopoverClassNames.nextButton,
    );
  });

  it('TeachingPopover with a target: the beak', async () => {
    function Anchored() {
      const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
      return (
        <>
          <button type="button" ref={setTarget}>
            New feature
          </button>
          <TeachingPopover steps={steps} target={target} />
        </>
      );
    }
    render(<Anchored />);
    await act(async () => {});
    expect(document.querySelector('[data-wave-teaching-popover-arrow]')).toHaveClass(
      teachingPopoverClassNames.beak,
    );
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(
        <>
          <Tooltip content="Saves the draft">
            <button type="button">Save</button>
          </Tooltip>
          <TeachingPopover steps={steps} />
        </>,
      ),
    );
    expect(host.querySelector('button')?.parentElement).toHaveClass(tooltipClassNames.root);
    const surface = host.querySelector('[role="dialog"]');
    expect(surface).toHaveClass(teachingPopoverClassNames.root);
    expect(surface?.querySelector('h3')).toHaveClass(teachingPopoverClassNames.title);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/overlays/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case, e.g. `Expected the element to have class: wave-dialog-content`.

- [ ] **Step 3: `Dialog.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import {
  dialogContentClassNames,
  dialogFooterClassNames,
  dialogTitleClassNames,
} from '../../lib/classNames';
```

The anchors below are the file as merged from `main` at 7bd688d (it includes `fix/dialog-surface-margin`: the backdrop has no padding, the surface has its own margin and a zero minimum width, and the body is in the primary text colour). Change nothing inside a literal; only add the stable class in front of it.

Backdrop (`:368`) — before:

```tsx
        className="fixed inset-0 flex items-center justify-center bg-backdrop"
```

After:

```tsx
        className={cn(
          dialogContentClassNames.backdrop,
          'fixed inset-0 flex items-center justify-center bg-backdrop',
        )}
```

Surface (`:379-389`) — before:

```tsx
          className={cn(
            // The border marks the surface where the shadow cannot: in high contrast the page,
```

After — the root goes first, before the comment (the six comment lines and the class literal below stay as they are):

```tsx
          className={cn(
            dialogContentClassNames.root,
            // The border marks the surface where the shadow cannot: in high contrast the page,
```

The `title` prop's heading (`:393`; it carries `wave-dialog-title`, Appendix A judgement 13) — before:

```tsx
              <h2 id={propTitleId} className="pe-8 text-subtitle-1 font-semibold">
```

After:

```tsx
              <h2
                id={propTitleId}
                className={cn(dialogTitleClassNames.root, 'pe-8 text-subtitle-1 font-semibold')}
              >
```

Close Button (`:405`; Button adds `wave-button` itself) — before:

```tsx
              className="absolute end-4 top-4 text-muted-foreground"
```

After:

```tsx
              className={cn(
                dialogContentClassNames.closeButton,
                'absolute end-4 top-4 text-muted-foreground',
              )}
```

Body (`:409`) — before:

```tsx
              className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto scroll-pb-(--wave-dialog-footer-height) p-1 text-body-1"
```

After:

```tsx
              className={cn(
                dialogContentClassNames.body,
                '-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto scroll-pb-(--wave-dialog-footer-height) p-1 text-body-1',
              )}
```

`DialogTitle` (`:438`) — before:

```tsx
      className={cn('pe-8 text-subtitle-1 font-semibold text-foreground', className)}
```

After:

```tsx
      className={cn(
        dialogTitleClassNames.root,
        'pe-8 text-subtitle-1 font-semibold text-foreground',
        className,
      )}
```

`DialogFooter` (`:508`) — before:

```tsx
      className={cn(setFooterHeight ? stickyFooterClasses : footerRowClasses, className)}
```

After:

```tsx
      className={cn(
        dialogFooterClassNames.root,
        setFooterHeight ? stickyFooterClasses : footerRowClasses,
        className,
      )}
```

- [ ] **Step 4: `Drawer.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { drawerClassNames, drawerTitleClassNames } from '../../lib/classNames';
```

`DrawerTitle` — before:

```tsx
      className={cn('text-subtitle-1 font-semibold text-foreground', className)}
```

After:

```tsx
      className={cn(drawerTitleClassNames.root, 'text-subtitle-1 font-semibold text-foreground', className)}
```

Backdrop and panel — before:

```tsx
          <div className="fixed inset-0 bg-backdrop" onMouseDown={backdropPress.onMouseDown}>
```

After:

```tsx
          <div
            className={cn(drawerClassNames.backdrop, 'fixed inset-0 bg-backdrop')}
            onMouseDown={backdropPress.onMouseDown}
          >
```

and before:

```tsx
              className={cn(
                'fixed top-0 flex h-full w-80 max-w-full flex-col border-border bg-background text-foreground shadow-64',
```

After:

```tsx
              className={cn(
                drawerClassNames.root,
                'fixed top-0 flex h-full w-80 max-w-full flex-col border-border bg-background text-foreground shadow-64',
```

Header, title heading, Close Button and body — before:

```tsx
                  <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                    {hasTitle && (
                      <h2 id={propTitleId} className="text-subtitle-1 font-semibold">
```

After:

```tsx
                  <div
                    className={cn(
                      drawerClassNames.header,
                      'flex items-center justify-between gap-2 border-b border-border p-4',
                    )}
                  >
                    {hasTitle && (
                      <h2
                        id={propTitleId}
                        className={cn(drawerTitleClassNames.root, 'text-subtitle-1 font-semibold')}
                      >
```

and before:

```tsx
                      className="ms-auto text-muted-foreground"
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">{content}</div>
```

After:

```tsx
                      className={cn(drawerClassNames.closeButton, 'ms-auto text-muted-foreground')}
                    />
                  </div>
                  <div className={cn(drawerClassNames.body, 'min-h-0 flex-1 overflow-y-auto p-4')}>
                    {content}
                  </div>
```

- [ ] **Step 5: `Popover.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { popoverContentClassNames } from '../../lib/classNames';
```

Surface — before:

```tsx
        className={cn(
          'w-64 rounded-md border border-border bg-background p-4 text-body-1 font-normal text-foreground normal-case tracking-normal text-start shadow-4',
```

After:

```tsx
        className={cn(
          popoverContentClassNames.root,
          'w-64 rounded-md border border-border bg-background p-4 text-body-1 font-normal text-foreground normal-case tracking-normal text-start shadow-4',
```

Beak and title — before:

```tsx
        <PopoverBeak
          ref={arrowRef}
          side={placedSide}
          style={arrowStyles}
          data-wave-popover-arrow=""
        />
        {hasTitle && (
          <h2 id={titleId} className="mb-2 text-subtitle-2 font-semibold">
```

After (`PopoverBeak` merges a passed `className` after its own; order does not matter for a class that conflicts with none):

```tsx
        <PopoverBeak
          ref={arrowRef}
          side={placedSide}
          style={arrowStyles}
          data-wave-popover-arrow=""
          className={popoverContentClassNames.beak}
        />
        {hasTitle && (
          <h2
            id={titleId}
            className={cn(popoverContentClassNames.title, 'mb-2 text-subtitle-2 font-semibold')}
          >
```

- [ ] **Step 6: `Tooltip.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { tooltipClassNames } from '../../lib/classNames';
```

Wrapper — before: `className={cn('inline-block', className)}` → after:

```tsx
      className={cn(tooltipClassNames.root, 'inline-block', className)}
```

Surface — before:

```tsx
            className={cn(surfaceClasses, appearanceClasses[appearance])}
```

After:

```tsx
            className={cn(tooltipClassNames.content, surfaceClasses, appearanceClasses[appearance])}
```

(The inline `hidden` `role="tooltip"` span is a description, not a part.)

- [ ] **Step 7: `TeachingPopover.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { teachingPopoverClassNames } from '../../lib/classNames';
```

Surface — before:

```tsx
        className={cn(
          'relative w-80 rounded-md border border-border bg-background p-5 text-foreground shadow-8',
```

After:

```tsx
        className={cn(
          teachingPopoverClassNames.root,
          'relative w-80 rounded-md border border-border bg-background p-5 text-foreground shadow-8',
```

Beak — before:

```tsx
            data-wave-teaching-popover-arrow=""
          />
```

After:

```tsx
            data-wave-teaching-popover-arrow=""
            className={teachingPopoverClassNames.beak}
          />
```

Close Button, title and body — before:

```tsx
          className="absolute end-3 top-3"
          onClick={dismiss}
        />

        <h3 id={titleId} className="mb-2 pe-8 text-subtitle-1 font-semibold text-foreground">
```

After:

```tsx
          className={cn(teachingPopoverClassNames.closeButton, 'absolute end-3 top-3')}
          onClick={dismiss}
        />

        <h3
          id={titleId}
          className={cn(
            teachingPopoverClassNames.title,
            'mb-2 pe-8 text-subtitle-1 font-semibold text-foreground',
          )}
        >
```

and before:

```tsx
        <div className="mb-4 text-body-1 text-muted-foreground">{step.body}</div>

        <div className="flex items-center justify-between gap-2">
```

After:

```tsx
        <div className={cn(teachingPopoverClassNames.body, 'mb-4 text-body-1 text-muted-foreground')}>
          {step.body}
        </div>

        <div
          className={cn(teachingPopoverClassNames.footer, 'flex items-center justify-between gap-2')}
        >
```

(The dot row and the action row are layout wrappers, judgement 27.)

Dots — before:

```tsx
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none',
```

After:

```tsx
                className={cn(
                  teachingPopoverClassNames.dot,
                  'h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none',
```

Back and Next — before:

```tsx
              <Button
                {...focusableDisabledProps(isFirst)}
                onClick={preventIfDisabled(isFirst, handleBack)}
              >
```

After:

```tsx
              <Button
                {...focusableDisabledProps(isFirst)}
                className={teachingPopoverClassNames.backButton}
                onClick={preventIfDisabled(isFirst, handleBack)}
              >
```

and before:

```tsx
            <Button appearance="primary" onClick={handleNext}>
```

After:

```tsx
            <Button
              appearance="primary"
              className={teachingPopoverClassNames.nextButton}
              onClick={handleNext}
            >
```

- [ ] **Step 8: Run the DOM class test to verify it passes**

Run: `npx vitest run src/components/overlays/__tests__/stableClassNames.test.tsx`
Expected: PASS.

- [ ] **Step 9: Update the §6.4 assertion in `Drawer.test.tsx`**

Add after the other imports:

```tsx
import { dialogFooterClassNames } from '../../../lib/classNames';
```

Line 1649 — before:

```tsx
        expect(footer).toHaveAttribute('class', 'mt-6 flex justify-end gap-2');
```

After:

```tsx
        expect(footer).toHaveAttribute('class', `${dialogFooterClassNames.root} mt-6 flex justify-end gap-2`);
```

- [ ] **Step 10: Run the folder's tests**

Run: `npx vitest run src/components/overlays`
Expected: PASS.

- [ ] **Step 11: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx prettier --write src/components/overlays
npx eslint src/components/overlays --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/overlays/"
```
Expected: all pass (Prettier only reformats the lines this task touched; commit its result).

- [ ] **Step 12: Commit**

```bash
git add src/components/overlays
git commit -m "feat(overlays): stable class names"
```

---

### Task A11: Stable class names — table folder

**Files:**
- Create: `src/components/table/__tests__/stableClassNames.test.tsx`
- Modify: `src/components/table/Table.tsx` (import; container, `<table>`, and every part)
- Modify: `src/components/table/DataGrid.tsx` (import; container, grid, header selection cells, select-all checkbox, header, sort icon, header cell and its button, body, row selection cell and control, row, cell)
- Not touched: `useGridNavigation.ts`

**Interfaces:**
- Consumes (Task A1): `tableClassNames` { root, container }, `tableHeaderClassNames`, `tableHeaderCellClassNames`, `tableBodyClassNames`, `tableRowClassNames`, `tableCellClassNames` (each { root }), `dataGridClassNames` { root, container }, `dataGridHeaderClassNames` { root, selectionCell, selectAllCheckbox }, `dataGridHeaderCellClassNames` { root, button, sortIcon }, `dataGridBodyClassNames` { root }, `dataGridRowClassNames` { root, selectionCell, selectionControl }, `dataGridCellClassNames` { root }.
- Produces: the table folder's 0.7 elements carry their Appendix A classes. The deprecated `TableHead`/`TableHeadCell` render `TableHeader`/`TableHeaderCell`, so they carry their replacements' classes (the alias table of Task A13 maps them).

- [ ] **Step 1: Write the failing DOM class test**

Create `src/components/table/__tests__/stableClassNames.test.tsx`:

```tsx
import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  dataGridBodyClassNames,
  dataGridCellClassNames,
  dataGridClassNames,
  dataGridHeaderCellClassNames,
  dataGridHeaderClassNames,
  dataGridRowClassNames,
  tableBodyClassNames,
  tableCellClassNames,
  tableClassNames,
  tableHeaderCellClassNames,
  tableHeaderClassNames,
  tableRowClassNames,
} from '../../../lib/classNames';
import { DataGrid } from '../DataGrid';
import { Table, TableHead, TableHeadCell } from '../Table';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): table folder', () => {
  it('Table: root on the table element, the container outside it, and every part', () => {
    render(
      <Table>
        <caption>Orders</caption>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Item</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Tea</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const table = screen.getByRole('table', { name: 'Orders' });
    expect(table).toHaveClass(tableClassNames.root);
    expect(table.parentElement).toHaveClass(tableClassNames.container);
    expect(table.querySelector('thead')).toHaveClass(tableHeaderClassNames.root);
    expect(screen.getByRole('columnheader', { name: 'Item' })).toHaveClass(
      tableHeaderCellClassNames.root,
    );
    expect(table.querySelector('tbody')).toHaveClass(tableBodyClassNames.root);
    for (const row of screen.getAllByRole('row')) expect(row).toHaveClass(tableRowClassNames.root);
    expect(screen.getByRole('cell', { name: 'Tea' })).toHaveClass(tableCellClassNames.root);
  });

  it('the deprecated Table.Head and Table.HeadCell carry the classes of their replacements', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Table>
        <TableHead>
          <Table.Row>
            <TableHeadCell>Item</TableHeadCell>
          </Table.Row>
        </TableHead>
      </Table>,
    );
    const header = screen.getByRole('columnheader', { name: 'Item' });
    expect(header).toHaveClass(tableHeaderCellClassNames.root);
    expect(header.closest('thead')).toHaveClass(tableHeaderClassNames.root);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Table: `Table.Head` is deprecated and will be removed in 1.0. Use `Table.Header` instead.',
      ],
      [
        '[WaveUI] Table: `Table.HeadCell` is deprecated and will be removed in 1.0. Use `Table.HeaderCell` instead.',
      ],
    ]);
  });

  it('DataGrid: root, container, header with its selection cells, sortable header cell, body, row and cell', () => {
    render(
      <DataGrid
        aria-label="Files"
        selectionMode="multiple"
        defaultSort={{ columnId: 'name', direction: 'ascending' }}
      >
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Document</DataGrid.HeaderCell>
          </tr>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="report">
            <DataGrid.Cell>Report</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    const grid = screen.getByRole('grid', { name: 'Files' });
    expect(grid).toHaveClass(dataGridClassNames.root);
    expect(grid.parentElement).toHaveClass(dataGridClassNames.container);

    const thead = grid.querySelector('thead') as HTMLTableSectionElement;
    expect(thead).toHaveClass(dataGridHeaderClassNames.root);
    // The first header row's select-all cell and a later row's empty cell (judgement 15).
    expect(thead.rows[0].cells[0]).toHaveClass(dataGridHeaderClassNames.selectionCell);
    expect(thead.rows[1].cells[0]).toHaveClass(dataGridHeaderClassNames.selectionCell);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveClass(
      dataGridHeaderClassNames.selectAllCheckbox,
    );

    const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
    expect(nameHeader).toHaveClass(dataGridHeaderCellClassNames.root);
    const sortButton = within(nameHeader).getByRole('button', { name: 'Name' });
    expect(sortButton).toHaveClass(dataGridHeaderCellClassNames.button);
    expect(sortButton.querySelector('svg')).toHaveClass(dataGridHeaderCellClassNames.sortIcon);

    expect(grid.querySelector('tbody')).toHaveClass(dataGridBodyClassNames.root);
    const cell = screen.getByText('Report');
    expect(cell).toHaveClass(dataGridCellClassNames.root);
    const row = cell.closest('tr') as HTMLTableRowElement;
    expect(row).toHaveClass(dataGridRowClassNames.root);
    const control = within(row).getByRole('checkbox');
    expect(control).toHaveClass(dataGridRowClassNames.selectionControl);
    expect(control.closest('td')).toHaveClass(dataGridRowClassNames.selectionCell);
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(
        <Table>
          <caption>Orders</caption>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Tea</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      ),
    );
    expect(host.querySelector('table')).toHaveClass(tableClassNames.root);
    expect(host.querySelector('td')).toHaveClass(tableCellClassNames.root);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/table/__tests__/stableClassNames.test.tsx`
Expected: FAIL in every case, e.g. `Expected the element to have class: wave-table`.

- [ ] **Step 3: `Table.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import {
  tableBodyClassNames,
  tableCellClassNames,
  tableClassNames,
  tableHeaderCellClassNames,
  tableHeaderClassNames,
  tableRowClassNames,
} from '../../lib/classNames';
```

Container — before:

```tsx
      className={cn(
        'overflow-x-auto rounded-md border border-border',
        scrollable && focusRing,
        containerClassName,
      )}
```

After:

```tsx
      className={cn(
        tableClassNames.container,
        'overflow-x-auto rounded-md border border-border',
        scrollable && focusRing,
        containerClassName,
      )}
```

`<table>` — before:

```tsx
        className={cn(
          'w-full border-separate border-spacing-0',
```

After:

```tsx
        className={cn(
          tableClassNames.root,
          'w-full border-separate border-spacing-0',
```

`TableHeader` — before: `  <thead ref={ref} {...rest} className={cn('bg-card', className)}>` → after:

```tsx
  <thead ref={ref} {...rest} className={cn(tableHeaderClassNames.root, 'bg-card', className)}>
```

`TableHeaderCell` — before:

```tsx
    className={cn(
      'px-4 py-3 text-start font-semibold text-caption-1 uppercase tracking-wider border-b border-border',
```

After:

```tsx
    className={cn(
      tableHeaderCellClassNames.root,
      'px-4 py-3 text-start font-semibold text-caption-1 uppercase tracking-wider border-b border-border',
```

`TableBody` (its `className` went through without `cn()`; rule 1) — before: `  <tbody ref={ref} {...rest} className={className}>` → after:

```tsx
  <tbody ref={ref} {...rest} className={cn(tableBodyClassNames.root, className)}>
```

`TableRow` — before:

```tsx
    className={cn(
      'hover:bg-subtle-hover transition-colors motion-reduce:transition-none',
```

After:

```tsx
    className={cn(
      tableRowClassNames.root,
      'hover:bg-subtle-hover transition-colors motion-reduce:transition-none',
```

`TableCell` — before: `    className={cn('px-4 py-3 text-body-1 border-b border-border', className)}` → after:

```tsx
    className={cn(tableCellClassNames.root, 'px-4 py-3 text-body-1 border-b border-border', className)}
```

- [ ] **Step 4: `DataGrid.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import {
  dataGridBodyClassNames,
  dataGridCellClassNames,
  dataGridClassNames,
  dataGridHeaderCellClassNames,
  dataGridHeaderClassNames,
  dataGridRowClassNames,
} from '../../lib/classNames';
```

Container and grid — before:

```tsx
          className={cn('overflow-x-auto rounded-md border border-border', containerClassName)}
        >
          <table
            ref={mergedRef}
            role="grid"
            aria-multiselectable={selectionMode === 'multiple' || undefined}
            className={cn('w-full border-separate border-spacing-0', className)}
```

After:

```tsx
          className={cn(
            dataGridClassNames.container,
            'overflow-x-auto rounded-md border border-border',
            containerClassName,
          )}
        >
          <table
            ref={mergedRef}
            role="grid"
            aria-multiselectable={selectionMode === 'multiple' || undefined}
            className={cn(dataGridClassNames.root, 'w-full border-separate border-spacing-0', className)}
```

The header's selection cell and the select-all checkbox (in `DataGridSelectionHeaderCell`; `DataGrid.Header` owns them, judgement 15) — before:

```tsx
      className={cn(selectionCell, 'text-start', focusRingInset)}
```

After:

```tsx
      className={cn(dataGridHeaderClassNames.selectionCell, selectionCell, 'text-start', focusRingInset)}
```

and before (the select-all `<input>`):

```tsx
          className={cn(nativeControl, focusRingInset)}
        />
      ) : (
        <span className="sr-only">{selectionHeaderLabel}</span>
```

After:

```tsx
          className={cn(dataGridHeaderClassNames.selectAllCheckbox, nativeControl, focusRingInset)}
        />
      ) : (
        <span className="sr-only">{selectionHeaderLabel}</span>
```

A later header row's empty selection cell (in `DataGridSelectionHeaderSlot`) — before:

```tsx
    <td ref={cellRef} data-selection-cell="" className={cn(selectionCell, focusRingInset)} />
```

After:

```tsx
    <td
      ref={cellRef}
      data-selection-cell=""
      className={cn(dataGridHeaderClassNames.selectionCell, selectionCell, focusRingInset)}
    />
```

`DataGridHeader` — before:

```tsx
        <thead ref={mergedRef} className={cn('bg-card', className)} {...rest}>
```

After:

```tsx
        <thead
          ref={mergedRef}
          className={cn(dataGridHeaderClassNames.root, 'bg-card', className)}
          {...rest}
        >
```

Sort icon (drawn for `DataGrid.HeaderCell`, named literally in this module, rule 8) — before:

```tsx
const sortIcon = (direction: SortDirection) => (
  <svg
    className="h-3 w-3 shrink-0"
```

After:

```tsx
const sortIcon = (direction: SortDirection) => (
  <svg
    className={cn(dataGridHeaderCellClassNames.sortIcon, 'h-3 w-3 shrink-0')}
```

`DataGridHeaderCell` — before:

```tsx
      className={cn(
        cellBase,
        'text-start align-middle font-semibold text-caption-1 uppercase tracking-wider',
```

After:

```tsx
      className={cn(
        dataGridHeaderCellClassNames.root,
        cellBase,
        'text-start align-middle font-semibold text-caption-1 uppercase tracking-wider',
```

and its sort button — before:

```tsx
          className={cn(
            'inline-flex w-full cursor-pointer select-none items-center gap-1 border-0 bg-transparent px-4 py-3 text-start text-inherit [font:inherit] uppercase tracking-wider',
```

After:

```tsx
          className={cn(
            dataGridHeaderCellClassNames.button,
            'inline-flex w-full cursor-pointer select-none items-center gap-1 border-0 bg-transparent px-4 py-3 text-start text-inherit [font:inherit] uppercase tracking-wider',
```

(The content `<span>` of a column that is not sortable is a layout wrapper, judgement 27.)

`DataGridBody` (rule 1) — before: `    <tbody ref={ref} className={className} {...rest}>` → after:

```tsx
    <tbody ref={ref} className={cn(dataGridBodyClassNames.root, className)} {...rest}>
```

`DataGridRow` — the body selection cell and control, before:

```tsx
      <td role="gridcell" data-selection-cell="" className={cn(selectionCell, focusRingInset)}>
```

After:

```tsx
      <td
        role="gridcell"
        data-selection-cell=""
        className={cn(dataGridRowClassNames.selectionCell, selectionCell, focusRingInset)}
      >
```

and before (the row's checkbox or radio `<input>`):

```tsx
            aria-labelledby={selectionLabel === undefined ? labelledBy : undefined}
            className={cn(nativeControl, focusRingInset)}
```

After:

```tsx
            aria-labelledby={selectionLabel === undefined ? labelledBy : undefined}
            className={cn(dataGridRowClassNames.selectionControl, nativeControl, focusRingInset)}
```

The row — before:

```tsx
      className={cn(
        !inHeader &&
          'hover:bg-subtle-hover data-[selected]:bg-selected transition-colors motion-reduce:transition-none',
```

After:

```tsx
      className={cn(
        dataGridRowClassNames.root,
        !inHeader &&
          'hover:bg-subtle-hover data-[selected]:bg-selected transition-colors motion-reduce:transition-none',
```

(A `DataGrid.Row` inside the header renders `DataGridSelectionHeaderSlot`, so its selection cell carries the header's class, judgement 15.)

`DataGridCell` — before: `    className={cn(cellBase, 'text-body-1', focusRingInset, className)}` → after:

```tsx
    className={cn(dataGridCellClassNames.root, cellBase, 'text-body-1', focusRingInset, className)}
```

- [ ] **Step 5: Run the DOM class test to verify it passes**

Run: `npx vitest run src/components/table/__tests__/stableClassNames.test.tsx --reporter=default`
Expected: PASS with no unasserted console output.

- [ ] **Step 6: Run the folder's tests**

Run: `npx vitest run src/components/table`
Expected: PASS (§6.4: no table assertion compares a complete class string; `Table.test.tsx:166` and `:199` use `not.toContain` on substrings the stable classes do not contain).

- [ ] **Step 7: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx prettier --write src/components/table
npx eslint src/components/table --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/table/"
```
Expected: all pass (Prettier only reformats the lines this task touched; commit its result).

- [ ] **Step 8: Commit**

```bash
git add src/components/table
git commit -m "feat(table): stable class names"
```

---

### Task A12: Stable class names — Text, WaveProvider and Portal

**Files:**
- Create: `src/components/typography/__tests__/stableClassNames.test.tsx`
- Create: `src/components/provider/__tests__/stableClassNames.test.tsx`
- Create: `src/components/portal/__tests__/stableClassNames.test.tsx`
- Modify: `src/components/typography/Text.tsx` (import; root `cn`)
- Modify: `src/components/provider/WaveProvider.tsx` (import; `'wave-root'` → the constant)
- Modify: `src/components/portal/Portal.tsx` (import; `'wave-portal'` → the constant)
- Not touched: `src/components/motion/Presence.tsx` (it clones its child and renders no element: no constant, D3)

**Interfaces:**
- Consumes (Task A1): `textClassNames` { root: 'wave-text' }, `waveProviderClassNames` { root: 'wave-root' }, `portalClassNames` { root: 'wave-portal' }.
- Produces: `WaveProvider` and `Portal` render exactly the markup they rendered in 0.7 (the two existing scope classes now come from the registry, D3); `Text` gains `wave-text`.

- [ ] **Step 1: Write the failing DOM class tests**

Create `src/components/typography/__tests__/stableClassNames.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { textClassNames } from '../../../lib/classNames';
import { Text } from '../Text';

describe('stable class names (P3-00): typography folder', () => {
  it('Text: the root on the rendered element, also with `as`', () => {
    render(
      <>
        <Text>Plain text</Text>
        <Text as="h2" variant="title-2">
          Settings
        </Text>
      </>,
    );
    expect(screen.getByText('Plain text')).toHaveClass(textClassNames.root);
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveClass(textClassNames.root);
  });

  it('renders the class in the server HTML', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<Text>Plain text</Text>);
    expect(host.firstElementChild).toHaveClass(textClassNames.root);
  });
});
```

Create `src/components/provider/__tests__/stableClassNames.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { waveProviderClassNames } from '../../../lib/classNames';
import { WaveProvider } from '../WaveProvider';

describe('stable class names (P3-00): provider folder', () => {
  it('WaveProvider: the root class on its themed element, next to your className', () => {
    render(
      <WaveProvider data-testid="provider" className="app-shell">
        Content
      </WaveProvider>,
    );
    expect(screen.getByTestId('provider')).toHaveClass(waveProviderClassNames.root, 'app-shell');
  });

  it('renders the class in the server HTML', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<WaveProvider>Content</WaveProvider>);
    expect(host.firstElementChild).toHaveClass(waveProviderClassNames.root);
  });
});
```

Create `src/components/portal/__tests__/stableClassNames.test.tsx` (a Portal renders nothing on the server, so it has no server-HTML case):

```tsx
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { portalClassNames } from '../../../lib/classNames';
import { Portal } from '../Portal';

describe('stable class names (P3-00): portal folder', () => {
  it('Portal: the wrapper carries the root class and merges your className', () => {
    render(
      <Portal className="app-layer">
        <span>Inside</span>
      </Portal>,
    );
    expect(screen.getByText('Inside').parentElement).toHaveClass(portalClassNames.root, 'app-layer');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/typography/__tests__/stableClassNames.test.tsx src/components/provider/__tests__/stableClassNames.test.tsx src/components/portal/__tests__/stableClassNames.test.tsx`
Expected: the Text cases FAIL (`Expected the element to have class: wave-text`). The WaveProvider and Portal cases already PASS, because `'wave-root'` and `'wave-portal'` are hard-coded today; they pin that the switch to the constants below changes no output.

- [ ] **Step 3: `Text.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { textClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn(
        variantClasses[variant],
```

After:

```tsx
      className={cn(
        textClassNames.root,
        variantClasses[variant],
```

- [ ] **Step 4: `WaveProvider.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { waveProviderClassNames } from '../../lib/classNames';
```

Before:

```tsx
        className={cn(
          'wave-root',
          themeClassName,
```

After:

```tsx
        className={cn(
          waveProviderClassNames.root,
          themeClassName,
```

- [ ] **Step 5: `Portal.tsx`**

Add after `import { cn } from '../../lib/cn';`:

```tsx
import { portalClassNames } from '../../lib/classNames';
```

Before:

```tsx
      className={cn('wave-portal', themeClassName, className)}
```

After:

```tsx
      className={cn(portalClassNames.root, themeClassName, className)}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/typography src/components/provider src/components/portal`
Expected: PASS (the new files and every existing test of the three folders unchanged).

- [ ] **Step 7: Quick checks**

Run:
```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx prettier --write src/components/typography src/components/provider src/components/portal
npx eslint src/components/typography src/components/provider src/components/portal --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/typography/"
npx vitest run src/__tests__/conventions.test.ts -t "src/components/provider/"
npx vitest run src/__tests__/conventions.test.ts -t "src/components/portal/"
```
Expected: all pass (Prettier only reformats the lines this task touched; commit its result).

- [ ] **Step 8: Commit**

```bash
git add src/components/typography src/components/provider src/components/portal
git commit -m "feat(components): stable class names on Text, WaveProvider and Portal"
```

---

### Task A13: `testSystemProps` checks the stable root classes

**Files:**
- Modify: `src/test-utils.ts` (imports; a new "Stable class names" section before "Internals" at `:385`; `testClassName` at `:490-557`; the header's "Other helpers" list)
- Test: `src/__tests__/test-utils.test.tsx` (imports at `:1-49`; fixtures after `UserFirstBox` at `:144`; new `describe` blocks after `describe('testClassName', …)` at `:801-843`)

**Interfaces:**
- Consumes: the registry of Task A1; every root and variant class applied by Tasks A4–A12.
- Produces (test-only, exported from `src/test-utils.ts`):
  - `export interface StableClassNames { constant: string; root: string; carries: readonly string[] }`
  - `export const DISPLAY_NAME_ALIASES: Readonly<Record<string, string>>` (display name → constant name)
  - `export const VARIANT_BASES: Readonly<Record<string, readonly string[]>>` (constant name → base constant names, base first)
  - `export function getStableClassNames(displayName: string): StableClassNames | undefined`
  - the `testClassName` case `carries its stable classes on the element that receives className`, registered for every component whose `displayName` names a constant (so every `testSystemProps` call runs it). Tasks A14 and A15 import `getStableClassNames`.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/test-utils.test.tsx`:

1. Add imports:

```tsx
import { ToggleButton } from '../components/button/ToggleButton';
import { RadioGroup, RadioItem } from '../components/input/RadioGroup';
import * as registry from '../lib/classNames';
```

and add `DISPLAY_NAME_ALIASES`, `getStableClassNames` and `VARIANT_BASES` to the import list from `'../test-utils'`.

2. After the `UserFirstBox` fixture, add:

```tsx
/** Bug: claims Button's display name, but its className target carries no stable class. */
const UnclassedButton = ({
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" className={cn('px-3', className)} {...rest} />
);
UnclassedButton.displayName = 'Button';

/** RadioGroup.Item needs its group. */
const OneChoiceGroup = ({ children }: { children: React.ReactNode }) => (
  <RadioGroup aria-label="Choice">{children}</RadioGroup>
);
```

3. After `describe('testClassName', …)`, add:

```tsx
// ---------------------------------------------------------------------------
// Stable class names (Fluent parity phase 3, P3-00)
// ---------------------------------------------------------------------------

const STABLE_CASE = 'carries its stable classes on the element that receives className';

describe('getStableClassNames', () => {
  it('finds the constant of a display name by camel case', () => {
    expect(getStableClassNames('CardHeader')).toEqual({
      constant: 'cardHeaderClassNames',
      root: 'wave-card-header',
      carries: ['wave-card-header'],
    });
    expect(getStableClassNames('WaveProvider')).toEqual({
      constant: 'waveProviderClassNames',
      root: 'wave-root',
      carries: ['wave-root'],
    });
  });

  it('finds a display name that differs from its flat name through DISPLAY_NAME_ALIASES', () => {
    expect(getStableClassNames('RadioItem')).toEqual({
      constant: 'radioGroupItemClassNames',
      root: 'wave-radio-group-item',
      carries: ['wave-radio-group-item'],
    });
    expect(getStableClassNames('Step')?.constant).toBe('stepperStepClassNames');
    expect(getStableClassNames('Tab')?.constant).toBe('tabListTabClassNames');
    expect(getStableClassNames('TabPanel')?.constant).toBe('tabListPanelClassNames');
    expect(getStableClassNames('TabPanels')?.constant).toBe('tabListPanelsClassNames');
    expect(getStableClassNames('TableHead')?.constant).toBe('tableHeaderClassNames');
    expect(getStableClassNames('TableHeadCell')?.constant).toBe('tableHeaderCellClassNames');
  });

  it("puts a variant's base roots before its own in carries (VARIANT_BASES)", () => {
    expect(getStableClassNames('ToggleButton')?.carries).toEqual([
      'wave-button',
      'wave-toggle-button',
    ]);
    expect(getStableClassNames('ToolbarToggleButton')?.carries).toEqual([
      'wave-button',
      'wave-toggle-button',
      'wave-toolbar-toggle-button',
    ]);
    expect(getStableClassNames('MenuItemCheckbox')?.carries).toEqual([
      'wave-menu-item',
      'wave-menu-item-checkbox',
    ]);
    expect(getStableClassNames('CounterBadge')?.carries).toEqual([
      'wave-badge',
      'wave-counter-badge',
    ]);
  });

  it('knows no constant for internal components, contexts or an empty name', () => {
    expect(getStableClassNames('MenuItemRow')).toBeUndefined();
    expect(getStableClassNames('ToasterContext')).toBeUndefined();
    expect(getStableClassNames('')).toBeUndefined();
  });

  it('points every alias, variant and base at a registry constant', () => {
    const names = new Set(Object.keys(registry));
    const unknown = [
      ...Object.values(DISPLAY_NAME_ALIASES),
      ...Object.keys(VARIANT_BASES),
      ...Object.values(VARIANT_BASES).flat(),
    ].filter((name) => !names.has(name));
    expect(unknown).toEqual([]);
  });
});

describe('testClassName: stable classes (P3-00)', () => {
  it('registers the case only for a component whose displayName names a constant', () => {
    expect(collect(() => testClassName(GoodBox)).map((t) => t.name)).not.toContain(STABLE_CASE);
    expect(
      collect(() => testClassName(Button, { children: 'Save' })).map((t) => t.name),
    ).toContain(STABLE_CASE);
  });

  it('passes for Button, whose className lands next to wave-button', async () => {
    const tests = collect(() => testClassName(Button, { children: 'Save' }));
    await expect(run(pick(tests, STABLE_CASE))).resolves.toBeUndefined();
  });

  it('checks every class a variant carries (ToggleButton: wave-button and wave-toggle-button)', async () => {
    const tests = collect(() => testClassName(ToggleButton, { children: 'Bold' }));
    await expect(run(pick(tests, STABLE_CASE))).resolves.toBeUndefined();
  });

  it('checks where className lands, not where the rest props go (RadioGroup.Item: the label)', async () => {
    const tests = collect(() =>
      testClassName(RadioItem, { value: 'a', label: 'Alpha' }, { wrapper: OneChoiceGroup }),
    );
    await expect(run(pick(tests, STABLE_CASE))).resolves.toBeUndefined();
  });

  it('fails, naming the constant, when that element lacks a stable class', async () => {
    const tests = collect(() => testClassName(UnclassedButton, { children: 'Save' }));
    await expect(run(pick(tests, STABLE_CASE))).rejects.toThrow(/buttonClassNames\.root/);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/test-utils.test.tsx -t "getStableClassNames|stable classes"`
Expected: FAIL — `getStableClassNames is not a function` / `DISPLAY_NAME_ALIASES` undefined (not exported yet), and no registered test matches `carries its stable classes…`.

- [ ] **Step 3: Implement the lookup and the case**

In `src/test-utils.ts`:

1. Add after `import { describeElement } from './test-setup';`:

```ts
import * as registry from './lib/classNames';
```

2. Before the `// Internals` section (`:385`), add:

```ts
// ---------------------------------------------------------------------------
// Stable class names (Fluent parity phase 3, P3-00)
// ---------------------------------------------------------------------------

/** The class-name registry (`src/lib/classNames.ts`) as a table: constant name → classes by key. */
const CLASS_NAME_REGISTRY = registry as unknown as Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

/**
 * Display names that differ from their flat export names (Appendix A of the phase 3 spec), mapped
 * to the constant of the component they name. Every other public component's constant is its
 * camel-cased display name plus `ClassNames`.
 */
export const DISPLAY_NAME_ALIASES: Readonly<Record<string, string>> = {
  RadioItem: 'radioGroupItemClassNames',
  Step: 'stepperStepClassNames',
  Tab: 'tabListTabClassNames',
  TabPanel: 'tabListPanelClassNames',
  TabPanels: 'tabListPanelsClassNames',
  TableHead: 'tableHeaderClassNames',
  TableHeadCell: 'tableHeaderCellClassNames',
};

/**
 * Variants (spec D5): a variant's root also carries the roots of these constants, base first (the
 * roots of Appendix A's "Also carries" column).
 */
export const VARIANT_BASES: Readonly<Record<string, readonly string[]>> = {
  compoundButtonClassNames: ['buttonClassNames'],
  toggleButtonClassNames: ['buttonClassNames'],
  menuButtonClassNames: ['buttonClassNames'],
  toolbarButtonClassNames: ['buttonClassNames'],
  toolbarToggleButtonClassNames: ['buttonClassNames', 'toggleButtonClassNames'],
  toolbarRadioButtonClassNames: ['buttonClassNames', 'toggleButtonClassNames'],
  counterBadgeClassNames: ['badgeClassNames'],
  colorPickerSwatchesClassNames: ['swatchPickerClassNames'],
  menuItemCheckboxClassNames: ['menuItemClassNames'],
  menuItemRadioClassNames: ['menuItemClassNames'],
  menuItemSwitchClassNames: ['menuItemClassNames'],
  menuItemLinkClassNames: ['menuItemClassNames'],
};

/** A component's stable class names, from {@link getStableClassNames}. */
export interface StableClassNames {
  /** The registry constant, e.g. `'toggleButtonClassNames'`. */
  constant: string;
  /** Its root class, e.g. `'wave-toggle-button'`. */
  root: string;
  /** Every root class the element that receives `className` carries, base first. */
  carries: readonly string[];
}

/**
 * The stable class names (`src/lib/classNames.ts`) of the component with `displayName`: its
 * constant (the camel-cased display name plus `ClassNames`, or the entry of
 * {@link DISPLAY_NAME_ALIASES}), its root class and `carries`, every root class the element that
 * receives `className` must carry (the roots of the component's {@link VARIANT_BASES}, then its
 * own). `undefined` for a display name no constant names (internal components, contexts). Used by
 * {@link testClassName}, the conventions gate's `class-names` rule and
 * `src/__tests__/classNames.test.ts`.
 */
export function getStableClassNames(displayName: string): StableClassNames | undefined {
  if (!displayName) return undefined;
  const constant =
    DISPLAY_NAME_ALIASES[displayName] ??
    `${displayName[0].toLowerCase()}${displayName.slice(1)}ClassNames`;
  if (!Object.hasOwn(CLASS_NAME_REGISTRY, constant)) return undefined;
  const { root } = CLASS_NAME_REGISTRY[constant];
  const bases = VARIANT_BASES[constant] ?? [];
  return {
    constant,
    root,
    carries: [...bases.map((base) => CLASS_NAME_REGISTRY[base].root), root],
  };
}

/** The name of the stable-class case of {@link testClassName}. */
const STABLE_CLASSES_CASE = 'carries its stable classes on the element that receives className';
```

3. In `testClassName`, extend the JSDoc list (after the `conflictingClass` bullet):

```ts
 * - `carries its stable classes on the element that receives className` (only for a component
 *   whose `displayName` names a constant of `src/lib/classNames.ts`, see
 *   {@link getStableClassNames}): with the consumer class, the element that received it (found in
 *   `document.body`, so a portaled or wrapped root counts, and no `data-testid` is read) carries
 *   every class of `carries`: a variant's base roots and its own.
```

and add, at the end of the function body (after the `if (conflicting) { … }` block):

```ts
  const displayName = displayNameOf(Component);
  const stable = typeof displayName === 'string' ? getStableClassNames(displayName) : undefined;
  if (stable) {
    it(STABLE_CLASSES_CASE, () => {
      renderComponent(Component, { ...props, className: customClass }, options);
      const target = document.body.querySelector(`.${customClass}`);
      expect(target, `no element received className "${customClass}"`).not.toBeNull();
      const missing = stable.carries.filter((cls) => !target?.classList.contains(cls));
      expect(
        missing,
        `stable classes missing where className lands: apply ${stable.constant}.root first in that element's cn() (src/lib/classNames.ts), and a variant also its base constants' roots`,
      ).toEqual([]);
    });
  }
```

(`displayNameOf` is the function declaration further down in the same file, so it is hoisted.)

4. In the header's "## Other helpers" list, add:

```ts
 * - {@link getStableClassNames}: a component's stable class names by its `displayName` (the
 *   registry lookup of {@link testClassName}, the conventions gate's `class-names` rule and
 *   `src/__tests__/classNames.test.ts`), with {@link DISPLAY_NAME_ALIASES} and
 *   {@link VARIANT_BASES}.
```

- [ ] **Step 4: Run the helper tests**

Run: `npx vitest run src/__tests__/test-utils.test.tsx`
Expected: PASS, including the existing cases (the `Chip` fixture test still lists its eight names: `Chip` names no constant, so no case is added).

- [ ] **Step 5: Run the whole suite: every component now runs the case**

Run: `npm test`
Expected: PASS. Tasks A4–A12 applied every root, so every `testSystemProps` call passes the new case. If a component fails it, the message names its constant and the missing classes: apply the missing root (or, for a variant, the base constant's root) first in the `cn()` of the element that receives `className`, in that component's module, as Appendix A says, and add the assertion to its folder's `stableClassNames.test.tsx`; re-run that component's test file. Change a `testSystemProps` configuration only where spec §6.4 says so; never weaken the case.

- [ ] **Step 6: Quick checks**

Run:
```bash
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/test-utils.ts src/__tests__/test-utils.test.tsx --max-warnings 0
npx vitest run src/__tests__/test-utils.test.tsx --reporter=default
```
Expected: no errors; the default reporter shows no act() warning and no unasserted `[WaveUI]` line.

- [ ] **Step 7: Commit**

```bash
git add src/test-utils.ts src/__tests__/test-utils.test.tsx
git commit -m "test(test-utils): testSystemProps checks the stable root classes"
```

---

### Task A14: The conventions rule `class-names`

**Files:**
- Modify: `src/__tests__/conventions.test.ts` (header rule list at `:7-49` and its last paragraph at `:76-77`; `RuleId` at `:82-93`; `HINTS` at `:102-121`; helpers before `scanSource` at `:897`; the rule inside `scanSource` after the `forwardRef` block at `:1023-1027`; a new fixture `describe` before `describe('motion', …)` at `:1523`)

**Interfaces:**
- Consumes: `getStableClassNames` (Task A13).
- Produces: the rule id `'class-names'`: for a component source, every `X.displayName = '<Name>'` in code whose name maps to a constant requires `<constant>.root` in the file's code (not in a comment or a string).

- [ ] **Step 1: Write the failing fixture tests**

In `src/__tests__/conventions.test.ts`, add a `describe` inside `describe('conventions gate rules', …)`, before `describe('motion', …)`:

```ts
  describe('class-names', () => {
    it('requires the stable root class of a registered displayName (C-CLASS)', () => {
      const without = [
        `export const Button = ({ className, ...rest }: Props) => (`,
        `  <button type="button" className={cn('px-3', className)} {...rest} />`,
        `);`,
        `Button.displayName = 'Button';`,
      ].join('\n');
      expect(rules(without)).toEqual([
        "4:class-names:Button.displayName = 'Button' → buttonClassNames.root",
      ]);

      const withRoot = [
        `import { buttonClassNames } from '../../lib/classNames';`,
        `export const Button = ({ className, ...rest }: Props) => (`,
        `  <button type="button" className={cn(buttonClassNames.root, 'px-3', className)} {...rest} />`,
        `);`,
        `Button.displayName = 'Button';`,
      ].join('\n');
      expect(rules(withRoot)).toEqual([]);
    });

    it('counts the constant in code only, not in a comment or a string', () => {
      const source = [
        `// buttonClassNames.root is applied by the parent`,
        `const note = 'buttonClassNames.root';`,
        `export const Button = (props: Props) => <button type="button" {...props} />;`,
        `Button.displayName = "Button";`,
      ].join('\n');
      expect(rules(source)).toEqual([
        "4:class-names:Button.displayName = 'Button' → buttonClassNames.root",
      ]);
    });

    it('skips display names that no constant names, and displayName text inside strings', () => {
      const source = [
        `const MenuItemRow = () => null;`,
        `MenuItemRow.displayName = 'MenuItemRow';`,
        `const ToasterContext = React.createContext(null);`,
        `ToasterContext.displayName = 'ToasterContext';`,
        `const label = 'X.displayName = "Button"';`,
        `if (Other.displayName === 'Button') log();`,
      ].join('\n');
      expect(rules(source)).toEqual([]);
    });

    it('looks up a displayName that differs from its flat name through the alias table', () => {
      const source = [
        `export function RadioItem(props: Props) {`,
        `  return <label className={cn('flex', props.className)} />;`,
        `}`,
        `RadioItem.displayName = 'RadioItem';`,
      ].join('\n');
      expect(rules(source)).toEqual([
        "4:class-names:RadioItem.displayName = 'RadioItem' → radioGroupItemClassNames.root",
      ]);
      expect(rules(source.replace(`cn('flex'`, `cn(radioGroupItemClassNames.root, 'flex'`))).toEqual(
        [],
      );
    });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/conventions.test.ts -t "class-names"`
Expected: FAIL — the first, second and fourth cases get `[]` instead of the `class-names` finding (the rule does not exist); the third passes.

- [ ] **Step 3: Implement the rule**

In `src/__tests__/conventions.test.ts`:

1. At the top of the file, after the header docblock, add:

```ts
import { getStableClassNames } from '../test-utils';
```

2. In the header's rule list, after the `motion` bullet and before the `lexer` bullet, add:

```ts
 * - `class-names` (C-CLASS, stable class names): a module that assigns the `displayName` of a
 *   component the class-name registry knows (`X.displayName = 'Button'`, looked up with
 *   `getStableClassNames` from `src/test-utils.ts`, which also knows the display names that
 *   differ from their flat names) reads that constant's root in code (`buttonClassNames.root`;
 *   a mention in a comment or a string does not count). Internal display names (`MenuItemRow`,
 *   contexts) are skipped.
```

and extend the last header paragraph ("Sources are read with …") with: `The \`class-names\` rule imports the registry lookup from \`src/test-utils.ts\`.`

3. Add `| 'class-names'` to the `RuleId` union (before `| 'lexer'`) and this entry to `HINTS` (before `lexer:`):

```ts
  'class-names':
    "apply `<name>ClassNames.root` first in the root element's `cn()`, from `src/lib/classNames.ts` (C-CLASS, stable class names)",
```

4. Before `function scanSource(`, add:

```ts
/** `X.displayName =` in code (the lexer's bare text, where comments and strings are blank). */
const DISPLAY_NAME_ASSIGNMENT = /\b([A-Za-z_$][\w$]*)\.displayName\s*=(?!=)/g;

/**
 * The text of the string literal that starts at the first non-blank offset from `from` in `code`
 * (the lexer's code text, where strings are kept), or `null` when none starts there (a
 * displayName assigned from a variable).
 */
function stringLiteralAt(code: string, from: number): string | null {
  let k = from;
  while (k < code.length && /\s/.test(code[k])) k += 1;
  const quote = code[k];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;
  const close = code.indexOf(quote, k + 1);
  return close === -1 ? null : code.slice(k + 1, close);
}

/** Whether code (the bare text: no comments, no string contents) reads `<constant>.root`. */
function readsRoot(bare: string, constant: string): boolean {
  return new RegExp(`(?<![\\w$])${constant}\\s*\\.\\s*root(?![\\w$])`).test(bare);
}
```

5. In `scanSource`, after the `// forwardRef (code only)` block, add:

```ts
  // class-names: a module that assigns the displayName of a registered component reads that
  // constant's root in code (C-CLASS, stable class names)
  for (const m of lexed.bareText.matchAll(DISPLAY_NAME_ASSIGNMENT)) {
    const offset = m.index ?? 0;
    const displayName = stringLiteralAt(lexed.codeText, offset + m[0].length);
    if (displayName === null) continue;
    const stable = getStableClassNames(displayName);
    if (!stable || readsRoot(lexed.bareText, stable.constant)) continue;
    const line = lineOf(lexed, offset);
    add(
      line,
      offset - lexed.lineStarts[line - 1],
      'class-names',
      `${m[1]}.displayName = '${displayName}' → ${stable.constant}.root`,
    );
  }
```

(The lexer blanks string literals, quotes included, in `bareText`, and keeps them in `codeText` at the same offsets, which is why the name is read from `codeText`.)

- [ ] **Step 4: Run the fixtures and the whole gate**

Run: `npx vitest run src/__tests__/conventions.test.ts -t "class-names"`
Expected: PASS.

Run: `npx vitest run src/__tests__/conventions.test.ts`
Expected: PASS: every component module that assigns a registered `displayName` already reads its constant's root (Tasks A4–A12). A failing file names its line; apply the root there per Appendix A (classes only).

- [ ] **Step 5: Quick checks**

Run:
```bash
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/__tests__/conventions.test.ts --max-warnings 0
```
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/conventions.test.ts
git commit -m "test(conventions): class-names rule for the stable root classes"
```

---

### Task A15: Registry completeness and the applied check

**Files:**
- Modify: `src/__tests__/classNames.test.ts` (imports; new sections at the end)

**Interfaces:**
- Consumes: the registry (Task A1), `getStableClassNames` (Task A13), the classes applied by Tasks A4–A12.
- Produces: `NO_ELEMENT: readonly string[]` and `PENDING_CLASS_NAMES: readonly string[]` in `src/__tests__/classNames.test.ts` (entries `'<constant>'` or `'<constant>.<key>'`). Task I1 empties `PENDING_CLASS_NAMES` to `[]` once wave B has landed; `NO_ELEMENT` keeps `'ToastClose'`, which the check ignores until INTEGRATION exports it.

- [ ] **Step 1: Write the checks, with both lists still empty**

In `src/__tests__/classNames.test.ts`, add `import { getStableClassNames } from '../test-utils';` to the imports, and append:

```ts
// ---------------------------------------------------------------------------
// Completeness and the applied check (spec §1.4.3)
// ---------------------------------------------------------------------------

/**
 * Public components that render no element of their own (spec D3), so they have no constant. An
 * entry the package entry does not export yet (`ToastClose` before INTEGRATION) is ignored.
 */
const NO_ELEMENT: readonly string[] = [];

/**
 * The Phase 3 constants (`'<constant>'`: every key) and keys (`'<constant>.<key>'`) that the
 * wave-B packages apply (spec §0.2 rule 24): the applied check and the component check skip them
 * whether or not their package has landed. INTEGRATION (wave C) empties the list; a later phase
 * fills it the same way.
 */
const PENDING_CLASS_NAMES: readonly string[] = [];

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
      .filter(([flat, value]) => constantOf(flat, value) === undefined && !NO_ELEMENT.includes(flat))
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
        (name) =>
          !components.has(`${name[0].toUpperCase()}${name.slice(1, -'ClassNames'.length)}`),
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
```

- [ ] **Step 2: Run them to see the expected failures**

Run: `npx vitest run src/__tests__/classNames.test.ts`
Expected: FAIL in three tests, each with exactly these lists:
- completeness: `['Dialog', 'DialogClose', 'DialogTrigger', 'DrawerClose', 'DrawerTrigger', 'MenuTrigger', 'Popover', 'PopoverTrigger', 'Presence']`;
- "names every constant after a public component": the twelve Phase 3 constants (`alphaSliderClassNames`, `colorAreaClassNames`, `colorPickerHexFieldClassNames`, `colorPickerPreviewClassNames`, `colorPickerSwatchesClassNames`, `colorSliderClassNames`, `messageBarActionsClassNames`, `messageBarTitleClassNames`, `toastBodyClassNames`, `toastFooterClassNames`, `toastTitleClassNames`, `treeItemPersonaLayoutClassNames`);
- applied: every key of those twelve constants plus `toasterClassNames.toast`, `treeItemClassNames.actions`, `treeItemClassNames.aside`, `treeItemClassNames.iconAfter` and `treeItemClassNames.indicator`.

Any other name in these lists is a gap of Tasks A4–A12 (a missing class) or of Task A1 (a mistyped constant): fix it in its module per Appendix A (and add the assertion to the folder's `stableClassNames.test.tsx`), not by adding it to a list.

- [ ] **Step 3: Fill the two lists**

Replace the two empty lists with:

```ts
const NO_ELEMENT: readonly string[] = [
  'Dialog', // a context provider: Dialog.Content renders the surface
  'DialogClose', // clones its child (asChild={false} renders a wrapper span that takes className)
  'DialogTrigger', // clones its child
  'DrawerClose', // clones its child
  'DrawerTrigger', // clones its child
  'MenuTrigger', // clones its child
  'Popover', // a context provider: Popover.Content renders the surface
  'PopoverTrigger', // clones its child
  'Presence', // clones its child
  'ToastClose', // clones its child (phase 3; exported by INTEGRATION)
];
```

```ts
const PENDING_CLASS_NAMES: readonly string[] = [
  'alphaSliderClassNames',
  'colorAreaClassNames',
  'colorPickerHexFieldClassNames',
  'colorPickerPreviewClassNames',
  'colorPickerSwatchesClassNames',
  'colorSliderClassNames',
  'messageBarActionsClassNames',
  'messageBarTitleClassNames',
  'toastBodyClassNames',
  'toastFooterClassNames',
  'toastTitleClassNames',
  'toasterClassNames.toast',
  'treeItemClassNames.actions',
  'treeItemClassNames.aside',
  'treeItemClassNames.iconAfter',
  'treeItemClassNames.indicator',
  'treeItemPersonaLayoutClassNames',
];
```

- [ ] **Step 4: Run the registry test again**

Run: `npx vitest run src/__tests__/classNames.test.ts`
Expected: PASS (every test).

- [ ] **Step 5: Quick checks**

Run:
```bash
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/__tests__/classNames.test.ts --max-warnings 0
```
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/classNames.test.ts
git commit -m "test(registry): class-name completeness and applied check with the phase 3 pending list"
```

---

### Task A16: `verify-dist` checks the registry; the flat-name bridge for Phase 3

**Files:**
- Modify: `scripts/verify-dist.mjs` (header at `:5-47`; imports at `:51-68`; `PENDING_FLAT_EXPORTS` at `:74-88`; after `PRESENCE_BUDGET` at `:98-103`; `REQUIRED_DECLARATIONS` at `:308-316`; `serverProbeSource` at `:665-715`; `checkServerImport`'s JSDoc at `:739-750`; a new `checkClassNameExports` after `checkCjsParity` at `:924-935`; `probeTreeShaking` at `:1019-1087`; `verifyDist` at `:1148-1233`)
- Test: `scripts/__tests__/verify-dist.test.mjs` (the import list at `:27-53`; `DTS` at `:65-72`; `goodFiles()` at `:82-201`; the declaration cases at `:388-419`; the single-module case at `:934-951`; the bridge case at `:1082-1094`; new cases)
- Modify: `src/__tests__/integration.test.tsx` (the `public barrel` describe at `:142-167`: the `PENDING_FLAT_MEMBERS` bridge, Step 6)

**Interfaces:**
- Consumes: the registry exported from the entry (Task A1) and the classes applied by Tasks A4–A12 (for the real `npm run build`).
- Produces: `export async function checkClassNameExports(dist: string): Promise<string[]>`; `probeTreeShaking(dist, { keep, drop, dropModules, keepStrings, dropStrings })` (the last two default to `[]`); `REQUIRED_DECLARATIONS` gains `'buttonClassNames'`; `PENDING_FLAT_EXPORTS = ['ColorPicker', 'MessageBar', 'Toast']`; `PENDING_FLAT_MEMBERS` (the ten new flat member names) in `src/__tests__/integration.test.tsx`. Task R8 adds `'Tree'` to `PENDING_FLAT_EXPORTS` in its sorted place; INTEGRATION (wave C) empties both lists and adds the wave-C probes (`dropModules` of the color modules, `probeIncludes` for `Toaster`, the handle's module under react-server).

- [ ] **Step 1: Give the fixture dist a registry, and write the failing tests**

In `scripts/__tests__/verify-dist.test.mjs`:

1. Add `checkClassNameExports` to the import list from `'../verify-dist.mjs'`.

2. Replace the `DTS` constant and its comment with:

```js
/**
 * The fixture's rolled-up declarations: every name on REQUIRED_DECLARATIONS (a utility, a
 * documented component, a props type, a documented compound, a hook and a class-name constant),
 * and the empty export list that ends every roll-up.
 */
const DTS =
  'export declare function cn(...inputs: unknown[]): string;\n' +
  '/** A button. */\nexport declare const Button: (props: object) => null;\n' +
  'export declare type ButtonProps = { disabled?: boolean };\n' +
  '/** A menu. */\nexport declare const Menu: (props: object) => null;\n' +
  'export declare function usePresence(visible: boolean): { isMounted: boolean };\n' +
  "export declare const buttonClassNames: { readonly root: 'wave-button'; readonly icon: 'wave-button__icon' };\n" +
  '\nexport { }\n';
```

3. In `goodFiles()`, give the `component` helper a third parameter, the registry constant it applies:

```js
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
```

(so Button's ESM module reads `…import { buttonClassNames } from '../../lib/classNames.mjs';\nfunction ButtonRoot(props) { return cn(buttonClassNames.root, 'button', props && props.className); }…`; Card and Dialog are unchanged).

4. In the object `goodFiles()` returns, add after `'dist/lib/cn.cjs'`:

```js
    'dist/lib/classNames.mjs':
      "export const buttonClassNames = { root: 'wave-button', icon: 'wave-button__icon' };\n" +
      "export const dialogContentClassNames = { root: 'wave-dialog-content', body: 'wave-dialog-content__body' };\n",
    'dist/lib/classNames.cjs':
      "exports.buttonClassNames = { root: 'wave-button', icon: 'wave-button__icon' };\n" +
      "exports.dialogContentClassNames = { root: 'wave-dialog-content', body: 'wave-dialog-content__body' };\n",
```

and extend the two entries with three insertions (every other line stays as it is):

- in `'dist/index.mjs'`, right after the line `"export { cn } from './lib/cn.mjs';\n" +`, insert
  ```js
      "export { buttonClassNames, dialogContentClassNames } from './lib/classNames.mjs';\n" +
  ```
- in `'dist/index.cjs'`, right after the line `"const cn = require('./lib/cn.cjs');\n" +`, insert
  ```js
      "const classNames = require('./lib/classNames.cjs');\n" +
  ```
- in `'dist/index.cjs'`, right after the line `'exports.cn = cn.cn;\nexports.useThing = hook.useThing;\nexports.Button = button.Button;\n' +`, insert
  ```js
      'exports.buttonClassNames = classNames.buttonClassNames;\n' +
      'exports.dialogContentClassNames = classNames.dialogContentClassNames;\n' +
  ```

5. Update the two cases that pin the complete list of required names:
   - "reports an empty roll-up (only `export { }`) in both files": both expected strings read `…does not declare and export cn, Button, ButtonProps, Menu, usePresence, buttonClassNames (an empty or partial roll-up: …)`.
   - "checks index.d.cts on its own": the regex becomes `/^index\.d\.cts does not declare and export cn, Button, ButtonProps, Menu, usePresence, buttonClassNames \(/`.

6. In "reports a single-module bundle", strip every import line and include the registry module:

```js
    const single =
      files['dist/lib/cn.mjs'] +
      files['dist/lib/classNames.mjs'] +
      files['dist/components/button/Button.mjs']
        .replace(DIRECTIVE, '')
        .replace(/^import .*\n/gm, '') +
      files['dist/components/overlays/Dialog.mjs']
        .replace(DIRECTIVE, '')
        .replace(/^import .*\n/gm, '');
```

7. Replace the bridge case (`describe('the flat-name bridge (PENDING_FLAT_EXPORTS)', …)`) with:

```js
describe('the flat-name bridge (PENDING_FLAT_EXPORTS)', () => {
  it('lists only exported components that are no compounds yet or still lack flat names (the real exports)', async () => {
    const mod = await import('../../src/index.ts');
    expect(Object.keys(mod.Toolbar).filter((key) => /^[A-Z]/.test(key))).not.toEqual([]);
    const result = checkFlatExports(mod);
    expect(result.errors).toEqual([]);
    for (const name of PENDING_FLAT_EXPORTS) {
      const pendingMember = result.pending.some(
        (flat) => flat.startsWith(name) && /^[A-Z]/.test(flat.slice(name.length)),
      );
      expect(result.planned.includes(name) || pendingMember, `${name} is neither planned nor pending`).toBe(
        true,
      );
    }
    const final = checkFlatExports(mod, { final: true });
    if (PENDING_FLAT_EXPORTS.length === 0) {
      expect(final).toEqual({ errors: [], pending: [], planned: [] });
    } else {
      expect(final.errors).toEqual(
        expect.arrayContaining([expect.stringMatching(/PENDING_FLAT_EXPORTS .*still lists/)]),
      );
    }
  }, 60_000);
});
```

8. Add the new cases:

```js
describe('the class-name registry (P3-00)', () => {
  it('requires the class-name constants in the roll-up (buttonClassNames)', () => {
    expect(REQUIRED_DECLARATIONS).toContain('buttonClassNames');
    const dts = DTS.replace(/^export declare const buttonClassNames.*\n/m, '');
    expect(checkDeclarations(fixture({ 'dist/index.d.ts': dts, 'dist/index.d.cts': dts }).dist)).toEqual([
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
        .replace('cn(buttonClassNames.root, ', 'cn(buttonClassNames.root, dialogContentClassNames.root, '),
    });
    expect(await probeTreeShaking(dist, strings)).toEqual([
      'the bundle of an import of only Button contains the string "wave-dialog-content" (an unused class-name constant was not tree-shaken)',
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
```

and, inside `describe('verifyDist and main', …)`:

```js
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
```

- [ ] **Step 2: Run the script tests to see them fail**

Run: `npx vitest run scripts/__tests__/verify-dist.test.mjs`
Expected: FAIL — the import of `checkClassNameExports` fails (`does not provide an export named 'checkClassNameExports'`), so the file does not load; once Step 3 adds the export, the new cases are the ones that fail until the checks exist.

- [ ] **Step 3: Implement the checks**

In `scripts/verify-dist.mjs`:

1. Header list: replace the `declarations` bullet's "each declares and exports the public names on {@link REQUIRED_DECLARATIONS}" with "each declares and exports the public names on {@link REQUIRED_DECLARATIONS} (a class-name constant among them)", add this bullet after the `react-server` bullet:

```js
 *   - class names (P3-00): every export of `dist/lib/classNames.*` (the stable class-name
 *     registry) is exported by `dist/index.*` with the same value, in both formats
 *     ({@link checkClassNameExports}); under the react-server condition `dist/index.*` exports
 *     `buttonClassNames` as a plain object whose root is `wave-button`, and every export of
 *     `dist/lib/classNames.*` is an object of strings;
```

and extend the `tree-shaking` bullet with: "The bundle also keeps Button's class string `'wave-button'` and drops the Dialog surface's `'wave-dialog-content'` (the registry is tree-shaken per constant; a listed string that occurs in no module of dist is an error);".

2. After `import { gzipSync } from 'node:zlib';` add:

```js
import { isDeepStrictEqual } from 'node:util';
```

3. Replace the `PENDING_FLAT_EXPORTS` JSDoc's first sentences and its value:

```js
/**
 * A temporary bridge: components whose flat sub-component names (`<Parent><Member>`,
 * C-COMPOUND) are not exported from `dist/index.mjs` yet. Fluent parity phase 3 (0.8) lists
 * `ColorPicker`, `MessageBar` and `Toast`, which its wave-B packages turn into compounds
 * (`ColorPicker.HexField`, `MessageBar.Actions`, `Toast.Title`, …) before INTEGRATION exports
 * their flat names from the barrels; `Tree` joins the list, in its sorted place, in the commit
 * that attaches `Tree.ItemPersonaLayout` (Tree is already a complete compound, which the list may
 * not hold before then). INTEGRATION empties the list again, as phase 2 did for `Toolbar`. The
 * rules:
 *   - an entry whose flat names all exist fails the check ("remove it"), and so does an entry
 *     that is not an exported component, so the list only shrinks;
 *   - an entry that is exported but not a compound yet is tolerated;
 *   - `--final` (`prepublishOnly`, the final gate) ignores the list and fails while it is not
 *     empty, so no release ships with the bridge open.
 * A compound that is not listed must export every flat name. A flat name that is exported must
 * equal its dotted member, listed or not.
 */
export const PENDING_FLAT_EXPORTS = ['ColorPicker', 'MessageBar', 'Toast'];
```

4. After `PRESENCE_BUDGET`, add:

```js
/**
 * The class-name strings of the Button-only probe (P3-00): the bundle keeps Button's root class
 * and drops the Dialog surface's, so the registry (`lib/classNames`) is tree-shaken per constant.
 */
const BUTTON_ONLY_STRINGS = { keepStrings: ['wave-button'], dropStrings: ['wave-dialog-content'] };
```

5. Replace `REQUIRED_DECLARATIONS` and its JSDoc:

```js
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
  'buttonClassNames',
];
```

6. Replace the JSDoc of `serverProbeSource` with

```js
/**
 * The script run under `node --conditions=react-server` that loads each of `files` (paths
 * relative to `dir`) and prints `{ [path]: { phase, message } }` for the failures: `load` when
 * the module does not evaluate, `check` when it loads but `lib/cn.*` does not work, `index.*`
 * does not export the server-side `cn` and a plain `buttonClassNames`, or `lib/classNames.*`
 * exports anything but objects of strings.
 */
```

and replace the generated `check` function with:

```js
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
};
```

(this code is inside the template literal the function returns: keep its `\\/` escapes and use no backtick or `${` in it).

7. In `checkServerImport`'s JSDoc, replace the last sentence ("… a `lib/cn.*` that does not work; an `index.*` whose `cn` is missing or a client reference.") with

```js
 * modules that fail because they import it; a `lib/cn.*` that does not work; an `index.*` whose
 * `cn` is missing or a client reference, or whose `buttonClassNames` is no plain object with the
 * root `wave-button`; a `lib/classNames.*` export that is not an object of strings.
```

8. After `checkCjsParity`, add:

```js
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
        errors.push(`${entryPath} does not export ${name} (a class-name constant of ${registryPath})`);
      } else if (!isDeepStrictEqual(entry[name], registry[name])) {
        errors.push(`${entryPath} exports ${name} with another value than ${registryPath}`);
      }
    }
  }
  return errors;
}
```

9. Before `probeTreeShaking`, add:

```js
/** A string literal `text` in any quotes: `'…'`, `"…"` or a template literal without substitutions. */
function quotedLiteral(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(["'\`])${escaped}\\1`);
}
```

10. In `probeTreeShaking`: replace the first paragraph of its JSDoc with

```js
/**
 * Tree-shaking probe (repo-level#3): bundles an entry that imports only `keep` from
 * `dist/index.mjs` with Vite's `build()` API (no write, no minification, bare imports external)
 * and asserts that the bundle holds `keep`'s module, only it and its static imports, no code of
 * `drop` (its module or its `displayName`) and none of `dropModules` (dist-relative module paths,
 * such as `hooks/usePresence.mjs`; a listed module that does not exist in `dist` is an error, since
 * the probe would pass vacuously). `keepStrings` and `dropStrings` (the stable class names, P3-00)
 * are string literals, matched with their quotes, that the bundle must, or must not, contain; a
 * listed string that occurs in no JavaScript module of `dist` is an error for the same reason.
 *
```

(the second paragraph, about real paths, stays); change the options to `{ keep = 'Button', drop = 'Dialog', dropModules = [], keepStrings = [], dropStrings = [] } = {}`; after the `for (const path of dropModules)` existence loop add:

```js
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
```

and before `return errors;` at the end of the function add:

```js
  for (const text of keepStrings) {
    if (foundStrings.has(text) && !quotedLiteral(text).test(code)) {
      errors.push(`the bundle of an import of only ${keep} lacks the string "${text}"`);
    }
  }
  for (const text of dropStrings) {
    if (foundStrings.has(text) && quotedLiteral(text).test(code)) {
      errors.push(
        `the bundle of an import of only ${keep} contains the string "${text}" (an unused class-name constant was not tree-shaken)`,
      );
    }
  }
```

11. In `verifyDist`: replace `errors.push(...(await probeTreeShaking(distRoot)));` with

```js
    errors.push(
      ...(await probeTreeShaking(distRoot, { keep: 'Button', drop: 'Dialog', ...BUTTON_ONLY_STRINGS })),
    );
```

and after the `try { const mod = … } catch { … }` block of the flat exports add:

```js
  try {
    errors.push(...(await checkClassNameExports(distRoot)));
  } catch (error) {
    errors.push(`class-name export check failed: ${error.message}`);
  }
```

- [ ] **Step 4: Run the script tests again**

Run: `npx vitest run scripts/__tests__/verify-dist.test.mjs`
Expected: PASS (every case; the bridge case reports `ColorPicker`, `MessageBar` and `Toast` as planned: exported, not compounds yet).

- [ ] **Step 5: Run the real build**

Run: `npm run build`
Expected: exit 0, ending with `verify-dist: PENDING_FLAT_EXPORTS bridge open (C-COMPOUND; not compounds yet: ColorPicker, MessageBar, Toast). …` and `verify-dist: dist OK`. The Button-only bundle keeps `'wave-button'` and drops `'wave-dialog-content'`, the constants load under react-server and the entry exports every constant. If the probe reports that the Button bundle contains `"wave-dialog-content"`, the bundler kept unused registry constants: stop and report it to the lead (the registry design depends on it); do not weaken the probe.

- [ ] **Step 6: Bridge the barrel test of `integration.test.tsx` the same way**

Why: `src/__tests__/integration.test.tsx` › `public barrel` › "exports every sub-component of a compound under its flat name, equal to the dotted member" walks the entry's compounds. As soon as a wave-B package attaches `Toast.Title` (or another new member) to a compound the entry already exports, the test finds `ToastTitle` missing from the barrel, which only INTEGRATION extends: without a bridge, spec §0.2 rule 24 ("nothing else may go red between wave B and wave C") breaks. This fourth pending list is a plan addition to rule 24 (a spec §10 note); INTEGRATION empties it in Task I1.

In `src/__tests__/integration.test.tsx`, directly above `describe('public barrel (spec §5.11, C-COMPOUND)', () => {`, add:

```tsx
/**
 * Flat names of compound members that a wave-B package attaches before INTEGRATION exports them
 * from the barrels (Phase 3 spec §0.2 rules 21 and 24): the barrel test's twin of
 * `PENDING_FLAT_EXPORTS` in `scripts/verify-dist.mjs`. Keep it sorted; Task I1 empties it.
 */
const PENDING_FLAT_MEMBERS: readonly string[] = [
  'ColorPickerHexField',
  'ColorPickerPreview',
  'ColorPickerSwatches',
  'MessageBarActions',
  'MessageBarTitle',
  'ToastBody',
  'ToastClose',
  'ToastFooter',
  'ToastTitle',
  'TreeItemPersonaLayout',
];
```

In the test "exports every sub-component of a compound under its flat name, equal to the dotted member", replace:

```tsx
        if (!(flat in barrel)) missing.push(flat);
        else if (barrel[flat] !== (value as Record<string, unknown>)[member]) different.push(flat);
```

with:

```tsx
        if (!(flat in barrel)) {
          if (!PENDING_FLAT_MEMBERS.includes(flat)) missing.push(flat);
        } else if (barrel[flat] !== (value as Record<string, unknown>)[member]) {
          different.push(flat);
        }
```

and add this test after it, inside the same `describe`:

```tsx
  it('lists on PENDING_FLAT_MEMBERS only flat names the barrel does not export yet', () => {
    expect(PENDING_FLAT_MEMBERS).toEqual([...new Set(PENDING_FLAT_MEMBERS)].sort());
    expect(PENDING_FLAT_MEMBERS.filter((flat) => flat in barrel)).toEqual([]);
  });
```

Run: `npx vitest run src/__tests__/integration.test.tsx -t "public barrel"`
Expected: PASS (in wave A no listed name exists yet; the second test goes red in wave C the moment a barrel exports a listed name, which is what makes Task I1 empty the list).

- [ ] **Step 7: Quick checks**

Run:
```bash
npx eslint scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs src/__tests__/integration.test.tsx --max-warnings 0
npm run format:check
npx tsc -p tsconfig.dev.json --noEmit
```
Expected: no errors, no warnings; formatting clean.

- [ ] **Step 8: Commit**

```bash
git add scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs src/__tests__/integration.test.tsx
git commit -m "chore(scripts): verify-dist checks the class-name registry; flat-name bridges for phase 3"
```

---

### Task A17: Wave A exit, report and the VoiceOver spike

**Files:**
- Modify: this file (append the "Wave A report" section)
- Create, outside the repository (a scratch folder such as `%TEMP%\wave-tree-spike\` or `~/wave-tree-spike/`): `tree-spike.html`, `spike-server.mjs` (throwaway; never committed)

**Interfaces:**
- Consumes: Tasks A1–A16.
- Produces: the "Wave A report" section at the end of this file, whose VoiceOver verdict Task R3 reads before it starts (it decides whether P3-06 adds `TreeLabels`, spec §8 Q18).

- [ ] **Step 1: Run the exit commands (spec §1.7)**

Run, in order, each from the worktree root:
```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
node scripts/verify-dist.mjs
node scripts/build-css.mjs --check-only
npm run build-storybook
```
Expected: every command exits 0; `npm run build` and `node scripts/verify-dist.mjs` print the open bridge (`not compounds yet: ColorPicker, MessageBar, Toast`) and `dist OK`; the conventions gate (part of `npm test`) reports no `class-names` finding.

- [ ] **Step 2: Check the output is clean**

Run:
```bash
npx vitest run --reporter=default > node_modules/.cache/wave-a-vitest.log 2>&1
grep -nE "not wrapped in act|\[WaveUI\]" node_modules/.cache/wave-a-vitest.log
```
Expected: `grep` prints nothing (exit 1): no act() warning and no unasserted `[WaveUI]` warning.

- [ ] **Step 3: Check which existing tests changed**

Run: `git diff --name-only "$(git merge-base HEAD main)" -- src stories scripts`
Expected: besides the new files and the modules the tasks name, the only existing tests changed are those of spec §6.4 (`Drawer.test.tsx`, `MenuButton.test.tsx`, `CompoundButton.test.tsx`, `ToggleButton.test.tsx`, `Toolbar.test.tsx`, `Toolbar.parts.test.tsx`, their exact-class lines only) and the ones these tasks own (`Button.slots.test.tsx`, `MessageBar.test.tsx`, `test-utils.test.tsx`, `conventions.test.ts`, `public-types.test.ts`, `verify-dist.test.mjs`). Explain any other in the report. No story changed.

- [ ] **Step 4: Build the VoiceOver spike page (lead; any time during wave A)**

In a scratch folder outside the repository, create `tree-spike.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Checkbox tree spike</title>
    <style>
      body { font: 16px/1.5 system-ui, sans-serif; margin: 16px; }
      ul { list-style: none; margin: 0; padding-inline-start: 0; }
      ul ul { padding-inline-start: 24px; }
      li > span { display: flex; align-items: center; gap: 8px; min-height: 44px; padding-inline: 8px; }
      [role='treeitem']:focus > span { outline: 2px solid #0f6cbd; outline-offset: -2px; }
      .box {
        inline-size: 16px; block-size: 16px; border: 1px solid currentColor; border-radius: 2px;
        display: inline-grid; place-items: center; font-size: 12px; line-height: 1;
      }
      [aria-checked='true'] > span > .box::after { content: '✓'; }
      [aria-checked='mixed'] > span > .box::after { content: '–'; }
      [aria-expanded='false'] > ul { display: none; }
    </style>
  </head>
  <body>
    <h1>Checkbox tree spike</h1>
    <p id="help">
      Arrow keys move, Right and Left open and close, Space checks, Enter activates. A click (a
      VoiceOver double tap) checks too.
    </p>
    <ul role="tree" aria-label="Files" aria-multiselectable="true" aria-describedby="help">
      <li role="treeitem" aria-expanded="true" aria-checked="mixed" tabindex="0">
        <span><span class="box" aria-hidden="true"></span>Documents</span>
        <ul role="group">
          <li role="treeitem" aria-checked="true" tabindex="-1">
            <span><span class="box" aria-hidden="true"></span>Report.docx</span>
          </li>
          <li role="treeitem" aria-checked="false" tabindex="-1">
            <span><span class="box" aria-hidden="true"></span>Budget.xlsx</span>
          </li>
        </ul>
      </li>
      <li role="treeitem" aria-expanded="true" aria-checked="true" tabindex="-1">
        <span><span class="box" aria-hidden="true"></span>Photos</span>
        <ul role="group">
          <li role="treeitem" aria-checked="true" tabindex="-1">
            <span><span class="box" aria-hidden="true"></span>Beach.jpg</span>
          </li>
          <li role="treeitem" aria-checked="true" tabindex="-1">
            <span><span class="box" aria-hidden="true"></span>Forest.jpg</span>
          </li>
        </ul>
      </li>
      <li role="treeitem" aria-checked="false" tabindex="-1">
        <span><span class="box" aria-hidden="true"></span>Notes.txt</span>
      </li>
    </ul>
    <p id="log" aria-live="polite"></p>
    <script>
      const tree = document.querySelector('[role="tree"]');
      const allItems = () => [...tree.querySelectorAll('[role="treeitem"]')];
      const visibleItems = () => allItems().filter((item) => item.offsetParent !== null);
      const childItems = (item) => [...(item.querySelector(':scope > ul')?.children ?? [])];
      const label = (item) => item.querySelector(':scope > span').textContent.trim();

      function focusItem(item) {
        for (const other of allItems()) other.tabIndex = -1;
        item.tabIndex = 0;
        item.focus();
      }

      function setChecked(item, checked) {
        item.setAttribute('aria-checked', String(checked));
        for (const child of childItems(item)) setChecked(child, checked);
      }

      /** Parents from the deepest up: checked when every child is, mixed when some are. */
      function recompute() {
        for (const parent of allItems().filter((item) => childItems(item).length > 0).reverse()) {
          const states = childItems(parent).map((child) => child.getAttribute('aria-checked'));
          const all = states.every((state) => state === 'true');
          const none = states.every((state) => state === 'false');
          parent.setAttribute('aria-checked', all ? 'true' : none ? 'false' : 'mixed');
        }
      }

      function toggle(item) {
        setChecked(item, item.getAttribute('aria-checked') !== 'true');
        recompute();
      }

      tree.addEventListener('keydown', (event) => {
        const item = event.target.closest('[role="treeitem"]');
        if (!item) return;
        const items = visibleItems();
        const index = items.indexOf(item);
        switch (event.key) {
          case 'ArrowDown':
            if (items[index + 1]) focusItem(items[index + 1]);
            break;
          case 'ArrowUp':
            if (items[index - 1]) focusItem(items[index - 1]);
            break;
          case 'ArrowRight':
            if (item.getAttribute('aria-expanded') === 'false') item.setAttribute('aria-expanded', 'true');
            else if (childItems(item)[0]) focusItem(childItems(item)[0]);
            break;
          case 'ArrowLeft': {
            if (item.getAttribute('aria-expanded') === 'true') {
              item.setAttribute('aria-expanded', 'false');
              break;
            }
            const parent = item.parentElement.closest('[role="treeitem"]');
            if (parent) focusItem(parent);
            break;
          }
          case ' ':
            toggle(item);
            break;
          case 'Enter':
            document.getElementById('log').textContent = `Activated ${label(item)}`;
            break;
          default:
            return;
        }
        event.preventDefault();
      });

      tree.addEventListener('click', (event) => {
        const item = event.target.closest('[role="treeitem"]');
        if (!item) return;
        event.stopPropagation();
        focusItem(item);
        toggle(item);
      });
    </script>
  </body>
</html>
```

and `spike-server.mjs`, to reach the page from the iPhone on the same network:

```js
// Serves tree-spike.html on port 8123 to the local network (throwaway spike server).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const page = readFileSync(new URL('./tree-spike.html', import.meta.url));
createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(page);
}).listen(8123, '0.0.0.0', () => {
  console.log('Open http://<this machine’s address>:8123/ on the iPhone (Ctrl+C stops).');
});
```

- [ ] **Step 5: Run the spike with VoiceOver**

1. **macOS, Safari, VoiceOver** (Cmd+F5): open `tree-spike.html` (File > Open File, or the server's address). Tab into the tree; move with the arrow keys and with VO+Right through all seven items. For each, write down exactly what VoiceOver says, in particular the state word for `aria-checked="true"` (Report.docx), `"false"` (Budget.xlsx) and `"mixed"` (Documents). Press Space on Documents (mixed → checked) and on Budget.xlsx, and write down whether VoiceOver announces the new state.
2. **iOS, Safari, VoiceOver** (Settings > Accessibility > VoiceOver): run `node spike-server.mjs` in the scratch folder and open the printed address on the iPhone. Swipe right through the seven items and write down what VoiceOver says for the same three states; double tap Documents and Budget.xlsx (a click checks) and write down whether the new state is announced.
3. Record the macOS, iOS and Safari versions.

Decision rule (spec §6.3, §8 Q18): VoiceOver **announces** the state when, on both macOS and iOS, it speaks a state word for each of the three states on the treeitem ("checked"/"not checked" or "unchecked", and "mixed" or an equivalent such as "partially checked"). Then Task R3 ships P3-06 without `TreeLabels`. If any of the three states is silent on either platform, VoiceOver **does not announce** it, and Task R3 adds `TreeLabels` (`checked`, `mixed`, `unchecked`) and the visually hidden state text each item's `aria-describedby` points at.

- [ ] **Step 6: Write the wave A report**

Append this section to the end of this file, filled in:

```markdown
## Wave A report

- Commit: `<git rev-parse --short HEAD>`, date.
- Exit commands (§1.7): typecheck, lint, format:check, test, build, verify-dist (bridge open: ColorPicker, MessageBar, Toast), build-css `--check-only`, build-storybook — each ✓ or the failure.
- Clean output: no act() warning, no unasserted `[WaveUI]` warning.
- Existing tests changed: <file:line — reason>, … (spec §6.4); any other: <why>.
- Registry change requests: none | <constant.key — reason — lead's decision>.
- Appendix A rows applied differently: none | <row — why>.
- VoiceOver spike: macOS <version>, Safari <version>: true "<spoken>", false "<spoken>", mixed "<spoken>", change announced yes/no; iOS <version>, Safari: true "<spoken>", false "<spoken>", mixed "<spoken>", change announced yes/no.
- **VoiceOver verdict: announces | does not announce** → Task R3 ships without `TreeLabels` | adds `TreeLabels`.
```

- [ ] **Step 7: Commit the report**

```bash
git add docs/superpowers/plans/2026-09-26-fluent-parity-phase-3-a-foundation.md
git commit -m "docs(plan): wave A report and the VoiceOver spike verdict"
```

Wave B starts only after this commit (spec §1.7: the lead commits the package before wave B).

## Wave A report

- Commit: `a0fc2c9`, 2026-09-26.
- Exit commands (§1.7): `npm run typecheck` ✓; `npm run lint` ✓; `npm run format:check` ✓; `npm test` ✓ (163 test files; 10063 passed | 2 expected fail — the two intentional `it.fails` cases in `test-utils.test.tsx` that check the test-setup body/overlay guards; `conventions.test.ts`'s 218 cases all green, no `class-names` finding); `npm run build` ✓ (prints the open bridge, `verify-dist: PENDING_FLAT_EXPORTS bridge open (C-COMPOUND; not compounds yet: ColorPicker, MessageBar, Toast)`, and `verify-dist: dist OK`); `node scripts/verify-dist.mjs` ✓ (same, run standalone); `node scripts/build-css.mjs --check-only` ✓ (`build-css: dist/styles.css (56.2 kB) and dist/preflight.css (3.4 kB) OK`); `npm run build-storybook` ✓ (`verify-storybook` OK: the iframe CSS keeps every story-only utility and all 9 `wave-rtl:` classes of the library with Wave's direction variant).
- Clean output: `npx vitest run --reporter=default` → 163 files, 10063 passed | 2 expected fail; `grep -nE "not wrapped in act|\[WaveUI\]"` on the log exited 1 (no match). No act() warning, no unasserted `[WaveUI]` warning.
- Existing tests changed: exactly the §6.4 six (`Drawer.test.tsx`, `MenuButton.test.tsx`, `CompoundButton.test.tsx`, `ToggleButton.test.tsx`, `Toolbar.test.tsx`, `Toolbar.parts.test.tsx` — small diffs, confirmed by `git diff --stat` against every other test to be exact-class lines only) and the six task-owned files (`Button.slots.test.tsx`, `MessageBar.test.tsx`, `test-utils.test.tsx`, `conventions.test.ts`, `public-types.test.ts`, `verify-dist.test.mjs`); any other: `src/__tests__/integration.test.tsx` — Task A16 (Step 6 of its brief) added its own `PENDING_FLAT_MEMBERS` list plus a test asserting it stays sorted and pending, the barrel test's twin of `verify-dist.mjs`'s `PENDING_FLAT_EXPORTS`, so the "public barrel" walk does not fail on the ten flat member names wave B still owes; not named on this task's Step 3 list, but an A16 deliverable (the flat-name bridge the A1–A16 dispatch describes), not a defect. No story changed.
- Registry change requests: none — every A1–A16 report's "Issues or concerns" section reads "None"; no task asked to add, rename or re-scope a registry constant.
- Appendix A rows applied differently: none — same read of the A1–A16 reports; no row's class landed on a different element, layout or variant than Appendix A names.
- VoiceOver spike: not run in this environment. `tree-spike.html` and `spike-server.mjs`, built verbatim from this task's Step 4, were written to `.superpowers/sdd/2026-09-26-fluent-parity-phase-3/voiceover-spike/` (outside `src`/`stories`; covered by `.superpowers/sdd/.gitignore`'s `*`, so untracked and never committed).
- **VoiceOver verdict:** Not run — no macOS/iOS VoiceOver in the implementation environment; pending the maintainer (spike page in the SDD workspace: `voiceover-spike/`). Decision for Task R3 until then: ship WITHOUT `TreeLabels` (the spec's default path): `TreeLabels` is additive and can ship in a 0.8.x patch if the spike finds VoiceOver silent, while an unneeded `TreeLabels` could not be removed before 1.0.
