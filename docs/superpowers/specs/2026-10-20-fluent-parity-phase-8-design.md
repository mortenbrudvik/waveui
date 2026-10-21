# WaveUI 0.13.0 — Fluent Parity Phase 8 Design (identity, cards, tabs and carousel)

> Date: 2026-10-20 · Branch: `feat/fluent-parity-phase-8` in `.claude/worktrees/fluent-parity-phase-8`, from `main` 3634473 (0.12.0 released) · Package: `@mortenbrudvik/waveui` → **0.13.0**.
> Scope: Phase 8 of [`docs/ROADMAP.md`](../../ROADMAP.md): P8-01 … P8-07 (Avatar, AvatarGroup, Persona, PresenceBadge, Card, Carousel, TabList). They close 7 + 6 + 6 + 1 + 6 + 6 + 3 gaps of the Fluent UI v9 comparison.
> Status: **draft for the maintainer's approval.** Written without an interview (the maintainer is the only developer and consumer, and asked to proceed from the roadmap). Choices that are the author's, not the roadmap's or the maintainer's, are marked **(my call)**; the ones where this spec departs from the roadmap's sketch are listed in §9.
> Inputs: the roadmap's Phase 8 section; three read-only surveys of the code at 3634473 (identity components; Card and TabList; Carousel); the Phase 7 spec for form and gates.

---

## 0. Intent

Phase 8 brings people and entity displays, cards, tabs and carousels to Fluent's breadth: more Avatar sizes, shapes and colors with initials that behave, group layouts, richer Persona text, the Fluent presence names, Card and Tab looks, and a Carousel that shows several slides, drags, shows thumbnails and lays out its controls in four ways.

**Goals.** Close the 35 gaps of the seven items; every addition is opt-in, and the 0.12 look and behaviour of an unchanged call stay as they are (D2).
**Non-goals.** Motion on these components (Phase 10: Carousel's fixed 300 ms, `car-3`), a change cause on Carousel's callback (`car-5`), a tablist for the Carousel picker (`car-7`, accepted), PresenceBadge `blocked`/`unknown`/`outOfOffice`/icon override (`presence-1,2,4`), Fluent's 30 named avatar colors (D13).
**Anti-goals.** A new dependency; a changed default look (`color` defaults to `brand`, `appearance` of Card to the current look, `layout` of AvatarGroup to `stack`); an Avatar, Card or Tab that announces differently when the new props are not used.

---

## 1. Rulings (cross-cutting)

- **D1 — One phase, one branch, one release, built sequentially in this order:** P8-04 → P8-01 → P8-02 → P8-03 → P8-07 → P8-05 → P8-06 → INTEGRATION → DOCS, in the worktree above, one agent at a time. P8-02 and P8-03 build on Avatar and PresenceBadge; Carousel is last because it is the largest. CHANGELOG `## [0.13.0] - Unreleased` above `## [0.12.0]`. *(my call)*
- **D2 — Additive and behaviour-neutral.** Every new prop has a default that reproduces 0.12; the existing suites of the seven components stay unchanged and green (their edits are limited to the type assertions that D6, D8 and D11 widen). Deprecated spellings (`dnd`, `oof`) keep working.
- **D3 — Conventions.** C-CLASS: every new enumerated prop renders its resolved value as `data-*` on the element that receives `className` (Avatar `data-size`, `data-shape`, `data-color`, `data-active`; AvatarGroup `data-layout`; Persona `data-size`, `data-text-position`, `data-text-alignment`, plus `data-presence-only`; Card `data-appearance`, `data-size`, `data-orientation`; TabList `data-appearance`, `data-size`, `data-orientation`; Carousel `data-appearance`, `data-controls-layout`; PresenceBadge `data-status`). New parts register class constants in the same change. New public symbols go through the barrels and `public-types.test.ts`. Hover/pressed classes use the literal `not-disabled:not-aria-disabled:hover:` gate (C-TOKENS). Logical utilities and `wave-rtl:` (C-LOGICAL). Compounds follow C-COMPOUND/C-PURE (flat names, `isElementOfType`, `asClientReference` tests).
- **D4 — Where a size or appearance is not an input's.** `CoreSize` (small, medium, large) is the type, but Card and TabList have their own dimension tables (Card: padding; Tab: padding and type); the JSDoc says which pixel sizes each means. `medium` is the 0.12 size for both.
- **D5 — Tokens.** The persona palette (D13) is the only token addition; its pairs are asserted in `tokens.test.ts` for every theme. Card appearances reuse existing tokens (`card`, `muted`, `subtle`, `border`, `stroke`).
- **D6 — One shared context for sizes inherited by a member.** `AvatarSizeContext` (internal; 16|20|24 box today) widens to `{ size: number; shape?: 'circular' | 'square' }`. Tag and InteractionTag keep providing the box and now also their shape (`rounded` → `square`), which closes the Phase 6 hand-off "square Avatars in rounded tags". AvatarGroup provides its `size` through a second internal context. An Avatar resolves: own `size`, else the group's, else the tag box, else `medium`. *(my call)*

---

## 2. P8-04 — PresenceBadge Fluent status names (first)

- `status?: PresenceStatus` becomes optional, default `'available'` (PresenceBadge only: Persona with no `status` still shows no badge).
- `PresenceStatus` = `'available' | 'busy' | 'away' | 'offline' | 'do-not-disturb' | 'out-of-office'` plus the deprecated `'dnd' | 'oof'` (kept in the union, documented with `@deprecated Use 'do-not-disturb'` in a comment on the alias type `DeprecatedPresenceStatus`; TypeScript cannot tag a union member). `normalizePresenceStatus(status)` (module-only, in `PresenceBadge.tsx`) maps the aliases; `warnDeprecated('PresenceBadge', "status 'dnd'", "'do-not-disturb'")` (and `oof`) runs once during render; removal in 1.0 (P14-02).
- Both spellings render the same glyph, class and name; `data-status` renders the normalized value; the icons (`PresenceDndIcon`, `PresenceOofIcon`) and the English `statusLabels` keys are keyed by the new names.
- Tests: both spellings equal in DOM, the warning once per alias, type tests (`expectTypeOf` for the widened union and the optional prop), `status` omitted. Stories `DND`/`OOF` are renamed to the new values; the old spellings stay in one test.

---

## 3. P8-01 — Avatar

### 3.1 API

| Prop | Type | Default | Notes |
|---|---|---|---|
| `shape` | `'circular' \| 'square'` | the tag's (D6), else `'circular'` | `square`: `rounded-md` from 40px up, `rounded-sm` below (C-RADIUS) |
| `size` | `Size \| AvatarNumericSize` | as today (D6) | `AvatarNumericSize` = `16 \| 20 \| 24 \| 28 \| 32 \| 36 \| 40 \| 48 \| 56 \| 64 \| 72 \| 96 \| 120 \| 128` |
| `color` | `'neutral' \| 'brand' \| 'colorful' \| AvatarNamedColor` | `'brand'` | `neutral` = `bg-muted text-muted-foreground`; `brand` = today's `bg-primary text-primary-foreground`; `colorful` hashes `idForColor ?? name` into the named colors (a missing id and name → `brand`) |
| `idForColor` | `string` | — | stable color for the same entity |
| `active` | `'active' \| 'inactive' \| 'unset'` | `'unset'` | `active`: a ring in the primary color; `inactive`: reduced opacity (both with a `motion-reduce:` variant) |
| `activeAppearance` | `'ring' \| 'ring-shadow' \| 'shadow' \| 'glow'` | `'ring'` | |
| `initials` | `Slot<'span'>` | computed from `name` | content slot (C-SLOTS); `aria-hidden`; `slotRendersContent` decides whether it renders |

- **Numeric sizes (my call).** Tailwind cannot make arbitrary sizes at runtime, so the 14 numeric sizes are a literal map of class strings (`size-4` … `size-32`, with the type step per size), and the five named sizes stay what they are (24, 32, 40, 48, 56). A size outside the union is a type error. `PresenceBadge` and the Avatar `badge` size derive from the pixel size (D3.3).
- **Named colors (my call).** `AvatarNamedColor` = `'red' | 'pumpkin' | 'gold' | 'forest' | 'teal' | 'blue' | 'navy' | 'lavender' | 'purple' | 'magenta' | 'brown' | 'steel'` (12 of Fluent's 30; more can be added without a breaking change). Tokens `--wave-palette-<name>` and `--wave-palette-<name>-foreground` in the three themes, mapped in `@theme inline` (`bg-palette-red text-palette-red-foreground`); the high-contrast theme maps every pair to the theme's own pair plus a border. `colorful` hashes into this list with a stable string hash (the same input gives the same color across runs and the server).
- **Initials.** A public, server-safe `getInitials(name: string, options?: { dir?: 'ltr' | 'rtl'; firstInitialOnly?: boolean }): string` in `src/lib/initials.ts`, exported from the entry. Rules: text in `()`, `[]`, `{}`, `<>` is dropped; punctuation and symbols are dropped; a name that is only digits and phone punctuation gives `''`; a name in a script without letter initials (Han, Hiragana, Katakana, Hangul, Thai, Lao, Khmer, Myanmar, Tibetan) gives `''`; otherwise the first letter of the first word and, with two or more words, of the last word, upper-cased (`'Jane Doe (Contoso)'` → `'JD'`); `firstInitialOnly` keeps the first; in RTL the two initials swap. Avatar passes `dir` from `useDirection`. `''` shows the person glyph, as today. *(the script rule is my call: the sketch says "non-Latin scripts", which would also blank Cyrillic, Greek and Arabic names that do have initials)*
- **Badge.** The badge slot is sized from the avatar (a PresenceBadge or Badge inside it without its own `size` reads an internal `AvatarBadgeSizeContext`: ≤ 24px → `extra-small`, ≤ 32px → `small`, ≤ 56px → `medium`, ≤ 96px → `large`, else `extra-large`). It is **not** merged into the avatar's name: the badge stays a sibling that keeps its own `role="img"` name (merging would nest two `img` roles; this closes the sizing half of `avatar-7` only). *(my call; recorded in §9)*
- **Guards.** Image failure detection before hydration (`useLayoutEffect` + `decode()`), unchanged; the accessible-name modes (image alt, `role="img"` label, decorative), unchanged.

### 3.2 Tests
`getInitials` table tests (brackets, punctuation, phone numbers, CJK/Thai gives `''`, Cyrillic/Arabic keeps initials, RTL swap, `firstInitialOnly`, surrogate pairs, one word, empty); Avatar: each prop's `data-*`, numeric sizes class map, `colorful` determinism (same `idForColor`, same color; different ids spread), the badge size by avatar size, `initials` slot forms (string, element, empty → computed), `active`/`activeAppearance` classes, square in a rounded Tag, shape/size resolution order, RTL initials swap, axe for every color (contrast is asserted on the tokens, not by axe). `tokens.test.ts`: 12 pairs × 3 themes ≥ 4.5:1.

---

## 4. P8-02 — AvatarGroup (compound)

- `AvatarGroup` becomes a compound (`Object.assign`) with `AvatarGroup.Item` and `AvatarGroup.Popover` (flat `AvatarGroupItem`, `AvatarGroupPopover`) and a server-safe helper `partitionAvatarGroupItems<T>({ items, maxInlineItems, layout }): { inlineItems: T[]; overflowItems: T[] | undefined }` (layout `pie` allows at most 3 inline items).
- **Props of the root:** `layout?: 'stack' | 'spread' | 'pie'` (default `'stack'`, the 0.12 look; `data-layout`); `size?: Size | AvatarNumericSize` reaches the members (D6) and the overflow trigger; `max?: number` (automatic partition, unchanged semantics) ; `overflowIndicator?: 'count' | 'icon'` (default `'count'`); the count is capped: more than 99 shows `99+` (the accessible name keeps the real number); `open?`, `defaultOpen?`, `onOpenChange?(open, details?)` with `OpenChangeDetails<DismissReason | 'trigger'>` (C-NAMING). `overflowLabel` and `unnamedMemberLabel` stay.
- **Layouts.** `stack`: the 0.12 overlap (`-ms-*`, ring). `spread`: members side by side with a gap. `pie`: one circle (default size `large`) of clipped wedges, at most 3 members; the group's `aria-label` names it; an inline member of a pie is `aria-hidden` (the group is the one named object). All use logical utilities.
- **`AvatarGroup.Item`:** takes `AvatarProps`; inline it renders an `Avatar`; in the overflow list it renders an avatar and the name as a row (`avatargroup-5`). Direct `Avatar` children keep working as in 0.12 (their name comes from `getMemberName`, unchanged, with the `AvatarGroup:unnamed-member` warning).
- **`AvatarGroup.Popover`:** the overflow trigger and surface as a part, for consumers that partition themselves (`partitionAvatarGroupItems`); the root's automatic overflow renders the same part. The 0.12 popup behaviour is the contract: `role="dialog"`, Escape and outside-press dismissal (`useDismiss`, `useRestoreFocus` with `onlyIfFocusInside`), the custom Tab handling at the ends of the list, the iframe-realm and enclosing-focus-trap cases.
- **Tests:** layouts' classes and `data-layout`; size reaches members and trigger; `99+` cap and the unchanged label; `icon` indicator; controlled and uncontrolled `open` with details once in StrictMode; the overflow list shows avatars with names; `partitionAvatarGroupItems` table tests; compound exposure and `asClientReference`; every 0.12 popup test unchanged; axe in each layout and with the popup open.

---

## 5. P8-03 — Persona

- **Props:** `name?: string` (no longer required; it still feeds the Avatar's initials and image alt); `primaryText?`, `secondaryText?`, `tertiaryText?`, `quaternaryText?`: `Slot<'span'>` (a string still works, so 0.12 calls are unchanged; `primaryText` defaults to `name`); `textPosition?: 'after' | 'before' | 'below'` (default `'after'`); `textAlignment?: 'start' | 'center'` (default `'start'`, `'center'` for `below`; `data-text-alignment` renders the resolved value); `presenceOnly?: boolean` (default `false`: the presence badge replaces the Avatar, the text stays, with its position and alignment); `size?: PersonaSize` = `Size | 'huge'` (default `medium`); `huge` is a 72px Avatar. The text scales with the size: a literal map per size of the primary and secondary type steps (medium unchanged: `text-body-1`/`text-caption-1`).
- **Layout:** `flex` with `flex-row` (after), `flex-row-reverse` (before: logical, mirrors in RTL by itself) and `flex-col items-center` (below). Positions never use physical utilities.
- **Announcement guard.** The root still carries no label: the built-in Avatar is decorative, the text lines are plain text in reading order, and the status badge keeps its own name, so the persona reads once (name, then lines, then the status). With `presenceOnly` the badge is the only image. A custom `avatar` slot stays the consumer's responsibility. A Persona with neither `name` nor `primaryText` warns once (`Persona:unnamed`).
- **Tests:** each line renders only when given; position/alignment `data-*` and classes; `presenceOnly`; `huge`; text scale map; RTL (`before`/`after` swap on screen order, logical corner of the badge); announced-once test (an accessible-name query finds the name exactly once, plus a status image); 0.12 string props unchanged; the `Tree.itemPersonaLayout` suite unchanged.

---

## 6. P8-07 — TabList

- **TabList props:** `appearance?: 'transparent' | 'subtle' | 'subtle-circular' | 'filled-circular'` (default `'transparent'`, today's underline); `size?: CoreSize` (default `'medium'`, today's `px-4 py-2 text-body-1`; `small` and `large` step the padding and type). `data-appearance`, `data-size` and `data-orientation` render on the tablist element. Both reach the tabs through `TabListContext` (and `INERT_CONTEXT`).
- **Looks.** `transparent`: the selected indicator is the border today (`border-b-2`/`border-s-2`), now with `forced-colors:border-[Highlight]`. `subtle`: selected = `bg-subtle-selected`, hover `bg-subtle-hover`, pressed `bg-subtle-pressed` (gated), no underline except a `forcedColors` outline. `subtle-circular`: the same, fully rounded. `filled-circular`: selected = `bg-primary text-primary-foreground`, unselected `bg-muted`, fully rounded, with the gap between tabs. In forced colors the selected tab of every appearance keeps a visible mark through `forcedColors.selectedContainer` (an outline), since fills are dropped. The container's bottom border applies to `transparent` only.
- **Tab `icon?: Slot<'span'>`** (`renderSlot(icon, 'span', base, { 'aria-hidden': true })`, before the text). With an icon and no children the tab is icon-only: square hit area (`data-icon-only`), and a tab without text, `aria-label` or `aria-labelledby` warns once from an effect (`TabList.Tab:icon-only-name`).
- **Guards:** the selection model, `selectTabOnFocus`, roving, ids and the `TabList.Panel`/`Panels` placement (a wrapper element must not move the panels); the deprecated aliases.
- **Tests:** per appearance and size classes and `data-*`; the forced-colors class on the selected tab for each appearance; icon slot forms, icon-only layout and its warning; RTL and vertical per appearance; the memoized-by-content test still holds with the new context fields; all 0.12 suites.

---

## 7. P8-05 — Card

- **Card props:** `appearance?: 'filled' | 'filled-alternative' | 'outline' | 'subtle'` (default `'filled'`, today: `bg-card`, border, `shadow-4`); `size?: CoreSize` (default `'medium'`: the parts' padding, via the variable `--wave-card-padding` the root sets from the size: small 0.75rem, medium 1rem (today's `p-4`), large 1.25rem); `orientation?: Orientation` (default `'vertical'`); `data-appearance`, `data-size`, `data-orientation` on the root.
- **Appearances.** `filled-alternative`: `bg-muted`, no shadow; `outline`: transparent, `border-border`, no shadow; `subtle`: transparent, no border, no shadow. A selectable card (the `onSelect` patterns) gets hover and pressed fills per appearance through the gated classes; the selected look (`border-primary bg-selected ring-1 ring-inset ring-primary`, `forcedColors.selectedContainer`) is unchanged for every appearance. Contrast per appearance is asserted for the text on each fill.
- **`Card.Header`:** `image?: Slot<'span'>`, `action?: Slot<'span'>` (a menu button, say); the existing `title` and `subtitle` stay (`subtitle` is Fluent's `description`: no second prop, §9). With an image the header is a grid of image, text and action; without either it is as in 0.12.
- **`Card.Preview`** (new part, flat `CardPreview`, polymorphic `'div'`): edge-to-edge media (no padding); `logo?: Slot<'span'>` places a logo over its bottom-start corner. In a horizontal card it sits at the start edge, full height.
- **`checkbox?: Slot<'input'>`** (with `selectionControl="checkbox"`): an object merges its props onto the built-in native checkbox (class, aria; `as` is not accepted); `null`/`false` removes the built-in control and the consumer supplies a control that calls `onSelect`. The default is the 0.12 checkbox, same name rules (`aria-labelledby` the title, or `selectLabel`).
- **`floatingAction?: Slot<'span'>`:** a container at the top end corner for an action (`end-3 top-3`). When a checkbox is also shown, the checkbox moves to the top start corner; the 0.12 position (top end) is unchanged without a floating action.
- **Guards:** the two 0.12 selection patterns, their roles, keys (Enter on keydown, Space on keyup), nested-interactive warning, portal-event filtering and `as="button"`; `Card.Body` stays.
- **Tests:** appearance and size classes and `data-*`; padding variable per size; horizontal layout; Preview and logo; Header image/action and the title id wiring; checkbox slot forms; floating action and the checkbox's corner; all 974 lines of 0.12 tests; axe and forced colors per appearance (class assertions: jsdom has no forced colors).

---

## 8. P8-06 — Carousel

### 8.1 Index model with groups (D7)
`groupSize?: number | 'auto'` (default `1`). The index stays a **slide index**: `value`/`defaultValue`/`onValueChange(index)` refer to the **first slide of the page**. The effective index is clamped as today and, with `groupSize` = n, snapped down to the start of its page (value 4, n = 3 → 3; the last page may be shorter). `onValueChange` emits page starts. `'auto'`: slides keep their own width, the page is as many slides as fit the viewport (measured with a `ResizeObserver` read through `useSyncExternalStore`), and prev/next move by that count; `align?: 'start' | 'center' | 'end'` (default `'start'`) places the page in the viewport when the slides do not fill it. The picker has one button per page; looping, the end buttons, autoplay and the `endedAt` rule count pages. *(my call: the sketch leaves the model open)*

### 8.2 Semantics
Every slide stays `role="group"` `aria-roledescription="slide"` with its label; all slides of the active page are exposed (not `inert`, not `aria-hidden`), the rest as in 0.12. `labels` gains `slides(start, end, total)` (default ``Slides ${start} to ${end} of ${total}``) used for the page's picker button, the live region and, with `groupSize` > 1, nothing else changes; `labels.slide` still names a single slide. With `groupSize` 1 nothing is different from 0.12.

### 8.3 Dragging
`draggable?: boolean` (default `false`), hand-rolled on pointer events following ColorArea (primary button only, `isOwnEvent`, `setPointerCapture`, composed handlers), no dependency. The track gets `touch-action: pan-y`; while dragging, `data-dragging` is set and the transition is off (the track follows the pointer in px); on release the page changes when the drag passed 25 % of the viewport width or the release speed passed 0.5 px/ms in that direction, else it snaps back; direction follows the resolved `dir` (RTL drags mirror); the click that ends a drag is swallowed (capture-phase handler); keyboard, buttons, the picker and the rotation control are unaffected; dragging pauses autoplay like hover does. Touch, pen and mouse (`it.each`).

### 8.4 Thumbnails, controls, appearance, focus group
- **Thumbnails:** `Carousel.Item thumbnail?: Slot<'img'>` (a string is the `src`). When any item has one, the picker buttons show it (alt `''`: the button keeps its slide-label name) instead of the dot. One mechanism; there is no separate `NavImageButton` part (§9).
- **`controlsLayout?: 'overlay' | 'inline' | 'overlay-wide' | 'inline-wide'`** (default `'overlay'`, today's look; `data-controls-layout`): `overlay-wide` makes the overlay buttons full-height edge strips; `inline` puts previous/next in a row with the viewport, outside the slides; `inline-wide` is `inline` with full-height buttons. The rotation control stays the first focusable element at the same corner in every layout.
- **`Carousel.Button`** (flat `CarouselButton`): `direction: 'previous' | 'next'` (not `navType`: C-NAMING and the native-attribute rule); a standalone button placed as a direct child of `Carousel`, rendered where it is written, disabled and named as the built-in ones (`labels.previous`/`next`, `aria-controls`, `focusableDisabledProps`). When a `Carousel.Button` of a direction is present, the built-in button of that direction is not rendered. It reads the root's context (C-CONTEXT: null default, `reportMissingContext('Carousel.Button', 'Carousel')`). Registered constant `carouselButtonClassNames`.
- **`appearance?: 'flat' | 'elevated'`** (default `'flat'`; `elevated`: `rounded-md shadow-4`; `data-appearance`).
- **Focus group (`car-6`):** with `groupSize` above 1 or `'auto'`, the slides of the active page form one roving group (`useRovingTabIndex`, horizontal, RTL-aware): arrow keys move focus between them, and an arrow past the end of the page changes the page and focuses its first slide; with `groupSize` 1 there is no key handling (0.12).

### 8.5 Guards and tests
The APG rotation control (first focusable, labels, paused at start under reduced motion, pause on hover and focus), the clamped index, the `onValueChange`-only-on-change rule, RTL translate sign and mirrored chevrons, inert inactive slides. Tests: group sizes 1/3/`'auto'` (a `ResizeObserver` mock with stubbed widths: `installResizeObserverMock`), snapping and clamping tables, labels, page picker, autoplay and loop by page, drag with `it.each(['mouse','touch','pen'])` (pointer-capture stubs, `mockRect`), threshold and snap-back, swallowed click, RTL drag direction, thumbnails, the four layouts' DOM order and rotation-control position, `Carousel.Button` replacing the built-in, `appearance`, the focus group (arrows, page change, RTL), compound exposure, `asClientReference`, axe; the whole 0.12 file unchanged.

---

## 9. Where this spec departs from the roadmap's sketch

| Sketch | Spec | Why |
|---|---|---|
| Avatar `color` non-Latin scripts give no initials | only scripts without letter initials | Cyrillic, Greek, Arabic and the like have initials |
| Avatar badge "merged into the name" | sized from the avatar, **not** merged | merging nests two `img` roles; the sibling keeps its own name |
| Persona `name` optional with `primaryText` slot | as sketched, plus the `Persona:unnamed` warning | the announcement guard needs a name from somewhere |
| Card.Header `description?` | no new prop: `subtitle` is Fluent's `description` | two props for one line would diverge |
| Carousel `Carousel.NavImageButton` / `thumbnail` | `Carousel.Item thumbnail` only | one mechanism, no extra part or context |
| `Carousel.Button navType="prev" \| "next"` | `direction="previous" \| "next"` | C-NAMING (`navType` is not a convention name; `previous` matches `labels`) |
| `groupSize` index model open | slide index of the page start, snapped (D7) | keeps `value` a slide index |
| Card `checkbox?: Slot<'span'>` | `Slot<'input'>` | the built-in control is a native input |

## 10. Packages, gates and bookkeeping

| Step | Content | Main files |
|---|---|---|
| 1 | P8-04 | `PresenceBadge.tsx`, `lib/types.ts`, `lib/icons.tsx`, stories/tests |
| 2 | P8-01 | `Avatar.tsx`, `Avatar.context.ts`, `lib/initials.ts`, `tokens.css`, `tokens.test.ts`, `Tag.tsx`, `InteractionTag.tsx` |
| 3 | P8-02 | `AvatarGroup.tsx` (+ parts), `AvatarGroup.partition.ts` |
| 4 | P8-03 | `Persona.tsx` |
| 5 | P8-07 | `TabList.tsx` |
| 6 | P8-05 | `Card.tsx` (+ `Card.preview.tsx`) |
| 7 | P8-06 | `Carousel.tsx` (+ `Carousel.drag.ts`, `Carousel.button.tsx`, `Carousel.context.ts`) |
| 8 | INTEGRATION | barrels and flat names, class registry, `public-types`, `verify-dist` probes (an import of only `getInitials` or `partitionAvatarGroupItems` holds no component), integration tests (Persona in Tree, Avatar in Tag, Card with Menu action, Carousel with Dialog) |
| 9 | DOCS | CHANGELOG, README, guide, ROADMAP, CLAUDE.md |
| 10 | Lead | `/gate`, real-browser checklist (drag, thumbnails, layouts, forced colors of Tab and Card appearances, RTL), release |

Each step ends green on its focused tests and the conventions gate; the registry constants and the pending lists keep every gate green while parts land (the Phase 7 pattern). No built-in motion beyond what exists (Phase 10). Commits per step, conventional subjects, no attribution trailer.

## 11. Backlog this phase leaves
Avatar named colors beyond 12; `presence-1,2,4`; Carousel `car-3`, `car-5`, `car-7`; Card `size` beyond padding; a TagGroup/Tab size inheritance; tabs inside a Card header.

## 12. Calls to check while reading
D1 (order), D6 (shared contexts and the tag shape hand-off), the 12 named colors and the high-contrast rule, the script rule of `getInitials`, badge sized but not merged, `Persona` `textAlignment` default for `below`, Card `subtitle` as the description, Card checkbox moving when a floating action exists, Carousel's page-start index model and `'auto'` semantics, the drag thresholds (25 % / 0.5 px/ms), thumbnails through `Item thumbnail` only, and `direction` for `Carousel.Button`.
