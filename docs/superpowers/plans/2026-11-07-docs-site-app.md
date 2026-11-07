# WaveUI docs site (the app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `website/`, a pre-rendered Windows-style documentation app with a page for each of the 80 components, served at `brudvik.com/waveui/docs`, under hard performance limits.

**Architecture:** An Astro project that imports the library's own stories and renders them on the server with WaveUI, then hydrates examples as React islands when scrolled into view. The shell (title bar, navigation pane, command bar, status bar) is WaveUI markup rendered to static HTML, with its interactive parts loaded on idle or first use. A failing budget script keeps every page under the JavaScript limits.

**Tech Stack:** Astro and `@astrojs/react` (versions pinned by the spike), React 19, Tailwind 4 via `@tailwindcss/vite`, Storybook portable stories (`composeStory`), the TypeScript compiler API, Vitest, Playwright (website only).

**Spec:** `docs/superpowers/specs/2026-11-07-docs-site-design.md`. The intro page at `/waveui` is a separate plan (`2026-11-07-docs-site-intro-page.md`, homepage repository).

## Global Constraints

- All app URLs sit under `/waveui/docs`: components at `/waveui/docs/components/<slug>` (lower-case kebab of the component name, `data-grid`), plus `/waveui/docs/getting-started`, `/theming`, `/changelog`. Assets under `/waveui/docs/_assets/`.
- Under **150 KB gzipped of JavaScript** on first load for a component page (cold cache, no scrolling or interaction, shell included); everything a page can ever request stays under **250 KB gzipped**. An unavoidable exception is documented with its measured number, never raised silently.
- Lighthouse performance 95 or more on mobile and zero layout shift (run by hand at launch). Pages are pre-rendered static HTML; the nav, text, code and a static preview of each example work with scripts off.
- No iframes, no web fonts (system font stack only), no analytics, no editable playground, 1.x only, no Microsoft logos, wallpapers or Segoe UI files.
- A page imports only the stories it shows. Stories the site cannot render are named, with a reason, in `website/skipped-stories.json`; the build fails for an unrendered story that is not listed.
- The status bar shows only build-measured facts (production import size from `dist` by the method of `scripts/verify-dist.mjs`, and the library version).
- Theme and `dir` are set before first paint by a tiny inline script; static markup defaults to light and left to right. Storage is read and written inside `try/catch`.
- Window controls: close links to `/waveui`; maximize toggles a centered window against full width; no minimize. Right to left mirrors the chrome.
- `website/` must not change the published tarball, `check:package`, `test:pack`, the `verify-dist` budgets or the 1.x public API.
- WCAG AA, keyboard-complete, `prefers-reduced-motion` and `forced-colors` honoured.
- Repository rules: conventional-commit subjects, no AI attribution in commits, branches created only with `git worktree add`.

## Review Focus

The spec implies these; each has a test in the task named in brackets.

1. Assets or links that work on the app's own URL but 404 behind the homepage rewrite (absolute paths, trailing slashes, the base path). [Task 12]
2. A story that touches `window`, `document` or a Storybook-only API while rendering on the server, crashing the whole build or one page. [Tasks 3, 9]
3. A stored dark or right-to-left choice causing a flash of the wrong theme or a hydration mismatch; storage blocked or scripts off. [Task 6]
4. The heaviest pages (DataGrid, Calendar, Charts-like pages) exceeding the JavaScript limits without anyone noticing. [Task 12]
5. A component whose JSDoc or props are missing or odd (compound parts, polymorphic `as`) producing an empty or wrong props table. [Task 5]

## File Structure

`website/` (npm workspace, private):
- `package.json`, `astro.config.mjs` (base `/waveui/docs`, `build.assets: '_assets'`, `trailingSlash: 'never'`, file format), `tsconfig.json`, `vitest.config.ts`, `vercel.json`, `README.md`, `skipped-stories.json`
- `src/catalog/catalog.ts` — the 80 components from story titles
- `src/stories/` — `storybook-test-shim.ts` (alias for `storybook/test`), `runtime.ts` (portable stories), `source.ts` (story source text)
- `src/docs/` — `props.ts` (props extraction), `sizes.ts` (import sizes), `changelog.ts`
- `src/theme/` — `themeChoice.ts`, `themeInit.ts`
- `src/shell/` — `TitleBar.tsx`, `NavPane.tsx`, `CommandBar.tsx`, `StatusBar.tsx`; `src/layouts/AppLayout.astro`
- `src/islands/` — `ShellControls.tsx`, `Example.tsx`, `Controls.tsx`, `SearchPalette.tsx`
- `src/pages/` — `components/index.astro`, `components/[slug].astro`, `getting-started.astro`, `theming.astro`, `changelog.astro`
- `scripts/` — `check-budget.mjs`, `check-skipped.mjs`; `tests/` next to each unit, `e2e/` for Playwright

---

### Task 1: Spike — prove the stack and record go/no-go

**Files:**
- Create: `website/` minimal Astro project, `website/SPIKE.md`

**Interfaces:**
- Produces: the pinned versions of Astro, `@astrojs/react` and Vite used by every later task; the verdict on each question below.

- [ ] **Step 1: Scaffold `website/` with Astro, `@astrojs/react` and `@tailwindcss/vite`; add it to the root `workspaces`.** Run `npm install` at the root and check `npm run typecheck`, `npm run lint` and `npm test` at the root still pass unchanged.
- [ ] **Step 2: One page renders `Button` (from `../../src`) on the server and one `client:visible` island renders the `Default` story of `stories/Button.stories.tsx` through `composeStory`**, with `storybook/test` aliased to a stub (`fn = () => () => {}`) and `.storybook/preview.tsx`'s `WaveProvider` decorator supplied as project annotations.
- [ ] **Step 3: Build and measure.** Verify: the page works with scripts off; no second copy of React in `dist` (one `react-dom` chunk); first-load JavaScript gzipped; the library's styles load with the right `wave:` prefix (either `dist/styles.css` or the Tailwind plugin path that `.storybook/preview.css` uses).
- [ ] **Step 4: Write `website/SPIKE.md`** with pinned versions and a verdict for: Astro and the root's Vite 8 coexist; stories import without Storybook runtime; first-load JavaScript for the Button page is at most 110 KB gzipped; no duplicate React. If any is "no", record the fallback (another static generator named in the spec's "Architecture") and stop for review before Task 2.
- [ ] **Step 5: Commit** `feat(website): scaffold the docs site and record the stack spike`.

### Task 2: Workspace integration and scripts

**Files:**
- Modify: root `package.json` (scripts `site:dev`, `site:build`, `site:test`, `site:check`), `.gitignore` (`website/dist`, `website/.astro`), root `vitest.config.*` (exclude `website/**`), `.github/workflows/ci.yml` (a `website` job: build the library, `npm run site:build`, `npm run site:test`, `npm run site:check`)
- Test: root `npm test` and `npm run build` unchanged

**Interfaces:**
- Produces: `npm run site:build` (builds `website/dist`; requires the library's `dist` to exist, so it runs `npm run build` first when absent).

- [ ] **Step 1: Write the failing check:** `npm run site:build` fails with "unknown script".
- [ ] **Step 2: Add the scripts, ignores, the root Vitest exclusion and the CI job.**
- [ ] **Step 3: Verify** `npm run site:build`, root `npm test` and `npm pack --dry-run` (the tarball lists no `website/` file).
- [ ] **Step 4: Commit** `build(website): add the site scripts and a CI job`.

### Task 3: Component catalog

**Files:**
- Create: `website/src/catalog/catalog.ts`; Test: `website/src/catalog/catalog.test.ts`

**Interfaces:**
- Produces: `export interface ComponentEntry { slug: string; name: string; category: string; title: string; storyFile: string; storyNames: string[]; exportName: string }` and `export function getCatalog(): ComponentEntry[]` (sorted by category then name). `storyFile` is relative to the repo root; the titles are the stories' `meta.title` values beginning `Components/`.

- [ ] **Step 1: Failing tests:** `has exactly 80 components`; `slugs are unique lower-case kebab` (`data-grid`, `button`); `every storyFile exists`; `every entry has at least one story`; `categories are Button, Data Display, Feedback, Input, Layout, Motion, Navigation, Overlays, Provider, Table, Typography`; `no title outside Components/ is listed`.
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement** `getCatalog` by reading `stories/*.stories.tsx` with the TypeScript compiler API (title string literal and named story exports); one entry per `Components/<Category>/<Name>` title. `exportName` comes from the file's `component:` identifier.
- [ ] **Step 4: Run, see them pass. Commit** `feat(website): list the 80 components from the story titles`.

### Task 4: Storybook shims and the story runtime

**Files:**
- Create: `website/src/stories/storybook-test-shim.ts`, `website/src/stories/runtime.ts`; Modify: `website/astro.config.mjs` (alias `storybook/test` to the shim); Test: `website/src/stories/runtime.test.tsx`

**Interfaces:**
- Consumes: `ComponentEntry` (Task 3).
- Produces: `export function loadStory(entry: ComponentEntry, storyName: string): Promise<ComposedStory>` where `ComposedStory = { Component: React.ComponentType<Record<string, unknown>>; args: Record<string, unknown>; argTypes: Record<string, unknown>; name: string }`, and `export const projectAnnotations` carrying the `WaveProvider` decorator that reads the site's theme and `dir`.

- [ ] **Step 1: Failing tests:** `renders the Button Default story to a button element on the server` (`renderToString`); `uses the shimmed fn without importing @storybook/test internals` (the built chunk list has no `@testing-library`); `every story of every catalog entry renders on the server or is listed in skipped-stories.json` (loop over `getCatalog()`, `renderToString` each, collect failures and assert the set equals the listed names).
- [ ] **Step 2: Run, see them fail.** Step 3: implement with `composeStory(story, meta, projectAnnotations)`; the shim exports `fn`, plus no-op `expect`, `userEvent`, `within`, `waitFor` so `play` functions import but are never run.
- [ ] **Step 4: Seed `website/skipped-stories.json`** (`[{ "story": "<file>#<Export>", "reason": "<why>" }]`) with the failures found; expect it to be short.
- [ ] **Step 5: Commit** `feat(website): render the library's stories on the server`.

### Task 5: Docs extraction (description, props, parts, classes, source)

**Files:**
- Create: `website/src/docs/props.ts`, `website/src/stories/source.ts`; Test: `website/src/docs/props.test.ts`, `website/src/stories/source.test.ts`

**Interfaces:**
- Produces: `export interface PropDoc { name: string; type: string; required: boolean; default?: string; description: string; deprecated?: string }`; `export interface ComponentDocs { description: string; props: PropDoc[]; parts: string[]; classNames: Record<string, string> | null }`; `export function extractDocs(entry: ComponentEntry): ComponentDocs` (uses the root `tsconfig.json` program and the checker); `export function extractStorySource(storyFile: string, exportName: string): string`.

- [ ] **Step 1: Failing tests (props):** `Button: description from JSDoc, appearance is a union of primary|outline|subtle|transparent, disabledFocusable documented`; `a prop with @default carries it`; `a @deprecated prop carries its note`; `Menu (compound): parts are listed (Menu.Item, Menu.Popover…)`; `a polymorphic component documents as and the element props are not dumped into the table`; `slotProps keys are listed as parts`; `classNames come from src/lib/classNames.ts (buttonClassNames.root is wave-button)`; `every one of the 80 entries yields a non-empty description` (list any exception in the test file with a reason).
- [ ] **Step 2: Failing tests (source):** `returns the story's source text including its args`; `returns the text of render() for a render story`; `unknown export throws a clear error`.
- [ ] **Step 3: Implement both.** Filter native DOM props (those declared in `@types/react`) out of `props`; keep Wave's. Step 4: run, pass. Step 5: **Commit** `feat(website): extract props, parts and story source`.

### Task 6: Theme choice and the pre-paint script

**Files:**
- Create: `website/src/theme/themeChoice.ts`, `website/src/theme/themeInit.ts`; Test: `website/src/theme/themeChoice.test.ts`

**Interfaces:**
- Produces: `export type SiteTheme = 'light' | 'dark' | 'high-contrast'`; `export type SiteDir = 'ltr' | 'rtl'`; `export function resolveInitialChoice(storage: Pick<Storage, 'getItem'> | null, matches: (query: string) => boolean): { theme: SiteTheme; dir: SiteDir }`; `export function saveChoice(storage: Pick<Storage, 'setItem'> | null, choice: { theme: SiteTheme; dir: SiteDir }): void`; `export const THEME_INIT_SCRIPT: string` (inline, under 600 bytes, sets the theme class on `<html>` and `dir`).

- [ ] **Step 1: Failing tests:** `stored choice wins`; `forced-colors selects high-contrast when nothing is stored`; `prefers-color-scheme: dark selects dark`; `default is light and ltr`; `a storage that throws on read falls back to the system choice`; `a storage that throws on write is ignored`; `an invalid stored value is ignored`; `the init script evaluated in jsdom sets html class and dir from storage`; `the init script with blocked storage still sets the system choice and throws nothing`.
- [ ] **Step 2: Run, fail. Step 3: Implement; `THEME_INIT_SCRIPT` is the same logic, hand-minified, with a test that evaluates both and compares.** Step 4: pass. Step 5: **Commit** `feat(website): choose the theme and direction before first paint`.

### Task 7: Import sizes and library version

**Files:**
- Create: `website/src/docs/sizes.ts`; Test: `website/src/docs/sizes.test.ts`

**Interfaces:**
- Consumes: `measureImport` from `scripts/verify-dist.mjs`.
- Produces: `export function getImportSizes(distDir: string): Promise<Record<string, { minified: number; gzip: number }>>` keyed by `ComponentEntry.exportName`, cached on disk by the hash of `dist/index.mjs` plus the file list; `export function getLibraryVersion(): string` (root `package.json`).

- [ ] **Step 1: Failing tests:** `Button matches the number verify-dist prints for the same import` (compare to `measureImport`); `a second call with an unchanged dist reads the cache and measures nothing` (spy on `measureImport`); `an export missing from the entry is reported by name`; `all 80 catalog exports measure`.
- [ ] **Step 2: Run, fail. Step 3: Implement.** Step 4: pass. Step 5: **Commit** `feat(website): measure each component's import size`.

### Task 8: App shell (title bar, navigation, command bar, status bar)

**Files:**
- Create: `website/src/layouts/AppLayout.astro`, `website/src/shell/{TitleBar,NavPane,CommandBar,StatusBar}.tsx`, `website/src/islands/ShellControls.tsx`; Test: `website/src/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `getCatalog`, `SiteTheme`/`SiteDir`, `THEME_INIT_SCRIPT`.
- Produces: `AppLayout` props `{ title: string; current?: string; status?: { importSize?: { minified: number; gzip: number }; version: string } }`. `ShellControls` (hydrated on idle) owns maximize, theme and direction switches, the hamburger drawer and the Ctrl+K opener.

- [ ] **Step 1: Failing tests (server-rendered HTML):** `has landmarks: banner-like title bar, nav, main, status`; `nav lists every category and all 80 links, current marked aria-current="page"`; `title bar chrome is aria-hidden except the controls, which are buttons with names`; `close is a link to /waveui`; `with scripts off the nav and content are present` (assert the HTML before hydration); `the status bar renders only the values it is given`; `maximize toggles data-maximized on the window and its label changes between "Maximize" and "Restore"`; `copy code copies the source text of the page's first story`; `the layout declares @view-transition { navigation: auto } and gives the window view-transition-name: waveui-window, turned off under prefers-reduced-motion` (the intro page's button transitions into it); `rtl moves the window controls to the left` (check `dir="rtl"` styling class via the logical utilities, no `left`/`right` literals); `no tab stop is trapped: Tab order is skip link, title controls, nav, main`; an axe run on the shell with no violations.
- [ ] **Step 2: Run, fail. Step 3: Implement with WaveUI components (`Nav`, `Toolbar`, `Button`, `NavDrawer`, `Hamburger`) rendered on the server; use only token-based classes (the site's own Tailwind build, unprefixed with the namespaced keys).** Step 4: pass. Step 5: **Commit** `feat(website): the Windows-style app shell`.

### Task 9: Example island and prop controls

**Files:**
- Create: `website/src/islands/Example.tsx`, `website/src/islands/Controls.tsx`; Test: `website/src/islands/example.test.tsx`

**Interfaces:**
- Consumes: `loadStory`, `ComposedStory` (Task 4).
- Produces: `Example` props `{ slug: string; storyName: string }` (the catalog slug); it server-renders the story with its default args (static preview), hydrates `client:visible`, and loads `Controls` only on first focus or pointer interaction with the example. `Controls` props `{ argTypes: Record<string, unknown>; args: Record<string, unknown>; onChange(next: Record<string, unknown>): void }` supports boolean, select (from `options`/`control: 'select'|'radio'`), text and number; other arg types are not shown.

- [ ] **Step 1: Failing tests:** `server render equals the story with default args`; `the controls chunk is not requested until the example is focused or hovered` (dynamic import spy); `toggling a boolean control re-renders with the new arg`; `a select control offers exactly the argTypes options`; `controls never show a function arg (fn())`; `a story that throws during render shows a clear error panel, not a blank page`; `a story reading window during render is guarded` (the server render of such a fixture does not throw); axe on a rendered example.
- [ ] **Step 2: Run, fail. Step 3: Implement.** Step 4: pass. Step 5: **Commit** `feat(website): live examples with prop controls`.

### Task 10: Component pages and the index

**Files:**
- Create: `website/src/pages/components/index.astro`, `website/src/pages/components/[slug].astro`; Test: `website/tests/pages.test.ts`

**Interfaces:**
- Consumes: catalog, docs, sizes, `AppLayout`, `Example`.
- Produces: one static page per catalog entry at `/waveui/docs/components/<slug>`.

- [ ] **Step 1: Failing tests (against `website/dist` after a build):** `80 component pages plus the index exist`; `each page has one h1 equal to the component name`; `each page has the description, a props table and the code of its first story`; `each page shows the import size and version in the status bar`; `a page lists its parts (slotProps keys) and its stable class names when the component has them, and omits those sections when it has none`; `the "On this page" pane lists the section headings present`; `no page references a path outside /waveui/docs/ (asset, link or script)`; `the index lists 80 links grouped by the 11 categories`.
- [ ] **Step 2: Run, fail. Step 3: Implement the two pages.** Step 4: pass. Step 5: **Commit** `feat(website): a page for each of the 80 components`.

### Task 11: Search, and the guide pages

**Files:**
- Create: `website/src/islands/SearchPalette.tsx`, `website/src/docs/changelog.ts`, `website/src/pages/{getting-started,theming,changelog}.astro`, `website/scripts/build-search-index.mjs`; Test: `website/src/islands/search.test.tsx`, `website/src/docs/changelog.test.ts`

**Interfaces:**
- Produces: `/waveui/docs/_assets/search-index.json` (entries `{ label, kind: 'component' | 'prop', href }`), loaded only when the palette opens; `export function parseChangelog(markdown: string): { version: string; date: string; html: string }[]` returning only 1.x sections.

- [ ] **Step 1: Failing tests:** `Ctrl+K opens the palette and focuses its input`; `typing "dat" lists DataGrid and DatePicker first`; `a prop name finds its component`; `Enter follows the result`; `Escape closes and returns focus`; `the index is not requested before the palette opens`; `parseChangelog returns 1.1.0 and 1.0.0 and no 0.x section`; `getting-started shows the install line and a minimal WaveProvider example taken from the README`.
- [ ] **Step 2: Run, fail. Step 3: Implement (use WaveUI's `Dialog`/`Listbox` pieces lazily).** Step 4: pass. Step 5: **Commit** `feat(website): search palette and guide pages`.

### Task 12: Budget and base-path gate

**Files:**
- Create: `website/scripts/check-budget.mjs`, `website/scripts/check-skipped.mjs`; Test: `website/scripts/__tests__/check-budget.test.mjs` (fixtures); Modify: `website/package.json` (`site:check`), root script `site:check`, CI job

**Interfaces:**
- Produces: `node website/scripts/check-budget.mjs [dir=website/dist]` exits 1 with a per-page report when a page breaks a limit. Exports `checkPage(html: string, readAsset: (path: string) => Buffer): { firstLoadGzip: number; totalGzip: number; problems: string[] }`.

- [ ] **Step 1: Failing tests (fixtures):** `a page under the limits passes`; `first-load JS above 150 KB gz fails and names the largest script`; `lazy scripts above 250 KB gz in total fail`; `an absolute URL outside /waveui/docs/ fails` (stylesheet, script, link, image); `an iframe fails`; `a font file or a Google Fonts link fails`; `a page without lang and dir on html fails`; `a documented exception in budget-exceptions.json (page, measured bytes, reason) passes only when the measured number is not above the recorded one`; `check-skipped fails when a story is neither rendered nor listed`.
- [ ] **Step 2: Run, fail. Step 3: Implement** (gzip each script reachable from the page's first load: `<script src>` and `modulepreload` links; lazy chunks counted by following the island manifest). Step 4: run against the real build; fix the pages that fail or record exceptions (expect DataGrid). Step 5: **Commit** `feat(website): fail the build on heavy pages and stray URLs`.

### Task 13: End-to-end behaviour

**Files:**
- Create: `website/playwright.config.ts`, `website/e2e/*.spec.ts`; Test: the specs themselves

**Interfaces:**
- Consumes: the built site served at `/waveui/docs` by `astro preview` (with the base path).

- [ ] **Step 1: Failing specs:** `with JavaScript disabled the button page shows nav, description, props and code`; `theme switch persists across a reload and sets no flash` (assert `html` class at `domcontentloaded` with a slow script route); `blocked localStorage still renders and switches theme for the session`; `right to left mirrors the window controls and nav side`; `keyboard: skip link, nav, Ctrl+K, Escape`; `phone width: nav is a drawer, no horizontal scroll`; `a page loads from a nested path with a trailing slash redirect or 404 consistently` (the chosen rule is recorded); `reduced motion removes the maximize transition`.
- [ ] **Step 2: Run, fail. Step 3: Fix what fails in the earlier tasks' code (each fix with its own commit).** Step 4: pass. Step 5: **Commit** `test(website): end-to-end checks of the built site`.

### Task 14: Deploy configuration and documentation

**Files:**
- Create: `website/vercel.json`, `website/README.md`; Modify: `docs/RELEASING.md` (a docs-site section), `README.md` (a link to the site once live)

**Interfaces:**
- Produces: the settings the homepage needs (the app's Vercel project URL placeholder `WAVEUI_DOCS_URL`) and a one-time setup list for Morten.

- [ ] **Step 1: Write `vercel.json`** (`cleanUrls: true`, `trailingSlash: false`, long-lived cache for `/waveui/docs/_assets/*`, the security headers of the homepage, no `X-Frame-Options` weaker than `DENY`).
- [ ] **Step 2: Write `website/README.md`:** build and test commands; the Vercel project settings (Git integration, root directory `website`, build command `npm run site:build` from the repository root, output `website/dist`); the deploy hook for tagged releases; how the homepage rewrite points here.
- [ ] **Step 3: Verify** `npm run site:build && npm run site:check && npm run site:test`, root `npm test`, `npm run lint`, `npm run format:check` (extend its globs to `website/` if it should cover it, else state the exclusion in the README), `npm run test:pack`.
- [ ] **Step 4: Commit** `docs(website): deploy settings and setup steps`.

### Task 15: Launch checks (by hand, recorded)

**Files:**
- Create: `docs/superpowers/notes/2026-11-07-docs-site-launch.md`

- [ ] **Step 1: On the production URL after the homepage rewrite is live, run Lighthouse (mobile) on the components index, Button, Dialog and DataGrid;** record scores, first-load and total JavaScript, layout shift.
- [ ] **Step 2: Check Chrome, Firefox and Safari:** nav, theme and direction, Ctrl+K, maximize, a controls change on three components, view transition from the intro page, forced-colors in Windows high contrast.
- [ ] **Step 3: Record failures as issues or fix them,** then commit the note `docs(website): record the launch checks`.
