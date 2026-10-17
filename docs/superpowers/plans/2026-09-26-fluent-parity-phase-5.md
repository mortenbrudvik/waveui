# WaveUI 0.10.0 — Fluent Parity Phase 5 (pickers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 5 of the Fluent parity roadmap: multi-select Dropdown and Combobox, custom filtering and a controllable query, public listbox primitives with a standalone Listbox and `useActiveDescendant`, composable SwatchPicker swatches with a grid layout, and a standalone Calendar with month and year pickers.

**Architecture:** A foundation wave (A) rebuilds `useListbox` on a new state-based `useActiveDescendant` and prepares `Option` and the public exports; four packages (B) then work on disjoint files in parallel (pickers, Listbox, swatches, calendar); INTEGRATION (C) wires barrels and cross-package tests, DOCS (D) writes the documents, the lead runs the final gate (E) and merges Phases 3 and 4 in (F).

**Tech Stack:** React 19 (ref as prop), TypeScript 6, Tailwind CSS 4 with `--wave-*` tokens, Vitest + React Testing Library + user-event + vitest-axe (axe-core 4.13) on jsdom, Storybook 9.

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-5-design.md` (approved 2026-09-26). The spec is the contract: its rulings D1–D42, §1 (foundation), §2 (items), §3 (files and waves), §4 (contracts; §4 wins over §2 where they disagree), §5 (documents) and §6 (verification). Every task below cites the sections it implements; read them before starting the task.

## Global Constraints

- Worktree `C:\code\packages\wave-ui-react\.claude\worktrees\fluent-parity-phase-5`, branch `feat/fluent-parity-phase-5`, from `main` d5a84bd. Never switch branches in the main checkout.
- Release 0.10.0; CHANGELOG section `## [0.10.0] - Unreleased` (dated only by the release commit, not in this plan).
- Waves A–E build on the 0.7 API of the files they change: no P3-00 stable class names, no P4-01 `size`/`appearance`, no new tokens beyond spec §1.8 (spec rule 22). Wave F adapts.
- No new runtime dependency (the package keeps `@floating-ui/react-dom`, `clsx`, `tailwind-merge`).
- Every CLAUDE.md convention (C-REF … C-STORIES) applies; the conventions gate (`src/__tests__/conventions.test.ts`) and the stories axe gate (`src/__tests__/stories.a11y.test.tsx`) stay green for every touched file.
- React 19 ref as prop (no `forwardRef`); every component and sub-component sets `displayName`.
- Built-in strings are `labels` members with English defaults, exactly as spec D36 lists them.
- Every exported symbol has consumer JSDoc with `@default`; compound docblocks only on the exported `Object.assign(…)` const; no Tailwind utility as a bare word in `src/components`/`src/lib` comments and strings (spec rules 24, 26).
- TDD: a failing test first for every behaviour; test output clean (no act() warnings; every `[WaveUI]` warning asserted with its exact text); check with `--reporter=default`.
- Agents run no git write commands; the lead commits after each task (conventional-commit subject, no AI attribution trailer).
- `useListbox.test.tsx`, `DatePicker.test.tsx`, `SwatchPicker.test.tsx`, `Option.test.tsx` change only where spec §6.4 says; any other change to a 0.7 test is reported to the lead, not made.
- Verification per task: `npx vitest run <task test files> --reporter=default`, `npx vitest run src/__tests__/conventions.test.ts -t "<each touched source file>"`, `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint <touched files>`, `npx prettier --check <touched files>`.

## Review Focus

1. **Options that change while a list is open** (an async search replaces the options; the active option disappears; a multi-select value has no option any more): the highlight moves to the fallback or first option, nothing throws, the value is kept and submitted, and the display leaves the unknown value out. Pinned in Task A1 (dropped item), Task B1 (unknown multi-select value) and Task B3 (async search).
2. **Collections with nothing to reach** (every option disabled or hidden; every swatch of a grid disabled; a calendar month where every day is unavailable): focus stays visible, no key loops forever, no tab stop points at a missing element. Pinned in Task C1 (Listbox ring), Task D4 (all-disabled grid) and Task E4 (all-unavailable month).
3. **Inverted or narrow date bounds** (`minDate` after `maxDate`; bounds that exclude whole years or decades): the header buttons are disabled, paging clamps, the month and year views render their cells `aria-disabled`, and nothing loops. Pinned in Task E4.
4. **Duplicate values** (two options or two swatches with one value, in multi-select mode): one development warning per value, toggling acts on the first, nothing throws. Pinned in Task B1 and Task D1.
5. **Many selected values** (dozens of labels in a multi-select Dropdown or Combobox): the text truncates without growing the control, and the accessible value is the whole `labels.selection` text. Pinned in Task B1 and Task B2.

---

## File Structure

Paths without a folder are in `src/components/input/`.

| File | Responsibility | Wave / task |
|---|---|---|
| `src/hooks/useActiveDescendant.ts` (new) | the active-item state, navigation, scrolling, change reports | A1 |
| `src/hooks/useListbox.ts` | registry + keys + commits, on `useActiveDescendant`; standalone mode; `details` callbacks; `multiselect`; `disabledOptionsFocusable` | A2–A5 |
| `Option.tsx` | `Option` (`checkIcon`, multi-select box), `OptionGroup` (naming), `ListboxProvider`, `ListboxSurface`, `useListboxPopup` | A6 |
| `src/lib/types.ts` | `DayOfWeek`, `FirstWeekOfYear` | A7 |
| `src/index.ts`, `index.ts` | entry exports of the primitives and `DismissReason` (wave A); the rest (wave C) | A7, F1 |
| `Dropdown.tsx`, `Combobox.tsx`, `TagPicker.tsx` | multi-select, query, filter, active-option reports, Dropdown parts | B1–B5 |
| `Listbox.tsx` (new) | the standalone Listbox | C1–C2 |
| `SwatchPicker.tsx`, `SwatchPicker.context.ts` (new), `SwatchPicker.swatches.tsx` (new), `src/hooks/useRovingGrid.ts` (new) | swatch composition, kinds, layouts, focus modes, grid keys | D1–D5 |
| `src/lib/date.ts` (new), `dateUtils.ts`, `Calendar.tsx` (new), `Calendar.views.tsx` (new), `DatePicker.tsx` | date helpers, the calendar view and component, DatePicker on it | E1–E6 |
| `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `scripts/verify-dist.mjs` and its test | seams, types, dist checks | A7, F1–F3 |
| `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/*` | documents | G1–G4 |

---

## Wave A — F5-foundation (exclusive; the lead commits after each task, and wave B starts only after Task A7)

### Task A1: `useActiveDescendant`

**Files:**
- Create: `src/hooks/useActiveDescendant.ts`
- Test: `src/hooks/__tests__/useActiveDescendant.test.tsx`

**Interfaces:**
- Consumes: `useEventCallback` from `src/hooks/useEventCallback.ts` (stable identity, latest closure, never called during render).
- Produces: `useActiveDescendant(options: UseActiveDescendantOptions): UseActiveDescendantResult`, exactly as spec §1.1 types them (`setActiveValue(value, options?: { scroll?: boolean })`, `highlight`, `first`, `last`, `next`, `prev`, `move`, `activeValue`, `activeDescendantId`).

- [ ] **Step 1: Write the failing tests**

```tsx
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  useActiveDescendant,
  type UseActiveDescendantOptions,
  type UseActiveDescendantResult,
} from '../useActiveDescendant';

let api: UseActiveDescendantResult;
const renders = { count: 0 };

function Probe(props: Omit<UseActiveDescendantOptions, 'getId'> & { getId?: (v: string) => string }) {
  renders.count += 1;
  api = useActiveDescendant({ getId: (v) => `opt-${v}`, ...props });
  return (
    <ul>
      {props.items.map((v) => (
        <li key={v} id={`opt-${v}`} data-active={api.activeValue === v ? '' : undefined}>
          {v}
        </li>
      ))}
    </ul>
  );
}

const ABC = ['a', 'b', 'c'] as const;

describe('useActiveDescendant', () => {
  it('shows the fallback until an item is moved to, and nothing while disabled', () => {
    const { rerender } = render(<Probe items={ABC} fallback="b" />);
    expect(api.activeValue).toBe('b');
    expect(api.activeDescendantId).toBe('opt-b');
    act(() => api.next());
    expect(api.activeValue).toBe('c');
    rerender(<Probe items={ABC} fallback="b" enabled={false} />);
    expect(api.activeValue).toBeNull();
    expect(api.activeDescendantId).toBeUndefined();
    rerender(<Probe items={ABC} fallback="b" />);
    expect(api.activeValue).toBe('b'); // the moved-to item was forgotten while disabled
  });

  it('ignores a fallback that is not an item', () => {
    render(<Probe items={ABC} fallback="z" />);
    expect(api.activeValue).toBeNull();
  });

  it('drops a moved-to item that leaves the items, and does not bring it back', () => {
    const { rerender } = render(<Probe items={ABC} />);
    act(() => api.setActiveValue('b'));
    rerender(<Probe items={['a', 'c']} />);
    expect(api.activeValue).toBeNull();
    rerender(<Probe items={ABC} />);
    expect(api.activeValue).toBeNull();
  });

  it('keeps a value set in the same update as the items it belongs to, and an invalid one clears an earlier move', () => {
    function Changer() {
      const [items, setItems] = React.useState<readonly string[]>(ABC);
      api = useActiveDescendant({ items, getId: (v) => v });
      return (
        <button
          type="button"
          onClick={() => {
            setItems(['c', 'd']); // TimePicker's pattern (spec §1.1.1): the next render's items
            api.setActiveValue('d');
          }}
        >
          change
        </button>
      );
    }
    const { getByRole } = render(<Changer />);
    act(() => api.setActiveValue('b'));
    act(() => getByRole('button').click());
    expect(api.activeValue).toBe('d');
    act(() => api.setActiveValue('zz'));
    expect(api.activeValue).toBeNull();
  });

  it('keeps a move made in the same update that enables it', () => {
    function Opener() {
      const [open, setOpen] = React.useState(false);
      api = useActiveDescendant({ items: ABC, getId: (v) => v, enabled: open });
      return (
        <button
          type="button"
          onClick={() => {
            api.setActiveValue('c');
            setOpen(true);
          }}
        >
          open
        </button>
      );
    }
    const { getByRole } = render(<Opener />);
    act(() => getByRole('button').click());
    expect(api.activeValue).toBe('c');
  });

  it('activates the first item when the items change while enabled (activateFirstOnChange)', () => {
    const { rerender } = render(<Probe items={ABC} activateFirstOnChange />);
    expect(api.activeValue).toBeNull();
    act(() => api.setActiveValue('c'));
    rerender(<Probe items={['b', 'c']} activateFirstOnChange />);
    expect(api.activeValue).toBe('b'); // wins over the earlier move
    rerender(<Probe items={['b', 'c']} activateFirstOnChange enabled={false} />);
    rerender(<Probe items={['b', 'c']} activateFirstOnChange />);
    expect(api.activeValue).toBeNull(); // enabling with unchanged items keeps the fallback
  });

  it('adds no render without activateFirstOnChange', () => {
    renders.count = 0;
    const { rerender } = render(<Probe items={ABC} />);
    rerender(<Probe items={['a', 'b']} />);
    expect(renders.count).toBe(2);
  });

  it('steps from the fallback or from nothing, wraps with loop, clamps move', () => {
    render(<Probe items={ABC} loop />);
    act(() => api.prev());
    expect(api.activeValue).toBe('c'); // from nothing: the last
    act(() => api.next());
    expect(api.activeValue).toBe('a'); // wraps
    act(() => api.move(10));
    expect(api.activeValue).toBe('c'); // clamps, never wraps
    act(() => api.setActiveValue(null));
    act(() => api.move(-10));
    expect(api.activeValue).toBe('c'); // from nothing: a negative delta goes to the last
  });

  it('scrolls keyboard moves into view, not pointer moves or scroll: false', () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(<Probe items={ABC} />);
    act(() => api.setActiveValue('b'));
    expect(spy).toHaveBeenCalledTimes(1);
    act(() => api.highlight('c'));
    act(() => api.setActiveValue('a', { scroll: false }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('prefers getElement over the id lookup for scrolling', () => {
    const target = document.createElement('div');
    target.scrollIntoView = vi.fn();
    render(<Probe items={ABC} getElement={() => target} />);
    act(() => api.setActiveValue('b'));
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('reports each change once, null included, also in StrictMode', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <React.StrictMode>
        <Probe items={ABC} fallback="a" onActiveValueChange={onChange} />
      </React.StrictMode>,
    );
    act(() => api.next());
    rerender(
      <React.StrictMode>
        <Probe items={ABC} fallback="a" enabled={false} onActiveValueChange={onChange} />
      </React.StrictMode>,
    );
    expect(onChange.mock.calls).toEqual([['a'], ['b'], [null]]);
  });

  it('puts the id in the server HTML and keeps method identities', () => {
    expect(renderToString(<Probe items={ABC} fallback="b" />)).toContain('data-active');
    const { rerender } = render(<Probe items={ABC} />);
    const first = api.next;
    rerender(<Probe items={['a']} />);
    expect(api.next).toBe(first);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/hooks/__tests__/useActiveDescendant.test.tsx --reporter=default`
Expected: FAIL (module `../useActiveDescendant` not found).

- [ ] **Step 3: Implement**

```ts
import * as React from 'react';
import { useEventCallback } from './useEventCallback';

/** Options of {@link useActiveDescendant}. */
export interface UseActiveDescendantOptions {
  /** The values that can become active, in navigation order. */
  items: readonly string[];
  /** The DOM id of an item's element: the `aria-activedescendant` target. */
  getId: (value: string) => string;
  /**
   * While `false`, no item is active and the moved-to item is forgotten (a closed popup, an
   * unfocused list). A move made in the same update that enables the hook is kept.
   * @default true
   */
  enabled?: boolean;
  /**
   * The active item while none was moved to, or after the moved-to item left `items` (the
   * selected option, for example). Ignored when it is not in `items`.
   * @default null
   */
  fallback?: string | null;
  /** `next()` and `prev()` wrap at the ends. @default false */
  loop?: boolean;
  /**
   * Whenever `items` changes while the hook is enabled (compared by content), its first item
   * becomes active — also when the change comes with enabling (the keystroke that opens a
   * filtered list). Enabling with unchanged items keeps the fallback. It wins over a move made in
   * the same update.
   * @default false
   */
  activateFirstOnChange?: boolean;
  /** The element of an item, for scrolling it into view. @default document.getElementById(getId(value)) */
  getElement?: (value: string) => HTMLElement | null;
  /** Called after the active item changed (from an effect), `null` included. */
  onActiveValueChange?: (value: string | null) => void;
}

/** Result of {@link useActiveDescendant}. The methods have stable identities. */
export interface UseActiveDescendantResult {
  /** The moved-to item, else the fallback; `null` while disabled. Derived during render. */
  activeValue: string | null;
  /** `getId(activeValue)`, or `undefined`: spread as `aria-activedescendant`. */
  activeDescendantId: string | undefined;
  /**
   * Moves to `value`, or back to the fallback with `null`. The value is kept as it is; the next
   * render drops it when it is not in that render's `items` or the hook is disabled, clearing any
   * earlier move. Scrolled into view unless `scroll` is `false`.
   */
  setActiveValue: (value: string | null, options?: { scroll?: boolean }) => void;
  /**
   * Moves to `value` for pointer movement, not scrolled into view; ignored while disabled, when
   * `value` is not in `items` or is already active.
   */
  highlight: (value: string) => void;
  /** Moves to the first item. */
  first: () => void;
  /** Moves to the last item. */
  last: () => void;
  /** The item after the active one (the first when none is active); wraps with `loop`. */
  next: () => void;
  /** The item before the active one (the last when none is active); wraps with `loop`. */
  prev: () => void;
  /**
   * Moves `delta` items (PageDown: `move(10)`), clamped at the ends, never wrapping; from no active
   * item, a positive delta goes to the first item and a negative one to the last.
   */
  move: (delta: number) => void;
}

function sameValues(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function step(values: readonly string[], current: string | null, delta: number, loop: boolean) {
  const count = values.length;
  if (count === 0) return null;
  const index = current === null ? -1 : values.indexOf(current);
  if (index === -1) return delta > 0 ? values[0] : values[count - 1];
  let next = index + delta;
  if (next < 0 || next >= count) {
    next =
      loop && Math.abs(delta) === 1 ? (next + count) % count : Math.max(0, Math.min(count - 1, next));
  }
  return values[next];
}

/**
 * The active (virtually focused) item of a composite that keeps DOM focus on one element and points
 * `aria-activedescendant` at the active item: a combobox, a listbox that holds focus, a command
 * palette. The state is React state, so the active id is derived during render (server HTML
 * included) and nothing reads the DOM during render.
 *
 * - The moved-to item is dropped when it leaves `items` or while `enabled` is `false`, and does not
 *   come back without a user action; `fallback` is active while nothing was moved to.
 * - Keyboard and programmatic moves are scrolled into view (`{ block: 'nearest' }`); pointer moves
 *   (`highlight`) and `setActiveValue(value, { scroll: false })` are not.
 * - `onActiveValueChange` reports every change after the commit, once (StrictMode included).
 *
 * `useListbox` is built on it; use it directly for composites that are not listboxes.
 *
 * @example
 * const ad = useActiveDescendant({ items: results.map((r) => r.id), getId: (id) => `cmd-${id}`, enabled: open });
 * <input aria-activedescendant={ad.activeDescendantId} onKeyDown={(e) => { if (e.key === 'ArrowDown') ad.next(); }} />
 */
export function useActiveDescendant(options: UseActiveDescendantOptions): UseActiveDescendantResult {
  const {
    items,
    getId,
    enabled = true,
    fallback = null,
    loop = false,
    activateFirstOnChange = false,
    getElement,
    onActiveValueChange,
  } = options;

  const itemSet = React.useMemo(() => new Set(items), [items]);
  const [movedRaw, setMovedRaw] = React.useState<string | null>(null);
  let moved = enabled ? movedRaw : null;

  // activateFirstOnChange: tracked (and updated) only while the option is on, so a render without
  // it adds no render-phase update (C-HOOKS: adjust-during-render).
  const [track, setTrack] = React.useState(() => ({ enabled, items }));
  if (activateFirstOnChange) {
    const itemsChanged = !sameValues(track.items, items);
    if (itemsChanged || track.enabled !== enabled) {
      setTrack({ enabled, items });
      if (enabled && itemsChanged) moved = items[0] ?? null;
    }
  }
  if (moved !== null && !itemSet.has(moved)) moved = null;
  if (moved !== movedRaw) setMovedRaw(moved);

  const activeValue = enabled
    ? (moved ?? (fallback !== null && itemSet.has(fallback) ? fallback : null))
    : null;
  const activeDescendantId = activeValue === null ? undefined : getId(activeValue);

  // The value the pointer (or a `scroll: false` move) activated, until the scroll effect saw it.
  const noScrollRef = React.useRef<string | null>(null);

  const setActiveValue = useEventCallback(
    (value: string | null, moveOptions?: { scroll?: boolean }) => {
      noScrollRef.current = moveOptions?.scroll === false ? value : null;
      setMovedRaw(value);
    },
  );
  const highlight = useEventCallback((value: string) => {
    if (!enabled || !itemSet.has(value) || value === activeValue) return;
    noScrollRef.current = value;
    setMovedRaw(value);
  });
  const first = useEventCallback(() => setActiveValue(items[0] ?? null));
  const last = useEventCallback(() => setActiveValue(items[items.length - 1] ?? null));
  const next = useEventCallback(() => setActiveValue(step(items, activeValue, 1, loop)));
  const prev = useEventCallback(() => setActiveValue(step(items, activeValue, -1, loop)));
  const move = useEventCallback((delta: number) =>
    setActiveValue(step(items, activeValue, delta, loop)),
  );

  const resolveElement = useEventCallback((value: string): HTMLElement | null => {
    const custom = getElement?.(value);
    if (custom) return custom;
    return typeof document === 'undefined' ? null : document.getElementById(getId(value));
  });
  React.useLayoutEffect(() => {
    const suppressed = activeValue !== null && activeValue === noScrollRef.current;
    noScrollRef.current = null;
    if (activeValue === null || suppressed) return;
    resolveElement(activeValue)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeValue, resolveElement]);

  const reportedRef = React.useRef<string | null>(null);
  const report = useEventCallback((value: string | null) => onActiveValueChange?.(value));
  React.useEffect(() => {
    if (reportedRef.current === activeValue) return;
    reportedRef.current = activeValue;
    report(activeValue);
  }, [activeValue, report]);

  return {
    activeValue,
    activeDescendantId,
    setActiveValue,
    highlight,
    first,
    last,
    next,
    prev,
    move,
  };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/hooks/__tests__/useActiveDescendant.test.tsx --reporter=default`
Expected: PASS, clean output. Then `npx eslint src/hooks/useActiveDescendant.ts src/hooks/__tests__/useActiveDescendant.test.tsx` and `npx tsc -p tsconfig.dev.json --noEmit` pass (react-hooks rules: the render-phase `setMovedRaw`/`setTrack` are guarded adjust-during-render updates, as 0.7's `useListbox` does).

- [ ] **Step 5: Commit** (lead)

```bash
git add src/hooks/useActiveDescendant.ts src/hooks/__tests__/useActiveDescendant.test.tsx
git commit -m "feat(hooks): useActiveDescendant, the state of an active descendant"
```

### Task A2: `useListbox` on `useActiveDescendant` (no API change)

**Files:**
- Modify: `src/hooks/useListbox.ts` (lines 876–960 highlight state and methods; 962–1078 key handler's uses; 1102–1113 scroll effect)
- Test: `src/hooks/__tests__/useListbox.test.tsx` (unchanged in this task)

**Interfaces:**
- Consumes: `useActiveDescendant` (Task A1).
- Produces: the same `useListbox` API as 0.7 (this task is a pure refactor).

- [ ] **Step 1: Run the 0.7 suites as the baseline**

Run: `npx vitest run src/hooks/__tests__/useListbox.test.tsx src/components/input/__tests__/{Dropdown,Combobox,TagPicker,TimePicker,Option}.test.tsx --reporter=default`
Expected: PASS (baseline).

- [ ] **Step 2: Replace the highlight state with the hook**

In `useListbox`, after `enabledValues`/`enabledSet`/`itemByValue`/`hiddenSet` are computed, delete `activeRaw`/`highlighted`/`filterTrack` (0.7 lines 883–907), `pointerHighlightRef`, `setActive`, `highlight` and the scroll effect (lines 1102–1113), and add:

```ts
const firstSelected = enabledValues.find((value) => selectedSet.has(value)) ?? null;
let fallback: string | null = null;
if (autoHighlight === 'selected') fallback = firstSelected ?? enabledValues[0] ?? null;
else if (autoHighlight === 'first') fallback = enabledValues[0] ?? null;

const getOptionId = useCallback(
  (value: string) => `${listboxId}-opt-${store.getIndex(value)}`,
  [listboxId, store],
);
const getElement = useCallback((value: string) => store.getElement(value), [store]);

const ad = useActiveDescendant({
  items: enabledValues,
  getId: getOptionId,
  enabled: open,
  fallback,
  loop,
  activateFirstOnChange: highlightOnFilter,
  getElement,
});
const { activeValue, activeDescendantId } = ad;
```

Then in the rest of the hook: `setActive(v)` → `ad.setActiveValue(v)`; `move(delta)` → `ad.move(delta)` (ArrowDown `ad.next()` and ArrowUp `ad.prev()` when open, keeping 0.7's `step` semantics through `move`); the context's `highlight` → `ad.highlight`; `setActiveValue` in the result → `ad.setActiveValue`; the typeahead `onMatch` → `ad.setActiveValue(value)`; `commit` → `multiple && reason === 'select' ? ad.setActiveValue(value) : ad.setActiveValue(null)`. `ListboxStoreImpl.getElement` becomes an arrow property (it is passed as a function).

- [ ] **Step 3: Run the 0.7 suites**

Run the Step 1 command. Expected: PASS with no test edited. If a render-count test (`useListbox.test.tsx:416-427`, `:463-497`, `:526-581`) fails, the hook adds a render-phase update without `activateFirstOnChange`: fix the hook, not the test.

- [ ] **Step 4: Commit** (lead)

```bash
git add src/hooks/useListbox.ts
git commit -m "refactor(hooks): build useListbox on useActiveDescendant"
```

### Task A3: `useListbox` API: `multiselect`, `details` callbacks, optional `onOpenChange`, `onActiveValueChange`, `ListboxOptionElementProps`

**Files:**
- Modify: `src/hooks/useListbox.ts`, `TagPicker.tsx` (one line: `multiple: true` → `multiselect: true`)
- Test: `src/hooks/__tests__/useListbox.test.tsx` (spec §6.4: `multiple:` → `multiselect:`; call assertions gain `details`)

**Interfaces:**
- Produces (spec §1.2.2–1.2.3, §1.2.5, §1.2.7, D38, D39, D42):

```ts
export type ListboxOpenChangeReason = 'keyboard' | 'select' | 'escape' | 'tab';
/** Second argument of `useListbox`'s `onSelect`. */
export interface ListboxSelectDetails {
  /** The committed option. */
  item: ListboxItem;
  /** The key or click event behind the commit. */
  event: Event;
}
// UseListboxOptions: multiselect?: boolean (was `multiple`);
//   onOpenChange?: (open: boolean, details?: OpenChangeDetails<ListboxOpenChangeReason>) => void;
//   onSelect: (value: string, details?: ListboxSelectDetails) => void;
//   onActiveValueChange?: (value: string | null) => void;
// ListboxContextValue: multiselect: boolean; select(value, item, event: Event): void;
// UseListboxOptionResult: multiselect: boolean;
// ListboxOptionProps → ListboxOptionElementProps
```

- [ ] **Step 1: Update the 0.7 tests for the new names and write the new ones**

In `useListbox.test.tsx`, replace every `multiple:` option with `multiselect:` and every call assertion of `onOpenChange`/`onSelect` with the `details` form, for example:

```ts
expect(onOpenChange).toHaveBeenLastCalledWith(
  false,
  expect.objectContaining({ reason: 'escape', event: expect.any(Event) }),
);
expect(onSelect).toHaveBeenLastCalledWith(
  'b',
  expect.objectContaining({ item: expect.objectContaining({ value: 'b' }), event: expect.any(Event) }),
);
```

Add:

```ts
it('reports the active option (open, arrows, hover, filter, close) once each', async () => {
  const onActiveValueChange = vi.fn();
  // Use the file's existing select-only harness with onActiveValueChange passed through.
  // Open with ArrowDown, press ArrowDown, hover the third option, close with Escape.
  // Expect the calls [['a'], ['b'], ['c'], [null]] (StrictMode render: the same list).
});
it('puts multiselect in the context and the option result', () => {
  // Render an option inside a multiselect listbox; assert useListboxOption(...).multiselect === true
  // and the context's multiselect === true.
});
```

(Write both with the file's harness helpers — the file already has a select-only and an editable harness component; reuse them and assert the exact call lists shown.)

- [ ] **Step 2: Run to see the failures**

Run: `npx vitest run src/hooks/__tests__/useListbox.test.tsx --reporter=default`
Expected: FAIL (unknown option `multiselect`; old call shapes).

- [ ] **Step 3: Implement**

- Rename the option and its uses; `getListboxProps()` sets `aria-multiselectable` from `multiselect`.
- `commit(value, reason, event, fallbackItem?)` calls `onSelect(value, { item, event })` and `onOpenChange?.(false, { reason, event })`; every `onOpenChange` call in the key handler passes `{ reason, event: event.nativeEvent }`; the context's `select(value, item, event)` forwards the click event (`useListboxOption`'s `onClick` passes `event.nativeEvent`).
- `onOpenChange` optional (`onOpenChange?.(…)`).
- `onActiveValueChange` passed to `useActiveDescendant`.
- Rename the exported type `ListboxOptionProps` to `ListboxOptionElementProps`; `UseListboxOptionResult.optionProps` uses it.
- `TagPicker.tsx`: `multiple: true` → `multiselect: true`.

- [ ] **Step 4: Run the suites**

Run: `npx vitest run src/hooks/__tests__/useListbox.test.tsx src/components/input/__tests__/{Dropdown,Combobox,TagPicker,TimePicker,Option}.test.tsx --reporter=default`
Expected: PASS.

- [ ] **Step 5: Commit** (lead)

```bash
git add src/hooks/useListbox.ts src/hooks/__tests__/useListbox.test.tsx src/components/input/TagPicker.tsx
git commit -m "feat(hooks): useListbox details callbacks, multiselect and active-value reports"
```

### Task A4: `disabledOptionsFocusable`

**Files:**
- Modify: `src/hooks/useListbox.ts`
- Test: `src/hooks/__tests__/useListbox.test.tsx`

**Interfaces:**
- Produces: `UseListboxOptions.disabledOptionsFocusable?: boolean` (default `false`), spec §1.2.4 and D6.

- [ ] **Step 1: Write the failing tests** (in the select-only harness with options a, b (disabled), c)

```ts
describe('disabledOptionsFocusable', () => {
  it('skips disabled options by default (0.7)', async () => {
    // open, ArrowDown from a → c
  });
  it('reaches disabled options with the arrows, Home/End, PageUp/PageDown and typeahead', async () => {
    // disabledOptionsFocusable: open (active a), ArrowDown → b, End → c, Home → a, type 'b' → b
  });
  it('commits nothing on a disabled active option and keeps the list open', async () => {
    // active b: Enter, Space, a click on b → onSelect not called, list still open
  });
  it('closes without committing on Tab and Alt+ArrowUp from a disabled active option', async () => {
    // single select-only, active b: Tab → onOpenChange(false, {reason:'tab'}), onSelect not called
  });
  it('lets the fallback be a disabled option', () => {
    // selected value 'b' (disabled), open → active b
  });
});
```

Write each with `userEvent.setup()` and assertions on `aria-activedescendant` (the option id via `getOptionId`) and on the `onSelect`/`onOpenChange` mocks.

- [ ] **Step 2: Run to see them fail**, then **Step 3: Implement**

```ts
const navigationValues = useMemo(
  () =>
    disabledOptionsFocusable
      ? navigable.map((item) => item.value)
      : navigable.filter((item) => !item.disabled).map((item) => item.value),
  [navigable, disabledOptionsFocusable],
);
```

Use `navigationValues` wherever 0.7 used `enabledValues` (the hook's `items`, the fallback, first/last, typeahead `getItems` with `disabled: disabledOptionsFocusable ? false : item.disabled`). In the Tab and Alt+ArrowUp branches, commit only when `activeValue !== null && !itemByValue.get(activeValue)?.disabled`, else `onOpenChange?.(false, { reason, event })`. `commit` keeps its disabled guard.

- [ ] **Step 4: Run** `npx vitest run src/hooks/__tests__/useListbox.test.tsx --reporter=default` → PASS.

- [ ] **Step 5: Commit** (lead): `feat(hooks): useListbox disabledOptionsFocusable`

### Task A5: Standalone mode and the pointer press

**Files:**
- Modify: `src/hooks/useListbox.ts`
- Test: `src/hooks/__tests__/useListbox.test.tsx`

**Interfaces:**
- Produces (spec §1.2.6–1.2.7, D5, D17): `mode: 'editable' | 'select-only' | 'standalone'`; in standalone mode `getListboxProps()` returns `{ id, role: 'listbox', tabIndex: 0, 'aria-activedescendant', 'aria-multiselectable'?, ref }`; `ListboxContextValue.mode` and `press(value: string): void`; `useListboxOption`'s `optionProps.onMouseDown` in standalone mode.

- [ ] **Step 1: Write the failing tests** with a standalone harness:

```tsx
function StandaloneHarness(props: { multiselect?: boolean; onSelect?: (v: string) => void }) {
  const [focused, setFocused] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const listbox = useListbox({
    open: focused,
    mode: 'standalone',
    multiselect: props.multiselect,
    selectedValues: selected,
    onSelect: (v) => {
      props.onSelect?.(v);
      setSelected((s) => (props.multiselect ? (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]) : [v]));
    },
  });
  return (
    <ListboxContext.Provider value={listbox.context}>
      <ul
        {...listbox.getListboxProps()}
        aria-label="Fruits"
        onKeyDown={listbox.onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <HarnessOption value="a">Apple</HarnessOption>
        <HarnessOption value="b">Banana</HarnessOption>
        <HarnessOption value="c">Cherry</HarnessOption>
      </ul>
    </ListboxContext.Provider>
  );
}
```

(`HarnessOption` is the file's existing option built on `useListboxOption`.) Tests: the list is tabbable and holds `aria-activedescendant` only while focused; ArrowDown/ArrowUp/Home/End/PageUp/PageDown/typeahead move; Enter and Space commit (single: select; multi: toggle) and the committed option stays active; `onOpenChange` is never called; Tab and Escape are not prevented (`fireEvent.keyDown` returns `true`); a `mousedown` on an unfocused list's option focuses the list and activates that option without `scrollIntoView` (spy), and the following click commits it.

- [ ] **Step 2: Run to see them fail**, then **Step 3: Implement**

- `typeahead` default: `mode !== 'editable'`.
- In the key handler: `const standalone = mode === 'standalone'`; for Tab, Escape and any `altKey` arrow in standalone mode, `return` before `preventDefault()`; `openWith(value)` calls `onOpenChange` only when not standalone; `commit` keeps the value active (`ad.setActiveValue(value)`) and never closes in standalone mode; `commitOrClose` never closes in standalone mode.
- A list-element callback ref in standalone mode (`const [listElement, setListElement] = useState<HTMLElement | null>(null)`), returned as `getListboxProps().ref`.
- `press(value)`: `listElement?.focus({ preventScroll: true }); ad.setActiveValue(value, { scroll: false });`.
- `useListboxOption`: when `context.mode === 'standalone'`, `optionProps.onMouseDown = (event) => { event.preventDefault(); context.press(value); }`.

- [ ] **Step 4: Run** the `useListbox` and picker suites → PASS.

- [ ] **Step 5: Commit** (lead): `feat(hooks): useListbox standalone mode`

### Task A6: `Option`, `OptionGroup`, `ListboxProvider`, `ListboxSurface`, `useListboxPopup`

**Files:**
- Modify: `Option.tsx`, `src/styles/__tests__/tokens.test.ts` (§1.8 pairs only)
- Test: `__tests__/Option.test.tsx`

**Interfaces:**
- Consumes: `useListboxOption(...).multiselect`, `ListboxContext`.
- Produces (spec §1.3, D7, D8, D16, D40, D42): `OptionProps.checkIcon?: Slot<'span'>`; `OptionGroupProps.label?: React.ReactNode`; `ListboxProvider` + `ListboxProviderProps { value: ListboxContextValue; children?: React.ReactNode }`; `ListboxSurfaceProps.listClassName?: string`, `surfaceClassName?: string`; `UseListboxPopupResult` (renamed from `ListboxPopup`).

- [ ] **Step 1: Write the failing tests** (in `Option.test.tsx`, with the file's listbox harness)

```tsx
it('replaces the check glyph with checkIcon and keeps the 0.7 svg by default', () => {
  renderInListbox(
    <>
      <Option value="a" checkIcon={<span data-testid="glyph">★</span>}>Apple</Option>
      <Option value="b">Banana</Option>
    </>,
    { selected: ['a', 'b'] },
  );
  expect(within(option('Apple')).getByTestId('glyph').closest('[aria-hidden="true"]')).not.toBeNull();
  expect(option('Banana').querySelector('svg')).toHaveClass('shrink-0');
});

it('keeps the default and warns once for a checkIcon that renders nothing', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  renderInListbox(<Option value="a" checkIcon={false}>Apple</Option>, { selected: ['a'] });
  expect(option('Apple').querySelector('svg')).not.toBeNull();
  expect(warn.mock.calls).toEqual([
    [
      '[WaveUI] Option: `checkIcon` renders nothing, so the default check shows: a selected option must show its state. Pass a glyph, or leave it unset.',
    ],
  ]);
});

it('draws a checkbox box in a multi-select list, without the Highlight outline', () => {
  renderInListbox(<Option value="a">Apple</Option>, { selected: ['a'], multiselect: true });
  const box = option('Apple').querySelector('[data-wave-option-box]');
  expect(box).toHaveAttribute('aria-hidden', 'true');
  expect(box).toHaveClass('bg-primary');
  expect(option('Apple').className).not.toMatch(/outline-\[Highlight\]/);
});

it('routes an OptionGroup name to its group list, a defined consumer name winning', () => {
  renderInListbox(
    <>
      <OptionGroup label="Citrus" aria-label="Sour fruit"><Option value="l">Lime</Option></OptionGroup>
      <OptionGroup aria-label="Other"><Option value="p">Pear</Option></OptionGroup>
      <OptionGroup label={<span>Berries</span>} aria-label={undefined}><Option value="s">Strawberry</Option></OptionGroup>
    </>,
  );
  expect(screen.getByRole('group', { name: 'Sour fruit' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Other' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Berries' })).toBeInTheDocument();
});

it('warns once for an unnamed group, an icon-only label included', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  renderInListbox(<OptionGroup label={<svg aria-hidden="true" />}><Option value="x">X</Option></OptionGroup>);
  expect(warn.mock.calls).toEqual([
    ['[WaveUI] OptionGroup: the group has no name. Give it a text `label`, `aria-label` or `aria-labelledby`.'],
  ]);
});

it('provides a listbox context through ListboxProvider', () => {
  // A component calls useListbox (select-only, open) and renders
  // <ListboxProvider value={listbox.context}><ul {...listbox.getListboxProps()}><Option value="a">Apple</Option></ul></ListboxProvider>
  // Expect the option to render with role option and no thrown context error.
});

it('lets listClassName replace the list’s maximum height', () => {
  // Render a minimal custom picker (useListbox + useListboxPopup + ListboxSurface, open)
  // with listClassName="max-h-80"; expect the listbox to have max-h-80 and not max-h-60.
});
```

Also the minimal custom picker case of spec §1.3 (opens, positions: `data-side`, closes on an outside press and on Escape, hands Escape to an enclosing layer while it shows nothing).

Add to `tokens.test.ts` `CONTRAST_PAIRS`: `['stroke-accessible', 'subtle-hover', 3]`, `['stroke-accessible', 'subtle-selected', 3]`, `['primary', 'subtle-selected', 3]` with the file's tabled ratios. If a pair fails, stop and report (spec §1.8).

- [ ] **Step 2: Run to see them fail**: `npx vitest run src/components/input/__tests__/Option.test.tsx src/styles/__tests__/tokens.test.ts --reporter=default`

- [ ] **Step 3: Implement**

```tsx
// Option.tsx — the check column (OptionImpl keeps its name, rule 20)
const checkClasses = cn('shrink-0', !selected && 'invisible');
const customCheck = checkIcon != null && slotRendersContent(checkIcon);
React.useEffect(() => {
  if (checkIcon != null && !slotRendersContent(checkIcon)) {
    warnOnce(
      'Option:checkIcon-empty',
      'Option: `checkIcon` renders nothing, so the default check shows: a selected option must show its state. Pass a glyph, or leave it unset.',
    );
  }
}, [checkIcon]);
const glyph = customCheck
  ? renderSlot(checkIcon, 'span', cn('inline-flex', checkClasses), { 'aria-hidden': true })
  : <CheckIcon className={checkClasses} />;
const check = !showCheck ? null : multiselect ? (
  <span
    aria-hidden="true"
    data-wave-option-box=""
    className={cn(
      'flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border',
      selected
        ? cn('border-primary bg-primary text-primary-foreground', forcedColors.selectedLeaf)
        : cn('border-stroke-accessible bg-transparent', forcedColors.control),
    )}
  >
    {selected && (customCheck ? glyph : <CheckIcon size={12} />)}
  </span>
) : glyph;
// className: cn(OPTION_CLASSES, selected && !multiselect && forcedColors.selectedContainer, className)
```

Use `forcedColors.selectedLeaf` (DatePicker's day buttons use it; the `selected` key of `src/lib/styles.ts` is its deprecated alias).

OptionGroup: take `'aria-label'` and `'aria-labelledby'` out of `rest`; render the heading `<div id={labelId}>` only when `label != null`; on the `<ul role="group">`: `aria-label={ariaLabel}` and `aria-labelledby={ariaLabelledBy ?? (ariaLabel === undefined && label != null ? labelId : undefined)}`; an effect after mount reads the group element's accessible name inputs (the heading's `textContent.trim()`, `aria-label`, `aria-labelledby`) and warns once (`OptionGroup:unnamed`) when all are empty.

ListboxProvider:

```tsx
/** Props of {@link ListboxProvider}. */
export interface ListboxProviderProps {
  /** The context of a listbox: `useListbox(...).context`. */
  value: ListboxContextValue;
  /** The options (`Option`, `OptionGroup` or options of your own on `useListboxOption`). */
  children?: React.ReactNode;
}

/**
 * Provides a listbox's context to its options, for a custom picker that renders its list without
 * `ListboxSurface`: `<ListboxProvider value={listbox.context}><ul {...listbox.getListboxProps()}>…</ul></ListboxProvider>`.
 */
export function ListboxProvider({ value, children }: ListboxProviderProps) {
  return <ListboxContext.Provider value={value}>{children}</ListboxContext.Provider>;
}
ListboxProvider.displayName = 'ListboxProvider';
```

ListboxSurface: `className={cn('min-h-0 max-h-60 overflow-auto', listClassName)}` on the `<ul>` and `cn('flex flex-col … shadow-4', surfaceClassName)` on the surface. Rename `ListboxPopup` → `UseListboxPopupResult`. Rewrite the JSDoc of `Option`, `OptionGroup`, `ListboxSurface`, `useListboxPopup` for consumers (rule 26).

- [ ] **Step 4: Run** `Option.test.tsx`, `tokens.test.ts` and the picker suites → PASS.

- [ ] **Step 5: Commit** (lead): `feat(input): Option checkIcon and multi-select box; OptionGroup names; ListboxProvider`

### Task A7: Public exports, pinned tests, date types, the flat-name bridge

**Files:**
- Modify: `src/index.ts`, `index.ts`, `src/lib/types.ts`, `src/lib/__tests__/types.test.ts`, `src/lib/layers.ts` (JSDoc of `DismissReason` only), `src/hooks/useListbox.ts` (missing-context message, public JSDoc), `src/__tests__/public-types.test.ts`, `src/__tests__/integration.test.tsx` (internal-helper list only), `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs` (bridge case only), `Option.test.tsx:205`, `useListbox.test.tsx:2365,2389`

**Interfaces:**
- Produces: the entry exports of spec §1.6; `DayOfWeek`, `FirstWeekOfYear` (§1.5); `PENDING_FLAT_EXPORTS = ['SwatchPicker']`.

- [ ] **Step 1: Write the failing tests**

- `types.test.ts`: `expectTypeOf<DayOfWeek>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5 | 6>()` and `expectTypeOf<FirstWeekOfYear>().toEqualTypeOf<'first-day' | 'first-full-week' | 'first-four-day-week'>()`.
- `public-types.test.ts`: import the §1.6 names; `expectTypeOf<UseActiveDescendantResult['activeDescendantId']>().toEqualTypeOf<string | undefined>()`; `expectTypeOf<UseListboxOptions['mode']>().toEqualTypeOf<'editable' | 'select-only' | 'standalone'>()`; `expectTypeOf<ListboxListProps['tabIndex']>().toEqualTypeOf<0 | -1>()`; `expectTypeOf<DismissReason>().toEqualTypeOf<'escape' | 'outside-press' | 'focus-outside'>()`.
- The three message assertions: `'[WaveUI] Option must be used within a listbox (Listbox, Combobox, Dropdown or a ListboxProvider)'`.
- `integration.test.tsx`: remove `useListbox`, `collectOptionLabels`, `markListboxElement`, `useListboxPopup`, `ListboxSurface` from the internal list and add `'ListboxContext'`.
- `verify-dist.test.mjs` bridge case:

```js
it('lists SwatchPicker until INTEGRATION exports SwatchPickerRow', async () => {
  expect(PENDING_FLAT_EXPORTS).toEqual(['SwatchPicker']);
  const mod = await import('../../src/index.ts');
  const result = checkFlatExports(mod);
  expect(result.errors).toEqual([]);
  expect([...result.planned, ...result.pending].some((n) => n.startsWith('SwatchPicker'))).toBe(true);
}, 60_000);
```

- [ ] **Step 2: Run to see them fail**: `npx vitest run src/lib/__tests__/types.test.ts src/__tests__/public-types.test.ts src/__tests__/integration.test.tsx src/components/input/__tests__/Option.test.tsx src/hooks/__tests__/useListbox.test.tsx scripts/__tests__/verify-dist.test.mjs --reporter=default`

- [ ] **Step 3: Implement** the types (spec §1.5 code), the exports (spec §1.6: `src/index.ts` under Hooks and Utilities, `index.ts` for the `Option.tsx` exports), `DismissReason`'s JSDoc ("Why a popup layer is dismissed: Escape, a press outside it, or focus moving outside it."), the message, `PENDING_FLAT_EXPORTS = ['SwatchPicker']`, and `useListbox.ts`'s public JSDoc (spec §1.2.8; remove "spec §2.5" and "input-pickers#…" references; document `highlightOnFilter` → `activateFirstOnChange` and the navigability `filter`).

- [ ] **Step 4: Wave A exit gate** (spec §1.9)

Run: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && node scripts/verify-dist.mjs && npm run build-storybook`
Expected: all pass.

- [ ] **Step 5: Commit** (lead): `feat: export the listbox primitives, useActiveDescendant and the date types`

---

## Wave B — four packages in parallel (each package runs its tasks in order; the lead commits after each task)

### Package P5-pickers

#### Task B1: Multi-select Dropdown (P5-01, D9, D10, D36, D41)

**Files:**
- Modify: `Dropdown.tsx`, `stories/Dropdown.stories.tsx`
- Test: `__tests__/Dropdown.test.tsx`

**Interfaces:**
- Consumes: `useListbox` (`multiselect`, `details`), `useAnnounce` (`src/hooks/useAnnounce.ts`: `useAnnounce(): (message, politeness?) => void`).
- Produces:

```ts
export interface DropdownLabels {
  /** @default 'Clear selection' */ clear?: string;
  /** The text of the selected labels with `multiselect`. @default (labels) => labels.join(', ') */
  selection?: (labels: string[]) => string;
  /** @default (label, count) => `${label} added, ${count} selected` */
  added?: (label: string, count: number) => string;
  /** @default (label, count) => `${label} removed, ${count} selected` */
  removed?: (label: string, count: number) => string;
}
export interface DropdownProps<M extends boolean = false> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | RoutedHandlers> {
  multiselect?: M;
  value?: M extends true ? readonly string[] : string;
  defaultValue?: M extends true ? readonly string[] : string;
  onValueChange?: M extends true ? (value: string[]) => void : (value: string) => void;
  // 0.7 members unchanged
}
export interface DropdownComponent {
  (props: DropdownProps<true> & { multiselect: true }): React.ReactNode;
  (props: DropdownProps): React.ReactNode;
  displayName?: string;
  Option: typeof Option;
  OptionGroup: typeof OptionGroup;
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
function renderMulti(props: Partial<DropdownProps<true>> = {}) {
  return render(
    <Dropdown aria-label="Fruit" multiselect {...props}>
      {FRUITS}
    </Dropdown>,
  );
}

describe('multiselect', () => {
  it('toggles options with Enter, Space and a click and keeps the list open', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderMulti({ onValueChange });
    await user.click(combobox());
    await user.click(option('Apple'));
    await user.keyboard('{ArrowDown}{Enter}{ArrowDown}{ }');
    expect(onValueChange.mock.calls).toEqual([[['a']], [['a', 'b']], [['a', 'b', 'c']]]);
    expect(listbox()).toHaveAttribute('aria-multiselectable', 'true');
    expect(option('Banana')).toHaveAttribute('aria-selected', 'true');
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes without committing on Tab, Escape and Alt+ArrowUp', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderMulti({ onValueChange });
    await user.click(combobox());
    await user.keyboard('{ArrowDown}{Alt>}{ArrowUp}{/Alt}');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows labels.selection of the labels in selection order, truncated, and leaves unknown values out', () => {
    renderMulti({ defaultValue: ['c', 'zz', 'a'] });
    const text = combobox().querySelector('span');
    expect(text).toHaveTextContent('Cherry, Apple');
    expect(text).toHaveClass('truncate');
  });

  it('localizes the joined text', () => {
    renderMulti({ defaultValue: ['a', 'b'], labels: { selection: (l) => l.join('、') } });
    expect(combobox()).toHaveTextContent('Apple、Banana');
  });

  it('announces each toggle, not a clear', async () => {
    const user = userEvent.setup();
    renderMulti({ clearable: true });
    await user.click(combobox());
    await user.click(option('Apple'));
    expect(__getAnnouncerText()).toBe('Apple added, 1 selected');
    await user.click(option('Apple'));
    expect(__getAnnouncerText()).toBe('Apple removed, 0 selected');
    await user.click(option('Banana'));
    __resetAnnouncer();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(__getAnnouncerText()).toBe('');
  });

  it('announces nothing for a controlled change', () => {
    const { rerender } = render(<Dropdown aria-label="Fruit" multiselect value={['a']}>{FRUITS}</Dropdown>);
    rerender(<Dropdown aria-label="Fruit" multiselect value={['a', 'b']}>{FRUITS}</Dropdown>);
    expect(__getAnnouncerText()).toBe('');
  });

  it('clears every value and focuses the button', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderMulti({ defaultValue: ['a', 'b'], clearable: true, onValueChange });
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onValueChange).toHaveBeenLastCalledWith([]);
    expect(combobox()).toHaveFocus();
  });

  it('submits one entry per value, requires one, and resets to defaultValue by content', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <form>
        <Dropdown aria-label="Fruit" multiselect name="fruit" required defaultValue={['a', 'b']} onValueChange={onValueChange}>
          {FRUITS}
        </Dropdown>
        <button type="reset">Reset</button>
      </form>,
    );
    const form = container.querySelector('form')!;
    expect(new FormData(form).getAll('fruit')).toEqual(['a', 'b']);
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('fires the deprecated onOptionSelect per toggle', async () => { /* with a warnDeprecated assertion */ });
  it('warns once for a duplicated value and toggles the first', async () => { /* two Options value "a" */ });
  it('calls onValueChange once per toggle in StrictMode', async () => { /* StrictMode wrapper */ });
});

describe('multiselect types', () => {
  it('types the value by signature and keeps ComponentProps', () => {
    expectTypeOf<React.ComponentProps<typeof Dropdown>>().toEqualTypeOf<DropdownProps>();
    void (<Dropdown multiselect onValueChange={(v) => expectTypeOf(v).toEqualTypeOf<string[]>()} />);
    void (<Dropdown value="a" onValueChange={(v) => expectTypeOf(v).toEqualTypeOf<string>()} />);
    // @ts-expect-error a string value with multiselect
    void (<Dropdown multiselect value="a" />);
    const flag = Math.random() > 0.5;
    // @ts-expect-error a non-literal multiselect matches neither signature
    void (<Dropdown multiselect={flag} />);
  });
});
```

(`__getAnnouncerText`/`__resetAnnouncer` come from `../../../hooks/useAnnounce`; call `__resetAnnouncer()` in an `afterEach`.)

- [ ] **Step 2: Run to see them fail**: `npx vitest run src/components/input/__tests__/Dropdown.test.tsx --reporter=default`

- [ ] **Step 3: Implement**

```tsx
const DropdownRoot = (props: DropdownProps<boolean>) => {
  const { multiselect = false, value: valueProp, defaultValue, onValueChange, labels, /* … 0.7 … */ } = props;
  const emptyValue = multiselect ? EMPTY_VALUES : '';
  const [value, setValue] = useControllable<string | readonly string[]>(
    valueProp,
    defaultValue ?? emptyValue,
    (next) => (onValueChange as ((v: string | string[]) => void) | undefined)?.(
      typeof next === 'string' ? next : [...next],
    ),
  );
  const values: readonly string[] =
    typeof value === 'string' ? (value ? [value] : []) : value;
  const announce = useAnnounce();
  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'select-only',
    multiselect,
    selectedValues: values,
    onSelect: (next) => {
      onOptionSelect?.(next);
      if (!multiselect) {
        setValue(next);
        return;
      }
      const on = !values.includes(next);
      const updated = on ? [...values, next] : values.filter((v) => v !== next);
      setValue(updated);
      const label = listbox.getItem(next)?.label ?? optionLabels.get(next) ?? next;
      announce((on ? (labels?.added ?? defaultAdded) : (labels?.removed ?? defaultRemoved))(label, updated.length));
    },
    idPrefix: 'dropdown-listbox',
  });
  const labelOf = (v: string) => listbox.getItem(v)?.label ?? optionLabels.get(v);
  const shown = values.map(labelOf).filter((l): l is string => l !== undefined);
  const displayText = multiselect
    ? shown.length > 0 ? (labels?.selection ?? defaultSelection)(shown) : ''
    : (shown[0] ?? '');
  // clear: setValue(multiselect ? [] : ''); reset: compare by content (sameValues) before setValue
  // HiddenInput: value={multiselect ? values : (value as string)}
};
export const Dropdown = /* @__PURE__ */ Object.assign(DropdownRoot, { Option, OptionGroup }) as DropdownComponent;
```

`EMPTY_VALUES: readonly string[] = []`; `defaultSelection = (l: string[]) => l.join(', ')`; `defaultAdded`/`defaultRemoved` as TagPicker's. Update the component JSDoc (multi-select paragraph; Fluent names; "a non-literal `multiselect` is a type error").

- [ ] **Step 4: Run** the Dropdown suite and `npx tsc -p tsconfig.dev.json --noEmit` → PASS.

- [ ] **Step 5: Story and commit**

Add a "Multiselect" story (`StoryObj<DropdownProps<true>>`, `args: { multiselect: true, clearable: true, 'aria-label': 'Fruits' }`, render forwarding `args`, children the story's options), then the lead commits: `feat(input): multi-select Dropdown`.

#### Task B2: Multi-select Combobox (P5-01, D11, D41)

**Files:**
- Modify: `Combobox.tsx`, `stories/Combobox.stories.tsx`
- Test: `__tests__/Combobox.test.tsx`

**Interfaces:**
- Consumes: as B1.
- Produces: `ComboboxProps<M>` (as `DropdownProps<M>`; `ComboboxProps<true>` omits `freeform`), `ComboboxComponent`, `ComboboxLabels` gains `selection`, `added`, `removed`; module export `insertedText(before: string, after: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('insertedText', () => {
  it.each([
    ['Apple, Banana', 'Apple, Bananac', 'c'],
    ['Apple, Banana', 'c', 'c'],
    ['Apple, Banana', 'Apple, xBanana', 'x'],
    ['Apple, Banana', 'Apple, Banan', ''],
    ['Apple, Banana', 'Apple, Banana', ''],
    ['ab', 'aab', 'a'],
  ])('%j → %j inserts %j', (before, after, expected) => {
    expect(insertedText(before, after)).toBe(expected);
  });
});

describe('multiselect', () => {
  it('shows the labels and no placeholder while values are selected', () => {
    render(<Combobox aria-label="Fruit" multiselect placeholder="Pick fruit" defaultValue={['a', 'b']}>{FRUITS}</Combobox>);
    expect(combobox()).toHaveValue('Apple, Banana');
    expect(combobox()).not.toHaveAttribute('placeholder');
  });

  it('selects the labels on Tab and on a click, so typing replaces them', async () => {
    const user = userEvent.setup();
    render(<><button type="button">Before</button><Combobox aria-label="Fruit" multiselect defaultValue={['a']}>{FRUITS}</Combobox></>);
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect([combobox().selectionStart, combobox().selectionEnd]).toEqual([0, 'Apple'.length]);
    await user.keyboard('ch');
    expect(combobox()).toHaveValue('ch');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cherry']);
  });

  it('queries only the text an edit inserted into the labels', () => {
    render(<Combobox aria-label="Fruit" multiselect defaultValue={['a', 'b']}>{FRUITS}</Combobox>);
    fireEvent.change(combobox(), { target: { value: 'Apple, Cher Banana' } });
    expect(combobox()).toHaveValue('Cher ');
  });

  it('shows the labels again for a value equal to them (an undo)', () => {
    render(<Combobox aria-label="Fruit" multiselect defaultValue={['a']}>{FRUITS}</Combobox>);
    fireEvent.change(combobox(), { target: { value: 'x' } });
    fireEvent.change(combobox(), { target: { value: 'Apple' } });
    expect(combobox()).toHaveValue('Apple');
    // no query: every option shows
  });

  it('clears the query after a toggle and keeps the list open', async () => {
    const user = userEvent.setup();
    render(<Combobox aria-label="Fruit" multiselect>{FRUITS}</Combobox>);
    await user.click(combobox());
    await user.keyboard('ch{Enter}');
    expect(combobox()).toHaveValue('Cherry');
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
  });

  it('never removes a value with Backspace or Delete', async () => { /* Backspace on the selected labels → '' query, value unchanged */ });
  it('handles paste and composition over the labels', async () => { /* user.paste('Ch'); compositionstart/end + input */ });
  it('shows the labels again on blur and close', async () => {});
  it('announces toggles, clears all, submits one entry per value, resets by content', async () => {});
  it('truncates many labels without growing and keeps the whole text as the value', () => {
    // 30 options all selected → input value equals the joined 30 labels; the input keeps its classes (w-full)
  });
  it('rejects freeform with multiselect at the type level', () => {
    // @ts-expect-error freeform is not in the multi-select signature
    void (<Combobox multiselect freeform />);
  });
});
```

- [ ] **Step 2: Run to see them fail**: `npx vitest run src/components/input/__tests__/Combobox.test.tsx --reporter=default`

- [ ] **Step 3: Implement**

```ts
/** The text an edit inserted into `before`, given the new value `after`: `after` without the part it shares with `before` at its start and at its end. */
export function insertedText(before: string, after: string): string {
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before[start] === after[start]) start += 1;
  let end = 0;
  while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end += 1;
  return after.slice(start, after.length - end);
}
```

In the root (multi-select branch only; single-select keeps 0.7): `const labelsText = labels?.selection ?? defaultSelection` applied to the selected labels; `const showingLabels = multiselect && draft === null && values.length > 0`; the input's `value` is `draft ?? (multiselect ? labelsText : …0.7…)`; `placeholder={multiselect && values.length > 0 ? undefined : placeholder}`;

```ts
const pointerFocusRef = React.useRef(false);
const onInputMouseDown = () => {
  if (showingLabels && inputRef.current !== document.activeElement) pointerFocusRef.current = true;
};
const onInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
  if (showingLabels) event.currentTarget.select();
};
const onInputMouseUp = (event: React.MouseEvent<HTMLInputElement>) => {
  if (!pointerFocusRef.current) return;
  pointerFocusRef.current = false;
  event.preventDefault(); // keeps the selection the focus made
};
// handleChange (multi-select, while the labels show):
//   const text = event.target.value;
//   if (text === shownLabels) return stopEditing();       // an undo
//   startEditing(insertedText(shownLabels, text));
```

Compose `onFocus` and `onMouseUp` with the consumer's (C-COMPOSE; `onFocus` is routed to the input in 0.7). The commit in multi-select mode toggles (as B1), announces, then stops editing (query `''`).

- [ ] **Step 4: Run** the Combobox suite and the dev typecheck → PASS.

- [ ] **Step 5: Story and commit**: "Multiselect" story; lead commits `feat(input): multi-select Combobox`.

#### Task B3: `query`, `defaultQuery`, `onQueryChange` and `filter` on Combobox and TagPicker (P5-02, D12, D13)

**Files:**
- Modify: `Combobox.tsx`, `TagPicker.tsx`, `stories/Combobox.stories.tsx`, `stories/TagPicker.stories.tsx`
- Test: `__tests__/Combobox.test.tsx`, `__tests__/TagPicker.test.tsx`

**Interfaces:**
- Produces: `filter?: (option: ListboxItem, query: string) => boolean`, `query?: string`, `defaultQuery?: string`, `onQueryChange?: (query: string) => void` on `ComboboxProps<M>` and `TagPickerProps` (JSDoc from spec §2 P5-02).

- [ ] **Step 1: Write the failing tests**

```tsx
it('filters with a custom filter and keeps options that do not contain the text', async () => {
  const user = userEvent.setup();
  render(
    <Combobox
      aria-label="Fruit"
      filter={(option, query) => option.value === 'create' || option.label.toLowerCase().startsWith(query.toLowerCase())}
    >
      {FRUITS}
      <Option value="create">Create …</Option>
    </Combobox>,
  );
  await user.type(combobox(), 'ba');
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Banana', 'Create …']);
});

it('reports and resets the query on each path, and follows a controlled query', async () => {
  const user = userEvent.setup();
  const onQueryChange = vi.fn();
  function Controlled() {
    const [query, setQuery] = React.useState('');
    return (
      <Combobox aria-label="Fruit" query={query} onQueryChange={(q) => { onQueryChange(q); setQuery(q); }}>
        {FRUITS}
      </Combobox>
    );
  }
  render(<Controlled />);
  await user.type(combobox(), 'ch');
  await user.keyboard('{Escape}');
  expect(onQueryChange.mock.calls).toEqual([['c'], ['ch'], ['']]);
});

it('reports a lock reset from an effect, once, without a render-phase update', () => {
  const error = vi.spyOn(console, 'error');
  const onQueryChange = vi.fn();
  const { rerender } = render(<Combobox aria-label="Fruit" defaultQuery="ch" onQueryChange={onQueryChange}>{FRUITS}</Combobox>);
  rerender(<Combobox aria-label="Fruit" defaultQuery="ch" disabled onQueryChange={onQueryChange}>{FRUITS}</Combobox>);
  expect(onQueryChange.mock.calls).toEqual([['']]);
  expect(error).not.toHaveBeenCalled();
});

it('filters freeform text, never calls onQueryChange, and warns about query props', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const onQueryChange = vi.fn();
  const user = userEvent.setup();
  render(<Combobox aria-label="Fruit" freeform defaultQuery="x" onQueryChange={onQueryChange}>{FRUITS}</Combobox>);
  await user.type(combobox(), 'ch');
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cherry']);
  expect(onQueryChange).not.toHaveBeenCalled();
  expect(warn.mock.calls).toEqual([
    ['[WaveUI] Combobox: `query` and `defaultQuery` are not used with `freeform`: the typed text is the value (`value`, `onValueChange`).'],
  ]);
});

it('supports async search with filter={() => true}', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  function Search() {
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<string[]>(['Apple', 'Banana']);
    React.useEffect(() => {
      const id = setTimeout(() => setResults(query ? ['Cherry'] : ['Apple', 'Banana']), 200);
      return () => clearTimeout(id);
    }, [query]);
    return (
      <Combobox aria-label="Fruit" filter={() => true} query={query} onQueryChange={setQuery}>
        {results.map((r) => <Option key={r} value={r}>{r}</Option>)}
      </Combobox>
    );
  }
  render(<Search />);
  await user.type(combobox(), 'x');
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cherry']);
  expect(activeOption()).toHaveTextContent('Cherry');
  vi.useRealTimers();
});
```

TagPicker: the same filter and query cases (its resets: a tag added, Escape with text, a form reset, locking; no reset on blur).

- [ ] **Step 2: Run to see them fail**

- [ ] **Step 3: Implement** (spec §2 P5-02 bullets). Combobox:

```ts
const [query, setQuery] = useControllable(freeform ? undefined : queryProp, defaultQuery ?? '', freeform ? undefined : onQueryChange);
const [editing, setEditing] = React.useState(false);
const locked = !interactive;
const draft = freeform ? freeformDraft : locked ? null : editing || query !== '' ? query : null;
React.useEffect(() => {
  if (!locked) return;
  setEditing(false);
  setQuery('');
}, [locked, setQuery]);
const filterText = freeform ? (freeformDraft ?? '') : (draft ?? '');
const listFilter = React.useMemo(
  () => (filterText ? (item: ListboxItem) => (filter ?? matchesText)(item, filterText) : undefined),
  [filterText, filter],
);
```

(`freeformDraft` is 0.7's `draft` state kept for the freeform path; `matchesText(item, text)` is 0.7's function with the `(item, query)` signature.) The freeform warning from an effect keyed on `freeform && (queryProp !== undefined || defaultQuery !== undefined)`. TagPicker: `useControllable(queryProp, defaultQuery ?? '', onQueryChange)`; its lock reset moves to an effect like Combobox's.

- [ ] **Step 4: Run** both suites → PASS.

- [ ] **Step 5: Stories and commit**: "Custom filter", "Async search" (keeps the previous results while loading), lead commits `feat(input): custom filtering and a controllable query`.

#### Task B4: `onActiveOptionChange` on Dropdown and Combobox (P5-02, D14)

**Files:** `Dropdown.tsx`, `Combobox.tsx`, their tests and stories.

**Interfaces:** `onActiveOptionChange?: (value: string | null) => void` → `useListbox({ onActiveValueChange })`.

- [ ] **Step 1: Failing tests** (both components): arrows, typeahead (Dropdown), hover (`user.hover(option('Banana'))`), filtering (Combobox), opening, `null` on close; StrictMode once:

```tsx
it('reports the active option and null on close', async () => {
  const user = userEvent.setup();
  const onActiveOptionChange = vi.fn();
  renderDropdown({ onActiveOptionChange });
  await user.click(combobox());
  await user.keyboard('{ArrowDown}');
  await user.hover(option('Cherry'));
  await user.keyboard('{Escape}');
  expect(onActiveOptionChange.mock.calls).toEqual([['a'], ['b'], ['c'], [null]]);
});
```

- [ ] **Step 2: Run to fail; Step 3: pass the prop through; Step 4: run to pass.**
- [ ] **Step 5: Story "Active option preview"; lead commits** `feat(input): onActiveOptionChange on Dropdown and Combobox`.

#### Task B5: Dropdown `expandIcon` and `renderValue`; `disabledOptionsFocusable` (P5-03 parts, D15)

**Files:** `Dropdown.tsx`, `Combobox.tsx`, their tests and stories.

**Interfaces:**
- Consumes: `showsExpandButton` (`Combobox.expand.tsx`), `unwrapButtonGlyph` (`../button/Button.slots`), `renderSlot` (`../../lib/slot`).
- Produces: `expandIcon?: Slot<'span'>`, `renderValue?`, `disabledOptionsFocusable?` (spec §2 P5-03 types).

- [ ] **Step 1: Failing tests**

```tsx
it('keeps the 0.7 chevron by default and hides it with false', () => {
  const { rerender } = renderDropdown({ clearable: true, defaultValue: 'a' });
  expect(combobox().querySelector('svg')).toHaveClass('absolute', 'end-3'); // 0.7
  rerender(<Dropdown aria-label="Fruit" clearable defaultValue="a" expandIcon={false}>{FRUITS}</Dropdown>);
  expect(combobox().querySelector('svg')).toBeNull();
  expect(combobox()).toHaveClass('pe-8'); // one button: the clear button
  expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveClass('end-1');
});

it('unwraps a button passed as expandIcon and warns once', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  renderDropdown({ expandIcon: <button type="button">▾</button> });
  expect(within(combobox()).queryByRole('button')).toBeNull();
  expect(warn.mock.calls).toEqual([
    ['[WaveUI] Dropdown: `expandIcon` received a button element; its children render as the glyph of the combobox button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.'],
  ]);
});

it('renders renderValue content while a value is selected', () => {
  renderDropdown({ defaultValue: 'a', renderValue: (v) => <b>{v.toUpperCase()}</b> });
  expect(combobox()).toHaveTextContent('A');
});

it('reaches disabled options with disabledOptionsFocusable and commits nothing on them', async () => {
  // options a, b (disabled), c; open, ArrowDown → b active; Enter → no onValueChange, list open
});
```

- [ ] **Step 2–4:** Run to fail; implement (spec D15: the default `ChevronDownIcon` keeps its 0.7 classes; a consumer glyph renders through `renderSlot(glyph, 'span', cn('absolute end-3 inline-flex transition-transform motion-reduce:transition-none', expanded && 'rotate-180'), { 'aria-hidden': true })`; end padding `pickerEndPadding(Number(showClear) + Number(showExpand))`, clear button `showExpand ? 'end-7' : 'end-1'`; `renderValue` replaces the value `<span>`'s content); run to pass.
- [ ] **Step 5: Lead commits** `feat(input): Dropdown expandIcon and renderValue; focusable disabled options`.

### Package P5-listbox

#### Task C1: `Listbox` (P5-03, D17, D41)

**Files:**
- Create: `Listbox.tsx`, `__tests__/Listbox.test.tsx`

**Interfaces:**
- Consumes: `useListbox` standalone mode (A5), `ListboxProvider` (A6), `useFieldControl`, `useFieldContext`, `useFormReset`, `useAnnounce`, `HiddenInput`, `focusRing`.
- Produces: spec §2 P5-03 Listbox types (`ListboxProps<M>`, `ListboxLabels`, `ListboxComponent`, `Listbox`, `ListboxOption`, `ListboxOptionGroup`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { Listbox, ListboxOption, ListboxOptionGroup, type ListboxProps } from '../Listbox';
import { Option, OptionGroup } from '../Option';

const OPTIONS = ['Apple', 'Banana', 'Cherry'].map((f) => (
  <Option key={f} value={f.toLowerCase()}>{f}</Option>
));
const list = () => screen.getByRole('listbox', { name: 'Fruits' });
const active = () => {
  const id = list().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};

testSystemProps(Listbox as React.ComponentType<ListboxProps>, {
  expectedTag: 'ul',
  displayName: 'Listbox',
  defaultProps: { 'aria-label': 'Fruits', children: OPTIONS },
  a11yVariants: [{ name: 'multiselect', props: { multiselect: true, defaultValue: ['apple'] } as never }],
});
testCompoundExposure(Listbox, ['Option', 'OptionGroup']);

it('exposes the flat names', () => {
  expect(ListboxOption).toBe(Listbox.Option);
  expect(ListboxOptionGroup).toBe(Listbox.OptionGroup);
});

it('has an active option only while focused: the selected, else the first', async () => {
  const user = userEvent.setup();
  render(<Listbox aria-label="Fruits" defaultValue="banana">{OPTIONS}</Listbox>);
  expect(active()).toBeNull();
  await user.tab();
  expect(active()).toHaveTextContent('Banana');
  await user.tab();
  expect(active()).toBeNull();
});

it('moves without wrapping and selects with Space and Enter', async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<Listbox aria-label="Fruits" onValueChange={onValueChange}>{OPTIONS}</Listbox>);
  await user.tab();
  await user.keyboard('{ArrowUp}{ArrowDown}{ }');
  expect(onValueChange.mock.calls).toEqual([['banana']]);
  await user.keyboard('{End}{ArrowDown}{Enter}');
  expect(onValueChange.mock.calls).toEqual([['banana'], ['cherry']]);
  await user.keyboard('{Enter}');
  expect(onValueChange).toHaveBeenCalledTimes(2); // re-selecting changes nothing
});

it('toggles in multi-select mode and announces', async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<Listbox aria-label="Fruits" multiselect onValueChange={onValueChange}>{OPTIONS}</Listbox>);
  await user.tab();
  await user.keyboard('{ }{ArrowDown}{ }{ArrowUp}{ }');
  expect(onValueChange.mock.calls).toEqual([[['apple']], [['apple', 'banana']], [['banana']]]);
  expect(__getAnnouncerText()).toBe('Apple removed, 1 selected');
});

it('selects the pressed option of a scrolled list without scrolling first', async () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<Listbox aria-label="Fruits" defaultValue="cherry" onValueChange={onValueChange}>{OPTIONS}</Listbox>);
  await user.click(screen.getByRole('option', { name: 'Apple' }));
  expect(onValueChange).toHaveBeenCalledWith('apple');
  expect(scroll).not.toHaveBeenCalled();
  expect(list()).toHaveFocus();
});

it('draws the focus ring when no option can be active', async () => {
  const user = userEvent.setup();
  render(<Listbox aria-label="Fruits">{[]}</Listbox>);
  await user.tab();
  expect(list()).toHaveFocus();
  expect(list().className).toMatch(/focus-visible:outline/);
});

it('is not focusable, selects nothing and submits nothing while disabled', async () => {
  const user = userEvent.setup();
  render(<form><Listbox aria-label="Fruits" disabled name="fruit" defaultValue="apple">{OPTIONS}</Listbox></form>);
  expect(list()).not.toHaveAttribute('tabindex');
  expect(list()).toHaveAttribute('aria-disabled', 'true');
  await user.click(screen.getByRole('option', { name: 'Banana' }));
  expect(list()).not.toHaveFocus();
});

it('takes part in forms: one entry per value, required, reset', async () => { /* FormData.getAll; required submit blocked + focus; reset */ });
it('is labelled and described by a Field', () => {
  renderWithFieldContext(<Listbox>{OPTIONS}</Listbox>, { required: true });
  expect(screen.getByRole('listbox', { name: FIELD_TEST_TEXT.label })).toHaveAttribute('aria-required', 'true');
});
it('reports the active option and null on blur, once in StrictMode', async () => {});
it('warns once when unnamed', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<Listbox>{OPTIONS}</Listbox>);
  expect(warn.mock.calls).toEqual([
    ['[WaveUI] Listbox: the listbox has no accessible name. Pass `aria-label` or `aria-labelledby`, or render it inside a Field.'],
  ]);
});
it('renders on the server without an active descendant and hydrates cleanly', async () => {});
```

- [ ] **Step 2: Run to see them fail**: `npx vitest run src/components/input/__tests__/Listbox.test.tsx --reporter=default`

- [ ] **Step 3: Implement**

```tsx
const ListboxRoot = (props: ListboxProps<boolean>) => {
  const {
    multiselect = false, value: valueProp, defaultValue, onValueChange, onActiveOptionChange,
    disabled = false, disabledOptionsFocusable = false, labels, name, form, required,
    id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid, 'aria-required': ariaRequired,
    onFocus, onBlur, onKeyDown, onKeyUp, className, children, ref, ...rest
  } = props;
  const field = useFieldContext();
  const fieldProps = useFieldControl(
    { id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid, 'aria-required': ariaRequired ?? required },
    { labelable: false },
  );
  const [value, setValue] = useControllable<string | readonly string[]>(/* as Dropdown B1 */);
  const values = /* normalise as B1 */;
  const [focused, setFocused] = React.useState(false);
  const announce = useAnnounce();
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const listbox = useListbox({
    open: focused && !disabled,
    mode: 'standalone',
    multiselect,
    selectedValues: values,
    disabledOptionsFocusable,
    onActiveValueChange: onActiveOptionChange,
    idPrefix: 'listbox',
    onSelect: (next) => {
      if (disabled) return;
      /* single: setValue(next); multi: toggle + announce, as B1 */
    },
  });
  const { ref: hookRef, ...listProps } = listbox.getListboxProps();
  const mergedRef = useMergedRefs(ref, listRef, hookRef);
  useFormReset(listRef, () => { /* restore defaultValue by content */ }, form);
  const unnamed = fieldProps['aria-label'] === undefined && fieldProps['aria-labelledby'] === undefined;
  React.useEffect(() => {
    if (unnamed) warnOnce('Listbox:unnamed', 'Listbox: the listbox has no accessible name. Pass `aria-label` or `aria-labelledby`, or render it inside a Field.');
  }, [unnamed]);
  return (
    <ul
      {...rest}
      {...fieldProps}
      id={fieldProps.id ?? listProps.id}
      role="listbox"
      tabIndex={disabled ? undefined : 0}
      aria-activedescendant={disabled ? undefined : listProps['aria-activedescendant']}
      aria-multiselectable={multiselect || undefined}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? '' : undefined}
      ref={mergedRef}
      onKeyDown={composeEventHandlers(onKeyDown, disabled ? undefined : listbox.onKeyDown)}
      onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
      onFocus={composeEventHandlers(onFocus, (e) => { if (e.target === e.currentTarget) setFocused(true); })}
      onBlur={composeEventHandlers(onBlur, (e) => { if (e.target === e.currentTarget) setFocused(false); })}
      className={cn(
        'relative flex flex-col py-1 text-foreground',
        // The active option's outline shows focus; with none, the list's own ring does (D17).
        listbox.activeValue === null ? focusRing : 'focus:outline-hidden',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <ListboxProvider value={listbox.context}>{children}</ListboxProvider>
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={multiselect ? values : (value as string)}
        type="text"
        required={required ?? field?.required ?? false}
        onInvalid={() => listRef.current?.focus()}
      />
    </ul>
  );
};
ListboxRoot.displayName = 'Listbox';
```

(C-FOCUS: a bare `outline-hidden` is banned; `focus:outline-hidden` hides the browser outline only while an option carries the focus indication.) Component JSDoc on the exported `Object.assign` const (List vs Listbox, keys, forms, Field, multi-select, Fluent names).

- [ ] **Step 4: Run** the Listbox suite, the conventions gate for `Listbox.tsx` and the dev typecheck → PASS.

- [ ] **Step 5: Lead commits** `feat(input): standalone Listbox`.

#### Task C2: Listbox stories, including the acceptance story

**Files:** Create `stories/Listbox.stories.tsx` (title `Components/Input/Listbox`; imports from `../src/components/input/Listbox`, `../src/components/input/Option`, `../src/hooks/useListbox`, `../src/hooks/useActiveDescendant` until wave C, rule 25).

- [ ] **Step 1:** Write the stories: Default, Multiselect, Groups, Disabled options (skipped / `disabledOptionsFocusable`), In a Field, "Custom picker" (a font picker: a `<button role="combobox">` with `useListbox({ mode: 'select-only' })`, `useListboxPopup`, `ListboxSurface` with `listClassName="max-h-80"`, fonts as `Option`s showing their font), "Command palette" (an `<input>` with `useActiveDescendant` over a filtered `<ul role="listbox">` of commands; Enter runs the active command). Every story has an accessible name; callbacks through `fn()`.
- [ ] **Step 2:** Run `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Input/Listbox" --reporter=default` → PASS.
- [ ] **Step 3: Lead commits** `docs(stories): Listbox, a custom picker and a command palette`.

### Package P5-swatches

#### Task D1: Swatch context, `ColorSwatch`, `items` through `ColorSwatch` (row layout)

**Files:**
- Create: `SwatchPicker.context.ts`, `SwatchPicker.swatches.tsx`, `__tests__/SwatchPicker.swatches.test.tsx`
- Modify: `SwatchPicker.tsx`, `__tests__/SwatchPicker.test.tsx` (`:198` only, spec §6.4)

**Interfaces:**
- Produces:

```ts
// SwatchPicker.context.ts
export interface SwatchPickerContextValue {
  value: string;                       // the selected value ('' for none)
  select: (value: string) => void;
  size: SwatchPickerSize;
  shape: Shape;
  layout: 'row' | 'grid';
  focusMode: 'arrow' | 'tab';
  spacing: 'small' | 'medium';
  getTabIndex: (value: string) => 0 | -1;
  register: (value: string) => () => void; // duplicate detection
}
export const SwatchPickerContext: React.Context<SwatchPickerContextValue | null>;
export function useSwatchPickerContext(component: string): SwatchPickerContextValue; // reportMissingContext(component, 'SwatchPicker'); inert value in production
```

`ColorSwatch` (spec §2 P5-04 `ColorSwatchProps`), `ref` on the `<button>`.

- [ ] **Step 1: Write the failing tests**: every 0.7 `SwatchPicker.test.tsx` case keeps passing with `items` rendered through `ColorSwatch` (update only `:198` to `expectTypeOf<SwatchPickerProps['items']>().toEqualTypeOf<readonly SwatchItem[] | undefined>()`); new cases:

```tsx
it('renders items before children in one radio group', () => {
  render(
    <SwatchPicker aria-label="Color" items={[{ value: 'red', color: '#d13438', label: 'Red' }]}> {/* wave-allow-color: fixture */}
      <ColorSwatch value="blue" color="#0f6cbd" aria-label="Blue" /> {/* wave-allow-color: fixture */}
    </SwatchPicker>,
  );
  expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Red', 'Blue']);
});

it('lets a Tooltip name and describe a swatch button', async () => {
  const user = userEvent.setup();
  render(
    <SwatchPicker aria-label="Color">
      <Tooltip content="Ocean blue" relationship="label">
        <ColorSwatch value="blue" color="#0f6cbd" /> {/* wave-allow-color: fixture */}
      </Tooltip>
    </SwatchPicker>,
  );
  expect(screen.getByRole('radio', { name: 'Ocean blue' })).toBeInTheDocument();
});

it('throws outside a picker in development and renders inert in production', () => {
  expectThrows(<ColorSwatch value="x" color="red" />, '[WaveUI] ColorSwatch must be used within SwatchPicker'); // wave-allow-color: fixture
});

it('warns once per duplicated value and once for an unnamed swatch', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(
    <SwatchPicker aria-label="Color">
      <ColorSwatch value="a" color="#000001" /> {/* wave-allow-color: fixture */}
      <ColorSwatch value="a" color="#000002" aria-label="Two" /> {/* wave-allow-color: fixture */}
    </SwatchPicker>,
  );
  expect(warn).toHaveBeenCalledTimes(2);
  expect(warn.mock.calls).toEqual(
    expect.arrayContaining([
      ['[WaveUI] ColorSwatch: swatch "a" has no accessible name, so it is announced by its color value. Pass `aria-label`, or wrap it in a Tooltip with `relationship="label"`.'],
      ['[WaveUI] SwatchPicker: several swatches share the value "a". Swatch values must be unique; only the first one can be selected.'],
    ]),
  );
});
```

- [ ] **Step 2: Run to fail**: `npx vitest run src/components/input/__tests__/SwatchPicker.test.tsx src/components/input/__tests__/SwatchPicker.swatches.test.tsx --reporter=default`

- [ ] **Step 3: Implement**: the context (null default, `reportMissingContext`, inert value), the registry (a `Map<string, number>` in a ref, `register` adds from a layout effect and returns the remover; a count > 1 warns once per value from an effect), `ColorSwatch` (the 0.7 button classes and `SwatchCheck`, `role="radio"`, `aria-checked`, `data-roving-value`, `data-selected`, `tabIndex={context.getTabIndex(value)}`, `onClick` composed with `context.select(value)`), and `SwatchPicker` rendering `items.map((item) => <ColorSwatch key value color aria-label={item.label || item.color} />)` before `children` inside the provider. The 0.7 `SwatchPicker:item-label` warning stays in `SwatchPicker`.

- [ ] **Step 4: Run** → PASS (0.7 cases unchanged, `ColorPicker.test.tsx` green).

- [ ] **Step 5: Lead commits** `refactor(input): SwatchPicker composes ColorSwatch children`.

#### Task D2: Swatch kinds, `disabled`, `icon`, `borderColor`, sizes, spacing, forced colours (D21, D22)

**Files:** `SwatchPicker.swatches.tsx`, `SwatchPicker.tsx`, their tests.

**Interfaces:** `ImageSwatch`, `EmptySwatch` (spec types), `SwatchPickerSize` with `'extra-small'`, `spacing`.

- [ ] **Step 1: Failing tests**: `disabled` (native `disabled`, skipped by the arrows, not selectable, the slash `<svg data-wave-swatch-slash>` present, dimmed); `icon` shown while not selected and replaced by the check while selected, a `<button>` icon unwrapped with the warning `ColorSwatch:icon-button`; `borderColor` inline `border-color`; per-swatch `size`/`shape` classes override the picker's; `ImageSwatch` `background-image: url(…)` and `bg-cover`, its check in theme tokens, named by `value` with `ImageSwatch:unnamed` when unnamed; `EmptySwatch` named `Add color` by default, a plain `<button>` outside the radio group's arrow order whose arrow keys are ignored, `onClick` called; sizes (`extra-small` → `w-5 h-5`), `spacing="small"` → `gap-1` and the focus outline offset 2; forced-colours classes (`ColorSwatch`: `forced-colors:forced-color-adjust-none`, `forced-colors:focus-visible:outline-[Highlight]`; `EmptySwatch`: `border-dashed border-stroke-accessible` with `forcedColors.control`).
- [ ] **Step 2–4:** Run to fail; implement per spec D21, D22; run to pass. The arrow-key guard: in `SwatchPicker`'s root `onKeyDown`, skip the roving handler when `event.target` has `data-wave-empty-swatch`.
- [ ] **Step 5: Lead commits** `feat(input): ImageSwatch, EmptySwatch and swatch options`.

#### Task D3: `useRovingGrid` (D20 keys, D23)

**Files:**
- Create: `src/hooks/useRovingGrid.ts`, `src/hooks/__tests__/useRovingGrid.test.tsx`

**Interfaces:**
- Consumes: `useRovingTabIndex` (`src/hooks/useRovingTabIndex.ts`), `getArrowIntent`/`getDirection` (`src/lib/direction.ts`).
- Produces:

```ts
export interface UseRovingGridOptions {
  /** The selected cell value (the first tab stop), or null. */
  activeValue: string | null;
}
export interface UseRovingGridResult {
  containerProps: RovingContainerProps; // from useRovingTabIndex, with onKeyDown composed
  getTabIndex: (value: string) => 0 | -1;
}
export function useRovingGrid(options: UseRovingGridOptions): UseRovingGridResult;
```

- [ ] **Step 1: Failing tests** with a 3×3 harness (`role="grid"`, rows, cells `<button data-roving-value>`, the middle-right cell disabled):

```tsx
function Grid({ disabled = ['b3'] }: { disabled?: string[] }) {
  const { containerProps, getTabIndex } = useRovingGrid({ activeValue: null });
  const rows = [['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], ['c1', 'c2']];
  return (
    <div role="grid" aria-label="Grid" {...containerProps}>
      {rows.map((row, r) => (
        <div role="row" key={r}>
          {row.map((v) => (
            <div role="gridcell" key={v}>
              <button type="button" data-roving-value={v} disabled={disabled.includes(v)} tabIndex={getTabIndex(v)}>{v}</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

it('moves in reading order and stops at the grid’s ends', async () => {
  const user = userEvent.setup();
  render(<Grid />);
  await user.tab(); // a1
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('button', { name: 'a1' })).toHaveFocus();
  await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
  expect(screen.getByRole('button', { name: 'b1' })).toHaveFocus();
});

it('moves Up and Down to the nearest enabled cell of the column, skipping rows without one', async () => {
  const user = userEvent.setup();
  render(<Grid />);
  await user.tab();
  await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}'); // a3 → b3 disabled → nearest enabled b2
  expect(screen.getByRole('button', { name: 'b2' })).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('button', { name: 'c2' })).toHaveFocus();
  await user.keyboard('{ArrowDown}'); // last row: stays
  expect(screen.getByRole('button', { name: 'c2' })).toHaveFocus();
});

it('goes to the row’s ends with Home/End and the grid’s ends with Ctrl+Home/End', async () => {});
it('mirrors Left and Right in RTL', async () => { /* renderWithProviders(<Grid />, { dir: 'rtl' }) */ });
it('keeps the last focused cell as the tab stop', async () => {});
it('ignores keys from outside its DOM (a portal)', () => {
  // render a portal child inside the grid's React tree; keyDown ArrowDown on it → no focus change
});
it('never loops when every cell is disabled', async () => {
  render(<Grid disabled={['a1','a2','a3','b1','b2','b3','c1','c2']} />);
  // no element is tabbable inside the grid; keyDown on the grid does nothing and returns
});
```

- [ ] **Step 2: Run to fail**; **Step 3: Implement**

```ts
export function useRovingGrid({ activeValue }: UseRovingGridOptions): UseRovingGridResult {
  const roving = useRovingTabIndex({
    activeValue,
    orientation: 'horizontal',
    loop: false,
    homeEndKeys: false,
    tabStop: 'last-focused',
  });
  const onKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const container = event.currentTarget;
    const target = event.target as Element | null;
    if (!target || !container.contains(target)) return;
    const cell = target.closest<HTMLElement>('[data-roving-value]');
    const row = cell?.closest('[role="row"]');
    if (!cell || !row || !container.contains(row)) return roving.containerProps.onKeyDown(event);
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[role="row"]'));
    const cellsOf = (r: Element) => Array.from(r.querySelectorAll<HTMLElement>('[data-roving-value]'));
    const isEnabled = (el: HTMLElement) =>
      !(el as HTMLButtonElement).disabled && !el.hasAttribute('data-roving-disabled');
    const focusCell = (el: HTMLElement | undefined) => {
      if (!el) return;
      event.preventDefault();
      roving.focusValue(el.getAttribute('data-roving-value')!);
    };
    const rowIndex = rows.indexOf(row as HTMLElement);
    const column = cellsOf(row).indexOf(cell);
    const nearest = (cells: HTMLElement[]) =>
      cells
        .map((el, index) => ({ el, distance: Math.abs(index - column), index }))
        .filter(({ el }) => isEnabled(el))
        .sort((a, b) => a.distance - b.distance || a.index - b.index)[0]?.el;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        for (let r = rowIndex + delta; r >= 0 && r < rows.length; r += delta) {
          const found = nearest(cellsOf(rows[r]));
          if (found) return focusCell(found);
        }
        event.preventDefault();
        return;
      }
      case 'Home':
      case 'End': {
        const scope = event.ctrlKey ? rows.flatMap(cellsOf) : cellsOf(row);
        const enabled = scope.filter(isEnabled);
        return focusCell(event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1]);
      }
      default:
        return roving.containerProps.onKeyDown(event);
    }
  });
  return { containerProps: { ...roving.containerProps, onKeyDown }, getTabIndex: roving.getTabIndex };
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Lead commits** `feat(hooks): internal grid roving for SwatchPicker`.

#### Task D4: Grid layout (D20)

**Files:** `SwatchPicker.tsx`, `SwatchPicker.swatches.tsx`, their tests.

**Interfaces:** `layout?: 'row' | 'grid'`, `SwatchPicker.Row` + `SwatchPickerRow` (JSDoc), `SwatchPickerLabels`, `labels`.

- [ ] **Step 1: Failing tests**: grid ARIA (`role="grid"`, rows, `gridcell` with `aria-selected`, the button `aria-pressed` and `data-selected`); implicit rows for `items` and loose children (D18's example: `items` + `EmptySwatch` → one row; `Row`, `Row`, loose `EmptySwatch` → a third implicit row), also with `asClientReference(SwatchPickerRow)`; axe clean in both layouts, selected, with `required` and inside `renderWithFieldContext(…, { required: true })` (no `aria-required` on the grid, the hint `Required` in its description: `toHaveAccessibleDescription(/Required/)`); Space and Enter select, arrows do not; the tab stop follows focus (Tab from an unselected cell leaves the grid); a Popover opened from an `EmptySwatch` keeps its keys; the all-disabled grid (Review Focus 2): no tabbable cell, keys do nothing; forms and reset in the grid layout; `testSystemProps` for `SwatchPicker.Row` and `testCompoundExposure(SwatchPicker, ['Row'])`.
- [ ] **Step 2–4:** Run to fail; implement (the root switches role and roving hook by `layout`; `SwatchPicker.Row` renders `role="row"` in the grid layout, a `basis-full` line otherwise; implicit rows via `flattenChildren(children)` + `isElementOfType(node, SwatchPickerRow)`, grouping consecutive non-Row nodes, `items` first; the swatch renders the gridcell wrapper in the grid layout; `aria-required` only on `radiogroup`, else a `hidden` `<span id>` with `labels.required ?? 'Required'` joined into `aria-describedby` through `joinIds`); run to pass.
- [ ] **Step 5: Lead commits** `feat(input): SwatchPicker grid layout`.

#### Task D5: Tab focus mode (D19) and the stories

**Files:** `SwatchPicker.tsx`, `SwatchPicker.swatches.tsx`, their tests, `stories/SwatchPicker.stories.tsx`.

- [ ] **Step 1: Failing tests**: `focusMode="tab"` in both layouts → `role="group"`, swatches are `<button aria-pressed>` (no radio or gridcell role), every enabled swatch has `tabIndex=0`, arrow keys do nothing, Space/Enter/click select, the required hint; axe clean; rows have no role.
- [ ] **Step 2–4:** Run to fail; implement; run to pass.
- [ ] **Step 5: Stories and commit**: "Swatch children with tooltips", "Grid layout", "Tab focus mode", "Swatch kinds", "Sizes and spacing" (imports from module paths, rule 25; fixture colours marked `// wave-allow-color: fixture`); stories gate for `Components/Input/SwatchPicker`; lead commits `feat(input): SwatchPicker tab focus mode; swatch stories`.

### Package P5-calendar

#### Task E1: `src/lib/date.ts` (D33)

**Files:**
- Create: `src/lib/date.ts`, `src/lib/__tests__/date.test.ts`
- Modify: `dateUtils.ts` (import the moved helpers; keep re-exporting them for internal users)

**Interfaces:**
- Produces (spec §2 P5-05 signatures): `addDays`, `addMonths`, `isSameDay`, `startOfWeek`, `getWeekNumber`, `GetWeekNumberOptions`; module-internal exports `makeDate`, `daysInMonth`, `startOfDay`, `startOfMonth` (not in the entry).

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { addDays, addMonths, getWeekNumber, isSameDay, startOfWeek } from '../date';

const fields = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];

describe('date helpers', () => {
  it('return local midnight', () => {
    expect(fields(addDays(new Date(2025, 2, 30, 23, 30), 1))).toEqual([2025, 3, 31, 0, 0]);
    expect(fields(addMonths(new Date(2025, 0, 31, 12), 1))).toEqual([2025, 2, 28, 0, 0]);
    expect(fields(addMonths(new Date(2024, 0, 31), 1))).toEqual([2024, 2, 29, 0, 0]);
    expect(fields(startOfWeek(new Date(2025, 5, 12, 15), 1))).toEqual([2025, 6, 9, 0, 0]);
  });
  it('compare calendar days', () => {
    expect(isSameDay(new Date(2025, 5, 1, 1), new Date(2025, 5, 1, 23))).toBe(true);
    expect(isSameDay(new Date(2025, 5, 1), null)).toBe(false);
  });
  it.each([0, 1, 2, 3, 4, 5, 6] as const)('startOfWeek for firstDayOfWeek %i', (first) => {
    const day = startOfWeek(new Date(2025, 5, 12), first);
    expect(day.getDay()).toBe(first);
    expect(day <= new Date(2025, 5, 12)).toBe(true);
  });
  it('numbers ISO weeks (first-four-day-week, Monday)', () => {
    const iso = { firstDayOfWeek: 1, firstWeekOfYear: 'first-four-day-week' } as const;
    expect(getWeekNumber(new Date(2021, 0, 1), iso)).toBe(53);
    expect(getWeekNumber(new Date(2026, 11, 31), iso)).toBe(53);
    expect(getWeekNumber(new Date(2027, 0, 4), iso)).toBe(1);
    expect(getWeekNumber(new Date(2025, 11, 29), iso)).toBe(1);
  });
  it('numbers first-day and first-full-week weeks', () => {
    expect(getWeekNumber(new Date(2025, 0, 1))).toBe(1); // first-day, Sunday
    expect(getWeekNumber(new Date(2025, 0, 4))).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 5))).toBe(2);
    expect(getWeekNumber(new Date(2025, 0, 4), { firstWeekOfYear: 'first-full-week' })).toBe(52); // Jan 5 2025 is the first Sunday
    expect(getWeekNumber(new Date(2025, 0, 5), { firstWeekOfYear: 'first-full-week' })).toBe(1);
  });
});
```

- [ ] **Step 2: Run to fail**; **Step 3: Implement**

```ts
import type { DayOfWeek, FirstWeekOfYear } from './types';

/** Local midnight of the given calendar fields (years 0–99 are not mapped to 1900–1999). */
export function makeDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);
  return date;
}
export function daysInMonth(year: number, monthIndex: number): number {
  return makeDate(year, monthIndex + 1, 0).getDate();
}
export function startOfDay(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate());
}
export function startOfMonth(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), 1);
}
/** `date` plus `amount` calendar days, at local midnight. */
export function addDays(date: Date, amount: number): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}
/** `date` plus `amount` months at local midnight; the day is clamped to the target month (January 31 + 1 month is February 28, or 29). */
export function addMonths(date: Date, amount: number): Date {
  const target = makeDate(date.getFullYear(), date.getMonth() + amount, 1);
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return makeDate(target.getFullYear(), target.getMonth(), day);
}
/** Whether both dates are on the same calendar day; `false` when either is missing. */
export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** The first day (local midnight) of `date`'s week. @param firstDayOfWeek The weekday weeks start on. @default 0 */
export function startOfWeek(date: Date, firstDayOfWeek: DayOfWeek = 0): Date {
  const offset = (date.getDay() - firstDayOfWeek + 7) % 7;
  return addDays(date, -offset);
}
/** Options of {@link getWeekNumber}. */
export interface GetWeekNumberOptions {
  /** @default 0 */
  firstDayOfWeek?: DayOfWeek;
  /** @default 'first-day' */
  firstWeekOfYear?: FirstWeekOfYear;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000,
  );
}
function weekOneStart(year: number, firstDayOfWeek: DayOfWeek, rule: FirstWeekOfYear): Date {
  const january1 = makeDate(year, 0, 1);
  const weekStart = startOfWeek(january1, firstDayOfWeek);
  const daysBefore = daysBetween(weekStart, january1);
  if (rule === 'first-day') return weekStart;
  if (rule === 'first-full-week') return daysBefore === 0 ? weekStart : addDays(weekStart, 7);
  return 7 - daysBefore >= 4 ? weekStart : addDays(weekStart, 7);
}
/**
 * The week number (1–53) of `date`: days before a year's week 1 belong to the previous year's last
 * week, and days in the next year's week 1 are week 1. ISO 8601 is `{ firstDayOfWeek: 1,
 * firstWeekOfYear: 'first-four-day-week' }`.
 */
export function getWeekNumber(date: Date, options: GetWeekNumberOptions = {}): number {
  const { firstDayOfWeek = 0, firstWeekOfYear = 'first-day' } = options;
  const day = startOfDay(date);
  const year = day.getFullYear();
  if (day >= weekOneStart(year + 1, firstDayOfWeek, firstWeekOfYear)) return 1;
  const start = weekOneStart(year, firstDayOfWeek, firstWeekOfYear);
  const from = day < start ? weekOneStart(year - 1, firstDayOfWeek, firstWeekOfYear) : start;
  return Math.floor(daysBetween(from, day) / 7) + 1;
}
```

`dateUtils.ts`: delete its copies and `import { addDays, addMonths, daysInMonth, isSameDay, makeDate, startOfDay, startOfMonth } from '../../lib/date';` re-exporting the ones its importers use (`DatePicker`, `TimePicker` keep their imports working).

- [ ] **Step 4: Run** `date.test.ts`, `dateUtils.test.ts`, `DatePicker.test.tsx`, `TimePicker.test.tsx` → PASS. **Step 5: Lead commits** `feat(lib): public date helpers`.

#### Task E2: Extract `CalendarView` (day view) from DatePicker — no behaviour change

**Files:**
- Create: `Calendar.tsx` (the internal `CalendarView` only in this task), `Calendar.views.tsx` (`CalendarDayGrid`)
- Modify: `DatePicker.tsx`

**Interfaces:**
- Produces: `CalendarView` (module export) with props `{ value: Date | null; onPick: (date: Date) => void; minDate?; maxDate?; disabledDates?; firstDayOfWeek: DayOfWeek; locale?: string; labels?: CalendarLabels; headingAs: 'h2' | 'div'; headingId: string }`; its grid carries `data-wave-calendar-grid`.

- [ ] **Step 1: Run the DatePicker suite as the baseline** (`npx vitest run src/components/input/__tests__/DatePicker.test.tsx --reporter=default` → PASS).
- [ ] **Step 2: Move** 0.7's view state (`viewMonth`, `focusedDay`, `focusTarget`, `moveFocus`, `navigateMonth`, `handleDayFocus`, `previousDisabled`/`nextDisabled`, `weekdays`, `toWeeks`, the roving layout effect, `handleGridKeyDown`, `NAV_BUTTON_CLASSES`, `DAY_CLASSES`, the header and `<table>` markup) into `CalendarView`/`CalendarDayGrid`. DatePicker renders `<CalendarView headingAs="h2" headingId={headingId} value={selectedDate} onPick={selectDate} … />` inside its dialog and its focus trap's `initialFocus` queries `surface.querySelector('[data-wave-calendar-grid] button[tabindex="0"]')`. `CalendarView` mounts with the dialog, so 0.7's `openSeen` reset is deleted (a remount shows the selected month again).
- [ ] **Step 3: Run the DatePicker suite** → PASS with no test edited (rule 23).
- [ ] **Step 4: Lead commits** `refactor(input): extract the DatePicker grid into CalendarView`.

#### Task E3: The standalone `Calendar` (D24, D25, D28, D35)

**Files:** `Calendar.tsx`, create `__tests__/Calendar.test.tsx`.

**Interfaces:** `Calendar`, `CalendarProps`, `CalendarLabels`, `CalendarValueChangeDetails` (spec §2 P5-05).

- [ ] **Step 1: Failing tests**: `testSystemProps(Calendar, { expectedTag: 'div', displayName: 'Calendar', defaultProps: { 'aria-label': 'Due date', today: new Date(2025, 5, 12) } })`; the 0.7 DatePicker grid key cases run on the Calendar (arrows, PageUp/PageDown, Shift+PageUp/PageDown, Home/End, Enter/Space) with `today` fixed; `onValueChange` only on change with `details.range` (`[picked day]`), once in StrictMode, and on a form reset with the restored range or `[]`; `required` blocks submit and focuses the tab stop; `renderWithFieldContext` (group name and description, `aria-invalid`, the `Required` hint in the description, no `aria-required`); today marked with the prop; without it: no `aria-current`, the tab stop on the selected day or the first available day, then today after hydration:

```tsx
it('treats today as unknown until hydration without the today prop', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2025, 5, 29, 23, 30));
  const html = renderToString(<Calendar aria-label="Due date" initialVisibleDate={new Date(2025, 5, 1)} />);
  expect(html).not.toContain('aria-current');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    vi.setSystemTime(new Date(2025, 5, 30, 1, 30)); // another day in the browser
    const errors = vi.spyOn(console, 'error');
    await act(async () => { hydrateRoot(container, <Calendar aria-label="Due date" initialVisibleDate={new Date(2025, 5, 1)} />); });
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-current="date"]')).toHaveAttribute('data-date', '2025-06-30');
  } finally {
    container.remove();
    vi.useRealTimers();
  }
});
```

Plus: `initialVisibleDate` and the clamp into `minDate`/`maxDate`; a controlled value moving to another month shows it; the invalid-locale warning (`Calendar:invalid-locale:de_DE`); the hydration warning without a date (`Calendar:hydration-date`, exact text asserted).
- [ ] **Step 2–4:** Run to fail; implement (the `role="group"` root with `relative`, `useControllable` compared by day, `useFieldControl(…, { labelable: false })` without `aria-required`, the hint `<span hidden id>`, `HiddenInput` ISO, `useFormReset`, `useIsClient` for today, `CalendarView headingAs="div"`); run to pass.
- [ ] **Step 5: Lead commits** `feat(input): standalone Calendar`.

#### Task E4: Month and year views (D26, D27) and DatePicker's Tab-order updates

**Files:** `Calendar.tsx`, `Calendar.views.tsx`, `dateUtils.ts` (decade and formatters), `__tests__/Calendar.test.tsx`, `__tests__/DatePicker.test.tsx` (`:724-740`, `:1730-1751` only).

- [ ] **Step 1: Failing tests**: the heading button (name = visible text, `aria-describedby` a `hidden` `Choose a month` outside the heading; the DatePicker dialog still named `June 2025`); a click on it shows the month view and focuses the month of the focused day; month view keys (±1 mirrored in RTL, ±4, Home/End row, PageUp/PageDown a year); a month pick shows its days with the day of the month clamped; the year view (decade + 1 before + 1 after, heading via `formatRange`), keys, PageUp/PageDown ±10, a pick shows its months; Escape: year → month → day, each showing the period before drilling up, `defaultPrevented` true; `document.activeElement` never `<body>` across every view change (assert after each step); months and years outside the bounds `aria-disabled` and reachable; Review Focus 3: `minDate` after `maxDate` and bounds excluding a decade → header buttons `aria-disabled`, paging clamps, no hang (the test completes); Review Focus 2: a month where `disabledDates` excludes every day still has one tab stop and the keys do not loop; every new button has `p-0`, `bg-transparent` and the gated `bg-subtle-hover`.
- [ ] **Step 2: DatePicker suite updates** (spec §6.4): the Tab-order tests gain the heading button between the previous- and next-month buttons.
- [ ] **Step 3–4:** Implement (a `view: 'day' | 'month' | 'year'` state with the period shown before drilling up kept in the state, focus moved in a layout effect keyed on the view, Escape handler on the view root that calls `preventDefault()`); run the Calendar and DatePicker suites → PASS.
- [ ] **Step 5: Lead commits** `feat(input): month and year views in Calendar and DatePicker`.

#### Task E5: Week numbers, marked days, custom days, ranges, Go to today, DatePicker's footer (D29–D32)

**Files:** `Calendar.tsx`, `Calendar.views.tsx`, `DatePicker.tsx`, their tests.

**Interfaces:** `CalendarProps` gains `showWeekNumbers`, `firstWeekOfYear`, `markedDates`, `renderDay`, `dayLabel`, `selectionRange`, `workWeekDays`, `showGoToToday`; `CalendarView` gains `onClose?: () => void` and `closeLabel?: string` (it renders the footer Close button when `onClose` is set); `DatePickerProps` gains the forwarded props and `showCloseButton`; `DatePickerLabels extends CalendarLabels` with `close`.

- [ ] **Step 1: Failing tests**: `showWeekNumbers` (row headers `<th scope="row" aria-label="Week 23">23</th>`, the header cell with an `aria-hidden` `#` and a hidden `Week`, axe clean, skipped by the keys, the three rules); `markedDates` (a dot in `currentColor` `aria-hidden`, `data-marked`, the name `Monday, June 2, 2025, marked`); `renderDay` content inside the button with the name kept, `dayLabel` sets the name; `selectionRange` `'week'`, `'work-week'`, `'month'` (every day `aria-selected` on the cell, `aria-pressed` and `data-selected` on the button, unavailable days left out, `details.range` in order), `workWeekDays`; "Go to today" (shows today's month, focuses today, selects nothing; disabled outside the bounds); DatePicker forwards the props, `showCloseButton` closes and returns focus as Escape does, Escape in its month view keeps the dialog open.
- [ ] **Step 2–4:** Run to fail; implement; run to pass.
- [ ] **Step 5: Lead commits** `feat(input): week numbers, marked days, ranges and Go to today`.

#### Task E6: Calendar and DatePicker stories

- [ ] **Step 1:** `stories/Calendar.stories.tsx` (Default, Localized with `today`, Week numbers ISO, Marked days, Custom day content with `dayLabel`, Week selection, Go to today, In a Field); `stories/DatePicker.stories.tsx` gains "Month and year picker", "Week numbers", "Close button".
- [ ] **Step 2:** Stories gate for `Components/Input/Calendar` and `Components/Input/DatePicker` → PASS.
- [ ] **Step 3: Lead commits** `docs(stories): Calendar and DatePicker month picker`.

---

## Wave C — INTEGRATION

### Task F1: Barrels, flat names, story imports, the empty bridge

**Files:** `src/index.ts`, `index.ts`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, `stories/{Listbox,Calendar,SwatchPicker,Dropdown,Combobox,TagPicker,DatePicker}.stories.tsx` (imports only).

- [ ] **Step 1:** Add spec §4.3's exports; `PENDING_FLAT_EXPORTS = []`; restore the bridge case to its 0.7 form (empty list, clean `checkFlatExports`); stories import from `../src`.
- [ ] **Step 2:** Run `npx vitest run src/__tests__/integration.test.tsx scripts/__tests__/verify-dist.test.mjs src/__tests__/stories.a11y.test.tsx --reporter=default` and `npm run build && node scripts/verify-dist.mjs` → PASS (the rule-21 known failure is gone).
- [ ] **Step 3: Lead commits** `feat: export Listbox, the swatch kinds, Calendar and the date helpers`.

### Task F2: `verify-dist` probes, fixtures, server probe, declarations

**Files:** `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`.

- [ ] **Step 1: Failing tests** in `verify-dist.test.mjs`: the two exclusion probes fail on a fixture dist whose `Calendar` imports `hooks/useListbox.mjs` and whose `Listbox` imports `components/input/Calendar.mjs`; the server probe reports a client-reference `addDays`; `REQUIRED_DECLARATIONS` reports a missing `useActiveDescendant` or `Calendar` declaration; the fixture `index.*` files and declarations (lines 71–77, 383, 585–700) gain `addDays`, `useActiveDescendant` and `Calendar`.
- [ ] **Step 2–3:** Implement through `probeTreeShaking` (`{ keep: 'Calendar', drop: 'Dropdown', dropModules: ['hooks/useListbox.mjs', 'components/input/Option.mjs'] }`, `{ keep: 'Listbox', drop: 'Calendar' }`) and a new branch of `serverProbeSource`'s `index` check; run `npx vitest run scripts/__tests__/verify-dist.test.mjs` and `npm run build && node scripts/verify-dist.mjs --final` → PASS.
- [ ] **Step 4: Lead commits** `test(scripts): phase 5 dist probes`.

### Task F3: Integration and public-type tests; the full gate

**Files:** `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`.

- [ ] **Step 1:** Write spec §4.4's eight cases and §4.5's type checks (the Server Component suite with `asClientReference` for `ListboxOption`, `ListboxOptionGroup`, `SwatchPickerRow`, `ColorSwatch`, `ImageSwatch`, `EmptySwatch`; `React.ComponentProps<typeof Dropdown>` equals `DropdownProps`; …).
- [ ] **Step 2:** Run them → PASS; then the full gate: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && node scripts/verify-dist.mjs --final && npm run check:package && npm run test:pack && npm run build-storybook`.
- [ ] **Step 3: Lead commits** `test: phase 5 integration and public types`.

---

## Wave D — DOCS

### Task G1: CHANGELOG `## [0.10.0] - Unreleased`

- [ ] Write spec §5.1 (Upgrading from 0.9, Added with gap ids, Changed with Behaviour/DOM/Types, Deprecated notice, Size measured with `npm run build` and the probes' reported sizes against 0.7.0). Run `node scripts/claude/gate.mjs --only changelog` if available, else check the section shape against 0.7.0's. Lead commits `docs: CHANGELOG for 0.10.0`.

### Task G2: README

- [ ] Write spec §5.2 (components, usage notes, Built-in text rows for every D36 member, Keyboard support rows, Hooks and utilities, Upgrading from 0.9). Lead commits `docs(readme): pickers, Listbox, swatches and Calendar`.

### Task G3: CLAUDE.md, guide, testing guide

- [ ] Write spec §5.3 and §5.4. Lead commits `docs: architecture, custom pickers and active-descendant testing`.

### Task G4: ROADMAP, the comparison guide, the gap report

- [ ] Write spec §5.5 and §5.6. Lead commits `docs: roadmap §8.3 and the Fluent comparison for 0.10`.

---

## Wave E — Final gate (lead)

### Task H1: `/gate` and the real-browser checklist

- [ ] **Step 1:** Run the `/gate` skill (`node scripts/claude/gate.mjs`); fix every reported failure in its owning task's files and commit the fix (`fix(<area>): …`).
- [ ] **Step 2:** Run `/browser-check` for Combobox, Dropdown, Listbox, SwatchPicker, Calendar and DatePicker against spec §6.3's seven items; record the results in the spec's §10 (implementation notes) and fix what fails.
- [ ] **Step 3:** Lead commits `docs(spec): phase 5 implementation notes`.

---

## Wave F — Merge with Phases 3 and 4 (lead, once Phase 4 is on `main`)

### Task I1: Merge, adapt, gate

- [ ] **Step 1:** `git fetch` and check `git log main --oneline -5` shows Phase 4's merge (which carries Phase 3). Then `git merge main` (a merge commit, no rebase).
- [ ] **Step 2:** Resolve the conflicts as spec §3.3 step 2 says (the known ones: `Dropdown.tsx`, `DatePicker.tsx` and its test, `TagPicker.tsx`, `Combobox.tsx`, `SwatchPicker.tsx`); shared files take the union.
- [ ] **Step 3:** Apply P3-00 to this phase's parts (spec §3.3 step 3: the registry constants, aliases and `NO_ELEMENT` entries; DatePicker's 0.8 part classes passed to `CalendarView` through a part-class prop; `swatchPickerClassNames.swatch` on every swatch; `checkIcon` and `expandIcon` classes on the default `<svg>`; `listClassName`/`surfaceClassName` carrying the hosts' `__listbox`/`__surface`). Run `npx vitest run src/__tests__/conventions.test.ts src/__tests__/classNames.test.ts --reporter=default` → PASS.
- [ ] **Step 4:** Apply P4-01 (spec §3.3 step 4: Dropdown's `expandIcon` glyph through `pickerGlyphSize` and the button table; nothing for Listbox and Calendar).
- [ ] **Step 5:** Merge the documents (spec §3.3 step 5) and remeasure the size report against 0.9.0.
- [ ] **Step 6:** Run the full gate (Task F3 Step 2's command) and `/gate` → PASS; commit the merge resolution (`chore: merge main (phases 3 and 4) into phase 5`).
