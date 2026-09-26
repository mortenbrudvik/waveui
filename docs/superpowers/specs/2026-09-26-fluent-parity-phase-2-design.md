# WaveUI 0.7.0 — Fluent Parity Phase 2 Design (menus and commands)

> Date: 2026-09-26 · Branch: `feat/fluent-parity-phase-2` (from `main` a922b5c, where 0.6.0 = Phase 1 is merged) · Package: `@mortenbrudvik/waveui` 0.6.0 → **0.7.0**
> Scope: Phase 2 of [`docs/ROADMAP.md`](../../ROADMAP.md): the presence core P2-00 and the items P2-01 … P2-08. They close 3 high, 9 medium and 17 low gaps of the Fluent UI v9 comparison (§7).
> Inputs: the roadmap's Phase 2 section (items, sketches, guards, dependencies; §1 goals and naming; §2 principles; §3 process); the Phase 1 spec [`2026-09-25-fluent-parity-phase-1-design.md`](2026-09-25-fluent-parity-phase-1-design.md), the model for this document, and its §9 implementation notes; the verified gap entries `menu-*`, `popover-*`, `tooltip-3`, `positioning-*`, `foundation-14/16/18/22` and `buttons-*`; Fluent 9.74.9 (`react-menu`, `react-popover`, `react-tooltip`, `react-toolbar`, `react-button`, `react-positioning` 9.23.3, `react-motion` 9.16.4). Every API below was checked against the 0.6.0 source it changes: `Menu.tsx`, `Popover.tsx`, `Popover.shared.tsx`, `Tooltip.tsx`, `Toolbar.tsx`, `ToggleButton.tsx`, `MenuButton.tsx`, `SplitButton.tsx`, `buttonStyles.ts`, `Divider.tsx`, `useRovingTabIndex.ts`, `usePopupPosition.ts`, `useDismiss.ts`, `useRestoreFocus.ts`, `useTriggerElement.tsx`, `useControllable.ts`, `layers.ts`, `Portal.tsx`, `lib/types.ts`, `cn.ts`, `tokens.css`, `scripts/verify-dist.mjs`, and the CHANGELOG 0.6.0 section; the review revision also checked `TeachingPopover.tsx` (its `target`), `Nav.tsx` (`opensElsewhere`), `src/lib/styles.ts` (`forcedColors`), `src/test-setup.ts` and the 0.6 tests that render a real Menu.
> Lead rulings (binding, from the kickoff): the release is 0.7.0 with a new `## [0.7.0] - Unreleased` CHANGELOG section; Fluent names by default when they fit WaveUI's conventions, else C-NAMING (state callbacks value first, with an optional `details` argument); APG behaviour first; the presence core is CSS-class based (no JS animation library, no runtime styles) and tree-shaken from bundles that do not use it (a `verify-dist` probe); every Menu item kind works in both the popup and the static Menu.
> Status: revised after three reviews of the first draft (API conventions; accessibility and behaviour; the code, sequencing and verification). Every blocker and major point was applied; §9 lists the points not applied, or applied differently, and why. Implementation contract for parallel agents. Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins. Seams that do not line up are resolved by INTEGRATION (§3). The open questions of §8 are answered by the maintainer before wave A starts (roadmap §3, entry criteria).

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F2-foundation` | shared types, the checked-values hook, the motion tokens, the presence core (`usePresence`, `Presence`, their exports), virtual anchors in `usePopupPosition`, the hover-intent and context-menu helpers, the event predicates (`src/lib/events.ts`), the context-mode option of `useTriggerElement`, the roving transparency marker, `mockAnimations`, the `verify-dist` probes, bundle budget and the `Toolbar` entry of the flat-name bridge | P2-00, plus the shared pieces of P2-01, P2-05, P2-06, P2-07 | wave A1 |
| `F2-menu-core` | splits `Menu.tsx` into modules with a fixed seam (§1.13–§1.18): the root module, contexts, the item row and column alignment, item activation, the Menu root's checked-values state and `persistOnItemClick`, the dormant submenu-trigger path of `Menu.Item`, the item test harness | P2-01 (root part) | wave A2 |
| `P2-menu-items` | `Menu.ItemCheckbox`, `Menu.ItemRadio`, `Menu.ItemSwitch`, `Menu.Group`, `Menu.GroupHeader`, `Menu.ItemLink`, in the order P2-01 → P2-02 → P2-03 | P2-01 (items), P2-02, P2-03 | wave B |
| `P2-menu-popup` | the Menu root (`Menu.root.tsx`), `Menu.Trigger`, `Menu.Popover`, `Menu.SplitGroup`: submenus and the presence adoption, hover opening, context menus and custom targets, in the order P2-04 → P2-05 → P2-06 | P2-04, P2-05 (Menu), P2-06 (Menu) | wave B |
| `P2-popover` | Popover and Tooltip, in the order P2-05 → P2-06 | P2-05 (Popover, Tooltip), P2-06 (Popover) | wave B |
| `P2-buttons` | ToggleButton, the button class maps, Toolbar and its parts, in the order P2-08 → P2-07 | P2-07, P2-08 | wave B |
| `INTEGRATION` | barrels, the new members of the `Menu` compound and their flat re-exports, cross-package tests (including the real-Menu cases of the item kinds), public type tests, the Menu story merge, the Tooltip `delay` renames outside `P2-popover`'s files, emptying the `verify-dist` flat-name bridge | — | wave C |
| `DOCS` | CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP | — | wave D |

§3 lists the exact files of each package. File ownership is disjoint within each wave.

### 0.2 Ground rules for every agent

The Phase 1 ground rules (§0.2 of the Phase 1 spec, rules 1–10: own files only, barrels are INTEGRATION's, TDD, backward compatible, conventions and stories gates, no git write commands, foundation not forked, verification before reporting, wave-B tests use only the foundation and their own files, local argTypes) apply unchanged, with F2 in place of F1. In addition:

11. **Wave A is two packages in sequence.** `F2-foundation` (A1) lands and is committed by the lead before `F2-menu-core` (A2) starts; A2 is committed before wave B starts. Wave A is exclusive, so `F2-foundation` may edit `src/index.ts`, create `src/components/motion/index.ts` and add the presence lines of `src/__tests__/public-types.test.ts` (D26), and `F2-menu-core` may update the 0.6 tests that render a real Menu for the DOM changes of §6.4 (§1.20); every other barrel and public-types change stays INTEGRATION's.
12. **The Menu seam is frozen in wave B.** The modules, members, props and helpers listed in §4.2 keep their names, types and meaning. `P2-menu-popup`, which owns `Menu.context.ts` in wave B, may add members; nobody renames, removes or changes one. `Menu.tsx` (the compound and re-exports), `Menu.shared.ts` and the test harness `__tests__/menuHarness.tsx` have no owner in wave B (read only). Anything else a package needs from a file it does not own is a change request (rule 7).
13. **Compound members.** New Menu parts live in their own modules during wave B and are imported from there by tests and stories (`import { MenuItemCheckbox } from '../Menu.selectable'`). INTEGRATION attaches them to `Menu` (`Menu.ItemCheckbox`, …) and re-exports the flat names from `Menu.tsx` in wave C. Toolbar parts are attached by `P2-buttons` itself, which owns `Toolbar.tsx`; their flat names reach `dist/index.mjs` only when INTEGRATION extends the button barrel, so `F2-foundation` puts `'Toolbar'` on `verify-dist`'s `PENDING_FLAT_EXPORTS` bridge (§1.10) and INTEGRATION empties it.
14. **Menu stories.** `stories/Menu.stories.tsx` belongs to `P2-menu-popup` in wave B. `P2-menu-items` writes its stories to `stories/Menu.items.stories.tsx` (title `Components/Navigation/MenuItems`); INTEGRATION moves them into `stories/Menu.stories.tsx` and deletes that file in wave C.
15. **No built-in motion in 0.7.** No component gets enter or exit motion classes (that is Phase 10). Motion that tests and stories add (the presence core, a consumer exit class on `Menu.Popover`) carries a `motion-reduce:` variant (C-MOTION), and the presence tests mock `prefers-reduced-motion` both ways.
16. **Pointer tests.** Hover is simulated with `userEvent.hover`/`unhover` and `user.pointer({ coords })` (pointer type `mouse`), touch and pen with `pointerType: 'touch'`/`'pen'`, rectangles with `mockRect`, timers as CLAUDE.md "Timers" says. A pointer context gesture is `fireEvent.contextMenu(el, { button: 2, clientX, clientY })` (a macOS Ctrl+click: `{ button: 0, ctrlKey: true, clientX, clientY }`); a keyboard one is the key press on the trigger (`user.keyboard('{Shift>}{F10}{/Shift}')` or `'{ContextMenu}'`), optionally followed by the `fireEvent.contextMenu(el)` the browser dispatches for it (§1.7 rule 1). Real browsers differ where jsdom cannot tell (§6.3 lists the manual checks).
17. **Direction.** Mirror directional glyphs with `wave-rtl:-scale-x-100` and pair every `translate-x-*` with a `wave-rtl:` counterpart, as 0.6 does (Phase 1 §9, "The `wave-rtl:` variant"); horizontal arrow keys go through `getArrowIntent`.
18. **Item tests use the harness.** `P2-menu-items` renders its items inside `renderInMenuList` (§1.19), which provides the Menu contexts without `Menu.root.tsx`, `Menu.trigger.tsx` or `Menu.popover.tsx`, the files `P2-menu-popup` changes in the same wave. Cases that need a real popup menu (focus returning to the trigger, SSR through the real root, submenus) are INTEGRATION's (§4.8). Other packages' existing tests that render a Menu through 0.6 API (Toolbar, List, DataGrid, MenuButton, SplitButton) may fail while `P2-menu-popup` works: such a failure is reported to the lead, not fixed.

### 0.3 Design rulings

Binding for every package. Each ruling records why. The D-numbers are this spec's; Phase 1 rulings are cited as "Phase 1 D21".

- **D1 — Two foundation packages and a Menu seam.** `Menu.tsx` (974 lines in 0.6) is changed by six of the nine items. `F2-menu-core` splits it into modules with fixed contracts (§1.13–§1.18) in wave A2, so `P2-menu-items` (new item modules and `Menu.items.tsx`) and `P2-menu-popup` (root, trigger, popover, split group) own disjoint files in wave B, and a test harness (§1.19) lets the item tests run without the popup modules. The three popup items P2-04 → P2-05 → P2-06 all change `Menu.Trigger` and `Menu.Popover` and run in that order inside `P2-menu-popup`. *Why:* one Menu package would put six items on one agent, the critical path of the phase; the seam that lets the item kinds and the popup behaviour proceed in parallel is small enough to fix up front, and it keeps every 0.6 Menu test green on its own (a pure refactor plus the root state).
- **D2 — The presence core** (P2-00) is `usePresence(visible, options)` plus a `<Presence>` component: four phases (`entering`, `entered`, `exiting`, `exited`; the type `PresencePhase`, a name that cannot be confused with Avatar's `PresenceStatus`), exposed as the enumerated attribute `data-presence` (Phase 1 D22) on the animated element. A phase ends when the element's own finite animations and transitions have finished, read through `element.getAnimations()` (CSS animations and transitions alike), or, where that API is missing, from its computed `animation-*`/`transition-*` durations and end events. It ends at once under `prefers-reduced-motion: reduce`, and when the element has no running motion; that immediate end is set from the layout effect, so a surface without motion unmounts before the browser paints, in the same `act()`. The exiting element is `inert` (out of the tab order and the accessibility tree). The server HTML and hydration render the `entered` (or `exited`) phase; `appear` runs only for elements mounted on the client after hydration. The core writes attributes only: no inline style, no class, no JS animation. *Why:* the lead ruling (CSS-class based, no runtime styles); `getAnimations()` covers keyframes and transitions with one mechanism, including a transition that a later style change cancels (its `finished` promise rejects, which counts as finished, where no `transitionend` would ever fire); the synchronous end keeps every 0.6 surface behaving exactly as before when nothing animates; `inert` is the roadmap's acceptance criterion and keeps an exiting menu from catching focus or Escape.
- **D3 — `data-presence`, not `data-state`.** The presence phase is its own attribute. Components keep their own `data-state`: `Menu.Popover` renders `data-state="open"` while open (0.6) and `"closed"` while it exits. *Why:* `data-state` already means different things (Accordion `open`/`closed`, Spinner `delayed`/`shown`, surfaces `open`), and consumer selectors rely on it; writing four presence phases into it would change what `[data-state=open]` matches.
- **D4 — Every `Menu.Popover` mounts through the presence core in 0.7, with no built-in motion.** Root menus and submenus are the same component, so both use it; Popover, Tooltip, Dialog, Drawer and the other 0.6 surfaces move onto the core when Phase 10 animates them. A consumer can animate a menu today with `data-[presence=…]:` classes on `Menu.Popover`. *Why:* the roadmap requires submenus (new surfaces) to mount through the core from the start; splitting one component into two mount paths would be worse than the invisible change of D2's synchronous end.
- **D5 — Motion tokens are Fluent's exact set:** 8 durations (`ultra-fast` 50 ms … `ultra-slow` 500 ms) and 9 curves (`accelerate-max/mid/min`, `decelerate-max/mid/min`, `easy-ease-max`, `easy-ease`, `linear`), not the roadmap sketch's `{accelerate,decelerate,easy-ease,linear}-{min,mid,max}` grid (Fluent has no `easy-ease-min/mid` or `linear-*`). They are CSS variables `--wave-duration-<name>` and `--wave-curve-<name>` in the theme-independent `:root` block of `tokens.css` (next to the z-index constants), and Tailwind utilities `duration-wave-<name>` (Tailwind's `--transition-duration-*` theme namespace) and `ease-wave-<name>`. The tokens are not zeroed under reduced motion (C-MOTION: components reduce motion themselves). *Why:* designers port Fluent specs by name and value; Fluent's tokens do not change per theme; the 0.6 guide listed four curves with wrong values (`foundation-16`).
- **D6 — Checked-values API.** `checkedValues?: CheckedValues`, `defaultCheckedValues?: CheckedValues` and `onCheckedValuesChange?: (checkedValues: Record<string, string[]>, details?: CheckedValuesChangeDetails) => void`, with `details = { name, checkedItems, event }`. WaveUI always passes `details`; it is typed optional through 0.x and becomes required in 1.0 together with every other `details` parameter (roadmap P13-03, P14-02). The callback fires only on change, through `useControllable`, and receives a fresh object whose arrays are all copies. The controlled prop accepts readonly data. One internal hook (`useCheckedValues`, §1.2) serves Menu and Toolbar. *Why:* C-NAMING and roadmap §1.1 goal 4 (a state callback is named after its state, value first, with an optional `details` argument: the lead ruling); one shape for every `details` argument in 0.x (Phase 1 D9), so a wrapper that forwards the prop with the value alone compiles; Fluent's `onCheckedValueChange(event, { name, checkedItems })` becomes the `details` argument, and `event` keeps what Fluent's first argument gave and matches `OpenChangeDetails`; fresh copies make `onCheckedValuesChange={setState}` safe.
- **D7 — One checked-values state per menu tree.** A nested Menu (a submenu) that sets neither `checkedValues` nor `defaultCheckedValues` uses its parent's state; one that sets either owns its state. `onCheckedValuesChange` alone never selects the state: on a submenu that shares its parent's state it is a listener, called after the owner's callback, with the same arguments, for changes made by the items of that submenu (and of its sharing submenus). `persistOnItemClick`, `openDelay` and `closeDelay` are inherited when unset, from a static root too. Fluent gives every Menu its own state. *Why:* a View menu with a Sort submenu edits one settings object; the value props still scope a submenu when an app wants that; nowhere else in the library does adding a callback change where the state lives.
- **D8 — Checkable items follow APG.** On a checkbox, radio or switch item, Space changes the state and keeps the menu open; Enter and a click change it and close a popup menu unless `persistOnClick` (the item) or `persistOnItemClick` (the Menu) says otherwise. Activating a radio item that is already checked changes nothing (no callback) and still closes on Enter or a click. *Why:* APG menu button keyboard ("Space: when focus is on a menuitemcheckbox, changes the state without closing the menu"); Fluent closes on Space too unless persisting; the click rule is Fluent's and matches native menus.
- **D9 — `persistOnItemClick` on Menu** (Fluent's name) is the default of its items' `persistOnClick`; an item's explicit `persistOnClick` (`true` or `false`) wins. `Menu.Item`'s `persistOnClick` default changes from `false` to "the Menu's `persistOnItemClick`", which is `false` unless set, so 0.6 menus behave as before. A submenu trigger item never closes its menu; a `Menu.ItemLink` always does (D13). *Why:* Fluent parity for menus of toggles (every item persisting) without repeating the prop on each item.
- **D10 — Column alignment is CSS only (`menu-6`).** The list element (the static root and every `Menu.Popover` surface) is a named Tailwind group `group/menu`; every item row renders hidden checkmark and icon placeholders that become visible with `group-has-[[data-menu-checkmark]]/menu:` and `group-has-[[data-menu-icon]]/menu:` when any item of that list shows a checkmark column or an icon. No `hasIcons`/`hasCheckmarks` props. An item whose label renders nothing (a split group's submenu half) reserves no column. *Why:* SSR-stable (no registration effect, no second render), works through groups and wrapper elements, and `:has()` is in every browser WaveUI supports (the `wave-rtl:` baseline: Chrome and Edge 120+, Firefox 128+, Safari 16.4+); Fluent's opt-in props become unnecessary. It is a visual change for 0.6 menus that mix items with and without icons (CHANGELOG "Visual").
- **D11 — The `checkmark` slot is a required indicator** (Phase 1 D21): `null`, `undefined` and a value that renders nothing keep the default check glyph, and a value that renders nothing also warns once (`Menu.ItemCheckbox:checkmark-empty`, `Menu.ItemRadio:checkmark-empty`; compound parts use dotted keys and message prefixes, as `Popover.Content:name` does). Radio items use the check glyph too (Fluent). `Menu.ItemSwitch` draws a switch at the row's end and has no `switchIndicator` slot in 0.7. *Why:* a checked item must always show its state (WCAG 1.4.1, 1.3.1); Fluent's `switchIndicator` slot has no request behind it, and a later optional slot is non-breaking.
- **D12 — Group labelling never dangles.** `Menu.Group` sets `aria-labelledby` to its header's id only when a static scan of its children (direct children and Fragments, Server Component references included, as `Menu` finds its popup parts) finds a `Menu.GroupHeader`; a header rendered elsewhere inside the group (inside a custom component) warns once in development and does not label it. A consumer `aria-label` or `aria-labelledby` on the group wins. *Why:* WaveUI never points an ARIA reference at a missing id (0.6 Popover naming rule), and the scan works on the server; Fluent always writes `aria-labelledby`.
- **D13 — `Menu.ItemLink` keeps native link activation.** It is polymorphic (default `'a'`, so a router link can be the element); Enter is left to the browser (native link activation keeps Shift, Ctrl and Meta for a new window or tab), Space clicks it, and the click closes the menu without preventing its default. Every click closes the popup menu, a modified one (Ctrl, Cmd, Shift, Alt: a new tab or window) included, and the Menu's `persistOnItemClick` does not apply to links (a navigation ends the menu's job); middle click (`auxclick`) and the browser's link context menu stay native and close nothing. A disabled link is `aria-disabled` and its own click is prevented; on the default `'a'` it also drops `href`, while a router link (`as`) keeps whatever its own props (`to`) render, so the prevented click (routers check `defaultPrevented`) is what stops it. *Why:* intercepting Enter (as `Menu.Item` does) would lose the modifier behaviour; an `<a>` navigates even after the menu has unmounted it (HTML: only a non-`a` element "cannot navigate" when disconnected); closing on every click is what browser bookmark menus do by default and needs no modifier rules (Nav's `opensElsewhere` decides a selection, not a close).
- **D14 — Submenus.** A `<Menu>` rendered inside a menu list (a `Menu.Popover` surface or a static menu) with no portal between the list and the Menu (the Menu's `PortalDepthContext` value equals the list's, §1.14) is a submenu. A Menu inside a portal opened from the list (a Popover or Dialog opened from an item, which 0.6 supports) stays a root menu, because React context crosses portals and would otherwise make it a submenu. The submenu's `Menu.Trigger` wraps a `Menu.Item`, which becomes a submenu trigger item: `aria-haspopup="menu"`, `aria-expanded` (always a boolean), `aria-controls` while open, a chevron that mirrors in RTL. "Next" (ArrowRight, ArrowLeft in RTL), Enter and Space open it and focus its first enabled item; a click opens it (it never toggles it closed); hover opens it without moving focus into it (D18); ArrowDown, ArrowUp, Home, End and typeahead stay the parent list's. A disabled trigger item (`aria-disabled`) never opens its submenu, by click, key or hover (C-DISABLED). One submenu per list is open at a time. It opens on the side `end` aligned `start` with offset `0`, flips and fits the viewport. It works inside static menus too (lead ruling). *Why:* Fluent's composition; APG menu keys through `getArrowIntent` (C-LOGICAL); a click that closed an open submenu would fight hover opening; the portal-depth test keeps every 0.6 composition of a Menu inside an item's popup unchanged.
- **D15 — Closing a chain.** Escape and "previous" (ArrowLeft, ArrowRight in RTL) inside a submenu close only that submenu and return focus to its trigger item. Item activation and Tab close the whole chain: focus goes to the root trigger first (the 0.6 rule, so a Dialog opened from a submenu item returns focus there), then every popup closes; under a static root the chain closes up to the static menu and focus goes to its submenu trigger item. An outside press closes every menu whose layer tree does not contain it (the dismiss-layer stack). A chain never closes by unmounting alone: (a) every close of a menu, whatever its reason (Escape, an outside press, Tab, item activation, the hover close, `focusOutside`), first closes its open submenu, innermost first, through that submenu's own open state, so each controlled submenu gets `onOpenChange(false)` once; (b) a submenu's effective open state is its own `&&` its parent's, so while a parent closes (or runs an exit motion) the submenu's surface, dismiss layer and focus restore close in the same commit. A controlled root that the app closes itself (its `open` prop, no handler of the Menu involved) leaves its controlled submenus' state to the app; (b) keeps them closed on screen. *Why:* APG menu ("Escape: closes the menu that contains focus and returns focus to the element from which it was opened"; "Tab: … closes all menus"); the 0.6 focus-before-close rule keeps the focus-return chain intact; a submenu that stayed open in state would reopen with its parent, and one whose portal outlived the parent's close would keep an orphan dismiss layer that takes the next Escape.
- **D16 — `Menu.SplitGroup` keeps both halves in the list's vertical order.** ArrowDown and ArrowUp visit the main item and the submenu half in DOM order; inside the row, "next" moves from the main item to the submenu half (without opening it) and "previous" moves back; "next" on the submenu half opens the submenu. *Why:* APG has no split menu item; DOM order keeps every item reachable with the one key pair screen-reader users expect and needs no special case in the roving hook; typeahead skips the half because it has no text. The half is written `<Menu.Item aria-label="More save options" />`: F2-menu-core makes `MenuItemProps.children` optional (a non-breaking widening), and the half shows only the submenu chevron.
- **D17 — One delay vocabulary, with these defaults:** `openDelay` and `closeDelay` in milliseconds on Menu (250 / 250), Popover (250 / 500) and Tooltip (200 / 100). Fluent's defaults are Menu `hoverDelay` 500 for both, Popover 0 / `mouseLeaveDelay` 500, Tooltip `showDelay`/`hideDelay` 250 / 250. Tooltip's `delay` becomes a deprecated alias of `openDelay` (`resolveDeprecatedProp`, the new name wins, one development warning). Submenus inherit their parent's delays (D7), also from a static root, which accepts both props for that purpose. The names are shared, the triggers are not: Menu's and Popover's delays apply to mouse hover only, Tooltip's `openDelay` also to keyboard focus (0.6 behaviour, unchanged), and Tooltip keeps reacting to the `mouseenter` a touch tap emulates (0.6); each prop's JSDoc says which. *Why:* Menu uses InfoLabel's 0.5 hover delays (250 / 250), and the safe zone (D18) makes a long close delay unnecessary; a Popover opens after 250 ms so a pointer passing over a trigger does not flash content, and keeps Fluent's close delay for interactive content; Tooltip keeps its 0.6 timing (no behaviour change). §8 Q1 asks the maintainer to confirm.
- **D18 — The hover model.** Only a mouse hovers: pointer events with `pointerType` `'touch'` or `'pen'` never open or close anything. A surface opened by hover does not move focus. Activating the trigger of a hover-opened surface pins it and behaves exactly like opening a closed surface that way: a click, Enter, Space or ArrowDown on a Menu trigger focuses the first enabled item (ArrowUp the last); keyboard entry into a hover-opened submenu ("next", Enter, Space or a click on its trigger item) pins it and focuses its first item; a click on a Popover trigger keeps focus where 0.6 puts it. A pinned surface closes only as a click-opened one does. An unpinned hover-opened surface closes `closeDelay` after the pointer is on neither its trigger nor its surface tree (nested portals such as submenus count as inside), unless focus is inside its surface tree; focus on the trigger does not keep it open (it usually is there from an earlier click or restore, not from the user's intent to keep this surface). After a surface closes for any other reason than the hover close (Escape, an outside press, item activation), hover does not reopen it until the pointer has left its trigger. A triangular safe zone from the point where the pointer left the trigger to the surface's facing edge keeps the surface open while the pointer moves towards it, and holds the hover opening of sibling triggers and hover focus (D31) meanwhile. A trigger that is `aria-disabled` never opens by hover. `openOnHover` defaults to `true` for submenus and `false` for root menus and Popover; with `openOnContext` it is ignored (context mode wins, one development warning). *Why:* hover must not steal keyboard focus (APG); WCAG 1.4.13 (content on hover is hoverable, persistent, and dismissible without moving the pointer, and stays dismissed); touch has no hover, and a tap's emulated `mouseenter` would open surfaces the tap also toggles; the safe zone is what makes diagonal pointer paths into submenus work (`menu-10`, `foundation-22`); a surface that focus on its trigger kept open would turn every hover card sticky after its first click.
- **D19 — Context menus.** `openOnContext` on the Menu and Popover roots (Fluent's name). The trigger is a context region (a list, a row, a canvas).
  - **Origin.** Shift+F10 and the ContextMenu key, pressed on the trigger, are the keyboard gesture; the `contextmenu` event a browser dispatches for that key press is recognised by a flag the keydown sets (and the next `pointerdown` or other key clears), never by its `button` or coordinates. Every other `contextmenu` is a pointer gesture (a right click, a macOS Ctrl+click, a touch long press where the browser fires one; iOS Safari fires none, a known limitation recorded in the backlog).
  - **Anchor.** A pointer gesture opens the surface at the pointer; a keyboard gesture at the element that had focus when the key was pressed (the focused row), else the trigger's focus target, else the trigger. The anchor is kept until the next opening, so an exiting surface does not jump.
  - **Opener and focus.** The element focused at the gesture (not `<body>`, not inside the surface) is the opener. Menu moves focus to its first enabled item; Popover moves focus into its content for a keyboard gesture (first tabbable element, else the surface) and leaves it where it is for a pointer gesture. Every close returns focus to the opener when it can take focus, else to the trigger's focus target, else to a focusable `target` element (Escape, item activation, Tab and the chain close use the same order); Tab from the opener enters an open context Popover's content.
  - **ARIA.** The trigger gets no `aria-haspopup`, `aria-expanded` or `aria-controls` (a context region is no menu button) and no click toggle; a render-prop child that spreads them anyway has them removed after each commit (D29). The surface is not labelled by the trigger (a region's whole text is no name): give it `aria-label` (development warning otherwise). The docs recommend `aria-keyshortcuts="Shift+F10"` on the region so the menu can be discovered.
  - **Suppression and closing.** The browser's context menu is suppressed on the trigger and inside the surface, except in an editable field inside the trigger (a text `input`, a `textarea`, a contenteditable element), where the gesture is left to the browser (paste, spelling suggestions) and opens nothing. A primary press outside the surface closes it, a press elsewhere in the context region included (the trigger is not part of the dismiss layer in context mode); a `contextmenu` outside closes it without being prevented; a scroll outside the layer tree closes it only when it moved the anchor (more than 2 px).
  - *Why:* Fluent's model (`usePositioningMouseTarget`, close on scroll for context menus); `button === 2` misclassifies a macOS Ctrl+click (`button` 0) and engines disagree on the keyboard event's fields, while the key press is ours to see; a keyboard menu placed at the whole region would appear far from the focused row; `useRestoreFocus` prefers the trigger over the focused element, so without the opener focus would land on the region's first row; keeping native menus in fields matters most to keyboard and screen-reader users, who reach paste and spelling that way; a scroll that did not move the anchor (inertial scrolling still running at the right click) must not close a menu that just opened.
- **D20 — `target` lives where `side`/`align` live:** on `Menu.Popover` for Menu, and on the `Popover` root for Popover (the roadmap sketch put it on `Popover.Content`). Both are typed with the shared `PopupTarget` (`HTMLElement | VirtualElement | null`, §1.1): an element or a `VirtualElement`, not a ref, in 0.7. TeachingPopover's 0.6 `target` (`RefObject<HTMLElement | null> | HTMLElement | null`) is unchanged; the two differ on purpose in 0.7 (TeachingPopover takes no `VirtualElement`, Menu and Popover no ref), the CHANGELOG says so, and ROADMAP P7-01 unifies them (both widenings are non-breaking). A `VirtualElement` may be written inline (`target={{ getBoundingClientRect: () => rect }}`): a new object repositions the surface without a render loop (§1.5). A target element counts as inside for outside presses (like the trigger), so an external toggle button used as the target works; such a toggle carries its own `aria-haspopup`, `aria-expanded` and `aria-controls` (the docs say so). Precedence: the context anchor (while opened by a context gesture) > `target` > the trigger. *Why:* one source per positioning option (the rule P7-01 adopts for its `positioning` prop); reading a ref needs the per-commit read TeachingPopover documents at length, and accepting a ref later is a non-breaking widening; one exported union keeps the two new props identical (roadmap §2 principle 1); a target that toggled the surface closed and open again on one click would be a bug.
- **D21 — `VirtualElement`, `PopupRect` and `PopupTarget` are public types now** (`src/lib/types.ts`), because the public `target` props use them; `usePopupPosition` accepts them but stays internal until P7-01. *Why:* consumers need the type to build a point or a text-selection anchor; the hook's public surface is Phase 7's to design.
- **D22 — Toolbar parts use Fluent's names, and a plain ToggleButton does not bind to `checkedValues`.** The parts are `Toolbar.Button`, `Toolbar.ToggleButton`, `Toolbar.RadioGroup`, `Toolbar.RadioButton`, `Toolbar.Group` and `Toolbar.Divider`; `Toolbar.ToggleButton` and `Toolbar.RadioButton` take required `name` and `value` and bind to the Toolbar's state. *Why:* the roadmap sketch bound `ToggleButton` through its native `name`/`value` attributes, which would take over the pressed state of 0.6 toggles that pass `name` inside a Toolbar, clash with the native `value` type (`string | number | readonly string[]`), and put Toolbar code into every ToggleButton bundle; Fluent's own part name closes `buttons-25`.
- **D23 — Toolbar radios do not select on focus.** In a Toolbar the arrow keys only move focus; Space, Enter or a click checks a `Toolbar.RadioButton`. `Toolbar.RadioGroup` (`role="radiogroup"`) carries `data-roving-transparent` (§1.8), so its radios are items of the toolbar's arrow order (the toolbar's axis: Left/Right in a horizontal toolbar) instead of one nested composite with its own tab stop. The group also handles the cross axis, as the APG Toolbar example's text-alignment group does: Down/Up in a horizontal toolbar (Right/Left, through `getArrowIntent`, in a vertical one) move focus to the next or previous enabled radio of the group, wrapping inside the group, without checking. *Why:* the APG Toolbar example; a nested composite would need its own arrow keys on the toolbar's axis, which the toolbar has already taken.
- **D24 — Toolbar `size`** is `Size` (Fluent's three sizes are a subset), default `'medium'`, the default size of `Toolbar.Button`, `Toolbar.ToggleButton` and `Toolbar.RadioButton` and the toolbar's padding; plain Buttons inside a Toolbar keep their own default. The root always renders `data-size` and `data-orientation` (Phase 1 D22). *Why:* WaveUI's five-size union; a plain Button reading Toolbar's context would pull Toolbar code into every Button bundle and break the Button-only probe.
- **D25 — ToggleButton reports its state for its role.** `aria-pressed` only without a `role` or with `role="button"` (0.6). With `role` `checkbox`, `radio`, `switch`, `menuitemcheckbox`, `menuitemradio`, `option` or `treeitem` it renders `aria-checked` and `data-checked=""` (while pressed) instead (Fluent handles `checkbox` and `menuitemcheckbox`). With any other role (`tab`, `link`, `menuitem`, …) it renders neither and warns once in development (`ToggleButton:role-state`, from an effect). A consumer `aria-pressed` never survives next to `aria-checked` (`aria-pressed={undefined}` after `{...props}`). `data-pressed` always reflects the state. `isAccessible` (Fluent's name) draws the checked look as a brand fill with on-brand text, plus an inset stroke on `primary`. Forced colors keep the 0.6 pressed recipe. *Why:* `aria-pressed` is allowed only on `button` (axe `aria-allowed-attr`); `aria-checked` is allowed on those seven roles; `data-checked` matches the Menu checkable items, so one selector styles every checked item of a `checkedValues` group (C-CLASS); styles can target `data-pressed` whatever the ARIA attribute is.
- **D26 — `F2-foundation` edits `src/index.ts` for the presence exports** (wave A is exclusive). *Why:* the `verify-dist` presence probe needs the modules in a real build from wave A on; a probe that passes because the module is missing proves nothing.
- **D27 — Public and internal pieces.** `usePresence`, `Presence` and their types are public (closing `foundation-14`). `useCheckedValues`, `useHoverIntent`, `useContextMenuAnchor` and the event predicates of `src/lib/events.ts` stay internal (P7-01 publishes the positioning, dismiss and hover pieces in 0.12). *Why:* the presence core is the primitive every later surface and consumer motion builds on; the overlay helpers change shape until Phase 7.
- **D28 — Bundle budget for the presence core** (§6.2): the closure of `usePresence` and `Presence`, minified with React external, is at most 5 KiB, and at most 2 KiB gzip, and imports nothing but `react` and `react/jsx-runtime` (so a `cn` or `mergeProps` import, which would pull tailwind-merge into the closure outside the measurement, fails the gate); a Button-only bundle contains neither module; a Menu-only bundle contains `usePresence`. `verify-dist` gates all four. *Why:* roadmap Phase 2 entry and exit criteria; Phase 1 §9 found `verify-dist` reported no sizes, so this phase adds a real gate for the one new subsystem.
- **D29 — Trigger prop types do not narrow.** `MenuTriggerProps` (a closed type alias) keeps every member and type and gains the optional handler members `onPointerEnter`, `onPointerMove`, `onPointerLeave` and `onContextMenu`; `PopoverTriggerChildProps` already has them (it includes `React.HTMLAttributes<HTMLElement>`) and is unchanged: its existing optional members are now filled in hover and context modes. With `openOnContext`, a cloned child (and a wrapper span) receives the forwarded props (a wrapping Tooltip's `aria-describedby`, `className`, `data-*`, handlers, as in 0.6) plus, of the trigger's own props, only `id`, `ref`, `onContextMenu` and `onKeyDown`: no state ARIA and no click toggle. A render-prop child still receives every member (`aria-expanded` constantly `false`, no `aria-controls`, an `onClick` that does nothing); both JSDocs say not to spread the state ARIA in context mode, and `useTriggerElement` removes `aria-haspopup`, `aria-expanded` and `aria-controls` from the trigger element after each commit when they were spread, with a one-time development warning (`Menu.Trigger:context-state-aria`, `Popover.Trigger:context-state-aria`; §1.7). *Why:* making `aria-expanded` optional would narrow a type consumers read (roadmap principle 2); the 0.5 wrapper-span rule already moves the state ARIA after each commit, and removing it keeps a region `<div>` free of axe `aria-allowed-attr` violations whatever the consumer spread.
- **D30 — No open-change details in 0.7.** Menu and Popover `onOpenChange(open)` stay as in 0.6; hover and context opens are plain open changes. Reasons (`menu-5`, `popover-6`) stay in the backlog. *Why:* scope; an optional `details` argument is a non-breaking addition later (Phase 1 D9).
- **D31 — Focus follows the mouse inside a focused menu tree.** While focus is inside a menu tree (the root's list or any of its submenus), a mouse `pointermove` over an enabled item of one of its lists focuses that item (`preventScroll`), except while a safe zone of that list is active (D18) or when the item already has focus. Hover moves no focus while focus is elsewhere: a hover-opened root menu, or a static menu the user is not in, never takes focus from the page. A submenu that loses focus to such a hover focus (the pointer crossed to a sibling item) does not close through its layer's `focusOutside` at once: it becomes an unpinned hover surface and closes through the hover close (`closeDelay`, the safe zone), and hovering it again cancels that. Focus on a submenu trigger item that came from hover neither pins its submenu nor blocks its hover close. *Why:* with hover-opened submenus, focus left in the root list while the pointer highlights an item three levels deep makes Enter activate the wrong item and makes the arrow keys and Escape act on another list (Fluent and native menus move focus with the pointer; magnifiers follow focus); without the `focusOutside` exception, focus following the pointer across a sibling would close the submenu the safe zone is keeping open.
- **D32 — Menu item tests run in a harness.** `F2-menu-core` ships `renderInMenuList` (§1.19), which provides the Menu and list contexts (a real `useCheckedValues`, a spy `closeFromItem`, the 0.6 roving options and `group/menu` on a `role="menu"` element) without the root, trigger and popover modules. *Why:* those modules change in the same wave (`P2-menu-popup`); Phase 1 solved the same problem for Field with `renderWithFieldContext` (Phase 1 rule 9).

### 0.4 Out of scope for 0.7

Everything else in the roadmap. In particular: motion on any component (Phase 10; D4); Menu and Popover `onOpenChange` details and `closeOnScroll` outside context menus (`menu-5`, `popover-6`; D30); focusable disabled menu items (`menu-9`; disabled items stay skipped, as in 0.6); `subText` and a slot `secondaryContent` (`menu-7`, `menu-8`); inline menus and per-menu mount nodes (`menu-4`, `popover-5`); `hasIcons`/`hasCheckmarks` props (D10); a `switchIndicator` slot (D11); MenuGrid (preview); public positioning, dismiss and hover hooks and the `positioning` prop (P7-01); Fluent's `PositioningConfigurationProvider` (§8 Q10); Popover `trapFocus`, arrows, sizes and appearances; Tooltip arrow, offset, target and `relationship="inaccessible"`; InfoLabel on Popover (P4-03); a `RefObject` `target` on Menu and Popover and a `VirtualElement` target on TeachingPopover (P7-01, D20); a long-press timer for touch browsers that fire no `contextmenu` (iOS Safari; backlog, D19); a warning for radio items of different `name`s that share a list without a group (§9); and every other backlog gap. A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation

### Wave A1 — `F2-foundation`

Lands first. It changes no behaviour of an existing component: the presence core, the tokens and the helpers are new, the three hook changes (`usePopupPosition`, `useRovingTabIndex`, `useTriggerElement`) are additive, and `src/lib/events.ts` holds two predicates copied from `Menu.tsx` (A2 switches Menu over to them).

### 1.1 `src/lib/types.ts`

```ts
/**
 * Checked items of a menu or toolbar, per group `name`: `{ sort: ['date'], view: ['ruler', 'grid'] }`.
 * A checkbox or switch item (or a toolbar toggle) is checked while its `value` is in
 * `checkedValues[name]`; a radio item while its `value` is the group's only value.
 */
export type CheckedValues = Readonly<Record<string, readonly string[]>>;

/** Second argument of `onCheckedValuesChange`: the group that changed, its new items and the event. */
export interface CheckedValuesChangeDetails {
  /** The `name` of the group that changed. */
  name: string;
  /** The checked values of that group after the change (a new array). */
  checkedItems: string[];
  /** The DOM event behind the change (the item's click). */
  event: Event;
}

/**
 * Signature of `onCheckedValuesChange` (Menu, Toolbar): the new checked values first, then the
 * details. WaveUI always passes `details`; it is typed optional until 1.0 (read it as
 * `details?.name`), like `onOpenChange`'s.
 */
export type CheckedValuesChangeHandler = (
  checkedValues: Record<string, string[]>,
  details?: CheckedValuesChangeDetails,
) => void;

/** A rectangle in viewport coordinates, as `getBoundingClientRect()` returns it (a `DOMRect` is one). */
export interface PopupRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * A positioning anchor that is not an element: a rectangle read on demand, such as the pointer
 * position of a context menu or a text selection. `contextElement` is the element whose scroll
 * containers move the anchor (the surface follows them); without it only window scroll and resize
 * reposition the surface.
 */
export interface VirtualElement {
  getBoundingClientRect(): PopupRect;
  contextElement?: Element;
}

/**
 * Where a popup is placed instead of next to its trigger (`Menu.Popover` and `Popover` `target`):
 * an element held in state, or a `VirtualElement`. TeachingPopover's `target` (0.6) also takes a
 * ref and no `VirtualElement`; ROADMAP P7-01 unifies them.
 */
export type PopupTarget = HTMLElement | VirtualElement | null;
```

`src/index.ts` already re-exports every type of this module (one public home for `CheckedValuesChangeHandler`, which Menu and Toolbar both use; two barrels exporting it would clash). `types.test.ts`: `expectTypeOf` checks of the six types; `DOMRect` is assignable to `PopupRect`; `VirtualElement` is assignable to `@floating-ui/react-dom`'s `VirtualElement` (so `usePopupPosition` passes it on without a cast); `Record<string, string[]>` and a readonly literal (`{ view: ['grid'] } as const`) are assignable to `CheckedValues`.

### 1.2 `src/hooks/useCheckedValues.ts` (internal)

```ts
/** The checked-values state of a Menu tree or a Toolbar. */
export interface CheckedValuesApi {
  /** The rendered checked values (controlled, or the internal state). */
  readonly values: CheckedValues;
  /** Whether `value` is checked in group `name`. */
  isChecked(name: string, value: string): boolean;
  /**
   * Adds `value` to group `name` (at the end) or removes it: checkbox and switch items, toggles.
   * `listener` (a sharing submenu's `onCheckedValuesChange`, D7) is called after the owner's
   * callback with the same arguments, only on change.
   */
  toggle(name: string, value: string, event: Event, listener?: CheckedValuesChangeHandler): void;
  /** Makes `value` the only checked value of group `name` (radio items); no change when it is. */
  select(name: string, value: string, event: Event, listener?: CheckedValuesChangeHandler): void;
}

/**
 * The API a submenu that shares its parent's state passes to its items: `toggle` and `select`
 * forward to `api` with a listener that calls `listener` first, then any listener the caller
 * passed, so a nested chain calls the owner's callback, then the outer submenu's, then the inner
 * one's. Memoize the result on `api` and `listener`.
 */
export function withCheckedValuesListener(
  api: CheckedValuesApi,
  listener: CheckedValuesChangeHandler,
): CheckedValuesApi;

export function useCheckedValues(
  checkedValues: CheckedValues | undefined,
  defaultCheckedValues: CheckedValues | undefined,
  onCheckedValuesChange: CheckedValuesChangeHandler | undefined,
): CheckedValuesApi;
```

- State: `useControllable(checkedValues, defaultCheckedValues ?? EMPTY, emit)` with a frozen module constant `EMPTY = {}` (stable identity; a controlled value that becomes `undefined` falls back to it, useControllable's sticky rule).
- `toggle` and `select` use a functional update from the value the user sees. The next value is a new object in which every group is a new array (`[...items]`) and group `name` holds the changed list. `select` of the value that already is the group's only value returns the previous object, so `useControllable` skips the update and calls nothing.
- The details reach the callback through a ref set around the setter, the `useModalOpenState` pattern of `Dialog.shared.tsx` (`useControllable` calls its `onChange` synchronously inside the setter): `emit(next)` calls `onCheckedValuesChange(next, { name, checkedItems: next[name], event })`, then the request's `listener` with the same two arguments, and the ref is cleared when the setter returns, so a change no request caused never reports stale details.
- The returned object is memoized on `values` (C-MEMO); `isChecked`, `toggle` and `select` read the latest state. An unknown group reads as empty. Removing a value keeps the order of the others.
- Tests (`src/hooks/__tests__/useCheckedValues.test.tsx`): uncontrolled toggle adds and removes and calls the handler once per change with `{ name, checkedItems, event }`; controlled: the rendered value follows the prop, and a parent that ignores the callback keeps its value; `select` is exclusive and re-selecting calls nothing; the emitted object and its arrays are new (mutating them does not change the next render); readonly input; StrictMode calls once; two toggles in one event chain (useControllable's "same event" rule); a `listener` is called after the owner's callback with identical arguments and not for an unchanged `select`; `withCheckedValuesListener` twice nested calls owner, outer listener, inner listener in that order.

### 1.3 Motion tokens (P2-00; `foundation-16`)

`src/styles/tokens.css`, in the theme-independent `:root` block after the z-index constants (D5):

```css
  /* Motion: Fluent's motionTokens (react-motion 9.16.4). Theme-independent; components pair their
     motion with motion-reduce: variants (C-MOTION), the tokens are never zeroed. */
  --wave-duration-ultra-fast: 50ms;
  --wave-duration-faster: 100ms;
  --wave-duration-fast: 150ms;
  --wave-duration-normal: 200ms;
  --wave-duration-gentle: 250ms;
  --wave-duration-slow: 300ms;
  --wave-duration-slower: 400ms;
  --wave-duration-ultra-slow: 500ms;
  --wave-curve-accelerate-max: cubic-bezier(0.9, 0.1, 1, 0.2);
  --wave-curve-accelerate-mid: cubic-bezier(1, 0, 1, 1);
  --wave-curve-accelerate-min: cubic-bezier(0.8, 0, 0.78, 1);
  --wave-curve-decelerate-max: cubic-bezier(0.1, 0.9, 0.2, 1);
  --wave-curve-decelerate-mid: cubic-bezier(0, 0, 0, 1);
  --wave-curve-decelerate-min: cubic-bezier(0.33, 0, 0.1, 1);
  --wave-curve-easy-ease-max: cubic-bezier(0.8, 0, 0.2, 1);
  --wave-curve-easy-ease: cubic-bezier(0.33, 0, 0.67, 1);
  --wave-curve-linear: cubic-bezier(0, 0, 1, 1);
```

In the `@theme inline` block: `--transition-duration-wave-<name>: var(--wave-duration-<name>)` for the eight durations and `--ease-wave-<name>: var(--wave-curve-<name>)` for the nine curves. They generate `duration-wave-ultra-fast` … `duration-wave-ultra-slow` and `ease-wave-accelerate-max` … `ease-wave-linear` for Tailwind consumers; the precompiled `dist/styles.css` holds the variables and only the utilities the library itself uses. No keyframes and no `animate-*` token are added (Phase 10).

`src/lib/cn.ts`: `extend.theme.ease` gains the nine `wave-*` names and `extend.classGroups.duration` gains `[{ duration: ['wave-ultra-fast', …, 'wave-ultra-slow'] }]`, so `cn('duration-wave-fast', 'duration-200')` keeps `duration-200` and `cn('ease-wave-linear', 'ease-in')` keeps `ease-in`.

Tests:
- `src/styles/__tests__/tokens.test.ts`, a new `describe('motion tokens')`: reads `tokens.css`; each of the 17 variables is declared once, in the `:root` constants block (not in a theme group), with exactly the value above; each has its `@theme inline` mapping.
- `src/lib/__tests__/cn.test.ts`: the two merges above, and `cn('duration-wave-fast', 'ease-wave-linear')` keeps both.
- `scripts/__tests__/build-css.test.mjs`: `dist/styles.css` declares the 17 variables.
- `scripts/fixtures/tailwind/src/app.html` uses `duration-wave-normal ease-wave-decelerate-mid` on its `<main>`, and `checkTailwindCss` (`scripts/pack-smoke.mjs`) asserts that `.duration-wave-normal` and `.ease-wave-decelerate-mid` are generated (the Tailwind path exposes the utilities); `scripts/__tests__/pack-smoke.test.mjs` covers the new error.

### 1.4 The presence core (P2-00; `foundation-14`)

`src/hooks/usePresence.ts` (public, D27):

```ts
/**
 * Phase of an element that mounts and unmounts through the presence core: `entering` (its enter
 * motion runs), `entered`, `exiting` (its exit motion runs), `exited`.
 */
export type PresencePhase = 'entering' | 'entered' | 'exiting' | 'exited';

/** Options of {@link usePresence}. */
export interface UsePresenceOptions {
  /**
   * Run the enter phase when the element mounts already visible. Never on the server or while
   * hydrating: the server HTML is the `entered` phase, and a hydrated element does not replay its
   * enter motion.
   * @default false
   */
  appear?: boolean;
  /**
   * Unmount the element once it has exited. `false` keeps it mounted while exited, `hidden` and
   * `inert`, so its state (form fields, scroll position) survives.
   * @default true
   */
  unmountOnExit?: boolean;
  /** Called when an enter phase ends (after its motion, or at once without one). */
  onEntered?: () => void;
  /** Called when an exit phase ends, before the element unmounts. */
  onExited?: () => void;
}

/** The attributes the animated element takes. */
export interface PresenceAttributes {
  /** The phase, always rendered: style motion with `data-[presence=entering]:…` and friends. */
  'data-presence': PresencePhase;
  /** While exiting, and while exited when kept mounted: out of the tab order and the accessibility tree. */
  inert?: boolean;
  /** While exited when kept mounted (`unmountOnExit: false`). */
  hidden?: boolean;
}

/** Returned by {@link usePresence}. */
export interface UsePresenceResult {
  /** Whether to render the element. */
  isMounted: boolean;
  /** The current phase (Avatar's unrelated `PresenceStatus` is a user's availability). */
  phase: PresencePhase;
  /** Callback ref for the animated element (stable); the phases wait for its own animations. */
  ref: React.RefCallback<HTMLElement>;
  /** Spread onto the animated element. */
  presenceProps: PresenceAttributes;
}

/**
 * Mounts and unmounts an element with CSS enter and exit motion (D2). Style the phases with
 * `data-presence` variants, e.g. `transition-opacity duration-wave-normal
 * data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0
 * motion-reduce:transition-none` (the enter gated on its phase: §10). Destructure the result
 * (`const { isMounted, ref, presenceProps } = usePresence(open)`): react-hooks/refs treats an
 * object whose member is passed to `ref` as a ref, so reading `phase` or `presenceProps` from the
 * whole object during render is an error (the usePopupPosition rule). …
 */
export function usePresence(visible: boolean, options?: UsePresenceOptions): UsePresenceResult;
```

Behaviour (D2):
1. **Initial phase.** On the server and while hydrating (`useIsClient()` is `false`): `entered` when `visible`, else `exited`. On a client mount: `visible` → `appear ? 'entering' : 'entered'`; otherwise `exited`. `isMounted` is `phase !== 'exited' || !unmountOnExit`.
2. **Changes of `visible`** are derived during render with a previous-value state (C-HOOKS): `true` → `entering`; `false` → `exiting` when the element is mounted (an `exited` element stays `exited`). Showing it again while it exits goes back to `entering` with the same element.
3. **End of a phase.** A layout effect keyed on the phase and the element (the ref's element, held in state so the effect re-runs when it attaches, and mirrored into a ref by the callback ref; the effect reads the element through that ref, the 0.6 `staticMenuRef` pattern that react-hooks 7 accepts for a DOM-derived `setState` in a layout effect) ends `entering` and `exiting`:
   - at once when `usePrefersReducedMotion()` is `true`, when no element is attached, or when the element has no running finite animation;
   - otherwise when every finite animation of the element itself (`element.getAnimations()`, which lists CSS animations and transitions) has finished; a cancelled animation counts as finished, animations with an infinite end time are ignored;
   - without `getAnimations` (jsdom, older engines): from the element's computed style, the longest `animation-delay + animation-duration × animation-iteration-count` (names other than `none`, finite counts) and `transition-delay + transition-duration`; zero ends at once; otherwise the phase ends at that time plus 50 ms, or earlier once the element's own `animationend`/`animationcancel`/`transitionend`/`transitioncancel` events (target: the element itself) have accounted for every animation name and transitioned property its style lists.

   The immediate end is set from the layout effect (a DOM-derived update, like the static Menu's tab stop in 0.6), so an element without motion unmounts before the browser paints and within the same `act()`. A waiting phase ends from its promise or event callback (C-HOOKS), guarded by a token, so a phase that was replaced never ends the new one.
4. **Ends:** `entering` → `entered` (then `onEntered`); `exiting` → `exited` (then `onExited`, then the element unmounts unless `unmountOnExit` is `false`). The callbacks are never called from the effect that ends a phase (StrictMode re-runs a mount layout effect before the new phase has rendered, which would call them twice): an effect keyed on the committed phase calls them when the phase changed from `entering` to `entered` or from `exiting` to `exited` since its last run (a previous-phase ref written in that effect), so they run once per phase, also in StrictMode. An element unmounted by the parent while exiting (the whole subtree goes) calls no `onExited`.
5. **Attributes:** `data-presence` always; `inert` while `exiting`, and while `exited` when kept mounted; `hidden` while `exited` when kept mounted. Nothing else: no inline style and no class (roadmap guard "no runtime styles").
6. Focus, dismiss layers and focus restore stay the component's: surfaces keep keying them on their open state, so they run on close, not after the exit motion (roadmap P10-01).
7. **Imports** (D28): `usePresence` and `Presence` import only React and internal hooks (`useIsClient`, `usePrefersReducedMotion`, `useMergedRefs`); `Presence` merges its child's props by hand (the presence attributes, its own `inert`/`hidden` when the presence sets none) and never imports `cn` or `mergeProps`.

`src/components/motion/Presence.tsx` (public):

```ts
/** Properties for the Presence component. */
export interface PresenceProps extends UsePresenceOptions {
  /** Whether the content is shown; changes run the enter and exit phases. */
  visible: boolean;
  /**
   * A single element, which receives the presence attributes and ref (merged with its own ref and
   * props: its own `inert` and `hidden` apply while the presence sets none), or a render function
   * that receives the presence result.
   */
  children: React.ReactElement | ((presence: UsePresenceResult) => React.ReactNode);
}

/**
 * Shows and hides its child with CSS enter and exit motion: the child stays mounted while its exit
 * motion runs, `inert` and marked `data-presence="exiting"`, and unmounts when it ends (at once
 * under reduced motion or without motion). …
 */
export const Presence: (props: PresenceProps) => React.ReactNode; // displayName 'Presence'
```

`Presence` renders nothing while `!isMounted`. A child that is not a single element (text, several elements, a Fragment of several) renders as given, without an element to watch (its phases end at once), with a one-time development warning (`Presence:children`, from an effect). `src/components/motion/index.ts` exports `Presence` and `PresenceProps`.

Tests:
- `src/hooks/__tests__/usePresence.test.tsx`: initial phases (visible, hidden, `appear`, `unmountOnExit: false` → mounted with `hidden` and `inert`); hiding without motion removes the element in the same `act()` and calls `onExited` once; with `mockAnimations` (§1.9): `exiting`, `inert` and still mounted until the animations finish, then removed; a cancelled animation ends the phase; an infinite animation is ignored; showing again during exit returns to `entering` without `onExited`; `appear` with and without motion; reduced motion (`mockMatchMedia`) ends at once while an animation runs; the computed-style fallback with inline `animation-name`/`animation-duration` and fake timers (ends at duration + 50 ms, or at the end event); StrictMode (callbacks once); `renderToString` with `visible` and `appear` renders `data-presence="entered"`, and `hydrateRoot` logs nothing; the element never gets a `style` or `class` from the hook.
- `src/components/motion/__tests__/Presence.test.tsx`: an element child gets the attributes and the ref (its own ref still receives the element); a render function; the children warning (asserted); `displayName`; axe with a visible child.
- Type tests in both files: `PresencePhase` is the four-member union; `UsePresenceResult['phase']` is `PresencePhase`; `UsePresenceResult['ref']` is a `RefCallback<HTMLElement>`.
- Guard (roadmap "Carousel still starts paused under reduced motion"): the Carousel reduced-motion tests stay green unchanged; `usePrefersReducedMotion` is not changed.

Story `stories/Presence.stories.tsx` (title `Components/Motion/Presence`): `FadeAndSlide` (a Button toggles a card with `transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:translate-y-1 data-[presence=exiting]:opacity-0 data-[presence=exiting]:translate-y-1 data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none`; the enter gated on its phase, §10) and `KeepMounted` (`unmountOnExit={false}`, a text field whose content survives).

### 1.5 `src/hooks/usePopupPosition.ts` — virtual anchors (P2-06; `positioning-2`)

- `UsePopupPositionResult.setReference(el: HTMLElement | VirtualElement | null): void` (was `HTMLElement | null`). An element or `null` goes to floating-ui's `refs.setReference` as in 0.6. A `VirtualElement` does not: the hook keeps the latest one in a ref (written in `setReference`, which components call from a layout effect or an event, never during render) and hands floating-ui one stable internal proxy whose `getBoundingClientRect()` and `contextElement` read that ref. A new `VirtualElement` object therefore sets no floating-ui state: the hook calls floating-ui's `update()` (which sets state only when the computed position changed), and passes a new proxy only when the `contextElement` changes (so `autoUpdate` observes the new scroll containers). A context menu moved to another point repositions; a consumer's inline `target={{ getBoundingClientRect: () => rect }}`, a new object on every render, repositions without a render loop.
- JSDoc: "The anchor is an element or a `VirtualElement` (a rectangle such as the pointer position; a new object on every render is fine); give it a `contextElement` so scrolling its containers updates the position."
- Tests (`usePopupPosition.test.tsx`): a virtual anchor at (100, 200) with size 0 places a `bottom-start` surface at that point (mocked rects); replacing the virtual element repositions; a harness that passes a new inline `VirtualElement` on every render, with a render counter, renders a bounded number of times (no loop, no act() warning) and follows a rect that changes; a new `contextElement` re-subscribes the scroll listener; switching from a virtual anchor to an element and back; `side: 'end'` resolves against it in RTL; `fitViewport` writes the available-size variables for it.

### 1.6 `src/lib/events.ts` and `src/hooks/useHoverIntent.ts` (internal; P2-05)

`src/lib/events.ts` (server-safe, no React import beyond types; tests in `src/lib/__tests__/events.test.ts`): `isOwnEvent(event)` and `isDisabledTrigger(event)`, copied unchanged from `Menu.tsx` 0.6 with their JSDoc (A2 deletes the Menu copies and imports these, §1.13), and `isEditableTarget(target: EventTarget | null): boolean` (a text-type `input`: `text`, `search`, `url`, `tel`, `email`, `password`, `number` or no `type`; a `textarea`; an element whose `isContentEditable` is true). The hover and context hooks below use them, so `src/hooks` never imports a component module.

```ts
/** Options of {@link useHoverIntent}. */
export interface UseHoverIntentOptions {
  /** Whether hover opens and closes the surface. */
  enabled: boolean;
  /** Whether the surface is open (for any reason). */
  open: boolean;
  /** Milliseconds from the pointer entering the trigger to `onOpen`. */
  openDelay: number;
  /** Milliseconds from "the pointer is on neither the trigger nor the surface" to `onClose`. */
  closeDelay: number;
  /** The trigger and the surface elements, held in state (C-POPUPS). */
  trigger: HTMLElement | null;
  surface: HTMLElement | null;
  /** Hover asks to open. */
  onOpen: (event: PointerEvent) => void;
  /** Hover asks to close. */
  onClose: (event: Event) => void;
  /**
   * Whether the hover close applies now; read when a close would start and again when it fires.
   * The component returns `false` for a pinned surface (opened or re-activated by click, keys or a
   * context gesture) and while focus is inside the surface's layer tree. Focus on the trigger does
   * not count (D18).
   */
  canClose: () => boolean;
  /** Coordinates the safe zones of sibling triggers (the submenu triggers of one menu list). */
  group?: HoverIntentGroup;
}

/** Shared by the sibling triggers of one list; create one per list with `createHoverIntentGroup()`. */
export interface HoverIntentGroup {
  /** Whether a sibling's active safe zone contains this viewport point. */
  isHeld(x: number, y: number): boolean;
}
export function createHoverIntentGroup(): HoverIntentGroup;

/** Returned by {@link useHoverIntent}; compose the handlers with the consumer's (C-COMPOSE). */
export interface HoverIntent {
  triggerHandlers: {
    onPointerEnter: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    onPointerLeave: React.PointerEventHandler<HTMLElement>;
  };
  surfaceHandlers: {
    onPointerEnter: React.PointerEventHandler<HTMLElement>;
    onPointerLeave: React.PointerEventHandler<HTMLElement>;
  };
  /** Clears pending timers: call it on click, keyboard and context opens, and on close. */
  cancel: () => void;
  /**
   * Starts the close timer now when the pointer is on neither the trigger nor the surface (rule
   * 3), for a surface that has just become unpinned (a submenu that lost focus to hover focus,
   * D31). Does nothing while the pointer is on either.
   */
  startClose: (event: Event) => void;
}

export function useHoverIntent(options: UseHoverIntentOptions): HoverIntent;
```

Rules (D18):
1. **Mouse only.** A pointer event with `pointerType` `'touch'` or `'pen'` is ignored; one without `pointerType` (an environment without `PointerEvent`) counts as a mouse. A trigger event from an `aria-disabled="true"` element at or inside the trigger (`isDisabledTrigger`) is ignored too (C-DISABLED).
2. **Open.** The pointer entering the trigger while the surface is closed starts the `openDelay` timer; leaving the trigger first cancels it. When it fires while the group holds the pointer's last point (a sibling's safe zone contains it), it does not open, and only then does the next `pointermove` over the trigger start it again (the held case; a `pointermove` restarts nothing otherwise).
3. **Close.** When the pointer leaves the trigger or the surface and is over neither, and `canClose()` is `true`, the `closeDelay` timer starts; at expiry `canClose()` is read again, and `onClose` follows only when it is still `true`. The pointer entering the trigger or the surface cancels it. React fires enter and leave along the component tree, so a portal rendered inside the surface (a submenu, a nested Popover) counts as inside. A `focusout` of the surface tree that leaves focus outside it, while the pointer is over neither, starts the same timer (a hover-opened surface closes once the pointer has left and focus is not inside it).
4. **Safe zone.** When the pointer leaves the trigger while the surface is open and has a size, the zone is the triangle from the leave point to the two ends of the surface edge that faces the trigger: the surface's left edge when it starts at or after the trigger's right edge (1 px tolerance), else its right edge when it ends at or before the trigger's left edge, else its top edge when it starts below the trigger, else its bottom edge. While the zone is active (until the pointer enters the surface or the trigger, or a move leaves the triangle), a document `pointermove` listener (mouse only) restarts the close timer on every move inside the triangle (1 px tolerance): the surface stays open while the pointer moves towards it and closes `closeDelay` after it stops. A move outside the triangle ends the zone and leaves the running timer alone. The group reports the active zone to the siblings (rule 2).
5. `cancel()` and unmounting clear the timers; the document listener exists only while a zone is active. A zone also stops at the first pointer event after `open` becomes `false`.
6. **Dismissed stays dismissed** (WCAG 1.4.13). When `open` becomes `false` without the hook's own `onClose` (Escape, an outside press, item activation, a controlled close), hover opening is suppressed until the pointer leaves the trigger (`pointerleave`); entering it again afterwards opens as usual.

Tests (`src/hooks/__tests__/useHoverIntent.test.tsx`, a harness with a trigger and a surface): opens after `openDelay`; leaving before it cancels; touch and pen do nothing; an `aria-disabled` trigger (or an `aria-disabled` element inside it) does not open; closes `closeDelay` after leaving both; re-entering cancels; `canClose() === false` blocks at start and at expiry; focus leaving the surface starts the close; `startClose()` starts the timer only while the pointer is outside; after a close the hook did not cause, moving within the trigger past `openDelay` opens nothing, and leaving and re-entering opens; a `pointermove` restart happens only after a held open; the safe zone with `mockRect` rectangles: a diagonal path of `user.pointer` moves inside the triangle that crosses a sibling trigger of the same group keeps the surface open and does not open the sibling, a move outside the triangle closes after `closeDelay`, resting inside the triangle closes after `closeDelay`; the facing-edge rule for a surface on the left (RTL placement) and one below; StrictMode; no timer left after unmount (no act() warning).

### 1.7 `src/hooks/useContextMenuAnchor.ts` (internal; P2-06) and the context mode of `useTriggerElement`

```ts
/** Where a context gesture came from. */
export type ContextOrigin = 'pointer' | 'keyboard';

/** Options of {@link useContextMenuAnchor}. */
export interface UseContextMenuAnchorOptions {
  /** Whether context gestures on the trigger open the surface (`openOnContext`). */
  enabled: boolean;
  /** Whether the surface is open. */
  open: boolean;
  /** The trigger element (the context region), held in state: the point's `contextElement`. */
  trigger: HTMLElement | null;
  /** The surface's dismiss layer: context menus and scrolls inside its tree are inside. */
  layerId: string;
  /** A context gesture on the trigger asks to open (or, while open, to move to the new anchor). */
  onOpen: (origin: ContextOrigin, event: Event) => void;
  /** A context menu or an anchor-moving scroll outside asks a context-opened surface to close. */
  onClose: (reason: 'outside-context-menu' | 'scroll', event: Event) => void;
}

/** Returned by {@link useContextMenuAnchor}. Destructure it (react-hooks/refs, like usePresence). */
export interface ContextMenuAnchor {
  /**
   * The positioning anchor of the last context gesture: a zero-size `VirtualElement` at the
   * pointer (pointer origin), or the element that had focus when the key was pressed (keyboard
   * origin; `null` when that was the trigger itself). Kept until the next gesture, so an exiting
   * surface does not jump.
   */
  anchor: HTMLElement | VirtualElement | null;
  /** Whether the open surface was opened (last) by a context gesture; kept like `anchor`. */
  fromContext: boolean;
  /** The origin of the last gesture. */
  origin: ContextOrigin | null;
  /**
   * The element focused at the last gesture (not `<body>`, not inside the surface's layer tree),
   * else `null`: the first focus-return target of a context-opened surface (D19).
   */
  opener: React.RefObject<HTMLElement | null>;
  /** Compose onto the trigger. */
  triggerHandlers: {
    onContextMenu: React.MouseEventHandler<HTMLElement>;
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  };
  /** Compose onto the surface: the browser's context menu never opens over it. */
  surfaceHandlers: { onContextMenu: React.MouseEventHandler<HTMLElement> };
}

export function useContextMenuAnchor(options: UseContextMenuAnchorOptions): ContextMenuAnchor;
```

Rules (D19):
1. **Origin.** The trigger's `keydown` of Shift+F10 or `ContextMenu` (rule 3) sets a keyboard flag; the next `pointerdown` anywhere (capture), the next `keydown` of another key, or the surface closing clears it. A `contextmenu` on the trigger while the flag is set is the browser's event for that key press: it is prevented and changes nothing (the surface stays at its keyboard anchor), whenever the browser dispatches it (on keydown or keyup). Every other `contextmenu` is a pointer gesture at `(clientX, clientY)`, whatever its `button` (a macOS Ctrl+click reports `button` 0) or `pointerType`. A real pointer gesture always follows a `pointerdown`, which clears the flag.
2. **Trigger `contextmenu`** (not default-prevented; not from a portal rendered inside the trigger, `isOwnEvent`; not from an `aria-disabled="true"` element at or inside the trigger, `isDisabledTrigger`; not from an editable field, `isEditableTarget`: those keep the browser's menu and open nothing): `preventDefault()`; record `opener` (`document.activeElement`, unless it is `<body>` or inside the layer tree); a pointer gesture stores `anchor` = a zero-size `VirtualElement` at `(clientX, clientY)` with `contextElement` = the trigger; then `onOpen('pointer', event)`. A second gesture while open repeats this (the surface moves to the new point).
3. **Trigger `keydown`** of Shift+F10 or `ContextMenu` (no Ctrl, Alt or Meta; not default-prevented; an own event; not from a disabled element; not from an editable field): `preventDefault()`, set the keyboard flag, record `opener`, store `anchor` = the key event's target when it is not the trigger (the focused row), else `null` (the component then anchors to the trigger's focus target, else the trigger), then `onOpen('keyboard', event)`.
4. **Surface `contextmenu`:** `preventDefault()`.
5. **While open from a context gesture:** a document `contextmenu` (capture) outside the layer tree and outside the trigger calls `onClose('outside-context-menu', event)` without preventing its default (the browser's or another trigger's menu opens). A document `scroll` (capture) whose target is outside the layer tree calls `onClose('scroll', event)` only when the anchor's reference element (the point's `contextElement`, the keyboard anchor, else the trigger) has moved more than 2 px on either axis since the gesture (its `getBoundingClientRect()` recorded at the gesture); a scroll that did not move it (inertial scrolling still running at the right click, a scroll in an unrelated panel) is ignored.
6. `anchor` and `origin` are replaced at the next gesture, not reset on close (so an exiting surface keeps its position). `fromContext` is decided when `open` becomes `true` (a previous-value state during render): `true` when a gesture of the hook caused that open (a state its handlers set in the same update as `onOpen`), else `false` (a controlled open from outside); it keeps its value while the surface is closed or exiting. The keyboard flag clears on close.

Tests (`src/hooks/__tests__/useContextMenuAnchor.test.tsx`): a right click stores the point, records the focused element as `opener` and prevents the default; a Ctrl+click (`button: 0, ctrlKey: true`, coordinates) is a pointer gesture at its point; Shift+F10 and the ContextMenu key open with keyboard origin and the focused row as `anchor`; the `contextmenu` that follows the key press (`button: 0`, with or without coordinates) keeps the keyboard anchor; a `pointerdown` clears the flag, so the next `contextmenu` is a pointer gesture; a long press (`pointerType: 'touch'`) is a pointer gesture; a disabled, default-prevented or editable-field event and one from a portal inside the trigger do nothing (and the editable field's default is not prevented); a second right click moves the point; a right click outside closes without preventing its default; a scroll outside that moves the trigger (mocked rects) closes, one that does not move it and one inside do not; the surface prevents its own context menu; `anchor` survives the close and is replaced at the next gesture.

**Context mode of `useTriggerElement`** (`src/hooks/useTriggerElement.tsx`, additive): a new option `omitStateAria?: boolean` (default `false`). When `true`: a cloned child and a wrapper span get no `aria-haspopup`, `aria-expanded` or `aria-controls` (the state-ARIA move of the wrapper span is skipped too); for a render-prop child, which receives them anyway (D29), a layout effect after each commit removes the three attributes from the resolved trigger element when present and warns once (`<componentName>:context-state-aria`: "…is a context-menu region (openOnContext), which is not a menu button: do not spread aria-haspopup, aria-expanded and aria-controls onto it."). Tests in `useTriggerElement.test.tsx`: the three child kinds, the removal after a re-render that re-renders the same values, the asserted warning, and axe on a render-prop `<div>` region.

### 1.8 `src/hooks/useRovingTabIndex.ts` — transparent composites (P2-07)

- An element with `data-roving-transparent` is never a nested composite, whatever its role: a `role="radiogroup"` whose radios are items of the enclosing roving container (`Toolbar.RadioGroup`, D23). `data-roving-container` still makes an element nested (a transparent element must not carry one).
- `data-roving-transparent` joins `OBSERVED_ATTRIBUTES`. The hook's JSDoc bullet on nested composites names the marker.
- Tests (`useRovingTabIndex.test.tsx`): a `role="radiogroup"` with the marker inside a toolbar-like container: its buttons are items (arrows and Home/End reach them; one tab stop); without the marker it stays one nested composite (0.6); adding and removing the marker restamps.

### 1.9 `src/test-utils.ts` — `mockAnimations`

```ts
/** Options of {@link mockAnimations}. */
export interface MockAnimationsOptions {
  /**
   * Which elements report one running finite animation from `getAnimations()`.
   * @default elements carrying `data-test-motion` whose `data-presence` is `entering` or `exiting`
   */
  animated?: (el: Element) => boolean;
}

/** Returned by {@link mockAnimations}. */
export interface MockAnimations {
  /** Resolves the `finished` promise of every animation handed out so far (call inside `act`). */
  finishAll(): Promise<void>;
  /** Rejects them, as a cancelled animation does (call inside `act`). */
  cancelAll(): Promise<void>;
  /** How many running animations `getAnimations()` has handed out. */
  readonly started: number;
}

/**
 * Installs `Element.prototype.getAnimations` for the current test (jsdom has none) and removes it
 * after the test, to test the waiting phases of the presence core. Call it inside a test or a
 * `beforeEach` (it registers its cleanup with Vitest's `onTestFinished`, which a `beforeAll`
 * cannot use).
 */
export function mockAnimations(options?: MockAnimationsOptions): MockAnimations;
```

The JSDoc of `src/test-utils.ts` is the source of truth for the signature. The cleanup restores the previous `getAnimations` (normally none) through `onTestFinished`, so `src/test-setup.ts` needs no change. `src/__tests__/test-utils.test.tsx` covers the default predicate, a custom predicate, `finishAll`, `cancelAll`, and that the stub is gone in the next test.

### 1.10 `scripts/verify-dist.mjs` — presence probes and budget (D28)

- `probeTreeShaking(dist, { keep = 'Button', drop = 'Dialog', dropModules = [] })`: `dropModules` lists dist-relative module paths that must not be in the bundle, besides `components/**/<drop>.mjs`; a listed module that does not exist in `dist` is an error (the probe would pass vacuously).
- `probeIncludes(dist, { keep, modules })` (new): bundles an entry that imports only `keep`, as the tree-shaking probe does, and reports each of `modules` that is not in the bundle.
- `probeSizeBudget(dist, { names, maxMinifiedBytes, maxGzipBytes, allowedExternals })` (new): a minified Vite build of an entry that imports `names` from `dist/index.mjs`, bare imports external; returns the minified and gzip (`node:zlib`) sizes, the external ids the closure resolved, an error for each budget exceeded, and an error for each external id not in `allowedExternals` (so a dependency outside the measurement, such as tailwind-merge through `cn`, fails instead of hiding).
- `verifyDist` runs, besides the 0.5 probe (`Button` without `Dialog`): `probeTreeShaking(dist, { keep: 'Button', drop: 'Presence', dropModules: ['hooks/usePresence.mjs'] })`; `probeIncludes(dist, { keep: 'Presence', modules: ['hooks/usePresence.mjs'] })`, whose `keep` becomes `'Menu'` once `Menu.Popover` imports the core (a one-word change request of `P2-menu-popup` that the lead applies with its commit, since the script is `F2-foundation`'s); and `probeSizeBudget(dist, { names: ['usePresence', 'Presence'], maxMinifiedBytes: 5120, maxGzipBytes: 2048, allowedExternals: ['react', 'react/jsx-runtime'] })`. The CLI prints the measured budget sizes.
- `PENDING_FLAT_EXPORTS = ['Toolbar']` (§0.2 rule 13): until `P2-buttons` makes Toolbar a compound it is reported as `planned`, then as `pending` until INTEGRATION exports the flat names and empties the list (wave C); `--final` (§6.3) fails while it is not empty. The comment above the list names this phase's entry.
- Tests (`scripts/__tests__/verify-dist.test.mjs`) against fixture dists, as for the 0.5 probe: a listed drop module in the bundle is reported; a missing listed module is reported; `probeIncludes` reports a missing module; the budget reports an oversized fixture, an external outside `allowedExternals`, and passes a small one; the default `PENDING_FLAT_EXPORTS` reports `Toolbar` as planned against the real 0.6 exports.

### 1.11 Presence exports (D26)

- `src/index.ts`: `export { usePresence } from './hooks/usePresence';`, `export type { PresencePhase, PresenceAttributes, UsePresenceOptions, UsePresenceResult } from './hooks/usePresence';` and `export * from './components/motion';`.
- `src/__tests__/public-types.test.ts`: the presence types from the package entry (`PresencePhase` equal to the four-member union, `PresenceProps['visible']` a required boolean, `UsePresenceOptions['unmountOnExit']` optional boolean).

### 1.12 Exit criteria of wave A1

Full `npx vitest run` green (report any failure outside F2's files to the lead); `npm run typecheck` and `npm run lint` clean; `npm run build` and `node scripts/verify-dist.mjs` pass, print the presence budget and report `Toolbar` as planned; the lead commits `F2-foundation` before wave A2 starts.

### Wave A2 — `F2-menu-core`

Splits `Menu.tsx` into modules with the seam of §4.2 and adds the Menu root's part of P2-01. Every 0.6 Menu test stays green apart from the DOM changes listed in §6.4.

### 1.13 The module split

| Module | Contents | Wave A2 | Wave B | Wave C |
|---|---|---|---|---|
| `Menu.tsx` | the `Menu` compound (`Object.assign(MenuRoot, { … })`), the flat re-exports of every part, re-exports of `MenuProps` and the part types | F2-menu-core | read only | INTEGRATION |
| `Menu.root.tsx` | `MenuRoot`, `MenuProps`, the popup detection (`hasPopupParts`), the static list | F2-menu-core | P2-menu-popup | INTEGRATION |
| `Menu.context.ts` | `MenuContext`, `MenuListContext`, `MenuSubmenuTriggerContext`, their hooks, `InitialFocus`, `MenuSurfaceApi`, `useCheckableRegistry` | F2-menu-core | P2-menu-popup (members added only, §0.2 rule 12) | INTEGRATION |
| `Menu.shared.ts` | `MENU_ITEM_SELECTOR`, `withTypeaheadText`, the class strings (`menuSurfaceClasses`, `menuPopoverClasses`, `menuItemClasses`); `isOwnEvent` and `isDisabledTrigger` come from `src/lib/events.ts` (§1.6) | F2-menu-core | read only | INTEGRATION |
| `Menu.items.tsx` | `MenuItem`, `MenuDivider`, the internal `MenuItemRow`, `MenuColumnSpacers` and `useMenuItemActivation` | F2-menu-core | P2-menu-items | INTEGRATION |
| `Menu.trigger.tsx` | `MenuTrigger` (moved unchanged) | F2-menu-core | P2-menu-popup | INTEGRATION |
| `Menu.popover.tsx` | `MenuPopover` (moved; provides the list context and `group/menu`) | F2-menu-core | P2-menu-popup | INTEGRATION |
| `Menu.selectable.tsx` | `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemSwitch` (new) | — | P2-menu-items | INTEGRATION |
| `Menu.group.tsx` | `MenuGroup`, `MenuGroupHeader` (new) | — | P2-menu-items | INTEGRATION |
| `Menu.link.tsx` | `MenuItemLink` (new) | — | P2-menu-items | INTEGRATION |
| `Menu.splitGroup.tsx` | `MenuSplitGroup` (new) | — | P2-menu-popup | INTEGRATION |
| `__tests__/menuHarness.tsx` | `renderInMenuList` (test only, §1.19) | F2-menu-core | read only | INTEGRATION |

Imports go one way: part modules import `Menu.context.ts` and `Menu.shared.ts`; `Menu.root.tsx` imports `Menu.trigger.tsx` and `Menu.popover.tsx` (the popup detection); `Menu.splitGroup.tsx` imports `Menu.root.tsx` (its scan recognises a `<Menu>`) and `Menu.items.tsx`; `Menu.tsx` imports every module and nothing imports `Menu.tsx`, so no module cycle exists in the preserved-module ESM and CJS output; `Menu.context.ts` imports no component. Every module gets its own conventions-gate test and the `"use client"` banner automatically. `import { … } from '../Menu'` keeps working for every 0.6 name.

### 1.14 The context contract (`Menu.context.ts`)

```ts
/** Which item an opening focuses. (P2-menu-popup adds 'none' for hover opens.) */
export type InitialFocus = 'first' | 'last';

export interface MenuContextValue {
  // 0.6 members, unchanged in meaning:
  popup: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  openWithFocus: (target: InitialFocus) => void;
  takeInitialFocus: () => InitialFocus;
  registerSurface: (api: MenuSurfaceApi | null) => void;
  triggerId: string;
  labelledBy: string;
  onTriggerId: (id: string) => void;
  menuId: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  triggerElement: HTMLElement | null;
  setTriggerElement: (element: HTMLElement | null) => void;
  // 0.7 (F2-menu-core):
  /** The menu this one is nested in (a submenu, from P2-04 on), else `null`. */
  parent: MenuContextValue | null;
  /** The checked-values state the items of this menu read and change (own or the parent's, D7). */
  checked: CheckedValuesApi;
  /** Whether activating an item keeps its popup open when the item sets no `persistOnClick` (D9). */
  persistOnItemClick: boolean;
}

/** Provided by every menu list: the static root's `role="menu"` and every `Menu.Popover` surface. */
export interface MenuListContextValue {
  /** The menu that renders the list. */
  menu: MenuContextValue;
  /** `true` for a static root, `false` for a popover surface. */
  isStatic: boolean;
  /**
   * The `PortalDepthContext` value the list's children see (the static root: the value around
   * it; `Menu.Popover`: its own value + 1, inside its Portal). A Menu is a submenu only when its
   * own depth equals this (D14): a Menu inside a Popover or Dialog opened from the list is not.
   */
  portalDepth: number;
  /**
   * Called by an item that was activated and should close its menu. A popover surface puts focus
   * on its trigger first, then closes (0.6); a static list does nothing. P2-04 makes the popover
   * version close the whole chain (D15).
   */
  closeFromItem: () => void;
  /**
   * Development only (a no-op in production): a checkable item registers its `name`/`value` from
   * an effect and unregisters on cleanup; a second registration of the same pair in one list warns
   * once (`Menu:duplicate-value`), since both items would show as checked.
   */
  registerCheckable: (name: string, value: string) => () => void;
}

/** `true` inside the element a submenu's `Menu.Trigger` renders (its `Menu.Item`). */
export const MenuSubmenuTriggerContext: React.Context<boolean>; // default false

export function useMenuContext(componentName: string): MenuContextValue; // 0.6 C-CONTEXT behaviour
export function useOptionalMenuContext(): MenuContextValue | null;
export function useMenuListContext(): MenuListContextValue | null; // null outside any list
```

The 0.6 `MenuSurfaceContext` (`{ close }`, `null` in a static menu) is replaced by `MenuListContext`; `Menu.Item`'s `Menu:item-outside-popover` warning now fires when the item's menu is a popup menu and no list context exists (same key, same text). The inert production context gains `parent: null`, an inert empty `checked` and `persistOnItemClick: false`. The static root and `Menu.Popover` render their list element with the class `group/menu` (D10) and provide `MenuListContext` (memoized, C-MEMO), with `registerCheckable` from `useCheckableRegistry()` (a per-list count map created with `useState`, `Menu.context.ts`).

`Menu.Popover`'s `registerSurface` layout effect is keyed on `open` as well as the surface (`if (!surface || !open) return;`): from P2-04 on, a surface can stay mounted while it exits (D4), and a registered exiting surface would make `openWithFocus` focus its inert items instead of reopening the menu. F2-menu-core makes the change (a no-op in 0.6, where the surface unmounts on close) so the seam already has it.

### 1.15 The item row and column alignment (`Menu.items.tsx`; `menu-6`, D10)

```ts
/** Internal: the content of one menu item row, rendered inside the item element. */
export interface MenuItemRowProps {
  /**
   * Checkable items: the checkmark column's content (the glyph, or `null` while unchecked); the
   * column renders in both states, marked `data-menu-checkmark`. `undefined` for other items,
   * which render a hidden placeholder instead.
   */
  checkmark?: React.ReactNode | null;
  /** The icon slot (0.6 rules: a falsy icon or a list of nothing is no icon). */
  icon?: Slot<'span'>;
  /** The label (0.6 typeahead marking: `data-menu-label` for a non-string label). */
  label: React.ReactNode;
  /** The shortcut text (0.6). */
  shortcut?: string;
  /** Content at the row's end: the submenu chevron (§1.18) or `Menu.ItemSwitch`'s switch. */
  end?: React.ReactNode;
}
export function MenuItemRow(props: MenuItemRowProps): React.ReactElement;
/** The two column placeholders alone, for a row that is not an item (`Menu.GroupHeader`). */
export function MenuColumnSpacers(): React.ReactElement;
```

Row order (DOM order, so RTL mirrors it): checkmark column, icon column, label (`flex-1`), shortcut, end.
- Checkmark column: `inline-flex w-4 shrink-0 items-center justify-center`, `data-menu-checkmark`, `aria-hidden`; rendered by checkable items in both states. Placeholder in other rows: `<span aria-hidden="true" data-menu-column-space="checkmark" class="hidden w-4 shrink-0 group-has-[[data-menu-checkmark]]/menu:inline-flex">`.
- Icon column: the 0.6 icon box (`flex h-5 w-5 shrink-0 items-center justify-center`) gains `data-menu-icon`. Placeholder in rows without an icon: `hidden h-5 w-5 shrink-0 group-has-[[data-menu-icon]]/menu:inline-flex`, `aria-hidden`, `data-menu-column-space="icon"`.
- A row whose label renders nothing (`slotRendersContent(label)` is `false`: an icon-only item such as a split group's submenu half) renders no placeholders.
- `menuItemClasses` (`Menu.shared.ts`) gains `aria-expanded:bg-subtle-hover` (an item whose submenu is open keeps its highlight) and, for forced colors, where backgrounds are replaced, a start bar that cannot be mistaken for focus: `forced-colors:aria-expanded:border-s-4 forced-colors:aria-expanded:border-[Highlight] forced-colors:aria-expanded:ps-2` (logical, so it mirrors in RTL; the 4 px bar plus `ps-2` keeps the 0.6 `px-3` inset, so nothing shifts). The 2 px inset outline stays the focus ring's alone, so while focus is inside the submenu the parent's trigger item does not look focused. Its 0.6 classes are unchanged.
- `MenuItemProps.children` becomes optional (a non-breaking widening, D16): a submenu trigger item without a label (a split group's half) is written `<Menu.Item aria-label="…" />`. Its JSDoc: "Label content of the menu item. Leave it out only for the submenu half of a `Menu.SplitGroup`, which then needs `aria-label`."

### 1.16 Item activation (`Menu.items.tsx`)

```ts
/** Internal: the activation of every menu item kind. */
export interface MenuItemActivationOptions {
  disabled: boolean;
  /**
   * The item's own `persistOnClick`; `undefined` falls back to the Menu's `persistOnItemClick`.
   * `Menu.ItemLink` passes `false` (a link always closes, D13).
   */
  persistOnClick: boolean | undefined;
  /** The consumer's handlers, composed consumer first (C-COMPOSE). */
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  /** Runs on an own, enabled click after the consumer's `onClick`, unless it prevented the default. */
  onActivate?: (event: React.MouseEvent<HTMLElement>) => void;
  /** Space activates and keeps the menu open (checkbox, radio and switch items, D8). */
  keepOpenOnSpace?: boolean;
  /** Enter is left to the element's native activation (links, D13); Space still clicks. */
  nativeEnter?: boolean;
  /** The item opens a submenu: activation never closes its menu (§1.18). */
  hasSubmenu?: boolean;
}
export function useMenuItemActivation(options: MenuItemActivationOptions): {
  onClick: React.MouseEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
};
```

It is `Menu.Item`'s 0.6 logic, unchanged for a plain item: portal events never activate (`isOwnEvent`, now from `src/lib/events.ts`); a disabled item calls no `onClick` and prevents an own click; Enter and Space are consumed (with Ctrl, Alt or Meta they are left to the page) and click the item; a Space that continues a typeahead search is skipped (the roving capture handler prevents its default). After the consumer's `onClick` and `onActivate`, the item closes its menu through `useMenuListContext()?.closeFromItem()` unless the click was not its own, its default was prevented, `hasSubmenu` is set, `keepOpenOnSpace` is set and the click came from Space (a ref written in the key handler), or `persistOnClick ?? menu.persistOnItemClick` is `true`.

### 1.17 The Menu root: checked values and `persistOnItemClick` (P2-01, root part)

Additions to `MenuProps` (`Menu.root.tsx`):

```ts
/**
 * Checked items of the menu's checkbox, radio and switch items, per group `name` (controlled).
 * A submenu without its own `checkedValues` or `defaultCheckedValues` shares its parent menu's
 * state. Works for static and popup menus; unlike `open`, it does not make Menu a popup menu.
 */
checkedValues?: CheckedValues;
/** Initial checked items for uncontrolled usage (gives a submenu its own state). @default {} */
defaultCheckedValues?: CheckedValues;
/**
 * Called when an item changes the checked items (only on change): the new checked values of every
 * group first, then `details` with the group's `name`, its `checkedItems` and the `event` (Fluent's
 * `onCheckedValueChange(event, { name, checkedItems })`). WaveUI always passes `details`; it is
 * typed optional until 1.0. On a submenu that shares its parent's state it only listens: it is
 * called after the parent's callback, for changes made in this submenu.
 */
onCheckedValuesChange?: CheckedValuesChangeHandler;
/**
 * Keep a popup menu open after any of its items is activated; an item's own `persistOnClick`
 * wins. A submenu inherits it unless it sets it.
 * @default false
 */
persistOnItemClick?: boolean;
```

- `MenuRoot` always calls `useCheckedValues(checkedValues, defaultCheckedValues, onCheckedValuesChange)` and puts it in the context when it sets `checkedValues` or `defaultCheckedValues`, or has no parent menu; otherwise it puts `parent.checked`, wrapped with `withCheckedValuesListener(parent.checked, onCheckedValuesChange)` (memoized) when it sets only `onCheckedValuesChange` (D7). In wave A2 `parent` is always `null` (P2-04 fills it; the sharing and listener cases are tested there).
- `persistOnItemClick` in the context: the prop, else the parent's, else `false`.
- `isOwnEvent` and `isDisabledTrigger` are imported from `src/lib/events.ts`; the 0.6 copies are deleted.
- The popup detection is unchanged: only `open`, `defaultOpen`, `onOpenChange` and the popup parts make a popup menu. The root's "ignored props" warning does not list the four new props (they are not DOM props).

### 1.18 The submenu-trigger path of `Menu.Item` (dormant until P2-04)

When `MenuSubmenuTriggerContext` is `true`, `Menu.Item`:
- renders `data-has-submenu=""` (boolean, Phase 1 D22) and, as the row's `end`, a `ChevronRightIcon` at 16 px with `ms-auto shrink-0 wave-rtl:-scale-x-100` and `aria-hidden`;
- activates with `hasSubmenu: true` (it never closes its menu; the trigger's merged `onClick` opens the submenu);
- keeps every other 0.6 rule (disabled, typeahead text, icon).

### 1.19 Tests of wave A2

- `Menu.test.tsx` (0.6 suite): green; the only expected edits are the DOM changes of §6.4 (placeholder spans).
- **The harness** (`src/components/navigation/__tests__/menuHarness.tsx`, test only, D32):
  ```ts
  /** Options of {@link renderInMenuList}. */
  export interface MenuListHarnessOptions {
    /** A static list (activation closes nothing) or a popover list. @default false */
    isStatic?: boolean;
    /** The list's close request; assert calls on it. @default vi.fn() */
    closeFromItem?: () => void;
    checkedValues?: CheckedValues;
    defaultCheckedValues?: CheckedValues;
    onCheckedValuesChange?: CheckedValuesChangeHandler;
    /** @default false */
    persistOnItemClick?: boolean;
    /** Wraps the list in `MenuSubmenuTriggerContext` for the dormant submenu path. */
    submenuTrigger?: boolean;
    /** Passed on to `render` (e.g. `wrapper` for RTL through `WaveProvider`). */
    renderOptions?: RenderOptions;
  }
  /** Renders `ui` as the items of a menu list: the Menu and list contexts, and the list element. */
  export function renderInMenuList(
    ui: React.ReactNode,
    options?: MenuListHarnessOptions,
  ): RenderResult & { closeFromItem: Mock; list: HTMLElement };
  /** The same tree as an element, for `renderToString` and `hydrateRoot`. */
  export function MenuListHarness(props: MenuListHarnessOptions & { children: React.ReactNode }): React.ReactElement;
  ```
  It provides a `MenuContextValue` (`popup: !isStatic`, a real `useCheckedValues`, `parent: null`, the other members inert) and a `MenuListContextValue` (`portalDepth` from the surrounding `PortalDepthContext`, a real `useCheckableRegistry`), and renders `<div role="menu" aria-label="Test menu" data-roving-container class="group/menu …">` with the 0.6 roving options and `withTypeaheadText`, as the static root does. It imports only `Menu.context.ts`, `Menu.shared.ts`, the foundation hooks and Testing Library.
- `Menu.test.tsx` additions: the list element has `group/menu` (static root and popover); `registerSurface` is not called for a closed surface.
- `src/components/navigation/__tests__/Menu.items.test.tsx` (new; through `renderInMenuList`, so `P2-menu-items` can keep it in wave B): the row order; placeholders hidden without columns and carrying the `group-has-[…]/menu:` classes (class assertions; jsdom computes no such style); an icon item marks `data-menu-icon`; an icon-only item renders no placeholders; a `useMenuItemActivation` table: an own click closes, a portal click does not, a prevented default does not, `persistOnClick` both ways, Menu `persistOnItemClick` with and without an item override, Space with `keepOpenOnSpace` keeps the menu open, Enter with `nativeEnter` is not prevented, `hasSubmenu` never closes; the submenu path with a test `MenuSubmenuTriggerContext.Provider` (chevron, `data-has-submenu`, no close, the `wave-rtl:` class); a `Menu.Item` without children and with `aria-label` renders no placeholders and is named by its label; the forced-colors expanded-bar classes; `registerCheckable` warns once for a duplicate pair in one list and not across two lists (asserted); the harness itself (its list is a roving container; `closeFromItem` is a spy).
- `src/components/navigation/__tests__/Menu.checkedValues.test.tsx` (new; it renders the real root, so `P2-menu-popup` owns it in wave B): through a test-local item that calls `useMenuContext('Test').checked` (internal import): uncontrolled and controlled state, the callback's arguments, StrictMode once; passing only `checkedValues` keeps a Menu of items static (`role="menu"` rendered); `persistOnItemClick` reaches the context.

### 1.20 Exit criteria of wave A2

As §1.12; in addition every 0.6 test that renders a real Menu is green: `Menu.test.tsx`, `List.test.tsx`, `DataGrid.test.tsx`, `Toolbar.test.tsx`, `MenuButton.test.tsx` and `SplitButton.test.tsx` (their `WithMenu` story cases), `src/__tests__/integration.test.tsx` and the stories axe gate (`stories.a11y.test.tsx`, the Menu, MenuButton, SplitButton and Toolbar stories). `F2-menu-core` may update any of them for the DOM changes of §6.4 (wave A2 is exclusive) and lists each update in its report; in waves B and C a breakage there goes to the lead as a change request, and INTEGRATION updates the files no wave-B package owns. The lead commits `F2-menu-core` before wave B starts.

---

## 2. Items

Each item gives: gaps closed, public API (with JSDoc outline and `data-*` state), behaviour (keyboard per APG, focus, ARIA, SSR, RTL, forced colors, motion), files, tests, guards, stories, docs notes and compatibility. "Docs" lines are input for DOCS (§5), which writes the final text. Wave-B tests follow §0.2 rule 9: they render only the foundation, 0.6 APIs and their own package's new APIs; combinations of two wave-B packages are INTEGRATION cases (§4.8).

### P2-00 — Motion tokens and the presence core (F2-foundation)

- **Closes:** `foundation-14` (M), `foundation-16` (L).
- **API.** The tokens and utilities of §1.3; `usePresence`, `Presence` and their types (`PresencePhase`, `PresenceAttributes`, `UsePresenceOptions`, `UsePresenceResult` with `phase`, `PresenceProps`; §1.4), exported from the package entry (§1.11). The roadmap sketch's `state` member and `data-state` styling became `phase` and `data-presence` (D2, D3).
- **Behaviour.** §1.4 (D2, D3). New surfaces from 0.7 on mount through the core: the Menu surfaces in P2-04 (D4); the toast parts (P3-02), drawer types (P6-05 … P6-07) and NavDrawer (P6-08) later.
- **SSR.** `entered`/`exited` on the server; no replay of `appear` after hydration. **RTL.** Nothing directional (attributes only). **Forced colors.** Nothing painted. **Motion.** The core ends every phase at once under reduced motion; motion classes are the consumer's (or, from Phase 10, the component's) and carry `motion-reduce:` variants.
- **Guards** (roadmap "no runtime styles"; "Carousel still starts paused under reduced motion"): the §1.4 test that the hook adds no `style` or `class`; the Carousel reduced-motion tests unchanged.
- **Files.** §3, `F2-foundation`.
- **Tests.** §1.3, §1.4, §1.9, §1.10.
- **Stories.** `stories/Presence.stories.tsx` (§1.4).
- **Docs.** README "Hooks and utilities" (`usePresence`, `Presence`) and a new "Motion" usage note (the tokens, `data-presence` styling with `starting:` and `data-[presence=exiting]:`, reduced motion, the Tailwind-only utilities); guide chapter 6 (§5.4); CLAUDE.md C-MOTION (§5.3); CHANGELOG Added.
- **Compatibility.** Additive. `dist/styles.css` gains 17 custom properties on `:root`.
- **Size.** M.

### P2-01 — Checkbox, radio and switch menu items with `checkedValues` (F2-menu-core root; P2-menu-items items)

- **Closes:** `menu-11` (H), `menu-12` (H), `menu-13` (L), `menu-6` (L).
- **API.** The Menu root props of §1.17 (F2-menu-core). In `Menu.selectable.tsx` (P2-menu-items):
  ```ts
  /** The `checkedValues` group a checkable menu item belongs to (Fluent's `MenuItemSelectableProps`). */
  export interface MenuItemSelectableProps {
    /** The group: a key of the menu's `checkedValues`. Radio items with the same `name` are exclusive. */
    name: string;
    /** The value that is in `checkedValues[name]` while the item is checked; unique within its group. */
    value: string;
  }

  /** Properties for the MenuItemCheckbox sub-component. */
  export interface MenuItemCheckboxProps extends MenuItemProps, MenuItemSelectableProps {
    /**
     * Replaces the check glyph shown while the item is checked (decorative, `aria-hidden`). A
     * checked item always shows an indicator: `null`, `undefined` and a value that renders nothing
     * keep the default glyph (a value that renders nothing also warns in development).
     */
    checkmark?: Slot<'span'>;
  }

  /** Properties for the MenuItemRadio sub-component. */
  export interface MenuItemRadioProps extends MenuItemProps, MenuItemSelectableProps {
    /** As `MenuItemCheckbox.checkmark`. */
    checkmark?: Slot<'span'>;
  }

  /** Properties for the MenuItemSwitch sub-component. */
  export interface MenuItemSwitchProps extends MenuItemProps, MenuItemSelectableProps {}
  ```
  Component JSDoc outlines (each ends with "Also exported as `MenuItemCheckbox` (import the flat name from React Server Components)", and so on):
  - `Menu.ItemCheckbox`: "A menu item that is checked or not (`role="menuitemcheckbox"`, `aria-checked`), bound to the menu's `checkedValues[name]` by `value`. A click and Enter toggle it and close a popup menu (unless `persistOnClick`, or the Menu's `persistOnItemClick`); Space toggles it and keeps the menu open. A check shows while it is checked, and the menu reserves the check column for all its items. Works in static and popup menus."
  - `Menu.ItemRadio`: the same with `role="menuitemradio"`: "checking it unchecks the other radio items of its `name`; activating a checked radio item changes nothing (no `onCheckedValuesChange`). Put the radio items of one `name` in a `Menu.Group` (at least separate two sets with a `Menu.Divider`): assistive technology counts a radio set by its group or separators, not by `name`, so two sets side by side are announced as one."
  - `Menu.ItemSwitch`: "a checkbox item drawn as a switch at the end of the row (`role="menuitemcheckbox"`)."
  - `MenuItemProps.persistOnClick` JSDoc (F2-menu-core, `Menu.items.tsx`): "Keep a popup menu open after this item is activated. `true` or `false` here wins over the Menu's `persistOnItemClick`. @default the Menu's `persistOnItemClick` (`false`)"
- **Behaviour** (D6–D11).
  - Checked: `menu.checked.isChecked(name, value)`. The element: `<div role="menuitemcheckbox" | "menuitemradio">` (the role before `{...rest}`, as on `Menu.Item`) with `aria-checked` (`true`/`false`, always) and `data-checked=""` while checked (boolean, Phase 1 D22), both after `{...rest}` (a consumer cannot contradict the state, as 0.6 does with `aria-disabled`), plus the 0.6 `aria-disabled`/`data-disabled`. Each item calls `useMenuListContext()?.registerCheckable(name, value)` from an effect (duplicate warning, §1.14).
  - Activation through `useMenuItemActivation` with `keepOpenOnSpace: true` and `onActivate`: checkbox and switch items call `checked.toggle(name, value, event.nativeEvent)`, radio items `checked.select(…)`. A consumer `onClick` runs first; `preventDefault()` in it cancels the change and the close (C-COMPOSE).
  - Row: checkbox and radio items pass `checkmark` = the glyph while checked, else `null` (the column stays); the glyph is `CheckIcon` at 16 px in `currentColor`, or the `checkmark` slot rendered with `renderSlot(…, 'span', …, { 'aria-hidden': true })`; an empty slot keeps the glyph and warns once from an effect (`Menu.ItemCheckbox:checkmark-empty`, `Menu.ItemRadio:checkmark-empty`, messages starting "Menu.ItemCheckbox: …"). `Menu.ItemSwitch` passes no `checkmark` (so it shows the column placeholder when the list has checks) and, as `end`, the switch indicator: `<span aria-hidden data-menu-switch>` 32×16 px track with a 10 px thumb, the tokens and forced-colors recipe of `Switch.tsx` (checked track `border-primary bg-primary`, thumb `bg-primary-foreground`; unchecked `border-stroke-accessible bg-transparent`, thumb `bg-stroke-accessible`; thumb `translate-x-[18px] wave-rtl:-translate-x-[18px]` checked and `translate-x-[2px] wave-rtl:-translate-x-[2px]` unchecked; `transition-colors`/`transition-transform` with `motion-reduce:transition-none`; the thumb `forced-colors:bg-[HighlightText]`/`[ButtonText]`/`[GrayText]` as Switch does), copied into `Menu.selectable.tsx` (Switch.tsx exports no class maps and is not changed).
  - Disabled items show their state and never change it (0.6 disabled rules: skipped by the keys, no `onClick`).
  - In a static menu, activation changes the state and closes nothing. Items of a submenu share the tree's state (D7; the case with a real submenu is INTEGRATION §4.8 #1).
- **Keyboard** (APG menu): ArrowUp/ArrowDown, Home/End and typeahead as 0.6 (typeahead matches the label, not the glyph); Space toggles (radio: checks) and keeps the menu open; Enter and a click toggle and close a popup menu unless persisting; Escape and Tab as 0.6.
- **ARIA.** `aria-checked` on every checkable item; the label names it (axe `aria-toggle-field-name`); the glyph and the switch are `aria-hidden`.
- **SSR.** A static menu renders `aria-checked` and the glyph from `checkedValues`/`defaultCheckedValues` in the server HTML (a popup menu is closed on the server, 0.6).
- **RTL.** The row mirrors by DOM order; the switch thumb has `wave-rtl:` counterparts (C-LOGICAL). **Forced colors.** The glyph is `currentColor` (visible in `CanvasText` and `HighlightText`); the switch uses Switch's recipe; the 0.6 focus ring shows the focused item. **Motion.** Only the switch's transitions, with `motion-reduce:`.
- **Guards** (the dismiss-layer stack, Escape routed by focus): the 0.6 Escape-routing tests of `Menu.test.tsx` stay green; the case with a real popup menu of checkable items inside a modal, where Escape closes only the menu, is INTEGRATION's (§4.8 #12).
- **Files.** `Menu.selectable.tsx` (new), its tests; root props and columns in F2-menu-core's files (§1.15, §1.17).
- **Tests** (`src/components/navigation/__tests__/Menu.selectable.test.tsx`, through `renderInMenuList`, §0.2 rule 18): roles, `aria-checked` and `data-checked` for each kind, and a consumer `aria-checked` that does not override them; uncontrolled and controlled `checkedValues` (a parent that ignores the callback keeps the value); `onCheckedValuesChange` arguments (`{ name, checkedItems, event }`, the event being the click) and once per change in StrictMode; in a popover list: Space toggles and does not call `closeFromItem`, Enter and click toggle and call it once, `persistOnClick` and `persistOnItemClick` keep it uncalled, an item's `persistOnClick={false}` beats the Menu's `true`; radio exclusivity per `name`, two radio groups side by side, re-selecting calls nothing and still calls `closeFromItem` on click; a consumer `onClick` with `preventDefault()` changes nothing and does not close; disabled items do not change; in a static list activation changes the state and closes nothing; the check column: a checked item shows the glyph, an unchecked one an empty `data-menu-checkmark` span, a plain `Menu.Item` in the same list renders the placeholder (class assertion); the `checkmark` slot and its empty-value warning (asserted, dotted key); the duplicate `name`/`value` warning (asserted); the switch indicator classes (checked and unchecked, `wave-rtl:` classes, forced colors); SSR of the harness with `defaultCheckedValues` (`renderToString` of `MenuListHarness`, hydration without warnings); RTL render; axe for a popover list and a static list with all three kinds; `testSystemProps` for each part (`expectedTag: 'div'`, the harness as `wrapper`); type tests (`MenuItemCheckboxProps` requires `name` and `value`, `@ts-expect-error` without them; `checkmark` is a `Slot<'span'>`). The real-Menu cases (focus returns to the trigger on Enter, SSR of a static `Menu`, submenus) are INTEGRATION's (§4.8 #1, #12).
- **Stories** (`stories/Menu.items.stories.tsx`, §0.2 rule 14): `CheckboxItems` (a View menu), `RadioItems` (Sort by, in a group), `SwitchItems`, `MixedColumns` (icons, checks and shortcuts aligned), `StaticCheckable`, `ControlledCheckedValues`.
- **Docs.** README "Menus": checkable items, `checkedValues`, Space versus Enter, column alignment, one `Menu.Group` per radio `name`; keyboard table Menu row; CHANGELOG Added (and "Visual" for the columns, §5.1).
- **Compatibility.** Additive; the column alignment is a visual change for 0.6 menus that mix items with and without icons (F2-menu-core, D10).
- **Size.** M.

### P2-02 — `Menu.Group` and `Menu.GroupHeader` (P2-menu-items)

- **Closes:** `menu-15` (M).
- **API** (`Menu.group.tsx`):
  ```ts
  /** Properties for the MenuGroup sub-component. */
  export interface MenuGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Ref to the `role="group"` element. */
    ref?: React.Ref<HTMLDivElement>;
  }
  /** Properties for the MenuGroupHeader sub-component. */
  export interface MenuGroupHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Ref to the header element. */
    ref?: React.Ref<HTMLDivElement>;
  }
  ```
  JSDoc outlines: `Menu.Group`: "A labelled group of menu items (`role="group"`), for example the radio items of one choice. Labelled by its `Menu.GroupHeader` when the header is a direct child (or inside a Fragment); a header nested deeper does not label it (development warning). Pass `aria-label` for a group without a visible header." `Menu.GroupHeader`: "The visible heading of a `Menu.Group`. It is not a menu item: arrow keys and typeahead skip it. Must be used inside `Menu.Group`."
- **Behaviour** (D12).
  - `Menu.Group` renders `<div role="group" aria-labelledby={headerId}>` when the static scan (`flattenChildren` + `isElementOfType(node, MenuGroupHeader)`) finds a header among its direct children or Fragments; `headerId` is the header's own `id` prop when it has one, else `useId('menu-group-header')` (C-IDS). A consumer `aria-label` or `aria-labelledby` wins (then the group adds none). The group provides a context `{ headerId, labelled }` (default `null`, C-CONTEXT).
  - `Menu.GroupHeader` renders `<div id={headerId} class="flex items-center gap-2 px-3 pb-1 pt-2 text-caption-1 font-semibold text-muted-foreground">` with `MenuColumnSpacers` before its text, so the text lines up with the item labels. Outside a `Menu.Group` its context hook throws in development (C-CONTEXT). Inside a group whose scan did not find it, it warns once from an effect (`Menu.GroupHeader:unlabelled`: "…is not a direct child of Menu.Group, so it does not label the group. Make it a direct child, or pass aria-label to Menu.Group.").
  - Neither element matches `MENU_ITEM_SELECTOR`, so the roving order, Home/End and typeahead are unchanged; items inside a group are found at any depth (0.6).
  - Separate groups with `Menu.Divider`.
- **ARIA.** `role="group"` is an allowed child of `role="menu"`; its items stay owned by the menu. **SSR.** The scan and the ids work on the server. **RTL/forced colors/motion.** Nothing new (text in system colors).
- **Files.** `Menu.group.tsx` (new), its tests.
- **Tests** (`Menu.group.test.tsx`, through `renderInMenuList`): `role="group"` named by the header (`getByRole('group', { name: 'Sort by' })`); the header's own `id` is used; a consumer `aria-label` wins; no `aria-labelledby` without a header (and none dangling); the warning for a header wrapped in a component (asserted); the header outside a group throws in development; arrows, Home/End and typeahead skip headers (the typed first letter of a header's text is not matched); axe with a checkbox group and a radio group in one popover list and in a static list; SSR (`renderToString` of `MenuListHarness` has the `aria-labelledby`, hydration without warnings); `testSystemProps` for both parts (`MenuGroupHeader` inside a group via `wrapper`).
- **Stories** (`Menu.items.stories.tsx`): `Groups` (a View menu with "Show" checkboxes and "Sort by" radios).
- **Docs.** README "Menus": groups; CHANGELOG Added.
- **Compatibility.** Additive.
- **Size.** S.

### P2-03 — `Menu.ItemLink` (P2-menu-items)

- **Closes:** `menu-14` (M).
- **API** (`Menu.link.tsx`; polymorphic, default `'a'`):
  ```ts
  /** The MenuItemLink's own props (the XOwnProps rule: component-specific props only). */
  export interface MenuItemLinkOwnProps {
    /** Icon before the label (decorative); the rules of `Menu.Item.icon`. */
    icon?: Slot<'span'>;
    /** Keyboard shortcut text at the end of the item. */
    shortcut?: string;
    /**
     * Unavailable: `aria-disabled`, skipped by the arrow keys, never activated, and its click is
     * cancelled (`preventDefault()`, which router links respect). On the default `'a'` the `href`
     * is removed too, so it cannot navigate at all; with `as` (a router link) the component's own
     * `to` still renders an `href`, so middle click or "open in new tab" can still follow it:
     * render a disabled router link without its target.
     * @default false
     */
    disabled?: boolean;
    /** Label of the link. */
    children: React.ReactNode;
  }
  /** Props of {@link MenuItemLink} rendered as `C` (default `'a'`, or a router link component). */
  export type MenuItemLinkProps<C extends React.ElementType = 'a'> = PolymorphicProps<
    C,
    MenuItemLinkOwnProps
  >;
  export const MenuItemLink: PolymorphicComponent<'a', MenuItemLinkOwnProps>;
  ```
  JSDoc outline: "A menu item that navigates (`role="menuitem"` on the link element). Enter follows the link the way the browser does (Shift+Enter, Ctrl+Enter and Cmd+Enter open a new window or tab), Space follows it too, and every click follows it and closes a popup menu (focus returns to the trigger first), a Ctrl- or Cmd-click that opens a new tab included; the Menu's `persistOnItemClick` does not keep it open. Middle click and the browser's link context menu keep working and close nothing. `as` takes a router link component, which must forward `ref` and spread its props onto the anchor. Also exported as `MenuItemLink`."
- **Behaviour** (D13). The element (`as ?? 'a'`) gets `role="menuitem"` (before `{...rest}`, so a consumer role wins, as on `Menu.Item`), `data-roving-text` for a string label, `menuItemClasses` plus `text-foreground no-underline` (C-NATIVE), the row (icon, label, shortcut and the column placeholders), and `useMenuItemActivation({ nativeEnter: true, persistOnClick: false, … })`: the click closes the menu without `preventDefault()`, whatever its modifier keys; Enter is not intercepted; Space calls `click()`. Disabled: `aria-disabled="true"`, `data-disabled`, the own click is prevented and does not close the menu; on `'a'` (no `as`) `href` is removed (after `{...rest}`). The roving hook manages its `tabindex` (0.6). In a static menu a click navigates and closes nothing.
- **Keyboard.** Enter: native link activation; Space: activates; the rest as 0.6.
- **SSR/RTL/forced colors.** As `Menu.Item`. Forced colors draw the link's text in the system link color (`LinkText`), which marks it as a link; the focus ring marks the focused item.
- **Files.** `Menu.link.tsx` (new), its tests.
- **Tests** (`Menu.link.test.tsx`, through `renderInMenuList`): `getByRole('menuitem', { name })` is the anchor with its `href`. Navigation is observed without jsdom's "Not implemented: navigation" error: the links use hash hrefs (`#settings`, which jsdom implements) where the case allows, and otherwise a bubble-phase `click` listener on `document` (it runs after React's root listener) records `defaultPrevented` and then calls `preventDefault()` itself; a capture listener would run before React and see nothing. Cases: a click is not default-prevented and calls `closeFromItem` once; a Ctrl-click and a Shift-click also call it and are not prevented; with `persistOnItemClick` on the harness a click still calls it; `userEvent` Enter on the focused link dispatches one click and closes; Enter's keydown is not default-prevented (with and without Shift/Ctrl); Space clicks once and is prevented (no page scroll); an `auxclick` (middle button) neither closes nor is prevented; disabled: no `href`, `aria-disabled`, skipped by ArrowDown, click prevented and `closeFromItem` not called; `as` a test router link component receives `to`, `role` and the handlers, and disabled its click arrives default-prevented (the router's check) with `to` still rendered; a static list; typeahead matches the label; axe; `testSystemProps(MenuItemLink, { expectedTag: 'a', polymorphic: … })`; type tests (`MenuItemLinkProps<typeof RouterLink>` accepts `to`; `@ts-expect-error` for an unknown prop on `'a'`). Focus returning to a real trigger is INTEGRATION's (§4.8 #2).
- **Stories** (`Menu.items.stories.tsx`): `LinkItems` (an account menu with internal links and an external one with an "open in new window" icon).
- **Docs.** README "Menus": links; CLAUDE.md polymorphic list (`'a'` for MenuItemLink); CHANGELOG Added.
- **Compatibility.** Additive.
- **Size.** S.

### P2-04 — Submenus and `Menu.SplitGroup`; Menu surfaces on the presence core (P2-menu-popup)

- **Closes:** `menu-10` (H), `menu-16` (L).
- **API.** Submenus need no new prop: a `<Menu>` nested in a menu list is one (D14).
  ```tsx
  <Menu>
    <Menu.Trigger><MenuButton>File</MenuButton></Menu.Trigger>
    <Menu.Popover>
      <Menu.Item>New</Menu.Item>
      <Menu>
        <Menu.Trigger><Menu.Item>Open recent</Menu.Item></Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>report.docx</Menu.Item>
        </Menu.Popover>
      </Menu>
    </Menu.Popover>
  </Menu>
  ```
  `MenuPopoverProps` JSDoc: `side` "@default 'bottom' ('end' in a submenu)", `align` "@default 'start'", `offset` "@default 4 (0 in a submenu)". `Menu`'s component JSDoc gains a "Submenus" bullet (the composition above, the keys of D14/D15, "works in static menus too").

  `Menu.splitGroup.tsx`:
  ```ts
  /** Properties for the MenuSplitGroup sub-component. */
  export interface MenuSplitGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * A `Menu.Item` (the main action) followed by a submenu `<Menu>` whose `Menu.Trigger` wraps a
     * `Menu.Item` with an `aria-label` and no children, which shows only the submenu chevron:
     * `<Menu><Menu.Trigger><Menu.Item aria-label="More save options" /></Menu.Trigger>
     * <Menu.Popover>…</Menu.Popover></Menu>`.
     */
    children: React.ReactNode;
    /** Ref to the `role="group"` row. */
    ref?: React.Ref<HTMLDivElement>;
  }
  ```
  JSDoc outline: "One row with a main action and a button that opens a submenu (`role="group"` holding two menu items). ArrowDown and ArrowUp visit both halves; ArrowRight (ArrowLeft in RTL) moves from the action to the submenu button, and on the button opens the submenu; ArrowLeft moves back. Also exported as `MenuSplitGroup`."
- **Behaviour.**
  1. **Submenu detection** (`Menu.root.tsx`): a Menu that finds a `MenuListContext` whose `portalDepth` equals its own `PortalDepthContext` value is a submenu (D14); `parent` is that list's menu (so D7's inheritance applies). Under a different depth (a Menu inside a Popover, Dialog or Drawer opened from an item) the Menu is a root menu with no `parent`. The context gains `isSubmenu: boolean`, `closeChain: () => void` and `registerOpenSubmenu(close: () => void): () => void` (added by this package, §4.2).
  2. **Trigger in submenu mode** (`Menu.trigger.tsx`): the child `Menu.Item` receives `id`, `aria-haspopup="menu"`, `aria-expanded` (a boolean), `aria-controls` while open, `ref`, `onClick` and `onKeyDown`, and is wrapped in `MenuSubmenuTriggerContext.Provider value={true}` (so it shows the chevron and never closes its menu, §1.18). A click opens the submenu and focuses its first enabled item (the first item again when already open; a hover-opened submenu is pinned, D18). The key handler takes "next" (`getArrowIntent(key, { orientation: 'horizontal', dir: getDirection(el) })`), Enter and Space: `preventDefault()`, open (pinned), focus the first enabled item. ArrowDown and ArrowUp are not handled (the parent list's roving keeps them). The 0.6 `aria-disabled` rule (Phase 1 D19) applies unchanged to click and keys, and the hover handlers ignore a disabled trigger item too (§1.6 rule 1). When the trigger element after mount has no `role="menuitem"` (the child is not a `Menu.Item`, or `asChild={false}`), a development warning fires from an effect (`Menu.Trigger:submenu-child`: "a submenu's Menu.Trigger must wrap a Menu.Item").
  3. **Submenu surface** (`Menu.popover.tsx`): defaults `side="end"`, `align="start"`, `offset={0}`; `fitViewport` and flip as every Menu.Popover (Phase 1 P1-23). Its key handler adds "previous": `preventDefault()`, close this submenu, focus its trigger item. Escape (the dismiss-layer stack: the submenu is the topmost layer of the focused scope) closes it and `useRestoreFocus` returns focus to the trigger item. It is labelled by the trigger item (0.6 rule).
  4. **Closing a chain** (D15): a submenu surface's `closeFromItem` and its Tab handler call `closeChain()`: under a popup root, focus goes to the root trigger's focus target (`getTriggerFocusTarget`; in context mode the opener resolver of P2-06) when focus is inside the chain or lost, then the root closes; under a static root, focus goes to the static menu's submenu trigger item and the top-level submenu closes. Tab's default then moves on from the focused trigger (0.6).
  5. **Descendants close first; one open submenu per menu** (D15): every menu's internal close (`requestClose`, used by the dismiss layer's `onDismiss`, Tab, `closeFromItem`, `closeChain`, the trigger toggle and the hover close) first calls the `close` its open submenu registered through `registerOpenSubmenu`, which recursively closes that submenu's own open submenu, then sets its own state to `false`: innermost first, each `onOpenChange(false)` once. A submenu registers its `close` with its parent while it is open (a layout effect keyed on `open`); a submenu that opens closes the one registered before it with the same parent. Focus moving to another item of the parent list by keyboard also closes an open submenu (its layer's `focusOutside`, 0.6); by hover focus it starts the hover close instead (D31, P2-05).
  6. **Effective open state:** a submenu's `open` in its context (and so its surface, presence, dismiss layer, restore and trigger ARIA) is its own state `&&` its parent's context `open`. A parent that closes through its controlled prop, or that runs an exit motion, therefore takes the submenu's surface and layer with it in the same commit.
  7. **Layers and portals:** the submenu's surface is rendered in the parent surface's React tree: its dismiss layer is the parent's child (`DismissLayerContext`), and its portal wrapper stacks at the parent's depth + 1 (named portal layers plus nesting depth, 0.6) and registers with the parent layer. In the DOM it is a sibling portal under the same container (no `container` prop is passed; the parent's `inert` does not reach it, which item 6 covers). Its layer refs are its surface and its trigger item; an outside press closes every menu of the chain whose tree does not contain it (presses in the parent close only the submenu).
  8. **Presence adoption (D4):** every `Menu.Popover` (root and submenu) calls `usePresence(open)`, destructured (`const { isMounted, ref: presenceRef, presenceProps } = …`), and renders while `isMounted`, with `presenceProps` (`data-presence`, `inert` while exiting) and the presence ref merged into the surface ref; `data-state` is `"open"` while open and `"closed"` while exiting (D3). `usePopupPosition`, `useDismiss`, `useRestoreFocus`, the initial focus, the roving hook and `registerSurface` (§1.14) keep keying on `open`, so focus returns and the layer unregisters on close, not after an exit motion, and a trigger activated during the exit reopens the menu: presence goes back to `entering` on the same element, `inert` goes, and the initial focus lands on the first item. Without motion classes the surface unmounts in the same `act()` as in 0.6.
  9. **SplitGroup** (`Menu.splitGroup.tsx`, which imports `MenuRoot` from `Menu.root.tsx` for its scan, §1.13): `<div role="group" data-menu-split-group="" class="flex items-stretch">`; its first item takes `flex-1`, its last child's item gets `border-s border-border` (a logical divider line); the group's `onKeyDown` (composed after the items' handlers, consumer first) moves focus with "next" from the first item to the submenu half and with "previous" from the submenu half to the first item (`preventDefault()`), and leaves other keys alone; "next" on the submenu half is handled by its trigger (opens). Activating the main item closes the chain (a normal item). A development warning (`Menu.SplitGroup:children`, from an effect) fires when the static scan does not find a `Menu.Item` followed by a `Menu`. It works the same inside a static menu.
- **Keyboard** (APG menu; "next"/"previous" through `getArrowIntent`):

  | Key | On a submenu trigger item | Inside a submenu |
  |---|---|---|
  | ArrowRight (ArrowLeft in RTL) | opens the submenu and focuses its first enabled item (focuses it when already open) | on a submenu trigger item there, the same; otherwise nothing |
  | ArrowLeft (ArrowRight in RTL) | in a root popup or static menu, nothing | closes this submenu; focus returns to its trigger item |
  | Enter, Space | open and focus the first item | activate the item (checkable items: Space keeps the menu open) |
  | ArrowDown, ArrowUp, Home, End, typeahead | the parent list's navigation (0.6) | this list's navigation |
  | Escape | closes the open submenu, focus stays; else closes the menu (0.6) | closes this submenu only; focus returns to its trigger item |
  | Tab, Shift+Tab | close every open menu; focus goes to the root trigger and the Tab moves on | the same |
- **ARIA.** The trigger item: `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while open; the submenu: `role="menu"` labelled by its item. The split group's submenu half needs `aria-label` (axe `aria-command-name` in the tests).
- **SSR.** Submenus are closed on the server; the trigger item renders `aria-haspopup="menu"` and `aria-expanded="false"` in the server HTML.
- **RTL.** `side="end"` opens to the left; the chevron mirrors (`wave-rtl:-scale-x-100`, §1.18); "next" is ArrowLeft. The split row's divider is `border-s`. **Forced colors.** The chevron is `currentColor`; the trigger item of an open submenu keeps an inset `Highlight` outline under `aria-expanded` (F2-menu-core adds it to `menuItemClasses`, §1.15). **Motion.** None built in (D4); the `ExitMotion` story shows consumer classes with `motion-reduce:`.
- **Guards** (the dismiss-layer stack; named portal layers plus nesting depth): the 0.6 Escape-routing and nested-portal tests of `Menu.test.tsx` stay green unchanged; new tests: Escape inside a second-level submenu closes only it; a submenu's portal wrapper stacks one above its parent's (`z-index` of the wrapper); presses inside a submenu count as inside the root menu.
- **Files.** `Menu.root.tsx`, `Menu.context.ts`, `Menu.trigger.tsx`, `Menu.popover.tsx`, `Menu.splitGroup.tsx` (new), their tests, `stories/Menu.stories.tsx`.
- **Tests.**
  - `Menu.submenu.test.tsx` (new): a MenuButton + Menu inside a Dialog opened from a `Menu.Item` (Dialog is unchanged in wave B; the Popover variant is INTEGRATION §4.8 #13), rendered next to the items and inside the item, stays a root menu: it opens below its button (`data-side="bottom"`), does not open on hover, does not share the outer `checkedValues` (a test-local item reading `useMenuContext('Test').checked`) and item activation in it does not close the outer menu; the trigger item's ARIA before and after opening; ArrowRight opens and focuses the first item (ArrowLeft in RTL, `renderWithProviders(ui, { dir: 'rtl' })`); Enter, Space and click open; a click on an open trigger keeps it open; ArrowLeft and Escape close only the submenu and return focus to its item; ArrowDown on the trigger item moves in the parent list and does not open; three levels deep (open, navigate, close level by level); item activation in level 3 closes all and leaves focus on the root MenuButton; Tab from level 2 closes all and focuses the root trigger; an outside press closes the chain, a press in the parent closes only the submenu; one open submenu per list (opening B closes A); focus moving to a sibling item closes the submenu; a submenu in a static menu (activation closes the submenu and focuses the static menu's trigger item); a nested Menu shares the root's `persistOnItemClick` and delays unless it sets them (D7), also under a static root; checked values through a test-local item: a submenu shares the root's state, `defaultCheckedValues` on it gives it its own, and `onCheckedValuesChange` alone on it keeps sharing and is called after the root's callback with the same arguments; a controlled submenu (`open` + `onOpenChange`) gets `onOpenChange(false)` once, innermost first, when the root closes by Escape, Tab, item activation and an outside press, and reopening the root shows it closed; a controlled root closed by its own prop takes the submenu surface and layer away in the same commit (effective open); `onOpenChange` of a submenu once per change in StrictMode; axe with every level open; SSR of a static menu holding a submenu trigger item (`renderToString` has `aria-haspopup="menu"` and `aria-expanded="false"`, no submenu; hydration without warnings); the submenu-child warning (asserted).
  - `Menu.splitGroup.test.tsx` (new): two `menuitem`s in a `group` row, the half written `<Menu.Item aria-label="More save options" />` (no children; type test that it compiles); the half renders the chevron and no column placeholders; ArrowDown visits both; ArrowRight from the main item focuses the half without opening; ArrowRight on the half opens; ArrowLeft moves back; RTL mirror; activating the main item closes the chain; in a static menu: both halves are in the roving order, "next" on the half opens the submenu, activating the main item closes nothing, activation inside the submenu closes it and focuses the half; the children warning (asserted); axe with the split row's submenu open; `testSystemProps(MenuSplitGroup, …)`.
  - `Menu.test.tsx` and `Menu.presence.test.tsx` (new): the surface carries `data-presence="entered"` and `data-state="open"`; closing without motion removes it in the same `act()` (0.6 timing); with `mockAnimations` and a `data-test-motion` surface: after Escape the surface stays, `data-state="closed"`, `data-presence="exiting"`, `inert`, focus already on the trigger, the layer already gone (a second Escape reaches the enclosing modal harness); a click on the trigger during the exit reopens the menu on the same element (`data-presence="entering"`, no `inert`) and focuses its first item; with an open submenu, the root's exit takes the submenu's layer away at once (no submenu layer registered while the root exits; a second Escape reaches the modal); it unmounts when the animation finishes; reduced motion unmounts at once.
- **Stories** (`stories/Menu.stories.tsx`): `Submenus` (File menu, three levels), `StaticWithSubmenu` (with a split row), `SplitGroup` ("Save" with "Save as…" options), `ExitMotion` (a `Menu.Popover` with `transition-opacity duration-wave-fast data-[presence=exiting]:opacity-0 motion-reduce:transition-none`).
- **Docs.** README "Menus": submenus, split rows, the presence attributes; keyboard table Menu row (§5.2); CLAUDE.md C-POPUPS (nested Menus, one presence per surface); CHANGELOG Added; Changed (DOM: `data-presence`, `data-state="closed"` while exiting; `group/menu` class).
- **Compatibility.** Additive API; DOM additions on every Menu surface (§5.1).
- **Size.** M (the largest item: nesting, chain closing and the presence adoption).

### P2-05 — Hover opening, the safe zone and one delay vocabulary (P2-menu-popup: Menu; P2-popover: Popover, Tooltip)

- **Closes:** `menu-2` (L), `popover-1` (M), `foundation-22` (L), `positioning-8` (L; the safe zone, see §8 Q10), `tooltip-3` (L).
- **API.**
  - `MenuProps` (P2-menu-popup):
    ```ts
    /**
     * Open the popup menu when a mouse pointer rests on its trigger, and close it once the pointer
     * has been off the trigger and the menu for `closeDelay` while focus is not inside the menu. A
     * menu opened by hover does not take focus; a click (or Enter, Space, ArrowDown) on its trigger
     * keeps it open and moves focus into it, as opening it that way does. After Escape or an
     * outside press it does not reopen until the pointer has left the trigger. Touch and pen never
     * open it by hover, and an `aria-disabled` trigger never opens. A triangle between the trigger
     * and the menu keeps it open while the pointer moves diagonally into it. Ignored with
     * `openOnContext` (development warning) and on a static menu (development warning).
     * @default false (true for a submenu)
     */
    openOnHover?: boolean;
    /**
     * Milliseconds a hovering mouse pointer rests on the trigger before the menu opens (mouse
     * hover only). A submenu inherits its parent's, also from a static menu. @default 250
     */
    openDelay?: number;
    /**
     * Milliseconds before a hover-opened menu closes once the mouse pointer has left it and its
     * trigger (mouse hover only). A submenu inherits its parent's, also from a static menu.
     * @default 250
     */
    closeDelay?: number;
    ```
  - `PopoverProps` (P2-popover): `openOnHover?: boolean` (JSDoc as Menu's, adapted: a pinning click keeps focus where it is; ignored with `openOnContext`, development warning; `@default false`), `openDelay?: number` ("mouse hover only", `@default 250`), `closeDelay?: number` ("Fluent's `mouseLeaveDelay`; mouse hover only", `@default 500`).
  - `TooltipProps` (P2-popover):
    ```ts
    /**
     * Milliseconds before the tooltip appears when the pointer rests on the child or the child
     * receives keyboard focus (Fluent's `showDelay`; unlike Menu's and Popover's `openDelay`, it
     * applies to focus too).
     * @default 200
     */
    openDelay?: number;
    /**
     * Milliseconds before it hides once the pointer has left the child and the tooltip (Fluent's
     * `hideDelay`); blur and Escape hide it at once.
     * @default 100
     */
    closeDelay?: number;
    /** @deprecated Use `openDelay`. */
    delay?: number;
    ```
- **Behaviour** (D17, D18).
  - **Menu** (`Menu.root.tsx`, `Menu.trigger.tsx`, `Menu.popover.tsx`):
    - *Where the pieces live.* `MenuRoot` calls `useHoverIntent` (and, for P2-06, `useContextMenuAnchor`) and puts `triggerHandlers` and `surfaceHandlers` into the Menu context (members added by this package); `Menu.Trigger` composes the trigger handlers and `Menu.Popover` the surface handlers, after the consumer's. `Menu.Popover` reports its surface element and dismiss `layerId` to the root through `registerSurface` (the `MenuSurfaceApi` gains `surface` and `layerId`, registered only while open, §1.14); the root holds them in state for the hooks. Popover needs no plumbing: its root already owns the trigger, the surface and `useDismiss`.
    - *Scope.* `openOnHover` applies to popup menus with a trigger. With `openOnContext` it is ignored with a one-time warning (`Menu:hover-and-context`). On a static root `openOnHover` and `openOnContext` are ignored with one warning (`Menu:static-popup-props`); `openDelay` and `closeDelay` are accepted there and inherited by its submenus (D7, D17).
    - *Open reason.* A submenu passes its parent list's `HoverIntentGroup` (the list context gains `hoverGroup`, created per list with `createHoverIntentGroup()`). `onOpen` opens with `InitialFocus` `'none'` (added to the union, §4.2) and records the open reason `hover`; every other open (click, keys, context, a controlled `open` from outside) records `other`.
    - *Pinning (D18).* A click, Enter, Space or ArrowDown (ArrowUp) on the root trigger of a hover-opened menu does what it does on a closed menu: the reason becomes `other` and focus goes to the first (last) enabled item, instead of the 0.6 toggle closed. On a submenu trigger item, a click, "next", Enter or Space pins its hover-opened submenu and focuses its first item.
    - *Closing.* `canClose()` is `reason === 'hover'` and focus not inside the menu's layer tree (focus on the trigger does not count). `onClose` calls the menu's `requestClose` (P2-04 rule 5; focus is not inside, so nothing is restored). A close for any other reason suppresses hover reopening until the pointer leaves the trigger (§1.6 rule 6). Opening a submenu by hover closes the open sibling submenu (P2-04 rule 5).
    - *Focus follows the mouse (D31).* The list element (`Menu.Popover`'s surface and the static root) handles `pointermove` (mouse only, own events): when focus is inside the menu tree (the root menu's layer tree, or the static root's element and its submenus' layers), the item under the pointer (`closest(MENU_ITEM_SELECTOR)` whose nearest list is this one) is enabled and not focused, and `hoverGroup.isHeld(x, y)` is false, it calls `item.focus({ preventScroll: true })`, setting the list context's `isHoverFocusing()` flag (a ref, added by this package) for the duration of that call. A submenu's `onDismiss('focus-outside')` that arrives while its parent list's flag is set does not close: it sets the reason to `hover` (unpinned) and calls `startClose(event)` of its hover intent (§1.6), so it closes after `closeDelay` unless the pointer returns to it or its trigger item. Keyboard focus moves still close at once (0.6).
    - Keyboard behaviour is otherwise unchanged: ArrowRight on a trigger item whose submenu is open by hover moves focus into it and pins it.
  - **Popover** (`Popover.tsx`): the same with the Popover trigger and content, all in `PopoverRoot`: hover opens without moving focus (0.6 keeps focus on the trigger anyway); a click on the trigger of a hover-opened popover keeps it open, pins it and keeps focus where it is (a second click closes it, as in 0.6); `canClose()` is `reason === 'hover'` and focus not inside the content's layer tree; the suppression after a dismissal as Menu; with `openOnContext` hover is ignored (`Popover:hover-and-context`); the content's 0.6 tab order and naming are unchanged.
  - **Tooltip** (`Tooltip.tsx`): `openDelay = resolveDeprecatedProp('Tooltip', openDelay, delay, 'delay', 'openDelay') ?? 200` replaces `delay`; `closeDelay` (default 100) replaces the hard-coded `HIDE_DELAY_MS`. No safe zone (its hover bridge stays), no pointer-type filter (0.6), and no other change.
- **Keyboard.** Unchanged, except on a surface that hover opened: the trigger's opening keys pin it and move focus into a menu instead of closing it (D18).
- **SSR.** Nothing opens on the server. **RTL.** The safe zone's facing-edge rule handles a surface on either side (§1.6). **Forced colors/motion.** Nothing new.
- **Guards** (Popover keeps the trigger's Tab order and names itself): the 0.6 Popover tab-order and naming tests stay green unchanged; new: a hover-opened popover is entered by Tab from its trigger and named by it.
- **Files.** Menu: as P2-04. Popover: `Popover.tsx`, `Tooltip.tsx`, their tests, `stories/{Popover,Tooltip}.stories.tsx`.
- **Tests.**
  - `Menu.hover.test.tsx` (new, fake timers with `shouldAdvanceTime` and `userEvent.setup({ advanceTimers })`): a submenu opens 250 ms after hovering its item, without moving focus, and closes 250 ms after the pointer leaves the item and the submenu; moving diagonally from the trigger item across a sibling submenu trigger into the submenu (`mockRect`, `user.pointer` coords inside the triangle) keeps it open and does not open the sibling; `openOnHover={false}` on a nested Menu; a root menu with `openOnHover` opens on hover, a click then pins it and focuses its first item (pointer leave no longer closes), Enter and ArrowDown on the trigger of a hover-opened menu do the same and ArrowUp focuses the last item, and focus inside prevents the hover close; the sticky-trigger case: open by click, close with Escape (focus back on the trigger), leave, hover to open and leave: it closes after `closeDelay`; hover-open, Escape, move within the trigger past `openDelay`: it stays closed, leave and re-enter: it opens; a disabled submenu trigger item (and a `disabledFocusable` MenuButton as root trigger) does not open on hover; touch and pen hover do nothing; focus follows the mouse: with focus in the root list, hovering a submenu's item focuses it and Enter activates that item, hovering items of a hover-opened root menu that focus is not in moves no focus, a static menu the user is not in takes no focus, a diagonal path across a sibling item inside the safe zone moves no focus and keeps the submenu open, hovering a sibling item outside the zone focuses it and the submenu closes after `closeDelay` (not at once), while ArrowDown to the sibling closes it at once; `openOnHover` with `openOnContext` warns and hover does nothing; `openDelay`/`closeDelay` props and their inheritance, from a static root too (a static Menu with `closeDelay={500}` makes its hover submenu close after 500 ms); the static-menu warning for `openOnHover` and `openOnContext` only (asserted); StrictMode `onOpenChange` once; axe with a hover-opened submenu.
  - `Popover.test.tsx`: hover opens after 250 ms and closes 500 ms after leaving trigger and content; moving into the content keeps it open (safe zone across the 8 px gap); click pins and keeps focus on the trigger; focus inside prevents the close, and leaving focus and pointer closes; focus on the trigger does not keep an unpinned hover card open (open by click, Escape, then hover and leave: it closes); Escape then a small move within the trigger does not reopen it; touch ignored; `openOnHover` with `openOnContext` warns and hover does nothing; `onOpenChange` once per change; the 0.6 click toggle is unchanged without `openOnHover`.
  - `Tooltip.test.tsx`: the 0.6 `delay` cases rewritten with `openDelay` (§6.4); one test keeps `delay={300}` and asserts the deprecation warning and the 300 ms timing; `openDelay` wins over `delay`; `closeDelay` controls the hide after leave; blur and Escape still hide at once.
- **Stories.** `stories/Menu.stories.tsx`: `HoverMenu` (a root menu with `openOnHover`); the `Submenus` story shows hover by default. `stories/Popover.stories.tsx`: `HoverCard` (a profile card). `stories/Tooltip.stories.tsx`: `Delays`.
- **Docs.** README "Menus" (hover, focus following the mouse, pinning), "Popover" notes (hover card), Tooltip (`openDelay`/`closeDelay`, `delay` deprecated, focus delay); CLAUDE.md C-NAMING (the delay vocabulary and its hover-only versus hover-or-focus meaning); CHANGELOG Added, Changed (behaviour of every 0.6 popup menu: an item under the mouse takes focus while focus is inside the menu, D31), Deprecated (Tooltip `delay`).
- **Compatibility.** Additive API; Tooltip `delay` keeps working with a one-time development warning. One behaviour change for 0.6 popup menus: focus follows the mouse over items while focus is inside the menu (D31); keyboard use is unchanged.
- **Size.** M.

### P2-06 — Context menus and custom anchors (P2-menu-popup: Menu; P2-popover: Popover)

- **Closes:** `menu-1` (M), `foundation-18` (M), `popover-2` (L), `popover-3` (L), `positioning-2` (L).
- **API.**
  - `MenuProps` (P2-menu-popup):
    ```ts
    /**
     * Make `Menu.Trigger` a context-menu region: a right click (a Ctrl+click on macOS, a long press
     * where the browser reports one) opens the menu at the pointer, and Shift+F10 or the
     * ContextMenu key opens it at the focused element inside the region, instead of a click.
     * Focus returns to the element that had it. The browser's context menu is suppressed there
     * and inside the menu, except in text fields inside the region, which keep it. A press
     * elsewhere, a right click outside or a scroll that moves the region closes it. The trigger
     * gets no `aria-haspopup`/`aria-expanded` (it is not a menu button; with a render-prop child,
     * do not spread them): name the menu with `aria-label` on `Menu.Popover`, and consider
     * `aria-keyshortcuts="Shift+F10"` on the region. iOS Safari reports no long press. Ignored on
     * a submenu; `openOnHover` is ignored with it.
     * @default false
     */
    openOnContext?: boolean;
    ```
  - `MenuPopoverProps` (P2-menu-popup):
    ```ts
    /**
     * Where to place the menu instead of next to `Menu.Trigger`: an element or a `VirtualElement`
     * (a rectangle, such as a point; an inline object is fine). With a controlled `open`, a menu
     * with a `target` needs no trigger; name it with `aria-label`, and give a toggle button you use
     * as the target `aria-haspopup="menu"`, `aria-expanded` and `aria-controls` yourself. A press
     * on a target element does not close the menu. Hold the element in state (a ref cannot be
     * observed; TeachingPopover's `target` also takes a ref). A menu opened by `openOnContext` is
     * placed at the gesture instead.
     */
    target?: PopupTarget;
    ```
  - `PopoverProps` (P2-popover): `openOnContext?: boolean` (as Menu's, for the Popover trigger; a keyboard gesture moves focus into the content, a pointer gesture leaves it; `@default false`) and `target?: PopupTarget` (as `Menu.Popover`'s; on the root, next to `side` and `align`, D20).
- **Behaviour** (D19, D20, D29).
  - **Context mode** (Menu and Popover): the root calls `useContextMenuAnchor` (Menu: `MenuRoot`, with the surface's `layerId` reported through `registerSurface`, P2-05; Popover: `PopoverRoot`); the trigger composes its trigger handlers and calls `useTriggerElement` with `omitStateAria: true` (§1.7). A cloned child and a wrapper span receive the forwarded props plus, of the trigger's own props, only `id`, `ref`, `onContextMenu` and `onKeyDown` (no state ARIA, no click toggle); a render-prop child receives every member (`aria-expanded` constantly `false`, no `aria-controls`, an `onClick` that does nothing), and the state ARIA it spreads is removed after each commit with a warning (D29). `onOpen`: Menu opens with focus on the first enabled item (reason `other`); Popover moves focus into its content for a keyboard gesture (its first tabbable element, else the surface, which then has `tabIndex={-1}`) and leaves it for a pointer gesture. The surface composes the surface handler. `onClose` closes through the menu's `requestClose` (P2-04 rule 5).
  - **Anchor:** the positioning reference is, in this order, the context anchor while `fromContext` (the pointer point, or the keyboard anchor element: the focused row, else the trigger's focus target, else the trigger), else `target`, else the trigger element. Both components set it with `setReference` in a layout effect keyed on `[anchor, fromContext, target, triggerElement]` (the §1.5 proxy makes a new `VirtualElement` cheap). P2-popover removes `setReference` from Popover's merged trigger ref (0.6 set the reference there) for this.
  - **Naming:** in context mode, and for a surface with a `target` and no trigger, `Menu.Popover` and `Popover.Content` are not labelled by the trigger; a development warning from an effect fires when such a surface has no `aria-label`, `aria-labelledby` (or, for Popover, `title`): `Menu.Popover:name` (new) and Popover's 0.6 `Popover.Content:name`.
  - **Dismissal:** in context mode the trigger is not in the layer's refs (the layer is the surface, plus a `target` element): a primary press elsewhere in the region closes the surface like any outside press, and the `outsidePress` predicate ignores a Ctrl+press inside the trigger (a macOS context click, whose `contextmenu` moves the surface). A `target` element joins the layer's refs in every mode. The layer's `anchorRef` is the focus resolver below.
  - **Focus resolver** (one function, used for the restore, `closeFromItem`, Tab, `closeChain` and the dismiss layer's anchor): in context mode the opener recorded at the gesture (`useContextMenuAnchor().opener`) when it is connected and focusable, else the trigger's focus target (`getTriggerFocusTarget`), else a focusable `target` element; otherwise the 0.6 trigger focus target, else a focusable `target` element.
  - **Focus return:** in context mode `useRestoreFocus` gets `finalFocusRef: opener` and `fallback: resolver` and no `triggerRef` (so its captured opener is the focused element, not the region); otherwise as 0.6, with a focusable `target` element as `fallback` when there is no trigger. Item activation and Tab focus the resolver's element before closing (the 0.6 focus-before-close rule).
  - **Popover tab order:** the anchor element of `usePopoverTabOrder` is the context opener (context mode, when it lies inside the trigger), else the trigger, else the `target` element; Tab from that element enters open content, and the trigger's Tab handler acts only when the key comes from it (Tab on any other row of a region moves on as usual). With a `VirtualElement` target and no trigger the content keeps its place in the portal order.
- **Keyboard.** Shift+F10 and the ContextMenu key on the trigger open; inside the menu, 0.6 keys (and P2-04's); Escape, Tab and item activation close and return focus to the opener as above.
- **ARIA.** No state ARIA on a context trigger; the surface is named by `aria-label`.
- **SSR.** Nothing opens on the server; a context trigger renders no state ARIA. **RTL.** The pointer point is physical; `side`/`align` resolve against it as against an element. **Forced colors/motion.** Nothing new.
- **Guards** (the documented focus-return chain): the 0.6 focus-return tests of Menu and Popover stay green; new: Escape, Tab and item activation in a context menu opened from a focused row (row 5 of a list) return focus to that row, not to the region's first row; a controlled menu with a `target` and no trigger returns focus to the element focused before it opened.
- **Files.** Menu: as P2-04. Popover: `Popover.tsx` (and `Popover.shared.tsx` only if the tab-order anchor needs it), tests, stories.
- **Tests.**
  - `Menu.contextMenu.test.tsx` (new): a right click on a region opens the menu with focus on the first item, prevents the default and positions it at the point (`data-side`/style with mocked rects); a Ctrl+click (`button: 0, ctrlKey: true`, coordinates) does the same; a second right click moves it; Shift+F10 and the ContextMenu key on row 5 open it against row 5's rect, and the `contextmenu` that follows the key press keeps it there; a click does not open it; a right click or Shift+F10 in a text input inside the region opens nothing and is not prevented; no `aria-haspopup`/`aria-expanded` on the region, for a cloned child, a wrapper span and a render-prop `<div>` that spreads every member (removed, warning asserted; axe clean); a Tooltip wrapping the region still describes it (`aria-describedby` forwarded); a primary press on another row closes it; a right click outside closes it and is not prevented; a scroll outside that moves the region closes it, one that does not and one inside (a long menu) do not; with `mockAnimations`, the exiting surface keeps its position at the point; `contextmenu` inside the menu is prevented; Escape, Tab and item activation return focus to the row the gesture came from (row 5), a Dialog opened from an item returns focus to that row when it closes, and with no focused row focus goes to the region's first tabbable element; the name warning (asserted) and none with `aria-label`; `openOnContext` on a submenu is ignored; a submenu inside a context menu works (Escape closes only it); a controlled menu with an element `target` and no trigger opens next to the target, a press on the target does not close it, Escape returns focus to the opener; a `VirtualElement` target, written inline in a component that re-renders (bounded renders); switching `target` repositions; axe with the menu open.
  - `Popover.test.tsx`: the same cases for Popover, with its focus rules: a pointer gesture leaves focus on the row, and Tab from that row enters the content, Shift+Tab from the content's first element returns to the row; a keyboard gesture (Shift+F10 on row 2) moves focus into the content, and Escape returns it to row 2; Tab on another row of the region moves on as usual; `title` names the content; the target anchors the tab order (Tab from the target enters the content); switching `target` repositions the content.
- **Stories.** `stories/Menu.stories.tsx`: `ContextMenu` (a file list whose rows open a context menu of plain items, the region with `aria-keyshortcuts="Shift+F10"`; INTEGRATION adds checkable items when it merges the stories), `CustomTarget` (a controlled menu anchored to a toggle button outside the Menu that carries its own menu-button ARIA). `stories/Popover.stories.tsx`: `ContextPopover`, `AnchoredToTarget`.
- **Docs.** README "Menus" (context menus: naming, `aria-keyshortcuts`, text fields keep the native menu, iOS long press; `target`: the toggle's own ARIA), Popover notes; keyboard table (Shift+F10); CLAUDE.md C-POPUPS (`target`, `PopupTarget`, `VirtualElement`, the context opener); CHANGELOG Added, and a note that `target` on Menu and Popover takes no ref in 0.7 while TeachingPopover's does.
- **Compatibility.** Additive. `MenuTriggerProps` gains optional members; `PopoverTriggerChildProps` is unchanged (D29).
- **Size.** M.

### P2-07 — Toolbar `checkedValues`, radio groups, groups, dividers, size and buttons (P2-buttons, after P2-08)

- **Closes:** `buttons-19` (M), `buttons-26` (M), `buttons-25` (L), `buttons-27` (L), `buttons-28` (L), `buttons-20` (L), `buttons-24` (L).
- **API.** `ToolbarOwnProps` (`Toolbar.tsx`):
  ```ts
  export interface ToolbarOwnProps {
    /** 0.6, unchanged. @default 'horizontal' */
    orientation?: Orientation;
    /**
     * Default size of `Toolbar.Button`, `Toolbar.ToggleButton` and `Toolbar.RadioButton` (their
     * own `size` wins), and the toolbar's padding. Plain Buttons inside keep their own default.
     * @default 'medium'
     */
    size?: Size;
    /**
     * Pressed `Toolbar.ToggleButton`s and checked `Toolbar.RadioButton`s, per group `name`
     * (controlled): `{ format: ['bold'], align: ['center'] }`.
     */
    checkedValues?: CheckedValues;
    /** Initial checked values for uncontrolled usage. @default {} */
    defaultCheckedValues?: CheckedValues;
    /**
     * Called when a toggle or radio changes them (only on change): the new checked values first,
     * then `details` with the group's `name`, its `checkedItems` and the `event` (Fluent's
     * `onCheckedValueChange(event, { name, checkedItems })`; always passed, typed optional until 1.0).
     */
    onCheckedValuesChange?: CheckedValuesChangeHandler;
  }
  ```
  Parts (`Toolbar.parts.tsx`), with the compound and flat names in `Toolbar.tsx`:
  ```ts
  /** Toolbar.Button's own props: Button's, plus `vertical`. Default appearance `'subtle'`. */
  export interface ToolbarButtonOwnProps extends ButtonOwnProps {
    /** The icon above the label (a 24 px icon box and a caption-size label). @default false */
    vertical?: boolean;
  }
  export type ToolbarButtonProps<C extends React.ElementType = 'button'> = PolymorphicProps<
    C,
    ToolbarButtonOwnProps
  >;
  export const ToolbarButton: PolymorphicComponent<'button', ToolbarButtonOwnProps>;

  /** Properties for Toolbar.ToggleButton: ToggleButton's, bound to the Toolbar's `checkedValues`. */
  export interface ToolbarToggleButtonProps
    extends Omit<ToggleButtonProps, 'pressed' | 'defaultPressed' | 'onPressedChange' | 'name' | 'value'> {
    /** The group: a key of the Toolbar's `checkedValues`. */
    name: string;
    /** The value in `checkedValues[name]` while the toggle is pressed. */
    value: string;
  }

  /** Properties for Toolbar.RadioButton: one choice of a `Toolbar.RadioGroup`. */
  export interface ToolbarRadioButtonProps
    extends Omit<ToggleButtonProps, 'pressed' | 'defaultPressed' | 'onPressedChange' | 'name' | 'value' | 'role'> {
    /** The group: a key of the Toolbar's `checkedValues`; radio buttons of one `name` are exclusive. */
    name: string;
    /** The group's value while this radio is checked. */
    value: string;
  }

  export interface ToolbarRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    ref?: React.Ref<HTMLDivElement>;
  }
  export interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    ref?: React.Ref<HTMLDivElement>;
  }
  export interface ToolbarDividerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
    ref?: React.Ref<HTMLDivElement>;
  }
  ```
  `export const Toolbar = /* @__PURE__ */ Object.assign(ToolbarRoot, { Button, ToggleButton, RadioGroup, RadioButton, Group, Divider })` (typed `PolymorphicComponent<'div', ToolbarOwnProps> & {…}`, as Card), and the flat names `ToolbarButton`, `ToolbarToggleButton`, `ToolbarRadioGroup`, `ToolbarRadioButton`, `ToolbarGroup`, `ToolbarDivider`. JSDoc outlines: `Toolbar.RadioGroup`: "A set of `Toolbar.RadioButton`s of which one is checked (`role="radiogroup"`; name it with `aria-label`). Its radios are part of the toolbar's arrow-key order; Up and Down (Left and Right in a vertical toolbar) also move among the group's radios, wrapping inside the group. Arrows only move focus; Space, Enter or a click checks." `Toolbar.Group`: "Lays out related controls in the toolbar's direction. It is `role="presentation"`, or `role="group"` when you name it with `aria-label` or `aria-labelledby` (a `role` you pass wins)." `Toolbar.Divider`: "A separator between groups, drawn across the toolbar (vertical in a horizontal toolbar)." `Toolbar.Button`/`ToggleButton`/`RadioButton`: "A Button (ToggleButton) with the toolbar's size and the `subtle` appearance by default."
- **Behaviour** (D22–D24).
  - **Root:** `useCheckedValues(checkedValues, defaultCheckedValues, onCheckedValuesChange)`; a Toolbar context `{ orientation, size, checked, registerCheckable }` (default `null`, memoized; `registerCheckable` as the Menu list's, §1.14, warning `Toolbar:duplicate-value` for a second part with the same `name`/`value`; C-CONTEXT: parts outside a Toolbar throw in development and use an inert horizontal, medium, empty value in production); `data-size` and `data-orientation` always rendered (Phase 1 D22); padding per size: `extra-small` and `small` `p-0.5`, `medium` `p-1` (0.6), `large` `p-1.5`, `extra-large` `p-2`. The 0.6 roving setup (item selector, `last-focused` tab stop, orientation) is unchanged.
  - **`Toolbar.Button`:** Button with `appearance` default `'subtle'` and `size` default the toolbar's (consumer values win); `vertical` adds `data-vertical=""` and `h-auto min-w-0 flex-col gap-0.5 px-2 py-1 text-caption-1` with a 24 px icon box (20 px at `small` and `extra-small`); polymorphic like Button.
  - **`Toolbar.ToggleButton`:** ToggleButton with the same defaults, `pressed = checked.isChecked(name, value)`, and the change made from its click: the consumer's `onClick` runs first (`preventDefault()` cancels), then `checked.toggle(name, value, event.nativeEvent)`. `name` and `value` are binding keys and not rendered as attributes. `isAccessible` and `disabledFocusable` pass through. It renders `aria-pressed` and `data-pressed` (and `data-checked` only when given one of D25's checked roles).
  - **`Toolbar.RadioButton`:** ToggleButton with `role="radio"` (so it renders `aria-checked` and `data-checked`, P2-08, besides `data-pressed`), the same defaults, checked when `checked.isChecked(name, value)`; its click calls `checked.select(name, value, event.nativeEvent)`; a click on the checked radio changes nothing and calls nothing. The toggle look is ToggleButton's pressed look. Both parts register their `name`/`value` with the Toolbar from an effect.
  - **`Toolbar.RadioGroup`:** `<div role="radiogroup" data-roving-transparent="" class="flex gap-1">` in the toolbar's direction (`flex-col` when vertical); its `onKeyDown` (after the consumer's, C-COMPOSE) handles the cross axis (D23): `ArrowDown`/`ArrowUp` in a horizontal toolbar, and in a vertical one the "next"/"previous" intents of `getArrowIntent(key, { orientation: 'horizontal', dir: getDirection(el) })`, move focus to the next or previous enabled radio of the group with wrap (`preventDefault()`, no check); the toolbar's roving hook records the new focus as the tab stop through its `onFocus`. A development warning (`Toolbar.RadioGroup:name`, from an effect) fires when it has neither `aria-label` nor `aria-labelledby`.
  - **`Toolbar.Group`:** `<div data-orientation class="flex gap-1">` in the toolbar's direction; `role` defaults to `"group"` when `aria-label` or `aria-labelledby` is given, else `"presentation"`, before `{...rest}` (C-COMPOSE), so a consumer `role` wins (a named presentational element would be a presentational-role conflict).
  - **`Toolbar.Divider`:** its own `<div role="separator" aria-orientation>` (it does not render `Divider`, which has a fixed height): in a horizontal toolbar `aria-orientation="vertical"` and `mx-1 w-0 shrink-0 self-stretch border-s border-border`; in a vertical toolbar `"horizontal"` and `my-1 h-0 shrink-0 self-stretch border-t border-border`; `forcedColors.border`. It is not focusable, so the roving order skips it.
- **Keyboard** (APG Toolbar): one tab stop (the last focused control); Left/Right (Up/Down when vertical; mirrored in RTL) move through buttons, toggles and radios alike, Home/End to the ends; inside a radio group the cross-axis arrows move among its radios, wrapping (D23); Space and Enter press a toggle or check a radio; arrows never check a radio; fields keep their own arrow keys (0.6).
- **ARIA.** `role="toolbar"` and `aria-orientation` (0.6); toggles `aria-pressed`; radios `role="radio"` with `aria-checked` inside `role="radiogroup"`; the divider `role="separator"` with `aria-orientation`.
- **SSR.** Pressed and checked states from `checkedValues`/`defaultCheckedValues` are in the server HTML.
- **RTL.** Arrows mirror (0.6); the divider is `border-s`. **Forced colors.** Pressed toggles and checked radios keep ToggleButton's pressed recipe (a `Highlight` outline); the divider `CanvasText`. **Motion.** The buttons' 0.6 color transitions.
- **Guards** (Toolbar works over any focusable descendant): the 0.6 `Toolbar.test.tsx` cases with arbitrary descendants stay green (their exact attribute snapshots gain `data-size`/`data-orientation`, §6.4); a new test puts an Input, a Combobox and a `Toolbar.RadioGroup` in one toolbar: arrows reach all of them, the Input keeps Left/Right for its caret, and the tab stop stays single.
- **Files.** `Toolbar.tsx`, `Toolbar.parts.tsx` (new), `Toolbar.context.ts` (new), their tests, `stories/Toolbar.stories.tsx`.
- **Tests** (`Toolbar.test.tsx` additions, `Toolbar.parts.test.tsx` new): `checkedValues` uncontrolled and controlled, the callback's arguments, StrictMode once; toggles add and remove; radios exclusive per `name`, a click on the checked radio calls nothing; arrows move through toggles and radios without checking; Down/Up in a horizontal toolbar move among a group's enabled radios with wrap and skip a disabled one, without checking, and Right/Left (mirrored in RTL) do so in a vertical toolbar; Space and Enter check; `data-checked` and `data-pressed` on a checked radio, `data-pressed` only on a pressed toggle; the duplicate `name`/`value` warning (asserted); one tab stop (Tab out and back returns to the last focused control, also after a cross-axis move); RTL and vertical orientation; `size` sets `data-size`, the padding and the parts' size classes (equal to Button's size classes for that size), a part's own `size` wins, a plain Button keeps `medium`; `Toolbar.Button` `vertical` (`data-vertical`, classes) and `as="a"`; the group's `role`: `presentation` by default, `group` with `aria-label` (axe clean) and with `aria-labelledby`, a consumer `role` wins; the divider's `aria-orientation` per toolbar orientation and that it is not in the arrow order; the unnamed radio group warning (asserted); parts outside a Toolbar throw in development; SSR (`renderToString` with `defaultCheckedValues` has `aria-pressed="true"` and `aria-checked="true"`, hydration without warnings); axe for a text-editor toolbar; `testSystemProps` for each part and `testCompoundExposure(Toolbar, ['Button', 'ToggleButton', 'RadioGroup', 'RadioButton', 'Group', 'Divider'])` with the flat-name identity (`ToolbarButton === Toolbar.Button`); type tests (`ToolbarToggleButtonProps` requires `name` and `value`, `@ts-expect-error` for `pressed` and for `role` on `ToolbarRadioButtonProps`; `ToolbarButtonProps<'a'>['href']`).
- **Stories** (`stories/Toolbar.stories.tsx`): `TextEditor` (bold/italic/underline toggles, an alignment radio group, dividers, a trailing group with a Button), `Sizes`, `VerticalButtons`, `ControlledCheckedValues`.
- **Docs.** README "Buttons and actions" row for Toolbar (parts), a "Toolbars" usage note; keyboard table Toolbar row (§5.2); CLAUDE.md polymorphic list (`'button'` for Toolbar.Button); CHANGELOG Added; Changed (DOM: `data-size`, `data-orientation`; Types: Toolbar is a compound).
- **Compatibility.** Additive API; the root always renders two new attributes; `typeof Toolbar` gains static members.
- **Size.** M.

### P2-08 — ToggleButton `isAccessible` and role-aware checked state (P2-buttons, first)

- **Closes:** `buttons-8` (M), `buttons-10` (L).
- **API** (`ToggleButtonProps`):
  ```ts
  /**
   * Draws the pressed state as a brand fill with on-brand text (on `primary`, the pressed fill with
   * an inset on-brand stroke), so the state never depends on a light tint (Fluent's
   * `isAccessible`). Recommended for icon-only toggles in toolbars. Forced colors are unchanged.
   * @default false
   */
  isAccessible?: boolean;
  ```
  Component JSDoc gains: "It reports its state with `aria-pressed` without a `role` or with `role="button"`. With `role` `checkbox`, `radio`, `switch`, `menuitemcheckbox`, `menuitemradio`, `option` or `treeitem` it reports it with `aria-checked` (and `data-checked` while pressed) instead; with any other role it renders neither (development warning), because `aria-pressed` is allowed only on buttons. `data-pressed` is present while pressed in every case."
- **Behaviour** (D25).
  - `buttonStyles.ts`: `buttonPressedAccessibleClasses: Record<Appearance, string>`, layered after the appearance classes like `buttonPressedClasses` (C-TOKENS; the gated hover and pressed prefixes):
    - `primary`: `bg-primary-pressed text-primary-foreground inset-ring-2 inset-ring-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-pressed`;
    - `outline`: `border-primary bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:border-primary-hover not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed`;
    - `subtle` and `transparent`: `bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed`.
    `ButtonClassNameOptions` gains `accessible?: boolean` (with `pressed`); the forced-colors layers (`buttonPressedForcedColors`, the disabled variant) are the same with or without it.
  - `ToggleButton.tsx`: `getPressedLayer(appearance, disabled, accessible)` (cache key extended). The role (the first token of `props.role`) decides the state attributes, all rendered after `{...props}` as in 0.6: no role or `button` → `aria-pressed={isPressed}` (0.6); one of the seven checked roles → `aria-checked={isPressed}`, `aria-pressed={undefined}` (a consumer `aria-pressed` is dropped) and `data-checked={isPressed ? '' : undefined}`; any other role → `aria-pressed={undefined}`, no `aria-checked` from the component, and `warnOnce('ToggleButton:role-state', …)` from an effect. `data-pressed=""` while pressed in every case. `onPressedChange` is unchanged.
  - Contrast: the pairs are asserted since 0.5/0.6 (`primary-foreground` on `primary`, `primary-hover`, `primary-pressed`; `primary` on `background` and `card`); `F2-foundation` adds a comment block in `tokens.test.ts` naming them as the `isAccessible` pairs (§3), no new pair.
- **Keyboard/focus.** Unchanged. **SSR.** Attributes in the server HTML. **RTL.** None. **Forced colors.** The 0.6 pressed recipe. **Motion.** 0.6 transitions.
- **Guards** (`ToggleButton.onPressedChange`): a test fires `onPressedChange` once per click in StrictMode with `role="checkbox"` and without, with identical arguments; the 0.6 ToggleButton tests stay green.
- **Files.** `ToggleButton.tsx`, `buttonStyles.ts`, their tests (`ToggleButton.test.tsx`, `buttonStyles.test.ts`), `stories/ToggleButton.stories.tsx`.
- **Tests:** `isAccessible` pressed classes per appearance (class assertions of the token utilities, no hex), unpressed unchanged, disabled pressed keeps the disabled look and the GrayText forced-colors outline; `buttonClassName({ pressed: true, accessible: true })`; `aria-checked`, `data-checked` and no `aria-pressed` for each of the seven checked roles, a consumer `aria-pressed` on `role="checkbox"` dropped; `aria-pressed` for `button` and no role; neither for `role="tab"` and `role="link"`, with the asserted `ToggleButton:role-state` warning; `data-pressed`; axe with `role="checkbox"`, `role="switch"` and `role="tab"`; the forced-colors classes identical with and without `isAccessible`; type test `ToggleButtonProps['isAccessible']`.
- **Stories:** `ToggleButton.stories.tsx`: `Accessible` (each appearance, pressed and not), `AsCheckbox` (`role="checkbox"`).
- **Docs.** README "Buttons": `isAccessible`, the role rule; CHANGELOG Added; Changed (behaviour: `aria-checked` for the checked roles, no state attribute for other roles; DOM: `data-pressed`, `data-checked`).
- **Compatibility.** Additive prop; a behaviour fix for toggles with a role (they rendered a prohibited `aria-pressed`); `data-pressed` and `data-checked` are new.
- **Size.** S.

---

## 3. Packages and file ownership

Disjoint within each wave. Tests and stories of a module belong to its package. INTEGRATION owns every file while it runs (wave C), DOCS the documentation files (wave D). Paths without a folder are in `src/components/navigation/` (Menu), `src/components/overlays/` (Popover, Tooltip) and `src/components/button/` (ToggleButton, Toolbar); `__tests__/` is the folder next to them.

| Package | Files (edit) | New files | Items |
|---|---|---|---|
| `F2-foundation` (wave A1) | `src/lib/types.ts`, `src/lib/cn.ts`, `src/styles/tokens.css`, `src/hooks/usePopupPosition.ts`, `src/hooks/useRovingTabIndex.ts`, `src/hooks/useTriggerElement.tsx` (`omitStateAria`, §1.7), `src/test-utils.ts`, `src/index.ts` (presence exports only, D26), `src/__tests__/public-types.test.ts` (presence lines only), `src/__tests__/test-utils.test.tsx` (`mockAnimations` cases), `src/lib/__tests__/types.test.ts`, `src/lib/__tests__/cn.test.ts`, `src/hooks/__tests__/usePopupPosition.test.tsx`, `src/hooks/__tests__/useRovingTabIndex.test.tsx`, `src/hooks/__tests__/useTriggerElement.test.tsx`, `src/styles/__tests__/tokens.test.ts` (motion tokens; the comment naming the `isAccessible` pairs, P2-08), `scripts/verify-dist.mjs` (probes, budget, `PENDING_FLAT_EXPORTS = ['Toolbar']`), `scripts/pack-smoke.mjs`, `scripts/fixtures/tailwind/src/app.html`, `scripts/__tests__/verify-dist.test.mjs`, `scripts/__tests__/build-css.test.mjs`, `scripts/__tests__/pack-smoke.test.mjs` | `src/lib/events.ts`, `src/lib/__tests__/events.test.ts`, `src/hooks/useCheckedValues.ts`, `src/hooks/usePresence.ts`, `src/hooks/useHoverIntent.ts`, `src/hooks/useContextMenuAnchor.ts`, their tests in `src/hooks/__tests__/`, `src/components/motion/Presence.tsx`, `src/components/motion/index.ts`, `src/components/motion/__tests__/Presence.test.tsx`, `stories/Presence.stories.tsx` | P2-00; shared pieces of P2-01, P2-05, P2-06, P2-07 |
| `F2-menu-core` (wave A2) | `Menu.tsx`, `__tests__/Menu.test.tsx`; for the DOM changes of §6.4 only (§1.20): `src/components/data-display/__tests__/List.test.tsx`, `src/components/table/__tests__/DataGrid.test.tsx`, `src/components/button/__tests__/{Toolbar,MenuButton,SplitButton}.test.tsx`, `src/__tests__/integration.test.tsx`, `stories/Menu.stories.tsx` (descriptions) | `Menu.root.tsx`, `Menu.context.ts`, `Menu.shared.ts`, `Menu.items.tsx`, `Menu.trigger.tsx`, `Menu.popover.tsx`, `__tests__/Menu.items.test.tsx`, `__tests__/Menu.checkedValues.test.tsx`, `__tests__/menuHarness.tsx` | P2-01 (root part) |
| `P2-menu-items` (wave B) | `Menu.items.tsx`, `__tests__/Menu.items.test.tsx` | `Menu.selectable.tsx`, `Menu.group.tsx`, `Menu.link.tsx`, `__tests__/Menu.selectable.test.tsx`, `__tests__/Menu.group.test.tsx`, `__tests__/Menu.link.test.tsx`, `stories/Menu.items.stories.tsx` (temporary, §0.2 rule 14) | P2-01 (items), P2-02, P2-03 |
| `P2-menu-popup` (wave B) | `Menu.root.tsx`, `Menu.context.ts` (members added only), `Menu.trigger.tsx`, `Menu.popover.tsx`, `__tests__/Menu.test.tsx`, `__tests__/Menu.checkedValues.test.tsx`, `stories/Menu.stories.tsx` | `Menu.splitGroup.tsx`, `__tests__/Menu.submenu.test.tsx`, `__tests__/Menu.splitGroup.test.tsx`, `__tests__/Menu.presence.test.tsx`, `__tests__/Menu.hover.test.tsx`, `__tests__/Menu.contextMenu.test.tsx` | P2-04, P2-05 (Menu), P2-06 (Menu) |
| `P2-popover` (wave B) | `Popover.tsx`, `Tooltip.tsx`, `Popover.shared.tsx` (only if the tab-order anchor of P2-06 needs it), `__tests__/Popover.test.tsx`, `__tests__/Tooltip.test.tsx`, `__tests__/Popover.shared.test.tsx` (with that change only), `stories/Popover.stories.tsx`, `stories/Tooltip.stories.tsx` | — | P2-05 (Popover, Tooltip), P2-06 (Popover) |
| `P2-buttons` (wave B) | `ToggleButton.tsx`, `Toolbar.tsx`, `buttonStyles.ts`, `__tests__/ToggleButton.test.tsx`, `__tests__/Toolbar.test.tsx`, `__tests__/buttonStyles.test.ts`, `stories/ToggleButton.stories.tsx`, `stories/Toolbar.stories.tsx` | `Toolbar.parts.tsx`, `Toolbar.context.ts`, `__tests__/Toolbar.parts.test.tsx` | P2-08, then P2-07 |
| `INTEGRATION` (wave C) | `src/index.ts`, `src/components/navigation/index.ts`, `src/components/button/index.ts`, `Menu.tsx` (the new compound members and their flat re-exports), `__tests__/Menu.test.tsx` (the compound exposure list), `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `src/components/button/__tests__/Button.test.tsx` (its one Tooltip `delay`, §6.4), the 0.6 tests of §1.20 that no wave-B package owns (when a wave-B change breaks them), `stories/Menu.stories.tsx` (merge) and the deletion of `stories/Menu.items.stories.tsx`, `stories/_helpers.ts`, `scripts/verify-dist.mjs` (empties `PENDING_FLAT_EXPORTS`) | — | seams |
| `DOCS` (wave D) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md` | — | docs |

Disjointness check (wave B): the four packages share no file. The Menu modules split as `Menu.items.tsx` + `Menu.selectable.tsx` + `Menu.group.tsx` + `Menu.link.tsx` (P2-menu-items, whose tests all run through the harness) against `Menu.root.tsx` + `Menu.context.ts` + `Menu.trigger.tsx` + `Menu.popover.tsx` + `Menu.splitGroup.tsx` (P2-menu-popup, which also takes `Menu.checkedValues.test.tsx`, a test of the root); `Menu.tsx`, `Menu.shared.ts` and `__tests__/menuHarness.tsx` are read only; each test and story file has one owner; `Button.test.tsx` moved from P2-buttons to INTEGRATION, since the `openDelay` it needs arrives with P2-popover in the same wave.

Inside `P2-menu-items` the items run P2-01 → P2-02 → P2-03 (the group tests use checkable items); inside `P2-menu-popup` P2-04 → P2-05 → P2-06 (each changes `Menu.Trigger` and `Menu.Popover`); inside `P2-popover` P2-05 → P2-06; inside `P2-buttons` P2-08 → P2-07 (`Toolbar.RadioButton` needs the role-aware ToggleButton). `P2-menu-popup` files one change request with its first commit: the `probeIncludes` keep of `verify-dist` becomes `'Menu'` (§1.10), which the lead applies. `P2-menu-popup` is the critical path (three M items in series): the lead commits it at a checkpoint after P2-04 (submenus and presence) when its tests pass, so the other packages see the final seam members early.

Waves:
1. **Wave A1:** `F2-foundation`. Exit: §1.12.
2. **Wave A2:** `F2-menu-core`. Exit: §1.20.
3. **Wave B:** the four component packages in parallel. Each reports its barrel requests, the 0.6 tests it updated (with the reason), any failure of another package's test it saw (§0.2 rule 18) and any change request. Between wave B and wave C the full suite is expected to warn, not fail, in two known places: `src/__tests__/integration.test.tsx` and `Button.test.tsx` render Tooltips with `delay` (a deprecation warning from P2-05, which only INTEGRATION may rename, §6.4).
4. **Wave C:** INTEGRATION: the compound members and barrels (§4.7), the cross-package tests (§4.8), public types (§4.9), the story merge, emptying `PENDING_FLAT_EXPORTS`, the full gate. INTEGRATION may start writing the §4.8 cases in `src/__tests__/integration.test.tsx` (a file no wave-B package owns) once `P2-menu-items`, `P2-buttons` and the P2-04 checkpoint have landed, while P2-05 and P2-06 finish.
5. **Wave D:** DOCS against the final API (§5).
6. **Wave E (lead):** the final gate and the real-browser checklist (§6.3), and the per-theme Storybook check of the new stories (light, dark, high contrast, RTL).

---

## 4. Cross-package contracts

### 4.1 Checked values (F2-foundation, F2-menu-core, P2-menu-items, P2-buttons)

- The types `CheckedValues`, `CheckedValuesChangeDetails` and `CheckedValuesChangeHandler` live in `src/lib/types.ts` (§1.1); the state in `useCheckedValues` (§1.2). Menu and Toolbar call the hook; no package re-implements the state.
- Menu: the root owns or inherits the state (§1.17, D7; a submenu with only `onCheckedValuesChange` inherits it through `withCheckedValuesListener`); items read `menu.checked` from the context and call `toggle`/`select` with the click's native event. Toolbar: the root owns the state; its parts read it from `Toolbar.context.ts`.
- `details.event` is the DOM event of the activation (a `MouseEvent` for a click, also when Enter or Space triggered it); `details.checkedItems` is `checkedValues[name]` of the emitted object.

### 4.2 The Menu seam (F2-menu-core → P2-menu-items, P2-menu-popup)

Frozen in wave B (§0.2 rule 12):
- `Menu.context.ts`: every member of §1.14 (`MenuContextValue` including `parent`, `checked`, `persistOnItemClick`; `MenuListContextValue` with `menu`, `isStatic`, `portalDepth`, `closeFromItem`, `registerCheckable`; `MenuSubmenuTriggerContext`; `useMenuContext`, `useOptionalMenuContext`, `useMenuListContext`, `useCheckableRegistry`; `MenuSurfaceApi`; `InitialFocus` may only widen). `P2-menu-popup` adds, and documents in its report: `isSubmenu`, `closeChain`, `requestClose`, `registerOpenSubmenu`, the hover and context handler members, `hoverGroup` and `isHoverFocusing` (list context), `surface` and `layerId` on `MenuSurfaceApi`, the `'none'` initial focus, and any other member it needs.
- `registerSurface` registers only while `open` (§1.14, done in A2).
- `Menu.tsx`, `Menu.shared.ts` and `__tests__/menuHarness.tsx`: read only.
- `Menu.items.tsx` (owned by `P2-menu-items`): `MenuItemRow`'s props, `MenuColumnSpacers`, `useMenuItemActivation`'s options and result, `Menu.Item`'s optional `children` and its submenu path (§1.18) keep their behaviour; `P2-menu-items` may extend them compatibly (new optional props).
- `P2-menu-popup` makes `closeFromItem` of a submenu surface close the chain (D15), provides `MenuSubmenuTriggerContext`, and moves focus to hovered items from the list element (D31, no item change); `P2-menu-items` relies on nothing else of the popup side. Checkable items, links and groups in real popup menus and inside submenus are INTEGRATION cases (§4.8).

### 4.3 Hover intent (F2-foundation → P2-menu-popup, P2-popover)

- `useHoverIntent` (§1.6) owns the timers, the pointer-type and disabled-trigger filters, the safe zone and the suppression after a dismissal; the components own the open reason (`hover` versus pinned), `canClose()` (pinned, or focus inside the surface's layer tree; never focus on the trigger) and where focus goes when a hover-opened surface is pinned (D18). Menu creates one `HoverIntentGroup` per list and calls the hook in `MenuRoot`; Popover calls it in `PopoverRoot` and uses no group.
- Focus follows the mouse inside a focused menu tree, and a submenu that loses focus to it closes through the hover close (D31); Popover content never takes focus from hover.
- `openOnHover` with `openOnContext`: context wins, one warning, in both components.
- Defaults (D17): Menu 250/250, Popover 250/500, Tooltip 200/100; submenus inherit (D7), from a static root too. Tooltip does not use the hook.

### 4.4 Context menus, targets and virtual anchors (F2-foundation → P2-menu-popup, P2-popover)

- `useContextMenuAnchor` (§1.7) owns the gesture detection (the keyboard flag, not `button`), the anchor, the opener, the native-menu suppression (editable fields excepted) and the outside close (context menu; anchor-moving scroll); `usePopupPosition` takes the anchor or the `target` (§1.5; inline virtual elements are cheap).
- Reference precedence (both components): context anchor > `target` > trigger. `target` is `PopupTarget` on both (D20). A `target` element joins the dismiss refs; in context mode the trigger does not.
- Focus: one resolver per component (opener → trigger focus target → focusable `target` element) for the restore, item activation, Tab, the chain close and the layer anchor; Menu focuses its first item on a context open, Popover its content only for a keyboard gesture (P2-06).
- The trigger prop types keep every member (D29); both components pass `omitStateAria: true` to `useTriggerElement` in context mode, so a cloned child or wrapper span gets the forwarded props plus only `id`, `ref`, `onContextMenu` and `onKeyDown` of their own, and a render-prop child's spread state ARIA is removed with a warning.

### 4.5 Presence (F2-foundation → P2-menu-popup)

- `Menu.Popover` is the only 0.7 surface on the core (D4). It keeps `data-state` (`open`/`closed`, D3) and adds `presenceProps`; its layers, focus restore, positioning and surface registration key on `open`, never on `isMounted`, and a submenu's `open` is its own `&&` its parent's (D15), so nothing of a closing chain outlives the close except the inert exiting surfaces.
- Tests that need a waiting phase use `mockAnimations` (called in the test or a `beforeEach`) with a `data-test-motion` surface; no test depends on computed CSS.

### 4.6 Roving transparency (F2-foundation → P2-buttons)

- `data-roving-transparent` (§1.8) is the only way a composite role joins an enclosing roving container; `Toolbar.RadioGroup` is its only 0.7 user and adds the cross-axis keys itself (D23).

### 4.7 Barrel and compound requests (INTEGRATION applies)

- `Menu.tsx`: attach `ItemCheckbox`, `ItemRadio`, `ItemSwitch`, `ItemLink`, `Group`, `GroupHeader`, `SplitGroup` to the `Menu` compound and re-export `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemSwitch`, `MenuItemLink`, `MenuGroup`, `MenuGroupHeader`, `MenuSplitGroup` and their prop types.
- `src/components/navigation/index.ts`: the seven flat names; types `MenuItemSelectableProps`, `MenuItemCheckboxProps`, `MenuItemRadioProps`, `MenuItemSwitchProps`, `MenuItemLinkProps`, `MenuItemLinkOwnProps`, `MenuGroupProps`, `MenuGroupHeaderProps`, `MenuSplitGroupProps`.
- `src/components/button/index.ts`: `ToolbarButton`, `ToolbarToggleButton`, `ToolbarRadioGroup`, `ToolbarRadioButton`, `ToolbarGroup`, `ToolbarDivider`; types `ToolbarButtonProps`, `ToolbarButtonOwnProps`, `ToolbarToggleButtonProps`, `ToolbarRadioButtonProps`, `ToolbarRadioGroupProps`, `ToolbarGroupProps`, `ToolbarDividerProps`.
- Already public from wave A1: `usePresence`, `Presence` and their types (§1.11); `CheckedValues`, `CheckedValuesChangeDetails`, `CheckedValuesChangeHandler`, `PopupRect`, `VirtualElement`, `PopupTarget` through `export type * from './lib/types'`.
- `verify-dist` checks the flat names of every compound member automatically once they are exported. With the Toolbar flat names in the button barrel, INTEGRATION empties `PENDING_FLAT_EXPORTS` (it reported `Toolbar` as pending since P2-buttons made it a compound) and runs `node scripts/verify-dist.mjs --final`.

### 4.8 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

The cases that need two wave-B packages at once (§0.2 rule 9), and the real-Menu cases of the item kinds (§0.2 rule 18):

1. A File menu with a View submenu holding `Menu.Group`s of `Menu.ItemCheckbox` and `Menu.ItemRadio` bound to the root's `checkedValues` (D7): Space toggles inside the submenu and keeps the chain open; Enter toggles, closes the chain and leaves focus on the root MenuButton; a submenu with its own `defaultCheckedValues` keeps a separate state; a submenu with only `onCheckedValuesChange` keeps sharing the root's state and its callback runs after the root's with the same arguments.
2. `Menu.ItemLink` in a popup menu and inside a submenu: a click (and a Ctrl-click) closes the chain, focusing the root MenuButton first, without preventing the navigation (default not prevented; §2 P2-03's listener technique); under `persistOnItemClick` it still closes.
3. A context menu (`openOnContext`) with checkable items and a submenu: a right click opens it at the point; Shift+F10 on a focused row opens it at the row; Escape in the submenu closes only the submenu; Enter on a checkable item closes the chain and returns focus to the row; a right click outside closes both; the name comes from `aria-label`; axe.
4. A Toolbar with `Toolbar.ToggleButton`s, a `Toolbar.RadioGroup`, an Input, a Combobox and a MenuButton whose Menu holds `Menu.ItemCheckbox`es (Guards: Toolbar over any focusable descendant): arrows reach every control; ArrowDown on the MenuButton opens its menu; Escape returns focus to the MenuButton; the toolbar keeps one tab stop.
5. `Menu.Trigger` around a `Toolbar.Button` (the trigger props merge onto the polymorphic part).
6. A Popover with `openOnHover` holding a MenuButton and a Menu: the popover opens on hover; while the menu is open (focus inside the menu's layer, a descendant of the popover's), leaving the popover with the pointer does not close it.
7. A Dialog opened from a submenu item ("Delete…"): when the Dialog closes, focus returns to the root MenuButton (the focus-return chain through D15).
8. A `Menu.Popover` with an exit motion (`data-test-motion`, `mockAnimations`) inside a Dialog, with a submenu of checkable items open: Escape in the root list closes the menu (the controlled submenu's `onOpenChange(false)` fires); while the root surface exits, no submenu layer is registered and a second Escape closes the Dialog (the exiting surface is no layer).
9. A SplitButton whose menu half opens a Menu with a submenu (SplitButton routing guard: the 0.5 routing tests' props still reach the right half).
10. A `Tooltip` with `openDelay` on a `Toolbar.ToggleButton` with `isAccessible`: shows on focus after the delay; `aria-pressed` and `data-pressed` together.
11. Rename the existing Tooltip `delay` props of this file and the one of `Button.test.tsx` to `openDelay` (§6.4), keeping one case in this file that asserts the deprecation warning.
12. The item kinds in real menus: a MenuButton popup menu of `Menu.ItemCheckbox`, `Menu.ItemRadio` and `Menu.ItemSwitch` (Space keeps it open; Enter and a click close it and focus the MenuButton; `persistOnItemClick` keeps it open); the same menu inside a modal (`useModalLayer` harness, as `Menu.test.tsx` does): Escape closes only the menu; a static `Menu` with `defaultCheckedValues` and a `Menu.Group`: `renderToString` has `aria-checked`, the glyph and the group's `aria-labelledby`, hydration logs nothing; axe for both.
13. A Popover opened from a `Menu.Item`, holding a MenuButton and a Menu: that Menu is a root menu (it opens below its button, `data-side="bottom"`; it does not open on hover; it does not share the outer `checkedValues`; activating its item does not close the outer menu) (D14).
14. A hover-opened submenu inside a click-opened root (P2-05 with P2-01 items): hovering a `Menu.ItemCheckbox` of the submenu focuses it (D31) and Space toggles that item, not the root's focused one.

### 4.9 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

`expectTypeOf` for every new member exported from the package entry, including: `MenuProps['checkedValues']` equal to `CheckedValues | undefined`; `MenuProps['onCheckedValuesChange']` accepting `(values: Record<string, string[]>) => void` and `setState`, and callable with one argument (`details` optional, D6); `CheckedValuesChangeDetails` members; `MenuProps['openOnHover' | 'openDelay' | 'closeDelay' | 'openOnContext' | 'persistOnItemClick']`; `MenuPopoverProps['target']` and `PopoverProps['target']` equal to `PopupTarget | undefined`, and `PopupTarget` equal to `HTMLElement | VirtualElement | null`; `TeachingPopoverProps['target']` unchanged (D20); `MenuItemProps['children']` optional; `MenuItemCheckboxProps` requiring `name` and `value`; `MenuItemLinkProps<'a'>['href']`; `PopoverProps['openOnHover' | 'openDelay' | 'closeDelay' | 'openOnContext']`; `PresencePhase` and `UsePresenceResult['phase']`; `TooltipProps['openDelay' | 'closeDelay']` and `delay` still accepted; `ToolbarProps['size']` equal to `Size | undefined`; `ToolbarToggleButtonProps` requiring `name` and `value`; `ToggleButtonProps['isAccessible']`; `MenuTriggerProps['aria-expanded']` still `boolean` and `MenuTriggerProps['onContextMenu']` optional (D29); `PopoverTriggerChildProps` unchanged; `typeof Toolbar.Button` equal to `typeof ToolbarButton`; `@ts-expect-error` for invalid values (`Toolbar size="huge"`, `Menu.ItemRadio` without `name`, `Toolbar.RadioButton role="checkbox"`, a `VirtualElement` without `getBoundingClientRect`).

---

## 5. CHANGELOG, README, CLAUDE.md and guides (DOCS, wave D)

### 5.1 CHANGELOG

A new `## [0.7.0] - Unreleased` section above `## [0.6.0] - Unreleased`:

- **Intro:** the second Fluent-parity release (Phase 2 of the roadmap: menus and commands, and the presence core); it closes 3 high, 9 medium and 17 low gaps (ids in backticks); nothing public removed or narrowed; read "Changed" before upgrading if tests assert Wave's DOM or console output.
- **Upgrading from 0.6** (numbered, as 0.6 did):
  1. Menu surfaces render `data-presence` (and `data-state="closed"`, `inert` while an exit motion runs); without exit classes a menu still unmounts at once. Exact attribute assertions change.
  2. Menu items render hidden column placeholders, and a menu that mixes items with and without icons (or checks) now lines their labels up; assertions on an item's children change.
  3. Toolbar renders `data-size` and `data-orientation`, and `Toolbar` has static parts.
  4. A ToggleButton with `role` `checkbox`, `radio`, `switch`, `menuitemcheckbox`, `menuitemradio`, `option` or `treeitem` renders `aria-checked` and `data-checked` instead of `aria-pressed`, and one with another role (`tab`, `link`, …) renders neither and warns; every ToggleButton renders `data-pressed` while pressed.
  5. Tooltip `delay` is deprecated: use `openDelay` (the old prop still works and warns once in development; tests that spy on `console.warn` see it).
  6. `Menu.Item`'s `persistOnClick` defaults to the Menu's new `persistOnItemClick` (`false` unless set: no change).
  7. In an open popup menu, the item under the mouse takes focus (as in Fluent and native menus); tests that hover items and then press Enter activate the hovered item.
- **Added** (by component, each with its gap ids): the motion tokens and the presence core (P2-00); checkable menu items and `checkedValues`, `persistOnItemClick` (P2-01); groups (P2-02); link items (P2-03); submenus and split rows (P2-04); hover opening and the delay vocabulary on Menu, Popover and Tooltip (P2-05); context menus and `target` on Menu and Popover, `VirtualElement` (P2-06); Toolbar state, parts and size (P2-07); ToggleButton `isAccessible` (P2-08); new public types (`CheckedValues`, `CheckedValuesChangeDetails`, `CheckedValuesChangeHandler`, `PopupRect`, `VirtualElement`, `PopupTarget`, `PresencePhase`, `PresenceAttributes`, `UsePresenceOptions`, `UsePresenceResult`, `PresenceProps` and the part prop types). A note under P2-06: `target` on Menu and Popover takes an element or a `VirtualElement` but no ref in 0.7, while TeachingPopover's `target` takes an element or a ref; both are to be unified (ROADMAP P7-01). A known limitation: iOS Safari fires no `contextmenu` on a long press, so `openOnContext` has no touch gesture there.
- **Changed:**
  - Behaviour: ToggleButton's role-aware state attribute; Tooltip's `delay` warning; `Menu.Item`'s `persistOnClick` default resolution; focus follows the mouse over the items of an open popup menu (D31).
  - Visual: menu column alignment (D10).
  - DOM: `data-presence`, `data-state="closed"` and `inert` on an exiting Menu surface; the `group/menu` class on menu lists; the column placeholder spans and `data-menu-icon` on the icon box; `data-has-submenu` on submenu trigger items; `data-checked` on checkable items and on ToggleButtons with a checked role; `data-pressed` on ToggleButton; `data-size` and `data-orientation` on Toolbar (enumerated attributes always present, boolean ones present or absent, Phase 1 D22).
  - Types: `MenuTriggerProps` gains optional handler members (nothing narrowed; `PopoverTriggerChildProps` already had them and is unchanged, its handler members are now filled in hover and context modes); `MenuItemProps.children` becomes optional; `typeof Toolbar` gains static members; `MenuItemProps.persistOnClick`'s documented default.
- **Deprecated:** Tooltip `delay` (use `openDelay`; removed in 1.0, P14-02). Notice: the `details` parameter of `onCheckedValuesChange` (Menu, Toolbar) becomes required in 1.0, like `onOpenChange`'s (read it as `details?.name`).
- **Size:** `dist/styles.css`, an import of only `Button`, of only `Menu`, of only `Toolbar` and of everything, against 0.6.0, measured as 0.6 did (Phase 1 §9); the presence core's minified and gzip size from `verify-dist`'s budget probe (§6.2).

### 5.2 README

- "Components": the Menu row (checkable items, groups, links, submenus, split rows, hover, context menus); the Toolbar row (parts, `checkedValues`, `size`); the Popover row (hover, context, `target`); the Tooltip row (`openDelay`, `closeDelay`); a new "Motion" row group (`Presence`).
- "React Server Components" flat-name table: the Menu row gains `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemSwitch`, `MenuItemLink`, `MenuGroup`, `MenuGroupHeader`, `MenuSplitGroup`; a Toolbar row with its six parts.
- "Menus": checkable items and `checkedValues` (Space keeps the menu open, Enter and click close it; `persistOnItemClick`; one `Menu.Group` per radio `name`; submenus share the state, and `defaultCheckedValues` scopes one), groups, links (router links through `as`; every click closes; a disabled router link keeps its `to`), submenus (nesting, keys, static menus; a Menu inside a Popover or Dialog opened from an item stays a root menu), split rows (the label-less half with `aria-label`), hover (defaults, touch, pinning, focus following the mouse, Escape keeps it closed until the pointer leaves), context menus (naming with `aria-label`, `aria-keyshortcuts="Shift+F10"` on the region, text fields keep the browser's menu, iOS long press, focus returning to the row), `target` without a trigger (a toggle used as the target carries `aria-haspopup`, `aria-expanded` and `aria-controls` itself; an inline `VirtualElement` is fine), column alignment, exit motion through `data-presence` classes.
- New "Toolbars" note: `checkedValues`, toggles and radio groups (arrows move, Up/Down move within the group, Space checks), groups (named ones become `role="group"`), dividers, `size`, `Toolbar.Button vertical`.
- Popover note: hover cards (`openOnHover`, the click pin), context popovers, `target`. Tooltip: `openDelay`/`closeDelay`, `delay` deprecated.
- New "Motion" note: the tokens (`--wave-duration-*`, `--wave-curve-*`; `duration-wave-*`/`ease-wave-*` in Tailwind builds), `Presence`/`usePresence` with a `starting:` + `data-[presence=exiting]:` example, reduced motion.
- "Keyboard support": the Menu row (submenus: ArrowRight/ArrowLeft mirrored in RTL, Enter/Space open; checkable items: Space keeps the menu open; split rows; Shift+F10 and the ContextMenu key for context menus); the Toolbar row (radio groups join the arrow order, Up/Down move within a group; Space/Enter check; arrows never check); the Popover row (context popovers: Shift+F10 moves focus into the content).
- "Hooks and utilities": `usePresence`, `Presence`.
- "Built-in text": no new built-in strings in 0.7 (the split row's submenu half is named by your `aria-label`).
- "Upgrading from 0.6": a short list pointing to the CHANGELOG.

### 5.3 CLAUDE.md

- "User docs": add this spec.
- Architecture: `src/components/motion/` (`Presence`); public hooks add `usePresence`; internal hooks add `useCheckedValues`, `useHoverIntent`, `useContextMenuAnchor`; `src/lib/` adds `events` (`isOwnEvent`, `isDisabledTrigger`, `isEditableTarget`); component-private helpers add `Menu.root.tsx`, `Menu.context.ts`, `Menu.shared.ts`, `Menu.items.tsx`, `Toolbar.parts.tsx`; test helpers add the Menu item harness (`navigation/__tests__/menuHarness.tsx`).
- C-MOTION: "Surfaces added from 0.7 mount through `usePresence` (`data-presence` phases; the exiting element is `inert`); layers, focus restore and positioning key on the open state, not on the mount. Motion classes use `duration-wave-*`/`ease-wave-*` and `data-[presence=…]:`/`starting:` variants, each with a `motion-reduce:` variant; the tokens are never zeroed."
- C-NAMING: `checkedValues`/`defaultCheckedValues`/`onCheckedValuesChange(checkedValues, details)` for grouped checked state (only the value props select where the state lives; a callback never does); the hover vocabulary `openOnHover`, and `openDelay`/`closeDelay`: milliseconds before a hover-driven open or close (Tooltip: hover- or focus-driven); `openOnContext`; compound-part warning keys are dotted (`Menu.ItemCheckbox:…`).
- C-POPUPS: `target` (`PopupTarget`: an element held in state, or a `VirtualElement`, inline allowed); submenus are nested `<Menu>`s (a portal between list and Menu makes it a root menu); a closing menu closes its open submenu first, and a submenu's open state is its own and its parent's; hover through `useHoverIntent` (mouse only, safe zone, dismissed stays dismissed; focus inside the surface, never on the trigger, blocks the hover close), context gestures through `useContextMenuAnchor` (the key press decides the origin; the opener is the focus-return target; editable fields keep the native menu; `useTriggerElement` `omitStateAria`); register surfaces and anything focus-related on `open`, not on the presence mount.
- C-CLASS, toggles (P2-08): `aria-pressed` only on buttons; a toggle with a checked role uses `aria-checked` and `data-checked`, so one `data-[checked]:` selector matches every checked item of a `checkedValues` group.
- C-CLASS: `data-presence` is enumerated (always rendered with its phase).
- Roving: `data-roving-transparent` makes a composite role (a toolbar radio group) part of the enclosing arrow order.
- Polymorphic list: `'a'` (MenuItemLink), `'button'` (Toolbar.Button).
- Testing: `mockAnimations` (in the test or a `beforeEach`); hover with `userEvent.hover` and `user.pointer` coords under fake timers; context menus with `fireEvent.contextMenu` for a pointer gesture and the key press (optionally followed by `fireEvent.contextMenu`) for a keyboard one; navigation in jsdom through hash hrefs or a bubble-phase `document` listener; Menu item tests through `renderInMenuList`.

### 5.4 Guide and testing guide

- `docs/WAVE-UI-GUIDE.md` chapter 6 "Motion & Animation": the token table replaced by the real tokens (Fluent's values; the four corrected curves), the utilities, the presence pattern with `starting:`, and the reduced-motion rules. The accessibility chapter's keyboard patterns: submenus, checkable menu items, toolbar radio groups, context menus.
- `docs/testing-best-practices.md`: testing presence phases (`mockAnimations`, reduced motion both ways), hover and the safe zone (`mockRect`, pointer coords, fake timers), context menus (pointer versus keyboard gestures), asserting `onCheckedValuesChange` arguments, link navigation in jsdom, the Menu item harness, and what jsdom cannot show (§6.3's browser checklist).

### 5.5 ROADMAP

- Status line: Phase 2 implemented on `feat/fluent-parity-phase-2`, unreleased; link this spec.
- Phase 2 entries: note where the spec changed the sketches (D5 token names, D6 optional `details`, D2/D3 `phase` and `data-presence` instead of `state` and `data-state`, `PresencePhase`, D20 `target` placement and `PopupTarget`, D22 `Toolbar.ToggleButton`).
- P7-01: unify the `target` types (TeachingPopover gains `VirtualElement`, Menu and Popover gain `RefObject`; both non-breaking).
- Backlog: a long-press timer for `openOnContext` where the browser fires no `contextmenu` (iOS Safari); a warning for radio items of different `name`s that share a list without a group (§9).
- P13-03 and P14-02: the `details` parameter of `onCheckedValuesChange` joins the list of `details` parameters announced in 0.x and made required in 1.0.
- §8.3 "Intentional differences": checkable items keep the menu open on Space (APG, D8); submenus share their parent's checked values (D7); `Menu.ItemLink` ignores `persistOnItemClick` (D13); editable fields inside a context region keep the browser's context menu (D19); no global positioning configuration (§8 Q10).

---

## 6. Verification and exit criteria

### 6.1 Per package (waves A and B)

The checks of Phase 1 §0.2 rule 8 with clean output (no act() warnings; every `[WaveUI]` warning asserted). Every new behaviour has a test that failed first. The conventions gate and the stories gate are green for the package's files.

### 6.2 Bundle budget and `verify-dist` probes (D28)

| Check | Gate | Where |
|---|---|---|
| An import of only `Button` contains no Dialog code (0.5) | fails `verify-dist` | `probeTreeShaking` |
| An import of only `Button` contains neither `hooks/usePresence` nor `components/motion/Presence` (roadmap exit criterion) | fails `verify-dist` | `probeTreeShaking` with `dropModules` |
| An import of only `Menu` contains `hooks/usePresence` (the probe detects the core where it is used) | fails `verify-dist` | `probeIncludes` |
| The closure of `usePresence` + `Presence`, minified, React external: at most 5,120 bytes, and at most 2,048 bytes gzip | fails `verify-dist` | `probeSizeBudget` |
| That closure imports no external module but `react` and `react/jsx-runtime` (no `cn`, no `mergeProps`, so the measured size is the real cost) | fails `verify-dist` | `probeSizeBudget` `allowedExternals` |
| Every compound exports its flat names; `PENDING_FLAT_EXPORTS` is empty | fails `verify-dist --final` | `checkFlatExports` |
| `dist/styles.css`, Button-only, Menu-only, Toolbar-only and full-import sizes against 0.6.0 | reported in the CHANGELOG | measured once for the release |

Expectations to check in the report: the Button-only bundle grows only by the `isAccessible` class map in the shared `buttonStyles` module; ToggleButton-only does not include Toolbar code (D22); `dist/styles.css` grows by the 17 motion variables and the new component classes.

### 6.3 Final gate (wave E)

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final` (with the §6.2 probes and an empty `PENDING_FLAT_EXPORTS`), `npm run check:package`, `npm run test:pack` (with the Tailwind fixture's motion utilities), `npm run build-storybook`; the stories axe gate and the conventions gate green; the lead checks every new story in the light, dark and high-contrast themes and in RTL. The lead bumps `package.json` to 0.7.0 at release time, not in this phase's packages.

**Real-browser checklist.** jsdom has no `inert` behaviour, no `getAnimations`, no `:has()` layout, no hit-testing and no real transition timing, and engines differ on context-menu events, so the lead checks these in Storybook in Chrome, Firefox and Safari (a Playwright script where it can be automated) and names each result as exit evidence in the wave E report:
1. Presence: a `starting:` enter and a `data-[presence=exiting]` exit actually run, and the surface stays until its `transitionend`; an interrupted exit (reopen during the exit) returns to `entering` on the same element; reduced motion on and off.
2. An exiting surface: focus is not left on it, it is not reachable by Tab or the screen reader (`inert`), and Escape during its exit reaches the next layer (a Dialog), also with a submenu open when the root started exiting.
3. Columns: the checkmark and icon columns line up across mixed items (`:has()`), in LTR and RTL, and the forced-colors start bar of an expanded item (Windows High Contrast) is distinct from the focus ring.
4. Hover: a diagonal path into a submenu across a sibling trigger keeps it open and moves no focus; hovering a sibling afterwards closes it after the delay; touch taps never hover-open; a hover card does not stay open after an earlier click; Escape then a small mouse move does not reopen it.
5. Context menus: a right click (Windows, Linux), a macOS Ctrl+click, Shift+F10 and the ContextMenu key (Windows, where the key's `contextmenu` arrives on keyup) in Chrome and Firefox open at the pointer or at the focused row as D19 says, never twice; a right click in a text field inside the region shows the browser's menu; an Android long press opens at the point.
6. `Menu.ItemLink`: a click, a Ctrl/Cmd-click and Shift+Enter still navigate (or open the new tab) after the menu unmounts.

### 6.4 Existing tests expected to change (update, do not delete)

- `Menu.test.tsx` (F2-menu-core, then P2-menu-popup, then INTEGRATION): assertions on an item's children or markup (the column placeholder spans come before the icon and the label); exact attribute sets of the surface (`data-presence`, the `group/menu` class); tests that hover items and then press keys (focus follows the mouse, D31); `testCompoundExposure(Menu, …)` gains the new members (INTEGRATION).
- The other tests that render a real Menu (§1.20: `List.test.tsx`, `DataGrid.test.tsx`, `Toolbar.test.tsx`, `MenuButton.test.tsx`, `SplitButton.test.tsx`, `integration.test.tsx`, the stories axe gate): the same DOM changes, updated by F2-menu-core in wave A2 where they appear, later by INTEGRATION. `Overflow.test.tsx` and `useRestoreFocus.test.tsx` render local stand-ins named `Menu`/`MenuPopover`, not the real Menu, and are not affected.
- `Tooltip.test.tsx` (P2-popover): the `delay={…}` props (27) become `openDelay`; the 100 ms hide-grace tests read the `closeDelay` default; one test keeps `delay` and asserts the warning.
- `Popover.test.tsx` (P2-popover): 2 Tooltip `delay` props. `Button.test.tsx` (INTEGRATION, wave C): 1; it logs the deprecation warning during wave B.
- `src/__tests__/integration.test.tsx` (INTEGRATION): 10 Tooltip `delay` props; from wave B until INTEGRATION renames them they log the deprecation warning (§3 waves).
- `Toolbar.test.tsx` (P2-buttons): exact root attribute sets (`data-size`, `data-orientation`).
- `ToggleButton.test.tsx`, `buttonStyles.test.ts` (P2-buttons): exact attribute sets (`data-pressed`, `data-checked`); any case that gave a toggle a `role` and expected `aria-pressed`; `buttonClassName` snapshots.
- `useTriggerElement.test.tsx` (F2-foundation): nothing changes for the default `omitStateAria: false`; new cases only.
- `scripts/__tests__/verify-dist.test.mjs` (F2-foundation): cases that assert the complete error list of `verifyDist` on a fixture dist gain the presence probes (the fixture gains the presence modules, or the case passes the probes it means), and cases that assume an empty `PENDING_FLAT_EXPORTS` pass `pendingFlatExports: []` explicitly.
- `stories/Toolbar.stories.tsx` descriptions that say Toolbar has no parts; `stories/Menu.stories.tsx` descriptions of item alignment.

### 6.5 Definition of done for Phase 2

Every item's tests pass; the gap ids of §7 are closed; the §6.2 probes pass; the CHANGELOG 0.7.0 section, README, CLAUDE.md and guides are updated; `docs/ROADMAP.md` marks Phase 2 as released when 0.7.0 ships; this spec's §10 records where the code deliberately differs from it.

---

## 7. Appendix — gap → item → package

| Gap | Impact | Item | Package |
|---|---|---|---|
| `foundation-14` | medium | P2-00 | F2-foundation |
| `foundation-16` | low | P2-00 | F2-foundation |
| `menu-11` | high | P2-01 | P2-menu-items (+ F2-menu-core root) |
| `menu-12` | high | P2-01 | P2-menu-items (+ F2-menu-core root) |
| `menu-13` | low | P2-01 | P2-menu-items |
| `menu-6` | low | P2-01 | F2-menu-core (columns) |
| `menu-15` | medium | P2-02 | P2-menu-items |
| `menu-14` | medium | P2-03 | P2-menu-items |
| `menu-10` | high | P2-04 | P2-menu-popup |
| `menu-16` | low | P2-04 | P2-menu-popup |
| `menu-2` | low | P2-05 | P2-menu-popup |
| `popover-1` | medium | P2-05 | P2-popover |
| `foundation-22` | low | P2-05 | F2-foundation (safe zone) + P2-menu-popup, P2-popover |
| `positioning-8` | low | P2-05 (the safe zone; see §8 Q10) | F2-foundation |
| `tooltip-3` | low | P2-05 | P2-popover |
| `menu-1` | medium | P2-06 | P2-menu-popup |
| `foundation-18` | medium | P2-06 | F2-foundation (virtual anchors) + P2-menu-popup, P2-popover |
| `popover-2` | low | P2-06 | P2-popover |
| `popover-3` | low | P2-06 | P2-popover |
| `positioning-2` | low | P2-06 | F2-foundation (`usePopupPosition`) |
| `buttons-19` | medium | P2-07 | P2-buttons (+ F2-foundation hook) |
| `buttons-26` | medium | P2-07 | P2-buttons (+ F2-foundation roving marker) |
| `buttons-25` | low | P2-07 | P2-buttons |
| `buttons-27` | low | P2-07 | P2-buttons |
| `buttons-28` | low | P2-07 | P2-buttons |
| `buttons-20` | low | P2-07 | P2-buttons |
| `buttons-24` | low | P2-07 | P2-buttons |
| `buttons-8` | medium | P2-08 | P2-buttons |
| `buttons-10` | low | P2-08 | P2-buttons |

Totals: 3 high, 9 medium and 17 low gaps closed (the roadmap's 3 / 9 / 17). Checked again after the review revision: every gap id the roadmap assigns to P2-00 … P2-08 appears exactly once above and in its item's "Closes" line, and each item's API covers the gap entry's Fluent behaviour (the second half of `positioning-8` is the intentional difference of §8 Q10).

---

## 8. Open questions for the maintainer

Each with the spec's recommended answer, which the rulings above already assume.

1. **Hover delay defaults (D17).** Menu 250/250, Popover 250/500, Tooltip 200/100 (0.6), or Fluent's (Menu 500/500, Popover 0/500, Tooltip 250/250)? *Recommended:* the spec's values: InfoLabel's 250 ms is WaveUI's precedent, the safe zone replaces a long close delay, and Tooltip keeps its 0.6 timing.
2. **`Toolbar.ToggleButton` instead of binding a plain ToggleButton (D22).** *Recommended:* the part; binding through native `name`/`value` would change 0.6 toggles that pass `name` inside a Toolbar and add Toolbar code to every ToggleButton bundle.
3. **Automatic column alignment (D10)** — a visual change for 0.6 menus that mix icons — or Fluent's opt-in `hasIcons`/`hasCheckmarks`? *Recommended:* automatic (the roadmap's acceptance), without an opt-out in 0.7; an opt-out prop can be added later without breaking anything.
4. **Space on a checkable item keeps the menu open (D8, APG)** while Fluent closes it unless persisting. *Recommended:* APG, recorded as an intentional difference in ROADMAP §8.3.
5. **Submenus share their parent's checked values (D7)**, Fluent keeps one state per Menu. *Recommended:* share, with `checkedValues`/`defaultCheckedValues` to scope a submenu (a callback alone only listens).
6. **Root `Menu.Popover` on the presence core in 0.7 (D4)**, or submenus only until Phase 10? *Recommended:* all Menu surfaces; with no motion the timing is exactly 0.6's, and one mount path is simpler to keep correct.
7. **`data-presence` as the phase attribute (D3)** instead of reusing `data-state`. *Recommended:* `data-presence`.
8. **The presence budget (D28):** 5 KiB minified and 2 KiB gzip, gated in `verify-dist`, or reported only? *Recommended:* gate it; adjust the numbers once to the measured size plus 25 % if the first build lands near them.
9. **`target` on the Popover root (D20)**, next to `side`/`align`, not on `Popover.Content` as sketched. *Recommended:* the root.
10. **`positioning-8`'s other half, Fluent's `PositioningConfigurationProvider`.** Close the gap with the safe zone and record "no global positioning configuration; per-component props and P7-01's `positioning`" as an intentional difference in ROADMAP §8.3? *Recommended:* yes.
11. **Context-opened surfaces close on an outside scroll (D19, Fluent's behaviour)**, but only one that moved the anchor by more than 2 px. *Recommended:* yes; a surface anchored to a point cannot follow the content under it, and a scroll that did not move it (inertial scrolling at the right click) must not close a menu that just opened.
12. **`usePresence` and `Presence` public in 0.7 (D27)** rather than internal until Phase 10. *Recommended:* public (the roadmap closes `foundation-14` here), documented as the primitive for consumer motion.
13. **The new folder and story category** `src/components/motion/` and `Components/Motion/Presence`. *Recommended:* yes; Phase 10's motion pieces join it.
14. **Wave A as two sequential packages (A1 foundation, A2 Menu seam)**, each committed by the lead. *Recommended:* yes; it is what makes the two Menu packages of wave B disjoint (D1).
15. **Focus follows the mouse inside a focused menu tree (D31)**, a behaviour change for every 0.6 popup menu (Fluent and native menus do it), or keep 0.6's hover highlight without focus? *Recommended:* follow; with hover-opened submenus, focus left behind makes Enter activate an item the user is not pointing at.
16. **Editable fields inside a context region keep the browser's context menu (D19)**, with no opt-out in 0.7? *Recommended:* yes; paste and spelling suggestions matter most to keyboard and screen-reader users, and an opt-out prop can come later without breaking anything.
17. **`target` on Menu and Popover takes no ref in 0.7 (D20)**, while TeachingPopover's takes a ref and no `VirtualElement`, unified in P7-01? *Recommended:* yes; one shared `PopupTarget` type now, and both widenings later are non-breaking.
18. **`Menu.ItemLink` closes on every click (D13)**, ignoring `persistOnItemClick` and modifier keys? *Recommended:* yes; it is what browser bookmark menus do, and a navigation ends the menu's job.
19. **A ToggleButton with a role that allows neither `aria-pressed` nor `aria-checked` (`tab`, `link`, `menuitem`) renders no state attribute and warns (D25)**, where 0.6 rendered a prohibited `aria-pressed`? *Recommended:* yes; the attribute was invalid ARIA, and the warning points to the right component or role.

---

## 9. Review notes

Three reviews of the first draft (API conventions against CLAUDE.md; accessibility and behaviour against APG and the 0.6 overlay machinery; the code, sequencing and verification against the 0.6 source and scripts) were applied to this spec. None of them overrode a lead ruling; the "required `details`" question was left out by the reviewers because the lead ruled `details` optional. Every blocker (there were none) and major point was applied. The points below were rejected, in full or in part, or applied in another form than proposed.

1. **A warning for ungrouped radio sets** (`Menu.ItemRadio:ungrouped`, radio items of different `name`s in one list without a group or divider between them) is **rejected for 0.7**; the rule goes into the `Menu.ItemRadio` JSDoc and the README instead (P2-01). Detecting "no divider between them" needs the DOM order of items, separators and the radios' `name`s, which the DOM does not carry (a new `data-*` attribute only for a warning), and a container-only rule would warn on two correctly divider-separated sets. It is on the backlog (§5.5).
2. **Submenu detection through the item content** (every item row providing `MenuListContext = null`) is **not used**; the portal-depth rule of D14 is. The row rule misses the common case of a Popover or Dialog rendered next to the items (not inside an item) and opened from one, which the depth rule covers along with the inside case. Having `Portal` itself provide a `null` list context was rejected too: it would make `Portal` know about Menu.
3. **A `RefObject` `target` on Menu and Popover** is **not added in 0.7** (the alternative the review offered is taken): the shared `PopupTarget` type, the TeachingPopover note in D20 and the CHANGELOG, and a ROADMAP P7-01 entry. Reading a ref needs TeachingPopover's per-commit read machinery; both widenings stay non-breaking.
4. **Closing submenus with a previous-value state during render** is **not used**: that setter is `useControllable`'s, which calls the consumer's `onOpenChange` synchronously, and a callback must not run during render. D15 closes descendants from the menu's own close paths instead (innermost first) and adds the effective open state (`own && parent`) for the paths that run no handler (a controlled root closed by its prop, an exit motion). A controlled root that the app closes itself leaves its controlled submenus' state to the app; it is documented, not detected.
5. **Coordinate heuristics for the keyboard `contextmenu`** (`clientX` and `clientY` both 0 with `detail` 0) are **not used**: Chrome gives the keyboard event the focused element's coordinates. The keyboard flag of §1.7 rule 1 (set by our own Shift+F10/ContextMenu keydown, cleared by the next `pointerdown`) is deterministic and needs no engine knowledge; the manual checklist of §6.3 covers the engines.
6. **Ignoring scroll events in the first frame after a context open** (the other alternative for the eager scroll close) is **not used**; the anchor-movement rule of §1.7 rule 5 covers inertial scrolling at any time, not only in the first frame.
7. **Nav's `opensElsewhere` for `Menu.ItemLink`** is **not used**: every click closes (D13). `opensElsewhere` decides whether Nav selects an item, which a menu does not do; closing on every click matches browser bookmark menus and needs no modifier rules. The review's other option (links ignore `persistOnItemClick`) is taken.
8. **A dashed 1 px outline for the expanded item in forced colors** is **not used**; the logical start bar (`border-s-4` with `ps-2`) is. An outline would compete with the focus ring's `outline` on an item that is both expanded and focused, and the bar mirrors in RTL.
9. **Running `P2-menu-items`' popup tests against a frozen A2 commit (a worktree)** is **not used**; the harness of D32 is (the review's first option). It keeps each package's tests independent of the other's files, as Phase 1's `renderWithFieldContext` did, without a second working tree.
10. **The exit-criteria list** is **applied in part**: `Overflow.test.tsx` and `useRestoreFocus.test.tsx` render local stand-ins named `Menu` and `MenuPopover`, not the real Menu, so §1.20 and §6.4 name the files that do (List, DataGrid, Toolbar, MenuButton and SplitButton through their `WithMenu` stories, integration, the stories axe gate).
11. **Removing the trigger from the dismiss refs in context mode** is applied with one addition the reviews did not ask for: the `outsidePress` predicate ignores a Ctrl+press inside the trigger, so a macOS Ctrl+click on another row moves the menu instead of closing and reopening it.
12. **A keyboard-opened context Popover** gets **both** of the review's alternatives: focus moves into the content, and the opener is the tab-order anchor (so a pointer-opened one is reached by Tab from the row).

---

## 10. Implementation notes

Added during implementation, recording where the 0.7.0 code deliberately differs from §0–§5 and why (as Phase 1 §9); they win where they disagree.

The package reports of the implementation and of the verification fix round hold the evidence; the CHANGELOG, README and guides describe each rule for users (named at the end of each note).

**Foundation (§1)**

1. **Radio items and `CheckedValues` (§1.1, §1.2, P2-01, P2-07; lead ruling).** A radio item, like a `Toolbar.RadioButton`, is checked while its `value` is in `checkedValues[name]`: `isChecked` is `includes` for every kind, as §1.2, P2-01 and P2-07 prescribe. The `CheckedValues` JSDoc of §1.1 ("a radio item while its `value` is the group's only value") contradicted that; the code's JSDoc now says a radio is checked while its value is in the group and that checking it makes its value the group's only value, so a radio group should hold at most one value (`select` only ever writes one). Groups are read and written as own properties, so any string is a group name, `constructor` and `__proto__` included (§1.2's "an unknown group reads as empty" holds for them too). Users: the `CheckedValues` JSDoc, README "Menus" and "Toolbars", CHANGELOG.
2. **The presence recipe (§1.4, D2; lead ruling).** The enter is gated on its phase: `data-[presence=entering]:starting:…` (in CSS, `@starting-style { .notice[data-presence='entering'] { … } }`). The §1.4 examples above (the `usePresence` JSDoc and the `FadeAndSlide` story) were corrected in place. `@starting-style` applies to every first style of an element, whatever its phase, so the ungated `starting:` of the first draft also animated an element that mounts `entered` (without `appear`, and server-rendered content after hydration) while the core already reported `entered` and had called `onEntered`, which made `appear` meaningless. The core's phases are unchanged; the gated form was checked in Chromium, Firefox and WebKit. `Menu.Popover` mounts `entered` when it is open at mount, so a menu's enter classes take the same gate. Users: the `usePresence` and `Presence` JSDoc, README "Enter and exit motion", guide chapter 6.
3. **`onExited` timing (§1.4 rule 4 and the option's JSDoc).** It runs from the layout effect of the commit that unmounts the element (with `unmountOnExit: false`, the commit that hides it), not before the element unmounts: rule 1's `isMounted` formula and rule 4's "from an effect keyed on the committed phase" allow no other order, so the formula was kept and the JSDoc corrected. Users: the `onExited` JSDoc, guide chapter 6.
4. **Presence imports (§1.4 rule 7, D28).** `Presence` also imports `src/lib/dev` (and through it `lib/globalRegistry`) for its `Presence:children` warning (C-DEV), and `usePresence` uses `useEventCallback`. There is still no `cn` or `mergeProps`, and the closure's only externals are `react` and `react/jsx-runtime`.
5. **The presence budget (§1.10, §6.2, D28, §8 Q8).** The first build measured 5,443 bytes minified and 2,341 bytes gzip, above D28's 5,120 and 2,048; as §8 Q8's answer allows, `verify-dist` gates 6,804 and 2,927 bytes (the measurement plus 25 %). About 1.1 KB of it is the computed-style fallback that rule 3 requires for engines without `getAnimations`. Users: CHANGELOG "Size".
6. **Motion tokens (D5, §5.4).** The 0.6 guide had five wrong curves, not four: `accelerate-max`, `-mid`, `-min` and `decelerate-max`, `-mid`. Users: guide chapter 6, CHANGELOG.
7. **Dismissed stays dismissed (§1.6 rule 6).** Hover opening is suppressed only when the pointer is on the trigger at the dismissal; a surface dismissed while the pointer is elsewhere opens again on the next hover of its trigger, which D18's "until the pointer has left its trigger" already allows. The safe zone also ends as soon as the surface closes (rule 5 ends it at the first pointer event after the close), so no stale group hold is left. Hook tests pin the suppression (a trigger rendered anew under the resting pointer, a hover close racing a re-entry, a held retry). A surface that overlaps its own trigger (a flipped or shifted placement) is the real-browser case of §6.3 item 4.
8. **The hover intent's `focusout` (§1.6 rule 3).** It is a native listener on the surface element (the `surfaceHandlers` members are fixed). The `focusout` start of the close timer, `startClose()` and the safe zone's restart do not read `canClose()` when they start; the check at expiry always applies.
9. **A close by hover moves no focus (§1.6, D18, D31, P2-05; lead ruling).** `useRestoreFocus` gains `isHoverClose`: Popover and Menu set a flag in the hover intent's `onClose` before the close request (in case the app applies it synchronously), every other close request and the next opening clear it, and a hover close restores only focus that is inside the surface. A surface opened from inside one that closes by hover (a submenu, a hover card in a hover card, at any depth; recognised by its opener, else its trigger, lying inside that surface) is taken along, and its close counts as a hover close too. Every other close keeps 0.6's `onlyIfFocusInside` rule (focus inside, or on `<body>`), so Escape on an unpinned hover card while focus is on `<body>` returns focus to the trigger. A surface with neither an opener nor a trigger inside the hover card is a ROADMAP §8.5 follow-up. Users: README "Menus" and "Popovers and tooltips", the keyboard table, guide, CHANGELOG.
10. **Scroll references of a pointer context gesture (§1.7 rule 5, D19, §8 Q11; lead ruling).** Rule 5 measured the region only. A pointer gesture now measures the element it landed on (the row under the pointer, which a scroll of the region's own content moves) and the region; a move of either by more than 2 px closes the surface. A press on the region's own box uses the region alone, and the element under the pointer stops counting once it has no box (removed, or `display: none`, such as a row's hover-only action), so a scroll elsewhere does not close. Keyboard gestures are unchanged (the keyboard anchor, else the region). Why: a surface anchored to a point cannot follow the content under it, so a scroll of a scrollable region's content now closes a pointer-opened surface as it closes a keyboard-opened one. The trade-off against §8 Q11's example: inertial scrolling of the region's content that is still running at the right click moves the row and closes the surface that just opened (there is no grace period). Users: the `openOnContext` JSDoc of Menu and Popover, README, CHANGELOG.
11. **The context opener (§1.7 rule 6).** `opener` is the element focused at the gesture that opened the surface. It is kept through that surface's close (the close returns focus to it) and forgotten when the surface opens without a gesture (a controlled `open`), so a close or Tab after such an opening never returns to an earlier gesture's row, in Menu and Popover alike. This closes the follow-up the first draft of ROADMAP §8.5 recorded. Users: README "Menus", CHANGELOG.
12. **Context gestures while open, and the surface handler (§1.7 rules 4 and 6).** A gesture while the surface is open makes `fromContext` `true`, so a surface opened by the app moves to the gesture; a gesture whose opening the app refuses does not linger into a later opening. The surface's `contextmenu` is prevented only while the hook is `enabled`, so Menu and Popover compose the handler in every mode and only context mode suppresses the browser's menu (a non-context surface keeps it, in its text fields too).
13. **The roving hand-back (§1.8).** Removing `data-roving-transparent` restamps (§1.8's test) by giving the items back their own `tabindex` (and `data-roving-value`), recorded at the first stamp, when they come to belong to a nested composite; only that transition releases a stamp, and hidden and disabled items keep their 0.6 behaviour. Users: CHANGELOG, README "Hooks and utilities".

**Menu (§1.13–§1.18, P2-01–P2-06)**

14. **`registerOpenSubmenu` (P2-04 rule 1).** It takes an `OpenSubmenu` object, `{ close(), containsFocus(), listContainsFocus() }`, not `close`: a static root has no layer tree, and D31's "focus inside the static root's element and its submenus" needs the open submenu's focus checks (note 16). Internal.
15. **An uncontrolled submenu under a parent closed by its prop (P2-04, D15).** An uncontrolled submenu whose popup parent closed without closing it (the parent's controlled `open`, or its exit) sets its own state to `false` from a layout effect, so it does not reopen with the parent; a controlled submenu's state stays the app's, as D15 says.
16. **Focus follows the mouse (P2-05, D31).** "Focus inside the menu tree" is focus in a list of the chain: the root's surface or static element, then its open submenus' lists, recursively (`listContainsFocus`), not the root's layer tree. The layer tree also holds Popovers, Portals and root Menus opened from items, and hover then took focus from their fields (Enter activated the hovered item), against D14's unchanged 0.6 compositions. The hover close's `canClose` and `closeChain` keep the layer tree. A submenu that loses focus to the pointer closes through its hover close only when it has one: with `openOnHover={false}` it closes at once, as for a keyboard move (the literal rule would leave it open). Users: CHANGELOG (Changed), README "Menus", guide.
17. **A hover opening of a controlled menu (P2-05).** A pending hover opening lasts until the menu opens, in a later render too (an app that applies it in a transition), and is forgotten when the pointer leaves the trigger while the menu is still closed, so an opening the app makes later on its own is an ordinary one (focus moves in, and it is pinned). An intermediate version cleared the mark with an extra render per hover opening, which ran before a transition parent applied the opening. The residual race (a transition that applies the opening only after the pointer has left) is a ROADMAP §8.5 follow-up. Users: CHANGELOG.
18. **Submenu placement (D14; lead ruling).** A submenu flips (floating-ui's `bestFit`) and, with room on neither side of its item (a wide menu, a phone), is shifted across that side over its parent menu, inside the viewport (`usePopupPosition`'s `shift: { padding: 8, crossAxis: true }`, for submenus only). This is how D14's "fits the viewport" is realised; root menus, Popover and the listboxes keep main-axis shift. Users: the `Menu.Popover` JSDoc, README, guide, CHANGELOG.
19. **Focus moving into a context menu's region (D19, P2-06).** The region is still no part of the dismiss layer, but a focus move into it that a context-gesture press causes (the right button, a Ctrl+press, a touch or pen press, from its `pointerdown` to its `pointerup`) does not dismiss the menu through `focusOutside`: Chromium and Firefox focus the row at the press, before the `contextmenu` event that moves the menu there, which gave `onOpenChange(false)` and then `(true)` for one gesture, against D19 rule 2 and §6.3 item 5 ("never twice"). Any other focus move into the region (a primary press, the app) closes the menu as before, so a primary press on a row whose click handler stops propagation still closes it in Chromium and Firefox (checked in both); WebKit does not focus a button on click, so there such a press reaches neither rule and leaves the menu open, as it leaves open every surface whose outside press never reaches the document. The press flag does not ask the platform, so a Ctrl+primary press (multi-select on Windows and Linux, a context click only on macOS) and a pen tap count as context-gesture presses everywhere: on a row whose click handler stops propagation they leave the menu open in every engine too (Escape and any other press still close it). Detecting macOS and deferring pen presses until a `contextmenu` arrives would narrow this further; the case needs a stopped click on a focusable region row and was left as is. Users: README, guide, CHANGELOG.
20. **Focus before close (P2-04, P2-06).** On every close with focus inside it, `Menu.Popover` moves focus to where the restore would put it (the context opener, the element focused when the menu opened, then the return target) in the closing commit's layout-effect cleanup, before a surface opened in the same update (a Dialog opened by the item) captures its opener: the surface stays mounted, and `inert`, during its exit phase, so that Dialog would otherwise record the item and return focus to a removed element. Item activation and Tab keep §2 P2-06's resolver (`closeChain`: the context opener, else the trigger's focus target, else a focusable `target` element). So in a menu with a focusable `target` that is not its opener and no trigger, Escape and a close by the app return focus to the opener, while item activation and Tab focus the target. Users: README "Menus".
21. **The `Menu.Popover` `target` JSDoc (D20, §5.2).** It does not tell consumers to give a target toggle `aria-controls`: `MenuPopoverProps` omits `id` and the surface id is generated, and C-DOCS wins over the spec's verbatim text. The toggle carries `aria-haspopup="menu"` and `aria-expanded`; a consumer `id` is a ROADMAP §8.5 follow-up. Popover keeps D20's `aria-controls` (`Popover.Content` takes an `id`). Users: README, CHANGELOG.
22. **The `Menu.Popover` name.** The trigger's `aria-labelledby` is written after `{...rest}`: a consumer `aria-labelledby` wins when it is defined, and a forwarded key that holds `undefined` no longer removes the trigger's name (0.6 wrote it before the spread). Users: CHANGELOG (Fixed), the `MenuPopoverProps.ref` JSDoc.
23. **Groups (P2-02, D12).** The group context also carries the scanned header element's props object; only the header rendered with that object is the scanned one and renders the group's `headerId`. Any other header (inside a custom component, or a second direct-child header) renders only its own `id` and warns once (`Menu.GroupHeader:extra-header`), so no two headers share an id, the counterpart of D12's "never dangles". This closes the follow-up the first draft of ROADMAP §8.5 recorded. `Menu.GroupHeader:unlabelled` stays silent in a group named by `aria-label` or `aria-labelledby` (that label is its remedy). A consumer label counts only when it is defined, and the group writes `aria-labelledby` after the rest spread. The identity check relies on React passing an element's own props object to its component (on the client, in Fizz and for lazy references in React 19), which the group tests guard. Users: the `Menu.Group` JSDoc, README "Menus", CHANGELOG.
24. **A disabled `Menu.ItemLink` (P2-03).** It drops `href` for any intrinsic `as` (`typeof Component === 'string'`), not only the default `'a'`: an intrinsic element is no router link. A component `as` keeps what it renders (its `to`). Users: README "Menus".
25. **The item row (§1.15, §1.16).** `MenuItemRow` gains an optional `markLabel` (default `true`; `Menu.Item` passes `false` when the consumer set `data-roving-text`, which then wins for typeahead, as in 0.6), and its shortcut span renders `dir="auto"`, so "Ctrl+," keeps its order in an RTL menu. Users: CHANGELOG (Fixed), README.

**Popover and Toolbar (P2-05–P2-07)**

26. **The surface of a keyboard-opened context popover (P2-06).** It always renders `tabIndex={-1}`, not only when its content has nothing tabbable: deciding that during render needs a DOM read (C-HOOKS). Focus still goes to the first tabbable element, and the attribute sits before `{...rest}`, so a consumer `tabIndex` wins; a click on a non-focusable part of the content then focuses the surface. Users: CHANGELOG (DOM structure).
27. **`Toolbar.RadioGroup` (P2-07).** Its `role="radiogroup"` is written after `{...rest}` and cannot be replaced (the JSDoc says a passed `role` is ignored), and its cross-axis keys skip only natively disabled radios: a `disabledFocusable` radio stays reachable, as in the toolbar's own arrow order, where the spec said "the next enabled radio". Users: the part's JSDoc, README "Toolbars", guide, CHANGELOG.

**Integration (§4.8)**

28. **§4.8 case 8.** The dismiss-layer stack sends Escape to the topmost layer of the focused scope's subtree (the 0.6 routing), so Escape in the root list while a submenu is open closes the submenu first, as native menus do; "Escape in the root list closes the menu" cannot happen with the submenu open. The case runs twice: Enter on a radio item of the submenu (the chain closes, the submenu's `onOpenChange(false)` once), and Escape in the submenu followed by Escape in the root list. Both assert the exiting root surface, no submenu layer, one open layer (the Dialog's), focus on the MenuButton, and that the next Escape closes the Dialog.
