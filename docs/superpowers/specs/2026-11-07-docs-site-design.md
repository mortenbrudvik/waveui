# WaveUI documentation site at brudvik.com/waveui

Date: 2026-11-07
Status: draft, awaiting Morten's approval (reviewed once by a fresh engineer; its questions are settled below)

## Intent

WaveUI is a React component library in the Fluent UI 2 design language, with 80 components, light, dark and high-contrast themes and right-to-left support. It has Storybook for development and a README, but no public face. This design adds one, hosted on Morten's personal site, **brudvik.com/waveui**.

The visitor is a React developer building a Windows-style app (an internal tool, a dashboard, something desktop-like) who finds Fluent UI v9 heavy or awkward and wants that look with less setup. The reaction to aim for, in Morten's words: "this is just what I was looking for, a Windows Fluent UI framework."

The edge over other component sites (the model is mantine.dev: a front page, then a page per component with live examples, props and code) is that **the docs themselves feel like a real Windows app**: title bar, navigation pane, command bar, status bar, built from WaveUI's own components.

## Two layers

**Layer 1: the intro page, `brudvik.com/waveui`.** A normal page of Morten's homepage, in that site's existing style (the Bergen header with the live time and weather, the shared footer, Schibsted Grotesk, the daylight palette), laid out like `/loadstone`. It lives in the homepage repository (`C:\code\projects\homepage-brudvik-com`, `public/waveui/index.html`), plain static HTML and CSS with no build step, as every page of that site. It has: a version and facts line, a headline and a lede, links to GitHub, npm and the changelog, a copyable install line, a short block of strengths, and the primary button "Open the components", which opens layer 2.

**Layer 2: the app, `brudvik.com/waveui/docs/...`.** The Windows-style documentation site. It opens straight into the app shell (no wallpaper or desktop screen: the intro page is already the front door). It lives in the WaveUI repository as a `website/` folder and is deployed as its own Vercel project; the homepage's `vercel.json` rewrites the app's paths to it, so visitors see one site on one domain.

## Goals

- Every one of the 80 components has its own page, generated from the code (stories, JSDoc and prop types), so the docs cannot drift from the library.
- The pages feel like a Windows app and are fast (see Performance).
- The intro page fits brudvik.com and reads as part of it.
- The site is a living demo: it is built from WaveUI components, and a bug it shows is a library bug.

## Non-goals

- No editable code playground. Examples are live and read-only, with prop controls.
- No docs for old versions: the site documents the current 1.x release.
- No analytics, accounts, comments, blog or translation (as the homepage).
- Storybook stays the development tool; this does not replace it.
- No Microsoft or Windows logos, wallpapers or the Segoe UI font file; the look is "Windows-style", and nothing may suggest the site is from Microsoft.

## Anti-goals (a failure even if it technically works)

- **Slow or heavy pages.** This is the one Morten named. It overrides every other wish below.
- A page that hides content or breaks without JavaScript. Text, navigation, code and a static preview of each example must work with scripts off.
- A window gimmick that costs usability: draggable or stacking windows, animations that delay reading, a title bar that confuses screen readers.
- Docs that disagree with the code, or numbers on the page (sizes, versions) that nothing measures.
- The intro page drifting from the homepage's calm tone (the homepage spec bans gradient blobs, glassmorphism cards, numbered sections and emoji).

## Layer 2 in detail

### Pages and URLs (my call)

Everything of the app lives under one prefix, `/waveui/docs`, so the homepage needs a single rewrite rule (`/waveui/docs/:path*`) and the intro page at `/waveui` stays wholly the homepage's: `/waveui/docs/components` (index, all 80 by category), `/waveui/docs/components/<slug>` per component, and `/waveui/docs/getting-started`, `/waveui/docs/theming` and `/waveui/docs/changelog`. Slugs are the lower-case kebab names of the exports (`data-grid`). The app's static assets are under `/waveui/docs/_assets/` (or the generator's equivalent, still under the prefix). The changelog page shows the 1.x sections of `CHANGELOG.md` and links to the whole file on GitHub. The builder may add guide pages from `docs/WAVE-UI-GUIDE.md`.

### Page anatomy

- **Title bar:** the page title; a close control that goes back to `/waveui`; a maximize/restore control that toggles a centered window against full width. Decorative parts are hidden from assistive technology; the controls are real buttons with names. No minimize.
- **Navigation pane:** the 80 components grouped by category (WaveUI's `Nav`), current page marked, collapses to a drawer behind a hamburger on phones.
- **Command bar:** copy code, open in Storybook (a link to the story if Storybook is published, otherwise omitted), theme (light, dark, high contrast), direction (left to right, right to left), and the search command palette (Ctrl+K).
- **Content:** the component description (from its JSDoc); one live example per story, with the code of the story beside it and prop controls generated from the story's args; a props table; its slots and parts (the `slotProps` keys) and stable class names and `data-*` attributes where documented; accessibility and keyboard notes where the JSDoc or guide has them; an "On this page" pane.
- **Status bar:** facts measured at build time, not typed by hand: the component's real production import size (minified and gzipped, by the same method as `scripts/verify-dist.mjs`), and the version of the library. Anything that cannot be derived at build time is left out rather than invented (for example "since vX" or an accessibility count, unless a gate produces it).

### Examples and controls

An example on the site **is** a story: the same module, rendered by the site, so there is no second copy to keep in sync. Controls come from the story's `args` and `argTypes`. Read-only means a visitor changes props with controls, never the code. Stories that cannot render on a static site (those needing Storybook-only addons) are skipped with a logged reason; the count of skipped stories is reported in the build and must be zero for the 80 component pages to ship, or each exception named.

### Look and themes

The app follows the visitor's system theme (`prefers-color-scheme`, and `forced-colors` selects high contrast) and remembers a manual choice; storage is wrapped in `try/catch` and the page works without it. It does **not** use the homepage's Bergen daylight palette: layer 2 is its own Windows-style world (the intro page keeps the Bergen palette). The font is WaveUI's own stack. Right to left mirrors the window chrome as well (controls move to the left), the way Windows does.

### Search

A command palette over component names and prop names, from an index built at build time and loaded only when opened.

### Mobile

At phone width the window chrome is slim or hidden, navigation is a drawer, examples stack above their code, and there is no horizontal scroll.

## Performance (hard limits, enforced)

Morten's main requirement. Limits apply to every page of layer 2, measured on the built output:

- Under **150 KB gzipped of JavaScript** on first load for a component page. "First load" is every script the page requests on a cold cache without scrolling or interacting, the shell included; scripts that load later (examples scrolled into view, the controls, the search palette) are bounded separately: all the JavaScript a page can ever request stays under **250 KB gzipped**. React and ReactDOM cost about 60 KB, so the site must send only the code for the components a page shows. If a page truly cannot meet it (DataGrid is the likely one), the builder documents the exception in the spec's notes with the measured number; it is never raised silently.
- Lighthouse performance **95 or more on mobile** for a sample that includes the heaviest page, with **zero layout shift**.
- Pages are **pre-rendered static HTML**; examples hydrate only when scrolled into view; the nav and text need no script.
- The limits are a **failing check** in the WaveUI repository (a script in the style of `verify-dist`, run by CI and by the site's build), so the site cannot quietly grow.

## Architecture (my call, marked as such)

- **Astro with React islands**, in `website/`, pre-rendering WaveUI components on the server and hydrating examples as islands. The builder may choose another static generator if it meets the limits more simply; the limits, not the tool, are the requirement.
- `website/` is its own package: it is **not** part of the published tarball and must not change `check:package`, `test:pack`, the `verify-dist` budgets or the 1.x public API. Whether it joins an npm workspace is the builder's decision under that constraint.
- **Deployment:** a separate Vercel project for `website/`. The homepage's `vercel.json` gets rewrites for the app's page paths and its static asset path to that project; the app is built with the matching base path. The homepage's global headers (for example `X-Frame-Options: DENY`) still apply and must not break the site. The site is rebuilt when a release is tagged and when `website/` or the docs change on `main`.
- **Docs source:** stories (89 files under `stories/`), component JSDoc and prop types (Storybook already runs a docgen plugin and an export-docblock plugin, `.storybook/exportDocblocks.ts`), `src/lib/classNames.ts`, `src/lib/slotParts.ts`, `CHANGELOG.md`, `docs/WAVE-UI-GUIDE.md`. The builder chooses the extraction method.

## Intro page details (homepage repository)

Follows the homepage spec (`docs/superpowers/specs/2026-10-26-bergen-redesign-design.md` there): shared header and footer, page title, description, canonical, Open Graph and Twitter tags, JSON-LD, an entry in `sitemap.xml`, tests in its end-to-end suite, working without JavaScript. The homepage lists one interaction per page; for this page the interaction is the transition into the app (a cross-page view transition where the browser supports it, a plain link where it does not). Whether the page also shows a small live strip of controls in the three themes is left to the builder, within the homepage's no-build rule.

## Order of work (my call)

1. **Foundation:** `website/` with the app shell, the build, the budget gate and three pages (Button, Dialog, DataGrid: small, medium and heaviest), deployed to a preview and reached through the homepage rewrite.
2. **All 80:** the generator covering every component, the search, the guide pages.
3. **Launch:** the intro page in the homepage repository, the link, the sitemap, real-browser checks in Chrome, Firefox and Safari, Lighthouse on the sample.

## Decisions made without Morten (check these)

- The app uses its own themes and fonts, not the Bergen daylight palette.
- Window controls: close goes to the intro page, maximize toggles width, no minimize.
- URLs under one prefix, `/waveui/docs`, with components at `/waveui/docs/components/<slug>`.
- The status bar shows only build-measured facts.
- Astro with React islands as the starting point.
- The app documents 1.x only, built from a tagged release; builds of `main` are previews.
- **Speed beats dogfooding where they collide.** The shell is WaveUI markup rendered on the server, static by default; its interactive parts (drawer, maximize, theme and direction switch, search) load on idle or on first use. It is not a fully hydrated React app.

## Decisions made after the design review (also mine)

- **Examples and stories:** a page imports only the stories it shows, as named exports of the story modules, relying on the bundler to drop the rest. Stories may be edited to suit the site if Storybook and its a11y gate keep passing; Storybook-only parts (`fn()`, decorators, play functions) get small shims on the site. Every story the site cannot render is listed by name, with a reason, in one checked-in file; the build fails if a story is unrendered and not on that list.
- **Controls:** with scripts off, an example shows its default args as a static preview. Controls load on first focus or interaction, as their own island, and may be lighter than React where that keeps the budget.
- **Theme and direction before first paint:** a tiny inline script sets the theme class and `dir` from the stored choice or the system setting before the first paint, so there is no flash or layout shift. Static markup defaults to light and left to right. The "no script needed" rule means content works without scripts; this script only picks the theme.
- **Sizes in the status bar:** measured at build from the library's built `dist` with the method of `scripts/verify-dist.mjs`, for all 80 components, cached by the hash of `dist`, shown for the version being built. They are displayed, not gated (the CI gate is the JavaScript budget above).
- **Which code the site documents:** it builds against the repository's own build of the library (`dist` after `npm run build`), not the published package, so a release's tag and the site match; the site build runs the library build first.
- **Rewrites and iframes:** one rewrite for `/waveui/docs/:path*` in the homepage's `vercel.json`; trailing-slash and clean-URL settings of the two projects are made to agree. The site embeds nothing in iframes (examples render in the page), so the homepage's `X-Frame-Options: DENY` is no conflict. The rewrite is verified on a homepage preview deployment, and its latency is included in the Lighthouse run on the production URL.
- **Storybook:** publishing it is not part of this work, so the command bar has no "open in Storybook" command for now.
- **Lighthouse:** the failing CI check is the JavaScript budget. Lighthouse (95 or more on mobile, zero layout shift) is run by hand at launch on Button, Dialog, DataGrid and the components index, and the numbers are recorded in the spec's notes.
- **Fonts:** layer 2 loads no web fonts; the stack is system fonts only.
- **Search without scripts:** the navigation pane and the components index are the no-script substitute; there is no search page.
- **Deploying:** the website's Vercel project uses Vercel's Git integration (repository connected, root directory `website`); the one-time setup in Vercel, and a deploy hook for tagged releases, are documented steps for Morten, not code. The homepage change is a small separate pull request at launch.

## Left to the builder

Extraction method for props and examples, exact Vercel project and rewrite configuration, whether `website/` is an npm workspace, the visual design of each region within the description above, the prop-control components, the search index format, how a skipped story is reported.

## Implementation notes

- **The site compiles the library from `src`, not from `dist` (a deliberate deviation from "builds against `dist`").** The examples are the stories, which import `../src`; Vite compiles them with the library's code through the site's plugins, which split the class-name, icon and motion registries per export and drop the development warnings from production code, so a page ships only what its stories use and stays inside the budget (`website/BUDGET.md`). The stylesheet compiles from `src/styles/styles.css`, and props and descriptions are read from `src/`. Only the status bar's import sizes are measured from `dist`, by the method of `scripts/verify-dist.mjs`, as decided above. A deployment is a fresh checkout, and the site build builds `dist` there first, so `src` and `dist` come from the same commit (`website/README.md`).
- **Budget exceptions** are recorded in `website/budget-exceptions.json` and `website/budget-real-browser.json` with their measured numbers and reasons, explained in `website/BUDGET.md`, rather than in this file's notes. Both gates allow a recorded page its number plus a fixed 1,024 B margin.
