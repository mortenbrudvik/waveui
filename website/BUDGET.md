# JavaScript budget of the site's pages

Measured 2026-11-07 (Task 10b of `docs/superpowers/plans/2026-11-07-docs-site-app.md`). The limits
come from the spec (`docs/superpowers/specs/2026-11-07-docs-site-design.md`, "Performance"):
**under 150 KB gzipped on first load** for a component page, and **under 250 KB gzipped** for
everything a page can ever request. Task 12 adds the failing check; this file is where it starts.

## Method

- `npm run site:build`, then `node website/scripts/measure-page.mjs <page>` for every page of
  `website/dist` (80 component pages, the components index `components.html` and the placeholder
  `index.html`; the getting-started, theming and changelog pages do not exist yet).
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

Each measured on all 82 pages against the build before it; the median is over the 80 component
pages. Cumulative result: **25 pages over 150,000 B before, 11 after**; the median component page
went from 128,305 B to 116,030 B; the index pages from 105,129 B to 96,790 B.

| Lever                                                                                                                                                                                                              |                           Median change | Pages over |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------: | ---------: |
| The site's client modules import the library's modules directly, not its barrel (`CommandBar.tsx`, `Example.tsx`, `runtime.tsx`): no change by itself, it lets the build's graph walk below see only what they use |                                       0 |         25 |
| `react` chunk (`plugins/chunking.mjs`): React and Astro's renderer in one chunk                                                                                                                                    |                                    −515 |         25 |
| `base` chunk: the static closure of `ShellControls.tsx` and `Example.tsx` in one chunk (every page loads the shell; every component page loads the example runtime, so a component page loads nothing extra)       | −4,672 (both groups, against the start) |         23 |
| Split the registries `classNames.ts`, `icons.tsx` and `motion.ts` into one module per export in the client build (`plugins/splitModules.mjs`, which also points importers at the parts they use)                   |                             −4,977 more |         12 |
| `warnOnce` and `devWarn` treated as pure by tree-shaking: both return at once in production, so their calls and message text go (`plugins/chunking.mjs`)                                                           |                             −1,125 more |         11 |

The splitter refuses any top-level statement it cannot place, keeps `let`/`var` bindings with every
declaration that uses them, and groups declarations that reference each other, so it cannot change
what the code does; a library change it cannot handle fails the site build. Each of the three
registries earns its place: splitting only the class names gives +1,805 median against all three,
without the icons +1,302 median, without the motion recipes up to +1,104 on some pages.

## Levers measured and not kept

| Lever                                                                                               | Result                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite's module preload off (`build.modulePreload: false`)                                            | −74 B; the preload helper stays anyway                                                                                                                            |
| Rolldown `entriesAware` groups over all library code, merge threshold 0 / 4,000 / 12,000 / 30,000 B | worse than the automatic chunking: 24 / 26 / 34 / 72 pages over                                                                                                   |
| A "popup stack" chunk (the closure of Tooltip)                                                      | Button −8.6 KB but Table +14.6 KB, Dialog +4.2 KB; 24 pages over                                                                                                  |
| Splitting all of `src/lib` (+ Input), + `src/hooks`, + every component module that splits           | more, smaller chunks: 13 / 13 / 20 pages over                                                                                                                     |
| Splitting `Input.tsx`, `styles.ts` or `slot.ts` as well as the registries                           | within ±2 KB per page, Dialog and WaveProvider worse; no page crosses                                                                                             |
| The command bar's Hamburger as a WaveUI `Button` with a glyph                                       | −701 median, −1.2 KB on the index; no page crosses                                                                                                                |
| … and its two WaveUI `Select`s as native `<select>`s                                                | −1,666 median, −5.0 KB on the index, but Dialog +1.2 KB and WaveProvider +1.5 KB; 13 pages over. Not worth trading the "built from WaveUI components" chrome for. |
| esbuild instead of Rolldown's (oxc) minifier                                                        | +2,230 median; 14 pages over                                                                                                                                      |
| Rolldown's runtime helper (368 B) in the `react` chunk                                              | no effect (Rolldown places it itself)                                                                                                                             |

Checked and fine: the HTML requests no `modulepreload` for islands and no hydration script for an
island out of view (lever c); the Controls chunk stays out of the first load (1,041 B, loaded on
the first focus or pointer over an example); there is one React and one react-dom copy.

## Pages over 150,000 B after every neutral lever

| Page            | First load (gzip) | Over 150,000 B by | Everything (gzip) |
| --------------- | ----------------: | ----------------: | ----------------: |
| wave-provider   |           181,826 |            31,826 |           182,867 |
| nav-drawer      |           177,074 |            27,074 |           178,115 |
| tag-picker      |           168,365 |            18,365 |           169,406 |
| data-grid       |           167,354 |            17,354 |           168,395 |
| color-picker    |           164,021 |            14,021 |           165,062 |
| custom-overlays |           163,581 |            13,581 |           164,622 |
| nav             |           160,190 |            10,190 |           161,231 |
| breadcrumb      |           155,152 |             5,152 |           156,193 |
| overflow        |           153,647 |             3,647 |           154,688 |
| toast           |           153,321 |             3,321 |           154,362 |
| drawer          |           150,100 |               100 |           151,141 |

No page is near 250 KB (the largest, WaveProvider, can ever request 182,867 B). What dominates
these pages is their own story file: each page's island module imports the whole story file, so the
page loads every component its stories use (WaveProvider's stories show Dialog, menus and many
components; NavDrawer's an app shell with Nav and Drawer).

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

## Regression guard

`website/tests/pages.test.ts` ("the components index loads at most its recorded first-load
JavaScript plus 2 KB") fails when `components.html` loads more than 96,790 + 2,048 B. It fails
without the `base` chunk and the split (105,129 B), as checked when it was written.
