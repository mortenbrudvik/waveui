# Stack spike (Task 1): Astro with React islands

Date: 2026-11-07. Machine: Windows 11, Node.js 24.21.0, npm 12.2.2. Plan:
`docs/superpowers/plans/2026-11-07-docs-site-app.md`, Task 1. Spec:
`docs/superpowers/specs/2026-11-07-docs-site-design.md`.

## Verdicts

| Question | Verdict |
| --- | --- |
| Astro and the root's Vite 8 coexist | **Yes**, with Astro 7.3.8 and `@astrojs/react` 7.0.1 (one Vite, the root's 8.3.1; the library's `dist` is byte-identical). Newer Astro moves the library's toolchain (see below). |
| Stories import without Storybook runtime | **Yes for the story modules** (only `storybook/test`, aliased to a stub). **No for `composeStory`**: it is Storybook's preview runtime, about 145 KiB gzipped in the browser. |
| First-load JavaScript of the Button page is at most 110 KB gzipped | **No as specified** (the island composes the story with `composeStory`): **235,836 B (230.3 KiB)**. **Yes** with a site composer instead of `composeStory`: **87,536 B (85.5 KiB)**, measured. |
| No duplicate React | **Yes**: one React core chunk, one react-dom client chunk; `npm ls` shows one `react` and one `react-dom` (19.3.0). |

One answer is "no", so the spike stops here for a ruling before Task 2. The cause is not the
generator: any static generator that ships `composeStory` to the browser pays the same 145 KiB, and
Astro with a site composer is at 85.5 KiB. The spec's "Architecture" names no other generator;
none is proposed. The ruling needed: whether Task 4's `loadStory` may compose stories with a small
site composer (sketch below) instead of `composeStory` in client code.

## Pinned versions

| Package | Version | How |
| --- | --- | --- |
| `astro` | 7.3.8 | exact, `website/package.json` |
| `@astrojs/react` | 7.0.1 | exact, `website/package.json` (the release paired with Astro 7.3.6 to 7.3.8: same `@astrojs/internal-helpers` 0.12.0) |
| `vite` | 8.3.1 | the root's, through `package-lock.json` (Astro and `@astrojs/react` take the hoisted copy; no second Vite) |
| `rolldown` | 1.2.11 | the root's, through the lockfile |
| `@vitejs/plugin-react` | 6.1.1 | the root's, through the lockfile |
| `react`, `react-dom` | 19.3.0 | `^19.3.0`, the root's range, deduped |
| `@tailwindcss/vite`, `tailwindcss` | 4.3.3 | `^4.3.3`, the root's range, deduped |
| `@storybook/react` | 10.6.0 | `^10.6.0`, the root's range, deduped |
| `vitest` | 5.0.2 | `^5.0.2`, the root's range, deduped |
| `typescript` | 6.0.3 | the root's (no website dependency) |

Every website package is a `devDependency`: the site is never published, and so every existing
lockfile entry keeps its `dev` flag (as `dependencies`, 288 of them lost it, since a workspace's
dependencies count as production ones). `website/node_modules` stays empty: every dependency is
hoisted. The lockfile adds 200 entries, and its only change to an existing entry is
`@napi-rs/wasm-runtime` 1.2.4 to 1.2.7, an optional dependency of the `wasm32` bindings (never
installed on Windows or Linux x64). No new
install script (`npm install-scripts ls`: none unreviewed; `sharp` 0.35.5, an Astro dependency,
ships prebuilt). The root `npm ci` installs the site's packages too (667 packages, 27 s here).

### Why not the latest Astro (7.4.7) and `@astrojs/react` (7.1.4)

Astro 7.4.0 and later need `vite` `^8.3.4` (7.4.3 and later `^8.3.5`); `@astrojs/react` 7.1.0 and
later need `vite` `^8.3.4` and `@vitejs/plugin-react` `^6.1.2`. The root locks Vite 8.3.1, so npm
dedupes by moving the root's own toolchain: with 7.4.7 and 7.1.4 installed, the lockfile moved
`vite` 8.3.1 to 8.3.6, `rolldown` 1.2.11 to 1.2.16 and `@vitejs/plugin-react` 6.1.1 to 6.2.1, and
`npm run build` then wrote a different library `dist`: 282 files other than source maps differ
(the import order of each module, for one), and the `verify-dist` sizes moved (Button-only
12,425 to 12,403 B minified, Tree-only 55,392 to 55,521 B; every budget still passed). That changes
the published tarball's code, which `website/` must not do, so the spike pins the latest
Astro that fits the root's toolchain. Moving to Astro 7.4 later is a deliberate library toolchain
bump first (its own `build(deps)` commit with a `verify-dist` run), then the Astro bump.

Astro 7.4.1 and later also require Node.js `>=22.23.4`; the root's `devEngines` allows
`^22.22.2`. Astro 7.3.8 requires `>=22.12.0`, inside it.

## What was built

- `website/` is an npm workspace (root `package.json` `"workspaces": ["website"]`), private,
  named `waveui-website`: `npm run build -w website`, `npm test -w website`.
- `astro.config.mjs`: `base: '/waveui/docs'`, `trailingSlash: 'never'`,
  `build: { assets: '_assets', format: 'file' }`, the React integration, `@tailwindcss/vite`,
  the alias `storybook/test` to `src/stories/storybook-test-shim.ts`, and
  `vite.server.fs.allow` the repository root (dev only; the build reads `../src` and
  `../stories` without it).
- `src/pages/spike.astro` renders `<WaveProvider><Button appearance="primary">` from
  `../../../src` on the server (no client directive, no script), and
  `<ButtonStoryIsland client:visible />`.
- `src/islands/ButtonStoryIsland.tsx`:
  `composeStory(Default, meta, preview)` with `meta` and `Default` from
  `stories/Button.stories.tsx` and `preview` the default export of `.storybook/preview.tsx`
  itself, so its `WaveProvider` decorator is the project annotation (theme and direction from its
  `initialGlobals`, light and left to right).
- The styles come with `.storybook/preview.tsx`: its imports of `preview.css` (the library sheet,
  `src/styles/styles.css`, compiled by `@tailwindcss/vite` with `prefix(wave)`) and `stories.css`
  (the stories' own unprefixed classes) become one stylesheet that Astro links in the head:
  145,682 B raw, 22,224 B gzipped. Checked in it: `.wave\:bg-primary{background-color:var(--wave-primary)}`,
  the gated hover `.wave\:not-disabled\:not-aria-disabled\:hover\:bg-primary-hover:not(:disabled):not([aria-disabled=true]):hover`,
  1,218 selectors with the `wave:` prefix, the `.wave-light`, `.wave-dark` and
  `.wave-high-contrast` token rules, `.wave-root`, the `wave-rtl:` variant
  (`:nth-child(n of :dir(rtl))`), the stories' `text-wave-*` classes, and no Preflight. (The
  library's `dist/styles.css` alone is 123,260 B raw, 18,367 B gzipped.) If the site drops
  `.storybook/preview.tsx` for its own annotations (Task 4), it needs the same two sheets as two
  files, since one Tailwind build has one prefix.
- `src/stories/storybook-test-shim.ts`: `fn = () => () => {}`. `composeStory` needed eight more
  names, because Storybook's own preview modules import them from `storybook/test`, and the build
  fails with `[MISSING_EXPORT] "configure" is not exported by "src/stories/storybook-test-shim.ts"`
  (then `onMockCall`, then `clearAllMocks`) until each exists: `configure` (from
  `@storybook/react`'s preview entry), `onMockCall` (the actions loader of
  `storybook/internal/csf`), `clearAllMocks`, `resetAllMocks`, `restoreAllMocks`,
  `isMockFunction`, `within` and `uninstrumentedUserEvent` (the test addon's loaders). Each is an
  inert stub; none runs when a composed story only renders.
- `vitest.config.ts` uses Astro's `getViteConfig`, so tests get the site's alias and plugins
  (checked with a throwaway test: `storybook/test`'s `fn` is the stub's, and
  `renderToString(<composeStory(Default, meta, preview) />)` renders the Button inside
  `wave-root wave-light`). One committed test, `src/stories/storybook-test-shim.test.ts`.
- `tsconfig.json` extends `astro/tsconfigs/strict` with `jsx: react-jsx`;
  `npx tsc -p website/tsconfig.json --noEmit` type-checks the website files with `../src`,
  `../stories/Button.stories.tsx` and `.storybook/preview.tsx` under Astro's stricter options
  (`verbatimModuleSyntax`): 0 errors.
- `scripts/measure-page.mjs` measures a built page (method below).

## Measurements

`npm run build -w website` (1.5 s), then `node website/scripts/measure-page.mjs spike.html`.
Method: the page's inline scripts, its external scripts and module preloads, and every island's
`component-url`, `renderer-url` and `before-hydration-url`, each with its static imports, gzipped
with Node's `gzipSync` at the default level, as `scripts/verify-dist.mjs` does. An island in the
first viewport hydrates at once, `client:visible` included, so its modules are first-load. Served
by `astro preview` (gzip), the browser's `encodedBodySize` of each script equals these numbers, and
it requested exactly the four modules listed (Chromium through Playwright).

Button page as specified (`composeStory` in the island):

| Script | Raw | Gzip |
| --- | ---: | ---: |
| Astro's inline island runtime and `visible` directive | 5,276 B | 2,181 B |
| `react.*.js` (React) | 8,792 B | 3,409 B |
| `client.*.js` (Astro's React renderer) | 1,894 B | 957 B |
| `client.*.js` (react-dom's client) | 211,144 B | 65,118 B |
| `ButtonStoryIsland.*.js` | 524,482 B | 164,171 B |
| **First load** | 751,588 B | **235,836 B (230.3 KiB)** |
| Later: `react-18.*.js` (Storybook's react-dom shim, imported dynamically by its canvas renderer; never requested) | 793 B | 465 B |

Through its source map, the island chunk is 47.6 % `@storybook/react`, 43.1 % `storybook`
(`preview-api`, `internal/csf` with every core addon's preview, `docs-tools`), 5.5 %
`tailwind-merge`, 3.3 % WaveUI (21 modules: Button, its styles and semantics, WaveProvider and
the `lib` helpers they import; the `../src` barrel tree-shakes, `Tooltip` of the same import is
gone), and less than 1 % the story, the preview and `clsx`.

Two variants, measured with the same page and then removed:

| Island | First load (gzip) |
| --- | ---: |
| `composeStory` of `@storybook/react` (as specified) | 235,836 B (230.3 KiB) |
| `composeStory` of `storybook/preview-api` with a `render` annotation (no `@storybook/react`) | 163,211 B (159.4 KiB): the preview-api chunk alone is 75,705 B |
| A site composer (below), no Storybook module | **87,536 B (85.5 KiB)**: the story chunk (Button, WaveProvider, `tailwind-merge`, `clsx`, the story) is 15,607 B |

The fixed cost of any island page is 71,665 B (70.0 KiB): the inline runtime, React, the
renderer and react-dom. The 150 KB limit for a component page leaves about 80 KiB for the shell's
islands and the examples; `composeStory` in client code would take 145 KiB of it.

The site composer of the measurement (the stories need no more: none uses `preview-api` hooks,
loaders, `play` or arg mappings; Divider and Menu stories have decorators):

```tsx
const args = { ...meta.args, ...Default.args };
const context = { args, globals: { ...preview.initialGlobals } };
const Component = meta.component;
let Story = () => <Component {...args} />;
for (const decorate of preview.decorators ?? []) {
  const Inner = Story;
  Story = () => <>{decorate(Inner, context)}</>;
}
```

A real one also takes the story's and the meta's `render` and decorators (story, then meta, then
project) and argTypes defaults; `composeStory` can stay as the server-side oracle in tests (its
`renderToString` output against the site composer's), since server code costs no client bytes.

## Other checks

- **Scripts off** (Chromium, `javaScriptEnabled: false`): the page requests only its HTML and the
  stylesheet; both buttons render styled (the server button `rgb(15, 108, 189)` on white text,
  32 px high; the story's outline button with its `rgb(209, 209, 209)` border); the island keeps
  its server markup (`ssr` attribute).
- **Scripts on**: the island hydrates (its `ssr` attribute goes), clicking the story's button
  (the stub `fn()` action) and tabbing log nothing; the only console error is the missing
  `/favicon.ico` (no favicon yet). `astro dev` serves the page (200) and hydrates it too, with no
  hydration warning from React's development build.
- **No duplicate React**: in the built `_assets`, one chunk assigns React's
  `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` and one names react-dom's
  `rendererPackageName` (`measure-page.mjs` prints both lists). The island imports the shared
  React chunk; Storybook's react-dom shim imports the shared react-dom chunk.
- **URLs**: `dist/spike.html` (file format), served at `/waveui/docs/spike`; every asset under
  `/waveui/docs/_assets/`.
- **The library is unchanged**: `npm run build` at the root after the install wrote a `dist`
  identical to the one built before any change (`diff -r`), with the same `verify-dist` lines;
  `npm pack --dry-run` lists 581 files and none under `website/` (the packed `package.json` now
  carries the `workspaces` field, which npm ignores in an installed dependency); root
  `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:package` and
  `npm run test:pack` pass.
- **Root Vitest** also collects `website/**/*.test.*` until Task 2 excludes `website/**`; the one
  website test passes under both configurations.
