# WaveUI 0.9.0 (Fluent Parity Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship roadmap Phase 4 (P4-01 … P4-04): sizes and appearances for every text control and picker through one recipe (with Field `size` and `WaveProvider inputDefaults`), sizes for the choice controls, SpinButton's value features, Rating half stars, colors, icons and items, and InfoLabel, InfoButton and Label as real labels that Field can use.

**Architecture:** Wave A (`F4-foundation`) adds the shared types, the class recipe in `src/lib/styles.ts`, the filled-appearance tokens, `FieldContextValue.size`, `WaveProvider inputDefaults` and the internal resolver `useInputLook`. Wave B runs six component packages in parallel on disjoint files; wave C (INTEGRATION) adds barrels, cross-package tests and the bundle probe; wave D updates the docs; wave M merges the parallel Phase 3 branch once it is on `main`; wave E runs the final gate and the real-browser checklist.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4.3, tailwind-merge 3.7 (`cn`), Vitest + React Testing Library + jsdom + vitest-axe, Storybook.

**Spec:** [`docs/superpowers/specs/2026-09-26-fluent-parity-phase-4-design.md`](../specs/2026-09-26-fluent-parity-phase-4-design.md). It is the contract: every task names the rulings (D1–D32) and sections it implements, and an implementer reads them before starting. Where this plan and the spec disagree, the spec wins and the lead corrects the plan.

## Global Constraints

- Release 0.9.0; CHANGELOG section `## [0.9.0] - Unreleased`; `package.json` is not bumped in this phase.
- Work only in the worktree `C:\code\packages\wave-ui-react\.claude\worktrees\phase-4` (branch `feat/fluent-parity-phase-4`); never in the main checkout.
- Implementers never run git write commands. After a task's review passes, the lead commits it with a conventional-commit subject and no AI attribution trailer.
- Own files only (spec §3.1). The barrels (`src/index.ts`, `src/components/*/index.ts`) are INTEGRATION's, except F4's `InputDefaults` export (spec §0.2 rule 11). Wave-B tests and stories import new symbols from their module path.
- TDD: every behaviour starts with a failing test. 0.7 tests that encode old behaviour are updated, never deleted (spec §6.4).
- Backward compatible: nothing public is removed; no type narrows except Rating's and RatingDisplay's inherited `color` (D24).
- Medium outline is 0.7: a control without `size` and `appearance` (and outside a sized Field or a provider with `inputDefaults`) renders exactly the 0.7 classes plus the data attributes; the only exceptions are D4 (the focused invalid border), D13 and D20 (SpinButton) (spec §0.2 rule 14).
- CLAUDE.md conventions (C-REF … C-STORIES) apply to every file. Data attributes go before `{...rest}`, and enumerated ones are always rendered. Warnings go through `src/lib/dev.ts`: component diagnostics come from effects with `warnOnce`, and `resolveDeprecatedProp`/`warnDeprecated` may warn during render. Colors are tokens only. Utilities are logical, with `wave-rtl:` mirroring. Every `transition*`/`animate-*` class has a `motion-reduce:` pair.
- Never write a Tailwind utility name as a bare word in a comment or string under `src/components` or `src/lib` (the CSS build fails on it).
- Phase 3 runs in parallel: no merge, rebase or cherry-pick from `main` or the Phase 3 branch before wave M (spec §0.2 rule 13).
- No new runtime dependency.
- Verification before a task is reported done, for the task's files: `npx vitest run <test files> --reporter=default` (clean output: no act() warnings, every `[WaveUI]` warning asserted), `npx vitest run src/__tests__/conventions.test.ts -t "<source file path>"`, `npx vitest run src/__tests__/stories.a11y.test.tsx -t "<story title>"` for its stories, `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint <files>`, `npx prettier --check <files>`.

## Review Focus

Inputs and conditions the spec implies but no ruling spells out, most likely to bite a user first. Each has a test in its owning task.

1. **An explicit `size={undefined}` or `appearance={undefined}`** (a wrapper that forwards optional props) falls through the resolution chain exactly like an absent prop. Test: Task A6.
2. **Changing `size` or `appearance` after mount** updates the classes and the `data-*` attributes on the next render, with no stale look. Test: Task B1.
3. **Nested providers** with `inputDefaults={{}}` or `{ size: undefined }` keep the enclosing provider's keys; only defined keys override. Test: Task A5.
4. **A controlled `allowEmpty` SpinButton set to `null` from outside while the user has a typed draft** replaces the draft with `''` (0.7's draft rule). Test: Task B6.
5. **InfoButton's `info` changing while the note is open** updates the note, and no hidden copy appears (one copy, D30). Test: Task B25.

---

## Wave A — `F4-foundation` (exclusive; spec §1)

The lead commits after each task; wave B starts only after Task A7's exit check is committed.

### Task A1: Shared types `CoreSize` and `InputAppearance`

Implements spec §1.1 (D3, D4).

**Files:**
- Modify: `src/lib/types.ts` (after `TextWeight`)
- Test: `src/lib/__tests__/types.test.ts`

**Interfaces:**
- Produces: `export type CoreSize = Extract<Size, 'small' | 'medium' | 'large'>`; `export type InputAppearance = 'outline' | 'underline' | 'filled-darker' | 'filled-lighter'` (both public through `export type * from './lib/types'` in `src/index.ts`).

- [ ] **Step 1: Write the failing type tests**

Append to `src/lib/__tests__/types.test.ts`:

```ts
import type { CoreSize, InputAppearance, Size } from '../types';

describe('CoreSize and InputAppearance (Phase 4 D3, D4)', () => {
  it('CoreSize is the three field sizes, a subset of Size', () => {
    expectTypeOf<CoreSize>().toEqualTypeOf<'small' | 'medium' | 'large'>();
    expectTypeOf<CoreSize>().toExtend<Size>();
  });

  it('InputAppearance has the four appearances', () => {
    expectTypeOf<InputAppearance>().toEqualTypeOf<
      'outline' | 'underline' | 'filled-darker' | 'filled-lighter'
    >();
  });
});
```

(Merge the `import type` into the file's existing type import if there is one; `expectTypeOf` and `describe`/`it` come from `vitest`, as in the rest of the file. If the installed Vitest lacks `toExtend`, use `toMatchTypeOf`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsc -p tsconfig.dev.json --noEmit`
Expected: FAIL: `Module '"../types"' has no exported member 'CoreSize'` (and `InputAppearance`).

- [ ] **Step 3: Add the types**

In `src/lib/types.ts`, after the `TextWeight` type:

```ts
/**
 * The three-step size of text inputs, pickers, Field and Label (Fluent's field sizes): `small`
 * (24px tall), `medium` (32px) and `large` (40px).
 */
export type CoreSize = Extract<Size, 'small' | 'medium' | 'large'>;

/**
 * Look of a text input or picker: `outline` (a full border), `underline` (a bottom stroke only),
 * `filled-darker` or `filled-lighter` (a fill without a visible stroke).
 */
export type InputAppearance = 'outline' | 'underline' | 'filled-darker' | 'filled-lighter';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx vitest run src/lib/__tests__/types.test.ts --reporter=default`
Expected: no type errors; PASS.

- [ ] **Step 5: Lead commits**

```bash
git add src/lib/types.ts src/lib/__tests__/types.test.ts
git commit -m "feat(lib): CoreSize and InputAppearance types"
```

### Task A2: The input recipe and the invalid recipe change

Implements spec §1.2 (D2, D3, D4, D11's `hitAreaLayer`). Wave A is exclusive, so this task also updates the six 0.7 component tests that assert the old invalid recipe's literal `focus:border-b-destructive` classes, which keeps the suite green at the end of wave A. The spec's §6.4 gives each package its own tests; the lead records this wave-A update in spec §10.

**Files:**
- Modify: `src/lib/styles.ts`
- Test: `src/lib/__tests__/styles.test.ts`
- Modify (assertions only): `src/components/input/__tests__/Combobox.test.tsx` (~line 1826), `DatePicker.test.tsx` (~264), `Dropdown.test.tsx` (~1033), `SearchBox.test.tsx` (~1512), `TagPicker.test.tsx` (~1147), `TimePicker.test.tsx` (~207)

**Interfaces:**
- Consumes: `CoreSize`, `InputAppearance` (Task A1).
- Produces (all in `src/lib/styles.ts`): `inputHeightClasses: Readonly<Record<CoreSize, string>>`, `inputTextClasses`, `inputPaddingClasses`, `inputAppearanceClasses: Readonly<Record<InputAppearance, string>>`, `hitAreaLayer: string`; `inputInvalid === 'border-destructive'`; `inputInvalidWithin === 'border-destructive'`; `inputBase` unchanged but `@deprecated`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/styles.test.ts`, add `inputHeightClasses, inputTextClasses, inputPaddingClasses, inputAppearanceClasses, hitAreaLayer` to the import from `'../styles'`, replace the whole `describe('invalid recipes', …)` block with the one below, and append the maps block:

```ts
describe('invalid recipes (Phase 4 D4)', () => {
  it('inputInvalid is the destructive border on every border the appearance draws', () => {
    expect(tokens(inputInvalid)).toEqual(['border-destructive']);
  });

  it('inputInvalidWithin is the wrapper form', () => {
    expect(tokens(inputInvalidWithin)).toEqual(['border-destructive']);
  });

  it('after the base and focus recipes, it recolors the borders and leaves the focused bottom to the focus recipe', () => {
    const merged = tokens(cn(inputBase, 'border-b-stroke-accessible', inputFocus, inputInvalid));
    expect(merged).toContain('border-destructive');
    expect(merged).not.toContain('border-input');
    expect(merged).not.toContain('border-b-stroke-accessible');
    expect(merged).toEqual(
      expect.arrayContaining(['focus:outline-hidden', 'focus:border-b-2', 'focus:border-b-primary']),
    );

    const wrapper = tokens(cn('border border-input', inputFocusWithin, inputInvalidWithin));
    expect(wrapper).toEqual(
      expect.arrayContaining(['border-destructive', 'focus-within:border-b-primary']),
    );
    expect(wrapper).not.toContain('border-input');
  });
});

describe('input size and appearance maps (Phase 4 §1.2)', () => {
  it('has one entry per size and per appearance', () => {
    expect(Object.keys(inputHeightClasses)).toEqual(['small', 'medium', 'large']);
    expect(Object.keys(inputTextClasses)).toEqual(['small', 'medium', 'large']);
    expect(Object.keys(inputPaddingClasses)).toEqual(['small', 'medium', 'large']);
    expect(Object.keys(inputAppearanceClasses)).toEqual([
      'outline',
      'underline',
      'filled-darker',
      'filled-lighter',
    ]);
  });

  it('sizes are 24/32/40px tall, caption-1/body-1/body-2 and 8/12/16px padded', () => {
    expect(inputHeightClasses).toEqual({ small: 'h-6', medium: 'h-8', large: 'h-10' });
    expect(inputTextClasses).toEqual({
      small: 'text-caption-1',
      medium: 'text-body-1',
      large: 'text-body-2',
    });
    expect(inputPaddingClasses).toEqual({ small: 'px-2', medium: 'px-3', large: 'px-4' });
  });

  it('medium outline composes the 0.7 field classes', () => {
    const classes = tokens(
      cn(
        inputHeightClasses.medium,
        inputPaddingClasses.medium,
        inputTextClasses.medium,
        inputAppearanceClasses.outline,
      ),
    );
    expect(classes).toEqual(
      expect.arrayContaining([
        'h-8',
        'px-3',
        'text-body-1',
        'rounded',
        'border',
        'border-input',
        'border-b-stroke-accessible',
        'bg-background',
      ]),
    );
  });

  it('underline draws only the bottom stroke, square and unfilled, with a forced-colors boundary', () => {
    expect(tokens(inputAppearanceClasses.underline)).toEqual([
      'rounded-none',
      'border-0',
      'border-b',
      'border-b-stroke-accessible',
      'bg-transparent',
      'forced-colors:border-[ButtonText]',
    ]);
  });

  it.each(['filled-darker', 'filled-lighter'] as const)(
    '%s is a fill with the filled stroke token and a forced-colors boundary',
    (appearance) => {
      expect(tokens(inputAppearanceClasses[appearance])).toEqual([
        'rounded',
        'border',
        'border-input-filled-stroke',
        `bg-input-${appearance}`,
        'forced-colors:border-[ButtonText]',
      ]);
    },
  );

  it('the invalid look recolors the drawn borders of every appearance', () => {
    expect(tokens(cn(inputAppearanceClasses.underline, inputInvalid))).toEqual(
      expect.arrayContaining(['border-0', 'border-b', 'border-destructive']),
    );
    const filled = tokens(cn(inputAppearanceClasses['filled-darker'], inputInvalid));
    expect(filled).toContain('border-destructive');
    expect(filled).not.toContain('border-input-filled-stroke');
    const focused = tokens(cn(inputAppearanceClasses.outline, inputFocus, inputInvalid));
    expect(focused).toEqual(
      expect.arrayContaining(['border-destructive', 'focus:border-b-primary']),
    );
  });

  it('hitAreaLayer extends a 20px box by 2px on every side and does not position it', () => {
    expect(tokens(hitAreaLayer)).toEqual(['before:absolute', 'before:-inset-0.5']);
    expect(tokens(cn('absolute size-5', hitAreaLayer))).toContain('absolute');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/__tests__/styles.test.ts --reporter=default`
Expected: FAIL: the new maps are `undefined`, and `inputInvalid` still has `focus:border-b-destructive`.

- [ ] **Step 3: Implement the recipe**

In `src/lib/styles.ts`, add `import type { CoreSize, InputAppearance } from './types';` at the top, then:

```ts
/**
 * Base look of text-entry controls (Input, Textarea, Select, picker inputs).
 * @deprecated Compose inputHeightClasses, inputTextClasses, inputPaddingClasses and
 * inputAppearanceClasses.
 */
export const inputBase =
  'h-8 w-full rounded border border-input bg-background px-3 text-body-1 text-foreground placeholder:text-muted-foreground';

/** Height of a text control or picker per size: 24, 32 or 40px. */
export const inputHeightClasses: Readonly<Record<CoreSize, string>> = {
  small: 'h-6',
  medium: 'h-8',
  large: 'h-10',
};

/** Type ramp of a text control or picker per size. */
export const inputTextClasses: Readonly<Record<CoreSize, string>> = {
  small: 'text-caption-1',
  medium: 'text-body-1',
  large: 'text-body-2',
};

/** Horizontal padding of a text control drawn on its own element, per size: 8, 12 or 16px. */
export const inputPaddingClasses: Readonly<Record<CoreSize, string>> = {
  small: 'px-2',
  medium: 'px-3',
  large: 'px-4',
};

/**
 * Fill, strokes and corners of each appearance, for a field drawn on its own element or on a
 * wrapper. Compose the focus and invalid recipes after it: they recolor the borders the appearance
 * draws. The filled appearances have a transparent stroke (a visible one in the high-contrast
 * theme); `underline` and the filled appearances keep a boundary in forced colors.
 */
export const inputAppearanceClasses: Readonly<Record<InputAppearance, string>> = {
  outline: 'rounded border border-input border-b-stroke-accessible bg-background',
  underline:
    'rounded-none border-0 border-b border-b-stroke-accessible bg-transparent forced-colors:border-[ButtonText]',
  'filled-darker':
    'rounded border border-input-filled-stroke bg-input-filled-darker forced-colors:border-[ButtonText]',
  'filled-lighter':
    'rounded border border-input-filled-stroke bg-input-filled-lighter forced-colors:border-[ButtonText]',
};

/**
 * Extends a 20px control's pointer target to 24px (WCAG 2.5.8): a transparent layer 2px beyond
 * each edge. The element must be positioned: the picker buttons are absolute, and a static
 * element adds relative positioning itself (this recipe does not, because cn() would then replace
 * an absolute position).
 */
export const hitAreaLayer = 'before:absolute before:-inset-0.5';
```

Replace the invalid recipes (keep their JSDoc style):

```ts
/**
 * Invalid look of a text-entry control (Input, Select, Textarea, SearchBox, SpinButton, Combobox,
 * Dropdown, the picker inputs), for every appearance: the destructive color on every border the
 * appearance draws. Apply it when the control's resolved `aria-invalid` is `true`, after the
 * appearance and {@link inputFocus} in `cn()`: while the control is focused, the focus recipe
 * colors the 2px bottom border and the other borders stay destructive.
 */
export const inputInvalid = 'border-destructive';

/**
 * Wrapper form of {@link inputInvalid} for a control drawn by a styled wrapper around the
 * focusable input (Input with slots, SearchBox, SpinButton, TagPicker), placed after
 * {@link inputFocusWithin}.
 */
export const inputInvalidWithin = 'border-destructive';
```

- [ ] **Step 4: Update the six literal assertions**

In each file below, the assertion lists the old focused-invalid class. Replace `focus:border-b-destructive` with `focus:border-b-primary`, and `focus-within:border-b-destructive` with `focus-within:border-b-primary`. Where the test's name says the destructive stroke is kept while focused, rename it to state the new rule ("keeps the destructive border and shows the focus color on the focused bottom border (Phase 4 D4)").
- `src/components/input/__tests__/Combobox.test.tsx` (~1826)
- `src/components/input/__tests__/DatePicker.test.tsx` (~264)
- `src/components/input/__tests__/Dropdown.test.tsx` (~1033)
- `src/components/input/__tests__/SearchBox.test.tsx` (~1512)
- `src/components/input/__tests__/TagPicker.test.tsx` (~1147)
- `src/components/input/__tests__/TimePicker.test.tsx` (~207)

Check that nothing else asserts the old class: `grep -rn "border-b-destructive" src/`. The only hits allowed are comments that describe 0.7.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/__tests__/styles.test.ts src/components/input --reporter=default`
Expected: PASS, clean output.

- [ ] **Step 6: Lead commits**

```bash
git add src/lib/styles.ts src/lib/__tests__/styles.test.ts src/components/input/__tests__/{Combobox,DatePicker,Dropdown,SearchBox,TagPicker,TimePicker}.test.tsx
git commit -m "feat(lib): input size and appearance recipe; focused invalid fields show the focus color"
```

### Task A3: The filled-appearance tokens

Implements spec §1.3 (D5).

**Files:**
- Modify: `src/styles/tokens.css`
- Test: `src/styles/__tests__/tokens.test.ts`

**Interfaces:**
- Produces: CSS variables `--wave-input-filled-darker`, `--wave-input-filled-lighter`, `--wave-input-filled-stroke` in every theme group; Tailwind colors `input-filled-darker`, `input-filled-lighter`, `input-filled-stroke` (utilities `bg-input-filled-darker`, `bg-input-filled-lighter`, `border-input-filled-stroke`).

- [ ] **Step 1: Write the failing tests**

In `src/styles/__tests__/tokens.test.ts`:
- In `TOKENS` (the per-theme value table, next to `input`):

```ts
  'input-filled-darker': ['#f5f5f5', '#141414', '#000000'],
  'input-filled-lighter': ['#ffffff', '#292929', '#000000'],
  'input-filled-stroke': ['transparent', 'transparent', '#ffffff'],
```

- In `DERIVED`: `'input-filled-lighter': 'var(--wave-background)',`
- In `TEXT_SURFACES`: `'input-filled-darker',` and `'input-filled-lighter',`
- In `NOT_TEXT_TOKENS`: `'input-filled-stroke': 'filled input border (transparent except in high contrast)',`
- In `CONTRAST_PAIRS`, next to the other 3:1 non-text pairs:

```ts
  ['primary', 'input-filled-darker', 3],
  ['destructive', 'input-filled-darker', 3],
  ['ring', 'input-filled-darker', 3],
  ['primary', 'input-filled-lighter', 3],
  ['destructive', 'input-filled-lighter', 3],
  ['ring', 'input-filled-lighter', 3],
```

- In `TABLED_MINIMUMS`, append the high-contrast-only stroke pair. `CONTRAST_PAIRS` run in all three themes and cannot compare `transparent`:

```ts
const TABLED_MINIMUMS = [
  // … the existing presence pairs …
].concat([['high-contrast', 'input-filled-stroke', 'background', 3] satisfies MinimumPair]);
```

(Adapt the syntax to the existing declaration: add the pair to the array it builds.)
- In `TABLED_RATIOS`, add the six pairs above with the ratios the test prints (Step 4 fills in the numbers).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/styles/__tests__/tokens.test.ts --reporter=default`
Expected: FAIL: the three tokens are not declared in any theme group.

- [ ] **Step 3: Declare the tokens**

In `src/styles/tokens.css`:
- In `:root, .wave-light`, with the strokes: `--wave-input-filled-darker: #f5f5f5;` and `--wave-input-filled-stroke: transparent;`, plus `/* Filled inputs: Fluent's colorNeutralBackground3; the stroke shows only in high contrast. */`. In the derived block: `--wave-input-filled-lighter: var(--wave-background);` (Fluent's colorNeutralBackground1).
- In `.wave-dark, .dark`: `--wave-input-filled-darker: #141414;`, `--wave-input-filled-stroke: transparent;`, and the derived line.
- In `.wave-high-contrast, .high-contrast`: `--wave-input-filled-darker: #000000;`, `--wave-input-filled-stroke: #ffffff;`, and the derived line.
- In `@theme inline`, next to `--color-input`:

```css
  --color-input-filled-darker: var(--wave-input-filled-darker);
  --color-input-filled-lighter: var(--wave-input-filled-lighter);
  --color-input-filled-stroke: var(--wave-input-filled-stroke);
```

- [ ] **Step 4: Run, then record the ratios**

Run: `npx vitest run src/styles/__tests__/tokens.test.ts --reporter=default`
Expected: every pair passes its minimum. The `TABLED_RATIOS` entries fail until their numbers match: copy the computed ratios from the failure output into the table (two decimals, as the neighbouring rows) and run again. Expected: PASS. If a pair misses its minimum in a theme, stop and report to the lead (the token changes, not the pair).

- [ ] **Step 5: Lead commits**

```bash
git add src/styles/tokens.css src/styles/__tests__/tokens.test.ts
git commit -m "feat(tokens): filled input tokens"
```

### Task A4: `FieldContextValue.size` and the Field test harness

Implements spec §1.4 and §1.7 (the Field harness).

**Files:**
- Modify: `src/hooks/useFieldControl.ts`, `src/test-utils-field.tsx`
- Test: `src/hooks/__tests__/useFieldControl.test.tsx`, `src/__tests__/test-utils.test.tsx`

**Interfaces:**
- Produces: `FieldContextValue.size?: CoreSize`; `renderWithFieldContext(ui, { size })` passes it through.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/test-utils.test.tsx`, next to the other `resolveFieldTestContext` cases:

```ts
it('passes a Field size through (Phase 4)', () => {
  expect(resolveFieldTestContext({ size: 'small' }).size).toBe('small');
  expect('size' in resolveFieldTestContext({})).toBe(false);
});
```

In `src/hooks/__tests__/useFieldControl.test.tsx`:

```tsx
it('a Field size is no attribute: the props are unchanged by it (Phase 4)', () => {
  function Probe() {
    const props = useFieldControl({ 'aria-label': 'Name' });
    return <input {...props} />;
  }
  renderWithFieldContext(<Probe />, { size: 'large' });
  const input = screen.getByRole('textbox', { name: 'Name' });
  expect(input).not.toHaveAttribute('size');
  expect(input).not.toHaveAttribute('data-size');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsc -p tsconfig.dev.json --noEmit`
Expected: FAIL: `'size' does not exist in type 'Partial<FieldContextValue>'`.

- [ ] **Step 3: Implement**

In `src/hooks/useFieldControl.ts`, import `CoreSize` next to `ValidationState` and add to `FieldContextValue`:

```ts
  /**
   * The Field's own `size` prop, when set: the default size of the text inputs and pickers inside
   * it (their own `size` wins). Absent when the Field has no `size` (the controls then fall back to
   * `WaveProvider inputDefaults`) and in contexts built before 0.9.
   */
  size?: CoreSize;
```

In `src/test-utils-field.tsx`, in `resolveFieldTestContext`, after the `validationMessageId` line:

```ts
  if (value.size !== undefined) resolved.size = value.size;
```

Also add `{ size: 'small' }` to the JSDoc examples of `renderWithFieldContext` (one line: "`size` sets the Field's size (the default size of the text controls inside it)").

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx vitest run src/hooks/__tests__/useFieldControl.test.tsx src/__tests__/test-utils.test.tsx --reporter=default`
Expected: PASS.

- [ ] **Step 5: Lead commits**

```bash
git add src/hooks/useFieldControl.ts src/test-utils-field.tsx src/hooks/__tests__/useFieldControl.test.tsx src/__tests__/test-utils.test.tsx
git commit -m "feat(field): Field size in the Field context"
```

### Task A5: `WaveProvider inputDefaults`

Implements spec §1.5 and §1.7 (`renderWithProviders`), D7. Covers Review Focus 3.

**Files:**
- Modify: `src/components/provider/WaveProvider.tsx`, `src/index.ts` (the `InputDefaults` type only), `src/test-utils.ts`
- Test: `src/components/provider/__tests__/WaveProvider.test.tsx`, `src/__tests__/public-types.test.ts` (the `InputDefaults`, `CoreSize` and `InputAppearance` lines), `src/__tests__/test-utils.test.tsx`

**Interfaces:**
- Consumes: `CoreSize`, `InputAppearance` (A1).
- Produces: `export interface InputDefaults { size?: CoreSize; appearance?: InputAppearance }` (from `WaveProvider.tsx`, exported by `src/index.ts`); `WaveProviderProps.inputDefaults?: InputDefaults`; `WaveContextValue.inputDefaults: InputDefaults` (`{}` outside a provider); `RenderWithProvidersOptions.inputDefaults?: InputDefaults`.

- [ ] **Step 1: Write the failing tests**

In `WaveProvider.test.tsx`, first update the three exact-shape assertions (spec §6.4): the two runtime `toEqual`s of the context value (~lines 235 and 393) gain `inputDefaults: {}`, and the type-level `toEqualTypeOf<WaveContextValue>` (~430) gains `inputDefaults: InputDefaults`. Then add:

```tsx
describe('inputDefaults (Phase 4 D7)', () => {
  function Probe() {
    const { inputDefaults } = useWaveTheme();
    return <output data-testid="defaults">{JSON.stringify(inputDefaults)}</output>;
  }
  const read = () => JSON.parse(screen.getByTestId('defaults').textContent ?? '');

  it('is {} outside a provider and without the prop', () => {
    const { unmount } = render(<Probe />);
    expect(read()).toEqual({});
    unmount();
    render(
      <WaveProvider>
        <Probe />
      </WaveProvider>,
    );
    expect(read()).toEqual({});
  });

  it('a nested provider merges its defined keys over the enclosing ones (Review Focus 3)', () => {
    render(
      <WaveProvider inputDefaults={{ size: 'small', appearance: 'filled-darker' }}>
        <WaveProvider inputDefaults={{ appearance: 'underline', size: undefined }}>
          <Probe />
        </WaveProvider>
      </WaveProvider>,
    );
    expect(read()).toEqual({ size: 'small', appearance: 'underline' });
  });

  it('an empty object and an omitted prop inherit the enclosing defaults', () => {
    render(
      <WaveProvider inputDefaults={{ size: 'large' }}>
        <WaveProvider inputDefaults={{}}>
          <WaveProvider>
            <Probe />
          </WaveProvider>
        </WaveProvider>
      </WaveProvider>,
    );
    expect(read()).toEqual({ size: 'large' });
  });

  it('keeps the context identity across renders with an equal inline object', () => {
    const seen = new Set<unknown>();
    function Collect() {
      seen.add(useWaveTheme());
      return null;
    }
    const { rerender } = render(
      <WaveProvider inputDefaults={{ size: 'small' }}>
        <Collect />
      </WaveProvider>,
    );
    rerender(
      <WaveProvider inputDefaults={{ size: 'small' }}>
        <Collect />
      </WaveProvider>,
    );
    expect(seen.size).toBe(1);
  });
});
```

In `src/__tests__/test-utils.test.tsx`:

```tsx
it('renderWithProviders passes inputDefaults to the provider', () => {
  function Probe() {
    return <output>{useWaveTheme().inputDefaults.size}</output>;
  }
  renderWithProviders(<Probe />, { inputDefaults: { size: 'large' } });
  expect(screen.getByRole('status')).toHaveTextContent('large');
});
```

In `src/__tests__/public-types.test.ts`, following the file's existing pattern:

```ts
expectTypeOf<InputDefaults>().toEqualTypeOf<{ size?: CoreSize; appearance?: InputAppearance }>();
expectTypeOf<WaveProviderProps['inputDefaults']>().toEqualTypeOf<InputDefaults | undefined>();
expectTypeOf<WaveContextValue['inputDefaults']>().toEqualTypeOf<InputDefaults>();
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/provider/__tests__/WaveProvider.test.tsx --reporter=default`
Expected: FAIL: `inputDefaults` is `undefined`.

- [ ] **Step 3: Implement**

In `WaveProvider.tsx`:

```tsx
import type { CoreSize, InputAppearance } from '../../lib/types';

/** Default size and appearance of the text inputs and pickers in a subtree. */
export interface InputDefaults {
  /** Default `size` of Input, Textarea, Select, SearchBox, SpinButton and the pickers. */
  size?: CoreSize;
  /** Default `appearance` of the same controls. */
  appearance?: InputAppearance;
}
```

Add to `WaveProviderProps`:

```ts
  /**
   * Default `size` and `appearance` of the text inputs and pickers in the subtree (Input,
   * Textarea, Select, SearchBox, SpinButton, Combobox, Dropdown, DatePicker, TimePicker,
   * TagPicker). Their own props and a Field's `size` win. A nested provider merges its keys over
   * the enclosing provider's; an omitted key is inherited.
   * @default the enclosing WaveProvider's defaults, else none (`medium`, `outline`)
   */
  inputDefaults?: InputDefaults;
```

Add to `WaveContextValue`: `/** The merged input defaults of the providers above (`{}` outside a provider). */ inputDefaults: InputDefaults;`. Set `inputDefaults: {}` in `DEFAULT_CONTEXT` (a module constant, so its identity is stable).

In the component (destructure `inputDefaults: inputDefaultsProp`):

```tsx
  // Defined keys override the enclosing provider's; the merged object keeps its identity while the
  // two values are equal, so an inline `inputDefaults={{ … }}` does not re-render every input.
  const size = inputDefaultsProp?.size ?? parent.inputDefaults.size;
  const appearance = inputDefaultsProp?.appearance ?? parent.inputDefaults.appearance;
  const inputDefaults = React.useMemo<InputDefaults>(() => {
    const merged: InputDefaults = {};
    if (size !== undefined) merged.size = size;
    if (appearance !== undefined) merged.appearance = appearance;
    return merged;
  }, [size, appearance]);
```

Add `inputDefaults` to the context value's `useMemo` object and dependency list.

In `src/index.ts`, add `InputDefaults` to the type list exported from `'./components/provider/WaveProvider'`.

In `src/test-utils.ts`, add `/** \`WaveProvider\` input defaults. */ inputDefaults?: InputDefaults;` to `RenderWithProvidersOptions`, destructure it in `renderWithProviders`, and pass it: `React.createElement(WaveProvider, { theme, dir, inputDefaults, children: inner })`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx vitest run src/components/provider src/__tests__/test-utils.test.tsx src/__tests__/public-types.test.ts --reporter=default`
Expected: PASS.

- [ ] **Step 5: Lead commits**

```bash
git add src/components/provider/WaveProvider.tsx src/components/provider/__tests__/WaveProvider.test.tsx src/index.ts src/test-utils.ts src/__tests__/test-utils.test.tsx src/__tests__/public-types.test.ts
git commit -m "feat(provider): WaveProvider inputDefaults"
```

### Task A6: The resolver `useInputLook`

Implements spec §1.6 (D6). Covers Review Focus 1.

**Files:**
- Create: `src/components/input/inputLook.ts`
- Test: `src/components/input/__tests__/inputLook.test.tsx`

**Interfaces:**
- Consumes: `useFieldContext` (`src/hooks/useFieldControl.ts`), `useWaveTheme` (A5), `CoreSize`, `InputAppearance`, `Size`.
- Produces: `useInputLook<S extends Size = CoreSize>(size: S | undefined, appearance: InputAppearance | undefined, options?: { sizes?: readonly S[]; defaultSize?: S }): { size: S; appearance: InputAppearance }` (internal: never exported from a barrel).

- [ ] **Step 1: Write the failing tests**

```tsx
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useInputLook, type InputLookOptions } from '../inputLook';
import { WaveProvider } from '../../provider/WaveProvider';
import { renderWithFieldContext } from '../../../test-utils-field';
import type { InputAppearance, Size } from '../../../lib/types';

function Probe<S extends Size>(props: {
  size?: S;
  appearance?: InputAppearance;
  options?: InputLookOptions<S>;
}) {
  const look = useInputLook(props.size, props.appearance, props.options);
  return <output>{`${look.size} ${look.appearance}`}</output>;
}
const look = () => screen.getByRole('status').textContent;

describe('useInputLook (Phase 4 D6)', () => {
  it('defaults to medium outline', () => {
    render(<Probe />);
    expect(look()).toBe('medium outline');
  });

  it('own props win over the Field and the provider', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'small', appearance: 'underline' }}>
        <Probe size="large" appearance="filled-lighter" />
      </WaveProvider>,
      { size: 'small' },
    );
    expect(look()).toBe('large filled-lighter');
  });

  it('the Field size wins over the provider size; the provider appearance still applies', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'small', appearance: 'filled-darker' }}>
        <Probe />
      </WaveProvider>,
      { size: 'large' },
    );
    expect(look()).toBe('large filled-darker');
  });

  it('falls back to the provider without a Field size, also in a 0.6-shaped context', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'small' }}>
        <Probe />
      </WaveProvider>,
    );
    expect(look()).toBe('small outline');
  });

  it('explicit undefined props fall through like absent ones (Review Focus 1)', () => {
    renderWithFieldContext(<Probe size={undefined} appearance={undefined} />, { size: 'large' });
    expect(look()).toBe('large outline');
  });

  it('skips a Field or provider size outside the supported sizes', () => {
    const options = {
      sizes: ['medium', 'large', 'extra-large'] as const,
      defaultSize: 'medium' as const,
    };
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'large' }}>
        <Probe options={options} />
      </WaveProvider>,
      { size: 'small' },
    );
    expect(look()).toBe('large outline');
  });

  it('falls back to the default size when neither fits', () => {
    const options = { sizes: ['medium', 'large', 'extra-large'] as const };
    renderWithFieldContext(<Probe options={options} />, { size: 'small' });
    expect(look()).toBe('medium outline');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/inputLook.test.tsx --reporter=default`
Expected: FAIL: `Cannot find module '../inputLook'`.

- [ ] **Step 3: Implement**

`src/components/input/inputLook.ts`:

```ts
import type { CoreSize, InputAppearance, Size } from '../../lib/types';
import { useFieldContext } from '../../hooks/useFieldControl';
import { useWaveTheme } from '../provider/WaveProvider';

const CORE_SIZES: readonly CoreSize[] = ['small', 'medium', 'large'];

/** Options of {@link useInputLook}. */
export interface InputLookOptions<S extends Size> {
  /** The sizes the control supports; a Field or provider size outside them is skipped. */
  sizes?: readonly S[];
  /** The size when nothing else applies. @default 'medium' */
  defaultSize?: S;
}

/**
 * The size and appearance a text control or picker renders (Phase 4 D6): its own props, then the
 * surrounding Field's `size`, then `WaveProvider inputDefaults`, then the defaults (`medium`,
 * `outline`). `undefined` props fall through like absent ones.
 *
 * @internal Not exported from the package.
 */
export function useInputLook<S extends Size = CoreSize>(
  size: S | undefined,
  appearance: InputAppearance | undefined,
  options: InputLookOptions<S> = {},
): { size: S; appearance: InputAppearance } {
  const field = useFieldContext();
  const { inputDefaults } = useWaveTheme();
  const sizes = (options.sizes ?? CORE_SIZES) as readonly Size[];
  const fits = (candidate: Size | undefined): candidate is S =>
    candidate !== undefined && sizes.includes(candidate);
  const resolvedSize =
    size ??
    (fits(field?.size) ? field.size : undefined) ??
    (fits(inputDefaults.size) ? inputDefaults.size : undefined) ??
    options.defaultSize ??
    ('medium' as S);
  return { size: resolvedSize, appearance: appearance ?? inputDefaults.appearance ?? 'outline' };
}
```

(`field?.size` narrows through the `fits` guard; if TypeScript does not narrow a property access, read it into a local first: `const fieldSize = field?.size;`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/input/__tests__/inputLook.test.tsx --reporter=default && npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/inputLook.ts"`
Expected: PASS.

- [ ] **Step 5: Lead commits**

```bash
git add src/components/input/inputLook.ts src/components/input/__tests__/inputLook.test.tsx
git commit -m "feat(input): the size and appearance resolver"
```

### Task A7: Story argTypes, the size × appearance grid, and the wave-A exit

Implements spec §1.8 and §1.9.

**Files:**
- Modify: `stories/_helpers.ts`
- Create: `stories/_grids.tsx` (a story-only helper: not matched by the `*.stories.tsx` globs of Storybook and the stories gate)

**Interfaces:**
- Produces: `coreSizeArgType` and `inputAppearanceArgType` (Storybook `ArgTypes` entries named `size` and `appearance`); `SizeAppearanceGrid` (`stories/_grids.tsx`): `({ render }: { render: (size: CoreSize, appearance: InputAppearance) => React.ReactNode }) => React.ReactElement`, which every wave-B "Sizes and appearances" story uses.

- [ ] **Step 1: Add the argTypes**

In `stories/_helpers.ts`, next to `sizes`/`appearances`, following the existing entries' exact shape (control, options, `satisfies ArgTypes`):

```ts
const coreSizes = ['small', 'medium', 'large'] as const satisfies readonly CoreSize[];
const inputAppearances = [
  'outline',
  'underline',
  'filled-darker',
  'filled-lighter',
] as const satisfies readonly InputAppearance[];

/** `size` of the text controls and pickers (`CoreSize`). */
export const coreSizeArgType = {
  size: { control: 'inline-radio', options: coreSizes },
} satisfies ArgTypes;

/** `appearance` of the text controls and pickers (`InputAppearance`). */
export const inputAppearanceArgType = {
  appearance: { control: 'select', options: inputAppearances },
} satisfies ArgTypes;
```

Import `CoreSize` and `InputAppearance` from `'../src'` with the other types. If the existing entries also carry `description` or `table`, copy their pattern.

Create `stories/_grids.tsx`:

```tsx
import * as React from 'react';
import type { CoreSize, InputAppearance } from '../src';

const SIZES: readonly CoreSize[] = ['small', 'medium', 'large'];
const APPEARANCES: readonly InputAppearance[] = [
  'outline',
  'underline',
  'filled-darker',
  'filled-lighter',
];

/**
 * A size × appearance grid for the "Sizes and appearances" stories: one row per appearance, one
 * cell per size. The `filled-lighter` row sits on a surface other than the page background, as
 * the docs recommend.
 */
export function SizeAppearanceGrid({
  render,
}: {
  render: (size: CoreSize, appearance: InputAppearance) => React.ReactNode;
}) {
  return (
    <div className="grid gap-4">
      {APPEARANCES.map((appearance) => (
        <div
          key={appearance}
          className={
            appearance === 'filled-lighter'
              ? 'grid grid-cols-3 items-start gap-3 rounded bg-secondary p-3'
              : 'grid grid-cols-3 items-start gap-3 p-3'
          }
        >
          {SIZES.map((size) => (
            <React.Fragment key={size}>{render(size, appearance)}</React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run the wave-A exit checks**

Run: `npm run typecheck && npm run lint && npx vitest run --reporter=default`
Expected: all green (the full suite, including the stories axe gate and the conventions gate). Report any failure outside F4's files to the lead.

- [ ] **Step 3: Lead commits**

```bash
git add stories/_helpers.ts stories/_grids.tsx
git commit -m "chore(stories): size and appearance argTypes and grid for inputs"
```

---

## Wave B — six packages in parallel (spec §2, §3.1)

Each package runs its tasks in order. It reads its spec sections first and keeps the default-render test of spec §0.2 rule 14. Tests use only the foundation and the package's own files: another package's new API is an INTEGRATION case. Known failures between waves B and C are listed in spec §3.3 (public types, the InfoLabel cases of `integration.test.tsx`). Every package ends with its verification commands from the Global Constraints.

### P4-text — Input, Textarea, Select, SearchBox

#### Task B1: Input sizes, appearances and `htmlSize`

Implements spec §2.1 (Input), D6, D9, D10. Covers Review Focus 2.

**Files:**
- Modify: `src/components/input/Input.tsx`
- Test: `src/components/input/__tests__/Input.test.tsx`
- Story: `stories/Input.stories.tsx`

**Interfaces:**
- Consumes: `inputHeightClasses`, `inputTextClasses`, `inputPaddingClasses`, `inputAppearanceClasses`, `inputFocus`, `inputFocusWithin`, `inputInvalid`, `inputInvalidWithin` (A2); `useInputLook` (A6); `resolveDeprecatedProp` (`src/lib/dev.ts`); `CoreSize`, `InputAppearance` (A1).
- Produces: `InputProps.size?: CoreSize | number`, `InputProps.htmlSize?: number`, `InputProps.appearance?: InputAppearance`. `isInvalidLook` and `useControlErrorMessage` keep their signatures (imported by other packages).

- [ ] **Step 1: Write the failing tests**

Add to `Input.test.tsx` (merge the imports into the file's existing ones):

```tsx
import { renderWithProviders } from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_TEXT } from '../../../test-utils-field';

describe('sizes and appearances (Phase 4 P4-01)', () => {
  const field = (name = 'Name') => screen.getByRole('textbox', { name });

  it('renders the 0.7 classes and medium outline attributes by default', () => {
    render(<Input aria-label="Name" />);
    expect(field()).toHaveClass(
      'h-8',
      'w-full',
      'px-3',
      'text-body-1',
      'rounded',
      'border',
      'border-input',
      'border-b-stroke-accessible',
      'bg-background',
    );
    expect(field()).toHaveAttribute('data-size', 'medium');
    expect(field()).toHaveAttribute('data-appearance', 'outline');
  });

  it.each([
    ['small', ['h-6', 'px-2', 'text-caption-1']],
    ['large', ['h-10', 'px-4', 'text-body-2']],
  ] as const)('size="%s" renders its height, padding and type ramp', (size, classes) => {
    render(<Input aria-label="Name" size={size} />);
    expect(field()).toHaveClass(...classes);
    expect(field()).toHaveAttribute('data-size', size);
  });

  it.each([
    ['underline', ['rounded-none', 'border-0', 'border-b', 'bg-transparent']],
    ['filled-darker', ['border-input-filled-stroke', 'bg-input-filled-darker']],
    ['filled-lighter', ['border-input-filled-stroke', 'bg-input-filled-lighter']],
  ] as const)('appearance="%s" renders its classes', (appearance, classes) => {
    render(<Input aria-label="Name" appearance={appearance} />);
    expect(field()).toHaveClass(...classes);
    expect(field()).toHaveAttribute('data-appearance', appearance);
  });

  it('takes the Field size; its own size wins', () => {
    const { rerender } = renderWithFieldContext(<Input />, { size: 'large' });
    expect(field(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'large');
    rerender(<Input size="small" />);
    expect(field(FIELD_TEST_TEXT.label)).toHaveAttribute('data-size', 'small');
  });

  it('takes WaveProvider inputDefaults; its own props win', () => {
    const { rerender } = renderWithProviders(<Input aria-label="Name" />, {
      inputDefaults: { size: 'small', appearance: 'underline' },
    });
    expect(field()).toHaveAttribute('data-size', 'small');
    expect(field()).toHaveAttribute('data-appearance', 'underline');
    rerender(<Input aria-label="Name" size="large" appearance="outline" />);
    expect(field()).toHaveAttribute('data-size', 'large');
    expect(field()).toHaveAttribute('data-appearance', 'outline');
  });

  it('updates classes and attributes when size and appearance change (Review Focus 2)', () => {
    const { rerender } = render(<Input aria-label="Name" size="small" />);
    rerender(<Input aria-label="Name" size="large" appearance="filled-darker" />);
    expect(field()).toHaveClass('h-10', 'bg-input-filled-darker');
    expect(field()).not.toHaveClass('h-6', 'bg-background');
    expect(field()).toHaveAttribute('data-size', 'large');
    expect(field()).toHaveAttribute('data-appearance', 'filled-darker');
  });

  it.each(['underline', 'filled-darker'] as const)(
    'an invalid %s field keeps the destructive border and the focus color on its bottom',
    (appearance) => {
      render(<Input aria-label="Name" appearance={appearance} error />);
      expect(field()).toHaveClass('border-destructive', 'focus:border-b-primary');
    },
  );

  it('with slots, the wrapper carries the size, the appearance and their attributes', () => {
    render(
      <Input aria-label="Name" size="large" appearance="filled-lighter" contentBefore="@" />,
    );
    const wrapper = field().parentElement as HTMLElement;
    expect(wrapper).toHaveClass('h-10', 'text-body-2', 'bg-input-filled-lighter');
    expect(wrapper).toHaveAttribute('data-size', 'large');
    expect(wrapper).toHaveAttribute('data-appearance', 'filled-lighter');
    expect(field()).toHaveClass('px-3', 'text-body-2');
    expect(field()).not.toHaveAttribute('data-size');
  });
});

describe('htmlSize and the numeric size (Phase 4 D10)', () => {
  const field = () => screen.getByRole('textbox', { name: 'Name' });
  const NUMERIC_SIZE_WARNING =
    '[WaveUI] Input: `size={number}` is deprecated and will be removed in 1.0. Use `htmlSize` instead.';

  it('a numeric size renders the native attribute, keeps the medium design size and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<Input aria-label="Name" size={20} />);
    rerender(<Input aria-label="Name" size={20} />);
    expect(field()).toHaveAttribute('size', '20');
    expect(field()).toHaveAttribute('data-size', 'medium');
    expect(field()).toHaveClass('h-8');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(NUMERIC_SIZE_WARNING);
  });

  it('htmlSize alone renders the attribute without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Input aria-label="Name" htmlSize={12} size="small" />);
    expect(field()).toHaveAttribute('size', '12');
    expect(field()).toHaveAttribute('data-size', 'small');
    expect(warn).not.toHaveBeenCalled();
  });

  it('with both, htmlSize wins and the numeric form still warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Input aria-label="Name" htmlSize={12} size={20} />);
    expect(field()).toHaveAttribute('size', '12');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(NUMERIC_SIZE_WARNING);
  });

  it('types: CoreSize or a number', () => {
    expectTypeOf<InputProps['size']>().toEqualTypeOf<CoreSize | number | undefined>();
    // @ts-expect-error not a size
    render(<Input aria-label="Name" size="huge" />);
  });
});
```

(Add `expectTypeOf` to the `vitest` import and `type CoreSize` from `'../../../lib/types'`. Warnings reset after every test through `src/test-setup.ts`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/Input.test.tsx --reporter=default`
Expected: FAIL: no `data-size`, no size classes, and no warning for the numeric size.

- [ ] **Step 3: Implement**

In `Input.tsx`:
- `InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>` and add (JSDoc in full, per C-DOCS; no `@deprecated` tag on `size`, spec D10):

```ts
  /**
   * Size of the field: `small` (24px tall), `medium` (32px) or `large` (40px). Default: the
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`.
   *
   * A number is the native `size` attribute (the visible width in characters), as in 0.8: it
   * still renders, warns once in development and is removed in 1.0. Use `htmlSize` for it.
   */
  size?: CoreSize | number;
  /** The native `size` attribute: the visible width of the field in characters. */
  htmlSize?: number;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
```

- Destructure `size: sizeProp, htmlSize, appearance: appearanceProp` and resolve:

```ts
  const numericSize = typeof sizeProp === 'number' ? sizeProp : undefined;
  const nativeSize = resolveDeprecatedProp('Input', htmlSize, numericSize, 'size={number}', 'htmlSize');
  const { size, appearance } = useInputLook(
    typeof sizeProp === 'number' ? undefined : sizeProp,
    appearanceProp,
  );
```

- Wrapper form: add a module constant for the slot paddings:

```ts
/** Padding of the slot spans and the inner input of the slot wrapper, per size. */
const SLOT_PADDING: Readonly<Record<CoreSize, { before: string; after: string; input: string }>> = {
  small: { before: 'ps-1.5', after: 'pe-1.5', input: 'px-1.5' },
  medium: { before: 'ps-2', after: 'pe-2', input: 'px-2' },
  large: { before: 'ps-3', after: 'pe-3', input: 'px-3' },
};
```

The wrapper renders `data-size={size} data-appearance={appearance}` and `className={cn('inline-flex w-full items-center', inputHeightClasses[size], inputTextClasses[size], inputAppearanceClasses[appearance], 'text-foreground', inputFocusWithin, invalidLook && inputInvalidWithin, props.disabled && 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100', className)}`; the slots use `SLOT_PADDING[size].before`/`.after`; the inner input `cn('h-full w-full min-w-0 bg-transparent', SLOT_PADDING[size].input, inputTextClasses[size], 'text-foreground', 'placeholder:text-muted-foreground', 'focus:outline-hidden', 'disabled:cursor-not-allowed')` and gets `size={nativeSize}` after its spread.
- Element form: `<input ref={ref} data-size={size} data-appearance={appearance} className={cn(inputHeightClasses[size], 'w-full', inputPaddingClasses[size], inputTextClasses[size], inputAppearanceClasses[appearance], 'text-foreground placeholder:text-muted-foreground', inputFocus, 'disabled:cursor-not-allowed disabled:opacity-50', invalidLook && inputInvalid, className)} {...controlProps} size={nativeSize} />`.
- Update the component JSDoc: one sentence on `size`/`appearance`, the resolution order and the data attributes.

- [ ] **Step 4: Add the story**

In `stories/Input.stories.tsx`, spread `...coreSizeArgType, ...inputAppearanceArgType` into `argTypes` and add (with `import { SizeAppearanceGrid } from './_grids';`):

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Input
          {...args}
          size={size}
          appearance={appearance}
          aria-label={`${size} ${appearance}`}
          placeholder={`${size} ${appearance}`}
        />
      )}
    />
  ),
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/input/__tests__/Input.test.tsx --reporter=default && npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/Input"`, then the conventions gate, both typechecks, ESLint and Prettier for the three files.
Expected: PASS, clean output.

- [ ] **Step 6: Lead commits**

```bash
git add src/components/input/Input.tsx src/components/input/__tests__/Input.test.tsx stories/Input.stories.tsx
git commit -m "feat(input): Input size, appearance and htmlSize"
```

#### Task B2: Textarea sizes and appearances

Implements spec §2.1 (Textarea), D6, D9.

**Files:**
- Modify: `src/components/input/Textarea.tsx`
- Test: `src/components/input/__tests__/Textarea.test.tsx`
- Story: `stories/Textarea.stories.tsx`

**Interfaces:**
- Consumes: A2 maps, `useInputLook` (A6).
- Produces: `TextareaProps.size?: CoreSize`, `TextareaProps.appearance?: InputAppearance`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 P4-01)', () => {
  const box = () => screen.getByRole('textbox', { name: 'Notes' });

  it('renders the 0.7 classes and medium outline attributes by default', () => {
    render(<Textarea aria-label="Notes" />);
    expect(box()).toHaveClass('min-h-20', 'px-3', 'py-2', 'text-body-1', 'resize-y', 'border-input');
    expect(box()).toHaveAttribute('data-size', 'medium');
    expect(box()).toHaveAttribute('data-appearance', 'outline');
  });

  it.each([
    ['small', ['min-h-16', 'px-2', 'py-1', 'text-caption-1']],
    ['large', ['min-h-24', 'px-4', 'py-2.5', 'text-body-2']],
  ] as const)('size="%s"', (size, classes) => {
    render(<Textarea aria-label="Notes" size={size} />);
    expect(box()).toHaveClass(...classes);
    expect(box()).toHaveAttribute('data-size', size);
  });

  it('underline keeps vertical resizing and square corners', () => {
    render(<Textarea aria-label="Notes" appearance="underline" />);
    expect(box()).toHaveClass('resize-y', 'rounded-none', 'border-0', 'border-b');
  });

  it('takes the Field size and the provider appearance', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ appearance: 'filled-darker' }}>
        <Textarea />
      </WaveProvider>,
      { size: 'large' },
    );
    const el = screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label });
    expect(el).toHaveAttribute('data-size', 'large');
    expect(el).toHaveAttribute('data-appearance', 'filled-darker');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/Textarea.test.tsx --reporter=default`
Expected: FAIL: no `data-size`.

- [ ] **Step 3: Implement**

In `Textarea.tsx`, add the two props (JSDoc: sizes are a minimum height, 64/80/96px, with the type ramp; the appearances as Input's; the resolution order), then:

```ts
/** Minimum height, padding and type ramp of each size (medium is the 0.7 look). */
const TEXTAREA_SIZE: Readonly<Record<CoreSize, string>> = {
  small: 'min-h-16 px-2 py-1 text-caption-1',
  medium: 'min-h-20 px-3 py-2 text-body-1',
  large: 'min-h-24 px-4 py-2.5 text-body-2',
};
```

`const { size, appearance } = useInputLook(sizeProp, appearanceProp);`, and the `<textarea>` renders `data-size={size} data-appearance={appearance}` (before its spreads) and `className={cn('w-full resize-y', TEXTAREA_SIZE[size], inputAppearanceClasses[appearance], 'text-foreground placeholder:text-muted-foreground', inputFocus, 'disabled:cursor-not-allowed disabled:opacity-50', invalidLook && inputInvalid, className)}`.

- [ ] **Step 4: Story**

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Textarea {...args} rows={2} size={size} appearance={appearance} aria-label={`${size} ${appearance}`} />
      )}
    />
  ),
};
```

- [ ] **Step 5: Run to verify it passes, then the package checks**

Run: `npx vitest run src/components/input/__tests__/Textarea.test.tsx --reporter=default` and the stories gate for `Components/Input/Textarea`.
Expected: PASS.

- [ ] **Step 6: Lead commits**

```bash
git add src/components/input/Textarea.tsx src/components/input/__tests__/Textarea.test.tsx stories/Textarea.stories.tsx
git commit -m "feat(input): Textarea size and appearance"
```

#### Task B3: Select sizes, appearances and `htmlSize`

Implements spec §2.1 (Select), D10.

**Files:**
- Modify: `src/components/input/Select.tsx`
- Test: `src/components/input/__tests__/Select.test.tsx`
- Story: `stories/Select.stories.tsx`

**Interfaces:**
- Produces: `SelectProps.size?: CoreSize | number`, `SelectProps.htmlSize?: number`, `SelectProps.appearance?: InputAppearance`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 P4-01)', () => {
  const select = () => screen.getByRole('combobox', { name: 'Country' });
  const renderSelect = (props: Partial<SelectProps> = {}) =>
    render(
      <Select aria-label="Country" {...props}>
        <option>Norway</option>
      </Select>,
    );

  it('renders the 0.7 classes (paddings and chevron) by default', () => {
    renderSelect();
    expect(select()).toHaveClass(
      'h-8',
      'ps-3',
      'pe-8',
      'text-body-1',
      'bg-[size:5px_5px,5px_5px]',
      'bg-[position:right_16px_center,right_11px_center]',
    );
    expect(select()).toHaveAttribute('data-size', 'medium');
    expect(select()).toHaveAttribute('data-appearance', 'outline');
  });

  it.each([
    ['small', ['h-6', 'ps-2', 'pe-6', 'text-caption-1', 'bg-[size:4px_4px,4px_4px]']],
    ['large', ['h-10', 'ps-4', 'pe-10', 'text-body-2', 'bg-[size:6px_6px,6px_6px]']],
  ] as const)('size="%s" scales the paddings and the chevron', (size, classes) => {
    renderSelect({ size });
    expect(select()).toHaveClass(...classes);
  });

  it('a filled appearance keeps the chevron image next to its fill', () => {
    renderSelect({ appearance: 'filled-darker' });
    expect(select()).toHaveClass('bg-input-filled-darker');
    expect(select().className).toContain('bg-[image:');
  });

  it('a numeric size is the native visible-rows attribute, deprecated', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderSelect({ size: 4 });
    expect(select()).toHaveAttribute('size', '4');
    expect(select()).toHaveAttribute('data-size', 'medium');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[WaveUI] Select: `size={number}` is deprecated and will be removed in 1.0. Use `htmlSize` instead.',
    );
  });

  it('htmlSize alone does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderSelect({ htmlSize: 3 });
    expect(select()).toHaveAttribute('size', '3');
    expect(warn).not.toHaveBeenCalled();
  });
});
```

(With `size` 4 the accessible role of a `<select>` becomes `listbox` in some engines; if jsdom reports `listbox`, query by `screen.getByLabelText('Country')` in that test.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/Select.test.tsx --reporter=default`
Expected: FAIL.

- [ ] **Step 3: Implement**

`SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>`, with `size`, `htmlSize` and `appearance` documented as Input's (Select's native number is "the number of visible rows"). Resolve as in Task B1 (`resolveDeprecatedProp('Select', htmlSize, numericSize, 'size={number}', 'htmlSize')`). Add:

```ts
/** Inline paddings and chevron geometry of each size (medium is the 0.7 look). */
const SELECT_SIZE: Readonly<Record<CoreSize, string>> = {
  small:
    'ps-2 pe-6 bg-[size:4px_4px,4px_4px] bg-[position:right_12px_center,right_8px_center] wave-rtl:bg-[position:left_8px_center,left_12px_center]',
  medium:
    'ps-3 pe-8 bg-[size:5px_5px,5px_5px] bg-[position:right_16px_center,right_11px_center] wave-rtl:bg-[position:left_11px_center,left_16px_center]',
  large:
    'ps-4 pe-10 bg-[size:6px_6px,6px_6px] bg-[position:right_20px_center,right_14px_center] wave-rtl:bg-[position:left_14px_center,left_20px_center]',
};
```

The `<select>` renders `data-size`/`data-appearance` and `className={cn(inputHeightClasses[size], 'w-full appearance-none', inputTextClasses[size], inputAppearanceClasses[appearance], 'text-foreground', 'bg-no-repeat', SELECT_SIZE[size], 'bg-[image:linear-gradient(45deg,transparent_50%,var(--wave-muted-foreground)_50%),linear-gradient(135deg,var(--wave-muted-foreground)_50%,transparent_50%)]', 'forced-colors:appearance-auto forced-colors:bg-none', inputFocus, 'disabled:cursor-not-allowed disabled:opacity-50', invalidLook && inputInvalid, className)}` with `size={nativeSize}` after its spreads. Keep the 0.7 comments that explain the chevron and forced colors.

- [ ] **Step 4: Story, run, lead commits**

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Select {...args} size={size} appearance={appearance} aria-label={`${size} ${appearance}`}>
          <option>Norway</option>
          <option>Sweden</option>
        </Select>
      )}
    />
  ),
};
```

Run the test file and the stories gate for `Components/Input/Select`. Then:

```bash
git add src/components/input/Select.tsx src/components/input/__tests__/Select.test.tsx stories/Select.stories.tsx
git commit -m "feat(input): Select size, appearance and htmlSize"
```

#### Task B4: SearchBox sizes and appearances

Implements spec §2.1 (SearchBox), D11 (the clear button's hit area).

**Files:**
- Modify: `src/components/input/SearchBox.tsx`
- Test: `src/components/input/__tests__/SearchBox.test.tsx`
- Story: `stories/SearchBox.stories.tsx`

**Interfaces:**
- Consumes: A2 maps and `hitAreaLayer`; `useInputLook`.
- Produces: `SearchBoxProps.size?: CoreSize`, `SearchBoxProps.appearance?: InputAppearance`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 P4-01)', () => {
  const box = () => screen.getByRole('searchbox', { name: 'Search' });
  const root = () => box().closest('[data-size]') as HTMLElement;
  const clear = () => screen.getByRole('button', { name: 'Clear' });

  it('renders the 0.7 classes and medium outline attributes by default', () => {
    render(<SearchBox aria-label="Search" defaultValue="x" />);
    expect(root()).toHaveClass('h-8', 'text-body-1', 'border-input', 'bg-background');
    expect(root()).toHaveAttribute('data-size', 'medium');
    expect(root()).toHaveAttribute('data-appearance', 'outline');
    expect(clear()).toHaveClass('h-6', 'w-6', 'me-1');
  });

  it('small: 20px clear button with a 24px hit area anchored on the button itself', () => {
    render(<SearchBox aria-label="Search" defaultValue="x" size="small" />);
    expect(root()).toHaveClass('h-6', 'text-caption-1');
    expect(clear()).toHaveClass('size-5', 'relative', 'before:absolute', 'before:-inset-0.5', 'me-1');
  });

  it('large: 32px clear button', () => {
    render(<SearchBox aria-label="Search" defaultValue="x" size="large" />);
    expect(root()).toHaveClass('h-10', 'text-body-2');
    expect(clear()).toHaveClass('size-8');
  });

  it('takes the Field size and the provider appearance', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ appearance: 'underline' }}>
        <SearchBox />
      </WaveProvider>,
      { size: 'large' },
    );
    const el = screen.getByRole('searchbox', { name: FIELD_TEST_TEXT.label });
    const wrapper = el.closest('[data-size]') as HTMLElement;
    expect(wrapper).toHaveAttribute('data-size', 'large');
    expect(wrapper).toHaveAttribute('data-appearance', 'underline');
  });
});
```

(Use the clear button's real name: the 0.7 default is `DEFAULT_CLEAR_LABEL` in `SearchBox.tsx`; read it from there.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/SearchBox.test.tsx --reporter=default`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add the two props (documented as Input's) and resolve them with `useInputLook`. Add:

```ts
/** Per-size metrics of SearchBox (medium is the 0.7 look). */
const SEARCH_SIZE: Readonly<
  Record<CoreSize, { before: string; after: string; input: string; clear: string; glyph: number }>
> = {
  small: { before: 'ps-1.5', after: 'pe-1.5', input: 'px-1.5', clear: 'size-5', glyph: 12 },
  medium: { before: 'ps-2', after: 'pe-2', input: 'px-2', clear: 'h-6 w-6', glyph: 16 },
  large: { before: 'ps-3', after: 'pe-3', input: 'px-3', clear: 'size-8', glyph: 20 },
};
```

- Root: `data-size`/`data-appearance` before `{...rest}`; `className={cn('relative inline-flex w-full items-center', inputHeightClasses[size], inputTextClasses[size], inputAppearanceClasses[appearance], 'text-foreground', inputFocusWithin, invalidLook && inputInvalidWithin, disabled && 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100', className)}`.
- The search icon span uses `SEARCH_SIZE[size].before` and `<SearchIcon size={SEARCH_SIZE[size].glyph} className="text-muted-foreground" />`; the `contentAfter` span uses `.after`; the input uses `.input` and `inputTextClasses[size]` instead of `px-2 text-body-1`.
- The clear button's default classes become `cn('me-1 flex shrink-0 items-center justify-center rounded bg-transparent p-0 text-muted-foreground', SEARCH_SIZE[size].clear, size === 'small' && cn('relative', hitAreaLayer), 'not-disabled:not-aria-disabled:hover:text-foreground', focusRing, 'disabled:cursor-not-allowed', mergedAriaDisabledClasses)`. At medium the class list stays the 0.7 one (`me-1 flex h-6 w-6 …`). The default `<DismissIcon />` gets `size={SEARCH_SIZE[size].glyph}`. A consumer's merged button (the `dismiss` slot) keeps winning through `mergeProps`, as in 0.7.

- [ ] **Step 4: Story, run, lead commits**

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <SearchBox
          {...args}
          size={size}
          appearance={appearance}
          defaultValue="design"
          aria-label={`${size} ${appearance}`}
        />
      )}
    />
  ),
};
```

Run the test file and the stories gate for `Components/Input/SearchBox`.

```bash
git add src/components/input/SearchBox.tsx src/components/input/__tests__/SearchBox.test.tsx stories/SearchBox.stories.tsx
git commit -m "feat(input): SearchBox size and appearance"
```

### P4-spin — SpinButton

#### Task B5: SpinButton sizes, appearances and geometry

Implements P4-01 for SpinButton (spec §2 P4-02 intro), D13, D20.

**Files:**
- Modify: `src/components/input/SpinButton.tsx`
- Test: `src/components/input/__tests__/SpinButton.test.tsx`

**Interfaces:**
- Produces: `size?: CoreSize`, `appearance?: InputAppearance` (moved into `SpinButtonBaseProps` in Task B6).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes, appearances and geometry (Phase 4 D13, D20)', () => {
  const root = () => spin().closest('[data-size]') as HTMLElement;

  it('medium outline: a 32px root, full-height 32px-wide buttons, a 48px flexible input', () => {
    render(<SpinButton aria-label="Quantity" />);
    expect(root()).toHaveClass('h-8', 'text-body-1', 'border-input', 'bg-background');
    expect(root()).toHaveAttribute('data-size', 'medium');
    expect(root()).toHaveAttribute('data-appearance', 'outline');
    expect(incrementButton()).toHaveClass('h-full', 'w-8', 'border-s', 'border-input');
    expect(decrementButton()).toHaveClass('h-full', 'w-8', 'border-e', 'border-input');
    expect(spin()).toHaveClass('h-full', 'w-12', 'flex-auto', 'min-w-0', 'text-body-1');
  });

  it.each([
    ['small', 'h-6', 'w-6', 'w-10', 'text-caption-1'],
    ['large', 'h-10', 'w-10', 'w-14', 'text-body-2'],
  ] as const)('size="%s"', (size, rootHeight, buttonWidth, inputWidth, text) => {
    render(<SpinButton aria-label="Quantity" size={size} />);
    expect(root()).toHaveClass(rootHeight, text);
    expect(incrementButton()).toHaveClass(buttonWidth);
    expect(spin()).toHaveClass(inputWidth);
  });

  it('the separators render only in outline; on filled-darker the buttons hover one step darker', () => {
    render(<SpinButton aria-label="Quantity" appearance="filled-darker" />);
    expect(root()).toHaveClass('bg-input-filled-darker');
    expect(incrementButton()).not.toHaveClass('border-s');
    expect(decrementButton()).not.toHaveClass('border-e');
    expect(incrementButton()).toHaveClass('not-disabled:not-aria-disabled:hover:bg-subtle-pressed');
  });

  it('takes the Field size', () => {
    renderWithFieldContext(<SpinButton />, { size: 'large' });
    const el = screen.getByRole('spinbutton', { name: FIELD_TEST_TEXT.label });
    expect(el.closest('[data-size]')).toHaveAttribute('data-size', 'large');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx --reporter=default`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add the props (documented as Input's; the JSDoc adds "SpinButton is 24, 32 or 40px tall like every field; its buttons are square-ish, 24, 32 or 40px wide"), resolve them with `useInputLook`, and add:

```ts
/** Per-size widths of the step buttons and the input's flex basis, and the glyph size. */
const SPIN_SIZE: Readonly<Record<CoreSize, { button: string; input: string; glyph: number }>> = {
  small: { button: 'w-6', input: 'w-10', glyph: 12 },
  medium: { button: 'w-8', input: 'w-12', glyph: 12 },
  large: { button: 'w-10', input: 'w-14', glyph: 16 },
};
```

- `stepButtonClass` becomes `'flex h-full shrink-0 items-center justify-center bg-transparent p-0 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed disabled:pointer-events-none'` (no fixed size, no border color: the size and the separators are added per render).
- Decrement: `className={cn(stepButtonClass, SPIN_SIZE[size].button, appearance === 'outline' && 'border-e border-input', appearance === 'filled-darker' && 'not-disabled:not-aria-disabled:hover:bg-subtle-pressed', !disabled && 'disabled:opacity-50')}`; increment likewise with `border-s`. On `filled-darker` the hover fill is one step darker, since `subtle-hover` equals the light fill (the picker buttons' rule, D11). Glyphs: `<SubtractIcon size={SPIN_SIZE[size].glyph} />`, `<AddIcon size={…} />`.
- Root: `data-size`/`data-appearance` before `{...rest}`; `className={cn('relative inline-flex items-center', inputHeightClasses[size], inputTextClasses[size], inputAppearanceClasses[appearance], inputFocusWithin, invalidLook && inputInvalidWithin, disabled && 'cursor-not-allowed opacity-50', className)}`.
- Input: `className={cn('h-full min-w-0 flex-auto border-none bg-transparent text-center text-foreground focus:outline-hidden disabled:cursor-not-allowed [appearance:textfield]', SPIN_SIZE[size].input, inputTextClasses[size])}`.
- Update any 0.7 assertion of `h-8 w-8` buttons or the `h-8 w-12` input (spec §6.4) to the new classes, keeping each test's intent.

- [ ] **Step 4: Run to verify it passes; lead commits**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx --reporter=default`
Expected: PASS.

```bash
git add src/components/input/SpinButton.tsx src/components/input/__tests__/SpinButton.test.tsx
git commit -m "feat(input): SpinButton size and appearance; 32px tall like every field"
```

#### Task B6: `allowEmpty` and the empty value

Implements D16, D17. Covers Review Focus 4.

**Files:** as Task B5.

**Interfaces:**
- Produces: `export interface SpinButtonBaseProps` (every member except the value members); `SpinButtonProps extends SpinButtonBaseProps` with `allowEmpty?: false` and the 0.7 value members; `export interface SpinButtonAllowEmptyProps extends SpinButtonBaseProps { allowEmpty: true; value?: number | null; defaultValue?: number | null; onValueChange?: (value: number | null) => void; onChange?: never }`; `SpinButton: (props: SpinButtonProps | SpinButtonAllowEmptyProps) => React.ReactNode`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('allowEmpty (Phase 4 D16, D17)', () => {
  it('starts empty without a value: no text, no aria-valuenow', () => {
    render(<SpinButton aria-label="Quantity" allowEmpty />);
    expect(spin()).toHaveValue('');
    expect(spin()).not.toHaveAttribute('aria-valuenow');
  });

  it('clearing and committing emits null once (blur and Enter), in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <SpinButton aria-label="Quantity" allowEmpty defaultValue={3} onValueChange={onValueChange} />
      </React.StrictMode>,
    );
    await user.clear(spin());
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(spin()).toHaveValue('');
  });

  it('without allowEmpty, clearing still reverts (0.7)', async () => {
    const user = userEvent.setup();
    render(<SpinButton aria-label="Quantity" defaultValue={3} />);
    await user.clear(spin());
    await user.tab();
    expect(spin()).toHaveValue('3');
  });

  it('stepping from empty starts at 0 and clamps: min 1 gives 1 both ways', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SpinButton aria-label="Quantity" allowEmpty min={1} />);
    spin().focus();
    await user.keyboard('{ArrowUp}');
    expect(spin()).toHaveValue('1');
    unmount();
    render(<SpinButton aria-label="Quantity" allowEmpty min={1} />);
    spin().focus();
    await user.keyboard('{ArrowDown}');
    expect(spin()).toHaveValue('1');
  });

  it('keeps both step buttons enabled while empty', () => {
    render(<SpinButton aria-label="Quantity" allowEmpty min={0} max={10} />);
    expect(incrementButton()).toBeEnabled();
    expect(decrementButton()).toBeEnabled();
  });

  it('required and empty: the hidden input blocks the submit and focuses the spinbutton', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit} aria-label="Order">
        <SpinButton aria-label="Quantity" allowEmpty required name="qty" />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    act(() => form.requestSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(spin()).toHaveFocus();
  });

  it('submits "" through the hidden input and resets to null', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <SpinButton aria-label="Quantity" allowEmpty name="qty" />
        <button type="reset">Reset</button>
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    expect(new FormData(form).get('qty')).toBe('');
    spin().focus();
    await user.keyboard('{ArrowUp}');
    expect(new FormData(form).get('qty')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(spin()).toHaveValue('');
  });

  it('a controlled null from outside replaces a typed draft (Review Focus 4)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SpinButton aria-label="Quantity" allowEmpty value={5} onValueChange={() => {}} />,
    );
    await user.type(spin(), '7');
    expect(spin()).toHaveValue('57');
    rerender(<SpinButton aria-label="Quantity" allowEmpty value={null} onValueChange={() => {}} />);
    expect(spin()).toHaveValue('');
  });

  it('types: null only with allowEmpty; onChange readable on the union', () => {
    expectTypeOf<SpinButtonProps['value']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SpinButtonAllowEmptyProps['value']>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<React.ComponentProps<typeof SpinButton>>().toEqualTypeOf<
      SpinButtonProps | SpinButtonAllowEmptyProps
    >();
    type Props = React.ComponentProps<typeof SpinButton>;
    expectTypeOf<Props['onChange']>().toEqualTypeOf<((value: number) => void) | undefined>();
    interface Wrapper extends SpinButtonProps {
      hint?: string;
    }
    expectTypeOf<Wrapper['value']>().toEqualTypeOf<number | undefined>();
    // @ts-expect-error null needs allowEmpty
    render(<SpinButton aria-label="Quantity" value={null} />);
    const flag: boolean = Math.random() > 1;
    // @ts-expect-error a boolean variable fits neither member
    render(<SpinButton aria-label="Quantity" allowEmpty={flag} value={null} />);
  });
});
```

(Import `type SpinButtonProps, type SpinButtonAllowEmptyProps` from `'../SpinButton'` and `expectTypeOf` from `vitest`. `Props['onChange']` reads `(value: number) => void` from `SpinButtonProps` and `undefined` from the `never` member.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx --reporter=default && npx tsc -p tsconfig.dev.json --noEmit`
Expected: FAIL (type errors on `allowEmpty`; `null` not accepted).

- [ ] **Step 3: Implement**

- Split the props: move every member of `SpinButtonProps` except `value`, `defaultValue`, `onValueChange` and `onChange` into `export interface SpinButtonBaseProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | keyof SpinButtonInputProps>, SpinButtonInputProps`, then:

```ts
/** SpinButton props with a number value (the 0.7 shape). */
export interface SpinButtonProps extends SpinButtonBaseProps {
  /**
   * Allows an empty value (`null`). Takes the literal `true`: a `boolean` variable fits neither
   * member of the props, so branch the JSX or spread `{ allowEmpty: true, value }`.
   * @default false
   */
  allowEmpty?: false;
  /** Controlled numeric value. */
  value?: number;
  /** Initial value for uncontrolled usage (also what a form reset restores). @default 0 */
  defaultValue?: number;
  /** (0.7 JSDoc) */
  onValueChange?: (value: number) => void;
  /** @deprecated Use `onValueChange`. (0.7 JSDoc) */
  onChange?: (value: number) => void;
}

/** SpinButton props with `allowEmpty`: the value may be `null` (an empty field). */
export interface SpinButtonAllowEmptyProps extends SpinButtonBaseProps {
  /** The value may be `null`: clearing the text and committing it empties the field. */
  allowEmpty: true;
  /** Controlled value; `null` is an empty field. */
  value?: number | null;
  /** Initial value for uncontrolled usage (also what a form reset restores). @default null */
  defaultValue?: number | null;
  /** Called with the new value when it changes, `null` when the field is emptied. */
  onValueChange?: (value: number | null) => void;
  /** Not available with `allowEmpty` (the deprecated alias of `onValueChange`). */
  onChange?: never;
}
```

- The component takes `(props: SpinButtonProps | SpinButtonAllowEmptyProps)` and destructures from a widened local view: `const { allowEmpty = false, value: valueProp, defaultValue, onValueChange, onChange, …rest } = props as SpinButtonBaseProps & { allowEmpty?: boolean; value?: number | null; defaultValue?: number | null; onValueChange?: (value: number | null) => void; onChange?: (value: number) => void };`
- State: `const initialValue = defaultValue !== undefined ? defaultValue : allowEmpty ? null : 0;` and `useControllable<number | null>(valueProp, initialValue, (next) => { onValueChange?.(next); if (next !== null) onChange?.(next); })`.
- `current` for stepping and bounds: `const current = draftNumber ?? value;`. `stepBy(delta)`: `const from = current ?? 0;` then the 0.7 rounding and `commit(from + delta)` (commit clamps).
- `commitDraft`: `if (draft === null) return; if (allowEmpty && draft.trim() === '') { setDraft(null); setValue(null); return; }`, then the 0.7 lines.
- The buttons' disabled bound checks read `current === null ? false : current <= min` (and `>= max`).
- The input: `aria-valuenow={value ?? undefined}`; `value={draft ?? (value === null ? '' : String(value))}` (Task B7 adds `displayValue`).
- The hidden input: `<HiddenInput name={name} form={form} disabled={disabled} type="text" value={value === null ? '' : String(value)} required={allowEmpty ? isRequired : undefined} onInvalid={() => inputRef.current?.focus()} />`, where `isRequired = required ?? field?.required ?? false` (read `useFieldContext()`; an explicit `required={false}` wins, C-FORMS). The hidden input's `required` is what blocks an empty submit, because the visible input may show text for `null` (D17).
- Update the component JSDoc: the empty mode, and that `required` blocks an empty value.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx vitest run src/components/input/__tests__/SpinButton.test.tsx --reporter=default`
Expected: PASS; every 0.7 test is still green.

- [ ] **Step 5: Lead commits**

```bash
git add src/components/input/SpinButton.tsx src/components/input/__tests__/SpinButton.test.tsx
git commit -m "feat(input): SpinButton allowEmpty"
```

#### Task B7: `displayValue`

Implements D15.

**Files:** as Task B5.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('displayValue (Phase 4 D15)', () => {
  function Currency(props: { readOnly?: boolean }) {
    const [value, setValue] = React.useState(1);
    return (
      <SpinButton
        aria-label="Price"
        value={value}
        onValueChange={setValue}
        displayValue={`$${value.toFixed(2)}`}
        {...props}
      />
    );
  }
  const price = () => screen.getByRole('spinbutton', { name: 'Price' });

  it('shows displayValue and uses it as aria-valuetext while not focused', () => {
    render(<Currency />);
    expect(price()).toHaveValue('$1.00');
    expect(price()).toHaveAttribute('aria-valuetext', '$1.00');
    expect(price()).toHaveAttribute('aria-valuenow', '1');
  });

  it('shows the plain number while focused and editable, and displayValue again after blur', async () => {
    const user = userEvent.setup();
    render(<Currency />);
    await user.click(price());
    expect(price()).toHaveValue('1');
    expect(price()).toHaveAttribute('aria-valuetext', '$1.00');
    await user.keyboard('{ArrowUp}');
    expect(price()).toHaveValue('2');
    expect(price()).toHaveAttribute('aria-valuetext', '$2.00');
    await user.tab();
    expect(price()).toHaveValue('$2.00');
  });

  it('reselects the whole text when the focus switch happens with everything selected', () => {
    render(<Currency />);
    const input = price() as HTMLInputElement;
    input.setSelectionRange(0, input.value.length);
    act(() => input.focus());
    expect(input.value).toBe('1');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
  });

  it('keeps displayValue while focused but read-only', async () => {
    const user = userEvent.setup();
    render(<Currency readOnly />);
    await user.click(price());
    expect(price()).toHaveValue('$1.00');
  });

  it('a consumer aria-valuetext wins', () => {
    render(
      <SpinButton aria-label="Price" value={1} displayValue="$1.00" aria-valuetext="one dollar" />,
    );
    expect(price()).toHaveAttribute('aria-valuetext', 'one dollar');
  });

  it('is ignored when uncontrolled, with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SpinButton aria-label="Price" defaultValue={1} displayValue="$1.00" />);
    expect(price()).toHaveValue('1');
    expect(price()).not.toHaveAttribute('aria-valuetext');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[WaveUI] SpinButton: `displayValue` is ignored while the value is uncontrolled; pass `value` (and update it in `onValueChange`).',
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx -t "displayValue" --reporter=default`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Add `displayValue?: string` to `SpinButtonBaseProps`, with JSDoc: "Text shown for the value while the field is not being edited, and its `aria-valuetext` (a `$1.00` for 1). While the field has focus and can be edited it shows the plain number, so typing edits the number. Applies only while `value` is controlled (update it with the value); Fluent's `displayValue`."
- Track focus: `const [focused, setFocused] = React.useState(false);` Set it in the input's composed `onFocus`/`onBlur` (after the consumer's, which run first).
- `const [, , isControlled] = …` from `useControllable`'s third element. `const showsDisplay = isControlled && displayValue !== undefined;`
- Text: `value={draft ?? (showsDisplay && !(focused && interactive) ? displayValue : value === null ? '' : String(value))}`.
- `aria-valuetext={ariaValueText ?? (showsDisplay ? displayValue : undefined)}`.
- Reselection: in the focus handler, before `setFocused(true)`, record `reselectRef.current = input.value.length > 0 && input.selectionStart === 0 && input.selectionEnd === input.value.length;`. Then:

```ts
  React.useLayoutEffect(() => {
    if (!focused || !reselectRef.current) return;
    reselectRef.current = false;
    inputRef.current?.select();
  }, [focused]);
```

- Warning (C-DEV, from an effect):

```ts
  React.useEffect(() => {
    if (displayValue !== undefined && !isControlled) {
      warnOnce(
        'SpinButton:displayValue-uncontrolled',
        'SpinButton: `displayValue` is ignored while the value is uncontrolled; pass `value` (and update it in `onValueChange`).',
      );
    }
  }, [displayValue, isControlled]);
```

- [ ] **Step 4: Run to verify it passes; lead commits**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx --reporter=default`
Expected: PASS.

```bash
git add src/components/input/SpinButton.tsx src/components/input/__tests__/SpinButton.test.tsx
git commit -m "feat(input): SpinButton displayValue"
```

#### Task B8: `precision` and Shift+Home/End

Implements D19, D21.

**Files:** as Task B5.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('precision (Phase 4 D19)', () => {
  it('rounds a typed commit and steps, without padding', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SpinButton aria-label="Quantity" precision={2} step={0.001} onValueChange={onValueChange} />,
    );
    await user.clear(spin());
    await user.type(spin(), '1.234{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith(1.23);
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenLastCalledWith(1.23);
  });

  it('precision 2 shows 1, not 1.00', () => {
    render(<SpinButton aria-label="Quantity" precision={2} defaultValue={1} />);
    expect(spin()).toHaveValue('1');
  });
});

describe('Shift+Home and Shift+End (Phase 4 D21)', () => {
  it('keep their native selection and change nothing', () => {
    const onValueChange = vi.fn();
    render(<SpinButton aria-label="Quantity" min={0} max={9} defaultValue={5} onValueChange={onValueChange} />);
    const homeEvent = createEvent.keyDown(spin(), { key: 'Home', shiftKey: true });
    fireEvent(spin(), homeEvent);
    expect(homeEvent.defaultPrevented).toBe(false);
    const endEvent = createEvent.keyDown(spin(), { key: 'End', shiftKey: true });
    fireEvent(spin(), endEvent);
    expect(endEvent.defaultPrevented).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
```

(ArrowUp from 1.23 with `step={0.001}` is 1.231, which rounds to 1.23: equal to the current value, so `onValueChange` is not called again. That is why the last call is still 1.23. Import `createEvent` and `fireEvent` from `@testing-library/react`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx -t "precision|Shift" --reporter=default`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `precision?: number` on `SpinButtonBaseProps`: "Decimals every committed value is rounded to, typed or stepped (0–20); the number is not padded (use `displayValue` for `1.00`). Default: steps round to the decimals of `step` and the value, typed values are kept as typed."
- `const places = precision === undefined ? undefined : Math.min(20, Math.max(0, Math.trunc(precision)));` and in `commit(next)`: `const rounded = places === undefined ? next : roundTo(next, places); setValue(clamp(rounded));`. In `stepBy`, when `places` is set, round with it instead of the 0.7 decimals rule.
- In `handleKeyDown`'s `Home`/`End` case, return first when `e.shiftKey` is set: `if (e.shiftKey) return; // Shift+Home/End select text (Fluent)`.

- [ ] **Step 4: Run to verify it passes; lead commits**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx --reporter=default`
Expected: PASS.

```bash
git add src/components/input/SpinButton.tsx src/components/input/__tests__/SpinButton.test.tsx
git commit -m "feat(input): SpinButton precision; Shift+Home/End select text"
```

#### Task B9: Press-and-hold

Implements D18. Stepping never happens on `pointerdown` alone (WCAG 2.5.2).

**Files:** as Task B5, plus `stories/SpinButton.stories.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('press-and-hold (Phase 4 D18)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const press = (button: HTMLElement, pointerType = 'mouse') =>
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, pointerType });
  const release = (button: HTMLElement, pointerType = 'mouse') => {
    fireEvent.pointerUp(button, { button: 0, pointerId: 1, pointerType });
    fireEvent.click(button, { detail: 1 });
  };
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('a short press steps once, on its click, not on pointerdown', () => {
    render(<SpinButton aria-label="Quantity" />);
    press(incrementButton());
    expect(spin()).toHaveValue('0');
    advance(100);
    release(incrementButton());
    expect(spin()).toHaveValue('1');
  });

  it('a press cancelled before 300ms never steps (a scroll that starts on the button)', () => {
    render(<SpinButton aria-label="Quantity" />);
    press(incrementButton(), 'touch');
    advance(200);
    fireEvent.pointerCancel(incrementButton(), { pointerId: 1, pointerType: 'touch' });
    advance(1000);
    expect(spin()).toHaveValue('0');
  });

  it.each(['mouse', 'touch', 'pen'])('a %s hold repeats with the eased schedule', (pointerType) => {
    render(<SpinButton aria-label="Quantity" />);
    press(incrementButton(), pointerType);
    advance(290);
    expect(spin()).toHaveValue('0');
    advance(20); // 310ms
    expect(spin()).toHaveValue('1');
    advance(230); // 540ms: the second step at 534ms
    expect(spin()).toHaveValue('2');
    advance(760); // 1300ms: steps at 717, 859, 970, 1057, 1137, 1217 and 1297ms
    expect(spin()).toHaveValue('9');
    advance(160); // 1460ms: 80ms apart from now on
    expect(spin()).toHaveValue('11');
    release(incrementButton(), pointerType);
    expect(spin()).toHaveValue('11'); // the click that ends a hold adds no step
  });

  it.each([
    ['pointerup', (b: HTMLElement) => fireEvent.pointerUp(b, { pointerId: 1 })],
    ['pointercancel', (b: HTMLElement) => fireEvent.pointerCancel(b, { pointerId: 1 })],
    ['pointerleave', (b: HTMLElement) => fireEvent.pointerLeave(b, { pointerId: 1 })],
    ['window blur', () => fireEvent.blur(window)],
  ] as const)('a hold stops on %s', (_, stop) => {
    render(<SpinButton aria-label="Quantity" />);
    press(incrementButton());
    advance(310);
    expect(spin()).toHaveValue('1');
    stop(incrementButton());
    advance(1000);
    expect(spin()).toHaveValue('1');
  });

  it('stops at the bound, and a later virtual click still steps', () => {
    render(<SpinButton aria-label="Quantity" max={2} />);
    press(incrementButton());
    advance(1000);
    expect(spin()).toHaveValue('2');
    expect(incrementButton()).toBeDisabled();
    fireEvent.click(decrementButton(), { detail: 0 });
    expect(spin()).toHaveValue('1');
  });

  it('a click without a press (a screen reader) steps once', () => {
    render(<SpinButton aria-label="Quantity" />);
    fireEvent.click(incrementButton(), { detail: 0 });
    expect(spin()).toHaveValue('1');
  });

  it('ignores a secondary-button press, prevents the context menu and keeps focus in the input', () => {
    render(<SpinButton aria-label="Quantity" />);
    act(() => spin().focus());
    fireEvent.pointerDown(incrementButton(), { button: 2, pointerId: 1, pointerType: 'mouse' });
    advance(1000);
    expect(spin()).toHaveValue('0');
    const menu = createEvent.contextMenu(incrementButton());
    fireEvent(incrementButton(), menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(spin()).toHaveFocus();
  });

  it('releases the implicit capture of a touch pointer', () => {
    render(<SpinButton aria-label="Quantity" />);
    const button = incrementButton();
    const release = vi.fn();
    Object.assign(button, { hasPointerCapture: () => true, releasePointerCapture: release });
    press(button, 'touch');
    expect(release).toHaveBeenCalledWith(1);
  });
});
```

(Import `beforeEach`, `afterEach` and `createEvent`. The step times follow the implementation's rounded schedule: 300, 534, 717, 859, 970, 1057, then every 80ms. If the implementation's rounding differs by 1ms, adjust the checkpoints by the same amount, but keep the checkpoints between steps.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx -t "press-and-hold" --reporter=default`
Expected: FAIL: 0.7 steps on click only and never repeats.

- [ ] **Step 3: Implement**

Module constants (Fluent's `DEFAULT_SPIN_DELAY_MS`, `MIN_SPIN_DELAY_MS`, `MAX_SPIN_TIME_MS`):

```ts
/** Delay before a press becomes a hold, and the first delay between repeats (ms). */
const SPIN_DELAY = 300;
/** The shortest delay between repeats, reached after SPIN_RAMP ms of holding. */
const SPIN_MIN_DELAY = 80;
const SPIN_RAMP = 1000;

/** The delay after a step taken `elapsed` ms into a hold: 300ms easing linearly to 80ms. */
function spinDelay(elapsed: number): number {
  const t = Math.min(1, elapsed / SPIN_RAMP);
  return Math.round(SPIN_DELAY + (SPIN_MIN_DELAY - SPIN_DELAY) * t);
}
```

In the component:

```ts
  // A press becomes a hold after SPIN_DELAY; a shorter press steps on its click (WCAG 2.5.2).
  const holdRef = React.useRef<{ timer: ReturnType<typeof setTimeout>; elapsed: number; direction: 1 | -1 } | null>(null);
  // Whether the press that ends in the next pointer click has repeated (reset by every pointerdown).
  const repeatedRef = React.useRef(false);

  const stopHold = React.useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current.timer);
    holdRef.current = null;
  }, []);

  const atBound = (direction: 1 | -1) =>
    current !== null && (direction === 1 ? current >= max : current <= min);

  const holdTick = useEventCallback(() => {
    const hold = holdRef.current;
    if (!hold) return;
    if (!interactive || atBound(hold.direction)) {
      stopHold();
      return;
    }
    repeatedRef.current = true;
    stepBy(hold.direction * step);
    const delay = spinDelay(hold.elapsed);
    hold.elapsed += delay;
    hold.timer = setTimeout(holdTick, delay);
  });

  const startHold = (direction: 1 | -1) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !interactive) return;
    // Touch and pen capture the pointer implicitly; release it so pointerleave fires.
    if (event.pointerType !== 'mouse' && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    repeatedRef.current = false;
    stopHold();
    holdRef.current = {
      timer: setTimeout(holdTick, SPIN_DELAY),
      elapsed: SPIN_DELAY,
      direction,
    };
  };

  const clickStep = (direction: 1 | -1) => (event: React.MouseEvent<HTMLButtonElement>) => {
    // A click without a press (detail 0: a screen reader, element.click()) steps once; a pointer
    // click steps unless its press already repeated.
    if (event.detail !== 0 && repeatedRef.current) {
      repeatedRef.current = false;
      return;
    }
    stepBy(direction * step);
  };

  React.useEffect(() => {
    if (!interactive) stopHold();
  }, [interactive, stopHold]);
  React.useEffect(() => {
    window.addEventListener('blur', stopHold);
    return () => {
      window.removeEventListener('blur', stopHold);
      stopHold();
    };
  }, [stopHold]);
```

(`holdTick` runs at 300ms with `elapsed` 300, steps, and schedules the next step after `spinDelay(300)` = 234ms, giving 300, 534, 717, 859, 970, 1057, then every 80ms. `stepBy`, `current`, `interactive`, `min`, `max` and `step` are the component's existing values; `useEventCallback` keeps `holdTick` reading the latest.)

Each step button gets:

```tsx
        onPointerDown={startHold(-1)} // +1 on the increment button
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onPointerLeave={stopHold}
        onClick={clickStep(-1)}
        onMouseDown={keepFocus}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(/* Task B5's classes */, 'touch-manipulation select-none [-webkit-touch-callout:none]')}
```

Keep the 0.7 `onMouseDown={keepFocus}` (do not cancel `pointerdown`: that would suppress the `mousedown` whose default keeps focus in the input). Update the component JSDoc: holding a step button repeats, and a short press steps on release.

- [ ] **Step 4: Stories**

In `stories/SpinButton.stories.tsx` add (`import { SizeAppearanceGrid } from './_grids';`):

```tsx
function CurrencySpinButton(props: Partial<SpinButtonProps>) {
  const [value, setValue] = React.useState(1);
  return (
    <SpinButton
      aria-label="Price"
      {...props}
      value={value}
      onValueChange={setValue}
      step={0.5}
      displayValue={`$${value.toFixed(2)}`}
    />
  );
}

export const DisplayValue: Story = { render: (args) => <CurrencySpinButton {...args} /> };

export const AllowEmpty: Story = {
  render: () => <SpinButton aria-label="Guests (optional)" allowEmpty min={1} max={12} />,
};

export const Precision: Story = {
  args: { 'aria-label': 'Weight in kg', precision: 2, step: 0.25, defaultValue: 1.5 },
};

export const FullWidth: Story = {
  args: { 'aria-label': 'Quantity', className: 'w-full' },
};

export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <SpinButton {...args} size={size} appearance={appearance} aria-label={`${size} ${appearance}`} />
      )}
    />
  ),
};
```

(Adapt `Story`'s type to the file's `StoryObj` alias; a story whose props need `allowEmpty` renders it in `render` because the story args type is the non-empty `SpinButtonProps`.)

- [ ] **Step 5: Run the package checks; lead commits**

Run: `npx vitest run src/components/input/__tests__/SpinButton.test.tsx --reporter=default`, the stories gate for `Components/Input/SpinButton`, the conventions gate for `src/components/input/SpinButton.tsx`, both typechecks, ESLint and Prettier.
Expected: all green.

```bash
git add src/components/input/SpinButton.tsx src/components/input/__tests__/SpinButton.test.tsx stories/SpinButton.stories.tsx
git commit -m "feat(input): SpinButton press-and-hold"
```

### P4-pickers — Combobox, Dropdown, DatePicker, TimePicker, TagPicker

#### Task B10: Picker metrics per size in `pickerStyles.ts`

Implements spec §2.2 (the table), D11.

**Files:**
- Modify: `src/components/input/pickerStyles.ts`
- Test: `src/components/input/__tests__/pickerStyles.test.ts` (create it if it does not exist)

**Interfaces:**
- Consumes: `hitAreaLayer` (A2), `cn`, `CoreSize`, `InputAppearance`.
- Produces: `PICKER_ICON_BUTTON_CLASSES` (unchanged, the medium value); `pickerIconButtonClasses(size?: CoreSize, appearance?: InputAppearance): string`; `pickerButtonOffset(size: CoreSize, position: 1 | 2): string`; `pickerEndPadding(buttons: number, size?: CoreSize): string | undefined` (0.7 results at medium); `pickerGlyphSize(size: CoreSize, kind: 'chevron' | 'icon'): number`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  PICKER_ICON_BUTTON_CLASSES,
  pickerButtonOffset,
  pickerEndPadding,
  pickerGlyphSize,
  pickerIconButtonClasses,
} from '../pickerStyles';

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

describe('picker metrics (Phase 4 D11)', () => {
  it('medium is the 0.7 button, with its literal h-6 w-6 box', () => {
    expect(pickerIconButtonClasses('medium')).toBe(PICKER_ICON_BUTTON_CLASSES);
    expect(tokens(PICKER_ICON_BUTTON_CLASSES)).toEqual(expect.arrayContaining(['h-6', 'w-6']));
  });

  it('small is a 20px box with a 24px hit layer; large a 32px box', () => {
    const small = tokens(pickerIconButtonClasses('small'));
    expect(small).toEqual(
      expect.arrayContaining(['absolute', 'size-5', 'before:absolute', 'before:-inset-0.5']),
    );
    expect(small).not.toContain('h-6');
    expect(tokens(pickerIconButtonClasses('large'))).toEqual(expect.arrayContaining(['size-8']));
  });

  it('on filled-darker the hover fill is one step darker', () => {
    expect(tokens(pickerIconButtonClasses('medium', 'filled-darker'))).toEqual(
      expect.arrayContaining(['not-disabled:not-aria-disabled:hover:bg-subtle-pressed']),
    );
    expect(tokens(pickerIconButtonClasses('medium', 'filled-darker'))).not.toContain(
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
    );
  });

  it.each([
    ['small', 'end-1', 'end-7', 'pe-7', 'pe-13'],
    ['medium', 'end-1', 'end-7', 'pe-8', 'pe-14'],
    ['large', 'end-1', 'end-9', 'pe-10', 'pe-18'],
  ] as const)('%s: offsets %s/%s, end paddings %s/%s', (size, first, second, one, two) => {
    expect(pickerButtonOffset(size, 1)).toBe(first);
    expect(pickerButtonOffset(size, 2)).toBe(second);
    expect(pickerEndPadding(1, size)).toBe(one);
    expect(pickerEndPadding(2, size)).toBe(two);
    expect(pickerEndPadding(0, size)).toBeUndefined();
  });

  it('keeps the 0.7 results without a size', () => {
    expect(pickerEndPadding(1)).toBe('pe-8');
    expect(pickerEndPadding(2)).toBe('pe-14');
  });

  it.each([
    ['small', 12, 12],
    ['medium', 12, 16],
    ['large', 16, 20],
  ] as const)('%s glyphs: chevron %i, icons %i', (size, chevron, icon) => {
    expect(pickerGlyphSize(size, 'chevron')).toBe(chevron);
    expect(pickerGlyphSize(size, 'icon')).toBe(icon);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/pickerStyles.test.ts --reporter=default`
Expected: FAIL: the new functions are missing.

- [ ] **Step 3: Implement**

Append to `pickerStyles.ts` (keep `PICKER_ICON_BUTTON_CLASSES` as it is):

```ts
import { cn } from '../../lib/cn';
import type { CoreSize, InputAppearance } from '../../lib/types';

/** The button box of each size: 20px with a 24px hit layer, 24px (the 0.7 box) or 32px. */
const BUTTON_BOX: Readonly<Record<CoreSize, string>> = {
  small: 'size-5 before:absolute before:-inset-0.5',
  medium: '',
  large: 'size-8',
};

/**
 * The classes of a picker's icon button at a size and appearance (Phase 4 D11): the 0.7 classes,
 * the size's box and, on `filled-darker`, a hover fill one step darker than the field.
 */
export function pickerIconButtonClasses(
  size: CoreSize = 'medium',
  appearance: InputAppearance = 'outline',
): string {
  return cn(
    PICKER_ICON_BUTTON_CLASSES,
    BUTTON_BOX[size],
    appearance === 'filled-darker' && 'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
  );
}

const BUTTON_OFFSETS: Readonly<Record<CoreSize, readonly [string, string]>> = {
  small: ['end-1', 'end-7'],
  medium: ['end-1', 'end-7'],
  large: ['end-1', 'end-9'],
};

/** The inline-end offset of a picker's first or second icon button (the second sits before it). */
export function pickerButtonOffset(size: CoreSize, position: 1 | 2): string {
  return BUTTON_OFFSETS[size][position - 1];
}

const END_PADDINGS: Readonly<Record<CoreSize, readonly [string, string]>> = {
  small: ['pe-7', 'pe-13'],
  medium: ['pe-8', 'pe-14'],
  large: ['pe-10', 'pe-18'],
};

/** The glyph sizes of each size: the chevron, and the other icons (clear, calendar). */
const GLYPHS: Readonly<Record<CoreSize, { chevron: number; icon: number }>> = {
  small: { chevron: 12, icon: 12 },
  medium: { chevron: 12, icon: 16 },
  large: { chevron: 16, icon: 20 },
};

/** The pixel size of a picker glyph at a size. */
export function pickerGlyphSize(size: CoreSize, kind: 'chevron' | 'icon'): number {
  return GLYPHS[size][kind];
}
```

Replace `pickerEndPadding` with the size-aware version (its JSDoc keeps the 0.7 sentence and adds the sizes):

```ts
export function pickerEndPadding(buttons: number, size: CoreSize = 'medium'): string | undefined {
  if (buttons <= 0) return undefined;
  return END_PADDINGS[size][buttons >= 2 ? 1 : 0];
}
```

(`BUTTON_BOX.small` repeats `hitAreaLayer` literally so the scanner sees it; a test in Task A2 pins `hitAreaLayer`'s value.)

- [ ] **Step 4: Run to verify it passes; lead commits**

Run: `npx vitest run src/components/input/__tests__/pickerStyles.test.ts --reporter=default`
Expected: PASS.

```bash
git add src/components/input/pickerStyles.ts src/components/input/__tests__/pickerStyles.test.ts
git commit -m "feat(input): picker button metrics per size"
```

#### Task B11: Combobox (and its expand button)

Implements spec §2.2 (Combobox), D6, D9, D11.

**Files:**
- Modify: `src/components/input/Combobox.tsx`, `src/components/input/Combobox.expand.tsx`
- Test: `src/components/input/__tests__/Combobox.test.tsx`
- Story: `stories/Combobox.stories.tsx`

**Interfaces:**
- Consumes: A2 maps, `useInputLook`, Task B10's functions.
- Produces: `ComboboxProps.size?: CoreSize`, `ComboboxProps.appearance?: InputAppearance`; `PickerExpandButton` takes `size: CoreSize` and `appearance: InputAppearance` (used by Combobox and TimePicker).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 P4-01)', () => {
  const renderCombobox = (props: Partial<ComboboxProps> = {}) =>
    render(
      <Combobox aria-label="Fruit" clearable defaultValue="apple" {...props}>
        <Combobox.Option value="apple">Apple</Combobox.Option>
      </Combobox>,
    );
  const input = () => screen.getByRole('combobox', { name: 'Fruit' });
  const root = () => input().closest('[data-size]') as HTMLElement;
  const clear = () => screen.getByRole('button', { name: 'Clear selection' });
  const expand = () => screen.getByRole('button', { name: 'Show options' });

  it('keeps the 0.7 classes and renders the medium outline attributes', () => {
    renderCombobox();
    expect(input()).toHaveClass('h-8', 'px-3', 'text-body-1', 'border-input', 'pe-14');
    expect(expand()).toHaveClass('h-6', 'w-6', 'end-1');
    expect(clear()).toHaveClass('h-6', 'w-6', 'end-7');
    expect(root()).toHaveAttribute('data-size', 'medium');
    expect(root()).toHaveAttribute('data-appearance', 'outline');
  });

  it('small: 24px field, 20px buttons with hit layers at end-1 and end-7, pe-13', () => {
    renderCombobox({ size: 'small' });
    expect(input()).toHaveClass('h-6', 'px-2', 'text-caption-1', 'pe-13');
    expect(expand()).toHaveClass('size-5', 'before:-inset-0.5', 'end-1');
    expect(clear()).toHaveClass('size-5', 'before:-inset-0.5', 'end-7');
  });

  it('large: 40px field, 32px buttons at end-1 and end-9, pe-18, larger glyphs', () => {
    renderCombobox({ size: 'large' });
    expect(input()).toHaveClass('h-10', 'px-4', 'text-body-2', 'pe-18');
    expect(expand()).toHaveClass('size-8', 'end-1');
    expect(clear()).toHaveClass('size-8', 'end-9');
    expect(expand().querySelector('svg')).toHaveAttribute('width', '16');
    expect(clear().querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('an appearance styles the input; the listbox does not change', async () => {
    const user = userEvent.setup();
    renderCombobox({ appearance: 'underline', size: 'large' });
    expect(input()).toHaveClass('border-0', 'border-b', 'rounded-none');
    await user.click(expand());
    const option = screen.getByRole('option', { name: 'Apple' });
    expect(option).toHaveClass('px-3', 'py-1.5', 'text-body-1');
  });

  it('takes the Field size and the provider appearance', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ appearance: 'filled-darker' }}>
        <Combobox>
          <Combobox.Option value="a">A</Combobox.Option>
        </Combobox>
      </WaveProvider>,
      { size: 'small' },
    );
    const el = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
    expect(el.closest('[data-size]')).toHaveAttribute('data-size', 'small');
    expect(el.closest('[data-appearance]')).toHaveAttribute('data-appearance', 'filled-darker');
    expect(screen.getByRole('button', { name: 'Show options' })).toHaveClass(
      'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
    );
  });

  it('keeps the buttons at the inline end in RTL', () => {
    renderWithProviders(
      <Combobox aria-label="Fruit" size="large">
        <Combobox.Option value="apple">Apple</Combobox.Option>
      </Combobox>,
      { dir: 'rtl' },
    );
    expect(screen.getByRole('button', { name: 'Show options' })).toHaveClass('end-1');
  });
});
```

(Use the exact 0.7 button names from `Combobox.tsx` (`labels.clear`/`labels.expand` defaults) and the option classes from `Option.tsx`. The glyph components render an `<svg width>` from `size`; check `src/lib/icons.tsx` and adjust the attribute assertion if it uses `style` instead.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/input/__tests__/Combobox.test.tsx -t "sizes and appearances" --reporter=default`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `Combobox.tsx`: add the two props (JSDoc as Input's, plus "the listbox keeps its size"), `const { size, appearance } = useInputLook(sizeProp, appearanceProp);`. The root element (the one that receives `className`) renders `data-size`/`data-appearance` before `{...rest}`. The input's class list becomes `cn(inputHeightClasses[size], 'w-full', inputPaddingClasses[size], inputTextClasses[size], inputAppearanceClasses[appearance], 'text-foreground placeholder:text-muted-foreground', inputFocus, disabledStyles, invalidLook && inputInvalid, pickerEndPadding(Number(showClear) + Number(showExpand), size))`. Drop the `inputBase` and `border-b-stroke-accessible` imports and uses (the maps cover them). The clear button's class list becomes `cn(pickerIconButtonClasses(size, appearance), pickerButtonOffset(size, showExpand ? 2 : 1), focusRing, disabledStyles)`, and its glyph `<DismissIcon size={pickerGlyphSize(size, 'icon')} />`. Pass `size={size} appearance={appearance}` to `PickerExpandButton`.
- `Combobox.expand.tsx`: add `size: CoreSize` and `appearance: InputAppearance` to its props (documented); its class list becomes `cn(pickerIconButtonClasses(size, appearance), pickerButtonOffset(size, 1), focusRing, disabledStyles)`, and the default glyph `<ChevronDownIcon size={pickerGlyphSize(size, 'chevron')} />` (a consumer `expandIcon` renders as given).

- [ ] **Step 4: Story, run, lead commits**

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Combobox
          {...args}
          size={size}
          appearance={appearance}
          clearable
          defaultValue="apple"
          aria-label={`${size} ${appearance}`}
        >
          <Combobox.Option value="apple">Apple</Combobox.Option>
          <Combobox.Option value="banana">Banana</Combobox.Option>
        </Combobox>
      )}
    />
  ),
};
```

Run the Combobox tests and the stories gate for `Components/Input/Combobox`.

```bash
git add src/components/input/Combobox.tsx src/components/input/Combobox.expand.tsx src/components/input/__tests__/Combobox.test.tsx stories/Combobox.stories.tsx
git commit -m "feat(input): Combobox size and appearance"
```

#### Task B12: TimePicker

Implements spec §2.2 (TimePicker).

**Files:** `src/components/input/TimePicker.tsx`, `__tests__/TimePicker.test.tsx`, `stories/TimePicker.stories.tsx`.

**Interfaces:** Produces `TimePickerProps.size?: CoreSize`, `TimePickerProps.appearance?: InputAppearance`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 P4-01)', () => {
  const renderPicker = (props: Partial<TimePickerProps> = {}) =>
    render(<TimePicker aria-label="Start" clearable defaultValue="09:00" {...props} />);
  const input = () => screen.getByRole('combobox', { name: 'Start' });
  const root = () => input().closest('[data-size]') as HTMLElement;
  const clear = () => screen.getByRole('button', { name: 'Clear time' });
  const expand = () => screen.getByRole('button', { name: 'Show times' });

  it('keeps the 0.7 classes and renders the medium outline attributes', () => {
    renderPicker();
    expect(input()).toHaveClass('h-8', 'px-3', 'text-body-1', 'border-input', 'pe-14');
    expect(expand()).toHaveClass('h-6', 'w-6', 'end-1');
    expect(clear()).toHaveClass('h-6', 'w-6', 'end-7');
    expect(root()).toHaveAttribute('data-size', 'medium');
    expect(root()).toHaveAttribute('data-appearance', 'outline');
  });

  it('small: 24px field, 20px buttons with hit layers at end-1 and end-7, pe-13', () => {
    renderPicker({ size: 'small' });
    expect(input()).toHaveClass('h-6', 'px-2', 'text-caption-1', 'pe-13');
    expect(expand()).toHaveClass('size-5', 'before:-inset-0.5', 'end-1');
    expect(clear()).toHaveClass('size-5', 'before:-inset-0.5', 'end-7');
  });

  it('large: 40px field, 32px buttons at end-1 and end-9, pe-18', () => {
    renderPicker({ size: 'large' });
    expect(input()).toHaveClass('h-10', 'px-4', 'text-body-2', 'pe-18');
    expect(expand()).toHaveClass('size-8', 'end-1');
    expect(clear()).toHaveClass('size-8', 'end-9');
  });

  it('an appearance styles the input; the time list does not change', async () => {
    const user = userEvent.setup();
    renderPicker({ appearance: 'filled-darker', size: 'large' });
    expect(input()).toHaveClass('bg-input-filled-darker');
    await user.click(expand());
    expect(screen.getAllByRole('option')[0]).toHaveClass('px-3', 'py-1.5', 'text-body-1');
  });

  it('takes the Field size', () => {
    renderWithFieldContext(<TimePicker />, { size: 'large' });
    const el = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
    expect(el.closest('[data-size]')).toHaveAttribute('data-size', 'large');
    expect(el).toHaveClass('h-10', 'text-body-2');
  });
});
```

(Use the 0.7 button names and option classes from `TimePicker.tsx`.)

- [ ] **Step 2: Run to verify it fails.** `npx vitest run src/components/input/__tests__/TimePicker.test.tsx -t "sizes and appearances|Field size" --reporter=default`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `TimePicker.tsx`:
- Add `size?: CoreSize` and `appearance?: InputAppearance` (JSDoc: the pixel sizes, the resolution order, "the time list keeps its size"). Add `const { size, appearance } = useInputLook(sizeProp, appearanceProp);`.
- The root element (the one that receives `className`) renders `data-size={size} data-appearance={appearance}` before `{...rest}`.
- The input: `className={cn(inputHeightClasses[size], 'w-full', inputPaddingClasses[size], inputTextClasses[size], inputAppearanceClasses[appearance], 'text-foreground placeholder:text-muted-foreground', inputFocus, disabledStyles, invalidLook && inputInvalid, pickerEndPadding(Number(showClear) + Number(showExpand), size))}` (replacing `inputBase` and `border-b-stroke-accessible`).
- The clear button: `className={cn(pickerIconButtonClasses(size, appearance), pickerButtonOffset(size, showExpand ? 2 : 1), focusRing, disabledStyles)}` with `<DismissIcon size={pickerGlyphSize(size, 'icon')} />`.
- `<PickerExpandButton … size={size} appearance={appearance} />` (Task B11 gave it these props).

- [ ] **Step 4: Story, run, lead commits.**

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <TimePicker
          {...args}
          size={size}
          appearance={appearance}
          clearable
          defaultValue="09:30"
          aria-label={`${size} ${appearance}`}
        />
      )}
    />
  ),
};
```

Run the TimePicker tests and the stories gate for `Components/Input/TimePicker`.

```bash
git add src/components/input/TimePicker.tsx src/components/input/__tests__/TimePicker.test.tsx stories/TimePicker.stories.tsx
git commit -m "feat(input): TimePicker size and appearance"
```

#### Task B13: DatePicker

Implements spec §2.2 (DatePicker). The local button classes and hand-written paddings move onto `pickerStyles.ts`.

**Files:** `src/components/input/DatePicker.tsx`, `__tests__/DatePicker.test.tsx`, `stories/DatePicker.stories.tsx`.

**Interfaces:** Produces `DatePickerProps.size?: CoreSize`, `DatePickerProps.appearance?: InputAppearance`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 P4-01)', () => {
  const renderPicker = (props: Partial<DatePickerProps> = {}) =>
    render(
      <DatePicker aria-label="Due" clearable defaultValue={new Date(2026, 0, 5)} {...props} />,
    );
  const input = () => screen.getByRole('textbox', { name: 'Due' });
  const root = () => input().closest('[data-size]') as HTMLElement;
  const calendar = () => screen.getByRole('button', { name: 'Open calendar' });
  const clear = () => screen.getByRole('button', { name: 'Clear date' });

  it('keeps the 0.7 classes and renders the medium outline attributes', () => {
    renderPicker();
    expect(input()).toHaveClass('h-8', 'px-3', 'text-body-1', 'border-input', 'pe-14');
    expect(calendar()).toHaveClass('h-6', 'w-6', 'end-1');
    expect(clear()).toHaveClass('h-6', 'w-6', 'end-7');
    expect(root()).toHaveAttribute('data-size', 'medium');
    expect(root()).toHaveAttribute('data-appearance', 'outline');
  });

  it('small: 20px buttons with hit layers at end-1 and end-7, pe-13', () => {
    renderPicker({ size: 'small' });
    expect(input()).toHaveClass('h-6', 'px-2', 'text-caption-1', 'pe-13');
    expect(calendar()).toHaveClass('size-5', 'before:-inset-0.5', 'end-1');
    expect(clear()).toHaveClass('size-5', 'before:-inset-0.5', 'end-7');
  });

  it('large: 32px buttons at end-1 and end-9, pe-18, 20px glyphs', () => {
    renderPicker({ size: 'large' });
    expect(input()).toHaveClass('h-10', 'px-4', 'text-body-2', 'pe-18');
    expect(calendar()).toHaveClass('size-8', 'end-1');
    expect(clear()).toHaveClass('size-8', 'end-9');
    expect(calendar().querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('an appearance styles the input; the calendar dialog does not change', async () => {
    const user = userEvent.setup();
    renderPicker({ appearance: 'underline', size: 'large' });
    expect(input()).toHaveClass('border-0', 'border-b');
    await user.click(calendar());
    expect(screen.getByRole('dialog')).toHaveClass('p-3', 'shadow-16');
  });

  it('takes the Field size', () => {
    renderWithFieldContext(<DatePicker />, { size: 'small' });
    const el = screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label });
    expect(el.closest('[data-size]')).toHaveAttribute('data-size', 'small');
  });
});
```

(Use the 0.7 button names and dialog classes from `DatePicker.tsx`.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.** The props and `useInputLook`; data attributes on the root `<div>` (before `{...rest}`, which 0.7 spreads first: move the spread after the two attributes). The input's class list from the maps with `pickerEndPadding(showClear ? 2 : 1, size)` (replacing 0.7's `showClear ? 'pe-14' : 'pe-8'`). The calendar button: `cn(pickerIconButtonClasses(size, appearance), pickerButtonOffset(size, 1), focusRing, disabledStyles)` with `<CalendarIcon size={pickerGlyphSize(size, 'icon')} />`. The clear button at `pickerButtonOffset(size, 2)`. Delete the local `ICON_BUTTON_CLASSES` constant, which has no other users.

- [ ] **Step 4: Story, run, lead commits.**

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <DatePicker
          {...args}
          size={size}
          appearance={appearance}
          clearable
          defaultValue={new Date(2026, 0, 5)}
          aria-label={`${size} ${appearance}`}
        />
      )}
    />
  ),
};
```

Run the DatePicker tests and the stories gate for `Components/Input/DatePicker`.

```bash
git add src/components/input/DatePicker.tsx src/components/input/__tests__/DatePicker.test.tsx stories/DatePicker.stories.tsx
git commit -m "feat(input): DatePicker size and appearance"
```

#### Task B14: Dropdown

Implements spec §2.2 (Dropdown).

**Files:** `src/components/input/Dropdown.tsx`, `__tests__/Dropdown.test.tsx`, `stories/Dropdown.stories.tsx`.

**Interfaces:** Produces `DropdownProps.size?: CoreSize`, `DropdownProps.appearance?: InputAppearance`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 P4-01)', () => {
  const renderDropdown = (props: Partial<DropdownProps> = {}) =>
    render(
      <Dropdown aria-label="Role" clearable defaultValue="user" {...props}>
        <Dropdown.Option value="user">User</Dropdown.Option>
      </Dropdown>,
    );
  const button = () => screen.getByRole('combobox', { name: 'Role' });
  const chevron = () => button().querySelector('svg') as SVGElement;
  const clear = () => screen.getByRole('button', { name: 'Clear selection' });

  it('keeps the 0.7 classes at medium', () => {
    renderDropdown();
    expect(button()).toHaveClass('h-8', 'px-3', 'text-body-1', 'pe-14');
    expect(chevron()).toHaveClass('end-3');
    expect(clear()).toHaveClass('h-6', 'w-6', 'end-7');
  });

  it.each([
    ['small', ['h-6', 'px-2', 'text-caption-1', 'pe-13'], 'end-2', ['size-5', 'end-7']],
    ['large', ['h-10', 'px-4', 'text-body-2', 'pe-18'], 'end-3', ['size-8', 'end-9']],
  ] as const)('%s', (size, buttonClasses, chevronOffset, clearClasses) => {
    renderDropdown({ size });
    expect(button()).toHaveClass(...buttonClasses);
    expect(chevron()).toHaveClass(chevronOffset);
    expect(clear()).toHaveClass(...clearClasses);
  });

  it('renders the appearance on the button and the attributes on the root', () => {
    renderDropdown({ appearance: 'filled-lighter' });
    expect(button()).toHaveClass('bg-input-filled-lighter', 'border-input-filled-stroke');
    const root = button().closest('[data-appearance]') as HTMLElement;
    expect(root).toHaveAttribute('data-appearance', 'filled-lighter');
    expect(root).toHaveAttribute('data-size', 'medium');
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.** The props and `useInputLook`; data attributes on the root. The button's class list: `cn('relative flex w-full items-center justify-between py-0 text-start', inputHeightClasses[size], inputPaddingClasses[size], inputTextClasses[size], inputAppearanceClasses[appearance], 'text-foreground', pickerEndPadding(showClear ? 2 : 1, size), inputFocus, disabledStyles, invalidLook && inputInvalid)` (keep the 0.7 comment about C-NATIVE). The chevron: `<ChevronDownIcon size={pickerGlyphSize(size, 'chevron')} className={cn('absolute transition-transform motion-reduce:transition-none', size === 'small' ? 'end-2' : 'end-3', expanded && 'rotate-180')} />`. The clear button through `pickerIconButtonClasses(size, appearance)` and `pickerButtonOffset(size, 2)`, with a `pickerGlyphSize(size, 'icon')` glyph.

- [ ] **Step 4: Story, run, lead commits.**

```tsx
export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Dropdown
          {...args}
          size={size}
          appearance={appearance}
          clearable
          defaultValue="user"
          aria-label={`${size} ${appearance}`}
        >
          <Dropdown.Option value="admin">Admin</Dropdown.Option>
          <Dropdown.Option value="user">User</Dropdown.Option>
        </Dropdown>
      )}
    />
  ),
};
```

Run the Dropdown tests and the stories gate for `Components/Input/Dropdown`.

```bash
git add src/components/input/Dropdown.tsx src/components/input/__tests__/Dropdown.test.tsx stories/Dropdown.stories.tsx
git commit -m "feat(input): Dropdown size and appearance"
```

#### Task B15: TagPicker

Implements spec §2.2 (TagPicker), D12.

**Files:** `src/components/input/TagPicker.tsx`, `__tests__/TagPicker.test.tsx`, `stories/TagPicker.stories.tsx`.

**Interfaces:**
- Produces: `export type TagPickerSize = Extract<Size, 'medium' | 'large' | 'extra-large'>`; `TagPickerProps.size?: TagPickerSize`, `TagPickerProps.appearance?: InputAppearance`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('sizes and appearances (Phase 4 D12)', () => {
  const OPTIONS = [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana' },
  ];
  const input = () => screen.getByRole('combobox', { name: 'Fruit' });
  const control = () => input().closest('[data-wave-tagpicker-control]') as HTMLElement;
  const tag = () => screen.getByRole('listitem');

  it('keeps the 0.7 classes at medium', () => {
    render(<TagPicker aria-label="Fruit" options={OPTIONS} defaultValue={['a']} />);
    expect(control()).toHaveClass('gap-1', 'px-2', 'py-1.5', 'border-input');
    expect(tag()).toHaveClass('px-2', 'py-0.5', 'text-body-1');
    expect(input()).toHaveClass('py-0.5', 'text-body-1');
    const root = input().closest('[data-size]') as HTMLElement;
    expect(root).toHaveAttribute('data-size', 'medium');
    expect(root).toHaveAttribute('data-appearance', 'outline');
  });

  it.each([
    ['large', ['gap-1.5', 'px-2.5', 'py-2'], ['px-2', 'py-1', 'text-body-1'], ['py-1', 'text-body-1']],
    ['extra-large', ['gap-1.5', 'px-3', 'py-2.5'], ['px-2.5', 'py-1', 'text-body-2'], ['py-1', 'text-body-2']],
  ] as const)('%s', (size, controlClasses, tagClasses, inputClasses) => {
    render(<TagPicker aria-label="Fruit" options={OPTIONS} defaultValue={['a']} size={size} />);
    expect(control()).toHaveClass(...controlClasses);
    expect(tag()).toHaveClass(...tagClasses);
    expect(input()).toHaveClass(...inputClasses);
  });

  it('a Field small falls back to medium; a Field large is large', () => {
    const { unmount } = renderWithFieldContext(<TagPicker options={OPTIONS} />, { size: 'small' });
    const first = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
    expect(first.closest('[data-size]')).toHaveAttribute('data-size', 'medium');
    unmount();
    renderWithFieldContext(<TagPicker options={OPTIONS} />, { size: 'large' });
    const second = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
    expect(second.closest('[data-size]')).toHaveAttribute('data-size', 'large');
  });

  it('the control takes the appearance', () => {
    render(<TagPicker aria-label="Fruit" options={OPTIONS} appearance="underline" />);
    expect(control()).toHaveClass('border-0', 'border-b', 'rounded-none');
  });

  it('types: TagPicker has no small size', () => {
    expectTypeOf<TagPickerProps['size']>().toEqualTypeOf<TagPickerSize | undefined>();
    // @ts-expect-error TagPicker has no small size
    render(<TagPicker aria-label="Fruit" options={OPTIONS} size="small" />);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
/** Sizes of TagPicker (Fluent's): medium (the 0.7 look), large and extra-large. */
export type TagPickerSize = Extract<Size, 'medium' | 'large' | 'extra-large'>;

const TAG_PICKER_SIZES: readonly TagPickerSize[] = ['medium', 'large', 'extra-large'];

/** Per-size classes of the control, the tags and the input (medium is the 0.7 look). */
const TAG_PICKER_SIZE: Readonly<
  Record<TagPickerSize, { control: string; tag: string; input: string }>
> = {
  medium: { control: 'gap-1 px-2 py-1.5', tag: 'px-2 py-0.5 text-body-1', input: 'py-0.5 text-body-1' },
  large: { control: 'gap-1.5 px-2.5 py-2', tag: 'px-2 py-1 text-body-1', input: 'py-1 text-body-1' },
  'extra-large': {
    control: 'gap-1.5 px-3 py-2.5',
    tag: 'px-2.5 py-1 text-body-2',
    input: 'py-1 text-body-2',
  },
};
```

`const { size, appearance } = useInputLook(sizeProp, appearanceProp, { sizes: TAG_PICKER_SIZES, defaultSize: 'medium' });`. The root renders the data attributes. The control's class list: `cn('flex flex-wrap items-center', TAG_PICKER_SIZE[size].control, inputAppearanceClasses[appearance], inputFocusWithin, invalidLook && inputInvalidWithin, disabled && 'cursor-not-allowed opacity-50')`. The tag: `cn('inline-flex items-center gap-1 rounded bg-muted text-foreground', TAG_PICKER_SIZE[size].tag)`. The input: `cn('min-w-15 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-hidden', TAG_PICKER_SIZE[size].input)`. The `size` JSDoc names the Fluent union and says a Field or provider `small` gives `medium`.

- [ ] **Step 4: Story, package checks, lead commits.**

```tsx
const FRUIT = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
];

export const SizesAndAppearances: Story = {
  render: (args) => (
    <div className="grid gap-4">
      {(['outline', 'underline', 'filled-darker', 'filled-lighter'] as const).map((appearance) => (
        <div
          key={appearance}
          className={
            appearance === 'filled-lighter'
              ? 'grid grid-cols-3 items-start gap-3 rounded bg-secondary p-3'
              : 'grid grid-cols-3 items-start gap-3 p-3'
          }
        >
          {(['medium', 'large', 'extra-large'] as const).map((size) => (
            <TagPicker
              {...args}
              key={size}
              size={size}
              appearance={appearance}
              options={FRUIT}
              defaultValue={['apple']}
              aria-label={`${size} ${appearance}`}
            />
          ))}
        </div>
      ))}
    </div>
  ),
};
```

(TagPicker's sizes differ from `CoreSize`, so it does not use `SizeAppearanceGrid`.) Run every P4-pickers test file, the stories gate for the five picker stories, the conventions gate for the seven source files, both typechecks, ESLint and Prettier.

```bash
git add src/components/input/TagPicker.tsx src/components/input/__tests__/TagPicker.test.tsx stories/TagPicker.stories.tsx
git commit -m "feat(input): TagPicker size and appearance"
```

### P4-choice — Checkbox, Switch, Slider

#### Task B16: Checkbox `size` and `shape`

Implements spec §2.3 (Checkbox), D14.

**Files:** `src/components/input/Checkbox.tsx`, `__tests__/Checkbox.test.tsx`, `stories/Checkbox.stories.tsx`.

**Interfaces:**
- Produces: `export type CheckboxSize = Extract<Size, 'medium' | 'large'>`; `export type CheckboxShape = Extract<Shape, 'square' | 'circular'>`; `CheckboxProps.size?: CheckboxSize` (default `'medium'`), `CheckboxProps.shape?: CheckboxShape` (default `'square'`).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('size and shape (Phase 4 D14)', () => {
  const box = () => screen.getByRole('checkbox', { name: 'Accept' });
  const root = () => box().closest('label') as HTMLElement;

  it('medium square is the 0.7 look, with its attributes', () => {
    render(<Checkbox label="Accept" defaultChecked />);
    expect(box()).toHaveClass('h-[18px]', 'w-[18px]', 'rounded-xs', 'mt-px');
    expect(box().querySelector('svg')).toHaveAttribute('width', '12');
    expect(root()).toHaveAttribute('data-size', 'medium');
    expect(root()).toHaveAttribute('data-shape', 'square');
  });

  it('large is a 22px box with a 16px glyph', () => {
    render(<Checkbox label="Accept" size="large" defaultChecked />);
    expect(box()).toHaveClass('h-[22px]', 'w-[22px]', '-mt-px');
    expect(box().querySelector('svg')).toHaveAttribute('width', '16');
    expect(root()).toHaveAttribute('data-size', 'large');
  });

  it('circular is round', () => {
    render(<Checkbox label="Accept" shape="circular" />);
    expect(box()).toHaveClass('rounded-full');
    expect(root()).toHaveAttribute('data-shape', 'circular');
  });

  it('ignores the Field size', () => {
    renderWithFieldContext(<Checkbox label="Accept" />, { size: 'large' });
    expect(screen.getByRole('checkbox').closest('label')).toHaveAttribute('data-size', 'medium');
  });

  it('types', () => {
    // @ts-expect-error Checkbox has no small size
    render(<Checkbox label="Accept" size="small" />);
    // @ts-expect-error Checkbox has no rounded shape
    render(<Checkbox label="Accept" shape="rounded" />);
  });
});
```

(The glyph `width` assertion follows `createIcon`'s output; check `src/lib/icons.tsx`.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.** Add the exported types and props (JSDoc: 18 or 22px box; square corners or round; "choice controls take no Field or provider size"). Module constants:

```ts
const CHECKBOX_SIZE: Readonly<Record<CheckboxSize, { box: string; glyph: number; offset: string }>> = {
  medium: { box: 'h-[18px] w-[18px]', glyph: 12, offset: 'mt-px' },
  large: { box: 'h-[22px] w-[22px]', glyph: 16, offset: '-mt-px' },
};
const CHECKBOX_SHAPE: Readonly<Record<CheckboxShape, string>> = {
  square: 'rounded-xs',
  circular: 'rounded-full',
};
```

The root `<label>` renders `data-size={size} data-shape={shape}` next to `data-label-position` (before `{...rest}`). The button's first class string becomes `cn('flex shrink-0 items-center justify-center border p-0 transition-colors motion-reduce:transition-none', CHECKBOX_SIZE[size].box, CHECKBOX_SHAPE[shape])`, the label offset `hasLabel && CHECKBOX_SIZE[size].offset`, and the glyphs `size={CHECKBOX_SIZE[size].glyph}`.

- [ ] **Step 4: Story, run, lead commits.**

```tsx
export const SizesAndShapes: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-3">
      {(['medium', 'large'] as const).flatMap((size) =>
        (['square', 'circular'] as const).map((shape) => (
          <Checkbox
            {...args}
            key={`${size}-${shape}`}
            size={size}
            shape={shape}
            defaultChecked={shape === 'square'}
            label={`${size} ${shape}`}
          />
        )),
      )}
    </div>
  ),
};
```

```bash
git add src/components/input/Checkbox.tsx src/components/input/__tests__/Checkbox.test.tsx stories/Checkbox.stories.tsx
git commit -m "feat(input): Checkbox size and shape"
```

#### Task B17: Switch `size`

Implements spec §2.3 (Switch), D14.

**Files:** `src/components/input/Switch.tsx`, `__tests__/Switch.test.tsx`, `stories/Switch.stories.tsx`.

**Interfaces:** Produces `export type SwitchSize = Extract<Size, 'small' | 'medium'>`; `SwitchProps.size?: SwitchSize` (default `'medium'`).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('size (Phase 4 D14)', () => {
  const control = () => screen.getByRole('switch', { name: 'Wi-Fi' });
  const thumb = () => control().firstElementChild as HTMLElement;

  it('medium is the 0.7 look', () => {
    render(<Switch label="Wi-Fi" defaultChecked />);
    expect(control()).toHaveClass('h-[20px]', 'w-[40px]');
    expect(thumb()).toHaveClass('h-[14px]', 'w-[14px]', 'translate-x-[22px]', 'wave-rtl:-translate-x-[22px]');
    expect(control().closest('label')).toHaveAttribute('data-size', 'medium');
  });

  it('small: 32×16 track, 10px thumb, 24px-tall target layer, centred on the label line', () => {
    const { rerender } = render(<Switch label="Wi-Fi" size="small" />);
    expect(control()).toHaveClass('h-[16px]', 'w-[32px]', 'mt-0.5', 'before:-inset-y-1', 'before:inset-x-0');
    expect(thumb()).toHaveClass('h-[10px]', 'w-[10px]', 'translate-x-[2px]', 'wave-rtl:-translate-x-[2px]');
    rerender(<Switch label="Wi-Fi" size="small" checked onCheckedChange={() => {}} />);
    expect(thumb()).toHaveClass('translate-x-[18px]', 'wave-rtl:-translate-x-[18px]');
  });

  it('mirrors the small thumb in RTL through the wave-rtl classes', () => {
    renderWithProviders(<Switch label="Wi-Fi" size="small" defaultChecked />, { dir: 'rtl' });
    expect(thumb()).toHaveClass('wave-rtl:-translate-x-[18px]');
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
const SWITCH_SIZE: Readonly<Record<SwitchSize, { track: string; thumb: string; on: string; off: string; offset: string }>> = {
  small: {
    track: 'h-[16px] w-[32px] before:absolute before:inset-x-0 before:-inset-y-1',
    thumb: 'h-[10px] w-[10px]',
    on: 'translate-x-[18px] wave-rtl:-translate-x-[18px]',
    off: 'translate-x-[2px] wave-rtl:-translate-x-[2px]',
    offset: 'mt-0.5',
  },
  medium: {
    track: 'h-[20px] w-[40px]',
    thumb: 'h-[14px] w-[14px]',
    on: 'translate-x-[22px] wave-rtl:-translate-x-[22px]',
    off: 'translate-x-[2px] wave-rtl:-translate-x-[2px]',
    offset: '',
  },
};
```

Keep each `translate-x` class and its `wave-rtl:` counterpart in one string (the conventions gate requires the pair on the same line). The root renders `data-size`. The track: `cn('relative inline-flex shrink-0 items-center rounded-full border p-0 transition-colors duration-200 motion-reduce:transition-none', SWITCH_SIZE[size].track, hasLabel && SWITCH_SIZE[size].offset, …)` (keep the 0.7 comment about px sizing, updated for two sizes); the thumb: `cn('block rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none', SWITCH_SIZE[size].thumb, checked ? cn(SWITCH_SIZE[size].on, 'bg-primary-foreground') : cn(SWITCH_SIZE[size].off, 'bg-stroke-accessible'), …)`. The label-position layout is unchanged.

- [ ] **Step 4: Story, run, lead commits.**

```tsx
export const Sizes: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-3">
      {(['small', 'medium'] as const).flatMap((size) =>
        [false, true].map((on) => (
          <Switch
            {...args}
            key={`${size}-${on}`}
            size={size}
            defaultChecked={on}
            label={`${size} ${on ? 'on' : 'off'}`}
          />
        )),
      )}
    </div>
  ),
};
```

```bash
git add src/components/input/Switch.tsx src/components/input/__tests__/Switch.test.tsx stories/Switch.stories.tsx
git commit -m "feat(input): Switch size"
```

#### Task B18: Slider `size` and the numeric `size`

Implements spec §2.3 (Slider), D10, D14.

**Files:** `src/components/input/Slider.tsx`, `__tests__/Slider.test.tsx`, `stories/Slider.stories.tsx`.

**Interfaces:** Produces `export type SliderSize = Extract<Size, 'small' | 'medium'>`; `SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>` with `size?: SliderSize | number`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('size (Phase 4 D10, D14)', () => {
  const slider = () => screen.getByRole('slider', { name: 'Volume' });

  it('medium is the 0.7 look', () => {
    render(<Slider aria-label="Volume" />);
    expect(slider()).toHaveClass(
      '[&::-webkit-slider-thumb]:h-5',
      '[&::-webkit-slider-runnable-track]:h-1',
      '[&::-webkit-slider-thumb]:-mt-2',
    );
    expect(slider()).toHaveAttribute('data-size', 'medium');
  });

  it('small: a 16px thumb on a 2px rail in a 24px-tall input', () => {
    render(<Slider aria-label="Volume" size="small" />);
    expect(slider()).toHaveClass(
      'h-6',
      '[&::-webkit-slider-thumb]:h-4',
      '[&::-webkit-slider-thumb]:w-4',
      '[&::-webkit-slider-thumb]:-mt-1.75',
      '[&::-webkit-slider-runnable-track]:h-0.5',
      '[&::-moz-range-thumb]:h-4',
      '[&::-moz-range-track]:h-0.5',
      '[&::-moz-range-progress]:h-0.5',
    );
  });

  it('a numeric size renders nothing and is reported once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Slider aria-label="Volume" size={3} />);
    expect(slider()).not.toHaveAttribute('size');
    expect(slider()).toHaveAttribute('data-size', 'medium');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[WaveUI] Slider: a numeric `size` has no effect (a range input ignores the native attribute) and is removed in 1.0; remove it.',
    );
  });

  it('types', () => {
    expectTypeOf<SliderProps['size']>().toEqualTypeOf<SliderSize | number | undefined>();
    // @ts-expect-error Slider has no large size
    render(<Slider aria-label="Volume" size="large" />);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.** Split `railClasses` and the thumb strings into per-size maps: medium keeps the 0.7 strings exactly, and small substitutes `h-0.5` for the rail and progress heights and `h-4 w-4` with `-mt-1.75` for the thumb (each `[&::…]` variant written out literally, since the scanner needs whole class names). The input's classes gain `size === 'small' && 'h-6'`. Destructure `size: sizeProp`: `const size: SliderSize = sizeProp === 'small' ? 'small' : 'medium';`, render `data-size={size}` before the spreads, and report a number from an effect:

```ts
  const numericSize = typeof sizeProp === 'number';
  React.useEffect(() => {
    if (numericSize) {
      warnOnce(
        'Slider:size-number',
        'Slider: a numeric `size` has no effect (a range input ignores the native attribute) and is removed in 1.0; remove it.',
      );
    }
  }, [numericSize]);
```

The number never reaches the `<input>` (it was part of `...props` in 0.7).

- [ ] **Step 4: Story, package checks, lead commits.**

```tsx
export const Sizes: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <Slider {...args} size="small" defaultValue={30} aria-label="Small volume" />
      <Slider {...args} size="medium" defaultValue={60} aria-label="Medium volume" />
    </div>
  ),
};
```

Run the P4-choice test files, the stories gate for the three stories, the conventions gate for the three sources, both typechecks, ESLint and Prettier.

```bash
git add src/components/input/Slider.tsx src/components/input/__tests__/Slider.test.tsx stories/Slider.stories.tsx
git commit -m "feat(input): Slider size"
```

### P4-rating — Rating, RatingDisplay, RatingItem

#### Task B19: The Rating context, the compounds and `RatingItem` (no visual change)

Implements D26's structure (spec §2 P4-03 "Structure"). A pure refactor: every 0.7 Rating and RatingDisplay test stays green unchanged, and the DOM of `step={1}` and of RatingDisplay is identical.

**Files:**
- Create: `src/components/input/Rating.item.tsx`
- Modify: `src/components/input/Rating.tsx`
- Test: `src/components/input/__tests__/Rating.test.tsx` (create `__tests__/Rating.item.test.tsx` if the file grows past ~1,500 lines)

**Interfaces:**
- Produces (in `Rating.item.tsx`, internal except `RatingItem` and its props):
  - `RatingContextValue` (internal): `{ kind: 'input' | 'display'; value: number; drawnValue: number; step: 0.5 | 1; max: number; size: Size; color: RatingColor; iconFilled?: Slot<'span'>; iconOutline?: Slot<'span'>; disabled: boolean; starLabel: (value: number, max: number) => string; getTabIndex: (key: string) => number; choose: (value: number, focus: boolean) => void; preview: (value: number) => void; registerItem: (value: number) => () => void }`
  - `RatingContext` (default `null`), `useRatingContext(): RatingContextValue` (reports a missing root and returns an inert display value)
  - `export type RatingColor = 'neutral' | 'brand' | 'marigold'`
  - `export interface RatingItemProps extends Omit<React.HTMLAttributes<HTMLElement>, 'role' | 'aria-checked' | 'aria-label' | 'aria-labelledby' | 'tabIndex' | 'children' | 'onChange'> { value: number; iconFilled?: Slot<'span'>; iconOutline?: Slot<'span'>; ref?: React.Ref<HTMLElement> }`
  - `export const RatingItem`
- `Rating.tsx` exports `Rating` and `RatingDisplay` as compounds (`Rating.Item === RatingDisplay.Item === RatingItem`) and re-exports `RatingItem`, `RatingItemProps`, `RatingColor`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { Rating, RatingDisplay, RatingItem } from '../Rating';
import { asClientReference, expectThrows, testCompoundExposure } from '../../../test-utils';

describe('RatingItem and the compounds (Phase 4 D26)', () => {
  testCompoundExposure(Rating, ['Item']);
  testCompoundExposure(RatingDisplay, ['Item']);

  it('is the same part on both roots and flat', () => {
    expect(Rating.Item).toBe(RatingItem);
    expect(RatingDisplay.Item).toBe(RatingItem);
  });

  it('children replace the generated stars, and behave like them', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Rating aria-label="Service" max={3} onValueChange={onValueChange}>
        <Rating.Item value={1} />
        <Rating.Item value={2} />
        <Rating.Item value={3} />
      </Rating>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await user.click(screen.getByRole('radio', { name: '2 stars' }));
    expect(onValueChange).toHaveBeenCalledWith(2);
  });

  it('children as client references render the same markup', () => {
    const Item = asClientReference(RatingItem);
    const plain = renderToString(
      <Rating aria-label="Service" max={2} defaultValue={1}>
        <RatingItem value={1} />
        <RatingItem value={2} />
      </Rating>,
    );
    const reference = renderToString(
      <Rating aria-label="Service" max={2} defaultValue={1}>
        <Item value={1} />
        <Item value={2} />
      </Rating>,
    );
    expect(reference).toBe(plain);
  });

  it('throws outside a rating in development', () => {
    expectThrows(
      <RatingItem value={1} />,
      '[WaveUI] Rating.Item must be used within a rating (Rating or RatingDisplay)',
    );
  });
});
```

(Import `renderToString` from `react-dom/server`. Check `reportMissingContext`'s exact message format in `src/lib/dev.ts` and match it.)

- [ ] **Step 2: Run to verify it fails.** `npx vitest run src/components/input/__tests__/Rating.test.tsx --reporter=default`. Expected: FAIL: `Rating.Item` is undefined.

- [ ] **Step 3: Implement**

`Rating.item.tsx` holds the context, the glyph and the item. Its core:

```tsx
export type RatingColor = 'neutral' | 'brand' | 'marigold';

/** Filled-star color of each `color` (unfilled stars keep the 3:1 outline token). */
export const FILLED_COLOR: Readonly<Record<RatingColor, string>> = {
  marigold: 'text-rating',
  brand: 'text-primary',
  neutral: 'text-foreground',
};

export const RatingContext = React.createContext<RatingContextValue | null>(null);

const INERT: RatingContextValue = {
  kind: 'display',
  value: 0,
  drawnValue: 0,
  step: 1,
  max: 5,
  size: 'medium',
  color: 'marigold',
  disabled: true,
  starLabel: () => '',
  getTabIndex: () => -1,
  choose: () => {},
  preview: () => {},
  registerItem: () => () => {},
};

export function useRatingContext(): RatingContextValue {
  const context = React.useContext(RatingContext);
  if (context) return context;
  reportMissingContext('Rating.Item', 'a rating (Rating or RatingDisplay)');
  return INERT;
}
```

Move the 0.7 `Star`, `sizeMap` and `targetPaddingMap` here. `RatingItem` renders by `kind` and `step`:
- **display** (RatingDisplay): exactly 0.7's per-star `<span>`: filled, empty, or the partial star with the `style={{ width: `${percent}%` }}` clip. The fraction is `Math.round(Math.min(1, Math.max(0, drawnValue - (value - 1))) * 100)`. `ref` and `rest` go on that outer span.
- **input, step 1** (Rating): exactly 0.7's `<button type="button" role="radio" …>` for the star, with the color class on the button and the `Star` inside. The order is: `{...rest}` first, then `role="radio"`, `aria-checked={ctx.value === value}`, `aria-label={ctx.starLabel(value, ctx.max)}`, `data-roving-value={String(value)}`, `tabIndex={ctx.disabled ? -1 : ctx.getTabIndex(String(value))}`, `disabled={ctx.disabled}`, `onClick={composeEventHandlers(onClick, () => { if (!ctx.disabled) ctx.choose(value, false); })}` and `onMouseEnter={composeEventHandlers(onMouseEnter, () => { if (!ctx.disabled) ctx.preview(value); })}`.
- **input, step 0.5**: Task B21.

Each item registers its value: `React.useLayoutEffect(() => ctx.registerItem(value), [ctx.registerItem, value]);` (Task B22 uses the registry).

In `Rating.tsx`:
- `RatingRoot` keeps the 0.7 radiogroup and key handling. It provides a memoized context (`kind: 'input'`, `value`, `drawnValue: disabled ? value : hovered || value`, `step: 1` for now, `max`, `size`, `color: 'marigold'`, `disabled`, `starLabel`, `getTabIndex`, `choose: (v) => setValue(v)`, `preview: setHovered`, `registerItem`). It renders `slotRendersContent(children) ? children : Array.from({ length: max }, (_, i) => <RatingItem key={i + 1} value={i + 1} />)` inside the provider, then the `HiddenInput`. Destructure `children` so the 0.7 spread no longer hides it.
- `RatingDisplayRoot` provides `kind: 'display'`, `drawnValue: value`, and renders the children or the generated items, except in `compact` mode, which keeps its one filled star and ignores `children`.
- Exports:

```tsx
RatingRoot.displayName = 'Rating';
RatingDisplayRoot.displayName = 'RatingDisplay';
RatingItem.displayName = 'Rating.Item';

/** (the 0.7 component JSDoc of Rating, moved here, plus the Item and children sentences) */
export const Rating = /* @__PURE__ */ Object.assign(RatingRoot, { Item: RatingItem });
/** (the 0.7 JSDoc of RatingDisplay, moved here) */
export const RatingDisplay = /* @__PURE__ */ Object.assign(RatingDisplayRoot, { Item: RatingItem });
export { RatingItem, type RatingItemProps, type RatingColor } from './Rating.item';
```

Choose the displayName of `RatingItem` to match the part name the warnings use (`Rating.Item`), and check how other compounds name shared parts (`Option`) before settling. The roots carry no docblock of their own (C-DOCS: the compound's JSDoc sits only on the assigned const).

- [ ] **Step 4: Run to verify it passes.** Run the whole Rating test file; every 0.7 test must pass unchanged. Run the conventions gate for `Rating.tsx` and `Rating.item.tsx`. Expected: PASS.

- [ ] **Step 5: Lead commits**

```bash
git add src/components/input/Rating.tsx src/components/input/Rating.item.tsx src/components/input/__tests__/Rating.test.tsx
git commit -m "refactor(input): Rating context and the Rating.Item part"
```

#### Task B20: `color` and the icon pair

Implements D24, D25.

**Files:** `Rating.tsx`, `Rating.item.tsx`, `__tests__/Rating.test.tsx`.

**Interfaces:**
- Produces: `RatingProps.color?: RatingColor` and `RatingDisplayProps.color?: RatingColor` (both interfaces add `'color'` to their `Omit` of the HTML attributes); `iconFilled?`/`iconOutline?: Slot<'span'>` on `RatingProps`, `RatingDisplayProps` and `RatingItemProps`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('color and icons (Phase 4 D24, D25)', () => {
  const HeartFilled = () => <svg data-testid="heart-filled" />;
  const HeartOutline = () => <svg data-testid="heart-outline" />;

  it('marigold is the default; the root renders data-color', () => {
    render(<Rating aria-label="Service" defaultValue={2} />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-color', 'marigold');
    expect(screen.getByRole('radio', { name: '1 star' })).toHaveClass('text-rating');
    expect(screen.getByRole('radio', { name: '3 stars' })).toHaveClass('text-stroke-accessible');
  });

  it.each([
    ['brand', 'text-primary'],
    ['neutral', 'text-foreground'],
  ] as const)('%s fills with %s and keeps the outline token', (color, filled) => {
    render(<Rating aria-label="Service" defaultValue={1} color={color} />);
    expect(screen.getByRole('radio', { name: '1 star' })).toHaveClass(filled);
    expect(screen.getByRole('radio', { name: '2 stars' })).toHaveClass('text-stroke-accessible');
  });

  it('an unknown color from untyped code renders as marigold', () => {
    render(<Rating aria-label="Service" color={'red' as never} />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-color', 'marigold');
  });

  it('RatingDisplay takes the color too, and keeps continuous partial fills', () => {
    const { container } = render(<RatingDisplay value={4.6} color="brand" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-color', 'brand');
    const clip = container.querySelector('[style*="width"]') as HTMLElement;
    expect(clip).toHaveStyle({ width: '60%' });
    expect(clip).toHaveClass('text-primary');
  });

  it('renders a custom icon pair, decorative', () => {
    render(
      <Rating
        aria-label="Love"
        defaultValue={1}
        max={2}
        iconFilled={<HeartFilled />}
        iconOutline={<HeartOutline />}
      />,
    );
    expect(screen.getByTestId('heart-filled').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByTestId('heart-outline')).toBeInTheDocument();
  });

  it("an item's own pair wins over the group's", () => {
    render(
      <Rating aria-label="Love" max={1} defaultValue={1} iconFilled={<HeartFilled />} iconOutline={<HeartOutline />}>
        <Rating.Item value={1} iconFilled={<svg data-testid="own" />} iconOutline={<HeartOutline />} />
      </Rating>,
    );
    expect(screen.getByTestId('own')).toBeInTheDocument();
    expect(screen.queryByTestId('heart-filled')).toBeNull();
  });

  it('one icon of the pair warns once; an empty slot keeps the star and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Rating aria-label="Love" iconFilled={<HeartFilled />} />);
    render(<RatingDisplay value={1} iconFilled={[]} iconOutline={<HeartOutline />} />);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[WaveUI] Rating: pass both `iconFilled` and `iconOutline`: with only one of them, the other is the default star.',
      '[WaveUI] RatingDisplay: `iconFilled` renders nothing, so the default star is used.',
    ]);
  });

  it('unwraps a button passed as an icon, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Rating
        aria-label="Love"
        max={1}
        iconFilled={<button type="button">♥</button>}
        iconOutline={<HeartOutline />}
      />,
    );
    expect(screen.getByRole('radio').querySelector('button')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[WaveUI] Rating: `iconFilled` received a button element; its children render as the glyph of the star and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `iconFilled={<MyIcon />}`.',
    );
  });

  it('types: color narrows the inherited HTML attribute', () => {
    expectTypeOf<RatingProps['color']>().toEqualTypeOf<RatingColor | undefined>();
    // @ts-expect-error not a rating color
    render(<Rating aria-label="Service" color="red" />);
  });
});
```

(`unwrapButtonGlyph` names what it unwrapped, `'a button element'` or `'a slot object that renders a button'`. Assert the full message: `'[WaveUI] Rating: `iconFilled` received a button element; its children render as the glyph of the star and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `iconFilled={<MyIcon />}`.'`, the same shape as `Combobox.expand.tsx`'s `expandIcon` message.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement**
- Props and JSDoc: `color` ("Color of the filled stars: `marigold` (default), `brand` or `neutral`; unfilled stars keep a 3:1 outline. Fluent's default is `neutral`."), and `iconFilled`/`iconOutline` ("The glyphs of a filled and an unfilled star, as a pair; decorative. Fluent's RatingDisplay takes one `icon`; here a filled and an unfilled star must differ by shape, not by color alone.").
- Resolve the color: `const resolvedColor: RatingColor = color === 'brand' || color === 'neutral' ? color : 'marigold';`, then `data-color={resolvedColor}` on the root (before `{...rest}`) and `color: resolvedColor` in the context.
- Glyph resolution in `Rating.item.tsx`:

```tsx
/** The filled and outline glyph content for a star (C-SLOTS required indicators, D25). */
function resolveGlyphs(
  iconFilled: Slot<'span'> | undefined,
  iconOutline: Slot<'span'> | undefined,
): { filled: React.ReactNode | null; outline: React.ReactNode | null; buttonSlot: string | null } {
  const filled = unwrapButtonGlyph(iconFilled);
  const outline = unwrapButtonGlyph(iconOutline);
  return {
    filled: filled.glyph != null && slotRendersContent(filled.glyph) ? filled.glyph : null,
    outline: outline.glyph != null && slotRendersContent(outline.glyph) ? outline.glyph : null,
    buttonSlot: filled.button ? 'iconFilled' : outline.button ? 'iconOutline' : null,
  };
}
```

`null` means the default `Star`. A custom glyph renders as `renderSlot(content, 'span', cn('inline-flex shrink-0 [&>svg]:size-full', starSize), { 'aria-hidden': true })`. The partial star clips the custom filled glyph over the custom outline glyph, exactly as the default stars.
- Warnings, from an effect in each component that owns the props (Rating, RatingDisplay, RatingItem; the key and prefix are the component's name, `Rating.Item` for the item): the pair (one of the two set, the other `undefined`), `-empty` (a slot set but rendering nothing), `-button` (unwrapped). Messages: `'<Name>: pass both `iconFilled` and `iconOutline`: with only one of them, the other is the default star.'`, `'<Name>: `iconFilled` renders nothing, so the default star is used.'`, and the unwrap message on `Combobox.expand.tsx`'s pattern.
- Filled color: `FILLED_COLOR[ctx.color]` wherever 0.7 used `text-rating`; unfilled stays `text-stroke-accessible`.

- [ ] **Step 4: Run to verify it passes; lead commits**

```bash
git add src/components/input/Rating.tsx src/components/input/Rating.item.tsx src/components/input/__tests__/Rating.test.tsx
git commit -m "feat(input): Rating and RatingDisplay color and custom icons"
```

#### Task B21: Half stars and keys by step

Implements D22, D23. Guards: one 24×24px pointer target per star, two visually hidden radios per star (spec P4-03 Guards).

**Files:** `Rating.tsx`, `Rating.item.tsx`, `__tests__/Rating.test.tsx`.

**Interfaces:** Produces `RatingProps.step?: 0.5 | 1` (default `1`).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('half stars (Phase 4 D22, D23)', () => {
  const star3 = () => screen.getByRole('radio', { name: '3 stars' }).parentElement as HTMLElement;
  const clickAt = (el: HTMLElement, fraction: number) => {
    mockRect(el, { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    fireEvent.click(el, { clientX: 100 + fraction * 24, clientY: 12, detail: 1 });
  };

  it('renders two radios per star, over their halves, named by labels.star', () => {
    render(<Rating aria-label="Service" step={0.5} max={5} />);
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    const half = screen.getByRole('radio', { name: '2.5 stars' });
    const full = screen.getByRole('radio', { name: '3 stars' });
    expect(half).toHaveClass('absolute', 'inset-y-0', 'start-0', 'w-1/2', 'opacity-0', 'pointer-events-none');
    expect(full).toHaveClass('end-0');
    expect(half.parentElement).toBe(full.parentElement);
    expect(star3()).toHaveClass('has-focus-visible:outline-2');
  });

  it('a pointer click chooses by position and focuses the chosen radio', () => {
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />);
    clickAt(star3(), 0.25);
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
    expect(screen.getByRole('radio', { name: '2.5 stars' })).toHaveFocus();
    clickAt(star3(), 0.75);
    expect(onValueChange).toHaveBeenLastCalledWith(3);
  });

  it('mirrors the halves in RTL', () => {
    const onValueChange = vi.fn();
    renderWithProviders(<Rating aria-label="Service" step={0.5} onValueChange={onValueChange} />, {
      dir: 'rtl',
    });
    clickAt(star3(), 0.25); // the physical left is the inline end in RTL
    expect(onValueChange).toHaveBeenLastCalledWith(3);
  });

  it.each(['ltr', 'rtl'] as const)(
    'Space, Enter and a radio click choose the radio own value (%s)',
    async (dir) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderWithProviders(
        <Rating aria-label="Service" step={0.5} defaultValue={2} onValueChange={onValueChange} />,
        { dir },
      );
      const three = screen.getByRole('radio', { name: '3 stars' });
      act(() => three.focus());
      await user.keyboard(' ');
      expect(onValueChange).toHaveBeenLastCalledWith(3);
      fireEvent.click(screen.getByRole('radio', { name: '1.5 stars' }));
      expect(onValueChange).toHaveBeenLastCalledWith(1.5);
    },
  );

  it('keys move by step; Home is step; End is max; no wrap and no clear', async () => {
    const user = userEvent.setup();
    render(<Rating aria-label="Service" step={0.5} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '0.5 stars' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '1 star' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}{Home}');
    expect(screen.getByRole('radio', { name: '0.5 stars' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '0.5 stars' })).toHaveAttribute('aria-checked', 'true');
  });

  it('snaps an off-grid controlled value; its tab stop is the lower radio', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} value={2.7} onValueChange={onValueChange} />);
    expect(screen.getByRole('radio', { name: '2.5 stars' })).toHaveAttribute('tabindex', '0');
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
  });

  it('previews halves under the mouse and clears on leave', () => {
    render(<Rating aria-label="Service" step={0.5} />);
    mockRect(star3(), { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
    fireEvent.pointerMove(star3(), { clientX: 104, pointerType: 'mouse' });
    expect(star3().querySelector('[style*="width"]')).toHaveStyle({ width: '50%' });
    fireEvent.mouseLeave(screen.getByRole('radiogroup'));
    expect(star3().querySelector('[style*="width"]')).toBeNull();
  });

  it('submits 2.5, fires once per change in StrictMode, and passes axe', async () => {
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <form aria-label="Review">
          <Rating aria-label="Service" step={0.5} name="stars" onValueChange={onValueChange} />
        </form>
      </React.StrictMode>,
    );
    clickAt(star3(), 0.25);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const form = screen.getByRole('form', { name: 'Review' }) as HTMLFormElement;
    expect(new FormData(form).get('stars')).toBe('2.5');
    await expectNoA11yViolations();
  });

  it('keeps each star one 24×24px target (the 0.7 padding)', () => {
    render(<Rating aria-label="Service" step={0.5} />);
    expect(star3()).toHaveClass('p-0.5');
  });

  it('disabled: every radio is disabled and a pointer click chooses nothing', () => {
    const onValueChange = vi.fn();
    render(<Rating aria-label="Service" step={0.5} disabled onValueChange={onValueChange} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    clickAt(star3(), 0.25);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('types: step is 0.5 or 1', () => {
    // @ts-expect-error quarter stars are not supported
    render(<Rating aria-label="Service" step={0.25} />);
  });
});
```

(Import `mockRect` and `expectNoA11yViolations` from the test utils and `renderWithProviders`. `step={1}` keeps every 0.7 test unchanged.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement**

In `RatingRoot`:
- `step` prop (JSDoc: half stars; "each star stays one 24×24px pointer target: the half is chosen by the pointer's position over it, and two visually hidden radios per star serve the keyboard and screen readers"). Put `step` in the context.
- Keys (replace 0.7's `± 1`):

```ts
  // Snap to the step grid: an off-grid controlled value moves to the next grid value.
  const up = (v: number) => Math.floor(v / step) * step + step;
  const down = (v: number) => Math.ceil(v / step) * step - step;
  // … in handleKeyDown: Home → step, End → max, ArrowUp/next → up(value), ArrowDown/previous → down(value)
  // then the 0.7 guards: next = Math.min(next, max); if (disabled || next < step || next === value) return;
```

- Roving: `activeValue: value >= step ? String(Math.floor(value / step) * step) : null`.
- `choose(v, focus)`: `setValue(v)`, plus `focusValue(String(v))` when `focus` is set.

In `RatingItem` (input kind, `step === 0.5`):

```tsx
    const half = value - 0.5;
    const fraction = drawn >= value ? 1 : drawn >= half ? 0.5 : 0; // drawn = ctx.drawnValue
    const pick = (event: React.MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const fromStart =
        getDirection(event.currentTarget) === 'rtl'
          ? rect.right - event.clientX
          : event.clientX - rect.left;
      return fromStart < rect.width / 2 ? half : value;
    };
    return (
      <span
        {...rest}
        ref={ref}
        data-rating-star=""
        className={cn(
          'relative inline-flex cursor-pointer rounded',
          targetPaddingMap[ctx.size],
          'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
          ctx.disabled && 'cursor-not-allowed',
          className,
        )}
        onClick={composeEventHandlers(onClick, (event) => {
          // Keyboard and screen-reader activation click a radio, which chooses its own value.
          if (ctx.disabled || event.detail === 0 || (event.target as Element).closest('[role="radio"]')) return;
          ctx.choose(pick(event), true);
        })}
        onPointerMove={composeEventHandlers(onPointerMove, (event) => {
          if (!ctx.disabled && event.pointerType === 'mouse') ctx.preview(pick(event));
        })}
      >
        <StarGlyph fraction={fraction} /* size, color, icons as in Task B20 */ />
        {[half, value].map((radioValue, index) => (
          <button
            key={radioValue}
            type="button"
            role="radio"
            aria-checked={ctx.value === radioValue}
            aria-label={ctx.starLabel(radioValue, ctx.max)}
            data-roving-value={String(radioValue)}
            tabIndex={ctx.disabled ? -1 : ctx.getTabIndex(String(radioValue))}
            disabled={ctx.disabled}
            className={cn(
              'pointer-events-none absolute inset-y-0 w-1/2 border-0 bg-transparent p-0 opacity-0',
              index === 0 ? 'start-0' : 'end-0',
            )}
            onClick={() => {
              if (!ctx.disabled) ctx.choose(radioValue, false);
            }}
          />
        ))}
      </span>
    );
```

(`StarGlyph` is the Task B20 renderer, taking the fraction; at 0.5 it clips the filled glyph to 50% from the inline start. `getDirection` comes from `src/lib/direction`, `composeEventHandlers` from `src/lib/composeEventHandlers`. The radios have `type="button"` (C-BUTTON-TYPE) and no visible content.)

- [ ] **Step 4: Run to verify it passes; lead commits.** Run the Rating tests (every 0.7 test included).

```bash
git add src/components/input/Rating.tsx src/components/input/Rating.item.tsx src/components/input/__tests__/Rating.test.tsx
git commit -m "feat(input): Rating half stars"
```

#### Task B22: Item value checks and the Rating stories

Implements D26's value checks (C-DEV) and the P4-03 stories.

**Files:** `Rating.tsx`, `Rating.item.tsx`, `__tests__/Rating.test.tsx`, `stories/Rating.stories.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('item value checks (Phase 4 D26)', () => {
  it('warns once per duplicated value, per value outside 1…max and for a missing value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Rating aria-label="Service" max={3}>
        <Rating.Item value={1} />
        <Rating.Item value={1} />
        <Rating.Item value={4} />
      </Rating>,
    );
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[WaveUI] Rating.Item: two items have the value 1; give each star a unique value from 1 to max.',
      '[WaveUI] Rating.Item: the value 4 is not a whole number from 1 to 3.',
      '[WaveUI] Rating.Item: no item has the value 2; pass one Rating.Item per value from 1 to max.',
    ]);
  });

  it('generated stars never warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Rating aria-label="Service" max={7} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('outside a root in production: logs once and renders an empty display star', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<RatingItem value={1} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});
```

(Production-mode checks: follow `docs/testing-best-practices.md` §8. Match the console method and message `reportMissingContext` uses in production.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.** The roots keep a registry in a ref (`Map<number, number>`, value to count): `registerItem(value)` increments the count and returns a cleanup that decrements it. It is written in the items' layout effects and read in the root's passive effect, which runs after every layout effect of the commit (C-HOOKS: no ref read during render). The effect warns with `warnOnce` using the keys `Rating.Item:duplicate:<value>`, `Rating.Item:value:<value>` and `Rating.Item:missing`, and the messages the test asserts. The missing check runs only when the root renders `children`. `registerItem` is stable (`useCallback` with no dependencies), so the memoized context keeps its identity.

- [ ] **Step 4: Stories.** In `stories/Rating.stories.tsx`:

```tsx
const Heart = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
    <path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12C19 16.6 12 21 12 21z" />
  </svg>
);

export const HalfStars: Story = { args: { 'aria-label': 'Service', step: 0.5, defaultValue: 3.5 } };

export const Colors: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {(['marigold', 'brand', 'neutral'] as const).map((color) => (
        <div key={color} className="flex items-center gap-4">
          <Rating {...args} color={color} defaultValue={3} aria-label={`${color} rating`} />
          <RatingDisplay color={color} value={3.6} showValue />
        </div>
      ))}
    </div>
  ),
};

export const CustomIcons: Story = {
  render: (args) => (
    <Rating
      {...args}
      aria-label="Love"
      defaultValue={2}
      iconFilled={<Heart filled />}
      iconOutline={<Heart filled={false} />}
    />
  ),
};

export const CustomItems: Story = {
  render: (args) => (
    <Rating {...args} aria-label="Mood" max={3} defaultValue={2}>
      <Rating.Item value={1} iconFilled={<Heart filled />} iconOutline={<Heart filled={false} />} />
      <Rating.Item value={2} />
      <Rating.Item value={3} />
    </Rating>
  ),
};
```

(The SVG paints with `currentColor`, so it is not a raw color; no `wave-allow-color` marker is needed.)

- [ ] **Step 5: Package checks; lead commits.** The Rating tests, the stories gate for `Components/Input/Rating`, the conventions gate for `Rating.tsx` and `Rating.item.tsx`, both typechecks, ESLint and Prettier.

```bash
git add src/components/input/Rating.tsx src/components/input/Rating.item.tsx src/components/input/__tests__/Rating.test.tsx stories/Rating.stories.tsx
git commit -m "feat(input): Rating.Item value checks; Rating stories"
```

### P4-labels — Field, Label, InfoLabel, InfoButton

#### Task B23: The label marker and Label's `required` content

Implements D27 and the marker module of spec §2 P4-04.

**Files:**
- Create: `src/components/input/fieldLabel.ts`, `src/components/input/__tests__/fieldLabel.test.tsx`
- Modify: `src/components/input/Label.tsx`, `src/components/input/__tests__/Label.test.tsx`

**Interfaces:**
- Produces: `FIELD_LABEL: symbol`; `markFieldLabel<T extends object>(component: T): T`; `isFieldLabelElement(node: React.ReactNode): node is React.ReactElement<FieldLabelElementProps>`; `FieldLabelElementProps = { id?: string; htmlFor?: string; required?: boolean | React.ReactNode; size?: CoreSize; weight?: TextWeight; className?: string }`; `LabelProps.required?: boolean | React.ReactNode`; `LabelProps.size?: CoreSize`.

- [ ] **Step 1: Write the failing tests**

`fieldLabel.test.tsx`:

```tsx
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { isFieldLabelElement, markFieldLabel } from '../fieldLabel';
import { Label } from '../Label';
import { asClientReference } from '../../../test-utils';

describe('field label marker (Phase 4 D32)', () => {
  it('recognizes a marked component, also as a client reference', () => {
    const Marked = markFieldLabel(function Marked() {
      return null;
    });
    expect(isFieldLabelElement(<Marked />)).toBe(true);
    const Reference = asClientReference(Marked);
    expect(isFieldLabelElement(<Reference />)).toBe(true);
  });

  it('Label is marked; other nodes are not', () => {
    expect(isFieldLabelElement(<Label>Name</Label>)).toBe(true);
    expect(isFieldLabelElement(<span>Name</span>)).toBe(false);
    expect(isFieldLabelElement('Name')).toBe(false);
    expect(isFieldLabelElement(null)).toBe(false);
  });
});
```

`Label.test.tsx` additions:

```tsx
describe('required content (Phase 4 D27)', () => {
  it('true shows the decorative asterisk', () => {
    render(<Label required>Email</Label>);
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('content replaces the asterisk inside the same decorative span', () => {
    render(<Label required={<span>(required)</span>}>Email</Label>);
    const indicator = screen.getByText('(required)').parentElement as HTMLElement;
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).toHaveClass('ms-1', 'text-error');
    expect(screen.queryByText('*')).toBeNull();
  });

  it('content that renders nothing shows no indicator', () => {
    const { container } = render(<Label required="">Email</Label>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement**

`fieldLabel.ts`:

```ts
import * as React from 'react';
import { getElementType } from '../../lib/children';
import type { CoreSize, TextWeight } from '../../lib/types';

/**
 * Marks the components whose element Field renders as its label instead of wrapping it in its own
 * `<label>` (Label, InfoLabel). A marker, not an import, so that Field never pulls InfoLabel's
 * overlay code into a bundle. Internal.
 */
export const FIELD_LABEL: symbol = Symbol.for('wave.fieldLabel');

/** The props Field gives a label element (each only when the element does not set it). */
export interface FieldLabelElementProps {
  id?: string;
  htmlFor?: string;
  required?: boolean | React.ReactNode;
  size?: CoreSize;
  weight?: TextWeight;
  className?: string;
}

/** Marks `component` as a Field label element; call it next to `displayName`. */
export function markFieldLabel<T extends object>(component: T): T {
  (component as Record<symbol, unknown>)[FIELD_LABEL] = true;
  return component;
}

/** Whether `node` is an element of a marked component (lazy client references resolved). */
export function isFieldLabelElement(
  node: React.ReactNode,
): node is React.ReactElement<FieldLabelElementProps> {
  if (!React.isValidElement(node)) return false;
  const type = getElementType(node);
  return (
    (typeof type === 'function' || (typeof type === 'object' && type !== null)) &&
    (type as Record<symbol, unknown>)[FIELD_LABEL] === true
  );
}
```

`Label.tsx`: `required?: boolean | React.ReactNode` (JSDoc: "`true` shows a decorative asterisk; other content replaces it (a `(required)` text). Decorative (`aria-hidden`), so it must not be focusable; mark the control itself `required`."). `size?: CoreSize`. Render:

```tsx
      {required === true ? (
        <span className="ms-1 text-error" aria-hidden="true">
          *
        </span>
      ) : required !== false && slotRendersContent(required) ? (
        <span className="ms-1 text-error" aria-hidden="true">
          {materialiseSlotContent(required)}
        </span>
      ) : null}
```

After `Label.displayName = 'Label';` add `markFieldLabel(Label);`.

- [ ] **Step 4: Run to verify it passes; lead commits.**

```bash
git add src/components/input/fieldLabel.ts src/components/input/__tests__/fieldLabel.test.tsx src/components/input/Label.tsx src/components/input/__tests__/Label.test.tsx
git commit -m "feat(input): Label required content; the Field label marker"
```

#### Task B24: Field `size`

Implements spec §2.4, D8.

**Files:** `src/components/input/Field.tsx`, `__tests__/Field.test.tsx`.

**Interfaces:** Produces `FieldProps.size?: CoreSize`; the context carries the prop only; the root renders `data-size`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('size (Phase 4 D8)', () => {
  function SizeProbe() {
    return <output>{useFieldContext()?.size ?? 'unset'}</output>;
  }

  it('the context carries the size prop only', () => {
    const { rerender } = render(
      <Field label="Name">
        <SizeProbe />
      </Field>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('unset');
    rerender(
      <Field label="Name" size="large">
        <SizeProbe />
      </Field>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('large');
  });

  it.each([
    ['small', 'text-caption-1'],
    ['medium', 'text-body-1'],
    ['large', 'text-body-2'],
  ] as const)('a %s Field sizes its label with %s and renders data-size', (size, text) => {
    const { container } = render(
      <Field label="Name" size={size}>
        <input />
      </Field>,
    );
    expect(screen.getByText('Name')).toHaveClass(text);
    expect(container.firstElementChild).toHaveAttribute('data-size', size);
  });

  it('without a size, the label follows the provider default', () => {
    const { container } = renderWithProviders(
      <Field label="Name">
        <input />
      </Field>,
      { inputDefaults: { size: 'large' } },
    );
    expect(screen.getByText('Name')).toHaveClass('text-body-2');
    expect(container.querySelector('[data-orientation]')).toHaveAttribute('data-size', 'large');
  });

  it.each([
    ['small', 'pt-1', '[&>:first-child:has([role=checkbox],[role=switch],label>[role=radio])]:py-0.5'],
    ['large', 'pt-2.25', '[&>:first-child:has([role=checkbox],[role=switch],label>[role=radio])]:py-2.5'],
  ] as const)('horizontal %s: the label and short rows line up', (size, labelPadding, rowPadding) => {
    render(
      <Field label="Name" size={size} orientation="horizontal">
        <input />
      </Field>,
    );
    const label = screen.getByText('Name');
    expect(label).toHaveClass(labelPadding);
    expect(label.nextElementSibling).toHaveClass(rowPadding);
  });
});
```

(Import `useFieldContext` from `'../../../hooks/useFieldControl'` and `renderWithProviders`. Update any 0.7 test that asserts the root's exact attributes, if one exists.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.** `size?: CoreSize` on `FieldProps` (JSDoc: "The label's size and the default `size` of the text inputs and pickers inside the Field (their own `size` wins; choice controls keep theirs). The message and the hint stay small. Default: `WaveProvider inputDefaults.size`, else `'medium'`."). Then:

```ts
const LABEL_TEXT: Readonly<Record<CoreSize, string>> = {
  small: 'text-caption-1',
  medium: 'text-body-1',
  large: 'text-body-2',
};
/** Horizontal layout: the label's first line centred on a 24, 32 or 40px control. */
const LABEL_TOP: Readonly<Record<CoreSize, string>> = { small: 'pt-1', medium: 'pt-1.5', large: 'pt-2.25' };
/** Horizontal layout: a Checkbox, Switch or RadioGroup row lined up with the label. */
const SHORT_ROW_FIRST_CHILD: Readonly<Record<CoreSize, string>> = {
  small: '[&>:first-child:has([role=checkbox],[role=switch],label>[role=radio])]:py-0.5',
  medium: '[&>:first-child:has([role=checkbox],[role=switch],label>[role=radio])]:py-1.5',
  large: '[&>:first-child:has([role=checkbox],[role=switch],label>[role=radio])]:py-2.5',
};
```

`const labelSize = size ?? useWaveTheme().inputDefaults.size ?? 'medium';` (call the hook unconditionally at the top). Add `size` to the context value and its `useMemo` dependencies (the prop, not `labelSize`). The root renders `data-size={labelSize}` next to `data-orientation`. The label: `cn('mb-1 font-semibold text-foreground', LABEL_TEXT[labelSize], horizontal && cn('mb-0 shrink-0 basis-1/3', LABEL_TOP[labelSize]))`. The horizontal column uses `SHORT_ROW_FIRST_CHILD[labelSize]`.

- [ ] **Step 4: Run to verify it passes; lead commits.**

```bash
git add src/components/input/Field.tsx src/components/input/__tests__/Field.test.tsx
git commit -m "feat(input): Field size"
```

#### Task B25: `InfoButton`: structure, naming, the note and one copy of `info`

Implements D28 and D30, and the click opening of D29. Covers Review Focus 5.

**Files:**
- Create: `src/components/data-display/InfoButton.tsx`, `src/components/data-display/__tests__/InfoButton.test.tsx`

**Interfaces:**
- Consumes: `usePopupPosition`, `useDismiss`, `useRestoreFocus`, `usePresence`, `useId`, `useMergedRefs`, `useEventCallback`, `Portal`, `PopoverBeak` and `usePopoverTabOrder` (from `../overlays/Popover.shared`), `InfoIcon`, `joinIds`, `composeEventHandlers`, `cn`, `focusRing`, `CoreSize`.
- Produces: `export interface InfoButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> { info: React.ReactNode; size?: CoreSize; openOnHover?: boolean; 'aria-label'?: string; ref?: React.Ref<HTMLButtonElement> }`; `export const InfoButton`. InfoLabel (Task B27) passes `id`, `aria-label` and `aria-labelledby`.

- [ ] **Step 1: Write the failing tests**

```tsx
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { InfoButton } from '../InfoButton';
import {
  expectNoA11yViolations,
  findDanglingIdRefs,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

const INFO = (
  <>
    Use 12 characters. <a href="#rules">Rules</a>
  </>
);
const button = () => screen.getByRole('button', { name: 'Information' });
const note = () => screen.getByRole('note');

describe('InfoButton (Phase 4 D28, D30)', () => {
  testSystemProps(InfoButton, {
    expectedTag: 'button',
    displayName: 'InfoButton',
    defaultProps: { info: 'Some info' },
  });
  testNoImplicitSubmit(InfoButton, { defaultProps: { info: 'Some info' } });

  it('is named Information, or by its own aria-label, and has no aria-haspopup', () => {
    const { rerender } = render(<InfoButton info="x" />);
    expect(button()).not.toHaveAttribute('aria-haspopup');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    rerender(<InfoButton info="x" aria-label="About billing" />);
    expect(screen.getByRole('button', { name: 'About billing' })).toBeInTheDocument();
  });

  it('closed: one hidden copy of info describes the button, also in the server HTML', () => {
    render(<InfoButton info={INFO} />);
    expect(button()).toHaveAccessibleDescription('Use 12 characters. Rules');
    expect(screen.queryByRole('note')).toBeNull();
    const html = renderToString(<InfoButton info="Use 12 characters." />);
    expect(html.split('Use 12 characters.')).toHaveLength(2);
  });

  it('a click opens the note without moving focus; the note describes the button, one copy', async () => {
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    await user.click(button());
    expect(button()).toHaveFocus();
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(button()).toHaveAttribute('aria-controls', note().id);
    expect(button()).toHaveAccessibleDescription('Use 12 characters. Rules');
    expect(screen.getAllByText('Use 12 characters.', { exact: false })).toHaveLength(1);
    expect(note()).toHaveAttribute('data-state', 'open');
    expect(note()).toHaveAttribute('data-presence');
    expect(note()).toHaveAttribute('data-wave-infolabel-surface', '');
    expect(note()).toHaveAccessibleName('Information');
    expect(note().querySelector('[data-wave-popover-arrow]')).not.toBeNull();
  });

  it('the note is not the description target (Firefox would read its name)', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.click(button());
    const describedBy = button().getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).not.toContain(note().id);
    const description = document.getElementById(describedBy);
    expect(description).not.toBeNull();
    expect(note().contains(description)).toBe(true);
    expect(description).not.toHaveAttribute('aria-labelledby');
  });

  it('a click on a pinned note closes it', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.click(button());
    await user.click(button());
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('info changing while open updates the note, still one copy (Review Focus 5)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InfoButton info="First" openOnHover={false} />);
    await user.click(button());
    rerender(<InfoButton info="Second" openOnHover={false} />);
    expect(note()).toHaveTextContent('Second');
    expect(screen.getAllByText('Second')).toHaveLength(1);
    expect(screen.queryByText('First')).toBeNull();
  });

  it('sizes the glyph and keeps a 24px box', () => {
    render(<InfoButton info="x" size="large" />);
    expect(button()).toHaveClass('size-6', '-my-px');
    expect(button()).toHaveAttribute('data-size', 'large');
    expect(button().querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('passes axe open and closed, with no dangling ids', async () => {
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    expect(findDanglingIdRefs()).toEqual([]);
    await expectNoA11yViolations();
    await user.click(button());
    expect(findDanglingIdRefs()).toEqual([]);
    await expectNoA11yViolations();
  });

  it('opens once per activation in StrictMode', async () => {
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <InfoButton info="x" openOnHover={false} />
      </React.StrictMode>,
    );
    await user.click(button());
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL: the module does not exist.

- [ ] **Step 3: Implement the component's structure** (Task B26 adds hover, focus opening and the dismissal rules; click toggling, the note, positioning, presence and one copy land here):

```tsx
/** Why the note is open: a click pins it; keyboard focus owns it; hover opens it transiently. */
type OpenReason = 'hover' | 'focus' | 'click';

const GLYPH: Readonly<Record<CoreSize, { size: number; margin: string }>> = {
  small: { size: 12, margin: '-my-1' },
  medium: { size: 16, margin: '-my-0.5' },
  large: { size: 20, margin: '-my-px' },
};

export const InfoButton = ({
  info,
  size = 'medium',
  openOnHover = true,
  id: idProp,
  type = 'button',
  'aria-label': ariaLabel = 'Information',
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  className,
  onClick,
  ref,
  ...rest
}: InfoButtonProps) => {
  const generatedId = useId('info-button');
  const id = idProp ?? generatedId;
  const noteId = useId('info-note');
  const infoId = useId('info'); // the one copy of info: hidden while closed, inside the note while open
  const [reason, setReason] = React.useState<OpenReason | null>(null);
  const open = reason !== null;

  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  // Held in state too (C-POPUPS): the hover intent (Task B26) takes elements, not refs.
  const [buttonElement, setButtonElement] = React.useState<HTMLButtonElement | null>(null);
  const [note, setNote] = React.useState<HTMLElement | null>(null); // C-POPUPS: surface in state
  const noteRef = React.useRef<HTMLElement | null>(null);
  const arrowRef = React.useRef<HTMLDivElement | null>(null);

  const presence = usePresence(open);
  const { setReference, setFloating, floatingProps, arrowStyles, side } = usePopupPosition({
    open,
    side: 'top',
    align: 'center',
    offset: 8,
    arrowRef,
  });
  const { layerId } = useDismiss({
    open,
    onDismiss: () => setReason(null), // Task B26 adds the dismissed-stays-dismissed rule
    refs: [buttonRef, noteRef],
    anchorRef: buttonRef,
    focusOutside: true,
  });
  useRestoreFocus({ enabled: open, container: note, triggerRef: buttonRef, onlyIfFocusInside: true });

  const buttonRefs = useMergedRefs<HTMLButtonElement>(ref, buttonRef, setButtonElement, setReference);
  const noteRefs = useMergedRefs<HTMLElement>(noteRef, setNote, setFloating, presence.ref);
  const noteLabelledBy = ariaLabelledBy ?? id;

  return (
    <>
      <button
        type={type}
        id={id}
        data-size={size}
        {...rest}
        ref={buttonRefs}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={joinIds(ariaDescribedBy, infoId)}
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground',
          GLYPH[size].margin,
          'not-disabled:not-aria-disabled:hover:text-foreground',
          focusRing,
          className,
        )}
        onClick={composeEventHandlers(onClick, () =>
          setReason((current) => (current === 'click' ? null : 'click')),
        )}
      >
        <InfoIcon size={GLYPH[size].size} />
      </button>
      {presence.isMounted ? null : (
        <span id={infoId} hidden>
          {info}
        </span>
      )}
      {presence.isMounted && (
        <Portal layerId={layerId}>
          <div
            ref={noteRefs}
            id={noteId}
            role="note"
            aria-labelledby={noteLabelledBy}
            data-wave-infolabel-surface=""
            data-state={open ? 'open' : 'closed'}
            {...presence.presenceProps}
            {...floatingProps}
            className="w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-md border border-border bg-background px-3 py-2 text-caption-1 text-foreground shadow-16"
          >
            <PopoverBeak ref={arrowRef} side={side} style={arrowStyles} data-wave-popover-arrow="" />
            <div id={infoId}>{info}</div>
          </div>
        </Portal>
      )}
    </>
  );
};
InfoButton.displayName = 'InfoButton';
```

(Check each hook's exact options and return values in its source before wiring it; for example, `usePresence(open)` returns `{ isMounted, phase, ref, presenceProps }`, and `PopoverBeak` takes `side` and `style`. Merge `presence.presenceProps.style`, if any, with `floatingProps.style`. Popover's `PopoverContent` shows the working pattern. Write the component JSDoc per C-DOCS: purpose, naming, opening, Tab path, one copy, the Fluent names.)

- [ ] **Step 4: Run to verify it passes; lead commits.** Run the InfoButton tests and the conventions gate for the file.

```bash
git add src/components/data-display/InfoButton.tsx src/components/data-display/__tests__/InfoButton.test.tsx
git commit -m "feat(data-display): InfoButton with a note that holds rich info"
```

#### Task B26: `InfoButton`: hover, keyboard focus, dismissal and the Tab path

Implements the rest of D29.

**Files:** `InfoButton.tsx`, `__tests__/InfoButton.test.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('InfoButton behaviour (Phase 4 D29)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('a mouse resting on the button opens the note after 250ms; leaving closes it after 250ms', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.hover(button());
    advance(200);
    expect(screen.queryByRole('note')).toBeNull();
    advance(100);
    expect(note()).toBeInTheDocument();
    await user.unhover(button());
    advance(300);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('touch never hover-opens', () => {
    render(<InfoButton info="Some info" />);
    fireEvent.pointerEnter(button(), { pointerType: 'touch' });
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('keyboard focus opens it; focus from a pointer press waits for the click', async () => {
    const user = setup();
    const { unmount } = render(<InfoButton info="Some info" />);
    await user.tab();
    expect(note()).toBeInTheDocument();
    unmount();
    render(<InfoButton info="Some info" />);
    fireEvent.pointerDown(button());
    fireEvent.mouseDown(button());
    act(() => button().focus());
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('a note opened by keyboard focus stays when a mouse passes over and leaves', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.tab();
    await user.hover(button());
    await user.unhover(button());
    advance(1000);
    expect(note()).toBeInTheDocument();
  });

  it('a hover-opened note becomes focus-owned when the button takes keyboard focus', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.hover(button());
    advance(300);
    await user.tab();
    await user.unhover(button());
    advance(1000);
    expect(note()).toBeInTheDocument();
  });

  it('Tab from the open button enters the note; Tab past it continues and closes it; Shift+Tab returns', async () => {
    const user = setup();
    render(
      <>
        <InfoButton info={INFO} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(button()).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await act(async () => {});
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('Escape from a link closes it, returns focus, and focus restore does not reopen it', async () => {
    const user = setup();
    render(
      <>
        <InfoButton info={INFO} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    await user.keyboard('{Escape}');
    expect(button()).toHaveFocus();
    expect(screen.queryByRole('note')).toBeNull();
    await user.tab(); // focus leaves both
    await user.tab({ shift: true }); // and comes back: opens again
    expect(note()).toBeInTheDocument();
  });

  it('an outside press on blank space closes it without reopening', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.tab();
    await user.click(document.body);
    await act(async () => {});
    expect(screen.queryByRole('note')).toBeNull();
    advance(500);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('with openOnHover={false}, focus and hover do nothing and a click toggles', async () => {
    const user = setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.tab();
    await user.hover(button());
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
    await user.click(button());
    expect(note()).toBeInTheDocument();
  });

  it('enters the note from inside a modal focus trap when it is the last element', async () => {
    const user = setup();
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Settings">
          <InfoButton info={INFO} />
        </Dialog.Content>
      </Dialog>,
    );
    await act(async () => {});
    act(() => screen.getByRole('button', { name: 'Information', hidden: true }).focus());
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules', hidden: true })).toHaveFocus();
  });
});
```

(Import `Dialog` from `'../../overlays/Dialog'` for the modal case. If the Dialog's own close button comes after the InfoButton in its trap order, place the InfoButton so it is the trap's last tabbable element, for example in `Dialog.Footer`. Mock element rectangles with `mockRect` where the hover safe zone needs them.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement.** Add to the component:

```tsx
  const reasonRef = React.useRef(reason);
  React.useLayoutEffect(() => {
    reasonRef.current = reason;
  });
  // Set by a dismissal (Escape, outside press): keyboard focus reopens only after focus has left
  // both the button and the note (a focus restore must not reopen it).
  const dismissedRef = React.useRef(false);
  // A pointer press focuses the button; that focus waits for the click (0.7).
  const pointerPressRef = React.useRef(false);
  const hoverCloseRef = React.useRef(false);

  const hover = useHoverIntent({
    enabled: openOnHover,
    open,
    openDelay: 250,
    closeDelay: 250,
    trigger: buttonElement, // the button held in state through a callback ref (C-POPUPS)
    surface: note,
    onOpen: () => {
      hoverCloseRef.current = false;
      setReason((current) => current ?? 'hover');
    },
    onClose: () => {
      hoverCloseRef.current = true;
      setReason((current) => (current === 'hover' ? null : current));
    },
    // Only a note opened by hover, not pinned and not keyboard-owned, closes by hover; focus
    // inside the note blocks it too (Phase 2 D18).
    canClose: () => reasonRef.current === 'hover' && !note?.contains(document.activeElement),
  });
```

- `onDismiss: (dismissReason) => { if (dismissReason !== 'focus-outside') dismissedRef.current = true; hoverCloseRef.current = false; hover.cancel(); setReason(null); }` (check `DismissReason`'s member names in `src/lib/layers.ts`).
- `useRestoreFocus({ …, isHoverClose: () => hoverCloseRef.current })`.
- Button focus: `onFocus={composeEventHandlers(onFocus, () => { if (!openOnHover || pointerPressRef.current || dismissedRef.current) return; hoverCloseRef.current = false; setReason((current) => (current === 'click' ? current : 'focus')); })}`.
- Clearing the dismissal: `onBlur` of the button and a `focusout` listener on the note clear `dismissedRef` when `relatedTarget` is outside both the button and the note.
- Pointer press: `onPointerDown`/`onMouseDown` set `pointerPressRef.current = true` and clear it with `setTimeout(…, 0)`, the 0.7 InfoLabel mechanism with its comment.
- Hover handlers: compose `hover.triggerHandlers` onto the button (`onPointerEnter`, `onPointerMove`, `onPointerLeave`) and `hover.surfaceHandlers` onto the note.
- Tab from the button (runs before a modal trap's document listener):

```tsx
  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Tab' || event.shiftKey || !open || !note) return;
    const first = getFirstTabbable(note);
    if (!first) return;
    event.preventDefault();
    first.focus();
  };
  const onNoteKeyDown = usePopoverTabOrder({
    enabled: open,
    surface: note,
    anchorRef: buttonRef,
    getPreviousStop: () => buttonRef.current,
  });
```

Compose `onKeyDown` consumer-first onto the button, and put `onKeyDown={onNoteKeyDown}` on the note (import `getFirstTabbable` from `src/lib/focus`).
- `hover.cancel()` on click and on keyboard opening, as Popover does.

- [ ] **Step 4: Run to verify it passes; lead commits.**

```bash
git add src/components/data-display/InfoButton.tsx src/components/data-display/__tests__/InfoButton.test.tsx
git commit -m "feat(data-display): InfoButton hover, focus ownership and Tab path"
```

#### Task B27: InfoLabel

Implements D31.

**Files:** `src/components/data-display/InfoLabel.tsx`, `__tests__/InfoLabel.test.tsx`.

**Interfaces:**
- Consumes: `Label` (and `LabelProps`), `InfoButton` (B25/B26), `markFieldLabel` (B23), `resolveDeprecatedProp`.
- Produces: `InfoLabelProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>, Pick<LabelProps, 'htmlFor' | 'required' | 'size' | 'weight' | 'disabled'>` with `children?: React.ReactNode`, `label?: React.ReactNode` (`@deprecated Use \`children\`.`), `info: React.ReactNode`, `infoButtonLabel?: string`, `openOnHover?: boolean`, `ref?: React.Ref<HTMLSpanElement>`.

- [ ] **Step 1: Update and write the tests**

Update the 0.7 tests (spec §6.4). Queries for `button({ name: 'Information' })` become `'<label text> Information'`. Tests that pass `label=` either move to `children` or, where they test the alias, assert the warning. Tests of the `aria-hidden` popup now assert the note. Keep the 0.7 hover/focus/click behaviour tests: the behaviour is InfoButton's now and must hold. Then add:

```tsx
describe('InfoLabel as a label (Phase 4 D31)', () => {
  it('renders the label content in a <label>, with the label props routed to it', () => {
    render(
      <InfoLabel info="Use 12 characters." htmlFor="pw" required size="large" weight="semibold" id="pw-label">
        Password
      </InfoLabel>,
    );
    const label = screen.getByText('Password').closest('label') as HTMLLabelElement;
    expect(label).toHaveAttribute('for', 'pw');
    expect(label).toHaveAttribute('id', 'pw-label');
    expect(label).toHaveClass('text-body-2', 'font-semibold');
    expect(label).toHaveTextContent('Password*');
  });

  it('names the button "<label> Information" and localizes the second part', () => {
    const { rerender } = render(<InfoLabel info="x">Password</InfoLabel>);
    expect(screen.getByRole('button', { name: 'Password Information' })).toBeInTheDocument();
    rerender(
      <InfoLabel info="x" infoButtonLabel="Info">
        Password
      </InfoLabel>,
    );
    expect(screen.getByRole('button', { name: 'Password Info' })).toBeInTheDocument();
  });

  it('the deprecated label prop still works and warns once; children win', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<InfoLabel label="Old" info="x" />);
    expect(screen.getByText('Old')).toBeInTheDocument();
    rerender(
      <InfoLabel label="Old" info="x">
        New
      </InfoLabel>,
    );
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[WaveUI] InfoLabel: `label` is deprecated and will be removed in 1.0. Use `children` instead.',
    );
  });

  it('rich info: a link in the note is reachable by Tab', async () => {
    const user = userEvent.setup();
    render(
      <InfoLabel info={<a href="#rules">Rules</a>}>
        Password
      </InfoLabel>,
    );
    await user.tab();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
  });

  it('disabled dims only the label; the button stays usable', async () => {
    const user = userEvent.setup();
    render(
      <InfoLabel info="x" disabled openOnHover={false}>
        Password
      </InfoLabel>,
    );
    expect(screen.getByText('Password').closest('label')).toHaveClass('text-muted-foreground');
    await user.click(screen.getByRole('button', { name: 'Password Information' }));
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('server HTML hydrates without warnings', async () => {
    const ui = <InfoLabel info="Use 12 characters.">Password</InfoLabel>;
    const container = document.createElement('div');
    container.innerHTML = renderToString(ui);
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    try {
      await act(async () => {
        hydrateRoot(container, ui);
      });
      expect(error).not.toHaveBeenCalled();
    } finally {
      container.remove();
    }
  });
});
```

(Unmount the hydrated root before removing the container, following the SSR pattern of existing tests; CLAUDE.md "Testing" describes how such tests clean up.)

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.

- [ ] **Step 3: Implement.** Replace the 0.7 component:

```tsx
export const InfoLabel = ({
  children,
  label,
  info,
  infoButtonLabel = 'Information',
  openOnHover,
  id,
  htmlFor,
  required,
  size = 'medium',
  weight,
  disabled,
  className,
  ref,
  ...rest
}: InfoLabelProps) => {
  const content = resolveDeprecatedProp('InfoLabel', children, label, 'label', 'children');
  const generatedLabelId = useId('info-label');
  const labelId = id ?? generatedLabelId;
  const buttonId = useId('info-label-button');
  return (
    <span ref={ref} className={cn('inline-flex items-center gap-0', className)} {...rest}>
      <Label id={labelId} htmlFor={htmlFor} required={required} size={size} weight={weight} disabled={disabled}>
        {content}
      </Label>
      <InfoButton
        id={buttonId}
        info={info}
        size={size}
        openOnHover={openOnHover}
        aria-label={infoButtonLabel}
        aria-labelledby={`${labelId} ${buttonId}`}
      />
    </span>
  );
};
InfoLabel.displayName = 'InfoLabel';
markFieldLabel(InfoLabel);
```

Rewrite the JSDoc per D31 (a real label; `children`; the button's name; the note; the one copy; `openOnHover`; no `controlRef` and why). Delete the 0.7 popup code, which InfoButton replaces.

- [ ] **Step 4: Run to verify it passes; lead commits.**

```bash
git add src/components/data-display/InfoLabel.tsx src/components/data-display/__tests__/InfoLabel.test.tsx
git commit -m "feat(data-display): InfoLabel is a real label with a rich info button"
```

#### Task B28: Label elements in Field

Implements D32.

**Files:** `src/components/input/Field.tsx`, `__tests__/Field.test.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('label elements (Phase 4 D32)', () => {
  it('renders an InfoLabel as the label without nesting labels; the control is named by the text', () => {
    const { container } = render(
      <Field label={<InfoLabel info="Use 12 characters.">Password</InfoLabel>} required>
        <input />
      </Field>,
    );
    expect(container.querySelectorAll('label')).toHaveLength(1);
    expect(container.querySelector('label label')).toBeNull();
    expect(screen.getByRole('textbox')).toHaveAccessibleName('Password');
    expect(screen.getByRole('button', { name: 'Password Information' })).toBeInTheDocument();
    expect(screen.getAllByText('*')).toHaveLength(1);
  });

  it('gives the element id, htmlFor, required, size, semibold weight and the layout classes', () => {
    render(
      <Field label={<Label>Plan</Label>} size="large" orientation="horizontal" required>
        <input />
      </Field>,
    );
    const label = screen.getByText('Plan').closest('label') as HTMLLabelElement;
    expect(label).toHaveClass('text-body-2', 'font-semibold', 'basis-1/3', 'pt-2.25');
    expect(label).toHaveAttribute('for', screen.getByRole('textbox').id);
    expect(label.id).not.toBe('');
  });

  it('keeps the element own id and weight; its id labels a group control', () => {
    render(
      <Field label={<Label id="plan-label" weight="regular">Plan</Label>}>
        <div role="radiogroup" />
      </Field>,
    );
    expect(screen.getByText('Plan').closest('label')).toHaveAttribute('id', 'plan-label');
    expect(screen.getByText('Plan').closest('label')).not.toHaveClass('font-semibold');
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-labelledby', 'plan-label');
  });

  it('warns once when the element htmlFor points away from the control', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Field label={<Label htmlFor="elsewhere">Name</Label>}>
        <input id="mine" />
      </Field>,
    );
    expect(screen.getByText('Name').closest('label')).toHaveAttribute('for', 'mine');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Field: the label element');
  });

  it('recognizes client-reference label elements', () => {
    const ReferenceLabel = asClientReference(Label);
    const { container } = render(
      <Field label={<ReferenceLabel>Name</ReferenceLabel>}>
        <input />
      </Field>,
    );
    expect(container.querySelectorAll('label')).toHaveLength(1);
    expect(screen.getByRole('textbox')).toHaveAccessibleName('Name');
  });
});
```

(Import `InfoLabel` from `'../../data-display/InfoLabel'`: same package, so this is allowed in wave B. Also import `Label` and `asClientReference`.)

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL: two nested labels.

- [ ] **Step 3: Implement** in `Field.tsx`:
- `const labelElement = isFieldLabelElement(label) ? label : undefined;`
- The control-id chain: `const controlId = targetId ?? htmlFor ?? labelElement?.props.htmlFor ?? fieldId;`
- The label id: `const labelId = hasLabel ? (labelElement?.props.id ?? `${fieldId}-label`) : undefined;`
- The warning, from an effect: when `labelElement?.props.htmlFor !== undefined && labelElement.props.htmlFor !== controlId`, `warnOnce('Field:label-htmlFor', 'Field: the label element\'s `htmlFor` points at a different element than the Field\'s control, which would leave the control unnamed; Field points it at the control. Remove it, or give the control that id.')`.
- Rendering: when `labelElement` is set, render `React.cloneElement(labelElement, merged)` in place of Field's own `<label>`, where `merged` sets `htmlFor: controlId`; `id: labelId` when the element has none; `required: required || undefined` when the element's `required` is `undefined`; `size: labelSize` when unset; `weight: 'semibold'` when unset; and `className: cn('mb-1', horizontal && cn('mb-0 shrink-0 basis-1/3', LABEL_TOP[labelSize]), labelElement.props.className)`. Field's own `*` is not rendered for it.
- Update the Field JSDoc: `label` accepts a `Label` or `InfoLabel` element.

- [ ] **Step 4: Run to verify it passes; lead commits.**

```bash
git add src/components/input/Field.tsx src/components/input/__tests__/Field.test.tsx
git commit -m "feat(input): Field accepts Label and InfoLabel elements as its label"
```

#### Task B29: Label, InfoLabel, InfoButton and Field stories

Implements the P4-04 and Field stories (spec §2 P4-04 "Stories", C-STORIES).

**Files:** `stories/InfoLabel.stories.tsx`, `stories/Label.stories.tsx`, `stories/Field.stories.tsx`; create `stories/InfoButton.stories.tsx` (title `Components/Data Display/InfoButton`, the InfoLabel category).

- [ ] **Step 1: Write the stories**
- InfoLabel: `RichInfo` (a "Learn more" link), `ClickOnly` (`openOnHover={false}`), `Sizes`, `Required`, `InField` (vertical and horizontal Fields with an InfoLabel label). Update 0.7 stories from `label=` to `children`.
- InfoButton: `NextToAHeading`, with the button outside the heading and named by the heading:

```tsx
export const NextToAHeading: Story = {
  render: (args) => (
    <div className="flex items-center gap-1">
      <h2 id="billing-heading" className="text-subtitle-2">
        Billing
      </h2>
      <InfoButton
        {...args}
        id="billing-info"
        aria-labelledby="billing-heading billing-info"
        info="Charges appear on the first of the month."
      />
    </div>
  ),
};
```

- Label: `CustomRequired` (`required={<span>(required)</span>}`).
- Field: `Sizes` (small, medium and large Fields with an Input each; the Inputs follow the Field size once INTEGRATION has wired the packages, and every control here is P4-text's).

- [ ] **Step 2: Run the package checks**

Run every P4-labels test file, the stories gate for `Components/Data Display/InfoLabel`, `Components/Data Display/InfoButton`, `Components/Input/Label` and `Components/Input/Field`, the conventions gate for `Field.tsx`, `Label.tsx`, `fieldLabel.ts`, `InfoLabel.tsx` and `InfoButton.tsx`, both typechecks, ESLint and Prettier.
Expected: green, except the known between-waves failures of spec §3.3.

- [ ] **Step 3: Lead commits**

```bash
git add stories/InfoLabel.stories.tsx stories/InfoButton.stories.tsx stories/Label.stories.tsx stories/Field.stories.tsx
git commit -m "docs(stories): InfoLabel, InfoButton, Label and Field stories"
```

---

## Wave C — INTEGRATION (spec §3.3 step 3, §4.7–§4.9, §6.2)

INTEGRATION owns every file while it runs. It starts when all six wave-B packages are committed.

### Task C1: Barrels and public types

**Files:**
- Modify: `src/components/input/index.ts`, `src/components/data-display/index.ts`, `src/index.ts` (if it lists names explicitly), `src/__tests__/public-types.test.ts`

- [ ] **Step 1: Write the failing public-type tests (spec §4.9)**

Add to `public-types.test.ts`, importing from `'../index'` as the file does:

```ts
describe('Phase 4 public types', () => {
  it('sizes and appearances', () => {
    expectTypeOf<InputProps['size']>().toEqualTypeOf<CoreSize | number | undefined>();
    expectTypeOf<InputProps['htmlSize']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SelectProps['size']>().toEqualTypeOf<CoreSize | number | undefined>();
    expectTypeOf<TextareaProps['size']>().toEqualTypeOf<CoreSize | undefined>();
    for (const appearance of [
      {} as InputProps['appearance'],
      {} as TextareaProps['appearance'],
      {} as SelectProps['appearance'],
      {} as SearchBoxProps['appearance'],
      {} as ComboboxProps['appearance'],
      {} as DropdownProps['appearance'],
      {} as DatePickerProps['appearance'],
      {} as TimePickerProps['appearance'],
      {} as TagPickerProps['appearance'],
      {} as SpinButtonBaseProps['appearance'],
    ]) {
      expectTypeOf(appearance).toEqualTypeOf<InputAppearance | undefined>();
    }
    expectTypeOf<TagPickerProps['size']>().toEqualTypeOf<TagPickerSize | undefined>();
    expectTypeOf<CheckboxProps['size']>().toEqualTypeOf<CheckboxSize | undefined>();
    expectTypeOf<CheckboxProps['shape']>().toEqualTypeOf<CheckboxShape | undefined>();
    expectTypeOf<SwitchProps['size']>().toEqualTypeOf<SwitchSize | undefined>();
    expectTypeOf<SliderProps['size']>().toEqualTypeOf<SliderSize | number | undefined>();
    expectTypeOf<FieldProps['size']>().toEqualTypeOf<CoreSize | undefined>();
    expectTypeOf<FieldContextValue['size']>().toEqualTypeOf<CoreSize | undefined>();
  });

  it('SpinButton, Rating, labels', () => {
    expectTypeOf<SpinButtonProps['value']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SpinButtonAllowEmptyProps['value']>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<React.ComponentProps<typeof SpinButton>>().toEqualTypeOf<
      SpinButtonProps | SpinButtonAllowEmptyProps
    >();
    expectTypeOf<RatingProps['step']>().toEqualTypeOf<0.5 | 1 | undefined>();
    expectTypeOf<RatingProps['color']>().toEqualTypeOf<RatingColor | undefined>();
    expectTypeOf<typeof Rating.Item>().toEqualTypeOf<typeof RatingItem>();
    expectTypeOf<typeof RatingDisplay.Item>().toEqualTypeOf<typeof RatingItem>();
    expectTypeOf<InfoLabelProps['info']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<InfoLabelProps['openOnHover']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<InfoButtonProps['openOnHover']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<LabelProps['required']>().toEqualTypeOf<boolean | React.ReactNode | undefined>();
  });

  it('rejects invalid values', () => {
    // @ts-expect-error not a size
    expectTypeOf<InputProps>().toMatchTypeOf<{ size: 'huge' }>();
    // @ts-expect-error TagPicker has no small size
    const tagPicker: TagPickerProps['size'] = 'small';
    // @ts-expect-error Checkbox has no small size
    const checkbox: CheckboxProps['size'] = 'small';
    // @ts-expect-error Switch has no large size
    const switchSize: SwitchProps['size'] = 'large';
    // @ts-expect-error quarter stars
    const step: RatingProps['step'] = 0.25;
    // @ts-expect-error info is required
    const infoButton: InfoButtonProps = {};
    void [tagPicker, checkbox, switchSize, step, infoButton];
  });
});
```

(Adjust the imports to the names the barrels export after Step 3. If an assertion pattern differs from the file's existing style, follow the file.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx vitest run src/__tests__/public-types.test.ts --reporter=default`
Expected: FAIL: missing exports; "exports every named type" fails (the known between-waves failure).

- [ ] **Step 3: Update the barrels (spec §4.7)**

- `src/components/input/index.ts`: export `RatingItem`, `type RatingItemProps` and `type RatingColor` from `'./Rating'`; `type TagPickerSize`; `type CheckboxSize`, `type CheckboxShape`; `type SwitchSize`; `type SliderSize`; `type SpinButtonBaseProps` and `type SpinButtonAllowEmptyProps`.
- `src/components/data-display/index.ts`: `export { InfoButton } from './InfoButton'; export type { InfoButtonProps } from './InfoButton';`
- `src/index.ts`: nothing more if it re-exports the category barrels; otherwise add the same names.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx vitest run src/__tests__/public-types.test.ts --reporter=default`
Expected: PASS, including "exports every named type…".

- [ ] **Step 5: Lead commits**

```bash
git add src/components/input/index.ts src/components/data-display/index.ts src/index.ts src/__tests__/public-types.test.ts
git commit -m "feat: export the Phase 4 components and types"
```

### Task C2: Integration tests

Implements spec §4.8, cases 1–9, and updates the 0.7 InfoLabel cases of `integration.test.tsx` (the between-waves failure of spec §3.3).

**Files:**
- Modify: `src/__tests__/integration.test.tsx`

- [ ] **Step 1: Update the 0.7 InfoLabel cases**

Replace `label=` with children, and query the info button by its new name (`'<label text> Information'`). Keep each case's intent.

- [ ] **Step 2: Write the new cases**

A `describe('Phase 4 (form controls)', …)` block with one `it` per case of spec §4.8 (imports from `'../index'`, as the file's other cases do; `mockRect`, `asClientReference` and `expectNoA11yViolations` from `'../test-utils'`; `renderToString` from `'react-dom/server'`):

```tsx
it('case 1: a Field size reaches every text control and picker; TagPicker maps small to medium', () => {
  const controls: Array<[string, React.ReactElement]> = [
    ['Input', <Input key="i" />],
    ['Textarea', <Textarea key="t" />],
    ['Select', <Select key="s"><option>A</option></Select>],
    ['SearchBox', <SearchBox key="sb" />],
    ['SpinButton', <SpinButton key="sp" />],
    ['Combobox', <Combobox key="c"><Combobox.Option value="a">A</Combobox.Option></Combobox>],
    ['Dropdown', <Dropdown key="d"><Dropdown.Option value="a">A</Dropdown.Option></Dropdown>],
    ['DatePicker', <DatePicker key="dp" />],
    ['TimePicker', <TimePicker key="tp" />],
  ];
  for (const size of ['small', 'large'] as const) {
    for (const [name, control] of controls) {
      const { container, unmount } = render(
        <Field label={name} size={size}>
          {control}
        </Field>,
      );
      const sized = container.querySelectorAll('[data-size]');
      // the Field root and the control's styled element both carry the size
      expect(Array.from(sized).map((el) => el.getAttribute('data-size'))).toEqual([size, size]);
      unmount();
    }
    const { container, unmount } = render(
      <Field label="Tags" size={size}>
        <TagPicker options={[{ value: 'a', label: 'A' }]} />
      </Field>,
    );
    const tagSize = size === 'small' ? 'medium' : 'large';
    expect(container.querySelector('[data-wave-tagpicker-control]')?.closest('[data-size]')).toHaveAttribute(
      'data-size',
      tagSize,
    );
    unmount();
  }
});

it('case 2: provider defaults under Fields; Field size wins; nested provider; choice controls keep theirs', () => {
  render(
    <WaveProvider inputDefaults={{ size: 'small', appearance: 'filled-darker' }}>
      <Field label="Name">
        <Input />
      </Field>
      <Field label="Fruit">
        <Combobox>
          <Combobox.Option value="a">A</Combobox.Option>
        </Combobox>
      </Field>
      <Field label="Tags">
        <TagPicker options={[{ value: 'a', label: 'A' }]} />
      </Field>
      <Field label="Big" size="large">
        <Input />
      </Field>
      <WaveProvider inputDefaults={{ appearance: 'underline' }}>
        <Field label="Nested">
          <Input />
        </Field>
      </WaveProvider>
      <Input aria-label="Own" size="large" appearance="outline" />
      <Checkbox label="Check" />
      <Switch label="Toggle" />
      <Slider aria-label="Level" />
    </WaveProvider>,
  );
  const look = (el: Element | null) => [el?.getAttribute('data-size'), el?.getAttribute('data-appearance')];
  const root = (el: Element) => el.closest('[data-appearance]');
  expect(look(screen.getByRole('textbox', { name: 'Name' }))).toEqual(['small', 'filled-darker']);
  expect(look(root(screen.getByRole('combobox', { name: 'Fruit' })))).toEqual(['small', 'filled-darker']);
  expect(look(root(screen.getByRole('combobox', { name: 'Tags' })))).toEqual(['medium', 'filled-darker']);
  expect(look(screen.getByRole('textbox', { name: 'Big' }))).toEqual(['large', 'filled-darker']);
  expect(look(screen.getByRole('textbox', { name: 'Nested' }))).toEqual(['small', 'underline']);
  expect(look(screen.getByRole('textbox', { name: 'Own' }))).toEqual(['large', 'outline']);
  expect(screen.getByRole('checkbox', { name: 'Check' }).closest('label')).toHaveAttribute('data-size', 'medium');
  expect(screen.getByRole('switch', { name: 'Toggle' }).closest('label')).toHaveAttribute('data-size', 'medium');
  expect(screen.getByRole('slider', { name: 'Level' })).toHaveAttribute('data-size', 'medium');
});

it('case 3: an InfoLabel label names the control with its text; Tab visits button, note link, input', async () => {
  const user = userEvent.setup();
  render(
    <Field
      required
      label={
        <InfoLabel
          info={
            <>
              Use 12 characters. <a href="#rules">Rules</a>
            </>
          }
        >
          Password
        </InfoLabel>
      }
    >
      <Input />
    </Field>,
  );
  const info = screen.getByRole('button', { name: 'Password Information' });
  const input = screen.getByRole('textbox', { name: 'Password' });
  expect(info).toHaveAccessibleDescription('Use 12 characters. Rules');
  expect(screen.getAllByText('*')).toHaveLength(1);
  await user.tab();
  expect(info).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
  await expectNoA11yViolations();
  await user.keyboard('{Escape}');
  expect(info).toHaveFocus();
  await user.tab();
  expect(input).toHaveFocus();
  await expectNoA11yViolations();
});

it('case 4: a Label element labels a RadioGroup through aria-labelledby', () => {
  const { container } = render(
    <Field label={<Label weight="regular">Plan</Label>}>
      <RadioGroup>
        <RadioGroup.Item value="free" label="Free" />
        <RadioGroup.Item value="pro" label="Pro" />
      </RadioGroup>
    </Field>,
  );
  const label = screen.getByText('Plan').closest('label') as HTMLLabelElement;
  expect(container.querySelector('label label')).toBeNull();
  expect(screen.getByRole('radiogroup')).toHaveAttribute(
    'aria-labelledby',
    expect.stringContaining(label.id),
  );
  expect(screen.getByRole('radiogroup')).toHaveAccessibleName('Plan');
  expect(label).not.toHaveClass('font-semibold');
});

it('case 5: a required Field blocks an empty allowEmpty SpinButton; a value submits', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form aria-label="Order" onSubmit={onSubmit}>
      <Field label="Guests" required>
        <SpinButton allowEmpty name="guests" />
      </Field>
    </form>,
  );
  const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
  const spin = screen.getByRole('spinbutton', { name: 'Guests' });
  expect(form.checkValidity()).toBe(false);
  act(() => form.requestSubmit());
  expect(onSubmit).not.toHaveBeenCalled();
  expect(spin).toHaveFocus();
  await user.keyboard('{ArrowUp}');
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get('guests')).toBe('1');
});

it('case 6: a half-star rating in a required Field submits 3.5 and resets', async () => {
  render(
    <form aria-label="Review">
      <Field label="Score" required>
        <Rating step={0.5} name="score" />
      </Field>
      <button type="reset">Reset</button>
    </form>,
  );
  const form = screen.getByRole('form', { name: 'Review' }) as HTMLFormElement;
  expect(form.checkValidity()).toBe(false);
  const star4 = screen.getByRole('radio', { name: '4 stars' }).parentElement as HTMLElement;
  mockRect(star4, { left: 0, right: 24, top: 0, bottom: 24, width: 24, height: 24 });
  fireEvent.click(star4, { clientX: 6, clientY: 12, detail: 1 });
  expect(new FormData(form).get('score')).toBe('3.5');
  expect(form.checkValidity()).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  await act(async () => {});
  for (const radio of screen.getAllByRole('radio')) {
    expect(radio).toHaveAttribute('aria-checked', 'false');
  }
});

it('case 7: in a modal Dialog, Escape closes the note first, then the Dialog', async () => {
  const user = userEvent.setup();
  render(<InfoInDialog />);
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  const info = await screen.findByRole('button', { name: 'Theme Information' });
  act(() => info.focus());
  expect(screen.getByRole('note')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('note')).toBeNull();
  expect(info).toHaveFocus();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await act(async () => {});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
});

it('case 8: Server Component references: RatingItem children and an InfoLabel Field label', () => {
  const Item = asClientReference(RatingItem);
  const ReferenceInfoLabel = asClientReference(InfoLabel);
  expect(
    renderToString(
      <Rating aria-label="Stars" max={2}>
        <Item value={1} />
        <Item value={2} />
      </Rating>,
    ),
  ).toBe(
    renderToString(
      <Rating aria-label="Stars" max={2}>
        <RatingItem value={1} />
        <RatingItem value={2} />
      </Rating>,
    ),
  );
  const field = (label: React.ReactNode) =>
    renderToString(
      <Field label={label}>
        <input />
      </Field>,
    );
  const reference = field(<ReferenceInfoLabel info="Hint">Name</ReferenceInfoLabel>);
  expect(reference).toBe(field(<InfoLabel info="Hint">Name</InfoLabel>));
  expect(reference.match(/<label/g)).toHaveLength(1);
  expect(typeof InfoButton).toBe('function');
});

it('case 9: the 0.7 guards hold at non-default sizes and appearances', async () => {
  const user = userEvent.setup();
  render(
    <form aria-label="Profile">
      <Field label="Name" required>
        <Input size="large" appearance="underline" />
      </Field>
      <Input aria-label="Email" size="small" appearance="filled-darker" error="Enter an email address" />
      <Combobox aria-label="Fruit" name="fruit" size="large" defaultValue="apple">
        <Combobox.Option value="apple">Apple</Combobox.Option>
        <Combobox.Option value="pear">Pear</Combobox.Option>
      </Combobox>
      <button type="reset">Reset</button>
    </form>,
  );
  const form = screen.getByRole('form', { name: 'Profile' }) as HTMLFormElement;
  expect(form.checkValidity()).toBe(false);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter an email address');
  await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
  await user.click(screen.getByRole('option', { name: 'Pear' }));
  expect(new FormData(form).get('fruit')).toBe('pear');
  await user.click(screen.getByRole('button', { name: 'Reset' }));
  await act(async () => {});
  expect(new FormData(form).get('fruit')).toBe('apple');
});
```

`InfoInDialog` is a small component defined in the test file:

```tsx
function InfoInDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button>Settings</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Settings">
        <InfoLabel info={<a href="#more">More</a>}>Theme</InfoLabel>
      </Dialog.Content>
    </Dialog>
  );
}
```

Notes for the implementer:
- Write the Dialog composition with the API the file's existing Dialog cases use.
- If jsdom's `requestSubmit` does not run constraint validation in case 5, assert through `form.checkValidity()` and the hidden input's `invalid` event, as the existing "a required Field blocks submission" cases do.
- Add Rating (now a compound) and InfoLabel to the file's Server Component regression suite in that suite's own pattern (spec §4.8 case 8; CLAUDE.md "Testing").

- [ ] **Step 3: Run to verify**

Run: `npx vitest run src/__tests__/integration.test.tsx --reporter=default`
Expected: PASS, clean output. A failure that exposes a package bug is fixed in that package's file (INTEGRATION owns every file in wave C) with a test in the package's own test file, and noted in the report.

- [ ] **Step 4: Lead commits**

```bash
git add src/__tests__/integration.test.tsx
git commit -m "test: Phase 4 integration cases"
```

### Task C3: The provider story and the Field-only bundle probe

Implements spec §6.2's probe and the provider story.

**Files:**
- Modify: `stories/WaveProvider.stories.tsx`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`

- [ ] **Step 1: Write the failing probe test**

In `scripts/__tests__/verify-dist.test.mjs`, following the file's fixture pattern for the presence probe: a fixture dist where a Field-only import pulls `components/data-display/InfoButton.mjs` must make `verifyDist` report the probe error, and a clean fixture must not. Match how the existing presence probe cases build their fixtures and assert error lists (cases that assert a complete error list gain the new probe or pass it explicitly).

- [ ] **Step 2: Run to verify it fails.** `npx vitest run scripts/__tests__/verify-dist.test.mjs --reporter=default`. Expected: FAIL.

- [ ] **Step 3: Add the probe** in `scripts/verify-dist.mjs`, next to the presence probe:

```js
    errors.push(
      ...(await probeTreeShaking(distRoot, {
        keep: 'Field',
        drop: 'InfoButton',
        dropModules: ['components/data-display/InfoButton.mjs'],
      })),
    );
```

(`probeTreeShaking` checks that the listed modules exist, so a typo cannot pass silently; confirm the module path from `npm run build` output.)

- [ ] **Step 4: The provider story.** In `stories/WaveProvider.stories.tsx`, add `InputDefaults`: a nested `WaveProvider inputDefaults={{ size: 'small', appearance: 'filled-darker' }}` around a Field with an Input, a Combobox and a SpinButton, plus a nested provider with `{ appearance: 'underline' }`. Every field is labelled.

- [ ] **Step 5: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && node scripts/verify-dist.mjs --final && npm run check:package && npm run test:pack && npm run build-storybook`
Expected: all green.

- [ ] **Step 6: Lead commits**

```bash
git add stories/WaveProvider.stories.tsx scripts/verify-dist.mjs scripts/__tests__/verify-dist.test.mjs
git commit -m "test(verify-dist): a Field-only bundle contains no InfoButton; provider story"
```

---

## Wave D — DOCS (spec §5)

One agent, against the final API. Every document follows the style of its 0.7 sections; the spec's §5 lists the content.

### Task D1: CHANGELOG

**Files:** `CHANGELOG.md`

- [ ] **Step 1: Write the section** `## [0.9.0] - Unreleased` above the latest section, with the intro, "Upgrading from 0.8" (items 1–7), and "Added" (by component, with gap ids), "Changed" (behaviour, visual, DOM, types), "Deprecated", "Fixed" and "Size" exactly as spec §5.1 lists them. Use the `[0.7.0]` section as the model. Leave the "Size" numbers as a list of what is measured and note that wave E measures them: the one known placeholder, replaced in Task E3.

- [ ] **Step 2: Verify**

Run: `npx prettier --check CHANGELOG.md` if Prettier covers it (it does not by default; skip if so), then `node scripts/claude/gate.mjs --only changelog` if the gate script offers a CHANGELOG check (see `.claude/skills/gate`).
Expected: the CHANGELOG checks pass.

- [ ] **Step 3: Lead commits.** `git add CHANGELOG.md && git commit -m "docs(changelog): 0.9.0"`

### Task D2: README

**Files:** `README.md`

- [ ] **Step 1:** Apply spec §5.2. Update the "Components" rows and the Provider row; add a new "Sizes and appearances" usage note (the unions and pixel sizes, the resolution order, `inputDefaults`, the filled-appearance guidance, `htmlSize`, the data attributes, the choice-control sizes). Update "Forms and Field" for Field `size` and label elements. Add SpinButton and Rating notes, the RSC flat-name rows (`RatingItem`, `InfoButton`), the keyboard rows, and the built-in text rows ("Information", half-star names). Update "Theming" (the token table and list; `useWaveTheme()`'s `inputDefaults`) and add "Upgrading from 0.8".
- [ ] **Step 2:** Check every code sample against the final API by reading the components' JSDoc. Links resolve.
- [ ] **Step 3: Lead commits.** `git add README.md && git commit -m "docs(readme): 0.9.0 form controls"`

### Task D3: CLAUDE.md

**Files:** `CLAUDE.md`

- [ ] **Step 1:** Apply spec §5.3: the user-docs link to this spec. In Architecture: `inputLook.ts`, `fieldLabel.ts`, `Rating.item.tsx`, `data-display/InfoButton.tsx`, `Popover.shared.tsx` also used by InfoButton, `pickerStyles.ts`'s functions, and the input maps and `hitAreaLayer` in `src/lib/styles.ts`. Add the convention line for sizes and appearances (resolution through `useInputLook`; the enumerated data attributes), the C-NAMING line for `htmlSize`, and the testing helpers (`renderWithFieldContext` `size`, `renderWithProviders` `inputDefaults`, press-and-hold and half-star test patterns).
- [ ] **Step 2: Lead commits.** `git add CLAUDE.md && git commit -m "docs(claude): Phase 4 conventions"`

### Task D4: Guide and testing guide

**Files:** `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`

- [ ] **Step 1:** Apply spec §5.4: the guide's color token table and `useWaveTheme()` shape, a component-architecture pattern for the input recipe, and the accessibility notes (SpinButton press-and-hold and empty value, Rating half stars, InfoButton's note). In the testing guide: resolution-order tests, press-and-hold with fake timers and pointer types, pointer positions for half stars, and InfoButton's Tab path.
- [ ] **Step 2: Lead commits.** `git add docs/WAVE-UI-GUIDE.md docs/testing-best-practices.md && git commit -m "docs(guide): Phase 4 patterns"`

### Task D5: ROADMAP and the spec's implementation notes

**Files:** `docs/ROADMAP.md`, `docs/superpowers/specs/2026-09-26-fluent-parity-phase-4-design.md` (§10)

- [ ] **Step 1:** Apply spec §5.5: the status line; §3's parallel-phase entry note; the Phase 4 entries' notes on where the spec changed the sketches; §8.3's intentional differences (the list in §5.5, plus the SpinButton "0, then clamp" empty-step rule of D17); and the backlog note for `form-basic-12`.
- [ ] **Step 2:** The lead adds spec §10 implementation notes for every deliberate difference found during waves A–C (at least: F4 updated the six component tests in wave A (Task A2); any renamed helper; any behaviour a package settled differently, with the reason).
- [ ] **Step 3: Lead commits.** `git add docs/ROADMAP.md docs/superpowers/specs/2026-09-26-fluent-parity-phase-4-design.md && git commit -m "docs(roadmap): Phase 4 implemented"`

---

## Wave M — merging Phase 3 (the lead; spec §3.3 step 5)

Runs at the first wave boundary after Phase 3's merge commit reaches `main`, and in any case before wave E. If Phase 3 is not on `main` when wave D ends, wave E waits for it: this branch never merges before Phase 3 (D1).

### Task M1: Merge `main`

- [ ] **Step 1:** Confirm Phase 3 is merged: `git fetch origin && git log --oneline origin/main -5` (or the local `main`, where the maintainer merges).
- [ ] **Step 2:** `git merge main` in the worktree (a merge commit; no rebase).
- [ ] **Step 3:** Resolve conflicts. Component roots keep both changes (P3-00's stable class and constant, and Phase 4's classes and attributes). Shared files take the union: tokens and their pairs, types, barrels, `integration.test.tsx`, `public-types.test.ts`, `verify-dist.mjs` probes, `stories/_helpers.ts`, `WaveProvider.tsx`, `conventions.test.ts`.
- [ ] **Step 4:** Commit the merge: `git commit` (the default merge message, edited to `chore: merge main (Phase 3, 0.8.0) into the Phase 4 branch`).

### Task M2: P3-00 class names for the Phase 4 parts

- [ ] **Step 1:** Read P3-00's rule in the merged `src/__tests__/conventions.test.ts` and its naming scheme in the Phase 3 spec.
- [ ] **Step 2:** Run the conventions gate over every Phase 4 file: `npx vitest run src/__tests__/conventions.test.ts --reporter=default`. For each failure (at least `InfoButton` and `RatingItem`; possibly the InfoButton note and the half-star box), add the stable class and constant in P3-00's scheme, with a test per P3-00's pattern. Check how the rule treats `inputLook.ts`, `fieldLabel.ts` and `Rating.item.tsx`.
- [ ] **Step 3:** Export the new constants from the barrels with their flat names and `public-types.test.ts` lines (P3-00's acceptance).
- [ ] **Step 4: Lead commits.** `git commit -m "feat: stable class names for the Phase 4 parts"`

### Task M3: Documents after the merge

- [ ] **Step 1:** CHANGELOG: `## [0.9.0] - Unreleased` above `## [0.8.0] - …`; "Upgrading from 0.8" follows Phase 3's "Upgrading from 0.7". README sections merged. ROADMAP status lines for both phases. CLAUDE.md conventions merged. The size report's baseline becomes 0.8.0.
- [ ] **Step 2: Lead commits.** `git commit -m "docs: reconcile 0.8.0 and 0.9.0 documents"`

### Task M4: The full gate after the merge

- [ ] **Step 1:** Run `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && node scripts/verify-dist.mjs --final && npm run check:package && npm run test:pack && npm run build-storybook`. Expected: all green. Fix what the merge broke, with tests, and commit each fix separately.

---

## Wave E — final gate (the lead; spec §6.3, §6.5)

### Task E1: The exit gate

- [ ] **Step 1:** Run the `/gate` skill (`node scripts/claude/gate.mjs`), which covers the full gate and the CHANGELOG, exception, warning and document checks. Fix every failure with a test before moving on.

### Task E2: The real-browser checklist

- [ ] **Step 1:** Start Storybook (`npm run dev`) and run `/browser-check` for InfoButton, InfoLabel, SpinButton, Rating, Combobox, SearchBox, Switch and Slider. Then go through spec §6.3's checklist items 1–5 in Chrome, Firefox and Safari, plus Windows High Contrast and a touch device where noted. Record each result as exit evidence in the wave E report. File every failure as a bug, fix it with a test (jsdom-checkable parts) or a documented browser check, and re-run the affected items.

### Task E3: The size report

- [ ] **Step 1:** Measure `dist/styles.css` and the Button-only, Input-only, Field-only and full-import bundle sizes against 0.8.0 (the same method as the 0.7.0 CHANGELOG), and write them into the CHANGELOG's "Size" entry. Lead commits: `git commit -m "docs(changelog): 0.9.0 size report"`.

### Task E4: Finish the branch

- [ ] **Step 1:** Use superpowers:finishing-a-development-branch. The branch merges to `main` only after Phase 3 and wave M (D1). The release (the version bump, the dated CHANGELOG section, the `v0.9.0` tag) is the maintainer's step (`docs/RELEASING.md`).

