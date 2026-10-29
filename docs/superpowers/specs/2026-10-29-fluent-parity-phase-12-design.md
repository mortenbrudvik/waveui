# Phase 12 (0.17.0): theming API and charts strategy

Status: design, written 2026-10-29 on `feat/fluent-parity-phase-12` from `main` at `e1658e0` (0.16.0). The maintainer opted out of the brainstorm questions ("just start"), so every design call below is the author's and is marked **Ruling**; each states what it costs if wrong. The roadmap entry is `docs/ROADMAP.md`, Phase 12 (P12-01 to P12-04). Inputs: a survey of WaveUI's token, provider and portal code, and a read of Fluent UI v9's source (the researcher's notes are summarised in §2.2).

## 1. Intent

An app built on WaveUI must be able to **look like its own brand without forking the library or fighting it**: a brand colour, a stronger dark theme, a subtree with a different accent, overlays that match the surface that opened them, a monospace face for code, and charts that use the same colours as the rest of the page.

Today it cannot, for four reasons the survey found:

- **Overrides stop at the portal.** A token set on a subtree (a class, a `style`) never reaches that subtree's overlays: `Portal` copies only the provider's theme *classes* onto its wrapper, which is mounted in `document.body`. A "marketing" panel with its own accent opens a Dialog, Menu or Toast in the page's accent.
- **Re-branding is hand work.** The brand ramp is 16 hand-picked hex values; nothing generates one from a seed colour, and nothing checks that a hand-made ramp keeps the contrast the components rely on.
- **The token set has no JavaScript face.** Names are strings in CSS; a chart library, an inline `style` or a canvas cannot refer to `--wave-primary` with a type to check it, and a stray `var(--wave-primry)` fails silently.
- **Gaps in the tokens.** Shadows are the same in every theme (so they vanish in dark), there is no monospace or numeric face, no medium weight, and the categorical palette (the 12 persona colours) has a fill and a text colour but no tint or border, which tags, badges and charts need.

### Goals

1. **Token overrides that reach portals** (P12-01): `WaveProvider tokens` (typed, nests, applies as inline custom properties) and `applyStylesToPortals`; SSR renders them inline.
2. **A typed token object and a brand generator** (P12-02): `waveTokens`, `createBrandTokens(seed)`, and per-theme shadows.
3. **Token breadth** (P12-03): the palette extended for data and tags, two font families, the medium weight, the scales documented.
4. **A charts strategy** (P12-04): a guide chapter, `chartPalette`, and runnable Storybook stories for two chart libraries, outside the package bundle.

### Non-goals

- Chart components (roadmap §1.3), a theme *object* that replaces the named themes, runtime theme registration, and a `theme="system"` mode (P4-05 stays open).
- Changing any default look in the light theme. The dark and high-contrast shadows change (§5.1); nothing else a user sees does.
- New hues beyond the 12 persona colours, and new spacing, radius or stroke tokens (R12).
- A `<style>` element, a CSP nonce, or any runtime stylesheet.
- The 0.15 and 0.16 follow-ups (flipped-popup slide, toast shadow clip, WebKit RTL resize drag, ...): separate releases.

### Anti-goals

- A theming API that can make an accessible default inaccessible without saying so: `createBrandTokens` cannot produce a ramp that fails the contrast the components assume, and a hand-made ramp that fails warns in development.
- Cost for apps that do not theme: a Button-only, MessageBar-only or Tree-only import stays as small as in 0.16 (§10).
- A second source of truth: the typed `waveTokens` must not be able to drift from `tokens.css`; a test fails on any difference (R5).

## 2. Rulings and reference

### 2.1 Rulings

| # | Ruling (author's call) | Why | Costs if wrong |
|---|---|---|---|
| R1 | **`theme` stays the closed name union; `tokens` adds overrides on top.** `WaveProvider tokens?: WaveTokenOverrides \| null` is a flat map of token names to CSS values, merged over the named theme; there is no `Theme` object and no custom named theme. | A closed union keeps `getThemeClassName`, `data-wave-theme`, the three contrast-tested groups and every `.wave-dark` selector working. A flat override map covers "brand colour" and "different accent" without a registry. | An app that wants a *fourth full theme* still writes a CSS class that redeclares the tokens (as today); a registry can be added later without breaking this. |
| R2 | **Overrides are inline custom properties on the provider root and on every portal wrapper it owns** (a `style` attribute, never a `<style>` element). The provider merges them into its own `style` (the consumer's `style` wins). | A portal wrapper's theme class redeclares every derived token with `var()`, resolved on the wrapper itself, so the same inline overrides must be there. Inline style beats a stylesheet rule on the same element, so an override also wins over `.wave-light { --wave-primary: ... }`. Positioning already relies on inline styles. | Under a strict CSP (`style-src` without `'unsafe-inline'`) the *server-rendered* `style` attribute is blocked, and hydration does not re-apply it; client-rendered styles are set through the CSSOM and work. Documented (§4.5), checked in the browser pass. Apps with that CSP ship the override as a stylesheet, as today. |
| R3 | **Nested providers merge `tokens` key by key over the enclosing provider's.** `undefined` inherits; `null` clears everything inherited; a key whose value is `undefined` inherits that key. The overrides are inherited **even when the nested provider changes `theme`**. | Same rule as `inputDefaults` and `portalContainer` (omitted inherits). A brand ramp is theme-independent, which is the common case; making inheritance depend on the theme would surprise it. | An override written for the light theme (a semantic colour such as `primary`) applies to a nested dark panel too, where it may fail contrast. The guide says to set semantic overrides per theme in the provider that sets the theme, and `tokens={null}` clears. `null` clears the inherited overrides of the tokens the theme declares (the semantic colours, shadows, palette) and of the subtree's overlays; theme-independent tokens (the brand and grey ramps, font families, stacking order, motion durations and curves) of an enclosing provider still reach the subtree's own elements through the CSS cascade. |
| R4 | **`applyStylesToPortals` (default `true`)** says whether portal wrappers carry the provider's **token overrides**; `false` leaves them out. The theme classes, direction and the `wave-portal` class are always set, so an overlay of a dark provider is still dark. Inherited by nested providers like `motion` (Fluent's is not inherited, §2.2). | Fluent's `false` keeps the theme variables on portals and drops only the provider root's extras (colour, background, typography, the consumer's class). Wave's portal wrapper never carried the root look, so the extras that exist to drop are the overrides. Use: a panel with its own accent whose dialogs should look like the page. | An app that expected `false` to un-theme portals entirely (the roadmap sketch's wording, "applied on every portal wrapper") gets themed, un-overridden portals; the JSDoc says so. |
| R5 | **Token names in JavaScript are camelCase of the CSS name without the `--wave-` prefix** (`--wave-primary-foreground` is `primaryForeground`, `--wave-brand-80` is `brand80`, `--wave-palette-red-tint` is `paletteRedTint`); the conversion is a pure rule (a hyphen before each capital and before a digit run) and `waveTokens` is generated from one names tuple, with a **parity test** that fails when a `--wave-*` variable of `tokens.css` is missing from the tuple, an entry has no variable, or the conversion does not round-trip. | Fluent's token names are camelCase too, and a rule beats a hand-kept map. The test is the single source of truth, so the object cannot drift. | A future token with a digit in the middle of a word (`x2y`) breaks the round-trip rule; the test fails loudly and the rule gets an exception table. |
| R6 | **The provider never validates names against the tuple.** It converts keys with the rule and applies them; typos are caught by TypeScript. | The tuple is about 340 names; importing it into `WaveProvider` would put it in every bundle that has a Portal. | A JavaScript caller's typo (`primry`) is silently a dead custom property. |
| R7 | **`createBrandTokens(seed)` takes its hue and colourfulness from the seed and keeps the lightness of the default ramp at every stop.** It converts the seed to OKLCH, and for each of the 16 stops builds the colour with the seed's hue and chroma at the lightness that gives that stop the **same relative luminance as the default ramp's stop**, reducing chroma until the colour fits the sRGB gamut. | Contrast depends only on luminance, so every text/surface/fill pair that holds for the default ramp holds for any generated ramp **by construction**, which is the guard the roadmap asks for ("generated ramps pass the contrast matrix"), asserted in tests for many seeds. The cost is that stop 80 is the seed's *hue*, not exactly the seed. | A brand whose exact colour matters (a logo blue that is lighter than the default stop 80) gets a darker button; they pass a full `BrandRamp` instead (R8). |
| R8 | **`createBrandTokens` also accepts a full `BrandRamp`** (16 hex values, stops 10 to 160) and returns it as tokens unchanged. In development, a ramp whose stops fail the pairs the themes read from them (the fill, hover, pressed, selected and ring stops, §6.3) logs one warning per failing pair, naming the stops. | Designers have an exact ramp (Fluent's brand variants are the same shape). The warning is the "contrast-checked at runtime in development" of the roadmap. | The warning is advisory: a failing ramp still applies. A throw would break an app at runtime over a design choice. |
| R9 | **The high-contrast theme ignores the brand ramp.** Its colours are fixed system-style values (`#1aebff`, `#ffff00`, ...), not ramp stops. | High contrast exists to be the same for everyone; Fluent's high-contrast theme also takes no brand. | A brand has no presence in high contrast. |
| R10 | **Shadows become per-theme tokens**: `--wave-shadow-{2,4,8,16,28,64}` in each theme group, with `--shadow-N` in `@theme inline` pointing at them. Class names (`shadow-4`) do not change. Dark shadows are stronger and the high-contrast values follow Fluent (§2.2). | The only way to a "stronger dark shadow" without new class names. | An app that styled `--shadow-4` in its own `@theme` keeps working (its value replaces the alias); one that read the literal value from `tokens.css` sees a `var()`. |
| R11 | **The palette is extended with `-tint`, `-tint-foreground` and `-border`** for each of the 12 hues: `--wave-palette-<hue>` stays the strong fill and `--wave-palette-<hue>-foreground` its text, exactly as in 0.13 (nothing is removed or re-meant before 1.0). `-tint` is a light surface, `-tint-foreground` text and icon on the tint and on the page, `-border` the hue's stroke (3:1; it equals the fill in light and dark). This follows the repo's status-token grammar (`success`, `success-tint`, `success-tint-foreground`), not the roadmap sketch's `-background` suffix, which would collide in meaning with the existing fill. | A rename is a breaking change; Avatar's colours are public (`--wave-palette-*`). | The roadmap text says `-{background,foreground,border}`; the CHANGELOG and ROADMAP "Built as" note state the departure. |
| R12 | **Spacing, radius and stroke scales are documented, not tokenised.** The guide gets a table mapping Fluent's `spacing*`, `borderRadius*` and `strokeWidth*` names to the Tailwind classes Wave uses (4px grid, C-RADIUS). No CSS variable is added. | C-RADIUS forbids theme overrides of the radius names, and the spacing scale is Tailwind's. A parallel token set would be a second source of truth for the same numbers. | Apps that want to retheme the radius still cannot; the roadmap's gap `foundation-6` is closed for the palette and documented for the scales. |
| R13 | **Two new font families, `--wave-font-family-monospace` and `--wave-font-family-numeric`**, utilities `font-wave-mono` and `font-wave-numeric`, `Text font?: 'base' \| 'monospace' \| 'numeric'`, and `TextWeight` gains `'medium'`. | Fluent has the same three families and four weights (§2.2). | `cn` must recognise the new family names (a few bytes in every bundle, §10). |
| R14 | **Charts are a strategy, not a component:** a guide chapter, an exported `chartPalette` (the 12 fills in the order that keeps neighbouring series apart, as `WaveTokenName`s), and Storybook stories for **Recharts** (SVG, reads `var()` directly) and **Chart.js** (canvas, must resolve colours with `getComputedStyle` and redraw on a theme change). Both are `devDependencies` used by stories only. Visx is covered in the guide as "the SVG recipe". | The two libraries are the SVG and canvas cases between them; every other library is one of the two. | A third library's quirk is not exercised. If Recharts does not support the repo's React or its install breaks (npm 12 install-script policy), the story uses a hand-built SVG chart and the guide still names Recharts (recorded in §15). |
| R15 | **In high contrast every persona fill is white**, as in 0.13, so categorical charts cannot rely on colour there. The guide requires a second encoding (pattern, marker shape, direct label) for any chart, and says so explicitly for high contrast and forced colors. | Avatar initials need one text colour per theme; a distinct-colour high-contrast palette would be a new design. | Charts in high contrast need those second encodings; the stories show them. |
| R16 | **`getTokenStyle(overrides)` is public and server-safe**, returning the custom-property object the provider applies, so a Server Component can write `<html style={getTokenStyle({ brand80: '#c43e00' })}>`. | The `getThemeClassName` precedent (0.4): theme without a client component. | One more public name to keep. |
| R17 | **`WaveContextValue` gains three members**: `tokens` (the merged overrides), `tokenStyle` (the custom-property object, `undefined` when empty) and `applyStylesToPortals`. Hand-built values of the type (test mocks) add them. | `Portal` reads the theme from this context; the three belong next to `themeClassName`. | Listed in "Upgrading from 0.16". |
| R18 | **Builder check skipped** (the maintainer opted out of the questions), and the spec is reviewed by the plan's pre-flight scan instead. | Process, as in Phase 11. | A design gap found during the build costs a ruling in the ledger. |

### 2.2 Fluent v9 reference

Read at `microsoft/fluentui@6220acfb` (2026-10-29); the full notes were written by the researcher during the brainstorm and are summarised here.

| Topic | Fluent v9 | Wave 0.17 |
|---|---|---|
| Nested provider | `shallowMerge(parentTheme, theme)`: a flat per-token merge over the parent's merged theme; the nested provider re-emits every token. | R3: key-by-key merge over the enclosing overrides; the nested root carries the merged map. Same. |
| Mechanism | A class per provider plus an inserted style rule in `document.head` (SSR: an inline style element moved to the head on the client); the CSP nonce comes from the renderer. Variable names are bare (`--colorBrandBackground`). | R2: inline custom properties on the root and the portal wrapper, no style element, no nonce. **Intentional difference**, and the reason for the strict-CSP note (§4.5): Fluent's nonce route works under a strict CSP, an inline `style` attribute does not on the server. Names keep the `--wave-` prefix. |
| `applyStylesToPortals` | Default `true`; `true` passes the root's full class string to portals, `false` only the theme-variable class. Not inherited by nested providers. | R4: default `true`; `false` drops the token overrides only; inherited. |
| Portal wrapper | `div` with the theme class, `dir`, `z-index: 1000000`; an explicit `mountNode` element gets neither class nor `dir`. | Unchanged: `Portal` always sets classes, `dir` and the layer's `z-index`. |
| Theme factories | `createLightTheme(brand)`, `createDarkTheme(brand)` with a 16-stop `BrandVariants` (10 to 160), `createHighContrastTheme()` with none; no contrast validation (the check lives in the Theme Designer tool). | R7, R8: `createBrandTokens(seed \| BrandRamp)` plus a development check of a given ramp. **No Fluent library precedent** for seed to ramp or for the check; the high-contrast theme takes no brand (R9). |
| Token object | `tokens.x === 'var(--x)'`, a hand-written literal; `themeToTokensObject` for custom themes; z-index tokens carry fallbacks. | R5: `waveTokens`, generated from a names tuple with a parity test. |
| Shadows | `shadow2, 4, 8, 16, 28, 64`: ambient and key alphas 0.12 / 0.14 light, 0.24 / 0.28 dark **and high contrast**; brand shadows 0.30 / 0.25. | R10: the same six levels, same alphas; no brand shadows. |
| Palette | 7 status hues (9 to 10 tokens each) and 28 persona hues with three tokens (Background2, Foreground2, BorderActive); in high contrast every hue collapses to three colours. Tag uses none of them; Avatar uses the persona set, Badge the status set. | R11: Wave's 12 persona hues gain the same three roles as `-tint`, `-tint-foreground`, `-border`; high contrast collapses likewise. Wave's status colours already have tints (`success-tint`, ...). |
| Fonts and weights | `fontFamilyBase`, `Monospace` (`Consolas, 'Courier New', Courier, monospace`), `Numeric` (`Bahnschrift` first); weights 400, 500, 600, 700. `Text` has `font` (`base`, `monospace`, `numeric`) and `weight` including `medium`; no tabular-figures styling. | R13, §7: a direct port. |
| Charts | `@fluentui/react-charts` (D3, 22 chart folders); series colours are a hard-coded 40-slot hex `DataVizPalette` (some slots with a dark value), not the palette tokens; **no guidance** on third-party chart libraries. | R14: no chart components; `chartPalette` **references the palette tokens** (CSS variables), not hex, so charts follow the theme; the guide is new ground. |
| Scales | Spacing 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32 px; radius 0, 2, 4, 6, 8, 12, 16, 24, 32, 40 px and circular; stroke 1, 2, 3, 4 px; z-index 0, 1, 1000, 2000, 3000, 4000, 5000, 6000; durations and curves as Wave's. | R12: documented as a mapping to Tailwind's classes (the guide step checks each name against Tailwind 4's documentation before printing it). |

## 3. Token core: `src/lib/tokens.ts` and `src/lib/waveTokens.ts` (server-safe)

`tokens.ts` (small; imported by `WaveProvider`):

- `type WaveTokenName` (the union of the names of the tuple), `type WaveTokens` (`{ readonly [K in WaveTokenName]: string }`, the shape of `waveTokens`), `type WaveTokenOverrides = { [K in WaveTokenName]?: string \| number }` and `type TokenStyle` (`React.CSSProperties` plus `` `--wave-${string}` `` keys).
- `tokenVariable(name: string): string` (internal): the R5 rule, `'paletteRedTint'` to `'--wave-palette-red-tint'`, `'brand80'` to `'--wave-brand-80'`.
- `getTokenStyle(overrides: WaveTokenOverrides \| null \| undefined): TokenStyle \| undefined` (public, R16): `undefined` for an empty or nullish map; skips `undefined` values; numbers become strings; the result's key order follows the input.
- `mergeTokenOverrides(parent, own)` (internal): R3's merge.

`waveTokens.ts` (public, **not imported by any component**):

- `WAVE_TOKEN_NAMES`, one `as const` tuple of every name, grouped and commented like `tokens.css` (theme-independent constants, brand ramp, grey ramp, then the theme group in the file's order, then palette, shadows).
- `waveTokens: WaveTokens`, built from the tuple: `waveTokens.primary === 'var(--wave-primary)'`, typed to the literal `'var(--wave-primary)'` through a type-level conversion if `tsc` stays within +2 s on the dev program, else `` `var(--wave-${string})` `` (recorded in §15).
- `chartPalette` (R14): `readonly WaveTokenName[]` of the 12 fills in this order: `paletteBlue`, `palettePumpkin`, `paletteForest`, `paletteMagenta`, `paletteGold`, `palettePurple`, `paletteTeal`, `paletteRed`, `paletteSteel`, `paletteBrown`, `paletteLavender`, `paletteNavy`. The first six are the most distinct; a chart with more series needs a second encoding (§8).

**Tests (`src/lib/__tests__/tokens.test.ts`, `waveTokens.test.ts`):**

- Parity (R5): parse `tokens.css` (the harness of §6.4) for every `--wave-*` declaration in the constants, ramps and the three theme groups: each is in the tuple, each tuple entry is declared, and `tokenVariable(name)` returns the declared variable for all of them. Adding a variable to `tokens.css` fails this test until the tuple has it.
- `getTokenStyle`: empty and nullish to `undefined`, `undefined` values skipped, numbers stringified, order kept, a name that is not a camelCase identifier is skipped with a development warning (once per name).
- `expectTypeOf` for the shapes in §3 and a `// @ts-expect-error` for a misspelled key.

## 4. `WaveProvider` and `Portal` (P12-01)

### 4.1 Props

```
tokens?: WaveTokenOverrides | null
applyStylesToPortals?: boolean   // @default the enclosing provider's, else true
```

JSDoc (C-DOCS) names Fluent's `theme` (a partial theme) and `applyStylesToPortals` as the counterparts, states R1, R3 and R4 in words, and gives an example (`tokens={{ brand80: '#c43e00' }}` is not the recommended route for a ramp: it points at `createBrandTokens`).

### 4.2 Behaviour

- The root renders `style={{ ...tokenStyle, ...style }}`; `data-wave-theme`, `dir`, classes and everything else are unchanged. With no `tokens` anywhere above, there is **no `style` attribute** at all (the 0.16 markup is byte-identical; a test pins it).
- Context: `tokens`, `tokenStyle` (memoised on the content, so an inline `tokens={{ ... }}` does not re-render consumers) and `applyStylesToPortals`. Outside a provider: `{}`, `undefined`, `true`.
- A **nested provider's root carries the merged map**, not only its own keys: its theme class redeclares every derived token on that element, which would otherwise shadow the enclosing provider's inline values.
- **Portal** (`src/components/portal/Portal.tsx`): the wrapper always gets the theme classes and direction; when `applyStylesToPortals` is true it also gets `style={{ ...tokenStyle, position: 'relative', zIndex: ... }}` (the library's two properties win), when false only the library's two properties. `Portal` is the only place that copies the theme: `Dialog` and `Card` use `createPortal` only into outlets inside the tree.
- A dev warning once (`WaveProvider:tokens:name`) for a key that is not a camelCase identifier, and once (`WaveProvider:tokens:value`) for a value that is not a string or a finite number.

### 4.3 Server and hydration

The root's `style` is rendered on the server, so the first paint is correct without JavaScript. Portals render nothing on the server (unchanged), so only the root needs it.

### 4.4 Tests (`WaveProvider.tokens.test.tsx`, next to the unchanged `WaveProvider.test.tsx`)

- Root style: the custom properties are on the root; no `style` attribute without tokens; the consumer's `style` wins; the key order is stable; `renderToString` carries the style.
- Nesting (Review Focus 1): merge key by key; `null` clears; `undefined` and an `undefined` key inherit; an inner provider with another `theme` keeps the outer overrides (R3); updating the outer provider updates the inner.
- Portals (the acceptance): a Dialog, a Menu, a Popover, a Tooltip and a Toaster opened inside a provider with `tokens` render a wrapper with those properties; a nested provider's overrides reach *its* overlays and not its sibling's; `applyStylesToPortals={false}` renders the theme classes and direction but no token properties, and a nested provider inherits the flag.
- Identity: the context value keeps its identity across re-renders with an equal inline map; StrictMode.
- `getTokenStyle` is the same object shape the provider applies (one function, two callers).

### 4.5 Strict CSP (documentation)

The guide's theming chapter says: overrides are inline `style` custom properties; with a CSP that forbids inline style attributes, the server-rendered `style` is blocked and apps ship overrides in a stylesheet (as in 0.16). The browser pass checks and states what each engine does.

## 5. CSS tokens (P12-02 shadows, P12-03 breadth)

### 5.1 Shadows

`--wave-shadow-{2,4,8,16,28,64}` are declared in every theme group (and listed with the other tokens, so a nested theme re-resolves them), and `@theme inline` maps `--shadow-N` to `var(--wave-shadow-N)`. Light values are today's literals, byte for byte (ambient alpha 0.12, key alpha 0.14). **Dark and high contrast use Fluent's 0.24 ambient and 0.28 key**, with the same offsets and blurs (`--wave-shadow-2: 0 0 2px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.28)`, and so on for 4, 8, 16, 28 and 64). Fluent's brand shadows (0.30 / 0.25) are not added. The guide's "Elevation & Shadows" section gets a per-theme table and loses the sentence that shadows are less visible in dark.

Tests: the three groups declare six shadow tokens each; the light values equal the 0.16 literals; every dark alpha is greater than its light alpha; `@theme inline` maps all six; the CSS build's assertions and `verify-storybook` pass unchanged.

### 5.2 Fonts and weight

`:root` gains `--wave-font-family-monospace` (`Consolas, 'Courier New', Courier, monospace`) and `--wave-font-family-numeric` (`Bahnschrift` followed by the base family's fallbacks: `Bahnschrift, 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif`), Fluent's two stacks; `@theme inline` maps `--font-wave-mono` and `--font-wave-numeric`. `src/lib/cn.ts` recognises both as font families next to `font-wave` (so `cn('font-wave', 'font-wave-mono')` keeps the last, and `font-wave-mono` is not mistaken for a weight). `Text` (§7) uses them. The monospace and numeric families are theme-independent constants.

### 5.3 Palette

For each of the 12 hues, in each theme group: `--wave-palette-<hue>-tint`, `--wave-palette-<hue>-tint-foreground` and `--wave-palette-<hue>-border` (108 declarations). This is the shape of Fluent's persona palette (Background2, Foreground2, BorderActive; §2.2). Fluent derives them from its global hue ramps (light: Background2 is the hue's 40% tint, Foreground2 its 30% shade, BorderActive the hue itself; dark: Background2 a 30% shade, Foreground2 a 40% tint, BorderActive a 30% tint). Wave has the hue only as its one fill per theme, so the builder derives the numbers from the fill by the same steps and then adjusts until the tests below pass: the tests are the arbiter, not the source of the numbers.

- Light: `-tint` a light surface (the fill mixed toward white), `-tint-foreground` the fill darkened until it is 4.5:1 on the tint, on `background` and on `card`, `-border` the fill itself (declared as `var(--wave-palette-<hue>)`, already 5:1 or more on `background`).
- Dark: `-tint` a dark surface (the fill mixed toward black), `-tint-foreground` the fill lightened until it passes the same three surfaces, `-border` the fill itself.
- High contrast: `-tint` is `#000000`, `-tint-foreground` and `-border` are `#ffffff`, like every high-contrast palette value (R15; Fluent's high-contrast palette collapses every hue to three colours too).

Tests (`tokens.test.ts`; every new token is classified, the file refuses unclassified colour tokens): `-tint-foreground` on `-tint`, `background` and `card` at 4.5:1 in all three themes; `-border` on `background` and on `-tint` at 3:1; **the strong fill on `background` at 3:1** (so the 12 fills are usable as chart series; the 0.16 values already pass at 5.01 or more in light and dark); a header-comment table in `tokens.css` listing the hues and their roles. The Avatar, Badge and Tag components are **not** changed to use the tints in this phase (they keep their looks); the tokens are for apps and charts.

## 6. Brand ramp (P12-02)

### 6.1 API (`src/lib/brand.ts`, server-safe, no DOM)

```ts
export type BrandStop = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 150 | 160;
export type BrandRamp = Readonly<Record<BrandStop, string>>;          // hex per stop
export type BrandTokens = { [K in `brand${BrandStop}`]: string };     // a Pick of WaveTokenOverrides
export function createBrandTokens(seed: string | BrandRamp): BrandTokens;
```

`createBrandTokens('#c43e00')` returns `{ brand10: '#...', ..., brand160: '#...' }`, to be passed as `tokens` (or spread into it) or written into a style with `getTokenStyle`. The seed is `#rgb` or `#rrggbb`; anything else warns once in development and returns the default ramp.

### 6.2 Generation (R7)

The module holds the **default ramp** (16 hex values, parity-tested against `tokens.css`'s `--brand-N` fallbacks) and its 16 relative luminances. A seed is converted to OKLCH (hue `h`, chroma `c`); each stop is the colour with hue `h` and the OKLab lightness whose sRGB colour has the stop's target luminance, chroma `min(c, the gamut limit at that lightness)` (binary search per stop), rounded to 8-bit hex. Near-greys (chroma under a small epsilon) yield greys; pure black or white seeds yield the default's neutral behaviour of the same rule. The generated ramp is monotonic in luminance and has the default's luminance at every stop to within the 8-bit rounding, which the tests assert (Review Focus 3).

### 6.3 Checking a full ramp (R8)

`checkBrandRamp(ramp)` (internal, development only, called from `createBrandTokens` when given a `BrandRamp`) reads the stop-to-token pairs from a table in `brand.ts` that lists, for light and dark, each place a semantic token is `var(--wave-brand-N)` (fill, hover, pressed, selected tint and text, ring), the foreground it carries and the surfaces it sits on, and warns once per failing pair: "stop 80 on white is 3.9:1; needs 4.5:1". A test makes the table agree with `tokens.css` (every `var(--wave-brand-N)` use appears in the table), so a theme change that starts using a stop cannot skip the check.

### 6.4 Tests

- `src/styles/__tests__/tokensHarness.ts` (new): the parser and resolver helpers now local to `tokens.test.ts` (`parse`, `declarations`, `resolveValue`, `contrastRatio`, the theme-group lookups) move there **mechanically** (no assertion edited); both test files import it.
- `brand.test.ts`: for **at least 16 seeds** (the default blue, yellow `#ffd400`, lime `#00ff00`, magenta `#ff00ff`, orange `#c43e00`, teal, purple, brown, a pale pink `#ffc0cb`, a dark navy, mid grey `#808080`, black, white, a seed with one channel at 0, a 3-digit hex, an uppercase hex) the ramp, overriding the ramp in the harness, passes **every pair of `tokens.test.ts`'s matrix in light and dark** (the whole matrix: text on surfaces, fills with foregrounds, strokes at 3:1, ring); stop luminances equal the default's; the stops are monotonic; the default seed returns a ramp visibly equal to the default (each channel within 3).
- A full ramp passes through unchanged; a failing ramp warns once per pair, naming the stops (asserted exactly, nothing else logged); an invalid seed warns once and returns the default.
- Server-safety: `renderToString`-free, imports no React; the Button-only and `createBrandTokens`-only bundles in `verify-dist` (§10).

## 7. Text (P12-03)

- `TextOwnProps.font?: 'base' | 'monospace' | 'numeric'` (default `'base'`, the inherited family, no class): `'monospace'` adds `font-wave-mono`, `'numeric'` adds `font-wave-numeric`; nothing else changes, as in Fluent's `Text`.
- `TextWeight` gains `'medium'` (`font-medium`). Every `Record<TextWeight, ...>` map in the repo (Text, Label, the field-label helper) is updated; the type's JSDoc and `Text`'s `weight` prop JSDoc list the four values.
- Tests: the class per `font` value, `cn` keeps a consumer `font-wave-mono` over the default and a consumer weight over the variant's; `medium` renders `font-medium` on Text and Label; the stable class names are unchanged; axe; the stories gain a "Fonts and weights" story.

## 8. Charts (P12-04)

### 8.1 Guide chapter "Charts with WaveUI" (`docs/WAVE-UI-GUIDE.md`, after "Data at Scale")

- Pairing: the 12 fills as series colours in `chartPalette` order; the first six are distinct for common colour-vision types, a seventh series needs a pattern or a marker shape; tints and borders for bands and legends.
- **SVG libraries** (Recharts, visx, Victory): use `waveTokens.paletteBlue` (`var(--wave-palette-blue)`) as `fill` and `stroke`; the colours follow the theme with no code.
- **Canvas libraries** (Chart.js, ECharts canvas): they cannot read `var()`. Resolve once per draw with `getComputedStyle(element).getPropertyValue('--wave-palette-blue')`, **and redraw when the theme changes** (a `MutationObserver` on the provider root's `class` or the `data-wave-theme` attribute, shown in the story).
- Text and axes: `foreground` and `muted-foreground`, never a series colour; grid lines `border`; focus and tooltips use the components.
- **Accessibility:** a chart is `role="img"` with a name and a description, plus a data-table fallback (a visually hidden `<table>` or a "show data" toggle); colour is never the only encoding (patterns, markers, direct labels); **forced colors and high contrast** (R15): all series are white there, so the second encoding is mandatory, and `forced-colors: active` charts draw with `CanvasText`.
- A table of the Fluent chart packages and why WaveUI documents instead of ships (roadmap §1.3).

### 8.2 Stories

`stories/Charts.stories.tsx`, title `Guides/Charts`, with `Recharts` and `ChartJs` stories: a bar chart with six series in `chartPalette` order, the accessible name and description, the data table fallback, a pattern or marker on the second encoding, and the theme toolbar working (the Chart.js story redraws on the theme). The libraries are `devDependencies` (exact versions pinned, `allowScripts` unaffected), imported only by that file, so they cannot enter `dist` (a `verify-dist` check proves the bundle holds no `recharts`/`chart.js` string, §10). The stories pass the a11y gate (`aria-label`, the table) or carry a justified `a11y: { test: 'todo' }` only if the library's own markup fails (recorded).

## 9. Docs

- **Guide §10 Theming:** the theme object, `tokens`, `applyStylesToPortals`, `createBrandTokens`, `waveTokens`, `getTokenStyle`, nesting rules (R3), strict CSP, per-theme shadows, fonts and weight; §4 Color adds the palette table; §5 Elevation the per-theme table; a spacing/radius/stroke mapping table (R12); the new Charts chapter.
- **README:** a short "Theming" block (a brand colour in three lines).
- **CHANGELOG 0.17.0**, **ROADMAP** (Phase 12 "Built as", status line on release), **CLAUDE.md** (the new lib modules, `WaveContextValue`, C-NAMING: `tokens` and the camelCase rule, C-TOKENS: the inline-style route).
- Stories: `WaveProvider` gets "Brand colour", "Nested accent with a dialog" and "Portals without styles" stories (a Dialog and a Menu open inside the nested provider are visible in the story's play-free layout via `defaultOpen`).

## 10. Budgets (`scripts/verify-dist.mjs`)

- **Button-only, MessageBar-only, Tree-only:** byte-identical to 0.16.0 except the `cn` font-family recognition (R13): at most +64 B minified and +32 B gzip each, reported. None of them imports `WaveProvider`, `tokens.ts` or `brand.ts`.
- **A bundle that holds a Portal** (a Dialog-only import): at most +1.0 KiB minified and +0.4 KiB gzip over 0.16.0 (the token handling in `WaveProvider` and `Portal`).
- **`createBrandTokens`-only import:** at most 3 KiB gzip and no React, no component module, no `waveTokens` (new exclusion probe).
- **`waveTokens`-only import:** at most 3 KiB gzip and no component module (new probe); the provider bundle must **not** contain it (exclusion probe: a Dialog-only import holds none of `WAVE_TOKEN_NAMES`, found by one distinctive name such as `paletteSteelTintForeground`).
- `dist` holds no `recharts` or `chart.js` string (R14).
- `MODULE_ONLY_NAMES` gains the internals (`tokenVariable`, `mergeTokenOverrides`, `checkBrandRamp`) as module-only seams; the new public names go through the barrels.

## 11. Real-browser checklist (Chromium, Firefox, WebKit)

1. A page with a nested provider (`tokens` accent, `theme="dark"` inside a light app): its Dialog, Menu, Popover, Tooltip, Select listbox and Toast take the accent and the dark theme; the outer page's overlays do not. In a branded outer provider (`tokens` with brand stops), a nested `tokens={null}` panel keeps the brand ramp in-flow and loses it in its Dialog; confirm per engine.
2. `applyStylesToPortals={false}`: a panel with a token accent opens a Dialog and a Menu that are themed (light or dark) but keep the page's accent; direction and stacking unchanged.
3. Dark theme shadows: Card, Menu and Dialog elevations are visible; light is unchanged; high contrast shows Fluent's values (0.24 and 0.28).
4. Brand: render the default and 6 generated brands (including yellow and lime) across a story page; primary Button, links, selected rows, focus ring, TabList line and ProgressBar are readable; axe in the browser on that page reports no contrast violation.
5. Fonts: `font-wave-mono` and `font-wave-numeric` resolve to real faces (and the fallback when absent); `medium` weight is visibly between regular and semibold.
6. Charts: both stories in light, dark and high contrast (forced-colors emulation too): series colours, the second encoding, the data table, and the Chart.js redraw on the theme toggle.
7. Strict CSP: serve the built Storybook (or a fixture page) with `style-src 'self'` and a server-rendered provider with `tokens`: record whether the overrides apply before and after hydration in each engine, and put the result in the guide (R2).
8. SSR smoke: the fixture page's first paint (JavaScript disabled) shows the overrides.
9. 200% zoom and forced colors: overrides do not break forced-colors rendering (system colours still win).
10. Screen reader (manual): the chart's name, description and table.

## 12. Packages and order

A. **CSS** (P12-02 shadows, P12-03): per-theme shadows, fonts, the palette tints and borders, `cn`, the tokens tests. (First, so the names are final before the typed object.)
B. **TOKENS** (P12-02): `lib/tokens.ts`, `lib/waveTokens.ts`, `chartPalette`, the parity test, the harness extraction.
C. **PROVIDER** (P12-01): `tokens`, `applyStylesToPortals`, `Portal`, context, stories, tests.
D. **BRAND** (P12-02): `lib/brand.ts`, `createBrandTokens`, `checkBrandRamp`, the many-seed tests.
E. **TEXT** (P12-03): `font`, `medium`, stories.
F. **CHARTS** (P12-04): devDependencies, the stories, the guide chapter.
G. **INTEGRATION and DOCS:** barrels, public types, `verify-dist` probes and budgets, class names (none new), CHANGELOG 0.17.0, README, guide, ROADMAP, CLAUDE.md, testing guide.

Order A, B, C, D, E, F, G; D and E may swap. If the schedule forces a cut, F slips to 0.17.x (**Ruling:** the cut line is after E; cost: the charts guide and stories arrive a minor later and `chartPalette` ships with them).

## 13. Testing

- Pure modules (`tokens`, `brand`): table tests, many seeds, edge input (empty, `null`, numbers, unknown names, 3-digit and uppercase hex, `NaN`).
- The CSS tests parse `tokens.css` as text (jsdom has no cascade): every new token is classified in the contrast matrices, which fail on an unclassified colour token.
- Provider and portal behaviour: attributes on wrappers (jsdom has no cascade, so whether a computed colour changes is a browser check, §11).
- Existing suites pass unedited except assertions that pin the literal `--shadow-N` values or the exact `style` of a Portal wrapper (each edit recorded in §15).
- `act()` and `[WaveUI]` output stays clean; warnings are asserted exactly.

## 14. Upgrading from 0.16 (for the CHANGELOG)

1. **Dark and high-contrast shadows change** (stronger in dark): a visual change, no API change. Apps that overrode `--shadow-N` keep their override.
2. **`WaveContextValue` has three new members** (`tokens`, `tokenStyle`, `applyStylesToPortals`): a hand-built value of the type (a test mock) adds them.
3. **`TextWeight` has a fourth value, `'medium'`:** an exhaustive `switch` over it, or a `Record<TextWeight, ...>` of your own, adds a case.
4. Everything else is opt-in: `tokens`, `applyStylesToPortals`, `createBrandTokens`, `waveTokens`, `getTokenStyle`, `chartPalette`, `Text font`, the palette tints and borders, the font families.
5. **A portal now carries the provider's inline `style` when `tokens` is set;** selectors that assumed a portal wrapper has no `style` (rare) need `:not([style])` care.

## 15. Implementation notes

(To be filled during the build: every place the code deliberately departs from this document, each edit to an existing assertion, and the measured sizes.)

- **Task 3, palette tints (§5.3):** **The dark tints are shaded from the hue's light fill, not from the dark fill.** Fluent's dark `Background2` is `shade30` of the same hue ramp whose `primary` is the light `BorderActive`, and Wave's light fill stands for that primary. The dark fills are pastels: shaded to the depth of Fluent's `shade30` they turn muddy and collapse together (lavender and purple 8 apart in RGB, pumpkin and brown 13), while the light fill mixed 40% toward black lands on Fluent's own values (red `#760913` for `#751d1f`, blue `#094171` for `#004377`, purple `#371c57` for `#341a51`). The rest follows §5.3: light tints are the light fill mixed 70% toward white (the lightness of Fluent's `tint40`), and each tint foreground is its theme's fill mixed toward black (light) or white (dark) in 0.1% steps until it is 4.6:1 on the tint, `background` and `card` (11 of the 12 dark ones need no step). `@theme inline` maps the 36 tokens as `--color-palette-<hue>-tint`, `-tint-foreground` and `-border` (the existing "maps every token" test requires it of every tabled token). The tests also gained two guards: every declaration of a theme group except the shadows is in `TOKENS`, so a new colour token cannot skip the contrast classification, and every light and dark tint and tint foreground stays within 10° of its fill's HSL hue at a saturation of 0.2 or more. No existing assertion was edited.
- **Task 5, token core (§3):** **`waveTokens` is typed to the literal** (`waveTokens.primary` is `'var(--wave-primary)'`) through `TokenVariable`, a tail-recursive type-level twin of `tokenVariable` in `tokens.ts`. `tsc -p tsconfig.dev.json --noEmit` took 27.78 s wall on average before and 27.44 s after (three runs each; 3,372,501 instantiations before, 3,484,771 after), so the `` `var(--wave-${string})` `` fallback was not needed. `TokenVariable` is not exported (its accumulator parameters are an implementation detail): `public-types.test.ts` lists it in `INTERNAL_HELPERS`, whose comment now names a third kind of helper, a type-level conversion that only spells out literal types. The tuple holds **202 names** (68 constants and ramps, 134 declared by each theme group), not the "about 340" of R6; the backdrop sits with the tracks group, whose `tokens.css` heading names it, although the file declares it after the palette. `waveTokens` and `chartPalette` are frozen. `collectTokenStyle` skips an `undefined` value before it looks at the key, so `{ 'brand-80': undefined }` is neither applied nor reported. Measured (scratch probes on `dist/index.mjs`, the method of `verify-dist`): a `waveTokens`-only import is 3071 B minified and 969 B gzip with no component module; a Dialog-only import holds no token name; Button-only, MessageBar-only and Tree-only are byte-identical to before (11222/3866, 26858/9324, 47275/16207 B). No existing assertion was edited.
- **Task 6, provider and portal (§4):** **The merged map keeps its identity through a previous-value state, not a signature string:** the provider holds the merged overrides in state and replaces them during render only when their entries differ (same keys in the same order, `Object.is` per value), so an inline `tokens={{ … }}` re-renders no consumer and `tokenStyle` follows the map's identity; a signature string would have needed a `useMemo` whose callback reads the map it does not list (an `exhaustive-deps` warning) or a lossy round trip of invalid values. The two development warnings share one template (`WaveProvider: \`tokens\` skips \`<key>\`: …`, keys `WaveProvider:tokens:name:<key>` and `WaveProvider:tokens:value:<key>`) to keep the provider small. The root takes the consumer's `style` as given when there are no overrides, so the 0.16 server markup is unchanged without `tokens` (pinned literally). The ramps and theme-independent constants stay declared on `:root` only (not redeclared in the theme groups, which keeps the `:root` re-brand route and the legacy `--brand-N` fallbacks), so `tokens={null}` cannot clear them in-flow: the `tokens` and `applyStylesToPortals` JSDoc and R3 state that limit, and §11 item 1 checks it. **Edited existing assertions (R17):** three in `WaveProvider.test.tsx` pin the whole context value and now list the three new members: "inherits through several levels" and "exposes themeClassName, portalContainer and hasProvider" (`toEqual` of the value, which gains `tokens: {}`, `tokenStyle: undefined`, `applyStylesToPortals: true`) and "exports the context value type" (`toEqualTypeOf`); no Portal assertion was edited (none pins the wrapper's whole `style`). **Measured** (verify-dist's `measureImport` on `dist/index.mjs`, before at `c5c2499`): a Dialog-only import grows by 102 B minified and 52 B gzip (70748/23734 to 70850/23786 B), within §10's 1.0 KiB and 0.4 KiB; Menu-, Popover-, Tooltip- and Toaster-only grow by 102 to 104 B and 37 to 42 B gzip. A Dialog-only import holds `DEFAULT_CONTEXT` and the Portal change but not the provider component, so the token handling in `WaveProvider` that §10 means is outside that probe: WaveProvider-only grows by 1325 B and 605 B gzip (2530/1212 to 3855/1817 B, of which `lib/tokens` is about 600 B minified), and an import of `WaveProvider` and `Dialog` by 1374 B and 587 B gzip (71911/24137 to 73285/24724 B). Button-only and MessageBar-only are byte-identical (11222/3866, 26858/9324 B); **Tree-only grows by 52 B and 25 B gzip** (47275/16207 to 47327/16232 B): §10's "none of them imports `WaveProvider`" does not hold for Tree, whose `useDirection` reads the provider's context, so it carries `DEFAULT_CONTEXT` and its three new members (exactly 52 B minified); with `cn`'s 27 B of Task 2, Tree-only is 79 B over 0.16.0's 47248 B minified, past §10's 64 B. A Dialog-only import holds no token name.
- **Task 8, brand ramp (§6.2, R7):** **Chroma and hue follow the default ramp's shape.** The literal rule (the seed's chroma at every stop, cut to the gamut) gives the default seed `#0f6cbd` a ramp up to 17 per channel off the default (stop 70 `#005ea9` for `#115ea3`, stop 10 `#00162f` for `#061724`), failing §6.4's "each channel within 3": the default ramp's OKLCH chroma tapers toward both ends (0.035 at stop 10, 0.149 at 80, 0.015 at 160) and its hue drifts 8° (243° at stop 10, 251.6° at 80). So each stop takes the seed's chroma times the default stop's chroma over stop 80's, and the seed's hue plus the default stop's hue offset from stop 80, then the gamut cut and the luminance search of §6.2. The default seed gives the default ramp exactly, and the light stops stay pale enough for selection fills (lime's stop 150 is `#c5ecbe`, not `#6cff64`); the cost is that a light seed's own colourfulness shows less at the light stops (pale pink `#ffc0cb`'s stop 140 is greyer than the seed). **Rounding is on a safe side per stop (Ruling D).** Of the 27 8-bit colours within one step per channel of the exact colour, a stop takes the one nearest its target luminance that is no lighter (stops 10 to 80, and 140, whose binding pair is the 1.15 step below the hover fill at 150) or no darker (the rest). Plain rounding fails `#8b4513` (light `primary` on `subtle-selected` 4.4907:1); nearest-luminance rounding fails 89 of 4,620 sampled seeds on that pair (4.4926 to 4.4995:1, mostly greens whose red and blue channels sit near 0 and give no fine steps); rounding every stop by the contrast midpoint (stop 140 lighter) fails none but thins `selected-pressed` on `selected-hover` to 1.1532. With the per-stop sides, 61,620 sampled seeds (an HSV sweep and pseudo-random seeds, measured outside the suite) fail no brand pair, and the thinnest margin is 1.1572 (`selected-hover` on `selected` of the grey ramp), the default ramp's own thinnest. The default ramp's thinnest brand pairs: light `selected-pressed` on `selected-hover` 1.1572 against 1.15 (+0.0072) and light `primary` on `subtle-selected` 4.5166 against 4.5 (×1.0037); among the 15 other seeds the thinnest text pair is that one at 4.5168 (`#001f3f`), since stop 80 never rounds lighter. The luminance test's tolerance is therefore one 8-bit step on every channel (the furthest a safe-side neighbour can be), not half. A seed under OKLCH chroma 0.005 gives a grey ramp (black, white, every grey, and one-step-off greys such as `#7f7f80` at 0.0015). A full ramp with missing or invalid stops warns once per page under one key, `createBrandTokens:ramp`, naming every such stop. `DEFAULT_BRAND_RAMP` is a module export for its parity test only; `BRAND_SEEDS` lives in the token harness. The second harness move (`test(tokens): share the contrast matrix`) moved `PALETTE_HUES`, `CONTRAST_PAIRS`, the text-matrix lists and `NOT_TEXT_TOKENS` (the colour classification stays together) and added `forEachContrastPair`; `tokens.test.ts`'s test names, order and statuses are unchanged and no assertion was edited. `tokens.brand.test.ts` also sweeps 1,648 seeds over the matrix's brand pairs (found by resolving the matrix with a marker colour per stop). **Measured:** a `createBrandTokens`-only import is 3581 B minified and 1921 B gzip and holds only `lib/globalRegistry`, `lib/dev` and `lib/brand` (no React, no component, no token-name tuple); Button-only, MessageBar-only and Tree-only are unchanged (11222/3866, 26858/9324, 47327/16232 B).

## 16. Risks

- **Strict CSP** blocks the server-rendered `style` (R2): documented, checked per engine.
- **A semantic override inherited into a dark nested panel** can fail contrast (R3): documented; `tokens={null}` clears.
- **Palette values** are 108 numbers chosen to satisfy the matrix; a later colour tweak must re-run it. The tests are the arbiter, not the Fluent values.
- **Recharts/Chart.js as dev dependencies** add install weight and a React-compatibility risk (R14); the fallback story is a hand-built SVG chart.
- **A typed-token conversion type** (`'var(--wave-primary)'` literals) can slow `tsc`; the fallback is the template-literal type (§3).
- **Brand luminance rule** means a generated button can be darker than the seed (R7); the guide shows the `BrandRamp` route.
