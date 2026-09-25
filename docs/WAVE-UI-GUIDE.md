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
- Mirror direction-dependent glyphs and offsets with Wave's `wave-rtl:` variant (`wave-rtl:-scale-x-100`; write the LTR value as the base class). It follows the element's own direction (`:dir(rtl)`), while Tailwind's `rtl:` also matches inside an LTR subtree of an RTL page; the library's conventions gate rejects bare `rtl:`/`ltr:` in components
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
| `border` | `#e0e0e0` | `#666666` | `#ffffff` |
| `stroke` | `#d1d1d1` | `#666666` | `#ffffff` |
| `stroke-hover` | `#c7c7c7` | `#757575` | `#ffffff` |
| `stroke-accessible` | `#616161` | `#adadad` | `#ffffff` |
| `input` | `#d1d1d1` | `#666666` | `#ffffff` |
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

- **Surfaces and text**: `background`/`foreground` for the page, `card` for raised surfaces, `muted` for neutral chips and backgrounds, `muted-foreground` for secondary text.
- **Interactive**: `primary` fills with `primary-foreground` text, `primary-hover`/`primary-pressed` for their states; `subtle-hover`, `subtle-pressed` and `subtle-selected` for transparent controls, rows and menu items; `selected` with `selected-foreground` for a brand-tinted selection; `ring` for focus.
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
| `grey-82` | `#d1d1d1` | Control borders (`stroke`, `input`) |
| `grey-88` | `#e0e0e0` | Dividers and borders (`border`), tracks, skeletons |
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

### Durations and Easing (reference values)

Fluent's motion values, for inline styles or custom CSS. They are not Wave tokens or Tailwind classes; components use Tailwind's `duration-*` utilities.

| Name | Value | Usage |
|-------|-------|-------|
| `ultra-fast` | 50ms | Micro-interactions (checkbox tick) |
| `faster` | 100ms | Small transitions (color change, opacity) |
| `fast` | 150ms | Standard hover/focus transitions |
| `normal` | 200ms | Default animation duration |
| `gentle` | 250ms | Deliberate transitions |
| `slow` | 300ms | Large element transitions |
| `slower` | 400ms | Page transitions |
| `ultra-slow` | 500ms | Dramatic entrances |

| Curve | CSS value | Usage |
|-------|-----------|-------|
| `accelerate-max` | `cubic-bezier(1, 0, 1, 1)` | Exit only (fast start, slow end) |
| `accelerate-mid` | `cubic-bezier(0.7, 0, 1, 0.5)` | Exit medium |
| `accelerate-min` | `cubic-bezier(0.8, 0, 1, 1)` | Subtle exit |
| `decelerate-max` | `cubic-bezier(0, 0, 0, 1)` | Enter only (slow start, fast end) |
| `decelerate-mid` | `cubic-bezier(0.1, 0.9, 0.2, 1)` | Enter medium |
| `decelerate-min` | `cubic-bezier(0.33, 0, 0.1, 1)` | Subtle enter |
| `easy-ease-max` | `cubic-bezier(0.8, 0, 0.2, 1)` | Bidirectional dramatic |
| `easy-ease` | `cubic-bezier(0.33, 0, 0.67, 1)` | Standard bidirectional |
| `linear` | `linear` | Continuous animations (spinners) |

### Motion Patterns

- **Enter**: `decelerate-mid` + 200–300ms. Element slides/fades in, decelerating to rest.
- **Exit**: `accelerate-mid` + 100–200ms. Element accelerates away. Faster than enter.
- **Hover/focus**: `easy-ease` + 100–150ms. Quick, responsive feedback.
- **Layout shift**: `easy-ease` + 200ms. Smooth repositioning.

### Reduced Motion

Wave has **no global reduced-motion override** (0.4 had one on `*`, which also froze spinners mid-turn). Each component handles `prefers-reduced-motion` itself:

- every transition carries a `motion-reduce:` variant (usually `motion-reduce:transition-none`);
- `Spinner` keeps spinning, slower (`motion-reduce:animate-wave-spin-slow`), so it still reads as "busy";
- the indeterminate `ProgressBar` becomes a full-width pulse instead of a sliding bar (never a static partial bar that looks like real progress);
- `Skeleton` stops pulsing;
- `Carousel` with `autoPlay` starts with rotation stopped.

Do the same in your own components: pair every `transition-*` or `animate-*` class with a `motion-reduce:` variant, and check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before JS-driven animation.

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
- **Component JSDoc** sits only on the exported `Object.assign(…)` const (the root gets none; likewise on a wrapper-call export and on the first overload), so it reaches `index.d.ts`, and it names no internal symbol (`XRoot`) or spec label. Storybook autodocs read it from there (`.storybook/exportDocblocks.ts`), so stories never repeat it (no meta JSDoc, no `docs.description.component` for a compound): `.storybook/__tests__/exportDocblocks.test.ts` gates this, and verify-dist fails on an undocumented exported component.
- A part rendered outside its root throws `[WaveUI] <Part> must be used within <Root>` in development; in production it logs that once per message and renders inert (`reportMissingContext` from `src/lib/dev.ts`).

Compound components: `Accordion`, `Breadcrumb`, `Card`, `Carousel`, `Combobox`, `DataGrid`, `Dialog`, `Drawer`, `Dropdown`, `List`, `Menu`, `Nav`, `Overflow`, `Popover`, `RadioGroup`, `Skeleton`, `Stepper`, `TabList`, `Table`, `Tree`. The README lists every flat name. Fragments are looked into (each element of a Fragment is a Breadcrumb item, an AvatarGroup member or a Carousel slide), but a component that renders a part itself is not recognised where a compound classifies its children: write `Carousel.Item`s, and nested `Tree.Item`s, in the compound itself (directly, in Fragments, or for Tree from a render function such as `children.map(renderNode)`).

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
- Dismiss and clear slots (Tag, MessageBar, SearchBox) share one rule, `slotWrapsDefaultContent(type, props)`: a slot object wraps the default icon only when its element is an intrinsic, non-void tag without `dangerouslySetInnerHTML` whose children render nothing (`{ className: 'text-error' }` styles the default icon). A component `as` (`{ as: CloseIcon }`), a void tag (`{ as: 'img', src, alt: '' }`) and markup of its own are the icon itself. A `<button>`/`Button` passed there, or a slot object whose `as` is one, is merged into the built-in button; its markup (`dangerouslySetInnerHTML`) renders inside that button.
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

`cn()` combines `clsx` (conditional classes) with a `tailwind-merge` that knows Wave's type ramp (`text-caption-2` … `text-display`), shadow scale (`shadow-2` … `shadow-64`), `font-wave` and the `animate-wave-*` animations:

```tsx
import { cn } from '@mortenbrudvik/waveui';

cn('px-4 py-2', true && 'px-6 py-3', 'px-8'); // 'py-3 px-8': the last conflicting class wins
cn('text-body-1 text-foreground', 'text-primary'); // 'text-body-1 text-primary': size kept, color replaced
cn('shadow-4', 'shadow-lg'); // 'shadow-lg'
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

`Button`, `CompoundButton`, `Link`, `Text`, `Toolbar`, `Card` (and its parts), `Stack`, `Flex`, `Grid`, `Tag` and `Divider` take an `as` prop, and their props are type-checked against the rendered element:

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

Each component declares `XOwnProps` with its own props only (never the default element's HTML attributes) and `type XProps<C extends React.ElementType = '<default element>'> = PolymorphicProps<C, XOwnProps>`, where the default is the component's own element: `'button'` for Button and CompoundButton, `'a'` for Link, `'span'` for Text and Tag, `'hr'` for Divider, and `'div'` for Toolbar, Card and its parts, Stack, Flex and Grid. `<Button as="a" formAction>` is a type error.

`React.ComponentProps<typeof Button>`, `React.memo(Button)` and Storybook's `Meta<typeof Button>` see the default element's props (`ButtonProps`): `PolymorphicComponent` ends with a default-element call signature. For another element, name it: `ButtonProps<'a'>`, and `StoryObj<ButtonProps<'a'>>` for stories whose args use `as`. In tests, a `testSystemProps` call whose `a11yVariants` use `as` names the widened type: `testSystemProps<ButtonProps<React.ElementType>>(Button, …)`.

**Button with `as`**:

- **Non-interactive elements.** `as="div"`, `as="span"` and other elements that are not interactive by themselves get `role="button"`, `tabIndex={0}` and Enter (key down) / Space (key up) activation, like a native button; a consumer `role` or `tabIndex` wins. `as="a"` shows no link underline. A native `<button>` gets `type="button"` by default (also when a wrapper forwards `type={undefined}`); a custom `as` component gets no `type` default, so pass `type` yourself inside a form.
- **`disabled`.** Only `button` (the default), `input`, `select` and `textarea` receive the native `disabled` attribute. Every other `as` gets `aria-disabled="true"` and `tabIndex={-1}`, placed after the rest props so a consumer value cannot re-enable it. That covers `a`, `div`, `span` and any custom component, including router links and styled or motion components that render a native `<button>`. Clicks, Enter and Space are prevented (the click does not reach ancestor `onClick` handlers), and an `<a>` drops its `href` and keeps `role="link"`. Such an element has no native `:disabled` state, so its own `:disabled` styling does not apply: style it on `[aria-disabled="true"]`. It leaves the tab order but can still take focus from a mouse click.
- **Hover and pressed colors** are gated (`not-disabled:not-aria-disabled:hover:` / `…:active:`), so they never apply while disabled or `aria-disabled` and they work for `as="a"`. A bare `className="hover:bg-error"` does not override them (see [Pattern 5](#pattern-5-cn-utility)): use `not-disabled:not-aria-disabled:hover:bg-error` or `hover:bg-error!`. CompoundButton, ToggleButton, MenuButton and SplitButton behave the same.

### Pattern 8: Composite Controls and Field

Controls whose root wraps a focusable element (Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker, TimePicker) route `id`, the naming and validation ARIA attributes (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`), `tabIndex`, `autoFocus`, focus/key handlers and native input attributes to the focusable element; `className`, `style`, `data-*`, other `aria-*` attributes and `ref` stay on the root, and `controlRef` reaches the focusable element. SearchBox and SpinButton draw their field (border, background, focus and invalid look) on that root, so `className`, `style` and `hidden` reach the visible field. `Input` with `contentBefore`/`contentAfter` content is the exception: its bordered wrapper receives only `className`, `style` and `hidden`, and everything else stays on the `<input>`.

Every library control reads the surrounding `Field` through `useFieldControl`, which merges the control's own labelling props with the Field's label, hint, error and required state. Your own controls can do the same:

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

### Pattern 9: Overlays and Triggers

- `Dialog.Trigger`, `Drawer.Trigger`, `Popover.Trigger` and `Menu.Trigger` merge their props (`aria-haspopup`, `aria-expanded`, `aria-controls`, a composed `onClick`, a ref) onto their single child, or pass them to a render-prop child. The trigger's live state always wins over the child's own ARIA props; the child's own `id` and handlers are kept. A Fragment around one element counts as that element.
- With `asChild={false}`, or when the child is text, several elements or a component that neither forwards `ref` nor spreads its props, the trigger renders a wrapper `<span>` (the automatic cases warn in development). A generic span cannot carry the state ARIA, so `aria-haspopup`, `aria-expanded` and `aria-controls` go to the first element in the tab order inside it (after mount), unless the consumer made the span the trigger (a non-generic `role` and `tabIndex={0}`: it keeps them; with only such a role it keeps them when nothing inside it is in the tab order). `tabIndex` alone leaves the span generic, so it never carries them (axe `aria-allowed-attr`). Every focus return of Menu, Popover, Dialog and Drawer goes to the element that carries them (`getTriggerFocusTarget` in `src/hooks/useTriggerElement.tsx`).
- Overlay surfaces render through `Portal` into `document.body` (or `WaveProvider`'s `portalContainer`) inside a `wave-portal` wrapper that carries the theme, direction and font.
- Escape and outside presses close only the topmost layer; presses inside overlays opened from a surface count as inside it. A surface that closes when focus leaves it (Menu, listbox popups, the AvatarGroup and InfoLabel popups) decides in a microtask after the focus change, so an `autoFocus` field of a popover, dialog or portal opened from inside it keeps it open.
- Clicks and keys from a portal opened inside an item (a Popover in a `Menu.Item`, a popup from a List action) bubble through the React tree; the item's own handling ignores events whose target is outside it in the DOM (C-COMPOSE), while the consumer's handlers still receive them (a disabled `Menu.Item` calls no `onClick`, as a disabled button).

### Props Interface Conventions

- Extend native HTML attributes: `React.HTMLAttributes<HTMLDivElement>`
- Omit conflicting native props: `Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'>`
- Name value callbacks after the state (`onValueChange`, `onCheckedChange`, `onOpenChange`); `onChange` is only the native change event
- Declare `ref` in the interface; export the props type with the component (`CardHeaderProps`, `DataGridRowProps`)
- Use shared types from `src/lib/types.ts`: `Size`, `Appearance`, `Status`, `Orientation`, `SelectionMode`, `TextWeight`, `Shape`, `PopupSide`, `PopupAlign`

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

#### Roving tab index (Toolbar, RadioGroup, SwatchPicker, TabList, Menu, List, Tree)

Implemented with `useRovingTabIndex`:

```
Tab          → enters the group at its tab stop (the selected item, else the first; Toolbar and the
               static Menu: the last focused item)
Arrow keys   → move within the group (RadioGroup, SwatchPicker and TabList also select)
Home / End   → first / last enabled item
Tab          → leaves the group
```

Only one item holds `tabIndex={0}`. Disabled items are skipped, and so are controls hidden with CSS (`display: none` or `visibility: hidden` inside the container, a closed `<details>`) and the `type="hidden"` input of a named value control. Left/Right are mirrored in RTL. Arrows that start in a text field, select, slider, spin button or editable combobox inside the group are left to that control (a SearchBox in a Toolbar keeps its caret keys). A Dropdown (select-only combobox) keeps Up/Down, Home and End for its list, but Left/Right move past it, so in a vertical Toolbar the arrows cannot leave it.

In a Toolbar, a nested composite (a RadioGroup, a TabList) keeps its own Tab stop and arrow keys, and focusing it or a text field, select, slider or spin button keeps the toolbar's Tab stop on the last focused other control, so Tab and Shift+Tab can return to the toolbar; such a control holds the stop only when nothing else can. These rules live in `useRovingTabIndex` (the CSS-hidden check in its `manageTabIndex` mode, which Toolbar and Menu use); an `itemSelector` the browser rejects logs a development warning.

| Component | Arrow keys |
|---|---|
| Toolbar | Left/Right (Up/Down when `orientation="vertical"`), wrapping |
| RadioGroup, SwatchPicker | all four arrows, wrapping; moving selects |
| TabList | Left/Right (Up/Down when vertical), wrapping; moving selects (automatic activation) |
| Menu | Up/Down, wrapping; typeahead |
| List (selectable) | Up/Down, wrapping; typeahead above 7 items; Enter/Space toggle selection |
| Tree | see below |

Wherever there is typeahead (Menu, selectable List, Tree, Dropdown), a Space typed within 500 ms of a character continues the search instead of activating or committing, so "new y" reaches "New York". Characters typed with AltGr, which Windows reports as Ctrl+Alt (Polish `ł`, Romanian `ș`), count; Ctrl+Alt with an arrow, Home, End or Space is left to the browser. An item that refuses focus (hidden by CSS) is passed over for the next match. Keys typed in content inside an item, such as a List row's action button, are not typeahead. Menu matches item labels only, never an icon's text or a shortcut.

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

Focus stays on the input. Typing filters the options (Combobox in both modes; with `freeform` the typed text is the value). In Combobox and TagPicker, Enter with no active option submits the form, also after typing text that matches no option. TimePicker's Enter on edited text commits a complete time within the bounds, clears the value when the text was erased, and otherwise keeps the text. TagPicker: Backspace in the empty input focuses the last tag, Backspace or Delete removes it.

#### Dropdown (select-only combobox)

```
ArrowDown / ArrowUp / Home / End → open and move the active option
Printable characters             → typeahead (opens the list)
PageUp / PageDown                → move by 10 while open
Enter / Space                    → open, or commit the active option
Alt+ArrowUp, Tab                 → commit the active option and close
Escape                           → close
```

#### Tree

```
Tab                  → enters at the selected item, else the first
ArrowDown / ArrowUp  → next / previous visible item
ArrowRight           → expand, or move to the first child (mirrored in RTL)
ArrowLeft            → collapse, or move to the parent (mirrored in RTL)
Home / End           → first / last visible item
Enter / Space        → activate (onItemSelect) and toggle a parent
*                    → expand all siblings
Printable characters → jump to the next item starting with the text
```

Nested items are `Tree.Item` elements in their parent's children: directly, in Fragments or from a render function (`children.map(renderNode)`). A `Tree.Item` rendered by a recursive component is not part of its parent's group (a development warning names it). `value`s are unique (a duplicate warns). `leaf` renders an item as a leaf even when it has nested items; an item is expandable only while it has nested items, so for children loaded on first expansion give it a placeholder child ("Loading…") until they arrive.

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
Trigger: Enter / Space / ArrowDown → open and focus the first item; ArrowUp → open and focus the last
Menu:    ArrowDown / ArrowUp        → next / previous item (wrapping); Home / End; typeahead (labels)
         Enter / Space              → activate the item (closes the menu unless persistOnClick)
         Escape                     → close and return focus to the trigger
         Tab                        → close; focus continues from the trigger
```

#### Dialog and Drawer

```
Tab / Shift+Tab → cycle through the dialog's focusable elements (trapped; toasts included)
Escape          → close (only the topmost layer: an open listbox inside closes first, and a
                  SpinButton with typed text or a SearchBox with text consumes it)
```

Focus moves into the dialog on open (the first focusable element, unless something inside already has focus, such as an `autoFocus` input; that also holds for a dialog opened over another one or nested in its content, and for a `Popover.Content` opened from a dialog). Tab inside a plain `<Portal>` rendered in the dialog moves natively between the portal's elements and wraps to the dialog's first or last element at the portal's edges. On close it goes to `finalFocusRef` when given, else back to the element that had focus when the dialog opened (a trigger's wrapper span resolves to the element inside it): the trigger for a trigger click, the parent's own button of a controlled Dialog, or a text field focused before a keyboard-shortcut open. When nothing had focus (opened from code, or a Safari click), it goes to the trigger that opened the dialog, else the first mounted trigger; when that element is gone, to a mounted trigger, then to an element next to where the opener was (the next row's action after a delete), then to the overlay below.

#### DatePicker calendar

```
Alt+ArrowDown (input)             → open the calendar
Arrow keys                        → previous / next day, previous / next week (mirrored in RTL)
PageUp / PageDown                 → previous / next month (day clamped to the month)
Shift+PageUp / Shift+PageDown     → previous / next year
Home / End                        → start / end of the week
Enter / Space                     → select the day
Escape                            → close and return focus
```

Typed text in the DatePicker input is kept and marked invalid when it is not an available date. When a controlled parent then selects another day, the rejected text is replaced by that date and the error cleared; switching the picker to `readOnly` or `disabled` while the user types drops the typed text.

#### Other components

- **SpinButton**: ArrowUp/ArrowDown step, PageUp/PageDown large step, Home/End min/max; Enter commits typed text, Escape reverts it.
- **SearchBox**: Escape clears the text and keeps focus; the key is consumed, so an enclosing Dialog, Drawer or Popover stays open. In an empty field Escape reaches them.
- **Rating**: Right/Up one star more, Left/Down one fewer (never below 1), Home/End first/last; mirrored in RTL.
- **Card** (selectable, `selectionControl="card"`): Enter (key down) or Space (key up).
- **Stepper**: every reachable step is a Tab stop; Enter/Space activate.
- **Tooltip, InfoLabel**: open on keyboard focus; Escape closes. Focus, blur and pointer entry inside a popup that the Tooltip's child renders in a portal (a DatePicker calendar, a listbox) do not show or hide the tooltip or reach its `onFocus`/`onBlur`; `onMouseEnter`/`onMouseLeave` follow React's tree. An icon-only trigger named by `Tooltip relationship="label"` also names a Popover it opens.
- **Popover, TeachingPopover**: Escape closes. When focus was inside (or lost to `<body>`), Popover returns it to its trigger, TeachingPopover to where focus was before it opened (with `target`, to the target when nothing had focus, such as a tour opened on page load; see [Focus Management](#focus-management)). In the Tab order the portaled content follows its trigger (TeachingPopover with `target`: the target), like inline content: Tab from the trigger enters it, Tab past its last element continues after the trigger, Shift+Tab from its first element returns to the trigger (or, when nothing in the trigger can take focus, to the tab stop before it), and Shift+Tab from the element after the trigger enters it at its last element. For a trigger outside the tab order the content follows the tab stop before the trigger; with no tab stop before the trigger or target, it is reached where it is portaled, at the end of the page, in both directions. A Tab lap visits the content once: Tab from the last element of the page moves past the portaled content (it is hidden for that one Tab) and leaves the page, and Shift+Tab from the browser's own controls reaches the page's last element (outside every open popover) instead of the content. Content that the Tab from the page end still reaches follows the document order, so Tab never cycles. Focus leaving it does not close it (Escape or an outside press does).
- **Accordion, Carousel, Nav, Breadcrumb, Pagination**: native buttons and links (Tab, Enter, Space); no arrow-key navigation.

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

Dialog and Drawer do **not** set `aria-modal`. While they are open, everything else on the page is made `inert` except the Toaster region and the announcement live regions, so the background is neither focusable, clickable nor readable while toasts stay available. The DatePicker calendar is a transient dialog that keeps `aria-modal="true"`. Name a dialog with `title`, `Dialog.Title`/`Drawer.Title`, `aria-label` or `aria-labelledby` (unnamed dialogs warn in development).

#### Navigation

```html
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home" aria-current="page">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

> Do not use `role="menubar"` / `role="menuitem"` for site navigation. Those roles are for application menus; site navigation needs only the `<nav>` landmark with plain links (`Nav`, `Breadcrumb`).

#### Tree

```html
<div role="tree" aria-label="File browser">
  <div role="treeitem" aria-expanded="true" aria-labelledby="label-src">
    <div><span id="label-src">src</span></div>
    <div role="group">
      <div role="treeitem" aria-labelledby="label-index"><div><span id="label-index">index.ts</span></div></div>
    </div>
  </div>
</div>
```

Each treeitem contains its label row and its child group, and is named by its label (not by its icon or nested items).

#### Live Regions (Toasts, Status)

```html
<!-- Polite: read when the user is idle -->
<div role="status">3 items selected</div>

<!-- Assertive: read immediately (errors) -->
<div aria-live="assertive">Error: failed to save</div>
```

Live regions must exist before their content changes. `Toaster` keeps two permanent, visually hidden regions (polite, and assertive for `error` toasts); the toasts themselves are not live regions. Use `announce(message, politeness?)` or `useAnnounce()` for your own announcements; they go through a shared region that modal isolation never makes inert.

### Focus Management

1. **Focus rings**: focusable controls use `focusRing` (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`), cells and rows `focusRingInset`; text inputs show a primary bottom border (`inputFocus`) with `focus:outline-hidden`, which keeps an outline in forced-colors mode. Never use `focus:outline-none`.
2. **Moving focus into overlays**: Dialog and Drawer focus their first focusable element (or keep an `autoFocus` element, also when stacked over or nested in another dialog, and in a popover opened from one), Menu focuses its first item, the DatePicker calendar its focused day. Build custom overlays on these components rather than re-implementing traps.
3. **Focus restoration**: when an overlay closes, focus returns to where it came from. Dialog and Drawer use `finalFocusRef` when given, else the element that was focused when they opened (the trigger, for a trigger click; a trigger's wrapper span resolves to the element inside it), or a trigger when nothing had focus. When that element is gone, focus goes to a mounted trigger, then to the element next to where the opener was (the next row's action after a delete), then to the overlay below. Popovers and menus return focus to their trigger (TeachingPopover: to where focus was) when focus was inside them (or lost to `<body>`) at close. When a focused element disappears (a SearchBox clear button, a removed toast, a boundary button), the component moves focus somewhere sensible instead of dropping it to `<body>`.
4. **Focus trapping**: Dialog and Drawer trap Tab, including the Toaster region and overlays opened from them. Tab inside a plain `<Portal>` rendered in a dialog is native and wraps to the dialog's first or last element at the portal's edges. Focus that lands outside the trap is returned in a microtask after the `focusin`.
5. **Skip links**: for content-heavy pages, provide a "Skip to main content" link.

### Forced Colors (Windows High Contrast)

Background colors are replaced and box shadows removed in forced-colors mode, so state that is shown only by a background fades away. Wave's components add Tailwind `forced-colors:` variants with system colors:

- `src/lib/styles.ts` `forcedColors` recipes: `selectedLeaf` (`Highlight`/`HighlightText` with `forced-color-adjust: none`, for leaf indicators only: the Switch thumb, check glyphs, the ProgressBar fill, the selected day), `selectedContainer` (a `Highlight` outline for selected options, rows and cards), `control` (`ButtonText` borders), `border` (`CanvasText`), `fill` (a `Highlight` background with `forced-color-adjust: none`, for leaf indicators drawn with their own background: step and pager dots, connectors), `rangeInput` (a native range input: rail `CanvasText`, thumb `Highlight`, `GrayText` while disabled, a `Highlight` focus outline), `ringArc` (a border-drawn ring: the arc `Highlight` on a `Canvas` track) and `disabled` (`GrayText`).
- Components with forced-colors styling include Switch, Checkbox, RadioGroup, SwatchPicker, Slider, ProgressBar, Spinner, Skeleton (`GrayText` placeholders), DatePicker, TimePicker, Select, listbox options, List, Tree, Card, DataGrid, Pagination, Stepper (completed connectors `Highlight`, the others `CanvasText`), Carousel, TeachingPopover (step dots), PresenceBadge and the Button family (every Button appearance draws a 1px border, so it keeps an edge). Dialog and Drawer draw a 1px border, so their edge stays visible where the shadow disappears.
- Text inputs use `focus:outline-hidden`, which Tailwind turns into a visible outline in forced colors.

**System color keywords**: `Canvas`, `CanvasText`, `LinkText`, `Highlight`, `HighlightText`, `ButtonFace`, `ButtonText`, `GrayText`.

The **high-contrast theme** (`WaveProvider theme="high-contrast"`) is a separate, Wave-drawn theme (not forced colors): background `#000000`, foreground `#ffffff`, primary `#1aebff` (cyan, with black text), focus ring `#ffff00`, error `#ff6e6e`, selected surfaces `#003a40` with white text.

### Screen Reader Best Practices

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<table>`) over `div` + `role`
- Every image needs `alt` text (`alt=""` for decorative images); `Image` warns in development without `alt`, and `StrictImageProps` requires it at compile time
- Form controls need a label: wrap them in `Field`, or pass `aria-label`/`aria-labelledby`
- Group related controls with `<fieldset>` + `<legend>` (or `role="group"` + `aria-label`)
- Validation errors: `Field`'s `error`, or `error="…"` on Input/Select/Textarea, render a `role="alert"` message linked with `aria-describedby`
- Hide decorative elements with `aria-hidden="true"` (Wave's icon slots do it for you)
- Name progress indicators and landmarks: `ProgressBar` `label`, `Spinner` `label` (default "Loading"), `Toolbar` and `Nav` `aria-label`
- Translate the names and hidden texts components render themselves: `closeLabel` (Dialog.Content, Drawer, TeachingPopover), `statusLabel` (MessageBar, Toast), `dismissLabel` (Toast, `dispatchToast` options, Tag), Carousel `labels` and `autoPlayLabels`, Stepper `statusLabels`, Pagination `getItemAriaLabel`, and the `labels` objects of ColorPicker, Combobox, DataGrid, DatePicker, Rating, SpinButton, TagPicker, TeachingPopover and TimePicker (the README's "Built-in text" lists every one)

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
- `useWaveTheme()` returns `{ theme, dir, themeClassName, portalContainer, hasProvider }`.
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
- Labels above controls (not inline, unless it is a horizontal form)
- `required` on the Field shows a decorative `*`, sets `aria-required` and turns on the browser's constraint validation: native inputs get the native `required` attribute, and choice and picker controls (Checkbox, Switch, RadioGroup, Dropdown, DatePicker, …) render a required hidden input, so the form does not submit while the control is empty, unchecked or off. A form that shows its own errors on submit, like the one above, sets `noValidate`
- A `readOnly` Combobox, TagPicker, DatePicker or TimePicker does not block the submit, like a native read-only input (it keeps `aria-required`)
- Field's `error` renders the message below the control in a `role="alert"` element and marks the control invalid (a control's own `aria-invalid={false}` wins, and the error still describes it); `hint` describes it. A `label`, `hint` or `error` that renders nothing (an empty `errors.map(…)`) counts as absent
- One control per Field; wrap layout or wrapper components (a Tooltip) in a plain `<div>` inside the Field
- Primary action button end-aligned, or full-width on mobile

### Navigation Patterns

**Sidebar navigation (Nav)**:

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

The category that contains the selected item (`value` or `defaultValue`) starts open; `defaultOpenCategories` (even `[]`) replaces that, and `openCategories`/`onOpenCategoriesChange` control it. A click that opens a link elsewhere (Ctrl/Cmd/Shift/Alt-click, a mouse button other than the main one, a `target` other than `_self`, a `download` link) selects nothing, unless the item's `onClick` calls `preventDefault()` (client-side routing): the browser then opens nothing elsewhere, and the item is selected. Item values (items and sub-items share them) and category values are unique; a duplicate warns in development.

**Breadcrumb**:

```tsx
<Breadcrumb>
  <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
  <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
  <Breadcrumb.Item current>Widget A</Breadcrumb.Item>
</Breadcrumb>
```

Each element of a Fragment child (`{isAdmin && <>…</>}`) becomes its own crumb with a separator. With `asChild`, the item's props merge onto your element, and its `href` is passed as a default (the element's own `href` wins); give a router link its destination (`to`) on the link itself.

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

Use `Menu.Trigger` + `Menu.Popover` for menu buttons (not `Popover`, which has no menu semantics). For a `SplitButton`, pass the render-prop props of `Menu.Trigger` to `menuButtonProps`.

### Data Display Patterns

**Sortable DataGrid** (sorting is controlled: reorder the rows yourself):

```tsx
import * as React from 'react';
import { Badge, DataGrid } from '@mortenbrudvik/waveui';
import type { DataGridSort } from '@mortenbrudvik/waveui';

const users = [
  { id: '1', name: 'Alice', active: true },
  { id: '2', name: 'Bob', active: false },
];

export function Users() {
  const [sort, setSort] = React.useState<DataGridSort | null>({ columnId: 'name', direction: 'ascending' });
  const rows = [...users].sort((a, b) =>
    sort?.direction === 'descending' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
  );
  return (
    <DataGrid aria-label="Users" sort={sort} onSortChange={setSort}>
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell columnId="name" sortable>
            Name
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="status">Status</DataGrid.HeaderCell>
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>
        {rows.map((user) => (
          <DataGrid.Row key={user.id} rowId={user.id}>
            <DataGrid.Cell>{user.name}</DataGrid.Cell>
            <DataGrid.Cell>
              <Badge appearance="tint" color={user.active ? 'success' : 'informative'}>
                {user.active ? 'Active' : 'Inactive'}
              </Badge>
            </DataGrid.Cell>
          </DataGrid.Row>
        ))}
      </DataGrid.Body>
    </DataGrid>
  );
}
```

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

`rowId`s of a DataGrid, `value`s of a selectable List and `itemId`s of an Overflow are unique: items that share one are selected (or hidden) together, and a development warning names the duplicate.

### Feedback Patterns

**Toast notifications** — wrap the app in `<Toaster>` and call `useToastController()` below it:

```tsx
import { Button, Toaster, useToastController } from '@mortenbrudvik/waveui';

function SaveButton() {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast({
          status: 'success',
          title: 'Saved',
          body: 'Your changes have been saved.',
          timeout: 5000,
        })
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

A sibling `<Toaster />` does not work: `useToastController()` outside a Toaster throws in development. Toast timers pause while a toast is hovered or focused and while the page is in the background (the window has lost focus, or the tab is hidden, also when the Toaster mounted there). `dismissLabel` and `statusLabel` in the `dispatchToast` options translate the dismiss button's name and the hidden status text.

**Dialog confirmation** — `Dialog.Footer` goes inside `Dialog.Content`:

```tsx
import * as React from 'react';
import { Button, Dialog } from '@mortenbrudvik/waveui';

export function ConfirmDelete({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button>Delete</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Delete item?">
        <p>This action cannot be undone.</p>
        <Dialog.Footer>
          <Dialog.Close>
            <Button>Cancel</Button>
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
</>
```

### Component Selection Guide

| Need | Component |
|------|-----------|
| Trigger an action | `Button`, `CompoundButton`, `SplitButton` |
| Navigate to a page | `Link`, `Breadcrumb`, `Nav`, `Pagination` |
| Single-line text input | `Input`, `SearchBox` |
| Multi-line text input | `Textarea` |
| Select from options | `Dropdown` (select-only), `Combobox` (type to filter), `Select` (native) |
| Pick multiple items | `TagPicker`, `Checkbox` group, selectable `List` |
| Boolean toggle | `Switch`, `Checkbox`, `ToggleButton` |
| Choose one from few | `RadioGroup` |
| Pick a number | `Slider`, `SpinButton` |
| Pick a color | `ColorPicker`, `SwatchPicker` |
| Show user identity | `Avatar`, `AvatarGroup`, `Persona` |
| Categorize items | `Badge`, `Tag`, `CounterBadge` |
| Show status | `PresenceBadge`, `MessageBar` |
| Display data | `Table`, `DataGrid`, `List` |
| Organize content | `Card`, `Accordion`, `TabList`, `Tree`, `Grid`, `Stack`, `Flex` |
| Overlay content | `Dialog`, `Drawer`, `Popover`, `Tooltip` |
| Offer actions in a popup | `Menu` with `MenuButton` or `SplitButton` |
| Show progress | `Spinner`, `ProgressBar`, `Skeleton` |
| Notify users | `Toast` / `Toaster`, `MessageBar` |
| Pick a date | `DatePicker` |
| Pick a time | `TimePicker` |
| Guide users | `TeachingPopover` |
| Show step progress | `Stepper` |
| Handle overflow | `Overflow` / `OverflowItem` |
| Browse content | `Carousel` |
| Rate items | `Rating`, `RatingDisplay` |
| Label fields | `Label`, `InfoLabel`, `Field` |

---

## 12. Quick Reference

### Component Catalog (65 components)

**Buttons & Actions** (7)
`Button` `CompoundButton` `ToggleButton` `SplitButton` `MenuButton` `Link` `Toolbar`

**Input & Forms** (19)
`Input` `Textarea` `Field` `Label` `Checkbox` `RadioGroup` `Switch` `Select` `SearchBox` `Slider` `SpinButton` `Combobox` `Dropdown` `TagPicker` `Rating` `ColorPicker` `SwatchPicker` `DatePicker` `TimePicker` (plus `RadioGroup.Item`/`RadioItem`, `Option`/`OptionGroup` and `RatingDisplay`)

**Data Display** (11)
`Avatar` `AvatarGroup` `Badge` `PresenceBadge` `CounterBadge` `Tag` `Persona` `Divider` `InfoLabel` `Image` `List`

**Layout** (9)
`Card` `Accordion` `TabList` `Tree` `Carousel` `Overflow` `Grid` `Stack` `Flex`

**Navigation** (5)
`Breadcrumb` `Menu` `Nav` `Stepper` `Pagination`

**Feedback** (5)
`MessageBar` `ProgressBar` `Spinner` `Skeleton` `Toast`/`Toaster`

**Overlays** (5)
`Dialog` `Popover` `Tooltip` `Drawer` `TeachingPopover`

**Table** (2)
`Table` `DataGrid`

**Typography** (1)
`Text`

**Provider** (1)
`WaveProvider` (plus the `Portal` utility)

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
| `src/lib/composeEventHandlers.ts` | Consumer + internal handler composition |
| `src/hooks/useControllable.ts` | Controlled/uncontrolled state hook |
| `src/hooks/useRovingTabIndex.ts` | Roving tab index for composite widgets |
| `src/hooks/useFieldControl.ts` | `FieldContext` and the Field wiring for controls |
| `src/hooks/useListbox.ts` | Listbox model of Combobox, Dropdown, TagPicker and TimePicker (internal) |
| `src/hooks/useDismiss.ts`, `src/lib/layers.ts` | Layered Escape and outside-press dismissal (internal) |
| `src/components/provider/WaveProvider.tsx` | Theme provider |
| `src/components/portal/Portal.tsx` | Themed portal |
| `src/test-utils.ts`, `src/test-utils-field.tsx` | Shared test helpers |

### Keyboard Pattern Cheat Sheet

| Widget | Enter group | Navigate | Activate | Leave |
|--------|------------|----------|----------|-------|
| Button | Tab | – | Enter/Space | Tab |
| Toolbar | Tab (last focused control) | Left/Right (Up/Down vertical), Home/End | Enter/Space | Tab |
| RadioGroup, SwatchPicker | Tab (selected item) | All arrows, Home/End | Selects on move | Tab |
| Tabs | Tab (selected tab) | Left/Right (Up/Down vertical), Home/End | Selects on move | Tab |
| Combobox, TagPicker, TimePicker | Tab | Down/Up (open and move) | Enter | Escape / Tab |
| Dropdown | Tab | Down/Up/Home/End, typeahead, PageUp/PageDown | Enter/Space | Escape / Tab (commits) |
| Menu | Enter/Space/Down on the trigger | Up/Down, Home/End, typeahead | Enter/Space | Escape / Tab |
| Tree | Tab (selected item) | Up/Down, Left/Right (collapse/expand), Home/End, typeahead | Enter/Space | Tab |
| List (selectable) | Tab | Up/Down, Home/End | Enter/Space (toggle) | Tab |
| DataGrid | Tab (one tab stop) | Arrows, Home/End, Ctrl+Home/End, PageUp/PageDown | Enter/F2 (into cell), Space (select row) | Tab / Escape (from cell widgets) |
| DatePicker calendar | Alt+Down on the input, or the toggle | Arrows, PageUp/PageDown, Shift+PageUp/PageDown, Home/End | Enter/Space | Escape |
| Dialog / Drawer | Auto-focus | Tab (trapped) | Enter | Escape |

*RadioGroup, SwatchPicker and Tabs use automatic activation: moving focus selects. Accordion, Carousel, Nav, Breadcrumb and Pagination use plain Tab navigation between native buttons and links.*

---

## 13. Deprecated APIs

Deprecated names still work in 0.5, warn once in development and will be removed in 1.0. The CHANGELOG has the full table with callback semantics.

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
| DataGrid `sortColumn`, `sortDirection`, `defaultSortColumn`, `defaultSortDirection` | `sort`, `defaultSort` |
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

---

*This guide documents `@mortenbrudvik/waveui`, a React + Tailwind CSS implementation inspired by the Fluent UI 2 design language. It is **not** the official `@fluentui/react-components` package. For the official Microsoft library, see [Fluent UI React v9](https://react.fluentui.dev/); for the official design guidelines, see [Fluent 2 Design](https://fluent2.microsoft.design/).*
