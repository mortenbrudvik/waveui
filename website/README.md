# WaveUI documentation site

The documentation app of `@mortenbrudvik/waveui`, served at `brudvik.com/waveui/docs`: 80 component pages (one per `Components/...` story title), a components index, and the guides (getting started, theming, changelog). It is an Astro 7 app with React islands, pre-rendered to static HTML, under `/waveui/docs`. The page text, navigation, code and a static preview of each example work with scripts off; the examples are the library's own stories, hydrated when scrolled into view.

`website/` is an npm workspace of the repository. It is private and never published: it must not change the library's tarball, `check:package`, `test:pack` or the `verify-dist` budgets (the shipped files and `dist` are unchanged: `npm pack --dry-run` lists no `website/` file; the packed `package.json` differs from `main`'s by the `workspaces` field and by scripts, the lint and format scripts that now include `website/` and the `site:*` scripts, which are harmless in a published package).

## Commands

All from the repository root.

| Command                 | What it does                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run site:dev`      | Astro dev server                                                                                                                                               |
| `npm run site:build`    | Builds `website/dist`; builds the library first when `dist/index.mjs` is absent                                                                                |
| `npm run site:test`     | The site's unit and component tests (Vitest); the tests of built pages skip, naming the reason, when `website/dist` is absent or older than the sources        |
| `npm run site:test:pages` | Builds, then runs the tests of the built pages with a missing or stale build as a failure                                                                    |
| `npm run site:check`    | The gates of the built site: the JavaScript budget and base-path rules (`scripts/check-budget.mjs`) and the skipped-stories gate (`scripts/check-skipped.mjs`) |
| `npm run site:e2e`      | Playwright in Chromium against the build, served the way production serves it (`npx playwright install chromium` once, from `website/`)                         |
| `npm run site:typecheck` | `tsc -p website/tsconfig.json`                                                                                                                                |

`npm run lint` and `npm run format:check` of the root cover `website/` (TypeScript, modules, CSS and JSON; `.astro` files are covered by neither tool). The `website` job of CI runs `site:typecheck`, `site:build`, `site:test`, `site:check` and `site:e2e`; `site:dev` and `site:test:pages` are for local use (`site:test:pages` rebuilds and runs the built-page tests, which `site:test` already runs in CI after `site:build`). Lint and format run in the `Gate` job.

**What comes from `src` and what from `dist`.** The site compiles the library from its source: the examples are the stories of `stories/`, which import `../src`, and Vite builds them with the library's code through the site's own plugins (`plugins/`); the stylesheet is `src/styles/styles.css` compiled by the site's Tailwind (`src/styles/library.css`); the props tables and descriptions are read from `src/` with the TypeScript compiler; the version is the root `package.json`'s and the changelog is `CHANGELOG.md`. Only the **import sizes** in the status bar come from the library's built `dist` (`measureImport` of `scripts/verify-dist.mjs`). `site:build` builds `dist` when `dist/index.mjs` is absent, and only then. In CI and on Vercel the checkout is fresh, so `src` and `dist` come from the same commit. Locally, a change to `src/` or `stories/` reaches the examples, styles and props on the next `site:build` with no library build, but the sizes stay those of the old `dist` until `npm run build` (the size cache is keyed by the content of `dist`), and a new export fails the site build until then (its size cannot be measured).

## How the pages are made

- **Catalog** (`src/catalog/catalog.ts`): the list of pages is not written down. Each `stories/*.stories.tsx` is parsed with the TypeScript compiler API; a `Components/<Category>/<Name>` title is a page, `slug` is the kebab of `<Name>`. Two titles show no single component and name their export in the file (`EXPORT_OVERRIDES`).
- **Docs extraction** (`src/docs/`): `props.ts` reads each component's props, defaults and JSDoc from `src/` with the compiler API; `sizes.ts` measures the production import size with `measureImport` of `scripts/verify-dist.mjs` and caches it in `.cache/import-sizes.json`, keyed by the content of every `dist` file; `changelog.ts` and `guides.ts` render the guides.
- **Examples** (`src/stories/runtime.tsx`, `src/islands/Example.tsx`, `src/examples/`): a small site composer renders a story from its module (args, decorators, the `WaveProvider`) instead of Storybook's runtime. `src/examples/islands.ts` generates one island module per page into `src/generated/examples/` (git-ignored) whenever the Astro config loads, so a page ships only its own story file. Stories that open a modal on render appear only after a "Show example" click.
- **Pages** (`src/pages/`, `src/layouts/AppLayout.astro`, `src/shell/`): the window chrome (title bar, navigation, status bar), the search palette (`src/search/`, index at `_assets/search-index.json`), theme and direction set before first paint by an inline script (`src/theme/`).
- **Build plugins** (`plugins/`, wired in `astro.config.mjs`): `splitModules` splits the library's registries per export, `siteChunking` makes the `react` and `base` chunks, `localStoryImages` replaces a story's remote images with inline ones. The config also clears `.cache/story-report` when a build starts.
- **Deployment** (`vercel.json`): `cleanUrls`, `trailingSlash: false`, security headers, long-lived caching of `_assets`, the rewrite `/waveui/docs/:path*` to `/:path*` (Astro emits `dist/` without the base prefix), and the build settings below. `e2e/server.mjs` implements this file literally behind the homepage's rewrite, so the end-to-end tests catch an address that works on the app's own URL and 404s behind the homepage.

## The budget

Limits (spec "Performance"): at most **150,000 B gzipped** of JavaScript on first load of a page, and 250,000 B for everything a page can ever request. `website/BUDGET.md` has the method, the levers applied and the tables.

- **Static gate** (`npm run site:check`): counts every island on a page as first load, so it is an upper bound. A page over the limit passes only through `budget-exceptions.json` (`page`, `firstLoadGzip` as measured, `reason`) and only while it measures at most the recorded number plus `BUDGET_MARGIN`, 1,024 B (`scripts/check-budget.mjs`; room for byte differences between platforms and for small growth of shared code); an entry for a page that is under the limit again fails, and a page over the limit that is not listed fails whatever the margin.
- **Real browser** (`site:e2e`, `e2e/budget.spec.ts`): the JavaScript a cold load requests before any scroll, at 1280x800, 1920x1080 and 390x844, against the same 150,000 B. Exceptions are in `budget-real-browser.json` (`page`, `viewport`, `firstLoadGzip`, `reason`), with the same margin.
- **Raising a number is a decision**: edit the entry in the file, with the measured number and the reason, in the commit that causes it, and update BUDGET.md. Never raise one to make a failure go away unexplained; trimming the page (fewer stories, a smaller dependency) comes first.

### Re-recording the budget

A change to the library (`src/`) or to `stories/` can grow the code that many pages share, so the `Website` CI job can fail on a pull request that never touched `website/` (the repository's `/gate` does not run the site checks). When the growth is accepted:

1. `npm run site:build`, then `npm run site:check`: it prints each exception's recorded, allowed and measured number, and names a page that is now over the limit or no longer over it.
2. `npm run site:e2e`: the real-browser budget prints the same for `budget-real-browser.json`; the full table is in `website/.cache/real-browser-budget.json`.
3. Copy the **measured** numbers into `budget-exceptions.json` and `budget-real-browser.json` (add an entry, with its reason, for a page newly over; remove the entry of a page now under), in the commit that causes the change, and update the tables of `BUDGET.md`.
4. Never raise a number by hand without a reason, and never above what the gates measured.

## Adding a component

1. Give its story file a `Components/<Category>/<Name>` title (the stories are in `stories/`, the library's rule C-STORIES). Nothing else registers it: the catalog, the page, the island, the navigation and the search index follow.
2. Export the component from the library entry; `meta.component` must name that export.
3. `npm run build` (the library), then `npm run site:build`, and open the page.
4. Then the gates decide: a story that cannot render on the server and in the browser must be listed with a reason in `skipped-stories.json` (the build fails for an unlisted one); the page must stay under the budget or get an exception; the tests pin the number of components (`80` in `src/catalog/catalog.test.ts`, `props.test.ts`, `sizes.test.ts`, `searchIndex.test.ts`, `shell.test.tsx`, `tests/pages.test.ts` and the index page's text): update them in the same change.

## Deploying (Vercel)

The site is its own Vercel project, reached through a rewrite of the homepage's project. `website/vercel.json` holds the build settings, so the dashboard needs only the steps below.

**Build settings and why** (from Vercel's documentation: Configure a Build, Monorepos, `vercel.json` reference, Node.js versions): with Root Directory `website`, Vercel runs the commands in `website/`, and with "Include source files outside of the Root Directory in the Build Step" on (the default) the build can read the repository root. This site needs the root: it compiles `src/` and `stories/` and reads the root `package.json` and `dist`. So `vercel.json` sets

- `installCommand`: `cd .. && npm ci` (the workspace is installed from the root lockfile, which also installs the library's dependencies),
- `buildCommand`: `cd .. && npm run site:build && npm run site:check` (builds the library, since a fresh checkout has no `dist`, then the site, then runs the static gates: the JavaScript budget and base-path rules and the skipped-stories gate, a few seconds; a page that breaks them fails the deployment, so it is never deployed),
- `outputDirectory`: `dist` (relative to `website/`), and `framework`: `null` ("Other"; the pages are static HTML, no adapter).

Vercel does not run the end-to-end suite or the real-browser budget (`site:e2e`, Playwright): those run in CI only. These overrides are in `vercel.json`, not in the dashboard's fields, because they are versioned with the code and the end-to-end suite pins them (`e2e/server.spec.ts`). Vercel's documentation shows the same `cd ..` form for a monorepo build command and `installCommand` overridden in `vercel.json`. No deployment has run these commands yet: the first deploy is the check.

**One-time setup** (for the owner):

1. In Vercel: Add New, Project, import `mortenbrudvik/waveui` (Git integration; the production branch is `main`, so every push to `main` deploys and pull requests get previews).
2. Set **Root Directory** to `website` and keep "Include source files outside of the Root Directory in the Build Step" enabled.
3. Leave the **Framework Preset** as detected or Other, and the Install, Build and Output fields empty or default: `vercel.json` overrides them (the dashboard shows them as overridden).
4. Under Build and Deployment, check **Node.js Version** is 24.x (Vercel's default; the repository's `devEngines` asks for `^22.22.2 || ^24.15.0 || >=26`). npm 11 comes with it; the repository asks for npm 11.11 or later and only warns.
5. Under Deployment Protection, use **Standard Protection** (the production domain stays public) and not "All Deployments": the homepage reads the project's production domain, `<project>.vercel.app`, without credentials.
6. Settings, Git, **Deploy Hooks**: create a hook named `release` for the branch `main` and keep the URL private. A hook redeploys the tip of a branch on a `POST` (never a tag): call it after a release is tagged and merged, so the version, sizes and changelog on the site are the release's (`docs/RELEASING.md`).
7. In the homepage repository (`homepage-brudvik-com`), add the rewrite to its `vercel.json`, with the project's production host in place of `WAVEUI_DOCS_URL`:

   ```json
   { "source": "/waveui/docs/:path*", "destination": "https://WAVEUI_DOCS_URL/waveui/docs/:path*" }
   ```

   The path is kept whole: the app's own `vercel.json` rewrites `/waveui/docs/:path*` to the files of `dist`.
8. **The two projects' routing settings must agree.** The homepage has `cleanUrls: true` and `trailingSlash: false`; so does `website/vercel.json`. A difference would redirect between the two (a slash added by one, removed by the other). `e2e/server.mjs` keeps a copy of the homepage's two settings (`HOMEPAGE_ROUTING`) that nothing checks against the homepage: change both together.
9. Open `https://brudvik.com/waveui/docs/components/button` and `.../theming`, and check the title bar's Close link goes to `/waveui`.
