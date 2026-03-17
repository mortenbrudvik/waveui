# wave-ui-react — Design & Development Guide

> **This documents our custom `wave-ui-react` library** — a standalone React + Tailwind CSS component library inspired by Fluent UI v2 design language, using CSS custom properties and utility classes. It is **not** the official `@fluentui/react-components` package from Microsoft.

A comprehensive reference for designing and building features with this library. Covers design principles, tokens, component architecture, accessibility, and common patterns.

### How This Differs from Official Fluent UI

| | **This library (`wave-ui-react`)** | **Official (`@fluentui/react-components`)** |
|---|---|---|
| **Styling** | Tailwind CSS + CSS variables (`tokens.css`) | Griffel CSS-in-JS + `makeStyles()` |
| **Class merging** | `cn()` (clsx + tailwind-merge) | `mergeClasses()` |
| **Theming** | CSS class toggle (`.dark`, `.high-contrast`) | `FluentProvider` with JS theme objects (690+ tokens) |
| **Slot system** | `resolveSlot()` / `renderSlot()` (lightweight) | `slot()` / `resolveShorthand()` (full Griffel integration) |
| **State hooks** | `useControllable()` | `useControllableState()` |
| **Keyboard nav** | `useRovingTabIndex` hook + manual per component | Tabster library integration |
| **Package** | Local codebase at `wave-ui-react/` | npm: `@fluentui/react-components` |

All component APIs, token values, and patterns described below refer to **this library's implementation**, not the official Microsoft package.

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

---

## 1. Design Principles

This library follows the **Wave UI design principles**, inspired by Fluent UI v2 design language — coherent, accessible, productivity-focused experiences. We adopt the visual language and interaction patterns, implemented with our own React + Tailwind CSS stack.

### Core Philosophy

- **Inclusive** - Designed for people of all abilities and circumstances
- **Productive** - Helps users accomplish tasks efficiently with minimal friction
- **Purposeful** - Every element serves a clear function; nothing is decorative without reason

### Design Pillars

| Pillar | Description |
|--------|-------------|
| **Clarity** | Content is king. Reduce visual noise. Use whitespace purposefully. |
| **Familiarity** | Leverage established patterns. Controls should behave as users expect. |
| **Consistency** | Same action = same appearance everywhere. Maintain visual rhythm. |
| **Adaptability** | Works across devices, input modes, screen sizes, and accessibility needs. |
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

All spacing in Wave UI derives from a **4px base unit**. Every margin, padding, gap, and size should be a multiple of 4px.

### Spacing Scale

| Token | Value | Tailwind | Usage |
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

### Content Density Modes

| Mode | Row height | Use case |
|------|-----------|----------|
| **Comfortable** | 36px | Default for most UIs |
| **Compact** | 24px | Data-dense views (tables, lists) |
| **Spacious** | 44px | Touch-first or accessibility contexts |

### Responsive Breakpoints

| Name | Width | Typical use |
|------|-------|-------------|
| `sm` | 320px | Mobile portrait |
| `md` | 480px | Mobile landscape |
| `lg` | 640px | Small tablet |
| `xl` | 1024px | Tablet / small desktop |
| `xxl` | 1366px | Standard desktop |
| `xxxl` | 1920px | Large desktop |

### Layout Guidelines

- Use CSS Grid or Flexbox; avoid absolute positioning for layout
- Main content areas should not exceed 1200px width (readability)
- Side panels: 320px default width
- Navigation rail: 48px collapsed, 280px expanded
- Keep consistent gutter widths within a layout (typically 16px or 24px)

---

## 3. Typography

### Font Stack

```css
font-family: 'Segoe UI', 'Segoe UI Web (West European)', -apple-system,
  BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif;
```

Tailwind: Use `font-sans` (configured in `tailwind.config.ts`).

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

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text, descriptions |
| Semibold | 600 | Headings, labels, emphasis |
| Bold | 700 | Strong emphasis (use sparingly) |

### Typography Best Practices

- **body-1 (14px)** is the default for all UI text
- Use **at most 3 type styles** on a single screen to maintain hierarchy
- Line length: 50-75 characters for body text readability
- Don't use font size alone for hierarchy; combine with weight and color
- Use the `Text` component with `variant` prop for semantic typography

---

## 4. Color System

### Three-Layer Token Architecture

```
Global Tokens  →  Alias Tokens  →  Component Tokens
(raw values)      (semantic)       (specific use)

grey-14: #242424  →  foreground  →  button-foreground
brand-80: #0f6cbd →  primary     →  button-primary-bg
```

- **Global tokens**: Raw color values (grey palette, brand ramp). Never use directly in components.
- **Alias tokens**: Semantic names (`--foreground`, `--primary`, `--border`). Use these in components.
- **Component tokens**: Scoped to specific components. Built from alias tokens.

### Alias Tokens (CSS Variables)

Defined in `src/styles/tokens.css`, mapped to Tailwind in `tailwind.config.ts`:

| Token | Light | Dark | Tailwind | Usage |
|-------|-------|------|----------|-------|
| `--background` | `#ffffff` | `#292929` | `bg-background` | Page/app background |
| `--foreground` | `#242424` | `#ffffff` | `text-foreground` | Primary text color |
| `--primary` | `#0f6cbd` | `#479ef5` | `bg-primary` | Brand actions, links |
| `--secondary` | `#f5f5f5` | `#333333` | `bg-secondary` | Secondary surfaces |
| `--muted` | `#f0f0f0` | `#383838` | `bg-muted` | Subtle backgrounds |
| `--muted-foreground` | `#707070` | `#adadad` | `text-muted-foreground` | Secondary text |
| `--accent` | `#0f6cbd` | `#479ef5` | `bg-accent` | Accent elements |
| `--card` | `#fafafa` | `#333333` | `bg-card` | Card surfaces |
| `--destructive` | `#c50f1f` | `#dc626d` | `bg-destructive` | Dangerous actions |
| `--border` | `#e0e0e0` | `#666666` | `border-border` | Borders, dividers |
| `--input` | `#d1d1d1` | `#666666` | `border-input` | Input field borders |
| `--ring` | `#0f6cbd` | `#479ef5` | `ring-ring` | Focus rings |
| `--subtle` | `transparent` | `transparent` | `bg-subtle` | Ghost/subtle backgrounds |

Each surface/interactive color also has a companion **foreground** token for text on that surface:
`text-primary-foreground` (#ffffff), `text-secondary-foreground`, `text-card-foreground`, `text-accent-foreground` (#ffffff), `text-destructive-foreground` (#ffffff).

### Status Colors

| Status | Light | Dark | Usage |
|--------|-------|------|-------|
| `--success` | `#107c10` | `#54b054` | Completed, passed, online |
| `--warning` | `#fde300` | `#fde300` | Caution, pending |
| `--error` | `#c50f1f` | `#dc626d` | Errors, failures, critical |
| `--info` | `#0f6cbd` | `#479ef5` | Informational |
| `--severe` | `#da3b01` | `#e97548` | Severe warnings |

### Brand Color Ramp

The brand ramp provides 16 shades (indexed 10-160) from darkest to lightest:

```
10 ████ #061724  (darkest — text on light bg)
20 ████ #082338
30 ████ #0a2e4a
40 ████ #0c3b5e
50 ████ #0e4775
60 ████ #0f548c
70 ████ #115ea3  (dark variant — hover states)
80 ████ #0f6cbd  ← PRIMARY (light theme)
90 ████ #2886de
100 ████ #479ef5  ← PRIMARY (dark theme)
110 ████ #62abf5
120 ████ #77b7f7
130 ████ #96c6fa
140 ████ #b4d6fa  (tint backgrounds)
150 ████ #cfe4fa
160 ████ #ebf3fc  (lightest — subtle tints)
```

**Usage pattern**: Use brand-80 for primary actions in light theme, brand-100 in dark theme. Use brand-70 for hover, brand-60 for pressed states.

### Neutral Grey Palette

29 grey values from `grey-2` (#050505) to `grey-98` (#fafafa). Key stops:

| Token | Hex | Common use |
|-------|-----|------------|
| `grey-14` | `#242424` | Default foreground (light) |
| `grey-38` | `#616161` | Secondary text |
| `grey-44` | `#707070` | Muted foreground |
| `grey-82` | `#d1d1d1` | Input borders |
| `grey-88` | `#e0e0e0` | Dividers, borders |
| `grey-94` | `#f0f0f0` | Muted backgrounds |
| `grey-96` | `#f5f5f5` | Hover states |
| `grey-98` | `#fafafa` | Card backgrounds |

### Color Usage Rules

1. **Never use raw hex values** in components — always reference CSS variables or Tailwind tokens
2. **Never use color alone** to convey information (add icons, text, or patterns)
3. **Contrast ratios**: Text must meet WCAG AA (4.5:1 normal, 3:1 large text)
4. **Limit palette**: Use 3-5 colors max on any single screen
5. **Brand color**: Reserve for primary actions and key interactive elements

---

## 5. Elevation & Shadows

Wave UI uses a **dual-layer shadow** model simulating ambient light (diffuse) + key light (directional).

### Shadow Levels

| Level | Token | CSS Value | Usage |
|-------|-------|-----------|-------|
| **2** | `shadow-2` | `0 0 2px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.14)` | Cards at rest, subtle lift |
| **4** | `shadow-4` | `0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)` | Cards on hover, menus |
| **8** | `shadow-8` | `0 0 2px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.14)` | Popovers, dropdowns, teaching callouts |
| **16** | `shadow-16` | `0 0 2px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.14)` | Dialogs, drawers |
| **28** | `shadow-28` | `0 0 8px rgba(0,0,0,0.12), 0 14px 28px rgba(0,0,0,0.14)` | Full-screen overlays |
| **64** | `shadow-64` | `0 0 8px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.14)` | Topmost layers (rarely used) |

### Elevation Guidelines

- **Surfaces at rest**: shadow-2 or no shadow (flat)
- **Interactive hover**: Increase by one level (e.g., shadow-2 → shadow-4)
- **Floating elements**: shadow-8 (dropdowns, tooltips, popovers)
- **Modal overlays**: shadow-16 or shadow-28
- Use elevation intentionally — avoid stacking multiple shadow levels close together
- In dark theme, shadows are less visible; rely more on borders for separation

---

## 6. Motion & Animation

### Duration Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `ultra-fast` | 50ms | Micro-interactions (checkbox tick) |
| `faster` | 100ms | Small transitions (color change, opacity) |
| `fast` | 150ms | Standard hover/focus transitions |
| `normal` | 200ms | Default animation duration |
| `gentle` | 250ms | Deliberate transitions |
| `slow` | 300ms | Large element transitions |
| `slower` | 400ms | Page transitions |
| `ultra-slow` | 500ms | Dramatic entrances |

### Easing Curves

| Curve | CSS Value | Usage |
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

> **Note**: These easing curves are CSS reference values for use in inline styles or custom CSS. They are not configured as Tailwind utility classes.

### Motion Patterns

- **Enter**: Use `decelerate-mid` + 200-300ms. Element slides/fades in, decelerating to rest.
- **Exit**: Use `accelerate-mid` + 100-200ms. Element accelerates away. Faster than enter.
- **Hover/focus**: Use `easy-ease` + 100-150ms. Quick, responsive feedback.
- **Layout shift**: Use `easy-ease` + 200ms. Smooth repositioning.

### Reduced Motion

The library includes a `prefers-reduced-motion` media query in `animations.css` that automatically disables animations and transitions for users who prefer reduced motion (WCAG 2.1 SC 2.3.3):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

For JS-driven animations, check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before triggering.

### Codebase Animations

Defined in `tailwind.config.ts`:

| Class | Keyframe | Duration | Usage |
|-------|----------|----------|-------|
| `animate-wave-spin` | 360deg rotation | 0.8s linear infinite | Spinner component |
| `animate-wave-pulse` | Opacity 1→0.4→1 | 1.5s ease-in-out infinite | Skeleton loading |
| `animate-wave-indeterminate` | translateX(-100%→350%) | 1.5s ease-in-out infinite | Progress bar |

---

## 7. Iconography

### Fluent System Icons (External Dependency)

> **Note**: Icons are **not bundled** in this library. The recommended icon package is `@fluentui/react-icons` (from the official Fluent UI ecosystem by Microsoft), which can be installed separately via npm.

- **Package**: `@fluentui/react-icons` (optional, install separately)
- **Catalog**: 4000+ icons
- **Two styles**: Regular (outlined, 1px stroke) and Filled (solid)
- **5 sizes**: 16px, 20px, 24px (default), 28px, 48px

### Icon Usage Guidelines

| Context | Size | Style |
|---------|------|-------|
| Inline with body text | 16px | Regular |
| Button icons | 20px | Regular |
| Standalone / navigation | 24px | Regular |
| Large emphasis | 28-48px | Filled |
| Active/selected state | Same | Switch Regular → Filled |

### Best Practices

- Use Regular icons by default; Filled for active/selected states
- Always pair icons with visible text labels (or `aria-label` for icon-only buttons)
- Don't mix icon styles within the same toolbar/section
- Set `aria-hidden="true"` on decorative icons that have adjacent text
- Use the `role="img"` + `aria-label` pattern for meaningful standalone icons

---

## 8. Component Architecture

### Pattern 1: forwardRef + displayName

Every component uses `React.forwardRef` and sets `displayName`:

```tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  appearance?: 'primary' | 'outline' | 'subtle' | 'transparent';
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ appearance = 'secondary', size = 'medium', className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn('...base classes...', className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
```

**Key points**:
- Props interface extends the native HTML element attributes
- Destructure with defaults, spread `...rest` onto the element
- `ref` is forwarded to the root DOM element
- `className` is merged using `cn()` — user classes always win
- `displayName` is always set (required for DevTools and testing)

### Pattern 2: Compound Components (Object.assign)

Complex components expose sub-components as static properties:

```tsx
const CardRoot = React.forwardRef<HTMLDivElement, CardProps>(/* ... */);
CardRoot.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(/* ... */);
CardHeader.displayName = 'Card.Header';

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
```

**Usage**: `<Card><Card.Header>...</Card.Header></Card>`

Components using this pattern: `Card`, `Accordion`, `TabList`, `DataGrid`, `Menu`, `Dialog`, `Popover`, `Carousel`, `Nav`, `Tree`, `Table`

### Pattern 3: Slot System

The slot system allows users to customize sub-elements without full component replacement:

```tsx
import { resolveSlot, renderSlot, Slot } from '../../lib/slot';

interface InfoLabelProps {
  icon?: Slot<'span'>;  // accepts ReactNode or { as, className, children, ... }
}

// Inside component:
const iconSlot = renderSlot(icon, 'span', 'text-info h-4 w-4');
```

**Slot value types**:
- `string | number` → Rendered as children inside default element
- `ReactElement` → Rendered as-is
- `{ as?, children?, className?, style?, ...rest }` → Full customization
- `null | undefined | false` → Not rendered

### Pattern 4: Controlled / Uncontrolled (useControllable)

```tsx
import { useControllable } from '../../hooks/useControllable';

const [value, setValue] = useControllable(
  controlledValue,  // undefined = uncontrolled
  defaultValue,     // initial value for uncontrolled mode
  onChange,          // callback fired on every change
);
```

**Rules**:
- If `controlledValue` is provided, component is controlled
- `setValue` always calls `onChange`, only updates internal state if uncontrolled
- Never switch between controlled and uncontrolled (warns in dev)
- `setValue` accepts a value `T`, not a functional updater `(prev: T) => T`

### Pattern 5: cn() Utility

Combines `clsx` (conditional classes) + `tailwind-merge` (deduplication):

```tsx
import { cn } from '../../lib/cn';

// Merges classes, last wins for conflicts
cn('px-4 py-2', size === 'large' && 'px-6 py-3', className)
// If className='px-8', result: 'py-3 px-8' (px-8 wins)
```

### Pattern 6: useId Hook

Generates stable unique IDs for ARIA relationships:

```tsx
const listboxId = useId('combobox-listbox');
// → "combobox-listbox-:r1:" (stable across renders)
```

### Props Interface Conventions

- Extend native HTML attributes: `React.HTMLAttributes<HTMLDivElement>`
- Omit conflicting native props: `Omit<React.HTMLAttributes<...>, 'onChange'>`
- Use shared types from `src/lib/types.ts`: `Size`, `Appearance`, `Status`
- Export both the component and its props type
- Prefix sub-component types: `CardHeaderProps`, `DataGridRowProps`

---

## 9. Accessibility

### WCAG 2.1 AA Requirements

| Criterion | Requirement |
|-----------|-------------|
| **Color contrast** | 4.5:1 for normal text, 3:1 for large text (18px+ or 14px bold) |
| **Non-text contrast** | 3:1 for UI components and graphical objects |
| **Touch targets** | Minimum 44x44px for interactive elements |
| **Keyboard access** | All functionality available via keyboard |
| **Focus visible** | Focus indicators must be clearly visible |
| **Text resizing** | Content usable at 200% zoom |
| **Motion** | Respect `prefers-reduced-motion` |

### Keyboard Navigation Patterns

#### Roving Tabindex (Toolbars, RadioGroups, Tabs)

Implemented via the `useRovingTabIndex` hook. RadioGroup and TabList use this pattern:

```
Tab → enters the group (focuses active/first item)
Arrow keys → move within the group (and select)
Home/End → jump to first/last item
Tab → exits the group
```

Only one item in the group has `tabIndex={0}`; others have `tabIndex={-1}`. Items use `data-roving-value` attributes for focus targeting.

#### Combobox / Dropdown

```
Tab → focuses input
Type → filters options (freeform mode)
ArrowDown → opens list, moves to next option
ArrowUp → moves to previous option
Enter → selects highlighted option
Escape → closes list
```

#### Tree View

```
Tab → focuses tree
ArrowDown → next visible node
ArrowUp → previous visible node
ArrowRight → expand node / move to first child
ArrowLeft → collapse node / move to parent
Enter/Space → activate node
Home → first node
End → last visible node
```

#### DataGrid / Table

```
Tab → enters grid (focuses first cell)
Arrow keys → navigate cells
Enter → activate cell / enter edit mode
Escape → exit edit mode
Home → first cell in row
End → last cell in row
Ctrl+Home → first cell in grid
Ctrl+End → last cell in grid
```

#### Dialog

```
Tab → cycles through focusable elements (trapped)
Shift+Tab → reverse cycle
Escape → close dialog
```

#### Carousel

```
Tab → focuses navigation controls
ArrowLeft/ArrowRight → previous/next slide
Enter/Space → activate slide
```

### ARIA Patterns

#### Combobox (freeform text input + list)

```html
<input role="combobox"
  aria-expanded="true|false"
  aria-controls="listbox-id"
  aria-autocomplete="list"
  aria-activedescendant="option-id" />
<ul id="listbox-id" role="listbox">
  <li role="option" aria-selected="true">Selected item</li>
  <li role="option" aria-selected="false">Other item</li>
</ul>
```

> **Note**: The `Dropdown` component (select-only, no text input) uses a `<button>` trigger with `aria-haspopup="listbox"` instead of the combobox pattern above. The combobox pattern applies to the `Combobox` component which has a freeform `<input>`.

#### Dialog

```html
<div role="dialog" aria-labelledby="title-id" aria-modal="true">
  <h2 id="title-id">Dialog Title</h2>
  <!-- content -->
</div>
```

#### Navigation

```html
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

> **Note**: Do not use `role="menubar"` / `role="menuitem"` for site navigation. Those roles are for application menu widgets (like a desktop app menu bar). Standard site navigation needs only the `<nav>` landmark with plain links.

#### Tree

```html
<ul role="tree" aria-label="File browser">
  <li role="treeitem" aria-expanded="true">
    Folder
    <ul role="group">
      <li role="treeitem">File.txt</li>
    </ul>
  </li>
</ul>
```

#### Live Regions (Toasts, Status)

```html
<!-- Polite: announced when user is idle -->
<div role="status" aria-live="polite">3 items selected</div>

<!-- Assertive: announced immediately (errors, alerts) -->
<div role="alert" aria-live="assertive">Error: Failed to save</div>
```

### Focus Management

1. **focus-visible**: Use CSS `:focus-visible` (not `:focus`) for keyboard-only focus rings
   ```css
   .element:focus-visible {
     outline: 2px solid var(--ring);
     outline-offset: 2px;
   }
   ```

2. **Programmatic focus**: When new content appears (dialog, drawer), move focus to the first focusable element:
   ```tsx
   useEffect(() => {
     if (open) {
       const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
         'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
       );
       firstFocusable?.focus();
     }
   }, [open]);
   ```

3. **Focus restoration**: When closing overlays, return focus to the trigger element

4. **Focus trapping**: Dialogs must trap Tab within their content (cycle first ↔ last focusable)

5. **Skip links**: For content-heavy pages, provide "Skip to main content" link

### High Contrast Mode

Support Windows High Contrast via `forced-colors` media query:

```css
@media (forced-colors: active) {
  .button {
    border: 1px solid ButtonText;  /* System color keywords */
    background: ButtonFace;
    color: ButtonText;
  }
  .button:focus {
    outline: 2px solid Highlight;
  }
}
```

**System color keywords**: `Canvas`, `CanvasText`, `LinkText`, `Highlight`, `HighlightText`, `ButtonFace`, `ButtonText`, `GrayText`

Our high-contrast theme (`tokens.css` `.high-contrast` class) uses:
- Background: `#000000` (pure black)
- Foreground: `#ffffff` (pure white)
- Primary: `#1aebff` (cyan)
- Focus ring: `#ffff00` (yellow)
- Error: `#ff6060` (bright red)

### Screen Reader Best Practices

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<table>`) over `div` + `role`
- Every `<img>` needs `alt` text (or `alt=""` + `aria-hidden="true"` if decorative)
- Form inputs need associated `<label>` elements (or `aria-label`)
- Group related controls with `<fieldset>` + `<legend>` (or `role="group"` + `aria-label`)
- Use `aria-describedby` for validation errors linked to inputs
- Hide decorative elements with `aria-hidden="true"`

---

## 10. Theming

### Theme Structure

The `WaveProvider` component wraps your app and provides theme context:

```tsx
import { WaveProvider } from 'wave-ui-react';

<WaveProvider theme="light" dir="ltr">
  <App />
</WaveProvider>
```

Themes are applied by adding CSS classes to the root element:
- `:root` → Light theme (default)
- `.dark` → Dark theme
- `.high-contrast` → High contrast theme

### Theme Tokens (tokens.css)

All design tokens are CSS custom properties. The full set:

```css
:root {
  /* Surface colors */
  --background: #ffffff;
  --foreground: #242424;
  --card: #fafafa;
  --muted: #f0f0f0;
  --muted-foreground: #707070;

  /* Interactive colors */
  --primary: #0f6cbd;
  --accent: #0f6cbd;
  --destructive: #c50f1f;
  --ring: #0f6cbd;

  /* Border colors */
  --border: #e0e0e0;
  --input: #d1d1d1;

  /* Status colors */
  --success: #107c10;
  --warning: #fde300;
  --error: #c50f1f;
  --info: #0f6cbd;
  --severe: #da3b01;

  /* Brand ramp: 16 shades */
  --brand-10 through --brand-160
}
```

### Tailwind ↔ Token Mapping

Configured in `tailwind.config.ts`, tokens map to Tailwind utilities:

```
bg-background  → var(--background)
text-foreground → var(--foreground)
bg-primary     → var(--primary)
border-border  → var(--border)
shadow-4       → dual-layer shadow
text-body-1    → 14px/20px
rounded        → 4px (Wave default)
```

### Creating Custom Brand Colors

To create a custom brand, generate a 16-stop ramp from a single primary color:

1. Start with your primary color (e.g., `#0f6cbd`)
2. Generate darker stops (10-70) by reducing lightness
3. Use primary as stop 80
4. Generate lighter stops (90-160) by increasing lightness
5. Update `--brand-*` CSS variables

See `skills/brand-guidelines/brands/fluentui.json` for the complete brand token structure.

### Border Radius Scale

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `none` | 0 | `rounded-none` | No rounding |
| `small` | 2px | `rounded-sm` | Subtle rounding |
| `medium` | 4px | `rounded` / `rounded-md` | **Default** (buttons, inputs, cards) |
| `large` | 6px | `rounded-lg` | Larger components |
| `xlarge` | 8px | `rounded-xl` | Dialogs, panels |
| `xxlarge` | 12px | `rounded-2xl` | Large panels |
| `xxxlarge` | 16px | `rounded-3xl` | Extra-large surfaces |
| `circular` | 10000px | `rounded-full` | Avatars, pills, badges |

---

## 11. Common UI Patterns

### Form Layout

```tsx
<form>
  <Field label="Name" required validationMessage={error}>
    <Input placeholder="Enter name" value={name} onChange={setName} />
  </Field>
  <Field label="Email">
    <Input type="email" />
  </Field>
  <Field label="Role">
    <Dropdown placeholder="Select role">
      <Dropdown.Option value="admin">Admin</Dropdown.Option>
      <Dropdown.Option value="user">User</Dropdown.Option>
    </Dropdown>
  </Field>
  <Button appearance="primary" type="submit">Save</Button>
</form>
```

**Guidelines**:
- Stack fields vertically with `gap-4` (16px)
- Labels above inputs (not inline, unless horizontal form)
- Required fields show `*` indicator
- Validation messages appear below the input
- Primary action button right-aligned or full-width on mobile

### Navigation Patterns

**Sidebar Navigation (Nav)**:
```tsx
<Nav selectedValue={activePage}>
  <Nav.Item value="home" href="/home" icon={<HomeIcon />}>Home</Nav.Item>
  <Nav.Category value="settings">Settings
    <Nav.SubItem value="profile" href="/settings/profile">Profile</Nav.SubItem>
    <Nav.SubItem value="account" href="/settings/account">Account</Nav.SubItem>
  </Nav.Category>
</Nav>
```

**Breadcrumb**:
```tsx
<Breadcrumb>
  <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
  <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
  <Breadcrumb.Item current>Widget A</Breadcrumb.Item>
</Breadcrumb>
```

**Tabs**:
```tsx
<TabList selectedValue={tab} onTabSelect={setTab}>
  <TabList.Tab value="overview">Overview</TabList.Tab>
  <TabList.Tab value="details">Details</TabList.Tab>
  <TabList.Panel value="overview">Content here</TabList.Panel>
  <TabList.Panel value="details">Details here</TabList.Panel>
</TabList>
```

### Data Display Patterns

**Table with sorting**:
```tsx
<DataGrid>
  <DataGrid.Header>
    <tr>
      <DataGrid.HeaderCell columnId="name" sortable>Name</DataGrid.HeaderCell>
      <DataGrid.HeaderCell columnId="status">Status</DataGrid.HeaderCell>
    </tr>
  </DataGrid.Header>
  <DataGrid.Body>
    <DataGrid.Row rowId="1">
      <DataGrid.Cell>Alice</DataGrid.Cell>
      <DataGrid.Cell><Badge color="success">Active</Badge></DataGrid.Cell>
    </DataGrid.Row>
  </DataGrid.Body>
</DataGrid>
```

**List with selection**:
```tsx
<List selectable selectedItems={selected} onSelectionChange={setSelected}>
  <List.Item value="1">Item One</List.Item>
  <List.Item value="2">Item Two</List.Item>
</List>
```

### Feedback Patterns

**Toast notifications**:
```tsx
const { dispatchToast } = useToastController();

dispatchToast({
  status: 'success',
  title: 'Saved',
  body: 'Your changes have been saved.',
  timeout: 5000,
});

// In app root:
<Toaster position="bottom-right" />
```

**Dialog confirmation**:
```tsx
<Dialog open={showConfirm} onOpenChange={setShowConfirm}>
  <Dialog.Content title="Delete item?">
    <p>This action cannot be undone.</p>
  </Dialog.Content>
  <Dialog.Footer>
    <Button onClick={() => setShowConfirm(false)}>Cancel</Button>
    <Button appearance="primary" onClick={handleDelete}>Delete</Button>
  </Dialog.Footer>
</Dialog>
```

**Loading states**:
```tsx
// Spinner for short waits
<Spinner size="medium" label="Loading..." />

// Skeleton for content placeholders
<Skeleton><Skeleton.Item style={{ width: 200, height: 20 }} /></Skeleton>

// Progress bar for measured progress
<ProgressBar value={0.6} />
```

### Component Selection Guide

| Need | Component |
|------|-----------|
| Trigger an action | `Button`, `CompoundButton`, `SplitButton` |
| Navigate to a page | `Link`, `Breadcrumb`, `Nav` |
| Single-line text input | `Input`, `SearchBox` |
| Multi-line text input | `Textarea` |
| Select from options | `Dropdown` (closed list), `Combobox` (type + filter) |
| Pick multiple items | `TagPicker`, `Checkbox` group |
| Boolean toggle | `Switch`, `Checkbox` |
| Choose one from few | `RadioGroup` |
| Pick a number | `Slider`, `SpinButton` |
| Pick a color | `ColorPicker`, `SwatchPicker` |
| Show user identity | `Avatar`, `AvatarGroup`, `Persona` |
| Categorize items | `Badge`, `Tag`, `CounterBadge` |
| Show status | `PresenceBadge`, `MessageBar` |
| Display data | `Table`, `DataGrid`, `List` |
| Organize content | `Card`, `Accordion`, `TabList`, `Tree` |
| Overlay content | `Dialog`, `Drawer`, `Popover`, `Tooltip` |
| Show progress | `Spinner`, `ProgressBar`, `Skeleton` |
| Notify users | `Toast` / `Toaster`, `MessageBar` |
| Guide users | `TeachingPopover` |
| Handle overflow | `Overflow` / `OverflowItem` |
| Browse content | `Carousel` |
| Rate items | `Rating`, `RatingDisplay` |
| Label fields | `Label`, `InfoLabel`, `Field` |

---

## 12. Quick Reference

### Component Catalog (60 components)

**Buttons & Actions** (7)
`Button` `CompoundButton` `ToggleButton` `SplitButton` `MenuButton` `Link` `Toolbar`

**Input & Forms** (19)
`Input` `Textarea` `Field` `Label` `Checkbox` `RadioGroup` `RadioItem` `Switch` `Select` `SearchBox` `Slider` `SpinButton` `Combobox` `Dropdown` `TagPicker` `Rating` `RatingDisplay` `ColorPicker` `SwatchPicker`

**Data Display** (11)
`Avatar` `AvatarGroup` `Badge` `PresenceBadge` `CounterBadge` `Tag` `Persona` `Divider` `InfoLabel` `Image` `List`

**Layout** (6)
`Card` `Accordion` `TabList` `Tree` `Carousel` `Overflow`

**Navigation** (3)
`Breadcrumb` `Menu` `Nav`

**Feedback** (5)
`MessageBar` `ProgressBar` `Spinner` `Skeleton` `Toast`/`Toaster`

**Overlays** (5)
`Dialog` `Popover` `Tooltip` `Drawer` `TeachingPopover`

**Table** (2)
`Table` `DataGrid`

**Typography** (1)
`Text`

**Provider** (1)
`WaveProvider`

### Most-Used Tailwind Classes (Wave UI)

```
/* Typography */
text-body-1          /* 14px default body text */
text-caption-1       /* 12px labels */
text-subtitle-1      /* 20px semibold headings */
font-semibold        /* 600 weight */

/* Colors */
bg-background        /* Page background */
text-foreground      /* Default text */
bg-primary           /* Brand buttons */
text-muted-foreground /* Secondary text */
border-border        /* Standard borders */
border-input         /* Input borders */

/* Spacing */
p-4                  /* 16px padding (standard) */
gap-2                /* 8px gap */
gap-4                /* 16px gap */

/* Borders */
rounded              /* 4px (Wave default) */
rounded-lg           /* 6px */
rounded-full         /* Circular */
border               /* 1px solid */

/* Shadows */
shadow-2             /* Cards at rest */
shadow-4             /* Hover state */
shadow-8             /* Popovers, dropdowns */
shadow-16            /* Dialogs */

/* Layout */
flex items-center    /* Horizontal centering */
inline-flex          /* Inline flexbox */
relative             /* For absolute children */

/* Focus */
focus:outline-none focus:border-b-2 focus:border-b-primary  /* Wave focus style */
focus-visible:outline focus-visible:outline-2               /* Keyboard-only focus */
```

### Key File Paths

| File | Purpose |
|------|---------|
| `src/styles/tokens.css` | CSS custom properties (light, dark, high-contrast) |
| `tailwind.config.ts` | Token → Tailwind mapping |
| `src/lib/cn.ts` | Class name merge utility |
| `src/lib/types.ts` | Shared types (Size, Appearance, Status, etc.) |
| `src/lib/slot.ts` | Slot system for customizable sub-elements |
| `src/hooks/useControllable.ts` | Controlled/uncontrolled state hook |
| `src/hooks/useId.ts` | Unique ID generation for ARIA |
| `src/hooks/useEventCallback.ts` | Stable callback ref |
| `src/hooks/useRovingTabIndex.ts` | Roving tabindex for composite widgets |
| `src/components/provider/WaveProvider.tsx` | Theme provider |
| `src/test-utils.ts` | Shared test helpers |

### Keyboard Pattern Cheat Sheet

| Widget | Enter group | Navigate | Activate | Leave |
|--------|------------|----------|----------|-------|
| Button | Tab | - | Enter/Space | Tab |
| RadioGroup | Tab | Arrow Up/Down (vertical), Arrow Left/Right (horizontal) | Auto-select on focus | Tab |
| Tabs | Tab | Arrow Left/Right (horizontal), Arrow Up/Down (vertical) | Auto-select on focus | Tab |
| Combobox | Tab | Arrow keys | Enter | Escape/Tab |
| Dropdown | Tab | Arrow keys | Enter/Space | Escape/Tab |
| Menu | Tab/Click | Arrow keys | Enter | Escape |
| Tree | Tab | Arrow Up/Down | Enter/Space | Tab |
| DataGrid | Tab | Arrow keys | Enter | Tab |
| Dialog | Auto-focus | Tab (trapped) | Enter | Escape |
| Toolbar | Tab | Arrow keys | Enter/Space | Tab |

*RadioGroup and Tabs use the roving tabindex pattern — arrow keys navigate and auto-select, Tab enters/exits the group.*

---

*This guide documents the `wave-ui-react` library — a custom React + Tailwind CSS implementation inspired by Fluent UI v2 design language. This is **not** the official `@fluentui/react-components` package. For the official Microsoft library, see [Fluent UI React v9](https://react.fluentui.dev/). For the official design guidelines, see [Fluent 2 Design](https://fluent2.microsoft.design/).*
