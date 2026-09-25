# CLAUDE.md — waveui

## What is this?

`@mortenbrudvik/waveui` (the npm name since 0.4.0; the repository's `package.json` said `waveui` before 0.5): a React 19 component library of 65 components inspired by the Fluent UI 2 design language, built with TypeScript, Tailwind CSS 4 and `--wave-*` CSS custom properties, with light, dark and high-contrast themes and RTL support. It is **not** Microsoft's `@fluentui/react-components`.

User docs: `README.md` (install, styles, theming, RSC, keyboard), `CHANGELOG.md`, `docs/WAVE-UI-GUIDE.md` (design and development guide), `docs/testing-best-practices.md` (how to test here). The 0.5 design and every convention below come from `docs/superpowers/specs/2026-09-23-review-fixes-design.md` (§1 lists the C-* conventions in full). Fluent UI v9 parity: `docs/ROADMAP.md` (the plan from 0.6 to 1.0, one phase per minor release; its gap ids come from `docs/research/fluent-ui-v9-comparison.md`) and the 0.6 design, `docs/superpowers/specs/2026-09-25-fluent-parity-phase-1-design.md` (its design rulings, and implementation notes where the code deliberately deviates; the glyph-slot and data-attribute rules are written into C-SLOTS and C-CLASS below). Each later phase gets its own spec before work starts.

## Commands

```bash
npm run build            # tsc -p tsconfig.json --noEmit, vite build (ESM+CJS, preserved modules),
                         # node scripts/build-css.mjs (dist/styles.css, dist/preflight.css),
                         # node scripts/verify-dist.mjs
npm test                 # all Vitest tests (unit, integration, conventions gate, stories axe gate)
npm run test:watch       # Vitest watch mode
npm run test:coverage    # V8 coverage with thresholds
npm run typecheck        # three programs: tsconfig.json (library), tsconfig.dev.json (tests, stories,
                         # .storybook), tsconfig.node.json (vite/vitest configs), then
                         # node scripts/check-ts-coverage.mjs (fails if the dev program stops
                         # covering tests/stories or the library program starts covering them)
npm run dev              # Storybook on port 6006 (theme and direction toolbars); also `npm run storybook`
npm run build-storybook  # storybook build + node scripts/verify-storybook.mjs (story-only utilities, and
                         # every wave-rtl: class of the library with Wave's direction variant)
npm run lint             # ESLint over src/ stories/ .storybook/ scripts/ (--max-warnings 0: a warning fails)
npm run lint:fix         # ESLint with auto-fix (same directories as lint)
npm run format           # Prettier write (src, stories, .storybook, scripts)
npm run format:check     # Prettier check (LF line endings)
npm run check:package    # publint + attw (node16 profile) on a tarball packed by scripts/attw-pack.mjs
npm run test:pack        # node scripts/pack-smoke.mjs: packs the tarball, installs it into the
                         # plain and Tailwind fixtures under scripts/fixtures and checks CSS and types
                         # (the Tailwind fixture also builds a custom ./tokens + ./variants.css setup;
                         # both fixtures are also built with Vite's defaults, and every wave-rtl: class
                         # of dist must keep the direction variant, with no :lang() rewrite)
node scripts/build-css.mjs          # CSS only, with the output assertions listed in the script's header
node scripts/verify-dist.mjs --final  # publish gate for dist (also run by prepublishOnly; checks in its header)
```

Focused runs:

```bash
npx vitest run src/components/input/__tests__/Switch.test.tsx
npx vitest run src/__tests__/conventions.test.ts -t "src/components/input/Switch.tsx"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/Switch"
npx vitest run <files> --reporter=default   # shows console output of passing tests (act() warnings,
                                            # unasserted [WaveUI] warnings) that agent mode hides
npx tsc -p tsconfig.dev.json --noEmit
```

`prepublishOnly` runs typecheck, build, `verify-dist --final`, tests, `check:package` and `test:pack`. Do not hard-code test counts anywhere.

## Architecture

- `src/components/<category>/` — `button`, `input`, `data-display`, `typography`, `layout`, `navigation`, `feedback`, `overlays`, `table`, `provider` (WaveProvider). Plus `portal/` (public `Portal`) and `internal/` (`HiddenInput`, never exported). Component-private helpers sit next to their component with a prefixed name (`buttonStyles.ts`, `Button.semantics.ts` (`useButtonSemantics`: role, tab stop, Enter/Space activation and disabled/`disabledFocusable` handling shared by Button and Link), `Button.slots.tsx` (how other components' slots treat a `<button>`/`Button`: `BUTTON_OWN_PROP_KEYS`, `placeButtonIcon`, `MERGED_DISABLED_FOCUSABLE_PROPS`, `mergedAriaDisabledClasses` for the dismiss/clear merge of MessageBar, SearchBox and Tag; `unwrapButtonGlyph` for the glyph slots of SplitButton, MenuButton and `PickerExpandButton`), `Badge.colors.ts` (the color map shared by Badge and CounterBadge), `colorUtils.ts`, `dateUtils.ts`, `Option.tsx`, `List.registry.ts`, `MessageBar.status.tsx`, `Dialog.shared.tsx` (also `useModalOpenState`/`requestOpen` and the dismiss-reason mapping of Dialog and Drawer), `Popover.shared.tsx` (`PopoverBeak`, `usePopoverTabOrder`, shared by Popover and TeachingPopover), `input/pickerStyles.ts` (`PICKER_ICON_BUTTON_CLASSES`, `pickerEndPadding`), `input/Combobox.expand.tsx` (`PickerExpandButton`, shared by Combobox and TimePicker despite its name), `input/routedHandlers.ts`, `table/useGridNavigation.ts`; test-only: `table/__tests__/tabIndexWrites.ts`).
- `src/hooks/` — public: `useControllable`, `useId`, `useEventCallback`, `useRovingTabIndex`, `useMergedRefs`, `useIsClient`, `useFieldControl` (+ the types `FieldContextValue`, `FieldControlProps`, `UseFieldControlOptions`), `useAnnounce`/`announce`. Internal: `FieldContext`/`useFieldContext` (same module as `useFieldControl`, not exported from `src/index.ts`), `useDismiss`, `useFocusTrap`, `useRestoreFocus`, `useScrollLock`, `useModalIsolation`, `useModalLayer`, `usePopupPosition` (floating-ui), `useListbox`, `useFormReset`, `useTriggerElement` (with `getTriggerTarget`: the element that is the trigger), `useTypeahead` (with `isAltGraphCharacter`), `usePreserveFocus`, `usePrefersReducedMotion`, `useDirection`.
- `src/lib/` — `cn` (tailwind-merge extended with Wave's type ramp, shadows, `font-wave`, `animate-wave-*`), `slot` (`Slot`, `SlotObject`, `resolveSlot`, `renderSlot`; internal `slotRendersContent`, `materialiseSlotContent`, `slotWrapsDefaultContent`), `children` (`getElementType`, with `{ suspend: false }` for walks deeper than the direct children; `isElementOfType`, `flattenChildren`), `types` (shared unions: `Size`, `Appearance`, `Orientation`, `SelectionMode`, `TextWeight`, `Shape`, `PopupSide`, `PopupAlign`, `BadgeColor`, `IconPosition`, `ValidationState`, `LabelPosition` (components take a subset with `Extract<>`), `ModalType`, `ModalOpenChangeReason`, `OpenChangeDetails<R>`, …; new props reuse them), `polymorphic`, `composeEventHandlers`, `mergeRefs`, `mergeProps`, `renderTrigger` (also `isCloneableElement`, `unwrapFragment`), `dev` (`devWarn`, `warnOnce`, `warnDeprecated`, `resolveDeprecatedProp`, `reportMissingContext`), `aria` (`joinIds`, `focusableDisabledProps` with its `{ reachable }` option), `focus` (tabbable queries, `isHiddenInput`), `direction` (`getDirection`, `getArrowIntent`), `styles` (`focusRing`, `focusRingInset`, `inputFocus`, `inputFocusWithin`, `inputInvalid`, `inputInvalidWithin`, `forcedColors` recipes, …), `theme` (`getThemeClassName`), `icons` (internal SVG icons), `layers` (dismiss-layer stack, `Z_INDEX`), `labelInName` (dismiss/clear button naming), `globalRegistry` (singletons shared by ESM and CJS copies).
- `src/styles/` — `tokens.css` (`--wave-*` per theme + `@theme inline` mapping), `base.css` (base and native reset scoped to `.wave-root`/`.wave-portal`), `styles.css` (build input of the unlayered `dist/styles.css`), `tailwind.css` (Tailwind consumer entry), `variants.css` (the `wave-rtl:` variant, imported by `styles.css`, `tailwind.css` and `globals.css`; exported as `./variants` for custom setups on `./tokens`), `preflight.css` (opt-in), `legacy-tokens.css` (deprecated 0.4 names), `globals.css` (dev entry mirroring the Tailwind path, not exported), `animations.css` (empty, deprecated), `__tests__/tokens.test.ts` (per-theme WCAG contrast).
- `src/index.ts` and the category `index.ts` barrels define the public API. Internals stay module-only (`buttonStyles`, `Button.semantics`, `Button.slots`, `Badge.colors`, `pickerStyles`, `Combobox.expand`, `HiddenInput`, `useListbox`, `collectOptionLabels`, `useTriggerElement`, `useModalLayer`, `getPaginationRange`, `PortalDepthContext`, `Popover.shared`, `RoutedHandlers`, test utils). New public symbols go through the barrels; export every named type used in a public signature from the entry (`src/__tests__/public-types.test.ts`; its `INTERNAL_HELPERS` list names the few that stay internal); `scripts/verify-dist.mjs` checks the flat names and tree-shaking.
- Build: Vite library mode with preserved modules (`.mjs` + `.cjs`), `"use client"` banner on every module under `src/components` and `src/hooks` except `index` barrels (`src/lib` stays server-safe), rolled-up `index.d.ts` + `index.d.cts`. CSS is built separately by `scripts/build-css.mjs`.
- `scripts/` — `build-css`, `verify-dist` (its `runScript` is the shared entry guard: a gate script that cannot confirm its own path exits 1), `verify-storybook`, `pack-smoke` (+ `fixtures/plain`, `fixtures/tailwind`), `attw-pack` (attw on a self-packed tarball, for `check:package`), `check-ts-coverage`; their tests in `scripts/__tests__/`.
- `stories/` — one file per component, title `Components/<Category>/<Name>`; `.storybook/preview.tsx` wraps stories in `WaveProvider` with theme/dir toolbars, `.storybook/preview.css` compiles `styles.css` plus story classes, and `.storybook/exportDocblocks.ts` (after Storybook's docgen plugin) feeds autodocs the export JSDoc (C-DOCS).
- Tests: `__tests__/` next to each component, hook and lib module; repo-level suites in `src/__tests__/` (`conventions.test.ts`, `stories.a11y.test.tsx`, `integration.test.tsx`, `public-types.test.ts`, `test-utils.test.tsx`); helpers in `src/test-utils.ts`, `src/test-utils-field.tsx`; environment in `src/test-setup.ts`.

## Conventions (every component, hook and story)

The conventions gate (`src/__tests__/conventions.test.ts`) enforces the mechanical ones with one test per source file of `src/components` (raw colours also in `stories/`); `src/hooks` and `src/lib` (including the `src/lib/styles.ts` recipes) are review-only, as is everything else.

- **C-REF** — `ref` is declared in the Props interface (`ref?: React.Ref<HTMLButtonElement>`), React 19 ref-as-prop; no `forwardRef`. Every component and sub-component sets `displayName`.
- **C-COMPOSE** — destructure every handler the component also uses and compose it: `onClick={composeEventHandlers(onClick, internal)}` (consumer first; `preventDefault()` skips ours). `className` via `cn(internal, className)` (user last: it replaces conflicting classes of the same variant; see Styling), `style` merged, refs with `useMergedRefs`, id lists with `joinIds`, props objects with `mergeProps`. Defaults consumers may override (`type="button"`, `role`) go **before** `{...rest}`; attributes that must win (disabled `tabIndex={-1}`) go **after**. A handler that reacts to events bubbling through the React tree (click, focus, pointer, key) ignores events whose target is not inside `event.currentTarget` in the DOM (portal bubbling from a Popover, Menu or Dialog opened inside it).
- **C-CLASS** — expose state as `data-*` attributes (`data-selected`, `data-active`, `data-disabled`, `data-state`) and style with `data-[selected]:…`, so consumers can target it. Enumerated attributes are always rendered with the resolved value, the default included (`data-orientation="vertical"`, `data-appearance="primary"`, `data-color="brand"`, `data-label-position="after"`, `data-validation-state="none"`, `data-modal-type="modal"`, `data-state="shown"`), so a `[data-orientation=vertical]` selector always works; boolean ones are present (`""`) or absent (`data-dot`, `data-compact`, `data-contains-current`, `data-disabled-focusable`). They go before `{...rest}`, as Stepper's `data-orientation` does.
- **C-TOKENS** — only theme tokens: no `[#hex]`, `rgb()`, `white`/`black` or palette utilities, no `var(--grey-*)`. Hover/pressed styles of anything that can be disabled use the literal gate `not-disabled:not-aria-disabled:hover:` / `…:active:`; the `enabled:` variant is banned (it never matches `<a>`/role=button). Only runtime user colors (swatches) may be raw, marked `// wave-allow-color: <reason>`; stories mark fixture data `// wave-allow-color: fixture`.
- **C-RADIUS** — Tailwind's default radius names (`rounded`, `rounded-md`, …); no theme overrides.
- **C-LOGICAL** — logical utilities (`ms/me/ps/pe`, `start-*/end-*`, `border-s/e`, `rounded-s/e`, `text-start/end`); mirror with Wave's `wave-rtl:` variant (by the element's own `:dir(rtl)`, compiled as `:nth-child(n of :dir(rtl))`, which CSS minifiers keep): write the LTR value as the base class and override it (`wave-rtl:-scale-x-100` on directional glyphs; `translate-x-*` needs a `wave-rtl:` counterpart). Tailwind's bare `rtl:`/`ltr:` (and `not-rtl:`/`not-ltr:`) fail the gate (`direction-variant`) and the CSS build; horizontal arrow keys go through `getArrowIntent(key, { orientation, dir: getDirection(el) })`. A physical utility needs `// wave-allow-physical: <reason>`. Directional components get an RTL test (`renderWithProviders(ui, { dir: 'rtl' })`).
- **C-FOCUS** — `focusRing` on focusable controls, `focusRingInset` on cells/rows, `inputFocus`/`inputFocusWithin` on text inputs (inner control `focus:outline-hidden`). Never `focus:outline-none` and never bare `outline-hidden` (it draws a permanent outline in forced colors).
- **C-MOTION** — every `transition*`/`animate-*` class string carries a `motion-reduce:` variant of the same kind, or the line carries `// wave-allow-motion: <reason>`; animations use `animate-wave-*`. There is no global reduced-motion reset.
- **C-DISABLED** — a control that disables itself through its own activation (Pagination/Carousel boundary buttons, TeachingPopover Back) uses `focusableDisabledProps(disabled)` (`aria-disabled` + `data-disabled`) and guards its handlers; roving containers skip it. `disabledFocusable` (button family, Link, Switch, Checkbox) renders `focusableDisabledProps(true, { reachable: true })` (`aria-disabled`, `data-disabled`, `data-disabled-focusable`) instead of the native `disabled`, stays in the tab order, prevents activation (click, Enter, Space, implicit submission) without calling the consumer's handler and stops the click from reaching ancestors (as a natively disabled control), wins over `disabled`, and stays in roving containers' arrow order (`useRovingTabIndex` keeps `data-disabled-focusable` items unless natively disabled or `data-roving-disabled`). Button and Link get it from `Button.semantics.ts`. A consumer `aria-disabled` without `disabledFocusable` keeps its 0.5 meaning (the look only; handlers run), except that `Menu.Trigger` ignores activation from an `aria-disabled="true"` element. The dimmed look of a focusable disabled control lifts while its ring shows, because `opacity` also dims the outline: `aria-disabled:focus-visible:opacity-100` (in `disabledStyles`, `buttonDisabledClasses`, Link and the merged dismiss/clear buttons), and `has-focus-visible:opacity-100` on the Checkbox and Switch root, which carries the opacity. Move focus explicitly when an element that has it disappears (`usePreserveFocus`, `useRestoreFocus`), or settle the change before focus reaches it: TimePicker and DatePicker commit erased text on Tab (`flushSync`) before the browser moves focus, so Tab skips the clear button the commit removes.
- **C-NAMING** — `onChange` is only the native DOM change event. A localizable built-in string is an optional `<thing>Label` prop with the English text as `@default` (`closeLabel`, `dismissLabel`); a group is a `<thing>Labels` object (Stepper `statusLabels`), and a component's several strings are one `labels` prop typed `<Component>Labels` (exported; Carousel, DatePicker, DataGrid, …). Array props and hook options the library only reads accept `readonly T[]`; callbacks emit a new mutable `T[]`. State: `value`/`defaultValue`/`onValueChange`, `checked`/`defaultChecked`/`onCheckedChange`, `open`/`defaultOpen`/`onOpenChange`, `activeStep`/`defaultActiveStep`/`onStepChange`; also `orientation`, `appearance`, `shape`, `TextWeight`. Fluent's names are the default when they fit these rules (`disabledFocusable`, `iconPosition`, `validationState`, `modalType`, `selectTabOnFocus`); where a rule wins, the JSDoc names the Fluent prop (Tooltip `open`/`onOpenChange` for Fluent's `visible`/`onVisibleChange`). Extra callback data goes in a second `details` argument (`onOpenChange(open, details?)` with `OpenChangeDetails<R>` from `lib/types`; Dialog and Drawer pass it through `requestOpen` in `Dialog.shared.tsx`), typed optional through 0.x and required from 1.0. Renamed props keep the old name as a deprecated alias: value aliases via `resolveDeprecatedProp(component, newValue, oldValue, oldName, newName)` during render (new wins); callback aliases are both called, with `warnDeprecated(component, oldName, newName)` when the old one is present. JSDoc `@deprecated Use \`x\`.`. **Callback semantics:** value callbacks (and their deprecated `onChange` aliases) go through `useControllable` and fire only on change; event-named callbacks (`onPageChange`, `onStepChange`, `Tree` `onItemSelect`, the deprecated `onTabSelect`/`onNavItemSelect`/`onOptionSelect`) are called from the activation handler and fire on every activation, re-selection included.
- **C-CONTEXT / C-MEMO / C-IDS** — contexts default to `null` and their hook calls `reportMissingContext(<Sub>, <Root>)`: it throws `[WaveUI] <Sub> must be used within <Root>` in development and logs once per message in production, where the hook returns an inert value; provider values are `useMemo`'d; DOM ids come from `useId(prefix)`, never from user values.
- **C-SLOTS** — `icon`-like props are `Slot<'span'>` rendered with `renderSlot(icon, 'span', base, { 'aria-hidden': true })`. Dismiss/clear slots (`MessageBar.dismiss`, `SearchBox.dismiss`, `Tag.dismissIcon`) render content **inside** the component's own wired `<button>`; a `<button>`/`Button` passed there is merged, never nested; their accessible name follows `src/lib/labelInName.ts`. A merged `Button`'s own props (`BUTTON_OWN_PROP_KEYS` in `Button.slots.tsx`, compiler-checked against `ButtonOwnProps`) never reach the wired `<button>`: `icon`/`iconPosition` become content (`placeButtonIcon`), and `disabledFocusable` is honoured (`MERGED_DISABLED_FOCUSABLE_PROPS`, spread last). Every "does this node render anything" check uses `slotRendersContent` (`[]`, `<></>`, or a collection of only nullish/boolean/`''` items, renders nothing; `0` is content); content checked and then rendered by hand goes through `materialiseSlotContent` (generators); a dismiss slot object wraps the default icon only when `slotWrapsDefaultContent`. A slot that replaces a default glyph follows one rule per kind: _optional indicators_ (`MenuButton.menuIcon`, Combobox and TimePicker `expandIcon`): `null`/`undefined` keep the default, `false` or anything that renders nothing hides it; _required indicators_ (`SplitButton.menuIcon`): never hidden, a value that renders nothing keeps the default and warns once from an effect; _status icons_ (`MessageBar.icon`, Field `validationMessageIcon`): only `undefined` keeps the default, `null` or anything that renders nothing shows none. A glyph slot inside a wired button (`expandIcon`, SplitButton and MenuButton `menuIcon`) is decorative (`aria-hidden`): a `<button>`/`Button` element, or a slot object whose `as` is one, is unwrapped through `unwrapButtonGlyph` (`Button.slots.tsx`; its children become the glyph, its props are dropped, a one-time warning names the slot), never nested; the dismiss/clear slots keep the merge rule above.
- **C-BUTTON-TYPE** — every JSX `<button` has a literal `type=` (`type="button"` before `{...rest}`); test with `testNoImplicitSubmit`.
- **C-NATIVE** — do not rely on Preflight: set every property a component depends on with utilities (a `<button>` sets its own padding and background); `base.css` only resets natives inside `.wave-root`/`.wave-portal`, and hides `[hidden]` there (`display: none !important`), so pass `hidden` to the drawn root and add no `hidden && 'hidden'` class.
- **C-ROUTING** — composite controls (wrapper root around a focusable element) send `id`, `aria-label(ledby)`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `autoFocus`, `tabIndex`, focus/key handlers and native input attributes to the focusable element; the root keeps `className`, `style`, `data-*`, other handlers and `ref`; add `controlRef`. Merge Field wiring with `useFieldControl` (below).
- **C-FORMS** — value controls accept `name`, `form`, `required` (and `value` for checkbox-like ones) and render `<HiddenInput>` only when `name` or `required` is given (never invent a name); reset through `useFormReset(controlRef, reset, form)`.
- **C-POPUPS** — triggers render through `useTriggerElement` (a single-element Fragment is unwrapped; on a wrapper `<span>`, the state ARIA moves to the first tabbable element inside, unless the span itself is the trigger: `getTriggerTarget`). Anchored surfaces use `<Portal>` + `usePopupPosition` + `useDismiss` (+ `useRestoreFocus` when focus moves in); Dialog/Drawer use `useModalLayer` only. Hold the surface element in state through a callback ref (`const [surface, setSurface] = useState<HTMLElement | null>(null)`), never read `ref.current` in an effect keyed on `open`. Inner widgets that consume Escape call `preventDefault()`. Content needed on the server or before open (tooltip descriptions, closed listboxes) renders inline and `hidden`.
- **C-COMPOUND / C-PURE** — `export const Card = /* @__PURE__ */ Object.assign(CardRoot, { Header: CardHeader })` and also export every member under its flat name (`CardHeader`) for React Server Components; one test per module asserts `CardHeader === Card.Header`. Identify parts with `isElementOfType(child, Part)` or `getElementType` from `src/lib/children.ts`, never `child.type === Part` (a part written in a Server Component arrives as a lazy reference), and count, slice or classify children through `flattenChildren`; test both with `asClientReference(Part)` (same `renderToString` output and behaviour as the plain parts).
- **Polymorphic components** — `export interface XOwnProps { … }` holds only component-specific props (never `extends ButtonHTMLAttributes`), `export type XProps<C extends React.ElementType = '<default element>'> = PolymorphicProps<C, XOwnProps>`, and `export const X: PolymorphicComponent<'<default element>', XOwnProps> = …` (widen to `React.ElementType` inside). The default is the component's own element: `'button'` (Button, CompoundButton), `'a'` (Link), `'span'` (Text, Tag), `'hr'` (Divider), `'div'` (Toolbar, Card and its parts, Stack, Flex, Grid). `React.ComponentProps<typeof X>` is `XProps`; name the element for `as` (`StoryObj<XProps<'a'>>`, `testSystemProps<XProps<React.ElementType>>`; docs/WAVE-UI-GUIDE.md Pattern 7).
- **C-HOOKS** — every `eslint-plugin-react-hooks` 7 recommended rule fails `npm run lint` (errors, and the warnings through `--max-warnings 0`). Call `useLayoutEffect` directly (no `useIsomorphicLayoutEffect` alias: React 19 does not warn on the server). Derive state during render (clamped indices, active option, effective selection); adjust state on prop change with a previous-value state; DOM-derived collections through `useSyncExternalStore` + a Mutation/ResizeObserver; mount detection with `useIsClient()`; deferred updates scheduled in an effect (`requestAnimationFrame`/`queueMicrotask`) and set in the callback; refs written in handlers, ref callbacks, layout or insertion effects, never read during render. The only allowed disable form is `// eslint-disable-next-line react-hooks/<rule> -- <reason>`, and only at the spec's listed sites (`useTriggerElement`, Field's child clone).
- **C-DEV** — all warnings go through `src/lib/dev.ts` (`[WaveUI]` prefix, stripped in production). Component diagnostics are emitted from effects with `warnOnce`; `resolveDeprecatedProp`, `warnDeprecated`, the slot helpers and `renderTrigger` may warn during render (deduplicated). Never call `devWarn` during render. Value-keyed compounds warn once per duplicated value (TabList, Accordion, Tree, Nav, RadioGroup, selectable List, DataGrid `rowId`, OverflowItem `itemId`, as `useListbox` does).
- **C-DOCS** — every component has a component-level JSDoc and prop JSDoc that matches behaviour, including `@default` and `@deprecated`. A compound's component JSDoc sits only on its exported `Object.assign(…)` const, names no internal symbol (`XRoot`) or spec label, and is never repeated in stories (autodocs read it; gated by `.storybook/__tests__/exportDocblocks.test.ts` and verify-dist; docs/WAVE-UI-GUIDE.md Pattern 2).
- **C-STORIES** — title `Components/<Category>/<Name>`; defaults in `args`, render functions forward `args`, callbacks via `fn()` from `storybook/test`; every story has an accessible name; tokens only. Stories must pass `src/__tests__/stories.a11y.test.tsx` (opt-out only with `parameters: { a11y: { test: 'todo' } }` plus a comment).

### Field wiring for a custom control

```tsx
import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusRing } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';

export interface ToggleProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'onClick'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  name?: string;
  form?: string;
  required?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  controlRef?: React.Ref<HTMLButtonElement>;
  ref?: React.Ref<HTMLSpanElement>;
}

export const Toggle = ({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  name,
  form,
  required,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  onClick,
  controlRef,
  className,
  ref,
  ...rest
}: ToggleProps) => {
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, onCheckedChange);
  // Label, validation message, hint, invalid and required state from the surrounding Field
  // (C-ROUTING).
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-required': required,
  });
  const field = useFieldContext();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const mergedControlRef = useMergedRefs(buttonRef, controlRef);
  useFormReset(buttonRef, () => setChecked(defaultChecked), form);

  return (
    <span ref={ref} className={cn('relative inline-flex', className)} {...rest}>
      <button
        type="button"
        {...fieldProps}
        ref={mergedControlRef}
        role="switch"
        aria-checked={checked}
        data-checked={checked ? '' : undefined}
        className={cn('rounded-md border border-stroke-accessible px-3 data-[checked]:bg-selected', focusRing)}
        onClick={composeEventHandlers(onClick, () => setChecked((prev) => !prev))}
      />
      <HiddenInput
        type="checkbox"
        name={name}
        form={form}
        checked={checked}
        value="on"
        required={required ?? field?.required ?? false}
        onInvalid={() => buttonRef.current?.focus()}
      />
    </span>
  );
};
Toggle.displayName = 'Toggle';
```

- `useFieldControl(props, { labelable, nativeRequired })` returns only defined keys: the consumer's id, else the Field's `controlId` (only the first control of a Field takes it); `aria-labelledby` pointing at the Field label when `<label htmlFor>` cannot reach the control (`labelable: false` for `role="radiogroup"`/`role="group"` roots, or a control that is not Field's first child); `aria-describedby` joined with the Field's validation message (`validationMessageId ?? errorId`) and then its hint; `aria-invalid`/`aria-required` from the Field; `required` only with `nativeRequired: true` (native inputs: Input, Select, Textarea, Slider, SpinButton, SearchBox).
- `FieldContextValue` (0.6): `validationState` (`'none' | 'error' | 'warning' | 'success'`) and `validationMessageId` (the message's id in every state) are optional, absent in contexts built before 0.6 (read the state as `invalid ? 'error' : 'none'`). Only the error state sets `invalid` (so `aria-invalid`); `errorId` is set only in the error state, and `hasErrorMessage` only in the error state with a message: a control that shows its own error (Input `error`, DatePicker and TimePicker rejected text) hides it only then, so its error still shows next to a Field warning. A control that builds `aria-describedby` itself (ColorPicker's hex input) uses `field?.validationMessageId ?? (invalid ? field?.errorId : undefined)`; one that reads the Field state for a look (ProgressBar's fill) uses `validationState`.
- `HiddenInput` renders nothing without `name` or `required`. Pass `required ?? field?.required`, so a required Field makes the control natively required even without `name` (the CHANGELOG documents this); an explicit `required={false}` wins, for `aria-required` too. Use `type="radio"` for single-choice groups, `"checkbox"` for booleans, `"text"` for free values (pickers, SpinButton), and pass arrays for multi-value controls (one input per value).
- Test Field consumption without the real Field through `renderWithFieldContext` (`src/test-utils-field.tsx`; `{ validationState: 'warning', validationMessageId: FIELD_TEST_IDS.messageId }` for a warning). The real Field around another component's control belongs in `src/__tests__/integration.test.tsx`.

## Styling

- Tokens are `--wave-*` variables in `src/styles/tokens.css` (`:root`/`.wave-light`, `.wave-dark`/`.dark`, `.wave-high-contrast`/`.high-contrast`), mapped to Tailwind colors in `@theme inline` (`--color-primary: var(--wave-primary)`, used as `bg-primary`). Every theme group declares every token; `color-scheme` only on theme classes.
- Never use raw hex values or palette colors in components or stories; the conventions gate fails on them. Contrast pairs are asserted by `tokens.test.ts`: add new token pairs there.
- `cn()` is clsx + tailwind-merge extended with Wave's scales, so `cn('text-body-1', 'text-foreground')` keeps both and the last class wins for real conflicts (`cn('shadow-4', 'shadow-8')` → `shadow-8`). A user class replaces only a conflicting class **of the same variant**. The gated hover/pressed classes (`not-disabled:not-aria-disabled:hover:` / `…:active:`) and the `data-[…]:`/`aria-*:` state classes are kept next to a bare user class and win by specificity (`cn('… not-disabled:not-aria-disabled:hover:bg-primary-hover', 'hover:bg-error')` keeps both; the gated (0,4,0) beats `:hover` (0,2,0)). Consumers override them with the same prefix (`not-disabled:not-aria-disabled:hover:bg-error`), the important modifier (`hover:bg-error!`) or the same data variant; `Button.test.tsx` pins this pitfall.
- 4px spacing grid; type ramp `text-caption-2` … `text-display`; shadows `shadow-2` … `shadow-64`; font `font-wave`.
- Never write a Tailwind utility name as a bare word in `src/components`/`src/lib` comments or strings: the CSS build fails on it (rephrase, or exclude it: docs/WAVE-UI-GUIDE.md Pattern 5).

## Testing

- Vitest + React Testing Library + jsdom + vitest-axe. `docs/testing-best-practices.md` explains the helpers; the JSDoc of `src/test-utils.ts` is the source of truth for their signatures.
- `testSystemProps(Component, { expectedTag, displayName, defaultProps, a11yVariants, control, conflictingClass, polymorphic, wrapper })` covers ref, rest spread, className merging, `as`, displayName and axe. Other helpers: `testNoImplicitSubmit`, `testComposedHandler`, `testCompoundExposure`, `testFocusEvents`, `renderWithProviders(ui, { theme, dir })`, `createOverlayTestWrapper`, `expectNoA11yViolations`, `findDanglingIdRefs`, `findDanglingIdRefsInHtml` (`renderToString` output of a popup rendered open), `asClientReference`, `expectThrows` (C-CONTEXT throw tests), `installResizeObserverMock`, `mockMatchMedia`, `mockRect`, and `renderWithFieldContext` in `src/test-utils-field.tsx`.
- axe runs on `document.body` (portals included) with the shared `axe` instance (`region` and `color-contrast` disabled: jsdom cannot compute contrast, `tokens.test.ts` covers it); `expectNoA11yViolations` also fails on ARIA id references that point at no element (`findDanglingIdRefs`). After every test `src/test-setup.ts` cleans up and **fails the test if overlay state outlived it** (open dismiss layers, focus traps, scroll locks, modal isolation/`inert`, `useRestoreFocus` users, inline scroll-lock styles on `<html>`/`<body>`: `assertOverlayStateReleased`) **or `document.body` still has children** (leaked portals, live regions).
- Query by role and accessible name; no presence-only assertions, no hex-class assertions. Stateful components get a StrictMode "callback fires once" test; directional components an RTL test; popups open-state axe, dismissal and focus-return tests; type contracts use `expectTypeOf`/`// @ts-expect-error` (checked by `tsconfig.dev.json`).
- Repeated interactions on a controlled component whose parent ignores the callback must be separate tasks: use `userEvent`, or `await act(async () => {})` between `fireEvent` calls (back-to-back `fireEvent` calls chain in one task).
- Timers: `vi.useFakeTimers({ shouldAdvanceTime: true })` + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`; wrap direct `vi.advanceTimersByTime` calls in `act()`.
- A focus trap returns outside focus, and a focus-outside dismissal decides, in a microtask: after `act(() => el.focus())`, `await act(async () => {})` before asserting.
- Keep test output clean: no act() warnings and no unasserted `[WaveUI]` warnings. A test that spies on `console.warn`/`console.error` asserts the exact expected message(s) and that nothing else was logged; never only silence them (a silenced spy is fine when every call is asserted). Check with `--reporter=default`.
- Production-mode checks stub `NODE_ENV` with `vi.stubEnv` (a module mock of `isDev` does not reach `reportMissingContext`; docs/testing-best-practices.md §8).
- Cross-component compositions (Menu + MenuButton, Field around every control, Toast over Dialog, …) live in `src/__tests__/integration.test.tsx`, together with the Server Component regression suite (add every new compound there; docs/testing-best-practices.md §5).

## Git

Conventional-commit subjects (`fix(input): …`, `docs: …`). No AI attribution trailer in commit messages.
