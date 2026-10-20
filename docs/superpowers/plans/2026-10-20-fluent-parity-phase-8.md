# Phase 8 (0.13.0) Implementation Plan: identity, cards, tabs and carousel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 35 Fluent-parity gaps of Avatar, AvatarGroup, Persona, PresenceBadge, Card, TabList and Carousel with opt-in props that leave every 0.12 call unchanged.

**Architecture:** Each component gets new props, `data-*` state and class maps next to its existing code; shared pieces are a widened internal `AvatarSizeContext`, an Avatar-badge size context, a server-safe `getInitials` and `partitionAvatarGroupItems`, a palette token set, and Carousel's group/drag/button modules. Carousel is last (largest). Existing suites are the regression net.

**Tech Stack:** React 19, TypeScript, Tailwind 4 (literal class maps only), Vitest + React Testing Library + vitest-axe.

**Spec:** `docs/superpowers/specs/2026-10-20-fluent-parity-phase-8-design.md` (rulings D1–D7, §2–§9). Read it and `CLAUDE.md` (C-* conventions) first. Work in this worktree; `node_modules` is not installed here: create a junction to the main checkout's before the first test run (`New-Item -ItemType Junction -Path <worktree>\node_modules -Target C:\code\packages\wave-ui-react\node_modules`) and remove the junction (link only, `cmd /c rmdir`) before removing the worktree. Focused runs: `npx vitest run <files> --reporter=default`.

## Global Constraints

- Version 0.13.0; CHANGELOG section `## [0.13.0] - Unreleased` above `## [0.12.0]`.
- Behaviour-neutral (D2): every new prop defaults to the 0.12 behaviour; the existing suites of the seven components pass unchanged except for type assertions that a widened union forces.
- C-CLASS: new enumerated props render their resolved value as `data-*` on the element that receives `className`, before `{...rest}`; new parts register constants in `src/lib/classNames.ts` in the same change (`classNames.test.ts` and the conventions gate `class-names` enforce it); `VARIANT_BASES` only for nested public components that carry a parent's part class.
- C-TOKENS/C-RADIUS/C-LOGICAL/C-MOTION as in `CLAUDE.md`: literal class maps only (no runtime-built Tailwind names), `not-disabled:not-aria-disabled:hover:` gates, logical utilities, a `motion-reduce:` variant on every transition, no bare Tailwind words in `src` comments or strings.
- C-SLOTS for `initials`, `Tab icon`, `Card.Header image/action`, `Card.Preview logo`, `floatingAction`, `checkbox`, `thumbnail`: `renderSlot`, `slotRendersContent`, decorative slots `aria-hidden`.
- C-NAMING: `onOpenChange(open, details?)` with `OpenChangeDetails<R>`; deprecated spellings through `warnDeprecated`; warning keys dotted (`Persona:unnamed`, `TabList.Tab:icon-only-name`).
- C-DEV: warnings from effects with `warnOnce` (value-alias warnings may run during render).
- New public symbols go through the barrels; every named type in a public signature reaches the entry (`public-types.test.ts`).
- Commits: conventional subjects, **no attribution trailer** (project rule), one commit per task.
- `src/lib` additions are server-safe (`getInitials`, `partitionAvatarGroupItems` import no React).

## Review Focus

1. `color="colorful"`: the same `idForColor`/name gives the same color on server and client; an empty name and no id falls back to `brand` (no crash, no `NaN` class).
2. `getInitials` odd inputs: emoji-only names, only brackets, a single letter, combining marks, mixed Latin and CJK, Hebrew/Arabic with `dir: 'rtl'`, leading/trailing spaces, a name that is one very long word.
3. Carousel `groupSize`: a `value` beyond the range, a slide count that shrinks while on the last page, `'auto'` when the container resizes while on the last page, looping with a short last page, autoplay by page.
4. Carousel drag: the click that ends a drag is swallowed but a plain click on a button inside a slide still works; `pointercancel`; a vertical swipe still scrolls the page; dragging started on an interactive child; RTL direction.
5. Card `checkbox={null}` with `selectionControl="checkbox"` and no replacement control (what the accessible tree offers); `floatingAction` with the checkbox corner; Persona with neither `name` nor `primaryText`; Tab icon-only without a name.

---

## File structure

| File | Change |
|---|---|
| `src/components/data-display/PresenceBadge.tsx`, `src/lib/types.ts` | status names, optional status |
| `src/components/data-display/Avatar.tsx`, `Avatar.context.ts`, `Avatar.sizes.ts` (new) | shape, numeric sizes, colors, active, initials slot, badge size context |
| `src/lib/initials.ts` (new) | `getInitials` |
| `src/styles/tokens.css`, `src/styles/__tests__/tokens.test.ts` | `--wave-palette-*` pairs |
| `Tag.tsx`, `InteractionTag.tsx` | pass shape through `AvatarSizeContext` |
| `AvatarGroup.tsx`, `AvatarGroup.parts.tsx` (new), `AvatarGroup.partition.ts` (new), `AvatarGroup.context.ts` (new) | layouts, parts, helper |
| `Persona.tsx` | lines, positions, presenceOnly, huge |
| `src/components/layout/TabList.tsx` | appearance, size, icon |
| `src/components/layout/Card.tsx`, `Card.preview.tsx` (new) | appearance, size, orientation, parts, slots |
| `src/components/layout/Carousel.tsx`, `Carousel.context.ts`, `Carousel.groups.ts`, `Carousel.drag.ts`, `Carousel.button.tsx` (new) | groups, drag, thumbnails, layouts, button |
| `src/lib/classNames.ts`, `src/index.ts` and the category barrels, `scripts/verify-dist.mjs` and its test fixture | registry, exports, probes |
| README, `docs/WAVE-UI-GUIDE.md`, CHANGELOG, ROADMAP, CLAUDE.md, stories | docs |

---

### Task 1: PresenceBadge status names (P8-04)

**Files:** Modify `src/components/data-display/PresenceBadge.tsx`, `src/lib/types.ts`, `src/lib/icons.tsx` (names only if keyed), `stories/PresenceBadge.stories.tsx`; Test `PresenceBadge.test.tsx`, `Persona.test.tsx`.

**Interfaces:** Produces `PresenceStatus` = `'available' | 'busy' | 'away' | 'offline' | 'do-not-disturb' | 'out-of-office' | DeprecatedPresenceStatus` and `type DeprecatedPresenceStatus = 'dnd' | 'oof'` (exported); `PresenceBadgeProps.status?: PresenceStatus` (default `'available'`); module-only `normalizePresenceStatus(status: PresenceStatus): Exclude<PresenceStatus, DeprecatedPresenceStatus>`; root renders `data-status` (normalized).

- [ ] **Step 1:** Write failing tests: `do-not-disturb and dnd render the same glyph, class and name`, `out-of-office and oof render the same`, `dnd warns once with "status 'dnd'" naming 'do-not-disturb'` (and `oof`), `status omitted renders available`, `data-status renders the normalized value`, `Persona status="dnd" still renders the badge`, `expectTypeOf<PresenceBadgeProps['status']>()` is optional and accepts the six names plus the two aliases.
- [ ] **Step 2:** Run `npx vitest run src/components/data-display/__tests__/PresenceBadge.test.tsx src/components/data-display/__tests__/Persona.test.tsx`; expect FAIL.
- [ ] **Step 3:** Implement as the Interfaces say; call `warnDeprecated('PresenceBadge', "status 'dnd'", "'do-not-disturb'")` during render for an alias; key the per-status table (glyph, icon, classes, English label) by the new names. JSDoc: `@deprecated` note on the alias type; the prop doc names the aliases and 1.0 removal.
- [ ] **Step 4:** Rename the `DND`/`OOF` stories to the new values; run the two test files, `npx tsc -p tsconfig.dev.json --noEmit`, lint on touched files; expect PASS.
- [ ] **Step 5:** Commit `feat(data-display): PresenceBadge Fluent status names; dnd and oof become aliases`.

---

### Task 2: Avatar numeric sizes, shape and the shared context (P8-01)

**Files:** Create `Avatar.sizes.ts`; Modify `Avatar.tsx`, `Avatar.context.ts`, `Tag.tsx`, `InteractionTag.tsx`; Test `Avatar.test.tsx`, `Tag.test.tsx`/`InteractionTag.test.tsx` (context cases).

**Interfaces:**
- Produces `type AvatarNumericSize = 16 | 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 72 | 96 | 120 | 128` (exported from the entry) and `type AvatarSize = Size | AvatarNumericSize`; in `Avatar.sizes.ts` (module-only): `avatarPixelSize(size: AvatarSize): number`, `avatarSizeClasses: Record<AvatarNumericSize, string>` (literal class strings: box, font step, glyph) and `avatarShapeClasses(shape, px): string` (`rounded-full`; square → `rounded-md` from 40, else `rounded-sm`).
- `AvatarSizeContextValue` becomes `{ size: number; shape?: 'circular' | 'square' }`; `AvatarProps` gains `shape?: 'circular' | 'square'` and `size?: AvatarSize`; root renders `data-size` (the named size or the number as a string) and `data-shape` (resolved). Resolution of size: own, else context, else `'medium'`; shape: own, else context shape, else `'circular'`.
- Tag and InteractionTag provide `{ size: TAG_AVATAR_SIZE[…], shape: tagShape === 'rounded' ? 'square' : 'circular' }`.

- [ ] **Step 1:** Failing tests: `each named size keeps its 0.12 pixel box` (24/32/40/48/56), `each numeric size renders its box class` (it.each over the 14), `data-size and data-shape render resolved values`, `shape square uses rounded-md at 40 and rounded-sm at 24`, `a medium Tag with shape rounded gives its Avatar a square shape and a circular Tag a circular one`, `an Avatar's own shape wins over the Tag's`, `the 16/20/24 tag boxes are unchanged`.
- [ ] **Step 2:** Run the Avatar, Tag and InteractionTag suites; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement; replace the private `avatarSizeClasses` of `Avatar.tsx` with the map; keep the person glyph at 60 %.
- [ ] **Step 4:** Run the three suites, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(data-display): Avatar shape and numeric sizes; tags pass their shape`.

---

### Task 3: `getInitials` and the `initials` slot (P8-01)

**Files:** Create `src/lib/initials.ts`, `src/lib/__tests__/initials.test.ts`; Modify `Avatar.tsx`, `src/index.ts`; Test `Avatar.test.tsx`.

**Interfaces:** Produces `export function getInitials(name: string, options?: { dir?: 'ltr' | 'rtl'; firstInitialOnly?: boolean }): string` (server-safe, no React); `AvatarProps.initials?: Slot<'span'>`. Avatar's private `getInitials`/`normaliseName` are deleted; Avatar calls the public one with `dir` from `useDirection`.

- [ ] **Step 1:** Write the failing table test in `initials.test.ts`: `'Jane Doe (Contoso)'` → `'JD'`; `'Jane [Contoso] Doe'` → `'JD'`; `'Ada'` → `'A'`; `'  ada  lovelace '` → `'AL'`; `'+1 (555) 010-0000'` and `'555-0100'` → `''`; `'田中太郎'`, `'ภาษาไทย'` → `''`; `'Иван Петров'` → `'ИП'`; `'דוד כהן'` with `dir: 'rtl'` → swapped; `'Jane Doe'` with `dir: 'rtl'` → `'DJ'`; `firstInitialOnly` → `'J'`; `'(only brackets)'` → `''`; `'😀'` → `''`; `'Åsa Öberg'` → `'ÅÖ'`; combining marks kept with their letter; `''` → `''`; a name with a surrogate-pair first letter (`'𝒜da Lovelace'`). Avatar tests: `initials slot replaces the computed initials` (string, element, object with className), `an empty slot falls back to the computed initials`, `the person glyph shows when getInitials returns ''`, `RTL swaps the rendered initials`.
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/initials.test.ts src/components/data-display/__tests__/Avatar.test.tsx`; expect FAIL.
- [ ] **Step 3:** Implement `getInitials` with Unicode property escapes: drop bracketed groups, then everything but `\p{L}\p{M}\p{N}` and spaces; empty or digits-only → `''`; scripts without letter initials (`\p{Script=Han|Hiragana|Katakana|Hangul|Thai|Lao|Khmer|Myanmar|Tibetan}`) → `''`; first code point (`Array.from`) of the first and last word, `toUpperCase()`; RTL reverses the pair. Wire the slot with `renderSlot(initials, 'span', cn(avatarClassNames.initials, …), { 'aria-hidden': true })`, using `slotRendersContent`.
- [ ] **Step 4:** Run both files, export `getInitials` from `src/index.ts`, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat: getInitials and the Avatar initials slot`.

---

### Task 4: Persona palette tokens and Avatar `color` (P8-01)

**Files:** Modify `src/styles/tokens.css`, `src/styles/__tests__/tokens.test.ts`, `Avatar.tsx`, `Avatar.sizes.ts` (or new `Avatar.colors.ts`); Test `Avatar.test.tsx`.

**Interfaces:** Produces tokens `--wave-palette-<n>` and `--wave-palette-<n>-foreground` for `n` in `red pumpkin gold forest teal blue navy lavender purple magenta brown steel` in `:root`/`.wave-light`, `.wave-dark`/`.dark` and `.wave-high-contrast`/`.high-contrast`, mapped in `@theme inline` (`--color-palette-<n>`, `--color-palette-<n>-foreground`); `type AvatarNamedColor` (the 12 names, exported); `AvatarProps.color?: 'neutral' | 'brand' | 'colorful' | AvatarNamedColor` (default `'brand'`) and `idForColor?: string`; module-only `avatarColorClasses: Record<…, string>` (literal) and `hashToNamedColor(key: string): AvatarNamedColor` (a stable string hash, e.g. 32-bit FNV-1a, modulo 12). Root renders `data-color` (the resolved one: for `colorful` the picked name). High contrast: every pair maps to the theme's `background`/`foreground` pair and the Avatar adds a `forced-colors:border`.

- [ ] **Step 1:** Failing tests: `tokens.test.ts` — each of the 12 pairs reaches 4.5:1 in light, dark and high-contrast (the existing contrast helper); Avatar — `color neutral/brand/<named> classes`, `colorful picks the same named color for the same idForColor and name`, `colorful falls back to name when idForColor is absent`, `colorful with neither falls back to brand`, `different ids spread over several colors` (20 ids hit at least 6 colors), `data-color renders the resolved color`, `an image Avatar ignores color`, the `Initials` mode only.
- [ ] **Step 2:** Run the two files; expect FAIL.
- [ ] **Step 3:** Choose palette values that pass (adjust until the test passes: foreground white or near-black per hue); implement the class map and hash; keep the default `brand` classes identical to 0.12 (`bg-primary text-primary-foreground`).
- [ ] **Step 4:** Run the files, `node scripts/build-css.mjs` (expect OK), typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(data-display): Avatar color and the persona palette tokens`.

---

### Task 5: Avatar `active` and badge sizing (P8-01)

**Files:** Modify `Avatar.tsx`, `Avatar.context.ts` (add `AvatarBadgeSizeContext`), `PresenceBadge.tsx`, `Badge.tsx`/`CounterBadge.tsx` if they accept `size`; Test `Avatar.test.tsx`, `PresenceBadge.test.tsx`.

**Interfaces:** `AvatarProps.active?: 'active' | 'inactive' | 'unset'` (default `'unset'`), `activeAppearance?: 'ring' | 'ring-shadow' | 'shadow' | 'glow'` (default `'ring'`); root renders `data-active`; `inactive` = reduced opacity with `motion-reduce:` variant, `active` = ring/shadow/glow classes; module-only `AvatarBadgeSizeContext: React.Context<PresenceBadgeSize | null>`, provided around the `badge` slot with the mapping ≤ 24px `extra-small`, ≤ 32 `small`, ≤ 56 `medium`, ≤ 96 `large`, else `extra-large`; `PresenceBadge` without its own `size` reads it.

- [ ] **Step 1:** Failing tests: `active/inactive/unset set data-active and the classes for each activeAppearance`, `a PresenceBadge in the badge slot takes its size from the avatar` (it.each over sizes, including numeric), `an own size on the badge wins`, `the badge keeps its own role img and name and is not inside the avatar's name` (axe clean), `RTL corner stays logical`.
- [ ] **Step 2:** Run both files; expect FAIL.
- [ ] **Step 3:** Implement with literal class strings; no new transitions without `motion-reduce:`.
- [ ] **Step 4:** Run the files and the conventions gate for the touched sources (`npx vitest run src/__tests__/conventions.test.ts -t "data-display"`), typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(data-display): Avatar active states and badge sizing`.

---

### Task 6: AvatarGroup layouts, size propagation and `partitionAvatarGroupItems` (P8-02)

**Files:** Create `AvatarGroup.context.ts`, `AvatarGroup.partition.ts`; Modify `AvatarGroup.tsx`, `Avatar.tsx` (read the group context); Test `AvatarGroup.test.tsx`, `AvatarGroup.partition.test.ts`.

**Interfaces:** Produces `partitionAvatarGroupItems<T>(options: { items: readonly T[]; maxInlineItems?: number; layout?: 'stack' | 'spread' | 'pie' }): { inlineItems: T[]; overflowItems: T[] | undefined }` (server-safe; `pie` caps inline at 3; `maxInlineItems` ≤ 0 → all overflow; `undefined` → all inline); internal `AvatarGroupContext` `{ size: AvatarSize; layout }`; `AvatarGroupProps.layout?: 'stack' | 'spread' | 'pie'` (default `'stack'`) and `size?: AvatarSize` (default `'medium'`, now reaching members and trigger); root renders `data-layout`. Avatar size resolution: own, group, tag box, `medium`.

- [ ] **Step 1:** Failing tests: partition table (empty, under/equal/over max, `pie` cap, `maxInlineItems` 0 and negative, `undefined`); `size reaches the member Avatars and the overflow button`; `layout stack keeps the 0.12 overlap`, `spread has a gap and no overlap`, `pie renders wedges for up to 3 members and sends the rest to overflow`, `pie members are aria-hidden and the group's label names it`; `data-layout` values; every 0.12 test unchanged.
- [ ] **Step 2:** Run both files; expect FAIL.
- [ ] **Step 3:** Implement layouts with logical utilities and literal classes (`pie` via `clip-path` wedges, default size `large`); the root uses the partition helper for `max`.
- [ ] **Step 4:** Run the files, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(data-display): AvatarGroup layouts and size for members`.

---

### Task 7: AvatarGroup compound parts, indicator, cap and controlled popup (P8-02)

**Files:** Create `AvatarGroup.parts.tsx` (`AvatarGroupItem`, `AvatarGroupPopover`); Modify `AvatarGroup.tsx`, `src/lib/classNames.ts`; Test `AvatarGroup.test.tsx`.

**Interfaces:** `AvatarGroup = /* @__PURE__ */ Object.assign(AvatarGroupRoot, { Item: AvatarGroupItem, Popover: AvatarGroupPopover })` with flat names; `AvatarGroupItemProps = AvatarProps` (renders an Avatar inline; in the overflow list an avatar plus the name as a row); `AvatarGroupPopoverProps` (children = overflow items, `indicator`, `count`, `label`); root props `overflowIndicator?: 'count' | 'icon'` (default `'count'`), `open?`, `defaultOpen?`, `onOpenChange?: (open: boolean, details?: OpenChangeDetails<DismissReason | 'trigger'>) => void`; the shown count is `n > 99 ? '99+' : \`+${n}\`` while the accessible name keeps the real number; registry constants `avatarGroupItemClassNames`, `avatarGroupPopoverClassNames` with the existing popup parts moved under them where the 0.12 keys must stay (`avatarGroupClassNames.surface/list/listItem` stay registered).

- [ ] **Step 1:** Failing tests: compound exposure and `asClientReference` equality; `99+` cap and the unchanged label; `icon` indicator; `open`/`defaultOpen`/`onOpenChange` once in StrictMode with details (`escape`, `outside-press`, `trigger`); the overflow list shows an avatar and the name per row; direct `Avatar` children and the unnamed-member warning as in 0.12; a consumer-partitioned `<AvatarGroup.Popover>` equals the automatic one; every 0.12 popup test (Tab ends, iframe realm, focus trap, focus return) unchanged; axe closed and open.
- [ ] **Step 2:** Run `AvatarGroup.test.tsx` and `classNames.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement; the root's automatic overflow renders `AvatarGroup.Popover`; reuse `useDismiss`/`useRestoreFocus` exactly as 0.12.
- [ ] **Step 4:** Run the files and `npx vitest run src/__tests__/classNames.test.ts src/__tests__/conventions.test.ts -t "AvatarGroup|class-names"`, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(data-display): AvatarGroup Item and Popover parts, overflow indicator and controlled open`.

---

### Task 8: Persona text lines, positions, presenceOnly and huge (P8-03)

**Files:** Modify `Persona.tsx`, `src/lib/classNames.ts`; Test `Persona.test.tsx`.

**Interfaces:** `PersonaSize = Size | 'huge'`; props `name?`, `primaryText?`, `secondaryText?`, `tertiaryText?`, `quaternaryText?` (all `Slot<'span'>`; strings unchanged), `textPosition?: 'after' | 'before' | 'below'` (default `'after'`), `textAlignment?: 'start' | 'center'` (default `'start'`, `'center'` for `below`), `presenceOnly?: boolean`; root renders `data-size`, `data-text-position`, `data-text-alignment`, and `data-presence-only` (present or absent); registry keys `personaClassNames.tertiaryText`, `.quaternaryText`; `huge` = a 72px Avatar; a literal per-size map of the primary and secondary type steps (medium unchanged).

- [ ] **Step 1:** Failing tests: each text line renders only when given; string and slot forms; `name` omitted with `primaryText`; `textPosition` classes (`before` = `flex-row-reverse`, `below` = `flex-col items-center`) and the resolved `data-*`; `below` aligns centered by default; `presenceOnly` shows the badge and no Avatar; `huge` Avatar is 72px; text size classes per size; RTL puts `before` on the right on screen and the badge corner stays logical; the name is announced exactly once (query by accessible name finds one match) plus one status image; `Persona:unnamed` warns once with neither `name` nor `primaryText`; 0.12 string props unchanged; `Tree.itemPersonaLayout` suite unchanged.
- [ ] **Step 2:** Run `Persona.test.tsx` and the Tree layout suite; expect FAIL on the new cases.
- [ ] **Step 3:** Implement with literal class maps; the warning from an effect via `warnOnce('Persona:unnamed', …)`.
- [ ] **Step 4:** Run both suites, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(data-display): Persona text lines, positions, presenceOnly and huge`.

---

### Task 9: TabList appearance, size and Tab icon (P8-07)

**Files:** Modify `src/components/layout/TabList.tsx`; Test `TabList.test.tsx`.

**Interfaces:** `TabListProps.appearance?: 'transparent' | 'subtle' | 'subtle-circular' | 'filled-circular'` (default `'transparent'`), `size?: CoreSize` (default `'medium'`); tablist root renders `data-appearance`, `data-size`, `data-orientation`; `TabListContextValue` and `INERT_CONTEXT` gain `appearance` and `size`; `TabProps.icon?: Slot<'span'>`; an icon with no children is icon-only (`data-icon-only`, square hit area) and warns once from an effect when it has no `aria-label`/`aria-labelledby` (`TabList.Tab:icon-only-name`); selected indicators: `transparent` keeps the border plus `forced-colors:border-[Highlight]`, the other appearances use fills plus `forcedColors.selectedContainer`.

- [ ] **Step 1:** Failing tests: classes and `data-*` per appearance × size (medium/transparent equals the 0.12 class string); selected tab of each appearance carries the forced-colors class; hover/pressed use the gated classes; icon slot forms (string, element, object), icon before the text, `aria-hidden`; icon-only layout and its warning (and no warning with `aria-label`); vertical and RTL per appearance; the memoized-by-content test with the new context; all 0.12 suites (deprecated aliases, manual activation, Panel placement).
- [ ] **Step 2:** Run `TabList.test.tsx`; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement with literal class maps keyed by appearance and size.
- [ ] **Step 4:** Run the suite and `stableClassNames.test.tsx`, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(layout): TabList appearances, sizes and Tab icons`.

---

### Task 10: Card appearance, size and orientation (P8-05)

**Files:** Modify `src/components/layout/Card.tsx`; Test `Card.test.tsx`.

**Interfaces:** `CardOwnProps.appearance?: 'filled' | 'filled-alternative' | 'outline' | 'subtle'` (default `'filled'`), `size?: CoreSize` (default `'medium'`), `orientation?: Orientation` (default `'vertical'`); root renders `data-appearance`, `data-size`, `data-orientation` before `{...rest}`; the root sets `--wave-card-padding` (0.75rem / 1rem / 1.25rem) and the Header/Body/Footer use it in place of the fixed `p-4`; appearances: `filled` = the 0.12 classes, `filled-alternative` = `bg-muted`, no shadow, `outline` = transparent, `border-border`, no shadow, `subtle` = transparent, no border, no shadow; a selectable card gets gated hover/pressed fills per appearance; the selected look is unchanged for every appearance; `horizontal` makes the root `flex` (parts keep the vertical stack inside their column).

- [ ] **Step 1:** Failing tests: per appearance the classes and `data-*`; the 0.12 default class string is byte-equal; padding variable per size and the parts read it; horizontal sets flex; the hover/pressed gate on a selectable card for each appearance (and none on a non-selectable); the selected look for each appearance; forced-colors class kept; the 974 lines of 0.12 tests.
- [ ] **Step 2:** Run `Card.test.tsx` and `stableClassNames.test.tsx`; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement with literal maps.
- [ ] **Step 4:** Run both, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(layout): Card appearances, sizes and horizontal orientation`.

---

### Task 11: Card.Preview, Header slots, checkbox slot and floatingAction (P8-05)

**Files:** Create `Card.preview.tsx` (`CardPreview`); Modify `Card.tsx`, `src/lib/classNames.ts`, `src/components/layout/index.ts`; Test `Card.test.tsx`.

**Interfaces:** `Card = Object.assign(CardRoot, { Header, Preview, Body, Footer })`, flat `CardPreview` (polymorphic `'div'`, `CardPreviewOwnProps { logo?: Slot<'span'> }`), constants `cardPreviewClassNames` (`root`, `logo`), `cardHeaderClassNames.image/.action`, `cardClassNames.floatingAction`; `CardHeaderOwnProps.image?: Slot<'span'>`, `action?: Slot<'span'>` (the header becomes a grid when either renders; otherwise as 0.12); `CardOwnProps.checkbox?: Slot<'input'>` (an object merges props onto the built-in native checkbox; `null`/`false` removes it), `floatingAction?: Slot<'span'>` (a container at `end-3 top-3`; with a checkbox also shown, the checkbox moves to `start-3 top-3`).

- [ ] **Step 1:** Failing tests: compound exposure and `asClientReference`; Preview edge-to-edge (no padding) and the logo slot forms; in a horizontal card Preview is first and full height; Header image/action render and the title id wiring still names the checkbox; `checkbox` object merges className/aria onto the native input; `checkbox={null}` renders no control and `selectionControl="checkbox"` still sets no role on the root (and the `Card:checkbox-name` warning does not fire); floatingAction renders and the checkbox corner is `start` only when both exist; axe for the combinations.
- [ ] **Step 2:** Run `Card.test.tsx`, `classNames.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement; `isElementOfType` for parts; keep `CardTitleIdContext`.
- [ ] **Step 4:** Run the files and the conventions gate for `src/components/layout`, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(layout): Card.Preview, header image and action, checkbox and floating action slots`.

---

### Task 12: Carousel groups, auto size, labels and the focus group (P8-06)

**Files:** Create `Carousel.groups.ts` (pure page maths: `pageStartOf(index, groupSize, total)`, `pageCount`, `clampToPage`), `Carousel.context.ts`; Modify `Carousel.tsx`; Test `Carousel.test.tsx`, `Carousel.groups.test.ts`.

**Interfaces:** `CarouselProps.groupSize?: number | 'auto'` (default `1`), `align?: 'start' | 'center' | 'end'` (default `'start'`); `CarouselLabels.slides?: (start: number, end: number, total: number) => string` (default ``Slides ${start} to ${end} of ${total}``); the index stays a slide index, snapped down to its page start and clamped as in 0.12; `onValueChange` emits page starts; `'auto'` measures the viewport and the slide widths with a `ResizeObserver` read through `useSyncExternalStore`; all slides of the active page are exposed (not `inert`, not `aria-hidden`); the picker has one button per page named with `labels.slides` (single slide pages keep `labels.slide`); loop, end buttons and autoplay count pages; with `groupSize` ≠ 1 the visible slides form a roving group (`useRovingTabIndex`, horizontal, RTL-aware via the hook) and an arrow past the page end goes to the next page and focuses its first slide.

- [ ] **Step 1:** Failing tests: `groups.test.ts` tables (value 4/n 3 → 3, last short page, value beyond range, total shrinking, n larger than total, n 1 identity); component: pages of 3 expose 3 slides and inert the rest; picker one button per page; labels; `onValueChange` once per page change in StrictMode; loop with a short last page; autoplay by page and the `endedAt` rule; `'auto'` with `installResizeObserverMock` and stubbed widths (page size changes on resize and the value re-snaps); arrow keys between visible slides, past the end changes the page, RTL; `groupSize` 1 has no key handling and every 0.12 test passes unchanged.
- [ ] **Step 2:** Run `Carousel.test.tsx` and `Carousel.groups.test.ts`; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement; keep the transform track and the JS-resolved direction.
- [ ] **Step 4:** Run the suites, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(layout): Carousel groupSize, auto size and the slide focus group`.

---

### Task 13: Carousel dragging (P8-06)

**Files:** Create `Carousel.drag.ts` (`useCarouselDrag`); Modify `Carousel.tsx`; Test `Carousel.test.tsx`.

**Interfaces:** `CarouselProps.draggable?: boolean` (default `false`); `useCarouselDrag({ enabled, dir, onCommit(delta: -1 | 0 | 1) })` returns the handlers for the track (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `onClickCapture`), a live `offsetPx` and `dragging`; the track sets `touch-action: pan-y` (class), `data-dragging` while dragging and no transition; commit when the drag passed 25 % of the viewport width or the release speed passed 0.5 px/ms in that direction, else snap back; direction follows the resolved `dir`; primary button only, `isOwnEvent`, `setPointerCapture`; a click that ends a drag is swallowed (capture-phase), a plain click is not; dragging pauses autoplay like hover; reduced motion changes nothing (the transition is already off).

- [ ] **Step 1:** Failing tests (pointer-capture stubs in `beforeEach`, `mockRect` for the viewport, `PointerEvent`s in `act`, `it.each(['mouse','touch','pen'])`): a drag past the threshold changes the page; a short slow drag snaps back; a fast short flick commits; RTL drag direction is mirrored; the track follows the pointer (`transform` px) and `data-dragging` is set then cleared; the ending click is swallowed once and a later click on a button inside a slide works; `pointercancel` snaps back; a secondary button does not drag; `draggable={false}` attaches nothing; autoplay pauses during a drag; StrictMode `onValueChange` once.
- [ ] **Step 2:** Run `Carousel.test.tsx`; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement following ColorArea's pointer pattern; velocity from the last two move events.
- [ ] **Step 4:** Run the suite, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(layout): Carousel dragging`.

---

### Task 14: Carousel thumbnails, control layouts, Carousel.Button and appearance (P8-06)

**Files:** Create `Carousel.button.tsx`; Modify `Carousel.tsx`, `Carousel.context.ts`, `src/lib/classNames.ts`, `src/components/layout/index.ts`; Test `Carousel.test.tsx`.

**Interfaces:** `CarouselItemProps.thumbnail?: Slot<'img'>` (a string is the `src`); when any item has one the picker buttons show it (alt `''`, the button keeps its slide-label name) instead of the dot; `CarouselProps.controlsLayout?: 'overlay' | 'inline' | 'overlay-wide' | 'inline-wide'` (default `'overlay'`) rendered as `data-controls-layout`, `appearance?: 'flat' | 'elevated'` (default `'flat'`) rendered as `data-appearance`; `Carousel.Button` (flat `CarouselButton`) with `CarouselButtonProps { direction: 'previous' | 'next' }` + button attributes, `type="button"` before `{...rest}`, reads the root context (`reportMissingContext('Carousel.Button', 'Carousel')`), disabled and named as the built-in ones (`labels.previous`/`next`, `aria-controls`, `focusableDisabledProps`), rendered where written (a direct child of `Carousel`); a present `Carousel.Button` replaces the built-in button of its direction; constants `carouselButtonClassNames.root`, `carouselClassNames.viewport`, `carouselItemClassNames.thumbnail`; the rotation control stays first focusable at the same corner in every layout.

- [ ] **Step 1:** Failing tests: thumbnail forms and the picker markup (button name unchanged, image alt empty, `aria-current`); each layout's DOM order and classes (inline buttons flank the viewport; wide layouts' full-height strips); the rotation control position and first-focus order in all four; `Carousel.Button` replaces the built-in of its direction, disables at the ends, keeps the name and `aria-controls`, throws outside a Carousel in development; compound exposure and `asClientReference`; `appearance` classes and `data-*`; non-item children other than the button still warn (`Carousel:non-item-children`); axe in each layout; all 0.12 tests.
- [ ] **Step 2:** Run `Carousel.test.tsx` and `classNames.test.ts`; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement; share the control button class string between the built-in and standalone buttons.
- [ ] **Step 4:** Run both files and the conventions gate for `src/components/layout`, typecheck, lint; expect PASS.
- [ ] **Step 5:** Commit `feat(layout): Carousel thumbnails, control layouts, Carousel.Button and appearance`.

---

### Task 15: INTEGRATION — barrels, registry, public types, dist probes

**Files:** Modify `src/index.ts`, the `data-display` and `layout` barrels, `src/lib/classNames.ts` (any constant still missing), `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `src/__tests__/classNames.test.ts`, `scripts/verify-dist.mjs` and `scripts/__tests__/verify-dist.test.mjs`.

**Interfaces:** Exports (values): `getInitials`, `partitionAvatarGroupItems`, `AvatarGroupItem`, `AvatarGroupPopover`, `CardPreview`, `CarouselButton`; (types): `AvatarNumericSize`, `AvatarSize`, `AvatarNamedColor`, `DeprecatedPresenceStatus`, `PersonaSize`, `AvatarGroupItemProps`, `AvatarGroupPopoverProps`, `CardPreviewProps`, `CardPreviewOwnProps`, `CarouselButtonProps`, `GetInitialsOptions`, `PartitionAvatarGroupItemsOptions`, `PartitionAvatarGroupItemsResult`.

- [ ] **Step 1:** Failing tests: the barrel test lists the new names and the compound members' flat equality (`AvatarGroupItem === AvatarGroup.Item`, `CardPreview === Card.Preview`, `CarouselButton === Carousel.Button`); `public-types` expects the new types; verify-dist hook probes (a `HOOK_PROBES_0_13`-style list in `verify-dist.mjs`: an import of only `getInitials` or only `partitionAvatarGroupItems` holds no component and no React module) with the matching fixture modules in `verify-dist.test.mjs` (follow the Phase 7 `withPhase7Modules` pattern); integration compositions: a Persona with an Avatar of every color inside a Tree item, an Avatar with a rounded Tag, a Card whose `action` is a `Menu.Trigger` button, a Carousel inside a Dialog with groups and a drag, an AvatarGroup popup opened from inside a Dialog.
- [ ] **Step 2:** Run `npx vitest run src/__tests__ scripts/__tests__/verify-dist.test.mjs`; expect FAIL.
- [ ] **Step 3:** Add the exports and the probes; add pending-list entries only if a gate needs them between tasks and empty them here.
- [ ] **Step 4:** Run `npm run build` then `node scripts/verify-dist.mjs --final` and the files above; expect PASS and exit 0.
- [ ] **Step 5:** Commit `feat: export the Phase 8 parts and helpers; dist probes`.

---

### Task 16: Stories and documentation

**Files:** Modify `stories/{Avatar,AvatarGroup,Persona,PresenceBadge,Card,TabList,Carousel}.stories.tsx`, `README.md`, `docs/WAVE-UI-GUIDE.md`, `CHANGELOG.md`, `docs/ROADMAP.md`, `CLAUDE.md`.

- [ ] **Step 1:** Add stories (defaults in `args`, callbacks via `fn()`, accessible names, tokens only): Avatar sizes/shapes/colors/active; AvatarGroup layouts and the compound form; Persona positions and `presenceOnly`; Card appearances, Preview and floating action; TabList appearances and icon-only; Carousel groups, draggable, thumbnails and the four layouts. Run `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Avatar|Persona|Presence|Card|TabList|Carousel"`; fix violations.
- [ ] **Step 2:** CHANGELOG `## [0.13.0] - Unreleased` with Added, Changed (the `AvatarSizeContext` widening is internal; Tag's Avatar shape), Deprecated (`dnd`, `oof`), Size (not re-measured, with the tree-shaking probes as evidence) and an "Upgrading from 0.12" note (type widenings: `PresenceStatus`, `Avatar size`, `Persona size`).
- [ ] **Step 3:** README: component table rows for the new parts, usage notes for Avatar colors/initials, AvatarGroup layouts, Persona positions, Card appearances, TabList appearances, Carousel groups/drag/layouts, the hooks-and-utilities rows for `getInitials` and `partitionAvatarGroupItems`, "Upgrading from 0.12". Guide: update the Avatar/Persona/Card/TabList/Carousel catalog entries and add a short pattern for the shared size contexts. CLAUDE.md: architecture list (new modules, the widened context), the 0.13 design reference. ROADMAP: Phase 8 "Built as" note recording §9 of the spec.
- [ ] **Step 4:** `npm run format:check`, `node scripts/build-css.mjs`, `npx eslint --max-warnings 0 stories src scripts`; expect clean.
- [ ] **Step 5:** Commit `docs: stories, CHANGELOG, README, guide, roadmap and CLAUDE.md for 0.13`.

---

### Task 17: Gate, review, browser check and release

**Files:** none (fixes as the gate and review find them).

- [ ] **Step 1:** Run `node scripts/claude/gate.mjs --base main`; expect "Gate PASSED". Fix and rerun on failure.
- [ ] **Step 2:** Final whole-branch review by a fresh most-capable reviewer with the Review Focus section; fix Critical and Important findings in one pass, each with a failing test first.
- [ ] **Step 3:** Real-browser pass in Storybook (port 6007, from this worktree): Carousel drag (mouse; touch via emulation), page snapping, thumbnails, the four layouts and the rotation control position; Avatar colors and initials in RTL; Tab and Card appearances in forced-colors emulation and dark/high-contrast themes; AvatarGroup pie and popup focus return. Record findings; fix or ledger.
- [ ] **Step 4:** Release as `docs/RELEASING.md` says: `npm version 0.13.0 --no-git-tag-version`, date the CHANGELOG section, update the ROADMAP status line, `node scripts/check-release.mjs v0.13.0 --registry`, commit `chore(release): 0.13.0`, merge into `main` locally with a merge commit, push `main`, tag `v0.13.0`, push the tag, watch the Release run, verify `npm view @mortenbrudvik/waveui dist-tags` and the provenance. (Merge, push and tag only when the maintainer says to release.)
- [ ] **Step 5:** Remove the `node_modules` junction (link only), then the worktree and the merged branch.
