# Phase 12 (0.17.0) Implementation Plan: theming API and charts strategy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an app re-brand WaveUI without forking it: typed token overrides on `WaveProvider` that reach portals, a seed-to-ramp brand generator that cannot break contrast, a typed `waveTokens` object, per-theme shadows, a wider palette and font set, and a documented charts strategy with runnable stories.

**Architecture:** Pure, server-safe modules in `src/lib` (`tokens`, `waveTokens`, `brand`); the provider merges overrides into one custom-property object that its root and every `Portal` wrapper apply as inline `style`; the CSS gains per-theme shadow tokens, two font stacks and 36 palette tokens per theme, all proved by the existing contrast matrices of `tokens.test.ts`; charts are guide text, `chartPalette` and two Storybook-only stories.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest + React Testing Library + vitest-axe, Vite library build. Dev dependencies only for the chart stories (Task 11); no new runtime dependency or peer.

**Spec:** `docs/superpowers/specs/2026-10-29-fluent-parity-phase-12-design.md` (rulings R1–R18, §1–§16). Read it and `CLAUDE.md` first; the spec wins where this plan is silent. Work in `.claude/worktrees/fluent-parity-phase-12` (branch `feat/fluent-parity-phase-12`); the `node_modules` junction exists. Run every command in the foreground. IDE diagnostics about missing jest-dom matchers or unresolved modules are stale noise: `npm run typecheck` is the arbiter.

## Global Constraints

- Version 0.17.0; CHANGELOG section `## [0.17.0] - Unreleased` above `## [0.16.0]` (added in Task 14; earlier tasks add nothing there).
- Nothing public is removed and every type only widens, except `WaveContextValue` (three new members, R17). Existing suites stay green unedited **except** assertions that pin the literal `--shadow-N` values or a Portal wrapper's exact `style`; each such edit is listed in spec §15 by the task that makes it, with the reason.
- R1: `theme` stays the closed union; `tokens` is a flat override map. R2: overrides are inline custom properties on the root and on portal wrappers: no `<style>` element, no nonce. R3: nested providers merge key by key, `null` clears, an inner `theme` keeps the outer overrides. R4: `applyStylesToPortals` (default true) controls only the **token overrides** on portals; theme classes and direction are always set.
- R5/R6: JavaScript token names are camelCase of the CSS name without `--wave-`; the provider converts with a rule and never imports the names tuple. R7/R8: `createBrandTokens` keeps the default ramp's luminance at every stop, so contrast holds by construction; a full `BrandRamp` passes through with a development check. R9: high contrast ignores the brand. R10: shadows are per-theme tokens, `--shadow-N` in `@theme inline` aliases them. R11: palette tokens `-tint`, `-tint-foreground`, `-border` (the fill and its foreground are unchanged). R12: scales are documented, not tokenised. R13: `font-wave-mono`, `font-wave-numeric`, `Text font`, `TextWeight` `'medium'`. R14: charts are guide, `chartPalette` and two dev-only stories. R15: high-contrast palette stays white. R16: `getTokenStyle` is public. R17: `WaveContextValue` gains `tokens`, `tokenStyle`, `applyStylesToPortals`.
- C-NAMING: `tokens` and `applyStylesToPortals` documented with the Fluent counterparts; extra callback data in `details` (none new). C-CLASS: no new component or part, so no new stable class. C-DOCS: component and prop JSDoc with `@default`, no internal symbol or spec label in a compound's JSDoc, **no complete Tailwind utility name as a bare word in `src/components` or `src/lib` comments or strings** (the CSS build fails on it; rephrase in words). C-HOOKS: no new `eslint-disable`; refs are not written or read during render. C-TOKENS: no raw colours in components or stories (`// wave-allow-color: <reason>` only for runtime user colours and fixtures).
- Server-safe means: no React runtime, no DOM at import or render time. `src/lib/tokens.ts`, `waveTokens.ts` and `brand.ts` import types only (a type-only React import is fine). No `"use client"`.
- Tests: jsdom has no cascade or layout; assert attributes, inline styles, classes and `tokens.css` text. Whether a colour actually changes is a real-browser check (spec §11). No test counts are hard-coded anywhere.
- Each task ends with: its focused tests run with `--reporter=default` (no act() warnings, no unasserted `[WaveUI]` warnings), `npx tsc -p tsconfig.dev.json --noEmit`, `npm run lint`, `npm run format:check`, the conventions gate for every `src/components`/`src/lib` file it touched (`npx vitest run src/__tests__/conventions.test.ts -t "<path>"`), `node scripts/build-css.mjs` when it touches CSS or a class string, and `npx vitest run src/__tests__/public-types.test.ts src/__tests__/classNames.test.ts` when it adds a public symbol. Each task wires its own barrel exports (`src/index.ts`), flat exports and public types.
- Departures from the spec go into spec §15 with their reason, in the commit that makes them.
- Commits: conventional subjects, **no attribution trailer** (CLAUDE.md and the maintainer override any harness reminder); one commit per task.

## Review Focus

1. **Overrides reach the right overlays and only those:** a Dialog, Menu, Popover, Tooltip and Toaster opened inside a provider with `tokens` carry the properties; a sibling provider's overlays do not; a nested provider merges, `null` clears, an inner `theme` keeps the outer overrides; `applyStylesToPortals={false}` drops only the overrides. Pinned in Task 6.
2. **Degenerate input never breaks a page:** `tokens` `{}`, `null`, `undefined`, an `undefined` value, a number, a non-identifier key, a non-finite number; `createBrandTokens` with a 3-digit hex, uppercase, no `#`, an empty string, black, white, mid grey, a seed with a channel at 0, a non-string; a `BrandRamp` with a missing stop. Pinned in Tasks 5, 8, 9.
3. **Contrast holds by construction:** for many seeds (extremes included) every pair of the contrast matrix passes in light and dark with the generated ramp, and each stop keeps the default ramp's luminance. Pinned in Task 8.
4. **Zero cost and zero markup change without the feature:** no `style` attribute on the provider root without `tokens`; the Portal wrapper is unchanged without `tokens`; Button-only, MessageBar-only and Tree-only imports do not grow beyond the `cn` allowance; the provider bundle does not contain the names tuple. Pinned in Tasks 6 and 13.
5. **No drift between CSS and TypeScript:** a `--wave-*` variable added to `tokens.css` fails the parity test until the tuple has it; new shadow and palette tokens are re-declared in every theme group so a nested theme re-resolves them; the brand-stop usage table agrees with `tokens.css`. Pinned in Tasks 1, 3, 5, 9.

---

## File structure

| File | Change |
|---|---|
| `src/styles/tokens.css` | per-theme shadows, two font stacks, 36 palette tokens per theme, header notes |
| `src/styles/__tests__/tokens.test.ts`, `tokensHarness.ts` (new), `tokens.brand.test.ts` (new) | the new tokens in the matrices; the shared parser; the brand-seed matrix |
| `src/lib/cn.ts` | recognise `font-wave-mono` and `font-wave-numeric` as font families |
| `src/lib/tokens.ts`, `waveTokens.ts`, `brand.ts` (new, server-safe) and their `__tests__` | the token core, the typed object, `chartPalette`, the brand generator |
| `src/components/provider/WaveProvider.tsx`, `src/components/portal/Portal.tsx` | `tokens`, `applyStylesToPortals`, context members, root and portal styles |
| `src/components/typography/Text.tsx`, `input/Label.tsx`, `input/fieldLabel.ts`, `src/lib/types.ts` | `font`, the `medium` weight |
| `src/index.ts`, `src/__tests__/*`, `scripts/verify-dist.mjs` | exports, public types, probes, budgets |
| `stories/WaveProvider.stories.tsx`, `Text.stories.tsx`, `Charts.stories.tsx` (new), `package.json` | stories and the dev-only chart libraries |
| `README.md`, `CHANGELOG.md`, `docs/WAVE-UI-GUIDE.md`, `docs/ROADMAP.md`, `CLAUDE.md`, `docs/testing-best-practices.md` | docs |

---

## Package A: CSS

### Task 1: per-theme shadows

**Files:** Modify `src/styles/tokens.css`, `src/styles/__tests__/tokens.test.ts`.

**Produces** (spec §5.1): `--wave-shadow-2`, `-4`, `-8`, `-16`, `-28`, `-64` in the light, dark and high-contrast groups; `@theme inline` maps `--shadow-N: var(--wave-shadow-N)` for the same six. Light values equal today's `--shadow-N` literals byte for byte. Dark and high contrast: the same offsets and blurs with ambient alpha `0.24` and key alpha `0.28` (`0 0 2px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.28)` for level 2; the blur and offset pairs of 4, 8, 16, 28, 64 are those of the light literals).

- [ ] **Step 1 (tests first):** in `tokens.test.ts` add a shadows block next to the other token groups: each of the three groups declares the six tokens directly (the file's "declared directly in the group" rule); the light values equal the 0.16 literals (copy them into the test as constants); each dark and high-contrast value equals the light value with the two alphas replaced; every dark ambient and key alpha is greater than the light one; `@theme inline` maps the six `--shadow-N` to `var(--wave-shadow-N)` and declares no literal shadow; the "re-declares derived variables" rule and the `--wave-` prefix rule include them. RED.
- [ ] **Step 2:** edit `tokens.css`: add the tokens to the three groups, replace the literals in `@theme inline`, update the header comment.
- [ ] **Step 3:** run the verification list; `node scripts/build-css.mjs` and `npm run build-storybook` (its `verify-storybook` step) stay green unedited.
- [ ] **Step 4: Commit** `feat(tokens): per-theme shadow tokens`.

### Task 2: font stacks and their utilities

**Files:** Modify `src/styles/tokens.css`, `src/lib/cn.ts`, `src/styles/__tests__/tokens.test.ts`, `src/lib/__tests__/cn.test.ts`.

**Produces** (spec §5.2): `:root` declares `--wave-font-family-monospace: Consolas, 'Courier New', Courier, monospace` and `--wave-font-family-numeric: Bahnschrift, 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif` (theme-independent, declared once, never in a theme group); `@theme inline` maps `--font-wave-mono` and `--font-wave-numeric` to them; `cn` treats `font-wave-mono` and `font-wave-numeric` as font families in the same group as `font-wave`.

- [ ] **Step 1 (tests first):** tokens: both declared once on `:root`, none in a theme group, mapped in `@theme inline`; cn: `cn('font-wave', 'font-wave-mono')` is `'font-wave-mono'`; `cn('font-wave-numeric', 'font-wave')` is `'font-wave'`; `cn('font-wave-mono', 'font-medium')` keeps both; `cn('font-wave-mono', 'font-bold')` keeps both. RED.
- [ ] **Step 2:** implement. Measure the Button-only import before and after (`npm run build` then `node scripts/verify-dist.mjs`): the growth must be at most the allowance of spec §10 (64 B minified, 32 B gzip); report the numbers in the task report.
- [ ] **Step 3:** verification list. **Step 4: Commit** `feat(tokens): monospace and numeric font stacks`.

### Task 3: palette tint, tint foreground and border

**Files:** Modify `src/styles/tokens.css`, `src/styles/__tests__/tokens.test.ts`.

**Produces** (spec §5.3, R11, R15): for each of the 12 hues (`red, pumpkin, gold, forest, teal, blue, navy, lavender, purple, magenta, brown, steel`) and each theme group: `--wave-palette-<hue>-tint`, `--wave-palette-<hue>-tint-foreground`, `--wave-palette-<hue>-border`. Light and dark: `-border` is declared as `var(--wave-palette-<hue>)`; `-tint` and `-tint-foreground` are hex values you derive (light: the fill mixed toward white for the tint, the fill darkened for the foreground; dark: the fill mixed toward black, the fill lightened). High contrast: `-tint` `#000000`, `-tint-foreground` `#ffffff`, `-border` `#ffffff` (declare `-border` as the fill's `var()` there too, which is white). The 0.16 fill and `-foreground` values are untouched.

- [ ] **Step 1 (tests first):** extend the matrices of `tokens.test.ts` so every new token is classified (the file fails on an unclassified colour token): `palette-<hue>-tint-foreground` is a bound text token on `['palette-<hue>-tint', 'background', 'card']` at 4.5:1 in all three themes; `palette-<hue>-border` is a non-text token with its reason, asserted at 3:1 on `background` and on `palette-<hue>-tint` (non-text contrast); `palette-<hue>-tint` is a surface; **the strong fill on `background` at 3:1** for all 12 hues in all three themes (the chart-series rule); a test that the 36 tokens exist per theme group and that high contrast uses only `#000000`/`#ffffff` for them. RED (the tokens do not exist).
- [ ] **Step 2:** derive the 48 light and 48 dark hex values with a throwaway script in the scratchpad (never in the repo): start from the fill, mix or shade, then adjust the foreground until the test passes with margin (aim for 4.6:1 or better, not the bare 4.5). Write them into `tokens.css`; add a header table comment listing the hues, the roles and the contrast rules.
- [ ] **Step 3:** verification list; `node scripts/build-css.mjs`. The Avatar, Badge and Tag components are not changed (spec §5.3).
- [ ] **Step 4: Commit** `feat(tokens): palette tints, tint foregrounds and borders`.

---

## Package B: TOKENS

### Task 4: share the token test harness

**Files:** Create `src/styles/__tests__/tokensHarness.ts`; modify `src/styles/__tests__/tokens.test.ts`.

**Produces:** the parser and resolver helpers now local to `tokens.test.ts` (`stripComments`, `parse`, `parseFile`, `declarations`, `selectorList`, `styleRules`, `ruleWithSelectors`, `declsMatching`, `merge`, `resolveValue`, `resolveToken`, `relativeLuminance`, `contrastRatio`, the theme-group lookups `themeDecls`/`rootConstants`/`resolved`, and the exported `THEMES`, `THEME_GROUPS`, `PROVIDER_SELECTORS`, `CssNode`/`Decls` types) are exported from the harness; `tokens.test.ts` imports them.

- [ ] **Step 1:** move the helpers **mechanically**: no assertion, name or constant that is not a helper changes; the diff of `tokens.test.ts` is deletions of moved code plus one import. **Step 2:** the whole suite of `tokens.test.ts` passes unchanged (count and names). **Step 3:** verification list (the harness is a test helper under `src/styles/__tests__`, covered by `tsconfig.dev.json`; `npm run typecheck` runs `check-ts-coverage`).
- [ ] **Step 4: Commit** `test(tokens): extract the token test harness`.

### Task 5: the token core, `waveTokens` and `chartPalette`

**Files:** Create `src/lib/tokens.ts`, `src/lib/waveTokens.ts`, `src/lib/__tests__/tokens.test.ts`, `src/lib/__tests__/waveTokens.test.ts`; modify `src/index.ts`, `src/__tests__/public-types.test.ts`, `src/test-utils.ts` only if a helper is needed.

**Interfaces — Produces** (spec §3; all server-safe):
```ts
// tokens.ts
export type WaveTokenName = (typeof WAVE_TOKEN_NAMES)[number];            // type-only import from waveTokens.ts
export type WaveTokens = { readonly [K in WaveTokenName]: string };
export type WaveTokenOverrides = { [K in WaveTokenName]?: string | number };
export type TokenStyle = React.CSSProperties & { [K in `--wave-${string}`]?: string };
export function getTokenStyle(overrides: WaveTokenOverrides | null | undefined): TokenStyle | undefined;
export function tokenVariable(name: string): string;                      // internal: 'paletteRedTint' -> '--wave-palette-red-tint'
export function mergeTokenOverrides(parent: WaveTokenOverrides, own: WaveTokenOverrides | null | undefined): WaveTokenOverrides;   // internal
export function collectTokenStyle(overrides: WaveTokenOverrides | null | undefined): { style: TokenStyle | undefined; invalid: readonly { key: string; reason: "name" | "value" }[] };   // internal, pure, never warns
// waveTokens.ts
export const WAVE_TOKEN_NAMES: readonly [...];                            // one `as const` tuple, grouped and commented like tokens.css
export const waveTokens: WaveTokens;                                      // waveTokens.primary === 'var(--wave-primary)'
export const chartPalette: readonly WaveTokenName[];                      // paletteBlue, palettePumpkin, paletteForest, paletteMagenta, paletteGold, palettePurple, paletteTeal, paletteRed, paletteSteel, paletteBrown, paletteLavender, paletteNavy
```
Rules: `tokenVariable` puts a hyphen before each capital letter and before a digit run that follows a letter, lowercases, and prefixes `--wave-`. `collectTokenStyle` is the pure core: it returns `style` `undefined` for nullish or empty input (after skipping `undefined` values); numbers become strings; key order follows the input; a key that is not a camelCase identifier (`/^[a-z][A-Za-z0-9]*$/`) is skipped and listed in `invalid` with reason `name`; a non-string, non-finite-number value is skipped and listed with reason `value`. It never warns (the provider calls it during render, and C-DEV forbids warning there). `getTokenStyle(overrides)` is `collectTokenStyle(overrides).style` and, being a plain function called outside component render (a Server Component, an `<html style>`), also calls `warnOnce` for each invalid entry: keys `tokens:name:<key>` and `tokens:value:<key>`, messages starting `getTokenStyle:`. `mergeTokenOverrides(parent, own)`: `own === null` gives `{}`; `undefined` gives `parent`; otherwise key by key, an `undefined` value inheriting the parent's. `waveTokens` is built from the tuple with `Object.fromEntries`; type it to the literal `'var(--wave-primary)'` by a type-level conversion if `tsc -p tsconfig.dev.json --noEmit` stays within +2 s of its current time, else to `` `var(--wave-${string})` `` (record which in spec §15).

- [ ] **Step 1 (tests first):** `tokens.test.ts`: `tokenVariable` for `primary`, `primaryForeground`, `brand80`, `brand160`, `paletteRedTintForeground`, `fontFamilyMonospace`, `shadow16`, `zOverlay`, `durationUltraFast`; `collectTokenStyle` for nullish, `{}`, all-`undefined`, a number, a string, order kept, a bad key and a bad value (listed in `invalid`, no warning logged); `getTokenStyle` for the same input (equal `style`; a bad key and a bad value each warn once, asserted exactly, nothing else logged); `mergeTokenOverrides` for `undefined`, `null`, key-by-key, an `undefined` key inheriting; `expectTypeOf` for the three types and a `// @ts-expect-error` for a misspelled key; a test that the module imports nothing at runtime except `lib/dev` (read the file and check its import lines). `waveTokens.test.ts`: the **parity test** (spec §3): using the harness of Task 4, every `--wave-*` declaration in the constants, the ramps and the three theme groups of `tokens.css` has a tuple entry whose `tokenVariable` is exactly that variable, and every tuple entry is declared somewhere; no duplicate names; `waveTokens[name] === 'var(' + tokenVariable(name) + ')'` for all; `chartPalette` has the 12 names, all in the tuple, in the order above, no duplicates, and each is a palette fill (`palette<Hue>`); `waveTokens` is frozen or `as const`-typed (assert a write is a type error). RED.
- [ ] **Step 2:** generate the tuple with a throwaway script in the scratchpad from `tokens.css` (grouped and commented in the file's order), then write the modules by hand. **Step 3:** wire `src/index.ts`: `waveTokens`, `chartPalette`, `getTokenStyle` and the types `WaveTokens`, `WaveTokenName`, `WaveTokenOverrides`, `TokenStyle`; update `public-types.test.ts`. The conventions gate treats `src/lib` as review-only: confirm by reading that nothing here has `"use client"`.
- [ ] **Step 4:** verification list. **Step 5: Commit** `feat(tokens): typed token object, token style and chart palette`.

---

## Package C: PROVIDER

### Task 6: `WaveProvider tokens`, `applyStylesToPortals` and the Portal

**Files:** Modify `src/components/provider/WaveProvider.tsx`, `src/components/portal/Portal.tsx`; create `src/components/provider/__tests__/WaveProvider.tokens.test.tsx`; modify `src/components/portal/__tests__/Portal.test.tsx` only if an assertion pins the wrapper's exact `style` (record in §15).

**Interfaces — Consumes:** Task 5 (`getTokenStyle`, `mergeTokenOverrides`, `WaveTokenOverrides`, `TokenStyle`). **Produces** (spec §4): props `tokens?: WaveTokenOverrides | null` and `applyStylesToPortals?: boolean` on `WaveProviderProps`; `WaveContextValue` gains `tokens: WaveTokenOverrides` (`{}` outside a provider), `tokenStyle: TokenStyle | undefined` and `applyStylesToPortals: boolean` (`true` outside); `DEFAULT_CONTEXT` updated. The root renders `style={tokenStyle || style ? { ...tokenStyle, ...style } : undefined}` (**no `style` attribute at all** when neither exists, so the 0.16 markup is identical); `tokenStyle` and `tokens` keep their identity while their content is equal (memoise on a signature string of the entries, so an inline `tokens={{ ... }}` does not re-render consumers). `Portal` always sets the theme classes and direction; with `applyStylesToPortals` true it also spreads `tokenStyle` before its own `position` and `zIndex`. The provider computes the style with `collectTokenStyle` (no warning during render) and reports `invalid` entries from an effect with `warnOnce` (keys `WaveProvider:tokens:name:<key>` and `WaveProvider:tokens:value:<key>`, messages starting `WaveProvider:`). JSDoc (C-DOCS) per spec §4.1: names Fluent's `theme` (a partial theme) and `applyStylesToPortals`, states R1, R3, R4 in words, notes that a brand ramp belongs to `createBrandTokens`, and the strict-CSP limit (§4.5) without a spec label.

- [ ] **Step 1 (tests first)**, all in `WaveProvider.tokens.test.tsx` unless noted (also: an invalid key and an invalid value each warn once from the provider, asserted exactly, and nothing logs during render): root style (properties present; no `style` attribute without `tokens`; the consumer's `style` wins a conflicting property; stable key order; `renderToString` carries the style); nesting (key-by-key merge; `null` clears; `undefined` and an `undefined` value inherit; an inner `theme` keeps the outer overrides; the inner root carries the merged map; updating the outer provider updates the inner); portals (a Dialog, a Menu, a Popover, a Tooltip and a Toaster each opened inside a provider with `tokens` render a wrapper whose `style` has those properties **and** keeps its `position` and `zIndex`; a nested provider's overrides reach its own overlay and not a sibling provider's; with no `tokens` the wrapper has no custom property; `applyStylesToPortals={false}` keeps classes and `dir` and drops the properties, and a nested provider inherits `false`, and `true` on the inner re-enables); `useWaveTheme()` exposes the three members and returns defaults outside a provider; the context value and `tokenStyle` keep their identity across a re-render with an equal inline map; StrictMode; RTL for a Portal under `{ dir: 'rtl' }` with tokens. Existing `WaveProvider.test.tsx` and `Portal` tests pass unedited. RED.
- [ ] **Step 2:** implement. **Step 3:** verification list, plus `npx vitest run src/components/overlays src/components/navigation src/components/feedback src/components/portal` (the overlay suites exercise the Portal everywhere) and the stories a11y gate for `Components/Provider`.
- [ ] **Step 4:** measure a Dialog-only import before and after (`npm run build`, `node scripts/verify-dist.mjs`): at most +1.0 KiB minified and +0.4 KiB gzip (spec §10); report the numbers, and if over, stop and report.
- [ ] **Step 5: Commit** `feat(provider): token overrides that reach portals`.

### Task 7: provider stories

**Files:** Modify `stories/WaveProvider.stories.tsx` (create it if the story file has another name; find it with `ls stories | grep -i provider`).

- [ ] **Step 1:** add three stories (defaults in `args`, render functions forward `args`, `fn()` callbacks, every story has an accessible name, tokens only): "Brand colour" (a provider with `tokens={{ brand80: ..., brand110: ... }}` ramp stops written as literal fixtures marked `// wave-allow-color: fixture`, showing Button, Link, Switch, ProgressBar and a selected row), "Nested accent with a dialog" (an outer provider and an inner one with a different `primary`; a button in the inner opens a `Dialog` with `defaultOpen` so the portal shows the accent; a second Dialog beside it in the outer provider shows the page's), "Portals without styles" (the same with `applyStylesToPortals={false}`). **Step 2:** `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Provider"`; `npm run build-storybook`.
- [ ] **Step 3: Commit** `docs(stories): token override stories for WaveProvider`.

---

## Package D: BRAND

### Task 8: `createBrandTokens`

**Files:** Create `src/lib/brand.ts`, `src/lib/__tests__/brand.test.ts`, `src/styles/__tests__/tokens.brand.test.ts`; modify `src/index.ts`, `src/__tests__/public-types.test.ts`.

**Interfaces — Consumes:** Task 4 harness, Task 5 types. **Produces** (spec §6.1, §6.2, server-safe, no DOM, no React):
```ts
export type BrandStop = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 150 | 160;
export type BrandRamp = Readonly<Record<BrandStop, string>>;
export type BrandTokens = { [K in `brand${BrandStop}`]: string };
export function createBrandTokens(seed: string | BrandRamp): BrandTokens;
```
The module holds `DEFAULT_BRAND_RAMP` (the 16 hex values of `--brand-N` fallbacks in `tokens.css`: `#061724 #082338 #0a2e4a #0c3b5e #0e4775 #0f548c #115ea3 #0f6cbd #2886de #479ef5 #62abf5 #77b7f7 #96c6fa #b4d6fa #cfe4fa #ebf3fc`) and, computed from it at module load or on first call, the 16 target relative luminances. Algorithm (R7): parse the seed (`#rgb` or `#rrggbb`, any case, a leading `#` required; anything else warns once, `createBrandTokens:seed`, and returns the default ramp as tokens); convert to OKLCH for hue `h` and chroma `c`; for each stop, find by binary search the OKLab lightness `L` such that the colour with hue `h` and chroma `min(c, gamutLimit(L, h))` has the stop's target relative luminance (to within one 8-bit step), clip to sRGB, round to hex. Chroma under a small epsilon yields a grey ramp. A `BrandRamp` argument is validated for 16 keys of valid hex (a missing or invalid stop warns once and falls back to that stop's default) and returned as tokens unchanged (Task 9 adds the contrast check). Output keys `brand10 … brand160`.

- [ ] **Step 1 (tests first):** `brand.test.ts`: the default ramp constant equals `tokens.css`'s `--brand-N` fallbacks (harness); `createBrandTokens('#0f6cbd')` is within 3 per channel of the default at every stop; for **at least 16 seeds** (`#0f6cbd`, `#ffd400`, `#00ff00`, `#ff00ff`, `#c43e00`, `#008080`, `#800080`, `#8b4513`, `#ffc0cb`, `#001f3f`, `#808080`, `#000000`, `#ffffff`, `#00ff7f`, `#F0F`, `#C43E00`) each stop's relative luminance equals the default's within 8-bit rounding and the ramp is monotonic in luminance; a grey seed yields equal channels; hex output is lower-case `#rrggbb`; an invalid seed (`''`, `'red'`, `'#12'`, `'#gggggg'`, a number cast to string, `null` cast) warns once with `createBrandTokens:seed` and returns the default as tokens; a `BrandRamp` passes through; a ramp with a missing or invalid stop warns once and uses the default for it; `createBrandTokens` is deterministic (equal output on two calls); the module has no runtime import except `lib/dev`. `tokens.brand.test.ts`: for the same seeds, build the ramp, override `--wave-brand-N` in the harness scopes (the `:root` constants), and run **the entire contrast matrix of `tokens.test.ts`** (text on surfaces, fills with foregrounds, strokes at 3:1, ring) in light and dark; high contrast is asserted to be unchanged (R9). To run the matrix without copying it, export the matrix builder from the harness: move the pair lists and the checking function of `tokens.test.ts` into `tokensHarness.ts` as `forEachContrastPair(theme, scopes, callback)` (mechanical move, no assertion edited) and call it from both files. RED.
- [ ] **Step 2:** implement the colour math (sRGB to linear to OKLab to OKLCH and back; about 60 lines) inside `brand.ts`; keep functions small and pure. **Step 3:** wire `src/index.ts` (`createBrandTokens` and the types `BrandStop`, `BrandRamp`, `BrandTokens`), public types.
- [ ] **Step 4:** measure a `createBrandTokens`-only import after Task 13's probe exists; for now assert in the report the size of `brand.ts` minified by `npm run build` (no React, at most 3 KiB gzip, spec §10). **Step 5:** verification list. **Step 6: Commit** `feat(brand): createBrandTokens with luminance-preserving ramps`.

### Task 9: checking a full brand ramp

**Files:** Modify `src/lib/brand.ts`, `src/lib/__tests__/brand.test.ts`.

**Produces** (spec §6.3): `checkBrandRamp(ramp: BrandRamp): void` (internal, development only), called by `createBrandTokens` when it receives a `BrandRamp`. A table in `brand.ts` lists every place a semantic token reads a brand stop, taken from `tokens.css` (`grep -n "var(--wave-brand-" src/styles/tokens.css`): per theme (light, dark), the semantic token, its stop, the colour it is read against (white, black, the surface tokens' resolved values copied as constants) and the minimum (4.5 for text, 3 for non-text). The check warns once per failing pair, `createBrandTokens:contrast:<theme>:<token>`, with the stop and the ratio ("stop 80 on #ffffff is 3.9:1; needs 4.5:1"). It never throws and never changes the ramp. The high-contrast theme is not checked (R9).

- [ ] **Step 1 (tests first):** the default ramp passes with no warning; a ramp with stop 80 set to a light colour warns once for each light pair that reads stop 80 (assert the exact messages and that nothing else logs); a ramp that fails only in dark warns only for dark; the warnings are development-only (`vi.stubEnv('NODE_ENV', 'production')` logs nothing); **the table agrees with `tokens.css`**: every `var(--wave-brand-N)` use inside the light and dark groups appears in the table and no table row names a stop its token does not read (parse with the harness); a generated ramp from any seed of Task 8 passes the check silently. RED. **Step 2:** implement. **Step 3:** verification list. **Step 4: Commit** `feat(brand): development contrast check for a given ramp`.

---

## Package E: TEXT

### Task 10: `Text font` and the `medium` weight

**Files:** Modify `src/lib/types.ts`, `src/components/typography/Text.tsx`, `src/components/input/Label.tsx`, `src/components/input/fieldLabel.ts` (only if it types the weight), `stories/Text.stories.tsx`; tests `src/components/typography/__tests__/Text.test.tsx`, `src/components/input/__tests__/Label.test.tsx`.

**Produces** (spec §7, R13): `TextWeight` is `'regular' | 'medium' | 'semibold' | 'bold'` (JSDoc updated); `TextOwnProps.font?: 'base' | 'monospace' | 'numeric'` (`@default 'base'`; `'monospace'` adds `font-wave-mono`, `'numeric'` adds `font-wave-numeric`, `'base'` adds nothing; JSDoc names Fluent's `font`); `weightClasses` gains `medium: 'font-medium'` in Text and in every other `Record<TextWeight, string>` (`grep -rn "TextWeight" src`). No `data-*` attribute is added. `Label` accepts `medium` wherever it accepts a weight.

- [ ] **Step 1 (tests first):** per `font` value the class; `font` unset renders no font-family class; a consumer `font-wave-mono` replaces a default `font-wave` and a consumer weight replaces the variant's; `weight="medium"` renders `font-medium` on Text and on Label; the deprecated numeric weights still work; stable class names unchanged; RTL not applicable; axe; `// @ts-expect-error` for an unknown `font`. RED. **Step 2:** implement; the CSS build must find `font-wave-mono`, `font-wave-numeric` and `font-medium` (run `node scripts/build-css.mjs` and check they are in `dist/styles.css`). **Step 3:** the story "Fonts and weights" (all `font` values and four weights); `stories.a11y` for `Text` and `Label`. **Step 4:** verification list. **Step 5: Commit** `feat(text): font families and the medium weight`.

---

## Package F: CHARTS

### Task 11: chart stories and the dev-only libraries

**Files:** Modify `package.json`, `package-lock.json`; create `stories/Charts.stories.tsx`.

**Produces** (spec §8.2, R14): `devDependencies` `recharts` and `chart.js` at exact versions (pick the newest stable versions at least two weeks old whose `peerDependencies` accept the repo's React; install with `npm install --save-dev --save-exact --allow-remote=all <pkg>` because npm 12.1.0 refuses lockfile writes otherwise; run `npm install-scripts ls` and approve nothing: if either package needs an install script, use the fallback below). A story file with title `Guides/Charts` (if the stories gate requires the `Components/` prefix, use `Components/Foundations/Charts` and record it) with two stories: **Recharts** (a bar chart, six series in `chartPalette` order using `waveTokens[name]` as `fill`, a pattern or marker as the second encoding, `role="img"` with `aria-label`, a description, and a visible or visually hidden `<table>` of the data) and **ChartJs** (a canvas chart whose colours are resolved with `getComputedStyle(root).getPropertyValue(...)` of each `chartPalette` variable, redrawn when the theme changes through a `MutationObserver` on the closest `[data-wave-theme]` element, with the same accessible name, description and table). Colours come only from tokens; chart text uses `foreground`. **Fallback (R14):** if a library does not support the repo's React or needs an install script, replace its story with a hand-built SVG bar chart and a note in the story and in spec §15; the guide still names the library.

- [ ] **Step 1:** install and pin; confirm `package.json` `files`/`exports` are untouched and the libraries are only in `devDependencies`. **Step 2:** write the stories; `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Charts"` must pass (a justified `a11y: { test: 'todo' }` only if the library's own markup fails, with a comment). **Step 3:** `npm run build-storybook` (watch the build time and size; report both), `npm run build` and `node scripts/verify-dist.mjs --final` (dist must hold neither library's name; Task 13 adds the permanent check). **Step 4: Commit** `docs(stories): charts with WaveUI tokens`.

---

## Package G: INTEGRATION and DOCS

### Task 12: guide, README and the scale tables

**Files:** Modify `docs/WAVE-UI-GUIDE.md`, `README.md`.

- [ ] **Step 1: guide.** §10 Theming: the provider's `tokens`, `applyStylesToPortals`, `createBrandTokens` (the luminance rule and the `BrandRamp` route), `waveTokens`, `getTokenStyle` (the Server Component example), the nesting rules (R3), per-theme `tokens` advice, the strict-CSP limit and the stylesheet route, high contrast ignoring the brand. §4 Color: the palette table (12 hues, fill, foreground, tint, tint foreground, border, with Fluent's names beside them). §5 Elevation: the per-theme shadow table; remove the sentence that dark shadows are less visible. §3 Typography: the two font families, `Text font`, the four weights. A **spacing, radius and stroke mapping table** (R12): Fluent's names and px values (spacing 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32; radius 0, 2, 4, 6, 8, 12, 16, 24, 32, 40, circular; stroke 1, 2, 3, 4) to Wave's Tailwind classes; **check each class name against Tailwind 4's documentation (context7) before printing it** and mark the sizes Tailwind's grid has no name for. A new chapter "Charts with WaveUI" after "Data at Scale" per spec §8.1 (the table of contents updated, the chapter number consistent with the existing numbering). Code examples in the guide are not scanned by the CSS build, but keep them correct.
- [ ] **Step 2: README.** A short "Theming" block: a brand colour in three lines (`createBrandTokens` into `tokens`), a nested accent, `waveTokens` in a chart, and the new hooks of the exports table.
- [ ] **Step 3:** `npm run format:check`, `node scripts/build-css.mjs`, `npm run lint`. **Step 4: Commit** `docs: theming, palette, shadows, fonts and charts for 0.17`.

### Task 13: integration, dist probes and budgets

**Files:** Modify `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `scripts/verify-dist.mjs` (+ `scripts/__tests__`).

**Produces:** (a) integration: `WaveProvider tokens` around a Field, a Dialog and a Menu together (the overlay wrapper carries the properties and the Field's control is unaffected), the Server Component regression for `getTokenStyle`, `createBrandTokens` and `waveTokens` (called from a module with no client boundary), `renderToString` of a provider with tokens inside a `Text font="monospace"`; (b) `verify-dist`: the new flat names present; `HOOK_PROBES_0_17`-style probes (an import of only `createBrandTokens` holds no React import and no component module, at most 3 KiB gzip; an import of only `waveTokens` holds no component module, at most 3 KiB gzip); an **exclusion probe** that a Dialog-only import holds no name of `WAVE_TOKEN_NAMES` (search for `paletteSteelTintForeground`) and no `brand160` seed code; a check that `dist` holds no `recharts` or `chart.js` string; the Button-only, MessageBar-only and Tree-only budgets stay byte-identical to the recorded 0.16 numbers except the `cn` allowance of spec §10 (at most +64 B minified, +32 B gzip each), and a Dialog-only import within +1.0 KiB minified and +0.4 KiB gzip of 0.16; `MODULE_ONLY_NAMES` gains `tokenVariable`, `mergeTokenOverrides` and `checkBrandRamp`.

- [ ] **Step 1:** write the tests and probes (RED where a probe cannot yet pass). **Step 2:** make them pass (fix any import that leaks the names tuple into the provider path). **Step 3:** `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run test:pack`. **Step 4:** record the measured sizes in spec §15. **Step 5: Commit** `test: integration, dist probes and bundle budgets for 0.17`.

### Task 14: release notes and project docs

**Files:** `CHANGELOG.md`, `docs/ROADMAP.md`, `CLAUDE.md`, `docs/testing-best-practices.md`, spec §15.

- [ ] **Step 1: CHANGELOG** `## [0.17.0] - Unreleased` above 0.16.0: "Upgrading from 0.16" first (spec §14 items 1 to 5, in words: the dark and high-contrast shadow change, the three context members, the fourth weight, everything else opt-in, the portal `style`), Added (`tokens`, `applyStylesToPortals`, `createBrandTokens`, `waveTokens`, `getTokenStyle`, `chartPalette`, `Text font`, the palette tints, the font families, per-theme shadows, the charts chapter and stories), Changed, Deprecated (none), Fixed (none), Size (the budgets measured in Task 13), and the gap ids closed (`foundation-1`, `foundation-3`, `foundation-5`, `foundation-6`, `foundation-7`, `foundation-8`, `foundation-11`, `foundation-12`, `foundation-46`, `text-3`, `text-4`). **Step 2: ROADMAP:** Phase 12 "Built as" (the departures: `-tint`, `-tint-foreground`, `-border` instead of `-background`; `applyStylesToPortals` drops only overrides; the luminance rule; Fluent's style-rule mechanism versus inline properties; the scales documented only), the Phase 12 status wording on release, and the open follow-ups. **Step 3: CLAUDE.md:** the lib list (`tokens`, `waveTokens`, `brand`), `WaveContextValue`, C-NAMING (the camelCase rule; `tokens`, `applyStylesToPortals`), C-TOKENS (the inline-style route), the barrel list, the testing notes (the harness, the brand matrix, provider token tests); **testing-best-practices:** a short note on the contrast-matrix harness. **Step 4:** `npm run format:check`, `node scripts/build-css.mjs`, `npm run lint`, `npm run build-storybook`; clean. **Step 5: Commit** `docs: theming API and charts strategy for 0.17`.

### After the last task (controller)

Final whole-branch review (most capable model), one fix dispatch and one scoped re-review for its findings, the exit gate (`/gate`), the real-browser pass over spec §11 (all three engines; the strict-CSP check recorded in spec §15 and the guide), then `superpowers:finishing-a-development-branch`. Release only on the maintainer's explicit go-ahead.

---

## Plan rulings

1. **Tasks are sequential and each wires its own exports** (the Phase 11 rule): every task ends green on its own.
2. **The spec's packages A–G map to Tasks 1–14**; A is Tasks 1–3, B 4–5, C 6–7, D 8–9, E 10, F 11, G 12–14.
3. **CSS before the typed object (A before B):** the names tuple is generated from the final `tokens.css`, so it is written once.
4. **The harness extraction (Task 4) and the matrix export (Task 8) are mechanical moves** reviewed as such: no assertion is edited.
5. **The cut line (spec §12) is after Task 10**: if the phase must shrink, Tasks 11 and the charts chapter of Task 12 become 0.17.x.
6. **Palette values are the builder's derivation, the tests are the arbiter** (Task 3): a value that passes with margin is correct whatever its source.
