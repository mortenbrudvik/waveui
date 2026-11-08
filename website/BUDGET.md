# JavaScript budget of the site's pages

Measured 2026-11-07 (Task 10b of `docs/superpowers/plans/2026-11-07-docs-site-app.md`). The limits
come from the spec (`docs/superpowers/specs/2026-11-07-docs-site-design.md`, "Performance"):
**under 150 KB gzipped on first load** for a component page, and **under 250 KB gzipped** for
everything a page can ever request. `npm run site:check` fails the build on a page over either limit
(`scripts/check-budget.mjs`, Task 12; see "The gate" below).

## Method

- `npm run site:build`, then `node website/scripts/measure-page.mjs <page>` for every page of
  `website/dist` (80 component pages, the components index `components.html` and the placeholder
  `index.html`; the getting-started, theming and changelog pages came with Task 11, below).
- Gzip is Node's `gzipSync` at zlib's default level, as `scripts/verify-dist.mjs` measures.
- **First load**: the page's inline scripts, its external scripts and module preloads, and the
  component, renderer and before-hydration modules of **every** island on the page, each with its
  static imports. This is conservative: an example island is `client:visible`, so it loads when
  scrolled into view, but all the examples of a page share one module (the page's story file), and
  the first example in view loads all of it. **Everything**: first load plus what dynamic imports
  can add (the Controls chunk).
- 150 KB is read as **150,000 B** (the controller's reading in Task 10). As 150 KiB (153,600 B),
  the counts below would be 24 before and 9 after.

## Where the bytes go (after)

| Part                                                                                                                                                 |                               Gzip | Loaded by  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------: | ---------- |
| Astro's inline island runtime and directives, the theme and window scripts                                                                           |                        2,586–2,849 | every page |
| `react` chunk: React, react-dom's client, the scheduler, Astro's React renderer                                                                      |                             68,391 | every page |
| `base` chunk: the shell island, the example runtime, and the library code they use; `tailwind-merge` alone is 11,850 of it (every component's `wcn`) |                             25,294 | every page |
| The page's story file and the library code only its stories use                                                                                      | 0 (index) to 85,000 (WaveProvider) | that page  |

So a component page starts at about 97 KB before its own stories: the shell-only index pages
measure 96,790 B. Button adds the Tooltip and popup stack of its `DisabledFocusable` story
(Tooltip, `usePopupPosition` with floating-ui, Portal, `Popover.shared`): 121,832 B. Menu adds
Menu (10,384), the popup stack (9,189 for positioning), roving focus (4,223) and its stories
(3,972): 145,656 B. DataGrid adds its own modules (18,341), Menu (its header menus), the popup
stack, roving focus and the virtual window: 167,354 B.

Why the shell-only page had grown from 89,837 B (Task 8, a build without the 80 example islands) to
105,129 B: a bundler tree-shakes per statement across the whole client build and then puts each
module, whole, in one chunk. The class-name registry (`src/lib/classNames.ts`, 186 constants), the
icons and the motion recipes were therefore rendered with every export any of the 81 islands uses,
in the chunk every page loads (classNames alone 27,015 B raw, 4,662 B gzip). The 81 islands also
split the shared code into many small chunks, and each chunk compresses alone: before this pass,
the chunk boundaries cost 2.6 KB on the index page, 7.3 KB on Button, 11.0 KB on Menu, 12.1 KB on
DataGrid and 19.6 KB on WaveProvider (sum of the chunks' gzip sizes against one gzip of the same
code).

## Levers applied

Each measured on all 82 pages against the build before it. "Median" is the true median of the 80
component pages (the mean of the 40th and 41st values). Cumulative result: **25 pages over
150,000 B before, 11 after**; the median component page went from 127,835 B to 115,463 B (a
median change of −12,492.5 B); the index pages from 105,129 B to 96,790 B.

| Lever                                                                                                                                                                                                              |                           Median change | Pages over |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------: | ---------: |
| The site's client modules import the library's modules directly, not its barrel (`CommandBar.tsx`, `Example.tsx`, `runtime.tsx`): no change by itself, it lets the build's graph walk below see only what they use |                                       0 |         25 |
| `react` chunk (`plugins/chunking.mjs`): React and Astro's renderer in one chunk                                                                                                                                    |                                    −513 |         25 |
| `base` chunk: the static closure of `ShellControls.tsx` and `Example.tsx` in one chunk (every page loads the shell; every component page loads the example runtime, so a component page loads nothing extra)       | −4,682 (both groups, against the start) |         23 |
| Split the registries `classNames.ts`, `icons.tsx` and `motion.ts` into one module per export in the client build (`plugins/splitModules.mjs`, which also points importers at the parts they use)                   |                           −6,589.5 more |         12 |
| `warnOnce` and `devWarn` treated as pure by tree-shaking: both return at once in production, so their calls and message text go (`plugins/chunking.mjs`)                                                           |                             −1,214 more |         11 |

What the splitter guarantees: each declaration keeps its text and is evaluated once, in one module;
a `let`/`var` binding stays with every declaration that uses it; declarations that reference each
other stay together. What changes is when a part evaluates (when first imported, not when the
module loads), which is equivalent only for a module whose top level has no side effects but
property assignments to its own declarations (`Icon.displayName = …`). So it throws, naming the
file, on a side-effect import, any other top-level expression or a statement it does not know, and
`plugins/splitModules.real.test.ts` splits the three registries on every test run and checks that
the split exports exactly what the module exports. Each of the three registries earns its place:
against splitting all three, splitting only the class names costs +1,803.5 median, leaving out the
icons +1,300 median, leaving out the motion recipes 0 median but up to +1,104 on some pages. (Split
alone, with Rolldown's automatic chunking, the registries give −6,264.5 median and 20 pages over.)

## Levers measured and not kept

| Lever                                                                                               | Result                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite's module preload off (`build.modulePreload: false`)                                            | −74 B; the preload helper stays anyway                                                                                                                            |
| Rolldown `entriesAware` groups over all library code, merge threshold 0 / 4,000 / 12,000 / 30,000 B | worse than the automatic chunking: 24 / 26 / 34 / 72 pages over                                                                                                   |
| A "popup stack" chunk (the closure of Tooltip)                                                      | Button −8.6 KB but Table +14.6 KB, Dialog +4.2 KB; 24 pages over                                                                                                  |
| Splitting all of `src/lib` (+ Input), + `src/hooks`, + every component module that splits           | more, smaller chunks: 13 / 13 / 20 pages over                                                                                                                     |
| Splitting `Input.tsx`, `styles.ts` or `slot.ts` as well as the registries                           | within ±2 KB per page, Dialog and WaveProvider worse; no page crosses                                                                                             |
| The command bar's Hamburger as a WaveUI `Button` with a glyph                                       | −701 median, −1.2 KB on the index; 12 pages over (no page crosses)                                                                                                |
| … and its two WaveUI `Select`s as native `<select>`s                                                | −1,658 median, −5.0 KB on the index, but Dialog +1.2 KB and WaveProvider +1.5 KB; 13 pages over. Not worth trading the "built from WaveUI components" chrome for. |
| esbuild instead of Rolldown's (oxc) minifier                                                        | +2,234 median; 14 pages over                                                                                                                                      |
| Rolldown's runtime helper (368 B) in the `react` chunk                                              | no effect (Rolldown places it itself)                                                                                                                             |

Checked and fine: the HTML requests no `modulepreload` for islands and no hydration script for an
island out of view (lever c); the Controls chunk stays out of the first load (1,041 B, loaded on
the first focus or pointer over an example); there is one React and one react-dom copy.

## The gate

`node scripts/check-budget.mjs` measures every page of `dist` with the same function as
`measure-page.mjs` (`pageJsReport`: the strict static metric, every island counted as first load)
and fails above 150,000 B gzipped of first-load JavaScript, or above 250,000 B for everything the
page can request (first load, scripts only dynamic imports add, and the data files the scripts name,
the search index). A page over the first-load limit passes only through
`website/budget-exceptions.json` (`page`, `firstLoadGzip` as measured, `reason`) and only while its
measured number is not above the recorded one; an entry for a page that is under the limit fails
("remove it"). The command prints each exception with its headroom. Raising a number is a
deliberate edit of that file with its reason, never a silent change. The same run also fails an
address outside `/waveui/docs/` (but the one Close link, and GitHub/npm links in guide content), an
`<iframe>`, a web font, a page without `lang` and `dir`, not exactly one `<main>`, a script outside
`/waveui/docs/_assets/` and any reference to `i.pravatar.cc`.

The metric is an upper bound: a real browser loads less before scrolling (see "Real browser" below).
12 pages are over the first-load limit today, all recorded: the 11 below, and `presence`
(150,876 B), which the search palette's shell code (+984 B) pushed over from 149,878 B. The numbers
of the table that follows are the build before the palette; the file holds the current ones.

## Pages over 150,000 B after every neutral lever

| Page            | First load (gzip) | Over 150,000 B by | Everything (gzip) | Own code beyond the `react` and `base` chunks: its largest chunks (gzip)                                                                                                                                    |
| --------------- | ----------------: | ----------------: | ----------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| wave-provider   |           181,826 |            31,826 |           182,867 | 84,773 B in 53 chunks: its stories show many components at once (Combobox/List data mode `Option.data` 10,721, positioning 9,189, List 6,723, roving 4,223, Combobox 4,185, Dialog 3,439, SpinButton 3,266) |
| nav-drawer      |           177,074 |            27,074 |           178,115 | 80,021 B in 48 chunks: the app shell story (Menu 10,384, positioning 9,189, Nav 5,276, roving 4,223, Drawer 3,328, its stories 3,160, Tooltip 3,059)                                                        |
| tag-picker      |           168,365 |            18,365 |           169,406 | 71,312 B in 40 chunks: TagPicker itself 12,501, the listbox data mode 10,721, positioning 9,189, TagGroup 5,307, roving 4,223, Avatar 3,622, Portal 3,025                                                   |
| data-grid       |           167,354 |            17,354 |           168,395 | 70,301 B in 34 chunks: DataGrid itself 18,341, Menu (header menus) 10,384, positioning 9,189, roving 4,223, `Table.shared` 3,273, Portal 3,025, the virtual window 2,787                                    |
| color-picker    |           164,021 |            14,021 |           165,062 | 66,968 B in 40 chunks: a Popover picker story (positioning 9,189, Popover 4,473, Portal 3,025), SwatchPicker 6,404, roving 4,223, SpinButton 3,266, its stories 3,259                                       |
| custom-overlays |           163,581 |            13,581 |           164,622 | 66,528 B in 38 chunks: the public overlay hooks with a Toaster 10,272, positioning 9,189, Popover 4,473, roving 4,223, Dialog 3,439, Portal 3,025, focus restore 2,622                                      |
| nav             |           160,190 |            10,190 |           161,231 | 63,137 B in 39 chunks: Menu 10,384, positioning 9,189, Nav 5,276, roving 4,223, Avatar 3,622, Tooltip 3,059, Portal 3,025                                                                                   |
| breadcrumb      |           155,152 |             5,152 |           156,193 | 58,099 B in 32 chunks: the collapse menu (Menu 10,384, positioning 9,189), Overflow 4,560, roving 4,223, its stories 4,156, Tooltip 3,059, Portal 3,025                                                     |
| overflow        |           153,647 |             3,647 |           154,688 | 56,594 B in 38 chunks: the overflow menu (Menu 10,384, positioning 9,189), Overflow 4,560, roving 4,223, Portal 3,025, focus restore 2,622, Toolbar 2,127                                                   |
| toast           |           153,321 |             3,321 |           154,362 | 56,268 B in 37 chunks: Toaster 10,272, roving 4,223, its stories 3,691, a Drawer story (Drawer 3,328, `Drawer.scroll` 2,771), Portal 3,025, focus restore 2,622                                             |
| drawer          |           150,100 |               100 |           151,141 | 53,047 B in 34 chunks: positioning 9,189 (Tooltip 3,059 in a story), its stories 4,067, Drawer 3,328, Portal 3,025, `Drawer.scroll` 2,771, Field 2,622                                                      |

"Positioning" is the `usePopupPosition` chunk (floating-ui and the hook), "roving" the
`useRovingTabIndex` chunk. No page is near 250 KB (the largest, WaveProvider, can ever request
182,867 B). What dominates these pages is their own story file: each page's island module imports
the whole story file, so the page loads every component its stories use.

Options, measured but not implemented (each is the owner's call):

1. **One island module per story, and a first load that counts only the examples in the first
   viewport.** The spec defines first load as "without scrolling", but `measure-page.mjs` counts
   every island, since today all the examples of a page share one module. A lower bound, measured
   by building islands that hold only each page's first story (then first three): 6 (then 8) pages
   would still be over, because the first story alone is heavy: DataGrid 169,950, Nav 161,853,
   TagPicker 159,748, Overflow 156,121, CustomOverlays 153,161, Breadcrumb 152,160 (first story
   only). It also needs the measurement to know the fold, which depends on the viewport and the
   page: in Chromium at 1278×1248 the Menu page's first example starts at y = 1,647, so before any
   scrolling the browser requested only the shell's 5 scripts (about 97 KB), not the 145,656 B
   counted here.
2. **Fewer stories on a page, or stories in tabs or lazy sections**: the same effect as 1 for the
   stories moved out of the first module.
3. **Library-side**: every page pays `tailwind-merge` (11,850 B); development warnings gated by a
   literal `process.env.NODE_ENV` check, as C-DEV already asks on size-budgeted paths, would drop
   their text in every app, not only here; a class-name registry split per component would help
   apps the same way the site's split helps here.
4. **Documented exceptions** with the numbers above, as the spec allows ("If a page truly cannot
   meet it … the builder documents the exception").

## All pages, before and after

"Before" is the build at commit 1583dfd (Task 10's numbers); "after" is this pass. "over" marks a
first load above 150,000 B.

| Page                   | Before: first load | Before: everything | After: first load | After: everything | Change (first load) |
| ---------------------- | -----------------: | -----------------: | ----------------: | ----------------: | ------------------: |
| wave-provider          |   196,088 **over** |            197,131 |  181,826 **over** |           182,867 |             -14,262 |
| nav-drawer             |   191,364 **over** |            192,407 |  177,074 **over** |           178,115 |             -14,290 |
| tag-picker             |   182,602 **over** |            183,645 |  168,365 **over** |           169,406 |             -14,237 |
| data-grid              |   182,506 **over** |            183,549 |  167,354 **over** |           168,395 |             -15,152 |
| color-picker           |   177,983 **over** |            179,026 |  164,021 **over** |           165,062 |             -13,962 |
| custom-overlays        |   176,906 **over** |            177,949 |  163,581 **over** |           164,622 |             -13,325 |
| nav                    |   173,755 **over** |            174,798 |  160,190 **over** |           161,231 |             -13,565 |
| breadcrumb             |   169,516 **over** |            170,559 |  155,152 **over** |           156,193 |             -14,364 |
| overflow               |   167,571 **over** |            168,614 |  153,647 **over** |           154,688 |             -13,924 |
| toast                  |   166,833 **over** |            167,876 |  153,321 **over** |           154,362 |             -13,512 |
| drawer                 |   163,996 **over** |            165,039 |  150,100 **over** |           151,141 |             -13,896 |
| presence               |   163,117 **over** |            164,160 |           149,878 |           150,919 |             -13,239 |
| interaction-tag        |   161,558 **over** |            162,601 |           147,775 |           148,816 |             -13,783 |
| combobox               |   160,441 **over** |            161,484 |           147,537 |           148,578 |             -12,904 |
| time-picker            |   159,026 **over** |            160,069 |           146,109 |           147,150 |             -12,917 |
| menu                   |   159,131 **over** |            160,174 |           145,656 |           146,697 |             -13,475 |
| dropdown               |   158,462 **over** |            159,505 |           145,527 |           146,568 |             -12,935 |
| popover                |   158,544 **over** |            159,587 |           144,577 |           145,618 |             -13,967 |
| split-button           |   156,520 **over** |            157,563 |           143,037 |           144,078 |             -13,483 |
| menu-button            |   156,272 **over** |            157,315 |           142,796 |           143,837 |             -13,476 |
| date-picker            |   154,422 **over** |            155,465 |           142,546 |           143,587 |             -11,876 |
| listbox                |   155,254 **over** |            156,297 |           141,853 |           142,894 |             -13,401 |
| teaching-popover       |   154,650 **over** |            155,693 |           141,068 |           142,109 |             -13,582 |
| tooltip                |   155,242 **over** |            156,285 |           140,954 |           141,995 |             -14,288 |
| hamburger              |   152,123 **over** |            153,166 |           138,861 |           139,902 |             -13,262 |
| swatch-picker          |            148,623 |            149,666 |           135,044 |           136,085 |             -13,579 |
| dialog                 |            145,885 |            146,928 |           132,247 |           133,288 |             -13,638 |
| info-label             |            142,825 |            143,868 |           130,535 |           131,576 |             -12,290 |
| tag-group              |            142,767 |            143,810 |           129,862 |           130,903 |             -12,905 |
| avatar-group           |            139,318 |            140,361 |           126,424 |           127,465 |             -12,894 |
| info-button            |            137,898 |            138,941 |           125,370 |           126,411 |             -12,528 |
| tree                   |            136,980 |            138,023 |           124,373 |           125,414 |             -12,607 |
| tag                    |            135,717 |            136,760 |           123,202 |           124,243 |             -12,515 |
| button                 |            135,450 |            136,493 |           121,832 |           122,873 |             -13,618 |
| color-area             |            132,919 |            133,962 |           120,752 |           121,793 |             -12,167 |
| field                  |            132,222 |            133,265 |           120,320 |           121,361 |             -11,902 |
| color-slider           |            129,357 |            130,400 |           117,156 |           118,197 |             -12,201 |
| alpha-slider           |            129,269 |            130,312 |           117,080 |           118,121 |             -12,189 |
| list                   |            128,917 |            129,960 |           116,226 |           117,267 |             -12,691 |
| table                  |            128,305 |            129,348 |           116,030 |           117,071 |             -12,275 |
| calendar               |            126,397 |            127,440 |           114,896 |           115,937 |             -11,501 |
| carousel               |            127,365 |            128,408 |           114,435 |           115,476 |             -12,930 |
| flat-tree              |            124,769 |            125,812 |           113,051 |           114,092 |             -11,718 |
| toolbar                |            124,113 |            125,156 |           111,609 |           112,650 |             -12,504 |
| rating                 |            124,051 |            125,094 |           111,414 |           112,455 |             -12,637 |
| tab-list               |            124,208 |            125,251 |           110,421 |           111,462 |             -13,787 |
| radio-group            |            122,843 |            123,886 |           110,362 |           111,403 |             -12,481 |
| table-features         |            123,024 |            124,067 |           110,279 |           111,320 |             -12,745 |
| card                   |            121,282 |            122,325 |           109,356 |           110,397 |             -11,926 |
| message-bar-group      |            121,537 |            122,580 |           109,063 |           110,104 |             -12,474 |
| accordion              |            119,005 |            120,048 |           106,458 |           107,499 |             -12,547 |
| persona                |            116,937 |            117,980 |           105,617 |           106,658 |             -11,320 |
| spin-button            |            117,273 |            118,316 |           105,421 |           106,462 |             -11,852 |
| avatar                 |            116,524 |            117,567 |           105,197 |           106,238 |             -11,327 |
| message-bar            |            116,280 |            117,323 |           104,827 |           105,868 |             -11,453 |
| search-box             |            116,031 |            117,074 |           104,151 |           105,192 |             -11,880 |
| checkbox               |            115,776 |            116,819 |           104,051 |           105,092 |             -11,725 |
| progress-bar           |            116,272 |            117,315 |           103,150 |           104,191 |             -13,122 |
| switch                 |            114,875 |            115,918 |           102,616 |           103,657 |             -12,259 |
| stepper                |            114,074 |            115,117 |           102,446 |           103,487 |             -11,628 |
| select                 |            113,990 |            115,033 |           102,108 |           103,149 |             -11,882 |
| pagination             |            112,275 |            113,318 |           100,828 |           101,869 |             -11,447 |
| toggle-button          |            112,928 |            113,971 |           100,593 |           101,634 |             -12,335 |
| badge                  |            111,740 |            112,783 |            99,682 |           100,723 |             -12,058 |
| presence-badge         |            111,342 |            112,385 |            99,677 |           100,718 |             -11,665 |
| slider                 |            111,760 |            112,803 |            99,670 |           100,711 |             -12,090 |
| spinner                |            111,643 |            112,686 |            99,475 |           100,516 |             -12,168 |
| counter-badge          |            111,469 |            112,512 |            99,415 |           100,456 |             -12,054 |
| textarea               |            111,471 |            112,514 |            99,397 |           100,438 |             -12,074 |
| flex                   |            111,564 |            112,607 |            99,341 |           100,382 |             -12,223 |
| compound-button        |            111,355 |            112,398 |            99,286 |           100,327 |             -12,069 |
| link                   |            111,310 |            112,353 |            99,252 |           100,293 |             -12,058 |
| divider                |            111,123 |            112,166 |            99,039 |           100,080 |             -12,084 |
| skeleton               |            110,933 |            111,976 |            98,859 |            99,900 |             -12,074 |
| text                   |            110,748 |            111,791 |            98,676 |            99,717 |             -12,072 |
| stack                  |            110,512 |            111,555 |            98,430 |            99,471 |             -12,082 |
| input                  |            110,513 |            111,556 |            98,417 |            99,458 |             -12,096 |
| label                  |            110,430 |            111,473 |            98,372 |            99,413 |             -12,058 |
| image                  |            110,391 |            111,434 |            98,240 |            99,281 |             -12,151 |
| grid                   |            110,084 |            111,127 |            98,006 |            99,047 |             -12,078 |
| components (index)     |            105,129 |            105,129 |            96,790 |            97,831 |              -8,339 |
| index (`/waveui/docs`) |            105,129 |            105,129 |            96,790 |            97,831 |              -8,339 |

The index pages' "everything" now includes the Controls chunk (1,041 B), because the example
runtime that can import it is in the `base` chunk they load.

## The search palette and the guide pages (Task 11)

Measured 2026-11-08 against the build above, on all 85 pages.

- **First load: +783 to +907 B on every page** (median component page +828.5 B, now 116,274.5 B;
  the index pages 96,790 → 97,599 B). It is the shell island's Ctrl+K / Cmd+K and Search listener
  with the lazy import (about 385 B), and Vite's preload list of the palette's 22 chunks (424 B),
  in the `base` chunk; no new first-load request. Without the preload list a first opening would
  fetch the palette in five sequential rounds (its import depth) instead of one; the list was kept.
  The increase takes **presence** over 150,000 B (149,878 → 150,752 B): **12 pages over**, from 11.
  Any listener in the first load does that (the listener alone would give 150,262 B).
- **Later, on the first opening**: the palette's chunks, 29,425 B gzipped on a shell-only page
  (WaveUI's `Dialog` with its modal stack and `Input`; less on pages that already load `Dialog`:
  +3,115 B on the Dialog page), and the index `_assets/search-index.json`, 108,631 B raw and
  7,568 B gzipped (80 components, 1,072 props, 4 pages): **36,993 B** in all, under the 40 KB target.
  `SearchBox` in place of `Input` measured 33,563 B + 7,568 B = 41,131 B, over it.
- **Everything** a page can request is now at most 190,794 B (tag-picker), under 250 KB.
- The guide pages (getting-started, theming, changelog) load what the index pages load: 97,599 B.

`website/tests/pages.test.ts` checks that no page's first load holds the palette's chunk or its
text, and that every page can load it later.

Fix round 1 (the same day): the shortcut became platform-aware (Cmd+K on Apple platforms, Ctrl+K
elsewhere, the K key also by its place), toggles the palette closed, and a failed palette chunk
shows a notice in the command bar. **First load +100 to +176 B** more (index pages 97,599 →
97,774 B; median component page 116,274.5 → 116,438 B; still 12 pages over). The palette's lazy
chunks grew by 83 B (a Retry button for a failed index) to 29,508 B: **37,076 B** with the index.
The largest "everything" is 191,016 B (tag-picker).

## Regression guard

`website/tests/pages.test.ts` ("the components index loads at most its recorded first-load
JavaScript plus 2 KB") fails when `components.html` loads more than 97,774 + 2,048 B. The record
was 96,790 B until the search palette's listener and preload list added 809 B, and its fix round
175 B more (Task 11, above). It
fails without the `base` chunk and the split (105,129 B), as checked when it was written.

## Real browser (Task 13)

Measured 2026-11-08 by `npm run site:e2e` (`e2e/budget.spec.ts`, Chromium through
`e2e/server.mjs`, which serves the build as `vercel.json` and the homepage's rewrite do), on all 85
pages (80 component pages, the components index, the placeholder index and the three guides), at
**1280×800** (`desktop`) and **390×844** (`phone`: touch, a mobile viewport, device scale 3).

Method: a fresh browser context per page and viewport (cold cache); the page loaded with no
scrolling or interaction; then the shell island's hydration (`client:idle`, so part of the first
load), `networkidle` and a further 500 ms with no request in flight. Every response with a
JavaScript content type (or a `.js` address) counts once, by the gzip size of its body at zlib's
default level (Node's `gzipSync`, as `scripts/verify-dist.mjs` and the static gate measure, not the
transfer size the server sent), plus the page's inline scripts (2,849 B on every page; the static
metric counts them too, so the two compare). The rules are those of the static gate:
`scripts/real-browser-budget.mjs` fails a page above 150,000 B unless
`website/budget-real-browser.json` lists it (`page`, `viewport`, `firstLoadGzip`, `reason`), and
only while it is not above its recorded number; a stale entry fails. The full table (page,
viewport, real first load, static worst case, difference) is written to
`website/.cache/real-browser-budget.json`. Two runs gave the same number for every page and
viewport.

| Viewport | Pages over 150,000 B | Pages that load an example | Shell only | Median component page | Largest |
| -------- | -------------------: | -------------------------: | ---------: | --------------------: | ------: |
| desktop  |     1 (`breadcrumb`) |                         38 |         47 |                98,072 | 156,147 |
| phone    |     1 (`breadcrumb`) |                         31 |         54 |                98,072 | 156,147 |

A page either loads only the shell (98,072 B on a component page, 97,809 B on the index and guide
pages) or, when an example is in the first viewport, all of its examples' code at once, since they
share one module (the page's story file): then the real number equals the static worst case. So 11
of the 12 pages over the limit on the static metric are under it in a real browser, at both
viewports (their first example is below the fold: `wave-provider` 182,801 static, 98,072 real),
and the static metric overstates a page by up to 84,729 B.

Worst five (gzip, B; the static worst case is the same number for each):

| desktop      | Real first load | phone        | Real first load |
| ------------ | --------------: | ------------ | --------------: |
| breadcrumb   |         156,147 | breadcrumb   |         156,147 |
| popover      |         145,567 | split-button |         144,036 |
| split-button |         144,036 | menu-button  |         143,796 |
| menu-button  |         143,796 | hamburger    |         139,849 |
| hamburger    |         139,849 | info-label   |         131,529 |

Still over the limit in a real browser, recorded in `budget-real-browser.json` for the owner's
decision (nothing about hydration was changed: examples stay `client:visible`, the controls lazy,
the shell island `client:idle`):

- **components/breadcrumb, desktop and phone: 156,147 B** (6,147 B over). Its first example is in
  the first viewport at both sizes, so the whole story file loads: the collapse menu (Menu
  10,385 B, the positioning stack 9,189 B), Overflow and roving focus. One island module per
  story would not be enough by itself: its first story alone measured 152,160 B on the static
  metric (Task 10b). It needs a lighter first viewport as well (a story without the collapse menu
  first, or the examples further down the page), or a different reading of the limit.
