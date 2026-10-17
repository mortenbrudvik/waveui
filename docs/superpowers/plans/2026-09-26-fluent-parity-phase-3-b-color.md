# WaveUI 0.8.0 Phase 3 — Color (P3-color) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ColorArea`, `ColorSlider` and `AlphaSlider` (HSV parts that work alone and bind to an enclosing ColorPicker), turn ColorPicker into a composable container that keeps a hex value and an HSV working color, and publish the `HsvColor` and `ColorPickerShape` types and the `hsvToHex`/`hexToHsv` helpers.

**Architecture:** Pure conversions live in the new server-safe `src/lib/color.ts`; the English color namer (`colorName.ts`) and the part helpers (display clamping, key steps, gradients, value texts, the thumb and rail class recipes, in `colorUtils.ts`) are internal and pure. `ColorPicker.parts.tsx` holds the picker labels, the picker context, the binding hook every standalone part uses (`useColorPartState`) and the picker-only parts (`ColorPicker.HexField`, `.Swatches`, `.Preview`); `ColorPicker.tsx` keeps the root (value, working color, default layout, forms) and the compound. Each standalone part is one module with native `<input type="range">` elements for assistive technology and a decorative 24 px thumb.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` — §2 P3-05 and rulings D18–D22 (with D29 motion, D30 bundles, D32 module splits), §1.2 (applying the stable classes), §4.1 (the class-name contract), §6.4 (the P3-color bullet), §6.3 checklist item 4 (manual checks for the report), Appendix A (input folder: `colorPickerClassNames`, `colorPickerHexFieldClassNames`, `colorPickerSwatchesClassNames`, `colorPickerPreviewClassNames`, `colorAreaClassNames`, `colorSliderClassNames`, `alphaSliderClassNames`).

**Index:** docs/superpowers/plans/2026-09-26-fluent-parity-phase-3.md (wave order, entry conditions, cross-package contract, final gate).

**Commits:** one per task. When packages run in parallel in one checkout, only the lead runs git write commands (spec §0.2 rule 6): a package agent stops at the commit step and reports its file list.

## Global Constraints

- Toolchain: Node `^22.22.2 || ^24.15.0 || >=26.0.0`, npm >= 11.11 (devEngines). No new runtime dependency (spec D30).
- Branch and worktree: `feat/fluent-parity-phase-3` in `.claude/worktrees/fluent-parity-phase-3`. Never a bare `git stash`; never `checkout -b` in the main checkout.
- Commits: conventional-commit subjects (`feat(feedback): …`); no AI attribution trailer; one commit per task.
- File ownership (spec §3): only your package's files. `src/lib/classNames.ts` and `MessageBar.status.tsx` are read-only after wave A; the barrels and `src/index.ts` belong to INTEGRATION (wave C), except the registry export of Task A1.
- Conventions (CLAUDE.md, binding): C-REF (ref in props; `displayName` on every component and part), C-COMPOSE (consumer handlers first; `cn(<stable class>, <internal>, className)`; ignore events whose target is not DOM-inside `currentTarget`), C-CLASS (enumerated `data-*` always rendered, boolean ones present or absent, before `{...rest}`), C-TOKENS (theme tokens only; runtime colors only as inline custom-property values marked `// wave-allow-color: <reason>`), C-LOGICAL (logical utilities; the `wave-rtl:` variant only; horizontal arrows through `getArrowIntent`), C-FOCUS, C-MOTION (every `transition*`/`animate-*` string has a same-kind `motion-reduce:` variant; no component ships enter or exit motion, D29), C-DISABLED, C-NAMING, C-CONTEXT, C-MEMO, C-IDS, C-SLOTS, C-BUTTON-TYPE, C-NATIVE, C-ROUTING, C-FORMS, C-POPUPS, C-COMPOUND, C-PURE, C-HOOKS, C-DEV (`warnOnce` from effects; dotted keys such as `Toast.Title:unscanned`), C-DOCS, C-STORIES.
- Stable classes (spec §1.2): every element of a registered part carries exactly its Appendix A class, first in its `cn()` (or in `renderSlot`'s base classes), written as a literal member access (`toastTitleClassNames.root`); no state classes.
- Never write a Tailwind utility name as a bare word in comments or strings under `src/components` or `src/lib` (the CSS build fails on it).
- Tests: a test fails before its code exists (TDD); clean output (no act() warnings; every `[WaveUI]` warning asserted); never hard-code test counts; query by role and accessible name.
- Per task: the focused Vitest runs, `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, ESLint on the touched files with `--max-warnings 0`, and the conventions and stories gate filters for the touched components and stories.

Package-specific:

- P3-color owns (spec §3): `src/lib/types.ts` (`HsvColor` and `ColorPickerShape` only), `src/lib/color.ts`, `src/lib/__tests__/types.test.ts` and `color.test.ts`, `src/styles/__tests__/tokens.test.ts` (the color-part pairs only), the input-folder files listed under File Structure, and the four stories. Stories of the new modules import module paths (`'../src/components/input/ColorArea'`, `'../src/lib/color'`) until INTEGRATION's Task I1.
- Runtime colors (the gradients, the thumb fill, the preview) are inline custom-property values or inline styles built from the value. A line that writes a hex or color-function literal carries `// wave-allow-color: <reason>` on that line or on the comment-only line directly above it; never a color literal in a class. Keep each such literal on one line (the marker covers one line).
- Tailwind must see every class literally: the focus classes keyed on a named group (`group/color-area`, `group/color-slider`, `group/alpha-slider`) are written out in full in each part's module, never assembled at run time.
- The color parts consume no Escape, move no focus out of themselves and animate nothing (no `transition*`, no `animate-*`; thumbs move without transitions, D29).
- Checkpoint (spec §3): after Task C8 the three standalone parts are complete. The lead commits there, so INTEGRATION can start the color cases while Tasks C9–C12 finish.

## Review Focus

1. **A controlled ColorPicker whose parent ignores `onValueChange`** (the lead's refinement of D21): pressing Home on the area's saturation input reports `#bdbdbd` once, but the area, the hue slider and the hex field stay at the parent's `#0f6cbd`, because the picker re-derives its working color whenever `hsvToHex(hsv)` differs from the normalized value, not only when the value changed since the last render → Task C10; a standalone `ColorArea` and `ColorSlider` with a fixed `value` stay put too → Tasks C5, C7.
2. **Out-of-range and non-finite HSV** passed to `hsvToHex`, `ColorArea`, `ColorSlider` and `AlphaSlider` (`h` 360, -30, 720, `NaN`; `s` 1.5; `v` `NaN`; `a` 1.4, `NaN`): the display wraps or clamps, `aria-valuenow` stays inside the range, the keys step from the clamped value, and no inline custom property contains `NaN` → Tasks C1, C4, C5, C6, C7.
3. **The hue slider at its end:** End (or a value with `h: 360`) keeps the thumb at the end (`aria-valuenow` 360, position `100%`) and reports `h: 360`; a display that wrapped 360 to 0 would jump the thumb to the start → Task C5.
4. **A vertical slider in a right-to-left page:** the bottom stays the minimum and ArrowUp and ArrowRight increase (the rotated input carries `dir="ltr"`), while a horizontal rail mirrors and ArrowLeft increases → Tasks C5, C6.
5. **Browser shortcuts on the color parts:** Alt, Ctrl or Meta with an arrow, Home or End (Alt+Left is "back", Ctrl+Home scrolls) is neither handled nor prevented, so the browser keeps it → Tasks C4, C5, C7.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/types.ts` | modify | `HsvColor` and `ColorPickerShape` (public through `export type * from './lib/types'`). |
| `src/lib/color.ts` | create | Server-safe conversions: public `hsvToHex`, `hexToHsv`; internal `parseHexBytes`, `wrapHue`, `clampUnit`, `hsvToRgb`, `rgbToHsv`. The one hex grammar of the library. |
| `src/lib/__tests__/color.test.ts` | create | The conversion contracts, the round-trip rule and a sweep. |
| `src/lib/__tests__/types.test.ts` | modify | Type tests of the two new types. |
| `src/components/input/colorName.ts` | create | `getColorName(color)`: the English namer of the value texts (spec table). |
| `src/components/input/__tests__/colorName.test.ts` | create | The namer table, its bounds and the pinned examples. |
| `src/components/input/colorUtils.ts` | modify | `parseHexColor` on `parseHexBytes`; the part helpers: `displayHue`, `displayColor`, `toPercent`, `toPosition`, `sameColor`, `railKeyTarget`, the gradients, the value texts, `COLOR_THUMB_CLASSES` and the rail class recipes. |
| `src/components/input/__tests__/colorUtils.test.ts` | modify | Tests of the part helpers. |
| `src/components/input/ColorPicker.parts.tsx` | create | `ColorPickerLabels` (moved here, with the new keys), defaults, `ColorPickerContext`, `useColorPickerContext`, `useColorPartState` (C4); `usePickerPartContext` and the picker-only parts `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview` (C9). Never imports `ColorPicker.tsx`. |
| `src/components/input/ColorSlider.tsx` | create | `ColorSlider` (C5). |
| `src/components/input/AlphaSlider.tsx` | create | `AlphaSlider` (C6). |
| `src/components/input/ColorArea.tsx` | create | `ColorArea` (C7, C8). |
| `src/components/input/ColorPicker.tsx` | modify | The root: value, the hex working color, the context provider, the default layout, children, forms; the compound and the flat re-exports (C4, C9, C10). |
| `src/components/input/__tests__/colorPartHarness.tsx` | create | Test-only `PickerHarness`: a working picker context for the part tests. |
| `src/components/input/__tests__/ColorPicker.parts.test.tsx` | create | `useColorPartState` (C4) and the picker-only parts (C9). |
| `src/components/input/__tests__/ColorSlider.test.tsx`, `AlphaSlider.test.tsx`, `ColorArea.test.tsx` | create | The standalone parts. |
| `src/components/input/__tests__/ColorPicker.test.tsx` | modify | Composition, working color, default layout; the §6.4 updates. |
| `src/styles/__tests__/tokens.test.ts` | modify | The checkerboard pair and the color-part pair check (C3). |
| `stories/ColorArea.stories.tsx`, `stories/ColorSlider.stories.tsx`, `stories/AlphaSlider.stories.tsx` | create | Stories of the new parts (module-path imports). |
| `stories/ColorPicker.stories.tsx` | modify | `Composed`, `CustomLayout`, `RgbAndHslFields`, `InPopover`, `Square`. |

Order and dependencies: C1 → C2 → C3 (independent) → C4 → C5 → C6 → C7 → C8 → checkpoint → C9 → C10 → C11 → C12. C4 needs C1 and C2; C5–C8 need C4; C9 needs C4; C10 needs C5–C9.

Wave A already applied `colorPickerClassNames.root`, `.opacityLabel` and `.opacityValue` to the 0.7 ColorPicker (Task A7) and `swatchPickerClassNames` to SwatchPicker; the before-snippets below show those classes. The 0.8 constants (`colorPickerHexFieldClassNames`, `colorPickerSwatchesClassNames`, `colorPickerPreviewClassNames`, `colorAreaClassNames`, `colorSliderClassNames`, `alphaSliderClassNames`) are on `PENDING_CLASS_NAMES` and are applied here.

---

### Task C1: `HsvColor`, `ColorPickerShape` and the conversions

**Files:**
- Modify: `src/lib/types.ts` (after `Shape`, line 44)
- Modify: `src/lib/__tests__/types.test.ts`
- Create: `src/lib/color.ts`
- Create: `src/lib/__tests__/color.test.ts`
- Modify: `src/components/input/colorUtils.ts` (the hex grammar, lines 36–83)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export interface HsvColor { h: number; s: number; v: number; a?: number }` and `export type ColorPickerShape = Extract<Shape, 'rounded' | 'square'>` in `src/lib/types.ts`.
  - `src/lib/color.ts`: `export function hsvToHex(color: HsvColor): string`, `export function hexToHsv(hex: string): HsvColor | null` (public, exported from the entry by INTEGRATION), and internal `export interface HexBytes { r: number; g: number; b: number; alpha: number; hasAlpha: boolean }`, `export function parseHexBytes(value: string): HexBytes | null`, `export function wrapHue(h: number): number`, `export function clampUnit(value: number | undefined, fallback: number): number`, `export function hsvToRgb(color: HsvColor): { r: number; g: number; b: number }`, `export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number }`.
  - `colorUtils.parseHexColor` and `parseHexInput` keep their signatures and results.

- [ ] **Step 1: Write the failing type tests**

In `src/lib/__tests__/types.test.ts`, add `ColorPickerShape` and `HsvColor` to the `import type { … } from '../types'` list (alphabetical order is not required there; append them after `PopupTarget`), then append:

```ts
describe('color vocabulary (P3-05)', () => {
  it('HsvColor has a hue, a saturation, a value and an optional alpha (Fluent\'s HsvColor)', () => {
    expectTypeOf<HsvColor>().toEqualTypeOf<{ h: number; s: number; v: number; a?: number }>();
  });

  it('ColorPickerShape is the rounded and square subset of Shape', () => {
    expectTypeOf<ColorPickerShape>().toEqualTypeOf<'rounded' | 'square'>();
    expectTypeOf<ColorPickerShape>().toExtend<Shape>();
    expectTypeOf<'circular'>().not.toMatchTypeOf<ColorPickerShape>();
  });
});
```

- [ ] **Step 2: Run the type check to verify it fails**

Run: `npx tsc -p tsconfig.dev.json --noEmit`
Expected: FAIL with `Module '"../types"' has no exported member 'HsvColor'` (and the same for `ColorPickerShape`).

- [ ] **Step 3: Add the types**

In `src/lib/types.ts`, directly after the `Shape` declaration (`export type Shape = 'circular' | 'square' | 'rounded';`), insert:

```ts
/**
 * A color in HSV (Fluent's `HsvColor`): `h` is the hue in degrees (0–360), `s` the saturation, `v`
 * the brightness (value) and `a` the opacity, each from 0 to 1. Without `a` the color is opaque.
 */
export interface HsvColor {
  /** Hue in degrees, 0–360. */
  h: number;
  /** Saturation, 0–1. */
  s: number;
  /** Brightness (value), 0–1. */
  v: number;
  /** Opacity, 0–1; left out means opaque. */
  a?: number;
}

/** The shape of ColorPicker and its color parts (a subset of `Shape`). */
export type ColorPickerShape = Extract<Shape, 'rounded' | 'square'>;
```

- [ ] **Step 4: Run the type check and the type tests**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx vitest run src/lib/__tests__/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing conversion tests**

Create `src/lib/__tests__/color.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  clampUnit,
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  parseHexBytes,
  rgbToHsv,
  wrapHue,
} from '../color';

describe('hsvToHex (D18)', () => {
  it.each([
    [{ h: 0, s: 0, v: 0 }, '#000000'],
    [{ h: 0, s: 0, v: 1 }, '#ffffff'],
    [{ h: 0, s: 1, v: 1 }, '#ff0000'],
    [{ h: 60, s: 1, v: 1 }, '#ffff00'],
    [{ h: 120, s: 1, v: 1 }, '#00ff00'],
    [{ h: 180, s: 1, v: 1 }, '#00ffff'],
    [{ h: 240, s: 1, v: 1 }, '#0000ff'],
    [{ h: 300, s: 1, v: 1 }, '#ff00ff'],
    [{ h: 0, s: 1, v: 0.5 }, '#800000'],
    [{ h: 208, s: 0.92, v: 0.74 }, '#0f6cbd'],
  ])('%o is %s', (color, hex) => {
    expect(hsvToHex(color)).toBe(hex);
  });

  it('writes the alpha byte only below full opacity', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0.5 })).toBe('#ff000080');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0 })).toBe('#ff000000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0.999 })).toBe('#ff0000');
  });

  it('wraps the hue and clamps saturation, brightness and alpha', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 720, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: -30, s: 1, v: 1 })).toBe('#ff0080');
    expect(hsvToHex({ h: 0, s: 1.5, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: -1, v: 2 })).toBe('#ffffff');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 1.4 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: -1 })).toBe('#ff000000');
  });

  it('reads a channel that is not a number as 0, and such an alpha as left out', () => {
    expect(hsvToHex({ h: Number.NaN, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: Number.POSITIVE_INFINITY, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: Number.NaN, v: 1 })).toBe('#ffffff');
    expect(hsvToHex({ h: 0, s: 1, v: Number.NaN })).toBe('#000000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: Number.NaN })).toBe('#ff0000');
  });
});

describe('hexToHsv (D18)', () => {
  it('reads the hue in degrees and saturation and brightness from 0 to 1, without alpha', () => {
    expect(hexToHsv('#ff0000')).toStrictEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#00ff00')).toStrictEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv('#0000ff')).toStrictEqual({ h: 240, s: 1, v: 1 });
    expect(hexToHsv('#000000')).toStrictEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('#808080')).toStrictEqual({ h: 0, s: 0, v: 128 / 255 });
  });

  it('trims, ignores case and expands the short forms (as parseHexColor)', () => {
    expect(hexToHsv(' #F00 ')).toStrictEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#FF0000')).toStrictEqual({ h: 0, s: 1, v: 1 });
  });

  it('sets alpha only when the input has alpha digits', () => {
    expect(hexToHsv('#ff000080')).toStrictEqual({ h: 0, s: 1, v: 1, a: 128 / 255 });
    expect(hexToHsv('#f008')).toStrictEqual({ h: 0, s: 1, v: 1, a: 0x88 / 255 });
    expect(hexToHsv('#ff0000ff')).toStrictEqual({ h: 0, s: 1, v: 1, a: 1 });
    expect(hexToHsv('#ff0000')).not.toHaveProperty('a');
  });

  it('returns null for anything that is not a hex color', () => {
    for (const value of [
      'red',
      '',
      '#',
      '#12',
      '#12345',
      '#1234567',
      '#zzzzzz',
      '112233',
      'rgb(0,0,0)',
    ]) {
      expect(hexToHsv(value), value).toBeNull();
    }
  });

  it("round-trips every accepted hex string to ColorPicker's normal form", () => {
    for (const [input, normal] of [
      ['#ABC', '#aabbcc'],
      ['#abc8', '#aabbcc88'],
      ['#0F6CBDFF', '#0f6cbd'],
      [' #112233 ', '#112233'],
      ['#0f6cbd80', '#0f6cbd80'],
      ['#000000', '#000000'],
      ['#ffffff', '#ffffff'],
    ] as const) {
      expect(hsvToHex(hexToHsv(input)!), input).toBe(normal);
    }
  });

  it('round-trips a sweep of 8-bit colors and every alpha byte exactly', () => {
    const byte = (n: number) => n.toString(16).padStart(2, '0');
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 51) {
          const color = `#${byte(r)}${byte(g)}${byte(b)}`;
          expect(hsvToHex(hexToHsv(color)!), color).toBe(color);
        }
      }
    }
    for (let alpha = 0; alpha < 255; alpha++) {
      const color = `#0f6cbd${byte(alpha)}`;
      expect(hsvToHex(hexToHsv(color)!), color).toBe(color);
    }
  });
});

describe('internal helpers', () => {
  it('parseHexBytes reads the bytes and whether alpha digits were given', () => {
    expect(parseHexBytes('#0F6CBD80')).toEqual({ r: 15, g: 108, b: 189, alpha: 128, hasAlpha: true });
    expect(parseHexBytes('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, alpha: 255, hasAlpha: false });
    expect(parseHexBytes('0f6cbd')).toBeNull();
  });

  it('wrapHue wraps into [0, 360) and clampUnit clamps to [0, 1]', () => {
    expect([0, 360, 361, -30, 720, Number.NaN].map((h) => wrapHue(h))).toEqual([0, 0, 1, 330, 0, 0]);
    expect(clampUnit(0.5, 0)).toBe(0.5);
    expect(clampUnit(1.5, 0)).toBe(1);
    expect(clampUnit(-1, 0)).toBe(0);
    expect(clampUnit(Number.POSITIVE_INFINITY, 0)).toBe(1);
    expect(clampUnit(Number.NaN, 1)).toBe(1);
    expect(clampUnit(undefined, 1)).toBe(1);
  });

  it('hsvToRgb and rgbToHsv are inverse on a primary', () => {
    expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
    expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 1, v: 1 });
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/color.test.ts`
Expected: FAIL with `Failed to resolve import "../color"`.

- [ ] **Step 7: Create `src/lib/color.ts`**

```ts
/**
 * Conversions between HSV colors and hex strings (spec P3-05, D18). Server-safe: no React and no
 * DOM, so the helpers run in a Server Component and during server rendering.
 *
 * Public: `hsvToHex` and `hexToHsv`, exported from the package entry. The other exports are
 * internal helpers of the color components (not exported from the package).
 */
import type { HsvColor } from './types';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** @internal The channels of a hex color as bytes (0–255). */
export interface HexBytes {
  r: number;
  g: number;
  b: number;
  /** The alpha byte; 255 when the input has no alpha digits. */
  alpha: number;
  /** Whether the input has alpha digits (`#rgba`, `#rrggbbaa`). */
  hasAlpha: boolean;
}

/**
 * @internal Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (surrounding whitespace ignored, any
 * case), else `null`. The one hex grammar of the library: `colorUtils.parseHexColor` reads it too.
 */
export function parseHexBytes(value: string): HexBytes | null {
  const match = HEX_COLOR.exec(value.trim());
  if (!match) return null;
  const digits = match[1];
  const long =
    digits.length <= 4
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  const byte = (index: number) => parseInt(long.slice(index, index + 2), 16);
  const hasAlpha = long.length === 8;
  return { r: byte(0), g: byte(2), b: byte(4), alpha: hasAlpha ? byte(6) : 255, hasAlpha };
}

/** @internal `h` wrapped into [0, 360); a hue that is not finite reads as 0. */
export function wrapHue(h: number): number {
  return Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0;
}

/** @internal `value` clamped to [0, 1]; `NaN` or `undefined` reads as `fallback`. */
export function clampUnit(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/** @internal An HSV color, normalized first, as sRGB channels from 0 to 255 (unrounded). */
export function hsvToRgb(color: HsvColor): { r: number; g: number; b: number } {
  const h = wrapHue(color.h) / 60;
  const s = clampUnit(color.s, 0);
  const v = clampUnit(color.v, 0);
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 1) rgb = [c, x, 0];
  else if (h < 2) rgb = [x, c, 0];
  else if (h < 3) rgb = [0, c, x];
  else if (h < 4) rgb = [0, x, c];
  else if (h < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

/** @internal sRGB channels (0–255) as a hue in degrees and saturation and brightness from 0 to 1. */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function toHexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

/**
 * The hex string of an HSV color: lowercase `#rrggbb`, or `#rrggbbaa` when `a` is below 1
 * (ColorPicker's value format). The hue wraps into [0, 360); saturation, brightness and alpha are
 * clamped to [0, 1]; a channel that is not a number reads as 0 (alpha: as left out, so opaque).
 *
 * @example hsvToHex({ h: 208, s: 0.92, v: 0.74 }) // '#0f6cbd'
 */
export function hsvToHex(color: HsvColor): string {
  const { r, g, b } = hsvToRgb(color);
  const alpha = Math.round(clampUnit(color.a, 1) * 255);
  const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  return alpha === 255 ? hex : hex + toHexByte(alpha);
}

/**
 * The HSV color of a hex string: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (surrounding whitespace
 * ignored, any case). `a` is set only when the input has alpha digits. Returns `null` for anything
 * else (named colors, `rgb()`, a missing `#`). `hsvToHex(hexToHsv(x))` gives `x` back in
 * ColorPicker's normal form.
 *
 * @example hexToHsv('#ff000080') // { h: 0, s: 1, v: 1, a: 0.50196… }
 */
export function hexToHsv(hex: string): HsvColor | null {
  const bytes = parseHexBytes(hex);
  if (!bytes) return null;
  const { h, s, v } = rgbToHsv(bytes.r, bytes.g, bytes.b);
  return bytes.hasAlpha ? { h, s, v, a: bytes.alpha / 255 } : { h, s, v };
}
```

- [ ] **Step 8: Run the conversion tests**

Run: `npx vitest run src/lib/__tests__/color.test.ts`
Expected: PASS.

- [ ] **Step 9: Switch `colorUtils.ts` to the one hex grammar**

In `src/components/input/colorUtils.ts`:

Before (top of the module, after the header comment and the three interfaces):

```ts
// wave-allow-color: luminance-picked check glyph on a user swatch (C-TOKENS exception, input-pickers#16)
const BLACK = '#000000';
// wave-allow-color: luminance-picked check glyph on a user swatch (C-TOKENS exception, input-pickers#16)
const WHITE = '#ffffff';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const HEX_INPUT = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
```

After:

```ts
// wave-allow-color: luminance-picked check glyph on a user swatch (C-TOKENS exception, input-pickers#16)
const BLACK = '#000000';
// wave-allow-color: luminance-picked check glyph on a user swatch (C-TOKENS exception, input-pickers#16)
const WHITE = '#ffffff';

const HEX_INPUT = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
```

Delete the whole `function fromDigits(digits: string): HexColor { … }` declaration. Replace the bodies of `parseHexColor` and `parseHexInput` (their JSDoc stays):

```ts
export function parseHexColor(value: string): HexColor | null {
  const bytes = parseHexBytes(value);
  return bytes
    ? {
        rgb: `#${toHexByte(bytes.r)}${toHexByte(bytes.g)}${toHexByte(bytes.b)}`,
        alpha: bytes.alpha,
      }
    : null;
}
```

```ts
export function parseHexInput(text: string): HexColor | null {
  return HEX_INPUT.test(text.trim()) ? parseHexColor(text) : null;
}
```

Add the import below the header comment: `import { parseHexBytes } from '../../lib/color';`, and change the header's first sentence to: "Color helpers for ColorPicker, SwatchPicker and the HSV color parts: hex parsing and normalisation (on the grammar of `src/lib/color.ts`), the alpha byte ↔ opacity percentage, and the luminance-picked check glyph drawn on a user-supplied swatch."

- [ ] **Step 10: Run the regression tests**

Run: `npx vitest run src/components/input/__tests__/colorUtils.test.ts src/components/input/__tests__/ColorPicker.test.tsx src/components/input/__tests__/SwatchPicker.test.tsx`
Expected: PASS (no test changed: the hex results are the same).

- [ ] **Step 11: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/lib/types.ts src/lib/color.ts src/lib/__tests__/color.test.ts src/lib/__tests__/types.test.ts src/components/input/colorUtils.ts --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/colorUtils.ts"`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/types.ts src/lib/color.ts src/lib/__tests__/color.test.ts src/lib/__tests__/types.test.ts src/components/input/colorUtils.ts
git commit -m "feat(lib): HsvColor, ColorPickerShape and the hsvToHex/hexToHsv conversions"
```

---

### Task C2: The English color namer

**Files:**
- Create: `src/components/input/colorName.ts`
- Create: `src/components/input/__tests__/colorName.test.ts`

**Interfaces:**
- Consumes: `wrapHue`, `clampUnit`, `hexToHsv` (C1), `HsvColor`.
- Produces: `export function getColorName(color: HsvColor): string` (internal; the default of every `labels.colorName`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/input/__tests__/colorName.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hexToHsv } from '../../../lib/color';
import { getColorName } from '../colorName';

describe('getColorName (D22)', () => {
  it.each([
    ['#0f6cbd', 'blue'],
    ['#d13438', 'red'],
    ['#242424', 'black'],
    ['#ffffff', 'white'],
    ['#808080', 'gray'],
  ])('names %s "%s" (the pinned examples)', (hex, name) => {
    expect(getColorName(hexToHsv(hex)!)).toBe(name);
  });

  it.each([
    [0, 'red'],
    [30, 'orange'],
    [60, 'yellow'],
    [120, 'green'],
    [180, 'cyan'],
    [220, 'blue'],
    [270, 'purple'],
    [300, 'magenta'],
    [330, 'pink'],
    [350, 'red'],
  ])('names the family of hue %s "%s"', (h, name) => {
    expect(getColorName({ h, s: 0.6, v: 0.7 })).toBe(name);
  });

  it.each([
    [14.9, 'red'],
    [15, 'orange'],
    [44.9, 'orange'],
    [45, 'yellow'],
    [69.9, 'yellow'],
    [70, 'green'],
    [164.9, 'green'],
    [165, 'cyan'],
    [194.9, 'cyan'],
    [195, 'blue'],
    [254.9, 'blue'],
    [255, 'purple'],
    [289.9, 'purple'],
    [290, 'magenta'],
    [319.9, 'magenta'],
    [320, 'pink'],
    [344.9, 'pink'],
    [345, 'red'],
  ])('hue %s is "%s" (the family bounds)', (h, name) => {
    expect(getColorName({ h, s: 0.6, v: 0.7 })).toBe(name);
  });

  it('adds the lightness qualifier, then the saturation qualifier', () => {
    expect(getColorName({ h: 220, s: 0.3, v: 0.4 })).toBe('dark grayish blue');
    expect(getColorName({ h: 220, s: 0.6, v: 0.3 })).toBe('dark blue');
    expect(getColorName({ h: 220, s: 0.3, v: 0.7 })).toBe('grayish blue');
    expect(getColorName({ h: 330, s: 0.4, v: 0.9 })).toBe('light pink');
    expect(getColorName({ h: 220, s: 0.3, v: 0.9 })).toBe('light blue');
    expect(getColorName({ h: 0, s: 0.9, v: 0.9 })).toBe('vivid red');
  });

  it('names grays by brightness below 10 % saturation, and black below 15 % brightness', () => {
    expect(getColorName({ h: 200, s: 0.05, v: 0.3 })).toBe('dark gray');
    expect(getColorName({ h: 200, s: 0.05, v: 0.6 })).toBe('gray');
    expect(getColorName({ h: 200, s: 0.05, v: 0.8 })).toBe('light gray');
    expect(getColorName({ h: 200, s: 0.05, v: 0.95 })).toBe('white');
    expect(getColorName({ h: 200, s: 1, v: 0.1 })).toBe('black');
  });

  it('reads out-of-range and non-finite channels as hsvToHex does', () => {
    expect(getColorName({ h: -10, s: 2, v: 2 })).toBe('vivid red');
    expect(getColorName({ h: Number.NaN, s: Number.NaN, v: Number.NaN })).toBe('black');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/colorName.test.ts`
Expected: FAIL with `Failed to resolve import "../colorName"`.

- [ ] **Step 3: Create `src/components/input/colorName.ts`**

```ts
/**
 * The built-in English color namer of the color parts' value texts (spec P3-05, D22): "blue",
 * "dark grayish blue", "light pink", "vivid red", "black". `labels.colorName` replaces it.
 * Internal (not exported from the package).
 */
import { clampUnit, wrapHue } from '../../lib/color';
import type { HsvColor } from '../../lib/types';

/** Hue families by the degree they end before (red also covers 345 and above). */
const HUE_FAMILIES: ReadonlyArray<readonly [endsBefore: number, family: string]> = [
  [15, 'red'],
  [45, 'orange'],
  [70, 'yellow'],
  [165, 'green'],
  [195, 'cyan'],
  [255, 'blue'],
  [290, 'purple'],
  [320, 'magenta'],
  [345, 'pink'],
  [360, 'red'],
];

/**
 * An English name of `color` for assistive technology: "black" below 15 % brightness; "white" or a
 * gray below 10 % saturation; otherwise a hue family, prefixed by "dark" (brightness below 50 %)
 * or "light" (brightness above 85 % with saturation below 50 %), then by "grayish" (saturation
 * below 35 %, never with "light") or "vivid" (saturation and brightness above 85 %).
 */
export function getColorName(color: HsvColor): string {
  const h = wrapHue(color.h);
  const s = clampUnit(color.s, 0);
  const v = clampUnit(color.v, 0);
  if (v < 0.15) return 'black';
  if (s < 0.1) {
    if (v > 0.93) return 'white';
    if (v < 0.4) return 'dark gray';
    if (v > 0.75) return 'light gray';
    return 'gray';
  }
  const family = HUE_FAMILIES.find(([endsBefore]) => h < endsBefore)?.[1] ?? 'red';
  const lightness = v < 0.5 ? 'dark' : v > 0.85 && s < 0.5 ? 'light' : '';
  const saturation =
    s < 0.35 && lightness !== 'light' ? 'grayish' : s > 0.85 && v > 0.85 ? 'vivid' : '';
  return [lightness, saturation, family].filter(Boolean).join(' ');
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/input/__tests__/colorName.test.ts`
Expected: PASS.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/colorName.ts src/components/input/__tests__/colorName.test.ts --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/colorName.ts"`
Expected: PASS (the family names are array data and return values, which the `raw-color` rule does not read as painted colors).

- [ ] **Step 6: Commit**

```bash
git add src/components/input/colorName.ts src/components/input/__tests__/colorName.test.ts
git commit -m "feat(input): the English color namer of the color parts' value texts"
```

---

### Task C3: The contrast pairs of the color parts

**Files:**
- Modify: `src/styles/__tests__/tokens.test.ts` (`CONTRAST_PAIRS` near line 407, `TABLED_RATIOS` near line 486, the contrast `describe` near line 916)

**Interfaces:**
- Consumes: the token values of `src/styles/tokens.css` (unchanged).
- Produces: the checkerboard pair `['stroke', 'background', 1.5]` that AlphaSlider's rail draws (Task C6).

The token values, resolved per theme (light / dark / high contrast): `background` `#ffffff` / `#292929` / `#000000`; `foreground` `#242424` / `#ffffff` / `#ffffff`; `ring` `#0f6cbd` (`brand-80`) / `#479ef5` (`brand-100`) / `#ffff00`; `muted` `#f0f0f0` / `#383838` / `#1a1a1a`; `stroke` `#d1d1d1` / `#666666` / `#ffffff`. Ratios on `background`:

| Pair | Light | Dark | High contrast | Threshold | Result |
|---|---|---|---|---|---|
| thumb edge `foreground` / `background` | 15.52 | 14.55 | 21.00 | 3 | already asserted at 4.5 (`['foreground', 'background', 4.5]`) |
| focus indicator `ring` / `background` | 5.38 | 5.18 | 19.56 | 3 | already asserted (`['ring', 'background', 3]`) |
| checkerboard `muted` / `background` (the spec's first choice) | 1.14 | 1.24 | 1.21 | 1.5 | **fails in all three themes** |
| checkerboard `stroke` / `background` (the alternative the spec allows) | 1.53 | 2.53 | 21.00 | 1.5 | passes; AlphaSlider draws its squares in `stroke` on `background` |

- [ ] **Step 1: Write the failing test**

Inside `describe('tokens.css — contrast (WCAG 2.2, unrounded; …)', () => { … })`, after the test `'covers every §4.5 component combination in the threshold pairs'`, add:

```ts
  it('lists the pairs of the color parts: thumb edge, focus indicator and checkerboard (P3-05)', () => {
    const listed = new Map(CONTRAST_PAIRS.map(([fg, bg, threshold]) => [`${fg} ${bg}`, threshold]));
    // The thumbs' two-tone edge and their focus indicator (the ring outline around a background
    // halo) reuse pairs that other components already need.
    expect(listed.get('foreground background')).toBeGreaterThanOrEqual(3);
    expect(listed.get('ring background')).toBeGreaterThanOrEqual(3);
    // AlphaSlider's checkerboard: stroke squares on the background (muted fails in every theme).
    expect(listed.get('stroke background')).toBe(1.5);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/styles/__tests__/tokens.test.ts -t "lists the pairs of the color parts"`
Expected: FAIL: `expected undefined to be 1.5`.

- [ ] **Step 3: Add the pair and its tabled ratios**

In `CONTRAST_PAIRS`, directly after `['stroke-accessible', 'background', 3],`, insert:

```ts
  // AlphaSlider's checkerboard (0.8): squares in `stroke` on `background` under the rail. A
  // pattern that must stay visible, not text or a control boundary: 1.5:1. (`muted` on
  // `background` reaches only 1.14, 1.24 and 1.21:1.) The thumbs of the color parts reuse
  // `foreground` on `background` and `ring` on `background` above.
  ['stroke', 'background', 1.5],
```

In `TABLED_RATIOS`, directly after `['stroke-accessible', 'background', [6.19, 6.48, 21.0]],`, insert:

```ts
  ['stroke', 'background', [1.53, 2.53, 21.0]],
```

- [ ] **Step 4: Run the contrast tests**

Run: `npx vitest run src/styles/__tests__/tokens.test.ts`
Expected: PASS, including `light: stroke on background is at least 1.5:1` (1.527), `dark: …` (2.534) and `high-contrast: …` (21.0), and the tabled-ratio check.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/styles/__tests__/tokens.test.ts --max-warnings 0`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/styles/__tests__/tokens.test.ts
git commit -m "test(styles): contrast pairs of the color parts' thumbs and checkerboard"
```

---

### Task C4: Part helpers, the picker labels and context, and the binding hook

**Files:**
- Modify: `src/components/input/colorUtils.ts` (append the part helpers)
- Modify: `src/components/input/__tests__/colorUtils.test.ts` (append their tests)
- Create: `src/components/input/ColorPicker.parts.tsx`
- Modify: `src/components/input/ColorPicker.tsx` (the labels move to the parts module)
- Create: `src/components/input/__tests__/colorPartHarness.tsx`
- Create: `src/components/input/__tests__/ColorPicker.parts.test.tsx`

**Interfaces:**
- Consumes: `hsvToHex`, `wrapHue`, `clampUnit` (C1); `getColorName` (C2); `getArrowIntent`, `Direction` (`src/lib/direction.ts`); `useControllable`.
- Produces (internal unless noted):
  - `colorUtils.ts`: `type ColorChannel = 'hue' | 'saturation' | 'value' | 'alpha'`; `type RailOrientation = 'horizontal' | 'vertical'`; `displayHue(h: number): number`; `displayColor(color: HsvColor): Required<HsvColor>`; `toPercent(value: number): number`; `toPosition(value: number): string`; `sameColor(a: HsvColor, b: HsvColor): boolean`; `railKeyTarget(key: string, modifiers: KeyModifiers, dir: Direction, current: number, max: number): number | null` with `interface KeyModifiers { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }`; `colorAreaGradient(h: number): string`; `colorSliderGradient(channel: 'hue' | 'saturation' | 'value', color: Required<HsvColor>, orientation: RailOrientation): string`; `alphaSliderGradient(color: Required<HsvColor>, transparency: boolean, orientation: RailOrientation): string`; `areaValueText(color, channel: 'saturation' | 'value', labels): string`; `sliderValueText(color, channel: 'hue' | 'saturation' | 'value', labels): string`; `alphaValueText(color, transparency: boolean, valueText?): string`; class recipes `COLOR_THUMB_CLASSES`, `RAIL_ROOT_HORIZONTAL`, `RAIL_ROOT_VERTICAL`, `RAIL_TRACK_HORIZONTAL`, `RAIL_TRACK_VERTICAL`, `RAIL_GRADIENT`, `RAIL_INPUT_CLASSES`, `RAIL_INPUT_HORIZONTAL`, `RAIL_INPUT_VERTICAL`, `THUMB_TRACK_HORIZONTAL`, `THUMB_TRACK_VERTICAL`, `THUMB_POSITION_HORIZONTAL`, `THUMB_POSITION_VERTICAL`.
  - `ColorPicker.parts.tsx`: `DEFAULT_COLOR = '#0f6cbd'`; `DEFAULT_PART_COLOR: HsvColor = { h: 208, s: 0.92, v: 0.74 }`; the public `ColorPickerLabels` (moved from `ColorPicker.tsx`, re-exported from there, with the new keys `area`, `saturation`, `brightness`, `roleDescription`, `hue`, `transparency`, `colorName`, `valueText`); `ResolvedColorPickerLabels`; `DEFAULT_COLOR_PICKER_LABELS`; `ColorPickerContextValue`; `ColorPickerContext` (default `null`); `useColorPickerContext(): ColorPickerContextValue | null`; `interface ColorPartOptions { value: HsvColor | undefined; defaultValue: HsvColor | undefined; onValueChange: ((value: HsvColor) => void) | undefined; disabled: boolean }`; `interface ColorPartState { picker: ColorPickerContextValue | null; color: HsvColor; setColor: (next: HsvColor) => void; reset: () => void; disabled: boolean }`; `useColorPartState(options: ColorPartOptions): ColorPartState`.
  - Test-only `PickerHarness` (`__tests__/colorPartHarness.tsx`) with props `{ children; initial?: HsvColor; shape?: ColorPickerShape; labels?: ColorPickerLabels; disabled?: boolean; onHsvChange?: (hsv: HsvColor) => void }`.

- [ ] **Step 1: Write the failing helper tests**

Append to `src/components/input/__tests__/colorUtils.test.ts` (extend the import from `'../colorUtils'` with `alphaSliderGradient`, `alphaValueText`, `areaValueText`, `colorAreaGradient`, `colorSliderGradient`, `displayColor`, `displayHue`, `railKeyTarget`, `sameColor`, `sliderValueText`, `toPercent`, `toPosition`):

```ts
describe('color part helpers (P3-05)', () => {
  const none = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };

  it('displayHue keeps 0–360 (360 is the end of a hue rail) and wraps the rest', () => {
    expect(
      [0, 208, 360, 361, -30, 720, Number.NaN, Number.POSITIVE_INFINITY].map((h) => displayHue(h)),
    ).toEqual([0, 208, 360, 1, 330, 0, 0, 0]);
  });

  it('displayColor clamps what a part shows; a missing or non-number alpha is opaque', () => {
    expect(displayColor({ h: 720, s: 1.5, v: Number.NaN })).toEqual({ h: 0, s: 1, v: 0, a: 1 });
    expect(displayColor({ h: -30, s: -1, v: 2, a: 1.4 })).toEqual({ h: 330, s: 0, v: 1, a: 1 });
    expect(displayColor({ h: 10, s: 0.5, v: 0.5, a: Number.NaN })).toEqual({ h: 10, s: 0.5, v: 0.5, a: 1 });
  });

  it('toPercent rounds a 0–1 channel and toPosition writes a CSS percentage', () => {
    expect(toPercent(0.72)).toBe(72);
    expect(toPercent(0.726)).toBe(73);
    expect(toPosition(0.7234)).toBe('72.34%');
    expect(toPosition(1)).toBe('100%');
  });

  it('sameColor compares every channel, a missing alpha as 1', () => {
    expect(sameColor({ h: 1, s: 0.5, v: 0.5 }, { h: 1, s: 0.5, v: 0.5, a: 1 })).toBe(true);
    expect(sameColor({ h: 1, s: 0.5, v: 0.5 }, { h: 1, s: 0.5, v: 0.4 })).toBe(false);
  });

  it('railKeyTarget: 1 per arrow, 10 with Shift or a page key, the ends with Home and End, mirrored in RTL', () => {
    expect(railKeyTarget('ArrowRight', none, 'ltr', 50, 100)).toBe(51);
    expect(railKeyTarget('ArrowLeft', none, 'ltr', 50, 100)).toBe(49);
    expect(railKeyTarget('ArrowLeft', none, 'rtl', 50, 100)).toBe(51);
    expect(railKeyTarget('ArrowUp', none, 'rtl', 50, 100)).toBe(51);
    expect(railKeyTarget('ArrowDown', { ...none, shiftKey: true }, 'ltr', 50, 100)).toBe(40);
    expect(railKeyTarget('PageUp', none, 'ltr', 355, 360)).toBe(360);
    expect(railKeyTarget('PageDown', none, 'ltr', 5, 100)).toBe(0);
    expect(railKeyTarget('Home', none, 'ltr', 50, 360)).toBe(0);
    expect(railKeyTarget('End', none, 'ltr', 50, 360)).toBe(360);
    expect(railKeyTarget('Tab', none, 'ltr', 50, 100)).toBeNull();
  });

  it('railKeyTarget leaves browser shortcuts alone (Alt, Ctrl, Meta)', () => {
    expect(railKeyTarget('ArrowLeft', { ...none, altKey: true }, 'ltr', 50, 100)).toBeNull();
    expect(railKeyTarget('End', { ...none, ctrlKey: true }, 'ltr', 50, 100)).toBeNull();
    expect(railKeyTarget('ArrowUp', { ...none, metaKey: true }, 'ltr', 50, 100)).toBeNull();
  });

  it('builds the gradients from the color', () => {
    expect(colorAreaGradient(208)).toBe(
      'linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, #0088ff)',
    );
    expect(colorSliderGradient('hue', displayColor({ h: 0, s: 0, v: 0 }), 'vertical')).toBe(
      'linear-gradient(to top, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
    );
    expect(colorSliderGradient('saturation', displayColor({ h: 0, s: 0.5, v: 1 }), 'horizontal')).toBe(
      'linear-gradient(to right, #ffffff, #ff0000)',
    );
    expect(colorSliderGradient('value', displayColor({ h: 0, s: 1, v: 0.3 }), 'horizontal')).toBe(
      'linear-gradient(to right, #000000, #ff0000)',
    );
    expect(alphaSliderGradient(displayColor({ h: 0, s: 1, v: 1, a: 0.5 }), false, 'horizontal')).toBe(
      'linear-gradient(to right, transparent, #ff0000)',
    );
    expect(alphaSliderGradient(displayColor({ h: 0, s: 1, v: 1 }), true, 'vertical')).toBe(
      'linear-gradient(to top, #ff0000, transparent)',
    );
  });

  it('writes the value texts, each starting with its own channel (D22)', () => {
    const names = { saturation: 'Saturation', brightness: 'Brightness' };
    const darkBlue = displayColor({ h: 220, s: 0.72, v: 0.4 });
    expect(areaValueText(darkBlue, 'saturation', names)).toBe(
      'Saturation 72%, Brightness 40%, dark blue',
    );
    expect(areaValueText(darkBlue, 'value', names)).toBe('Brightness 40%, Saturation 72%, dark blue');
    expect(areaValueText(darkBlue, 'saturation', { ...names, colorName: () => '' })).toBe(
      'Saturation 72%, Brightness 40%',
    );
    expect(
      areaValueText(darkBlue, 'value', { ...names, valueText: (_color, channel) => `custom ${channel}` }),
    ).toBe('custom value');

    const brand = displayColor({ h: 210, s: 0.92, v: 0.74 });
    expect(sliderValueText(brand, 'hue', {})).toBe('210°, blue');
    expect(sliderValueText(brand, 'hue', { colorName: () => '' })).toBe('210°');
    expect(sliderValueText(brand, 'saturation', {})).toBe('92%');
    expect(sliderValueText(brand, 'value', {})).toBe('74%');

    const translucent = displayColor({ h: 0, s: 1, v: 1, a: 0.4 });
    expect(alphaValueText(translucent, false)).toBe('40%');
    expect(alphaValueText(translucent, true)).toBe('60%');
    expect(alphaValueText(displayColor({ h: 0, s: 1, v: 1 }), false)).toBe('100%');
    expect(alphaValueText(translucent, true, (_color, t) => (t ? 'clear' : 'solid'))).toBe('clear');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/colorUtils.test.ts -t "color part helpers"`
Expected: FAIL: the new names are not exported from `../colorUtils` (`displayHue is not a function`).

- [ ] **Step 3: Append the part helpers to `colorUtils.ts`**

Extend the imports at the top of `src/components/input/colorUtils.ts`:

```ts
import { clampUnit, hsvToHex, parseHexBytes, wrapHue } from '../../lib/color';
import { getArrowIntent, type Direction } from '../../lib/direction';
import type { HsvColor } from '../../lib/types';
import { getColorName } from './colorName';
```

Append at the end of the module:

```ts
// ---------------------------------------------------------------------------------------------
// The HSV color parts: ColorArea, ColorSlider and AlphaSlider (spec P3-05)
// ---------------------------------------------------------------------------------------------

/** The channels of an HSV color that a part edits or names in a value text. */
export type ColorChannel = 'hue' | 'saturation' | 'value' | 'alpha';

/** Which way a rail runs: left to right (mirrored in right-to-left layouts), or bottom to top. */
export type RailOrientation = 'horizontal' | 'vertical';

/** The modifier keys of a key press. */
export interface KeyModifiers {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * A hue as a part shows it: 0–360 kept as given (360 is the end of a hue rail), any other finite
 * hue wrapped into [0, 360), and a hue that is not finite as 0.
 */
export function displayHue(h: number): number {
  return Number.isFinite(h) && h >= 0 && h <= 360 ? h : wrapHue(h);
}

/**
 * A color as a part shows it: the hue for display, saturation and brightness clamped to [0, 1]
 * (not a number: 0) and alpha clamped to [0, 1] (left out or not a number: 1).
 */
export function displayColor(color: HsvColor): Required<HsvColor> {
  return {
    h: displayHue(color.h),
    s: clampUnit(color.s, 0),
    v: clampUnit(color.v, 0),
    a: clampUnit(color.a, 1),
  };
}

/** A 0–1 channel as the whole percentage the range inputs and value texts use. */
export function toPercent(value: number): number {
  return Math.round(value * 100);
}

/** A 0–1 position as a CSS percentage with at most two decimals, for an inline custom property. */
export function toPosition(value: number): string {
  return `${Math.round(value * 10000) / 100}%`;
}

/** Whether two colors have the same channels (a missing alpha equals 1). */
export function sameColor(a: HsvColor, b: HsvColor): boolean {
  return a.h === b.h && a.s === b.s && a.v === b.v && (a.a ?? 1) === (b.a ?? 1);
}

/**
 * The value a rail (a range from 0 to `max`) moves to for a key press, or `null` for a key it
 * leaves alone: ArrowUp and ArrowDown by 1; ArrowRight and ArrowLeft by 1 toward the reading
 * direction's end and start (so mirrored in right-to-left layouts); Shift with an arrow, Page Up
 * and Page Down by 10; Home and End to 0 and `max`. A key with Alt, Ctrl or Meta belongs to the
 * browser. The result is clamped to the range.
 */
export function railKeyTarget(
  key: string,
  modifiers: KeyModifiers,
  dir: Direction,
  current: number,
  max: number,
): number | null {
  if (modifiers.altKey || modifiers.ctrlKey || modifiers.metaKey) return null;
  const step = modifiers.shiftKey ? 10 : 1;
  let next: number;
  switch (key) {
    case 'ArrowUp':
      next = current + step;
      break;
    case 'ArrowDown':
      next = current - step;
      break;
    case 'ArrowRight':
    case 'ArrowLeft':
      next =
        current + (getArrowIntent(key, { orientation: 'horizontal', dir }) === 'next' ? step : -step);
      break;
    case 'PageUp':
      next = current + 10;
      break;
    case 'PageDown':
      next = current - 10;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = max;
      break;
    default:
      return null;
  }
  return Math.min(max, Math.max(0, next));
}

const toward = (orientation: RailOrientation) => (orientation === 'vertical' ? 'to top' : 'to right');

/** The field of a ColorArea at hue `h`: white to the pure hue left to right, black toward the bottom. */
export function colorAreaGradient(h: number): string {
  const hue = hsvToHex({ h, s: 1, v: 1 });
  // wave-allow-color: the saturation and brightness field of the user's color (runtime gradient)
  return `linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, ${hue})`;
}

// wave-allow-color: the hue spectrum of a hue rail (runtime gradient data, not a theme color)
const HUE_SPECTRUM = '#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000';

/**
 * The rail of a ColorSlider: the hue spectrum, gray to the full color at the color's brightness
 * (saturation), or black to the color at full brightness (brightness).
 */
export function colorSliderGradient(
  channel: 'hue' | 'saturation' | 'value',
  color: Required<HsvColor>,
  orientation: RailOrientation,
): string {
  const direction = toward(orientation);
  if (channel === 'hue') return `linear-gradient(${direction}, ${HUE_SPECTRUM})`;
  if (channel === 'saturation') {
    const gray = hsvToHex({ h: color.h, s: 0, v: color.v });
    const full = hsvToHex({ h: color.h, s: 1, v: color.v });
    return `linear-gradient(${direction}, ${gray}, ${full})`;
  }
  const bright = hsvToHex({ h: color.h, s: color.s, v: 1 });
  // wave-allow-color: the brightness rail runs from black to the color (runtime gradient)
  return `linear-gradient(${direction}, #000000, ${bright})`;
}

/** The rail of an AlphaSlider: transparent to the opaque color, or the reverse with `transparency`. */
export function alphaSliderGradient(
  color: Required<HsvColor>,
  transparency: boolean,
  orientation: RailOrientation,
): string {
  const opaque = hsvToHex({ h: color.h, s: color.s, v: color.v });
  const direction = toward(orientation);
  return transparency
    ? `linear-gradient(${direction}, ${opaque}, transparent)`
    : `linear-gradient(${direction}, transparent, ${opaque})`;
}

/**
 * The value text of one of ColorArea's inputs: its own channel first, then the other one, then
 * the color's name ("Saturation 72%, Brightness 40%, dark blue"). `colorName` replaces the namer
 * (`''` leaves the name out); `valueText` replaces the whole text.
 */
export function areaValueText(
  color: Required<HsvColor>,
  channel: 'saturation' | 'value',
  labels: {
    saturation: string;
    brightness: string;
    colorName?: (color: HsvColor) => string;
    valueText?: (color: HsvColor, channel: 'saturation' | 'value') => string;
  },
): string {
  if (labels.valueText) return labels.valueText(color, channel);
  const saturation = `${labels.saturation} ${toPercent(color.s)}%`;
  const brightness = `${labels.brightness} ${toPercent(color.v)}%`;
  const channels =
    channel === 'saturation' ? `${saturation}, ${brightness}` : `${brightness}, ${saturation}`;
  const name = (labels.colorName ?? getColorName)(color);
  return name ? `${channels}, ${name}` : channels;
}

/** The value text of a ColorSlider: "210°, blue" for hue, "72%" for saturation and brightness. */
export function sliderValueText(
  color: Required<HsvColor>,
  channel: 'hue' | 'saturation' | 'value',
  labels: {
    colorName?: (color: HsvColor) => string;
    valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value') => string;
  },
): string {
  if (labels.valueText) return labels.valueText(color, channel);
  if (channel !== 'hue') return `${toPercent(channel === 'saturation' ? color.s : color.v)}%`;
  const degrees = `${Math.round(color.h)}°`;
  const name = (labels.colorName ?? getColorName)(color);
  return name ? `${degrees}, ${name}` : degrees;
}

/** The value text of an AlphaSlider: the opacity ("40%"), or the transparency with `transparency`. */
export function alphaValueText(
  color: Required<HsvColor>,
  transparency: boolean,
  valueText?: (color: HsvColor, transparency: boolean) => string,
): string {
  if (valueText) return valueText(color, transparency);
  const opacity = toPercent(color.a);
  return `${transparency ? 100 - opacity : opacity}%`;
}

/**
 * The thumb of ColorArea, ColorSlider and AlphaSlider (decorative; the focused input is what
 * assistive technology reads): 24 px, filled from `--wave-color-thumb`, with a two-tone edge (a
 * `background` border inside a `foreground` ring) that shows on any color. Forced colors keep the
 * fill and draw the edge in system colors. Each part adds its own focus classes, keyed on its
 * named group, and its part class.
 */
export const COLOR_THUMB_CLASSES =
  'pointer-events-none absolute size-6 rounded-full border-2 border-background bg-(--wave-color-thumb) ring-1 ring-foreground forced-colors:forced-color-adjust-none forced-colors:border-[Canvas] forced-colors:ring-[CanvasText]';

/** The root of a horizontal ColorSlider or AlphaSlider (24 px, as tall as the thumb). */
export const RAIL_ROOT_HORIZONTAL = 'h-6 w-full items-center';
/** The root of a vertical one: a size container, so the turned input can be as long as it is tall. */
export const RAIL_ROOT_VERTICAL = 'h-40 w-6 flex-col items-center [container-type:size]';
/** The drawn rail, inset by half a thumb at both ends (a horizontal one mirrors in right-to-left layouts). */
export const RAIL_TRACK_HORIZONTAL = 'mx-3 h-3 flex-1 wave-rtl:-scale-x-100';
export const RAIL_TRACK_VERTICAL = 'my-3 w-3 flex-1';
/** The rail's gradient, read from the inline `--wave-color-slider-gradient` property. */
export const RAIL_GRADIENT = 'bg-(image:--wave-color-slider-gradient)';
/**
 * The native range input of a rail: over the whole slider and invisible, with its own thumb as
 * wide as the drawn one, so a press lands on the value under the drawn thumb.
 */
export const RAIL_INPUT_CLASSES =
  'absolute m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:size-6';
export const RAIL_INPUT_HORIZONTAL = 'inset-0 size-full';
/** Turned a quarter, so its start (the minimum) is at the bottom; it carries `dir="ltr"`. */
export const RAIL_INPUT_VERTICAL =
  'start-1/2 top-1/2 h-6 w-[100cqh] -translate-x-1/2 wave-rtl:translate-x-1/2 -translate-y-1/2 -rotate-90';
/** The box the thumb moves in: the rail's length, so its center meets the native thumb's. */
export const THUMB_TRACK_HORIZONTAL = 'pointer-events-none absolute inset-x-3 inset-y-0';
export const THUMB_TRACK_VERTICAL = 'pointer-events-none absolute inset-x-0 inset-y-3';
/** The thumb's place along the rail, read from the inline `--wave-color-slider-position` property. */
export const THUMB_POSITION_HORIZONTAL =
  'start-(--wave-color-slider-position) top-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 -translate-y-1/2';
export const THUMB_POSITION_VERTICAL =
  'bottom-(--wave-color-slider-position) start-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 translate-y-1/2';
```

- [ ] **Step 4: Run the helper tests**

Run: `npx vitest run src/components/input/__tests__/colorUtils.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing hook tests**

Create `src/components/input/__tests__/colorPartHarness.tsx`:

```tsx
import * as React from 'react';
import { hsvToHex } from '../../../lib/color';
import type { ColorPickerShape, HsvColor } from '../../../lib/types';
import {
  ColorPickerContext,
  DEFAULT_COLOR_PICKER_LABELS,
  type ColorPickerContextValue,
  type ColorPickerLabels,
} from '../ColorPicker.parts';
import { parseHexColor } from '../colorUtils';

/** Props of {@link PickerHarness}. */
export interface PickerHarnessProps {
  children: React.ReactNode;
  /** The working color it starts with. */
  initial?: HsvColor;
  shape?: ColorPickerShape;
  labels?: ColorPickerLabels;
  disabled?: boolean;
  /** Called with every color a bound part writes. */
  onHsvChange?: (hsv: HsvColor) => void;
}

const noop = () => {};

/**
 * Test-only stand-in for ColorPicker's context: the working color lives in state, so a bound
 * part reads back what it writes. The picker-only fields are inert.
 */
export function PickerHarness({
  children,
  initial = { h: 0, s: 1, v: 1 },
  shape = 'rounded',
  labels,
  disabled = false,
  onHsvChange,
}: PickerHarnessProps) {
  const [hsv, setHsv] = React.useState(initial);
  const value = React.useMemo<ColorPickerContextValue>(() => {
    const color = hsvToHex(hsv);
    return {
      hsv,
      setHsv: (next) => {
        setHsv(next);
        onHsvChange?.(next);
      },
      color,
      parsed: parseHexColor(color),
      setColor: noop,
      pickPreset: noop,
      presetItems: [],
      shape,
      labels: { ...DEFAULT_COLOR_PICKER_LABELS, ...labels },
      disabled,
      draftResetKey: 0,
      field: null,
      groupInvalid: undefined,
      errorMessageId: undefined,
      registerHexInput: noop,
    };
  }, [hsv, shape, labels, disabled, onHsvChange]);
  return <ColorPickerContext.Provider value={value}>{children}</ColorPickerContext.Provider>;
}
```

Create `src/components/input/__tests__/ColorPicker.parts.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_PART_COLOR, useColorPartState } from '../ColorPicker.parts';
import { PickerHarness } from './colorPartHarness';

function inPicker(props: { disabled?: boolean } = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PickerHarness initial={{ h: 120, s: 0.5, v: 0.5 }} disabled={props.disabled}>
        {children}
      </PickerHarness>
    );
  };
}

describe('useColorPartState (the binding rule, D21)', () => {
  it('binds to an enclosing picker without value and defaultValue, and still reports to onValueChange', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: undefined,
          onValueChange,
          disabled: false,
        }),
      { wrapper: inPicker() },
    );
    expect(result.current.picker).not.toBeNull();
    expect(result.current.color).toEqual({ h: 120, s: 0.5, v: 0.5 });
    act(() => result.current.setColor({ h: 120, s: 0.8, v: 0.5 }));
    expect(result.current.color).toEqual({ h: 120, s: 0.8, v: 0.5 });
    expect(onValueChange.mock.calls).toEqual([[{ h: 120, s: 0.8, v: 0.5 }]]);
  });

  it('stays independent with its own defaultValue inside a picker', () => {
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: { h: 10, s: 1, v: 1 },
          onValueChange: undefined,
          disabled: false,
        }),
      { wrapper: inPicker() },
    );
    expect(result.current.picker).toBeNull();
    expect(result.current.color).toEqual({ h: 10, s: 1, v: 1 });
  });

  it('keeps its own state outside a picker, starting from the brand blue', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useColorPartState({ value: undefined, defaultValue: undefined, onValueChange, disabled: false }),
    );
    expect(result.current.picker).toBeNull();
    expect(result.current.color).toBe(DEFAULT_PART_COLOR);
    act(() => result.current.setColor({ h: 0, s: 1, v: 1 }));
    expect(result.current.color).toEqual({ h: 0, s: 1, v: 1 });
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1 }]]);
  });

  it("takes the picker's disabled state while bound", () => {
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: undefined,
          onValueChange: undefined,
          disabled: false,
        }),
      { wrapper: inPicker({ disabled: true }) },
    );
    expect(result.current.disabled).toBe(true);
  });

  it('reset restores defaultValue and reports only a real change (a new but equal object is none)', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useColorPartState({
        value: undefined,
        defaultValue: { h: 10, s: 1, v: 1 },
        onValueChange,
        disabled: false,
      }),
    );
    act(() => result.current.reset());
    expect(onValueChange).not.toHaveBeenCalled();
    act(() => result.current.setColor({ h: 20, s: 1, v: 1 }));
    act(() => result.current.reset());
    expect(onValueChange.mock.calls).toEqual([[{ h: 20, s: 1, v: 1 }], [{ h: 10, s: 1, v: 1 }]]);
  });
});
```

- [ ] **Step 6: Run the hook tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/ColorPicker.parts.test.tsx`
Expected: FAIL with `Failed to resolve import "../ColorPicker.parts"`.

- [ ] **Step 7: Create `src/components/input/ColorPicker.parts.tsx`**

```tsx
import * as React from 'react';
import { useControllable } from '../../hooks/useControllable';
import type { FieldContextValue } from '../../hooks/useFieldControl';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import type { SwatchItem } from './SwatchPicker';
import { sameColor, type HexColor } from './colorUtils';

/*
 * The picker's labels and context, and how the standalone color parts bind to it (spec P3-05,
 * D21). `ColorArea`, `ColorSlider` and `AlphaSlider` read the context; `ColorPicker.tsx` provides
 * it and renders the picker-only parts. This module never imports `ColorPicker.tsx`.
 */

// wave-allow-color: default color value (user color data, C-TOKENS exception)
export const DEFAULT_COLOR = '#0f6cbd';

/** The default color of a standalone part: the default picker color in HSV. */
export const DEFAULT_PART_COLOR: HsvColor = { h: 208, s: 0.92, v: 0.74 };

/**
 * Texts of the ColorPicker's own parts and of the color parts bound to it, for localisation.
 * Every key is optional; missing keys use the English default.
 */
export interface ColorPickerLabels {
  /** Visible caption above the hex field.
   * @default 'Hex'
   */
  hex?: string;
  /** Accessible name of the hex text field.
   * @default 'Hex color value'
   */
  hexInput?: string;
  /** Error text shown (and used as the hex field's description) while the typed text can never be
   * a hex color, or when the field is left with text that is not one (such as `#12345`).
   * @default 'Enter a hex color such as #0f6cbd.'
   */
  hexError?: string;
  /** Accessible name of the preset swatches radiogroup.
   * @default 'Preset colors'
   */
  presets?: string;
  /** Visible label of the opacity row and accessible name of the opacity slider (a bound
   * `AlphaSlider`).
   * @default 'Opacity'
   */
  opacity?: string;
  /** Accessible name of a bound `ColorArea`'s group.
   * @default 'Saturation and brightness'
   */
  area?: string;
  /** Name of a bound area's saturation slider and of a bound `channel="saturation"` slider.
   * @default 'Saturation'
   */
  saturation?: string;
  /** Name of a bound area's brightness slider and of a bound `channel="value"` slider.
   * @default 'Brightness'
   */
  brightness?: string;
  /** Role description of a bound area's two sliders.
   * @default '2D slider'
   */
  roleDescription?: string;
  /** Name of a bound hue slider.
   * @default 'Hue'
   */
  hue?: string;
  /** Name of a bound `AlphaSlider` with `transparency`.
   * @default 'Transparency'
   */
  transparency?: string;
  /** Names the color at the end of the bound parts' value texts; return `''` to leave it out.
   * @default an English namer ("dark blue")
   */
  colorName?: (color: HsvColor) => string;
  /** Replaces a whole value text of a bound part, for languages whose order differs. */
  valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value' | 'alpha') => string;
}

/** The labels with every string default filled in (the two functions stay optional). */
export type ResolvedColorPickerLabels = Required<Omit<ColorPickerLabels, 'colorName' | 'valueText'>> &
  Pick<ColorPickerLabels, 'colorName' | 'valueText'>;

export const DEFAULT_COLOR_PICKER_LABELS: ResolvedColorPickerLabels = {
  hex: 'Hex',
  hexInput: 'Hex color value',
  hexError: `Enter a hex color such as ${DEFAULT_COLOR}.`,
  presets: 'Preset colors',
  opacity: 'Opacity',
  area: 'Saturation and brightness',
  saturation: 'Saturation',
  brightness: 'Brightness',
  roleDescription: '2D slider',
  hue: 'Hue',
  transparency: 'Transparency',
};

/** What a ColorPicker shares with its parts and with the color parts bound to it. */
export interface ColorPickerContextValue {
  /** The working color: HSV, so hue and saturation survive gray, white and black. */
  hsv: HsvColor;
  /** Writes the working color from a bound part and reports its hex (only when the hex changes). */
  setHsv: (next: HsvColor) => void;
  /** The picker's value as given: a hex string, or a value that is not one (as given). */
  color: string;
  /** The value parsed (`#rrggbb` and the alpha byte), `null` while it is not a hex color. */
  parsed: HexColor | null;
  /** Writes the value as hex text (the hex field). */
  setColor: (next: string) => void;
  /** Applies a preset's `#rrggbb` at the current opacity and drops the hex field's draft. */
  pickPreset: (rgb: string) => void;
  /** The picker's presets as swatch items (values are `#rrggbb`). */
  presetItems: readonly SwatchItem[];
  /** The picker's `shape`, inherited by the bound parts and `ColorPicker.Preview`. */
  shape: ColorPickerShape;
  /** The picker's labels with every string default filled in. */
  labels: ResolvedColorPickerLabels;
  /** `true` while the value is not a hex color: the bound parts are disabled until one arrives. */
  disabled: boolean;
  /** Changes whenever the hex field must drop its draft: a form reset or a preset pick. */
  draftResetKey: number;
  /** The Field around the picker (its parts render in a `null` Field context). */
  field: FieldContextValue | null;
  /** The invalid state set on the picker from outside (its `aria-invalid` or the Field's), as given. */
  groupInvalid: React.AriaAttributes['aria-invalid'];
  /** The consumer's `aria-errormessage`, routed to the hex field while that state is set. */
  errorMessageId: string | undefined;
  /** The hex field registers its `<input>` here (the hidden input's `onInvalid` focuses it). */
  registerHexInput: (input: HTMLInputElement | null) => void;
}

export const ColorPickerContext = React.createContext<ColorPickerContextValue | null>(null);
ColorPickerContext.displayName = 'ColorPickerContext';

/** The enclosing ColorPicker's context, or `null` outside one (the standalone parts need none). */
export function useColorPickerContext(): ColorPickerContextValue | null {
  return React.useContext(ColorPickerContext);
}

/** What a color part passes to {@link useColorPartState}. */
export interface ColorPartOptions {
  value: HsvColor | undefined;
  defaultValue: HsvColor | undefined;
  onValueChange: ((value: HsvColor) => void) | undefined;
  disabled: boolean;
}

/** Where a color part's color lives: in the enclosing picker (bound) or in the part. */
export interface ColorPartState {
  /** The enclosing picker when the part binds to it, else `null`. */
  picker: ColorPickerContextValue | null;
  /** The color as given (bound: the picker's working color). */
  color: HsvColor;
  /**
   * Writes a new color. Bound: the picker's working color, then the part's own `onValueChange`
   * (a part given only the callback listens; C-NAMING). Otherwise the part's state, through
   * `useControllable`.
   */
  setColor: (next: HsvColor) => void;
  /** Restores `defaultValue` on a form reset, reporting only a real change; nothing while bound. */
  reset: () => void;
  /** The part's `disabled`, or the picker's disabled state while bound. */
  disabled: boolean;
}

const noop = () => {};

/**
 * The binding rule of `ColorArea`, `ColorSlider` and `AlphaSlider` (D21): inside a ColorPicker, a
 * part with neither `value` nor `defaultValue` reads and writes the picker's working color;
 * anywhere else, or with either prop, it keeps its own color.
 */
export function useColorPartState({
  value,
  defaultValue,
  onValueChange,
  disabled,
}: ColorPartOptions): ColorPartState {
  const context = useColorPickerContext();
  const picker = context !== null && value === undefined && defaultValue === undefined ? context : null;
  const initial = defaultValue ?? DEFAULT_PART_COLOR;
  const [own, setOwn] = useControllable(value, initial, picker ? undefined : onValueChange);
  if (picker) {
    return {
      picker,
      color: picker.hsv,
      setColor: (next) => {
        picker.setHsv(next);
        onValueChange?.(next);
      },
      reset: noop,
      disabled: disabled || picker.disabled,
    };
  }
  return {
    picker: null,
    color: own,
    setColor: setOwn,
    reset: () => {
      if (!sameColor(own, initial)) setOwn(initial);
    },
    disabled,
  };
}
```

- [ ] **Step 8: Move the labels out of `ColorPicker.tsx`**

In `src/components/input/ColorPicker.tsx`:

1. Delete the `ColorPickerLabels` interface (0.7 lines 37–63, from `/**` "Texts of the ColorPicker's own parts" to the closing `}`).
2. Delete these lines (0.7 lines 122–131):

```ts
// wave-allow-color: default color value (user color data, C-TOKENS exception)
const DEFAULT_COLOR = '#0f6cbd';

const DEFAULT_LABELS: Required<ColorPickerLabels> = {
  hex: 'Hex',
  hexInput: 'Hex color value',
  hexError: `Enter a hex color such as ${DEFAULT_COLOR}.`,
  presets: 'Preset colors',
  opacity: 'Opacity',
};
```

3. Add, after the `import type { SwatchItem } from './SwatchPicker';` line:

```ts
import {
  DEFAULT_COLOR,
  DEFAULT_COLOR_PICKER_LABELS,
  type ColorPickerLabels,
} from './ColorPicker.parts';

export type { ColorPickerLabels };
```

4. Replace `const strings = { ...DEFAULT_LABELS, ...labels };` with `const strings = { ...DEFAULT_COLOR_PICKER_LABELS, ...labels };`.

Nothing else changes (the barrel still imports `ColorPickerLabels` from `./ColorPicker`, which re-exports it).

- [ ] **Step 9: Run the hook tests and the ColorPicker regression**

Run: `npx vitest run src/components/input/__tests__/ColorPicker.parts.test.tsx src/components/input/__tests__/ColorPicker.test.tsx`
Expected: PASS.

- [ ] **Step 10: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/colorUtils.ts src/components/input/ColorPicker.parts.tsx src/components/input/ColorPicker.tsx src/components/input/__tests__/colorUtils.test.ts src/components/input/__tests__/colorPartHarness.tsx src/components/input/__tests__/ColorPicker.parts.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/colorUtils.ts" && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/ColorPicker"`
Expected: PASS. The two hex literals of `colorUtils.ts` sit on lines directly below a `wave-allow-color:` comment, and the rail recipes pair every `translate-x` class with its `wave-rtl:` counterpart on the same line.

- [ ] **Step 11: Commit**

```bash
git add src/components/input/colorUtils.ts src/components/input/ColorPicker.parts.tsx src/components/input/ColorPicker.tsx src/components/input/__tests__/colorUtils.test.ts src/components/input/__tests__/colorPartHarness.tsx src/components/input/__tests__/ColorPicker.parts.test.tsx
git commit -m "feat(input): color part helpers, the picker context and the binding hook"
```

---

### Task C5: `ColorSlider`

**Files:**
- Create: `src/components/input/ColorSlider.tsx`
- Create: `src/components/input/__tests__/ColorSlider.test.tsx`

**Interfaces:**
- Consumes: `useColorPartState` (C4); from `colorUtils.ts` (C4): `COLOR_THUMB_CLASSES`, `RAIL_*`, `THUMB_*`, `colorSliderGradient`, `displayColor`, `railKeyTarget`, `sliderValueText`, `toPercent`, `toPosition`; `hsvToHex` (C1); `colorSliderClassNames` (registry, wave A); `PickerHarness` (C4, tests).
- Produces: `export interface ColorSliderLabels`, `export interface ColorSliderProps`, `export const ColorSlider` (displayName `'ColorSlider'`). `AlphaSlider` (C6) derives its props from `ColorSliderProps`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/input/__tests__/ColorSlider.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { ColorSlider, type ColorSliderProps } from '../ColorSlider';
import { colorSliderClassNames } from '../../../lib/classNames';
import type { HsvColor, Orientation } from '../../../lib/types';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { PickerHarness } from './colorPartHarness';

const BRAND: HsvColor = { h: 210, s: 0.92, v: 0.74 };
const slider = (name = 'Hue') => screen.getByRole('slider', { name });
const rootOf = (input: HTMLElement) =>
  input.closest<HTMLElement>(`.${colorSliderClassNames.root}`) as HTMLElement;
const railOf = (input: HTMLElement) =>
  rootOf(input).querySelector<HTMLElement>(`.${colorSliderClassNames.rail}`) as HTMLElement;
const thumbOf = (input: HTMLElement) =>
  rootOf(input).querySelector<HTMLElement>(`.${colorSliderClassNames.thumb}`) as HTMLElement;

describe('ColorSlider', () => {
  testSystemProps(ColorSlider, {
    expectedTag: 'div',
    displayName: 'ColorSlider',
    control: { role: 'slider' },
    a11yVariants: [
      { name: 'saturation', props: { channel: 'saturation' } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'disabled', props: { disabled: true } },
      { name: 'in a form', props: { name: 'accent', required: true } },
    ],
  });

  it('is a hue slider named "Hue", 0–360, whose value text names the color', () => {
    render(<ColorSlider defaultValue={BRAND} />);
    const input = slider();
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '360');
    expect(input).toHaveValue('210');
    expect(input).toHaveAttribute('aria-valuetext', '210°, blue');
  });

  it.each([
    ['saturation', 'Saturation', '92', '92%'],
    ['value', 'Brightness', '74', '74%'],
  ] as const)('channel="%s" is named "%s", runs 0–100 and says the percentage', (channel, name, value, text) => {
    render(<ColorSlider channel={channel} defaultValue={BRAND} />);
    const input = slider(name);
    expect(input).toHaveAttribute('max', '100');
    expect(input).toHaveValue(value);
    expect(input).toHaveAttribute('aria-valuetext', text);
  });

  it('always renders data-orientation and data-channel, and data-disabled while disabled', () => {
    const { rerender } = render(<ColorSlider />);
    const root = rootOf(slider());
    expect(root).toHaveAttribute('data-orientation', 'horizontal');
    expect(root).toHaveAttribute('data-channel', 'hue');
    expect(root).not.toHaveAttribute('data-disabled');
    rerender(<ColorSlider orientation="vertical" channel="saturation" disabled />);
    expect(root).toHaveAttribute('data-orientation', 'vertical');
    expect(root).toHaveAttribute('data-channel', 'saturation');
    expect(root).toHaveAttribute('data-disabled', '');
    expect(slider('Saturation')).toBeDisabled();
  });

  it('draws the rail from --wave-color-slider-gradient and places and styles the thumb', () => {
    render(<ColorSlider channel="saturation" defaultValue={{ h: 0, s: 0.5, v: 1 }} />);
    const input = slider('Saturation');
    const root = rootOf(input);
    expect(root.style.getPropertyValue('--wave-color-slider-gradient')).toBe(
      'linear-gradient(to right, #ffffff, #ff0000)',
    );
    expect(root.style.getPropertyValue('--wave-color-slider-position')).toBe('50%');
    expect(root.style.getPropertyValue('--wave-color-thumb')).toBe('#ff8080');
    expect(railOf(input)).toHaveClass('bg-(image:--wave-color-slider-gradient)', 'wave-rtl:-scale-x-100');
    expect(thumbOf(input)).toHaveClass(
      'size-6',
      'group-has-[:focus-visible]/color-slider:outline-2',
      'group-has-[:focus-visible]/color-slider:outline-ring',
      'group-has-[:focus-visible]/color-slider:ring-background',
    );
    expect(root).toHaveClass('group/color-slider');
  });

  it('shape="square" removes the corner radius of the rail', () => {
    render(<ColorSlider shape="square" />);
    expect(railOf(slider())).toHaveClass('rounded-none');
    expect(railOf(slider())).not.toHaveClass('rounded-full');
  });

  describe('keyboard', () => {
    it.each([
      ['{ArrowRight}', 51],
      ['{ArrowUp}', 51],
      ['{ArrowLeft}', 49],
      ['{ArrowDown}', 49],
      ['{Shift>}{ArrowRight}{/Shift}', 60],
      ['{PageUp}', 60],
      ['{PageDown}', 40],
      ['{Home}', 0],
      ['{End}', 100],
    ])('%s moves a saturation slider to %s %%', async (keys, percent) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorSlider
          channel="saturation"
          defaultValue={{ h: 0, s: 0.5, v: 1 }}
          onValueChange={onValueChange}
        />,
      );
      act(() => slider('Saturation').focus());
      await user.keyboard(keys);
      expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: percent / 100, v: 1 }]]);
    });

    it('moves the hue by degrees; End keeps the thumb at the end and reports h: 360', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<ColorSlider defaultValue={{ h: 350, s: 1, v: 1 }} onValueChange={onValueChange} />);
      act(() => slider().focus());
      await user.keyboard('{End}');
      expect(onValueChange.mock.calls).toEqual([[{ h: 360, s: 1, v: 1 }]]);
      expect(slider()).toHaveValue('360');
      expect(rootOf(slider()).style.getPropertyValue('--wave-color-slider-position')).toBe('100%');
    });

    it('a key at the end of the range changes and reports nothing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<ColorSlider channel="value" defaultValue={{ h: 0, s: 1, v: 1 }} onValueChange={onValueChange} />);
      act(() => slider('Brightness').focus());
      await user.keyboard('{End}{ArrowUp}');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('mirrors the horizontal arrows in right-to-left layouts', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <ColorSlider channel="saturation" defaultValue={{ h: 0, s: 0.5, v: 1 }} onValueChange={onValueChange} />,
        { dir: 'rtl' },
      );
      act(() => slider('Saturation').focus());
      await user.keyboard('{ArrowLeft}');
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 0.51, v: 1 });
    });

    it('a vertical slider keeps the bottom as the minimum in right-to-left layouts: Up and Right increase', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <ColorSlider
          orientation="vertical"
          channel="value"
          defaultValue={{ h: 0, s: 1, v: 0.5 }}
          onValueChange={onValueChange}
        />,
        { dir: 'rtl' },
      );
      const input = slider('Brightness');
      expect(input).toHaveAttribute('aria-orientation', 'vertical');
      expect(input).toHaveAttribute('dir', 'ltr');
      expect(railOf(input)).not.toHaveClass('wave-rtl:-scale-x-100');
      act(() => input.focus());
      await user.keyboard('{ArrowUp}');
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 1, v: 0.51 });
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 1, v: 0.52 });
    });

    it('leaves browser shortcuts alone: Alt, Ctrl or Meta with a key is neither handled nor prevented', () => {
      const onValueChange = vi.fn();
      render(<ColorSlider channel="saturation" defaultValue={{ h: 0, s: 0.5, v: 1 }} onValueChange={onValueChange} />);
      const input = slider('Saturation');
      expect(fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'Home', ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'End', metaKey: true })).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("runs the consumer's onKeyDown first; preventDefault() keeps the value", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorSlider
          defaultValue={{ h: 10, s: 1, v: 1 }}
          onValueChange={onValueChange}
          onKeyDown={(event) => event.preventDefault()}
        />,
      );
      act(() => slider().focus());
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  it('applies the change events assistive technology sends', () => {
    const onValueChange = vi.fn();
    render(<ColorSlider defaultValue={{ h: 10, s: 1, v: 1 }} onValueChange={onValueChange} />);
    fireEvent.change(slider(), { target: { value: '120' } });
    expect(onValueChange.mock.calls).toEqual([[{ h: 120, s: 1, v: 1 }]]);
  });

  it('shows an out-of-range or non-finite color clamped, steps from there and writes no NaN', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <ColorSlider aria-label="Wrapped hue" value={{ h: 720, s: 1.5, v: Number.NaN }} />
        <ColorSlider
          aria-label="Clamped saturation"
          channel="saturation"
          value={{ h: -30, s: 1.5, v: Number.NaN }}
          onValueChange={onValueChange}
        />
      </>,
    );
    expect(slider('Wrapped hue')).toHaveValue('0');
    expect(slider('Clamped saturation')).toHaveValue('100');
    for (const input of screen.getAllByRole('slider')) {
      expect(rootOf(input).getAttribute('style')).not.toMatch(/NaN/);
    }
    act(() => slider('Clamped saturation').focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith({ h: -30, s: 0.99, v: Number.NaN });
  });

  it('keeps a controlled value whose parent ignores onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorSlider value={{ h: 10, s: 1, v: 1 }} onValueChange={onValueChange} />);
    act(() => slider().focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[{ h: 11, s: 1, v: 1 }], [{ h: 11, s: 1, v: 1 }]]);
    expect(slider()).toHaveValue('10');
  });

  it('reports each change once in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <ColorSlider defaultValue={{ h: 10, s: 1, v: 1 }} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    act(() => slider().focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  describe('naming and routing (C-ROUTING)', () => {
    it('the Field label names the input, not "Hue"', () => {
      renderWithFieldContext(<ColorSlider />);
      expect(screen.getByRole('slider', { name: FIELD_TEST_TEXT.label })).toHaveAttribute(
        'id',
        FIELD_TEST_IDS.controlId,
      );
      expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull();
    });

    it('a consumer aria-label or aria-labelledby wins over the built-in name', () => {
      render(
        <>
          <ColorSlider aria-label="Tint" />
          <span id="shade-label">Shade</span>
          <ColorSlider channel="value" aria-labelledby="shade-label" />
        </>,
      );
      expect(slider('Tint')).toBeInTheDocument();
      expect(slider('Shade')).toBeInTheDocument();
      expect(screen.queryByRole('slider', { name: 'Brightness' })).toBeNull();
    });

    it('routes id, aria-describedby, aria-invalid, aria-errormessage, aria-details, tabIndex and controlRef to the input', () => {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <>
          <ColorSlider
            data-testid="root"
            id="hue"
            aria-describedby="hint"
            aria-invalid
            aria-errormessage="error"
            aria-details="more"
            tabIndex={-1}
            controlRef={controlRef}
          />
          <span id="hint">Pick a hue</span>
          <span id="error">Out of gamut</span>
          <span id="more">Details</span>
        </>,
      );
      const input = slider();
      expect(controlRef.current).toBe(input);
      expect(input).toHaveAttribute('id', 'hue');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-errormessage', 'error');
      expect(input).toHaveAttribute('aria-details', 'more');
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input).toHaveAccessibleDescription('Pick a hue');
      const root = screen.getByTestId('root');
      expect(root).not.toHaveAttribute('id');
      expect(root).not.toHaveAttribute('aria-invalid');
    });

    it('never puts aria-required on the slider: required and aria-required make the hidden input required', () => {
      const { container } = render(
        <form aria-label="Form">
          <ColorSlider aria-required />
        </form>,
      );
      expect(slider()).not.toHaveAttribute('aria-required');
      expect(slider()).not.toBeRequired();
      expect(container.querySelectorAll('input[required]')).toHaveLength(1);
    });
  });

  describe('forms (C-FORMS)', () => {
    it('submits the color as hex under its name; a form reset restores defaultValue', () => {
      const onValueChange = vi.fn();
      render(
        <form aria-label="Form">
          <ColorSlider name="hue" defaultValue={{ h: 0, s: 1, v: 1 }} onValueChange={onValueChange} />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(new FormData(form).get('hue')).toBe('#ff0000');
      fireEvent.change(slider(), { target: { value: '120' } });
      expect(new FormData(form).get('hue')).toBe('#00ff00');
      act(() => form.reset());
      expect(new FormData(form).get('hue')).toBe('#ff0000');
      expect(onValueChange.mock.calls).toEqual([[{ h: 120, s: 1, v: 1 }], [{ h: 0, s: 1, v: 1 }]]);
    });

    it('adds nothing to the form without name or required', () => {
      render(
        <form aria-label="Form">
          <ColorSlider />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
    });
  });

  describe('inside a ColorPicker (bound)', () => {
    it("reads and writes the picker's working color, takes its shape and labels, and renders no hidden input", async () => {
      const user = userEvent.setup();
      const onHsvChange = vi.fn();
      const { container } = render(
        <form aria-label="Form">
          <PickerHarness
            initial={{ h: 100, s: 1, v: 1 }}
            shape="square"
            labels={{ hue: 'Farbton' }}
            onHsvChange={onHsvChange}
          >
            <ColorSlider name="ignored" />
          </PickerHarness>
        </form>,
      );
      const input = slider('Farbton');
      expect(input).toHaveValue('100');
      expect(railOf(input)).toHaveClass('rounded-none');
      act(() => input.focus());
      await user.keyboard('{ArrowRight}');
      expect(onHsvChange.mock.calls).toEqual([[{ h: 101, s: 1, v: 1 }]]);
      expect(input).toHaveValue('101');
      expect(container.querySelector('input[name="ignored"]')).toBeNull();
    });

    it('is disabled while the picker is', () => {
      render(
        <PickerHarness disabled>
          <ColorSlider />
        </PickerHarness>,
      );
      expect(slider()).toBeDisabled();
      expect(rootOf(slider())).toHaveAttribute('data-disabled', '');
    });

    it('stays independent with its own defaultValue', async () => {
      const user = userEvent.setup();
      const onHsvChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <PickerHarness onHsvChange={onHsvChange}>
          <ColorSlider defaultValue={{ h: 30, s: 1, v: 1 }} onValueChange={onValueChange} />
        </PickerHarness>,
      );
      act(() => slider().focus());
      await user.keyboard('{ArrowRight}');
      expect(onValueChange.mock.calls).toEqual([[{ h: 31, s: 1, v: 1 }]]);
      expect(onHsvChange).not.toHaveBeenCalled();
    });
  });

  it('renders on the server and hydrates without warnings', () => {
    const ui = <ColorSlider channel="saturation" defaultValue={BRAND} />;
    const html = renderToString(ui);
    expect(html).toContain('--wave-color-slider-gradient');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, ui);
      });
      expect(error).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
    }
  });

  it('types: the channel and orientation unions', () => {
    expectTypeOf<ColorSliderProps['channel']>().toEqualTypeOf<
      'hue' | 'saturation' | 'value' | undefined
    >();
    expectTypeOf<ColorSliderProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    expectTypeOf<ColorSliderProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    // @ts-expect-error alpha has its own component, AlphaSlider
    const alpha = <ColorSlider channel="alpha" />;
    expect(alpha).toBeTruthy();
  });
});
```

(`#ff8080` is `hsvToHex({ h: 0, s: 0.5, v: 1 })`: the thumb of a saturation slider shows the color itself.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/ColorSlider.test.tsx`
Expected: FAIL with `Failed to resolve import "../ColorSlider"`.

- [ ] **Step 3: Create `src/components/input/ColorSlider.tsx`**

```tsx
import * as React from 'react';
import { colorSliderClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { hsvToHex } from '../../lib/color';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getDirection } from '../../lib/direction';
import type { ColorPickerShape, HsvColor, Orientation } from '../../lib/types';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { useColorPartState } from './ColorPicker.parts';
import {
  COLOR_THUMB_CLASSES,
  RAIL_GRADIENT,
  RAIL_INPUT_CLASSES,
  RAIL_INPUT_HORIZONTAL,
  RAIL_INPUT_VERTICAL,
  RAIL_ROOT_HORIZONTAL,
  RAIL_ROOT_VERTICAL,
  RAIL_TRACK_HORIZONTAL,
  RAIL_TRACK_VERTICAL,
  THUMB_POSITION_HORIZONTAL,
  THUMB_POSITION_VERTICAL,
  THUMB_TRACK_HORIZONTAL,
  THUMB_TRACK_VERTICAL,
  colorSliderGradient,
  displayColor,
  railKeyTarget,
  sliderValueText,
  toPercent,
  toPosition,
} from './colorUtils';

/** Texts of a ColorSlider, for localisation. Every key is optional. */
export interface ColorSliderLabels {
  /** Name of a hue slider.
   * @default 'Hue'
   */
  hue?: string;
  /** Name of a `channel="saturation"` slider.
   * @default 'Saturation'
   */
  saturation?: string;
  /** Name of a `channel="value"` slider.
   * @default 'Brightness'
   */
  brightness?: string;
  /** Names the color at the end of a hue slider's value text; return `''` to leave it out.
   * @default an English namer ("blue")
   */
  colorName?: (color: HsvColor) => string;
  /** Replaces the value text, for languages whose order differs. */
  valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value') => string;
}

/** Properties for the ColorSlider component. */
export interface ColorSliderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  /** The channel the slider edits.
   * @default 'hue'
   */
  channel?: 'hue' | 'saturation' | 'value';
  /** `'vertical'` draws the rail from bottom to top (Fluent's `vertical`).
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /**
   * The color (Fluent's `color`). Inside a ColorPicker, leave `value` and `defaultValue` out to
   * bind the slider to the picker.
   */
  value?: HsvColor;
  /**
   * Initial color for uncontrolled usage (also what a form reset restores).
   * @default the brand blue, `{ h: 208, s: 0.92, v: 0.74 }` (`#0f6cbd`)
   */
  defaultValue?: HsvColor;
  /**
   * Called with the new color on every step (a key, the pointer or assistive technology) that
   * changes it (Fluent's `onChange`). A bound slider calls it too.
   */
  onValueChange?: (value: HsvColor) => void;
  /**
   * `'square'` removes the corner radius of the rail (the thumb stays round). Bound to a
   * ColorPicker, the picker's shape unless you pass one.
   * @default 'rounded'
   */
  shape?: ColorPickerShape;
  /** Texts of the slider; bound to a ColorPicker, the picker's `labels` fill the keys you leave out. */
  labels?: ColorSliderLabels;
  /**
   * Unavailable: the input is natively disabled and the slider dimmed. A bound slider is also
   * disabled while the picker's value is not a hex color.
   * @default false
   */
  disabled?: boolean;
  /** Form field name: the color is submitted as hex (`hsvToHex`). Ignored while bound to a ColorPicker. */
  name?: string;
  /** Id of the form the slider belongs to, when it is rendered outside that form. */
  form?: string;
  /**
   * Marks the hidden form input required (a color is always set, so it never blocks). A consumer
   * `aria-required` does the same: a slider supports neither, so neither is set on it.
   */
  required?: boolean;
  /** Ref to the `<input type="range">`. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root element. */
  ref?: React.Ref<HTMLDivElement>;
}

const DEFAULT_LABELS = { hue: 'Hue', saturation: 'Saturation', brightness: 'Brightness' } as const;

/** The `labels` key that names each channel. */
const NAME_KEY = { hue: 'hue', saturation: 'saturation', value: 'brightness' } as const;

/**
 * A slider for one channel of an HSV color: hue (the default), saturation or brightness
 * (`channel="value"`), horizontal (mirrored in right-to-left layouts) or vertical (bottom to top).
 * The arrow keys move by 1 (hue in degrees, the others in percent), Shift with an arrow and Page
 * Up or Page Down by 10, Home and End to the ends. It is named by `aria-label`, else the
 * surrounding Field's label, else "Hue", "Saturation" or "Brightness"; a hue slider's value text
 * names the color ("210°, blue"). Inside a ColorPicker, leave `value` and `defaultValue` out and
 * it binds to the picker. Fluent's `ColorSlider`, with `value`/`onValueChange` for its
 * `color`/`onChange` and `orientation` for its `vertical`.
 *
 * @example
 * <ColorSlider value={color} onValueChange={setColor} />
 */
export const ColorSlider = ({
  channel = 'hue',
  orientation = 'horizontal',
  value,
  defaultValue,
  onValueChange,
  shape,
  labels,
  disabled = false,
  name,
  form,
  required,
  controlRef,
  className,
  style,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  autoFocus,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  ref,
  ...rest
}: ColorSliderProps) => {
  const part = useColorPartState({ value, defaultValue, onValueChange, disabled });
  const { picker } = part;
  const strings = {
    ...DEFAULT_LABELS,
    ...(picker && {
      hue: picker.labels.hue,
      saturation: picker.labels.saturation,
      brightness: picker.labels.brightness,
      colorName: picker.labels.colorName,
      valueText: picker.labels.valueText,
    }),
    ...labels,
  };
  const resolvedShape = shape ?? picker?.shape ?? 'rounded';
  const vertical = orientation === 'vertical';
  const shown = displayColor(part.color);
  const max = channel === 'hue' ? 360 : 100;
  const current =
    channel === 'hue' ? Math.round(shown.h) : toPercent(channel === 'saturation' ? shown.s : shown.v);

  const field = useFieldContext();
  const fieldProps = useFieldControl({
    id,
    // The built-in name only without a Field: an aria-label would beat the Field's <label for>.
    'aria-label':
      ariaLabel ??
      (field === null && ariaLabelledBy === undefined ? strings[NAME_KEY[channel]] : undefined),
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  });
  // A slider supports neither aria-required nor a native `required`: the hidden input carries it.
  const { 'aria-required': _ariaRequired, required: _required, ...inputFieldProps } = fieldProps;
  const invalid = inputFieldProps['aria-invalid'];
  const isInvalid = invalid !== undefined && invalid !== false && invalid !== 'false';
  const isRequired =
    required ?? (ariaRequired === true || ariaRequired === 'true' || (field?.required ?? false));

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedControlRef = useMergedRefs(inputRef, controlRef);
  useFormReset(inputRef, part.reset, form);

  /** Applies a value of the slider's range (the hue in degrees, the others in percent). */
  const apply = (next: number) => {
    if (next === current) return;
    const color = part.color;
    part.setColor(
      channel === 'hue'
        ? { ...color, h: next }
        : channel === 'saturation'
          ? { ...color, s: next / 100 }
          : { ...color, v: next / 100 },
    );
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (part.disabled || event.nativeEvent.isComposing) return;
      const target = railKeyTarget(event.key, event, getDirection(event.currentTarget), current, max);
      if (target === null) return;
      event.preventDefault();
      apply(target);
    },
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (part.disabled) return;
    apply(Math.min(max, Math.max(0, Math.round(Number(event.currentTarget.value)))));
  };

  const sliderStyle = {
    ...style,
    '--wave-color-slider-gradient': colorSliderGradient(channel, shown, orientation),
    '--wave-color-slider-position': toPosition(current / max),
    '--wave-color-thumb':
      channel === 'hue'
        ? hsvToHex({ h: shown.h, s: 1, v: 1 })
        : hsvToHex({ h: shown.h, s: shown.s, v: shown.v }),
  } as React.CSSProperties;

  return (
    <div
      data-orientation={orientation}
      data-channel={channel}
      data-disabled={part.disabled ? '' : undefined}
      className={cn(
        colorSliderClassNames.root,
        'group/color-slider relative flex touch-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        vertical ? RAIL_ROOT_VERTICAL : RAIL_ROOT_HORIZONTAL,
        className,
      )}
      style={sliderStyle}
      {...rest}
      ref={ref}
    >
      <div
        aria-hidden="true"
        className={cn(
          colorSliderClassNames.rail,
          'rounded-full forced-colors:forced-color-adjust-none',
          RAIL_GRADIENT,
          vertical ? RAIL_TRACK_VERTICAL : RAIL_TRACK_HORIZONTAL,
          resolvedShape === 'square' && 'rounded-none',
        )}
      />
      <input
        type="range"
        {...inputFieldProps}
        ref={mergedControlRef}
        min={0}
        max={max}
        step={1}
        value={current}
        disabled={part.disabled}
        dir={vertical ? 'ltr' : undefined}
        aria-orientation={vertical ? 'vertical' : undefined}
        aria-valuetext={sliderValueText(shown, channel, strings)}
        aria-errormessage={(isInvalid && ariaErrorMessage) || undefined}
        aria-details={ariaDetails}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onChange={handleChange}
        className={cn(RAIL_INPUT_CLASSES, vertical ? RAIL_INPUT_VERTICAL : RAIL_INPUT_HORIZONTAL)}
      />
      <span aria-hidden="true" className={vertical ? THUMB_TRACK_VERTICAL : THUMB_TRACK_HORIZONTAL}>
        <span
          className={cn(
            colorSliderClassNames.thumb,
            COLOR_THUMB_CLASSES,
            vertical ? THUMB_POSITION_VERTICAL : THUMB_POSITION_HORIZONTAL,
            'group-has-[:focus-visible]/color-slider:ring-2 group-has-[:focus-visible]/color-slider:ring-background group-has-[:focus-visible]/color-slider:outline-2 group-has-[:focus-visible]/color-slider:outline-offset-2 group-has-[:focus-visible]/color-slider:outline-ring forced-colors:group-has-[:focus-visible]/color-slider:outline-[Highlight]',
          )}
        />
      </span>
      {!picker && (
        <HiddenInput
          type="text"
          name={name}
          form={form}
          value={hsvToHex(part.color)}
          required={isRequired}
          onInvalid={() => inputRef.current?.focus()}
        />
      )}
    </div>
  );
};

ColorSlider.displayName = 'ColorSlider';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/input/__tests__/ColorSlider.test.tsx --reporter=default`
Expected: PASS, with no act() warning and no `[WaveUI]` output.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/ColorSlider.tsx src/components/input/__tests__/ColorSlider.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/ColorSlider.tsx"`
Expected: PASS (the `class-names` rule finds `colorSliderClassNames.root`; no raw color, physical or motion finding).

- [ ] **Step 6: Commit**

```bash
git add src/components/input/ColorSlider.tsx src/components/input/__tests__/ColorSlider.test.tsx
git commit -m "feat(input): ColorSlider, one channel of an HSV color on a native range input"
```

---

### Task C6: `AlphaSlider`

**Files:**
- Create: `src/components/input/AlphaSlider.tsx`
- Create: `src/components/input/__tests__/AlphaSlider.test.tsx`

**Interfaces:**
- Consumes: `ColorSliderProps` (C5, type only); `useColorPartState` (C4); `alphaSliderGradient`, `alphaValueText`, the rail and thumb recipes (C4); `alphaSliderClassNames` (registry).
- Produces: `export interface AlphaSliderLabels { opacity?: string; transparency?: string; valueText?: (color: HsvColor, transparency: boolean) => string }`, `export interface AlphaSliderProps extends Omit<ColorSliderProps, 'channel' | 'labels'> { transparency?: boolean; labels?: AlphaSliderLabels }`, `export const AlphaSlider` (displayName `'AlphaSlider'`). ColorPicker's opacity row renders it (C10).

- [ ] **Step 1: Write the failing tests**

Create `src/components/input/__tests__/AlphaSlider.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlphaSlider, type AlphaSliderProps } from '../AlphaSlider';
import { alphaSliderClassNames } from '../../../lib/classNames';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
import { PickerHarness } from './colorPartHarness';

const slider = (name = 'Opacity') => screen.getByRole('slider', { name });
const rootOf = (input: HTMLElement) =>
  input.closest<HTMLElement>(`.${alphaSliderClassNames.root}`) as HTMLElement;
const railOf = (input: HTMLElement) =>
  rootOf(input).querySelector<HTMLElement>(`.${alphaSliderClassNames.rail}`) as HTMLElement;

describe('AlphaSlider', () => {
  testSystemProps(AlphaSlider, {
    expectedTag: 'div',
    displayName: 'AlphaSlider',
    control: { role: 'slider' },
    a11yVariants: [
      { name: 'transparency', props: { transparency: true } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  it('shows the opacity: "Opacity", 0–100, the percentage as value text; no alpha is 100 %', () => {
    const { rerender } = render(<AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} />);
    expect(slider()).toHaveValue('40');
    expect(slider()).toHaveAttribute('max', '100');
    expect(slider()).toHaveAttribute('aria-valuetext', '40%');
    rerender(<AlphaSlider value={{ h: 0, s: 1, v: 1 }} />);
    expect(slider()).toHaveValue('100');
  });

  it('transparency flips the input value, the name, the value text, the rail and the arrows', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <AlphaSlider transparency defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} onValueChange={onValueChange} />,
    );
    const input = slider('Transparency');
    expect(input).toHaveValue('60');
    expect(input).toHaveAttribute('aria-valuetext', '60%');
    expect(rootOf(input).style.getPropertyValue('--wave-color-slider-gradient')).toBe(
      'linear-gradient(to right, #ff0000, transparent)',
    );
    act(() => input.focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1, a: 0.39 }]]);
  });

  it('draws the rail over a checkerboard of theme tokens and reads its gradient from the custom property', () => {
    render(<AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }} />);
    const input = slider();
    expect(rootOf(input).style.getPropertyValue('--wave-color-slider-gradient')).toBe(
      'linear-gradient(to right, transparent, #ff0000)',
    );
    expect(rootOf(input).style.getPropertyValue('--wave-color-thumb')).toBe('#ff000080');
    const rail = railOf(input);
    expect(rail.className).toContain('var(--wave-stroke)');
    expect(rail.className).toContain('var(--wave-background)');
    expect(rail).toHaveClass('forced-colors:forced-color-adjust-none', 'wave-rtl:-scale-x-100');
    expect(rail.firstElementChild).toHaveClass('bg-(image:--wave-color-slider-gradient)');
    expect(
      rootOf(input).querySelector(`.${alphaSliderClassNames.thumb}`),
    ).toHaveClass('group-has-[:focus-visible]/alpha-slider:outline-ring');
  });

  it.each([
    ['{ArrowRight}', 0.51],
    ['{ArrowLeft}', 0.49],
    ['{Shift>}{ArrowUp}{/Shift}', 0.6],
    ['{PageDown}', 0.4],
    ['{Home}', 0],
    ['{End}', 1],
  ])('%s moves the opacity to %s', async (keys, alpha) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AlphaSlider defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }} onValueChange={onValueChange} />);
    act(() => slider().focus());
    await user.keyboard(keys);
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1, a: alpha }]]);
  });

  it('mirrors a horizontal rail in right-to-left layouts; a vertical one keeps the bottom as the minimum', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderWithProviders(
      <>
        <AlphaSlider aria-label="Row" defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }} onValueChange={onValueChange} />
        <AlphaSlider aria-label="Column" orientation="vertical" defaultValue={{ h: 0, s: 1, v: 1, a: 0.5 }} />
      </>,
      { dir: 'rtl' },
    );
    act(() => slider('Row').focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 1, v: 1, a: 0.51 });
    expect(slider('Column')).toHaveAttribute('dir', 'ltr');
    expect(slider('Column')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('shows an out-of-range or non-finite alpha clamped and writes no NaN', () => {
    render(
      <>
        <AlphaSlider aria-label="Over" value={{ h: 0, s: 1, v: 1, a: 1.4 }} />
        <AlphaSlider aria-label="Not a number" value={{ h: Number.NaN, s: 1, v: 1, a: Number.NaN }} />
      </>,
    );
    expect(slider('Over')).toHaveValue('100');
    expect(slider('Not a number')).toHaveValue('100');
    for (const input of screen.getAllByRole('slider')) {
      expect(rootOf(input).getAttribute('style')).not.toMatch(/NaN/);
    }
  });

  it('labels.valueText replaces the value text', () => {
    render(
      <AlphaSlider
        defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }}
        labels={{ valueText: (color, transparency) => `${transparency ? 'clear' : 'solid'} ${color.a}` }}
      />,
    );
    expect(slider()).toHaveAttribute('aria-valuetext', 'solid 0.4');
  });

  it('submits the color with its alpha byte as hex (C-FORMS)', () => {
    render(
      <form aria-label="Form">
        <AlphaSlider name="tint" defaultValue={{ h: 0, s: 1, v: 1, a: 0.4 }} />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(new FormData(form).get('tint')).toBe('#ff000066');
    fireEvent.change(slider(), { target: { value: '100' } });
    expect(new FormData(form).get('tint')).toBe('#ff0000');
  });

  it("bound: takes the picker's opacity and transparency names and writes the working color", async () => {
    const user = userEvent.setup();
    const onHsvChange = vi.fn();
    render(
      <PickerHarness
        initial={{ h: 0, s: 1, v: 1, a: 0.5 }}
        labels={{ opacity: 'Deckkraft', transparency: 'Transparenz' }}
        onHsvChange={onHsvChange}
      >
        <AlphaSlider />
        <AlphaSlider transparency />
      </PickerHarness>,
    );
    expect(slider('Transparenz')).toHaveValue('50');
    act(() => slider('Deckkraft').focus());
    await user.keyboard('{ArrowUp}');
    expect(onHsvChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1, a: 0.51 }]]);
    expect(slider('Transparenz')).toHaveValue('49');
  });

  it('types: no channel; transparency is a boolean', () => {
    expectTypeOf<AlphaSliderProps['transparency']>().toEqualTypeOf<boolean | undefined>();
    // @ts-expect-error AlphaSlider has no channel
    const withChannel = <AlphaSlider channel="hue" />;
    expect(withChannel).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/AlphaSlider.test.tsx`
Expected: FAIL with `Failed to resolve import "../AlphaSlider"`.

- [ ] **Step 3: Create `src/components/input/AlphaSlider.tsx`**

```tsx
import * as React from 'react';
import { alphaSliderClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { hsvToHex } from '../../lib/color';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getDirection } from '../../lib/direction';
import type { HsvColor } from '../../lib/types';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { useColorPartState } from './ColorPicker.parts';
import type { ColorSliderProps } from './ColorSlider';
import {
  COLOR_THUMB_CLASSES,
  RAIL_GRADIENT,
  RAIL_INPUT_CLASSES,
  RAIL_INPUT_HORIZONTAL,
  RAIL_INPUT_VERTICAL,
  RAIL_ROOT_HORIZONTAL,
  RAIL_ROOT_VERTICAL,
  RAIL_TRACK_HORIZONTAL,
  RAIL_TRACK_VERTICAL,
  THUMB_POSITION_HORIZONTAL,
  THUMB_POSITION_VERTICAL,
  THUMB_TRACK_HORIZONTAL,
  THUMB_TRACK_VERTICAL,
  alphaSliderGradient,
  alphaValueText,
  displayColor,
  railKeyTarget,
  toPercent,
  toPosition,
} from './colorUtils';

/** Texts of an AlphaSlider, for localisation. Every key is optional. */
export interface AlphaSliderLabels {
  /** Name of the slider.
   * @default 'Opacity'
   */
  opacity?: string;
  /** Name of the slider with `transparency`.
   * @default 'Transparency'
   */
  transparency?: string;
  /** Replaces the value text ("40%"), for languages whose order differs. */
  valueText?: (color: HsvColor, transparency: boolean) => string;
}

/** Properties for the AlphaSlider component. */
export interface AlphaSliderProps extends Omit<ColorSliderProps, 'channel' | 'labels'> {
  /**
   * Shows transparency (100 % is fully transparent) instead of opacity: the rail, the input's
   * value, the value text and the arrow direction all follow it, while `value.a` stays the
   * opacity (Fluent's `transparency`).
   * @default false
   */
  transparency?: boolean;
  /** Texts of the slider; bound to a ColorPicker, the picker's `labels` fill the keys you leave out. */
  labels?: AlphaSliderLabels;
}

const DEFAULT_LABELS = { opacity: 'Opacity', transparency: 'Transparency' } as const;

/**
 * A slider for a color's opacity, drawn over a checkerboard, horizontal (mirrored in right-to-left
 * layouts) or vertical (bottom to top); `transparency` shows transparency instead. The arrow keys
 * move by 1 %, Shift with an arrow and Page Up or Page Down by 10, Home and End to the ends. It is
 * named by `aria-label`, else the surrounding Field's label, else "Opacity" ("Transparency").
 * Inside a ColorPicker, leave `value` and `defaultValue` out and it binds to the picker. Fluent's
 * `AlphaSlider`, with `value`/`onValueChange` for its `color`/`onChange`.
 *
 * @example
 * <AlphaSlider value={color} onValueChange={setColor} />
 */
export const AlphaSlider = ({
  transparency = false,
  orientation = 'horizontal',
  value,
  defaultValue,
  onValueChange,
  shape,
  labels,
  disabled = false,
  name,
  form,
  required,
  controlRef,
  className,
  style,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  autoFocus,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  ref,
  ...rest
}: AlphaSliderProps) => {
  const part = useColorPartState({ value, defaultValue, onValueChange, disabled });
  const { picker } = part;
  const pickerValueText = picker?.labels.valueText;
  const strings = {
    ...DEFAULT_LABELS,
    ...(picker && {
      opacity: picker.labels.opacity,
      transparency: picker.labels.transparency,
      valueText: pickerValueText && ((color: HsvColor) => pickerValueText(color, 'alpha')),
    }),
    ...labels,
  };
  const resolvedShape = shape ?? picker?.shape ?? 'rounded';
  const vertical = orientation === 'vertical';
  const shown = displayColor(part.color);
  const opacity = toPercent(shown.a);
  const current = transparency ? 100 - opacity : opacity;

  const field = useFieldContext();
  const fieldProps = useFieldControl({
    id,
    'aria-label':
      ariaLabel ??
      (field === null && ariaLabelledBy === undefined
        ? transparency
          ? strings.transparency
          : strings.opacity
        : undefined),
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  });
  // A slider supports neither aria-required nor a native `required`: the hidden input carries it.
  const { 'aria-required': _ariaRequired, required: _required, ...inputFieldProps } = fieldProps;
  const invalid = inputFieldProps['aria-invalid'];
  const isInvalid = invalid !== undefined && invalid !== false && invalid !== 'false';
  const isRequired =
    required ?? (ariaRequired === true || ariaRequired === 'true' || (field?.required ?? false));

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedControlRef = useMergedRefs(inputRef, controlRef);
  useFormReset(inputRef, part.reset, form);

  /** Applies a value of the input's range: the opacity in percent, or the transparency. */
  const apply = (next: number) => {
    if (next === current) return;
    part.setColor({ ...part.color, a: (transparency ? 100 - next : next) / 100 });
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (part.disabled || event.nativeEvent.isComposing) return;
      const target = railKeyTarget(event.key, event, getDirection(event.currentTarget), current, 100);
      if (target === null) return;
      event.preventDefault();
      apply(target);
    },
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (part.disabled) return;
    apply(Math.min(100, Math.max(0, Math.round(Number(event.currentTarget.value)))));
  };

  const sliderStyle = {
    ...style,
    '--wave-color-slider-gradient': alphaSliderGradient(shown, transparency, orientation),
    '--wave-color-slider-position': toPosition(current / 100),
    '--wave-color-thumb': hsvToHex(shown),
  } as React.CSSProperties;

  return (
    <div
      data-orientation={orientation}
      data-disabled={part.disabled ? '' : undefined}
      className={cn(
        alphaSliderClassNames.root,
        'group/alpha-slider relative flex touch-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        vertical ? RAIL_ROOT_VERTICAL : RAIL_ROOT_HORIZONTAL,
        className,
      )}
      style={sliderStyle}
      {...rest}
      ref={ref}
    >
      <div
        aria-hidden="true"
        className={cn(
          alphaSliderClassNames.rail,
          'relative overflow-hidden rounded-full bg-[conic-gradient(var(--wave-stroke)_25%,var(--wave-background)_0_50%,var(--wave-stroke)_0_75%,var(--wave-background)_0)] bg-size-[8px_8px] forced-colors:forced-color-adjust-none',
          vertical ? RAIL_TRACK_VERTICAL : RAIL_TRACK_HORIZONTAL,
          resolvedShape === 'square' && 'rounded-none',
        )}
      >
        <span className={cn('absolute inset-0', RAIL_GRADIENT)} />
      </div>
      <input
        type="range"
        {...inputFieldProps}
        ref={mergedControlRef}
        min={0}
        max={100}
        step={1}
        value={current}
        disabled={part.disabled}
        dir={vertical ? 'ltr' : undefined}
        aria-orientation={vertical ? 'vertical' : undefined}
        aria-valuetext={alphaValueText(shown, transparency, strings.valueText)}
        aria-errormessage={(isInvalid && ariaErrorMessage) || undefined}
        aria-details={ariaDetails}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onChange={handleChange}
        className={cn(RAIL_INPUT_CLASSES, vertical ? RAIL_INPUT_VERTICAL : RAIL_INPUT_HORIZONTAL)}
      />
      <span aria-hidden="true" className={vertical ? THUMB_TRACK_VERTICAL : THUMB_TRACK_HORIZONTAL}>
        <span
          className={cn(
            alphaSliderClassNames.thumb,
            COLOR_THUMB_CLASSES,
            vertical ? THUMB_POSITION_VERTICAL : THUMB_POSITION_HORIZONTAL,
            'group-has-[:focus-visible]/alpha-slider:ring-2 group-has-[:focus-visible]/alpha-slider:ring-background group-has-[:focus-visible]/alpha-slider:outline-2 group-has-[:focus-visible]/alpha-slider:outline-offset-2 group-has-[:focus-visible]/alpha-slider:outline-ring forced-colors:group-has-[:focus-visible]/alpha-slider:outline-[Highlight]',
          )}
        />
      </span>
      {!picker && (
        <HiddenInput
          type="text"
          name={name}
          form={form}
          value={hsvToHex(part.color)}
          required={isRequired}
          onInvalid={() => inputRef.current?.focus()}
        />
      )}
    </div>
  );
};

AlphaSlider.displayName = 'AlphaSlider';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/input/__tests__/AlphaSlider.test.tsx --reporter=default`
Expected: PASS, clean output.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/AlphaSlider.tsx src/components/input/__tests__/AlphaSlider.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/AlphaSlider.tsx"`
Expected: PASS (the checkerboard's arbitrary value holds only `var(--wave-…)` tokens).

- [ ] **Step 6: Commit**

```bash
git add src/components/input/AlphaSlider.tsx src/components/input/__tests__/AlphaSlider.test.tsx
git commit -m "feat(input): AlphaSlider over a token checkerboard, with transparency"
```

---

### Task C7: `ColorArea` — structure, keys, value texts, naming, routing, forms, disabled

**Files:**
- Create: `src/components/input/ColorArea.tsx`
- Create: `src/components/input/__tests__/ColorArea.test.tsx`

**Interfaces:**
- Consumes: `useColorPartState` (C4); `COLOR_THUMB_CLASSES`, `areaValueText`, `colorAreaGradient`, `displayColor`, `toPercent`, `toPosition` (C4); `hsvToHex` (C1); `getArrowIntent`, `getDirection`; `isOwnEvent`; `colorAreaClassNames` (registry).
- Produces: `export interface ColorAreaLabels`, `export interface ColorAreaProps`, `export const ColorArea` (displayName `'ColorArea'`). Task C8 adds the pointer and the exposure model to this module; ColorPicker's default layout renders it (C10).

- [ ] **Step 1: Write the failing tests**

Create `src/components/input/__tests__/ColorArea.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { ColorArea, type ColorAreaProps } from '../ColorArea';
import { colorAreaClassNames } from '../../../lib/classNames';
import { hsvToHex } from '../../../lib/color';
import type { HsvColor } from '../../../lib/types';
import { renderWithProviders, testSystemProps } from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { PickerHarness } from './colorPartHarness';

const DARK_BLUE: HsvColor = { h: 220, s: 0.72, v: 0.4 };
const MIDDLE: HsvColor = { h: 100, s: 0.5, v: 0.5 };
const group = (name = 'Accent') => screen.getByRole('group', { name });
// `hidden: true`: where the primary pointer is not coarse, the input without the Tab stop is
// aria-hidden (Task C8).
const saturationInput = () => screen.getByRole('slider', { name: 'Saturation', hidden: true });
const brightnessInput = () => screen.getByRole('slider', { name: 'Brightness', hidden: true });

describe('ColorArea', () => {
  testSystemProps(ColorArea, {
    expectedTag: 'div',
    displayName: 'ColorArea',
    defaultProps: { 'aria-label': 'Accent' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'in a form', props: { name: 'accent', required: true } },
      { name: 'square', props: { shape: 'square' } },
    ],
  });

  it('is a group of two range inputs, "Saturation" and "Brightness", described as a 2D slider', () => {
    render(<ColorArea aria-label="Accent" defaultValue={DARK_BLUE} />);
    const saturation = saturationInput();
    const brightness = brightnessInput();
    expect(group()).toContainElement(saturation);
    expect(saturation).toHaveValue('72');
    expect(brightness).toHaveValue('40');
    expect(saturation).toHaveAttribute('aria-roledescription', '2D slider');
    expect(brightness).toHaveAttribute('aria-roledescription', '2D slider');
    expect(brightness).toHaveAttribute('aria-orientation', 'vertical');
    expect(saturation).not.toHaveAttribute('aria-orientation');
    expect(saturation).toHaveAttribute('aria-valuetext', 'Saturation 72%, Brightness 40%, dark blue');
    expect(brightness).toHaveAttribute('aria-valuetext', 'Brightness 40%, Saturation 72%, dark blue');
  });

  it('draws the field from --wave-color-area-gradient and places the thumb by saturation and brightness', () => {
    render(<ColorArea aria-label="Accent" defaultValue={{ h: 208, s: 0.25, v: 0.75 }} />);
    const root = group();
    expect(root.style.getPropertyValue('--wave-color-area-gradient')).toBe(
      'linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, #0088ff)',
    );
    expect(root.style.getPropertyValue('--wave-color-area-x')).toBe('25%');
    expect(root.style.getPropertyValue('--wave-color-area-y')).toBe('75%');
    expect(root.style.getPropertyValue('--wave-color-thumb')).toBe(
      hsvToHex({ h: 208, s: 0.25, v: 0.75 }),
    );
    const field = root.querySelector(`.${colorAreaClassNames.field}`);
    expect(field).toHaveAttribute('aria-hidden', 'true');
    expect(field).toHaveClass(
      'bg-(image:--wave-color-area-gradient)',
      'wave-rtl:-scale-x-100',
      'forced-colors:forced-color-adjust-none',
    );
    expect(root.querySelector(`.${colorAreaClassNames.thumb}`)).toHaveClass(
      'size-6',
      'start-(--wave-color-area-x)',
      'bottom-(--wave-color-area-y)',
      'group-has-[:focus-visible]/color-area:outline-ring',
      'group-has-[:focus-visible]/color-area:ring-background',
    );
    expect(root).toHaveClass('group/color-area', 'touch-none', 'rounded');
  });

  it('shape="square" removes the corner radius', () => {
    render(<ColorArea aria-label="Accent" shape="square" />);
    expect(group()).toHaveClass('rounded-none');
    expect(group()).not.toHaveClass('rounded');
  });

  describe('keyboard (D19)', () => {
    it.each([
      ['{ArrowRight}', { s: 0.51 }],
      ['{ArrowLeft}', { s: 0.49 }],
      ['{Shift>}{ArrowRight}{/Shift}', { s: 0.6 }],
      ['{Home}', { s: 0 }],
      ['{End}', { s: 1 }],
      ['{ArrowUp}', { v: 0.51 }],
      ['{ArrowDown}', { v: 0.49 }],
      ['{Shift>}{ArrowDown}{/Shift}', { v: 0.4 }],
      ['{PageUp}', { v: 0.6 }],
      ['{PageDown}', { v: 0.4 }],
    ])('%s changes %o', async (keys, change) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />);
      act(() => saturationInput().focus());
      await user.keyboard(keys);
      expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, ...change }]]);
    });

    it('moves focus and the one Tab stop to the input of the axis that changed', async () => {
      const user = userEvent.setup();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} />);
      expect(saturationInput()).toHaveAttribute('tabindex', '0');
      expect(brightnessInput()).toHaveAttribute('tabindex', '-1');
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowUp}');
      expect(brightnessInput()).toHaveFocus();
      expect(brightnessInput()).toHaveAttribute('tabindex', '0');
      expect(saturationInput()).toHaveAttribute('tabindex', '-1');
      await user.keyboard('{ArrowLeft}');
      expect(saturationInput()).toHaveFocus();
      expect(saturationInput()).toHaveAttribute('tabindex', '0');
    });

    it('is one Tab stop', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <ColorArea aria-label="Accent" />
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      await user.tab();
      expect(saturationInput()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('mirrors the saturation arrows in right-to-left layouts', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />,
        { dir: 'rtl' },
      );
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowLeft}');
      expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, s: 0.51 }]]);
    });

    it('a key at the end of an axis changes and reports nothing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<ColorArea aria-label="Accent" defaultValue={{ h: 0, s: 1, v: 1 }} onValueChange={onValueChange} />);
      act(() => saturationInput().focus());
      await user.keyboard('{End}{ArrowRight}');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('leaves browser shortcuts alone: Alt, Ctrl or Meta with a key is neither handled nor prevented', () => {
      const onValueChange = vi.fn();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />);
      const input = saturationInput();
      expect(fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'Home', ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'ArrowUp', metaKey: true })).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("runs the consumer's onKeyDown first; preventDefault() keeps the color", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorArea
          aria-label="Accent"
          defaultValue={MIDDLE}
          onValueChange={onValueChange}
          onKeyDown={(event) => event.preventDefault()}
        />,
      );
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  it('applies the change events assistive technology sends, and gives that input the Tab stop', () => {
    const onValueChange = vi.fn();
    render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />);
    fireEvent.change(brightnessInput(), { target: { value: '80' } });
    expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, v: 0.8 }]]);
    expect(brightnessInput()).toHaveAttribute('tabindex', '0');
  });

  describe('value texts and labels (D22)', () => {
    it('labels rename the sliders and their role description, colorName replaces the namer, valueText the whole text', () => {
      render(
        <ColorArea
          aria-label="Accent"
          defaultValue={DARK_BLUE}
          labels={{
            saturation: 'Sättigung',
            brightness: 'Helligkeit',
            roleDescription: '2D-Regler',
            colorName: () => 'dunkelblau',
            valueText: (color, channel) => `${channel} ${Math.round(color.v * 100)}`,
          }}
        />,
      );
      const saturation = screen.getByRole('slider', { name: 'Sättigung', hidden: true });
      const brightness = screen.getByRole('slider', { name: 'Helligkeit', hidden: true });
      expect(saturation).toHaveAttribute('aria-roledescription', '2D-Regler');
      expect(saturation).toHaveAttribute('aria-valuetext', 'saturation 40');
      expect(brightness).toHaveAttribute('aria-valuetext', 'value 40');
    });

    it("colorName returning '' drops the name", () => {
      render(<ColorArea aria-label="Accent" defaultValue={DARK_BLUE} labels={{ colorName: () => '' }} />);
      expect(saturationInput()).toHaveAttribute('aria-valuetext', 'Saturation 72%, Brightness 40%');
    });
  });

  describe('naming and routing (C-ROUTING)', () => {
    it('the Field label names the group and the Field hint describes it', () => {
      renderWithFieldContext(<ColorArea />, { hintId: FIELD_TEST_IDS.hintId });
      const root = screen.getByRole('group', { name: FIELD_TEST_TEXT.label });
      expect(root).toHaveAccessibleDescription(FIELD_TEST_TEXT.hint);
    });

    it('without a name the group has none (the sliders are named)', () => {
      render(<ColorArea />);
      expect(screen.getByRole('group')).not.toHaveAccessibleName();
      expect(saturationInput()).toHaveAccessibleName('Saturation');
    });

    it('puts aria-invalid and aria-errormessage on both inputs, never on the group', () => {
      render(
        <>
          <ColorArea aria-label="Accent" aria-invalid aria-errormessage="accent-error" />
          <span id="accent-error">Pick a darker color.</span>
        </>,
      );
      expect(group()).not.toHaveAttribute('aria-invalid');
      expect(group()).not.toHaveAttribute('aria-errormessage');
      for (const input of [saturationInput(), brightnessInput()]) {
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-errormessage', 'accent-error');
      }
    });

    it('takes the invalid state of a surrounding Field on both inputs', () => {
      renderWithFieldContext(<ColorArea />, { errorId: FIELD_TEST_IDS.errorId });
      expect(saturationInput()).toHaveAttribute('aria-invalid', 'true');
      expect(brightnessInput()).toHaveAttribute('aria-invalid', 'true');
    });

    it('routes controlRef and autoFocus to the saturation input and tabIndex to the Tab stop', () => {
      const controlRef = React.createRef<HTMLInputElement>();
      render(<ColorArea aria-label="Accent" controlRef={controlRef} autoFocus tabIndex={-1} />);
      expect(controlRef.current).toBe(saturationInput());
      expect(saturationInput()).toHaveFocus();
      expect(saturationInput()).toHaveAttribute('tabindex', '-1');
      expect(brightnessInput()).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('forms (C-FORMS)', () => {
    it('submits the color as hex under its name; a form reset restores defaultValue', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <form aria-label="Form">
          <ColorArea aria-label="Accent" name="accent" defaultValue={{ h: 0, s: 1, v: 1 }} onValueChange={onValueChange} />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(new FormData(form).get('accent')).toBe('#ff0000');
      act(() => saturationInput().focus());
      await user.keyboard('{Home}');
      expect(new FormData(form).get('accent')).toBe('#ffffff');
      act(() => form.reset());
      expect(new FormData(form).get('accent')).toBe('#ff0000');
      expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 0, v: 1 }], [{ h: 0, s: 1, v: 1 }]]);
    });

    it('required and aria-required make the hidden input required; the inputs never are', () => {
      const { container } = render(
        <form aria-label="Form">
          <ColorArea aria-label="Accent" aria-required />
        </form>,
      );
      expect(group()).not.toHaveAttribute('aria-required');
      expect(saturationInput()).not.toBeRequired();
      expect(container.querySelectorAll('input[required]')).toHaveLength(1);
    });

    it('adds nothing to the form without name or required', () => {
      render(
        <form aria-label="Form">
          <ColorArea aria-label="Accent" />
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(Array.from(new FormData(form).keys())).toEqual([]);
    });
  });

  it('disabled: both inputs disabled, data-disabled on the group, keys ignored', () => {
    const onValueChange = vi.fn();
    render(<ColorArea aria-label="Accent" disabled onValueChange={onValueChange} />);
    expect(group()).toHaveAttribute('data-disabled', '');
    expect(saturationInput()).toBeDisabled();
    expect(brightnessInput()).toBeDisabled();
    fireEvent.keyDown(saturationInput(), { key: 'ArrowRight' });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows an out-of-range or non-finite color clamped, steps from there and writes no NaN', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorArea
        aria-label="Accent"
        value={{ h: 720, s: 1.5, v: Number.NaN }}
        onValueChange={onValueChange}
      />,
    );
    expect(saturationInput()).toHaveValue('100');
    expect(brightnessInput()).toHaveValue('0');
    expect(group().getAttribute('style')).not.toMatch(/NaN/);
    act(() => saturationInput().focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith({ h: 720, s: 0.99, v: Number.NaN });
  });

  it('keeps a controlled value whose parent ignores onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorArea aria-label="Accent" value={MIDDLE} onValueChange={onValueChange} />);
    act(() => saturationInput().focus());
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowRight}');
    expect(onValueChange.mock.calls).toEqual([[{ ...MIDDLE, s: 0.51 }], [{ ...MIDDLE, s: 0.51 }]]);
    expect(saturationInput()).toHaveValue('50');
  });

  it('reports each change once in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    act(() => saturationInput().focus());
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  describe('inside a ColorPicker (bound)', () => {
    it("reads and writes the working color, is named by labels.area, takes the picker's shape and renders no hidden input", async () => {
      const user = userEvent.setup();
      const onHsvChange = vi.fn();
      const { container } = render(
        <form aria-label="Form">
          <PickerHarness initial={MIDDLE} shape="square" onHsvChange={onHsvChange}>
            <ColorArea name="ignored" />
          </PickerHarness>
        </form>,
      );
      const root = group('Saturation and brightness');
      expect(root).toHaveClass('rounded-none');
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowRight}');
      expect(onHsvChange.mock.calls).toEqual([[{ ...MIDDLE, s: 0.51 }]]);
      expect(saturationInput()).toHaveValue('51');
      expect(container.querySelector('input[name="ignored"]')).toBeNull();
    });
  });

  it('renders on the server and hydrates without warnings', () => {
    const ui = <ColorArea aria-label="Accent" defaultValue={DARK_BLUE} />;
    const html = renderToString(ui);
    expect(html).toContain('--wave-color-area-gradient');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, ui);
      });
      expect(error).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
    }
  });

  it('types: an HsvColor value and the ColorPicker shapes', () => {
    expectTypeOf<ColorAreaProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorAreaProps['onValueChange']>().toEqualTypeOf<
      ((value: HsvColor) => void) | undefined
    >();
    // @ts-expect-error a color part is rounded or square
    const circular = <ColorArea shape="circular" />;
    expect(circular).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/ColorArea.test.tsx`
Expected: FAIL with `Failed to resolve import "../ColorArea"`.

- [ ] **Step 3: Create `src/components/input/ColorArea.tsx`**

```tsx
import * as React from 'react';
import { colorAreaClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { hsvToHex } from '../../lib/color';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isOwnEvent } from '../../lib/events';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { useColorPartState } from './ColorPicker.parts';
import {
  COLOR_THUMB_CLASSES,
  areaValueText,
  colorAreaGradient,
  displayColor,
  toPercent,
  toPosition,
} from './colorUtils';

/** Texts of a ColorArea, for localisation. Every key is optional. */
export interface ColorAreaLabels {
  /** Name of the horizontal slider.
   * @default 'Saturation'
   */
  saturation?: string;
  /** Name of the vertical slider (the `value` channel).
   * @default 'Brightness'
   */
  brightness?: string;
  /** Role description of both sliders.
   * @default '2D slider'
   */
  roleDescription?: string;
  /** Names the color at the end of each value text; return `''` to leave it out.
   * @default an English namer ("dark blue")
   */
  colorName?: (color: HsvColor) => string;
  /** Replaces a whole value text, for languages whose order differs. */
  valueText?: (color: HsvColor, channel: 'saturation' | 'value') => string;
}

/** Properties for the ColorArea component. */
export interface ColorAreaProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  /**
   * The color (Fluent's `color`). Inside a ColorPicker, leave `value` and `defaultValue` out to
   * bind the area to the picker.
   */
  value?: HsvColor;
  /**
   * Initial color for uncontrolled usage (also what a form reset restores).
   * @default the brand blue, `{ h: 208, s: 0.92, v: 0.74 }` (`#0f6cbd`)
   */
  defaultValue?: HsvColor;
  /**
   * Called with the new color on every step (a key, a pointer move or assistive technology) that
   * changes it (Fluent's `onChange`). A bound area calls it too.
   */
  onValueChange?: (value: HsvColor) => void;
  /**
   * `'square'` removes the corner radius (the thumb stays round). Bound to a ColorPicker, the
   * picker's shape unless you pass one.
   * @default 'rounded'
   */
  shape?: ColorPickerShape;
  /** Texts of the area; bound to a ColorPicker, the picker's `labels` fill the keys you leave out. */
  labels?: ColorAreaLabels;
  /**
   * Unavailable: both inputs are natively disabled, pointer presses are ignored and the area is
   * dimmed. A bound area is also disabled while the picker's value is not a hex color.
   * @default false
   */
  disabled?: boolean;
  /** Form field name: the color is submitted as hex (`hsvToHex`). Ignored while bound to a ColorPicker. */
  name?: string;
  /** Id of the form the area belongs to, when it is rendered outside that form. */
  form?: string;
  /**
   * Marks the hidden form input required (a color is always set, so it never blocks). A consumer
   * `aria-required` does the same: a group supports neither, so neither is set on it.
   */
  required?: boolean;
  /** Ref to the saturation `<input type="range">`. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root `role="group"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The two axes: saturation (x) and brightness (y, the `value` channel). */
type AreaAxis = 'saturation' | 'value';

const DEFAULT_LABELS = {
  saturation: 'Saturation',
  brightness: 'Brightness',
  roleDescription: '2D slider',
} as const;

/** A whole percentage clamped to 0–100. */
function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * A 2-D color field: saturation from left to right (mirrored in right-to-left layouts) and
 * brightness from bottom to top, at the value's hue. ArrowLeft and ArrowRight move saturation by
 * 1 %, ArrowUp and ArrowDown brightness; Shift with an arrow moves by 10, Page Up and Page Down
 * move brightness by 10, and Home and End set saturation to 0 and 100. It is one Tab stop holding
 * two sliders for assistive technology, "Saturation" and "Brightness", whose value texts start
 * with their own channel and name the color; focus follows the axis a key moves. Inside a
 * ColorPicker, leave `value` and `defaultValue` out and it binds to the picker. Fluent's
 * `ColorArea`, with `value`/`onValueChange` for its `color`/`onChange`.
 *
 * @example
 * <ColorArea aria-label="Accent color" value={color} onValueChange={setColor} />
 */
export const ColorArea = ({
  value,
  defaultValue,
  onValueChange,
  shape,
  labels,
  disabled = false,
  name,
  form,
  required,
  controlRef,
  className,
  style,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  autoFocus,
  tabIndex,
  onKeyDown,
  ref,
  ...rest
}: ColorAreaProps) => {
  const part = useColorPartState({ value, defaultValue, onValueChange, disabled });
  const { picker } = part;
  const strings = {
    ...DEFAULT_LABELS,
    ...(picker && {
      saturation: picker.labels.saturation,
      brightness: picker.labels.brightness,
      roleDescription: picker.labels.roleDescription,
      colorName: picker.labels.colorName,
      valueText: picker.labels.valueText,
    }),
    ...labels,
  };
  const resolvedShape = shape ?? picker?.shape ?? 'rounded';
  const color = part.color;
  const shown = displayColor(color);
  const saturation = toPercent(shown.s);
  const brightness = toPercent(shown.v);

  const [activeAxis, setActiveAxis] = React.useState<AreaAxis>('saturation');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const saturationRef = React.useRef<HTMLInputElement>(null);
  const brightnessRef = React.useRef<HTMLInputElement>(null);
  const mergedRootRef = useMergedRefs(ref, rootRef);
  const mergedSaturationRef = useMergedRefs(saturationRef, controlRef);
  /** The axis whose input takes focus after the next commit (focus follows the axis of a key). */
  const pendingFocusRef = React.useRef<AreaAxis | null>(null);

  React.useLayoutEffect(() => {
    const axis = pendingFocusRef.current;
    if (axis === null) return;
    pendingFocusRef.current = null;
    (axis === 'saturation' ? saturationRef : brightnessRef).current?.focus({ preventScroll: true });
  }, [activeAxis]);

  const field = useFieldContext();
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label':
        ariaLabel ?? (picker && ariaLabelledBy === undefined ? picker.labels.area : undefined),
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    { labelable: false },
  );
  // A group supports neither aria-invalid, aria-required nor `required` (ARIA 1.2): the invalid
  // state goes to both inputs and the required state to the hidden input.
  const {
    'aria-invalid': invalid,
    'aria-required': _ariaRequired,
    required: _required,
    ...groupProps
  } = fieldProps;
  const isInvalid = invalid !== undefined && invalid !== false && invalid !== 'false';
  const errorMessageId = (isInvalid && ariaErrorMessage) || undefined;
  const isRequired =
    required ?? (ariaRequired === true || ariaRequired === 'true' || (field?.required ?? false));

  useFormReset(rootRef, part.reset, form);

  /** Applies a whole percentage to one axis, keeping the other channels as given. */
  const applyAxis = (axis: AreaAxis, percent: number) => {
    if (percent === (axis === 'saturation' ? saturation : brightness)) return;
    part.setColor(
      axis === 'saturation' ? { ...color, s: percent / 100 } : { ...color, v: percent / 100 },
    );
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (part.disabled || !isOwnEvent(event) || event.nativeEvent.isComposing) return;
      // A key with Alt, Ctrl or Meta belongs to the browser (Alt+Left is "back").
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const step = event.shiftKey ? 10 : 1;
      let axis: AreaAxis;
      let next: number;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          const intent = getArrowIntent(event.key, {
            orientation: 'horizontal',
            dir: getDirection(event.currentTarget),
          });
          axis = 'saturation';
          next = saturation + (intent === 'next' ? step : -step);
          break;
        }
        case 'ArrowUp':
          axis = 'value';
          next = brightness + step;
          break;
        case 'ArrowDown':
          axis = 'value';
          next = brightness - step;
          break;
        case 'PageUp':
          axis = 'value';
          next = brightness + 10;
          break;
        case 'PageDown':
          axis = 'value';
          next = brightness - 10;
          break;
        case 'Home':
          axis = 'saturation';
          next = 0;
          break;
        case 'End':
          axis = 'saturation';
          next = 100;
          break;
        default:
          return;
      }
      // Prevented, so the native range input never moves on its own.
      event.preventDefault();
      if (axis !== activeAxis) {
        pendingFocusRef.current = axis;
        setActiveAxis(axis);
      }
      applyAxis(axis, clampPercent(next));
    },
  );

  /** A change event from assistive technology (a swipe): that input becomes the Tab stop. */
  const handleInputChange = (axis: AreaAxis) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (part.disabled) return;
    if (axis !== activeAxis) setActiveAxis(axis);
    applyAxis(axis, clampPercent(Math.round(Number(event.currentTarget.value))));
  };

  const handleInputFocus = (axis: AreaAxis) => () => {
    if (axis !== activeAxis) setActiveAxis(axis);
  };

  const textLabels = {
    saturation: strings.saturation,
    brightness: strings.brightness,
    colorName: strings.colorName,
    valueText: strings.valueText,
  };

  const areaStyle = {
    ...style,
    '--wave-color-area-gradient': colorAreaGradient(shown.h),
    '--wave-color-area-x': toPosition(shown.s),
    '--wave-color-area-y': toPosition(shown.v),
    '--wave-color-thumb': hsvToHex({ h: shown.h, s: shown.s, v: shown.v }),
  } as React.CSSProperties;

  const inputProps = (axis: AreaAxis) => ({
    type: 'range' as const,
    min: 0,
    max: 100,
    step: 1,
    disabled: part.disabled,
    'aria-roledescription': strings.roleDescription,
    'aria-invalid': invalid,
    'aria-errormessage': errorMessageId,
    // One Tab stop: the input used last (C-ROUTING: a consumer tabIndex applies to it).
    tabIndex: axis === activeAxis ? (tabIndex ?? 0) : -1,
    onChange: handleInputChange(axis),
    onFocus: handleInputFocus(axis),
    className: 'sr-only',
  });

  return (
    <div
      role="group"
      data-disabled={part.disabled ? '' : undefined}
      {...groupProps}
      className={cn(
        colorAreaClassNames.root,
        'group/color-area relative h-40 w-full min-w-40 touch-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        resolvedShape === 'square' ? 'rounded-none' : 'rounded',
        className,
      )}
      style={areaStyle}
      {...rest}
      ref={mergedRootRef}
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        className={cn(
          colorAreaClassNames.field,
          'absolute inset-0 rounded-[inherit] bg-(image:--wave-color-area-gradient) wave-rtl:-scale-x-100 forced-colors:forced-color-adjust-none',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          colorAreaClassNames.thumb,
          COLOR_THUMB_CLASSES,
          'start-(--wave-color-area-x) bottom-(--wave-color-area-y) -translate-x-1/2 wave-rtl:translate-x-1/2 translate-y-1/2',
          'group-has-[:focus-visible]/color-area:ring-2 group-has-[:focus-visible]/color-area:ring-background group-has-[:focus-visible]/color-area:outline-2 group-has-[:focus-visible]/color-area:outline-offset-2 group-has-[:focus-visible]/color-area:outline-ring forced-colors:group-has-[:focus-visible]/color-area:outline-[Highlight]',
        )}
      />
      <input
        {...inputProps('saturation')}
        ref={mergedSaturationRef}
        value={saturation}
        aria-label={strings.saturation}
        aria-valuetext={areaValueText(shown, 'saturation', textLabels)}
        autoFocus={autoFocus}
      />
      <input
        {...inputProps('value')}
        ref={brightnessRef}
        value={brightness}
        aria-label={strings.brightness}
        aria-orientation="vertical"
        aria-valuetext={areaValueText(shown, 'value', textLabels)}
      />
      {!picker && (
        <HiddenInput
          type="text"
          name={name}
          form={form}
          value={hsvToHex(color)}
          required={isRequired}
          onInvalid={() =>
            (activeAxis === 'saturation' ? saturationRef : brightnessRef).current?.focus()
          }
        />
      )}
    </div>
  );
};

ColorArea.displayName = 'ColorArea';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/input/__tests__/ColorArea.test.tsx --reporter=default`
Expected: PASS, clean output.

- [ ] **Step 5: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/ColorArea.tsx src/components/input/__tests__/ColorArea.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/ColorArea.tsx"`
Expected: PASS (the thumb's `translate-x` classes carry their `wave-rtl:` counterpart on the same line; `colorAreaClassNames.root` is applied).

- [ ] **Step 6: Commit**

```bash
git add src/components/input/ColorArea.tsx src/components/input/__tests__/ColorArea.test.tsx
git commit -m "feat(input): ColorArea, a 2-D saturation and brightness field with two range inputs"
```

---

### Task C8: `ColorArea` — pointer and the exposure model

**Files:**
- Modify: `src/components/input/ColorArea.tsx`
- Modify: `src/components/input/__tests__/ColorArea.test.tsx`

**Interfaces:**
- Consumes: Task C7's `ColorArea`; `mockMatchMedia`, `mockRect` (test utils).
- Produces: pointer handling on the root (`onPointerDown`/`onPointerMove`, composed after the consumer's), and the D19 exposure: where `matchMedia('(pointer: coarse)')` does not match (and on the server), the input without the Tab stop is `aria-hidden`; on a coarse primary pointer both inputs stay exposed.

**Decision recorded for the report (spec §10):** D19 says "devices whose primary pointer is fine (`matchMedia('(pointer: fine)')`)". The plan tests `(pointer: coarse)` instead and treats every device that is not touch-primary as the desktop model. Same result for mouse and touch devices; a device with no pointer at all (`pointer: none`, a keyboard-only kiosk) gets the one-slider model its desktop screen reader expects instead of two sliders; and the test environment, whose `matchMedia` mock matches nothing by default, renders the same model as the server.

- [ ] **Step 1: Write the failing tests**

In `src/components/input/__tests__/ColorArea.test.tsx`, extend the imports: `afterEach, beforeEach` from `vitest`, and `mockMatchMedia, mockRect` from `'../../../test-utils'`. Replace the test `'renders on the server and hydrates without warnings'` with the two server tests at the end of the block below, and append the rest inside `describe('ColorArea', …)`:

```tsx
  describe('pointer (D19)', () => {
    const CAPTURE_METHODS = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const;
    let saved: Array<[string, PropertyDescriptor | undefined]> = [];

    beforeEach(() => {
      // jsdom has no pointer capture: a stand-in that remembers the captured pointer ids.
      const captured = new WeakMap<Element, Set<number>>();
      saved = CAPTURE_METHODS.map((name) => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)]);
      Object.defineProperties(Element.prototype, {
        setPointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            const ids = captured.get(this) ?? new Set<number>();
            ids.add(pointerId);
            captured.set(this, ids);
          },
        },
        releasePointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            captured.get(this)?.delete(pointerId);
          },
        },
        hasPointerCapture: {
          configurable: true,
          writable: true,
          value(this: Element, pointerId: number) {
            return captured.get(this)?.has(pointerId) ?? false;
          },
        },
      });
    });

    afterEach(() => {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
        else Reflect.deleteProperty(Element.prototype, name);
      }
    });

    function renderArea(props: Partial<ColorAreaProps> = {}, dir?: 'rtl') {
      const onValueChange = vi.fn();
      const ui = <ColorArea aria-label="Accent" defaultValue={MIDDLE} onValueChange={onValueChange} {...props} />;
      if (dir) renderWithProviders(ui, { dir });
      else render(ui);
      const root = group();
      mockRect(root.querySelector(`.${colorAreaClassNames.field}`) as Element, {
        left: 0,
        top: 0,
        width: 200,
        height: 100,
      });
      return { root, onValueChange };
    }

    it.each(['mouse', 'touch', 'pen'])(
      'a %s press jumps the thumb to the point, focuses the Tab stop and drags while captured',
      (pointerType) => {
        const { root, onValueChange } = renderArea();
        fireEvent.pointerDown(root, { pointerId: 1, button: 0, pointerType, clientX: 50, clientY: 25 });
        expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 0.25, v: 0.75 });
        expect(saturationInput()).toHaveFocus();
        expect(root.hasPointerCapture(1)).toBe(true);
        fireEvent.pointerMove(root, { pointerId: 1, pointerType, clientX: 100, clientY: 50 });
        expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 0.5, v: 0.5 });
        root.releasePointerCapture(1);
        fireEvent.pointerMove(root, { pointerId: 1, pointerType, clientX: 150, clientY: 0 });
        expect(onValueChange).toHaveBeenCalledTimes(2);
      },
    );

    it('clamps a drag outside the field to its edges', () => {
      const { root, onValueChange } = renderArea();
      fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
      fireEvent.pointerMove(root, { pointerId: 1, clientX: 300, clientY: -20 });
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 1, v: 1 });
    });

    it('mirrors the x axis in right-to-left layouts', () => {
      const { root, onValueChange } = renderArea({}, 'rtl');
      fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 50, clientY: 25 });
      expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 0.75, v: 0.75 });
    });

    it('focuses the input that has the Tab stop (brightness after an ArrowUp)', async () => {
      const user = userEvent.setup();
      const { root } = renderArea();
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowUp}');
      act(() => saturationInput().blur());
      fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
      expect(brightnessInput()).toHaveFocus();
    });

    it('ignores a secondary button', () => {
      const secondary = renderArea();
      fireEvent.pointerDown(secondary.root, { pointerId: 1, button: 2, clientX: 50, clientY: 25 });
      expect(secondary.onValueChange).not.toHaveBeenCalled();
    });

    it('ignores a press the consumer prevented', () => {
      const { root, onValueChange } = renderArea({ onPointerDown: (event) => event.preventDefault() });
      fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 50, clientY: 25 });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(root.hasPointerCapture(1)).toBe(false);
    });

    it('ignores presses while disabled', () => {
      const { root, onValueChange } = renderArea({ disabled: true });
      fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 50, clientY: 25 });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(root.hasPointerCapture(1)).toBe(false);
    });
  });

  describe('exposure: one slider unless the primary pointer is coarse (D19)', () => {
    it('hides the input without the Tab stop from assistive technology, following the Tab stop', async () => {
      const user = userEvent.setup();
      render(<ColorArea aria-label="Accent" defaultValue={MIDDLE} />);
      expect(screen.getAllByRole('slider')).toEqual([saturationInput()]);
      expect(brightnessInput()).toHaveAttribute('aria-hidden', 'true');
      act(() => saturationInput().focus());
      await user.keyboard('{ArrowUp}');
      expect(screen.getAllByRole('slider')).toEqual([brightnessInput()]);
      expect(saturationInput()).toHaveAttribute('aria-hidden', 'true');
      expect(brightnessInput()).not.toHaveAttribute('aria-hidden');
    });

    it('exposes both inputs on a coarse (touch) primary pointer, still with one Tab stop', () => {
      mockMatchMedia({ '(pointer: coarse)': true });
      render(<ColorArea aria-label="Accent" />);
      expect(screen.getAllByRole('slider')).toHaveLength(2);
      expect(brightnessInput()).not.toHaveAttribute('aria-hidden');
      expect(brightnessInput()).toHaveAttribute('tabindex', '-1');
    });

    it('follows a change of the primary pointer', () => {
      const restore = mockMatchMedia({ '(pointer: coarse)': true });
      render(<ColorArea aria-label="Accent" />);
      expect(screen.getAllByRole('slider')).toHaveLength(2);
      restore();
      expect(screen.getAllByRole('slider')).toHaveLength(1);
    });
  });

  function hydrate(ui: React.ReactElement, before?: () => void) {
    const html = renderToString(ui);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    before?.();
    const error = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    return {
      html,
      container,
      run(check: () => void) {
        try {
          act(() => {
            root = hydrateRoot(container, ui);
          });
          expect(error).not.toHaveBeenCalled();
          check();
        } finally {
          act(() => root?.unmount());
          container.remove();
          error.mockRestore();
        }
      },
    };
  }

  it('renders the one-slider model on the server and hydrates without warnings', () => {
    const server = hydrate(<ColorArea aria-label="Accent" defaultValue={DARK_BLUE} />);
    expect(server.html).toContain('--wave-color-area-gradient');
    expect(server.container.querySelector('input[aria-label="Brightness"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    server.run(() => {
      expect(server.container.querySelector('input[aria-label="Brightness"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });
  });

  it('hydrates on a coarse pointer without warnings and exposes both inputs afterwards', () => {
    const server = hydrate(<ColorArea aria-label="Accent" />, () => {
      mockMatchMedia({ '(pointer: coarse)': true });
    });
    server.run(() => {
      expect(server.container.querySelector('input[aria-label="Brightness"]')).not.toHaveAttribute(
        'aria-hidden',
      );
    });
  });
```

The C7 tests already query the inputs with `hidden: true`, so they keep passing once one input is hidden.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/ColorArea.test.tsx`
Expected: FAIL — the pointer tests report `expected "spy" to be called` (no pointer handling yet), the exposure test finds two sliders instead of one, and the server test finds no `aria-hidden` on the brightness input.

- [ ] **Step 3: Add the coarse-pointer store**

In `src/components/input/ColorArea.tsx`, after the `clampPercent` function, add:

```tsx
/** Touch-primary devices expose both inputs, so a touch screen reader can swipe each (D19). */
const COARSE_POINTER = '(pointer: coarse)';

function getCoarsePointerQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(COARSE_POINTER);
}

function subscribeCoarsePointer(notify: () => void): () => void {
  const query = getCoarsePointerQuery();
  if (!query) return () => {};
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', notify);
    return () => query.removeEventListener('change', notify);
  }
  // Safari < 14
  query.addListener(notify);
  return () => query.removeListener(notify);
}

function getCoarsePointer(): boolean {
  return getCoarsePointerQuery()?.matches ?? false;
}

/** The server renders the desktop model: one exposed slider. */
function getServerCoarsePointer(): boolean {
  return false;
}
```

- [ ] **Step 4: Add the pointer handlers and the exposure**

1. In the destructured props, after `onKeyDown,`, add `onPointerDown,` and `onPointerMove,`.
2. After `const [activeAxis, setActiveAxis] = React.useState<AreaAxis>('saturation');`, add:

```tsx
  const coarsePointer = React.useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointer,
    getServerCoarsePointer,
  );
  const fieldRef = React.useRef<HTMLDivElement>(null);
```

3. After `handleInputFocus`, add:

```tsx
  /** Moves the thumb to the pointer: saturation along x (mirrored in RTL), brightness along y. */
  const moveToPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const fieldElement = fieldRef.current;
    if (!fieldElement) return;
    const rect = fieldElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const s = getDirection(event.currentTarget) === 'rtl' ? 1 - x : x;
    const v = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    if (s === shown.s && v === shown.v) return;
    part.setColor({ ...color, s, v });
  };

  const handlePointerDown = composeEventHandlers(
    onPointerDown,
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (part.disabled || event.button !== 0 || !isOwnEvent(event)) return;
      // No text selection and no focus move of the press: focus goes to the Tab stop instead.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      moveToPointer(event);
      (activeAxis === 'saturation' ? saturationRef : brightnessRef).current?.focus({
        preventScroll: true,
      });
    },
  );

  // The drag lasts while the root holds the pointer; losing the capture (pointerup,
  // lostpointercapture) ends it.
  const handlePointerMove = composeEventHandlers(
    onPointerMove,
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (part.disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      moveToPointer(event);
    },
  );
```

4. In `inputProps`, after the `tabIndex` line, add:

```tsx
    // Where the primary pointer is not coarse, desktop screen readers meet one 2-D slider: the
    // input without the Tab stop is hidden (it stays focusable by script, never by Tab).
    'aria-hidden': axis !== activeAxis && !coarsePointer ? true : undefined,
```

5. On the root `<div>`, after `onKeyDown={handleKeyDown}`, add `onPointerDown={handlePointerDown}` and `onPointerMove={handlePointerMove}`; on the field `<div>`, add `ref={fieldRef}` before `aria-hidden="true"`.

6. Replace the component JSDoc's sentence "It is one Tab stop holding two sliders for assistive technology, …" with: "A press or drag (mouse, touch or pen) moves the thumb to the pointer. It is one Tab stop holding two sliders for assistive technology, "Saturation" and "Brightness", whose value texts start with their own channel and name the color; focus follows the axis a key moves, and unless the primary pointer is coarse (touch), only the slider with the Tab stop is exposed."

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/input/__tests__/ColorArea.test.tsx --reporter=default`
Expected: PASS, clean output (the `mockMatchMedia` changes run inside `act()`).

- [ ] **Step 6: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/ColorArea.tsx src/components/input/__tests__/ColorArea.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/ColorArea.tsx"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/input/ColorArea.tsx src/components/input/__tests__/ColorArea.test.tsx
git commit -m "feat(input): ColorArea pointer dragging and the one-exposed-slider model"
```

---

> **Checkpoint (spec §3).** `ColorArea`, `ColorSlider` and `AlphaSlider` are complete and tested with the context harness. The lead commits here (if the tasks were not committed one by one) and tells INTEGRATION that the standalone parts are ready: the color cases of §4.4 (#7, #8) can be drafted against them while Tasks C9–C12 finish the picker. Nothing in the barrels changes yet.

---

### Task C9: The picker-only parts and the composable container

**Files:**
- Modify: `src/components/input/ColorPicker.parts.tsx` (imports; append the strict context hook and the three parts)
- Modify: `src/components/input/ColorPicker.tsx` (restructured: the root provides the context and renders the parts; children; the compound)
- Modify: `src/components/input/__tests__/ColorPicker.parts.test.tsx` (append the part tests)
- Modify: `src/components/input/__tests__/ColorPicker.test.tsx` (append the composition tests)

**Interfaces:**
- Consumes: C4's context, labels and defaults; `SwatchPicker`; `isInvalidLook` (`./Input`); the registry constants `colorPickerClassNames`, `colorPickerHexFieldClassNames`, `colorPickerSwatchesClassNames`, `colorPickerPreviewClassNames`.
- Produces:
  - `ColorPicker.parts.tsx`: `usePickerPartContext(componentName: string): ColorPickerContextValue` (C-CONTEXT: throws `[WaveUI] <name> must be used within <ColorPicker>` in development); `export interface ColorPickerHexFieldProps extends React.HTMLAttributes<HTMLElement> { controlRef?: React.Ref<HTMLInputElement>; ref?: React.Ref<HTMLLabelElement> }`; `export interface ColorPickerSwatchesProps extends Omit<SwatchPickerProps, 'items' | 'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'name' | 'form' | 'required'> {}`; `export interface ColorPickerPreviewProps extends React.HTMLAttributes<HTMLDivElement> { ref?: React.Ref<HTMLDivElement> }`; `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview` (displayNames equal to the flat names).
  - `ColorPicker.tsx`: `export const ColorPicker = /* @__PURE__ */ Object.assign(ColorPickerRoot, { HexField, Swatches, Preview })` with the component docblock; re-exports `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview` and the types `ColorPickerLabels`, `ColorPickerHexFieldProps`, `ColorPickerSwatchesProps`, `ColorPickerPreviewProps` (the barrel is INTEGRATION's). `ColorPickerProps` gains `shape?: ColorPickerShape` and a documented `children`.
  - In this task the context's `hsv` is derived from the value and `setHsv` writes `hsvToHex(next)`; Task C10 replaces both with the working color.

- [ ] **Step 1: Write the failing part tests**

Append to `src/components/input/__tests__/ColorPicker.parts.test.tsx` (merge these imports into the file's import block: `act`, `render`, `screen` from `@testing-library/react`; `userEvent`; `renderToString` from `react-dom/server`; the ColorPicker exports; the constants; the helpers):

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  ColorPicker,
  ColorPickerHexField,
  ColorPickerPreview,
  ColorPickerSwatches,
} from '../ColorPicker';
import {
  colorPickerHexFieldClassNames,
  colorPickerPreviewClassNames,
  colorPickerSwatchesClassNames,
  swatchPickerClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectThrows,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';

function InPicker({ children }: { children: React.ReactNode }) {
  return <ColorPicker aria-label="Accent">{children}</ColorPicker>;
}

const hexInput = () => screen.getByRole('textbox', { name: 'Hex color value' });

describe('ColorPicker parts (D21)', () => {
  testCompoundExposure(ColorPicker, ['HexField', 'Swatches', 'Preview']);

  it('exports every part under its flat name (C-COMPOUND)', () => {
    expect(ColorPickerHexField).toBe(ColorPicker.HexField);
    expect(ColorPickerSwatches).toBe(ColorPicker.Swatches);
    expect(ColorPickerPreview).toBe(ColorPicker.Preview);
  });

  it('renders the same with the parts as Server Component references', () => {
    const HexField = asClientReference(ColorPicker.HexField);
    const Swatches = asClientReference(ColorPicker.Swatches);
    const Preview = asClientReference(ColorPicker.Preview);
    const plain = renderToString(
      <ColorPicker aria-label="Accent">
        <ColorPicker.Preview />
        <ColorPicker.HexField />
        <ColorPicker.Swatches />
      </ColorPicker>,
    );
    const lazy = renderToString(
      <ColorPicker aria-label="Accent">
        <Preview />
        <HexField />
        <Swatches />
      </ColorPicker>,
    );
    expect(lazy).toBe(plain);
  });

  it.each([
    ['ColorPicker.HexField', <ColorPicker.HexField key="hex" />],
    ['ColorPicker.Swatches', <ColorPicker.Swatches key="swatches" />],
    ['ColorPicker.Preview', <ColorPicker.Preview key="preview" />],
  ])('%s outside a ColorPicker throws in development (C-CONTEXT)', (name, ui) => {
    expectThrows(ui, `[WaveUI] ${name} must be used within <ColorPicker>`);
  });

  describe('ColorPicker.HexField', () => {
    testSystemProps(ColorPicker.HexField, {
      expectedTag: 'label',
      displayName: 'ColorPickerHexField',
      control: { role: 'textbox' },
      wrapper: InPicker,
    });

    it('routes id, the labelling aria-*, autoFocus, tabIndex, focus handlers and controlRef to the input', () => {
      const controlRef = React.createRef<HTMLInputElement>();
      const onFocus = vi.fn();
      render(
        <>
          <ColorPicker aria-label="Accent">
            <ColorPicker.HexField
              id="accent-hex"
              aria-describedby="accent-note"
              tabIndex={-1}
              autoFocus
              onFocus={onFocus}
              controlRef={controlRef}
              className="custom-field"
              data-testid="field"
            />
          </ColorPicker>
          <span id="accent-note">Six digits</span>
        </>,
      );
      const input = hexInput();
      expect(controlRef.current).toBe(input);
      expect(input).toHaveAttribute('id', 'accent-hex');
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input).toHaveAccessibleDescription('Six digits');
      expect(input).toHaveFocus();
      expect(onFocus).toHaveBeenCalledTimes(1);
      const field = screen.getByTestId('field');
      expect(field.tagName).toBe('LABEL');
      expect(field).toHaveClass(colorPickerHexFieldClassNames.root, 'custom-field');
      expect(field).not.toHaveAttribute('id');
    });

    it('a consumer aria-label names the input instead of labels.hexInput', () => {
      render(
        <ColorPicker aria-label="Accent">
          <ColorPicker.HexField aria-label="Farbe (hex)" />
        </ColorPicker>,
      );
      expect(screen.getByRole('textbox', { name: 'Farbe (hex)' })).toBeInTheDocument();
    });

    it('carries its part classes on the caption, the input and the error', async () => {
      const user = userEvent.setup();
      render(
        <ColorPicker aria-label="Accent">
          <ColorPicker.HexField />
        </ColorPicker>,
      );
      expect(screen.getByText('Hex')).toHaveClass(colorPickerHexFieldClassNames.label);
      expect(hexInput()).toHaveClass(colorPickerHexFieldClassNames.input);
      await user.tripleClick(hexInput());
      await user.keyboard('#zzz');
      expect(screen.getByText('Enter a hex color such as #0f6cbd.')).toHaveClass(
        colorPickerHexFieldClassNames.errorMessage,
      );
    });

    it('drops a flagged draft on a form reset (0.7 rule)', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Form">
          <ColorPicker aria-label="Accent" defaultValue="#0f6cbd">
            <ColorPicker.HexField />
          </ColorPicker>
        </form>,
      );
      await user.tripleClick(hexInput());
      await user.keyboard('#zzz');
      await user.tab();
      expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
      act(() => (screen.getByRole('form', { name: 'Form' }) as HTMLFormElement).reset());
      expect(hexInput()).toHaveValue('#0f6cbd');
      expect(hexInput()).not.toHaveAttribute('aria-invalid');
    });

    it('drops a flagged draft on a preset pick (0.7 rule)', async () => {
      const user = userEvent.setup();
      render(
        <ColorPicker aria-label="Accent" defaultValue="#0f6cbd">
          <ColorPicker.HexField />
          <ColorPicker.Swatches />
        </ColorPicker>,
      );
      await user.tripleClick(hexInput());
      await user.keyboard('#zzz');
      await user.tab();
      await user.click(screen.getByRole('radio', { name: 'Red' }));
      expect(hexInput()).toHaveValue('#d13438');
      expect(hexInput()).not.toHaveAttribute('aria-invalid');
    });

    it('drops a flagged draft when the value changes from outside (0.7 rule)', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ColorPicker aria-label="Accent" value="#0f6cbd" onValueChange={() => {}}>
          <ColorPicker.HexField />
        </ColorPicker>,
      );
      await user.tripleClick(hexInput());
      await user.keyboard('#12345');
      await user.tab();
      expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
      rerender(
        <ColorPicker aria-label="Accent" value="#107c10" onValueChange={() => {}}>
          <ColorPicker.HexField />
        </ColorPicker>,
      );
      expect(hexInput()).toHaveValue('#107c10');
      expect(hexInput()).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('ColorPicker.Swatches', () => {
    testSystemProps(ColorPicker.Swatches, {
      expectedTag: 'div',
      displayName: 'ColorPickerSwatches',
      wrapper: InPicker,
    });

    it("renders the picker's presets as a SwatchPicker with both classes; picking keeps the opacity", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <ColorPicker aria-label="Accent" defaultValue="#ff000080" onValueChange={onValueChange}>
          <ColorPicker.Swatches />
        </ColorPicker>,
      );
      const swatches = screen.getByRole('radiogroup', { name: 'Preset colors' });
      expect(swatches).toHaveClass(colorPickerSwatchesClassNames.root, swatchPickerClassNames.root);
      await user.click(screen.getByRole('radio', { name: 'Blue' }));
      expect(onValueChange).toHaveBeenLastCalledWith('#0f6cbd80');
    });

    it('takes SwatchPicker props (a name, a size) and renders nothing without presets', () => {
      const { rerender } = render(
        <ColorPicker aria-label="Accent">
          <ColorPicker.Swatches aria-label="Brand colors" size="large" />
        </ColorPicker>,
      );
      const swatches = screen.getByRole('radiogroup', { name: 'Brand colors' });
      expect(swatches.querySelector('[role="radio"]')).toHaveClass('w-10', 'h-10');
      rerender(
        <ColorPicker aria-label="Accent" presets={[]}>
          <ColorPicker.Swatches />
        </ColorPicker>,
      );
      expect(screen.queryByRole('radiogroup')).toBeNull();
    });
  });

  describe('ColorPicker.Preview', () => {
    testSystemProps(ColorPicker.Preview, {
      expectedTag: 'div',
      displayName: 'ColorPickerPreview',
      wrapper: InPicker,
    });

    it('shows the current color, is decorative, keeps its color in forced colors and follows the shape', () => {
      const { container } = render(
        <ColorPicker aria-label="Accent" defaultValue="#0f6cbd80" shape="square">
          <ColorPicker.Preview />
        </ColorPicker>,
      );
      const preview = container.querySelector<HTMLElement>('[data-color-preview]') as HTMLElement;
      expect(preview).toHaveClass(
        colorPickerPreviewClassNames.root,
        'rounded-none',
        'forced-colors:forced-color-adjust-none',
      );
      expect(preview).toHaveAttribute('aria-hidden', 'true');
      expect(preview).toHaveStyle({ backgroundColor: 'rgba(15, 108, 189, 0.5)' });
    });
  });
});
```

- [ ] **Step 2: Write the failing composition tests**

Append to `src/components/input/__tests__/ColorPicker.test.tsx` (add `fireEvent` and `within` if not imported; `renderWithFieldContext`, `FIELD_TEST_IDS`, `FIELD_TEST_TEXT` are imported already):

```tsx
describe('ColorPicker — composition (D21)', () => {
  it('renders only its children inside its named group, and still submits the value', () => {
    const { container } = render(
      <form aria-label="Form">
        <ColorPicker aria-label="Accent" name="accent" showOpacity>
          <ColorPicker.HexField />
        </ColorPicker>
      </form>,
    );
    const group = screen.getByRole('group', { name: 'Accent' });
    expect(within(group).getByRole('textbox', { name: 'Hex color value' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Opacity' })).toBeNull();
    expect(container.querySelector('[data-color-preview]')).toBeNull();
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(new FormData(form).get('accent')).toBe('#0f6cbd');
  });

  it('renders the default layout when the children render nothing', () => {
    render(<ColorPicker aria-label="Accent">{false}</ColorPicker>);
    expect(hexInput()).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Preset colors' })).toBeInTheDocument();
  });

  it('keeps the Field wiring on the group: one control id, one required input, the error on the hex field', () => {
    const { container } = renderWithFieldContext(
      <ColorPicker>
        <ColorPicker.HexField />
        <ColorPicker.Swatches />
      </ColorPicker>,
      { required: true, errorId: FIELD_TEST_IDS.errorId, hintId: FIELD_TEST_IDS.hintId },
    );
    const group = screen.getByRole('group', { name: FIELD_TEST_TEXT.label });
    expect(group).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
    expect(container.querySelectorAll(`[id="${FIELD_TEST_IDS.controlId}"]`)).toHaveLength(1);
    expect(container.querySelectorAll('input[required]')).toHaveLength(1);
    expect(hexInput()).toHaveAttribute('aria-invalid', 'true');
    expect(hexInput()).toHaveAccessibleDescription(FIELD_TEST_TEXT.error);
  });

  it("the hidden input's invalid event focuses the hex field, or else the first tabbable element", () => {
    const first = render(
      <ColorPicker aria-label="Accent" required>
        <ColorPicker.HexField />
      </ColorPicker>,
    );
    fireEvent.invalid(first.container.querySelector('input[required]') as HTMLInputElement);
    expect(hexInput()).toHaveFocus();
    first.unmount();

    const second = render(
      <ColorPicker aria-label="Accent" required defaultValue="#d13438">
        <ColorPicker.Swatches />
      </ColorPicker>,
    );
    fireEvent.invalid(second.container.querySelector('input[required]') as HTMLInputElement);
    expect(screen.getByRole('radio', { name: 'Red' })).toHaveFocus();
  });

  it('types: shape is the ColorPicker subset of Shape', () => {
    expectTypeOf<ColorPickerProps['shape']>().toEqualTypeOf<ColorPickerShape | undefined>();
    // @ts-expect-error a ColorPicker is rounded or square
    const circular = <ColorPicker shape="circular" />;
    expect(circular).toBeTruthy();
  });
});
```

Add to the imports of `ColorPicker.test.tsx`: `expectTypeOf` from `vitest`, `type ColorPickerProps` from `'../ColorPicker'`, and `import type { ColorPickerShape } from '../../../lib/types';`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/ColorPicker.parts.test.tsx src/components/input/__tests__/ColorPicker.test.tsx`
Expected: FAIL — `ColorPicker.HexField` is undefined (`testCompoundExposure` reports "HexField is not a component"; the imports of the flat names are `undefined`), and the composition tests find the default layout instead of the children.

- [ ] **Step 4: Add the strict hook and the parts to `ColorPicker.parts.tsx`**

Replace the import block of `src/components/input/ColorPicker.parts.tsx` with:

```tsx
import * as React from 'react';
import { useControllable } from '../../hooks/useControllable';
import type { FieldContextValue } from '../../hooks/useFieldControl';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { joinIds } from '../../lib/aria';
import {
  colorPickerHexFieldClassNames,
  colorPickerPreviewClassNames,
  colorPickerSwatchesClassNames,
} from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext } from '../../lib/dev';
import { inputFocus, inputInvalid } from '../../lib/styles';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import { isInvalidLook } from './Input';
import { SwatchPicker, type SwatchItem, type SwatchPickerProps } from './SwatchPicker';
import {
  formatHexColor,
  isHexDraft,
  parseHexColor,
  parseHexInput,
  sameColor,
  type HexColor,
} from './colorUtils';
```

Append at the end of the module:

```tsx
// ---------------------------------------------------------------------------------------------
// The picker-only parts: ColorPicker.HexField, ColorPicker.Swatches, ColorPicker.Preview
// ---------------------------------------------------------------------------------------------

/** The context a misplaced part renders with in production (C-CONTEXT). */
const INERT_PICKER_CONTEXT: ColorPickerContextValue = {
  hsv: DEFAULT_PART_COLOR,
  setHsv: noop,
  color: DEFAULT_COLOR,
  parsed: null,
  setColor: noop,
  pickPreset: noop,
  presetItems: [],
  shape: 'rounded',
  labels: DEFAULT_COLOR_PICKER_LABELS,
  disabled: true,
  draftResetKey: 0,
  field: null,
  groupInvalid: undefined,
  errorMessageId: undefined,
  registerHexInput: noop,
};

/**
 * The context of a picker-only part: throws `[WaveUI] <name> must be used within <ColorPicker>`
 * in development; logs once and returns an inert value in production (C-CONTEXT).
 */
export function usePickerPartContext(componentName: string): ColorPickerContextValue {
  const context = React.useContext(ColorPickerContext);
  if (context) return context;
  reportMissingContext(componentName, '<ColorPicker>');
  return INERT_PICKER_CONTEXT;
}

/** The hex field's text while the user edits it (`null` state: the field shows the value). */
interface HexDraft {
  /** The typed text. */
  text: string;
  /** Kept after leaving the field because it is not a hex color, so it is flagged as invalid. */
  flagged: boolean;
}

/** A hex draft without digits (`''` or a lone `#`): leaving the field shows the value again. */
function isBlankDraft(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === '' || trimmed === '#';
}

/** Whether typed hex text carries its own alpha digits (`#rgba` or `#rrggbbaa`). */
function hasAlphaDigits(text: string): boolean {
  const digits = text.trim().replace(/^#/, '').length;
  return digits === 4 || digits === 8;
}

/**
 * Properties for the ColorPickerHexField sub-component. `id`, the labelling and validation
 * `aria-*` (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`,
 * `aria-errormessage`, `aria-details`, `aria-required`), `autoFocus`, `tabIndex`, the focus and key
 * handlers and the text-entry attributes (`inputMode`, `enterKeyHint`, `autoCapitalize`,
 * `autoCorrect`, `spellCheck`) go to the `<input>`; everything else stays on the outer label.
 */
export interface ColorPickerHexFieldProps extends React.HTMLAttributes<HTMLElement> {
  /** Ref to the hex `<input>`. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the field's outer element: the label around the caption, the input and the error. */
  ref?: React.Ref<HTMLLabelElement>;
}

/**
 * The hex text field of a ColorPicker: a caption, the input and its error. The text is a draft:
 * complete 6- and 8-digit values apply while typing, text that can never be a hex color is
 * flagged at once, and leaving the field (or Enter) applies a short `#rgb`/`#rgba` and shows the
 * value again; other text stays flagged until it is corrected, cleared, or the value changes from
 * elsewhere (a preset, another part, the parent, a form reset). Inside a Field it carries the
 * Field's invalid state and error. Must be inside a ColorPicker. Also exported as
 * `ColorPickerHexField` (import the flat name in React Server Components).
 */
export const ColorPickerHexField = ({
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  'aria-required': ariaRequired,
  autoFocus,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  inputMode,
  enterKeyHint,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  controlRef,
  className,
  ref,
  ...rest
}: ColorPickerHexFieldProps) => {
  const picker = usePickerPartContext('ColorPicker.HexField');
  const { color, parsed, field, groupInvalid, errorMessageId, labels } = picker;
  const alpha = parsed?.alpha ?? 255;

  // The hex text is a draft over `color` while the user edits it (null: show `color`).
  const [draft, setDraft] = React.useState<HexDraft | null>(null);
  // A value change from elsewhere replaces a flagged draft (input-pickers#25); while the user
  // types, the draft is not flagged and stays.
  const [syncedColor, setSyncedColor] = React.useState(color);
  if (color !== syncedColor) {
    setSyncedColor(color);
    if (draft?.flagged) setDraft(null);
  }
  // A form reset or a preset pick drops any draft.
  const [seenResetKey, setSeenResetKey] = React.useState(picker.draftResetKey);
  if (picker.draftResetKey !== seenResetKey) {
    setSeenResetKey(picker.draftResetKey);
    setDraft(null);
  }
  const hexText = draft?.text ?? color;
  const draftInvalid =
    draft !== null && !isBlankDraft(draft.text) && (draft.flagged || !isHexDraft(draft.text));
  // Any invalid state from outside (the picker's prop or the Field) is set on the input as is;
  // only `true` shows the error look.
  const fieldInvalid =
    groupInvalid !== undefined && groupInvalid !== false && groupInvalid !== 'false';
  const errorId = useId('wave-color-picker-error');
  const resolvedInvalid = ariaInvalid ?? (draftInvalid ? true : fieldInvalid ? groupInvalid : undefined);
  const invalidLook = isInvalidLook(false, resolvedInvalid);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(inputRef, controlRef, picker.registerHexInput);

  /** The single commit path: every edit is `#rrggbb` + an alpha byte. */
  const commit = (rgb: string, nextAlpha: number) => picker.setColor(formatHexColor(rgb, nextAlpha));

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Surrounding whitespace (a pasted `'#abcdef '`) is dropped, so the text that is checked,
    // committed and shown is the same.
    let text = event.target.value.trim();
    if (text !== '' && !text.startsWith('#')) text = `#${text}`;
    setDraft({ text, flagged: false });
    const typed = parseHexInput(text);
    // A 6-digit hex keeps the current opacity; an 8-digit one brings its own alpha.
    if (typed) commit(typed.rgb, hasAlphaDigits(text) ? typed.alpha : alpha);
  };

  /** Finishes the draft when the field is left or Enter is pressed. */
  const finishDraft = () => {
    if (draft === null || draft.flagged) return;
    const typed = parseHexColor(draft.text);
    if (typed || isBlankDraft(draft.text)) {
      // A short `#rgb` (current opacity) or `#rgba` is applied here; complete values were
      // applied while typing, so a rejecting parent is not asked twice. Then the field shows the
      // current value (also when a controlled parent rejected it).
      if (typed && !parseHexInput(draft.text)) {
        commit(typed.rgb, hasAlphaDigits(draft.text) ? typed.alpha : alpha);
      }
      setDraft(null);
      return;
    }
    // Text that is not a hex color is kept and flagged instead of thrown away (WCAG 3.3.1).
    setDraft({ text: draft.text, flagged: true });
  };

  const handleBlur = composeEventHandlers(onBlur, finishDraft);
  // Not prevented: Enter still submits the surrounding form, with the color just applied.
  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' && !event.nativeEvent.isComposing) finishDraft();
    },
  );

  return (
    <label
      ref={ref}
      className={cn(colorPickerHexFieldClassNames.root, 'flex min-w-0 flex-col gap-1', className)}
      {...rest}
    >
      <span className={cn(colorPickerHexFieldClassNames.label, 'text-caption-1 text-muted-foreground')}>
        {labels.hex}
      </span>
      <input
        ref={mergedInputRef}
        id={id}
        type="text"
        value={hexText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onFocus={onFocus}
        onBlur={handleBlur}
        aria-label={ariaLabel ?? (ariaLabelledBy === undefined ? labels.hexInput : undefined)}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={resolvedInvalid}
        aria-errormessage={ariaErrorMessage ?? errorMessageId}
        aria-describedby={joinIds(
          draftInvalid && errorId,
          field?.validationMessageId ?? (fieldInvalid ? field?.errorId : undefined),
          errorMessageId,
          ariaDescribedBy,
        )}
        aria-details={ariaDetails}
        aria-required={ariaRequired}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck ?? false}
        maxLength={9}
        autoComplete="off"
        className={cn(
          colorPickerHexFieldClassNames.input,
          'w-24 rounded border border-input border-b-stroke-accessible bg-background px-2 py-1 text-body-1 text-foreground',
          inputFocus,
          invalidLook && inputInvalid,
        )}
      />
      {draftInvalid && (
        <span
          id={errorId}
          className={cn(colorPickerHexFieldClassNames.errorMessage, 'text-caption-1 text-error')}
        >
          {labels.hexError}
        </span>
      )}
    </label>
  );
};

ColorPickerHexField.displayName = 'ColorPickerHexField';

/** Properties for the ColorPickerSwatches sub-component: the picker's `presets` as a SwatchPicker. */
export interface ColorPickerSwatchesProps extends Omit<
  SwatchPickerProps,
  'items' | 'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'name' | 'form' | 'required'
> {}

/**
 * The picker's `presets` as swatches (a SwatchPicker named by `labels.presets`, small and rounded
 * unless you pass `size` or `shape`). Picking one keeps the opacity. Renders nothing without
 * presets. Must be inside a ColorPicker. Also exported as `ColorPickerSwatches`.
 */
export const ColorPickerSwatches = ({
  className,
  'aria-label': ariaLabel,
  size = 'small',
  shape = 'rounded',
  ...rest
}: ColorPickerSwatchesProps) => {
  const picker = usePickerPartContext('ColorPicker.Swatches');
  if (picker.presetItems.length === 0) return null;
  return (
    <SwatchPicker
      aria-label={ariaLabel ?? (rest['aria-labelledby'] === undefined ? picker.labels.presets : undefined)}
      size={size}
      shape={shape}
      {...rest}
      className={cn(colorPickerSwatchesClassNames.root, className)}
      items={picker.presetItems}
      value={picker.parsed ? picker.parsed.rgb : ''}
      onValueChange={picker.pickPreset}
    />
  );
};

ColorPickerSwatches.displayName = 'ColorPickerSwatches';

/** Properties for the ColorPickerPreview sub-component. */
export interface ColorPickerPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A swatch of the picker's current color (decorative, `aria-hidden`); it keeps its color in forced
 * colors and follows the picker's `shape`. Must be inside a ColorPicker. Also exported as
 * `ColorPickerPreview`.
 */
export const ColorPickerPreview = ({ className, style, ref, ...rest }: ColorPickerPreviewProps) => {
  const picker = usePickerPartContext('ColorPicker.Preview');
  const shown = picker.parsed
    ? formatHexColor(picker.parsed.rgb, picker.parsed.alpha)
    : picker.color;
  return (
    <div
      data-color-preview=""
      aria-hidden="true"
      {...rest}
      ref={ref}
      className={cn(
        colorPickerPreviewClassNames.root,
        'h-10 w-10 shrink-0 rounded border border-border forced-colors:forced-color-adjust-none',
        picker.shape === 'square' && 'rounded-none',
        className,
      )}
      style={{ ...style, backgroundColor: shown }}
    />
  );
};

ColorPickerPreview.displayName = 'ColorPickerPreview';
```

(`noop`, `DEFAULT_COLOR`, `DEFAULT_PART_COLOR`, `DEFAULT_COLOR_PICKER_LABELS` and `ColorPickerContext` are the declarations of Task C4 higher up in the module.)

- [ ] **Step 5: Restructure `ColorPicker.tsx`**

Replace the whole content of `src/components/input/ColorPicker.tsx` (the post-C4 module: 0.7 code plus wave A's classes and C4's label import) with:

```tsx
import * as React from 'react';
import { colorPickerClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { hexToHsv, hsvToHex } from '../../lib/color';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { getFirstTabbable } from '../../lib/focus';
import { slotRendersContent } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { ColorPickerShape, HsvColor } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { FieldContext, useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import type { SwatchItem } from './SwatchPicker';
import {
  ColorPickerContext,
  ColorPickerHexField,
  ColorPickerPreview,
  ColorPickerSwatches,
  DEFAULT_COLOR,
  DEFAULT_COLOR_PICKER_LABELS,
  DEFAULT_PART_COLOR,
  type ColorPickerContextValue,
  type ColorPickerLabels,
} from './ColorPicker.parts';
import {
  alphaToOpacity,
  formatHexColor,
  normalizeHexColor,
  opacityToAlpha,
  parseHexColor,
} from './colorUtils';

export { ColorPickerHexField, ColorPickerPreview, ColorPickerSwatches };
export type { ColorPickerLabels };
export type {
  ColorPickerHexFieldProps,
  ColorPickerPreviewProps,
  ColorPickerSwatchesProps,
} from './ColorPicker.parts';

/** A named preset color. */
export interface ColorPickerPreset {
  /**
   * Hex color (`#rrggbb`; `#rgb` is expanded). A preset has no opacity of its own: picking it keeps
   * the current opacity, so its alpha digits (`#rgba`, `#rrggbbaa`) are ignored. An alpha below
   * `f`/`ff` logs a development warning; an opaque one (`#rgbf`, `#rrggbbff`) changes nothing.
   */
  color: string;
  /** Accessible name of the preset swatch, e.g. `'Cranberry'`. */
  label: string;
}

/** Properties for the ColorPicker component. */
export interface ColorPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /**
   * Controlled hex color: `#rrggbb`, or `#rrggbbaa` with an alpha byte (e.g. `'#0f6cbd80'` for
   * 50% opacity). Other formats are not supported (development warning).
   */
  value?: string;
  /**
   * Initial hex color for uncontrolled usage (also what a form reset restores). Like every edit it
   * is shown, submitted and reported as a lowercase `#rrggbb`, or `#rrggbbaa` when it is not fully
   * opaque (`'#ABC'` becomes `'#aabbcc'`).
   * @default '#0f6cbd'
   */
  defaultValue?: string;
  /**
   * Called with the new color when it changes: a lowercase `#rrggbb`, or `#rrggbbaa` when the color
   * is not fully opaque.
   */
  onValueChange?: (color: string) => void;
  /**
   * Called with the new color when it changes.
   * @deprecated Use `onValueChange`.
   */
  onChange?: (color: string) => void;
  /**
   * Preset colors shown as quick-select swatches. Pass `{ color, label }` objects so screen reader
   * users hear a name; a plain hex string is announced by its hex code. Non-hex presets are
   * skipped (development warning). Picking a preset keeps the current opacity, so a preset's alpha
   * digits are ignored. With an alpha below `f`/`ff` (`#rgba`, `#rrggbbaa`) there is a development
   * warning, and a string preset is announced by the `#rrggbb` color it applies; an opaque alpha
   * (`#rgbf`, `#rrggbbff`) changes nothing, and the string stays the name as written. With
   * `children`, the presets feed only `ColorPicker.Swatches`.
   * @default Blue, Red, Green, Yellow, Purple, Teal, Pink and Black (Fluent brand colors)
   */
  presets?: ReadonlyArray<string | ColorPickerPreset>;
  /** Whether the default layout shows the opacity row (the opacity is the alpha byte of `value`).
   * Does nothing with `children`.
   * @default false
   */
  showOpacity?: boolean;
  /** Texts of the picker's own parts and of the color parts bound to it, for localisation. */
  labels?: ColorPickerLabels;
  /**
   * `'square'` removes the corner radius of the preview and of the color parts bound to the
   * picker (the area and the rails).
   * @default 'rounded'
   */
  shape?: ColorPickerShape;
  /**
   * Your own layout: `ColorArea`, `ColorSlider` and `AlphaSlider` (bound to the picker while they
   * have neither `value` nor `defaultValue`) and the parts `ColorPicker.HexField`,
   * `ColorPicker.Swatches` and `ColorPicker.Preview`. Without children the picker renders its
   * default layout. With children, `showOpacity` does nothing and `presets` feed only
   * `ColorPicker.Swatches`.
   */
  children?: React.ReactNode;
  /** Form field name. With a name, the current color is submitted with the form. */
  name?: string;
  /**
   * Marks the hidden form input as required (a color is always chosen, so it never blocks). A
   * consumer `aria-required` has the same effect: `role="group"` does not support it, so it is not
   * rendered on the group.
   */
  required?: boolean;
  /** Id of the form the picker belongs to, when it is rendered outside that form. */
  form?: string;
  /** Ref to the root `role="group"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

const DEFAULT_PRESETS: readonly ColorPickerPreset[] = [
  { color: '#0f6cbd', label: 'Blue' }, // wave-allow-color: preset swatch data
  { color: '#d13438', label: 'Red' }, // wave-allow-color: preset swatch data
  { color: '#107c10', label: 'Green' }, // wave-allow-color: preset swatch data
  { color: '#ffb900', label: 'Yellow' }, // wave-allow-color: preset swatch data
  { color: '#5c2d91', label: 'Purple' }, // wave-allow-color: preset swatch data
  { color: '#008272', label: 'Teal' }, // wave-allow-color: preset swatch data
  { color: '#e3008c', label: 'Pink' }, // wave-allow-color: preset swatch data
  { color: '#242424', label: 'Black' }, // wave-allow-color: preset swatch data
];

interface ResolvedPresets {
  items: SwatchItem[];
  /** Presets that are not hex colors (skipped). */
  invalid: string[];
  /** Presets with an alpha byte below 255, which a preset cannot apply (ignored). */
  translucent: string[];
}

/** Normalises presets to swatch items keyed by their lowercase `#rrggbb` (duplicates dropped). */
function resolvePresets(presets: ReadonlyArray<string | ColorPickerPreset>): ResolvedPresets {
  const items: SwatchItem[] = [];
  const invalid: string[] = [];
  const translucent: string[] = [];
  const seen = new Set<string>();
  for (const preset of presets) {
    const color = typeof preset === 'string' ? preset : preset.color;
    const parsed = parseHexColor(color);
    if (!parsed) {
      invalid.push(color);
      continue;
    }
    // Picking a preset keeps the current opacity, so its own alpha never applies.
    const hasAlpha = parsed.alpha !== 255;
    if (hasAlpha) translucent.push(color);
    if (seen.has(parsed.rgb)) continue;
    seen.add(parsed.rgb);
    // A string preset is announced by its hex code: the color it applies, without the alpha.
    const stringLabel = hasAlpha ? parsed.rgb : color;
    items.push({
      value: parsed.rgb,
      color: parsed.rgb,
      label: typeof preset === 'string' ? stringLabel : preset.label,
    });
  }
  return { items, invalid, translucent };
}

// The ColorPicker root, documented on the exported `ColorPicker` const.
const ColorPickerRoot = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  presets = DEFAULT_PRESETS,
  showOpacity = false,
  labels,
  shape = 'rounded',
  name,
  required,
  form,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  children,
  ref,
  ...rest
}: ColorPickerProps) => {
  if (onChange !== undefined) warnDeprecated('ColorPicker', 'onChange', 'onValueChange');
  // The default is written like every edit (C-FORMS): the picker shows, submits and restores it as
  // a lowercase `#rrggbb`/`#rrggbbaa`. A value that is not a hex color stays as given (warning
  // below).
  const rawDefault = defaultValue ?? DEFAULT_COLOR;
  const initialValue = normalizeHexColor(rawDefault) ?? rawDefault;
  const strings = React.useMemo(() => ({ ...DEFAULT_COLOR_PICKER_LABELS, ...labels }), [labels]);
  const [color, setColor] = useControllable(valueProp, initialValue, (next: string) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  const parsed = React.useMemo(() => parseHexColor(color), [color]);
  const alpha = parsed?.alpha ?? 255;
  const opacity = alphaToOpacity(alpha);

  const {
    items: presetItems,
    invalid: invalidPresets,
    translucent: translucentPresets,
  } = React.useMemo(() => resolvePresets(presets), [presets]);
  const invalidPresetKey = invalidPresets.join('\n');
  const translucentPresetKey = translucentPresets.join('\n');
  const invalidValue = parsed ? null : color;

  React.useEffect(() => {
    if (invalidValue !== null) {
      warnOnce(
        'ColorPicker:invalid-value',
        `ColorPicker: "${invalidValue}" is not a hex color (#rrggbb or #rrggbbaa). Pass a hex value; the opacity slider is disabled until then.`,
      );
    }
  }, [invalidValue]);
  React.useEffect(() => {
    if (!invalidPresetKey) return;
    for (const preset of invalidPresetKey.split('\n')) {
      warnOnce(
        `ColorPicker:invalid-preset:${preset}`,
        `ColorPicker: preset "${preset}" is not a hex color (#rgb or #rrggbb) and is not shown.`,
      );
    }
  }, [invalidPresetKey]);
  React.useEffect(() => {
    if (!translucentPresetKey) return;
    for (const preset of translucentPresetKey.split('\n')) {
      warnOnce(
        `ColorPicker:alpha-preset:${preset}`,
        `ColorPicker: preset "${preset}" has an alpha byte, which is ignored: picking a preset keeps the current opacity. Pass the color as #rgb or #rrggbb.`,
      );
    }
  }, [translucentPresetKey]);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const hexInputRef = React.useRef<HTMLInputElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, rootRef);
  const registerHexInput = React.useCallback((input: HTMLInputElement | null) => {
    hexInputRef.current = input;
  }, []);
  // Changes whenever the hex field must drop its draft: a form reset or a preset pick.
  const [draftResetKey, setDraftResetKey] = React.useState(0);

  const field = useFieldContext();
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    { labelable: false },
  );
  // A group supports neither aria-invalid, aria-required nor a native `required` (ARIA 1.2): the
  // invalid state goes to the hex field and the required state to the hidden form input.
  const {
    'aria-invalid': groupInvalid,
    'aria-required': _ariaRequired,
    required: _required,
    ...groupProps
  } = fieldProps;
  const fieldInvalid =
    groupInvalid !== undefined && groupInvalid !== false && groupInvalid !== 'false';
  // A consumer aria-required is not supported on the group either: it requires the hidden input.
  const isRequired =
    required ?? (ariaRequired === true || ariaRequired === 'true' || (field?.required ?? false));
  // The consumer's error message belongs to the invalid state set from outside (the prop or the
  // Field), so it is routed to the hex field only while that state is set.
  const errorMessageId = (fieldInvalid && ariaErrorMessage) || undefined;

  useFormReset(
    rootRef,
    () => {
      // Only a real change is reported: the same color in another spelling (a controlled `#ABC`
      // against the default `#aabbcc`) is not one.
      if ((normalizeHexColor(color) ?? color) !== initialValue) setColor(initialValue);
      setDraftResetKey((key) => key + 1);
    },
    form,
  );

  const pickPreset = useEventCallback((rgb: string) => {
    // Only a preset color is committed. The presets' own form reset reports `''` (no swatch): it
    // is ignored here, and the picker's reset restores `defaultValue` (input-basic#12).
    const preset = parseHexColor(rgb);
    if (!preset) return;
    setDraftResetKey((key) => key + 1);
    setColor(formatHexColor(preset.rgb, alpha));
  });

  // Replaced by the working color in the next task: here the bound parts read the value's HSV.
  const hsv = React.useMemo(() => hexToHsv(color) ?? DEFAULT_PART_COLOR, [color]);
  const setHsv = useEventCallback((next: HsvColor) => {
    if (parsed) setColor(hsvToHex(next));
  });

  const context = React.useMemo<ColorPickerContextValue>(
    () => ({
      hsv,
      setHsv,
      color,
      parsed,
      setColor,
      pickPreset,
      presetItems,
      shape,
      labels: strings,
      disabled: parsed === null,
      draftResetKey,
      field,
      groupInvalid,
      errorMessageId,
      registerHexInput,
    }),
    [
      hsv,
      setHsv,
      color,
      parsed,
      setColor,
      pickPreset,
      presetItems,
      shape,
      strings,
      draftResetKey,
      field,
      groupInvalid,
      errorMessageId,
      registerHexInput,
    ],
  );

  const handleOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!parsed) return;
    setColor(formatHexColor(parsed.rgb, opacityToAlpha(Number(event.target.value))));
  };

  /** The hidden input's `onInvalid`: the hex field when there is one, else the first tabbable element. */
  const focusInvalidTarget = () => {
    const root = rootRef.current;
    (hexInputRef.current ?? (root ? getFirstTabbable(root) : null))?.focus();
  };

  return (
    <div
      role="group"
      {...groupProps}
      className={cn(
        colorPickerClassNames.root,
        'relative inline-flex flex-col gap-3 rounded border border-border bg-background p-3 shadow-4',
        className,
      )}
      {...rest}
      ref={mergedRef}
    >
      <ColorPickerContext.Provider value={context}>
        {/* The Field wiring (id, label, hint and error, invalid, required) stays on the group:
            the parts inside never read the surrounding FieldContext. */}
        <FieldContext.Provider value={null}>
          {slotRendersContent(children) ? (
            children
          ) : (
            <>
              <div className="flex items-start gap-2">
                <ColorPickerPreview />
                <ColorPickerHexField />
              </div>
              <ColorPickerSwatches />
              {showOpacity && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      colorPickerClassNames.opacityLabel,
                      'w-14 text-caption-1 text-muted-foreground',
                    )}
                  >
                    {strings.opacity}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacity}
                    onChange={handleOpacityChange}
                    disabled={!parsed}
                    aria-label={strings.opacity}
                    aria-valuetext={`${opacity}%`}
                    className={cn(
                      'h-1 flex-1 accent-primary disabled:cursor-not-allowed disabled:opacity-50',
                      focusRing,
                    )}
                  />
                  <span
                    className={cn(
                      colorPickerClassNames.opacityValue,
                      'w-10 text-end text-caption-1 text-muted-foreground',
                    )}
                  >
                    {opacity}%
                  </span>
                </div>
              )}
            </>
          )}
        </FieldContext.Provider>
      </ColorPickerContext.Provider>
      <HiddenInput
        type="text"
        name={name}
        form={form}
        value={color}
        required={isRequired}
        onInvalid={focusInvalidTarget}
      />
    </div>
  );
};

ColorPickerRoot.displayName = 'ColorPicker';

/**
 * A color picker whose value is a hex string (`#rrggbb`, or `#rrggbbaa` with an alpha byte),
 * grouped as a named `role="group"`.
 *
 * - **Default layout** (no children): a preview and the hex field, preset swatches and, with
 *   `showOpacity`, an opacity row.
 * - **Your own layout** (children): `ColorArea`, `ColorSlider` and `AlphaSlider`, which bind to
 *   the picker while they have neither `value` nor `defaultValue`, and the parts
 *   `ColorPicker.HexField`, `ColorPicker.Swatches` and `ColorPicker.Preview`.
 * - **Hex field**: the text is a draft. Complete 6- and 8-digit values apply while typing; text
 *   that can never be a hex color is flagged at once (`aria-invalid` plus the `hexError`
 *   description). Leaving the field or pressing Enter applies a short `#rgb` (keeping the current
 *   opacity) or `#rgba`, then shows the current value again; other text stays flagged until it is
 *   corrected, cleared, or the value changes from elsewhere. Enter still submits the surrounding
 *   form, with the color just applied.
 * - **Presets** render as a SwatchPicker radiogroup ("Preset colors"): one tab stop, arrow keys
 *   move and pick, and picking keeps the current opacity.
 * - **Naming**: `aria-label`/`aria-labelledby` name the group; inside a `Field` its label does,
 *   and the Field's hint and error describe the group. The invalid state (`aria-invalid`, from the
 *   Field or the prop) is set on the hex field, since `role="group"` does not support it, and a
 *   consumer `aria-errormessage` goes there too. A consumer `aria-required` makes the hidden form
 *   input required instead. The built-in texts are localised with `labels`.
 * - **Forms**: with `name` the color is submitted with the form; a form reset restores
 *   `defaultValue` and reports it through `onValueChange` only when the color changes.
 *
 * React Server Components cannot dot into a client module: import the flat names
 * `ColorPickerHexField`, `ColorPickerSwatches` and `ColorPickerPreview` there;
 * `ColorPicker.HexField` etc. work in client files.
 *
 * @example
 * <ColorPicker aria-label="Accent color" showOpacity value={color} onValueChange={setColor} />
 *
 * <ColorPicker aria-label="Accent color" value={color} onValueChange={setColor}>
 *   <ColorArea />
 *   <ColorSlider />
 *   <ColorPicker.HexField />
 * </ColorPicker>
 */
export const ColorPicker = /* @__PURE__ */ Object.assign(ColorPickerRoot, {
  HexField: ColorPickerHexField,
  Swatches: ColorPickerSwatches,
  Preview: ColorPickerPreview,
});
```

- [ ] **Step 6: Run the part, composition and 0.7 tests**

Run: `npx vitest run src/components/input/__tests__/ColorPicker.parts.test.tsx src/components/input/__tests__/ColorPicker.test.tsx --reporter=default`
Expected: PASS — the new tests and every 0.7 ColorPicker test (the default layout renders the same controls through the parts; the hex error now sits inside the hex field's label, which no 0.7 test pins), with no unasserted warning.

- [ ] **Step 7: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/ColorPicker.tsx src/components/input/ColorPicker.parts.tsx src/components/input/__tests__/ColorPicker.parts.test.tsx src/components/input/__tests__/ColorPicker.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/ColorPicker" && npx vitest run .storybook/__tests__/exportDocblocks.test.ts`
Expected: PASS: the gate finds `colorPickerClassNames.root`, `colorPickerHexFieldClassNames.root`, `colorPickerSwatchesClassNames.root` and `colorPickerPreviewClassNames.root`; the component docblock sits only on the compound const and names no internal symbol.

- [ ] **Step 8: Run the cross-cutting suites that read the entry**

Run: `npx vitest run src/__tests__/public-types.test.ts src/__tests__/classNames.test.ts src/__tests__/integration.test.tsx`
Expected: PASS — `ColorPickerHexFieldProps`, `ColorPickerSwatchesProps` and `ColorPickerPreviewProps` become reachable from the entry through `typeof ColorPicker` and are skipped by `PENDING_PUBLIC_TYPES` until INTEGRATION exports them; the three 0.8 constants are on `PENDING_CLASS_NAMES`; the integration cases of 0.7 (the real Field around ColorPicker) are unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/components/input/ColorPicker.tsx src/components/input/ColorPicker.parts.tsx src/components/input/__tests__/ColorPicker.parts.test.tsx src/components/input/__tests__/ColorPicker.test.tsx
git commit -m "feat(input): ColorPicker.HexField, .Swatches and .Preview; children compose the picker"
```

---

### Task C10: The working color and the new default layout

**Files:**
- Modify: `src/components/input/ColorPicker.tsx`
- Modify: `src/components/input/__tests__/ColorPicker.test.tsx`

**Interfaces:**
- Consumes: `ColorArea` (C7, C8), `ColorSlider` (C5), `AlphaSlider` (C6); `hexToHsv`, `hsvToHex` (C1); the C9 root.
- Produces: the picker's HSV working color (spec D21 with the lead's refinement): state that bound parts read and write through `setHsv`; re-derived during render whenever the normalized value differs from `hsvToHex(hsv)`, keeping the previous hue when the new color is achromatic and the previous saturation (and hue) when it is black. The default layout gains a bound `ColorArea` and a bound hue `ColorSlider` at the top, and the opacity row's slider becomes a bound `AlphaSlider` (still named by `labels.opacity`, 0–100, with the caption and readout of 0.7).

**Decision recorded for the report (spec §10):** D21 re-derives the working color "when the hex `value` changes from outside and differs from `hsvToHex(hsv)`". The lead's ruling drops "changes from outside": the picker re-derives whenever the value differs from the working color, so a controlled parent that ignores `onValueChange` keeps the area and the sliders at its value (the value is the source of truth), and a parent that accepts the change never triggers it (its new value equals `hsvToHex(hsv)`, so the hue of a gray survives).

- [ ] **Step 1: Write the failing tests and update the 0.7 assertions of §6.4**

In `src/components/input/__tests__/ColorPicker.test.tsx`:

1. Change the import from `'../../../lib/styles'` to `import { inputInvalid } from '../../../lib/styles';` (the opacity input no longer carries `focusRing`), and add:

```tsx
import { AlphaSlider } from '../AlphaSlider';
import { ColorArea } from '../ColorArea';
import { ColorSlider } from '../ColorSlider';
import { alphaSliderClassNames } from '../../../lib/classNames';
```

2. Replace the warning helper:

```tsx
/** The development warning for a `value`/`defaultValue` that is not a hex color. */
function invalidValueWarning(value: string) {
  return (
    `[WaveUI] ColorPicker: "${value}" is not a hex color (#rrggbb or #rrggbbaa). Pass a hex ` +
    'value; the color area and sliders are disabled until then.'
  );
}
```

3. Replace the test `'shows the shared focus ring on the opacity slider (C-FOCUS)'` (0.7 lines 433–438; spec §6.4: the indicator moves to the AlphaSlider's thumb because the input is transparent) with:

```tsx
  it('shows the two-tone focus indicator on the opacity slider thumb (C-FOCUS)', () => {
    render(<ColorPicker showOpacity />);
    const root = opacitySlider().closest(`.${alphaSliderClassNames.root}`) as HTMLElement;
    expect(root.querySelector(`.${alphaSliderClassNames.thumb}`)).toHaveClass(
      'group-has-[:focus-visible]/alpha-slider:outline-2',
      'group-has-[:focus-visible]/alpha-slider:outline-offset-2',
      'group-has-[:focus-visible]/alpha-slider:outline-ring',
      'group-has-[:focus-visible]/alpha-slider:ring-background',
    );
    expect(opacitySlider()).not.toHaveClass('focus:outline-none');
  });
```

4. Append:

```tsx
const areaGroup = () => screen.getByRole('group', { name: 'Saturation and brightness' });
const saturationInput = () => screen.getByRole('slider', { name: 'Saturation', hidden: true });
const hueSlider = () => screen.getByRole('slider', { name: 'Hue' });

describe('ColorPicker — default layout and working color (D21)', () => {
  it('puts a color area and a hue slider above the rows of 0.7', () => {
    render(<ColorPicker aria-label="Accent" showOpacity />);
    const order = [
      areaGroup(),
      hueSlider(),
      hexInput(),
      screen.getByRole('radiogroup', { name: 'Preset colors' }),
      opacitySlider(),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('keeps the hue while saturation is dragged to zero and back', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker aria-label="Accent" defaultValue="#0f6cbd" onValueChange={onValueChange} />);
    act(() => saturationInput().focus());
    await user.keyboard('{Home}');
    expect(onValueChange).toHaveBeenLastCalledWith('#bdbdbd');
    expect(hueSlider()).toHaveValue('208');
    await user.keyboard('{End}');
    expect(onValueChange).toHaveBeenLastCalledWith('#0065bd');
    expect(hueSlider()).toHaveValue('208');
  });

  it('keeps the hue when a gray value arrives from outside, and the saturation for black', () => {
    const { rerender } = render(<ColorPicker aria-label="Accent" value="#0f6cbd" />);
    rerender(<ColorPicker aria-label="Accent" value="#808080" />);
    expect(hueSlider()).toHaveValue('208');
    expect(saturationInput()).toHaveValue('0');
    rerender(<ColorPicker aria-label="Accent" value="#0f6cbd" />);
    rerender(<ColorPicker aria-label="Accent" value="#000000" />);
    expect(saturationInput()).toHaveValue('92');
    expect(hueSlider()).toHaveValue('208');
  });

  it('keeps the area, the hue slider and the hex field at the value of a parent that ignores onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPicker aria-label="Accent" value="#0f6cbd" onValueChange={onValueChange} />);
    act(() => saturationInput().focus());
    await user.keyboard('{Home}');
    expect(onValueChange.mock.calls).toEqual([['#bdbdbd']]);
    expect(saturationInput()).toHaveValue('92');
    expect(hueSlider()).toHaveValue('208');
    expect(hexInput()).toHaveValue('#0f6cbd');
    await user.keyboard('{Home}');
    expect(onValueChange.mock.calls).toEqual([['#bdbdbd'], ['#bdbdbd']]);
  });

  it('disables the bound parts while the value is not a hex color', () => {
    const warn = spyWarn();
    try {
      render(<ColorPicker aria-label="Accent" value="red" showOpacity />);
      expect(saturationInput()).toBeDisabled();
      expect(hueSlider()).toBeDisabled();
      expect(opacitySlider()).toBeDisabled();
      expect(areaGroup()).toHaveAttribute('data-disabled', '');
      expect(warn.mock.calls).toEqual([[invalidValueWarning('red')]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('never gives the Field to the area or the hue slider: the Field labels only the group', () => {
    renderWithFieldContext(<ColorPicker />, { required: true });
    expect(screen.getByRole('group', { name: FIELD_TEST_TEXT.label })).toBeInTheDocument();
    expect(areaGroup()).toBeInTheDocument();
    expect(hueSlider()).not.toHaveAttribute('id', FIELD_TEST_IDS.controlId);
  });

  it('reports each change of a bound part once in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <ColorPicker aria-label="Accent" defaultValue="#cc0000" onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    act(() => hueSlider().focus());
    await user.keyboard('{End}');
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.change(hueSlider(), { target: { value: '120' } });
    expect(onValueChange.mock.calls).toEqual([['#00cc00']]);
  });
});

describe('ColorPicker — the color parts bind to it (D21)', () => {
  it("edits the picker's value through Fluent's composition", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPicker aria-label="Accent" defaultValue="#ff0000" onValueChange={onValueChange}>
        <ColorArea />
        <ColorSlider />
        <AlphaSlider />
      </ColorPicker>,
    );
    act(() => saturationInput().focus());
    await user.keyboard('{PageDown}{PageDown}');
    expect(onValueChange).toHaveBeenLastCalledWith('#cc0000');
    fireEvent.change(hueSlider(), { target: { value: '120' } });
    expect(onValueChange).toHaveBeenLastCalledWith('#00cc00');
    act(() => opacitySlider().focus());
    await user.keyboard('{Home}');
    expect(onValueChange).toHaveBeenLastCalledWith('#00cc0000');
  });

  it("bound parts take the picker's shape and labels, render no hidden input and ignore name", () => {
    render(
      <form aria-label="Form">
        <ColorPicker aria-label="Accent" name="accent" shape="square" labels={{ hue: 'Farbton', area: 'Fläche' }}>
          <ColorArea name="area" />
          <ColorSlider name="hue" />
        </ColorPicker>
      </form>,
    );
    expect(screen.getByRole('group', { name: 'Fläche' })).toHaveClass('rounded-none');
    expect(screen.getByRole('slider', { name: 'Farbton' })).toBeInTheDocument();
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(Array.from(new FormData(form).keys())).toEqual(['accent']);
  });

  it('a part with its own value stays independent inside the picker', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const own = vi.fn();
    render(
      <ColorPicker aria-label="Accent" onValueChange={onValueChange}>
        <ColorSlider aria-label="Own hue" defaultValue={{ h: 30, s: 1, v: 1 }} onValueChange={own} />
      </ColorPicker>,
    );
    act(() => screen.getByRole('slider', { name: 'Own hue' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(own.mock.calls).toEqual([[{ h: 31, s: 1, v: 1 }]]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('a bound part given only onValueChange hears its own changes (C-NAMING)', async () => {
    const user = userEvent.setup();
    const onHue = vi.fn();
    render(
      <ColorPicker aria-label="Accent" defaultValue="#ff0000">
        <ColorSlider onValueChange={onHue} />
      </ColorPicker>,
    );
    act(() => hueSlider().focus());
    await user.keyboard('{ArrowRight}');
    expect(onHue.mock.calls).toEqual([[{ h: 1, s: 1, v: 1 }]]);
  });
});
```

(`#cc0000` is `{ h: 0, s: 1, v: 0.8 }`; End on its hue slider moves the hue to 360, the same red, so nothing is reported; 120 makes `#00cc00`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/input/__tests__/ColorPicker.test.tsx`
Expected: FAIL — no group "Saturation and brightness" and no slider "Hue" in the default layout; the focus-indicator test finds no AlphaSlider; the warning text differs.

- [ ] **Step 3: Implement the working color and the layout**

In `src/components/input/ColorPicker.tsx`:

1. Imports: remove `import { focusRing } from '../../lib/styles';`, remove `opacityToAlpha` from the `./colorUtils` import, and add:

```tsx
import { AlphaSlider } from './AlphaSlider';
import { ColorArea } from './ColorArea';
import { ColorSlider } from './ColorSlider';
```

2. After `resolvePresets`, add:

```tsx
/**
 * The working color for a hex value that differs from it: the value's HSV, keeping the previous
 * hue when the new color has no hue of its own (a gray, white or black) and the previous
 * saturation too at zero brightness, so a hue slider does not jump to red when the color reaches
 * gray. `hsvToHex` of the result is `hex` again.
 */
function deriveWorkingColor(hex: string, previous: HsvColor): HsvColor {
  const next = hexToHsv(hex);
  if (!next) return previous;
  if (next.v === 0) return { ...next, h: previous.h, s: previous.s };
  if (next.s === 0) return { ...next, h: previous.h };
  return next;
}
```

3. Replace:

```tsx
  // Replaced by the working color in the next task: here the bound parts read the value's HSV.
  const hsv = React.useMemo(() => hexToHsv(color) ?? DEFAULT_PART_COLOR, [color]);
  const setHsv = useEventCallback((next: HsvColor) => {
    if (parsed) setColor(hsvToHex(next));
  });
```

with:

```tsx
  // The working color: HSV, so hue and saturation survive gray, white and black (hex keeps
  // neither). The value stays the source of truth: whenever it differs from the working color (a
  // change from outside, a form reset, or a controlled parent that ignored onValueChange), the
  // working color follows it. A parent that accepts a change sets exactly `hsvToHex(hsv)`, so the
  // working color is kept.
  const [hsv, setHsvState] = React.useState<HsvColor>(() =>
    deriveWorkingColor(color, DEFAULT_PART_COLOR),
  );
  const normalized = parsed ? formatHexColor(parsed.rgb, parsed.alpha) : null;
  if (normalized !== null && hsvToHex(hsv) !== normalized) {
    setHsvState(deriveWorkingColor(normalized, hsv));
  }
  const setHsv = useEventCallback((next: HsvColor) => {
    if (!parsed) return;
    setHsvState(next);
    setColor(hsvToHex(next));
  });
```

4. Delete `handleOpacityChange`.

5. In the invalid-value warning, replace `the opacity slider is disabled until then.` with `the color area and sliders are disabled until then.`

6. Replace the default layout (the fragment in the `slotRendersContent(children) ? children : (…)` branch) with:

```tsx
            <>
              <ColorArea />
              <ColorSlider />
              <div className="flex items-start gap-2">
                <ColorPickerPreview />
                <ColorPickerHexField />
              </div>
              <ColorPickerSwatches />
              {showOpacity && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      colorPickerClassNames.opacityLabel,
                      'w-14 text-caption-1 text-muted-foreground',
                    )}
                  >
                    {strings.opacity}
                  </span>
                  <AlphaSlider className="min-w-0 flex-1" />
                  <span
                    className={cn(
                      colorPickerClassNames.opacityValue,
                      'w-10 text-end text-caption-1 text-muted-foreground',
                    )}
                  >
                    {opacity}%
                  </span>
                </div>
              )}
            </>
```

7. In the compound's docblock, replace the first bullet with:

```text
 * - **Default layout** (no children): a color area (saturation and brightness) and a hue slider,
 *   then a preview and the hex field, preset swatches and, with `showOpacity`, an opacity row
 *   whose slider is an `AlphaSlider` (0–100 %). Dragging to gray, white or black keeps the hue.
```

and the `showOpacity` prop JSDoc with: "Whether the default layout shows the opacity row: the caption, an alpha slider (0–100 %, named by `labels.opacity`) and the percentage. The opacity is the alpha byte of `value`. Does nothing with `children`. @default false". In the `shape` prop JSDoc replace "the color parts bound to the picker (the area and the rails)" with "the area and the rails of the color parts bound to it, including those of the default layout".

- [ ] **Step 4: Run the picker tests**

Run: `npx vitest run src/components/input/__tests__/ColorPicker.test.tsx src/components/input/__tests__/ColorPicker.parts.test.tsx --reporter=default`
Expected: PASS. The 0.7 opacity tests pass unchanged against the AlphaSlider: its input is named "Opacity" (or "Deckkraft" with `labels`), runs 0–100, handles `fireEvent.change`, is disabled for `"red"`, and the "50%" readout stays; the Field-isolation counts hold (the bound parts render no hidden input and no Field id).

- [ ] **Step 5: Run the other suites that render a ColorPicker**

Run: `npx vitest run src/__tests__/integration.test.tsx src/__tests__/stories.a11y.test.tsx -t "ColorPicker" && npx vitest run src/components/input/__tests__/stableClassNames.test.tsx`
Expected: PASS (spec §6.4: the real-Field cases query `getByRole('group', { name: 'Preference' })`, which the area's group, named "Saturation and brightness", does not match; the wave-A class test still finds `colorPickerClassNames.opacityLabel` and `.opacityValue` on the caption and readout).

- [ ] **Step 6: Quick checks**

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/input/ColorPicker.tsx src/components/input/__tests__/ColorPicker.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/ColorPicker.tsx"`
Expected: PASS (`react-hooks` accepts the guarded state adjustment during render, the pattern of the 0.7 `syncedColor`).

- [ ] **Step 7: Commit**

```bash
git add src/components/input/ColorPicker.tsx src/components/input/__tests__/ColorPicker.test.tsx
git commit -m "feat(input): ColorPicker keeps an HSV working color; the default layout gains the area and a hue slider"
```

---

### Task C11: Stories

**Files:**
- Create: `stories/ColorArea.stories.tsx`
- Create: `stories/ColorSlider.stories.tsx`
- Create: `stories/AlphaSlider.stories.tsx`
- Modify: `stories/ColorPicker.stories.tsx`

**Interfaces:**
- Consumes: the three parts and the compound (C5–C10); `hexToHsv`, `hsvToHex` (C1); `orientationArgType` from `stories/_helpers.ts` (read only).
- Produces: stories `Components/Input/ColorArea` (Default, Controlled, Square, Disabled), `Components/Input/ColorSlider` (Default, Saturation, Brightness, Vertical, RightToLeft), `Components/Input/AlphaSlider` (Default, Transparency, Vertical), and the ColorPicker stories `Composed`, `CustomLayout`, `RgbAndHslFields` (the `colorpicker-2` recipe), `InPopover`, `Square`. The new modules are imported by module path until INTEGRATION's Task I1 switches them to `'../src'` (spec §0.2 rule 25).

- [ ] **Step 1: Run the stories gate to record the baseline**

Run: `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/ColorPicker"`
Expected: PASS for the four existing ColorPicker stories (the gate renders every story of every story file).

- [ ] **Step 2: Create `stories/ColorArea.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import type { HsvColor } from '../src';
// Module paths until the color parts join the barrels (INTEGRATION, spec §0.2 rule 25).
import { ColorArea } from '../src/components/input/ColorArea';
import { ColorSlider } from '../src/components/input/ColorSlider';
import { hsvToHex } from '../src/lib/color';

const meta = {
  title: 'Components/Input/ColorArea',
  component: ColorArea,
  args: {
    'aria-label': 'Accent color',
    onValueChange: fn(),
  },
} satisfies Meta<typeof ColorArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The parent owns an `HsvColor`; a hue slider and the area edit the same value. */
export const Controlled: Story = {
  render: function ControlledStory(args) {
    const [color, setColor] = useState<HsvColor>({ h: 208, s: 0.92, v: 0.74 });
    return (
      <div className="flex w-64 flex-col gap-3">
        <ColorArea
          {...args}
          value={color}
          onValueChange={(next) => {
            setColor(next);
            args.onValueChange?.(next);
          }}
        />
        <ColorSlider value={color} onValueChange={setColor} />
        <p className="text-body-1 text-foreground">{hsvToHex(color)}</p>
      </div>
    );
  },
};

export const Square: Story = {
  args: { shape: 'square' },
};

export const Disabled: Story = {
  args: { disabled: true },
};
```

- [ ] **Step 3: Create `stories/ColorSlider.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
// Module path until the color parts join the barrels (INTEGRATION, spec §0.2 rule 25).
import { ColorSlider } from '../src/components/input/ColorSlider';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Input/ColorSlider',
  component: ColorSlider,
  argTypes: {
    ...orientationArgType,
    channel: { control: 'inline-radio', options: ['hue', 'saturation', 'value'] },
  },
  args: {
    onValueChange: fn(),
  },
} satisfies Meta<typeof ColorSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** From gray to the full color, at the color's brightness. */
export const Saturation: Story = {
  args: { channel: 'saturation', defaultValue: { h: 208, s: 0.6, v: 0.8 } },
};

/** From black to the color at full brightness (`channel="value"`, named "Brightness"). */
export const Brightness: Story = {
  args: { channel: 'value' },
};

/** Bottom to top; the arrow keys keep their direction in right-to-left layouts too. */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
};

/** Under `dir="rtl"` a horizontal rail runs from the right, and ArrowLeft increases. */
export const RightToLeft: Story = {
  render: (args) => (
    <div dir="rtl" className="w-64">
      <ColorSlider {...args} />
    </div>
  ),
};
```

- [ ] **Step 4: Create `stories/AlphaSlider.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
// Module path until the color parts join the barrels (INTEGRATION, spec §0.2 rule 25).
import { AlphaSlider } from '../src/components/input/AlphaSlider';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Input/AlphaSlider',
  component: AlphaSlider,
  argTypes: {
    ...orientationArgType,
    transparency: { control: 'boolean' },
  },
  args: {
    defaultValue: { h: 208, s: 0.92, v: 0.74, a: 0.6 },
    onValueChange: fn(),
  },
} satisfies Meta<typeof AlphaSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Shows transparency (100 % is fully transparent); `value.a` is still the opacity. */
export const Transparency: Story = {
  args: { transparency: true },
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
};
```

- [ ] **Step 5: Add the ColorPicker stories**

In `stories/ColorPicker.stories.tsx`, replace the imports with:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button, ColorPicker, Popover, SpinButton } from '../src';
import type { HsvColor } from '../src';
// Module paths until the color parts and helpers join the barrels (INTEGRATION, spec §0.2 rule 25).
import { AlphaSlider } from '../src/components/input/AlphaSlider';
import { ColorArea } from '../src/components/input/ColorArea';
import { ColorSlider } from '../src/components/input/ColorSlider';
import { hexToHsv, hsvToHex } from '../src/lib/color';
```

and append:

```tsx
/** Fluent's composition: the standalone parts bind to the picker when they have no value of their own. */
export const Composed: Story = {
  render: (args) => (
    <ColorPicker {...args}>
      <ColorArea />
      <ColorSlider />
      <AlphaSlider />
    </ColorPicker>
  ),
};

/** Your own layout: vertical rails beside the area, then the picker's preview, hex field and swatches. */
export const CustomLayout: Story = {
  render: (args) => (
    <ColorPicker {...args}>
      <div className="flex gap-3">
        <ColorArea className="h-48" />
        <ColorSlider orientation="vertical" className="h-48" />
        <AlphaSlider orientation="vertical" className="h-48" />
      </div>
      <div className="flex items-start gap-2">
        <ColorPicker.Preview />
        <ColorPicker.HexField />
      </div>
      <ColorPicker.Swatches />
    </ColorPicker>
  ),
};

/** HSV to HSL (story helper): lightness from brightness and saturation. */
function hsvToHsl({ h, s, v }: HsvColor): { h: number; s: number; l: number } {
  const l = v * (1 - s / 2);
  return { h, s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l };
}

/** HSL to HSV (story helper), the inverse of `hsvToHsl`. */
function hslToHsv({ h, s, l }: { h: number; s: number; l: number }): HsvColor {
  const v = l + s * Math.min(l, 1 - l);
  return { h, s: v === 0 ? 0 : 2 * (1 - l / v), v };
}

/**
 * RGB and HSL fields (a recipe, not components): SpinButtons around a controlled hex value,
 * converted with `hexToHsv` and `hsvToHex`. The fields edit the opaque color.
 */
export const RgbAndHslFields: Story = {
  render: function RgbAndHslStory(args) {
    const [color, setColor] = useState('#0f6cbd'); // wave-allow-color: fixture
    const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    const hsl = hsvToHsl(hexToHsv(color) ?? { h: 0, s: 0, v: 0 });
    const setRgb = (channel: number, next: number) => {
      const bytes = rgb.map((value, index) => (index === channel ? next : value));
      setColor(`#${bytes.map((value) => value.toString(16).padStart(2, '0')).join('')}`);
    };
    const setHsl = (key: 'h' | 's' | 'l', next: number) =>
      setColor(hsvToHex(hslToHsv({ ...hsl, [key]: key === 'h' ? next : next / 100 })));
    return (
      <div className="flex flex-col gap-3">
        <ColorPicker
          {...args}
          value={color}
          onValueChange={(next) => {
            setColor(next);
            args.onValueChange?.(next);
          }}
        />
        <fieldset className="flex gap-2">
          <legend className="text-caption-1 text-muted-foreground">RGB</legend>
          {['Red', 'Green', 'Blue'].map((label, index) => (
            <SpinButton
              key={label}
              aria-label={label}
              min={0}
              max={255}
              value={rgb[index]}
              onValueChange={(next) => setRgb(index, next)}
            />
          ))}
        </fieldset>
        <fieldset className="flex gap-2">
          <legend className="text-caption-1 text-muted-foreground">HSL</legend>
          <SpinButton
            aria-label="Hue"
            min={0}
            max={360}
            value={Math.round(hsl.h)}
            onValueChange={(next) => setHsl('h', next)}
          />
          <SpinButton
            aria-label="Saturation"
            min={0}
            max={100}
            value={Math.round(hsl.s * 100)}
            onValueChange={(next) => setHsl('s', next)}
          />
          <SpinButton
            aria-label="Lightness"
            min={0}
            max={100}
            value={Math.round(hsl.l * 100)}
            onValueChange={(next) => setHsl('l', next)}
          />
        </fieldset>
      </div>
    );
  },
};

/** A picker in a Popover with Apply and Cancel: the draft color applies only on Apply. */
export const InPopover: Story = {
  render: function InPopoverStory(args) {
    const [color, setColor] = useState('#0f6cbd'); // wave-allow-color: fixture
    const [draft, setDraft] = useState(color);
    const [open, setOpen] = useState(false);
    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(color);
        }}
      >
        <Popover.Trigger>
          <Button
            icon={
              <span
                aria-hidden="true"
                className="inline-block size-4 rounded border border-border"
                style={{ backgroundColor: color }}
              />
            }
          >
            Accent color
          </Button>
        </Popover.Trigger>
        <Popover.Content title="Accent color">
          <div className="flex flex-col gap-3">
            <ColorPicker
              {...args}
              value={draft}
              onValueChange={(next) => {
                setDraft(next);
                args.onValueChange?.(next);
              }}
            />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={() => {
                  setColor(draft);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </Popover.Content>
      </Popover>
    );
  },
};

/** `shape="square"`: the preview, the area and the rails lose their corner radius. */
export const Square: Story = {
  args: { shape: 'square', showOpacity: true },
};
```

- [ ] **Step 6: Run the stories gate for the new and changed stories**

Run: `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/Color"` then `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/AlphaSlider"` and `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/ColorPicker"`.
Expected: PASS for every story (named sliders and groups; the Popover story renders closed; the `RgbAndHslFields` SpinButtons are named).

- [ ] **Step 7: Quick checks**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx eslint stories/ColorArea.stories.tsx stories/ColorSlider.stories.tsx stories/AlphaSlider.stories.tsx stories/ColorPicker.stories.tsx --max-warnings 0 && npx prettier --check stories/ColorArea.stories.tsx stories/ColorSlider.stories.tsx stories/AlphaSlider.stories.tsx stories/ColorPicker.stories.tsx && npx vitest run src/__tests__/conventions.test.ts -t "stories/Color" && npx vitest run src/__tests__/conventions.test.ts -t "stories/AlphaSlider"`
Expected: PASS (the two hex fixtures carry `wave-allow-color: fixture`; the template literal `#${…}` is no hex literal). The Claude hook formats story files after each edit; outside it, `npx prettier --write` on the four files before the check.

- [ ] **Step 8: Commit**

```bash
git add stories/ColorArea.stories.tsx stories/ColorSlider.stories.tsx stories/AlphaSlider.stories.tsx stories/ColorPicker.stories.tsx
git commit -m "docs(stories): ColorArea, ColorSlider, AlphaSlider and the composable ColorPicker"
```

---

### Task C12: Package exit — CSS check, full package gate and the report

**Files:** none changed unless a check below names a fix.

**Interfaces:**
- Consumes: every task above.
- Produces: the package report for the lead (spec §3 "Waves", item 2, and §6.1): the barrel requests, the 0.7 tests updated and why, the spec §10 notes, and the behaviours only asserted as attributes (§6.3 item 4).

- [ ] **Step 1: Check the generated CSS of the new classes**

Run: `node scripts/build-css.mjs` (it must pass its own assertions: no class that no library string uses — the comments of the new modules name no Tailwind utility as a bare word), then:

```bash
node -e "const css=require('node:fs').readFileSync('dist/styles.css','utf8');const checks={areaFocus:/color-area[^{}]*focus-visible/,sliderFocus:/color-slider[^{}]*focus-visible/,alphaFocus:/alpha-slider[^{}]*focus-visible/,checkerSize:/background-size:\s*8px\s+8px/,containerSize:/container-type:\s*size/,containerHeight:/100cqh/,railGradient:/var\(--wave-color-slider-gradient\)/,areaGradient:/var\(--wave-color-area-gradient\)/,thumbFill:/var\(--wave-color-thumb\)/};const missing=Object.entries(checks).filter(([,re])=>!re.test(css)).map(([k])=>k);if(missing.length){console.error('missing: '+missing.join(', '));process.exit(1)}console.log('color part CSS ok')"
```

Expected: `color part CSS ok`. If `checkerSize` is missing, the installed Tailwind does not know `bg-size-[…]`: replace `bg-size-[8px_8px]` with `bg-[length:8px_8px]` in `AlphaSlider.tsx`, rebuild and re-run. If one of the `…Focus` checks is missing, Tailwind did not compile the named `group-has-[:focus-visible]/…` form: replace it in the three modules and their tests with the compound form `group-has-focus-visible/<name>:` (for example `group-has-focus-visible/color-area:outline-ring`), rebuild and re-run. Commit such a fix as `fix(input): …` with the changed files.

- [ ] **Step 2: Run the package's tests with clean output**

Run: `npx vitest run src/lib/__tests__/color.test.ts src/lib/__tests__/types.test.ts src/styles/__tests__/tokens.test.ts src/components/input src/__tests__/conventions.test.ts src/__tests__/stories.a11y.test.tsx src/__tests__/classNames.test.ts src/__tests__/public-types.test.ts src/__tests__/integration.test.tsx --reporter=default`
Expected: PASS, with no act() warning and no unasserted `[WaveUI]` output.

- [ ] **Step 3: Run the repository checks the package touches**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run build`
Expected: PASS. `node scripts/verify-dist.mjs` (run by `npm run build`) reports `ColorPicker` as a planned or pending flat-name bridge entry (it is a compound now; INTEGRATION exports its flat names), never as an error.

- [ ] **Step 4: Write the package report**

Report to the lead, in this order:

1. **Barrel and entry requests** (spec §4.3, INTEGRATION applies them): `src/components/input/index.ts` exports `ColorArea`, `ColorSlider`, `AlphaSlider`, `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview` and the types `ColorAreaProps`, `ColorAreaLabels`, `ColorSliderProps`, `ColorSliderLabels`, `AlphaSliderProps`, `AlphaSliderLabels`, `ColorPickerHexFieldProps`, `ColorPickerSwatchesProps`, `ColorPickerPreviewProps` (the last three from `./ColorPicker`, the others from their modules); `src/index.ts` exports `hsvToHex` and `hexToHsv` from `./lib/color` (not the internal helpers of that module). `HsvColor` and `ColorPickerShape` are already public through `export type * from './lib/types'`. After the barrels, INTEGRATION switches the four color stories' module-path imports to `'../src'` and adds `components/input/ColorArea`, `ColorSlider`, `AlphaSlider` and `lib/color` to the Button-only `dropModules` probe (spec §6.2).
2. **0.7 tests updated** (spec §6.4): `ColorPicker.test.tsx` — the focus-ring test of the opacity input now asserts the AlphaSlider thumb's two-tone indicator (the input is transparent); the `invalidValueWarning` helper follows the new text ("the color area and sliders are disabled until then"), because the whole set of bound parts is disabled, not only the opacity slider. No other 0.7 assertion changed; the opacity values, the "50%" readout, the Field-isolation counts and the real-Field integration cases pass unchanged. `colorUtils.ts` parses hex through `parseHexBytes` with its tests unchanged.
3. **Spec §10 notes:** (a) the working color re-derives whenever the value differs from `hsvToHex(hsv)` (the lead's refinement of D21; Task C10); (b) the exposure model reads `(pointer: coarse)` instead of `(pointer: fine)` (Task C8); (c) the checkerboard uses `stroke` on `background` because `muted` on `background` fails 1.5:1 in all three themes (Task C3); (d) `aria-required` is never set on a slider input (ARIA gives `slider` no `aria-required`): `ColorSlider` and `AlphaSlider` route `required`/`aria-required` to the hidden input as `ColorArea` does, where D20's routing list names the input; (e) `ColorArea`'s consumer `tabIndex` applies to whichever input holds the Tab stop, not only the saturation input; (f) the hex error of `ColorPicker.HexField` renders inside the field's label (under the input), since it is the field's part; the default layout aligns the preview to the top of the hex field (`items-start`) so the row does not shift when the error appears; (g) the picker-only parts were extracted (C9) before the working color and the new default layout (C10), the reverse of the order the lead suggested, so the parts could be tested in children first; (h) `ColorPicker.Swatches` keeps 0.7's small, rounded swatches unless `size`/`shape` are passed, and ignores the picker's `shape` (D21 names only the area, the rails and the preview).
4. **Change requests:** none (every element the design produces has its Appendix A class).
5. **Behaviours only asserted as attributes** — for the lead's real-browser and screen-reader checklist (spec §6.3 item 4): dragging the area and the sliders with a mouse, with touch (Android Chrome, iOS Safari) and with a pen, including the thumb staying under the pointer (the native thumb width matches the drawn one); desktop screen readers listing one 2-D slider and Tab stopping on the area once; VoiceOver iOS and TalkBack adjusting saturation and brightness with swipes and reaching both 1 px inputs (if VoiceOver iOS cannot, the lead decides on laying the inputs over the field with `opacity: 0` and `pointer-events: none`, spec §9 point 11); NVDA reading "Saturation 72%, Brightness 74%, dark blue, 2D slider"; RTL mirroring of the area and the horizontal rails; the rotated vertical sliders in Chrome, Edge, Firefox and Safari (bottom = minimum); the thumbs' two-tone focus indicator on the default brand blue in all three themes; Windows High Contrast drawing the thumb edges and focus indicator in system colors and keeping the field, rails and preview colors; the checkerboard visible in all three themes.
