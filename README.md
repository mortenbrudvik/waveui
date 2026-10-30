# @mortenbrudvik/waveui

A React component library inspired by the Fluent UI 2 design language: 80 accessible, composable components built with TypeScript, Tailwind CSS 4 and CSS custom properties, with light, dark and high-contrast themes and right-to-left support.

> This is **not** Microsoft's official `@fluentui/react-components` package.

- [Requirements](#requirements) · [Installation](#installation) · [Quick start](#quick-start)
- [Styles](#styles) · [Theming](#theming) · [Global effects](#global-effects) · [Styling hooks](#styling-hooks)
- [React Server Components](#react-server-components) · [Components](#components) · [Usage notes](#usage-notes)
- [Large data](#large-data) · [Keyboard support](#keyboard-support) · [Hooks and utilities](#hooks-and-utilities) · [Upgrading from 0.16](#upgrading-from-016) · [Upgrading from 0.15](#upgrading-from-015) · [Upgrading from 0.14](#upgrading-from-014) · [Upgrading from 0.13](#upgrading-from-013) · [Upgrading from 0.12](#upgrading-from-012) · [Upgrading from 0.11](#upgrading-from-011) · [Upgrading from 0.10](#upgrading-from-010) · [Upgrading from 0.9](#upgrading-from-09) · [Upgrading from 0.8](#upgrading-from-08) · [Upgrading from 0.7](#upgrading-from-07) · [Upgrading from 0.6](#upgrading-from-06) · [Upgrading from 0.5](#upgrading-from-05) · [Upgrading from 0.4](#upgrading-from-04) · [Development](#development)

## Requirements

- React 19 (`react` and `react-dom` `^19.0.0`)
- Tailwind CSS `^4.1.0` only if you use the [Tailwind path](#tailwind-css-4); the precompiled stylesheet needs no Tailwind
- Browsers: Chrome/Edge 111+, Safari 16.4+, Firefox 128+ (the CSS uses `@property`, `color-mix()`, `:where()` and `:has()`)
- Node.js 22.12+ (`engines`)

## Installation

```bash
npm install @mortenbrudvik/waveui
```

The npm package has always been `@mortenbrudvik/waveui`. Before 0.5 the repository's `package.json` used the name `waveui`, and the 0.4 guide imported from `'waveui'`; import from `@mortenbrudvik/waveui` instead.

## Quick start

Pick **one** styling path.

### Without Tailwind (precompiled CSS)

Import the precompiled stylesheet once and wrap your app in `WaveProvider`:

```tsx
import '@mortenbrudvik/waveui/styles';
import { Button, WaveProvider } from '@mortenbrudvik/waveui';

export function App() {
  return (
    <WaveProvider theme="light">
      <Button appearance="primary" onClick={() => console.log('clicked')}>
        Get started
      </Button>
    </WaveProvider>
  );
}
```

`WaveProvider` is **required** on this path: the stylesheet scopes its base styles (font, colors, box sizing) and its reset of native elements (`button`, `input`, lists, headings, …) to the provider root and to portaled overlays. Components rendered outside a provider are not reset.

### Tailwind CSS 4

Add Wave to your Tailwind entry instead:

```css
/* app.css */
@import 'tailwindcss';
@import '@mortenbrudvik/waveui/tailwind';
```

This adds Wave's tokens to your theme (`layer(theme)`), its scoped base styles to `layer(base)`, and an `@source` for the compiled components, so Tailwind generates every class they use. **Never import `@mortenbrudvik/waveui/styles` as well** in a Tailwind app: the two would define the same utilities twice. The one exception is an app whose own Tailwind build uses a prefix: it imports `./styles` **instead of** `./tailwind`, into a cascade layer between Tailwind's `base` and `utilities` (the CSS is in [Global effects](#global-effects)), and its own utilities cannot collide with Wave's.

Wrap the app in `WaveProvider` here too. It selects the theme and direction, paints the themed background, text color and font, and passes the theme to portaled overlays (dialogs, menus, popovers, toasts).

## Styles

| Import                                                  | What it is                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mortenbrudvik/waveui/styles` (also `/styles.css`)     | Precompiled, **unlayered** CSS: tokens, the provider-scoped base styles and every utility the components use (the only layered block is Tailwind's `--tw-*` fallback, see [Global effects](#global-effects)). No Preflight. For apps without Tailwind, and, imported into a layer, for apps with a prefixed Tailwind build. |
| `@mortenbrudvik/waveui/tailwind` (also `/tailwind.css`) | Tailwind 4 source entry: tokens in `layer(theme)`, base in `layer(base)`, `@source` for the components, the `wave-rtl:` variant. Import it after `@import 'tailwindcss'`.                                                                                                                                                   |
| `@mortenbrudvik/waveui/tokens` (also `/tokens.css`)     | The token source alone (`--wave-*` variables, theme classes and the `@theme inline` mapping), without base styles or `@source`. For custom Tailwind setups, together with `./variants.css`; `./tailwind` is the complete Tailwind entry.                                                                                    |
| `@mortenbrudvik/waveui/variants` (also `/variants.css`) | Wave's `wave-rtl:` direction variant. A custom Tailwind setup built on `./tokens` imports it too, with its own `@source` for the package's `dist` (see below).                                                                                                                                                              |
| `@mortenbrudvik/waveui/preflight.css`                   | Opt-in Tailwind Preflight for the **whole page** (unlayered). Wave does not need it.                                                                                                                                                                                                                                        |
| `@mortenbrudvik/waveui/legacy-tokens.css`               | Deprecated 0.4 compatibility layer (see [Theming](#theming)).                                                                                                                                                                                                                                                               |

**Cascade.** `./styles` is unlayered on purpose: unlayered CSS beats any layered CSS, and Wave's class selectors beat element-level resets such as `*{padding:0}` or `button{background:none}`, so ordinary app resets cannot strip the components. To put Wave inside your own layer order, import it into a layer yourself. Unlayered app CSS (including resets) then wins over it:

```css
@import '@mortenbrudvik/waveui/styles.css' layer(wave);
```

The other side of this: **layered** app CSS, such as a Tailwind build's utilities, loses to the unlayered `./styles` whatever its specificity, so inside `WaveProvider` Wave's zero-specificity base styles override it. If your own CSS is layered, import Wave into a layer ordered before yours; [Global effects](#global-effects) has the recipe for an app with a prefixed Tailwind build.

**Custom Tailwind setups.** An app that builds its own Tailwind entry from `./tokens` instead of `./tailwind` brings its own base styles, and must import the variant and scan the package itself, or Tailwind silently drops the components' mirroring classes (the Switch thumb, the chevrons, the Select arrow):

```css
@import 'tailwindcss';
@import '@mortenbrudvik/waveui/tokens' layer(theme);
@import '@mortenbrudvik/waveui/variants.css';
@source '../node_modules/@mortenbrudvik/waveui/dist';
```

**Preflight.** 0.4 applied Tailwind's Preflight to the whole page; 0.5 does not. If you want it without Tailwind, import it before the Wave styles:

```tsx
import '@mortenbrudvik/waveui/preflight.css';
import '@mortenbrudvik/waveui/styles';
```

## Theming

### Themes and direction

```tsx
import { WaveProvider } from '@mortenbrudvik/waveui';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <WaveProvider theme="dark" dir="rtl">
      {children}
      {/* Providers nest in any order: a light panel inside a dark app works. */}
      <WaveProvider theme="light">{children}</WaveProvider>
    </WaveProvider>
  );
}
```

- `theme`: `'light'` (default), `'dark'` or `'high-contrast'`. `dir`: `'ltr'` (default) or `'rtl'`. `portalContainer`: where overlays render (default `document.body`).
- A nested provider inherits every prop it omits (`theme`, `dir`, `portalContainer`, `motion`, `applyStylesToPortals`; `inputDefaults` and `tokens` merge key by key) from the enclosing provider, so the light panel above stays right-to-left. `portalContainer={null}` sends a nested subtree's overlays to `document.body`.
- The provider renders `<div class="wave-root wave-<theme>" dir data-wave-theme>` with `bg-background text-foreground font-wave text-body-1`; a `className` you pass wins.
- Portaled overlays (Dialog, Drawer, Popover, Menu, listboxes, Tooltip, Toaster) render in a `wave-portal` wrapper that carries the provider's theme classes, direction and font, and its `tokens` overrides unless `applyStylesToPortals={false}` (see [Brand colors and token overrides](#brand-colors-and-token-overrides)).
- `inputDefaults`: `{ size?, appearance? }`, the default `size` and `appearance` of the text inputs and pickers below it (see [Sizes and appearances](#sizes-and-appearances)). A nested provider merges its own defined keys over the enclosing provider's, so `<WaveProvider inputDefaults={{ size: 'small' }}>` inside an app with `appearance: 'filled-darker'` gives small filled-darker fields; omitting the prop inherits the enclosing value.
- `useWaveTheme()` returns `{ theme, dir, themeClassName, portalContainer, inputDefaults, motion, tokens, tokenStyle, applyStylesToPortals, hasProvider }` (outside a provider `inputDefaults` and `tokens` are `{}`, `tokenStyle` is `undefined` and `applyStylesToPortals` is `true`).

**Theme classes.** The tokens are selected by `wave-light` (also `:root`), `wave-dark` and `wave-high-contrast`; `getThemeClassName(theme)` returns them. For dark and high contrast the provider also emits the deprecated 0.4 classes `dark` and `high-contrast`, so 0.4 `.dark` selectors in your CSS and class-based `dark:` variants (`@custom-variant dark (&:where(.dark, .dark *));`) keep working. Tailwind 4's default `dark:` variant follows `prefers-color-scheme`, not a class, and Wave does not define a class-based one. Wave's CSS still honours the two legacy classes, but they set only `--wave-*` variables. `color-scheme` is set on the three `wave-*` theme classes only, never on `:root`, so a page without a provider keeps its own scrollbar and form-control scheme.

**The page outside the provider.** The page's scrollbar and its canvas (the overscroll area and the space below short content) take their colours from `<html>`, which a provider never touches. To match them, put the theme classes on `<html>` as well, which sets `color-scheme` there; in a server-rendered layout that is `<html className={getThemeClassName(theme)}>` (safe in a Server Component). `color-scheme` gives the canvas the browser's default colour for the scheme; for the theme's own background, add `html { background-color: var(--wave-background); }` to your CSS.

**Following the operating system.** `theme` takes one of the named themes, so resolve the OS setting in your app and pass the result:

```tsx
import * as React from 'react';
import { WaveProvider, getThemeClassName, type WaveTheme } from '@mortenbrudvik/waveui';

const DARK = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DARK);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function useSystemTheme(): WaveTheme {
  const dark = React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK).matches,
    () => false, // the server renders light
  );
  return dark ? 'dark' : 'light';
}

export function Shell({ children }: { children: React.ReactNode }) {
  const theme = useSystemTheme();
  // The page outside the provider: its scrollbar and canvas.
  React.useLayoutEffect(() => {
    const classes = getThemeClassName(theme).split(' ');
    document.documentElement.classList.add(...classes);
    return () => document.documentElement.classList.remove(...classes);
  }, [theme]);
  return <WaveProvider theme={theme}>{children}</WaveProvider>;
}
```

A server cannot know the setting, so a server-rendered page paints light first and switches to dark after hydration on a dark system. `<meta name="color-scheme" content="light dark">` in the document head at least draws the scrollbar and canvas in the system's scheme from the start (the theme class on `<html>` takes over once it is set).

### Brand colors and token overrides

A brand color in three lines: `createBrandTokens` builds the 16 brand-ramp tokens from one color, and `WaveProvider tokens` applies them.

```tsx
import { WaveProvider, createBrandTokens } from '@mortenbrudvik/waveui';

const brand = createBrandTokens('#c43e00'); // once, at module scope
export const App = ({ children }: { children: React.ReactNode }) => <WaveProvider tokens={brand}>{children}</WaveProvider>;
```

- **Contrast holds.** Each generated stop keeps the luminance of the default ramp's stop and takes its hue and colorfulness from the seed, so every text, fill, stroke and focus-ring pair of the light and dark themes stays above the floors the themes are tested against (4.5:1 for text, 3:1 for strokes and focus rings), whatever the seed. The cost: stop 80 (the light primary) is the seed's hue at the default's lightness, so a light seed gives a darker button. For exact brand colors pass a full ramp (`createBrandTokens({ 10: '#…', …, 160: '#…' })`, a `BrandRamp`), which is returned unchanged and checked in development: each pair the themes read from it that fails its contrast minimum logs a warning. The high-contrast theme ignores the brand.
- **Any token.** `tokens` takes any token by its camelCase name, the CSS variable without `--wave-` (`primaryForeground`, `brand80`, `paletteRedTint`, `shadow8`, `fontFamilyMonospace`, `zOverlay`); TypeScript refuses a misspelled one. A value is a finite number or a string without `;`, `{`, `}` or `url(` whose quotes, parentheses, square brackets and comments are balanced, with no `!` or backslash outside strings and comments (anything else is skipped with a development warning, so a value can neither add a declaration of its own to the server-rendered `style` nor swallow the declarations after it, and the server and the client render the same overrides). The provider writes them as inline custom properties on its root (also in the server HTML) and on every portal of its subtree, so its dialogs, menus, popovers, tooltips and toasts match it; `applyStylesToPortals={false}` keeps them off the portals, an enclosing provider's overrides (a brand ramp) included; theme and direction stay.
- **Nesting.** A nested provider merges its `tokens` over the enclosing ones key by key, also when it sets another `theme`: set a semantic override in the provider that sets the theme it was chosen for. `tokens={null}` clears the inherited overrides for the theme's own tokens and for the overlays, while the theme-independent ones (the ramps, fonts, stacking, motion) still reach the subtree's own elements through the CSS cascade. A nested accent:

  ```tsx
  <WaveProvider tokens={brand}>
    <AppHeader />
    {/* This panel, and the dialogs and menus it opens, use a crimson primary. */}
    <WaveProvider theme="light" tokens={{ primary: '#c4314b', primaryHover: '#a9283f', primaryPressed: '#7a1c2d' }}>
      <CampaignPanel />
    </WaveProvider>
  </WaveProvider>
  ```

- **Tokens in JavaScript.** `waveTokens` holds every token as the `var()` that reads it, typed (`waveTokens.primary` is `'var(--wave-primary)'`), for inline styles and charts; `chartPalette` lists the 12 palette fills in the order a chart gives them to its series. An SVG chart takes the values as they are: `<Bar dataKey="north" fill={waveTokens[chartPalette[0]]} />` is `var(--wave-palette-blue)` and follows the theme. A canvas chart resolves them with `getComputedStyle`; colors never tell series apart on their own, so give every chart a second encoding (a pattern, a marker, a label). The guide's "Charts with WaveUI" chapter has the recipes, and Storybook's `Guides/Charts` runs them with Recharts and Chart.js.
- **Server Components.** `createBrandTokens`, `getTokenStyle`, `waveTokens` and `chartPalette` are server-safe. `getTokenStyle(overrides)` returns the inline style the provider applies, for an element no provider renders: in a server-rendered layout, `<html style={getTokenStyle(createBrandTokens('#c43e00'))}>` brands the whole page, portals included, since the ramp is theme-independent (a semantic token such as `primary` belongs in `tokens`, because every theme class below `<html>` declares it again).
- **Strict CSP.** Under a Content Security Policy whose `style-src` blocks inline styles, the server-rendered overrides do not apply and hydration does not apply them again: ship them in a stylesheet there (below), and pass no `tokens` (nor `getTokenStyle`), since the overlays and the subtrees rendered in the client would still take them and leave the page half branded.

### Customizing tokens

Every color is a runtime CSS variable prefixed `--wave-`. The Tailwind color utilities use the same name without the prefix: `--wave-muted-foreground` is `text-muted-foreground`, `--wave-primary` is `bg-primary`, `border-primary`, `ring-primary`, and so on.

Override a token for one theme by targeting its theme selector. With `./styles`, load your CSS after Wave's (the selectors have the same specificity); on the Tailwind path any unlayered rule wins over Wave's `theme` layer. A provider's `tokens` win over these rules on the elements that carry them (an inline style beats a stylesheet rule on the same element).

```css
/* All light surfaces */
:root,
.wave-light {
  --wave-muted-foreground: #5c5c5c;
}

/* Dark theme only */
.wave-dark {
  --wave-primary: #7fb8f7;
}
```

**Re-branding.** The primary, hover, pressed, focus-ring and selected colors of the light and dark themes are built from the brand ramp (`--wave-brand-10` … `--wave-brand-160`, declared on `:root`), so overriding the ramp re-themes them: light uses brand-80/70/40 for primary/hover/pressed, brand-80 for the focus ring, brand-160/150/140 for the selected surface and its hover and pressed states and brand-60 for selected text; dark uses brand-110/120/90, brand-100 for the focus ring, brand-20/40/10 and brand-110. High contrast uses fixed colors. `--wave-info` is a fixed color and does not follow the ramp. A ramp written in CSS is not checked: check its contrast against `--wave-primary-foreground` (white in light, black in dark) and the selection pairs, or generate it with `createBrandTokens` (above).

```css
:root {
  --wave-brand-40: #3b1a6b;
  --wave-brand-60: #53258f;
  --wave-brand-70: #5f2aa3;
  --wave-brand-80: #6b2fb3;
  --wave-brand-160: #f3edfb;
}
```

**0.4 variable names.** The 0.4 ramp names (`--brand-80`, `--grey-38`, …) are still read as fallbacks, so overrides of them keep working without any change. Wave no longer defines them, though: app CSS that **reads** them (`var(--brand-80)`, `var(--grey-14)`) gets nothing. The 0.4 **semantic** names (`--primary`, `--background`, `--border`, `--ring`, …) are neither read nor defined, so overrides of them have no effect and reads such as `outline: 2px solid var(--ring)` resolve to nothing. Rename those overrides and reads to `--wave-*` (preferred), or load the deprecated compatibility layer after the Wave styles, which defines the 0.4 names again:

```tsx
import '@mortenbrudvik/waveui/styles';
import '@mortenbrudvik/waveui/legacy-tokens.css';
```

Never load `legacy-tokens.css` in an app that defines shadcn/ui-style variables (`--primary`, `--background`, …): those names collide, which is why 0.5 prefixed them.

### Color tokens

Generated from `src/styles/tokens.css`. A value followed by a ramp or token name is a reference (`var(--wave-brand-80)`); the hex is its default.

<details>
<summary>All 68 color tokens per theme</summary>

| Token (`--wave-…`)        | Light                          | Dark                           | High contrast                  |
| ------------------------- | ------------------------------ | ------------------------------ | ------------------------------ |
| `background`              | `#ffffff`                      | `#292929`                      | `#000000`                      |
| `foreground`              | `#242424`                      | `#ffffff`                      | `#ffffff`                      |
| `card`                    | `#fafafa`                      | `#333333`                      | `#000000`                      |
| `secondary`               | `#f5f5f5`                      | `#333333`                      | `#000000`                      |
| `muted`                   | `#f0f0f0`                      | `#383838`                      | `#1a1a1a`                      |
| `muted-foreground`        | `#616161`                      | `#adadad`                      | `#ffffff`                      |
| `muted-hover`             | `#e0e0e0`                      | `#424242`                      | `#333333`                      |
| `muted-pressed`           | `#d1d1d1`                      | `#2e2e2e`                      | `#4d4d4d`                      |
| `primary`                 | `#0f6cbd` (brand-80)           | `#62abf5` (brand-110)          | `#1aebff`                      |
| `primary-foreground`      | `#ffffff`                      | `#000000`                      | `#000000`                      |
| `primary-hover`           | `#115ea3` (brand-70)           | `#77b7f7` (brand-120)          | `#6ef3ff`                      |
| `primary-pressed`         | `#0c3b5e` (brand-40)           | `#2886de` (brand-90)           | `#00c4d6`                      |
| `destructive`             | `#c50f1f`                      | `#f48a94`                      | `#ff6e6e`                      |
| `destructive-foreground`  | `#ffffff`                      | `#000000`                      | `#000000`                      |
| `error`                   | `#c50f1f`                      | `#f48a94`                      | `#ff6e6e`                      |
| `error-foreground`        | `#ffffff`                      | `#000000`                      | `#000000`                      |
| `subtle`                  | `transparent`                  | `transparent`                  | `transparent`                  |
| `subtle-hover`            | `#f5f5f5`                      | `#333333`                      | `#1f1f1f`                      |
| `subtle-pressed`          | `#ebebeb`                      | `#2e2e2e`                      | `#333333`                      |
| `subtle-selected`         | `#ebebeb`                      | `#383838`                      | `#333333`                      |
| `selected`                | `#ebf3fc` (brand-160)          | `#082338` (brand-20)           | `#003a40`                      |
| `selected-foreground`     | `#0f548c` (brand-60)           | `#62abf5` (brand-110)          | `#ffffff`                      |
| `selected-hover`          | `#cfe4fa` (brand-150)          | `#0c3b5e` (brand-40)           | `#005259`                      |
| `selected-pressed`        | `#b4d6fa` (brand-140)          | `#061724` (brand-10)           | `#006b75`                      |
| `border`                  | `#e0e0e0`                      | `#666666`                      | `#ffffff`                      |
| `stroke`                  | `#d1d1d1`                      | `#666666`                      | `#ffffff`                      |
| `stroke-hover`            | `#c7c7c7`                      | `#757575`                      | `#ffffff`                      |
| `stroke-accessible`       | `#616161`                      | `#adadad`                      | `#ffffff`                      |
| `input`                   | `#d1d1d1`                      | `#666666`                      | `#ffffff`                      |
| `input-filled-darker`     | `#f5f5f5`                      | `#141414`                      | `#000000`                      |
| `input-filled-stroke`     | `transparent`                  | `transparent`                  | `#ffffff`                      |
| `ring`                    | `#0f6cbd` (brand-80)           | `#479ef5` (brand-100)          | `#ffff00`                      |
| `success`                 | `#107c10`                      | `#5db55d`                      | `#3ff23f`                      |
| `success-foreground`      | `#ffffff`                      | `#000000`                      | `#000000`                      |
| `success-tint`            | `#f1faf1`                      | `#052505`                      | `#000000`                      |
| `success-tint-foreground` | `#0e700e`                      | `#54b054`                      | `#3ff23f`                      |
| `warning`                 | `#fde300`                      | `#fde300`                      | `#ffff00`                      |
| `warning-foreground`      | `#242424`                      | `#000000`                      | `#000000`                      |
| `warning-tint`            | `#fffbe6`                      | `#463100`                      | `#000000`                      |
| `warning-tint-foreground` | `#6d5b00`                      | `#fde300`                      | `#ffff00`                      |
| `error-tint`              | `#fdf3f4`                      | `#3b0509`                      | `#000000`                      |
| `error-tint-foreground`   | `#b10e1c`                      | `#f48a94`                      | `#ff6060`                      |
| `severe`                  | `#da3b01`                      | `#e97548`                      | `#ff8c00`                      |
| `severe-foreground`       | `#ffffff`                      | `#000000`                      | `#000000`                      |
| `severe-tint`             | `#fdf6f3`                      | `#411200`                      | `#000000`                      |
| `severe-tint-foreground`  | `#a52c00`                      | `#e97548`                      | `#ff8c00`                      |
| `info`                    | `#0f6cbd`                      | `#479ef5`                      | `#1aebff`                      |
| `info-foreground`         | `#ffffff`                      | `#000000`                      | `#000000`                      |
| `info-tint`               | `#ebf3fc`                      | `#082338`                      | `#000000`                      |
| `info-tint-foreground`    | `#0f548c`                      | `#62abf5`                      | `#1aebff`                      |
| `inverted`                | `#292929`                      | `#ffffff`                      | `#000000`                      |
| `inverted-foreground`     | `#ffffff`                      | `#242424`                      | `#ffffff`                      |
| `inverted-border`         | `transparent`                  | `transparent`                  | `#ffffff`                      |
| `track`                   | `#e0e0e0`                      | `#3d3d3d`                      | `#4d4d4d`                      |
| `skeleton`                | `#e0e0e0`                      | `#3d3d3d`                      | `#333333`                      |
| `rating`                  | `#b86e00`                      | `#f7b538`                      | `#ffff00`                      |
| `presence-available`      | `#107c10`                      | `#54b054`                      | `#3ff23f`                      |
| `presence-busy`           | `#c50f1f`                      | `#f48a94`                      | `#ff6060`                      |
| `presence-away`           | `#a67c00`                      | `#f7b538`                      | `#ffff00`                      |
| `presence-offline`        | `#616161`                      | `#adadad`                      | `#ffffff`                      |
| `presence-oof`            | `#b4009e`                      | `#d696c8`                      | `#ff80ff`                      |
| `presence-glyph`          | `#ffffff`                      | `#000000`                      | `#000000`                      |
| `backdrop`                | `rgb(0 0 0 / 0.4)`             | `rgb(0 0 0 / 0.5)`             | `rgb(0 0 0 / 0.8)`             |
| `card-foreground`         | `#242424` (foreground)         | `#ffffff` (foreground)         | `#ffffff` (foreground)         |
| `secondary-foreground`    | `#242424` (foreground)         | `#ffffff` (foreground)         | `#ffffff` (foreground)         |
| `accent`                  | `#0f6cbd` (primary)            | `#62abf5` (primary)            | `#1aebff` (primary)            |
| `accent-foreground`       | `#ffffff` (primary-foreground) | `#000000` (primary-foreground) | `#000000` (primary-foreground) |
| `input-filled-lighter`    | `#ffffff` (background)         | `#292929` (background)         | `#000000` (background)         |

</details>

Each theme also declares, beside the table's tokens:

- **The persona palette**: 12 hues (`red`, `pumpkin`, `gold`, `forest`, `teal`, `blue`, `navy`, `lavender`, `purple`, `magenta`, `brown`, `steel`) with five tokens each: `--wave-palette-<hue>` (the strong fill, 3:1 on the page), `-foreground` (its text), `-tint` (a surface: light in light, deep in dark), `-tint-foreground` (text on the tint and on the page) and `-border` (the hue's stroke), the last three Fluent's `Background2`, `Foreground2` and `BorderActive` persona roles. Utilities follow the names on the Tailwind path (`bg-palette-blue-tint`; the precompiled `./styles` holds only the fill and foreground utilities Avatar uses); high contrast paints every fill, tint foreground and border white, and every foreground and tint black. The guide's "Persona Palette" section lists the values.
- **The shadows** `--wave-shadow-2` … `--wave-shadow-64`, which the `shadow-N` utilities read: Fluent's values, ambient and key opacity 0.12 and 0.14 in light and the stronger 0.24 and 0.28 in dark and high contrast; on a dark page the border still carries most of a raised surface's separation.

Theme-independent variables on `:root`: `--wave-brand-10` … `--wave-brand-160` (also utilities such as `bg-brand-80`), `--wave-grey-2` … `--wave-grey-98`, the font families `--wave-font-family`, `--wave-font-family-monospace` and `--wave-font-family-numeric` (utilities `font-wave`, `font-wave-mono` and `font-wave-numeric`; `Text font="monospace"` and `font="numeric"` use the last two), the stacking layers `--wave-z-overlay` (1000), `--wave-z-toast` (1100) and `--wave-z-tooltip` (1200), and the motion durations `--wave-duration-*` and curves `--wave-curve-*` (see [Enter and exit motion](#enter-and-exit-motion)).

The three `input-filled-*` tokens (utilities `bg-input-filled-darker`, `bg-input-filled-lighter`, `border-input-filled-stroke`) draw the `filled-darker` and `filled-lighter` appearances of the text inputs and pickers (see [Sizes and appearances](#sizes-and-appearances)); `input-filled-lighter` follows `background`, and the stroke is transparent except in the high-contrast theme.

Contrast of every text and non-text pair is checked per theme by `src/styles/__tests__/tokens.test.ts`. One known limit: the `warning` fill (`#fde300` in light) is a background and accent color only; use `warning-tint-foreground` for warning text and icons.

Other Wave theme values: the type ramp `text-caption-2`, `text-caption-1`, `text-body-1`, `text-body-2`, `text-subtitle-2`, `text-subtitle-1`, `text-title-3`, `text-title-2`, `text-title-1`, `text-large-title`, `text-display`; shadows `shadow-2`, `shadow-4`, `shadow-8`, `shadow-16`, `shadow-28`, `shadow-64` (per theme, above); animations `animate-wave-spin`, `animate-wave-spin-slow`, `animate-wave-pulse`, `animate-wave-indeterminate`, `animate-wave-indeterminate-rtl`; on the Tailwind path, the motion utilities `duration-wave-ultra-fast` … `duration-wave-ultra-slow` and `ease-wave-accelerate-max` … `ease-wave-linear`. Spacing, border radius and stroke widths use Tailwind's default scales (Wave defines no tokens for them and no longer overrides the radius); the guide's "Spacing, Radius and Stroke Scales" maps Fluent's `spacing*`, `borderRadius*` and `strokeWidth*` tokens to the classes.

## Global effects

What adding Wave changes outside its own components:

- **Variables.** `--wave-*` custom properties on `:root` and on the theme classes (`.wave-light`, `.wave-dark`, `.wave-high-contrast`, and the deprecated `.dark` and `.high-contrast`). No unprefixed variables are defined.
- **Base styles and reset, provider-scoped.** They apply inside `.wave-root` (WaveProvider) and `.wave-portal` (overlay wrappers) only, and your own content inside the provider receives them too:
  - Two root rules are plain class selectors (specificity 0,1,0): `.wave-root, .wave-portal` set the font family, text color, 14px font size and 20px line height, and `.wave-root` sets the background color. Override them with a class selector loaded after Wave's CSS, or with the provider's `className`.
  - Every other selector is wrapped in `:where()` (zero specificity), so any unlayered style of yours wins, except the descendant `::before`/`::after` selectors of the box-sizing rule. Pseudo-elements cannot sit inside `:where()` (the selector would be dropped), so those two are specificity (0, 0, 1): an author `::before` or `::after` of the same specificity wins or loses by source order, and any more specific one (a class, attribute, ID or type selector before the pseudo-element) wins. Layered CSS, such as Tailwind utilities, loses to the unlayered `./styles` whatever its specificity, unless you import `./styles` into a layer (see [Cascade](#styles) and the workarounds below). These rules set `box-sizing: border-box` and `border-color: var(--wave-border)` on every descendant (and its `::before`/`::after`), reset the native elements Wave renders (`button`, `input`, `select`, `textarea`, lists, headings, `p`, `figure`, `blockquote`, `dl`, `dd`, `fieldset`, `legend`, `table`, `hr`), set `vertical-align: middle` on `img`, `svg` and `video`, and give `button` and `[role=button]` a pointer cursor.
  - One rule is `!important`, as in Preflight: an element with the `hidden` attribute gets `display: none` (except `hidden="until-found"`), so a display utility (`flex`, `inline-flex`, …) on a component root or on your own element inside the provider cannot keep it visible. Like every rule here it is scoped, so elsewhere `hidden` on a Wave component that sets a display utility relies on Preflight: outside `WaveProvider` (and the overlays' portal wrappers) on the precompiled `./styles` path it takes effect only when you import `preflight.css`, and a custom Tailwind setup on `./tokens` loads no Wave base styles at all, so there it relies on Tailwind's Preflight (part of `@import 'tailwindcss'`); a setup without Preflight adds `[hidden]:where(:not([hidden='until-found'])) { display: none !important; }` itself.
  - This is not a subset of Tailwind's Preflight: Preflight leaves borders `currentColor` and buttons with the default cursor, while Wave uses its border token and a pointer.
  - On the Tailwind path all of them sit in `layer(base)`, so your utilities and unlayered CSS win over them.

  There are no `html` or `body` rules, no global reduced-motion override (each component handles reduced motion itself), and no Preflight unless you import it. The only global rule is Tailwind's `@layer properties` fallback in `./styles`: in browsers without `@property` support (detected by an `@supports` query) it sets the initial values of Tailwind's `--tw-*` custom properties on `*`, `::before`, `::after` and `::backdrop`, and nothing else. It is also the only layered block in that otherwise unlayered file.

- **Utility classes (`./styles`).** The precompiled stylesheet contains the Tailwind utilities the components use (`.flex`, `.p-4`, `.bg-primary`, …) as ordinary class selectors, unlayered, plus Tailwind's `@property --tw-*` registrations. An element of yours with the same class name gets the same style. It contains no other utility: generic names that Tailwind would generate from words in Wave's comments and strings (`.container`, `.collapse`, `.table`, `.shadow`, `.ring`, …) are excluded, so they never restyle your own markup.
- **Theme and variant (`./tailwind`).** Wave adds its color names, the font families `font-wave`, `font-wave-mono` and `font-wave-numeric`, the type ramp, the shadow scale, the `animate-wave-*` animations and the `duration-wave-*` and `ease-wave-*` motion tokens to your Tailwind theme, and defines the `wave-rtl:` variant the components use to mirror glyphs (`./variants` defines it alone, for custom setups on `./tokens`). It matches by the element's own direction (`:dir(rtl)`, with a `[dir=rtl]` fallback for browsers without `:dir()`), so unlike Tailwind's `rtl:` it does not apply inside an LTR subtree of an RTL page; your build can use it too. Tailwind's `rtl:` is unchanged.
  - The variant writes the direction as `:nth-child(n of :dir(rtl))`, which matches the same elements, so your app's CSS minifier keeps it. Vite's default minifier, Lightning CSS, rewrites a bare `:dir()` to a `:lang()` list for targets below Chrome 120, which never matches a page that sets `dir` without a right-to-left `lang`. Your own `:dir()` rules still go through that rewrite in a Vite build (Tailwind's `rtl:` keeps working through its `[dir=rtl]` alternatives). To keep them, set `build.cssTarget` to browsers with `:dir()` (for example `['chrome120', 'edge120', 'firefox128', 'safari16.4']`), or exclude the feature: `css: { lightningcss: { exclude: Features.DirSelector } }` with `import { Features } from 'lightningcss'`.
  - postcss-preset-env at its default stage 2 enables `dir-pseudo-class`, which rewrites `:dir()` in a way that breaks Wave's mirroring (the 0.5 form of the variant too). Turn it off with `features: { 'dir-pseudo-class': false }`. Next.js's built-in PostCSS defaults (stage 3) are not affected.

**Colliding utility names.** Wave's Tailwind color names are unprefixed, because they are the utility vocabulary 0.4 documented and that consumer code uses in `className` overrides. In a shared Tailwind build, or next to another stylesheet that defines the same class names, each of the following names resolves to a single definition in every utility that takes a color (`bg-`, `text-`, `border-`, `ring-`, `outline-`, `fill-`, `stroke-`, `accent-`, `caret-`, `decoration-`, `divide-`, `placeholder-`, `shadow-`, `from-`/`via-`/`to-`, …):

- Shared with shadcn/ui: `background`, `foreground`, `card`, `card-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`.
- Wave's other names: `primary-hover`, `primary-pressed`, `error`, `error-foreground`, `subtle`, `subtle-hover`, `subtle-pressed`, `subtle-selected`, `selected`, `selected-foreground`, `selected-hover`, `selected-pressed`, `muted-hover`, `muted-pressed`, `stroke`, `stroke-hover`, `stroke-accessible`, `success`, `success-foreground`, `success-tint`, `success-tint-foreground`, `warning`, `warning-foreground`, `warning-tint`, `warning-tint-foreground`, `error-tint`, `error-tint-foreground`, `severe`, `severe-foreground`, `severe-tint`, `severe-tint-foreground`, `info`, `info-foreground`, `info-tint`, `info-tint-foreground`, `inverted`, `inverted-foreground`, `inverted-border`, `input-filled-darker`, `input-filled-lighter`, `input-filled-stroke`, `track`, `skeleton`, `rating`, `presence-available`, `presence-busy`, `presence-away`, `presence-offline`, `presence-oof`, `presence-glyph`, `backdrop`, `brand-10` … `brand-160`, and for each palette hue (`red`, `pumpkin`, … `steel`) `palette-<hue>`, `palette-<hue>-foreground`, `palette-<hue>-tint`, `palette-<hue>-tint-foreground` and `palette-<hue>-border`.

Workarounds when your app has its own design system:

- Build your own Tailwind with a prefix, so your utilities cannot collide (`prefix(tw)` makes them `tw:bg-primary`), and import Wave's precompiled `./styles` instead of `./tailwind`, into a layer between Tailwind's `base` and `utilities`. The `@layer` statement comes first:

  ```css
  /* app.css */
  @layer theme, base, wave, components, utilities;
  @import 'tailwindcss' prefix(tw);
  @import '@mortenbrudvik/waveui/styles.css' layer(wave);
  ```

  Do not import `./styles` unlayered (from JavaScript, or without `layer(wave)`) as well. Unlayered, it beats every layered rule, so inside `WaveProvider` its base styles would override your utilities: `tw:text-2xl` on a heading stays 14px, `tw:mb-4` stays 0, `tw:border-red-500` gets Wave's border color, `tw:p-4` and `tw:bg-red-500` on a button have no effect, and `tw:list-disc` stays `none`; a `className="tw:bg-red-500"` on a Wave `Button` loses to its `bg-primary`. In the `wave` layer your utilities win over Wave's base styles and over Wave's own classes (so that `className` works), Wave's styles still win over Tailwind's Preflight (`base`), and Wave's components look the same.

- Never import `legacy-tokens.css` in an app that defines shadcn/ui-style variables.

Namespaced Wave utilities are being considered for 1.0.

## Styling hooks

Every component root and every named part carries a stable class that your own CSS can target: `wave-<component>` on the root and `wave-<component>__<part>` on a part.

```css
/* app.css */
.wave-button__icon {
  color: var(--wave-primary);
}
.wave-tree-item__actions {
  gap: 2px;
}
```

The package exports the same names as typed constants, one per component (`as const`), so a selector built from them is checked by TypeScript:

```tsx
import { buttonClassNames, treeItemClassNames } from '@mortenbrudvik/waveui';

// `.${buttonClassNames.icon}` is '.wave-button__icon'.
export const iconSelector = `.${buttonClassNames.icon}`;

export function checkedRows(tree: HTMLElement) {
  return tree.querySelectorAll(`.${treeItemClassNames.root}[aria-checked='true']`);
}
```

- **Names.** The root class is `wave-` and the kebab-cased component name (`CardHeader` → `wave-card-header`, `Menu.ItemCheckbox` → `wave-menu-item-checkbox`); a part adds `__` and its name (`wave-tag__dismiss-button`). The constant is the camel-cased flat name plus `ClassNames` (`cardHeaderClassNames`). `WaveProvider` keeps `wave-root` and `Portal` `wave-portal`. Components that render no element of their own (Dialog, Popover, Presence, and the trigger and close parts, which clone your element) have none.
- **Where they sit.** The root class is on the element that receives your `className` (Input with `contentBefore` or `contentAfter`: the wrapper; `RadioGroup.Item`: its label). A slot's part class stays when a slot object swaps the element (`icon={{ as: 'img', … }}`).
- **Variants and nesting.** A component built on another carries both classes: ToggleButton is `wave-button wave-toggle-button` (its icon `wave-button__icon wave-toggle-button__icon`), so `.wave-button` styles every button; the menu item kinds carry `wave-menu-item`, and CounterBadge carries `wave-badge`. A public component rendered inside another also gets the parent's part class: SplitButton's halves are `wave-button wave-split-button__primary-action-button` and `wave-button wave-split-button__menu-button`.
- **No state classes.** State is in the `data-*` attributes and ARIA (`.wave-button[data-pressed]`, `.wave-tree-item[aria-checked='mixed']`); there is no `wave-button--pressed`.
- **Cascade.** Wave never styles through these classes and Tailwind generates nothing for them, so your rules are the only ones on them. With the precompiled `./styles` (unlayered), a one-class rule of yours ties with Wave's utility classes and wins when it comes later; on the Tailwind path Wave's utilities sit in Tailwind's `utilities` layer, and any unlayered rule of yours wins.
- **Stable.** The names are public API: no class is removed before 1.0. A renamed part, or a part that becomes a compound member of its own, keeps its old class next to the new one until 1.0; moving a class to another element is listed in the CHANGELOG as a DOM change. Per-part documentation comes with the part props of a later release (P13-01 in the [roadmap](docs/ROADMAP.md)).
- **Server Components.** The constants come from a server-safe module: a Server Component can import them from the entry.

## React Server Components

- Every component and hook module of the package starts with `"use client"`. The entry point, `cn`, the slot helpers, the class-name constants (`buttonClassNames`, …), `hsvToHex`, `hexToHsv`, `createToaster`, the date helpers (`addDays`, `addMonths`, `isSameDay`, `startOfWeek`, `getWeekNumber`), `getInitials`, `partitionAvatarGroupItems`, the breadcrumb helpers (`partitionBreadcrumbItems`, `truncateBreadcrumbLongName`, `truncateBreadcrumbLongTooltip`, `isTruncatableBreadcrumbContent`), `createTableColumn`, the theming helpers (`createBrandTokens`, `getTokenStyle`, `waveTokens`, `chartPalette`, `getThemeClassName`) and the types are server-safe, so a Server Component can import from `@mortenbrudvik/waveui`, read the constants, create a toaster handle, compute dates, build a brand ramp and render Wave components with serializable props (a `tokens` object is one). A DataGrid column with functions (`compare`, `renderCell`) is not serializable: define such columns in a client component.
- A Server Component **cannot dot into a client component**: `Card.Header` throws "Cannot access Header on the server". Every sub-component is therefore also exported under a flat name. Use the flat names in Server Components and either form in client components.
- Every compound can be composed in a Server Component. Parts written there reach the client as lazy references, and the compounds recognise them, so the server HTML and the client behaviour are the same as in a client file: Accordion items, Carousel slides, the options of Combobox, Dropdown and Listbox, the parts and options of TagPicker, DataGrid parts (`DataGrid.SelectionCell` included), the Table parts, Overflow items and dividers, Breadcrumb items (collapsed into the overflow menu too), the TeachingPopover parts, Drawer and Menu triggers, the Drawer header, body and footer parts, the tags of a TagGroup and the halves of an InteractionTag, the header of a `Menu.Group`, the halves of a `Menu.SplitGroup`, List, TabList and Tree items, Nav items, categories, section headers, dividers and app items, the header, body and footer of a NavDrawer, the stars of a Rating or RatingDisplay, the parts of Toast and MessageBar, the bars of a MessageBarGroup, the ColorPicker parts, `SwatchPicker.Row` and the swatches (`ColorSwatch`, `ImageSwatch`, `EmptySwatch`, in rows of the grid layout or the implicit ones), `Tree.ItemPersonaLayout`, a `Label` or `InfoLabel` passed as the `label` of a Field, and a `Button` passed as a MessageBar, SearchBox or Tag dismiss slot.
- Event handlers and other functions cannot be passed from a Server Component; put interactive parts in a `'use client'` component. That includes every windowed or data-driven component: a `virtualWindow` (from the `useVirtualWindow` hook), `renderOption`, a FlatTree's model and `renderItem`, a windowed List's function child and `isSelectionDisabled` are client values. The server HTML of a windowed component holds its first window (the top of the list in the window's `initialViewportSize`), and that of a closed data-mode Combobox or Dropdown no options.
- A `Popover`, `Dialog`, overlay `Drawer` or `NavDrawer`, popup `Menu`, `Combobox`, `Dropdown`, `DatePicker`, `TimePicker` or `TagPicker` rendered on the server with `defaultOpen` (or `open`) is closed in the server HTML and opens once hydrated, so no ARIA reference points at a popup that is not there. `onOpenChange` is not called for it.
- An inline `Drawer` or `NavDrawer` (`type="inline"`) renders in the server HTML: open, or `hidden` when it is closed and kept mounted (`unmountOnClose={false}`).
- A TeachingPopover with a `TeachingPopover.Trigger` written directly inside it starts closed. One that points at its Trigger or a `target` renders its surface once hydrated (the surface sits in a portal). Write `TeachingPopover.Surface` directly inside TeachingPopover too: a Surface rendered by a component of yours is found only once it has mounted, so the server HTML holds the popover's own surface as well (two dialogs with the same title id) until then. A Surface with children of yours is named by its `TeachingPopover.Title` once mounted (as a Dialog is by `Dialog.Title`), so its server HTML has no `aria-labelledby`.

```tsx
// app/layout.tsx (Server Component)
import '@mortenbrudvik/waveui/styles';
import { WaveProvider } from '@mortenbrudvik/waveui';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WaveProvider theme="light">{children}</WaveProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/page.tsx (Server Component): flat names, serializable props only
import {
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DialogContent,
  DialogTrigger,
  Button,
} from '@mortenbrudvik/waveui';

export default function Page() {
  return (
    <Card>
      <CardHeader title="Usage" subtitle="This month" />
      <CardBody>
        <Dialog>
          <DialogTrigger>
            <Button>Details</Button>
          </DialogTrigger>
          <DialogContent title="Usage details">
            Rendered on the server, opened on the client.
          </DialogContent>
        </Dialog>
      </CardBody>
    </Card>
  );
}
```

```tsx
// app/save-button.tsx (client component): handlers and dotted names are fine here
'use client';
import { Button, Toaster, useToastController } from '@mortenbrudvik/waveui';

function SaveButton() {
  const { dispatchToast } = useToastController();
  return <Button onClick={() => dispatchToast({ status: 'success', title: 'Saved' })}>Save</Button>;
}

export function SaveArea() {
  return (
    <Toaster>
      <SaveButton />
    </Toaster>
  );
}
```

| Compound        | Flat names                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Accordion`     | `AccordionItem`, `AccordionTrigger`, `AccordionPanel`                                                                                                                            |
| `Breadcrumb`    | `BreadcrumbItem`                                                                                                                                                                 |
| `AvatarGroup`   | `AvatarGroupItem`, `AvatarGroupPopover`                                                                                                                                          |
| `Card`          | `CardHeader`, `CardPreview`, `CardBody`, `CardFooter`                                                                                                                                           |
| `Carousel`      | `CarouselItem`, `CarouselButton`                                                                                                                                                                   |
| `ColorPicker`   | `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`                                                                                                               |
| `Combobox`      | `ComboboxOption`, `ComboboxOptionGroup` (also `Option`, `OptionGroup`)                                                                                                           |
| `DataGrid`      | `DataGridHeader`, `DataGridHeaderCell`, `DataGridBody`, `DataGridRow`, `DataGridCell`, `DataGridSelectionCell`                                                                   |
| `Dialog`        | `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogFooter`, `DialogClose`                                                                                                   |
| `Drawer`        | `DrawerTrigger`, `DrawerTitle`, `DrawerClose`, `DrawerHeader`, `DrawerHeaderTitle`, `DrawerHeaderNavigation`, `DrawerBody`, `DrawerFooter`                                       |
| `Dropdown`      | `DropdownOption`, `DropdownOptionGroup`                                                                                                                                          |
| `FlatTree`      | `FlatTreeItem` (the row the tree renders; it is not written by hand)                                                                                                             |
| `InteractionTag` | `InteractionTagPrimary`, `InteractionTagSecondary`                                                                                                                              |
| `List`          | `ListItem`                                                                                                                                                                       |
| `Listbox`       | `ListboxOption`, `ListboxOptionGroup` (also `Option`, `OptionGroup`)                                                                                                             |
| `Menu`          | `MenuTrigger`, `MenuPopover`, `MenuItem`, `MenuDivider`, `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemSwitch`, `MenuItemLink`, `MenuGroup`, `MenuGroupHeader`, `MenuSplitGroup` |
| `MessageBar`    | `MessageBarTitle`, `MessageBarActions`                                                                                                                                           |
| `Nav`           | `NavCategory`, `NavItem`, `NavSubItem`, `NavSectionHeader`, `NavDivider`, `NavAppItem`, `NavAppItemStatic`                                                                       |
| `NavDrawer`     | `NavDrawerHeader`, `NavDrawerBody`, `NavDrawerFooter`                                                                                                                            |
| `Overflow`      | `OverflowItem`, `OverflowDivider`                                                                                                                                                |
| `Popover`       | `PopoverTrigger`, `PopoverContent`                                                                                                                                               |
| `RadioGroup`    | `RadioGroupItem` (also `RadioItem`)                                                                                                                                              |
| `Rating`        | `RatingItem`                                                                                                                                                                     |
| `RatingDisplay` | `RatingDisplayItem` (also `RatingItem`)                                                                                                                                          |
| `Skeleton`      | `SkeletonGroup`                                                                                                                                                                  |
| `Stepper`       | `StepperStep`                                                                                                                                                                    |
| `SwatchPicker`  | `SwatchPickerRow`                                                                                                                                                                |
| `Table`         | `TableHeader`, `TableHeaderCell`, `TableBody`, `TableRow`, `TableCell`, `TableSelectionCell`, `TableCellLayout`, `TableCellActions`, `TableResizeHandle`                         |
| `TabList`       | `TabListTab`, `TabListPanel`, `TabListPanels`                                                                                                                                    |
| `TagPicker`     | `TagPickerControl`, `TagPickerGroup`, `TagPickerInput`, `TagPickerButton`, `TagPickerList`, `TagPickerOption`, `TagPickerOptionGroup` (also `OptionGroup`)                       |
| `TeachingPopover` | `TeachingPopoverTrigger`, `TeachingPopoverSurface`, `TeachingPopoverHeader`, `TeachingPopoverTitle`, `TeachingPopoverBody`, `TeachingPopoverFooter`, `TeachingPopoverCarousel`, `TeachingPopoverCarouselNav`, `TeachingPopoverCarouselPageCount`, `TeachingPopoverCarouselFooter` |
| `Toast`         | `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`                                                                                                                           |
| `Toolbar`       | `ToolbarButton`, `ToolbarToggleButton`, `ToolbarRadioGroup`, `ToolbarRadioButton`, `ToolbarGroup`, `ToolbarDivider`                                                              |
| `Tree`          | `TreeItem`, `TreeItemPersonaLayout`                                                                                                                                              |

## Components

80 components, plus the `Portal` and `Presence` utilities. Every component accepts `ref` as a prop (React 19), a `className`, and the native attributes of its element. Storybook (`npm run dev`) shows every component with its props, states and themes.

Your `className` is merged last with `cn()`, so it replaces a conflicting class **of the same variant**: `bg-error` replaces a resting `bg-primary`. A class behind a variant is replaced only by a class with the same variant. That matters for the gated hover and pressed classes (`not-disabled:not-aria-disabled:hover:…` / `…:active:…`) and the state classes (`data-[selected]:…`, `aria-disabled:…`): they stay next to yours and win while their state applies, because they are more specific. A bare `hover:bg-error` therefore does not override a Button's built-in hover color while the Button is enabled. It still paints on hover while the Button is disabled or `aria-disabled`, and on `appearance="transparent"`, which has no hover background. To override the gated and state classes, use the same prefix (`not-disabled:not-aria-disabled:hover:bg-error`, `data-[selected]:bg-error`) or the important modifier (`hover:bg-error!`); see [Buttons](#buttons).

### Buttons and actions

| Component        | Description                                                                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | `appearance` `primary`, `outline` (default), `subtle`, `transparent`; five sizes; decorative `icon` slot with `iconPosition`; `disabled` or `disabledFocusable`; `as` renders a link or router link with correctly typed props. `type="button"` by default.                                                          |
| `CompoundButton` | Button with a `secondaryText` line and an optional `icon` beside the text.                                                                                                                                                                                                                                           |
| `ToggleButton`   | Pressed/unpressed button (`pressed`, `defaultPressed`, `onPressedChange`; `aria-pressed`, or `aria-checked` with a checked `role` such as `checkbox`); `isAccessible` draws the pressed state as a brand fill.                                                                                                       |
| `SplitButton`    | Primary action (with `icon`, `iconPosition`) joined to a menu chevron (`menuIcon` replaces it); `menuButtonProps` takes `Menu.Trigger`'s render props; `menuButtonLabel` names the chevron.                                                                                                                          |
| `MenuButton`     | Button with a chevron and `aria-haspopup="menu"`, for use inside `Menu.Trigger`. Without a label (an icon and/or the chevron) it is compact and needs `aria-label`, `aria-labelledby` or `title` (a development warning asks for one).                                                                               |
| `Link`           | `appearance` `inline` (always underlined), `standalone` or `subtle`; without `href` it is a button (an action such as "Show more"); `disabled` removes the `href`; `as` renders router links.                                                                                                                        |
| `Toolbar`        | `role="toolbar"` with one Tab stop and arrow-key navigation over any child controls (`disabledFocusable` ones included); `orientation`, `size`; toggle and radio state in `checkedValues`; parts `Toolbar.Button`, `.ToggleButton`, `.RadioGroup`, `.RadioButton`, `.Group`, `.Divider` (see [Toolbars](#toolbars)). |

### Inputs and forms

| Component      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Field`        | Label, hint, validation message (`validationState` error, warning, success or none; `error` is the shorthand for an error) and required indicator, wired to the control inside it (library controls read the Field context wherever they are in it); `orientation="horizontal"` puts the label beside the control; `size` sets the label's size and the default `size` of the text inputs and pickers inside; `label` also takes a `Label` or `InfoLabel` element, rendered in place of Field's own `<label>` (see [Forms and `Field`](#forms-and-field)). |
| `Label`        | Form label with a required indicator (`required`: the decorative asterisk, or your own content), `size` and `weight`.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `Input`        | Text input with `size` and `appearance`, `contentBefore`/`contentAfter` slots, `onValueChange(value)` next to the native `onChange`, and an `error` message; `htmlSize` is the native `size` attribute.                                                                                                                                                                                                                                                                                                                                                    |
| `Textarea`     | Multi-line text input with `size`, `appearance` and an `error` message.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Select`       | Styled native `<select>` with `size`, `appearance`, `htmlSize` (visible rows) and an `error` message.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `Checkbox`     | `checked`/`defaultChecked`/`onCheckedChange`, `indeterminate`, `size` (`medium`, `large`) and `shape` (`square`, `circular`), a rich `label` before or after the box (`labelPosition`), `disabledFocusable`, native form support.                                                                                                                                                                                                                                                                                                                          |
| `Switch`       | On/off toggle (`role="switch"`), `onCheckedChange`, `size` (`small`, `medium`), a rich `label` before, after or above it (`labelPosition`), `disabledFocusable`, native form support.                                                                                                                                                                                                                                                                                                                                                                      |
| `RadioGroup`   | Single choice with `RadioGroup.Item` items (a rich `label` each); `orientation`, `disabled`, `onValueChange`, native form support.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `SearchBox`    | Search input with a clear button; `size`, `appearance`, `onValueChange`; input attributes go to the `<input>`. The root draws the field, so `className` and `style` style the field box, and `contentBefore`/`contentAfter` sit beside the text.                                                                                                                                                                                                                                                                                                           |
| `Slider`       | Styled native range input, filled up to the thumb; `size` (`small`, `medium`); `onValueChange(number)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `SpinButton`   | Numeric input with step buttons; `size`, `appearance`; typed text is a draft committed on blur or Enter; `min`, `max`, `step`, `largeStep`, `precision`; `displayValue` shows formatted text; `allowEmpty` allows a `null` value; holding a step button repeats it (see [SpinButton](#spinbutton)).                                                                                                                                                                                                                                                        |
| `Combobox`     | Editable combobox: typing filters the options (`filter` replaces the match, `query` controls the typed text); `multiselect` selects several values; `freeform` makes the typed text the value; a chevron (`expandIcon`) and `clearable`. `Combobox.Option`, `Combobox.OptionGroup`, or the options as data (`items`, `renderOption`) with an optional `virtualWindow` for long lists (see [Multi-select pickers](#multi-select-pickers), [Filtering and async search](#filtering-and-async-search) and [Large data](#large-data)).                                                                                                                                                      |
| `Dropdown`     | Select-only combobox (a button) with typeahead; `multiselect` selects several values; `clearable`, `expandIcon` and `renderValue`. `Dropdown.Option`, `Dropdown.OptionGroup`, or the options as data (`items`, `renderOption`) with an optional `virtualWindow` (see [Large data](#large-data)).                                                                                                                                                                                                                                                                                                                                                                              |
| `Listbox`      | A list of options in the page that holds focus itself (`aria-activedescendant`), single-select or `multiselect`, with typeahead, groups and native form support; `Listbox.Option`, `Listbox.OptionGroup`, or the options as data (`items`, `renderOption`) with an optional `virtualWindow`. The listbox primitives under the pickers are public, for pickers of your own (see [Listbox and custom pickers](#listbox-and-custom-pickers)).                                                                                                                                                                                                    |
| `TagPicker`    | Multi-select combobox that shows the selection as removable tags (Tags in a TagGroup list named "Selected", one Tag size below the picker); `size` (`medium`, `large`, `extra-large`), `appearance`; the input is described by a summary of the selection ("Selected: Apple, Banana"), and additions and removals are announced; `filter` and `query` as in Combobox. A chevron opens the list (`expandIcon`), `clearable` removes every tag, `overflow="count"` keeps the tags on one line with a "+N" count, and `allowCreate` with `onOptionCreate` adds a tag of the user's own text. Composable: `TagPicker.Control`, `.Group`, `.Input` or `.Button` (a trigger without text entry), `.List`, `.Option` (`media`, `secondaryContent`) and `.OptionGroup`; a part without children renders its defaults (see [TagPicker parts and free tagging](#tagpicker-parts-and-free-tagging)). |
| `DatePicker`   | Date input with a calendar dialog (month and year views, week numbers, marked days, optional "Go to today" and Close buttons); `size`, `appearance`; locale-aware format and parse, `minDate`, `maxDate`, `disabledDates`, `onInvalidInput`.                                                                                                                                                                                                                                                                                                               |
| `Calendar`     | The DatePicker's calendar in the page (`role="group"`): month and year views, week numbers, marked days and custom day content, week, work-week or month ranges, "Go to today", native form support (see [Calendar](#calendar)).                                                                                                                                                                                                                                                                                                                           |
| `TimePicker`   | Time combobox (`12h`/`24h`, `step`, `minTime`, `maxTime`); `size`, `appearance`; value is `HH:mm`; `open`/`defaultOpen`/`onOpenChange` control the list; rejected text is kept and flagged (`onInvalidInput`).                                                                                                                                                                                                                                                                                                                                             |
| `ColorPicker`  | Hex value (lowercase `#rrggbb`, or `#rrggbbaa` when not opaque) with a color area, a hue slider, a hex field, preset swatches and an optional opacity slider; with children, your own layout of `ColorArea`, `ColorSlider` and `AlphaSlider` (bound to the picker) and `ColorPicker.HexField`, `.Swatches`, `.Preview` (see [Color](#color)); `shape`. Picking a preset keeps the current opacity (a preset's alpha digits are ignored, with a development warning).                                                                                       |
| `ColorArea`    | 2-D saturation and brightness field for an `HsvColor`, with two hidden range inputs (one Tab stop), pointer and touch dragging; mirrored in RTL.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ColorSlider`  | Hue (default), saturation or brightness slider (`channel`), horizontal or vertical.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `AlphaSlider`  | Opacity slider over a checkerboard; `transparency` shows transparency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `SwatchPicker` | Color swatches from `items` or children: a radio group (the default row layout) or a grid of `SwatchPicker.Row` rows (`layout="grid"`); `focusMode="tab"` makes every swatch a Tab stop; four sizes and `spacing` (see [Swatches](#swatches)).                                                                                                                                                                                                                                                                                                             |
| `ColorSwatch`  | A color swatch of a SwatchPicker (`value`, `color`), with an optional `icon` and `borderColor`; `disabled` crosses it out. A `Tooltip` around it can name it.                                                                                                                                                                                                                                                                                                                                                                                              |
| `ImageSwatch`  | An image swatch of a SwatchPicker: a pattern or texture (`src`) drawn as a covering background.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `EmptySwatch`  | An "add" button in a SwatchPicker (named "Add color" by default) that selects nothing: your `onClick` opens a color dialog, for example.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `Rating`       | Star rating (`role="radiogroup"`); `RatingDisplay` is the read-only version (a fractional value draws a partly filled star; `showValue`, `count` and `compact` add the value and the number of ratings as text).                                                                                                                                                                                                                                                                                                                                           |

### Data display

| Component       | Description                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Avatar`        | Image, initials or icon, with an image-failure fallback and an optional `badge`; `size` (named or 16 to 128 px), `shape`, `color` (`neutral`, `brand`, `colorful` or one of twelve named colors), `active` and `activeAppearance`, an `initials` slot (see [Avatars and people](#avatars-and-people)). |
| `AvatarGroup`   | Avatars in a `stack`, `spread` or `pie` `layout`; `max` adds an overflow button (`99+` past 99) that lists the hidden members. Compound form: `AvatarGroup.Item` and `AvatarGroup.Popover`. |
| `Badge`         | Status or category label: `appearance` `filled`, `tint`, `outline`; semantic `color` (see [Badges](#badges)).                                                                                                                                                                  |
| `CounterBadge`  | Count pill (`99+` above `overflowCount`) or, with `dot`, an unread dot; Badge's `color` palette; `showZero`.                                                                                                                                                                   |
| `PresenceBadge` | Availability badge with a distinct shape per status (`available`, `busy`, `away`, `offline`, `do-not-disturb`, `out-of-office`; `dnd` and `oof` are deprecated). |
| `Tag`           | Chip: `appearance` (`filled`, `outline`, `brand`), `size` (`medium` 28px, `small`, `extra-small`), `shape` (`circular`, `rounded`), `disabled`, a look-only `selected`, `value` (its key in a TagGroup) and the `media` (an Avatar), `icon` and `secondaryText` slots; an optional Dismiss button (`dismissible`, `onDismiss`, `dismissLabel`) that also dismisses on Delete and Backspace. `onDismiss` and `dismissIcon` need `dismissible` (a development warning says so). In a TagGroup focus moves for you when a tag is removed; on its own, move it yourself (see [Tags](#tags)). |
| `TagGroup`      | A set of tags: a toolbar (one Tab stop, arrow keys) or, with `role="list"`, a list; default `size`, `appearance`, `shape`, `dismissible` and `disabled` for its tags; `onDismiss(value)`, focus to the next tag (else the previous one, else `fallbackFocusRef`) when the focused tag is removed; selectable InteractionTags through `value`/`defaultValue`/`onValueChange`, with `name`, `form` and `required`. |
| `InteractionTag` | A tag with an action: `InteractionTag.Primary` (a button, or a toggle in a selecting TagGroup; `media`, `icon`, `secondaryText`) and an optional `InteractionTag.Secondary` (a separate Dismiss button named "Dismiss <text>"); `size`, `appearance`, `shape`, `disabled`, `selected`, `value`. |
| `InfoLabel`     | A real `<label>` (`children`, `htmlFor`, `required`, `size`, `weight`, `disabled`) with an info button after it that shows `info` (text, links or other content) in a note; `openOnHover`, `infoButtonLabel`, `motion` (its note's). Usable as the `label` of a Field.                                |
| `InfoButton`    | A button with the info glyph that shows `info` in a `role="note"` next to it, without moving focus: opens on click, on mouse hover and on keyboard focus (`openOnHover={false}`: click only); Tab from the button enters the note; `size`; the note fades and slides in (`motion`). Named "Information" (`aria-label`). |
| `Persona`       | Avatar with up to four lines of text (`primaryText` to `quaternaryText`), `textPosition` (`after`, `before`, `below`), `presenceOnly` and presence; sizes up to `huge`. |
| `Divider`       | Horizontal or vertical separator, optionally labelled.                                                                                                                                                                                                                         |
| `Image`         | `<img>` with `fit`, `shape`, `shadow`, `bordered`; warns in development when `alt` is missing. Never wider than its parent; with the default `fit` its height follows its width. `fit="none"` keeps the top-left corner in view, `"center"` the middle.                        |
| `List`          | Plain list, selectable listbox (single or multiple) or, with item `action`s, a grid; `navigationMode` (`none`, `items`, `composite`) gives a list without selection arrow keys, or pins the grid; `List.Item onAction`, `disabledSelection` and check marks (`checkmark`); `virtualWindow` with `count` and a function child renders only the items in view of a long list; in a selectable or navigable List item values are unique (development warning; see [Lists](#lists)). |

### Typography

| Component | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `Text`    | Type-ramp text (`variant`; `weight`: `regular`, `medium`, `semibold`, `bold`; `font`: `base`, `monospace`, `numeric`); polymorphic `as`; inherits its color. |

### Layout

| Component   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Card`      | Surface with `Card.Header` (`image`, `action`), `Card.Preview`, `Card.Body`, `Card.Footer`; `appearance`, `size`, `orientation`; optionally selectable (`onSelect`, `selected`, `selectionControl`, `checkbox`) with a `floatingAction` (see [Cards, tabs and carousels](#cards-tabs-and-carousels)). |
| `Accordion` | Disclosure sections (`Accordion.Item`, `.Trigger`, `.Panel`); single (default) or `type="multiple"`; `headingLevel`; panels collapse as they open and close (`Accordion.Panel motion`); item values are unique (development warning).                                                                                                                                                                                                                                                                                    |
| `TabList`   | Tabs (`TabList.Tab`, `.Panel`, `.Panels`) with automatic activation, or manual with `selectTabOnFocus={false}`; `orientation`, `appearance` (`transparent`, `subtle`, `subtle-circular`, `filled-circular`), `size`, a `Tab` `icon` (alone: icon-only); the selection line slides to the new tab (`motion`); tab values are unique (development warning). |
| `Tree`      | Hierarchical tree (`Tree.Item`) with expand/collapse and typeahead; single selection, or checkboxes with a cascading mixed state (`selectionMode="multiple"`); row `actions`, `aside` and `Tree.ItemPersonaLayout`; `navigationMode="treegrid"`; groups collapse as they open and close (`motion`) (see [Trees](#trees)). Nested items are `Tree.Item` elements in their parent's children (directly, in Fragments or from a render function), not rendered by a recursive component; values are unique. |
| `FlatTree`  | A tree from flat data (`useFlatTree(items)`: items with a `parentValue`, in any order) for trees of thousands of items: the visible items as sibling `treeitem`s with their level and position, the nested Tree's keys, single selection and cascading checkboxes, and a `virtualWindow` that renders only the items in view (see [Trees](#trees) and [Large data](#large-data)). |
| `Carousel`  | Slides (`Carousel.Item` children, directly or in Fragments; a component that renders `Carousel.Item` is not a slide) with previous/next, a slide picker and optional auto-rotation with a pause control. `groupSize` (a number or `auto`) shows several at once, `draggable` drags them, `Carousel.Item` `thumbnail` shows thumbnails, `controlsLayout` places the buttons, `Carousel.Button` replaces one, and `motion` (`slide`, `fade` or `null`) with `motionDuration` sets how the page changes. |
| `Overflow`  | Hides items that do not fit in one row (or column, `orientation="vertical"`) and renders an overflow button (`useOverflowMenu` lists the hidden items); items hide by `priority` unless `pinned`, from the end or the start (`overflowDirection`), in groups with `Overflow.Divider`; `buttonPosition`, `minimumVisible`, `asChild` items, `onOverflowChange`; item ids are unique (development warning). The row has a 4px padding, so its items' focus rings are not clipped (see [Overflow](#overflow)). |
| `Grid`      | CSS grid with a column count and token gaps.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Stack`     | Vertical or horizontal stack (`orientation`, `gap`).                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Flex`      | Flexbox container (`direction`, `wrap`, `align`, `justify`, `gap`).                                                                                                                                                                                                                                                                                                                                                                                   |

### Feedback

| Component     | Description                                                                                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MessageBar`  | Inline status message (`info`, `success`, `warning`, `error`) with hidden status text, `MessageBar.Title`, `MessageBar.Actions` that reflow with `layout`, and an optional dismiss button (see [Message bars](#message-bars)).                                                   |
| `MessageBarGroup` | A stack of MessageBars that animates the bars it gains and loses: a removed bar fades out while its row closes, so the bars below glide up; `animate` (`exit-only`, `both`), `motion`. A component of its own, so an import of only MessageBar loads no motion (see [Message bars](#message-bars)). |
| `ProgressBar` | Determinate or indeterminate progress; name it with `label` (inside a `Field`, the Field's label names it); `color`; `indeterminateMotion` replaces the indeterminate sweep.                                                                                                                                                             |
| `Skeleton`    | Loading placeholder (`width`, `height`, `shape`); `Skeleton.Group` marks the loading region busy.                                                                                                                                                                                |
| `Spinner`     | Loading indicator announced as "Loading" (localize with `label`); `appearance="inverted"` for brand surfaces; `delay`.                                                                                                                                                           |
| `Toast`       | Notifications shown by `<Toaster>` (`limit` queues the rest; `motion` replaces their slide, fade and collapse): a `<Toast>` with `Toast.Title`, `.Body`, `.Footer` and `.Close`, or text, dispatched through `useToastController()` or a `createToaster()` handle; a keyboard shortcut, Escape and Delete (see [Toasts](#toasts)). |

### Navigation

| Component    | Description                                                                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Breadcrumb` | Trail of links, buttons or text (`Breadcrumb.Item`, `current`); `maxDisplayedItems` or `overflow="auto"` collapse the middle items into a "…" menu, `size`, `focusMode` (`tab`, `arrow`), `divider` (see [Breadcrumbs](#breadcrumbs)).                                                                                                                                                                                     |
| `Menu`       | Popup menu (`Menu.Trigger`, `Menu.Popover`, which scrolls when it is taller than the viewport) or static menu; `Menu.Item`, `Menu.Divider`; checkbox, radio and switch items bound to `checkedValues`, `Menu.Group`, `Menu.ItemLink`, submenus, `Menu.SplitGroup`, hover opening and context menus; menus fade and slide in (`Menu.Popover motion`) (see [Menus](#menus)). |
| `Nav`        | Side navigation with items, collapsible categories and sub-items; links or buttons; a collapsed category that holds the current page is marked; categories collapse as they open and close (`Nav.Category motion`, and `expandIcon` with `expandIconMotion` for its chevron). `Nav.SectionHeader` (a heading, `headingLevel`), `Nav.Divider` (decorative), `Nav.AppItem` and `Nav.AppItemStatic` (the app's name at the top), and `actions` on `Nav.Item` and `Nav.SubItem` (your buttons beside the link, shown on hover and focus). Every child of its list is a list item (a development warning says so). |
| `NavDrawer`  | Nav in a drawer panel (see [Navigation drawers and app shells](#navigation-drawers-and-app-shells)): `type` `overlay` (a modal or non-modal dialog around a `<nav>`) or `inline` (part of the page layout), `position` (default `start`), `size` (default `small`, 320px), `separator`, `modalType`, `unmountOnClose`, `finalFocusRef`, `backdrop`, `motion`, `backdropMotion`, Nav's value and category props and `onItemSelect(value)` on every activation; `NavDrawer.Header`, `NavDrawer.Body` (`focusMode` `tab` or `arrow`) and `NavDrawer.Footer`. |
| `Hamburger`  | A `subtle` icon-only Button with the navigation glyph, named "Navigation"; inside a NavDrawer it toggles the drawer (`aria-expanded`, `aria-controls`). |
| `Stepper`    | Multi-step progress (`Stepper.Step`), horizontal or vertical, optionally `linear`.                                                                                                                                                                                                                                        |
| `Pagination` | Page buttons with ellipses, previous/next and optional first/last.                                                                                                                                                                                                                                                        |

### Overlays

| Component         | Description                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog`          | Modal dialog (`modalType="alert"` for a confirmation, `"non-modal"` for one the page stays usable around): `Dialog.Trigger` (toggles), `Dialog.Content` (`size` `small`, `medium`, `large`, `full`; `closeLabel` names its Close button, `closeButton` replaces or hides it, `backdrop`, `titleAction`, `unmountOnClose`, `motion`, `backdropMotion`), `Dialog.Title` (`action`), `Dialog.Footer` (stays in view), `Dialog.Close` (see [Dialogs and triggers](#dialogs-and-triggers)). |
| `Drawer`          | Side or bottom panel (see [Drawers](#drawers)): `type` `overlay` (`modalType` `modal`, `alert` or `non-modal`) or `inline`; `position` (`start`, `end`, `left`, `right`, `bottom`), `size` (`small` 320px, `medium`, `large`, `full`), `separator`, `backdrop`, `closeButton`, `closeLabel`, `unmountOnClose`, `motion` (an overlay's slide, an inline drawer's collapse), `backdropMotion`; `Drawer.Trigger` (toggles), `Drawer.Title`, `Drawer.Close`, and the layout parts `Drawer.Header`, `Drawer.HeaderTitle`, `Drawer.HeaderNavigation`, `Drawer.Body` and `Drawer.Footer`, whose separators show while content is scrolled under them. |
| `Popover`         | Non-modal popup anchored to `Popover.Trigger` or a `target`; `side`, `align`; hover cards (`openOnHover`) and context popovers (`openOnContext`); the content fades and slides in (`Popover.Content motion`).                                                 |
| `Tooltip`         | Hover and focus text for its child, as a description or (`relationship="label"`) a name; `open`/`defaultOpen`/`onOpenChange`; `openDelay`, `closeDelay`; a fade (`motion`).                                          |
| `TeachingPopover` | Step-by-step onboarding popover, optionally pointing at a `target`; `primaryAction` and `secondaryAction` replace its buttons, `footerLayout`, `onFinish`, `motion`; composable from parts: `TeachingPopover.Trigger`, `.Surface`, `.Header`, `.Title`, `.Body`, `.Footer` and the carousel parts `.Carousel`, `.CarouselNav`, `.CarouselPageCount`, `.CarouselFooter` (see [Teaching popovers and tours](#teaching-popovers-and-tours)). |

### Tables

| Component  | Description                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Table`    | Static table: `Table.Header`, `Table.HeaderCell` (`sortable`, with your sort state), `Table.Body`, `Table.Row`, `Table.Cell`, and the cell parts `Table.SelectionCell`, `Table.CellLayout`, `Table.CellActions` and `Table.ResizeHandle` (a column's resize separator); `striped`; scrolls horizontally; its state can come from the headless `useTableFeatures` with sort, selection and column-sizing plugins (see [Static tables](#static-tables)). |
| `DataGrid` | Interactive grid (APG grid keyboard model) with row selection and sortable headers; header from children or `columns`, rows from `items` with typed columns (`createTableColumn`) that sort themselves; with `items`, selection and select-all follow the data (`isSelectionDisabled`); `selectOnRowClick`, `selectionAppearance`, `subtleSelection`, `DataGrid.SelectionCell`; `resizableColumns` and column widths (`columnSizingOptions`, `columnWidths`); `virtualWindow` renders only the rows in view; row ids are unique (development warning; see [Sorting and selecting in a DataGrid](#sorting-and-selecting-in-a-datagrid) and [Large data](#large-data)). |

### Provider

| Component      | Description                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WaveProvider` | Theme (`light`, `dark`, `high-contrast`), direction, portal container and `inputDefaults` (the default `size` and `appearance` of the text inputs and pickers) and `motion` (`'none'` turns the default motion of every animated component below it off); `tokens` overrides design tokens in the subtree and its overlays, and `applyStylesToPortals={false}` keeps them off the overlays (see [Brand colors and token overrides](#brand-colors-and-token-overrides)). |

`Portal` renders its children into `document.body` (or the provider's `portalContainer`) inside a themed `wave-portal` wrapper, which also carries the provider's token overrides; use it for your own overlays.

### Motion

| Component  | Description                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Presence` | Shows and hides its child with CSS enter and exit motion: `data-presence` phases, `inert` while it exits, unmounted when the motion ends; `usePresence` is the hook form. The components' own motion is built on it (see [Enter and exit motion](#enter-and-exit-motion)). |

## Usage notes

### Buttons

```tsx
import { Button } from '@mortenbrudvik/waveui';

// Tailwind path. The resting colors are plain classes; the hover and pressed colors use the gate
// prefix, because a bare `hover:` or `active:` class loses to the built-in one.
export const DeleteButton = () => (
  <Button
    appearance="primary"
    className="bg-destructive text-destructive-foreground not-disabled:not-aria-disabled:hover:bg-destructive/90 not-disabled:not-aria-disabled:active:bg-destructive/80"
  >
    Delete
  </Button>
);
```

```tsx
import { Button, Tooltip } from '@mortenbrudvik/waveui';

// Unavailable but focusable: keyboard users reach it and the Tooltip explains why.
export const PublishButton = ({ ready }: { ready: boolean }) => (
  <Tooltip content={ready ? 'Publish the draft' : 'Fill in the required fields first'}>
    <Button appearance="primary" disabledFocusable={!ready}>
      Publish
    </Button>
  </Tooltip>
);
```

- **Hover and pressed colors.** They are gated (`not-disabled:not-aria-disabled:hover:` / `…:active:`), so they never apply to a disabled or `aria-disabled` Button, and they work for `as="a"`. The gate makes them more specific than a bare `hover:` class, so `className="hover:bg-error"` does not override the built-in hover color while the Button is enabled. Like `hover:bg-error!`, a bare `hover:` class still applies on hover while the Button is disabled or `aria-disabled` (the gate switches the built-in class off), and on `appearance="transparent"`, which has no hover background (a pressed ToggleButton has one). To change only the enabled hover color, use the same prefix, which replaces the built-in class; the important modifier (`hover:bg-error!`) also wins while enabled, but keeps applying while disabled. A plain `bg-error` replaces only the resting color. The same applies to CompoundButton, ToggleButton, MenuButton and SplitButton. Class overrides need Tailwind to generate the classes: the precompiled `./styles` contains only the classes Wave itself uses.
- **Non-interactive `as`.** `as="div"`, `as="span"` and other elements that are not interactive by themselves get `role="button"`, a tab stop (`tabIndex={0}`) and Enter (key down) / Space (key up) activation, like a native button; your own `role` or `tabIndex` wins. `as="a"` without `href` is treated the same way; with any `href` (`''` included) it stays a link. `as="a"` shows no link underline. A native `<button>` gets `type="button"` by default; a custom `as` component gets no `type` default, so pass `type` yourself inside a form.
- **`disabled` with a non-native `as`.** Only `button` (the default), `input`, `select` and `textarea` receive the native `disabled` attribute. Every other `as` gets `aria-disabled="true"` and `tabIndex={-1}` instead, which your props cannot override. That covers `a`, `div`, `span` and any custom component, including router links and styled or motion components that render a native `<button>`. Its clicks, Enter and Space are prevented, the click does not reach ancestor `onClick` handlers, and an `<a>` drops its `href` (it keeps `role="link"` when it had an `href`, and has `role="button"` without one). Such an element has no native `:disabled` state, so a component's own `:disabled` styling no longer applies: style it on `[aria-disabled="true"]` (the `aria-disabled:` variant). It leaves the tab order but can still take focus from a mouse click. Every disabled Button also renders `data-disabled`.
- **`disabledFocusable`** (Button, CompoundButton, ToggleButton, MenuButton, SplitButton and Link) marks the control unavailable but keeps it focusable and in the tab order: for a Tooltip that explains why (above), a toolbar item, or a button that disables itself when activated. It renders `aria-disabled="true"`, `data-disabled` and `data-disabled-focusable` instead of the native `disabled`. A click, Enter, Space and implicit form submission do nothing: your `onClick` is not called and the click does not reach ancestor click handlers, while other keys still reach your key handlers. Hover and pressed colors are off, and it wins over `disabled`. A `Toolbar` keeps it in its arrow-key order, and `Menu.Trigger` does not open its menu from it. While it shows its keyboard focus ring it is drawn at full opacity, so the ring keeps its contrast (the disabled look's opacity would dim it). On SplitButton it affects both halves; `primaryActionButtonProps={{ disabledFocusable: true }}` or `menuButtonProps` affect one.
- An `aria-disabled="true"` of yours (without `disabledFocusable`) on an enabled Button shows the disabled look but keeps the Button focusable and its handlers running: guard them yourself, or use `disabledFocusable`, which also blocks activation.
- The `icon` slot is decorative (`aria-hidden`). Give an icon-only Button an `aria-label`, `aria-labelledby` or `title`; it warns in development without one. `iconPosition="after"` renders the icon after the label (an "open in new window" glyph); it follows the writing direction and has no effect on an icon-only button. CompoundButton takes an `icon` too, beside its two lines of text (with only an icon it is an icon-only Button).
- **SplitButton** takes `icon` and `iconPosition` for its primary action, and `menuIcon` to replace the chevron of the menu half. The menu half always shows an indicator: a `menuIcon` that renders nothing (`false`, `''`, `[]`) keeps the chevron and warns in development. `MenuButton.menuIcon` is the opposite: there such a value hides the indicator. A `<button>` or `Button` passed as the `menuIcon` of either is unwrapped, not nested: its children become the glyph and its props are dropped, with a development warning.
- **A busy Button.** Put `<Spinner appearance="inverted" size="extra-small" />` in a primary Button's `icon` slot and say what is happening in the label (`Saving`): the slot is decorative, so the label stays the Button's name, and `inverted` draws the spinner in the Button's text color. A Spinner among the children would add its own label to the name.
- **ToggleButton state.** A ToggleButton reports its state with `aria-pressed`, which ARIA allows only on buttons. Give it `role="checkbox"`, `"radio"`, `"switch"`, `"menuitemcheckbox"`, `"menuitemradio"`, `"option"` or `"treeitem"` and it reports the state with `aria-checked` instead, plus `data-checked` while pressed; with any other role (`tab`, `link`, `menuitem`) it renders neither and warns in development (use the component that owns that role: a TabList tab, a Link, a `Menu.ItemCheckbox`). `data-pressed` is present while pressed in every case, so `data-[pressed]:` styles every toggle. `onPressedChange` is the same with either attribute.
- **`isAccessible`** draws a pressed ToggleButton as a brand fill with on-brand text (`appearance="primary"`: the pressed fill with an inset on-brand stroke) instead of a light tint, so the state does not depend on a subtle color change; use it for icon-only toggles in toolbars. Forced colors keep the usual pressed outline.
- **A `Link` without `href`** is an action, not a navigation: `<Link onClick={showMore}>Show more</Link>` keeps its `<a>` element and gets `role="button"`, a tab stop and Enter/Space activation, like `Button as="a"` without `href`. Give it an `href` whenever it navigates.
- **Types.** `ButtonProps` and `React.ComponentProps<typeof Button>` are the props of a Button rendered as `<button>`. For another element use `ButtonProps<'a'>` (a Storybook story with `as` args: `StoryObj<ButtonProps<'a'>>`). The other polymorphic components (CompoundButton, Link, Text, Toolbar, `Toolbar.Button`, `Menu.ItemLink`, Card and its parts, Stack, Flex, Grid, Tag, Divider) work the same way.

### Forms and `Field`

```tsx
import * as React from 'react';
import { Button, Checkbox, Dropdown, Field, Input } from '@mortenbrudvik/waveui';

export function SignupForm() {
  const [email, setEmail] = React.useState('');
  const error = email.includes('@') ? undefined : 'Enter an email address';
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <Field label="Email" hint="We never share it" error={error} required>
        <Input type="email" name="email" value={email} onValueChange={setEmail} />
      </Field>
      <Field label="Role">
        <Dropdown name="role" defaultValue="user">
          <Dropdown.Option value="admin">Admin</Dropdown.Option>
          <Dropdown.Option value="user">User</Dropdown.Option>
        </Dropdown>
      </Field>
      <Checkbox name="terms" label="I accept the terms" required />
      <Button appearance="primary" type="submit">
        Sign up
      </Button>
    </form>
  );
}
```

```tsx
import { Field, Input, ProgressBar, Switch } from '@mortenbrudvik/waveui';

export function AccountSettings({ backedUp }: { backedUp: number }) {
  return (
    <>
      <Field
        label="Password"
        hint="At least 12 characters"
        validationState="warning"
        validationMessage="This password is common"
        orientation="horizontal"
      >
        <Input type="password" />
      </Field>
      <Field label="Backup" validationState="success" validationMessage="Up to date">
        <ProgressBar value={backedUp} />
      </Field>
      <Switch label="Email me about new sign-ins" labelPosition="before" />
    </>
  );
}
```

- Library controls inside a `Field` are named by its label, described by its validation message and hint, and marked `aria-invalid`/`aria-required`. With `required`, native inputs (`Input`, `Select`, `Textarea`, `Slider`, `SpinButton`, `SearchBox`) also get the native `required` attribute, so the browser blocks an empty submit. The choice and picker controls (`Checkbox`, `Switch`, `RadioGroup`, `Rating`, `SwatchPicker`, `ColorPicker`, `ColorArea`, `ColorSlider`, `AlphaSlider`, `Combobox`, `Dropdown`, `Listbox`, `TagPicker`, `DatePicker`, `Calendar`, `TimePicker`) are required too, also without `name`: the browser blocks the submit until the control is checked, switched on or has a value, so `<Field required><Switch /></Field>` means "must be on". Like a native read-only input, a `readOnly` Combobox, TagPicker, DatePicker or TimePicker does not block the submit (it keeps `aria-required`). Add `noValidate` to a `<form>` that validates in its submit handler.
- **Validation states.** `validationMessage` renders below the control in the style of `validationState`: `error` (the default when a message is given) marks the control `aria-invalid` and announces the message (`role="alert"`); `warning` announces it without making the control invalid; `success` and `none` show it without announcing it. Each state but `none` shows an icon before the message; `validationMessageIcon` replaces it, and `null` removes it. `validationState="error"` without a message marks the control invalid and shows nothing. The Field root carries `data-validation-state`.
- **`error`** is the shorthand for an error message: `error="Enter an email address"`, or `error={true}` to mark the control invalid without a message. It wins over `validationMessage` and `validationState` (a development warning fires when both are set).
- **The hint** stays visible below the message, after it; the control is described by the message, then the hint.
- **`orientation="horizontal"`** puts the label in a start column (a third of the width) beside the control; the message and the hint stay below the control. The label's first line lines up with the control's first line: a Checkbox, Switch or RadioGroup as the first child (or a plain wrapper around them) gets padding above and below its first row (6px at `medium`, 2px at `small`, 10px at `large`), as tall as an Input. The root carries `data-orientation`. The horizontal layout wraps the control, so changing `orientation` on a mounted Field remounts the control (an uncontrolled control loses its state and focus).
- **ProgressBar** reads the Field: the Field's label names a bar that has no name of its own, the message and the hint describe it, and the validation state (error, warning, success) colors its fill unless you set `color`. A progress bar is never invalid or required. Next to another control in a Field's wrapper element, the bar leaves the Field's label to that control (it gets an id of its own).
- **Choice labels.** Checkbox, Switch and `RadioGroup.Item` take any phrasing content as `label` (a link to the terms, a second line of subtext; no other form controls). It names the control; clicking its text toggles the control, and clicking a link inside it follows the link. The box, track or radio lines up with the first line of a label that wraps or has a second line (`className="items-center"` centres it instead). Arrow keys, Home and End pressed on a link inside a `RadioGroup.Item` label stay the link's. `children` are not rendered (a development warning says so). `labelPosition` puts the label `"after"` (default) or `"before"` the Checkbox and Switch, or `"above"` the Switch (settings lists). Checkbox and Switch take `disabledFocusable` (focusable, but not toggled and not submitted) and route your `aria-disabled` to the control.
- A `label`, `hint`, `error` or `validationMessage` that renders nothing (`[]`, such as an empty `errors.map(…)`) counts as absent: no empty message renders, the hint shows, and without `validationState="error"` the control stays valid. A control's own `aria-invalid={false}` wins over the Field's error, which still describes it.
- **Field `size`** (`'small'`, `'medium'`, `'large'`) sets the label's size and the default `size` of the text inputs and pickers inside it (see [Sizes and appearances](#sizes-and-appearances)). The root renders `data-size`.
- **Label elements.** `label` also takes a `Label` or an `InfoLabel` element, which Field renders in place of its own `<label>`. Field points it at the control (`htmlFor`) and gives it the Field's label id, `required`, label `size` and `weight="semibold"`, each only where the element leaves it unset; the element shows its own required indicator, so Field adds no asterisk. The control is named by the label text alone, since an InfoLabel's info button sits outside the `<label>`; a `RadioGroup` is named through `aria-labelledby`. Only the element itself counts, not one inside a Fragment or another element.

  ```tsx
  import { Field, InfoLabel, Input, Label } from '@mortenbrudvik/waveui';

  export function Credentials() {
    return (
      <>
        <Field label={<InfoLabel info="Use at least 12 characters.">Password</InfoLabel>} required>
          <Input type="password" />
        </Field>
        <Field label={<Label required="(required)">Email</Label>}>
          <Input type="email" />
        </Field>
      </>
    );
  }
  ```

- One control per Field. Put wrapper or layout components (a `Tooltip`, your own row) **inside a plain `<div>`** in the Field; the library control inside is then labelled correctly.
- `error` on `Input`, `Select` and `Textarea`: a string renders the message after the control in a `role="alert"` element linked with `aria-describedby`/`aria-errormessage`; `error={true}` only marks the control invalid. Inside a Field that shows its own error, the message is not repeated.
- Value controls take part in native forms when you pass `name`, or when they are required (their own `required`, or a required `Field`): `Checkbox`, `Switch`, `RadioGroup`, `Rating`, `SpinButton`, `SwatchPicker`, `ColorPicker`, `ColorArea`, `ColorSlider` and `AlphaSlider` (the hex of the color; inside a ColorPicker they are bound and the picker submits), `Combobox`, `Dropdown` and `Listbox` (one input per value with `multiselect`), `TagPicker`, `DatePicker` and `Calendar` (ISO `yyyy-mm-dd`) and `TimePicker` (`HH:mm`) render a hidden input, honour `required` and `form`, and reset with their form. `SearchBox` submits through its own `<input name>` and resets with its form too. No name is generated for you.

### Sizes and appearances

The text inputs and pickers (`Input`, `Textarea`, `Select`, `SearchBox`, `SpinButton`, `Combobox`, `Dropdown`, `DatePicker`, `TimePicker` and `TagPicker`) take `size` and `appearance`; `Checkbox`, `Switch` and `Slider` take a `size` of their own.

| Prop         | Values                                                                                    | Default   |
| ------------ | ----------------------------------------------------------------------------------------- | --------- |
| `size`       | `'small'` (24px tall), `'medium'` (32px), `'large'` (40px); type `CoreSize`               | `medium`  |
| `appearance` | `'outline'`, `'underline'`, `'filled-darker'`, `'filled-lighter'`; type `InputAppearance` | `outline` |

`medium` and `outline` are the 0.7 look. `Textarea` sets minimum heights (64, 80 and 96px) instead of a height. `TagPicker` has no `small` (`TagPickerSize`: `'medium'`, `'large'`, `'extra-large'`), and its tags are one Tag size below it: `extra-small` (20px, 12px text) in a medium picker, `small` (24px) in a large one, `medium` (28px) in an extra-large one; they are filled, or outlined on `filled-darker`. The choice controls have their own unions: `Checkbox` `size` `'medium'` (an 18px box) or `'large'` (22px) and `shape` `'square'` or `'circular'`; `Switch` `size` `'small'` (a 32×16px track) or `'medium'` (40×20px); `Slider` `size` `'small'` (a 16px thumb on a 2px rail) or `'medium'` (a 20px thumb on a 4px rail). The icon buttons of the pickers (clear, expand, calendar) scale with `size` and keep a 24×24px target at every size; the step buttons of `SpinButton` are 24, 32 and 40px wide.

```tsx
import { Field, Input, WaveProvider } from '@mortenbrudvik/waveui';

export function CompactForm() {
  return (
    // Small filled fields below this provider, unless a Field or a control says otherwise.
    <WaveProvider inputDefaults={{ size: 'small', appearance: 'filled-darker' }}>
      <Field label="Name">
        <Input />
      </Field>
      <Field label="Email" size="large">
        <Input type="email" appearance="outline" />
      </Field>
    </WaveProvider>
  );
}
```

- **Resolution order.** `size`: the control's own prop, then the surrounding `Field`'s `size`, then `WaveProvider` `inputDefaults.size`, then `medium`. `appearance`: the control's own prop, then `inputDefaults.appearance`, then `outline`. A Field or provider size that the control does not offer is skipped: a `TagPicker` in a `small` Field is `medium`. `Checkbox`, `Switch` and `Slider` read neither the Field's `size` nor `inputDefaults`.
- **`inputDefaults`.** `WaveProvider` takes `{ size?, appearance? }` (`InputDefaults`). A nested provider merges its own keys over the enclosing provider's, and `useWaveTheme()` returns the result.
- **Field `size`.** It sets the label's type ramp (`caption-1`, `body-1`, `body-2`) and, with `orientation="horizontal"`, the label's top padding, so its first line stays centred on a 24, 32 or 40px control. The validation message and the hint keep their size. Without a `size`, the label follows `inputDefaults.size`.
- **Filled appearances.** `filled-darker` and `filled-lighter` draw a fill from the `input-filled-*` [tokens](#color-tokens) and no visible stroke, so a filled field needs a visible label (a placeholder is not one). Put `filled-darker` on the page background and `filled-lighter` on a surface other than the page background (a card, a panel): `filled-lighter` is the page background color. Windows High Contrast (forced colors) and the high-contrast theme draw a boundary on every appearance. `underline` has only a bottom stroke.
- **The focus and error looks** are the same in every appearance: the bottom border is 2px in the focus color while the field has focus, and an invalid field keeps its other borders red, also while it is focused (`underline` shows the focus indicator alone).
- **`htmlSize`.** The native `size` attribute of `Input` (the width in characters) and `Select` (the number of visible rows) is `htmlSize`. A number as `size` still sets the attribute, but is deprecated: it warns once in development and is removed in 1.0. On `Slider` a numeric `size` has no effect and warns once.
- **Styling hooks.** Every one of these controls renders `data-size`, and the text inputs and pickers `data-appearance`, with the resolved value, on the element that receives your `className` (the `<input>`, `<textarea>` or `<select>`, or the wrapper for `Input` with `contentBefore`/`contentAfter` and for the composite controls). `Checkbox` also renders `data-shape`. Target them with `[data-appearance=underline]` in CSS or `data-[appearance=underline]:` in Tailwind.

### SpinButton

```tsx
import * as React from 'react';
import { SpinButton } from '@mortenbrudvik/waveui';

export function Prices() {
  const [price, setPrice] = React.useState(12.5);
  const [quantity, setQuantity] = React.useState<number | null>(null);
  return (
    <>
      <SpinButton
        aria-label="Price"
        value={price}
        onValueChange={setPrice}
        step={0.5}
        precision={2}
        displayValue={`$${price.toFixed(2)}`}
        className="w-full"
      />
      <SpinButton
        aria-label="Quantity"
        allowEmpty
        min={1}
        value={quantity}
        onValueChange={setQuantity}
      />
    </>
  );
}
```

- **`displayValue`** is the text shown for the value while the field is not being edited (`$12.50`), and its `aria-valuetext`. While the field has focus and can be edited it shows the plain number, so typing edits `12.5`, not `$12.50`. It applies only to a controlled `value`: an uncontrolled SpinButton ignores it and warns in development.
- **`precision`** (0 to 20) rounds every committed value, typed or stepped, to that many decimals. It does not pad: `precision={2}` shows `12.5`, so use `displayValue` for `12.50`.
- **`allowEmpty`** lets the value be `null`: clearing the text and committing it (blur or Enter) empties the field, `onValueChange` receives `null`, and `aria-valuenow` is omitted. The prop takes the literal `true`; a `boolean` variable fits neither prop type, so branch the JSX or spread `{ allowEmpty: true, value }`. The deprecated `onChange` is not offered in this mode. A `required` SpinButton (or in a required Field) blocks submitting an empty value. Stepping from an empty value starts at 0 and then clamps to `min`/`max`. Without `allowEmpty`, clearing the text still restores the last value.
- **Holding a step button** repeats the step after 300 ms, faster after that, with a mouse, a finger or a pen. A short press steps once, when it is released, so a finger that starts a scroll on a button changes nothing. The step buttons never take focus.
- **Width.** An unsized SpinButton is as wide as in 0.7 (114px at `medium`); a root you size (`className="w-full"`) widens the input. Its height follows `size` like the other fields.

### Rating

```tsx
import { Rating, RatingDisplay } from '@mortenbrudvik/waveui';

export function Reviews() {
  return (
    <>
      <Rating aria-label="Your rating" step={0.5} color="brand" defaultValue={3.5} />
      <RatingDisplay value={4.6} color="neutral" showValue count={1160} />
      {/* One Rating.Item per value from 1 to max draws the stars yourself. */}
      <Rating aria-label="Your mood" max={3} defaultValue={2}>
        <Rating.Item value={1} />
        <Rating.Item value={2} />
        <Rating.Item value={3} iconFilled="♥" iconOutline="♡" />
      </Rating>
    </>
  );
}
```

- **Half stars.** With `step={0.5}` each star is still one pointer target (24×24px or larger): a click or tap chooses the half or the whole star by the pointer's position over it (the start half mirrors in RTL). Two visually hidden radios per star serve the keyboard and screen readers, named "2.5 stars" and "3 stars" (`labels.star`). The arrow keys move by half a star. With a `name`, the hidden input submits `2.5`. A controlled value between two steps (2.7) checks no radio and is drawn as the step below it; the arrow keys move it to the next or previous step.
- **`color`** colors the filled stars: `'marigold'` (the default), `'brand'` or `'neutral'` (`RatingColor`); unfilled stars keep a 3:1 outline in every color. The root renders `data-color`. On `Rating` and `RatingDisplay` this narrows the `color` string that `React.HTMLAttributes` declares.
- **Icons.** `iconFilled` and `iconOutline` replace the star glyphs, as a pair (a filled and an unfilled star must differ by shape): set only one and a development warning asks for the other. They are decorative. A partly filled star in `RatingDisplay` clips the filled glyph over the outline glyph.
- **`Rating.Item`** (`RatingDisplay.Item`, `RatingItem`) renders one star from its root's context. When `children` render content, they replace the generated stars: pass one item per value from 1 to `max`. An item's own icon pair wins over its root's. A duplicated value, a value that is not a whole number from 1 to `max` and a missing value each warn once in development. A `compact` RatingDisplay ignores its children.

### Value callbacks

`onChange` is the native DOM change event (`Input`, `Textarea`, `Select`, `Slider`). State callbacks are named after the state and receive the value:

| State                                                      | Props                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| single value                                               | `value` / `defaultValue` / `onValueChange(value)`                                          |
| several values (`multiselect` Dropdown, Combobox, Listbox) | `value` / `defaultValue` / `onValueChange(values)`                                         |
| typed text (Combobox, TagPicker)                           | `query` / `defaultQuery` / `onQueryChange(query)`                                          |
| checked                                                    | `checked` / `defaultChecked` / `onCheckedChange(checked)`                                  |
| open                                                       | `open` / `defaultOpen` / `onOpenChange(open)`                                              |
| checked values (Menu, Toolbar)                             | `checkedValues` / `defaultCheckedValues` / `onCheckedValuesChange(checkedValues, details)` |
| checked items (Tree)                                       | `checkedItems` / `defaultCheckedItems` / `onCheckedItemsChange(checkedItems, details)`     |

Extra data goes in a second, optional `details` argument: Dialog and Drawer call `onOpenChange(open, details)` with `details.reason` and `details.event` (see [Dialogs and triggers](#dialogs-and-triggers)), Menu and Toolbar call `onCheckedValuesChange(checkedValues, details)` with `details.name`, `details.checkedItems` (the group's new values) and `details.event` (see [Menus](#menus)), Tree calls `onCheckedItemsChange(checkedItems, details)` with `details.value`, `details.checked` and `details.event` (see [Trees](#trees)), and Calendar calls `onValueChange(date, details)` with `details.range`, the selected days (see [Calendar](#calendar)). These fire only when the value changes. Event callbacks such as `onPageChange`, `onStepChange`, `Tree`'s and `NavDrawer`'s `onItemSelect` and `TagGroup`'s `onDismiss` fire on every activation, also when the current item is activated again. Array props that Wave only reads (`openItems`, `expandedItems`, `checkedItems`, `selectedItems`, `columns`, `options`, `items`, `steps`, …) accept readonly arrays such as `as const` values; the callbacks receive a new, mutable array. The 0.4 names still work as deprecated aliases that warn once in development; see the [CHANGELOG](CHANGELOG.md) for the full table.

### Composite controls

Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker and TimePicker render a wrapper around their focusable element. `id`, the naming and validation ARIA attributes (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`; on Checkbox and Switch also `aria-disabled`), `tabIndex`, `autoFocus`, focus and key handlers (and native input attributes for text fields) go to the focusable element; `className`, `style`, `hidden`, `data-*`, other `aria-*` attributes and `ref` stay on the wrapper. `controlRef` gives you the focusable element. A composite with trigger parts (TagPicker) sends them to whichever trigger renders: `TagPicker.Input`, or `TagPicker.Button` (pass handlers and `ref` on the Button itself). SearchBox and SpinButton draw their field (border, background, focus and invalid look) on that wrapper, so `className`, `style` and `hidden` size, style and hide the visible field, as on Input's slot wrapper.

`Input` with `contentBefore`/`contentAfter` content also renders a bordered wrapper `<span>`, which receives `className`, `style` and `hidden` (so they size and hide the visible field); unlike the controls above, `ref`, `id`, `aria-*` and `data-*` stay on the `<input>`.

`ColorSlider`, `AlphaSlider` and `ColorPicker.HexField` route the same props to their `<input>` and take `controlRef`. `ColorArea` is a group around two inputs: the group keeps `aria-label`, `aria-labelledby` and `aria-describedby` (a Field's label names it), with `className`, `style`, `data-*` and `ref`; both inputs get `aria-invalid` and `aria-errormessage`; `autoFocus` and `controlRef` reach the saturation input; `tabIndex` reaches the input that holds the Tab stop.

`Listbox` has no wrapper: every prop, `ref` and handler go to its `<ul role="listbox">`, which has focus. `Calendar` keeps them on its `role="group"` root, which the Field's label names. A swatch (`ColorSwatch`, `ImageSwatch`, `EmptySwatch`) puts its `ref`, `className`, `style`, name and other props on its own `<button>` in every layout (in the grid layout, a `role="gridcell"` element wraps it), so a `Tooltip` around a swatch reaches the element that has focus.

### Multi-select pickers

```tsx
import * as React from 'react';
import { Combobox, Dropdown, Field } from '@mortenbrudvik/waveui';

export function PizzaForm() {
  const [toppings, setToppings] = React.useState<string[]>(['cheese']);
  return (
    <form>
      <Field label="Toppings">
        <Dropdown
          multiselect
          value={toppings}
          onValueChange={setToppings}
          name="toppings"
          clearable
        >
          <Dropdown.Option value="cheese">Cheese</Dropdown.Option>
          <Dropdown.Option value="olives">Olives</Dropdown.Option>
          <Dropdown.Option value="peppers">Peppers</Dropdown.Option>
        </Dropdown>
      </Field>
      <Field label="Deliver to" required>
        <Combobox multiselect defaultValue={['oslo']} name="cities">
          <Combobox.Option value="oslo">Oslo</Combobox.Option>
          <Combobox.Option value="bergen">Bergen</Combobox.Option>
          <Combobox.Option value="trondheim">Trondheim</Combobox.Option>
        </Combobox>
      </Field>
    </form>
  );
}
```

- **Values.** `multiselect` makes `value`, `defaultValue` and `onValueChange` arrays, in selection order: checking an option appends its value, unchecking removes it. Write `multiselect` as a literal: `multiselect={flag}` with a `boolean` variable is a type error, since the two modes take different value types; render two elements instead. `React.ComponentProps<typeof Dropdown>` is still the single-select `DropdownProps`, and `DropdownProps<true>` (`ComboboxProps<true>`, `ListboxProps<true>`) is the multi-select shape.
- **Toggling.** The listbox is `aria-multiselectable`, and every option draws a checkbox square with the check inside (`checkIcon` replaces the check). Enter, Space (Dropdown) and a click toggle an option and keep the list open; Tab, Escape and Alt+ArrowUp close it without committing.
- **What shows.** The Dropdown button and the Combobox input show the selected labels in selection order, joined with `", "` (`labels.selection`; values without an option are left out), in place of the placeholder. Dropdown's `renderValue(values)` replaces that content.
- **Typing in a multi-select Combobox.** Focusing the input selects the labels, so typing, pasting or an IME composition replaces them with a query that filters the options; a toggle, a close or a blur clears the query and shows the labels again, selected while the input has focus. Backspace and Delete only edit the text: the options, the clear button and a form reset change the value. `freeform` is not available with `multiselect`.
- **Announcements.** Each toggle the user makes is announced through a polite live region ("Olives added, 2 selected", from `labels.added` and `labels.removed`); a controlled change, a clear or a form reset is not. A single-select picker adds no announcer regions to `document.body`.
- **Forms.** `clearable` clears every value. A form submits one entry per value (read them with `FormData.getAll(name)`), `required` needs one value, and a form reset restores `defaultValue`, compared by content, so restoring the same values reports nothing. The deprecated `onOptionSelect` fires on every toggle.
- **For both modes.** `onActiveOptionChange(value)` (Dropdown, Combobox, Listbox) reports the option `aria-activedescendant` points at, after it changes (opening, the keys, typeahead, the pointer, a filter change), and `null` when the list closes. `disabledOptionsFocusable` keeps disabled options in the keys (the arrow keys, Home/End, PageUp/PageDown and typeahead; in a Combobox the arrow keys), but they are never selected: Enter, Space and a click do nothing on them and the list stays open. Dropdown's `expandIcon` replaces the chevron as Combobox's does (`false` hides it), and `renderValue(value)` renders the button's content while a value is selected; keep it non-interactive, since its text is the combobox's value.

### Filtering and async search

Combobox and TagPicker take a `filter` of yours and a controllable query. A search on a server keeps every option the server returns (`filter={() => true}`) and searches as the query changes:

```tsx
import * as React from 'react';
import { Combobox } from '@mortenbrudvik/waveui';

export function CountrySearch({ search }: { search: (query: string) => Promise<string[]> }) {
  const [value, setValue] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<string[]>([]);
  React.useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void search(query).then((names) => {
        if (current) setResults(names);
      });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, search]);
  return (
    <Combobox
      aria-label="Country"
      value={value}
      onValueChange={setValue}
      query={query}
      onQueryChange={setQuery}
      filter={() => true}
    >
      {results.map((name) => (
        <Combobox.Option key={name} value={name}>
          {name}
        </Combobox.Option>
      ))}
      {/* The selected option stays, hidden, while the results leave it out: its label shows. */}
      {value !== '' && !results.includes(value) && (
        <Combobox.Option key={value} value={value} hidden>
          {value}
        </Combobox.Option>
      )}
    </Combobox>
  );
}
```

- **`filter(option, query)`** decides which options match the typed text. It is called whenever the text is not empty, with every option that is not hidden, as a `ListboxItem` (`value`, `label`, `textValue`). The default is a case-insensitive substring of `textValue`, else `label` (TagPicker's too, since 0.11). A filter may keep options that do not contain the text; for a "Create …" entry in a TagPicker, use `allowCreate` (see [TagPicker parts and free tagging](#tagpicker-parts-and-free-tagging)). A freeform Combobox filters by its text too.
- **The query** (`query`, `defaultQuery`, `onQueryChange(query)`) is the text typed since the last commit. Combobox resets it to `''` on a commit, a close, a blur, Escape, the clear button and a form reset; TagPicker when a tag is added, on Escape with the list closed and on a form reset (a blur or a close keeps it). Turning on `disabled` or `readOnly` while text is typed reports `''`; a picker that mounts locked keeps a controlled query until it unlocks. A freeform Combobox's text is its value: it never calls `onQueryChange`, and a `query` or `defaultQuery` prop warns in development.
- The typing model is unchanged: typing never clears a Combobox selection, and a blur selects nothing. The `CustomFilter` and `AsyncSearch` stories of Combobox show both props.

### TagPicker parts and free tagging

`<TagPicker options={…} />` is the parts with their defaults. The parts form replaces only the part you need: your own Tags in `TagPicker.Group`, rich `TagPicker.Option`s in `TagPicker.List`, or `TagPicker.Button` in place of `TagPicker.Input`. A people picker:

```tsx
import * as React from 'react';
import { Avatar, Tag, TagPicker } from '@mortenbrudvik/waveui';

const people = [
  { value: 'katri', name: 'Katri Athokas', role: 'Designer' },
  { value: 'elvia', name: 'Elvia Atkins', role: 'Engineer' },
];
const nameOf = (value: string) => people.find((person) => person.value === value)?.name ?? value;

export function PeoplePicker() {
  const [value, setValue] = React.useState<string[]>(['katri']);
  return (
    <TagPicker aria-label="People" value={value} onValueChange={setValue}>
      <TagPicker.Control>
        <TagPicker.Group>
          {value.map((id) => (
            <Tag key={id} value={id} media={<Avatar name={nameOf(id)} decorative />} dismissLabel="Remove">
              {nameOf(id)}
            </Tag>
          ))}
        </TagPicker.Group>
        <TagPicker.Input />
      </TagPicker.Control>
      <TagPicker.List>
        {people.map((person) => (
          <TagPicker.Option
            key={person.value}
            value={person.value}
            label={person.name}
            media={<Avatar name={person.name} decorative />}
            secondaryContent={person.role}
          >
            {person.name}
          </TagPicker.Option>
        ))}
      </TagPicker.List>
    </TagPicker>
  );
}
```

- **Defaults.** A part without children renders its default content: `<TagPicker.Control />` holds the default tags and the Input, `<TagPicker.Group />` the default tags, `<TagPicker.List />` the options of `options`. Without a `TagPicker.List` the default list is added. An `options` entry's `media` shows in its option and its tag, its `secondaryContent` in its option.
- **Placement.** Render `TagPicker.Control` and `TagPicker.List` directly inside the TagPicker (a Fragment is fine); a List elsewhere, or a second one, warns in development (`TagPicker.List:placement`).
- **Selected options stay rendered.** With a List that has children, its options are the options: keep the options of the selected values in it. TagPicker hides them and reads their labels, which the tags, the summary and the announcements use. `label` sets an option's text where the children are not plain text (`TagPicker.Option:label` warns otherwise).
- **Your own tags** follow the `value` order, render a `value` each and keep the Dismiss button: TagPicker names it with `labels.remove`, and Delete, Backspace, Enter, Space or a click on it removes the tag. With `overflow="count"`, the tags are measured by position, so keep them in `value` order.
- **Routing.** The trigger that renders (`TagPicker.Input` or `TagPicker.Button`) receives the routed props of the root (`id`, the naming and validation ARIA attributes, `tabIndex`, `autoFocus`; the Input also the focus and key handlers, `controlRef` and the text input attributes). With `TagPicker.Button`, pass handlers and `ref` on the Button. Render exactly one trigger (`TagPicker:trigger` warns otherwise).
- **`TagPicker.Button`** is a select-only trigger for a short, fixed list: Down, Up and a typed letter open the list and move, Enter and Space add the active option, a click toggles the list. It stays visible as the click area once tags are selected, and ignores `query`.
- **Free tagging.** `allowCreate` ends the list with a create option (`labels.create`, default `Create "{text}"`) while the trimmed text matches no option label, no selected value (ignoring case) and no option value. Enter on it or a click calls `onOptionCreate(text)`, adds the text as a tag (`onValueChange`) and clears the text. Add an option for the new value in `onOptionCreate`, or the tag shows the raw text. It needs `TagPicker.Input` (`TagPicker:allowCreate-button` warns with the Button). With a server-side search the create option follows the current results.
- **The exact match.** The option whose label equals the typed text (ignoring case) becomes active, else the first match; no option is active when the list opens.
- **`clearable`** shows a clear button (`labels.clear`, "Clear selection") while a tag is selected: it removes every tag, clears the text, closes the list and focuses the trigger. It is a Tab stop after the trigger.
- **`expandIcon`.** A chevron at the end of the field opens and closes the list (`labels.expand`, "Show options"); it is not a Tab stop and keeps focus on the trigger. `false` hides it (the 0.10 field). A press on the field's empty area toggles the list too.
- **`overflow="count"`** keeps the tags on one line while focus is outside the picker and its list is closed; the tags that do not fit give way to "+N" (`labels.overflowCount`), and focusing the picker shows them all. Screen readers hear the trigger's summary of every tag, not the count. Fluent's single-line layout is a story; WaveUI's is a prop.

```tsx
import * as React from 'react';
import { TagPicker, type TagPickerOption } from '@mortenbrudvik/waveui';

export function Topics() {
  const [options, setOptions] = React.useState<TagPickerOption[]>([
    { value: 'design', label: 'Design' },
    { value: 'testing', label: 'Testing' },
  ]);
  const [value, setValue] = React.useState<string[]>([]);
  return (
    <TagPicker
      aria-label="Topics"
      options={options}
      value={value}
      onValueChange={setValue}
      allowCreate
      // Called before onValueChange reports the new value: the new tag keeps its label.
      onOptionCreate={(text) => setOptions((current) => [...current, { value: text, label: text }])}
      clearable
    />
  );
}
```

### Listbox and custom pickers

`Listbox` is the option list of the pickers placed in the page: a `<ul role="listbox">` that holds focus itself and points `aria-activedescendant` at the active option.

```tsx
import { Field, Listbox } from '@mortenbrudvik/waveui';

export function FruitList() {
  return (
    <Field label="Fruit" required>
      <Listbox name="fruit" defaultValue="banana" className="max-h-48">
        <Listbox.OptionGroup label="Common">
          <Listbox.Option value="apple">Apple</Listbox.Option>
          <Listbox.Option value="banana">Banana</Listbox.Option>
        </Listbox.OptionGroup>
        <Listbox.Option value="durian" disabled>
          Durian
        </Listbox.Option>
      </Listbox>
    </Field>
  );
}
```

- **Listbox or List.** Use `Listbox` for a choice among options (the option model of Dropdown and Combobox: typeahead, groups, disabled options, forms). Use `List` with `selectable` (or, without selection, `navigationMode="items"`) when each item needs real focus, actions of its own or interactive content (see [Lists](#lists)).
- **Focus and selection.** One Tab stop. The active option exists only while the list has focus: the selected option (with `multiselect`, the first selected one in list order), else the first; while no option can be active, the list draws its own focus ring. Space and Enter select, so the selection does not follow the active option; a single-select Listbox never deselects. A press on an option focuses the list and makes that option active without scrolling, so the click selects it even while the selected option is scrolled out of view. Tab, Escape and the Alt+arrow keys are left to the page: an enclosing Dialog closes on Escape.
- **Props.** `multiselect` (an array value, announced toggles; see [Multi-select pickers](#multi-select-pickers)), `onActiveOptionChange` (`null` when focus leaves the list), `disabled` (out of the Tab order, selects and submits nothing), `disabledOptionsFocusable`, `autoFocus`, `name`, `form` and `required`, and Field wiring. It has no built-in height: give it one through `className` and it scrolls.
- **Option groups.** `OptionGroup`'s `label` is optional and takes any text content (an icon next to the text is fine). Without one no heading renders, and `aria-label` or `aria-labelledby` names the group; these two always land on the `role="group"` list. A group without a name warns in development.
- **Data mode** (Listbox, Combobox, Dropdown): `items` (`ListboxItem`: `value`, `label`, and optionally `textValue`, `disabled` and `hidden`; values unique) replace the option children, which are then neither read nor rendered (passing both warns once). The keys, typeahead, the selected labels and the Combobox filter come from `items`, also for a selected item whose option is not rendered, and every option carries `aria-posinset` and `aria-setsize` among the shown options. `renderOption(item, state)` draws an option (`state`: `selected`, `active`, and `index` among the shown options; `ListboxOptionRenderState`): return an `Option`, or an option of yours on `useListboxOption`, with the item's `value`; it is called again only when its item, state or position, or the function, change, so pass a stable function. A closed Combobox or Dropdown in data mode renders no options (its labels come from `items`). `virtualWindow` windows a long data-mode list (see [Large data](#large-data)).

**Pickers of your own.** The pieces under Dropdown, Combobox and TagPicker are public:

- `useListbox(options)` holds the listbox: its keys, typeahead, filtering, the active option and the registration of the options. `mode` is `'select-only'` (a button combobox, as Dropdown), `'editable'` (an `<input>` combobox, as Combobox) or `'standalone'` (a list that holds focus, as Listbox). You own the open state (`open`, `onOpenChange(open, details)`) and the value (`selectedValues`, `onSelect(value, details)`, with `details.item` and `details.event`); spread `getComboboxProps()` on your combobox and attach `onKeyDown` and `onKeyUp`. With `items` (data mode) it reads no children, so you may render only the shown options (`listbox.items`), or a window of them: `onScrollToItem(index)` is then called first for every move that scrolls the active option into view, with its index among the shown options, so pass `(index) => virtualWindow.scrollToIndex(index, { align: 'auto' })` and keep the active option rendered.
- `useListboxPopup(options)` dismisses the popup (Escape, a press outside, focus leaving: `DismissReason`) and positions it, and `ListboxSurface` renders the list: in a portaled surface while it is shown, `hidden` in place otherwise, so the options register from the first render. `listClassName` and `surfaceClassName` are merged last (`max-h-*` replaces the list's height). Two duties remain yours: set your combobox's `aria-expanded` from `expanded` after spreading `getComboboxProps()`, and while the listbox is open with nothing to show, close it on Escape yourself (outside an IME composition) without calling `listbox.onKeyDown`, so the Escape reaches an enclosing layer.
- `ListboxProvider` provides the listbox's context to its options when you render the list yourself instead of through `ListboxSurface`. `ListboxSurface`'s `listProps` (`ListboxSurfaceListProps`) pass attributes and a `ref` to the list element; the listbox's own `aria-multiselectable` and `aria-activedescendant` always win.
- Options are `Option` and `OptionGroup` (or `TagPicker.Option`, an Option with `media` and `secondaryContent`), or components of your own on `useListboxOption`, marked with `markListboxElement` so that `collectOptionLabels(children)` knows their labels before they register (in the server HTML and the first render).

```tsx
import * as React from 'react';
import {
  ListboxSurface,
  Option,
  collectOptionLabels,
  useListbox,
  useListboxPopup,
  useMergedRefs,
} from '@mortenbrudvik/waveui';

const SIZES = (
  <>
    <Option value="s">Small</Option>
    <Option value="m">Medium</Option>
    <Option value="l">Large</Option>
  </>
);

export function SizePicker() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('m');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listbox = useListbox({
    open,
    onOpenChange: setOpen,
    mode: 'select-only',
    selectedValues: [value],
    // A single-select commit also closes the list, through onOpenChange.
    onSelect: setValue,
  });
  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef: buttonRef,
  });
  const buttonMergedRef = useMergedRefs(buttonRef, setReference);
  return (
    <div ref={rootRef}>
      <button
        type="button"
        aria-label="Size"
        {...listbox.getComboboxProps()}
        aria-expanded={expanded}
        ref={buttonMergedRef}
        onClick={() => setOpen(!open)}
        onKeyDown={listbox.onKeyDown}
        onKeyUp={listbox.onKeyUp}
      >
        {listbox.getItem(value)?.label ?? collectOptionLabels(SIZES).get(value)}
      </button>
      <ListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        aria-label="Sizes"
      >
        {SIZES}
      </ListboxSurface>
    </div>
  );
}
```

The `CustomPicker` story in `stories/Listbox.stories.tsx` is an editable font picker built only on these exports, and `CommandPalette` uses `useActiveDescendant` alone, for a composite that is not a listbox. The guide's [Building a custom picker](docs/WAVE-UI-GUIDE.md#pattern-12-building-a-custom-picker) adds option components of your own, a list rendered with `ListboxProvider`, and [active-descendant widgets](docs/WAVE-UI-GUIDE.md#pattern-13-active-descendant-widgets).

### Color

```tsx
import * as React from 'react';
import { AlphaSlider, ColorArea, ColorPicker, ColorSlider, Field } from '@mortenbrudvik/waveui';

export function AccentPicker() {
  const [accent, setAccent] = React.useState('#0f6cbd');
  return (
    <Field label="Accent color">
      <ColorPicker value={accent} onValueChange={setAccent} name="accent">
        <ColorArea />
        <ColorSlider />
        <AlphaSlider />
        <ColorPicker.HexField />
        <ColorPicker.Swatches />
      </ColorPicker>
    </Field>
  );
}
```

- **The picker and its parts.** Without children, a ColorPicker renders a color area and a hue slider, then its 0.7 layout: the preview and hex field, the presets and, with `showOpacity`, the opacity slider. With children it renders your layout: `ColorArea`, `ColorSlider` and `AlphaSlider` bind to the picker when you pass them neither `value` nor `defaultValue` (Fluent's composition), and `ColorPicker.HexField`, `ColorPicker.Swatches` (the picker's `presets`) and `ColorPicker.Preview` are the picker's own parts. Bound parts read and write the picker's color, take its `shape`, `labels` and disabled state, and submit nothing themselves: the picker's hidden input submits the hex value (`name`, `form`, `required`), and a form reset restores its `defaultValue`. A part with its own `value` or `defaultValue` stays independent.
- **Hex and HSV.** The picker's value is a hex string, as in 0.7 (`#rrggbb`, or `#rrggbbaa` below full opacity). The standalone parts take an `HsvColor` (`{ h, s, v, a? }`: `h` from 0 to 360, `s`, `v` and `a` from 0 to 1, no `a` meaning opaque; Fluent's type), and `hsvToHex(color)` and `hexToHsv(hex)` convert (`hexToHsv` returns `null` for text that is not a hex color). Inside the picker, the hue and saturation survive grays, white and black, which a hex value cannot carry. A value that is not a hex color disables the bound parts until a hex value arrives.
- **Keys and pointer.** `ColorArea` is one Tab stop: Left and Right change saturation (mirrored in RTL), Up and Down brightness, Shift with an arrow by 10, Page Up and Page Down brightness by 10, Home and End saturation to 0 and 100. `ColorSlider` and `AlphaSlider` take the arrows of their axis (by 1, Shift by 10), Page Up and Page Down (by 10), Home and End. A press on the area jumps there and drags, with a mouse, touch or a pen.
- **Assistive technology.** The area is a group of two sliders, "Saturation" and "Brightness": desktop screen readers list one 2-D slider, and touch screen readers can swipe each. Each value text starts with its own channel and names the color ("Saturation 72%, Brightness 74%, dark blue"); a hue slider says "210°, blue". `labels.colorName(color)` replaces the English color names (return `''` to leave them out), and `labels.valueText(color, channel)` a whole value text, for languages whose word order differs.
- `ColorSlider` takes `channel` (`'hue'`, `'saturation'` or `'value'`) and `orientation` (`'vertical'` draws the rail bottom to top); `AlphaSlider` shows opacity, or with `transparency` transparency (the value's `a` is still the opacity). The roots carry `data-orientation`, `data-channel` (ColorSlider) and, while disabled, `data-disabled`. `shape="square"` removes the corner radius. Inside a `Field`, a standalone slider is named by the Field's label, else by its `labels` ("Hue", "Saturation", "Brightness").

### Swatches

```tsx
import {
  ColorSwatch,
  EmptySwatch,
  ImageSwatch,
  SwatchPicker,
  Tooltip,
} from '@mortenbrudvik/waveui';

export function AccentSwatches({ onAddColor }: { onAddColor: () => void }) {
  return (
    <SwatchPicker layout="grid" aria-label="Accent" name="accent" defaultValue="red">
      <SwatchPicker.Row>
        <Tooltip content="Red" relationship="label">
          <ColorSwatch value="red" color="#d13438" />
        </Tooltip>
        <ColorSwatch value="blue" color="#0f6cbd" aria-label="Blue" />
        <ColorSwatch value="sand" color="#faf9f8" borderColor="#8a8886" aria-label="Sand" />
      </SwatchPicker.Row>
      <SwatchPicker.Row>
        <ImageSwatch value="dots" src="/patterns/dots.png" aria-label="Dots" />
        <ColorSwatch value="green" color="#107c10" aria-label="Green" disabled />
        <EmptySwatch onClick={onAddColor} />
      </SwatchPicker.Row>
    </SwatchPicker>
  );
}
```

- **Swatches as children.** `ColorSwatch`, `ImageSwatch` and `EmptySwatch` read the picker's context (one outside a SwatchPicker throws in development), so a swatch can sit in a `Tooltip`: its `ref`, `className`, `style`, name and other props go to its own `<button>` in every layout, and a Tooltip with `relationship="label"` names it. `items` is optional and renders `ColorSwatch`es before the children. Swatch values are unique (a duplicate warns in development).
- **Kinds.** A `ColorSwatch` (`value`, `color`) is named by `aria-label` or a Tooltip, else by its color value (with a development warning); `icon` is a decorative glyph shown while it is not selected, and `borderColor` sets its border for a color close to the page background (forced colors replace it). An `ImageSwatch` (`value`, `src`) draws a pattern or texture as a covering background. `disabled` is native (out of the keys and the Tab order, never selected): the swatch is dimmed and crossed by a diagonal slash, so the state does not rely on its color, and a disabled swatch that is selected keeps its selected look. An `EmptySwatch` is an "add" button with no value, named "Add color" by default (`aria-label`), with a plus `icon` (`false` hides it) and your `onClick`. Every swatch takes `size` and `shape`, which override the picker's.
- **Row layout** (the default): a `role="radiogroup"` of `role="radio"` buttons whose arrow keys select and wrap, as in 0.9. An `EmptySwatch` there is a plain button with its own Tab stop, outside the arrow keys.
- **Grid layout** (`layout="grid"`): a `role="grid"` of `SwatchPicker.Row` rows (flat `SwatchPickerRow`), each swatch button inside a `role="gridcell"`. `items` with the children that follow them up to a row, and every other run of children that are not rows, form implicit rows, so a Row must be a direct child of the picker or inside a Fragment (one inside a component of yours lands in an implicit row). Rows do not wrap, so size them yourself. The arrow keys move focus only, in two dimensions; Space, Enter and a click select. The selected swatch's cell is `aria-selected` and its button `aria-pressed`. An `EmptySwatch` is a cell in the arrow order. Changing `layout` on a mounted picker remounts the swatches.
- **Tab mode** (`focusMode="tab"`, in either layout): every enabled swatch is its own Tab stop and the arrow keys do nothing, so the picker is a `role="group"` of toggle buttons (`aria-pressed`); rows have no role. Pressing the selected swatch keeps it selected. Fluent keeps the radio and grid roles there.
- **Sizes.** `size` is `'extra-small'` (20px), `'small'` (24px), `'medium'` (32px, the default) or `'large'` (40px), and `spacing` is `'small'` (4px) or `'medium'` (8px, the default), between swatches and between rows; a 20px swatch meets WCAG 2.5.8 through its spacing. `shape` is `'circular'` by default.
- **Required.** The row layout carries `aria-required`. A grid or a group cannot, so the grid layout and tab mode say "Required" in the picker's description (`labels.required`).
- The root carries `data-layout`, `data-focus-mode`, `data-size`, `data-shape` and `data-spacing`. `ColorPicker.Swatches` takes the same props, so a ColorPicker's presets can use the grid layout or end in an `EmptySwatch`.

### Calendar

```tsx
import * as React from 'react';
import { Calendar, Field } from '@mortenbrudvik/waveui';

export function SprintWeek({ today }: { today: Date }) {
  const [days, setDays] = React.useState<Date[]>([]);
  return (
    <Field label="Sprint week" hint={`${days.length} days selected`} required>
      <Calendar
        name="sprint"
        locale="en-GB"
        today={today}
        firstDayOfWeek={1}
        showWeekNumbers
        firstWeekOfYear="first-four-day-week"
        selectionRange="work-week"
        showGoToToday
        markedDates={(date) => date.getDay() === 5}
        onValueChange={(_date, details) => setDays(details?.range ?? [])}
      />
    </Field>
  );
}
```

- **Value.** `value` and `defaultValue` take a `Date` or `null`; `onValueChange(date, details)` fires only when the day changes, with local midnight, and `details.range` lists the selected days (Fluent's `onSelectDate` fires on every pick). Picking the selected day again does nothing. A controlled value in another month shows that month. `minDate`, `maxDate`, `disabledDates`, `firstDayOfWeek` and `locale` work as in DatePicker.
- **Month and year views** (`showMonthPicker`, on by default): the month text is a button, named by that text and described by `labels.chooseMonth`, that shows the 12 months of the year; their heading, the year, is a button to the year view (`labels.chooseYear`): a decade with the year before and after it. The header buttons move by a month, a year or a decade. A picked year shows its months and a picked month its days (the focused day keeps its day of the month, clamped), and Escape goes back a view to the period shown before. Every view change moves focus into the new grid. Months and years wholly outside `minDate`/`maxDate` stay focusable and `aria-disabled`. `showMonthPicker={false}` keeps a static month text.
- **Week numbers.** `showWeekNumbers` adds a leading column of row headers ("Week 23", `labels.weekNumber`), which the keys skip. `firstWeekOfYear` is `'first-day'` (the default), `'first-full-week'` or `'first-four-day-week'`; ISO 8601 weeks are `'first-four-day-week'` with `firstDayOfWeek={1}`.
- **Ranges** (Calendar only). `selectionRange` is `'day'` (the default), `'week'`, `'work-week'` or `'month'`, and `workWeekDays` the days of a work week (Monday to Friday by default). A pick selects the picked day's week, work week or month without its unavailable days: the value is the picked day, `details.range` the selected days, and every selected day is `aria-selected`, `aria-pressed` and `data-selected`.
- **Marked days and custom content.** `markedDates(date)` draws a dot under the number, sets `data-marked` and adds "marked" to the day's name (`labels.markedDay`). `renderDay(date, defaultContent)` replaces the content of a day button (non-interactive content only), and `dayLabel(date, defaultLabel)` sets its name, since the content does not.
- **Footer.** `showGoToToday` adds a button that shows today's month and focuses today without selecting it (disabled while today is outside `minDate`/`maxDate`). DatePicker's `showCloseButton` adds a Close button that closes the calendar as Escape does. Both are off by default.
- **Server rendering and `today`.** `today` (the current date by default) is the day marked `aria-current="date"`. Without it, the server HTML marks no day and the browser marks today once hydrated. The month shown first is the value's, else `initialVisibleDate`'s, else today's, clamped into `minDate`/`maxDate`: on the server, pass `locale` and one of `today`, `initialVisibleDate` or a value, since without them the month comes from the server's clock (a development warning says so).
- **Forms and Field.** `name`, `form` and `required` add a hidden input (ISO `yyyy-mm-dd`) that resets with its form to `defaultValue`; when the form reports a required Calendar empty, its tab stop takes focus. Inside a `Field` the `role="group"` root takes the label, the description and `aria-invalid`, and says "Required" in its description (`labels.required`), since a group cannot carry `aria-required`. The month text is a `<div>` that labels the grid (DatePicker's dialog keeps its `<h2>`), since a component cannot know the page's heading levels.
- **DatePicker** shows the same calendar in its dialog, with the props above except `selectionRange` and `workWeekDays` (its input holds one date). The date helpers it uses are public: see [Hooks and utilities](#hooks-and-utilities).

### Menus

```tsx
import { Menu, MenuButton, SplitButton } from '@mortenbrudvik/waveui';

export function Actions({ onEdit, onSave }: { onEdit: () => void; onSave: () => void }) {
  return (
    <>
      <Menu>
        <Menu.Trigger>
          <MenuButton>Actions</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item onClick={onEdit}>Edit</Menu.Item>
          <Menu.Divider />
          <Menu.Item disabled>Archive</Menu.Item>
        </Menu.Popover>
      </Menu>

      <Menu>
        <Menu.Trigger>
          {(triggerProps) => (
            <SplitButton menuButtonProps={triggerProps} onClick={onSave}>
              Save
            </SplitButton>
          )}
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Save as…</Menu.Item>
        </Menu.Popover>
      </Menu>
    </>
  );
}
```

Use `Menu.Trigger`/`Menu.Popover` for menu buttons; `Popover` has no menu semantics. A Menu with `open`, `defaultOpen` or `onOpenChange` (even `false`) is a popup menu, which renders no element of its own: put its items in `Menu.Popover`. Without them and without Trigger/Popover parts it is a static `role="menu"`. A MenuButton without a label needs `aria-label`, `aria-labelledby` or `title`.

- **Long menus** scroll inside the viewport: `Menu.Popover` is limited to the height and width available next to its trigger, and the item that takes focus is scrolled into view. A `max-h-*` or `max-w-*` class on `Menu.Popover` (such as `max-h-64`) replaces the limit; so does a `style`.
- **Unavailable triggers.** A trigger marked `aria-disabled="true"` (a `disabledFocusable` MenuButton or SplitButton, or your own element) stays focusable but never opens its menu: its click, Enter, Space, ArrowDown and ArrowUp are ignored, also when it sits inside the trigger's wrapper span. An `aria-disabled` ancestor outside the trigger does not count.
- Compose a SplitButton through the render-prop child, as above (`menuButtonProps={triggerProps}`), so only the menu half is the trigger. Wrapping the whole SplitButton in `Menu.Trigger` (`asChild={false}`) makes both halves open the menu.

```tsx
import * as React from 'react';
import { Menu, MenuButton } from '@mortenbrudvik/waveui';
import type { CheckedValues } from '@mortenbrudvik/waveui';

export function ViewMenu() {
  const [checked, setChecked] = React.useState<CheckedValues>({ show: ['ruler'], sort: ['name'] });
  return (
    <Menu checkedValues={checked} onCheckedValuesChange={setChecked}>
      <Menu.Trigger>
        <MenuButton>View</MenuButton>
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Group>
          <Menu.GroupHeader>Show</Menu.GroupHeader>
          <Menu.ItemCheckbox name="show" value="ruler">
            Ruler
          </Menu.ItemCheckbox>
          <Menu.ItemSwitch name="show" value="grid">
            Grid
          </Menu.ItemSwitch>
        </Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          <Menu.GroupHeader>Sort by</Menu.GroupHeader>
          <Menu.ItemRadio name="sort" value="name">
            Name
          </Menu.ItemRadio>
          <Menu.ItemRadio name="sort" value="date">
            Date
          </Menu.ItemRadio>
        </Menu.Group>
        <Menu.Divider />
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Zoom</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>Zoom in</Menu.Item>
            <Menu.Item>Zoom out</Menu.Item>
          </Menu.Popover>
        </Menu>
        <Menu.ItemLink href="/help/view">View help</Menu.ItemLink>
      </Menu.Popover>
    </Menu>
  );
}
```

- **Checkable items.** `Menu.ItemCheckbox`, `Menu.ItemRadio` and `Menu.ItemSwitch` take a required `name` (the group, a key of `checkedValues`) and `value`. A checkbox, switch or radio item is checked while its `value` is in `checkedValues[name]`; checking a radio item makes its value the group's only value, which unchecks the other radio items of that `name` (so give a radio group at most one value). A `name` and `value` pair is unique within a menu list: a second item with the same pair would show as checked too (a development warning says so). Any string is a group name, `constructor` included. The state lives on the `Menu`: `checkedValues` (controlled) or `defaultCheckedValues`, and `onCheckedValuesChange(checkedValues, details)` fires only on change with a new object (so `setState` works), then `details`: the group's `name`, its new `checkedItems` and the click `event`. It works in static and popup menus, and does not make a Menu a popup menu; a static menu renders the checked state in the server HTML.
- **Space and Enter.** Space changes a checkable item and keeps the menu open, so several can be changed in a row; Enter and a click change it and close a popup menu (the APG menu pattern). `persistOnItemClick` on the Menu keeps it open after any item, and an item's own `persistOnClick` (`true` or `false`) wins. Activating a radio item whose value already is its group's only value changes nothing (no callback) and still closes the menu.
- **One group per radio set.** Put the radio items of each `name` in a `Menu.Group` (or at least separate two sets with a `Menu.Divider`): assistive technology counts a radio set by its group or separators, not by `name`, so two sets side by side are announced as one.
- **Indicators.** A checked checkbox or radio item shows a check; `checkmark` replaces the glyph, and since a checked item always shows an indicator, a `checkmark` that renders nothing keeps the default glyph (with a development warning). `Menu.ItemSwitch` draws a switch at the end of its row. All of them are decorative: the item's `aria-checked` carries the state, and `data-checked` is present while it is checked.
- **Groups.** `Menu.Group` is a `role="group"` labelled by its `Menu.GroupHeader` when the header is a direct child (or inside a Fragment). A header nested deeper, in your own component, does not label it (a development warning says so): give such a group `aria-label` instead, as you do for a group without a visible header. Headers are not items: the arrow keys and typeahead skip them. Give a group one header: only the first header among its direct children labels it, and any other header renders only its own `id` (a development warning says so). A group's own `aria-label` or `aria-labelledby` wins when it is defined (one that holds `undefined`, from a wrapper that forwards it, does not). Separate groups with `Menu.Divider`.
- **Links.** `Menu.ItemLink` renders an `<a href>` with `role="menuitem"` (or, with `as`, your router link component, which must forward `ref` and spread its props onto the anchor). Enter is the browser's own link activation, so Shift, Ctrl and Cmd open a new window or tab; Space follows the link too. Every click follows it and closes a popup menu, a Ctrl- or Cmd-click that opens a new tab included, and `persistOnItemClick` does not keep it open; middle click and the browser's link context menu stay native. A disabled link is `aria-disabled` and its click is prevented; an `<a>` also drops its `href`, but a router link still renders its `to` (so "open in new tab" can still follow it): render a disabled router link without its target. Name a link that opens a new window in its label; an icon that says so is decorative.
- **Submenus.** A `<Menu>` rendered in a menu list (inside `Menu.Popover`, as above, or among the items of a static menu) is a submenu. Its `Menu.Trigger` wraps a `Menu.Item`, which becomes its trigger item (`aria-haspopup="menu"`, `aria-expanded`, a chevron that mirrors in RTL). ArrowRight (ArrowLeft in RTL), Enter, Space and a click open it and focus its first item; ArrowLeft (ArrowRight in RTL) and Escape close only that submenu and return focus to its item; item activation and Tab close every level, focusing the root trigger first. One submenu of a list is open at a time. A submenu opens beside its item (`side="end"`, `offset={0}`) and flips to fit the viewport; with room on neither side (a wide menu, a phone), it overlaps its parent menu, inside the viewport. It shares its parent's checked values unless it sets `checkedValues` or `defaultCheckedValues` of its own (an `onCheckedValuesChange` alone only listens, after the parent's), and it inherits `persistOnItemClick`, `openDelay` and `closeDelay`. A Menu inside a Popover or Dialog that an item opens is not a submenu: it stays a root menu of its own.
- **Split rows.** `Menu.SplitGroup` puts an action and the button of its submenu in one row. The submenu half is a `Menu.Item` without children, named by its `aria-label` (it shows only the chevron):

  ```tsx
  <Menu.SplitGroup>
    <Menu.Item onClick={save}>Save</Menu.Item>
    <Menu>
      <Menu.Trigger>
        <Menu.Item aria-label="More save options" />
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item onClick={saveAs}>Save as…</Menu.Item>
      </Menu.Popover>
    </Menu>
  </Menu.SplitGroup>
  ```

  ArrowDown and ArrowUp visit both halves; ArrowRight (ArrowLeft in RTL) moves from the action to the submenu button, and on the button opens the submenu.

- **Hover.** Submenus open when the mouse rests on their item (`openDelay`, 250ms) and close `closeDelay` (250ms) after the pointer has left the item and the submenu; `openOnHover={false}` turns that off for one submenu. `openOnHover` on a root popup menu opens it from its trigger the same way. A menu opened by hover takes no focus; a click, Enter, Space or ArrowDown on its trigger (ArrowRight, Enter, Space or a click on a submenu's item) keeps it open and moves focus into it. Focus inside the menu keeps it open; focus left on its trigger does not. A close by hover moves no focus, also for a submenu closing with its menu; Escape and the other closes return focus as usual. A triangle between the trigger and the menu keeps the menu open while the pointer moves diagonally towards it, across other items. After Escape or an outside press it stays closed until the pointer has left the trigger. Touch and pen never open anything by hover. Set the delays on the root (a static menu accepts them too); submenus inherit them.
- **Focus follows the mouse.** While focus is in a menu (an open popup menu and its submenus, or a static menu the user is in), the item under the mouse takes focus, as in native menus, so Enter and the arrow keys act on the item you point at. Hover never takes focus into a menu that focus is not in, and never out of a Popover, Dialog or other portal opened from an item: typing and Enter stay there.
- **Context menus.** `openOnContext` makes the trigger's child a context-menu region: a right click (a Ctrl+click on macOS, a long press where the browser fires `contextmenu`) opens the menu at the pointer, and Shift+F10 or the ContextMenu key opens it at the focused element inside the region. Focus goes to the first item and returns, on Escape or an item, to the element that had it at the gesture (the row, not the region); Tab closes the menu, and tabbing continues from that element. A menu your app opens without a gesture (a controlled `open`) forgets that element. A second gesture on another row moves the open menu there without closing it. The browser's context menu is suppressed on the region and in the menu, except in text fields inside the region, which keep it for paste and spelling suggestions. A primary press elsewhere (on another row too), a right click outside, or a scroll that moves the region or the row of the gesture (the row under the pointer, which a scroll of the region's own content moves, or the focused row) closes the menu. The region is no menu button, so it gets no `aria-haspopup` or `aria-expanded` (with a render-prop child, do not spread them): name the menu with `aria-label` on `Menu.Popover` (a development warning asks for one), and announce the gesture with `aria-keyshortcuts="Shift+F10"` on the region. iOS Safari fires no `contextmenu` on a long press, so there is no touch gesture there.

  ```tsx
  import { Button, Menu } from '@mortenbrudvik/waveui';

  export function FileList({ files }: { files: string[] }) {
    return (
      <Menu openOnContext>
        <Menu.Trigger>
          <div aria-keyshortcuts="Shift+F10">
            {files.map((file) => (
              <Button key={file} appearance="subtle">
                {file}
              </Button>
            ))}
          </div>
        </Menu.Trigger>
        <Menu.Popover aria-label="File actions">
          <Menu.Item>Open</Menu.Item>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }
  ```

- **A menu at another element.** `Menu.Popover` `target` (`PopupTarget`) places the menu at an element (hold it in state: `const [button, setButton] = useState<HTMLElement | null>(null)`) or at a `VirtualElement`, a rectangle such as a point (`target={{ getBoundingClientRect: () => rect }}`; an inline object is fine). A controlled menu with a `target` needs no `Menu.Trigger`: name it with `aria-label`, and give a toggle button used as the target `aria-haspopup="menu"` and `aria-expanded` yourself. A press on a target element does not count as outside, so the toggle closes the menu with one click. Without `Menu.Trigger`, Escape (or a close by your app) returns focus to the element that had it when the menu opened, while activating an item or pressing Tab focuses the target element when it can take focus; when you open the menu from the toggle, both are the toggle. The menu's `id` is generated, so the toggle cannot point `aria-controls` at it.
- **Columns.** The item labels line up: once any item of a menu list shows a check or an icon, every item of that list keeps that column (through groups and wrappers too), and the others render an empty placeholder there. A `shortcut` takes its direction from its own text (`dir="auto"`), so "Ctrl+," reads the same in an RTL menu.
- **Motion.** A menu, and each submenu, fades in and slides 4px away from its trigger (a submenu away from its parent menu, on the side it opened on) over 200ms, and fades and slides back over 100ms. While it exits it stays mounted with `data-presence="exiting"`, `data-state="closed"` and `inert`; focus is already back and Escape already reaches the next layer. `Menu.Popover motion` replaces the motion, or turns it off with `null`: `<Menu.Popover motion="transition-opacity duration-wave-fast data-[presence=exiting]:opacity-0 motion-reduce:transition-none">` only fades out (Tailwind path). 0.14's form, the same classes in `className`, still works and turns the default off. See [Enter and exit motion](#enter-and-exit-motion).

### Toolbars

```tsx
import { Toolbar } from '@mortenbrudvik/waveui';

export function FormatBar() {
  return (
    <Toolbar aria-label="Formatting" defaultCheckedValues={{ format: ['bold'], align: ['left'] }}>
      <Toolbar.ToggleButton name="format" value="bold">
        Bold
      </Toolbar.ToggleButton>
      <Toolbar.ToggleButton name="format" value="italic">
        Italic
      </Toolbar.ToggleButton>
      <Toolbar.Divider />
      <Toolbar.RadioGroup aria-label="Text alignment">
        <Toolbar.RadioButton name="align" value="left">
          Left
        </Toolbar.RadioButton>
        <Toolbar.RadioButton name="align" value="center">
          Center
        </Toolbar.RadioButton>
      </Toolbar.RadioGroup>
      <Toolbar.Divider />
      <Toolbar.Group aria-label="Insert">
        <Toolbar.Button>Link</Toolbar.Button>
        <Toolbar.Button>Image</Toolbar.Button>
      </Toolbar.Group>
    </Toolbar>
  );
}
```

- **Checked values.** The pressed `Toolbar.ToggleButton`s and the checked `Toolbar.RadioButton` of each group live on the Toolbar, per group `name`: `checkedValues` (controlled) or `defaultCheckedValues`, and `onCheckedValuesChange(checkedValues, details)` as on Menu. Both parts take a required `name` and `value`; a toggle is pressed, and a radio checked, while its `value` is in `checkedValues[name]`, and checking a radio makes its value the group's only value (so give a radio group at most one value). A `name` and `value` pair is unique within a toolbar (a development warning says so). The state is in the server HTML. A plain ToggleButton inside a Toolbar keeps its own `pressed` state.
- **Radio groups.** `Toolbar.RadioGroup` is a `role="radiogroup"` whose radios are part of the toolbar's arrow-key order: Left and Right (Up and Down in a vertical toolbar) move through buttons, toggles and radios alike, and Up and Down (Left and Right in a vertical toolbar) also move among the group's radios, wrapping inside the group. The arrow keys only move focus; Space, Enter or a click checks a radio. Name the group with `aria-label` (a development warning asks for one). The toolbar keeps one Tab stop.
- **Groups and dividers.** `Toolbar.Group` lays out related controls; it is `role="presentation"`, or `role="group"` once you name it with `aria-label` or `aria-labelledby`. `Toolbar.Divider` is a separator line across the toolbar (vertical in a horizontal toolbar); it is not focusable, so the arrow keys pass it.
- **Size and buttons.** `size` (default `'medium'`) is the default size of `Toolbar.Button`, `Toolbar.ToggleButton` and `Toolbar.RadioButton` and sets the toolbar's padding; a part's own `size` wins, and plain Buttons keep their own default. The three parts use the `subtle` appearance by default. `Toolbar.Button vertical` puts the icon above a caption-size label, for ribbons. `isAccessible` on the toggles and radios draws the pressed state as a brand fill (recommended for icon-only ones).
- Any other focusable control still works inside a Toolbar, as in 0.6: Inputs, Comboboxes and MenuButtons join the arrow-key order, and text fields keep their own arrow keys.

### Overflow

`Overflow` hides the items that do not fit and renders `overflowButton(count, hiddenIds)` instead; `useOverflowMenu()` inside it lists the hidden ids, for a menu. Items with a lower `priority` hide first, a `pinned` item never does, and items with the same `groupId` form a group that an `Overflow.Divider` follows:

```tsx
import { Menu, MenuButton, Overflow, Toolbar, useOverflowMenu } from '@mortenbrudvik/waveui';

function MoreTools() {
  const { hiddenIds, count } = useOverflowMenu();
  return (
    <Menu>
      <Menu.Trigger>
        <MenuButton appearance="subtle">{`+${count}`}</MenuButton>
      </Menu.Trigger>
      <Menu.Popover>
        {hiddenIds.map((id) => (
          <Menu.Item key={id}>{id}</Menu.Item>
        ))}
      </Menu.Popover>
    </Menu>
  );
}

export function DocumentTools() {
  return (
    <Toolbar aria-label="Document tools">
      <Overflow className="min-w-0 flex-1 gap-1" overflowButton={() => <MoreTools />}>
        <Overflow.Item itemId="Undo" groupId="history" priority={2}>
          <Toolbar.Button>Undo</Toolbar.Button>
        </Overflow.Item>
        <Overflow.Item itemId="Redo" groupId="history" priority={2}>
          <Toolbar.Button>Redo</Toolbar.Button>
        </Overflow.Item>
        <Overflow.Divider groupId="insert">
          <Toolbar.Divider />
        </Overflow.Divider>
        <Overflow.Item itemId="Image" groupId="insert" priority={1}>
          <Toolbar.Button>Image</Toolbar.Button>
        </Overflow.Item>
        <Overflow.Item itemId="Table" groupId="insert" priority={1}>
          <Toolbar.Button>Table</Toolbar.Button>
        </Overflow.Item>
        <Overflow.Item itemId="Share" pinned>
          <Toolbar.Button>Share</Toolbar.Button>
        </Overflow.Item>
      </Overflow>
    </Toolbar>
  );
}
```

- **Which item hides.** Items hide in ascending `priority` (default `0`); among equal priorities the last one in DOM order goes first, or the first one with `overflowDirection="start"`. `pinned` items never hide, and `minimumVisible` items always stay. While no item sets `priority` or `pinned`, the first item (with `start`, the last) always stays, as in 0.13; once one does, only `pinned` protects. The hidden items stay mounted with `data-overflow-hidden`, `display: none`, `aria-hidden` and `inert`, so arrow keys and Tab pass them.
- **Groups.** A group is `'visible'` (every member shown), `'hidden'` or `'overflow'` (some members hidden): `useIsOverflowGroupVisible(groupId)` reads it, and an `Overflow.Divider` with the group's `groupId` hides while its group is hidden. `useHasHiddenItems()` tells whether anything is hidden. `onOverflowChange(hiddenItems, details)` reports the hidden ids in DOM order, with `details.visibleItems` and `details.groupVisibility`, once per change.
- **The button.** `buttonPosition="end"` (the default) puts it after the items, sticking to the end of the row; `"before-hidden"` puts it just before the first hidden item, where the hidden items were (a breadcrumb trail does this), when the items are children of the Overflow (Fragments are fine). The button then moves as items hide and show, without remounting; a browser can still drop focus from a moved element, so focus on it can fall to the page while the row resizes, and switching `buttonPosition` on a mounted row remounts the items. `hasHiddenItems` renders the button before the first measurement, so the server HTML reserves its room.
- **Without wrappers.** `Overflow.Item asChild` puts the item's props on its single element child, so `<Overflow role="list">` with `<li>` items is a list (the button's wrapper is then a list item).
- **Columns.** `orientation="vertical"` stacks the items and measures heights; give the column a height.

### Dialogs and triggers

```tsx
import { Button, Dialog } from '@mortenbrudvik/waveui';

export function DeleteDialog({ onDelete }: { onDelete: () => void }) {
  return (
    <Dialog modalType="alert">
      <Dialog.Trigger>
        <Button>Delete</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Delete item?" size="small">
        This action cannot be undone.
        <Dialog.Footer>
          <Dialog.Close>
            <Button autoFocus>Cancel</Button>
          </Dialog.Close>
          <Dialog.Close>
            <Button appearance="primary" onClick={onDelete}>
              Delete
            </Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
```

- **Triggers toggle.** `Dialog.Trigger` and `Drawer.Trigger` open their surface and, clicked while it is open, close it: a trigger inside its own surface, and the trigger of a non-modal or inline surface, which stays reachable. The trigger of an inline drawer has no `aria-haspopup` (a render-prop trigger reads it as `undefined`).
- `Dialog.Trigger`, `Drawer.Trigger`, `Popover.Trigger` and `Menu.Trigger` merge their props onto their single child (no wrapper element; a Fragment around one element counts as that element) or pass them to a render-prop child. `asChild={false}` renders the 0.4 wrapper `<span>`; a custom child that neither forwards `ref` nor spreads its props, and text or several children, fall back to that span automatically, with a development warning. The span keeps the trigger's other props, but `aria-haspopup`, `aria-expanded` and `aria-controls` go to the first element in the tab order inside it (after mount), so a button there is announced as opening the popup, and Menu, Popover, Dialog and Drawer return focus to that element (to the span only when nothing inside it can take focus). A span you made the trigger itself, with a `role` such as `button` and `tabIndex={0}`, keeps them and takes focus back; `tabIndex` alone leaves the span generic, so it never carries them. With `openOnContext` (Menu, Popover) the child is a context-menu region, not a popup button: it receives your forwarded props and, of the trigger's own, only its id, ref and context-gesture handlers (no state ARIA, no click toggle).
- Render `Dialog.Footer` **inside** `Dialog.Content`, one per content. It stays in view: it sticks to the bottom of the scrolling body with an opaque background, and the body reserves its height as scroll padding, so a focused field is never hidden behind it. It keeps its place in the DOM; inside a `<form>` that wraps the fields and the footer, make it the form's last child. Inside a Drawer, use `Drawer.Footer` (see [Drawers](#drawers)); a `Dialog.Footer` there does not stick, it is an action row at the end of the content.
- A modal or alert Dialog or Drawer traps focus, closes on Escape and a backdrop press, locks page scroll and makes the rest of the page `inert` while open (toasts and live regions stay available). A backdrop press blurs the focused field before the surface closes, so a typed value (a SpinButton's, a picker's) is committed as with the Close button. When the press does not close the surface (an alert dialog, or a controlled one that refuses `outside-press`), focus ends up where it was.
- **Alert dialogs.** `modalType="alert"` is for a confirmation that needs an answer: the content is `role="alertdialog"`, and a backdrop press does not close it (Escape, the Close button and `Dialog.Close` still do). Initial focus goes to the first focusable element, the built-in Close button; the order of your buttons does not change that, so give the least destructive action `autoFocus` to start there, as above.
- **Why it opens or closes.** `onOpenChange(open, details)` gets `details.reason` (`'trigger'`, `'close'` for a `.Close` part, `'close-button'` for the built-in Close button, `'escape'`, `'outside-press'` for the backdrop) and `details.event`, the DOM event. A controlled dialog or drawer can refuse some of them (below). `details` is typed optional until 1.0, when it becomes required: read it as `details?.reason`. A render-prop trigger or close part that calls `onClick()` without its event reports a new `click` event with no target, so pass the event on.
- On close, focus goes to `finalFocusRef` when you pass one. Otherwise it returns to the element that had focus when the modal opened (a trigger's wrapper span resolves to the element inside it, see the trigger bullet above): the trigger for a trigger click, but also the parent's own button of a controlled Dialog, or a text field that had focus when a keyboard shortcut opened it. When nothing had focus (a modal opened from code, or a click in Safari, which does not focus the clicked button), it goes to the trigger that opened the modal, else the first mounted trigger. When that element is gone, focus falls back to a mounted trigger, then to an element next to where the opener was (the next row's action after a delete), then to the overlay below.
- An `autoFocus` element inside a Dialog or Drawer keeps focus (not in a surface kept mounted with `unmountOnClose={false}`, where each open focuses the first focusable element), also in a dialog opened over another one or nested in its content, and in a `Popover.Content` opened from a dialog. `Dialog.Content` and `Drawer` take `closeLabel` (default `'Close'`) to localize the Close button's name.
- **Size.** `size` caps the dialog's width at 400px (`'small'`), 600px (`'medium'`, the default) or 940px (`'large'`, Drawer's `large`). Below the cap it takes the full width, and it never exceeds the viewport: a 1rem margin keeps it off the viewport edges, its height is capped, and the body scrolls (sideways too, for content wider than the dialog). `'full'` covers the viewport: no margin, radius or border, the viewport's dynamic height, the safe-area insets as padding (with `viewport-fit=cover`), and the body scrolls under the sticky `Dialog.Footer`. `data-size` renders the size. For another width, a width cap in `className` replaces the size's: `max-w-[72rem]`, or the classes behind a breakpoint (`max-[48rem]:m-0 max-[48rem]:h-dvh …`) for a dialog that goes full screen only on narrow screens. These are Tailwind classes for your own Tailwind build. The precompiled `./styles` contains only the utilities Wave uses: there, give `Dialog.Content` a class of your own that sets the same properties, in unlayered CSS loaded after Wave's, because Wave's classes are unlayered and as specific as yours ([Cascade](#styles)).
- **Non-modal.** `modalType="non-modal"` (Dialog and Drawer) leaves the page usable: no backdrop, no focus trap, nothing `inert`, the page scrolls. Focus moves into the surface on open; Tab and Shift+Tab leave it in the page's order right after the element that opened it; Escape closes it only while focus is inside it; presses on the page never close it; and focus returns to the opener only when it was inside. The surface covers the page under it while Tab still reaches that page, so keep the page's controls clear of it: lay them out beside a centred dialog, reserve a non-modal drawer's width (its height at the bottom) in your layout while it is open, or use an inline drawer (`type="inline"`) for a panel beside the content. With `size="full"` a non-modal surface hides the whole page, and a development warning says so.
- **Backdrop.** The backdrop is the surface's sibling, `aria-hidden` (`.wave-dialog-content__backdrop`, `.wave-drawer__backdrop`), and a slot on `Dialog.Content` and Drawer: content renders inside it, a slot object's `className`, `style` and handlers go to it, and its `appearance` (`'dimmed'` or `'transparent'`, Fluent's name) picks the fill. A modal opened while another modal Dialog or Drawer is open below it gets a transparent backdrop, so the page dims once; `backdrop={{ appearance: 'dimmed' }}` dims it again. `null` renders no backdrop (the page stays inert, and a press outside still closes a modal); a boolean is no slot. A non-modal surface or an inline drawer ignores `backdrop`, with a development warning.
- **Close button.** `closeButton` sets the content of the built-in Close button (decorative: the button keeps `closeLabel` as its name, unless a slot object's `aria-label`, `aria-labelledby` or `title` names it); `null` hides it (Escape and `.Close` parts still close). A `<button>` or `Button` passed there is merged into the built-in button, never nested, and its text label names it. Fluent's dialogs have no Close button by default: pass `closeButton={null}` and keep yours, or drop yours.
- **Title actions.** `Dialog.Content`'s `titleAction` (for the `title` prop) and `Dialog.Title`'s `action` place header buttons before the Close button, in the top end corner, outside the heading, so they never join the dialog's name; the title's end padding follows their width. Drawer's `titleAction` and `Drawer.HeaderTitle`'s `action` do the same in a drawer header. Name icon-only buttons.
- **Kept mounted.** `unmountOnClose={false}` keeps `Dialog.Content` mounted while closed, `hidden` and `inert`, so a form keeps what was typed; a popup opened inside that is still open when the dialog closes stays open over the page (a development warning says so). Drawers take the same prop. See [Drawers](#drawers) for side and bottom panels.
- **Motion.** The surface scales up from 85% and fades in over 250ms, and scales down and fades out over 200ms, while the backdrop fades over the same times. A closing dialog unmounts, or hides with `unmountOnClose={false}`, once the surface's motion ends; focus, the trap and the isolation follow the open state at once, and a stacked dialog's backdrop stays transparent while it fades. `Dialog.Content` `motion` and `backdropMotion` replace them, or turn them off with `null`; a backdrop motion longer than the surface's exit is cut off when the surface goes. `backdropMotion` counts as given on a non-modal dialog even when it is `null`, so leave it unset there (a development warning names it). See [Enter and exit motion](#enter-and-exit-motion).

```tsx
import * as React from 'react';
import { Button, Dialog, Field, Input } from '@mortenbrudvik/waveui';
import type { DialogOpenChangeDetails } from '@mortenbrudvik/waveui';

export function RenameDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const handleOpenChange = (next: boolean, details?: DialogOpenChangeDetails) => {
    // Unsaved changes: a backdrop press keeps the dialog open; Escape and the buttons close it.
    if (!next && name !== '' && details?.reason === 'outside-press') return;
    setOpen(next);
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>
        <Button>Rename</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Rename project">
        <Field label="New name">
          <Input value={name} onValueChange={setName} />
        </Field>
        <Dialog.Footer>
          <Dialog.Close>
            <Button>Cancel</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
```

### Drawers

A Drawer is a side or bottom panel, by default a modal overlay (see [Dialogs and triggers](#dialogs-and-triggers) for the triggers, closing and focus):

```tsx
import { Button, Drawer, Field, Input } from '@mortenbrudvik/waveui';

export function FiltersDrawer() {
  return (
    <Drawer size="medium">
      <Drawer.Trigger>
        <Button>Filters</Button>
      </Drawer.Trigger>
      <Drawer.Header>
        <Drawer.HeaderTitle>Filters</Drawer.HeaderTitle>
      </Drawer.Header>
      <form id="filters" onSubmit={(event) => event.preventDefault()}>
        <Field label="Keyword">
          <Input name="keyword" />
        </Field>
      </form>
      <Drawer.Footer>
        <Button appearance="primary" type="submit" form="filters">
          Apply
        </Button>
        <Drawer.Close>
          <Button>Cancel</Button>
        </Drawer.Close>
      </Drawer.Footer>
    </Drawer>
  );
}
```

- **Position and size.** `position` is `end` (the default) or `start`, which follow the text direction, `left` or `right`, or `bottom` (along the bottom edge). `size` sets the width at a side and the height at the bottom: `small` (320px, the default), `medium` (592px), `large` (940px) or `full`; the panel never grows past the window. A width class in `className` (a height class for `bottom`) replaces the size. Both render as `data-position` and `data-size`. An overlay panel pads the safe-area insets of the screen edges it touches, once the page sets `viewport-fit=cover`.
- **Header, body and footer.** The `title` prop and the built-in Close button make the header row. A `Drawer.Header` replaces it: a `Drawer.HeaderNavigation` row (a Back button, a Toolbar of commands, in a `<nav>`) and a `Drawer.HeaderTitle` (the heading, `headingLevel`, an `action` area and the built-in Close button, which `closeButton={null}` hides). The rest of the content scrolls in the body; `Drawer.Body` gives it your props. `Drawer.Footer` is an action row below the body that never scrolls, wherever it is written among the children, with its actions at the start (Fluent's DrawerFooter; `justify-end` puts them at the end). Make the parts direct children of the Drawer (a Fragment there is fine): a part nested in another element renders in the body, with a development warning.
- **Separators.** The header draws a line under itself once the body is scrolled, the footer one above itself while content continues below (always in forced colours). The body, the header and the footer render the body's scroll state as `data-scroll-state` (`none`, `top`, `middle`, `bottom`) for your own styles.
- **Forms.** The footer is outside the body, so a `<form>` in the body does not contain it: give the form an `id` and its submit button `form`, as above.
- **Non-modal.** `modalType="non-modal"` leaves the page usable (see [Dialogs and triggers](#dialogs-and-triggers)); reserve the panel's width (its height at the bottom) in your layout while it is open, so it hides no page control. `modalType="alert"` renders `role="alertdialog"`.
- **Inline.** `type="inline"` renders the panel where the Drawer is, after its direct triggers, as an `<aside>` (a complementary landmark named by its title), also in the server HTML. It is page content: no portal, backdrop, focus trap, inert page or scroll lock, Escape and presses outside never close it, and toasts keep their corner. Its trigger toggles it; opening it moves no focus, and closing it returns focus only when focus was inside. `position` picks its inner edge and `size` its width; `separator` draws the inner edge. Place it in your layout, for example a flex row of the panel and the content. Changing `type` (an overlay below a breakpoint, inline above it) remounts the panel and its content.
- **Kept mounted.** `unmountOnClose={false}` keeps the panel and its content mounted while closed, `hidden` and `inert`, so a form keeps what was typed; an `autoFocus` inside never applies (each open of an overlay focuses its first focusable element), and a kept inline panel is in the server HTML, hidden. A `required` empty field in a closed kept drawer inside a page `<form>` still blocks its submission.
- **Motion.** An overlay panel slides in from its edge by its own size and fades, while its backdrop fades, over 250ms at `small`, 300ms at `medium`, 400ms at `large` and 500ms at `full`, both ways; `start` and `end` mirror in right-to-left layouts, `left` and `right` do not. An inline drawer opens and closes the space it takes in the layout over the same durations while its panel fades: the `<aside>` sits in an element of its own (`wave-drawer__collapse`), which renders no box while the drawer is open and is a clipping grid while it moves, so the panel keeps its size against its inner edge and the page beside it moves with the space. A `full` inline drawer has no motion, and one whose width (height at the bottom) in `className` is a percentage resizes oddly during the motion, correctly once open (give it a length, or pass `motion={null}`). `motion` and `backdropMotion` replace them, or turn them off with `null`. A closing drawer waits for its motion before it unmounts or hides. A `className` with `data-[presence=…]` classes while `motion` is unset keeps 0.14's behaviour: no default motion on the panel, and your classes animate it (an inline one inside the clipping element). See [Enter and exit motion](#enter-and-exit-motion).

### Popovers and tooltips

```tsx
import { Button, Popover, Tooltip } from '@mortenbrudvik/waveui';

export function Author() {
  return (
    <Popover openOnHover>
      <Popover.Trigger>
        <Button appearance="transparent">Maria Lopez</Button>
      </Popover.Trigger>
      <Popover.Content title="Maria Lopez">
        Product designer, Oslo.
        <Tooltip content="Get her updates in your feed" openDelay={500}>
          <Button size="small">Follow</Button>
        </Tooltip>
      </Popover.Content>
    </Popover>
  );
}
```

- **Hover cards.** `openOnHover` opens a Popover when the mouse rests on its trigger (`openDelay`, 250ms) and closes it `closeDelay` (500ms) after the pointer has left the trigger and the content, unless focus is inside the content (or in a layer opened from it). Opening and closing by hover move no focus (neither does the close of a hover card opened inside it); Tab from the trigger enters the content, as for any open Popover. A click on the trigger pins it (it stays open and focus stays where it is), and a second click closes it. Focus left on the trigger does not keep an unpinned card open. The triangle safe zone, the touch rule and "stays closed after Escape until the pointer leaves" are Menu's.
- **Context popovers.** `openOnContext` works as on Menu, with Popover's focus rules: a right click opens the popover at the pointer and leaves focus where it is (Tab from that element enters the content); Shift+F10 or the ContextMenu key opens it at the focused element and moves focus into the content, and Escape returns focus to that element. The region gets no `aria-haspopup` or `aria-expanded`, so name the content with `title`, `aria-label` or `aria-labelledby`.
- **`target`** on the Popover root (next to `side` and `align`; `PopupTarget`, as on `Menu.Popover`) places the content at an element held in state or at a `VirtualElement` instead of the trigger. A controlled popover with a `target` needs no trigger; a toggle button used as the target carries its own `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls` (give `Popover.Content` an `id`), a press on it does not count as outside, and Tab from it enters the content. `Popover`, `Menu.Popover` and TeachingPopover take the same `target`: an element held in state, a `VirtualElement` or a ref object (a ref is read after each render of the popup, and the popup stays hidden while it holds no element).
- **Tooltip timing.** `openDelay` (default 200ms) is how long the pointer rests on the child, or the child has keyboard focus, before the tooltip appears: unlike Menu's and Popover's `openDelay`, it applies to focus too. `closeDelay` (default 100ms) is how long it stays once the pointer has left the child and the tooltip; blur and Escape hide it at once. `delay` is the deprecated name of `openDelay` (it warns once in development).
- **Motion.** `Popover.Content` (and InfoButton's note) fades in and slides 4px away from the trigger, on the side it opened on, over 200ms, and back over 100ms; the Tooltip surface fades over 100ms both ways, without a slide (Fluent's Tooltip has no motion). While they exit they stay mounted, `inert`, with `data-presence` and `data-state="closed"`; focus leaves a closing popover in the same commit, and a tooltip pointed at again during its exit shows again on the same element. `motion` on `Popover.Content`, InfoButton, InfoLabel and Tooltip (its portaled surface; `className` stays on its wrapper) replaces it, or turns it off with `null`. A tooltip whose `content` you change as it closes (a "Copied" text reset in `onOpenChange`) shows the new text while it fades: reset it once the exit is over, or pass `motion={null}`.

### Teaching popovers and tours

`<TeachingPopover steps={steps} />` is a tour with Back, Next (Done on the last step) and Close. Built from parts, the same tour gets a trigger, a caption and interactive step buttons:

```tsx
import { Button, TeachingPopover } from '@mortenbrudvik/waveui';

const steps = [
  { title: 'Search', body: 'Type to filter the list.' },
  { title: 'Filters', body: 'Narrow the results by owner or date.' },
  { title: 'Share', body: 'Send the view to your team.' },
];

export function Tour({ onSeen }: { onSeen: () => void }) {
  return (
    <TeachingPopover steps={steps} onFinish={onSeen}>
      <TeachingPopover.Trigger>
        <Button>Take the tour</Button>
      </TeachingPopover.Trigger>
      <TeachingPopover.Surface>
        <TeachingPopover.Header>Tip</TeachingPopover.Header>
        <TeachingPopover.Carousel>
          <TeachingPopover.Title />
          <TeachingPopover.Body />
          <TeachingPopover.CarouselFooter initialStepText="Not now" finalStepText="Got it">
            <TeachingPopover.CarouselNav />
          </TeachingPopover.CarouselFooter>
        </TeachingPopover.Carousel>
      </TeachingPopover.Surface>
    </TeachingPopover>
  );
}
```

- **Footer actions.** `primaryAction` replaces Next (Done on the last step) and `secondaryAction` replaces Back, on the popover or on a step (the step's wins); a single-step tip, which has no Back, gets a second button this way ("Learn more" and "Got it"). An action is a label (drawn as a Button), a Button, `<button>` or `<a>` element, or a slot object (`{ as: 'a', href, children: 'Learn more' }` stays a Wave Button). Its `onClick` runs first, then the step's own action (Next, Done or Back) unless it called `preventDefault()`: a "Learn more" link on a later step calls it, or it also goes back. `footerLayout="vertical"` puts the buttons, full width, under the step dots.
- **Done and `onFinish`.** Done, and a primary action on the last step whose click was not prevented, close the popover and call `onFinish`, then, through 0.x, `onDismiss`; Close, Escape and the Trigger call only `onDismiss`. From 1.0 Done no longer calls `onDismiss`.
- **Parts.** `TeachingPopover.Trigger` opens and closes the popover (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`). While `target` is unset the popover points at it and follows it in the Tab order. Focus returns to the Trigger when the popover closes, also when `target` is set. Written directly inside TeachingPopover (a Fragment is fine), it makes the popover start closed. `TeachingPopover.Surface` is the popover and takes the `className`, `style`, `ref` and other element props that the `steps` form takes on TeachingPopover. Inside it, `Header` (the Close button, an optional caption and `icon`; `dismissButton` replaces the Close glyph or merges a Button into the Close button, and `null` removes it), `Title` (`as`; it names the popover), `Body` (`media` above the text) and `Footer` each show their share of the current step unless you give them children; a Surface without children shows all four, which is what the `steps` form renders. The steps, labels, actions and callbacks stay on TeachingPopover.
- **Carousel parts.** `TeachingPopover.Carousel` holds the current page (the title, the body and a `CarouselFooter`). `CarouselFooter` lays out an indicator and the buttons: `layout="offset"` (the default, the indicator at the start, as in the Footer) or `"centered"` (the indicator between the buttons; Fluent's default). `finalStepText` relabels Done, and `initialStepText` turns the first step's unavailable Back into an enabled button that dismisses the popover (`onOpenChange(false)`, then `onDismiss`; Fluent's calls `onFinish`). It is the same element as Back, so focus stays on it when Back leads to the first step, where a second press dismisses. The indicator is the decorative step dots unless you put `CarouselNav` there (a group of step buttons named "Step 2 of 3", each a Tab stop, the current one with `aria-current="step"`; `labels.nav` and `labels.navButton` translate them) or `CarouselPageCount` (a visible "2 of 3", worded by its render function child, `(current, total) => …`).
- **Placement.** Write the Trigger and the Surface directly inside TeachingPopover. A Trigger nested deeper does not make the popover start closed, and an open popover renders in place until that Trigger has mounted (in the server HTML too), then moves next to it, with focus passing through the Trigger. A Surface inside a component of yours works once mounted, but the server HTML holds the popover's own surface as well until then; a second Surface renders a second popover (development warning `TeachingPopover.Surface:placement`).
- **Motion.** The surface fades in over 200ms and out over 100ms, and, pointed at a `target` or the Trigger, slides 4px away from it and back; rendered in place, it only fades. It stays visible, with the step it showed, while it exits, and focus is back on the Trigger at once. `motion` on the TeachingPopover (for the surface it renders) or on `TeachingPopover.Surface` replaces it, or turns it off with `null`.

### Custom overlays

The hooks behind WaveUI's own surfaces are public, so a surface WaveUI does not ship (a command palette, a custom popup) joins the same layer stack: Escape closes the topmost layer first, a press in the Toaster or in a marked region closes nothing, and focus returns to the opener.

```tsx
import * as React from 'react';
import {
  Portal,
  useMergedRefs,
  useModalLayer,
  usePopupPosition,
  useDismiss,
  useRestoreFocus,
} from '@mortenbrudvik/waveui';

// A modal command palette: the page behind it is inert, Tab stays inside.
function CommandPalette({ open, onOpenChange, triggerRef }) {
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(surfaceRef, setSurface);
  const { layerId } = useModalLayer({
    open,
    container: surface,
    onDismiss: () => onOpenChange(false),
    refs: [surfaceRef],
    triggerRef,
  });
  if (!open) return null;
  return (
    <Portal layerId={layerId}>
      <div ref={mergedRef} role="dialog" aria-label="Command palette">
        <input aria-label="Search commands" />
      </div>
    </Portal>
  );
}

// A non-modal popup placed against its button.
function Details() {
  const [open, setOpen] = React.useState(false);
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const { setReference, setFloating, floatingProps } = usePopupPosition({ open, side: 'bottom' });
  const { layerId } = useDismiss({
    open,
    onDismiss: () => setOpen(false),
    refs: [triggerRef, surfaceRef],
    anchorRef: triggerRef,
  });
  useRestoreFocus({ enabled: open, container: surface, triggerRef });
  const buttonRef = useMergedRefs(triggerRef, setReference);
  const popupRef = useMergedRefs(surfaceRef, setSurface, setFloating);
  return (
    <>
      <button ref={buttonRef} onClick={() => setOpen((o) => !o)}>
        Details
      </button>
      {open && (
        <Portal layerId={layerId}>
          <div ref={popupRef} role="dialog" aria-label="Details" {...floatingProps}>
            …
          </div>
        </Portal>
      )}
    </>
  );
}
```

- **Layers.** `useDismiss` registers a layer (Escape, outside press and, for listboxes, focus leaving it); give `Portal` the returned `layerId` so a Popover or Menu opened inside becomes the layer's child and closes first. `useModalLayer` adds the trap, the `inert` isolation (WaveUI isolates instead of setting `aria-modal`, so toasts stay announced), the scroll lock and focus restore, with `modalType` `'modal'`, `'alert'` or `'non-modal'`.
- **Positioning.** `usePopupPosition` takes `side`, `align`, `offset`, `flip`, `fallbackPlacements`, `shift`, `fitViewport`, `matchReferenceWidth`, `strategy`, `hideWhenDetached` and `onPositioned`, and returns `update()`. The anchor is an element or a `VirtualElement`.
- **App-owned regions.** Spread `modalAllowProps` on a region that a modal must leave usable (a notification area); `useModalOpen()` tells you when a modal is open, so global shortcuts can wait.
- **`positioning` prop.** Popover, `Menu.Popover`, Tooltip, TeachingPopover, Combobox, Dropdown, TagPicker, DatePicker and TimePicker take `positioning={{ offset, fitViewport, matchReferenceWidth, fallbackPlacements }}` (and `target` where the component has one); `side` and `align` stay their own props.
- **Stability.** These hooks are public but pre-1.0: their options may still change through the usual deprecation path.

### Enter and exit motion

Dialog, Drawer, NavDrawer, Menu, Popover, InfoButton, Tooltip, TeachingPopover, Accordion, Tree, Nav, the toasts and MessageBarGroup animate in and out by default, with Fluent's motion tokens, and TabList, Carousel and ProgressBar take motion options. The listbox popups of Combobox, Dropdown, TagPicker and TimePicker, the DatePicker calendar and the AvatarGroup popover (and a popup of your own on `ListboxSurface`) do not animate yet ([ROADMAP §8.5](docs/ROADMAP.md#85-follow-ups-outside-the-gap-list)). The guide's "Component Motion" section lists the curves and every class.

| Part | Motion | In | Out |
|---|---|---|---|
| `Dialog.Content` | scales up from 85% and fades; its backdrop fades | 250ms | 200ms |
| Drawer and NavDrawer, overlay | slides in from its edge by its own size and fades; its backdrop fades | 250, 300, 400 or 500ms by `size` | the same |
| Drawer and NavDrawer, inline | the space it takes opens and closes while the panel fades (none at `full`) | by `size`, as above | the same |
| `Popover.Content`, `Menu.Popover` and its submenus, InfoButton's note, the TeachingPopover surface | fades and slides 4px away from its anchor, on the side it opened on | 200ms | 100ms |
| Tooltip | fades | 100ms | 100ms |
| `Accordion.Panel`, a Tree group, a `Nav.Category`'s list | the space it takes opens and closes while it fades | 200ms | 200ms |
| A toast (Toaster) | its place opens while it fades in and slides 8px from the stack's edge | 250ms | fades over 200ms, then its place closes over 200ms |
| A bar of a MessageBarGroup | its row closes, or (`animate="both"`) opens, while it fades | 250ms | 250ms |
| Nav item actions | fade as their row is hovered or takes focus | 150ms | 150ms |
| `Nav.Category`'s chevron | its half turn | 150ms | 150ms |
| TabList, `transparent` | the selection line slides and stretches to the new tab | 300ms | — |
| Carousel | the track slides, or (`motion="fade"`) the slides cross-fade | `motionDuration`, 300ms | — |

- **Exits.** A closing surface stays mounted for its exit, `inert`, with `data-presence="exiting"` (a popup also with `data-state="closed"`), so it takes no focus, click or key while it fades and is out of the accessibility tree. Everything else follows the open state: focus is back on the trigger, and the next Escape reaches the layer below, as soon as it closes, and its dismiss layer, focus trap, `inert` isolation, scroll lock and positioning are released then, not when its motion ends. Focus inside a collapsing panel moves to its trigger. Because `inert` hit-tests like `pointer-events: none`, a second click during an exit reaches what is under the surface (the page behind a fading Dialog); the page's scroll bar returns as a modal starts to fade; and an exiting popup keeps its last position while the page scrolls.
- **Turning it off, or replacing it.** Each animated part takes a motion slot (`MotionSlot`): `motion` on the part that moves, `backdropMotion` on the backdrops of Dialog, Drawer and NavDrawer, `expandIconMotion` on `Nav.Category` and `indeterminateMotion` on ProgressBar (Carousel's `motion` takes `'slide'`, `'fade'` or `null` instead). Unset is the default; `null` turns it off (a part with presence phases still renders them, and they end at once; Nav's expand icon, ProgressBar's fill and TabList's line just do not move); a class string or `{ className }` replaces the default classes with yours:

  ```tsx
  import { Button, Dialog, Popover } from '@mortenbrudvik/waveui';

  export function Examples() {
    return (
      <>
        <Dialog>
          <Dialog.Trigger>
            <Button>Rename</Button>
          </Dialog.Trigger>
          <Dialog.Content title="Rename" motion={null} backdropMotion={null}>
            The dialog appears and disappears at once.
          </Dialog.Content>
        </Dialog>
        <Popover>
          <Popover.Trigger>
            <Button>Details</Button>
          </Popover.Trigger>
          <Popover.Content
            title="Details"
            motion="transition-opacity duration-wave-slow ease-wave-easy-ease motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0"
          >
            A slower fade, without the slide.
          </Popover.Content>
        </Popover>
      </>
    );
  }
  ```

  Write a replacement as the defaults are written: the enter's start with `starting:` gated on the entering phase (`data-[presence=entering]:starting:…`), the exit with `data-[presence=exiting]:…`, and a `motion-reduce:` counterpart. A positioned surface (Popover, Menu, Tooltip, InfoButton's note, a TeachingPopover with a target) is placed with an inline `transform`: move it with `translate` or `scale`, and never transition `transform` (`transition`, `transition-all`, `transition-transform`), or it glides from its last position. The surface's motion decides when it unmounts, so a backdrop motion longer than the surface's exit is cut off.
- **Replacements and the precompiled CSS.** The default motion works on both style paths. A replacement's classes must exist in your CSS: your Tailwind build generates them, but the precompiled `./styles` holds only Wave's own classes, so there pass a class of your own CSS written against `[data-presence]` (as in the CSS example below).
- **Turning it all off.** `<WaveProvider motion="none">` makes every motion slot below it act as `null` (TabList's line included) and stops Carousel's slide or fade (a Carousel without its own `motion`) and the Nav item actions' fade; a part's own value still wins, and transitions that are no slot keep running (the turn of Accordion's and Tree's chevrons, colour changes), and a nested provider inherits `motion` like `theme` (`motion="default"` turns the defaults back on below it). It is Fluent's `MotionBehaviourProvider` with `'skip'`. End-to-end tests that expect a closed surface to be gone at once can render under it. Classes of yours on a `Presence` child are no motion slot and keep running.
- **Tuning.** The durations and curves are the `--wave-duration-*` and `--wave-curve-*` variables: redefine one in your CSS to retime every motion that uses it (`:root { --wave-duration-gentle: 200ms; }`), or replace one part's classes. There is no parameter form (Fluent's `surfaceMotion={{ duration }}`).
- **Reduced motion.** Under `prefers-reduced-motion: reduce` every animated surface and part appears and disappears at once: the presence core ends each phase at once, and every default class has a `motion-reduce:` counterpart. The indeterminate ProgressBar pulses at full width instead of sweeping, and a Carousel with `autoPlay` starts stopped.
- **0.14's classes in `className`.** A `className` with `data-[presence=…]` classes on `Menu.Popover`, `Dialog.Content`, Drawer or NavDrawer, while `motion` is unset, turns that part's default motion off, so the classes animate it as before (its backdrop still fades by default). Prefer `motion`.
- **Collapsing parts.** Accordion's region, a Tree group, a Nav category's list and an inline drawer's panel sit inside an element of their own, which carries the phases and the motion (`wave-accordion-panel__collapse`, `wave-tree-item__collapse`, `wave-nav-category__collapse`, `wave-drawer__collapse`). It renders no box while the part is open (`display: contents`), so the part lays out as without it, and is a clipping grid of one track while the part opens or closes, so the space changes while the part keeps its size.
- **Mounting.** A surface that is open when it mounts (`defaultOpen`) animates in, after hydration and on a client render alike. In-flow content (inline drawers, Accordion panels, Tree groups, Nav categories, the bars a MessageBarGroup mounts with) never animates on mount, on the server or the client.
- **Browser support.** `starting:` needs `@starting-style` (Chrome and Edge 117+, Safari 17.5+, Firefox 129+); older browsers show an element at once, without its enter motion, and the exit still runs.

**Your own motion.** Motion tokens are CSS variables on `:root`, the same in every theme: `--wave-duration-ultra-fast` (50ms), `-faster` (100ms), `-fast` (150ms), `-normal` (200ms), `-gentle` (250ms), `-slow` (300ms), `-slower` (400ms), `-ultra-slow` (500ms), and the curves `--wave-curve-accelerate-max`, `-accelerate-mid`, `-accelerate-min`, `-decelerate-max`, `-decelerate-mid`, `-decelerate-min`, `-easy-ease-max`, `-easy-ease` and `-linear`, with the values of Fluent's motion tokens (the guide's "Motion & Animation" chapter lists them). On the Tailwind path they are the utilities `duration-wave-*` and `ease-wave-*`; the precompiled `./styles` contains only the utilities Wave itself uses, so there use the variables in your own CSS.

`Presence` (and its hook, `usePresence`) mounts and unmounts an element with CSS enter and exit motion. The element carries `data-presence`: `entering`, `entered`, `exiting` or `exited`. Style its enter with the `starting:` variant (CSS `@starting-style`) gated on the entering phase, `data-[presence=entering]:starting:`, and its exit with `data-[presence=exiting]:` classes. It stays mounted, and `inert`, until its own transitions and animations have finished, and it unmounts at once when it has none.

```tsx
import * as React from 'react';
import { Button, Presence } from '@mortenbrudvik/waveui';

export function SavedNotice() {
  const [shown, setShown] = React.useState(false);
  return (
    <>
      <Button onClick={() => setShown((value) => !value)}>Toggle notice</Button>
      <Presence visible={shown}>
        <p className="transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid data-[presence=entering]:starting:translate-y-1 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:translate-y-1 data-[presence=exiting]:opacity-0 data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none">
          Saved
        </p>
      </Presence>
    </>
  );
}
```

```css
/* The fade without Tailwind: class="notice" on the child */
.notice {
  transition: opacity var(--wave-duration-normal) var(--wave-curve-decelerate-mid);
}
@starting-style {
  .notice[data-presence='entering'] {
    opacity: 0;
  }
}
.notice[data-presence='exiting'] {
  opacity: 0;
  transition-duration: var(--wave-duration-fast);
  transition-timing-function: var(--wave-curve-accelerate-mid);
}
@media (prefers-reduced-motion: reduce) {
  .notice {
    transition: none;
  }
}
```

- **Reduced motion.** Pair every motion class with a `motion-reduce:` variant, as above: the tokens are never zeroed, and Wave has no global reduced-motion rule. Under `prefers-reduced-motion: reduce` the presence core ends every phase at once, even while a motion runs.
- **Phases.** On the server and while hydrating the element renders its `entered` phase (a hidden one its `exited` phase), so no enter motion replays after hydration; `appear` runs it for an element that mounts visible on the client. Showing the element again while it exits returns it to `entering`, on the same element. `unmountOnExit={false}` keeps an exited element mounted, `hidden` and `inert`, so its state (a typed value, a scroll position) survives. `onEntered` and `onExited` report the end of a phase.
- **Gate the enter on the phase.** `@starting-style` applies to every first style of an element, whatever its phase. An ungated `starting:` class, or a `@starting-style` rule without `[data-presence='entering']`, therefore also fades in an element that mounts `entered`: without `appear`, and server-rendered content after hydration, while the core already reports `entered` and has called `onEntered`. The gated form runs only when the core runs the enter phase: a show after mount, `appear`, and a kept-mounted element shown again.
- **The hook.** `const { isMounted, ref, presenceProps } = usePresence(open)` for your own components: render the element while `isMounted`, pass it `ref` and spread `presenceProps` (`data-presence`, and `inert`/`hidden` when they apply). Destructure the result: `eslint-plugin-react-hooks` treats the whole object as a ref once its `ref` is passed on, and reports reads of its other members during render. Keep focus, dismissal and positioning on your open state, not on `isMounted`, so they happen on close and not after the exit motion.

### Toasts

Wrap the app (or the part that shows toasts) in `<Toaster>`; `useToastController()` throws in development outside it. Dispatch a `<Toast>` with its parts:

```tsx
import { Button, Toast, Toaster, useToastController } from '@mortenbrudvik/waveui';

function SendButton({ onUndo }: { onUndo: () => void }) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast(
          <Toast status="success">
            <Toast.Title
              action={
                <Toast.Close>
                  <Button size="small" appearance="transparent" onClick={onUndo}>
                    Undo
                  </Button>
                </Toast.Close>
              }
            >
              Email sent
            </Toast.Title>
            <Toast.Body subtitle="To 3 people">Your message was delivered.</Toast.Body>
          </Toast>,
        )
      }
    >
      Send
    </Button>
  );
}

export function App({ undoSend }: { undoSend: () => void }) {
  return (
    <Toaster
      position="bottom-end"
      shortcuts={{ focus: (event) => event.altKey && event.shiftKey && event.code === 'KeyN' }}
    >
      <SendButton onUndo={undoSend} />
    </Toaster>
  );
}
```

`dispatchToast` returns the toast's id; `dismissToast(id)` removes the toast and `dismissAllToasts()` every toast. The 0.5 form builds a toast from text: `dispatchToast({ status: 'success', title: 'Saved', body: 'Your changes are saved.' })`. A plain object is read as options; anything else (an element, a string, an array) is content.

- **Parts.** `Toast.Title` holds the title text, which names the toast, and an `action` at the end of its row; `Toast.Body` holds the body text and a `subtitle`, which describe it; `Toast.Footer` is a row of actions below. Make them direct children of `Toast` (plain children are the body, and the `title` prop renders a title, as in 0.5). `icon` replaces the status icon: only `undefined` keeps it, and `null` shows none. Flat names for Server Components: `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`.
- **`Toast.Close`** makes its single child dismiss the toast: it calls the Toast's `onDismiss` (when there is one), then dismisses the toast in the Toaster. Your `onClick` runs first, and `preventDefault()` keeps the toast. It also works in content without a `Toast`. Every Toast in a Toaster shows the Dismiss button as well.
- **Severity.** The rendered Toast's `status` sets the announcement's politeness (`error` is assertive, the others polite) and its spoken prefix ("Error:", translated with `statusLabel`). For content without a `Toast`, pass `status` (and `statusLabel`) in the options: `dispatchToast(<UploadProgress />, { status: 'info' })`. A `status` in the options that differs from the Toast's own warns in development, and the Toast's wins.
- **What is announced.** The Toaster reads each toast once, through permanent live regions that need no provider: the severity, the title, the body with its subtitle, then the labels of its actions ("Success: Email sent Your message was delivered. To 3 people Undo"), never the Dismiss button. Hidden text is skipped, and an image's `alt` is read. `announcement` in the options replaces everything but the severity, for a toast whose visible text is no good announcement (a progress toast). Dispatching the same `toastId` again replaces the toast and announces it again.
- **Timing.** A toast times out after 5 seconds (`timeout` in the options). Every toast pauses while the pointer or focus is anywhere in the toast region, and while the page is in the background (the window has lost focus, or the tab is hidden, also when the Toaster mounted there). A toast with an action (a button, a link or a field besides its Dismiss button) stays until it is dismissed: people who use a screen reader, a switch or voice control need time to reach it. Pass `timeout` to change that deliberately.
- **Keyboard.** `shortcuts.focus` returns `true` for the key press that moves focus to the newest toast; use a modifier (or let people change the shortcut), since a single-character shortcut fails WCAG 2.1.4. A focused toast is announced by its severity and title. Tab and Shift+Tab move through the toasts' controls; Escape dismisses every toast and returns focus to where it was (a tooltip or menu opened from a toast closes first); Delete or Backspace dismisses the focused toast (the keys are ignored in editable fields), and focus moves to the next toast, or the previous one, else back to where it was before the toasts. An Escape in the toasts never closes a Dialog below them: the next Escape does, once focus is back in the dialog.
- Toasts stay reachable by Tab over an open Dialog and move out of an open overlay Drawer's way, modal or not: beside a side drawer at their corner, above a bottom one (below it for top toasts; `--wave-toaster-offset-block`), and they keep their corner when there is no room. Next to an inline drawer, which is page content, they keep their corner. `statusLabel` and `dismissLabel` (props of `<Toast>`; `statusLabel` is also an option of both `dispatchToast` forms, `dismissLabel` of the text form) translate the hidden status text and the Dismiss button's name.
- **`limit`** caps how many toasts show at once (`<Toaster limit={3}>`). Further toasts wait in a queue, in dispatch order, and appear as shown toasts go; a waiting toast is not announced and its timer does not run until it shows. A dismissed toast stops counting at once, also while an exit motion of yours runs. Lowering the limit never hides a shown toast. A value below 1 counts as 1 (with a development warning), and a fraction rounds down. Dispatching the id of a waiting toast again replaces it and keeps its place; `dismissToast(id)` removes a waiting toast silently.
- **`dismissAllToasts()`** removes every toast, shown and waiting, and cancels their timers. When focus was in a toast, it returns to the element that had it before.
- **Motion.** A toast opens its place in the stack, fades in and slides 8px in from the stack's edge (from below at the bottom positions, from above at the top) over 250ms. Dismissed, it fades out over 200ms, then its place closes over 200ms more, so the toasts around it glide together and nothing jumps when it unmounts. It stays mounted and `inert` until the exit ends; focus has already moved on, and it no longer counts toward `limit`. The motion is on each toast's container (`wave-toaster__toast`, a one-cell grid around `wave-toaster__toast-content`); `<Toaster motion={…}>` replaces it, or turns it off with `null`. The timer starts when a toast is shown, as before. See [Enter and exit motion](#enter-and-exit-motion).

**Toasts from code outside components.** A query cache, an event handler or a helper module cannot call a hook. Create a handle with `createToaster()` at module scope and bind a Toaster to it:

```tsx
import * as React from 'react';
import { Toast, Toaster, createToaster } from '@mortenbrudvik/waveui';

/** Module scope is safe: on the server a dispatch does nothing. */
export const toaster = createToaster();

/** Callable from anywhere: a query cache's onError, an event handler, a helper. */
export function notifyUploadFailed(message: string) {
  return toaster.dispatchToast(
    <Toast status="error">
      <Toast.Title>Upload failed</Toast.Title>
      <Toast.Body>{message}</Toast.Body>
    </Toast>,
  );
}

export function Notifications({ children }: { children: React.ReactNode }) {
  return <Toaster toaster={toaster}>{children}</Toaster>;
}
```

A handle's toasts get everything above (the announcements, the pausing, `limit`, the focus handling, the Drawer offset, reachability over modals), and their content reads React context from where the Toaster is mounted, so a router link works. Dispatches before a Toaster binds wait in the handle's queue and show once it binds; `dispatchToast` returns the id at once, so `dismissToast(id)` also removes a waiting toast. After the Toaster unmounts, the handle queues again until the next one binds. A handle binds one Toaster (a second one does not bind, and warns in development): give each Toaster its own handle to run several (Fluent's `toasterId`). `useToastController()` keeps working inside a bound Toaster. Keep notifications in the Toaster rather than in an area of your own: an open modal `Dialog` or `Drawer` makes the rest of the page `inert`, so your own area would take no clicks, drop out of the accessibility tree and sit under the dialog, while the Toaster's region stays usable over modals.

### Message bars

```tsx
import { Button, MessageBar } from '@mortenbrudvik/waveui';

export function UpdateNotice({ onUpdate, onLater }: { onUpdate: () => void; onLater: () => void }) {
  return (
    <MessageBar status="warning" onDismiss={onLater}>
      <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
      <MessageBar.Actions>
        <Button size="small" onClick={onUpdate}>
          Update now
        </Button>
        <Button size="small" appearance="subtle" onClick={onLater}>
          Later
        </Button>
      </MessageBar.Actions>
    </MessageBar>
  );
}
```

- **Parts.** `MessageBar.Title` is a semibold lead-in, read right after the severity; `MessageBar.Actions` holds buttons (Retry, Learn more) after the text. Both are direct children of the bar (Fragments count, and so do the flat `MessageBarTitle` and `MessageBarActions` written in a Server Component); one inside a component of yours renders where it is and warns in development. The built-in Dismiss button (`onDismiss`) stays the bar's own, after the actions.
- **Layouts.** `layout="singleline"` keeps the actions on the text's row, `"multiline"` puts them on a row of their own under the text, and `"auto"` (the default) keeps them on the text's row while the text fits on one line and moves them below when it does not (measured after mount with a ResizeObserver; the server renders one row). No layout cuts text off: on one row it wraps inside its column. The DOM order is the same in every layout (icon, text, actions, Dismiss), so a reflow never moves the focused button, and the Tab order is the text's links, the actions, the Dismiss button. A bar without actions looks as in 0.7. The root carries `data-layout` with the layout in use (`singleline` or `multiline`).
- **Names.** With its default role (`alert` for warnings and errors, `status` otherwise) the bar is a live region, and its title is read as the start of its content, once: "Warning: Update available A new version is ready to install.", then the actions' labels. A notice that stays on the page can take `role="region"`: then the title names the bar ("Warning: Update available"), which makes it a landmark; such a bar needs a title or an `aria-label` (a development warning says so). A consumer `aria-label` or `aria-labelledby` always wins.

**Groups.** `MessageBarGroup` stacks bars with an 8px gap and animates the ones it gains and loses:

```tsx
import { MessageBar, MessageBarGroup, type MessageBarProps } from '@mortenbrudvik/waveui';

interface Notice {
  id: string;
  status: MessageBarProps['status'];
  text: string;
}

export function Notices({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: string) => void }) {
  return (
    <MessageBarGroup animate="both">
      {notices.map((notice) => (
        <MessageBar key={notice.id} status={notice.status} onDismiss={() => onDismiss(notice.id)}>
          {notice.text}
        </MessageBar>
      ))}
    </MessageBarGroup>
  );
}
```

- **Motion.** A bar removed from the children stays in its place, `inert`, while it fades out and its row closes over 250ms, so the bars below glide up instead of jumping; a negative bottom margin makes up for the gap, so nothing moves when it unmounts. `animate="both"` also opens the row of a bar added after mount and fades it in (`'exit-only'`, the default, adds it at once). Bars present at the group's first render, on the server too, never animate. The root renders `data-animate`; each bar sits in an element of its own (`wave-message-bar-group__item`, no box while the bar is shown), and `motion` replaces the motion of both directions, or turns it off with `null`. The margin matches the group's own 8px gap (`gap-2`): with another gap in `className` (`gap-4`), pass a `motion` whose margin matches it (`data-[presence=exiting]:-mb-4`, and `data-[presence=entering]:starting:-mb-4` with `animate="both"`).
- **Keys.** Give every bar a stable `key` (`key={notice.id}`): the group follows its children by key, so it keeps a removed bar in its place, moves a reordered one without remounting it, and shows again a bar that comes back during its exit. A child without a key of its own, or text, renders after the bars without motion, with a development warning (`MessageBarGroup:children`).
- **Focus.** When a bar leaves with focus inside it (its Dismiss button was pressed), focus moves in the same commit to the first tabbable element of the nearest remaining bar after it that has one, else of the nearest before it; when no bar is left, move it yourself.
- **Markup and bundles.** The group is a plain `<div>` without a role (`wave-message-bar-group`), and each MessageBar stays its own live region. It is a component of its own (Fluent's `MessageBarGroup`), not `MessageBar.Group`, so a page that imports only MessageBar loads none of its motion.

### Badges

- `color` takes `brand` (the default), `danger`, `important`, `informative`, `severe`, `subtle`, `success` and `warning`, with `appearance` `filled` (the default), `tint` or `outline`. `severe` is dark orange; `subtle` is the page background with foreground text, for a badge on a colored surface. CounterBadge takes the same palette (`<CounterBadge count={3} color="danger" />`), and `dot` makes it a small dot without a number. A dot keeps 3:1 against the page: the `informative` and `warning` dots are darker than those counts, and `subtle` is for dots on colored surfaces.
- **`important` changes in 1.0.** Through 0.x it renders the orange severe colors, as in 0.5. In 1.0 it becomes Fluent's neutral high-emphasis color (near black in the light theme): use `color="severe"` to keep the orange look.
- A badge whose text alone does not say what it means ("3") can be named: with `aria-label` or `aria-labelledby` a Badge or CounterBadge gets `role="img"`, so the name is announced (a `role` you pass wins; an empty or whitespace-only name counts as absent). `<CounterBadge dot aria-label="Unread messages" />` is a named unread dot.
- The root carries `data-color` and `data-appearance` with the resolved values (and `data-dot` on a dot), for your own selectors.

### Avatars and people

- **Sizes and shape.** `size` takes the named sizes or a box in pixels (16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120, 128); `shape="square"` rounds the corners. An Avatar in a `Tag` with `shape="rounded"` is square.
- **Initials** come from `getInitials(name, { dir, firstInitialOnly })`: two letters for a full name, one for a single name, brackets and punctuation dropped, a hyphen or apostrophe joins words. A name with digits only, emoji or a script without letter initials (Han, Kana, Hangul, Thai, Lao, Khmer, Myanmar, Tibetan) shows none, so an icon or the `initials` slot is the better content. `initials` replaces the text. On a right-to-left page the two letters of a left-to-right name swap; Hebrew and Arabic names keep their order.
- **Color.** `color` is `neutral` (the default), `brand`, `colorful` or one of `red`, `pumpkin`, `gold`, `forest`, `teal`, `blue`, `navy`, `lavender`, `purple`, `magenta`, `brown`, `steel`. `colorful` picks a named color from `idForColor`, else from `name`: the same input is always the same color, so a person keeps their color across pages. The palette is the `--wave-palette-<name>` and `--wave-palette-<name>-foreground` tokens; high contrast paints a white fill with black text. Each hue also has a tint, a tint foreground and a border (`--wave-palette-<name>-tint`, `-tint-foreground`, `-border`) for tags, badges and charts of your own; Avatar does not use them.
- **`active`** is `active` (the `activeAppearance` around the avatar: `ring`, `ring-shadow`, `shadow` or `glow`), `inactive` (dimmed) or `unset`.
- **Presence.** `PresenceBadge` `status` is `available`, `busy`, `away`, `offline`, `do-not-disturb` or `out-of-office` (Fluent's names); `dnd` and `oof` still work and log a deprecation warning. Inside an Avatar the badge takes the size that fits the avatar.
- **`Persona`** shows `primaryText` (default: `name`), then `secondaryText`, `tertiaryText` and `quaternaryText`, after, before or below the avatar (`textPosition`; below, the text is centered unless `textAlignment="start"`). `presenceOnly` swaps the avatar for the presence badge. A Persona without a `name` or text needs an `aria-label`.
- **`AvatarGroup`** `layout` is `stack` (overlapping), `spread` (a gap) or `pie` (up to three wedges of a circle). Members take the group's `size`; one with a size of its own keeps it. `max` splits the members; to write the split yourself, use `partitionAvatarGroupItems({ items, maxInlineItems, layout })` and render `AvatarGroup.Item`s with an `AvatarGroup.Popover` for the rest:

```tsx
const { inlineItems, overflowItems } = partitionAvatarGroupItems({ items: people, maxInlineItems: 3 });

<AvatarGroup aria-label="Project team">
  {inlineItems.map((name) => <AvatarGroup.Item key={name} name={name} />)}
  {overflowItems && (
    <AvatarGroup.Popover>
      {overflowItems.map((name) => <AvatarGroup.Item key={name} name={name} />)}
    </AvatarGroup.Popover>
  )}
</AvatarGroup>;
```

### Tags

Put tags that belong together in a `TagGroup`. By default it is a toolbar: one Tab stop, Left/Right between the tags (mirrored in RTL), Delete or Backspace to dismiss. When the focused tag is removed, focus moves to the next tag, else the previous one, else `fallbackFocusRef`, so it never falls to the page:

```tsx
import * as React from 'react';
import { Button, Tag, TagGroup } from '@mortenbrudvik/waveui';

const ALL_FILTERS = ['Red', 'Blue', 'Large'];

export function Filters() {
  const [filters, setFilters] = React.useState(ALL_FILTERS);
  const reset = React.useRef<HTMLButtonElement>(null);
  return (
    <div>
      <TagGroup
        aria-label="Active filters"
        dismissible
        fallbackFocusRef={reset}
        onDismiss={(value) => setFilters((current) => current.filter((f) => f !== value))}
      >
        {filters.map((filter) => (
          <Tag key={filter} value={filter} dismissLabel="Remove">
            {filter}
          </Tag>
        ))}
      </TagGroup>
      {/* Nothing to reset while every filter is set: unavailable, but still focusable. */}
      <Button
        ref={reset}
        disabledFocusable={filters.length === ALL_FILTERS.length}
        onClick={() => setFilters(ALL_FILTERS)}
      >
        Reset filters
      </Button>
    </div>
  );
}
```

- **Values.** Give every tag of a group its own `value`: it is what `onDismiss(value)` and the selection report. The group's `size`, `appearance`, `shape`, `dismissible` and `disabled` are the defaults of its tags (a tag's own wins, except that a disabled group disables every tag). `onDismiss` is called on every dismissal, after the Tag's own `onDismiss`; a dismissal you refuse (the tag stays) moves no focus.
- **Static tags.** `role="list"` makes the group a list of tags that only display: every tag is a list item, every control its own Tab stop, and the group handles no arrow key.
- **Selectable chips.** With `value`, `defaultValue` or `onValueChange` the group selects through `InteractionTag`s: each `InteractionTag.Primary` is a toggle (`aria-pressed`), and `onValueChange(values)` reports the selected values in selection order. Dismissing a selected tag also deselects it, and `name`, `form` and `required` submit one hidden input per value. Plain Tags are never selected; a Tag's `selected` is only a look.

```tsx
import * as React from 'react';
import { InteractionTag, TagGroup } from '@mortenbrudvik/waveui';

export function Topics() {
  const [topics, setTopics] = React.useState<string[]>(['design']);
  return (
    <TagGroup aria-label="Topics" value={topics} onValueChange={setTopics} name="topics">
      {['design', 'research', 'testing'].map((topic) => (
        <InteractionTag key={topic} value={topic}>
          <InteractionTag.Primary>{topic}</InteractionTag.Primary>
        </InteractionTag>
      ))}
    </TagGroup>
  );
}
```

- **InteractionTag** is a tag with an action: `InteractionTag.Primary` is a button (it opens a Popover, a Menu, a page), and an optional `InteractionTag.Secondary` is a separate Dismiss button named "Dismiss <text>" (`dismissLabel`). Both are Tab stops; in a TagGroup both join its arrow order, and Delete or Backspace on either dismisses the tag. Fluent's `hasSecondaryAction` is not needed: the Secondary's presence decides.
- **The look.** `appearance` (`filled`, `outline`, `brand`), `size` (`medium` 28px, `small` 24px, `extra-small` 20px) and `shape` (`circular`, the default, or `rounded`); `media` (an Avatar, which takes the tag's size), `icon` (decorative) and `secondaryText` (a second line) are slots; `disabled` dims the tag and disables its Dismiss button. Fluent's medium tag is 32px and its default shape `rounded`.
- **A link chip.** A Dismiss button cannot sit inside a link or a button, so a dismissible Tag rendered as one warns (`Tag:nested-button`). Put the link in the content instead, `<Tag dismissible><a href="/topics/react">React</a></Tag>`: Delete or Backspace on the link dismisses the tag.
- **On its own.** A standalone Tag cannot keep focus once you remove it. When its `onDismiss` removes it, first move focus to a neighbour (the next tag's Dismiss button, else the previous one, else a nearby control), then remove the tag. Prefer a TagGroup, which does this for you.

### Sorting and selecting in a DataGrid

Give the grid its data (`items`) and typed `columns`: it renders the header, the rows and their cells, and **sorts the rows itself** by the sorted column's `compare`.

```tsx
import { DataGrid, createTableColumn } from '@mortenbrudvik/waveui';

interface Person {
  id: string;
  name: string;
  role: string;
}

// Outside the component (or memoised): the rows render again when the array changes.
const columns = [
  createTableColumn<Person>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name),
    renderCell: (person) => person.name,
  }),
  createTableColumn<Person>({ columnId: 'role', label: 'Role', renderCell: (person) => person.role }),
];
const personId = (person: Person) => person.id;

export function People({ people }: { people: Person[] }) {
  return (
    <DataGrid
      aria-label="People"
      items={people}
      columns={columns}
      getRowId={personId}
      defaultSort={{ columnId: 'name', direction: 'ascending' }}
      selectionMode="multiple"
      selectOnRowClick
    />
  );
}
```

- **Columns.** `createTableColumn` returns a `DataGridColumn<T>` with `sortable` resolved: a column with `compare` is a sort button unless `sortable: false`. `label` is any content, `renderHeaderCell()` replaces it, and `renderCell(item)` fills the column's cells. `columnId` names the column in the header and in the sort (`id` is its deprecated name). A column with functions cannot be passed from a Server Component: define the columns in a client component.
- **Built-in sorting.** While the sort names a column with `compare` (the grid's own sort, from `defaultSort` and clicks, or a controlled `sort`), the rows are a stable sort of a copy of `items`, and descending negates `compare`: items that compare equal keep their order in `items` in both directions (a reversed ascending sort would also reverse them). A column without `compare` never reorders the rows, so leave it out when the server sorts, and fetch the sorted data in `onSortChange(sort, details)`. `sortIcon` on a `DataGrid.HeaderCell` replaces the arrow shown while the column is sorted (`false` shows none); `aria-sort` on the header tells the direction.
- **Rows.** `getRowId(item)` gives each row its `rowId`, which selection follows across sorts and new `items`; without it, a row's id is the item's index in `items`, which changes with the data. To write the rows yourself, give `DataGrid.Body` a render function, `{(person: Person) => <DataGrid.Row>…</DataGrid.Row>}` (the second argument is the item's index in `items`); each row gets its `rowId`. Write `DataGrid.Header` and `DataGrid.Body` directly inside the grid (a Fragment is fine): one rendered by a component of yours is not seen, and a grid with `columns` then adds its own header (with `items`, its own body too). A row renders again only when its item changes, and a sort only moves it. `items` may not be `undefined` unless `sort` or `defaultSort` is given; pass `items={data ?? []}` while loading: with `items`, `onSortChange` always receives the sort object and `details`.
- **Your own row order.** A grid composed from `DataGrid.Header` and `DataGrid.Body` children without `items` keeps the 0.13 contract: it reports the requested sort and you order the rows. Negate the comparison for the descending order, so equal rows keep their order:

```tsx
const [sort, setSort] = React.useState<DataGridSort | null>(null);
const rows = React.useMemo(() => {
  if (!sort) return people;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...people].sort((a, b) => sign * a.name.localeCompare(b.name));
}, [people, sort]);
// <DataGrid aria-label="People" columns={[{ columnId: 'name', label: 'Name', sortable: true }]}
//   sort={sort} onSortChange={setSort}> <DataGrid.Body>{rows.map(…)}</DataGrid.Body> </DataGrid>
```

- **Row selection.** `selectionMode` (`single`, `multiple`) with `selectedItems`, `defaultSelectedItems` and `onSelectedItemsChange(selectedItems, details)`. With `selectionMode="single"`, pass at most one id (with several, the first one is selected, or in a grid without `items` the first one whose row is rendered, with a development warning). Each row's selection control is named after the row's first `DataGrid.Cell`, `<td>` or `<th>` child (Fragments are looked into); a cell rendered by another component is not seen, so pass `selectionLabel` to `DataGrid.Row` then.
- **Selecting on a row click.** `selectOnRowClick` toggles a row when it is clicked (in single mode it selects the row alone, or clears it). The row's `onClick` runs first, and its `preventDefault()` keeps the selection. A click on a link, a button, an input or another interactive element in the row, a click from a popup opened from the row (a Menu in a cell), and a click that ends a text selection never toggle; Space on a cell toggles either way.
- **Looks.** `selectionAppearance` fills a selected row with the selected token (`brand`, the default), the subtle one (`neutral`) or not at all (`none`; the control, `aria-selected` and the forced-colors outline still show it). `subtleSelection` draws an unchecked row control only while its row is hovered or holds focus, and the select-all while the grid is (always in forced colors and on touch screens); the controls stay focusable and named.
- **Selection follows the data** in a grid with `items` (0.16): select-all selects every item whose selection is not disabled, rendered or not, and its checkbox shows their state; when all of them are selected it removes only their ids. A row click, Space and a row's control change one id, and the ids of rows that are not rendered (filtered out, on another page, outside a `virtualWindow`, restored by id) stay selected and are reported by `onSelectedItemsChange`, until your code removes them. Select-all reports the ids outside `items` first, then the selected ids in `items` order. Both use the ids from `getRowId`: a row that sets its own, different `rowId` is outside them (a development warning says so). A grid of `DataGrid.Row` children keeps the 0.15 rule: ids of rows that are not rendered drop out at the next change.
- **Per row.** `DataGrid.Row selectionCellProps` takes `disabled` (a natively disabled control: row clicks, Space and select-all skip the row, and select-all counts the enabled rows only), `invisible` (no visible control; the row still selects), `className` and `aria-label`. `DataGrid.SelectionCell` places the selection cell where you write it in a row (the select-all in a header row), instead of the automatic first cell. In a grid with `items`, `isSelectionDisabled(item, index)` disables items whether their rows are rendered or not (select-all skips them and keeps their state) and is the default `disabled` of each rendered row's selection cell; a cell's own `disabled` wins for its control, and a value that disagrees warns in development. Define it outside the component or memoise it: it is called for every item when `items`, `getRowId` or the function change.
- **Resizable columns.** With `columns` and `items`, `resizableColumns` puts a resize handle (a focusable `role="separator"`) at the end edge of each column's header cell: drag it with a mouse, a finger or a pen (mirrored in right-to-left grids), or press F2 on the header cell (or its sort button) to move focus to it, then the arrow keys (20 pixels, 5 with Shift), Home (the minimum width), and Enter, Space or Escape to return; Enter on a sortable header still sorts. A double click sets a resized column back to its initial width. `columnSizingOptions` gives each column a `minWidth` (80 by default) and its starting width (`defaultWidth`, else `idealWidth`, else 150), and `columnWidths` or `defaultColumnWidths` with `onColumnWidthsChange(widths, details)` hold the widths (every column's, by `columnId`), for instance to persist them. Any of these props lays the columns out from widths (a `<colgroup>`, a fixed table layout, cells truncated with an ellipsis), with or without handles. An unresized grid fills its container (at least as wide as its columns); after the first change, or with `columnWidths` or `defaultColumnWidths`, it is exactly as wide as its columns, so the dragged edge follows the pointer and slack shows after the last column. There is no auto-fit and no maximum width. `labels.resizeColumn` and `labels.columnWidth(width)` name the handles and their value ("Resize column", "150 pixels").

```tsx
import * as React from 'react';
import { DataGrid } from '@mortenbrudvik/waveui';

// Person, columns and personId as in the first example.
const SIZING = { name: { defaultWidth: 240, minWidth: 120 }, role: { idealWidth: 160 } };

export function ResizablePeople({ people }: { people: Person[] }) {
  const [widths, setWidths] = React.useState<Record<string, number>>(() =>
    JSON.parse(localStorage.getItem('people-widths') ?? '{}'),
  );
  return (
    <DataGrid
      aria-label="People"
      items={people}
      columns={columns}
      getRowId={personId}
      resizableColumns
      columnSizingOptions={SIZING}
      columnWidths={widths}
      onColumnWidthsChange={(next) => {
        setWidths(next);
        localStorage.setItem('people-widths', JSON.stringify(next));
      }}
    />
  );
}
```
- **Typing a wrapper.** A generic wrapper `function AppGrid<T>(props: DataGridProps<T>)` compiles and forwards every form, but an inline `onSortChange` passed to it next to `items` gets no contextual type: annotate its parameters, or type the wrapper's props as `DataGridBaseProps<T> & DataGridItemsSortProps<T>`.

### Static tables

`Table` keeps no state. A sortable `Table.HeaderCell` reports the click and shows the direction you give it; `Table.SelectionCell` is a native checkbox or radio driven by your state:

```tsx
import * as React from 'react';
import { Avatar, Button, Table } from '@mortenbrudvik/waveui';

type Member = { id: string; name: string; email: string };

export function Members({ members }: { members: Member[] }) {
  const [direction, setDirection] = React.useState<'ascending' | 'descending'>();
  const [selected, setSelected] = React.useState<string[]>([]);
  const sign = direction === 'descending' ? -1 : 1;
  const rows = direction ? [...members].sort((a, b) => sign * a.name.localeCompare(b.name)) : members;
  const all = selected.length === members.length ? true : selected.length > 0 ? 'mixed' : false;
  return (
    <Table aria-label="Members">
      <Table.Header>
        <Table.Row>
          <Table.SelectionCell
            aria-label="Select all members"
            checked={all}
            onCheckedChange={(checked) => setSelected(checked ? members.map((m) => m.id) : [])}
          />
          <Table.HeaderCell
            sortable
            sortDirection={direction}
            onSortClick={() => setDirection(direction === 'ascending' ? 'descending' : 'ascending')}
          >
            Name
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((member) => (
          <Table.Row key={member.id}>
            <Table.SelectionCell
              subtle
              aria-label={`Select ${member.name}`}
              checked={selected.includes(member.id)}
              onCheckedChange={(checked) =>
                setSelected((prev) =>
                  checked ? [...prev, member.id] : prev.filter((id) => id !== member.id),
                )
              }
            />
            <Table.Cell>
              <Table.CellLayout
                appearance="primary"
                media={<Avatar name={member.name} decorative />}
                description={member.email}
              >
                {member.name}
              </Table.CellLayout>
              <Table.CellActions>
                <Button size="small" appearance="subtle">{`Edit ${member.name}`}</Button>
              </Table.CellActions>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
```

- **Sortable headers.** `sortable` wraps the header's content in a `<button>` and puts `aria-sort` on the `<th>` (`"none"` while `sortDirection` is unset); `onSortClick(event)` runs on a click, Enter or Space. There are no grid semantics. `sortIcon` replaces the arrow (as on DataGrid), and `aside` puts content (a filter button) beside the sort button, outside its name.
- **Selection cells.** `checked` (`true`, `false` or `'mixed'`, an indeterminate select-all), or `defaultChecked`; `onCheckedChange(checked, details)`; `type="radio"` with a shared `name` selects one row (uncontrolled radios uncheck each other); `name`, `value`, `form` and `required` submit the control. Its id, ARIA attributes and focus, key and change handlers go to the input, `className` and `ref` stay on the cell. Name every control (`aria-label` or `aria-labelledby`; a development warning asks for it). `subtle` draws an unchecked box only while its row is hovered or holds focus, and `invisible` keeps the cell's box without a control.
- **Cell layout.** `Table.CellLayout` puts `media` (an icon, or an Avatar, which gets a 32px box) before the main text and a `description` under it; `truncate` keeps each line on one line where the column's width is bounded, and `appearance="primary"` marks the cell that names the row.
- **Cell actions.** `Table.CellActions` covers the end of its cell (the cell is its positioning box) and shows its buttons while the row is hovered or holds focus, always in forced colors and on touch screens; `visible` keeps them (while a menu opened from one is open). Its background follows the library's own row fills: none, the row hover, a `striped` table's stripe and a DataGrid's selected rows. A row background of your own, or a table on another surface (a Card), needs the same background class on the actions, and the actions must be direct children of the cell for the stripe and selection fills to match.

**State from hooks.** `useTableFeatures` holds a table's rows and its plugins hold the sort, the selection and the column widths, by row id and over every item, so a table that renders only a page or a window of its rows keeps select-all and the sort over all of them (Fluent's call shape; the `Components/Table/Features` story is the full version):

```tsx
import {
  Table,
  createTableColumn,
  useTableColumnSizing,
  useTableFeatures,
  useTableSelection,
  useTableSort,
} from '@mortenbrudvik/waveui';

type Member = { id: string; name: string; role: string };

// Outside the component, as the grid's columns: the rows keep their array while these stay.
const columns = [
  createTableColumn<Member>({ columnId: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) }),
  createTableColumn<Member>({ columnId: 'role', label: 'Role', compare: (a, b) => a.role.localeCompare(b.role) }),
];
const memberId = (member: Member) => member.id;
const sizing = { name: { defaultWidth: 240, minWidth: 120 } };

export function Members({ members }: { members: Member[] }) {
  const { getRows, sort, selection, columnSizing } = useTableFeatures(
    { items: members, columns, getRowId: memberId },
    [
      useTableSort({ defaultSort: { columnId: 'name', direction: 'ascending' } }),
      useTableSelection({ selectionMode: 'multiple' }),
      useTableColumnSizing({ columnSizingOptions: sizing }),
    ],
  );
  return (
    <Table aria-label="Members" {...columnSizing.getTableProps()}>
      <colgroup>
        <col style={{ width: 40 }} />
        <col {...columnSizing.getColumnProps('name')} />
        <col {...columnSizing.getColumnProps('role')} />
      </colgroup>
      <Table.Header>
        <Table.Row>
          <Table.SelectionCell
            aria-label="Select all members"
            checked={selection.allRowsSelected ? true : selection.someRowsSelected ? 'mixed' : false}
            onCheckedChange={(_checked, details) => selection.toggleAllRows(details?.event)}
          />
          {(['name', 'role'] as const).map((columnId) => (
            <Table.HeaderCell
              key={columnId}
              className="relative"
              sortable
              sortDirection={sort.getSortDirection(columnId)}
              onSortClick={(event) => sort.toggleColumnSort(columnId, event.nativeEvent)}
              aside={<Table.ResizeHandle {...columnSizing.getResizeHandleProps(columnId)} />}
            >
              {columnId === 'name' ? 'Name' : 'Role'}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {getRows().map(({ item, rowId }) => (
          <Table.Row key={rowId}>
            <Table.SelectionCell
              aria-label={`Select ${item.name}`}
              checked={selection.isRowSelected(rowId)}
              onCheckedChange={(_checked, details) => selection.toggleRow(rowId, details?.event)}
            />
            <Table.Cell>{item.name}</Table.Cell>
            <Table.Cell>{item.role}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
```

- **Plugins.** Call each plugin hook unconditionally in the array (or before it) and pass the same plugins on every render; a slot without its plugin holds inert values, and the order of the array does not matter (a feature given twice uses its last plugin, with a development warning). Options may be written inline: a plugin whose options change identity only makes the state be computed again, while `getRows()` keeps its array until `items`, `getRowId`, `columns` or the sort change.
- **Sort.** `useTableSort` takes DataGrid's sort shape (`sort`, `defaultSort`, `onSortChange(sort, details)`); `getRows()` is a stable sort of a copy of `items` by the sorted column's `compare` (descending negates it), and `sort` gives `value`, `setColumnSort`, `toggleColumnSort` and `getSortDirection`.
- **Selection.** `useTableSelection` takes DataGrid's selection props (`selectionMode`, `selectedItems`, `defaultSelectedItems`, `onSelectedItemsChange(selectedItems, details)`, row ids) and `isDisabled(item, index)`. `allRowsSelected` and `someRowsSelected` count every selectable item of `items`, rendered or not; `toggleAllRows` selects them all, or removes only their ids (a selected disabled item and ids outside `items` keep their state), and `clearRows` empties the selection. For a selection without a table, `useSelection` holds the same id set (`toggle`, `select`, `deselect`, `toggleAll(universe)`, `clear`).
- **Column widths.** `useTableColumnSizing` takes DataGrid's sizing props (`columnSizingOptions`, `columnWidths`, `defaultColumnWidths`, `onColumnWidthsChange(widths, details)`); spread `getTableProps()` on the table (a fixed layout and its width), `getColumnProps(columnId)` on each `<col>` and `getResizeHandleProps(columnId)` on a `Table.ResizeHandle`, which the `aside` of a positioned header cell (`relative`) holds. The handle is a Tab stop in a static table: Tab to it, then the arrow keys (20 pixels, 5 with Shift), Home and End (the minimum and, with `maxWidth`, the maximum); a double click sets a resized column back to its initial width. It keeps no width of its own: without the hook, pass `width`, `minWidth` and `onResize(width, details)` from your state. `label` ("Resize column") and `valueText(width)` ("N pixels") name it and its value.

### Lists

A `List` without selection is a plain list. `navigationMode="items"` makes its items one Tab stop with the arrow keys, Home, End and typeahead, and `onAction` gives an item an action of its own:

```tsx
import { List } from '@mortenbrudvik/waveui';

export function RecentFiles({ open }: { open: (file: string) => void }) {
  return (
    <List navigationMode="items" aria-label="Recent files">
      <List.Item value="report" onAction={() => open('report')}>
        Report
      </List.Item>
      <List.Item value="budget" onAction={() => open('budget')}>
        Budget
      </List.Item>
    </List>
  );
}
```

- **Navigation modes.** Unset, the list picks its mode as in 0.13: a plain list is `'none'`, a selectable one `'items'` (a listbox), and a selectable one whose items have actions `'composite'` (a grid), which remounts the items when the first action appears or the last one goes. `navigationMode="composite"` makes the grid from the first render (with or without selection), so nothing remounts. `'items'` on a selectable list whose items have actions acts as `'composite'`, and `'none'` on a selectable list is ignored (development warnings say so). The resolved mode is `data-navigation-mode`. A list without selection keeps the item that last had focus as its Tab stop.
- **`onAction`** runs on a click and on Enter, and on Space where the item cannot be selected (a list without selection, an item without `value`); in a selectable item Space only toggles. It runs after the item's `onClick` and before the selection toggles: `event.preventDefault()` keeps the selection. Clicks and keys in the item's actions never run it. In a list that does not navigate its items it runs on clicks only, with a development warning.
- **`disabledSelection`** keeps an item's selection as it is (click, Enter and Space) while the item stays focusable and in the arrow order; without `onAction` it is also `aria-disabled`.
- **Check marks.** `checkmark` on a selectable List draws a decorative check at the start of each selected item; `List.Item checkmark` replaces it with your glyph or hides it (`false`).
- **Long lists.** `virtualWindow` with `count` and a function child `(index) => <List.Item …/>` renders only the items in view (see [Large data](#large-data)); the keys then move by index over the whole list, and selection keeps the values of items that are not rendered.

### Trees

```tsx
import * as React from 'react';
import { Button, Tree } from '@mortenbrudvik/waveui';

export function FileTree() {
  const [checked, setChecked] = React.useState<string[]>(['docs']);
  return (
    <Tree
      aria-label="Files"
      selectionMode="multiple"
      checkedItems={checked}
      onCheckedItemsChange={setChecked}
    >
      <Tree.Item value="docs" aside="3 files">
        Documents
        <Tree.Item value="cv">CV.pdf</Tree.Item>
        <Tree.Item value="letter">Letter.docx</Tree.Item>
        <Tree.Item value="notes">Notes.txt</Tree.Item>
      </Tree.Item>
      <Tree.Item
        value="photos"
        actions={
          <Button size="small" appearance="subtle">
            Share
          </Button>
        }
      >
        Photos
        <Tree.Item value="beach">Beach.jpg</Tree.Item>
      </Tree.Item>
    </Tree>
  );
}
```

- **Selection modes.** `selectionMode` is `'none'` (the default: activation only, and `selected` highlights one item), `'single'` (a radio indicator on every item for `selected`/`onItemSelect`; pass `selected`, a development warning asks for it) or `'multiple'` (a checkbox on every item, bound to `checkedItems` or `defaultCheckedItems`; Fluent's `'multiselect'`). The root carries `data-selection-mode`.
- **Checks cascade.** Checking an item checks it and all its descendants; unchecking does the reverse. A parent shows checked when all its descendants are checked, mixed when some are and unchecked when none are, and a listed parent also checks children that load later. `onCheckedItemsChange(checkedItems, details)` fires only on change, with a new array: every checked item in tree order (fully checked parents included, mixed ones not), then the listed values that match no item, unchanged, so values filtered out of the tree are not lost. `details` gives the toggled item's `value`, its new `checked` state and the DOM `event` (typed optional until 1.0).
- **Lazy children.** A "Loading…" placeholder item is an item like any other: checking its parent lists its value too, and once the real children replace it, that value matches no item and stays in the list. Drop it from your state when the children arrive (a listed parent keeps checking them).
- **Keys and clicks.** In a checkbox tree Space toggles the focused item and Enter activates it (`onItemSelect`); a click on the checkbox toggles, and a click elsewhere on the row activates. The checkbox is a real `role="checkbox"` named by the item, outside the Tab order, so touch screen readers and voice control reach it too. `*`, `current` and typeahead work as before (a Space typed within 500 ms of a letter continues the search).
- **Row content.** `Tree.Item` takes `actions` (buttons at the end of the row, in a toolbar named by the item; shown while the row is hovered or has focus, and always in forced colors and on devices without hover), `aside` (a count or badge at the end of the row, part of the item's description; it gives way to the actions on hover and focus), `iconAfter` (decorative, after the label) and `expandIcon` (replaces the chevron: `null` or `undefined` keep it, `false` hides it, and `aria-expanded` still reports the state). Keys and clicks on the actions never activate, check or expand the item. Give an icon-only action an `aria-label`. Hidden actions keep their width, so a row does not shift when they show; prefer icon-only actions in a narrow tree.
- **Dialogs opened from an action.** The actions also stay shown while a Menu, Popover or Dialog rendered inside them is open or has focus, so its focus return reaches the action. A Dialog rendered elsewhere and opened from an action through state (a "Delete…" menu item that opens a confirm Dialog outside the tree) closes after the actions have hidden again, on devices with hover and outside forced colors: a hidden action cannot take focus, so focus returns to the nearest element that can, normally the item. To return focus to the action, render the Dialog inside `actions`, with its `Dialog.Trigger` there or as a controlled `Dialog` next to the Menu that opens it (`finalFocusRef` cannot name the action, which is still hidden when the dialog closes).
- **Navigation modes.** With `navigationMode="tree"` (the default), Tab from the focused item enters its actions (one stop; the arrow keys move inside them) and Shift+Tab returns. With `"treegrid"`, the "next" arrow (Right, Left in RTL) moves into the actions of an expanded parent or a leaf (a collapsed parent still expands first), "previous" returns, and Up and Down move between items from an action; the actions then take no Tab stop. This replaces APG's "next on an open item moves to its first child" (Down does that). The roles stay `tree` and `treeitem` in both modes, as in Fluent.
- **Persona rows.** `Tree.ItemPersonaLayout` (flat `TreeItemPersonaLayout`, Fluent's name) lays out an item's label as a person: `media` (an Avatar of size 32 fits a row), the name as children and a `description` under it; the item is named by the name and described by the description.
- **Motion.** A child group opens and closes the space it takes while it fades, over 200ms both ways, in an element of its own around the `role="group"` element (`wave-tree-item__collapse`, `display: contents` while open); a nested group goes with its parent. The items of a closing group leave the arrow order and typeahead at once, and focus inside it moves to the item that collapsed. `Tree motion` replaces the motion of every group, or turns it off with `null`; the chevron's turn is not part of it. A pointer click that falls through an exiting group onto its item (an `inert` element lets the pointer through) does nothing; Enter and a screen reader's click on the item still activate it.

**Flat trees.** `FlatTree` builds a tree from flat data, for trees of thousands of items: `useFlatTree(items, options)` takes items with a `parentValue` (in any order) and the nested Tree's state props, and the tree renders the visible items (the roots and the children of every expanded branch) as sibling `role="treeitem"` elements with `aria-level`, `aria-setsize`, `aria-posinset` and, on branches, `aria-expanded`:

```tsx
import * as React from 'react';
import { FlatTree, useFlatTree, useVirtualWindow, type FlatTreeItemData } from '@mortenbrudvik/waveui';

export function Files({ items }: { items: readonly FlatTreeItemData[] }) {
  const [checked, setChecked] = React.useState<string[]>([]);
  const model = useFlatTree(items, {
    defaultExpandedItems: ['docs'],
    selectionMode: 'multiple',
    checkedItems: checked,
    onCheckedItemsChange: setChecked,
  });
  const virtualWindow = useVirtualWindow({ itemSize: 28 });
  return (
    <FlatTree
      aria-label="Files"
      model={model}
      {...model.getTreeProps()}
      virtualWindow={virtualWindow}
      style={{ height: 400 }}
    />
  );
}
// items: [{ value: 'docs', label: 'Documents' }, { value: 'cv', parentValue: 'docs', label: 'CV.pdf' }, …]
```

- **The model.** `useFlatTree` returns `visibleItems` (each with `item`, `level`, `position`, `setSize`, `parentValue`, `hasChildren`, `isBranch`, `expanded`, `index` and, in multiple mode, `checked`), `getItem`, `expand` (a value or a list, in one change), `collapse`, `toggle`, `isExpanded`, `setChecked` and `getTreeProps()`. Expanded and checked state take the nested Tree's names (`expandedItems`, `defaultExpandedItems`, `onExpandedItemsChange`, `checkedItems`, `defaultCheckedItems`, `onCheckedItemsChange(checkedItems, details)`), and checks cascade the same way. `itemType: 'branch'` makes an item without children expandable (children loaded on demand). Pass `items`, and controlled arrays, as stable references: the model is rebuilt when they change. An unknown `parentValue` (the item becomes a root), a cycle of parents (cut) and a duplicate value (the first wins) warn in development.
- **The tree.** `FlatTree` takes `model`, `selectionMode` (`model.getTreeProps()` passes the model's), `selected`, `current`, `onItemSelect(value)` and `renderItem(row)` (the item's content; its `label` by default), with the nested Tree's keys, chevrons, checkboxes and radios. An item whose data is `disabled` is skipped by the keys and typeahead and cannot be activated, expanded or checked by the user. When a branch collapses around the focused item (from code), focus moves to the branch. It has no row actions, `aside` or motion (items expand and collapse at once). Name it with `aria-label` or `aria-labelledby` (a development warning asks for one).

### Breadcrumbs

```tsx
import { Breadcrumb } from '@mortenbrudvik/waveui';

export function Trail() {
  return (
    <Breadcrumb maxDisplayedItems={4} overflowLabel="More folders">
      <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
      <Breadcrumb.Item href="/docs">Docs</Breadcrumb.Item>
      <Breadcrumb.Item href="/docs/guides">Guides</Breadcrumb.Item>
      <Breadcrumb.Item href="/docs/guides/tables">Tables</Breadcrumb.Item>
      <Breadcrumb.Item href="/docs/guides/tables/sorting">Sorting</Breadcrumb.Item>
      <Breadcrumb.Item current>Stable sorts</Breadcrumb.Item>
    </Breadcrumb>
  );
}
// Home › … › Tables › Sorting › Stable sorts; the "…" button opens a menu with Docs and Guides.
```

- **Collapse by count.** `maxDisplayedItems` is the most items shown, the "…" not counted; the middle items from `overflowIndex` (default `1`) go into a "…" button (`overflowLabel`, default "More items") that opens a Menu of them, in trail order: a link item becomes a `Menu.ItemLink` (an `asChild` link too; the element's own `href` wins over the item's, as on the trail), a button item a `Menu.Item`, and an unavailable item stays unavailable there. An `asChild` element of a component (a router link: `<RouterLink to="/docs">`, WaveUI's `<Link as={RouterLink} to="/docs">`, or a Next-style `<NextLink href="/docs">`) becomes a `Menu.ItemLink` rendered by that component with the element's own props, its `as`, `disabled` and `onClick` included (the element's `onClick` runs before the item's), so choosing it navigates the way the trail's link does and closes the menu; the link component must forward `ref` and spread its props onto its anchor. A Fragment around an `asChild` element is opened, whether the element is an `<a>` or a component's, in the menu as on the trail. The entry of a link item or of an `asChild` `<a>` passes on only its `href` and `onClick` (besides its icon, label and disabled state), so a `target`, `rel` or `download` stays on the trail. This applies to both collapses. The first item and the last `current` item are never hidden (the hidden run moves past a current item in the middle). An item the menu cannot list (one without `href` or `onClick` is listed disabled; an element that is not a `Breadcrumb.Item` is left out) logs a development warning. `partitionBreadcrumbItems({ items, maxDisplayedItems, overflowIndex })` gives Fluent's split (`startDisplayedItems`, `overflowItems`, `endDisplayedItems`) for a trail you lay out yourself.
- **Collapse by room.** `overflow="auto"` hides the middle items that do not fit, from the start of the trail, and puts a "…" list item with its own separator where they were ("Home › … › Parent › Page"); resizing wider shows them again in order. The first item and the last `current` item never hide; when even they do not fit, the "…" covers the end of the trail. The trail is then an `Overflow` (`role="list"`, with `wave-overflow` and 4px of padding) that measures with `ResizeObserver`, and `maxDisplayedItems` and `overflowIndex` do not apply. Its list element is a `<div role="list">` holding the `<li>` items: assistive technology reads a list, but the nesting is not valid HTML (an Overflow root rendered as a list element is deferred to a later release). The "…" list item is the Overflow's button wrapper (`wave-overflow__overflow-button`); the button in it carries `wave-breadcrumb__overflow-button` in both modes.
- **Size, keys and divider.** `size` (`small`, `medium`, `large`) sets the text and the separator. `focusMode="arrow"` makes the trail one Tab stop (the last focused link or button, at first the first one) moved with Left and Right (mirrored in RTL), Home and End, the "…" button included and hidden items skipped. `divider` replaces the chevron (`"/"`, an icon; not mirrored), and `false` hides the separators.
- **Long names.** `truncateBreadcrumbLongName(name)` shortens a name longer than 30 characters to its first 30 and adds `...` (a second argument changes the length), `truncateBreadcrumbLongTooltip(text)` does the same at 80 for a tooltip, and `isTruncatableBreadcrumbContent(text, maxLength)` tells whether a text would be cut, so you show the full name in a `Tooltip` only then. A collapsed item wrapped in a Tooltip is not a `Breadcrumb.Item` to the trail, so it is left out of the overflow menu (with a development warning): wrap only items that the collapse keeps, or leave the Tooltip out where the trail collapses.

### Navigation

`Nav` is a side navigation of items, collapsible categories and sub-items. Every child of its list renders a list item, so put only Nav parts there, or wrap other content in an `<li>` (a development warning names the rest):

```tsx
import { Button, Nav, Tooltip } from '@mortenbrudvik/waveui';

export function Sidebar() {
  return (
    <Nav aria-label="Main" defaultValue="inbox">
      <Nav.AppItem href="/">Contoso Mail</Nav.AppItem>
      <Nav.SectionHeader>Mail</Nav.SectionHeader>
      <Nav.Item
        value="inbox"
        href="/inbox"
        actions={
          <Tooltip content="New message" relationship="label">
            <Button appearance="subtle" size="small" icon={<span aria-hidden>+</span>} />
          </Tooltip>
        }
      >
        Inbox
      </Nav.Item>
      <Nav.Divider />
      <Nav.Item value="settings" href="/settings">
        Settings
      </Nav.Item>
    </Nav>
  );
}
```

- **Section headers** (`Nav.SectionHeader`) are headings inside list items, `<h3>` by default (`headingLevel`); pick the level that fits the page's outline. **`Nav.Divider`** is a decorative line, hidden from assistive technology (the section header carries the structure).
- **App items.** `Nav.AppItem` is the app's name at the top, with an `icon`: a link with `href`, else a button, never selected. `Nav.AppItemStatic` is the same row without an action.
- **Item actions.** `actions` on `Nav.Item` and `Nav.SubItem` (Fluent's SplitNavItem) renders your own controls beside the item's link, never inside it, in a group named by the item: a ToggleButton that pins the page, a MenuButton with more commands, each with its own name (a Tooltip with `relationship="label"` names an icon-only one). Each is a Tab stop after its item, and a click on one never selects the item. They are drawn while the row is hovered or has focus, while one is pressed or has its popup open, and always on touch screens and in forced colours; otherwise they are transparent and still focusable. They fade in and out over 150ms (at once under reduced motion and below `WaveProvider motion="none"`); the fade sets the transition of each action, so a transition class of yours on one is replaced.
- **Categories.** A category's list opens and closes the space it takes while it fades, over 200ms both ways, in an element of its own around the `<ul>` (`wave-nav-category__collapse`, `display: contents` while open); focus inside a closing list moves to the category's button. `Nav.Category motion` replaces the collapse, or turns it off with `null`. `expandIcon` replaces the chevron (an optional indicator: `false` hides it; a glyph of yours is not turned, so a plus or a minus picked from `openCategories` works; a `<button>` or `Button` passed there is unwrapped, with a development warning), and `expandIconMotion` the transition of its half turn (150ms; `null` makes the turn snap).

### Navigation drawers and app shells

`NavDrawer` puts Nav's items and selection in a drawer panel, and `Hamburger` toggles it. Keep the drawer controlled, and pass the page's Hamburger as `finalFocusRef`, so focus returns to it when a Hamburger inside the drawer closes it:

```tsx
import * as React from 'react';
import { Hamburger, Nav, NavDrawer } from '@mortenbrudvik/waveui';

export function Shell({ narrow }: { narrow: boolean }) {
  const [open, setOpen] = React.useState(!narrow);
  const outer = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="flex">
      <Hamburger
        ref={outer}
        aria-expanded={open}
        aria-controls={open ? 'main-nav' : undefined}
        aria-haspopup={narrow ? 'dialog' : undefined}
        onClick={() => setOpen(!open)}
      />
      <NavDrawer
        id="main-nav"
        aria-label="Main"
        type={narrow ? 'overlay' : 'inline'}
        open={open}
        onOpenChange={setOpen}
        // Every activation, the current page included: an overlay closes on it.
        onItemSelect={() => {
          if (narrow) setOpen(false);
        }}
        finalFocusRef={outer}
        defaultValue="home"
      >
        {narrow && (
          <NavDrawer.Header>
            <Hamburger />
            Contoso HR
          </NavDrawer.Header>
        )}
        <NavDrawer.Body>
          <Nav.Item value="home" href="/">
            Home
          </Nav.Item>
          <Nav.Item value="reports" href="/reports">
            Reports
          </Nav.Item>
        </NavDrawer.Body>
        <NavDrawer.Footer>
          <Nav.Item value="settings" href="/settings">
            Settings
          </Nav.Item>
        </NavDrawer.Footer>
      </NavDrawer>
      <main className="min-w-0 flex-1">…</main>
    </div>
  );
}
```

- **Composition.** `NavDrawer.Header` (a row: a Hamburger, the app's name), `NavDrawer.Body` (the scrolling list) and `NavDrawer.Footer` (a list pinned below it), in the order written. Nav parts go in the Body and the Footer; a list item elsewhere warns (`NavDrawer:loose-items`).
- **`type` and the breakpoint.** `overlay` (the default) is a modal dialog around a `<nav>` (or `modalType="non-modal"`, which keeps the page usable: keep the page's controls clear of it), rendered in a portal in the browser only; `inline` is part of the page layout, also in the server HTML. A responsive shell switches `type` at a breakpoint and sets the open state when the breakpoint changes (open inline on wide screens, closed as an overlay on narrow ones), so a resize never turns an open pane into a page-blocking modal. Changing `type` remounts the panel and keeps the selection and the open categories. The NavDrawer stories' App shell composes a Toolbar with a Hamburger, a NavDrawer and an inline details Drawer this way.
- **The Hamburger** is a `subtle` icon-only Button named "Navigation" (`aria-label` localizes it; its name never changes, the state is `aria-expanded`). Inside a NavDrawer it toggles the drawer and renders `aria-expanded` and `aria-controls`; outside, wire it yourself, as above.
- **Closing on selection.** `onItemSelect(value)` fires on every activation, also when the current page is activated again (not for a disabled item or a link opened in another tab): close an overlay there. `onValueChange` fires only when the value changes, so it misses a tap on the current page. Fluent's `onNavItemSelect`.
- **The landmark.** One `<nav>`, named "Navigation" by default; an overlay is also a dialog with that name. Rename it (`aria-label`, `aria-labelledby`) when the page has another navigation landmark.
- **`focusMode`.** Every item is a Tab stop by default (`NavDrawer.Body focusMode="tab"`). `focusMode="arrow"` makes the body one Tab stop, at first the current page, with both arrow pairs (wrapping), Home and End; screen readers do not announce arrow keys in a navigation landmark, so prefer the default unless your users expect an app pane. Fluent's NavDrawer uses arrow keys by default (its `tabbable` adds Tab stops).
- **Width.** `size` defaults to `small` (320px), Drawer's scale; Fluent's navigation pane is 260px wide, `className="w-65"` on your Tailwind build (or a class of your own with `width: 260px`). `position` defaults to `start` (Drawer's to `end`), and `separator` to on.
- **Server rendering.** An inline NavDrawer renders in the server HTML (open, or hidden when kept mounted); with `focusMode="arrow"` its Tab stop is set once it has mounted.
- **Motion.** As Drawer's: an overlay slides in from its edge and fades while its backdrop fades, and an inline drawer opens and closes its space (`wave-drawer__collapse` and `wave-nav-drawer__collapse` on the element around its panel); a NavDrawer without `size` takes the `small` duration, 250ms. `motion` and `backdropMotion` replace them, or turn them off with `null`.

### Cards, tabs and carousels

- **Card** `appearance` is `filled` (the default), `filled-alternative`, `outline` or `subtle`; `size` (`small`, `medium`, `large`) sets the padding of its parts through `--wave-card-padding`; `orientation="horizontal"` puts a `Card.Preview` beside the text. `Card.Preview` takes a `logo` over its bottom start corner. `Card.Header` takes an `image` (an Avatar, say) and an `action` (a menu button). With `selectionControl="checkbox"`, `checkbox` merges onto the built-in checkbox (an object), replaces it (an element) or removes it (`null`, when you render the control elsewhere); `floatingAction` sits over the top end corner and moves the checkbox to the start corner.
- **TabList** `appearance` is `transparent` (the default), `subtle`, `subtle-circular` or `filled-circular`, and `size` `small`, `medium` or `large`. A `TabList.Tab` with an `icon` and no text is icon-only: give it an `aria-label` (development warning `TabList.Tab:icon-only-name`). In the `transparent` appearance the selection line slides and stretches from the tab selected before to the new one over 300ms; the line is the selected tab's `::after` (recolour it with `after:border-b-…`, `after:border-s-…` when vertical), and `motion` replaces its timing, written for the `after:` variant, or turns it off with `null`.
- **Carousel groups.** `groupSize={n}` shows `n` slides per page and `"auto"` as many as fit (the slides keep their width, which must be equal; `align` places a page that does not fill the width). `value`, `onValueChange` and `defaultValue` are the index of the first slide of the page; previous, next, the picker (one button per page), looping and autoplay move by page. `labels.slides(start, end, total)` names a page.
- **Dragging.** `draggable` follows the pointer (mouse, touch, pen); a drag past a quarter of the width, or a release faster than 0.5 px/ms, changes the page, else the track snaps back. The click that ends a drag is dropped, a vertical swipe still scrolls the page, and autoplay pauses while dragging.
- **Thumbnails.** `<Carousel.Item thumbnail="/a.png">` (or an object of `<img>` attributes) turns the picker into a row of thumbnails; each button keeps its slide name.
- **Controls.** `controlsLayout` is `overlay` (the default, round buttons over the slides), `overlay-wide` (full-height edge strips), `inline` (buttons beside the slides) or `inline-wide`. `Carousel.Button` (`direction="previous"` or `"next"`) replaces the built-in button of that direction and keeps its name, `aria-controls` and disabled behaviour; its children replace the chevron. `appearance="elevated"` rounds the carousel and adds a shadow.
- **Carousel motion.** `motion` is `slide` (the default: the slides glide in from the side of the page order, mirrored in right-to-left layouts), `fade` (the slides cross-fade in place; one slide per page, else they slide, with a development warning; a drag still pages on release) or `null` (the page changes at once); the root renders it as `data-motion` (`slide`, `fade`, `none`). `motionDuration` is the time in milliseconds (300 by default; Fluent's `duration` is another unit, Embla's speed of 20 to 60). Below `WaveProvider motion="none"` a carousel moves only with its own `motion`, and under reduced motion it never moves.

### Slots

Props such as `icon`, `contentBefore` and `dismiss` are slots. A slot accepts content (rendered inside the slot's element) or an object with `as`, `className`, `children` and any attribute of the slot's element:

```tsx
import { Input } from '@mortenbrudvik/waveui';

export const Price = () => (
  <Input
    aria-label="Price"
    contentBefore="$"
    contentAfter={{ children: 'USD', className: 'text-muted-foreground' }}
  />
);
```

A slot takes any `React.ReactNode`. Spread an attributes object typed by an interface into a new object (`image={{ ...imgProps }}` for a `React.ImgHTMLAttributes<HTMLImageElement>`).

Icon slots are decorative (`aria-hidden`). Content that renders nothing (`''`, `[]`, `<></>`, or a collection of only `null`, booleans and `''`) counts as no content: a `contentAfter` that renders nothing takes no room, and SearchBox's `contentBefore` keeps the default search icon. The dismiss and clear slots of `MessageBar`, `SearchBox` and `Tag`, the `closeButton` of `Dialog.Content` and Drawer, and the `dismissButton` of `TeachingPopover.Header` render their content inside the component's own button; the 0.4 form that passed a button object is deprecated. A Wave `Button` passed there is merged into that button, and its own props never reach the DOM: its `icon` and `iconPosition` place the icon, and `disabledFocusable` makes the built-in button unavailable but focusable. Content that renders nothing keeps the default icon, and a slot object without children (`{ className: 'text-error' }`) wraps it. A slot object that renders a component or a void element (`{ as: CloseIcon }`, `{ as: 'img', src, alt: '' }`) or sets `dangerouslySetInnerHTML` is the icon itself. On `MessageBar`, `dismiss={null}` is the only value that hides the dismiss button (a boolean counts as no slot), and so is `closeButton={null}` for the Close button of a Dialog or Drawer and `dismissButton={null}` for TeachingPopover's.

The `backdrop` slot of `Dialog.Content` and Drawer takes content or a slot object with `appearance` (`'dimmed'`, `'transparent'`); `null` renders none, and booleans are no slot. Tag's `media` and `icon` (and an InteractionTag Primary's) are content slots: `media` is not hidden from assistive technology (pass `decorative` to an Avatar whose name repeats the tag's text), `icon` is decorative. So are the `media` of `Table.CellLayout` and `TeachingPopover.Body` (give a picture its `alt`), and `Table.HeaderCell`'s `aside`.

Slots that replace a built-in glyph follow one rule per kind:

- **Optional indicators** (`MenuButton.menuIcon`, the `expandIcon` of Combobox, Dropdown, TimePicker, TagPicker (and `TagPicker.Control`) and `Tree.Item`, `EmptySwatch.icon`, the `sortIcon` of `DataGrid.HeaderCell` and `Table.HeaderCell`, Breadcrumb's `divider`, `List.Item checkmark`): `null` or `undefined` keep the default glyph; `false` or any value that renders nothing hides it (for Combobox, TimePicker and TagPicker, the whole expand button; for Dropdown, the chevron and its room). A sort glyph shows only while its column is sorted, and a list check mark only on a selected item of a selectable List (`List.Item checkmark` content shows also without the List's `checkmark`).
- **Required indicators** (`SplitButton.menuIcon`, `Option.checkIcon`, `Hamburger.icon`): the indicator always shows. A value that renders nothing keeps the default glyph, with a development warning. The check is the sign of an option's selection that does not rely on color, so Fluent's `checkIcon={null}`, which removes it, keeps it here.
- **Status icons** (`MessageBar.icon`, `Toast.icon`, Field `validationMessageIcon`): only `undefined` keeps the default icon; `null` or a value that renders nothing shows none.
- A glyph slot inside a built-in button (`expandIcon`, the `menuIcon` of SplitButton and MenuButton, the `icon` of `ColorSwatch`, `EmptySwatch` and `Hamburger`, a header cell's `sortIcon`, and the children of `InteractionTag.Secondary`, which is itself the button) is decorative content. A `<button>` or `Button` passed there, or a slot object whose `as` is one, is not nested: its children become the glyph and its props are dropped, with a development warning.

### Built-in text

The names and hidden texts that components render themselves are English by default. These props translate them:

| Component                   | Props                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog.Content`, `Drawer`  | `closeLabel` (the Close button; on Drawer also the Close button of each `Drawer.HeaderTitle`; a text label of a button merged into `closeButton` names it instead)                                                                                                                                                                                                                                                                                                                                                                                                  |
| `TeachingPopover`           | `closeLabel` (the Close button), `labels` (`back`, `next`, `done`, `step(index, count)` with a zero-based index, and for `TeachingPopover.CarouselNav` `nav` ("Choose step") and `navButton(index, count)` ("Step 2 of 3", zero-based index)); `TeachingPopover.CarouselPageCount` words its "2 of 3" with its render function child `(current, total)` (one-based) |
| `Breadcrumb`                | `overflowLabel` (the "…" button of a collapsed trail, "More items")                                                                                                                                                                                                                                                                                                                                                              |
| `MessageBar`, `Toast`       | `statusLabel` (the hidden severity text; also an option of both `dispatchToast` forms); `Toast` also `dismissLabel` (also an option of the text form)                                                                                                                                                                                                                                                                            |
| `Tag`                       | `dismissLabel` ("Dismiss", with the tag's text)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `InteractionTag.Secondary`  | `dismissLabel` ("Dismiss", with the primary text: "Dismiss Cherry") |
| `Carousel`                  | `labels` (`previous`, `next`, `picker`, `slide(index, total)` with a zero-based index, `slides(start, end, total)` with one-based numbers for a page of several slides, `carouselRoleDescription`, `slideRoleDescription`), `autoPlayLabels`                                                                                                                                                                                                                                                                      |
| `Stepper`                   | `statusLabels` (`completed`, `error`; `''` omits the text)                                                                                                                                                                                                                                                                                                                                                                       |
| `Pagination`                | `getItemAriaLabel(type, page, selected)`                                                                                                                                                                                                                                                                                                                                                                                         |
| `ColorPicker`               | `labels` (the 0.7 strings, plus `area` (the name of a bound area's group, "Saturation and brightness"), `saturation`, `brightness`, `roleDescription`, `hue`, `transparency`, `colorName(color)` and `valueText(color, channel)` for bound parts)                                                                                                                                                                                |
| `ColorArea`                 | `labels` (`saturation`, `brightness`, `roleDescription` ("2D slider"), `colorName(color)`, `valueText(color, channel)`)                                                                                                                                                                                                                                                                                                          |
| `ColorSlider`               | `labels` (`hue`, `saturation`, `brightness` (the `value` channel), `colorName(color)`, `valueText(color, channel)`)                                                                                                                                                                                                                                                                                                              |
| `AlphaSlider`               | `labels` (`opacity`, `transparency`, `valueText(color, transparency)`)                                                                                                                                                                                                                                                                                                                                                           |
| `Combobox`                  | `labels` (`noMatches`, `clear` (the clear button), `expand` (the chevron button), and with `multiselect` `selection(labels)` (the selected labels the input shows, joined with `", "`), `added(label, count)` and `removed(label, count)` (the toggle announcements, "Olives added, 2 selected", "Olives removed, 1 selected"))                                                                                                  |
| `Dropdown`                  | `labels` (`clear` (the clear button), and with `multiselect` `selection(labels)` (the button's text), `added(label, count)` and `removed(label, count)`, as in Combobox)                                                                                                                                                                                                                                                         |
| `Listbox`                   | `labels` (`added(label, count)` and `removed(label, count)`, the `multiselect` toggle announcements, as in Combobox)                                                                                                                                                                                                                                                                                                             |
| `DatePicker`                | `labels` (`clear`, `openCalendar`, `close` (the Close button, `showCloseButton`), the calendar's labels below (not `required`), and the error texts `invalidDate(pattern)`, `outOfRange(min, max)`, `unavailableDate`)                                                                                                                                                                                                           |
| `Calendar`                  | `labels` (the header buttons `previousMonth`, `nextMonth`, `previousYear`, `nextYear`, `previousDecade`, `nextDecade`; the heading button's hints `chooseMonth` ("Choose a month") and `chooseYear` ("Choose a year"); `goToToday`; the week-number column `week` ("Week") and `weekNumber(week)` ("Week 23"); `markedDay(dayLabel)` ("Monday, June 2, 2025, marked"); `required` ("Required", the hint of a required calendar)) |
| `SwatchPicker`              | `labels` (`required`: "Required", said in the description where the picker's role cannot carry `aria-required`, the grid layout and tab mode)                                                                                                                                                                                                                                                                                    |
| `EmptySwatch`               | `aria-label` ("Add color")                                                                                                                                                                                                                                                                                                                                                                                                       |
| `TimePicker`                | `labels` (`clear`, `expand`, `list`, `noTimes`, `noMatches`, and the error texts `invalidTime(format)`, `outOfRange(min, max)`)                                                                                                                                                                                                                                                                                                  |
| `TagPicker`                 | `labels` (`remove(label)`, `selected`, `summary(labels)`, `added(label, count)`, `removed(label, count)`, `noMatches`, `create(text)` (`Create "{text}"`), `clear` ("Clear selection"), `expand` ("Show options"), `overflowCount(count)` ("+{count}"))                                                                                                                                                                                                                                                                                                           |
| `Rating`                    | `labels` (`star(value, max)`; it also names the half values of a `step={0.5}` Rating, "2.5 stars")                                                                                                                                                                                                                                                                                                                               |
| `RatingDisplay`             | `labels` (`rating(value, max, formattedValue)`, `count(count, formattedCount)`); `locale` formats the value and the count (pass it when rendering on the server)                                                                                                                                                                                                                                                                 |
| `SpinButton`                | `labels` (`increment`, `decrement`)                                                                                                                                                                                                                                                                                                                                                                                              |
| `DataGrid`                  | `labels` (`selectAll`, `selectionHeader`, and with `resizableColumns` `resizeColumn` ("Resize column", the handles' name) and `columnWidth(width)` ("150 pixels", their value text)); each row's fallback name "Select row": `DataGrid.Row` `selectionLabel`                                                                                                                                                                                                                                                                                                                |
| `Table.ResizeHandle`        | `label` ("Resize column"), `valueText(width)` ("150 pixels")                                                                                                                                                                                                                                                                                                                                                                      |
| `AvatarGroup`               | `overflowLabel`, `unnamedMemberLabel`                                                                                                                                                                                                                                                                                                                                                                                            |
| `InfoButton`                | `aria-label` (the button and its note; default "Information")                                                                                                                                                                                                                                                                                                                                                                    |
| `Hamburger`                 | `aria-label` ("Navigation", only while it has no other name) |
| `NavDrawer`                 | `aria-label` ("Navigation", the landmark and an overlay's dialog) |
| `InfoLabel`, `SplitButton`  | `infoButtonLabel` (InfoLabel's button is named "‹label› ‹infoButtonLabel›"), `menuButtonLabel`                                                                                                                                                                                                                                                                                                                                   |
| `Spinner`, `Skeleton.Group` | `label`                                                                                                                                                                                                                                                                                                                                                                                                                          |

Without a text prop, these defaults are replaced through `aria-label`: the PresenceBadge status names ("Available", …: `aria-label` on the badge), the MessageBar "Dismiss" and SearchBox "Clear search" button names (`dismiss={{ 'aria-label': 'Lukk' }}`, which keeps the default icon), and the names of the Breadcrumb, Pagination, Nav, Stepper, Carousel and Toaster regions ("Breadcrumb", "Pagination", "Navigation", "Progress", "Carousel", "Notifications"). The placeholders of Dropdown, DatePicker, TimePicker and SearchBox are `placeholder` props, and ColorPicker's default presets are replaced through `presets`.

0.7 and 0.8 add no other built-in text: the submenu half of a `Menu.SplitGroup`, a context menu (`Menu.Popover`) and a `Toolbar.RadioGroup` are named by the `aria-label` you pass, a toast's container by its severity and title, and a tree row's actions toolbar by its item's label. Nor do 0.10 and 0.11, beyond the rows above: a `TagGroup` is named by the `aria-label` you pass, an inline Drawer by its title; a `Listbox`, a `Calendar` and a `ColorSwatch` or `ImageSwatch` are named by the `aria-label` you pass (or a `Field`'s label, or a `Tooltip` around the swatch), an `OptionGroup` by its label, and the month and year buttons by their text in `locale`. 0.14 adds none either beyond the rows above: a `Table.SelectionCell` control is named by the `aria-label` or `aria-labelledby` you pass (a development warning asks for one), and a `CarouselFooter`'s `initialStepText` and `finalStepText` are your text. 0.16 adds none beyond the resize handles' rows above: a `FlatTree` is named by the `aria-label` or `aria-labelledby` you pass (a development warning asks for one).

## Large data

DataGrid, List, Listbox, Combobox, Dropdown and FlatTree can render only the items in view of a long list, plus an overscan, with spacers (`aria-hidden`, `data-virtual-spacer`) as tall as the items they stand for. Create a window with `useVirtualWindow({ itemSize })` and pass it as `virtualWindow`; the component calls its `layout`, attaches its scroller and keeps the focused item rendered. Selection, select-all, sorting, the keyboard and the positions a screen reader announces follow the data, not the rendered items. No virtualization library is needed (an adapter of one can implement the same `VirtualWindow` interface: the guide's "Data at Scale" chapter has one for `@tanstack/react-virtual`).

```tsx
import {
  Combobox,
  DataGrid,
  Field,
  List,
  createTableColumn,
  useVirtualWindow,
  type ListboxItem,
} from '@mortenbrudvik/waveui';

interface Member {
  id: string;
  name: string;
}

// Outside the component: a new array would be computed again over every item at every row the
// window scrolls past.
const columns = [
  createTableColumn<Member>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name),
    renderCell: (member) => member.name,
  }),
];
const memberId = (member: Member) => member.id;

export function Members({ members }: { members: Member[] }) {
  // 44-pixel rows under a header of 45 pixels (with the select-all checkbox), which sticks over them.
  const virtualWindow = useVirtualWindow({ itemSize: 44, scrollPaddingStart: 45 });
  return (
    <DataGrid
      aria-label="Members"
      items={members}
      columns={columns}
      getRowId={memberId}
      selectionMode="multiple"
      virtualWindow={virtualWindow}
      containerProps={{ style: { height: 480 } }}
    />
  );
}

export function Files({ files }: { files: readonly string[] }) {
  const virtualWindow = useVirtualWindow({ itemSize: 40 });
  return (
    <List
      aria-label="Files"
      selectable
      selectionMode="multiple"
      virtualWindow={virtualWindow}
      count={files.length}
      style={{ height: 320 }}
    >
      {(index) => <List.Item value={files[index]}>{files[index]}</List.Item>}
    </List>
  );
}

export function PersonPicker({ people }: { people: readonly ListboxItem[] }) {
  const virtualWindow = useVirtualWindow({ itemSize: 32 });
  return (
    <Field label="Person">
      <Combobox items={people} virtualWindow={virtualWindow} />
    </Field>
  );
}
```

- **A fixed item height.** Every item is exactly the window's `itemSize` tall: the component sets that height on each row, item or option, after its own `style`, so the content must fit. A windowed DataGrid's body cells drop their block padding and keep their text on one line (truncated, as the columns are laid out from widths); a List item with one line of text fits in 40 pixels and the default `Option` in 32 (the stories use 44-pixel DataGrid rows and 28-pixel FlatTree items). Variable heights are not supported.
- **A bounded height.** The scroller needs a height or a maximum height: the DataGrid's scroll wrapper (`containerProps`), the List, Listbox or FlatTree element. Without one the window measures the whole list and renders every item (DataGrid warns in development). The popup list of a Combobox or Dropdown scrolls within its own maximum height.
- **Data, not elements.** The DataGrid needs `items` and `columns` (rows rendered from them, or by a `DataGrid.Body` render function), the pickers their data mode (`items`, `renderOption`), and the List `count` with a function child `(index) => <List.Item …/>`, called for the rendered indexes only; FlatTree renders its model. Keep `items`, `columns`, `getRowId`, `isSelectionDisabled` and `renderOption` stable (outside the component, or memoised): the component that calls `useVirtualWindow` renders again at every row boundary, and a new array or function is computed again over every item.
- **The keyboard** moves by the data: a target that is not rendered is scrolled into the window and focused (or, in a picker, made active) in the commit that renders it, and the focused item stays rendered when it is scrolled away. The DataGrid carries `aria-rowcount` and `aria-rowindex`, List items and options `aria-setsize` and `aria-posinset` (a windowed List that is a grid, `aria-rowcount` and `aria-rowindex`), and FlatTree items `aria-level`, `aria-setsize` and `aria-posinset`.
- **The scroller** turns the browser's scroll anchoring off, and is no Tab stop of its own while one of its items is the Tab stop; a plain windowed List (`navigationMode` `none`) keeps the browser's default, under which WebKit's keyboard cannot reach it: pass `tabIndex={0}` or `navigationMode="items"`.
- **Overscan.** By default the window renders enough items for 240 pixels beyond each edge, and at least 6 (`overscan` sets a number of items). A scroll faster than the overscan in one frame (a fling of the scroll bar) shows the spacers until the next frame renders the new items; raise `overscan` if that matters.
- **On the server** the window lays out the top of the list in `initialViewportSize` (480 pixels), so the server HTML holds the first window.
- **Your own scroller.** `useVirtualWindow` works for markup of your own too: render `layout(count)`, items for the item entries and empty blocks of `size` pixels for the spacers, and attach `scrollRef` by merging it (`useMergedRefs`) or after destructuring it (`const { scrollRef } = virtualWindow`): `ref={virtualWindow.scrollRef}` fails the React Compiler's lint. `scrollToIndex(index, { align })` scrolls an item into view and moves the window in the same update.
- **Limits.** Typeahead in a windowed List matches the rendered items only (in the pickers and FlatTree it searches the data); option groups cannot be windowed (`OptionGroup` children beside a `virtualWindow` are a development warning); TagPicker, TimePicker and the static `Table` have no `virtualWindow` (the table hooks keep a static table's state over every item); `<tfoot>` rows are not supported in a windowed DataGrid (they get no position, and the arrow keys skip them). The guide lists the rest.

## Keyboard support

As implemented through 0.16. Buttons, links, checkboxes, switches and the trigger buttons of Accordion, Carousel, Nav, Breadcrumb and Pagination are native elements: Tab to reach them, Enter or Space to activate. A Link or `Button as="a"` without `href`, and a Button or Link rendered as a `div` or `span`, are buttons: Tab reaches them, Enter (key down) and Space (key up) activate them. A `disabledFocusable` control stays in the Tab order but Enter, Space and clicks do nothing. The sort buttons of a sortable `Table.HeaderCell` and the step buttons of `TeachingPopover.CarouselNav` are native buttons too.

| Component                             | Keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar                               | One Tab stop (the last focused control; focusing a nested composite, such as a radio group or tab list, or a text field, select, slider or spin button keeps it where it was). Left/Right (Up/Down when vertical) move and wrap, Home/End jump; mirrored in RTL; natively disabled controls and controls hidden with CSS are skipped, while `disabledFocusable` controls stay reachable (a Tooltip on them opens on focus). Text fields, selects, sliders, spin buttons and editable comboboxes keep their own arrow keys; a Dropdown keeps Up/Down, Home and End for its list, but Left/Right move past it. A nested composite keeps its own Tab stop and arrow keys; a `Toolbar.RadioGroup` is none: its radios are part of the arrow order, and Up/Down (Left/Right when vertical, mirrored in RTL) also move among them, wrapping inside the group. The arrows never press a toggle or check a radio: Space and Enter do.                                                                                                                                                                                                                                                                                                                                                                 |
| TagGroup                              | Toolbar (the default): one Tab stop, the last focused control. Left/Right move between the controls (Up/Down with `orientation="vertical"`), mirrored in RTL, wrapping in DOM order across wrapped rows; Home/End jump; natively disabled controls are skipped. Delete or Backspace on a Dismiss button, on either button of an InteractionTag with a Secondary, or on a link in a dismissible tag's text dismisses the tag (a held key dismisses one tag). When the focused tag is removed, focus moves to the same control of the next tag, else the previous one, else `fallbackFocusRef`. In a selecting group Space or Enter on an `InteractionTag.Primary` toggles it. `role="list"`: every control is a Tab stop, and the group handles no arrow key. |
| InteractionTag                        | Two Tab stops, the Primary and the Secondary; in a TagGroup both join its arrow order. Enter or Space activates the Primary; Delete or Backspace on either button dismisses the tag (with a Secondary), as Enter, Space and a click on the Secondary do. |
| Tag                                   | The Dismiss button: Enter, Space, Delete and Backspace dismiss (a held key dismisses once), also outside a TagGroup. Delete or Backspace on a link in a dismissible tag's text (`<Tag dismissible><a href>…</a></Tag>`) clicks its Dismiss button. |
| RadioGroup, SwatchPicker (row layout) | One Tab stop. All four arrows move and select (wrapping), Home/End jump; Left/Right mirrored in RTL. Keys pressed on a link inside a radio's label stay the link's. An `EmptySwatch` in the row layout is a Tab stop of its own, and the arrow keys pressed on it do nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| SwatchPicker (`layout="grid"`)        | One Tab stop: the last focused swatch, at first the selected one, else the first. The arrows move focus only: Left/Right through the swatches in reading order across the rows (mirrored in RTL), stopping at the grid's first and last swatch; Up/Down to the enabled swatch of the previous/next row nearest the same column, stopping at the first and last row; Home/End to the first/last swatch of the row, Ctrl+Home/Ctrl+End of the grid. Space, Enter and a click select. Disabled swatches are skipped; an `EmptySwatch` is a cell like the others.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| SwatchPicker (`focusMode="tab"`)      | Every enabled swatch is a Tab stop, and the arrow keys do nothing; Space, Enter and a click select (the selected swatch stays selected).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Listbox                               | One Tab stop: the list. The active option shows only while the list has focus (the selected option, else the first). Down/Up move without wrapping, Home/End, PageUp/PageDown by 10, typing moves to the matching option (a Space within 500 ms of a letter continues the search); Space and Enter select, or with `multiselect` toggle. Tab, Escape and Alt with an arrow are left to the page (an enclosing Dialog closes on Escape). With `disabledOptionsFocusable` the keys reach disabled options, but Space and Enter do nothing on them. Windowed (`virtualWindow`): the same keys over every option, rendered or not; the active option is scrolled into view with the window. |
| Rating                                | Right/Up one step more (a star, or half a star with `step={0.5}`), Left/Down one fewer (never below `step`), Home/End `step`/`max`; mirrored in RTL. A pointer click on a half-star Rating chooses the half or the whole star by position; Space and Enter on a focused radio choose that radio's own value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| TabList                               | One Tab stop (the selected tab). Left/Right (Up/Down when vertical) move and select, Home/End; with `selectTabOnFocus={false}` they only move focus, and Enter or Space selects the focused tab; disabled tabs skipped; mirrored in RTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tree                                  | One Tab stop. Up/Down, Home/End; Right expands or moves to the first child, Left collapses or moves to the parent (mirrored in RTL); Enter activates; Space activates, or in a checkbox tree (`selectionMode="multiple"`) toggles the focused item's check; `*` expands siblings; type to jump (a Space within 500 ms of a letter continues the search). Row actions: Tab from the focused item enters them and Shift+Tab returns (`navigationMode="tree"`); with `navigationMode="treegrid"` the "next" arrow moves into them (on an expanded parent too, instead of to its first child), "previous" returns, and Up/Down move between items. |
| FlatTree                              | One Tab stop: the focused item while focus is inside, else the `selected` item while it is visible, else the first enabled item. Up/Down between the visible items, Home/End; Right expands a collapsed branch or moves to its first child, Left collapses an expanded branch or moves to its parent (mirrored in RTL); Enter activates (and toggles a branch); Space activates, or in a checkbox tree toggles the check; `*` expands the sibling branches; typing moves to the next visible item whose label starts with the text. Disabled items are skipped. Windowed, an item that is not rendered is scrolled into view before it takes focus. |
| List (selectable, or `navigationMode="items"`) | One Tab stop (selectable: the first selected item, else the first; without selection: the item that last had focus). Up/Down (wrapping), Home/End, typeahead above 7 items (a Space within 500 ms of a letter continues the search). Enter toggles a selectable item and runs `onAction`; Space toggles a selectable item, or runs `onAction` on an item that cannot be selected. With item actions in a selectable list, or `navigationMode="composite"` (grid): Up/Down between rows, Left/Right into the actions (mirrored in RTL), Enter/F2 into a text field, Escape back. A plain List (`navigationMode` `none`) has no arrow keys: its items' controls are Tab stops. Windowed (`virtualWindow` with `count`): the keys move by index over the whole list, Up/Down wrapping, Home/End, PageUp/PageDown by ten (stopping at the ends); typeahead searches the rendered items only; the focused item is the Tab stop while focus is in the list. |
| DataGrid                              | One Tab stop. Arrows between cells (Left/Right to the previous/next cell of the row, mirrored in RTL; Up/Down and PageUp/PageDown keep the visual column across `colSpan`/`rowSpan` cells of grouped headers), Home/End row start/end, Ctrl+Home/Ctrl+End grid start/end, PageUp/PageDown 10 rows; Enter/F2 into a cell's widgets, Escape back; Space on a cell toggles its row's selection. A column header with a resize handle (`resizableColumns`): F2 on the header cell or its sort button moves focus to the handle (Enter on a sortable header still sorts); there Left/Right move the column's edge by 20 pixels (5 with Shift; mirrored in RTL), Home sets the minimum width, and Enter, Space or Escape return to the header; Tab moves between the header's sort button and handle. Windowed (`virtualWindow`): Up/Down, PageUp/PageDown and Ctrl+Home/Ctrl+End move over every row of the data; a row that is not rendered is scrolled in, then focused. |
| Table.ResizeHandle                    | A Tab stop in a static table. Left/Right move the column's edge by 20 pixels (5 with Shift; mirrored in RTL), Home and End set the minimum and the maximum (`maxWidth`); with `onLeave`, Escape and the release of Enter or Space call it (to move focus back to the header; a held Enter or Space stays on the handle until it is released). |
| Menu                                  | Trigger: Enter/Space/Down open and focus the first item, Up opens on the last; a trigger with `aria-disabled="true"` (a `disabledFocusable` MenuButton or SplitButton) ignores them and its click. Menu: Up/Down (wrapping), Home/End, typeahead, Enter/Space activate (a Space within 500 ms of a letter continues the search); on a checkbox, radio or switch item Space changes it and keeps the menu open, Enter changes it and closes a popup menu; on `Menu.ItemLink` Enter is the browser's link activation. A submenu's item: Right (Left in RTL), Enter and Space open the submenu and focus its first item; in a submenu Left (Right in RTL) and Escape close only it and return focus to its item. `Menu.SplitGroup`: Right (Left in RTL) moves from the action to the submenu button, Left back. Escape closes and returns focus, Tab closes every level. Context menu (`openOnContext`): Shift+F10 or the ContextMenu key on the region opens it at the focused element; Escape and item activation return focus there, and Tab moves on from it.                                                                                                                                                                                                                                |
| Combobox, TagPicker, TimePicker       | Down/Up open and move, Alt+Down opens, typing makes the first match active (not in a `freeform` Combobox), Enter commits the active option (with no active option, Enter submits the form; TimePicker instead never submits while its text is edited: a complete time within the bounds is committed, erased text clears the value, other text is kept and flagged invalid, and the list closes; leaving the input with edited text settles it the same way and closes the list), Alt+Up and Tab close, Escape closes and then discards typed text. The chevron button (Combobox, TimePicker) is not a Tab stop; the clear button (`clearable`) is a Tab stop after the input. Tab from erased TimePicker text clears the value first, so focus moves past the clear button that goes with it. TagPicker: Backspace in the empty input, and the previous arrow (Left, Right in RTL) with the caret at the start of the text and nothing selected, focus the last tag; on a tag's remove button Left/Right move between the tags (mirrored in RTL) and past the last one return to the trigger, and Delete, Backspace, Enter or Space remove it and focus the next tag's remove button, else the input (a click focuses the input). Typing makes the option whose label equals the text active, else the first match; with `allowCreate` Enter on the create option adds the text. `TagPicker.Button`: Down, Up and a typed letter open and move, Enter and Space add the active option. The chevron is not a Tab stop; the clear button is, after the trigger. Multi-select (`multiselect`, Combobox): Enter toggles the active option and keeps the list open; Tab, Escape and Alt+Up close without committing; focusing the input selects the shown labels, so typing replaces them with a query, and Backspace and Delete only edit the text. With `disabledOptionsFocusable` (Combobox) the arrow keys reach disabled options, but Enter does nothing on them. |
| Dropdown                              | Down/Up/Home/End and typing open and move, PageUp/PageDown move by 10, Enter/Space commit (a Space within 500 ms of a letter continues the search), Alt+Up and Tab commit and close, Escape closes. The clear button (`clearable`) is a Tab stop after the combobox button. Multi-select (`multiselect`): Enter and Space toggle the active option and keep the list open; Tab, Escape and Alt+Up close without committing. With `disabledOptionsFocusable` the keys reach disabled options, but Enter and Space do nothing on them, and Tab or Alt+Up on one closes the list without selecting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| SpinButton                            | Up/Down step, PageUp/PageDown large step, Home/End jump to a finite min/max (otherwise they move the caret; with Shift they select text); Enter commits typed text, Escape reverts it. With the pointer, holding a step button repeats the step; a short press steps once on release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| SearchBox                             | Escape clears the text and keeps focus (the key is consumed, so an enclosing Dialog, Drawer or Popover stays open); in an empty field Escape reaches the enclosing overlay.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| DatePicker                            | Alt+Down opens the calendar. The clear button (`clearable`) is a Tab stop between the input and the calendar button; Tab from erased text clears the value first and moves on to the calendar button. Calendar dialog: the keys of Calendar below; Escape in the month or year view goes back a view, and in the day view closes the calendar and returns focus. Tab stays inside: the previous button, the heading button (`showMonthPicker`), the next button, the grid, then the footer buttons (`showGoToToday`, `showCloseButton`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Calendar                              | One Tab stop in the grid, after the header buttons: the focused day (the selected day of the shown month, else today, else the first day of the month in range). Day view: arrows by day/week (mirrored in RTL), PageUp/PageDown by month, Shift+PageUp/PageDown by year (the day clamped to the month), Home/End week start/end, Enter/Space select. Month view: arrows by a month and a row of four (mirrored in RTL; past December or January they show the next or previous year), Home/End to the row's ends, PageUp/PageDown by a year, Enter/Space show the month's days. Year view: the arrows, Home and End stay on the shown page of 12 years while the target year is on it (the muted years before and after the decade included), PageUp/PageDown move a decade, Enter/Space show the year's months. Escape in the month or year view goes back a view (it is consumed, also from the header and footer buttons); in the day view it is left to the page.                                                                                                                                                                                                                                                                                                                        |
| Dialog, Drawer (modal, alert)         | Focus is trapped (in a drawer: header, then body, then footer); Escape closes; the trigger toggles; focus returns to the first of these that can take focus: `finalFocusRef`, the element that had focus when the modal opened (a trigger's wrapper span resolves to the element inside it), the trigger, an element next to where that opener was.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Dialog, Drawer (non-modal)            | Focus moves in on open. Tab and Shift+Tab leave the surface in the page's order right after the element that opened it; Escape closes it only while focus is inside; the trigger toggles; focus returns to the opener (or `finalFocusRef`) only when it was inside. |
| Drawer (inline)                       | Page content: no trap, opening moves no focus, Escape and presses outside never close it; the trigger toggles; closing it while focus is inside returns focus to `finalFocusRef`, else the element that opened it, else the trigger. |
| Nav                                   | Every item, category and app item is a Tab stop (Enter or Space activates; a category toggles); an item's `actions` follow it in the Tab order. |
| Breadcrumb (`focusMode="arrow"`)      | One Tab stop: the last focused link or button, at first the first one. Left/Right move (mirrored in RTL, wrapping), Home/End jump; the "…" button is in the order, hidden items are not. With the default `focusMode="tab"` every link and button is a Tab stop. |
| NavDrawer                             | An overlay as a Drawer (modal or non-modal); an inline one as page content. A Hamburger inside it toggles it, and focus goes to `finalFocusRef` (your page's Hamburger) when it closes with focus inside. |
| NavDrawer.Body (`focusMode="arrow"`)  | One Tab stop: the last focused element, at first the current page (or the closed category that holds it), else the first item. Down/Right move to the next element and Up/Left to the previous one (Left and Right swap in RTL), wrapping; Home/End jump; item actions join the order. The footer's items stay Tab stops. |
| Popover, TeachingPopover              | Escape closes. When focus was inside (or lost to `<body>`), Popover returns it to its trigger, TeachingPopover to where focus was before it opened (with a `TeachingPopover.Trigger`, to the Trigger, wherever focus was before); a close by hover moves no focus. In the Tab order the content follows its trigger (TeachingPopover with `target`: the target): Tab from the trigger enters it, Tab past its end continues after the trigger, Shift+Tab from the element after the trigger enters it at its last element. For a trigger outside the tab order it follows the tab stop before the trigger; with no tab stop before the trigger or target, it is reached at the end of the page. A Tab lap visits it once: Tab from the last element of the page leaves the page, and Shift+Tab from outside the page reaches the page's last element. Focus leaving it does not close it. A context popover (`openOnContext`): Shift+F10 or the ContextMenu key on the region opens it and moves focus into the content, and Escape returns focus to the element that had it; opened by a right click, it is reached by Tab from that element.                                                                                                                                                                                                                              |
| Tooltip, InfoButton, InfoLabel        | Open on keyboard focus (Tooltip after `openDelay`); Escape closes. InfoButton and InfoLabel: a click pins the note; focus stays on the button when the note opens, Tab from the button enters the note's first focusable element (a link) and Tab past its last element continues after the button; Shift+Tab returns; Escape closes it and returns focus to the button when it was in the note. `openOnHover={false}` opens it on a click (Enter, Space) only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Card (selectable)                     | With the default `selectionControl="card"`: Enter (key down) or Space (key up) selects. With `"checkbox"`: the built-in checkbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Stepper                               | Each reachable step is a Tab stop; Enter/Space activate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Slider                                | Native range keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Toaster                               | The app's `shortcuts.focus` key press focuses the newest toast; Tab and Shift+Tab move through the toasts' controls; Escape dismisses every toast and returns focus (a tooltip or menu of a toast closes first); Delete or Backspace dismisses the focused toast (the keys are ignored in editable fields), and focus moves to the next toast, or the previous one, else back to where it was before the toasts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ColorArea                             | One Tab stop. Left/Right change saturation (mirrored in RTL), Up/Down brightness; Shift with an arrow by 10; PageUp/PageDown brightness by 10; Home/End saturation to 0/100.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ColorSlider, AlphaSlider              | The arrows of their axis by 1 (mirrored in RTL when horizontal), Shift with an arrow by 10, PageUp/PageDown by 10, Home/End to the minimum/maximum.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Accordion and Carousel have no arrow-key navigation between their controls: their triggers and controls are Tab stops. With `groupSize` above 1 the slides of the shown page are one arrow-key group (the slide that last had focus is its Tab stop; an arrow past the end of the page shows the next one).

Typeahead (Menu, a selectable or navigable List, Tree, Dropdown, Listbox) accepts characters typed with AltGr, which Windows reports as Ctrl+Alt (Polish `ł`, Romanian `ș`); Ctrl+Alt with an arrow, Home, End or Space is left to the browser. An item that cannot take focus is passed over for the next match. Menu typeahead matches the item labels, not icons or shortcuts. Options and option groups with `hidden` are skipped like a native `<option hidden>`.

## Hooks and utilities

| Export                                                                                                                                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useControllable(value, defaultValue, onChange)`                                                                                             | Controlled/uncontrolled state; returns `[value, setValue, isControlled]`; `setValue` accepts a value or an updater and skips no-op updates.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `useRovingTabIndex(options)`                                                                                                                 | Roving tab stop and arrow-key navigation for composite widgets (`orientation: 'grid'` with `columns` for two-dimensional grids); items marked `data-disabled-focusable` stay reachable, a composite marked `data-roving-transparent` (a toolbar radio group) adds its items to the enclosing arrow order, and `tabStop: 'none'` leaves every item out of the Tab order (a composite reached by arrow keys only).                                                                                                                                                                                                                        |
| `usePopupPosition(options)`                                                                                                                  | Place a surface against an anchor (an element or a `VirtualElement`): `side`, `align`, `offset`, `flip`, `fallbackPlacements`, `shift`, `fitViewport`, `matchReferenceWidth`, `strategy`, `hideWhenDetached`, `onPositioned`; returns `floatingProps`, `update()` and the final placement.                                                                                                                                                                                                                                                                             |
| `useDismiss(options)`, `DismissLayerProvider`                                                                                                | Register a dismiss layer (Escape, outside press, focus leaving it) in WaveUI's layer stack; `Portal layerId` and `DismissLayerProvider` make layers opened inside its children.                                                                                                                                                                                                                                                                                                                                                                                        |
| `useModalLayer(options)`, `useFocusTrap`, `useInitialFocus`, `useRestoreFocus`                                                               | A modal surface's dismissal, focus trap, `inert` isolation, scroll lock and focus restore (`modalType`: `modal`, `alert`, `non-modal`); the pieces are public too.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `useModalOpen()`, `hasOpenModal()`, `modalAllowProps`                                                                                        | Whether a modal is open; props that keep an app-owned region usable over a modal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `useFocusableGroup(options)`                                                                                                                 | One tab stop that holds several focusable elements (`tabBehavior`: `unlimited`, `limited`, `limited-trap-focus`); Enter or F2 enters, Escape leaves.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `useFocusVisible()`                                                                                                                          | `true` while the last input was the keyboard; `false` on the server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `useGridNavigation(options)`                                                                                                                 | Keyboard navigation of a static `<table role=\"grid\">` (the Table's own); `model` (`GridNavigationModel`: `rowCount`, `headerRowCount`, `scrollToRow(index)`) moves the vertical keys by the data of a grid whose rows are rendered in part (`data-row-index` on each rendered row), and returns `activeRowIndex` and `pendingRowIndex`, the rows to keep rendered. A widget with `data-grid-auxiliary` (a resize handle) is never a cell's target; F2 enters it. |
| `getTabbableElements(container)`, `getFirstTabbable`, `getLastTabbable`                                                                      | The tabbable elements of a container in Tab order (hidden, disabled and `inert` ones left out).                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `focusRing`, `focusRingInset`, `inputFocus`, `inputFocusWithin`                                                                              | The focus class strings of the library, to compose with `cn()` on your own controls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `useId(prefix?)`                                                                                                                             | SSR-safe ids (`prefix-<react id>`; never parse the React part).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `useEventCallback(fn)`                                                                                                                       | Stable callback that always calls the latest `fn`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `useMergedRefs(...refs)`                                                                                                                     | One stable callback ref for several refs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `useIsClient()`                                                                                                                              | `false` on the server and during hydration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `usePresence(visible, options?)`, `<Presence visible>`                                                                                       | Mount and unmount an element with CSS enter and exit motion (`data-presence` phases; see [Enter and exit motion](#enter-and-exit-motion)).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `useFieldControl(props, options?)`                                                                                                           | Merge a custom control's labelling props with the surrounding `Field` (its label, validation message, hint and state).                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `useAnnounce()`, `announce(message, politeness?)`                                                                                            | Screen-reader announcements through a shared live region.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `useActiveDescendant(options)`                                                                                                               | The `aria-activedescendant` model under the pickers, for composites that keep focus on one element: `items`, `getId`, `getElement` (the item's element for scrolling; by default the element with its id), `enabled`, `fallback`, `loop`, `activateFirstOnChange`, `onActiveValueChange`; returns `activeValue`, `activeDescendantId` and stable `setActiveValue`, `highlight` (pointer moves, not scrolled into view), `first`, `last`, `next`, `prev` and `move`. State-based: it reads no DOM during render, so an active fallback item's id is in the server HTML. `onScrollToItem(index)` is called first for every move that scrolls, for a windowed list that renders part of its items. |
| `useListbox(options)`, `useListboxOption(props)`                                                                                             | The listbox under Dropdown, Combobox, TagPicker and Listbox: keys, typeahead, filtering, the active option and option registration, in `'select-only'`, `'editable'` or `'standalone'` mode, with `multiselect` and `disabledOptionsFocusable`; `onOpenChange(open, details)` and `onSelect(value, details)` (see [Listbox and custom pickers](#listbox-and-custom-pickers)). `useListboxOption` builds an option component of your own. In data mode (`items`) `onScrollToItem(index)` receives every active option that scrolls into view, by its index among the shown options. |
| `useVirtualWindow(options)` | A window over a long list of fixed-height items (`itemSize`, `overscan`, `initialViewportSize`, `scrollPaddingStart`), for the `virtualWindow` prop of DataGrid, List, Listbox, Combobox, Dropdown and FlatTree: `VirtualWindow` (`itemSize`, `scrollRef`, `layout(count, { keep })`, `scrollToIndex(index, { align })`) and its `VirtualEntry` list (see [Large data](#large-data)). |
| `useSelection(options)` | Selection by id held outside the DOM (`selectionMode`, `selectedItems`, `defaultSelectedItems`, `onSelectedItemsChange`): `isSelected`, `toggle`, `select`, `deselect`, `toggleAll(universe)` (keeps the ids outside the universe), `clear`. |
| `useTableFeatures(options, plugins)`, `useTableSort`, `useTableSelection`, `useTableColumnSizing` | Headless state of a table built from the `Table` parts: the rows of `items` (`getRows()`), and the sort, selection and column widths of its plugins, over every item (see [Static tables](#static-tables)). |
| `useFlatTree(items, options?)` | The model of a `FlatTree`: flat items with a `parentValue`, the visible rows with their level and position, the expanded and checked state (see [Trees](#trees)). |
| `useListboxPopup(options)`, `ListboxSurface`                                                                                                 | The popup of a custom picker: dismissal (`onDismiss(reason)`, a `DismissReason`: `'escape'`, `'outside-press'` or `'focus-outside'`) and positioning, and the surface that renders the list (`listClassName`, `surfaceClassName`).                                                                                                                                                                                                                                                                                                                                     |
| `ListboxProvider`                                                                                                                            | Provides a listbox's context to its options when you render the list yourself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `collectOptionLabels(children)`, `markListboxElement(component, kind)`                                                                       | Read option labels from children before the options register (server HTML, first render); mark your own option and group components so they are read.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `useWaveTheme()`                                                                                                                             | Current theme, direction, portal container, `inputDefaults`, `motion` (`'default'` or `'none'`), the merged token overrides (`tokens`), the inline style that applies them (`tokenStyle`) and `applyStylesToPortals`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `useToastController()`                                                                                                                       | `dispatchToast` (content or options) / `dismissToast` / `dismissAllToasts` inside `<Toaster>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `createToaster()`                                                                                                                            | A toast controller for code outside components; bind it with `<Toaster toaster={handle}>` (see [Toasts](#toasts)). Server-safe.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `useIsOverflowing(target)`, `useOverflowMenu()`, `useIsOverflowItemVisible(id)`                                                              | Overflow detection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `useIsOverflowGroupVisible(groupId)`, `useHasHiddenItems()` | Inside an `Overflow`: whether an item group is `'visible'`, `'hidden'` or `'overflow'` (some members hidden), and whether any item is hidden (see [Overflow](#overflow)). |
| `createTableColumn<T>(options)` | A DataGrid column typed by the grid's items (`columnId`, `label`, `compare`, `renderCell`, `renderHeaderCell`), with `sortable` resolved (`true` with `compare`); see [Sorting and selecting in a DataGrid](#sorting-and-selecting-in-a-datagrid). Server-safe. |
| `partitionBreadcrumbItems({ items, maxDisplayedItems, overflowIndex })` | Split a trail into `startDisplayedItems`, `overflowItems` and `endDisplayedItems`, by Fluent's rules (it hides `items.length - maxDisplayedItems` items from `overflowIndex`, default 1; a missing or non-positive `maxDisplayedItems` is 6); a trail that fits is all `startDisplayedItems`. Server-safe. |
| `truncateBreadcrumbLongName(content, maxLength?)`, `truncateBreadcrumbLongTooltip(content, maxLength?)`, `isTruncatableBreadcrumbContent(content, maxLength)` | Shorten a breadcrumb name (default 30 characters) or its tooltip text (default 80) longer than `maxLength` to that length plus `...`, and tell whether a text is longer than `maxLength`. Server-safe. |
| `hsvToHex(color)`, `hexToHsv(hex)`                                                                                                           | Convert between an `HsvColor` and a hex string (`#rrggbb`, or `#rrggbbaa` below full opacity); `hexToHsv` returns `null` for other text. Server-safe.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `getInitials(name, options?)` | The initials Avatar shows (`dir`, `firstInitialOnly`); none for digits, emoji or scripts without letter initials. Server-safe. |
| `partitionAvatarGroupItems({ items, maxInlineItems, layout })` | Split a list into the inline and overflow items of an AvatarGroup (`{ inlineItems, overflowItems }`); imports nothing. |
| `addDays(date, amount)`, `addMonths(date, amount)`, `isSameDay(a, b)`, `startOfWeek(date, firstDayOfWeek?)`, `getWeekNumber(date, options?)` | Date helpers on calendar days: every returned date is local midnight (Fluent's keep the time of day). `addMonths` clamps the day to the target month (January 31 plus a month is February 28 or 29); `getWeekNumber` takes `firstDayOfWeek` and `firstWeekOfYear` (`GetWeekNumberOptions`; ISO 8601 is `{ firstDayOfWeek: 1, firstWeekOfYear: 'first-four-day-week' }`). With the types `DayOfWeek` (`0`–`6`, Sunday first) and `FirstWeekOfYear`. Server-safe.                                                                                                        |
| `buttonClassNames`, `toastTitleClassNames`, …                                                                                                | The stable class names of every component and part (see [Styling hooks](#styling-hooks)). Server-safe.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `cn(...classes)`                                                                                                                             | clsx + tailwind-merge that knows Wave's type ramp, shadows and font families; the last class wins over a conflicting class of the same variant.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `composeEventHandlers(theirs, ours)`                                                                                                         | Run a consumer handler, then yours unless it called `preventDefault()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `mergeRefs(...refs)`                                                                                                                         | Merge refs outside components.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `resolveSlot`, `renderSlot`                                                                                                                  | The slot helpers the components use.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `getThemeClassName(theme)`                                                                                                                   | The theme classes of a theme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `createBrandTokens(seed)` | The 16 brand tokens (`brand10` … `brand160`, a `BrandTokens`) of a `#rgb` or `#rrggbb` seed, each stop at the default ramp's luminance so the light and dark themes keep their contrast; or of a full `BrandRamp`, returned unchanged and checked for contrast in development. For `WaveProvider tokens` or `getTokenStyle` (see [Brand colors and token overrides](#brand-colors-and-token-overrides)). Server-safe. |
| `waveTokens` | Every design token as the `var()` that reads it, typed as that literal (`waveTokens.primary` is `'var(--wave-primary)'`), for inline styles and SVG charts; with the types `WaveTokens` and `WaveTokenName`. Frozen and server-safe; no component imports it. |
| `chartPalette` | The 12 palette fills as token names, in the order that keeps neighbouring chart series as far apart as the palette allows (read each with `waveTokens[name]`); colors still need a second encoding in every chart. Frozen and server-safe. |
| `getTokenStyle(overrides)` | The inline style (`TokenStyle`) that applies token overrides (`WaveTokenOverrides`), the one `WaveProvider` puts on its root and portals; `undefined` when there is nothing to set. Server-safe. |

## Upgrading from 0.16

0.17 removes nothing public, and everything it adds is opt-in (`tokens` and `applyStylesToPortals`, `createBrandTokens`, `waveTokens`, `getTokenStyle`, `chartPalette`, `Text font`, the palette tints and the font families), but the dark and high-contrast shadows change, and so do two types:

1. **Stronger shadows in the dark and high-contrast themes.** The shadow levels are tokens of each theme (`--wave-shadow-2` … `--wave-shadow-64`): the light theme keeps the shadows of 0.16, and dark and high contrast take Fluent's, twice as dark (ambient opacity 0.24, key 0.28), so screenshots of those themes change. A shadow color utility or an opacity modifier (`shadow-black`, `shadow-4/50`) no longer changes Wave's levels: set the level's token for a theme instead (`.wave-dark { --wave-shadow-8: … }`, or `tokens={{ shadow8: … }}`). An `@theme` of yours that sets `--shadow-N` keeps its value.
2. **`WaveContextValue` has three new members**, `tokens`, `tokenStyle` and `applyStylesToPortals` (`{}`, `undefined` and `true` outside a provider): a hand-built value (a test mock of `useWaveTheme`) adds them.
3. **`TextWeight` has a fourth value, `'medium'`:** an exhaustive `switch` over it, or a `Record<TextWeight, …>` of your own, adds a case.
4. **With `tokens`, the provider root and the portal wrappers carry the overrides** in their `style` attribute, a nested provider's root too. Without `tokens` the markup is 0.16's; a test that compares a whole `style` attribute changes when you adopt them.

On the `./tailwind` path your Tailwind theme gains the palette's new color names and the `font-wave-mono` and `font-wave-numeric` families (see [Global effects](#global-effects)). [Brand colors and token overrides](#brand-colors-and-token-overrides) shows the new API; the CHANGELOG's [0.17.0 section](CHANGELOG.md) lists the additions and the full upgrade notes.

## Upgrading from 0.15

0.16 removes nothing public, and everything it adds is opt-in (windowing, `FlatTree`, the table hooks, the pickers' data mode, resizable columns), except one behaviour change for a DataGrid given `items`:

1. **Selection follows the data.** Select-all selects every selectable item of `items`, rendered or not, and its checkbox reflects them; a row click, Space or a row's control no longer drops the selected ids whose rows are not rendered, and `onSelectedItemsChange` (same signature) reports them, so an id of a filtered-out item, of another page or restored by id stays selected until your code removes it. In single mode the selected id is the first one given. Select-all reports the ids outside `items` first, then the others in `items` order (0.15: the order the rows mounted in, the sorted order for a grid that mounts sorted). A grid of `DataGrid.Row` children is unchanged.
2. **Disabled rows:** select-all can skip only the rows it knows. Pass `isSelectionDisabled(item, index)` when items can be disabled and not all rows are rendered (a `virtualWindow`): it also becomes each rendered row's selection-cell `disabled`.
3. **New development warnings** for a `DataGrid.Row` whose own `rowId` differs from its item's id, or is no item's id, in a grid with `items` (`DataGrid.Row:row-id-mismatch`, `DataGrid.Row:row-id-outside-items`): pass a `getRowId` that returns the rows' ids. The `DataGrid:single-several-selected` text changes with `items`.
4. **Types:** `UseGridNavigationResult` has two new members (`activeRowIndex`, `pendingRowIndex`), which a hand-built value adds; `ListboxOptionElementProps` gains optional `aria-posinset`, `aria-setsize` and `style` (spread them in an option of yours; merge `style` after your own); `DataGridLabels` gains `resizeColumn` and `columnWidth`.

A windowed list needs a bounded height and a fixed item height (see [Large data](#large-data)). The CHANGELOG's [0.16.0 section](CHANGELOG.md) lists the additions and the full upgrade notes.

## Upgrading from 0.14

0.15 removes nothing public and every type only widens, but the overlays and disclosures of item 1 (not yet the listbox popups of Combobox, Dropdown, TagPicker and TimePicker, the DatePicker calendar and the AvatarGroup popover) now animate by default; these changes can affect your end-to-end tests, styles and type mocks:

1. **Surfaces animate by default** in a browser: a closed Dialog, Drawer, NavDrawer, Menu, Popover, InfoButton note, Tooltip or TeachingPopover stays in the document, `inert`, for its exit (100 to 500ms). End-to-end tests that look for its absence right after a close wait for it, or render under `<WaveProvider motion="none">`; unit tests in jsdom are unaffected. A `defaultOpen` surface animates in on a client render too.
2. **Popover.Content, the Tooltip surface and the TeachingPopover surface** mount through the presence core and render `data-presence` and `data-state`.
3. **New wrapper elements** around Accordion's region, a Tree group, a Nav category's list and an inline drawer's panel, which are `display: contents` while open (so layout is unchanged then) and a clipping grid while they move; and a content element inside each toast container (`wave-toaster__toast-content`), around which the container is a one-cell grid in every phase. Child-combinator selectors across them, and tests that walk `parentElement` or `nextElementSibling`, change. An inline drawer with a percentage width resizes oddly during its motion: give it a length, or pass `motion={null}`.
4. **0.14's `data-[presence=…]` classes in `className`** (`Menu.Popover`, `Dialog.Content`, Drawer, NavDrawer) keep working and turn that part's default motion off; its backdrop now fades by default (`backdropMotion={null}` keeps 0.14's). CSS of yours on `.wave-toaster__toast[data-presence=…]` now runs beside the toasts' default motion (a `transition` shorthand can reset the recipe's property list): pass `<Toaster motion={null}>` or move it to `motion`. The same goes for CSS on `[data-wave-infolabel-surface][data-presence=…]` (`motion={null}` on InfoButton or InfoLabel).
5. **TabList's indicator** is the selected tab's `::after`: recolour it with `after:` border classes.
6. **Focus in a closing Accordion panel, Tree group or Nav category** moves to its trigger (0.14: `<body>`).
7. **Carousel's slide and Nav's chevron** use the `easy-ease` curve, and Nav item actions fade in over 150ms.
8. **`WaveContextValue` has a new member, `motion`:** a hand-built value (a test mock of `useWaveTheme`) adds it.

The CHANGELOG's [0.15.0 section](CHANGELOG.md) lists the additions and the full upgrade notes.

## Upgrading from 0.13

0.14 removes nothing public, and every new behaviour is opt-in; these changes can still affect your types, tests and styles:

1. **`DataGridColumn` and `DataGrid` are generic** (`T = unknown` without a type argument): a column's `label` widens to `ReactNode`, and its `id` is optional and deprecated (`column.id` is `string | undefined`; write `columnId`). `children` of `DataGrid` and `DataGrid.Body` is optional, and `DataGridBodyProps['children']` may be a render function.
2. **`onSortChange(sort)` and `onSelectedItemsChange(items)` get a second argument, `details` (`{ event }`):** exact `toHaveBeenCalledWith` assertions need it. The 0.4 positional `onSortChange(columnId, direction)` is unchanged, but a grid with `items` always uses the object form, and the deprecated sort props next to `items` are type errors (ignored, with a warning, at run time).
3. **A sorted DataGrid header shows an arrow icon** (`data-wave-icon="sort-arrow-up"` or `"sort-arrow-down"`, with `data-direction`) instead of the 0.13 triangle.
4. **`OverflowItemProps` is a union type alias:** extend `OverflowItemBaseProps` instead.
5. **TeachingPopover:** Done calls `onFinish` and, through 0.x, still `onDismiss`. Children passed to TeachingPopover, dropped in 0.13, now render. The `steps` form's Close button sits in a header `<div class="wave-teaching-popover-header">`, its heading, body and footer carry the new parts' classes, and the surface and footer carry `data-layout`: selectors that rely on the Close button being the surface's child, or on `:first-child`, change.
6. **Table and DataGrid cells are `relative`** and their rows the group `group/table-row`: an absolutely positioned element in a cell is placed against it, and a `sticky` header of yours needs a `z-index` to stay over the body cells.
7. **New attributes**, always rendered: Overflow `data-orientation`, `data-overflow-direction`, `data-button-position`; Breadcrumb `data-size`, `data-focus-mode`, `data-overflow`; DataGrid `data-selection-appearance`; List `data-navigation-mode`.

The CHANGELOG's [0.14.0 section](CHANGELOG.md) lists the additions and the full upgrade notes.

## Upgrading from 0.12

0.13 removes nothing public; these changes can still affect your types, tests and styles:

1. **`PresenceStatus` gains `'do-not-disturb'` and `'out-of-office'`** (`dnd` and `oof` stay, deprecated): an exhaustive `switch` or a `Record` over it needs the cases. `PresenceBadge` `status` is optional.
2. **`Avatar` `size` also takes a number and `Persona` `size` gains `'huge'`:** code that narrows these unions needs the new members.
3. **An Avatar in a rounded Tag is square** (`Tag` and `InteractionTag` pass their shape to their `media`).
4. **Initials come from `getInitials`:** punctuation is dropped, a hyphen or apostrophe joins words, and names without letter initials show none.
5. **AvatarGroup's popup is `AvatarGroup.Popover`:** the count reads `99+` past 99 (the name keeps the real number).
6. **Card parts take their padding from `--wave-card-padding`** instead of a fixed `p-4`.
7. **Carousel has a viewport element** (`.wave-carousel__viewport`) that clips the track; the default layout's buttons sit inside it. Reach the track by `.wave-carousel__track`.

The CHANGELOG's [0.13.0 section](CHANGELOG.md) lists the additions.

## Upgrading from 0.11

0.12 removes nothing public; these changes can still affect your types and tests:

1. **`target` widens.** `Popover` and `Menu.Popover` `target` also accept a ref object (`PopupTargetInput`), and `TeachingPopover` `target` a `VirtualElement`; code that reads `PopoverProps['target']` as `PopupTarget` needs the wider type.
2. **`useRovingTabIndex` `orientation` gains `'grid'`:** an exhaustive `switch` or a `Record` over the option's type needs the case.
3. **`usePopupPosition` results gain `update()`**, and `useListboxPopup` options gain `positioning`; nothing else about them changes.

The CHANGELOG's [0.12.0 section](CHANGELOG.md) lists the additions.

## Upgrading from 0.10

0.11 removes nothing public; these changes can still affect your tests, styles and types:

1. **Dialog and Drawer backdrops are the surface's siblings.** A test or a style that reached the backdrop through `dialog.parentElement` or `panel.parentElement` uses `.wave-dialog-content__backdrop` or `.wave-drawer__backdrop` (the Dialog surface now sits in `.wave-dialog-content__positioner`).
2. **Dialog and Drawer mount through the presence core:** their elements carry `data-presence`, and a closed surface without motion unmounts one render after the closing commit (in the same `act()`). A test that queries a closed kept-mounted surface (`unmountOnClose={false}`) passes `{ hidden: true }`.
3. **A modal opened over another modal no longer dims the page twice:** its backdrop is transparent; `backdrop={{ appearance: 'dimmed' }}` keeps 0.10's look.
4. **Every Dialog and Drawer trigger toggles:** a trigger inside its own surface, or the trigger of a non-modal or inline surface, closes it when clicked while open. A render-prop `Drawer.Trigger` that reads `aria-haspopup` accepts `undefined` (inline drawers render none).
5. **Drawer layout:** a hand-made action row (or a `Dialog.Footer`) at the end of a Drawer's content becomes `Drawer.Footer` to stay in view; a `title` or `titleAction` next to a new `Drawer.Header` is ignored (move it into a `Drawer.HeaderTitle`). A test that asserts `pe-8` on a Dialog title asserts `pe-[var(--wave-dialog-title-end-padding,2rem)]`.
6. **`ModalType` gains `'non-modal'` and `DrawerPosition` `'bottom'`:** an exhaustive `switch` or a `Record` over either needs the case.
7. **Tag:** a focused Dismiss button dismisses on Delete and Backspace, also outside a TagGroup. Assertions on Tag's exact class string or padding classes change (`ps-3` → `ps-2.75`, `pe-1.5` → `pe-1.25`, `pe-3` → `pe-2.75`, `py-1` → `min-h-7`; `toHaveClass('bg-muted')` does not). Tag's new own props shadow the attributes of the same names: `as="li" value={3}` becomes `value={String(3)}`, and `size`, `shape`, `appearance`, `selected`, `media`, `icon` and `secondaryText` no longer reach an `as` component; an interface that extends `TagProps` and declares one of them with another type no longer compiles. A dismissible Tag rendered as a button or a link (`as="button"`, `as="a"`, a link component) warns `Tag:nested-button` in development: use InteractionTag for a button, and put a link in the tag's content (`<Tag dismissible><a href>…</a></Tag>`).
8. **TagPicker:** its tags are Tags in a TagGroup, so tests that assert the 0.10 tag classes (`px-2 py-0.5 text-body-1`), the remove button's `ms-0.5 rounded-sm` or its 12px glyph, query `[data-wave-tagpicker-remove]` or count the picker's buttons (one more: "Show options") change; `expandIcon={false}` keeps the 0.10 field. After a keyboard removal focus is on the next tag, not on the input; a press on the empty area of an open TagPicker closes the list. In the parts form, keep the options of selected values in `TagPicker.List`: TagPicker hides them and reads their labels.
9. **`import { TagPickerOption }`** now brings the component (`TagPicker.Option`) and the entry type; `import { type TagPickerOption }` keeps only the type.
10. **Nav:** a Nav whose list holds content that is not an `<li>` (a Divider, a heading, a `<div>`, a Tooltip wrapped around a `Nav.Item`) logs a development warning; use `Nav.Divider` or `Nav.SectionHeader`, or wrap the content in an `<li>`. A test that spies on `console.warn` around such a Nav sees the message.

The CHANGELOG's [0.11.0 "Changed" section](CHANGELOG.md#changed) lists every behaviour, DOM and type change.

## Upgrading from 0.9

0.10 removes nothing public; these changes can still affect your tests and types:

1. DatePicker's calendar heading is a button (the month picker, on by default): the calendar dialog gains a Tab stop between the previous-month and next-month buttons, so tests that count Tab presses or list the dialog's tabbable elements change. Queries by the heading and the names of the dialog and the grid are unchanged. Escape in the month or year view goes back a view and keeps the dialog open; only Escape in the day view closes it. `showMonthPicker={false}` keeps a static heading.
2. The development error of an `Option` outside a listbox names every listbox: `… must be used within a listbox (Listbox, Combobox, Dropdown or a ListboxProvider)`.
3. `OptionGroup`'s `aria-label` and `aria-labelledby` go to its `role="group"` list, which they name; 0.9 put them on the group's `role="presentation"` item.
4. SwatchPicker renders `data-layout`, `data-focus-mode`, `data-size`, `data-shape` and `data-spacing` on its root, and the swatches of `items` carry `wave-color-swatch` next to `wave-swatch-picker__swatch`: assertions on the root's exact attributes or a swatch's complete class string change.
5. The popups of Dropdown, Combobox and TagPicker carry `wave-listbox-surface` and `wave-listbox-surface__list` next to their own stable classes: assertions on a complete class string change.
6. `SwatchPickerSize` gains `'extra-small'`: a `Record<SwatchPickerSize, …>` of yours needs the key.
7. A multi-select Dropdown or Combobox needs a literal `multiselect`: `multiselect={flag}` with a `boolean` variable matches neither call signature of the component, so render two elements, one for each mode.

The CHANGELOG's [0.10.0 "Changed" section](CHANGELOG.md#changed-1) lists every behaviour, DOM and type change.

## Upgrading from 0.8

0.9 removes nothing public; these changes can still affect your setup, tests and styles:

1. Text controls, pickers, choice controls, Field, Rating and RatingDisplay render new data attributes (`data-size`, `data-appearance`, `data-shape`, `data-color`): a test that asserts a control's exact attributes changes. Nothing changes visually at the defaults, except items 4 and 6.
2. A numeric `size` on `Input` and `Select` is deprecated: use `htmlSize` (a number still sets the native attribute and warns once in development). On `Slider` a numeric `size` has no effect: it is no longer rendered and warns once.
3. `InfoLabel` renders a real `<label>` (point it at a control with `htmlFor`), and its `id` moves from the root to that `<label>`. The label content moves to `children` (`label` still works and warns once), and the button is named "‹label› Information". The popup is a `role="note"` with a beak that can hold links, and it is no longer `aria-hidden`: Tab from the open button enters it. The label text takes the `Label` type ramp and color, so a `className` on the root that changes the text size or color no longer reaches it.
4. `SpinButton` is 32px tall like the other fields (0.7: 34px). A root you size (`className="w-full"`) now widens the input; an unsized one keeps its width. A step button steps on click (not on the press) and repeats while it is held, and Shift+Home and Shift+End select text instead of jumping to the bounds.
5. `Field` renders a `Label` or `InfoLabel` element passed as `label` itself (0.7 wrapped it in a second `<label>`).
6. A focused invalid field draws its bottom border in the focus color; the other borders stay red (0.7: all red).
7. `Rating` and `RatingDisplay` `color` is a `RatingColor` (`'neutral' | 'brand' | 'marigold'`): it narrows the `color?: string` inherited from `React.HTMLAttributes`. Both gain the static member `Item` and render their `children` (0.7 ignored them).
8. `WaveContextValue` (the result of `useWaveTheme()`) gains `inputDefaults`: code that builds one (a test double) adds it. `InputProps`, `SelectProps` and `SliderProps` declare their own `size`, and `SpinButtonProps` gains `allowEmpty?: false` next to the new `SpinButtonAllowEmptyProps`.

The CHANGELOG's [0.9.0 "Upgrading from 0.8"](CHANGELOG.md#upgrading-from-08) and [0.9.0 "Changed" section](CHANGELOG.md#changed-2) list every behaviour, DOM, visual and type change.

## Upgrading from 0.7

0.8 removes nothing public; these changes can still affect your tests and styles:

1. `Dialog.Content`'s 1rem gap to the viewport is now the surface's own margin: a margin class of yours replaces it on its sides, a percentage width or height resolves against the whole viewport, and a surface you position with `fixed` or `absolute` needs `m-0`.
2. Muted `Dialog.Content` body text becomes the primary text colour, as in Drawer and Popover: put text that should stay secondary in an element with `text-muted-foreground`.
3. Every component root and part carries a stable class (`wave-button`, `wave-button__icon`, …): assertions on a complete class string change.
4. A toast in a Toaster renders inside a `role="group"` container named by its severity and title; the container now carries `data-wave-toast` and `data-presence`; the 0.5 `title` and body render as the `Toast.Title` and `Toast.Body` elements.
5. Escape inside the toast region dismisses the toasts and no longer closes a Dialog or Drawer below them.
6. Every toast pauses while the pointer or focus is anywhere in the toast region (0.7 paused the hovered or focused toast only).
7. A toast dispatched with content that holds an action stays until it is dismissed, unless the dispatch passes `timeout`; the options form is unchanged.
8. MessageBar renders `data-layout`, and Tree `data-selection-mode`.
9. The default ColorPicker gains a color area and a hue slider, its opacity slider becomes an alpha slider (still named "Opacity"), and ColorPicker `children` now render a custom layout.
10. `ToastController['dispatchToast']` is overloaded: a test double that implements it must accept content too.
11. A `dispatchToast` options argument that is not a plain object (a class instance, `Object.create(defaults)`) is now read as React content and throws when it renders: pass a plain object (spread it: `{ ...defaults, title }`).

The CHANGELOG's [0.8.0 "Changed" section](CHANGELOG.md#changed-3) lists every behaviour, DOM and type change.

## Upgrading from 0.6

0.7 removes nothing public; these changes can still affect your setup, tests and styles:

1. Menu surfaces render `data-presence` next to `data-state`, and stay mounted (`data-state="closed"`, `inert`) while an exit motion of yours runs; without exit classes a menu still unmounts at once.
2. Menu items render a hidden placeholder before the label for each column they do not fill (the check column, the icon column), and a menu that mixes items with and without icons now lines the labels up.
3. Toolbar renders `data-size` and `data-orientation`, and `Toolbar` has static parts.
4. A ToggleButton with a checked `role` (`checkbox`, `radio`, `switch`, `menuitemcheckbox`, `menuitemradio`, `option`, `treeitem`) renders `aria-checked` instead of `aria-pressed`, and one with another role renders neither and warns; every pressed ToggleButton renders `data-pressed`.
5. Tooltip `delay` is deprecated: rename it to `openDelay` (it still works and warns once in development).
6. `Menu.Item` `persistOnClick` defaults to the Menu's new `persistOnItemClick` (`false`): no change unless you set it.
7. While focus is in a menu, the item under the mouse takes focus: a test that hovers an item and then presses Enter activates the hovered item.
8. Wave now requires tailwind-merge 3.7, so an axis shorthand in your `className` (`px-6`) replaces a component's own logical side class of the same variant (`pe-8` on `Dialog.Title`) instead of losing to it in the CSS: write `px-6 pe-8` to keep the side.
9. Wave requires Node.js 22.12 or later (`engines`; Node.js 20 reached its end of life on 2026-04-30). npm and pnpm warn on an older Node.js (npm stops with `engine-strict`), and Yarn 1 refuses to install.

The CHANGELOG's [0.7.0 "Changed" section](CHANGELOG.md#changed-4) lists every behaviour, DOM and type change.

## Upgrading from 0.5

0.6 removes nothing public; these changes can still affect tests and styles:

1. Dialog and Drawer call `onOpenChange(open, details)`: test assertions such as `toHaveBeenCalledWith(false)` need a second argument (`expect.anything()`, or `expect.objectContaining({ reason: 'escape' })`).
2. A Field keeps its hint visible below a validation message, and error messages show an icon (`validationMessageIcon={null}` removes it).
3. A Link or `Button as="a"` without `href` is a button (`role="button"`, a tab stop, Enter and Space). A disabled one is `role="button"` too (was `link`), with no tab stop and no activation. A disabled Link no longer lets its click reach ancestor handlers.
4. TimePicker keeps rejected text on blur and flags it instead of reverting it; the list closes.
5. Combobox and TimePicker show a chevron button (`expandIcon={false}` hides it), and Combobox and Dropdown wrap their control in a new `<div>`.
6. Code that implements `ToastController` (a test double) adds `dismissAllToasts`.
7. RatingDisplay formats its accessible name with the runtime locale when `locale` is omitted: pass `locale` when rendering on the server.
8. Badge `color="important"` becomes a neutral color in 1.0: switch to `color="severe"` to keep the orange look.

The CHANGELOG's [0.6.0 "Changed" section](CHANGELOG.md#changed-5) lists every behaviour, DOM and type change.

## Upgrading from 0.4

npm went from 0.4.0 to 0.7.0: 0.5.0 and 0.6.0 were never published, and their changes ship in 0.7.0. From 0.4.0, take these steps, then those of [Upgrading from 0.5](#upgrading-from-05), [Upgrading from 0.6](#upgrading-from-06), [Upgrading from 0.7](#upgrading-from-07), [Upgrading from 0.8](#upgrading-from-08) and [Upgrading from 0.9](#upgrading-from-09).

1. The npm package name is unchanged (`@mortenbrudvik/waveui`, as in 0.4.0). Replace `waveui` imports copied from the 0.4 guide, and a git or local dependency named `waveui`, with `@mortenbrudvik/waveui`.
2. Styles: without Tailwind, keep `import '@mortenbrudvik/waveui/styles'` and make sure a `WaveProvider` wraps the app; with Tailwind 4, switch to `@import '@mortenbrudvik/waveui/tailwind';` after `@import 'tailwindcss';`. Import `preflight.css` if you relied on Wave's Preflight.
3. Rename CSS overrides of the 0.4 semantic variables (`--primary`, `--border`, …) to `--wave-*`. Code that reads 0.4 variables (`var(--primary)`, `var(--ring)`, `var(--brand-80)`, `var(--grey-14)`) must switch to the `--wave-*` names too: 0.5 no longer defines them. Until then, import `legacy-tokens.css`. Overrides of the ramp names (`--brand-*`, `--grey-*`) keep working without it.
4. A required `Field` now turns on native constraint validation for the control inside it, including Checkbox, Switch and the other choice and picker controls (see [Forms and `Field`](#forms-and-field)). Add `noValidate` to forms that validate in their submit handler.
5. Replace deprecated props at your own pace; each warns once in development.

The [CHANGELOG](CHANGELOG.md) lists every change, including behaviour and DOM changes that can affect tests and styles.

## Development

Working on Wave needs Node.js 22.22.2+, 24.15+ or 26+ (not 25) and npm 11.11 or later (`devEngines` in `package.json`). npm stops on other Node.js versions, which the development dependencies do not support, and warns about an older npm, which drops the `libc` fields from `package-lock.json`. `allowScripts` in `package.json` denies the install scripts of esbuild and @parcel/watcher: their prebuilt binaries come from optional dependencies. npm 12 blocks every other dependency install script until it is approved; `npm install-scripts ls` lists them.

```bash
npm install
npm run dev              # Storybook on http://localhost:6006 (theme and direction toolbars)
npm test                 # unit, integration, conventions and stories accessibility tests (Vitest)
npm run typecheck        # library, dev (tests + stories) and node TypeScript programs
npm run lint             # ESLint (fails on any warning)
npm run build            # type-check, library build, CSS build, dist verification
npm run check:package    # publint + are-the-types-wrong on a packed tarball
npm run test:pack        # pack the tarball and smoke-test it in plain and Tailwind fixtures
```

GitHub Actions runs these checks, `npm run format:check` and a Storybook build on every push to `main` and every pull request (`.github/workflows/ci.yml`), and the tests, build and pack smoke test also on Node.js 22 and 26 and on Windows.

### Releasing

Releases are published by GitHub Actions, never from a local machine: set the version (`npm version <x.y.z> --no-git-tag-version`), date its CHANGELOG section (`## [x.y.z] - YYYY-MM-DD`), merge to `main`, then tag that commit `vX.Y.Z` and push the tag. The release workflow checks the tag against `package.json` and the CHANGELOG, runs the full gate, publishes to npm through trusted publishing with a provenance attestation, and creates the GitHub release. [docs/RELEASING.md](docs/RELEASING.md) has the exact steps, the one-time setup and how to verify a release.

## License

MIT
