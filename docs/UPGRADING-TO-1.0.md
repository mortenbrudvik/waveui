# Upgrading to 1.0

1.0 is the first stable release of `@mortenbrudvik/waveui` and its API freeze. From 1.0 on, semantic versioning covers the exports of the package entry (components, hooks, helpers and types), the documented props and their `data-*` state attributes, the stable `wave-*` classes of the class-name registry, the `--wave-*` tokens, the namespaced theme keys (`bg-wave-primary`) and the CSS entries of the `exports` map. Wave's own utility classes (`wave:flex`) and the modules the entry does not export are internal and may change in any release. A break waits for 2.0; a rename in a 1.x minor keeps the old name as a deprecated alias.

1.0 ends the 0.x compromises at once:

1. [ES modules only](#es-modules-only): no CommonJS build; `require()` needs Node.js 22.12 or later.
2. [Namespaced utilities](#namespaced-utilities): every class the components draw carries the prefix `wave:`, and your Tailwind build gets Wave's theme keys as `bg-wave-primary`, `text-wave-body-1`, `shadow-wave-4`. A [migration codemod](#the-migration-codemod) ships in the package.
3. [`ref` reaches the control](#ref-reaches-the-control) of twelve form controls, which lose `controlRef`; their root is `slotProps.root`.
4. [Removed](#removed-in-10): everything 0.x deprecated.
5. [Defaults and meanings that change](#defaults-and-meanings-that-change): Badge `important`, TeachingPopover's Done, TimePicker's `format`.
6. [Arguments and props that become required](#arguments-and-props-that-become-required): the `details` argument of the change callbacks, and `Image.alt`.

Items 4 to 6 were announced in 0.x releases (the "Announced in" columns below), and 0.18 warned in development about each use that code can detect. Items 1 to 3, and the end of the 0.4 ramp names `--brand-N` and `--grey-N` as overrides ([below](#the-04-variable-names)), were not announced: the maintainer chose them for 1.0 after 0.18 shipped, without a 0.19 to announce them, and this guide, the [CHANGELOG](../CHANGELOG.md) and the codemod stand in for the notice.

## Before you upgrade

1. Upgrade to 0.18.1, the last 0.x release, and run your app and your tests as a development build (any build whose `process.env.NODE_ENV` is not `'production'`). It warns once about each use of a removed form that code can detect, with the `[WaveUI]` prefix and the replacement (``[WaveUI] Checkbox: `onChange` is deprecated and will be removed in 1.0. Use `onCheckedChange` instead.``): the "Warned in 0.18" columns below. Replace them there; every replacement works in 0.18. The warnings added in 0.18 (Badge and CounterBadge `important`, the positional `useRovingTabIndex` and `onSortChange`, a `className` with presence variants) read `process.env.NODE_ENV` written out, so run a bundled development build to see them.
2. Look for what no warning reports: [What no code can detect](#what-no-code-can-detect).
3. Upgrade to 1.0 and run your type check: the removed props, values, call forms and exports, the `ref` types of the twelve controls and the required `details` arguments are type errors.
4. Run the [migration codemod](#the-migration-codemod) if your own classes use Wave's token utilities (`bg-primary`, `text-body-1`, `shadow-4`), and check your stylesheet setup ([What changes in each setup](#what-changes-in-each-setup)).

1.0 logs none of the 0.18 notices: the forms they announced are gone. JavaScript that no type checker reads gets no message for a removed prop; [Untyped code](#untyped-code) says what it gets instead.

## ES modules only

The package ships ES modules alone, `dist/*.mjs` and one `index.d.ts`:

| | 0.18 | 1.0 |
|---|---|---|
| `exports["."]` | `import` (`index.d.ts`, `index.mjs`) and `require` (`index.d.cts`, `index.cjs`) | `types` (`index.d.ts`) and `default` (`index.mjs`) |
| `main` | `./dist/index.cjs` | `./dist/index.mjs` |
| `module` | `./dist/index.mjs` | none |
| `.cjs`, `.cjs.map`, `index.d.cts` in `dist` | yes | none |

- Bundlers and `import` load the package as before.
- `require('@mortenbrudvik/waveui')` in CommonJS code works on Node.js 22.12 and later, the `engines` floor of 0.x too, and returns the same module as `import` (22.12.x prints an ExperimentalWarning, 22.13 and later nothing). An older Node.js stops with `ERR_REQUIRE_ESM`.
- TypeScript: a file compiled as CommonJS (a `.cts` file, or a `.ts` file in a package that is not `"type": "module"`) resolves the package's types with `module` set to `node20` or `nodenext`. Under `node16` it reports TS1479 (a CommonJS module that imports an ES module). Code compiled as ES modules, and `moduleResolution` `bundler`, change nothing.

  ```jsonc
  // tsconfig.json of a CommonJS project ("module": "node16" in 0.18)
  { "compilerOptions": { "module": "node20" } }
  ```

- Jest in its default CommonJS mode must transform the package, whose files are ES modules (let it through `transformIgnorePatterns` and give `.mjs` files a transform), or run in Jest's ES modules mode; Vitest needs nothing.

## Namespaced utilities

### What changed

- **Wave's own classes carry the prefix `wave:`.** `dist/styles.css` is compiled with Tailwind's `prefix(wave)`, and every class a component draws is written with it: `wave:flex`, `wave:bg-primary`, `wave:not-disabled:not-aria-disabled:hover:bg-primary-hover`. No class of Wave's shares a name with one of your app's. They are internal: style the components through `className`, `slotProps`, the `--wave-*` tokens and the stable `wave-*` classes.
- **Wave's theme keys reach your Tailwind build under `wave`.** `./tailwind` and `./tokens` give your own classes Wave's colors, type ramp and shadows as `bg-wave-primary`, `text-wave-body-1` and `shadow-wave-4`. The 0.x names generate nothing unless a theme of your own defines them, and a shadcn/ui theme's `bg-primary` is the app's own again (in 0.x Wave's `--color-primary` collided with it).

  | 0.x | 1.0 |
  |---|---|
  | A color utility of a Wave token, `<utility>-<token>`: `bg-primary`, `text-foreground`, `border-border`, `ring-ring`, `fill-error`, `hover:bg-subtle-hover` | `<utility>-wave-<token>`: `bg-wave-primary`, `text-wave-foreground`, `border-wave-border`, `ring-wave-ring`, `fill-wave-error`, `hover:bg-wave-subtle-hover` |
  | The type ramp: `text-caption-2` … `text-body-1` … `text-display` | `text-wave-caption-2` … `text-wave-body-1` … `text-wave-display` |
  | The shadows: `shadow-2` … `shadow-64` | `shadow-wave-2` … `shadow-wave-64` |
  | Theme variables in your CSS: `var(--color-primary)`, `var(--shadow-4)`, `theme(--text-body-1--line-height)` | `var(--color-wave-primary)`, `var(--shadow-wave-4)`, `theme(--text-wave-body-1--line-height)` |
  | `font-wave`, `font-wave-mono`, `font-wave-numeric`, `animate-wave-*`, `duration-wave-*`, `ease-wave-*` | unchanged: they carried `wave` already |
  | The tokens: `var(--wave-primary)`, `var(--wave-brand-80)` | unchanged |

- **`./tailwind` layers Wave.** The entry declares `@layer theme, base, components, utilities;` and puts the tokens and the namespaced keys in `theme`, Wave's scoped base styles in `base` and the components' precompiled utilities in `components`. It has no `@source`: 0.x scanned `dist` and generated the components' classes in your build. A build with a prefix of its own (`@import 'tailwindcss' prefix(tw);`) imports it the same way (its classes are `tw:bg-wave-primary`), where 0.x needed `./styles` in a layer instead.
- **`./utilities` is new** (also `./utilities.css`), for apps without Tailwind: the namespaced token utilities (`bg-`, `text-`, `border-`, `ring-`, `fill-` and `stroke-` with every color token, the type ramp, the shadows, the font families and the animations), unlayered, without variants and without spacing or layout utilities. Link it after `./styles` and before your own CSS.
- **A custom Tailwind setup is assembled differently.** 0.x's `./tokens` and `./variants.css` with an `@source` of `dist` compiled the components in your build. A build without Wave's prefix cannot generate their `wave:` classes, so in 1.0 the components come from `./styles`, imported into a layer of yours, and `./tokens` and `./variants.css` serve your own classes: [Custom Tailwind setups](../README.md#custom-tailwind-setups).
- **The public `cn` is the components' merge.** A class and its `wave:` twin are one utility to it, so your unprefixed class replaces the conflicting class of a public recipe: `cn(focusRing, 'focus-visible:outline-offset-0')` keeps the recipe's ring and drops its `wave:focus-visible:outline-offset-2`. It knows Wave's scales under both names, so `cn('text-body-1', 'text-foreground')` keeps both classes as in 0.18 (a step of the type ramp is a font size), and so does `cn('text-wave-body-1', 'text-wave-foreground')`. A 0.x name that `cn` still merges generates nothing in your build, though: migrate it.

### The migration codemod

`codemod/migrate-1.0.mjs` ships in the package. It rewrites your own classes, `@apply` lists and theme variable uses that named Wave's former token utilities to the namespaced ones. Run it from your app's root (Node.js built-ins only; quote the globs on a shell that expands them itself):

```bash
# prints every change as a diff-like report and writes nothing
node node_modules/@mortenbrudvik/waveui/codemod/migrate-1.0.mjs --dry-run "src/**/*.{ts,tsx,css}"
# writes the changes, leaving the 17 names shared with shadcn/ui as they are (see "Shared names")
node node_modules/@mortenbrudvik/waveui/codemod/migrate-1.0.mjs "src/**/*.{ts,tsx,css}"
# an app without shadcn/ui and without a Tailwind theme of its own: rewrites those 17 names too
node node_modules/@mortenbrudvik/waveui/codemod/migrate-1.0.mjs --include-shared "src/**/*.{ts,tsx,css}"
```

```tsx
// 0.18
<div className="text-body-1 shadow-4 bg-selected hover:bg-subtle-hover dark:text-error">…</div>
// 1.0, after the codemod
<div className="text-wave-body-1 shadow-wave-4 bg-wave-selected hover:bg-wave-subtle-hover dark:text-wave-error">…</div>
```

```css
/* 0.18 */
.note { @apply text-caption-1 shadow-8; color: var(--color-error); }
/* 1.0, after the codemod */
.note { @apply text-wave-caption-1 shadow-wave-8; color: var(--color-wave-error); }
```

- **Paths and globs.** Files, directories (walked for the file types below) and globs with `*`, `**`, `?`, `{a,b}` and `[…]`. `node_modules` and `.git` are never read or written.
- **What it reads, never a comment:** in `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts` and `.cts` the string literals and the text of template literals (JSX attribute values included, JSX text not); in `.css` the `@apply` lists and every theme variable use; in `.html`, `.vue`, `.svelte` and `.mdx` the class attributes (`class`, `className`, `:class`, `v-bind:class`, `class:list`, Svelte's `class:` names), the theme variables of `style` attributes and their `<script>` and `<style>` blocks (MDX's fenced code blocks are left alone).
- **What it rewrites:** a utility of one of the 144 color tokens with any of 31 color utilities (`bg`, `text`, `border` and its sides, `ring`, `outline`, `fill`, `stroke`, `shadow`, `from`, `via`, `to`, …), a step of the type ramp (`text-…`), a shadow level (`shadow-…`), with its variants (`dark:`, `hover:`, `data-[…]:`), its modifier (`/50`) and its important mark (`!bg-primary`, `bg-primary!`); a theme variable use (`var(--color-primary)`, `theme(--text-body-1--line-height)`, `bg-(--color-primary)`). It leaves alone a declaration (`--color-primary: …` in a theme of yours, a style object's `'--color-primary': x`), a registration (`@property --color-primary`), a word that is no utility (`'primary'`), a file name (`'bg-success.png'`), a class already migrated (a second run changes nothing) and a class with Wave's own prefix (`wave:bg-primary`).
- **Shared names.** 17 of Wave's color names are a stock shadcn/ui theme's too: `background`, `foreground`, `card`, `card-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `primary`, `primary-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`. **Without `--include-shared` the codemod never rewrites them**, in any app: it leaves `bg-primary`, `text-foreground`, `border-border`, `ring-ring` and the rest as they are and counts them in its summary, because in an app with shadcn/ui they are the app's own classes. The same goes for the names the scanned files declare as their own theme keys (`--color-success: …`, as DaisyUI or Bootstrap themes have `success`, `error`, `info`; scan your theme's CSS with the rest for these to be found). An app without shadcn/ui and without a theme of its own, whose `bg-primary` meant Wave's token, passes `--include-shared` (the third command above); an app with both kinds rewrites the shared names it used for Wave by hand.
- **Exit code:** 0 when the run completed, changed or not; 1 when a file could not be read or written, or no file matched; 2 on a usage error.

What the codemod cannot find (search for these by hand):

- **Selectors of Wave's utility classes** in your CSS and tests: `.bg-primary`, `.flex`, `querySelector('.p-4')`, `toHaveClass('bg-primary')` on a Wave element. Wave's classes are `wave:bg-primary` now, and internal: select the stable classes (`.wave-button`, `buttonClassNames.root`) or the `data-*` attributes, which semver covers. Server-rendered HTML carries the prefixed classes, so snapshots of it change.
- **Class names assembled at run time** (`` `bg-${tone}` ``) and classes in files of other types.
- **Reveals against Wave's rows.** The rows carry group markers with the prefix (`wave:group/table-row` on Table and DataGrid rows, `wave:group/row` on a Tree's, `wave:group/nav-row` on Nav's, `wave:group/grid` on a DataGrid with `subtleSelection`), so a `group-hover/table-row:` class of yours matches nothing: put a group of your own on the row (`className="group/my-row"`, then `group-hover/my-row:`).
- **The setup changes below**, which no file shows.

### What changes in each setup

**Without Tailwind (`./styles`):**

- A Tailwind class you pass in `className` still merges with the component's classes and removes the conflicting one, but `./styles` defines only Wave's own `wave:` classes. 0.18.1's sheet happened to define the generic utilities the components used (`.p-2`), so such a class could work by accident; in 1.0 `className="p-2"` on a Button removes its padding and adds none. Pass classes of your own CSS, or the token utilities of `./utilities` (colors, type ramp, shadows, font families and animations only).
- `./styles` stays unlayered, so an unlayered reset of yours (`*{margin:0}`, normalize, Bootstrap's reboot) still cannot strip the components.

**With Tailwind (`./tailwind`):**

- **Your theme no longer reaches the components.** 0.x's `./tailwind` scanned Wave's `dist` (`@source '../../dist'`), so your build generated the components' classes itself, against your `@theme`: your `--spacing`, `--radius-*`, font weights and line heights, and the unnamespaced keys Wave shared with your theme (`--color-primary`, `--text-body-1`, `--shadow-4`; the 0.17 notes said an `@theme` of yours that sets `--shadow-N` keeps its value) restyled Wave's components too. In 1.0 they come precompiled in `dist/components.css`, every theme value inlined, so an `@theme` of yours styles your own classes only. Restyle Wave through its `--wave-*` tokens ([Customizing tokens](../README.md#customizing-tokens), `WaveProvider tokens`), and its parts through `className`, `slotProps` and the stable `wave-*` classes. Your build also no longer generates the classes the components use: a class of yours that worked only because Wave's `dist` held it (one your build's sources never show, such as a class from a CMS) is not generated any more; make it visible to your build (`@source`, `@source inline()`).
- Any utility of yours, and any unlayered rule of yours, wins over Wave's classes, in either import order: across layers the layer decides, not the specificity. A bare background class of yours on a component (`className="bg-wave-error"`) therefore also covers its hover, pressed, selected and disabled backgrounds, which Wave's gated classes kept in 0.x; give those states their colors too, with Wave's gate (`not-disabled:not-aria-disabled:hover:bg-wave-destructive/90`; [Buttons](../README.md#buttons)).
- A class of yours in `@layer components` shares the layer with Wave's utilities, so specificity decides, then source order: a one-class rule of yours that comes later wins over Wave's resting classes (in 0.x Wave's utilities sat in `utilities` and won), while Wave's gated hover and pressed classes (0,4,0) and state classes (`data-[selected]:…`, 0,2,0) still win over it.
- As in 0.18, your own `@layer base` rules share the layer with Wave's zero-specificity base styles, and an unlayered reset of yours strips the components' utilities: put it in `@layer base`. A token override of yours in `@layer base` targets the theme selectors (`:root, .wave-light { --wave-primary: … }`): a provider root declares its theme's tokens again, so `:root` alone reaches only the theme-independent ones (the ramps).
- `@keyframes wave-*` appears twice in your CSS (Wave's sheet and the namespaced theme): identical, harmless. Tailwind's `--tw-*` properties are shared between your build and Wave's sheet, as in 0.x.
- Never import `./styles` as well: it would define the components' classes a second time, unlayered.

## `ref` reaches the control

On a form control whose root wraps one focusable element, `ref` now reaches that element, as Fluent's `ref` reaches a control's primary element; `className`, `style` and the other root props stay on the root, which `slotProps.root` reaches with its `ref`. Twelve components move their `ref` and lose `controlRef`:

| Component | `ref` in 0.18 | `ref` in 1.0 | `controlRef` in 0.18 |
|---|---|---|---|
| Checkbox | the root `<label>` | the `role="checkbox"` `<button>` | the button; removed |
| Switch | the root `<label>` | the `role="switch"` `<button>` | the button; removed |
| SearchBox | the root `<div>` | the `<input type="search">` | the input; removed |
| SpinButton | the root `<div>` | the `<input role="spinbutton">` | the input; removed |
| ColorSlider, AlphaSlider | the root `<div>` | the range `<input>` | the input; removed |
| `ColorPicker.HexField` | the root `<label>` | the hex `<input>` | the input; removed |
| Combobox | the root `<div>` | the `<input role="combobox">` | the input; removed |
| Dropdown | the root `<div>` | the `<button role="combobox">` | the button; removed |
| TimePicker | the root `<div>` | the `<input role="combobox">` | the input; removed |
| DatePicker | the root `<div>` | the text `<input>` | the input; removed |
| TagPicker | the root `<div>` | the trigger that renders: the `<input role="combobox">` of `TagPicker.Input` (also the built-in one) or the `<button role="combobox">` of `TagPicker.Button` | `TagPicker.Input`'s input only; removed |

Each of them, and `RadioGroup.Item`, takes the `root` part, `slotProps.root`, for its root element: its `ref`, classes, style, attributes and handlers. Input's `ref` (its `<input>`) and `slotProps.root` are as in 0.18, and so is `RadioGroup.Item`'s `ref` (its `role="radio"` button), whose `<label>`, which no ref reached, is now `slotProps.root.ref`. `controlRef` stays on ColorArea, `Table.SelectionCell` and `DataGrid.SelectionCell`; on every other component `ref` reaches the root, as before.

```tsx
// 0.18
<Checkbox ref={labelRef} controlRef={buttonRef} label="Remember me" />
// 1.0
<Checkbox ref={buttonRef} slotProps={{ root: { ref: labelRef } }} label="Remember me" />
```

**What the type check finds.** `controlRef` is no prop of the twelve, and a ref object typed for the root (`useRef<HTMLDivElement>`, `useRef<HTMLLabelElement>`) no longer fits their `ref`. Two holes it does not find, so search `ref=` on these components by hand:

- A callback ref or a state setter typed for a `<div>` still compiles on SearchBox, SpinButton, ColorSlider, AlphaSlider, Combobox, TimePicker and DatePicker, whose control is an `<input>`: an `HTMLInputElement` has every member of an `HTMLDivElement`, so `(element: HTMLDivElement | null) => …` accepts it, and now receives the input. Dropdown's `<button>` and TagPicker's trigger reject one. The other way round, `slotProps.root.ref`, typed for the `<div>`, accepts a ref object typed for the input.
- TagPicker's `ref` is `Ref<HTMLInputElement | HTMLButtonElement>`, and reaches `TagPicker.Button` too, which `controlRef` never did. A state setter passed to it takes state typed for both triggers (or `HTMLElement`): one typed for the input alone, which compiled as `controlRef`, is a type error. A ref object or callback typed for the input alone still compiles, and receives the button where a parts form renders `TagPicker.Button`.

**What else reaches the control** (no code of yours changes): `Popover.Trigger`, `Menu.Trigger` and `TeachingPopover.Trigger` around one of these controls place their surface against the control and return focus to it (each merges its ref into the child's `ref`), and a press on the rest of the root (a Switch's label text) is outside the trigger, so with the popover open it closes it and the label's click opens it again; their `aria-expanded` and `aria-controls` stay on the root as in 0.18, where a `<label>` or a `<div>` cannot carry them, so such a control makes no click trigger, and a context Menu (`openOnContext`) is the composition to use. Tooltip places its surface against its own wrapper, as before. `Overflow.Item asChild` measures the control, not the whole component, so a control whose root is wider (a Checkbox with its label) can overflow the row by the difference: put it in an `Overflow.Item` without `asChild`. `Presence` puts its attributes on the root and waits for the control's animations: for motion on the root, pass its render function's `ref` to `slotProps.root` ([README](../README.md#ref-and-controlref)).

**The root part's rules.** Your classes and style come after the component's `className` and `style`, your handlers run before the component's own root handlers (`preventDefault()` in yours skips them), and the component keeps its enumerated `data-*` attributes, its own root props and its hidden state; a `<label>` root (Checkbox, Switch, `RadioGroup.Item`, `ColorPicker.HexField`) takes no `htmlFor` from the part. While Checkbox, Switch or a radio is disabled your root `onClick` is not called, as with Input's bordered wrapper since 0.18; the roots of the other movers pass no click to their control and call it in every state. A click on a label root's text reaches its `onClick` twice, as on any `<label>`: for the text, then for the click the label passes to the control.

## Removed in 1.0

Each item is gone, with no alias. Every replacement works in 0.x too, so you can switch before upgrading. TypeScript reports each removed prop, value, call form and export; an import of a removed stylesheet fails to resolve; a removed class or variable in your CSS no longer matches or applies, without a message.

| Before | After | Announced in | Warned in 0.18 |
|---|---|---|---|
| Checkbox `onChange(checked)` | `onCheckedChange(checked)` | 0.5 | yes |
| Switch `onChange(checked)` | `onCheckedChange(checked)` | 0.5 | yes |
| RadioGroup `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| Rating `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| SearchBox `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| SpinButton `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| ColorPicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| SwatchPicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| TagPicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| TimePicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| DatePicker `onChange(date)` | `onValueChange(date)` | 0.5 | yes |
| Combobox `onOptionSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| Dropdown `onOptionSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| TabList `selectedValue` | `value` | 0.5 | yes |
| TabList `defaultSelectedValue` | `defaultValue` | 0.5 | yes |
| TabList `vertical` | `orientation="vertical"` | 0.5 | yes |
| TabList `onTabSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| Nav `selectedValue` | `value` | 0.5 | yes |
| Nav `defaultSelectedValue` | `defaultValue` | 0.5 | yes |
| Nav `onNavItemSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| `Nav.Category` without `label` (its text children are the label) | `label`, now required, with only the sub-items as children | 0.5 | yes |
| TeachingPopover `currentStep` | `activeStep` | 0.5 | yes |
| TeachingPopover `defaultCurrentStep` | `defaultActiveStep` | 0.5 | yes |
| List `selectionMode="multi"` | `selectionMode="multiple"` | 0.5 | yes |
| DataGrid `selectedKeys` (a `Set`) | `selectedItems` (an array) | 0.5 | yes |
| DataGrid `defaultSelectedKeys` (a `Set`) | `defaultSelectedItems` (an array) | 0.5 | yes |
| DataGrid `onSelectionChange(Set)` | `onSelectedItemsChange(selectedItems, details)` (an array) | 0.5 | yes |
| DataGrid `sortColumn` | `sort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| DataGrid `sortDirection` | `sort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| DataGrid `defaultSortColumn` | `defaultSort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| DataGrid `defaultSortDirection` | `defaultSort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| `Table.Head` (flat `TableHead`, type `TableHeadProps`) | `Table.Header` (flat `TableHeader`, type `TableHeaderProps`) | 0.5 | yes |
| `Table.HeadCell` (flat `TableHeadCell`, type `TableHeadCellProps`) | `Table.HeaderCell` (flat `TableHeaderCell`, type `TableHeaderCellProps`) | 0.5 | yes |
| Stack `direction` | `orientation` (same values) | 0.5 | yes |
| Skeleton `variant` | `shape` (`circular` stays; `text` and `rectangular` take the default shape) | 0.5 | yes |
| Text numeric `weight` (`400`, `600`, `700`) | `weight="regular"`, `"semibold"`, `"bold"` | 0.5 | yes |
| Link `variant` (type `LinkVariant`) | `appearance` (type `LinkAppearance`), same values | 0.5 | yes |
| Tooltip `variant="dark"` and `variant="light"` | `appearance="inverted"` and `appearance="normal"` | 0.5 | yes |
| Accordion `openItems` in single mode | `openItem` (`string` or `null`) | 0.5 | yes |
| Accordion `defaultOpenItems` in single mode | `defaultOpenItem` (`string` or `null`) | 0.5 | yes |
| Accordion `onOpenItemsChange` in single mode | `onOpenItemChange(value)` | 0.5 | yes |
| MessageBar `dismiss` with button props (`{ as: "button", onClick, … }`) | icon content in `dismiss`, and `onDismiss` | 0.5 | yes |
| SearchBox `dismiss` with button props (`{ as: "button", onClick, … }`) | icon content in `dismiss`, and `onClear` | 0.5 | yes |
| Tag `dismissIcon` with button props (`{ onClick, type, disabled, … }`) | icon content in `dismissIcon`, and `onDismiss` | 0.5 | yes |
| `@mortenbrudvik/waveui/legacy-tokens.css` (the 0.4 variable names) | the `--wave-*` variables | 0.5 | no |
| The theme classes `dark` and `high-contrast` in your CSS | `wave-dark` and `wave-high-contrast` | 0.5 | no |
| `src/styles/animations.css` (empty since 0.5) | nothing: drop the import | 0.18 | no |
| Overrides of the 0.4 ramp names `--brand-N` and `--grey-N` (still read by the `--wave-*` ramps through 0.18) | `--wave-brand-N` and `--wave-grey-N` | not announced | no |
| Tooltip `delay` | `openDelay` | 0.7 | yes |
| Input numeric `size` (or a string of digits) | `htmlSize` | 0.9 | yes |
| Select numeric `size` (or a string of digits) | `htmlSize` | 0.9 | yes |
| Slider numeric `size` | nothing: it has no effect, remove it | 0.9 | yes |
| InfoLabel `label` | `children` | 0.9 | yes |
| The classes `wave-tag-picker__control` and `wave-tag-picker__group` (`tagPickerClassNames.control` and `tagPickerClassNames.group`) | `wave-tag-picker-control` and `wave-tag-picker-group` (`tagPickerControlClassNames.root` and `tagPickerGroupClassNames.root`) | 0.11 | no |
| PresenceBadge `status` `'dnd'` and `'oof'` (type `DeprecatedPresenceStatus`) | `'do-not-disturb'` and `'out-of-office'` | 0.13 | yes |
| `DataGridColumn.id` | `columnId` | 0.14 | yes |
| `useRovingTabIndex(containerRef, options)` | `useRovingTabIndex(options)` and its `containerProps` | 0.18 | yes |
| DataGrid `onSortChange(columnId, direction)` without `items`, `sort` or `defaultSort` (type `DataGridLegacySortProps`) | `onSortChange(sort, details)`, with `items`, `sort` or `defaultSort` | 0.18 | yes |
| `Menu.Popover` `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |
| `Dialog.Content` `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |
| Drawer `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |
| NavDrawer `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |
| `controlRef` of the twelve controls of [`ref` reaches the control](#ref-reaches-the-control) | `ref` (the root: `slotProps.root.ref`) | not announced | no |

**The entry** no longer exports the values `TableHead` and `TableHeadCell` (nor `Table.Head` and `Table.HeadCell`) and the types `TableHeadProps`, `TableHeadCellProps`, `DataGridLegacySortProps`, `LinkVariant` and `DeprecatedPresenceStatus`, and the `exports` map has no `./legacy-tokens.css`. Nothing else left the entry: `ListSelectionMode` stays (now `'single' | 'multiple'`, the same as `SelectionMode`), and so does `StrictImageProps` (now the same type as `ImageProps`).

Notes on some rows:

- **Value callbacks.** `onValueChange`, `onCheckedChange` and `onOpenItemChange` fire only when the value changes. `onOptionSelect`, `onTabSelect` and `onNavItemSelect` fired on every activation, also of the item already selected, and their replacements do not.
- **`Nav.Category`** requires `label`; its children are the sub-items only.
- **Accordion** declares `openItems`, `defaultOpenItems` and `onOpenItemsChange` as `never` in single mode, so passing one without `type="multiple"` is a type error; multiple mode keeps them.
- **DataGrid's positional `onSortChange`.** A grid without `items`, `sort` or `defaultSort` takes no `onSortChange` in the types at all, the object form included, so every positional use fails loudly. To hear the sort of an uncontrolled grid, pass `defaultSort={null}`:

  ```tsx
  // 0.18
  <DataGrid columns={columns} onSortChange={(columnId, direction) => load(columnId, direction)}>
    {rows}
  </DataGrid>
  // 1.0
  <DataGrid columns={columns} defaultSort={null} onSortChange={(sort) => load(sort?.columnId, sort?.direction)}>
    {rows}
  </DataGrid>
  ```

- **`useRovingTabIndex`** has one signature. The hook finds its container through the `ref` of the `containerProps` it returns:

  ```tsx
  // 0.18 (the 0.4 call shape)
  const roving = useRovingTabIndex(toolbarRef, { orientation: 'horizontal' });
  <div ref={toolbarRef} role="toolbar" onKeyDown={roving.handleKeyDown}>…</div>
  // 1.0
  const { containerProps } = useRovingTabIndex({ orientation: 'horizontal' });
  <div role="toolbar" {...containerProps}>…</div>
  ```

- **The dismiss and clear slots.** A `<button>` or `Button` element passed to MessageBar `dismiss`, SearchBox `dismiss` or Tag `dismissIcon` is still merged into the built-in button, which keeps its label and wiring. A slot object is always the content inside that button: its attributes, `className`, `style`, `ref` and handlers stay on the content element, and only its naming attributes reach the button (in Tag, its other `aria-*` too). A slot object whose `as` is `'button'` or Wave's `Button` cannot be the content (a button in a button) and is unwrapped: its children render as the content (the default icon when it has none), its props are dropped, and a development warning says so (`MessageBar:dismiss-button-slot-object`, `SearchBox:dismiss-button-slot-object`, `Tag:dismissIcon-button-slot-object`). So `dismiss={{ onClick }}`, which TypeScript accepts (a `<span>` takes an `onClick`), puts the handler on the content `<span>`: a pointer click on the icon calls it, Enter and Space on the button do not, and `preventDefault()` in it no longer cancels `onDismiss` or `onClear`. Handle the press in `onDismiss` or `onClear`. The `closeButton` of Dialog, Drawer and NavDrawer and TeachingPopover's `dismissButton` are unchanged.
- **A `className` with presence variants.** Through 0.x a `className` on `Menu.Popover`, `Dialog.Content`, Drawer or NavDrawer that held presence variants (classes keyed on `data-[presence=…]`, the motion of 0.14) turned the part's default motion off. In 1.0 it is a plain class list, composed after the default motion: a class of the same variant replaces only the default's conflicting class, so both motions would apply. Pass your motion classes as `motion`, which replaces the default:

  ```tsx
  // 0.18
  <Dialog.Content className="transition-opacity motion-reduce:transition-none data-[presence=exiting]:opacity-0">…</Dialog.Content>
  // 1.0
  <Dialog.Content motion="transition-opacity motion-reduce:transition-none data-[presence=exiting]:opacity-0">…</Dialog.Content>
  ```

- **The theme classes.** `WaveProvider` and the portal wrappers carry only `wave-light`, `wave-dark` or `wave-high-contrast`, and Wave's styles select only those. A Tailwind `dark:` variant of your own that keys on the class (`@custom-variant dark (&:where(.dark, .dark *));`) keys on `.wave-dark` instead.
- <a id="the-04-variable-names"></a>**The 0.4 variable names.** `legacy-tokens.css` defined the 0.4 semantic names, and through 0.18 `tokens.css` read the 0.4 ramp names as fallbacks (`--wave-brand-80: var(--brand-80, #0f6cbd)`), so an override of `--brand-80` or `--grey-38` still re-themed Wave. 1.0 reads none of them: each ramp stop is its own value, and such an override stops applying without a message. Override the `--wave-*` names, which work since 0.5, or generate the brand ramp with `createBrandTokens`:

  ```css
  /* 0.18: still re-themed Wave */
  :root { --brand-80: #c43e00; }
  /* 1.0 */
  :root { --wave-brand-80: #c43e00; }
  ```

- **A numeric `size`** on Input and Select is skipped like any value outside the sizes: no native attribute, the `medium` design size. `htmlSize` sets the attribute.
- **PresenceBadge `'dnd'` and `'oof'`** make the badge throw a `TypeError` while it renders, as any status outside the union did in 0.18, with no warning before it. A status that comes from your server's data is not type-checked: map the old values before rendering (`status === 'dnd' ? 'do-not-disturb' : …`).
- **`DataGridColumn.id`.** A column with only `id` has no id: its header is not sortable, with the development warnings of a column without `columnId`.

### Untyped code

What a removed form does at run time in 1.0, in code that TypeScript does not check (Wave strips nothing and warns about none of them):

- `onChange` on Checkbox, Switch, RadioGroup, Rating and SwatchPicker lands on the root as React's change handler and is never called; on SearchBox, SpinButton, ColorPicker, TagPicker, TimePicker and DatePicker it may receive the native change event of the input inside, never the value.
- `onOptionSelect`, `onTabSelect`, `onNavItemSelect` and DataGrid's `onSelectionChange` are never called; React logs ``Unknown event handler property `onOptionSelect`. It will be ignored.`` in development.
- TabList's and Nav's `selectedValue` and `defaultSelectedValue`, TeachingPopover's `currentStep` and `defaultCurrentStep`, DataGrid's six selection and sort props and the twelve controls' `controlRef` reach an element as unknown props: React logs its unknown-prop error once per name and renders a lowercase attribute (`controlref="[object Object]"`); the component keeps its own state (the first tab, nothing current, the first step, an unsorted grid with nothing selected), and the `controlRef` stays `null`. TabList's `vertical` renders nothing, React logs its error for a non-boolean attribute (``Received `true` for a non-boolean attribute `vertical`.``), and the list stays horizontal.
- Stack `direction`, Tooltip `variant` and `delay`, Skeleton and Link `variant` and InfoLabel `label` render as plain attributes without a message, and the defaults apply. A single-mode Accordion ignores `openItems`, `defaultOpenItems` and `onOpenItemsChange`.
- A numeric Text `weight` gets no weight class (the variant's own weight); a numeric Slider `size` is medium.
- `Table.Head` and `Table.HeadCell` are `undefined`, so rendering one throws React's invalid element type error; PresenceBadge throws for `'dnd'` and `'oof'` (above).
- `useRovingTabIndex(ref, options)` reads the ref as the options and ignores the options: no item holds the tab stop, while the arrow keys still move between the `[data-roving-value]` items of the element the key handler is on.
- A grid without `items`, `sort` or `defaultSort` that gets an `onSortChange` calls it with the sort object and `details`.
- A `Nav.Category` without `label` renders a toggle with no name and its text in the sub-items' list, where the development warning about a list's text names it.
- An `Image` without `alt` renders none and warns once in development: ``Image: `alt` is required. Describe the image, or pass alt="" when it is decorative.``

## Defaults and meanings that change

Nothing is removed here, but the same code looks or behaves differently in 1.0.

| Before | After | Announced in | Warned in 0.18 |
|---|---|---|---|
| Badge `color="important"` (orange) | Fluent's neutral high-emphasis color; `color="severe"` for the orange look | 0.6 | yes |
| CounterBadge `color="important"` (orange) | Fluent's neutral high-emphasis color; `color="severe"` for the orange look | 0.6 | yes |
| TeachingPopover's Done calls `onFinish`, then `onDismiss` | Done calls `onFinish` only: handle Done there | 0.14 | no |
| TimePicker without `format` (12-hour times) | the hour cycle of the browser's language; `format="12h"` keeps 12-hour times | 0.18 | no |

- **Badge and CounterBadge `important`** draw the page's text color as the fill with the page color as the text (near black with white text in the light theme, white with dark text in the dark one); the tint appearance fills with the secondary text color, and the outline appearance draws the accessible neutral stroke. A CounterBadge's dot takes the filled look. In the high-contrast theme the tint looks like the filled badge. `severe` keeps the orange that `important` drew through 0.x.
- **TeachingPopover's Done** on the last step calls `onFinish` only; Close, Escape and the Trigger call `onDismiss` as before.
- **TimePicker `format`** stays `'12h'` or `'24h'` when you give it, and reads nothing else then. Without it, a TimePicker follows the hour cycle of `navigator.language` (12-hour in `en-US`, 24-hour in `en-GB`, `de-DE` and many other languages). On the server, and in the render that hydrates the server's HTML, it shows 12-hour times, so hydration matches; right after mounting it switches to the browser's hour cycle. A TimePicker mounted in the browser without server HTML follows the language from its first render. A change of the browser's language while the page is open is not followed. Pass `format` for the same output on the server and in the browser. TimePicker has no `hourCycle` or `locale` prop.

## Arguments and props that become required

The `details` argument of every change callback that has one is required, so code that calls one of these props itself (a wrapper that forwards it, a test that invokes it) passes it; a handler you give may still ignore it. WaveUI passes `details` on every change it makes. Three paths passed none in 0.x and pass one in 1.0: `useTableSort`'s `setColumnSort` and `toggleColumnSort` called without an event report `{ event: new Event('sort') }`; `useFlatTree`'s `setChecked` without an event reports `{ value, checked, event: new Event('check') }`; and `Table.SelectionCell`'s form reset reports the form's own `reset` event. The `sort` and `check` events are untrusted and have no target, as the `new Event('resize')` that `useTableColumnSizing` reports.

```tsx
// A button of yours that closes a controlled Dialog through its onOpenChange
// 0.18
<Button onClick={() => onOpenChange(false)}>Cancel</Button>
// 1.0
<Button onClick={(event) => onOpenChange(false, { reason: 'close', event: event.nativeEvent })}>Cancel</Button>

// A handler reads details without the optional chaining of 0.x
const handleOpenChange = (open: boolean, details: OpenChangeDetails<ModalOpenChangeReason>) => {
  if (details.reason === 'escape') audit('dismissed');
  setOpen(open);
};
```

| Before | After | Announced in | Warned in 0.18 |
|---|---|---|---|
| Dialog `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.6 | no |
| Drawer `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.6 | no |
| Menu and Toolbar `onCheckedValuesChange(checkedValues, details?)` | `onCheckedValuesChange(checkedValues, details)` | 0.7 | no |
| Tree `onCheckedItemsChange(checkedItems, details?)` | `onCheckedItemsChange(checkedItems, details)` | 0.8 | no |
| Calendar `onValueChange(date, details?)` | `onValueChange(date, details)` | 0.10 | no |
| `useListbox` `onOpenChange(open, details?)` and `onSelect(value, details?)` | `onOpenChange(open, details)` and `onSelect(value, details)` | 0.10 | no |
| NavDrawer `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.11 | no |
| Overflow `onOverflowChange(hiddenItems, details?)` | `onOverflowChange(hiddenItems, details)` | 0.14 | no |
| DataGrid `onSortChange(sort, details?)` | `onSortChange(sort, details)` | 0.14 | no |
| DataGrid `onSelectedItemsChange(selectedItems, details?)` | `onSelectedItemsChange(selectedItems, details)` | 0.14 | no |
| `Table.SelectionCell` `onCheckedChange(checked, details?)` (no `details` on a form reset) | `onCheckedChange(checked, details)`, a form reset included | 0.14 | no |
| AvatarGroup `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.18 | no |
| DataGrid and `useTableColumnSizing` `onColumnWidthsChange(widths, details?)` | `onColumnWidthsChange(widths, details)` | 0.18 | no |
| `Table.ResizeHandle` `onResize(width, details?)` | `onResize(width, details)` | 0.18 | no |
| `useTableSort` `onSortChange(sort, details?)` (no `details` when `setColumnSort` or `toggleColumnSort` gets no event) | `onSortChange(sort, details)`, also without an event | 0.18 | no |
| `useSelection` `onSelectedItemsChange(selectedItems, details?)` | `onSelectedItemsChange(selectedItems, details)` | 0.18 | no |
| `useFlatTree` (FlatTree) `onCheckedItemsChange(checkedItems, details?)` (no `details` when `setChecked` gets no event) | `onCheckedItemsChange(checkedItems, details)`, also without an event | 0.18 | no |
| Image without `alt` (`ImageProps.alt` optional) | `alt` required (`alt=""` for a decorative image); `StrictImageProps` an alias | 0.18 | yes |

The details types themselves are unchanged (`UseSelectionChangeDetails` keeps its optional `event` and `id`). One `details` stays optional: the `onResize(width, details?)` of the bindings `useTableColumnSizing` hands to a resize handle (`getResizeHandleProps`), which a handle calls, so a handle of your own may call it without one (the hook then reports `new Event('resize')`).

`Image.alt` is a `string` on `ImageProps`, and `StrictImageProps` is the same type. JavaScript that leaves `alt` out gets the development warning of [Untyped code](#untyped-code).

## What no code can detect

Search your code for these; neither the type check nor a warning finds them:

- **CSS:** the selectors `.dark` and `.high-contrast` (and a class-based `dark:` variant keyed on `.dark`), the classes `wave-tag-picker__control` and `wave-tag-picker__group`, overrides of `--brand-N` and `--grey-N`, selectors of Wave's 0.x utility classes (`.bg-primary`, `.flex`), and `group-hover/table-row:`-style reveals against Wave's rows ([The migration codemod](#the-migration-codemod)).
- **Without Tailwind:** a Tailwind class in `className` that worked because Wave's sheet happened to define it (`p-2`).
- **With Tailwind:** an `@theme` of yours that restyled Wave's components (`--spacing`, `--radius-*`, `--shadow-N`, an unnamespaced `--color-*` or `--text-*` key), which no longer reaches them; a class of yours that your build generated only because Wave's `dist` used it; a bare color class of yours on a component that now also covers its hover, pressed, selected and disabled colors; and `@layer components` classes of yours that now compete with Wave's by specificity and order ([What changes in each setup](#what-changes-in-each-setup)).
- **`ref` and the components that read it:** callback refs and state setters typed for a `<div>` on SearchBox, SpinButton, ColorSlider, AlphaSlider, Combobox, TimePicker and DatePicker; code that measured, positioned or animated the root of one of the twelve controls through `ref`, directly or through `Overflow.Item asChild`, `Presence`, `Popover.Trigger`, `Menu.Trigger` or `TeachingPopover.Trigger` ([`ref` reaches the control](#ref-reaches-the-control)).
- **Behaviour:** a TeachingPopover whose `onDismiss` must also run when Done is pressed; a TimePicker without `format` whose users need 12-hour times; the look of `color="important"`; a dismiss slot object with handlers or button attributes.
- **Data:** PresenceBadge statuses `'dnd'` and `'oof'` from your server.
- **Types:** a props object built apart from the element (`const props = { …, onTabSelect }`, then `{...props}`): TypeScript checks a literal for excess properties, not a spread object, so a removed prop in it compiles; and a `type` key on a dismiss slot object, which TypeScript accepts.

## Where the list comes from

The tables restate the 1.0 inventory that 0.18 shipped as `src/lib/deprecations.ts` (84 rows: 61 removals, 4 default changes, 18 required arguments and props, and the decision to keep `ref` where it was), which a test kept in step with the code, the CHANGELOG and this guide. Phase 14 of the [roadmap](ROADMAP.md) made every change and then retired the inventory and its test: 83 rows are done, and the `ref` decision was reversed by the maintainer ([`ref` reaches the control](#ref-reaches-the-control)). `src/__tests__/removedApi.test.ts` now keeps the removed exports, types, stylesheets, theme classes, variable names and classes absent, and each component's tests pin its removed props as type errors and their run time for untyped code. The [CHANGELOG](../CHANGELOG.md) restates every row in its 1.0.0 section, next to the changes no 0.x release announced.
