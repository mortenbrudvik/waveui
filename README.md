# @mortenbrudvik/waveui

A React component library inspired by the Fluent UI 2 design language: 65 accessible, composable components built with TypeScript, Tailwind CSS 4 and CSS custom properties, with light, dark and high-contrast themes and right-to-left support.

> This is **not** Microsoft's official `@fluentui/react-components` package.

- [Requirements](#requirements) · [Installation](#installation) · [Quick start](#quick-start)
- [Styles](#styles) · [Theming](#theming) · [Global effects](#global-effects)
- [React Server Components](#react-server-components) · [Components](#components) · [Usage notes](#usage-notes)
- [Keyboard support](#keyboard-support) · [Hooks and utilities](#hooks-and-utilities) · [Upgrading from 0.4](#upgrading-from-04) · [Development](#development)

## Requirements

- React 19 (`react` and `react-dom` `^19.0.0`)
- Tailwind CSS `^4.1.0` only if you use the [Tailwind path](#tailwind-css-4); the precompiled stylesheet needs no Tailwind
- Browsers: Chrome/Edge 111+, Safari 16.4+, Firefox 128+ (the CSS uses `@property`, `color-mix()` and `:where()`)
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
| `@mortenbrudvik/waveui/tailwind` (also `/tailwind.css`) | Tailwind 4 source entry: tokens in `layer(theme)`, base in `layer(base)`, `@source` for the components. Import it after `@import 'tailwindcss'`.                                                                                                                                                                            |
| `@mortenbrudvik/waveui/tokens` (also `/tokens.css`)     | The token source alone (`--wave-*` variables, theme classes and the `@theme inline` mapping), without base styles or `@source`. For custom Tailwind setups; `./tailwind` is the complete Tailwind entry.                                                                                                                    |
| `@mortenbrudvik/waveui/preflight.css`                   | Opt-in Tailwind Preflight for the **whole page** (unlayered). Wave does not need it.                                                                                                                                                                                                                                        |
| `@mortenbrudvik/waveui/legacy-tokens.css`               | Deprecated 0.4 compatibility layer (see [Theming](#theming)).                                                                                                                                                                                                                                                               |

**Cascade.** `./styles` is unlayered on purpose: unlayered CSS beats any layered CSS, and Wave's class selectors beat element-level resets such as `*{padding:0}` or `button{background:none}`, so ordinary app resets cannot strip the components. To put Wave inside your own layer order, import it into a layer yourself. Unlayered app CSS (including resets) then wins over it:

```css
@import '@mortenbrudvik/waveui/styles.css' layer(wave);
```

The other side of this: **layered** app CSS, such as a Tailwind build's utilities, loses to the unlayered `./styles` whatever its specificity, so inside `WaveProvider` Wave's zero-specificity base styles override it. If your own CSS is layered, import Wave into a layer ordered before yours; [Global effects](#global-effects) has the recipe for an app with a prefixed Tailwind build.

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

Theme-independent variables on `:root`: `--wave-brand-10` … `--wave-brand-160` (also utilities such as `bg-brand-80`), `--wave-grey-2` … `--wave-grey-98`, `--wave-font-family` (utility `font-wave`) and the stacking layers `--wave-z-overlay` (1000), `--wave-z-toast` (1100) and `--wave-z-tooltip` (1200).

Contrast of every text and non-text pair is checked per theme by `src/styles/__tests__/tokens.test.ts`. One known limit: the `warning` fill (`#fde300` in light) is a background and accent color only; use `warning-tint-foreground` for warning text and icons.

Other Wave theme values: the type ramp `text-caption-2`, `text-caption-1`, `text-body-1`, `text-body-2`, `text-subtitle-2`, `text-subtitle-1`, `text-title-3`, `text-title-2`, `text-title-1`, `text-large-title`, `text-display`; shadows `shadow-2`, `shadow-4`, `shadow-8`, `shadow-16`, `shadow-28`, `shadow-64`; animations `animate-wave-spin`, `animate-wave-spin-slow`, `animate-wave-pulse`, `animate-wave-indeterminate`, `animate-wave-indeterminate-rtl`. Border radius uses Tailwind's default scale (Wave no longer overrides it).

## Global effects

What adding Wave changes outside its own components:

- **Variables.** `--wave-*` custom properties on `:root` and on the theme classes (`.wave-light`, `.wave-dark`, `.wave-high-contrast`, and the deprecated `.dark` and `.high-contrast`). No unprefixed variables are defined.
- **Base styles and reset, provider-scoped.** They apply inside `.wave-root` (WaveProvider) and `.wave-portal` (overlay wrappers) only, and your own content inside the provider receives them too:
  - Two root rules are plain class selectors (specificity 0,1,0): `.wave-root, .wave-portal` set the font family, text color, 14px font size and 20px line height, and `.wave-root` sets the background color. Override them with a class selector loaded after Wave's CSS, or with the provider's `className`.
  - Every other selector is wrapped in `:where()` (zero specificity), so any unlayered style of yours wins, except the descendant `::before`/`::after` selectors of the box-sizing rule. Pseudo-elements cannot sit inside `:where()` (the selector would be dropped), so those two are specificity (0, 0, 1): an author `::before` or `::after` of the same specificity wins or loses by source order, and any more specific one (a class, attribute, ID or type selector before the pseudo-element) wins. Layered CSS, such as Tailwind utilities, loses to the unlayered `./styles` whatever its specificity, unless you import `./styles` into a layer (see [Cascade](#styles) and the workarounds below). These rules set `box-sizing: border-box` and `border-color: var(--wave-border)` on every descendant (and its `::before`/`::after`), reset the native elements Wave renders (`button`, `input`, `select`, `textarea`, lists, headings, `p`, `figure`, `blockquote`, `dl`, `dd`, `fieldset`, `legend`, `table`, `hr`), set `vertical-align: middle` on `img`, `svg` and `video`, and give `button` and `[role=button]` a pointer cursor.
  - This is not a subset of Tailwind's Preflight: Preflight leaves borders `currentColor` and buttons with the default cursor, while Wave uses its border token and a pointer.
  - On the Tailwind path all of them sit in `layer(base)`, so your utilities and unlayered CSS win over them.

  There are no `html` or `body` rules, no global reduced-motion override (each component handles reduced motion itself), and no Preflight unless you import it. The only global rule is Tailwind's `@layer properties` fallback in `./styles`: in browsers without `@property` support (detected by an `@supports` query) it sets the initial values of Tailwind's `--tw-*` custom properties on `*`, `::before`, `::after` and `::backdrop`, and nothing else. It is also the only layered block in that otherwise unlayered file.

- **Utility classes (`./styles`).** The precompiled stylesheet contains the Tailwind utilities the components use (`.flex`, `.p-4`, `.bg-primary`, …) as ordinary class selectors, unlayered, plus Tailwind's `@property --tw-*` registrations. An element of yours with the same class name gets the same style.
- **Theme (`./tailwind`).** Wave adds its color names, `font-wave`, the type ramp, the shadow scale and the `animate-wave-*` animations to your Tailwind theme.

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
- Event handlers and other functions cannot be passed from a Server Component; put interactive parts in a `'use client'` component.

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

| Compound     | Flat names                                                                            |
| ------------ | ------------------------------------------------------------------------------------- |
| `Accordion`  | `AccordionItem`, `AccordionTrigger`, `AccordionPanel`                                 |
| `Breadcrumb` | `BreadcrumbItem`                                                                      |
| `Card`       | `CardHeader`, `CardBody`, `CardFooter`                                                |
| `Carousel`   | `CarouselItem`                                                                        |
| `Combobox`   | `ComboboxOption`, `ComboboxOptionGroup` (also `Option`, `OptionGroup`)                |
| `DataGrid`   | `DataGridHeader`, `DataGridHeaderCell`, `DataGridBody`, `DataGridRow`, `DataGridCell` |
| `Dialog`     | `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogFooter`, `DialogClose`        |
| `Drawer`     | `DrawerTrigger`, `DrawerTitle`, `DrawerClose`                                         |
| `Dropdown`   | `DropdownOption`, `DropdownOptionGroup`                                               |
| `List`       | `ListItem`                                                                            |
| `Menu`       | `MenuTrigger`, `MenuPopover`, `MenuItem`, `MenuDivider`                               |
| `Nav`        | `NavCategory`, `NavItem`, `NavSubItem`                                                |
| `Overflow`   | `OverflowItem`                                                                        |
| `Popover`    | `PopoverTrigger`, `PopoverContent`                                                    |
| `RadioGroup` | `RadioGroupItem` (also `RadioItem`)                                                   |
| `Skeleton`   | `SkeletonGroup`                                                                       |
| `Stepper`    | `StepperStep`                                                                         |
| `TabList`    | `TabListTab`, `TabListPanel`, `TabListPanels`                                         |
| `Table`      | `TableHeader`, `TableHeaderCell`, `TableBody`, `TableRow`, `TableCell`                |
| `Tree`       | `TreeItem`                                                                            |

## Components

65 components, plus the `Portal` utility. Every component accepts `ref` as a prop (React 19), a `className`, and the native attributes of its element. Storybook (`npm run dev`) shows every component with its props, states and themes.

Your `className` is merged last with `cn()`, so it replaces a conflicting class **of the same variant**: `bg-error` replaces a resting `bg-primary`. A class behind a variant is replaced only by a class with the same variant. That matters for the gated hover and pressed classes (`not-disabled:not-aria-disabled:hover:…` / `…:active:…`) and the state classes (`data-[selected]:…`, `aria-disabled:…`): they stay next to yours and win while their state applies, because they are more specific. A bare `hover:bg-error` therefore does not override a Button's built-in hover color while the Button is enabled. It still paints on hover while the Button is disabled or `aria-disabled`, and on `appearance="transparent"`, which has no hover background. To override the gated and state classes, use the same prefix (`not-disabled:not-aria-disabled:hover:bg-error`, `data-[selected]:bg-error`) or the important modifier (`hover:bg-error!`); see [Buttons](#buttons).

### Buttons and actions

| Component        | Description                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | `appearance` `primary`, `outline` (default), `subtle`, `transparent`; five sizes; decorative `icon` slot; `as` renders a link or router link with correctly typed props. `type="button"` by default. |
| `CompoundButton` | Button with a `secondaryText` line.                                                                                                                                                                  |
| `ToggleButton`   | Pressed/unpressed button (`pressed`, `defaultPressed`, `onPressedChange`; `aria-pressed`).                                                                                                           |
| `SplitButton`    | Primary action joined to a menu chevron; `menuButtonProps` takes `Menu.Trigger`'s render props; `menuButtonLabel` names the chevron.                                                                 |
| `MenuButton`     | Button with a chevron and `aria-haspopup="menu"`, for use inside `Menu.Trigger`.                                                                                                                     |
| `Link`           | `appearance` `inline` (always underlined), `standalone` or `subtle`; `disabled` removes the `href`; `as` renders router links.                                                                       |
| `Toolbar`        | `role="toolbar"` with one Tab stop and arrow-key navigation over any child controls; `orientation`.                                                                                                  |

### Inputs and forms

| Component      | Description                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Field`        | Label, hint, error and required indicator, wired to the control inside it (library controls read the Field context wherever they are in it).                                                                            |
| `Label`        | Form label with a decorative required asterisk, `size` and `weight`.                                                                                                                                                    |
| `Input`        | Text input with `contentBefore`/`contentAfter` slots, `onValueChange(value)` next to the native `onChange`, and an `error` message.                                                                                     |
| `Textarea`     | Multi-line text input with an `error` message.                                                                                                                                                                          |
| `Select`       | Styled native `<select>` with an `error` message.                                                                                                                                                                       |
| `Checkbox`     | `checked`/`defaultChecked`/`onCheckedChange`, `indeterminate`, native form support.                                                                                                                                     |
| `Switch`       | On/off toggle (`role="switch"`), `onCheckedChange`, native form support.                                                                                                                                                |
| `RadioGroup`   | Single choice with `RadioGroup.Item` items; `orientation`, `disabled`, `onValueChange`, native form support.                                                                                                            |
| `SearchBox`    | Search input with a clear button; `onValueChange`; input attributes go to the `<input>`.                                                                                                                                |
| `Slider`       | Styled native range input; `onValueChange(number)`.                                                                                                                                                                     |
| `SpinButton`   | Numeric input with step buttons; typed text is a draft committed on blur or Enter; `min`, `max`, `step`, `largeStep`.                                                                                                   |
| `Combobox`     | Editable combobox: typing filters the options; `freeform` makes the typed text the value. `Combobox.Option`, `Combobox.OptionGroup`.                                                                                    |
| `Dropdown`     | Select-only combobox (a button) with typeahead. `Dropdown.Option`, `Dropdown.OptionGroup`.                                                                                                                              |
| `TagPicker`    | Multi-select combobox that shows the selection as removable tags (a list named "Selected"); the input is described by a summary of the selection ("Selected: Apple, Banana"), and additions and removals are announced. |
| `DatePicker`   | Date input with a calendar dialog; locale-aware format and parse, `minDate`, `maxDate`, `disabledDates`, `onInvalidInput`.                                                                                              |
| `TimePicker`   | Time combobox (`12h`/`24h`, `step`, `minTime`, `maxTime`); value is `HH:mm`.                                                                                                                                            |
| `ColorPicker`  | Hex field, preset swatches and an optional opacity slider; value `#rrggbb` or `#rrggbbaa`.                                                                                                                              |
| `SwatchPicker` | Radio group of color swatches (`items` with a `label` each).                                                                                                                                                            |
| `Rating`       | Star rating (`role="radiogroup"`); `RatingDisplay` is the read-only version.                                                                                                                                            |

### Data display

| Component       | Description                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `Avatar`        | Image, initials or icon, with an image-failure fallback and an optional `badge`.               |
| `AvatarGroup`   | Overlapping avatars; `max` adds an overflow button that lists the hidden members.              |
| `Badge`         | Status or category label: `appearance` `filled`, `tint`, `outline`; semantic `color`.          |
| `CounterBadge`  | Count pill (`99+` above `overflowCount`).                                                      |
| `PresenceBadge` | Availability badge with a distinct shape per status.                                           |
| `Tag`           | Chip with an optional dismiss button (`dismissible`, `onDismiss`, `dismissLabel`).             |
| `InfoLabel`     | Label with an info button that shows extra text (a toggletip).                                 |
| `Persona`       | Avatar with name, secondary text and presence.                                                 |
| `Divider`       | Horizontal or vertical separator, optionally labelled.                                         |
| `Image`         | `<img>` with `fit`, `shape`, `shadow`, `bordered`; warns in development when `alt` is missing. |
| `List`          | Plain list, selectable listbox (single or multiple) or, with item `action`s, a grid.           |

### Typography

| Component | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `Text`    | Type-ramp text (`variant`, `weight`); polymorphic `as`; inherits its color. |

### Layout

| Component   | Description                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Card`      | Surface with `Card.Header`, `Card.Body`, `Card.Footer`; optionally selectable (`onSelect`, `selected`, `selectionControl`). |
| `Accordion` | Disclosure sections (`Accordion.Item`, `.Trigger`, `.Panel`); single (default) or `type="multiple"`; `headingLevel`.        |
| `TabList`   | Tabs with automatic activation (`TabList.Tab`, `.Panel`, `.Panels`); `orientation`.                                         |
| `Tree`      | Hierarchical tree (`Tree.Item`) with expand/collapse, selection and typeahead.                                              |
| `Carousel`  | One slide at a time with previous/next, a slide picker and optional auto-rotation with a pause control.                     |
| `Overflow`  | Hides items that do not fit in one row and renders an overflow button (`useOverflowMenu` lists the hidden items).           |
| `Grid`      | CSS grid with a column count and token gaps.                                                                                |
| `Stack`     | Vertical or horizontal stack (`orientation`, `gap`).                                                                        |
| `Flex`      | Flexbox container (`direction`, `wrap`, `align`, `justify`, `gap`).                                                         |

### Feedback

| Component     | Description                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `MessageBar`  | Inline status message (`info`, `success`, `warning`, `error`) with hidden status text and an optional dismiss button. |
| `ProgressBar` | Determinate or indeterminate progress; name it with `label`.                                                          |
| `Skeleton`    | Loading placeholder (`width`, `height`, `shape`); `Skeleton.Group` marks the loading region busy.                     |
| `Spinner`     | Loading indicator announced as "Loading" (localize with `label`).                                                     |
| `Toast`       | Notifications shown by `<Toaster>` through `useToastController()`.                                                    |

### Navigation

| Component    | Description                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| `Breadcrumb` | Trail of links, buttons or text (`Breadcrumb.Item`, `current`).                          |
| `Menu`       | Popup menu (`Menu.Trigger`, `Menu.Popover`) or static menu; `Menu.Item`, `Menu.Divider`. |
| `Nav`        | Side navigation with items, collapsible categories and sub-items; links or buttons.      |
| `Stepper`    | Multi-step progress (`Stepper.Step`), horizontal or vertical, optionally `linear`.       |
| `Pagination` | Page buttons with ellipses, previous/next and optional first/last.                       |

### Overlays

| Component         | Description                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Dialog`          | Modal dialog: `Dialog.Trigger`, `Dialog.Content`, `Dialog.Title`, `Dialog.Footer`, `Dialog.Close`.               |
| `Drawer`          | Modal side panel (`position` `start`, `end`, `left`, `right`); `Drawer.Trigger`, `Drawer.Title`, `Drawer.Close`. |
| `Popover`         | Non-modal popup anchored to `Popover.Trigger`; `side`, `align`.                                                  |
| `Tooltip`         | Hover and focus text for its child, as a description or (`relationship="label"`) a name.                         |
| `TeachingPopover` | Step-by-step onboarding popover, optionally pointing at a `target`.                                              |

### Tables

| Component  | Description                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Table`    | Static table: `Table.Header`, `Table.HeaderCell`, `Table.Body`, `Table.Row`, `Table.Cell`; `striped`; scrolls horizontally. |
| `DataGrid` | Interactive grid (APG grid keyboard model) with row selection and sortable headers; header from children or `columns`.      |

### Provider

| Component      | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| `WaveProvider` | Theme (`light`, `dark`, `high-contrast`), direction and portal container. |

`Portal` renders its children into `document.body` (or the provider's `portalContainer`) inside a themed `wave-portal` wrapper; use it for your own overlays.

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

- **Hover and pressed colors.** They are gated (`not-disabled:not-aria-disabled:hover:` / `…:active:`), so they never apply to a disabled or `aria-disabled` Button, and they work for `as="a"`. The gate makes them more specific than a bare `hover:` class, so `className="hover:bg-error"` does not override the built-in hover color while the Button is enabled. Like `hover:bg-error!`, a bare `hover:` class still applies on hover while the Button is disabled or `aria-disabled` (the gate switches the built-in class off), and on `appearance="transparent"`, which has no hover background (a pressed ToggleButton has one). To change only the enabled hover color, use the same prefix, which replaces the built-in class; the important modifier (`hover:bg-error!`) also wins while enabled, but keeps applying while disabled. A plain `bg-error` replaces only the resting color. The same applies to CompoundButton, ToggleButton, MenuButton and SplitButton. Class overrides need Tailwind to generate the classes: the precompiled `./styles` contains only the classes Wave itself uses.
- **Non-interactive `as`.** `as="div"`, `as="span"` and other elements that are not interactive by themselves get `role="button"`, a tab stop (`tabIndex={0}`) and Enter (key down) / Space (key up) activation, like a native button; your own `role` or `tabIndex` wins. `as="a"` shows no link underline. A native `<button>` gets `type="button"` by default; a custom `as` component gets no `type` default, so pass `type` yourself inside a form.
- **`disabled` with a non-native `as`.** Only `button` (the default), `input`, `select` and `textarea` receive the native `disabled` attribute. Every other `as` gets `aria-disabled="true"` and `tabIndex={-1}` instead, which your props cannot override. That covers `a`, `div`, `span` and any custom component, including router links and styled or motion components that render a native `<button>`. Its clicks, Enter and Space are prevented, the click does not reach ancestor `onClick` handlers, and an `<a>` drops its `href` and keeps `role="link"`. Such an element has no native `:disabled` state, so a component's own `:disabled` styling no longer applies: style it on `[aria-disabled="true"]` (the `aria-disabled:` variant). It leaves the tab order but can still take focus from a mouse click.
- An `aria-disabled="true"` of yours on an enabled Button shows the disabled look but keeps the Button focusable and its handlers running: guard them yourself.
- The `icon` slot is decorative (`aria-hidden`). Give an icon-only Button an `aria-label`, `aria-labelledby` or `title`; it warns in development without one.

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

- Library controls inside a `Field` are named by its label, described by its hint and error, and marked `aria-invalid`/`aria-required`. With `required`, native inputs (`Input`, `Select`, `Textarea`, `Slider`, `SpinButton`, `SearchBox`) also get the native `required` attribute, so the browser blocks an empty submit. The choice and picker controls (`Checkbox`, `Switch`, `RadioGroup`, `Rating`, `SwatchPicker`, `ColorPicker`, `Combobox`, `Dropdown`, `TagPicker`, `DatePicker`, `TimePicker`) are required too, also without `name`: the browser blocks the submit until the control is checked, switched on or has a value, so `<Field required><Switch /></Field>` means "must be on". Add `noValidate` to a `<form>` that validates in its submit handler.
- One control per Field. Put wrapper or layout components (a `Tooltip`, your own row) **inside a plain `<div>`** in the Field; the library control inside is then labelled correctly.
- `error` on `Input`, `Select` and `Textarea`: a string renders the message after the control in a `role="alert"` element linked with `aria-describedby`/`aria-errormessage`; `error={true}` only marks the control invalid. Inside a Field that shows its own error, the message is not repeated.
- Value controls take part in native forms when you pass `name`, or when they are required (their own `required`, or a required `Field`): `Checkbox`, `Switch`, `RadioGroup`, `Rating`, `SpinButton`, `SwatchPicker`, `ColorPicker`, `Combobox`, `Dropdown`, `TagPicker`, `DatePicker` (ISO `yyyy-mm-dd`) and `TimePicker` (`HH:mm`) render a hidden input, honour `required` and `form`, and reset with their form. No name is generated for you.

### Value callbacks

`onChange` is the native DOM change event (`Input`, `Textarea`, `Select`, `Slider`). State callbacks are named after the state and receive the value:

| State        | Props                                                     |
| ------------ | --------------------------------------------------------- |
| single value | `value` / `defaultValue` / `onValueChange(value)`         |
| checked      | `checked` / `defaultChecked` / `onCheckedChange(checked)` |
| open         | `open` / `defaultOpen` / `onOpenChange(open)`             |

These fire only when the value changes. Event callbacks such as `onPageChange`, `onStepChange` and `Tree`'s `onItemSelect` fire on every activation, also when the current item is activated again. The 0.4 names still work as deprecated aliases that warn once in development; see the [CHANGELOG](CHANGELOG.md) for the full table.

### Composite controls

Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker and TimePicker render a wrapper around their focusable element. `id`, `aria-*`, `tabIndex`, `autoFocus`, focus and key handlers (and native input attributes for text fields) go to the focusable element; `className`, `style`, `data-*` and `ref` stay on the wrapper. `controlRef` gives you the focusable element.

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

Use `Menu.Trigger`/`Menu.Popover` for menu buttons; `Popover` has no menu semantics.

### Dialogs and triggers

```tsx
import { Button, Dialog } from '@mortenbrudvik/waveui';

export function DeleteDialog({ onDelete }: { onDelete: () => void }) {
  return (
    <Dialog>
      <Dialog.Trigger>
        <Button>Delete</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Delete item?" size="small">
        This action cannot be undone.
        <Dialog.Footer>
          <Dialog.Close>
            <Button>Cancel</Button>
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

- `Dialog.Trigger`, `Drawer.Trigger`, `Popover.Trigger` and `Menu.Trigger` merge their props onto their single child (no wrapper element) or pass them to a render-prop child. `asChild={false}` renders the 0.4 wrapper `<span>`; a custom child that neither forwards `ref` nor spreads its props falls back to that span automatically, with a development warning.
- Render `Dialog.Footer` **inside** `Dialog.Content`.
- Dialog and Drawer trap focus, close on Escape and backdrop click, lock page scroll and make the rest of the page `inert` while open (toasts and live regions stay available).
- On close, focus goes to `finalFocusRef` when you pass one. Otherwise it returns to the element that had focus when the modal opened: the trigger for a trigger click, but also the parent's own button of a controlled Dialog, or a text field that had focus when a keyboard shortcut opened it. When nothing had focus (a modal opened from code, or a click in Safari, which does not focus the clicked button), it goes to the trigger that opened the modal, else the first mounted trigger. When that element is gone, focus falls back to a mounted trigger or the overlay below.

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

`dispatchToast` returns the toast id; `dismissToast(id)` removes it. Toasts pause while hovered or focused, stay reachable by Tab over an open Dialog, and are announced through permanent live regions.

### Sorting a DataGrid

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

Icon slots are decorative (`aria-hidden`). The dismiss and clear slots of `MessageBar`, `SearchBox` and `Tag` render their content inside the component's own button; the 0.4 form that passed a button object is deprecated.

## Keyboard support

As implemented in 0.5. Buttons, links, checkboxes, switches and the trigger buttons of Accordion, Carousel, Nav, Breadcrumb and Pagination are native elements: Tab to reach them, Enter or Space to activate.

| Component                       | Keys                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar                         | One Tab stop (the last focused control). Left/Right (Up/Down when vertical) move and wrap, Home/End jump; mirrored in RTL. Text fields, selects, sliders and spin buttons keep their own arrow keys.                                                                                  |
| RadioGroup, SwatchPicker        | One Tab stop. All four arrows move and select (wrapping), Home/End jump; Left/Right mirrored in RTL.                                                                                                                                                                                  |
| Rating                          | Right/Up one star more, Left/Down one fewer (never below 1), Home/End first/last; mirrored in RTL.                                                                                                                                                                                    |
| TabList                         | One Tab stop. Left/Right (Up/Down when vertical) move and select, Home/End; disabled tabs skipped; mirrored in RTL.                                                                                                                                                                   |
| Tree                            | One Tab stop. Up/Down, Home/End; Right expands or moves to the first child, Left collapses or moves to the parent (mirrored in RTL); Enter/Space activate; `*` expands siblings; type to jump (a Space within 500 ms of a letter continues the search).                               |
| List (selectable)               | One Tab stop. Up/Down (wrapping), Home/End, Enter/Space toggle, typeahead above 7 items (a Space within 500 ms of a letter continues the search). With item actions (grid): Up/Down between rows, Left/Right into the actions, Enter/F2 into a text field, Escape back.               |
| DataGrid                        | One Tab stop. Arrows between cells (mirrored in RTL), Home/End row start/end, Ctrl+Home/Ctrl+End grid start/end, PageUp/PageDown 10 rows; Enter/F2 into a cell's widgets, Escape back; Space on a cell toggles its row's selection.                                                   |
| Menu                            | Trigger: Enter/Space/Down open and focus the first item, Up opens on the last. Menu: Up/Down (wrapping), Home/End, typeahead, Enter/Space activate (a Space within 500 ms of a letter continues the search), Escape closes and returns focus, Tab closes.                             |
| Combobox, TagPicker, TimePicker | Down/Up open and move, Alt+Down opens, Enter commits the active option (with nothing to commit, Enter submits the form), Alt+Up and Tab close, Escape closes and then discards typed text. TagPicker: Backspace in the empty input focuses the last tag, Backspace/Delete removes it. |
| Dropdown                        | Down/Up/Home/End and typing open and move, PageUp/PageDown move by 10, Enter/Space commit (a Space within 500 ms of a letter continues the search), Alt+Up and Tab commit and close, Escape closes.                                                                                   |
| SpinButton                      | Up/Down step, PageUp/PageDown large step, Home/End jump to a finite min/max (otherwise they move the caret); Enter commits typed text, Escape reverts it.                                                                                                                             |
| DatePicker                      | Alt+Down opens the calendar. Calendar: arrows by day/week (mirrored in RTL), PageUp/PageDown by month, Shift+PageUp/PageDown by year, Home/End week start/end, Enter/Space select, Escape closes; Tab stays inside.                                                                   |
| Dialog, Drawer                  | Focus is trapped; Escape closes; focus returns to the first of these that can take focus: `finalFocusRef`, the element that had focus when the modal opened, the trigger, an element next to where that opener was.                                                                   |
| Popover, TeachingPopover        | Escape closes. When focus was inside (or lost to `<body>`), Popover returns it to its trigger, TeachingPopover to where focus was before it opened.                                                                                                                                   |
| Tooltip, InfoLabel              | Open on keyboard focus; Escape closes. InfoLabel: click pins it.                                                                                                                                                                                                                      |
| Card (selectable)               | With the default `selectionControl="card"`: Enter (key down) or Space (key up) selects. With `"checkbox"`: the built-in checkbox.                                                                                                                                                     |
| Stepper                         | Each reachable step is a Tab stop; Enter/Space activate.                                                                                                                                                                                                                              |
| Slider                          | Native range keys.                                                                                                                                                                                                                                                                    |

Accordion and Carousel have no arrow-key navigation: their triggers and controls are Tab stops.

## Hooks and utilities

| Export                                                                          | Purpose                                                                                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `useControllable(value, defaultValue, onChange)`                                | Controlled/uncontrolled state; returns `[value, setValue, isControlled]`; `setValue` accepts a value or an updater and skips no-op updates. |
| `useRovingTabIndex(options)`                                                    | Roving tab stop and arrow-key navigation for composite widgets.                                                                             |
| `useId(prefix?)`                                                                | SSR-safe ids (`prefix-<react id>`; never parse the React part).                                                                             |
| `useEventCallback(fn)`                                                          | Stable callback that always calls the latest `fn`.                                                                                          |
| `useMergedRefs(...refs)`                                                        | One stable callback ref for several refs.                                                                                                   |
| `useIsClient()`                                                                 | `false` on the server and during hydration.                                                                                                 |
| `useFieldControl(props, options?)`                                              | Merge a custom control's labelling props with the surrounding `Field`.                                                                      |
| `useAnnounce()`, `announce(message, politeness?)`                               | Screen-reader announcements through a shared live region.                                                                                   |
| `useWaveTheme()`                                                                | Current theme, direction and portal container.                                                                                              |
| `useToastController()`                                                          | `dispatchToast` / `dismissToast` inside `<Toaster>`.                                                                                        |
| `useIsOverflowing(target)`, `useOverflowMenu()`, `useIsOverflowItemVisible(id)` | Overflow detection.                                                                                                                         |
| `cn(...classes)`                                                                | clsx + tailwind-merge that knows Wave's type ramp and shadows; the last class wins.                                                         |
| `composeEventHandlers(theirs, ours)`                                            | Run a consumer handler, then yours unless it called `preventDefault()`.                                                                     |
| `mergeRefs(...refs)`                                                            | Merge refs outside components.                                                                                                              |
| `resolveSlot`, `renderSlot`                                                     | The slot helpers the components use.                                                                                                        |
| `getThemeClassName(theme)`                                                      | The theme classes of a theme.                                                                                                               |

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
npm run lint             # ESLint
npm run build            # type-check, library build, CSS build, dist verification
npm run check:package    # publint + are-the-types-wrong
npm run test:pack        # pack the tarball and smoke-test it in plain and Tailwind fixtures
```

## License

MIT
