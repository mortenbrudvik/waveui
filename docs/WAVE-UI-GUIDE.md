# @mortenbrudvik/waveui — Design & Development Guide

> **This documents the `@mortenbrudvik/waveui` library**: a standalone React 19 + Tailwind CSS 4 component library inspired by the Fluent UI 2 design language, themed with `--wave-*` CSS custom properties. It is **not** Microsoft's official `@fluentui/react-components` package.

A reference for designing and building features with this library: design principles, tokens, component architecture, accessibility, theming and common patterns. Installation, style entries and the React Server Components setup are in the [README](../README.md); every change since 0.4 is in the [CHANGELOG](../CHANGELOG.md).

### How this differs from official Fluent UI

| | **This library (`@mortenbrudvik/waveui`)** | **Official (`@fluentui/react-components`)** |
|---|---|---|
| **Styling** | Tailwind CSS utilities + `--wave-*` CSS variables (`src/styles/tokens.css`); precompiled `styles.css` for apps without Tailwind | Griffel CSS-in-JS + `makeStyles()` |
| **Class merging** | `cn()` (clsx + tailwind-merge, extended with Wave's scales) | `mergeClasses()` |
| **Theming** | `WaveProvider` + theme classes (`wave-light`, `wave-dark`, `wave-high-contrast`) that set `--wave-*` variables | `FluentProvider` with JS theme objects |
| **Slot system** | `resolveSlot()` / `renderSlot()` (lightweight) | `slot()` / `resolveShorthand()` |
| **State hooks** | `useControllable()` | `useControllableState()` |
| **Keyboard navigation** | `useRovingTabIndex`, a listbox hook and grid navigation, hand-rolled per WAI-ARIA APG pattern | Tabster |
| **Positioning** | `@floating-ui/react-dom` | Floating UI (own wrapper) |
| **Motion** | Tailwind classes on the presence core's `data-presence` phases; `motion` slots and `WaveProvider motion` | `@fluentui/react-motion` (Web Animations) with `surfaceMotion`-style slots and `MotionBehaviourProvider` |
| **Package** | npm: `@mortenbrudvik/waveui` | npm: `@fluentui/react-components` |

All APIs, token values and patterns below refer to **this library's implementation**, not the official Microsoft package.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Layout & Spacing](#2-layout--spacing)
3. [Typography](#3-typography)
4. [Color System](#4-color-system)
5. [Elevation & Shadows](#5-elevation--shadows)
6. [Motion & Animation](#6-motion--animation)
7. [Iconography](#7-iconography)
8. [Component Architecture](#8-component-architecture)
9. [Accessibility](#9-accessibility)
10. [Theming](#10-theming)
11. [Common UI Patterns](#11-common-ui-patterns)
12. [Quick Reference](#12-quick-reference)
13. [Deprecated APIs](#13-deprecated-apis)

---

## 1. Design Principles

This library follows the **Wave UI design principles**, inspired by the Fluent UI 2 design language: coherent, accessible, productivity-focused experiences. We adopt the visual language and interaction patterns, implemented with our own React + Tailwind CSS stack.

### Core Philosophy

- **Inclusive** — designed for people of all abilities and circumstances
- **Productive** — helps users accomplish tasks efficiently with minimal friction
- **Purposeful** — every element serves a clear function; nothing is decorative without reason

### Design Pillars

| Pillar | Description |
|--------|-------------|
| **Clarity** | Content is king. Reduce visual noise. Use whitespace purposefully. |
| **Familiarity** | Leverage established patterns. Controls should behave as users expect. |
| **Consistency** | Same action = same appearance everywhere. Maintain visual rhythm. |
| **Adaptability** | Works across devices, input modes, screen sizes, directions and accessibility needs. |
| **Simplicity** | Progressive disclosure. Show only what's needed at each step. |

### Wave UI Aesthetic

- Clean, professional surfaces with subtle depth
- Neutral color palette with purposeful brand color accents
- Consistent 4px grid alignment throughout
- Segoe UI typography for a Microsoft-native feel
- Dual-layer shadows for natural depth perception

---

## 2. Layout & Spacing

### 4px Base Unit Grid

All spacing derives from a **4px base unit**. Every margin, padding, gap and size should be a multiple of 4px; Tailwind's default spacing scale (`p-1` = 4px) follows it.

### Spacing Scale

Fluent's spacing names, with the Tailwind class to use:

| Fluent name | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `none` | 0 | `p-0` | No spacing |
| `xxs` | 2px | `p-0.5` | Micro adjustments (nudge) |
| `xs` | 4px | `p-1` | Tight spacing between related elements |
| `sNudge` | 6px | `p-1.5` | Small nudge for optical alignment |
| `s` | 8px | `p-2` | Default inner padding |
| `mNudge` | 10px | `p-2.5` | Medium nudge |
| `m` | 12px | `p-3` | Standard gap between elements |
| `l` | 16px | `p-4` | Section spacing, card padding |
| `xl` | 20px | `p-5` | Large section gaps |
| `xxl` | 24px | `p-6` | Major section separation |
| `xxxl` | 32px | `p-8` | Page-level spacing |

The `gap` prop of `Stack`, `Flex` and `Grid` takes `'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'`: 0, 4, 8, 12, 16 and 24px.

### Content Density

Guidance for row heights:

| Mode | Row height | Use case |
|------|-----------|----------|
| **Comfortable** | 36px | Default for most UIs |
| **Compact** | 24px | Data-dense views (tables, lists) |
| **Spacious** | 44px | Touch-first or accessibility contexts |

Keep interactive targets at least 24×24px (WCAG 2.5.8); Wave's own small targets (SearchBox clear, Rating stars, picker buttons, the SplitButton chevron) meet it.

### Responsive Breakpoints

Wave uses Tailwind's default breakpoints (it does not redefine them):

| Prefix | Min width |
|------|-------|
| `sm:` | 640px (40rem) |
| `md:` | 768px (48rem) |
| `lg:` | 1024px (64rem) |
| `xl:` | 1280px (80rem) |
| `2xl:` | 1536px (96rem) |

### Layout Guidelines

- Use CSS Grid or Flexbox (`Grid`, `Stack`, `Flex`); avoid absolute positioning for layout
- Use logical properties (`ms-*`, `pe-*`, `start-*`, `border-s`, `text-start`) so layouts mirror in RTL
- Mirror direction-dependent glyphs and offsets with Wave's `wave-rtl:` variant (`wave-rtl:-scale-x-100`; write the LTR value as the base class). It follows the element's own direction (`:dir(rtl)`, compiled as `:nth-child(n of :dir(rtl))`, which CSS minifiers keep), while Tailwind's `rtl:` also matches inside an LTR subtree of an RTL page; the library's conventions gate rejects bare `rtl:`/`ltr:` in components
- Main content areas should not exceed 1200px width (readability)
- Side panels: 320px default width
- Navigation rail: 48px collapsed, 280px expanded
- Keep consistent gutter widths within a layout (typically 16px or 24px)
- `Flex` `direction="row-reverse"`/`"column-reverse"` changes only the visual order; reorder the DOM for focusable content
- `Overflow` pads its row by 4px (`p-1`), so its items' focus rings are not clipped. There is no negative margin: the items sit 4px in from the row's edges, the row is 8px taller than its items, and an explicit width on the root includes the padding. A consumer margin of −4px (`-m-1`) is fine only where nothing within 4px of the row scrolls: an edge-to-edge row would otherwise reach past its container and add a horizontal scrollbar. `p-0` removes the ring room

---

## 3. Typography

### Font Stack

```css
font-family: 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto,
  'Helvetica Neue', sans-serif;
```

The stack is the runtime token `--wave-font-family`, exposed as the Tailwind utility `font-wave`. `WaveProvider` and portaled overlays apply it. Wave does not change Tailwind's `font-sans`.

### Type Ramp

| Style | Size / Line Height | Weight | Tailwind Class | Usage |
|-------|-------------------|--------|----------------|-------|
| `caption-2` | 10px / 14px | 400 | `text-caption-2` | Timestamps, footnotes |
| `caption-1` | 12px / 16px | 400 | `text-caption-1` | Labels, helper text |
| `body-1` | 14px / 20px | 400 | `text-body-1` | **Default body text** |
| `body-2` | 16px / 22px | 400 | `text-body-2` | Emphasized body text |
| `subtitle-2` | 16px / 22px | 600 | `text-subtitle-2` | Card titles, section labels |
| `subtitle-1` | 20px / 28px | 600 | `text-subtitle-1` | Dialog titles, panel headers |
| `title-3` | 24px / 32px | 600 | `text-title-3` | Page section headings |
| `title-2` | 28px / 36px | 600 | `text-title-2` | Page titles |
| `title-1` | 32px / 40px | 600 | `text-title-1` | Hero titles |
| `large-title` | 40px / 52px | 600 | `text-large-title` | Landing page heroes |
| `display` | 68px / 92px | 600 | `text-display` | Marketing display text |

`cn()` knows these classes: `cn('text-body-1', 'text-muted-foreground')` keeps both (size and color), and `cn('text-body-1', 'text-sm')` keeps only the last size.

### Font Weights

`Text` and `Label` take `weight: 'regular' | 'semibold' | 'bold'` (the `TextWeight` type). Unset, `Text` uses its variant's ramp weight: semibold from `subtitle-2` up, inherited for the caption and body variants; pass `weight="regular"` for a regular-weight title.

| Weight | Value | Usage |
|--------|-------|-------|
| `regular` | 400 | Body text, descriptions |
| `semibold` | 600 | Headings, labels, emphasis |
| `bold` | 700 | Strong emphasis (use sparingly) |

### Typography Best Practices

- **body-1 (14px)** is the default for all UI text (`WaveProvider` sets it)
- Use **at most 3 type styles** on a single screen to maintain hierarchy
- Line length: 50–75 characters for body text readability
- Don't use font size alone for hierarchy; combine with weight and color
- Use `Text` with `variant` (and `as` for the right element) for semantic typography:

```tsx
<Text as="h2" variant="title-3" weight="semibold">
  Settings
</Text>
```

`Text` sets no color of its own; it inherits the surrounding color (the provider's foreground), so it follows the theme. Add one with `className="text-muted-foreground"`.

---

## 4. Color System

### Token Architecture

```
Ramps (theme-independent)   →  Semantic tokens (per theme)  →  Tailwind utilities
--wave-brand-80: #0f6cbd    →  --wave-primary               →  bg-primary, text-primary
--wave-grey-14: #242424         --wave-foreground              text-foreground
```

- **Ramps**: `--wave-brand-10` … `--wave-brand-160` and `--wave-grey-2` … `--wave-grey-98` on `:root`. They read the 0.4 names as fallbacks (`--wave-brand-80: var(--brand-80, #0f6cbd)`). Components never use them directly.
- **Semantic tokens**: `--wave-background`, `--wave-primary`, `--wave-border`, … declared by each theme class. Components use only these, through the Tailwind color utilities.
- **Tailwind mapping**: `@theme inline` maps `--color-<name>` to `var(--wave-<name>)`, so the utility name is the token name without the prefix (`bg-subtle-hover`, `border-stroke-accessible`, `text-error-tint-foreground`).

### Semantic Tokens

Generated from `src/styles/tokens.css`. A value followed by a name is a reference (`var(--wave-brand-80)`); the hex is its default.

| Token (`--wave-…`) | Light | Dark | High contrast |
|---|---|---|---|
| `background` | `#ffffff` | `#292929` | `#000000` |
| `foreground` | `#242424` | `#ffffff` | `#ffffff` |
| `card` | `#fafafa` | `#333333` | `#000000` |
| `secondary` | `#f5f5f5` | `#333333` | `#000000` |
| `muted` | `#f0f0f0` | `#383838` | `#1a1a1a` |
| `muted-foreground` | `#616161` | `#adadad` | `#ffffff` |
| `muted-hover` | `#e0e0e0` | `#424242` | `#333333` |
| `muted-pressed` | `#d1d1d1` | `#2e2e2e` | `#4d4d4d` |
| `primary` | `#0f6cbd` (brand-80) | `#62abf5` (brand-110) | `#1aebff` |
| `primary-foreground` | `#ffffff` | `#000000` | `#000000` |
| `primary-hover` | `#115ea3` (brand-70) | `#77b7f7` (brand-120) | `#6ef3ff` |
| `primary-pressed` | `#0c3b5e` (brand-40) | `#2886de` (brand-90) | `#00c4d6` |
| `destructive` | `#c50f1f` | `#f48a94` | `#ff6e6e` |
| `destructive-foreground` | `#ffffff` | `#000000` | `#000000` |
| `error` | `#c50f1f` | `#f48a94` | `#ff6e6e` |
| `error-foreground` | `#ffffff` | `#000000` | `#000000` |
| `subtle` | `transparent` | `transparent` | `transparent` |
| `subtle-hover` | `#f5f5f5` | `#333333` | `#1f1f1f` |
| `subtle-pressed` | `#ebebeb` | `#2e2e2e` | `#333333` |
| `subtle-selected` | `#ebebeb` | `#383838` | `#333333` |
| `selected` | `#ebf3fc` (brand-160) | `#082338` (brand-20) | `#003a40` |
| `selected-foreground` | `#0f548c` (brand-60) | `#62abf5` (brand-110) | `#ffffff` |
| `selected-hover` | `#cfe4fa` (brand-150) | `#0c3b5e` (brand-40) | `#005259` |
| `selected-pressed` | `#b4d6fa` (brand-140) | `#061724` (brand-10) | `#006b75` |
| `border` | `#e0e0e0` | `#666666` | `#ffffff` |
| `stroke` | `#d1d1d1` | `#666666` | `#ffffff` |
| `stroke-hover` | `#c7c7c7` | `#757575` | `#ffffff` |
| `stroke-accessible` | `#616161` | `#adadad` | `#ffffff` |
| `input` | `#d1d1d1` | `#666666` | `#ffffff` |
| `input-filled-darker` | `#f5f5f5` | `#141414` | `#000000` |
| `input-filled-lighter` | `#ffffff` (background) | `#292929` (background) | `#000000` (background) |
| `input-filled-stroke` | `transparent` | `transparent` | `#ffffff` |
| `ring` | `#0f6cbd` (brand-80) | `#479ef5` (brand-100) | `#ffff00` |
| `success` | `#107c10` | `#5db55d` | `#3ff23f` |
| `success-foreground` | `#ffffff` | `#000000` | `#000000` |
| `success-tint` | `#f1faf1` | `#052505` | `#000000` |
| `success-tint-foreground` | `#0e700e` | `#54b054` | `#3ff23f` |
| `warning` | `#fde300` | `#fde300` | `#ffff00` |
| `warning-foreground` | `#242424` | `#000000` | `#000000` |
| `warning-tint` | `#fffbe6` | `#463100` | `#000000` |
| `warning-tint-foreground` | `#6d5b00` | `#fde300` | `#ffff00` |
| `error-tint` | `#fdf3f4` | `#3b0509` | `#000000` |
| `error-tint-foreground` | `#b10e1c` | `#f48a94` | `#ff6060` |
| `severe` | `#da3b01` | `#e97548` | `#ff8c00` |
| `severe-foreground` | `#ffffff` | `#000000` | `#000000` |
| `severe-tint` | `#fdf6f3` | `#411200` | `#000000` |
| `severe-tint-foreground` | `#a52c00` | `#e97548` | `#ff8c00` |
| `info` | `#0f6cbd` | `#479ef5` | `#1aebff` |
| `info-foreground` | `#ffffff` | `#000000` | `#000000` |
| `info-tint` | `#ebf3fc` | `#082338` | `#000000` |
| `info-tint-foreground` | `#0f548c` | `#62abf5` | `#1aebff` |
| `inverted` | `#292929` | `#ffffff` | `#000000` |
| `inverted-foreground` | `#ffffff` | `#242424` | `#ffffff` |
| `inverted-border` | `transparent` | `transparent` | `#ffffff` |
| `track` | `#e0e0e0` | `#3d3d3d` | `#4d4d4d` |
| `skeleton` | `#e0e0e0` | `#3d3d3d` | `#333333` |
| `rating` | `#b86e00` | `#f7b538` | `#ffff00` |
| `presence-available` | `#107c10` | `#54b054` | `#3ff23f` |
| `presence-busy` | `#c50f1f` | `#f48a94` | `#ff6060` |
| `presence-away` | `#a67c00` | `#f7b538` | `#ffff00` |
| `presence-offline` | `#616161` | `#adadad` | `#ffffff` |
| `presence-oof` | `#b4009e` | `#d696c8` | `#ff80ff` |
| `presence-glyph` | `#ffffff` | `#000000` | `#000000` |
| `backdrop` | `rgb(0 0 0 / 0.4)` | `rgb(0 0 0 / 0.5)` | `rgb(0 0 0 / 0.8)` |
| `card-foreground` | `#242424` (foreground) | `#ffffff` (foreground) | `#ffffff` (foreground) |
| `secondary-foreground` | `#242424` (foreground) | `#ffffff` (foreground) | `#ffffff` (foreground) |
| `accent` | `#0f6cbd` (primary) | `#62abf5` (primary) | `#1aebff` (primary) |
| `accent-foreground` | `#ffffff` (primary-foreground) | `#000000` (primary-foreground) | `#000000` (primary-foreground) |

How the groups are used:

- **Surfaces and text**: `background`/`foreground` for the page, `card` for raised surfaces, `muted` for neutral chips and backgrounds, with `muted-hover` and `muted-pressed` for the hover and pressed fills of a chip (a Tag's Dismiss button, an InteractionTag; `foreground` text only, each step at least 1.15:1 from the one before), `muted-foreground` for secondary text.
- **Interactive**: `primary` fills with `primary-foreground` text, `primary-hover`/`primary-pressed` for their states; `subtle-hover`, `subtle-pressed` and `subtle-selected` for transparent controls, rows and menu items; `selected` with `selected-foreground` for a brand-tinted selection, and `selected-hover`/`selected-pressed` for its states (brand and selected tags; `selected-foreground` text only); `ring` for focus.
- **Input fills**: `input-filled-darker` and `input-filled-lighter` are the fills of the `filled-darker` and `filled-lighter` appearances (`filled-lighter` follows `background`), and `input-filled-stroke` is their border, transparent except in the high-contrast theme, where it keeps the field's boundary. Every text token keeps 4.5:1 on both fills.
- **Strokes**: `border` for dividers and surfaces, `stroke` for control borders, `stroke-accessible` where the edge itself must reach 3:1 (unchecked checkboxes, the Switch track, Slider rail, carousel dots, input bottom borders).
- **Status**: fills (`success`, `warning`, `error`, `severe`, `info`) with their `*-foreground`, and light tints (`*-tint`) with `*-tint-foreground` text for MessageBar and Badge.
- **Specials**: `inverted` (Tooltip), `track` (ProgressBar), `skeleton`, `rating`, `presence-*` (PresenceBadge), `backdrop` (Dialog, Drawer).

### Brand Color Ramp

16 shades (indexed 10–160) from darkest to lightest:

```
 10 #061724  (darkest)
 20 #082338  ← selected surface (dark)
 30 #0a2e4a
 40 #0c3b5e  ← primary pressed (light)
 50 #0e4775
 60 #0f548c  ← selected text (light)
 70 #115ea3  ← primary hover (light)
 80 #0f6cbd  ← PRIMARY and focus ring (light)
 90 #2886de  ← primary pressed (dark)
100 #479ef5  ← focus ring (dark)
110 #62abf5  ← PRIMARY and selected text (dark)
120 #77b7f7  ← primary hover (dark)
130 #96c6fa
140 #b4d6fa
150 #cfe4fa
160 #ebf3fc  ← selected surface (light)
```

The dark theme uses brand-110 with **black** text (8.66:1); 0.4 used brand-100 with white text, which failed contrast (2.81:1). The high-contrast theme uses fixed colors.

### Neutral Grey Palette

29 grey values from `grey-2` (#050505) to `grey-98` (#fafafa) as `--wave-grey-*`. Key stops:

| Token | Hex | Common use |
|-------|-----|------------|
| `grey-14` | `#242424` | Default foreground (light) |
| `grey-38` | `#616161` | Muted foreground and accessible strokes (light) |
| `grey-82` | `#d1d1d1` | Control borders (`stroke`, `input`), pressed chips (`muted-pressed`, light) |
| `grey-88` | `#e0e0e0` | Dividers and borders (`border`), tracks, skeletons, hovered chips (`muted-hover`, light) |
| `grey-92` | `#ebebeb` | Pressed and selected subtle controls (`subtle-pressed`, `subtle-selected`) |
| `grey-94` | `#f0f0f0` | Muted backgrounds |
| `grey-96` | `#f5f5f5` | Hover states |
| `grey-98` | `#fafafa` | Card backgrounds |

### Color Usage Rules

1. **Never use raw hex values** in components or stories: use the semantic tokens through Tailwind (the repo's conventions gate fails on raw colors).
2. **Never use color alone** to convey information: add icons, text, shape or an outline (PresenceBadge shapes, selected check marks, the status text of MessageBar and Toast).
3. **Contrast**: text needs 4.5:1 (3:1 for large text), UI component edges and states 3:1. `src/styles/__tests__/tokens.test.ts` checks every pair in every theme.
4. The `warning` fill (`#fde300`) is a background and accent color only; use `warning-tint-foreground` for warning text and icons.
5. **Limit the palette**: 3–5 colors on any single screen; reserve the brand color for primary actions and key interactive elements.

---

## 5. Elevation & Shadows

Wave uses a **dual-layer shadow** model simulating ambient light (diffuse) + key light (directional).

### Shadow Levels

| Level | Tailwind | CSS value | Usage |
|-------|-------|-----------|-------|
| **2** | `shadow-2` | `0 0 2px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.14)` | Cards at rest, subtle lift |
| **4** | `shadow-4` | `0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)` | Cards on hover, menus |
| **8** | `shadow-8` | `0 0 2px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.14)` | Popovers, dropdowns, teaching callouts |
| **16** | `shadow-16` | `0 0 2px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.14)` | Dialogs, drawers |
| **28** | `shadow-28` | `0 0 8px rgba(0,0,0,0.12), 0 14px 28px rgba(0,0,0,0.14)` | Full-screen overlays |
| **64** | `shadow-64` | `0 0 8px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.14)` | Topmost layers (rarely used) |

`cn()` merges this scale with Tailwind's: `cn('shadow-4', 'shadow-8')` gives `shadow-8`, and a consumer `shadow-lg` replaces a component's `shadow-4`.

### Elevation Guidelines

- **Surfaces at rest**: shadow-2 or no shadow (flat)
- **Interactive hover**: increase by one level (shadow-2 → shadow-4)
- **Floating elements**: shadow-8 (dropdowns, tooltips, popovers)
- **Modal overlays**: shadow-16 or shadow-28
- Use elevation intentionally; avoid stacking multiple shadow levels close together
- In the dark theme shadows are less visible; rely more on borders for separation

### Stacking

Portaled surfaces use three layers: `--wave-z-overlay` (1000: dialogs, drawers, popovers, menus, listboxes), `--wave-z-toast` (1100) and `--wave-z-tooltip` (1200). A surface opened from inside another portaled surface adds its nesting depth, so it always stacks above its parent.

---

## 6. Motion & Animation

### Motion Tokens

Fluent's motion tokens (`motionTokens` of `@fluentui/react-motion`), with Fluent's values. They are CSS variables on `:root` in every style entry, the same in every theme (next to the stacking layers), and on the Tailwind path they are utilities too. (Before 0.7 this chapter listed reference values of its own; five of its curves did not match Fluent's.)

| Duration | Variable | Tailwind utility | Value | Usage |
|-------|-------|-------|-------|-------|
| `ultra-fast` | `--wave-duration-ultra-fast` | `duration-wave-ultra-fast` | 50ms | Micro-interactions (a checkbox tick) |
| `faster` | `--wave-duration-faster` | `duration-wave-faster` | 100ms | Small transitions (color change, opacity) |
| `fast` | `--wave-duration-fast` | `duration-wave-fast` | 150ms | Hover and focus feedback, short exits |
| `normal` | `--wave-duration-normal` | `duration-wave-normal` | 200ms | Default duration |
| `gentle` | `--wave-duration-gentle` | `duration-wave-gentle` | 250ms | Deliberate transitions |
| `slow` | `--wave-duration-slow` | `duration-wave-slow` | 300ms | Large elements |
| `slower` | `--wave-duration-slower` | `duration-wave-slower` | 400ms | Page-level transitions |
| `ultra-slow` | `--wave-duration-ultra-slow` | `duration-wave-ultra-slow` | 500ms | Dramatic entrances |

| Curve | Variable | Tailwind utility | Value | Usage |
|-------|-------|-------|-------|-------|
| `accelerate-max` | `--wave-curve-accelerate-max` | `ease-wave-accelerate-max` | `cubic-bezier(0.9, 0.1, 1, 0.2)` | Exit, strongest acceleration |
| `accelerate-mid` | `--wave-curve-accelerate-mid` | `ease-wave-accelerate-mid` | `cubic-bezier(1, 0, 1, 1)` | Exit |
| `accelerate-min` | `--wave-curve-accelerate-min` | `ease-wave-accelerate-min` | `cubic-bezier(0.8, 0, 0.78, 1)` | Subtle exit |
| `decelerate-max` | `--wave-curve-decelerate-max` | `ease-wave-decelerate-max` | `cubic-bezier(0.1, 0.9, 0.2, 1)` | Enter, strongest deceleration |
| `decelerate-mid` | `--wave-curve-decelerate-mid` | `ease-wave-decelerate-mid` | `cubic-bezier(0, 0, 0, 1)` | Enter |
| `decelerate-min` | `--wave-curve-decelerate-min` | `ease-wave-decelerate-min` | `cubic-bezier(0.33, 0, 0.1, 1)` | Subtle enter |
| `easy-ease-max` | `--wave-curve-easy-ease-max` | `ease-wave-easy-ease-max` | `cubic-bezier(0.8, 0, 0.2, 1)` | Bidirectional, dramatic |
| `easy-ease` | `--wave-curve-easy-ease` | `ease-wave-easy-ease` | `cubic-bezier(0.33, 0, 0.67, 1)` | Standard bidirectional |
| `linear` | `--wave-curve-linear` | `ease-wave-linear` | `cubic-bezier(0, 0, 1, 1)` | Continuous motion (progress, spinners) |

- The utilities come from the `@theme inline` block of `src/styles/tokens.css` (`--transition-duration-wave-*` and `--ease-wave-*`), so a Tailwind build generates the ones you use. The precompiled `./styles` holds the variables but only the utilities Wave itself uses (those of its component motion, below): without Tailwind, write `transition: opacity var(--wave-duration-normal) var(--wave-curve-decelerate-mid)`.
- `cn` knows the scales: `cn('duration-wave-fast', 'duration-200')` keeps `duration-200`, `cn('ease-wave-linear', 'ease-in')` keeps `ease-in`, and `cn('duration-wave-fast', 'ease-wave-linear')` keeps both.
- The tokens are never zeroed under reduced motion: components and your own code reduce motion themselves (below).

### Motion Patterns

- **Enter**: `decelerate-mid` + `normal` to `slow` (200–300ms). The element slides or fades in, decelerating to rest.
- **Exit**: `accelerate-mid` + `faster` to `normal` (100–200ms). The element accelerates away, faster than it entered.
- **Hover/focus**: `easy-ease` + `faster` to `fast` (100–150ms). Quick, responsive feedback.
- **Layout shift**: `easy-ease` + `normal` (200ms). Smooth repositioning.

### Enter and Exit: the Presence Core

An element that animates out must stay in the DOM until its exit motion ends. `usePresence(visible, options?)` and the `<Presence visible>` component do that with CSS only: no JS animation library, no inline style and no class of their own. They write one attribute, `data-presence`, with the element's phase (`PresencePhase`):

| Phase | When | Attributes |
|---|---|---|
| `entering` | `visible` became `true` (or the element mounted with `appear`), until its enter motion ends | `data-presence="entering"` |
| `entered` | shown | `data-presence="entered"` |
| `exiting` | `visible` became `false`, until its exit motion ends | `data-presence="exiting"`, `inert` |
| `exited` | hidden: unmounted, or with `unmountOnExit={false}` kept mounted | `data-presence="exited"`, `inert`, `hidden` |

Style the enter with Tailwind's `starting:` variant (CSS `@starting-style`: the element's first style) gated on the entering phase, `data-[presence=entering]:starting:`, and the exit with `data-[presence=exiting]:`, and pair them with `motion-reduce:`:

```tsx
import { Presence } from '@mortenbrudvik/waveui';

export const Details = ({ open }: { open: boolean }) => (
  <Presence visible={open}>
    <section
      aria-label="Details"
      className="transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid data-[presence=entering]:starting:translate-y-1 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:translate-y-1 data-[presence=exiting]:opacity-0 data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none"
    >
      The report was saved to your documents.
    </section>
  </Presence>
);
```

- **When a phase ends.** `entering` and `exiting` end when every finite animation and transition of the element itself has finished (`element.getAnimations()`; a cancelled one counts as finished, an infinite one is ignored). Engines without `getAnimations` read the element's computed `animation-*` and `transition-*` times and its end events. The phase ends at once when the element has no running motion and under `prefers-reduced-motion: reduce`, from a layout effect, so an element without motion unmounts before the browser paints.
- **Gate the enter on the phase.** `@starting-style` applies to every first style of an element, whatever its `data-presence`. An ungated `starting:` class therefore also animates an element that mounts `entered` (without `appear`, or hydrated from the server HTML), while the core already reports `entered` and has called `onEntered`. `data-[presence=entering]:starting:…` (CSS: `@starting-style { .notice[data-presence='entering'] { … } }`) runs only when the core runs the enter phase: a show after mount, `appear`, or a kept-mounted element shown again.
- **Exiting is inert.** The exiting element is out of the tab order and the accessibility tree, so a closing surface cannot catch focus, a click or Escape while it fades.
- **Focus and layers follow the open state.** A component keys its dismiss layer, focus restore, positioning and initial focus on its open state, never on the presence mount: focus returns and the next Escape reaches the layer below when the surface closes, not after its exit motion, and a surface shown again during its exit returns to `entering` on the same element.
- **Server rendering.** On the server and while hydrating the element renders `entered` (or `exited`), so a hydrated element does not replay its enter motion (with the enter gated as above); `appear` runs it only for an element mounted on the client after hydration.
- **Options.** `unmountOnExit={false}` keeps an exited element mounted, `hidden` and `inert`, so its state (a typed value, a scroll position) survives; `onEntered` and `onExited` report the end of a phase, once per phase (StrictMode included; `onExited` from the commit that unmounts or hides the element).
- **The hook.** `const { isMounted, ref, presenceProps } = usePresence(open)`: render the element while `isMounted`, pass it `ref` (merge it with your own through `useMergedRefs`) and spread `presenceProps`. Destructure the result, since `eslint-plugin-react-hooks` treats the whole object as a ref once its `ref` is passed on. `<Presence>` does the same for a single child element (or calls a render function with the result).
- **Where it is used.** Every overlay and disclosure with motion (not yet the listbox popups of Combobox, Dropdown, TagPicker and TimePicker, the DatePicker calendar and the AvatarGroup popover: [ROADMAP §8.5](ROADMAP.md#85-follow-ups-outside-the-gap-list)): `Menu.Popover` (root menus and submenus), Popover.Content, the InfoButton note, the Tooltip surface, the TeachingPopover surface, `Dialog.Content` and every Drawer and NavDrawer panel and backdrop (overlay or inline), the collapse elements of Accordion, Tree and Nav, the toast containers and the bars of a MessageBarGroup, each with a default motion (below). With `unmountOnClose={false}` a Dialog or Drawer stays mounted `exited`, `hidden` and `inert` once its motion ends; otherwise the closed surface unmounts then. Every top-level element of their portal carries the presence attributes.
- **Browser support.** `@starting-style` needs Chrome and Edge 117+, Safari 17.5+ or Firefox 129+; older browsers show the element at once, and the exit still runs.

### Component Motion

Since 0.15 the overlays and disclosures in the table below ship an enter and exit motion; the listbox popups of Combobox, Dropdown, TagPicker and TimePicker, the DatePicker calendar and the AvatarGroup popover still appear and disappear at once ([ROADMAP §8.5](ROADMAP.md#85-follow-ups-outside-the-gap-list)). All of it lives in one internal, server-safe module, `src/lib/motion.ts`: one plain string literal per recipe (a record of literals where a recipe depends on the edge or the size), which the components compose at run time. The conventions gate keeps every `data-[presence=…]` class in that module (`presence-class`) and every `starting:` class gated on the entering phase (`starting-gate`); `src/lib/__tests__/motion.test.ts` compiles every class and checks the tokens, the reduced-motion counterparts and the rules below; and `verify-dist` proves that an import of only `Button` holds no recipe and no presence class.

| Surface | Properties | In | Out |
|---|---|---|---|
| `Popover.Content`, `Menu.Popover` and submenus, InfoButton note | opacity, and a 4px `translate` away from the anchor by `data-side` (starts 4px toward it; the exit slides back) | 200ms `normal`, `decelerate-mid` | 100ms `faster`, `accelerate-min` |
| TeachingPopover surface | as the popups (with a target or a Trigger: fade and slide; in place, without `data-side`, only the fade) | as above | as above |
| Tooltip | opacity | 100ms `faster`, `easy-ease` | 100ms `faster`, `easy-ease` |
| Dialog surface | opacity and `scale` 0.85 → 1 | 250ms `gentle`, `decelerate-mid` | 200ms `normal`, `accelerate-min` |
| Dialog backdrop | opacity | 250ms `gentle`, `easy-ease` | 200ms `normal`, `easy-ease` (the surface's out) |
| Drawer and NavDrawer overlay panel | `translate` by 100% of its own size from its edge (`start` and `end` mirrored in RTL; `left` and `right` physical; `bottom` vertical) and opacity | `small` 250 `gentle`, `medium` 300 `slow`, `large` 400 `slower`, `full` 500 `ultra-slow`; `decelerate-mid` | the same durations; `accelerate-min` |
| Drawer backdrop | opacity | the size's duration, `linear` | the size's duration, `linear` |
| Inline Drawer and NavDrawer | the collapse below on columns (rows at the bottom) and opacity, the panel against its inner edge | the size's duration, `decelerate-mid` | the same, `accelerate-min` |
| Accordion panel, Tree group, Nav category list | the collapse below (rows) and opacity | 200ms `normal`, `easy-ease-max` | the same |
| Nav.Category expand icon | `transform` (its 180° turn) | 150ms `fast`, `easy-ease` | the same |
| Nav item actions | opacity of each action, on row hover or focus within | 150ms `fast`, `easy-ease` | the same |
| Toast container | rows, a `-mb-2` gap compensation, opacity and an 8px vertical `translate` from the stack's edge, together | 250ms `gentle`, `decelerate-mid` | opacity over 200ms `normal`, then rows and margin over 200ms after a 200ms delay; `easy-ease` |
| MessageBarGroup bar | rows, a `-mb-2` gap compensation and opacity, the bar at the end of its track | `animate="both"` only: 250ms `gentle`, `linear` | 250ms `gentle`, `linear` |
| Carousel slide | the track's `transform` | `motionDuration`, 300ms `slow` by default, `easy-ease` | — |
| Carousel fade | the slides' opacity | `motionDuration`, `easy-ease` | — |
| TabList indicator | `translate` and `scale` of the selected tab's `::after` (FLIP) | 300ms `slow`, `decelerate-max` | — |
| ProgressBar indeterminate | the `animate-wave-indeterminate` keyframes (0.14's classes) | — | — |

**The classes.** Each is the default of a motion slot unless it is marked as a structure (layout keyed on the phases, on the element whatever its slot holds):

- Popups (`Popover.Content`, `Menu.Popover`, the InfoButton note, the TeachingPopover surface): `transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-faster data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[side=top]:data-[presence=entering]:starting:translate-y-1 data-[side=top]:data-[presence=exiting]:translate-y-1 data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 data-[side=bottom]:data-[presence=exiting]:-translate-y-1 data-[side=left]:data-[presence=entering]:starting:translate-x-1 data-[side=left]:data-[presence=exiting]:translate-x-1 data-[side=right]:data-[presence=entering]:starting:-translate-x-1 data-[side=right]:data-[presence=exiting]:-translate-x-1`
- Tooltip surface: `transition-opacity duration-wave-faster ease-wave-easy-ease motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0`
- Dialog surface: `transition-[opacity,scale] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:scale-85 data-[presence=exiting]:opacity-0 data-[presence=exiting]:scale-85`
- Dialog backdrop: `transition-opacity duration-wave-gentle ease-wave-easy-ease data-[presence=exiting]:duration-wave-normal motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0`
- Overlay drawer panel, per edge, plus the size's duration (`small` `duration-wave-gentle`, `medium` `duration-wave-slow`, `large` `duration-wave-slower`, `full` `duration-wave-ultra-slow`):
  - `start`: `transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:-translate-x-full data-[presence=exiting]:-translate-x-full wave-rtl:data-[presence=entering]:starting:translate-x-full wave-rtl:data-[presence=exiting]:translate-x-full`
  - `end`: `transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:translate-x-full data-[presence=exiting]:translate-x-full wave-rtl:data-[presence=entering]:starting:-translate-x-full wave-rtl:data-[presence=exiting]:-translate-x-full`
  - `left`: `transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:-translate-x-full data-[presence=exiting]:-translate-x-full`
  - `right`: `transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:translate-x-full data-[presence=exiting]:translate-x-full`
  - `bottom`: `transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[presence=entering]:starting:translate-y-full data-[presence=exiting]:translate-y-full`
- Drawer backdrop, per size: `small` `transition-opacity duration-wave-gentle ease-wave-linear motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0`; `medium`, `large` and `full` the same with `duration-wave-slow`, `duration-wave-slower` and `duration-wave-ultra-slow`.
- Inline drawer, on its collapse element, per axis, plus the size's duration: width `transition-[grid-template-columns,opacity] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:grid-cols-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-cols-[minmax(0,0fr)] data-[presence=exiting]:opacity-0`; height (`bottom`) `transition-[grid-template-rows,opacity] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:opacity-0`.
- Inline drawer structure, per edge: `start` `grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] justify-items-end justify-end overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none`; `end` `grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] justify-items-start overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none`; `left` `grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] [justify-items:right] [justify-content:right] overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none`; `right` `grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] [justify-items:left] [justify-content:left] overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-w-none`; `bottom` `grid shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-start overflow-hidden data-[presence=entered]:contents not-data-[presence=entered]:*:max-h-none`.
- Collapse (Accordion, Tree, Nav): `transition-[grid-template-rows,opacity] duration-wave-normal ease-wave-easy-ease-max motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:opacity-0`; structure `grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-start overflow-hidden data-[presence=entered]:contents`.
- Nav.Category expand icon: `transition-transform duration-wave-fast ease-wave-easy-ease motion-reduce:transition-none` (the turn itself, `rotate-180` while open, is state, not motion).
- Nav item actions (no slot; off below `WaveProvider motion="none"`): `*:transition *:duration-wave-fast *:ease-wave-easy-ease motion-reduce:*:transition-none`.
- Toast container, per edge of the stack: `bottom` `transition-[grid-template-rows,margin-bottom,opacity,translate] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-easy-ease data-[presence=exiting]:[transition-delay:var(--wave-duration-normal),var(--wave-duration-normal),0s,0s] motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:translate-y-2 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0`; `top` the same with `-translate-y-2`; structure `grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] not-data-[presence=entered]:overflow-hidden`.
- MessageBarGroup bar: exit `transition-[grid-template-rows,margin-bottom,opacity] duration-wave-gentle ease-wave-linear motion-reduce:transition-none data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0`; with `animate="both"` also `data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0`; structure `grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-end content-end overflow-hidden data-[presence=entered]:contents`.
- Carousel: slide (on the track) `transition-transform duration-wave-slow ease-wave-easy-ease motion-reduce:transition-none`; fade (on each slide) `transition-opacity duration-wave-slow ease-wave-easy-ease motion-reduce:transition-none`. A `motionDuration` other than 300 is an inline `transition-duration` on the element that has the transition.
- TabList indicator (on the selected tab; it times the `::after`): `after:transition-[translate,scale] after:duration-wave-slow after:ease-wave-decelerate-max motion-reduce:after:transition-none`. The TabList writes `--wave-tab-indicator-offset` and `--wave-tab-indicator-scale` on the tab for one frame after the selection moves, without these classes, then clears them and adds the classes, so the line glides from the previous tab.
- Indeterminate ProgressBar fill: `w-2/5 animate-wave-indeterminate wave-rtl:animate-wave-indeterminate-rtl motion-reduce:w-full motion-reduce:translate-x-0 motion-reduce:animate-wave-pulse wave-rtl:motion-reduce:animate-wave-pulse`.

**Motion slots.** Each animated part takes its motion as a prop typed `MotionSlot | null` (`MotionSlot = string | { className: string }`): `undefined` is the default above; `null` is no motion (a part with presence phases still goes through the presence core, and every phase ends in the commit that starts it; the expand icon, the indeterminate fill and the TabList line just do not move); a value **replaces** the default classes. The names are a ruling against C-NAMING's "Fluent's names first", and each prop's JSDoc names the Fluent prop it stands for:

| Prop | Where | Fluent |
|---|---|---|
| `motion` | `Dialog.Content` (the surface) | `Dialog surfaceMotion` |
| `backdropMotion` | `Dialog.Content`, Drawer, NavDrawer (the backdrop) | `DialogSurface backdropMotion`, `OverlayDrawer backdropMotion` |
| `motion` | Drawer, NavDrawer (the overlay panel, or the collapse element of an inline one) | `OverlayDrawer` and `InlineDrawer surfaceMotion` |
| `motion` | `Menu.Popover`, `Popover.Content`, InfoButton, InfoLabel (its note), TeachingPopover and `TeachingPopover.Surface` | `Menu`, `Popover`, `TeachingPopover surfaceMotion` |
| `motion` | Tooltip (the portaled surface; `className` stays on the wrapper) | none: a WaveUI addition |
| `motion` | `Accordion.Panel`, Tree (every group), `Nav.Category` (the collapse element) | `AccordionPanel`, `Tree`, `NavSubItemGroup collapseMotion` |
| `expandIconMotion` | `Nav.Category` | `NavCategoryItem expandIconMotion` |
| `motion` | Toaster (every toast container), MessageBarGroup (every bar's element) | none |
| `motion` | TabList (the selection line) | none: Fluent cannot turn it off |
| `indeterminateMotion` | ProgressBar | `ProgressBar indeterminateMotion` |
| `motion`, `motionDuration` | Carousel: `CarouselMotion` (`'slide'`, `'fade'`) or `null`, and milliseconds | `motion`, `duration` (another unit) |

- A part destructures its motion props, so they never reach the DOM, and composes `cn(<stable class>, <base classes>, <motion classes>, className)`: the consumer's `className` still wins a conflict of the same variant (a `transition-none` there turns a recipe's transition off), so pass motion through the slot instead.
- Write a replacement as the recipes are written: the enter's start as `data-[presence=entering]:starting:…` (an ungated `starting:` also animates an element that mounts `entered`), the exit as `data-[presence=exiting]:…`, timing with `duration-wave-*` and `ease-wave-*`, and a `motion-reduce:` counterpart of the same kind on the same element (`motion-reduce:after:transition-none` for the TabList line).
- **Positioned surfaces never transition `transform`.** floating-ui places Popover, Menu, Tooltip, the InfoButton note and a pointed TeachingPopover with an inline `transform: translate(…)`, so their recipes list `opacity`, `translate` and `scale` explicitly and never use `transition`, `transition-all` or `transition-transform` (or a list that names `transform` or `all`): a transform transition would glide the surface from its last position, or from the viewport corner, on every placement. A replacement follows the same rule.
- **A backdrop never outlasts its surface.** The presence core waits for the surface's own motion only, and the backdrop is the surface's sibling, so the default backdrops exit over the surface's exit duration (`motion.test.ts` checks it). A replacement backdrop motion longer than the surface's is cut off when the surface unmounts.
- **The precompiled CSS holds Wave's classes only.** The default motion works on both style paths (every recipe class is a word of a library literal, so `build-css` ships it). A consumer's replacement is not in the library's sources: on the Tailwind path the app's build generates it; with the precompiled `./styles`, pass a class of your own CSS written against `[data-presence]` (the CSS form in [Enter and Exit](#enter-and-exit-the-presence-core) above).
- **0.14's classes in `className` (D19).** On `Menu.Popover`, `Dialog.Content`, Drawer and NavDrawer, a `className` containing `[presence=` while `motion` is `undefined` turns the default motion off (`usesLegacyMotion`), so 0.14 code keeps its own motion unmixed: tailwind-merge would otherwise mix them (the consumer's `transition-opacity` replaces the recipe's list and the recipe's slide snaps). For an inline drawer the core then waits for the `<aside>`, as in 0.14. The rule covers the part, not its backdrop, which takes its default fade.

**The provider.** `WaveProvider motion?: MotionPreference` (`'default'` | `'none'`, inherited by nested providers like `theme`; `useWaveTheme().motion`). `'none'` makes every motion slot below it act as `null` and turns off the Nav item actions' reveal; a part's own value wins (`resolveMotion`: `null` → none; a value → its classes; the provider's `'none'` → none; the D19 rule → none; else the recipe). Under `'none'` a Carousel without its own `motion` changes its page at once, the indeterminate ProgressBar is a static full-width fill, and TabList writes no FLIP properties. It covers what this phase added: the Accordion and Tree chevrons keep their own transitions (they are no slots), while the Nav chevron's is `expandIconMotion` and turns at once; classes of yours on a `Presence` child keep running. It is Fluent's `MotionBehaviourProvider` with `'skip'`, which `@fluentui/react-components` does not export.

**The collapse element and `display: contents`.** A disclosure's part (Accordion's region, a Tree group, a Nav category's `<ul>`), an inline drawer's panel and a MessageBarGroup bar are each the only child of an element that is the presence element (`wave-accordion-panel__collapse`, `wave-tree-item__collapse`, `wave-nav-category__collapse`, `wave-drawer__collapse` with `wave-nav-drawer__collapse`, `wave-message-bar-group__item`); the part keeps its `className`, `ref`, `id`, role and stable class. The internal `useCollapsePresence` builds it for Accordion, Tree and Nav.

- **Entered** the element is `display: contents`: it has no box, so the part lays out in its parent exactly as before the element existed (percentage widths, margins, flex and grid parents).
- **Entering and exiting** it is a clipping grid of one track whose minimum is zero (`grid-template-rows: minmax(0, 0fr)` ↔ `minmax(0, 1fr)`; columns for side drawers): the track can get smaller than the part, padding, border and a definite width included (a plain `0fr` stops at the padding, and on columns at a definite width). The other axis is pinned to a whole zero-minimum track too, so the part keeps the width (height) it has once entered instead of growing to its longest unbreakable line. The part sits against the edge it reads as sliding from (Accordion, Tree and Nav at the top, `items-start`; a MessageBarGroup bar at the bottom, `items-end content-end`; an inline drawer's panel against its inner edge, with the track on that side), so it is clipped, never squeezed, and no empty strip opens beside it: while the collapse is partly open at a fraction f, the grid gives its track only f of the element, f² of the part.
- With `motion={null}` the phases end in the layout effect of the commit that starts them, so the grid state is never painted. With a motion of yours, or 0.14's classes on an inline drawer's `className`, the element is a grid for as long as the phase runs: it clips a slide of yours on the part, and an inline drawer whose width (height) is a percentage, or `full`, resolves it against the track for that time (right again once entered; give it a length, or pass `motion={null}`). A `full` inline drawer has no default motion for that reason.
- While an inline drawer's element is not entered it also lifts the panel's own `max-w-full` (`max-h-full` at the bottom), a percentage that would follow the shrinking track.
- The toast container takes focus, so it is a grid in every phase (`toastStructure`), around a content element (`wave-toaster__toast-content`), and clips only while it is not entered.
- Selectors with a child combinator across the element (`[role=treeitem] > [role=group]`, `li > ul`) and tests that walk `parentElement` change; assert through the class constants.

**Reduced motion.** Every recipe carries `motion-reduce:transition-none` (or the same-kind animation reduction, on the same element), and the presence core ends every phase at once under `prefers-reduced-motion: reduce`, so a delayed recipe (the toast's exit) has no delay either. No component adds media-query logic beyond `motion-reduce:`, except that TabList reads the internal `usePrefersReducedMotion` to skip writing its FLIP properties, as Carousel reads it to start autoplay stopped. The indeterminate ProgressBar keeps its full-width pulse.

**Tuning.** The recipes use the duration and curve tokens only, so redefining `--wave-duration-*` or `--wave-curve-*` retimes every motion that uses them. Redefine them on `:root`, not on a subtree: overlays render in a portal under `<body>`, outside your subtree (`:root { --wave-duration-gentle: 200ms; }` makes the Dialog's enter 200ms). There is no parameter form (Fluent's `surfaceMotion={{ duration }}`): replace one part's classes instead.

**Exits (D7) and their consequences.** The exiting element is `inert`; dismiss layers, the focus trap, the isolation, the scroll lock, positioning and focus restore key on `open`, and focus leaves a closing surface in the closing commit (Dialog and drawers through `useModalLayer`; Menu, Popover, the InfoButton note and TeachingPopover through the internal `useFocusBeforeClose`, so a Dialog opened from an item of a closing surface records the trigger as its opener; disclosures move focus to their trigger). The accepted consequences:

- An exiting surface is click-through (HTML `inert` hit-tests like `pointer-events: none`): a second click during a backdrop's fade reaches the page. A Tree item ignores a pointer click that falls through its exiting group onto it (it would expand the item again and activate it); a click without a pointer (`detail` 0) still activates it.
- The scroll lock lifts at close, so the page's scroll bar returns while a modal still fades.
- An exiting popup keeps its last coordinates; it does not follow its anchor while the page scrolls.
- A popover named by its trigger keeps no `aria-labelledby` while it exits (it is `inert`, out of the accessibility tree).
- A Tooltip renders its current `content` while it exits, so content reset in `onOpenChange(false)` (a "Copied" text) changes during the fade.
- A popup opened inside a Dialog or Drawer that closes while the popup is open stays on screen until the surface's exit ends, and goes with it, without an exit of its own (at most the drawer's 500ms).
- Toasts move back to their corner as an overlay drawer starts closing, over the drawer that still slides out (their offsets follow the open layers).
- A popup whose placement flips (Popover, Menu, the InfoButton note, a pointed TeachingPopover; the Tooltip only fades) starts its enter slide from the side it asked for: it mounts with that `data-side`, `@starting-style` resolves at insertion, and floating-ui's flip lands 2–5 ms later, so the first frame is 4px off toward the anchor for the 200 ms enter. The exit uses the resolved side. Deferred to 0.16: keep the surface hidden until it is positioned.
- A selection changed while TabList's line still slides measures the tabs, not the line, so the line first jumps to the previous tab (by 38.6px in Chromium, 19.7px in Firefox, 3.4px in WebKit in the browser pass), then slides.
- A toast container clips while it is not entered, so its shadow is cut from the first frame of its exit, while it is still opaque.
- `backdropMotion` counts as given unless it is `undefined`, so `backdropMotion={null}` on a non-modal Dialog or an inline drawer warns (`…:backdrop-ignored`), unlike `backdrop={null}`.
- The Nav item actions' reveal sets the transition list of each action (`*:transition`), so a transition class of yours on one is replaced.

The real-browser checks of the phase (Firefox and WebKit for `display: contents` exits and grid-track interpolation, the TabList slide's first frame, that a click through an exiting Tree group lands on its item, which jsdom cannot hit-test) are in the Phase 10 spec, §14; ROADMAP §8.5 lists the follow-ups.

### Reduced Motion

Wave has **no global reduced-motion override** (0.4 had one on `*`, which also froze spinners mid-turn), and the motion tokens are never zeroed. Each component handles `prefers-reduced-motion` itself:

- every transition carries a `motion-reduce:` variant (usually `motion-reduce:transition-none`);
- `Spinner` keeps spinning, slower (`motion-reduce:animate-wave-spin-slow`), so it still reads as "busy";
- the indeterminate `ProgressBar` becomes a full-width pulse instead of a sliding bar (never a static partial bar that looks like real progress);
- `Skeleton` stops pulsing;
- `Carousel` changes its page at once (its slide and fade are off), and with `autoPlay` starts with rotation stopped;
- `TabList`'s selection line moves at once;
- every component's enter and exit motion is off (each recipe has its `motion-reduce:` counterpart), and the presence core ends every enter and exit phase at once, even while a motion runs.

Do the same in your own components: pair every `transition-*` or `animate-*` class with a `motion-reduce:` variant (a `data-[presence=…]:` or `data-[presence=entering]:starting:` motion too), and check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before JS-driven animation.

### Animations

Registered in the `@theme inline` block of `src/styles/tokens.css` (the keyframes are part of every style entry):

| Class | Keyframe | Duration | Usage |
|-------|----------|----------|-------|
| `animate-wave-spin` | 360deg rotation | 0.8s linear infinite | Spinner |
| `animate-wave-spin-slow` | 360deg rotation | 2.4s linear infinite | Spinner, reduced motion |
| `animate-wave-pulse` | opacity 1 → 0.4 → 1 | 1.5s ease-in-out infinite | Skeleton; indeterminate ProgressBar, reduced motion |
| `animate-wave-indeterminate` | translateX(-100% → 350%) | 1.5s ease-in-out infinite | Indeterminate ProgressBar |
| `animate-wave-indeterminate-rtl` | translateX(100% → -350%) | 1.5s ease-in-out infinite | Indeterminate ProgressBar in RTL |

---

## 7. Iconography

### Fluent System Icons (External Dependency)

> Icons are **not bundled** for your use: Wave's own glyphs are internal. The recommended icon package is `@fluentui/react-icons` (from Microsoft's Fluent UI ecosystem), installed separately.

- **Package**: `@fluentui/react-icons` (optional, install separately)
- **Catalog**: 4000+ icons
- **Two styles**: Regular (outlined) and Filled (solid)
- **Sizes**: 16px, 20px, 24px (default), 28px, 48px

### Icon Usage Guidelines

| Context | Size | Style |
|---------|------|-------|
| Inline with body text | 16px | Regular |
| Button icons | 20px | Regular |
| Standalone / navigation | 24px | Regular |
| Large emphasis | 28–48px | Filled |
| Active/selected state | Same | Switch Regular → Filled |

### Best Practices

- Use Regular icons by default; Filled for active/selected states
- Wave's `icon` slots (Button, MenuButton, ToggleButton, Menu.Item, Breadcrumb.Item, Nav, Tree.Item, Stepper.Step, MessageBar, Avatar) render the icon with `aria-hidden="true"`, so the icon is never part of the accessible name
- An icon-only button needs `aria-label`, `aria-labelledby` or `title` (Button and MenuButton warn in development without one; an unlabelled MenuButton is compact, with no minimum width), or a `Tooltip` with `relationship="label"`
- Don't mix icon styles within the same toolbar or section
- Use `role="img"` + `aria-label` for meaningful standalone icons outside Wave's slots

---

## 8. Component Architecture

### Pattern 1: ref-as-prop, displayName, composed handlers

Every component accepts `ref` as a regular prop (React 19), declares it in its Props interface, and sets `displayName`. Handlers the component also uses internally are composed with the consumer's, and consumer classes are merged last:

```tsx
import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusRing } from '../../lib/styles';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the chip is selected. */
  selected?: boolean;
  /** Called when the chip is activated. */
  onSelect?: () => void;
  /** Ref to the `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}

/** A selectable chip. */
export const Chip = ({ selected = false, onSelect, onClick, className, ref, ...rest }: ChipProps) => (
  <button
    type="button"
    aria-pressed={selected}
    data-selected={selected ? '' : undefined}
    className={cn(
      'rounded-md border border-stroke px-3 py-1 text-body-1',
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover data-[selected]:bg-selected',
      focusRing,
      className,
    )}
    {...rest}
    ref={ref}
    onClick={composeEventHandlers(onClick, () => onSelect?.())}
  />
);
Chip.displayName = 'Chip';
```

**Key points**:

- Props interfaces extend the native attributes of the rendered element and declare `ref`.
- Defaults a consumer may override (`type="button"`, `role`) go before `{...rest}`; attributes that must win go after it.
- `composeEventHandlers(theirs, ours)` runs the consumer's handler first; ours runs unless the consumer called `event.preventDefault()`.
- `className` is merged with `cn()`; the consumer's classes come last and replace conflicting classes of the same variant (see [Pattern 5](#pattern-5-cn-utility) for gated and state classes).
- State is exposed as `data-*` attributes (`data-selected`) so consumers can style it (`data-[selected]:…`).
- Hover and pressed styles of anything that can be disabled use the gate `not-disabled:not-aria-disabled:hover:` / `…:active:`.

### Pattern 2: Compound Components (Object.assign + flat names)

Complex components expose sub-components as static properties and also export each one under a flat name, which React Server Components need (they cannot dot into a client component):

```tsx
import * as React from 'react';
import { cn } from '../../lib/cn';
import { flattenChildren, isElementOfType } from '../../lib/children';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  ref?: React.Ref<HTMLElement>;
}

/** Flat name for React Server Components (`Panel.Header` in client files). */
export const PanelHeader = ({ className, ref, ...rest }: PanelProps) => (
  <header ref={ref} className={cn('mb-2 text-subtitle-2', className)} {...rest} />
);
PanelHeader.displayName = 'PanelHeader';

// The component JSDoc goes on the export below, not here.
const PanelRoot = ({ className, children, ref, ...rest }: PanelProps) => {
  // Classify with flattenChildren (it looks into Fragments) and isElementOfType (a part written in
  // a Server Component arrives as a lazy reference); never `child.type === PanelHeader`.
  const hasHeader = flattenChildren(children).some(({ node }) =>
    isElementOfType(node, PanelHeader),
  );
  return (
    <section
      ref={ref}
      data-has-header={hasHeader ? '' : undefined}
      className={cn('rounded-md border border-border bg-card p-4', className)}
      {...rest}
    >
      {children}
    </section>
  );
};
PanelRoot.displayName = 'Panel';

/** A bordered panel with an optional `Panel.Header`. */
export const Panel = /* @__PURE__ */ Object.assign(PanelRoot, { Header: PanelHeader });
```

**Usage**: `<Card><Card.Header title="…" /></Card>` in client components, `<Card><CardHeader title="…" /></Card>` anywhere.

- **Parts from Server Components.** A part written in a Server Component reaches the client as a lazy reference, so compounds identify their parts with `isElementOfType(child, Part)` / `getElementType(child)` from `src/lib/children.ts`, and count, slice or classify their children with `flattenChildren` (Fragments flattened, keys kept). Every compound therefore works when composed in a Server Component with the flat names, with the same server HTML and behaviour as in a client file. Test this with `asClientReference(Part)` (see the [testing guide](testing-best-practices.md)). A walk deeper than the direct children (a part inside the consumer's markup) uses `getElementType(node, { suspend: false })`: a lazy chunk still loading inside the consumer's own `<Suspense>` then suspends only that boundary, not the whole compound (and `renderToString` does not throw).
- **Component JSDoc** sits only on the exported `Object.assign(…)` const (the root gets none, also when it lives in a sibling module, as `MenuRoot` in `Menu.root.tsx` does; likewise on a wrapper-call export and on the first overload), so it reaches `index.d.ts`, and it names no internal symbol (`XRoot`) or spec label. Storybook autodocs read it from there (`.storybook/exportDocblocks.ts`), so stories never repeat it (no meta JSDoc, no `docs.description.component` for a compound): `.storybook/__tests__/exportDocblocks.test.ts` gates this, and verify-dist fails on an undocumented exported component.
- A part rendered outside its root throws `[WaveUI] <Part> must be used within <Root>` in development; in production it logs that once per message and renders inert (`reportMissingContext` from `src/lib/dev.ts`).

Compound components: `Accordion`, `Breadcrumb`, `Card`, `Carousel`, `ColorPicker`, `Combobox`, `DataGrid`, `Dialog`, `Drawer`, `Dropdown`, `List`, `Listbox`, `Menu`, `MessageBar`, `Nav`, `Overflow`, `Popover`, `RadioGroup`, `Rating`, `RatingDisplay`, `Skeleton`, `Stepper`, `SwatchPicker`, `TabList`, `Table`, `TeachingPopover`, `Toast`, `Toolbar`, `Tree`. The README lists every flat name. Fragments are looked into (each element of a Fragment is a Breadcrumb item, an AvatarGroup member or a Carousel slide), but a component that renders a part itself is not recognised where a compound classifies its children: write `Carousel.Item`s, and nested `Tree.Item`s, in the compound itself (directly, in Fragments, or for Tree from a render function such as `children.map(renderNode)`).

### Pattern 3: Slot System

A slot lets consumers customize a sub-element without replacing the component:

```tsx
import * as React from 'react';
import { renderSlot } from '../../lib/slot';
import type { Slot } from '../../lib/slot';

export interface StatusLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Decorative icon before the text. */
  icon?: Slot<'span'>;
}

export const StatusLabel = ({ icon, children, ...rest }: StatusLabelProps) => (
  <span {...rest}>
    {renderSlot(icon, 'span', 'me-1 inline-flex size-4', { 'aria-hidden': true })}
    {children}
  </span>
);
```

**Slot values**:

- Content — a string, number, element or iterable (array, `Set`, generator) — is rendered **inside** the slot's default element.
- A slot object `{ as?, className?, children?, style?, ...attributes }` gives full control: `as` renders any element or component, every attribute of the default element is accepted (`{ src, alt }` for an image slot), and `className` is merged after the base classes (yours wins).
- `null`, `undefined`, `false` and `true` render nothing.
- `Slot<T>` is `SlotObject<T> | React.ReactNode`, so any `ReactNode` (a promise included) type-checks. An attributes object typed by an interface (`React.ImgHTMLAttributes<HTMLImageElement>`) must be spread into a new object: `image={{ ...imgProps }}`.
- `slotRendersContent(value)` (`src/lib/slot.ts`) is the one "renders anything" check: `''`, and an array, `Set`, generator or Fragment of only nullish, boolean or `''` items (`[]`, `<></>`, `<>{false}</>`, at any depth), render nothing; `0` is content. Components use it to fall back when a slot is effectively empty (a Field `error={[]}` is no error, a dismiss slot that renders nothing keeps the default icon). It reads a top-level generator once and caches its items: a value you check and then render yourself (not through `renderSlot`/`resolveSlot`) goes through `materialiseSlotContent(value)`, so React never enumerates the generator.
- Dismiss and clear slots (Tag, MessageBar, SearchBox, and the `closeButton` of `Dialog.Content` and Drawer) share one rule, `slotWrapsDefaultContent(type, props)`: a slot object wraps the default icon only when its element is an intrinsic, non-void tag without `dangerouslySetInnerHTML` whose children render nothing (`{ className: 'text-error' }` styles the default icon). A component `as` (`{ as: CloseIcon }`), a void tag (`{ as: 'img', src, alt: '' }`) and markup of its own are the icon itself. A `<button>`/`Button` passed there, or a slot object whose `as` is one, is merged into the built-in button; its markup (`dangerouslySetInnerHTML`) renders inside that button. A merged Wave `Button` keeps its own props off the DOM (`BUTTON_OWN_PROP_KEYS` in `src/components/button/Button.slots.tsx`): its `icon` and `iconPosition` place the icon in the built-in button's content, and its `disabledFocusable` makes the built-in button unavailable but focusable.
- Glyph slots inside a built-in button (Combobox, TimePicker and TagPicker `expandIcon`, SplitButton and MenuButton `menuIcon`, `Hamburger.icon`, and the children of `InteractionTag.Secondary`, which is itself the button) never nest a button: a `<button>`/`Button`, or a slot object whose `as` is one, is unwrapped by `unwrapButtonGlyph` (the same module): its children become the glyph, its props are dropped, and a one-time development warning names the slot.
- The last argument of `renderSlot`/`resolveSlot` holds defaults the slot's own props override; icon slots pass `{ 'aria-hidden': true }`.

### Pattern 4: Controlled / Uncontrolled (useControllable)

```tsx
import { useControllable } from '../../hooks/useControllable';

export function useExpanded(expanded: boolean | undefined, defaultExpanded = false, onExpandedChange?: (next: boolean) => void) {
  const [value, setValue, isControlled] = useControllable(expanded, defaultExpanded, onExpandedChange);
  const toggle = () => setValue((prev) => !prev);
  return { expanded: value, toggle, isControlled };
}
```

**Rules**:

- The component is controlled from the first render in which the value is not `undefined` ("sticky" mode). A value that arrives later (data loaded after mount) takes over.
- A controlled value that becomes `undefined` stays controlled and returns the `defaultValue` argument — pass the component's empty value there (`defaultValue ?? ''`), so `value={undefined}` clears it. Each mode switch warns once in development.
- `setValue` accepts a value **or a functional updater** `(prev) => next`. Updaters and the no-op check start from the value the user sees (the last rendered controlled value, or the latest uncontrolled value); two updates in one handler chain.
- `onChange` is called exactly once per change, from the event path (never inside a state updater, so StrictMode does not double it), and **not** when the value does not change (`Object.is`). In controlled mode the component keeps showing the prop until the parent updates it.
- `setValue` has a stable identity. The hook returns `[value, setValue, isControlled]`.
- Event-named callbacks that must fire on every activation (`onPageChange` on the current page) are called from the handler, not through this hook.

### Pattern 5: cn() Utility

`cn()` combines `clsx` (conditional classes) with a `tailwind-merge` that knows Wave's type ramp (`text-caption-2` … `text-display`), shadow scale (`shadow-2` … `shadow-64`), `font-wave`, the `animate-wave-*` animations and the motion tokens (`duration-wave-*`, `ease-wave-*`):

```tsx
import { cn } from '@mortenbrudvik/waveui';

cn('px-4 py-2', true && 'px-6 py-3', 'px-8'); // 'py-3 px-8': the last conflicting class wins
cn('text-body-1 text-foreground', 'text-primary'); // 'text-body-1 text-primary': size kept, color replaced
cn('shadow-4', 'shadow-lg'); // 'shadow-lg'
cn('pe-8', 'px-6'); // 'px-6': a later axis shorthand replaces the logical sides it covers
cn('px-6', 'pe-8'); // 'px-6 pe-8': a later side stays, and wins in the CSS
```

Components always pass the consumer's `className` last, so a user class **replaces a conflicting class of the same variant**: `bg-error` replaces a resting `bg-primary`. A class behind a different variant is not a conflict, and both stay:

```tsx
const base = 'bg-primary not-disabled:not-aria-disabled:hover:bg-primary-hover';

cn(base, 'hover:bg-error'); // both hover classes stay; the gated one (0,4,0) beats `:hover` (0,2,0)
cn(base, 'not-disabled:not-aria-disabled:hover:bg-error'); // same prefix: replaces the built-in hover
cn(base, 'hover:bg-error!'); // both stay; `!important` wins, also while disabled
cn('bg-card data-[selected]:bg-selected', 'bg-muted'); // the selected state still paints bg-selected
```

So the gated hover and pressed classes (`not-disabled:not-aria-disabled:hover:` / `…:active:`) and the state classes (`data-[…]:`, `aria-disabled:`) are not replaced by a bare class of yours: they are more specific and win while their state applies. Override them with the same prefix (`not-disabled:not-aria-disabled:hover:bg-error`, `data-[selected]:bg-muted`) or the important modifier (`hover:bg-error!`).

**Words that name a utility (library sources).** Tailwind reads every word of `src/components` and `src/lib`, comments, identifiers and non-class strings included, and would ship a matching utility (`.container`, `.shadow`, `.filter`) as a global, unlayered class of `./styles`. The CSS build (`scripts/build-css.mjs`) therefore fails on a class that no library class string uses. Do not write a utility name as a bare word there (not `container`, `shadow`, `.filter(`, or a quoted `` `hover:bg-error!` `` in a comment): rephrase it, or, when the word must stay, add it to `@source not inline()` in `src/styles/styles.css` and to `EXCLUDED_WORDS` in `src/styles/__tests__/tokens.test.ts`.

**`hidden`.** Inside `.wave-root` and `.wave-portal`, `base.css` gives `[hidden]` (not `hidden="until-found"`) `display: none !important`, as Preflight does, so a component's display utility never keeps a hidden root visible. Pass `hidden` through to the element that draws the component (the root, or the visible field of a composite control); no `hidden && 'hidden'` class is needed.

### Pattern 6: useId

Generates stable, SSR-safe ids for ARIA relationships:

```tsx
import { useId } from '@mortenbrudvik/waveui';

export function Hint({ text }: { text: string }) {
  const hintId = useId('hint'); // 'hint-' followed by React's opaque id
  return (
    <>
      <label>
        Name <input aria-describedby={hintId} />
      </label>
      <p id={hintId}>{text}</p>
    </>
  );
}
```

The part after the prefix is React's own id, whose format changes between React versions: never parse it or write selectors or test expectations against a literal form. Query by role and relationship instead, and `CSS.escape` an id before putting it in a selector.

### Pattern 7: Polymorphic Components

`Button`, `CompoundButton`, `Link`, `Text`, `Toolbar`, `Toolbar.Button`, `Menu.ItemLink`, `Card` (and its parts), `Stack`, `Flex`, `Grid`, `Tag` and `Divider` take an `as` prop, and their props are type-checked against the rendered element:

```tsx
import { Button, Text } from '@mortenbrudvik/waveui';
import type { ButtonProps } from '@mortenbrudvik/waveui';

export const Links = () => (
  <>
    <Button as="a" href="/docs" target="_blank" appearance="primary">
      Documentation
    </Button>
    <Text as="h1" variant="title-1">
      Welcome
    </Text>
  </>
);

// The 0.4 name still means "props of a Button rendered as <button>".
export interface TrackedButtonProps extends ButtonProps {
  trackingId?: string;
}
```

Each component declares `XOwnProps` with its own props only (never the default element's HTML attributes) and `type XProps<C extends React.ElementType = '<default element>'> = PolymorphicProps<C, XOwnProps>`, where the default is the component's own element: `'button'` for Button, CompoundButton and `Toolbar.Button`, `'a'` for Link and `Menu.ItemLink`, `'span'` for Text and Tag, `'hr'` for Divider, and `'div'` for Toolbar, Card and its parts, Stack, Flex and Grid. `<Button as="a" formAction>` is a type error.

`React.ComponentProps<typeof Button>`, `React.memo(Button)` and Storybook's `Meta<typeof Button>` see the default element's props (`ButtonProps`): `PolymorphicComponent` ends with a default-element call signature. For another element, name it: `ButtonProps<'a'>`, and `StoryObj<ButtonProps<'a'>>` for stories whose args use `as`. In tests, a `testSystemProps` call whose `a11yVariants` use `as` names the widened type: `testSystemProps<ButtonProps<React.ElementType>>(Button, …)`.

**Button with `as`**:

- **Non-interactive elements.** `as="div"`, `as="span"` and other elements that are not interactive by themselves get `role="button"`, `tabIndex={0}` and Enter (key down) / Space (key up) activation, like a native button; a consumer `role` or `tabIndex` wins. So does `as="a"` without `href` (and a `Link` without `href`): it keeps its `<a>` element, and any `href`, `''` included, keeps it a link. `as="a"` shows no link underline. Button and Link share this logic (`Button.semantics.ts`). A native `<button>` gets `type="button"` by default (also when a wrapper forwards `type={undefined}`); a custom `as` component gets no `type` default, so pass `type` yourself inside a form.
- **`disabled`.** Only `button` (the default), `input`, `select` and `textarea` receive the native `disabled` attribute. Every other `as` gets `aria-disabled="true"` and `tabIndex={-1}`, placed after the rest props so a consumer value cannot re-enable it. That covers `a`, `div`, `span` and any custom component, including router links and styled or motion components that render a native `<button>`. Clicks, Enter and Space are prevented (the click does not reach ancestor `onClick` handlers), and an `<a>` drops its `href` and keeps `role="link"` (`role="button"` when it had no `href`). Every disabled Button renders `data-disabled`. Such an element has no native `:disabled` state, so its own `:disabled` styling does not apply: style it on `[aria-disabled="true"]`. It leaves the tab order but can still take focus from a mouse click.
- **`disabledFocusable`** keeps an unavailable button in the tab order: `aria-disabled="true"`, `data-disabled` and `data-disabled-focusable` on any element (a native `<button>` gets no `disabled` attribute), a click, Enter, Space and implicit form submission blocked (the click does not reach ancestors), other keys forwarded, and it wins over `disabled`. An `<a>` drops its `href` but keeps `tabIndex={0}`. Toolbars keep it in their arrow-key order and `Menu.Trigger` never opens from it. While it shows its focus ring it is drawn at full opacity (`aria-disabled:focus-visible:opacity-100`), because the disabled look's opacity would dim the ring below 3:1.
- **Hover and pressed colors** are gated (`not-disabled:not-aria-disabled:hover:` / `…:active:`), so they never apply while disabled or `aria-disabled` and they work for `as="a"`. A bare `className="hover:bg-error"` does not override them (see [Pattern 5](#pattern-5-cn-utility)): use `not-disabled:not-aria-disabled:hover:bg-error` or `hover:bg-error!`. CompoundButton, ToggleButton, MenuButton and SplitButton behave the same.

### Pattern 8: Composite Controls and Field

Controls whose root wraps a focusable element (Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker, TimePicker) route `id`, the naming and validation ARIA attributes (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`; on Checkbox and Switch also `aria-disabled`), `tabIndex`, `autoFocus`, focus/key handlers and native input attributes to the focusable element; `className`, `style`, `data-*`, other `aria-*` attributes and `ref` stay on the root, and `controlRef` reaches the focusable element. SearchBox and SpinButton draw their field (border, background, focus and invalid look) on that root, so `className`, `style` and `hidden` reach the visible field. `Input` with `contentBefore`/`contentAfter` content is the exception: its bordered wrapper receives only `className`, `style` and `hidden`, and everything else stays on the `<input>`.

Every library control reads the surrounding `Field` through `useFieldControl`, which merges the control's own labelling props with the Field's label, validation message (in any state), hint, invalid state (error only) and required state. Your own controls can do the same:

```tsx
import * as React from 'react';
import { Field, useFieldControl } from '@mortenbrudvik/waveui';

function ColorWell({ id, 'aria-describedby': describedBy }: { id?: string; 'aria-describedby'?: string }) {
  const fieldProps = useFieldControl({ id, 'aria-describedby': describedBy });
  return <input type="color" {...fieldProps} />;
}

export const Theme = () => (
  <Field label="Accent" hint="Used for links and buttons">
    <ColorWell />
  </Field>
);
```

**Validation states.** A Field shows one validation message below the control, styled and announced by `validationState`:

| State | Look | Control | Announced |
|---|---|---|---|
| `error` (the default when `validationMessage` is set) | error icon, `text-error` | `aria-invalid="true"` | yes (`role="alert"`) |
| `warning` | warning icon, `text-warning-tint-foreground` | not invalid | yes (`role="alert"`) |
| `success` | success icon, `text-success-tint-foreground` | not invalid | no |
| `none` | no icon, `text-muted-foreground` | not invalid | no |

`error` is the shorthand for an error message (`error="…"`, or `error={true}` to mark the control invalid without one) and wins over `validationMessage` and `validationState`, with a development warning when both are set. The hint stays visible after the message, and the control is described by the message, then the hint. `validationMessageIcon` replaces the icon (`null` removes it), and `orientation="horizontal"` puts the label in a start column beside the control, its first line level with the control's first line (a Checkbox, Switch or RadioGroup as the first child gets 6px of padding above and below its 20px first row, as tall as an Input). The root carries `data-validation-state` and `data-orientation`.

```tsx
<Field
  label="Username"
  hint="Letters and digits only"
  validationState="success"
  validationMessage="The name is available"
>
  <Input />
</Field>
```

For custom controls, `FieldContextValue` carries the state: `validationState` and `validationMessageId`, the message's id in every state (`errorId` is set only in the error state, and so is `invalid`). `useFieldControl` describes the control with `validationMessageId ?? errorId`, then the hint, so the `ColorWell` above is described by a warning or success message too. `hasErrorMessage` is `true` only for an error message, so a control that shows its own error (Input `error`, DatePicker's rejected text) keeps it next to a Field warning. ProgressBar reads `validationState` to color its fill.

### Pattern 9: Overlays and Triggers

- `Dialog.Trigger`, `Drawer.Trigger`, `Popover.Trigger` and `Menu.Trigger` merge their props (`aria-haspopup`, `aria-expanded`, `aria-controls`, a composed `onClick`, a ref) onto their single child, or pass them to a render-prop child. The trigger's live state always wins over the child's own ARIA props; the child's own `id` and handlers are kept. A Fragment around one element counts as that element.
- With `asChild={false}`, or when the child is text, several elements or a component that neither forwards `ref` nor spreads its props, the trigger renders a wrapper `<span>` (the automatic cases warn in development). A generic span cannot carry the state ARIA, so `aria-haspopup`, `aria-expanded` and `aria-controls` go to the first element in the tab order inside it (after mount), unless the consumer made the span the trigger (a non-generic `role` and `tabIndex={0}`: it keeps them; with only such a role it keeps them when nothing inside it is in the tab order). `tabIndex` alone leaves the span generic, so it never carries them (axe `aria-allowed-attr`). Every focus return of Menu, Popover, Dialog and Drawer goes to the element that carries them (`getTriggerFocusTarget` in `src/hooks/useTriggerElement.tsx`).
- Overlay surfaces render through `Portal` into `document.body` (or `WaveProvider`'s `portalContainer`) inside a `wave-portal` wrapper that carries the theme, direction and font.
- A `Portal` renders nothing on the server or during hydration, so a component whose open surface is portaled gates its open state on the client: `const isClient = useIsClient();` then `const open = openState && isClient;` (the state from `useControllable` stays as it is, so no `onOpenChange` fires). Rendered with `defaultOpen` or `open`, it is closed in the server HTML (no `aria-expanded="true"`, no `aria-controls` or `aria-activedescendant` pointing at a missing element) and opens once hydrated: Popover, Menu, Dialog, Drawer, DatePicker, TimePicker and TagPicker. Combobox and Dropdown get the same result because their options register only on the client.
- Escape and outside presses close only the topmost layer; presses inside overlays opened from a surface count as inside it. A surface that closes when focus leaves it (Menu, listbox popups, the AvatarGroup and InfoLabel popups) decides in a microtask after the focus change, so an `autoFocus` field of a popover, dialog or portal opened from inside it keeps it open.
- **Context mode** (`openOnContext` on Menu and Popover): the trigger's child is a context-menu region, not a popup button. A cloned child or wrapper span receives the forwarded props and, of the trigger's own, only its id, ref and context-gesture handlers (`useTriggerElement` with `omitStateAria`); a render-prop child still receives every member, and the `aria-haspopup`, `aria-expanded` and `aria-controls` it spreads are removed from its element after each commit, with a development warning. The surface is not labelled by the region: it needs `aria-label` (Popover also `title`). The element focused at the gesture is the first focus-return target; an opening without a gesture (a controlled `open`) forgets it. A pointer gesture closes the surface on a scroll that moves the region or the element under the pointer (while that element has a box); a keyboard gesture, on one that moves the focused row (the region, when it had focus itself). A Menu in context mode ignores a focus move into the region that a right-button, Ctrl+, touch or pen press causes (the row it focuses before the `contextmenu` event moves the menu there); any other focus move into the region closes it.
- **`target`** (`Menu.Popover`, and the `Popover` root next to `side` and `align`) takes a `PopupTarget`: an element held in state or a `VirtualElement` (`{ getBoundingClientRect, contextElement? }`, an inline object is fine). The positioning reference is the context anchor while a context gesture opened the surface, else `target`, else the trigger; a `target` element counts as inside for outside presses. `Popover`, `Menu.Popover` and TeachingPopover take the same `PopupTargetInput` (an element held in state, a `VirtualElement` or a ref object, read after each render of the popup) unifies them.
- **Submenus.** A `<Menu>` rendered in a menu list at the list's portal depth (`PortalDepthContext`) is a submenu; a Menu inside a Popover or Dialog opened from an item (a portal in between) is a root menu. Every close of a menu first closes its open submenu, innermost first, and a submenu's open state is its own and its parent's, so a parent that closes, by any path, takes its submenus with it in the same commit.
- **Motion.** Every overlay surface with motion (not yet the listbox popups of Combobox, Dropdown, TagPicker and TimePicker, the DatePicker calendar and the AvatarGroup popover: [ROADMAP §8.5](ROADMAP.md#85-follow-ups-outside-the-gap-list)) mounts through the presence core: `usePresence(open, { appear: true, unmountOnExit })` for the surfaces that report themselves closed until hydration (Dialog, overlay drawers, Menu, Popover, Tooltip, InfoButton, TeachingPopover), no `appear` for in-flow content. It renders while `isMounted`, spreads `presenceProps` on every top-level element of its portal and puts the presence ref on the element its recipe animates; everything else (layers, trap, isolation, scroll lock, `useRestoreFocus`, `usePopupPosition`, surface registration, hover intent) keys on `open`. Focus inside a positioned surface that closes moves out in the closing commit (`useFocusBeforeClose`, internal; give it and `useRestoreFocus` the same targets in the same order). Popups render `data-state` (`open`, `closed` while exiting) and `data-side`, which picks the slide direction in CSS; their recipes never transition `transform`. The classes come from `src/lib/motion.ts` through `useMotionClasses(slot, recipe, legacyClassName?)` (see [Component Motion](#component-motion)).
- Clicks and keys from a portal opened inside an item (a Popover in a `Menu.Item`, a popup from a List action) bubble through the React tree; the item's own handling ignores events whose target is outside it in the DOM (C-COMPOSE), while the consumer's handlers still receive them (a disabled `Menu.Item` calls no `onClick`, as a disabled button).

### Pattern 10: Stable Class Names

Every public component and compound part carries a stable class, registered in `src/lib/classNames.ts` and exported from the package entry. A new component registers its constant in the same change:

```tsx
// src/lib/classNames.ts (server-safe: no imports)
/** Stable class names of Chip: `root` on the `<button>`, `icon` on the icon box. */
export const chipClassNames = {
  root: 'wave-chip',
  icon: 'wave-chip__icon',
} as const;
```

```tsx
// src/components/button/Chip.tsx
import * as React from 'react';
import { cn } from '../../lib/cn';
import { chipClassNames } from '../../lib/classNames';
import { renderSlot } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Slot } from '../../lib/types';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: Slot<'span'>;
  ref?: React.Ref<HTMLButtonElement>;
}

export const Chip = ({ icon, className, ref, children, ...rest }: ChipProps) => (
  <button
    type="button"
    ref={ref}
    className={cn(chipClassNames.root, 'rounded-md border border-stroke px-3 py-1', focusRing, className)}
    {...rest}
  >
    {renderSlot(icon, 'span', cn(chipClassNames.icon, 'inline-flex size-4'), { 'aria-hidden': true })}
    {children}
  </button>
);
Chip.displayName = 'Chip';
```

- **Names.** The root class is `wave-` and the kebab-cased flat export name (`CardHeader` → `wave-card-header`); a part class is `<root>__<kebab part key>`; the constant is the camel-cased flat name plus `ClassNames`, with camelCase keys and `as const`. `WaveProvider` (`wave-root`) and `Portal` (`wave-portal`) keep their scope classes. A component that renders no element of its own (Dialog, Popover, Presence, the trigger and close parts that clone their child) has no constant; an alias shares its target's (`ComboboxOption` uses `optionClassNames`).
- **Placement.** The root class goes first in the `cn()` of the element that receives `className`, so the consumer's class still comes last. A part is an element the component renders that a prop or slot fills or controls (icon, dismiss button, expand icon, checkmark, secondary text, validation message) or visible structure (track, thumb, rail, surface, header, footer); hidden inputs, visually hidden text, live regions and layout wrappers are not parts. A slot part passes its class in `renderSlot`'s base classes, so it stays when a slot object swaps the element. Never apply a stable class inside a shared style helper (`buttonClassName()`, `menuItemClasses`): elements that are not that component use those helpers too. Note the one letter between the public `buttonClassNames` and the internal `buttonClassName()`.
- **Variants and nesting.** A variant lists the base constant first: `cn(buttonClassNames.root, toggleButtonClassNames.root, …)`. A variant that renders Button hands its icon class over with `withPartClass(icon, toggleButtonClassNames.icon)` (`Button.slots.tsx`), which wraps the slot so that Button's own icon span carries both classes; Button gains no prop. A public component rendered inside another gets the parent's part class through its `className`: `<Button {...menuButtonProps} className={cn(splitButtonClassNames.menuButton, menuButtonProps?.className)} />`.
- **Literal member access.** Write each member you apply literally (`toggleButtonClassNames.root`, never `names[kind].root`), also when a shared renderer draws the element: the menu item kinds pass `rootClassName={cn(menuItemClassNames.root, menuItemCheckboxClassNames.root)}` to `MenuItemRow`. The gate and the registry test find the constants by that text.
- **No state classes.** State stays in `data-*` attributes and ARIA (C-CLASS).
- **Enforcement.** The conventions gate's `class-names` rule fails a module that sets a registered component's `displayName` without applying its constant's `root`; `testSystemProps` asserts the root classes where `className` lands; `src/__tests__/classNames.test.ts` checks that every public component has a constant (or is on its no-element list), that every constant follows the formula, that every key is applied somewhere in `src/components`, and that the entry exports every constant; `verify-dist` checks that the entry exports them with the same values, that a Server Component can read them, and that an import of only Button keeps `'wave-button'` and drops other components' classes.
- **Stability.** The names are public API: no class is removed before 1.0. A renamed part, or a part that becomes a compound member of its own, keeps its old class next to the new one until 1.0; moving a class to another element is a CHANGELOG "Changed" DOM entry.
- **Words.** The registry is under `src/lib`, which Tailwind scans: its JSDoc names elements by role ("the grid element"), never with a utility name as a bare word ([Pattern 5](#pattern-5-cn-utility)).

### Pattern 11: The Input Recipe (sizes and appearances)

The ten text controls and pickers (Input, Textarea, Select, SearchBox, SpinButton, Combobox, Dropdown, DatePicker, TimePicker, TagPicker) share one look, built from class maps in `src/lib/styles.ts` over the markup each control already had. A control draws its field either on its own element (Input without slots, Textarea, Select, the Dropdown button) or on a wrapper around the native element (Input with slots, SearchBox, SpinButton, the pickers, TagPicker); the maps serve both forms, so no control gains or loses an element.

- **The maps**, keyed by `CoreSize` (`small`, `medium`, `large`: 24, 32 and 40px) or `InputAppearance` (`outline`, `underline`, `filled-darker`, `filled-lighter`): `inputHeightClasses`, `inputTextClasses` (`text-caption-1`, `text-body-1`, `text-body-2`), `inputPaddingClasses` (8, 12 and 16px, for the element form) and `inputAppearanceClasses` (fill, strokes and corners; the appearances without a full visible stroke add `forced-colors:border-[ButtonText]`, so every appearance keeps a boundary in Windows High Contrast). `hitAreaLayer` grows a small button's target to 24px without growing its box; the picker buttons per size live in `pickerStyles.ts` (`pickerIconButtonClasses`, `pickerButtonOffset`, `pickerEndPadding`, `pickerGlyphSize`).
- **Compose the state recipes after the appearance.** `inputFocus` and `inputFocusWithin` color the focused bottom border (`primary`, 2px), and `inputInvalid` and `inputInvalidWithin` color every border the appearance draws (`destructive`). A focused invalid field therefore shows the focus indicator below and the error on the other sides.
- **Resolve with `useInputLook(size, appearance, { sizes?, defaultSize? })`** (internal): the control's own prop, then the surrounding Field's `size`, then `WaveProvider inputDefaults`, then `medium` and `outline`. A size outside `sizes` is skipped (TagPicker has no `small`). The choice controls (Checkbox, Switch, Slider) have their own unions and read neither the Field nor the provider.
- **State attributes.** The element that receives `className` renders `data-size` and `data-appearance` with the resolved values, always, before `{...rest}`, so `[data-appearance=underline]` and a consumer's `className` meet on the same element.

```tsx
import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  inputAppearanceClasses,
  inputFocus,
  inputHeightClasses,
  inputInvalid,
  inputPaddingClasses,
  inputTextClasses,
} from '../../lib/styles';
import type { CoreSize, InputAppearance } from '../../lib/types';
import { useInputLook } from './inputLook';

export interface MaskedProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: CoreSize;
  appearance?: InputAppearance;
  invalid?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

export const Masked = ({ size, appearance, invalid, className, ref, ...rest }: MaskedProps) => {
  const look = useInputLook(size, appearance);
  return (
    <input
      type="text"
      ref={ref}
      data-size={look.size}
      data-appearance={look.appearance}
      className={cn(
        'w-full text-foreground placeholder:text-muted-foreground',
        inputHeightClasses[look.size],
        inputTextClasses[look.size],
        inputPaddingClasses[look.size],
        inputAppearanceClasses[look.appearance],
        inputFocus,
        invalid && inputInvalid,
        className,
      )}
      {...rest}
    />
  );
};
Masked.displayName = 'Masked';
```

- **A numeric HTML `size`.** Input and Select inherited the native `size`; they omit it and declare `size?: CoreSize | number` plus `htmlSize?: number`. A number keeps its meaning and is a deprecated alias of `htmlSize` (`resolveDeprecatedProp`), and the design size then resolves as if `size` were unset. Slider ignores the native attribute, so its number is only reported once, from an effect.
- **Fields.** `Field size` sets the label's type ramp and, in the horizontal layout, its top padding; it reaches the controls inside through `FieldContextValue.size`, which is absent when the prop is unset so that the provider's default still applies. A `Label` or `InfoLabel` element passed as `label` is recognised by the marker in `fieldLabel.ts` (not by an import, so a Field-only bundle carries no InfoButton code) and rendered in place of Field's own `<label>`.
- **Guidance for consumers.** The filled appearances have no visible stroke, so a filled field needs a visible label (a placeholder is not one); use `filled-darker` on the page background and `filled-lighter` on a surface other than the page background.

### Pattern 12: Building a Custom Picker

Dropdown, Combobox, TagPicker and Listbox are built on public pieces, so a picker the library does not ship (a font picker, a list with rich rows) gets the same option model, keys and ARIA. The [README](../README.md#listbox-and-custom-pickers) has a complete popup picker (`SizePicker`), and the `CustomPicker` story in `stories/Listbox.stories.tsx` an editable one that filters as you type.

| Piece | Role |
|---|---|
| `useListbox(options)` | The listbox: its options (registered, or `items`), the active option (on `useActiveDescendant`, Pattern 13), keys and typeahead, `filter`, `multiselect`, `disabledOptionsFocusable`. `mode` is `'select-only'` (a button combobox, as Dropdown), `'editable'` (an `<input>` combobox, as Combobox) or `'standalone'` (a list that holds focus, as Listbox). You own the open state (`open`, `onOpenChange(open, details)`) and the value (`selectedValues`, `onSelect(value, details)`). |
| `useListboxPopup(options)` | The popup's dismiss layer (`onDismiss(reason)`, a `DismissReason`: `'escape'`, `'outside-press'` or `'focus-outside'`; presses and focus inside `rootRef` are inside) and its position against the element passed to `setReference` (merge it into your combobox's ref). Destructure the result: `react-hooks/refs` rejects reading the members of an object whose member is passed to a `ref`. |
| `ListboxSurface` | Renders the list: in a portaled surface while it is shown, `hidden` in place otherwise, so the options register from the first render. Provides the options' context. `listClassName` and `surfaceClassName` are merged last. |
| `ListboxProvider` | Provides the options' context (`listbox.context`) to a list you render yourself. |
| `Option`, `OptionGroup` | The built-in option and group; `Option` reads `multiselect` from the context and draws its check (in a multi-select list, a checkbox square; `ListboxSurface`'s `showCheck={false}` turns it off). |
| `useListboxOption(props, ref?)`, `markListboxElement(component, kind)`, `collectOptionLabels(children)` | Option components of your own: `useListboxOption` registers the option and reads its flags; the mark lets `collectOptionLabels` read its label before it registers. |

The rules (the "Consumer contract" in `useListbox`'s JSDoc):

- **One container.** A listbox's options live in one list at a time: inline and `hidden` while closed, portaled while open, never both, not even for an exit animation. `ListboxSurface` does this.
- **The combobox modes.** Spread `getComboboxProps()` on the combobox element, then set `aria-expanded` to a value of your own, `const expanded = open && listbox.items.length > 0` (open with an option to show; `useListbox` returns no `expanded`), and pass the same value to `ListboxSurface`'s `expanded`. Attach both `onKeyDown` and `onKeyUp`: without `onKeyUp`, the native click of a `<button>` combobox on Space keyup toggles the list again.
- **Escape with nothing shown.** While the listbox is open but shows no option, close it on Escape yourself (outside an IME composition) without calling `listbox.onKeyDown`, so the key reaches an enclosing layer such as a Dialog.
- **Display text.** `listbox.getItem(value)?.label ?? collectOptionLabels(children).get(value)`: options register in a layout effect, so the server HTML and the first render read the labels from the children.
- **Standalone mode.** Spread `getListboxProps()` on the list (`tabIndex: 0`, `aria-activedescendant`, and a `ref` through which a press on an option focuses the list: merge it with yours), attach `onKeyDown` to the list (`onKeyUp` only guards a `<button>` combobox's Space keyup, so the list needs none), and pass the list's own focus as `open`. `getComboboxProps()` is not used; Tab, Escape and the Alt+arrow keys stay with the page.
- **Forms and Field.** `HiddenInput` is internal: submit the value through a plain `<input type="hidden">`, and wire a surrounding Field with `useFieldControl` ([Pattern 8](#pattern-8-composite-controls-and-field)).

A list in the page with an option component of your own (standalone mode, `ListboxProvider`):

```tsx
import * as React from 'react';
import {
  ListboxProvider,
  markListboxElement,
  useListbox,
  useListboxOption,
} from '@mortenbrudvik/waveui';

interface ColorOptionProps {
  value: string;
  /** The swatch color (runtime data). */
  color: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function ColorOptionImpl({ value, color, disabled, children }: ColorOptionProps) {
  const { optionProps, selected } = useListboxOption<HTMLLIElement>({ value, disabled });
  return (
    <li
      {...optionProps}
      className="flex items-center gap-2 rounded px-3 py-1.5 data-[active]:bg-subtle-hover data-[active]:outline-2 data-[active]:outline-ring data-[disabled]:text-muted-foreground"
    >
      <span aria-hidden="true" className="size-3 rounded-full" style={{ background: color }} />
      {children}
      {selected && (
        <span aria-hidden="true" className="ms-auto">
          ✓
        </span>
      )}
    </li>
  );
}
ColorOptionImpl.displayName = 'ColorOption';

// Marked, so collectOptionLabels reads its label before it registers (server HTML, first render).
export const ColorOption = markListboxElement(ColorOptionImpl, 'option');

export function AccentList() {
  // Standalone mode: `open` is the list's own focus.
  const [focused, setFocused] = React.useState(false);
  const [value, setValue] = React.useState('teal');
  const listbox = useListbox({
    open: focused,
    mode: 'standalone',
    selectedValues: [value],
    onSelect: (next) => setValue(next),
  });
  // `tabIndex: 0`, `aria-activedescendant` and a ref the pointer press focuses the list through.
  const listProps = listbox.getListboxProps();
  return (
    <ul
      aria-label="Accent color"
      {...listProps}
      onKeyDown={listbox.onKeyDown}
      onFocus={(event) => {
        if (event.target === event.currentTarget) setFocused(true);
      }}
      onBlur={(event) => {
        if (event.target === event.currentTarget) setFocused(false);
      }}
      // The active option shows focus; with none active, the list draws its own ring.
      className={`m-0 flex list-none flex-col p-1 ${
        listbox.activeValue === null
          ? 'focus-visible:outline-2 focus-visible:outline-ring'
          : 'focus:outline-hidden'
      }`}
    >
      <ListboxProvider value={listbox.context}>
        <ColorOption value="teal" color="teal">
          Teal
        </ColorOption>
        <ColorOption value="plum" color="plum">
          Plum
        </ColorOption>
        <ColorOption value="gold" color="gold" disabled>
          Gold
        </ColorOption>
      </ListboxProvider>
    </ul>
  );
}
```

- **The option's props.** Spread `optionProps` on the `<li>`: `id`, `role="option"`, `aria-selected`, `aria-disabled`, `hidden` (filtered out, or hidden itself), the `data-active`, `data-selected` and `data-disabled` styling hooks, `onClick`, `onPointerMove` and, in standalone mode, `onMouseDown` (the press). Compose your own handlers with them (`composeEventHandlers`, your handler first).
- **Re-renders.** The option reads its active, selected and hidden flags from the listbox's store through `useSyncExternalStore`, so moving the active option re-renders only the old and the new option.
- **Focus.** The active option never has DOM focus: style `data-active` as its focus indicator. A disabled option is skipped by the keys (unless `disabledOptionsFocusable`) and never committed.
- **Marks.** Mark every option and group component of your own (`markListboxElement(GroupImpl, 'group')` walks its children); an unmarked component is opaque to `collectOptionLabels`, so its label is unknown until it registers.

### Pattern 13: Active-Descendant Widgets

A composite widget moves focus among its items in one of two ways:

- **Roving tab index** (`useRovingTabIndex`): DOM focus moves to the item, which holds the one Tab stop. Toolbar, RadioGroup, Menu, Tree and SwatchPicker's row and grid layouts use it (the grid through the internal `useRovingGrid`); use it when the items are controls of their own.
- **Active descendant** (`useActiveDescendant`): DOM focus stays on one element, an `<input>` or the list, and its `aria-activedescendant` names the active item. The comboboxes and Listbox use it; use it when typing must stay in an input, or when the items are not focusable controls.

`useListbox` is built on `useActiveDescendant`; use the hook directly for a composite that is not a listbox, such as a command palette:

```tsx
import * as React from 'react';
import { useActiveDescendant, useId } from '@mortenbrudvik/waveui';

interface Command {
  id: string;
  label: string;
}

export function CommandPalette({
  commands,
  onRun,
}: {
  commands: readonly Command[];
  onRun: (command: Command) => void;
}) {
  const inputId = useId('palette');
  const listId = `${inputId}-list`;
  const optionId = (id: string) => `${inputId}-${id}`;
  const [query, setQuery] = React.useState('');
  const matches = commands.filter((command) =>
    command.label.toLowerCase().includes(query.toLowerCase()),
  );
  const active = useActiveDescendant({
    items: matches.map((command) => command.id),
    getId: optionId,
    fallback: matches[0]?.id ?? null,
    activateFirstOnChange: true,
  });

  return (
    <>
      <input
        id={inputId}
        role="combobox"
        aria-label="Command"
        aria-expanded={true}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active.activeDescendantId}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (event.key === 'ArrowDown') active.next();
            else active.prev();
          } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            const command = matches.find((match) => match.id === active.activeValue);
            if (!command) return;
            event.preventDefault();
            onRun(command);
            setQuery('');
          }
        }}
      />
      <ul id={listId} role="listbox" aria-label="Commands">
        {matches.map((command) => (
          <li
            key={command.id}
            id={optionId(command.id)}
            role="option"
            aria-selected={command.id === active.activeValue}
            data-active={command.id === active.activeValue ? '' : undefined}
            onPointerMove={() => active.highlight(command.id)}
            onClick={() => onRun(command)}
            className="px-3 py-1.5 data-[active]:bg-subtle-hover"
          >
            {command.label}
          </li>
        ))}
      </ul>
    </>
  );
}
```

- **Items and ids.** `items` are the values in navigation order and `getId(value)` the DOM id of a value's element. Derive ids from values, not positions, so a filtered list keeps them.
- **Enabled.** While `enabled` is `false` (a closed popup, an unfocused list) nothing is active and the moved-to item is forgotten; a move made in the same update that enables the hook is kept (move, then open).
- **Fallback.** `fallback` is active while nothing was moved to (the selected item, for example). A moved-to item that leaves `items` is dropped and does not come back when it returns. `activateFirstOnChange` makes the first item active whenever `items` changes while enabled, for a list that filters as you type.
- **Moves.** `next()` and `prev()` (wrapping with `loop`), `first()`, `last()`, `move(delta)` (PageUp/PageDown: clamped, never wrapping) and `setActiveValue(value)` scroll the item into view (`{ block: 'nearest' }`; `getElement` replaces the id lookup); `highlight(value)` (pointer movement) and `setActiveValue(value, { scroll: false })` do not, so the list does not move under the pointer. The methods keep their identities across renders.
- **Reporting.** `onActiveValueChange` reports each change after the commit, `null` included, once (StrictMode too).
- **Server.** The active item is React state derived during render, so the server HTML of an enabled hook with a fallback carries its id. Render `aria-activedescendant` only while that element exists: a portaled popup is not in the server HTML ([Pattern 9](#pattern-9-overlays-and-triggers)).
- **Focus and announcements.** The active item has no DOM focus: mark it (`data-active`) and draw its focus indicator yourself. `aria-selected` marks the selection; a palette without one marks the active command, as APG's list-autocomplete combobox does. The hook announces nothing; a widget that needs announcements adds them (`useAnnounce`).

### Pattern 14: Focus After Removing an Element That Has It

When the element that has focus unmounts, the browser drops focus to `<body>`. A component that removes such an element (a dismissed tag, a cleared value, a closed row) moves focus first, in two steps:

1. **Record in a layout cleanup.** The cleanup of a `useLayoutEffect` runs while the unmounting nodes are still in the document: check that focus is inside the element (`node.contains(node.ownerDocument.activeElement)`) and record where focus should go (the neighbours, the fallback), reading the DOM then.
2. **Move in a microtask.** After the commit, focus the first recorded candidate that is still connected and enabled, else the fallback. `usePreserveFocus` (`src/hooks`) runs that step: a remount of the element cancels it (a controlled parent kept the tag), and focus that something else placed first wins.

TagGroup's tags do this (`useRemovalFocus` in `TagGroup.context.ts`): the next tag's corresponding control, else the previous one's, else `fallbackFocusRef`, else nowhere, with a development warning (`TagGroup:focus-lost`). A removal the app refuses moves no focus, because nothing unmounts. Tests assert focus after `await act(async () => {})` (docs/testing-best-practices.md).

### Pattern 15: Compound Parts That Render Defaults

A compound that also has a one-prop form (`<TagPicker options={…} />`) makes that form the parts with their defaults: each part renders its default content when it has no children (`<TagPicker.Control />` holds the default tags and the Input, `<TagPicker.List />` the options of `options`), and the root adds a missing part (no `TagPicker.List`: the default list). A consumer then replaces only the part they need. The rules that keep both forms one component:

- The root finds its parts among its direct children (through `isElementOfType`, so a Server Component's lazy references count) and warns when a part sits elsewhere (`TagPicker.List:placement`).
- One state for both forms: the root's context holds the value, the query and the trigger wiring, and each part reads it; a part outside the root throws in development (C-CONTEXT).
- Content the root needs before the parts render (the options' labels for the tags and the summary) is read from the children (`collectOptionLabels`), so the server HTML agrees with the client.
- Routed props go to whichever trigger part renders (`TagPicker.Input` or `TagPicker.Button`), and exactly one trigger renders (`TagPicker:trigger`).

TeachingPopover follows the pattern from the other side: its `steps` form renders the parts with their defaults (a Surface holding `Header`, `Title`, `Body` and `Footer`), so a part without children renders exactly the `steps` form's markup, and each part's stable class sits on the element that takes its `className` (that is why the 0.14 `steps` form gained a header element and the parts' classes). The surface hooks live once, in an internal surface both forms render. The root renders its own surface only while no `Surface` is a direct child and none has registered from deeper down (a Surface in a wrapper component registers once mounted, so the server HTML holds both surfaces; write parts directly inside the root where the server HTML matters), and a Title registers its id with the surface it sits in, so a surface with your own content is named by its Title wherever it is.

### Pattern 16: Custom Overlays on the Public Hooks

The hooks behind the library's own surfaces are public, so a surface the library does not ship (a command palette, a full-screen overlay, a custom popup) behaves like a built-in one. Three pieces compose it:

1. **A dismiss layer** (`useDismiss`): Escape closes the topmost layer first, a press outside the layer's tree closes it, and `Portal layerId={layerId}` makes the layers opened inside (a Popover, a Menu) its children, which close first.
2. **A position** (`usePopupPosition`) for a surface anchored to something: `side`, `align`, `offset`, `flip` with `fallbackPlacements`, `shift`, `fitViewport`, `matchReferenceWidth`, `hideWhenDetached` and `onPositioned`; the anchor is an element or a `VirtualElement`.
3. **A modal layer** (`useModalLayer`) for a surface that takes over the page: the dismiss layer plus the focus trap, the `inert` isolation of everything else, the scroll lock and focus restore, in the order that works. `modalType` `'non-modal'` registers the lighter `dialog` layer kind instead.

Rules that keep a custom surface honest:

- Hold the surface element in state through a callback ref (`useMergedRefs(surfaceRef, setSurface)`) and pass it as `container`; never read `ref.current` in an effect keyed on `open`.
- Key the hooks on the open state, not on a mount, and move focus out of a closing surface in the closing commit (C-POPUPS).
- Isolation is `inert`, never `aria-modal`: the Toaster stays announced and reachable. An app-owned region that a modal must leave usable (a status bar, its own notification area) spreads `modalAllowProps`: its content counts as inside every dismiss layer, its tabbable elements join every focus trap's Tab cycle and it is never made `inert`. `useModalOpen()` says whether a modal is open, for global shortcuts.
- A focus trap and the roving or group hooks cooperate through the DOM: `useFocusableGroup` makes a row of controls one tab stop (Enter enters, Escape leaves), `useRovingTabIndex` with `orientation: 'grid'` is the arrow-key model of a grid, `useActiveDescendant` that of a widget that keeps focus on one element, and `getTabbableElements` plus the `focusRing` recipes are the finders and look the library uses.

`stories/CustomOverlays.fixtures.tsx` holds a command palette over a Dialog, a popup on the position and dismiss hooks, and an app-owned status region; `src/__tests__/integration.test.tsx` ("custom overlays on the public hooks") shows the behaviour they must keep.

### Pattern 17: Shared Size Contexts

A part that draws something sized by its host reads a context from the host instead of taking a prop from every caller. `Avatar.context.ts` holds two: `AvatarSizeContext` (`{ size, shape? }`: the box in pixels that a `Tag`, an `InteractionTag` or an `AvatarGroup` gives the Avatar it holds, and the shape of a rounded tag) and `AvatarBadgeSizeContext` (the size a `PresenceBadge` inside an Avatar takes). `AvatarGroup.context.ts` adds the group's `size`, `layout` and whether it holds inline members.

- **Resolution order.** The part's own prop wins, then the host's context, then the default (`Avatar`: its `size`, the group's, the tag's box, `medium`). The context holds a number, so a named size and a pixel size resolve alike (`avatarPixelSize`).
- **Context files import no component** (the module-only rule of `TagGroup.context.ts`): they hold the context, its inert default and the hook, so the host and the part can both import it without a cycle.
- **Defaults are inert.** A part used outside its host gets the default context, never an error: an `Avatar` outside a tag is an ordinary avatar. Contexts that a part cannot work without throw in development instead (C-CONTEXT).
- **Memoize the value** (C-MEMO), and render an enumerated `data-*` attribute with the resolved value so the result is visible to selectors (`data-size`, `data-shape`).

`Table.CellLayout` provides `AvatarSizeContext` too: an Avatar in its `media` gets a 32px box unless it sets its own `size`.

### Pattern 18: Reveals on Named Groups

Controls drawn only while their row is hovered or holds focus (Tree row actions, Nav item actions, DataGrid's subtle selection, `Table.CellActions`) use a Tailwind group variant on the row (`group-hover/<name>:`, `group-focus-within/<name>:`), and every family names its own group: Tree's rows are `group/row`, Nav's `group/nav-row`, Table and DataGrid rows `group/table-row`, and a DataGrid with `subtleSelection` is `group/grid` for its select-all. A shared name would make a component nested in a cell react to the outer row (a Tree with actions inside a DataGrid cell would show its actions while the grid row is hovered), so a new reveal picks a name of its own. A grid nested in a grid still shares `group/table-row`, a limit of CSS groups.

- **Always drawn where hover is missing or colors are forced:** `pointer-coarse:` (DataGrid, Table) or `[@media(hover:none)]:` (Tree, Nav) and `forced-colors:` variants override the hidden state, and a `focus-within:` of the control's own keeps keyboard focus visible outside a group.
- **Keep the room.** Hide with opacity or visibility, never `display: none`, so the row does not shift when the controls show; with opacity they also stay focusable and named (DataGrid's subtle controls, `Table.CellActions`, Nav's actions), and a fade carries `motion-reduce:` (C-MOTION).
- **An opaque reveal over a row's fill** maps the library's row fills (`Table.CellActions`: the canvas, the row hover, a striped row, a DataGrid's selected rows) by selectors on the table's own attributes (`data-striped`, `data-selection-appearance`, `data-selected`); a consumer's own row background needs the same class on the revealed element.

### Props Interface Conventions

- Extend native HTML attributes: `React.HTMLAttributes<HTMLDivElement>`
- Omit conflicting native props: `Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'>`
- Name value callbacks after the state (`onValueChange`, `onCheckedChange`, `onOpenChange`); `onChange` is only the native change event
- Declare `ref` in the interface; export the props type with the component (`CardHeaderProps`, `DataGridRowProps`)
- Use shared types from `src/lib/types.ts`: `Size`, `CoreSize`, `InputAppearance`, `Appearance`, `Status`, `Orientation`, `SelectionMode`, `TextWeight`, `Shape`, `PopupSide`, `PopupAlign`, `BadgeColor`, `IconPosition`, `ValidationState`, `LabelPosition` (take a subset with `Extract<LabelPosition, …>`), `ModalType`, `OpenChangeDetails<R>`, `CheckedValues`, `CheckedValuesChangeHandler`, `PopupTarget`, `VirtualElement`, `DayOfWeek`, `FirstWeekOfYear`, `HeadingLevel`, `FocusMode`, `TagSize`, `TagAppearance`, `TagShape`, `SurfaceSize`, `BackdropAppearance`
- Prefer Fluent's prop name when it fits the conventions (`disabledFocusable`, `iconPosition`, `validationState`, `modalType`, `selectTabOnFocus`, `persistOnItemClick`, `openOnHover`, `openOnContext`, `isAccessible`); open state stays `open`/`defaultOpen`/`onOpenChange`, a state callback is named after its state (`checkedValues` → `onCheckedValuesChange`, not Fluent's `onCheckedValueChange`), and extra callback data goes in a second, optional `details` argument (`onOpenChange(open, details?)`, `onCheckedValuesChange(checkedValues, details?)`)
- One delay vocabulary: `openDelay` and `closeDelay` in milliseconds (Menu 250/250, Popover 250/500, Tooltip 200/100). Menu's and Popover's apply to mouse hover only, Tooltip's `openDelay` also to keyboard focus

---

## 9. Accessibility

### WCAG 2.2 AA Requirements

| Criterion | Requirement |
|-----------|-------------|
| **Color contrast** | 4.5:1 for normal text, 3:1 for large text (at least 24px (18pt), or 18.66px (14pt) bold) |
| **Non-text contrast** | 3:1 for UI component edges, states and graphical objects |
| **Target size** | At least 24×24 CSS px (2.5.8); 44×44px recommended for touch |
| **Keyboard access** | All functionality available via keyboard |
| **Focus visible** | Focus indicators must be clearly visible (and stay visible in forced colors) |
| **Label in name** | A control's accessible name contains its visible text label (2.5.3) |
| **Text resizing** | Content usable at 200% zoom and 320px width |
| **Motion** | Respect `prefers-reduced-motion`; auto-rotating content can be paused (2.2.2) |

### Keyboard Navigation Patterns

These describe what the components implement.

#### Roving tab index (Toolbar, TagGroup, RadioGroup, SwatchPicker, TabList, Menu, List, Tree, NavDrawer.Body, Breadcrumb)

Implemented with `useRovingTabIndex`:

```
Tab          → enters the group at its tab stop (the selected item, else the first; Toolbar and the
               static Menu: the last focused item)
Arrow keys   → move within the group (RadioGroup, SwatchPicker and TabList also select)
Home / End   → first / last enabled item
Tab          → leaves the group
```

Only one item holds `tabIndex={0}`. Disabled items are skipped (natively disabled or `aria-disabled`, except the focusable disabled ones below), and so are controls hidden with CSS (`display: none` or `visibility: hidden` inside the container, a closed `<details>`) and the `type="hidden"` input of a named value control. Left/Right are mirrored in RTL. Arrows that start in a text field, select, slider, spin button or editable combobox inside the group are left to that control (a SearchBox in a Toolbar keeps its caret keys). A Dropdown (select-only combobox) keeps Up/Down, Home and End for its list, but Left/Right move past it, so in a vertical Toolbar the arrows cannot leave it.

In a Toolbar, a nested composite (a RadioGroup, a TabList) keeps its own Tab stop and arrow keys (a `Toolbar.RadioGroup` does not: see [Toolbar radio groups](#toolbar-radio-groups)), and focusing it or a text field, select, slider or spin button keeps the toolbar's Tab stop on the last focused other control, so Tab and Shift+Tab can return to the toolbar; such a control holds the stop only when nothing else can. These rules live in `useRovingTabIndex` (the CSS-hidden check in its `manageTabIndex` mode, which Toolbar, TagGroup, Menu and an arrow-key NavDrawer body use); an `itemSelector` the browser rejects logs a development warning. When the container stops being one (its ref detaches, as when a TagGroup switches to `role="list"` or a NavDrawer body to `focusMode="tab"`) or `manageTabIndex` turns off, the hook hands every element it stamped back: its own `tabindex` (or the one its author rendered since) and no `data-roving-value` of the hook's, so each control is its own Tab stop again.

**Focusable disabled items.** A control with `disabledFocusable` (Button, CompoundButton, ToggleButton, MenuButton, a SplitButton half, Link, Checkbox, Switch) carries `aria-disabled="true"` and `data-disabled-focusable`, and `useRovingTabIndex` keeps such an item: the arrow keys, Home/End and typeahead reach it, and it may hold the Tab stop (APG allows focusable disabled items in toolbars). Enter, Space and clicks on it do nothing, and a Tooltip on it opens on focus to say why it is unavailable. Natively disabled items and a composite's own `data-roving-disabled` items are still skipped.

```tsx
<Toolbar aria-label="Formatting">
  <Button>Bold</Button>
  <Tooltip content="Copy something first">
    <Button disabledFocusable>Paste</Button>
  </Tooltip>
  <Button disabled>Cut</Button> {/* skipped */}
</Toolbar>
```

| Component | Arrow keys |
|---|---|
| Toolbar | Left/Right (Up/Down when `orientation="vertical"`), wrapping; in a `Toolbar.RadioGroup` also the cross axis, within the group |
| RadioGroup, SwatchPicker (row layout) | all four arrows, wrapping; moving selects |
| SwatchPicker (`layout="grid"`) | Left/Right in reading order across the rows, Up/Down to the nearest swatch of the previous/next row, Home/End in the row, Ctrl+Home/End in the grid; stops at the ends; moving only focuses (Space, Enter or a click selects) |
| TabList | Left/Right (Up/Down when vertical), wrapping; moving selects (automatic activation), or with `selectTabOnFocus={false}` only moves focus (manual activation: Enter or Space selects) |
| Menu | Up/Down, wrapping; typeahead; Right/Left open and close submenus (mirrored in RTL) |
| List (selectable, or `navigationMode="items"`) | Up/Down, wrapping; typeahead above 7 items; Enter/Space toggle selection, and Enter (Space where the item cannot be selected) runs `onAction`; without selection the Tab stop is the item that last had focus |
| Breadcrumb (`focusMode="arrow"`) | Left/Right, wrapping (mirrored in RTL), Home/End, over the links, buttons and the "…" button; the Tab stop is the last focused one |
| TagGroup (toolbar) | Toolbar's: Left/Right (Up/Down when vertical), wrapping, Home/End; both buttons of an InteractionTag join the order; Delete/Backspace dismiss; `role="list"`: no arrows, every control a Tab stop |
| NavDrawer.Body (`focusMode="arrow"`) | Down/Right next, Up/Left previous (Left and Right swap in RTL), wrapping, Home/End; the Tab stop starts at the current page; item actions join the order |
| Tree | see below |

**Manual tab activation.** By default TabList selects the tab that focus moves to (automatic activation, as APG recommends when a panel shows at once). For panels that are slow to show, `selectTabOnFocus={false}` switches to manual activation: the arrow keys, Home and End only move focus, Enter, Space or a click selects the focused tab, and the Tab stop stays on the selected tab, so Tab away and Shift+Tab back return to it. The shown panel follows the selected tab, not the focused one. (Fluent's default is `false`; Wave keeps `true`, the 0.5 behaviour.)

```tsx
<TabList aria-label="Reports" selectTabOnFocus={false}>
  <TabList.Tab value="sales">Sales</TabList.Tab>
  <TabList.Tab value="traffic">Traffic</TabList.Tab>
  <TabList.Panel value="sales">…</TabList.Panel>
  <TabList.Panel value="traffic">…</TabList.Panel>
</TabList>
```

Wherever there is typeahead (Menu, a selectable or navigable List, Tree, Dropdown), a Space typed within 500 ms of a character continues the search instead of activating or committing, so "new y" reaches "New York". Characters typed with AltGr, which Windows reports as Ctrl+Alt (Polish `ł`, Romanian `ș`), count; Ctrl+Alt with an arrow, Home, End or Space is left to the browser. An item that refuses focus (hidden by CSS) is passed over for the next match. Keys typed in content inside an item, such as a List row's action button, are not typeahead. Menu matches item labels only, never an icon's text or a shortcut.

#### Toolbar radio groups

```
Left / Right           → move through the toolbar's buttons, toggles and radios alike (Up / Down
                         when vertical; mirrored in RTL); never check
Up / Down (in a group) → next / previous enabled radio of the group, wrapping inside it (Left /
                         Right in a vertical toolbar); never check
Space / Enter / click  → check the focused radio (press a toggle)
Tab                    → leaves the toolbar; one Tab stop (the last focused control)
```

`Toolbar.RadioGroup` (`role="radiogroup"`, named with `aria-label`) follows the APG Toolbar example's text-alignment group: its `Toolbar.RadioButton`s (`role="radio"`, `aria-checked`) are items of the toolbar's own arrow order, not one nested composite with its own Tab stop, because the group carries `data-roving-transparent`, the `useRovingTabIndex` marker for a composite role that joins the enclosing arrow order. The cross-axis keys move among the group's radios only (natively disabled ones skipped, `disabledFocusable` ones reachable). Unlike a RadioGroup outside a toolbar, moving focus never selects: in a toolbar the arrow keys belong to navigation.

```tsx
<Toolbar aria-label="Formatting" defaultCheckedValues={{ format: ['bold'], align: ['left'] }}>
  <Toolbar.ToggleButton name="format" value="bold">Bold</Toolbar.ToggleButton>
  <Toolbar.Divider />
  <Toolbar.RadioGroup aria-label="Text alignment">
    <Toolbar.RadioButton name="align" value="left">Left</Toolbar.RadioButton>
    <Toolbar.RadioButton name="align" value="center">Center</Toolbar.RadioButton>
  </Toolbar.RadioGroup>
</Toolbar>
```

#### Combobox, TagPicker, TimePicker (editable combobox)

```
ArrowDown / ArrowUp → open the list / move the active option (aria-activedescendant)
Alt+ArrowDown       → open without moving
Typing              → filter; the first match becomes active (not in a freeform Combobox)
Enter               → commit the active option (with no active option, the form submits;
                      TimePicker instead never submits while its text is edited)
Alt+ArrowUp, Tab    → close
Escape              → close; on a closed list, discard the typed text
Home / End          → move the text caret
```

Focus stays on the input. Typing filters the options (Combobox in both modes; with `freeform` the typed text is the value). In Combobox and TagPicker, Enter with no active option submits the form, also after typing text that matches no option. TimePicker's Enter on edited text commits a complete time within the bounds, clears the value when the text was erased, and otherwise keeps the text, flags it (`aria-invalid` and an error message) and closes the list; leaving the input settles edited text the same way and closes the list too. TagPicker: Backspace in the empty input focuses the last tag, Backspace or Delete removes it.

The chevron button at the end of a Combobox or TimePicker (APG's "open" button) is not a Tab stop and keeps focus in the input; Alt+ArrowDown does the same from the keyboard. The clear button (`clearable` on Combobox, Dropdown, DatePicker and TimePicker) is a Tab stop after the input, or after the Dropdown's combobox button, and moves focus back to it after clearing. Tab from erased TimePicker or DatePicker text clears the value before focus moves, so focus goes on past the clear button that disappears with the value (to DatePicker's calendar button, or the tab stop after the TimePicker).

#### Dropdown (select-only combobox)

```
ArrowDown / ArrowUp / Home / End → open and move the active option
Printable characters             → typeahead (opens the list)
PageUp / PageDown                → move by 10 while open
Enter / Space                    → open, or commit the active option
Alt+ArrowUp, Tab                 → commit the active option and close
Escape                           → close
```

With `multiselect` (Dropdown, Combobox), Enter (and Dropdown's Space) toggles the active option and keeps the list open; Tab, Escape and Alt+ArrowUp close without committing. With `disabledOptionsFocusable` the keys reach disabled options, which commit nothing.

#### Listbox (a list that holds focus)

```
Tab                              → enters the list (one Tab stop); the active option is the
                                   selected one, else the first (aria-activedescendant)
ArrowDown / ArrowUp              → move, stopping at the ends
Home / End, PageUp / PageDown    → first / last, by 10
Printable characters             → typeahead
Enter / Space                    → select (toggle with multiselect)
Tab, Escape, Alt+arrows          → left to the page (an enclosing Dialog closes on Escape)
```

#### Tree

```
Tab                  → enters at the selected item, else the first
ArrowDown / ArrowUp  → next / previous visible item
ArrowRight           → expand, or move to the first child (mirrored in RTL); with
                       navigationMode="treegrid", into the item's actions instead when it has
                       one that can take focus (a collapsed parent still expands first; without
                       an action, an open parent moves to its first child)
ArrowLeft            → collapse, or move to the parent (mirrored in RTL); from the first action
                       (treegrid), back to the item
Home / End           → first / last visible item (on an action, the first / last action of
                       the row)
Enter                → activate (onItemSelect) and toggle a parent
Space                → activate; in a checkbox tree (selectionMode="multiple"), toggle the check
*                    → expand all siblings
Printable characters → jump to the next item starting with the text
Tab (on an item)     → into its actions (navigationMode="tree"); Shift+Tab back
```

Nested items are `Tree.Item` elements in their parent's children: directly, in Fragments or from a render function (`children.map(renderNode)`). A `Tree.Item` rendered by a recursive component is not part of its parent's group (a development warning names it). `value`s are unique (a duplicate warns). `leaf` renders an item as a leaf even when it has nested items; an item is expandable only while it has nested items, so for children loaded on first expansion give it a placeholder child ("Loading…") until they arrive.

**Checkbox trees.** With `selectionMode="multiple"`, Space toggles the focused item's check (a Space that continues a typeahead search stays typeahead) and Enter still activates it. Checks cascade: toggling an item sets it and all its descendants, and a parent is checked, mixed or unchecked from its descendants. A click on the row's checkbox toggles; a click elsewhere on the row activates.

**Row actions.** An item's `actions` render in a toolbar of the row. With `navigationMode="tree"`, the toolbar's buttons rove with `useRovingTabIndex` and hold one Tab stop while their item is the tree's active item, so Tab from the item enters them and Shift+Tab returns; with `navigationMode="treegrid"` they take no Tab stop, the "next" arrow enters them, "previous" from the first action returns, "next" and "previous" move between actions without wrapping, and Up and Down move to the previous or next item. Keys and clicks inside the actions are theirs: the item ignores them (no activation, check, expansion or typeahead), and an action that handles an arrow key itself (a MenuButton opening its menu on ArrowDown) keeps it.

Where they hide (devices with hover, outside forced colors), the actions show for hover, for focus on the item or inside its own row (`:focus-within`, never for focus in its child group), while an element inside them has `aria-expanded="true"`, and while the toolbar carries `data-focus-in-popup`. That attribute is set while focus is in a surface opened from an action (a Menu, Popover or Dialog rendered inside the actions, whose focus events reach the toolbar through the React tree) and kept for one animation frame after focus leaves it, so the surface's focus return, which runs after its trigger already reports it closed, finds the action shown. A Dialog rendered outside the actions and opened through state (a "Delete…" menu item that opens a confirm Dialog elsewhere) gets neither: when it closes the action is hidden and cannot take focus, so focus returns to the nearest element that can, normally the item. Render such a Dialog inside `actions` (its `Dialog.Trigger` there, or the controlled Dialog next to the Menu that opens it) to return focus to the action; `finalFocusRef` cannot name a hidden action.

#### Toaster

```
App shortcut (shortcuts.focus) → focus the newest toast (a named group)
Tab / Shift+Tab                → through the toasts' controls
Escape                         → dismiss every toast; focus returns to where it was
Delete / Backspace             → dismiss the focused toast; focus moves to the next one
```

The Toaster's region takes Escape only when the key is pressed inside the region in the DOM (a key pressed in a Menu, Popover or Dialog opened from a toast reaches the region through the React tree and is left alone) and when no open, Escape-enabled dismiss layer is anchored inside it (a Tooltip on a toast's button, a Menu opened from a toast closes first). It then prevents the default, so the dismiss-layer stack never routes that Escape to a Dialog or Drawer below the toasts, returns focus to the element focused before focus entered the toasts, and dismisses them. Delete and Backspace act on the focused toast container or a control inside it, except in an editable field. A dismissed toast moves focus in the dismissing commit: to the next toast that is not exiting (its container, when focus was on the container), else the previous one, else the remembered origin. The pointer or focus anywhere in the region pauses every toast's timer.

#### ColorArea (2-D slider)

```
Tab                    → one stop (the input used last; saturation at first)
ArrowLeft / ArrowRight → saturation −1 / +1 (mirrored in RTL)
ArrowDown / ArrowUp    → brightness −1 / +1
Shift + arrow          → by 10
PageDown / PageUp      → brightness −10 / +10
Home / End             → saturation 0 / 100
```

The area holds two visually hidden native range inputs, saturation and brightness; a key moves focus, and the Tab stop, to the axis the key moves (also at a boundary, where the value stays), so the channel that changed is announced; a change from assistive technology (a swipe) moves only the Tab stop, not focus. Unless the primary pointer is coarse (`(pointer: coarse)`: a touch device), the other input is `tabIndex=-1` and `aria-hidden`, so desktop screen readers meet one 2-D slider (the server renders this model too); on touch devices both stay exposed, so a touch screen reader can swipe each. A pointer press jumps and drags with pointer capture. `ColorSlider` and `AlphaSlider` are one native range input each, with the same keys on their axis.

#### DataGrid

```
Tab                    → enters the grid at its tab stop (one per grid)
Arrow keys             → move between cells (Left/Right mirrored in RTL; Up/Down keep the visual
                         column across colSpan/rowSpan cells of grouped headers)
Home / End             → first / last cell of the row
Ctrl+Home / Ctrl+End   → first cell of the grid / last cell of the last row
PageUp / PageDown      → 10 rows up / down
Enter / F2             → move into the cell's widgets (text inputs, several buttons)
Escape                 → back to the cell
Space (on a cell)      → toggle the row's selection (selectable grids)
```

A cell with a single non-text widget (a checkbox, a sort button, a link) focuses that widget directly. In `selectionMode="single"` pass at most one selected id (with several, the first one whose row is rendered is selected, with a development warning). Each row's selection control is named after the row's first `DataGrid.Cell`, `<td>` or `<th>` child (Fragments are looked into); for a cell rendered by another component, pass `selectionLabel`. A selectable `List` with item actions uses a similar grid model: Up/Down between rows, Left/Right into and out of the actions, Enter/F2 into a text field, Escape back.

#### Menu

```
Trigger:  Enter / Space / ArrowDown → open and focus the first item; ArrowUp → open and focus the last
Menu:     ArrowDown / ArrowUp        → next / previous item (wrapping); Home / End; typeahead (labels)
          Enter / Space              → activate the item (closes the menu unless persistOnClick or
                                       persistOnItemClick)
          Escape                     → close the innermost open menu; focus returns to its trigger
                                       (from a submenu trigger item: the submenu closes, focus stays)
          Tab                        → close every level; focus continues from the root trigger
Checkable item (checkbox, radio, switch):
          Space                      → change it; the menu stays open
          Enter / click              → change it and close a popup menu
Link item:
          Enter                      → the browser's link activation (Shift, Ctrl, Cmd: new window or tab)
          Space                      → follow the link
Submenu trigger item:
          ArrowRight / Enter / Space → open the submenu and focus its first item (ArrowLeft in RTL)
In a submenu:
          ArrowLeft                  → close it; focus returns to its item (ArrowRight in RTL)
Split row (Menu.SplitGroup):
          ArrowRight                 → from the action to the submenu button; on it, open the submenu
          ArrowLeft                  → back to the action (both mirrored in RTL)
Context-menu region (openOnContext):
          Shift+F10 / ContextMenu    → open at the focused element; focus returns there on close
```

**Checkable items** follow the APG menu pattern: Space changes a `menuitemcheckbox` or `menuitemradio` without closing the menu, so several options can be set in a row; Enter and a click change it and close a popup menu (Fluent closes on Space too unless the item persists). A radio item is checked while its value is in the group's `checkedValues`, and checking it makes its value the group's only value; activating one whose value already is the only value changes nothing and still closes. The item's `aria-checked` carries the state; the check glyph and the switch drawing are decorative. Put each radio `name` in its own `Menu.Group` (or separate the sets with `Menu.Divider`): assistive technology counts a radio set by its group or separators, not by `name`.

**Submenus.** A submenu trigger item is a `menuitem` with `aria-haspopup="menu"`, `aria-expanded` and, while open, `aria-controls`; the submenu is a `role="menu"` labelled by its item. ArrowDown, ArrowUp, Home, End and typeahead on the trigger item stay the parent list's. Escape and "previous" close one level at a time and return focus to the item; item activation and Tab close the whole chain, and focus goes to the root trigger before the menus close (under a static menu, to the submenu's trigger item), so a Dialog opened from a submenu item returns focus there. A disabled trigger item never opens its submenu. In a split row both halves are items of the parent list's vertical order, so the arrows reach every item with the keys screen-reader users expect; typeahead skips the label-less submenu half.

**Hover and focus.** A menu opened by hover takes no focus (hover must not steal keyboard focus), and a close by hover moves none, also for a submenu closing with it (`useRestoreFocus`'s `isHoverClose`); its trigger's opening keys (and a click) pin it and move focus in. While focus is inside a list of a menu tree (the menu's own list or an open submenu's; not a Popover, Dialog or other portal opened from an item, which keeps focus), the mouse moving over an item focuses it, as in native menus, so Enter, the arrows and Escape act on the list the user points at; a submenu that loses focus that way closes after `closeDelay`, unless the pointer returns, while a keyboard move to another item closes it at once. A submenu flips to the other side of its item when it does not fit, and with room on neither side it overlaps its parent menu, inside the viewport. A surface closed by Escape or an outside press stays closed until the pointer has left its trigger (WCAG 1.4.13).

**Context menus.** A context-menu region is not a menu button: it carries no `aria-haspopup` or `aria-expanded`, and a click does nothing. Shift+F10 and the ContextMenu key open the menu at the focused element (a row), a right click at the pointer; the menu takes focus on its first item, and Escape and item activation return focus to the element that had it; Tab closes the menu, and tabbing continues from that element. A second gesture on another row moves the open menu there without closing it. Name the menu with `aria-label` and announce the gesture with `aria-keyshortcuts="Shift+F10"` on the region. Text fields inside the region keep the browser's own context menu, for paste and spelling suggestions.

A trigger with `aria-disabled="true"` (a `disabledFocusable` MenuButton or SplitButton menu half, also inside the trigger's wrapper span) stays focusable, but its click, Enter, Space, ArrowDown and ArrowUp never open the menu. A menu taller than the space next to its trigger scrolls inside the viewport, and the focused item is scrolled into view.

#### Dialog and Drawer

Modal and alert (`modalType="modal"`, the default, and `"alert"`):

```
Tab / Shift+Tab → cycle through the dialog's focusable elements (trapped; toasts included;
                  a drawer's header, then its body, then its footer)
Escape          → close (only the topmost layer: an open listbox inside closes first, and a
                  SpinButton with typed text or a SearchBox with text consumes it)
```

Focus moves into the dialog on open (the first focusable element, unless something inside already has focus, such as an `autoFocus` input; that also holds for a dialog opened over another one or nested in its content, and for a `Popover.Content` opened from a dialog). Tab inside a plain `<Portal>` rendered in the dialog moves natively between the portal's elements and wraps to the dialog's first or last element at the portal's edges. On close it goes to `finalFocusRef` when given, else back to the element that had focus when the dialog opened (a trigger's wrapper span resolves to the element inside it): the trigger for a trigger click, the parent's own button of a controlled Dialog, or a text field focused before a keyboard-shortcut open. When nothing had focus (opened from code, or a Safari click), it goes to the trigger that opened the dialog, else the first mounted trigger; when that element is gone, to a mounted trigger, then to an element next to where the opener was (the next row's action after a delete), then to the overlay below.

The trigger toggles every type: a click on it while the surface is open closes it.

Non-modal (`modalType="non-modal"`):

```
Tab / Shift+Tab → leave the surface in the page's order: it sits right after the element that
                  opened it (no trap)
Escape          → close, only while focus is inside the surface
```

Focus moves in on open; presses on the page never close it; focus returns to `finalFocusRef`, else the opener, only when it was inside the surface at close.

Inline drawer (`type="inline"`):

```
Tab / Shift+Tab → page order (the panel is page content, after its direct triggers)
Escape          → nothing (it is left to the page)
```

Opening moves no focus; closing it while focus is inside returns focus to `finalFocusRef`, else the element that opened it, else the trigger. NavDrawer follows the same rules for its type; its body's `focusMode="arrow"` makes the list one Tab stop with both arrow pairs, wrapping, and Home and End.

#### Calendar and the DatePicker calendar

```
Alt+ArrowDown (DatePicker input)  → open the calendar
Arrow keys                        → previous / next day, previous / next week (mirrored in RTL)
PageUp / PageDown                 → previous / next month (day clamped to the month)
Shift+PageUp / Shift+PageDown     → previous / next year
Home / End                        → start / end of the week
Enter / Space                     → select the day
Escape                            → DatePicker: close and return focus; Calendar: left to the page
```

The heading is a button (`showMonthPicker`, on by default) to the month view, and the month view's heading to the year view. Month view: the arrows move by a month and a row of four, Home/End to the row's ends, PageUp/PageDown by a year, Enter/Space show the month's days. Year view: the arrows, Home and End stay on the shown page of 12 years while the target year is on it, PageUp/PageDown move a decade, Enter/Space show the year's months. Escape in the month or year view goes back one view and is consumed, also from the header and footer buttons; only the day view's Escape reaches a DatePicker, which closes.

Typed text in the DatePicker input is kept and marked invalid when it is not an available date. When a controlled parent then selects another day, the rejected text is replaced by that date and the error cleared; switching the picker to `readOnly` or `disabled` while the user types drops the typed text.

#### Other components

- **SpinButton**: ArrowUp/ArrowDown step, PageUp/PageDown large step, Home/End min/max (with Shift they select text, as in any text field); Enter commits typed text, Escape reverts it. Holding a step button with the pointer repeats the step (see [SpinButton, Rating and InfoButton](#spinbutton-rating-and-infobutton)).
- **SearchBox**: Escape clears the text and keeps focus; the key is consumed, so an enclosing Dialog, Drawer or Popover stays open. In an empty field Escape reaches them.
- **Rating**: Right/Up one `step` more (a star, or a half star with `step={0.5}`), Left/Down one fewer (never below `step`), Home/End the smallest value and `max`; mirrored in RTL.
- **Card** (selectable, `selectionControl="card"`): Enter (key down) or Space (key up).
- **Stepper**: every reachable step is a Tab stop; Enter/Space activate.
- **Tooltip, InfoLabel, InfoButton**: open on keyboard focus (Tooltip after `openDelay`, 200ms by default; it hides `closeDelay` after the pointer leaves, and at once on blur); Escape closes. Focus, blur and pointer entry inside a popup that the Tooltip's child renders in a portal (a DatePicker calendar, a listbox) do not show or hide the tooltip or reach its `onFocus`/`onBlur`; `onMouseEnter`/`onMouseLeave` follow React's tree. An icon-only trigger named by `Tooltip relationship="label"` also names a Popover it opens.
- **Popover, TeachingPopover**: Escape closes. When focus was inside (or lost to `<body>`), Popover returns it to its trigger, TeachingPopover to where focus was before it opened (with `target`, to the target when nothing had focus, such as a tour opened on page load; with a `TeachingPopover.Trigger`, to the Trigger; see [Focus Management](#focus-management)). A close by hover moves no focus. In the Tab order the portaled content follows its trigger (TeachingPopover with `target`: the target), like inline content: Tab from the trigger enters it, Tab past its last element continues after the trigger, Shift+Tab from its first element returns to the trigger (or, when nothing in the trigger can take focus, to the tab stop before it), and Shift+Tab from the element after the trigger enters it at its last element. For a trigger outside the tab order the content follows the tab stop before the trigger; with no tab stop before the trigger or target, it is reached where it is portaled, at the end of the page, in both directions. A Tab lap visits the content once: Tab from the last element of the page moves past the portaled content (it is hidden for that one Tab) and leaves the page, and Shift+Tab from the browser's own controls reaches the page's last element (outside every open popover) instead of the content. Content that the Tab from the page end still reaches follows the document order, so Tab never cycles. Focus leaving it does not close it (Escape or an outside press does). A hover card (`openOnHover`) opens without taking focus and is still entered by Tab from its trigger. A context popover (`openOnContext`) opened by Shift+F10 or the ContextMenu key moves focus into the content (its first tabbable element, else the surface), and Escape returns focus to the element that had it; one opened by a right click leaves focus where it is, and Tab from that element enters the content.
- **Accordion, Carousel, Nav, Breadcrumb, Pagination**: native buttons and links (Tab, Enter, Space); no arrow-key navigation between the controls, except a Breadcrumb with `focusMode="arrow"` (one Tab stop, see the table above). A Carousel with `groupSize` above 1 makes the slides of the shown page one arrow-key group: the slide that last had focus is its Tab stop, and an arrow past the end of the page shows the next one.

### ARIA Patterns

#### Combobox (Combobox, TagPicker, TimePicker)

```html
<input role="combobox"
  aria-expanded="true"
  aria-controls="listbox-id"
  aria-haspopup="listbox"
  aria-autocomplete="list"
  aria-activedescendant="listbox-id-opt-2" />
<ul id="listbox-id" role="listbox">
  <li id="listbox-id-opt-1" role="option" aria-selected="true">Selected item</li>
  <li id="listbox-id-opt-2" role="option" aria-selected="false">Active item</li>
</ul>
```

Option ids stay stable while the list is filtered. `aria-activedescendant` is set only while the list is open and an option is active. `hidden` on an `Option` or `OptionGroup` works like a native `<option hidden>`: those options get no keyboard access, and a selected hidden option (a placeholder) still shows its label; for options that should not exist at all, render them conditionally or let the Combobox filter hide them. Combobox and TagPicker announce "No matches" through a visually hidden `role="status"` element that is always mounted; the "No matches" row in the popup is an `aria-hidden` visual copy. `Dropdown` uses the select-only combobox pattern: a `<button role="combobox" aria-haspopup="listbox">` with the same `aria-expanded`, `aria-controls` and `aria-activedescendant`. `OptionGroup` renders `<li role="presentation">` with a labelled `<ul role="group">` of options. `TagPicker` renders its tags as a `role="list"` named "Selected", describes the input with a hidden summary ("Selected: Apple, Banana") and announces additions and removals through a live region.

#### Dialog

```html
<div role="dialog" aria-labelledby="title-id">
  <h2 id="title-id">Dialog title</h2>
  <!-- content -->
</div>
```

With `modalType="alert"`, `Dialog.Content` is `role="alertdialog"` instead, for a confirmation that needs an answer (a backdrop press does not close it). Dialog and Drawer do **not** set `aria-modal`. While they are open, everything else on the page is made `inert` except the Toaster region and the announcement live regions, so the background is neither focusable, clickable nor readable while toasts stay available. The DatePicker calendar is a transient dialog that keeps `aria-modal="true"`. Name a dialog with `title`, `Dialog.Title`/`Drawer.Title` (or a `Drawer.HeaderTitle`), `aria-label` or `aria-labelledby` (unnamed dialogs warn in development). The backdrop is the surface's sibling and `aria-hidden`.

A **non-modal** surface (`modalType="non-modal"`) is a `role="dialog"` without isolation and without `aria-modal`: nothing is `inert`, and the page keeps its Tab order, with the surface placed right after its opener. It covers the page under it while Tab still reaches that page, so keep the page's controls clear of it: beside a centred dialog, or in the room a non-modal drawer's width (height at the bottom) leaves while it is open; `size="full"` warns.

An **inline** drawer is no dialog:

```html
<aside aria-labelledby="title-id">
  <h2 id="title-id">Details</h2>
  <!-- content -->
</aside>
```

It is a complementary landmark in the page, named by its title, after its direct triggers; its trigger has `aria-expanded` and `aria-controls` and no `aria-haspopup`. An overlay NavDrawer is a dialog named like the `<nav>` inside it; an inline one is the `<nav>` in a panel.

#### Navigation

```html
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home" aria-current="page">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

Every child of a Nav list is a list item: `Nav.SectionHeader` is a heading (`<h3>` by default) inside a list item, and `Nav.Divider` is an `<li aria-hidden="true">`, decorative, since the headers carry the structure. An item's `actions` render beside its link, never inside it, in a group named by the item, so the link's name stays the page's name. A NavDrawer body with `focusMode="arrow"` is one Tab stop; screen readers do not announce arrow keys in a navigation landmark, which is why every item is a Tab stop by default.

A collapsed `Nav.Category` that contains the current page marks its toggle button with `aria-current="true"` (not `"page"`: the button is not the page's link) and the selected look. A category whose children hold the current item takes it over from the category Nav remembered, so an item moved into another category marks only that one.

> Do not use `role="menubar"` / `role="menuitem"` for site navigation. Those roles are for application menus; site navigation needs only the `<nav>` landmark with plain links (`Nav`, `Breadcrumb`).

#### Tree

```html
<div role="tree" aria-label="Files" aria-multiselectable="true" data-selection-mode="multiple">
  <div role="treeitem" aria-expanded="true" aria-checked="mixed" aria-labelledby="label-docs">
    <div>
      <span role="checkbox" aria-checked="mixed" tabindex="-1" aria-labelledby="label-docs"></span>
      <span id="label-docs">Documents</span>
      <span role="toolbar" aria-labelledby="label-docs" aria-orientation="horizontal">…</span>
    </div>
    <div role="group">
      <div role="treeitem" aria-checked="true" aria-labelledby="label-cv">…</div>
    </div>
  </div>
</div>
```

Each treeitem contains its label row and its child group, and is named by its label (not by its icon or nested items). In a checkbox tree (`selectionMode="multiple"`) every item carries `aria-checked` (`mixed` for a partly checked parent) and never `aria-selected` (APG: one or the other); the row's checkbox is an exposed `role="checkbox"` with the same state, outside the Tab order and labelled by the item, so touch screen readers and voice control can change a check (a decorative indicator would leave them only the item's activation, WCAG 4.1.2). In a single-selection tree every item carries `aria-selected` and the radio is decorative. A row's actions are a `role="toolbar"` named by the item's label, an `aside` joins the item's `aria-describedby`, and a `Tree.ItemPersonaLayout` names the item by the person's name and describes it by the description. `navigationMode="treegrid"` changes the keyboard only: the roles stay `tree` and `treeitem`, because a real treegrid needs one flat list of rows with `aria-level`.

#### Color area and sliders

```html
<div role="group" aria-labelledby="field-label">
  <div aria-hidden="true"><!-- the gradient field --></div>
  <input type="range" min="0" max="100" value="72" aria-label="Saturation"
         aria-roledescription="2D slider" aria-valuetext="Saturation 72%, Brightness 74%, dark blue" />
  <input type="range" min="0" max="100" value="74" aria-label="Brightness"
         aria-roledescription="2D slider" aria-orientation="vertical"
         aria-valuetext="Brightness 74%, Saturation 72%, dark blue" tabindex="-1" aria-hidden="true" />
</div>
```

Each value text starts with its own channel, so the value that changed is heard first, and ends with the color's name (a built-in English namer that `labels.colorName` replaces). A group supports neither `aria-invalid` nor `aria-errormessage`, so both inputs get them. A `ColorSlider` says "210°, blue" (hue) or "72%", an `AlphaSlider` "40%"; a vertical slider is a horizontal input turned a quarter turn, with `aria-orientation="vertical"`.

#### Live Regions (Toasts, Status)

```html
<!-- Polite: read when the user is idle -->
<div role="status">3 items selected</div>

<!-- Assertive: read immediately (errors) -->
<div aria-live="assertive">Error: failed to save</div>
```

Live regions must exist before their content changes. `Toaster` keeps two permanent, visually hidden regions (polite, and assertive for `error` toasts) and adds each toast to one of them once, as text: the severity, the title, the body with its subtitle and the labels of its actions (never the Dismiss button). The toast itself is a `role="group"` container named by its severity and title, described by its body and focusable by the shortcut (`tabIndex="-1"`, no Tab stop), not a live region; a `Toast` rendered outside a Toaster is its own live region, with no name. A MessageBar with its default role (`alert` for warnings and errors, `status` otherwise) is a live region that its title does not name, because a named live region can have its name read with its content, which would read the title twice: the title is read as the first words of the content. With a non-live `role="region"` or `"group"`, the title names the bar through `aria-labelledby` (the severity text, then the title). Use `announce(message, politeness?)` or `useAnnounce()` for your own announcements; they go through a shared region that modal isolation never makes inert.

#### SpinButton, Rating and InfoButton

- **SpinButton, press-and-hold.** A step never happens on the press alone (WCAG 2.5.2, Pointer Cancellation). A press on a step button, with a mouse, finger or pen, starts a 300 ms timer. Released earlier, it steps once, on its `click`; still pressed when the timer fires, it steps and then repeats, slowly at first and every 80 ms after about a second. Release, cancel, leaving the button, reaching the bound, the window losing focus, and the control becoming disabled or read-only all stop it, and the `click` that ends a hold adds no step. A `click` without a press (a screen reader activating the button) steps once. The buttons never take focus, and they suppress the long-press menu, text selection and double-tap zoom. Keyboard repeat is the operating system's.
- **SpinButton, the empty value.** With `allowEmpty`, clearing the text and committing it sets the value to `null`; the empty input shows `''` (or `displayValue`), carries no `aria-valuenow`, and a required one blocks form submission through its hidden input. `allowEmpty` takes the literal `true` (a `boolean` variable fits neither props type). `displayValue` is the text shown and spoken (`aria-valuetext`) while the input is not being edited; while it has focus, the input shows the plain number, so typing edits `1`, not `$1.00`.
- **Rating, half stars.** With `step={0.5}` each star is one 24x24px pointer target that holds two visually hidden radios (the half value, then the full one), named by `labels.star` ("2.5 stars", "3 stars"). The radios lie over the halves they stand for, so touch exploration finds them, but only the star takes pointer events: a click chooses the half or the whole by where it lands (mirrored in RTL), and the chosen radio takes focus. A click on a radio itself (Space, Enter, a screen reader) chooses that radio's value. Two 12px targets would fail WCAG 2.5.8, which is why the star, not the half, is the target. Filled and unfilled stars differ by shape (`iconFilled` and `iconOutline` are a pair), not by color alone.
- **InfoButton, the note.** Opening the note never moves focus; it stays on the button. Tab from the open button enters the note's first tabbable element, so a link in it is reachable; Tab past its last element continues after the button; Shift+Tab from its first element returns to the button; Escape closes the note and returns focus to the button. Keyboard focus opens the note unless `openOnHover={false}`, and pointer movement does not close a note that keyboard focus opened or holds (WCAG 1.4.13). The button has `aria-expanded` and, while the note is open, `aria-controls`; it has no `aria-haspopup`, since a note is none of the kinds that attribute names. The description exists once: the `info` content is a hidden description of the button while the note is closed, and sits inside the note, in an unnamed element that then describes the button, while it is open (the note itself is never in `aria-describedby`). The note is named like the button ("Password Information" inside an InfoLabel), which is why `aria-describedby` never points at it.

### Focus Management

1. **Focus rings**: focusable controls use `focusRing` (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`), cells and rows `focusRingInset`; text inputs show a primary bottom border (`inputFocus`) with `focus:outline-hidden`, which keeps an outline in forced-colors mode. Never use `focus:outline-none`. A focusable control with the disabled look (`disabledFocusable`, a self-disabling boundary button) goes back to full opacity while its ring shows, so the ring keeps its contrast.
2. **Moving focus into overlays**: Dialog and Drawer focus their first focusable element (or keep an `autoFocus` element, also when stacked over or nested in another dialog, and in a popover opened from one), Menu focuses its first item, the DatePicker calendar its focused day. Build custom overlays on these components, or on the public hooks of Pattern 16, rather than re-implementing traps.
3. **Focus restoration**: when an overlay closes, focus returns to where it came from. Dialog and Drawer use `finalFocusRef` when given, else the element that was focused when they opened (the trigger, for a trigger click; a trigger's wrapper span resolves to the element inside it), or a trigger when nothing had focus. When that element is gone, focus goes to a mounted trigger, then to the element next to where the opener was (the next row's action after a delete), then to the overlay below. A non-modal Dialog or Drawer, and an inline Drawer, move focus on close only when focus was inside them (`useRestoreFocus` with `requireFocusInside`; focus in a popup opened from them counts as inside). Popovers and menus return focus to their trigger (TeachingPopover: to where focus was, or to its `TeachingPopover.Trigger`) when focus was inside them (or lost to `<body>`) at close. A close by hover moves no focus, and neither does the close of a surface opened from inside one that closes by hover (a submenu, a hover card in a hover card). When a focused element disappears (a SearchBox clear button, a dismissed toast, a boundary button), the component moves focus somewhere sensible instead of dropping it to `<body>`; TimePicker and DatePicker settle erased text on Tab before focus moves, so Tab never lands on the clear button that the commit removes.
4. **Focus trapping**: modal and alert Dialogs and Drawers trap Tab (non-modal and inline ones do not), including the Toaster region and overlays opened from them. Tab inside a plain `<Portal>` rendered in a dialog is native and wraps to the dialog's first or last element at the portal's edges. Focus that lands outside the trap is returned in a microtask after the `focusin`.
5. **Skip links**: for content-heavy pages, provide a "Skip to main content" link.

### Forced Colors (Windows High Contrast)

Background colors are replaced and box shadows removed in forced-colors mode, so state that is shown only by a background fades away. Wave's components add Tailwind `forced-colors:` variants with system colors:

- `src/lib/styles.ts` `forcedColors` recipes: `selectedLeaf` (`Highlight`/`HighlightText` with `forced-color-adjust: none`, for leaf indicators only: the Switch thumb, check glyphs, the ProgressBar fill, the selected day), `selectedContainer` (a `Highlight` outline for selected options, rows and cards), `control` (`ButtonText` borders), `border` (`CanvasText`), `fill` (a `Highlight` background with `forced-color-adjust: none`, for leaf indicators drawn with their own background: step and pager dots, connectors), `rangeInput` (a native range input: rail `CanvasText`, thumb `Highlight`, `GrayText` while disabled, a `Highlight` focus outline), `ringArc` (a border-drawn ring: the arc `Highlight` on a `Canvas` track) and `disabled` (`GrayText`).
- Components with forced-colors styling include Switch, Checkbox, RadioGroup, SwatchPicker, Slider, ProgressBar, Spinner, Skeleton (`GrayText` placeholders), DatePicker, TimePicker, Select, listbox options, List, Tree, Card, DataGrid, Pagination, Stepper (completed connectors `Highlight`, the others `CanvasText`), Carousel, TeachingPopover (step dots), PresenceBadge, ColorArea, ColorSlider and AlphaSlider (the field, the rails and the thumbs' fill keep their colors with `forced-color-adjust: none`; the thumbs draw their ring and focus indicator in `CanvasText`, `Canvas` and `Highlight`), the Tree checkbox and radio indicators (Checkbox's recipe) and the Button family (every Button appearance draws a 1px border, so it keeps an edge). Dialog and Drawer draw a 1px border, so their edge stays visible where the shadow disappears.
- Text inputs use `focus:outline-hidden`, which Tailwind turns into a visible outline in forced colors.

**System color keywords**: `Canvas`, `CanvasText`, `LinkText`, `Highlight`, `HighlightText`, `ButtonFace`, `ButtonText`, `GrayText`.

The **high-contrast theme** (`WaveProvider theme="high-contrast"`) is a separate, Wave-drawn theme (not forced colors): background `#000000`, foreground `#ffffff`, primary `#1aebff` (cyan, with black text), focus ring `#ffff00`, error `#ff6e6e`, selected surfaces `#003a40` with white text.

### Screen Reader Best Practices

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<table>`) over `div` + `role`
- Every image needs `alt` text (`alt=""` for decorative images); `Image` warns in development without `alt`, and `StrictImageProps` requires it at compile time
- Form controls need a label: wrap them in `Field`, or pass `aria-label`/`aria-labelledby`
- Group related controls with `<fieldset>` + `<legend>` (or `role="group"` + `aria-label`)
- Validation errors: `Field`'s `error`, or `error="…"` on Input/Select/Textarea, render a `role="alert"` message linked with `aria-describedby`; a Field `validationState="warning"` message is announced too, without marking the control invalid
- Hide decorative elements with `aria-hidden="true"` (Wave's icon slots do it for you)
- Name progress indicators and landmarks: `ProgressBar` `label`, `Spinner` `label` (default "Loading"), `Toolbar` and `Nav` `aria-label`
- Translate the names and hidden texts components render themselves: `closeLabel` (Dialog.Content, Drawer, TeachingPopover), `statusLabel` (MessageBar, Toast), `dismissLabel` (Toast, `dispatchToast` options, Tag, `InteractionTag.Secondary`), the `aria-label` defaults of Hamburger and NavDrawer ("Navigation"), Carousel `labels` and `autoPlayLabels`, Stepper `statusLabels`, Pagination `getItemAriaLabel`, and the `labels` objects of AlphaSlider, Calendar, ColorArea, ColorPicker, ColorSlider, Combobox, DataGrid, DatePicker, Dropdown, Listbox, Rating, RatingDisplay, SpinButton, SwatchPicker, TagPicker, TeachingPopover and TimePicker (the README's "Built-in text" lists every one)

---

## 10. Theming

### Theme Structure

The `WaveProvider` component wraps your app and provides theme context:

```tsx
import { WaveProvider } from '@mortenbrudvik/waveui';

export const Root = ({ children }: { children: React.ReactNode }) => (
  <WaveProvider theme="light" dir="ltr">
    {children}
  </WaveProvider>
);
```

- It renders `<div class="wave-root wave-<theme>">` that paints `bg-background text-foreground font-wave text-body-1` (a `className` you pass wins) and sets `dir` and `data-wave-theme`.
- Providers nest in any order; every theme class re-declares all tokens, so a light panel inside a dark app is fully light. A nested provider inherits every prop it omits (`theme`, `dir`, `portalContainer`) from the enclosing one, so a theme-only panel in an RTL app stays RTL and keeps its overlays in the app's container; `portalContainer={null}` sends a nested subtree's overlays to `document.body`.
- Portaled overlays receive the provider's theme classes and direction; `portalContainer` sets where they render.
- `inputDefaults` (`{ size?: CoreSize; appearance?: InputAppearance }`) sets the default size and appearance of the text controls and pickers below it. A nested provider merges its defined keys over the enclosing provider's and inherits the rest.
- `useWaveTheme()` returns `{ theme, dir, themeClassName, portalContainer, inputDefaults, hasProvider }` (`inputDefaults` is `{}` outside a provider).
- With the precompiled `@mortenbrudvik/waveui/styles`, the provider is **required**: the base styles and the native-element reset apply only inside `.wave-root` and `.wave-portal`.

Theme classes select the tokens:

- `:root` and `.wave-light` → light
- `.wave-dark` → dark (the deprecated `.dark` still works)
- `.wave-high-contrast` → high contrast (the deprecated `.high-contrast` still works)

`getThemeClassName(theme)` returns the classes WaveProvider uses (`'wave-dark dark'` for dark). `color-scheme` is set on the `wave-*` theme classes only.

### Theme Tokens (tokens.css)

```css
:root {
  /* Theme-independent: ramps (0.4 names as fallbacks), font, stacking */
  --wave-brand-80: var(--brand-80, #0f6cbd);
  --wave-grey-14: var(--grey-14, #242424);
  --wave-font-family: 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont,
    Roboto, 'Helvetica Neue', sans-serif;
  --wave-z-overlay: 1000;
}

:root,
.wave-light {
  --wave-background: #ffffff;
  --wave-foreground: #242424;
  --wave-primary: var(--wave-brand-80);
  --wave-primary-hover: var(--wave-brand-70);
  --wave-border: #e0e0e0;
  /* … every semantic token (see the table in section 4) */
}

.wave-dark,
.dark {
  --wave-background: #292929;
  --wave-primary: var(--wave-brand-110);
  --wave-primary-foreground: #000000;
  /* … */
}
```

### Tailwind ↔ Token Mapping

`@theme inline` in `src/styles/tokens.css` maps the tokens to Tailwind theme values:

```
bg-background     → --color-background: var(--wave-background)
text-foreground   → --color-foreground: var(--wave-foreground)
bg-primary        → --color-primary: var(--wave-primary)
border-border     → --color-border: var(--wave-border)
bg-brand-80       → --color-brand-80: var(--wave-brand-80)
font-wave         → --font-wave: var(--wave-font-family)
text-body-1       → 14px / 20px
shadow-4          → dual-layer shadow
animate-wave-spin → wave-spin 0.8s linear infinite
```

Override the `--wave-*` variables, never the `--color-*` ones: the utilities are compiled against `var(--wave-*)`.

### Overriding Tokens

```css
/* One token, light theme */
:root,
.wave-light {
  --wave-muted-foreground: #5c5c5c;
}

/* One token, dark theme */
.wave-dark {
  --wave-primary: #7fb8f7;
}
```

With the precompiled stylesheet, load your overrides after Wave's (same specificity). With the Tailwind entry, Wave's tokens sit in the `theme` layer, so any unlayered override wins.

### Creating Custom Brand Colors

The light and dark primary, hover, pressed, focus-ring and selected colors are built from the brand ramp, so a 16-stop ramp re-brands both themes:

1. Start with your primary color (e.g. `#6b2fb3`) as stop 80.
2. Generate darker stops (10–70) by reducing lightness and lighter stops (90–160) by increasing it.
3. Override `--wave-brand-10` … `--wave-brand-160` on `:root` (the 0.4 names `--brand-10` … `--brand-160` still work, they are read as fallbacks).
4. Check contrast: stop 80 against white (light primary text), stop 110 against black (dark primary text), stops 60 and 110 against stops 160 and 20 (selected text on selected surfaces).

```css
:root {
  --wave-brand-20: #1e0a38;
  --wave-brand-40: #3b1a6b;
  --wave-brand-60: #53258f;
  --wave-brand-70: #5f2aa3;
  --wave-brand-80: #6b2fb3;
  --wave-brand-90: #8450c4;
  --wave-brand-100: #9c70d4;
  --wave-brand-110: #b18cf2;
  --wave-brand-120: #c2a5f5;
  --wave-brand-160: #f3edfb;
}
```

Which stops each theme reads: light — 80 (primary, ring), 70 (hover), 40 (pressed), 160 (selected surface), 60 (selected text); dark — 110 (primary, selected text), 120 (hover), 90 (pressed), 100 (ring), 20 (selected surface). The high-contrast theme and the `info` status color do not follow the ramp.

### 0.4 Variable Names

- Overrides of the 0.4 ramp names (`--brand-*`, `--grey-*`) keep working: they are read as fallbacks. Reads do not: 0.5 never defines the 0.4 ramp names, so custom CSS such as `var(--brand-80)` or `var(--grey-14)` resolves to nothing. Use `var(--wave-brand-80)`, `var(--wave-grey-14)`.
- The 0.4 semantic names (`--primary`, `--background`, `--border`, `--ring`, …) are neither read nor defined. Rename overrides **and reads** (`outline: 2px solid var(--ring)` becomes `var(--wave-ring)`) to `--wave-*`, or load the deprecated `@mortenbrudvik/waveui/legacy-tokens.css` after the Wave styles, which defines the 0.4 names again. Never load it in an app that defines shadcn/ui-style variables.

### Border Radius Scale

Wave uses Tailwind's default radius scale (it no longer overrides it):

| Tailwind | Value | Used by |
|----------|-------|---------|
| `rounded-none` | 0 | — |
| `rounded-xs` | 2px | Checkbox |
| `rounded-sm` / `rounded` | 4px | **Default**: buttons, inputs, selects, tree rows |
| `rounded-md` | 6px | Card, Menu, Popover, TeachingPopover, Table, DataGrid |
| `rounded-lg` | 8px | Dialog |
| `rounded-xl` | 12px | Large panels |
| `rounded-2xl` | 16px | Extra-large surfaces |
| `rounded-full` | 9999px | Avatars, badges, tags, Switch |

---

## 11. Common UI Patterns

### Form Layout

```tsx
import * as React from 'react';
import { Button, Dropdown, Field, Input, Stack } from '@mortenbrudvik/waveui';

export function ProfileForm() {
  const [name, setName] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const error = submitted && name.trim() === '' ? 'Enter your name' : undefined;

  return (
    // noValidate: this form shows its own errors. Without it, the browser's constraint
    // validation (Field `required` sets the native attribute) blocks an empty submit first.
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <Stack gap="lg">
        <Field label="Name" required error={error}>
          <Input placeholder="Enter name" value={name} onValueChange={setName} />
        </Field>
        <Field label="Email" hint="We never share it">
          <Input type="email" name="email" />
        </Field>
        <Field label="Role">
          <Dropdown name="role" placeholder="Select role">
            <Dropdown.Option value="admin">Admin</Dropdown.Option>
            <Dropdown.Option value="user">User</Dropdown.Option>
          </Dropdown>
        </Field>
        <Button appearance="primary" type="submit">
          Save
        </Button>
      </Stack>
    </form>
  );
}
```

**Guidelines**:

- Stack fields vertically with `gap="lg"` (16px)
- Labels above controls (not inline, unless it is a horizontal form: `orientation="horizontal"`)
- `required` on the Field shows a decorative `*`, sets `aria-required` and turns on the browser's constraint validation: native inputs get the native `required` attribute, and choice and picker controls (Checkbox, Switch, RadioGroup, Dropdown, DatePicker, …) render a required hidden input, so the form does not submit while the control is empty, unchecked or off. A form that shows its own errors on submit, like the one above, sets `noValidate`
- A `readOnly` Combobox, TagPicker, DatePicker or TimePicker does not block the submit, like a native read-only input (it keeps `aria-required`)
- Field's `error` renders the message below the control in a `role="alert"` element and marks the control invalid (a control's own `aria-invalid={false}` wins, and the error still describes it); `hint` describes it and stays visible after the message. A `label`, `hint` or `error` that renders nothing (an empty `errors.map(…)`) counts as absent
- For advice that is not an error, use `validationMessage` with `validationState="warning"` (announced, the control stays valid), `"success"` or `"none"` (shown, not announced); see [Pattern 8](#pattern-8-composite-controls-and-field)
- A settings form can put labels beside the controls with `orientation="horizontal"` on each Field
- One control per Field; wrap layout or wrapper components (a Tooltip) in a plain `<div>` inside the Field
- Primary action button end-aligned, or full-width on mobile

### Navigation Patterns

**App shell (NavDrawer, Hamburger, inline Drawer)**:

```tsx
import * as React from 'react';
import { Drawer, Hamburger, Nav, NavDrawer, Toolbar } from '@mortenbrudvik/waveui';

export function AppShell({ narrow }: { narrow: boolean }) {
  const [navOpen, setNavOpen] = React.useState(!narrow);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [previousNarrow, setPreviousNarrow] = React.useState(narrow);
  // The breakpoint decides the open states: a resize never turns an open inline pane into a modal.
  if (narrow !== previousNarrow) {
    setPreviousNarrow(narrow);
    setNavOpen(!narrow);
    setDetailsOpen(false);
  }
  const outer = React.useRef<HTMLButtonElement>(null);
  const type = narrow ? 'overlay' : 'inline';
  return (
    <div className="flex h-dvh flex-col">
      <Toolbar aria-label="App">
        <Hamburger
          ref={outer}
          aria-expanded={navOpen}
          aria-controls={navOpen ? 'nav' : undefined}
          aria-haspopup={narrow ? 'dialog' : undefined}
          onClick={() => setNavOpen(!navOpen)}
        />
        <Toolbar.Button className="ms-auto" onClick={() => setDetailsOpen(!detailsOpen)}>
          Details
        </Toolbar.Button>
      </Toolbar>
      <div className="flex min-h-0 flex-1">
        <NavDrawer
          id="nav"
          aria-label="Main"
          type={type}
          open={navOpen}
          onOpenChange={setNavOpen}
          onItemSelect={() => {
            if (narrow) setNavOpen(false);
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
            <Nav.Category value="settings" label="Settings">
              <Nav.SubItem value="profile" href="/settings/profile">
                Profile
              </Nav.SubItem>
            </Nav.Category>
          </NavDrawer.Body>
        </NavDrawer>
        <main className="min-w-0 flex-1 overflow-auto p-6">…</main>
        <Drawer type={type} separator title="Details" open={detailsOpen} onOpenChange={setDetailsOpen}>
          Owner: People team.
        </Drawer>
      </div>
    </div>
  );
}
```

- **The breakpoint rule.** Above the breakpoint both panes are inline (page content beside `main`); below it they are overlays. Set the open states when the breakpoint changes, during render as above, so a resize never turns an open inline pane into a page-blocking modal. Changing `type` remounts a panel; NavDrawer keeps its selection and open categories.
- **Two Hamburgers.** The page's Hamburger opens the drawer and is its `finalFocusRef`; the one in `NavDrawer.Header` wires itself (`aria-expanded`, `aria-controls`, the toggle) and closes it, handing focus back to the page's Hamburger, also for an inline drawer that was open from the server.
- **Closing on selection.** `onItemSelect` fires on every activation, the current page included, so an overlay closes when any item is chosen; `onValueChange` fires only when the value changes.
- **Landmarks.** Name the NavDrawer (`aria-label="Main"`) when the page has another navigation landmark; the inline details Drawer is an `<aside>` named by its title.

`Nav` on its own (a fixed sidebar):

```tsx
import * as React from 'react';
import { Nav } from '@mortenbrudvik/waveui';

export function Sidebar() {
  const [page, setPage] = React.useState('home');
  return (
    <Nav aria-label="Main" value={page} onValueChange={setPage}>
      <Nav.Item value="home" href="/home">
        Home
      </Nav.Item>
      <Nav.Category value="settings" label="Settings">
        <Nav.SubItem value="profile" href="/settings/profile">
          Profile
        </Nav.SubItem>
        <Nav.SubItem value="account" href="/settings/account">
          Account
        </Nav.SubItem>
      </Nav.Category>
    </Nav>
  );
}
```

The category that contains the selected item (`value` or `defaultValue`) starts open; `defaultOpenCategories` (even `[]`) replaces that, and `openCategories`/`onOpenCategoriesChange` control it. A click that opens a link elsewhere (Ctrl/Cmd/Shift/Alt-click, a mouse button other than the main one, a `target` other than `_self`, a `download` link) selects nothing, unless the item's `onClick` calls `preventDefault()` (client-side routing): the browser then opens nothing elsewhere, and the item is selected. Item values (items and sub-items share them) and category values are unique; a duplicate warns in development. A closed category that contains the current page marks its toggle (`aria-current="true"`, the selected look); for sub-items that your own component renders inside a category, pass the category's value as `currentCategory`. `Nav.SectionHeader`, `Nav.Divider`, `Nav.AppItem` and `Nav.AppItemStatic` structure the list, and `actions` puts your own buttons beside an item (README, "Navigation").

**Breadcrumb**:

```tsx
<Breadcrumb>
  <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
  <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
  <Breadcrumb.Item current>Widget A</Breadcrumb.Item>
</Breadcrumb>
```

Each element of a Fragment child (`{isAdmin && <>…</>}`) becomes its own crumb with a separator. With `asChild`, the item's props merge onto your element, and its `href` is passed as a default (the element's own `href` wins); give a router link its destination (`to`) on the link itself.

A deep trail collapses its middle items into a "…" button with a menu of them: `maxDisplayedItems={4}` by count (from `overflowIndex`, default 1), or `overflow="auto"` by the room it has (the trail becomes an Overflow of its list items). The first item and the current one always show. `size`, `focusMode="arrow"` (one Tab stop) and `divider` set the look and the keys; `truncateBreadcrumbLongName` shortens a long name, and a Tooltip can show it in full (a collapsed item wrapped in a Tooltip is left out of the menu, with a development warning).

**Tabs**:

```tsx
import * as React from 'react';
import { TabList } from '@mortenbrudvik/waveui';

export function ProductTabs() {
  const [tab, setTab] = React.useState('overview');
  return (
    <TabList aria-label="Product" value={tab} onValueChange={setTab}>
      <TabList.Tab value="overview">Overview</TabList.Tab>
      <TabList.Tab value="details">Details</TabList.Tab>
      <TabList.Panel value="overview">Overview content</TabList.Panel>
      <TabList.Panel value="details">Details content</TabList.Panel>
    </TabList>
  );
}
```

Moving focus with the arrow keys selects the tab; pass `selectTabOnFocus={false}` when a panel is slow to show, so the keys only move focus and Enter or Space selects (see [Keyboard Navigation Patterns](#keyboard-navigation-patterns)).

**Menu button**:

```tsx
<Menu>
  <Menu.Trigger>
    <MenuButton>Actions</MenuButton>
  </Menu.Trigger>
  <Menu.Popover>
    <Menu.Item>Rename</Menu.Item>
    <Menu.Item>Duplicate</Menu.Item>
    <Menu.Divider />
    <Menu.Item>Delete</Menu.Item>
  </Menu.Popover>
</Menu>
```

Use `Menu.Trigger` + `Menu.Popover` for menu buttons (not `Popover`, which has no menu semantics). For a `SplitButton`, pass the render-prop props of `Menu.Trigger` to `menuButtonProps`. A `disabledFocusable` MenuButton or SplitButton stays focusable (a Tooltip can say why) but never opens its menu.

### Data Display Patterns

**Sortable DataGrid** (typed columns and `items`: the grid sorts its own rows by the sorted column's `compare`):

```tsx
import { Badge, DataGrid, createTableColumn } from '@mortenbrudvik/waveui';

interface User {
  id: string;
  name: string;
  active: boolean;
}

const users: User[] = [
  { id: '1', name: 'Alice', active: true },
  { id: '2', name: 'Bob', active: false },
];

const columns = [
  createTableColumn<User>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name),
    renderCell: (user) => user.name,
  }),
  createTableColumn<User>({
    columnId: 'status',
    label: 'Status',
    renderCell: (user) => (
      <Badge appearance="tint" color={user.active ? 'success' : 'informative'}>
        {user.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  }),
];
const userId = (user: User) => user.id;

export function Users() {
  return (
    <DataGrid
      aria-label="Users"
      items={users}
      columns={columns}
      getRowId={userId}
      defaultSort={{ columnId: 'name', direction: 'ascending' }}
    />
  );
}
```

The sort is stable and descending negates `compare`, so equal rows keep their order both ways; a column without `compare` (Status) is no sort button and never reorders the rows. A grid composed from `DataGrid.Header` and `DataGrid.Body` children without `items` reports the sort (`onSortChange(sort, details)`) and leaves the row order to you. `selectOnRowClick`, `selectionAppearance` and `subtleSelection` set how rows are selected and drawn; the static `Table` has sortable headers (`sortable`, `sortDirection`, `onSortClick`) and the cell parts `Table.SelectionCell`, `Table.CellLayout` and `Table.CellActions`, all driven by your state.

**List with selection**:

```tsx
import * as React from 'react';
import { List } from '@mortenbrudvik/waveui';

export function FruitPicker() {
  const [selected, setSelected] = React.useState<string[]>([]);
  return (
    <List selectable selectionMode="multiple" aria-label="Fruits" selectedItems={selected} onSelectionChange={setSelected}>
      <List.Item value="apple">Apple</List.Item>
      <List.Item value="banana">Banana</List.Item>
    </List>
  );
}
```

**List with an action and no selection** (`navigationMode="items"`: one Tab stop, the arrow keys and typeahead; `onAction` runs on a click, Enter and Space):

```tsx
<List navigationMode="items" aria-label="Recent files">
  <List.Item value="report" onAction={() => open('report')}>Report</List.Item>
  <List.Item value="budget" onAction={() => open('budget')}>Budget</List.Item>
</List>
```

`rowId`s of a DataGrid, `value`s of a selectable or navigable List and `itemId`s of an Overflow are unique: items that share one are selected (or hidden) together, and a development warning names the duplicate.

### Feedback Patterns

**Toast notifications** — wrap the app in `<Toaster>` and call `useToastController()` below it:

```tsx
import { Button, Toast, Toaster, useToastController } from '@mortenbrudvik/waveui';

function SaveButton({ onUndo }: { onUndo: () => void }) {
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
              Saved
            </Toast.Title>
            <Toast.Body>Your changes have been saved.</Toast.Body>
          </Toast>,
        )
      }
    >
      Save
    </Button>
  );
}

export function App({ undo }: { undo: () => void }) {
  return (
    <Toaster position="bottom-end">
      <SaveButton onUndo={undo} />
    </Toaster>
  );
}
```

A sibling `<Toaster />` does not work: `useToastController()` outside a Toaster throws in development (from code outside components, dispatch through a `createToaster()` handle bound with `<Toaster toaster={handle}>`). Every toast pauses while the pointer or focus is anywhere in the toast region and while the page is in the background, and a toast with an action (the Undo above) stays until it is dismissed unless the dispatch passes `timeout`. The rendered Toast's `status` sets the announcement's politeness and prefix. `statusLabel` translates the hidden status text; `<Toaster limit={3}>` shows at most three toasts and queues the rest (a queued toast is not announced and does not count down until it shows); `dismissAllToasts()` from the controller removes every toast. The text form `dispatchToast({ status, title, body })` still works.

**Dialog confirmation** — `modalType="alert"` for a question that needs an answer (a backdrop press does not close it), `autoFocus` on the least destructive action, and `Dialog.Footer` inside `Dialog.Content`:

```tsx
import * as React from 'react';
import { Button, Dialog } from '@mortenbrudvik/waveui';

export function ConfirmDelete({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog modalType="alert" open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button>Delete</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Delete item?">
        <p>This action cannot be undone.</p>
        <Dialog.Footer>
          <Dialog.Close>
            <Button autoFocus>Cancel</Button>
          </Dialog.Close>
          <Button
            appearance="primary"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
```

`onOpenChange` receives the reason as a second argument (`details.reason`: `trigger`, `close`, `close-button`, `escape`, `outside-press`), so a controlled dialog can refuse some ways of closing, such as a backdrop press while a form has unsaved changes. `Dialog.Footer` sticks to the bottom of the scrolling body (inside `Dialog.Content`; in a Drawer it is a plain action row), and the body reserves its height, so a focused field is never hidden behind it; inside a `<form>` that wraps the fields and the footer, make the footer the form's last child.

**Loading states**:

```tsx
<>
  {/* Spinner for short waits */}
  <Spinner size="medium" label="Loading results" />

  {/* Skeletons for content placeholders, inside a busy group */}
  <Skeleton.Group label="Loading profile">
    <Skeleton shape="circular" width={32} height={32} />
    <Skeleton width={200} height={20} />
  </Skeleton.Group>

  {/* Progress bar for measured progress (value out of max, default 100) */}
  <ProgressBar value={60} label="Uploading" showLabel />

  {/* A busy primary Button: the spinner is decorative, the label names the state */}
  <Button appearance="primary" icon={<Spinner appearance="inverted" size="extra-small" />}>
    Saving
  </Button>
</>
```

`Spinner` `delay` (milliseconds) holds back the ring and the label, so a load that finishes quickly shows no spinner at all; its status region is mounted at once and announces the label when it shows. `appearance="inverted"` draws it in the current text color, for a primary Button or an inverted surface. ProgressBar `color` (`success`, `warning`, `error`) shows the outcome, and inside a `Field` the bar follows the Field's validation state.

### Component Selection Guide

| Need | Component |
|------|-----------|
| Trigger an action | `Button`, `CompoundButton`, `SplitButton` |
| Navigate to a page | `Link`, `Breadcrumb` (collapses into a "…" menu with `maxDisplayedItems` or `overflow="auto"`; `partitionBreadcrumbItems` and the truncation helpers), `Nav`, `NavDrawer` with `Hamburger` (an app shell), `Pagination` |
| Single-line text input | `Input`, `SearchBox` |
| Multi-line text input | `Textarea` |
| Select from options | `Dropdown` (select-only), `Combobox` (type to filter), `Listbox` (in the page), `Select` (native) |
| Pick multiple items | `TagPicker` (its parts: your own Tags, `TagPicker.Option`s, `TagPicker.Button`; `allowCreate` for free tagging), `Dropdown`/`Combobox`/`Listbox` with `multiselect`, `Checkbox` group, selectable `List`, selectable `InteractionTag`s in a `TagGroup` |
| Build a picker of your own | `useListbox`, `useListboxPopup`, `ListboxSurface`, `Option` ([Pattern 12](#pattern-12-building-a-custom-picker)) |
| Boolean toggle | `Switch`, `Checkbox`, `ToggleButton` |
| Choose one from few | `RadioGroup` |
| Pick a number | `Slider`, `SpinButton` |
| Pick a color | `ColorPicker`, `ColorArea`, `ColorSlider`, `AlphaSlider`, `SwatchPicker` (with `ColorSwatch`, `ImageSwatch`, `EmptySwatch`) |
| Show user identity | `Avatar` (sizes 16 to 128, `shape`, named `color`, `active`, `initials`; `getInitials`), `AvatarGroup` (`stack`, `spread`, `pie`; `AvatarGroup.Item` and `AvatarGroup.Popover` with `partitionAvatarGroupItems`), `Persona` (up to four text lines, `textPosition`, `presenceOnly`) |
| Categorize items | `Badge`, `Tag`, `TagGroup` (a set of tags, with dismissal and focus after a removal), `InteractionTag` (a tag with an action), `CounterBadge` |
| Show status | `PresenceBadge` (`available`, `busy`, `away`, `offline`, `do-not-disturb`, `out-of-office`), `MessageBar` |
| Display data | `Table` (sortable headers, `Table.SelectionCell`, `Table.CellLayout`, `Table.CellActions`; your state), `DataGrid` (`items` with `createTableColumn` columns that sort themselves, `selectOnRowClick`, `selectionAppearance`, `subtleSelection`, `DataGrid.SelectionCell`), `List` (`navigationMode`, `onAction`, `disabledSelection`, check marks) |
| Organize content | `Card` (`appearance`, `size`, `orientation`, `Card.Preview`, header `image` and `action`, `floatingAction`), `Accordion`, `TabList` (`appearance`, `size`, icon tabs), `Tree`, `Grid`, `Stack`, `Flex` |
| Overlay content | `Dialog`, `Drawer` (also non-modal, or inline in the page), `Popover`, `Tooltip` |
| Offer actions in a popup | `Menu` with `MenuButton` or `SplitButton` |
| Show progress | `Spinner`, `ProgressBar`, `Skeleton` |
| Notify users | `Toast` / `Toaster` (`createToaster()` from outside components), `MessageBar`, `MessageBarGroup` (a stack that animates the bars it gains and loses) |
| Pick a date | `DatePicker`, `Calendar` (in the page) |
| Pick a time | `TimePicker` |
| Guide users | `TeachingPopover` (`primaryAction`/`secondaryAction`, `onFinish`; a tour from parts with `TeachingPopover.Trigger`, `.Surface`, `.Header`, `.Title`, `.Body`, `.Footer` and the carousel parts) |
| Show step progress | `Stepper` |
| Handle overflow | `Overflow` / `OverflowItem` (`priority`, `pinned`, `overflowDirection`, groups with `Overflow.Divider`, `buttonPosition`, `asChild` items; `useIsOverflowGroupVisible`, `useHasHiddenItems`) |
| Browse content | `Carousel` (`groupSize`, `draggable`, `Carousel.Item thumbnail`, `controlsLayout`, `Carousel.Button`) |
| Rate items | `Rating`, `RatingDisplay` |
| Label fields | `Label`, `InfoLabel`, `Field` |

---

## 12. Quick Reference

### Component Catalog (79 components)

**Buttons & Actions** (7)
`Button` `CompoundButton` `ToggleButton` `SplitButton` `MenuButton` `Link` `Toolbar` (plus the Toolbar parts `Toolbar.Button`, `Toolbar.ToggleButton`, `Toolbar.RadioGroup`, `Toolbar.RadioButton`, `Toolbar.Group`, `Toolbar.Divider`)

**Input & Forms** (27)
`Input` `Textarea` `Field` `Label` `Checkbox` `RadioGroup` `Switch` `Select` `SearchBox` `Slider` `SpinButton` `Combobox` `Dropdown` `Listbox` `TagPicker` `Rating` `ColorPicker` `ColorArea` `ColorSlider` `AlphaSlider` `SwatchPicker` `ColorSwatch` `ImageSwatch` `EmptySwatch` `DatePicker` `Calendar` `TimePicker` (plus the TagPicker parts `TagPicker.Control`, `TagPicker.Group`, `TagPicker.Input`, `TagPicker.Button`, `TagPicker.List`, `TagPicker.Option`, `TagPicker.OptionGroup`, `RadioGroup.Item`/`RadioItem`, `Option`/`OptionGroup` (also `Listbox.Option`/`Listbox.OptionGroup`), `SwatchPicker.Row`, `RatingDisplay`, the ColorPicker parts `ColorPicker.HexField`, `ColorPicker.Swatches`, `ColorPicker.Preview`, and `ListboxSurface`/`ListboxProvider` for custom pickers)

**Data Display** (14)
`Avatar` `AvatarGroup` `Badge` `PresenceBadge` `CounterBadge` `Tag` `TagGroup` `InteractionTag` `Persona` `Divider` `InfoLabel` `InfoButton` `Image` `List` (plus `InteractionTag.Primary`, `InteractionTag.Secondary`)

**Layout** (9)
`Card` `Accordion` `TabList` `Tree` `Carousel` `Overflow` `Grid` `Stack` `Flex` (plus `Tree.ItemPersonaLayout`, `Overflow.Item`, `Overflow.Divider`)

**Navigation** (7)
`Breadcrumb` `Menu` `Nav` `NavDrawer` `Hamburger` `Stepper` `Pagination` (plus the Menu parts `Menu.ItemCheckbox`, `Menu.ItemRadio`, `Menu.ItemSwitch`, `Menu.ItemLink`, `Menu.Group`, `Menu.GroupHeader`, `Menu.SplitGroup`, the Nav parts `Nav.SectionHeader`, `Nav.Divider`, `Nav.AppItem`, `Nav.AppItemStatic`, and `NavDrawer.Header`, `NavDrawer.Body`, `NavDrawer.Footer`)

**Feedback** (6)
`MessageBar` `MessageBarGroup` `ProgressBar` `Spinner` `Skeleton` `Toast`/`Toaster` (plus `MessageBar.Title`, `MessageBar.Actions`, `Toast.Title`, `Toast.Body`, `Toast.Footer`, `Toast.Close`)

**Overlays** (5)
`Dialog` `Popover` `Tooltip` `Drawer` `TeachingPopover` (plus the Drawer parts `Drawer.Header`, `Drawer.HeaderTitle`, `Drawer.HeaderNavigation`, `Drawer.Body`, `Drawer.Footer`, and the TeachingPopover parts `TeachingPopover.Trigger`, `TeachingPopover.Surface`, `TeachingPopover.Header`, `TeachingPopover.Title`, `TeachingPopover.Body`, `TeachingPopover.Footer`, `TeachingPopover.Carousel`, `TeachingPopover.CarouselNav`, `TeachingPopover.CarouselPageCount`, `TeachingPopover.CarouselFooter`)

**Table** (2)
`Table` `DataGrid` (plus the cell parts `Table.SelectionCell`, `Table.CellLayout`, `Table.CellActions` and `DataGrid.SelectionCell`; `createTableColumn` builds typed DataGrid columns)

**Typography** (1)
`Text`

**Provider** (1)
`WaveProvider` (plus the `Portal` utility)

**Motion** (utility)
`Presence` (`usePresence` is its hook form)

### Most-Used Tailwind Classes

```
/* Typography */
text-body-1              /* 14px default body text */
text-caption-1           /* 12px labels */
text-subtitle-1          /* 20px semibold headings */
font-semibold            /* 600 weight */
font-wave                /* Wave font stack */

/* Colors */
bg-background            /* Page background */
text-foreground          /* Default text */
bg-primary               /* Brand buttons */
text-primary-foreground  /* Text on brand fills */
text-muted-foreground    /* Secondary text */
bg-subtle-hover          /* Hover on transparent controls */
bg-selected              /* Brand-tinted selection */
border-border            /* Standard borders */
border-stroke            /* Control borders */
border-stroke-accessible /* Edges that need 3:1 */

/* Spacing */
p-4                      /* 16px padding (standard) */
gap-2                    /* 8px gap */
gap-4                    /* 16px gap */

/* Borders */
rounded                  /* 4px (controls) */
rounded-md               /* 6px (cards, menus, popovers) */
rounded-full             /* Circular */
border                   /* 1px solid */

/* Shadows */
shadow-2                 /* Cards at rest */
shadow-4                 /* Hover state */
shadow-8                 /* Popovers, dropdowns */
shadow-16                /* Dialogs */

/* Layout (logical) */
flex items-center        /* Horizontal centering */
ms-2 pe-4 start-0        /* RTL-safe margins, padding, positions */
wave-rtl:-scale-x-100    /* mirror a directional glyph in RTL */

/* Focus */
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring  /* focusRing */
focus:outline-hidden focus:border-b-2 focus:border-b-primary                       /* inputFocus */

/* Motion (Tailwind path) */
transition-opacity duration-wave-fast ease-wave-easy-ease motion-reduce:transition-none
data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0   /* enter and exit with Presence */

/* Disabled-aware states */
not-disabled:not-aria-disabled:hover:bg-subtle-hover
not-disabled:not-aria-disabled:active:bg-subtle-pressed
```

### Key File Paths

| File | Purpose |
|------|---------|
| `src/styles/tokens.css` | `--wave-*` tokens per theme and the `@theme inline` Tailwind mapping |
| `src/styles/base.css` | Base styles and native-element reset scoped to `.wave-root` / `.wave-portal` |
| `src/styles/styles.css` | Build input of the precompiled `dist/styles.css` (`./styles`) |
| `src/styles/tailwind.css` | Tailwind consumer entry (`./tailwind`) |
| `src/styles/variants.css` | The `wave-rtl:` direction variant |
| `src/styles/legacy-tokens.css` | Deprecated 0.4 variable names (`./legacy-tokens.css`) |
| `src/lib/cn.ts` | Class name merge utility |
| `src/lib/types.ts` | Shared types (`Size`, `Appearance`, `Status`, `Orientation`, …) |
| `src/lib/slot.ts` | Slot system for customizable sub-elements (`slotRendersContent`, `materialiseSlotContent`, `slotWrapsDefaultContent`) |
| `src/lib/children.ts` | `getElementType` (`{ suspend: false }` for walks deeper than the direct children), `isElementOfType`, `flattenChildren` for compound parts (Server Component references, Fragments) |
| `src/lib/styles.ts` | Focus rings, input focus and forced-colors recipes |
| `src/lib/classNames.ts` | The stable class-name registry (public, server-safe) |
| `src/lib/color.ts` | `hsvToHex`, `hexToHsv` (public, server-safe) |
| `src/lib/toaster.ts` | `createToaster`, the toaster handle (public, server-safe) |
| `src/components/feedback/Toast*.tsx`, `src/components/feedback/Toaster.tsx` | The Toast modules (compound, root, parts, context, the Toaster) |
| `src/components/layout/Tree*.ts(x)` | The Tree modules (compound, root and items, context, the cascade model, the persona layout) |
| `src/components/layout/Overflow.tsx`, `src/components/layout/Overflow.store.ts` | Overflow, its items, divider and hooks; the store that measures and picks the items to hide (internal) |
| `src/components/table/Table.shared.tsx` | The sort button and glyphs, the selection control and the cell classes that Table and DataGrid share (internal) |
| `src/components/overlays/TeachingPopover*.ts(x)` | The TeachingPopover modules (compound, root, context and public types, parts with the internal surface) |
| `src/lib/breadcrumb.ts`, `src/lib/table.ts` | `partitionBreadcrumbItems` and the truncation helpers, `createTableColumn` (public, server-safe) |
| `src/lib/composeEventHandlers.ts` | Consumer + internal handler composition |
| `src/hooks/useControllable.ts` | Controlled/uncontrolled state hook |
| `src/hooks/useRovingTabIndex.ts` | Roving tab index for composite widgets (`data-roving-transparent`) |
| `src/hooks/usePresence.ts`, `src/components/motion/Presence.tsx` | The presence core (enter and exit phases) |
| `src/lib/motion.ts`, `src/hooks/useMotion.ts` | The motion recipes of every component and `resolveMotion`; `useMotionPreference`, `useMotionClasses` (internal) |
| `src/hooks/useCollapsePresence.ts`, `src/hooks/useFocusBeforeClose.ts`, `src/hooks/usePresenceGroup.ts` | The collapse of Accordion, Tree and Nav; focus out of a closing popup; MessageBarGroup's keyed presence group (internal) |
| `src/hooks/useCheckedValues.ts` | `checkedValues` state of Menu and Toolbar (internal) |
| `src/hooks/useHoverIntent.ts`, `src/hooks/useContextMenuAnchor.ts`, `src/lib/events.ts` | Hover opening and the safe zone, context gestures, event predicates (the foreign-event and text-selection rules of List items and DataGrid row clicks too; internal) |
| `src/components/navigation/Menu.*.tsx` | The Menu modules (root, context, items, trigger, popover, item kinds, groups, links, split rows) |
| `src/hooks/useFieldControl.ts` | `FieldContext` and the Field wiring for controls |
| `src/hooks/useListbox.ts` | The listbox of Listbox, Combobox, Dropdown, TagPicker, TimePicker and custom pickers: `useListbox`, `useListboxOption`, `collectOptionLabels`, `markListboxElement` (public) |
| `src/hooks/useActiveDescendant.ts` | The active item of an `aria-activedescendant` composite (public; `useListbox` is built on it) |
| `src/components/input/Option.tsx` | `Option`, `OptionGroup`, and the custom-picker pieces `ListboxSurface`, `useListboxPopup`, `ListboxProvider` |
| `src/hooks/useRovingGrid.ts` | Roving focus in two dimensions, SwatchPicker's grid layout (internal) |
| `src/components/input/Calendar.tsx`, `src/components/input/Calendar.views.tsx` | Calendar and the views it shares with DatePicker's dialog (the day, month and year grids) |
| `src/components/input/SwatchPicker*.ts(x)` | The SwatchPicker modules (root and rows, the swatch kinds, the context) |
| `src/lib/date.ts` | `addDays`, `addMonths`, `isSameDay`, `startOfWeek`, `getWeekNumber` (public, server-safe) |
| `src/hooks/useDismiss.ts`, `src/lib/layers.ts` | Layered Escape and outside-press dismissal (internal; the `DismissReason` type is public) |
| `src/components/provider/WaveProvider.tsx` | Theme provider |
| `src/components/portal/Portal.tsx` | Themed portal |
| `src/test-utils.ts`, `src/test-utils-field.tsx` | Shared test helpers |

### Keyboard Pattern Cheat Sheet

| Widget | Enter group | Navigate | Activate | Leave |
|--------|------------|----------|----------|-------|
| Button | Tab | – | Enter/Space | Tab |
| Toolbar | Tab (last focused control) | Left/Right (Up/Down vertical), Home/End; `disabledFocusable` controls included; Up/Down within a radio group | Enter/Space (press, check) | Tab |
| RadioGroup, SwatchPicker (row layout) | Tab (selected item) | All arrows, Home/End | Selects on move | Tab |
| SwatchPicker (`layout="grid"`) | Tab (last focused, else selected swatch) | Arrows (row by row), Home/End, Ctrl+Home/End | Enter/Space | Tab |
| SwatchPicker (`focusMode="tab"`) | Tab (every swatch) | – | Enter/Space | Tab |
| Listbox | Tab (the list) | Down/Up, Home/End, PageUp/PageDown, typeahead | Enter/Space | Tab |
| Tabs | Tab (selected tab) | Left/Right (Up/Down vertical), Home/End | Selects on move (with `selectTabOnFocus={false}`: Enter/Space) | Tab |
| Combobox, TagPicker, TimePicker | Tab | Down/Up (open and move) | Enter | Escape / Tab |
| Dropdown | Tab | Down/Up/Home/End, typeahead, PageUp/PageDown | Enter/Space | Escape / Tab (commits) |
| Menu | Enter/Space/Down on the trigger; Shift+F10 on a context region | Up/Down, Home/End, typeahead; Right/Left into and out of submenus | Enter/Space (Space keeps a checkable item's menu open) | Escape (one level) / Tab (all) |
| Tree | Tab (selected item) | Up/Down, Left/Right (collapse/expand), Home/End, typeahead; into a row's actions by Tab (`tree`) or Right (`treegrid`) | Enter/Space (Space toggles the check in a checkbox tree) | Tab |
| Toaster | the app's `shortcuts.focus` key press | Tab through the toasts' controls | Enter/Space on a control | Escape (all toasts) / Delete, Backspace (the focused one) |
| ColorArea | Tab (one stop) | Arrows, Shift+arrows, PageUp/PageDown, Home/End | – | Tab |
| List (selectable, or `navigationMode="items"`) | Tab | Up/Down, Home/End, typeahead | Enter/Space (toggle; Enter runs `onAction`) | Tab |
| Breadcrumb (`focusMode="arrow"`) | Tab (the last focused link, at first the first) | Left/Right, Home/End | Enter (Space on a button) | Tab |
| DataGrid | Tab (one tab stop) | Arrows, Home/End, Ctrl+Home/End, PageUp/PageDown | Enter/F2 (into cell), Space (select row) | Tab / Escape (from cell widgets) |
| DatePicker calendar, Calendar | Alt+Down on the input, or the toggle (Calendar: Tab) | Arrows, PageUp/PageDown, Shift+PageUp/PageDown, Home/End; the heading button to the month and year views | Enter/Space | Escape (one view back; in the day view, closes a DatePicker) / Tab |
| Dialog / Drawer (modal, alert) | Auto-focus | Tab (trapped) | Enter | Escape / the trigger (toggles) |
| Dialog / Drawer (non-modal) | Auto-focus | Tab (in page order, after the opener) | Enter | Escape (from inside) / Tab out |
| Drawer (inline), NavDrawer (inline) | Tab (page content) | Tab | Enter | Tab / the trigger (toggles) |
| TagGroup | Tab (last focused control) | Left/Right (Up/Down vertical), Home/End; `role="list"`: Tab | Enter/Space; Delete/Backspace dismiss | Tab |
| NavDrawer.Body (`focusMode="arrow"`) | Tab (current page) | All arrows (wrapping), Home/End | Enter/Space | Tab |

*RadioGroup, the row-layout SwatchPicker and Tabs use automatic activation: moving focus selects (Tabs with `selectTabOnFocus={false}` use manual activation). Accordion, Carousel, Nav, Breadcrumb (unless `focusMode="arrow"`) and Pagination use plain Tab navigation between native buttons and links.*

---

## 13. Deprecated APIs

Deprecated names still work through 0.x, warn once in development and will be removed in 1.0. The CHANGELOG has the full table with callback semantics.

| Deprecated | Use instead |
|---|---|
| `onChange(checked)` on Checkbox, Switch | `onCheckedChange` |
| `onChange(value)` on RadioGroup, Rating, SearchBox, SpinButton, ColorPicker, SwatchPicker, TagPicker, TimePicker, DatePicker | `onValueChange` |
| `onOptionSelect` on Combobox, Dropdown | `onValueChange` (fires on change only; `onOptionSelect` fired on every activation) |
| TabList `selectedValue`, `defaultSelectedValue`, `onTabSelect`, `vertical` | `value`, `defaultValue`, `onValueChange`, `orientation` |
| Nav `selectedValue`, `defaultSelectedValue`, `onNavItemSelect` | `value`, `defaultValue`, `onValueChange` |
| Nav.Category label from the first string child | `label` |
| TeachingPopover `currentStep`, `defaultCurrentStep` | `activeStep`, `defaultActiveStep` |
| List `selectionMode="multi"` | `selectionMode="multiple"` |
| DataGrid `selectedKeys`, `defaultSelectedKeys`, `onSelectionChange` | `selectedItems`, `defaultSelectedItems`, `onSelectedItemsChange` |
| DataGrid `sortColumn`, `sortDirection`, `defaultSortColumn`, `defaultSortDirection` | `sort`, `defaultSort` (a grid with `items` ignores the deprecated props) |
| `DataGridColumn` `id` | `columnId` |
| `Table.Head`, `Table.HeadCell` (and the flat `TableHead`, `TableHeadCell`, deprecated from their introduction in 0.5) | `Table.Header`, `Table.HeaderCell` (`TableHeader`, `TableHeaderCell`) |
| Stack `direction` | `orientation` |
| Skeleton `variant` | `shape` |
| Text `weight={400 \| 600 \| 700}` | `weight="regular" \| "semibold" \| "bold"` |
| Link `variant` | `appearance` |
| Tooltip `variant="dark" \| "light"` | `appearance="inverted" \| "normal"` |
| Accordion (single mode) `openItems`, `defaultOpenItems`, `onOpenItemsChange` | `openItem`, `defaultOpenItem`, `onOpenItemChange` |
| Theme classes `dark`, `high-contrast` | `wave-dark`, `wave-high-contrast` |
| `@mortenbrudvik/waveui/legacy-tokens.css` (0.4 variable names) | `--wave-*` variables |
| Button objects in `MessageBar.dismiss`, `SearchBox.dismiss`, `Tag.dismissIcon` | Icon content, plus `onDismiss` / `onClear` |
| Tooltip `delay` | `openDelay` |

**Announced for 1.0 (no warning yet):**

- Badge and CounterBadge `color="important"` renders the orange severe colors through 0.x and becomes Fluent's neutral high-emphasis color (near black in the light theme) in 1.0: use `color="severe"` to keep the orange look.
- The `details` parameter of Dialog and Drawer `onOpenChange` becomes required: read it as `details?.reason`.
- The `details` parameter of Menu and Toolbar `onCheckedValuesChange` becomes required: read it as `details?.name`.
- The `details` parameter of Tree `onCheckedItemsChange` becomes required: read it as `details?.value`.
- The `details` parameters of Overflow `onOverflowChange`, DataGrid `onSortChange` and `onSelectedItemsChange`, and `Table.SelectionCell` `onCheckedChange` become required: read them as `details?.event` (or `details?.groupVisibility`).
- TeachingPopover's Done stops calling `onDismiss`: put the work of a finished tour in `onFinish`.

---

*This guide documents `@mortenbrudvik/waveui`, a React + Tailwind CSS implementation inspired by the Fluent UI 2 design language. It is **not** the official `@fluentui/react-components` package. For the official Microsoft library, see [Fluent UI React v9](https://react.fluentui.dev/); for the official design guidelines, see [Fluent 2 Design](https://fluent2.microsoft.design/).*
