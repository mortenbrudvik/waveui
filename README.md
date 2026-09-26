# @mortenbrudvik/waveui

A React component library inspired by the Fluent UI 2 design language: 65 accessible, composable components built with TypeScript, Tailwind CSS 4 and CSS custom properties, with light, dark and high-contrast themes and right-to-left support.

> This is **not** Microsoft's official `@fluentui/react-components` package.

- [Requirements](#requirements) · [Installation](#installation) · [Quick start](#quick-start)
- [Styles](#styles) · [Theming](#theming) · [Global effects](#global-effects)
- [React Server Components](#react-server-components) · [Components](#components) · [Usage notes](#usage-notes)
- [Keyboard support](#keyboard-support) · [Hooks and utilities](#hooks-and-utilities) · [Upgrading from 0.6](#upgrading-from-06) · [Upgrading from 0.5](#upgrading-from-05) · [Upgrading from 0.4](#upgrading-from-04) · [Development](#development)

## Requirements

- React 19 (`react` and `react-dom` `^19.0.0`)
- Tailwind CSS `^4.1.0` only if you use the [Tailwind path](#tailwind-css-4); the precompiled stylesheet needs no Tailwind
- Browsers: Chrome/Edge 111+, Safari 16.4+, Firefox 128+ (the CSS uses `@property`, `color-mix()`, `:where()` and `:has()`)
- Node.js 20.19+ (`engines`)

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
- A nested provider inherits every prop it omits (`theme`, `dir`, `portalContainer`) from the enclosing provider, so the light panel above stays right-to-left. `portalContainer={null}` sends a nested subtree's overlays to `document.body`.
- The provider renders `<div class="wave-root wave-<theme>" dir data-wave-theme>` with `bg-background text-foreground font-wave text-body-1`; a `className` you pass wins.
- Portaled overlays (Dialog, Drawer, Popover, Menu, listboxes, Tooltip, Toaster) render in a `wave-portal` wrapper that carries the provider's theme classes, direction and font.
- `useWaveTheme()` returns `{ theme, dir, themeClassName, portalContainer, hasProvider }`.

**Theme classes.** The tokens are selected by `wave-light` (also `:root`), `wave-dark` and `wave-high-contrast`; `getThemeClassName(theme)` returns them. For dark and high contrast the provider also emits the deprecated 0.4 classes `dark` and `high-contrast`, so 0.4 `.dark` selectors in your CSS and class-based `dark:` variants (`@custom-variant dark (&:where(.dark, .dark *));`) keep working. Tailwind 4's default `dark:` variant follows `prefers-color-scheme`, not a class, and Wave does not define a class-based one. Wave's CSS still honours the two legacy classes, but they set only `--wave-*` variables. `color-scheme` is set on the three `wave-*` theme classes only, never on `:root`, so a page without a provider keeps its own scrollbar and form-control scheme.

### Customizing tokens

Every color is a runtime CSS variable prefixed `--wave-`. The Tailwind color utilities use the same name without the prefix: `--wave-muted-foreground` is `text-muted-foreground`, `--wave-primary` is `bg-primary`, `border-primary`, `ring-primary`, and so on.

Override a token for one theme by targeting its theme selector. With `./styles`, load your CSS after Wave's (the selectors have the same specificity); on the Tailwind path any unlayered rule wins over Wave's `theme` layer.

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

**Re-branding.** The primary, hover, pressed, focus-ring and selected colors of the light and dark themes are built from the brand ramp (`--wave-brand-10` … `--wave-brand-160`, declared on `:root`), so overriding the ramp re-themes them: light uses brand-80/70/40 for primary/hover/pressed, brand-160 and brand-60 for selected surfaces and text; dark uses brand-110/120/90 and brand-20/110. High contrast uses fixed colors. `--wave-info` is a fixed color and does not follow the ramp. Check the contrast of your brand against `--wave-primary-foreground` (white in light, black in dark).

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
<summary>All 61 color tokens per theme</summary>

| Token (`--wave-…`)        | Light                          | Dark                           | High contrast                  |
| ------------------------- | ------------------------------ | ------------------------------ | ------------------------------ |
| `background`              | `#ffffff`                      | `#292929`                      | `#000000`                      |
| `foreground`              | `#242424`                      | `#ffffff`                      | `#ffffff`                      |
| `card`                    | `#fafafa`                      | `#333333`                      | `#000000`                      |
| `secondary`               | `#f5f5f5`                      | `#333333`                      | `#000000`                      |
| `muted`                   | `#f0f0f0`                      | `#383838`                      | `#1a1a1a`                      |
| `muted-foreground`        | `#616161`                      | `#adadad`                      | `#ffffff`                      |
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
| `border`                  | `#e0e0e0`                      | `#666666`                      | `#ffffff`                      |
| `stroke`                  | `#d1d1d1`                      | `#666666`                      | `#ffffff`                      |
| `stroke-hover`            | `#c7c7c7`                      | `#757575`                      | `#ffffff`                      |
| `stroke-accessible`       | `#616161`                      | `#adadad`                      | `#ffffff`                      |
| `input`                   | `#d1d1d1`                      | `#666666`                      | `#ffffff`                      |
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

</details>

Theme-independent variables on `:root`: `--wave-brand-10` … `--wave-brand-160` (also utilities such as `bg-brand-80`), `--wave-grey-2` … `--wave-grey-98`, `--wave-font-family` (utility `font-wave`), the stacking layers `--wave-z-overlay` (1000), `--wave-z-toast` (1100) and `--wave-z-tooltip` (1200), and the motion durations `--wave-duration-*` and curves `--wave-curve-*` (see [Enter and exit motion](#enter-and-exit-motion)).

Contrast of every text and non-text pair is checked per theme by `src/styles/__tests__/tokens.test.ts`. One known limit: the `warning` fill (`#fde300` in light) is a background and accent color only; use `warning-tint-foreground` for warning text and icons.

Other Wave theme values: the type ramp `text-caption-2`, `text-caption-1`, `text-body-1`, `text-body-2`, `text-subtitle-2`, `text-subtitle-1`, `text-title-3`, `text-title-2`, `text-title-1`, `text-large-title`, `text-display`; shadows `shadow-2`, `shadow-4`, `shadow-8`, `shadow-16`, `shadow-28`, `shadow-64`; animations `animate-wave-spin`, `animate-wave-spin-slow`, `animate-wave-pulse`, `animate-wave-indeterminate`, `animate-wave-indeterminate-rtl`; on the Tailwind path, the motion utilities `duration-wave-ultra-fast` … `duration-wave-ultra-slow` and `ease-wave-accelerate-max` … `ease-wave-linear`. Border radius uses Tailwind's default scale (Wave no longer overrides it).

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
- **Theme and variant (`./tailwind`).** Wave adds its color names, `font-wave`, the type ramp, the shadow scale, the `animate-wave-*` animations and the `duration-wave-*` and `ease-wave-*` motion tokens to your Tailwind theme, and defines the `wave-rtl:` variant the components use to mirror glyphs (`./variants` defines it alone, for custom setups on `./tokens`). It matches by the element's own direction (`:dir(rtl)`, with a `[dir=rtl]` fallback for browsers without `:dir()`), so unlike Tailwind's `rtl:` it does not apply inside an LTR subtree of an RTL page; your build can use it too. Tailwind's `rtl:` is unchanged.
  - The variant writes the direction as `:nth-child(n of :dir(rtl))`, which matches the same elements, so your app's CSS minifier keeps it. Vite's default minifier, Lightning CSS, rewrites a bare `:dir()` to a `:lang()` list for targets below Chrome 120, which never matches a page that sets `dir` without a right-to-left `lang`. Your own `:dir()` rules still go through that rewrite in a Vite build (Tailwind's `rtl:` keeps working through its `[dir=rtl]` alternatives). To keep them, set `build.cssTarget` to browsers with `:dir()` (for example `['chrome120', 'edge120', 'firefox128', 'safari16.4']`), or exclude the feature: `css: { lightningcss: { exclude: Features.DirSelector } }` with `import { Features } from 'lightningcss'`.
  - postcss-preset-env at its default stage 2 enables `dir-pseudo-class`, which rewrites `:dir()` in a way that breaks Wave's mirroring (the 0.5 form of the variant too). Turn it off with `features: { 'dir-pseudo-class': false }`. Next.js's built-in PostCSS defaults (stage 3) are not affected.

**Colliding utility names.** Wave's Tailwind color names are unprefixed, because they are the utility vocabulary 0.4 documented and that consumer code uses in `className` overrides. In a shared Tailwind build, or next to another stylesheet that defines the same class names, each of the following names resolves to a single definition in every utility that takes a color (`bg-`, `text-`, `border-`, `ring-`, `outline-`, `fill-`, `stroke-`, `accent-`, `caret-`, `decoration-`, `divide-`, `placeholder-`, `shadow-`, `from-`/`via-`/`to-`, …):

- Shared with shadcn/ui: `background`, `foreground`, `card`, `card-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`.
- Wave's other names: `primary-hover`, `primary-pressed`, `error`, `error-foreground`, `subtle`, `subtle-hover`, `subtle-pressed`, `subtle-selected`, `selected`, `selected-foreground`, `stroke`, `stroke-hover`, `stroke-accessible`, `success`, `success-foreground`, `success-tint`, `success-tint-foreground`, `warning`, `warning-foreground`, `warning-tint`, `warning-tint-foreground`, `error-tint`, `error-tint-foreground`, `severe`, `severe-foreground`, `severe-tint`, `severe-tint-foreground`, `info`, `info-foreground`, `info-tint`, `info-tint-foreground`, `inverted`, `inverted-foreground`, `inverted-border`, `track`, `skeleton`, `rating`, `presence-available`, `presence-busy`, `presence-away`, `presence-offline`, `presence-oof`, `presence-glyph`, `backdrop`, `brand-10` … `brand-160`.

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

## React Server Components

- Every component and hook module of the package starts with `"use client"`. The entry point, `cn`, the slot helpers and the types are server-safe, so a Server Component can import from `@mortenbrudvik/waveui` and render Wave components with serializable props.
- A Server Component **cannot dot into a client component**: `Card.Header` throws "Cannot access Header on the server". Every sub-component is therefore also exported under a flat name. Use the flat names in Server Components and either form in client components.
- Every compound can be composed in a Server Component. Parts written there reach the client as lazy references, and the compounds recognise them, so the server HTML and the client behaviour are the same as in a client file: Accordion items, Carousel slides, the options of Combobox and Dropdown, DataGrid parts, Drawer and Menu triggers, the header of a `Menu.Group`, the halves of a `Menu.SplitGroup`, List, Nav, TabList and Tree items, and a `Button` passed as a MessageBar, SearchBox or Tag dismiss slot.
- Event handlers and other functions cannot be passed from a Server Component; put interactive parts in a `'use client'` component.
- A `Popover`, `Dialog`, `Drawer`, popup `Menu`, `Combobox`, `Dropdown`, `DatePicker`, `TimePicker` or `TagPicker` rendered on the server with `defaultOpen` (or `open`) is closed in the server HTML and opens once hydrated, so no ARIA reference points at a popup that is not there. `onOpenChange` is not called for it.

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

| Compound     | Flat names                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Accordion`  | `AccordionItem`, `AccordionTrigger`, `AccordionPanel`                                                                                                                            |
| `Breadcrumb` | `BreadcrumbItem`                                                                                                                                                                 |
| `Card`       | `CardHeader`, `CardBody`, `CardFooter`                                                                                                                                           |
| `Carousel`   | `CarouselItem`                                                                                                                                                                   |
| `Combobox`   | `ComboboxOption`, `ComboboxOptionGroup` (also `Option`, `OptionGroup`)                                                                                                           |
| `DataGrid`   | `DataGridHeader`, `DataGridHeaderCell`, `DataGridBody`, `DataGridRow`, `DataGridCell`                                                                                            |
| `Dialog`     | `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogFooter`, `DialogClose`                                                                                                   |
| `Drawer`     | `DrawerTrigger`, `DrawerTitle`, `DrawerClose`                                                                                                                                    |
| `Dropdown`   | `DropdownOption`, `DropdownOptionGroup`                                                                                                                                          |
| `List`       | `ListItem`                                                                                                                                                                       |
| `Menu`       | `MenuTrigger`, `MenuPopover`, `MenuItem`, `MenuDivider`, `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemSwitch`, `MenuItemLink`, `MenuGroup`, `MenuGroupHeader`, `MenuSplitGroup` |
| `Nav`        | `NavCategory`, `NavItem`, `NavSubItem`                                                                                                                                           |
| `Overflow`   | `OverflowItem`                                                                                                                                                                   |
| `Popover`    | `PopoverTrigger`, `PopoverContent`                                                                                                                                               |
| `RadioGroup` | `RadioGroupItem` (also `RadioItem`)                                                                                                                                              |
| `Skeleton`   | `SkeletonGroup`                                                                                                                                                                  |
| `Stepper`    | `StepperStep`                                                                                                                                                                    |
| `TabList`    | `TabListTab`, `TabListPanel`, `TabListPanels`                                                                                                                                    |
| `Table`      | `TableHeader`, `TableHeaderCell`, `TableBody`, `TableRow`, `TableCell`                                                                                                           |
| `Toolbar`    | `ToolbarButton`, `ToolbarToggleButton`, `ToolbarRadioGroup`, `ToolbarRadioButton`, `ToolbarGroup`, `ToolbarDivider`                                                              |
| `Tree`       | `TreeItem`                                                                                                                                                                       |

## Components

65 components, plus the `Portal` and `Presence` utilities. Every component accepts `ref` as a prop (React 19), a `className`, and the native attributes of its element. Storybook (`npm run dev`) shows every component with its props, states and themes.

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

| Component      | Description                                                                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Field`        | Label, hint, validation message (`validationState` error, warning, success or none; `error` is the shorthand for an error) and required indicator, wired to the control inside it (library controls read the Field context wherever they are in it); `orientation="horizontal"` puts the label beside the control. |
| `Label`        | Form label with a decorative required asterisk, `size` and `weight`.                                                                                                                                                                                                                                               |
| `Input`        | Text input with `contentBefore`/`contentAfter` slots, `onValueChange(value)` next to the native `onChange`, and an `error` message.                                                                                                                                                                                |
| `Textarea`     | Multi-line text input with an `error` message.                                                                                                                                                                                                                                                                     |
| `Select`       | Styled native `<select>` with an `error` message.                                                                                                                                                                                                                                                                  |
| `Checkbox`     | `checked`/`defaultChecked`/`onCheckedChange`, `indeterminate`, a rich `label` before or after the box (`labelPosition`), `disabledFocusable`, native form support.                                                                                                                                                 |
| `Switch`       | On/off toggle (`role="switch"`), `onCheckedChange`, a rich `label` before, after or above it (`labelPosition`), `disabledFocusable`, native form support.                                                                                                                                                          |
| `RadioGroup`   | Single choice with `RadioGroup.Item` items (a rich `label` each); `orientation`, `disabled`, `onValueChange`, native form support.                                                                                                                                                                                 |
| `SearchBox`    | Search input with a clear button; `onValueChange`; input attributes go to the `<input>`. The root draws the field, so `className` and `style` style the field box, and `contentBefore`/`contentAfter` sit beside the text.                                                                                         |
| `Slider`       | Styled native range input, filled up to the thumb; `onValueChange(number)`.                                                                                                                                                                                                                                        |
| `SpinButton`   | Numeric input with step buttons; typed text is a draft committed on blur or Enter; `min`, `max`, `step`, `largeStep`.                                                                                                                                                                                              |
| `Combobox`     | Editable combobox: typing filters the options; `freeform` makes the typed text the value; a chevron (`expandIcon`) and `clearable`. `Combobox.Option`, `Combobox.OptionGroup`.                                                                                                                                     |
| `Dropdown`     | Select-only combobox (a button) with typeahead; `clearable`. `Dropdown.Option`, `Dropdown.OptionGroup`.                                                                                                                                                                                                            |
| `TagPicker`    | Multi-select combobox that shows the selection as removable tags (a list named "Selected"); the input is described by a summary of the selection ("Selected: Apple, Banana"), and additions and removals are announced.                                                                                            |
| `DatePicker`   | Date input with a calendar dialog; locale-aware format and parse, `minDate`, `maxDate`, `disabledDates`, `onInvalidInput`.                                                                                                                                                                                         |
| `TimePicker`   | Time combobox (`12h`/`24h`, `step`, `minTime`, `maxTime`); value is `HH:mm`; `open`/`defaultOpen`/`onOpenChange` control the list; rejected text is kept and flagged (`onInvalidInput`).                                                                                                                           |
| `ColorPicker`  | Hex field, preset swatches and an optional opacity slider; value (`defaultValue` included) reported as lowercase `#rrggbb`, or `#rrggbbaa` when not opaque. Picking a preset keeps the current opacity (a preset's alpha digits are ignored, with a development warning).                                          |
| `SwatchPicker` | Radio group of color swatches (`items` with a `label` each).                                                                                                                                                                                                                                                       |
| `Rating`       | Star rating (`role="radiogroup"`); `RatingDisplay` is the read-only version (a fractional value draws a partly filled star; `showValue`, `count` and `compact` add the value and the number of ratings as text).                                                                                                   |

### Data display

| Component       | Description                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Avatar`        | Image, initials or icon, with an image-failure fallback and an optional `badge`.                                                                                                                                                                        |
| `AvatarGroup`   | Overlapping avatars; `max` adds an overflow button that lists the hidden members.                                                                                                                                                                       |
| `Badge`         | Status or category label: `appearance` `filled`, `tint`, `outline`; semantic `color` (see [Badges](#badges)).                                                                                                                                           |
| `CounterBadge`  | Count pill (`99+` above `overflowCount`) or, with `dot`, an unread dot; Badge's `color` palette; `showZero`.                                                                                                                                            |
| `PresenceBadge` | Availability badge with a distinct shape per status.                                                                                                                                                                                                    |
| `Tag`           | Chip with an optional dismiss button (`dismissible`, `onDismiss`, `dismissLabel`); `onDismiss` and `dismissIcon` need `dismissible` (a development warning says so). Move focus when you remove a tag (see [Tags](#tags)).                              |
| `InfoLabel`     | Label with an info button that shows extra text (a toggletip).                                                                                                                                                                                          |
| `Persona`       | Avatar with name, secondary text and presence.                                                                                                                                                                                                          |
| `Divider`       | Horizontal or vertical separator, optionally labelled.                                                                                                                                                                                                  |
| `Image`         | `<img>` with `fit`, `shape`, `shadow`, `bordered`; warns in development when `alt` is missing. Never wider than its parent; with the default `fit` its height follows its width. `fit="none"` keeps the top-left corner in view, `"center"` the middle. |
| `List`          | Plain list, selectable listbox (single or multiple) or, with item `action`s, a grid; in a selectable List item values are unique (development warning).                                                                                                 |

### Typography

| Component | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `Text`    | Type-ramp text (`variant`, `weight`); polymorphic `as`; inherits its color. |

### Layout

| Component   | Description                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Card`      | Surface with `Card.Header`, `Card.Body`, `Card.Footer`; optionally selectable (`onSelect`, `selected`, `selectionControl`).                                                                                                                                   |
| `Accordion` | Disclosure sections (`Accordion.Item`, `.Trigger`, `.Panel`); single (default) or `type="multiple"`; `headingLevel`; item values are unique (development warning).                                                                                            |
| `TabList`   | Tabs (`TabList.Tab`, `.Panel`, `.Panels`) with automatic activation, or manual with `selectTabOnFocus={false}`; `orientation`; tab values are unique (development warning).                                                                                   |
| `Tree`      | Hierarchical tree (`Tree.Item`) with expand/collapse, selection and typeahead. Nested items are `Tree.Item` elements in their parent's children (directly, in Fragments or from a render function), not rendered by a recursive component; values are unique. |
| `Carousel`  | One slide at a time with previous/next, a slide picker and optional auto-rotation with a pause control. Slides are `Carousel.Item` children, directly or in Fragments (a component that renders `Carousel.Item` is not a slide).                              |
| `Overflow`  | Hides items that do not fit in one row and renders an overflow button (`useOverflowMenu` lists the hidden items); item ids are unique (development warning). The row has a 4px padding, so its items' focus rings are not clipped.                            |
| `Grid`      | CSS grid with a column count and token gaps.                                                                                                                                                                                                                  |
| `Stack`     | Vertical or horizontal stack (`orientation`, `gap`).                                                                                                                                                                                                          |
| `Flex`      | Flexbox container (`direction`, `wrap`, `align`, `justify`, `gap`).                                                                                                                                                                                           |

### Feedback

| Component     | Description                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `MessageBar`  | Inline status message (`info`, `success`, `warning`, `error`) with hidden status text and an optional dismiss button.  |
| `ProgressBar` | Determinate or indeterminate progress; name it with `label` (inside a `Field`, the Field's label names it); `color`.   |
| `Skeleton`    | Loading placeholder (`width`, `height`, `shape`); `Skeleton.Group` marks the loading region busy.                      |
| `Spinner`     | Loading indicator announced as "Loading" (localize with `label`); `appearance="inverted"` for brand surfaces; `delay`. |
| `Toast`       | Notifications shown by `<Toaster>` (`limit` queues the rest) through `useToastController()`.                           |

### Navigation

| Component    | Description                                                                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Breadcrumb` | Trail of links, buttons or text (`Breadcrumb.Item`, `current`).                                                                                                                                                                                                                                                           |
| `Menu`       | Popup menu (`Menu.Trigger`, `Menu.Popover`, which scrolls when it is taller than the viewport) or static menu; `Menu.Item`, `Menu.Divider`; checkbox, radio and switch items bound to `checkedValues`, `Menu.Group`, `Menu.ItemLink`, submenus, `Menu.SplitGroup`, hover opening and context menus (see [Menus](#menus)). |
| `Nav`        | Side navigation with items, collapsible categories and sub-items; links or buttons; a collapsed category that holds the current page is marked.                                                                                                                                                                           |
| `Stepper`    | Multi-step progress (`Stepper.Step`), horizontal or vertical, optionally `linear`.                                                                                                                                                                                                                                        |
| `Pagination` | Page buttons with ellipses, previous/next and optional first/last.                                                                                                                                                                                                                                                        |

### Overlays

| Component         | Description                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog`          | Modal dialog (`modalType="alert"` for a confirmation): `Dialog.Trigger`, `Dialog.Content` (`closeLabel` names its Close button), `Dialog.Title`, `Dialog.Footer` (stays in view), `Dialog.Close`. |
| `Drawer`          | Modal side panel (`position` `start`, `end`, `left`, `right`; `closeLabel`); `Drawer.Trigger`, `Drawer.Title`, `Drawer.Close`.                                                                    |
| `Popover`         | Non-modal popup anchored to `Popover.Trigger` or a `target`; `side`, `align`; hover cards (`openOnHover`) and context popovers (`openOnContext`).                                                 |
| `Tooltip`         | Hover and focus text for its child, as a description or (`relationship="label"`) a name; `open`/`defaultOpen`/`onOpenChange`; `openDelay`, `closeDelay`.                                          |
| `TeachingPopover` | Step-by-step onboarding popover, optionally pointing at a `target`.                                                                                                                               |

### Tables

| Component  | Description                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Table`    | Static table: `Table.Header`, `Table.HeaderCell`, `Table.Body`, `Table.Row`, `Table.Cell`; `striped`; scrolls horizontally.                                      |
| `DataGrid` | Interactive grid (APG grid keyboard model) with row selection and sortable headers; header from children or `columns`; row ids are unique (development warning). |

### Provider

| Component      | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| `WaveProvider` | Theme (`light`, `dark`, `high-contrast`), direction and portal container. |

`Portal` renders its children into `document.body` (or the provider's `portalContainer`) inside a themed `wave-portal` wrapper; use it for your own overlays.

### Motion

| Component  | Description                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Presence` | Shows and hides its child with CSS enter and exit motion: `data-presence` phases, `inert` while it exits, unmounted when the motion ends; `usePresence` is the hook form (see [Enter and exit motion](#enter-and-exit-motion)). |

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

- Library controls inside a `Field` are named by its label, described by its validation message and hint, and marked `aria-invalid`/`aria-required`. With `required`, native inputs (`Input`, `Select`, `Textarea`, `Slider`, `SpinButton`, `SearchBox`) also get the native `required` attribute, so the browser blocks an empty submit. The choice and picker controls (`Checkbox`, `Switch`, `RadioGroup`, `Rating`, `SwatchPicker`, `ColorPicker`, `Combobox`, `Dropdown`, `TagPicker`, `DatePicker`, `TimePicker`) are required too, also without `name`: the browser blocks the submit until the control is checked, switched on or has a value, so `<Field required><Switch /></Field>` means "must be on". Like a native read-only input, a `readOnly` Combobox, TagPicker, DatePicker or TimePicker does not block the submit (it keeps `aria-required`). Add `noValidate` to a `<form>` that validates in its submit handler.
- **Validation states.** `validationMessage` renders below the control in the style of `validationState`: `error` (the default when a message is given) marks the control `aria-invalid` and announces the message (`role="alert"`); `warning` announces it without making the control invalid; `success` and `none` show it without announcing it. Each state but `none` shows an icon before the message; `validationMessageIcon` replaces it, and `null` removes it. `validationState="error"` without a message marks the control invalid and shows nothing. The Field root carries `data-validation-state`.
- **`error`** is the shorthand for an error message: `error="Enter an email address"`, or `error={true}` to mark the control invalid without a message. It wins over `validationMessage` and `validationState` (a development warning fires when both are set).
- **The hint** stays visible below the message, after it; the control is described by the message, then the hint.
- **`orientation="horizontal"`** puts the label in a start column (a third of the width) beside the control; the message and the hint stay below the control. The label's first line lines up with the control's first line: a Checkbox, Switch or RadioGroup as the first child (or a plain wrapper around them) gets 6px of padding above and below its first row, as tall as an Input. The root carries `data-orientation`. The horizontal layout wraps the control, so changing `orientation` on a mounted Field remounts the control (an uncontrolled control loses its state and focus).
- **ProgressBar** reads the Field: the Field's label names a bar that has no name of its own, the message and the hint describe it, and the validation state (error, warning, success) colors its fill unless you set `color`. A progress bar is never invalid or required. Next to another control in a Field's wrapper element, the bar leaves the Field's label to that control (it gets an id of its own).
- **Choice labels.** Checkbox, Switch and `RadioGroup.Item` take any phrasing content as `label` (a link to the terms, a second line of subtext; no other form controls). It names the control; clicking its text toggles the control, and clicking a link inside it follows the link. The box, track or radio lines up with the first line of a label that wraps or has a second line (`className="items-center"` centres it instead). Arrow keys, Home and End pressed on a link inside a `RadioGroup.Item` label stay the link's. `children` are not rendered (a development warning says so). `labelPosition` puts the label `"after"` (default) or `"before"` the Checkbox and Switch, or `"above"` the Switch (settings lists). Checkbox and Switch take `disabledFocusable` (focusable, but not toggled and not submitted) and route your `aria-disabled` to the control.
- A `label`, `hint`, `error` or `validationMessage` that renders nothing (`[]`, such as an empty `errors.map(…)`) counts as absent: no empty message renders, the hint shows, and without `validationState="error"` the control stays valid. A control's own `aria-invalid={false}` wins over the Field's error, which still describes it.
- One control per Field. Put wrapper or layout components (a `Tooltip`, your own row) **inside a plain `<div>`** in the Field; the library control inside is then labelled correctly.
- `error` on `Input`, `Select` and `Textarea`: a string renders the message after the control in a `role="alert"` element linked with `aria-describedby`/`aria-errormessage`; `error={true}` only marks the control invalid. Inside a Field that shows its own error, the message is not repeated.
- Value controls take part in native forms when you pass `name`, or when they are required (their own `required`, or a required `Field`): `Checkbox`, `Switch`, `RadioGroup`, `Rating`, `SpinButton`, `SwatchPicker`, `ColorPicker`, `Combobox`, `Dropdown`, `TagPicker`, `DatePicker` (ISO `yyyy-mm-dd`) and `TimePicker` (`HH:mm`) render a hidden input, honour `required` and `form`, and reset with their form. `SearchBox` submits through its own `<input name>` and resets with its form too. No name is generated for you.

### Value callbacks

`onChange` is the native DOM change event (`Input`, `Textarea`, `Select`, `Slider`). State callbacks are named after the state and receive the value:

| State                          | Props                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| single value                   | `value` / `defaultValue` / `onValueChange(value)`                                          |
| checked                        | `checked` / `defaultChecked` / `onCheckedChange(checked)`                                  |
| open                           | `open` / `defaultOpen` / `onOpenChange(open)`                                              |
| checked values (Menu, Toolbar) | `checkedValues` / `defaultCheckedValues` / `onCheckedValuesChange(checkedValues, details)` |

Extra data goes in a second, optional `details` argument: Dialog and Drawer call `onOpenChange(open, details)` with `details.reason` and `details.event` (see [Dialogs and triggers](#dialogs-and-triggers)), and Menu and Toolbar call `onCheckedValuesChange(checkedValues, details)` with `details.name`, `details.checkedItems` (the group's new values) and `details.event` (see [Menus](#menus)). These fire only when the value changes. Event callbacks such as `onPageChange`, `onStepChange` and `Tree`'s `onItemSelect` fire on every activation, also when the current item is activated again. Array props that Wave only reads (`openItems`, `expandedItems`, `selectedItems`, `columns`, `options`, `items`, `steps`, …) accept readonly arrays such as `as const` values; the callbacks receive a new, mutable array. The 0.4 names still work as deprecated aliases that warn once in development; see the [CHANGELOG](CHANGELOG.md) for the full table.

### Composite controls

Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker and TimePicker render a wrapper around their focusable element. `id`, the naming and validation ARIA attributes (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`; on Checkbox and Switch also `aria-disabled`), `tabIndex`, `autoFocus`, focus and key handlers (and native input attributes for text fields) go to the focusable element; `className`, `style`, `hidden`, `data-*`, other `aria-*` attributes and `ref` stay on the wrapper. `controlRef` gives you the focusable element. SearchBox and SpinButton draw their field (border, background, focus and invalid look) on that wrapper, so `className`, `style` and `hidden` size, style and hide the visible field, as on Input's slot wrapper.

`Input` with `contentBefore`/`contentAfter` content also renders a bordered wrapper `<span>`, which receives `className`, `style` and `hidden` (so they size and hide the visible field); unlike the controls above, `ref`, `id`, `aria-*` and `data-*` stay on the `<input>`.

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
- **Exit motion.** A `Menu.Popover` stays mounted while an exit motion of yours runs, with `data-presence="exiting"`, `data-state="closed"` and `inert`; focus is already back and Escape already reaches the next layer. Style it with the presence attributes (Tailwind path): `<Menu.Popover className="transition-opacity duration-wave-fast data-[presence=exiting]:opacity-0 motion-reduce:transition-none">`. Without such classes it unmounts at once. See [Enter and exit motion](#enter-and-exit-motion).

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

- `Dialog.Trigger`, `Drawer.Trigger`, `Popover.Trigger` and `Menu.Trigger` merge their props onto their single child (no wrapper element; a Fragment around one element counts as that element) or pass them to a render-prop child. `asChild={false}` renders the 0.4 wrapper `<span>`; a custom child that neither forwards `ref` nor spreads its props, and text or several children, fall back to that span automatically, with a development warning. The span keeps the trigger's other props, but `aria-haspopup`, `aria-expanded` and `aria-controls` go to the first element in the tab order inside it (after mount), so a button there is announced as opening the popup, and Menu, Popover, Dialog and Drawer return focus to that element (to the span only when nothing inside it can take focus). A span you made the trigger itself, with a `role` such as `button` and `tabIndex={0}`, keeps them and takes focus back; `tabIndex` alone leaves the span generic, so it never carries them. With `openOnContext` (Menu, Popover) the child is a context-menu region, not a popup button: it receives your forwarded props and, of the trigger's own, only its id, ref and context-gesture handlers (no state ARIA, no click toggle).
- Render `Dialog.Footer` **inside** `Dialog.Content`, one per content. It stays in view: it sticks to the bottom of the scrolling body with an opaque background, and the body reserves its height as scroll padding, so a focused field is never hidden behind it. It keeps its place in the DOM; inside a `<form>` that wraps the fields and the footer, make it the form's last child. Inside a Drawer, `Dialog.Footer` does not stick: it is an action row at the end of the content.
- Dialog and Drawer trap focus, close on Escape and a backdrop press, lock page scroll and make the rest of the page `inert` while open (toasts and live regions stay available). A backdrop press blurs the focused field before the surface closes, so a typed value (a SpinButton's, a picker's) is committed as with the Close button. When the press does not close the surface (an alert dialog, or a controlled one that refuses `outside-press`), focus ends up where it was.
- **Alert dialogs.** `modalType="alert"` is for a confirmation that needs an answer: the content is `role="alertdialog"`, and a backdrop press does not close it (Escape, the Close button and `Dialog.Close` still do). Initial focus goes to the first focusable element, the built-in Close button; the order of your buttons does not change that, so give the least destructive action `autoFocus` to start there, as above.
- **Why it opens or closes.** `onOpenChange(open, details)` gets `details.reason` (`'trigger'`, `'close'` for a `.Close` part, `'close-button'` for the built-in Close button, `'escape'`, `'outside-press'` for the backdrop) and `details.event`, the DOM event. A controlled dialog or drawer can refuse some of them (below). `details` is typed optional until 1.0, when it becomes required: read it as `details?.reason`. A render-prop trigger or close part that calls `onClick()` without its event reports a new `click` event with no target, so pass the event on.
- On close, focus goes to `finalFocusRef` when you pass one. Otherwise it returns to the element that had focus when the modal opened (a trigger's wrapper span resolves to the element inside it, see the trigger bullet above): the trigger for a trigger click, but also the parent's own button of a controlled Dialog, or a text field that had focus when a keyboard shortcut opened it. When nothing had focus (a modal opened from code, or a click in Safari, which does not focus the clicked button), it goes to the trigger that opened the modal, else the first mounted trigger. When that element is gone, focus falls back to a mounted trigger, then to an element next to where the opener was (the next row's action after a delete), then to the overlay below.
- An `autoFocus` element inside a Dialog or Drawer keeps focus, also in a dialog opened over another one or nested in its content, and in a `Popover.Content` opened from a dialog. `Dialog.Content` and `Drawer` take `closeLabel` (default `'Close'`) to localize the Close button's name.

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
- **`target`** on the Popover root (next to `side` and `align`; `PopupTarget`, as on `Menu.Popover`) places the content at an element held in state or at a `VirtualElement` instead of the trigger. A controlled popover with a `target` needs no trigger; a toggle button used as the target carries its own `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls` (give `Popover.Content` an `id`), a press on it does not count as outside, and Tab from it enters the content. TeachingPopover's `target` takes an element or a ref instead (it takes no `VirtualElement`, and Menu and Popover take no ref); a later release unifies them.
- **Tooltip timing.** `openDelay` (default 200ms) is how long the pointer rests on the child, or the child has keyboard focus, before the tooltip appears: unlike Menu's and Popover's `openDelay`, it applies to focus too. `closeDelay` (default 100ms) is how long it stays once the pointer has left the child and the tooltip; blur and Escape hide it at once. `delay` is the deprecated name of `openDelay` (it warns once in development).

### Enter and exit motion

Motion tokens are CSS variables on `:root`, the same in every theme: `--wave-duration-ultra-fast` (50ms), `-faster` (100ms), `-fast` (150ms), `-normal` (200ms), `-gentle` (250ms), `-slow` (300ms), `-slower` (400ms), `-ultra-slow` (500ms), and the curves `--wave-curve-accelerate-max`, `-accelerate-mid`, `-accelerate-min`, `-decelerate-max`, `-decelerate-mid`, `-decelerate-min`, `-easy-ease-max`, `-easy-ease` and `-linear`, with the values of Fluent's motion tokens (the guide's "Motion & Animation" chapter lists them). On the Tailwind path they are the utilities `duration-wave-*` and `ease-wave-*`; the precompiled `./styles` contains only the utilities Wave itself uses, so there use the variables in your own CSS.

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
- **Browser support.** `starting:` needs `@starting-style` (Chrome and Edge 117+, Safari 17.5+, Firefox 129+); older browsers show the element at once, without its enter motion, and the exit still runs.
- `Menu.Popover` mounts through the presence core, so a menu takes exit classes too (see [Menus](#menus)). An enter class for a menu takes the same gate; a menu that is open when it mounts (`defaultOpen`) mounts `entered`, so it does not animate that first time. The other overlays get their motion in a later release.

### Toasts

Wrap the app (or the part that shows toasts) in `<Toaster>`; `useToastController()` throws in development outside it.

```tsx
import { Button, Toaster, useToastController } from '@mortenbrudvik/waveui';

function SaveButton() {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast({ status: 'success', title: 'Saved', body: 'Your changes are saved.' })
      }
    >
      Save
    </Button>
  );
}

export function App() {
  return (
    <Toaster position="bottom-end">
      <SaveButton />
    </Toaster>
  );
}
```

`dispatchToast` returns the toast id; `dismissToast(id)` removes it. Toast timers pause while a toast is hovered or focused and while the page is in the background (the window has lost focus, or the tab is hidden, also when the Toaster mounted there). Toasts stay reachable by Tab over an open Dialog and are announced through permanent live regions. `statusLabel` and `dismissLabel` (options of `dispatchToast`, and props of `<Toast>`) translate the hidden status text and the dismiss button's name.

- **`limit`** caps how many toasts show at once (`<Toaster limit={3}>`). Further toasts wait in a queue, in dispatch order, and appear as shown toasts go; a waiting toast is not announced and its timer does not run until it shows. Lowering the limit never hides a shown toast. A value below 1 counts as 1 (with a development warning), and a fraction rounds down. Dispatching the id of a waiting toast again replaces its options and keeps its place; `dismissToast(id)` removes a waiting toast silently.
- **`dismissAllToasts()`** (from `useToastController()`) removes every toast, shown and waiting, and cancels their timers. When focus was in a toast, it returns to the element that had it before.

### Badges

- `color` takes `brand` (the default), `danger`, `important`, `informative`, `severe`, `subtle`, `success` and `warning`, with `appearance` `filled` (the default), `tint` or `outline`. `severe` is dark orange; `subtle` is the page background with foreground text, for a badge on a colored surface. CounterBadge takes the same palette (`<CounterBadge count={3} color="danger" />`), and `dot` makes it a small dot without a number. A dot keeps 3:1 against the page: the `informative` and `warning` dots are darker than those counts, and `subtle` is for dots on colored surfaces.
- **`important` changes in 1.0.** Through 0.x it renders the orange severe colors, as in 0.5. In 1.0 it becomes Fluent's neutral high-emphasis color (near black in the light theme): use `color="severe"` to keep the orange look.
- A badge whose text alone does not say what it means ("3") can be named: with `aria-label` or `aria-labelledby` a Badge or CounterBadge gets `role="img"`, so the name is announced (a `role` you pass wins; an empty or whitespace-only name counts as absent). `<CounterBadge dot aria-label="Unread messages" />` is a named unread dot.
- The root carries `data-color` and `data-appearance` with the resolved values (and `data-dot` on a dot), for your own selectors.

### Tags

A tag cannot keep focus once you remove it. When `onDismiss` removes a tag, first move focus to the next tag's dismiss button, else the previous one, else a nearby control (a "Reset filters" or "Add" button), and then remove the tag: the neighbour is still mounted, so focus never falls to the page. TagGroup (planned) will do this for you. The `FilterGroup` story in `stories/Tag.stories.tsx` is the reference:

```tsx
import * as React from 'react';
import { Button, Tag } from '@mortenbrudvik/waveui';

const ALL_FILTERS = ['Red', 'Blue', 'Large'];

export function Filters() {
  const [filters, setFilters] = React.useState(ALL_FILTERS);
  const tags = React.useRef(new Map<string, HTMLElement>());
  const reset = React.useRef<HTMLButtonElement>(null);

  const dismiss = (filter: string) => {
    const index = filters.indexOf(filter);
    const neighbour = filters[index + 1] ?? filters[index - 1];
    // The dismiss button is the tag's only button.
    const target =
      neighbour === undefined
        ? reset.current
        : tags.current.get(neighbour)?.querySelector('button');
    target?.focus();
    setFilters((current) => current.filter((f) => f !== filter));
  };

  return (
    <div>
      <div role="group" aria-label="Active filters">
        {filters.map((filter) => (
          <Tag
            key={filter}
            dismissible
            dismissLabel="Remove"
            ref={(element) => {
              if (element) tags.current.set(filter, element);
              return () => {
                tags.current.delete(filter);
              };
            }}
            onDismiss={() => dismiss(filter)}
          >
            {filter}
          </Tag>
        ))}
      </div>
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

### Sorting and selecting in a DataGrid

Sorting is controlled: the grid reports the requested sort and **you reorder the rows**.

```tsx
import * as React from 'react';
import { DataGrid } from '@mortenbrudvik/waveui';
import type { DataGridColumn, DataGridSort } from '@mortenbrudvik/waveui';

interface Person {
  id: string;
  name: string;
  role: string;
}

const columns: DataGridColumn[] = [
  { id: 'name', label: 'Name', sortable: true },
  { id: 'role', label: 'Role' },
];

export function People({ people }: { people: Person[] }) {
  const [sort, setSort] = React.useState<DataGridSort | null>(null);
  const rows = React.useMemo(() => {
    if (!sort) return people;
    const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
    return sort.direction === 'ascending' ? sorted : sorted.reverse();
  }, [people, sort]);

  return (
    <DataGrid
      aria-label="People"
      columns={columns}
      sort={sort}
      onSortChange={setSort}
      selectionMode="multiple"
    >
      <DataGrid.Body>
        {rows.map((person) => (
          <DataGrid.Row key={person.id} rowId={person.id}>
            <DataGrid.Cell>{person.name}</DataGrid.Cell>
            <DataGrid.Cell>{person.role}</DataGrid.Cell>
          </DataGrid.Row>
        ))}
      </DataGrid.Body>
    </DataGrid>
  );
}
```

Row selection: with `selectionMode="single"`, pass at most one id in `selectedItems`/`defaultSelectedItems` (with several, the first one whose row is rendered is selected, with a development warning). Each row's selection control is named after the row's first `DataGrid.Cell`, `<td>` or `<th>` child (Fragments are looked into); a cell rendered by another component is not seen, so pass `selectionLabel` to `DataGrid.Row` then.

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

Icon slots are decorative (`aria-hidden`). Content that renders nothing (`''`, `[]`, `<></>`, or a collection of only `null`, booleans and `''`) counts as no content: a `contentAfter` that renders nothing takes no room, and SearchBox's `contentBefore` keeps the default search icon. The dismiss and clear slots of `MessageBar`, `SearchBox` and `Tag` render their content inside the component's own button; the 0.4 form that passed a button object is deprecated. A Wave `Button` passed there is merged into that button, and its own props never reach the DOM: its `icon` and `iconPosition` place the icon, and `disabledFocusable` makes the built-in button unavailable but focusable. Content that renders nothing keeps the default icon, and a slot object without children (`{ className: 'text-error' }`) wraps it. A slot object that renders a component or a void element (`{ as: CloseIcon }`, `{ as: 'img', src, alt: '' }`) or sets `dangerouslySetInnerHTML` is the icon itself. On `MessageBar`, `dismiss={null}` is the only value that hides the dismiss button (a boolean counts as no slot).

Slots that replace a built-in glyph follow one rule per kind:

- **Optional indicators** (`MenuButton.menuIcon`, the `expandIcon` of Combobox and TimePicker): `null` or `undefined` keep the default glyph; `false` or any value that renders nothing hides it (for `expandIcon`, the whole expand button).
- **Required indicators** (`SplitButton.menuIcon`): the indicator always shows. A value that renders nothing keeps the default glyph, with a development warning.
- **Status icons** (`MessageBar.icon`, Field `validationMessageIcon`): only `undefined` keeps the default icon; `null` or a value that renders nothing shows none.
- A glyph slot inside a built-in button (`expandIcon`, and the `menuIcon` of SplitButton and MenuButton) is decorative content. A `<button>` or `Button` passed there, or a slot object whose `as` is one, is not nested: its children become the glyph and its props are dropped, with a development warning.

### Built-in text

The names and hidden texts that components render themselves are English by default. These props translate them:

| Component                   | Props                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog.Content`, `Drawer`  | `closeLabel` (the Close button)                                                                                                                                  |
| `TeachingPopover`           | `closeLabel` (the Close button), `labels` (`back`, `next`, `done`, `step(index, count)` with a zero-based index)                                                 |
| `MessageBar`, `Toast`       | `statusLabel` (the hidden severity text); `Toast` also `dismissLabel` (also options of `dispatchToast`)                                                          |
| `Tag`                       | `dismissLabel`                                                                                                                                                   |
| `Carousel`                  | `labels` (`previous`, `next`, `picker`, `slide(index, total)` with a zero-based index, `carouselRoleDescription`, `slideRoleDescription`), `autoPlayLabels`      |
| `Stepper`                   | `statusLabels` (`completed`, `error`; `''` omits the text)                                                                                                       |
| `Pagination`                | `getItemAriaLabel(type, page, selected)`                                                                                                                         |
| `ColorPicker`               | `labels`                                                                                                                                                         |
| `Combobox`                  | `labels` (`noMatches`, `clear` (the clear button), `expand` (the chevron button))                                                                                |
| `Dropdown`                  | `labels` (`clear`, the clear button)                                                                                                                             |
| `DatePicker`                | `labels` (`clear`, `openCalendar`, `previousMonth`, `nextMonth`, and the error texts `invalidDate(pattern)`, `outOfRange(min, max)`, `unavailableDate`)          |
| `TimePicker`                | `labels` (`clear`, `expand`, `list`, `noTimes`, `noMatches`, and the error texts `invalidTime(format)`, `outOfRange(min, max)`)                                  |
| `TagPicker`                 | `labels` (`remove(label)`, `selected`, `summary(labels)`, `added(label, count)`, `removed(label, count)`, `noMatches`)                                           |
| `Rating`                    | `labels` (`star(value, max)`)                                                                                                                                    |
| `RatingDisplay`             | `labels` (`rating(value, max, formattedValue)`, `count(count, formattedCount)`); `locale` formats the value and the count (pass it when rendering on the server) |
| `SpinButton`                | `labels` (`increment`, `decrement`)                                                                                                                              |
| `DataGrid`                  | `labels` (`selectAll`, `selectionHeader`); each row's fallback name "Select row": `DataGrid.Row` `selectionLabel`                                                |
| `AvatarGroup`               | `overflowLabel`, `unnamedMemberLabel`                                                                                                                            |
| `InfoLabel`, `SplitButton`  | `infoButtonLabel`, `menuButtonLabel`                                                                                                                             |
| `Spinner`, `Skeleton.Group` | `label`                                                                                                                                                          |

Without a text prop, these defaults are replaced through `aria-label`: the PresenceBadge status names ("Available", …: `aria-label` on the badge), the MessageBar "Dismiss" and SearchBox "Clear search" button names (`dismiss={{ 'aria-label': 'Lukk' }}`, which keeps the default icon), and the names of the Breadcrumb, Pagination, Nav, Stepper, Carousel and Toaster regions ("Breadcrumb", "Pagination", "Navigation", "Progress", "Carousel", "Notifications"). The placeholders of Dropdown, DatePicker, TimePicker and SearchBox are `placeholder` props, and ColorPicker's default presets are replaced through `presets`.

0.7 adds no built-in text: the submenu half of a `Menu.SplitGroup`, a context menu (`Menu.Popover`) and a `Toolbar.RadioGroup` are named by the `aria-label` you pass.

## Keyboard support

As implemented in 0.7. Buttons, links, checkboxes, switches and the trigger buttons of Accordion, Carousel, Nav, Breadcrumb and Pagination are native elements: Tab to reach them, Enter or Space to activate. A Link or `Button as="a"` without `href`, and a Button or Link rendered as a `div` or `span`, are buttons: Tab reaches them, Enter (key down) and Space (key up) activate them. A `disabledFocusable` control stays in the Tab order but Enter, Space and clicks do nothing.

| Component                       | Keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar                         | One Tab stop (the last focused control; focusing a nested composite, such as a radio group or tab list, or a text field, select, slider or spin button keeps it where it was). Left/Right (Up/Down when vertical) move and wrap, Home/End jump; mirrored in RTL; natively disabled controls and controls hidden with CSS are skipped, while `disabledFocusable` controls stay reachable (a Tooltip on them opens on focus). Text fields, selects, sliders, spin buttons and editable comboboxes keep their own arrow keys; a Dropdown keeps Up/Down, Home and End for its list, but Left/Right move past it. A nested composite keeps its own Tab stop and arrow keys; a `Toolbar.RadioGroup` is none: its radios are part of the arrow order, and Up/Down (Left/Right when vertical, mirrored in RTL) also move among them, wrapping inside the group. The arrows never press a toggle or check a radio: Space and Enter do.                                                                                                                                    |
| RadioGroup, SwatchPicker        | One Tab stop. All four arrows move and select (wrapping), Home/End jump; Left/Right mirrored in RTL. Keys pressed on a link inside a radio's label stay the link's.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Rating                          | Right/Up one star more, Left/Down one fewer (never below 1), Home/End first/last; mirrored in RTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| TabList                         | One Tab stop (the selected tab). Left/Right (Up/Down when vertical) move and select, Home/End; with `selectTabOnFocus={false}` they only move focus, and Enter or Space selects the focused tab; disabled tabs skipped; mirrored in RTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Tree                            | One Tab stop. Up/Down, Home/End; Right expands or moves to the first child, Left collapses or moves to the parent (mirrored in RTL); Enter/Space activate; `*` expands siblings; type to jump (a Space within 500 ms of a letter continues the search).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| List (selectable)               | One Tab stop. Up/Down (wrapping), Home/End, Enter/Space toggle, typeahead above 7 items (a Space within 500 ms of a letter continues the search). With item actions (grid): Up/Down between rows, Left/Right into the actions, Enter/F2 into a text field, Escape back.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| DataGrid                        | One Tab stop. Arrows between cells (Left/Right to the previous/next cell of the row, mirrored in RTL; Up/Down and PageUp/PageDown keep the visual column across `colSpan`/`rowSpan` cells of grouped headers), Home/End row start/end, Ctrl+Home/Ctrl+End grid start/end, PageUp/PageDown 10 rows; Enter/F2 into a cell's widgets, Escape back; Space on a cell toggles its row's selection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Menu                            | Trigger: Enter/Space/Down open and focus the first item, Up opens on the last; a trigger with `aria-disabled="true"` (a `disabledFocusable` MenuButton or SplitButton) ignores them and its click. Menu: Up/Down (wrapping), Home/End, typeahead, Enter/Space activate (a Space within 500 ms of a letter continues the search); on a checkbox, radio or switch item Space changes it and keeps the menu open, Enter changes it and closes a popup menu; on `Menu.ItemLink` Enter is the browser's link activation. A submenu's item: Right (Left in RTL), Enter and Space open the submenu and focus its first item; in a submenu Left (Right in RTL) and Escape close only it and return focus to its item. `Menu.SplitGroup`: Right (Left in RTL) moves from the action to the submenu button, Left back. Escape closes and returns focus, Tab closes every level. Context menu (`openOnContext`): Shift+F10 or the ContextMenu key on the region opens it at the focused element; Escape and item activation return focus there, and Tab moves on from it.   |
| Combobox, TagPicker, TimePicker | Down/Up open and move, Alt+Down opens, typing makes the first match active (not in a `freeform` Combobox), Enter commits the active option (with no active option, Enter submits the form; TimePicker instead never submits while its text is edited: a complete time within the bounds is committed, erased text clears the value, other text is kept and flagged invalid, and the list closes; leaving the input with edited text settles it the same way and closes the list), Alt+Up and Tab close, Escape closes and then discards typed text. The chevron button (Combobox, TimePicker) is not a Tab stop; the clear button (`clearable`) is a Tab stop after the input. Tab from erased TimePicker text clears the value first, so focus moves past the clear button that goes with it. TagPicker: Backspace in the empty input focuses the last tag, Backspace/Delete removes it.                                                                                                                                                                        |
| Dropdown                        | Down/Up/Home/End and typing open and move, PageUp/PageDown move by 10, Enter/Space commit (a Space within 500 ms of a letter continues the search), Alt+Up and Tab commit and close, Escape closes. The clear button (`clearable`) is a Tab stop after the combobox button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| SpinButton                      | Up/Down step, PageUp/PageDown large step, Home/End jump to a finite min/max (otherwise they move the caret); Enter commits typed text, Escape reverts it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| SearchBox                       | Escape clears the text and keeps focus (the key is consumed, so an enclosing Dialog, Drawer or Popover stays open); in an empty field Escape reaches the enclosing overlay.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| DatePicker                      | Alt+Down opens the calendar. The clear button (`clearable`) is a Tab stop between the input and the calendar button; Tab from erased text clears the value first and moves on to the calendar button. Calendar: arrows by day/week (mirrored in RTL), PageUp/PageDown by month, Shift+PageUp/PageDown by year, Home/End week start/end, Enter/Space select, Escape closes; Tab stays inside.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Dialog, Drawer                  | Focus is trapped; Escape closes; focus returns to the first of these that can take focus: `finalFocusRef`, the element that had focus when the modal opened (a trigger's wrapper span resolves to the element inside it), the trigger, an element next to where that opener was.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Popover, TeachingPopover        | Escape closes. When focus was inside (or lost to `<body>`), Popover returns it to its trigger, TeachingPopover to where focus was before it opened; a close by hover moves no focus. In the Tab order the content follows its trigger (TeachingPopover with `target`: the target): Tab from the trigger enters it, Tab past its end continues after the trigger, Shift+Tab from the element after the trigger enters it at its last element. For a trigger outside the tab order it follows the tab stop before the trigger; with no tab stop before the trigger or target, it is reached at the end of the page. A Tab lap visits it once: Tab from the last element of the page leaves the page, and Shift+Tab from outside the page reaches the page's last element. Focus leaving it does not close it. A context popover (`openOnContext`): Shift+F10 or the ContextMenu key on the region opens it and moves focus into the content, and Escape returns focus to the element that had it; opened by a right click, it is reached by Tab from that element. |
| Tooltip, InfoLabel              | Open on keyboard focus (Tooltip after `openDelay`); Escape closes. InfoLabel: click pins it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Card (selectable)               | With the default `selectionControl="card"`: Enter (key down) or Space (key up) selects. With `"checkbox"`: the built-in checkbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Stepper                         | Each reachable step is a Tab stop; Enter/Space activate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Slider                          | Native range keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Accordion and Carousel have no arrow-key navigation: their triggers and controls are Tab stops.

Typeahead (Menu, selectable List, Tree, Dropdown) accepts characters typed with AltGr, which Windows reports as Ctrl+Alt (Polish `ł`, Romanian `ș`); Ctrl+Alt with an arrow, Home, End or Space is left to the browser. An item that cannot take focus is passed over for the next match. Menu typeahead matches the item labels, not icons or shortcuts. Options and option groups with `hidden` are skipped like a native `<option hidden>`.

## Hooks and utilities

| Export                                                                          | Purpose                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useControllable(value, defaultValue, onChange)`                                | Controlled/uncontrolled state; returns `[value, setValue, isControlled]`; `setValue` accepts a value or an updater and skips no-op updates.                                                                                                  |
| `useRovingTabIndex(options)`                                                    | Roving tab stop and arrow-key navigation for composite widgets; items marked `data-disabled-focusable` stay reachable, and a composite marked `data-roving-transparent` (a toolbar radio group) adds its items to the enclosing arrow order. |
| `useId(prefix?)`                                                                | SSR-safe ids (`prefix-<react id>`; never parse the React part).                                                                                                                                                                              |
| `useEventCallback(fn)`                                                          | Stable callback that always calls the latest `fn`.                                                                                                                                                                                           |
| `useMergedRefs(...refs)`                                                        | One stable callback ref for several refs.                                                                                                                                                                                                    |
| `useIsClient()`                                                                 | `false` on the server and during hydration.                                                                                                                                                                                                  |
| `usePresence(visible, options?)`, `<Presence visible>`                          | Mount and unmount an element with CSS enter and exit motion (`data-presence` phases; see [Enter and exit motion](#enter-and-exit-motion)).                                                                                                   |
| `useFieldControl(props, options?)`                                              | Merge a custom control's labelling props with the surrounding `Field` (its label, validation message, hint and state).                                                                                                                       |
| `useAnnounce()`, `announce(message, politeness?)`                               | Screen-reader announcements through a shared live region.                                                                                                                                                                                    |
| `useWaveTheme()`                                                                | Current theme, direction and portal container.                                                                                                                                                                                               |
| `useToastController()`                                                          | `dispatchToast` / `dismissToast` / `dismissAllToasts` inside `<Toaster>`.                                                                                                                                                                    |
| `useIsOverflowing(target)`, `useOverflowMenu()`, `useIsOverflowItemVisible(id)` | Overflow detection.                                                                                                                                                                                                                          |
| `cn(...classes)`                                                                | clsx + tailwind-merge that knows Wave's type ramp and shadows; the last class wins over a conflicting class of the same variant.                                                                                                             |
| `composeEventHandlers(theirs, ours)`                                            | Run a consumer handler, then yours unless it called `preventDefault()`.                                                                                                                                                                      |
| `mergeRefs(...refs)`                                                            | Merge refs outside components.                                                                                                                                                                                                               |
| `resolveSlot`, `renderSlot`                                                     | The slot helpers the components use.                                                                                                                                                                                                         |
| `getThemeClassName(theme)`                                                      | The theme classes of a theme.                                                                                                                                                                                                                |

## Upgrading from 0.6

0.7 removes nothing public; these changes can still affect tests and styles:

1. Menu surfaces render `data-presence` next to `data-state`, and stay mounted (`data-state="closed"`, `inert`) while an exit motion of yours runs; without exit classes a menu still unmounts at once.
2. Menu items render a hidden placeholder before the label for each column they do not fill (the check column, the icon column), and a menu that mixes items with and without icons now lines the labels up.
3. Toolbar renders `data-size` and `data-orientation`, and `Toolbar` has static parts.
4. A ToggleButton with a checked `role` (`checkbox`, `radio`, `switch`, `menuitemcheckbox`, `menuitemradio`, `option`, `treeitem`) renders `aria-checked` instead of `aria-pressed`, and one with another role renders neither and warns; every pressed ToggleButton renders `data-pressed`.
5. Tooltip `delay` is deprecated: rename it to `openDelay` (it still works and warns once in development).
6. `Menu.Item` `persistOnClick` defaults to the Menu's new `persistOnItemClick` (`false`): no change unless you set it.
7. While focus is in a menu, the item under the mouse takes focus: a test that hovers an item and then presses Enter activates the hovered item.

The CHANGELOG's [0.7.0 "Changed" section](CHANGELOG.md#changed) lists every behaviour, DOM and type change.

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

The CHANGELOG's [0.6.0 "Changed" section](CHANGELOG.md#changed-1) lists every behaviour, DOM and type change.

## Upgrading from 0.4

1. The npm package name is unchanged (`@mortenbrudvik/waveui`, as in 0.4.0). Replace `waveui` imports copied from the 0.4 guide, and a git or local dependency named `waveui`, with `@mortenbrudvik/waveui`.
2. Styles: without Tailwind, keep `import '@mortenbrudvik/waveui/styles'` and make sure a `WaveProvider` wraps the app; with Tailwind 4, switch to `@import '@mortenbrudvik/waveui/tailwind';` after `@import 'tailwindcss';`. Import `preflight.css` if you relied on Wave's Preflight.
3. Rename CSS overrides of the 0.4 semantic variables (`--primary`, `--border`, …) to `--wave-*`. Code that reads 0.4 variables (`var(--primary)`, `var(--ring)`, `var(--brand-80)`, `var(--grey-14)`) must switch to the `--wave-*` names too: 0.5 no longer defines them. Until then, import `legacy-tokens.css`. Overrides of the ramp names (`--brand-*`, `--grey-*`) keep working without it.
4. A required `Field` now turns on native constraint validation for the control inside it, including Checkbox, Switch and the other choice and picker controls (see [Forms and `Field`](#forms-and-field)). Add `noValidate` to forms that validate in their submit handler.
5. Replace deprecated props at your own pace; each warns once in development.

The [CHANGELOG](CHANGELOG.md) lists every change, including behaviour and DOM changes that can affect tests and styles.

## Development

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

## License

MIT
