# WaveUI and Fluent UI React v9

A comparison for developers choosing between the two libraries, and a guide for moving a Fluent UI React v9 app to WaveUI.

WaveUI is an independent React component library that follows Microsoft's Fluent 2 design language. It is not Microsoft's `@fluentui/react-components` and not a drop-in replacement for it: it covers most of Fluent UI React v9's components with its own API, styled with Tailwind CSS 4 instead of CSS-in-JS.

- **Compared:** WaveUI 0.7.0 (`@mortenbrudvik/waveui`, released 2026-09-26) and Fluent UI React v9 (`@fluentui/react-components` 9.74.9, released 2026-09-23, the latest release on 2026-09-26).
- **Not covered:** Fluent UI React v8 (`@fluentui/react`) and Fluent UI Web Components, which are separate libraries.
- **Related documents:** the [README](../README.md) is WaveUI's API reference. The [gap analysis](research/fluent-ui-v9-comparison.md) is the detailed comparison behind this guide: it lists 475 differences with ids, measured against WaveUI 0.5. WaveUI 0.6 and 0.7 closed 77 of them, including three of the seven rated high impact (submenus, checkbox and radio menu items); the other four (toasts with rich content, a color area, a hue slider, Tree multi-select) are planned for 0.8. The [roadmap](ROADMAP.md) schedules the rest up to 1.0.

## Contents

1. [At a glance](#1-at-a-glance)
2. [Which one to choose](#2-which-one-to-choose)
3. [How the two libraries differ](#3-how-the-two-libraries-differ): styling, themes, typography, server rendering, right-to-left, motion, positioning, focus, keyboard, forms, size, hooks
4. [Translating Fluent code](#4-translating-fluent-code): callbacks, parts, `ref`, slots, sizes, defaults that differ
5. [Component map](#5-component-map)
6. [Only in WaveUI](#6-only-in-waveui)
7. [Not in WaveUI yet](#7-not-in-waveui-yet)
8. [Migrating a Fluent UI v9 app](#8-migrating-a-fluent-ui-v9-app)
9. [Sources and method](#9-sources-and-method)

## 1. At a glance

| | Fluent UI React v9 | WaveUI 0.7 |
|---|---|---|
| Maintained by | Microsoft | an independent open-source project with one maintainer |
| API status | stable since 9.0.0 (June 2022), semantic versioning | before 1.0: a minor release adds features and may change behavior; renamed props keep working as deprecated aliases until 1.0, which removes them and freezes the API |
| Design | Fluent 2, Microsoft's own implementation, with web and Teams themes | Fluent 2's colors, type ramp, shadows and motion values, with light, dark and high-contrast themes; no pixel parity |
| React | 16.14 to 19 | 19 |
| Browsers | Chrome and Edge 84+, Firefox 75+, Safari 14.1+ | Chrome and Edge 111+, Firefox 128+, Safari 16.4+ |
| Styling | Griffel (CSS-in-JS): style rules shipped in the JavaScript and inserted at runtime, or extracted to CSS at build time | Tailwind CSS 4 utilities: a precompiled stylesheet, or your own Tailwind build |
| Theming | theme objects, applied as CSS variables by `FluentProvider` | CSS variables (`--wave-*`) and three named themes |
| Customization | a slot for every part, static class names, app-wide style hooks, recomposition hooks | `className`, `data-*` state attributes, slots for icons and content |
| Server rendering | a style renderer that collects the styles into the server HTML | nothing beyond the stylesheet import |
| Forms | the controls built on native inputs submit; Dropdown, TagPicker, SwatchPicker and ColorPicker do not | every value control and picker takes part: it submits under a `name`, validates `required` and resets with its form |
| Components | about 60 stable ones; charts in a separate package, the date and time pickers in compat packages | 65, including Pagination, Stepper and layout primitives |
| Motion | built into overlays and disclosures | a presence primitive; motion on components is planned for 0.15 |
| Runtime dependencies | 62 direct (60 Fluent packages, Griffel and `@swc/helpers`); 89 packages installed | 3 (`@floating-ui/react-dom`, `clsx`, `tailwind-merge`) |
| Whole library, minified and gzipped | 326 KiB of JavaScript | 141 KiB of JavaScript and 10 KiB of CSS |
| Icons | `@fluentui/react-icons` | none built in; icon props take any element, `@fluentui/react-icons` included |
| License | MIT (Fluent's font and icon assets have their own terms) | MIT |

## 2. Which one to choose

**Fluent UI React v9 fits better when:**

- **You need a stable API today.** Fluent v9 has been stable since June 2022 and follows semantic versioning. WaveUI is before 1.0: each minor release changes some behavior (listed under "Changed" in its [CHANGELOG](../CHANGELOG.md)), and the API is frozen only at 1.0.
- **You want long-term backing and an ecosystem.** Fluent is maintained by Microsoft, with a documentation site and a large community (over 20,000 GitHub stars). WaveUI has one maintainer.
- **You build for Microsoft 365 or Teams, or need exact Fluent visuals.** Fluent ships the Teams themes and is Microsoft's own implementation. WaveUI uses Fluent 2's values but does not aim for pixel parity, and its dark theme draws brand fills differently ([3.2](#32-themes-and-tokens)).
- **You need something WaveUI does not have yet:** charts, virtualized lists and grids, column resizing, multi-select Dropdown and Combobox, Tree multi-select, a color area and hue slider, toasts with actions, input sizes and appearances, TagGroup, InlineDrawer and NavDrawer, non-modal dialogs. [Section 7](#7-not-in-waveui-yet) gives the planned release of each; charts are not planned.
- **You are on React 17 or 18, or must support older browsers.**
- **You want to rebuild components from their parts.** Fluent exposes a slot on every part, static class names, app-wide style hooks, each component's state and render hooks (`use*_unstable`, `render*_unstable`) and its focus-management hooks.
- **Your team prefers CSS-in-JS to utility classes.**

**WaveUI fits better when:**

- **Your app uses Tailwind CSS 4, or you want styles without a runtime engine.** WaveUI inserts no `<style>` elements at runtime: nothing to collect for server rendering, and no nonce to set up for a Content Security Policy. (Fluent gets close with Griffel's build-time CSS extraction, an extra build step.)
- **You use React 19 and Server Components.** A stylesheet import and `WaveProvider` are the whole setup; there is no style renderer to configure.
- **Your forms rely on native HTML forms.** Every value control and picker submits its value under a `name`, blocks submission when `required`, and resets with its `<form>`.
- **You want these accessibility defaults without extra work:** toasts that stay reachable over a dialog, live regions without a provider, accordion triggers in headings, grid rows whose checkboxes are named after the row, development warnings for unnamed controls ([6](#6-only-in-waveui)).
- **You need Pagination, a Stepper, layout primitives (Stack, Flex, Grid), tab panels, or date and time pickers in the main package.**
- **Size matters.** A page of form controls costs about a quarter less than with Fluent, and the whole library less than half, stylesheet included; a single button or the overlays cost about the same ([3.11](#311-size-and-dependencies)). WaveUI has three runtime dependencies.

Both libraries implement the WAI-ARIA Authoring Practices patterns (with the differences of [3.9](#39-keyboard-behavior)), support right-to-left layouts and Windows high contrast, work with `@fluentui/react-icons`, and run in the Next.js App Router.

## 3. How the two libraries differ

### 3.1 Styling

| | Fluent UI v9 | WaveUI 0.7 |
|---|---|---|
| Engine | Griffel, an atomic CSS-in-JS library: each component's styles ship as precompiled atomic rules in its JavaScript, and Griffel inserts them into the page at runtime; a build plugin can extract them into a CSS file instead | Tailwind CSS 4 utility classes, shipped as a precompiled stylesheet (`@mortenbrudvik/waveui/styles`) or generated by your own Tailwind build (`@import '@mortenbrudvik/waveui/tailwind'`). Nothing is generated at runtime |
| Your styles on a component | `className` (merged after the component's classes by `mergeClasses`), your own `makeStyles`, and a `className` on any slot (`icon={{ className }}`) | `className`, merged last by `cn()` (clsx and tailwind-merge): Tailwind classes or your own CSS classes |
| Component state in CSS | inside Griffel's rules (`:hover`, `[aria-pressed]`) | `data-*` attributes on the element: `data-state`, `data-selected`, `data-checked`, `data-pressed`, `data-disabled`, `data-orientation`, `data-appearance`, … Enumerated attributes are always present with their value, so `[data-orientation=vertical]` always matches |
| Selecting a part from CSS or a test | a static class name on every part (`.fui-Button`, `.fui-Button__icon`, exported as `buttonClassNames`) | roles, accessible names and `data-*` attributes; class names for parts are planned for 0.8 |
| App-wide restyling | `customStyleHooks_unstable` on `FluentProvider` replaces a part's style hook everywhere | `className` per instance, or your own wrapper components |

Things that catch Fluent developers:

- **Hover and pressed colors are gated.** A Button's built-in hover color is `not-disabled:not-aria-disabled:hover:bg-…`, which is more specific than a bare `hover:` class. Override it with the same prefix (`not-disabled:not-aria-disabled:hover:bg-error`) or the important modifier (`hover:bg-error!`); a plain `bg-error` replaces the resting color only. The same holds for the `data-[…]:` and `aria-*:` state classes ([README: Components](../README.md#components)).
- **The precompiled stylesheet holds only WaveUI's own utilities.** A `className="mt-7"` works only if a WaveUI component also uses `mt-7`, or if your own Tailwind build or CSS defines it. The class recipes in this guide (`bg-transparent`, the gated hover prefix, `rounded-full`, `wave-rtl:`) assume your own Tailwind build.
- **Color utility names are unprefixed** (`bg-primary`, `text-foreground`, `border-border`) and collide with shadcn/ui and with an app's own Tailwind theme that uses the same names. [README: Global effects](../README.md#global-effects) lists every name. The workaround is a prefixed Tailwind build for your own classes (they become `tw:flex`, `tw:bg-primary`, …), with WaveUI's precompiled stylesheet in a cascade layer between Tailwind's `base` and `utilities`; namespaced WaveUI utilities are planned for 1.0:

  ```css
  @layer theme, base, wave, components, utilities;
  @import 'tailwindcss' prefix(tw);
  @import '@mortenbrudvik/waveui/styles.css' layer(wave);
  ```

- **`makeStyles` becomes classes.** `shorthands.padding('4px', '8px')` is `py-1 px-2`, `tokens.colorNeutralForeground3` is `text-muted-foreground` (see the table in [3.2](#32-themes-and-tokens)), and `mergeClasses(a, b)` is `cn(a, b)`.

### 3.2 Themes and tokens

Fluent's `FluentProvider` takes a theme object: `webLightTheme`, `webDarkTheme`, `teamsLightTheme`, `teamsDarkTheme`, `teamsHighContrastTheme`, or one built from your brand colors with `createLightTheme(brand)` and `createDarkTheme(brand)`. A nested provider merges a partial theme over its parent's and applies it to that subtree's portals. Styles read tokens as `tokens.colorNeutralForeground1`, which is `var(--colorNeutralForeground1)`.

WaveUI's `WaveProvider` takes a theme name: `light` (the default), `dark` or `high-contrast`. The tokens are `--wave-*` CSS variables selected by the theme's class, and the Tailwind utilities use the same names without the prefix (`--wave-primary` is `bg-primary`). You rebrand by overriding the brand ramp in your CSS, not through a prop. A nested provider switches its subtree, and the overlays it opens, to another named theme; your own token overrides for a subtree do not reach its overlays until 0.17 ([README: Theming](../README.md#theming)).

**Shared values.** WaveUI's global values are Fluent's: the brand ramp is Fluent's web brand ramp (`#0f6cbd` at 80), the greys are Fluent's greys, `--wave-font-family` is Fluent's `fontFamilyBase`, the shadows follow Fluent's formula, and the motion durations and curves are Fluent's `motionTokens`. A Fluent `BrandVariants` object therefore maps onto WaveUI key for key: `brand[10]` becomes `--wave-brand-10`, and so on up to `--wave-brand-160`.

**Differences in the semantic layer.** WaveUI has 61 color tokens per theme where Fluent has about 184, so several Fluent tokens share one WaveUI token or have none. In the table below, a single value in the last column is the same in both libraries. Beyond the table:

- **Brand fills in the dark theme.** Fluent's dark theme fills brand surfaces with brand 70 and white text; WaveUI's dark `primary` is brand 110 with black text.
- **Warning.** Fluent's warning status color is orange. WaveUI's `warning` is yellow (`#fde300`, used as a fill; warning text uses `warning-tint-foreground`), and its orange is `severe`.
- **Focus ring.** Fluent draws a two-tone ring (black and white); WaveUI draws one ring in `--wave-ring`, the brand color.
- **Disabled.** Fluent has disabled colors; WaveUI dims a disabled control with opacity.

| Fluent token | WaveUI variable | Tailwind utility | Light value |
|---|---|---|---|
| `colorNeutralForeground1` | `--wave-foreground` | `text-foreground` | `#242424` |
| `colorNeutralForeground2` | none (use `--wave-foreground`) | `text-foreground` | Fluent: `#424242` |
| `colorNeutralForeground3` | `--wave-muted-foreground` | `text-muted-foreground` | `#616161` |
| `colorNeutralForegroundDisabled` | none: disabled controls are dimmed | | Fluent: `#bdbdbd` |
| `colorNeutralBackground1` | `--wave-background` | `bg-background` | `#ffffff` |
| `colorNeutralBackground2` | `--wave-card` | `bg-card` | `#fafafa` |
| `colorNeutralBackground3` | `--wave-secondary` | `bg-secondary` | `#f5f5f5` |
| `colorSubtleBackgroundHover` | `--wave-subtle-hover` | `bg-subtle-hover` | `#f5f5f5` |
| `colorNeutralStroke1` | `--wave-stroke` | `border-stroke` | `#d1d1d1` |
| `colorNeutralStroke2` | `--wave-border` | `border-border` | `#e0e0e0` |
| `colorBrandBackground` | `--wave-primary` | `bg-primary` | `#0f6cbd` |
| `colorBrandBackgroundHover` | `--wave-primary-hover` | `bg-primary-hover` | `#115ea3` |
| `colorBrandForeground1` | `--wave-primary` | `text-primary` | `#0f6cbd` |
| `colorNeutralForegroundOnBrand` | `--wave-primary-foreground` | `text-primary-foreground` | `#ffffff` |
| `colorStatusDangerBackground3` | `--wave-error` | `bg-error` | `#c50f1f` |
| `colorStatusDangerBackground1` | `--wave-error-tint` | `bg-error-tint` | `#fdf3f4` |
| `colorStatusDangerForeground1` | `--wave-error-tint-foreground` | `text-error-tint-foreground` | `#b10e1c` |
| `colorStatusSuccessBackground3` | `--wave-success` | `bg-success` | `#107c10` |
| `colorStatusSuccessForeground1` | `--wave-success-tint-foreground` | `text-success-tint-foreground` | `#0e700e` |
| `colorStatusWarningForeground1` | none: WaveUI's warning text is `--wave-warning-tint-foreground`, a dark yellow | `text-warning-tint-foreground` | Fluent: `#bc4b09`; WaveUI: `#6d5b00` |
| `fontFamilyBase` | `--wave-font-family` | `font-wave` | the same font stack |
| `fontSizeBase300`, `lineHeightBase300` | the `body-1` step of the type ramp | `text-body-1` | 14px / 20px |
| `fontWeightSemibold` | none (Tailwind's weights) | `font-semibold` | 600 |
| `borderRadiusMedium` | none (Tailwind's radius scale) | `rounded` | 4px |
| `spacingHorizontalM`, `spacingVerticalS` | none (Tailwind's 4px spacing scale) | `px-3`, `py-2` | 12px, 8px |
| `strokeWidthThin` | none | `border` | 1px |
| `shadow4`, `shadow16` | the shadow scale | `shadow-4`, `shadow-16` | the same values |
| `durationNormal` | `--wave-duration-normal` | `duration-wave-normal` | 200ms |
| `curveEasyEase` | `--wave-curve-easy-ease` | `ease-wave-easy-ease` | `cubic-bezier(0.33,0,0.67,1)` |

A utility exists in the precompiled stylesheet only if a WaveUI component uses it. On that path, read the variables in your own CSS (`color: var(--wave-muted-foreground)`).

### 3.3 Typography

Fluent has a `Text` component with a numeric `size`, and 17 preset components that combine a size and a weight (`Body1Strong`). WaveUI has one `Text` with a `variant` from the same 11-step ramp and a separate `weight` (`regular`, `semibold`, `bold`); without `weight`, the weight follows the variant. The sizes are Fluent's.

| Fluent | WaveUI |
|---|---|
| `Caption2`, `Caption2Strong`, `Text size={100}` | `<Text variant="caption-2">`, with `weight="semibold"` for Strong |
| `Caption1`, `Caption1Strong`, `Caption1Stronger`, `size={200}` | `<Text variant="caption-1">`, with `weight="semibold"` or `"bold"` |
| `Body1`, `Body1Strong`, `Body1Stronger`, `size={300}` | `<Text variant="body-1">`, with `weight` as above |
| `Body2`, `size={400}` | `<Text variant="body-2">` |
| `Subtitle2`, `Subtitle2Stronger` | `<Text variant="subtitle-2">` (semibold), `weight="bold"` |
| `Subtitle1`, `size={500}` | `<Text variant="subtitle-1">` |
| `Title3`, `Title2`, `Title1` (`size={600}`, `700`, `800`) | `<Text variant="title-3">`, `"title-2"`, `"title-1"` |
| `LargeTitle`, `size={900}` | `<Text variant="large-title">` |
| `Display`, `size={1000}` | `<Text variant="display">` |

Fluent's `Text` props `font` (`monospace`, `numeric`), `weight="medium"`, `italic`, `underline`, `strikethrough`, `truncate`, `wrap`, `align` and `block` have no WaveUI prop: use Tailwind classes on the Tailwind path (`font-mono`, `italic`, `underline`, `line-through`, `truncate`, `text-center`, `block`), or your own CSS. Monospace and numeric font tokens and a medium weight are planned for 0.17. WaveUI's `as` takes any element or component; Fluent's `Text` allows a fixed list of elements.

### 3.4 Server rendering and Server Components

Both libraries mark their component modules `"use client"`, and both work in the Next.js App Router. The setup differs:

- **Fluent** inserts its CSS at runtime, so server rendering needs Griffel's renderer: `RendererProvider` with `createDOMRenderer()`, `SSRProvider`, and `renderToStyleElements(renderer)` to write the collected styles into the HTML. In the App Router, that runs in a client component that flushes the styles through `useServerInsertedHTML`. Under a strict Content Security Policy, the `<style>` elements Griffel inserts must be allowed.
- **WaveUI** needs the stylesheet import (`import '@mortenbrudvik/waveui/styles'` in the root layout, or the Tailwind entry) and `WaveProvider`, which can sit in a Server Component. No styles are inserted at runtime.
- **Compound parts in Server Components.** Fluent exports every part under its own name (`DialogTrigger`), so this never comes up. WaveUI's parts are members of their compound (`Dialog.Trigger`), and a Server Component cannot read a member of a client component, so every part is also exported under a flat name: the compound's name followed by the part's (`DialogTrigger`, `CardHeader`, `TabListTab`, `RadioGroupItem`, `SkeletonGroup`). Use the flat names in Server Components ([README: React Server Components](../README.md#react-server-components) lists them all).
- **What the server HTML contains.** WaveUI renders a Tooltip's text and a closed picker's options into the server HTML, hidden; Fluent renders no tooltip on the server. An overlay rendered with `defaultOpen` is closed in WaveUI's server HTML and opens once hydrated.

### 3.5 Right-to-left

- **Fluent:** set `dir` on `FluentProvider`. Griffel rewrites the physical properties of every `makeStyles` rule for right-to-left (`marginLeft` becomes `marginRight`; a `/* @noflip */` comment keeps one), and `@fluentui/react-icons` mirror their directional icons from the direction `FluentProvider` gives them.
- **WaveUI:** set `dir` on `WaveProvider`, or on any element. The components resolve the direction per element, so a left-to-right island inside a right-to-left page works. Your own styles are not rewritten: write logical utilities (`ms-2`, `ps-3`, `start-0`, `border-s`, `text-start`) instead of physical ones (`ml-2`, `left-0`), and mirror transforms and glyphs with WaveUI's `wave-rtl:` variant (`wave-rtl:-scale-x-100`). Tailwind's own `rtl:` variant also works, but it also matches inside a left-to-right island of a right-to-left page.
- **Icons.** Without `FluentProvider`, `@fluentui/react-icons` do not mirror themselves. Wrap the app in their `IconDirectionContextProvider` (`value={{ textDirection: 'rtl' }}`), or add `wave-rtl:-scale-x-100` to a directional icon.

### 3.6 Motion

Fluent's motion package (`@fluentui/react-motion`) is stable: `createPresenceComponent`, `createMotionComponent`, `PresenceGroup` and `motionTokens`, on the Web Animations API (its ready-made motion components, such as `Fade` and `Collapse`, are still in preview). Dialog, Drawer, Popover and Menu animate their surfaces by default, and Accordion and Tree their panels, each through a motion slot (`surfaceMotion`, `backdropMotion`, `collapseMotion`) you can replace or turn off.

WaveUI 0.7 has the mechanism but ships no enter or exit animations. `Presence` and `usePresence` mount and unmount an element with CSS transitions: the element carries `data-presence` (`entering`, `entered`, `exiting`, `exited`), you style its enter with `data-[presence=entering]:starting:` classes and its exit with `data-[presence=exiting]:` classes, and it stays mounted and `inert` until the exit finishes ([README: Enter and exit motion](../README.md#enter-and-exit-motion)). Only `Menu.Popover` mounts through it, and it animates only with classes you add. Dialog, Drawer, Popover, Tooltip, Accordion and Tree open and close without animation until 0.15.

### 3.7 Positioning and portals

| Fluent UI v9 | WaveUI 0.7 |
|---|---|
| `positioning="above"`, `"above-start"`, `"above-end"` | `side="top"`, with `align="center"`, `"start"` or `"end"` |
| `positioning="below"`, `"below-start"`, `"below-end"` | `side="bottom"`, with `align` |
| `positioning="before"`, `"before-top"`, `"before-bottom"` | `side="start"`, with `align="center"`, `"start"` or `"end"` |
| `positioning="after"`, `"after-top"`, `"after-bottom"` | `side="end"`, with `align` |
| `positioning={{ offset }}` | `offset` on `Menu.Popover`; the other surfaces use a fixed offset until the `positioning` prop of 0.12 |
| `positioning={{ target }}`, `createVirtualElementFromClick(event)` | `target` on `Popover` and `Menu.Popover`: an element held in state, or `{ getBoundingClientRect: () => rect }` |
| `openOnContext` | `openOnContext` on Menu and Popover |
| `usePositioning`, `positioningRef`, `PositioningConfigurationProvider` | internal; public hooks and a `positioning` prop are planned for 0.12, a global configuration is not |
| `mountNode` on a surface, `PortalMountNodeProvider`, `inline` | `portalContainer` on a (nested) `WaveProvider`, and `Portal` with `container`; no `inline` prop: popups always render in a portal (a TeachingPopover without `target` is the exception) |

Fluent sets `positioning` on the root (`Menu`, `Popover`, `Tooltip`). WaveUI sets `side` and `align` on `Popover`, `Tooltip` and `Menu.Popover`, and `side` also takes the physical `left` and `right`. Both position with Floating UI, flip to stay in view, and keep a submenu open while the pointer crosses to it.

### 3.8 Focus, modal dialogs and announcements

- **Focus management.** Fluent builds its keyboard behavior on tabster and exports its hooks: `useArrowNavigationGroup`, `useFocusableGroup`, `useModalAttributes`, `useRestoreFocusTarget`, `useFocusFinders` and more. WaveUI has its own focus and dismiss-layer code and exports one hook from it, `useRovingTabIndex` (arrow keys along one axis, typeahead, right-to-left). Grid navigation, focusable groups and the modal layer become public in 0.12.
- **Modal dialogs.** Both keep keyboard focus in a modal dialog and hide the rest of the page from assistive technology, in different ways. Fluent's Dialog sets `aria-modal="true"` and traps focus with tabster by default (`inertTrapFocus` switches it to `inert`). WaveUI's Dialog and Drawer never set `aria-modal`: they make the rest of the page `inert` except WaveUI's own toasts and live regions, so a toast shown over a dialog is still announced, and Tab can reach it.
- **Announcements.** Fluent's `useAnnounce` does nothing unless an announcer is mounted, and `FluentProvider` does not mount one. WaveUI's `announce(message, politeness?)` and `useAnnounce()` need no provider.

### 3.9 Keyboard behavior

Both libraries implement the keyboard patterns of the WAI-ARIA Authoring Practices (APG), and they differ in the details below. Most differences are deliberate on WaveUI's side: it keeps an APG variant or its own earlier behavior, and the [roadmap](ROADMAP.md#83-intentional-differences-no-change-planned) records why. The others are gaps, scheduled or in the backlog.

| Behavior | Fluent UI v9 | WaveUI 0.7 | Status in WaveUI |
|---|---|---|---|
| Arrow keys in a TabList | move focus; Enter or Space selects (`selectTabOnFocus` defaults to `false`) | select the tab (`selectTabOnFocus` defaults to `true`) | deliberate; both are APG variants |
| Arrow keys in a SwatchPicker | move focus (`focusMode="arrow"`) | select, as in an APG radio group | deliberate; `focusMode` is planned for 0.10 |
| Arrow keys in a Toolbar | both axes | the axis of `orientation` (APG toolbar) | deliberate |
| Checkbox and switch menu items | a click, Enter and Space change the item and keep the menu open | Space changes the item and keeps the menu open; Enter and a click change it and close the menu (APG menu) | deliberate |
| Radio menu items | a click, Enter and Space check the item and close the menu | as checkbox items | deliberate |
| Clicking a DatePicker's input | opens the calendar | does not: the calendar button and Alt+ArrowDown do (APG date picker dialog) | deliberate |
| Opening a Popover | moves focus into the surface | leaves focus on the trigger; Tab moves into the content | deliberate |
| Disabled options and menu items | stay reachable with the arrow keys, as the APG recommends | skipped | a gap: options planned for 0.10, menu items in the backlog |
| Closing the open item of a single-mode Accordion | not possible unless `collapsible` is set | always possible | a gap: no non-collapsible mode (backlog) |

[README: Keyboard support](../README.md#keyboard-support) lists every component's keys.

### 3.10 Forms

| | Fluent UI v9 | WaveUI 0.7 |
|---|---|---|
| Native `<form>` submission | through the native input inside Input, Textarea, Select, Checkbox, Radio, Switch, Slider and SpinButton; Dropdown, TagPicker, SwatchPicker and ColorPicker submit nothing, and Combobox submits its displayed text | every value control and picker submits its value through a hidden input when it has a `name` (DatePicker as `yyyy-mm-dd`, TimePicker as `HH:mm`, a multi-value picker as one entry per value), and honors `form` |
| Form reset | native inputs only | every value control returns to its default value |
| `required` | `aria-required` from Field, and the native `required` on the controls built on native inputs (Input, Checkbox, Switch, …); a required Field does not make a RadioGroup, Dropdown or other picker block an empty submission | a required Field or control blocks submission for every control, RadioGroup and the pickers included, as it does for Checkbox and Switch (`<Field required><Switch /></Field>` means the switch must be on) |
| Field wiring for your own control | `useFieldControlProps_unstable(props, { supportsLabelFor, supportsRequired, supportsSize })`, or a render function as Field's child | `useFieldControl(props, { labelable, nativeRequired })` inside the control |
| Error message on the control | through Field only | also the `error` prop of Input, Select and Textarea |

A RadioGroup gets no generated `name` in WaveUI: pass one to submit its value. See [README: Forms and Field](../README.md#forms-and-field).

### 3.11 Size and dependencies

Measured with esbuild 0.28.2 (minified ESM, gzip level 9), with `react` and `react-dom` external and everything else bundled, each library's own dependencies included. Each row imports the same components from both libraries, with the parts a basic use needs (Fluent's `Option`, `DialogSurface`, `MenuList`, …). The Button, form, overlay and table rows leave the providers out; "Everything" is each package's whole entry (for Fluent, `@fluentui/react-components` without the compat pickers and charts). Sizes are in KiB (1,024 bytes).

| What the app imports | Fluent UI v9, JavaScript | WaveUI 0.7, JavaScript |
|---|---|---|
| Button | 61.7 KiB (12.1 KiB gzip) | 39.0 KiB (12.3 KiB gzip) |
| Button and the provider | 96.3 KiB (23.2 KiB gzip) | 40.1 KiB (12.7 KiB gzip) |
| Button, Field, Input, Checkbox, Switch, Dropdown | 239.3 KiB (64.4 KiB gzip) | 112.6 KiB (38.4 KiB gzip) |
| Dialog, Menu, Popover, Tooltip | 210.6 KiB (65.2 KiB gzip) | 170.0 KiB (57.7 KiB gzip) |
| DataGrid, Table | 151.8 KiB (45.5 KiB gzip) | 59.1 KiB (20.0 KiB gzip) |
| Everything | 1,279.0 KiB (325.6 KiB gzip) | 427.4 KiB (141.2 KiB gzip) |

- **CSS.** Fluent's styles are inside its JavaScript and inserted at runtime. WaveUI's precompiled stylesheet adds 56.2 KiB (10.0 KiB gzip) once, whatever the app uses; on the Tailwind path, your build generates only the classes it finds.
- **With the stylesheet counted** (gzip): a Button with its provider costs about the same (Fluent 23.2 KiB, WaveUI 22.7 KiB), and so do the overlays (65.2 and 67.7 KiB). The form controls (64.4 and 48.4 KiB), the tables (45.5 and 30.0 KiB) and the whole library (325.6 and 151.2 KiB) cost less in WaveUI.
- **Providers.** `FluentProvider` with `webLightTheme` adds 34.6 KiB (11.1 KiB gzip); `WaveProvider` adds 1.1 KiB (0.4 KiB gzip).
- **What the numbers leave out.** Fluent's components have more parts and features ([7](#7-not-in-waveui-yet)): its DataGrid sorts, resizes columns and selects on row click, and its overlays animate, which WaveUI's do not yet. WaveUI's compounds carry all their parts, so its Menu row includes checkbox, radio, switch and link items, groups and submenus that Fluent's row does not. Fluent's style modules are 16 to 48% of its bundles here; Griffel's build-time extraction moves their style rules into a CSS file, which this measurement does not do. Parse and execution time, and the cost of inserting styles at runtime, are not measured.
- **Where the bytes go** (minified). Nearly half of Fluent's Button bundle is its `tokens` object (one runtime reference in Button's styles keeps all of it), and tabster, the keyboard-navigation library, is 73 KiB of the whole library. Of WaveUI's Button bundle, 28 KiB is `tailwind-merge`, which merges your `className` with the component's and is shared by every component.
- **Install.** `@fluentui/react-components` installs 89 packages (215 MB, of which `@fluentui/react-icons` is 174 MB; an app that keeps Fluent's icons keeps that package either way). WaveUI installs 7 MB (4.75 MB of it source maps) and six dependency packages (its three dependencies and theirs, 1.6 MB).

### 3.12 Hooks and utilities

| Fluent UI v9 | WaveUI 0.7 | Note |
|---|---|---|
| `useId(prefix?, providedId?)` | `useId(prefix?)` | |
| `mergeCallbacks(a, b)` | `composeEventHandlers(theirs, ours)` | `ours` does not run when `theirs` called `preventDefault()`; Fluent calls both |
| `useControllableState({ state, defaultState, initialState })`, from `@fluentui/react-utilities` (not exported by `@fluentui/react-components`) | `useControllable(value, defaultValue, onChange)` | returns `[value, setValue, isControlled]` |
| `useMergedRefs`, `useEventCallback` | the same names | |
| `useIsomorphicLayoutEffect` | none | call `useLayoutEffect`; React 19 does not warn on the server |
| `useTimeout`, `useAnimationFrame` | none | |
| `useAnnounce` | `useAnnounce`, `announce` | no provider needed |
| `mergeClasses` | `cn` | |
| `slot`, `assertSlots`, `use*_unstable`, `render*_unstable` | `resolveSlot`, `renderSlot` for icon-like slots | no recomposition hooks; structural slots and public contexts are planned for 0.18 |

## 4. Translating Fluent code

### 4.1 Callbacks

Fluent callbacks receive `(event, data)`. WaveUI state callbacks are named after their state and receive the new value first; extra data comes in a second `details` argument, which is typed optional until 1.0. They fire only when the value changes. `onChange` is always the native DOM change event.

| Fluent UI v9 | WaveUI 0.7 |
|---|---|
| Input `onChange={(ev, data) => set(data.value)}` | `onValueChange={set}` |
| Checkbox, Switch `onChange(ev, { checked })` | `onCheckedChange(checked)` |
| RadioGroup, Slider, Rating `onChange(ev, { value })` | `onValueChange(value)` |
| SpinButton `onChange(ev, { value, displayValue })` | `onValueChange(value)`, on a step, or when typed text is committed on blur or Enter |
| SearchBox `onChange(ev, { value })` | `onValueChange(value)`, and `onClear()` when the user clears the field |
| Textarea, Select `onChange(ev, { value })` | the native `onChange(event)` (no `onValueChange` yet) |
| Combobox, Dropdown `onOptionSelect(ev, { optionValue, selectedOptions })` | `onValueChange(value)` |
| TagPicker `onOptionSelect(ev, { value, selectedOptions })` | `onValueChange(values)` |
| SwatchPicker `onSelectionChange(ev, { selectedValue })` | `onValueChange(value)` |
| ColorPicker `onColorChange(ev, { color })`, an HSV object | `onValueChange(hex)` |
| DatePicker `onSelectDate(date)` | `onValueChange(date)` |
| TimePicker `onTimeChange(ev, { selectedTime })`, a `Date` | `onValueChange(time)`, an `HH:mm` string |
| TabList `onTabSelect(ev, { value })` | `onValueChange(value)` |
| Nav `onNavItemSelect(ev, { value, categoryValue })` | `onValueChange(value)` |
| Accordion `onToggle(ev, { value, openItems })` | `onOpenItemChange(item)`, or `onOpenItemsChange(items)` with `type="multiple"` |
| Tree `onOpenChange(ev, { open, openItems, value })` | `onExpandedItemsChange(items)` |
| Carousel `onActiveIndexChange(ev, { index, type })` | `onValueChange(index)` |
| Dialog, Drawer `onOpenChange(ev, { open, type })` | `onOpenChange(open, { reason, event })` |
| Menu, Popover and the pickers `onOpenChange(ev, { open })` | `onOpenChange(open)` |
| Tooltip `onVisibleChange(ev, { visible })` | `onOpenChange(open)` |
| Menu, Toolbar `onCheckedValueChange(ev, { name, checkedItems })` | `onCheckedValuesChange(checkedValues, { name, checkedItems, event })` |
| DataGrid `onSortChange(ev, { sortColumn, sortDirection })` | `onSortChange({ columnId, direction })` when `sort` or `defaultSort` is passed (`null` counts, `undefined` does not); without them it receives WaveUI 0.4's arguments, `(columnId, direction)` |
| DataGrid `onSelectionChange(ev, { selectedItems })`, a `Set` | `onSelectedItemsChange(ids)`, an array |
| List `onSelectionChange(ev, { selectedItems })` | `onSelectionChange(selected)`, an array |
| Card `onSelectionChange(ev, { selected })` | `onSelect()`, called on every activation without a value: you flip `selected` |
| ToggleButton: no change callback | `onPressedChange(pressed)` |

**Close reasons** of Dialog and Drawer (`DialogOpenChangeReason`, `DrawerOpenChangeReason`): Fluent's `escapeKeyDown` is `'escape'`, `backdropClick` is `'outside-press'`, and `triggerClick` is `'trigger'` (opening), `'close'` (a `Dialog.Close` part) or `'close-button'` (the built-in Close button). A controlled dialog refuses a close by not applying it, as in Fluent:

```tsx
<Dialog
  open={open}
  onOpenChange={(next, details) => {
    if (!next && details?.reason === 'outside-press') return; // unsaved changes: ignore the backdrop
    setOpen(next);
  }}
>
```

`modalType="alert"` never closes on a backdrop press, as in Fluent.

A WaveUI callback that needs the event gets it in `details` where there is one (Dialog, Drawer, Menu and Toolbar checked values); the others do not receive it. Some WaveUI components still accept an older callback name as a deprecated alias, sometimes a Fluent name with a different signature (DataGrid's `onSelectionChange`, TabList's `onTabSelect`): use the names above. The [CHANGELOG](../CHANGELOG.md) lists every deprecated alias.

### 4.2 Parts and names

Fluent exports each part on its own (`DialogTrigger`, `MenuItem`). WaveUI groups the parts under their compound (`Dialog.Trigger`, `Menu.Item`) and also exports each one under a flat name, the compound's name followed by the part's (`DialogTrigger`, `MenuItem`, `TabListTab`), which Server Components need. Most parts keep Fluent's name; these do not:

| Fluent UI v9 | WaveUI 0.7 |
|---|---|
| `DialogSurface` (and `DialogBody`) | `Dialog.Content` / `DialogContent` |
| `DialogContent` | none: put the content in `Dialog.Content` |
| `DialogActions` | `Dialog.Footer` |
| `DialogTrigger` inside the surface (a close trigger) | `Dialog.Close` |
| `PopoverSurface` | `Popover.Content` |
| `MenuPopover` and `MenuList` | `Menu.Popover` |
| `AccordionHeader` | `Accordion.Trigger` |
| `Tab` | `TabList.Tab` |
| `Radio` | `RadioGroup.Item` |
| `OverlayDrawer` | `Drawer` |
| `NavCategory`, `NavCategoryItem`, `NavSubItemGroup` | `Nav.Category` |
| `BreadcrumbItem` and `BreadcrumbButton` | `Breadcrumb.Item` |
| `CarouselCard` | `Carousel.Item` |
| `Skeleton` (the container) | `Skeleton.Group` |
| `SkeletonItem` | `Skeleton` |

**Two name traps.** WaveUI's `DialogContent` is Fluent's `DialogSurface`, not Fluent's `DialogContent`; and WaveUI's `Skeleton` is Fluent's `SkeletonItem`.

Recurring prop renames: `vertical` becomes `orientation="vertical"` (TabList, Toolbar, Divider), `intent` becomes `status` (MessageBar, Toast), `selectedValue` becomes `value`, `selectionMode="multiselect"` becomes `"multiple"`, `circular` (Carousel) becomes `loop`, and `Portal`'s `mountNode` becomes `container` (a surface's `mountNode` becomes `portalContainer` on a nested `WaveProvider`).

While both libraries are in one app, their shared names (`Button`, `Dialog`, `Field`, `MenuItem`, …) clash in imports: alias one side, for example `import { Button as WaveButton } from '@mortenbrudvik/waveui'`.

### 4.3 Where `ref` goes

In Fluent, a component's `ref` reaches its "primary slot", usually the native control, while `className` and `style` go to the root wrapper. WaveUI's composite controls (a wrapper around a focusable element: Checkbox, Switch, SpinButton, SearchBox and the pickers) keep `ref`, `className`, `style` and `data-*` on the wrapper and give the focusable element to `controlRef`; `id`, `aria-*`, `tabIndex`, focus and key handlers and native input attributes go to the focusable element ([README: Composite controls](../README.md#composite-controls)). Input, Textarea, Select and Slider render the control itself. Code that calls `ref.current.focus()` needs `controlRef` for these components:

| Component | Fluent `ref` | WaveUI `ref` | WaveUI prop that gives the element Fluent's `ref` gave |
|---|---|---|---|
| Input | the `<input>` | the `<input>` | `ref` |
| Textarea, Select | the `<textarea>` or `<select>` | the same element | `ref` |
| Slider | a hidden `<input type="range">` (the thumb is another element) | the visible `<input type="range">` | `ref` |
| Checkbox, Switch | the native `<input>` | the root `<label>` | `controlRef` (a `<button role="checkbox">` or `role="switch"`) |
| Radio | the native `<input type="radio">` | `RadioGroup.Item`'s `<button role="radio">` | `ref` |
| SpinButton, SearchBox, Combobox, DatePicker, TimePicker | the `<input>` | the wrapper `<div>` | `controlRef` |
| Dropdown | the `<button>` | the wrapper `<div>` | `controlRef` |
| TagPicker | none on the root (its parts take refs) | the wrapper `<div>` | `controlRef` (the input) |
| Link without `href` | a `<button>` | an `<a role="button">` | `ref` |

`className` differs for Input, Textarea, Select and Slider: Fluent puts it on a wrapper, WaveUI on the control itself. While an Input has `contentBefore` or `contentAfter`, its `className`, `style` and `hidden` move to a wrapper `<span>`, and its `ref` stays on the `<input>`. Checkbox, Switch and Radio are `role` buttons with a hidden input for the form, not native inputs, so read their state with `aria-checked` (`toBeChecked()` in tests) rather than the `checked` property. A typed ref (`useRef<HTMLInputElement>(null)`) no longer compiles where the element type changed, which catches most of these moves. The 1.0 release decides once for all composite controls whether `ref` moves to the focusable element.

### 4.4 Slots

- **Which props are slots.** Every Fluent part is a slot: you pass content (`icon={<Icon />}`), props (`icon={{ className }}`), a render function, or `null` to remove it. In WaveUI, the icon-like, content and dismiss props are slots (`icon`, `contentBefore`, `contentAfter`, `dismiss`, `dismissIcon`, `expandIcon`, `menuIcon`, `checkmark`, `validationMessageIcon`): each takes content, or an object with `as`, `className`, `children` and attributes ([README: Slots](../README.md#slots)). Structural parts (a Dialog's body, a Checkbox's indicator) are not slots until 0.18, and no slot takes a render function.
- **Hiding a glyph: `null` versus `false`.** Fluent removes an optional glyph with `null` (`menuIcon={null}`). In WaveUI, `null` keeps the default glyph and `false` hides it (MenuButton's `menuIcon`, the `expandIcon` of Combobox and TimePicker). SplitButton's chevron cannot be hidden. For status icons (MessageBar's `icon`, Field's `validationMessageIcon`), `null` removes the icon in both.
- **Dismiss buttons.** A `Button` passed to MessageBar's `dismiss`, SearchBox's `dismiss` or Tag's `dismissIcon` is merged into the component's own button, never nested inside it.

### 4.5 Sizes and appearances

- **Buttons.** Fluent's default `appearance="secondary"` is WaveUI's default `appearance="outline"`: the look is the same, so buttons without `appearance` need no change, and `appearance="secondary"` becomes `"outline"`. A Fluent `appearance="outline"` (transparent with a border) still compiles in WaveUI and quietly gets WaveUI's `outline`, which is the filled look of Fluent's `secondary`; the closest match is `appearance="outline"` with a `bg-transparent` class. WaveUI has no `secondary` value. `primary`, `subtle` and `transparent` match. `small`, `medium` and `large` are 24, 32 and 40px in both, and WaveUI adds `extra-small` (20px) and `extra-large` (48px). There is no `shape`: use a class (`rounded-full`).
- **Inputs and pickers** have no `size` or `appearance` until 0.9: every text input, select and picker is 32px high with an outline. On Input and Select, `size` is still the native HTML attribute (a number); 0.9 moves that attribute to `htmlSize`.
- **Other scales.** Avatar sizes are named (`extra-small` to `extra-large`, 24 to 56px) instead of Fluent's pixel values; Spinner uses WaveUI's five size names at different pixel sizes; Badge has no `tiny`; Skeleton takes `width` and `height` instead of sizes.

### 4.6 Defaults that differ

A type checker catches renamed props and changed callback signatures, but not these defaults:

| Component | What | Fluent UI v9 | WaveUI 0.7 |
|---|---|---|---|
| TabList | arrow keys | move focus (`selectTabOnFocus={false}`) | select (`selectTabOnFocus={true}`) |
| Popover | position | above, centered | below, start-aligned |
| Popover | arrow | none (`withArrow` adds one) | always drawn |
| Popover | hover opening | at once; closes 500ms after the pointer leaves | after 250ms (`openDelay`); closes after 500ms (`closeDelay`) |
| Tooltip | delays | 250ms show, 250ms hide | 200ms open, 100ms close |
| Tooltip | look | `normal` | `inverted` |
| Tooltip | `relationship` | required | optional, `description` by default |
| Menu | hover delay | 500ms (`hoverDelay`) | 250ms (`openDelay`, `closeDelay`) |
| Dialog | Close button | none in a modal dialog unless you add one | always rendered, named by `closeLabel` |
| Drawer | `position` | `start` | `end` |
| Toast | `timeout` | 3000ms | 5000ms |
| Toast | pausing | off (`pauseOnHover`, `pauseOnWindowBlur`) | always, on hover, focus, window blur and a hidden tab |
| Toast | dismiss button | none unless you add one | on every toast |
| ProgressBar | `max` | 1 | 100 |
| Rating | `size` | `extra-large` | `medium` |
| SwatchPicker | `shape` | `square` | `circular` |
| Avatar | color | `neutral` | brand |
| AvatarGroup | layout | `spread` | overlapping |
| Carousel | autoplay interval | 4000ms | 5000ms |
| SpinButton | PageUp and PageDown | change the value by `stepPage` (default 1) | by `largeStep` (default: ten times `step`) |
| Link | underline at rest | none (`inline` adds it) | always: the default `appearance` is `inline` (`standalone` and `subtle` underline on hover) |
| DataGrid | a click on a row | selects the row | does not: the row's checkbox or radio, or Space, does (row clicks in 0.14) |
| RadioGroup | `name` | generated | none unless you pass one |
| Accordion (single) | closing the open item | not possible unless `collapsible` | possible |

The other changes that compile without an error, described in the sections linked:

- **Keyboard:** the rows of [3.9](#39-keyboard-behavior); every Nav item is a Tab stop; SearchBox's clear button is a Tab stop, and Escape clears the text first; a Table that overflows becomes a focusable scroll region; any focusable control inside a Toolbar joins its arrow-key order.
- **Names, roles and elements** (which tests and screen readers see): a Dialog has no `aria-modal` ([3.8](#38-focus-modal-dialogs-and-announcements)); an unnamed SplitButton menu half is called "More options"; a ToggleButton with `role="switch"` or `"radio"` reports `aria-checked`; a named `Toolbar.Group` is a `role="group"`; the Carousel's dots are buttons, not tabs; Accordion triggers are headings (`h3` by default); MessageBar and Toast say their severity; Checkbox, Switch and Radio are buttons with `aria-checked`; a Badge is a `<span>`, a horizontal Divider an `<hr>`, and each `Overflow.Item` renders a wrapper `<div>`.
- **Props that keep their name but not their meaning:** `menuIcon={null}` shows the chevron ([4.4](#44-slots)); Button `appearance="outline"` looks like Fluent's `secondary` ([4.5](#45-sizes-and-appearances)); `className` on Input, Textarea, Select and Slider styles the control, not a wrapper ([4.3](#43-where-ref-goes)); SplitButton's `onClick` belongs to the primary action alone; Badge `color="important"` is dark orange until 1.0; Spinner's size names mean other pixel sizes.
- **Forms** ([3.10](#310-forms)): a required Field now also blocks submission while a RadioGroup or picker inside it is empty; a Dropdown, TagPicker, SwatchPicker or ColorPicker with a `name` now submits its value, and a Combobox submits its value rather than its text.
- **Behavior:** a Combobox filters its options as the user types ([5.3](#53-pickers)); a DatePicker always accepts typed dates, and a TimePicker shows 12-hour times whatever the locale; state callbacks fire only when the value changes ([4.1](#41-callbacks)); a submenu shares its parent's checked values; an InfoLabel opens on hover and focus as well as on click; a TeachingPopover does not trap focus ([5.8](#58-overlays)); an auto-playing Carousel starts paused under reduced motion.
- **Styling:** a bare `hover:` class loses to WaveUI's built-in hover colors, and the precompiled stylesheet lacks utilities that WaveUI does not use itself ([3.1](#31-styling)).
- **Looks and motion:** no open and close animations until 0.15 ([3.6](#36-motion)); the dark theme's brand fills, the warning color, the focus ring and the disabled look ([3.2](#32-themes-and-tokens)).

## 5. Component map

Each family has a table of names and, below it, what changes when you move code across. "Planned" gives the WaveUI release that the [roadmap](ROADMAP.md) plans for the missing piece; "backlog" means it is recorded but not scheduled.

### 5.1 Buttons and actions

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Button` | `Button` | `shape` (backlog) |
| `CompoundButton` | `CompoundButton` | `secondaryContent` as a slot (backlog) |
| `ToggleButton` | `ToggleButton` | `as` (backlog) |
| `MenuButton`, `SplitButton` | `MenuButton`, `SplitButton` | |
| `Link` | `Link` | |
| `Toolbar`, `ToolbarButton`, `ToolbarToggleButton`, `ToolbarRadioGroup`, `ToolbarRadioButton`, `ToolbarGroup`, `ToolbarDivider` | `Toolbar`, `Toolbar.Button`, `Toolbar.ToggleButton`, `Toolbar.RadioGroup`, `Toolbar.RadioButton`, `Toolbar.Group`, `Toolbar.Divider` | |

- **Button.** See [4.5](#45-sizes-and-appearances) for appearances and sizes. `icon`, `iconPosition`, `disabled` and `disabledFocusable` keep their names and meaning. `as` takes any element or component, a router link included (`<Button as={NextLink} href="/settings">`, with `NextLink` imported from `next/link`); Fluent's `as` takes only `button` or `a`, and a component needs a `root` slot.
- **ToggleButton.** `checked` and `defaultChecked` become `pressed` and `defaultPressed`, and WaveUI adds `onPressedChange(pressed)`; Fluent has no change callback, so you watch `onClick`. With `role="switch"`, `"radio"` or another checked role, WaveUI reports `aria-checked`; Fluent does so only for `checkbox` and `menuitemcheckbox`. `isAccessible` keeps its name.
- **MenuButton and SplitButton.** The chevron: see [4.4](#44-slots). SplitButton's primary action takes `onClick` directly (Fluent: `primaryActionButton={{ onClick }}`; a top-level `onClick` in Fluent sits on the wrapper and also fires for the menu half). Its menu half becomes the menu's trigger through `menuButtonProps` (Fluent: `menuButton`): `<Menu.Trigger>{(props) => <SplitButton menuButtonProps={props} onClick={save}>Save</SplitButton>}</Menu.Trigger>`. An unnamed menu half is called "More options" (`menuButtonLabel`); Fluent names it after the primary action.
- **Link.** Fluent's `appearance` (`default`, `subtle`) and the boolean `inline` become one `appearance`: `inline` (the default, always underlined), `standalone` or `subtle`. A Link without `href` is an `<a role="button">`, not a `<button>`.
- **Toolbar.** `vertical` becomes `orientation="vertical"`, and `onCheckedValueChange` becomes `onCheckedValuesChange(checkedValues, details)`. The parts default to the `subtle` appearance, as in Fluent, and `Toolbar.Button`'s `vertical` (icon above the label) keeps its name. A `Toolbar.Group` with an `aria-label` is a `role="group"` (Fluent: always `presentation`). Any focusable control inside a Toolbar joins its arrow-key order.

### 5.2 Form inputs

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Field` | `Field` | `size` (0.9); a render function as child (0.18) |
| `Label` | `Label` | a custom required indicator (0.9) |
| `Input` | `Input` | `size`, `appearance` (0.9) |
| `Textarea` | `Textarea` | `size`, `appearance` (0.9); `resize`, `onValueChange` (backlog) |
| `Select` | `Select` | `size`, `appearance` (0.9); an icon slot, `onValueChange` (backlog) |
| `Checkbox` | `Checkbox` | `size`, `shape` (0.9) |
| `RadioGroup`, `Radio` | `RadioGroup`, `RadioGroup.Item` | the `horizontal-stacked` layout (backlog) |
| `Switch` | `Switch` | `size` (0.9) |
| `Slider` | `Slider` | `size` (0.9); vertical sliders (backlog) |
| `SpinButton` | `SpinButton` | `size`, `appearance`, `displayValue`, an empty value, press-and-hold, `precision` (0.9) |
| `SearchBox` | `SearchBox` | `size`, `appearance` (0.9) |
| `Rating`, `RatingItem` | `Rating` | half stars, `color`, custom icons, `RatingItem` (0.9) |
| `RatingDisplay` | `RatingDisplay` | `color`, a custom icon (0.9) |

- **Field.** `label`, `hint`, `validationState`, `validationMessage`, `validationMessageIcon`, `orientation` and `required` keep their names, values and defaults, and WaveUI adds `error` as a shorthand for an error message. Field wires the control inside it by itself; instead of Fluent's render-function child (`{(props) => <MyInput {...props} />}`), a custom control calls `useFieldControl`. Give each Field one control. When the control needs a wrapper (a Tooltip, a layout row), put a plain `<div>` around the wrapper, and the Field still labels the control: `<Field label="Name"><div><Tooltip content="…"><Input /></Tooltip></div></Field>`.
- **Input.** `onChange(ev, { value })` becomes `onValueChange(value)`. `contentBefore` and `contentAfter` keep their names.
- **Textarea and Select** have only the native `onChange`: read `event.target.value`.
- **Checkbox.** Fluent's tri-state `checked: boolean | 'mixed'` becomes a boolean `checked` plus `indeterminate`, and `onChange(ev, { checked })` becomes `onCheckedChange(checked)`. The rich `label` and `labelPosition` (`before`, `after`) match. WaveUI adds `disabledFocusable`.
- **RadioGroup.** `layout` becomes `orientation` (`vertical`, `horizontal`), and `onChange(ev, { value })` becomes `onValueChange(value)`. There is no per-item change callback.
- **Switch.** `onChange(ev, { checked })` becomes `onCheckedChange(checked)`; `labelPosition` (`before`, `after`, `above`) and `disabledFocusable` match.
- **Slider.** `onChange(ev, { value })` becomes `onValueChange(value)`. It is a native range input filled up to the thumb; there is no `vertical`.
- **SpinButton.** `onChange(ev, { value, displayValue })` becomes `onValueChange(value)`, and `stepPage` becomes `largeStep`. The value is always a number: no `null` and no `displayValue` until 0.9.
- **SearchBox.** `onChange` becomes `onValueChange(value)`, and `onClear()` tells a clear apart from typing. The clear button is a Tab stop, and Escape clears the text before it reaches an enclosing dialog.
- **Rating.** `onChange(ev, { value })` becomes `onValueChange(value)`, and `itemLabel(value)` becomes `labels.star(value, max)`. WaveUI adds `disabled`, `required` and form support; whole stars only until 0.9.
- **RatingDisplay.** `value`, `max`, `count` and `compact` match; WaveUI adds `showValue` and `locale`.

### 5.3 Pickers

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Combobox`, `Option`, `OptionGroup` | `Combobox`, `Combobox.Option`, `Combobox.OptionGroup` | `size`, `appearance` (0.9); `multiselect`, custom filtering, a controllable query (0.10); `positioning` (0.12) |
| `Dropdown` | `Dropdown`, `Dropdown.Option`, `Dropdown.OptionGroup` | as Combobox; a custom chevron (0.10) |
| `Listbox` on its own | none: a selectable `List` covers most uses | `Listbox` and listbox hooks (0.10) |
| `TagPicker`, `TagPickerControl`, `TagPickerGroup`, `TagPickerInput`, `TagPickerButton`, `TagPickerList`, `TagPickerOption`, `TagPickerOptionGroup` | `TagPicker` (an `options` array) | `size` (0.9); composable parts, rich tags and options, free tagging (0.11) |
| `ColorPicker`, `ColorArea`, `ColorSlider`, `AlphaSlider` | `ColorPicker` (hex field, presets, `showOpacity`) | `ColorArea`, `ColorSlider`, a composable picker (0.8) |
| `SwatchPicker`, `ColorSwatch`, `ImageSwatch`, `EmptySwatch`, `SwatchPickerRow` | `SwatchPicker` (an `items` array) | swatch children, a grid layout, image and empty swatches, `focusMode` (0.10) |
| `DatePicker` (compat package) | `DatePicker` | `size` (0.9); month and year pickers (0.10) |
| `Calendar` (compat package) | none: the grid exists only inside DatePicker | `Calendar` (0.10) |
| `TimePicker` (compat package) | `TimePicker` | `size`, `appearance` (0.9) |

- **Combobox and Dropdown.** `selectedOptions` and `onOptionSelect(ev, { optionValue, optionText, selectedOptions })` become `value`, `defaultValue` and `onValueChange(value)`, a string (`''` for no selection). Every option needs a `value` (Fluent falls back to its text); Fluent's `text` is WaveUI's `label` (what the control shows) or `textValue` (what typeahead and filtering match). A Combobox filters its options as the user types and announces "No matches"; in Fluent you filter yourself (`useComboboxFilter`). `clearable` and `freeform` keep their names.
- **TagPicker.** Fluent assembles the picker from parts and renders the options you pass as children. WaveUI's `TagPicker` takes `options: { value, label }[]`, filters them and renders the tags itself; `selectedOptions` and `onOptionSelect` become `value` and `onValueChange(values)`.
- **ColorPicker.** Fluent's value is an HSV object (`color: { h, s, v, a }`), and you place the area and sliders inside the picker. WaveUI's `value` is a hex string (`#rrggbb`, or `#rrggbbaa` below full opacity) with `onValueChange(hex)`, and the layout is fixed: preview, hex field, preset swatches and an optional opacity slider. Convert at the boundary.
- **SwatchPicker.** `selectedValue` and `onSelectionChange(ev, { selectedValue, selectedSwatch })` become `value` and `onValueChange(value)`, with the swatches in `items: { value, color, label }[]`.
- **DatePicker.** Both take `value: Date | null`; `onSelectDate(date)` becomes `onValueChange(date)`, and WaveUI adds `defaultValue`. The input always accepts typing and validates it (`onInvalidInput(text, reason)`); Fluent accepts typing only with `allowTextInput` and reports through `onValidationResult`. Fluent's `restrictedDates: Date[]` becomes a predicate, `disabledDates: (date) => boolean`, and `firstDayOfWeek` is a number (0 is Sunday).
- **TimePicker.** Fluent's value is a `Date` (`selectedTime`, `onTimeChange(ev, { selectedTime, selectedTimeText, errorType })`); WaveUI's is an `HH:mm` string (`value`, `onValueChange`). `startHour` and `endHour` become `minTime` and `maxTime` (inclusive time strings), `increment` becomes `step` (30 minutes by default in both), and `hourCycle` becomes `format: '12h' | '24h'`, which defaults to `'12h'` whatever the locale until 1.0.

### 5.4 Data display

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Avatar` | `Avatar` | `shape`, `color`, Fluent's size range, better initials (0.13) |
| `AvatarGroup`, `AvatarGroupItem`, `AvatarGroupPopover` | `AvatarGroup` (`max`) | the `spread` and `pie` layouts, parts (0.13) |
| `Badge`, `CounterBadge` | `Badge`, `CounterBadge` | `important` as Fluent's neutral (1.0); `ghost`, `shape`, an icon (backlog) |
| `PresenceBadge` | `PresenceBadge` | Fluent's status names (0.13) |
| `Persona` | `Persona` | more text lines, `textPosition`, `huge` (0.13) |
| `Image` | `Image` | none: the same props and defaults |
| `Divider` | `Divider` | `appearance`, `inset`, `alignContent` (backlog) |
| `Text` and its presets (`Body1`, `Caption1`, `Title3`, …) | `Text` with `variant` | see [3.3](#33-typography) |
| `Tag` | `Tag` | `appearance`, `size`, `disabled`, slots (0.11) |
| `InteractionTag`, `TagGroup` | none | 0.11 |
| `List`, `ListItem` | `List`, `List.Item` | navigation without selection, `onAction`, `disabledSelection` (0.14) |
| `InfoLabel`, `InfoButton` | `InfoLabel` | rich info content, Label features, `InfoButton` (0.9) |

- **Avatar and AvatarGroup.** Initials are always brand-colored and the avatar is always circular. AvatarGroup's children are plain `Avatar`s, and its `size` sizes only the overflow button.
- **Badge and CounterBadge.** The `color` values and default are the same, and each library draws them from its own palette ([3.2](#32-themes-and-tokens)). One value differs in meaning: through 0.x, `important` renders the same dark orange as `severe` (Fluent's `important` is near black), and it becomes Fluent's neutral in 1.0. CounterBadge's `count`, `overflowCount`, `dot` and `showZero` match; its second `appearance` is `outline` (Fluent: `ghost`). A Badge renders a `<span>` (Fluent: a `<div>`).
- **PresenceBadge.** `status` is required and spells `dnd` and `oof` (Fluent: `do-not-disturb`, `out-of-office`); there is no `blocked`, `unknown` or `outOfOffice`.
- **Persona.** `name` (a required string) and `secondaryText`; there are no third and fourth lines.
- **Divider.** `vertical` becomes `orientation="vertical"`; a plain horizontal divider renders an `<hr>`.
- **Tag.** `dismissible` and `onDismiss()` sit on the tag itself; Fluent routes dismissal through `TagGroup`'s `onDismiss`. Until TagGroup exists, move focus yourself before removing a tag ([README: Tags](../README.md#tags)).
- **List.** Selection needs `selectable`; `selectionMode` is `single` or `multiple` (Fluent: `multiselect`), item values are strings, and `onSelectionChange(selected)` receives the array. An item `action` turns the list into a grid with row actions, which Fluent's List has no equivalent for.
- **InfoLabel.** `label` and `info` are strings, and the info opens on hover, focus and click (Fluent's InfoButton opens on click only). It cannot be a Field's label yet.

### 5.5 Feedback

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `MessageBar`, `MessageBarBody`, `MessageBarTitle`, `MessageBarActions` | `MessageBar` (one component) | `MessageBar.Title`, `MessageBar.Actions`, reflow (0.8) |
| `MessageBarGroup` | none | with motion (0.15) |
| `Toaster`, `useToastController`, `Toast`, `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastTrigger` | `Toaster`, `useToastController`, `Toast` | React content and toast parts, a keyboard shortcut to reach the toasts (0.8) |
| `ProgressBar` | `ProgressBar` | `shape`, `thickness` (backlog) |
| `Spinner` | `Spinner` | `labelPosition` (backlog) |
| `Skeleton`, `SkeletonItem` | `Skeleton.Group`, `Skeleton` | a shimmer animation, size presets (backlog) |

- **MessageBar.** `intent` becomes `status` (the same four values, `info` by default). The content is `children`: there are no title or actions parts yet. `onDismiss` adds a dismiss button.
- **Toasts.** `dispatchToast(<Toast><ToastTitle>…</ToastTitle></Toast>, { intent, timeout })` becomes `dispatchToast({ status, title, body, timeout })`, with plain strings until 0.8, and returns the toast's id. `useToastController()` works under a `<Toaster>` ancestor; there is no `toasterId`. The `Toast` component renders one toast in place, as its own live region. `position` takes the four logical corners (`bottom-end`, …) and the four physical ones (`top-left`, …), but not Fluent's centered `top` and `bottom`; the default is `bottom-end` in both. For the timing and dismiss defaults, see [4.6](#46-defaults-that-differ).
- **ProgressBar.** `max` defaults to 100 (Fluent: 1), so a Fluent `value={0.5}` shows 0.5%: pass `max={1}` or scale the value. `color` has the same four values, and inside a Field the bar takes its color from the validation state.
- **Spinner.** `label` is a string; `delay` and `appearance="inverted"` match.
- **Skeleton.** Fluent's `SkeletonItem` is WaveUI's `Skeleton`, a placeholder with `width`, `height` and `shape` (`circular`, `square`, `rounded`), and Fluent's `Skeleton` container is `Skeleton.Group`, which marks the region busy. The animation is a pulse.

### 5.6 Layout and disclosure

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Card`, `CardHeader`, `CardFooter` | `Card`, `Card.Header`, `Card.Body`, `Card.Footer` | `appearance`, `size`, `orientation`, header image and action slots (0.13) |
| `CardPreview` | none: the Card has no padding, so media reaches its edges | 0.13 |
| `Accordion`, `AccordionItem`, `AccordionHeader`, `AccordionPanel` | `Accordion`, `Accordion.Item`, `Accordion.Trigger`, `Accordion.Panel` | collapse motion (0.15); header sizes and icons (backlog) |
| `Carousel` and its parts | `Carousel`, `Carousel.Item`, with built-in controls | groups, swiping, thumbnails, control layouts (0.13) |
| `TabList`, `Tab` | `TabList`, `TabList.Tab`, and `TabList.Panel`, `TabList.Panels` | `appearance`, `size`, icons (0.13) |
| `Tree`, `TreeItem`, `TreeItemLayout` | `Tree`, `Tree.Item` | multi-select, row actions (0.8) |
| `FlatTree` | none | 0.16 |
| `Overflow`, `OverflowItem`, `OverflowDivider` | `Overflow`, `Overflow.Item` | priority, pinned items, start direction, groups (0.14) |
| `OverlayDrawer`, `DrawerHeader`, `DrawerHeaderTitle`, `DrawerBody`, `DrawerFooter` | `Drawer`, `Drawer.Title`, `Drawer.Trigger`, `Drawer.Close` | sizes, the bottom position, header and footer parts (0.11) |
| `InlineDrawer` | none | 0.11 |

- **Card.** Fluent's `selected`, `defaultSelected` and `onSelectionChange` become a controlled `selected` and `onSelect()`, which is called on every activation, so you flip `selected` yourself; `selectionControl` chooses whether the whole card or a checkbox selects it. `Card.Header` takes `title` and `subtitle`, and the main content goes in `Card.Body`.
- **Accordion.** A single-mode Accordion takes `openItem`, `defaultOpenItem` and `onOpenItemChange(item)`; Fluent's `multiple` becomes `type="multiple"` with `openItems` and `onOpenItemsChange(items)`. The triggers sit in headings (`headingLevel`, 3 by default). Items cannot be disabled.
- **Carousel.** `activeIndex` and `onActiveIndexChange(ev, { index, type })` become `value` and `onValueChange(index)`, and `circular` becomes `loop`. The dots, previous and next buttons and the pause button (`autoPlay`) are built in. Its dot picker is a group of buttons with `aria-current` (Fluent: a tab list).
- **TabList.** `selectedValue` and `onTabSelect(ev, { value })` become `value` and `onValueChange(value)`, and `vertical` becomes `orientation="vertical"`. Set `selectTabOnFocus={false}` to keep Fluent's keyboard behavior. `TabList.Panel` pairs a panel with its tab.
- **Tree.** `openItems` and `onOpenChange(ev, data)` become `expandedItems` and `onExpandedItemsChange(items)`. An item's text is its children, next to its nested `Tree.Item`s; an item with nested items is a branch (Fluent's `itemType`), and `leaf` forces a leaf. Items cannot be disabled, and selection is single (`selected`, `onItemSelect(value)`) until 0.8.
- **Overflow.** `OverflowItem`'s `id` becomes `itemId`, and each item renders its own wrapper `<div>` (Fluent clones its child). There is no `onOverflowChange`: `useOverflowMenu()` gives the hidden items.
- **Drawer.** `OverlayDrawer` is `Drawer`, with `position` `start`, `end`, `left` or `right`, and a fixed 320px width (Fluent's `small`). `Drawer.Trigger` and `Drawer.Close` make it usable without state of your own; Fluent's overlay drawer is controlled only. `onOpenChange` has Dialog's shape and reasons. The header (`title`, and a Close button named by `closeLabel`) is built in.

### 5.7 Navigation

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Menu`, `MenuTrigger`, `MenuPopover`, `MenuList`, `MenuItem`, `MenuDivider` | `Menu`, `Menu.Trigger`, `Menu.Popover`, `Menu.Item`, `Menu.Divider` | `onOpenChange` details, `subText`, `secondaryContent` (backlog) |
| `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemSwitch`, `MenuItemLink` | `Menu.ItemCheckbox`, `Menu.ItemRadio`, `Menu.ItemSwitch`, `Menu.ItemLink` | |
| `MenuGroup`, `MenuGroupHeader`, `MenuSplitGroup` | `Menu.Group`, `Menu.GroupHeader`, `Menu.SplitGroup` | |
| `MenuGrid` (preview) | none | not planned |
| `Nav`, `NavItem`, `NavCategory`, `NavCategoryItem`, `NavSubItemGroup`, `NavSubItem` | `Nav`, `Nav.Item`, `Nav.Category`, `Nav.SubItem` | density, single-open categories (backlog) |
| `NavDrawer`, `NavDrawerHeader`, `NavDrawerBody`, `NavDrawerFooter`, `Hamburger`, `NavSectionHeader`, `NavDivider`, `AppItem`, `SplitNavItem` | none | 0.11 |
| `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbButton`, `BreadcrumbDivider` | `Breadcrumb`, `Breadcrumb.Item`, with built-in separators | overflow, sizes, a focus mode (0.14) |

- **Menu.** `MenuPopover` and `MenuList` are one part, `Menu.Popover`; a Menu without a trigger and a popover is a static menu. Positioning moves from `Menu`'s `positioning` to `Menu.Popover`'s `side`, `align`, `offset` and `target`. `checkedValues`, `defaultCheckedValues`, `openOnHover`, `openOnContext` and `persistOnItemClick` keep their names. Submenus are nested `<Menu>`s, as in Fluent, but they share their parent's checked values unless they set their own. WaveUI lines up the icon and check columns by itself (Fluent: `hasIcons`, `hasCheckmarks`). For the keyboard differences, see [3.9](#39-keyboard-behavior).
- **Nav.** `selectedValue` and `onNavItemSelect(ev, { value, categoryValue })` become `value` and `onValueChange(value)`; `openCategories` keeps its name, with `onOpenCategoriesChange(categories)`. `Nav.Category` (`value`, `label`, `icon`) replaces Fluent's category, its toggle item and its sub-item group. A collapsed category that holds the current page is marked by itself; Fluent needs `selectedCategoryValue`. Nav renders a `<nav>` landmark with lists, and every item is a Tab stop.
- **Breadcrumb.** `BreadcrumbItem` and `BreadcrumbButton` become one `Breadcrumb.Item` (`current`, `disabled`, `icon`; a link with `href`, else a button), and the separators are automatic.

### 5.8 Overlays

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Dialog`, `DialogTrigger`, `DialogSurface`, `DialogBody`, `DialogTitle`, `DialogContent`, `DialogActions` | `Dialog`, `Dialog.Trigger`, `Dialog.Content`, `Dialog.Title`, `Dialog.Footer`, `Dialog.Close` | `modalType="non-modal"`, backdrop options (0.11); motion (0.15) |
| `Popover`, `PopoverTrigger`, `PopoverSurface` | `Popover`, `Popover.Trigger`, `Popover.Content` | `positioning` (0.12); `trapFocus`, `withArrow`, `inline`, appearances (backlog) |
| `Tooltip` | `Tooltip` | `relationship="inaccessible"`, an arrow (backlog) |
| `TeachingPopover` and its parts | `TeachingPopover` (a `steps` array) | custom footer actions, composable parts (0.14) |
| `Portal`, `PortalMountNodeProvider` | `Portal`, `WaveProvider` `portalContainer` | |

- **Dialog.** `Dialog.Content` is both the surface and the scrolling body: put the content in it directly, the title in its `title` prop (or a `Dialog.Title`), and the actions in `Dialog.Footer`, which stays in view while the body scrolls. It always renders a Close button, so drop the one you added to Fluent's title. `modalType` takes `modal` and `alert`; `non-modal` comes in 0.11. `Dialog.Content` also takes `size` (`small`, `medium`).
- **Popover.** `positioning` becomes `side` and `align` on `Popover`. `openOnHover` keeps its name, and Fluent's `mouseLeaveDelay` becomes `closeDelay`.
- **Tooltip.** `visible` and `onVisibleChange(ev, { visible })` become `open` and `onOpenChange(open)`, and `showDelay` and `hideDelay` become `openDelay` and `closeDelay`. The text is in the server HTML.
- **TeachingPopover.** Fluent builds a tour from Popover parts; WaveUI takes `steps` (`{ title, body }`), `activeStep` and `onStepChange(step)`, with built-in Back, Next and Done buttons (`labels` translates them). Without `target` it renders inline. It does not trap focus; Fluent's does by default.
- **Portal.** `mountNode` becomes `container`, and `PortalMountNodeProvider` becomes `portalContainer` on a nested `WaveProvider`.

### 5.9 Tables

| Fluent UI v9 | WaveUI 0.7 | Not in WaveUI yet (planned) |
|---|---|---|
| `Table`, `TableHeader`, `TableHeaderCell`, `TableBody`, `TableRow`, `TableCell` | `Table`, `Table.Header`, `Table.HeaderCell`, `Table.Body`, `Table.Row`, `Table.Cell` | sortable headers, `TableSelectionCell`, `TableCellLayout`, `TableCellActions` (0.14); `TableResizeHandle`, rendering without table elements (0.16); `size` (backlog) |
| `DataGrid`, `DataGridHeader`, `DataGridHeaderCell`, `DataGridBody`, `DataGridRow`, `DataGridCell` | `DataGrid`, `DataGrid.Header`, `DataGrid.HeaderCell`, `DataGrid.Body`, `DataGrid.Row`, `DataGrid.Cell` | column `compare` and built-in sorting (0.14); column resizing, headless state, virtualization (0.16) |
| `createTableColumn`, `useTableFeatures`, `useTableSort`, `useTableSelection` | the `DataGridColumn` type (`{ id, label, sortable }`) | 0.14 and 0.16 |

- **Table.** The parts map one to one. WaveUI adds `striped`, and makes an overflowing table a focusable scroll region.
- **DataGrid.** The largest rewrite in a migration. Fluent generates the rows from `items` and `columns`. WaveUI's `columns` (`{ id, label, sortable }`, with a string `label`) generate only the header row, unless you render a `DataGrid.Header` yourself, and you render the rows:

  ```tsx
  // Fluent UI v9
  const columns: TableColumnDefinition<Person>[] = [
    createTableColumn<Person>({
      columnId: 'name',
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => 'Name',
      renderCell: (person) => person.name,
    }),
  ];

  <DataGrid items={people} columns={columns} getRowId={(p) => p.id} sortable selectionMode="multiselect">
    <DataGridHeader>
      <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
    </DataGridHeader>
    <DataGridBody<Person>>
      {({ item, rowId }) => (
        <DataGridRow<Person> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
      )}
    </DataGridBody>
  </DataGrid>
  ```

  ```tsx
  // WaveUI 0.7: the grid never reorders rows, so you sort them yourself (here by the one sortable column)
  const columns: DataGridColumn[] = [{ id: 'name', label: 'Name', sortable: true }];

  const [sort, setSort] = React.useState<DataGridSort | null>(null);
  const rows = React.useMemo(() => {
    if (!sort) return people;
    const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
    return sort.direction === 'ascending' ? sorted : sorted.reverse();
  }, [people, sort]);

  <DataGrid aria-label="People" columns={columns} sort={sort} onSortChange={setSort} selectionMode="multiple">
    <DataGrid.Body>
      {rows.map((person) => (
        <DataGrid.Row key={person.id} rowId={person.id}>
          <DataGrid.Cell>{person.name}</DataGrid.Cell>
        </DataGrid.Row>
      ))}
    </DataGrid.Body>
  </DataGrid>
  ```

  `getRowId` becomes `rowId` (a string) on each `DataGrid.Row`, `selectionMode="multiselect"` becomes `"multiple"`, selection is `selectedItems` or `defaultSelectedItems` with `onSelectedItemsChange(ids)`, and `DataGridSort` is `{ columnId, direction: 'ascending' | 'descending' }`. Pass `sort` (or `defaultSort`, which lets the grid keep the sort state) whenever you handle `onSortChange`, as above: without either, the callback receives WaveUI 0.4's `(columnId, direction)` arguments instead of the object. The two forms are separate prop types, so TypeScript flags a handler written for the other one. Until 0.16, selection covers only the rendered rows: select-all selects those, and rows that are filtered out or on another page drop out of the selection on its next change. A click on a row does not select it until 0.14 (Fluent's does). WaveUI's DataGrid is a native `<table role="grid">` and names each row's checkbox after the row's first cell ([README: Sorting and selecting in a DataGrid](../README.md#sorting-and-selecting-in-a-datagrid)).

## 6. Only in WaveUI

**Components and parts with no counterpart in `@fluentui/react-components`:**

- **Pagination:** page buttons with ellipses, previous and next, optional first and last, and boundary buttons that stay focusable.
- **Stepper:** multi-step progress (`Stepper.Step`), horizontal or vertical, optionally `linear`, with completed and error states.
- **Stack, Flex and Grid:** layout primitives with named gap sizes and a polymorphic `as`. Fluent v9 has only migration shims for them (StackShim, FlexShim, GridShim).
- **Tab panels:** `TabList.Panel` and `TabList.Panels`, wired to their tabs in both directions.
- **Drawers without state:** `Drawer.Trigger` and `Drawer.Close`.
- **DatePicker and TimePicker in the main package.** Fluent ships them as separate compat packages.
- **Hooks:** `useControllable` (Fluent does not export its `useControllableState` from the main package) and `useIsOverflowing` for truncated text.
- **An `error` prop on Input, Select and Textarea.** In Fluent, errors go through Field only.

**Behavior built into WaveUI** (where Fluent differs, the bullet says how):

- **Native forms.** Every value control and picker takes part in `<form>` submission (under a `name`), validation and reset ([3.10](#310-forms)).
- **Announcements without a provider.** `announce()` and the live regions of MessageBar, Toast and the pickers work without setup; Fluent's `useAnnounce` needs an announcer that you mount.
- **Toasts** pause on hover, focus, window blur and a hidden tab (in Fluent, pausing is opt-in), stay reachable by Tab over an open Dialog, and move out of the way of an open Drawer. MessageBar and Toast say their severity ("Warning"), and the text can be translated.
- **Server HTML.** A Tooltip's text and a closed picker's options are in the server HTML; Fluent renders no tooltip on the server.
- **Dialog isolation with `inert`** instead of `aria-modal`, so toasts and live regions stay available to assistive technology while a dialog is open. Fluent can switch to `inert` too (`inertTrapFocus`); WaveUI's isolation also exempts its toasts and live regions. `finalFocusRef` and a documented chain of fallbacks decide where focus returns ([README: Dialogs and triggers](../README.md#dialogs-and-triggers)).
- **Structure and names.** Accordion triggers sit in real headings and their panels are labelled regions; Nav is a `<nav>` landmark with lists; a Tag's dismiss button is named after the tag ("Dismiss Cherry"); a Persona is announced once; DataGrid is a native `<table role="grid">` that names each row's selection control after the row.
- **Carousel** has the full APG rotation control and starts paused under reduced motion.
- **Development warnings** for unnamed controls, duplicate values (two tabs or options with the same value), and parts used in the wrong place.
- **Contrast checks.** WaveUI's test suite checks every text and non-text token pair of all three themes against the WCAG contrast ratios.

## 7. Not in WaveUI yet

The [roadmap](ROADMAP.md) plans to close every high- and medium-impact gap of the gap analysis by 1.0, one theme per minor release. The versions below are the roadmap's plan, not dates: a release ships when its work is done. For a sense of pace: WaveUI 0.1 came out in March 2026 and 0.7 on 2026-09-26; 0.6 and 0.7 were the first two phases of the roadmap.

| Fluent UI v9 capability | WaveUI 0.7 | Planned |
|---|---|---|
| Toasts with React content (actions, links, progress), toast parts, `ToastTrigger`, a keyboard shortcut to reach the toasts | `dispatchToast({ title, body })` with strings | 0.8 |
| `MessageBarTitle`, `MessageBarActions`, reflow | one MessageBar with children | 0.8 |
| `ColorArea`, `ColorSlider`, a composable ColorPicker | hex field, presets, opacity slider | 0.8 |
| Tree multi-select with checkboxes and a mixed state; row actions | single selection | 0.8 |
| Static class names on every component and part (`.fui-Button__icon`) | `data-*` attributes | 0.8 |
| `size` and `appearance` on inputs and pickers | one size (32px), outline look | 0.9 |
| SpinButton `displayValue`, an empty value, press-and-hold; Rating half stars, icons and colors | whole values | 0.9 |
| InfoLabel as a Field label, rich info content, `InfoButton` | string info | 0.9 |
| Multi-select Dropdown and Combobox; custom filtering; a standalone Listbox | single value | 0.10 |
| SwatchPicker children, grid, image and empty swatches | `items` array | 0.10 |
| A standalone Calendar; month and year pickers | grid inside DatePicker | 0.10 |
| Tag `appearance`, `size`, `disabled`; TagGroup; InteractionTag; a composable TagPicker | plain Tag | 0.11 |
| Drawer sizes, the bottom position, header and footer parts; non-modal Dialog and Drawer; InlineDrawer; NavDrawer and Hamburger | a modal side Drawer | 0.11 |
| Public positioning, dismiss and modal-layer hooks; a `positioning` prop | internal | 0.12 |
| Grid and group keyboard navigation hooks (tabster's `useArrowNavigationGroup`, `useFocusableGroup`) | `useRovingTabIndex` | 0.12 |
| Avatar shapes, colors and Fluent's sizes; AvatarGroup layouts; Persona lines and positions; Fluent's PresenceBadge names | see [5.4](#54-data-display) | 0.13 |
| Card appearances and header slots, `CardPreview`; Carousel groups, swiping and thumbnails; TabList appearances, sizes and icons | one look each | 0.13 |
| Overflow priority and start direction; Breadcrumb overflow | overflow from the end | 0.14 |
| DataGrid column definitions with `compare` and built-in sorting; row-click selection; Table selection cells, cell layouts and cell actions | controlled sorting | 0.14 |
| List navigation without selection and `onAction`; TeachingPopover custom actions and parts | selectable List; a `steps` array | 0.14 |
| Enter and exit motion on Dialog, Drawer, Popover, Tooltip, Accordion and Tree; motion slots | `Presence`; classes you add to `Menu.Popover` | 0.15 |
| Headless table state, selection of rows that are not rendered, resizable columns, virtualization of DataGrid, List, Tree and Combobox | rendered rows only | 0.16 |
| Theme objects that reach portals, a brand ramp generator, typed tokens, spacing and palette tokens, monospace and numeric fonts, a medium weight | CSS variables | 0.17 |
| Charts (`@fluentui/react-charts`) | none | not planned: 0.17 ships a guide for pairing a chart library with the tokens |
| Slots for structural parts, render-function children, public contexts and recomposition hooks | icon and content slots | 0.18 |
| Namespaced utilities that cannot collide with an app's Tailwind or shadcn/ui classes | unprefixed color utilities | 1.0 |

**Not planned:** Fluent's preview packages (MenuGrid, the ready-made motion components, the headless components), a CSS-in-JS runtime, an icon set, the v8 and v0 migration shims, `targetDocument` and Shadow DOM mount nodes (until there is demand), and pixel parity with Fluent's themes.

## 8. Migrating a Fluent UI v9 app

### 8.1 Steps

There is no codemod. A type checker finds most renamed props, changed callbacks and moved refs; [4.6](#46-defaults-that-differ) gathers the changes it does not find.

1. **Check the requirements.** React 19; Chrome and Edge 111+, Safari 16.4+, Firefox 128+ (the enter motion of `Presence` needs Chrome 117, Safari 17.5 or Firefox 129, and older browsers skip it); and one styling path: the precompiled stylesheet, or Tailwind CSS 4.1+ ([README: Requirements](../README.md#requirements)).
2. **Install and add the styles.** `npm install @mortenbrudvik/waveui`. Then either import the precompiled stylesheet once (`@mortenbrudvik/waveui/styles`, the same file as `/styles.css`), or add WaveUI's Tailwind entry to your own Tailwind build, as below; it brings the `@source` for WaveUI's components. Do not add both. The one exception is an app whose own Tailwind theme uses WaveUI's color names (shadcn/ui, for example): it prefixes its own Tailwind build and loads the precompiled stylesheet into a layer, as in [3.1](#31-styling).

   ```css
   /* app/globals.css, on the Tailwind path */
   @import 'tailwindcss';
   @import '@mortenbrudvik/waveui/tailwind';
   ```

3. **Add `WaveProvider`, and a `Toaster` if the app shows toasts.** Both can sit in the root layout, which stays a Server Component:

   ```tsx
   // app/layout.tsx
   import './globals.css'; // without Tailwind: import '@mortenbrudvik/waveui/styles';
   import { Toaster, WaveProvider } from '@mortenbrudvik/waveui';

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html lang="en">
         <body>
           <WaveProvider theme="light">
             <Toaster>{children}</Toaster>
           </WaveProvider>
         </body>
       </html>
     );
   }
   ```

   `webLightTheme` becomes `theme="light"`, `webDarkTheme` `"dark"` and `teamsHighContrastTheme` `"high-contrast"`; `teamsLightTheme` and `teamsDarkTheme` have no counterpart, and `dir` keeps its meaning. The provider renders a `<div class="wave-root">` that paints the theme's background, text color and font. To switch themes at runtime (a user setting, `prefers-color-scheme`), render `WaveProvider` from a small client component that holds the theme, as you would for `FluentProvider`.
4. **Bring your brand.** The `BrandVariants` ramp you passed to `createLightTheme` becomes one CSS rule, key for key. Both the light and the dark theme read the ramp; high contrast keeps its own colors. Load the rule after WaveUI's stylesheet (on the Tailwind path, any unlayered rule wins):

   ```css
   :root {
     --wave-brand-10: #1f0c38; /* brand[10] */
     --wave-brand-20: #2b1150; /* brand[20] */
     /* … brand[30] to brand[150] … */
     --wave-brand-160: #f3edfb; /* brand[160] */
   }
   ```

   Tokens you overrode on top of the generated theme become overrides of WaveUI's variables for that theme: `:root, .wave-light { --wave-primary: … }` for light, `.wave-dark { … }` for dark. Check the contrast of your brand against `--wave-primary-foreground`, in the dark theme too, where `primary` is brand 110 with black text ([README: Customizing tokens](../README.md#customizing-tokens)).
5. **Replace `makeStyles`** with Tailwind classes, or with CSS that reads the `--wave-*` variables ([3.1](#31-styling), [3.2](#32-themes-and-tokens)). Write logical properties for right-to-left ([3.5](#35-right-to-left)).
6. **Replace the components**, a screen or a family at a time, with the [component map](#5-component-map): rename the parts, move each state callback to the value-first form, and use `controlRef` where your code used a composite control's `ref`. Then go through the [defaults that differ](#46-defaults-that-differ).
7. **Keep your icons.** `@fluentui/react-icons` work in WaveUI's icon props; see [3.5](#35-right-to-left) for their direction.
8. **Drop Fluent's server setup** (`RendererProvider`, `createDOMRenderer`, `SSRProvider`, `renderToStyleElements`) once no Fluent component is left, and use flat part names in Server Components.

### 8.2 Running both libraries side by side

The two libraries can share an app while you migrate:

- **Styles.** Fluent's classes are generated names (and `fui-*`), and its variables sit on the `FluentProvider` element; WaveUI's variables are `--wave-*`. WaveUI's base styles apply inside `.wave-root` (the `WaveProvider` element) and `.wave-portal` at zero specificity: Fluent components inside a `WaveProvider` keep the styles they set, while native elements of your own there (a `<ul>`, an `<h2>`, a `<button>`) get WaveUI's reset.
- **Providers.** Both providers can wrap the whole app, in either order. Keep their themes in step (`webDarkTheme` with `theme="dark"`) and your brand in both.
- **Imports.** Alias the names both libraries export (`Button`, `Dialog`, `Field`, …): see [4.2](#42-parts-and-names).
- **Move each dialog together with everything inside it.** A WaveUI Dialog or Drawer makes everything outside its own layers `inert`, including elements added while it is open. A Fluent Menu, Popover, Combobox list or Tooltip opened from inside it renders at the end of `document.body` and cannot be used, and Fluent's toasts are inert too while it is open. In the other direction, a Fluent modal Dialog confines focus to its surface, and a WaveUI popup opened from inside it renders outside that surface.
- **Toasts.** Each library's `useToastController` reaches only its own Toaster: keep one of each until the last Fluent toast is migrated.
- **Server rendering.** Keep Griffel's server setup until the last Fluent component is gone.
- **Charts.** `@fluentui/react-charts` is built on Fluent v9, so it can stay after the migration, inside a `FluentProvider`.
- **Tailwind.** If your app has its own Tailwind build, check its color utility names against WaveUI's ([3.1](#31-styling)).
- **Size.** Until the migration ends, the app ships both libraries.

### 8.3 Example

A rename dialog with a form and a toast, in Fluent UI v9:

```tsx
'use client';
import * as React from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  DialogTrigger, Dropdown, Field, Input, Option, Toast, ToastTitle, makeStyles, tokens,
  useToastController,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  fields: { display: 'flex', flexDirection: 'column', rowGap: tokens.spacingVerticalM },
});

export function RenameDialog({ toasterId }: { toasterId: string }) {
  const styles = useStyles();
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState<string>();
  const { dispatchToast } = useToastController(toasterId);
  const save = () =>
    dispatchToast(<Toast><ToastTitle>Project renamed</ToastTitle></Toast>, { intent: 'success' });

  return (
    <Dialog>
      <DialogTrigger disableButtonEnhancement>
        <Button>Rename</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Rename project</DialogTitle>
          <DialogContent className={styles.fields}>
            <Field label="Name" required>
              <Input value={name} onChange={(_, data) => setName(data.value)} />
            </Field>
            <Field label="Role">
              <Dropdown
                selectedOptions={role ? [role] : []}
                onOptionSelect={(_, data) => setRole(data.optionValue)}
              >
                <Option value="owner">Owner</Option>
                <Option value="viewer">Viewer</Option>
              </Dropdown>
            </Field>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button>Cancel</Button>
            </DialogTrigger>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" onClick={save}>
                Save
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
```

The same dialog in WaveUI 0.7. `Stack` replaces the `makeStyles` column (its default gap is 12px, Fluent's `spacingVerticalM`), `Dialog.Content` takes the title and draws the Close button, and `Dialog.Close` replaces the close triggers:

```tsx
'use client';
import * as React from 'react';
import { Button, Dialog, Dropdown, Field, Input, Stack, useToastController } from '@mortenbrudvik/waveui';

// Render it inside a <Toaster> (the layout of 8.1 has one): useToastController() finds the nearest.
export function RenameDialog() {
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const { dispatchToast } = useToastController();
  const save = () => dispatchToast({ status: 'success', title: 'Project renamed' });

  return (
    <Dialog>
      <Dialog.Trigger>
        <Button>Rename</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Rename project">
        <Stack>
          <Field label="Name" required>
            <Input value={name} onValueChange={setName} />
          </Field>
          <Field label="Role">
            <Dropdown value={role} onValueChange={setRole}>
              <Dropdown.Option value="owner">Owner</Dropdown.Option>
              <Dropdown.Option value="viewer">Viewer</Dropdown.Option>
            </Dropdown>
          </Field>
        </Stack>
        <Dialog.Footer>
          <Dialog.Close>
            <Button>Cancel</Button>
          </Dialog.Close>
          <Dialog.Close>
            <Button appearance="primary" onClick={save}>
              Save
            </Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
```

### 8.4 Tests

- **Queries by role and accessible name** mostly keep working, and they are how WaveUI's own tests are written. The exceptions are the role and name changes listed in [4.6](#46-defaults-that-differ) (Carousel dots, SplitButton's menu half, `Toolbar.Group`, ToggleButton with a checked role).
- **Class selectors** such as `.fui-MenuItem` have no WaveUI counterpart (WaveUI adds stable class names of its own in 0.8): query by role (`getByRole('menuitem', { name: 'Edit' })`) or by `data-*` attribute (`[data-checked]`, `[data-state=open]`).
- **Callback assertions change shape:** `expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }))` for a Dialog, `toHaveBeenCalledWith('owner')` for a value callback.
- **ARIA differs in places:** a WaveUI Dialog has no `aria-modal`; Checkbox, Switch and Radio are buttons with `aria-checked` (`toBeChecked()` works, the `checked` property does not); a ToggleButton with `role="switch"` reports `aria-checked`, not `aria-pressed`.
- **Development warnings.** WaveUI logs `[WaveUI]` warnings in development for unnamed controls, duplicate values and misplaced parts. Expect them in test output while you migrate, and fix what they point at.

## 9. Sources and method

- **Versions:** WaveUI 0.7.0 (the repository at `bcbdb51`, identical to the npm package) and `@fluentui/react-components` 9.74.9 with its sub-packages (for example `react-menu` 9.25.6, `react-dialog` 9.18.5, `react-combobox` 9.17.7), plus `@fluentui/react-datepicker-compat` 0.6.39, `@fluentui/react-timepicker-compat` 0.4.41 and `@fluentui/react-calendar-compat` 0.4.7.
- **Method:** each claim about Fluent was checked against the published type declarations and compiled source of those packages, and against microsoft/fluentui at `8add8c8` (2026-09-26) for defaults and behavior. Each claim about WaveUI was checked against its source and README. The planned releases come from the [roadmap](ROADMAP.md), which schedules the gaps of the [gap analysis](research/fluent-ui-v9-comparison.md) by their ids.
- **Sizes:** esbuild 0.28.2, `--bundle --minify --format=esm --platform=browser --target=es2022`, `process.env.NODE_ENV` set to `"production"`, `react`, `react-dom` and `react/jsx-runtime` external, gzip at level 9, React 19.3.0. Each probe re-exports the named components (`export { Button } from '…'`). The numbers depend on the bundler and on how dependency versions resolved on 2026-09-26. WaveUI's CHANGELOG reports smaller numbers for itself because it measures with its dependencies external.
- **Fluent facts from its documentation:** the browser support matrix (the Fluent UI React v9 docs, "Browser Support Matrix"), the server-rendering setup (Griffel's SSR guide), and the release history (npm: 9.0.0 on 2022-06-28, 243 stable 9.x releases since).
- **Keep it current.** Update this guide with each WaveUI minor release: [section 7](#7-not-in-waveui-yet) and the "planned" columns follow the roadmap, and the gap analysis holds the detail per gap.
